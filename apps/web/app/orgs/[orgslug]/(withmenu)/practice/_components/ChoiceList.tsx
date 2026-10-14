'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Choice } from '@/lib/sat/sat'
import { RichText } from './RichText'

interface ChoiceListProps {
  choices: Choice[]
  selected?: string
  onSelect: (key: string) => void
  /** Cross-out mode: clicking a choice strikes it out instead of selecting it. */
  eliminateMode?: boolean
  eliminated?: string[]
  onToggleEliminated?: (key: string) => void
  /** When set, show which choice was right (practice feedback / test review). */
  revealAnswer?: string
  disabled?: boolean
  math?: boolean
}

export function ChoiceList({
  choices,
  selected,
  onSelect,
  eliminateMode = false,
  eliminated = [],
  onToggleEliminated,
  revealAnswer,
  disabled = false,
  math = false,
}: ChoiceListProps) {
  const revealed = !!revealAnswer
  const crossOut = eliminateMode && !revealed && !disabled && !!onToggleEliminated

  return (
    <div className="space-y-2.5" role="radiogroup">
      {crossOut && (
        <p className="text-xs text-gray-500">
          Cross-out is on — click a choice to strike it out, click it again to bring it back. Turn
          off <span className="font-medium text-gray-700">Eliminate</span> to answer.
        </p>
      )}
      {choices.map((choice) => {
        const isSelected = selected === choice.key
        const isEliminated = eliminated.includes(choice.key) && !revealed
        const isAnswer = revealed && revealAnswer === choice.key
        const isWrongPick = revealed && isSelected && !isAnswer

        // Cross-out mode toggles the strike; otherwise a crossed-out choice is
        // restored on click (never answered by accident), anything else selected.
        const handleClick = () => {
          if (crossOut || (isEliminated && onToggleEliminated)) onToggleEliminated?.(choice.key)
          else onSelect(choice.key)
        }

        return (
          <button
            key={choice.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={handleClick}
            title={
              crossOut
                ? isEliminated
                  ? 'Click to bring this choice back'
                  : 'Click to cross out this choice'
                : isEliminated
                  ? 'Crossed out — click to bring it back'
                  : undefined
            }
            className={cn(
              'group relative flex w-full items-start gap-3 rounded-xl border bg-white px-4 py-3 text-left text-[15px] transition-colors',
              !disabled && 'cursor-pointer',
              !revealed &&
                !isSelected &&
                !isEliminated &&
                'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              crossOut && !isEliminated && 'hover:border-dashed',
              !revealed && isSelected && !isEliminated && 'border-black ring-1 ring-black',
              isEliminated && 'border-gray-200 bg-gray-50/80',
              isAnswer && 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500',
              isWrongPick && 'border-red-400 bg-red-50/70 ring-1 ring-red-400',
              revealed && !isAnswer && !isWrongPick && 'border-gray-100 opacity-60'
            )}
          >
            <span
              className={cn(
                'mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                !revealed &&
                  !isSelected &&
                  !isEliminated &&
                  'border-gray-300 text-gray-600 group-hover:border-gray-400',
                !revealed && isSelected && !isEliminated && 'border-black bg-black text-white',
                isEliminated && 'border-gray-300 text-gray-400',
                isAnswer && 'border-emerald-500 bg-emerald-500 text-white',
                isWrongPick && 'border-red-500 bg-red-500 text-white',
                revealed && !isAnswer && !isWrongPick && 'border-gray-200 text-gray-400'
              )}
            >
              {isAnswer ? (
                <Check size={14} strokeWidth={3} />
              ) : isWrongPick ? (
                <X size={14} strokeWidth={3} />
              ) : (
                choice.key
              )}
            </span>
            <RichText
              text={choice.text}
              math={math}
              className={cn('flex-1 pt-0.5 text-gray-800', isEliminated && 'text-gray-400')}
            />
            {/* The strike: one line across the whole choice, like Bluebook. */}
            {isEliminated && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-gray-500/80"
              />
            )}
            {isEliminated && <span className="sr-only">(crossed out)</span>}
          </button>
        )
      })}
    </div>
  )
}
