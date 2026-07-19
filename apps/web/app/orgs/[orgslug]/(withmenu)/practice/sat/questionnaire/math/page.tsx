"use client"

import React, { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import {
    ArrowLeft,
    ArrowRight,
    Calculator,
    XCircle,
    Minus,
    HandGrabbing,
    ListChecks
} from '@phosphor-icons/react'
import { getMathQuestionsAction, submitMathAttemptAction, getMathAnalyticsAction } from './actions'

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
    section: 'math'
    domain?: string
    topic?: string
    difficulty: 'easy' | 'medium' | 'hard'
}

interface LexicalNode {
    type: string
    format?: number
    text?: string
    children?: LexicalNode[]
}

interface LexicalRoot {
    root?: {
        children?: LexicalNode[]
    }
}

const checkIsCorrect = (q: Question, selectedKey: string | undefined): boolean => {
    if (!selectedKey) return false

    const cleanAnswer = q.answer.trim().toUpperCase()
    const cleanKey = selectedKey.trim().toUpperCase()

    const selectedOption = q.options.find(o => o.key.toUpperCase() === cleanKey)
    if (!selectedOption) return false

    const cleanOptionText = selectedOption.text.trim().toUpperCase()

    if (cleanKey === cleanAnswer) return true
    if (cleanOptionText === cleanAnswer) return true
    if (selectedOption.id.toUpperCase() === cleanAnswer) return true

    const structuralAnswerMatch = cleanAnswer.replace(/[\$\\]/g, '')
    const structuralOptionMatch = cleanOptionText.replace(/[\$\\]/g, '')
    if (structuralOptionMatch === structuralAnswerMatch || structuralOptionMatch === cleanAnswer) return true

    const correctOption = q.options.find(o =>
        o.key.toUpperCase() === cleanAnswer ||
        o.text.trim().toUpperCase() === cleanAnswer ||
        o.id.toUpperCase() === cleanAnswer
    )
    if (correctOption && correctOption.key.toUpperCase() === cleanKey) return true

    return false
}

const renderMarkdownStyles = (text: string): React.ReactNode[] => {
    if (!text) return []

    const boldParts = text.split(/(\*\*|__)/g)
    let isBold = false
    let elementKey = 0

    const boldMapped = boldParts.flatMap((part) => {
        if (part === '**' || part === '__') {
            isBold = !isBold
            return []
        }

        const italicParts = part.split(/(\*|_)/g)
        let isItalic = false

        return italicParts.map((subPart) => {
            if (subPart === '*' || subPart === '_') {
                isItalic = !isItalic
                return null
            }
            if (!subPart) return null

            elementKey++
            let className = ""
            if (isBold) className += " font-bold text-slate-900"
            if (isItalic) className += " italic"

            return className ? (
                <span key={`md-span-${elementKey}`} className={className}>{subPart}</span>
            ) : subPart
        }).filter(Boolean)
    })

    return boldMapped as React.ReactNode[]
}

const sanitizeAndExtractLaTeX = (text: string) => {
    if (!text) return []

    let cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '')
    cleaned = cleaned.replace(/\\\\\[/g, '\\[')
    cleaned = cleaned.replace(/\\\\\]/g, '\\]')
    cleaned = cleaned.replace(/\\\\\(/g, '\\(')
    cleaned = cleaned.replace(/\\\\\)/g, '\\)')
    cleaned = cleaned.replace(/−44\s*4\s*−4\s*\\/g, '\\frac{-4}{4}')

    cleaned = cleaned.replace(/(?<!\/)\b(\d+)\/(\d+)\b(?!\/)\s*(=\s*\d*)?/g, (match, p1, p2, p3) => {
        if (p3) {
            return `\\(\\frac{${p1}}{${p2}} ${p3}\\)`
        }
        return `\\(\\frac{${p1}}{${p2}}\\)`
    })

    const blockRegex = /(\\\[[\s\S]*?\\\]|\\begin\{align\*\}[\s\S]*?\\end\{align\*\}|\$\$[\s\S]*?\$\$)/g
    const parts = cleaned.split(blockRegex)
    const results: any[] = []

    const processTextForRawLatex = (str: string) => {
        const rawLatexRegex = /(\\\[a-zA-Z]+(?:\{[^}]*\})*)/g
        const fragments = str.split(rawLatexRegex)

        fragments.forEach((frag) => {
            if (!frag) return
            if (frag.startsWith('\\') && frag.length > 1) {
                results.push({ isInline: true, math: frag.trim() })
            } else {
                results.push({ isText: true, content: frag })
            }
        })
    }

    parts.forEach((part) => {
        if (!part) return

        if (part.startsWith('\\[') && part.endsWith('\\]')) {
            results.push({ isBlock: true, math: part.slice(2, -2).trim() })
            return
        }
        if (part.startsWith('\\begin{align*}') && part.endsWith('\\end{align*}')) {
            results.push({ isBlock: true, math: part.trim() })
            return
        }
        if (part.startsWith('$$') && part.endsWith('$$')) {
            results.push({ isBlock: true, math: part.slice(2, -2).trim() })
            return
        }

        const inlineParenthesesRegex = /(\\\([\s\S]*?\\\))/g
        const subParts = part.split(inlineParenthesesRegex)

        subParts.forEach((subPart) => {
            if (!subPart) return

            if (subPart.startsWith('\\(') && subPart.endsWith('\\)')) {
                results.push({ isInline: true, math: subPart.slice(2, -2).trim() })
                return
            }

            const dollarRegex = /(\$(?!\$)[\s\S]*?\$)/g
            const dollarParts = subPart.split(dollarRegex)

            dollarParts.forEach((dPart) => {
                if (!dPart) return

                if (dPart.startsWith('$') && dPart.endsWith('$')) {
                    const inner = dPart.slice(1, -1)
                    const hasMathSymbols = /[=\+\-\*\/\\\^_<>≤≥≠]/.test(inner)
                    const hasMultipleWords = /\b(is|a|constant|cost|and|the|per|fee|of|total|represented|by|equation|value|find)\b/i.test(inner) && (inner.match(/\s+/g) || []).length > 1

                    if (!hasMathSymbols && hasMultipleWords) {
                        processTextForRawLatex(dPart)
                    } else {
                        results.push({ isInline: true, math: inner.trim() })
                    }
                } else {
                    processTextForRawLatex(dPart)
                }
            })
        })
    })

    return results
}

const renderTextWithMathAndMarkdown = (text: string) => {
    if (!text) return null
    const segments = sanitizeAndExtractLaTeX(text)

    return segments.map((seg, idx) => {
        if ('isBlock' in seg && seg.isBlock) {
            return (
                <div key={`block-${idx}`} className="my-4 overflow-x-auto bg-slate-50/60 p-4 rounded-xl border border-slate-200/50">
                    <BlockMath
                        math={seg.math}
                        renderError={() => (
                            <div className="text-slate-700 text-sm font-mono max-w-full overflow-x-auto whitespace-pre-wrap bg-slate-100 p-2 rounded">
                                {seg.math}
                            </div>
                        )}
                    />
                </div>
            )
        }
        if ('isInline' in seg && seg.isInline) {
            return (
                <InlineMath
                    key={`inline-${idx}`}
                    math={seg.math}
                    renderError={() => <span className="text-slate-700 font-medium">{seg.math}</span>}
                />
            )
        }
        if ('isText' in seg && seg.isText) {
            return <React.Fragment key={`text-${idx}`}>{renderMarkdownStyles(seg.content)}</React.Fragment>
        }
        return null
    })
}

const renderLexicalOrText = (content: string | LexicalRoot | null | undefined): React.ReactNode => {
    if (!content) return null
    if (typeof content === 'string') {
        return <div className="space-y-1">{renderTextWithMathAndMarkdown(content)}</div>
    }

    try {
        if (content.root?.children) {
            const renderNodes = (nodes: LexicalNode[]): React.ReactNode[] => {
                return nodes.map((node, idx) => {
                    if (node.type === 'paragraph') {
                        return (
                            <div key={idx} className="text-slate-700 leading-relaxed text-[15px]">
                                {node.children ? renderNodes(node.children) : null}
                            </div>
                        )
                    }
                    if (node.type === 'text') {
                        return (
                            <span key={idx} className={node.format === 1 ? "font-semibold text-slate-900" : ""}>
                                {renderTextWithMathAndMarkdown(node.text || '')}
                            </span>
                        )
                    }
                    if (node.type === 'heading') {
                        return (
                            <h4 key={idx} className="text-base font-bold text-slate-900 mt-3 mb-1">
                                {node.children ? renderNodes(node.children) : null}
                            </h4>
                        )
                    }
                    if (node.type === 'list') {
                        const tag = (node as any).tag === 'ol' ? 'ol' : 'ul';
                        const className = tag === 'ol' ? 'list-decimal pl-5 space-y-1 text-slate-700 my-2' : 'list-disc pl-5 space-y-1 text-slate-700 my-2';
                        return React.createElement(tag, { key: idx, className }, node.children ? renderNodes(node.children) : null);
                    }
                    if (node.type === 'listitem') {
                        return (
                            <li key={idx} className="text-[15px] leading-relaxed">
                                {node.children ? renderNodes(node.children) : null}
                            </li>
                        )
                    }
                    if (node.type === 'equation' || node.type === 'inline-equation') {
                        const mathStr = (node as any).equation || (node as any).value || '';
                        const isInline = (node as any).inline !== false;
                        if (isInline) {
                            return <InlineMath key={idx} math={mathStr} renderError={() => <span className="text-slate-700 font-medium">{mathStr}</span>} />
                        } else {
                            return (
                                <div key={idx} className="my-3 overflow-x-auto bg-slate-50/60 p-3 rounded-xl border border-slate-200/50">
                                    <BlockMath math={mathStr} renderError={() => <div className="text-slate-700 text-sm font-mono whitespace-pre-wrap">{mathStr}</div>} />
                                </div>
                            )
                        }
                    }
                    return null
                })
            }

            return (
                <div className="space-y-4">
                    {renderNodes(content.root.children)}
                </div>
            )
        }
    } catch (e) {
        console.error(e)
        return <div className="text-slate-400 text-sm italic">Error parsing structure content</div>
    }
    return null
}

function MathPracticeController() {
    const [questions, setQuestions] = useState<Question[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
    const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({})
    const [isEliminatorActive, setIsEliminatorActive] = useState(false)
    const [isSavingAnswer, setIsSavingAnswer] = useState<Record<string, boolean>>({})
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const [isDesmosOpen, setIsDesmosOpen] = useState(false)
    const [isDesmosMinimized, setIsDesmosMinimized] = useState(false)
    const [desmosPosition, setDesmosPosition] = useState({ x: 160, y: 120 })
    const [desmosSize, setDesmosSize] = useState({ width: 540, height: 460 })
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)

    const dragStart = useRef({ x: 0, y: 0 })
    const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 })
    const calculatorReference = useRef<HTMLDivElement>(null)

    useEffect(() => {
        async function loadDatasetAndProgress() {
            try {
                const questionData = await getMathQuestionsAction()

                if (questionData.success && questionData.docs && questionData.docs.length > 0) {
                    const uniqueMap = new Map<string, any>()

                    questionData.docs.forEach((doc: any) => {
                        if (doc && doc.id) {
                            uniqueMap.set(String(doc.id), doc)
                        }
                    })

                    const allItems: Question[] = Array.from(uniqueMap.values()).map((doc: any) => {
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
                            stimulus: doc.stimulus || doc.passage || "",
                            options: choices,
                            answer: String(doc.answer || doc.correct || '').trim().toUpperCase(),
                            explanation: doc.explanation || "",
                            section: 'math',
                            domain: doc.domain || "Mathematics",
                            topic: doc.topic || "General Practice",
                            difficulty: doc.difficulty || 'medium'
                        }
                    })

                    setQuestions(allItems)

                    const historyData = await getMathAnalyticsAction()
                    if (historyData.success && historyData.rows) {
                        const mappedHistory: Record<string, string> = {}
                        historyData.rows.forEach((row: any) => {
                            mappedHistory[String(row.question_id)] = String(row.selected_option).toUpperCase()
                        })
                        setSelectedAnswers(mappedHistory)
                    }
                } else if (!questionData.success) {
                    throw new Error(questionData.error || 'Failed to fetch math questions')
                }
            } catch (error: unknown) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }

        loadDatasetAndProgress()
    }, [])

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

    const currentQuestion = questions[currentQuestionIndex]
    const userChoice = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined

    const handleSelectOption = async (questionId: string, optionKey: string) => {
        if (userChoice) return

        const formattedKey = optionKey.toUpperCase()

        if (eliminatedOptions[questionId]?.includes(formattedKey)) {
            setEliminatedOptions(prev => ({
                ...prev,
                [questionId]: (prev[questionId] || []).filter(key => key !== formattedKey)
            }))
        }

        setSelectedAnswers(prev => ({ ...prev, [questionId]: formattedKey }))
        setIsSavingAnswer(prev => ({ ...prev, [questionId]: true }))

        try {
            const questionObj = questions.find(q => q.id === questionId)
            if (questionObj) {
                const isCorrect = checkIsCorrect(questionObj, formattedKey)
                const res = await submitMathAttemptAction({
                    questionId: questionId,
                    selectedOptionKey: formattedKey,
                    isCorrect: isCorrect
                })
                if (!res.success) {
                    console.error("Server verification denied choice record:", res.error)
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSavingAnswer(prev => ({ ...prev, [questionId]: false }))
        }
    }

    const handleToggleCrossout = (questionId: string, optionKey: string, event?: React.MouseEvent) => {
        if (event) event.stopPropagation()
        if (userChoice) return

        const formattedKey = optionKey.toUpperCase()

        setEliminatedOptions(prev => {
            const list = prev[questionId] || []
            const isExist = list.includes(formattedKey)
            return {
                ...prev,
                [questionId]: isExist ? list.filter(k => k !== formattedKey) : [...list, formattedKey]
            }
        })
    }

    const handleNextQuestion = () => {
        setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))
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

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center text-sm font-semibold tracking-widest text-slate-500 bg-slate-50">
                <div className="flex flex-col items-center gap-4 mx-auto">
                    <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    if (questions.length === 0) {
        return (
            <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
                <div className="max-w-md bg-white rounded-2xl border border-slate-200/80 p-8 space-y-5 mx-auto shadow-sm">
                    <div className="space-y-2">
                        <h3 className="text-md font-bold text-slate-900">No Questions Found</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            We couldn't locate active math questions in your database library right now.
                        </p>
                    </div>
                    <Link href="/practice" className="inline-block text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors mt-2">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen w-screen bg-slate-50 flex flex-col overflow-hidden text-slate-900 relative">

            {isDesmosOpen && (
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
                            <Calculator size={14} weight="bold" /> Desmos
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDesmosMinimized(!isDesmosMinimized); }}
                                className="hover:text-slate-300 p-0.5 cursor-pointer bg-slate-800 rounded-md animate-none"
                            >
                                <Minus size={12} weight="bold" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDesmosOpen(false); }}
                                className="hover:text-rose-400 p-0.5 cursor-pointer bg-slate-800 rounded-md animate-none"
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
                            >
                                <HandGrabbing size={12} className="text-slate-500" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isMenuOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[80vh] animate-fade-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Question Practice Menu</h3>
                                <p className="text-sm font-medium text-slate-400 tracking-wide mt-0.5">Quick Question Selection</p>
                            </div>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="text-sm font-bold text-slate-400 hover:text-slate-600 border border-slate-200 px-2.5 py-1 rounded-xl bg-white transition-all cursor-pointer"
                            >
                                Close Menu
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {questions.map((q, idx) => {
                                const chosenKey = selectedAnswers[q.id]
                                const isCurrent = currentQuestionIndex === idx

                                let selectionStyle = "bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700"

                                if (isCurrent) {
                                    selectionStyle = "bg-slate-900 border-slate-900 text-white ring-2 ring-slate-900/20"
                                } else if (chosenKey) {
                                    const isCorrect = checkIsCorrect(q, chosenKey)
                                    if (isCorrect) {
                                        selectionStyle = "bg-emerald-500 border-emerald-600 text-white font-semibold"
                                    } else {
                                        selectionStyle = "bg-rose-500 border-rose-600 text-white font-semibold"
                                    }
                                }

                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => {
                                            setCurrentQuestionIndex(idx)
                                            setIsMenuOpen(false)
                                        }}
                                        className={`p-3 border rounded-xl font-mono text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${selectionStyle}`}
                                    >
                                        <span>{idx + 1}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            <header className="h-16 bg-white border-b border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 border border-slate-200 rounded-xl hover:border-slate-300 transition-all cursor-pointer"
                    >
                        <ListChecks size={15} weight="bold" />
                        <span>Question Selection</span>
                    </button>

                    <span className="text-sm font-bold tracking-wide text-slate-800 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hidden sm:inline-block">
                        Question <span className="font-mono">{currentQuestionIndex + 1}</span> of <span className="font-mono">{questions.length}</span>
                    </span>

                    <button
                        onClick={() => setIsDesmosOpen(!isDesmosOpen)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${isDesmosOpen ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                        <Calculator size={14} weight="bold" />
                        <span>Graphing Calculation</span>
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="/practice" className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-slate-300 transition-all">
                        Exit Practice
                    </Link>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row bg-[#fdfdfd] p-4 gap-4">

                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col">
                    <div className="text-sm font-bold text-slate-400 capitalize tracking-widest border-b border-slate-100 pb-2 mb-4 shrink-0">
                        {currentQuestion.domain} &bull; {currentQuestion.topic}
                    </div>

                    <div className="flex-1 text-slate-800 text-[15px] leading-relaxed font-normal select-text selection:bg-slate-100 mb-6">
                        {renderLexicalOrText(currentQuestion.stimulus)}
                    </div>

                    {userChoice && (
                        <div className="mt-auto p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2 animate-fade-in">
                            <div className="text-sm text-slate-500 font-medium">
                                Target Solution Key: <span className="font-extrabold text-slate-700 font-mono">{currentQuestion.answer}</span>
                            </div>
                            <div className="text-sm text-slate-700 leading-relaxed font-normal border-t border-slate-200/40 pt-2">
                                <span className="font-bold block mb-1 text-sm tracking-wider text-slate-400">Solution Strategy:</span>
                                {renderLexicalOrText(currentQuestion.explanation)}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col justify-between">
                    <div className="space-y-5 w-full">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-sm font-bold text-slate-400 tracking-widest">Options Selection</span>
                            {!userChoice && (
                                <button
                                    onClick={() => setIsEliminatorActive(!isEliminatorActive)}
                                    className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all ${isEliminatorActive ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
                                >
                                    Eliminate Options
                                </button>
                            )}
                        </div>

                        <div className="space-y-2.5">
                            {currentQuestion.options.map((opt) => {
                                const isEliminated = eliminatedOptions[currentQuestion.id]?.includes(opt.key.toUpperCase())
                                const isSelected = userChoice === opt.key.toUpperCase()
                                const isThisCorrectOption = checkIsCorrect(currentQuestion, opt.key)

                                let optionStyle = 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                let keyBadgeStyle = 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-slate-100'

                                if (userChoice) {
                                    if (isThisCorrectOption) {
                                        optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-medium ring-1 ring-emerald-500'
                                        keyBadgeStyle = 'bg-emerald-500 border-emerald-500 text-white'
                                    } else if (isSelected) {
                                        optionStyle = 'bg-rose-50 border-rose-500 text-rose-950 font-medium ring-1 ring-rose-500'
                                        keyBadgeStyle = 'bg-rose-500 border-rose-500 text-white'
                                    } else {
                                        optionStyle = 'bg-white border-slate-100 text-slate-400 opacity-60'
                                    }
                                } else if (isEliminated) {
                                    optionStyle = 'bg-slate-50/50 border-slate-100 text-slate-400 line-through opacity-40'
                                }

                                return (
                                    <div
                                        key={opt.key}
                                        onClick={() => !isEliminated && !userChoice && handleSelectOption(currentQuestion.id, opt.key)}
                                        className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-4 transition-all select-none group ${userChoice ? 'cursor-default' : 'cursor-pointer'} ${optionStyle}`}
                                    >
                                        <div className="flex items-center gap-4 overflow-x-auto w-full">
                                            <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${keyBadgeStyle}`}>
                                                {opt.key}
                                            </span>
                                            <div className="leading-relaxed text-[14px] py-0.5 overflow-x-auto w-full font-medium">
                                                {renderTextWithMathAndMarkdown(opt.text)}
                                            </div>
                                        </div>
                                        {isEliminatorActive && !userChoice && (
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
                            {isSavingAnswer[currentQuestion.id] ? "Recording attempt..." : userChoice ? "Answer Submitted" : "Awaiting input..."}
                        </span>
                    </div>
                </div>
            </main>

            <footer className="h-16 bg-white border-t border-slate-200/60 px-6 flex items-center justify-between flex-shrink-0 z-20">
                <div></div>

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
                        disabled={currentQuestionIndex === questions.length - 1}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl tracking-wider border border-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-all shadow-sm active:scale-[0.99]"
                    >
                        Next <ArrowRight size={12} weight="bold" />
                    </button>
                </div>
            </footer>
        </div>
    )
}

export default function MathPracticePage() {
    return (
        <Suspense fallback={null}>
            <MathPracticeController />
        </Suspense>
    )
}