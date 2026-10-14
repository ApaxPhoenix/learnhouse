'use server'

import { randomUUID } from 'node:crypto'
import {
  failure,
  findQuestions,
  getQuestionIndex,
  getSessionUserId,
  pool,
  shuffle,
  UNAUTHORIZED,
} from '@/lib/sat/server'
import {
  DOMAIN_ORDER,
  isCorrectChoice,
  type SatQuestion,
  type Section,
  sectionScore,
} from '@/lib/sat/sat'

// One module per section, sized like a Digital SAT module.
const SECTION_SIZE: Record<Section, number> = { english: 27, math: 22 }
const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const

function orderLikeBluebook(section: Section, questions: SatQuestion[]) {
  return [...questions].sort((a, b) => {
    if (section === 'english') {
      const domain = DOMAIN_ORDER.indexOf(a.domain ?? '') - DOMAIN_ORDER.indexOf(b.domain ?? '')
      if (domain) return domain
    }
    return DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
  })
}

/** Draws a fresh random test. Nothing is stored until the test is submitted. */
export async function startPracticeTestAction() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const [english, math] = await Promise.all([
      findQuestions({ section: 'english' }),
      findQuestions({ section: 'math' }),
    ])

    return {
      success: true as const,
      unauthorized: false as const,
      testSessionId: randomUUID(),
      startedAt: new Date().toISOString(),
      english: orderLikeBluebook('english', shuffle(english).slice(0, SECTION_SIZE.english)),
      math: orderLikeBluebook('math', shuffle(math).slice(0, SECTION_SIZE.math)),
    }
  } catch (error) {
    return failure(error)
  }
}

/** Scores the test on the server and saves the session with every answer. */
export async function submitPracticeTestAction(input: {
  testSessionId: string
  startedAt: string
  questionIds: string[]
  answers: Record<string, string>
}) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const { byId } = await getQuestionIndex()
    const questions = input.questionIds
      .map((id) => byId.get(String(id)))
      .filter((q): q is SatQuestion => !!q)

    const tally = { english: { correct: 0, total: 0 }, math: { correct: 0, total: 0 } }
    const results: Record<string, boolean> = {}
    for (const q of questions) {
      const correct = isCorrectChoice(q, input.answers[q.id])
      results[q.id] = correct
      tally[q.section].total += 1
      if (correct) tally[q.section].correct += 1
    }

    const rwScore = sectionScore(tally.english.correct, tally.english.total)
    const mathScore = sectionScore(tally.math.correct, tally.math.total)
    const startedAt = Number.isNaN(Date.parse(input.startedAt))
      ? new Date()
      : new Date(input.startedAt)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO user_test_sessions (
            test_session_id, user_id, status,
            english_correct, english_total, math_correct, math_total,
            rw_score, math_score, total_score, started_at, completed_at)
         VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (test_session_id) DO NOTHING`,
        [
          input.testSessionId,
          userId,
          tally.english.correct,
          tally.english.total,
          tally.math.correct,
          tally.math.total,
          rwScore,
          mathScore,
          rwScore + mathScore,
          startedAt,
        ]
      )
      for (const q of questions) {
        const choice = input.answers[q.id]
        if (!choice) continue // skipped questions count as wrong but store no row
        await client.query(
          `INSERT INTO user_attempts
              (user_id, test_session_id, question_id, section, selected_option_key, is_correct)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (test_session_id, question_id) DO NOTHING`,
          [userId, input.testSessionId, q.id, q.section, choice.toUpperCase(), results[q.id]]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return {
      success: true as const,
      unauthorized: false as const,
      rwScore,
      mathScore,
      totalScore: rwScore + mathScore,
      english: tally.english,
      math: tally.math,
      results,
    }
  } catch (error) {
    return failure(error)
  }
}
