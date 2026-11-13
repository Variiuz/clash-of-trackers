import { useRef, useState } from 'react'
import { parseExport } from '../lib/model'
import { importExport } from '../lib/store'
import demo from '../data/demo.json'
import { PACKED } from '../lib/game'

export function ImportPanel({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const submit = (t: string) => {
    try { importExport(parseExport(t)); setErr(''); setText(''); onDone?.() } catch (e) { setErr((e as Error).message) }
  }
  return (
    <div className="import">
      {!compact && (
        <ol className="howto">
          <li>In game: <b>Settings → More Settings → Data Export → Copy</b></li>
          <li>Paste below</li>
        </ol>
      )}
      <textarea value={text} onChange={(e) => { setText(e.target.value); setErr('') }} placeholder='{"tag":"#…","timestamp":…,"buildings":[…]}' spellCheck={false} aria-label="Exported village JSON" />
      {err && <p className="error" role="alert">{err}</p>}
      <div className="import-actions">
        <button className="btn primary" disabled={!text.trim()} onClick={() => submit(text)}>Import village</button>
        {!PACKED && <button className="btn" onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t.trim()) submit(t); else setErr('Clipboard is empty.') } catch { setErr('Clipboard blocked. Paste into the box.') } }}>Paste from clipboard</button>}
        <button className="btn" onClick={() => file.current?.click()}>Open .json file</button>
        <input ref={file} type="file" accept=".json,.txt,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) submit(await f.text()); e.target.value = '' }} />
        {!compact && <button className="btn ghost" onClick={() => submit(JSON.stringify(demo))}>Try the demo village</button>}
      </div>
      <p className="muted small">Stored in this browser only.</p>
    </div>
  )
}
