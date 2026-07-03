'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  BookOpen,
  Users,
  ChatCircle,
  Microphone,
  Chalkboard,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { apiFetch } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import { getCommunities } from '@services/communities/communities'
import { getBoards } from '@services/boards/boards'
import { getOrgCourses } from '@services/courses/courses'
import { getOrgPodcasts } from '@services/podcasts/podcasts'

export default function ContentOverview() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug
  const orgId = org?.id
  const rf = org?.config?.config?.resolved_features
  const features = org?.config?.config?.features
  const isEnabled = (feature: string, defaultDisabled = false) => {
    if (rf?.[feature]) return rf[feature].enabled
    const v1 = features?.[feature]
    return defaultDisabled ? v1?.enabled === true : v1?.enabled !== false
  }

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'overview'],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 'overview'],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=1`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const communitiesEnabled = isEnabled('communities')
  const { data: communitiesData } = useQuery({
    queryKey: queryKeys.community.list(orgId),
    queryFn: () => getCommunities(orgId, 1, 500, null, token),
    enabled: !!communitiesEnabled && !!token && !!orgId,
    staleTime: 60_000,
  })

  const podcastsEnabled = isEnabled('podcasts', true)
  const { data: podcastsData } = useQuery({
    queryKey: [...queryKeys.podcasts.list(orgslug), 'overview'],
    queryFn: () => getOrgPodcasts(orgslug, null, token, true),
    enabled: !!podcastsEnabled && !!token && !!orgslug,
    staleTime: 60_000,
  })

  const boardsEnabled = isEnabled('boards', true)
  const { data: boardsData } = useQuery({
    queryKey: [...queryKeys.boards.list(orgslug), 'overview'],
    queryFn: () => getBoards(orgId, token),
    enabled: !!boardsEnabled && !!token && !!orgId,
    staleTime: 60_000,
  })

  const courses: any[] = coursesData ?? []
  const totalMembers = membersData?.total ?? 0
  const communities: any[] = communitiesData ?? []
  const podcasts: any[] = podcastsData ?? []
  const boards: any[] = boardsData ?? []

  const publishedCourses = courses.filter((c: any) => c.published).length
  const draftCourses = courses.length - publishedCourses

  const cards = [
    {
      label: t('dashboard.home.courses'),
      value: courses.length,
      sub: `${publishedCourses} ${t('dashboard.home.published')} · ${draftCourses} ${t('dashboard.home.draft')}`,
      icon: BookOpen,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      href: '/dash/courses',
      show: true,
    },
    {
      label: t('dashboard.home.members'),
      value: totalMembers,
      sub: t('dashboard.home.total_users'),
      icon: Users,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-50',
      href: '/dash/users/settings/users',
      show: true,
    },
    {
      label: t('dashboard.home.communities'),
      value: communities.length,
      sub: `${communities.filter((c: any) => c.public).length} ${t('dashboard.home.public')}`,
      icon: ChatCircle,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-50',
      href: '/dash/communities',
      show: communitiesEnabled,
    },
    {
      label: t('dashboard.home.podcasts'),
      value: podcasts.length,
      sub: `${podcasts.reduce((sum: number, p: any) => sum + (p.episode_count || 0), 0)} ${t('dashboard.home.episodes')}`,
      icon: Microphone,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      href: '/dash/podcasts',
      show: podcastsEnabled,
    },
    {
      label: t('dashboard.home.boards'),
      value: boards.length,
      sub: `${boards.reduce((sum: number, b: any) => sum + (b.member_count || 0), 0)} ${t('dashboard.home.participants')}`,
      icon: Chalkboard,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-50',
      href: '/dash/boards',
      show: boardsEnabled,
    },
  ]

  const visibleCards = cards.filter((c) => c.show)
  const isLoading = coursesLoading || membersLoading

  if (isLoading) {
    return (
        <div className="w-full grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleCards.map((card) => (
              <div
                  key={card.label}
                  className="w-full bg-white rounded-xl nice-shadow px-4 py-3.5 flex flex-col justify-between animate-pulse"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {/* Replicates the exact dimensions of p-1.5 padding + 18px icon (30px total) */}
                    <div className="w-[30px] h-[30px] bg-gray-100 rounded-md shrink-0" />
                    <div className="h-4 bg-gray-100 rounded w-20" />
                  </div>
                  {/* Replicates text-3xl value height */}
                  <div className="h-8 bg-gray-200 rounded w-14 mt-1" />
                </div>
                {/* Replicates mt-2 subtext field */}
                <div className="h-4 bg-gray-100 rounded w-32 mt-2" />
              </div>
          ))}
        </div>
    )
  }

  return (
      <div className="w-full grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleCards.map((card) => (
            <Link
                key={card.label}
                href={card.href}
                className="w-full bg-white rounded-xl nice-shadow px-4 py-3.5 hover:bg-gray-50 transition-colors group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${card.iconBg} flex items-center justify-center shrink-0`}>
                    <card.icon
                        size={18}
                        weight="duotone"
                        className={card.iconColor}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-400">
                {card.label}
              </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</div>
              </div>
              <p className="text-sm text-gray-400 mt-2 whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                {card.sub}
              </p>
            </Link>
        ))}
      </div>
  )
}