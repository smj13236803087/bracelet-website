import { NextRequest, NextResponse } from 'next/server'
import { BraceletItem } from '@/types/bracelet'
import { WearingStyle } from '@/components/workspace/WristSizeModal'
import { requireSessionUser } from '@/lib/auth-server'
import { createLocalOrderAndSyncShopify } from '@/lib/orders/create-order'
import { ShopifyAdminError } from '@/lib/shopify/admin-client'

export const dynamic = 'force-dynamic'

interface CheckoutBody {
  items?: BraceletItem[]
  totalPrice?: number
  wristSize?: number
  wearingStyle?: WearingStyle
  designName?: string
}

function isWearingStyle(value: unknown): value is WearingStyle {
  return value === 'single' || value === 'double'
}

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return NextResponse.json({ error: '请先登录后再支付' }, { status: 401 })
  }

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  const items = body.items
  const totalPrice = body.totalPrice
  const wristSize = body.wristSize
  const wearingStyle = body.wearingStyle

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '请先添加材料再支付' }, { status: 400 })
  }

  if (typeof totalPrice !== 'number' || totalPrice <= 0) {
    return NextResponse.json({ error: '订单金额无效' }, { status: 400 })
  }

  if (typeof wristSize !== 'number' || wristSize <= 0) {
    return NextResponse.json(
      { error: '请先完成手腕尺寸设置' },
      { status: 400 }
    )
  }

  if (!isWearingStyle(wearingStyle)) {
    return NextResponse.json({ error: '请先选择戴法' }, { status: 400 })
  }

  const checkoutInput = {
    items,
    totalPrice,
    wristSize,
    wearingStyle,
    designName: body.designName,
  }

  try {
    const { order, checkoutUrl } = await createLocalOrderAndSyncShopify(
      user.id,
      user.email,
      checkoutInput
    )

    return NextResponse.json({
      checkoutUrl,
      orderId: order.id,
      orderNo: order.orderNo,
    })
  } catch (error) {
    console.error('创建订单/结账失败：', error)

    if (error instanceof ShopifyAdminError) {
      const message = error.message
      const needsScope =
        message.includes('access') ||
        message.includes('scope') ||
        message.includes('permission')

      return NextResponse.json(
        {
          error: needsScope
            ? 'Shopify 权限不足，请为应用添加 write_draft_orders 权限后重新安装'
            : message,
          detail: error.details,
        },
        { status: error.status && error.status < 500 ? error.status : 502 }
      )
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '创建支付链接失败，请稍后重试',
      },
      { status: 500 }
    )
  }
}
