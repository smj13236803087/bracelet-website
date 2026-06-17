const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

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

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  if (msg.includes('fetch failed') || msg.includes('network')) return true
  const cause = (error as Error & { cause?: { code?: string } }).cause
  const code = cause?.code || ''
  return (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function shopifyAdminGraphqlOnce<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!STORE_DOMAIN || !ADMIN_TOKEN) {
    throw new ShopifyAdminError(
      '缺少 SHOPIFY_STORE_DOMAIN 或 SHOPIFY_ADMIN_ACCESS_TOKEN'
    )
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await shopifyAdminGraphqlOnce<T>(query, variables)
    } catch (error) {
      lastError = error
      if (!isRetryableNetworkError(error) || attempt === MAX_RETRIES) {
        if (isRetryableNetworkError(error)) {
          throw new ShopifyAdminError(
            `连接 Shopify 超时或失败（已重试 ${MAX_RETRIES} 次），请检查网络或代理后重试`
          )
        }
        throw error
      }
      await sleep(1000 * attempt)
    }
  }

  throw lastError
}
