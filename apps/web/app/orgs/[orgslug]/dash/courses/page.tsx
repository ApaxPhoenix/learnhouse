import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import CoursesHome from './client'

type PageProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  return {
    title: 'Courses — ' + (org?.name || ''),
    description: org?.description || '',
    keywords: `${org?.name || ''}, ${org?.description || ''}, courses, learning, education, online learning, edu, online courses`,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: 'Courses — ' + (org?.name || ''),
      description: org?.description || '',
      type: 'website',
    },
  }
}

async function CoursesPage(props: PageProps) {
  const params = await props.params
  const orgslug = params.orgslug

  return <CoursesHome orgslug={orgslug} />
}

export default CoursesPage