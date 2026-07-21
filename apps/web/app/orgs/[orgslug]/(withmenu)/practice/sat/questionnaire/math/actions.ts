"use server"

import { cookies, headers } from "next/headers"
import { Pool } from "pg"

const pool = new Pool({
    connectionString: process.env.PAYLOAD_NEON_URL,
    ssl: { rejectUnauthorized: false },
})

async function getAuthContext(): Promise<{ token: string | null; rawCookies: string | null }> {
    try {
        const cookieStore = await cookies()
        const headersList = await headers()

        let token: string | null = null

        const authHeader = headersList.get("Authorization") || headersList.get("authorization")
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            token = authHeader.substring(7).trim()
        }

        const allCookies = cookieStore.getAll()
        const rawCookies = allCookies.map(c => `${c.name}=${c.value}`).join("; ")

        if (!token) {
            const possibleCookies = [
                "access_token_cookie",
                "token",
                "next-auth.session-token",
                "__Secure-next-auth.session-token",
                "session"
            ]
            for (const name of possibleCookies) {
                const cookieVal = cookieStore.get(name)?.value
                if (cookieVal && cookieVal !== "undefined" && cookieVal !== "null") {
                    token = cookieVal
                    break
                }
            }
        }

        return { token, rawCookies: rawCookies || null }
    } catch {
        return { token: null, rawCookies: null }
    }
}

async function getUserIdFromSession(explicitToken?: string | null): Promise<string | null> {
    const backendUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL || "http://localhost:9000"

    try {
        const { token: extractedToken, rawCookies } = await getAuthContext()
        const token = explicitToken || extractedToken

        const requestHeaders: Record<string, string> = {}
        if (token) requestHeaders["Authorization"] = `Bearer ${token}`
        if (rawCookies) requestHeaders["Cookie"] = rawCookies

        if (!token && !rawCookies) return null

        const sessionResponse = await fetch(`${backendUrl}/api/v1/users/session`, {
            headers: requestHeaders,
            cache: "no-store",
        })

        if (!sessionResponse.ok) return null

        const session = await sessionResponse.json()
        return session.id ?? session.user?.id ?? null
    } catch {
        return null
    }
}

export async function getMathQuestionsAction(
    options?: { domain?: string; limit?: number },
    explicitToken?: string | null
) {
    try {
        const { token: extractedToken, rawCookies } = await getAuthContext()
        const token = explicitToken || extractedToken
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
        if (token) fetchHeaders["Authorization"] = `Bearer ${token}`
        if (rawCookies) fetchHeaders["Cookie"] = rawCookies

        const response = await fetch(url, { headers: fetchHeaders })

        if (!response.ok) {
            throw new Error(`Failed to fetch questions: ${response.statusText}`)
        }

        const data = await response.json()
        const rawDocs = data.docs || []

        const getImageUrl = (img: any): string | null => {
            if (!img) return null
            if (typeof img === 'string') {
                return img.startsWith('/') ? `${payloadUrl}${img}` : img
            }
            const urlStr = img.url || img.src || img.filename
            if (urlStr) {
                return urlStr.startsWith('/') ? `${payloadUrl}${urlStr}` : urlStr
            }
            return null
        }

        const uniqueDocsMap = new Map<string, any>()
        for (const doc of rawDocs) {
            if (doc && doc.id) {
                const docString = JSON.stringify(doc).toLowerCase()
                const isMath = doc.section === 'math' ||
                    docString.includes('"math"') ||
                    docString.includes(':math') ||
                    docString.includes('"mathematics"')

                if (isMath) {
                    const imgUrl = getImageUrl(doc.image || doc.stimulusImage || doc.stimulus_image || doc.media)
                    if (imgUrl && typeof doc.stimulus === 'string' && !doc.stimulus.includes(imgUrl)) {
                        doc.stimulus = `![Stimulus Image](${imgUrl})\n\n${doc.stimulus}`
                    }

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

export async function submitMathAttemptAction(
    body: {
        questionId: string | number
        selectedOptionKey: string
        isCorrect: boolean
        timeSpentSeconds?: number
        testSessionId?: string
    },
    explicitToken?: string | null
) {
    try {
        const userId = await getUserIdFromSession(explicitToken)
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const { questionId, selectedOptionKey, isCorrect, timeSpentSeconds, testSessionId } = body
        const cleanQuestionId = String(questionId)
        const cleanOptionKey = String(selectedOptionKey)
        const cleanSessionId = testSessionId ? String(testSessionId) : null

        const checkDuplicate = await pool.query(
            `SELECT selected_option_key FROM user_attempts WHERE user_id = $1 AND question_id = $2 AND section = 'math'`,
            [userId, cleanQuestionId]
        )

        if (checkDuplicate.rows.length > 0) {
            return { success: false, error: "Single-attempt restriction: This question cannot be modified." }
        }

        await pool.query(
            `
                INSERT INTO user_attempts (
                    user_id,
                    question_id,
                    section,
                    selected_option_key,
                    is_correct,
                    time_spent_seconds,
                    test_session_id
                )
                VALUES ($1, $2, 'math', $3, $4, $5, $6)
            `,
            [
                userId,
                cleanQuestionId,
                cleanOptionKey,
                isCorrect,
                timeSpentSeconds ?? 0,
                cleanSessionId
            ]
        )

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getMathAnalyticsAction(explicitToken?: string | null) {
    try {
        const userId = await getUserIdFromSession(explicitToken)
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const statsQuery = await pool.query(
            `
                SELECT
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN is_correct = true THEN 1 END) as total_correct
                FROM user_attempts
                WHERE user_id = $1 AND section = 'math'
            `,
            [userId]
        )

        const historyQuery = await pool.query(
            `
                SELECT question_id, selected_option_key AS selected_option, is_correct, created_at AS completed_at
                FROM user_attempts
                WHERE user_id = $1 AND section = 'math'
                ORDER BY created_at DESC
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