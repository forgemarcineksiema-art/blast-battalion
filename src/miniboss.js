'use strict';
// ============================================================================
//  MINI-BOSSES (1.24): a heavy set piece in the middle of an ordinary mission.
//  Dormant until a hero comes close (or hits it), then a name card, cinema bars
//  and a word from Grimm. Much tougher than any soldier, with one way in that
//  works far better than the rest:
//   THE DOZER   an armored bulldozer grinding through the ground toward you. The
//               blade stops bullets from the front; the cab on top is soft (jump and
//               shoot), and so is the engine at its back. It shoves barrels ahead of
//               it (shoot them at the blade!) and, now and then, revs up (red light,
//               smoke) and charges - jump it.
//   JUGGERNAUT  a gunner in a bomb suit. Bullets off the front armor barely scratch
//               it; the ammo pack on its back is the weak spot, and it turns slowly.
//               The minigun spins up with a red laser before each long burst - take
//               cover, jump the stream or get behind him.
//  Both count as bosses for the rules (no instant kills: no stomp, grab, crush)
//  without the arena, and stay near where they stand. A kill pays 3000, $40 and
//  a gold crate.
// ============================================================================

const MINIBOSS = {
  dozer: { name: 'THE DOZER', down: 'DOZER WRECKED!', w: 40, h: 26, hp: 60, speed: 34, score: 3000, gib: ['#e0a020', '#8a6a18', '#4a4a55', '#2e2e34'] },
  jugger: { name: 'JUGGERNAUT', down: 'JUGGERNAUT DOWN!', w: 16, h: 24, hp: 55, speed: 18, score: 3000, gib: ['#4a5a3a', '#2e3a24', '#5a5a64', '#c8b048'] },
};
const MINI_LEASH = 300; // how far from its post it will follow you
const GRIMM_MINI = { dozer: 'DOZER! PAVE THEM OVER!', jugger: 'JUGGERNAUT, NO PRISONERS!' };
const GRIMM_MINI_DOWN = { dozer: 'MY DOZER! IT WAS BRAND NEW!', jugger: 'HE HAD THE BEST ARMOR MONEY CAN BUY!' };

class MiniBoss {
  constructor(W, kind, x, feetY) {
    const D = MINIBOSS[kind];
    this.W = W; this.kind = kind; this.type = kind; this.name = D.name;
    this.isBoss = true; this.isMini = true; this.metal = kind === 'dozer'; this.dead = false; this.hittable = true; this.awake = false;
    this.def = { score: D.score, static: false, heavy: true, gib: D.gib };
    this.w = D.w; this.h = D.h; this.x = x - D.w / 2; this.y = feetY - D.h; this.vx = 0; this.vy = 0; this.face = -1;
    this.homeX = x;
    this.hp = this.maxHp = Math.round(D.hp * (1 + W.diff * 0.6) * (W.numPlayers > 1 ? 1.4 : 1));
    this.flash = 0; this.weakFlash = 0; this.t = Math.random() * 3; this.state = 'idle'; this.dyingT = 0;
    this.cd = 2.5; this.revT = 0; this.chargeT = 0; this.spin = 0; this.burst = 0; this.burstT = 0; this.walk = 0;
    this.hitCd = 0; this.turnT = 0; this.bashCd = 0; this.bashT = 0; this.aimY = 0;
    this.plated = kind === 'jugger'; // its chest plate (comes off at half health)
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  hearNoise() {}
  ignite() {}
  breakShield() {} // a sniper round glances off the blade, the blade stays
  // the blade: a round from the front, below the cab, glances off
  blocksFrom(dirX, y) { return this.kind === 'dozer' && this.state !== 'dying' && Math.sign(dirX) === -this.face && (y == null || y > this.y + 9); }
  wake() {
    if (this.awake) return;
    this.awake = true; this.state = 'attack';
    const W = this.W;
    W.cinema(2.2); W.slowmo(0.8, 0.5);
    W.radioSay(GRIMM_MINI[this.kind], 1.2);
    Sound.play('siren', 0.5);
    this.cd = 1.6;
  }
  hurt(dmg, info) {
    if (this.dead || this.state === 'dying' || info.team === 'e') return true; // its own side can't scratch it
    if (info.team === 'p') dmg *= Meta.damageMul();
    this.wake();
    let m = 1;
    if (info.kind === 'explosion') m = 1.6;
    else if (info.kind === 'fire') dmg = 0.1;
    else if (info.kind === 'melee' || info.kind === 'crush') m = 0.6;
    // its back: a round flying the way it faces
    const back = info.dirX && Math.sign(info.dirX) === this.face;
    if (info.kind === 'bullet' || info.kind === 'shock') {
      if (this.kind === 'jugger') m *= back ? 2.5 : this.plated ? 0.4 : 1;
      else if (info.y != null && info.y < this.y + 9) m *= 3; // the dozer's cab
      else if (back) m *= 2; // its engine
    }
    const hx = info.x == null ? this.cx : info.x, hy = info.y == null ? this.cy : info.y;
    if (m >= 2) this.weakHit(hx, hy);
    else if (m < 0.5 && info.kind === 'bullet') { FX.sparks(hx, hy, 2, -Math.sign(info.dirX || 1)); if (Math.random() < 0.3) Sound.play('metal', 0.5, 1.4); }
    this.hp -= dmg * m; this.flash = 0.06;
    if (info.kind !== 'fire') Sound.play('bossHit', 0.5);
    if (this.hp <= 0) { this.hp = 0; this.startDying(); }
    else if (this.plated && this.hp < this.maxHp * 0.5) this.breakPlate();
    return true;
  }
  // half health: the chest plate comes off with a bang, and the front is no longer armored
  breakPlate() {
    const W = this.W;
    this.plated = false;
    FX.debris(this.cx + this.face * 3, this.y + 10, ['#4a5a3a', '#6a7a54', '#2e3a24'], 10, 1.2);
    FX.sparks(this.cx + this.face * 4, this.y + 10, 8, this.face);
    Sound.play('metal', 1, 0.45); Sound.play('smallboom', W.volAt(this.cx, this.cy) * 0.6);
    W.shake(4); W.freeze(0.06);
  }
  weakHit(x, y) {
    this.weakFlash = 0.12;
    if (this.t - (this.weakT || -9) > 0.7) { this.weakT = this.t; Sound.play('metal', 1, 0.55); }
  }
  startDying() {
    const W = this.W;
    this.state = 'dying'; this.dyingT = 1.3; this.vx = 0; this.burst = 0; this.spin = 0; this.revT = 0; this.chargeT = 0;
    this.stopLoops();
    W.slowmo(0.9, 0.4); W.cinema(2.4); W.freeze(0.08);
  }
  stopLoops() { Sound.loop('spin8', false); Sound.loop('tread8', false); }
  update(dt) {
    const W = this.W, T = W.terrain;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.weakFlash > 0) this.weakFlash -= dt;
    this.hitCd -= dt; this.bashCd -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    if (this.state === 'dying') {
      this.dyingT -= dt;
      if (Math.random() < dt * 8) W.explode(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(12, 20), { owner: 'p', dmg: 3, tileDmg: 8, small: true });
      moveBody(this, T, dt);
      if (this.dyingT <= 0) this.blowUp();
      return;
    }
    const p = W.nearestPlayer(this.cx, this.cy);
    if (!this.awake) {
      // dormant: the dozer idles, the juggernaut stands guard
      if (this.kind === 'dozer' && Math.random() < dt * 1.5) FX.smokePuff(this.x + (this.face > 0 ? 6 : this.w - 6), this.y - 2, 0.6);
      if (p && !p.dead && Math.abs(p.cx - this.cx) < 230 && Math.abs(p.cy - this.cy) < 120 && W.onScreen(this.cx, this.cy, -10)) this.wake();
      moveBody(this, T, dt);
      return;
    }
    if (this.kind === 'dozer') this.updateDozer(dt, p);
    else this.updateJugger(dt, p);
  }
  // won't wander off its post: past the leash it stops and waits
  leashed(dir) { return (this.cx - this.homeX) * dir > MINI_LEASH; }
  updateDozer(dt, p) {
    const W = this.W, T = W.terrain, rage = this.hp < this.maxHp * 0.4;
    if (this.revT > 0) {
      // revving: stands, shakes, blows smoke, the light flashes red - then it comes
      this.revT -= dt; this.vx = approach(this.vx, 0, 400 * dt);
      if (Math.random() < dt * 14) FX.smokePuff(this.x + (this.face > 0 ? 6 : this.w - 6), this.y - 2, 0.8);
      if (W.onScreen(this.cx, this.cy, 20)) W.shake(0.6);
      if (this.revT <= 0) { this.chargeT = 1.1; Sound.play('truck', 1, 1.3); }
    } else if (this.chargeT > 0) {
      this.chargeT -= dt; this.vx = this.leashed(this.face) ? 0 : this.face * 132;
      if (Math.random() < dt * 20) FX.dust(this.x + (this.face > 0 ? 2 : this.w - 2), this.y + this.h, 2, -this.face);
      if (this.chargeT <= 0 || this.vx === 0) { this.chargeT = 0; this.cd = rand(4.5, 6.5); }
    } else if (p && !p.dead) {
      const dx = p.cx - this.cx;
      if (Math.abs(dx) > 14) { const want = Math.sign(dx); if (want !== this.face) { this.turnT += dt; if (this.turnT > 0.6) { this.face = want; this.turnT = 0; } } else this.turnT = 0; }
      this.vx = approach(this.vx, this.leashed(this.face) ? 0 : this.face * (rage ? 54 : MINIBOSS.dozer.speed), 120 * dt);
      this.cd -= dt;
      const ahead = dx * this.face;
      if (this.cd <= 0 && ahead > 50 && ahead < 230 && Math.abs(p.cy - this.cy) < 50 && !this.leashed(this.face)) { this.revT = rage ? 0.6 : 0.8; Sound.play('truck', 0.9); }
    } else this.vx = approach(this.vx, 0, 200 * dt);
    const wasGround = this.onGround;
    moveBody(this, T, dt);
    // up one-tile steps; the blade grinds through what's in front (all but bedrock)
    if (this.hitWall && wasGround && this.freeAt(this.x + this.face * 2, this.y - TILE - 0.5)) { this.y -= TILE + 0.5; this.x += this.face * 2; }
    if (this.hitWall || Math.abs(this.vx) > 20) {
      const fx = this.face > 0 ? this.x + this.w + 1 : this.x - 1;
      for (let py = this.y + 2; py < this.y + this.h - 1; py += 6) {
        const tcx = Math.floor(fx / TILE), tcy = Math.floor(py / TILE), t = T.get(tcx, tcy);
        if (t && T.inb(tcx, tcy) && !TDEF[t].indestructible) T.damage(tcx, tcy, (this.chargeT > 0 ? 160 : 60) * dt, 'melee');
      }
      if (this.hitWall && Math.random() < dt * 12) FX.debris(fx, this.y + this.h - 6, W.debrisColors('dirt'), 1, 0.7);
    }
    // the blade: soldiers in the way are flattened, barrels and bodies get pushed ahead of it
    const bx = this.face > 0 ? this.x + this.w - 4 : this.x - 4;
    if (Math.abs(this.vx) > 10) {
      for (const e of W.enemies) if (!e.dead && !e.isBoss && !e.def.heavy && !e.def.static && rectsOverlap(bx, this.y + 6, 8, this.h - 6, e.x, e.y, e.w, e.h)) e.hurt(99, { kind: 'crush', dirX: this.face, force: 200, team: 'e' });
      // barrels go ahead of the blade in a row, each one pushing the next
      let edge = this.face > 0 ? this.x + this.w + 1 : this.x - 1;
      const gap = (o) => this.face > 0 ? o.x - edge : edge - (o.x + o.w);
      const row = W.props.filter((o) => o instanceof Barrel && !o.dead && !(o.rocketT > 0) && !(o.kickT > 0) &&
        o.y + o.h > this.y + 6 && o.y < this.y + this.h && gap(o) < 40 && gap(o) > -this.w).sort((a, b) => gap(a) - gap(b));
      for (const o of row) {
        if (gap(o) >= 1) break;
        o.x = this.face > 0 ? edge : edge - o.w; o.vx = this.vx;
        edge += this.face * (o.w + 1);
      }
      for (const c of W.corpses) if (!c.dead && rectsOverlap(bx - 2, this.y + 6, 12, this.h - 6, c.x, c.y, c.w, c.h)) { c.x = this.face > 0 ? this.x + this.w + 1 : this.x - c.w - 1; c.vx = this.vx; }
    }
    // running into it: the charge costs a hit point, a slow push just shoves the hero off
    for (const q of W.players) {
      if (q.dead || this.hitCd > 0 || !rectsOverlap(this.x + 3, this.y + 4, this.w - 6, this.h - 4, q.x, q.y, q.w, q.h)) continue;
      const dir = q.cx > this.cx ? 1 : -1;
      if (this.chargeT > 0) { if (q.kill('crush', { dirX: dir, force: 380, dmg: 1, src: 'dozer' })) this.hitCd = 0.5; }
      else if (!q.mech) { q.vx = dir * 220; q.vy = Math.min(q.vy, -150); q.onGround = false; this.hitCd = 0.3; Sound.play('punch', 0.6, 0.6); }
    }
    this.walk += dt * Math.abs(this.vx) * 0.25;
    if (Math.random() < dt * (rage ? 5 : 2)) FX.smokePuff(this.x + (this.face > 0 ? 6 : this.w - 6), this.y - 2, rage ? 0.9 : 0.6);
    if (rage && Math.random() < dt * 6) FX.flame(this.x + rand(6, this.w - 6), this.y + 8);
    Sound.loop('tread8', Math.abs(this.vx) > 8 && W.onScreen(this.cx, this.cy, 60), W.volAt(this.cx, this.cy));
  }
  updateJugger(dt, p) {
    const W = this.W, T = W.terrain;
    if (p && !p.dead) {
      const dx = p.cx - this.cx, want = Math.sign(dx) || this.face, ad = Math.abs(dx);
      // it turns slowly: getting behind it is the plan
      if (want !== this.face && this.burst <= 0 && this.spin <= 0) { this.turnT += dt; if (this.turnT > 0.9) { this.face = want; this.turnT = 0; } } else this.turnT = 0;
      if (this.spin > 0 || this.burst > 0 || ad <= 120 || this.leashed(this.face)) this.vx = approach(this.vx, 0, 300 * dt);
      else this.vx = approach(this.vx, this.face * MINIBOSS.jugger.speed, 100 * dt);
      this.cd -= dt;
      const inFront = dx * this.face > 0, level = Math.abs(p.cy - this.cy) < 34;
      if (this.spin <= 0 && this.burst <= 0 && this.cd <= 0 && inFront && Math.abs(p.cy - this.cy) < 60 && ad < 260) {
        this.spin = 0.001; this.aimY = p.cy;
        Sound.loop('spin8', true, W.volAt(this.cx, this.cy)); Sound.play('windup', W.volAt(this.cx, this.cy));
      }
      if (this.spin > 0) {
        // spinning up: the laser shows the line the burst will take
        this.spin += dt;
        this.aimY += (p.cy - this.aimY) * Math.min(1, dt * 6);
        // 13 rounds last about as long as the hero's invulnerability after a hit: one burst, one hit at most
        // (the enraged one runs longer)
        if (this.spin >= 0.9) { this.spin = 0; this.burst = this.hp < this.maxHp * 0.4 ? 18 : 13; this.burstT = 0; }
      }
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burst--; this.burstT = 0.08;
          const mx = this.cx + this.face * 11, my = this.y + 11, a = Math.atan2(this.aimY - my, Math.abs(p.cx - mx) || 1) + rand(-0.05, 0.05);
          const sp = (185 + W.diff * 45) * W.skill.bullet * TUNE.enemyBullet;
          W.projectiles.push(new Projectile({ x: mx, y: my, vx: Math.cos(a) * sp * this.face, vy: Math.sin(a) * sp, team: 'e', src: 'jugger', kind: 'bullet', dmg: 1, tileDmg: 2, life: 1.6 }));
          FX.muzzle(mx + this.face * 6, my, this.face, 4); FX.shell(this.cx, this.y + 10, this.face, 'heavy');
          Sound.play('eshot', W.volAt(this.cx, this.cy), 0.75);
          this.aimY += (p.cy - this.aimY) * 0.1; // it drags the burst after you, slowly
          if (this.burst === 0) { this.cd = rand(2.2, 3); Sound.loop('spin8', false); }
        }
      }
      // in its face: it leans back, then throws the hero off with its shoulder (no damage - it
      // makes room for the minigun, which is the real danger)
      if (this.bashT > 0) {
        this.bashT -= dt;
        if (this.bashT <= 0) {
          this.bashCd = 2;
          if (inFront && ad < 32 && level && W.players.includes(p) && !p.mech && p.state !== 'extract') {
            p.vx = this.face * 260; p.vy = Math.min(p.vy, -170); p.onGround = false;
            if (p.state === 'slide' || p.state === 'ladder') p.state = 'normal';
            FX.dust(p.cx, p.y + p.h, 4);
            W.shake(3); W.kick(this.face * 2); Sound.play('punch', 1, 0.7);
            this.cd = Math.min(this.cd, 0.3); // and the barrels start turning
          }
        }
      } else if (inFront && ad < 24 && level && this.bashCd <= 0 && this.burst <= 0) { this.bashT = 0.3; Sound.play('stomp', W.volAt(this.cx, this.cy) * 0.5, 1.6); }
    } else { this.vx = approach(this.vx, 0, 200 * dt); if (this.spin > 0 || this.burst > 0) { this.spin = 0; this.burst = 0; Sound.loop('spin8', false); } }
    const wasGround = this.onGround, dir = Math.sign(this.vx);
    moveBody(this, T, dt);
    // a heavy hop up a one-tile step (or out of a shallow crater)
    if (this.hitWall && wasGround && dir && this.freeAt(this.x + dir * 2, this.y - TILE - 0.5)) { this.vy = -280; Sound.play('stomp', W.volAt(this.cx, this.cy) * 0.4, 1.2); }
    if (Math.abs(this.vx) > 4 && this.onGround) {
      const was = (this.walk / Math.PI) | 0;
      this.walk += dt * 6;
      if (((this.walk / Math.PI) | 0) !== was) { Sound.play('stomp', W.volAt(this.cx, this.cy) * 0.35, 1.3); if (W.onScreen(this.cx, this.cy, 0)) W.shake(0.6); FX.dust(this.cx, this.y + this.h, 2); }
    }
  }
  freeAt(x, y) {
    const T = this.W.terrain;
    for (const yy of [y + 1, y + this.h / 2, y + this.h - 1]) for (const xx of [x + 1, x + this.w / 2, x + this.w - 1]) if (T.solidAt(xx, yy)) return false;
    return true;
  }
  blowUp() {
    const W = this.W;
    this.dead = true;
    this.stopLoops();
    W.explode(this.cx, this.cy, 50, { owner: 'p', dmg: 16, tileDmg: 40, fire: true });
    FX.debris(this.cx, this.cy, this.def.gib, 24, 1.6);
    W.shake(8); W.flashT = 0.1;
    W.onMiniBossDown(this);
  }
  draw(ctx, cx, cy) {
    const rev = this.revT > 0, jx = rev ? (((this.t * 30) | 0) % 2 ? 1 : -1) : 0; // revving: it shakes on its tracks
    const lean = TUNE.charAnim && this.bashT > 0 ? -this.face * (this.bashT < 0.1 ? 2 : 1) : 0; // it leans back before the shove (1.32)
    const x = Math.round(this.x - cx) + jx + lean, y = Math.round(this.y - cy), fl = this.flash > 0, blink = ((this.t * 10) | 0) % 2;
    if (rev) {
      // the charge's path marked on the ground (red marks: something is coming here)
      for (let d = 2; d < 150; d += 8) {
        const mx = this.face > 0 ? x + this.w + d : x - d - 5;
        ctx.fillStyle = '#15131c'; ctx.fillRect(mx - 1, y + this.h - 3, 7, 4);
        ctx.fillStyle = blink ? '#ff3a2a' : '#b8201a'; ctx.fillRect(mx, y + this.h - 2, 5, 2);
      }
    }
    if (this.kind === 'dozer') drawDozer(ctx, x, y, this.face, this.walk, fl, rev && ((this.t * 12) | 0) % 2, this.hp < this.maxHp * 0.4);
    else drawJugger(ctx, x, y, this.face, this.walk, fl, this.spin > 0 || this.burst > 0 ? this.t : 0, this.plated);
    // the laser before the burst, blinking faster as the barrels spin up
    if (this.kind === 'jugger' && this.spin > 0 && ((this.t * (8 + this.spin * 20)) | 0) % 2 === 0) {
      const mx = this.cx + this.face * 11 - cx, my = this.y + 11 - cy, ty = this.aimY - cy;
      ctx.fillStyle = 'rgba(255,60,40,0.85)';
      for (let d = 4; d < 230; d += 3) ctx.fillRect(Math.round(mx + this.face * d), Math.round(my + (ty - my) * (d / 230)), 1, 1);
    }
    if (!this.awake || this.state === 'dying') return;
    if (rev || this.spin > 0 || this.bashT > 0) Font.drawOutlined(ctx, '!', x + this.w / 2, y - 34, blink ? '#ff3a2a' : '#ffd23a', 2, 'center'); // it's about to happen
    // name and armor over it
    const bw = 34, bx = Math.round(x + this.w / 2 - bw / 2), by = y - 9, f = this.hp / this.maxHp;
    ctx.fillStyle = '#15131c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = '#4a1a1a'; ctx.fillRect(bx, by, bw, 2);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#e8321e'; ctx.fillRect(bx, by, Math.round(bw * f), 2);
  }
}

// THE DOZER (40x26, drawn facing right): x, y top-left on screen
function drawDozer(ctx, x, y, face, walk, flash, redLight, burning) {
  const W0 = 40;
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = flash ? '#ffffff' : c; ctx.fillRect(face > 0 ? x + xx : x + W0 - xx - w, y + yy, w, h); };
  const O = '#15131c';
  // exhaust stack at the back
  R(5, 0, 3, 9, O); R(6, 1, 1, 7, '#3a3a40');
  // body and cab
  R(2, 8, 30, 11, O); R(3, 9, 28, 9, burning ? '#b87a18' : '#e0a020'); R(3, 9, 28, 1, '#f6c858'); R(3, 16, 28, 2, '#8a6a18');
  for (let i = 0; i < 4; i++) R(5 + i * 6, 12, 3, 2, O); // hazard stripes
  R(15, 0, 14, 10, O); R(16, 1, 12, 8, '#e0a020'); R(18, 2, 8, 5, '#8fd0ea'); R(18, 2, 3, 2, '#d8f4ff');
  R(21, 3, 4, 4, '#d8a47c'); R(21, 2, 4, 2, '#40444e'); R(24, 4, 1, 1, '#1a1410'); // the driver
  R(20, 0, 3, 1, redLight ? '#ff3a2a' : '#7a2a24'); // the warning light
  // the blade with its teeth
  R(32, 4, 8, 19, O); R(33, 5, 6, 17, '#6e6e7a'); R(33, 5, 6, 1, '#b8b8c4'); R(37, 5, 2, 17, '#4a4a55');
  for (let i = 0; i < 4; i++) R(38, 8 + i * 4, 2, 2, '#b8b8c4');
  R(30, 12, 3, 3, '#4a4a55'); // the arm
  // tracks
  R(0, 19, 34, 7, O); R(1, 20, 32, 5, '#2e2e34');
  const ph = (((walk % 3) + 3) % 3) | 0;
  for (let i = 0; i < 10; i++) R(1 + i * 3 + ph, 20, 1, 1, '#4a4a55');
  for (let i = 0; i < 5; i++) { R(3 + i * 6, 21, 4, 3, '#4a4a55'); R(4 + i * 6, 22, 2, 1, '#8a8a96'); }
  if (redLight) { ctx.fillStyle = 'rgba(255,60,40,0.35)'; ctx.fillRect(face > 0 ? x + 18 : x + W0 - 25, y - 3, 7, 4); } // the light's glow
}

// JUGGERNAUT (16x24, drawn facing right): a bomb suit, a minigun, an ammo drum on the back
function drawJugger(ctx, x, y, face, walk, flash, spinning, plated = true) {
  const W0 = 16;
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = flash ? '#ffffff' : c; ctx.fillRect(face > 0 ? x + xx : x + W0 - xx - w, y + yy, w, h); };
  const O = '#15131c', S = '#4a5a3a', SD = '#2e3a24', SL = '#6a7a54';
  const s = Math.round(Math.sin(walk) * 2);
  // legs
  R(4, 17, 4, 7, O); R(9, 17, 4, 7, O);
  R(5, 17 - Math.max(0, s), 2, 6, SD); R(10, 17 - Math.max(0, -s), 2, 6, S);
  R(4, 22, 4, 2, '#1a1a1e'); R(9, 22, 5, 2, '#1a1a1e');
  // the ammo drum on the back (the weak spot) with its feed belt
  R(0, 8, 5, 8, O); R(1, 9, 3, 6, '#c8b048'); R(1, 9, 3, 1, '#f0d870'); R(2, 11, 1, 2, '#8a7a30');
  // body armor (without the plate: the padded suit underneath, torn)
  R(3, 6, 11, 12, O);
  if (plated) { R(4, 7, 9, 10, S); R(4, 7, 9, 1, SL); R(4, 15, 9, 2, SD); R(6, 10, 5, 3, SD); }
  else { R(4, 7, 9, 10, '#3a3a30'); R(4, 7, 9, 1, '#4e4e42'); R(7, 9, 2, 1, '#8a2a20'); R(10, 12, 2, 2, '#8a2a20'); R(5, 13, 1, 2, '#15131c'); }
  // helmet with a red slit
  R(4, 0, 9, 7, O); R(5, 1, 7, 5, SD); R(5, 1, 7, 1, S); R(8, 3, 4, 1, '#e8321e');
  // shoulder and the minigun
  R(10, 7, 4, 4, O); R(11, 8, 2, 2, SL);
  R(11, 10, 5, 4, O); R(12, 11, 3, 2, '#44474f');
  const b = spinning ? ((spinning * 30) | 0) % 2 : 0;
  R(15, 10 + b, 1, 1, '#9a9aa6'); R(15, 12 - b, 1, 1, '#9a9aa6');
  ctx.fillStyle = flash ? '#ffffff' : '#9a9aa6';
  ctx.fillRect(face > 0 ? x + 16 : x - 5, y + 11, 5, 1);
  ctx.fillRect(face > 0 ? x + 16 : x - 5, y + 13, 5, 1);
}

Object.assign(World.prototype, {
  onMiniBossDown(m) {
    const bonus = Math.round(m.def.score * this.skill.score);
    this.score += bonus; this.kills++; this.minis = (this.minis || 0) + 1;
    if (!this.demo) Meta.add(40);
    for (const q of this.players) if (!q.dead) q.cheerT = 1.4 * TUNE.poseTime; // a fist in the air (1.32)
    Sound.play('unlock'); if (!this.demo) Settings.haptic([60, 40, 120]);
    this.radioSay(GRIMM_MINI_DOWN[m.kind], 1.2);
    const pk = new Pickup(m.cx, m.y + m.h - 4, 'bonus'); pk.vy = -240; this.props.push(pk);
  },
});
