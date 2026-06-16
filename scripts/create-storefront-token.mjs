/**
 * 用 Admin API token 创建 Storefront Access Token
 *
 * 前置：Dev Dashboard 应用版本已包含 Storefront scope 并已 Release + 店铺已安装
 *
 * 用法：
 *   node scripts/create-storefront-token.mjs
 *   node scripts/create-storefront-token.mjs --title=bracelet-website
 *   node scripts/create-storefront-token.mjs --list
 */

import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const STORE_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN || 'bracelet-3577352.myshopify.com'
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || ''
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'

const titleArg = process.argv.find((a) => a.startsWith('--title='))
const TOKEN_TITLE = titleArg
  ? titleArg.slice('--title='.length)
  : 'bracelet-website'
const LIST_ONLY = process.argv.includes('--list')

const ADMIN_GRAPHQL_URL = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`

async function adminGraphql(query, variables) {
  const res = await fetch(ADMIN_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Admin API 非 JSON 响应 (${res.status}): ${text.slice(0, 400)}`)
  }

  if (!res.ok) {
    throw new Error(`Admin API HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  if (data.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors, null, 2)}`)
  }

  return data.data
}

const LIST_QUERY = `
  query ListStorefrontTokens {
    storefrontAccessTokens(first: 20) {
      edges {
        node {
          id
          title
          accessToken
          createdAt
          accessScopes {
            handle
          }
        }
      }
    }
  }
`

const CREATE_MUTATION = `
  mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
    storefrontAccessTokenCreate(input: $input) {
      userErrors {
        field
        message
      }
      storefrontAccessToken {
        title
        accessToken
        accessScopes {
          handle
        }
      }
    }
  }
`

async function listTokens() {
  try {
    const data = await adminGraphql(LIST_QUERY)
    const edges = data?.storefrontAccessTokens?.edges || []
    console.log(`已有 Storefront token：${edges.length} 个\n`)
    if (!edges.length) {
      console.log('（无）将创建新 token\n')
      return
    }
    for (const { node } of edges) {
      const scopes = (node.accessScopes || []).map((s) => s.handle).join(', ')
      const tokenPreview = node.accessToken
        ? `${node.accessToken.slice(0, 8)}...${node.accessToken.slice(-4)}`
        : '(hidden)'
      console.log(`- ${node.title}`)
      console.log(`  created: ${node.createdAt}`)
      console.log(`  scopes: ${scopes || '(none)'}`)
      console.log(`  token: ${tokenPreview}`)
      console.log('')
    }
  } catch (err) {
    console.log('（跳过列出已有 token：当前 Admin API 版本可能不支持查询列表）\n')
  }
}

async function createToken() {
  const data = await adminGraphql(CREATE_MUTATION, {
    input: { title: TOKEN_TITLE },
  })

  const payload = data?.storefrontAccessTokenCreate
  if (payload?.userErrors?.length) {
    console.error('创建失败：')
    payload.userErrors.forEach((e) => console.error(`  - ${e.message}`))
    console.error('\n请确认：')
    console.error('  1. Dev Dashboard 版本已添加 Storefront scope 并已 Release')
    console.error('  2. 店铺已安装/更新该应用版本')
    console.error('  3. SHOPIFY_ADMIN_ACCESS_TOKEN 有效且有权限')
    process.exit(1)
  }

  const token = payload?.storefrontAccessToken
  if (!token?.accessToken) {
    console.error('未返回 accessToken：', JSON.stringify(data, null, 2))
    process.exit(1)
  }

  const scopes = (token.accessScopes || []).map((s) => s.handle).join(', ')
  console.log('Storefront Access Token 创建成功\n')
  console.log(`title:  ${token.title}`)
  console.log(`scopes: ${scopes}\n`)
  console.log('请写入 .env：')
  console.log(`SHOPIFY_STOREFRONT_ACCESS_TOKEN="${token.accessToken}"\n`)
  console.log('验证：')
  console.log('  node scripts/test-storefront-api.mjs')
}

async function main() {
  console.log('Shopify Storefront Token 工具')
  console.log('Store:', STORE_DOMAIN)
  console.log('API version:', API_VERSION)

  if (!ADMIN_TOKEN) {
    console.error('\n缺少 SHOPIFY_ADMIN_ACCESS_TOKEN（.env）')
    console.error('请先完成 OAuth 安装拿到 shpat_ token')
    process.exit(1)
  }

  if (LIST_ONLY) {
    await listTokens()
    return
  }

  await listTokens()
  console.log('--- 创建新 token ---\n')
  await createToken()
}

main().catch((err) => {
  console.error('\n错误:', err.message || err)
  process.exit(1)
})
