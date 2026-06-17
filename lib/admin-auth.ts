import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/security'
import prisma from '@/lib/prisma'

function getAdminSessionToken(req: NextRequest): string | null {
  return req.cookies.get('admin_session')?.value || null
}

export async function assertAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = getAdminSessionToken(req)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = verifySession(token)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, role: 'SUPER_ADMIN' },
    select: { id: true, role: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
