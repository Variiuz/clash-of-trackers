import { useMemo } from 'react'
import { diffExports, QUEUE_LABEL, sectionStats, type Item, type Queue, type Village } from '../lib/model'
import type { Account } from '../lib/store'
import { ago, dateStr, dur, pct } from '../lib/format'
import { entImage, game, PACKED } from '../lib/game'
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
        <small>{left > 0 ? new Date(it.finishAt! * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small>
      </div>
    </div>
  )
}

/** A building standing on the grass with a speech bubble saying what it is busy with. */
function Station({ img, label, jobs, now }: { img: string | null; label: string; jobs: Item[]; now: number }) {
  return (
    <div className={`station ${jobs.length ? 'busy' : 'idle'}`}>
      <div className="bubble">
        {jobs.length === 0 ? <span className="zzz">z<b>z</b>Z</span> : jobs.slice(0, 2).map((j) => (
          <div key={j.key} className="job">
            <Img src={j.img} alt={j.name} />
            <span><b>{j.name}</b><small>to {j.lvl + 1} · <Countdown finishAt={j.finishAt!} now={now} /></small></span>
          </div>
        ))}
        {jobs.length > 2 && <small className="more">+{jobs.length - 2} more</small>}
      </div>
      <Img src={img} alt={label} className="station-art" />
      <span className="station-label">{label}</span>
    </div>
  )
}

const FLAG_ICON: Record<string, string> = { structures: 'buildings/home-village/cannon/level_21.webp', lab: 'buildings/home-village/laboratory/level_16.webp', heroes: 'heroes/barbarian_king/icon.webp', pets: 'pets/lassi/icon.webp', equipment: 'equipment/giant_gauntlet.webp', walls: 'buildings/home-village/wall/level_19.webp' }

/** The trail from this Town Hall to a maxed one, with a flag for how far each part of the village has come. */
function Road({ th, overall, secs, go }: { th: number; overall: number; secs: { id: string; label: string; pct: number }[]; go: (id: string) => void }) {
  const hall = game.buildings[game.halls.home.id]
  const sorted = [...secs].sort((a, b) => a.pct - b.pct)
  return (
    <div className="road">
      <Img src={entImage(hall, th)} alt={`Town Hall ${th}`} className="road-end" />
      <div className="road-track">
        <i style={{ width: `${overall * 100}%` }} />
        {sorted.map((s, k) => (
          <button key={s.id} className={`flag ${k % 2 ? 'down' : 'up'}`} style={{ left: `${s.pct * 100}%` }} onClick={() => go(s.id)} title={`${s.label} ${pct(s.pct)}`}>
            <Img src={(PACKED ? 'pack:' : import.meta.env.BASE_URL + 'assets/') + FLAG_ICON[s.id]} alt={s.label} />
            <span>{s.label}<b>{pct(s.pct)}</b></span>
          </button>
        ))}
        <span className="runner" style={{ left: `${overall * 100}%` }}><Img src={(PACKED ? 'pack:' : import.meta.env.BASE_URL + 'assets/') + 'troops/barbarian/icon.webp'} alt="" /><b>{pct(overall)}</b></span>
      </div>
      <span className="road-goal"><Img src={entImage(hall, th)} alt="" className="road-end" /><b>MAX</b></span>
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
  const bbActive = v.items.filter((i) => i.village === 'builder' && i.finishAt).sort((a, b) => a.finishAt! - b.finishAt!)

  // who is doing what: one builder hut per running builder job, then the other workplaces
  const named = (n: string) => v.items.filter((i) => i.village === 'home' && i.kind === 'building' && i.name === n)
  const huts = [...named("Builder's Hut"), ...named("B.O.B's Hut")]
  const hutJobs: Item[][] = huts.map(() => [])
  const bob = huts.findIndex((h) => h.name === "B.O.B's Hut")
  let free = 0
  for (const job of queues[0].active) {
    if (job.badges.includes('Extra builder') && bob >= 0 && !hutJobs[bob].length) { hutJobs[bob].push(job); continue }
    while (free < huts.length && (hutJobs[free].length || free === bob)) free++
    const k = free < huts.length ? free : bob >= 0 && !hutJobs[bob].length ? bob : huts.length - 1
    if (k >= 0) hutJobs[k].push(job)
  }
  const place = (n: string, label: string, q: number) => ({ img: named(n)[0]?.img ?? null, label, jobs: queues[q].active, show: named(n).length > 0 })
  const stations = [place('Laboratory', 'Laboratory', 1), place('Hero Hall', 'Hero Hall', 2), place('Pet House', 'Pet House', 3),
    { img: v.items.find((i) => i.village === 'builder' && i.cat === 'townhall')?.img ?? null, label: `Builder Base ${pct(bb.overall)}`, jobs: bbActive, show: v.bh > 0 }].filter((x) => x.show)

  return (
    <div className="overview">
      <div className="hud wide">
        <span className="hud-label">To max TH{v.th}</span>
        <CostView cost={home.all.remCost} exact />
      </div>

      <section className="camp" aria-label="What everyone is working on">
        {huts.map((h, k) => <Station key={h.key} img={h.img} label={h.name === "B.O.B's Hut" ? 'B.O.B' : `Builder ${k + 1}`} jobs={hutJobs[k]} now={now} />)}
        {stations.map((s) => <Station key={s.label} img={s.img} label={s.label} jobs={s.jobs} now={now} />)}
      </section>

      <Road th={v.th} overall={home.overall} secs={home.secs.map((s) => ({ id: s.id, label: s.label, pct: s.stats.pct }))} go={(id) => go(tabFor[id] ?? 'home')} />
      <div className="prog narrow">
        {home.secs.map((s) => (
          <button key={s.id} className="prog-row" onClick={() => go(tabFor[s.id] ?? 'home')}><span>{s.label}</span><Bar value={s.stats.pct} label={pct(s.stats.pct)} /></button>
        ))}
      </div>

      <div className="cols">
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
            {queues.every((x) => !x.next.length) && <p className="idle">Maxed</p>}
          </Win>
        <div className="stackcol">
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
            <p className="note first">Since {dateStr(prev.timestamp)} ({ago(prev.timestamp, now)})</p>
            {changes.length === 0 ? <p className="idle">No changes</p> : (
              <ul className="changes">
                {changes.slice(0, 18).map((c) => <li key={c.name}><span className="plus">+{c.gained}</span>{c.name}</li>)}
                {changes.length > 18 && <li className="muted">and {changes.length - 18} more</li>}
              </ul>
            )}
          </>
        ) : <p className="idle">Shows what changed once you import again.</p>}
      </Win>
        </div>
      </div>
    </div>
  )
}
