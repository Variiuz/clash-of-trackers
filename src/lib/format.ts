export function short(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return trim(n / 1e9) + 'B'
  if (a >= 1e6) return trim(n / 1e6) + 'M'
  if (a >= 1e4) return trim(n / 1e3) + 'K'
  return n.toLocaleString('en-US')
}
const trim = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ''))
export const full = (n: number) => n.toLocaleString('en-US')

export function dur(sec: number, parts = 2): string {
  if (sec <= 0) return '0s'
  const units: [string, number][] = [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]
  const out: string[] = []
  let rest = Math.floor(sec)
  for (const [u, s] of units) {
    const q = Math.floor(rest / s)
    if (q || out.length) { if (q) out.push(q + u); rest -= q * s }
    if (out.length >= parts) break
  }
  return out.join(' ') || '0s'
}
export const pct = (x: number) => (x >= 0.9995 ? '100%' : (x * 100).toFixed(x > 0.99 ? 2 : 1) + '%')
export function ago(tsSec: number, now = Date.now()): string {
  const s = Math.max(0, now / 1000 - tsSec)
  if (s < 90) return 'just now'
  return dur(s, 1) + ' ago'
}
export const dateStr = (tsSec: number) => new Date(tsSec * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
