import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { findLocalOrderIdFromShopifyPayload } from '@/lib/orders/order-utils'
import { markOrderPaid } from '@/lib/orders/create-order'
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
  }

  const localOrderId = findLocalOrderIdFromShopifyPayload(payload)
  const shopifyOrderId = toShopifyOrderGid(payload.id)

  if (localOrderId) {
    const existing = await prisma.order.findUnique({ where: { id: localOrderId } })
    if (existing) {
      await markOrderPaid(existing.id, shopifyOrderId, payload.name)
      return NextResponse.json({ ok: true })
    }
  }

  const fallback = await prisma.order.findFirst({
    where: { shopifyOrderName: payload.name },
  })
  if (fallback) {
    await markOrderPaid(fallback.id, shopifyOrderId, payload.name)
  }

  return NextResponse.json({ ok: true })
}
