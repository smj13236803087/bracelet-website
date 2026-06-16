const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'

export class ShopifyStorefrontError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ShopifyStorefrontError'
  }
}

export async function shopifyStorefrontGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
    throw new ShopifyStorefrontError(
      '缺少 SHOPIFY_STORE_DOMAIN 或 SHOPIFY_STOREFRONT_ACCESS_TOKEN'
    )
  }

  const url = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  const json = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string }>
  }

  if (!res.ok) {
    throw new ShopifyStorefrontError(
      'Shopify Storefront API 请求失败',
      res.status,
      json
    )
  }

  if (json.errors?.length) {
    throw new ShopifyStorefrontError(
      json.errors.map((e) => e.message).join('; '),
      res.status,
      json.errors
    )
  }

  if (!json.data) {
    throw new ShopifyStorefrontError('Shopify Storefront API 返回空数据')
  }

  return json.data
}

export function toVariantGid(variantId: number): string {
  return `gid://shopify/ProductVariant/${variantId}`
}
