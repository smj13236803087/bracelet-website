import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'
import { deleteCustomerUserPermanently } from '@/lib/delete-customer-user'
import { hashPassword, isValidEmail } from '@/lib/security'
import { UserRole } from '@prisma/client'

function normalizeRole(input: unknown): UserRole | null {
  const v = String(input || '').trim().toUpperCase()
  if (v === 'USER' || v === 'SUPER_ADMIN') return v
  return null
}

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const { userId } = await ctx.params
  const body = (await req.json().catch(() => null)) as {
    email?: unknown
    name?: unknown
    password?: unknown
    role?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: '请求体不能为空' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }

  const data: {
    email?: string
    name?: string
    password?: string
    role?: UserRole
  } = {}

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: '姓名不能为空' }, { status: 400 })
    }
    data.name = name
  }

  if (body.role !== undefined) {
    const role = normalizeRole(body.role)
    if (!role) {
      return NextResponse.json(
        { error: 'role 仅支持 USER 或 SUPER_ADMIN' },
        { status: 400 }
      )
    }
    data.role = role
  }

  if (body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }
    const dup = await prisma.user.findFirst({
      where: { email, id: { not: userId } },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json({ error: '邮箱已存在' }, { status: 409 })
    }
    data.email = email
  }

  if (body.password !== undefined) {
    const password = String(body.password || '').trim()
    if (!password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 })
    }
    try {
      data.password = hashPassword(password)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : '密码无效' },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
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
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const { userId } = await ctx.params
  const result = await deleteCustomerUserPermanently(userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
