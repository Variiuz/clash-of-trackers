import { useEffect, useState, type ReactNode } from 'react'
import { resIcon, RES_ORDER } from '../lib/game'
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
          <img src={resIcon(k)} alt={k} />{exact ? full(cost[k]) : short(cost[k])}
        </span>
      ))}
    </span>
  )
}

export function Bar({ value, tone }: { value: number; tone?: 'gold' | 'green' | 'blue' }) {
  const v = Math.max(0, Math.min(1, value))
  return <div className={`bar ${tone ?? (v >= 0.9995 ? 'gold' : 'green')}`} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${v * 100}%` }} /></div>
}

export function Ring({ value, size = 132, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 9, c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

export function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <div className={`noimg ${className ?? ''}`} aria-label={alt}>{alt.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  )
}
