import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: number; tone: ToastTone; message: string }

const Ctx = createContext<((message: string, tone?: ToastTone) => void) | null>(null)

const icons = {
  success: <CheckCircle2 className="size-4.5 text-success" />,
  error: <XCircle className="size-4.5 text-danger" />,
  info: <Info className="size-4.5 text-accent" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-3), { id, tone, message }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="glass pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-strong px-4 py-3 text-sm text-fg shadow-2xl"
            >
              {icons[t.tone]}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
