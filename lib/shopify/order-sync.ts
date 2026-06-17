import { Order, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'
import {
  findShopifyOrderByLocalOrderId,
  isShopifyDraftOrderGid,
} from '@/lib/shopify/find-order'
import { TrackingEvent } from '@/types/order'
import { markOrderPaid, markOrderShipped } from '@/lib/orders/create-order'

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

function buildTrackingEvents(
  order: Order,
  fulfillments: ShopifyFulfillment[]
): TrackingEvent[] {
  const events: TrackingEvent[] = []

  if (order.paidAt) {
    events.push({
      status: 'paid',
      message: '支付成功，等待商家发货',
      happenedAt: order.paidAt.toISOString(),
    })
  }

  for (const fulfillment of fulfillments) {
    const tracking = fulfillment.trackingInfo?.[0]
    if (fulfillment.createdAt) {
      events.push({
        status: 'fulfilled',
        message: tracking?.number
          ? `商家已发货（${tracking.company || '承运商'}：${tracking.number}）`
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
    for (const edge of fulfillment.events?.edges ?? []) {
      events.push({
        status: edge.node.status,
        message: edge.node.message || edge.node.status,
        happenedAt: edge.node.happenedAt,
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

  return events.sort(
    (a, b) => new Date(a.happenedAt).getTime() - new Date(b.happenedAt).getTime()
  )
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

  const data = await shopifyAdminGraphql<{
    order: {
      id: string
      name: string
      displayFulfillmentStatus: string
      fulfillments: ShopifyFulfillment[]
    } | null
  }>(ORDER_TRACKING_QUERY, { id: current.shopifyOrderId })

  const shopifyOrder = data.order
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
  if (!order.shopifyOrderId) {
    return []
  }

  const data = await shopifyAdminGraphql<{
    order: { fulfillments: ShopifyFulfillment[] } | null
  }>(ORDER_TRACKING_QUERY, { id: order.shopifyOrderId })

  const fulfillments = data.order?.fulfillments ?? []
  return buildTrackingEvents(order, fulfillments)
}
