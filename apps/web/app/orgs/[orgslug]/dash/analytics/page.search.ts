import { GraduationCap } from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMeta: SearchMeta = {
  id: 'practice.practice',
  titleKey: 'Practice',
  descriptionKey: 'Manage standardized practice exam questionnaires',
  keywordsKey: 'standardized, exams, tests, practice, quizzes, questions, forms, management, assessment, prep, evaluation, templates',
  icon: GraduationCap,
  href: '/dash/practice',
  group: 'practice',
}
