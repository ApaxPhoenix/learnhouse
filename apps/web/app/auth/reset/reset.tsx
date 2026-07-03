'use client'
import React from 'react'
import FormLayout, {
    FormField,
    FormLabelAndMessage,
    Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useFormik } from 'formik'
import { resetPassword } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import AuthLayout from '@components/Auth/AuthLayout'
import { PasswordStrengthIndicator, validatePasswordStrength } from '@components/Auth/PasswordStrengthIndicator'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

const validate = (values: any, t: any) => {
    const errors: any = {}

    if (!values.email) {
        errors.email = t('validation.required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = t('validation.invalid_email')
    }

    if (!values.new_password) {
        errors.new_password = t('validation.required')
    } else {
        const passwordValidation = validatePasswordStrength(values.new_password)
        if (!passwordValidation.isValid) {
            errors.new_password = t('auth.password_requirements_not_met')
        }
    }

    if (!values.confirm_password) {
        errors.confirm_password = t('validation.required')
    }

    if (values.new_password !== values.confirm_password) {
        errors.confirm_password = t('auth.passwords_do_not_match')
    }

    if (!values.reset_code) {
        errors.reset_code = t('validation.required')
    }
    return errors
}

interface ResetPasswordClientProps {
    org: any
}

function ResetPasswordClient({ org }: ResetPasswordClientProps) {
    const { t } = useTranslation();
    const { track } = useLHAnalytics('public')
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const searchParams = useSearchParams()
    const reset_code = searchParams.get('resetCode') || ''
    const email = searchParams.get('email') || ''
    const [error, setError] = React.useState('')
    const [message, setMessage] = React.useState('')
    const [showMessage, setShowMessage] = React.useState(false)

    const formik = useFormik({
        initialValues: {
            email: email,
            new_password: '',
            confirm_password: '',
            reset_code: reset_code
        },
        validate: (values) => validate(values, t),
        enableReinitialize: true,
        onSubmit: async (values) => {
            setIsSubmitting(true)
            setError('')
            setMessage('')
            setShowMessage(false)
            track(AnalyticsEvent.PasswordResetSubmitted, { came_from_email_link: Boolean(reset_code) })
            let res = await resetPassword(values.email, values.new_password, org?.id, values.reset_code)
            if (res.status == 200) {
                setMessage(res.data)
                setShowMessage(true)
                setIsSubmitting(false)
            } else {
                setError(res.data?.detail ?? t('auth.error_generic'))
                setShowMessage(true)
                setIsSubmitting(false)
            }
        },
    })

    return (
        <AuthLayout org={org} welcomeText={t('auth.create_new_password')}>

            {/* FIXED POSITIONING TOP BAR NOTIFICATION */}
            {showMessage && (error || message) && (
                <div className={`
                        fixed top-0 left-0 right-0 z-50 w-full px-6 py-3.5 flex items-center justify-between gap-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-200
                        ${error ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
                    `}>
                    <div className="flex items-center gap-3 flex-1 min-w-0 max-w-7xl mx-auto w-full">
                        {error ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle size={18} className="shrink-0" />}
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{error || message}</span>
                            {message && (
                                <span className="text-sm ml-2 font-bold">
                                        · <Link href="/login" className="underline hover:no-underline">{t('auth.proceed_to_login')}</Link>
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
                    {/* Normalized header sizing matching Login */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">{t('auth.reset_password_title')}</h1>
                        <p className="text-gray-500 mt-1">{t('auth.reset_password_description')}</p>
                    </div>

                    {/* Removed the ugly white background card box completely to make form fields inline */}
                    <div>
                        <FormLayout onSubmit={formik.handleSubmit} className="space-y-5">

                            <FormField name="email" className="space-y-0.5">
                                <div className="text-sm text-black/60 font-normal transition-colors leading-4">
                                    <FormLabelAndMessage
                                        label={t('auth.email')}
                                        message={formik.touched.email ? formik.errors.email : undefined}
                                    />
                                </div>
                                <Form.Control asChild>
                                    <Input
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.email}
                                        type="email"
                                        placeholder="Enter your email"
                                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                                    />
                                </Form.Control>
                            </FormField>

                            <FormField name="reset_code" className="space-y-0.5">
                                <div className="text-sm text-black/60 font-normal transition-colors leading-4">
                                    <FormLabelAndMessage
                                        label={t('auth.reset_code')}
                                        message={formik.touched.reset_code ? formik.errors.reset_code : undefined}
                                    />
                                </div>
                                <Form.Control asChild>
                                    <Input
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.reset_code}
                                        type="text"
                                        placeholder="Enter your reset code"
                                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                                    />
                                </Form.Control>
                            </FormField>

                            <FormField name="new_password" className="space-y-0.5">
                                <div className="text-sm text-black/60 font-normal transition-colors leading-4">
                                    <FormLabelAndMessage
                                        label={t('auth.new_password')}
                                        message={formik.touched.new_password ? formik.errors.new_password : undefined}
                                    />
                                </div>
                                <Form.Control asChild>
                                    <Input
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.new_password}
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="Enter your new password"
                                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                                    />
                                </Form.Control>
                                <div className="pt-1">
                                    <PasswordStrengthIndicator password={formik.values.new_password} />
                                </div>
                            </FormField>

                            <FormField name="confirm_password" className="space-y-0.5">
                                <div className="text-sm text-black/60 font-normal transition-colors leading-4">
                                    <FormLabelAndMessage
                                        label={t('auth.confirm_password')}
                                        message={formik.touched.confirm_password ? formik.errors.confirm_password : undefined}
                                    />
                                </div>
                                <Form.Control asChild>
                                    <Input
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.confirm_password}
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="Confirm your new password"
                                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                                    />
                                </Form.Control>
                            </FormField>

                            <div className="pt-3">
                                <Form.Submit asChild>
                                    <button className="w-full bg-black text-white font-semibold text-center py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                                        {isSubmitting ? t('common.loading') : t('auth.change_password')}
                                    </button>
                                </Form.Submit>
                            </div>
                        </FormLayout>
                    </div>

                    {/* Back to Login link styling normalized to text-black/35 and mt-7 */}
                    <p className="text-center text-sm text-black/35 mt-7">
                        {t('auth.remember_password')}{' '}
                        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
                            {t('auth.login')}
                        </Link>
                    </p>
                </div>
            </div>
        </AuthLayout>
    )
}

export default ResetPasswordClient