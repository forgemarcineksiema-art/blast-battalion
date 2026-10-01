// Dev-only HUD mockups (1.27 design review, never shipped). Renders the current frame at 3x
// without the HUD and draws alternative HUD designs over it; saves PNGs through the dev server.
//   await HUDMOCK.all()
/* eslint-disable no-undef */
window.HUDMOCK = {
  S: 3, // game pixel -> output pixel
  U: 2, // HUD pixel -> output pixel (finer than the game's pixels: crisper, smaller)
  ink: '#15131c',

  // the moment of the player's screenshot: mission 1 just after the landing
  setup(level = 0, hero = 'buck') {
    Save.data.favorite = hero;
    Save.data.tips = { wall: 2 };
    TT.logical(480, 270);
    for (let i = 0; i < 120 && App.pending; i++) TT.step(1);
    App.go(PlayScene, level);
    for (let i = 0; i < 300 && !(window.world && world.state === 'play' && world.player && world.player.onGround); i++) TT.step(1);
    TT.step(70);
    world.player.inv = 0; world.player.face = 1;
    world.choppers = []; // the drop ship has gone
    world.radio = { text: 'GRIMM: ONE SOLDIER? HAH! WAKE ME WHEN HE IS DEAD.', t: 9, dur: 99 };
    TT.step(1);
  },

  // the frame at 3x, optionally without the HUD, the coach, the bubbles and the signs
  frame(bare) {
    const w = world, S = this.S;
    const keep = { props: w.props, coach: w.coach, bubbles: w.bubbles, hud: w.drawHUD, card: w.card };
    const signs = w.props.filter((o) => o instanceof Sign);
    if (bare) { w.props = w.props.filter((o) => !(o instanceof Sign)); w.coach = null; w.bubbles = []; w.drawHUD = () => {}; }
    App.draw(Gfx.ctx);
    Object.assign(w, { props: keep.props, coach: keep.coach, bubbles: keep.bubbles, card: keep.card });
    if (bare) w.drawHUD = keep.hud;
    const out = document.createElement('canvas'); out.width = Gfx.W * S; out.height = Gfx.H * S;
    const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(Gfx.canvas, 0, 0, out.width, out.height);
    const cx = Math.round(w.cam.x + w.cam.sx + w.cam.kx), cy = Math.round(w.cam.y + w.cam.sy + w.cam.ky);
    return { out, ctx, cx, cy, signs, W: out.width, H: out.height };
  },

  // ---- drawing kit (output pixels)
  R(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
  round(ctx, x, y, w, h, r, c) { // a rectangle with its corners cut by r
    this.R(ctx, x + r, y, w - 2 * r, h, c); this.R(ctx, x, y + r, r, h - 2 * r, c); this.R(ctx, x + w - r, y + r, r, h - 2 * r, c);
  },
  img(ctx, im, x, y, s) { ctx.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); },
  text(ctx, t, x, y, c, s, align = 'left') { Font.draw(ctx, t, Math.round(x), Math.round(y), c, s, align); },
  otext(ctx, t, x, y, c, s, align = 'left') { Font.drawOutlined(ctx, t, Math.round(x), Math.round(y), c, s, align); },
  glass(ctx, x, y, w, h, a = 0.72) {
    const u = this.U;
    this.round(ctx, x - u, y - u, w + 2 * u, h + 2 * u, 2 * u, 'rgba(0,0,0,0.35)');
    this.round(ctx, x, y, w, h, 2 * u, 'rgba(14,12,24,' + a + ')');
    this.R(ctx, x + 2 * u, y, w - 4 * u, u, 'rgba(255,255,255,0.10)');
  },
  keycap(ctx, x, y, label, u = this.U) {
    const w = (Font.width(label) + 6) * u, h = 11 * u;
    this.round(ctx, x - u, y - u, w + 2 * u, h + 3 * u, u, this.ink);
    this.round(ctx, x, y, w, h + u, u, '#8e8aa3');
    this.round(ctx, x, y, w, h - u, u, '#e4e1ef');
    this.R(ctx, x + u, y, w - 2 * u, u, '#ffffff');
    this.text(ctx, label, x + w / 2, y + 2 * u, '#2a2638', u, 'center');
    return w;
  },
  cage(ctx, x, y, u, col = '#b8b4d0') { // 7x7 bars
    for (const [a, b, w, h] of [[0, 0, 7, 1], [0, 6, 7, 1], [0, 0, 1, 7], [6, 0, 1, 7], [2, 1, 1, 5], [4, 1, 1, 5]]) this.R(ctx, x + a * u, y + b * u, w * u, h * u, col);
  },
  flag(ctx, x, y, u) {
    this.R(ctx, x, y, u, 9 * u, '#d8d4e8');
    this.R(ctx, x + u, y, 5 * u, 3 * u, '#7cff7c'); this.R(ctx, x + u, y + 3 * u, 4 * u, u, '#4aa84a');
  },
  radioIcon(ctx, x, y, u) { // a walkie-talkie
    this.R(ctx, x + 4 * u, y, u, 3 * u, '#9a98b8');
    this.R(ctx, x, y + 3 * u, 6 * u, 8 * u, this.ink);
    this.R(ctx, x + u, y + 4 * u, 4 * u, 6 * u, '#3a4a3a');
    this.R(ctx, x + 2 * u, y + 5 * u, 2 * u, 2 * u, '#7cff7c');
  },

  // the tutorial signs as pictograms: keys and pictures instead of sentences
  signs(f) {
    const { ctx, cx, cy, signs } = f, S = this.S, u = this.U;
    for (const s of signs) {
      const gx = (s.x - cx) * S, gy = (s.y - cy) * S;
      if (gx < -200 || gx > f.W + 200) continue;
      // contents
      const parts = [];
      if (s.key === 'move') parts.push(['t', '←'], ['k', 'A'], ['k', 'D'], ['t', '→']);
      else if (s.key === 'shoot') parts.push(['k', 'J'], ['t', '▶'], ['barrel']);
      else if (s.key === 'jump') parts.push(['k', 'SPACE'], ['t', '↑']);
      else parts.push(['t', '?']);
      const pw = (p) => p[0] === 'k' ? (Font.width(p[1]) + 6) * u : p[0] === 't' ? Font.width(p[1]) * u : 10 * S;
      const inner = parts.reduce((a, p) => a + pw(p), 0) + (parts.length - 1) * 3 * u;
      const bw = inner + 10 * u, bh = 19 * u, bx = gx - bw / 2, by = gy - 18 * S - bh;
      this.R(ctx, gx - S, by + bh, 3 * S, gy - by - bh, '#4a3522'); // the post
      this.round(ctx, bx - u, by - u, bw + 2 * u, bh + 2 * u, u, this.ink);
      this.R(ctx, bx, by, bw, bh, '#e8d6a8'); this.R(ctx, bx, by + bh - 2 * u, bw, 2 * u, '#c8b488');
      let x = bx + 5 * u;
      for (const p of parts) {
        if (p[0] === 'k') this.keycap(ctx, x, by + 3 * u, p[1]);
        else if (p[0] === 't') this.text(ctx, p[1], x, by + 5 * u, '#2a1e14', u);
        else if (p[0] === 'barrel') this.img(ctx, Sprites.props.barrel.r, x, by + 2 * u, 2);
        x += pw(p) + 3 * u;
      }
    }
  },
  // a key hint over the hero, instead of "A D  MOVE"
  heroHint(f, label, arrow, lift = 0) {
    const { ctx, cx, cy } = f, p = world.player, S = this.S, u = this.U;
    const hx = (p.cx - cx) * S, hy = (p.y - cy) * S - 16 * u - lift;
    const w = (Font.width(label) + 6) * u + (arrow ? (Font.width(arrow) + 2) * u : 0);
    const x0 = hx - w / 2;
    const kw = this.keycap(ctx, x0, hy - 12 * u, label);
    if (arrow) this.otext(ctx, arrow, x0 + kw + 2 * u, hy - 10 * u, '#ffffff', u);
  },

  // ---- A: minimal: a gold-rimmed portrait, hearts and lives, specials and the
  // prisoners as cages - pictures, no words, no score, no bars, no boxes popping up
  mockA(f) {
    const { ctx } = f, u = this.U, S = this.S, P = Sprites.props, p = world.player;
    const x = 16, y = 16, ms = p.maxSpecials();
    const hx = x + 66, w = 66 + Math.max(p.maxHp * 20 + 10 + 44, ms * 14 + 12 + 40) + 8;
    this.glass(ctx, x, y, w, 60, 0.6);
    this.round(ctx, x + 4, y + 4, 52, 52, 2 * u, this.ink);
    this.round(ctx, x + 6, y + 6, 48, 48, u, '#ffd23a');
    this.R(ctx, x + 8, y + 8, 44, 44, '#1c1a2a');
    this.img(ctx, Sprites.chars[p.hero.id].portrait, x + 9, y + 10, S);
    for (let i = 0; i < p.maxHp; i++) this.img(ctx, P.iconHeart, hx + i * 20, y + 9, u);
    const lx = hx + p.maxHp * 20 + 10;
    this.img(ctx, P.iconLife, lx, y + 9, u); this.text(ctx, '×4', lx + 21, y + 11, '#ffffff', u);
    for (let i = 0; i < ms; i++) this.img(ctx, P.specialIcon[p.hero.id], hx + 1 + i * 14, y + 33, u);
    const cx0 = hx + ms * 14 + 12;
    for (let k = 0; k < 2; k++) this.cage(ctx, cx0 + k * 20, y + 35, u, '#8a88a0');
    this.img(ctx, P.iconPause, f.W - 36, 12, u);
    this.signs(f); this.heroHint(f, 'D', '→');
  },

  // ---- B: military, finished: the hero on a gunmetal dog tag on a chain; the mission as a route
  // with the hero's face on it; Grimm as a one-line subtitle at the bottom
  mockB(f) {
    const { ctx } = f, u = this.U, S = this.S, P = Sprites.props, p = world.player, W = f.W;
    const tx = 20, ty = 18, tw = 300, th = 66, r = 4 * u;
    // the tag: gunmetal with a bevel
    this.round(ctx, tx - u, ty - u, tw + 2 * u, th + 2 * u, r + u, this.ink);
    this.round(ctx, tx, ty, tw, th, r, '#4a5059');
    this.R(ctx, tx + r, ty, tw - 2 * r, u, '#8e969f'); this.R(ctx, tx, ty + r, u, th - 2 * r, '#6d757e');
    this.R(ctx, tx + r, ty + th - u, tw - 2 * r, u, '#2c3036'); this.R(ctx, tx + tw - u, ty + r, u, th - 2 * r, '#33383e');
    // the hole (a pixel circle) and the chain through it, up out of the frame
    const hcx = tx + 14, hcy = ty + th / 2;
    this.R(ctx, hcx - 5, hcy - 3, 10, 6, '#15171a'); this.R(ctx, hcx - 3, hcy - 5, 6, 10, '#15171a'); this.R(ctx, hcx - 4, hcy - 4, 8, 8, '#15171a');
    for (let ly = hcy - 2, i = 0; ly > -16; ly -= 11, i++) {
      if (i % 2 === 0) { this.R(ctx, hcx - 4, ly - 12, 8, 13, '#1c1f24'); this.R(ctx, hcx - 3, ly - 11, 6, 11, '#aeb5bc'); this.R(ctx, hcx - 1, ly - 9, 2, 7, '#1c1f24'); this.R(ctx, hcx - 3, ly - 11, 1, 11, '#d7dce1'); }
      else { this.R(ctx, hcx - 2, ly - 12, 4, 13, '#1c1f24'); this.R(ctx, hcx - 1, ly - 11, 2, 11, '#c9cfd5'); }
    }
    // the portrait in a recessed window
    const px = tx + 30, py = ty + 13;
    this.R(ctx, px - 3, py - 3, 48, 45, '#1a1d21'); this.R(ctx, px - 3, py + 42, 48, u, '#7a828b');
    this.R(ctx, px, py, 42, 39, '#20243a'); this.img(ctx, Sprites.chars[p.hero.id].portrait, px, py, S);
    // stamped name; hearts, specials and their key; lives and prisoners on the right
    const nx = px + 54, name = HERO_BY_ID[p.hero.id].name;
    this.text(ctx, name, nx, py + u, '#1e2126', u); this.text(ctx, name, nx, py, '#e4e8ec', u);
    for (let i = 0; i < p.maxHp; i++) this.img(ctx, P.iconHeart, nx + i * 20, py + 22, u);
    let sx = nx + p.maxHp * 20 + 8;
    for (let i = 0; i < p.maxSpecials(); i++) this.img(ctx, P.specialIcon[p.hero.id], sx + i * 14, py + 22, u);
    sx += p.maxSpecials() * 14 + 6;
    this.keycap(ctx, sx, py + 22, 'K', u);
    const rx0 = tx + tw - 62;
    this.img(ctx, P.iconLife, rx0, py - 1, u); this.text(ctx, '×4', rx0 + 21, py + 1, '#e4e8ec', u);
    for (let k = 0; k < 2; k++) this.cage(ctx, rx0 + 2 + k * 20, py + 24, u, '#aeb4ba');
    // the route: the hero's face on the way to the flag, the prisoners on it as cages
    const rw = 460, rx = W / 2 - rw / 2, ry = 30, prog = 0.06;
    this.glass(ctx, rx - 14, ry - 18, rw + 28, 40, 0.5);
    this.R(ctx, rx, ry, rw, 2 * u, '#3a3650'); this.R(ctx, rx, ry, rw * prog, 2 * u, '#ffd23a');
    for (const k of [0.3, 0.72]) this.cage(ctx, rx + rw * k - 7, ry - 6, u, '#b8b4d0');
    this.flag(ctx, rx + rw - 2, ry - 16, u);
    const mx = rx + rw * prog;
    this.round(ctx, mx - 17, ry - 16, 34, 32, u, this.ink); this.R(ctx, mx - 15, ry - 14, 30, 28, '#ffd23a');
    this.R(ctx, mx - 14, ry - 13, 28, 26, '#1c1a2a'); this.img(ctx, Sprites.chars[p.hero.id].portrait, mx - 14, ry - 13, u);
    // the score, small, and pause
    this.glass(ctx, W - 124, 16, 76, 26, 0.55); this.text(ctx, '0', W - 60, 22, '#ffffff', u, 'right');
    this.img(ctx, P.iconPause, W - 38, 14, u);
    // Grimm: a subtitle, one line, bottom center
    const line = 'ONE SOLDIER? HAH! WAKE ME WHEN HE IS DEAD.', lw = Font.width('GRIMM  ' + line) * u + 48;
    const lx = W / 2 - lw / 2, ly = f.H - 60;
    this.glass(ctx, lx, ly, lw, 30, 0.62);
    this.radioIcon(ctx, lx + 12, ly + 4, u);
    this.text(ctx, 'GRIMM', lx + 36, ly + 8, '#7cff7c', u);
    this.text(ctx, line, lx + 36 + Font.width('GRIMM  ') * u, ly + 8, '#f0f0f0', u);
    this.signs(f); this.heroHint(f, 'D', '→');
  },

  // ---- C: clean, next to no HUD: the hearts float over the hero (they'd fade out when nothing
  // changes); lives and prisoners are two small counters; Grimm stays in the briefing
  mockC(f) {
    const { ctx, cx, cy } = f, u = this.U, S = this.S, P = Sprites.props, p = world.player, W = f.W;
    const hx = (p.cx - cx) * S, hy = (p.y - cy) * S, ms = p.maxSpecials();
    const pw = Math.max(p.maxHp * 20 + 6, ms * 9 + 8);
    this.round(ctx, hx - pw / 2, hy - 44, pw, 30, u, 'rgba(12,11,20,0.55)');
    for (let i = 0; i < p.maxHp; i++) this.img(ctx, P.iconHeart, hx - (p.maxHp * 20 - 2) / 2 + i * 20, hy - 41, u);
    for (let i = 0; i < ms; i++) this.round(ctx, hx - (ms * 9 - 3) / 2 + i * 9, hy - 22, 6, 5, 1, i < p.specials ? '#ff8a3a' : '#3a3848');
    this.glass(ctx, 16, 14, 128, 28, 0.5);
    this.img(ctx, P.iconLife, 22, 20, u); this.text(ctx, '4', 44, 22, '#ffffff', u);
    this.cage(ctx, 72, 22, u, '#b8b4d0'); this.text(ctx, '0/2', 90, 22, '#c8f0c8', u);
    this.img(ctx, P.iconPause, W - 36, 12, u);
    this.signs(f); this.heroHint(f, 'D', '→', 36);
  },

  async save(name, canvas) {
    const r = await fetch('/__shot?name=' + name, { method: 'POST', body: canvas.toDataURL('image/png') });
    return r.text();
  },
  // four frames on one sheet, each labelled
  sheet(frames, labels) {
    const w = frames[0].width / 2, h = frames[0].height / 2, gap = 12, head = 34;
    const c = document.createElement('canvas'); c.width = w * 2 + gap * 3; c.height = (h + head) * 2 + gap * 3;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#0c0b10'; x.fillRect(0, 0, c.width, c.height);
    frames.forEach((fr, i) => {
      const cx = gap + (i % 2) * (w + gap), cy = gap + Math.floor(i / 2) * (h + head + gap);
      Font.drawOutlined(x, labels[i], cx + 4, cy + 6, i ? '#ffd23a' : '#ff8a6a', 2);
      x.drawImage(fr, cx, cy + head, w, h);
    });
    return c;
  },
  async all(tag = 'mock') {
    this.setup();
    const out = [];
    const cur = this.frame(false); out.push(await this.save(tag + '_0_current', cur.out));
    const frames = [cur.out];
    for (const k of ['A', 'B', 'C']) {
      const f = this.frame(true);
      this['mock' + k](f);
      frames.push(f.out);
      out.push(await this.save(tag + '_' + k, f.out));
    }
    out.push(await this.save(tag + '_sheet', this.sheet(frames, ['OBECNY', 'A  MINIMALNY', 'B  WOJSKOWY', 'C  CZYSTY'])));
    return out;
  },
};
