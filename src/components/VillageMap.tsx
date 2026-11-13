import { useMemo } from 'react'
import type { Item } from '../lib/model'
import { dur } from '../lib/format'
import { Img } from './bits'
import { collapse } from './Tile'

const ORDER = ['townhall', 'defenses', 'army', 'resources', 'other', 'traps']

/** Lays the village out as an isometric base: Town Hall in the middle, everything else spiralling out. */
export function VillageMap({ items, now, onOpen }: { items: Item[]; now: number; onOpen: (it: Item, n: number) => void }) {
  const { cells, G } = useMemo(() => {
    const inner = collapse(items.filter((i) => i.kind !== 'wall' && i.kind !== 'module').sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat) || a.name.localeCompare(b.name) || b.lvl - a.lvl))
    const N = Math.max(3, Math.ceil(Math.sqrt(inner.length)))
    const G = N + 1, c = (G - 1) / 2
    const slots: [number, number][] = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) slots.push([i + 0.5, j + 0.5])
    // nearest to the centre first, sweeping round each ring
    slots.sort((a, b) => Math.max(Math.abs(a[0] - c), Math.abs(a[1] - c)) - Math.max(Math.abs(b[0] - c), Math.abs(b[1] - c)) || Math.atan2(a[1] - c, a[0] - c) - Math.atan2(b[1] - c, b[0] - c))
    const cells = inner.map(({ it, n }, k) => ({ it, n, i: slots[k][0], j: slots[k][1], wall: false }))
    return { cells, G }
  }, [items])

  return (
    <div className="map" role="group" aria-label="Village map">
      <div className="map-inner" style={{ ['--g' as string]: G }}>
        <div className="map-ground" />
        {cells.map(({ it, n, i, j, wall }, k) => {
          const maxed = !it.steps.length
          const left = it.finishAt ? it.finishAt - now / 1000 : 0
          return (
            <button key={k} className={`spot ${wall ? 'wall' : ''} ${maxed ? 'maxed' : ''} ${it.finishAt ? 'active' : ''} ${it.missing ? 'missing' : ''}`} style={{ ['--dx' as string]: i - j, ['--dy' as string]: i + j, zIndex: Math.round(i + j) }}
              onClick={() => onOpen(it, n)} title={`${it.name} ${it.missing ? '(not built)' : `level ${it.lvl}`}${wall ? ` ×${it.count}` : n > 1 ? ` ×${n}` : ''}`}>
              <Img src={it.img} alt={it.name} />
              {!wall && <span className="spot-lvl">{it.finishAt ? (left > 0 ? dur(left, 1) : '✓') : it.missing ? '+' : it.lvl}{n > 1 && <small>×{n}</small>}</span>}
            </button>
          )
        })}
      </div>
      <div className="map-key"><span className="k maxed">Maxed</span><span className="k">Upgradable</span><span className="k active">Upgrading</span></div>
    </div>
  )
}
