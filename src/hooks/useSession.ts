import { useCallback, useSyncExternalStore } from 'react'
import { KEYS, storage } from '@/lib/storage'
import type { ParticipantSession } from '@/types'

const listeners = new Set<() => void>()
let cached: ParticipantSession | null | undefined

function read(): ParticipantSession | null {
  if (cached === undefined) cached = storage.get<ParticipantSession | null>(KEYS.session, null)
  return cached
}

function emit() {
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key === KEYS.session) {
    cached = undefined
    emit()
  }
})

/** Participant session stored on this device (token returned at registration). */
export function useSession() {
  const session = useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, read)
  const setSession = useCallback((s: ParticipantSession | null) => {
    if (s) storage.set(KEYS.session, s)
    else storage.remove(KEYS.session)
    cached = s
    emit()
  }, [])
  return { session, setSession }
}
