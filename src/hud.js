'use strict';
// ============================================================================
//  HUD layer (1.27). The heads-up display gets its own canvas over the game, at
//  the screen's real resolution, so it's drawn in finer pixels than the world
//  (about 2/3 of a game pixel): crisp and small instead of chunky. The look
//  ("B - military"): the hero on a gunmetal dog tag hanging on a chain, the
//  mission as a route with the hero's face on it, Grimm as a one-line subtitle,
//  a slim score plate. Pictures instead of words wherever a picture works.
//  The layer never takes input (the game canvas under it does), it's cleared
//  every frame, and it's empty in the menus and under the pause screens.
// ============================================================================

const Hud = {
  canvas: null, ctx: null,
  F: 3, // device pixels per game pixel
  u: 2, // device pixels per HUD pixel
  ink: '#15131c',

  init() {
    const c = document.createElement('canvas');
    c.id = 'hud'; c.hiRes = true; // set in the typeface (Font)
    c.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
    Gfx.canvas.parentElement.insertBefore(c, Gfx.canvas.nextSibling);
    this.canvas = c; this.ctx = c.getContext('2d');
    this.resize();
  },
  resize() {
    if (!this.canvas) return;
    const g = Gfx.canvas, F = Gfx.scale;
    this.F = F;
    this.u = F < 2 ? 1 : Math.max(2, Math.round(F * 2 / 3));
    this.canvas.width = Math.max(1, Math.round(Gfx.W * F)); this.canvas.height = Math.max(1, Math.round(Gfx.H * F));
    Object.assign(this.canvas.style, { width: g.style.width, height: g.style.height, left: g.style.left, top: g.style.top });
    this.ctx.imageSmoothingEnabled = false;
  },
  clear() { if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); },
  // the scene fades: darken the HUD's own pixels by the same amount
  fade(a) {
    if (!this.ctx || a <= 0) return;
    const x = this.ctx;
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(12,11,16,' + a.toFixed(3) + ')';
    x.fillRect(0, 0, this.canvas.width, this.canvas.height); x.globalCompositeOperation = 'source-over';
  },

  // ---- drawing kit (device pixels)
  R(x, y, w, h, c) { const k = this.ctx; k.fillStyle = c; k.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
  round(x, y, w, h, r, c) { this.R(x + r, y, w - 2 * r, h, c); this.R(x, y + r, r, h - 2 * r, c); this.R(x + w - r, y + r, r, h - 2 * r, c); },
  disc(cx, cy, r, c) { // a pixel circle, r in HUD pixels
    const u = this.u;
    for (let dy = -r; dy < r; dy++) { const h = Math.floor(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)) + 0.5); this.R(cx - h * u, cy + dy * u, 2 * h * u, u, c); }
  },
  img(im, x, y, s = this.u) { this.ctx.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); },
  text(t, x, y, c, align = 'left', s = this.u) { Font.draw(this.ctx, t, Math.round(x), Math.round(y), c, s, align); },
  otext(t, x, y, c, align = 'left', s = this.u) { Font.drawOutlined(this.ctx, t, Math.round(x), Math.round(y), c, s, align); },
  tw(t, s = this.u) { return Font.width(t) * s; },
  glass(x, y, w, h, a = 0.66) {
    const u = this.u;
    this.round(x - u, y - u, w + 2 * u, h + 2 * u, 2 * u, 'rgba(0,0,0,0.35)');
    this.round(x, y, w, h, 2 * u, 'rgba(14,12,24,' + a + ')');
    this.R(x + 2 * u, y, w - 4 * u, u, 'rgba(255,255,255,0.10)');
  },
  keycap(x, y, label, u = this.u) {
    const w = (Font.width(label) + 6) * u, h = 11 * u;
    this.round(x - u, y - u, w + 2 * u, h + 3 * u, u, this.ink);
    this.round(x, y, w, h + u, u, '#8e8aa3');
    this.round(x, y, w, h - u, u, '#e4e1ef');
    this.R(x + u, y, w - 2 * u, u, '#ffffff');
    Font.draw(this.ctx, label, Math.round(x + w / 2), Math.round(y + 2 * u), '#2a2638', u, 'center');
    return w;
  },
  keyW(label, u = this.u) { return (Font.width(label) + 6) * u; },
  cage(x, y, col, filled, u = this.u) { // 7x7
    if (filled) this.R(x + u, y + u, 5 * u, 5 * u, filled);
    for (const [a, b, w, h] of [[0, 0, 7, 1], [0, 6, 7, 1], [0, 0, 1, 7], [6, 0, 1, 7], [2, 1, 1, 5], [4, 1, 1, 5]]) this.R(x + a * u, y + b * u, w * u, h * u, col);
  },
  drum(x, y, col, u = this.u) { this.R(x, y, 5 * u, 7 * u, this.ink); this.R(x + u, y + u, 3 * u, 5 * u, col); this.R(x + u, y + 3 * u, 3 * u, u, '#15131c'); },
  flag(x, y, col, u = this.u) { this.R(x, y, u, 10 * u, '#d8d4e8'); this.R(x + u, y, 5 * u, 3 * u, col); this.R(x + u, y + 3 * u, 4 * u, u, 'rgba(0,0,0,0.35)'); },
  radioIcon(x, y, u = this.u) {
    this.R(x + 4 * u, y, u, 3 * u, '#9a98b8');
    this.R(x, y + 3 * u, 6 * u, 8 * u, this.ink);
    this.R(x + u, y + 4 * u, 4 * u, 6 * u, '#3a4a3a');
    this.R(x + 2 * u, y + 5 * u, 2 * u, 2 * u, '#7cff7c');
  },

  // ---- the HUD of a mission ------------------------------------------------------------
  drawWorld(w) {
    if (!this.ctx) return;
    const x = this.ctx, u = this.u;
    x.save();
    if (w.cine) x.globalAlpha = 0.35; // letterboxed moments: the HUD steps back
    // the strips stack: down from under the route (in the room between the dog tags), up from
    // the bottom edge
    this.top = 32 * u; this.bot = this.canvas.height - 15 * u;
    this.colL = 0; this.colR = this.canvas.width; this.tagBot = 0;
    let left = 0, right = this.canvas.width;
    if (w.state !== 'rail') {
      left = this.tag(w, 0);
      if (w.numPlayers > 1) right = this.tag(w, 1);
      this.route(w, left, right);
    }
    // no room between the tags (two players on a small screen): the strips go under them
    if (this.narrow()) this.top = Math.max(this.top, this.tagBot + 4 * u);
    this.score(w);
    this.pauseIcon();
    this.boss(w);
    this.subtitle(w);
    this.coach(w);
    this.heroKeys(w);
    x.restore();
  },

  // the dog tag: portrait in a recessed window, the name stamped in, hearts and specials (with
  // the key that throws them), and on P1's tag the shared lives and the prisoners as cages.
  // Returns the edge the rest of the HUD keeps clear of
  tag(w, slot) {
    const u = this.u, P = Sprites.props, W = this.canvas.width, coop = w.numPlayers > 1;
    const p = w.players.find((q) => q.slot === slot);
    const heroId = p ? p.hero.id : w.lastHero[slot];
    const alive = p && !p.dead, main = slot === 0;
    const pS = Math.max(2, Math.round(u * 1.5)), portW = 14 * pS, portH = 13 * pS;
    const name = heroId ? HERO_BY_ID[heroId].name : '';
    // the row: hearts + specials + key, the vehicle's armor, or a call for a prisoner
    const icon = alive ? P.specialIcon[p.hero.id] || P.iconGrenade : null, ms = alive ? p.maxSpecials() : 0;
    const many = ms > 6, key = Input.mode === 'touch' ? '' : Input.mode === 'gamepad' ? 'B' : this.keyFor('special', slot);
    const sW = (i) => Math.max(icon ? icon.width : 6, 6) + 1;
    let rowW = 0;
    if (alive && p.mech) rowW = this.tw(VEHICLE[p.mech.kind || 'walker'].name) + 4 * u + 40 * u;
    else if (alive) rowW = p.maxHp * 10 * u + 4 * u + (many ? 8 * u + this.tw('×' + p.specials) : ms * sW() * u) + (key ? 4 * u + this.keyW(key) : 0) + (p.pocket ? 13 * u : 0);
    else if (p && p.waiting) rowW = this.tw('FREE A PRISONER!');
    const cages = Math.min(w.prisonersTotal, 6), manyCages = w.prisonersTotal > 6;
    const lives = '×' + w.lives;
    const rightW = main ? Math.max(11 * u + this.tw(lives), manyCages ? 9 * u + this.tw(w.rescued + '/' + w.prisonersTotal) : cages * 9 * u) : 0;
    const cx0 = 13 * u + portW + 7 * u;
    const tw = cx0 + Math.max(this.tw(name) + (coop ? 12 * u : 0), rowW) + (main ? 9 * u + rightW : 0) + 7 * u;
    const th = portH + 10 * u;
    const tx = slot === 1 && coop ? W - 24 * u - tw : 9 * u, ty = 7 * u;
    // a new hero: the tag gives a jolt and the name shines
    const c = w.card && w.card.slot === slot ? w.card : null;
    const jolt = c && c.t < 0.3 ? Math.round(Math.sin(c.t / 0.3 * Math.PI) * 3) * u : 0;
    const y0 = ty + jolt;
    // the chain, up out of the frame, through the hole
    const hcx = tx + 7 * u, hcy = y0 + Math.round(th / 2);
    for (let ly = hcy - u, i = 0; ly > -12 * u; ly -= 6 * u, i++) {
      if (i % 2 === 0) { this.R(hcx - 2 * u, ly - 7 * u, 4 * u, 7 * u, '#1c1f24'); this.R(hcx - 1.5 * u, ly - 6.5 * u, 3 * u, 6 * u, '#aeb5bc'); this.R(hcx - 0.5 * u, ly - 5.5 * u, u, 4 * u, '#1c1f24'); }
      else { this.R(hcx - u, ly - 7 * u, 2 * u, 7 * u, '#1c1f24'); this.R(hcx - 0.5 * u, ly - 6.5 * u, u, 6 * u, '#c9cfd5'); }
    }
    // the plate: gunmetal, bevelled
    const r = 3 * u;
    this.round(tx - u, y0 - u, tw + 2 * u, th + 2 * u, r + u, this.ink);
    this.round(tx, y0, tw, th, r, '#4a5059');
    this.R(tx + r, y0, tw - 2 * r, u, '#8e969f'); this.R(tx, y0 + r, u, th - 2 * r, '#6d757e');
    this.R(tx + r, y0 + th - u, tw - 2 * r, u, '#2c3036'); this.R(tx + tw - u, y0 + r, u, th - 2 * r, '#33383e');
    if (coop) this.R(tx + r, y0 + u, tw - 2 * r, u, PLAYER_COLORS[slot]);
    this.disc(hcx, hcy, 3, '#15171a');
    // the portrait, sunk into the plate
    const px = tx + 13 * u, py = y0 + 5 * u;
    this.R(px - 1.5 * u, py - 1.5 * u, portW + 3 * u, portH + 3 * u, '#1a1d21'); this.R(px - 1.5 * u, py + portH + 1.5 * u, portW + 3 * u, u, '#7a828b');
    this.R(px, py, portW, portH, '#20243a');
    if (heroId) {
      if (!alive) this.ctx.globalAlpha *= 0.35;
      this.img(Sprites.chars[heroId].portrait, px, py, pS);
      if (!alive) this.ctx.globalAlpha /= 0.35;
    } else this.img(P.iconLife, px + (portW - 9 * pS) / 2, py + (portH - 8 * pS) / 2, pS);
    // the name, stamped (a player badge first in co-op)
    let nx = tx + cx0;
    if (coop) { this.R(nx, py, 10 * u, 7 * u, PLAYER_COLORS[slot]); this.text('P' + (slot + 1), nx + 5 * u, py, '#15131c', 'center'); nx += 12 * u; }
    const shine = c && c.t < 1.2 && ((c.t * 8) | 0) % 2 === 0;
    this.text(name, nx, py + u, '#1e2126'); this.text(name, nx, py, shine ? '#ffd23a' : '#e4e8ec');
    // the row under the name
    const ry = py + 11 * u;
    let x = tx + cx0;
    if (alive && p.mech) {
      const M = p.mech, vn = VEHICLE[M.kind || 'walker'].name;
      this.text(vn, x, ry, '#7cff7c'); x += this.tw(vn) + 4 * u;
      this.R(x, ry, 40 * u, 6 * u, '#15171a');
      this.R(x + u, ry + u, Math.max(0, Math.round(38 * u * M.hp / M.maxHp)), 4 * u, M.hp / M.maxHp > 0.35 ? '#7cff7c' : '#ff5a3a');
    } else if (alive) {
      for (let i = 0; i < p.maxHp; i++) {
        let im = i < p.hp ? P.iconHeart : P.iconHeartOff;
        if (i === p.hp && p.hurtT > 0 && ((w.clock * 20) | 0) % 2) im = P.iconHeartLit;
        else if (i === 0 && p.hp === 1 && p.maxHp > 1 && ((w.clock * 3) | 0) % 2) im = P.iconHeartLit;
        this.img(im, x + i * 10 * u, ry);
      }
      x += p.maxHp * 10 * u + 4 * u;
      if (many) { this.img(icon, x, ry); this.text('×' + p.specials, x + 8 * u, ry + u, p.specials ? '#e4e8ec' : '#8a88a0'); x += 8 * u + this.tw('×' + p.specials); }
      else {
        for (let i = 0; i < ms; i++) {
          if (i < p.specials) this.img(icon, x + i * sW() * u, ry);
          else this.R(x + i * sW() * u + 2 * u, ry + 3 * u, 3 * u, 3 * u, '#2c3036');
        }
        x += ms * sW() * u;
      }
      if (key) { x += 4 * u; x += this.keycap(x, ry - u, key, u); }
      if (p.pocket) {
        // a gold-crate item ready on SPECIAL: a blinking gold box
        const ic = P.pocketIcon[p.pocket];
        x += 4 * u;
        this.R(x - u, ry - u, 11 * u, 10 * u, ((w.time * 3) | 0) % 2 ? '#ffd23a' : '#c8961e');
        this.R(x, ry, 9 * u, 8 * u, '#26233a');
        if (ic) this.img(ic, x + Math.round((9 - ic.width) / 2) * u, ry + Math.round((8 - ic.height) / 2) * u);
      }
    } else if (p && p.waiting) this.text('FREE A PRISONER!', x, ry, '#ffd23a');
    // lives and prisoners, on the right of P1's tag
    if (main) {
      const rx = tx + tw - 7 * u - rightW;
      this.img(P.iconLife, rx, py - u); this.text(lives, rx + 11 * u, py, '#e4e8ec');
      if (manyCages) { this.cage(rx, ry, '#aeb5bc'); this.text(w.rescued + '/' + w.prisonersTotal, rx + 9 * u, ry, '#c8f0c8'); }
      else for (let k = 0; k < cages; k++) this.cage(rx + k * 9 * u, ry, k < w.rescued ? '#7cff7c' : '#aeb5bc', k < w.rescued ? '#2c6a2c' : null);
    }
    // where it is: the strips under the route keep clear of it
    if (slot === 1 && coop) this.colR = Math.min(this.colR, tx); else this.colL = Math.max(this.colL, tx + tw);
    this.tagBot = Math.max(this.tagBot, y0 + th);
    return slot === 1 && coop ? tx : tx + tw;
  },
  // the room for the strips under the route: between the tags - or, when that's too tight or
  // the strip goes at the bottom, the full width
  narrow() { return this.colR - this.colL - 24 * this.u < 150 * this.u; },
  room(top) {
    const u = this.u;
    return top && !this.narrow() ? [this.colL + 12 * u, this.colR - 12 * u] : [12 * u, this.canvas.width - 12 * u];
  },
  // x for a strip bw wide: centred on the screen if it can be, inside the room anyway
  place(bw, top) { const [a, b] = this.room(top); return Math.round(clamp(this.canvas.width / 2 - bw / 2, a, Math.max(a, b - bw))); },

  // the mission route: the hero's face on the way to the flag; prisoners as cages, fuel depots,
  // the colonel, the detonation chasing from behind
  route(w, left, right) {
    const u = this.u, F = this.F, W = this.canvas.width;
    const room = right - left - 24 * u;
    const rw = Math.min(230 * u, Math.floor(room));
    if (rw < 70 * u) return;
    const cx = clamp(W / 2, left + 12 * u + rw / 2, right - 12 * u - rw / 2);
    const rx = Math.round(cx - rw / 2), top = 7 * u, rail = top + 10 * u;
    this.glass(rx - 12 * u, top, rw + 24 * u, 20 * u, 0.55);
    const Wpx = w.terrain.w * TILE, at = (px) => rx + Math.round(rw * clamp(px / Wpx, 0, 1));
    this.R(rx, rail, rw, 2 * u, '#3a3650');
    if (w.doom && w.doom.on && w.doom.x > 0) this.R(rx, rail - u, at(w.doom.x) - rx, 4 * u, '#ff5a1a');
    const heroes = w.alivePlayers().length ? w.alivePlayers() : [];
    const hx = at(heroes.length ? Math.max(...heroes.map((p) => p.cx)) : w.focus.x);
    this.R(rx, rail, hx - rx, 2 * u, '#ffd23a');
    for (const o of w.props) {
      if (o.isCage) this.cage(at(o.x) - 3.5 * u, rail - 3 * u, o.dead || o.open ? '#7cff7c' : '#b8b4d0', o.dead || o.open ? '#2c6a2c' : 'rgba(14,12,24,0.8)');
      else if (o.isDepot) this.drum(at(o.x) - 2.5 * u, rail - 3.5 * u, o.dead ? '#3a3848' : '#ff8a3a');
    }
    if (w.target) {
      const tx = at(w.target.x) - 4.5 * u;
      this.img(w.target.dead ? Sprites.props.iconSkull : Sprites.props.iconSkull, tx, rail - 5 * u);
      if (w.target.dead) this.otext('✓', tx + 2 * u, rail - 4 * u, '#7cff7c');
    }
    const locked = (w.goal === 'target' || w.goal === 'depots') && !w.goalDone;
    this.flag(rx + rw - u, rail - 8 * u, locked ? '#ff5a3a' : '#7cff7c');
    // the faces
    const faces = w.numPlayers > 1 ? w.players : [w.player].filter(Boolean);
    for (const p of faces) {
      if (!p || p.dead) continue;
      const fx = clamp(at(p.cx), rx + 8 * u, rx + rw - 10 * u) - 8 * u, fy = rail - 7 * u;
      const col = w.numPlayers > 1 ? PLAYER_COLORS[p.slot] : '#ffd23a';
      this.round(fx - u, fy - u, 18 * u, 17 * u, u, this.ink); this.R(fx, fy, 16 * u, 15 * u, col);
      this.R(fx + u, fy + u, 14 * u, 13 * u, '#1c1a2a'); this.img(Sprites.chars[p.hero.id].portrait, fx + u, fy + u);
    }
  },

  score(w) {
    const u = this.u, W = this.canvas.width, coop = w.numPlayers > 1;
    const s = fmtNum(w.score + (w.arcade ? w.arcade.score : 0));
    const sw = this.tw(s) + 12 * u;
    const x = coop ? this.place(sw, true) : W - 24 * u - sw, y = coop ? this.top - 2 * u : 7 * u;
    this.glass(x, y, sw, 13 * u, 0.55);
    this.text(s, x + sw - 6 * u, y + 3 * u, '#ffffff', 'right');
    if (coop) this.top = y + 17 * u;
  },
  pauseIcon() {
    const u = this.u, W = this.canvas.width, x = W - 19 * u, y = 7 * u;
    this.glass(x, y, 13 * u, 13 * u, 0.55);
    this.R(x + 4 * u, y + 3 * u, 2 * u, 7 * u, '#ffffff'); this.R(x + 7 * u, y + 3 * u, 2 * u, 7 * u, '#ffffff');
  },

  boss(w) {
    const b = w.boss;
    if (!b || !w.bossActive || b.dead) return;
    const u = this.u, [ra, rb] = this.room(true), bw = Math.max(60 * u, Math.min(220 * u, rb - ra - 12 * u));
    const x = this.place(bw + 12 * u, true) + 6 * u, y = this.top;
    this.glass(x - 6 * u, y, bw + 12 * u, 17 * u, 0.62);
    this.text(b.name, x + bw / 2, y + 2 * u, '#ff8a6a', 'center');
    this.R(x, y + 11 * u, bw, 4 * u, '#4a1a1a');
    this.R(x, y + 11 * u, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 4 * u, b.flash > 0 ? '#ffffff' : '#e8321e');
    this.R(x, y + 11 * u, Math.round(bw * Math.max(0, b.hp) / b.maxHp), u, '#ff8a7a');
    this.top = y + 21 * u;
  },

  // keys floating over a hero's head - or over what he's saying, if he's talking.
  // parts: ['k', label] a key, ['t', text] a word or an arrow
  keysOver(w, p, parts, lift = 8) {
    const u = this.u, F = this.F;
    const { x: cx, y: cy } = w.view || w.viewCam(); // the camera as World.draw drew it this frame
    const said = w.bubbles.find((b) => b.who === p && b.y != null);
    const head = (p.y - cy) * F - lift * u, top = said ? Math.min(head, said.y * F - 3 * u) : head;
    const hx = (p.cx - cx) * F, hy = top + Math.round(Math.sin(w.clock * 6) * 1.5) * u;
    const pw = (q) => q[0] === 'k' ? this.keyW(q[1]) : this.tw(q[1]);
    const total = parts.reduce((a, q) => a + pw(q), 0) + (parts.length - 1) * 3 * u;
    let x = Math.round(clamp(hx - total / 2, 4 * u, this.canvas.width - 4 * u - total));
    const y = Math.round(hy - 12 * u), m = w.msgBand;
    if (m && x < m.x1 * F && x + total > m.x0 * F && y < m.y1 * F && y + 12 * u > m.y0 * F) return; // a big announcement: wait it out
    for (const q of parts) {
      if (q[0] === 'k') this.keycap(x, y, q[1]); else this.otext(q[1], x, y + 2 * u, '#ffd23a');
      x += pw(q) + 3 * u;
    }
  },
  // the key a player presses for an action (the keyboard is split in co-op: P2 has the second binding)
  keyFor(action, slot = 0) {
    const k = Settings.keys(action);
    return Settings.keyName(Input.coop && slot === 1 && k[1] ? k[1] : k[0]);
  },

  // the first mission's prompts, as keys over the hero's head
  coach(w) {
    const step = w.coachStep && w.coachStep();
    if (!step || !w.player) return;
    const touch = Input.mode === 'touch', pad = Input.mode === 'gamepad', K = (a) => this.keyFor(a);
    const parts = step === 'move' ? (touch ? [['t', 'DRAG'], ['t', '▶']] : pad ? [['k', 'STICK'], ['t', '▶']] : [['k', K('right')], ['t', '▶']])
      : step === 'shoot' ? (touch ? [['k', 'FIRE']] : pad ? [['k', 'X']] : [['k', K('fire')]]).concat([['t', '▶']])
      : (touch ? [['k', 'JUMP']] : pad ? [['k', 'A']] : [['k', K('jump')]]).concat([['t', '↑']]);
    this.keysOver(w, w.player, parts);
  },
  // the same for a new trick: how to get out of a vehicle, how to fly a jetpack
  heroKeys(w) {
    const touch = Input.mode === 'touch', pad = Input.mode === 'gamepad', x = this.ctx;
    for (const p of w.alivePlayers()) {
      const M = p.mech, t = M ? M.hint : p.flyHint;
      if (!(t > 0) || (p === w.player && w.coachStep && w.coachStep())) continue;
      const parts = M ? [['t', 'HOLD'], ['k', touch || pad ? '↓' : this.keyFor('down', p.slot)], ['t', '▶ EXIT']]
        : [['t', 'HOLD'], ['k', touch ? 'JUMP' : pad ? 'A' : this.keyFor('jump', p.slot)], ['t', '▶ FLY']];
      const g = x.globalAlpha;
      x.globalAlpha = g * Math.min(1, t / 0.4);
      this.keysOver(w, p, parts, M ? 12 : 8);
      x.globalAlpha = g;
    }
  },

  // room for a strip h tall: over the ones at the bottom edge - or, on phones, under the ones
  // at the top, clear of the touch controls
  slot(h) {
    const u = this.u;
    if (Input.mode === 'touch') { const y = this.top; this.top += h + 4 * u; return y; }
    this.bot -= h; const y = this.bot; this.bot -= 4 * u; return y;
  },

  // Grimm on the radio, as a subtitle: one line (two at most), typed out
  subtitle(w) {
    const r = w.radio;
    if (!r) return;
    const u = this.u, top = Input.mode === 'touch', [ra, rb] = this.room(top);
    const k = Math.min(1, r.t / 0.12, (r.dur - r.t) / 0.25);
    if (k <= 0) return;
    const m = /^([A-Z]+): (.*)$/.exec(r.text), who = m ? m[1] : '', line = m ? m[2] : r.text;
    const maxW = Math.min(rb - ra, 360 * u) - 34 * u - this.tw(who + '  ');
    const lines = Font.wrap(line, Math.floor(maxW / u));
    const bw = Math.max(...lines.map((l) => this.tw(l))) + this.tw(who + '  ') + 30 * u, bh = 6 * u + lines.length * 9 * u;
    const x = this.place(bw, top), y = this.slot(bh);
    this.ctx.globalAlpha *= k;
    this.glass(x, y, bw, bh, 0.66);
    this.radioIcon(x + 7 * u, y + Math.round((bh - 11 * u) / 2));
    const tx = x + 19 * u;
    this.text(who, tx, y + 3 * u, '#7cff7c');
    let n = Math.floor(r.t * 45);
    L10N.raw++; // the lines are translated already: their typed-out slices are drawn as they are
    lines.forEach((l, i) => { if (n > 0) this.text(l.slice(0, n), tx + this.tw(who + '  '), y + 3 * u + i * 9 * u, '#f0f0f0'); n -= l.length + 1; });
    L10N.raw--;
    this.ctx.globalAlpha /= k;
  },
};
