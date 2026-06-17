import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isValidEmail, signSession } from '@/lib/security'
import { createOrGetShopifyCustomer } from '@/lib/shopify/admin'

const SESSION_DAYS = 7

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; code?: string }
    const email = (body.email || '').trim().toLowerCase()
    const code = (body.code || '').trim()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '验证码格式不正确' }, { status: 400 })
    }

    const pending = await prisma.pendingUser.findUnique({ where: { email } })
    if (!pending || pending.role !== 'USER') {
      return NextResponse.json({ error: '验证码已失效，请重新获取' }, { status: 400 })
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {})
      return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 })
    }
    if (pending.verificationCode !== code) {
      return NextResponse.json({ error: '验证码错误' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {})
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 })
    }

    // 先创建本地用户；随后同步 Shopify customer。如果同步失败，删除本地用户，保证一致性
    const user = await prisma.user.create({
      data: {
        email,
        password: pending.password,
        name: pending.name,
        role: 'USER',
        shopifyEmail: email,
      },
    })

    try {
      const customer = await createOrGetShopifyCustomer({
        email,
        name: pending.name,
      })

      await prisma.user.update({
        where: { id: user.id },
        data: {
          shopifyCustomerId: String(customer.id),
          shopifyEmail: customer.email,
        },
      })
    } catch (shopifyErr) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
      throw shopifyErr
    } finally {
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {})
    }

    // 自动登录：写 session cookie
    const now = Math.floor(Date.now() / 1000)
    const exp = now + SESSION_DAYS * 24 * 3600
    const token = signSession({ sub: user.id, email, iat: now, exp })

    const res = NextResponse.json({ message: '注册成功', userId: user.id }, { status: 200 })
    res.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 24 * 3600,
    })
    return res
  } catch (err) {
    console.error('注册验证失败：', err)
    return NextResponse.json(
      { error: '注册失败', detail: String(err) },
      { status: 500 }
    )
  }
}

