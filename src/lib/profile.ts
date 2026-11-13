import { useCallback, useEffect, useState } from 'react'
import { PACKED } from './game'

/** Public profile from the ClashKing API (no key, CORS-enabled). */
export interface Profile { name: string; townHallLevel?: number; league?: string; clan?: { name?: string; tag: string; badge?: string; level?: number } }
interface Cached { at: number; profile: Profile | null }

export const COOLDOWN_MS = 15 * 60 * 1000
const key = (tag: string) => `clash-tracker:profile:${tag}`
const read = (tag: string): Cached | null => { try { return JSON.parse(localStorage.getItem(key(tag)) ?? 'null') } catch { return null } }
const inflight = new Map<string, Promise<Cached>>()

async function fetchProfile(tag: string): Promise<Cached> {
  const r = await fetch(`https://api.clashk.ing/v2/player/search?query=${encodeURIComponent(tag)}&limit=5`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const hit = ((await r.json()).items ?? []).find((i: { tag?: string }) => i.tag?.toUpperCase() === tag.toUpperCase())
  const c: Cached = { at: Date.now(), profile: hit ? { name: hit.name, townHallLevel: hit.townHallLevel, league: hit.leagueTier?.name, clan: hit.clan ? { name: hit.clan.name, tag: hit.clan.tag, badge: hit.clan.badge, level: hit.clan.clanLevel } : undefined } : null }
  try { localStorage.setItem(key(tag), JSON.stringify(c)) } catch { /* cache is optional */ }
  return c
}

/** Loads the profile once per cooldown window; `refresh` does nothing until the window has passed. */
export function useProfile(tag: string | undefined) {
  const [state, setState] = useState<{ cached: Cached | null; loading: boolean; error: boolean }>({ cached: null, loading: false, error: false })
  const load = useCallback(() => {
    if (!tag || PACKED || tag === '#DEMO') return
    const cached = read(tag)
    if (cached && Date.now() - cached.at < COOLDOWN_MS) { setState({ cached, loading: false, error: false }); return }
    setState({ cached, loading: true, error: false })
    let p = inflight.get(tag)
    if (!p) { p = fetchProfile(tag).finally(() => inflight.delete(tag)); inflight.set(tag, p) }
    p.then((c) => setState({ cached: c, loading: false, error: false }), () => setState({ cached, loading: false, error: true }))
  }, [tag])
  useEffect(() => { setState({ cached: tag ? read(tag) : null, loading: false, error: false }); load() }, [tag, load])
  return { profile: state.cached?.profile ?? null, fetchedAt: state.cached?.at ?? 0, loading: state.loading, error: state.error, refresh: load, enabled: !!tag && !PACKED && tag !== '#DEMO' }
}
