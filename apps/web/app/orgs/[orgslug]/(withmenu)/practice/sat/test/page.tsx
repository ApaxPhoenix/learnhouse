'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GraduationCap } from '@phosphor-icons/react'
import {
  AlertCircle,
  Bookmark,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  Eye,
  EyeOff,
  Pause,
  Play,
  Strikethrough,
  Timer,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { cn } from '@/lib/utils'
import { ChoiceList } from '../../_components/ChoiceList'
import { DesmosCalculator } from '../../_components/DesmosCalculator'
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
} from '../../_components/PracticeUI'
import {
  isCorrectChoice,
  SECTION_LABELS,
  type SatQuestion,
  type Section,
  skillLabel,
} from '@/lib/sat/sat'
import { startPracticeTestAction, submitPracticeTestAction } from './actions'

// Seconds. Short timers in development so the whole flow is quick to test.
const isProd = process.env.NODE_ENV === 'production'
const DURATION: Record<Section, number> = { english: isProd ? 600 : 60, math: isProd ? 600 : 120 }
const BREAK_SECONDS = isProd ? 600 : 10
const SHOW_TIMER_UNDER = 300

type Result = Extract<Awaited<ReturnType<typeof submitPracticeTestAction>>, { success: true }>
type Phase =
  | { kind: 'intro' }
  | { kind: 'loading' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }
  | { kind: 'section'; section: Section }
  | { kind: 'break' }
  | { kind: 'submitting' }
  | { kind: 'results'; result: Result }

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

export default function PracticeTestPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [test, setTest] = useState<{
    id: string
    startedAt: string
    english: SatQuestion[]
    math: SatQuestion[]
  } | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({})
  const [index, setIndex] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [eliminateMode, setEliminateMode] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)

  // Deadline-based clock: immune to throttled intervals in background tabs.
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [paused, setPaused] = useState(false)

  const inProgress = phase.kind === 'section' || phase.kind === 'break'
  const section = phase.kind === 'section' ? phase.section : null
  const questions = section && test ? test[section] : []
  const question = questions[index]

  const startClock = (seconds: number) => {
    setRemaining(seconds)
    setDeadline(Date.now() + seconds * 1000)
    setPaused(false)
  }

  const beginSection = useCallback((next: Section) => {
    setPhase({ kind: 'section', section: next })
    setIndex(0)
    setReviewing(false)
    setCalculatorOpen(false)
    setTimerHidden(false)
    startClock(DURATION[next])
  }, [])

  const submit = useCallback(async () => {
    if (!test) return
    setPhase({ kind: 'submitting' })
    setDeadline(null)
    setCalculatorOpen(false)
    const res = await submitPracticeTestAction({
      testSessionId: test.id,
      startedAt: test.startedAt,
      questionIds: [...test.english, ...test.math].map((q) => q.id),
      answers,
    })
    if (res.success) return setPhase({ kind: 'results', result: res })
    if (res.unauthorized) return setPhase({ kind: 'unauthorized' })
    toast.error(res.error)
    setPhase({ kind: 'error', message: res.error })
  }, [test, answers])

  const finishSection = useCallback(() => {
    if (phase.kind === 'section' && phase.section === 'english' && test?.math.length) {
      setPhase({ kind: 'break' })
      setCalculatorOpen(false)
      startClock(BREAK_SECONDS)
    } else {
      submit()
    }
  }, [phase, test, submit])

  const onTimeUp = useRef<() => void>(() => {})
  onTimeUp.current = () => {
    if (phase.kind === 'break') beginSection('math')
    else if (phase.kind === 'section') finishSection()
  }

  useEffect(() => {
    if (!inProgress || paused || deadline === null) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        setDeadline(null)
        onTimeUp.current()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [inProgress, paused, deadline])

  // Leaving mid-test loses the attempt — ask first.
  useEffect(() => {
    if (!inProgress) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [inProgress])

  const pause = () => {
    setPaused(true)
    setDeadline(null)
  }
  const resume = () => startClock(remaining)

  const start = async () => {
    setPhase({ kind: 'loading' })
    const res = await startPracticeTestAction()
    if (res.unauthorized) return setPhase({ kind: 'unauthorized' })
    if (!res.success) return setPhase({ kind: 'error', message: res.error })
    if (!res.english.length && !res.math.length) {
      return setPhase({ kind: 'error', message: 'There are no active questions in the CMS yet.' })
    }
    setTest({
      id: res.testSessionId,
      startedAt: res.startedAt,
      english: res.english,
      math: res.math,
    })
    setAnswers({})
    setFlagged({})
    setEliminated({})
    beginSection(res.english.length ? 'english' : 'math')
  }

  const select = useCallback(
    (key: string) => {
      if (!question) return
      setAnswers((prev) => ({ ...prev, [question.id]: key }))
      setEliminated((prev) => ({
        ...prev,
        [question.id]: (prev[question.id] ?? []).filter((k) => k !== key),
      }))
    },
    [question]
  )

  const go = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, questions.length - 1))),
    [questions.length]
  )

  useEffect(() => {
    if (phase.kind !== 'section' || reviewing) return
    const onKey = (event: KeyboardEvent) => {
      if (navigatorOpen || paused || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select')) return
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else if (question && /^[a-e]$/i.test(event.key)) {
        const key = event.key.toUpperCase()
        if (!question.choices.some((c) => c.key === key)) return
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
  }, [
    phase.kind,
    reviewing,
    navigatorOpen,
    paused,
    go,
    select,
    question,
    eliminated,
    eliminateMode,
  ])

  const navItems = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        status: (answers[q.id] ? 'answered' : 'unanswered') as NavStatus,
        flagged: !!flagged[q.id],
      })),
    [questions, answers, flagged]
  )

  const showTimer = !timerHidden || remaining <= SHOW_TIMER_UNDER

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
            { label: 'Practice test' },
          ]}
        />

        {phase.kind === 'intro' && <Intro onStart={start} />}
        {phase.kind === 'loading' && <LoadingCard label="Building your test…" />}
        {phase.kind === 'submitting' && <LoadingCard label="Scoring your test…" />}
        {phase.kind === 'unauthorized' && (
          <SignInCard description="Sign in to take a timed practice test and save your score." />
        )}
        {phase.kind === 'error' && (
          <StateCard
            icon={<AlertCircle size={20} />}
            title="Something went wrong"
            description={phase.message}
          >
            <button
              type="button"
              onClick={() => setPhase({ kind: 'intro' })}
              className={primaryButton}
            >
              Start over
            </button>
            <Link href="/practice" className={secondaryButton}>
              Back to practice
            </Link>
          </StateCard>
        )}

        {phase.kind === 'break' && (
          <StateCard
            icon={<Coffee size={20} />}
            title="Reading and Writing complete"
            description="Take a short break. The Math section starts automatically when the timer runs out — a calculator is available there."
          >
            <div className="w-full">
              <div className="mx-auto mb-5 w-fit rounded-xl bg-gray-50 px-6 py-3 font-mono text-3xl font-bold tabular-nums text-gray-900">
                {formatClock(remaining)}
              </div>
              <button type="button" onClick={() => beginSection('math')} className={primaryButton}>
                <Play size={15} />
                Start Math now
              </button>
            </div>
          </StateCard>
        )}

        {phase.kind === 'results' && test && (
          <Results test={test} answers={answers} result={phase.result} />
        )}

        {section && question && (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  Section {section === 'english' ? 1 : 2}: {SECTION_LABELS[section]}
                </p>
                <p className="text-xs text-gray-500">
                  {questions.length} questions · {Math.round(DURATION[section] / 60)} minutes
                </p>
              </div>

              <div className="flex items-center gap-2">
                {showTimer ? (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums',
                      remaining <= 60 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-900'
                    )}
                  >
                    <Clock size={14} />
                    {formatClock(remaining)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Timer hidden</span>
                )}
                {remaining > SHOW_TIMER_UNDER && (
                  <button
                    type="button"
                    onClick={() => setTimerHidden((h) => !h)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                    title={timerHidden ? 'Show timer' : 'Hide timer'}
                  >
                    {timerHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                >
                  <Strikethrough size={15} />
                  Eliminate
                </button>
                <button type="button" onClick={pause} className={secondaryButton}>
                  <Pause size={15} />
                  Pause
                </button>
              </div>
            </Card>

            {reviewing ? (
              <Card className="p-6">
                <h2 className="text-lg font-bold tracking-tight text-gray-900">Check your work</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {navItems.filter((i) => i.status === 'answered').length} of {questions.length}{' '}
                  answered · {navItems.filter((i) => i.flagged).length} marked for review. Select a
                  question to go back to it.
                </p>
                <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-10">
                  {navItems.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIndex(i)
                        setReviewing(false)
                      }}
                      className={cn(
                        'relative h-10 rounded-lg text-sm font-semibold tabular-nums transition-colors cursor-pointer',
                        item.status === 'answered'
                          ? 'bg-gray-900 text-white hover:bg-gray-700'
                          : 'border border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      )}
                    >
                      {i + 1}
                      {item.flagged && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            ) : (
              <QuestionLayout
                question={question}
                number={index + 1}
                headerAction={
                  <button
                    type="button"
                    onClick={() =>
                      setFlagged((prev) => ({ ...prev, [question.id]: !prev[question.id] }))
                    }
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      flagged[question.id]
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <Bookmark
                      size={14}
                      className={flagged[question.id] ? 'fill-amber-400 text-amber-500' : ''}
                    />
                    {flagged[question.id] ? 'Marked' : 'Mark for review'}
                  </button>
                }
              >
                <ChoiceList
                  choices={question.choices}
                  selected={answers[question.id]}
                  onSelect={select}
                  eliminateMode={eliminateMode}
                  eliminated={eliminated[question.id]}
                  onToggleEliminated={(key) =>
                    setEliminated((prev) => {
                      const list = prev[question.id] ?? []
                      return {
                        ...prev,
                        [question.id]: list.includes(key)
                          ? list.filter((k) => k !== key)
                          : [...list, key],
                      }
                    })
                  }
                  math={section === 'math'}
                />
              </QuestionLayout>
            )}

            <BottomBar
              left={
                <button
                  type="button"
                  onClick={() => setNavigatorOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Question <span className="tabular-nums">{index + 1}</span> of{' '}
                  <span className="tabular-nums">{questions.length}</span>
                  <ChevronUp size={15} />
                </button>
              }
              right={
                reviewing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setReviewing(false)}
                      className={secondaryButton}
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>
                    <button type="button" onClick={finishSection} className={primaryButton}>
                      {section === 'english' && test?.math.length
                        ? 'Finish section'
                        : 'Submit test'}
                      <ChevronRight size={16} />
                    </button>
                  </>
                ) : (
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
                      onClick={() => (index >= questions.length - 1 ? setReviewing(true) : go(1))}
                      className={primaryButton}
                    >
                      {index >= questions.length - 1 ? 'Review' : 'Next'}
                      <ChevronRight size={16} />
                    </button>
                  </>
                )
              }
            />

            <QuestionNavigator
              open={navigatorOpen}
              onOpenChange={setNavigatorOpen}
              title={`Section ${section === 'english' ? 1 : 2}: ${SECTION_LABELS[section]}`}
              items={navItems}
              current={index}
              onJump={(i) => {
                setIndex(i)
                setReviewing(false)
              }}
            />
            {calculatorOpen && <DesmosCalculator onClose={() => setCalculatorOpen(false)} />}
          </>
        )}
      </div>

      <Modal
        isDialogOpen={paused}
        onOpenChange={(open) => !open && resume()}
        dialogTitle="Test paused"
        dialogDescription="The timer is stopped. Your answers stay on this page until you submit — don't close the tab."
        customWidth="sm:max-w-md"
        dialogContent={
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-2xl font-bold tabular-nums text-gray-900">
              {formatClock(remaining)}
            </span>
            <button type="button" onClick={resume} className={primaryButton}>
              <Play size={15} />
              Resume
            </button>
          </div>
        }
      />
    </GeneralWrapperStyled>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  const modules: { section: Section; questions: number; note: string }[] = [
    { section: 'english', questions: 27, note: 'Passages and single-question prompts' },
    { section: 'math', questions: 22, note: 'Built-in Desmos graphing calculator' },
  ]
  return (
    <Card className="mx-auto w-full max-w-2xl p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white nice-shadow text-gray-800">
          <Timer size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Timed practice test</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            A fresh set of questions every time, in the same order and format as the Digital SAT.
            Your answers are saved when you submit, and your score shows up on the practice
            dashboard.
          </p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-100">
        {modules.map((m, i) => (
          <div key={m.section} className="flex items-center gap-4 px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-black text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">{SECTION_LABELS[m.section]}</p>
              <p className="text-xs text-gray-500">{m.note}</p>
            </div>
            <span className="text-right text-sm tabular-nums text-gray-600">
              {m.questions} questions · {Math.round(DURATION[m.section] / 60)} min
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-1.5 text-sm text-gray-500">
        <li>• Mark questions for review and change answers any time before the section ends.</li>
        <li>• A {Math.round(BREAK_SECONDS / 60) || 1}-minute break separates the two sections.</li>
        <li>• Leaving the page ends the attempt without saving.</li>
      </ul>

      <div className="mt-7 flex flex-wrap gap-2">
        <button type="button" onClick={onStart} className={primaryButton}>
          <Play size={15} />
          Begin test
        </button>
        <Link href="/practice" className={secondaryButton}>
          Back to practice
        </Link>
      </div>
    </Card>
  )
}

function Results({
  test,
  answers,
  result,
}: {
  test: { english: SatQuestion[]; math: SatQuestion[] }
  answers: Record<string, string>
  result: Result
}) {
  const [selected, setSelected] = useState<{ section: Section; index: number } | null>(null)
  const totalCorrect = result.english.correct + result.math.correct
  const total = result.english.total + result.math.total
  const selectedQuestion = selected ? test[selected.section][selected.index] : undefined

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div>
          <p className="text-sm font-medium text-gray-500">Total score</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums text-gray-900">
            {result.totalScore}
            <span className="ml-1.5 text-base font-normal text-gray-400">/ 1600</span>
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {totalCorrect} of {total} correct (
            {total ? Math.round((totalCorrect / total) * 100) : 0}%)
          </p>
        </div>
        <ResultStat label="Reading and Writing" score={result.rwScore} tally={result.english} />
        <ResultStat label="Math" score={result.mathScore} tally={result.math} />
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Review your answers</h2>
            <p className="text-xs text-gray-500">
              Select a question to see the correct answer and explanation.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/practice" className={secondaryButton}>
              Back to practice
            </Link>
          </div>
        </div>
        {(['english', 'math'] as Section[])
          .filter((s) => test[s].length)
          .map((s) => (
            <div key={s} className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {SECTION_LABELS[s]}
              </p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-14">
                {test[s].map((q, i) => {
                  const correct = result.results[q.id]
                  const isActive = selected?.section === s && selected.index === i
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelected(isActive ? null : { section: s, index: i })}
                      title={skillLabel(q.skill)}
                      className={cn(
                        'flex h-9 items-center justify-center gap-0.5 rounded-lg text-sm font-semibold tabular-nums text-white transition-colors cursor-pointer',
                        correct
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : answers[q.id]
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-gray-300 hover:bg-gray-400',
                        isActive && 'ring-2 ring-black ring-offset-2'
                      )}
                    >
                      {i + 1}
                      {correct ? (
                        <Check size={11} strokeWidth={3} />
                      ) : (
                        <X size={11} strokeWidth={3} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
      </Card>

      {selected && selectedQuestion && (
        <QuestionLayout question={selectedQuestion} number={selected.index + 1}>
          <ChoiceList
            choices={selectedQuestion.choices}
            selected={answers[selectedQuestion.id]}
            onSelect={() => {}}
            revealAnswer={selectedQuestion.answer}
            disabled
            math={selectedQuestion.section === 'math'}
          />
          {!answers[selectedQuestion.id] && (
            <p className="text-sm text-gray-500">You skipped this question.</p>
          )}
          <Explanation
            question={selectedQuestion}
            correct={isCorrectChoice(selectedQuestion, answers[selectedQuestion.id])}
          />
        </QuestionLayout>
      )}
    </div>
  )
}

function ResultStat({
  label,
  score,
  tally,
}: {
  label: string
  score: number
  tally: { correct: number; total: number }
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-gray-900">
        {tally.total ? score : '—'}
        <span className="ml-1 text-sm font-normal text-gray-400">/ 800</span>
      </p>
      <p className="text-xs text-gray-500">
        {tally.correct} of {tally.total} correct
      </p>
    </div>
  )
}
