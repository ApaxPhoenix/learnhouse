"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    GraduationCap,
    Target,
    BookOpen,
    Chalkboard,
    CheckCircle,
    Clock,
    PlusCircle,
    ChartBar,
    Calendar,
    TrendUp,
    Trash,
    LockSimple
} from '@phosphor-icons/react'
import { getSatDashboardDataAction, clearSatMetricsAction } from './actions'

function getLevelStyles(percentage: number) {
    if (percentage < 60) {
        return { barColor: 'bg-red-500', textColor: 'text-red-500', bgColor: 'bg-red-50' }
    }
    if (percentage >= 60 && percentage < 85) {
        return { barColor: 'bg-amber-500', textColor: 'text-amber-500', bgColor: 'bg-amber-50' }
    }
    return { barColor: 'bg-green-500', textColor: 'text-green-500', bgColor: 'bg-green-50' }
}

function getProficiencyTier(percentage: number) {
    if (percentage < 60) {
        return { label: 'Below Minimum', badgeStyle: 'bg-red-50 text-red-600 border border-red-200' }
    }
    if (percentage >= 60 && percentage < 85) {
        return { label: 'Proficient', badgeStyle: 'bg-amber-50 text-amber-600 border border-amber-200' }
    }
    return { label: 'Outstanding', badgeStyle: 'bg-emerald-50 text-emerald-600 border border-emerald-200' }
}

export default function SatOverviewDashboard() {
    const [isLoading, setIsLoading] = useState(true)
    const [isUnauthorized, setIsUnauthorized] = useState(false)
    const [currentScore, setCurrentScore] = useState(400)
    const [targetScore] = useState(1540)
    const [examWindowDate, setExamWindowDate] = useState("August 29, 2026")
    const [tests, setTests] = useState<any[]>([])
    const [blindspots, setBlindspots] = useState<any[]>([])
    const [stats, setStats] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [sectionCardsData, setSectionCardsData] = useState<any[]>([])

    const loadDashboardData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await getSatDashboardDataAction()

            if (res.unauthorized) {
                setIsUnauthorized(true)
                return
            }

            if (res.success) {
                setCurrentScore(res.currentScore || 400)
                setTests(res.diagnosticRuns || [])
                setBlindspots(res.blindspots || [])
                if (res.examWindowDate) {
                    setExamWindowDate(res.examWindowDate)
                }

                const totalQuestions = res.totalQuestions || 0
                const engWeight = res.engScore ? Math.round(((res.engScore - 200) / 600) * 100) : 0
                const mathWeight = res.mathScore ? Math.round(((res.mathScore - 200) / 600) * 100) : 0

                setCategories([
                    { label: 'Reading & Writing Accuracy', usage: engWeight },
                    { label: 'Quantitative Math Accuracy', usage: mathWeight }
                ])

                setStats([
                    { label: 'Dynamic Performance Volume', value: `${totalQuestions} Questions`, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 border border-green-100' }
                ])

                setSectionCardsData([
                    {
                        label: 'Reading & Writing',
                        value: String(res.engScore || 200),
                        sub: 'Live diagnostic calculation',
                        icon: BookOpen,
                        iconColor: 'text-blue-500',
                        iconBg: 'bg-blue-50 border border-blue-100',
                        href: '/practice/sat/english',
                    },
                    {
                        label: 'Math Section',
                        value: String(res.mathScore || 200),
                        sub: 'Live diagnostic calculation',
                        icon: Chalkboard,
                        iconColor: 'text-indigo-500',
                        iconBg: 'bg-indigo-50 border border-indigo-100',
                        href: '/practice/sat/math',
                    },
                    {
                        label: 'Total Diagnostic Attempt Profile',
                        value: `${totalQuestions} Unlocked`,
                        sub: 'All metrics pulled from production tables',
                        icon: CheckCircle,
                        iconColor: 'text-green-500',
                        iconBg: 'bg-green-50 border border-green-100',
                        href: ''
                    },
                ])
            }
        } catch (err) {
            console.error("Failed loading backend diagnostic context layers", err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadDashboardData()
    }, [loadDashboardData])

    const handleClearDashboard = async () => {
        if (!confirm("Are you sure you want to permanently clear all metrics and test history from the database?")) return
        try {
            const res = await clearSatMetricsAction()
            if (res.success) {
                await loadDashboardData()
            } else if (res.unauthorized) {
                setIsUnauthorized(true)
            } else {
                alert("Could not process record deletion cascade.")
            }
        } catch (err) {
            console.error(err)
        }
    }

    if (isUnauthorized) {
        return (
            <div className="min-h-[70vh] w-full flex items-center justify-center bg-white px-4">
                <div className="max-w-md w-full border border-gray-100 nice-shadow rounded-2xl p-8 text-center space-y-5">
                    <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                        <LockSimple size={28} weight="bold" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Access Restricted</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Sorry, we can't provide this service to non-signed in users. Please sign in to establish an active practice test profile.
                        </p>
                    </div>
                    <div>
                        <Link
                            href="/login"
                            className="inline-flex w-full items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
                        >
                            Sign In to Account
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full w-full bg-white">
            <div className="px-4 sm:px-10 pt-8 pb-10">
                <div className="space-y-6 max-w-[1600px] mx-auto w-full">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                SAT Prep Overview
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">
                                Track your metrics, manage practice runs, and close concept blindspots.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                href="/practice/sat/test?new=true"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <PlusCircle size={18} weight="bold" />
                                Start New Practice Test
                            </Link>

                            <Link
                                href="/practice/sat/analytics"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-white rounded-lg nice-shadow hover:bg-gray-50 transition-colors"
                            >
                                <ChartBar size={18} weight="bold" />
                                Detailed Score Analytics
                            </Link>

                            <button
                                onClick={handleClearDashboard}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-white rounded-lg nice-shadow hover:bg-red-50 hover:text-red-600 transition-colors duration-200 cursor-pointer"
                            >
                                <Trash size={18} weight="bold" />
                                Clear Metrics
                            </button>
                        </div>
                    </div>

                    <ScoreProgressBarHero
                        currentScore={currentScore}
                        targetScore={targetScore}
                        examWindowDate={examWindowDate}
                        isLoading={isLoading}
                    />

                    <SatSectionCards cards={sectionCardsData} isLoading={isLoading} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <RecentPracticeTests tests={tests} isLoading={isLoading} />
                            <WeaknessDiagnosticList blindspots={blindspots} isLoading={isLoading} />
                        </div>
                        <div className="space-y-6">
                            <SubscoreMeters categories={categories} isLoading={isLoading} />
                            <StudyTimeQuickStats stats={stats} isLoading={isLoading} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

function ScoreProgressBarHero({
                                  currentScore,
                                  targetScore,
                                  examWindowDate,
                                  isLoading
                              }: {
    currentScore: number,
    targetScore: number,
    examWindowDate: string,
    isLoading: boolean
}) {
    if (isLoading) {
        return <div className="w-full bg-white h-32 rounded-xl nice-shadow animate-pulse" />
    }

    const progressPercent = Math.min(Math.round(((currentScore - 400) / (targetScore - 400)) * 100), 100)
    const levels = getLevelStyles(progressPercent >= 0 ? progressPercent : 0)

    return (
        <div className="w-full bg-white rounded-xl nice-shadow p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    <GraduationCap size={16} className="text-blue-500" weight="duotone" />
                                    Current Score
                                </div>
                                <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {currentScore}
                                </div>
                            </div>

                            <div className="h-10 w-[1px] bg-gray-200 self-end mb-1 hidden sm:block" />

                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    <Target size={16} className="text-rose-500" weight="duotone" />
                                    Target Score
                                </div>
                                <div className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {targetScore}
                                </div>
                            </div>
                        </div>

                        {currentScore < targetScore ? (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                <TrendUp size={14} weight="bold" />
                                <span>{targetScore - currentScore} points to goal reach</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                                <CheckCircle size={14} weight="bold" />
                                <span>Target achieved or surpassed!</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${levels.barColor} transition-all duration-500 ease-out`}
                                style={{ width: `${progressPercent >= 0 ? progressPercent : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] font-medium text-gray-400 px-0.5">
                            <span>Baseline (400)</span>
                            <span className={`${levels.textColor} font-semibold`}>
                                Current Level Progress: {progressPercent >= 0 ? progressPercent : 0}%
                            </span>
                            <span>Perfect (1600)</span>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block h-16 w-[1px] bg-gray-100" />

                <div className="bg-white rounded-xl p-4 flex items-center gap-4 shrink-0 lg:w-72 border border-gray-100">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Calendar size={24} weight="duotone" className="text-blue-500" />
                    </div>
                    <div className="min-w-0 soul-date-field">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Next Target Exam Window
                        </span>
                        <span className="text-sm font-bold text-gray-800 block mt-0.5 truncate">
                            {examWindowDate}
                        </span>
                        <span className="text-xs text-blue-500 font-medium block mt-0.5">
                            Official National Test
                        </span>
                    </div>
                </div>

            </div>
        </div>
    )
}

function SatSectionCards({ cards, isLoading }: { cards: any[], isLoading: boolean }) {
    if (isLoading) {
        return <div className="h-24 w-full bg-slate-100 rounded-xl animate-pulse" />
    }

    return (
        <div className="w-full grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {cards.map((card) => {
                const Content = (
                    <>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-md ${card.iconBg} flex items-center justify-center shrink-0`}>
                                    <card.icon size={18} weight="duotone" className={card.iconColor} />
                                </div>
                                <span className="text-sm font-medium text-gray-400 truncate">
                                    {card.label}
                                </span>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</div>
                        </div>
                        <p className="text-sm text-gray-400 mt-2 whitespace-nowrap overflow-hidden text-ellipsis">
                            {card.sub}
                        </p>
                    </>
                )

                const classStyles = "w-full bg-white rounded-xl nice-shadow px-4 py-3.5 hover:bg-gray-50 transition-colors group flex flex-col justify-between"

                if (card.href) {
                    return (
                        <Link key={card.label} href={card.href} className={classStyles}>
                            {Content}
                        </Link>
                    )
                }

                return (
                    <div key={card.label} className={classStyles}>
                        {Content}
                    </div>
                )
            })}
        </div>
    )
}

function RecentPracticeTests({ tests, isLoading }: { tests: any[], isLoading: boolean }) {
    if (isLoading) return <div className="h-48 w-full bg-slate-100 rounded-xl animate-pulse" />

    return (
        <div className="w-full bg-white rounded-xl nice-shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <h2 className="text-md font-semibold text-gray-700">Recent Practice Performance</h2>
            </div>
            <div className="divide-y divide-gray-50">
                {tests.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                        No metric history recorded. Complete a reading/writing or math session to build a profile.
                    </div>
                ) : (
                    tests.map((test) => (
                        <div key={test.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                            <div className="w-9 h-9 rounded-md bg-green-50 border border-green-150 shrink-0 flex items-center justify-center">
                                <CheckCircle size={18} weight="duotone" className="text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{test.name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                        <Clock size={16} /> {test.date}
                                    </span>
                                    <span className="text-[11px] text-gray-400">{test.breakdown}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-sm font-bold text-gray-900 block">{test.score}</span>
                                <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{test.status}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function SubscoreMeters({ categories, isLoading }: { categories: any[], isLoading: boolean }) {
    if (isLoading) return <div className="h-32 w-full bg-slate-100 rounded-xl animate-pulse" />

    return (
        <div className="bg-white rounded-xl nice-shadow p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-700">Domain Mastery Profile</h3>
            </div>
            <div className="space-y-5">
                {categories.length === 0 ? (
                    <p className="text-xs text-gray-400">Awaiting system statistics data integration.</p>
                ) : (
                    categories.map((cat) => {
                        const theme = getLevelStyles(cat.usage)
                        const tier = getProficiencyTier(cat.usage)
                        return (
                            <div key={cat.label} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-gray-600 truncate max-w-[180px]">
                                        {cat.label}
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${tier.badgeStyle}`}>
                                            {tier.label}
                                        </span>
                                        <span className={`text-sm font-bold tabular-nums ${theme.textColor}`}>
                                            {cat.usage}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${theme.barColor}`}
                                        style={{ width: `${cat.usage}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

function WeaknessDiagnosticList({ blindspots, isLoading }: { blindspots: any[], isLoading: boolean }) {
    if (isLoading) return <div className="h-40 w-full bg-slate-100 rounded-xl animate-pulse" />

    return (
        <div className="bg-white rounded-xl nice-shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <h3 className="text-md font-semibold text-gray-700">Target Focus Recommendations (Incorrect Questions)</h3>
            </div>
            <div className="divide-y divide-gray-50">
                {blindspots.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                        Excellent performance context! Zero active incorrect items to review.
                    </div>
                ) : (
                    blindspots.map((item, idx) => (
                        <Link
                            key={idx}
                            href={item.targetPath}
                            className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-slate-950">
                                    {item.concept}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {item.subject} &bull; Click to isolate and re-attempt this specific question type
                                </p>
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.style} shrink-0`}>
                                {item.type}
                            </span>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}

function StudyTimeQuickStats({ stats, isLoading }: { stats: any[], isLoading: boolean }) {
    if (isLoading) return <div className="h-20 w-full bg-slate-100 rounded-xl animate-pulse" />

    return (
        <div className="bg-white rounded-xl nice-shadow p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-700">Preparation Volume</h3>
            </div>
            <div className="space-y-3">
                {stats.length === 0 ? (
                    <div className="text-xs text-slate-400">No active attempts data mapped.</div>
                ) : (
                    stats.map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-md ${stat.bg} flex items-center justify-center shrink-0`}>
                                    <stat.icon size={18} weight="duotone" className={stat.color} />
                                </div>
                                <span className="text-sm text-gray-500">{stat.label}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 tabular-nums">{stat.value}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}