import { BraceletItem } from './bracelet'

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_SHIPMENT'
  | 'PENDING_RECEIPT'
  | 'COMPLETED'
  | 'CANCELLED'

export type ShopifySyncStatus = 'PENDING' | 'SYNCED' | 'FAILED'

export type OrderTab =
  | 'PENDING_PAYMENT'
  | 'PENDING_SHIPMENT'
  | 'PENDING_RECEIPT'

export interface TrackingEvent {
  status: string
  message: string
  happenedAt: string
}

export interface OrderSummary {
  id: string
  orderNo: string
  status: OrderStatus
  designName: string | null
  totalPrice: number
  itemCount: number
  previewItemName: string | null
  wristSize: number | null
  wearingStyle: string | null
  carrier: string | null
  trackingNumber: string | null
  shopifyCheckoutUrl: string | null
  paidAt: string | null
  shippedAt: string | null
  createdAt: string
}

export interface OrderDetail extends OrderSummary {
  items: BraceletItem[]
  trackingUrl: string | null
  trackingEvents: TrackingEvent[]
  shopifyOrderName: string | null
  receivedAt: string | null
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '待支付'
    case 'PENDING_SHIPMENT':
      return '待发货'
    case 'PENDING_RECEIPT':
      return '待收货'
    case 'COMPLETED':
      return '已完成'
    case 'CANCELLED':
      return '已取消'
  }
}

export function tabToOrderStatus(tab: OrderTab): OrderStatus {
  return tab
}
