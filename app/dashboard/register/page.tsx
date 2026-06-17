'use client'

import React, { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './Register.module.css'

export default function DashboardRegisterPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [codeSending, setCodeSending] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const sendCode = async () => {
    try {
      const values = await form.validateFields(['email', 'name', 'password'])
      setCodeSending(true)
      const res = await fetch('/api/admin/auth/register/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.errno === 0) {
        message.success('验证码已发送到邮箱，请在 10 分钟内完成验证')
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        message.error(data?.errmsg || '发送验证码失败，请稍后重试')
      }
    } catch {
      // validation failed
    } finally {
      setCodeSending(false)
    }
  }

  const onFinish = async (values: { email: string; code: string }) => {
    setRegistering(true)
    try {
      const res = await fetch('/api/admin/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          code: values.code,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.errno === 0) {
        message.success('注册成功，已自动登录')
        router.push('/dashboard/orders')
      } else {
        message.error(data?.errmsg || '注册失败，请检查验证码')
      }
    } catch (err) {
      console.error('register error', err)
      message.error('注册过程中发生错误，请稍后重试')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className={styles.container}>
      <Card title="注册后台账号" className={styles.card}>
        <Form
          form={form}
          name="register"
          layout="vertical"
          onFinish={onFinish}
          className={styles.form}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="姓名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item label="验证码" required>
            <div className={styles.codeRow}>
              <Form.Item
                name="code"
                noStyle
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input className={styles.codeInput} placeholder="6 位验证码" />
              </Form.Item>
              <Button
                onClick={() => void sendCode()}
                loading={codeSending}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </Button>
            </div>
            <div className={styles.helper}>验证码 10 分钟内有效</div>
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className={styles.submitButton}
              loading={registering}
            >
              注册
            </Button>
          </Form.Item>
          <div className={styles.helper}>
            已有账号？<Link href="/dashboard/login">去登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}
