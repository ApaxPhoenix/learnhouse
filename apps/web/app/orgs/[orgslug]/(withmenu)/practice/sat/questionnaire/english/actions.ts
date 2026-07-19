"use server"

import { cookies, headers } from "next/headers"
import { Pool } from "pg"

const pool = new Pool({
    connectionString: process.env.PAYLOAD_NEON_URL,
    ssl: { rejectUnauthorized: false },
})

async function getAuthToken(): Promise<string | null> {
    try {
        const cookieStore = await cookies()
        const headersList = await headers()

        let token: string | null = null

        const authHeader = headersList.get("Authorization") || headersList.get("authorization")
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            token = authHeader.substring(7).trim()
        }

        if (!token) {
            const possibleCookies = ["access_token_cookie", "token", "next-auth.session-token", "__Secure-next-auth.session-token"]
            for (const name of possibleCookies) {
                const cookieVal = cookieStore.get(name)?.value
                if (cookieVal && cookieVal !== "undefined" && cookieVal !== "null") {
                    token = cookieVal
                    break
                }
            }
        }

        return token
    } catch {
        return null
    }
}

async function getUserIdFromSession(explicitToken?: string | null): Promise<string | null> {
    const backendUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL || "http://localhost:9000"

    try {
        const token = explicitToken || await getAuthToken()
        if (!token) return null

        const sessionResponse = await fetch(`${backendUrl}/api/v1/users/session`, {
            headers: { Authorization: `Bearer ${token}` },
        })

        if (!sessionResponse.ok) return null

        const session = await sessionResponse.json()
        return session.id ?? session.user?.id ?? null
    } catch {
        return null
    }
}

export async function getEnglishQuestionsAction(options?: { domain?: string; limit?: number }) {
    try {
        const token = await getAuthToken()
        const userId = await getUserIdFromSession(token)
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || "http://localhost:3001"

        const params = new URLSearchParams()
        params.append('limit', '0')
        params.append('where[status][equals]', 'active')

        const url = `${payloadUrl}/api/questions?${params.toString()}`

        const fetchHeaders: Record<string, string> = {}
        if (token) {
            fetchHeaders["Authorization"] = `Bearer ${token}`
        }

        const response = await fetch(url, { headers: fetchHeaders })

        if (!response.ok) {
            throw new Error(`Failed to fetch questions: ${response.statusText}`)
        }

        const data = await response.json()
        const rawDocs = data.docs || []

        const uniqueDocsMap = new Map<string, any>()
        for (const doc of rawDocs) {
            if (doc && doc.id) {
                const docString = JSON.stringify(doc).toLowerCase()
                const isEnglish = docString.includes('"english"') || docString.includes(':english') || docString.includes('"reading"') || docString.includes('"writing"') || docString.includes('"verbal"')

                if (isEnglish) {
                    if (options?.domain) {
                        const searchDomain = options.domain.toLowerCase().trim()
                        const docDomain = String(doc.domain || doc.category || doc.topic || '').toLowerCase()

                        if (docDomain.includes(searchDomain) || searchDomain.includes(docDomain)) {
                            uniqueDocsMap.set(String(doc.id), doc)
                        }
                    } else {
                        uniqueDocsMap.set(String(doc.id), doc)
                    }
                }
            }
        }

        let docsArray = Array.from(uniqueDocsMap.values())

        if (options?.limit && options.limit > 0) {
            docsArray = docsArray.slice(0, options.limit)
        }

        return { success: true, docs: docsArray }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function submitEnglishAttemptAction(body: {
    questionId: string | number
    selectedOptionKey: string
    isCorrect: boolean
}) {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const { questionId, selectedOptionKey, isCorrect } = body

        const cleanQuestionId = String(questionId)
        const cleanOptionKey = String(selectedOptionKey)

        const checkDuplicate = await pool.query(
            `SELECT pick FROM english_attempts WHERE person = $1 AND item = $2`,
            [userId, cleanQuestionId]
        )

        if (checkDuplicate.rows.length > 0) {
            return { success: false, error: "Single-attempt restriction: This question cannot be modified." }
        }

        await pool.query(
            `
                INSERT INTO english_attempts (
                    person,
                    item,
                    pick,
                    pass,
                    stamp
                )
                VALUES ($1, $2, $3, $4, NOW())
            `,
            [
                userId,
                cleanQuestionId,
                cleanOptionKey,
                isCorrect
            ]
        )

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getEnglishAnalyticsAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const statsQuery = await pool.query(
            `
                SELECT
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN pass = true THEN 1 END) as total_correct
                FROM english_attempts
                WHERE person = $1
            `,
            [userId]
        )

        const historyQuery = await pool.query(
            `
                SELECT item as question_id, pick as selected_option, pass as is_correct, stamp as completed_at
                FROM english_attempts
                WHERE person = $1
                ORDER BY stamp DESC
            `,
            [userId]
        )

        return {
            success: true,
            summary: statsQuery.rows[0],
            rows: historyQuery.rows
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getRecommendationsForWrongEnglishQuestionsAction(limitPerDomain = 3) {
    try {
        const token = await getAuthToken()
        const userId = await getUserIdFromSession(token)
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const wrongAttemptsQuery = await pool.query(
            `
                SELECT DISTINCT item 
                FROM english_attempts 
                WHERE person = $1 AND pass = false
            `,
            [userId]
        )

        const wrongQuestionIds = wrongAttemptsQuery.rows.map(row => String(row.item))

        if (wrongQuestionIds.length === 0) {
            return { success: true, docs: [] }
        }

        const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || "http://localhost:3001"
        const fetchHeaders: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {}

        const response = await fetch(`${payloadUrl}/api/questions?limit=0&where[status][equals]=active`, {
            headers: fetchHeaders
        })

        if (!response.ok) throw new Error("Failed to pull questions from CMS")
        const data = await response.json()
        const allDocs = data.docs || []

        const troubledDomains = new Set<string>()
        for (const doc of allDocs) {
            if (wrongQuestionIds.includes(String(doc.id))) {
                const domain = doc.domain || doc.category || doc.topic
                if (domain) troubledDomains.add(String(domain).toLowerCase().trim())
            }
        }

        const recommendationsMap = new Map<string, any>()

        for (const domain of troubledDomains) {
            let domainCount = 0
            for (const doc of allDocs) {
                if (wrongQuestionIds.includes(String(doc.id))) continue

                const docString = JSON.stringify(doc).toLowerCase()
                const isEnglish = docString.includes('"english"') || docString.includes(':english') || docString.includes('"reading"') || docString.includes('"writing"') || docString.includes('"verbal"')
                const docDomain = String(doc.domain || doc.category || doc.topic || '').toLowerCase().trim()

                if (isEnglish && (docDomain.includes(domain) || domain.includes(docDomain))) {
                    recommendationsMap.set(String(doc.id), doc)
                    domainCount++

                    if (domainCount >= limitPerDomain) break
                }
            }
        }

        return {
            success: true,
            docs: Array.from(recommendationsMap.values()),
            targetedDomains: Array.from(troubledDomains)
        }

    } catch (err: any) {
        return { success: false, error: err.message }
    }
}