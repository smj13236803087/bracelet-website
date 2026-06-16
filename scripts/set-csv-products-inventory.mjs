/**
 * 将 CSV 导入的 DIY 商品库存设为指定数量（默认 500）
 *
 * 前置：应用需具备 write_inventory（及 read_products）权限，并重新 OAuth 安装
 *
 * 用法：
 *   node scripts/set-csv-products-inventory.mjs
 *   node scripts/set-csv-products-inventory.mjs --quantity=500
 */

import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01'

const quantityArg = process.argv.find((a) => a.startsWith('--quantity='))
const TARGET_QUANTITY = quantityArg
  ? Number(quantityArg.slice('--quantity='.length))
  : 500

const CSV_PRODUCT_TYPES = new Set([
  'obsidian',
  'amethyst',
  'moonshine',
  'cutoff',
  'double-pointed-crystal',
  'running-laps',
  'pendant',
])

const headers = {
  'X-Shopify-Access-Token': ADMIN_TOKEN,
  'Content-Type': 'application/json',
}

async function admin(path, options = {}) {
  const res = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}${path}`,
    { headers, ...options }
  )
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  return data
}

async function fetchAllProducts() {
  const products = []
  let path = `/products.json?limit=250`

  while (path) {
    const res = await fetch(
      `https://${STORE_DOMAIN}/admin/api/${API_VERSION}${path}`,
      { headers: { 'X-Shopify-Access-Token': ADMIN_TOKEN } }
    )
    const data = await res.json()
    products.push(...(data.products || []))

    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1]
    if (next) {
      const url = new URL(next)
      path = url.pathname.replace(`/admin/api/${API_VERSION}`, '') + url.search
    } else {
      path = ''
    }
  }

  return products
}

async function main() {
  if (!STORE_DOMAIN || !ADMIN_TOKEN) {
    console.error('缺少 SHOPIFY_STORE_DOMAIN 或 SHOPIFY_ADMIN_ACCESS_TOKEN')
    process.exit(1)
  }

  if (!Number.isFinite(TARGET_QUANTITY) || TARGET_QUANTITY < 0) {
    console.error('无效数量：', TARGET_QUANTITY)
    process.exit(1)
  }

  console.log('店铺:', STORE_DOMAIN)
  console.log('目标库存:', TARGET_QUANTITY)

  const scopeRes = await fetch(
    `https://${STORE_DOMAIN}/admin/oauth/access_scopes.json`,
    { headers: { 'X-Shopify-Access-Token': ADMIN_TOKEN } }
  )
  const scopeData = await scopeRes.json()
  const scopes = (scopeData.access_scopes || []).map((s) => s.handle)
  console.log('当前 token scopes:', scopes.join(', '))

  if (!scopes.includes('write_inventory')) {
    console.error('\n缺少 write_inventory 权限。请：')
    console.error('1. Partners 应用添加 write_inventory、read_inventory scope')
    console.error('2. Release 新版本')
    console.error('3. 卸载并重新安装应用（更新 .env 中 SHOPIFY_SCOPES 后）')
    console.error(
      `   ${process.env.SHOPIFY_APP_URL}/api/auth/shopify/install?shop=${STORE_DOMAIN}`
    )
    process.exit(1)
  }

  const { shop } = await admin('/shop.json')
  const locationId = shop.primary_location_id
  if (!locationId) {
    console.error('无法获取 primary_location_id')
    process.exit(1)
  }
  console.log('仓库 location_id:', locationId)

  const products = await fetchAllProducts()
  const csvProducts = products.filter((p) =>
    CSV_PRODUCT_TYPES.has((p.product_type || '').toLowerCase())
  )

  console.log(`匹配 CSV 商品: ${csvProducts.length} / ${products.length}`)

  let ok = 0
  let fail = 0

  for (const product of csvProducts) {
    for (const variant of product.variants || []) {
      try {
        await admin('/inventory_levels/set.json', {
          method: 'POST',
          body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: variant.inventory_item_id,
            available: TARGET_QUANTITY,
          }),
        })
        console.log(`✓ ${product.title} (variant ${variant.id}) -> ${TARGET_QUANTITY}`)
        ok++
      } catch (error) {
        console.error(`✗ ${product.title} (variant ${variant.id}):`, error.message)
        fail++
      }
    }
  }

  console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`)

  if (ok > 0) {
    const verify = csvProducts.slice(0, 3)
    console.log('\n抽样验证:')
    for (const p of verify) {
      const v = p.variants?.[0]
      const fresh = await admin(`/products/${p.id}.json`)
      const freshV = fresh.product.variants.find((x) => x.id === v.id)
      console.log(`  ${p.title}: inventory_quantity=${freshV?.inventory_quantity}`)
    }
  }

  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
