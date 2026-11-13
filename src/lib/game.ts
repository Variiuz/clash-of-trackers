import raw from '../data/game.json'

export type VillageId = 'home' | 'builder'

/** Static entity as baked by scripts/build-data.mjs */
export interface Ent {
  n: string
  t?: string
  v?: VillageId
  r?: string
  r2?: string
  c?: string
  /** per level: [cost, seconds, required hall] (equipment: [shiny, glowy, starry, required hall]) */
  L: number[][]
  img?: string
  /** levels that have their own image */
  lv?: number[]
  sc?: Record<string, { th: number; r: string; L: number[][] }>
  merge?: Record<string, number>
  gear?: boolean
  hero?: string
  epic?: boolean
  m?: number[]
}
export interface Hall {
  id: number
  max: number
  unlocks: Record<string, number>[]
  merges: Record<string, number>[]
  weapons: Record<string, { n: string; r: string; L: number[][] }>
}
type Table = Record<string, Ent>
export interface Game {
  generated: string
  buildings: Table
  traps: Table
  units: Table
  spells: Table
  heroes: Table
  pets: Table
  equipment: Table
  guardians: Table
  helpers: Table
  crafted: Table
  modules: Table
  halls: Record<VillageId, Hall>
}
export const game = raw as unknown as Game

const BASE = import.meta.env.BASE_URL + 'assets/'
export const asset = (rel: string) => BASE + rel

/** Image for an entity at a level: exact level art if we have it, else the closest lower one. */
export function entImage(e: Ent | undefined, lvl: number): string | null {
  if (!e?.img) return null
  if (!e.lv?.length) return asset(e.img)
  let pick = e.lv[0]
  for (const l of e.lv) if (l <= Math.max(lvl, 1)) pick = l
  return asset(`${e.img}/level_${pick}.webp`)
}

export const RES_ICON: Record<string, string> = {
  Gold: 'gold', Elixir: 'elixir', 'Dark Elixir': 'dark_elixir', 'Builder Gold': 'builder_gold', 'Builder Elixir': 'builder_elixir',
  Gems: 'gems', 'Shiny Ore': 'shiny_ore', 'Glowy Ore': 'glowy_ore', 'Starry Ore': 'starry_ore',
}
export const RES_ORDER = Object.keys(RES_ICON)
export const resIcon = (r: string) => asset(`resources/${RES_ICON[r] ?? 'gold'}.webp`)
