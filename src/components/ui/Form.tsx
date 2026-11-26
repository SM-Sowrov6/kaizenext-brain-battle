import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-xl border bg-bg-soft/80 px-4 text-[0.9375rem] text-fg placeholder:text-faint ' +
  'transition-[border-color,box-shadow,background-color] duration-200 outline-none ' +
  'hover:border-line-strong focus:border-accent focus:bg-bg-soft focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--t-accent)_16%,transparent)] ' +
  'disabled:opacity-60'

export function Field({
  label, hint, error, optional, children, htmlFor, className,
}: {
  label: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode; htmlFor?: string; className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-sm font-medium text-fg">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-faint">Optional</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-[0.8125rem] text-danger">
          <AlertCircle className="size-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, icon, ...rest }, ref) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint [&>svg]:size-4.5">{icon}</span>}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'h-12', icon && 'pl-11', invalid ? 'border-danger/70' : 'border-line', className)}
        {...rest}
      />
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'min-h-24 py-3 leading-relaxed resize-y', invalid ? 'border-danger/70' : 'border-line', className)}
        {...rest}
      />
    )
  },
)

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        control,
        'h-11 appearance-none border-line bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%23888%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27m4%206%204%204%204-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Switch({
  checked, onChange, label, description, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          {label && <span className="block text-sm font-medium text-fg">{label}</span>}
          {description && <span className="mt-0.5 block text-[0.8125rem] text-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6.5 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-transparent bg-gradient-accent' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export function Checkbox({
  checked, onChange, children, invalid,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; invalid?: boolean }) {
  return (
    <label className="group flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-all duration-150',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
          checked ? 'border-transparent bg-gradient-accent text-on-accent' : invalid ? 'border-danger/70' : 'border-line-strong group-hover:border-accent/60',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="text-[0.8125rem] leading-relaxed text-muted">{children}</span>
    </label>
  )
}
