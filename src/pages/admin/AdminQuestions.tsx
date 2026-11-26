import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CircleAlert, Download, FileQuestion, FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { adminApi, errorMessage } from '@/services'
import { useAsync, useTitle } from '@/hooks/misc'
import { useConfig } from '@/hooks/useConfig'
import { downloadFile, parseCsv, toCsv } from '@/lib/csv'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Field, Input, Switch, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { AdminQuestion, QuestionDraft } from '@/types'

const LETTERS = ['A', 'B', 'C', 'D']
const emptyDraft = (marks = 1): QuestionDraft => ({
  prompt: '', marks, isActive: true, options: LETTERS.map((_, i) => ({ text: '', isCorrect: i === 0 })),
})

export default function AdminQuestions() {
  useTitle('Questions')
  const toast = useToast()
  const { reload: reloadPublic } = useConfig()
  const list = useAsync(() => adminApi.listQuestions())
  const quiz = useAsync(() => adminApi.getQuiz())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [editing, setEditing] = useState<QuestionDraft | null>(null)
  const [deleting, setDeleting] = useState<AdminQuestion | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const questions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list.data ?? []).filter(
      (x) =>
        (filter === 'all' || (filter === 'active' ? x.isActive : !x.isActive)) &&
        (!q || x.prompt.toLowerCase().includes(q) || x.options.some((o) => o.text.toLowerCase().includes(q))),
    )
  }, [list.data, query, filter])

  const activeCount = (list.data ?? []).filter((q) => q.isActive).length
  const perAttempt = quiz.data?.questionCount ?? 0

  async function toggleActive(q: AdminQuestion) {
    list.setData((xs) => xs?.map((x) => (x.id === q.id ? { ...x, isActive: !q.isActive } : x)) ?? null)
    try {
      await adminApi.setQuestionActive(q.id, !q.isActive)
      void reloadPublic()
    } catch (e) {
      toast(errorMessage(e), 'error')
      void list.reload(true)
    }
  }

  function exportCsv() {
    const rows = (list.data ?? []).map((q) => [
      q.prompt, ...q.options.map((o) => o.text), LETTERS[q.options.findIndex((o) => o.isCorrect)] ?? '', q.marks, q.isActive ? 'yes' : 'no',
    ])
    downloadFile('brain-battle-questions.csv', toCsv(['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'marks', 'active'], rows))
  }

  return (
    <>
      <PageHeader
        title="Questions"
        description="Create and manage the question bank. Each attempt draws a random set from active questions."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<FileUp className="size-4" />} onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!list.data?.length}>Export</Button>
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing(emptyDraft(quiz.data?.marksPerQuestion ?? 1))}>New question</Button>
          </>
        }
      />

      {list.data && quiz.data && activeCount < perAttempt && (
        <Alert tone="warning" className="mb-5" title={`Only ${activeCount} active question${activeCount === 1 ? '' : 's'}`}>
          The quiz is set to {perAttempt} questions per attempt. Participants will get {activeCount} until you add or activate more.
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1"><Input icon={<Search />} placeholder="Search questions or options…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11" /></div>
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition', filter === f ? 'bg-surface-3 text-fg' : 'text-faint hover:text-muted')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-faint">{activeCount} active · {list.data?.length ?? 0} total · {perAttempt} per attempt</p>

      {list.loading && !list.data ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : list.error ? (
        <Card><ErrorState message={list.error} onRetry={() => list.reload()} /></Card>
      ) : questions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileQuestion />}
            title={list.data?.length ? 'No matching questions' : 'No questions yet'}
            description={list.data?.length ? 'Try a different search or filter.' : 'Add your first question or import a CSV to build the bank.'}
            action={!list.data?.length && <Button icon={<Plus className="size-4" />} onClick={() => setEditing(emptyDraft())}>Add question</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
              <Card className={cn('p-5', !q.isActive && 'opacity-60')}>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 font-mono text-xs text-faint">#{(list.data?.indexOf(q) ?? i) + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-fg">{q.prompt}</p>
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((o, oi) => (
                        <div key={o.id ?? oi} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm', o.isCorrect ? 'border-success/40 bg-success/8 text-fg' : 'border-line text-muted')}>
                          <span className={cn('grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold', o.isCorrect ? 'bg-success text-white' : 'bg-surface-3 text-faint')}>
                            {o.isCorrect ? <Check className="size-3" strokeWidth={3} /> : LETTERS[oi]}
                          </span>
                          <span className="truncate">{o.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge>{q.marks} mark{q.marks === 1 ? '' : 's'}</Badge>
                      {!q.isActive && <Badge tone="warning">Inactive</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <Switch checked={q.isActive} onChange={() => void toggleActive(q)} />
                    <div className="flex">
                      <button aria-label="Edit question" onClick={() => setEditing({ id: q.id, prompt: q.prompt, marks: q.marks, isActive: q.isActive, options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) })} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg">
                        <Pencil className="size-4" />
                      </button>
                      <button aria-label="Delete question" onClick={() => setDeleting(q)} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <QuestionEditor draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void list.reload(true); void reloadPublic() }} />

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this question?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={async () => {
              const q = deleting!
              setDeleting(null)
              try {
                const r = await adminApi.deleteQuestion(q.id)
                toast(r === 'archived' ? 'Question archived (it was already used in attempts)' : 'Question deleted')
                void list.reload(true); void reloadPublic()
              } catch (e) { toast(errorMessage(e), 'error') }
            }}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted">“{deleting?.prompt}”</p>
        <p className="mt-3 text-xs text-faint">If participants have already seen this question it will be archived instead, so their scores stay intact.</p>
      </Dialog>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} defaultMarks={quiz.data?.marksPerQuestion ?? 1} onDone={() => { void list.reload(true); void reloadPublic() }} />
    </>
  )
}

function QuestionEditor({ draft, onClose, onSaved }: { draft: QuestionDraft | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState<QuestionDraft | null>(draft)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lastDraft = useRef<QuestionDraft | null>(null)
  if (draft !== lastDraft.current) {
    lastDraft.current = draft
    setD(draft)
    setError(null)
  }
  if (!d) return <Dialog open={false} onClose={onClose} />

  const setOpt = (i: number, patch: Partial<{ text: string; isCorrect: boolean }>) =>
    setD({ ...d, options: d.options.map((o, j) => (patch.isCorrect ? { ...o, isCorrect: j === i, ...(j === i ? patch : {}) } : j === i ? { ...o, ...patch } : o)) })

  async function save() {
    if (!d) return
    if (d.prompt.trim().length < 3) return setError('Write the question (at least 3 characters).')
    if (d.options.some((o) => !o.text.trim())) return setError('All four options need text.')
    const texts = d.options.map((o) => o.text.trim().toLowerCase())
    if (new Set(texts).size !== texts.length) return setError('Options must be different from each other.')
    if (!(d.marks > 0)) return setError('Marks must be greater than zero.')
    setSaving(true)
    setError(null)
    try {
      await adminApi.saveQuestion(d)
      toast(d.id ? 'Question updated' : 'Question added')
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={!!draft}
      onClose={onClose}
      locked={saving}
      size="lg"
      title={d.id ? 'Edit question' : 'New question'}
      description="Select the radio button next to the correct answer."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} icon={<Check className="size-4" />}>{d.id ? 'Save changes' : 'Add question'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Question" htmlFor="q-prompt">
          <Textarea id="q-prompt" data-autofocus value={d.prompt} onChange={(e) => setD({ ...d, prompt: e.target.value })} maxLength={1000} placeholder="e.g. Which data structure works on FIFO?" />
        </Field>
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-fg">Options</p>
          {d.options.map((o, i) => (
            <div key={i} className={cn('flex items-center gap-3 rounded-xl border p-2 pl-3 transition', o.isCorrect ? 'border-success/50 bg-success/6' : 'border-line')}>
              <button
                type="button"
                role="radio"
                aria-checked={o.isCorrect}
                aria-label={`Mark option ${LETTERS[i]} as correct`}
                onClick={() => setOpt(i, { isCorrect: true })}
                className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 transition', o.isCorrect ? 'border-success bg-success text-white' : 'border-line-strong hover:border-success/60')}
              >
                {o.isCorrect && <Check className="size-3.5" strokeWidth={3} />}
              </button>
              <span className="font-mono text-xs font-semibold text-faint">{LETTERS[i]}</span>
              <input
                value={o.text}
                onChange={(e) => setOpt(i, { text: e.target.value })}
                maxLength={300}
                placeholder={`Option ${LETTERS[i]}`}
                className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm text-fg outline-none placeholder:text-faint focus:bg-bg-soft"
              />
              {o.isCorrect && <Badge tone="success" className="hidden sm:inline-flex">Correct</Badge>}
            </div>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Marks" htmlFor="q-marks">
            <Input id="q-marks" type="number" min={0.25} step={0.25} value={d.marks} onChange={(e) => setD({ ...d, marks: Number(e.target.value) })} />
          </Field>
          <div className="pt-7"><Switch label="Active" description="Include in new attempts" checked={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} /></div>
        </div>
      </div>
    </Dialog>
  )
}

function ImportDialog({ open, onClose, defaultMarks, onDone }: { open: boolean; onClose: () => void; defaultMarks: number; onDone: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<QuestionDraft[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  function reset() { setRows([]); setIssues([]); setProgress(0) }

  async function onFile(file: File) {
    reset()
    const data = parseCsv(await file.text())
    if (!data.length) return setIssues(['The file is empty.'])
    const header = data[0].map((h) => h.trim().toLowerCase())
    const hasHeader = header.includes('question')
    const body = hasHeader ? data.slice(1) : data
    const idx = (name: string, fallback: number) => (hasHeader ? header.indexOf(name) : fallback)
    const col = { q: idx('question', 0), a: idx('option_a', 1), b: idx('option_b', 2), c: idx('option_c', 3), d: idx('option_d', 4), correct: idx('correct', 5), marks: idx('marks', 6) }
    const out: QuestionDraft[] = []
    const errs: string[] = []
    body.forEach((r, n) => {
      const line = n + (hasHeader ? 2 : 1)
      const opts = [r[col.a], r[col.b], r[col.c], r[col.d]].map((x) => (x ?? '').trim())
      const prompt = (r[col.q] ?? '').trim()
      const c = (r[col.correct] ?? '').trim().toUpperCase()
      const ci = LETTERS.indexOf(c) !== -1 ? LETTERS.indexOf(c) : ['1', '2', '3', '4'].indexOf(c)
      const marks = col.marks >= 0 && r[col.marks]?.trim() ? Number(r[col.marks]) : defaultMarks
      if (prompt.length < 3) return errs.push(`Row ${line}: missing question text`)
      if (opts.some((o) => !o)) return errs.push(`Row ${line}: all four options are required`)
      if (ci < 0) return errs.push(`Row ${line}: "correct" must be A, B, C or D`)
      if (!(marks > 0)) return errs.push(`Row ${line}: invalid marks`)
      out.push({ prompt, marks, isActive: true, options: opts.map((text, i) => ({ text, isCorrect: i === ci })) })
    })
    setRows(out)
    setIssues(errs)
  }

  async function run() {
    setBusy(true)
    let ok = 0
    for (const r of rows) {
      try { await adminApi.saveQuestion(r); ok++ } catch { /* counted below */ }
      setProgress(ok)
    }
    setBusy(false)
    toast(`Imported ${ok} of ${rows.length} questions`, ok === rows.length ? 'success' : 'error')
    onDone()
    reset()
    onClose()
  }

  function template() {
    downloadFile('brain-battle-questions-template.csv', toCsv(
      ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'marks'],
      [['What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Core Program Utility', 'Central Power Unit', 'A', 1]],
    ))
  }

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      locked={busy}
      size="lg"
      title="Import questions from CSV"
      description="Columns: question, option_a, option_b, option_c, option_d, correct (A–D), marks (optional)."
      footer={
        <>
          <Button variant="ghost" onClick={template} icon={<Download className="size-4" />}>Template</Button>
          <Button onClick={run} disabled={!rows.length} loading={busy}>{busy ? `Importing ${progress}/${rows.length}` : `Import ${rows.length || ''} question${rows.length === 1 ? '' : 's'}`}</Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong px-6 py-10 text-center transition hover:border-accent/60 hover:bg-accent/5">
        <FileUp className="size-7 text-accent" />
        <span className="mt-3 text-sm font-medium text-fg">Choose a .csv file</span>
        <span className="mt-1 text-xs text-faint">UTF-8 with a header row (Excel: “CSV UTF-8”)</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
      </label>
      {rows.length > 0 && <Alert tone="success" className="mt-4">{rows.length} valid question{rows.length === 1 ? '' : 's'} ready to import.</Alert>}
      {issues.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/8 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning"><CircleAlert className="size-4" /> {issues.length} row(s) skipped</p>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted">{issues.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </Dialog>
  )
}
