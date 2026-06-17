import { BraceletItem } from '@/types/bracelet'
import { WearingStyle } from '@/components/workspace/WristSizeModal'
import { shopifyAdminGraphql } from './admin-client'
import { buildDraftOrderShippingLine } from './shipping-config'
import { toVariantGid } from './storefront-client'

export interface CreateBraceletCheckoutInput {
  items: BraceletItem[]
  totalPrice: number
  wristSize: number
  wearingStyle: WearingStyle
  designName?: string
  localOrderId?: string
  customerEmail?: string
}

export interface BraceletCheckoutResult {
  draftOrderId: string
  draftOrderName: string
  checkoutUrl: string
}

const DRAFT_ORDER_CREATE = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
        status
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

function buildOrderNote(input: CreateBraceletCheckoutInput): string {
  const parts = [
    `手围 ${input.wristSize} cm`,
    wearingStyleLabel(input.wearingStyle),
    `共 ${input.items.length} 件材料`,
    `合计 ¥${input.totalPrice}`,
  ]
  if (input.designName?.trim()) {
    parts.unshift(`作品：${input.designName.trim()}`)
  }
  return parts.join(' · ')
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
      diameter: item.diameter ?? null,
      weight: item.weight ?? null,
    })),
  })
}

export async function createBraceletDraftOrder(
  input: CreateBraceletCheckoutInput
): Promise<BraceletCheckoutResult> {
  const allHaveVariants = input.items.every((item) => item.shopifyVariantId)

  const lineItems = input.items.map((item) => {
    const customAttributes: Array<{ key: string; value: string }> = [
      { key: 'item_type', value: item.type },
    ]
    if (item.diameter != null) {
      customAttributes.push({
        key: 'diameter_mm',
        value: String(item.diameter),
      })
    }
    if (item.weight != null) {
      customAttributes.push({ key: 'weight_g', value: String(item.weight) })
    }

    if (allHaveVariants && item.shopifyVariantId) {
      return {
        variantId: toVariantGid(item.shopifyVariantId),
        quantity: 1,
        requiresShipping: true,
        customAttributes,
      }
    }

    return {
      quantity: 1,
      title: item.name,
      originalUnitPrice: item.price.toFixed(2),
      requiresShipping: true,
      customAttributes,
    }
  })

  const customAttributes: Array<{ key: string; value: string }> = [
    { key: 'source', value: 'bracelet-website' },
    { key: 'wrist_size_cm', value: String(input.wristSize) },
    { key: 'wearing_style', value: input.wearingStyle },
    { key: 'design_json', value: buildDesignSnapshot(input) },
  ]
  if (input.localOrderId) {
    customAttributes.push({ key: 'local_order_id', value: input.localOrderId })
  }
  if (input.designName?.trim()) {
    customAttributes.push({
      key: 'design_name',
      value: input.designName.trim(),
    })
  }

  const data = await shopifyAdminGraphql<{
    draftOrderCreate: {
      draftOrder: {
        id: string
        name: string
        invoiceUrl: string
        status: string
      } | null
      userErrors: Array<{ field: string[] | null; message: string }>
    }
  }>(DRAFT_ORDER_CREATE, {
    input: {
      lineItems,
      note: buildOrderNote(input),
      customAttributes,
      shippingLine: buildDraftOrderShippingLine(),
      tags: ['diy-bracelet', 'bracelet-website'],
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
    },
  })

  const result = data.draftOrderCreate
  if (result.userErrors?.length) {
    const msg = result.userErrors.map((e) => e.message).join('; ')
    throw new Error(msg)
  }

  const draftOrder = result.draftOrder
  if (!draftOrder?.invoiceUrl) {
    throw new Error('创建草稿订单失败，未返回支付链接')
  }

  return {
    draftOrderId: draftOrder.id,
    draftOrderName: draftOrder.name,
    checkoutUrl: draftOrder.invoiceUrl,
  }
}
