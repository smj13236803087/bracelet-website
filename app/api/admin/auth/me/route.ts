import { NextResponse } from 'next/server'
import { getAdminSessionUser } from '@/lib/admin-auth-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAdminSessionUser()
  if (!user) {
    return NextResponse.json(
      { errno: 401, errmsg: '未登录', data: null },
      { status: 200 }
    )
  }

  return NextResponse.json(
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
}
