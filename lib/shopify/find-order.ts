import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'

const RECENT_ORDERS_QUERY = `
  query recentOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          displayFinancialStatus
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`

export interface MatchedShopifyOrder {
  id: string
  name: string
  displayFinancialStatus: string
}

function isPaidStatus(status: string): boolean {
  const normalized = status.toUpperCase()
  return normalized === 'PAID' || normalized === 'PARTIALLY_PAID'
}

export async function findShopifyOrderByLocalOrderId(
  localOrderId: string
): Promise<MatchedShopifyOrder | null> {
  const data = await shopifyAdminGraphql<{
    orders: {
      edges: Array<{
        node: {
          id: string
          name: string
          displayFinancialStatus: string
          customAttributes: Array<{ key: string; value: string }>
        }
      }>
    }
  }>(RECENT_ORDERS_QUERY, { first: 50 })

  for (const edge of data.orders.edges) {
    const node = edge.node
    const matched = node.customAttributes?.some(
      (attr) => attr.key === 'local_order_id' && attr.value === localOrderId
    )
    if (matched && isPaidStatus(node.displayFinancialStatus)) {
      return {
        id: node.id,
        name: node.name,
        displayFinancialStatus: node.displayFinancialStatus,
      }
    }
  }

  return null
}

export function isShopifyDraftOrderGid(id: string | null | undefined): boolean {
  return !!id && id.includes('gid://shopify/DraftOrder/')
}
