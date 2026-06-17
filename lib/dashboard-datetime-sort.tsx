'use client'

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

export type DatetimeSortKey = 'createdAt' | 'updatedAt'

export type DatetimeSortState = {
  key: DatetimeSortKey
  order: 'asc' | 'desc'
}

export function defaultNaturalListSort(): null {
  return null
}

export function toggleDatetimeSort(
  prev: DatetimeSortState | null,
  key: DatetimeSortKey
): DatetimeSortState {
  if (prev === null) return { key, order: 'desc' }
  if (prev.key === key) return { key, order: prev.order === 'desc' ? 'asc' : 'desc' }
  return { key, order: 'desc' }
}

export function datetimeSortTitle(
  label: string,
  key: DatetimeSortKey,
  sortConfig: DatetimeSortState | null,
  onSort: (k: DatetimeSortKey) => void
) {
  const sk = sortConfig?.key ?? ''
  const so = sortConfig?.order ?? 'desc'
  const active = Boolean(sk) && sk === key
  return (
    <span
      style={{
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        color: active ? '#1677ff' : 'inherit',
      }}
      onClick={() => onSort(key)}
    >
      {label}
      {active ? (
        so === 'desc' ? (
          <ArrowDownOutlined style={{ marginLeft: 6, color: '#1677ff', fontSize: 12 }} />
        ) : (
          <ArrowUpOutlined style={{ marginLeft: 6, color: '#1677ff', fontSize: 12 }} />
        )
      ) : (
        <ArrowDownOutlined style={{ marginLeft: 6, color: '#666', fontSize: 12 }} />
      )}
    </span>
  )
}

export function formatDashboardDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN', { hour12: false })
}
