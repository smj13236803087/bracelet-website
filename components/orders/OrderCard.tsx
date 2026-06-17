'use client'

import Link from 'next/link'
import { OrderSummary, orderStatusLabel } from '@/types/order'
import { CreditCard, Package, ChevronRight } from 'lucide-react'

interface OrderCardProps {
  order: OrderSummary
}

function statusBadgeClass(status: OrderSummary['status']) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'bg-orange-100 text-orange-700'
    case 'PENDING_SHIPMENT':
      return 'bg-amber-100 text-amber-700'
    case 'PENDING_RECEIPT':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function OrderCard({ order }: OrderCardProps) {
  const title = order.designName || order.previewItemName || '定制手串'

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 mb-1">订单号 {order.orderNo}</div>
          <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(order.status)}`}
        >
          {orderStatusLabel(order.status)}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
          <Package className="w-6 h-6 text-blue-600" />
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>{order.itemCount} 件材料</p>
          {order.wristSize && (
            <p>
              手围 {order.wristSize} cm
              {order.wearingStyle === 'double' ? ' · 双圈' : ' · 单圈'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500">订单金额</div>
          <div className="text-xl font-bold text-blue-600">¥{order.totalPrice}</div>
        </div>
        <div className="flex items-center gap-2">
          {order.status === 'PENDING_PAYMENT' && order.shopifyCheckoutUrl && (
            <a
              href={order.shopifyCheckoutUrl}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
              onClick={(e) => e.stopPropagation()}
            >
              <CreditCard className="w-4 h-4" />
              继续支付
            </a>
          )}
          <Link
            href={`/orders/${order.id}`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            查看详情
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
