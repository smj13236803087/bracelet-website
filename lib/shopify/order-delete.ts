import { shopifyAdminGraphql, ShopifyAdminError } from '@/lib/shopify/admin-client'
import { toShopifyOrderGid } from '@/lib/shopify/webhook'

const ORDER_CANCEL_MUTATION = `
  mutation orderCancel($orderId: ID!, $notifyCustomer: Boolean, $refund: Boolean, $reason: OrderCancelReason!, $restock: Boolean) {
    orderCancel(orderId: $orderId, notifyCustomer: $notifyCustomer, refund: $refund, reason: $reason, restock: $restock) {
      job {
        id
      }
      orderCancelUserErrors {
        field
        message
        code
      }
    }
  }
`

const ORDER_DELETE_MUTATION = `
  mutation orderDelete($orderId: ID!) {
    orderDelete(orderId: $orderId) {
      deletedOrderId
      userErrors {
        field
        message
      }
    }
  }
`

const DRAFT_ORDER_DELETE_MUTATION = `
  mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
    draftOrderDelete(input: $input) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`

function toDraftOrderGid(id: string): string {
  if (id.startsWith('gid://')) return id
  return `gid://shopify/DraftOrder/${id}`
}

async function cancelShopifyOrder(shopifyOrderId: string) {
  const data = await shopifyAdminGraphql<{
    orderCancel: {
      orderCancelUserErrors: Array<{ message: string; code?: string }>
    }
  }>(ORDER_CANCEL_MUTATION, {
    orderId: toShopifyOrderGid(shopifyOrderId),
    notifyCustomer: false,
    refund: true,
    reason: 'OTHER',
    restock: true,
  })

  const errors = data.orderCancel.orderCancelUserErrors.filter(
    (e) => !e.code?.includes('ALREADY_CANCELLED')
  )
  if (errors.length) {
    const msg = errors.map((e) => e.message).join('; ')
    if (!msg.toLowerCase().includes('already been canceled')) {
      throw new ShopifyAdminError(msg)
    }
  }
}

async function deleteShopifyOrder(shopifyOrderId: string) {
  const data = await shopifyAdminGraphql<{
    orderDelete: {
      deletedOrderId: string | null
      userErrors: Array<{ message: string }>
    }
  }>(ORDER_DELETE_MUTATION, {
    orderId: toShopifyOrderGid(shopifyOrderId),
  })

  const errors = data.orderDelete.userErrors
  if (errors.length) {
    throw new ShopifyAdminError(errors.map((e) => e.message).join('; '))
  }
}

async function deleteShopifyDraftOrder(draftOrderId: string) {
  const data = await shopifyAdminGraphql<{
    draftOrderDelete: {
      deletedId: string | null
      userErrors: Array<{ message: string }>
    }
  }>(DRAFT_ORDER_DELETE_MUTATION, {
    input: { id: toDraftOrderGid(draftOrderId) },
  })

  const errors = data.draftOrderDelete.userErrors
  if (errors.length) {
    throw new ShopifyAdminError(errors.map((e) => e.message).join('; '))
  }
}

export async function cancelAndDeleteShopifyOrderRefs(input: {
  shopifyOrderId?: string | null
  shopifyDraftOrderId?: string | null
}) {
  if (input.shopifyOrderId) {
    try {
      await cancelShopifyOrder(input.shopifyOrderId)
    } catch (error) {
      if (!(error instanceof ShopifyAdminError)) throw error
      if (!error.message.toLowerCase().includes('cancel')) {
        throw error
      }
    }
    await deleteShopifyOrder(input.shopifyOrderId)
    return
  }

  if (input.shopifyDraftOrderId) {
    await deleteShopifyDraftOrder(input.shopifyDraftOrderId)
  }
}
