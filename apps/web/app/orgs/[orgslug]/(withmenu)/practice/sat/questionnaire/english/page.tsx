'use client'

import { Suspense } from 'react'
import { PracticeRunner } from '../../../_components/PracticeRunner'

export default function EnglishPracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeRunner section="english" />
    </Suspense>
  )
}
