'use client'

import React from 'react'
import { createCache, StyleProvider } from '@ant-design/cssinjs'

const cache = createCache()

export default function AntdRegistry({ children }: React.PropsWithChildren) {
  return <StyleProvider cache={cache}>{children}</StyleProvider>
}
