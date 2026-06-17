import { Order, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'
import {
  findShopifyOrderByLocalOrderId,
  isShopifyDraftOrderGid,
} from '@/lib/shopify/find-order'
import { TrackingEvent } from '@/types/order'
import { markOrderPaid, markOrderShipped } from '@/lib/orders/create-order'
import { toShopifyOrderGid } from '@/lib/shopify/webhook'

const FULFILLMENT_EVENT_STATUS_LABELS: Record<string, string> = {
  ATTEMPTED_DELIVERY: '尝试派送',
  CARRIER_PICKED_UP: '承运商已揽收',
  CONFIRMED: '发货已确认',
  DELAYED: '物流延迟',
  DELIVERED: '包裹已送达',
  FAILURE: '物流异常',
  IN_TRANSIT: '运输中',
  LABEL_PRINTED: '面单已打印',
  LABEL_PURCHASED: '面单已购买',
  OUT_FOR_DELIVERY: '派送中',
  READY_FOR_PICKUP: '待取件',
}

export type ShopifyTrackingSnapshot = {
  trackingEvents: TrackingEvent[]
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
}

const DRAFT_ORDER_QUERY = `
  query draftOrderStatus($id: ID!) {
    draftOrder(id: $id) {
      id
      status
      order {
        id
        name
        displayFulfillmentStatus
      }
    }
  }
`

const ORDER_TRACKING_QUERY = `
  query orderTracking($id: ID!) {
    order(id: $id) {
      id
      name
      displayFulfillmentStatus
      fulfillments {
        displayStatus
        status
        createdAt
        deliveredAt
        inTransitAt
        estimatedDeliveryAt
        trackingInfo {
          company
          number
          url
        }
        events(first: 20) {
          edges {
            node {
              status
              happenedAt
              message
            }
          }
        }
      }
    }
  }
`

type ShopifyFulfillment = {
  displayStatus: string | null
  status: string
  createdAt: string
  deliveredAt: string | null
  inTransitAt: string | null
  estimatedDeliveryAt: string | null
  trackingInfo: Array<{
    company: string | null
    number: string | null
    url: string | null
  }>
  events: {
    edges: Array<{
      node: {
        status: string
        happenedAt: string
        message: string | null
      }
    }>
  }
}

function formatFulfillmentEventMessage(
  status: string,
  message: string | null | undefined
): string {
  if (message?.trim()) return message.trim()
  return FULFILLMENT_EVENT_STATUS_LABELS[status] || status
}

function dedupeTrackingEvents(events: TrackingEvent[]): TrackingEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    const key = `${event.status}|${event.message}|${event.happenedAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractTrackingInfo(fulfillments: ShopifyFulfillment[]) {
  for (const fulfillment of fulfillments) {
    const tracking = fulfillment.trackingInfo?.find(
      (item) => item?.number || item?.company || item?.url
    )
    if (tracking) {
      return {
        carrier: tracking.company?.trim() || null,
        trackingNumber: tracking.number?.trim() || null,
        trackingUrl: tracking.url?.trim() || null,
      }
    }
  }
  return { carrier: null, trackingNumber: null, trackingUrl: null }
}

function buildTrackingEvents(
  order: Order,
  fulfillments: ShopifyFulfillment[]
): TrackingEvent[] {
  const events: TrackingEvent[] = []
  const hasShopifyEvents = fulfillments.some(
    (fulfillment) => (fulfillment.events?.edges?.length ?? 0) > 0
  )

  if (order.paidAt) {
    events.push({
      status: 'paid',
      message: '支付成功，等待商家发货',
      happenedAt: order.paidAt.toISOString(),
    })
  }

  for (const fulfillment of fulfillments) {
    const tracking = fulfillment.trackingInfo?.[0]

    for (const edge of fulfillment.events?.edges ?? []) {
      events.push({
        status: edge.node.status,
        message: formatFulfillmentEventMessage(
          edge.node.status,
          edge.node.message
        ),
        happenedAt: edge.node.happenedAt,
      })
    }

    if (!hasShopifyEvents && fulfillment.createdAt) {
      events.push({
        status: 'fulfilled',
        message: tracking?.number
          ? `商家已发货（${tracking.company || order.carrier || '承运商'}：${tracking.number}）`
          : '商家已发货',
        happenedAt: fulfillment.createdAt,
      })
    }

    if (fulfillment.inTransitAt) {
      events.push({
        status: 'in_transit',
        message: '包裹运输中',
        happenedAt: fulfillment.inTransitAt,
      })
    }

    if (fulfillment.deliveredAt) {
      events.push({
        status: 'delivered',
        message: '包裹已送达',
        happenedAt: fulfillment.deliveredAt,
      })
    }
  }

  return dedupeTrackingEvents(events).sort(
    (a, b) => new Date(a.happenedAt).getTime() - new Date(b.happenedAt).getTime()
  )
}

async function queryShopifyFulfillments(shopifyOrderId: string) {
  const data = await shopifyAdminGraphql<{
    order: {
      id: string
      name: string
      displayFulfillmentStatus: string
      fulfillments: ShopifyFulfillment[]
    } | null
  }>(ORDER_TRACKING_QUERY, { id: toShopifyOrderGid(shopifyOrderId) })

  return data.order
}

export async function fetchShopifyTrackingSnapshot(
  order: Order
): Promise<ShopifyTrackingSnapshot> {
  if (!order.shopifyOrderId) {
    return {
      trackingEvents: [],
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
    }
  }

  const shopifyOrder = await queryShopifyFulfillments(order.shopifyOrderId)
  const fulfillments = shopifyOrder?.fulfillments ?? []
  const trackingInfo = extractTrackingInfo(fulfillments)

  return {
    trackingEvents: buildTrackingEvents(order, fulfillments),
    carrier: trackingInfo.carrier ?? order.carrier,
    trackingNumber: trackingInfo.trackingNumber ?? order.trackingNumber,
    trackingUrl: trackingInfo.trackingUrl ?? order.trackingUrl,
  }
}

export async function refreshOrderFromShopify(order: Order): Promise<Order> {
  let current = order

  if (current.status === 'PENDING_PAYMENT') {
    if (
      isShopifyDraftOrderGid(current.shopifyDraftOrderId) &&
      current.shopifyDraftOrderId
    ) {
      const data = await shopifyAdminGraphql<{
        draftOrder: {
          status: string
          order: { id: string; name: string } | null
        } | null
      }>(DRAFT_ORDER_QUERY, { id: current.shopifyDraftOrderId })

      const shopifyOrder = data.draftOrder?.order
      if (shopifyOrder?.id) {
        current = await markOrderPaid(
          current.id,
          shopifyOrder.id,
          shopifyOrder.name
        )
      }
    }

    if (!current.shopifyOrderId) {
      const matched = await findShopifyOrderByLocalOrderId(current.id)
      if (matched) {
        current = await markOrderPaid(current.id, matched.id, matched.name)
      }
    }
  }

  if (!current.shopifyOrderId) {
    return current
  }

  const shopifyOrder = await queryShopifyFulfillments(current.shopifyOrderId)
  if (!shopifyOrder) return current

  const fulfillments = shopifyOrder.fulfillments ?? []
  if (fulfillments.length === 0) {
    if (current.status === 'PENDING_PAYMENT') {
      return markOrderPaid(current.id, shopifyOrder.id, shopifyOrder.name)
    }
    return current
  }

  const tracking = fulfillments[0]?.trackingInfo?.[0]
  const trackingEvents = buildTrackingEvents(current, fulfillments)
  const isDelivered = fulfillments.some(
    (item) => item.displayStatus === 'DELIVERED' || !!item.deliveredAt
  )

  const shipped = await markOrderShipped(current.id, {
    carrier: tracking?.company ?? null,
    trackingNumber: tracking?.number ?? null,
    trackingUrl: tracking?.url ?? null,
    trackingEvents: trackingEvents as unknown as Prisma.InputJsonValue,
  })

  if (isDelivered) {
    return prisma.order.update({
      where: { id: current.id },
      data: {
        status: 'COMPLETED',
        receivedAt: new Date(),
        trackingEvents: trackingEvents as unknown as Prisma.InputJsonValue,
      },
    })
  }

  return shipped
}

export async function fetchOrderTrackingEvents(
  order: Order
): Promise<TrackingEvent[]> {
  const snapshot = await fetchShopifyTrackingSnapshot(order)
  return snapshot.trackingEvents
}
