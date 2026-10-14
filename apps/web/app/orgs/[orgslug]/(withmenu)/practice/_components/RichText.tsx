'use client'

import 'katex/dist/katex.min.css'
import { Fragment, type ReactNode, useMemo } from 'react'
import { BlockMath, InlineMath } from 'react-katex'
import { cn } from '@/lib/utils'

// Renders question text from the CMS: paragraphs, line breaks, **bold**,
// fill-in blanks (____), ![images](url) and — for math — LaTeX in $…$, \(…\),
// $$…$$, \[…\] and align environments, plus bare commands like 25\pi.

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string }
  | { kind: 'block'; value: string }
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'table'; rows: string[][] }

// Escaped currency (\$40) must never open math mode.
const LITERAL_DOLLAR = '\uE000'

function splitText(
  segments: Segment[],
  pattern: RegExp,
  toSegment: (match: RegExpExecArray) => Segment | null
): Segment[] {
  const out: Segment[] = []
  for (const segment of segments) {
    if (segment.kind !== 'text') {
      out.push(segment)
      continue
    }
    const regex = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    )
    let last = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(segment.value)) !== null) {
      const replacement = toSegment(match)
      if (!replacement) continue
      if (match.index > last)
        out.push({ kind: 'text', value: segment.value.slice(last, match.index) })
      out.push(replacement)
      last = match.index + match[0].length
      if (match[0].length === 0) regex.lastIndex++
    }
    if (last < segment.value.length) out.push({ kind: 'text', value: segment.value.slice(last) })
  }
  return out
}

const MATHY = /[=+\-*/\\^_<>≤≥≠()0-9]/

function tokenize(text: string, math: boolean): Segment[] {
  let segments: Segment[] = [{ kind: 'text', value: text.replace(/[\u200B-\u200D\uFEFF]/g, '') }]

  segments = splitText(segments, /!\[([^\]]*)\]\(([^)\s]+)\)/, (m) => ({
    kind: 'image',
    alt: m[1] || 'Figure',
    src: m[2],
  }))
  // KaTeX has no tabular environment; data tables become real HTML tables.
  segments = splitText(
    segments,
    /\\begin\{tabular\}(?:\{[^}]*\})?([\s\S]*?)\\end\{tabular\}/,
    (m) => ({
      kind: 'table',
      rows: m[1]
        .split(/\\\\|\\hline/)
        .map((row) => row.split('&').map((cell) => cell.trim()))
        .filter((cells) => cells.some(Boolean)),
    })
  )
  if (!math) return segments

  segments = segments.map((s) =>
    s.kind === 'text' ? { ...s, value: s.value.replace(/\\\$/g, LITERAL_DOLLAR) } : s
  )
  segments = splitText(
    segments,
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(\\begin\{(align\*?|aligned|equation\*?|gather\*?)\}[\s\S]+?\\end\{\4\})/,
    (m) => ({ kind: 'block', value: (m[1] ?? m[2] ?? m[3] ?? '').trim() })
  )
  segments = splitText(segments, /\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/, (m) => {
    const inner = (m[1] ?? m[2] ?? '').trim()
    // "$5 and up to $10" style prose is text, not math.
    if (m[2] !== undefined && !MATHY.test(inner) && inner.split(/\s+/).length > 3) return null
    return { kind: 'math', value: inner }
  })
  // Bare LaTeX outside delimiters, e.g. answer choices like "25\pi".
  segments = splitText(segments, /[\w^{}().]*\\[a-zA-Z]+(?:\{[^{}]*\}|[\w^{}().])*/, (m) => ({
    kind: 'math',
    value: m[0],
  }))
  // Plain fractions render stacked, as on the real test.
  segments = splitText(segments, /(?<![\w/.])(\d+)\/(\d+)(?![\w/])/, (m) => ({
    kind: 'math',
    value: `\\frac{${m[1]}}{${m[2]}}`,
  }))

  return segments.map((s) => {
    if (s.kind === 'text') return { ...s, value: s.value.replaceAll(LITERAL_DOLLAR, '$') }
    if (s.kind === 'math' || s.kind === 'block')
      return { ...s, value: s.value.replaceAll(LITERAL_DOLLAR, '\\$') }
    return s
  })
}

/** **bold** and fill-in blanks inside a plain text run. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_{2,})/g).flatMap((part, i) => {
    if (!part) return []
    const key = `${keyPrefix}-${i}`
    if (/^_{2,}$/.test(part)) {
      return (
        <span
          key={key}
          aria-label="blank"
          className="inline-block w-16 mx-1 align-baseline border-b-2 border-gray-400"
        />
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

function MathFallback({ value }: { value: string }) {
  return <span className="font-mono text-[0.9em] text-gray-600">{value}</span>
}

export function RichText({
  text,
  math = false,
  className,
}: {
  text: string
  math?: boolean
  className?: string
}) {
  const blocks = useMemo(() => {
    const segments = tokenize(text ?? '', math)
    const out: ReactNode[] = []
    let paragraph: ReactNode[] = []
    let hasContent = false
    const flush = () => {
      if (hasContent) {
        out.push(
          <p key={`p-${out.length}`} className="whitespace-pre-line">
            {paragraph}
          </p>
        )
      }
      paragraph = []
      hasContent = false
    }

    segments.forEach((segment, i) => {
      if (segment.kind === 'text') {
        segment.value.split(/\n{2,}/).forEach((piece, j) => {
          if (j > 0) flush()
          // Drop newlines left at a paragraph's start; keep inner single breaks.
          const run = hasContent ? piece : piece.replace(/^\s*\n/, '')
          if (run.trim()) hasContent = true
          paragraph.push(...renderInline(run, `t${i}-${j}`))
        })
      } else if (segment.kind === 'math') {
        hasContent = true
        paragraph.push(
          <InlineMath
            key={`m${i}`}
            math={segment.value}
            renderError={() => <MathFallback value={segment.value} />}
          />
        )
      } else if (segment.kind === 'table') {
        flush()
        out.push(
          <div key={`tb${i}`} className="overflow-x-auto">
            <table className="min-w-full border-collapse overflow-hidden rounded-lg text-sm">
              <tbody>
                {segment.rows.map((row, r) => (
                  <tr
                    key={r}
                    className={r === 0 ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'}
                  >
                    {row.map((cell, c) => (
                      <td key={c} className="border border-gray-200 px-3 py-2 text-center">
                        <RichText text={cell} math={math} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      } else {
        flush()
        out.push(
          segment.kind === 'image' ? (
            <figure key={`i${i}`} className="flex justify-center">
              <img
                src={segment.src}
                alt={segment.alt}
                className="max-w-full max-h-[420px] h-auto object-contain rounded-lg border border-gray-100"
              />
            </figure>
          ) : (
            <div key={`b${i}`} className="overflow-x-auto">
              <BlockMath
                math={segment.value}
                renderError={() => <MathFallback value={segment.value} />}
              />
            </div>
          )
        )
      }
    })
    flush()
    return out
  }, [text, math])

  return <div className={cn('space-y-3 break-words', className)}>{blocks}</div>
}
