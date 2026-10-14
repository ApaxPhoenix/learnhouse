'use server'

import { DOMAINS, domainLabel, type Section, sectionScore, skillLabel } from '@/lib/sat/sat'
import {
  failure,
  getOrgAdminContext,
  getOrgMembers,
  getQuestionIndex,
  payloadPublicUrl,
  pool,
} from '@/lib/sat/server'

export interface PracticeKpis {
  students: number
  answers: number
  correct: number
  tests: number
  avgTestScore: number | null
}

export interface DailyActivity {
  day: string
  correct: number
  incorrect: number
}

export interface SkillStat {
  section: Section
  domain: string
  skill: string
  label: string
  answers: number
  correct: number
}

export interface QuestionStat {
  id: string
  section: Section
  prompt: string
  skill: string
  difficulty: string
  answers: number
  correct: number
  editUrl: string
}

export interface StudentStat {
  userId: string
  name: string
  email: string
  answers: number
  correct: number
  tests: number
  bestScore: number | null
  lastActive: string
}

export interface RecentTest {
  id: string
  userId: string
  name: string
  totalScore: number
  rwScore: number
  mathScore: number
  completedAt: string
}

export interface BankStat {
  section: Section
  domain: string
  label: string
  questions: number
}

const asSection = (value: string | null): Section => (value === 'math' ? 'math' : 'english')

/**
 * Org-wide SAT practice statistics for the admin dashboard.
 * `days` = 0 means all time.
 */
export async function getPracticeAdminStatsAction(input: { orgslug: string; days: number }) {
  try {
    const ctx = await getOrgAdminContext(input.orgslug)
    if (!ctx) return { success: false as const, forbidden: true as const }

    const days = Math.max(0, Math.min(3650, Math.floor(Number(input.days) || 0)))
    // $1 = number of days; 0 disables the time filter.
    const inRange = (column: string) =>
      `($1::int = 0 OR ${column} >= NOW() - make_interval(days => $1::int))`
    const finished = 'COALESCE(completed_at, started_at)'
    const completed = `(status = 'completed' OR completed_at IS NOT NULL)`

    const [kpis, daily, perQuestion, perStudent, testsPerStudent, recent, index, members] =
      await Promise.all([
        pool.query(
          `SELECT
             (SELECT count(DISTINCT user_id) FROM user_attempts WHERE ${inRange('created_at')}) AS students,
             (SELECT count(*) FROM user_attempts WHERE ${inRange('created_at')}) AS answers,
             (SELECT count(*) FROM user_attempts WHERE is_correct AND ${inRange('created_at')}) AS correct,
             (SELECT count(*) FROM user_test_sessions WHERE ${completed} AND ${inRange(finished)}) AS tests,
             (SELECT round(avg(total_score)) FROM user_test_sessions WHERE ${completed} AND ${inRange(finished)}) AS avg_score`,
          [days]
        ),
        pool.query(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  count(*) FILTER (WHERE is_correct) AS correct,
                  count(*) FILTER (WHERE NOT is_correct) AS incorrect
             FROM user_attempts
            WHERE ${inRange('created_at')}
            GROUP BY 1 ORDER BY 1`,
          [days]
        ),
        pool.query(
          `SELECT question_id, LOWER(section) AS section, count(*) AS answers,
                  count(*) FILTER (WHERE is_correct) AS correct
             FROM user_attempts
            WHERE ${inRange('created_at')}
            GROUP BY 1, 2`,
          [days]
        ),
        pool.query(
          `SELECT user_id, count(*) AS answers, count(*) FILTER (WHERE is_correct) AS correct,
                  max(created_at) AS last_active
             FROM user_attempts
            WHERE ${inRange('created_at')}
            GROUP BY 1`,
          [days]
        ),
        pool.query(
          `SELECT user_id, count(*) AS tests, max(total_score) AS best, max(${finished}) AS last_test
             FROM user_test_sessions
            WHERE ${completed} AND ${inRange(finished)}
            GROUP BY 1`,
          [days]
        ),
        pool.query(
          `SELECT test_session_id, user_id, total_score, rw_score, math_score, ${finished} AS finished
             FROM user_test_sessions
            WHERE ${completed} AND ${inRange(finished)}
            ORDER BY ${finished} DESC
            LIMIT 8`,
          [days]
        ),
        getQuestionIndex().catch(() => null),
        getOrgMembers(ctx).catch(() => new Map()),
      ])

    const k = kpis.rows[0]
    const nameOf = (userId: string) => members.get(String(userId))?.name ?? `User #${userId}`
    const cms = payloadPublicUrl()

    // Per-skill accuracy and hardest questions, joined to the question bank.
    const skills = new Map<string, SkillStat>()
    const questionStats: QuestionStat[] = []
    const sectionTotals: Record<Section, { answers: number; correct: number }> = {
      english: { answers: 0, correct: 0 },
      math: { answers: 0, correct: 0 },
    }
    for (const row of perQuestion.rows) {
      const answers = Number(row.answers)
      const correct = Number(row.correct)
      const q = index?.byId.get(String(row.question_id))
      const section = q?.section ?? asSection(row.section)
      sectionTotals[section].answers += answers
      sectionTotals[section].correct += correct
      if (!q) continue
      if (q.skill && q.domain) {
        const key = `${section}:${q.skill}`
        const s = skills.get(key) ?? {
          section,
          domain: domainLabel(section, q.domain),
          skill: q.skill,
          label: skillLabel(q.skill),
          answers: 0,
          correct: 0,
        }
        s.answers += answers
        s.correct += correct
        skills.set(key, s)
      }
      questionStats.push({
        id: q.id,
        section,
        // R&W prompts are generic ("The passage is best described as"); the
        // passage opening identifies the question better.
        prompt: (q.passage || q.prompt).replace(/\s+/g, ' ').slice(0, 160),
        skill: skillLabel(q.skill),
        difficulty: q.difficulty,
        answers,
        correct,
        editUrl: `${cms}/admin/collections/questions/${q.id}`,
      })
    }

    const tests = new Map(testsPerStudent.rows.map((r: any) => [String(r.user_id), r]))
    const studentIds = new Set([
      ...perStudent.rows.map((r: any) => String(r.user_id)),
      ...tests.keys(),
    ])
    const students: StudentStat[] = [...studentIds].map((userId) => {
      const a: any = perStudent.rows.find((r: any) => String(r.user_id) === userId)
      const t: any = tests.get(userId)
      const lastActive = [a?.last_active, t?.last_test]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
      return {
        userId,
        name: nameOf(userId),
        email: members.get(userId)?.email ?? '',
        answers: Number(a?.answers ?? 0),
        correct: Number(a?.correct ?? 0),
        tests: Number(t?.tests ?? 0),
        bestScore: t?.best != null ? Number(t.best) : null,
        lastActive: new Date(Math.max(...lastActive)).toISOString(),
      }
    })
    students.sort((x, y) => y.answers - x.answers || y.tests - x.tests)

    const bank: BankStat[] = (['english', 'math'] as Section[]).flatMap((section) =>
      Object.keys(DOMAINS[section]).map((domain) => ({
        section,
        domain,
        label: domainLabel(section, domain),
        questions:
          index?.list.filter((q) => q.section === section && q.domain === domain).length ?? 0,
      }))
    )

    const answers = Number(k.answers)
    const correct = Number(k.correct)

    return {
      success: true as const,
      forbidden: false as const,
      kpis: {
        students: Number(k.students),
        answers,
        correct,
        tests: Number(k.tests),
        avgTestScore: k.avg_score != null ? Number(k.avg_score) : null,
      } satisfies PracticeKpis,
      daily: daily.rows.map((r: any) => ({
        day: r.day,
        correct: Number(r.correct),
        incorrect: Number(r.incorrect),
      })) as DailyActivity[],
      sections: (['english', 'math'] as Section[]).map((section) => ({
        section,
        ...sectionTotals[section],
        estimatedScore: sectionScore(
          sectionTotals[section].correct,
          sectionTotals[section].answers
        ),
      })),
      skills: [...skills.values()].sort(
        (a, b) => a.correct / a.answers - b.correct / b.answers || b.answers - a.answers
      ),
      // Hardest first; need a few answers before a question counts.
      hardest: questionStats
        .filter((q) => q.answers >= 3)
        .sort((a, b) => a.correct / a.answers - b.correct / b.answers || b.answers - a.answers)
        .slice(0, 12),
      students,
      recentTests: recent.rows.map((r: any) => ({
        id: String(r.test_session_id),
        userId: String(r.user_id),
        name: nameOf(String(r.user_id)),
        totalScore: Number(r.total_score),
        rwScore: Number(r.rw_score),
        mathScore: Number(r.math_score),
        completedAt: new Date(r.finished).toISOString(),
      })) as RecentTest[],
      bank,
      bankTotal: index?.list.length ?? 0,
      questionsAnswered: questionStats.length,
      cmsUrl: `${cms}/admin/collections/questions`,
    }
  } catch (error) {
    return { ...failure(error), forbidden: false as const }
  }
}
