'use strict';
// ============================================================================
//  Physics helper, projectiles and world props
// ============================================================================

// Axis-separated AABB vs tile-grid movement. Works for bodies of any size as
// long as a single step moves less than one tile.
function moveBody(b, terrain, dt) {
  b.hitWall = 0; b.hitCeil = false;
  if (b.vx !== 0) {
    let nx = b.x + b.vx * dt;
    const dir = b.vx > 0 ? 1 : -1;
    const cx = dir > 0 ? Math.floor((nx + b.w - 0.0001) / TILE) : Math.floor(nx / TILE);
    const cy0 = Math.floor(b.y / TILE), cy1 = Math.floor((b.y + b.h - 0.0001) / TILE);
    for (let cy = cy0; cy <= cy1; cy++) {
      if (terrain.solid(cx, cy)) { nx = dir > 0 ? cx * TILE - b.w : (cx + 1) * TILE; b.hitWall = dir; b.vx = 0; break; }
    }
    b.x = nx;
  }
  const maxX = terrain.w * TILE - b.w;
  if (b.x < 0) { b.x = 0; b.hitWall = -1; if (b.vx < 0) b.vx = 0; }
  else if (b.x > maxX) { b.x = maxX; b.hitWall = 1; if (b.vx > 0) b.vx = 0; }

  b.onGround = false;
  const cx0 = Math.floor(b.x / TILE), cx1 = Math.floor((b.x + b.w - 0.0001) / TILE);
  if (b.vy > 0) {
    let ny = b.y + b.vy * dt;
    const prevBottom = b.y + b.h;
    const cy = Math.floor((ny + b.h - 0.0001) / TILE);
    let land = false;
    for (let cx = cx0; cx <= cx1; cx++) {
      const d = TDEF[terrain.get(cx, cy)];
      if (d.solid) { land = true; break; }
      if (d.oneway && !(b.dropThrough > 0) && prevBottom <= cy * TILE + 0.5) { land = true; break; }
    }
    if (land) { ny = cy * TILE - b.h; b.landVy = b.vy; b.vy = 0; b.onGround = true; }
    b.y = ny;
  } else if (b.vy < 0) {
    let ny = b.y + b.vy * dt;
    const cy = Math.floor(ny / TILE);
    for (let cx = cx0; cx <= cx1; cx++) {
      if (terrain.solid(cx, cy)) { ny = (cy + 1) * TILE; b.vy = 0; b.hitCeil = true; break; }
    }
    b.y = ny;
  } else {
    const bottom = b.y + b.h;
    const cy = Math.floor((bottom + 0.5) / TILE);
    if (Math.abs(cy * TILE - bottom) < 0.6) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const d = TDEF[terrain.get(cx, cy)];
        if (d.solid || (d.oneway && !(b.dropThrough > 0))) { b.onGround = true; break; }
      }
    }
  }
}

// Walk and run frames follow the ground covered, so feet don't slide (1.32): a stride of about 24 px
// at a walk, 34 px at a run (the old fixed rate fitted only a hero at full speed). o.stride: 0..1
function strideStep(o, dt) {
  const v = Math.abs(o.vx);
  o.stride = ((o.stride || 0) + v * dt / (20 + v * 0.14)) % 1;
}

// push a body out of solid tiles (after terrain changes under it)
function unstick(b, terrain) {
  const cx = Math.floor((b.x + b.w / 2) / TILE), cy = Math.floor((b.y + b.h - 2) / TILE);
  if (terrain.solid(cx, cy)) {
    for (let k = 1; k < 4; k++) {
      if (!terrain.solid(cx, cy - k)) { b.y = (cy - k + 1) * TILE - b.h; b.vy = 0; return; }
    }
  }
}

// ----------------------------------------------------------------------------
//  Projectiles
// ----------------------------------------------------------------------------
class Projectile {
  constructor(o) {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.team = 'p'; this.kind = 'bullet';
    this.dmg = 1; this.tileDmg = 3; this.life = 1; this.grav = 0; this.pierce = 0; this.fuse = 0;
    this.bounce = 0; this.radius = 0; this.explodeDmg = 10; this.explodeTile = 40; this.sprite = null;
    this.accel = 0; this.maxSpeed = 0; this.t = 0; this.dead = false; this.hitList = null; this.stuck = false;
    Object.assign(this, o);
    if (this.team === 'p' && (this.kind === 'bullet' || this.kind === 'flame')) this.life *= TUNE.rangeMul;
    // player rounds fly a little slower than real ones so the eye can follow them;
    // they live longer to match, so the reach stays the same
    if (this.team === 'p' && this.kind === 'bullet' && !this.tracer) { const k = TUNE.bulletPace; this.vx *= k; this.vy *= k; this.life /= k; }
    // perks / the rule of the day: rounds that bounce off walls, every Nth round explodes where it lands
    if (this.team === 'p' && this.kind === 'bullet' && !this.tracer) {
      const W = window.world, m = W && W.mods;
      if (m && m.ricochet) this.ricochet = m.ricochet;
      if (m && m.boom && ++W.boomShots >= BOOM_EVERY[Math.min(3, m.boom)]) {
        W.boomShots = 0; this.boomRound = true; this.radius = 13; this.explodeDmg = 4; this.explodeTile = 14;
      }
    }
  }

  update(dt, W) {
    this.t += dt;
    this.life -= dt;
    const k = this.kind;
    if (this.fuse > 0) {
      this.fuse -= dt;
      if (k === 'dynamite' && Math.random() < 0.6) FX.spawn(this.x, this.y - 4, rand(-20, 20), rand(-60, -20), 0.2, 1, '#fff', PF.GRAV, 3);
      if (this.fuse <= 0) { this.detonate(W); return; }
    }
    if (this.life <= 0) {
      if (this.radius > 0) this.detonate(W);
      else this.dead = true;
      return;
    }
    if (k === 'disc') {
      this.spin = (this.spin || 0) + dt * 30;
      const o = this.owner;
      if (o && !this.storm) {
        if (this.phase === 0 && this.t > 0.6 * TUNE.rangeMul) { this.phase = 1; this.hitList = null; }
        if (this.phase === 1) {
          // fly back to the thrower (through walls); caught = ready to throw again
          if (o.dead || o.state === 'extract' || !W.players.includes(o)) { this.dead = true; return; }
          const dx = o.cx - this.x, dy = o.cy - 2 - this.y, d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(440, 250 + this.t * 220);
          this.vx = approach(this.vx, (dx / d) * sp, 2600 * dt); this.vy = approach(this.vy, (dy / d) * sp, 2600 * dt);
          if (d < 10) { this.dead = true; Sound.play('bounce', 0.4, 1.8); return; }
        }
      }
    }
    if (k === 'homing') {
      if (this.t > 0.2) {
        const tg = this.target && !this.target.dead ? this.target : null;
        const tx = tg ? tg.cx : this.x + this.vx, ty = tg ? tg.cy : this.y + 60;
        const a = Math.atan2(this.vy, this.vx), want = Math.atan2(ty - this.y, tx - this.x);
        let da = want - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const na = a + clamp(da, -7 * dt, 7 * dt), sp = Math.min(460, Math.hypot(this.vx, this.vy) + 900 * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      } else this.vy += 500 * dt;
      if (Math.random() < 0.8) FX.spawn(this.x - Math.sign(this.vx) * 2, this.y, rand(-10, 10), rand(-10, 10), rand(0.3, 0.5), 2, '#999', PF.CIRCLE | PF.GROW, 1);
    }
    if (this.accel) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp < this.maxSpeed) { const f = (sp + this.accel * dt) / (sp || 1); this.vx *= f; this.vy *= f; }
    }
    if (k === 'rocket' || k === 'erocket' || k === 'missile') {
      if (Math.random() < 0.9) FX.spawn(this.x - Math.sign(this.vx) * 4, this.y, rand(-10, 10), rand(-10, 10), rand(0.4, 0.8), rand(2, 3), '#888', PF.CIRCLE | PF.GROW | PF.FLICKER, 2);
      if (Math.random() < 0.5) FX.spawn(this.x - Math.sign(this.vx) * 3, this.y, rand(-20, 20), rand(-20, 20), 0.12, 2, '#fff', PF.CIRCLE, 1);
    }
    if (k === 'flame') { this.vx *= Math.pow(this.team === 'p' ? 0.3 : 0.18, dt); this.vy -= 70 * dt; W.fuel.igniteAt(this.x, this.y, this.team); }
    if (k === 'flare' && Math.random() < 0.7) FX.spawn(this.x, this.y - 2, rand(-20, 20), rand(-50, -10), 0.4, 2, '#fff', PF.CIRCLE | PF.SHRINK, 1);
    if (this.stuck) return;
    this.vy += this.grav * dt;

    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 5));
    const sdt = dt / steps;
    const T = W.terrain;
    for (let s = 0; s < steps; s++) {
      const px = this.x, py = this.y;
      this.x += this.vx * sdt; this.y += this.vy * sdt;
      const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);
      const tt = T.get(cx, cy);
      if (TDEF[tt].solid && !(k === 'disc' && this.phase === 1)) {
        if (this.onTile(W, cx, cy, px, py)) return;
      }
      if (this.checkUnits(W)) return;
    }
    // a near miss: the round whizzes past the hero (you hear that you're under fire)
    if (this.team === 'e' && k === 'bullet' && !this.whizzed) {
      for (const p of W.players) {
        if (p.dead) continue;
        const dx = p.cx - this.x, dy = p.cy - this.y;
        if (Math.abs(dy) < 14 && Math.abs(dx) < 16 && Math.sign(dx) !== Math.sign(this.vx)) { this.whizzed = true; Sound.play('whiz', W.volAt(this.x, this.y), rand(0.85, 1.2)); break; }
      }
    }
  }

  // returns true if the projectile is finished
  onTile(W, cx, cy, px, py) {
    const k = this.kind;
    const T = W.terrain;
    if (k === 'disc') {
      T.damage(cx, cy, this.tileDmg, 'bullet');
      FX.sparks(px, py, 2, -Math.sign(this.vx));
      Sound.play('metal', W.volAt(px, py) * 0.4, 1.4);
      if (!this.storm) { this.x = px; this.y = py; this.phase = 1; this.hitList = null; return false; }
    }
    if (this.ricochet > 0 && k === 'bullet') {
      // RICOCHET: the round glances off the wall (chipping it) and flies on
      this.ricochet--;
      T.damage(cx, cy, this.tileDmg * 0.5, 'bullet');
      const pcx = Math.floor(px / TILE), pcy = Math.floor(py / TILE);
      const hx = pcx !== cx && T.solid(cx, pcy), hy = pcy !== cy && T.solid(pcx, cy);
      this.x = px; this.y = py;
      if (hx) this.vx = -this.vx;
      if (hy) this.vy = -this.vy;
      if (!hx && !hy) { this.vx = -this.vx; this.vy = -this.vy; }
      this.life = Math.max(this.life, 0.3); this.hitList = null;
      FX.sparks(px, py, 2, Math.sign(this.vx));
      Sound.play('metal', W.volAt(px, py) * 0.35, 1.6);
      return false;
    }
    if (this.bounce > 0) {
      // reflect on the axis we entered from
      const pcx = Math.floor(px / TILE), pcy = Math.floor(py / TILE);
      this.x = px; this.y = py;
      if (pcx !== cx && !T.solid(cx, pcy)) this.vx = -this.vx * this.bounce;
      else if (pcy !== cy && !T.solid(pcx, cy)) { this.vy = -this.vy * this.bounce; this.vx *= 0.7; }
      else { this.vx = -this.vx * this.bounce; this.vy = -this.vy * this.bounce; }
      if (Math.abs(this.vy) > 40 || Math.abs(this.vx) > 40) Sound.play('bounce', W.volAt(this.x, this.y));
      if (k === 'dynamite' && Math.abs(this.vy) < 60) { this.vx *= 0.5; }
      if (Math.abs(this.vy) < 30 && Math.abs(this.vx) < 20) { this.vx = 0; this.vy = 0; this.stuck = T.solid(Math.floor(this.x / TILE), Math.floor((this.y + 3) / TILE)); }
      return false;
    }
    if (this.radius > 0) { this.x = px; this.y = py; this.detonate(W); return true; }
    if (k === 'flame') {
      T.damage(cx, cy, 0.9, 'fire');
      if (Math.random() < 0.12) T.ignite(cx, cy);
      this.dead = true; return true;
    }
    const d = TDEF[T.get(cx, cy)];
    T.damage(cx, cy, this.tileDmg, 'bullet');
    this.markHole(W, T, cx, cy, d);
    const colors = W.debrisColors(d.debris);
    if (Math.random() < 0.6) FX.debris(px, py, colors, 2, 0.6);
    FX.sparks(px, py, d.debris === 'steel' || d.debris === 'brick' ? 3 : 1, -Math.sign(this.vx));
    if (this.team === 'p') { FX.dust(px, py, 2, -Math.sign(this.vx)); FX.addEffect({ type: 'flash', x: px, y: py, r: 3, dur: 0.07 }); }
    // every material answers with its own sound
    const snd = d.debris === 'steel' ? 'metal' : d.debris === 'wood' ? 'hitWood'
      : (d.debris === 'rock' || d.debris === 'stone' || d.debris === 'brick') ? 'hitStone' : 'hitDirt';
    Sound.play(snd, W.volAt(px, py) * (snd === 'metal' ? 0.6 : 0.85));
    if (this.pierceTiles > 0) { this.pierceTiles--; return false; }
    this.dead = true;
    return true;
  }

  // a bullet hole where the round went in (it goes with the tile); steel and stone may throw a
  // glancing spark that sings off
  markHole(W, T, cx, cy, d) {
    if (!T.solid(cx, cy)) return;
    const hx = clamp(this.x, cx * TILE, cx * TILE + 15), hy = clamp(this.y, cy * TILE, cy * TILE + 15);
    const steel = d.debris === 'steel', hard = steel || d.debris === 'stone' || d.debris === 'rock' || d.debris === 'brick';
    T.addDecal(hx, hy, steel ? '#dfe6ee' : d.debris === 'wood' ? '#2e1c0c' : '#1e1612', 1);
    if (!steel) T.addDecal(hx + (this.vx > 0 ? -1 : 1), hy - 1, 'rgba(0,0,0,0.35)', 1);
    if (hard && this.team === 'p' && Math.random() < 0.3) {
      FX.spawn(this.x - Math.sign(this.vx) * 2, this.y, -this.vx * rand(0.25, 0.45), rand(-160, -40), rand(0.12, 0.22), 1, '#fff', PF.GRAV | PF.TRAIL | PF.ADD, 3);
      Sound.play('ricochet', W.volAt(this.x, this.y) * 0.6, rand(0.8, 1.25));
    }
  }

  checkUnits(W) {
    const x = this.x, y = this.y, k = this.kind;
    const r = k === 'flame' ? 4 : this.team === 'p' ? TUNE.hitRadius : 1;
    if (this.team === 'p') {
      for (const e of W.enemies) {
        if (e.dead || !e.hittable) continue;
        if (k === 'bullet' && e.suppT <= 0 && Math.abs(x - e.cx) < 14 && Math.abs(y - e.cy) < 14) e.suppress();
        if (x + r > e.x && x - r < e.x + e.w && y + r > e.y && y - r < e.y + e.h) {
          if (this.hitList && this.hitList.has(e)) continue;
          if (this.radius > 0) { this.detonate(W); return true; }
          if (k === 'flame') { e.hurt(0.35, { kind: 'fire', dirX: Math.sign(this.vx), team: 'p' }); (this.hitList || (this.hitList = new Set())).add(e); continue; }
          if (e.blocksFrom && e.blocksFrom(this.vx, y)) {
            FX.sparks(x, y, 5, -Math.sign(this.vx)); Sound.play('metal', W.volAt(x, y) * 0.8);
            if (k === 'disc') { (this.hitList || (this.hitList = new Set())).add(e); if (!this.storm) this.phase = 1; else this.vx = -this.vx; continue; }
            this.dead = true; return true;
          }
          e.hurt(this.dmg, { kind: 'bullet', dirX: Math.sign(this.vx), force: this.force || 60, team: 'p', ev: this.ev, style: this.reflected ? STYLE.reflect : null, x, y, freezeMul: this.freezeMul });
          if (e.metal) FX.sparks(x, y, 3, -Math.sign(this.vx)); // armor plate: sparks, not blood
          else { FX.blood(x, y, Math.sign(this.vx), 4); Sound.play('flesh', W.volAt(x, y) * 0.8); }
          FX.addEffect({ type: 'flash', x, y, r: 5, dur: 0.08 });
          if (this.pierce > 0) { this.pierce--; (this.hitList || (this.hitList = new Set())).add(e); continue; }
          this.dead = true; return true;
        }
      }
    } else {
      for (const p of W.players) {
        const c = p.carry;
        if (!c || c.dead || !(x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h)) continue;
        if (this.radius > 0) { this.detonate(W); return true; }
        c.shieldHits = (c.shieldHits || 0) + 1;
        FX.blood(x, y, Math.sign(this.vx), 4); Sound.play('flesh', W.volAt(x, y) * 0.8);
        if (c.shieldHits >= 4) { p.carry = null; c.held = null; c.hurt(99, { kind: 'bullet', dirX: Math.sign(this.vx), team: 'e', style: STYLE.shield }); }
        this.dead = true; return true;
      }
      for (const p of W.players) {
        if (p.dead) continue;
        const ins = TUNE.hurtInset, top = p.y + (p.state === 'slide' ? 8 : ins + 1), l = p.x + ins, rr = p.x + p.w - ins, bot = p.y + p.h - 1;
        if (!(x + r > l && x - r < rr && y + r > top && y - r < bot)) continue;
        if (this.radius > 0) { this.detonate(W); return true; }
        if (p.kill(k === 'flame' ? 'fire' : 'shot', { dirX: Math.sign(this.vx), src: this.src })) { this.dead = true; return true; }
      }
    }
    for (const o of W.props) {
      if (!o.hittable || o.dead) continue;
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
        if (this.radius > 0) { this.detonate(W); return true; }
        if (k === 'flame') { if (o.ignite) o.ignite(this.team); continue; }
        if (k === 'disc') {
          if (this.hitList && this.hitList.has(o)) continue;
          (this.hitList || (this.hitList = new Set())).add(o);
          o.hurt(this.dmg, { kind: 'bullet', dirX: Math.sign(this.vx), team: this.team });
          continue;
        }
        o.hurt(this.dmg, { kind: 'bullet', dirX: Math.sign(this.vx), team: this.team });
        this.dead = true; return true;
      }
    }
    if (this.team === 'p' && k === 'bullet') {
      // bullets can swat incoming rockets and shells out of the air
      for (const q of W.projectiles) {
        if (q.dead || q.team !== 'e' || !(q.kind === 'erocket' || q.kind === 'missile' || q.kind === 'shell')) continue;
        if (Math.abs(q.x - x) < 6 && Math.abs(q.y - y) < 6) {
          q.team = 'p'; q.detonate(W); this.dead = true;
          W.score += 50;
          return true;
        }
      }
    }
    if (this.team === 'p' && k !== 'flame' && k !== 'disc') {
      for (const c of W.corpses) {
        if (c.dead || c.flee) continue;
        if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) { c.hurt(this.dmg, { kind: 'bullet', dirX: Math.sign(this.vx) }); this.dead = true; return true; }
      }
    }
    return false;
  }

  detonate(W) {
    if (this.dead) return;
    this.dead = true;
    const k = this.kind;
    if (k === 'firebomb') { W.firebomb(this.x, this.y, this.team); return; }
    if (k === 'flare') { W.airstrike(this.x, this.team); return; }
    W.explode(this.x, this.y, this.radius, { owner: this.team, dmg: this.explodeDmg, tileDmg: this.explodeTile, fire: this.fire, style: this.reflected ? STYLE.reflect : null, src: this.src, small: this.boomRound });
  }

  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const k = this.kind;
    if (this.sprite) {
      const face = this.vx >= 0 ? 1 : -1;
      if (k === 'missile' || k === 'homing' || k === 'shell' || k === 'erocket' || k === 'rocket') {
        const vert = k === 'missile' || k === 'homing';
        const a = Math.atan2(this.vy, this.vx) - (vert ? Math.PI / 2 : 0);
        ctx.save(); ctx.translate(x, y); ctx.rotate(vert ? a : (face > 0 ? a : a + Math.PI));
        const img = vert ? this.sprite.r : (face > 0 ? this.sprite.r : this.sprite.l);
        ctx.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
        ctx.restore();
      } else {
        const blink = this.fuse > 0 && this.fuse < 0.5 && ((this.fuse * 20) | 0) % 2;
        drawFrame(ctx, this.sprite, x, y + 3, face, false);
        if (blink) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x - 1, y - 1, 2, 2); }
      }
      return;
    }
    switch (k) {
      case 'disc': {
        ctx.drawImage(circleSprite('#15131c', 4), x - 4, y - 4);
        ctx.drawImage(circleSprite(this.storm ? '#9ad8ff' : '#d8dee8', 3), x - 3, y - 3);
        ctx.fillStyle = '#4a4a55'; ctx.fillRect(x - 1, y - 1, 2, 2);
        ctx.fillStyle = '#ffffff';
        if (((this.spin || 0) | 0) % 2) { ctx.fillRect(x - 4, y, 1, 1); ctx.fillRect(x + 3, y - 1, 1, 1); }
        else { ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x - 1, y + 3, 1, 1); }
        break;
      }
      case 'bullet': {
        const d = this.vx > 0 ? 1 : -1;
        if (this.tracer) {
          // sniper round: a bright streak along its path
          const sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp;
          ctx.fillStyle = 'rgba(255,236,190,0.55)';
          for (let k = 2; k < 16; k += 2) ctx.fillRect(Math.round(x - ux * k), Math.round(y - uy * k), 1, 1);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ff4a1a'; ctx.fillRect(x, y, 1, 1);
          break;
        }
        if (this.team === 'p') {
          // a tracer along the flight path: long faint tail, bright core, white-hot tip
          const sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp;
          const seg = (a, b, col) => { ctx.fillStyle = col; for (let s = a; s < b; s++) ctx.fillRect(Math.round(x - ux * s), Math.round(y - uy * s), 1, 1); };
          seg(Math.min(9, (this.t * sp) | 0), Math.min(18, (this.t * sp) | 0), 'rgba(255,214,110,0.28)');
          seg(3, Math.min(9, (this.t * sp) | 0), 'rgba(255,236,160,0.7)');
          const hx = Math.round(x - ux * 2), hy = Math.round(y - uy * 2);
          ctx.fillStyle = '#ffd24a'; ctx.fillRect(Math.min(x, hx) - 1, Math.min(y, hy), Math.abs(x - hx) + 2, Math.abs(y - hy) + 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x - (ux > 0 ? 1 : 0), y, 2, 1);
          if (this.boomRound) { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#fff4a0'; ctx.fillRect(x, y, 1, 1); }
        } else {
          ctx.fillStyle = 'rgba(255,80,40,0.35)'; ctx.fillRect(d > 0 ? x - 11 : x + 3, y, 9, 2);
          ctx.fillStyle = '#3a0804'; ctx.fillRect(x - 3, y - 1, 7, 4);
          ctx.fillStyle = '#ff4a1a'; ctx.fillRect(x - 2, y, 5, 2);
          ctx.fillStyle = '#ffe08a'; ctx.fillRect(d > 0 ? x : x - 1, y, 2, 1);
        }
        break;
      }
      case 'flame': {
        const tt = this.t / (this.t + this.life);
        const r = Math.max(1, Math.round(2 + tt * 5));
        const col = RAMPS[1][Math.min(5, (tt * 6) | 0)];
        ctx.drawImage(circleSprite(col, r), x - r, y - r);
        break;
      }
      default:
        ctx.fillStyle = '#ff5a2a'; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }
}

// ----------------------------------------------------------------------------
//  Props
// ----------------------------------------------------------------------------
class Barrel {
  constructor(x, y, kind = 'barrel') {
    this.kind = kind;
    this.w = kind === 'propane' ? 8 : 10; this.h = 14;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.hp = 3; this.fuse = -1; this.owner = 'n';
    this.hittable = true; this.dead = false; this.launched = false; this.spin = 0; this.rocketT = 0;
  }
  update(dt, W) {
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (Math.random() < 0.5) FX.flame(this.x + this.w / 2 + rand(-3, 3), this.y + rand(0, 6));
      if (this.fuse < 0) { this.explode(W); return; }
    }
    if (this.rocketT > 0) {
      this.rocketT -= dt;
      this.vx = this.rocketDir * 300; this.vy = -25 + Math.sin(this.rocketT * 16) * 30;
      FX.spawn(this.x + this.w / 2 - this.rocketDir * 6, this.y + this.h / 2, -this.rocketDir * rand(60, 110), rand(-20, 20), 0.4, 3, '#fff', PF.CIRCLE | PF.SHRINK, 1);
      this.spin += dt * 20;
      for (const e of W.enemies) {
        if (!e.dead && !e.isBoss && overlap(this, e)) e.hurt(8, { kind: 'crush', dirX: this.rocketDir, force: 260, team: this.owner, style: this.kicked ? STYLE.kick : STYLE.chain });
      }
      if (this.rocketT <= 0) { this.explode(W); return; }
    } else {
      this.vy = Math.min(this.vy + GRAVITY * dt, 500);
      if (this.onGround && !(this.kickT > 0)) this.vx *= Math.pow(0.02, dt);
    }
    if (this.kickT > 0) {
      this.kickT -= dt; this.spin += dt * 18;
      for (const e of W.enemies) if (!e.dead && e.hittable && overlap(this, e)) { this.explode(W); return; }
    }
    moveBody(this, W.terrain, dt);
    // BARREL RAIN: a barrel from the sky flattens the soldier it lands on (never a hero)
    if (this.rain) {
      if (this.vy > 150) for (const e of W.enemies) if (!e.dead && !e.isBoss && e.hittable && overlap(this, e)) { e.hurt(3, { kind: 'crush', dirX: 0, team: 'p' }); this.rain = false; break; }
      if (this.onGround) this.rain = false;
    }
    if ((this.hitCeil || this.hitWall) && (this.rocketT > 0 || this.kickT > 0)) { this.explode(W); return; }
    if (this.kickT > 0 && this.onGround && this.kickT < 1.35) { this.explode(W); return; }
    if (this.onGround && this.launched && this.landVy > 260) { this.explode(W); return; }
    if (this.onGround) this.launched = false;
    if (this.fuse < 0 && W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) this.ignite(W.terrain.fireTeam || 'n');
  }
  ignite(team) { if (this.fuse < 0 && this.rocketT <= 0) { this.owner = team || this.owner; this.fuse = 0.7; } }
  kick(dir) {
    if (this.dead || this.fuse >= 0 || this.rocketT > 0) return;
    this.owner = 'p'; this.kicked = true;
    if (this.kind === 'propane') { this.rocketT = 1.1; this.rocketDir = dir; Sound.play('rocket', 1); return; }
    this.vx = dir * 300; this.vy = -150; this.kickT = 1.5; this.launched = true; this.spin = 0.01;
    Sound.play('punch', 0.8, 0.8);
  }
  hurt(dmg, info) {
    if (this.dead) return true;
    if (info.team) this.owner = info.team;
    if (info.kind === 'explosion') {
      this.vx += (info.dirX || 0) * (info.force || 200) * 0.8; this.vy = -Math.abs(info.force || 200) * 0.9; this.launched = true;
    }
    this.hp -= dmg;
    if (this.hp <= 0 && this.fuse < 0 && this.rocketT <= 0) {
      if (this.kind === 'propane' && info.kind !== 'explosion') { this.rocketT = 1.1; this.rocketDir = info.dirX || (Math.random() < 0.5 ? -1 : 1); Sound.play('rocket', 1); }
      else this.fuse = info.kind === 'explosion' ? rand(0.22, 0.45) : 0.04;
    }
    return true;
  }
  explode(W) {
    if (this.dead) return;
    this.dead = true;
    W.explode(this.x + this.w / 2, this.y + this.h / 2, this.kind === 'propane' ? 34 : 40, { owner: this.owner, dmg: 12, tileDmg: 45, fire: true, env: true, style: this.kicked ? STYLE.kick : null, src: this.kind === 'propane' ? 'propane tank' : 'barrel' });
  }
  draw(ctx, cx, cy) {
    const spr = this.kind === 'propane' ? Sprites.props.propane : Sprites.props.barrel;
    const blink = (this.fuse >= 0 && ((this.fuse * 24) | 0) % 2) || (this.rocketT > 0 && ((this.rocketT * 30) | 0) % 2);
    if (this.spin) {
      ctx.save(); ctx.translate(Math.round(this.x + this.w / 2 - cx), Math.round(this.y + this.h / 2 - cy)); ctx.rotate(Math.sin(this.spin) * 0.4);
      ctx.drawImage(blink ? spr.wr : spr.r, -Math.floor(spr.w / 2), -Math.floor(spr.h / 2)); ctx.restore();
      return;
    }
    drawFrame(ctx, spr, this.x + this.w / 2 - cx, this.y + this.h - cy, 1, blink);
  }
}

class Cage {
  constructor(x, y) {
    this.w = 16; this.h = 26; this.x = x - 8; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.hp = 5; this.hittable = true; this.dead = false; this.t = Math.random() * 3;
    this.isCage = true; this.mood = 'slump'; this.face = 1; this.cowerT = 0;
  }
  update(dt, W) {
    this.t += dt;
    if (this.cowerT > 0) this.cowerT -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    const p = W.touchingPlayer(this);
    if (p) { this.dead = true; W.rescue(p, this.x + this.w / 2, this.y + this.h); }
    // the man inside (1.32): slumped while nobody comes, waving once a hero shows up, jumping up and
    // down when one is close, hands over his ears when something blows up nearby
    const q = W.nearestPlayer(this.x + 8, this.y + 13), mx = this.x + this.w / 2;
    const d = q && !q.isDecoy ? Math.abs(q.cx - mx) : 1e9, dy = q ? Math.abs(q.cy - (this.y + 13)) : 1e9;
    if (q && d < 1e9) this.face = q.cx > mx ? 1 : -1;
    this.mood = this.cowerT > 0 ? 'cower' : d < 90 && dy < 70 ? 'excited' : d < 230 && dy < 140 ? 'wave' : 'slump';
    if (this.mood !== 'cower' && Math.random() < dt * 0.1 && W.onScreen(this.x, this.y, 0)) W.say(this, 'HELP!', 1.0);
  }
  hurt(dmg, info) {
    this.hp -= dmg;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      FX.debris(this.x + 8, this.y + 12, ['#6e6e7a', '#4a4a55', '#8a8a96'], 10, 1);
      Sound.play('metal', 1);
      window.world && window.world.freePrisoner(this.x + this.w / 2, this.y + this.h);
    }
    return true;
  }
  draw(ctx, cx, cy) {
    const set = Sprites.props.prisoner, x = this.x + this.w / 2 - cx, feet = this.y + this.h - 3 - cy;
    let f, hop = 0, face = this.face;
    if (!TUNE.charAnim) { f = set.wave[((this.t * 3) | 0) % 2]; face = 1; }
    else if (this.mood === 'cower') f = set.pose('ears');
    else if (this.mood === 'excited') { f = set.wave[((this.t * 8) | 0) % 2]; hop = Math.round(Math.abs(Math.sin(this.t * 7)) * 2); }
    else if (this.mood === 'wave') f = set.wave[((this.t * 4) | 0) % 2];
    else f = (this.t * 0.35) % 1 < 0.82 ? set.pose('slump') : set.pose('brow'); // now and then he looks out
    // the dark inside of the cage (and its outline), the man, then the bars over him
    const X = Math.round(x) - 10, Y = Math.round(this.y + this.h - cy) - 28;
    ctx.fillStyle = '#15131c'; ctx.fillRect(X, Y + 1, 20, 27); ctx.fillRect(X + 1, Y, 18, 1);
    drawFrame(ctx, f, x, feet - hop, face, false);
    drawFrame(ctx, Sprites.props.cageBars, x, this.y + this.h - cy, 1, false);
  }
}

class Prisoner {
  constructor(x, y) {
    this.w = 10; this.h = 15; this.x = x - 5; this.y = y - this.h;
    this.vx = 0; this.vy = -160; this.t = 0; this.dead = false; this.hittable = false; this.face = 1; this.hopT = 0.9;
  }
  update(dt, W) {
    this.t += dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    const near = W.nearestPlayer(this.x, this.y);
    if (near) this.face = near.x > this.x ? 1 : -1;
    // 1.32: he runs to meet his rescuer if the way is clear (no walk back for the swap), and jumps for
    // joy while he waits
    let walk = 0;
    if (TUNE.charAnim && near && this.onGround && this.t > 0.5) {
      const dx = near.cx - (this.x + this.w / 2), adx = Math.abs(dx), dir = Math.sign(dx), T = W.terrain;
      const ahead = dir > 0 ? this.x + this.w + 1 : this.x - 1;
      if (adx > 8 && adx < 240 && Math.abs(near.cy - (this.y + this.h / 2)) < 40 &&
        !T.solidAt(ahead, this.y + this.h - 4) && !T.solidAt(ahead, this.y + 3) && T.standableAt(ahead, this.y + this.h + 2)) walk = dir * 48;
    }
    if (this.onGround) {
      this.vx = walk || this.vx * 0.8;
      if (!walk && TUNE.charAnim && (this.hopT -= dt) <= 0) { this.hopT = rand(0.7, 1.1); this.vy = -105; }
    }
    moveBody(this, W.terrain, dt);
    if (this.onGround) strideStep(this, dt);
    const p = W.touchingPlayer(this);
    if (p) { this.dead = true; W.rescue(p, this.x + this.w / 2, this.y + this.h); }
  }
  draw(ctx, cx, cy) {
    const set = Sprites.props.prisoner;
    let f;
    if (!TUNE.charAnim) f = set.wave[((this.t * 4) | 0) % 2];
    else if (!this.onGround) f = set.pose(this.t > 0.45 ? 'hang' : 'flail' + (((this.t * 8) | 0) % 2)); // out of the cage, then jumps for joy
    else if (Math.abs(this.vx) > 8) f = set.pose('panic' + (((this.stride || 0) * 4) | 0)); // running over, arms waving
    else f = set.wave[((this.t * 5) | 0) % 2];
    drawFrame(ctx, f, this.x + this.w / 2 - cx, this.y + this.h - cy, this.face, false);
  }
}

class Flag {
  constructor(x, y, kind) {
    this.x = x - 6; this.y = y - 44; this.w = 12; this.h = 44; this.px = x; this.gy = y;
    this.kind = kind; this.raised = false; this.raise = 0; this.t = 0; this.dead = false; this.hittable = false;
  }
  update(dt, W) {
    this.t += dt;
    if (this.raised) this.raise = Math.min(1, this.raise + dt * 1.4);
    if (!this.raised) {
      for (const p of W.players) {
        if (p.dead || p.state === 'extract') continue;
        if (Math.abs(p.x + p.w / 2 - this.px) < 12 && p.y + p.h > this.y && p.y < this.gy + 2) {
          // objective missions: no ride home until the job is done
          if (this.kind === 'extract' && !W.goalDone) { W.flagLocked(); break; }
          this.raised = true; W.onFlag(this); break;
        }
      }
    }
    // the flag collapses if the ground under it disappears
    if (!W.terrain.standableAt(this.px, this.gy + 1)) {
      const g = W.terrain.groundBelow(this.px, this.gy, 300);
      if (g !== null) { this.gy = g; this.y = g - 44; }
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.px - cx), gy = Math.round(this.gy - cy);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 3, gy - 3, 6, 3);
    ctx.fillStyle = '#c8c8d2'; ctx.fillRect(x - 1, gy - 44, 2, 41);
    ctx.fillStyle = '#8a8a96'; ctx.fillRect(x, gy - 44, 1, 41);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - 1, gy - 47, 3, 3);
    const fi = ((this.t * 3) | 0) % 2;
    const P = Sprites.props;
    if (!this.raised) ctx.drawImage(P.flagEnemy[fi], x + 1, gy - 44);
    else {
      const up = easeOutCubic(this.raise);
      ctx.drawImage(P.flagHero[fi], x + 1, Math.round(gy - 14 - up * 30));
    }
    if (this.kind === 'extract' && !this.raised && ((this.t * 2) | 0) % 2) {
      Font.drawOutlined(ctx, '↓', x, gy - 60, '#ffd23a', 1, 'center');
    }
  }
}

class Pickup {
  constructor(x, y, kind = 'ammo') {
    this.kind = kind; this.w = 12; this.h = 10; this.x = x - 6; this.y = y - 10;
    this.vx = rand(-40, 40); this.vy = -180; this.t = 0; this.dead = false; this.hittable = false;
  }
  update(dt, W) {
    this.t += dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    if (this.onGround) this.vx *= 0.85;
    moveBody(this, W.terrain, dt);
    const p = this.t > 0.3 ? W.touchingPlayer(this) : null;
    if (p) { this.dead = true; W.pickup(this, p); }
    if (!this.persistent && this.t > 30) this.dead = true;
  }
  draw(ctx, cx, cy) {
    if (this.secret && window.world && window.world.terrain.mask) return; // still sealed in its vault
    const bob = Math.round(Math.sin(this.t * 5));
    const blink = !this.persistent && this.t > 26 && ((this.t * 10) | 0) % 2;
    const bonus = this.kind === 'bonus';
    drawFrame(ctx, bonus ? Sprites.props.bonus : Sprites.props.ammo, this.x + this.w / 2 - cx, this.y + this.h - cy + (this.onGround ? bob : 0), 1, blink);
    if (bonus && ((this.t * 3) | 0) % 3 === 0) {
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(this.x - cx) + ((this.t * 7) | 0) % 12, Math.round(this.y - cy) - 2 + (this.onGround ? bob : 0), 1, 1);
    }
  }
}

class FallingBlock {
  constructor(cx, cy, type, hp, burning) {
    this.cx = cx; this.y = cy * TILE; this.startY = this.y; this.type = type; this.hp = hp; this.vy = 0; this.dead = false; this.burning = burning;
    this.x = cx * TILE; this.w = TILE; this.h = TILE;
  }
  update(dt, W) {
    this.vy = Math.min(this.vy + GRAVITY * TUNE.worldGrav * dt, 520);
    this.y += this.vy * dt;
    const T = W.terrain;
    const below = Math.floor((this.y + TILE) / TILE);
    if (this.burning && Math.random() < dt * 20) FX.flame(this.x + rand(2, 14), this.y + rand(2, 14));
    // crush things; on a hero's head the block breaks up (a hit point, not a burial)
    // (bridge planks are light: they flatten soldiers underneath but never a hero)
    if (this.vy > 110 && W.crush(this.x + 1, this.y + 4, TILE - 2, TILE - 4, this)) {
      this.dead = true;
      FX.debris(this.x + 8, this.y + 8, W.debrisColors(TDEF[this.type].debris), 8, 0.8);
      FX.dust(this.x + 8, this.y + 12, 5);
      Sound.play('crumble', W.volAt(this.x, this.y) * 0.8);
      return;
    }
    if (below >= T.h || T.solid(this.cx, below)) {
      const row = below - 1;
      this.y = row * TILE;
      this.dead = true;
      const d = TDEF[this.type];
      const shatter = this.vy > 300 || d.fragile || (d.thin && this.vy > 150) || T.get(this.cx, row) !== 0;
      const colors = W.debrisColors(d.debris);
      if (shatter) {
        FX.debris(this.x + 8, this.y + 8, colors, 8, 0.8);
        FX.dust(this.x + 8, this.y + 16, 7);
        if (this.vy > 250 && W.onScreen(this.x, this.y, 0)) W.shake(1.5);
        Sound.play('crumble', W.volAt(this.x, this.y) * 0.8);
      } else {
        T.set(this.cx, row, this.type);
        T.hp[row * T.w + this.cx] = Math.min(this.hp, d.hp) * 0.75;
        T.collapseQueue.push(this.cx, row);
        if (this.burning) T.ignite(this.cx, row);
        FX.dust(this.x + 8, this.y + 16, 5);
        if (this.vy > 150) Sound.play('crumble', W.volAt(this.x, this.y) * 0.5);
      }
    }
  }
  draw(ctx, cx, cy) {
    const set = W_TILES().fg[this.type];
    if (!set) return;
    ctx.drawImage(set[this.cx % set.length], Math.round(this.x - cx), Math.round(this.y - cy));
  }
}
function W_TILES() { return window.world ? window.world.terrain.tiles : Sprites.tiles.jungle; }

// The mad bomber's bomb (1.34: a round cartoon bomb, not the old dynamite vest): a shine, a cap, a
// short fuse and a spark that flickers at `rate` per second. x, y = its middle in screen pixels
function drawBomb(ctx, x, y, t, rate) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#15131c';
  ctx.fillRect(x - 2, y - 4, 5, 9); ctx.fillRect(x - 3, y - 3, 7, 7); ctx.fillRect(x - 4, y - 2, 9, 5);
  ctx.fillStyle = '#2e2c3a';
  ctx.fillRect(x - 1, y - 3, 3, 7); ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillRect(x - 3, y - 1, 7, 3);
  ctx.fillStyle = '#6a6882'; ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x - 1, y - 3, 1, 1);
  ctx.fillStyle = '#9a9aa6'; ctx.fillRect(x, y - 5, 2, 1);
  ctx.fillStyle = '#c8a060'; ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x + 2, y - 7, 1, 1);
  if (((t * rate) | 0) % 2) {
    ctx.fillStyle = '#fff6b0'; ctx.fillRect(x + 2, y - 10, 1, 3); ctx.fillRect(x + 1, y - 9, 3, 1);
    ctx.fillStyle = '#ffae3a'; ctx.fillRect(x + 2, y - 9, 1, 1);
  } else { ctx.fillStyle = '#ffae3a'; ctx.fillRect(x + 2, y - 8, 1, 1); }
}

class Corpse {
  constructor(frameSet, x, y, w, face, vx, vy, burnt) {
    this.set = frameSet; this.w = 12; this.h = 6; this.x = x - 6; this.y = y - 6;
    this.face = face; this.vx = vx; this.vy = vy; this.t = 0; this.dead = false; this.burnt = burnt; this.hp = 4;
    this.rot = 0; this.spinV = vx * 0.02; this.bigW = w;
    this.flashT = 0.09; // the hit itself: the body shows white for a moment
  }
  update(dt, W) {
    if (this.flee) { this.updateFlee(dt, W); return; }
    this.t += dt;
    if (this.fuse > 0) {
      this.fuse -= dt;
      if (Math.random() < 0.6) FX.spawn(this.x + 6, this.y, rand(-30, 30), rand(-60, -20), 0.2, 1, '#fff', PF.GRAV, 3);
      if (this.blast === 'flamer') { if (Math.random() < 0.7) FX.flame(this.x + 6 + rand(-3, 3), this.y - rand(0, 4)); } // the tank hisses and leaks flame
      else if (((this.fuse * 8) | 0) !== this.lastBeep) { this.lastBeep = (this.fuse * 8) | 0; Sound.play('beep', W.volAt(this.x, this.y) * 0.6); }
      if (this.fuse <= 0) {
        this.dead = true;
        if (this.blast === 'flamer') { W.explode(this.x + 6, this.y + 3, 30, { owner: 'e', dmg: 10, tileDmg: 18, fire: true, src: 'flamer tank' }); W.props.push(new FirePatch(this.x + 6, this.y + 6, 44, 2.4, 'e')); }
        else W.explode(this.x + 6, this.y + 3, 34, { owner: 'e', dmg: 12, tileDmg: 40, src: 'bomber bomb' });
        return;
      }
    }
    if (this.flashT > 0) this.flashT -= dt;
    // a lighter pull than on the living: the flight of a hit body is long enough to follow
    this.vy = Math.min(this.vy + GRAVITY * TUNE.worldGrav * (Math.abs(this.vy) < 50 ? 0.55 : 1) * dt, 500);
    moveBody(this, W.terrain, dt);
    if (this.onGround) { this.vx *= Math.pow(0.01, dt); if (this.landVy > 150) { this.vy = -this.landVy * 0.3; this.landVy = 0; FX.dust(this.x + 6, this.y + this.h, 2); } }
    if (this.hitWall) { this.vx = -this.vx * 0.3; this.bowl = 0; }
    if (this.bowl > 0 && Math.abs(this.vx) > 150) {
      for (const e of W.enemies) {
        if (e.dead || e.isBoss || !e.hittable || e.def.static || (this.hitSet && this.hitSet.has(e))) continue;
        if (!rectsOverlap(this.x - 1, this.y - 8, this.w + 2, this.h + 8, e.x, e.y, e.w, e.h)) continue;
        (this.hitSet || (this.hitSet = new Set())).add(e);
        e.hurt(e.def.heavy ? 3 : 99, { kind: 'melee', dirX: Math.sign(this.vx), force: 260, team: 'p', style: STYLE.bowl, bowl: true, ev: this.ev });
        this.vx *= 0.8; this.bowl--;
        W.freeze(0.03); Sound.play('punch', W.volAt(this.x, this.y));
        if (this.bowl <= 0) break;
      }
    }
    if (this.onGround && Math.abs(this.vx) < 60) this.bowl = 0;
    this.rot = this.onGround ? approach(this.rot, Math.PI / 2 * -this.face, dt * 8) : this.rot + this.spinV * dt * 4;
    if (!this.burnt && W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) this.burnt = true;
    if (this.t > 9) this.dead = true;
  }
  // a dog that's been hit (1.34): it tumbles, lands on its feet and runs off the screen, away from the
  // heroes; nothing hits it any more (bullets fly past, kicks and blows miss) - it's out of the fight
  updateFlee(dt, W) {
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    this.vy = Math.min(this.vy + GRAVITY * TUNE.worldGrav * dt, 500);
    if (this.onGround && this.t > 0.35) {
      this.running = true; this.face = this.flee;
      this.vx = approach(this.vx, this.flee * 190, 900 * dt);
      if (this.hitWall) this.vy = -230; // a hop over a step
    }
    moveBody(this, W.terrain, dt);
    if ((this.running && !W.onScreen(this.x + 6, this.y, 24)) || this.t > 6) this.dead = true;
  }
  kick(dir, W) {
    if (this.flee) return;
    this.vx = dir * 310; this.vy = -150; this.onGround = false; this.bowl = 3; this.spinV = dir * 6;
    this.t = Math.min(this.t, 5); this.hitSet = null; this.ev = ++W.evSeq;
    FX.blood(this.x + 6, this.y + 3, dir, 3);
  }
  hurt(dmg, info) {
    if (this.flee) return false;
    if (this.fuse > 0 && info.kind === 'explosion') { this.fuse = 0.01; return true; }
    this.hp -= dmg;
    FX.blood(this.x + 6, this.y + 3, info.dirX || 0, 3);
    if (info.kind === 'bullet') {
      // every round pops the body up: keep it in the air and it's a juggle
      if (!this.onGround) this.juggle = (this.juggle || 0) + 1;
      this.vx = this.vx * 0.5 + (info.dirX || 0) * 45; this.vy = Math.min(this.vy, this.onGround ? -130 : -160); this.onGround = false; // a pop, not a rocket
      this.spinV += (info.dirX || 1) * 2.5;
    } else { this.vx += (info.dirX || 0) * 30; this.vy -= 40; }
    if (!Settings.gore() && info.kind === 'explosion') {
      // bloodless: a blast knocks the body around instead of tearing it apart
      this.vx = (info.dirX || 0) * Math.min(220, (info.force || 200) * 0.6); this.vy = -rand(200, 260);
      this.onGround = false; this.spinV = (info.dirX || 1) * rand(4, 7);
      return true;
    }
    // shot to pieces (bloodless: FX.gibs is only a puff of smoke) - either way bodies never soak up
    // bullets for good
    if (this.hp <= 0 || info.kind === 'explosion') {
      this.dead = true; FX.gibs(this.x + 6, this.y + 3, ['#b8302a', '#4c515c', '#d8a47c'], info.dirX || 0, 6);
      const W = window.world;
      if (W && this.juggle >= 2) {
        const bonus = Math.round(STYLE.juggle[1] * this.juggle * W.skill.score);
        W.score += bonus; Sound.play('style', 0.8);
      }
    }
    return true;
  }
  draw(ctx, cx, cy) {
    if (this.flee) {
      const d = this.set, f = !this.onGround ? d.jump : this.running ? d.run[((this.t * 16) | 0) % 4] : d.idle[0];
      drawFrame(ctx, f, this.x + 6 - cx, this.y + this.h - cy, this.running ? this.face : -this.flee, this.flashT > 0);
      return;
    }
    if (this.t > 8 && ((this.t * 10) | 0) % 2) return;
    if (this.fuse > 0 && this.blast === 'flamer') {
      if (((this.fuse * 10) | 0) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.round(this.x + 5 - cx), Math.round(this.y - 2 - cy), 3, 3); }
    } else if (this.fuse > 0) drawBomb(ctx, this.x + 6 + this.face * 8 - cx, this.y + this.h - 4 - cy, this.fuse, 10); // dropped, still lit - get clear!
    const s = this.set;
    const f = !TUNE.charAnim || !s.pose ? s.fall || s.idle[0] : s.pose((this.t < 0.14 ? 'hurt' : 'dead') + (this.hatOff ? '~' : ''));
    const img = this.flashT > 0 ? (f.whiteR || (f.whiteR = silhouette(f.r, '#ffffff')))
      : this.burnt ? (f.silR || (f.silR = silhouette(f.r, '#1c1614'))) : f.r;
    ctx.save();
    ctx.translate(Math.round(this.x + this.w / 2 - cx), Math.round(this.y + this.h - cy - 3));
    ctx.rotate(this.rot);
    if (this.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -f.ax, -f.ay + 5);
    ctx.restore();
  }
}

// A hat knocked off by the blow that killed its wearer (1.32): it tumbles, bounces (a helmet clinks)
// and lies there a while - the death's follow-through. Drawn from the wearer's own sprite (buildHat)
class Hat {
  constructor(set, feetX, feetY, face, vx, vy) {
    const h = set.hat();
    this.img = h; this.metal = set.hatMetal; this.face = face;
    this.w = 4; this.h = 3;
    const hx = h ? feetX + face * (h.ox + h.w / 2) : feetX, hy = h ? feetY + h.oy + h.h / 2 : feetY - 14;
    this.x = hx - 2; this.y = hy - 1.5; this.vx = vx; this.vy = vy;
    this.rot = 0; this.spin = (vx >= 0 ? 1 : -1) * rand(7, 13); this.t = 0; this.bounces = 0;
    this.dead = !h; this.hittable = false;
  }
  update(dt, W) {
    this.t += dt;
    this.vy = Math.min(this.vy + GRAVITY * TUNE.worldGrav * dt, 420);
    moveBody(this, W.terrain, dt);
    if (this.hitWall) this.vx = -this.vx * 0.4;
    if (this.onGround) {
      if (this.landVy > 70 && this.bounces < 2) {
        this.bounces++; this.vy = -this.landVy * 0.38; this.onGround = false; this.spin *= 0.6;
        if (this.metal) FX.tink(this.x + 2, this.y + 2, '#c8c8d2');
      } else {
        this.vx *= Math.pow(0.02, dt);
        this.rot = approach(this.rot, Math.round(this.rot / Math.PI) * Math.PI, dt * 10); // settles upright or upside down
      }
      this.landVy = 0;
    } else this.rot += this.spin * dt;
    if (this.t > 7) this.dead = true;
  }
  draw(ctx, cx, cy) {
    const h = this.img;
    if (!h || (this.t > 6 && ((this.t * 10) | 0) % 2)) return;
    ctx.save();
    ctx.translate(Math.round(this.x + 2 - cx), Math.round(this.y + 1.5 - cy)); ctx.rotate(this.rot);
    ctx.drawImage(this.face >= 0 ? h.r : h.l, -Math.round(h.w / 2), -Math.round(h.h / 2));
    ctx.restore();
  }
}

// A paratrooper's canopy once he's down (1.32): it sinks over him, drifts aside, crumples and fades
class Canopy {
  constructor(x, feetY, dir) { this.x = x; this.y = feetY; this.dir = dir || 1; this.t = 0; this.dead = false; this.hittable = false; this.w = 1; this.h = 1; }
  update(dt) { this.t += dt; if (this.t > 1.25) this.dead = true; }
  draw(ctx, cx, cy) {
    if (this.t > 0.95 && ((this.t * 16) | 0) % 2) return;
    const k = easeOutCubic(Math.min(1, this.t / 0.75)), off = Math.round(k * 8 * this.dir);
    const w = Math.round(22 + k * 8), h = Math.max(2, Math.round(5 - k * 3)), top = Math.round(this.y - 39 + k * 36 - cy);
    const x = Math.round(this.x - cx) + off - (w >> 1);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 1, top - 1, w + 2, h + 2);
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = '#c0302a'; ctx.fillRect(x + (w >> 1) - 3, top, 6, h);
  }
}

// Friendly transport helicopter: drops the hero in, and extracts at the end.
class Chopper {
  // from (optional): { x: where it flies in from, delay: seconds before it sets off, dur: flight time }
  constructor(W, mode, tx, ty, onArrive, from) {
    this.mode = mode; this.tx = tx; this.ty = ty; this.onArrive = onArrive;
    const fromLeft = mode !== 'extract';
    this.x = from && from.x != null ? from.x : fromLeft ? W.cam.x - 60 : W.cam.x + Gfx.W + 60;
    this.y = ty - 40;
    this.sx = this.x; this.sy = this.y;
    this.t = from && from.delay ? -from.delay : 0; this.dur = (from && from.dur) || (mode === 'extract' ? 2.2 : 1.3);
    this.state = 'in'; this.dead = false; this.ladder = 0; this.face = fromLeft ? 1 : -1; this.arrived = false;
    this.w = 60; this.h = 26;
  }
  update(dt, W) {
    this.t += dt;
    Sound.loop('heli', true, W.volAt(this.x, this.y));
    if (this.state === 'in') {
      const k = Math.max(0, Math.min(1, this.t / this.dur));
      const e = easeOutCubic(k);
      this.x = lerp(this.sx, this.tx, e);
      this.y = lerp(this.sy, this.ty, e) + Math.sin(this.t * 3) * 2;
      if (k >= 1) { this.state = 'hover'; this.t = 0; if (this.mode !== 'extract' && this.onArrive) this.onArrive(this); }
    } else if (this.state === 'hover') {
      this.y = this.ty + Math.sin(this.t * 3) * 2;
      if (this.mode === 'extract') {
        this.ladder = Math.min(64, this.ladder + dt * 60);
        const boarder = this.ladder > 20 && W.players.find((p) => !p.dead && p.state !== 'extract' &&
          rectsOverlap(p.x, p.y, p.w, p.h, this.x - 4, this.y, 8, this.ladder + 4));
        if (boarder) {
          // one hero on the ladder takes the whole squad home
          for (const p of W.players) if (!p.dead) { if (p.mech) p.exitMech(); if (p.carry) p.throwCarry(); p.state = 'extract'; p.vx = 0; p.vy = 0; }
          this.state = 'leave'; this.t = 0; this.sx = this.x; this.sy = this.y;
          if (this.onArrive) this.onArrive(this);
        }
      } else if (this.t > 0.6) { this.state = 'leave'; this.t = 0; this.sx = this.x; this.sy = this.y; }
    } else if (this.state === 'leave') {
      const dir = this.mode === 'extract' ? 1 : -1;
      this.x = this.sx + dir * this.t * this.t * 90;
      this.y = this.sy - this.t * this.t * 60 - this.t * 20;
      if (this.mode === 'extract') {
        let k = 0;
        for (const p of W.players) {
          if (p.state !== 'extract') continue;
          p.x = this.x - p.w / 2 + (k % 2 ? 3 : 0);
          p.y = this.y + Math.max(4, this.ladder - 20 - this.t * 30) - k * 14;
          k++;
        }
      }
      if (this.t > 3.5) { this.dead = true; Sound.loop('heli', false); }
    }
  }
  draw(ctx, cx, cy) {
    const f = Sprites.props.heli[((Math.abs(this.t) * 30) | 0) % 3];
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.ladder > 0) {
      const lx = x - 3, top = y - 4;
      ctx.fillStyle = '#6a5030';
      ctx.fillRect(lx, top, 1, this.ladder); ctx.fillRect(lx + 6, top, 1, this.ladder);
      ctx.fillStyle = '#a07848';
      for (let r = 4; r < this.ladder; r += 5) ctx.fillRect(lx, top + r, 7, 1);
    }
    drawFrame(ctx, f, x, y, this.face, false);
  }
}

class Sign {
  constructor(x, y, key) { this.x = x; this.y = y; this.key = key; this.dead = false; this.hittable = false; this.w = 1; this.h = 1; }
  update() {}
  // where the board is on screen (labels over the world keep clear of it)
  layout(cx, cy) {
    const rows = signParts(this.key);
    if (!rows) return null;
    const x = Math.round(this.x - cx), gy = Math.round(this.y - cy);
    const rw = rows.map((r) => r.reduce((a, q) => a + signPartW(q), 0) + (r.length - 1) * 3);
    const wdt = Math.max(...rw) + 10, hgt = rows.length * 14 + 4;
    return { rows, rw, x, gy, wdt, hgt, top: gy - 18 - hgt, bx: Math.round(x - wdt / 2) };
  }
  board(cx, cy) { const l = this.layout(cx, cy); return l ? { x: l.bx - 1, y: l.top - 1, w: l.wdt + 2, h: l.hgt + 2 } : null; }
  // (1.27) keys and little pictures instead of sentences, as few words as it takes
  draw(ctx, cx, cy) {
    const l = this.layout(cx, cy);
    if (!l) { this.drawText(ctx, cx, cy); return; }
    const { rows, rw, x, gy, wdt, hgt, top, bx } = l;
    ctx.fillStyle = '#4a3522'; ctx.fillRect(x - 1, top + hgt, 3, gy - top - hgt);
    ctx.fillStyle = '#15131c'; ctx.fillRect(bx - 1, top - 1, wdt + 2, hgt + 2);
    ctx.fillStyle = '#e8d6a8'; ctx.fillRect(bx, top, wdt, hgt);
    ctx.fillStyle = '#c8b488'; ctx.fillRect(bx, top + hgt - 2, wdt, 2);
    rows.forEach((r, i) => {
      let px = Math.round(x - rw[i] / 2);
      for (const q of r) { drawSignPart(ctx, q, px, top + 3 + i * 14); px += signPartW(q) + 3; }
    });
  }
  drawText(ctx, cx, cy) {
    const text = signText(this.key);
    const lines = text.split('\n');
    const wdt = Math.max(...lines.map((l) => Font.pxWidth(l))) + 8;
    const hgt = lines.length * 9 + 5;
    const x = Math.round(this.x - cx), gy = Math.round(this.y - cy);
    const top = gy - 18 - hgt;
    ctx.fillStyle = '#4a3522'; ctx.fillRect(x - 1, top + hgt, 3, gy - top - hgt);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - wdt / 2 - 1, top - 1, wdt + 2, hgt + 2);
    ctx.fillStyle = '#e8d6a8'; ctx.fillRect(x - wdt / 2, top, wdt, hgt);
    ctx.fillStyle = '#c8b488'; ctx.fillRect(x - wdt / 2, top + hgt - 2, wdt, 2);
    lines.forEach((l, i) => Font.draw(ctx, l, x, top + 4 + i * 9, '#2a1e14', 1, 'center'));
  }
}

// what each tutorial sign shows: keys (the player's own bindings, or the touch / pad buttons),
// short marks and little pictures
function signParts(key) {
  const touch = Input.mode === 'touch', pad = Input.mode === 'gamepad', K = (a) => Settings.keyLabel(a, 1);
  const k = (l) => ['k', l], t = (s) => ['t', s], i = (n) => ['i', n];
  const b = (a, tl, pl) => k(touch ? tl : pad ? pl : K(a));
  switch (key) {
    case 'move': return touch ? [[t('◀'), k('DRAG'), t('▶')]] : pad ? [[t('◀'), k('STICK'), t('▶')]] : [[t('◀'), k(K('left')), k(K('right')), t('▶')]];
    case 'jump': return touch || pad ? [[b('jump', 'JUMP', 'A'), t('↑')]] : [[k(K('up')), k(K('jump')), t('↑')]];
    case 'shoot': return [[b('fire', 'FIRE', 'X'), t('▶'), i('barrel'), i('barrel')]];
    case 'dig': return [[b('fire', 'FIRE', 'X'), t('▶'), i('dirt'), i('dirt')]];
    case 'slide': return [[t('RUN +'), b('down', '▼', '↓'), t('▶ SLIDE')]];
    case 'rescue': return [[i('cage'), t('▶'), i('life'), t('+1')]];
    case 'climb': return [[i('wall'), b('right', '▶', '▶'), t('↑')], [b('left', '◀', '◀'), t('TURN + SHOOT')]];
    case 'special': return [[b('special', 'SPEC', 'B'), t('▶'), i('grenade')], [b('melee', 'KNIFE', 'Y'), t('▶'), i('barrel')]];
    case 'knife': return [[b('melee', 'KNIFE', 'Y'), t('▶'), i('knife')], [t('HOLD'), b('melee', 'KNIFE', 'Y'), t('= GRAB')]];
    case 'ladder': return [[b('up', '▲', '↑'), t('↑'), i('ladder')]];
    case 'stomp': return [[b('jump', 'JUMP', 'A'), t('▶ ↓'), i('head')]];
    case 'flag': return [[i('flag'), t('= CHECKPOINT')]];
    case 'extract': return [[i('flag'), t('▶'), i('chopper')]];
  }
  return null;
}
const SIGN_ICON_W = { barrel: 8, dirt: 10, cage: 9, life: 9, grenade: 6, wall: 9, ladder: 7, flag: 8, chopper: 16, head: 14, knife: 9 };
function signPartW(q) { return q[0] === 'k' ? Font.pxWidth(q[1]) + 6 : q[0] === 't' ? Font.pxWidth(q[1]) : SIGN_ICON_W[q[1]] || 8; }
function drawSignPart(ctx, q, x, y) {
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  if (q[0] === 'k') {
    // a key: light top face, darker front edge
    const w = Font.pxWidth(q[1]) + 6;
    R(-1, -1, w + 2, 13, '#15131c'); R(0, 0, w, 11, '#8e8aa3'); R(0, 0, w, 9, '#e4e1ef'); R(1, 0, w - 2, 1, '#ffffff');
    Font.draw(ctx, q[1], x + Math.round(w / 2), y + 1, '#2a2638', 1, 'center');
    return;
  }
  if (q[0] === 't') { Font.draw(ctx, q[1], x, y + 2, '#2a1e14'); return; }
  const P = Sprites.props;
  switch (q[1]) {
    case 'barrel': R(0, 0, 8, 11, '#15131c'); R(1, 1, 6, 9, '#b8302a'); R(1, 3, 6, 1, '#e8c547'); R(1, 7, 6, 1, '#e8c547'); R(2, 1, 1, 9, '#e0584a'); break;
    case 'dirt': R(0, 1, 10, 10, '#15131c'); R(1, 2, 8, 8, '#6b4a2a'); R(1, 2, 8, 2, '#4f8a3a'); R(3, 6, 1, 1, '#8a6a3a'); R(6, 5, 1, 1, '#8a6a3a'); R(5, 8, 1, 1, '#3a2a18'); break;
    case 'cage': R(0, 0, 9, 11, '#15131c'); R(1, 1, 7, 9, '#e8d6a8'); for (const bx of [1, 3, 5, 7]) R(bx, 1, 1, 9, '#6e6e7a'); R(1, 1, 7, 1, '#6e6e7a'); R(1, 9, 7, 1, '#6e6e7a'); R(4, 4, 1, 3, '#e0a77c'); break;
    case 'life': ctx.drawImage(P.iconLife, x, y + 2); break;
    case 'grenade': ctx.drawImage(P.iconGrenade, x, y + 3); break;
    case 'wall': R(0, 0, 9, 11, '#15131c'); R(1, 1, 7, 9, '#8a5a3a'); R(1, 3, 7, 1, '#5a3a22'); R(1, 6, 7, 1, '#5a3a22'); R(4, 1, 1, 2, '#5a3a22'); R(2, 4, 1, 2, '#5a3a22'); R(6, 4, 1, 2, '#5a3a22'); R(4, 7, 1, 3, '#5a3a22'); break;
    case 'ladder': R(0, 0, 2, 11, '#8a6a3a'); R(5, 0, 2, 11, '#8a6a3a'); for (const ry of [1, 4, 7, 10]) R(1, ry, 5, 1, '#c8a060'); break;
    case 'flag': R(0, 0, 1, 11, '#6e6e7a'); R(1, 0, 6, 4, '#4aa84a'); R(1, 4, 5, 1, '#2c6a2c'); R(-1, 10, 3, 1, '#4a3522'); break;
    case 'chopper': R(1, 0, 14, 1, '#2a2a30'); R(7, 1, 1, 2, '#2a2a30'); R(4, 3, 9, 4, '#5d7240'); R(10, 3, 3, 2, '#8fd0ea'); R(0, 4, 4, 1, '#5d7240'); R(0, 3, 1, 2, '#5d7240'); R(5, 8, 7, 1, '#2a2a30'); break;
    case 'head': ctx.drawImage(Sprites.chars.grunt.portrait, x, y - 1); break;
    case 'knife': R(0, 4, 3, 2, '#5a3a22'); R(3, 4, 6, 1, '#e8eef4'); R(3, 5, 5, 1, '#9aa6b4'); break;
  }
}

function signText(key) {
  const touch = Input.mode === 'touch';
  const pad = Input.mode === 'gamepad';
  const K = (a, n) => Settings.keyLabel(a, n); // keyboard signs follow the player's own bindings
  const T = {
    move: touch ? 'DRAG LEFT THUMB\nTO MOVE' : pad ? 'STICK TO MOVE' : Settings.pairLabel('left', 'right') + '\nTO MOVE',
    jump: touch ? 'TAP JUMP' : pad ? 'A TO JUMP' : K('up') + ' / ' + K('jump', 1) + '\nTO JUMP',
    shoot: touch ? 'HOLD FIRE TO SHOOT\nHIT THE BARRELS!' : pad ? 'X TO SHOOT\nHIT THE BARRELS!' : K('fire') + ' TO SHOOT\nHIT THE BARRELS!',
    dig: 'BULLETS DIG\nTHROUGH DIRT',
    climb: 'JUMP INTO A WALL, PUSH TO CLIMB\nPUSH AWAY: TURN AND SHOOT',
    rescue: 'FREE PRISONERS:\n+1 LIFE & NEW HERO',
    special: touch ? 'TAP SPEC = SPECIAL\nKNIFE KICKS BARRELS' : pad ? 'B = SPECIAL\nY KICKS BARRELS' : K('special') + ' = SPECIAL\n' + K('melee') + ' KICKS BARRELS',
    ladder: touch ? 'PUSH UP ON\nLADDERS' : 'HOLD UP TO\nCLIMB LADDERS',
    flag: 'RAISE THE FLAGS!\nCHECKPOINT',
    slide: touch ? 'RUN + DRAG DOWN\n= SLIDE UNDER FIRE' : pad ? 'RUN + DOWN = SLIDE\nUNDER BULLETS' : 'RUN + ' + K('down') + ' = SLIDE\nUNDER BULLETS',
    stomp: 'JUMP ON HEADS\nTO STOMP THEM',
    knife: touch ? 'TAP KNIFE = STAB\nHOLD = GRAB & THROW' : pad ? 'Y = KNIFE\nHOLD Y = GRAB & THROW' : K('melee') + ' = KNIFE\nHOLD = GRAB & THROW',
    extract: 'RAISE THE FLAG\nCALL THE CHOPPER',
  };
  return T[key] || key;
}


// Siren: once a lookout (or a blast next to it) sets it off, it keeps calling
// paratrooper squads until someone destroys it.
class Alarm {
  constructor(x, y) {
    this.w = 12; this.h = 30; this.x = x - 6; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.hp = 6; this.active = false; this.t = Math.random(); this.spawnT = 1.5;
    this.dead = false; this.hittable = true; this.isAlarm = true; this.beep = 0;
  }
  get cx() { return this.x + this.w / 2; }
  activate(W) {
    if (this.active || this.dead) return;
    this.active = true; this.spawnT = 1.4;
    Sound.play('siren', W.volAt(this.cx, this.y));
  }
  update(dt, W) {
    this.t += dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    if (!this.active) return;
    this.beep -= dt;
    if (this.beep <= 0) { this.beep = 1.1; Sound.play('siren', W.volAt(this.cx, this.y) * 0.7); }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 7.5 - W.diff * 2.5;
      const target = W.nearestPlayer(this.cx, this.y);
      if (target && Math.abs(target.cx - this.cx) < 560) W.paradrop(target.cx, 3);
    }
  }
  hurt(dmg, info) {
    if (this.dead) return true;
    this.hp -= dmg;
    FX.sparks(this.cx, this.y + 6, 3, info.dirX || 0);
    if (this.hp <= 0) {
      this.dead = true;
      const W = window.world;
      if (W) {
        W.explode(this.cx, this.y + 8, 16, { owner: 'p', dmg: 4, tileDmg: 10, small: true });
        W.score += 300;
      }
    }
    return true;
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x + 4, y + 8, 4, this.h - 8); ctx.fillRect(x - 1, y + 1, this.w + 2, 10);
    ctx.fillStyle = '#6e6e7a'; ctx.fillRect(x + 5, y + 9, 2, this.h - 9);
    ctx.fillStyle = '#4a4a55'; ctx.fillRect(x, y + 2, this.w, 8); ctx.fillStyle = '#8a8a96'; ctx.fillRect(x, y + 2, this.w, 1);
    const on = this.active && ((this.t * 6) | 0) % 2;
    ctx.fillStyle = on ? '#ff3a2a' : this.active ? '#8a1a1a' : '#5a1a1a'; ctx.fillRect(x + 3, y - 2, 6, 4);
    if (on) {
      ctx.fillStyle = 'rgba(255,60,40,0.35)';
      const dir = ((this.t * 3) | 0) % 2 ? 1 : -1;
      ctx.fillRect(dir > 0 ? x + 9 : x - 17, y - 3, 14, 5);
    }
    ctx.fillStyle = '#15131c'; ctx.fillRect(x + 2, y + 4, 8, 3);
    ctx.fillStyle = '#e8c547'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 2, y + 5, 1, 1);
  }
}

// Fuel depot (sabotage objective): tank on stilts that goes up in a fireball.
class Depot {
  constructor(x, y) {
    this.w = 30; this.h = 22; this.x = x - 15; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.hp = 16; this.flash = 0; this.t = Math.random() * 3;
    this.dead = false; this.hittable = true; this.isDepot = true;
  }
  get cx() { return this.x + this.w / 2; }
  update(dt, W) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    if (this.hp < 8 && Math.random() < dt * 6) FX.smokePuff(this.cx + rand(-8, 8), this.y + 2, 0.5);
    if (W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) this.hurt(dt * 4, { kind: 'fire', team: 'n' });
  }
  hurt(dmg, info) {
    if (this.dead) return true;
    if (info.team === 'e' && info.kind !== 'explosion') return true; // their own guns don't breach it
    this.hp -= info.kind === 'explosion' ? dmg * 1.5 : dmg;
    this.flash = 0.06;
    if (info.kind === 'bullet' || info.kind === 'melee') FX.sparks(this.cx - (info.dirX || 0) * 12, this.y + 8, 2, -(info.dirX || 0));
    if (this.hp <= 0) this.blow();
    return true;
  }
  blow() {
    if (this.dead) return;
    this.dead = true;
    const W = window.world;
    if (!W) return;
    W.explode(this.cx, this.y + 10, 44, { owner: 'p', dmg: 20, tileDmg: 45, fire: true, env: true });
    W.schedule(0.16, () => W.explode(this.cx - 14, this.y + 4, 26, { owner: 'p', dmg: 12, tileDmg: 24, fire: true, env: true }));
    W.schedule(0.3, () => W.explode(this.cx + 14, this.y + 4, 26, { owner: 'p', dmg: 12, tileDmg: 24, fire: true, env: true }));
    W.schedule(0.05, () => W.props.push(new FirePatch(this.cx, this.y + this.h, 64, 3.5, 'p')));
    W.onDepotDestroyed(this);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), fl = this.flash > 0;
    const body = fl ? '#ffffff' : '#b8b0a0', dark = fl ? '#ffffff' : '#7a7468', hi = fl ? '#ffffff' : '#e0d8c8';
    ctx.fillStyle = '#15131c'; ctx.fillRect(x + 3, y + 13, 5, 9); ctx.fillRect(x + 22, y + 13, 5, 9);
    ctx.fillStyle = '#5a5a64'; ctx.fillRect(x + 4, y + 14, 3, 8); ctx.fillRect(x + 23, y + 14, 3, 8);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x, y + 1, 30, 14); ctx.fillRect(x + 1, y, 28, 16);
    ctx.fillStyle = body; ctx.fillRect(x + 1, y + 1, 28, 13);
    ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 2, 26, 2);
    ctx.fillStyle = dark; ctx.fillRect(x + 1, y + 11, 28, 3);
    for (let i = 0; i < 28; i += 4) {
      ctx.fillStyle = fl ? '#ffffff' : '#e8c547'; ctx.fillRect(x + 1 + i, y + 6, 2, 3);
      ctx.fillStyle = fl ? '#ffffff' : '#15131c'; ctx.fillRect(x + 3 + i, y + 6, 2, 3);
    }
    ctx.fillStyle = '#15131c'; ctx.fillRect(x + 12, y - 3, 6, 3);
    ctx.fillStyle = '#c0302a'; ctx.fillRect(x + 13, y - 2, 4, 2);
    if (this.hp < 10) { ctx.fillStyle = '#3a3630'; ctx.fillRect(x + 6, y + 3, 1, 3); ctx.fillRect(x + 7, y + 5, 2, 1); ctx.fillRect(x + 20, y + 9, 3, 1); }
    const W = window.world;
    if (W && !W.goalDone && W.goal === 'depots') {
      const bob = Math.round(Math.sin(this.t * 6) * 2);
      Font.drawOutlined(ctx, '↓', x + 15, y - 14 + bob, ((this.t * 4) | 0) % 2 ? '#ff3a2a' : '#ff8a3a', 1, 'center');
    }
  }
}

// Red target marker for an incoming mortar shell (blinks faster as it lands).
class TargetMark {
  constructor(x, gy, dur) { this.x = x; this.y = gy; this.t = dur; this.dur = dur; this.dead = false; this.hittable = false; this.w = 1; this.h = 1; }
  update(dt) { this.t -= dt; if (this.t <= -0.1) this.dead = true; }
  draw(ctx, cx, cy) {
    const k = clamp(1 - this.t / this.dur, 0, 1);
    if (((this.t * (5 + k * 20)) | 0) % 2) return;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy) - 2, r = 6 - Math.round(k * 2);
    ctx.fillStyle = 'rgba(255,40,20,' + (0.15 + k * 0.25).toFixed(2) + ')'; ctx.fillRect(x, 0, 1, Math.max(0, y - 4));
    ctx.fillStyle = '#15131c';
    for (let i = -r; i <= r; i++) { ctx.fillRect(x + i - 1, y + Math.round(i * 0.5) - 1, 3, 3); ctx.fillRect(x + i - 1, y - Math.round(i * 0.5) - 1, 3, 3); }
    ctx.fillStyle = '#ff2a1a';
    for (let i = -r; i <= r; i++) { ctx.fillRect(x + i, y + Math.round(i * 0.5), 1, 1); ctx.fillRect(x + i, y - Math.round(i * 0.5), 1, 1); }
  }
}

// Landmine: anyone stepping on it has a quarter second to get off.
class Mine {
  constructor(x, y) {
    this.w = 10; this.h = 4; this.x = x - 5; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.trig = -1; this.t = Math.random() * 2; this.dead = false; this.hittable = true;
  }
  update(dt, W) {
    this.t += dt;
    if (this.trig >= 0) {
      this.trig -= dt;
      if (this.trig < 0) { this.dead = true; W.explode(this.x + 5, this.y + 1, 28, { owner: 'n', dmg: 12, tileDmg: 24, env: true, src: 'mine' }); }
      return;
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    const bx = this.x - 1, by = this.y - 10, bw = this.w + 2, bh = 13;
    const touched = W.players.some((p) => !p.dead && p.state !== 'extract' && rectsOverlap(bx, by, bw, bh, p.x, p.y, p.w, p.h)) ||
      W.enemies.some((e) => !e.dead && !e.isBoss && !e.para && !e.def.static && rectsOverlap(bx, by, bw, bh, e.x, e.y, e.w, e.h));
    if (touched) { this.trig = 0.25; Sound.play('beep', W.volAt(this.x, this.y)); }
  }
  hurt() { if (this.trig < 0) this.trig = 0.04; return true; }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 1, y, this.w + 2, this.h + 1);
    ctx.fillStyle = '#4a5040'; ctx.fillRect(x, y + 1, this.w, this.h - 1);
    ctx.fillStyle = '#6a7058'; ctx.fillRect(x + 1, y + 1, this.w - 2, 1);
    const blink = this.trig >= 0 ? ((this.t * 30) | 0) % 2 : ((this.t * 2) | 0) % 2;
    ctx.fillStyle = blink ? '#ff3a2a' : '#6a1a1a'; ctx.fillRect(x + 4, y - 1, 2, 2);
  }
}

// Spike strip at the bottom of a drop: falling onto it is fatal.
class Spikes {
  constructor(x, y, w) { this.x = x; this.y = y - 6; this.w = w; this.h = 6; this.dead = false; this.hittable = false; }
  update(dt, W) {
    if (!W.terrain.standableAt(this.x + this.w / 2, this.y + 8)) { this.dead = true; FX.debris(this.x + this.w / 2, this.y, ['#8a8a96', '#5a5a64'], 6, 0.8); return; }
    const x = this.x + 1, y = this.y + 2, w = this.w - 2, h = 4;
    for (const p of W.players) if (!p.dead && p.vy >= 0 && p.state !== 'extract' && rectsOverlap(x, y, w, h, p.x, p.y, p.w, p.h)) p.kill('spikes', { dirX: 0 });
    for (const e of W.enemies) if (!e.dead && !e.isBoss && !e.def.static && e.vy >= 0 && rectsOverlap(x, y, w, h, e.x, e.y, e.w, e.h)) e.hurt(99, { kind: 'bullet', dirX: 0, team: 'n' });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x, y + 5, this.w, 1);
    for (let i = 0; i < this.w; i += 4) {
      ctx.fillStyle = '#15131c'; ctx.fillRect(x + i, y + 2, 3, 4); ctx.fillRect(x + i + 1, y, 1, 2);
      ctx.fillStyle = '#9a9aa6'; ctx.fillRect(x + i + 1, y + 1, 1, 4);
      ctx.fillStyle = '#c8c8d2'; ctx.fillRect(x + i + 1, y + 1, 1, 1);
    }
  }
}
