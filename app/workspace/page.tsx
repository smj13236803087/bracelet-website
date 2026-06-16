'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BraceletItem, BeadCategory, AccessoryCategory } from '@/types/bracelet'
import { calculateTotalPrice, generateId } from '@/lib/pricing/calculator'
import ConfigPanel from '@/components/workspace/ConfigPanel'
import BraceletPreview from '@/components/workspace/BraceletPreview'
import PriceDisplay from '@/components/workspace/PriceDisplay'
import WristSizeModal, { WearingStyle } from '@/components/workspace/WristSizeModal'

export default function Workspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const designIdFromUrl = searchParams.get('designId')

  const [items, setItems] = useState<BraceletItem[]>([])
  const [showWristSizeModal, setShowWristSizeModal] = useState(true)
  const [wristSize, setWristSize] = useState<number | null>(null)
  const [wearingStyle, setWearingStyle] = useState<WearingStyle | null>(null)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [designName, setDesignName] = useState('')
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null)

  // 如果带着 designId 进来，则加载已有作品继续编辑
  useEffect(() => {
    const id = designIdFromUrl
    if (!id) return

    async function loadDesign() {
      try {
        const res = await fetch(`/api/designs/${id}`)
        if (!res.ok) return
        const data = await res.json()
        const d = data.design
        if (!d) return
        setItems(d.items || [])
        setWristSize(d.wristSize ?? null)
        setWearingStyle((d.wearingStyle as WearingStyle | null) ?? null)
        setShowWristSizeModal(!d.wristSize || !d.wearingStyle)
        setDesignName(d.name || '')
        setCurrentDesignId(d.id)
      } catch (e) {
        console.error('加载作品失败：', e)
      }
    }

    loadDesign()
  }, [designIdFromUrl])

  // 计算总价
  const totalPrice = useMemo(() => calculateTotalPrice(items), [items])

  // 检查是否超过手围限制
  const checkWristSizeLimit = (newDiameter: number): boolean => {
    if (!wristSize || !wearingStyle) return true // 如果未设置手围，允许添加
    
    const maxCircumference = wearingStyle === 'single' ? wristSize * 1.1 : wristSize * 2.2
    const defaultDiameter = 8
    const currentTotalDiameterMm = items.reduce((sum, item) => {
      return sum + (item.diameter || defaultDiameter)
    }, 0)
    const newTotalDiameterMm = currentTotalDiameterMm + (newDiameter || defaultDiameter)
    const newCircumference = newTotalDiameterMm / 10 // 毫米转厘米
    
    return newCircumference <= maxCircumference
  }

  // 添加珠子
  const handleAddBead = (
    category: BeadCategory,
    subType: string,
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => {
    if (!checkWristSizeLimit(diameter || 8)) {
      alert(`已达到设定手围！无法添加更多珠子。`)
      return
    }
    
    const newItem: BraceletItem = {
      id: generateId(),
      type: 'bead',
      beadCategory: category,
      beadSubType: subType,
      name: name,
      price: price,
      color: color,
      image: image,
      diameter: diameter,
      weight: weight,
      shopifyVariantId,
    }
    setItems([...items, newItem])
  }

  // 添加配饰
  const handleAddAccessory = (
    category: AccessoryCategory,
    subType: string,
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => {
    if (!checkWristSizeLimit(diameter || 8)) {
      alert(`已达到设定手围！无法添加更多配饰。`)
      return
    }
    
    const newItem: BraceletItem = {
      id: generateId(),
      type: 'accessory',
      accessoryCategory: category,
      accessorySubType: subType,
      name: name,
      price: price,
      color: color,
      image: image,
      diameter: diameter,
      weight: weight,
      shopifyVariantId,
    }
    setItems([...items, newItem])
  }

  // 添加吊坠
  const handleAddPendant = (
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => {
    if (!checkWristSizeLimit(diameter || 8)) {
      alert(`已达到设定手围！无法添加更多吊坠。`)
      return
    }
    
    const newItem: BraceletItem = {
      id: generateId(),
      type: 'pendant',
      pendantType: 'pendant',
      name: name,
      price: price,
      color: color,
      image: image,
      diameter: diameter,
      weight: weight,
      shopifyVariantId,
    }
    setItems([...items, newItem])
  }

  // 删除项目
  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  // 重新排序
  const handleReorderItems = (newItems: BraceletItem[]) => {
    setItems(newItems)
  }

  const handleAddToCart = async () => {
    if (!items.length) {
      alert('请先设计手串再支付～')
      return
    }
    if (!wristSize || !wearingStyle) {
      alert('请先完成手腕尺寸设置～')
      setShowWristSizeModal(true)
      return
    }

    setPaying(true)
    try {
      const res = await fetch('/api/shopify/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          totalPrice,
          wristSize,
          wearingStyle,
          designName: designName.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '创建支付链接失败，请稍后重试')
        return
      }

      if (!data.checkoutUrl) {
        alert('未获取到支付链接，请稍后重试')
        return
      }

      window.location.href = data.checkoutUrl
    } catch (e) {
      console.error('立即支付失败：', e)
      alert('支付跳转失败，请检查网络后重试')
    } finally {
      setPaying(false)
    }
  }

  // 计算总重量 / 平均直径，方便存数据库
  const summary = useMemo(() => {
    if (!items.length) {
      return { totalWeight: 0, averageDiameter: null as number | null }
    }
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0)
    const diameters = items.map((i) => i.diameter).filter((d): d is number => !!d)
    const averageDiameter =
      diameters.length > 0
        ? diameters.reduce((a, b) => a + b, 0) / diameters.length
        : null
    return { totalWeight, averageDiameter }
  }, [items])

  // 保存到作品集
  const handleSaveDesign = async () => {
    if (!items.length) {
      alert('请先设计手串再保存～')
      return
    }
    if (!wristSize || !wearingStyle) {
      alert('请先完成手腕尺寸设置～')
      setShowWristSizeModal(true)
      return
    }
    const trimmed = designName.trim()
    if (!trimmed) {
      alert('请先输入作品名称')
      return
    }
    const name = trimmed

    setDesignName(name)
    setSaving(true)
    try {
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentDesignId ?? undefined,
          name,
          items,
          totalPrice,
          totalWeight: summary.totalWeight,
          averageDiameter: summary.averageDiameter,
          wristSize,
          wearingStyle,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '保存失败，请稍后重试')
        return
      }

      setCurrentDesignId(data.design.id)
      router.push('/portfolio')
    } catch (e) {
      console.error('保存设计失败：', e)
      alert('保存失败，请检查网络后重试')
    } finally {
      setSaving(false)
    }
  }

  // 完成手腕尺寸设置
  const handleWristSizeComplete = (size: number, style: WearingStyle) => {
    setWristSize(size)
    setWearingStyle(style)
    setShowWristSizeModal(false)
  }

  return (
    <main className="pt-16 min-h-screen bg-gray-50">
      <WristSizeModal
        isOpen={showWristSizeModal}
        onComplete={handleWristSizeComplete}
      />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">工作台</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧：配置面板 */}
          <div className="lg:col-span-4">
            <ConfigPanel
              onAddBead={handleAddBead}
              onAddAccessory={handleAddAccessory}
              onAddPendant={handleAddPendant}
            />
          </div>

          {/* 中间：手串预览 */}
          <div className="lg:col-span-5">
            <BraceletPreview
              items={items}
              onRemoveItem={handleRemoveItem}
              onReorderItems={handleReorderItems}
              wristSize={wristSize}
              wearingStyle={wearingStyle}
            />
          </div>

          {/* 右侧：价格显示 + 保存 */}
          <div className="lg:col-span-3">
            <PriceDisplay
              items={items}
              totalPrice={totalPrice}
              onAddToCart={handleAddToCart}
              wristSize={wristSize}
              wearingStyle={wearingStyle}
              paying={paying}
            />
            <div className="mt-4 space-y-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  作品名称
                </label>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="给你的作品起个名字吧"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                />
              </div>
              <button
                onClick={handleSaveDesign}
                disabled={items.length === 0 || saving}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
              >
                {saving ? '保存中...' : '保存到我的作品集'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
