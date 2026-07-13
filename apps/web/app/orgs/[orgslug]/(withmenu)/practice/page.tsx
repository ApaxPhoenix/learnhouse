"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import {
    GraduationCap,
    Target,
    BookOpen,
    Chalkboard,
    CheckCircle,
    Clock,
    ArrowRight,
    PlusCircle,
    ChartBar,
    Calendar,
    TrendUp,
    Trash
} from '@phosphor-icons/react'

function getLevelStyles(percentage: number) {
    if (percentage < 60) {
        return { barColor: 'bg-red-500', textColor: 'text-red-500', bgColor: 'bg-red-50' }
    }
    if (percentage >= 60 && percentage < 70) {
        return { barColor: 'bg-orange-500', textColor: 'text-orange-500', bgColor: 'bg-orange-50' }
    }
    if (percentage >= 70 && percentage < 80) {
        return { barColor: 'bg-amber-400', textColor: 'text-amber-500', bgColor: 'bg-amber-50' }
    }
    if (percentage >= 80 && percentage < 90) {
        return { barColor: 'bg-green-400', textColor: 'text-green-500', bgColor: 'bg-green-50' }
    }
    return { barColor: 'bg-emerald-600', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50' }
}

export default function SatOverviewDashboard() {
    // Dashboard States
    const [currentScore, setCurrentScore] = useState(1480)
    const [targetScore] = useState(1540)

    const [tests, setTests] = useState([
        {
            id: 'test-5',
            name: 'Official College Board Practice Test 5',
            score: '1480',
            breakdown: '720 RW · 760 M',
            date: 'Jul 11, 2026',
            status: 'Completed',
        },
        {
            id: 'test-4',
            name: 'Official College Board Practice Test 4',
            score: '1450',
            breakdown: '700 RW · 750 M',
            date: 'Jun 28, 2026',
            status: 'Completed',
        },
        {
            id: 'test-3',
            name: 'Diagnostic Evaluation Run C',
            score: '1410',
            breakdown: '680 RW · 730 M',
            date: 'Jun 14, 2026',
            status: 'Completed',
        },
    ])

    const [categories, setCategories] = useState([
        { label: 'Algebra & Linear Equations', usage: 92 },
        { label: 'Advanced Math (Functions/Quadratics)', usage: 84 },
        { label: 'Problem Solving & Data Analysis', usage: 72 },
        { label: 'Craft, Structure & Context Vocabulary', usage: 68 },
        { label: 'Expression of Ideas & Grammar Rules', usage: 79 },
    ])

    const [blindspots, setBlindspots] = useState([
        { concept: 'Nonlinear equations & system models', subject: 'Math', type: 'High Priority', style: 'bg-red-50 text-red-600' },
        { concept: 'Textual evidence evaluation questions', subject: 'Reading & Writing', type: 'Medium Priority', style: 'bg-orange-50 text-orange-600' },
        { concept: 'Ratios, rates & proportional relationships', subject: 'Math', type: 'Low Priority', style: 'bg-amber-50 text-amber-600' },
    ])

    const [stats, setStats] = useState([
        { label: 'Weekly Study Time', value: '8.5 hrs', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
        { label: 'Total Practice Questions', value: '412', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    ])

    const [sectionCardsData, setSectionCardsData] = useState([
        {
            label: 'Reading & Writing',
            value: '720',
            sub: '+30 points vs last week',
            icon: BookOpen,
            iconColor: 'text-blue-500',
            iconBg: 'bg-blue-50',
            href: '/dash/sat/english',
        },
        {
            label: 'Math Section',
            value: '760',
            sub: 'Strongest performance zone',
            icon: Chalkboard,
            iconColor: 'text-blue-500',
            iconBg: 'bg-blue-50',
            href: '/dash/sat/math',
        },
        {
            label: 'Exams Completed',
            value: '5 / 8',
            sub: 'Next diagnostic ready',
            icon: CheckCircle,
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-50',
            href: ''
        },
    ])

    // Clear handler to wipe dashboard metrics gracefully
    const handleClearDashboard = () => {
        setCurrentScore(400)
        setTests([])
        setBlindspots([])
        setCategories(categories.map(cat => ({ ...cat, usage: 0 })))
        setStats([
            { label: 'Weekly Study Time', value: '0 hrs', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Total Practice Questions', value: '0', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        ])
        setSectionCardsData([
            { ...sectionCardsData[0], value: '200', sub: 'No history recorded' },
            { ...sectionCardsData[1], value: '200', sub: 'No history recorded' },
            { ...sectionCardsData[2], value: '0 / 8', sub: 'No diagnostic runs' },
        ])
    }

    return (
        <div className="h-full w-full bg-[#f8f8f8]">
            <div className="px-4 sm:px-10 pt-8 pb-10">
                <div className="space-y-6 max-w-[1600px] mx-auto w-full">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                SAT Prep Overview
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">
                                Track your metrics, manage practice runs, and close concept blindspots.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                href="/dash/sat/practice?new=true"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <PlusCircle size={18} weight="bold" />
                                Start New Practice Test
                            </Link>

                            <Link
                                href="/dash/sat/analytics"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-white rounded-lg nice-shadow hover:bg-gray-50 transition-colors border border-transparent"
                            >
                                <ChartBar size={18} weight="bold" />
                                Detailed Score Analytics
                            </Link>

                            {/* White button that turns red on hover */}
                            <button
                                onClick={handleClearDashboard}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg nice-shadow hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors duration-200 cursor-pointer"
                            >
                                <Trash size={18} weight="bold" />
                                Clear Metrics
                            </button>
                        </div>
                    </div>

                    <ScoreProgressBarHero currentScore={currentScore} targetScore={targetScore} />

                    <SatSectionCards cards={sectionCardsData} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <RecentPracticeTests tests={tests} />
                            <WeaknessDiagnosticList blindspots={blindspots} />
                        </div>
                        <div className="space-y-6">
                            <SubscoreMeters categories={categories} />
                            <StudyTimeQuickStats stats={stats} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

function ScoreProgressBarHero({ currentScore, targetScore }: { currentScore: number, targetScore: number }) {
    const progressPercent = Math.min(Math.round(((currentScore - 400) / (targetScore - 400)) * 100), 100)
    const levels = getLevelStyles(progressPercent >= 0 ? progressPercent : 0)

    return (
        <div className="w-full bg-white rounded-xl nice-shadow p-6 border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    <GraduationCap size={16} className="text-blue-500" weight="duotone" />
                                    Current Score
                                </div>
                                <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
                                    {currentScore}
                                </div>
                            </div>

                            <div className="h-10 w-[1px] bg-gray-200 self-end mb-1 hidden sm:block" />

                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    <Target size={16} className="text-rose-500" weight="duotone" />
                                    Target Score
                                </div>
                                <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-text tracking-tight">
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
                        <div className="h-3.5 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
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

                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 shrink-0 lg:w-72 border border-gray-100">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Calendar size={24} weight="duotone" className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Next Exam Target
                        </span>
                        <span className="text-sm font-bold text-gray-800 block mt-0.5 truncate">
                            October 24, 2026
                        </span>
                        <span className="text-xs text-blue-500 font-medium block mt-0.5">
                            Fall Diagnostic Run
                        </span>
                    </div>
                </div>

            </div>
        </div>
    )
}

function SatSectionCards({ cards }: { cards: any[] }) {
    return (
        <div className="w-full grid gap-4 grid-cols-1 sm:grid-cols-3">
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
                            <div className="text-2xl font-bold text-gray-900 tracking-tight">{card.value}</div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                            {card.sub}
                        </p>
                    </>
                )

                const classStyles = "w-full bg-white rounded-xl nice-shadow px-5 py-4 hover:bg-gray-50 transition-colors group flex flex-col justify-between border border-gray-50"

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

function RecentPracticeTests({ tests }: { tests: any[] }) {
    return (
        <div className="w-full bg-white rounded-xl nice-shadow overflow-hidden border border-gray-50">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <h2 className="text-md font-semibold text-gray-700">
                    Recent Practice History
                </h2>
                <Link
                    href="/dash/sat/practice"
                    className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
                >
                    <div className="flex flex-row gap-1 items-center text-sm">
                        <span>View All Tests</span>
                        <ArrowRight size={14} />
                    </div>
                </Link>
            </div>

            <div className="divide-y divide-gray-50">
                {tests.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                        No history available. Clear configuration standard applied.
                    </div>
                ) : (
                    tests.map((test) => (
                        <Link
                            key={test.id}
                            href={`/dash/sat/review/${test.id}`}
                            className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="w-9 h-9 rounded-md bg-emerald-50 overflow-hidden shrink-0 flex items-center justify-center">
                                <CheckCircle size={18} weight="duotone" className="text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900">
                                    {test.name}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                        <Clock size={16} />
                                        {test.date}
                                    </span>
                                    <span className="text-[11px] text-gray-400">
                                        {test.breakdown}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-sm font-bold text-gray-900 block">{test.score}</span>
                                <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-wider">{test.status}</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}

function SubscoreMeters({ categories }: { categories: any[] }) {
    return (
        <div className="bg-white rounded-xl nice-shadow p-6 border border-gray-50">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-700">Domain Mastery Profile</h3>
            </div>
            <div className="space-y-5">
                {categories.map((cat) => {
                    const theme = getLevelStyles(cat.usage)

                    return (
                        <div key={cat.label}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-gray-600 truncate max-w-[220px]">
                                    {cat.label}
                                </span>
                                <span className={`text-sm font-semibold tabular-nums ${theme.textColor}`}>
                                    {cat.usage}%
                                </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${theme.barColor}`}
                                    style={{ width: `${cat.usage}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function WeaknessDiagnosticList({ blindspots }: { blindspots: any[] }) {
    return (
        <div className="bg-white rounded-xl nice-shadow overflow-hidden border border-gray-50">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <h3 className="text-md font-semibold text-gray-700">Target Focus Recommendations</h3>
            </div>
            <div className="divide-y divide-gray-50">
                {blindspots.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                        All blindspots addressed! No recommendations listed.
                    </div>
                ) : (
                    blindspots.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-6 py-3.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{item.concept}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{item.subject}</p>
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.style} shrink-0`}>
                                {item.type}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function StudyTimeQuickStats({ stats }: { stats: any[] }) {
    return (
        <div className="bg-white rounded-xl nice-shadow p-5 border border-gray-50">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-700">Preparation Volume</h3>
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
                            {stat.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}