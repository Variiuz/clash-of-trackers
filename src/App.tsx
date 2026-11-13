import { useEffect, useMemo, useState } from 'react'
import { asset, entImage, game } from './lib/game'
import { buildVillage, type Cat } from './lib/model'
import { remove, rename, select, setLookup, useStore } from './lib/store'
import { ago } from './lib/format'
import { Img, Modal, useNow, Win } from './components/bits'
import { ImportPanel } from './components/Import'
import { Overview } from './components/Overview'
import { Items } from './components/Items'
import { Planner } from './components/Planner'
import { COOLDOWN_MS, useProfile } from './lib/profile'

const TABS = [['overview', 'Overview'], ['home', 'Home Village'], ['army', 'Army'], ['heroes', 'Heroes'], ['builder', 'Builder Base'], ['planner', 'Planner']] as const
type Tab = (typeof TABS)[number][0]
const HOME_CATS: Cat[] = ['townhall', 'defenses', 'traps', 'army', 'resources', 'other', 'crafted', 'walls']
const ARMY_CATS: Cat[] = ['troops', 'darktroops', 'spells', 'sieges', 'pets']
const HERO_CATS: Cat[] = ['heroes', 'guardians', 'equipment']
const BB_CATS: Cat[] = ['townhall', 'heroes', 'troops', 'defenses', 'traps', 'army', 'resources', 'other', 'walls']
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
  const live = useProfile(account?.tag, !!store.lookup)
  const wait = live.fetchedAt + COOLDOWN_MS - now

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#overview"><Img src={asset('buildings/home-village/town_hall/level_18.webp')} alt="" /><span>Clash <em>Tracker</em></span></a>
        {v && account && (
          <div className="top-actions">
            {accounts.length > 1 && (
              <select value={account.tag} onChange={(e) => select(e.target.value)} aria-label="Switch village">
                {accounts.map((a) => <option key={a.tag} value={a.tag}>{a.name || a.tag}</option>)}
              </select>
            )}
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
          <section className="village">
            <Img className="th" src={entImage(game.buildings[game.halls.home.id], v.th)} alt={`Town Hall ${v.th}`} />
            <div className="grow">
              <div className="eyebrow">{account.tag} · Town Hall {v.th}{v.bh > 0 ? ` · Builder Hall ${v.bh}` : ''} · exported {ago(v.timestamp, now)}</div>
              <h1>
                <input className="name" value={account.name} placeholder={live.profile?.name ?? `Town Hall ${v.th}`} onChange={(e) => rename(account.tag, e.target.value)} aria-label="Village name" maxLength={30} />
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
            {removing ? (
              <span className="confirm">Remove this village and its snapshots?
                <button className="btn danger" onClick={() => { setRemoving(false); remove(account.tag) }}>Yes, remove</button>
                <button className="btn" onClick={() => setRemoving(false)}>Keep</button>
              </span>
            ) : <button className="btn ghost danger" onClick={() => setRemoving(true)}>Remove</button>}
          </section>
          <nav className="tabs" aria-label="Sections">
            {TABS.filter(([t]) => t !== 'builder' || v.bh > 0).map(([t, l]) => <a key={t} href={`#${t}`} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined}>{l}</a>)}
          </nav>
          <main>
            {tab === 'overview' && <Overview v={v} account={account} now={now} go={go} />}
            {tab === 'home' && <Items key="home" now={now} cats={HOME_CATS} items={v.items.filter((i) => i.village === 'home')} />}
            {tab === 'army' && <Items key="army" now={now} cats={ARMY_CATS} items={v.items.filter((i) => i.village === 'home')} />}
            {tab === 'heroes' && <Items key="heroes" now={now} cats={HERO_CATS} groupByHero items={v.items.filter((i) => i.village === 'home')} />}
            {tab === 'builder' && <Items key="bb" now={now} cats={BB_CATS} items={v.items.filter((i) => i.village === 'builder')} />}
            {tab === 'planner' && <Planner v={v} now={now} />}
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
