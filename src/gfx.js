'use strict';
// ============================================================================
//  Graphics: canvas / pixel-perfect scaling, bitmap font, sprite helpers
// ============================================================================

const Gfx = {
  canvas: null, ctx: null, W: 480, H: 270, scale: 1,
  TARGET_H: 270,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const wrap = this.canvas.parentElement;
    let cw = (wrap && wrap.clientWidth) || window.innerWidth, ch = (wrap && wrap.clientHeight) || window.innerHeight;
    if (this.forceSize) { cw = this.forceSize.w; ch = this.forceSize.h; }
    if (cw < 16 || ch < 16) {
      // hidden / zero-sized frame: keep the previous resolution
      if (this.sized) return;
      cw = 960; ch = 540;
    }
    this.sized = true;
    const devW = Math.max(1, Math.floor(cw * dpr)), devH = Math.max(1, Math.floor(ch * dpr));
    // pick the integer scale whose resulting view height is closest to TARGET_H;
    // on phones a taller view means smaller sprites on a small screen, so zooming in wins ties
    const touch = typeof Input !== 'undefined' && Input.isTouchDevice;
    let best = 1, bestErr = 1e9;
    for (let s = 1; s <= 16; s++) {
      const h = devH / s;
      if (h < 190 && s > 1) break;
      const err = touch && h > this.TARGET_H ? (h - this.TARGET_H) * 1.5 : Math.abs(h - this.TARGET_H);
      if (err < bestErr) { bestErr = err; best = s; }
    }
    // no integer scale lands near the target (a 640x360 frame at dpr 1 gets 360 rows or 180):
    // stretch by a fractional scale instead - slightly uneven pixels beat a tiny or cramped view
    if (bestErr > 60 && devH / 250 >= 1.25) best = devH / 250;
    let H = Math.ceil(devH / best - 1e-9);
    let W = Math.ceil(devW / best);
    const maxW = Math.floor(H * 2.4);
    if (W > maxW) W = maxW;
    if (W < Math.ceil(H * 1.25)) {
      // narrow / portrait window (phones get the "rotate" screen instead): fit the width
      // and letterbox top and bottom, so menus and the HUD always get at least a 5:4 view
      let bw = 1, bwErr = 1e9;
      for (let s = 1; s <= 16; s++) {
        const w = devW / s;
        if (w < 300 && s > 1) break;
        const err = Math.abs(w - 400);
        if (err < bwErr) { bwErr = err; bw = s; }
      }
      best = bw;
      W = Math.floor(devW / best);
      H = Math.min(Math.ceil(devH / best), Math.floor(W / 1.25));
    }
    this.scale = best;
    this.W = W; this.H = H;
    this.canvas.width = W; this.canvas.height = H;
    const cssW = W * best / dpr, cssH = H * best / dpr;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.style.left = Math.round((cw - cssW) / 2) + 'px';
    this.canvas.style.top = Math.round((ch - cssH) / 2) + 'px';
    this.ctx.imageSmoothingEnabled = false;
    const rot = document.getElementById('rotate');
    if (rot) rot.style.display = (Input.isTouchDevice && ch > cw * 1.05) ? 'flex' : 'none';
    if (typeof Hud !== 'undefined') Hud.resize(); // the HUD layer follows the game canvas
  },
};

// readback: a canvas whose pixels get read back (the outline pass) is kept in memory, where reading
// is cheap - reading a GPU canvas stalls every time (building a sprite took ~2 ms of that alone)
function makeCanvas(w, h, readback) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const x = c.getContext('2d', readback ? { willReadFrequently: true } : undefined);
  x.imageSmoothingEnabled = false;
  return c;
}

function flipCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}

// Adds a 1px outline around all opaque pixels (4-neighbourhood). One pass over the pixels (1.32:
// the same picture as the old pixel-by-pixel fills, in a fraction of the time)
function outlineCanvas(src, color = '#15131c') {
  const w = src.width, h = src.height;
  const s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = makeCanvas(w, h), x = c.getContext('2d'), out = x.createImageData(w, h), o = out.data;
  const n = parseInt(color.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const op = (i, j) => i >= 0 && j >= 0 && i < w && j < h && s[(j * w + i) * 4 + 3] > 20;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4, a = s[k + 3];
    if (a < 255 && !op(i, j) && (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1))) {
      const f = a / 255; // the outline, with any faint pixel that was there drawn over it
      o[k] = Math.round(s[k] * f + r * (1 - f)); o[k + 1] = Math.round(s[k + 1] * f + g * (1 - f)); o[k + 2] = Math.round(s[k + 2] * f + b * (1 - f)); o[k + 3] = 255;
    } else { o[k] = s[k]; o[k + 1] = s[k + 1]; o[k + 2] = s[k + 2]; o[k + 3] = a; }
  }
  x.putImageData(out, 0, 0);
  return c;
}

// Solid-colour silhouette (used for hit flashes and locked heroes).
function silhouette(src, color = '#ffffff') {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

function shadeHex(hex, f) {
  // f < 1 darkens, f > 1 lightens
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; }
  else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  const h = (v) => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2);
  return '#' + h(r) + h(g) + h(b);
}

function mixHex(a, b, t) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2);
  const r = lerp((na >> 16) & 255, (nb >> 16) & 255, t);
  const g = lerp((na >> 8) & 255, (nb >> 8) & 255, t);
  const bl = lerp(na & 255, nb & 255, t);
  return '#' + h(r) + h(g) + h(bl);
}

// ----------------------------------------------------------------------------
//  The letters. On the HUD layer - the menus, the HUD and the few words said in the
//  world - text is set in a real typeface at the screen's own resolution (1.33), its
//  capitals as tall as 7 font units, like the bitmap's. The 5x7 bitmap draws what goes
//  on the game canvas (keys on the signs, the marks over heads) and everything until
//  the typeface has loaded. Widths and positions are in font units times the scale.
// ----------------------------------------------------------------------------
const Font = (() => {
  const G = {
    'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30], 'C': [14, 17, 16, 16, 16, 17, 14],
    'D': [30, 17, 17, 17, 17, 17, 30], 'E': [31, 16, 16, 30, 16, 16, 31], 'F': [31, 16, 16, 30, 16, 16, 16],
    'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17], 'I': [14, 4, 4, 4, 4, 4, 14],
    'J': [7, 2, 2, 2, 2, 18, 12], 'K': [17, 18, 20, 24, 20, 18, 17], 'L': [16, 16, 16, 16, 16, 16, 31],
    'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 17, 25, 21, 19, 17, 17], 'O': [14, 17, 17, 17, 17, 17, 14],
    'P': [30, 17, 17, 30, 16, 16, 16], 'Q': [14, 17, 17, 17, 21, 18, 13], 'R': [30, 17, 17, 30, 20, 18, 17],
    'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4], 'U': [17, 17, 17, 17, 17, 17, 14],
    'V': [17, 17, 17, 17, 17, 10, 4], 'W': [17, 17, 17, 21, 21, 21, 10], 'X': [17, 17, 10, 4, 10, 17, 17],
    'Y': [17, 17, 17, 10, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
    '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31],
    '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
    '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14],
    '9': [14, 17, 17, 15, 1, 2, 12],
    '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
    '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0], ';': [0, 12, 12, 0, 12, 4, 8],
    '-': [0, 0, 0, 14, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [0, 1, 2, 4, 8, 16, 0],
    "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 10, 0, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2],
    ')': [8, 4, 2, 2, 2, 4, 8], '%': [24, 25, 2, 4, 8, 19, 3], '*': [0, 4, 21, 14, 21, 4, 0],
    '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0],
    '#': [10, 10, 31, 10, 31, 10, 10], '&': [12, 18, 20, 8, 21, 18, 13], '_': [0, 0, 0, 0, 0, 0, 31],
    '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14], '|': [4, 4, 4, 4, 4, 4, 4],
    '←': [0, 4, 8, 31, 8, 4, 0], '→': [0, 4, 2, 31, 2, 4, 0],
    '↑': [4, 14, 21, 4, 4, 4, 0], '↓': [0, 4, 4, 4, 21, 14, 4],
    '★': [4, 4, 31, 14, 14, 27, 17], '♥': [0, 10, 31, 31, 14, 4, 0],
    '×': [0, 0, 17, 10, 4, 10, 17], '•': [0, 0, 14, 14, 14, 0, 0],
    // UI icons: play, back, check, music note, gear (options), speaker (sound effects)
    '▶': [16, 24, 28, 30, 28, 24, 16], '◀': [1, 3, 7, 15, 7, 3, 1], '✓': [0, 0, 1, 2, 20, 8, 0],
    '♪': [6, 5, 4, 4, 28, 28, 0], '⚙': [10, 31, 27, 17, 27, 31, 10], '¤': [4, 12, 29, 29, 29, 12, 4],
    '$': [4, 15, 20, 14, 5, 30, 4], // cash (the currency)
  };
  // accented capitals for the translations (src/lang.js): a letter and a mark over it (rows -2
  // and -1) or under it (rows 7 and 8). Every glyph lives in an 11-row cell, so the letters
  // themselves stay where they always were
  const MARKS = {
    acute: [[-2, 2], [-1, 4]], grave: [[-2, 8], [-1, 4]], circ: [[-2, 4], [-1, 10]], uml: [[-2, 10]],
    tilde: [[-2, 13], [-1, 18]], dot: [[-2, 4]], ogonek: [[7, 2], [8, 3]], cedil: [[7, 4], [8, 12]], breve: [[-2, 17], [-1, 14]],
  };
  const ACCENTED = {
    'À': 'A grave', 'Á': 'A acute', 'Â': 'A circ', 'Ã': 'A tilde', 'Ä': 'A uml', 'Ą': 'A ogonek',
    'Ć': 'C acute', 'Ç': 'C cedil', 'È': 'E grave', 'É': 'E acute', 'Ê': 'E circ', 'Ë': 'E uml', 'Ę': 'E ogonek',
    'Ì': 'I grave', 'Í': 'I acute', 'Î': 'I circ', 'Ï': 'I uml', 'Ń': 'N acute', 'Ñ': 'N tilde',
    'Ò': 'O grave', 'Ó': 'O acute', 'Ô': 'O circ', 'Õ': 'O tilde', 'Ö': 'O uml', 'Ś': 'S acute',
    'Ù': 'U grave', 'Ú': 'U acute', 'Û': 'U circ', 'Ü': 'U uml', 'Ÿ': 'Y uml', 'Ź': 'Z acute', 'Ż': 'Z dot',
    'Ğ': 'G breve', 'İ': 'I dot', 'Ş': 'S cedil', // Turkish (1.34)
  };
  const TALL = {};
  for (const c in G) TALL[c] = [0, 0, ...G[c], 0, 0];
  for (const c in ACCENTED) {
    const [base, mark] = ACCENTED[c].split(' '), rows = [0, 0, ...G[base], 0, 0];
    for (const [r, bits] of MARKS[mark]) rows[r + 2] |= bits;
    TALL[c] = rows;
  }
  TALL['Ł'] = [0, 0, 16, 16, 20, 24, 16, 16, 31, 0, 0];
  TALL['¡'] = [0, 0, 4, 0, 4, 4, 4, 4, 4, 0, 0];
  TALL['¿'] = [0, 0, 4, 0, 4, 8, 16, 17, 14, 0, 0];
  const chars = Object.keys(TALL);
  const index = {};
  chars.forEach((c, i) => { index[c] = i; });
  const CW = 6, CH = 8, ROWS = 11; // cell incl. spacing; ROWS: the glyph cell with room for the marks
  const atlases = new Map();

  function atlas(color) {
    let a = atlases.get(color);
    if (a) return a;
    a = makeCanvas(chars.length * CW, ROWS);
    const x = a.getContext('2d');
    x.fillStyle = color;
    chars.forEach((c, i) => {
      const rows = TALL[c];
      for (let r = 0; r < ROWS; r++) for (let b = 0; b < 5; b++) if (rows[r] & (16 >> b)) x.fillRect(i * CW + b, r, 1, 1);
    });
    atlases.set(color, a);
    return a;
  }

  // what gets drawn: upper case, in the player's language (src/lang.js)
  function norm(text) {
    const t = String(text).toUpperCase();
    return t.length > 1 && typeof L10N !== 'undefined' && L10N.lang !== 'en' ? L10N.tr(t) : t;
  }
  // a soft hyphen (\u00AD) marks where a long word may break (src/lang_*.js): it takes no room
  const SHY = /\u00AD/g;
  function bitW(t, scale) {
    const n = t.indexOf('\u00AD') < 0 ? t.length : t.replace(SHY, '').length;
    return n ? (n * CW - 1) * scale : 0;
  }

  // ---- the typeface: Russo One (SIL Open Font License, src/fonts/OFL.txt). Its files, with the
  // characters each one holds - the build writes them into the bundle (tools/build.mjs)
  const FILES = [
    ['src/fonts/russo-one-latin.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
    ['src/fonts/russo-one-latin-ext.woff2', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  ];
  const face = { family: '', weight: 400, px: 10, ready: false }; // px: font size for 1 unit
  const unitW = new Map(); // text -> width in units
  let meter = null;
  // the canvases that get the typeface: the HUD layer (and anything drawn for it)
  const hiRes = (ctx) => face.ready && ctx && ctx.canvas && ctx.canvas.hiRes;
  // at boot: the files in, then the typeface on (the bitmap draws until then, or if it fails)
  function load() {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
    try {
      for (const [url, unicodeRange] of FILES) document.fonts.add(new FontFace('Russo One', 'url(' + url + ')', { unicodeRange, display: 'block' }));
    } catch (e) { return Promise.resolve(false); }
    return setFace('Russo One', 400);
  }
  function setFace(family, weight = 400) {
    face.family = family; face.weight = weight; face.ready = false;
    if (!family || typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
    const probe = weight + ' 70px "' + family + '"';
    return document.fonts.load(probe, 'HĄŁ').then((got) => {
      if (!got.length || face.family !== family) return false;
      meter = meter || makeCanvas(8, 8).getContext('2d');
      meter.font = probe;
      const cap = meter.measureText('H').actualBoundingBoxAscent || 49;
      face.px = 70 * 7 / cap; // font size per unit of scale: capitals 7 units tall
      unitW.clear(); outlineCache.clear(); face.ready = true;
      return true;
    }, () => false);
  }
  function fontAt(scale) { return face.weight + ' ' + (face.px * scale).toFixed(2) + 'px "' + face.family + '"'; }
  // the pictures among the letters (arrows, hearts, the play mark...) stay the bitmap's: the
  // typeface hasn't got them all, and a fallback font would draw them in its own style
  const PIC = /[←→↑↓★♥•▶◀✓♪⚙¤]/, PIC_W = 7; // 5 units wide, a unit of room each side
  function parts(t) {
    const out = [];
    let cur = '';
    for (const ch of t) {
      if (!PIC.test(ch)) { cur += ch; continue; }
      if (cur) out.push([cur, false]);
      out.push([ch, true]); cur = '';
    }
    if (cur) out.push([cur, false]);
    return out;
  }
  function vecW(t) {
    let w = unitW.get(t);
    if (w === undefined) {
      meter.font = fontAt(8);
      w = 0;
      for (const [s, pic] of parts(t.replace(SHY, ''))) w += pic ? PIC_W : meter.measureText(s).width / 8;
      if (unitW.size > 2000) unitW.clear();
      unitW.set(t, w);
    }
    return w;
  }
  // the letters from x, on the baseline: the rims first (a unit wide), then the faces
  function paint(ctx, t, x, base, color, s, outline) {
    ctx.font = fontAt(s); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    const ps = parts(t);
    for (const pass of outline ? [outline, color] : [color]) {
      let px = x;
      for (const [str, pic] of ps) {
        if (pic) {
          const a = atlas(pass), gi = index[str], gx = Math.round(px + s), gy = Math.round(base - 9 * s);
          const offs = pass === outline && pass !== color ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, 0]];
          for (const [ox, oy] of offs) ctx.drawImage(a, gi * CW, 0, 5, ROWS, gx + ox * s, gy + oy * s, 5 * s, ROWS * s);
          px += PIC_W * s;
          continue;
        }
        if (pass === outline && pass !== color) { ctx.strokeStyle = outline; ctx.lineWidth = 2 * s; ctx.strokeText(str, px, base); }
        else { ctx.fillStyle = color; ctx.fillText(str, px, base); }
        px += vecW(str) * s;
      }
    }
  }
  // the width the layout works with: the typeface's once it's in
  function widthT(t, scale) { return face.ready ? Math.ceil(vecW(t) * scale) : bitW(t, scale); }
  function width(text, scale = 1) { return widthT(norm(text), scale); }
  // the bitmap's width, for what's drawn on the game canvas
  function pxWidth(text, scale = 1) { return bitW(norm(text), scale); }

  function drawT(ctx, t, x, y, color, scale, align) {
    if (t.indexOf('\u00AD') >= 0) t = t.replace(SHY, '');
    if (hiRes(ctx)) {
      const w = widthT(t, scale);
      if (align === 'center') x -= Math.floor(w / 2);
      else if (align === 'right') x -= w;
      paint(ctx, t, Math.round(x), Math.round(y + 7 * scale), color, scale);
      return w;
    }
    const a = atlas(color);
    const w = bitW(t, scale);
    if (align === 'center') x -= Math.floor(w / 2);
    else if (align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < t.length; i++) {
      const gi = index[t[i]];
      if (gi !== undefined) ctx.drawImage(a, gi * CW, 0, 5, ROWS, x + i * CW * scale, y - 2 * scale, 5 * scale, ROWS * scale);
    }
    return w;
  }
  function draw(ctx, text, x, y, color = '#ffffff', scale = 1, align = 'left') { return drawT(ctx, norm(text), x, y, color, scale, align); }

  // Text with a hard 1px (scaled) outline/shadow - readable on any background.
  // Rendered once into a cached canvas (HUD strings repeat every frame).
  const outlineCache = new Map();
  function drawOutlined(ctx, text, x, y, color = '#ffffff', scale = 1, align = 'left', outline = '#15131c', shadow = true) {
    const s = scale;
    const t = norm(text);
    if (hiRes(ctx)) return drawOutlinedV(ctx, t, x, y, color, s, align, outline);
    const w = bitW(t, s);
    const key = t + '\u0001' + color + '\u0001' + s + '\u0001' + outline + (shadow ? 1 : 0);
    let c = outlineCache.get(key);
    if (!c) {
      c = makeCanvas(w + s * 3, 15 * s);
      const cx = c.getContext('2d');
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        drawT(cx, t, s + ox * s, 3 * s + oy * s, outline, s, 'left');
      }
      if (shadow) drawT(cx, t, s + s, 3 * s + 2 * s, outline, s, 'left');
      drawT(cx, t, s, 3 * s, color, s, 'left');
      if (outlineCache.size > 500) outlineCache.clear();
      outlineCache.set(key, c);
    }
    let dx = x;
    if (align === 'center') dx -= Math.floor(w / 2);
    else if (align === 'right') dx -= w;
    ctx.drawImage(c, Math.round(dx) - s, Math.round(y) - 3 * s);
    return w;
  }
  // the typeface with a dark rim a unit wide, rendered once into a cached canvas
  function drawOutlinedV(ctx, t, x, y, color, s, align, outline) {
    const w = widthT(t, s), key = 'v' + t + '\u0001' + color + '\u0001' + s + '\u0001' + outline;
    const pad = Math.ceil(s * 1.5) + 1, top = Math.ceil(3.5 * s) + pad;
    let c = outlineCache.get(key);
    if (!c) {
      c = makeCanvas(w + 2 * pad, top + Math.ceil(10 * s) + pad);
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      paint(cx, t, pad, top + 7 * s, color, s, outline);
      if (outlineCache.size > 500) outlineCache.clear();
      outlineCache.set(key, c);
    }
    let dx = x;
    if (align === 'center') dx -= Math.floor(w / 2);
    else if (align === 'right') dx -= w;
    ctx.drawImage(c, Math.round(dx) - pad, Math.round(y) - top);
    return w;
  }

  // Word-wrap helper, returns array of lines that fit in maxW pixels at scale. A word longer than
  // the line (German, mostly) breaks with a hyphen: at a soft hyphen or a hyphen if one fits, else
  // between two letters
  function wrap(text, maxW, scale = 1) {
    const words = norm(text).split(' ');
    const lines = [];
    const fits = (s) => widthT(s, scale) <= maxW;
    let cur = '';
    for (let w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (fits(test) || !cur && fits(w)) { cur = test; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      while (!fits(w)) {
        let cut = -1;
        for (let i = 1; i < w.length - 1; i++) {
          if (w[i] === '\u00AD' && fits(w.slice(0, i) + '-')) cut = i;
          else if (w[i] === '-' && fits(w.slice(0, i + 1))) cut = i;
        }
        if (cut > 0) { lines.push(w[cut] === '-' ? w.slice(0, cut + 1) : w.slice(0, cut) + '-'); w = w.slice(cut + 1); continue; }
        lines.cut = true; // split between two letters (UI.wrapK tries finer letters instead)
        let n = w.length - 1;
        while (n > 1 && !fits(w.slice(0, n) + '-')) n--;
        if (n <= 1) break;
        lines.push(w.slice(0, n) + '-'); w = w.slice(n);
      }
      cur = w;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  // a new language: the cached outlined texts go
  function clear() { outlineCache.clear(); }

  // how finely text can shrink to fit: the typeface takes any size, the bitmap whole pixels
  function step() { return face.ready ? 0.25 : 1; }

  return { draw, drawOutlined, width, pxWidth, wrap, clear, load, setFace, face, step, CH: 7 };
})();
