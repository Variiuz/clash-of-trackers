import { useMemo, useState } from 'react'
import { CAT_LABEL, stats, type Cat, type Item } from '../lib/model'
import { dur, pct } from '../lib/format'
import { Bar, CostView, Img } from './bits'
import { collapse, Detail, Tile } from './Tile'
import { VillageMap } from './VillageMap'

const MAP_KINDS = ['building', 'trap']
/** the building that stands for a group in its panel */
const FACE: Partial<Record<Cat, string[]>> = { troops: ['Barracks', 'Builder Barracks'], darktroops: ['Dark Barracks'], spells: ['Spell Factory'], sieges: ['Workshop'], pets: ['Pet House'], equipment: ['Blacksmith'], army: ['Army Camp'], resources: ['Gold Storage'], other: ["Builder's Hut", "O.T.T.O's Outpost"], crafted: ['Crafting Station'], defenses: ['Inferno Tower', 'Archer Tower', 'Cannon'], traps: ['Giant Bomb', 'Mine', 'Bomb'] }
const readView = () => { try { return localStorage.getItem('clash-tracker:view') === 'map' ? 'map' : 'list' } catch { return 'list' } }

/** A page of item tiles grouped by category, with search and a hide-maxed switch. */
export function Items({ items, cats, now, groupByHero, map, bare }: { items: Item[]; cats: Cat[]; now: number; groupByHero?: boolean; map?: boolean; bare?: boolean }) {
  const [view, setView] = useState<'map' | 'list'>(readView)
  const asMap = !!map && view === 'map'
  const pick = (v: 'map' | 'list') => { setView(v); try { localStorage.setItem('clash-tracker:view', v) } catch { /* optional */ } }
  const [q, setQ] = useState('')
  const [hideMaxed, setHideMaxed] = useState(false)
  const [open, setOpen] = useState<{ it: Item; n: number } | null>(null)
  const groups = useMemo(() => {
    const out: { id: string; label: string; all: Item[]; face: string | null }[] = []
    const face = (c: Cat, all: Item[]) => (FACE[c] ?? []).map((n) => items.find((i) => i.name === n && i.kind === 'building' || i.name === n && i.kind === 'trap')).find(Boolean)?.img ?? [...all].sort((a, b) => b.lvl - a.lvl)[0]?.img ?? null
    for (const c of cats) {
      const all = items.filter((i) => i.cat === c && !(asMap && MAP_KINDS.includes(i.kind)))
      if (!all.length) continue
      if (c === 'equipment' && groupByHero) {
        for (const h of [...new Set(all.map((i) => i.hero ?? 'Other'))]) out.push({ id: c + h, label: `${h} equipment`, all: all.filter((i) => (i.hero ?? 'Other') === h), face: face(c, all) })
      } else out.push({ id: c, label: CAT_LABEL[c], all, face: face(c, all) })
    }
    return out
  }, [items, cats, groupByHero, asMap])
  const needle = q.trim().toLowerCase()
  const visible = (i: Item) => (!hideMaxed || i.steps.length > 0) && (!needle || i.name.toLowerCase().includes(needle))
  let shown = 0
  return (
    <>
      {!bare && <div className="toolbar">
        {map && <div className="seg"><button className={asMap ? 'on' : ''} onClick={() => pick('map')}>Village</button><button className={!asMap ? 'on' : ''} onClick={() => pick('list')}>List</button></div>}
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        <label className="switch"><input type="checkbox" checked={hideMaxed} onChange={(e) => setHideMaxed(e.target.checked)} /><span />Hide maxed</label>
      </div>}
      {asMap && <VillageMap items={items.filter((i) => MAP_KINDS.includes(i.kind) && visible(i))} now={now} onOpen={(it, n) => setOpen({ it, n })} />}
      {groups.map((g) => {
        const list = g.all.filter(visible)
        if (!list.length) return null
        shown += list.length
        const st = stats(g.all)
        const sorted = [...list].sort((a, b) => Number(!!b.finishAt) - Number(!!a.finishAt) || (g.id === 'walls' ? b.lvl - a.lvl : 0))
        return (
          <section key={g.id} className="altar panel">
            <header className="panel-head">
              <span className="altar-art"><Img src={g.face} alt="" /></span>
              <h3 className="altar-name">{g.label}</h3>
              <Bar value={st.pct} label={pct(st.pct)} />
              <span className="panel-rem">
                {st.levelsLeft === 0 ? <span className="maxtxt">All maxed</span> : <><CostView cost={st.remCost} />{st.remTime > 0 && <span className="cost clock">{dur(st.remTime)}</span>}</>}
              </span>
            </header>
            <div className="altar-gear">
              {collapse(sorted).map(({ it, n }) => <Tile key={it.key} it={it} n={n} now={now} onOpen={(it, n) => setOpen({ it, n })} />)}
            </div>
          </section>
        )
      })}
      {shown === 0 && !asMap && <p className="empty">{hideMaxed ? 'All maxed' : 'No matches'}</p>}
      {open && <Detail it={open.it} n={open.n} now={now} onClose={() => setOpen(null)} />}
    </>
  )
}
