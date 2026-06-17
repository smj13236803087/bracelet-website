import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ errno: 0, errmsg: '', data: null }, { status: 200 })
  res.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
