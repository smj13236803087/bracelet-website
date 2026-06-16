/**
 * 测试 Storefront API 是否可用
 *
 * 用法：
 *   node scripts/test-storefront-api.mjs
 *   node scripts/test-storefront-api.mjs --token=xxx
 */

import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const STORE_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN || 'bracelet-3577352.myshopify.com'
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'
const STOREFRONT_TOKEN =
  process.argv.find((a) => a.startsWith('--token='))?.slice('--token='.length) ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  ''

const PRODUCTS_QUERY = `
  query TestProducts {
    products(first: 3) {
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`

const CART_CREATE_MUTATION = `
  mutation TestCartCreate {
    cartCreate {
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

async function callStorefront(query, label) {
  const url = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`
  console.log(`\n--- ${label} ---`)
  console.log(`POST ${url}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query }),
  })

  const data = await res.json()
  console.log(`HTTP ${res.status}`)

  if (data.errors?.length) {
    console.log('GraphQL errors:', JSON.stringify(data.errors, null, 2))
    return false
  }

  if (data.data?.products) {
    const items = data.data.products.edges || []
    console.log(`OK products: ${items.length}`)
    items.forEach((e) => console.log(`  - ${e.node.title}`))
    return true
  }

  if (data.data?.cartCreate?.cart?.id) {
    console.log('cart id:', data.data.cartCreate.cart.id)
    console.log('checkoutUrl:', data.data.cartCreate.cart.checkoutUrl)
    return true
  }

  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 600))
  return false
}

async function main() {
  console.log('Storefront API 测试')
  console.log('Store:', STORE_DOMAIN)

  if (!STOREFRONT_TOKEN) {
    console.error('\n缺少 token。请先运行：')
    console.error('  node scripts/create-storefront-token.mjs')
    process.exit(1)
  }

  const productsOk = await callStorefront(PRODUCTS_QUERY, 'products')
  if (productsOk) {
    await callStorefront(CART_CREATE_MUTATION, 'cartCreate')
    console.log('\nStorefront API 可用')
  } else {
    console.log('\n失败。请检查 SHOPIFY_STOREFRONT_ACCESS_TOKEN 或 App Storefront scope')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
