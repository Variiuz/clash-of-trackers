import { addCost, CAT_LABEL, type Cost, type Item } from '../lib/model'
import { dur } from '../lib/format'
import { Bar, CostView, Countdown, Img, Modal } from './bits'

const progress = (it: Item) => (it.max ? it.lvl / it.max : 1)

export function Tile({ it, now, onOpen, n = 1 }: { it: Item; now: number; onOpen: (it: Item, n: number) => void; n?: number }) {
  const maxed = !it.steps.length
  const count = it.count * n
  const next = it.steps.find((s) => !s.active)
  return (
    <button className={`tile ${maxed ? 'maxed' : ''} ${it.missing ? 'missing' : ''} ${it.finishAt ? 'active' : ''} ${it.epic ? 'epic' : ''}`} onClick={() => onOpen(it, n)}>
      <div className="tile-img">
        <Img src={it.img} alt={it.name} />
        {count > 1 && <span className="count">×{count}</span>}
        {it.badges.length > 0 && <span className="dot" title={it.badges.join(' · ')}>★</span>}
        {!maxed && !it.missing && <span className="tile-bar"><i style={{ width: `${progress(it) * 100}%` }} /></span>}
        <span className="lvl">{it.missing ? (it.kind === 'building' || it.kind === 'trap' || it.kind === 'wall' ? 'Not built' : 'Locked') : <>{it.lvl}<small>/{it.max}</small></>}</span>
      </div>
      <div className="tile-name">{it.name}</div>
      <div className="tile-meta">
        {it.finishAt ? <Countdown finishAt={it.finishAt} now={now} /> : maxed ? <span className="maxtxt">{it.max >= it.absMax ? 'Maxed' : 'Max for hall'}</span> : next ? <CostView cost={next.cost} /> : null}
      </div>
    </button>
  )
}

export function Detail({ it, n = 1, now, onClose }: { it: Item; n?: number; now: number; onClose: () => void }) {
  const count = it.count * n
  const total: Cost = {}
  let time = 0
  for (const s of it.steps) { addCost(total, s.cost, count); time += s.time * count }
  return (
    <Modal onClose={onClose} title={it.name}>
      <div className="detail-head">
        <div className="detail-art">
          <Img src={it.img} alt={it.name} />
          {it.steps.length > 0 && it.imgMax && it.imgMax !== it.img && <><span className="arrow">→</span><Img src={it.imgMax} alt={`${it.name} level ${it.max}`} /></>}
        </div>
        <div>
          <div className="eyebrow">{CAT_LABEL[it.cat]}{it.hero ? ` · ${it.hero}` : ''}{count > 1 ? ` · ×${count}` : ''}</div>
          <div className="detail-lvl">{it.missing ? 'Not built yet' : <>Level <b>{it.lvl}</b> of {it.max}</>}{it.absMax > it.max && <span className="muted"> · game max {it.absMax}</span>}</div>
          <Bar value={progress(it)} label={it.missing ? '0%' : `${it.lvl} / ${it.max}`} />
          {it.badges.length > 0 && <div className="badges">{it.badges.map((b) => <span key={b} className="badge">{b}</span>)}</div>}
        </div>
      </div>
      {it.steps.length === 0 ? (
        <p className="maxnote">{it.max >= it.absMax ? 'Maxed' : `Maxed for this hall. Game max is ${it.absMax}.`}</p>
      ) : (
        <>
          <table className="steps">
            <thead><tr><th>Level</th><th>Cost{count > 1 ? ' (each)' : ''}</th><th>Time</th></tr></thead>
            <tbody>
              {it.steps.map((s) => (
                <tr key={s.to} className={s.active ? 'running' : ''}>
                  <td>{s.to - 1} → <b>{s.to}</b></td>
                  <td>{s.active ? <span className="muted">in progress</span> : <CostView cost={s.cost} exact />}</td>
                  <td>{s.active && it.finishAt ? <Countdown finishAt={it.finishAt} now={now} /> : s.time ? dur(s.time) : <span className="muted">instant</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>To max{count > 1 ? ` (×${count})` : ''}</td><td><CostView cost={total} exact /></td><td>{time ? dur(time) : '—'}</td></tr></tfoot>
          </table>
        </>
      )}
    </Modal>
  )
}

/** Collapse identical idle instances (7 maxed collectors -> one tile with ×7). */
export function collapse(items: Item[]): { it: Item; n: number }[] {
  const out = new Map<string, { it: Item; n: number }>()
  for (const it of items) {
    const k = it.finishAt || it.kind === 'wall' ? it.key : `${it.kind}|${it.id}|${it.name}|${it.lvl}|${it.max}|${it.badges.join()}`
    const g = out.get(k)
    if (g) g.n++
    else out.set(k, { it, n: 1 })
  }
  return [...out.values()]
}
