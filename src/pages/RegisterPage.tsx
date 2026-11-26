import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, GraduationCap, LockKeyhole, Mail, Phone, User, UserCheck } from 'lucide-react'
import { api, toAppError } from '@/services'
import { useConfig } from '@/hooks/useConfig'
import { useSession } from '@/hooks/useSession'
import { useTitle } from '@/hooks/misc'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Checkbox, Field, Input } from '@/components/ui/Form'
import { FlowSteps } from '@/components/quiz/FlowSteps'
import type { RegistrationInput } from '@/types'

const DEPARTMENTS = [
  'Computer Science & Engineering (CSE)', 'Software Engineering (SWE)', 'Electrical & Electronic Engineering (EEE)',
  'Information Technology & Engineering (ITE)', 'Multimedia & Creative Technology (MCT)', 'Business Administration (BBA)',
  'Textile Engineering', 'Civil Engineering', 'Architecture', 'English', 'Law', 'Pharmacy', 'Journalism & Mass Communication',
]

type Errors = Partial<Record<keyof RegistrationInput, string>>

function validate(v: RegistrationInput): Errors {
  const e: Errors = {}
  if (v.fullName.trim().length < 2) e.fullName = 'Please enter your full name.'
  else if (v.fullName.trim().length > 80) e.fullName = 'Name is too long.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Please enter a valid email address.'
  if (v.university.trim().length < 2) e.university = 'Please enter your university.'
  if (v.department.trim().length < 2) e.department = 'Please enter your department.'
  if (v.phone?.trim()) {
    const digits = v.phone.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) e.phone = 'Please enter a valid phone number.'
  }
  if (!v.consent) e.consent = 'Please accept the data notice to continue.'
  return e
}

export default function RegisterPage() {
  useTitle('Register')
  const navigate = useNavigate()
  const { config, loading: configLoading } = useConfig()
  const { session, setSession } = useSession()
  const [values, setValues] = useState<RegistrationInput>({
    fullName: '', email: '', university: 'Daffodil International University', department: '', phone: '', consent: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof RegistrationInput>(k: K, v: RegistrationInput[K]) => {
    const next = { ...values, [k]: v }
    setValues(next)
    if (touched) setErrors(validate(next))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setFormError(null)
    const errs = validate(values)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    setSubmitting(true)
    try {
      const s = await api.register({ ...values, phone: values.phone?.trim() || undefined })
      setSession(s)
      navigate('/instructions')
    } catch (err) {
      const ae = toAppError(err)
      if (ae.fields) setErrors(ae.fields as Errors)
      setFormError(ae.isNetwork ? 'Connection problem — please check your internet and try again.' : ae.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (configLoading && !config) return <PageLoader />

  if (session) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/12 text-success">
            <UserCheck className="size-6" />
          </div>
          <h1 className="font-headline mt-5 text-2xl">You're registered, {session.fullName.split(' ')[0]}!</h1>
          <p className="mt-2 text-sm text-muted">This device is already signed in to Brain Battle. Pick up where you left off.</p>
          <LinkButton to="/instructions" size="lg" block className="mt-7" iconRight={<ArrowRight className="size-4.5" />}>
            Continue
          </LinkButton>
          <button
            onClick={() => setSession(null)}
            className="mt-4 text-xs text-faint underline-offset-4 transition hover:text-muted hover:underline"
          >
            Not {session.fullName.split(' ')[0]}? Use a different registration
          </button>
        </Card>
      </Shell>
    )
  }

  if (config && !config.event.registrationEnabled) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon={<LockKeyhole />}
            title="Registration is closed"
            description="Registration isn't open right now. Please check with the Kaizenext booth team, or follow the live leaderboard."
            action={<LinkButton to="/leaderboard" variant="secondary">View leaderboard</LinkButton>}
          />
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-7 text-center">
        <h1 className="font-headline text-3xl text-fg sm:text-4xl">Join the battle</h1>
        <p className="mt-2 text-sm text-muted">Takes about 30 seconds. No password needed.</p>
      </div>
      <Card className="p-5 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Full name" htmlFor="f-fullName" error={errors.fullName}>
            <Input id="f-fullName" icon={<User />} autoComplete="name" placeholder="e.g. Nusrat Jahan" value={values.fullName}
              onChange={(e) => set('fullName', e.target.value)} invalid={!!errors.fullName} maxLength={80} />
          </Field>
          <Field label="Email address" htmlFor="f-email" error={errors.email} hint="Used to verify winners — never shown publicly.">
            <Input id="f-email" icon={<Mail />} type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
              placeholder="you@example.com" value={values.email} onChange={(e) => set('email', e.target.value)} invalid={!!errors.email} maxLength={254} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="University" htmlFor="f-university" error={errors.university}>
              <Input id="f-university" icon={<Building2 />} autoComplete="organization" value={values.university}
                onChange={(e) => set('university', e.target.value)} invalid={!!errors.university} maxLength={120} />
            </Field>
            <Field label="Department" htmlFor="f-department" error={errors.department}>
              <Input id="f-department" icon={<GraduationCap />} list="departments" placeholder="e.g. CSE" value={values.department}
                onChange={(e) => set('department', e.target.value)} invalid={!!errors.department} maxLength={120} />
              <datalist id="departments">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
            </Field>
          </div>
          <Field label="Phone number" optional htmlFor="f-phone" error={errors.phone} hint="Only used to contact prize winners.">
            <Input id="f-phone" icon={<Phone />} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX"
              value={values.phone} onChange={(e) => set('phone', e.target.value)} invalid={!!errors.phone} maxLength={20} />
          </Field>

          <div className="rounded-xl border border-line bg-bg-soft/60 p-4">
            <Checkbox checked={values.consent} onChange={(v) => set('consent', v)} invalid={!!errors.consent}>
              I agree that Kaizenext may store the information above to run this competition, verify winners and contact me
              about the results. Only my name, university and score may appear on the public leaderboard. My email and phone
              number will never be displayed or sold.
            </Checkbox>
            {errors.consent && <p role="alert" className="mt-2 pl-8 text-[0.8125rem] text-danger">{errors.consent}</p>}
          </div>

          <Button type="submit" size="lg" block loading={submitting} iconRight={<ArrowRight className="size-4.5" />}>
            {submitting ? 'Registering…' : 'Register & continue'}
          </Button>
          <p className="text-center text-xs text-faint">One registration per person. Each email can play once.</p>
        </form>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16 sm:pt-10">
      <FlowSteps current={0} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mt-10">
        {children}
      </motion.div>
    </div>
  )
}
