import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'
import { toOrderSummary } from '@/lib/orders/order-utils'
import { OrderStatus } from '@prisma/client'

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = v ? Number.parseInt(v, 10) : def
  if (Number.isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

const VALID_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'PENDING_RECEIPT',
  'COMPLETED',
  'CANCELLED',
]

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')?.trim() || ''
  const q = sp.get('q')?.trim() || ''
  const field = sp.get('field')?.trim() || ''
  const sort = sp.get('sort')?.trim() || ''
  const page = clampInt(sp.get('page'), 1, 1, 100000)
  const pageSize = clampInt(sp.get('pageSize'), 10, 1, 100)

  const where: Record<string, unknown> = {}

  if (status && status !== 'all') {
    if (VALID_STATUSES.includes(status as OrderStatus)) {
      where.status = status
    }
  }

  if (q) {
    if (!field || field === 'all') {
      where.OR = [
        { id: { contains: q } },
        { orderNo: { contains: q } },
        { designName: { contains: q } },
        { shopifyOrderName: { contains: q } },
        { trackingNumber: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ]
    } else if (field === 'orderNo') {
      where.orderNo = { contains: q }
    } else if (field === 'trackingNumber') {
      where.trackingNumber = { contains: q }
    } else if (field === 'userEmail') {
      where.user = { email: { contains: q } }
    } else if (field === 'id') {
      where.id = { contains: q }
    } else {
      where.OR = [
        { id: { contains: q } },
        { orderNo: { contains: q } },
        { trackingNumber: { contains: q } },
      ]
    }
  }

  const orderBy = (() => {
    const [k, o] = sort.split(':')
    const order = o === 'asc' ? 'asc' : o === 'desc' ? 'desc' : null
    if (!order) return { createdAt: 'desc' as const }
    if (k === 'createdAt' || k === 'updatedAt') return { [k]: order } as const
    if (k === 'orderNo' || k === 'status' || k === 'totalPrice') {
      return { [k]: order } as const
    }
    return { createdAt: 'desc' as const }
  })()

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    page,
    pageSize,
    total,
    orders: orders.map((order) => ({
      ...toOrderSummary(order),
      user: order.user,
      shopifyOrderId: order.shopifyOrderId,
      shopifyOrderName: order.shopifyOrderName,
      shopifyDraftOrderId: order.shopifyDraftOrderId,
    })),
  })
}
