'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  datetimeSortTitle,
  defaultNaturalListSort,
  formatDashboardDateTime,
  toggleDatetimeSort,
  type DatetimeSortState,
} from '@/lib/dashboard-datetime-sort'

type UserRow = {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'SUPER_ADMIN'
  shopifyCustomerId: string | null
  shopifyEmail: string | null
  orderCount: number
  designCount: number
  createdAt: string
  updatedAt: string
}

type UserFormValues = {
  email: string
  name: string
  password?: string
  role: 'USER' | 'SUPER_ADMIN'
}

function roleTag(role: UserRow['role']) {
  if (role === 'SUPER_ADMIN') {
    return <Tag color="gold">超级管理员</Tag>
  }
  return <Tag color="blue">普通用户</Tag>
}

export default function DashboardUsersPage() {
  const [newSearchType, setNewSearchType] = useState('all')
  const [oldSearchType, setOldSearchType] = useState('all')
  const [newSearchValue, setNewSearchValue] = useState('')
  const [oldSearchValue, setOldSearchValue] = useState('')
  const [hasSearch, setHasSearch] = useState(false)

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [sortConfig, setSortConfig] = useState<DatetimeSortState | null>(
    defaultNaturalListSort()
  )
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form] = Form.useForm<UserFormValues>()

  const queryKey = useMemo(() => {
    const sp = new URLSearchParams()
    const q = (hasSearch ? newSearchValue : oldSearchValue).trim()
    const field = (hasSearch ? newSearchType : oldSearchType).trim()
    if (q) sp.set('q', q)
    if (field && field !== 'all') sp.set('field', field)
    if (sortConfig) sp.set('sort', `${sortConfig.key}:${sortConfig.order}`)
    sp.set('page', String(pagination.current))
    sp.set('pageSize', String(pagination.pageSize))
    return sp.toString()
  }, [
    hasSearch,
    newSearchValue,
    oldSearchValue,
    newSearchType,
    oldSearchType,
    pagination.current,
    pagination.pageSize,
    sortConfig?.key,
    sortConfig?.order,
  ])

  const handleDatetimeSort = (key: DatetimeSortState['key']) => {
    setSortConfig((prev) => toggleDatetimeSort(prev, key))
    setPagination((p) => ({ ...p, current: 1 }))
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users?${queryKey}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || `加载失败（${res.status}）`)
        setUsers([])
        return
      }
      setUsers(json?.users || [])
      setPagination((p) => ({ ...p, total: json?.total || 0 }))
    } catch (e) {
      setError(`加载失败：${String(e)}`)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ email: '', name: '', password: '', role: 'USER' })
    setModalOpen(true)
  }

  const openEdit = (row: UserRow) => {
    setEditing(row)
    form.setFieldsValue({
      email: row.email,
      name: row.name || '',
      password: '',
      role: row.role,
    })
    setModalOpen(true)
  }

  const submitForm = async () => {
    const values = await form.validateFields()
    const payload = {
      email: values.email.trim().toLowerCase(),
      name: values.name.trim(),
      role: values.role,
      ...(values.password?.trim() ? { password: values.password.trim() } : {}),
    }

    setSaving(true)
    try {
      const url = editing ? `/api/admin/users/${editing.id}` : '/api/admin/users'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        message.error(json?.error || '保存失败')
        return
      }
      message.success(editing ? '更新成功' : '创建成功')
      setModalOpen(false)
      void load()
    } catch (e) {
      message.error(`保存失败：${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        message.error(json?.error || '删除失败')
        return
      }
      message.success('已彻底删除用户及其关联数据')
      setDeleteTarget(null)
      void load()
    } catch (e) {
      message.error(`删除失败：${String(e)}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: ColumnsType<UserRow> = [
    { title: 'ID', dataIndex: 'id', width: 220, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    { title: '姓名', dataIndex: 'name', width: 120, render: (v) => v || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (v: UserRow['role']) => roleTag(v),
    },
    {
      title: 'Shopify 客户',
      dataIndex: 'shopifyCustomerId',
      width: 140,
      render: (v) => v || '-',
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      width: 80,
    },
    {
      title: '作品数',
      dataIndex: 'designCount',
      width: 80,
    },
    {
      title: datetimeSortTitle('创建时间', 'createdAt', sortConfig, handleDatetimeSort),
      dataIndex: 'createdAt',
      width: 170,
      render: (v) => formatDashboardDateTime(v),
    },
    {
      title: datetimeSortTitle('更新时间', 'updatedAt', sortConfig, handleDatetimeSort),
      dataIndex: 'updatedAt',
      width: 170,
      render: (v) => formatDashboardDateTime(v),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setDeleteTarget(row)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          用户管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增用户
        </Button>
      </div>

      <Space.Compact style={{ width: '100%', maxWidth: 640 }}>
        <Select
          value={newSearchType}
          onChange={setNewSearchType}
          style={{ width: 120 }}
          options={[
            { value: 'all', label: '全部字段' },
            { value: 'email', label: '邮箱' },
            { value: 'name', label: '姓名' },
            { value: 'id', label: 'ID' },
            { value: 'role', label: '角色' },
          ]}
        />
        <Input
          placeholder="搜索"
          value={newSearchValue}
          onChange={(e) => setNewSearchValue(e.target.value)}
          onPressEnter={() => {
            setHasSearch(true)
            setOldSearchType(newSearchType)
            setOldSearchValue(newSearchValue)
            setPagination((p) => ({ ...p, current: 1 }))
          }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={() => {
            setHasSearch(true)
            setOldSearchType(newSearchType)
            setOldSearchValue(newSearchValue)
            setPagination((p) => ({ ...p, current: 1 }))
          }}
        >
          搜索
        </Button>
      </Space.Compact>

      {error && (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fff1f2',
            padding: 12,
            borderRadius: 8,
            color: '#be123c',
          }}
        >
          {error}
        </div>
      )}

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        scroll={{ x: 1400 }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (current, pageSize) =>
            setPagination((p) => ({ ...p, current, pageSize })),
        }}
      />

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submitForm()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              options={[
                { value: 'USER', label: '普通用户' },
                { value: 'SUPER_ADMIN', label: '超级管理员' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '新密码（留空则不修改）' : '密码'}
            rules={
              editing
                ? []
                : [
                    { required: true, message: '请输入密码' },
                    { min: 8, message: '密码至少 8 位' },
                  ]
            }
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="彻底删除用户"
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => void confirmDelete()}
        confirmLoading={deleteLoading}
        okText="确认删除"
        okButtonProps={{ danger: true }}
      >
        <p>
          确定要彻底删除用户 <strong>{deleteTarget?.email}</strong> 吗？
        </p>
        <p style={{ color: '#be123c' }}>
          将同时删除该用户的所有订单、作品集，并尝试取消/删除 Shopify 端关联订单。此操作不可恢复。
        </p>
      </Modal>
    </div>
  )
}
