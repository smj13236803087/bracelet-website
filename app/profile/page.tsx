'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  User,
  ShoppingBag,
  LogOut,
  Loader2,
  AlertCircle,
  Sparkles,
  ClipboardList,
} from 'lucide-react'

type User = {
  id: string
  email: string
  name: string | null
  shopifyCustomerId: string | null
}

export default function Profile() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('获取用户信息失败')
      }
      const data = await res.json()
      setUser(data.user)
      if (data.user) {
        fetch('/api/orders/sync', { method: 'POST' }).catch((err) => {
          console.error('同步订单状态失败：', err)
        })
      }
    } catch (err) {
      setError('获取用户信息失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('登出失败：', err)
    }
  }

  if (loading) {
    return (
      <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-12 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !user) {
    return (
      <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <p className="text-red-600 font-semibold">{error || '未登录'}</p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              前往登录
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            个人中心
          </h1>
          <p className="text-gray-600">管理您的账户信息</p>
        </div>

        {/* 用户信息卡片 */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-6 border border-white/20">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {user.name || '用户'}
              </h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <label className="text-sm font-semibold text-gray-700">
                  邮箱地址
                </label>
              </div>
              <p className="text-gray-900 font-medium">{user.email}</p>
            </div>

            {user.name && (
              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <label className="text-sm font-semibold text-gray-700">
                    姓名
                  </label>
                </div>
                <p className="text-gray-900 font-medium">{user.name}</p>
              </div>
            )}

            {user.shopifyCustomerId && (
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <label className="text-sm font-semibold text-gray-700">
                    Shopify 客户 ID
                  </label>
                </div>
                <p className="text-gray-900 font-medium font-mono">
                  {user.shopifyCustomerId}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 功能区 */}
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push('/orders')}
            className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20 flex items-center justify-between hover:shadow-2xl hover:-translate-y-1 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-base font-semibold text-gray-900">
                  我的订单
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  查看待支付、待发货、待收货订单和物流轨迹
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/portfolio')}
            className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20 flex items-center justify-between hover:shadow-2xl hover:-translate-y-1 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-base font-semibold text-gray-900">
                  我的作品集
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  查看和管理你保存的手串设计
                </div>
              </div>
            </div>
          </button>

          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20 flex items-center justify-between">
            <div className="text-left">
              <div className="text-base font-semibold text-gray-900 mb-1">
                账户操作
              </div>
              <div className="text-xs text-gray-500">
                安全退出当前账号，保护你的数据
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
