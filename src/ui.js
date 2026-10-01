'use strict';
// ============================================================================
//  UI: scene manager, menus, overlays, touch controls
// ============================================================================

class Btn {
  constructor(o) {
    Object.assign(this, { x: 0, y: 0, w: 80, h: 18, label: '', onClick: null, enabled: true, scale: 1, drawFn: null, hotkey: null }, o);
  }
  hit(px, py) { return px >= this.x && py >= this.y && px < this.x + this.w && py < this.y + this.h; }
  draw(ctx, focused, pressed) {
    if (this.drawFn) this.drawFn(ctx, this, focused, pressed);
    else drawButton(ctx, this, focused, pressed);
  }
}

// Buttons are plates from the menu kit (src/uikit.js): metal; the one main action hazard yellow
// (it shows on touch screens too, where no focus is drawn); the current choice brass.
// b.icon: a picture (UI_ICONS / ICONS) or a font glyph before the label (or alone), b.sub: a small
// second line, b.off: the picture struck through, b.badge: a blinking light in the corner
function drawButton(ctx, b, focused, pressed, iconW = 0) { return UI.button(b, focused, pressed, iconW); }

class Menu {
  constructor() { this.buttons = []; this.focus = 0; this.downIdx = -1; }
  set(buttons, keepFocus = true) {
    const prev = this.buttons[this.focus] && this.buttons[this.focus].id;
    this.buttons = buttons;
    if (keepFocus && prev) { const i = buttons.findIndex((b) => b.id === prev); if (i >= 0) { this.focus = i; return; } }
    if (this.focus >= buttons.length || !buttons[this.focus] || !buttons[this.focus].enabled) this.focus = Math.max(0, buttons.findIndex((b) => b.enabled));
  }
  update(events) {
    for (const ev of events) {
      const i = this.buttons.findIndex((b) => b.enabled && b.hit(ev.x, ev.y));
      if (ev.type === 'move' && !ev.touch && i >= 0) this.focus = i;
      if (ev.type === 'down') { this.downIdx = i; if (i >= 0) this.focus = i; }
      if (ev.type === 'up') { if (i >= 0 && i === this.downIdx) this.activate(i); this.downIdx = -1; }
    }
    const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
    for (const [b, dx, dy] of dirs) if (Input.hit(b)) this.nav(dx, dy);
    if (Input.hit('confirm')) this.activate(this.focus);
  }
  nav(dx, dy) {
    const cur = this.buttons[this.focus];
    if (!cur) return;
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = -1, bd = 1e9;
    this.buttons.forEach((b, i) => {
      if (i === this.focus || !b.enabled) return;
      const bx = b.x + b.w / 2 - cx, by = b.y + b.h / 2 - cy;
      const along = bx * dx + by * dy;
      if (along <= 2) return;
      const across = Math.abs(bx * dy) + Math.abs(by * dx);
      const d = along + across * 2.5;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { this.focus = best; Sound.play('click', 0.5); }
  }
  activate(i) {
    const b = this.buttons[i];
    if (b && b.enabled && b.onClick) { Sound.play('click'); Playtest.ui(b.id); b.onClick(); }
  }
  draw(ctx) {
    const showFocus = Input.mode !== 'touch', lit = (i) => (showFocus && i === this.focus) || this.downIdx === i;
    // the lit one last, so its ring isn't covered by a neighbour
    this.buttons.forEach((b, i) => { if (!lit(i)) b.draw(ctx, false, false); });
    this.buttons.forEach((b, i) => { if (lit(i)) b.draw(ctx, true, this.downIdx === i); });
  }
}

// 7x7 pixel icons for the icon-only buttons (sound effects, music, options); rows as bit masks
const ICONS = {
  sfx: [0x08, 0x1a, 0x79, 0x79, 0x79, 0x1a, 0x08],
  music: [0x1f, 0x11, 0x11, 0x11, 0x77, 0x77, 0x00],
  gear: [0x2a, 0x7f, 0x36, 0x63, 0x36, 0x7f, 0x2a],
  chest: [0x3e, 0x41, 0x7f, 0x49, 0x41, 0x41, 0x7f],
  power: [0x06, 0x0c, 0x1e, 0x0c, 0x18, 0x30, 0x20],
  special: [0x0c, 0x08, 0x1c, 0x3e, 0x3e, 0x3e, 0x1c],
  lives: [0x1c, 0x3e, 0x7f, 0x7f, 0x41, 0x00, 0x00],
  armor: [0x36, 0x7f, 0x7f, 0x7f, 0x3e, 0x1c, 0x08],
};
// The three stars of a mission, as medals: each one has its own condition and stays once earned
const MEDALS = [[1, 'COMPLETE'], [2, 'ALL PRISONERS'], [4, 'NO LOSSES']];
const GOAL_TEXT = {
  extract: 'FREE PRISONERS, REACH THE CHOPPER', target: 'ELIMINATE THE COLONEL, THEN EXTRACT',
  depots: 'BLOW UP THE FUEL DEPOTS, THEN EXTRACT', escape: 'OUTRUN THE DETONATION TO THE CHOPPER', boss: 'DESTROY THE BOSS',
};
function missionGoal(L) { return GOAL_TEXT[L.boss ? 'boss' : L.goal || 'extract']; }
// the campaign mission to play next: the first unlocked one not yet completed (-1 = all done)
function campaignNext() {
  for (let i = 0; i < Math.min(Save.data.unlocked, LEVELS.length); i++) if (!Save.data.stars[i]) return i;
  return -1;
}

function soundBtnLabel() { return 'SFX ' + (Sound.sfxOn ? 'ON' : 'OFF'); }
function musicBtnLabel() { return 'MUSIC ' + (Sound.musicOn ? 'ON' : 'OFF'); }
function toggleSfx() { Sound.sfxOn = !Sound.sfxOn; Save.data.sfx = Sound.sfxOn; Save.save(); Sound.applyVolumes(); if (!Sound.sfxOn) Sound.stopAllLoops(); }
function shakeBtnLabel() { return 'SHAKE ' + ['OFF', 'LOW', 'FULL'][Save.data.shake == null ? 2 : Save.data.shake]; }
function toggleShake() { Save.data.shake = ((Save.data.shake == null ? 2 : Save.data.shake) + 2) % 3; Save.save(); }
function toggleMusic() { Sound.musicOn = !Sound.musicOn; Save.data.music = Sound.musicOn; Save.save(); Sound.applyVolumes(); }
function setCoop(on) { Input.setCoop(on); Save.data.coop = !!on; Save.save(); }
function fxBtnLabel() { return 'FX ' + ({ auto: 'AUTO', full: 'FULL', lite: 'LITE' })[Save.data.fx || 'auto']; }
function toggleFx() {
  const order = ['auto', 'full', 'lite'];
  Save.data.fx = order[(order.indexOf(Save.data.fx || 'auto') + 1) % order.length]; Save.save();
  applyFxSetting();
  if (window.world) Atmos.reset(window.world.def.theme);
}

// ----------------------------------------------------------------------------
//  Scene manager
// ----------------------------------------------------------------------------
const App = {
  // tick counts simulation steps; alpha = how far the screen is between the last two (main.js)
  scene: null, fade: 1, pending: null, lastW: 0, lastH: 0, tick: 0, alpha: 1,
  go(scene, arg) { if (this.pending) return; this.pending = { scene, arg }; },
  update(dt) {
    if (Gfx.W !== this.lastW || Gfx.H !== this.lastH) {
      this.lastW = Gfx.W; this.lastH = Gfx.H;
      if (this.scene && this.scene.layout) this.scene.layout();
    }
    if (this.pending) {
      this.fade = Math.min(1, this.fade + dt * 6);
      if (this.fade >= 1) {
        const { scene, arg } = this.pending;
        this.pending = null;
        if (this.scene && this.scene.exit) this.scene.exit();
        this.scene = scene;
        Input.takePointerEvents();
        scene.enter(arg);
        Funnel.scene(scene);
        if (scene.layout) scene.layout();
      }
      return;
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 4);
    if (this.scene) this.scene.update(dt);
  },
  draw(ctx) {
    ctx.fillStyle = '#0c0b10'; ctx.fillRect(0, 0, Gfx.W, Gfx.H);
    Hud.clear();
    if (this.scene) this.scene.draw(ctx);
    if (this.fade > 0) { ctx.fillStyle = 'rgba(12,11,16,' + this.fade.toFixed(3) + ')'; ctx.fillRect(0, 0, Gfx.W, Gfx.H); Hud.fade(this.fade); }
  },
};

// ----------------------------------------------------------------------------
//  Animated menu backdrop
// ----------------------------------------------------------------------------
const Backdrop = {
  t: 0, boomT: 1,
  update(dt) {
    this.t += dt;
    this.boomT -= dt;
    if (this.boomT <= 0) {
      this.boomT = rand(0.7, 1.6);
      FX.explosion(rand(0.08, 0.92) * Gfx.W, Gfx.H - rand(24, 70), rand(14, 26));
    }
    FX.update(dt);
  },
  draw(ctx, dim = 0.3) {
    const W = Gfx.W, H = Gfx.H, th = THEMES.jungle, par = Sprites.parallax.jungle;
    if (!this.sky || this.skyH !== H) {
      this.skyH = H; this.sky = makeCanvas(1, H);
      const x = this.sky.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#e0703a'); g.addColorStop(0.55, '#f2b060'); g.addColorStop(1, '#f8dca0');
      x.fillStyle = g; x.fillRect(0, 0, 1, H);
    }
    ctx.drawImage(this.sky, 0, 0, W, H);
    ctx.drawImage(circleSprite('#fff4c8', 22), Math.round(W * 0.7) - 22, Math.round(H * 0.3) - 22);
    const layers = [[par.far, 8, 0.66, '#b0785a'], [par.mid, 18, 0.8, '#6a4a3a'], [par.near, 34, 0.93, '#3a2a24']];
    for (const [img, sp, base, col] of layers) {
      const off = -Math.round((this.t * sp) % 512);
      const top = Math.round(H * base) - img.height;
      const tinted = img.tint || (img.tint = silhouette(img, col));
      for (let x = off; x < W; x += 512) ctx.drawImage(tinted, x, top);
      ctx.fillStyle = col; ctx.fillRect(0, Math.round(H * base), W, H);
    }
    // ground strip
    const tiles = Sprites.tiles.jungle;
    const gy = H - 20;
    const off = -Math.round((this.t * 34) % 16);
    for (let x = off; x < W; x += 16) {
      ctx.drawImage(tiles.fg[T.DIRT][((x - off) / 16) & 3], x, gy);
      ctx.drawImage(tiles.cap[((x - off) / 16) & 3], x, gy);
      ctx.drawImage(tiles.fg[T.DIRT][((x - off) / 16 + 1) & 3], x, gy + 16);
    }
    FX.draw(ctx, 0, 0, W, H);
    FX.drawLights(ctx, 0, 0, W, H);
    FX.drawEffects(ctx, 0, 0);
    if (dim > 0) { ctx.fillStyle = 'rgba(12,10,20,' + dim + ')'; ctx.fillRect(0, 0, W, H); }
  },
  drawLineup(ctx, y) {
    const unlocked = new Set(Save.unlockedHeroes());
    const n = HEROES.length, gap = Math.min(34, Math.floor((Gfx.W - 40) / n));
    const x0 = Math.round(Gfx.W / 2 - (gap * (n - 1)) / 2);
    HEROES.forEach((h, i) => {
      const set = Sprites.chars[h.id];
      const x = x0 + i * gap;
      if (unlocked.has(h.id)) drawFrame(ctx, set.idle[((this.t * 2 + i * 0.37) | 0) % 2], x, y, 1, false);
      else ctx.drawImage(set.silhouette, x - set.idle[0].ax, y - set.idle[0].ay);
    });
  },
};

// ----------------------------------------------------------------------------
//  The logo (1.31): BLAST in hand-made letters (2 px strokes on a 7x10 grid) leaning forward,
//  gold to red, with depth and an ink outline, over an olive ribbon that carries BATTALION.
//  Built once per letter size into a canvas in game pixels. The name is never translated
// ----------------------------------------------------------------------------
const LOGO_GLYPHS = {
  B: ['######.', '#######', '##...##', '##...##', '######.', '#######', '##...##', '##...##', '#######', '######.'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  A: ['.#####.', '#######', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##', '##...##'],
  S: ['.######', '#######', '##.....', '##.....', '######.', '.######', '.....##', '.....##', '#######', '######.'],
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
};
// the letters' faces by glyph row: pale at the top, gold, orange, red at the foot
const LOGO_FACE = ['#fff4b8', '#ffe066', '#ffd23a', '#ffc232', '#ffae2a', '#ff9a24', '#ff861e', '#ff6c1a', '#f05418', '#d8401a'];
const Logo = {
  cache: {},
  // the letter size for the screen: 3 on the usual 270-300 rows, 2 on a phone, 4 on tall views
  k(W = Gfx.W, H = Gfx.H) { return clamp(Math.min(Math.floor(H / 90), Math.floor(W / 115)), 2, 5); },
  // BLAST at k game px per glyph px, leaning by shear: the letters and a mask of their faces (the glint)
  word(text, k, shear) {
    const G = LOGO_GLYPHS, gw = [...text].reduce((a, ch) => a + G[ch][0].length, 0) + text.length - 1;
    const ext = Math.max(3, Math.round(k * 1.6)), o = k >= 3 ? 2 : 1, pad = o + 1, lean = Math.round(10 * k * shear);
    const W = gw * k + ext + 2 * pad + 2 + lean, H = 10 * k + ext + 2 * pad + 2, N = W * H;
    const face = new Uint8Array(N), row = new Int8Array(N), ex = new Uint8Array(N), ol = new Uint8Array(N);
    let gx = 0;
    for (const ch of text) {
      const g = G[ch];
      for (let r = 0; r < 10; r++) for (let q = 0; q < g[r].length; q++) {
        if (g[r][q] !== '#') continue;
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
          const y = pad + r * k + yy, x = pad + (gx + q) * k + xx + Math.round((10 * k - 1 - (r * k + yy)) * shear);
          face[y * W + x] = 1; row[y * W + x] = r;
        }
      }
      gx += g[0].length + 1;
    }
    const at = (m, x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
    // the depth: the letters pushed down and a little right, darker the deeper
    for (let d = 1; d <= ext; d++) {
      const dx = Math.round(d * 0.5);
      for (let y = 0; y < H - d; y++) for (let x = 0; x < W - dx; x++) if (face[y * W + x] && !face[(y + d) * W + x + dx]) ex[(y + d) * W + x + dx] = d;
    }
    // the ink outline around both
    const body = (x, y) => at(face, x, y) || at(ex, x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (body(x, y)) continue;
      let hit = false;
      for (let j = -o; j <= o && !hit; j++) for (let i = -o; i <= o && !hit; i++) if (Math.abs(i) + Math.abs(j) <= o + (o > 1 ? 1 : 0) && body(x + i, y + j)) hit = true;
      if (hit) ol[y * W + x] = 1;
    }
    const c = makeCanvas(W, H), cc = c.getContext('2d'), img = cc.createImageData(W, H), P = img.data;
    const fm = makeCanvas(W, H), fc = fm.getContext('2d'), fimg = fc.createImageData(W, H);
    const put = (i, hex) => { const n = parseInt(hex.slice(1), 16); P[i * 4] = n >> 16; P[i * 4 + 1] = (n >> 8) & 255; P[i * 4 + 2] = n & 255; P[i * 4 + 3] = 255; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (face[i]) {
        // a pale top edge, a lit left side on the upper half, a shaded foot and right side
        let col = LOGO_FACE[row[i]];
        const top = !at(face, x, y - 1);
        if (top) col = '#fffbe6';
        else if (!at(face, x - 1, y) && row[i] < 6) col = mixHex(col, '#ffffff', 0.45);
        if (!top && (!at(face, x, y + 1) || !at(face, x + 1, y))) col = mixHex(col, '#b02a10', 0.35);
        put(i, col); fimg.data[i * 4 + 3] = 255;
      } else if (ex[i]) put(i, mixHex('#b8341a', '#5a1208', ex[i] / ext));
      else if (ol[i]) put(i, INK);
    }
    cc.putImageData(img, 0, 0); fc.putImageData(fimg, 0, 0);
    return { c, face: fm, W, H, pad };
  },
  // the whole lockup at letter size k: { c, face, W, H }
  get(k) {
    if (this.cache[k]) return this.cache[k];
    const w = this.word('BLAST', k, 0.18), s2 = Math.max(1, Math.round(k * 0.62));
    const tw = Font.width('BATTALION') * s2 + 1, rh = 9 * s2 + 5, rw = Math.max(tw + 12 * s2 + 10, Math.round((w.W - 2 * w.pad) * 0.94));
    const tail = 6 + s2 * 3, drop = 3 + s2, W = Math.max(w.W, rw + 2 * tail + 4), top = w.H - w.pad - Math.round(k * 0.9), H = top + rh + drop + 3;
    const c = makeCanvas(W, H), x = c.getContext('2d');
    const R = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(ww), Math.round(hh)); };
    const rx = Math.round(W / 2 - rw / 2), ry = top, notch = Math.round(rh / 2);
    // the ribbon's tails: behind the band and lower, V-cut at the ends, and the folds that join them
    for (const side of [-1, 1]) {
      const tx = side < 0 ? rx - tail : rx + rw, ty = ry + drop;
      const cut = (yy, extra) => Math.max(0, Math.round(notch - Math.abs(yy - (rh - 1) / 2))) + extra;
      for (let yy = -1; yy <= rh; yy++) { const d = cut(yy, 0), a = side < 0 ? tx + d : tx, b = side < 0 ? tx + tail : tx + tail - d; R(a - 1, ty + yy, b - a + 2, 1, INK); }
      for (let yy = 0; yy < rh; yy++) { const d = cut(yy, 1), a = side < 0 ? tx + d : tx, b = side < 0 ? tx + tail : tx + tail - d; if (b > a) R(a, ty + yy, b - a, 1, yy === 0 ? '#4a5a2a' : '#2e3a18'); }
      for (let i = 0; i < drop; i++) R(side < 0 ? rx - i - 1 : rx + rw, ry + rh + i - drop + 1, i + 1, 1, '#161b0a');
    }
    // the band; BATTALION a little bolder than the plain letters (drawn twice, 1 px apart); two stars
    R(rx - 1, ry - 1, rw + 2, rh + 2, INK);
    R(rx, ry, rw, rh, '#4b5a2a'); R(rx, ry, rw, 1, '#8a9a5a'); R(rx, ry + 1, rw, 1, '#5e6e36'); R(rx, ry + rh - 1, rw, 1, '#262e14');
    R(rx, ry + 1, 1, rh - 2, '#6a7a3a'); R(rx + rw - 1, ry + 1, 1, rh - 2, '#2e381a');
    L10N.raw++;
    const tx = Math.round(W / 2 - tw / 2), ty = ry + Math.round((rh - 7 * s2) / 2), st = Math.max(1, s2 - 1), sy = ty + Math.round((7 * s2 - 7 * st) / 2);
    for (const dx of [0, 1]) Font.draw(x, 'BATTALION', tx + dx, ty + Math.max(1, s2 >> 1), '#1a200c', s2);
    for (const dx of [0, 1]) Font.draw(x, 'BATTALION', tx + dx, ty, '#f4ecd8', s2);
    Font.draw(x, '★', rx + 3 + 2 * st, sy, '#ffd23a', st);
    Font.draw(x, '★', rx + rw - 3 - 2 * st - Font.width('★') * st, sy, '#ffd23a', st);
    L10N.raw--;
    // BLAST over the band
    const bx = Math.round(W / 2 - w.W / 2 + w.pad / 2), face = makeCanvas(W, H);
    x.drawImage(w.c, bx, 0);
    face.getContext('2d').drawImage(w.face, bx, 0);
    return (this.cache[k] = { c, face, W, H });
  },
  // t (seconds): a glint sweeps over the letters every few seconds
  draw(ctx, cx, y, k, t) {
    const L = this.get(k), X = Math.round(cx - L.W / 2), Y = Math.round(y);
    ctx.drawImage(L.c, X, Y);
    const p = t == null ? 1 : (t % 5.5) / 0.7;
    if (p < 1) {
      const s = this.glint || (this.glint = makeCanvas(1, 1));
      if (s.width !== L.W || s.height !== L.H) { s.width = L.W; s.height = L.H; }
      const g = s.getContext('2d');
      g.globalCompositeOperation = 'copy'; g.drawImage(L.face, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(255,255,255,0.6)';
      const bx = Math.round(-L.H + p * (L.W + L.H * 1.5));
      for (let yy = 0; yy < L.H; yy++) g.fillRect(bx - Math.round(yy * 0.45), yy, k > 2 ? 6 : 4, 1);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(s, X, Y);
    }
    return L;
  },
};
// the old entry point (tools/keyart.js): the logo at the screen's size; returns its bottom edge
function drawLogo(ctx, cx, y) { return y + Logo.draw(ctx, cx, y, Logo.k()).H; }

// ----------------------------------------------------------------------------
//  Title (1.31): the game plays behind the menu (src/attract.js) - the logo over it, one big
//  button, the rest in one slim row, the sound and the options in a corner, nothing else.
//  A new player never sees it: the first launch goes straight into mission 1 (main.js)
// ----------------------------------------------------------------------------
// nobody has played on this save yet: the first launch skips the title
function isNewPlayer() { const d = Save.data; return !d.played && !Object.keys(d.stars).length && !d.rescues && !d.arcadeBest && !d.daily; }
// the title's speaker switches all the sound, effects and music (OPTIONS has them apart)
function soundAllOn() { return Sound.sfxOn || Sound.musicOn; }
function toggleAllSound() {
  const on = !soundAllOn();
  Sound.sfxOn = Sound.musicOn = on; Save.data.sfx = Save.data.music = on; Save.save();
  Sound.applyVolumes();
  if (!on) Sound.stopAllLoops();
}
const TitleScene = {
  enter() { this.t = 0; this.menu = new Menu(); this.drop = null; FX.reset(null); Music.play('title'); Platform.gameplayStop(); Attract.start(); },
  exit() { Attract.stop(); },
  layout() {
    const W = Gfx.W, H = Gfx.H, touch = Input.mode === 'touch';
    this.mode = Input.mode;
    this.k = Logo.k(); this.logoY = Math.max(4, Math.round(H * 0.02));
    // the big button always plays: a returning player's next mission in one click (portals reward
    // a fast way into the game); when every mission is done it opens the list
    const next = campaignNext(), fresh = !Object.keys(Save.data.stars).length;
    const play = next >= 0
      ? { label: fresh ? 'PLAY' : 'CONTINUE', sub: 'MISSION ' + (next + 1) + ' - ' + LEVELS[next].name, go: () => App.go(PlayScene, next) }
      : { label: 'MISSIONS', sub: '★ ' + Save.totalStars() + '/' + LEVELS.length * 3 + ' - GO FOR 3 STARS', go: () => App.go(LevelSelectScene) };
    const rowY = H - 24, pw = Math.min(176, W - 16), ph = 32;
    this.menuY = rowY - 8 - ph;
    Attract.band = { top: this.logoY + Logo.get(this.k).H + 4, bottom: this.menuY - 4 };
    const btns = [new Btn({ id: 'play', label: play.label, sub: play.sub, icon: '▶', primary: true, x: Math.round(W / 2 - pw / 2), y: this.menuY, w: pw, h: ph, scale: 2, onClick: play.go })];
    // the rest in one row, a picture and a word each; a light says something waits inside.
    // Co-op needs a keyboard or pads, so phones don't get it
    const row = [
      { id: 'missions', label: 'MISSIONS', icon: 'flag', onClick: () => App.go(LevelSelectScene) },
      { id: 'arcade', label: 'ARCADE', icon: 'swords', onClick: () => App.go(PlayScene, newArcadeRun()) },
      { id: 'daily', label: 'DAILY', icon: 'calendar', badge: !Save.dailyBest(todayKey()), onClick: () => App.go(PlayScene, dailyMission()) },
      { id: 'heroes', label: 'HEROES', icon: 'lives', badge: Wardrobe.hasNew(), onClick: () => App.go(HeroesScene) },
      { id: 'upgrades', label: 'UPGRADES', icon: 'chevrons', badge: UPGRADES.some((u) => Meta.canBuy(u.id)), onClick: () => App.go(UpgradesScene) },
    ];
    if (!touch) row.push({ id: 'players', label: Input.coop ? 'CO-OP ✓' : 'CO-OP', icon: 'coop', selected: Input.coop, onClick: () => { setCoop(!Input.coop); this.layout(); } });
    const gap = 4, room = W - 8, fixed = gap * (row.length - 1);
    let ws = row.map((b) => Math.ceil(UI.tw(b.label)) + 19), sum = ws.reduce((a, b) => a + b, 0);
    // a long language on a narrow screen: the buttons get narrower (the kit drops the pictures first)
    if (sum + fixed > room) { ws = ws.map((w) => Math.floor(w * (room - fixed) / sum)); sum = ws.reduce((a, b) => a + b, 0); }
    let x = Math.round(W / 2 - (sum + fixed) / 2);
    row.forEach((b, i) => { btns.push(new Btn(Object.assign({ kind: 'dark', rivets: false, x, y: rowY, w: ws[i], h: 17 }, b))); x += ws[i] + gap; });
    // the corner: the speaker (all the sound), the options, and the daily supply drop once there is one
    btns.push(
      new Btn({ id: 'sound', icon: 'sfx', off: !soundAllOn(), label: '', x: W - 44, y: 4, w: 18, h: 16, onClick: () => { toggleAllSound(); this.layout(); } }),
      new Btn({ id: 'options', icon: 'gear', label: '', x: W - 23, y: 4, w: 18, h: 16, onClick: () => App.go(OptionsScene) }),
    );
    if (Meta.dailyVisible()) btns.push(new Btn({ id: 'drop', icon: 'chest', label: '', badge: Meta.daily().ready, x: W - 65, y: 4, w: 18, h: 16, onClick: () => { this.drop = Meta.daily(); this.layout(); } }));
    if (this.drop) {
      // the supply drop panel takes over the menu until it is closed
      const b = this.dropBox = dropBox();
      this.menu.set([new Btn({
        id: this.drop.ready ? 'claim' : 'drop_ok', label: this.drop.ready ? 'CLAIM' : 'OK', primary: this.drop.ready, x: b.x + 35, y: b.y + 66, w: b.w - 70, h: 18,
        onClick: () => {
          if (this.drop.ready && Meta.claimDaily()) dropBurst();
          this.drop = null; this.layout();
        },
      })], false);
      this.menu.focus = 0;
      return;
    }
    this.menu.set(btns);
  },
  update(dt) {
    this.t += dt;
    if (this.mode !== Input.mode) this.layout(); // first touch on a hybrid device: drop the co-op button
    if (this.drop && (Input.hit('pause') || Input.hit('back'))) { this.drop = null; this.layout(); }
    Attract.update(dt);
    const evs = Input.takePointerEvents();
    Playtest.cornerTaps(evs);
    this.menu.update(evs);
  },
  drawDrop(ctx) { drawDropPanel(ctx, this.dropBox, this.drop); this.menu.draw(ctx); },
  // the demo, shaded where the logo and the menu sit so they read over the action; then the logo,
  // the menu (the kit, src/uikit.js) and the version in the top left corner
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H;
    Attract.draw(ctx);
    this.shade(ctx, 0, this.logoY + Logo.get(this.k).H + 16, 0.78, 0);
    this.shade(ctx, this.menuY - 36, H, 0, 0.9);
    Logo.draw(ctx, W / 2, this.logoY, this.k, this.t);
    this.menu.draw(ctx);
    UI.textD('V' + VERSION, UI.X(4), UI.X(4), 'rgba(255,255,255,0.45)', 1);
    if (this.drop) this.drawDrop(ctx);
  },
  shade(ctx, y0, y1, a0, a1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(10,8,16,' + a0 + ')'); g.addColorStop(1, 'rgba(10,8,16,' + a1 + ')');
    ctx.fillStyle = g; ctx.fillRect(0, Math.round(y0), Gfx.W, Math.round(y1 - y0));
  },
};

// the daily supply drop: today's cash, the streak, what tomorrow brings (title chest, and the
// first mission finished each day - that is how a new player learns it exists)
function dropBox() {
  const pw = 170;
  return { x: Math.round(Gfx.W / 2 - pw / 2), y: Math.round(Gfx.H / 2 - 44), w: pw, h: 92 };
}
function drawDropPanel(ctx, b, d) {
  const W = Gfx.W, H = Gfx.H, m = UI.m, CX = UI.X(W / 2);
  ctx.fillStyle = 'rgba(10,8,16,0.6)'; ctx.fillRect(0, 0, W, H);
  Hud.R(0, 0, Hud.canvas.width, Hud.canvas.height, 'rgba(10,8,16,0.6)'); // over what the screen drew on the HUD layer too
  const [X, Y, PW, PH] = UI.box(b.x, b.y, b.w, b.h);
  UI.plateD(X, Y, PW, PH, 'metal');
  UI.iconD('chest', CX - 7 * m, Y + 6 * m, INK, 2); UI.iconD('chest', CX - 7 * m, Y + 5 * m, '#ffd23a', 2);
  UI.stampD('SUPPLY DROP', CX, Y + 22 * m, '#ffd23a', 1, 'center');
  if (d.ready) {
    UI.stampD('+$' + d.amount, CX, Y + 33 * m, '#ffffff', 2, 'center');
    UI.textD('DAY ' + d.streak + (d.streak > 1 ? ' IN A ROW' : '') + ' - TOMORROW +$' + d.tomorrow, CX, Y + 51 * m, '#9ad8ff', 1, 'center');
  } else {
    UI.textD('CLAIMED TODAY', CX, Y + 35 * m, '#c8c4e0', 1, 'center');
    UI.textD('COME BACK TOMORROW: +$' + d.tomorrow, CX, Y + 47 * m, '#9ad8ff', 1, 'center');
  }
}
function dropBurst() {
  Sound.play('unlock');
  for (let i = 0; i < 14; i++) FX.spawn(Gfx.W / 2 + rand(-20, 20), Gfx.H / 2, rand(-120, 120), rand(-200, -60), rand(0.6, 1.1), 2, '#ffd23a', PF.GRAV | PF.BOUNCE | PF.FLICKER);
}

// ----------------------------------------------------------------------------
//  Upgrades: cash earned in missions buys permanent boosts
// ----------------------------------------------------------------------------
const UpgradesScene = {
  enter() { this.t = 0; this.menu = new Menu(); this.flash = {}; FX.reset(null); },
  layout() {
    const W = Gfx.W, H = Gfx.H, n = UPGRADES.length;
    const cols = W >= 4 * 104 + 40 ? 4 : 2, rows = Math.ceil(n / cols);
    const cw = Math.min(104, Math.floor((W - 20) / cols) - 6), ch = Math.min(92, Math.floor((H - 72) / rows) - 6);
    const x0 = Math.round(W / 2 - (cols * (cw + 6) - 6) / 2), y0 = 44;
    const btns = [new Btn({ id: 'back', label: 'BACK', icon: 'back', x: 5, y: 5, w: 54, h: 16, onClick: () => App.go(TitleScene) })];
    UPGRADES.forEach((u, i) => btns.push(new Btn({
      id: 'up_' + u.id, x: x0 + (i % cols) * (cw + 6), y: y0 + Math.floor(i / cols) * (ch + 6), w: cw, h: ch,
      onClick: () => this.buy(u), drawFn: (ctx, b, f, p) => this.drawCard(ctx, b, f, p, u),
    })));
    this.menu.set(btns);
  },
  buy(u) {
    if (!Meta.buy(u.id)) { Sound.play('nope'); return; }
    Funnel.ev('upgrade', u.id, 'bought-' + Meta.level(u.id));
    Sound.play('unlock'); this.flash[u.id] = 0.5;
    const b = this.menu.buttons.find((q) => q.id === 'up_' + u.id);
    if (b) for (let i = 0; i < 16; i++) FX.spawn(b.x + b.w / 2, b.y + 14, rand(-110, 110), rand(-180, -40), rand(0.5, 1), 2, '#ffd23a', PF.GRAV | PF.FLICKER);
  },
  drawCard(ctx, b, focused, pressed, u) {
    const x = b.x, y = b.y + (pressed ? 1 : 0), w = b.w, h = b.h;
    const lvl = Meta.level(u.id), max = u.costs.length, cost = Meta.cost(u.id), can = Meta.canBuy(u.id);
    UI.plate(x, y, w, h, 'dark', { ring: this.flash[u.id] > 0 ? '#ffffff' : focused ? '#ffd23a' : null, pressed });
    const big = h >= 70;
    UI.icon(u.id, x + w / 2 - (big ? 7 : 3.5), y + 5, lvl ? '#ffd23a' : '#c8c4e0', big ? 2 : 1);
    let ty = y + (big ? 23 : 15);
    UI.stamp(u.name, x + w / 2, ty, '#ffffff', 1, 'center');
    ty += 10;
    // one pip per level
    const pw = 8, px = Math.round(x + w / 2 - (max * (pw + 2) - 2) / 2);
    for (let i = 0; i < max; i++) { UI.rect(px + i * (pw + 2) - 1, ty - 1, pw + 2, 5, INK); UI.rect(px + i * (pw + 2), ty, pw, 3, i < lvl ? '#ffd23a' : '#3a3f47'); }
    ty += 8;
    for (const l of Font.wrap(u.desc, w - 8)) { if (ty > y + h - 22) break; UI.text(l, x + w / 2, ty, '#9ad8ff', 1, 'center'); ty += 9; }
    // the price, on a strip at the bottom
    const sy = y + h - 16;
    UI.plate(x + 4, sy, w - 8, 11, cost == null ? 'olive' : can ? 'brass' : 'off', { rivets: false, flat: true });
    UI.stamp(cost == null ? 'MAXED' : '$' + fmtNum(cost), x + w / 2, sy + 2, cost == null ? '#d8f0b0' : can ? '#ffe7a0' : '#8a8d95', 1, 'center');
  },
  update(dt) {
    this.t += dt;
    for (const k in this.flash) this.flash[k] -= dt;
    Backdrop.update(dt);
    if (Input.hit('pause') || Input.hit('back')) { App.go(TitleScene); return; }
    this.menu.update(Input.takePointerEvents());
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, m = UI.m;
    Backdrop.draw(ctx, 0.6);
    UI.header('UPGRADES');
    UI.chipD(UI.X(W) - 6 * m, UI.X(7), '$', fmtNum(Meta.coins()), '#ffd23a', 'right');
    this.menu.draw(ctx);
    UI.fit('EVERY MISSION PAYS CASH - STARS AND NEW MEDALS PAY MORE', W / 2, H - 12, '#c8c4e0', W - 8);
  },
};

// ----------------------------------------------------------------------------
//  Level select
// ----------------------------------------------------------------------------
const LevelSelectScene = {
  enter() { this.t = 0; this.menu = new Menu(); this.focusSet = false; FX.reset(null); Music.play('title'); },
  update(dt) {
    this.t += dt;
    Backdrop.update(dt);
    if (Input.hit('pause') || Input.hit('back')) { App.go(TitleScene); return; }
    this.menu.update(Input.takePointerEvents());
  },
  // the campaign as three routes, one per zone (the missions on a line, gold where they've been
  // fought), and the mission's dossier under them
  layout() {
    const W = Gfx.W, H = Gfx.H;
    const cardH = Math.min(H >= 236 ? 72 : H >= 214 ? 56 : 44, Math.ceil(UI.gx(48)) + 21), top = 30;
    // the zone plates as wide as their names need (DSCHUNGEL is longer than JUNGLE)
    const zoneW = Math.max(clamp(Math.round(W * 0.13), 40, 60), Math.max(...['JUNGLE', 'DESERT', 'ARCTIC'].map((n) => Font.width(n))) + 8);
    const avail = W - 14 - zoneW - 12;
    const bw = clamp(Math.floor(avail / 5.8), 30, 48), gap = Math.floor((avail - 5 * bw) / 4);
    const room = H - top - cardH - 12;
    const bh = clamp(Math.floor(room / 3) - 6, 22, 34), gy = clamp(Math.floor((room - 3 * bh) / 3), 3, 14);
    const y0 = top + Math.round((room - 3 * bh - 2 * gy) / 2), x0 = 7 + zoneW + 12;
    const btns = [new Btn({ id: 'back', label: 'BACK', icon: 'back', x: 5, y: 5, w: 54, h: 16, onClick: () => App.go(TitleScene) })];
    LEVELS.forEach((L, i) => {
      const r = Math.floor(i / 5), c = i % 5, locked = i >= Save.data.unlocked;
      btns.push(new Btn({
        id: 'lvl' + i, x: x0 + c * (bw + gap), y: y0 + r * (bh + gy), w: bw, h: bh, enabled: !locked, level: i,
        onClick: () => App.go(PlayScene, i),
        drawFn: (ctx, b, focused, pressed) => this.drawNode(b, focused, pressed, i, locked),
      }));
    });
    const cw = Math.min(W - 14, 400), cx = Math.round(W / 2 - cw / 2), cy = H - cardH - 6;
    this.card = { x: cx, y: cy, w: cw, h: cardH };
    const sk = currentSkill(), segW = Math.max(50, ...DIFFICULTY.map((d) => Font.width(d.name) + 12)), sy = cy + cardH - 18;
    DIFFICULTY.forEach((d, i) => btns.push(new Btn({
      id: 'diff' + i, label: d.name, x: cx + cw - 7 - (3 - i) * (segW + 3) + 3, y: sy, w: segW, h: 13, selected: d === sk,
      onClick: () => { Save.data.difficulty = i; Save.save(); this.layout(); },
    })));
    this.menu.set(btns);
    if (!this.focusSet) {
      this.focusSet = true;
      const next = campaignNext();
      const idx = btns.findIndex((b) => b.level === (next >= 0 ? next : Math.min(Save.data.unlocked, LEVELS.length) - 1));
      if (idx >= 0) this.menu.focus = idx;
    }
    this.zones = [0, 1, 2].map((r) => ({ x: 7, y: y0 + r * (bh + gy), w: zoneW, h: bh }));
  },
  // a mission on the route: a plate in its zone's colours, the number stamped in, stars under it
  drawNode(b, focused, pressed, i, locked) {
    const m = UI.m, L = LEVELS[i], [X, Y0, W, H] = UI.box(b.x, b.y, b.w, b.h), Y = Y0 + (pressed ? m : 0);
    UI.plateD(X, Y, W, H, locked ? 'off' : L.theme, { ring: focused ? '#ffd23a' : null, pressed, rivets: false });
    if (locked) { UI.imgD(Sprites.props.iconLock, X + Math.round(W / 2 - 4.5 * m), Y + Math.round(H / 2 - 6 * m), m); return; }
    const s = H >= 44 * m ? 3 : 2;
    UI.stampD(String(i + 1), X + Math.round(W / 2), Y + 4 * m, '#eef1f4', s, 'center');
    if (L.boss) UI.imgD(Sprites.props.iconSkull, X + W - 11 * m, Y + 2 * m, m);
    if (Save.data.secrets && Save.data.secrets[i]) { Hud.R(X + 2 * m, Y + 2 * m, 5 * m, 5 * m, INK); Hud.R(X + 3 * m, Y + 3 * m, 3 * m, 3 * m, '#ffd23a'); }
    const stars = Save.data.stars[i] || 0, SX = X + Math.round(W / 2) - 18 * m, SY = Y + H - 14 * m;
    Hud.R(SX - m, SY - m, 38 * m, 13 * m, 'rgba(12,10,20,0.5)');
    for (let k = 0; k < 3; k++) UI.imgD(k < stars ? Sprites.props.iconStar : Sprites.props.iconStarOff, SX + k * 12 * m, SY, m);
  },
  draw(ctx) {
    const W = Gfx.W, m = UI.m;
    Backdrop.draw(ctx, 0.55);
    UI.header('SELECT MISSION');
    UI.chipD(UI.X(W) - 6 * m, UI.X(7), '★', Save.totalStars() + '/' + LEVELS.length * 3, '#ffd23a', 'right');
    const nodes = this.menu.buttons.filter((b) => b.level !== undefined);
    ['JUNGLE', 'DESERT', 'ARCTIC'].forEach((name, r) => {
      const z = this.zones && this.zones[r];
      if (!z) return;
      const [ZX, ZY, ZW, ZH] = UI.box(z.x, z.y, z.w, z.h), LY = ZY + Math.round(ZH / 2 / m) * m - m;
      // the route: gold up to where the fighting has been, grey where it's open, dashes ahead
      let px = ZX + ZW;
      for (const b of nodes.slice(r * 5, r * 5 + 5)) {
        const BX = UI.X(b.x), len = BX - px, done = !!Save.data.stars[b.level], open = b.level < Save.data.unlocked;
        if (open) { Hud.R(px, LY - m, len, 3 * m, INK); Hud.R(px, LY, len, m, done ? '#ffd23a' : '#9aa2ab'); }
        else for (let d = 0; d < len; d += 6 * m) Hud.R(px + d, LY, Math.min(3 * m, len - d), m, '#4a4e58');
        px = BX + UI.X(b.x + b.w) - UI.X(b.x);
      }
      UI.plateD(ZX, ZY, ZW, ZH, ['jungle', 'desert', 'arctic'][r], { rivets: false });
      UI.stampD(name, ZX + Math.round(ZW / 2), ZY + Math.round((ZH - 7 * m) / 2), '#eef1f4', 1, 'center');
    });
    this.drawCard();
    this.menu.draw(ctx);
    // the next mission: the hero's face on it, as on the route in a mission
    const next = campaignNext(), nb = next >= 0 && nodes.find((b) => b.level === next);
    if (nb) {
      const hero = Sprites.chars[Save.data.favorite || Save.unlockedHeroes()[0] || 'havoc'];
      const FX0 = UI.X(nb.x) - 5 * m, FY = UI.X(nb.y) - 7 * m + Math.round(Math.sin(this.t * 4) * 1.5) * m;
      Hud.round(FX0 - m, FY - m, 18 * m, 17 * m, m, INK); Hud.R(FX0, FY, 16 * m, 15 * m, '#ffd23a');
      Hud.R(FX0 + m, FY + m, 14 * m, 13 * m, '#1c1a2a'); UI.imgD(hero.portrait, FX0 + m, FY + m, m);
    }
  },
  // the dossier: name, HP and lives as pictures, the goal, the medals, the difficulty
  drawCard() {
    const c = this.card, f = this.menu.buttons[this.menu.focus], m = UI.m;
    if (f && f.level !== undefined) this.shown = f.level; // keep the last mission while BACK / difficulty is focused
    const i = this.shown == null ? Math.max(0, campaignNext()) : this.shown, L = LEVELS[i];
    const locked = i >= Save.data.unlocked, sk = currentSkill(), lv = Meta.missionLives(sk, Input.coop);
    const [X, Y, W, H] = UI.box(c.x, c.y, c.w, c.h);
    UI.plateD(X, Y, W, H, 'dark');
    const lx = X + 7 * m, rx = X + W - 7 * m, room = UI.X(c.h - 19) - 5 * m;
    let y = Y + 5 * m;
    const nw = UI.stampD('MISSION ' + (i + 1) + ' - ' + L.name, lx, y, L.boss ? '#ff8a6a' : '#ffd23a');
    if (L.boss) UI.imgD(Sprites.props.iconSkull, lx + nw + 4 * m, y - m, m);
    let hx = rx;
    const pair = (icon, n, col) => { const t = '×' + n; hx -= Font.width(t) * m; UI.textD(t, hx, y, '#e4e8ec'); hx -= 9 * m; UI.iconD(icon, hx, y, col); hx -= 7 * m; };
    pair('lives', lv, '#9ad8ff'); pair('heart', Meta.heroHp(sk), '#ff5a5a');
    y += 11 * m;
    if (locked) {
      if (room >= 18 * m) { UI.imgD(Sprites.props.iconLock, lx, y - m, m); UI.textD('LOCKED - FINISH MISSION ' + i + ' FIRST', lx + 13 * m, y, '#8a88a0'); }
    } else {
      const showGoal = room >= 40 * m, showMedals = room >= 29 * m;
      if (showGoal) {
        const goal = L.boss ? 'skull' : { target: 'target', depots: 'drum', escape: 'fire' }[L.goal] || 'flag';
        UI.iconD(goal, lx, y, '#ff8a3a');
        UI.textD(missionGoal(L), lx + 11 * m, y, '#ffffff');
        const best = Save.data.best[i];
        if (best) UI.textD('BEST ' + fmtNum(best), rx, y, '#ffd23a', 1, 'right');
        y += 11 * m;
      }
      if (showMedals) {
        const mk = Save.medals(i);
        let mx = lx;
        MEDALS.forEach(([bit, text], k) => {
          mx += UI.medalD(mx, y - m, k, mk & bit ? 'on' : 'off') + 3 * m;
          mx += UI.textD(text, mx, y + 6 * m, mk & bit ? '#ffffff' : '#8a88a0') + 9 * m;
        });
        const found = Save.data.secrets && Save.data.secrets[i];
        if (mx + Font.width('¤ SECRET') * m <= rx) UI.textD('¤ SECRET', mx, y + 6 * m, found ? '#ffd23a' : '#5a586a');
      }
    }
    UI.textD('DIFFICULTY', lx, Y + H - UI.X(14), '#b8bcc6');
  },
};

// ----------------------------------------------------------------------------
//  Heroes gallery
// ----------------------------------------------------------------------------
const HeroesScene = {
  enter() { this.t = 0; this.menu = new Menu(); FX.reset(null); },
  layout() {
    const W = Gfx.W, H = Gfx.H;
    let cols = HEROES.length > 8 ? 6 : 4;
    if (cols === 6 && Math.floor((W - 20) / 6) - 6 < 56 && Math.floor((H - 62) / 3) - 6 >= 56) cols = 4;
    const rows = Math.ceil(HEROES.length / cols);
    // the narrowest screens (384 px wide phones): tighter gaps, so that a card line holds 9 letters
    let gap = 6, cw = Math.min(112, Math.floor((W - 20) / cols) - gap);
    if (cw < 58) { gap = 4; cw = Math.floor((W - 16) / cols) - gap; }
    const ch = Math.min(88, Math.floor((H - 62) / rows) - 6);
    const x0 = Math.round(W / 2 - (cols * (cw + gap) - gap) / 2), y0 = 40;
    const btns = [new Btn({ id: 'back', label: 'BACK', icon: 'back', x: 5, y: 5, w: 54, h: 16, onClick: () => App.go(TitleScene) }),
      new Btn({ id: 'wardrobe', label: 'WARDROBE', icon: 'hat', badge: Wardrobe.hasNew(), x: W - 89, y: 5, w: 84, h: 16, onClick: () => App.go(WardrobeScene) })];
    HEROES.forEach((h, i) => {
      btns.push(new Btn({
        id: 'hero' + i, x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + 6), w: cw, h: ch,
        onClick: () => this.pick(h),
        drawFn: (ctx, b, focused) => this.drawCard(ctx, b, focused, h, i),
      }));
    });
    this.menu.set(btns);
  },
  // choose who every mission starts with (rescues still swap at random)
  pick(h) {
    if (!Save.unlockedHeroes().includes(h.id)) { Sound.play('nope'); return; }
    Save.data.favorite = Save.data.favorite === h.id ? null : h.id;
    Save.save();
    Sound.play('pickup');
  },
  drawCard(ctx, b, focused, h, i) {
    const x = b.x, y = b.y, cw = b.w, ch = b.h;
    const un = this.unlocked.has(h.id), fav = Save.data.favorite === h.id;
    UI.plate(x, y, cw, ch, un ? 'metal' : 'off', { ring: focused ? '#ffd23a' : fav ? '#c8961e' : null, rivets: false });
    const set = Sprites.chars[h.id];
    const f = set.idle[((this.t * 2 + i * 0.3) | 0) % 2];
    const sc = ch > 76 && cw >= 88 ? 2 : 1;
    UI.img(un ? f.r : set.silhouette, x + cw / 2 - f.ax * sc, y + 4, sc);
    if (fav) UI.img(Sprites.props.iconStar, x + cw - 13, y + 3);
    let ty = y + 6 + f.h * sc;
    const nm = un ? h.name : '???', CX = UI.X(x + cw / 2);
    UI.stampK(nm, CX, UI.X(ty), un ? '#ffd23a' : '#8a88a0', UI.kFor(nm, cw - 4), 'center');
    ty += 10;
    const parts = un ? [[h.weapon, '#ffffff'], [h.special, '#9ad8ff']] : [['FREE ' + h.unlock + ' PRISONERS', '#ff9a7a']];
    // small cards: drop the special first, then cut the weapon, rather than spill over the card edge
    // (a word too long for a line gets finer letters before it would split between two letters)
    let room = y + ch - 2 - ty;
    const items = parts.map(([text, col]) => ({ ...UI.wrapK(text, cw - 4), col })), lh = (it) => 9 * it.k / UI.m;
    if (items.length > 1 && items[0].lines.length * lh(items[0]) + items[1].lines.length * lh(items[1]) > room) items.pop();
    for (const it of items) {
      for (const l of it.lines) { if (room < lh(it)) break; Font.draw(Hud.ctx, l, CX, UI.X(ty), it.col, it.k, 'center'); ty += lh(it); room -= lh(it); }
    }
  },
  update(dt) {
    this.t += dt;
    Backdrop.update(dt);
    if (Input.hit('pause') || Input.hit('back')) { App.go(TitleScene); return; }
    this.menu.update(Input.takePointerEvents());
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, m = UI.m;
    Backdrop.draw(ctx, 0.6);
    UI.header('HEROES');
    UI.chipD(UI.X(W - 93), UI.X(6), 'cage', String(Save.data.rescues), '#7cff7c', 'right');
    this.unlocked = new Set(Save.unlockedHeroes());
    this.menu.draw(ctx);
    const fav = Save.data.favorite && HERO_BY_ID[Save.data.favorite];
    UI.fit(fav ? 'EVERY MISSION STARTS AS ' + fav.name + ' (PICK AGAIN FOR RANDOM)' : 'PICK A HERO TO START EVERY MISSION AS THEM',
      W / 2, H - 12, fav ? '#ffd23a' : '#c8c4e0', W - 8);
  },
};

// ----------------------------------------------------------------------------
//  Wardrobe (1.25): hats and paint jobs, bought once with cash, worn by any hero.
//  Click an item to try it on; click it again to buy it (no purchase by accident,
//  also on touch). An item you own goes on at once; again = back to the hero's own.
// ----------------------------------------------------------------------------
const WardrobeScene = {
  enter() {
    this.t = 0; this.menu = new Menu(); this.tab = this.tab || 'hat'; this.sel = null; this.cheer = 0; FX.reset(null);
    const un = Save.unlockedHeroes();
    this.heroes = HEROES.filter((h) => un.includes(h.id));
    const want = this.heroId || Save.data.favorite;
    this.hi = Math.max(0, this.heroes.findIndex((h) => h.id === want));
    Wardrobe.markSeen();
  },
  hero() { return this.heroes[this.hi] || HEROES[0]; },
  layout() {
    const W = Gfx.W, H = Gfx.H;
    const leftW = clamp(Math.floor(W * 0.3), 96, 150), gx = leftW + 18, gw = W - gx - 8;
    const btns = [new Btn({ id: 'back', label: 'BACK', icon: 'back', x: 5, y: 5, w: 54, h: 16, onClick: () => App.go(HeroesScene) })];
    // the hero switch under the stand
    const sy = H - 44;
    btns.push(new Btn({ id: 'prev', label: '<', x: 12, y: sy, w: 22, h: 16, onClick: () => this.step(-1) }));
    btns.push(new Btn({ id: 'next', label: '>', x: leftW - 26, y: sy, w: 22, h: 16, onClick: () => this.step(1) }));
    // HATS | PAINT
    const tw = Math.min(70, Math.floor((gw - 6) / 2));
    btns.push(new Btn({ id: 'tab_hat', label: 'HATS', selected: this.tab === 'hat', x: gx, y: 40, w: tw, h: 16, onClick: () => { this.tab = 'hat'; this.sel = null; this.layout(); } }));
    btns.push(new Btn({ id: 'tab_paint', label: 'PAINT', selected: this.tab === 'paint', x: gx + tw + 6, y: 40, w: tw, h: 16, onClick: () => { this.tab = 'paint'; this.sel = null; this.layout(); } }));
    // the items: the hero's own first
    const items = [null, ...Wardrobe.list(this.tab)];
    const perRow = Math.ceil(items.length / 2);
    const cw = clamp(Math.floor(gw / perRow) - 5, 26, 58), ch = Math.min(cw + 12, Math.floor((H - 62 - 26) / 2) - 5);
    items.forEach((it, i) => btns.push(new Btn({
      id: 'it_' + (it ? it.id : 'own'), x: gx + (i % perRow) * (cw + 5), y: 62 + Math.floor(i / perRow) * (ch + 5), w: cw, h: ch,
      onClick: () => this.pick(it), drawFn: (ctx, b, f, p) => this.drawItem(ctx, b, f, p, it),
    })));
    this.menu.set(btns);
    this.leftW = leftW;
  },
  step(d) { this.hi = (this.hi + d + this.heroes.length) % this.heroes.length; this.heroId = this.hero().id; this.sel = null; Sound.play('click', 0.6); },
  pick(it) {
    const h = this.hero().id, kind = this.tab;
    if (!it) { if (Wardrobe.worn(h)[kind]) { Wardrobe.wear(h, kind, null); this.cheer = 0.6; } this.sel = null; Sound.play('pickup'); return; }
    if (!Wardrobe.owns(kind, it.id)) {
      // first click tries it on, the second one buys it
      if (!this.sel || this.sel.id !== it.id) { this.sel = it; return; }
      if (!Wardrobe.buy(kind, it.id)) { Sound.play('nope'); return; }
      Funnel.ev('cosmetic', kind + '-' + it.id, 'bought');
      Sound.play('unlock');
      const b = this.menu.buttons.find((q) => q.id === 'it_' + it.id);
      if (b) for (let i = 0; i < 16; i++) FX.spawn(b.x + b.w / 2, b.y + 10, rand(-110, 110), rand(-180, -40), rand(0.5, 1), 2, '#ffd23a', PF.GRAV | PF.FLICKER);
    } else Sound.play('pickup');
    this.sel = null;
    Wardrobe.wear(h, kind, it.id);
    if (Wardrobe.worn(h)[kind] === it.id) this.cheer = 1.2; // the hero shows it off
  },
  // what the big figure wears right now: the item being tried on or looked at, else the outfit
  tryOn() {
    const f = this.menu.buttons[this.menu.focus], kind = this.tab;
    const it = this.sel || (Input.mode !== 'touch' && f && f.id.startsWith('it_') ? (f.id === 'it_own' ? 'own' : Wardrobe.item(kind, f.id.slice(3))) : null);
    if (!it) return null;
    return { [kind]: it === 'own' ? '' : it.id };
  },
  drawItem(ctx, b, focused, pressed, it) {
    const x = b.x, y = b.y + (pressed ? 1 : 0), w = b.w, h = b.h;
    const hero = this.hero().id, kind = this.tab, worn = Wardrobe.worn(hero)[kind] || null;
    const on = it ? worn === it.id : !worn, own = !it || Wardrobe.owns(kind, it.id), tried = this.sel && it && this.sel.id === it.id;
    UI.plate(x, y, w, h, 'dark', { ring: tried ? '#ffffff' : focused ? '#ffd23a' : on ? '#c8961e' : null, pressed, rivets: false });
    const img = Wardrobe.preview(hero, { [kind]: it ? it.id : '' }, kind === 'paint');
    const sc = w >= 54 && h >= 62 ? 3 : w >= 40 && h >= 44 ? 2 : 1, iw = 16 * sc;
    if (!own) Hud.ctx.globalAlpha = 0.75;
    UI.img(img, x + w / 2 - iw / 2, y + Math.max(2, Math.round((h - 12 - iw) / 2)), sc);
    Hud.ctx.globalAlpha = 1;
    // the strip at the bottom: worn / owned / the price
    const sy = y + h - 12, can = it && Wardrobe.canBuy(kind, it.id);
    UI.plate(x + 3, sy, w - 6, 9, on ? 'brass' : own ? 'olive' : can ? 'brass' : 'off', { rivets: false, flat: true });
    const price = !it ? '' : w >= 40 || it.cost < 1000 ? '$' + fmtNum(it.cost) : '$' + (it.cost / 1000).toFixed(1).replace('.0', '') + 'K';
    UI.text(on ? '✓' : own ? 'OWN' : price, x + w / 2, sy + 1, on ? '#ffe7a0' : own ? '#d8f0b0' : can ? '#ffe7a0' : '#8a8d95', 1, 'center');
  },
  update(dt) {
    this.t += dt; this.cheer = Math.max(0, this.cheer - dt);
    Backdrop.update(dt);
    if (Input.hit('pause') || Input.hit('back')) { App.go(HeroesScene); return; }
    this.menu.update(Input.takePointerEvents());
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, hero = this.hero(), over = this.tryOn(), m = UI.m;
    Backdrop.draw(ctx, 0.6);
    UI.header('WARDROBE');
    UI.chipD(UI.X(W) - 6 * m, UI.X(7), '$', fmtNum(Meta.coins()), '#ffd23a', 'right');
    // the hero on a stand, in the outfit (or trying something on); a wave when it just put it on
    const lw = this.leftW, px = 8, py = 40, ph = H - 40 - 50;
    UI.plate(px, py, lw - 4, ph + 26, 'dark');
    const pose = this.cheer > 0 ? (((this.t * 6) | 0) % 2 ? 'wave1' : 'wave0') : ((this.t * 2) | 0) % 2 ? 'idle2' : 'idle';
    const fig = Wardrobe.figure(hero.id, over, pose);
    const sc = ph >= 96 && lw >= 110 ? 3 : 2;
    UI.rect(px + (lw - 4) / 2 - 14 * sc / 2, py + ph - 6, 14 * sc, 3, INK); // the stand
    UI.img(fig, px + (lw - 4) / 2 - fig.ax * sc, py + ph - 6 - fig.height * sc, sc);
    UI.stamp(hero.name, px + (lw - 4) / 2, py + 6, '#ffd23a', 1, 'center');
    UI.text((this.hi + 1) + '/' + this.heroes.length, px + (lw - 4) / 2, H - 40, '#8a88a0', 1, 'center');
    this.menu.draw(ctx);
    // the caption: what the focused or tried-on item is and what a click does
    const f = this.menu.buttons[this.menu.focus];
    const it = this.sel || (f && f.id.startsWith('it_') && f.id !== 'it_own' ? Wardrobe.item(this.tab, f.id.slice(3)) : null);
    let cap = 'BOUGHT ONCE - EVERY HERO CAN WEAR IT', col = '#c8c4e0';
    if (it) {
      const own = Wardrobe.owns(this.tab, it.id), worn = Wardrobe.worn(hero.id)[this.tab] === it.id;
      if (worn) { cap = it.name + ' - WORN (CLICK TO TAKE OFF)'; col = '#ffd23a'; }
      else if (own) { cap = it.name + ' - OWNED (CLICK TO WEAR)'; col = '#7cff7c'; }
      else if (Meta.coins() >= it.cost) { cap = it.name + '  $' + fmtNum(it.cost) + (this.sel === it ? ' - CLICK AGAIN TO BUY' : ' - CLICK TO TRY ON'); col = '#ffd23a'; }
      else { cap = it.name + '  $' + fmtNum(it.cost) + ' - NOT ENOUGH CASH YET'; col = '#ff9a7a'; }
    } else if (f && f.id === 'it_own') cap = hero.name + "'S OWN " + (this.tab === 'hat' ? 'HAT' : 'COLORS');
    UI.fit(cap, W / 2, H - 12, col, W - 8);
  },
};

// ----------------------------------------------------------------------------
//  Touch controls (in-game)
// ----------------------------------------------------------------------------
const Touch = {
  joy: null, ptr: {}, buttons: [], joyR: 30,
  layout() {
    const W = Gfx.W, H = Gfx.H;
    const r = Math.round(clamp(H * 0.085, 18, 30));
    this.buttons = [
      { name: 'fire', x: W - r - 14, y: H - r - 14, r: r + 5, label: 'FIRE' },
      { name: 'jump', x: W - r * 3 - 26, y: H - r - 10, r, label: 'JUMP' },
      { name: 'special', x: W - r - 14, y: H - r * 3 - 26, r: r - 2, label: 'SPEC' },
      // tap = knife / kick, hold = grab a soldier (and throw him with another tap)
      { name: 'melee', x: W - r * 3 - 26, y: H - r * 3 - 22, r: r - 3, label: 'KNIFE' },
    ];
    this.joyR = Math.round(clamp(H * 0.11, 22, 44));
    this.joyHome = { x: this.joyR + 22, y: H - this.joyR - 18 };
  },
  reset() { this.joy = null; this.ptr = {}; Input.touch = {}; },
  handle(events) {
    this.layout();
    for (const ev of events) {
      if (!ev.touch) continue;
      if (ev.type === 'down') {
        const b = this.buttons.find((bb) => dist(ev.x, ev.y, bb.x, bb.y) < bb.r * 1.35);
        if (b) { this.ptr[ev.id] = b.name; Input.latch[b.name] = true; continue; }
        if (ev.x < Gfx.W * 0.5) this.joy = { id: ev.id, ox: ev.x, oy: ev.y, x: ev.x, y: ev.y };
      } else if (ev.type === 'move') {
        if (this.joy && this.joy.id === ev.id) {
          this.joy.x = ev.x; this.joy.y = ev.y;
          const dx = ev.x - this.joy.ox, dy = ev.y - this.joy.oy, d = Math.hypot(dx, dy), R = this.joyR;
          if (d > R) { this.joy.ox = ev.x - dx / d * R; this.joy.oy = ev.y - dy / d * R; }
        } else if (this.ptr[ev.id]) {
          const b = this.buttons.find((bb) => dist(ev.x, ev.y, bb.x, bb.y) < bb.r * 1.2);
          if (b && b.name !== this.ptr[ev.id]) { this.ptr[ev.id] = b.name; Input.latch[b.name] = true; }
        }
      } else if (ev.type === 'up') {
        if (this.joy && this.joy.id === ev.id) this.joy = null;
        delete this.ptr[ev.id];
      }
    }
    const t = {};
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, R = this.joyR;
      if (dx < -R * 0.28) t.left = true;
      if (dx > R * 0.28) t.right = true;
      if (dy < -R * 0.55) { t.up = true; if (!Input.touch.up) Input.latch.up = true; }
      if (dy > R * 0.55) t.down = true;
    }
    for (const id in this.ptr) t[this.ptr[id]] = true;
    Input.touch = t;
  },
  draw(ctx) {
    this.layout();
    const hc = Hud.ctx, p = window.world && world.player;
    hc.globalAlpha = 0.5;
    const j = this.joy || { ox: this.joyHome.x, oy: this.joyHome.y, x: this.joyHome.x, y: this.joyHome.y };
    const R = this.joyR;
    UI.img(circleSprite('#15131c', R + 2), j.ox - R - 2, j.oy - R - 2);
    UI.img(circleSprite('#3a3650', R), j.ox - R, j.oy - R);
    const kr = Math.round(R * 0.45);
    hc.globalAlpha = 0.75;
    UI.img(circleSprite('#e8e4f8', kr), j.x - kr, j.y - kr);
    for (const b of this.buttons) {
      const on = Object.values(this.ptr).includes(b.name);
      hc.globalAlpha = on ? 0.85 : 0.5;
      UI.img(circleSprite('#15131c', b.r + 2), b.x - b.r - 2, b.y - b.r - 2);
      UI.img(circleSprite(on ? '#ffd23a' : b.name === 'fire' ? '#b8302a' : b.name === 'jump' ? '#2e5aa8' : b.name === 'melee' ? '#7a5a8a' : '#2c8a3a', b.r), b.x - b.r, b.y - b.r);
      hc.globalAlpha = 1;
      // a picture over the word (the word matches the tutorial signs)
      const col = on ? INK : '#ffffff', k = b.r >= 20 ? 2 : 1, sp = b.name === 'special' && p && !p.dead && Sprites.props.specialIcon[p.hero.id];
      if (sp) UI.img(sp, b.x - sp.width * k / 2, b.y - 2 - sp.height * k, k);
      else UI.icon({ fire: 'gun', jump: '↑', melee: 'knife', special: 'special' }[b.name], b.x - 3.5 * k, b.y - 2 - 7 * k, col, k);
      UI.text(b.label, b.x, b.y + 2, col, 1, 'center');
    }
    hc.globalAlpha = 1;
  },
};

// ----------------------------------------------------------------------------
//  Gameplay scene + overlays
// ----------------------------------------------------------------------------
// Arcade runs: endless generated missions; lives, score and the perk cards carry over.
function arcadeMission(stage, runSeed, score, lives, perks) {
  return { def: arcadeDef(stage, runSeed), seed: (runSeed + stage * 977) >>> 0, arcade: { stage, runSeed, score, lives, perks: perks || {} } };
}
function newArcadeRun() { return arcadeMission(1, (Date.now() & 0x7fffffff) >>> 0, 0, null); }
function exitScene(W) { return W && (W.arcade || W.daily) ? TitleScene : LevelSelectScene; }
// Daily mission: the same generated mission for everyone today (seeded by the date)
function todayKey() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function dailyMission() {
  const day = todayKey();
  const stage = new RNG(day).pick([4, 6, 7, 8, 9]);
  return { def: arcadeDef(stage, day), seed: (day * 31) >>> 0, daily: day };
}

const PlayScene = {
  // mission: campaign index or an arcade mission object (kept for RESTART)
  enter(mission) {
    this.level = mission;
    this.world = new World(mission);
    this.overlay = null;
    // the very first launch (main.js) has no title screen: the logo rides in over the drop like a
    // film's opening title, in place of the mission's own words, and the HUD waits for it (1.31)
    this.intro = this.firstRun ? { t: 0 } : null;
    this.firstRun = false;
    if (this.intro) this.world.messages.length = 0;
    if (!Save.data.played) { Save.data.played = 1; Save.save(); }
    Touch.reset();
    Input.clear();
  },
  exit() { Playtest.leave(this.world); Sound.stopAllLoops(); Platform.gameplayStop(); this.overlay = null; GRAVITY = BASE_GRAVITY; },
  onGameplay() { if (!this.overlay) Platform.gameplayStart(); },
  // reason: undefined = the player paused, 'blur' = the window lost focus, 'panel' = test report opened
  pause(reason) {
    if (this.overlay) return;
    Playtest.pause(reason);
    this.overlay = PauseOverlay; PauseOverlay.open();
    Platform.gameplayStop(); Sound.stopAllLoops(); Touch.reset();
  },
  resume() { this.overlay = null; Input.clear(); Touch.reset(); if (this.world.state === 'play' || this.world.state === 'extract') Platform.gameplayStart(); },
  update(dt) {
    const events = Input.takePointerEvents();
    const W = this.world;
    if (this.overlay) {
      this.overlay.update(dt, events);
      if (this.overlay && this.overlay.live) { W.inputEnabled = false; W.update(dt); }
      return;
    }
    W.inputEnabled = true;
    for (const ev of events) {
      const hit = ev.touch ? 34 : 24; // fingers need a bigger target than the 14px icon
      if (ev.type === 'down' && ev.x > Gfx.W - hit && ev.y < hit) { this.pause(); return; }
    }
    if (Input.hit('pause') || Input.hit('back')) { this.pause(); return; }
    if (this.intro && (this.intro.t += dt) > 3.2) this.intro = null;
    Touch.handle(events);
    W.update(dt);
    if (W.state === 'complete' && !this.overlay) { this.overlay = CompleteOverlay; CompleteOverlay.open(W); Touch.reset(); }
    else if (W.state === 'gameover' && W.completeT > 1.0 && !this.overlay) { this.overlay = GameOverOverlay; GameOverOverlay.open(W); Touch.reset(); }
  },
  draw(ctx) {
    this.world.draw(ctx);
    if (this.intro && !this.overlay) this.drawIntro(ctx);
    if (this.overlay) Hud.clear(); // the pause and results screens have the screen to themselves
    if (!this.overlay && Input.mode === 'touch') Touch.draw(ctx);
    if (this.overlay) this.overlay.draw(ctx);
  },
  layout() { if (this.overlay && this.overlay.layout) this.overlay.layout(); },
  // the first launch's opening title: in, a glint, up and out; the HUD stays away until it goes
  drawIntro(ctx) {
    const t = this.intro.t, a = clamp(Math.min(t / 0.35, (3.2 - t) / 0.6), 0, 1), W = Gfx.W;
    const k = Logo.k() + (Gfx.H >= 240 ? 1 : 0), L = Logo.get(k);
    const y = Math.round(Math.max(8, Gfx.H * 0.05) - Math.max(0, t - 2.6) * 30);
    if (t < 2.9) Hud.clear();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 0, y + L.H + 30);
    g.addColorStop(0, 'rgba(10,8,16,0.55)'); g.addColorStop(1, 'rgba(10,8,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, y + L.H + 30);
    Logo.draw(ctx, W / 2, y, k, t + 4.7);
    ctx.globalAlpha = 1;
    Hud.ctx.globalAlpha = a;
    UI.stampD('RESCUE  •  SWAP  •  DESTROY', UI.X(W / 2), UI.X(y + L.H + 4), '#ffd23a', 1, 'center');
    Hud.ctx.globalAlpha = 1;
  },
};

const PauseOverlay = {
  live: false,
  open() { this.menu = new Menu(); this.layout(); this.menu.focus = 0; },
  update(dt, events) {
    if (Input.hit('pause') || Input.hit('back')) { PlayScene.resume(); return; }
    this.menu.update(events);
  },
  // RESUME is the main action; sound and music are switches with pictures, as on the title
  layout() {
    const W = Gfx.W, H = Gfx.H, bw = 124, x = Math.round(W / 2 - bw / 2), y = Math.round(H / 2 - 44);
    const w = PlayScene.world;
    this.menu.set([
      new Btn({ id: 'resume', label: 'RESUME', icon: '▶', primary: true, x, y, w: bw, h: 20, onClick: () => PlayScene.resume() }),
      new Btn({ id: 'restart', label: 'RESTART', icon: 'replay', x, y: y + 25, w: bw, h: 18, onClick: () => { Funnel.quit(PlayScene.world, 'restart'); Platform.commercialBreak().then(() => App.go(PlayScene, PlayScene.level)); } }),
      new Btn({ id: 'quit', label: w.arcade ? 'QUIT RUN' : 'QUIT MISSION', icon: 'quit', x, y: y + 47, w: bw, h: 18, onClick: () => { const W = PlayScene.world; Funnel.quit(W, 'quit'); if (W.arcade) Save.recordArcade(W.arcade.stage, W.arcade.score + W.score); App.go(exitScene(W)); } }),
      new Btn({ id: 'sfx', icon: 'sfx', off: !Sound.sfxOn, label: '', x, y: y + 73, w: 26, h: 16, onClick: () => { toggleSfx(); this.layout(); } }),
      new Btn({ id: 'music', icon: 'music', off: !Sound.musicOn, label: '', x: x + 30, y: y + 73, w: 26, h: 16, onClick: () => { toggleMusic(); this.layout(); } }),
      new Btn({ id: 'options', label: 'OPTIONS', icon: 'gear', x: x + 60, y: y + 73, w: bw - 60, h: 16, onClick: () => { PlayScene.overlay = OptionsOverlay; OptionsOverlay.open(); } }),
    ]);
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, m = UI.m;
    ctx.fillStyle = 'rgba(10,8,16,0.65)'; ctx.fillRect(0, 0, W, H);
    if (H >= 212) this.drawBrief(ctx, W, H);
    const tune = TunePanel.enabled(), last = this.menu.buttons[this.menu.buttons.length - 1];
    const top = H / 2 - 74, [X, Y, PW, PH] = UI.box(W / 2 - 74, top, 148, last.y + last.h + 9 - top + (tune ? 10 : 0));
    UI.plateD(X, Y, PW, PH, 'dark');
    UI.stampD('PAUSED', X + Math.round(PW / 2), Y + 8 * m, '#ffd23a', UI.sz(12), 'center');
    this.menu.draw(ctx);
    if (tune) UI.textD('F2 TUNING  F3 TEST LOG', X + Math.round(PW / 2), Y + PH - 11 * m, '#8a88a0', 1, 'center');
  },
  // top: the mission and its objective; bottom: the three medals, as they stand right now
  drawBrief(ctx, W, H) {
    const w = PlayScene.world, m = UI.m, CX = UI.X(W / 2);
    UI.bandD(0, UI.X(30));
    const head = w.daily ? 'DAILY MISSION - ' + dailyRule(w.daily).name : w.arcade ? 'ARCADE STAGE ' + w.arcade.stage : 'MISSION ' + (w.levelIndex + 1) + ' - ' + w.def.name;
    UI.stampD(head, CX, 7 * m, '#ffd23a', 1, 'center');
    UI.textD(w.objectiveText() || missionGoal(w.def), CX, 20 * m, '#ffffff', 1, 'center');
    const BY = UI.X(H - 24);
    UI.bandD(BY, UI.X(H) - BY);
    if (w.arcade) { drawPerkRow(ctx, w.arcade.perks || {}, W / 2, H - 15, 'PERKS:'); return; }
    const freed = w.rescued >= w.prisonersTotal, lost = w.deaths > 0;
    const items = [['COMPLETE', 'off'], ['ALL PRISONERS ' + w.rescued + '/' + w.prisonersTotal, freed ? 'on' : 'off'], ['NO LOSSES', lost ? 'lost' : 'on']];
    // finer letters when the line is wider than the screen (other languages run longer)
    let f = m, iw, tot;
    for (;;) {
      iw = items.map(([t]) => 12 * m + Font.width(t) * f); tot = iw.reduce((a, b) => a + b, 0) + 16 * m * 2;
      if (f <= 1 || tot <= UI.X(W - 8)) break;
      f--;
    }
    let x = Math.round(CX - tot / 2);
    const MY = BY + Math.round((UI.X(H) - BY - 16 * m) / 2);
    items.forEach(([t, st], k) => {
      UI.medalD(x, MY, k, st);
      Font.draw(Hud.ctx, t, x + 12 * m, MY + 8 * m - Math.round(3.5 * f), st === 'on' ? '#ffffff' : st === 'lost' ? '#ff8a6a' : '#8a88a0', f);
      x += iw[k] + 16 * m;
    });
  },
};

const CompleteOverlay = {
  live: true,
  open(W) {
    this.W = W; this.t = 0; this.menu = new Menu(); this.newMedals = 0;
    const par = W.terrain.w * 0.8;
    this.timeBonus = Math.max(0, Math.round((par - W.time) * 20));
    this.allBonus = W.rescued >= W.prisonersTotal ? 2000 : 0;
    this.noDeathBonus = W.deaths === 0 ? 2000 : 0;
    this.total = W.score + this.timeBonus + this.allBonus + this.noDeathBonus;
    this.stars = 1 + (W.rescued >= W.prisonersTotal ? 1 : 0) + (W.deaths === 0 ? 1 : 0);
    this.mask = 1 | (W.rescued >= W.prisonersTotal ? 2 : 0) | (W.deaths === 0 ? 4 : 0);
    this.prevMask = W.arcade || W.daily ? 7 : Save.medals(W.levelIndex); // medals earned before this run
    Playtest.complete(W, this.stars, this.total);
    Funnel.complete(W);
    if (W.arcade) {
      this.runTotal = W.arcade.score + this.total;
      this.prevBest = Save.data.arcadeBest || 0;
      Save.recordArcade(W.arcade.stage, this.runTotal);
      this.last = false;
    } else if (W.daily) {
      this.prevBest = Save.dailyBest(W.daily);
      Save.recordDaily(W.daily, this.total);
      this.last = false;
    } else {
      this.prevBest = Save.data.best[W.levelIndex] || 0;
      Save.completeLevel(W.levelIndex, this.stars, this.total, this.mask);
      this.newMedals = this.mask & ~this.prevMask;
      this.last = W.levelIndex >= LEVELS.length - 1;
    }
    this.reward = Meta.missionReward(W, this.stars, this.newMedals || 0);
    Meta.add(this.reward.total);
    // the first mission finished today brings the daily supply drop (after the results have had
    // their moment): a new player meets the streak - and tomorrow's bigger drop - in session one
    this.drop = Meta.daily().ready ? Meta.daily() : null; this.dropOpen = false;
    this.nextHero = Meta.nextHero();
    Platform.gameplayStop();
    Platform.happyTime();
    this.layout();
  },
  layout() {
    if (this.dropOpen) { this.openDrop(true); return; } // resized while the supply drop is up
    const W = Gfx.W, H = Gfx.H, bw = 92;
    const y = Math.round(H / 2 + 54);
    const w = this.W;
    if (w.arcade) {
      const a = w.arcade;
      this.menu.set([
        new Btn({ id: 'next', label: 'NEXT STAGE', icon: '▶', primary: true, x: Math.round(W / 2 - bw / 2 - 20), y, w: bw + 40, h: 20, onClick: () => { PlayScene.overlay = PerkOverlay; PerkOverlay.open(w, this.runTotal); } }),
        new Btn({ id: 'menu', label: 'MENU', icon: 'menu', x: Math.round(W / 2 + bw / 2 + 26), y, w: 60, h: 20, onClick: () => App.go(TitleScene) }),
      ]);
      this.menu.focus = 0;
      return;
    }
    if (w.daily) {
      this.menu.set([
        new Btn({ id: 'again', label: 'PLAY AGAIN', icon: 'replay', primary: true, x: Math.round(W / 2 - bw - 4), y, w: bw, h: 20, onClick: () => Platform.commercialBreak().then(() => App.go(PlayScene, dailyMission())) }),
        new Btn({ id: 'menu', label: 'MENU', icon: 'menu', x: Math.round(W / 2 + 4), y, w: bw, h: 20, onClick: () => App.go(TitleScene) }),
      ]);
      this.menu.focus = 0;
      return;
    }
    const next = () => {
      if (this.last) { App.go(VictoryScene); return; }
      Platform.commercialBreak().then(() => App.go(PlayScene, w.levelIndex + 1));
    };
    this.menu.set([
      new Btn({ id: 'next', label: this.last ? 'FINALE' : 'NEXT', icon: '▶', primary: true, x: Math.round(W / 2 - bw / 2), y, w: bw, h: 20, scale: 1, onClick: next }),
      new Btn({ id: 'replay', label: 'REPLAY', icon: 'replay', x: Math.round(W / 2 - bw * 1.5 - 6), y, w: bw, h: 20, onClick: () => Platform.commercialBreak().then(() => App.go(PlayScene, w.levelIndex)) }),
      new Btn({ id: 'menu', label: 'MENU', icon: 'menu', x: Math.round(W / 2 + bw / 2 + 6), y, w: bw, h: 20, onClick: () => App.go(LevelSelectScene) }),
    ]);
    this.menu.focus = 0;
  },
  openDrop(quiet) {
    this.dropOpen = true;
    const b = this.dropBox = dropBox();
    const close = (claim) => { if (claim && Meta.claimDaily()) dropBurst(); this.drop = null; this.dropOpen = false; this.layout(); };
    this.menu.set([new Btn({ id: 'claim', label: 'CLAIM', primary: true, x: b.x + 35, y: b.y + 66, w: b.w - 70, h: 18, onClick: () => close(true) })], false);
    this.menu.focus = 0;
    this.closeDrop = close;
    if (!quiet) Sound.play('pickup', 0.8);
  },
  update(dt, events) {
    this.t += dt;
    if (this.drop && !this.dropOpen && this.t > 2.2) this.openDrop();
    if (this.dropOpen && (Input.hit('pause') || Input.hit('back'))) { this.closeDrop(false); return; }
    if (this.t > 0.6) this.menu.update(events);
  },
  // the debrief: medals pinned on one by one, the numbers on a plate, each with a picture
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, w = this.W, m = UI.m;
    ctx.fillStyle = 'rgba(10,8,16,' + Math.min(0.7, this.t * 2) + ')'; ctx.fillRect(0, 0, W, H);
    const cy = Math.round(H / 2), CX = UI.X(W / 2);
    UI.otextD(w.arcade ? 'STAGE ' + w.arcade.stage + ' CLEARED!' : w.daily ? 'DAILY MISSION DONE!' : 'MISSION COMPLETE!', CX, UI.X(cy - 98), '#7cff7c', UI.sz(14), 'center');
    const k0 = Math.max(2, Math.round(1.45 * Hud.F)); // a medal about 24 game pixels tall
    for (let s = 0; s < 3 && !w.arcade; s++) {
      const [bit, label] = MEDALS[s], got = (this.mask & bit) !== 0, appear = this.t - 0.4 - s * 0.35;
      const fresh = got && !(this.prevMask & bit), on = got && appear > 0;
      const k = on && appear < 0.12 ? Math.round(k0 * 1.35) : k0; // pinned on: it lands big and settles
      const slot = Math.min(96, Math.floor((W - 16) / 3)), MX = UI.X(W / 2 + (s - 1) * slot), MY = UI.X(cy - 70);
      UI.medalK(MX - 4 * k, MY - 8 * k, s, on ? (fresh ? 'new' : 'on') : 'off', k, this.t);
      if (got && appear > 0 && appear < 0.05) Sound.play('pickup', 0.8);
      if (appear > 0) {
        // a label wider than its slot (other languages) gets finer letters rather than run into the next
        let k = m;
        while (k > 1 && Font.width(label) * k > UI.X(slot - 4)) k = Math.max(1, k - Font.step());
        Font.drawOutlined(Hud.ctx, label, MX, MY + 8 * k0 + 2 * m, !got ? '#8a88a0' : fresh ? '#7cff7c' : '#ffd23a', k, 'center');
      }
    }
    const res = { target: 'COLONEL ELIMINATED', depots: 'FUEL DEPOTS DESTROYED', escape: 'DETONATION OUTRUN' }[w.goal];
    const sec = w.secret && w.secret.found ? '¤ SECRET FOUND' : '';
    if ((res || sec) && this.t > 0.3) UI.otextD([res, sec].filter(Boolean).join('    '), CX, UI.X(cy - 45), res ? '#ff8a3a' : '#ffd23a', 1, 'center');
    // the numbers, on a plate
    const rows = [
      ['skull', 'KILLS', String(w.kills) + (w.styleKills ? '  (' + w.styleKills + ' STYLE)' : '')],
      ['cage', 'PRISONERS FREED', w.rescued + '/' + w.prisonersTotal + (this.allBonus ? '  +' + this.allBonus : '')],
      ['lives', 'HEROES LOST', String(w.deaths) + (this.noDeathBonus ? '  +' + this.noDeathBonus : '')],
      ['clock', 'TIME', fmtTime(w.time) + (this.timeBonus ? '  +' + fmtNum(this.timeBonus) : '')],
      w.arcade ? ['★', 'RUN TOTAL', fmtNum(this.runTotal)] : ['★', 'SCORE', fmtNum(this.total)],
      ['$', 'CASH', '+$' + Math.round(this.reward.total * clamp((this.t - 0.9) / 0.7, 0, 1))], // counts up once it shows
    ];
    const step = 11 * m, [PX, PY, PW] = UI.box(W / 2 - 104, cy - 35, 208, 0), PH = 6 * step + 9 * m;
    if (this.t > 0.25) UI.plateD(PX, PY, PW, PH, 'dark');
    rows.forEach(([ic, a, b], i) => {
      if (this.t < 0.3 + i * 0.12) return;
      const y = PY + 6 * m + i * step, gold = i >= 4;
      UI.iconD(ic, PX + 8 * m, y, gold ? '#ffd23a' : '#9aa2ab');
      UI.textD(a, PX + 19 * m, y, gold ? '#ffd23a' : '#c8ccd4');
      UI.stampD(b, PX + PW - 8 * m, y, gold ? '#ffd23a' : '#ffffff', 1, 'right');
    });
    const best = w.arcade ? this.runTotal : this.total;
    if (best > this.prevBest && this.prevBest > 0 && this.t > 0.8) UI.chipD(PX + PW + 4 * m, PY + PH - 26 * m, '★', 'NEW BEST!', ((this.t * 3) | 0) % 2 ? '#ffd23a' : '#ffffff');
    if (this.t > 1.1) {
      const y = Math.max(UI.X(cy + 39), PY + PH + 5 * m);
      if (w.unlockedNow.length) UI.otextD('UNLOCKED: ' + w.unlockedNow.map((id) => HERO_BY_ID[id].name).join(', '), CX, y, '#7cff7c', 1, 'center');
      else if (this.nextHero) {
        // the road to the next hero: rescues so far on a bar
        const nh = this.nextHero, label = 'NEXT HERO: ' + nh.hero.name, cnt = nh.have + '/' + nh.need, BW = 60 * m;
        const tot = Font.width(label) * m + 8 * m + BW + 6 * m + Font.width(cnt) * m;
        let x = Math.round(CX - tot / 2);
        x += UI.otextD(label, x, y, '#c8c4e0') + 8 * m;
        UI.barD(x, y + m, BW, 5 * m, (nh.have - nh.from) / Math.max(1, nh.need - nh.from), '#7cff7c');
        UI.otextD(cnt, x + BW + 6 * m, y, '#7cff7c');
      }
    }
    if (this.dropOpen) drawDropPanel(ctx, this.dropBox, this.drop);
    if (this.t > 0.6) this.menu.draw(ctx);
  },
};

// Arcade: after each cleared stage the run takes 1 of 3 perk cards (they last until the run ends)
const PerkOverlay = {
  live: true,
  open(W, runTotal) {
    this.W = W; this.runTotal = runTotal; this.t = 0; this.picked = null; this.pickT = 0; this.next = null;
    this.menu = new Menu();
    const a = W.arcade;
    this.have = Object.assign({}, a.perks || {});
    this.choices = perkChoices(a.runSeed, a.stage, this.have);
    this.layout();
    this.menu.focus = 1 % this.choices.length;
    Sound.play('pickup', 0.8);
  },
  layout() {
    const W = Gfx.W, H = Gfx.H, n = this.choices.length;
    const cw = Math.min(104, Math.floor((W - 16) / 3) - 6), ch = Math.min(96, H - 96);
    const x0 = Math.round(W / 2 - (n * (cw + 6) - 6) / 2), y = Math.round(H / 2 - ch / 2) + 4;
    this.card = { cw, ch, y };
    this.menu.set(this.choices.map((id, i) => new Btn({
      id, label: '', x: x0 + i * (cw + 6), y, w: cw, h: ch,
      drawFn: (ctx, b, f) => this.drawCard(ctx, b, f, id),
      onClick: () => this.pick(id),
    })), true);
  },
  pick(id) {
    if (this.picked) return;
    this.picked = id;
    const a = this.W.arcade, perks = Object.assign({}, this.have);
    perks[id] = (perks[id] || 0) + 1;
    const lives = id === 'lives' ? Math.min(9, this.W.lives + 2) : this.W.lives;
    Sound.play('unlock');
    const b = this.menu.buttons.find((q) => q.id === id);
    if (b) for (let i = 0; i < 16; i++) FX.spawn(b.x + b.w / 2 + rand(-20, 20), b.y + 20, rand(-110, 110), rand(-200, -60), rand(0.5, 1), 2, PERK_BY_ID[id].color, PF.GRAV | PF.FLICKER);
    // a beat to see the pick, then the ad break and the next stage
    this.next = () => Platform.commercialBreak().then(() => App.go(PlayScene, arcadeMission(a.stage + 1, a.runSeed, this.runTotal, lives, perks)));
  },
  update(dt, events) {
    this.t += dt;
    if (this.picked) {
      this.pickT += dt;
      if (this.pickT > 0.6 && this.next) { const go = this.next; this.next = null; go(); }
      return;
    }
    if (this.t > 0.45) this.menu.update(events);
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H, c = this.card;
    ctx.fillStyle = 'rgba(10,8,16,0.84)'; ctx.fillRect(0, 0, W, H);
    UI.otext('CHOOSE A PERK', W / 2, c.y - 30, '#ffd23a', 2, 'center');
    UI.otext('IT LASTS UNTIL THE RUN ENDS', W / 2, c.y - 12, '#c8c4e0', 1, 'center');
    this.menu.draw(ctx);
    const shown = Object.assign({}, this.have);
    if (this.picked) shown[this.picked] = (shown[this.picked] || 0) + 1;
    drawPerkRow(ctx, shown, W / 2, c.y + c.ch + 9, 'YOUR RUN:');
  },
  drawCard(ctx, b, focus, id) {
    const p = PERK_BY_ID[id], lvl = (this.have[id] || 0) + 1;
    const picked = this.picked === id, lit = focus || picked;
    const x = b.x, y = b.y - (lit && !this.picked ? 2 : 0), w = b.w, h = b.h, hc = Hud.ctx;
    hc.globalAlpha = this.picked && !picked ? 0.3 : 1;
    UI.plate(x, y, w, h, 'dark', { ring: lit ? '#ffd23a' : null, rivets: false });
    UI.rect(x + 1, y + 1, w - 2, 2, p.color); // the perk's own colour along the top
    UI.icon(p.icon, x + w / 2 - 10.5, y + 7, p.color, 3);
    const name = Font.wrap(p.name, w - 8);
    name.forEach((l, i) => UI.stamp(l, x + w / 2, y + 33 + i * 9, '#ffffff', 1, 'center'));
    let ty = y + 35 + name.length * 9;
    if (p.instant) UI.text('INSTANT', x + w / 2, ty, '#7cff7c', 1, 'center');
    else if (p.max > 1) {
      const pw = p.max * 6 - 2, px = Math.round(x + w / 2 - pw / 2);
      for (let i = 0; i < p.max; i++) UI.rect(px + i * 6, ty + 1, 4, 4, i < lvl ? p.color : '#3a3f47');
    } else UI.text('NEW', x + w / 2, ty, p.color, 1, 'center');
    ty += 11;
    Font.wrap(p.desc(lvl), w - 8).forEach((l, i) => UI.text(l, x + w / 2, ty + i * 9, '#c8c4e0', 1, 'center'));
    hc.globalAlpha = 1;
  },
};

const GameOverOverlay = {
  live: true,
  open(W) {
    this.W = W; this.t = 0; this.busy = false; this.msg = ''; this.menu = new Menu();
    Playtest.gameover(W);
    Funnel.fail(W);
    this.offered = false;
    if (W.arcade) { this.prevBest = Save.data.arcadeBest || 0; Save.recordArcade(W.arcade.stage, W.arcade.score + W.score); }
    this.coins = Meta.failReward(W); Meta.add(this.coins);
    // a campaign mission that beats the player sends reinforcements next time (World.assist)
    this.assist = 0;
    if (!W.arcade && !W.daily && W.levelIndex >= 0) {
      const f = Save.data.fails || (Save.data.fails = {});
      f[W.levelIndex] = (f[W.levelIndex] || 0) + 1; Save.save();
      this.assist = Math.min(2, f[W.levelIndex]);
    }
    Platform.gameplayStop();
    this.layout();
  },
  layout() {
    const W = Gfx.W, H = Gfx.H, bw = 150, x = Math.round(W / 2 - bw / 2), y = Math.round(H / 2 - 6);
    const btns = [];
    // portal ad rules: the plain option sits above the video one and is just as big; the video
    // option is clearly optional, marked with a film icon, and not green
    const retryTarget = this.W.arcade ? () => newArcadeRun() : this.W.daily ? () => dailyMission() : () => this.W.levelIndex;
    const retryLabel = this.W.arcade ? 'NEW RUN' : this.W.daily ? 'RETRY DAILY' : this.assist ? 'RETRY  +' + this.assist + (this.assist > 1 ? ' LIVES' : ' LIFE') : 'RETRY MISSION';
    btns.push(new Btn({ id: 'retry', label: retryLabel, icon: 'replay', primary: true, x, y, w: bw, h: 20, onClick: () => Platform.commercialBreak().then(() => App.go(PlayScene, retryTarget())) }));
    let ny = y + 24;
    // the video offer: only where the portal has ads (not on Poki Kids), once per game over
    if (!this.W.continued && Platform.hasRewarded) {
      if (!this.offered) { this.offered = true; Funnel.offer('continue'); }
      btns.push(new Btn({
        id: 'cont', label: 'CONTINUE +3 LIVES', x, y: ny, w: bw, h: 20,
        drawFn: (ctx, b, f, p) => {
          drawButton(ctx, b, f, p, 14);
          UI.film(b.x + 7, b.y + (p ? 1 : 0) + Math.round((b.h - 11) / 2), '#ffd23a', '#3a3f47');
        },
        onClick: () => this.cont(),
      }));
      ny += 24;
    }
    btns.push(new Btn({ id: 'menu', label: 'MENU', icon: 'menu', x, y: ny, w: bw, h: 20, onClick: () => App.go(exitScene(this.W)) }));
    this.menu.set(btns);
    // keyboard focus starts on RETRY so a panicked jump/fire press can never start a rewarded ad
    this.menu.focus = btns.findIndex((b) => b.id === 'retry');
  },
  cont() {
    if (this.busy) return;
    this.busy = true;
    Funnel.took('continue');
    Platform.rewardedBreak().then((ok) => {
      this.busy = false;
      if (ok) {
        Playtest.cont(this.W);
        Funnel.start(this.W); // a new attempt from where the heroes fell
        PlayScene.overlay = null;
        this.W.continueGame();
        Platform.gameplayStart(); // the overlay and the ad both stopped gameplay
        const tr = { jungle: 0, desert: 2, arctic: -2 }[this.W.def.theme] || 0;
        Music.play(this.W.bossActive ? 'boss' : 'action', this.W.bossActive ? 0 : tr);
        Input.clear();
      } else this.msg = 'NO VIDEO AVAILABLE RIGHT NOW';
    });
  },
  update(dt, events) { this.t += dt; if (!this.busy && this.t > 1.0) this.menu.update(events); },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H;
    ctx.fillStyle = 'rgba(30,6,6,' + Math.min(0.7, this.t * 2) + ')'; ctx.fillRect(0, 0, W, H);
    const a = this.W.arcade;
    UI.otext(a ? 'RUN OVER' : 'MISSION FAILED', W / 2, H / 2 - 62, '#ff5a3a', 3, 'center');
    if (a) {
      const total = a.score + this.W.score;
      UI.otext('STAGE ' + a.stage + '   SCORE ' + fmtNum(total), W / 2, H / 2 - 32, '#ffffff', 1, 'center');
      UI.otext(total > this.prevBest ? 'NEW BEST RUN!' : 'BEST ' + fmtNum(this.prevBest), W / 2, H / 2 - 22, '#ffd23a', 1, 'center');
    } else UI.otext('ALL HEROES DOWN. SCORE ' + fmtNum(this.W.score), W / 2, H / 2 - 30, '#ffffff', 1, 'center');
    if (!a && this.t > 0.6) UI.otext('+$' + this.coins + ' FOR THE ATTEMPT', W / 2, H / 2 - 19, '#ffd23a', 1, 'center');
    if (a && this.t > 0.6 && Object.keys(a.perks || {}).length) drawPerkRow(ctx, a.perks, W / 2, H / 2 + 68, 'THIS RUN:');
    if (this.msg) UI.otext(this.msg, W / 2, H / 2 + 80, '#ffd23a', 1, 'center');
    if (this.t > 0.5) this.menu.draw(ctx);
    if (this.busy) UI.otext('LOADING...', W / 2, H / 2 + 80, '#ffffff', 1, 'center');
  },
};

// ----------------------------------------------------------------------------
//  Victory
// ----------------------------------------------------------------------------
const VictoryScene = {
  enter() { this.t = 0; this.menu = new Menu(); Music.play('title'); FX.reset(null); Platform.happyTime(); },
  layout() {
    const W = Gfx.W, H = Gfx.H;
    this.menu.set([new Btn({ id: 'menu', label: 'MAIN MENU', icon: 'menu', primary: true, x: Math.round(W / 2 - 55), y: H - 40, w: 110, h: 18, onClick: () => App.go(TitleScene) })]);
  },
  update(dt) {
    this.t += dt;
    Backdrop.update(dt);
    if (Math.random() < dt * 3) FX.explosion(rand(0, Gfx.W), rand(20, Gfx.H * 0.6), rand(10, 22));
    this.menu.update(Input.takePointerEvents());
  },
  draw(ctx) {
    const W = Gfx.W, H = Gfx.H;
    Backdrop.draw(ctx, 0.45);
    UI.otext('VICTORY!', W / 2, 18, '#ffd23a', 4, 'center');
    const lines = [
      'GENERAL GRIMM HAS BEEN DEFEATED.',
      'THE PRISONERS ARE FREE.',
      'THE WORLD IS SAFE... FOR NOW.',
      '',
      'TOTAL STARS: ' + Save.totalStars() + '/' + LEVELS.length * 3,
      'TOTAL SCORE: ' + fmtNum(Object.values(Save.data.best).reduce((a, b) => a + b, 0)),
    ];
    lines.forEach((l, i) => UI.otext(l, W / 2, 62 + i * 12, i >= 4 ? '#7cff7c' : '#ffffff', 1, 'center'));
    if (H - 66 >= 136) Backdrop.drawLineup(ctx, H - 50);
    this.menu.draw(ctx);
  },
};
