'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  BookOpen,
  Users,
  ShieldCheck,
  Chalkboard,
  ChatCircle,
  Microphone,
  ArrowRight,
  Lightning,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { OrgUsageResponse, getOrgUsage } from '@services/orgs/usage'
import { apiFetch } from '@services/utils/ts/requests'

interface AICreditsSummary {
  plan: string
  base_credits: number | string
  purchased_credits: number
  total_credits: number | string
  used_credits: number
  remaining_credits: number | string
  mode?: string | null
}

function getBarColor(usage: number, limit: number | 'unlimited'): string {
  if (limit === 'unlimited') return 'bg-green-500'
  const pct = (usage / (limit as number)) * 100
  if (pct > 90) return 'bg-red-500'
  if (pct > 70) return 'bg-amber-500'
  return 'bg-green-500'
}

function getBarPercent(usage: number, limit: number | 'unlimited'): number {
  if (limit === 'unlimited') return Math.min(usage > 0 ? 30 : 0, 100)
  return Math.min((usage / (limit as number)) * 100, 100)
}

const METER_ICONS: Record<string, React.ComponentType<any>> = {
  Courses: BookOpen,
  Members: Users,
  'Admin Seats': ShieldCheck,
}

export default function UsageOverview() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgId = org?.id

  const { data: usageData, isLoading: isUsageLoading } = useQuery<OrgUsageResponse>({
    queryKey: queryKeys.org.usage(orgId),
    queryFn: () => getOrgUsage(orgId, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const { data: aiCredits, isLoading: isAiLoading } = useQuery<AICreditsSummary>({
    queryKey: ['org', orgId, 'ai-credits'],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/ai-credits`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const ossMode = usageData?.oss_mode ?? false
  const features = usageData?.features

  const meters = features
      ? [
        { key: 'Courses', label: t('dashboard.home.courses'), ...features.courses },
        { key: 'Members', label: t('dashboard.home.members'), ...features.members },
        { key: 'Admin Seats', label: t('dashboard.home.admin_seats'), ...features.admin_seats },
      ]
      : []

  const orgFeatures = org?.config?.config?.resolved_features || org?.config?.config?.features
  const enabledFeatures = [
    {
      key: 'courses',
      label: t('dashboard.home.courses'),
      icon: BookOpen,
      enabled: orgFeatures?.courses?.enabled !== false,
      href: '/dash/courses',
    },
    {
      key: 'communities',
      label: t('dashboard.home.communities'),
      icon: ChatCircle,
      enabled: orgFeatures?.communities?.enabled !== false,
      href: '/dash/communities',
    },
    {
      key: 'podcasts',
      label: t('dashboard.home.podcasts'),
      icon: Microphone,
      enabled: orgFeatures?.podcasts?.enabled === true,
      href: '/dash/podcasts',
    },
    {
      key: 'boards',
      label: t('dashboard.home.boards'),
      icon: Chalkboard,
      enabled: orgFeatures?.boards?.enabled === true,
      href: '/dash/boards',
    },
  ]

  return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl nice-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-semibold text-gray-700">{t('dashboard.home.plan_and_usage')}</h3>
          </div>

          <div className="space-y-5">
            {isUsageLoading ? (
                [1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[18px] h-[18px] bg-gray-100 rounded shrink-0" />
                          <div className="h-4 bg-gray-100 rounded w-24" />
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-14" />
                      </div>
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </div>
                ))
            ) : (
                meters.map((meter) => {
                  const isUnlimited = ossMode || meter.limit === 'unlimited'
                  const limitText = isUnlimited ? t('dashboard.home.unlimited') : String(meter.limit)
                  const barColor = isUnlimited
                      ? 'bg-green-500'
                      : getBarColor(meter.usage, meter.limit)
                  const barPercent = isUnlimited
                      ? 30
                      : getBarPercent(meter.usage, meter.limit)
                  const Icon = METER_ICONS[meter.key] || BookOpen

                  return (
                      <div key={meter.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <Icon
                                size={18}
                                weight="duotone"
                                className="text-gray-400 shrink-0"
                            />
                            <span className="text-sm font-medium text-gray-600">
                        {meter.label}
                      </span>
                          </div>
                          <span className="text-sm text-gray-400 tabular-nums">
                      {meter.usage} / {limitText}
                    </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${barPercent}%` }}
                          />
                        </div>
                        {!isUnlimited && meter.limit_reached && (
                            <p className="text-sm text-red-500 mt-1">
                              {t('dashboard.home.limit_reached')}
                            </p>
                        )}
                        {!isUnlimited && !meter.limit_reached && (
                            <p className="text-sm text-gray-300 mt-1">
                              {meter.remaining} {t('dashboard.home.remaining')}
                            </p>
                        )}
                      </div>
                  )
                })
            )}

            {isAiLoading ? (
                <div className="animate-pulse">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[18px] h-[18px] bg-gray-100 rounded shrink-0" />
                      <div className="h-4 bg-gray-100 rounded w-24" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-14" />
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full w-full" />
                </div>
            ) : aiCredits && aiCredits.mode !== 'disabled' ? (
                <AICreditsSection credits={aiCredits} />
            ) : null}

            {!isUsageLoading && meters.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t('dashboard.home.usage_data_unavailable')}
                </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl nice-shadow p-6">
          <h3 className="text-md font-semibold text-gray-700 mb-4">
            {t('dashboard.home.features')}
          </h3>
          <div className="space-y-2.5">
            {enabledFeatures.map((feature) => (
                <div
                    key={feature.key}
                    className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            feature.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    />
                    <feature.icon
                        size={18}
                        weight="duotone"
                        className={
                          feature.enabled ? 'text-gray-500 shrink-0' : 'text-gray-300 shrink-0'
                        }
                    />
                    <span
                        className={`text-sm ${
                            feature.enabled
                                ? 'text-gray-600 font-medium'
                                : 'text-gray-400'
                        }`}
                    >
                  {feature.label}
                </span>
                  </div>
                  {feature.enabled ? (
                      <Link href={feature.href} className="flex items-center">
                        <ArrowRight
                            size={14}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        />
                      </Link>
                  ) : (
                      <span className="text-[10px] text-gray-300">{t('dashboard.home.off')}</span>
                  )}
                </div>
            ))}
          </div>
        </div>
      </div>
  )
}

function AICreditsSection({ credits }: { credits: AICreditsSummary }) {
  const { t } = useTranslation()
  const total =
      typeof credits.total_credits === 'number' ? credits.total_credits : 0
  const used = credits.used_credits ?? 0
  const remaining =
      typeof credits.remaining_credits === 'number'
          ? credits.remaining_credits
          : null
  const isUnlimited =
      credits.total_credits === 'unlimited' ||
      credits.remaining_credits === 'unlimited'

  const percent = isUnlimited
      ? used > 0
          ? 30
          : 0
      : total > 0
          ? Math.min((used / total) * 100, 100)
          : 0

  const barColor = isUnlimited
      ? 'bg-violet-500'
      : percent > 90
          ? 'bg-red-500'
          : percent > 70
              ? 'bg-amber-500'
              : 'bg-violet-500'

  return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5">
            <Lightning size={18} weight="duotone" className="text-violet-400 shrink-0" />
            <span className="text-sm font-medium text-gray-600">{t('dashboard.home.ai_credits')}</span>
          </div>
          <span className="text-sm text-gray-400 tabular-nums">
          {used} / {isUnlimited ? t('dashboard.home.unlimited') : total}
        </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${percent}%` }}
          />
        </div>
        {isUnlimited ? (
            <p className="text-sm text-gray-300 mt-1">{used} {t('dashboard.home.used')}</p>
        ) : remaining !== null && remaining > 0 ? (
            <p className="text-sm text-gray-300 mt-1">{remaining} {t('dashboard.home.remaining')}</p>
        ) : remaining !== null && remaining <= 0 ? (
            <p className="text-sm text-red-500 mt-1">{t('dashboard.home.no_credits_remaining')}</p>
        ) : null}
        {credits.purchased_credits > 0 && (
            <p className="text-sm text-gray-300 mt-0.5">
              {t('dashboard.home.includes_purchased', { count: credits.purchased_credits })}
            </p>
        )}
      </div>
  )
}