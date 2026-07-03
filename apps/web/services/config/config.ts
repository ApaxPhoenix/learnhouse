import { NextResponse } from 'next/server'

let runtimeConfig: Record<string, string> | null = null
let serverConfigLoaded = false

function loadRuntimeConfig(): Record<string, string> {
  if (typeof window !== 'undefined') {
    if ((window as any).__RUNTIME_CONFIG__) {
      runtimeConfig = (window as any).__RUNTIME_CONFIG__
    }
    return runtimeConfig || {}
  }

  if (serverConfigLoaded && runtimeConfig) {
    return runtimeConfig
  }

  runtimeConfig = {}

  if (typeof window === 'undefined') {
    try {
      const fs = require('fs')
      const path = require('path')

      const possiblePaths = [
        path.join(process.cwd(), 'runtime-config.json'),
        path.join(__dirname || process.cwd(), 'runtime-config.json'),
        path.join(__dirname || process.cwd(), '..', 'runtime-config.json'),
      ]

      for (const configPath of possiblePaths) {
        try {
          if (fs.existsSync(configPath)) {
            runtimeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
            break
          }
        } catch {}
      }
    } catch {}
    serverConfigLoaded = true
  }

  return runtimeConfig || {}
}

export const getConfig = (key: string, defaultValue: string = ''): string => {
  const config = loadRuntimeConfig()
  if (config && config[key]) {
    return config[key]
  }
  return process.env[key] || defaultValue
}

const getCookieValue = (name: string): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

const getLEARNHOUSE_HTTP_PROTOCOL = () =>
    (getConfig('NEXT_PUBLIC_LEARNHOUSE_HTTPS') === 'true') ? 'https://' : 'http://'
const getLEARNHOUSE_BACKEND_URL = () => getConfig('NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL', 'http://localhost/')
const getLEARNHOUSE_DOMAIN = () => {
  const envVal = getConfig('NEXT_PUBLIC_LEARNHOUSE_DOMAIN')
  if (envVal) return envVal
  const cookieVal = getCookieValue('LH_frontend_domain')
  if (cookieVal) return cookieVal
  return 'localhost'
}
const getLEARNHOUSE_TOP_DOMAIN = () => {
  const envVal = getConfig('NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN')
  if (envVal) return envVal
  const cookieVal = getCookieValue('LH_top_domain')
  if (cookieVal) return cookieVal
  const domain = getLEARNHOUSE_DOMAIN()
  return domain.split(':')[0]
}
const getPOSTHOG_KEY = () => getConfig('NEXT_PUBLIC_POSTHOG_KEY', '')

export const getLEARNHOUSE_HTTP_PROTOCOL_VAL = getLEARNHOUSE_HTTP_PROTOCOL
export const getLEARNHOUSE_BACKEND_URL_VAL = getLEARNHOUSE_BACKEND_URL
export const getLEARNHOUSE_DOMAIN_VAL = getLEARNHOUSE_DOMAIN
export const getLEARNHOUSE_TOP_DOMAIN_VAL = getLEARNHOUSE_TOP_DOMAIN
export const getPOSTHOG_KEY_VAL = getPOSTHOG_KEY

export const LEARNHOUSE_HTTP_PROTOCOL = getLEARNHOUSE_HTTP_PROTOCOL()
export const LEARNHOUSE_BACKEND_URL = getLEARNHOUSE_BACKEND_URL()
export const LEARNHOUSE_DOMAIN = getLEARNHOUSE_DOMAIN()
export const LEARNHOUSE_TOP_DOMAIN = getLEARNHOUSE_TOP_DOMAIN()

const deriveAPIUrl = (): string => {
  const explicitApiUrl = getConfig('NEXT_PUBLIC_LEARNHOUSE_API_URL')
  if (explicitApiUrl) return explicitApiUrl
  const backendUrl = getLEARNHOUSE_BACKEND_URL().replace(/\/+$/, '')
  return `${backendUrl}/api/v1/`
}

export const getAPIUrl = () => {
  return deriveAPIUrl()
}

export const getServerAPIUrl = () => {
  return deriveAPIUrl()
}

export const getBackendUrl = () => getLEARNHOUSE_BACKEND_URL()

export type TenancyMode = 'multi' | 'single'

export const getTenancy = (): TenancyMode => {
  return 'single'
}

export const isMultiOrgModeEnabled = () => false

export const getCustomDomainFromContext = (): string | null => {
  return null
}

export const getUriWithOrg = (orgslug: string, path: string) => {
  return path
}

export const getUriWithoutOrg = (path: string) => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  const explicitDomain = getConfig('NEXT_PUBLIC_LEARNHOUSE_DOMAIN')
  if (explicitDomain) {
    const protocol = getLEARNHOUSE_HTTP_PROTOCOL()
    return `${protocol}${explicitDomain}${path}`
  }
  return path
}

export const getMainDomainUri = (path: string) => {
  const protocol = getLEARNHOUSE_HTTP_PROTOCOL()
  const domain = getLEARNHOUSE_DOMAIN()
  return `${protocol}${domain}${path}`
}

export type DeploymentMode = 'saas' | 'oss' | 'ee'

export const getDeploymentMode = (): DeploymentMode => {
  return 'oss'
}

export const isOSSMode = (): boolean => {
  return true
}

export const isEEAvailable = (): boolean => {
  return false
}

export const getCollabUrl = () => getConfig('NEXT_PUBLIC_COLLAB_URL', 'ws://localhost:4000')

export const getDefaultOrg = () => {
  const envVal = getConfig('NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG')
  if (envVal) return envVal
  const cookieVal = getCookieValue('LH_default_org')
  if (cookieVal) return cookieVal
  return 'default'
}

// Fallback stubs for missing features in OSS mode
export const getPlatformUrl = (path: string = ''): string | null => {
  return null
}

export const getUpgradeUrl = (orgSlug?: string): string | null => {
  return null
}