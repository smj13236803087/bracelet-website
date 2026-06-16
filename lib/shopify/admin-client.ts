const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'

export class ShopifyAdminError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ShopifyAdminError'
  }
}

export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!STORE_DOMAIN || !ADMIN_TOKEN) {
    throw new ShopifyAdminError(
      '缺少 SHOPIFY_STORE_DOMAIN 或 SHOPIFY_ADMIN_ACCESS_TOKEN'
    )
  }

  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  const json = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string }>
  }

  if (!res.ok) {
    throw new ShopifyAdminError(
      'Shopify Admin API 请求失败',
      res.status,
      json
    )
  }

  if (json.errors?.length) {
    throw new ShopifyAdminError(
      json.errors.map((e) => e.message).join('; '),
      res.status,
      json.errors
    )
  }

  if (!json.data) {
    throw new ShopifyAdminError('Shopify Admin API 返回空数据')
  }

  return json.data
}
