'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import OrderCard from '@/components/orders/OrderCard'
import { OrderSummary, OrderTab } from '@/types/order'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

const TABS: Array<{ key: OrderTab; label: string }> = [
  { key: 'PENDING_PAYMENT', label: '待支付' },
  { key: 'PENDING_SHIPMENT', label: '待发货' },
  { key: 'PENDING_RECEIPT', label: '待收货' },
]

function parseTab(value: string | null): OrderTab {
  if (value === 'PENDING_RECEIPT') return 'PENDING_RECEIPT'
  if (value === 'PENDING_SHIPMENT') return 'PENDING_SHIPMENT'
  return 'PENDING_PAYMENT'
}

function emptyMessage(tab: OrderTab): string {
  switch (tab) {
    case 'PENDING_PAYMENT':
      return '暂无待支付订单'
    case 'PENDING_SHIPMENT':
      return '暂无待发货订单'
    case 'PENDING_RECEIPT':
      return '暂无待收货订单'
  }
}

function OrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get('tab'))

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        setError('')

        const res = await fetch(
          `/api/orders?status=${activeTab}&refresh=${refresh ? '1' : '0'}`
        )

        if (res.status === 401) {
          router.push('/login')
          return
        }

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || '获取订单失败')
        }

        setOrders(data.orders || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取订单失败')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeTab, router]
  )

  useEffect(() => {
    fetchOrders(false)
  }, [fetchOrders])

  const switchTab = (tab: OrderTab) => {
    router.replace(`/orders?tab=${tab}`)
  }

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">我的订单</h1>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-1 mb-6 grid grid-cols-3 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-md p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-red-600">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center">
            <p className="text-gray-600 mb-4">{emptyMessage(activeTab)}</p>
            {activeTab === 'PENDING_PAYMENT' ? (
              <p className="text-sm text-gray-500 mb-4">
                若已完成支付，请点击右上角「刷新」同步订单状态
              </p>
            ) : null}
            <Link
              href="/workspace"
              className="inline-flex px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              去设计手串
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </main>
      }
    >
      <OrdersContent />
    </Suspense>
  )
}
