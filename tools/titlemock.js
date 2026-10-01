// Dev-only title screen mockups (design review, never shipped). Three directions drawn with the
// game's own sprites, effects and menu kit, plus a shared new logo:
//   await TITLEMOCK.all()      -> %TEMP%/blast_shots/title_*.png
/* eslint-disable no-undef */
window.TITLEMOCK = {
  // ---- the logo: "BLAST" in chunky 2-px-stroke letters, extruded, over a ribbon with BATTALION
  GLYPHS: {
    B: ['######.', '#######', '##...##', '##...##', '######.', '#######', '##...##', '##...##', '#######', '######.'],
    L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
    A: ['.#####.', '#######', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##', '##...##'],
    S: ['.######', '#######', '##.....', '##.....', '######.', '.######', '.....##', '.....##', '#######', '######.'],
    T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  },
  // face colours by glyph row (10 rows): pale top, gold, orange, red at the foot
  FACE: ['#fff4b8', '#ffe066', '#ffd23a', '#ffc232', '#ffae2a', '#ff9a24', '#ff861e', '#ff6c1a', '#f05418', '#d8401a'],
  cache: {},

  // a pixel buffer helper: w x h of 0/1
  mask(w, h) { return { w, h, d: new Uint8Array(w * h) }; },
  at(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h && m.d[y * m.w + x]; },

  // BLAST at k game px per glyph px: returns a canvas (game px) and where the letters sit in it
  word(text, k, shear = 0) {
    const G = this.GLYPHS, gap = 1;
    const gw = [...text].reduce((a, c) => a + G[c][0].length, 0) + gap * (text.length - 1);
    const ext = Math.max(3, Math.round(k * 1.6)), o = k >= 3 ? 2 : 1, pad = o + 1;
    const lean = Math.round(10 * k * shear);
    const W = gw * k + ext + 2 * pad + 2 + lean, H = 10 * k + ext + 2 * pad + 2;
    const face = this.mask(W, H), row = new Int8Array(W * H).fill(-1);
    let gx = 0;
    for (const c of text) {
      const g = G[c];
      for (let r = 0; r < 10; r++) for (let q = 0; q < g[r].length; q++) {
        if (g[r][q] !== '#') continue;
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
          const Y = pad + r * k + yy, X = pad + (gx + q) * k + xx + Math.round((10 * k - 1 - (r * k + yy)) * shear);
          face.d[Y * W + X] = 1; row[Y * W + X] = r;
        }
      }
      gx += g[0].length + gap;
    }
    // extrusion down and a little to the right
    const ex = this.mask(W, H);
    for (let s = 1; s <= ext; s++) {
      const dx = Math.round(s * 0.5);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (face.d[y * W + x]) {
        const X = x + dx, Y = y + s;
        if (X < W && Y < H && !face.d[Y * W + X]) ex.d[Y * W + X] = s;
      }
    }
    // ink outline around face + extrusion
    const body = (x, y) => this.at(face, x, y) || this.at(ex, x, y);
    const ol = this.mask(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (body(x, y)) continue;
      let hit = false;
      for (let j = -o; j <= o && !hit; j++) for (let i = -o; i <= o && !hit; i++) if (Math.abs(i) + Math.abs(j) <= o + (o > 1 ? 1 : 0) && body(x + i, y + j)) hit = true;
      if (hit) ol.d[y * W + x] = 1;
    }
    const c = makeCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), P = img.data;
    const put = (i, hex, a = 255) => { const n = parseInt(hex.slice(1), 16); P[i * 4] = n >> 16; P[i * 4 + 1] = (n >> 8) & 255; P[i * 4 + 2] = n & 255; P[i * 4 + 3] = a; };
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
      const i = y * W + X;
      if (face.d[i]) {
        let col = this.FACE[row[i]];
        const top = !this.at(face, X, y - 1), left = !this.at(face, X - 1, y);
        if (top) col = '#fffbe6'; else if (left && row[i] < 6) col = mixHex(col, '#ffffff', 0.45);
        const bottom = !this.at(face, X, y + 1), right = !this.at(face, X + 1, y);
        if ((bottom || right) && !top) col = mixHex(col, '#b02a10', 0.35);
        put(i, col);
      } else if (ex.d[i]) {
        const s = ex.d[i] / ext;
        put(i, mixHex('#b8341a', '#5a1208', s));
      } else if (ol.d[i]) put(i, INK);
    }
    x.putImageData(img, 0, 0);
    return { c, W, H, pad };
  },

  // the whole lockup at k (BLAST glyph px) - BATTALION on an olive ribbon under it
  logo(k, o = {}) {
    const key = k + JSON.stringify(o);
    if (this.cache[key]) return this.cache[key];
    const w = this.word('BLAST', k, o.shear || 0);
    const s2 = o.s2 || Math.max(1, Math.round(k * 0.62));
    // BATTALION a little bolder than the plain font (each letter drawn twice, 1 px apart)
    const tw = Font.width('BATTALION') * s2 + 1, rh = 7 * s2 + 2 * s2 + 5;
    const rw = Math.max(tw + 12 * s2 + 10, Math.round((w.W - 2 * w.pad) * 0.94));
    const tail = 6 + s2 * 3, drop = 3 + s2;
    const W = Math.max(w.W, rw + 2 * tail + 4), top = w.H - w.pad - Math.round(k * 0.9);
    const H = top + rh + drop + 3;
    const c = makeCanvas(W, H), x = c.getContext('2d');
    const R = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(ww), Math.round(hh)); };
    const rx = Math.round(W / 2 - rw / 2), ry = top;
    // the tails: behind the band, lower, with a V cut at the outer end, and the fold that joins them
    for (const side of [-1, 1]) {
      const tx0 = side < 0 ? rx - tail : rx + rw, ty = ry + drop;
      const notch = Math.round(rh / 2);
      for (let yy = -1; yy <= rh; yy++) {
        const v = Math.abs(yy - (rh - 1) / 2), cut = Math.max(0, Math.round(notch - v)) ; // V: deepest in the middle
        const a = side < 0 ? tx0 + cut : tx0, b = side < 0 ? tx0 + tail : tx0 + tail - cut;
        R(a - 1, ty + yy, b - a + 2, 1, INK);
      }
      for (let yy = 0; yy < rh; yy++) {
        const v = Math.abs(yy - (rh - 1) / 2), cut = Math.max(0, Math.round(notch - v)) + 1;
        const a = side < 0 ? tx0 + cut : tx0, b = side < 0 ? tx0 + tail : tx0 + tail - cut;
        if (b > a) R(a, ty + yy, b - a, 1, yy === 0 ? '#4a5a2a' : '#2e3a18');
      }
      // the fold: a dark triangle under the band's end
      for (let i = 0; i < drop; i++) R(side < 0 ? rx - i - 1 : rx + rw, ry + rh + i - drop + 1, i + 1, 1, '#161b0a');
    }
    R(rx - 1, ry - 1, rw + 2, rh + 2, INK);
    R(rx, ry, rw, rh, '#4b5a2a'); R(rx, ry, rw, 1, '#8a9a5a'); R(rx, ry + 1, rw, 1, '#5e6e36'); R(rx, ry + rh - 1, rw, 1, '#262e14');
    R(rx, ry + 1, 1, rh - 2, '#6a7a3a'); R(rx + rw - 1, ry + 1, 1, rh - 2, '#2e381a');
    L10N.raw++;
    const txx = Math.round(W / 2 - tw / 2), ty = ry + Math.round((rh - 7 * s2) / 2);
    for (const dx of [0, 1]) Font.draw(x, 'BATTALION', txx + dx, ty + Math.max(1, s2 >> 1), '#1a200c', s2);
    for (const dx of [0, 1]) Font.draw(x, 'BATTALION', txx + dx, ty, '#f4ecd8', s2);
    const st = Math.max(1, s2 - 1), sy = ty + Math.round((7 * s2 - 7 * st) / 2);
    Font.draw(x, '★', rx + 3 + 2 * st, sy, '#ffd23a', st);
    Font.draw(x, '★', rx + rw - 3 - 2 * st - Font.width('★') * st, sy, '#ffd23a', st);
    L10N.raw--;
    // BLAST over the band
    x.drawImage(w.c, Math.round(W / 2 - w.W / 2 + w.pad / 2), 0);
    const out = { c, W, H };
    this.cache[key] = out;
    return out;
  },
  drawLogo(ctx, cx, y, k, o) {
    const L = this.logo(k, o);
    ctx.drawImage(L.c, Math.round(cx - L.W / 2), Math.round(y));
    return L;
  },

  // ---- shared menu pieces (the real menu kit, on the HUD layer)
  // the next campaign mission, as the big button says it
  playBtn(x, y, w, h, o = {}) {
    const next = Math.max(0, campaignNext()), fresh = !Object.keys(Save.data.stars).length;
    return new Btn(Object.assign({ id: 'play', label: fresh ? 'PLAY' : 'CONTINUE', sub: 'MISSION ' + (next + 1) + ' - ' + LEVELS[next].name, icon: '▶', primary: true, x, y, w, h, scale: 2 }, o));
  },
  SECONDARY: [['missions', 'MISSIONS', 'flag'], ['arcade', 'ARCADE', 'swords'], ['daily', 'DAILY', 'calendar'], ['heroes', 'HEROES', 'lives'], ['upgrades', 'UPGRADES', 'chevrons'], ['players', 'CO-OP', 'coop']],
  corner(W) {
    return [
      new Btn({ id: 'sfx', icon: 'sfx', label: '', x: W - 44, y: 4, w: 18, h: 16 }),
      new Btn({ id: 'options', icon: 'gear', label: '', x: W - 23, y: 4, w: 18, h: 16 }),
    ];
  },
  drawMenu(btns, focus) {
    const lit = btns.find((b) => b.id === focus);
    for (const b of btns) if (b !== lit) b.draw(Gfx.ctx, false, false);
    if (lit) lit.draw(Gfx.ctx, true, false);
  },
  shade(ctx, y0, y1, a0, a1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(10,8,16,' + a0 + ')'); g.addColorStop(1, 'rgba(10,8,16,' + a1 + ')');
    ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), Gfx.W, Math.abs(y1 - y0));
  },

  // ---- A: the title screen is the game itself - a mission plays behind the menu (a bot drives
  // the hero), the logo on top, one big button and a slim row under it
  // the frame without the HUD, the tutorial signs, the words and the bubbles
  bare(ctx) {
    const w = world, keep = { props: w.props, coach: w.coach, bubbles: w.bubbles, hud: w.drawHUD, messages: w.messages, radio: w.radio, intel: w.intelCard, tip: w.tip, card: w.card, fx: FX.effects };
    w.props = w.props.filter((o) => !(o instanceof Sign)); w.coach = null; w.bubbles = []; w.messages = []; w.radio = null; w.intelCard = null; w.tip = null; w.card = null;
    FX.effects = FX.effects.filter((e) => e.type !== 'text');
    w.drawHUD = function (c, vw, vh) { this.drawCinema(c, vw, vh); };
    Hud.clear();
    w.draw(ctx);
    Object.assign(w, { props: keep.props, coach: keep.coach, bubbles: keep.bubbles, messages: keep.messages, radio: keep.radio, intelCard: keep.intel, tip: keep.tip, card: keep.card });
    FX.effects = keep.fx;
    w.drawHUD = keep.hud;
  },
  // how much is going on on screen: fire and smoke, bodies in the air, soldiers, a cage, the hero
  // mid-frame. A still skips the flash, blast rings and rays (on a still they read as glass discs)
  excitement() {
    const w = world, c = w.cam, W = Gfx.W, H = Gfx.H, p = w.player;
    const on = (x, y, m = 0) => x > c.x - m && x < c.x + W + m && y > c.y + 50 && y < c.y + H - 60;
    for (const e of FX.effects) if ((e.type === 'flash' || e.type === 'shock' || e.type === 'rays') && e.x > c.x - 80 && e.x < c.x + W + 80) return 0;
    if (w.flashT > 0 || w.cine || w.slowT > 0) return 0;
    let s = Math.min(FX.count, 600) * 0.08;
    for (const e of w.enemies) if (!e.dead && on(e.cx, e.cy, -20)) s += 7;
    for (const k of w.corpses) if (on(k.x, k.y) && Math.abs(k.vy || 0) > 20) s += 14;
    for (const o of w.props) if (o.isCage && on(o.x, o.y, -30)) s += 25;
    for (const q of w.projectiles) if (q.team === 'p' && on(q.x, q.y)) s += 1.5;
    if (!p || p.dead) return 0;
    const px = p.cx - c.x, py = p.cy - c.y;
    if (px < W * 0.25 || px > W * 0.75 || py < 80 || py > H - 70) s *= 0.4;
    if (p.firing || p.fireCd > 0) s *= 1.15;
    return s;
  },
  // several missions, the best frame of each (saved as title_Aprobe_<n>.png)
  async probeA(levels, steps = 1500) {
    const out = [];
    for (const lv of levels) {
      const r = await this.setupA(lv, steps);
      (this.snaps = this.snaps || {})[lv] = this.snapA;
      Hud.clear(); Gfx.ctx.drawImage(this.snapA, 0, 0);
      r.file = await this.save('title_Aprobe_' + lv);
      out.push(r);
    }
    return out;
  },
  // a seeded Math.random for the length of fn (a run can be repeated to get the same frame)
  async seeded(seed, fn) {
    const orig = Math.random, ctx = Sound.ctx;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Sound.ctx = null;
    try { return await fn(); } finally { Math.random = orig; Sound.ctx = ctx; }
  },
  async setupA(level = 2, steps = 1500, hero = 'havoc') {
    Save.data.favorite = hero;
    for (let i = 0; i < 120 && App.pending; i++) TT.step(1);
    App.go(PlayScene, level);
    for (let i = 0; i < 120 && (App.pending || App.scene !== PlayScene); i++) TT.step(1);
    for (let i = 0; i < 400 && !(world.state === 'play' && world.player && world.player.onGround); i++) TT.step(1);
    Bot.reset();
    const snap = makeCanvas(Gfx.W, Gfx.H), sx = snap.getContext('2d');
    let best = -1, at = -1;
    for (let i = 0; i < steps; i++) {
      Bot.step(i, { god: true, special: true });
      if (App.scene !== PlayScene || PlayScene.overlay) break;
      if (i > 90 && i % 4 === 0) {
        const s = this.excitement();
        if (s > best) { best = s; at = i; this.bare(Gfx.ctx); sx.drawImage(Gfx.canvas, 0, 0); }
      }
      if (i % 300 === 299) await new Promise((r) => setTimeout(r, 0));
    }
    Bot.release();
    Save.data.favorite = null;
    this.snapA = snap;
    return { best: Math.round(best), at, level };
  },
  drawA(o = {}) {
    const ctx = Gfx.ctx, W = Gfx.W, H = Gfx.H;
    ctx.drawImage(this.snapA, 0, 0);
    // film bars: the top one carries the logo, the bottom one the menu
    this.shade(ctx, 0, 74, 0.8, 0);
    this.shade(ctx, H - 96, H, 0, 0.9);
    const L = this.logo(3, { shear: 0.18 });
    ctx.drawImage(L.c, Math.round(W / 2 - L.W / 2), 6);
    Hud.clear();
    const btns = [this.playBtn(Math.round(W / 2 - 84), H - 64, 168, 32)];
    // the rest: one slim row of dark plates with a picture and a word
    const items = this.SECONDARY.map(([id, label, icon]) => ({ id, label, icon, w: Math.ceil(UI.tw(label)) + 19 }));
    const gap = 4, tot = items.reduce((a, b) => a + b.w, 0) + gap * (items.length - 1);
    let x = Math.round(W / 2 - tot / 2);
    for (const it of items) { btns.push(new Btn({ id: it.id, label: it.label, icon: it.icon, kind: 'dark', rivets: false, x, y: H - 24, w: it.w, h: 17 })); x += it.w + gap; }
    btns.push(...this.corner(W));
    this.drawMenu(btns, o.focus || 'play');
    UI.textD('V' + VERSION, UI.X(4), UI.X(H) - 9 * UI.m, 'rgba(255,255,255,0.35)', 1);
  },

  // ---- B: an 80s action film poster - one hero five times the game's size against a blast, the
  // squad in the smoke behind, the logo and a vertical menu on the right
  // explosions frozen at their peak (like tools/keyart.js): fire, embers, rolling smoke, no rings
  freezeBlasts(booms) {
    FX.reset(null);
    for (const [x, y, r] of booms) {
      FX.explosion(x, y, r, { fire: true });
      for (let i = 0; i < 10 + r * 0.4; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(0.3, 1) * r * 1.6;
        FX.spawn(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 20, rand(0.9, 1.6), rand(r * 0.14, r * 0.24), '#aaa', PF.CIRCLE | PF.DRAG | PF.GROW, 2);
      }
    }
    for (let i = 0; i < 9; i++) FX.update(1 / 60);
    for (const [x, y, r] of booms) FX.explosion(x, y, r * 0.6, { fire: true });
    for (let i = 0; i < 4; i++) FX.update(1 / 60);
    FX.effects.length = 0;
  },
  // a sprite frame at s game px per sprite px; rim: a coloured edge on the side facing the fire
  bigFrame(ctx, f, x, footY, face, s, o = {}) {
    const img = face > 0 ? f.r : f.l, ax = face > 0 ? f.ax : f.w - f.ax;
    const X = Math.round(x - ax * s), Y = Math.round(footY - f.ay * s), W = f.w * s, H = f.h * s;
    if (o.rim) {
      const key = 'rim' + o.rim + (face > 0 ? 'r' : 'l');
      const rim = f[key] || (f[key] = silhouette(img, o.rim));
      for (const [dx, dy] of o.rimDirs || [[-1, 0], [-1, -1], [0, -1]]) ctx.drawImage(rim, X + dx * Math.max(1, s >> 1), Y + dy * Math.max(1, s >> 1), W, H);
    }
    if (o.dark) {
      const key = 'dk' + o.dark + (face > 0 ? 'r' : 'l');
      const dk = f[key] || (f[key] = silhouette(img, o.dark));
      ctx.drawImage(dk, X, Y, W, H);
    } else ctx.drawImage(img, X, Y, W, H);
    return { X, Y, W, H };
  },
  sunburst(ctx, cx, cy, n, t, col) {
    const R = Math.hypot(Gfx.W, Gfx.H);
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a0 = t + (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath(); ctx.fill();
    }
  },
  // a frame darkened toward a colour (the squad stands in the smoke, a step behind the hero)
  dim(f, face, col, a) {
    const key = 'dim' + col + a + (face > 0 ? 'r' : 'l');
    if (f[key]) return f[key];
    const src = face > 0 ? f.r : f.l, c = makeCanvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return (f[key] = c);
  },
  drawB(o = {}) {
    const ctx = Gfx.ctx, W = Gfx.W, H = Gfx.H, t = o.t || 0.4, S = o.scale || 5;
    const hero = o.hero || 'havoc', hx = Math.round(W * 0.3), gy = H - 22;
    // sky: night red at the top to a burning horizon
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#24091a'); g.addColorStop(0.35, '#6a1820'); g.addColorStop(0.62, '#c8461e'); g.addColorStop(0.82, '#ff9a3a'); g.addColorStop(1, '#ffd070');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    this.sunburst(ctx, hx + 10, gy - 70, 18, t * 0.05, 'rgba(255,200,120,0.06)');
    ctx.restore();
    // the jungle as layers of silhouettes, darker to the front
    const par = Sprites.parallax.jungle;
    const layers = [[par.far, 0.6, '#a8402a'], [par.mid, 0.78, '#6a2020'], [par.near, 0.93, '#2a0e14']];
    for (const [img, base, col] of layers) {
      const key = 'tint' + col, tinted = img[key] || (img[key] = silhouette(img, col));
      const top = Math.round(H * base) - img.height;
      for (let x = -60; x < W; x += 512) ctx.drawImage(tinted, x, top);
      ctx.fillStyle = col; ctx.fillRect(0, Math.round(H * base), W, H);
    }
    // the chopper crossing the sky, dark against it
    this.bigFrame(ctx, Sprites.props.heli[1], W * 0.36, H * 0.2, 1, 1, { dark: '#3a1018' });
    // the blast right behind the hero: a smoke column first, then the fireballs at their peak
    FX.reset(null);
    FX.mushroom(hx + 14, gy - 70, 70);
    for (let i = 0; i < 40; i++) FX.update(1 / 60);
    const smoke = FX.count;
    for (const [x, y, r] of [[hx + 14, gy - 70, 58], [hx - 64, gy - 28, 30]]) {
      FX.explosion(x, y, r, { fire: true });
      for (let i = 0; i < 10 + r * 0.4; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(0.3, 1) * r * 1.6;
        FX.spawn(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 20, rand(0.9, 1.6), rand(r * 0.14, r * 0.24), '#aaa', PF.CIRCLE | PF.DRAG | PF.GROW, 2);
      }
    }
    for (let i = 0; i < 9; i++) FX.update(1 / 60);
    FX.explosion(hx + 14, gy - 70, 36, { fire: true });
    for (let i = 0; i < 4; i++) FX.update(1 / 60);
    FX.effects.length = 0;
    FX.drawLights(ctx, 0, 0, W, H); FX.draw(ctx, 0, 0, W, H);
    // enemies thrown by the blast
    for (const [id, x, y, s, rot] of [['grunt', hx + 84, gy - 150, 3, 0.7], ['rpg', hx - 70, gy - 150, 2, -2.3], ['grunt', hx + 20, gy - 196, 2, 2.6]]) {
      const f = Sprites.chars[id].fall, im = this.dim(f, 1, '#3a1010', 0.25);
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot);
      ctx.drawImage(im, Math.round(-f.w * s / 2), Math.round(-f.h * s / 2), f.w * s, f.h * s); ctx.restore();
    }
    // the rock they stand on; its edge catches the fire
    ctx.fillStyle = '#16080c';
    ctx.beginPath(); ctx.moveTo(0, gy - 1);
    for (let x = 0; x <= W * 0.58; x += 8) ctx.lineTo(x, gy - 1 + (((x * 7919) >> 3) % 3));
    ctx.lineTo(W * 0.6, gy + 6); ctx.lineTo(W * 0.62, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a3a'; ctx.fillRect(0, gy - 1, Math.round(W * 0.58), 1);
    // the squad a step behind (dimmed, rim-lit), the hero in front
    const sq = [['ronin', hx - 112, 2, 1, 'slash'], ['buck', hx - 80, 3, 1], ['brutus', hx - 42, 3, 1]];
    for (const [id, x, s, face, pose] of sq) {
      const set = Sprites.chars[id], f = pose === 'slash' ? set.slash[1] : set.idle[0];
      const X = Math.round(x - (face > 0 ? f.ax : f.w - f.ax) * s), Y = Math.round(gy - f.ay * s);
      const rim = f['rim#ff9a3a' + (face > 0 ? 'r' : 'l')] || (f['rim#ff9a3a' + (face > 0 ? 'r' : 'l')] = silhouette(face > 0 ? f.r : f.l, '#ff9a3a'));
      ctx.drawImage(rim, X, Y - s, f.w * s, f.h * s);
      ctx.drawImage(this.dim(f, face, '#2a0c12', 0.45), X, Y, f.w * s, f.h * s);
    }
    const set = Sprites.chars[hero];
    this.bigFrame(ctx, set.idle[0], hx, gy, 1, S, { rim: '#ffc060', rimDirs: [[-1, 0], [0, -1]] });
    // the muzzle flash and the tracers
    const L = set.L, tipX = hx + (L.W - L.cx - 4) * S, my = gy - (L.legH + L.torsoH - 3) * S;
    FX.reset(null);
    FX.light(tipX + 4, my, 34, '#ffc060', 0.9, 1);
    FX.drawLights(ctx, 0, 0, W, H);
    ctx.drawImage(circleSprite('#fff4a0', 7), tipX - 3, my - 7); ctx.drawImage(circleSprite('#ffffff', 4), tipX, my - 4);
    ctx.fillStyle = '#fff4a0';
    for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(tipX + 20 + k * 30), Math.round(my + (k % 2 ? -3 : 2)), 14, 1);
    // embers
    for (let i = 0; i < 46; i++) { const x = (i * 97.3 + t * 13) % (W * 0.66), y = (i * 53.7) % (H - 40); ctx.fillStyle = i % 3 ? '#ffb040' : '#ffe890'; ctx.fillRect(Math.round(x), Math.round(y), 1, i % 4 ? 1 : 2); }
    Atmos.vignette(ctx);
    FX.reset(null);
    // the right: logo, tagline, a menu like a film's DVD menu
    const cx = Math.round(W * 0.765), Lg = this.logo(4, { shear: 0.18 });
    ctx.drawImage(Lg.c, Math.round(cx - Lg.W / 2), 10);
    Hud.clear();
    UI.stampD('RESCUE  •  SWAP  •  DESTROY', UI.X(cx), UI.X(10 + Lg.H + 3), '#ffd23a', 1, 'center');
    const mw = 172, mx = Math.round(cx - mw / 2);
    let y = 10 + Lg.H + 18;
    const btns = [this.playBtn(mx, y, mw, 32)];
    y += 38;
    const rows = [['missions', 'MISSIONS', 'flag'], ['arcade', 'ARCADE', 'swords'], ['daily', 'DAILY', 'calendar'], ['heroes', 'HEROES', 'lives'], ['upgrades', 'UPGRADES', 'chevrons']];
    for (const [id, label, icon] of rows) {
      btns.push(new Btn({ id, label, icon, x: mx, y, w: mw, h: 17, drawFn: (c, bb, focused) => this.listItem(bb, focused) }));
      y += 20;
    }
    btns.push(...this.corner(W));
    this.drawMenu(btns, o.focus || 'play');
  },
  // a menu line: a picture and a word on a strip of dark glass; the chosen one on brass
  listItem(b, focused) {
    const m = UI.m, [X, Y, W, H] = UI.box(b.x, b.y, b.w, b.h);
    if (focused) UI.plateD(X, Y, W, H, 'brass', { ring: '#ffd23a', rivets: false });
    else { Hud.glass(X, Y, W, H, 0.55); }
    const col = focused ? '#ffe7a0' : '#eef1f4', sh = 'rgba(8,8,12,0.75)';
    const IX = X + 7 * m, IY = Y + Math.round((H - 7 * m) / 2) - (focused ? 0 : 0);
    UI.iconD(b.icon, IX, IY + m, sh); UI.iconD(b.icon, IX, IY, focused ? '#ffe7a0' : '#ffd23a');
    Font.draw(Hud.ctx, b.label, IX + 12 * m, IY + m, sh, m); Font.draw(Hud.ctx, b.label, IX + 12 * m, IY, col, m);
    if (focused) Font.draw(Hud.ctx, '▶', X + W - 12 * m, IY, '#ffe7a0', m);
  },

  // ---- C: the base camp at dusk. The menu is the camp: the chopper = PLAY, the map board =
  // MISSIONS, the shooting range = ARCADE, the radio = DAILY, the locker = HEROES, the workbench =
  // UPGRADES; the heroes you've freed hang around. Drawn at half resolution, shown at 2x
  campPlaces(gy) {
    // [id, label, icon, object centre x (1x), plate y (game px), where its post ends (1x y)]
    return [
      ['arcade', 'ARCADE', 'swords', 15, (gy - 40) * 2, gy - 26],
      ['missions', 'MISSIONS', 'flag', 49, (gy - 50) * 2, gy - 33],
      ['play', null, null, 112, (gy - 66) * 2, 0],
      ['daily', 'DAILY', 'calendar', 170, (gy - 63) * 2, gy - 50],
      ['heroes', 'HEROES', 'lives', 185, (gy - 49) * 2, gy - 31],
      ['upgrades', 'UPGRADES', 'chevrons', 211, (gy - 36) * 2, gy - 27],
    ];
  },
  drawC(o = {}) {
    const W = Gfx.W, H = Gfx.H, w = Math.ceil(W / 2), h = Math.ceil(H / 2), t = o.t || 0;
    const c = this.campCanvas && this.campCanvas.width === w ? this.campCanvas : (this.campCanvas = makeCanvas(w, h));
    const x = c.getContext('2d'), gy = h - 26, focus = o.focus || 'play';
    const R = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(ww), Math.round(hh)); };
    // dusk sky and the first stars
    const g = x.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#15142e'); g.addColorStop(0.45, '#3e2a52'); g.addColorStop(0.78, '#b0504a'); g.addColorStop(1, '#f09a58');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 38; i++) { const sx = (i * 73.1) % w, sy = (i * 37.7) % 60; R(sx, sy, 1, 1, i % 5 ? 'rgba(255,255,255,0.55)' : '#ffffff'); }
    // the jungle behind the camp, three layers of silhouettes
    const par = Sprites.parallax.jungle;
    for (const [img, base, col, off] of [[par.far, gy - 10, '#5a3050', -40], [par.mid, gy - 2, '#34203a', -150], [par.near, gy + 4, '#1c1424', -260]]) {
      const key = 'tint' + col, tinted = img[key] || (img[key] = silhouette(img, col));
      for (let xx = off; xx < w; xx += 512) x.drawImage(tinted, xx, base - img.height);
    }
    // the ground: trampled dirt
    R(0, gy, w, h - gy, '#4e3626'); R(0, gy, w, 1, '#9a7650'); R(0, gy + 1, w, 1, '#735536');
    for (let i = 0; i < 90; i++) R((i * 41.3) % w, gy + 3 + (i * 7.7) % (h - gy - 3), 1 + (i % 2), 1, i % 3 ? '#3e2a1e' : '#6a4c32');
    // ARCADE - the shooting range: sandbags, two targets on posts
    for (let i = 0; i < 4; i++) { R(1 + i * 7, gy - 5, 7, 5, '#15131c'); R(2 + i * 7, gy - 4, 5, 4, '#b09a6a'); R(2 + i * 7, gy - 4, 5, 1, '#d4c090'); }
    for (const [tx, ty] of [[8, gy - 21], [22, gy - 17]]) {
      R(tx, ty + 4, 1, gy - ty - 4, '#6a4a2a');
      R(tx - 4, ty - 4, 9, 9, '#15131c'); R(tx - 3, ty - 3, 7, 7, '#f0ece0'); R(tx - 2, ty - 2, 5, 5, '#d23a2a'); R(tx - 1, ty - 1, 3, 3, '#f0ece0'); R(tx, ty, 1, 1, '#d23a2a');
    }
    // MISSIONS - the map board on two posts
    const bx = 34, by = gy - 32;
    R(bx + 2, by, 2, 32, '#15131c'); R(bx + 26, by, 2, 32, '#15131c'); R(bx + 2, by + 1, 1, 31, '#7a5a36'); R(bx + 26, by + 1, 1, 31, '#7a5a36');
    R(bx - 1, by - 1, 32, 22, '#15131c'); R(bx, by, 30, 20, '#6a4a2a'); R(bx + 1, by + 1, 28, 18, '#e8d6a8');
    R(bx + 2, by + 3, 9, 6, '#8ab06a'); R(bx + 12, by + 2, 7, 9, '#8ab06a'); R(bx + 20, by + 8, 8, 8, '#c8a868'); R(bx + 4, by + 12, 8, 5, '#dcd0e8');
    R(bx + 1, by + 10, 28, 1, '#6aa0c8'); R(bx + 17, by + 11, 1, 7, '#6aa0c8');
    for (const [px, py] of [[4, 7], [8, 9], [12, 8], [16, 10], [20, 12], [24, 13]]) R(bx + px, by + py, 2, 1, '#d23a2a');
    for (const [px, py, col] of [[5, 5, '#ffd23a'], [15, 5, '#d23a2a'], [25, 12, '#d23a2a']]) { R(bx + px, by + py, 2, 2, '#15131c'); R(bx + px, by + py, 1, 1, col); }
    // the helipad and the chopper, rotor turning slowly (a gold outline: it's the focused place)
    const hx = 112;
    R(hx - 34, gy - 3, 68, 1, '#15131c'); R(hx - 33, gy - 2, 66, 2, '#8a8a92'); R(hx - 33, gy - 2, 66, 1, '#b4b4bc');
    R(hx - 34, gy - 3, 2, 1, '#ff5a3a'); R(hx + 32, gy - 3, 2, 1, '#7cff7c');
    const heli = Sprites.props.heli[((t * 8) | 0) % 3], HX = Math.round(hx - (heli.w - heli.ax)), HY = gy - 2 - heli.ay;
    if (focus === 'play') this.outline(x, heli.l, HX, HY, '#ffd23a');
    x.drawImage(heli.l, HX, HY);
    // DAILY - the radio table and its mast (the red light blinks)
    const rx = 156, mx = rx + 14;
    R(rx, gy - 10, 16, 2, '#15131c'); R(rx + 1, gy - 10, 14, 1, '#8a6a44'); R(rx + 2, gy - 8, 1, 8, '#5a3e24'); R(rx + 13, gy - 8, 1, 8, '#5a3e24');
    R(rx + 2, gy - 18, 11, 8, '#15131c'); R(rx + 3, gy - 17, 9, 6, '#4a5a3a'); R(rx + 4, gy - 16, 3, 2, '#1c2418'); R(rx + 5, gy - 16, 1, 1, '#7cff7c'); R(rx + 8, gy - 16, 1, 1, '#ffd23a'); R(rx + 10, gy - 16, 1, 1, '#ffd23a'); R(rx + 4, gy - 13, 7, 1, '#2e3824');
    R(rx + 11, gy - 23, 1, 5, '#9a98a8');
    R(mx, gy - 48, 1, 38, '#9a98a8'); for (let k = 0; k < 4; k++) R(mx - 1 + (k % 2) * 2, gy - 44 + k * 8, 1, 1, '#9a98a8');
    R(mx - 1, gy - 50, 3, 2, ((t * 2) | 0) % 2 ? '#ff3a2a' : '#6a1a14');
    // HEROES - the locker, door open on a hanging jacket (the lead hero's colours)
    const lx = 178;
    R(lx - 1, gy - 30, 15, 30, '#15131c'); R(lx, gy - 29, 13, 29, '#5a6a4a'); R(lx, gy - 29, 13, 1, '#8a9a70');
    for (let k = 0; k < 3; k++) R(lx + 2, gy - 26 + k * 2, 3, 1, '#3a4630');
    R(lx + 6, gy - 28, 7, 27, '#2a2420'); R(lx + 7, gy - 26, 5, 1, '#9a9aa6'); R(lx + 7, gy - 25, 5, 10, '#4f6b2d'); R(lx + 7, gy - 25, 5, 2, '#d8322a'); R(lx + 7, gy - 12, 5, 4, '#2a2420'); R(lx + 7, gy - 8, 2, 7, '#3a3028'); R(lx + 10, gy - 8, 2, 7, '#3a3028');
    R(lx + 13, gy - 29, 5, 29, '#15131c'); R(lx + 14, gy - 28, 3, 27, '#6d7d5a'); R(lx + 15, gy - 16, 1, 3, '#b8c0c8');
    // UPGRADES - the workbench: tools on a board, a vice, ammo crates
    const wx = 199;
    R(wx, gy - 27, 24, 15, '#15131c'); R(wx + 1, gy - 26, 22, 13, '#7a5a36'); R(wx + 1, gy - 26, 22, 1, '#9a7a4a');
    R(wx + 4, gy - 24, 1, 8, '#b8b8c4'); R(wx + 3, gy - 24, 3, 2, '#b8b8c4'); R(wx + 8, gy - 22, 6, 1, '#b8b8c4'); R(wx + 10, gy - 23, 2, 3, '#6a6a76'); R(wx + 17, gy - 25, 1, 9, '#c8a060'); R(wx + 16, gy - 25, 3, 2, '#8a8a96');
    R(wx - 1, gy - 12, 26, 2, '#15131c'); R(wx, gy - 12, 24, 1, '#a07a4a'); R(wx + 1, gy - 10, 2, 10, '#5a3e24'); R(wx + 21, gy - 10, 2, 10, '#5a3e24');
    R(wx + 5, gy - 16, 5, 4, '#15131c'); R(wx + 6, gy - 15, 3, 3, '#6a6a76');
    x.drawImage(Sprites.props.ammo.r, wx + 5, gy - 11);
    // the heroes: one at the range, one at the map, two by the fire, one waving from the chopper door
    const hero = (id, px, py, face, pose) => {
      const set = Sprites.chars[id]; if (!set) return;
      const fr = pose === 'wave' ? set.wave[((t * 2) | 0) % 2] : set.idle[((t * 2 + px * 0.13) | 0) % 2];
      drawFrame(x, fr, px, py, face, false);
    };
    for (const [id, px, py, face, pose] of [['skyhawk', 30, gy, -1], ['havoc', 56, gy, -1], ['ronin', 136, gy - 1, -1, 'wave']]) hero(id, px, py, face, pose);
    // the campfire in front of the pad
    const fx = 78, fy = gy + 13;
    FX.reset(null);
    for (let i = 0; i < 40; i++) { if (i % 2 === 0) { FX.flame(fx + rand(-2, 2), fy - 2); FX.flame(fx + rand(-3, 3), fy - 1); } if (i % 5 === 0) FX.smokePuff(fx, fy - 8, 0.6); FX.update(1 / 60); }
    R(fx - 7, fy - 2, 14, 3, '#15131c'); R(fx - 6, fy - 2, 12, 2, '#5a3a22'); R(fx - 5, fy - 3, 3, 1, '#7a5230'); R(fx + 2, fy - 3, 3, 1, '#7a5230');
    for (const [id, px, py, face] of [['buck', 66, gy + 14, 1], ['scorch', 90, gy + 14, -1], ['brutus', 160, gy + 12, -1]]) hero(id, px, py, face);
    FX.draw(x, 0, 0, w, h);
    FX.light(fx, fy - 6, 46, '#ffa040', 0.9, 1); FX.light(mx, gy - 49, 10, '#ff3a2a', ((t * 2) | 0) % 2 ? 0.8 : 0.1, 1);
    FX.drawLights(x, 0, 0, w, h);
    // sandbags along the front
    for (let i = 0; i < 9; i++) { const sx = i * 26 - 6 + (i % 2) * 5; if (sx > 56 && sx < 100) continue; R(sx, h - 6, 12, 6, '#15131c'); R(sx + 1, h - 5, 10, 5, '#8a7a52'); R(sx + 1, h - 5, 10, 1, '#b4a478'); }
    FX.reset(null);
    // posts from the plates down to their places (drawn on the camp, so they stay behind the heroes)
    const places = this.campPlaces(gy);
    const plateW = (label) => Math.ceil(UI.tw(label)) + 19;
    const plateX = (label, cx) => Math.round(Math.min(W - plateW(label) - 3, Math.max(3, cx * 2 - plateW(label) / 2)));
    for (const [id, label, , cx, py, end] of places) {
      if (!label) continue;
      const px = Math.round((plateX(label, cx) + plateW(label) / 2) / 2), top = Math.round((py + 17) / 2);
      if (end > top) { R(px, top, 1, end - top, '#15131c'); R(px, top, 1, 1, '#6a6a76'); }
    }
    // up to the game canvas at 2x, a soft vignette, the logo on the night sky
    const ctx = Gfx.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, w * 2, h * 2);
    Atmos.vignette(ctx);
    const Lg = this.logo(3, { shear: 0.18 });
    ctx.drawImage(Lg.c, Math.round(W / 2 - Lg.W / 2), 6);
    // the places' plates
    Hud.clear();
    const btns = [];
    for (const [id, label, icon, cx, py] of places) {
      if (id === 'play') { btns.push(this.playBtn(Math.round(cx * 2 - 70), py, 140, 30, { sub: 'MISSION ' + (Math.max(0, campaignNext()) + 1) })); continue; }
      btns.push(new Btn({ id, label, icon, kind: 'dark', rivets: false, x: plateX(label, cx), y: py, w: plateW(label), h: 17 }));
    }
    btns.push(...this.corner(W));
    btns.push(new Btn({ id: 'players', icon: 'coop', label: '', x: W - 65, y: 4, w: 18, h: 16 }));
    this.drawMenu(btns, focus);
  },
  // ---- the first launch (any direction): no title screen at all - mission 1 starts at once and the
  // logo rides in over the chopper drop like a film's opening title, then clears for the first keys
  async setupFirst(steps = 40) {
    Save.data.favorite = 'havoc';
    for (let i = 0; i < 120 && App.pending; i++) TT.step(1);
    App.go(PlayScene, 0);
    for (let i = 0; i < 120 && (App.pending || App.scene !== PlayScene); i++) TT.step(1);
    for (let i = 0; i < steps; i++) TT.step(1);
    Save.data.favorite = null;
    this.bare(Gfx.ctx);
    const snap = makeCanvas(Gfx.W, Gfx.H); snap.getContext('2d').drawImage(Gfx.canvas, 0, 0);
    this.snapFirst = snap;
    return { state: world.state, choppers: world.choppers.length };
  },
  drawFirst() {
    const ctx = Gfx.ctx, W = Gfx.W, H = Gfx.H;
    ctx.drawImage(this.snapFirst, 0, 0);
    this.shade(ctx, 0, 110, 0.55, 0);
    const Lg = this.logo(4, { shear: 0.18 });
    ctx.drawImage(Lg.c, Math.round(W / 2 - Lg.W / 2), 14);
    Hud.clear();
    UI.stampD('RESCUE  •  SWAP  •  DESTROY', UI.X(W / 2), UI.X(14 + Lg.H + 4), '#ffd23a', 1, 'center');
    // only the corner icons: the game is already running
    this.drawMenu(this.corner(W), null);
  },

  // a 1 px outline around a sprite (the focused place in the camp)
  outline(ctx, img, X, Y, col) {
    const s = silhouette(img, col);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(s, X + dx, Y + dy);
  },

  // ---- output
  grab(scale = 3) {
    const c = document.createElement('canvas'); c.width = Gfx.W * scale; c.height = Gfx.H * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(Gfx.canvas, 0, 0, c.width, c.height);
    x.drawImage(Hud.canvas, 0, 0, c.width, c.height);
    return c;
  },
  async post(name, c) {
    const r = await fetch('/__shot?name=' + name, { method: 'POST', body: c.toDataURL('image/png') });
    return r.text();
  },
  async save(name, scale = 3) { return this.post(name, this.grab(scale)); },
  // frames side by side, two to a row, each labelled
  sheet(frames, labels) {
    const w = Math.round(frames[0].width / 2), h = Math.round(frames[0].height / 2), gap = 14, head = 34, cols = 2, rows = Math.ceil(frames.length / cols);
    const c = document.createElement('canvas'); c.width = w * cols + gap * (cols + 1); c.height = (h + head) * rows + gap * (rows + 1);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#0c0b10'; x.fillRect(0, 0, c.width, c.height);
    L10N.raw++;
    frames.forEach((fr, i) => {
      const cx = gap + (i % cols) * (w + gap), cy = gap + Math.floor(i / cols) * (h + head + gap);
      Font.drawOutlined(x, labels[i], cx + 4, cy + 6, i ? '#ffd23a' : '#ff8a6a', 2);
      x.drawImage(fr, cx, cy + head, w, h);
    });
    L10N.raw--;
    return c;
  },
  // everything: the current screen for reference, A, B, C, the first launch, and a sheet
  async all() {
    const q = FX.quality, calm = FX.calm, out = [];
    // a returning player (three missions done): a new one never sees this screen
    const saved = JSON.stringify(Save.data);
    Object.assign(Save.data, { stars: { 0: 3, 1: 2, 2: 3 }, medals: { 0: 7, 1: 3, 2: 7 }, unlocked: Math.max(4, Save.data.unlocked || 0) });
    FX.quality = 2; FX.calm = false;
    try {
      TT.logical(451, 298, 3);
      TT.go(TitleScene, undefined, 60);
      const cur = (TT.step(1), this.grab()); out.push(await this.post('title_0_current', cur));
      if (!this.snapA) await this.seeded(11, () => this.setupA(1, 1500));
      this.drawA(); const A = this.grab(); out.push(await this.post('title_A_live', A));
      await this.seeded(7, async () => this.drawB()); const B = this.grab(); out.push(await this.post('title_B_poster', B));
      await this.seeded(5, async () => this.drawC({ t: 0.3 })); const C = this.grab(); out.push(await this.post('title_C_camp', C));
      await this.seeded(3, () => this.setupFirst(60)); this.drawFirst(); const F = this.grab(); out.push(await this.post('title_first_launch', F));
      out.push(await this.post('title_sheet', this.sheet([cur, A, B, C], ['TERAZ', 'A  ŻYWA SCENA Z GRY', 'B  PLAKAT FILMU AKCJI', 'C  OBÓZ WOJSKOWY'])));
    } finally { FX.quality = q; FX.calm = calm; Save.data = JSON.parse(saved); Save.save(); }
    return out;
  },
};
