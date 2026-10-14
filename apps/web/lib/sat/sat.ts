// Shared SAT practice types and helpers (safe for both client and server).
// Question content comes from the Payload CMS `questions` collection
// (apps/payload/src/collections/Questions.ts).

export type Section = 'english' | 'math'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Choice {
  key: string
  text: string
}

export interface SatQuestion {
  id: string
  section: Section
  /** Reading & Writing passage. Empty for math and for prompts with no passage. */
  passage: string
  /** The question itself. */
  prompt: string
  choices: Choice[]
  /** Correct choice key: 'A' | 'B' | 'C' | 'D'. */
  answer: string
  explanation: string
  domain: string | null
  skill: string | null
  difficulty: Difficulty
}

export const SECTION_LABELS: Record<Section, string> = {
  english: 'Reading and Writing',
  math: 'Math',
}

// Values mirror the select options in the Payload Questions collection.
export const DOMAINS: Record<Section, Record<string, string>> = {
  english: {
    craft: 'Craft and Structure',
    ideas: 'Information and Ideas',
    conventions: 'Standard English Conventions',
    expression: 'Expression of Ideas',
  },
  math: {
    algebra: 'Algebra',
    advanced: 'Advanced Math',
    problem: 'Problem-Solving and Data Analysis',
    geometry: 'Geometry and Trigonometry',
  },
}

export const SKILL_LABELS: Record<string, string> = {
  vocabulary: 'Words in Context',
  purpose: 'Text Structure and Purpose',
  connections: 'Cross-Text Connections',
  details: 'Central Ideas and Details',
  evidence_text: 'Command of Evidence (Textual)',
  evidence_graph: 'Command of Evidence (Quantitative)',
  inferences: 'Inferences',
  punctuation: 'Boundaries',
  grammar: 'Form, Structure, and Sense',
  rhetorical: 'Rhetorical Synthesis',
  transitions: 'Transitions',
  linear_one: 'Linear Equations in One Variable',
  linear_two: 'Linear Equations in Two Variables',
  linear_functions: 'Linear Functions',
  linear_systems: 'Systems of Linear Equations',
  equivalent: 'Equivalent Expressions',
  quadratics: 'Quadratic and Exponential Functions',
  nonlinear_systems: 'Nonlinear Systems',
  ratios: 'Ratios, Rates, and Proportions',
  percentages: 'Percentages',
  probability: 'Probability',
  statistics: 'Statistics and Margin of Error',
  geometry_3d: 'Area and Volume',
  triangles: 'Lines, Angles, and Triangles',
  trig: 'Right Triangles and Trigonometry',
  circles: 'Circles',
}

// Bluebook orders Reading and Writing questions by domain.
export const DOMAIN_ORDER = ['craft', 'ideas', 'conventions', 'expression']

export function domainLabel(section: Section, domain: string | null | undefined): string {
  if (!domain) return SECTION_LABELS[section]
  return DOMAINS[section][domain] ?? humanize(domain)
}

export function skillLabel(skill: string | null | undefined): string {
  if (!skill) return 'General practice'
  return SKILL_LABELS[skill] ?? humanize(skill)
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function isCorrectChoice(question: SatQuestion, key: string | undefined): boolean {
  return !!key && key.trim().toUpperCase() === question.answer
}

/** Section score on the 200–800 scale (linear on accuracy, as before). */
export function sectionScore(correct: number, total: number): number {
  if (total <= 0) return 200
  return Math.min(800, Math.max(200, Math.round(200 + (correct / total) * 600)))
}

// ── Payload → SatQuestion ────────────────────────────────────────────────────

interface LexicalNode {
  type?: string
  text?: string
  format?: number
  tag?: string
  url?: string
  src?: string
  value?: { url?: string; alt?: string; filename?: string } | null
  fields?: Record<string, any> | null
  children?: LexicalNode[]
}

/**
 * Flattens Payload Lexical rich text to the lightweight markdown the practice
 * renderer understands: paragraphs separated by blank lines, **bold**,
 * *italic*, and ![alt](url) images (relative upload URLs made absolute).
 */
export function lexicalToText(value: unknown, mediaBaseUrl = ''): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const root = (value as { root?: LexicalNode }).root
  if (!root) return ''

  const absolute = (url: string) =>
    url.startsWith('/') && mediaBaseUrl ? `${mediaBaseUrl}${url}` : url

  const render = (node: LexicalNode): string => {
    if (node.type === 'text') {
      let text = node.text ?? ''
      if (text && node.format && node.format & 1) text = `**${text}**`
      if (text && node.format && node.format & 2) text = `*${text}*`
      return text
    }
    if (node.type === 'linebreak') return '\n'
    if (node.type === 'upload' || node.type === 'image') {
      const url = node.value?.url || node.url || node.src
      return url ? `![${node.value?.alt || 'Figure'}](${absolute(url)})` : ''
    }
    const inner = (node.children ?? []).map(render).join('')
    if (node.type === 'listitem') return `- ${inner}`
    if (node.type === 'list') return (node.children ?? []).map(render).join('\n')
    return inner
  }

  return (root.children ?? [])
    .map(render)
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
}

/**
 * Reading and Writing stimuli store the passage and the question in one text
 * block separated by a blank line. Split them so the passage can sit in its
 * own pane like the real Digital SAT.
 */
export function splitPassage(text: string): { passage: string; prompt: string } {
  const trimmed = text.trim()
  const cut = trimmed.lastIndexOf('\n\n')
  if (cut > 0) {
    const prompt = trimmed.slice(cut + 2).trim()
    if (prompt.length > 0 && prompt.length < 400) {
      return { passage: trimmed.slice(0, cut).trim(), prompt }
    }
  }
  return { passage: '', prompt: trimmed }
}

const KEYS = ['A', 'B', 'C', 'D', 'E']

export function normalizeQuestion(doc: any, mediaBaseUrl = ''): SatQuestion | null {
  if (!doc?.id) return null
  const section: Section = doc.section === 'math' ? 'math' : 'english'
  const domain: string | null =
    (section === 'english' ? doc.domain : doc.topic) || doc.domain || null
  const skill: string | null = domain ? (doc[domain] ?? null) : null

  const seen = new Set<string>()
  const choices: Choice[] = []
  for (const option of doc.options ?? []) {
    const text = String(typeof option === 'object' ? (option?.text ?? '') : option).trim()
    if (!text || seen.has(text) || choices.length >= KEYS.length) continue
    seen.add(text)
    choices.push({ key: KEYS[choices.length], text })
  }
  if (choices.length < 2) return null

  const stimulus = lexicalToText(doc.stimulus, mediaBaseUrl)
  const { passage, prompt } =
    section === 'english' ? splitPassage(stimulus) : { passage: '', prompt: stimulus.trim() }

  return {
    id: String(doc.id),
    section,
    passage,
    prompt,
    choices,
    answer: String(doc.answer ?? '')
      .trim()
      .toUpperCase(),
    explanation: lexicalToText(doc.explanation, mediaBaseUrl),
    domain,
    skill,
    difficulty: ['easy', 'medium', 'hard'].includes(doc.difficulty) ? doc.difficulty : 'medium',
  }
}
