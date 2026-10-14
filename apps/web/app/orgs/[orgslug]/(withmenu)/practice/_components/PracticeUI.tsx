'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Loader2, Lock } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { cn } from '@/lib/utils'
import { domainLabel, type SatQuestion, skillLabel } from '@/lib/sat/sat'
import { RichText } from './RichText'

// ── Buttons (same recipes as the rest of LearnHouse) ────────────────────────

export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white nice-shadow transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

export const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-700 nice-shadow transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

export const toggleButton = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium nice-shadow transition-colors cursor-pointer',
    active ? 'bg-black text-white hover:bg-neutral-800' : 'bg-white text-gray-700 hover:bg-gray-50'
  )

// ── Cards & states ──────────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl bg-white nice-shadow', className)}>{children}</div>
}

export function StateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white nice-shadow text-gray-500">
          {icon}
        </div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
        {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
      </Card>
    </div>
  )
}

export function SignInCard({ description }: { description: string }) {
  return (
    <StateCard icon={<Lock size={20} />} title="Sign in to practice" description={description}>
      <Link href="/login" className={primaryButton}>
        Sign in
      </Link>
      <Link href="/signup" className={secondaryButton}>
        Create account
      </Link>
    </StateCard>
  )
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-200/70', className)} />
}

// ── Question layout ─────────────────────────────────────────────────────────

export function QuestionMeta({ question }: { question: SatQuestion }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
      <span className="font-medium text-gray-700">{skillLabel(question.skill)}</span>
      <span className="text-gray-300">•</span>
      <span>{domainLabel(question.section, question.domain)}</span>
      <span className="text-gray-300">•</span>
      <span className="capitalize">{question.difficulty}</span>
    </div>
  )
}

/**
 * Digital-SAT layout: Reading and Writing passages sit in their own pane with
 * the question and choices beside them; math is a single centered column.
 */
export function QuestionLayout({
  question,
  number,
  headerAction,
  children,
}: {
  question: SatQuestion
  number: number
  headerAction?: ReactNode
  children: ReactNode
}) {
  const math = question.section === 'math'
  const split = !math && question.passage.length > 0

  const prompt = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-black px-1.5 text-xs font-bold text-white">
            {number}
          </span>
          <QuestionMeta question={question} />
        </div>
        {headerAction}
      </div>
      <RichText
        text={question.prompt}
        math={math}
        className="text-[15px] leading-relaxed text-gray-900"
      />
      {children}
    </div>
  )

  return (
    <Card className="overflow-hidden">
      {split ? (
        <div className="grid lg:grid-cols-2">
          <div className="border-b border-gray-100 p-6 lg:border-b-0 lg:border-r lg:p-8 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
            <RichText text={question.passage} className="text-[15px] leading-7 text-gray-800" />
          </div>
          <div className="p-6 lg:p-8 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">{prompt}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl p-6 lg:p-8">{prompt}</div>
      )}
    </Card>
  )
}

export function Explanation({ question, correct }: { question: SatQuestion; correct: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        correct ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'
      )}
    >
      <p className={cn('text-sm font-semibold', correct ? 'text-emerald-700' : 'text-red-700')}>
        {correct ? 'Correct' : `Not quite. The answer is ${question.answer}.`}
      </p>
      {question.explanation && (
        <RichText
          text={question.explanation}
          math={question.section === 'math'}
          className="mt-2 text-sm leading-relaxed text-gray-700"
        />
      )}
    </div>
  )
}

// ── Fixed bottom bar (mirrors the course activity focus bar) ────────────────

export function BottomBar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <>
      <div className="h-24" aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/90 backdrop-blur-xl"
        style={{ zIndex: 'var(--z-modal-content)' }}
      >
        <div className="mx-auto flex h-16 max-w-(--breakpoint-2xl) items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0 text-sm text-gray-600">{left}</div>
          <div className="flex shrink-0 items-center gap-2">{right}</div>
        </div>
      </div>
    </>
  )
}

// ── Question navigator ──────────────────────────────────────────────────────

export type NavStatus = 'unanswered' | 'answered' | 'correct' | 'incorrect'

export function QuestionNavigator({
  open,
  onOpenChange,
  title,
  items,
  current,
  onJump,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: { id: string; status: NavStatus; flagged?: boolean }[]
  current: number
  onJump: (index: number) => void
}) {
  const showResults = items.some((i) => i.status === 'correct' || i.status === 'incorrect')
  const showFlags = items.some((i) => i.flagged)

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={onOpenChange}
      dialogTitle={title}
      dialogDescription="Jump to any question."
      customWidth="sm:max-w-2xl"
      dialogContent={
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <Legend className="ring-2 ring-black ring-offset-1 bg-white" label="Current" />
            {showResults ? (
              <>
                <Legend className="bg-emerald-500" label="Correct" />
                <Legend className="bg-red-500" label="Incorrect" />
              </>
            ) : (
              <Legend className="bg-gray-900" label="Answered" />
            )}
            <Legend className="border border-dashed border-gray-300 bg-white" label="Unanswered" />
            {showFlags && <Legend className="bg-amber-400" label="Marked for review" />}
          </div>
          <div className="grid max-h-[55vh] grid-cols-6 gap-2 overflow-y-auto p-1 sm:grid-cols-10">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onJump(index)
                  onOpenChange(false)
                }}
                className={cn(
                  'relative h-9 rounded-lg text-sm font-semibold tabular-nums transition-colors cursor-pointer',
                  item.status === 'unanswered' &&
                    'border border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-400',
                  item.status === 'answered' && 'bg-gray-900 text-white hover:bg-gray-700',
                  item.status === 'correct' && 'bg-emerald-500 text-white hover:bg-emerald-600',
                  item.status === 'incorrect' && 'bg-red-500 text-white hover:bg-red-600',
                  index === current && 'ring-2 ring-black ring-offset-2'
                )}
              >
                {index + 1}
                {item.flagged && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      }
    />
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-3 w-3 rounded', className)} />
      {label}
    </span>
  )
}
