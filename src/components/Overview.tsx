import { useMemo } from 'react'
import { diffExports, QUEUE_LABEL, sectionStats, type Item, type Queue, type Village } from '../lib/model'
import type { Account } from '../lib/store'
import { ago, dateStr, dur, pct } from '../lib/format'
import { Bar, CostView, Countdown, Img, Win } from './bits'

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

function Row({ it, now }: { it: Item; now: number }) {
  const left = it.finishAt! - now / 1000
  const done = it.activeTime ? 1 - Math.max(0, left) / it.activeTime : 0
  return (
    <div className="row">
      <Img src={it.img} alt={it.name} />
      <div className="row-main">
        <div className="row-top"><b>{it.name}</b><span className="muted">Level {it.lvl + 1}</span></div>
        <Bar value={Math.max(0, Math.min(1, done))} tone="blue" />
      </div>
      <div className="row-end">
        <Countdown finishAt={it.finishAt!} now={now} />
        <small>{left > 0 ? new Date(it.finishAt! * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'import again'}</small>
      </div>
    </div>
  )
}

export function Overview({ v, account, now, go }: { v: Village; account: Account; now: number; go: (tab: string) => void }) {
  const home = useMemo(() => sectionStats(v, 'home'), [v])
  const bb = useMemo(() => sectionStats(v, 'builder'), [v])
  const snaps = account.snapshots
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null
  const changes = useMemo(() => (prev ? diffExports(prev, snaps[snaps.length - 1]) : []), [prev, snaps])
  const tabFor: Record<string, string> = { structures: 'home', walls: 'home', lab: 'army', pets: 'army', heroes: 'heroes', equipment: 'heroes' }

  const homeItems = v.items.filter((i) => i.village === 'home' && !i.optional)
  const queues = (['builder', 'lab', 'heroes', 'pets'] as Queue[]).map((q) => {
    const all = homeItems.filter((i) => i.queue === q)
    const active = all.filter((i) => i.finishAt).sort((a, b) => a.finishAt! - b.finishAt!)
    // quickest things this queue could start next, one row per distinct upgrade
    const seen = new Set<string>()
    const next = all.filter((i) => !i.finishAt && i.steps.length && i.kind !== 'wall' && i.steps[0].time > 0)
      .sort((a, b) => a.steps[0].time - b.steps[0].time || sum(a.steps[0].cost) - sum(b.steps[0].cost))
      .filter((i) => { const k = `${i.id}|${i.lvl}`; if (seen.has(k)) return false; seen.add(k); return true })
    return { q, active, next }
  })
  const builderTime = homeItems.filter((i) => i.queue === 'builder').reduce((a, i) => a + i.steps.reduce((x, s) => x + s.time, 0) * i.count, 0)
  const labTime = home.secs.find((s) => s.id === 'lab')?.stats.remTime ?? 0
  const bbActive = v.items.filter((i) => i.village === 'builder' && i.finishAt).sort((a, b) => a.finishAt! - b.finishAt!)

  return (
    <div className="overview">
      <div className="hud wide">
        <span className="hud-label">Needed to max Town Hall {v.th}</span>
        <CostView cost={home.all.remCost} exact />
      </div>

      <div className="cols">
        <Win title="Upgrades in progress" aside={`${queues[0].active.length} / ${v.builders} builders`}>
          {queues.map(({ q, active }) => (
            <div key={q} className="queue">
              <div className="queue-name">{QUEUE_LABEL[q]}</div>
              {active.length ? active.map((a) => <Row key={a.key} it={a} now={now} />) : <p className="idle">Nothing running. {q === 'builder' ? 'Your builders are asleep!' : 'Idle.'}</p>}
            </div>
          ))}
          {bbActive.length > 0 && (
            <div className="queue">
              <div className="queue-name">Builder Base</div>
              {bbActive.map((a) => <Row key={a.key} it={a} now={now} />)}
            </div>
          )}
        </Win>

        <div className="stackcol">
          <Win title="Village progress" aside={pct(home.overall)}>
            <div className="prog">
              {home.secs.map((s) => (
                <button key={s.id} className="prog-row" onClick={() => go(tabFor[s.id] ?? 'home')}>
                  <span>{s.label}</span>
                  <Bar value={s.stats.pct} label={pct(s.stats.pct)} />
                </button>
              ))}
              {v.bh > 0 && (
                <button className="prog-row" onClick={() => go('builder')}>
                  <span>Builder Base</span>
                  <Bar value={bb.overall} label={pct(bb.overall)} tone="blue" />
                </button>
              )}
            </div>
            <p className="note">
              {builderTime > 0 ? <>Your {v.builders} builders need about <b>{dur(builderTime / v.builders, 1)}</b> of non-stop work; the Laboratory needs <b>{dur(labTime, 1)}</b>. Earliest finish around {dateStr(now / 1000 + Math.max(builderTime / v.builders, labTime))}.</> : 'Every structure is maxed for this Town Hall.'}
            </p>
          </Win>

          <Win title="Up next" aside={<button className="link" onClick={() => go('planner')}>Planner</button>}>
            {queues.filter((x) => x.next.length).map(({ q, next }) => (
              <div key={q} className="queue">
                <div className="queue-name">{QUEUE_LABEL[q]}</div>
                {next.slice(0, q === 'builder' ? 3 : 1).map((i) => (
                  <div key={i.key} className="row">
                    <Img src={i.img} alt={i.name} />
                    <div className="row-main"><div className="row-top"><b>{i.name}</b><span className="muted">{i.missing ? 'Build' : `Level ${i.lvl + 1}`}</span></div><CostView cost={i.steps[0].cost} exact /></div>
                    <div className="row-end"><span className="clockt">{dur(i.steps[0].time)}</span></div>
                  </div>
                ))}
              </div>
            ))}
            {queues.every((x) => !x.next.length) && <p className="idle">Nothing left to start. Fully maxed!</p>}
          </Win>
        </div>
      </div>

      {v.helpers.length > 0 && (
        <Win title="Helpers">
          <div className="helpers">
            {v.helpers.map((h) => (
              <div key={h.name} className="helper">
                <Img src={h.img} alt={h.name} />
                <div><b>{h.name}</b><div className="muted small">Level {h.lvl}{h.max > h.lvl ? ` of ${h.max}` : ''}{h.readyAt && h.readyAt > now / 1000 ? ` · ready in ${dur(h.readyAt - now / 1000)}` : h.readyAt ? ' · ready' : ''}</div></div>
              </div>
            ))}
          </div>
        </Win>
      )}

      <Win title="Village log" aside={`${snaps.length} import${snaps.length === 1 ? '' : 's'}`}>
        {prev ? (
          <>
            <p className="note first">Finished since your previous import, {ago(prev.timestamp, now)} ({dateStr(prev.timestamp)}):</p>
            {changes.length === 0 ? <p className="idle">No completed upgrades between the last two imports.</p> : (
              <ul className="changes">
                {changes.slice(0, 18).map((c) => <li key={c.name}><span className="plus">+{c.gained}</span>{c.name}</li>)}
                {changes.length > 18 && <li className="muted">and {changes.length - 18} more</li>}
              </ul>
            )}
          </>
        ) : <p className="idle">Import a fresh export now and then. Each one is saved, and this log will list what you finished in between.</p>}
      </Win>
    </div>
  )
}
