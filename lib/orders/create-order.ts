import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { ShopifyAdminError } from '@/lib/shopify/admin-client'
import { createBraceletDraftOrder } from '@/lib/shopify/draft-order'
import { createBraceletStorefrontCheckout } from '@/lib/shopify/storefront-checkout'
import { CreateBraceletCheckoutInput } from '@/lib/shopify/draft-order'
import { generateOrderNo } from './order-utils'

function isDraftOrderAccessDenied(error: unknown): boolean {
  if (!(error instanceof ShopifyAdminError)) return false
  const msg = error.message.toLowerCase()
  return msg.includes('access denied') || msg.includes('write_draft_orders')
}

export async function createLocalOrderAndSyncShopify(
  userId: string,
  customerEmail: string,
  input: CreateBraceletCheckoutInput
) {
  const order = await prisma.order.create({
    data: {
      userId,
      orderNo: generateOrderNo(),
      status: 'PENDING_PAYMENT',
      designName: input.designName?.trim() || null,
      items: input.items as object[],
      totalPrice: input.totalPrice,
      wristSize: input.wristSize,
      wearingStyle: input.wearingStyle,
      shopifySyncStatus: 'PENDING',
    },
  })

  const checkoutInput: CreateBraceletCheckoutInput = {
    ...input,
    localOrderId: order.id,
    customerEmail,
  }

  try {
    let result
    try {
      result = await createBraceletDraftOrder(checkoutInput)
    } catch (error) {
      if (isDraftOrderAccessDenied(error)) {
        result = await createBraceletStorefrontCheckout(checkoutInput)
      } else {
        throw error
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyDraftOrderId: result.draftOrderId,
        shopifyOrderName: result.draftOrderName,
        shopifyCheckoutUrl: result.checkoutUrl,
        shopifySyncStatus: 'SYNCED',
        shopifySyncError: null,
      },
    })

    return {
      order: updated,
      checkoutUrl: result.checkoutUrl,
    }
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifySyncStatus: 'FAILED',
        shopifySyncError:
          error instanceof Error ? error.message : '同步 Shopify 失败',
      },
    })
    throw error
  }
}

export async function markOrderPaid(
  orderId: string,
  shopifyOrderId: string,
  shopifyOrderName: string
) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PENDING_SHIPMENT',
      shopifyOrderId,
      shopifyOrderName,
      paidAt: new Date(),
    },
  })
}

export async function markOrderShipped(
  orderId: string,
  data: {
    carrier?: string | null
    trackingNumber?: string | null
    trackingUrl?: string | null
    trackingEvents?: Prisma.InputJsonValue
  }
) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PENDING_RECEIPT',
      carrier: data.carrier ?? null,
      trackingNumber: data.trackingNumber ?? null,
      trackingUrl: data.trackingUrl ?? null,
      trackingEvents: data.trackingEvents ?? undefined,
      shippedAt: new Date(),
    },
  })
}
