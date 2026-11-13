#!/usr/bin/env node
// Bakes game data + images from the community ClashKingAssets repo into this project.
// Usage: node scripts/build-data.mjs [path-to-ClashKingAssets-checkout]
// Without an argument the repo is cloned (sparse) into .cache/ClashKingAssets.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let src = process.argv[2]
if (!src) {
  src = path.join(root, '.cache/ClashKingAssets')
  const dirs = ['static_data.json', 'buildings/', 'traps/', 'troops/', 'spells/', 'heroes/', 'pets/', 'equipment/', 'helpers/', 'guardians/', 'resources/', 'fonts/SCmagic.ttf']
  if (!fs.existsSync(src)) {
    execSync(`git clone --depth 1 --filter=blob:none --no-checkout https://github.com/ClashKingInc/ClashKingAssets "${src}"`, { stdio: 'inherit' })
  } else execSync('git fetch --depth 1 origin main && git reset -q --soft FETCH_HEAD', { cwd: src, stdio: 'inherit' })
  execSync(`git sparse-checkout set --no-cone ${dirs.map((d) => `'/assets/${d}'`).join(' ')} && git checkout -q -f FETCH_HEAD 2>/dev/null || git checkout -q -f`, { cwd: src, stdio: 'inherit' })
}
const A = path.join(src, 'assets')
const OUT = path.join(root, 'public/assets')
const d = JSON.parse(fs.readFileSync(path.join(A, 'static_data.json'), 'utf8'))

const clean = (s) => s.toLowerCase().replaceAll(' ', '_').replace(/[.?’]/g, '').replaceAll('\\q', '')
const missing = []
let copied = 0
function copy(rel) {
  const from = path.join(A, rel)
  if (!fs.existsSync(from)) return false
  const to = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  copied++
  return true
}
/** copies a `level_N.webp` directory, returns { img: dir, lv: [levels available] } */
function levelDir(rel, label) {
  const dir = path.join(A, rel)
  if (!fs.existsSync(dir)) { missing.push(label); return {} }
  const lv = fs.readdirSync(dir).map((f) => /^level_(\d+)\.webp$/.exec(f)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b)
  lv.forEach((l) => copy(`${rel}/level_${l}.webp`))
  return lv.length ? { img: rel, lv } : {}
}
function icon(rel, label) {
  if (copy(rel)) return { img: rel }
  missing.push(label)
  return {}
}
const vdir = (v) => (v === 'home' ? 'home-village' : 'builder-base')
const vil = (v) => (v === 'home' ? 'home' : 'builder')
const num = (x) => (typeof x === 'number' ? x : 0)
// [cost, seconds, required hall level]
const bl = (l) => [num(l.build_cost), num(l.build_time), num(l.required_townhall)]
const ul = (l) => [num(l.upgrade_cost), num(l.upgrade_time), num(l.required_townhall)]

const out = { generated: new Date().toISOString().slice(0, 10), buildings: {}, traps: {}, units: {}, spells: {}, heroes: {}, pets: {}, equipment: {}, guardians: {}, helpers: {}, crafted: {}, modules: {}, halls: {} }

for (const b of d.buildings) {
  const e = { n: b.name, t: b.type, v: vil(b.village), r: b.upgrade_resource, lv: [], L: b.levels.map(bl), ...levelDir(`buildings/${vdir(b.village)}/${clean(b.name)}`, `building ${b.name}`) }
  const sc = {}
  const merge = {}
  b.levels.forEach((l) => {
    if (l.supercharge) sc[l.level] = { th: l.supercharge.required_townhall, r: l.supercharge.upgrade_resource, L: l.supercharge.levels.map((s) => [num(s.build_cost), num(s.build_time)]) }
    if (l.alt_upgrade_resource) e.r2 = l.alt_upgrade_resource
    if (l.merge_requirement && b.type !== 'Town Hall' && l.level === 1) for (const m of l.merge_requirement) merge[m._id] = (merge[m._id] || 0) + 1
  })
  if (Object.keys(sc).length) e.sc = sc
  if (Object.keys(merge).length) e.merge = merge
  if (b.gear_up) e.gear = true
  out.buildings[b._id] = e

  if (b.type === 'Town Hall' || b.name === 'Builder Hall') {
    const hall = { id: b._id, max: b.levels.length, unlocks: [], merges: [], weapons: {} }
    b.levels.forEach((l) => {
      hall.unlocks.push(Object.fromEntries((l.unlocks || []).map((u) => [u._id, u.quantity])))
      hall.merges.push(Object.fromEntries((l.merge_requirement || []).map((m) => [m._id, 1])))
      if (l.weapon) hall.weapons[l.level] = { n: l.weapon.name, r: l.weapon.upgrade_resource, L: l.weapon.levels.map((w) => [num(w.build_cost), num(w.build_time)]) }
    })
    out.halls[vil(b.village)] = hall
  }
  for (const s of b.seasonal_defenses || []) {
    out.crafted[s._id] = { n: s.name, ...levelDir(`buildings/seasonal-defense/${clean(s.name)}`, `crafted ${s.name}`), m: s.modules.map((m) => m._id) }
    for (const m of s.modules) out.modules[m._id] = { n: m.name.replace(s.name + ' ', ''), r: m.upgrade_resource, L: m.levels.map(bl) }
  }
}
for (const t of d.traps) out.traps[t._id] = { n: t.name, t: 'Trap', v: vil(t.village), r: t.upgrade_resource, lv: [], L: t.levels.map(bl), ...levelDir(`traps/${vdir(t.village)}/${clean(t.name)}`, `trap ${t.name}`) }
for (const t of d.troops) {
  if (t.super_troop || t.is_seasonal) continue
  const c = t.village !== 'home' ? 'troop' : t.production_building === 'Workshop' ? 'siege' : t.production_building === 'Dark Barracks' ? 'dark' : 'troop'
  out.units[t._id] = { n: t.name, v: vil(t.village), r: t.upgrade_resource, c, L: t.levels.map(ul), ...icon(`troops/${clean(t.name)}/icon.webp`, `troop ${t.name}`) }
}
for (const s of d.spells) {
  if (s.is_seasonal) continue
  out.spells[s._id] = { n: s.name, v: 'home', r: s.upgrade_resource, c: s.production_building === 'Dark Spell Factory' ? 'dark' : 'spell', L: s.levels.map(ul), ...icon(`spells/${clean(s.name)}.webp`, `spell ${s.name}`) }
}
for (const h of d.heroes) out.heroes[h._id] = { n: h.name, v: vil(h.village), r: h.upgrade_resource, L: h.levels.map(ul), ...icon(`heroes/${clean(h.name)}/icon.webp`, `hero ${h.name}`) }
for (const p of d.pets) out.pets[p._id] = { n: p.name, v: 'home', r: p.upgrade_resource, L: p.levels.map(ul), ...icon(`pets/${clean(p.name)}/icon.webp`, `pet ${p.name}`) }
for (const g of d.guardians) out.guardians[g._id] = { n: g.name, v: 'home', r: g.upgrade_resource, L: g.levels.map(ul), ...icon(`guardians/${clean(g.name)}/icon.webp`, `guardian ${g.name}`) }
for (const h of d.helpers) out.helpers[h._id] = { n: h.name, v: 'home', r: h.upgrade_resource, L: h.levels.map((l) => [num(l.upgrade_cost), 0, num(l.required_townhall)]), ...icon(`helpers/${clean(h.name)}.webp`, `helper ${h.name}`) }
for (const q of d.equipment) {
  out.equipment[q._id] = { n: q.name, hero: q.hero, epic: q.rarity === 'Epic', L: q.levels.map((l) => [num(l.upgrade_cost?.shiny_ore), num(l.upgrade_cost?.glowy_ore), num(l.upgrade_cost?.starry_ore), num(l.required_townhall)]), ...icon(`equipment/${clean(q.name)}.webp`, `equipment ${q.name}`) }
}
for (const r of ['gold', 'elixir', 'dark_elixir', 'builder_gold', 'builder_elixir', 'gems', 'shiny_ore', 'glowy_ore', 'starry_ore']) icon(`resources/${r}.webp`, `resource ${r}`)
copy('fonts/SCmagic.ttf')

fs.writeFileSync(path.join(root, 'src/data/game.json'), JSON.stringify(out))
console.log(`game.json written (${(fs.statSync(path.join(root, 'src/data/game.json')).size / 1024).toFixed(0)} KB), ${copied} files copied`)
if (missing.length) console.log(`no image for: ${missing.join(', ')}`)
