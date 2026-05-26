'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { trackPageView } from '@/lib/analytics'

/** Fires page_view when the route changes (consent-gated in analytics module). */
export function AnalyticsPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const path = searchParams.size > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    if (lastPath.current === path) return
    lastPath.current = path
    trackPageView(path)
  }, [pathname, searchParams])

  return null
}
