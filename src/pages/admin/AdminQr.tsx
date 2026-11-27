import { useState } from 'react'
import QR from 'qrcode'
import { Copy, Download, Monitor } from 'lucide-react'
import { useTitle } from '@/hooks/misc'
import { downloadFile } from '@/lib/csv'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { QrCode, publicSiteUrl } from '@/components/QrCode'

export default function AdminQr() {
  useTitle('QR code')
  const toast = useToast()
  const [url, setUrl] = useState(publicSiteUrl())
  const valid = /^https?:\/\/\S+$/.test(url)

  async function png() {
    const data = await QR.toDataURL(url, { width: 2048, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0a0f1f', light: '#ffffff' } })
    const blob = await (await fetch(data)).blob()
    downloadFile('brain-battle-qr.png', blob)
  }
  async function svg() {
    const s = await QR.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0a0f1f', light: '#ffffff' } })
    downloadFile('brain-battle-qr.svg', new Blob([s], { type: 'image/svg+xml' }))
  }

  const displayUrl = `${url.replace(/\/$/, '')}/leaderboard?rotate=1`

  return (
    <>
      <PageHeader title="QR code" description="Print this at the booth. It opens the landing page on participants’ phones." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Card className="flex flex-col items-center p-5 sm:p-8">
          {valid ? <QrCode value={url} size={260} /> : <div className="grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-faint">Enter a valid URL</div>}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button size="sm" icon={<Download className="size-4" />} onClick={png} disabled={!valid}>PNG (print)</Button>
            <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={svg} disabled={!valid}>SVG</Button>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <Field label="Public URL" htmlFor="qr-url" hint="Use your production domain (set VITE_SITE_URL to make it the default).">
              <Input id="qr-url" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
            </Field>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <li>• Print at least 12 × 12 cm for scanning from ~1 m away.</li>
              <li>• Test with both Android and iPhone cameras before the event.</li>
              <li>• The PNG uses high error-correction, so a small logo sticker in the centre is fine.</li>
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold text-fg"><Monitor className="size-4.5 text-accent" /> Booth display link</h2>
            <p className="mt-1 text-sm text-muted">Open on the big screen and press the full-screen button. <code className="font-mono text-fg">rotate=1</code> alternates Today ↔ Overall every 20 s.</p>
            <div className="mt-4 flex gap-2">
              <Input readOnly value={displayUrl} className="h-11 font-mono text-xs" />
              <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => { void navigator.clipboard?.writeText(displayUrl); toast('Link copied') }}>Copy</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
