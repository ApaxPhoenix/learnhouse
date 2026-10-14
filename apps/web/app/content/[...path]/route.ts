import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

// Course thumbnails, videos, PDFs etc. are served by the API at /content/*.
// In the single-container deployment only Next.js is reachable from outside,
// so forward these the same way /api/v1 is forwarded. Range headers pass
// through untouched, so video seeking keeps working.
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  return proxyToBackend(request)
}

export async function HEAD(request: NextRequest) {
  return proxyToBackend(request)
}
