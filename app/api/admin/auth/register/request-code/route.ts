import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import redis from '@/lib/redis'
import { generate6DigitCode, hashPassword, isValidEmail } from '@/lib/security'
import { sendVerificationCodeEmail } from '@/lib/mailer'

const CODE_TTL_SEC = 10 * 60
const RESEND_COOLDOWN_SEC = 60

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string
      name?: string
      password?: string
    }

    const email = (body.email || '').trim().toLowerCase()
    const name = (body.name || '').trim()
    const password = body.password || ''

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { errno: 400, errmsg: '邮箱格式不正确', data: null },
        { status: 200 }
      )
    }
    if (!name) {
      return NextResponse.json(
        { errno: 400, errmsg: '姓名不能为空', data: null },
        { status: 200 }
      )
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { errno: 400, errmsg: '密码长度至少 8 位', data: null },
        { status: 200 }
      )
    }

    const cooldownKey = `admin-register:cooldown:${email}`
    const ttl = await redis.ttl(cooldownKey)
    if (ttl > 0) {
      return NextResponse.json(
        { errno: 429, errmsg: `发送过于频繁，请 ${ttl} 秒后重试`, data: null },
        { status: 200 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { errno: 409, errmsg: '该邮箱已注册', data: null },
        { status: 200 }
      )
    }

    const code = generate6DigitCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_SEC * 1000)
    const passwordHash = hashPassword(password)

    await prisma.pendingUser.upsert({
      where: { email },
      create: {
        email,
        name,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        verificationCode: code,
        expiresAt,
      },
      update: {
        name,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        verificationCode: code,
        expiresAt,
      },
    })

    await sendVerificationCodeEmail({ to: email, code, purpose: 'register' })
    await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SEC)

    return NextResponse.json(
      { errno: 0, errmsg: '', data: { expiresInSeconds: CODE_TTL_SEC } },
      { status: 200 }
    )
  } catch (err) {
    console.error('后台注册发送验证码失败：', err)
    return NextResponse.json(
      { errno: 500, errmsg: '发送验证码失败', data: null },
      { status: 200 }
    )
  }
}
