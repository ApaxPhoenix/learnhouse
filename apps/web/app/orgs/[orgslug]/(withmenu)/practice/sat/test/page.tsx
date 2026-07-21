"use client"

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import {
    Clock,
    ArrowLeft,
    ArrowRight,
    Calculator,
    XCircle,
    Minus,
    HandGrabbing,
    CaretDown,
    CaretUp,
    ListChecks,
    BookmarkSimple,
    Flag
} from '@phosphor-icons/react'
import { getQuestionsAction, submitAttemptAction, submitTestSessionAction } from './actions'

interface Option {
    id: string
    key: string
    text: string
}

interface Question {
    id: string
    stimulus: string | LexicalRoot
    options: Option[]
    answer: string
    explanation: string | LexicalRoot
    section: 'english' | 'math'
    domain?: string
    topic?: string
    difficulty: 'easy' | 'medium' | 'hard'
}

interface LexicalNode {
    type: string
    format?: number
    text?: string
    value?: any
    src?: string
    url?: string
    alt?: string
    children?: LexicalNode[]
}

interface LexicalRoot {
    root?: {
        children?: LexicalNode[]
    }
}

const checkIsCorrect = (q: Question, selectedKey: string | undefined): boolean => {
    if (!selectedKey) return false

    const cleanAnswer = q.answer.trim().toLowerCase()
    const cleanKey = selectedKey.trim().toLowerCase()

    const selectedOption = q.options.find(o => o.key.toLowerCase() === cleanKey)
    if (!selectedOption) return false

    const cleanOptionText = selectedOption.text.trim().toLowerCase()

    if (cleanKey === cleanAnswer) return true
    if (cleanOptionText === cleanAnswer) return true
    if (selectedOption.id.toLowerCase() === cleanAnswer) return true

    const structuralAnswerMatch = cleanAnswer.replace(/[\$\\]/g, '')
    const structuralOptionMatch = cleanOptionText.replace(/[\$\\]/g, '')
    if (structuralOptionMatch === structuralAnswerMatch || structuralOptionMatch === cleanAnswer) return true

    const correctOption = q.options.find(o =>
        o.key.toLowerCase() === cleanAnswer ||
        o.text.trim().toLowerCase() === cleanAnswer ||
        o.id.toLowerCase() === cleanAnswer
    )
    if (correctOption && correctOption.key.toLowerCase() === cleanKey) return true

    return false
}

const renderTextWithMath = (text: string) => {
    if (!text) return ''

    let sanitized = text
    sanitized = sanitized.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    sanitized = sanitized.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
    sanitized = sanitized.replace(/(?<!\$)\\[a-zA-Z]+(?:\{[^{} ]*\}|\[[^[\] ]*\]|)*(?!\$)/g, '$$$&$$')

    const blocks = sanitized.split('$$')
    return blocks.map((block, blockIndex) => {
        if (blockIndex % 2 === 1) {
            return (
                <div key={blockIndex} className="my-3 overflow-x-auto">
                    <BlockMath
                        math={block}
                        renderError={() => <span className="text-slate-700 font-medium">{block}</span>}
                    />
                </div>
            )
        }
        const inlines = block.split('$')
        return inlines.map((inline, inlineIndex) => {
            if (inlineIndex % 2 === 1) {
                return (
                    <InlineMath
                        key={inlineIndex}
                        math={inline}
                        renderError={() => <span className="text-slate-700 font-medium">{inline}</span>}
                    />
                )
            }
            return inline
        })
    })
}

const renderStringWithImagesAndMath = (text: string) => {
    if (!text) return null

    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>|!\[([^\]]*)\]\(([^)]+)\)/gi
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = imgRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(renderTextWithMath(text.substring(lastIndex, match.index)))
        }

        const src = match[1] || match[3]
        const alt = match[2] || 'Stimulus visual'
        const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || ''
        const imageUrl = src.startsWith('http') ? src : `${payloadUrl}${src}`

        parts.push(
            <div key={match.index} className="my-4 flex justify-center items-center w-full">
                <img
                    src={imageUrl}
                    alt={alt}
                    className="max-w-full max-h-80 object-contain rounded-lg border border-slate-200 shadow-sm mx-auto block"
                />
            </div>
        )

        lastIndex = imgRegex.lastIndex
    }

    if (lastIndex < text.length) {
        parts.push(renderTextWithMath(text.substring(lastIndex)))
    }

    return parts
}

const renderLexicalNode = (node: LexicalNode, index: number): React.ReactNode => {
    if (!node) return null

    if (node.type === 'upload' || node.type === 'image') {
        const rawUrl = node.value?.url || node.src || node.url
        if (rawUrl) {
            const payloadUrl = process.env.NEXT_PUBLIC_LEARNHOUSE_PAYLOAD_URL || ''
            const imageUrl = rawUrl.startsWith('http') ? rawUrl : `${payloadUrl}${rawUrl}`
            return (
                <div key={index} className="my-4 flex justify-center items-center w-full">
                    <img
                        src={imageUrl}
                        alt={node.value?.alt || node.alt || 'Stimulus visual'}
                        className="max-w-full max-h-80 object-contain rounded-lg border border-slate-200 shadow-sm mx-auto block"
                    />
                </div>
            )
        }
    }

    if (node.type === 'paragraph') {
        return (
            <p key={index} className="mb-4 text-slate-700 leading-relaxed text-sm">
                {node.children?.map((child, childIdx) => renderLexicalNode(child, childIdx))}
            </p>
        )
    }

    if (node.text !== undefined) {
        const content = renderTextWithMath(node.text || '')
        if (node.format === 1) {
            return <span key={index} className="font-semibold text-slate-900">{content}</span>
        }
        return <React.Fragment key={index}>{content}</React.Fragment>
    }

    if (node.children && node.children.length > 0) {
        return (
            <div key={index}>
                {node.children.map((child, childIdx) => renderLexicalNode(child, childIdx))}
            </div>
        )
    }

    return null
}

const renderLexicalOrText = (content: string | LexicalRoot | null | undefined): React.ReactNode => {
    if (!content) return null
    if (typeof content === 'string') {
        return renderStringWithImagesAndMath(content)
    }

    try {
        if (content.root?.children) {
            return content.root.children.map((node: LexicalNode, childIndex: number) =>
                renderLexicalNode(node, childIndex)
            )
        }
    } catch {
        return <p className="text-slate-400 text-sm italic">Error parsing structure content</p>
    }
    return null
}

const calculateSatScore = (englishCorrect: number, englishTotal: number, mathCorrect: number, mathTotal: number) => {
    if (englishTotal === 0 && mathTotal === 0) {
        return { rwScore: 0, mathScore: 0, totalScore: 0 }
    }
    const minScore = 200
    const maxScore = 800
    const rwPercent = englishTotal > 0 ? englishCorrect / englishTotal : 0
    const mathPercent = mathTotal > 0 ? mathCorrect / mathTotal : 0
    const rwScore = Math.round(minScore + (maxScore - minScore) * rwPercent)
    const mathScore = Math.round(minScore + (maxScore - minScore) * mathPercent)
    return {
        rwScore: Math.min(800, Math.max(200, rwScore)),
        mathScore: Math.min(800, Math.max(200, mathScore)),
        totalScore: Math.min(1600, Math.max(400, rwScore + mathScore))
    }
}

function PracticeTestController() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewTest = searchParams.get('new') === 'true'

    const isProd = process.env.NODE_ENV === 'production'
    const section1Duration = isProd ? 600 : 60
    const section2Duration = isProd ? 600 : 120
    const breakDuration = isProd ? 600 : 10

    const [testSessionId, setTestSessionId] = useState<string>('')
    const [questions, setQuestions] = useState<Question[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUnauthorized, setIsUnauthorized] = useState(false)

    const [currentSection, setCurrentSection] = useState<1 | 2>(1)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
    const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({})
    const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({})
    const [isEliminatorActive, setIsEliminatorActive] = useState(false)
    const [isTimerHidden, setIsTimerHidden] = useState(false)
    const [isSavingAnswer, setIsSavingAnswer] = useState<Record<string, boolean>>({})

    const [timeLeft, setTimeLeft] = useState(section1Duration)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [isOnBreak, setIsOnBreak] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [breakTimeLeft, setBreakTimeLeft] = useState(breakDuration)

    const [isDesmosOpen, setIsDesmosOpen] = useState(false)
    const [isDesmosMinimized, setIsDesmosMinimized] = useState(false)
    const [desmosPosition, setDesmosPosition] = useState({ x: 160, y: 120 })
    const [desmosSize, setDesmosSize] = useState({ width: 540, height: 460 })
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)

    const [review, setReview] = useState(false)
    const [reveal, setReveal] = useState<Record<string, boolean>>({})
    const [wait, setWait] = useState(false)
    const [report, setReport] = useState(false)

    const dragStart = useRef({ x: 0, y: 0 })
    const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 })
    const calculatorReference = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isNewTest) return

        setTestSessionId(crypto.randomUUID())

        async function fetchQuestions() {
            try {
                const data = await getQuestionsAction()

                if (!data.success && data.error === "Unauthorized session context") {
                    setIsUnauthorized(true)
                    setIsLoading(false)
                    return
                }

                if (data.success && data.docs && data.docs.length > 0) {
                    const uniqueMap = new Map<string, any>()

                    data.docs.forEach((doc: any) => {
                        if (doc && doc.id) {
                            uniqueMap.set(String(doc.id), doc)
                        }
                    })

                    const allItems: Question[] = Array.from(uniqueMap.values()).map((doc: any) => {
                        let sectionName: 'english' | 'math' = 'english'
                        let rawSectionStr = ''

                        if (doc.section) {
                            if (typeof doc.section === 'object') {
                                rawSectionStr = String(doc.section.slug || doc.section.name || doc.section.title || doc.section.id || '')
                            } else {
                                rawSectionStr = String(doc.section)
                            }
                        }

                        const cleanSec = rawSectionStr.toLowerCase().trim()

                        if (cleanSec.includes('math') || cleanSec.includes('calc') || cleanSec.includes('algebra') || cleanSec.includes('geom')) {
                            sectionName = 'math'
                        } else if (cleanSec.includes('english') || cleanSec.includes('read') || cleanSec.includes('writ') || cleanSec.includes('lang') || cleanSec.includes('lit') || cleanSec.includes('verbal') || cleanSec.includes('rw')) {
                            sectionName = 'english'
                        } else {
                            const metadataStr = (String(doc.domain || '') + String(doc.topic || '') + String(doc.answer || '')).toLowerCase()
                            const isMathMatch = metadataStr.includes('math') ||
                                metadataStr.includes('algebra') ||
                                metadataStr.includes('geometry') ||
                                (String(doc.answer).length < 10 && /[\d%+\-*\/=\\]/.test(String(doc.answer)))

                            sectionName = isMathMatch ? 'math' : 'english'
                        }

                        const alpha = ['A', 'B', 'C', 'D']
                        const seenTexts = new Set<string>()
                        const choices: Option[] = []
                        const rawOptions = doc.options || []
                        let addedIndex = 0

                        for (let i = 0; i < rawOptions.length; i++) {
                            const opt = rawOptions[i]
                            const textVal = opt && typeof opt === 'object' ? String(opt.text || '') : String(opt)
                            const cleanText = textVal.trim()

                            if (seenTexts.has(cleanText)) continue
                            seenTexts.add(cleanText)

                            if (addedIndex < 4) {
                                choices.push({
                                    id: String(opt && typeof opt === 'object' ? (opt.id || i) : i),
                                    key: alpha[addedIndex],
                                    text: cleanText
                                })
                                addedIndex++
                            }
                        }

                        while (choices.length < 4) {
                            const fallbackLabel = alpha[choices.length]
                            choices.push({
                                id: `fallback-${fallbackLabel}-${doc.id}`,
                                key: fallbackLabel,
                                text: `Optional Parameter ${fallbackLabel}`
                            })
                        }

                        return {
                            id: String(doc.id),
                            stimulus: doc.stimulus,
                            options: choices,
                            answer: String(doc.answer || '').trim(),
                            explanation: doc.explanation,
                            section: sectionName,
                            domain: doc.domain,
                            topic: doc.topic,
                            difficulty: doc.difficulty || 'medium'
                        }
                    })

                    const englishSectionPool = allItems.filter(q => q.section === 'english').slice(0, 27)
                    const mathSectionPool = allItems.filter(q => q.section === 'math').slice(0, 22)

                    setQuestions([...englishSectionPool, ...mathSectionPool])
                } else if (!data.success) {
                    throw new Error(data.error || 'Failed to fetch questions')
                }
            } catch (error: unknown) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchQuestions()
    }, [isNewTest])

    useEffect(() => {
        if (questions.length > 0) {
            const hasEnglish = questions.some(q => q.section === 'english')
            const hasMath = questions.some(q => q.section === 'math')

            if (!hasEnglish && hasMath && currentSection === 1) {
                setCurrentSection(2)
                setTimeLeft(section2Duration)
            }
        }
    }, [questions, currentSection, section2Duration])

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (isDragging) {
                setDesmosPosition({
                    x: event.clientX - dragStart.current.x,
                    y: event.clientY - dragStart.current.y
                })
            } else if (isResizing && !isDesmosMinimized) {
                const deltaX = event.clientX - resizeStart.current.x
                const deltaY = event.clientY - resizeStart.current.y
                setDesmosSize({
                    width: Math.max(400, resizeStart.current.width + deltaX),
                    height: Math.max(300, resizeStart.current.height + deltaY)
                })
            }
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            setIsResizing(false)
        }

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, isResizing, isDesmosMinimized])

    const reading = questions.filter(q => q.section === 'english')
    const calculus = questions.filter(q => q.section === 'math')

    const activeQuestions = currentSection === 1 ? reading : calculus
    const currentQuestion = activeQuestions[currentQuestionIndex]
    const userChoice = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined
    const isCurrentFlagged = currentQuestion ? flaggedQuestions[currentQuestion.id] === true : false

    useEffect(() => {
        if (timeLeft <= 300) {
            setIsTimerHidden(false)
        }
    }, [timeLeft])

    useEffect(() => {
        if (!isNewTest || isSubmitted || isOnBreak || isPaused || isLoading) return

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    if (currentSection === 1) {
                        handleSectionTransition()
                    } else {
                        handleTriggerScoreCalculation()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isNewTest, isSubmitted, isOnBreak, isPaused, currentSection, isLoading])

    useEffect(() => {
        if (!isOnBreak) return

        const breakTimer = setInterval(() => {
            setBreakTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(breakTimer)
                    setIsOnBreak(false)
                    setCurrentSection(2)
                    setCurrentQuestionIndex(0)
                    setTimeLeft(section2Duration)
                    setReview(false)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(breakTimer)
    }, [isOnBreak, section2Duration])

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const handleSelectOption = async (questionId: string, optionKey: string) => {
        if (eliminatedOptions[questionId]?.includes(optionKey)) {
            setEliminatedOptions(prev => ({
                ...prev,
                [questionId]: (prev[questionId] || []).filter(key => key !== optionKey)
            }))
        }

        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionKey }))
        setIsSavingAnswer(prev => ({ ...prev, [questionId]: true }))

        try {
            const questionObj = questions.find(q => q.id === questionId)
            if (questionObj) {
                const isCorrect = checkIsCorrect(questionObj, optionKey)
                const res = await submitAttemptAction({
                    questionId: questionId,
                    selectedOptionKey: optionKey,
                    isCorrect: isCorrect,
                    timeSpentSeconds: 0,
                    testSessionId: testSessionId
                })
                if (res && !res.success && res.error === "Unauthorized session context") {
                    setIsUnauthorized(true)
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSavingAnswer(prev => ({ ...prev, [questionId]: false }))
        }
    }

    const handleToggleFlag = (questionId: string) => {
        setFlaggedQuestions(prev => ({ ...prev, [questionId]: !prev[questionId] }))
    }

    const handleToggleCrossout = (questionId: string, optionKey: string, event?: React.MouseEvent) => {
        if (event) event.stopPropagation()

        if (selectedAnswers[questionId] === optionKey) {
            setSelectedAnswers(prev => {
                const nextObj = { ...prev }
                delete nextObj[questionId]
                return nextObj
            })
        }

        setEliminatedOptions(prev => {
            const list = prev[questionId] || []
            const isExist = list.includes(optionKey)
            return {
                ...prev,
                [questionId]: isExist ? list.filter(k => k !== optionKey) : [...list, optionKey]
            }
        })
    }

    const handleSectionTransition = () => {
        setIsDesmosOpen(false)
        setReview(false)
        setCurrentQuestionIndex(0)
        setIsOnBreak(true)
        setBreakTimeLeft(breakDuration)
    }

    const handleNextQuestion = () => {
        if (currentQuestionIndex === activeQuestions.length - 1) {
            setReview(true)
        } else {
            setCurrentQuestionIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))
        }
    }

    const handlePrevQuestion = () => {
        setCurrentQuestionIndex(prev => Math.max(0, prev - 1))
    }

    const handleMouseDown = (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true)
            dragStart.current = {
                x: event.clientX - desmosPosition.x,
                y: event.clientY - desmosPosition.y
            }
        }
    }

    const handleResizeMouseDown = (event: React.MouseEvent) => {
        event.stopPropagation()
        event.preventDefault()
        if (isDesmosMinimized) return
        setIsResizing(true)
        resizeStart.current = {
            width: desmosSize.width,
            height: desmosSize.height,
            x: event.clientX,
            y: event.clientY
        }
    }

    const handleTriggerScoreCalculation = async () => {
        setWait(true)

        const totalEnglish = reading.length
        const totalMath = calculus.length

        const englishCorrect = reading.reduce((acc, q) =>
            acc + (checkIsCorrect(q, selectedAnswers[q.id]) ? 1 : 0), 0)

        const mathCorrect = calculus.reduce((acc, q) =>
            acc + (checkIsCorrect(q, selectedAnswers[q.id]) ? 1 : 0), 0)

        const { rwScore, mathScore, totalScore } = calculateSatScore(englishCorrect, totalEnglish, mathCorrect, totalMath)

        try {
            const res = await submitTestSessionAction({
                testSessionId,
                englishCorrect,
                englishTotal: totalEnglish,
                mathCorrect,
                mathTotal: totalMath,
                rwScore,
                mathScore,
                totalScore
            })
            if (res && !res.success && res.error === "Unauthorized session context") {
                setIsUnauthorized(true)
                setWait(false)
                return
            }
        } catch (err) {
            console.error(err)
        }

        setTimeout(() => {
            setWait(false)
            setReport(true)
            setIsSubmitted(true)
        }, 2200)
    }

    const toggleRevealQuestion = (id: string) => {
        setReveal(prev => ({ ...prev, [id]: !prev[id] }))
    }

    if (isUnauthorized) {
        return (
            <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
                <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-6 mx-auto shadow-sm">
                    <div className="space-y-2">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">Authentication Required</h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Your session could not be verified. Please log in to access the SAT Practice Suite.
                        </p>
                    </div>
                    <Link href="/practice" className="block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm tracking-wider rounded-xl transition-all shadow-sm text-center">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (!isNewTest) {
        return (
            <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
                <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-6 mx-auto shadow-sm">
                    <div className="space-y-2">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">SAT Practice Suite</h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Simulate an official modular testing sequence. Features clean interface configurations matching rigorous testing parameters.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/practice/sat/test?new=true')}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                    >
                        Begin Digital SAT Simulation
                    </button>
                    <Link href="/practice" className="block text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center text-sm font-semibold tracking-widest text-slate-500 bg-slate-50 ">
                <div className="flex flex-col items-center gap-4 mx-auto">
                    <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    if (wait) {
        return (
            <div className="fixed inset-0 bg-slate-50 z-50 flex items-center justify-center p-6 text-slate-900">
                <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-4 mx-auto shadow-md">
                    <div className="space-y-1">
                        <h2 className="text-base font-bold text-slate-900">Processing Parameters</h2>
                        <p className="text-sm font-medium text-slate-400">Scaling responses to standardized grids...</p>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-slate-900 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
                    </div>
                </div>
            </div>
        )
    }

    if (report && isSubmitted) {
        const totalEnglish = reading.length
        const totalMath = calculus.length

        const englishCorrect = reading.reduce((acc, q) =>
            acc + (checkIsCorrect(q, selectedAnswers[q.id]) ? 1 : 0), 0)

        const mathCorrect = calculus.reduce((acc, q) =>
            acc + (checkIsCorrect(q, selectedAnswers[q.id]) ? 1 : 0), 0)

        const totalCorrect = englishCorrect + mathCorrect
        const totalActive = reading.length + calculus.length

        const { rwScore, mathScore, totalScore } = totalActive > 0
            ? calculateSatScore(englishCorrect, totalEnglish, mathCorrect, totalMath)
            : { rwScore: 0, mathScore: 0, totalScore: 0 }

        return (
            <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xl max-h-[calc(100vh-2rem)] flex flex-col overflow-y-auto">
                    <div className="text-center space-y-2 shrink-0">
                        <h1 className="text-xl font-bold text-slate-900">Assessment Complete</h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Your performance analytics have been computed successfully.
                        </p>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-950 shadow-sm">
                            <div className="text-left border-b border-slate-800 pb-3 flex justify-between items-baseline">
                                <span className="text-sm font-bold text-slate-400 tracking-widest block">Total SAT Score</span>
                                <span className="text-4xl font-extrabold tracking-tight text-white block font-mono">
                                    {totalScore}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="text-left space-y-1">
                                    <span className="text-sm font-bold text-slate-400 tracking-wider block">Reading & Writing</span>
                                    <span className="text-lg font-bold text-white block font-mono">
                                        {rwScore} <span className="text-sm text-slate-500 font-normal">/ 800</span>
                                    </span>
                                </div>
                                <div className="text-left space-y-1">
                                    <span className="text-sm font-bold text-slate-400 tracking-wider block">Mathematics</span>
                                    <span className="text-lg font-bold text-white block font-mono">
                                        {mathScore} <span className="text-sm text-slate-500 font-normal">/ 800</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-left">
                                <span className="text-sm font-bold tracking-wider text-slate-400 block">Questions Correct</span>
                                <span className="text-base font-extrabold text-slate-800 block mt-1 font-mono">{totalCorrect} / {totalActive}</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-left">
                                <span className="text-sm font-bold tracking-wider text-slate-400 block">Total Accuracy</span>
                                <span className="text-base font-extrabold text-slate-800 block mt-1 font-mono">
                                    {totalActive > 0 ? Math.round((totalCorrect / totalActive) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 shrink-0">
                        <button
                            onClick={() => router.push('/practice')}
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-center font-bold text-sm tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (isOnBreak) {
        return (
            <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
                <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-8 mx-auto shadow-sm">
                    <div className="space-y-3">
                        <span className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-full tracking-wider border border-slate-200">
                            Official Intermission Period
                        </span>
                        <div className="w-full h-1"></div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Section Break</h1>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Section 1 is now complete. You have a scheduled break before beginning Section 2.
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 max-w-xs mx-auto">
                        <div className="text-sm font-bold text-slate-400 tracking-wider flex items-center justify-center gap-1.5">
                            <Clock size={14} weight="bold" /> Time Remaining
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">{formatTime(breakTimeLeft)}</div>
                    </div>

                    <div className="flex justify-center pt-2">
                        <div className="text-sm font-semibold text-slate-400 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                            The section break is mandatory. Section 2 will automatically begin when the timer expires.
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (activeQuestions.length === 0) {
        const hasMath = questions.some(q => q.section === 'math')
        const hasEnglish = questions.some(q => q.section === 'english')

        return (
            <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
                <div className="max-w-md bg-white rounded-2xl border border-slate-200/80 p-8 space-y-5 mx-auto shadow-sm">
                    <div className="space-y-2">
                        <h3 className="text-md font-bold text-slate-900">No Standard Modules Formed</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            No loaded items align with the metrics for {currentSection === 1 ? 'Reading & Writing' : 'Mathematics'}.
                        </p>
                    </div>

                    <div className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-xl font-mono">
                        Pool Status: {questions.length} questions recognized.
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        {currentSection === 1 && hasMath && (
                            <button
                                onClick={() => setCurrentSection(2)}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold tracking-wider rounded-xl transition-colors cursor-pointer"
                            >
                                Route to Mathematics Section
                            </button>
                        )}
                        {currentSection === 2 && hasEnglish && (
                            <button
                                onClick={() => {
                                    setCurrentSection(1)
                                    setCurrentQuestionIndex(0)
                                }}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold tracking-wider rounded-xl transition-colors cursor-pointer"
                            >
                                Route to English Section
                            </button>
                        )}
                        <Link href="/practice" className="inline-block text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors mt-2">
                            Return to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (review) {
        return (
            <div className="h-screen w-screen bg-slate-50 flex flex-col overflow-hidden text-slate-900 relative">
                <header className="h-16 bg-white border-b border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-400 tracking-widest block">
                            Section {currentSection}: {currentSection === 1 ? 'Reading and Writing' : 'Mathematics'}
                        </span>
                        <span className="text-sm font-bold text-slate-800 block flex items-center gap-1.5 tracking-wide mt-0.5">
                            <ListChecks size={18} weight="bold" className="text-slate-900" /> Section Review Summary
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isTimerHidden && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200/40 text-slate-900 font-mono text-sm font-bold rounded-xl">
                                <Clock size={16} weight="bold" className="text-slate-500" />
                                <span>{formatTime(timeLeft)}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setReview(false)}
                            className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                        >
                            Return to Test
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1">
                            <h2 className="text-base font-bold text-slate-900 tracking-wide">Review Your Progress</h2>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Review your answers before finalizing Section {currentSection}. You can expand questions below to preview content or jump directly to any item.
                            </p>
                        </div>
                        <div className="flex gap-2 text-sm shrink-0">
                            <div className="bg-slate-50 rounded-xl text-slate-600 px-3 py-2 border border-slate-200/60 font-semibold">
                                Answered: {activeQuestions.filter(q => selectedAnswers[q.id] !== undefined).length} / {activeQuestions.length}
                            </div>
                            <div className="bg-amber-50 rounded-xl text-amber-700 px-3 py-2 border border-amber-200/60 font-semibold flex items-center gap-1">
                                <Flag size={12} weight="fill" /> Flagged: {activeQuestions.filter(q => flaggedQuestions[q.id] === true).length}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {activeQuestions.map((q, idx) => {
                            const choice = selectedAnswers[q.id]
                            const isFlagged = flaggedQuestions[q.id] === true
                            const isOpen = reveal[q.id] === true

                            return (
                                <div key={q.id} className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden transition-all shadow-sm">
                                    <div
                                        className="p-4 flex items-center justify-between gap-4 cursor-pointer bg-white hover:bg-slate-50/70 select-none"
                                        onClick={() => toggleRevealQuestion(q.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setCurrentQuestionIndex(idx)
                                                    setReview(false)
                                                }}
                                                className="w-9 h-9 bg-slate-100 border border-slate-200/40 rounded-xl text-slate-700 font-extrabold text-sm flex items-center justify-center hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                                                title="Jump directly to question"
                                            >
                                                {idx + 1}
                                            </button>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">Question {idx + 1}</span>
                                                <span className="text-sm font-bold text-slate-400 tracking-wider">{q.domain || 'General Pool'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {isFlagged && (
                                                <span className="bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold px-2 py-1 border border-amber-200/60 flex items-center gap-1">
                                                    <Flag size={12} weight="fill" /> Flagged
                                                </span>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-400">Response:</span>
                                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold border ${choice ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 italic font-normal'}`}>
                                                    {choice || '—'}
                                                </span>
                                            </div>
                                            <div className="text-slate-400 hover:text-slate-600 p-1">
                                                {isOpen ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="px-6 pb-5 pt-2 border-t border-slate-100 bg-slate-50/40 text-sm text-slate-800 space-y-4">
                                            <div className="text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200/60 font-normal shadow-sm">
                                                {renderLexicalOrText(q.stimulus)}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {q.options.map((opt) => (
                                                    <div
                                                        key={opt.key}
                                                        className={`p-3 rounded-xl text-sm flex items-center gap-3 border transition-colors ${choice === opt.key ? 'bg-slate-50 border-slate-400 text-slate-950 font-semibold' : 'bg-white text-slate-600 border-slate-200'}`}
                                                    >
                                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold border ${choice === opt.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                                            {opt.key}
                                                        </span>
                                                        <span className="overflow-x-auto w-full">{renderTextWithMath(opt.text)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </main>

                <footer className="h-16 bg-white border-t border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                    <button
                        onClick={() => setReview(false)}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-bold tracking-wider transition-all cursor-pointer"
                    >
                        <ArrowLeft size={14} weight="bold" /> Back To Test
                    </button>

                    <button
                        onClick={() => {
                            if (currentSection === 1) {
                                handleSectionTransition()
                            } else {
                                handleTriggerScoreCalculation()
                            }
                        }}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                    >
                        <span>{currentSection === 1 ? 'Skip Section' : 'Submit Exam'}</span>
                    </button>
                </footer>
            </div>
        )
    }

    return (
        <div className="h-screen w-screen bg-slate-50 flex flex-col overflow-hidden text-slate-900 relative">

            {currentSection === 2 && isDesmosOpen && (
                <div
                    ref={calculatorReference}
                    style={{
                        position: 'fixed',
                        left: `${desmosPosition.x}px`,
                        top: `${desmosPosition.y}px`,
                        width: isDesmosMinimized ? '280px' : `${desmosSize.width}px`,
                        height: isDesmosMinimized ? '42px' : `${desmosSize.height}px`,
                        zIndex: 40,
                    }}
                    className="bg-white border border-slate-300 flex flex-col select-none rounded-2xl shadow-xl overflow-hidden"
                    onMouseDown={handleMouseDown}
                >
                    <div className="drag-handle bg-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-move text-sm font-bold tracking-wide border-b border-slate-800">
                        <span className="flex items-center gap-1.5 tracking-wider text-sm text-slate-300">
                            <Calculator size={14} weight="bold" /> Desmos Workspace
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDesmosMinimized(!isDesmosMinimized); }}
                                className="hover:text-slate-300 p-0.5 cursor-pointer bg-slate-800 rounded-md"
                                title="Minimize Calculator"
                            >
                                <Minus size={12} weight="bold" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDesmosOpen(false); }}
                                className="hover:text-rose-400 p-0.5 cursor-pointer bg-slate-800 rounded-md"
                                title="Close Calculator"
                            >
                                <XCircle size={12} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {!isDesmosMinimized && (
                        <div className="flex-1 bg-white relative w-full h-full">
                            <iframe
                                src="https://www.desmos.com/testing/cb-digital-sat/graphing"
                                className="w-full h-full border-0"
                                title="Official Digital SAT Desmos Calculator"
                            />
                            <div
                                onMouseDown={handleResizeMouseDown}
                                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize bg-slate-100 flex items-center justify-center border-t border-l border-slate-200 rounded-tl-md"
                                title="Resize Workspace"
                            >
                                <HandGrabbing size={12} className="text-slate-500" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isPaused && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full text-center space-y-5 mx-auto shadow-xl">
                        <h3 className="text-base font-bold text-slate-900 tracking-wide">Session Suspended</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Your current runtime logs and state counters remain safely allocated. Do not exit out of the tab, information will not be saved until the test is completed.</p>
                        <button
                            onClick={() => setIsPaused(false)}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99]"
                        >
                            Resume Test
                        </button>
                    </div>
                </div>
            )}

            <header className="h-16 bg-white border-b border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tracking-wide text-slate-800 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        {currentSection === 1 ? 'Section 1: Reading & Writing' : 'Section 2: Mathematics'} &bull; Question <span className="font-mono">{currentQuestionIndex + 1}</span> of <span className="font-mono">{activeQuestions.length}</span>
                    </span>
                    <button
                        onClick={() => handleToggleFlag(currentQuestion.id)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${isCurrentFlagged ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                        <BookmarkSimple size={14} weight={isCurrentFlagged ? "fill" : "bold"} />
                        <span>{isCurrentFlagged ? 'Flagged' : 'Flag Question'}</span>
                    </button>

                    {currentSection === 2 && (
                        <button
                            onClick={() => setIsDesmosOpen(!isDesmosOpen)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${isDesmosOpen ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            <Calculator size={14} weight="bold" />
                            <span>Graphing Calculator</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {!isTimerHidden && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/60 text-slate-900 font-mono text-sm font-bold rounded-xl shadow-inner">
                            <Clock size={16} weight="bold" className="text-slate-400" />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsTimerHidden(!isTimerHidden)}
                        className="text-sm font-bold text-slate-400 hover:text-slate-600 tracking-wide transition-colors"
                    >
                        {isTimerHidden ? 'Display Clock' : 'Hide Clock'}
                    </button>
                    <button
                        onClick={() => setIsPaused(true)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-slate-300 transition-all"
                    >
                        Pause
                    </button>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row bg-[#fdfdfd] p-4 gap-4">
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col">
                    <div className="text-sm font-bold text-slate-400 capitalize tracking-widest border-b border-slate-100 pb-2 mb-4 shrink-0">
                        {currentQuestion.domain || 'Section Domain'} &bull; {currentQuestion.topic || 'General Metric'}
                    </div>
                    <div className="flex-1 text-slate-800 text-sm leading-relaxed font-normal select-text selection:bg-slate-100">
                        {renderLexicalOrText(currentQuestion.stimulus)}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col justify-between">
                    <div className="space-y-5 w-full">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-sm font-bold text-slate-400 tracking-widest">Options Selection</span>
                            <button
                                onClick={() => setIsEliminatorActive(!isEliminatorActive)}
                                className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all ${isEliminatorActive ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
                            >
                                Eliminate Options
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {currentQuestion.options.map((opt) => {
                                const isEliminated = eliminatedOptions[currentQuestion.id]?.includes(opt.key)
                                const isSelected = userChoice === opt.key
                                return (
                                    <div
                                        key={opt.key}
                                        onClick={() => !isEliminated && handleSelectOption(currentQuestion.id, opt.key)}
                                        className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-4 transition-all cursor-pointer select-none group ${
                                            isSelected
                                                ? 'bg-slate-50/80 border-slate-900 text-slate-950 font-semibold ring-1 ring-slate-900'
                                                : isEliminated
                                                    ? 'bg-slate-50/50 border-slate-100 text-slate-400 line-through opacity-40'
                                                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 overflow-x-auto w-full">
                                            <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${isSelected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-slate-100'}`}>
                                                {opt.key}
                                            </span>
                                            <span className="leading-relaxed text-slate-800 text-sm py-0.5 overflow-x-auto w-full font-medium">
                                                {renderTextWithMath(opt.text)}
                                            </span>
                                        </div>
                                        {isEliminatorActive && (
                                            <button
                                                onClick={(e) => handleToggleCrossout(currentQuestion.id, opt.key, e)}
                                                className="text-sm font-bold tracking-wider text-slate-400 hover:text-slate-800 hover:border-slate-300 shrink-0 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-none transition-colors"
                                            >
                                                {isEliminated ? 'Restore' : 'Strike'}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-6 shrink-0 border-t border-slate-50 mt-6 flex items-center justify-between text-sm text-slate-400 font-medium">
                        <span>
                            {isSavingAnswer[currentQuestion.id] ? "Saving selection..." : "Progress captured"}
                        </span>
                    </div>
                </div>
            </main>

            <footer className="h-16 bg-white border-t border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                <button
                    onClick={() => setReview(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-sm font-bold tracking-wider transition-all cursor-pointer"
                >
                    <ListChecks size={14} weight="bold" /> Review Questions
                </button>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrevQuestion}
                        disabled={currentQuestionIndex === 0}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        <ArrowLeft size={12} weight="bold" /> Previous
                    </button>
                    <button
                        onClick={handleNextQuestion}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl tracking-wider border border-slate-900 hover:bg-slate-800 transition-all shadow-sm active:scale-[0.99]"
                    >
                        {currentQuestionIndex === activeQuestions.length - 1 ? 'Review' : 'Next'} <ArrowRight size={12} weight="bold" />
                    </button>
                </div>
            </footer>
        </div>
    )
}

export default function PracticeTestPage() {
    return (
        <Suspense fallback={null}>
            <PracticeTestController />
        </Suspense>
    )
}