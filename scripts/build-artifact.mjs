#!/usr/bin/env node
// Builds a single-page variant for publishing as a Claude artifact:
// dist-artifact/page.html (CSS + JS inlined) and dist-artifact/packs/* (images bundled into a few base64 JSON packs).
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'dist-artifact')
fs.rmSync(out, { recursive: true, force: true })
execSync('npx vite build --outDir dist-artifact/site', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_PACKED: '1' } })

const A = path.join(root, 'public/assets')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const groupOf = (rel) => (rel.startsWith('buildings/home-village/') ? 'home' : rel.startsWith('buildings/builder-base/') ? 'builder' : rel.startsWith('buildings/') || rel.startsWith('traps/') ? 'traps' : 'icons')
const groups = {}
for (const f of walk(A)) {
  const rel = path.relative(A, f).split(path.sep).join('/')
  if (!rel.endsWith('.webp')) continue
  ;(groups[groupOf(rel)] ??= []).push(rel)
}
fs.mkdirSync(path.join(out, 'packs'), { recursive: true })
const index = { packs: [], files: {} }
for (const [name, rels] of Object.entries(groups)) {
  const p = index.packs.push(`${name}.json`) - 1
  const pack = {}
  for (const rel of rels.sort()) { pack[rel] = fs.readFileSync(path.join(A, rel)).toString('base64'); index.files[rel] = p }
  fs.writeFileSync(path.join(out, 'packs', `${name}.json`), JSON.stringify(pack))
  console.log(`packs/${name}.json  ${rels.length} images  ${(fs.statSync(path.join(out, 'packs', `${name}.json`)).size / 1e6).toFixed(1)} MB`)
}
fs.writeFileSync(path.join(out, 'packs/index.json'), JSON.stringify(index))

const dir = path.join(out, 'site/assets')
const pick = (ext) => fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(ext))), 'utf8')
const font = fs.readFileSync(path.join(A, 'fonts/SCmagic.ttf')).toString('base64')
const css = pick('.css').replace(/url\([^)]*SCmagic\.ttf[^)]*\)/, `url(data:font/ttf;base64,${font})`)
const js = pick('.js').replaceAll('</script', '<\\/script')
fs.writeFileSync(path.join(out, 'page.html'), `<title>Clash Tracker</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>\n<div id="root"></div>\n<script type="module">${js}</script>\n`)
fs.rmSync(path.join(out, 'site'), { recursive: true })
console.log(`page.html ${(fs.statSync(path.join(out, 'page.html')).size / 1e3).toFixed(0)} KB`)
