#!/usr/bin/env node
// ============================================================================
//  Poki QA: plays the game against a stand-in Poki SDK and checks Poki's rules
//  on the calls the game makes (the same rules the Poki Inspector looks at).
//
//    node tools/build.mjs && node tools/pokiqa.cjs          all scenarios
//    node tools/pokiqa.cjs --only adblock,gameover-ok        some of them
//    node tools/pokiqa.cjs --real                            + a boot with the real SDK
//    node tools/pokiqa.cjs --show                            a visible browser window
//
//  Needs Playwright (npm i -D playwright, or PLAYWRIGHT_PATH=<dir of node_modules/playwright>).
//  Serves the project itself on a free port, so no dev server has to run.
//
//  Two kinds of runs:
//   - "src" scenarios load index.html (the source files) with GAME_PLATFORM = 'poki', so a test can
//     reach the game's objects to finish a mission or lose every life on the spot;
//   - "dist" scenarios load dist/poki/index.html, the files that get uploaded, and only press keys.
//  Every run records the SDK calls in order; the rule checks run on that list.
// ============================================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude/skills/playwright/node_modules/playwright')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  console.error('Playwright not found. Install it (npm i -D playwright && npx playwright install chromium) or set PLAYWRIGHT_PATH.');
  process.exit(2);
}

// ---------------------------------------------------------------- a tiny static server
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
// the page a portal puts the game in: a long page with the game in an 836x470 iframe (Poki's desktop size)
const HOST = (src) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>host</title>
<style>body{margin:0;background:#83ffe7;font:16px sans-serif}#top{height:120px}#g{display:block;margin:0 auto;width:836px;height:470px;border:0}#pad{height:3000px}</style></head>
<body><div id="top">portal header</div><iframe id="g" src="${src}" allow="autoplay; fullscreen; gamepad"></iframe><div id="pad">more portal page below</div></body></html>`;
function serve() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__host') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(HOST(u.searchParams.get('src'))); return; }
    const file = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// ---------------------------------------------------------------- the stand-in SDK
// Behaves like PokiSDK v2 as the game uses it. window.__pokiMode (set before the page loads) says
// what the ads do: ad 'show' | 'none' (no fill) | 'hang' (never answers); reward true | false.
// Each call is stored with what the game was doing at that moment (scene, overlay, sim tick, muted).
const MOCK_SDK = `(() => {
  const mode = Object.assign({ ad: 'show', adMs: 900, reward: true, initReject: false, lang: 'en' }, window.__pokiMode || {});
  const P = window.__poki = { calls: [], mode };
  const g = (f) => { try { return f(); } catch (e) { return undefined; } };
  const peek = () => ({
    tick: g(() => App.tick), muted: g(() => Sound.adMuted), actx: g(() => Sound.ctx && Sound.ctx.state),
    scene: g(() => App.scene === PlayScene ? 'play' : App.scene === TitleScene ? 'title' : App.scene ? 'menu' : null),
    overlay: g(() => PlayScene.overlay === PauseOverlay ? 'pause' : PlayScene.overlay === CompleteOverlay ? 'complete' : PlayScene.overlay === GameOverOverlay ? 'gameover' : PlayScene.overlay ? 'other' : null),
    wstate: g(() => window.world && window.world.state),
  });
  const rec = (name, extra) => P.calls.push(Object.assign({ name, t: Math.round(performance.now()) }, peek(), extra || {}));
  const ad = (kind, onStart) => new Promise((resolve) => {
    if (mode.ad === 'none') { rec(kind + ':noad'); setTimeout(() => resolve(kind === 'rewardedBreak' ? false : undefined), 30); return; }
    if (mode.ad === 'hang') { rec(kind + ':hang'); return; }
    setTimeout(() => {
      try { if (onStart) onStart(); } catch (e) { rec('onStart-threw', { err: String(e) }); }
      rec(kind + ':adstart');
      const t0 = g(() => App.tick);
      setTimeout(() => {
        rec(kind + ':adend', { simStepsDuringAd: g(() => App.tick) - t0 });
        resolve(kind === 'rewardedBreak' ? !!mode.reward : undefined);
      }, mode.adMs);
    }, 60);
  });
  const fnOf = (a) => typeof a === 'function' ? a : a && a.onStart;
  window.PokiSDK = {
    init: () => { rec('init'); return mode.initReject ? Promise.reject(new Error('adblock')) : Promise.resolve(); },
    setDebug: () => rec('setDebug'), setLogging: () => {},
    gameLoadingStart: () => rec('gameLoadingStart'), gameLoadingProgress: () => {},
    gameLoadingFinished: () => rec('gameLoadingFinished'),
    gameplayStart: () => rec('gameplayStart'), gameplayStop: () => rec('gameplayStop'),
    commercialBreak: (a) => { rec('commercialBreak'); return ad('commercialBreak', fnOf(a)); },
    rewardedBreak: (a) => { rec('rewardedBreak', { size: a && a.size }); return ad('rewardedBreak', fnOf(a)); },
    happyTime: () => rec('happyTime'),
    measure: (...a) => rec('measure', { args: a.map(String).join(' | ') }),
    getLanguage: () => mode.lang, getURLParam: () => '', isAdBlocked: () => false,
    getDeviceInfo: () => ({ category: 'desktop' }),
    playtestSetCanvas: (c) => rec('playtestSetCanvas', { n: [].concat(c).length }),
    setPlaytestCanvas: (c) => rec('playtestSetCanvas', { n: [].concat(c).length }),
    movePill: (a, b) => rec('movePill', { args: a + ',' + b }),
    captureError: () => {}, logError: () => {}, customEvent: () => {}, gameInteractive: () => {},
    roundStart: () => {}, roundEnd: () => {}, muteAd: () => {}, setVolume: () => {},
    enableEventTracking: () => {}, shareableURL: () => Promise.reject(), displayAd: () => {}, destroyAd: () => {},
  };
})();`;
const SDK_RE = /game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/;

// ---------------------------------------------------------------- rule checks on a call list
// input: the times (page clock) of the first key / touch the test sent
function rules(calls, firstInputT, opts = {}) {
  const out = [];
  const add = (ok, name, detail) => out.push({ ok: !!ok, name, detail: detail || '' });
  const names = calls.map((c) => c.name);
  const count = (n) => names.filter((x) => x === n).length;
  const firstIdx = (n) => names.indexOf(n);
  if (!opts.noSdk) {
    add(count('gameLoadingFinished') === 1, 'gameLoadingFinished exactly once', 'called ' + count('gameLoadingFinished') + 'x');
    const lf = firstIdx('gameLoadingFinished'), gs = firstIdx('gameplayStart');
    add(gs < 0 || lf < gs, 'loading finished before the first gameplayStart');
  }
  // gameplayStart only after the player pressed something
  const firstStart = calls.find((c) => c.name === 'gameplayStart');
  if (firstStart && firstInputT != null) add(firstStart.t >= Math.floor(firstInputT), 'first gameplayStart comes after the first input', 'start at ' + firstStart.t + ' ms, input at ' + Math.round(firstInputT) + ' ms');
  if (firstStart && firstInputT == null) add(false, 'gameplayStart with no input at all', 'start at ' + firstStart.t + ' ms');
  // start / stop alternate, never twice in a row
  let inGame = false, bad = [];
  for (const c of calls) {
    if (c.name === 'gameplayStart') { if (inGame) bad.push('start twice @' + c.t); inGame = true; }
    if (c.name === 'gameplayStop') { if (!inGame) bad.push('stop without start @' + c.t); inGame = false; }
    if ((c.name === 'commercialBreak' || c.name === 'rewardedBreak') && inGame) bad.push(c.name + ' during gameplay @' + c.t);
    if (c.name === 'gameplayStart' && c.overlay) bad.push('gameplayStart under the ' + c.overlay + ' overlay @' + c.t);
    if (c.name === 'gameplayStart' && c.scene && c.scene !== 'play') bad.push('gameplayStart on the ' + c.scene + ' screen @' + c.t);
  }
  add(!bad.length, 'gameplayStart/Stop alternate; no ad call during gameplay; no start on menus', bad.join('; '));
  // while an ad plays: sound off and the game frozen
  for (const c of calls.filter((x) => /:adstart$/.test(x.name))) add(c.muted === true, c.name + ': game sound muted', 'Sound.adMuted=' + c.muted + ' ctx=' + c.actx);
  for (const c of calls.filter((x) => /:adend$/.test(x.name))) add(c.simStepsDuringAd === 0 || c.simStepsDuringAd === undefined, c.name + ': no game steps during the ad', c.simStepsDuringAd + ' steps');
  return out;
}

// ---------------------------------------------------------------- runner
async function main() {
  const { chromium, devices } = loadPlaywright();
  const srv = await serve();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ headless: !flag('show') });
  const results = [];

  // one fresh browser profile per scenario (empty localStorage = a new player)
  async function open(kind, o = {}) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 836, height: 470 }, locale: 'en-US' }, o.ctx || {}));
    const page = await ctx.newPage();
    const log = { errors: [], external: [], console: [] };
    page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console.error: ' + m.text().slice(0, 200)); });
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !SDK_RE.test(u)) log.external.push(u.slice(0, 100)); });
    await page.addInitScript(({ mode, platform, save }) => {
      window.__pokiMode = mode;
      if (platform) window.GAME_PLATFORM = platform;
      if (save) localStorage.setItem('blastbattalion_save_v1', save);
      window.__input = null; // when the test first pressed something (page clock)
      for (const t of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(t, () => { if (window.__input == null) window.__input = performance.now(); }, true);
    }, { mode: o.mode || {}, platform: kind === 'src' ? 'poki' : null, save: o.save || null });
    if (o.real) { /* the real SDK from Poki's CDN */ } else if (o.block) await page.route(SDK_RE, (r) => r.abort());
    else await page.route(SDK_RE, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_SDK }));
    const url = kind === 'src' ? BASE + '/index.html' : BASE + '/dist/poki/index.html' + (o.query || '');
    await page.goto(o.host ? BASE + '/__host?src=' + encodeURIComponent(url) : url);
    return { ctx, page, log };
  }
  const calls = (page) => page.evaluate(() => (window.__poki ? window.__poki.calls : []));
  const firstInput = (page) => page.evaluate(() => window.__input);
  const until = async (page, fn, ms = 15000, arg) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }); return true; } catch (e) { return false; } };
  const inPlay = (page) => until(page, () => window.world && App.scene === PlayScene && !App.pending && (world.state === 'play' || world.state === 'extract'));
  const key = async (page, k, hold = 60) => { await page.keyboard.down(k); await page.waitForTimeout(hold); await page.keyboard.up(k); await page.waitForTimeout(80); };

  function report(name, checks, log, extra) {
    const allChecks = checks.concat([
      { ok: !log.errors.length, name: 'no errors in the console', detail: log.errors.slice(0, 3).join(' || ') },
      { ok: !log.external.length, name: 'no requests outside the game and the SDK', detail: [...new Set(log.external)].slice(0, 3).join(' ') },
    ]);
    results.push({ name, checks: allChecks, extra });
  }

  const SCEN = {
    // a new player: straight into mission 1; nothing counts as play until they press a key
    async 'new-player'() {
      const { ctx, page, log } = await open('src');
      const c = [];
      c.push({ ok: await inPlay(page), name: 'boots straight into mission 1' });
      await page.waitForTimeout(1500);
      let k = await calls(page);
      c.push({ ok: !k.some((x) => x.name === 'gameplayStart'), name: 'no gameplayStart while nobody has touched anything' });
      c.push({ ok: k.some((x) => x.name === 'playtestSetCanvas' && x.n === 2), name: 'Poki playtest recorder gets both canvases (game + HUD)', detail: JSON.stringify(k.filter((x) => x.name === 'playtestSetCanvas')) });
      await key(page, 'ArrowRight', 400);
      await page.waitForTimeout(200);
      k = await calls(page);
      c.push({ ok: k.filter((x) => x.name === 'gameplayStart').length === 1, name: 'first key -> gameplayStart' });
      // pause and resume by key, then by losing focus
      await key(page, 'Escape'); await page.waitForTimeout(150);
      c.push({ ok: await page.evaluate(() => PlayScene.overlay === PauseOverlay), name: 'Esc pauses' });
      await key(page, 'Escape'); await page.waitForTimeout(150);
      await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(150);
      c.push({ ok: await page.evaluate(() => PlayScene.overlay === PauseOverlay), name: 'losing focus pauses' });
      await key(page, 'Escape'); await page.waitForTimeout(150);
      k = await calls(page);
      const seq = k.filter((x) => /^gameplay/.test(x.name)).map((x) => x.name.replace('gameplay', '')).join(',');
      c.push({ ok: seq === 'Start,Stop,Start,Stop,Start', name: 'pause/resume/blur give Start,Stop,Start,Stop,Start', detail: seq });
      c.push({ ok: k.some((x) => x.name === 'measure'), name: 'funnel events sent with PokiSDK.measure', detail: k.filter((x) => x.name === 'measure').map((x) => x.args).slice(0, 6).join(' ; ') });
      report('new-player', c.concat(rules(k, await firstInput(page))), log);
      await ctx.close();
    },

    // mission complete -> NEXT: a commercial break between missions, the game muted and frozen during it
    async 'complete-next'() {
      const { ctx, page, log } = await open('src');
      const c = [];
      await inPlay(page); await key(page, 'ArrowRight', 300);
      await page.evaluate(() => world.onExtracted());
      c.push({ ok: await until(page, () => PlayScene.overlay === CompleteOverlay, 8000), name: 'results screen opens' });
      // the first finished mission of the day opens the supply drop: claim it, then NEXT
      await page.waitForTimeout(2600);
      if (await page.evaluate(() => CompleteOverlay.dropOpen)) { await key(page, 'Enter'); await page.waitForTimeout(300); }
      await key(page, 'Enter');
      c.push({ ok: await until(page, () => window.__poki.calls.some((x) => x.name === 'commercialBreak:adend'), 6000), name: 'NEXT plays a commercial break' });
      c.push({ ok: await until(page, () => window.world && world.levelIndex === 1 && world.state === 'play', 12000), name: 'mission 2 starts after the ad' });
      await page.waitForTimeout(300);
      const k = await calls(page);
      const cb = k.findIndex((x) => x.name === 'commercialBreak'), gs = k.findIndex((x, i) => i > cb && x.name === 'gameplayStart');
      c.push({ ok: cb >= 0 && gs > cb, name: 'gameplayStart again once mission 2 plays' });
      report('complete-next', c.concat(rules(k, await firstInput(page))), log);
      await ctx.close();
    },

    // game over -> CONTINUE (rewarded) -> the heroes drop back in
    async 'gameover-reward-ok'() {
      const { ctx, page, log } = await open('src', { mode: { reward: true } });
      const c = [];
      await inPlay(page); await key(page, 'ArrowRight', 300);
      await page.evaluate(() => { world.lives = 0; for (const p of world.players) { p.inv = 0; p.roid = 0; p.kill('bullet', { dmg: 99 }); } });
      c.push({ ok: await until(page, () => PlayScene.overlay === GameOverOverlay && GameOverOverlay.t > 1.1, 10000), name: 'game over screen opens' });
      c.push({ ok: await page.evaluate(() => GameOverOverlay.menu.buttons[GameOverOverlay.menu.focus].id === 'retry'), name: 'focus starts on RETRY (a stray key never starts a video)' });
      await key(page, 'ArrowDown'); await key(page, 'Enter');
      c.push({ ok: await until(page, () => !PlayScene.overlay && world.state === 'play', 6000), name: 'rewarded video -> the mission continues' });
      c.push({ ok: await page.evaluate(() => world.lives === 3 && world.continued), name: 'reward given once (+3 lives)' });
      const k = await calls(page);
      const rb = k.findIndex((x) => x.name === 'rewardedBreak');
      c.push({ ok: rb >= 0 && k.slice(rb).some((x) => x.name === 'gameplayStart'), name: 'gameplayStart after the reward' });
      report('gameover-reward-ok', c.concat(rules(k, await firstInput(page))), log);
      await ctx.close();
    },

    // the video fails (no fill): no reward, a message, and RETRY still works
    async 'gameover-reward-fail'() {
      const { ctx, page, log } = await open('src', { mode: { ad: 'none' } });
      const c = [];
      await inPlay(page); await key(page, 'ArrowRight', 300);
      await page.evaluate(() => { world.lives = 0; for (const p of world.players) { p.inv = 0; p.roid = 0; p.kill('bullet', { dmg: 99 }); } });
      await until(page, () => PlayScene.overlay === GameOverOverlay && GameOverOverlay.t > 1.1, 10000);
      await key(page, 'ArrowDown'); await key(page, 'Enter');
      await page.waitForTimeout(600);
      c.push({ ok: await page.evaluate(() => PlayScene.overlay === GameOverOverlay && !world.continued && !!GameOverOverlay.msg), name: 'no video -> no reward, a message instead' });
      await key(page, 'ArrowUp'); await key(page, 'Enter');
      c.push({ ok: await until(page, () => window.world && world.state === 'play' && !PlayScene.overlay && !world.continued, 12000), name: 'RETRY restarts the mission' });
      report('gameover-reward-fail', c.concat(rules(await calls(page), await firstInput(page))), log);
      await ctx.close();
    },

    // the SDK never answers a break: the game moves on by itself
    async 'ad-hang'() {
      const { ctx, page, log } = await open('src', { mode: { ad: 'hang' } });
      const c = [];
      await inPlay(page); await key(page, 'ArrowRight', 300);
      await key(page, 'Escape'); await page.waitForTimeout(200);
      await key(page, 'ArrowDown'); await key(page, 'Enter'); // RESTART
      const t0 = Date.now();
      c.push({ ok: await until(page, () => window.world && world.state === 'play' && !PlayScene.overlay, 14000), name: 'a break that never answers doesn\'t block the game', detail: ((Date.now() - t0) / 1000).toFixed(1) + ' s' });
      report('ad-hang', c.concat(rules(await calls(page), await firstInput(page))), log);
      await ctx.close();
    },

    // the SDK script is blocked (adblock): the game runs, breaks pass straight through
    async 'adblock'() {
      const { ctx, page, log } = await open('src', { block: true });
      const c = [];
      c.push({ ok: await inPlay(page), name: 'boots with the SDK blocked' });
      await key(page, 'ArrowRight', 300);
      await key(page, 'Escape'); await page.waitForTimeout(200);
      await key(page, 'ArrowDown'); await key(page, 'Enter');
      const t0 = Date.now();
      c.push({ ok: await until(page, () => window.world && world.state === 'play' && !PlayScene.overlay && world.time < 5, 8000), name: 'RESTART works without ads', detail: ((Date.now() - t0) / 1000).toFixed(1) + ' s' });
      log.errors = log.errors.filter((e) => !/poki-sdk|ERR_FAILED|net::/.test(e)); // the blocked script itself
      log.external = log.external.filter((u) => !SDK_RE.test(u));
      report('adblock', c.concat(rules([], await firstInput(page), { noSdk: true })), log);
      await ctx.close();
    },

    // PokiSDK.init() rejects (what the real SDK does under some ad blockers)
    async 'init-reject'() {
      const { ctx, page, log } = await open('src', { mode: { initReject: true } });
      const c = [];
      c.push({ ok: await inPlay(page), name: 'boots when init() rejects' });
      await key(page, 'ArrowRight', 300);
      report('init-reject', c.concat(rules(await calls(page), await firstInput(page))), log);
      await ctx.close();
    },

    // a returning player lands on the title (a live demo plays behind it): that is not gameplay
    async 'returning-player'() {
      const save = JSON.stringify({ v: 1, unlocked: 3, stars: { 0: 3, 1: 2 }, medals: { 0: 7, 1: 3 }, best: { 0: 12000, 1: 9000 }, rescues: 6, played: 1, coins: 300 });
      const { ctx, page, log } = await open('src', { save });
      const c = [];
      c.push({ ok: await until(page, () => App.scene === TitleScene && !App.pending), name: 'returning player sees the title' });
      await page.waitForTimeout(1200);
      await key(page, 'ArrowDown'); await key(page, 'ArrowUp'); await page.waitForTimeout(300);
      let k = await calls(page);
      c.push({ ok: !k.some((x) => x.name === 'gameplayStart'), name: 'no gameplayStart on the title (demo + menu keys)' });
      await page.evaluate(() => { const m = TitleScene.menu; m.focus = Math.max(0, m.buttons.findIndex((b) => b.primary)); });
      await key(page, 'Enter');
      c.push({ ok: await until(page, () => window.world && App.scene === PlayScene && world.state === 'play' && !world.demo, 10000), name: 'CONTINUE -> a mission' });
      await page.waitForTimeout(300);
      k = await calls(page);
      c.push({ ok: k.some((x) => x.name === 'gameplayStart' && x.scene === 'play'), name: 'gameplayStart once the mission plays' });
      report('returning-player', c.concat(rules(k, await firstInput(page))), log);
      await ctx.close();
    },

    // phone: the first touch starts gameplay; portrait shows the rotate screen
    async 'phone'() {
      const d = devices['Pixel 7'];
      const { ctx, page, log } = await open('src', { ctx: { ...d, viewport: { width: 863, height: 360 }, locale: 'en-US' } });
      const c = [];
      c.push({ ok: await inPlay(page), name: 'phone boots into mission 1' });
      await page.waitForTimeout(800);
      c.push({ ok: !(await calls(page)).some((x) => x.name === 'gameplayStart'), name: 'no gameplayStart before a touch' });
      await page.touchscreen.tap(200, 300);
      await page.waitForTimeout(300);
      c.push({ ok: (await calls(page)).some((x) => x.name === 'gameplayStart'), name: 'first touch -> gameplayStart' });
      c.push({ ok: await page.evaluate(() => Input.mode === 'touch'), name: 'touch controls on' });
      report('phone', c.concat(rules(await calls(page), await firstInput(page))), log);
      await ctx.close();
    },

    // ---- the upload itself (dist/poki): boots, keys work, no dev tools, keys don't scroll the portal page
    async 'dist'() {
      const zip = path.join(ROOT, 'dist', 'blast-battalion-poki.zip');
      const c = [];
      c.push({ ok: fs.existsSync(zip), name: 'dist/blast-battalion-poki.zip exists (node tools/build.mjs)' });
      if (!fs.existsSync(zip)) { report('dist', c, { errors: [], external: [] }); return; }
      const html = fs.readFileSync(path.join(ROOT, 'dist/poki/index.html'), 'utf8'), js = fs.readFileSync(path.join(ROOT, 'dist/poki/game.js'), 'utf8');
      c.push({ ok: /GAME_PLATFORM = 'poki'/.test(html), name: 'index.html is the Poki build' });
      c.push({ ok: /game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/.test(html + js), name: 'loads PokiSDK v2 from game-cdn.poki.com' });
      c.push({ ok: !/(localhost|127\.0\.0\.1|tools\/harness|__shot)/.test(js), name: 'no dev URLs or test hooks in game.js' });
      const kb = (Buffer.byteLength(html) + Buffer.byteLength(js)) / 1024, zkb = fs.statSync(zip).size / 1024;
      c.push({ ok: zkb < 5 * 1024, name: 'download size', detail: zkb.toFixed(0) + ' KB zipped, ' + kb.toFixed(0) + ' KB unpacked' });
      const { ctx, page, log } = await open('dist', { query: '?debug=1' });
      c.push({ ok: await until(page, () => !document.getElementById('boot'), 15000), name: 'boots (loading text goes away)' });
      await page.waitForTimeout(1500);
      c.push({ ok: !(await calls(page)).some((x) => x.name === 'gameplayStart'), name: 'no gameplayStart before input' });
      await key(page, 'ArrowRight', 300);
      await key(page, 'F2'); await key(page, 'F3'); await key(page, 'Backquote');
      c.push({ ok: await page.evaluate(() => !window.__bb && document.querySelectorAll('textarea, input').length === 0), name: 'no tuning / test panels, no window.__bb (even with ?debug=1)' });
      const k = await calls(page);
      c.push({ ok: k.some((x) => x.name === 'gameplayStart'), name: 'first key -> gameplayStart' });
      report('dist', c.concat(rules(k, await firstInput(page))), log);
      await ctx.close();
    },

    // inside a portal page: arrow keys / space / the wheel must not scroll the page around the game
    async 'iframe'() {
      if (!fs.existsSync(path.join(ROOT, 'dist/poki/index.html'))) return;
      const { ctx, page, log } = await open('dist', { host: true });
      const c = [];
      const frame = await (await page.waitForSelector('#g')).contentFrame();
      await frame.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 });
      await page.click('#g', { position: { x: 400, y: 300 } });
      // the game's keys, then keys a player might hit by accident: each set on its own, from the top
      for (const set of [['ArrowDown', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight'], ['PageDown'], ['End'], ['Home'], ['Tab']]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        for (const k of set) await key(page, k, 120);
        const y = await page.evaluate(() => window.scrollY);
        c.push({ ok: y === 0, name: set.join('/') + ' inside the game doesn\'t scroll the portal page', detail: 'scrollY=' + y });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.mouse.move(418, 355);
      await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
      c.push({ ok: (await page.evaluate(() => window.scrollY)) === 0, name: 'mouse wheel over the game doesn\'t scroll the portal page', detail: 'scrollY=' + (await page.evaluate(() => window.scrollY)) });
      c.push({ ok: await frame.evaluate(() => document.hasFocus()), name: 'the game keeps keyboard focus after a click' });
      const k = await frame.evaluate(() => (window.__poki ? window.__poki.calls : []));
      c.push({ ok: k.some((x) => x.name === 'gameplayStart'), name: 'gameplayStart after a click + keys in the iframe' });
      report('iframe', c, log);
      await ctx.close();
    },

    // the real SDK from Poki's CDN (local debug mode): boots and logs no errors of the game's own
    async 'real-sdk'() {
      const { ctx, page, log } = await open('dist', { real: true, query: '?debug=1' });
      const c = [];
      const sdkLog = [];
      page.on('console', (m) => { const t = m.text(); if (/PokiSDK\./.test(t)) sdkLog.push(t.replace(/%c/g, '').replace(/background-color[^)]*\)?/g, '').replace(/\s+/g, ' ').slice(0, 80)); });
      c.push({ ok: await until(page, () => !document.getElementById('boot'), 20000), name: 'boots with the real SDK' });
      await page.waitForTimeout(3000);
      await key(page, 'ArrowRight', 300); await key(page, 'Escape'); await key(page, 'Escape');
      await page.waitForTimeout(500);
      c.push({ ok: sdkLog.some((t) => /gameplayStart/.test(t)), name: 'real SDK saw gameplayStart', detail: sdkLog.slice(0, 12).join(' | ') });
      log.errors = log.errors.filter((e) => !/Cross-Origin-Opener-Policy|__tcfapi|googlesyndication|doubleclick|imasdk|prebid|amazon|ERR_|net::|Failed to load resource/.test(e));
      log.external = [];
      report('real-sdk', c, log);
      await ctx.close();
    },
  };

  const only = opt('only') ? opt('only').split(',') : Object.keys(SCEN).filter((n) => n !== 'real-sdk' || flag('real'));
  for (const name of only) {
    const t0 = Date.now();
    try { await SCEN[name](); } catch (e) { results.push({ name, checks: [{ ok: false, name: 'scenario crashed', detail: String(e && e.stack || e).split('\n').slice(0, 3).join(' ') }] }); }
    process.stdout.write('.' + name + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's\n');
  }
  await browser.close();
  srv.close();

  let fails = 0;
  console.log('\nPoki QA');
  for (const r of results) {
    const bad = r.checks.filter((x) => !x.ok);
    fails += bad.length;
    console.log((bad.length ? 'FAIL ' : 'ok   ') + r.name + '  (' + (r.checks.length - bad.length) + '/' + r.checks.length + ')');
    for (const x of r.checks) if (!x.ok || flag('verbose')) console.log('       ' + (x.ok ? '+' : 'x') + ' ' + x.name + (x.detail ? '  [' + x.detail + ']' : ''));
  }
  console.log(fails ? '\n' + fails + ' check(s) failed' : '\nPASS - every check passed');
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
