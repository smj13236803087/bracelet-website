import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isValidEmail, signSession } from '@/lib/security'

const SESSION_DAYS = 7

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; code?: string }
    const email = (body.email || '').trim().toLowerCase()
    const code = (body.code || '').trim()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { errno: 400, errmsg: '邮箱格式不正确', data: null },
        { status: 200 }
      )
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { errno: 400, errmsg: '验证码格式不正确', data: null },
        { status: 200 }
      )
    }

    const pending = await prisma.pendingUser.findUnique({ where: { email } })
    if (!pending || pending.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { errno: 400, errmsg: '验证码已失效，请重新获取', data: null },
        { status: 200 }
      )
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {})
      return NextResponse.json(
        { errno: 400, errmsg: '验证码已过期，请重新获取', data: null },
        { status: 200 }
      )
    }
    if (pending.verificationCode !== code) {
      return NextResponse.json(
        { errno: 400, errmsg: '验证码错误', data: null },
        { status: 200 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {})
      return NextResponse.json(
        { errno: 409, errmsg: '该邮箱已注册', data: null },
        { status: 200 }
      )
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: pending.name,
        password: pending.password,
        role: 'SUPER_ADMIN',
      },
    })

    await prisma.pendingUser.delete({ where: { email } }).catch(() => {})

    const now = Math.floor(Date.now() / 1000)
    const exp = now + SESSION_DAYS * 24 * 3600
    const token = signSession({ sub: user.id, email, iat: now, exp })

    const res = NextResponse.json(
      {
        errno: 0,
        errmsg: '',
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    )

    res.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 24 * 3600,
    })

    return res
  } catch (err) {
    console.error('后台注册验证失败：', err)
    return NextResponse.json(
      { errno: 500, errmsg: '注册失败', data: null },
      { status: 200 }
    )
  }
}
