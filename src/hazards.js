'use strict';
// ============================================================================
//  World as a weapon, part 2: spilled fuel and rope bridges.
//
//  Fuel drums and fuel pipes leak when shot (a bullet makes a hole, it never
//  ignites anything). The fuel pools on the ground, runs downhill and over
//  edges. Anything fiery - an explosion, a flame, a burning soldier, burning
//  wood - lights the puddle, the fire races along the trail, and a leaking
//  drum it reaches becomes a torch and then blows. A kicked drum rolls away,
//  leaving a trail if it has holes.
//  Rope bridges hang between two posts: break a post or any plank and the
//  whole span drops, together with whoever is standing on it.
// ============================================================================

const FUEL = {
  DRUM: 6, PIPE: 14,  // fuel inside
  SPREAD: 0.45,       // a puddle cell thicker than this flows to its neighbours
  BURN: 0.8, BURN_AMT: 3.2, // burn time = BURN + amount * BURN_AMT seconds (a thin trail flashes, a pool burns on)
  CATCH: 0.07,        // how fast the fire runs from one cell to the next
};

// one-time hints until the player has tried the thing once (kept in the save)
function tipSeen(k) { const t = Save.data.tips; return !!(t && t[k]); }
function tipDone(k) {
  // the title's demo (src/attract.js) doesn't use up the player's hints
  if (window.world && window.world.demo) return;
  if (!Save.data.tips) Save.data.tips = {};
  if (Save.data.tips[k]) return;
  Save.data.tips[k] = 1; Save.save();
}
// a bobbing arrow over the thing to shoot - no words
function hintArrow(ctx, x, y, t) {
  if (window.world && window.world.demo) return;
  const bob = Math.round(Math.sin(t * 6) * 1.5);
  if (((t * 2.5) | 0) % 4 === 3) return; // blink
  Font.drawOutlined(ctx, '↓', Math.round(x), Math.round(y) + bob, '#ffd23a', 1, 'center');
}

// ---------------------------------------------------------------------------
//  Fuel on the ground: one cell per tile it lies on
// ---------------------------------------------------------------------------
class FuelField {
  constructor(W) { this.W = W; this.cells = new Map(); this.burning = 0; this.loud = 0; this.scareT = 0; this.usedT = -9; }
  key(cx, row) { return row * 4096 + cx; }
  standable(cx, row) { const TR = this.W.terrain; return TR.solid(cx, row) || TR.oneway(cx, row); }
  // first tile the fuel can rest on, at or below row (-1: it drains away)
  surface(cx, row) {
    const TR = this.W.terrain;
    for (let r = Math.max(0, row); r < TR.h && r < row + 16; r++) if (this.standable(cx, r)) return r;
    return -1;
  }
  cell(cx, row) { return this.cells.get(this.key(cx, row)); }
  add(cx, row, amt) {
    if (amt <= 0 || row < 0 || cx < 0 || cx >= this.W.terrain.w) return null;
    const k = this.key(cx, row);
    let c = this.cells.get(k);
    if (!c) { c = { cx, row, amt: 0, fire: 0, ig: -1, igTeam: 'n', team: 'n', seed: (cx * 7 + row * 13) % 17, gone: false }; this.cells.set(k, c); }
    c.amt = Math.min(2, c.amt + amt);
    return c;
  }
  // fuel poured at a point lands on the first surface below it
  pour(x, y, amt) {
    const cx = Math.floor(x / TILE), row = this.surface(cx, Math.floor(y / TILE));
    return row >= 0 ? this.add(cx, row, amt) : null;
  }
  // a burst drum: the rest of its fuel lands around it already burning
  splash(x, feetY, amt, team) {
    const cx = Math.floor(x / TILE);
    for (let dx = -2; dx <= 2; dx++) {
      const row = this.surface(cx + dx, Math.floor((feetY - 4) / TILE));
      if (row < 0 || this.W.terrain.solid(cx + dx, row - 1)) continue;
      const c = this.add(cx + dx, row, amt / 5 * (dx === 0 ? 1.4 : 0.9));
      if (c) this.ignite(c, team);
    }
  }
  ignite(c, team) {
    if (!c || c.gone || c.fire > 0) return;
    c.fire = FUEL.BURN + Math.min(1.5, c.amt) * FUEL.BURN_AMT; c.ig = -1; c.team = team || 'n';
    const W = this.W, px = c.cx * TILE + 8, py = c.row * TILE;
    if (W.onScreen(px, py, 30)) {
      for (let i = 0; i < 3; i++) FX.flame(px + rand(-6, 6), py - rand(1, 5));
      Sound.play('ignite', W.volAt(px, py) * 0.8);
    }
    if (team === 'p' && W.clock - this.usedT > 2) { this.usedT = W.clock; Playtest.use('fuel fire'); tipDone('ignite'); }
  }
  // fire runs to this cell after a short moment
  catchFire(c, team) { if (c && !c.gone && c.fire <= 0 && c.ig < 0) { c.ig = FUEL.CATCH; c.igTeam = team; } }
  igniteCircle(x, y, r, team) {
    if (!this.cells.size) return;
    for (const c of this.cells.values()) {
      if (c.fire > 0) continue;
      if (Math.hypot(c.cx * TILE + 8 - x, c.row * TILE - 2 - y) <= r + 8) this.ignite(c, team);
    }
  }
  igniteRect(x, y, w, h, team) {
    if (!this.cells.size) return;
    for (const c of this.cells.values()) if (c.fire <= 0 && rectsOverlap(x, y, w, h, c.cx * TILE, c.row * TILE - 6, TILE, 8)) this.ignite(c, team);
  }
  igniteAt(x, y, team) {
    if (!this.cells.size) return;
    const cx = Math.floor(x / TILE), r0 = Math.floor(y / TILE);
    for (let r = r0; r <= r0 + 1; r++) {
      const c = this.cells.get(this.key(cx, r));
      if (c && c.fire <= 0 && Math.abs(r * TILE - y) < 14) this.ignite(c, team);
    }
  }
  // Is burning fuel touching this box? Returns who lit it ('p' / 'e' / 'n') or null.
  // who = 'p' ignores the fires the player lit (like his own firebombs).
  fireAt(x, y, w, h, who) {
    if (!this.burning) return null;
    for (const c of this.cells.values()) {
      if (c.fire <= 0 || (who && c.team === who)) continue;
      if (rectsOverlap(x, y, w, h, c.cx * TILE, c.row * TILE - 12, TILE, 12)) return c.team || 'n';
    }
    return null;
  }
  // cells the fire reaches from c: next to it, a tile gap away (spotty trails), or down a ledge
  neighbours(c) {
    const out = [];
    for (let dx = -2; dx <= 2; dx++) for (let dr = -2; dr <= 2; dr++) {
      if (!dx && !dr) continue;
      const n = this.cells.get(this.key(c.cx + dx, c.row + dr));
      if (n) out.push(n);
    }
    return out;
  }
  remove(c) { c.gone = true; this.cells.delete(this.key(c.cx, c.row)); }

  // one hint at a time, on the fuel prop nearest the hero (until he has tried it)
  pickHint() {
    this.hint = null;
    const W = this.W, p = W.player;
    if (!p || p.dead || (tipSeen('leak') && tipSeen('ignite'))) return;
    let best = 211;
    for (const o of W.props) {
      if (!o.isFuel || o.dead || o.torch > 0 || o.fuse >= 0) continue;
      const d = Math.abs(o.cx - p.cx);
      if (d >= best || Math.abs(o.y + o.h - (p.y + p.h)) > 90) continue;
      const text = !o.holes ? (tipSeen('leak') ? null : 'SHOOT: LEAK') : o.fuel > 0.5 && !tipSeen('ignite') ? 'FIRE IT UP!' : null;
      if (text) { best = d; this.hint = { o, text }; }
    }
  }

  update(dt) {
    const W = this.W, TR = W.terrain;
    this.hintT = (this.hintT || 0) - dt;
    if (this.hintT <= 0) { this.hintT = 0.2; this.pickHint(); }
    if (!this.cells.size) {
      if (this.loud) { Sound.loop('flame9', false); this.loud = 0; }
      this.burning = 0;
      return;
    }
    const list = [...this.cells.values()], moves = [];
    let burning = 0, seen = 0, sx = 0, sy = 0;
    // a huge blaze emits the same number of particles as a big one (weak phones)
    const fxK = this.burning > 14 ? 14 / this.burning : 1;
    for (const c of list) {
      if (c.gone) continue;
      // the ground went away (or something landed on the puddle)
      if (!this.standable(c.cx, c.row) || TR.solid(c.cx, c.row - 1)) {
        this.remove(c);
        if (!TR.solid(c.cx, c.row - 1)) {
          const r = this.surface(c.cx, c.row + 1);
          if (r >= 0) { const n = this.add(c.cx, r, c.amt); if (c.fire > 0) this.ignite(n, c.team); }
        }
        continue;
      }
      if (c.ig > 0) { c.ig -= dt; if (c.ig <= 0) { c.ig = -1; this.ignite(c, c.igTeam); } }
      if (c.fire <= 0 && c.amt < 0.004) { this.remove(c); continue; } // a film too thin to matter
      const px = c.cx * TILE, py = c.row * TILE;
      if (c.fire > 0) {
        burning++;
        c.fire -= dt; c.amt = Math.max(0.01, c.amt - dt * 0.2);
        if (W.onScreen(px + 8, py, 40)) {
          seen++; sx += px + 8; sy += py;
          if (Math.random() < dt * (10 + 8 * Math.min(1, c.amt)) * fxK) FX.flame(px + rand(1, 15), py - rand(1, 4));
          if (Math.random() < dt * 0.7 * fxK) FX.smokePuff(px + rand(2, 14), py - 12, 0.5);
        }
        for (const n of this.neighbours(c)) this.catchFire(n, c.team);
        if (Math.random() < dt * 0.8) { TR.ignite(c.cx, c.row); TR.ignite(c.cx, c.row - 1); }
        if (c.fire <= 0) {
          this.remove(c);
          const i = c.row * TR.w + c.cx;
          if (TR.solid(c.cx, c.row) && !TR.scorch[i]) { TR.scorch[i] = 1; TR.dirty.add(i); }
          continue;
        }
      } else if (TR.fire[(c.row - 1) * TR.w + c.cx] > 0 || TR.fire[c.row * TR.w + c.cx] > 0) this.ignite(c, 'n');
      // a thick puddle spreads sideways, and pours over any edge
      if (c.amt > FUEL.SPREAD) {
        for (const dir of [-1, 1]) {
          const nx = c.cx + dir;
          if (nx < 0 || nx >= TR.w || TR.solid(nx, c.row - 1)) continue;
          if (this.standable(nx, c.row)) {
            const n = this.cell(nx, c.row), na = n ? n.amt : 0;
            if (c.amt > na + 0.04) moves.push([c, nx, c.row, (c.amt - na) * 1.6 * dt]);
          } else moves.push([c, nx, this.surface(nx, c.row + 1), c.amt * 1.4 * dt]);
        }
      }
    }
    for (const [c, nx, r, a0] of moves) {
      if (c.gone) continue;
      const a = Math.min(a0, c.amt * 0.45);
      if (a <= 0) continue;
      c.amt -= a;
      if (r < 0) continue; // drained into the void
      const n = this.add(nx, r, a);
      if (c.fire > 0) this.catchFire(n, c.team);
      // pouring down a ledge: drips
      if (r > c.row && W.onScreen(nx * TILE, r * TILE, 30) && Math.random() < 0.25) {
        FX.spawn(nx * TILE + (nx > c.cx ? 1 : 15), c.row * TILE - 1, rand(-8, 8), rand(20, 60), 0.5, 1, '#1c1826', PF.GRAV);
      }
    }
    this.burning = burning;
    // the crackle of a fuel fire (pausing stops all loops, so check the real state), and soldiers backing off from it
    const playing = !!Sound.loops.flame9;
    if ((seen > 0) !== playing || (seen && seen !== this.loud)) Sound.loop('flame9', seen > 0, Math.min(0.9, 0.25 + seen * 0.06));
    this.loud = seen;
    this.scareT -= dt;
    if (seen && this.scareT <= 0) { this.scareT = 0.5; W.scare(sx / seen, sy / seen, 30 + Math.min(60, seen * 6), 0.7); }
  }

  draw(ctx, cx, cy, vw) {
    if (!this.cells.size) return;
    const t = this.W.clock;
    const sheen = ['#8a5aba', '#3a9a9a', '#b89a3a', '#6a6ab8', '#a85a7a'];
    for (const c of this.cells.values()) {
      const x = c.cx * TILE - cx, y = Math.round(c.row * TILE - cy);
      if (x < -TILE || x > vw) continue;
      const a = c.amt, wdt = a >= 0.3 ? TILE : Math.max(3, Math.round(TILE * a / 0.3)), th = a >= 0.3 ? 3 : a >= 0.12 ? 2 : 1;
      const x0 = Math.round(x + (TILE - wdt) / 2);
      ctx.fillStyle = 'rgba(26,16,36,0.45)'; ctx.fillRect(x0, y, wdt, 3); // soaked ground
      ctx.fillStyle = '#1a1426'; ctx.fillRect(x0, y - th, wdt, th);
      if (c.fire > 0) {
        ctx.fillStyle = ((t * 14 + c.seed) | 0) % 2 ? '#ffd23a' : '#ff8a2a';
        ctx.fillRect(x0, y - th - 1, wdt, 1);
        continue;
      }
      ctx.fillStyle = '#4a3a66'; ctx.fillRect(x0, y - th, wdt, 1); // wet shine on top
      if (wdt > 4) {
        // oily rainbow sheen drifting across the surface
        for (let k = 0; k < 2; k++) {
          const s = (c.seed + k * 2 + ((t * 2.5) | 0)) % sheen.length;
          ctx.fillStyle = sheen[s];
          ctx.fillRect(x0 + ((c.seed * 3 + s * 5 + k * 7) % (wdt - 2)), y - th, 2, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
//  Fuel drums (roll, leak, torch, blow) and fuel pipes (leak, torch)
// ---------------------------------------------------------------------------
let FUEL_SPRITES = null;
function fuelSprites() {
  if (FUEL_SPRITES) return FUEL_SPRITES;
  const drum = paintSprite(12, 16, (R) => {
    R(2, 2, 8, 13, '#3e6a3a'); R(3, 2, 2, 13, '#5a8a52'); R(8, 2, 2, 13, '#2a4a28');
    R(2, 1, 8, 1, '#8a8a96'); R(3, 0, 3, 1, '#b8b8c4'); R(2, 14, 8, 1, '#2a2a30');
    R(2, 6, 8, 3, '#e8c547'); R(3, 6, 1, 3, '#15131c'); R(6, 6, 1, 3, '#15131c'); R(9, 6, 1, 3, '#15131c');
    R(5, 10, 2, 2, '#e05a2a'); R(5, 10, 1, 1, '#ffd23a');
  });
  FUEL_SPRITES = { drum, drumFlash: silhouette(drum, '#ffffff') };
  return FUEL_SPRITES;
}

class FuelDrum {
  constructor(x, feetY, kind = 'drum') {
    this.kind = kind;
    const pipe = kind === 'pipe';
    this.w = pipe ? 6 : 10; this.h = pipe ? 26 : 14;
    this.x = x - this.w / 2; this.y = feetY - this.h;
    this.vx = 0; this.vy = 0; this.fuel = pipe ? FUEL.PIPE : FUEL.DRUM;
    this.holes = 0; this.torch = 0; this.fuse = -1; this.owner = 'n';
    this.hittable = true; this.dead = false; this.isFuel = true;
    this.t = Math.random() * 3; this.spin = 0; this.rollT = 0; this.flash = 0; this.tickT = 0;
  }
  get cx() { return this.x + this.w / 2; }
  holeY() { return this.y + (this.kind === 'pipe' ? 10 : 7); }
  update(dt, W) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const pipe = this.kind === 'pipe';
    if (!pipe) {
      this.vy = Math.min(this.vy + GRAVITY * dt, 500);
      if (this.rollT > 0) { this.rollT -= dt; this.spin += this.vx * dt * 0.12; if (this.onGround) this.vx *= Math.pow(0.45, dt); }
      else if (this.onGround) this.vx *= Math.pow(0.02, dt);
      moveBody(this, W.terrain, dt);
      if (this.hitWall) { this.vx = 0; this.rollT = 0; }
      if (this.rollT > 0) {
        for (const e of W.enemies) {
          if (e.dead || e.isBoss || !e.hittable || e.def.static || !overlap(this, e)) continue;
          e.hurt(e.def.heavy ? 1 : 3, { kind: 'melee', dirX: Math.sign(this.vx) || 1, force: 160, team: 'p' });
          this.vx *= -0.3; this.rollT = Math.min(this.rollT, 0.3);
          break;
        }
      }
    } else if (!W.terrain.standableAt(this.cx, this.y + this.h + 1)) {
      this.vy = Math.min(this.vy + GRAVITY * dt, 500); moveBody(this, W.terrain, dt); // its ground was blown away
    }
    // leaking: while a hole burns, the fuel burns right at the hole instead of spilling
    if (this.holes > 0 && this.fuel > 0) {
      const a = Math.min(this.fuel, (0.7 + this.holes * 0.45) * dt);
      this.fuel -= a;
      if (this.torch <= 0) {
        const side = ((this.t * 7) | 0) % 2 ? 1 : -1; // through-and-through: both sides spray
        const reach = this.rollT > 0 ? 1 : 4 + Math.min(this.holes, 4) * 2;
        W.fuel.pour(this.cx + side * (this.w / 2 + reach), this.y + this.h - 4, a);
        if (W.onScreen(this.cx, this.y, 30) && Math.random() < dt * 34) {
          FX.spawn(this.cx + side * this.w / 2, this.holeY(), side * rand(25, 60), rand(-30, 10), 0.35, 1, pick(['#1c1826', '#2a2238', '#3a2f4a']), PF.GRAV);
        }
        if (Math.random() < dt * 1.6) Sound.play('gush', W.volAt(this.cx, this.y) * 0.55);
      }
    }
    if (this.torch > 0) this.updateTorch(dt, W);
    if (this.dead) return;
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (Math.random() < 0.6) FX.flame(this.cx + rand(-3, 3), this.y + rand(0, 6));
      if (this.fuse < 0) { this.explode(W); return; }
    }
    if (this.torch <= 0 && this.fuse < 0 && W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) this.light(W, W.terrain.fireTeam || 'n');
  }
  ignite(team) { const W = window.world; if (W) this.light(W, team); } // fire patches call this
  // set alight: a leaking drum or pipe becomes a torch, a sealed drum cooks off
  light(W, team) {
    if (this.dead || this.torch > 0 || this.fuse >= 0) return;
    if (team && team !== 'n') this.owner = team;
    if (this.holes > 0 && this.fuel > 0.2) {
      this.torch = this.kind === 'pipe' ? 99 : 1.3;
      Sound.play('ignite', W.volAt(this.cx, this.y));
    } else if (this.kind === 'drum') this.fuse = 0.6;
  }
  updateTorch(dt, W) {
    this.torch -= dt;
    const pipe = this.kind === 'pipe', hy = this.holeY(), len = 20 + Math.min(this.holes, 4) * 3;
    const show = W.onScreen(this.cx, this.y, 60);
    for (const side of [-1, 1]) {
      const x0 = this.cx + side * this.w / 2, bx = side > 0 ? x0 : x0 - len;
      if (show && Math.random() < dt * 45) FX.flame(x0 + side * rand(1, len), hy + rand(-3, 3));
      for (const e of W.enemies) {
        if (e.dead || e.isBoss || !rectsOverlap(bx, hy - 6, len, 12, e.x, e.y, e.w, e.h)) continue;
        if (!e.def.static) e.burnStyle = STYLE.flash;
        e.hurt(0.4, { kind: 'fire', dirX: side, team: this.owner });
      }
      if (this.owner !== 'p') {
        for (const p of W.players) if (!p.dead && rectsOverlap(bx, hy - 6, len, 12, p.x, p.y, p.w, p.h)) p.kill('fire', { dirX: side, src: 'fuel torch' });
      }
      W.fuel.igniteRect(bx, hy - 6, len, 18, this.owner);
      for (const o of W.props) {
        if (o === this || o.dead || !rectsOverlap(bx, hy - 6, len, 12, o.x, o.y, o.w, o.h)) continue;
        if (o instanceof Barrel) o.ignite(this.owner);
        else if (o.isFuel) o.light(W, this.owner);
      }
      if (Math.random() < dt * 2) W.terrain.ignite(Math.floor((x0 + side * len * 0.7) / TILE), Math.floor(hy / TILE));
    }
    this.tickT -= dt;
    if (show && this.tickT <= 0) { this.tickT = 0.14; Sound.play('flameTick', W.volAt(this.cx, this.y)); }
    if (pipe) { if (this.fuel <= 0) { this.torch = 0; this.holes = 0; } }
    else if (this.torch <= 0) this.explode(W);
  }
  kick(dir) {
    if (this.kind !== 'drum' || this.dead) return;
    this.owner = 'p'; this.vx = dir * 230; this.vy = -90; this.rollT = 1.6; this.onGround = false;
    Sound.play('punch', 0.7, 0.9);
    Playtest.use('drum kick');
  }
  hurt(dmg, info) {
    if (this.dead) return true;
    const W = window.world;
    if (info.team === 'p') this.owner = 'p';
    if (info.kind === 'explosion') {
      if (this.kind === 'drum') {
        this.fuse = this.fuse >= 0 ? Math.min(this.fuse, 0.15) : rand(0.06, 0.2);
        this.vx += (info.dirX || 0) * 120; this.vy = -160;
      } else { this.holes = Math.min(4, this.holes + 2); if (W) this.light(W, info.team); }
      return true;
    }
    if (info.kind === 'fire') { if (W) this.light(W, info.team); return true; }
    if (info.kind === 'melee' || info.kind === 'crush') { this.kick(info.dirX || 1); return true; }
    // bullets only punch holes (up to four); no spark ever lights the fuel
    this.flash = 0.05;
    if (this.fuel > 0 && this.holes < 4) {
      this.holes++;
      if (info.team === 'p' && this.holes === 1) { Playtest.use('fuel leak'); tipDone('leak'); }
    }
    if (W) {
      Sound.play('metal', W.volAt(this.cx, this.y) * 0.8, this.kind === 'pipe' ? 0.8 : 1.2);
      FX.sparks(this.cx - (info.dirX || 0) * this.w / 2, this.holeY(), 2, -(info.dirX || 0));
    }
    return true;
  }
  explode(W) {
    if (this.dead) return;
    this.dead = true;
    const cx = this.cx, feet = this.y + this.h;
    W.explode(cx, this.y + this.h / 2, 42, { owner: this.owner, dmg: 12, tileDmg: 40, fire: true, env: true, src: 'fuel drum' });
    if (this.fuel > 0.2) W.fuel.splash(cx, feet, this.fuel, this.owner);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), W = window.world;
    if (this.kind === 'pipe') this.drawPipe(ctx, x, y);
    else {
      const S = fuelSprites(), blink = this.flash > 0 || (this.fuse >= 0 && ((this.fuse * 24) | 0) % 2);
      const img = blink ? S.drumFlash : S.drum;
      if (this.spin) {
        ctx.save(); ctx.translate(x + this.w / 2, y + this.h / 2); ctx.rotate(this.spin);
        ctx.drawImage(img, -6, -8); ctx.restore();
      } else ctx.drawImage(img, x - 1, y + this.h - 15);
      // the holes
      if (this.holes && !this.spin) {
        ctx.fillStyle = '#15131c';
        for (let i = 0; i < Math.min(this.holes, 4); i++) ctx.fillRect(x + (i % 2 ? this.w - 3 : 2), y + 5 + (i >> 1) * 3, 1, 1);
      }
    }
    const h = W && !this.dead && W.fuel.hint;
    if (h && h.o === this) hintArrow(ctx, x + this.w / 2, y - 12, this.t);
  }
  drawPipe(ctx, x, y) {
    const fl = this.flash > 0, h = this.h;
    // riser coming out of the ground, a flange and a valve wheel on top
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 1, y + 2, this.w + 2, h - 2); ctx.fillRect(x - 2, y + 15, this.w + 4, 4); ctx.fillRect(x - 3, y - 2, this.w + 6, 4);
    ctx.fillStyle = fl ? '#ffffff' : '#8a8a96'; ctx.fillRect(x, y + 2, this.w, h - 2);
    ctx.fillStyle = fl ? '#ffffff' : '#b8b8c4'; ctx.fillRect(x + 1, y + 2, 1, h - 2);
    ctx.fillStyle = fl ? '#ffffff' : '#5a5a64'; ctx.fillRect(x + this.w - 2, y + 2, 2, h - 2);
    ctx.fillStyle = fl ? '#ffffff' : '#e8c547'; ctx.fillRect(x, y + 11, this.w, 2);
    ctx.fillStyle = fl ? '#ffffff' : '#6e6e7a'; ctx.fillRect(x - 1, y + 16, this.w + 2, 2);
    ctx.fillStyle = fl ? '#ffffff' : '#c0302a'; ctx.fillRect(x - 2, y - 1, this.w + 4, 2); ctx.fillRect(x + 2, y - 3, 2, 2);
    if (this.holes) {
      ctx.fillStyle = '#15131c';
      for (let i = 0; i < Math.min(this.holes, 4); i++) ctx.fillRect(x + (i % 2 ? this.w - 2 : 1), y + 7 + (i >> 1) * 4, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
//  Rope bridges
// ---------------------------------------------------------------------------
class Bridge {
  constructor(W, c0, c1, row) {
    this.W = W; this.c0 = c0; this.c1 = c1; this.row = row;
    this.x = c0 * TILE; this.y = row * TILE - 20; this.w = (c1 - c0 + 1) * TILE; this.h = 20;
    this.alive = true; this.dead = false; this.hittable = false; this.snapT = 0; this.t = 0; this.posts = [];
  }
  has(cx, cy) { return this.alive && cy === this.row && cx >= this.c0 && cx <= this.c1; }
  // a post or a plank gave way: the deck gives first (a creak, splinters, the planks shiver and the
  // ropes sag), then the whole span drops - so the drop has a cause you can see coming
  snap(W, team) {
    if (!this.alive || this.giveT != null) return;
    this.giveT = 0; this.giveTeam = team;
    const TR = W.terrain, crack = { cells: [], t: 0, dur: Infinity }; // shivering planks (Terrain draws them)
    for (let c = this.c0; c <= this.c1; c++) {
      if (TR.get(c, this.row) !== T.PLATFORM) continue;
      const i = this.row * TR.w + c;
      crack.cells.push(i); TR.cracking.set(i, crack); TR.dirty.add(i);
    }
    if (crack.cells.length) TR.cracks.push(crack);
    Sound.play('creak', W.volAt((this.c0 + this.c1 + 1) * TILE / 2, this.row * TILE));
  }
  drop(W, team) {
    this.alive = false; this.snapT = 0;
    const TR = W.terrain, y = this.row * TILE, x0 = this.c0 * TILE, x1 = (this.c1 + 1) * TILE;
    // whoever stood on it: that fall is the bridge's doing
    for (const e of W.enemies) {
      if (e.dead || e.isBoss || e.def.static || e.x + e.w <= x0 || e.x >= x1 || Math.abs(e.y + e.h - y) > 4) continue;
      e.fallStyle = STYLE.bridge; e.awake = true; e.onGround = false;
    }
    for (let c = this.c0; c <= this.c1; c++) {
      if (TR.get(c, this.row) !== T.PLATFORM) continue;
      const i = this.row * TR.w + c, hp = TR.hp[i], burning = TR.fire[i] > 0;
      if (burning) { TR.fire[i] = 0; TR.burning.delete(i); }
      TR.set(c, this.row, T.EMPTY);
      const fb = new FallingBlock(c, this.row, T.PLATFORM, hp, burning);
      fb.soft = true; fb.style = STYLE.bridge; fb.vy = rand(0, 50);
      W.falling.push(fb);
    }
    const mx = (x0 + x1) / 2;
    Sound.play('snap', W.volAt(mx, y)); Sound.play('creak', W.volAt(mx, y) * 0.9);
    FX.debris(mx, y, W.debrisColors('wood'), 6, 0.8);
    W.shake(2.5);
    if (team === 'p') { Playtest.use('bridge'); tipDone('bridge'); }
  }
  update(dt) {
    this.t += dt;
    if (this.alive && this.giveT != null) {
      this.giveT += dt;
      if (Math.random() < dt * 16) FX.debris(rand(this.c0, this.c1 + 1) * TILE, this.row * TILE + 2, this.W.debrisColors('wood'), 1, 0.35);
      if (this.giveT >= Math.min(0.35, Math.max(0.12, TUNE.crackTime * 0.7))) this.drop(this.W, this.giveTeam);
    }
    if (!this.alive) this.snapT += dt;
  }
  draw(ctx, cx, cy) {
    const xl = (this.c0 - 1) * TILE + 8, xr = (this.c1 + 1) * TILE + 8, span = xr - xl;
    const top = this.row * TILE - 17, deck = this.row * TILE;
    if (this.alive) {
      // giving way: the ropes sag deeper and twitch
      const give = this.giveT != null ? this.giveT : 0;
      const sag = Math.min(9, span * 0.05) * (1 + give * 5) + (give > 0 ? ((give * 30) | 0) % 2 : 0);
      const ropeY = (x) => { const k = (x - xl) / span; return top + sag * 4 * k * (1 - k); };
      ctx.fillStyle = '#5a4020';
      for (let x = xl; x < xr; x += 2) ctx.fillRect(Math.round(x - cx), Math.round(ropeY(x) - cy), 2, 1);
      ctx.fillStyle = 'rgba(122,90,48,0.85)';
      for (let c = this.c0; c <= this.c1; c++) {
        const x = c * TILE + 8, ry = ropeY(x);
        ctx.fillRect(Math.round(x - cx), Math.round(ry - cy), 1, Math.round(deck - ry));
      }
      return;
    }
    // snapped: from each post still standing, the rope runs over the rim and
    // hangs down the ravine wall, swinging less and less
    const len = Math.min(56, span * 0.45), sw = Math.max(0, 1 - this.snapT * 0.5);
    ctx.fillStyle = '#a07848';
    this.posts.forEach((p, k) => {
      if (p.broken) return;
      const dir = k === 0 ? 1 : -1, px = (k === 0 ? xl : xr) + dir * 3;
      const edge = k === 0 ? this.c0 * TILE + 1 : (this.c1 + 1) * TILE - 2;
      const steps = Math.max(Math.abs(edge - px), deck - top);
      for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(px + (edge - px) * s / steps - cx), Math.round(top + (deck - top) * s / steps - cy), 1, 1);
      for (let s = 0; s < len; s += 2) {
        const f = s / len, off = dir * (1 + Math.abs(Math.sin(this.snapT * 6 + f * 2.5)) * 7 * sw * f);
        ctx.fillRect(Math.round(edge + off - cx), Math.round(deck + s - cy), 1, 2);
      }
    });
  }
}

class BridgePost {
  constructor(bridge, x, feetY) {
    this.bridge = bridge; this.w = 6; this.h = 22; this.x = x - 3; this.y = feetY - this.h;
    this.hp = 4; this.hittable = true; this.dead = false; this.broken = false; this.flash = 0; this.t = Math.random() * 3;
  }
  get cx() { return this.x + this.w / 2; }
  update(dt, W) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.broken) return;
    if (W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) {
      this.hp -= dt * 1.3;
      if (Math.random() < dt * 10) FX.flame(this.cx + rand(-2, 2), this.y + rand(2, 18));
      if (this.hp <= 0) this.breakPost(W, W.terrain.fireTeam || 'n');
    }
    if (!this.broken && !W.terrain.standableAt(this.cx, this.y + this.h + 1)) this.breakPost(W, 'n');
  }
  hurt(dmg, info) {
    if (this.broken) return true;
    if (info.team === 'e' && info.kind !== 'explosion') return true; // their own rifles don't cut it
    this.hp -= info.kind === 'explosion' ? 99 : dmg;
    this.flash = 0.06;
    const W = window.world;
    if (!W) return true;
    FX.debris(this.cx, this.y + 8, W.debrisColors('wood'), 2, 0.6);
    Sound.play('hitWood', W.volAt(this.cx, this.y));
    if (this.hp <= 0) this.breakPost(W, info.team || 'n');
    return true;
  }
  breakPost(W, team) {
    if (this.broken) return;
    this.broken = true; this.hittable = false;
    FX.debris(this.cx, this.y + 4, W.debrisColors('wood'), 8, 1);
    this.bridge.snap(W, team);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), fl = this.flash > 0;
    if (this.broken) {
      ctx.fillStyle = '#15131c'; ctx.fillRect(x - 1, y + this.h - 8, this.w + 2, 8);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x, y + this.h - 7, this.w, 7);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 1, y + this.h - 9, 1, 2); ctx.fillRect(x + 4, y + this.h - 8, 1, 1);
      return;
    }
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 1);
    ctx.fillStyle = fl ? '#ffffff' : '#7a5530'; ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = fl ? '#ffffff' : '#9a7040'; ctx.fillRect(x + 1, y, 1, this.h);
    ctx.fillStyle = fl ? '#ffffff' : '#553a1e'; ctx.fillRect(x + this.w - 1, y, 1, this.h);
    // rope lashings
    ctx.fillStyle = fl ? '#ffffff' : '#c8a868'; ctx.fillRect(x - 1, y + 4, this.w + 2, 1); ctx.fillRect(x - 1, y + 7, this.w + 2, 1);
    if (this.hp < 4) { ctx.fillStyle = '#15131c'; ctx.fillRect(x + 2, y + 12, 2, 1); if (this.hp < 3) ctx.fillRect(x + 1, y + 15, 3, 1); }
    // first bridge with soldiers on it: point at the weak spot
    const W = window.world, b = this.bridge;
    if (!W || !b.alive || tipSeen('bridge')) return;
    const p = W.player;
    if (!p || Math.abs(p.cx - this.cx) > 200) return;
    const other = b.posts.find((q) => q !== this);
    if (other && !other.broken && Math.abs(p.cx - other.cx) < Math.abs(p.cx - this.cx)) return; // label the nearer post only
    const x0 = b.c0 * TILE, x1 = (b.c1 + 1) * TILE, deck = b.row * TILE;
    if (!W.enemies.some((e) => !e.dead && e.x + e.w > x0 && e.x < x1 && Math.abs(e.y + e.h - deck) < 4)) return;
    hintArrow(ctx, x + this.w / 2, y - 11, this.t);
  }
}
