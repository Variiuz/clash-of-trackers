import { useMemo, useState } from 'react'
import { CAT_LABEL, stats, type Cat, type Item } from '../lib/model'
import { dur, pct } from '../lib/format'
import { Bar, CostView } from './bits'
import { collapse, Detail, Tile } from './Tile'

/** A page of item tiles grouped by category, with search and a hide-maxed switch. */
export function Items({ items, cats, now, groupByHero }: { items: Item[]; cats: Cat[]; now: number; groupByHero?: boolean }) {
  const [q, setQ] = useState('')
  const [hideMaxed, setHideMaxed] = useState(false)
  const [open, setOpen] = useState<{ it: Item; n: number } | null>(null)
  const groups = useMemo(() => {
    const out: { id: string; label: string; all: Item[] }[] = []
    for (const c of cats) {
      const all = items.filter((i) => i.cat === c)
      if (!all.length) continue
      if (c === 'equipment' && groupByHero) {
        for (const h of [...new Set(all.map((i) => i.hero ?? 'Other'))]) out.push({ id: c + h, label: `${h} equipment`, all: all.filter((i) => (i.hero ?? 'Other') === h) })
      } else out.push({ id: c, label: CAT_LABEL[c], all })
    }
    return out
  }, [items, cats, groupByHero])
  const needle = q.trim().toLowerCase()
  const visible = (i: Item) => (!hideMaxed || i.steps.length > 0) && (!needle || i.name.toLowerCase().includes(needle))
  let shown = 0
  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        <label className="switch"><input type="checkbox" checked={hideMaxed} onChange={(e) => setHideMaxed(e.target.checked)} /><span />Hide maxed</label>
      </div>
      {groups.map((g) => {
        const list = g.all.filter(visible)
        if (!list.length) return null
        shown += list.length
        const st = stats(g.all)
        const sorted = [...list].sort((a, b) => Number(!!b.finishAt) - Number(!!a.finishAt) || (g.id === 'walls' ? b.lvl - a.lvl : 0))
        return (
          <section key={g.id} className="group">
            <header className="group-head">
              <h3>{g.label}</h3>
              <Bar value={st.pct} label={pct(st.pct)} />
              <span className="group-rem">
                {st.levelsLeft === 0 ? <span className="maxtxt">All maxed</span> : <><CostView cost={st.remCost} />{st.remTime > 0 && <span className="cost clock">{dur(st.remTime)}</span>}</>}
              </span>
            </header>
            <div className="tiles">
              {collapse(sorted).map(({ it, n }) => <Tile key={it.key} it={it} n={n} now={now} onOpen={(it, n) => setOpen({ it, n })} />)}
            </div>
          </section>
        )
      })}
      {shown === 0 && <p className="empty">Nothing to show{hideMaxed ? ' — everything here is maxed 🎉' : ''}.</p>}
      {open && <Detail it={open.it} n={open.n} now={now} onClose={() => setOpen(null)} />}
    </>
  )
}
