'use server'

import { failure, getQuestionIndex, getSessionUserId, pool, UNAUTHORIZED } from '@/lib/sat/server'
import { DOMAINS, domainLabel, type Section, sectionScore, skillLabel } from '@/lib/sat/sat'

export interface SectionStats {
  answered: number
  correct: number
  score: number
}

export interface TestRun {
  id: string
  completedAt: string
  rwScore: number
  mathScore: number
  totalScore: number
  correct: number
  total: number
}

export interface FocusArea {
  section: Section
  skill: string
  label: string
  domain: string
  missed: number
  attempted: number
  href: string
}

export interface DomainMastery {
  section: Section
  domain: string
  label: string
  answered: number
  correct: number
}

const asSection = (value: string | null): Section => (value === 'math' ? 'math' : 'english')

/** Next national SAT Saturday (Mar, May, Jun, Aug, Oct, Nov, Dec). */
function nextSatDate(now = new Date()): Date {
  const months = [2, 4, 5, 7, 9, 10, 11]
  for (let year = now.getFullYear(); year <= now.getFullYear() + 1; year++) {
    for (const month of months) {
      const day = new Date(year, month, 1)
      while (day.getDay() !== 6) day.setDate(day.getDate() + 1)
      // March, May and December sittings fall on the second Saturday.
      if (month === 2 || month === 4 || month === 11) day.setDate(day.getDate() + 7)
      if (day > now) return day
    }
  }
  return new Date(now.getFullYear() + 1, 2, 14)
}

export async function getSatDashboardDataAction() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const [attemptsResult, sessionsResult, index] = await Promise.all([
      pool.query<{
        question_id: string
        section: string
        is_correct: boolean
        practice: boolean
      }>(
        `SELECT question_id, LOWER(section) AS section, is_correct, test_session_id IS NULL AS practice
           FROM user_attempts
          WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT test_session_id, rw_score, math_score, total_score,
                english_correct + math_correct AS correct,
                english_total + math_total AS total,
                COALESCE(completed_at, started_at) AS finished
           FROM user_test_sessions
          WHERE user_id = $1 AND (status = 'completed' OR completed_at IS NOT NULL)
          ORDER BY COALESCE(completed_at, started_at) DESC
          LIMIT 5`,
        [userId]
      ),
      // Without the CMS the dashboard still shows totals, just no skill detail.
      getQuestionIndex().catch(() => null),
    ])

    const sections: Record<Section, SectionStats> = {
      english: { answered: 0, correct: 0, score: 200 },
      math: { answered: 0, correct: 0, score: 200 },
    }
    const skills = new Map<string, FocusArea>()
    const domains = new Map<string, DomainMastery>()

    for (const row of attemptsResult.rows) {
      const question = index?.byId.get(String(row.question_id))
      const section = question?.section ?? asSection(row.section)
      sections[section].answered += 1
      if (row.is_correct) sections[section].correct += 1
      if (!question?.domain) continue

      const domainKey = `${section}:${question.domain}`
      const mastery = domains.get(domainKey) ?? {
        section,
        domain: question.domain,
        label: domainLabel(section, question.domain),
        answered: 0,
        correct: 0,
      }
      mastery.answered += 1
      if (row.is_correct) mastery.correct += 1
      domains.set(domainKey, mastery)

      if (!question.skill) continue
      const skillKey = `${section}:${question.skill}`
      const area = skills.get(skillKey) ?? {
        section,
        skill: question.skill,
        label: skillLabel(question.skill),
        domain: domainLabel(section, question.domain),
        missed: 0,
        attempted: 0,
        href: `/practice/sat/questionnaire/${section}?skill=${encodeURIComponent(question.skill)}`,
      }
      area.attempted += 1
      if (!row.is_correct) area.missed += 1
      skills.set(skillKey, area)
    }

    for (const stats of Object.values(sections)) {
      stats.score = sectionScore(stats.correct, stats.answered)
    }

    const focusAreas = [...skills.values()]
      .filter((area) => area.missed > 0)
      .sort((a, b) => b.missed / b.attempted - a.missed / a.attempted || b.missed - a.missed)
      .slice(0, 6)

    // Show every official domain, attempted or not, in a stable order.
    const mastery: DomainMastery[] = (['english', 'math'] as Section[]).flatMap((section) =>
      Object.keys(DOMAINS[section]).map(
        (domain) =>
          domains.get(`${section}:${domain}`) ?? {
            section,
            domain,
            label: domainLabel(section, domain),
            answered: 0,
            correct: 0,
          }
      )
    )

    const tests: TestRun[] = sessionsResult.rows.map((row: any) => ({
      id: String(row.test_session_id),
      completedAt: new Date(row.finished).toISOString(),
      rwScore: Number(row.rw_score) || 200,
      mathScore: Number(row.math_score) || 200,
      totalScore: Number(row.total_score) || 400,
      correct: Number(row.correct) || 0,
      total: Number(row.total) || 0,
    }))

    return {
      success: true as const,
      unauthorized: false as const,
      sections,
      estimatedScore: sections.english.score + sections.math.score,
      totalAnswered: sections.english.answered + sections.math.answered,
      totalCorrect: sections.english.correct + sections.math.correct,
      practiceAnswered: attemptsResult.rows.filter((row) => row.practice).length,
      tests,
      focusAreas,
      mastery,
      nextTestDate: nextSatDate().toISOString(),
    }
  } catch (error) {
    return failure(error)
  }
}

export async function clearSatMetricsAction() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM user_attempts WHERE user_id = $1', [userId])
      await client.query('DELETE FROM user_test_sessions WHERE user_id = $1', [userId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    return { success: true as const, unauthorized: false as const }
  } catch (error) {
    return failure(error)
  }
}
