import { game, entImage, type Ent, type VillageId } from './game'

export type Kind = 'building' | 'trap' | 'wall' | 'unit' | 'spell' | 'hero' | 'pet' | 'equipment' | 'guardian' | 'module'
export type Cat =
  | 'townhall' | 'defenses' | 'traps' | 'army' | 'resources' | 'other' | 'walls' | 'crafted'
  | 'troops' | 'darktroops' | 'spells' | 'sieges' | 'pets' | 'heroes' | 'equipment' | 'guardians'
export type Queue = 'builder' | 'lab' | 'heroes' | 'pets' | 'smith'
export type Cost = Record<string, number>

export const CAT_LABEL: Record<Cat, string> = {
  townhall: 'Town Hall', defenses: 'Defenses', traps: 'Traps', army: 'Army Buildings', resources: 'Resources', other: 'Other',
  walls: 'Walls', crafted: 'Crafted Defenses', troops: 'Troops', darktroops: 'Dark Troops', spells: 'Spells', sieges: 'Siege Machines',
  pets: 'Pets', heroes: 'Heroes', equipment: 'Hero Equipment', guardians: 'Guardians',
}
export const QUEUE_LABEL: Record<Queue, string> = { builder: 'Builders', lab: 'Laboratory', heroes: 'Hero Hall', pets: 'Pet House', smith: 'Blacksmith' }

export interface Step { to: number; cost: Cost; time: number; active?: boolean }
export interface Item {
  key: string
  kind: Kind
  id: number
  name: string
  village: VillageId
  cat: Cat
  queue: Queue
  img: string | null
  imgMax: string | null
  lvl: number
  max: number
  /** highest level in the game, regardless of hall */
  absMax: number
  count: number
  /** epoch seconds when the running upgrade completes */
  finishAt?: number
  /** full duration of the running upgrade, when known */
  activeTime?: number
  steps: Step[]
  doneTime: number
  totalTime: number
  doneCost: number
  totalCost: number
  badges: string[]
  /** not yet built / unlocked */
  missing?: boolean
  hero?: string
  epic?: boolean
  /** excluded from overall progress (temporary content) */
  optional?: boolean
}
export interface Helper { name: string; img: string | null; lvl: number; max: number; readyAt?: number }
export interface Village {
  tag: string
  timestamp: number
  th: number
  bh: number
  items: Item[]
  helpers: Helper[]
  builders: number
  bbBuilders: number
  unknown: number
}

interface Raw { data: number; lvl?: number; cnt?: number; timer?: number; gear_up?: number; supercharge?: number; weapon?: number; extra?: boolean; helper_recurrent?: boolean; helper_cooldown?: number; types?: { data: number; modules: { data: number; lvl: number; timer?: number }[] }[] }
export type Export = Record<string, unknown> & { tag: string; timestamp: number }

const sumCost = (c: Cost) => Object.values(c).reduce((a, b) => a + b, 0)
export function addCost(into: Cost, c: Cost, mult = 1) {
  for (const [k, v] of Object.entries(c)) if (v) into[k] = (into[k] ?? 0) + v * mult
  return into
}
/** highest level whose hall requirement is met */
function maxFor(L: number[][], hall: number, thIdx = 2) {
  let m = 0
  L.forEach((l, i) => { if (l[thIdx] <= hall) m = i + 1 })
  return m
}

const BUILDING_CAT: Record<string, Cat> = { Defense: 'defenses', Army: 'army', Resource: 'resources', Wall: 'walls', 'Town Hall': 'townhall', 'BB Builder Hall': 'townhall', Trap: 'traps' }

export function parseExport(text: string): Export {
  let j: unknown
  try { j = JSON.parse(text.trim()) } catch { throw new Error('That is not valid JSON. Copy the whole export from the game and paste it unchanged.') }
  const o = j as Export
  if (!o || typeof o !== 'object' || typeof o.tag !== 'string' || !Array.isArray(o.buildings))
    throw new Error('This JSON does not look like a Clash of Clans data export (no "tag" / "buildings").')
  if (typeof o.timestamp !== 'number') o.timestamp = Math.floor(Date.now() / 1000)
  return o
}

export function buildVillage(x: Export): Village {
  const ts = x.timestamp
  const arr = (k: string) => (Array.isArray(x[k]) ? (x[k] as Raw[]) : [])
  const items: Item[] = []
  let unknown = 0
  let seq = 0
  const hallLvl = (k: string, id: number) => Math.max(0, ...arr(k).filter((b) => b.data === id).map((b) => b.lvl ?? 0))
  const th = hallLvl('buildings', game.halls.home.id) || 1
  const bh = hallLvl('buildings2', game.halls.builder.id)
  const hallOf = (v: VillageId) => (v === 'home' ? th : bh)

  /** convention 'build': L[n-1] is the price of reaching level n. 'upgrade': L[n-1] is the price of going n -> n+1. */
  function make(o: { kind: Kind; id: number; e: Ent; cat: Cat; queue: Queue; lvl: number; count?: number; timer?: number; conv: 'build' | 'upgrade'; res?: string; village?: VillageId; name?: string; badges?: string[]; max?: number; optional?: boolean; img?: string | null }): Item {
    const village = o.village ?? o.e.v ?? 'home'
    const count = o.count ?? 1
    const absMax = Math.max(o.e.L.length, o.lvl)
    let max = o.max ?? maxFor(o.e.L, hallOf(village), o.kind === 'equipment' ? 3 : 2)
    const upgrading = o.timer != null
    max = Math.max(max, o.lvl + (upgrading ? 1 : 0))
    const row = (to: number) => o.e.L[o.conv === 'build' ? to - 1 : to - 2]
    const costOf = (to: number): Cost => {
      const r = row(to)
      if (!r) return {}
      if (o.kind === 'equipment') return { 'Shiny Ore': r[0], 'Glowy Ore': r[1], 'Starry Ore': r[2] }
      return r[0] ? { [o.res ?? o.e.r ?? 'Gold']: r[0] } : {}
    }
    const timeOf = (to: number) => (o.kind === 'equipment' ? 0 : row(to)?.[1] ?? 0)
    let doneTime = 0, totalTime = 0, doneCost = 0, totalCost = 0
    for (let to = 1; to <= max; to++) {
      const t = timeOf(to), c = sumCost(costOf(to))
      totalTime += t * count; totalCost += c * count
      if (to <= o.lvl) { doneTime += t * count; doneCost += c * count }
    }
    const steps: Step[] = []
    for (let to = o.lvl + 1; to <= max; to++) {
      if (to === 1 && o.conv === 'upgrade') continue
      const active = upgrading && to === o.lvl + 1
      steps.push({ to, cost: active ? {} : costOf(to), time: active ? Math.max(0, o.timer!) : timeOf(to), active })
    }
    return {
      key: `${o.kind}-${o.id}-${seq++}`, kind: o.kind, id: o.id, name: o.name ?? o.e.n, village, cat: o.cat, queue: o.queue,
      img: o.img !== undefined ? o.img : entImage(o.e, o.lvl), imgMax: entImage(o.e, max),
      lvl: o.lvl, max, absMax, count, finishAt: upgrading ? ts + o.timer! : undefined, activeTime: upgrading ? timeOf(o.lvl + 1) : undefined,
      steps, doneTime, totalTime, doneCost, totalCost, badges: o.badges ?? [], missing: o.lvl === 0 && !upgrading, hero: o.e.hero, epic: o.e.epic, optional: o.optional,
    }
  }

  // ---- buildings & traps (both villages) ----
  for (const v of ['home', 'builder'] as VillageId[]) {
    const sfx = v === 'home' ? '' : '2'
    const hall = game.halls[v]
    const hl = hallOf(v)
    const owned: Record<string, number> = {}
    const consumed: Record<string, number> = {}
    const own = (id: number, n: number) => { owned[id] = (owned[id] ?? 0) + n }
    for (const [tableKey, table, kind] of [['buildings', game.buildings, 'building'], ['traps', game.traps, 'trap']] as const) {
      for (const b of arr(tableKey + sfx)) {
        const e = table[b.data]
        if (!e) { unknown++; continue }
        const cnt = b.cnt ?? 1
        own(b.data, cnt)
        for (const [mid, q] of Object.entries(e.merge ?? {})) consumed[mid] = (consumed[mid] ?? 0) + q * cnt
        if (b.types) {
          for (const t of b.types) {
            const c = game.crafted[t.data]
            for (const m of t.modules ?? []) {
              const me = game.modules[m.data]
              if (!c || !me) { unknown++; continue }
              items.push(make({ kind: 'module', id: m.data, e: me, cat: 'crafted', queue: 'builder', lvl: m.lvl ?? 1, timer: m.timer, conv: 'build', village: 'home', name: `${c.n} · ${me.n}`, optional: true, img: entImage(c, 99) }))
            }
          }
          continue
        }
        const lvl = b.lvl ?? 0
        const isWall = e.t === 'Wall'
        const badges: string[] = []
        if (b.gear_up) badges.push('Geared up')
        if (b.extra) badges.push('Extra builder')
        if (b.helper_recurrent) badges.push('Apprentice assigned')
        const sc = e.sc?.[lvl]
        if (sc && sc.th <= hl) badges.push(`Supercharge ${b.supercharge ?? 0}/${sc.L.length}`)
        const base = { kind: (isWall ? 'wall' : kind) as Kind, id: b.data, e, cat: BUILDING_CAT[e.t ?? ''] ?? 'other', queue: 'builder' as Queue, conv: 'build' as const, badges }
        if (isWall || b.timer != null) items.push(make({ ...base, lvl, count: isWall ? cnt : 1, timer: b.timer }))
        else for (let i = 0; i < cnt; i++) items.push(make({ ...base, lvl }))
        const w = b.weapon != null ? hall.weapons[lvl] : undefined
        if (w) items.push(make({ kind: 'building', id: b.data, e: { n: w.n, L: w.L.map((l) => [l[0], l[1], 0]), r: w.r, v }, cat: 'townhall', queue: 'builder', lvl: b.weapon!, conv: 'build', img: entImage(e, lvl) }))
      }
    }
    // things the hall allows that are not built yet
    const allowed: Record<string, number> = {}
    for (let i = 0; i < hl && i < hall.unlocks.length; i++) {
      for (const [id, q] of Object.entries(hall.unlocks[i])) allowed[id] = (allowed[id] ?? 0) + q
      for (const [id, q] of Object.entries(hall.merges[i])) consumed[id] = (consumed[id] ?? 0) + q
    }
    for (const [id, q] of Object.entries(allowed)) {
      const e = game.buildings[id] ?? game.traps[id]
      if (!e || !e.L.length) continue
      const miss = q - (owned[id] ?? 0) - (consumed[id] ?? 0)
      if (miss <= 0) continue
      const isWall = e.t === 'Wall'
      const base = { kind: (isWall ? 'wall' : game.traps[id] ? 'trap' : 'building') as Kind, id: +id, e, cat: BUILDING_CAT[e.t ?? ''] ?? 'other', queue: 'builder' as Queue, conv: 'build' as const, lvl: 0 }
      if (isWall) items.push(make({ ...base, count: miss }))
      else for (let i = 0; i < miss; i++) items.push(make(base))
    }
  }

  // ---- everything with a single level per entity ----
  function levelled(keys: string[], table: Record<string, Ent>, kind: Kind, cat: (e: Ent) => Cat, queue: (e: Ent) => Queue, conv: 'build' | 'upgrade' = 'upgrade') {
    const seen = new Set<number>()
    for (const k of keys) for (const u of arr(k)) {
      const e = table[u.data]
      if (!e) { unknown++; continue }
      seen.add(u.data)
      items.push(make({ kind, id: u.data, e, cat: cat(e), queue: queue(e), lvl: u.lvl ?? 1, timer: u.timer, conv }))
    }
    // not unlocked yet, but available at this hall level
    for (const [id, e] of Object.entries(table)) {
      if (seen.has(+id) || kind === 'equipment') continue
      if (e.v === 'builder' && !bh) continue
      if (maxFor(e.L, hallOf(e.v ?? 'home')) > 0) items.push(make({ kind, id: +id, e, cat: cat(e), queue: queue(e), lvl: 0, conv }))
    }
  }
  levelled(['units', 'units2', 'siege_machines'], game.units, 'unit', (e) => (e.c === 'siege' ? 'sieges' : e.c === 'dark' ? 'darktroops' : 'troops'), () => 'lab')
  levelled(['spells'], game.spells, 'spell', () => 'spells', () => 'lab')
  levelled(['heroes', 'heroes2'], game.heroes, 'hero', () => 'heroes', () => 'heroes')
  levelled(['pets'], game.pets, 'pet', () => 'pets', () => 'pets')
  levelled(['equipment'], game.equipment, 'equipment', () => 'equipment', () => 'smith')
  levelled(['guardians'], game.guardians, 'guardian', () => 'guardians', () => 'builder')

  const helpers: Helper[] = arr('helpers').flatMap((h) => {
    const e = game.helpers[h.data]
    if (!e) return []
    return [{ name: e.n, img: entImage(e, 1), lvl: h.lvl ?? 1, max: maxFor(e.L, th), readyAt: h.helper_cooldown ? ts + h.helper_cooldown : undefined }]
  })
  const cnt = (k: string, name: string) => arr(k).filter((b) => game.buildings[b.data]?.n === name).reduce((a, b) => a + (b.cnt ?? 1), 0)
  return {
    tag: x.tag, timestamp: ts, th, bh, items, helpers, unknown,
    builders: cnt('buildings', "Builder's Hut") + cnt('buildings', "B.O.B's Hut") || 1,
    bbBuilders: bh ? 1 + (cnt('buildings2', "O.T.T.O's Outpost") ? 1 : 0) : 0,
  }
}

// ---------- aggregation ----------
export interface Stats { pct: number; remTime: number; remCost: Cost; levelsLeft: number; items: number; maxed: number }
export function stats(items: Item[]): Stats {
  let dt = 0, tt = 0, dc = 0, tc = 0, remTime = 0, levelsLeft = 0, n = 0, maxed = 0
  const remCost: Cost = {}
  for (const it of items) {
    dt += it.doneTime; tt += it.totalTime; dc += it.doneCost; tc += it.totalCost
    n += it.count
    if (!it.steps.length) maxed += it.count
    for (const s of it.steps) { remTime += s.time * it.count; addCost(remCost, s.cost, it.count); levelsLeft += it.count }
  }
  // time is the fairest yardstick; things without build time (walls, equipment) fall back to cost
  const pct = tt > 0 ? dt / tt : tc > 0 ? dc / tc : 1
  return { pct, remTime, remCost, levelsLeft, items: n, maxed }
}

export interface Section { id: string; label: string; cats: Cat[] }
export const HOME_SECTIONS: Section[] = [
  { id: 'structures', label: 'Structures', cats: ['townhall', 'defenses', 'traps', 'army', 'resources', 'other'] },
  { id: 'lab', label: 'Laboratory', cats: ['troops', 'darktroops', 'spells', 'sieges'] },
  { id: 'heroes', label: 'Heroes', cats: ['heroes', 'guardians'] },
  { id: 'pets', label: 'Pets', cats: ['pets'] },
  { id: 'equipment', label: 'Equipment', cats: ['equipment'] },
  { id: 'walls', label: 'Walls', cats: ['walls'] },
]
export const BUILDER_SECTIONS: Section[] = [
  { id: 'structures', label: 'Structures', cats: ['townhall', 'defenses', 'traps', 'army', 'resources', 'other'] },
  { id: 'lab', label: 'Star Laboratory', cats: ['troops'] },
  { id: 'heroes', label: 'Heroes', cats: ['heroes'] },
  { id: 'walls', label: 'Walls', cats: ['walls'] },
]
export const inVillage = (v: Village, id: VillageId) => v.items.filter((i) => i.village === id && !i.optional)
export function sectionStats(v: Village, id: VillageId) {
  const its = inVillage(v, id)
  const secs = (id === 'home' ? HOME_SECTIONS : BUILDER_SECTIONS).map((s) => ({ ...s, stats: stats(its.filter((i) => s.cats.includes(i.cat))) })).filter((s) => s.stats.items > 0)
  const overall = secs.length ? secs.reduce((a, s) => a + s.stats.pct, 0) / secs.length : 0
  return { secs, overall, all: stats(its) }
}

/** What changed between two exports of the same village. */
export function diffExports(prev: Export, cur: Export) {
  const tally = (x: Export) => {
    const m = new Map<string, number>()
    for (const [k, table] of [['buildings', game.buildings], ['buildings2', game.buildings], ['traps', game.traps], ['traps2', game.traps], ['units', game.units], ['units2', game.units], ['siege_machines', game.units], ['spells', game.spells], ['heroes', game.heroes], ['heroes2', game.heroes], ['pets', game.pets], ['equipment', game.equipment], ['guardians', game.guardians]] as const) {
      for (const r of (Array.isArray(x[k]) ? x[k] : []) as Raw[]) {
        const e = table[r.data]
        if (!e || r.lvl == null) continue
        const key = `${k.endsWith('2') ? 'BB ' : ''}${e.n}`
        m.set(key, (m.get(key) ?? 0) + r.lvl * (r.cnt ?? 1))
      }
    }
    return m
  }
  const a = tally(prev), b = tally(cur)
  const out: { name: string; gained: number }[] = []
  for (const [k, v] of b) { const g = v - (a.get(k) ?? 0); if (g > 0) out.push({ name: k, gained: g }) }
  return out.sort((p, q) => q.gained - p.gained)
}
