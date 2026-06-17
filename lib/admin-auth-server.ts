import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { verifySession } from '@/lib/security'

export async function getAdminSessionUser() {
  const token = cookies().get('admin_session')?.value
  if (!token) return null

  const payload = verifySession(token)
  if (!payload) return null

  return prisma.user.findFirst({
    where: { id: payload.sub, role: 'SUPER_ADMIN' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })
}

export async function requireAdminSessionUser() {
  const admin = await getAdminSessionUser()
  if (!admin) {
    throw new Error('UNAUTHORIZED')
  }
  return admin
}
