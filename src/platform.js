'use strict';
// ============================================================================
//  Platform adapter: Poki SDK v2 / CrazyGames SDK v3 / local (no SDK)
//  Choose the target with window.GAME_PLATFORM (set by the build) or ?platform=
// ============================================================================

const Platform = (() => {
  const qs = new URLSearchParams(location.search);
  const target = String(window.GAME_PLATFORM || qs.get('platform') || 'none').toLowerCase();
  let sdk = null;          // 'poki' | 'crazygames' | null
  let ready = false;       // the SDK has answered init() (either way)
  let inGameplay = false;
  let adActive = false;
  let lastAd = 0;
  // Poki Kids (?tag=kids) plays without any ads: no rewarded offers there
  const kids = target === 'poki' && qs.get('tag') === 'kids';
  // Poki: gameplayStart() fires on the player's first input, not on load. A new player boots
  // straight into mission 1, so gameplay that begins before any input waits for it
  let touched = false, wantGameplay = false;
  function noteInput() {
    if (touched) return;
    touched = true;
    if (wantGameplay) { wantGameplay = false; gameplayStart(); }
  }
  for (const t of ['keydown', 'pointerdown', 'mousedown', 'touchstart']) window.addEventListener(t, noteInput, true);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cg = () => window.CrazyGames && window.CrazyGames.SDK;
  const poki = () => window.PokiSDK;

  // The Poki build brings the SDK's loader with the page (<script> in <head>, tools/build.mjs), so it
  // downloads alongside the game; the loader fetches the SDK's core by itself. If the core never
  // arrives (a blocker, a dropped connection), init() never settles: the boot waits for it a few
  // seconds at most, and until it has answered, ad breaks are skipped instead of hanging.
  async function init() {
    try {
      if (target === 'poki') {
        if (!poki()) await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        sdk = 'poki';
        const answered = () => { ready = true; };
        let p;
        try { p = Promise.resolve(poki().init()).then(answered, answered); } catch (e) { answered(); p = Promise.resolve(); }
        await Promise.race([p, wait(3500)]);
        // Poki's playtest videos: the game and the HUD layer over it (src/hud.js), in that order
        try { poki().playtestSetCanvas([Gfx.canvas, Hud.canvas].filter(Boolean)); } catch (e) { /* older SDK */ }
      } else if (target === 'crazygames') {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        await window.CrazyGames.SDK.init();
        sdk = 'crazygames';
        ready = true;
      }
    } catch (e) {
      console.warn('[platform] SDK init failed, running without SDK', e);
      sdk = null;
    }
  }

  function loadingStart() { if (sdk === 'crazygames') { try { cg().game.loadingStart(); } catch (e) { /* */ } } }
  function loadingDone() {
    if (sdk === 'poki') { try { poki().gameLoadingFinished(); } catch (e) { /* */ } }
    else if (sdk === 'crazygames') { try { cg().game.loadingStop(); } catch (e) { /* */ } }
  }
  function gameplayStart() {
    if (inGameplay || adActive) return;
    if (!touched) { wantGameplay = true; return; }
    inGameplay = true;
    if (sdk === 'poki') { try { poki().gameplayStart(); } catch (e) { /* */ } }
    else if (sdk === 'crazygames') { try { cg().game.gameplayStart(); } catch (e) { /* */ } }
  }
  function gameplayStop() {
    wantGameplay = false;
    if (!inGameplay) return;
    inGameplay = false;
    if (sdk === 'poki') { try { poki().gameplayStop(); } catch (e) { /* */ } }
    else if (sdk === 'crazygames') { try { cg().game.gameplayStop(); } catch (e) { /* */ } }
  }
  function happyTime() {
    if (sdk === 'crazygames') { try { cg().game.happytime(); } catch (e) { /* */ } }
  }

  // Game events for the portal's dashboard (Poki's PokiSDK.measure): category, what, action.
  // The SDK takes only letters, digits, spaces and - _ : . + | (so anything else becomes '-')
  const clean = (v) => String(v == null ? '' : v).trim().replace(/[^A-Za-z0-9_: .+|-]/g, '-').slice(0, 60);
  function measure(category, what, action) {
    if (sdk !== 'poki') return;
    try { if (typeof poki().measure === 'function') poki().measure(clean(category), clean(what), clean(action)); } catch (e) { /* */ }
  }
  // the language of the portal's page (Poki passes it to the game), when it has one
  function language() {
    if (sdk !== 'poki') return null;
    try { const l = poki().getLanguage && poki().getLanguage(); return l ? String(l).slice(0, 2).toLowerCase() : null; } catch (e) { return null; }
  }

  function adStarted() { adActive = true; Sound.setAdMuted(true); Input.clear(); }
  function adEnded() { adActive = false; Sound.setAdMuted(false); lastAd = Date.now(); }

  // A second tap on NEXT/RETRY while an ad request is pending reuses the same request.
  let pendingBreak = null, pendingReward = null;

  // Midroll between levels / on restart. Always resolves.
  function commercialBreak() {
    if (pendingBreak) return pendingBreak;
    pendingBreak = requestBreak().then(() => { pendingBreak = null; });
    return pendingBreak;
  }
  function rewardedBreak() {
    if (pendingReward) return pendingReward;
    pendingReward = requestReward().then((ok) => { pendingReward = null; return ok; });
    return pendingReward;
  }

  function requestBreak() {
    gameplayStop();
    return new Promise((resolve) => {
      let settled = false;
      const done = () => { adEnded(); if (!settled) { settled = true; resolve(); } };
      // safety net: if the SDK never answers (and no ad started), don't block the game
      setTimeout(() => { if (!settled && !adActive) { settled = true; resolve(); } }, 8000);
      if (sdk === 'poki' && ready) {
        try { poki().commercialBreak(() => adStarted()).then(done, done); } catch (e) { done(); }
      } else if (sdk === 'crazygames') {
        try {
          cg().ad.requestAd('midgame', { adStarted: () => adStarted(), adFinished: done, adError: done });
        } catch (e) { done(); }
      } else resolve();
    });
  }

  // Rewarded ad. Resolves true if the reward should be granted.
  function requestReward() {
    gameplayStop();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => { if (settled) { adEnded(); return; } settled = true; adEnded(); resolve(!!ok); };
      setTimeout(() => { if (!settled && !adActive) { settled = true; resolve(false); } }, 10000);
      if (sdk === 'poki') {
        if (!ready) { finish(false); return; }
        try { poki().rewardedBreak(() => adStarted()).then((ok) => finish(ok), () => finish(false)); } catch (e) { finish(false); }
      } else if (sdk === 'crazygames') {
        try {
          cg().ad.requestAd('rewarded', { adStarted: () => adStarted(), adFinished: () => finish(true), adError: () => finish(false) });
        } catch (e) { finish(false); }
      } else {
        // local testing: simulate a short ad
        adStarted();
        setTimeout(() => finish(true), 600);
      }
    });
  }

  // Storage: CrazyGames data module (cloud saves) when available, else localStorage.
  // (Poki copies localStorage to its cloud save by itself for players who are logged in.)
  function storeGet(key) {
    try {
      if (sdk === 'crazygames' && cg().data) { const v = cg().data.getItem(key); if (v != null) return v; }
    } catch (e) { /* */ }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, val) {
    try { if (sdk === 'crazygames' && cg().data) cg().data.setItem(key, val); } catch (e) { /* */ }
    try { window.localStorage.setItem(key, val); } catch (e) { /* */ }
  }

  return {
    init, loadingStart, loadingDone, gameplayStart, gameplayStop, happyTime, commercialBreak, rewardedBreak,
    storeGet, storeSet, noteInput, measure, language,
    get name() { return sdk || 'local'; },
    get target() { return target; },
    get adActive() { return adActive; },
    get inGameplay() { return inGameplay; },
    // a rewarded video can be offered (Poki Kids has no ads at all)
    get hasRewarded() { return !kids; },
  };
})();

// ----------------------------------------------------------------------------
//  Save data
// ----------------------------------------------------------------------------
const Save = {
  KEY: GAME_ID + '_save_v1',
  data: null,
  defaults() { return { v: 1, unlocked: 1, stars: {}, best: {}, rescues: 0, sfx: true, music: true, finished: false, difficulty: 1, coop: false, arcadeBest: 0, arcadeStage: 0, shake: 2, favorite: null, fx: 'auto', autofire: null, aim: null, calm: false, vibrate: true, keys: null, medals: {}, blood: null, coins: 0, up: {}, dailyDrop: null, tips: {}, fails: {}, secrets: {}, wardrobe: { own: {}, wear: {}, seen: {} } }; },
  dailyBest(day) { const d = this.data.daily; return d && d.day === day ? d.best : 0; },
  recordDaily(day, score) { this.data.daily = { day, best: Math.max(this.dailyBest(day), Math.round(score)) }; this.save(); },
  recordArcade(stage, score) {
    this.data.arcadeBest = Math.max(this.data.arcadeBest || 0, Math.round(score));
    this.data.arcadeStage = Math.max(this.data.arcadeStage || 0, stage);
    this.save();
  },
  load() {
    let d = null;
    try { const raw = Platform.storeGet(this.KEY); if (raw) d = JSON.parse(raw); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    if (new URLSearchParams(location.search).get('unlockall') === '1') { this.data.unlocked = LEVELS.length; this.data.rescues = 99; }
  },
  save() { try { Platform.storeSet(this.KEY, JSON.stringify(this.data)); } catch (e) { /* */ } },
  unlockedHeroes() { return HEROES.filter((h) => this.data.rescues >= h.unlock).map((h) => h.id); },
  // returns ids of heroes unlocked by this rescue
  addRescue() {
    const before = new Set(this.unlockedHeroes());
    this.data.rescues++;
    this.save();
    return this.unlockedHeroes().filter((id) => !before.has(id));
  },
  // mission medals, one per star: 1 = completed, 2 = every prisoner freed, 4 = no hero lost.
  // They add up over runs; saves from before 1.13 only kept the star count, so guess from it
  medals(index) {
    const m = this.data.medals && this.data.medals[index];
    if (m != null) return m;
    const s = this.data.stars[index] || 0;
    return s >= 3 ? 7 : s === 2 ? 3 : s === 1 ? 1 : 0;
  },
  completeLevel(index, stars, score, mask = 1) {
    const k = String(index);
    const m = this.medals(index) | mask;
    if (!this.data.medals) this.data.medals = {};
    this.data.medals[k] = m;
    this.data.stars[k] = Math.max(this.data.stars[k] || 0, stars, (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1));
    this.data.best[k] = Math.max(this.data.best[k] || 0, score);
    if (this.data.fails) delete this.data.fails[k]; // beaten: no more reinforcements
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVELS.length, index + 2));
    if (index === LEVELS.length - 1) this.data.finished = true;
    this.save();
  },
  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); },
};
