'use client'

import React, { useEffect, useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, type MenuProps } from 'antd'
import {
  ShoppingCartOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const { Sider, Header, Content } = Layout

type MeResponse = {
  errno: number
  errmsg: string
  data: {
    id: string
    email: string
    name: string
  } | null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [admin, setAdmin] = useState<MeResponse['data'] | null>(null)

  const isAuthPage =
    pathname === '/dashboard/login' || pathname === '/dashboard/register'

  useEffect(() => {
    if (isAuthPage) return

    const check = async () => {
      try {
        const res = await fetch('/api/admin/auth/me', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as MeResponse | null
        if (!json || json.errno !== 0 || !json.data) {
          router.push('/dashboard/login')
          return
        }
        setAdmin(json.data)
      } catch {
        router.push('/dashboard/login')
      }
    }
    void check()
  }, [router, isAuthPage])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    setAdmin(null)
    router.push('/dashboard/login')
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  const selectedKey = (() => {
    if (!pathname) return 'orders'
    if (pathname.startsWith('/dashboard/users')) return 'users'
    if (pathname.startsWith('/dashboard/orders')) return 'orders'
    return 'orders'
  })()

  if (isAuthPage) {
    return <>{children}</>
  }

  if (!admin) {
    return null
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div
          style={{
            height: 56,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: 18,
                color: 'white',
                fontWeight: 600,
              }}
            >
              手串后台
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: 'users',
              icon: <TeamOutlined />,
              label: <Link href="/dashboard/users">用户管理</Link>,
            },
            {
              key: 'orders',
              icon: <ShoppingCartOutlined />,
              label: <Link href="/dashboard/orders">订单管理</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            手串定制后台管理系统
          </div>
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: 8,
              }}
            >
              <span>{admin.name || admin.email}</span>
              <Avatar icon={<UserOutlined />} />
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <div
            style={{
              padding: 24,
              minHeight: 600,
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
