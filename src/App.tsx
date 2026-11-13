import { useEffect, useMemo, useState } from 'react'
import { asset, entImage, game } from './lib/game'
import { buildVillage, type Cat } from './lib/model'
import { remove, rename, select, setLookup, setMode, useStore } from './lib/store'
import { ago } from './lib/format'
import { Img, Modal, useNow, Win } from './components/bits'
import { ImportPanel } from './components/Import'
import { Overview } from './components/Overview'
import { Items } from './components/Items'
import { Planner } from './components/Planner'
import { HeroHall } from './components/HeroHall'
import { COOLDOWN_MS, useProfile } from './lib/profile'

const TABS = [['overview', 'Overview'], ['village', 'Village'], ['army', 'Army'], ['heroes', 'Heroes'], ['planner', 'Planner']] as const
type Tab = (typeof TABS)[number][0]
const HOME_CATS: Cat[] = ['townhall', 'defenses', 'traps', 'army', 'resources', 'other', 'crafted', 'walls']
const ARMY_CATS: Cat[] = ['troops', 'darktroops', 'spells', 'sieges', 'pets']
const BB_ARMY: Cat[] = ['heroes', 'troops']
const readTab = (): Tab => (TABS.some(([t]) => t === location.hash.slice(1)) ? (location.hash.slice(1) as Tab) : 'overview')

export default function App() {
  const store = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>(readTab)
  const [importing, setImporting] = useState(false)
  const [removing, setRemoving] = useState(false)
  useEffect(() => { const h = () => setTab(readTab()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const go = (t: string) => { location.hash = t; window.scrollTo({ top: 0 }) }

  const account = store.current ? store.accounts[store.current] : undefined
  const latest = account?.snapshots[account.snapshots.length - 1]
  const v = useMemo(() => (latest ? buildVillage(latest) : null), [latest])
  const accounts = Object.values(store.accounts)
  const vid = v && v.bh > 0 && store.mode === 'builder' ? 'builder' : 'home'
  const hallOf = (x: { th: number; bh: number }, m: 'home' | 'builder') => entImage(game.buildings[game.halls[m].id], m === 'home' ? x.th : x.bh)
  useEffect(() => { document.documentElement.dataset.village = v ? vid : 'home' }, [vid, v])
  const shownTab: Tab = vid === 'builder' && tab === 'heroes' ? 'army' : tab
  const mine = v ? v.items.filter((i) => i.village === vid) : []
  const live = useProfile(account?.tag, !!store.lookup)
  const wait = live.fetchedAt + COOLDOWN_MS - now

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#overview"><Img src={asset('buildings/home-village/town_hall/level_18.webp')} alt="" /><span>Clash <em>Tracker</em></span></a>
        {v && account && (
          <div className="top-actions">
            <button className="btn primary" onClick={() => setImporting(true)}>Import / update</button>
          </div>
        )}
      </header>

      {!v || !account ? (
        <main className="landing">
          <div className="landing-copy">
            <h1>Clash of Clans<br />progress tracker</h1>
            <div className="strip">
              {[18, 16, 14, 12, 10, 8].map((l) => <Img key={l} src={entImage(game.buildings[game.halls.home.id], l)} alt={`Town Hall ${l}`} />)}
            </div>
          </div>
          <Win title="Import your village"><ImportPanel /></Win>
        </main>
      ) : (
        <>
          <nav className="villages" aria-label="Villages">
            {accounts.map((a) => {
              const x = a.snapshots[a.snapshots.length - 1]
              const th = Math.max(1, ...((x.buildings as { data: number; lvl?: number }[]) ?? []).filter((b) => b.data === game.halls.home.id).map((b) => b.lvl ?? 1))
              return (
                <button key={a.tag} className={`vchip ${a.tag === account.tag ? 'on' : ''}`} onClick={() => select(a.tag)} aria-pressed={a.tag === account.tag}>
                  <Img src={entImage(game.buildings[game.halls.home.id], th)} alt="" /><span><b>{a.name || (a.tag === account.tag && live.profile?.name) || a.tag}</b><small>TH{th}</small></span>
                </button>
              )
            })}
            <button className="vchip add" onClick={() => setImporting(true)}>+ Add village</button>
          </nav>
          <section className="village">
            <Img className="th" src={hallOf(v, vid)} alt={vid === 'home' ? `Town Hall ${v.th}` : `Builder Hall ${v.bh}`} />
            <div className="grow">
              <div className="eyebrow">{account.tag} · {vid === 'home' ? `Town Hall ${v.th}` : `Builder Hall ${v.bh}`} · exported {ago(v.timestamp, now)}</div>
              <h1>
                <input className="name" value={account.name} placeholder={live.profile?.name ?? (vid === 'home' ? `Town Hall ${v.th}` : `Builder Hall ${v.bh}`)} onChange={(e) => rename(account.tag, e.target.value)} aria-label="Village name" maxLength={30} />
              </h1>
              <div className="chips">
                {live.profile?.clan && <span className="chip clan">{live.profile.clan.badge && <img src={live.profile.clan.badge} alt="" onError={(e) => { e.currentTarget.hidden = true }} />}{live.profile.clan.name ?? live.profile.clan.tag}</span>}
                {live.profile?.league && <span className="chip">{live.profile.league}</span>}
                {live.available && !store.lookup && <button className="chip chip-btn" onClick={() => setLookup(true)} title="Sends your player tag to the ClashKing API">Look up name and clan</button>}
                {live.available && store.lookup && (
                  <>
                    <button className="chip chip-btn" disabled={live.loading || wait > 0} onClick={live.refresh}>
                      {live.loading ? 'Loading profile' : live.error && !live.profile ? 'Profile unavailable, retry' : wait > 0 ? `Profile refresh in ${Math.ceil(wait / 60000)}m` : 'Refresh profile'}
                    </button>
                    <button className="chip chip-btn" onClick={() => setLookup(false)}>Lookup off</button>
                  </>
                )}
                {v.unknown > 0 && <span className="chip warn" title="These items are newer than this site's game data and are not shown.">{v.unknown} unknown items</span>}
              </div>
            </div>
            <div className="village-side">
              {v.bh > 0 && (
                <div className="boat" role="group" aria-label="Village">
                  <button className={vid === 'home' ? 'on' : ''} onClick={() => setMode('home')} aria-pressed={vid === 'home'}><Img src={hallOf(v, 'home')} alt="" />Home</button>
                  <button className={vid === 'builder' ? 'on' : ''} onClick={() => setMode('builder')} aria-pressed={vid === 'builder'}><Img src={hallOf(v, 'builder')} alt="" />Builder Base</button>
                </div>
              )}
              {removing ? (
                <span className="confirm">Remove this village?
                  <button className="btn danger" onClick={() => { setRemoving(false); remove(account.tag) }}>Yes</button>
                  <button className="btn" onClick={() => setRemoving(false)}>Keep</button>
                </span>
              ) : <button className="link small" onClick={() => setRemoving(true)}>Remove village</button>}
            </div>
          </section>
          <nav className="tabs" aria-label="Sections">
            {TABS.filter(([t]) => t !== 'heroes' || vid === 'home').map(([t, l]) => <a key={t} href={`#${t}`} className={shownTab === t ? 'on' : ''} aria-current={shownTab === t ? 'page' : undefined}>{l}</a>)}
          </nav>
          <main>
            {shownTab === 'overview' && <Overview key={vid} v={v} vid={vid} account={account} now={now} go={go} />}
            {shownTab === 'village' && <Items key={'v' + vid} map now={now} cats={HOME_CATS} items={mine} />}
            {shownTab === 'army' && <Items key={'a' + vid} now={now} cats={vid === 'home' ? ARMY_CATS : BB_ARMY} items={mine} />}
            {shownTab === 'heroes' && <HeroHall now={now} items={mine} />}
            {shownTab === 'planner' && <Planner key={vid} v={v} now={now} village={vid} />}
          </main>
        </>
      )}

      <footer>
        <p>A fun little side project, made with Claude. Free, no ads, no payments. Game data as of {game.generated}.</p>
        <p>This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: <a href="https://www.supercell.com/fan-content-policy" target="_blank" rel="noreferrer">www.supercell.com/fan-content-policy</a>. Clash of Clans and all related artwork are trademarks and property of Supercell Oy.</p>
        <p>Data and images: <a href="https://github.com/ClashKingInc/ClashKingAssets" target="_blank" rel="noreferrer">ClashKing Assets</a>. Player profiles: <a href="https://api.clashk.ing" target="_blank" rel="noreferrer">ClashKing API</a> (Creator Code: ClashKing).</p>
      </footer>

      {importing && <Modal onClose={() => setImporting(false)} wide title="Import or update"><ImportPanel compact onDone={() => { setImporting(false); go('overview') }} /></Modal>}
    </div>
  )
}
