'use strict';
// ============================================================================
//  Playtest recorder for watching first-time players. Active in dev / web /
//  artifact builds, never in the Poki or CrazyGames packages. It notes what a
//  new player does - how each mission ended, every death and what caused it,
//  where they got stuck, which controls they found and when - and turns it
//  into a report. F3 (or five quick taps on the version number on the title
//  screen) opens the panel. "Nowy tester" archives the log and starts a clean
//  one on a clean save; the owner's own save is put aside until restored.
// ============================================================================

const PT_CAUSE = {
  shot: 'strzał', explosion: 'wybuch', fire: 'ogień', bite: 'ugryzienie', bash: 'cios tarczą',
  crush: 'zmiażdżenie', spikes: 'kolce', doom: 'fala detonacji',
};
// what a first-time player should find, in roughly the order the game teaches it
const PT_FIRSTS = [
  ['key:move', 'ruch'], ['key:jump', 'skok'], ['key:fire', 'strzał'], ['kill', 'pierwsze zabójstwo'],
  ['wallclimb', 'wspinaczka po ścianie'], ['walljump', 'odbicie od ściany'], ['ladder', 'drabina'], ['rescue', 'uwolniony jeniec'],
  ['key:special', 'klawisz specjala'], ['special', 'specjal'], ['special:empty', 'specjal bez amunicji'],
  ['key:melee', 'klawisz noża'], ['knife', 'nóż'], ['knife:auto', 'nóż przy strzale z bliska'], ['barrel kick', 'kopnięcie beczki'],
  ['bat grenade', 'odbicie granatu'], ['key:down', 'klawisz w dół'], ['slide', 'ślizg'], ['slidejump', 'skok ze ślizgu'], ['stomp', 'deptanie'],
  ['grab', 'złapanie żołnierza'], ['throw', 'rzut żołnierzem'], ['gold crate', 'złota skrzynia'], ['pocket', 'przedmiot ze skrzyni'],
  ['fuel leak', 'przebita beczka lub rura z paliwem'], ['fuel fire', 'podpalone paliwo'], ['drum kick', 'kopnięta beczka paliwa'], ['bridge', 'zawalony most'],
  ['mech', 'wejście do mecha'], ['mech:exit', 'wyjście z mecha'], ['mech:lost', 'mech zniszczony'], ['style kill', 'zabójstwo stylowe'], ['death', 'pierwsza śmierć'],
];
const PT_NOT_GOALS = ['special:empty', 'mech:lost', 'death']; // logged, but not something a player "should" find
const PT_GOAL = { extract: 'ewakuacja', target: 'zamach', depots: 'składy paliwa', escape: 'ucieczka', boss: 'boss' };
const PT_KIND = { bullet: 'kule', explosion: 'wybuchy', fire: 'ogień', crush: 'zmiażdżenia', melee: 'wręcz', shock: 'prąd', rail: 'railgun', fall: 'upadki' };
const PT_KEYS = [['key:move', ['left', 'right']], ['key:jump', ['jump', 'up']], ['key:fire', ['fire']], ['key:special', ['special']], ['key:melee', ['melee']], ['key:down', ['down']]];

const Playtest = {
  KEY: 'blast_battalion_playtest',
  ARCHIVE: 'blast_battalion_playtest_archive',
  BACKUP: 'blast_battalion_save_backup',
  MAX_EVENTS: 2500,
  STALL: 25, // seconds without moving right = "stuck"
  IDLE: 15,  // seconds without touching anything
  on: false, log: null, run: null, runW: null, prog: null, dirty: false, lastUi: null,
  el: null, armT: 0, taps: 0, tapT: 0,

  enabled() { return String(window.GAME_PLATFORM || 'none') === 'none'; },

  init() {
    if (!this.enabled()) return;
    this.on = true;
    const L = this.read(this.KEY);
    this.log = L && Array.isArray(L.events) && Array.isArray(L.runs) ? L : this.fresh('');
    this.ev('boot', this.device());
    window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); this.toggle(); } });
    window.addEventListener('pagehide', () => { if (this.run) this.endRun('closed'); this.save(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.dirty) this.save(); });
    setInterval(() => { if (this.dirty) this.save(); }, 5000);
  },
  read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } },
  write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } },
  fresh(label) { return { v: 1, label: label || '', started: Date.now(), playT: 0, firsts: {}, runs: [], events: [] }; },
  save() { if (!this.on) return; this.dirty = false; this.write(this.KEY, this.log); },

  device() {
    const ua = navigator.userAgent || '';
    return {
      v: VERSION, host: location.hostname || 'file', view: Gfx.W + 'x' + Gfx.H, win: window.innerWidth + 'x' + window.innerHeight,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100, touch: !!Input.isTouchDevice, input: Input.mode,
      phone: /Mobi|Android|iPhone|iPad/i.test(ua), tune: TunePanel.changed(),
      opts: { fx: Save.data.fx || 'auto', calm: Settings.calm(), aim: Settings.aimLevel(), autofire: Settings.autoFire(), keys: !!Save.data.keys },
      save: { unlocked: Save.data.unlocked, rescues: Save.data.rescues, stars: Save.totalStars(), diff: Save.data.difficulty, coop: !!Save.data.coop, fav: Save.data.favorite },
    };
  },

  // t = seconds since the log started (wall clock), pt = seconds of actual play so far
  ev(k, data) {
    if (!this.on) return;
    const L = this.log;
    L.events.push(Object.assign({ k, t: Math.round((Date.now() - L.started) / 100) / 10, pt: Math.round(L.playT) }, data || {}));
    if (L.events.length > this.MAX_EVENTS) L.events.splice(0, L.events.length - this.MAX_EVENTS);
    this.dirty = true;
  },
  first(key) {
    const f = this.log.firsts;
    if (f[key]) return;
    f[key] = { pt: Math.round(this.log.playT), m: this.run ? this.run.m : null };
    this.ev('first', { what: key });
  },
  // a mechanic was used (co-op player 2 is counted separately)
  use(key, p) {
    // the title's demo hero (src/attract.js) isn't a tester
    if (!this.on || (window.world && window.world.demo)) return;
    const k = p && p.slot ? key + '@P2' : key;
    this.first(k);
    if (this.run) this.run.uses[k] = (this.run.uses[k] || 0) + 1;
  },
  mine(W) { return this.run && this.runW === W; },
  pct(W, x) { return Math.round(clamp(x / (W.terrain.w * TILE), 0, 1) * 100); },

  // ------------------------------------------------------------ mission runs
  startRun(W) {
    if (!this.on) return;
    if (this.run) this.endRun(this.lastUi ? 'quit:' + this.lastUi : 'quit');
    this.runW = W; this.lastUi = null;
    this.run = {
      m: W.arcade ? 'A' + W.arcade.stage : W.daily ? 'D' : 'M' + (W.levelIndex + 1), name: W.def.name, seed: W.mission.seed,
      goal: W.goal, diff: W.skill.name, players: W.numPlayers, input: Input.mode, t0: Math.round((Date.now() - this.log.started) / 1000),
      result: null, time: 0, stars: 0, score: 0, deaths: [], hurts: {}, kills: 0, kinds: {}, style: {}, rescued: 0,
      prisoners: W.prisonersTotal, far: 0, stalls: [], idle: 0, heroes: [], uses: {}, pauses: 0, gameovers: 0, continues: 0, flagLocked: 0, mechT: 0,
    };
    this.prog = { best: -1, since: 0, stalled: false, idle: 0, idleOn: false };
    this.ev('start', { m: this.run.m, name: W.def.name, diff: W.skill.name, input: Input.mode, players: W.numPlayers });
  },
  // PlayScene is being left: the last menu button says how
  leave(W) {
    if (!this.mine(W)) return;
    const s = W.state, res = s === 'complete' || s === 'leaving' ? 'complete' : s === 'gameover' ? 'failed' : 'quit';
    this.endRun(this.lastUi ? res + ':' + this.lastUi : res);
  },
  endRun(result) {
    const r = this.run, W = this.runW;
    if (!r) return;
    if (this.prog.stalled) this.closeStall(W, 'end');
    if (this.prog.idleOn) r.idle += this.prog.idle;
    this.run = null; this.runW = null;
    r.result = result; r.time = Math.round(W.time); r.rescued = W.rescued;
    if (!r.score) r.score = W.score;
    r.mechT = Math.round(r.mechT);
    this.log.runs.push(r);
    if (this.log.runs.length > 200) this.log.runs.shift();
    this.ev('end', { m: r.m, result, time: r.time });
    this.save();
  },
  complete(W, stars, total) { if (!this.mine(W)) return; this.run.stars = stars; this.run.score = total; this.ev('complete', { m: this.run.m, stars }); },
  gameover(W) { if (!this.mine(W)) return; this.run.gameovers++; this.ev('gameover', { m: this.run.m, pct: this.run.far }); },
  cont(W) { if (!this.mine(W)) return; this.run.continues++; this.ev('continue', { m: this.run.m }); },
  hero(W, p) {
    if (!this.mine(W)) return;
    const r = this.run;
    if (!r.heroes.includes(p.hero.id)) r.heroes.push(p.hero.id);
    // a fresh drop restarts the "is he making progress" clock
    if (p.slot === 0) { if (this.prog.stalled) this.closeStall(W, 'respawn'); this.prog.best = p.cx; this.prog.since = W.time; }
  },
  death(W, p, cause, info) {
    if (!this.mine(W)) return;
    const d = { c: cause, by: info.src || null, pct: this.pct(W, p.cx), t: Math.round(W.time), hero: p.hero.id, hp: p.maxHp };
    if (p.slot) d.p = 2;
    this.run.deaths.push(d);
    this.ev('death', Object.assign({ m: this.run.m }, d));
    this.first(p.slot ? 'death@P2' : 'death');
  },
  hurt(W, p, cause, info) {
    if (!this.mine(W)) return;
    const key = cause + (info.src ? '<' + info.src : '');
    this.run.hurts[key] = (this.run.hurts[key] || 0) + 1;
    this.ev('hurt', { m: this.run.m, c: cause, by: info.src || null, pct: this.pct(W, p.cx), hp: p.hp });
  },
  kill(W, e, info, style) {
    if (!this.mine(W)) return;
    const r = this.run, k = info.kind || '?';
    r.kills++; r.kinds[k] = (r.kinds[k] || 0) + 1;
    this.first('kill');
    if (style) { r.style[style[0]] = (r.style[style[0]] || 0) + 1; this.first('style kill'); }
  },
  flag(W, flag) { if (this.mine(W)) this.ev('flag', { m: this.run.m, kind: flag.kind, pct: this.pct(W, flag.px) }); },
  flagLocked(W) { if (!this.mine(W)) return; this.run.flagLocked++; this.ev('flag_locked', { m: this.run.m, goal: W.goal }); },
  pause(reason) {
    if (!this.run) return;
    if (!reason) this.run.pauses++;
    this.ev('pause', { m: this.run.m, why: reason || 'player' });
  },
  ui(id) {
    if (!this.on || !id) return;
    this.lastUi = id;
    this.ev('ui', { id, at: this.sceneName() });
  },
  sceneName() {
    const s = App.scene;
    if (s === PlayScene) {
      const o = PlayScene.overlay;
      return o === PauseOverlay ? 'pause' : o === CompleteOverlay ? 'complete' : o === GameOverOverlay ? 'gameover' : 'play';
    }
    return s === TitleScene ? 'title' : s === LevelSelectScene ? 'levels' : s === HeroesScene ? 'heroes' : s === VictoryScene ? 'victory' : '?';
  },

  // once per simulation step: keys found, progress, stalls, idling
  tick(W, dt) {
    if (!this.mine(W) || (W.state !== 'play' && W.state !== 'extract')) return;
    const r = this.run, pr = this.prog, s = Input.slots[0];
    this.log.playT += dt;
    for (const [k, bs] of PT_KEYS) if (!this.log.firsts[k] && bs.some((b) => s.pressed[b])) this.first(k);
    let any = false;
    for (const b of BUTTONS) if (Input.state[b]) { any = true; break; }
    if (any) {
      if (pr.idleOn) { r.idle += pr.idle; this.ev('active', { m: r.m, after: Math.round(pr.idle) }); }
      pr.idle = 0; pr.idleOn = false;
    } else {
      pr.idle += dt;
      if (!pr.idleOn && pr.idle > this.IDLE) { pr.idleOn = true; this.ev('idle', { m: r.m, pct: r.far }); }
    }
    const p = W.players.find((q) => q.slot === 0 && !q.dead && q.state !== 'extract');
    if (!p) return;
    if (p.climbing) this.first('wallclimb');
    if (p.state === 'ladder') this.first('ladder');
    if (p.mech) r.mechT += dt;
    const x = p.cx, pc = this.pct(W, x);
    if (pc > r.far) r.far = pc;
    if (pr.best < 0) { pr.best = x; pr.since = W.time; }
    if (x > pr.best + 32) {
      if (pr.stalled) this.closeStall(W, 'moved');
      pr.best = x; pr.since = W.time;
    } else if (!pr.stalled && W.state === 'play' && !W.bossActive && W.time - pr.since > this.STALL) {
      pr.stalled = true;
      const foes = W.enemies.filter((e) => !e.dead && Math.abs(e.cx - x) < 220 && Math.abs(e.cy - p.cy) < 140).length;
      const st = { pct: pc, x: Math.round(x), y: Math.round(p.y), wall: this.wallAhead(W, p), foes, goal: W.goal + (W.goalDone ? '' : ':todo'), since: Math.round(pr.since), dur: 0, end: null };
      r.stalls.push(st);
      this.ev('stall', Object.assign({ m: r.m }, st));
    }
  },
  closeStall(W, why) {
    this.prog.stalled = false;
    const r = this.run, st = r && r.stalls[r.stalls.length - 1];
    if (!st) return;
    st.dur = Math.round(W.time - st.since); st.end = why;
    this.ev('unstall', { m: r.m, pct: st.pct, dur: st.dur, why });
  },
  // solid tiles stacked right in front of the hero (how tall the wall he faces is)
  wallAhead(W, p) {
    const T = W.terrain, col = Math.floor((p.cx + p.face * 12) / TILE), row = Math.floor((p.y + p.h - 1) / TILE);
    let n = 0;
    while (n < 8 && T.solid(col, row - n)) n++;
    return n;
  },

  // five quick taps on the version number (top left of the title) open the panel on touch screens
  cornerTaps(evs) {
    if (!this.on) return;
    for (const ev of evs) {
      if (ev.type !== 'down' || ev.x > 48 || ev.y > 16) continue;
      const now = performance.now();
      this.taps = now - this.tapT < 700 ? this.taps + 1 : 1;
      this.tapT = now;
      if (this.taps >= 5) { this.taps = 0; this.toggle(); }
    }
  },

  // ------------------------------------------------------------ report
  report(L) {
    L = L || this.log;
    const runs = L.runs.slice();
    if (L === this.log && this.run) runs.push(Object.assign({}, this.run, { result: 'running', time: Math.round(this.runW.time) }));
    const evs = L.events, boots = evs.filter((e) => e.k === 'boot'), boot = boots[0] || {};
    const T = (s) => fmtTime(s || 0);
    const when = (ms) => { const d = new Date(ms); return d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }); };
    const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const tally = (list) => { const o = {}; for (const k of list) o[k] = (o[k] || 0) + 1; return o; };
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', ');
    const out = [];
    out.push('BLAST BATTALION — RAPORT Z TESTU' + (L.label ? ' · ' + L.label : ''));
    const wall = evs.length ? evs[evs.length - 1].t : 0;
    out.push('Wersja ' + (boot.v || VERSION) + ' · log od ' + when(L.started) + ' · czas gry ' + T(L.playT) + ' (razem z menu i pauzami ' + T(wall) + ') · uruchomień strony: ' + boots.length);
    const inputs = [...new Set(runs.map((r) => r.input).concat(boot.input ? [boot.input] : []))].map((m) => ({ keyboard: 'klawiatura', touch: 'dotyk', gamepad: 'pad' }[m] || m));
    out.push('Sprzęt: ' + (inputs.join(' + ') || '?') + ' · obraz gry ' + (boot.view || '?') + ' · okno ' + (boot.win || '?') + (boot.phone ? ' · telefon/tablet' : '') + (boot.touch ? ' · ekran dotykowy' : ''));
    const tune = boot.tune || {};
    out.push('Strojenie: ' + (Object.keys(tune).length ? 'ZMIENIONE ' + Object.entries(tune).map(([k, v]) => k + '=' + v).join(', ') : 'domyślne'));
    const sv = boot.save || {};
    out.push('Zapis na starcie: ' + (sv.unlocked <= 1 && !sv.rescues && !sv.stars ? 'czysty (pierwsza gra)' : 'misje ' + sv.unlocked + ', jeńcy ' + sv.rescues + ', gwiazdki ' + sv.stars));

    const res = (r) => {
      const [head, how] = String(r.result || '').split(':');
      const h = { complete: 'UKOŃCZONA ' + '★'.repeat(r.stars || 0) + '☆'.repeat(Math.max(0, 3 - (r.stars || 0))), failed: 'PORAŻKA', quit: 'PRZERWANA', closed: 'ZAMKNIĘTA STRONA', running: 'W TOKU' }[head] || head;
      const w = { retry: 'ponów', menu: 'menu', restart: 'restart', quit: 'wyjście', next: 'dalej', replay: 'powtórka', again: 'jeszcze raz' }[how] || how;
      return h + (w ? ' → ' + w : '');
    };
    const done = runs.filter((r) => /^complete/.test(r.result)).length, lost = runs.filter((r) => /^failed/.test(r.result)).length;
    const goalPl = (g) => { const [a, b] = String(g || '').split(':'); return (PT_GOAL[a] || a) + (b ? ' (niewykonany)' : ''); };
    const useName = (k) => { const [base, who] = k.split('@'); const f = PT_FIRSTS.find((x) => x[0] === base); return (f ? f[1] : base) + (who ? ' ' + who : ''); };
    out.push('', 'MISJE — podejścia: ' + runs.length + ' · ukończone ' + done + ' · porażki ' + lost + ' · przerwane/inne ' + (runs.length - done - lost));
    runs.forEach((r, i) => {
      const st = sum(r.style);
      out.push(' ' + (i + 1) + '. ' + r.m + ' ' + r.name + ' · ' + r.diff + (r.players > 1 ? ' · co-op' : '') + ' · ' + res(r) + ' · ' + T(r.time) +
        ' · zgony ' + r.deaths.length + ' · trafienia ' + sum(r.hurts) + ' · zabici ' + r.kills + (st ? ' (stylowe ' + st + ')' : '') +
        ' · jeńcy ' + r.rescued + '/' + r.prisoners + ' · najdalej ' + r.far + '%' + (r.stalls.length ? ' · utknięcia ' + r.stalls.length : '') +
        (r.gameovers ? ' · game over ' + r.gameovers : '') + (r.continues ? ' · kontynuacje ' + r.continues : '') + (r.mechT >= 1 ? ' · w mechu ' + T(r.mechT) : '') +
        ' · bohaterowie: ' + (r.heroes.join(', ') || '-'));
    });

    const deaths = [];
    runs.forEach((r) => r.deaths.forEach((d) => deaths.push(Object.assign({ m: r.m }, d))));
    out.push('', 'ZGONY (' + deaths.length + ')' + (deaths.length ? ': ' + top(tally(deaths.map((d) => PT_CAUSE[d.c] || d.c))) : ''));
    const bySrc = tally(deaths.filter((d) => d.by).map((d) => d.by));
    if (Object.keys(bySrc).length) out.push('  sprawcy: ' + top(bySrc));
    deaths.slice(0, 60).forEach((d) => out.push('  - ' + d.m + ' ' + d.pct + '% po ' + T(d.t) + ' — ' + (PT_CAUSE[d.c] || d.c) + (d.by ? ' ← ' + d.by : '') + ' (' + d.hero + (d.p ? ', P2' : '') + ')'));
    const hurts = {};
    runs.forEach((r) => { for (const k in r.hurts) hurts[k] = (hurts[k] || 0) + r.hurts[k]; });
    const hurtNames = {};
    for (const k in hurts) { const [c, s] = k.split('<'); const n = (PT_CAUSE[c] || c) + (s ? ' ← ' + s : ''); hurtNames[n] = (hurtNames[n] || 0) + hurts[k]; }
    out.push('TRAFIENIA BEZ ŚMIERCI (' + sum(hurts) + ')' + (sum(hurts) ? ': ' + top(hurtNames) : ''));

    const stalls = [];
    runs.forEach((r) => r.stalls.forEach((s) => stalls.push(Object.assign({ m: r.m }, s))));
    out.push('', 'UTKNIĘCIA (≥' + this.STALL + ' s bez postępu w prawo): ' + stalls.length);
    const endWhy = { moved: 'ruszył dalej', respawn: 'zginął', end: 'koniec misji' };
    stalls.forEach((s) => out.push('  - ' + s.m + ' ' + s.pct + '% (x ' + s.x + ', y ' + s.y + ') · ' + (s.dur || '≥' + this.STALL) + ' s' + (s.end ? ' → ' + (endWhy[s.end] || s.end) : '') +
      ' · ściana przed nim: ' + s.wall + ' kaf. · wrogów obok: ' + s.foes + ' · cel: ' + goalPl(s.goal)));
    const idles = evs.filter((e) => e.k === 'idle').length, idleT = runs.reduce((a, r) => a + (r.idle || 0), 0);
    out.push('BEZCZYNNOŚĆ (≥' + this.IDLE + ' s bez żadnego klawisza): ' + idles + '×' + (idleT ? ', razem ' + Math.round(idleT) + ' s' : ''));
    const locked = runs.filter((r) => r.flagLocked).map((r) => r.m + ' ×' + r.flagLocked);
    out.push('PRÓBY EWAKUACJI PRZED WYKONANIEM CELU: ' + (locked.length ? locked.join(', ') : '0'));
    const pauses = evs.filter((e) => e.k === 'pause'), pp = pauses.filter((e) => e.why === 'player').length;
    out.push('PAUZY: ' + pp + ' przez gracza' + (pauses.length > pp ? ', ' + (pauses.length - pp) + ' automatyczne (okno/panel)' : ''));

    const F = L.firsts, used = [], unused = [];
    for (const [k, name] of PT_FIRSTS) {
      if (F[k]) used.push([F[k].pt, name + ' ' + T(F[k].pt) + (F[k].m ? ' ' + F[k].m : '')]);
      else if (!PT_NOT_GOALS.includes(k)) unused.push(name);
    }
    used.sort((a, b) => a[0] - b[0]);
    out.push('', 'PIERWSZE UŻYCIE (czas gry · misja): ' + (used.map((u) => u[1]).join(' · ') || '-'));
    out.push('NIE UŻYŁ: ' + (unused.join(', ') || '-'));
    const uses = {}, useNames = {};
    runs.forEach((r) => { for (const k in r.uses) uses[k] = (uses[k] || 0) + r.uses[k]; });
    for (const k in uses) useNames[useName(k)] = uses[k];
    out.push('UŻYCIA RAZEM: ' + (top(useNames) || '-'));
    const kinds = {}, style = {};
    let kills = 0;
    runs.forEach((r) => {
      kills += r.kills;
      for (const k in r.kinds) { const n = PT_KIND[k] || k; kinds[n] = (kinds[n] || 0) + r.kinds[k]; }
      for (const k in r.style) style[k] = (style[k] || 0) + r.style[k];
    });
    out.push('ZABÓJSTWA: ' + kills + (kills ? ' · ' + top(kinds) : '') + (sum(style) ? ' · stylowe: ' + top(style) : ''));
    const path = evs.filter((e) => e.k === 'ui').map((e) => e.at + ':' + e.id);
    out.push('MENU (kliknięcia po kolei): ' + (path.slice(0, 80).join(' → ') || '-') + (path.length > 80 ? ' …' : ''));

    // quick flags worth a look before reading everything
    const flags = [];
    const firstRun = runs[0];
    if (firstRun && firstRun.deaths.length >= 3) flags.push('Już w pierwszej misji (' + firstRun.m + ') ' + firstRun.deaths.length + ' zgony — start może być za trudny.');
    if (stalls.length) flags.push('Utknięcia: ' + stalls.length + ' — sprawdź te miejsca na mapie (misja, % długości).');
    if (locked.length) flags.push('Szedł do flagi ewakuacji przed wykonaniem celu — cel misji mógł być niejasny.');
    const lateFire = F['key:fire'] && F['key:fire'].pt > 30;
    if (!F['key:fire'] && L.playT > 20) flags.push('Ani razu nie strzelił.'); else if (lateFire) flags.push('Strzał znalazł dopiero po ' + T(F['key:fire'].pt) + ' gry.');
    if (!F.special && L.playT > 120) flags.push('Nie użył specjala mimo ' + T(L.playT) + ' gry.');
    if (!F['key:melee'] && L.playT > 180) flags.push('Nie nacisnął klawisza noża.');
    if (F['special:empty']) flags.push('Próbował specjala bez amunicji (' + (uses['special:empty'] || 0) + '×) — licznik specjali może być słabo widoczny.');
    if (idles) flags.push('Okresy bezczynności: ' + idles + ' — zapytaj, co się wtedy działo.');
    const quits = runs.filter((r) => /^quit/.test(r.result)).length;
    if (quits) flags.push('Przerwane misje: ' + quits + ' — zapytaj o powód.');
    if (flags.length) out.push('', 'SYGNAŁY DO SPRAWDZENIA:', ...flags.map((f) => '  • ' + f));

    out.push('', '--- DANE (JSON, dla Claude) ---', JSON.stringify(Object.assign({}, L, { runs })));
    return out.join('\n');
  },

  // ------------------------------------------------------------ testers
  archive() { const a = this.read(this.ARCHIVE); return Array.isArray(a) ? a : []; },
  // keep the finished log (the last 5 are kept); a log with nothing in it is dropped
  stash() {
    if (this.run) this.endRun('quit:tester');
    if (!this.log.runs.length && this.log.events.length <= 1) return;
    const a = this.archive();
    a.push(this.log);
    while (a.length > 5) a.shift();
    this.write(this.ARCHIVE, a);
  },
  newTester(label) {
    this.stash();
    // the owner's save goes aside once - later testers never overwrite it
    try {
      const cur = localStorage.getItem(Save.KEY);
      if (cur && !localStorage.getItem(this.BACKUP)) localStorage.setItem(this.BACKUP, cur);
    } catch (e) { /* storage blocked */ }
    Save.data = Save.defaults(); Save.save();
    this.log = this.fresh(label || 'Tester ' + (this.archive().filter((L) => /^Tester \d+$/.test(L.label || '')).length + 1));
    this.save();
    location.reload();
  },
  restoreSave() {
    let b = null;
    try { b = localStorage.getItem(this.BACKUP); } catch (e) { /* */ }
    if (!b) return;
    this.stash();
    try { localStorage.setItem(Save.KEY, b); localStorage.removeItem(this.BACKUP); } catch (e) { /* */ }
    this.log = this.fresh('');
    this.save();
    location.reload();
  },

  // ------------------------------------------------------------ panel (F3)
  toggle() {
    if (!this.on) return;
    if (!this.el) this.build();
    const show = this.el.style.display === 'none';
    if (show) {
      if (App.scene === PlayScene && !PlayScene.overlay && PlayScene.world && !App.pending) PlayScene.pause('panel');
      this.refresh();
    }
    this.el.style.display = show ? 'block' : 'none';
    if (!show && document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
  },
  selected() {
    const v = this.sel.value;
    if (v === 'cur') return this.log;
    return this.archive()[+v] || this.log;
  },
  refresh() {
    const a = this.archive(), cur = this.sel.value;
    this.sel.innerHTML = '';
    const opt = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; this.sel.appendChild(o); };
    const name = (L, i) => (L.label || (i == null ? 'bieżący log' : 'log ' + (i + 1))) + ' · ' + new Date(L.started).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    opt('cur', 'Teraz: ' + name(this.log));
    for (let i = a.length - 1; i >= 0; i--) opt(String(i), 'Archiwum: ' + name(a[i], i));
    this.sel.value = [...this.sel.options].some((o) => o.value === cur) ? cur : 'cur';
    const L = this.selected();
    this.text.value = this.report(L);
    this.stat.textContent = (L.label ? L.label + ' · ' : '') + L.runs.length + ' misji · ' + L.events.length + ' zdarzeń · czas gry ' + fmtTime(L.playT);
    let backup = false;
    try { backup = !!localStorage.getItem(this.BACKUP); } catch (e) { /* */ }
    this.bRestore.style.display = backup ? '' : 'none';
    const tuned = Object.keys(TunePanel.changed()).length;
    this.warn.textContent = tuned ? 'Uwaga: aktywne zmiany strojenia (' + tuned + ') — testerzy zagrają na nich. Reset w panelu F2 przywraca domyślne.' : '';
  },
  note(msg) { this.msg.textContent = msg; },
  copy(text) {
    const fallback = () => { this.text.value = text; this.text.focus(); this.text.select(); this.note('Zaznaczone — skopiuj Ctrl+C (na telefonie: Kopiuj z menu).'); };
    try { navigator.clipboard.writeText(text).then(() => this.note('Skopiowano — wklej raport w czacie z Claude.'), fallback); } catch (e) { fallback(); }
  },
  allReports() {
    const logs = this.archive().concat([this.log]).filter((L) => L.runs.length || L.events.length > 1);
    return logs.map((L) => this.report(L)).join('\n\n==========\n\n');
  },
  download(text) {
    try {
      const a = document.createElement('a');
      const d = new Date();
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      a.download = 'blast-battalion-playtest-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      this.note('Zapisano plik .txt (jeśli przeglądarka pozwoliła).');
    } catch (e) { this.note('Pobieranie zablokowane — użyj Kopiuj.'); }
  },
  build() {
    const css = document.createElement('style');
    css.textContent = `
#ptest { position: fixed; top: 8px; left: 8px; width: min(600px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; z-index: 1001; box-sizing: border-box;
  background: rgba(14,12,22,0.96); color: #e8e4f8; border: 1px solid #4a4666; border-radius: 8px; padding: 8px 10px 10px;
  font: 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,0.5); }
#ptest .hd { display: flex; align-items: center; gap: 6px; }
#ptest .hd b { flex: 1; font-size: 13px; color: #ffd23a; }
#ptest .row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
#ptest button, #ptest select, #ptest input { background: #2c2a3e; color: #e8e4f8; border: 1px solid #4a4666; border-radius: 4px; padding: 3px 7px; font: inherit; }
#ptest select { max-width: 100%; }
#ptest button { cursor: pointer; }
#ptest button:hover { background: #3a3852; }
#ptest .stat, #ptest .note { color: #9a98b0; font-size: 11px; margin-top: 4px; }
#ptest .note { min-height: 14px; }
#ptest .warn { color: #ffd23a; font-size: 11px; margin-top: 4px; }
#ptest h4 { margin: 10px 0 0; font-size: 11px; color: #9ad8ff; letter-spacing: 0.05em; }
#ptest textarea { display: block; width: 100%; height: 44vh; min-height: 150px; margin-top: 6px; box-sizing: border-box; background: #0e0c16; color: #e8e4f8;
  border: 1px solid #4a4666; font: 11px/1.35 ui-monospace, Consolas, monospace; white-space: pre-wrap; resize: vertical; }`;
    document.head.appendChild(css);
    const el = document.createElement('div');
    el.id = 'ptest';
    el.style.display = 'none';
    const mk = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
    const hd = mk('div', '', 'hd');
    const bClose = mk('button', '×'); bClose.title = 'Zamknij (F3)';
    bClose.addEventListener('click', () => this.toggle());
    hd.append(mk('b', 'Raport z testu'), bClose);
    this.stat = mk('div', '', 'stat');
    const row1 = mk('div', '', 'row');
    this.sel = document.createElement('select');
    this.sel.addEventListener('change', () => this.refresh());
    const bCopy = mk('button', 'Kopiuj'), bAll = mk('button', 'Kopiuj wszystkie'), bDl = mk('button', 'Pobierz .txt'), bRef = mk('button', 'Odśwież');
    bCopy.title = 'Kopiuj wybrany raport'; bAll.title = 'Kopiuj raporty wszystkich testerów (bieżący + archiwum)';
    bCopy.addEventListener('click', () => this.copy(this.text.value));
    bAll.addEventListener('click', () => this.copy(this.allReports()));
    bDl.addEventListener('click', () => this.download(this.allReports()));
    bRef.addEventListener('click', () => { this.refresh(); this.note('Odświeżono.'); });
    // embedded pages (the artifact viewer, portal iframes) usually may not download files
    let top = true;
    try { top = window.self === window.top; } catch (e) { top = false; }
    if (!top) bDl.style.display = 'none';
    row1.append(this.sel, bCopy, bAll, bDl, bRef);
    this.text = document.createElement('textarea');
    this.text.readOnly = true;
    const row2 = mk('div', '', 'row');
    const name = document.createElement('input');
    name.placeholder = 'np. Tester B'; name.maxLength = 24; name.size = 14;
    const bNew = mk('button', 'Nowy tester');
    bNew.title = 'Archiwizuje ten log, czyści postęp gry i przeładowuje stronę';
    bNew.addEventListener('click', () => {
      if (Date.now() > this.armT) {
        this.armT = Date.now() + 4000; bNew.textContent = 'Na pewno? Kliknij jeszcze raz';
        setTimeout(() => { if (Date.now() > this.armT) bNew.textContent = 'Nowy tester'; }, 4100);
        return;
      }
      this.newTester(name.value.trim());
    });
    this.bRestore = mk('button', 'Przywróć mój zapis');
    this.bRestore.title = 'Koniec testów: wraca Twój postęp sprzed pierwszego testera';
    this.bRestore.addEventListener('click', () => this.restoreSave());
    row2.append(mk('span', 'Nazwa:'), name, bNew, this.bRestore);
    this.warn = mk('div', '', 'warn');
    this.msg = mk('div', '', 'note');
    el.append(hd, this.stat, row1, this.text, mk('h4', 'KOLEJNY TESTER'), row2,
      mk('div', 'Nowy tester = nowy log i czysty postęp gry (jak u kogoś, kto gra pierwszy raz). Twój zapis zostaje odłożony i wraca po „Przywróć mój zapis”. Archiwum trzyma 5 ostatnich logów.', 'stat'),
      this.warn, this.msg);
    // keys typed in the panel stay in the panel (F3 / Esc close it)
    el.addEventListener('keydown', (e) => {
      if (e.code === 'F3' || e.code === 'Escape') { e.preventDefault(); this.toggle(); }
      e.stopPropagation();
    });
    document.body.appendChild(el);
    this.el = el;
  },
};
