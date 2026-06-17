import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth-server'
import { toOrderDetail } from '@/lib/orders/order-utils'
import {
  fetchShopifyTrackingSnapshot,
  refreshOrderFromShopify,
} from '@/lib/shopify/order-sync'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  let order = await prisma.order.findFirst({
    where: { id: params.id, userId: user.id },
  })

  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }

  const refresh = req.nextUrl.searchParams.get('refresh') !== '0'

  if (refresh) {
    try {
      order = await refreshOrderFromShopify(order)
    } catch (error) {
      console.error('刷新订单详情失败：', order.id, error)
    }
  }

  if (
    order.shopifyOrderId &&
    (order.status === 'PENDING_RECEIPT' || order.status === 'COMPLETED')
  ) {
    try {
      const snapshot = await fetchShopifyTrackingSnapshot(order)
      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          carrier: snapshot.carrier ?? order.carrier,
          trackingNumber: snapshot.trackingNumber ?? order.trackingNumber,
          trackingUrl: snapshot.trackingUrl ?? order.trackingUrl,
          trackingEvents: snapshot.trackingEvents as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      console.error('拉取物流轨迹失败：', order.id, error)
    }
  }

  return NextResponse.json({ order: toOrderDetail(order) })
}
