'use strict';
// ============================================================================
//  Options and accessibility. One screen, reachable from the title and from
//  the pause menu: sound, music, screen shake, effects quality, reduced
//  flashing, aim assist, auto fire, vibration and keyboard remapping. Plus
//  the helpers the game asks every frame (is auto fire on, how strong is the
//  aim assist, should flashes be toned down) and a buzz for phones.
// ============================================================================

const KEY_DEFAULTS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyZ'], fire: ['KeyJ', 'KeyX'], special: ['KeyK', 'KeyC'], melee: ['KeyL', 'KeyV'],
};
const KEY_ACTIONS = [
  ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'], ['up', 'UP / CLIMB'], ['down', 'DOWN / SLIDE'],
  ['jump', 'JUMP'], ['fire', 'SHOOT'], ['special', 'SPECIAL'], ['melee', 'KNIFE / GRAB'],
];
// keys that keep their job (pause, menus, dev panels)
const KEY_RESERVED = new Set(['Escape', 'KeyP', 'Enter', 'NumpadEnter', 'Backspace', 'F2', 'F3', 'Backquote', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu']);
// how far each weapon reaches for auto fire (px ahead of the gun)
const AUTO_RANGE = { buck: 170, scorch: 95, ronin: 30, ricochet: 230, volt: 200, deadeye: 420, boomer: 300 };

const Settings = {
  // null in the save = the right default for this device
  autoFire() { const v = Save.data.autofire; return v == null ? !!Input.isTouchDevice : !!v; },
  aimLevel() { return Save.data.aim || (Input.isTouchDevice ? 'high' : 'normal'); },
  aimMul() { return { off: 0, normal: 1, high: 1.55 }[this.aimLevel()] ?? 1; },
  aimBandMul() { return this.aimLevel() === 'high' ? 1.4 : 1; },
  calm() { return !!Save.data.calm; },
  // blood and gibs: off by default on CrazyGames (young audience, PEGI 12), on in the web build, and the
  // player can switch it in OPTIONS. Poki allows no visible body fluids at all: never there, and no option
  bloodOption() { return String(window.GAME_PLATFORM || 'none') !== 'poki'; },
  gore() {
    if (!this.bloodOption()) return false;
    const v = Save.data.blood; return v == null ? String(window.GAME_PLATFORM || 'none') === 'none' : !!v;
  },
  canVibrate() { return !!Input.isTouchDevice && typeof navigator.vibrate === 'function'; },
  haptic(pattern) {
    if (Save.data.vibrate === false || !this.canVibrate()) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed here */ }
  },
  apply() { FX.calm = this.calm(); this.applyKeys(); },

  // ---- keyboard mapping (single-player layout; co-op keeps its split layout)
  keys(action) { const k = Save.data.keys && Save.data.keys[action]; return Array.isArray(k) && k.length ? k : KEY_DEFAULTS[action]; },
  applyKeys() {
    const map = {};
    for (const a in KEY_DEFAULTS) for (const c of this.keys(a)) map[c] = a;
    Input.keymap = map;
  },
  // the new key becomes the main one, the old main one the spare; nobody else keeps it
  bind(action, code) {
    const keys = {};
    for (const a in KEY_DEFAULTS) keys[a] = this.keys(a).filter((c) => c !== code);
    const old = keys[action];
    keys[action] = [code].concat(old.length ? [old[0]] : []);
    Save.data.keys = keys; Save.save();
    this.applyKeys();
  },
  resetKeys() { Save.data.keys = null; Save.save(); this.applyKeys(); },
  keyName(c) {
    if (!c) return '-';
    if (c.startsWith('Key')) return c.slice(3);
    if (c.startsWith('Digit')) return c.slice(5);
    if (c.startsWith('Numpad')) return 'NUM ' + c.slice(6).toUpperCase().slice(0, 3);
    return ({
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R.SHIFT',
      ControlLeft: 'CTRL', ControlRight: 'R.CTRL', AltLeft: 'ALT', AltRight: 'R.ALT', Comma: ',', Period: '.', Slash: '/',
      Semicolon: ';', Quote: '"', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backslash: '|', CapsLock: 'CAPS',
      Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PG UP', PageDown: 'PG DN',
    })[c] || c.toUpperCase().slice(0, 7);
  },
  keyLabel(action, max = 2) { return this.keys(action).slice(0, max).map((c) => this.keyName(c)).join(' / '); },
  // "A D / ← →"
  pairLabel(a, b) {
    const ka = this.keys(a), kb = this.keys(b), out = [];
    for (let i = 0; i < 2; i++) if (ka[i] && kb[i]) out.push(this.keyName(ka[i]) + ' ' + this.keyName(kb[i]));
    return out.join(' / ');
  },
};

// ---------------------------------------------------------------------------
//  Options panel: used as a scene (from the title) and as an overlay (pause)
// ---------------------------------------------------------------------------
const OptionsPanel = {
  mode: 'options', back: null, waiting: null, t: 0, msg: '',
  open(back) {
    this.back = back; this.mode = 'options'; this.waiting = null; this.t = 0; this.msg = '';
    this.menu = new Menu();
    this.layout();
    if (!this.keyHook) {
      // while waiting for a new key, catch it before the game sees it
      this.keyHook = (e) => {
        if (!this.waiting) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === 'Escape' || e.code === 'Backspace') { this.waiting = null; this.msg = ''; this.layout(); return; }
        if (KEY_RESERVED.has(e.code)) { this.msg = Settings.keyName(e.code) + ' IS TAKEN - PICK ANOTHER'; return; }
        Settings.bind(this.waiting, e.code);
        this.msg = ''; this.waiting = null; this.layout();
        Sound.play('pickup', 0.6);
      };
      window.addEventListener('keydown', this.keyHook, true);
    }
  },
  rows() {
    if (this.mode === 'controls') {
      const r = KEY_ACTIONS.map(([a, name]) => ({
        id: 'key_' + a, name, value: this.waiting === a ? 'PRESS A KEY...' : Settings.keyLabel(a),
        short: this.waiting === a ? 'PRESS KEY' : Settings.keyLabel(a, 1), // for narrow two-column rows
        act: () => { this.waiting = a; this.msg = ''; this.layout(); },
      }));
      r.push({ id: 'keys_reset', name: 'RESET TO DEFAULT', value: '', act: () => { Settings.resetKeys(); this.layout(); } });
      r.push({ id: 'keys_back', name: 'BACK', value: '', act: () => { this.mode = 'options'; this.waiting = null; this.layout(); } });
      return r;
    }
    const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
    const r = [
      { id: 'sfx', name: 'SOUND EFFECTS', value: Sound.sfxOn ? 'ON' : 'OFF', act: () => toggleSfx() },
      { id: 'music', name: 'MUSIC', value: Sound.musicOn ? 'ON' : 'OFF', act: () => toggleMusic() },
      { id: 'shake', name: 'SCREEN SHAKE', value: ['OFF', 'LOW', 'FULL'][Save.data.shake == null ? 2 : Save.data.shake], act: () => toggleShake() },
      { id: 'fx', name: 'EFFECTS', value: ({ auto: 'AUTO', full: 'FULL', lite: 'LITE' })[Save.data.fx || 'auto'], act: () => toggleFx() },
      { id: 'calm', name: 'FLASHING', value: Settings.calm() ? 'REDUCED' : 'NORMAL', act: () => { Save.data.calm = !Settings.calm(); Save.save(); Settings.apply(); } },
      ...(Settings.bloodOption() ? [{ id: 'blood', name: 'BLOOD', value: Settings.gore() ? 'ON' : 'OFF', act: () => { Save.data.blood = !Settings.gore(); Save.save(); } }] : []),
      { id: 'aim', name: 'AIM ASSIST', value: Settings.aimLevel().toUpperCase(), act: () => { Save.data.aim = cycle(['off', 'normal', 'high'], Settings.aimLevel()); Save.save(); } },
      { id: 'autofire', name: 'AUTO FIRE', value: Settings.autoFire() ? 'ON' : 'OFF', act: () => { Save.data.autofire = !Settings.autoFire(); Save.save(); } },
    ];
    r.push({ id: 'lang', name: 'LANGUAGE', value: L10N.name(L10N.lang), act: () => { const c = L10N.next(); Save.data.lang = c; Save.save(); L10N.set(c); Funnel.ev('language', c, 'selected'); } });
    if (Settings.canVibrate()) r.push({ id: 'vibrate', name: 'VIBRATION', value: Save.data.vibrate === false ? 'OFF' : 'ON', act: () => { Save.data.vibrate = Save.data.vibrate === false; Save.save(); Settings.haptic(40); } });
    // key bindings mean nothing on a touch-only phone
    if (Input.mode !== 'touch') r.push({ id: 'controls', name: 'KEYBOARD CONTROLS', value: '>', act: () => { this.mode = 'controls'; this.layout(); } });
    r.push({ id: 'back', name: 'BACK', value: '', act: () => this.close() });
    return r;
  },
  close() { this.waiting = null; if (this.back) this.back(); },
  layout() {
    const W = Gfx.W, H = Gfx.H, rows = this.rows(), n = rows.length;
    // fingers get taller rows; two columns on touch screens and whenever one column would not fit
    const touch = Input.mode === 'touch', bh = touch ? 18 : 14, gap = touch ? 4 : 3, step = bh + gap;
    const noteH = this.mode === 'controls' ? 12 : 0;
    const two = touch || n * step - gap + 38 + noteH > H - 6;
    const bw = two ? Math.min(160, Math.floor((W - 40) / 2)) : Math.min(240, W - 24);
    const fullW = two ? bw * 2 + 6 : bw;
    const lines = two ? Math.ceil((n - 1) / 2) + 1 : n; // BACK gets a full-width row of its own
    const total = lines * step - gap;
    const x = Math.round(W / 2 - fullW / 2), y0 = Math.round(Math.max(26, H / 2 - total / 2 + 8 - noteH / 2));
    this.box = { x: x - 8, y: y0 - 24, w: fullW + 16, h: total + 38 };
    this.menu.set(rows.map((r, i) => {
      let bx = x, by = y0 + i * step, w = bw;
      if (two && i === n - 1) { by = y0 + (lines - 1) * step; w = fullW; }
      else if (two) { bx = x + (i % 2) * (bw + 6); by = y0 + Math.floor(i / 2) * step; }
      return new Btn({
        id: r.id, x: bx, y: by, w, h: bh, label: '', rivets: false,
        onClick: () => { r.act(); if (this.mode === 'options' || r.id === 'keys_reset') this.layout(); },
        drawFn: (ctx, b, focused, pressed) => {
          drawButton(ctx, b, focused, pressed);
          const ty = b.y + (pressed ? 1 : 0) + Math.round((b.h - 8) / 2);
          const vcol = this.waiting && r.id === 'key_' + this.waiting ? '#ffd23a' : '#9ad8ff';
          const v = r.short && Font.width(r.name) + Font.width(r.value) + 18 > b.w ? r.short : r.value;
          // a long name (other languages) gets finer letters rather than run into its value
          UI.stampK(r.name, UI.X(b.x + 6), UI.X(ty), '#eef1f4', UI.kFor(r.name, b.w - 16 - (v ? Font.width(v) : 0)));
          if (v) UI.stamp(v, b.x + b.w - 6, ty, vcol, 1, 'right');
        },
      });
    }));
  },
  update(dt, events) {
    this.t += dt;
    if (!this.waiting && (Input.hit('pause') || Input.hit('back'))) {
      if (this.mode === 'controls') { this.mode = 'options'; this.layout(); } else this.close();
      return;
    }
    if (!this.waiting) this.menu.update(events);
    else for (const ev of events) if (ev.type === 'down') { this.waiting = null; this.msg = ''; this.layout(); } // a tap cancels
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, b = this.box;
    UI.plate(b.x, b.y, b.w, b.h, 'dark');
    UI.stamp(this.mode === 'controls' ? 'KEYBOARD CONTROLS' : 'OPTIONS', W / 2, b.y + 7, '#ffd23a', 1, 'center');
    this.menu.draw(ctx);
    const note = this.msg || (this.mode === 'controls' ? (this.waiting ? 'ESC CANCELS' : 'CO-OP KEEPS ITS OWN LAYOUT') : '');
    if (note) UI.otext(note, W / 2, Math.min(H - 10, b.y + b.h + 4), this.msg ? '#ff8a6a' : '#8a88a0', 1, 'center');
  },
};

// Options from the title screen: the panel over the animated backdrop
const OptionsScene = {
  enter() { OptionsPanel.open(() => App.go(TitleScene)); },
  layout() { OptionsPanel.layout(); },
  update(dt) { Backdrop.update(dt); OptionsPanel.update(dt, Input.takePointerEvents()); },
  draw(ctx) { Backdrop.draw(ctx, 0.55); OptionsPanel.draw(ctx); },
};

// Options from the pause menu: same panel; BACK returns to the pause menu
const OptionsOverlay = {
  live: false,
  open() { OptionsPanel.open(() => { PlayScene.overlay = PauseOverlay; PauseOverlay.open(); }); },
  layout() { OptionsPanel.layout(); },
  update(dt, events) { OptionsPanel.update(dt, events); },
  draw(ctx) {
    ctx.fillStyle = 'rgba(10,8,16,0.72)'; ctx.fillRect(0, 0, Gfx.W, Gfx.H);
    OptionsPanel.draw(ctx);
  },
};
