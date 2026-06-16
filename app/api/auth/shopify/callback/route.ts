import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET

function verifyHmac(searchParams: URLSearchParams, clientSecret: string) {
  const hmac = searchParams.get('hmac') || ''

  // 1. 去掉 hmac 本身
  const cloned = new URLSearchParams(searchParams)
  cloned.delete('hmac')

  // 2. 按键名排序并生成 query 字符串
  const message = Array.from(cloned.entries())
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  // 3. 使用 client secret 计算 HMAC-SHA256
  const generated = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hmac))
}

export async function GET(req: NextRequest) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          '缺少环境变量：请在 .env.local 中配置 SHOPIFY_CLIENT_ID 和 SHOPIFY_CLIENT_SECRET',
      },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const searchParams = url.searchParams

  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  if (!code || !shop || !state) {
    return NextResponse.json(
      { error: '缺少必要的回调参数（code / shop / state）' },
      { status: 400 }
    )
  }

  // 校验 state 防 CSRF
  const cookieStore = cookies()
  const storedState = cookieStore.get('shopify_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: 'state 校验失败' }, { status: 400 })
  }

  // 校验 HMAC，确保回调来自 Shopify
  if (!verifyHmac(searchParams, CLIENT_SECRET)) {
    return NextResponse.json({ error: 'HMAC 校验失败' }, { status: 400 })
  }

  // 用 code 换取永久 access token
  const tokenUrl = `https://${shop}/admin/oauth/access_token`

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    console.error('交换 access token 失败：', tokenRes.status, text)
    return NextResponse.json(
      { error: '交换 access token 失败', detail: text },
      { status: 500 }
    )
  }

  const data = (await tokenRes.json()) as {
    access_token: string
    scope: string
  }

  // 这里简单返回 token，方便你在浏览器里复制出来，之后可以手动放到 .env.local 中
  // 实际生产应用应当把 token 安全地存到数据库中，而不是直接返回给前端。
  console.log('Shopify access token 获取成功：', data)

  return NextResponse.json(
    {
      message:
        '获取 access token 成功，请复制 access_token 放入 .env.local 的 SHOPIFY_ADMIN_ACCESS_TOKEN 中',
      access_token: data.access_token,
      scope: data.scope,
      shop,
    },
    { status: 200 }
  )
}

