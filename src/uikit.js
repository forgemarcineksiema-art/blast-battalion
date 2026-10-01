'use strict';
// ============================================================================
//  Menu kit (1.28). The menus, the pause screen and the results get the look of the HUD
//  ("B - military", src/hud.js): gunmetal plates with a bevel and rivets, a hazard-yellow
//  plate for the one main action, brass for the current choice, glass strips, keycaps,
//  medals, little pictures instead of words. It draws on the HUD layer, in the game's own
//  pixel size, and the layout stays in game pixels (that's where buttons are hit-tested).
//  Device pixels are written in capitals (X, Y, W, H), everything else is in game pixels.
// ============================================================================

const INK = '#15131c';
//                face       light      left       shade      right      rivet
const PLATES = {
  metal: ['#4a5059', '#8e969f', '#6d757e', '#2c3036', '#33383e', '#b8c0c8'],
  dark: ['#2f343b', '#59616a', '#454b53', '#1a1d21', '#212529', '#7a828b'],
  brass: ['#8a6a2a', '#e0b860', '#b08a3a', '#4a3814', '#5a4418', '#f4dc98'],
  hazard: ['#ffd23a', '#fff3b0', '#ffe070', '#a8851a', '#c49a24', '#fff8d8'],
  olive: ['#4b5a2a', '#8a9a5a', '#6a7a3a', '#262e14', '#2e381a', '#b4c486'],
  red: ['#8a2a20', '#d8604a', '#b04030', '#40120c', '#501810', '#f0a090'],
  jungle: ['#3d5a2e', '#7a9a5a', '#56763e', '#1e2e16', '#26381a', '#a8c488'],
  desert: ['#7a5a30', '#c8a060', '#9a7a44', '#3e2c14', '#4a3418', '#e8cc98'],
  arctic: ['#3e5a78', '#88a8c8', '#5a7a9a', '#1c2c3e', '#22344a', '#b8d0e8'],
  off: ['#2a2c31', '#3c3f45', '#34373c', '#1a1b1e', '#1e2023', '#4a4d54'],
};
// 7x7 pictures, rows as bit masks (like ICONS in ui.js, which the kit also knows)
const UI_ICONS = {
  flag: [0x7c, 0x7e, 0x7c, 0x40, 0x40, 0x40, 0x60],
  swords: [0x41, 0x22, 0x14, 0x08, 0x14, 0x63, 0x63],
  calendar: [0x22, 0x7f, 0x41, 0x55, 0x41, 0x55, 0x7f],
  chevrons: [0x08, 0x14, 0x22, 0x49, 0x14, 0x22, 0x41],
  coop: [0x36, 0x7f, 0x7f, 0x22, 0x77, 0x77, 0x77],
  skull: [0x3e, 0x7f, 0x49, 0x49, 0x7f, 0x3e, 0x2a],
  cage: [0x7f, 0x55, 0x55, 0x55, 0x55, 0x55, 0x7f],
  clock: [0x1c, 0x22, 0x49, 0x4d, 0x41, 0x22, 0x1c],
  replay: [0x1d, 0x23, 0x47, 0x40, 0x41, 0x22, 0x1c],
  menu: [0x00, 0x7f, 0x00, 0x7f, 0x00, 0x7f, 0x00],
  quit: [0x41, 0x22, 0x14, 0x08, 0x14, 0x22, 0x41],
  heart: [0x36, 0x7f, 0x7f, 0x7f, 0x3e, 0x1c, 0x08],
  gun: [0x00, 0x00, 0x7f, 0x7c, 0x60, 0x60, 0x00],
  knife: [0x00, 0x00, 0x1e, 0x7f, 0x60, 0x00, 0x00],
  target: [0x1c, 0x22, 0x49, 0x5d, 0x49, 0x22, 0x1c],
  drum: [0x3e, 0x41, 0x3e, 0x22, 0x3e, 0x22, 0x3e],
  fire: [0x08, 0x0c, 0x1c, 0x3e, 0x3e, 0x3e, 0x1c],
  back: [0x08, 0x18, 0x3f, 0x7f, 0x3f, 0x18, 0x08],
  hat: [0x1c, 0x1c, 0x1c, 0x1c, 0x3e, 0x7f, 0x00],
};
// a medal, 8x16: o ink, a/b ribbon, g disc, d disc shade and emblem, h shine
const MEDAL_ART = [
  'oooooooo', 'oaabbaao', 'oaabbaao', 'oaabbaao', 'oaabbaao', 'oaabbaao', '.oooooo.', '..oddo..',
  '.oggggo.', 'ohgddggo', 'ogddddgo', 'ogddddgo', 'oggddgdo', 'ogggggdo', '.oddddo.', '..oooo..',
];
const MEDAL_RIBBONS = [['#2c8a3a', '#ffd23a'], ['#2e5aa8', '#e8ecf4'], ['#b8302a', '#e8ecf4']];

const UI = {
  cache: new Map(),
  // device pixels per kit pixel: a game pixel - menus keep the game's own letter size, easy to
  // read on a phone (a finer, HUD-sized variant was tried and turned down)
  get m() { return Math.max(1, Math.round(Hud.F)); },
  X(v) { return Math.round(v * Hud.F); },
  // a rect in game pixels -> [X, Y, W, H]
  box(x, y, w, h) { const X = this.X(x), Y = this.X(y); return [X, Y, this.X(x + w) - X, this.X(y + h) - Y]; },
  // text width / line height at size s, in game pixels (layouts ask this)
  tw(t, s = 1) { return Font.width(t) * s * this.m / Hud.F; },
  th(s = 1) { return 7 * s * this.m / Hud.F; },
  // n kit pixels in game pixels
  gx(n) { return n * this.m / Hud.F; },
  // the text size whose letters stand about px game pixels tall (headlines keep their place at
  // every screen scale, while the small print stays as fine as the HUD)
  sz(px) { return Math.max(1, Math.round(px * Hud.F / (7 * this.m))); },

  // ---- plates ----------------------------------------------------------------------------
  // a bevelled plate with an ink outline and rivets; o: { ring, pressed, rivets: false, flat }
  plateD(X, Y, W, H, kind = 'metal', o = {}) {
    const m = this.m, P = PLATES[kind] || PLATES.metal;
    const r = Math.max(m, Math.min(2 * m, Math.floor(Math.min(W, H) / 5 / m) * m));
    const drop = o.pressed || o.flat ? 0 : m;
    if (o.ring) Hud.round(X - 2 * m, Y - 2 * m, W + 4 * m, H + 4 * m + drop, r + 2 * m, o.ring);
    Hud.round(X - m, Y - m, W + 2 * m, H + 2 * m + drop, r + m, INK);
    Hud.round(X, Y, W, H, r, P[0]);
    Hud.R(X + r, Y, W - 2 * r, m, P[1]); Hud.R(X, Y + r, m, H - 2 * r, P[2]);
    Hud.R(X + r, Y + H - m, W - 2 * r, m, P[3]); Hud.R(X + W - m, Y + r, m, H - 2 * r, P[4]);
    if (kind === 'hazard') this.stripes(X, Y, W, H);
    if (o.rivets !== false && kind !== 'hazard' && W >= 30 * m && H >= 16 * m) {
      const ys = H >= 20 * m ? [Y + 3 * m, Y + H - 4 * m] : [Y + Math.round((H - m) / 2 / m) * m];
      for (const ry of ys) for (const rx of [X + 3 * m, X + W - 4 * m]) { Hud.R(rx, ry, m, m, P[5]); Hud.R(rx + m, ry + m, m, m, P[3]); }
    }
  },
  plate(x, y, w, h, kind, o) { const [X, Y, W, H] = this.box(x, y, w, h); this.plateD(X, Y, W, H, kind, o); },
  // black diagonal stripes at both ends of a hazard plate
  stripeW(W) { const m = this.m; return Math.min(8 * m, Math.floor(W / 7 / m) * m); },
  stripes(X, Y, W, H) {
    const m = this.m, band = this.stripeW(W), c = Hud.ctx;
    if (!this.stripe || this.stripeM !== m) {
      const n = 6 * m, cv = makeCanvas(n, n), x = cv.getContext('2d');
      x.fillStyle = 'rgba(21,19,28,0.9)';
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 6 < 3) x.fillRect(i * m, j * m, m, m);
      this.stripe = c.createPattern(cv, 'repeat'); this.stripeM = m;
    }
    c.fillStyle = this.stripe;
    c.fillRect(X + m, Y + m, band, H - 2 * m); c.fillRect(X + W - m - band, Y + m, band, H - 2 * m);
  },
  glassD(X, Y, W, H, a = 0.7) { Hud.glass(X, Y, W, H, a); },
  rect(x, y, w, h, c) { const [X, Y, W, H] = this.box(x, y, w, h); Hud.R(X, Y, W, H, c); },
  glass(x, y, w, h, a) { const [X, Y, W, H] = this.box(x, y, w, h); this.glassD(X, Y, W, H, a); },
  // a band across the whole width (the top and bottom bars of the pause screen, page titles)
  bandD(Y, H, a = 0.78) {
    const m = this.m, W = Hud.canvas.width;
    Hud.R(0, Y, W, H, 'rgba(14,12,24,' + a + ')');
    if (Y > 0) Hud.R(0, Y - m, W, m, 'rgba(0,0,0,0.35)'); else Hud.R(0, Y + H, W, m, 'rgba(0,0,0,0.35)');
    Hud.R(0, Y > 0 ? Y : Y + H - m, W, m, 'rgba(255,255,255,0.08)');
  },

  // ---- text -----------------------------------------------------------------------------
  textD(t, X, Y, col, s = 1, align = 'left') { return Font.draw(Hud.ctx, t, X, Y, col, s * this.m, align); },
  // pressed into metal: a dark shadow under the letters
  stampD(t, X, Y, col, s = 1, align = 'left', sh) { return this.stampK(t, X, Y, col, s * this.m, align, sh); },
  stampK(t, X, Y, col, k, align = 'left', sh = 'rgba(8,8,12,0.75)') {
    Font.draw(Hud.ctx, t, X, Y + k, sh, k, align);
    return Font.draw(Hud.ctx, t, X, Y, col, k, align);
  },
  otextD(t, X, Y, col, s = 1, align = 'left') { return Font.drawOutlined(Hud.ctx, t, X, Y, col, s * this.m, align); },
  text(t, x, y, col, s, align) { return this.textD(t, this.X(x), this.X(y), col, s, align); },
  // the biggest letters (device px per font px, at most the kit's own) that keep t inside maxW game px
  kFor(t, maxW) { let k = this.m; while (k > 1 && Font.width(t) * k > this.X(maxW)) k = Math.max(1, k - Font.step()); return k; },
  // outlined text that stays inside maxW game pixels: finer letters rather than off the edge
  fit(t, x, y, col, maxW, align = 'center') { return Font.drawOutlined(Hud.ctx, t, this.X(x), this.X(y), col, this.kFor(t, maxW), align); },
  // word-wrap into maxW game px at the kit's letters; a word that would have to split between two
  // letters (no soft hyphen fits: long German words on small cards) gets finer letters first, down
  // to half size: { lines, k }
  wrapK(t, maxW) {
    const D = this.X(maxW), lo = Math.max(1, Math.round(this.m / 2));
    let first = null;
    for (let k = this.m; k >= lo; k -= Font.step()) {
      const lines = Font.wrap(t, D, k);
      if (!lines.cut) return { lines, k };
      if (!first) first = { lines, k };
    }
    return first;
  },
  stamp(t, x, y, col, s, align, sh) { return this.stampD(t, this.X(x), this.X(y), col, s, align, sh); },
  otext(t, x, y, col, s, align) { return this.otextD(t, this.X(x), this.X(y), col, s, align); },
  wrap(t, w, s = 1) { return Font.wrap(t, Math.floor(this.X(w) / (s * this.m))); },

  // ---- pictures ---------------------------------------------------------------------------
  // a 7x7 picture (UI_ICONS / ICONS name or rows) or a font glyph; s = kit pixels per icon pixel
  iconD(name, X, Y, col, s = 1) {
    const k = Math.max(1, Math.round(s * this.m)), rows = Array.isArray(name) ? name : UI_ICONS[name] || ICONS[name];
    if (!rows) { Font.draw(Hud.ctx, name, X + k, Y, col, k); return; }
    const key = 'i' + (Array.isArray(name) ? name.join(',') : name) + col + k;
    let c = this.cache.get(key);
    if (!c) {
      c = makeCanvas(7 * k, 7 * k); const x = c.getContext('2d'); x.fillStyle = col;
      for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) if (rows[r] & (64 >> q)) x.fillRect(q * k, r * k, k, k);
      this.cache.set(key, c);
    }
    Hud.ctx.drawImage(c, X, Y);
  },
  icon(name, x, y, col, s) { this.iconD(name, this.X(x), this.X(y), col, s); },
  // a sprite at k device pixels per sprite pixel / at sc game pixels per sprite pixel
  imgD(im, X, Y, k) { Hud.ctx.drawImage(im, Math.round(X), Math.round(Y), Math.round(im.width * k), Math.round(im.height * k)); },
  img(im, x, y, sc = 1) { this.imgD(im, this.X(x), this.X(y), sc * Hud.F); },
  // a medal (MEDAL_ART): kind 0 COMPLETE, 1 ALL PRISONERS, 2 NO LOSSES; state on | new | off | lost
  medalD(X, Y, kind, state, s = 1, t = 0) { return this.medalK(X, Y, kind, state, Math.max(1, Math.round(s * this.m)), t); },
  // the same with k device pixels per medal pixel
  medalK(X, Y, kind, state, k, t = 0) {
    const blink = state === 'new' && ((t * 4) | 0) % 2;
    const key = 'm' + kind + state + blink + k;
    let c = this.cache.get(key);
    if (!c) {
      const off = state === 'off', lost = state === 'lost', rib = MEDAL_RIBBONS[kind];
      const col = {
        o: INK, a: off || lost ? '#3a3d45' : rib[0], b: off || lost ? '#4a4e58' : rib[1],
        g: blink ? '#ffffff' : off ? '#4a4d58' : lost ? '#6a3a3a' : '#ffd23a',
        d: off ? '#34363e' : lost ? '#4a2424' : '#b8861a', h: off ? '#5a5e6a' : lost ? '#8a5050' : '#fff3b0',
      };
      c = makeCanvas(8 * k, 16 * k); const x = c.getContext('2d');
      MEDAL_ART.forEach((row, r) => { for (let q = 0; q < 8; q++) if (row[q] !== '.') { x.fillStyle = col[row[q]]; x.fillRect(q * k, r * k, k, k); } });
      if (lost) { x.fillStyle = '#ff5a3a'; for (let i = 0; i < 6; i++) { x.fillRect((1 + i) * k, (9 + i * 0.8 | 0) * k, k, k); x.fillRect((6 - i) * k, (9 + i * 0.8 | 0) * k, k, k); } }
      this.cache.set(key, c);
    }
    Hud.ctx.drawImage(c, X, Y);
    return 8 * k;
  },

  // ---- pieces -----------------------------------------------------------------------------
  // a glass chip: a picture and a short value (e.g. the star and 27/45); returns its width (device px)
  chipD(X, Y, icon, text, col = '#ffffff', align = 'left', iconCol = null) {
    const m = this.m, iw = icon ? 10 * m : 0, W = iw + Font.width(text) * m + 10 * m, H = 13 * m;
    const x0 = align === 'right' ? X - W : align === 'center' ? Math.round(X - W / 2) : X;
    this.glassD(x0, Y, W, H, 0.72);
    if (icon) this.iconD(icon, x0 + 5 * m, Y + 3 * m, iconCol || col);
    this.textD(text, x0 + 5 * m + iw, Y + 3 * m, col);
    return W;
  },
  chipW(icon, text) { return (icon ? 10 : 0) * this.m + Font.width(text) * this.m + 10 * this.m; },
  keycapD(label, X, Y) { return Hud.keycap(X, Y, label, this.m); },
  keyW(label) { return Hud.keyW(label, this.m); },
  // a Btn as a plate: metal; the one main action hazard yellow; the current choice brass
  button(b, focused, pressed, iconW = 0) {
    const m = this.m, [X, Y0, W, H] = this.box(b.x, b.y, b.w, b.h), Y = Y0 + (pressed ? m : 0);
    const en = b.enabled !== false;
    const kind = !en ? 'off' : b.primary ? 'hazard' : b.selected ? 'brass' : b.kind || 'metal';
    this.plateD(X, Y, W, H, kind, { ring: focused && en ? (kind === 'hazard' ? '#ffffff' : '#ffd23a') : null, pressed, rivets: b.rivets });
    const col = !en ? '#6a6d75' : kind === 'hazard' ? INK : kind === 'brass' ? '#ffe7a0' : '#eef1f4';
    const sh = kind === 'hazard' ? 'rgba(255,255,255,0.45)' : 'rgba(8,8,12,0.75)';
    const s = b.scale || 1;
    if (b.icon && !b.label) {
      const IX = Math.round(X + W / 2 - 3.5 * m), IY = Math.round(Y + (H - 8 * m) / 2);
      this.iconD(b.icon, IX, IY + m, sh); this.iconD(b.icon, IX, IY, b.off ? '#80848c' : col);
      if (b.off) for (let k = 0; k < 7; k++) Hud.R(IX + k * m, IY + (6 - k) * m, m, m, '#ff5a3a');
      this.badge(b, X, Y, W);
      return { x: b.x, y: b.y };
    }
    // a long word (other languages run longer) first loses the picture, then gets smaller
    // (on a hazard plate it stays between the stripes)
    const room = W - 8 * m - this.X(iconW) - (kind === 'hazard' ? 2 * this.stripeW(W) : 0);
    let k = s * m, iw = b.icon ? 7 * s * m + 3 * m : 0;
    if (iw && Font.width(b.label) * k + iw > room) iw = 0;
    while (k > 1 && Font.width(b.label) * k + iw > room) k = Math.max(1, k - Font.step());
    const lh = 7 * k, sub = b.sub ? 9 * m : 0, LW = Font.width(b.label) * k + iw;
    const TY = Math.round(Y + (H - m - lh - sub) / 2);
    const LX = Math.round(X + W / 2 + this.X(iconW) / 2 - LW / 2);
    if (iw) { this.iconD(b.icon, LX, TY + s * m, sh, s); this.iconD(b.icon, LX, TY, col, s); }
    Font.draw(Hud.ctx, b.label, LX + iw, TY + k, sh, k); Font.draw(Hud.ctx, b.label, LX + iw, TY, col, k);
    if (b.sub) this.stampD(b.sub, Math.round(X + W / 2), TY + lh + 2 * m, kind === 'hazard' ? '#5a4410' : '#b8bcc6', 1, 'center', sh);
    this.badge(b, X, Y, W);
    return { x: b.x, y: b.y };
  },
  // a blinking light in the corner: something waits behind this button
  badge(b, X, Y, W) {
    if (!b.badge) return;
    const m = this.m, on = ((performance.now() / 400) | 0) % 2;
    Hud.R(X + W - 4 * m, Y - 3 * m, 6 * m, 6 * m, INK);
    Hud.R(X + W - 3 * m, Y - 2 * m, 4 * m, 4 * m, on ? '#ffd23a' : '#ff5a3a');
  },
  // a film clapperboard (11x10): the button plays a video ad
  film(x, y, col, dark) {
    const m = this.m, X = this.X(x), Y = this.X(y), R = (a, b, w, h, c) => Hud.R(X + a * m, Y + b * m, w * m, h * m, c);
    R(-1, -1, 13, 12, INK); R(0, 0, 11, 3, col); R(0, 4, 11, 6, col);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) R(1 + i * 4 + r, r, 1, 1, dark);
    R(2, 6, 7, 1, dark); R(2, 8, 4, 1, dark);
  },
  // a thin progress bar in a slot
  barD(X, Y, W, H, k, col) {
    const m = this.m;
    Hud.R(X - m, Y - m, W + 2 * m, H + 2 * m, INK); Hud.R(X, Y, W, H, '#2c3036');
    Hud.R(X, Y, Math.round(W * clamp(k, 0, 1)), H, col); Hud.R(X, Y, Math.round(W * clamp(k, 0, 1)), m, 'rgba(255,255,255,0.35)');
  },
  // a page's title bar: glass across the top, the title stamped in gold (the BACK button sits on it)
  header(title, sub) {
    const m = this.m, W = Hud.canvas.width, H = this.X(26);
    this.bandD(0, H, 0.8);
    this.stampD(title, Math.round(W / 2), Math.round((H - 14 * m - (sub ? 0 : 0)) / 2), '#ffd23a', 2, 'center');
    return H;
  },
};
