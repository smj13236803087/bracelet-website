'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DeleteOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
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
import { orderStatusLabel, OrderStatus } from '@/types/order'

type OrderRow = {
  id: string
  orderNo: string
  status: OrderStatus
  designName: string | null
  totalPrice: number
  carrier: string | null
  trackingNumber: string | null
  previewItemName: string | null
  shopifyOrderId: string | null
  shopifyOrderName: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    name: string | null
  }
}

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'PENDING_PAYMENT', label: '待支付' },
  { value: 'PENDING_SHIPMENT', label: '待发货' },
  { value: 'PENDING_RECEIPT', label: '待收货' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
]

const CARRIER_OPTIONS = [
  '顺丰速运',
  '中通快递',
  '圆通速递',
  '韵达快递',
  '申通快递',
  'EMS',
  '京东物流',
  '德邦快递',
  '其他',
]

function statusTag(status: OrderStatus) {
  const color =
    status === 'PENDING_PAYMENT'
      ? 'orange'
      : status === 'PENDING_SHIPMENT'
        ? 'blue'
        : status === 'PENDING_RECEIPT'
          ? 'cyan'
          : status === 'COMPLETED'
            ? 'green'
            : 'default'
  return <Tag color={color}>{orderStatusLabel(status)}</Tag>
}

type ShipFormValues = {
  carrier: string
  trackingNumber: string
  notifyCustomer: boolean
}

export default function DashboardOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all')
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
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [sortConfig, setSortConfig] = useState<DatetimeSortState | null>(
    defaultNaturalListSort()
  )
  const [shipTarget, setShipTarget] = useState<OrderRow | null>(null)
  const [shipping, setShipping] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const [shipForm] = Form.useForm<ShipFormValues>()

  const queryKey = useMemo(() => {
    const sp = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all') sp.set('status', statusFilter)
    const q = (hasSearch ? newSearchValue : oldSearchValue).trim()
    const field = (hasSearch ? newSearchType : oldSearchType).trim()
    if (q) sp.set('q', q)
    if (field && field !== 'all') sp.set('field', field)
    if (sortConfig) sp.set('sort', `${sortConfig.key}:${sortConfig.order}`)
    sp.set('page', String(pagination.current))
    sp.set('pageSize', String(pagination.pageSize))
    return sp.toString()
  }, [
    statusFilter,
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
      const res = await fetch(`/api/admin/orders?${queryKey}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || `加载失败（${res.status}）`)
        setOrders([])
        return
      }
      setOrders(json?.orders || [])
      setPagination((p) => ({ ...p, total: json?.total || 0 }))
    } catch (e) {
      setError(`加载失败：${String(e)}`)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const openShip = (row: OrderRow) => {
    setShipTarget(row)
    shipForm.setFieldsValue({
      carrier: '顺丰速运',
      trackingNumber: '',
      notifyCustomer: true,
    })
  }

  const submitShip = async () => {
    if (!shipTarget) return
    const values = await shipForm.validateFields()
    setShipping(true)
    try {
      const res = await fetch(`/api/admin/orders/${shipTarget.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        message.error(json?.error || '发货失败')
        return
      }
      message.success('发货成功，已同步至 Shopify 并通知客户')
      setShipTarget(null)
      void load()
    } catch (e) {
      message.error(`发货失败：${String(e)}`)
    } finally {
      setShipping(false)
    }
  }

  const deleteOrder = async (row: OrderRow) => {
    setDeleteLoadingId(row.id)
    try {
      const res = await fetch(`/api/admin/orders/${row.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        message.error(json?.error || '删除失败')
        return
      }
      message.success('订单已删除，Shopify 端已取消并删除')
      void load()
    } catch (e) {
      message.error(`删除失败：${String(e)}`)
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const columns: ColumnsType<OrderRow> = [
    { title: '订单号', dataIndex: 'orderNo', width: 150 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: OrderStatus) => statusTag(v),
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, row) => (
        <div>
          <div>{row.user.email}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>{row.user.name || '-'}</div>
        </div>
      ),
    },
    {
      title: '设计名称',
      dataIndex: 'designName',
      width: 140,
      render: (v, row) => v || row.previewItemName || '-',
    },
    {
      title: '金额',
      dataIndex: 'totalPrice',
      width: 100,
      render: (v) => `¥${Number(v).toFixed(2)}`,
    },
    {
      title: '快递',
      key: 'shipping',
      width: 160,
      render: (_, row) =>
        row.carrier || row.trackingNumber ? (
          <div>
            <div>{row.carrier || '-'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {row.trackingNumber || '-'}
            </div>
          </div>
        ) : (
          '-'
        ),
    },
    {
      title: 'Shopify',
      dataIndex: 'shopifyOrderName',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: datetimeSortTitle('创建时间', 'createdAt', sortConfig, handleDatetimeSort),
      dataIndex: 'createdAt',
      width: 170,
      render: (v) => formatDashboardDateTime(v),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            disabled={row.status !== 'PENDING_SHIPMENT'}
            onClick={() => openShip(row)}
          >
            发货
          </Button>
          <Popconfirm
            title="删除订单"
            description="将先取消并删除 Shopify 订单，再删除本地记录。确定继续？"
            onConfirm={() => void deleteOrder(row)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteLoadingId === row.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        订单管理
      </Typography.Title>

      <Space wrap>
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPagination((p) => ({ ...p, current: 1 }))
          }}
          style={{ width: 140 }}
          options={STATUS_OPTIONS}
        />
        <Space.Compact style={{ width: 480, maxWidth: '100%' }}>
          <Select
            value={newSearchType}
            onChange={setNewSearchType}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部字段' },
              { value: 'orderNo', label: '订单号' },
              { value: 'userEmail', label: '用户邮箱' },
              { value: 'trackingNumber', label: '快递单号' },
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
      </Space>

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
        dataSource={orders}
        scroll={{ x: 1500 }}
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
        title={`发货 - ${shipTarget?.orderNo || ''}`}
        open={!!shipTarget}
        onCancel={() => setShipTarget(null)}
        onOk={() => void submitShip()}
        confirmLoading={shipping}
        destroyOnClose
      >
        <Form form={shipForm} layout="vertical">
          <Form.Item
            name="carrier"
            label="快递公司"
            rules={[{ required: true, message: '请选择快递公司' }]}
          >
            <Select
              showSearch
              options={CARRIER_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>
          <Form.Item
            name="trackingNumber"
            label="快递单号"
            rules={[{ required: true, message: '请填写快递单号' }]}
          >
            <Input placeholder="运单号" />
          </Form.Item>
          <Form.Item name="notifyCustomer" valuePropName="checked">
            <Checkbox>向客户发送发货通知（Shopify）</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
