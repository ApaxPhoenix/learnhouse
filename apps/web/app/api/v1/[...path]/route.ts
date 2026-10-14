import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

// Allow large file uploads (videos, SCORM packages) to pass through
export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  return proxyToBackend(request)
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request)
}

export async function PUT(request: NextRequest) {
  return proxyToBackend(request)
}

export async function PATCH(request: NextRequest) {
  return proxyToBackend(request)
}

export async function DELETE(request: NextRequest) {
  return proxyToBackend(request)
}
