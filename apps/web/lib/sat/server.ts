// Server-only helpers for the SAT practice actions. Imported exclusively by
// "use server" modules — never from client components.
import { Pool } from 'pg'
import { getConfig, getServerAPIUrl } from '@services/config/config'
import { getServerSession } from '@/lib/auth/server'
import { normalizeQuestion, type SatQuestion, type Section } from './sat'

// ── Database ─────────────────────────────────────────────────────────────────
// One pool for every practice action (user_attempts / user_test_sessions live
// in the Payload Neon database, see app/orgs/[orgslug]/(withmenu)/practice/schema.sql).
// Reused across dev HMR.
const globalForPool = globalThis as unknown as { satPool?: Pool }

export const pool =
  globalForPool.satPool ??
  new Pool({
    connectionString: process.env.PAYLOAD_NEON_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    // Fail fast instead of hanging a request if Neon is unreachable/asleep.
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
    idleTimeoutMillis: 30_000,
  })

if (process.env.NODE_ENV !== 'production') globalForPool.satPool = pool

// ── Session ──────────────────────────────────────────────────────────────────

/** LearnHouse user id of the signed-in user (stored as text in user_attempts). */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession()
  const id = session?.user?.id
  return id === undefined || id === null ? null : String(id)
}

export interface OrgAdminContext {
  orgId: number
  accessToken: string
}

/**
 * Resolves the org by slug and checks the caller may see org-wide practice
 * data: superadmin, or a role in this org with dashboard access (the same rule
 * as useAdminStatus on the client). Returns null for everyone else.
 */
export async function getOrgAdminContext(orgslug: string): Promise<OrgAdminContext | null> {
  const session = await getServerSession()
  const accessToken = session?.tokens?.access_token
  if (!session?.user || !accessToken) return null

  const res = await fetch(`${getServerAPIUrl()}orgs/slug/${encodeURIComponent(orgslug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const org = await res.json()

  const roles = (session.roles ?? []) as any[]
  const canAccess =
    session.user.is_superadmin === true ||
    roles.some((r) => r?.org?.id === org.id && r?.role?.rights?.dashboard?.action_access === true)
  return canAccess ? { orgId: org.id, accessToken } : null
}

export interface OrgMember {
  name: string
  email: string
  username: string
}

/** Org members by user id, paged through the API with the admin's token. */
export async function getOrgMembers(ctx: OrgAdminContext): Promise<Map<string, OrgMember>> {
  const members = new Map<string, OrgMember>()
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${getServerAPIUrl()}orgs/${ctx.orgId}/users?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) break
    const data = await res.json()
    for (const item of data.items ?? []) {
      const u = item.user
      if (!u?.id) continue
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
      members.set(String(u.id), {
        name: name || u.username || `User ${u.id}`,
        email: u.email ?? '',
        username: u.username ?? '',
      })
    }
    if (!data.items?.length || page * 100 >= (data.total ?? 0)) break
  }
  return members
}

// ── Payload CMS ──────────────────────────────────────────────────────────────
// Both read at runtime so a Docker image works on any domain.
const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** Public CMS URL — used for anything the browser loads (images). */
export const payloadPublicUrl = () =>
  trimSlash(getConfig('NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL', 'http://localhost:3001'))

/** URL this server uses to reach the CMS (container-internal when set). */
const payloadServerUrl = () =>
  trimSlash(getConfig('LEARNHOUSE_INTERNAL_PAYLOAD_URL') || payloadPublicUrl())

interface QuestionIndex {
  list: SatQuestion[]
  byId: Map<string, SatQuestion>
}

// The whole active question bank is small (~2.5k items), so keep one
// normalized copy in memory instead of re-downloading it on every request.
const CACHE_TTL_MS = 5 * 60_000
let cache: { at: number; index: QuestionIndex } | null = null
let inflight: Promise<QuestionIndex> | null = null

async function downloadQuestions(): Promise<QuestionIndex> {
  const params = new URLSearchParams({
    limit: '0',
    depth: '0',
    'where[status][equals]': 'active',
  })
  const response = await fetch(`${payloadServerUrl()}/api/questions?${params}`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Question bank unavailable (${response.status})`)
  const data = await response.json()
  const media = payloadPublicUrl()
  const list = (data.docs ?? [])
    .map((doc: unknown) => normalizeQuestion(doc, media))
    .filter((q: SatQuestion | null): q is SatQuestion => q !== null)
  return { list, byId: new Map(list.map((q: SatQuestion) => [q.id, q])) }
}

export async function getQuestionIndex(): Promise<QuestionIndex> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.index
  if (!inflight) {
    inflight = downloadQuestions()
      .then((index) => {
        cache = { at: Date.now(), index }
        return index
      })
      .catch((error) => {
        // CMS hiccup: keep serving the last good copy if we have one.
        if (cache) return cache.index
        throw error
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export interface QuestionFilter {
  section: Section
  domain?: string | null
  skill?: string | null
}

export async function findQuestions({ section, domain, skill }: QuestionFilter) {
  const { list } = await getQuestionIndex()
  return list.filter(
    (q) =>
      q.section === section && (!domain || q.domain === domain) && (!skill || q.skill === skill)
  )
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const UNAUTHORIZED = { success: false as const, unauthorized: true as const }

export function failure(error: unknown) {
  console.error('[sat-practice]', error)
  return {
    success: false as const,
    unauthorized: false as const,
    error: error instanceof Error ? error.message : 'Something went wrong',
  }
}
