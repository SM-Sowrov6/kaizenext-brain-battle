import { useEffect, useState, type ReactNode } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { adminApi, errorMessage } from '@/services'
import { useTitle } from '@/hooks/misc'
import { useConfig } from '@/hooks/useConfig'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Switch, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { EventSettings, QuizSettings } from '@/types'

export default function AdminSettings() {
  useTitle('Settings')
  const toast = useToast()
  const { reload: reloadPublic } = useConfig()
  const [ev, setEv] = useState<EventSettings | null>(null)
  const [quiz, setQuiz] = useState<QuizSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [e, q] = await Promise.all([adminApi.getSettings(), adminApi.getQuiz()])
      setEv(e); setQuiz(q); setDirty(false)
    } catch (err) { setError(errorMessage(err)) }
  }
  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (error) return <Card><ErrorState message={error} onRetry={load} /></Card>
  if (!ev || !quiz) return <PageLoader />

  const e = (p: Partial<EventSettings>) => { setEv({ ...ev, ...p }); setDirty(true) }
  const qz = (p: Partial<QuizSettings>) => { setQuiz({ ...quiz, ...p }); setDirty(true) }

  async function save() {
    if (!ev || !quiz) return
    setFormError(null)
    if (!ev.eventName.trim()) return setFormError('Event name is required.')
    if (!ev.campaignStart || !ev.campaignEnd) return setFormError('Campaign start and end are required.')
    if (Date.parse(ev.campaignEnd) <= Date.parse(ev.campaignStart)) return setFormError('Campaign end must be after the start.')
    if (!(quiz.durationSeconds >= 30 && quiz.durationSeconds <= 7200)) return setFormError('Duration must be between 0.5 and 120 minutes.')
    if (!(Number.isInteger(quiz.questionCount) && quiz.questionCount >= 1 && quiz.questionCount <= 200)) return setFormError('Question count must be a whole number between 1 and 200.')
    if (!(quiz.marksPerQuestion > 0)) return setFormError('Marks per question must be greater than zero.')
    if (quiz.negativeMarking && !(quiz.negativeMark > 0)) return setFormError('Set a negative mark greater than zero, or turn negative marking off.')
    setSaving(true)
    try {
      const { id: _id, ...quizPatch } = quiz
      const [e2, q2] = await Promise.all([
        adminApi.updateSettings({ ...ev, rules: ev.rules.map((r) => r.trim()).filter(Boolean), prizes: ev.prizes.filter((p) => p.title.trim()) }),
        adminApi.updateQuiz(quizPatch),
      ])
      setEv(e2); setQuiz(q2); setDirty(false)
      toast('Settings saved')
      void reloadPublic()
    } catch (err) { setFormError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <>
      <PageHeader title="Settings" description="Configure the event, quiz rules and public content."
        actions={<Button onClick={save} loading={saving} disabled={!dirty} icon={<Save className="size-4" />}>Save changes</Button>} />
      {formError && <Alert tone="danger" className="mb-5">{formError}</Alert>}

      <div className="space-y-6">
        <Section title="Status" desc="Instant switches for event-day operation.">
          <div className="grid gap-6 md:grid-cols-2">
            <Switch label="Quiz live" description="Allow participants to start new attempts." checked={ev.quizEnabled} onChange={(v) => e({ quizEnabled: v })} />
            <Switch label="Registration open" description="Allow new sign-ups." checked={ev.registrationEnabled} onChange={(v) => e({ registrationEnabled: v })} />
          </div>
        </Section>

        <Section title="Event" desc="Name, venue and the campaign window. The quiz opens and closes automatically.">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Event name" htmlFor="s-name"><Input id="s-name" value={ev.eventName} onChange={(x) => e({ eventName: x.target.value })} /></Field>
            <Field label="Venue" htmlFor="s-venue"><Input id="s-venue" value={ev.venue} onChange={(x) => e({ venue: x.target.value })} /></Field>
            <Field label="Campaign starts" htmlFor="s-cs" hint="Your device's local time (Dhaka).">
              <Input id="s-cs" type="datetime-local" value={toLocalInput(ev.campaignStart)} onChange={(x) => x.target.value && e({ campaignStart: new Date(x.target.value).toISOString() })} />
            </Field>
            <Field label="Campaign ends" htmlFor="s-ce" hint="The quiz closes automatically at this time.">
              <Input id="s-ce" type="datetime-local" value={toLocalInput(ev.campaignEnd)} onChange={(x) => x.target.value && e({ campaignEnd: new Date(x.target.value).toISOString() })} />
            </Field>
            <Field label="Results date" htmlFor="s-rd"><Input id="s-rd" type="date" value={ev.resultsDate} onChange={(x) => e({ resultsDate: x.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Quiz rules" desc="Applies to attempts started after saving.">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Quiz title" htmlFor="s-title"><Input id="s-title" value={quiz.title} onChange={(x) => qz({ title: x.target.value })} /></Field>
            <Field label="Duration (minutes)" htmlFor="s-dur"><Input id="s-dur" type="number" min={0.5} max={120} step={0.5} value={quiz.durationSeconds / 60} onChange={(x) => qz({ durationSeconds: Math.round(Number(x.target.value) * 60) })} /></Field>
            <Field label="Questions per attempt" htmlFor="s-count"><Input id="s-count" type="number" min={1} max={200} value={quiz.questionCount} onChange={(x) => qz({ questionCount: Number(x.target.value) })} /></Field>
            <Field label="Default marks per question" htmlFor="s-marks" hint="Used for new questions and the public summary."><Input id="s-marks" type="number" min={0.25} step={0.25} value={quiz.marksPerQuestion} onChange={(x) => qz({ marksPerQuestion: Number(x.target.value) })} /></Field>
            <Field label="Negative mark per wrong answer" htmlFor="s-neg"><Input id="s-neg" type="number" min={0} step={0.25} value={quiz.negativeMark} disabled={!quiz.negativeMarking} onChange={(x) => qz({ negativeMark: Number(x.target.value) })} /></Field>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <Switch label="Negative marking" description="Deduct marks for wrong answers." checked={quiz.negativeMarking} onChange={(v) => qz({ negativeMarking: v })} />
            <Switch label="Shuffle questions" description="Random set & order per participant." checked={quiz.shuffleQuestions} onChange={(v) => qz({ shuffleQuestions: v })} />
            <Switch label="Shuffle options" description="Randomise A–D order." checked={quiz.shuffleOptions} onChange={(v) => qz({ shuffleOptions: v })} />
          </div>
          <div className="mt-6 rounded-2xl border border-line p-4">
            <p className="text-sm font-medium text-fg">Anti-cheat</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted">
              Leaving the quiz screen (app/tab switch, refresh) or copy/paste is a violation. Choose when the quiz ends and the player is disqualified.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[{ v: 1, label: 'Out on 1st', sub: 'No warning' }, { v: 2, label: 'Out on 2nd', sub: '1 warning' }, { v: 3, label: 'Out on 3rd', sub: '2 warnings' }].map((o) => (
                <button key={o.v} type="button" onClick={() => qz({ maxViolations: o.v })}
                  className={cn('rounded-xl border px-4 py-2.5 text-left transition', quiz.maxViolations === o.v ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong')}>
                  <span className="block text-sm font-semibold text-fg">{o.label}</span>
                  <span className="text-xs text-muted">{o.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Competition information" desc="Shown on the landing and instructions pages.">
          <Field label="Description" htmlFor="s-info"><Textarea id="s-info" rows={3} value={ev.competitionInfo} onChange={(x) => e({ competitionInfo: x.target.value })} /></Field>
          <div className="mt-5">
            <p className="text-sm font-medium text-fg">Rules</p>
            <div className="mt-2 space-y-2">
              {ev.rules.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={r} onChange={(x) => e({ rules: ev.rules.map((y, j) => (j === i ? x.target.value : y)) })} className="h-11" />
                  <IconBtn label="Remove rule" onClick={() => e({ rules: ev.rules.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => e({ rules: [...ev.rules, ''] })}>Add rule</Button>
            </div>
          </div>
        </Section>

        <Section title="Prizes" desc="Shown in the prize section of the landing page.">
          <div className="space-y-3">
            {ev.prizes.map((p, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-line p-3 md:grid-cols-[140px_1fr_1.6fr_auto]">
                <Input placeholder="Place" value={p.place} onChange={(x) => e({ prizes: ev.prizes.map((y, j) => (j === i ? { ...y, place: x.target.value } : y)) })} className="h-11" />
                <Input placeholder="Prize title" value={p.title} onChange={(x) => e({ prizes: ev.prizes.map((y, j) => (j === i ? { ...y, title: x.target.value } : y)) })} className="h-11" />
                <Input placeholder="Description" value={p.description} onChange={(x) => e({ prizes: ev.prizes.map((y, j) => (j === i ? { ...y, description: x.target.value } : y)) })} className="h-11" />
                <IconBtn label="Remove prize" onClick={() => e({ prizes: ev.prizes.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => e({ prizes: [...ev.prizes, { place: '', title: '', description: '' }] })}>Add prize</Button>
          </div>
        </Section>

      </div>

      {dirty && (
        <div className="glass sticky bottom-4 z-20 mt-8 flex items-center justify-between gap-3 rounded-2xl border border-line-strong px-5 py-3 shadow-2xl">
          <p className="text-sm text-muted">You have unsaved changes.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={load}>Discard</Button>
            <Button size="sm" onClick={save} loading={saving} icon={<Save className="size-4" />}>Save</Button>
          </div>
        </div>
      )}
    </>
  )
}

/** ISO timestamp → value for <input type="datetime-local"> in the device's time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-fg">{title}</h2>
      <p className="mt-0.5 mb-5 text-sm text-muted">{desc}</p>
      {children}
    </Card>
  )
}

function IconBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} onClick={onClick} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-danger/40 hover:text-danger">
      <Trash2 className="size-4" />
    </button>
  )
}
