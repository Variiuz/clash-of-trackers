import { useSyncExternalStore } from 'react'
import type { Export } from './model'

/** Everything lives in this browser's localStorage. Nothing is uploaded anywhere. */
export interface Account { tag: string; name: string; snapshots: Export[] }
interface State { accounts: Record<string, Account>; current: string | null; /** opt-in: send tags to the ClashKing API for name, clan and league */ lookup?: boolean; /** which village is on screen */ mode?: 'home' | 'builder' }

const KEY = 'clash-tracker:v1'
const MAX_SNAPSHOTS = 25
let state: State = load()
const subs = new Set<() => void>()

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s && typeof s === 'object' && s.accounts) return s
  } catch { /* fresh start */ }
  return { accounts: {}, current: null }
}
function set(next: State) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full or blocked: keep working in memory */ }
  mirror('put', state)
  subs.forEach((f) => f())
}

// A second copy in IndexedDB. Browsers sometimes drop one store and not the other, so whichever survives restores the page.
function mirror(op: 'get'): Promise<State | null>
function mirror(op: 'put', value: State): Promise<null>
function mirror(op: 'get' | 'put', value?: State): Promise<State | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('clash-tracker', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('kv')
      open.onerror = () => resolve(null)
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('kv', op === 'put' ? 'readwrite' : 'readonly')
          const req = op === 'put' ? tx.objectStore('kv').put(value, 'state') : tx.objectStore('kv').get('state')
          req.onsuccess = () => resolve(op === 'get' ? (req.result ?? null) : null)
          req.onerror = () => resolve(null)
        } catch { resolve(null) }
      }
    } catch { resolve(null) }
  })
}
const hasVillages = (s: State | null): s is State => !!s && typeof s === 'object' && !!s.accounts && Object.keys(s.accounts).length > 0
// on start: bring villages back from the mirror if the main store lost them, otherwise make sure the mirror is current
mirror('get').then((saved) => {
  if (!hasVillages(state) && hasVillages(saved)) set({ ...saved, current: saved.current && saved.accounts[saved.current] ? saved.current : Object.keys(saved.accounts)[0] })
  else if (hasVillages(state)) mirror('put', state)
})
/** Ask the browser not to evict this site's data when it is short on space. */
const keep = () => { try { void navigator.storage?.persist?.() } catch { /* not supported */ } }
export function useStore(): State {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
}
export function importExport(x: Export) {
  keep()
  const prev = state.accounts[x.tag]
  const snaps = (prev?.snapshots ?? []).filter((s) => s.timestamp !== x.timestamp)
  snaps.push(x)
  snaps.sort((a, b) => a.timestamp - b.timestamp)
  set({ ...state, current: x.tag, accounts: { ...state.accounts, [x.tag]: { tag: x.tag, name: prev?.name ?? '', snapshots: snaps.slice(-MAX_SNAPSHOTS) } } })
}
export const setLookup = (on: boolean) => set({ ...state, lookup: on })
export const setMode = (mode: 'home' | 'builder') => set({ ...state, mode })
/** Everything this browser holds, for moving to another browser or device. */
export const backup = () => JSON.stringify({ clashTrackerBackup: 1, accounts: state.accounts })
export function restore(accounts: Record<string, Account>) {
  const merged = { ...state.accounts }
  for (const a of Object.values(accounts)) {
    if (!a?.tag || !Array.isArray(a.snapshots) || !a.snapshots.length) continue
    const have = merged[a.tag]?.snapshots ?? []
    const all = [...have, ...a.snapshots.filter((s) => !have.some((h) => h.timestamp === s.timestamp))].sort((x, y) => x.timestamp - y.timestamp)
    merged[a.tag] = { tag: a.tag, name: merged[a.tag]?.name || a.name || '', snapshots: all.slice(-MAX_SNAPSHOTS) }
  }
  set({ ...state, accounts: merged, current: state.current ?? Object.keys(merged)[0] ?? null })
}
export const select = (tag: string | null) => set({ ...state, current: tag })
export function rename(tag: string, name: string) {
  const a = state.accounts[tag]
  if (a) set({ ...state, accounts: { ...state.accounts, [tag]: { ...a, name } } })
}
export function remove(tag: string) {
  const { [tag]: _gone, ...rest } = state.accounts
  set({ ...state, accounts: rest, current: Object.keys(rest)[0] ?? null })
}
