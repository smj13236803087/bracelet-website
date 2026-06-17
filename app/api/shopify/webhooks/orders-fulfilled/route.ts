import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { findLocalOrderIdFromShopifyPayload } from '@/lib/orders/order-utils'
import { markOrderShipped } from '@/lib/orders/create-order'
import { verifyShopifyWebhook, toShopifyOrderGid } from '@/lib/shopify/webhook'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const hmac = req.headers.get('x-shopify-hmac-sha256')

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as {
    id: number
    name: string
    note_attributes?: Array<{ name: string; value: string }>
    fulfillments?: Array<{
      tracking_company?: string | null
      tracking_number?: string | null
      tracking_url?: string | null
    }>
  }

  const tracking = payload.fulfillments?.[0]
  const shopifyOrderId = toShopifyOrderGid(payload.id)
  const localOrderId = findLocalOrderIdFromShopifyPayload(payload)

  let order =
    (localOrderId
      ? await prisma.order.findUnique({ where: { id: localOrderId } })
      : null) ||
    (await prisma.order.findFirst({
      where: {
        OR: [{ shopifyOrderId }, { shopifyOrderName: payload.name }],
      },
    }))

  if (!order) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  await markOrderShipped(order.id, {
    carrier: tracking?.tracking_company ?? null,
    trackingNumber: tracking?.tracking_number ?? null,
    trackingUrl: tracking?.tracking_url ?? null,
    trackingEvents: [
      {
        status: 'fulfilled',
        message: tracking?.tracking_number
          ? `商家已发货（${tracking.tracking_company || '承运商'}：${tracking.tracking_number}）`
          : '商家已发货',
        happenedAt: new Date().toISOString(),
      },
    ] as unknown as Prisma.InputJsonValue,
  })

  return NextResponse.json({ ok: true })
}
