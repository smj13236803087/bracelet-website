// 珠子大类
export type BeadCategory = 'obsidian' | 'amethyst' | 'moonstone'

// 配饰大类
export type AccessoryCategory = 'spacer' | 'decoration' | 'doubleTerminated'

// 吊坠类型
export type PendantType = 'pendant'

// 手串项目类型
export type BraceletItemType = 'bead' | 'accessory' | 'pendant'

// 手串项目
export interface BraceletItem {
  id: string
  type: BraceletItemType
  // 珠子相关
  beadCategory?: BeadCategory
  beadSubType?: string // 子类型名称，如商品标题
  // 配饰相关
  accessoryCategory?: AccessoryCategory
  accessorySubType?: string // 子类型名称，如商品标题
  // 吊坠相关
  pendantType?: PendantType
  // 显示信息
  name: string // 商品名称
  price: number
  color: string
  image?: string
  // 尺寸信息（毫米）
  diameter?: number // 直径（毫米）
  weight?: number // 重量（克）
  // Shopify 变体 ID（结账用）
  shopifyVariantId?: number
}

// 手串配置
export interface BraceletConfig {
  items: BraceletItem[]
  totalPrice: number
}

// 珠子尺寸配置
export interface BeadSizeConfig {
  size: number // 尺寸（毫米）
  price: number
}

// 珠子子类型配置
export interface BeadSubTypeConfig {
  name: string // 子类型名称，如"冰曜石"
  color: string
  description?: string
  sizes: BeadSizeConfig[] // 不同尺寸的价格
}

// 珠子大类配置
export interface BeadCategoryConfig {
  category: BeadCategory
  name: string // 大类名称，如"曜石"
  subTypes: BeadSubTypeConfig[]
}

// 配饰尺寸配置
export interface AccessorySizeConfig {
  size: number // 尺寸（毫米）
  price: number
}

// 配饰子类型配置
export interface AccessorySubTypeConfig {
  name: string // 子类型名称，如"金片隔珠"
  color: string
  description?: string
  sizes: AccessorySizeConfig[] // 不同尺寸的价格
}

// 配饰大类配置
export interface AccessoryCategoryConfig {
  category: AccessoryCategory
  name: string // 大类名称，如"隔断"
  subTypes: AccessorySubTypeConfig[]
}

// 吊坠配置
export interface PendantConfig {
  type: PendantType
  name: string
  price: number
  color: string
  description?: string
}
