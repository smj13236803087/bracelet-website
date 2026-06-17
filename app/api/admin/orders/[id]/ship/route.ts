import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'
import { markOrderShipped } from '@/lib/orders/create-order'
import { createShopifyOrderFulfillment } from '@/lib/shopify/order-fulfillment'
import { fetchShopifyTrackingSnapshot } from '@/lib/shopify/order-sync'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as {
    carrier?: unknown
    trackingNumber?: unknown
    notifyCustomer?: unknown
  } | null

  const carrier = String(body?.carrier || '').trim()
  const trackingNumber = String(body?.trackingNumber || '').trim()
  const notifyCustomer = body?.notifyCustomer !== false

  if (!carrier) {
    return NextResponse.json({ error: '请填写快递公司' }, { status: 400 })
  }
  if (!trackingNumber) {
    return NextResponse.json({ error: '请填写快递单号' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }

  if (order.status !== 'PENDING_SHIPMENT') {
    return NextResponse.json(
      { error: '仅待发货订单可以发货' },
      { status: 400 }
    )
  }

  if (!order.shopifyOrderId) {
    return NextResponse.json(
      { error: '订单尚未关联 Shopify 正式订单，无法发货' },
      { status: 400 }
    )
  }

  try {
    await createShopifyOrderFulfillment({
      shopifyOrderId: order.shopifyOrderId,
      carrier,
      trackingNumber,
      notifyCustomer,
    })
  } catch (error) {
    console.error('Shopify 发货失败：', id, error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Shopify 发货失败',
      },
      { status: 502 }
    )
  }

  const updated = await (async () => {
    try {
      const snapshot = await fetchShopifyTrackingSnapshot({
        ...order,
        carrier,
        trackingNumber,
      })
      return markOrderShipped(order.id, {
        carrier: snapshot.carrier ?? carrier,
        trackingNumber: snapshot.trackingNumber ?? trackingNumber,
        trackingUrl: snapshot.trackingUrl,
        trackingEvents: snapshot.trackingEvents as unknown as Prisma.InputJsonValue,
      })
    } catch (error) {
      console.error('发货后拉取 Shopify 物流失败，使用本地数据：', order.id, error)
      return markOrderShipped(order.id, {
        carrier,
        trackingNumber,
        trackingUrl: null,
        trackingEvents: [
          {
            status: 'fulfilled',
            message: `商家已发货（${carrier}：${trackingNumber}）`,
            happenedAt: new Date().toISOString(),
          },
        ],
      })
    }
  })()

  return NextResponse.json({
    ok: true,
    order: {
      id: updated.id,
      status: updated.status,
      carrier: updated.carrier,
      trackingNumber: updated.trackingNumber,
      shippedAt: updated.shippedAt?.toISOString() ?? null,
    },
  })
}
