'use strict';
// ============================================================================
//  Destructible tile terrain: damage, fire, structural collapse, cached render
// ============================================================================

const T = { EMPTY: 0, DIRT: 1, ROCK: 2, BEDROCK: 3, WOOD: 4, BRICK: 5, STEEL: 6, SANDBAG: 7, LADDER: 8, PLATFORM: 9, CRATE: 10, ROOF: 11, STONE: 12 };
const BG = { NONE: 0, DIRT: 1, WOOD: 2, BRICK: 3, STONE: 4, STEEL: 5 };

const TDEF = [];
TDEF[T.EMPTY] = { solid: false };
TDEF[T.DIRT] = { solid: true, hp: 10, anchor: true, debris: 'dirt' };
TDEF[T.ROCK] = { solid: true, hp: 30, anchor: true, debris: 'rock', bulletRes: 0.45 };
TDEF[T.BEDROCK] = { solid: true, hp: 1e9, anchor: true, indestructible: true, debris: 'rock' };
TDEF[T.WOOD] = { solid: true, hp: 9, flammable: true, debris: 'wood' };
TDEF[T.BRICK] = { solid: true, hp: 24, debris: 'brick', bulletRes: 0.55 };
TDEF[T.STEEL] = { solid: true, hp: 60, debris: 'steel', bulletRes: 0.12, explosionRes: 0.55 };
TDEF[T.SANDBAG] = { solid: true, hp: 14, debris: 'sand' };
TDEF[T.LADDER] = { solid: false, ladder: true, hp: 4, flammable: true, debris: 'wood', thin: true };
TDEF[T.PLATFORM] = { solid: false, oneway: true, hp: 6, flammable: true, debris: 'wood', thin: true };
TDEF[T.CRATE] = { solid: true, hp: 5, flammable: true, debris: 'wood', drop: 'ammo' };
TDEF[T.ROOF] = { solid: true, hp: 10, debris: 'steel', fragile: true };
TDEF[T.STONE] = { solid: true, hp: 26, debris: 'stone', bulletRes: 0.6 };

class Terrain {
  constructor(w, h, themeName) {
    this.w = w; this.h = h; this.themeName = themeName;
    this.fg = new Uint8Array(w * h);
    this.bg = new Uint8Array(w * h);
    this.hp = new Float32Array(w * h);
    this.vari = new Uint8Array(w * h);
    this.fire = new Float32Array(w * h);
    this.scorch = new Uint8Array(w * h);
    this.dirty = new Set();
    this.burning = new Set();
    this.collapseQueue = [];
    // structures that lost their support: they creak and shed dust for a moment before they fall
    this.cracking = new Map(); // cell index -> its crack
    this.cracks = [];          // { cells, t, dur }
    this.onCrack = null;       // (crack) => void
    this.tiles = Sprites.tiles[themeName];
    this.canvas = null;
    this.onDestroy = null; // (cx, cy, type, src) => void
    this.onFall = null;    // (cx, cy, type, hp) => void
    for (let i = 0; i < this.vari.length; i++) this.vari[i] = (Math.random() * 255) | 0;
  }

  inb(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h; }
  get(cx, cy) {
    if (cx < 0 || cx >= this.w || cy >= this.h) return T.BEDROCK;
    if (cy < 0) return T.EMPTY;
    return this.fg[cy * this.w + cx];
  }
  solid(cx, cy) { return TDEF[this.get(cx, cy)].solid; }
  oneway(cx, cy) { return TDEF[this.get(cx, cy)].oneway === true; }
  ladder(cx, cy) { return TDEF[this.get(cx, cy)].ladder === true; }
  solidAt(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  ladderAt(px, py) { return this.ladder(Math.floor(px / TILE), Math.floor(py / TILE)); }
  standableAt(px, py) { const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE); const d = TDEF[this.get(cx, cy)]; return d.solid || d.oneway; }

  set(cx, cy, t, bg) {
    if (!this.inb(cx, cy)) return;
    const i = cy * this.w + cx;
    this.fg[i] = t;
    this.hp[i] = t ? TDEF[t].hp : 0;
    this.cracking.delete(i);
    if (bg !== undefined) this.bg[i] = bg;
    if (this.canvas) this.markDirty(cx, cy);
  }

  markDirty(cx, cy) {
    const w = this.w;
    if (this.inb(cx, cy)) this.dirty.add(cy * w + cx);
    if (this.inb(cx - 1, cy)) this.dirty.add(cy * w + cx - 1);
    if (this.inb(cx + 1, cy)) this.dirty.add(cy * w + cx + 1);
    if (this.inb(cx, cy - 1)) this.dirty.add((cy - 1) * w + cx);
    if (this.inb(cx, cy + 1)) this.dirty.add((cy + 1) * w + cx);
  }

  // amount in tile-HP units; src: 'bullet' | 'explosion' | 'fire' | 'melee' | 'crush'
  damage(cx, cy, amount, src) {
    if (!this.inb(cx, cy)) return false;
    const i = cy * this.w + cx;
    const t = this.fg[i];
    if (!t) return false;
    const d = TDEF[t];
    if (d.indestructible) return false;
    let a = amount;
    if (src === 'bullet' && d.bulletRes) a *= d.bulletRes;
    if (src === 'explosion' && d.explosionRes) a *= d.explosionRes;
    const before = this.hp[i];
    this.hp[i] -= a;
    if (this.hp[i] <= 0) { this.destroy(cx, cy, src); return true; }
    const m = d.hp;
    if (Math.floor(before / m * 3) !== Math.floor(this.hp[i] / m * 3)) this.dirty.add(i);
    return false;
  }

  destroy(cx, cy, src) {
    const i = cy * this.w + cx;
    const t = this.fg[i];
    if (!t) return;
    this.fg[i] = 0; this.hp[i] = 0;
    this.cracking.delete(i);
    if (this.fire[i] > 0) { this.fire[i] = 0; this.burning.delete(i); }
    if (src === 'explosion' || src === 'fire') this.scorch[i] = 1;
    this.clearDecal(i);
    this.markDirty(cx, cy);
    if (this.onDestroy) this.onDestroy(cx, cy, t, src);
    this.collapseQueue.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
  }

  // Persistent splatter (blood, soot) painted on solid tiles; removed with the tile.
  addDecal(px, py, color, size = 1) {
    if (!this.dctx) return;
    const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
    if (!this.inb(cx, cy) || !this.solid(cx, cy)) return;
    this.dctx.fillStyle = color;
    this.dctx.fillRect(Math.floor(px), Math.floor(py), size, size);
    this.decalMark[cy * this.w + cx] = 1;
  }
  clearDecal(i) {
    if (!this.dctx || !this.decalMark[i]) return;
    this.decalMark[i] = 0;
    this.dctx.clearRect((i % this.w) * TILE, ((i / this.w) | 0) * TILE, TILE, TILE);
  }

  ignite(cx, cy) {
    if (!this.inb(cx, cy)) return;
    const i = cy * this.w + cx;
    const t = this.fg[i];
    if (!t || !TDEF[t].flammable) return;
    if (this.fire[i] <= 0) { this.fire[i] = rand(3, 5.5); this.burning.add(i); }
  }

  // Burning tiles, or anything else the world reports as fire (burning fuel).
  // who = 'p': the player's own fuel fires don't count. After a hit, fireSrc
  // says what burns ('tile' / 'fuel') and fireTeam who lit it.
  fireAtRect(x, y, w, h, who) {
    const x0 = Math.floor((x - 2) / TILE), x1 = Math.floor((x + w + 2) / TILE);
    const y0 = Math.floor((y - 2) / TILE), y1 = Math.floor((y + h + 2) / TILE);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (this.inb(cx, cy) && this.fire[cy * this.w + cx] > 0) { this.fireSrc = 'tile'; this.fireTeam = 'n'; return true; }
    }
    const team = this.extraFire ? this.extraFire(x, y, w, h, who) : null;
    if (team) { this.fireSrc = 'fuel'; this.fireTeam = team; return true; }
    return false;
  }

  update(dt, fx) {
    // ---- fire
    if (this.burning.size) {
      const w = this.w;
      for (const i of this.burning) {
        const cx = i % w, cy = (i / w) | 0;
        this.fire[i] -= dt;
        this.hp[i] -= dt * 1.6;
        if (Math.random() < dt * 16) fx.flame(cx * TILE + rand(2, 14), cy * TILE + rand(3, 14));
        if (Math.random() < dt * 3) fx.smokePuff(cx * TILE + rand(2, 14), cy * TILE + 2, 0.6);
        if (Math.random() < dt * 1.1) {
          const dir = (Math.random() * 4) | 0;
          const nx = cx + (dir === 0 ? 1 : dir === 1 ? -1 : 0), ny = cy + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
          this.ignite(nx, ny);
        }
        if (this.hp[i] <= 0) this.destroy(cx, cy, 'fire');
        else if (this.fire[i] <= 0) { this.fire[i] = 0; this.burning.delete(i); this.scorch[i] = 1; this.dirty.add(i); }
      }
    }
    // ---- cracking structures: dust trickles out underneath until they give way
    for (let k = this.cracks.length - 1; k >= 0; k--) {
      const c = this.cracks[k];
      c.t += dt;
      const live = c.cells.filter((j) => this.fg[j] && this.cracking.get(j) === c);
      if (live.length && Math.random() < dt * (8 + live.length * 2)) {
        const j = live[(Math.random() * live.length) | 0];
        fx.spawn((j % this.w) * TILE + rand(1, 15), ((j / this.w) | 0) * TILE + TILE - 1, rand(-8, 8), rand(10, 40), rand(0.4, 0.8), rand(1, 2) | 0, '#b8a890', PF.GRAV | PF.FLICKER);
      }
      if (c.t >= c.dur || !live.length) {
        this.cracks.splice(k, 1);
        for (const j of live) { this.cracking.delete(j); this.dirty.add(j); }
        this.detach(live);
      }
    }
    this.processCollapse();
  }

  processCollapse() {
    if (!this.collapseQueue.length) return;
    const q = this.collapseQueue;
    this.collapseQueue = [];
    const w = this.w, h = this.h;
    const checked = new Set();
    for (let k = 0; k < q.length; k += 2) {
      const cx = q[k], cy = q[k + 1];
      if (!this.inb(cx, cy)) continue;
      const start = cy * w + cx;
      if (checked.has(start)) continue;
      const t0 = this.fg[start];
      if (!t0 || TDEF[t0].anchor) continue;
      const seen = new Set([start]);
      const stack = [start];
      let supported = false;
      while (stack.length && !supported) {
        const j = stack.pop();
        const x = j % w, y = (j / w) | 0;
        if (y >= h - 1 || seen.size > 700) { supported = true; break; }
        const nb = [x + 1, y, x - 1, y, x, y + 1, x, y - 1];
        for (let n = 0; n < 8; n += 2) {
          const nx = nb[n], ny = nb[n + 1];
          if (nx < 0 || nx >= w || ny >= h) { supported = true; break; }
          if (ny < 0) continue;
          const nj = ny * w + nx;
          const nt = this.fg[nj];
          if (!nt) continue;
          if (TDEF[nt].anchor) { supported = true; break; }
          if (!seen.has(nj)) { seen.add(nj); stack.push(nj); }
        }
      }
      for (const j of seen) checked.add(j);
      if (!supported) {
        // the whole component lost its support: it creaks for a moment (still solid, so a hero on it
        // can jump off), then falls; cells already creaking keep their own countdown
        const cells = [...seen].filter((j) => !this.cracking.has(j));
        if (!cells.length) continue;
        if (TUNE.crackTime <= 0) { this.detach(cells); continue; }
        const c = { cells, t: 0, dur: TUNE.crackTime * rand(0.9, 1.15) };
        for (const j of cells) { this.cracking.set(j, c); this.dirty.add(j); }
        this.cracks.push(c);
        if (this.onCrack) this.onCrack(c);
      }
    }
  }

  // unsupported cells become falling blocks
  detach(cellList) {
    const w = this.w;
    const cells = [...cellList].sort((a, b) => b - a);
    for (const j of cells) {
      const x = j % w, y = (j / w) | 0;
      const t = this.fg[j], hp = this.hp[j];
      if (!t) continue;
      const burning = this.fire[j] > 0;
      this.fg[j] = 0; this.hp[j] = 0;
      this.clearDecal(j);
      if (burning) { this.fire[j] = 0; this.burning.delete(j); }
      this.markDirty(x, y);
      if (this.onFall) this.onFall(x, y, t, hp, burning);
    }
    for (const j of cells) {
      const x = j % w, y = (j / w) | 0;
      this.collapseQueue.push(x - 1, y, x + 1, y, x, y - 1);
    }
  }

  // ---------------------------------------------------------------- queries
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 6);
    for (let k = 1; k < n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      if (this.solidAt(x, y)) return false;
    }
    return true;
  }

  // find the ground surface (first standable tile) scanning down from py
  groundBelow(px, py, maxDist = 400) {
    const cx = Math.floor(px / TILE);
    for (let cy = Math.floor(py / TILE); cy < this.h && cy * TILE < py + maxDist; cy++) {
      const d = TDEF[this.get(cx, cy)];
      if (d.solid || d.oneway) return cy * TILE;
    }
    return null;
  }

  // ---------------------------------------------------------------- rendering
  buildCanvas() {
    this.canvas = makeCanvas(this.w * TILE, this.h * TILE);
    this.cctx = this.canvas.getContext('2d');
    this.decal = makeCanvas(this.w * TILE, this.h * TILE);
    this.dctx = this.decal.getContext('2d');
    this.decalMark = new Uint8Array(this.w * this.h);
    for (let cy = 0; cy < this.h; cy++) for (let cx = 0; cx < this.w; cx++) this.drawCell(cx, cy);
    this.dirty.clear();
  }

  // the secret vault is drawn as plain dirt until someone breaks in (World.onTileDestroyed)
  unmask() {
    if (!this.mask) return;
    for (const i of this.mask) this.markDirty(i % this.w, (i / this.w) | 0);
    this.mask = null;
  }
  drawCell(cx, cy) {
    const ctx = this.cctx, x = cx * TILE, y = cy * TILE, i = cy * this.w + cx;
    const tiles = this.tiles;
    ctx.clearRect(x, y, TILE, TILE);
    const hid = this.mask;
    if (hid && hid.has(i)) { const s = tiles.fg[T.DIRT]; ctx.drawImage(s[this.vari[i] % s.length], x, y); return; }
    const f = this.fg[i], b = this.bg[i], v = this.vari[i];
    const fd = TDEF[f];
    const crack = this.cracking.size > 0 && this.cracking.has(i); // drawn apart, shaking (see draw)
    if (b && (!f || crack || fd.thin || f === T.SANDBAG)) {
      const set = tiles.bg[b];
      ctx.drawImage(set[v % set.length], x, y);
      if (this.scorch[i]) ctx.drawImage(tiles.scorch, x, y);
      if (b === BG.DIRT) {
        // soft shadow under the ceiling of a cave
        if (this.solid(cx, cy - 1)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y, TILE, 3); }
      }
    }
    if (!f || crack) return;
    const set = tiles.fg[f];
    ctx.drawImage(set[v % set.length], x, y);
    if (fd.solid) {
      // (a hidden vault counts as ground, so no edge gives its shape away)
      const sol = hid ? (xx, yy) => this.solid(xx, yy) || hid.has(yy * this.w + xx) : (xx, yy) => this.solid(xx, yy);
      const up = !sol(cx, cy - 1), down = !sol(cx, cy + 1);
      const left = !sol(cx - 1, cy), right = !sol(cx + 1, cy);
      const capped = up && (f === T.DIRT || f === T.ROCK);
      if (capped) ctx.drawImage(tiles.cap[v & 3], x, y);
      ctx.fillStyle = 'rgba(14,10,8,0.9)';
      if (up && !capped) ctx.fillRect(x, y, TILE, 1);
      if (left) ctx.fillRect(x, y, 1, TILE);
      if (right) ctx.fillRect(x + TILE - 1, y, 1, TILE);
      if (down) {
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + TILE - 3, TILE, 2);
      }
      if (this.scorch[i] && f !== T.BEDROCK) { ctx.globalAlpha = 0.6; ctx.drawImage(tiles.scorch, x, y); ctx.globalAlpha = 1; }
    }
    if (!fd.indestructible && fd.hp) {
      const r = this.hp[i] / fd.hp;
      if (r < 0.34) ctx.drawImage(tiles.crack[1], x, y);
      else if (r < 0.67) ctx.drawImage(tiles.crack[0], x, y);
    }
  }

  flushDirty() {
    if (!this.dirty.size) return;
    for (const i of this.dirty) this.drawCell(i % this.w, (i / this.w) | 0);
    this.dirty.clear();
  }

  draw(ctx, camX, camY, vw, vh) {
    this.flushDirty();
    const cw = this.canvas.width, ch = this.canvas.height;
    let sx = camX, sy = camY, dx = 0, dy = 0, sw = vw, sh = vh;
    if (sx < 0) { dx = -sx; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy; sh += sy; sy = 0; }
    if (sx + sw > cw) sw = cw - sx;
    if (sy + sh > ch) sh = ch - sy;
    if (sw > 0 && sh > 0) {
      ctx.drawImage(this.canvas, sx, sy, sw, sh, dx, dy, sw, sh);
      ctx.drawImage(this.decal, sx, sy, sw, sh, dx, dy, sw, sh);
    }
    // creaking cells shiver in place, more and more, and crack open before they fall
    for (const c of this.cracks) {
      const k = c.t / c.dur, jig = k > 0.4 ? (((c.t * 30) | 0) % 2 ? 1 : -1) : (((c.t * 16) | 0) % 2);
      for (const j of c.cells) {
        const f = this.fg[j];
        if (!f || this.cracking.get(j) !== c) continue;
        const x = (j % this.w) * TILE - camX + jig, y = ((j / this.w) | 0) * TILE - camY;
        if (x < -TILE || y < -TILE || x > vw || y > vh) continue;
        const set = this.tiles.fg[f];
        ctx.drawImage(set[this.vari[j] % set.length], x, y);
        ctx.drawImage(this.tiles.crack[k > 0.5 ? 1 : 0], x, y);
      }
    }
  }
}
