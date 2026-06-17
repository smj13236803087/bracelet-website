import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isValidEmail, signSession, verifyPassword } from '@/lib/security'

const SESSION_DAYS = 7

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
  } | null

  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json(
      { errno: 400, errmsg: '邮箱和密码不能为空', data: null },
      { status: 200 }
    )
  }

  const email = body.email.trim().toLowerCase()
  const password = body.password

  if (!email || !isValidEmail(email) || !password) {
    return NextResponse.json(
      { errno: 400, errmsg: '邮箱和密码不能为空', data: null },
      { status: 200 }
    )
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.role !== 'SUPER_ADMIN' || !verifyPassword(password, user.password)) {
    return NextResponse.json(
      { errno: 401, errmsg: '账号或密码错误', data: null },
      { status: 200 }
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + SESSION_DAYS * 24 * 3600
  const token = signSession({ sub: user.id, email: user.email, iat: now, exp })

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
}
