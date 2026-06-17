'use client'

import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Spin } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './Login.module.css'

export default function DashboardLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await response.json().catch(() => null)
      if (response.ok && data?.errno === 0) {
        message.success('登录成功')
        router.push('/dashboard/orders')
      } else {
        message.error(data?.errmsg || '登录失败，请检查邮箱和密码')
      }
    } catch (error) {
      console.error('login error', error)
      message.error('登录过程中发生错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Spin spinning={loading} size="large" wrapperClassName={styles.spinWrapper}>
      <div className={styles.container}>
        <div className={styles.background}>
          <div className={styles.circle1} />
          <div className={styles.circle2} />
        </div>
        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.logoContainer}>
              <span className={styles.logoText}>手串后台</span>
            </div>
            <div className={styles.welcomeText}>
              <p>
                欢迎登录 <span>手串定制后台管理系统</span>
              </p>
            </div>
            <Form name="login" onFinish={onFinish} className={styles.form}>
              <Form.Item
                name="email"
                rules={[{ required: true, message: '请输入邮箱' }]}
              >
                <Input
                  prefix={<UserOutlined className={styles.icon} />}
                  placeholder="邮箱"
                  className={styles.input}
                />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className={styles.icon} />}
                  placeholder="密码"
                  className={styles.input}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  className={styles.submitButton}
                  loading={loading}
                >
                  登录
                </Button>
                <div className={styles.links}>
                  <Link href="/dashboard/register">注册账号</Link>
                </div>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </Spin>
  )
}
