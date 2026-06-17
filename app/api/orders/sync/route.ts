import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth-server'
import { refreshOrderFromShopify } from '@/lib/shopify/order-sync'

export const dynamic = 'force-dynamic'

export async function POST() {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id,
      status: {
        in: ['PENDING_PAYMENT', 'PENDING_SHIPMENT', 'PENDING_RECEIPT'],
      },
    },
  })

  await Promise.all(
    orders.map(async (order) => {
      try {
        await refreshOrderFromShopify(order)
      } catch (error) {
        console.error('同步订单失败：', order.id, error)
      }
    })
  )

  return NextResponse.json({
    ok: true,
    synced: orders.length,
  })
}
