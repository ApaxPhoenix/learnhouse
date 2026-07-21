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
            const possibleCookies = ["access_token_cookie", "token", "next-auth.session-token", "__Secure-next-auth.session-token", "session"]
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
        if (token) {
            requestHeaders["Authorization"] = `Bearer ${token}`
        }
        if (rawCookies) {
            requestHeaders["Cookie"] = rawCookies
        }

        if (!token && !rawCookies) {
            return null
        }

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

function isEnglishContentType(doc: any): boolean {
    if (!doc) return false

    const section = String(doc.section || '').toLowerCase()
    const subject = String(doc.subject || '').toLowerCase()
    const category = String(doc.category || '').toLowerCase()
    const type = String(doc.type || '').toLowerCase()
    const contentType = String(doc.contentType || doc.content_type || '').toLowerCase()
    const passageType = String(doc.passageType || doc.passage_type || '').toLowerCase()
    const questionType = String(doc.questionType || doc.question_type || '').toLowerCase()
    const domain = String(doc.domain || '').toLowerCase()

    const validIdentifiers = ['english', 'reading', 'writing', 'reading_writing', 'verbal', 'rw']

    const matchesField = (val: string) => validIdentifiers.some(id => val.includes(id))

    if (
        matchesField(section) ||
        matchesField(subject) ||
        matchesField(category) ||
        matchesField(type) ||
        matchesField(contentType) ||
        matchesField(passageType) ||
        matchesField(questionType) ||
        matchesField(domain)
    ) {
        return true
    }

    const docString = JSON.stringify(doc).toLowerCase()
    return (
        docString.includes('"english"') ||
        docString.includes(':english') ||
        docString.includes('"reading"') ||
        docString.includes('"writing"') ||
        docString.includes('"reading_writing"') ||
        docString.includes('"verbal"') ||
        docString.includes('"rw"')
    )
}

function extractImageUrl(img: any, payloadUrl: string): string | null {
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

export async function getEnglishQuestionsAction(
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
        if (token) {
            fetchHeaders["Authorization"] = `Bearer ${token}`
        }
        if (rawCookies) {
            fetchHeaders["Cookie"] = rawCookies
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
                if (isEnglishContentType(doc)) {
                    const imgUrl = extractImageUrl(
                        doc.image || doc.stimulusImage || doc.stimulus_image || doc.media || doc.stimulusMedia || doc.stimulus_media,
                        payloadUrl
                    )

                    if (imgUrl) {
                        if (typeof doc.passage === 'string' && !doc.passage.includes(imgUrl)) {
                            doc.passage = `![Stimulus Image](${imgUrl})\n\n${doc.passage}`
                        } else if (typeof doc.stimulus === 'string' && !doc.stimulus.includes(imgUrl)) {
                            doc.stimulus = `![Stimulus Image](${imgUrl})\n\n${doc.stimulus}`
                        } else if (!doc.passage && !doc.stimulus) {
                            doc.passage = `![Stimulus Image](${imgUrl})`
                        }
                    }

                    if (options?.domain) {
                        const searchDomain = options.domain.toLowerCase().trim()
                        const docDomain = String(doc.domain || doc.category || doc.topic || '').toLowerCase().trim()
                        const docString = JSON.stringify(doc).toLowerCase()

                        if (!searchDomain || docDomain.includes(searchDomain) || searchDomain.includes(docDomain) || docString.includes(searchDomain)) {
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

export async function submitEnglishAttemptAction(
    body: {
        questionId: string | number
        selectedOptionKey: string
        isCorrect: boolean
        timeSpentSeconds?: number
        testSessionId?: string
        section?: string
    },
    explicitToken?: string | null
) {
    try {
        const userId = await getUserIdFromSession(explicitToken)
        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const { questionId, selectedOptionKey, isCorrect, timeSpentSeconds, testSessionId, section } = body
        const cleanQuestionId = String(questionId)
        const cleanOptionKey = String(selectedOptionKey)
        const cleanSessionId = testSessionId ? String(testSessionId) : null
        const targetSection = (section || 'english').toLowerCase()

        const checkDuplicate = await pool.query(
            `
                SELECT selected_option_key 
                FROM user_attempts 
                WHERE user_id = $1 
                  AND question_id = $2 
                  AND LOWER(section) IN ('english', 'reading_writing', 'reading', 'writing', 'rw')
            `,
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
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
                userId,
                cleanQuestionId,
                targetSection,
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

export async function getEnglishAnalyticsAction(explicitToken?: string | null) {
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
                WHERE user_id = $1 
                  AND LOWER(section) IN ('english', 'reading_writing', 'reading', 'writing', 'rw')
            `,
            [userId]
        )

        const historyQuery = await pool.query(
            `
                SELECT question_id, selected_option_key AS selected_option, is_correct, created_at AS completed_at
                FROM user_attempts
                WHERE user_id = $1 
                  AND LOWER(section) IN ('english', 'reading_writing', 'reading', 'writing', 'rw')
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

export async function getRecommendationsForWrongEnglishQuestionsAction(
    limitPerDomain = 3,
    explicitToken?: string | null
) {
    try {
        const { token: extractedToken, rawCookies } = await getAuthContext()
        const token = explicitToken || extractedToken
        const userId = await getUserIdFromSession(token)

        if (!userId) {
            return { success: false, error: "Unauthorized session context" }
        }

        const wrongAttemptsQuery = await pool.query(
            `
                SELECT DISTINCT question_id
                FROM user_attempts
                WHERE user_id = $1 
                  AND LOWER(section) IN ('english', 'reading_writing', 'reading', 'writing', 'rw') 
                  AND is_correct = false
            `,
            [userId]
        )

        const wrongQuestionIds = wrongAttemptsQuery.rows.map(row => String(row.question_id))

        if (wrongQuestionIds.length === 0) {
            return { success: true, docs: [] }
        }

        const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || "http://localhost:3001"
        const fetchHeaders: Record<string, string> = {}
        if (token) {
            fetchHeaders["Authorization"] = `Bearer ${token}`
        }
        if (rawCookies) {
            fetchHeaders["Cookie"] = rawCookies
        }

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

                const isEnglish = isEnglishContentType(doc)
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