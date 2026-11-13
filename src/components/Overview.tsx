import { useMemo } from 'react'
import { buildVillage, diffExports, QUEUE_LABEL, sectionStats, type Item, type Village } from '../lib/model'
import type { Account } from '../lib/store'
import { ago, dateStr, dur, pct } from '../lib/format'
import { Bar, CostView, Countdown, Img, Ring } from './bits'

function Active({ it, now }: { it: Item; now: number }) {
  const left = it.finishAt! - now / 1000
  const done = it.activeTime ? 1 - Math.max(0, left) / it.activeTime : 0
  return (
    <div className={`active-row ${left <= 0 ? 'done' : ''}`}>
      <Img src={it.img} alt={it.name} />
      <div className="grow">
        <div className="active-top"><b>{it.name}</b><span className="muted">{it.lvl} → {it.lvl + 1}</span><span className="push"><Countdown finishAt={it.finishAt!} now={now} /></span></div>
        <Bar value={Math.max(0, Math.min(1, done))} tone="blue" />
        <div className="muted small">{left > 0 ? `Done ${new Date(it.finishAt! * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}` : 'Completed since your export — import again to refresh'}</div>
      </div>
    </div>
  )
}

export function Overview({ v, account, now, go }: { v: Village; account: Account; now: number; go: (tab: string) => void }) {
  const home = useMemo(() => sectionStats(v, 'home'), [v])
  const bb = useMemo(() => sectionStats(v, 'builder'), [v])
  const active = v.items.filter((i) => i.finishAt).sort((a, b) => a.finishAt! - b.finishAt!)
  const snaps = account.snapshots
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null
  const changes = useMemo(() => (prev ? diffExports(prev, snaps[snaps.length - 1]) : []), [prev, snaps])
  const history = useMemo(() => snaps.map((s) => ({ t: s.timestamp, p: sectionStats(buildVillage(s), 'home').overall })), [snaps])
  const tabFor: Record<string, string> = { structures: 'home', walls: 'home', lab: 'army', pets: 'army', heroes: 'heroes', equipment: 'heroes' }
  const builderQ = v.items.filter((i) => i.village === 'home' && i.queue === 'builder' && !i.optional)
  const builderTime = builderQ.reduce((a, i) => a + i.steps.reduce((x, s) => x + s.time, 0) * i.count, 0)
  const labTime = home.secs.find((s) => s.id === 'lab')?.stats.remTime ?? 0
  const heroTime = v.items.filter((i) => i.village === 'home' && i.queue === 'heroes').reduce((a, i) => a + i.steps.reduce((x, s) => x + s.time, 0), 0)
  const queues = [...new Set(active.map((a) => `${a.village}:${a.queue}`))]

  return (
    <div className="overview">
      <section className="card hero-card">
        <Ring value={home.overall}>
          <b>{pct(home.overall)}</b><span>Home Village</span>
        </Ring>
        <div className="sections">
          {home.secs.map((s) => (
            <button key={s.id} className="sec" onClick={() => go(tabFor[s.id] ?? 'home')}>
              <span className="sec-name">{s.label}</span><span className="sec-pct">{pct(s.stats.pct)}</span>
              <Bar value={s.stats.pct} />
              <span className="sec-rem">{s.stats.levelsLeft ? `${s.stats.levelsLeft.toLocaleString()} upgrades left` : 'Maxed'}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="cols">
        <section className="card">
          <h3>Upgrades in progress <span className="pill">{active.length}</span></h3>
          {active.length === 0 && <p className="muted">Nothing is upgrading. Your builders are sleeping! Check the Planner for ideas.</p>}
          {queues.map((q) => {
            const [vil, queue] = q.split(':')
            return (
              <div key={q}>
                <div className="eyebrow sub">{vil === 'builder' ? 'Builder Base · ' : ''}{vil === 'builder' && queue === 'lab' ? 'Star Laboratory' : QUEUE_LABEL[queue as keyof typeof QUEUE_LABEL]}</div>
                {active.filter((a) => `${a.village}:${a.queue}` === q).map((a) => <Active key={a.key} it={a} now={now} />)}
              </div>
            )
          })}
        </section>

        <div className="stackcol">
          <section className="card">
            <h3>Left to max Town Hall {v.th}</h3>
            <div className="stack big"><CostView cost={home.all.remCost} exact /></div>
            <dl className="kv">
              <dt>Builder time</dt><dd>{dur(builderTime)} <span className="muted">≈ {dur(builderTime / v.builders)} with {v.builders} builders</span></dd>
              <dt>Laboratory time</dt><dd>{dur(labTime)}</dd>
              <dt>Hero time</dt><dd>{dur(heroTime)} <span className="muted">across all heroes</span></dd>
              <dt>Earliest finish</dt><dd>{dateStr(now / 1000 + Math.max(builderTime / v.builders, labTime))} <span className="muted">if nothing ever idles</span></dd>
            </dl>
            <button className="btn ghost" onClick={() => go('planner')}>Open planner →</button>
          </section>

          {v.bh > 0 && (
            <section className="card click" onClick={() => go('builder')}>
              <h3>Builder Base <span className="pill">BH {v.bh}</span><span className="push gold">{pct(bb.overall)}</span></h3>
              <Bar value={bb.overall} />
              <div className="stack"><CostView cost={bb.all.remCost} /></div>
            </section>
          )}

          {v.helpers.length > 0 && (
            <section className="card">
              <h3>Helpers</h3>
              <div className="helpers">
                {v.helpers.map((h) => (
                  <div key={h.name} className="helper">
                    <Img src={h.img} alt={h.name} />
                    <div><b>{h.name}</b><div className="muted small">Level {h.lvl}{h.max > h.lvl ? ` / ${h.max}` : ''}{h.readyAt && h.readyAt > now / 1000 ? ` · ready in ${dur(h.readyAt - now / 1000)}` : h.readyAt ? ' · ready' : ''}</div></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="card">
        <h3>Progress history <span className="pill">{snaps.length} import{snaps.length === 1 ? '' : 's'}</span></h3>
        {prev ? (
          <div className="history">
            <Spark points={history} />
            <div>
              <div className="eyebrow sub">Since {ago(prev.timestamp, now)} ({dateStr(prev.timestamp)})</div>
              {changes.length === 0 ? <p className="muted">No completed upgrades between the last two imports.</p> : (
                <ul className="changes">
                  {changes.slice(0, 14).map((c) => <li key={c.name}><span className="plus">+{c.gained}</span>{c.name}</li>)}
                  {changes.length > 14 && <li className="muted">…and {changes.length - 14} more</li>}
                </ul>
              )}
            </div>
          </div>
        ) : <p className="muted">Import a fresh export every now and then — each one is saved as a snapshot, and this panel will chart your progress and list what you finished in between.</p>}
      </section>
    </div>
  )
}

function Spark({ points }: { points: { t: number; p: number }[] }) {
  const W = 420, H = 120, pad = 10
  const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1
  const lo = Math.min(...points.map((p) => p.p)), hi = Math.max(...points.map((p) => p.p))
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad)
  const y = (p: number) => H - pad - ((p - lo) / Math.max(0.0001, hi - lo)) * (H - 2 * pad - 18)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Home Village progress from ${pct(points[0].p)} to ${pct(points[points.length - 1].p)}`}>
      <path d={`${path} L${x(t1)},${H} L${x(t0)},${H} Z`} className="spark-area" />
      <path d={path} className="spark-line" />
      {points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.p)} r="3.5"><title>{dateStr(p.t)}: {pct(p.p)}</title></circle>)}
      <text x={pad} y={14}>{pct(points[0].p)}</text>
      <text x={W - pad} y={14} textAnchor="end">{pct(points[points.length - 1].p)}</text>
    </svg>
  )
}
