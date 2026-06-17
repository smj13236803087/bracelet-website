import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'
import { hashPassword, isValidEmail } from '@/lib/security'
import { UserRole } from '@prisma/client'
import { createOrGetShopifyCustomer } from '@/lib/shopify/admin'

function normalizeRole(input: unknown): UserRole | null {
  const v = String(input || '').trim().toUpperCase()
  if (v === 'USER' || v === 'SUPER_ADMIN') return v
  return null
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = v ? Number.parseInt(v, 10) : def
  if (Number.isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() || ''
  const field = sp.get('field')?.trim() || ''
  const sort = sp.get('sort')?.trim() || ''
  const page = clampInt(sp.get('page'), 1, 1, 100000)
  const pageSize = clampInt(sp.get('pageSize'), 10, 1, 100)

  const where: {
    OR?: Array<Record<string, unknown>>
    email?: { contains: string }
    name?: { contains: string }
    id?: { contains: string }
    role?: UserRole
  } = {}

  if (q) {
    const roleQuery = normalizeRole(q)
    if (!field || field === 'all') {
      where.OR = [
        { id: { contains: q } },
        { email: { contains: q } },
        { name: { contains: q } },
        ...(roleQuery ? [{ role: roleQuery }] : []),
      ]
    } else if (field === 'email') {
      where.email = { contains: q }
    } else if (field === 'name') {
      where.name = { contains: q }
    } else if (field === 'id') {
      where.id = { contains: q }
    } else if (field === 'role') {
      if (!roleQuery) {
        return NextResponse.json(
          { page, pageSize, total: 0, users: [] },
          { status: 200 }
        )
      }
      where.role = roleQuery
    } else {
      where.OR = [
        { id: { contains: q } },
        { email: { contains: q } },
        { name: { contains: q } },
      ]
    }
  }

  const orderBy = (() => {
    const [k, o] = sort.split(':')
    const order = o === 'asc' ? 'asc' : o === 'desc' ? 'desc' : null
    if (!order) return { id: 'asc' as const }
    if (k === 'createdAt' || k === 'updatedAt') return { [k]: order } as const
    if (k === 'email' || k === 'name' || k === 'role') return { [k]: order } as const
    return { id: 'asc' as const }
  })()

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        shopifyCustomerId: true,
        shopifyEmail: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true, braceletDesigns: true } },
      },
    }),
  ])

  return NextResponse.json({
    page,
    pageSize,
    total,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      shopifyCustomerId: u.shopifyCustomerId,
      shopifyEmail: u.shopifyEmail,
      orderCount: u._count.orders,
      designCount: u._count.braceletDesigns,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const body = (await req.json().catch(() => null)) as {
    email?: unknown
    name?: unknown
    password?: unknown
    role?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: '请求体不能为空' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const password = String(body.password || '')

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: '姓名不能为空' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: '密码长度至少 8 位' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return NextResponse.json({ error: '邮箱已存在' }, { status: 409 })
  }

  const role = normalizeRole(body.role) ?? 'USER'

  let hashedPassword = ''
  try {
    hashedPassword = hashPassword(password)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '密码无效' },
      { status: 400 }
    )
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role,
      shopifyEmail: role === 'USER' ? email : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      shopifyCustomerId: true,
      shopifyEmail: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (role === 'SUPER_ADMIN') {
    return NextResponse.json({ user }, { status: 200 })
  }

  try {
    const customer = await createOrGetShopifyCustomer({ email, name })
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        shopifyCustomerId: String(customer.id),
        shopifyEmail: customer.email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        shopifyCustomerId: true,
        shopifyEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ user: updated }, { status: 200 })
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '同步 Shopify 客户失败',
      },
      { status: 502 }
    )
  }
}
