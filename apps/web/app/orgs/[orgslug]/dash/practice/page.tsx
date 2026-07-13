'use client';

import React, { useState } from 'react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { ChartBar, ChartLine } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useAnalyticsStatus } from '@components/Dashboard/Analytics/useAnalyticsDashboard'
import { isFeatureAvailable } from '@services/plans/plans'
import { DashTabBar } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'
import { usePlan } from '@components/Hooks/usePlan'
import ExportAnalyticsButton from '@components/Dashboard/Analytics/AnalyticsExport'


const DATE_RANGES = [
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
]

type Tab = 'overview'

export default function AnalyticsDashboard() {
  const [days, setDays] = useState('30')
  const [tab, setTab] = useState<Tab>('overview')
  const { data: analyticsStatus } = useAnalyticsStatus()
  const plan = usePlan()
  const isAnalyticsAvailable = isFeatureAvailable('analytics', plan)
  const isConfigured = analyticsStatus?.configured === true

  if (!isAnalyticsAvailable) {
    return (
      <></>
    )
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] flex flex-col">
      {/* Sticky header box */}
      <div className="pl-4 pr-4 sm:pl-10 sm:pr-10 tracking-tight bg-[#fcfbfc] z-10 nice-shadow flex-shrink-0 relative">
        <div className="pt-6 pb-4">
          <Breadcrumbs items={[
            { label: 'Practice', href: '/dash/practice', icon: <ChartBar size={14} /> }
          ]} />
        </div>
        <div className="my-2 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col space-y-1">
              <div className="pt-3 flex font-bold text-4xl tracking-tighter">
                Practice
              </div>
              <div className="flex font-medium text-gray-400 text-md">
                Manage standardized practice exam questionnaires
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setDays(r.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      days === r.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DashTabBar tabs={[
          {
            key: 'overview',
            label: 'Overview',
            icon: <ChartLine size={16} />,
            onClick: () => setTab('overview'),
            active: tab === 'overview',
          },
        ]} />
      </div>
    </div>
  )
}
