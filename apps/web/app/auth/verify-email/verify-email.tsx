'use client'
import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { verifyEmail } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import AuthLayout from '@components/Auth/AuthLayout'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

interface VerifyEmailClientProps {
    org: any
}

function VerifyEmailClient({ org }: VerifyEmailClientProps) {
    const { t } = useTranslation();
    const { track } = useLHAnalytics('public')
    const searchParams = useSearchParams()
    const token = searchParams.get('token') || ''
    const userUuid = searchParams.get('user') || ''
    const orgUuid = searchParams.get('org') || ''

    const [isVerifying, setIsVerifying] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [showMessage, setShowMessage] = useState(false)

    useEffect(() => {
        const verify = async () => {
            if (!token || !userUuid || !orgUuid) {
                track(AnalyticsEvent.EmailVerificationCompleted, { result: 'fail' })
                setError(t('auth.verification_missing_params'))
                setIsVerifying(false)
                setShowMessage(true)
                return
            }

            try {
                const res = await verifyEmail(token, userUuid, orgUuid)
                if (res.success) {
                    track(AnalyticsEvent.EmailVerificationCompleted, { result: 'success' })
                    setSuccess(true)
                    setShowMessage(true)
                    // Verification also signs the user in (session cookies were
                    // set via the auth proxy). Send them straight into the app —
                    // a full navigation lets auth bootstrap from the new cookies.
                    setTimeout(() => {
                        window.location.assign('/')
                    }, 1200)
                } else {
                    track(AnalyticsEvent.EmailVerificationCompleted, { result: 'fail' })
                    setError(res.error || t('auth.verification_failed'))
                    setShowMessage(true)
                }
            } catch {
                track(AnalyticsEvent.EmailVerificationCompleted, { result: 'fail' })
                setError(t('auth.verification_failed'))
                setShowMessage(true)
            } finally {
                setIsVerifying(false)
            }
        }

        verify()
    }, [token, userUuid, orgUuid, t, track])

    return (
        <AuthLayout org={org} welcomeText={t('auth.verifying_your_email')}>

            {/* FIXED POSITIONING TOP BAR NOTIFICATION */}
            {showMessage && !isVerifying && (error || success) && (
                <div className={`
                        fixed top-0 left-0 right-0 z-50 w-full px-6 py-3.5 flex items-center justify-between gap-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-200
                        ${error ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
                    `}>
                    <div className="flex items-center gap-3 flex-1 min-w-0 max-w-7xl mx-auto w-full">
                        {error ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle size={18} className="shrink-0" />}
                        <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">
                                    {error ? t('auth.verification_failed') : t('auth.email_verified_success')}
                                </span>
                            {success && (
                                <span className="text-sm ml-2 font-bold">
                                        · <Link href="/" className="underline hover:no-underline">{t('auth.proceed_to_login')}</Link>
                                    </span>
                            )}
                        </div>

                        <button
                            onClick={() => setShowMessage(false)}
                            className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-row">
                {/* Normalized container layout width from max-w-sm to max-w-lg */}
                <div className="m-auto w-full max-w-lg px-6 py-8 sm:py-0">

                    {/* Normalized header sizing & left alignment matching Login */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isVerifying ? t('auth.verify_email_title') : error ? t('auth.verification_failed') : t('auth.email_verified_success')}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {isVerifying ? t('auth.verifying_email') : error ? error : t('auth.email_verified_message')}
                        </p>
                    </div>

                    {/* Inline Content States (Ugly white box cards removed completely) */}
                    <div className="w-full">

                        {/* Loading State */}
                        {isVerifying && (
                            <div className="flex items-center gap-3 py-2 text-gray-600">
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                                <span className="text-sm font-medium text-neutral-500">{t('auth.verifying_email')}</span>
                            </div>
                        )}

                        {/* Error State View Actions */}
                        {!isVerifying && error && (
                            <div className="space-y-6">
                                <p className="text-sm text-black/35 leading-normal">
                                    {t('auth.verification_trouble')}
                                </p>
                                <div className="pt-2">
                                    <Link
                                        href="/login"
                                        className="block w-full bg-black text-white font-semibold text-center py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                                    >
                                        {t('auth.back_to_login')}
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Success State View Actions */}
                        {!isVerifying && success && (
                            <div className="pt-2">
                                <Link
                                    href="/"
                                    className="block w-full bg-black text-white font-semibold text-center py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                                >
                                    {t('auth.proceed_to_login')}
                                </Link>
                            </div>
                        )}

                    </div>

                    {/* Back to Login structural secondary baseline footer matching Reset Flow */}
                    {!isVerifying && !error && !success && (
                        <p className="text-center text-sm text-black/35 mt-7">
                            <Link href="/login" className="font-semibold text-gray-900 hover:underline">
                                {t('auth.back_to_login')}
                            </Link>
                        </p>
                    )}

                </div>
            </div>
        </AuthLayout>
    )
}

export default VerifyEmailClient