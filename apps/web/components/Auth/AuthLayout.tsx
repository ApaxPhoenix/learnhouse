'use client'
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
    org?: { name: string; logoUrl?: string }
    welcomeText?: string
    children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="relative flex flex-col lg:grid lg:grid-cols-[1fr_minmax(450px,45%)] h-screen overflow-hidden">

            {/* Trendy Grid Background */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #e7e5e4 1px, transparent 1px),
                        linear-gradient(to bottom, #e7e5e4 1px, transparent 1px)
                    `,
                    backgroundSize: "20px 20px",
                    maskImage: `
                        repeating-linear-gradient(to right, black 0px, black 3px, transparent 3px, transparent 8px),
                        repeating-linear-gradient(to bottom, black 0px, black 3px, transparent 3px, transparent 8px),
                        radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)
                    `,
                    WebkitMaskImage: `
                        repeating-linear-gradient(to right, black 0px, black 3px, transparent 3px, transparent 8px),
                        repeating-linear-gradient(to bottom, black 0px, black 3px, transparent 3px, transparent 8px),
                        radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)
                    `,
                    maskComposite: "intersect",
                    WebkitMaskComposite: "source-in",
                }}
            />

            {/* Left Side: Auth Content/Forms (BUMPED TO z-20 TO PREVENT TOAST CLIPPING) */}
            <div className="flex flex-col relative flex-1 lg:h-full overflow-auto z-20">
                {children}
            </div>

            {/* Right Side: Branding Sidebar (Desktop Only) */}
            <div className="hidden lg:block h-full z-10 relative w-full overflow-hidden">
                <div className="absolute top-16 bottom-16 left-16 right-16 overflow-hidden rounded-2xl bg-neutral-900">
                    <div className="absolute inset-0 w-full h-full">
                        <Image
                            src="/auth.webp"
                            alt="Auth Branding"
                            fill
                            priority
                            className="object-cover object-right"
                            sizes="45vw"
                        />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

                    <div className="absolute top-12 bottom-12 left-12 right-12 flex flex-col justify-between max-w-sm z-30">
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-bold text-white tracking-tight pointer-events-none">
                                All your knowledge together
                            </h1>
                            <p className="text-white/70 mt-2 text-sm font-medium leading-relaxed pointer-events-none">
                                A platform where Linden students can gather, collaborate, and learn seamlessly.
                            </p>
                        </div>

                        <div className="h-[40px] w-[40px] flex items-center justify-center shrink-0">
                            <Link prefetch href="/" className="block w-full h-full">
                                <Image
                                    src="/lrn.svg"
                                    alt="LearnHouse"
                                    width={40}
                                    height={40}
                                    className={cn(
                                        "transition-opacity hover:opacity-100 opacity-60 invert object-contain"
                                    )}
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}