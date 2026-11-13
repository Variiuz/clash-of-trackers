#!/usr/bin/env node
// Generates src/data/demo.json: an invented mid-progress Town Hall 13 village (no real player data).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const g = JSON.parse(fs.readFileSync(path.join(root, 'src/data/game.json'), 'utf8'))
let seed = 20261113
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (n) => Math.floor(rnd() * n)
const maxFor = (L, hall, i = 2) => L.reduce((m, l, k) => (l[i] <= hall ? k + 1 : m), 0)
const H = 3600, D = 86400

function village(v, hallLvl, timers) {
  const hall = g.halls[v]
  const allowed = {}
  for (let i = 0; i < hallLvl; i++) for (const [id, q] of Object.entries(hall.unlocks[i])) allowed[id] = (allowed[id] ?? 0) + q
  for (let i = 0; i < hallLvl; i++) for (const id of Object.keys(hall.merges[i])) allowed[id] = Math.max(0, (allowed[id] ?? 0) - 1)
  const buildings = [{ data: hall.id, lvl: hallLvl, cnt: 1 }], traps = []
  for (const [id, q] of Object.entries(allowed)) {
    const e = g.buildings[id] ?? g.traps[id]
    if (!e || !q || e.v !== v || +id === hall.id) continue
    const out = g.traps[id] ? traps : buildings
    const max = maxFor(e.L, hallLvl)
    if (!e.L.length) { out.push({ data: +id, lvl: 1, cnt: q }); continue }
    if (max === 0 || Object.keys(e.merge ?? {}).length) continue
    const byLvl = {}
    if (e.t === 'Wall') { const a = Math.round(q * 0.55), b = Math.round(q * 0.35); byLvl[max - 2] = a; byLvl[max - 1] = b; byLvl[max] = q - a - b }
    else for (let i = 0; i < q; i++) { const l = Math.max(1, max - (rnd() < 0.45 ? 0 : 1 + pick(2))); byLvl[l] = (byLvl[l] ?? 0) + 1 }
    for (const [l, c] of Object.entries(byLvl)) {
      if (c <= 0) continue
      // peel one instance off as a running upgrade
      if (timers.length && +l < max && e.t !== 'Wall' && e.L[+l][1] > 0 && rnd() < 0.5) {
        out.unshift({ data: +id, lvl: +l, timer: Math.round(e.L[+l][1] * timers.shift()) })
        if (c > 1) out.push({ data: +id, lvl: +l, cnt: c - 1 })
      } else out.push({ data: +id, lvl: +l, cnt: c })
    }
  }
  return { buildings, traps }
}
const levelled = (table, pred, hall, i = 2) => Object.entries(table).filter(([, e]) => pred(e) && maxFor(e.L, hall, i) > 0).map(([id, e]) => ({ data: +id, lvl: Math.max(1, maxFor(e.L, hall, i) - pick(4)) }))

const TH = 13, BH = 8
const home = village('home', TH, [0.15, 0.4, 0.62, 0.85])
const bb = village('builder', BH, [0.5])
const units = levelled(g.units, (e) => e.v === 'home' && e.c !== 'siege', TH)
units[5].timer = 2 * D + 5 * H
const heroes = levelled(g.heroes, (e) => e.v === 'home', TH).map((h) => ({ ...h, lvl: Math.max(1, h.lvl - pick(12)) }))
heroes[1].timer = 1 * D + 9 * H
const demo = {
  tag: '#DEMO', timestamp: 0,
  helpers: Object.keys(g.helpers).slice(0, 2).map((id, i) => ({ data: +id, lvl: 2 + i, ...(i === 0 ? { helper_cooldown: 9 * H } : {}) })),
  guardians: [], ...home, decos: [], obstacles: [],
  units, siege_machines: levelled(g.units, (e) => e.c === 'siege', TH), heroes,
  spells: levelled(g.spells, () => true, TH), pets: [],
  equipment: Object.entries(g.equipment).filter(([, e]) => maxFor(e.L, TH, 3) > 0 && heroes.some((h) => g.heroes[h.data].n === e.hero)).filter(() => rnd() < 0.7).map(([id, e]) => ({ data: +id, lvl: 1 + pick(maxFor(e.L, TH, 3)) })),
  buildings2: bb.buildings, traps2: bb.traps,
  units2: levelled(g.units, (e) => e.v === 'builder', BH), heroes2: levelled(g.heroes, (e) => e.v === 'builder', BH),
}
fs.writeFileSync(path.join(root, 'src/data/demo.json'), JSON.stringify(demo))
console.log(`demo.json: TH${TH}, ${home.buildings.length} building rows, ${units.length} troops, ${heroes.length} heroes, ${demo.equipment.length} equipment`)
