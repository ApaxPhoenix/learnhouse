'use client'

import { Suspense } from 'react'
import { PracticeRunner } from '../../../_components/PracticeRunner'

export default function MathPracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeRunner section="math" />
    </Suspense>
  )
}
