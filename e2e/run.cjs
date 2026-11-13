#!/usr/bin/env node
// Browser smoke test: clicks every control on every tab in both villages and checks for errors,
// sideways overflow, layout shift when a modal opens, and hover side effects.
// Usage: npm run build && npx vite preview --port 4173 &   then   node e2e/run.cjs [url] [export.json]
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const URL = process.argv[2] || 'http://localhost:4173/'
const EXPORT = process.argv[3] || path.join(__dirname, '../src/data/demo.json')
const fails = [], notes = []
let checks = 0
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

;(async () => {
  // real scrollbars: the default hides them, which also hides the page jumping sideways when a modal locks scrolling
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    const p = await ctx.newPage()
    const errs = []
    p.on('console', (m) => m.type() === 'error' && !/api\.clashk\.ing|ERR_|Failed to load resource/.test(m.text()) && errs.push(m.text()))
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
    const T = (m) => `[${vp.name}] ${m}`
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const brandX = () => p.evaluate(() => document.querySelector('.brand').getBoundingClientRect().x)
    const closeModal = async (how) => {
      if (how === 'esc') await p.keyboard.press('Escape')
      else if (how === 'x') await p.click('.modal .x')
      else await p.mouse.click(3, 3)
      await p.waitForSelector('.modal', { state: 'detached', timeout: 2000 }).catch(() => {})
      return (await p.$('.modal')) === null
    }
    /** opening a modal must not move the page sideways or leave it scrolled */
    const modalCheck = async (label, how = 'esc') => {
      const x0 = modalCheck.x0, y0 = await p.evaluate(() => scrollY)
      ok(!!(await p.$('.modal')), T(`${label}: no modal opened`))
      ok(Math.abs((await brandX()) - x0) < 0.5, T(`${label}: page shifted sideways by ${((await brandX()) - x0).toFixed(1)}px while modal open`))
      ok((await overflow()) <= 0, T(`${label}: sideways overflow with modal open`))
      const box = await p.$eval('.modal', (m) => { const r = m.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, innerWidth, innerHeight] })
      ok(box[0] >= 0 && box[1] <= box[4] + 0.5 && box[2] >= 0 && box[3] <= box[5] + 0.5, T(`${label}: modal not fully on screen ${box.map(Math.round)}`))
      ok(await closeModal(how), T(`${label}: modal did not close via ${how}`))
      ok(Math.abs((await brandX()) - x0) < 0.5, T(`${label}: page did not return after modal closed`))
      ok(Math.abs((await p.evaluate(() => scrollY)) - y0) < 2, T(`${label}: scroll position jumped after modal`))
    }

    // ---------- landing ----------
    await p.goto(URL); await p.waitForSelector('.landing')
    ok(await p.isDisabled('text=Import village'), T('Import button should be disabled with an empty box'))
    await p.fill('textarea', '{not json'); await p.click('text=Import village')
    ok(await p.isVisible('.error'), T('invalid JSON shows no error'))
    await p.fill('textarea', '{"hello":1}'); await p.click('text=Import village')
    ok((await p.textContent('.error')).includes('does not look like'), T('wrong JSON shape shows no error'))
    ok((await overflow()) <= 0, T('landing overflows sideways'))
    await p.click('text=Try the demo village'); await p.waitForSelector('.tabs')
    ok((await p.$$('.vchip:not(.add)')).length === 1, T('demo village not listed'))

    // second village from a file, through the modal
    const raw = JSON.parse(fs.readFileSync(EXPORT, 'utf8')); raw.tag = '#E2ETEST'; raw.timestamp = Math.floor(Date.now() / 1000)
    modalCheck.x0 = await brandX()
    await p.click('text=+ Add village'); await p.waitForSelector('.modal')
    await modalCheck('add-village modal (esc)', 'esc')
    await p.click('text=Import / update'); await modalCheck('import modal (x)', 'x')
    await p.click('text=Import / update'); await modalCheck('import modal (backdrop)', 'backdrop')
    await p.click('text=Import / update'); await p.click('.modal >> text=Copy backup'); await p.waitForTimeout(150)
    ok(/Backup copied/.test(await p.textContent('.modal')) || (await p.inputValue('.modal textarea')).includes('clashTrackerBackup'), T('Copy backup did nothing'))
    await p.fill('.modal textarea', JSON.stringify(raw)); await p.click('.modal >> text=Import village')
    await p.waitForSelector('.modal', { state: 'detached' })
    ok((await p.$$('.vchip:not(.add)')).length === 2, T('second village not added'))
    await p.click('.vchip >> nth=0'); ok(await p.$eval('.vchip >> nth=0', (e) => e.classList.contains('on')), T('village chip does not switch'))
    await p.click('.vchip >> nth=1')

    // name, remove/keep
    await p.fill('.name', 'My base'); ok((await p.textContent('.vchip.on')).includes('My base'), T('rename not reflected in the village chip'))
    await p.click('text=Remove village'); ok(await p.isVisible('.confirm'), T('remove has no confirmation'))
    await p.click('.confirm >> text=Keep'); ok((await p.$$('.vchip:not(.add)')).length === 2, T('Keep removed the village'))
    const lookup = await p.$('text=Look up name and clan')
    if (lookup) { await lookup.click(); await p.waitForTimeout(400); ok(await p.isVisible('text=Lookup off'), T('lookup opt-in shows no off switch')); await p.click('text=Lookup off'); ok(await p.isVisible('text=Look up name and clan'), T('lookup did not switch off')) }

    // ---------- every tab in both villages ----------
    const modes = (await p.$('.boat')) ? ['Home', 'Builder Base'] : ['Home']
    for (const mode of modes) {
      if (modes.length > 1) { await p.click(`.boat >> text=${mode}`); ok(await p.$eval(`.boat button.on`, (b, m) => b.textContent.includes(m), mode), T(`${mode} switch did not activate`)) }
      const tabs = await p.$$eval('.tabs a', (as) => as.map((a) => a.getAttribute('href')))
      for (const href of tabs) {
        const where = `${mode} ${href}`
        await p.click(`.tabs a[href="${href}"]`); await p.waitForTimeout(250)
        ok(await p.$eval(`.tabs a[href="${href}"]`, (a) => a.classList.contains('on')), T(`${where}: tab not marked active`))
        ok((await overflow()) <= 0, T(`${where}: sideways overflow ${await overflow()}px`))
        ok((await p.$$('main .noimg')).length === 0, T(`${where}: ${(await p.$$('main .noimg')).length} missing images`))
        const broken = await p.$$eval('main img', (is) => is.filter((i) => i.complete && !i.naturalWidth && i.src && !i.hidden).length)
        ok(broken === 0, T(`${where}: ${broken} broken images`))
        modalCheck.x0 = await brandX()

        // toolbar controls
        for (const view of ['Village', 'List']) { const b = await p.$(`main .seg >> text="${view}"`); if (b && href === '#village') { await b.click(); await p.waitForTimeout(150); ok((await overflow()) <= 0, T(`${where}: overflow in ${view} view`)); ok(view === 'List' || !!(await p.$('.map')), T(`${where}: map view did not render`)) } }
        if (href === '#village') {
          await p.click('main .seg >> text="Village"'); await p.waitForTimeout(150)
          const spots = await p.$$('.spot'); ok(spots.length > 0, T(`${where}: map has no buildings`))
          for (const k of [0, Math.floor(spots.length / 2), spots.length - 1]) { await spots[k].scrollIntoViewIfNeeded(); await spots[k].click({ force: true }); await modalCheck(`${where} map spot ${k}`, ['esc', 'x', 'backdrop'][k % 3]) }
          await p.click('main .seg >> text="List"')
        }
        const search = await p.$('main input[type=search]')
        if (search) {
          const n0 = (await p.$$('main .tile')).length
          await search.fill('zzzz-nothing'); ok((await p.$$('main .tile')).length === 0, T(`${where}: search does not filter`))
          await search.fill(''); ok((await p.$$('main .tile')).length === n0, T(`${where}: clearing search does not restore`))
          await p.click('main .switch'); const n1 = (await p.$$('main .tile')).length; ok(n1 <= n0, T(`${where}: hide maxed added tiles`))
          ok((await p.$$('main .tile.maxed')).length === 0, T(`${where}: hide maxed leaves maxed tiles`)); await p.click('main .switch')
        }
        for (const sel of await p.$$('main select')) { const opts = await sel.$$eval('option', (o) => o.map((x) => x.value)); for (const v of opts) { await sel.selectOption(v); ok((await overflow()) <= 0, T(`${where}: overflow after select ${v}`)) } await sel.selectOption(opts[0]) }
        if (href === '#planner') {
          const nq = (await p.$$('main .toolbar .seg button')).length
          for (let q = 0; q < nq; q++) {
            const b = (await p.$$('main .toolbar .seg button'))[q]; const name = await b.textContent()
            await b.click(); await p.waitForTimeout(80)
            ok(await b.evaluate((x) => x.classList.contains('on')), T(`${where}: queue ${name} not activated`)); ok((await overflow()) <= 0, T(`${where}: overflow in queue ${name}`))
            const count = (await p.$$('main .plan-row')).length
            for (let k = 0; k < count; k++) { const el = (await p.$$('main .plan-row'))[k]; await el.scrollIntoViewIfNeeded(); await el.click(); await modalCheck(`${where} ${name} row #${k}`, ['esc', 'x', 'backdrop'][k % 3]) }
            notes.push(T(`${where}: queue ${name}, ${count} rows opened and closed`))
          }
        }

        // everything that opens a detail window
        for (const cls of ['.tile', '.site:not(.free)', '.altar-hero']) {
          const n = (await p.$$(`main ${cls}`)).length
          for (let k = 0; k < n; k++) {
            const el = (await p.$$(`main ${cls}`))[k]; if (!el) break
            await el.scrollIntoViewIfNeeded(); await el.click()
            await modalCheck(`${where} ${cls} #${k}`, ['esc', 'x', 'backdrop'][k % 3])
          }
          if (n) notes.push(T(`${where}: ${n} × ${cls} opened and closed`))
        }
        // navigation controls on the overview
        if (href === '#overview') {
          const n = (await p.$$('main .banner')).length
          for (let k = 0; k < n; k++) { await (await p.$$('main .banner'))[k].click(); await p.waitForTimeout(120); ok(!(await p.$('.banners')), T(`${where}: banner ${k} did not navigate`)); ok((await p.evaluate(() => scrollY)) === 0, T(`${where}: banner ${k} did not scroll to top`)); await p.click('.tabs a[href="#overview"]'); await p.waitForTimeout(120) }
          for (const sel of ['main .site.free', 'main .win .link']) { const b = await p.$(sel); if (b) { await b.click(); await p.waitForTimeout(120); ok(!!(await p.$('.tabs a.on[href="#planner"]')), T(`${where}: ${sel} did not open the planner`)); await p.click('.tabs a[href="#overview"]') } }
        }

        // hover: nothing may move its neighbours or widen the page
        for (const cls of ['.tile', '.site', '.banner', '.plan-row', '.altar-hero', '.vchip', '.btn', '.tabs a', '.boat button', '.spot']) {
          const els = await p.$$(cls)
          for (const el of els.slice(0, 2)) {
            if (!(await el.isVisible())) continue
            await el.scrollIntoViewIfNeeded()
            const sib = async () => el.evaluate((e) => { const s = e.nextElementSibling || e.previousElementSibling; const r = (s || e.parentElement).getBoundingClientRect(), o = e.parentElement.getBoundingClientRect(); return [r.x - o.x, r.y - o.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join() })
            await p.mouse.move(2, 2); await p.waitForTimeout(200) // let the previously hovered element settle
            const before = await sib(); await el.hover({ force: true }); await p.waitForTimeout(180)
            ok((await sib()) === before, T(`${where}: hovering ${cls} moved its neighbour`)); ok((await overflow()) <= 0, T(`${where}: hovering ${cls} widens the page`))
          }
        }
        await p.mouse.move(2, 2)
      }
    }

    // ---------- persistence ----------
    await p.reload(); await p.waitForSelector('.tabs')
    ok((await p.$$('.vchip:not(.add)')).length === 2, T('villages lost on reload'))
    ok((await p.inputValue('.name')) === 'My base', T('name lost on reload'))
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.tabs', { timeout: 4000 }).catch(() => {})
    ok((await p.$$('.vchip:not(.add)')).length === 2, T('villages not recovered after the main store was wiped'))
    await p.click('text=Remove village'); await p.click('.confirm >> text=Yes'); ok((await p.$$('.vchip:not(.add)')).length === 1, T('remove did not remove'))
    await p.click('text=Remove village'); await p.click('.confirm >> text=Yes'); ok(!!(await p.waitForSelector('.landing', { timeout: 2000 }).catch(() => null)), T('removing the last village does not return to the landing page'))
    ok(errs.length === 0, T(`console errors: ${[...new Set(errs)].slice(0, 5).join(' | ')}`))
    await ctx.close()
  }
  await browser.close()
  notes.forEach((n) => console.log('  ' + n))
  console.log(`\n${checks} checks, ${fails.length} failed`)
  ;[...new Set(fails)].slice(0, 60).forEach((f) => console.log('FAIL ' + f))
  process.exit(fails.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
