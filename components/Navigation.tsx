'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid3x3, ShoppingCart, User } from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/square', label: '广场', icon: Grid3x3 },
  { href: '/cart', label: '配方', icon: ShoppingCart },
  { href: '/profile', label: '我的', icon: User },
]

export default function Navigation() {
  const pathname = usePathname()

  if (pathname?.startsWith('/dashboard')) {
    return null
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
