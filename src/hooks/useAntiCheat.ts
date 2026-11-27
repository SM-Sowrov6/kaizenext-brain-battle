import { useEffect, useRef } from 'react'
import type { ViolationKind } from '@/types'

/**
 * Quiz-screen proctoring.
 *
 * Detects: leaving the page (tab/app switch, phone home button, screen lock,
 * refresh/close), the window losing focus for >1 s (another window, split
 * screen, address bar), copy/cut/paste, devtools shortcuts and PrintScreen.
 * Silently blocks: right-click / long-press menu, text selection, dragging.
 *
 * One "away episode" = one event id, however many browser signals it fires
 * (blur → hidden → pagehide), so the server counts it once. While the page is
 * hidden/closing we can only `beacon` (sendBeacon); when it is visible we
 * `report` (fetch) and get the authoritative strike count back.
 *
 * Limits (be honest with stakeholders): a second device can't be detected,
 * and anyone who edits the page's JavaScript can bypass browser-side checks.
 */
export function useAntiCheat({
  enabled,
  report,
  beacon,
}: {
  enabled: boolean
  report: (kind: ViolationKind, eventId: string) => void
  beacon: (kind: ViolationKind, eventId: string) => void
}) {
  const reportRef = useRef(report)
  const beaconRef = useRef(beacon)
  reportRef.current = report
  beaconRef.current = beacon

  useEffect(() => {
    if (!enabled) return
    let episode: { id: string; kind: ViolationKind } | null = null
    let blurTimer: ReturnType<typeof setTimeout> | null = null
    const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const instant = (kind: ViolationKind) => reportRef.current(kind, newId())

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (blurTimer) clearTimeout(blurTimer)
        episode ??= { id: newId(), kind: 'tab_hidden' }
        beaconRef.current(episode.kind, episode.id)
      } else if (episode) {
        // back on the page: sync the authoritative state (idempotent with the beacon)
        const e = episode
        episode = null
        reportRef.current(e.kind, e.id)
      }
    }

    const onBlur = () => {
      if (document.visibilityState === 'hidden') return // handled by visibilitychange
      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        if (document.hasFocus() || document.visibilityState === 'hidden' || episode) return
        episode = { id: newId(), kind: 'window_blur' }
        reportRef.current(episode.kind, episode.id)
      }, 1000)
    }

    const onFocus = () => {
      if (blurTimer) clearTimeout(blurTimer)
      if (episode?.kind === 'window_blur') episode = null // already reported while visible
    }

    const onPageHide = () => {
      const e = episode ?? { id: newId(), kind: 'page_leave' as ViolationKind }
      beaconRef.current(e.kind, e.id)
    }

    const onClipboard = (e: ClipboardEvent) => {
      e.preventDefault()
      instant(e.type as ViolationKind) // 'copy' | 'cut' | 'paste'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && (k === 'c' || k === 'x' || k === 'v')) {
        e.preventDefault()
        instant(k === 'c' ? 'copy' : k === 'x' ? 'cut' : 'paste')
      } else if (e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(k))) {
        e.preventDefault()
        instant('devtools')
      } else if (mod && ['a', 'p', 's', 'u', 'f'].includes(k)) {
        e.preventDefault() // select-all, print, save, view-source, find: just blocked
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') instant('print_screen')
    }

    const block = (e: Event) => e.preventDefault()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('copy', onClipboard)
    document.addEventListener('cut', onClipboard)
    document.addEventListener('paste', onClipboard)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('contextmenu', block)
    document.addEventListener('selectstart', block)
    document.addEventListener('dragstart', block)
    return () => {
      if (blurTimer) clearTimeout(blurTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('copy', onClipboard)
      document.removeEventListener('cut', onClipboard)
      document.removeEventListener('paste', onClipboard)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('selectstart', block)
      document.removeEventListener('dragstart', block)
    }
  }, [enabled])
}
