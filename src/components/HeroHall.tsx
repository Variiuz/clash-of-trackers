import { useState } from 'react'
import type { Item } from '../lib/model'
import { Bar, CostView, Countdown, Img } from './bits'
import { Items } from './Items'
import { Detail, Tile } from './Tile'

/** Heroes on their altars, each with their own equipment laid out beside them. */
export function HeroHall({ items, now }: { items: Item[]; now: number }) {
  const [open, setOpen] = useState<{ it: Item; n: number } | null>(null)
  const heroes = items.filter((i) => i.cat === 'heroes')
  const gear = items.filter((i) => i.cat === 'equipment')
  const names = new Set(heroes.map((h) => h.name))
  return (
    <>
      <div className="altars">
        {heroes.map((h) => {
          const next = h.steps.find((s) => !s.active)
          return (
            <section key={h.key} className={`altar ${h.missing ? 'missing' : ''} ${!h.steps.length ? 'maxed' : ''}`}>
              <button className="altar-hero" onClick={() => setOpen({ it: h, n: 1 })}>
                <span className="altar-art"><Img src={h.img} alt={h.name} /><span className="altar-lvl">{h.missing ? '?' : h.lvl}</span></span>
                <span className="altar-name">{h.name}</span>
                <Bar value={h.max ? h.lvl / h.max : 1} label={h.missing ? 'Locked' : `${h.lvl} / ${h.max}`} />
                <span className="altar-meta">{h.finishAt ? <Countdown finishAt={h.finishAt} now={now} /> : next ? <CostView cost={next.cost} /> : 'Maxed'}</span>
              </button>
              <div className="altar-gear">
                {gear.filter((g) => g.hero === h.name).map((g) => <Tile key={g.key} it={g} now={now} onOpen={(it, n) => setOpen({ it, n })} />)}
              </div>
            </section>
          )
        })}
      </div>
      <Items bare now={now} cats={['guardians', 'equipment']} items={items.filter((i) => i.cat === 'guardians' || (i.cat === 'equipment' && !names.has(i.hero ?? '')))} />
      {open && <Detail it={open.it} n={open.n} now={now} onClose={() => setOpen(null)} />}
    </>
  )
}
