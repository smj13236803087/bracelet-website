import crypto from 'crypto'

export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret || !hmacHeader) return false

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')

  const a = Buffer.from(hash)
  const b = Buffer.from(hmacHeader)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function toShopifyOrderGid(orderId: number | string): string {
  const id = String(orderId).trim()
  if (!id) {
    throw new Error('无效的 Shopify 订单 ID')
  }
  if (id.startsWith('gid://')) {
    return id
  }
  return `gid://shopify/Order/${id}`
}
