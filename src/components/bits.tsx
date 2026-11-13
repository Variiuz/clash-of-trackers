import { useEffect, useState, type ReactNode } from 'react'
import { loadPacked, packedUrl, resIcon, RES_ORDER } from '../lib/game'
import type { Cost } from '../lib/model'
import { dur, full, short } from '../lib/format'

/** Re-renders once per second; shared by every countdown on the page. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return now
}

export function Countdown({ finishAt, now }: { finishAt: number; now: number }) {
  const left = finishAt - now / 1000
  return left <= 0 ? <span className="ready">Finished</span> : <span className="timer">{dur(left, 3)}</span>
}

export function CostView({ cost, exact }: { cost: Cost; exact?: boolean }) {
  const keys = RES_ORDER.filter((k) => cost[k])
  if (!keys.length) return <span className="muted">—</span>
  return (
    <span className="costs">
      {keys.map((k) => (
        <span key={k} className="cost" title={`${full(cost[k])} ${k}`}>
          <Img src={resIcon(k)} alt={k} />{exact ? full(cost[k]) : short(cost[k])}
        </span>
      ))}
    </span>
  )
}

/** Chunky in-game style bar; `label` is drawn inside it. */
export function Bar({ value, tone, label }: { value: number; tone?: 'gold' | 'green' | 'blue'; label?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`bar ${label ? 'tall' : ''} ${tone ?? (v >= 0.9995 ? 'gold' : 'green')}`} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v * 100}%` }} />
      {label && <span>{label}</span>}
    </div>
  )
}

/** A game-style window: dark title bar on a parchment body. */
export function Win({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`win ${className ?? ''}`}>
      <header className="win-head"><h3>{title}</h3>{aside && <span className="win-aside">{aside}</span>}</header>
      <div className="win-body">{children}</div>
    </section>
  )
}

export function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const packed = !!src && src.startsWith('pack:')
  const [bad, setBad] = useState(false)
  const [url, setUrl] = useState(() => (packed ? packedUrl(src!) ?? null : src))
  useEffect(() => {
    if (!packed) { setUrl(src); return }
    const hit = packedUrl(src!)
    setUrl(hit ?? null)
    let live = true
    if (!hit) loadPacked(src!).then((u) => { if (live) { if (u) setUrl(u); else setBad(true) } }, () => live && setBad(true))
    return () => { live = false }
  }, [src, packed])
  if (packed && !url && !bad) return <span className={`imgwait ${className ?? ''}`} aria-hidden="true" />
  if (!src || bad) return <div className={`noimg ${className ?? ''}`} aria-label={alt}>{alt.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
  return <img className={className} src={url ?? undefined} alt={alt} loading="lazy" onError={() => setBad(true)} />
}

export function Modal({ onClose, children, wide, title }: { onClose: () => void; children: ReactNode; wide?: boolean; title: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal win ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <header className="win-head"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></header>
        <div className="win-body">{children}</div>
      </div>
    </div>
  )
}
