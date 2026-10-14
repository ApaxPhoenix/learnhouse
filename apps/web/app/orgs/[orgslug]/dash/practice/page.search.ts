import { GraduationCap } from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMeta: SearchMeta = {
  id: 'dash.practice',
  // Not translated yet; t() falls back to the literal text.
  titleKey: 'Practice',
  descriptionKey: 'SAT practice statistics, students and question bank',
  keywordsKey: 'practice, sat, scores, questions, students, test',
  icon: GraduationCap,
  href: '/dash/practice',
  group: 'practice',
  requiresOrgAdmin: true,
}
