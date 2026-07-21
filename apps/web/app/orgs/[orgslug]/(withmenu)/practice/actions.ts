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

        if (!cookieHeader) {
            return null
        }

        const response = await fetch(`${backendUrl}/api/v1/users/session`, {
            headers: {
                cookie: cookieHeader,
            },
            cache: "no-store",
        })

        if (!response.ok) {
            return null
        }

        const session = await response.json()
        return session.id ?? session.user?.id ?? null
    } catch {
        return null
    }
}

function getNextSatTestWindow(): { formattedDate: string; description: string } {
    const now = new Date()
    const currentYear = now.getFullYear()
    const satTargetMonths = [2, 4, 5, 7, 9, 10, 11]

    for (let year = currentYear; year <= currentYear + 1; year++) {
        for (const month of satTargetMonths) {
            const testSaturday = new Date(year, month, 1)

            while (testSaturday.getDay() !== 6) {
                testSaturday.setDate(testSaturday.getDate() + 1)
            }

            if (month === 2 || month === 4 || month === 11) {
                testSaturday.setDate(testSaturday.getDate() + 7)
            }

            if (testSaturday > now) {
                return {
                    formattedDate: testSaturday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    description: "Official National Test"
                }
            }
        }
    }

    return { formattedDate: "August 29, 2026", description: "Official National Test" }
}

export async function getSatDashboardDataAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, unauthorized: true, error: "Unauthorized session context" }
        }

        const totalVolumeQuery = await pool.query(
            `SELECT
                 COUNT(*) as total,
                 COUNT(CASE WHEN section = 'english' THEN 1 END) as eng_total,
                 COUNT(CASE WHEN section = 'english' AND is_correct = true THEN 1 END) as eng_correct,
                 COUNT(CASE WHEN section = 'math' THEN 1 END) as math_total,
                 COUNT(CASE WHEN section = 'math' AND is_correct = true THEN 1 END) as math_correct
             FROM user_attempts
             WHERE user_id = $1`,
            [userId]
        )

        const statsRow = totalVolumeQuery.rows[0]
        const totalQuestions = parseInt(statsRow.total || "0", 10)
        const engTotal = parseInt(statsRow.eng_total || "0", 10)
        const engCorrect = parseInt(statsRow.eng_correct || "0", 10)
        const mathTotal = parseInt(statsRow.math_total || "0", 10)
        const mathCorrect = parseInt(statsRow.math_correct || "0", 10)

        const engAccuracy = engTotal > 0 ? engCorrect / engTotal : 0
        const mathAccuracy = mathTotal > 0 ? mathCorrect / mathTotal : 0

        const calculatedEngScore = engTotal === 0 ? 200 : Math.min(800, Math.round(200 + (engAccuracy * 600)))
        const calculatedMathScore = mathTotal === 0 ? 200 : Math.min(800, Math.round(200 + (mathAccuracy * 600)))
        const totalScore = calculatedEngScore + calculatedMathScore

        const missedAttemptsQuery = await pool.query(
            `SELECT question_id, section
             FROM user_attempts
             WHERE user_id = $1 AND is_correct = false
             ORDER BY created_at DESC
                 LIMIT 5`,
            [userId]
        )

        const blindspots = missedAttemptsQuery.rows.map((row: any, idx: number) => {
            const isEnglish = row.section === 'english'
            return {
                id: row.question_id,
                concept: `Targeted Practice Concept #${row.question_id}`,
                subject: isEnglish ? 'Reading & Writing' : 'Math',
                type: idx === 0 ? 'High Priority' : idx < 3 ? 'Medium Priority' : 'Low Priority',
                style: idx === 0
                    ? 'border border-red-200/60 text-red-600 bg-red-50'
                    : idx < 3
                        ? 'border border-amber-200/60 text-amber-600 bg-amber-50'
                        : 'border border-emerald-200/60 text-emerald-600 bg-emerald-50',
                targetPath: `/practice/sat/questionnaire/${row.section}?concept=Concept_${row.question_id}`
            }
        })

        const historicalSessionsQuery = await pool.query(
            `SELECT test_session_id, rw_score, math_score, total_score, status, completed_at, started_at
             FROM user_test_sessions
             WHERE user_id = $1
             ORDER BY started_at DESC
                 LIMIT 4`,
            [userId]
        )

        const diagnosticRuns = historicalSessionsQuery.rows.map((session: any, idx: number) => {
            const displayDate = new Date(session.completed_at || session.started_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })

            return {
                id: session.test_session_id,
                name: idx === 0 ? 'Latest Evaluation Summary' : `Diagnostic Session Summary`,
                score: String(session.total_score || (session.rw_score + session.math_score) || 400),
                breakdown: `${session.rw_score || 200} RW · ${session.math_score || 200} M`,
                date: displayDate,
                status: session.status === 'completed' ? 'Completed' : 'In Progress'
            }
        })

        if (diagnosticRuns.length === 0 && totalQuestions > 0) {
            diagnosticRuns.push({
                id: 'run-current-fallback',
                name: 'Dynamic Aggregated Diagnostic Run',
                score: String(totalScore),
                breakdown: `${calculatedEngScore} RW · ${calculatedMathScore} M`,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: 'Completed'
            })
        }

        const examSchedule = getNextSatTestWindow()

        return {
            success: true,
            currentScore: totalScore,
            engScore: calculatedEngScore,
            mathScore: calculatedMathScore,
            totalQuestions,
            blindspots,
            diagnosticRuns,
            examWindowDate: examSchedule.formattedDate
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function clearSatMetricsAction() {
    try {
        const userId = await getUserIdFromSession()
        if (!userId) {
            return { success: false, unauthorized: true, error: "Unauthorized session context" }
        }

        await pool.query(`DELETE FROM user_test_sessions WHERE user_id = $1`, [userId])
        await pool.query(`DELETE FROM user_attempts WHERE user_id = $1`, [userId])

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}