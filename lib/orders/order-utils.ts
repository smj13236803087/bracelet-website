import { Order, OrderStatus } from '@prisma/client'
import { BraceletItem } from '@/types/bracelet'
import { OrderDetail, OrderSummary, TrackingEvent } from '@/types/order'

export function generateOrderNo(): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `BL${y}${m}${d}${rand}`
}

export function parseOrderItems(items: unknown): BraceletItem[] {
  if (!Array.isArray(items)) return []
  return items as BraceletItem[]
}

export function parseTrackingEvents(value: unknown): TrackingEvent[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is TrackingEvent =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as TrackingEvent).status === 'string' &&
      typeof (item as TrackingEvent).message === 'string' &&
      typeof (item as TrackingEvent).happenedAt === 'string'
  )
}

export function toOrderSummary(order: Order): OrderSummary {
  const items = parseOrderItems(order.items)
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    designName: order.designName,
    totalPrice: order.totalPrice,
    itemCount: items.length,
    previewItemName: items[0]?.name ?? null,
    wristSize: order.wristSize,
    wearingStyle: order.wearingStyle,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    shopifyCheckoutUrl: order.shopifyCheckoutUrl,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  }
}

export function toOrderDetail(order: Order): OrderDetail {
  return {
    ...toOrderSummary(order),
    items: parseOrderItems(order.items),
    trackingUrl: order.trackingUrl,
    trackingEvents: parseTrackingEvents(order.trackingEvents),
    shopifyOrderName: order.shopifyOrderName,
    receivedAt: order.receivedAt?.toISOString() ?? null,
  }
}

export function findLocalOrderIdFromShopifyPayload(payload: {
  note_attributes?: Array<{ name: string; value: string }>
  custom_attributes?: Array<{ key?: string; name?: string; value: string }>
}): string | null {
  const noteAttrs = payload.note_attributes ?? []
  const fromNote = noteAttrs.find((item) => item.name === 'local_order_id')
  if (fromNote?.value) return fromNote.value

  const customAttrs = payload.custom_attributes ?? []
  const fromCustom = customAttrs.find(
    (item) => item.key === 'local_order_id' || item.name === 'local_order_id'
  )
  return fromCustom?.value ?? null
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return (
    status === 'PENDING_PAYMENT' ||
    status === 'PENDING_SHIPMENT' ||
    status === 'PENDING_RECEIPT'
  )
}
