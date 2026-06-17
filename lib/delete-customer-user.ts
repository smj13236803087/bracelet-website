import prisma from '@/lib/prisma'
import { cancelAndDeleteShopifyOrderRefs } from '@/lib/shopify/order-delete'

export async function deleteCustomerUserPermanently(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    return { ok: false as const, status: 404, error: '用户不存在' }
  }

  const orders = await prisma.order.findMany({
    where: { userId },
    select: {
      id: true,
      shopifyOrderId: true,
      shopifyDraftOrderId: true,
    },
  })

  for (const order of orders) {
    try {
      await cancelAndDeleteShopifyOrderRefs({
        shopifyOrderId: order.shopifyOrderId,
        shopifyDraftOrderId: order.shopifyDraftOrderId,
      })
    } catch (error) {
      console.error('删除用户时同步 Shopify 订单失败：', order.id, error)
    }
  }

  await prisma.$transaction([
    prisma.order.deleteMany({ where: { userId } }),
    prisma.braceletDesign.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])

  return { ok: true as const }
}
