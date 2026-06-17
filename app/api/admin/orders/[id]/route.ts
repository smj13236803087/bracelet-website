import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'
import { cancelAndDeleteShopifyOrderRefs } from '@/lib/shopify/order-delete'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      shopifyOrderId: true,
      shopifyDraftOrderId: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }

  try {
    await cancelAndDeleteShopifyOrderRefs({
      shopifyOrderId: order.shopifyOrderId,
      shopifyDraftOrderId: order.shopifyDraftOrderId,
    })
  } catch (error) {
    console.error('删除订单时同步 Shopify 失败：', id, error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Shopify 订单取消/删除失败',
      },
      { status: 502 }
    )
  }

  await prisma.order.delete({ where: { id } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
