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


export async function getMathQuestionsAction(options?: { domain?: string; limit?: number }) {
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
                const isMath = docString.includes('"math"') || docString.includes(':math') || docString.includes('"mathematics"')

                if (isMath) {
                    // 3. Similar Questions Filter: Match by domain/category if provided
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

export async function submitMathAttemptAction(body: {
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
            `SELECT selected_option FROM math_attempts WHERE user_id = $1 AND question_id = $2`,
            [userId, cleanQuestionId]
        )

        if (checkDuplicate.rows.length > 0) {
            return { success: false, error: "Single-attempt restriction: This question cannot be modified." }
        }

        await pool.query(
            `
                INSERT INTO math_attempts (
                    user_id,
                    question_id,
                    selected_option,
                    is_correct,
                    completed_at
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

export async function getMathAnalyticsAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const statsQuery = await pool.query(
            `
                SELECT
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN is_correct = true THEN 1 END) as total_correct
                FROM math_attempts
                WHERE user_id = $1
            `,
            [userId]
        )

        const historyQuery = await pool.query(
            `
                SELECT question_id, selected_option, is_correct, completed_at
                FROM math_attempts
                WHERE user_id = $1
                ORDER BY completed_at DESC
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