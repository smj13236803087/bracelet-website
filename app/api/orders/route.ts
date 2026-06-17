import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth-server'
import { toOrderSummary } from '@/lib/orders/order-utils'
import { refreshOrderFromShopify } from '@/lib/shopify/order-sync'
import { Order, OrderStatus } from '@prisma/client'
import { tabToOrderStatus } from '@/types/order'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'PENDING_RECEIPT',
]

export async function GET(req: NextRequest) {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const statusParam = req.nextUrl.searchParams.get('status')
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'

  if (
    !statusParam ||
    !VALID_STATUSES.includes(statusParam as OrderStatus)
  ) {
    return NextResponse.json({ error: '无效的订单状态' }, { status: 400 })
  }

  const status = tabToOrderStatus(
    statusParam as 'PENDING_PAYMENT' | 'PENDING_SHIPMENT' | 'PENDING_RECEIPT'
  )

  const syncOrder = async (order: Order) => {
    try {
      return await refreshOrderFromShopify(order)
    } catch (error) {
      console.error('刷新订单失败：', order.id, error)
      return order
    }
  }

  if (refresh) {
    const pendingOrders = await prisma.order.findMany({
      where: { userId: user.id, status: 'PENDING_PAYMENT' },
    })
    await Promise.all(
      pendingOrders.map(async (order) => syncOrder(order))
    )
  }

  let orders = await prisma.order.findMany({
    where: { userId: user.id, status },
    orderBy: { createdAt: 'desc' },
  })

  if (refresh) {
    orders = await Promise.all(orders.map((order) => syncOrder(order)))
  }

  return NextResponse.json({
    orders: orders.map(toOrderSummary),
  })
}
