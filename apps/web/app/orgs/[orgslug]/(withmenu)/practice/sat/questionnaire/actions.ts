'use server'

import {
  failure,
  findQuestions,
  getQuestionIndex,
  getSessionUserId,
  pool,
  UNAUTHORIZED,
} from '@/lib/sat/server'
import {
  DOMAIN_ORDER,
  domainLabel,
  isCorrectChoice,
  type SatQuestion,
  type Section,
  skillLabel,
} from '@/lib/sat/sat'

export interface SkillOption {
  domain: string
  domainLabel: string
  skill: string
  label: string
  count: number
}

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const

function byDomainThenDifficulty(a: SatQuestion, b: SatQuestion) {
  const domain =
    (DOMAIN_ORDER.indexOf(a.domain ?? '') + 1 || 99) -
    (DOMAIN_ORDER.indexOf(b.domain ?? '') + 1 || 99)
  return domain || DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
}

/**
 * Loads a practice set for one section, optionally narrowed to a domain or
 * skill, plus the answers this user already gave in practice mode (practice
 * questions can be answered once).
 */
export async function getPracticeSetAction(input: {
  section: Section
  domain?: string | null
  skill?: string | null
}) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const section: Section = input.section === 'math' ? 'math' : 'english'
    const [all, filtered, history] = await Promise.all([
      findQuestions({ section }),
      findQuestions({ section, domain: input.domain, skill: input.skill }),
      pool.query<{ question_id: string; selected_option_key: string }>(
        `SELECT question_id, selected_option_key
           FROM user_attempts
          WHERE user_id = $1 AND test_session_id IS NULL AND LOWER(section) = $2`,
        [userId, section]
      ),
    ])

    const skills = new Map<string, SkillOption>()
    for (const q of all) {
      if (!q.domain || !q.skill) continue
      const option = skills.get(q.skill) ?? {
        domain: q.domain,
        domainLabel: domainLabel(section, q.domain),
        skill: q.skill,
        label: skillLabel(q.skill),
        count: 0,
      }
      option.count += 1
      skills.set(q.skill, option)
    }

    const answers: Record<string, string> = {}
    for (const row of history.rows) {
      answers[String(row.question_id)] = String(row.selected_option_key).toUpperCase()
    }

    return {
      success: true as const,
      unauthorized: false as const,
      questions: [...filtered].sort(byDomainThenDifficulty),
      answers,
      skills: [...skills.values()].sort((a, b) =>
        a.domainLabel === b.domainLabel
          ? a.label.localeCompare(b.label)
          : a.domainLabel.localeCompare(b.domainLabel)
      ),
    }
  } catch (error) {
    return failure(error)
  }
}

/** Records a practice answer. Correctness is decided here, not by the client. */
export async function submitPracticeAnswerAction(input: { questionId: string; choice: string }) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return UNAUTHORIZED

    const { byId } = await getQuestionIndex()
    const question = byId.get(String(input.questionId))
    if (!question) throw new Error('This question is no longer available.')

    const choice = String(input.choice).trim().toUpperCase()
    if (!question.choices.some((c) => c.key === choice)) throw new Error('Invalid answer choice.')
    const correct = isCorrectChoice(question, choice)

    // Atomic "answer once": insert only if no practice attempt exists yet.
    // Explicit casts: $1/$2 appear both as values and in comparisons, and
    // Postgres refuses to guess ("inconsistent types deduced for parameter").
    const inserted = await pool.query(
      `INSERT INTO user_attempts (user_id, question_id, section, selected_option_key, is_correct)
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::boolean
        WHERE NOT EXISTS (
          SELECT 1 FROM user_attempts
           WHERE user_id = $1::varchar AND question_id = $2::varchar AND test_session_id IS NULL
        )
       RETURNING id`,
      [userId, question.id, question.section, choice, correct]
    )

    if (inserted.rowCount === 0) {
      const previous = await pool.query<{ selected_option_key: string; is_correct: boolean }>(
        `SELECT selected_option_key, is_correct FROM user_attempts
          WHERE user_id = $1 AND question_id = $2 AND test_session_id IS NULL
          LIMIT 1`,
        [userId, question.id]
      )
      const row = previous.rows[0]
      return {
        success: true as const,
        unauthorized: false as const,
        alreadyAnswered: true,
        choice: row ? String(row.selected_option_key).toUpperCase() : choice,
        correct: row ? row.is_correct : correct,
      }
    }

    return {
      success: true as const,
      unauthorized: false as const,
      alreadyAnswered: false,
      choice,
      correct,
    }
  } catch (error) {
    return failure(error)
  }
}
