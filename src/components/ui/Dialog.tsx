import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Prevent closing via backdrop / Escape (e.g. while submitting). */
  locked?: boolean
  /** Render as a right-side drawer on desktop. */
  drawer?: boolean
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', locked, drawer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button')
      el?.focus()
    })
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 z-50 flex', drawer ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-6')}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            initial={drawer ? { x: '100%' } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={drawer ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={drawer ? { x: '100%' } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className={cn(
              'card-surface relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
              drawer ? 'h-dvh max-h-dvh max-w-xl rounded-none border-y-0 border-r-0 sm:rounded-l-3xl' : cn(widths[size], 'rounded-t-3xl sm:rounded-3xl'),
            )}
          >
            {(title || !locked) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
                <div className="min-w-0">
                  {title && <h2 className="font-headline text-xl text-fg">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {!locked && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
                  >
                    <X className="size-4.5" />
                  </button>
                )}
              </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-6', footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]')}>{children}</div>
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
