'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { getOrgCourses } from '@services/courses/courses'
import { SafeImage } from '@components/Objects/SafeImage'
import { BookOpen, PlusCircle, Clock, ArrowRight } from '@phosphor-icons/react'

export default function RecentCourses() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug

  const { data: coursesData, isLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'recent', 8],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  const courses: any[] = coursesData ?? []
  const publishedCount = courses.filter((c: any) => c.published).length
  const draftCount = courses.filter((c: any) => !c.published).length

  return (
      <div className="w-full bg-white rounded-xl nice-shadow overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-md font-semibold text-gray-700">
              {t('dashboard.home.recent_courses')}
            </h2>
            {courses.length > 0 && (
                <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                {publishedCount} {t('dashboard.home.published')}
              </span>
                  {draftCount > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {draftCount} {t('dashboard.home.draft')}
                </span>
                  )}
                </div>
            )}
          </div>
          <Link
              href="/dash/courses"
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <div className="flex flex-row gap-1 items-center text-sm">
              <span>{t('dashboard.home.view_all')}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>

        {isLoading ? (
            <div className="divide-y divide-gray-50 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                    <div className="w-9 h-9 bg-gray-100 rounded-md shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-200 rounded w-40" />
                      <div className="h-4 bg-gray-100 rounded w-24 mt-1.5" />
                    </div>
                    <div className="w-16 h-5 bg-gray-100 rounded-full shrink-0" />
                  </div>
              ))}
            </div>
        ) : courses.length === 0 ? (
            <div className="px-6 py-6">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 rounded-full bg-gray-100 mb-3">
                  <BookOpen
                      size={24}
                      weight="duotone"
                      className="text-gray-400"
                  />
                </div>
                <p className="text-sm text-gray-400 mb-1">{t('dashboard.home.no_courses_yet')}</p>
                <Link
                    href="/dash/courses?new=true"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <PlusCircle size={18} weight="bold" />
                  {t('dashboard.home.create_your_first_course')}
                </Link>
              </div>
            </div>
        ) : (
            <div className="divide-y divide-gray-50">
              {courses.slice(0, 8).map((course: any) => {
                const courseId = course.course_uuid?.replace('course_', '')
                const thumbnail = course.thumbnail_image
                    ? getCourseThumbnailMediaDirectory(
                        org.org_uuid,
                        course.course_uuid,
                        course.thumbnail_image
                    )
                    : null
                const updatedAt = course.update_date
                    ? new Date(course.update_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                    : null

                return (
                    <Link
                        key={course.course_uuid}
                        prefetch={false}
                        href={`/dash/courses/course/${courseId}/general`}
                        className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-md bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {thumbnail ? (
                            <SafeImage
                                src={thumbnail}
                                alt={course.name}
                                width={36}
                                height={36}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <BookOpen
                                size={18}
                                weight="duotone"
                                className="text-gray-300"
                            />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900">
                          {course.name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {updatedAt && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Clock size={18} />
                                {updatedAt}
                      </span>
                          )}
                          {course.chapters_count !== undefined && (
                              <span className="text-[11px] text-gray-400">
                        {course.chapters_count} {course.chapters_count !== 1 ? t('dashboard.home.chapters') : t('dashboard.home.chapter')}
                      </span>
                          )}
                        </div>
                      </div>
                      <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                              course.published
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-gray-100 text-gray-500'
                          }`}
                      >
                  {course.published ? t('dashboard.home.published') : t('dashboard.home.draft')}
                </span>
                    </Link>
                )
              })}
            </div>
        )}
      </div>
  )
}