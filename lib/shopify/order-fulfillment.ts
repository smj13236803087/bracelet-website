import { shopifyAdminGraphql, ShopifyAdminError } from '@/lib/shopify/admin-client'
import { toShopifyOrderGid } from '@/lib/shopify/webhook'

const FULFILLMENT_ORDERS_QUERY = `
  query orderFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      id
      fulfillmentOrders(first: 20) {
        edges {
          node {
            id
            status
            lineItems(first: 50) {
              edges {
                node {
                  id
                  remainingQuantity
                }
              }
            }
          }
        }
      }
    }
  }
`

const FULFILLMENT_CREATE_MUTATION = `
  mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
    fulfillmentCreateV2(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`

type FulfillmentOrdersData = {
  order: {
    id: string
    fulfillmentOrders: {
      edges: Array<{
        node: {
          id: string
          status: string
          lineItems: {
            edges: Array<{
              node: {
                id: string
                remainingQuantity: number
              }
            }>
          }
        }
      }>
    }
  } | null
}

type FulfillmentCreateData = {
  fulfillmentCreateV2: {
    fulfillment: { id: string; status: string } | null
    userErrors: Array<{ field: string[] | null; message: string }>
  }
}

export async function createShopifyOrderFulfillment(input: {
  shopifyOrderId: string
  carrier: string
  trackingNumber: string
  notifyCustomer?: boolean
}) {
  const orderGid = toShopifyOrderGid(input.shopifyOrderId)

  const data = await shopifyAdminGraphql<FulfillmentOrdersData>(
    FULFILLMENT_ORDERS_QUERY,
    { orderId: orderGid }
  )

  if (!data.order) {
    throw new ShopifyAdminError('Shopify 订单不存在')
  }

  const lineItemsByFulfillmentOrder = data.order.fulfillmentOrders.edges
    .map((edge) => edge.node)
    .filter((fo) => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS')
    .map((fo) => ({
      fulfillmentOrderId: fo.id,
      fulfillmentOrderLineItems: fo.lineItems.edges
        .map((li) => li.node)
        .filter((li) => li.remainingQuantity > 0)
        .map((li) => ({
          id: li.id,
          quantity: li.remainingQuantity,
        })),
    }))
    .filter((fo) => fo.fulfillmentOrderLineItems.length > 0)

  if (lineItemsByFulfillmentOrder.length === 0) {
    throw new ShopifyAdminError('没有可发货的履约单')
  }

  const result = await shopifyAdminGraphql<FulfillmentCreateData>(
    FULFILLMENT_CREATE_MUTATION,
    {
      fulfillment: {
        lineItemsByFulfillmentOrder,
        trackingInfo: {
          company: input.carrier.trim(),
          number: input.trackingNumber.trim(),
        },
        notifyCustomer: input.notifyCustomer !== false,
      },
    }
  )

  const errors = result.fulfillmentCreateV2.userErrors
  if (errors.length) {
    throw new ShopifyAdminError(
      errors.map((e) => e.message).join('; ')
    )
  }

  if (!result.fulfillmentCreateV2.fulfillment) {
    throw new ShopifyAdminError('Shopify 发货失败')
  }

  return result.fulfillmentCreateV2.fulfillment
}
