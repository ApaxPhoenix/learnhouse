'use client'

import { useParams } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowSquareOut,
  ChartBar,
  ChartLine,
  CheckCircle,
  Exam,
  GraduationCap,
  ListChecks,
  LockSimple,
  MagnifyingGlass,
  Student,
  Target,
  Users,
  Warning,
} from '@phosphor-icons/react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { DashTabBar } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'
import { cn } from '@/lib/utils'
import { SECTION_LABELS } from '@/lib/sat/sat'
import { getPracticeAdminStatsAction } from './actions'

const RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0 },
]

type Tab = 'overview' | 'students' | 'questions'
type Stats = Extract<Awaited<ReturnType<typeof getPracticeAdminStatsAction>>, { success: true }>
type LoadState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stats: Stats }

const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function accuracyTone(value: number) {
  if (value >= 85) return { bar: 'bg-emerald-500', text: 'text-emerald-600' }
  if (value >= 60) return { bar: 'bg-amber-400', text: 'text-amber-600' }
  return { bar: 'bg-red-400', text: 'text-red-500' }
}

export default function PracticeAdminPage() {
  const { orgslug } = useParams<{ orgslug: string }>()
  const [days, setDays] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const res = await getPracticeAdminStatsAction({ orgslug, days })
    if (res.success) setState({ status: 'ready', stats: res })
    else if (res.forbidden) setState({ status: 'forbidden' })
    else setState({ status: 'error', message: res.error })
  }, [orgslug, days])

  useEffect(() => {
    load()
  }, [load])

  const stats = state.status === 'ready' ? state.stats : null

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f8f8]">
      <div className="relative z-10 shrink-0 bg-[#fcfbfc] pl-4 pr-4 tracking-tight nice-shadow sm:pl-10 sm:pr-10">
        <div className="pb-4 pt-6">
          <Breadcrumbs
            items={[
              { label: 'Practice', href: '/dash/practice', icon: <GraduationCap size={14} /> },
            ]}
          />
        </div>
        <div className="my-2 py-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col space-y-1">
              <div className="flex pt-3 text-4xl font-bold tracking-tighter">Practice</div>
              <div className="flex text-md font-medium text-gray-400">
                SAT practice activity, scores and question bank across your students
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setDays(r.value)}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      days === r.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {stats && (
                <a
                  href={stats.cmsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white nice-shadow transition-colors hover:bg-neutral-800"
                >
                  <ArrowSquareOut size={14} weight="bold" />
                  Manage questions
                </a>
              )}
            </div>
          </div>
        </div>
        <DashTabBar
          tabs={[
            {
              key: 'overview',
              label: 'Overview',
              icon: <ChartLine size={16} />,
              onClick: () => setTab('overview'),
              active: tab === 'overview',
            },
            {
              key: 'students',
              label: 'Students',
              icon: <Users size={16} />,
              onClick: () => setTab('students'),
              active: tab === 'students',
            },
            {
              key: 'questions',
              label: 'Questions',
              icon: <ListChecks size={16} />,
              onClick: () => setTab('questions'),
              active: tab === 'questions',
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-10">
        {state.status === 'loading' && <LoadingGrid />}
        {state.status === 'forbidden' && (
          <Notice icon={<LockSimple size={22} />} title="Admins only">
            Practice statistics include every student&apos;s results, so only organization admins
            can see them.
          </Notice>
        )}
        {state.status === 'error' && (
          <Notice icon={<Warning size={22} />} title="Couldn't load practice statistics">
            {state.message}
            <button
              type="button"
              onClick={load}
              className="mt-4 block w-fit cursor-pointer rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white"
            >
              Try again
            </button>
          </Notice>
        )}
        {stats && tab === 'overview' && <Overview stats={stats} />}
        {stats && tab === 'students' && <Students stats={stats} />}
        {stats && tab === 'questions' && <Questions stats={stats} />}
      </div>
    </div>
  )
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-white nice-shadow', className)}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl bg-white p-4 nice-shadow">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-gray-900">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-gray-400">{children}</div>
}

function Notice({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-xl bg-white p-8 text-center nice-shadow">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-50 text-gray-500">
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-gray-900">{title}</h2>
      <div className="mt-1 flex flex-col items-center text-sm text-gray-500">{children}</div>
    </div>
  )
}

function AccuracyBar({ correct, total }: { correct: number; total: number }) {
  const value = pct(correct, total)
  const tone = accuracyTone(value)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full', tone.bar)}
          style={{ width: `${total ? value : 0}%` }}
        />
      </div>
      <span
        className={cn(
          'w-9 shrink-0 text-right text-xs font-semibold tabular-nums',
          total ? tone.text : 'text-gray-300'
        )}
      >
        {total ? `${value}%` : '—'}
      </span>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-xl bg-gray-200/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-gray-200/70" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-gray-200/70" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-200/70" />
      </div>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────

function Overview({ stats }: { stats: Stats }) {
  const { kpis } = stats
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="Active students"
          value={kpis.students.toLocaleString()}
          icon={<Student size={15} weight="duotone" className="text-indigo-400" />}
        />
        <Kpi
          label="Questions answered"
          value={kpis.answers.toLocaleString()}
          icon={<CheckCircle size={15} weight="duotone" className="text-emerald-500" />}
        />
        <Kpi
          label="Average accuracy"
          value={kpis.answers ? `${pct(kpis.correct, kpis.answers)}%` : '—'}
          hint={kpis.answers ? `${kpis.correct.toLocaleString()} correct` : undefined}
          icon={<Target size={15} weight="duotone" className="text-rose-400" />}
        />
        <Kpi
          label="Practice tests"
          value={kpis.tests.toLocaleString()}
          icon={<Exam size={15} weight="duotone" className="text-amber-500" />}
        />
        <Kpi
          label="Avg. test score"
          value={kpis.avgTestScore != null ? String(kpis.avgTestScore) : '—'}
          hint={kpis.avgTestScore != null ? 'out of 1600' : undefined}
          icon={<ChartBar size={15} weight="duotone" className="text-sky-500" />}
        />
      </div>

      <Panel
        title="Daily activity"
        icon={<ChartLine size={16} weight="duotone" className="text-indigo-400" />}
      >
        {stats.daily.length === 0 ? (
          <Empty>No questions answered in this period.</Empty>
        ) : (
          <div className="h-[260px] px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(d: string) =>
                    new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
                  labelFormatter={(d) =>
                    new Date(`${String(d)}T00:00:00`).toLocaleDateString('en-US', {
                      dateStyle: 'medium',
                    })
                  }
                />
                <Bar
                  dataKey="correct"
                  name="Correct"
                  stackId="a"
                  fill="#34d399"
                  maxBarSize={40}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="incorrect"
                  name="Incorrect"
                  stackId="a"
                  fill="#fca5a5"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Accuracy by section"
          icon={<Target size={16} weight="duotone" className="text-rose-400" />}
        >
          <div className="space-y-5 p-5">
            {stats.sections.map((s) => (
              <div key={s.section} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-gray-800">{SECTION_LABELS[s.section]}</span>
                  <span className="text-xs text-gray-400">
                    {s.answers.toLocaleString()} answers · est. {s.answers ? s.estimatedScore : '—'}
                    /800
                  </span>
                </div>
                <AccuracyBar correct={s.correct} total={s.answers} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Recent practice tests"
          icon={<Exam size={16} weight="duotone" className="text-amber-500" />}
        >
          {stats.recentTests.length === 0 ? (
            <Empty>No practice tests completed in this period.</Empty>
          ) : (
            <ul className="divide-y divide-gray-50">
              {stats.recentTests.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {shortDate(t.completedAt)} · R&amp;W {t.rwScore} · Math {t.mathScore}
                    </p>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-gray-900">
                    {t.totalScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Skill accuracy"
        icon={<ListChecks size={16} weight="duotone" className="text-indigo-400" />}
      >
        {stats.skills.length === 0 ? (
          <Empty>No answers to break down yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                <th className="px-5 py-2.5 font-medium">Skill</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Domain</th>
                <th className="px-3 py-2.5 text-right font-medium">Answers</th>
                <th className="w-48 px-5 py-2.5 font-medium">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.skills.map((s) => (
                <tr key={`${s.section}-${s.skill}`}>
                  <td className="px-5 py-2.5">
                    <span className="font-medium text-gray-800">{s.label}</span>
                    <span className="ml-2 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                      {s.section === 'math' ? 'Math' : 'R&W'}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-gray-500 md:table-cell">{s.domain}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{s.answers}</td>
                  <td className="px-5 py-2.5">
                    <AccuracyBar correct={s.correct} total={s.answers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

function Students({ stats }: { stats: Stats }) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? stats.students.filter(
          (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        )
      : stats.students
  }, [stats.students, query])

  return (
    <Panel
      title={`Students (${stats.students.length})`}
      icon={<Users size={16} weight="duotone" className="text-indigo-400" />}
      action={
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students"
            aria-label="Search students"
            className="w-48 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      }
    >
      {stats.students.length === 0 ? (
        <Empty>No students have practiced in this period.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-5 py-2.5 font-medium">Student</th>
                <th className="px-3 py-2.5 text-right font-medium">Answers</th>
                <th className="w-44 px-3 py-2.5 font-medium">Accuracy</th>
                <th className="px-3 py-2.5 text-right font-medium">Tests</th>
                <th className="px-3 py-2.5 text-right font-medium">Best score</th>
                <th className="px-5 py-2.5 text-right font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((s) => (
                <tr key={s.userId} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold uppercase text-gray-600">
                        {s.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{s.name}</p>
                        {s.email && <p className="truncate text-xs text-gray-400">{s.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">{s.answers}</td>
                  <td className="px-3 py-3">
                    <AccuracyBar correct={s.correct} total={s.answers} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">{s.tests}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {s.bestScore ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">
                    {shortDate(s.lastActive)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty>No students match “{query}”.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function Questions({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {(['english', 'math'] as const).map((section) => {
          const rows = stats.bank.filter((b) => b.section === section)
          const total = rows.reduce((n, r) => n + r.questions, 0)
          return (
            <Panel
              key={section}
              title={`${SECTION_LABELS[section]} · ${total.toLocaleString()} questions`}
              icon={
                <ListChecks
                  size={16}
                  weight="duotone"
                  className={section === 'math' ? 'text-sky-500' : 'text-indigo-400'}
                />
              }
            >
              <ul className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <li
                    key={r.domain}
                    className="flex items-center justify-between px-5 py-2.5 text-sm"
                  >
                    <span className="text-gray-700">{r.label}</span>
                    <span
                      className={cn(
                        'tabular-nums',
                        r.questions ? 'font-semibold text-gray-900' : 'text-amber-600'
                      )}
                    >
                      {r.questions ? r.questions.toLocaleString() : 'None yet'}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })}
      </div>

      <Panel
        title="Hardest questions"
        icon={<Warning size={16} weight="duotone" className="text-red-400" />}
        action={
          <span className="text-xs text-gray-400">
            {stats.questionsAnswered.toLocaleString()} of {stats.bankTotal.toLocaleString()}{' '}
            questions answered at least once
          </span>
        }
      >
        {stats.hardest.length === 0 ? (
          <Empty>Questions show up here once they&apos;ve been answered at least 3 times.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-2.5 font-medium">Question</th>
                  <th className="px-3 py-2.5 font-medium">Skill</th>
                  <th className="px-3 py-2.5 text-right font-medium">Answers</th>
                  <th className="w-40 px-3 py-2.5 font-medium">Accuracy</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.hardest.map((q) => (
                  <tr key={q.id}>
                    <td className="max-w-md px-5 py-3">
                      <p className="line-clamp-2 text-gray-800">{q.prompt}</p>
                      <p className="mt-0.5 text-xs capitalize text-gray-400">
                        {q.section === 'math' ? 'Math' : 'R&W'} · {q.difficulty} · #{q.id}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{q.skill}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">{q.answers}</td>
                    <td className="px-3 py-3">
                      <AccuracyBar correct={q.correct} total={q.answers} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <a
                        href={q.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
                      >
                        Edit <ArrowSquareOut size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
