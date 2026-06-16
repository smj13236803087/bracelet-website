import { BraceletItem } from '@/types/bracelet'
import { WearingStyle } from '@/components/workspace/WristSizeModal'
import {
  shopifyStorefrontGraphql,
  toVariantGid,
} from './storefront-client'
import { CreateBraceletCheckoutInput, BraceletCheckoutResult } from './draft-order'

const CART_CREATE = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`

function wearingStyleLabel(style: WearingStyle): string {
  return style === 'single' ? '单圈' : '双圈'
}

function buildDesignSnapshot(input: CreateBraceletCheckoutInput): string {
  return JSON.stringify({
    designName: input.designName?.trim() || null,
    wristSize: input.wristSize,
    wearingStyle: input.wearingStyle,
    totalPrice: input.totalPrice,
    items: input.items.map((item) => ({
      name: item.name,
      type: item.type,
      price: item.price,
      shopifyVariantId: item.shopifyVariantId ?? null,
      diameter: item.diameter ?? null,
      weight: item.weight ?? null,
    })),
  })
}

function groupCartLines(
  items: BraceletItem[]
): Array<{ merchandiseId: string; quantity: number }> {
  const counts = new Map<number, number>()

  for (const item of items) {
    if (!item.shopifyVariantId) {
      throw new Error(
        '部分材料缺少 Shopify 变体信息，请重新从商品列表添加后再支付'
      )
    }
    const id = item.shopifyVariantId
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([variantId, quantity]) => ({
    merchandiseId: toVariantGid(variantId),
    quantity,
  }))
}

export async function createBraceletStorefrontCheckout(
  input: CreateBraceletCheckoutInput
): Promise<BraceletCheckoutResult> {
  const lines = groupCartLines(input.items)

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'source', value: 'bracelet-website' },
    { key: 'wrist_size_cm', value: String(input.wristSize) },
    { key: 'wearing_style', value: input.wearingStyle },
    {
      key: 'wearing_style_label',
      value: wearingStyleLabel(input.wearingStyle),
    },
    { key: 'design_json', value: buildDesignSnapshot(input) },
  ]

  if (input.designName?.trim()) {
    attributes.push({ key: 'design_name', value: input.designName.trim() })
  }

  const data = await shopifyStorefrontGraphql<{
    cartCreate: {
      cart: { id: string; checkoutUrl: string } | null
      userErrors: Array<{ field: string[] | null; message: string }>
    }
  }>(CART_CREATE, {
    input: { lines, attributes },
  })

  const result = data.cartCreate
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '))
  }

  const cart = result.cart
  if (!cart?.checkoutUrl) {
    throw new Error('创建购物车失败，未返回支付链接')
  }

  return {
    draftOrderId: cart.id,
    draftOrderName: 'Storefront Cart',
    checkoutUrl: cart.checkoutUrl,
  }
}
