'use client'

import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Sigma,
  Target,
  Timer,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { cn } from '@/lib/utils'
import {
  clearSatMetricsAction,
  type DomainMastery,
  type FocusArea,
  getSatDashboardDataAction,
  type SectionStats,
  type TestRun,
} from './actions'
import { SECTION_LABELS, type Section } from '@/lib/sat/sat'
import {
  Card,
  primaryButton,
  SignInCard,
  SkeletonBlock,
  StateCard,
  secondaryButton,
} from './_components/PracticeUI'

const TARGET_SCORE = 1540

type Dashboard = Extract<Awaited<ReturnType<typeof getSatDashboardDataAction>>, { success: true }>
type LoadState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Dashboard }

const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0

function accuracyTone(value: number) {
  if (value >= 85) return { bar: 'bg-emerald-500', text: 'text-emerald-600' }
  if (value >= 60) return { bar: 'bg-amber-400', text: 'text-amber-600' }
  return { bar: 'bg-red-400', text: 'text-red-500' }
}

const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString('en-US', opts)

export default function SatPracticeOverview() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    const res = await getSatDashboardDataAction()
    if (res.unauthorized) return setState({ status: 'unauthorized' })
    if (!res.success) return setState({ status: 'error', message: res.error })
    setState({ status: 'ready', data: res })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reset = async () => {
    const res = await clearSatMetricsAction()
    if (res.success) {
      toast.success('Practice history cleared')
      load()
    } else {
      toast.error(res.unauthorized ? 'Please sign in again.' : res.error)
    }
  }

  const ready = state.status === 'ready'

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <TypeOfContentTitle title="SAT Practice" type="practice" />
        </div>
        {ready && (
          <div className="flex flex-wrap items-center gap-2 pb-2 sm:pb-0">
            {state.data.totalAnswered > 0 && (
              <ConfirmationModal
                dialogTitle="Reset practice history?"
                confirmationMessage="This permanently deletes every answer and practice test result on your account. Your score estimate starts over."
                confirmationButtonText="Reset history"
                status="warning"
                functionToExecute={reset}
                dialogTrigger={
                  <button type="button" className={secondaryButton}>
                    <RotateCcw size={15} />
                    Reset
                  </button>
                }
              />
            )}
            <Link href="/practice/sat/test" className={primaryButton}>
              <Timer size={15} />
              Start practice test
            </Link>
          </div>
        )}
      </div>

      {state.status === 'loading' && <DashboardSkeleton />}
      {state.status === 'unauthorized' && (
        <SignInCard description="Sign in to track your estimated SAT score, practice by skill, and take timed practice tests." />
      )}
      {state.status === 'error' && (
        <StateCard
          icon={<AlertCircle size={20} />}
          title="Couldn't load your progress"
          description={state.message}
        >
          <button type="button" onClick={() => load()} className={primaryButton}>
            Try again
          </button>
        </StateCard>
      )}
      {ready && <DashboardContent data={state.data} />}
    </GeneralWrapperStyled>
  )
}

function DashboardContent({ data }: { data: Dashboard }) {
  return (
    <div className="flex flex-col gap-4">
      <ScoreHero data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          section="english"
          stats={data.sections.english}
          icon={<BookOpen size={18} />}
        />
        <SectionCard section="math" stats={data.sections.math} icon={<Sigma size={18} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <FocusAreas areas={data.focusAreas} hasAnswers={data.totalAnswered > 0} />
          <PracticeTests tests={data.tests} />
        </div>
        <div className="flex flex-col gap-4">
          <SkillMastery mastery={data.mastery} />
          <Activity data={data} />
        </div>
      </div>
    </div>
  )
}

function ScoreHero({ data }: { data: Dashboard }) {
  const score = data.estimatedScore
  const position = ((score - 400) / 1200) * 100
  const targetPosition = ((TARGET_SCORE - 400) / 1200) * 100
  const daysAway = Math.max(0, Math.ceil((Date.parse(data.nextTestDate) - Date.now()) / 86_400_000))

  return (
    <Card className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-500">Estimated score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
            {data.totalAnswered > 0 ? score : '—'}
          </span>
          <span className="text-sm text-gray-400">/ 1600</span>
        </div>
        <div className="space-y-1.5">
          <div className="relative h-2 rounded-full bg-gray-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-black transition-all duration-700"
              style={{ width: `${data.totalAnswered > 0 ? position : 0}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-0.5 rounded bg-gray-400"
              style={{ left: `${targetPosition}%` }}
              title={`Target ${TARGET_SCORE}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>400</span>
            <span className="flex items-center gap-1">
              <Target size={11} /> Target {TARGET_SCORE}
            </span>
            <span>1600</span>
          </div>
        </div>
      </div>

      <HeroStat label="Reading and Writing" value={data.sections.english} />
      <HeroStat label="Math" value={data.sections.math} />

      <div className="flex items-start gap-3 md:col-span-3 lg:col-span-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white nice-shadow text-gray-700">
          <CalendarDays size={17} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Next SAT</p>
          <p className="mt-0.5 font-semibold text-gray-900">
            {formatDate(data.nextTestDate, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-xs text-gray-400">
            {daysAway === 1 ? 'Tomorrow' : `in ${daysAway} days`}
          </p>
        </div>
      </div>
    </Card>
  )
}

function HeroStat({ label, value }: { label: string; value: SectionStats }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
        {value.answered > 0 ? value.score : '—'}
        <span className="ml-1 text-sm font-normal text-gray-400">/ 800</span>
      </p>
      <p className="text-xs text-gray-400">
        {value.answered > 0
          ? `${pct(value.correct, value.answered)}% of ${value.answered} correct`
          : 'Not started'}
      </p>
    </div>
  )
}

function SectionCard({
  section,
  stats,
  icon,
}: {
  section: Section
  stats: SectionStats
  icon: ReactNode
}) {
  const accuracy = pct(stats.correct, stats.answered)
  return (
    <Link
      href={`/practice/sat/questionnaire/${section}`}
      className="group flex items-center gap-4 rounded-xl bg-white p-5 nice-shadow transition-colors hover:bg-gray-50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white nice-shadow text-gray-800">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">{SECTION_LABELS[section]}</p>
        <p className="text-sm text-gray-500">
          {stats.answered > 0
            ? `${stats.answered} answered · ${accuracy}% correct`
            : section === 'english'
              ? 'Craft, ideas, conventions and expression'
              : 'Algebra, advanced math, data analysis and geometry'}
        </p>
      </div>
      <span className="flex items-center gap-1 text-sm font-medium text-gray-700 group-hover:text-black">
        {stats.answered > 0 ? 'Continue' : 'Start'}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
    </div>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="m-5 rounded-xl border-2 border-dashed border-gray-100 bg-gray-50/30 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  )
}

function FocusAreas({ areas, hasAnswers }: { areas: FocusArea[]; hasAnswers: boolean }) {
  return (
    <Card>
      <CardHeader title="Focus areas" description="Skills where you've missed the most questions" />
      {areas.length === 0 ? (
        <EmptyNote>
          {hasAnswers
            ? 'No weak spots yet — keep practicing and they’ll show up here.'
            : 'Answer a few questions and we’ll point out the skills that need work.'}
        </EmptyNote>
      ) : (
        <ul className="divide-y divide-gray-50">
          {areas.map((area) => {
            const missedPct = pct(area.missed, area.attempted)
            return (
              <li key={`${area.section}-${area.skill}`}>
                <Link
                  href={area.href}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900">{area.label}</p>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                        {area.section === 'math' ? 'Math' : 'R&W'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{area.domain}</p>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${missedPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-24 text-right text-xs tabular-nums text-gray-500">
                    {area.missed} of {area.attempted} missed
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function PracticeTests({ tests }: { tests: TestRun[] }) {
  return (
    <Card>
      <CardHeader title="Practice tests" description="Timed Reading and Writing + Math modules" />
      {tests.length === 0 ? (
        <EmptyNote>
          <p>You haven&apos;t taken a practice test yet.</p>
          <Link href="/practice/sat/test" className={cn(primaryButton, 'mt-4')}>
            <Timer size={15} />
            Take your first test
          </Link>
        </EmptyNote>
      ) : (
        <ul className="divide-y divide-gray-50">
          {tests.map((test) => (
            <li key={test.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white nice-shadow text-gray-600">
                <ClipboardList size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">
                  {formatDate(test.completedAt, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-gray-500">
                  R&amp;W {test.rwScore} · Math {test.mathScore} · {test.correct}/{test.total}{' '}
                  correct
                </p>
              </div>
              <span className="text-lg font-bold tabular-nums text-gray-900">
                {test.totalScore}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SkillMastery({ mastery }: { mastery: DomainMastery[] }) {
  return (
    <Card>
      <CardHeader title="Skill mastery" description="Accuracy by SAT content domain" />
      <div className="space-y-5 p-5">
        {(['english', 'math'] as Section[]).map((section) => (
          <div key={section} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {SECTION_LABELS[section]}
            </p>
            {mastery
              .filter((m) => m.section === section)
              .map((m) => {
                const value = pct(m.correct, m.answered)
                const tone = accuracyTone(value)
                return (
                  <div key={m.domain} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-gray-700">{m.label}</span>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-semibold tabular-nums',
                          m.answered ? tone.text : 'text-gray-300'
                        )}
                      >
                        {m.answered ? `${value}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', tone.bar)}
                        style={{ width: `${m.answered ? value : 0}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </Card>
  )
}

function Activity({ data }: { data: Dashboard }) {
  const rows = [
    { label: 'Questions answered', value: data.totalAnswered.toLocaleString() },
    {
      label: 'Overall accuracy',
      value: data.totalAnswered ? `${pct(data.totalCorrect, data.totalAnswered)}%` : '—',
    },
    { label: 'Practice tests taken', value: String(data.tests.length) },
  ]
  return (
    <Card>
      <CardHeader title="Activity" />
      <dl className="divide-y divide-gray-50">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3 text-sm">
            <dt className="text-gray-500">{row.label}</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonBlock className="h-36" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SkeletonBlock className="h-56" />
          <SkeletonBlock className="h-40" />
        </div>
        <SkeletonBlock className="h-96" />
      </div>
    </div>
  )
}
