'use client'
import React from 'react'
import Link from 'next/link'
import {
  Broadcast,
  UserPlus,
  GraduationCap,
  CheckCircle,
  ChartBar,
  ArrowRight,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import {
  useAnalyticsPipe,
  useAnalyticsStatus,
} from '@components/Dashboard/Analytics/useAnalyticsDashboard'
import { AnimatedNumber } from '@components/Dashboard/Analytics/Course/CourseWidgetCard'

export default function QuickStats() {
  const { t } = useTranslation()
  const { data: statusData, isLoading: statusLoading } = useAnalyticsStatus()
  const isConfigured = statusData?.configured === true

  if (statusLoading) {
    return (
        <div className="bg-white rounded-xl nice-shadow p-5 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-24 my-0.5" />
            <div className="h-4 bg-gray-100 rounded w-28 my-0.5" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[30px] h-[30px] bg-gray-100 rounded-md shrink-0" />
                    <div className="h-4 bg-gray-100 rounded w-28" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-8" />
                </div>
            ))}
          </div>
        </div>
    )
  }

  if (!isConfigured) {
    return (
        <div className="bg-white rounded-xl nice-shadow p-5">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-2.5 rounded-full bg-gray-100 mb-2.5">
              <ChartBar size={18} weight="duotone" className="text-gray-400" />
            </div>
            <h3 className="text-md font-semibold text-gray-600 mb-1">
              {t('dashboard.home.analytics')}
            </h3>
            <p className="text-sm text-gray-400 mb-3 max-w-50">
              {t('dashboard.home.enable_analytics_description')}
            </p>
            <Link
                href="/dash/analytics"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <div className="flex flex-row gap-1 items-center">
                <span>{t('dashboard.home.enable')}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          </div>
        </div>
    )
  }

  return <QuickStatsContent />
}

function QuickStatsContent() {
  const { t } = useTranslation()
  const { data: eventData, isLoading: eventsLoading } = useAnalyticsPipe(
      'event_counts',
      { days: '30' }
  )
  const { data: liveData, isLoading: liveLoading } = useAnalyticsPipe(
      'live_users',
      {},
      120000
  )

  const rows: any[] = eventData?.data ?? []
  const liveCount = liveData?.data?.[0]?.live_users ?? 0

  const signups =
      rows.find((r) => r.event_name === 'user_signed_up')?.unique_users ?? 0
  const enrollments =
      rows.find((r) => r.event_name === 'course_enrolled')?.unique_users ?? 0
  const completions =
      rows.find((r) => r.event_name === 'course_completed')?.unique_users ?? 0

  const stats = [
    {
      label: t('dashboard.home.live_now'),
      value: liveCount,
      loading: liveLoading,
      icon: Broadcast,
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      label: t('dashboard.home.signups_30d'),
      value: signups,
      loading: eventsLoading,
      icon: UserPlus,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      label: t('dashboard.home.enrollments_30d'),
      value: enrollments,
      loading: eventsLoading,
      icon: GraduationCap,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50',
    },
    {
      label: t('dashboard.home.completions_30d'),
      value: completions,
      loading: eventsLoading,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
  ]

  return (
      <div className="bg-white rounded-xl nice-shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-700">{t('dashboard.home.quick_stats')}</h3>
          <Link
              href="/dash/analytics"
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <div className="flex flex-row gap-1 items-center">
              <span>{t('dashboard.home.full_analytics')}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>
        <div className="space-y-3">
          {stats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-md ${stat.bg} flex items-center justify-center shrink-0`}>
                    <stat.icon size={18} weight="duotone" className={stat.color} />
                  </div>
                  <span className="text-sm text-gray-500">{stat.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
              {stat.loading ? '\u2014' : <AnimatedNumber value={stat.value} />}
            </span>
              </div>
          ))}
        </div>
      </div>
  )
}