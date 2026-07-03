'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, Mail, User, X } from 'lucide-react'
import Link from 'next/link'
import { signup } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'
import { signIn } from '@components/Contexts/AuthContext'
import { getLEARNHOUSE_TOP_DOMAIN_VAL } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { PasswordStrengthIndicator, validatePasswordStrength } from '@components/Auth/PasswordStrengthIndicator'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

const validate = (values: any) => {
  const errors: any = {}

  if (!values.email) {
    errors.email = 'Email is required'
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = 'Please enter a valid email address'
  }

  if (!values.password) {
    errors.password = 'Password is required'
  } else {
    const passwordValidation = validatePasswordStrength(values.password)
    if (!passwordValidation.isValid) {
      errors.password = 'Password requirements not met'
    }
  }

  if (!values.username) {
    errors.username = 'Username is required'
  } else if (values.username.length < 4) {
    errors.username = 'Username must be at least 4 characters long'
  }

  return errors
}

function OpenSignUpComponent() {
  const { t } = useTranslation()
  const { track } = useLHAnalytics('public')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const org = useOrg() as any
  const _router = useRouter()
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState<{ email_verified: boolean } | null>(null)
  const [showNotification, setShowNotification] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: '',
      password: '',
      username: '',
      first_name: '',
      last_name: '',
    },
    validate: (values) => validate(values),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError('')
      setMessage(null)
      setShowNotification(false)
      setIsSubmitting(true)
      track(AnalyticsEvent.SignupSubmitted, { invite_code_present: false, has_bio: false })
      let res = await signup(values)
      let message = await res.json()
      if (res.status == 200) {
        track(AnalyticsEvent.SignupSucceeded, { email_verified: message.email_verified })
        setMessage(message)
        setShowNotification(true)
        setIsSubmitting(false)
      } else if (
          res.status == 401 ||
          res.status == 400 ||
          res.status == 404 ||
          res.status == 409
      ) {
        track(AnalyticsEvent.SignupFailed, { status_code: res.status })
        setError(message.detail)
        setShowNotification(true)
        setIsSubmitting(false)
      } else {
        track(AnalyticsEvent.SignupFailed, { status_code: res.status })
        setError('Something went wrong. Please try again.')
        setShowNotification(true)
        setIsSubmitting(false)
      }
    },
  })

  useEffect(() => { }, [org])

  const handleGoogleSignIn = () => {
    track(AnalyticsEvent.SignupGoogleClicked)
    if (org?.slug) {
      const topDomain = getLEARNHOUSE_TOP_DOMAIN_VAL();
      const isSecure = window.location.protocol === 'https:';
      const secureAttr = isSecure ? '; secure' : '';
      const baseAttributes = `; path=/; SameSite=Lax${secureAttr}`;
      const domainAttr = topDomain === 'localhost' ? '' : `; domain=.${topDomain}`;
      document.cookie = `LH_oauth_orgslug=${org.slug}${baseAttributes}${domainAttr}`;
      document.cookie = `LH_oauth_org_id=${org.id}${baseAttributes}${domainAttr}`;
    }
    signIn('google', { callbackUrl: `${window.location.origin}/redirect_from_auth` });
  };

  return (
      <>
        {/* Dynamic Status Bar */}
        {showNotification && (error || message) && (
            <div className={`
          w-full px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200
          ${error ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
        `}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {error ? <AlertTriangle size={18} className="shrink-0" /> : <Mail size={18} className="shrink-0" />}
                <div className="flex-1 min-w-0 text-sm font-medium">
                  {error && <span>{error}</span>}
                  {message && message.email_verified === false && (
                      <span>Check your email for verification · We sent a link to verify your email.</span>
                  )}
                  {message && message.email_verified && (
                      <span>Account created successfully!</span>
                  )}
                </div>
              </div>
              <button
                  onClick={() => setShowNotification(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>
        )}

        <div className="flex-1 flex flex-row">
          <div className="m-auto w-full max-w-lg px-6 py-8 sm:py-0">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Create an account</h1>
              <p className="text-gray-500 mt-1">Please fill in your details below</p>
            </div>

            {/* Signup Form Card Container */}
            <div>
              <FormLayout onSubmit={formik.handleSubmit} className="space-y-5">

                {/* Email Field */}
                <FormField name="email" className="space-y-0.5">
                  <div className="text-xs text-black/60 font-normal transition-colors">
                    <FormLabelAndMessage
                        label="Enter your email"
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
                        required
                    />
                  </Form.Control>
                </FormField>

                {/* Row Split for First & Last Name */}
                <div className="flex flex-row space-x-4 items-start">
                  <FormField name="first_name" className="space-y-0.5 flex-1">
                    <div className="text-xs text-black/60 font-normal transition-colors">
                      <FormLabelAndMessage
                          label="First name"
                          message={formik.touched.first_name ? formik.errors.first_name : undefined}
                      />
                    </div>
                    <Form.Control asChild>
                      <Input
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          value={formik.values.first_name}
                          type="text"
                          placeholder="Enter your first name"
                          className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                      />
                    </Form.Control>
                  </FormField>

                  <FormField name="last_name" className="space-y-0.5 flex-1">
                    <div className="text-xs text-black/60 font-normal transition-colors">
                      <FormLabelAndMessage
                          label="Last name"
                          message={formik.touched.last_name ? formik.errors.last_name : undefined}
                      />
                    </div>
                    <Form.Control asChild>
                      <Input
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          value={formik.values.last_name}
                          type="text"
                          placeholder="Enter your last name"
                          className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                      />
                    </Form.Control>
                  </FormField>
                </div>

                {/* Password Field */}
                <FormField name="password" className="space-y-0.5">
                  <div className="text-xs text-black/60 font-normal transition-colors">
                    <FormLabelAndMessage
                        label="Enter your password"
                        message={formik.touched.password ? formik.errors.password : undefined}
                    />
                  </div>
                  <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.password}
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter your password"
                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                        required
                    />
                  </Form.Control>
                  <div className="pt-1">
                    <PasswordStrengthIndicator password={formik.values.password} />
                  </div>
                </FormField>

                {/* Username Field */}
                <FormField name="username" className="space-y-0.5">
                  <div className="text-xs text-black/60 font-normal transition-colors">
                    <FormLabelAndMessage
                        label="Choose your username"
                        message={formik.touched.username ? formik.errors.username : undefined}
                    />
                  </div>
                  <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.username}
                        type="text"
                        placeholder="Enter your username"
                        className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                        required
                    />
                  </Form.Control>
                </FormField>

                <div className="pt-3">
                  <Form.Submit asChild>
                    <button className="w-full bg-black text-white font-semibold text-center py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                      {isSubmitting ? 'Loading...' : 'Create account'}
                    </button>
                  </Form.Submit>
                </div>
              </FormLayout>

              {/* Divider */}
              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400">or</span>
                </div>
              </div>

              {/* Google Sign In */}
              <div className="space-y-3">
                <button
                    onClick={handleGoogleSignIn}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="" className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            </div>

            {/* Login Link */}
            <p className="text-center text-sm text-black/35 mt-7">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-gray-900 hover:underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </>
  )
}

export default OpenSignUpComponent