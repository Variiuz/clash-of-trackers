import { useMemo } from 'react'
import type { Item } from '../lib/model'
import { dur } from '../lib/format'
import { Img } from './bits'
import { collapse } from './Tile'

const ORDER = ['townhall', 'defenses', 'army', 'resources', 'other', 'traps']

/** Lays the village out as an isometric base: Town Hall in the middle, everything else spiralling out, walls as the outer ring. */
export function VillageMap({ items, now, onOpen }: { items: Item[]; now: number; onOpen: (it: Item, n: number) => void }) {
  const { cells, G } = useMemo(() => {
    const inner = collapse(items.filter((i) => i.kind !== 'wall' && i.kind !== 'module').sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat) || a.name.localeCompare(b.name) || b.lvl - a.lvl))
    const N = Math.max(3, Math.ceil(Math.sqrt(inner.length)))
    const G = N + 2, c = (G - 1) / 2
    const slots: [number, number][] = []
    for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) slots.push([i, j])
    // nearest to the centre first, sweeping round each ring
    slots.sort((a, b) => Math.max(Math.abs(a[0] - c), Math.abs(a[1] - c)) - Math.max(Math.abs(b[0] - c), Math.abs(b[1] - c)) || Math.atan2(a[1] - c, a[0] - c) - Math.atan2(b[1] - c, b[0] - c))
    const cells = inner.map(({ it, n }, k) => ({ it, n, i: slots[k][0], j: slots[k][1], wall: false }))
    const walls = items.filter((i) => i.kind === 'wall' && i.count > 0).sort((a, b) => b.lvl - a.lvl)
    if (walls.length) {
      // a continuous wall around the base: several overlapping pieces per tile edge, levels in proportion to their counts
      const PER = 3, e = G - 1
      const corners: [number, number][] = [[0, 0], [e, 0], [e, e], [0, e], [0, 0]]
      const ring: [number, number][] = []
      for (let c = 0; c < 4; c++) for (let k = 0; k < e * PER; k++) {
        const t = k / (e * PER)
        ring.push([corners[c][0] + (corners[c + 1][0] - corners[c][0]) * t, corners[c][1] + (corners[c + 1][1] - corners[c][1]) * t])
      }
      const total = walls.reduce((a, w) => a + w.count, 0)
      let acc = 0, w = 0
      ring.forEach(([i, j], k) => {
        while (w < walls.length - 1 && (k + 0.5) / ring.length > (acc + walls[w].count) / total) { acc += walls[w].count; w++ }
        cells.push({ it: walls[w], n: 1, i, j, wall: true })
      })
    }
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
            <button key={k} className={`spot ${wall ? 'wall' : ''} ${maxed ? 'maxed' : ''} ${it.finishAt ? 'active' : ''} ${it.missing ? 'missing' : ''}`} style={{ ['--dx' as string]: i - j, ['--dy' as string]: i + j, zIndex: Math.round((i + j) * 10) + (wall ? 0 : 5) }}
              tabIndex={wall && cells[k - 1]?.it === it ? -1 : undefined} onClick={() => onOpen(it, n)} title={`${it.name} ${it.missing ? '(not built)' : `level ${it.lvl}`}${wall ? ` ×${it.count}` : n > 1 ? ` ×${n}` : ''}`}>
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
