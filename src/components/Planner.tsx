import { useMemo, useState } from 'react'
import { QUEUE_LABEL, stats, type Item, type Queue, type Village } from '../lib/model'
import type { VillageId } from '../lib/game'
import { dateStr, dur } from '../lib/format'
import { CostView, Img } from './bits'
import { Detail } from './Tile'

type Sort = 'quick' | 'long' | 'cheap' | 'pricey'
const SORTS: Record<Sort, string> = { quick: 'Shortest first', long: 'Longest first', cheap: 'Cheapest first', pricey: 'Most expensive first' }
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

export function Planner({ v, now }: { v: Village; now: number }) {
  const [village, setVillage] = useState<VillageId>('home')
  const [queue, setQueue] = useState<Queue>('builder')
  const [sort, setSort] = useState<Sort>('quick')
  const [res, setRes] = useState('all')
  const [open, setOpen] = useState<Item | null>(null)

  const pool = useMemo(() => v.items.filter((i) => i.village === village && i.queue === queue), [v, village, queue])
  const queues = (['builder', 'lab', 'heroes', 'pets', 'smith'] as Queue[]).filter((q) => v.items.some((i) => i.village === village && i.queue === q))
  const st = stats(pool.filter((i) => !i.optional))
  const workers = queue === 'builder' ? (village === 'home' ? v.builders : v.bbBuilders) || 1 : 1

  const rows = useMemo(() => {
    const m = new Map<string, { it: Item; n: number; cost: Record<string, number>; time: number; to: number }>()
    for (const it of pool) {
      const s = it.steps[0]
      if (!s || s.active || it.finishAt) continue
      const k = it.kind === 'wall' ? it.key : `${it.id}|${it.name}|${it.lvl}`
      const g = m.get(k)
      if (g) g.n++
      else m.set(k, { it, n: it.count, cost: s.cost, time: s.time, to: s.to })
    }
    let list = [...m.values()]
    if (res !== 'all') list = list.filter((r) => r.cost[res])
    const by: Record<Sort, (a: typeof list[0], b: typeof list[0]) => number> = {
      quick: (a, b) => a.time - b.time || sum(a.cost) - sum(b.cost), long: (a, b) => b.time - a.time,
      cheap: (a, b) => sum(a.cost) - sum(b.cost), pricey: (a, b) => sum(b.cost) - sum(a.cost),
    }
    return list.sort(by[sort])
  }, [pool, sort, res])
  const resources = [...new Set(pool.flatMap((i) => i.steps.flatMap((s) => Object.keys(s.cost).filter((k) => s.cost[k]))))]
  const wall = st.remTime / workers

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          <button className={village === 'home' ? 'on' : ''} onClick={() => { setVillage('home'); setQueue('builder'); setRes('all') }}>Home Village</button>
          {v.bh > 0 && <button className={village === 'builder' ? 'on' : ''} onClick={() => { setVillage('builder'); setQueue('builder'); setRes('all') }}>Builder Base</button>}
        </div>
        <div className="seg">
          {queues.map((q) => <button key={q} className={queue === q ? 'on' : ''} onClick={() => { setQueue(q); setRes('all') }}>{village === 'builder' && q === 'lab' ? 'Star Laboratory' : village === 'builder' && q === 'heroes' ? 'Heroes' : QUEUE_LABEL[q]}</button>)}
        </div>
      </div>
      {st.levelsLeft > 0 && <p className="lede"><b>{st.levelsLeft.toLocaleString()}</b> upgrades{st.remTime > 0 && <> · <b>{dur(workers > 1 ? wall : st.remTime, 1)}</b>{workers > 1 ? ` with ${workers} builders` : ''} · done ~{dateStr(now / 1000 + wall)}</>}</p>}
      {st.levelsLeft > 0 && <div className="hud"><span className="hud-label">Cost</span><CostView cost={st.remCost} exact /></div>}
      <div className="toolbar">
        <h3 className="grow sign">Available</h3>
        <select value={res} onChange={(e) => setRes(e.target.value)} aria-label="Resource filter">
          <option value="all">All resources</option>
          {resources.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <p className="empty">Maxed</p> : (
        <div className="plan">
          {rows.map((r) => (
            <button key={r.it.key} className="plan-row" onClick={() => setOpen(r.it)}>
              <Img src={r.it.img} alt={r.it.name} />
              <span className="plan-name"><b>{r.it.name}</b>{r.n > 1 && <span className="muted"> ×{r.n}</span>}<small>{r.it.missing ? 'Build' : `Level ${r.it.lvl} → ${r.to}`}</small></span>
              <span className="plan-cost"><CostView cost={r.cost} exact /></span>
              <span className="plan-time">{r.time ? dur(r.time) : 'instant'}</span>
            </button>
          ))}
        </div>
      )}
      {open && <Detail it={open} now={now} onClose={() => setOpen(null)} />}
    </>
  )
}
