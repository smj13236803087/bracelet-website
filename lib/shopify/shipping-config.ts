/** 创建 Shopify 订单时的统一运费（与店铺货币一致） */
export const FLAT_SHIPPING_FEE = 20

export const FLAT_SHIPPING_TITLE = '运费'

export function buildDraftOrderShippingLine() {
  return {
    title: FLAT_SHIPPING_TITLE,
    price: FLAT_SHIPPING_FEE.toFixed(2),
  }
}
