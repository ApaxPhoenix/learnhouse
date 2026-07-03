import { getAPIUrl } from './services/config/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface InstanceInfo {
  multi_org_enabled: false
  default_org_slug: string
  mode: 'oss'
  tenancy: 'single'
  frontend_domain: string
  top_domain: string
}

let _instanceCache: { data: InstanceInfo; ts: number } | null = null
const INSTANCE_CACHE_TTL = 30 * 1000

async function getInstanceInfo(): Promise<InstanceInfo> {
  if (_instanceCache && Date.now() - _instanceCache.ts < INSTANCE_CACHE_TTL) {
    return _instanceCache.data
  }

  try {
    const apiUrl = getAPIUrl()
    const res = await fetch(`${apiUrl}instance/info`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const raw = await res.json()
      _instanceCache = {
        data: {
          ...raw,
          multi_org_enabled: false,
          mode: 'oss' as const,
          tenancy: 'single' as const
        },
        ts: Date.now()
      }
      return _instanceCache.data
    }
  } catch { /* empty */ }

  return {
    multi_org_enabled: false,
    default_org_slug: 'default',
    mode: 'oss' as const,
    tenancy: 'single' as const,
    frontend_domain: 'localhost:3000',
    top_domain: 'localhost',
  }
}

interface ResolvedTenant {
  slug: string
  source: 'default'
}

function resolveTenant(instance: InstanceInfo): ResolvedTenant {
  return { slug: instance.default_org_slug, source: 'default' }
}

function setOrgCookies(response: NextResponse, resolved: ResolvedTenant) {
  response.cookies.set({
    name: 'LH_org',
    value: resolved.slug,
    domain: '',
    path: '/',
  })
}

function setInstanceCookies(response: NextResponse, info: InstanceInfo) {
  response.cookies.set({ name: 'LH_tenancy', value: info.tenancy, path: '/' })
  response.cookies.set({ name: 'LH_default_org', value: info.default_org_slug, path: '/' })
  response.cookies.set({ name: 'LH_frontend_domain', value: info.frontend_domain, path: '/' })
  response.cookies.set({ name: 'LH_top_domain', value: info.top_domain, path: '/' })
  response.cookies.set({ name: 'LH_mode', value: info.mode, path: '/' })
  return response
}

function tenantRequestHeaders(
    req: NextRequest,
    resolved: ResolvedTenant,
    instance: InstanceInfo,
): Headers {
  const headers = new Headers(req.headers)
  headers.set('x-lh-tenancy', instance.tenancy)
  headers.set('x-lh-org', resolved.slug)
  headers.set('x-lh-top-domain', instance.top_domain)
  headers.set('x-lh-frontend-domain', instance.frontend_domain)
  headers.set('x-lh-mode', instance.mode)
  return headers
}

export const config = {
  matcher: [
    '/((?!api|_next|fonts|umami|ingest|examples|embed|monitoring|[\\w-]+\\.\\w+).*)',
    '/sitemap.xml',
    '/robots.txt',
    '/podcast/:path*/feed',
  ],
}

export default async function proxy(req: NextRequest) {
  const instance = await getInstanceInfo()
  const { pathname, search } = req.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
    setInstanceCookies(response, instance)
    return response
  }

  if (pathname === '/home') {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
  }

  const authPaths = ['/login', '/signup', '/reset', '/forgot', '/verify-email']
  if (authPaths.includes(pathname)) {
    const resolved = resolveTenant(instance)
    const requestHeaders = tenantRequestHeaders(req, resolved, instance)
    const response = NextResponse.rewrite(
        new URL(`/auth${pathname}${search}`, req.url),
        { request: { headers: requestHeaders } },
    )
    setOrgCookies(response, resolved)
    setInstanceCookies(response, instance)
    return response
  }

  if (
      pathname.startsWith('/auth/sso/') ||
      pathname.startsWith('/auth/callback/') ||
      pathname.startsWith('/auth/token-exchange')
  ) {
    const response = NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
    setInstanceCookies(response, instance)
    return response
  }

  if (pathname.match(/^\/course\/[^/]+\/activity\/[^/]+\/edit$/)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url))
  }
  if (pathname.startsWith('/board/') || pathname.startsWith('/editor/playground/')) {
    const response = NextResponse.rewrite(new URL(pathname + search, req.url))
    setInstanceCookies(response, instance)
    return response
  }

  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL(`/api/health`, req.url))
  }

  if (pathname === '/redirect_from_auth') {
    const queryString = req.nextUrl.searchParams.toString()
    const redirectUrl = new URL('/', req.url)
    if (queryString) {
      redirectUrl.search = queryString
    }
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.match(/^\/podcast\/([^/]+)\/feed$/)) {
    const resolved = resolveTenant(instance)
    const feedUrl = new URL(`/api${pathname}`, req.url)
    const response = NextResponse.rewrite(feedUrl)
    response.headers.set('X-Feed-Orgslug', resolved.slug)
    return response
  }
  if (pathname.startsWith('/sitemap.xml')) {
    const resolved = resolveTenant(instance)
    const sitemapUrl = new URL(`/api/sitemap`, req.url)
    const response = NextResponse.rewrite(sitemapUrl)
    response.headers.set('X-Sitemap-Orgslug', resolved.slug)
    return response
  }
  if (pathname === '/robots.txt') {
    const resolved = resolveTenant(instance)
    const robotsUrl = new URL(`/api/robots`, req.url)
    const response = NextResponse.rewrite(robotsUrl)
    response.headers.set('X-Robots-Orgslug', resolved.slug)
    return response
  }

  const resolved = resolveTenant(instance)
  const requestHeaders = tenantRequestHeaders(req, resolved, instance)
  const response = NextResponse.rewrite(
      new URL(`/orgs/${resolved.slug}${pathname}`, req.url),
      { request: { headers: requestHeaders } },
  )
  setOrgCookies(response, resolved)
  setInstanceCookies(response, instance)
  return response
}