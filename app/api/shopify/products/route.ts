import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'

export async function GET() {
  if (!STORE_DOMAIN || !ADMIN_TOKEN) {
    return NextResponse.json(
      {
        error:
          '缺少环境变量：请在环境变量中配置 SHOPIFY_STORE_DOMAIN 和 SHOPIFY_ADMIN_ACCESS_TOKEN',
      },
      { status: 500 }
    )
  }

  try {
    // 拉取所有商品，参考 fetchProduct.ts 的方式，确保获取完整数据（包括 options）
    const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=250`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Shopify API 请求失败：', res.status, text)
      return NextResponse.json(
        { error: 'Shopify API 请求失败', detail: text },
        { status: res.status }
      )
    }

    const data = await res.json()

    // 直接返回 Shopify API 的原始数据，不做任何过滤
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('拉取 Shopify 商品失败：', error)
    return NextResponse.json(
      { error: '拉取商品失败', detail: String(error) },
      { status: 500 }
    )
  }
}
