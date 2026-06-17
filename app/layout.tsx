import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import AntdRegistry from '@/lib/AntdRegistry'

export const metadata: Metadata = {
  title: '手串定制网站',
  description: '定制你的专属手串',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <AntdRegistry>
          <Navigation />
          {children}
        </AntdRegistry>
      </body>
    </html>
  )
}
