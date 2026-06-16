'use client'

import { BraceletItem } from '@/types/bracelet'
import { CreditCard } from 'lucide-react'
import { WearingStyle } from './WristSizeModal'
import { useMemo } from 'react'

interface PriceDisplayProps {
  items: BraceletItem[]
  totalPrice: number
  onAddToCart: () => void
  wristSize: number | null
  wearingStyle: WearingStyle | null
  paying?: boolean
}

export default function PriceDisplay({
  items,
  totalPrice,
  onAddToCart,
  wristSize,
  wearingStyle,
  paying = false,
}: PriceDisplayProps) {
  // 计算当前周长（厘米）
  const currentCircumference = useMemo(() => {
    const defaultDiameter = 8
    const totalDiameterMm = items.reduce((sum, item) => {
      return sum + (item.diameter || defaultDiameter)
    }, 0)
    return totalDiameterMm / 10 // 毫米转厘米
  }, [items])

  // 计算总重量（克）
  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + (item.weight || 0)
    }, 0)
  }, [items])

  // 计算最大周长
  const maxCircumference = useMemo(() => {
    if (!wristSize || !wearingStyle) return null
    return wearingStyle === 'single' ? wristSize * 1.1 : wristSize * 2.2
  }, [wristSize, wearingStyle])

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-800">设计信息</h3>
      
      {/* 手围和戴法信息 */}
      {wristSize && wearingStyle && (
        <div className="bg-blue-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">手围尺寸：</span>
            <span className="text-sm font-medium text-gray-800">{wristSize} 厘米</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">戴法：</span>
            <span className="text-sm font-medium text-gray-800">
              {wearingStyle === 'single' ? '单圈' : '双圈'}
            </span>
          </div>
          {maxCircumference && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">最大周长：</span>
              <span className="text-sm font-medium text-blue-600">
                {maxCircumference.toFixed(1)} 厘米
              </span>
            </div>
          )}
        </div>
      )}

      {/* 当前设计信息 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">当前周长：</span>
          <span className="text-sm font-medium text-gray-800">
            {currentCircumference.toFixed(1)} 厘米
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">总重量：</span>
          <span className="text-sm font-medium text-gray-800">
            {totalWeight > 0 ? `${totalWeight.toFixed(2)} 克` : '未设置'}
          </span>
        </div>
      </div>
      
      {/* 价格明细 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">材料明细</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: item.color || '#8b4513',
                  }}
                />
                <span className="text-sm text-gray-700">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-gray-800">¥{item.price}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-gray-800">总价格</span>
          <span className="text-2xl font-bold text-blue-600">¥{totalPrice}</span>
        </div>

        <button
          onClick={onAddToCart}
          disabled={items.length === 0 || paying}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <CreditCard size={20} />
          <span>{paying ? '跳转支付中...' : '立即支付'}</span>
        </button>
      </div>
    </div>
  )
}

