import { useMemo, useState } from 'react'
import { diffExports, QUEUE_LABEL, sectionStats, type Item, type Queue, type Village } from '../lib/model'
import type { Account } from '../lib/store'
import { ago, dateStr, dur, pct } from '../lib/format'
import { PACKED, type VillageId } from '../lib/game'
import { CostView, Countdown, Img, Win } from './bits'
import { Detail } from './Tile'

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

/** One running upgrade: the thing itself, where it is going, and how long is left. */
function Site({ it, who, now, onOpen }: { it: Item; who: string; now: number; onOpen: (it: Item) => void }) {
  const left = it.finishAt! - now / 1000
  const done = it.activeTime ? Math.max(0, Math.min(1, 1 - Math.max(0, left) / it.activeTime)) : 0
  return (
    <button className={`site ${left <= 0 ? 'done' : ''}`} onClick={() => onOpen(it)}>
      <span className="site-lvl">{it.lvl} → {it.lvl + 1}</span>
      <span className="site-who">{who}</span>
      <Img src={it.img} alt="" />
      <b>{it.name}</b>
      <em><Countdown finishAt={it.finishAt!} now={now} /></em>
      <span className="site-bar"><i style={{ width: `${done * 100}%` }} /></span>
    </button>
  )
}

const FLAG_ICON: Record<string, string> = { structures: 'buildings/home-village/cannon/level_21.webp', lab: 'buildings/home-village/laboratory/level_16.webp', heroes: 'heroes/barbarian_king/icon.webp', pets: 'pets/lassi/icon.webp', equipment: 'equipment/giant_gauntlet.webp', walls: 'buildings/home-village/wall/level_19.webp' }

/** One war banner per part of the village, hanging from a beam and filling from the bottom. */
function Banners({ overall, secs, go }: { overall: number; secs: { id: string; label: string; pct: number }[]; go: (id: string) => void }) {
  const icon = (id: string) => (PACKED ? 'pack:' : import.meta.env.BASE_URL + 'assets/') + (FLAG_ICON[id] ?? FLAG_ICON.structures)
  return (
    <section className="banners" aria-label="Village progress">
      <div className="beam"><span className="plaque">{pct(overall)}</span></div>
      <div className="banner-row" style={{ ['--mcols' as string]: secs.length <= 3 ? secs.length : secs.length === 4 ? 2 : 3 }}>
        {secs.map((s) => (
          <button key={s.id} className={`banner ${s.pct >= 0.9995 ? 'maxed' : ''}`} onClick={() => go(s.id)}>
            <i style={{ height: `${s.pct * 100}%` }} />
            <Img src={icon(s.id)} alt="" />
            <b>{pct(s.pct)}</b>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function Overview({ v, vid, account, now, go }: { v: Village; vid: VillageId; account: Account; now: number; go: (tab: string) => void }) {
  const home = vid === 'home'
  const [open, setOpen] = useState<Item | null>(null)
  const prog = useMemo(() => sectionStats(v, vid), [v, vid])
  const snaps = account.snapshots
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null
  const changes = useMemo(() => (prev ? diffExports(prev, snaps[snaps.length - 1]).filter((c) => c.name.startsWith('BB ') !== home) : []), [prev, snaps, home])
  const tabFor: Record<string, string> = home ? { structures: 'village', walls: 'village', lab: 'army', pets: 'army', heroes: 'heroes', equipment: 'heroes' } : { structures: 'village', walls: 'village', lab: 'army', heroes: 'army' }

  const mine = v.items.filter((i) => i.village === vid && !i.optional)
  const queues = ((home ? ['builder', 'lab', 'heroes', 'pets'] : ['builder', 'lab', 'heroes']) as Queue[]).map((q) => {
    const all = mine.filter((i) => i.queue === q)
    const active = all.filter((i) => i.finishAt).sort((a, b) => a.finishAt! - b.finishAt!)
    // quickest things this queue could start next, one row per distinct upgrade
    const seen = new Set<string>()
    const next = all.filter((i) => !i.finishAt && i.steps.length && i.kind !== 'wall' && i.steps[0].time > 0)
      .sort((a, b) => a.steps[0].time - b.steps[0].time || sum(a.steps[0].cost) - sum(b.steps[0].cost))
      .filter((i) => { const k = `${i.id}|${i.lvl}`; if (seen.has(k)) return false; seen.add(k); return true })
    return { q, active, next }
  })
  const label = (q: Queue) => (!home && q === 'lab' ? 'Star Laboratory' : !home && q === 'heroes' ? 'Heroes' : QUEUE_LABEL[q])

  // running upgrades, soonest first, then whoever has nothing to do
  const who = (it: Item) => (it.queue === 'builder' ? (it.badges.includes('Extra builder') ? 'B.O.B' : 'Builder') : label(it.queue))
  const sites = queues.flatMap((q) => q.active).sort((a, b) => a.finishAt! - b.finishAt!)
  const freeBuilders = Math.max(0, (home ? v.builders : v.bbBuilders) - queues[0].active.length)
  const has = (n: string) => v.items.some((i) => i.village === vid && i.kind === 'building' && i.name === n && !i.missing)
  const idle = [
    ...Array.from({ length: freeBuilders }, () => 'Builder'),
    ...(!queues[1].active.length && queues[1].next.length && has(home ? 'Laboratory' : 'Star Laboratory') ? [label('lab')] : []),
    ...(home && queues[3] && !queues[3].active.length && queues[3].next.length && has('Pet House') ? ['Pet House'] : []),
  ]

  return (
    <div className="overview">
      <div className="hud wide">
        <span className="hud-label">To max {home ? `TH${v.th}` : `BH${v.bh}`}</span>
        <CostView cost={prog.all.remCost} exact />
      </div>

      <section className="sites" aria-label="Upgrades in progress">
        {sites.map((it) => <Site key={it.key} it={it} who={who(it)} now={now} onOpen={setOpen} />)}
        {idle.map((w, k) => (
          <button key={w + k} className="site free" onClick={() => go('planner')}>
            <span className="site-who">{w}</span>
            <span className="zzz">z<b>z</b>Z</span>
            <b>{w === 'Builder' ? 'Free builder' : `${w} idle`}</b>
            <em>Planner</em>
          </button>
        ))}
      </section>

      <Banners overall={prog.overall} secs={prog.secs.map((s) => ({ id: s.id, label: s.label, pct: s.stats.pct }))} go={(id) => go(tabFor[id] ?? 'village')} />

      <div className="cols">
        <Win title="Up next" aside={<button className="link" onClick={() => go('planner')}>Planner</button>}>
          {queues.filter((x) => x.next.length).map(({ q, next }) => (
            <div key={q} className="queue">
              <div className="queue-name">{label(q)}</div>
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
          {home && v.helpers.length > 0 && (
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
                    {changes.slice(0, 18).map((c) => <li key={c.name}><span className="plus">+{c.gained}</span>{c.name.replace(/^BB /, '')}</li>)}
                    {changes.length > 18 && <li className="muted">and {changes.length - 18} more</li>}
                  </ul>
                )}
              </>
            ) : <p className="idle">Shows what changed once you import again.</p>}
          </Win>
        </div>
      </div>
      {open && <Detail it={open} now={now} onClose={() => setOpen(null)} />}
    </div>
  )
}
