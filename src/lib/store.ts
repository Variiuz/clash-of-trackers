import { useSyncExternalStore } from 'react'
import type { Export } from './model'

/** Everything lives in this browser's localStorage. Nothing is uploaded anywhere. */
export interface Account { tag: string; name: string; snapshots: Export[] }
interface State { accounts: Record<string, Account>; current: string | null; /** opt-in: send tags to the ClashKing API for name, clan and league */ lookup?: boolean }

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
  subs.forEach((f) => f())
}
export function useStore(): State {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
}
export function importExport(x: Export) {
  const prev = state.accounts[x.tag]
  const snaps = (prev?.snapshots ?? []).filter((s) => s.timestamp !== x.timestamp)
  snaps.push(x)
  snaps.sort((a, b) => a.timestamp - b.timestamp)
  set({ ...state, current: x.tag, accounts: { ...state.accounts, [x.tag]: { tag: x.tag, name: prev?.name ?? '', snapshots: snaps.slice(-MAX_SNAPSHOTS) } } })
}
export const setLookup = (on: boolean) => set({ ...state, lookup: on })
export const select = (tag: string | null) => set({ ...state, current: tag })
export function rename(tag: string, name: string) {
  const a = state.accounts[tag]
  if (a) set({ ...state, accounts: { ...state.accounts, [tag]: { ...a, name } } })
}
export function remove(tag: string) {
  const { [tag]: _gone, ...rest } = state.accounts
  set({ ...state, accounts: rest, current: Object.keys(rest)[0] ?? null })
}
