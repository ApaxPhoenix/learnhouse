'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GraduationCap } from '@phosphor-icons/react'
import {
  AlertCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  SearchX,
  Strikethrough,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import {
  getPracticeSetAction,
  type SkillOption,
  submitPracticeAnswerAction,
} from '../sat/questionnaire/actions'
import { isCorrectChoice, SECTION_LABELS, type SatQuestion, type Section } from '@/lib/sat/sat'
import { ChoiceList } from './ChoiceList'
import { DesmosCalculator } from './DesmosCalculator'
import {
  BottomBar,
  Card,
  Explanation,
  LoadingCard,
  type NavStatus,
  QuestionLayout,
  QuestionNavigator,
  primaryButton,
  SignInCard,
  StateCard,
  secondaryButton,
  toggleButton,
} from './PracticeUI'

type LoadState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }
  | { status: 'ready'; questions: SatQuestion[]; skills: SkillOption[] }

export function PracticeRunner({ section }: { section: Section }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain')
  // `concept` was the old name for this filter; keep old links working.
  const skill = searchParams.get('skill') ?? searchParams.get('concept')
  const basePath = `/practice/sat/questionnaire/${section}`

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState<string | null>(null)
  const [eliminateMode, setEliminateMode] = useState(false)
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({})
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getPracticeSetAction({ section, domain, skill }).then((res) => {
      if (cancelled) return
      if (res.unauthorized) return setState({ status: 'unauthorized' })
      if (!res.success) return setState({ status: 'error', message: res.error })
      setAnswers(res.answers)
      // Resume where the student left off.
      const firstOpen = res.questions.findIndex((q) => !res.answers[q.id])
      setIndex(firstOpen === -1 ? 0 : firstOpen)
      setState({ status: 'ready', questions: res.questions, skills: res.skills })
    })
    return () => {
      cancelled = true
    }
  }, [section, domain, skill, reloadKey])

  const questions = state.status === 'ready' ? state.questions : []
  const question = questions[index]
  const choice = question ? answers[question.id] : undefined

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers]
  )
  const correctCount = useMemo(
    () => questions.filter((q) => isCorrectChoice(q, answers[q.id])).length,
    [questions, answers]
  )

  const select = useCallback(
    async (key: string) => {
      if (!question || answers[question.id] || saving) return
      const id = question.id
      setAnswers((prev) => ({ ...prev, [id]: key }))
      setSaving(id)
      const res = await submitPracticeAnswerAction({ questionId: id, choice: key })
      setSaving(null)
      if (res.success) {
        if (res.alreadyAnswered) setAnswers((prev) => ({ ...prev, [id]: res.choice }))
        return
      }
      setAnswers((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast.error(res.unauthorized ? 'Your session expired — please sign in again.' : res.error)
    },
    [question, answers, saving]
  )

  const go = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, questions.length - 1))),
    [questions.length]
  )

  // After answering, jump ahead to the next question still open (wrapping).
  const nextOpen = useMemo(() => {
    for (let step = 1; step < questions.length; step++) {
      const i = (index + step) % questions.length
      if (!answers[questions[i].id]) return i
    }
    return -1
  }, [questions, answers, index])

  // Keyboard: A–D answers, ←/→ moves between questions.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (navigatorOpen || target?.closest('input, textarea, select, [contenteditable="true"]'))
        return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else if (question && /^[a-e]$/i.test(event.key)) {
        const key = event.key.toUpperCase()
        if (!question.choices.some((c) => c.key === key)) return
        if (choice) return // already answered — choices are locked
        // Same rules as clicking: cross-out mode toggles the strike, and a
        // crossed-out choice is brought back rather than picked.
        const crossed = eliminated[question.id]?.includes(key)
        if (eliminateMode || crossed) {
          setEliminated((prev) => {
            const list = prev[question.id] ?? []
            return {
              ...prev,
              [question.id]: crossed ? list.filter((k) => k !== key) : [...list, key],
            }
          })
        } else select(key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, select, question, navigatorOpen, eliminated, eliminateMode, choice])

  const setFilter = (value: string) => {
    router.replace(value ? `${basePath}?skill=${encodeURIComponent(value)}` : basePath, {
      scroll: false,
    })
  }

  const toggleEliminated = (key: string) => {
    if (!question) return
    setEliminated((prev) => {
      const list = prev[question.id] ?? []
      return {
        ...prev,
        [question.id]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
      }
    })
  }

  const navItems = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        status: (answers[q.id]
          ? isCorrectChoice(q, answers[q.id])
            ? 'correct'
            : 'incorrect'
          : 'unanswered') as NavStatus,
      })),
    [questions, answers]
  )

  const sectionLabel = SECTION_LABELS[section]
  const activeSkill =
    state.status === 'ready' ? state.skills.find((s) => s.skill === skill) : undefined

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            {
              label: 'Practice',
              href: '/practice',
              icon: <GraduationCap size={14} weight="fill" />,
            },
            { label: sectionLabel, href: basePath },
            ...(activeSkill ? [{ label: activeSkill.label }] : []),
          ]}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {sectionLabel} practice
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Untimed. Each question can be answered once — you&apos;ll see the explanation right
              away.
            </p>
          </div>

          {state.status === 'ready' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={skill ?? ''}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter by skill"
                className="max-w-[260px] cursor-pointer appearance-none rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm nice-shadow focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.65rem center',
                }}
              >
                <option value="">All skills</option>
                {Object.entries(
                  state.skills.reduce<Record<string, SkillOption[]>>((groups, s) => {
                    ;(groups[s.domainLabel] ??= []).push(s)
                    return groups
                  }, {})
                ).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((s) => (
                      <option key={s.skill} value={s.skill}>
                        {s.label} ({s.count})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNavigatorOpen(true)}
                className={secondaryButton}
                disabled={!questions.length}
              >
                <LayoutGrid size={15} />
                Questions
              </button>
              {section === 'math' && (
                <button
                  type="button"
                  onClick={() => setCalculatorOpen((o) => !o)}
                  className={toggleButton(calculatorOpen)}
                >
                  <Calculator size={15} />
                  Calculator
                </button>
              )}
              <button
                type="button"
                onClick={() => setEliminateMode((m) => !m)}
                className={toggleButton(eliminateMode)}
                title="Cross out answer choices you've ruled out"
              >
                <Strikethrough size={15} />
                Eliminate
              </button>
            </div>
          )}
        </div>

        {state.status === 'ready' && questions.length > 0 && (
          <Card className="flex items-center gap-4 px-4 py-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-black transition-all duration-500"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-gray-500">
              {answeredCount} / {questions.length} answered
              {answeredCount > 0 &&
                ` · ${Math.round((correctCount / answeredCount) * 100)}% correct`}
            </span>
          </Card>
        )}

        {state.status === 'loading' && <LoadingCard label="Loading questions…" />}
        {state.status === 'unauthorized' && (
          <SignInCard description="Sign in to save your answers and track progress across Reading and Writing and Math." />
        )}
        {state.status === 'error' && (
          <StateCard
            icon={<AlertCircle size={20} />}
            title="Couldn't load questions"
            description={state.message}
          >
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className={primaryButton}
            >
              Try again
            </button>
          </StateCard>
        )}
        {state.status === 'ready' && questions.length === 0 && (
          <StateCard
            icon={<SearchX size={20} />}
            title="No questions here yet"
            description={
              skill || domain
                ? 'Nothing matches this filter right now. Try another skill or practice the whole section.'
                : 'Questions for this section haven’t been published in the CMS yet.'
            }
          >
            {(skill || domain) && (
              <button type="button" onClick={() => setFilter('')} className={primaryButton}>
                Show all {sectionLabel} questions
              </button>
            )}
          </StateCard>
        )}

        {question && (
          <QuestionLayout question={question} number={index + 1}>
            <ChoiceList
              choices={question.choices}
              selected={choice}
              onSelect={select}
              eliminateMode={eliminateMode}
              eliminated={eliminated[question.id]}
              onToggleEliminated={toggleEliminated}
              revealAnswer={choice ? question.answer : undefined}
              disabled={!!choice || saving === question.id}
              math={section === 'math'}
            />
            {choice && (
              <Explanation question={question} correct={isCorrectChoice(question, choice)} />
            )}
            {choice && saving !== question.id && (
              <div className="flex justify-end">
                {nextOpen === -1 ? (
                  <p className="text-sm font-medium text-gray-500">
                    You&apos;ve answered every question in this set. 🎉
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIndex(nextOpen)}
                    className={primaryButton}
                  >
                    Next question
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </QuestionLayout>
        )}
      </div>

      {question && (
        <BottomBar
          left={
            <span>
              Question <span className="font-semibold tabular-nums text-gray-900">{index + 1}</span>{' '}
              of <span className="tabular-nums">{questions.length}</span>
              {saving === question.id && <span className="ml-2 text-gray-400">Saving…</span>}
            </span>
          }
          right={
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className={secondaryButton}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={index >= questions.length - 1}
                className={primaryButton}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </>
          }
        />
      )}

      <QuestionNavigator
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        title={`${sectionLabel} questions`}
        items={navItems}
        current={index}
        onJump={setIndex}
      />
      {calculatorOpen && <DesmosCalculator onClose={() => setCalculatorOpen(false)} />}
    </GeneralWrapperStyled>
  )
}
