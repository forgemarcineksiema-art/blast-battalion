'use strict';
// ============================================================================
//  BLAST BATTALION - core: constants, math helpers, seeded RNG, input
// ============================================================================

const GAME_TITLE = 'BLAST BATTALION';
const GAME_ID = 'blastbattalion';
const VERSION = '1.33.1';
const TILE = 16;
const STEP = 1 / 60;
const BASE_GRAVITY = 900;
let GRAVITY = BASE_GRAVITY; // a mission may change it (the daily LOW GRAVITY rule); reset when it ends
const SHAKE_LEVELS = [0, 0.45, 1];

// ---------------------------------------------------------------------------
//  Tunable gameplay numbers. The defaults are the shipped values; the live
//  tuning panel (src/tune.js, F2 in dev/web/artifact builds) overrides them.
// ---------------------------------------------------------------------------
const TUNE_DEFS = [
  { key: 'runSpeed', group: 'RUCH', label: 'Prędkość biegu', def: 102, min: 60, max: 170, step: 1, unit: ' px/s' },
  { key: 'accel', group: 'RUCH', label: 'Przyspieszenie na ziemi', def: 1300, min: 400, max: 3000, step: 50 },
  { key: 'turnMul', group: 'RUCH', label: 'Siła zawracania ×', def: 2, min: 1, max: 4, step: 0.1 },
  { key: 'airAccel', group: 'RUCH', label: 'Sterowność w powietrzu', def: 850, min: 200, max: 2000, step: 50 },
  { key: 'jumpVel', group: 'RUCH', label: 'Siła skoku', def: 330, min: 240, max: 440, step: 5 },
  { key: 'jumpCut', group: 'RUCH', label: 'Krótki skok po puszczeniu ×', def: 0.62, min: 0.2, max: 1, step: 0.05, hint: '1 = puszczenie przycisku nie skraca skoku' },
  { key: 'fallGrav', group: 'RUCH', label: 'Grawitacja opadania ×', def: 1.5, min: 0.8, max: 2.5, step: 0.05 },
  { key: 'apexHang', group: 'RUCH', label: 'Zawiśnięcie na szczycie ×', def: 0.55, min: 0.3, max: 1, step: 0.05, hint: '1 = bez zawiśnięcia' },
  { key: 'maxFall', group: 'RUCH', label: 'Maks. prędkość spadania', def: 470, min: 300, max: 700, step: 10, unit: ' px/s' },
  { key: 'coyote', group: 'RUCH', label: 'Coyote time', def: 0.1, min: 0, max: 0.25, step: 0.01, unit: ' s', hint: 'skok jeszcze chwilę po zejściu z krawędzi' },
  { key: 'jumpBuffer', group: 'RUCH', label: 'Bufor skoku', def: 0.15, min: 0, max: 0.3, step: 0.01, unit: ' s', hint: 'skok wciśnięty chwilę przed lądowaniem' },
  { key: 'climbSpeed', group: 'RUCH', label: 'Wspinaczka po ścianie', def: 92, min: 40, max: 160, step: 2, unit: ' px/s' },
  { key: 'slideSpeed', group: 'RUCH', label: 'Prędkość ślizgu', def: 190, min: 120, max: 300, step: 5, unit: ' px/s' },
  { key: 'slideTime', group: 'RUCH', label: 'Czas ślizgu', def: 0.42, min: 0.2, max: 0.8, step: 0.02, unit: ' s' },
  { key: 'stompBounce', group: 'RUCH', label: 'Odbicie z deptania', def: 250, min: 150, max: 400, step: 5 },
  { key: 'rangeMul', group: 'STRZELANIE', label: 'Zasięg broni ×', def: 1, min: 0.5, max: 2, step: 0.05 },
  { key: 'hitRadius', group: 'STRZELANIE', label: 'Obszar trafienia kul', def: 2.5, min: 1, max: 6, step: 0.5, unit: ' px' },
  { key: 'aimMax', group: 'STRZELANIE', label: 'Wspomaganie celowania: kąt', def: 18, min: 0, max: 35, step: 1, unit: '°', hint: '0 = wyłączone' },
  { key: 'aimBand', group: 'STRZELANIE', label: 'Wspomaganie celowania: wysokość', def: 28, min: 0, max: 48, step: 1, unit: ' px', hint: '16 px = jeden kafel' },
  { key: 'blastMul', group: 'STRZELANIE', label: 'Promień wybuchów gracza ×', def: 1, min: 0.6, max: 1.8, step: 0.05 },
  { key: 'blastJump', group: 'STRZELANIE', label: 'Podrzut z własnego wybuchu', def: 0.95, min: 0, max: 1.6, step: 0.05 },
  { key: 'killFreeze', group: 'STRZELANIE', label: 'Stop-klatka przy zabójstwie', def: 45, min: 0, max: 100, step: 5, unit: ' ms' },
  { key: 'bulletPace', group: 'STRZELANIE', label: 'Prędkość pocisków bohatera ×', def: 0.8, min: 0.5, max: 1.3, step: 0.05, hint: 'wolniej = widać lot kuli; zasięg się nie zmienia' },
  // the camera (src/camera.js); camNew 0 = the 1.29 camera, for comparison
  { key: 'camNew', group: 'KAMERA', label: 'Kamera: nowa (1) / stara (0)', def: 1, min: 0, max: 1, step: 1, hint: '0 = kamera z wersji 1.29 (do porównania)' },
  { key: 'camLead', group: 'KAMERA', label: 'Wyprzedzenie kamery', def: 14, min: 0, max: 30, step: 1, unit: '% ekranu' },
  { key: 'camTurn', group: 'KAMERA', label: 'Przejście przy zmianie kierunku', def: 0.9, min: 0.1, max: 2, step: 0.05, unit: ' s', hint: 'czas przesunięcia wyprzedzenia na drugą stronę' },
  { key: 'camLagX', group: 'KAMERA', label: 'Opóźnienie w poziomie', def: 0.2, min: 0.06, max: 0.5, step: 0.01, unit: ' s', hint: 'jak daleko kamera zostaje za bohaterem; mniej = sztywniej' },
  { key: 'camLagY', group: 'KAMERA', label: 'Opóźnienie w pionie', def: 0.28, min: 0.06, max: 0.6, step: 0.01, unit: ' s' },
  { key: 'camJump', group: 'KAMERA', label: 'Pionowy luz w skoku', def: 64, min: 0, max: 120, step: 4, unit: ' px', hint: '0 = kamera podąża za każdym skokiem' },
  { key: 'camStep', group: 'KAMERA', label: 'Próg zmiany wysokości podłoża', def: 20, min: 0, max: 48, step: 2, unit: ' px', hint: 'nierówności do tej wysokości nie ruszają kamery (kafel = 16 px)' },
  { key: 'camFall', group: 'KAMERA', label: 'Patrzenie w dół przy spadaniu', def: 1, min: 0, max: 1, step: 0.05, hint: '1 = w długim spadku bohater u góry kadru, lądowisko widać wcześniej; 0 = wyłączone' },
  { key: 'camCue', group: 'KAMERA', label: 'Kadrowanie bossa', def: 0.5, min: 0, max: 1, step: 0.05, hint: '0 = kamera patrzy tylko na bohatera; 1 = środek między bohaterem a bossem' },
  { key: 'camTravel', group: 'KAMERA', label: 'Po śmierci: przejazd do', def: 1, min: 0, max: 4, step: 0.1, unit: ' ekranu', hint: 'dalej niż to = krótkie ściemnienie i cięcie' },
  { key: 'shakeMax', group: 'KAMERA', label: 'Wstrząsy: maks. wychylenie', def: 7, min: 0, max: 14, step: 0.5, unit: ' px' },
  { key: 'kickMul', group: 'KAMERA', label: 'Odrzut kamery ×', def: 1, min: 0, max: 3, step: 0.1 },
  { key: 'heroHp', group: 'WROGOWIE I TRAFIENIA', label: 'HP bohatera', def: 0, min: 0, max: 5, step: 1, hint: '0 = według poziomu trudności' },
  { key: 'hurtInv', group: 'WROGOWIE I TRAFIENIA', label: 'Nietykalność po trafieniu', def: 1.2, min: 0.3, max: 3, step: 0.1, unit: ' s' },
  { key: 'hurtInset', group: 'WROGOWIE I TRAFIENIA', label: 'Węższy obrys trafień', def: 2, min: 0, max: 4, step: 1, unit: ' px' },
  { key: 'enemyReact', group: 'WROGOWIE I TRAFIENIA', label: 'Czas reakcji wroga ×', def: 1, min: 0.3, max: 2.5, step: 0.05 },
  { key: 'enemyAim', group: 'WROGOWIE I TRAFIENIA', label: 'Czas celowania wroga ×', def: 1, min: 0, max: 2.5, step: 0.05, hint: '0 = strzał bez linii celownika' },
  { key: 'enemyBullet', group: 'WROGOWIE I TRAFIENIA', label: 'Prędkość kul wroga ×', def: 1, min: 0.5, max: 1.6, step: 0.05 },
  { key: 'enemySpread', group: 'WROGOWIE I TRAFIENIA', label: 'Rozrzut pierwszych serii', def: 0.08, min: 0, max: 0.25, step: 0.01 },
  { key: 'enemyFocus', group: 'WROGOWIE I TRAFIENIA', label: 'Tempo namierzania wroga', def: 0.6, min: 0.1, max: 2, step: 0.05, unit: '/s' },
  // characters (1.32): poses and how long reactions take; charAnim 0 = the 1.31 poses, for comparison
  { key: 'charAnim', group: 'POSTACIE', label: 'Animacje postaci: nowe (1) / stare (0)', def: 1, min: 0, max: 1, step: 1, hint: '0 = pozy i reakcje z wersji 1.31 (do porównania)' },
  { key: 'poseTime', group: 'POSTACIE', label: 'Długość póz ×', def: 1, min: 0.3, max: 2.5, step: 0.05, hint: 'lądowanie, drgnięcie po trafieniu, radość, przeładowanie' },
  { key: 'spotHop', group: 'POSTACIE', label: 'Podskok wroga na „!”', def: 95, min: 0, max: 180, step: 5, unit: ' px/s', hint: '0 = bez podskoku (95 = ok. 5 px)' },
  { key: 'grenadeWind', group: 'POSTACIE', label: 'Granatnik: zamach przed rzutem', def: 0.35, min: 0, max: 0.8, step: 0.05, unit: ' s', hint: 'wyciąga zawleczkę i unosi rękę; 0 = rzut od razu' },
  { key: 'mortarWind', group: 'POSTACIE', label: 'Moździerzysta: pocisk do lufy', def: 0.3, min: 0, max: 0.8, step: 0.05, unit: ' s', hint: '0 = strzał od razu' },
  { key: 'knockDown', group: 'POSTACIE', label: 'Fala uderzeniowa: żołnierz leży', def: 0.55, min: 0, max: 1.2, step: 0.05, unit: ' s', hint: 'potem wstaje; 0 = tylko się zatacza' },
  { key: 'enemyCheer', group: 'POSTACIE', label: 'Wrogowie cieszą się ze śmierci bohatera', def: 1.2, min: 0, max: 2.5, step: 0.1, unit: ' s', hint: '0 = wyłączone' },
  { key: 'idleFidget', group: 'POSTACIE', label: 'Wiercenie się w bezruchu po', def: 3.5, min: 0, max: 10, step: 0.5, unit: ' s', hint: '0 = wyłączone' },
  { key: 'bossWarn', group: 'POSTACIE', label: 'Zapowiedzi ataków bossów ×', def: 1, min: 0, max: 2, step: 0.05, hint: 'działo i KM czołgu, rakiety i bomby śmigłowca, miotacz mecha; 0 = jak w 1.31' },
  { key: 'fxLinger', group: 'GRA', label: 'Długość wybuchów i dymu ×', def: 1.3, min: 0.7, max: 2, step: 0.05 },
  { key: 'crackTime', group: 'GRA', label: 'Trzeszczenie przed zawaleniem', def: 0.45, min: 0, max: 1.2, step: 0.05, unit: ' s', hint: '0 = spada od razu' },
  { key: 'worldGrav', group: 'GRA', label: 'Grawitacja ciał, gruzu i klocków ×', def: 0.6, min: 0.3, max: 1, step: 0.05, hint: 'bohater i żołnierze mają zwykłą; mniej = dłuższy, czytelniejszy lot rzeczy' },
  { key: 'deathSlow', group: 'GRA', label: 'Zwolnienie przy śmierci bohatera', def: 0.8, min: 0, max: 2, step: 0.1, unit: ' s', hint: '0 = bez zwolnienia' },
  { key: 'timeScale', group: 'GRA', label: 'Prędkość gry ×', def: 1, min: 0.25, max: 1.5, step: 0.05 },
];
const TUNE = {};
for (const d of TUNE_DEFS) TUNE[d.key] = d.def;
// Named kills (label, bonus points): how the game rewards using the world against the enemy
const STYLE = {
  chain: ['CHAIN REACTION', 150], crush: ['CRUSHED', 150], splat: ['SPLAT', 150], friendly: ['FRIENDLY FIRE', 200],
  stomp: ['STOMPED', 100], tackle: ['TACKLED', 100], bowl: ['BOWLED OVER', 200], kick: ['BARREL KICK', 200],
  burn: ['TOASTED', 50], reflect: ['RETURN TO SENDER', 250], air: ['AIRBORNE', 100],
  thrown: ['THROWN', 150], shield: ['HUMAN SHIELD', 150],
  flash: ['FLASH FIRE', 150], bridge: ['BRIDGE OUT', 200], juggle: ['AIR JUGGLE', 50],
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const fmtNum = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtTime = (s) => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  range(a, b) { return a + this.f() * (b - a); }
  int(a, b) { return Math.floor(a + this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  weighted(obj) {
    let total = 0;
    for (const k in obj) total += obj[k];
    let r = this.f() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  }
}

// Cheap 2D value noise (seeded) used by the level generator.
function makeNoise2D(seed) {
  const rng = new RNG(seed);
  const perm = new Float32Array(512);
  for (let i = 0; i < 512; i++) perm[i] = rng.next();
  const h = (x, y) => perm[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}

// ----------------------------------------------------------------------------
//  Input: keyboard + gamepad + touch, routed into per-player slots.
//  1 player: every device drives slot 0.  2 players (Input.coop): the keyboard
//  is split (P1 = WASD side, P2 = arrows side) and gamepads get a slot each.
//  Input.down/hit (used by menus) see all slots merged.
// ----------------------------------------------------------------------------
const BUTTONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'special', 'melee', 'pause', 'confirm', 'back'];

function makeSlot() {
  return {
    kb: {}, held: {}, pad: {}, touch: {}, state: {}, prev: {}, latch: {}, pressed: {}, released: {},
    down(b) { return !!this.state[b]; },
    hit(b) { return !!this.pressed[b]; },
  };
}

const Input = {
  slots: [makeSlot(), makeSlot()],
  state: {}, pressed: {},
  coop: false,
  mode: 'keyboard',
  pointerEvents: [],
  pointer: { x: -1, y: -1, down: false },
  isTouchDevice: false,
  keymap: {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump',
    KeyJ: 'fire', KeyX: 'fire',
    KeyK: 'special', KeyC: 'special',
    KeyL: 'melee', KeyV: 'melee',
  },
  // two players sharing one keyboard: P1 left hand WASD + right hand F/G/H,
  // P2 right hand arrows + left hand K/L/; (or the numpad)
  keymapP1: { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'jump', KeyF: 'fire', KeyG: 'special', KeyH: 'melee' },
  keymapP2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyK: 'fire', KeyL: 'special', Semicolon: 'melee',
    Numpad0: 'jump', Numpad1: 'fire', Numpad2: 'special', Numpad3: 'melee',
  },
  sharedKeys: { Escape: 'pause', KeyP: 'pause', Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'back' },

  // single-slot aliases (touch controls, dev harness)
  get kb() { return this.slots[0].kb; },
  get latch() { return this.slots[0].latch; },
  get touch() { return this.slots[0].touch; },
  set touch(v) { this.slots[0].touch = v; },

  route(code) {
    if (this.sharedKeys[code]) return [0, this.sharedKeys[code]];
    if (!this.coop) return this.keymap[code] ? [0, this.keymap[code]] : null;
    if (this.keymapP1[code]) return [0, this.keymapP1[code]];
    if (this.keymapP2[code]) return [1, this.keymapP2[code]];
    return null;
  },
  // keys that also confirm in menus
  confirmKey(code) { return code === 'Space' || code === 'KeyJ' || (this.coop && (code === 'KeyF' || code === 'KeyK')); },

  init(canvas) {
    this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.mode = 'touch';
    // keys that would scroll or move focus in the portal page around the game (it sits in an iframe
    // in a long page): the page must never move under the player (1.34: + PageUp/Down, Home, End)
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace', 'PageUp', 'PageDown', 'Home', 'End']);
    // the mouse wheel over the game scrolls nothing either (Poki's own rule for its page)
    // (the dev panels, F2 / F3, keep their own scrolling)
    window.addEventListener('wheel', (e) => { if (!(e.target && e.target.closest && e.target.closest('#tune, #ptest'))) e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      if (block.has(e.code)) e.preventDefault();
      const r = this.route(e.code);
      if (r) this.press(r[0], r[1], e.code, e.repeat);
      if (this.confirmKey(e.code)) this.press(0, 'confirm', e.code, e.repeat);
      if (this.mode !== 'keyboard' && !e.repeat) this.mode = 'keyboard';
      Sound.unlock();
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      // release in every slot: the routing may have changed while the key was down
      for (let i = 0; i < this.slots.length; i++) for (const b of BUTTONS) this.release(i, b, e.code);
    });
    window.addEventListener('blur', () => this.clear());

    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height };
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const p = toGame(e);
      if (e.pointerType === 'touch') this.mode = 'touch';
      else if (this.mode === 'touch' && e.pointerType === 'mouse') this.mode = 'keyboard';
      this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.down = true;
      this.pointerEvents.push({ type: 'down', id: e.pointerId, x: p.x, y: p.y, touch: e.pointerType === 'touch' });
      Sound.unlock();
      window.focus();
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      const p = toGame(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointerEvents.push({ type: 'move', id: e.pointerId, x: p.x, y: p.y, touch: e.pointerType === 'touch' });
    });
    const up = (e) => {
      const p = toGame(e);
      this.pointer.down = false;
      this.pointerEvents.push({ type: 'up', id: e.pointerId, x: p.x, y: p.y, touch: e.pointerType === 'touch' });
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari only lets audio start from touchend/click gestures
    window.addEventListener('touchend', () => Sound.unlock(), { passive: true });
    window.addEventListener('click', () => Sound.unlock());
  },

  // A button stays down while ANY of its keys is held (A and <- share 'left');
  // OS auto-repeat is never a new press, even right after clear().
  press(slot, b, code, repeat) {
    const s = this.slots[slot];
    const set = s.held[b] || (s.held[b] = new Set());
    const wasDown = set.size > 0;
    set.add(code);
    s.kb[b] = true;
    if (!wasDown) { if (repeat) s.prev[b] = true; else s.latch[b] = true; }
  },
  release(slot, b, code) {
    const s = this.slots[slot];
    const set = s.held[b];
    if (!set || !set.has(code)) return;
    set.delete(code);
    s.kb[b] = set.size > 0;
  },

  setCoop(on) { this.coop = !!on; this.clear(); },

  clear() {
    for (const s of this.slots) {
      s.kb = {}; s.touch = {}; s.pad = {}; s.held = {};
      for (const b of BUTTONS) { s.state[b] = false; s.latch[b] = false; }
    }
  },

  pollGamepad() {
    for (const s of this.slots) s.pad = {};
    if (!navigator.getGamepads) return;
    const pads = [...navigator.getGamepads()].filter((gp) => gp && gp.connected);
    pads.forEach((gp, n) => {
      // co-op: the first pad goes to P2 (typical setup = keyboard P1 + pad P2)
      const slot = this.coop ? (n === 0 ? 1 : 0) : 0;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const p = this.slots[slot].pad;
      p.left = p.left || ax < -0.4 || b(14);
      p.right = p.right || ax > 0.4 || b(15);
      p.up = p.up || ay < -0.5 || b(12);
      p.down = p.down || ay > 0.5 || b(13);
      p.jump = p.jump || b(0) || b(4);
      p.fire = p.fire || b(2) || b(7) || b(5);
      p.special = p.special || b(1) || b(6);
      p.melee = p.melee || b(3);
      p.pause = p.pause || b(9);
      p.confirm = p.confirm || b(0);
      p.back = p.back || b(8); // Select - B stays the special button in-game
      if (b(0) || b(1) || b(2) || b(3) || Math.abs(ax) > 0.5) {
        this.mode = 'gamepad';
        // a pad makes no DOM events: tell the portal adapter the player has pressed something
        if (typeof Platform !== 'undefined') Platform.noteInput();
      }
    });
  },

  poll() {
    this.pollGamepad();
    for (const s of this.slots) {
      for (const b of BUTTONS) {
        const d = !!(s.kb[b] || s.touch[b] || s.pad[b]);
        s.pressed[b] = (d && !s.prev[b]) || !!s.latch[b];
        s.released[b] = !d && !!s.prev[b];
        s.state[b] = d;
        s.prev[b] = d;
        s.latch[b] = false;
      }
    }
    for (const b of BUTTONS) {
      this.state[b] = this.slots[0].state[b] || this.slots[1].state[b];
      this.pressed[b] = this.slots[0].pressed[b] || this.slots[1].pressed[b];
    }
  },

  down(b) { return !!this.state[b]; },
  hit(b) { return !!this.pressed[b]; },
  takePointerEvents() { const ev = this.pointerEvents; this.pointerEvents = []; return ev; },
};
