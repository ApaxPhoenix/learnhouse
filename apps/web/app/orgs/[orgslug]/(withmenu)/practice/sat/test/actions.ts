"use server"

import { headers } from "next/headers"
import { Pool } from "pg"

const pool = new Pool({
    connectionString: process.env.PAYLOAD_NEON_URL,
    ssl: { rejectUnauthorized: false },
})

async function getUserIdFromSession(): Promise<string | null> {
    const backendUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL || "http://localhost:9000"

    try {
        const incomingHeaders = await headers()
        const cookieHeader = incomingHeaders.get("cookie")
        const authHeader = incomingHeaders.get("Authorization") || incomingHeaders.get("authorization")

        const requestHeaders: Record<string, string> = {}
        if (cookieHeader) requestHeaders["cookie"] = cookieHeader
        if (authHeader) requestHeaders["Authorization"] = authHeader

        if (!cookieHeader && !authHeader) {
            return null
        }

        const sessionResponse = await fetch(`${backendUrl}/api/v1/users/session`, {
            headers: requestHeaders,
            cache: "no-store",
        })

        if (!sessionResponse.ok) {
            return null
        }

        const session = await sessionResponse.json()
        return session.id ?? session.user?.id ?? null
    } catch {
        return null
    }
}

export async function getQuestionsAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || "http://localhost:3001"

        const params = new URLSearchParams()
        params.append('limit', '0')
        params.append('where[status][equals]', 'active')

        const url = `${payloadUrl}/api/questions?${params.toString()}`
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Failed to fetch questions: ${response.statusText}`)
        }

        const data = await response.json()
        const rawDocs = data.docs || []

        const uniqueDocsMap = new Map<string, any>()
        for (const doc of rawDocs) {
            if (doc && doc.id) {
                uniqueDocsMap.set(String(doc.id), doc)
            }
        }

        return { success: true, docs: Array.from(uniqueDocsMap.values()) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function submitAttemptAction(body: {
    questionId: string | number
    selectedOptionKey: string
    isCorrect: boolean
    timeSpentSeconds?: number
    testSessionId?: string
}) {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const { questionId, selectedOptionKey, isCorrect, timeSpentSeconds, testSessionId } = body

        const cleanQuestionId = String(questionId)
        const cleanOptionKey = String(selectedOptionKey)
        const cleanSessionId = testSessionId ? String(testSessionId) : null

        await pool.query(
            `
                INSERT INTO user_attempts (
                    user_id,
                    question_id,
                    selected_option_key,
                    is_correct,
                    time_spent_seconds,
                    test_session_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
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

export async function submitTestSessionAction(body: {
    testSessionId: string
    englishCorrect: number
    englishTotal: number
    mathCorrect: number
    mathTotal: number
    rwScore: number
    mathScore: number
    totalScore: number
}) {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const {
            testSessionId,
            englishCorrect,
            englishTotal,
            mathCorrect,
            mathTotal,
            rwScore,
            mathScore,
            totalScore
        } = body

        await pool.query(
            `
                INSERT INTO user_test_sessions (
                    user_id,
                    test_session_id,
                    english_correct,
                    english_total,
                    math_correct,
                    math_total,
                    rw_score,
                    math_score,
                    total_score,
                    completed_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    ON CONFLICT (test_session_id) 
                DO UPDATE SET
                    english_correct = EXCLUDED.english_correct,
                                           english_total = EXCLUDED.english_total,
                                           math_correct = EXCLUDED.math_correct,
                                           math_total = EXCLUDED.math_total,
                                           rw_score = EXCLUDED.rw_score,
                                           math_score = EXCLUDED.math_score,
                                           total_score = EXCLUDED.total_score,
                                           completed_at = NOW()
            `,
            [
                userId,
                String(testSessionId),
                englishCorrect,
                englishTotal,
                mathCorrect,
                mathTotal,
                rwScore,
                mathScore,
                totalScore
            ]
        )

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getUserAnalyticsAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const statsQuery = await pool.query(
            `
                SELECT
                    COUNT(*) as total_tests_completed,
                    MAX(total_score) as high_score,
                    AVG(total_score)::NUMERIC(10,2) as average_score,
                    AVG(rw_score)::NUMERIC(10,2) as average_rw,
                    AVG(math_score)::NUMERIC(10,2) as average_math
                FROM user_test_sessions
                WHERE user_id = $1
            `,
            [userId]
        )

        const historyQuery = await pool.query(
            `
                SELECT test_session_id, total_score, rw_score, math_score, completed_at
                FROM user_test_sessions
                WHERE user_id = $1
                ORDER BY completed_at DESC
            `,
            [userId]
        )

        return {
            success: true,
            summary: statsQuery.rows[0],
            history: historyQuery.rows
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}