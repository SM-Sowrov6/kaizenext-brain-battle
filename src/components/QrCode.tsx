import { useEffect, useState } from 'react'
import QR from 'qrcode'
import { cn } from '@/lib/cn'

/** High-contrast QR (dark on white) for reliable scanning from any theme. */
export function QrCode({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0f1f', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [value, size])
  return (
    <div className={cn('rounded-2xl bg-white p-2.5 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.6)]', className)} style={{ width: size + 20, maxWidth: '100%' }}>
      {src ? <img src={src} width={size} height={size} alt={`QR code for ${value}`} className="block h-auto w-full" /> : <div className="skeleton !bg-none bg-gray-100" style={{ width: '100%', aspectRatio: '1' }} />}
    </div>
  )
}

export function publicSiteUrl() {
  return (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || window.location.origin
}
