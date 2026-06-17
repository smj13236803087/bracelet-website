import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { verifySession } from '@/lib/security'

export async function getSessionUser() {
  const token = cookies().get('session')?.value
  if (!token) return null

  const payload = verifySession(token)
  if (!payload) return null

  return prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      shopifyCustomerId: true,
    },
  })
}

export async function requireSessionUser() {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}
