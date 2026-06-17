'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { OrderDetail, orderStatusLabel } from '@/types/order'
import BraceletPreview from '@/components/workspace/BraceletPreview'
import type { WearingStyle } from '@/components/workspace/WristSizeModal'
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true)
        const res = await fetch(`/api/orders/${orderId}?refresh=1`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || '获取订单详情失败')
        }
        setOrder(data.order)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取订单详情失败')
      } finally {
        setLoading(false)
      }
    }

    if (orderId) loadOrder()
  }, [orderId, router])

  if (loading) {
    return (
      <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-red-600">
            {error || '订单不存在'}
          </div>
        </div>
      </main>
    )
  }

  const title = order.designName || order.previewItemName || '定制手串'
  const backTab =
    order.status === 'PENDING_RECEIPT'
      ? 'PENDING_RECEIPT'
      : order.status === 'PENDING_PAYMENT'
        ? 'PENDING_PAYMENT'
        : 'PENDING_SHIPMENT'

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/orders?tab=${backTab}`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            返回订单列表
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">订单号 {order.orderNo}</div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {order.shopifyOrderName && (
                <p className="text-sm text-gray-500 mt-1">
                  Shopify 订单 {order.shopifyOrderName}
                </p>
              )}
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
              {orderStatusLabel(order.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-gray-500 mb-1">订单金额</div>
              <div className="text-xl font-bold text-blue-600">¥{order.totalPrice}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-gray-500 mb-1">材料数量</div>
              <div className="text-xl font-bold text-gray-900">{order.itemCount} 件</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">设计预览</h2>
          <BraceletPreview
            items={order.items}
            onRemoveItem={() => {}}
            onReorderItems={() => {}}
            wristSize={order.wristSize}
            wearingStyle={order.wearingStyle as WearingStyle | null}
            hideTips
          />
        </div>

        {order.status === 'PENDING_RECEIPT' && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">物流轨迹</h2>
            </div>

            {(order.carrier || order.trackingNumber) && (
              <div className="p-4 bg-blue-50 rounded-xl mb-4 text-sm text-gray-700 space-y-1">
                {order.carrier && <p>承运商：{order.carrier}</p>}
                {order.trackingNumber && <p>运单号：{order.trackingNumber}</p>}
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 mt-2"
                  >
                    前往承运商查询
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {order.trackingEvents.length > 0 ? (
              <div className="space-y-4">
                {[...order.trackingEvents].reverse().map((event, index, list) => (
                  <div key={`${event.happenedAt}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                      {index < list.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-medium text-gray-900">
                        {event.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(event.happenedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                暂无详细轨迹，请稍后刷新或前往承运商官网查询
              </div>
            )}
          </div>
        )}

        {order.status === 'PENDING_PAYMENT' && order.shopifyCheckoutUrl && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">订单尚未完成支付</p>
                <p className="text-xs text-gray-500">
                  若已在 Shopify 完成支付，返回列表点击「刷新」同步状态
                </p>
              </div>
              <a
                href={order.shopifyCheckoutUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600"
              >
                <CreditCard className="w-4 h-4" />
                继续支付
              </a>
            </div>
          </div>
        )}

        {order.status === 'PENDING_SHIPMENT' && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center gap-2 text-amber-700">
              <Package className="w-5 h-5" />
              <p className="text-sm">商家正在准备发货，请耐心等待</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
