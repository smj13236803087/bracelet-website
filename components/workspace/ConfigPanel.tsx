'use client'

import { useState, useEffect } from 'react'
import { BeadCategory, AccessoryCategory } from '@/types/bracelet'
import { ArrowLeft } from 'lucide-react'
import {
  ShopifyProduct,
  categorizeProducts,
  getProductImage,
  getProductPrice,
  getProductDiameter,
  getProductWeight,
  parseDiameter,
  parseWeight,
} from '@/lib/shopify/product-mapper'

interface ConfigPanelProps {
  onAddBead: (
    category: BeadCategory,
    subType: string,
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => void
  onAddAccessory: (
    category: AccessoryCategory,
    subType: string,
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => void
  onAddPendant: (
    name: string,
    price: number,
    color: string,
    image?: string,
    diameter?: number,
    weight?: number,
    shopifyVariantId?: number
  ) => void
}

type SelectionStep = 'category' | 'product'

export default function ConfigPanel({
  onAddBead,
  onAddAccessory,
  onAddPendant,
}: ConfigPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categorizedProducts, setCategorizedProducts] = useState<
    ReturnType<typeof categorizeProducts> | null
  >(null)

  // 珠子选择状态
  const [beadStep, setBeadStep] = useState<SelectionStep>('category')
  const [selectedBeadCategory, setSelectedBeadCategory] = useState<
    BeadCategory | null
  >(null)

  // 配饰选择状态
  const [accessoryStep, setAccessoryStep] = useState<SelectionStep>('category')
  const [selectedAccessoryCategory, setSelectedAccessoryCategory] = useState<
    AccessoryCategory | null
  >(null)

  // 从 Shopify 拉取商品
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const res = await fetch('/api/shopify/products')
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '拉取商品失败')
        }
        const data = await res.json()
        const categorized = categorizeProducts(data.products)
        setCategorizedProducts(categorized)
      } catch (err) {
        console.error('拉取商品失败：', err)
        setError(err instanceof Error ? err.message : '拉取商品失败')
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  // 重置珠子选择流程
  const resetBeadSelection = () => {
    setBeadStep('category')
    setSelectedBeadCategory(null)
  }

  // 重置配饰选择流程
  const resetAccessorySelection = () => {
    setAccessoryStep('category')
    setSelectedAccessoryCategory(null)
  }

  // 珠子选择处理
  const handleSelectBeadCategory = (category: BeadCategory) => {
    setSelectedBeadCategory(category)
    setBeadStep('product')
  }

  const handleSelectBeadProduct = (product: ShopifyProduct) => {
    if (!selectedBeadCategory) return

    const price = getProductPrice(product)
    const image = getProductImage(product)
    // 使用商品标题作为子类型名称
    const subType = product.title
    const diameterStr = getProductDiameter(product)
    const weightStr = getProductWeight(product)
    const diameter = diameterStr ? parseDiameter(diameterStr) : undefined
    const weight = weightStr ? parseWeight(weightStr) : undefined
    const shopifyVariantId = product.variants?.[0]?.id

    onAddBead(
      selectedBeadCategory,
      subType,
      product.title,
      price,
      '#8b4513', // 默认颜色，可以从商品图片提取或使用占位色
      image,
      diameter,
      weight,
      shopifyVariantId
    )
    resetBeadSelection()
  }

  // 配饰选择处理
  const handleSelectAccessoryCategory = (category: AccessoryCategory) => {
    setSelectedAccessoryCategory(category)
    setAccessoryStep('product')
  }

  const handleSelectAccessoryProduct = (product: ShopifyProduct) => {
    if (!selectedAccessoryCategory) return

    const price = getProductPrice(product)
    const image = getProductImage(product)
    const subType = product.title
    const diameterStr = getProductDiameter(product)
    const weightStr = getProductWeight(product)
    const diameter = diameterStr ? parseDiameter(diameterStr) : undefined
    const weight = weightStr ? parseWeight(weightStr) : undefined
    const shopifyVariantId = product.variants?.[0]?.id

    onAddAccessory(
      selectedAccessoryCategory,
      subType,
      product.title,
      price,
      '#8b4513',
      image,
      diameter,
      weight,
      shopifyVariantId
    )
    resetAccessorySelection()
  }

  // 吊坠选择处理
  const handleSelectPendantProduct = (product: ShopifyProduct) => {
    const price = getProductPrice(product)
    const image = getProductImage(product)
    const diameterStr = getProductDiameter(product)
    const weightStr = getProductWeight(product)
    const diameter = diameterStr ? parseDiameter(diameterStr) : undefined
    const weight = weightStr ? parseWeight(weightStr) : undefined
    const shopifyVariantId = product.variants?.[0]?.id

    onAddPendant(product.title, price, '#8b4513', image, diameter, weight, shopifyVariantId)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">正在加载商品...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <p className="text-red-500">加载失败：{error}</p>
        </div>
      </div>
    )
  }

  if (!categorizedProducts) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">暂无商品数据</p>
        </div>
      </div>
    )
  }

  // 珠子分类映射
  const beadCategories: Record<BeadCategory, keyof typeof categorizedProducts> =
    {
      obsidian: 'obsidian',
      amethyst: 'amethyst',
      moonstone: 'moonshine',
    }

  // 配饰分类映射
  const accessoryCategories: Record<
    AccessoryCategory,
    keyof typeof categorizedProducts
  > = {
    spacer: 'cutoff',
    decoration: 'running-laps',
    doubleTerminated: 'double-pointed-crystal',
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* 珠子 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">珠子</h3>
          {beadStep !== 'category' && (
            <button
              onClick={resetBeadSelection}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={16} />
              <span>返回</span>
            </button>
          )}
        </div>

        {beadStep === 'category' && (
          <div className="grid grid-cols-3 gap-4">
            {(['obsidian', 'amethyst', 'moonstone'] as BeadCategory[]).map(
              (category) => {
                const categoryKey = beadCategories[category]
                const categoryData = categorizedProducts[categoryKey]
                if (!categoryData || categoryData.products.length === 0) {
                  return null
                }
                return (
                  <button
                    key={category}
                    onClick={() => handleSelectBeadCategory(category)}
                    className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-full mb-2 shadow-md group-hover:scale-110 transition-transform bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center overflow-hidden">
                      {categoryData.products[0] && (
                        <img
                          src={getProductImage(categoryData.products[0])}
                          alt={categoryData.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 如果图片加载失败，隐藏 img，显示占位背景
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {categoryData.name}
                    </span>
                  </button>
                )
              }
            )}
          </div>
        )}

        {beadStep === 'product' && selectedBeadCategory && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              选择{' '}
              {
                categorizedProducts[beadCategories[selectedBeadCategory]]
                  .name
              }
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categorizedProducts[
                beadCategories[selectedBeadCategory]
              ].products.map((product) => {
                const diameter = getProductDiameter(product)
                const weight = getProductWeight(product)
                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelectBeadProduct(product)}
                    className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-20 h-20 rounded-lg mb-2 shadow-md group-hover:scale-110 transition-transform overflow-hidden bg-gray-100">
                      <img
                        src={getProductImage(product)}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 图片加载失败时显示占位背景
                          const target = e.target as HTMLImageElement
                          target.src = '/placeholder-product.svg'
                          target.onerror = null // 防止无限循环
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center">
                      {product.title}
                    </span>
                    {(diameter || weight) && (
                      <div className="text-xs text-gray-500 text-center mt-0.5">
                        {diameter && <span>{diameter}</span>}
                        {diameter && weight && <span className="mx-1">·</span>}
                        {weight && <span>{weight}</span>}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 mt-0.5">
                      ¥{getProductPrice(product)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 配饰 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">配饰</h3>
          {accessoryStep !== 'category' && (
            <button
              onClick={resetAccessorySelection}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={16} />
              <span>返回</span>
            </button>
          )}
        </div>

        {accessoryStep === 'category' && (
          <div className="grid grid-cols-3 gap-4">
            {(
              ['spacer', 'decoration', 'doubleTerminated'] as AccessoryCategory[]
            ).map((category) => {
              const categoryKey = accessoryCategories[category]
              const categoryData = categorizedProducts[categoryKey]
              if (!categoryData || categoryData.products.length === 0) {
                return null
              }
              return (
                <button
                  key={category}
                  onClick={() => handleSelectAccessoryCategory(category)}
                  className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full mb-2 shadow-md group-hover:scale-110 transition-transform bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center overflow-hidden">
                    {categoryData.products[0] && (
                      <img
                        src={getProductImage(categoryData.products[0])}
                        alt={categoryData.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {categoryData.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {accessoryStep === 'product' && selectedAccessoryCategory && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              选择{' '}
              {
                categorizedProducts[
                  accessoryCategories[selectedAccessoryCategory]
                ].name
              }
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categorizedProducts[
                accessoryCategories[selectedAccessoryCategory]
              ].products.map((product) => {
                const diameter = getProductDiameter(product)
                const weight = getProductWeight(product)
                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelectAccessoryProduct(product)}
                    className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-20 h-20 rounded-lg mb-2 shadow-md group-hover:scale-110 transition-transform overflow-hidden bg-gray-100">
                      <img
                        src={getProductImage(product)}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = '/placeholder-product.svg'
                          target.onerror = null
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center">
                      {product.title}
                    </span>
                    {(diameter || weight) && (
                      <div className="text-xs text-gray-500 text-center mt-0.5">
                        {diameter && <span>{diameter}</span>}
                        {diameter && weight && <span className="mx-1">·</span>}
                        {weight && <span>{weight}</span>}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 mt-0.5">
                      ¥{getProductPrice(product)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 吊坠 */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">吊坠</h3>
        {categorizedProducts.pendant.products.length === 0 ? (
          <p className="text-sm text-gray-500">暂无吊坠商品</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categorizedProducts.pendant.products.map((product) => {
              const diameter = getProductDiameter(product)
              const weight = getProductWeight(product)
              return (
                <button
                  key={product.id}
                  onClick={() => handleSelectPendantProduct(product)}
                  className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-20 h-20 rounded-lg mb-2 shadow-md group-hover:scale-110 transition-transform overflow-hidden bg-gray-100">
                    <img
                      src={getProductImage(product)}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder-product.svg'
                        target.onerror = null
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">
                    {product.title}
                  </span>
                  {(diameter || weight) && (
                    <div className="text-xs text-gray-500 text-center mt-0.5">
                      {diameter && <span>{diameter}</span>}
                      {diameter && weight && <span className="mx-1">·</span>}
                      {weight && <span>{weight}</span>}
                    </div>
                  )}
                  <span className="text-xs text-gray-500 mt-0.5">
                    ¥{getProductPrice(product)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
