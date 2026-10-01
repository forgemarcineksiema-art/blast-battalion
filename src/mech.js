'use strict';
// ============================================================================
//  Vehicles. Parked in some missions: walk up and press UP (or MELEE) to climb in.
//  Hold DOWN to climb out; when the armor is gone it blows up and throws the pilot
//  clear. While piloting, the hero's own body *is* the vehicle (bigger box).
//   walker mech: FIRE = heavy machine gun, SPECIAL = rocket salvo, MELEE = punch that
//     smashes walls, a hard landing stomps whatever is underneath
//   tank (1.22): FIRE = cannon (an arcing shell laid on the nearest soldier ahead),
//     SPECIAL = coaxial MG burst, MELEE = ram; grinds through soft walls, climbs
//     one-tile steps and runs soldiers over
// ============================================================================

const MECH_W = 22, MECH_H = 28, MECH_HP = 40;
const TANK_W = 32, TANK_H = 18, TANK_HP = 60;
const VEHICLE = {
  walker: { w: MECH_W, h: MECH_H, hp: MECH_HP, name: 'MECH', online: 'MECH ONLINE!', lost: 'MECH DESTROYED!', colors: ['#5d7240', '#3c4a28', '#4a4a55', '#7d9058'] },
  tank: { w: TANK_W, h: TANK_H, hp: TANK_HP, name: 'TANK', online: 'TANK ROLLING!', lost: 'TANK DESTROYED!', colors: ['#6a7a44', '#465230', '#2e2e34', '#8a9a5a'] },
};

// x, y: top-left of the tank box on screen; aim: barrel elevation (radians); recoil 0..1
function drawTankSprite(ctx, x, y, face, walk, pilotId, flash, aim = 0.12, recoil = 0) {
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(face > 0 ? x + xx : x + TANK_W - xx - w, y + yy, w, h); };
  const O = '#15131c', B = flash ? '#ffffff' : '#6a7a44', L = flash ? '#ffffff' : '#8a9a5a', D = flash ? '#ffffff' : '#465230';
  const G = flash ? '#ffffff' : '#4a4a55', T = flash ? '#ffffff' : '#2e2e34';
  // the barrel, raised to its aim and kicked back by the last shot
  const len = 13 - Math.round(recoil * 5), ca = Math.cos(aim), sa = Math.sin(aim);
  for (let i = 0; i < len; i++) R(21 + Math.round(ca * i), 3 - Math.round(sa * i), 2, 3, O);
  for (let i = 0; i < len; i++) R(21 + Math.round(ca * i), 4 - Math.round(sa * i), 2, 1, G);
  // turret, the pilot's head out of the hatch
  R(10, 1, 13, 7, O); R(11, 2, 11, 5, B); R(11, 2, 11, 1, L); R(12, 5, 9, 1, D);
  if (pilotId && LOOKS[pilotId]) {
    const lk = LOOKS[pilotId];
    R(13, -3, 6, 5, O); R(14, -2, 4, 3, lk.skin); R(14, -3, 4, 2, lk.hatC || lk.hair || '#333'); R(17, -1, 1, 1, '#1a1410');
  } else R(13, 0, 6, 2, D);
  // hull with a stencilled star
  R(1, 6, 30, 7, O); R(2, 7, 28, 5, B); R(2, 7, 28, 1, L); R(2, 11, 28, 1, D);
  R(6, 8, 3, 3, flash ? '#ffffff' : '#d8d0a0'); R(7, 8, 1, 3, B);
  // treads and road wheels (the links crawl as it drives)
  R(0, 12, 32, 6, O); R(1, 13, 30, 4, T);
  const ph = (((walk % 3) + 3) % 3) | 0;
  for (let i = 0; i < 10; i++) R(1 + i * 3 + ph, 13, 1, 1, G);
  for (let i = 0; i < 5; i++) { R(3 + i * 6, 14, 3, 3, G); R(4 + i * 6, 15, 1, 1, '#8a8a96'); }
}

// x, y: top-left of the mech box on screen; face: 1 = right; walk: leg phase
function drawMechSprite(ctx, x, y, face, walk, pilotId, flash) {
  const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(face > 0 ? x + xx : x + MECH_W - xx - w, y + yy, w, h); };
  const O = '#15131c';
  const B = flash ? '#ffffff' : '#5d7240', L = flash ? '#ffffff' : '#7d9058', D = flash ? '#ffffff' : '#3c4a28', G = flash ? '#ffffff' : '#4a4a55';
  const s = Math.round(Math.sin(walk) * 2);
  const leg = (hx, off, col) => {
    R(hx - 1, 15, 6, 8, O); R(hx + off - 1, 20, 6, 8, O);
    R(hx, 16, 4, 6, col); R(hx + off, 21, 4, 5, col);
    R(hx + off - 1, 26, 7, 2, O); R(hx + off, 26, 6, 1, G);
  };
  leg(4, -s, D);
  // rocket pod on the back
  R(0, 1, 8, 6, O); R(1, 2, 6, 4, G);
  for (let i = 0; i < 3; i++) R(1 + i * 2, 1, 1, 1, '#d23a2a');
  // hull
  R(1, 5, 20, 12, O); R(2, 6, 18, 10, B); R(2, 6, 18, 2, L); R(2, 14, 18, 2, D);
  R(4, 9, 1, 1, D); R(4, 12, 1, 1, D); R(8, 9, 1, 1, D); R(8, 12, 1, 1, D);
  // cockpit with the pilot's head (hat / hair color + face)
  R(10, 7, 9, 7, O);
  if (pilotId && LOOKS[pilotId]) {
    const lk = LOOKS[pilotId];
    R(11, 8, 7, 5, '#8fd0ea');
    R(13, 9, 4, 4, lk.skin);
    R(13, 8, 4, 2, lk.hatC || lk.hair || '#333');
    R(16, 10, 1, 1, '#1a1410');
    R(11, 8, 2, 1, '#d8f4ff');
  } else R(11, 8, 7, 5, '#26303a');
  leg(12, s, B);
  // gun arm
  R(16, 10, 8, 6, O); R(17, 11, 6, 4, G); R(17, 11, 6, 1, '#6e6e7a');
  R(22, 12, 8, 3, O); R(23, 13, 6, 1, '#9a9aa6');
}

// ---------------------------------------------------------------- parked mech
class Mech {
  constructor(x, feetY, hp, kind = 'walker') {
    const V = VEHICLE[kind];
    this.kind = kind; this.w = V.w; this.h = V.h; this.x = x - V.w / 2; this.y = feetY - V.h;
    this.vx = 0; this.vy = 0; this.hp = hp == null ? V.hp : hp; this.face = 1; this.t = Math.random() * 3;
    this.dead = false; this.hittable = false; this.isMech = true; this.near = false; this.flash = 0;
  }
  update(dt, W) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    this.near = false;
    for (const p of W.players) {
      if (p.dead || p.mech || p.carry || p.state !== 'normal' || !p.inp || !overlap(p, this)) continue;
      this.near = true;
      if (p.inp.hit('up') || p.inp.hit('melee')) { this.dead = true; p.enterMech(this); return; }
    }
  }
  // your own fire never scratches it; enemy blasts and bullets wreck it
  hurt(dmg, info) {
    if (this.dead || info.team === 'p' || (info.team !== 'e' && info.kind !== 'explosion')) return true;
    this.hp -= info.kind === 'explosion' ? dmg * 0.6 : dmg * 0.5;
    this.flash = 0.06;
    if (this.hp <= 0) {
      this.dead = true;
      const W = window.world;
      if (W) W.explode(this.x + this.w / 2, this.y + this.h / 2, 40, { owner: 'n', dmg: 12, tileDmg: 30, env: true, src: 'mech wreck' });
    }
    return true;
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.kind === 'tank') drawTankSprite(ctx, x, y, this.face, 0, null, this.flash > 0);
    else drawMechSprite(ctx, x, y, this.face, 0, null, this.flash > 0);
    // the way in, once a hero is next to it (not in the title's demo, src/attract.js)
    if (!this.near || (window.world && window.world.demo)) return;
    const bob = Math.round(Math.sin(this.t * 6) * 2);
    Hud.otext('↑ ENTER', (x + this.w / 2) * Hud.F, (y - 12 + bob) * Hud.F, '#7cff7c', 'center');
  }
}

// ---------------------------------------------------------------- piloting
Object.assign(Player.prototype, {
  enterMech(m) {
    const W = this.W;
    if (this.carry) this.throwCarry();
    const V = VEHICLE[m.kind || 'walker'];
    this.mech = { kind: m.kind || 'walker', hp: m.hp, maxHp: V.hp, rocketCd: 0, punchCd: 0, fireCd: 0, walk: 0, lastStep: 0, exitT: 0, hitCd: 0, flash: 0, hint: 4,
      mgCd: 0, burst: 0, burstT: 0, ramT: 0, ramCd: 0, crushCd: 0, aim: 0.12, recoil: 0 };
    this.w = V.w; this.h = V.h; this.x = m.x; this.y = m.y;
    this.vx = 0; this.vy = 0; this.state = 'normal'; this.climbing = false; this.jumping = false;
    this.inv = Math.max(this.inv, 0.3);
    W.stopLoops(this.slot);
    Sound.play('metal', 1, 0.6); Sound.play('stomp', 0.5);
    FX.dust(this.cx, this.y + this.h, 6);
    Playtest.use('mech', this);
  },
  // climb out, leaving the mech parked (keeps its armor)
  exitMech() {
    const W = this.W, M = this.mech;
    if (!M) return;
    this.mech = null;
    Sound.loop('tread' + this.slot, false);
    const mech = new Mech(this.cx, this.y + this.h, M.hp, M.kind);
    mech.face = this.face;
    W.props.push(mech);
    const feet = this.y + this.h, cx = this.cx;
    this.w = 10; this.h = 15;
    this.x = cx - this.face * 14 - this.w / 2; this.y = feet - this.h;
    if (this.W.terrain.solidAt(this.x + 1, this.y + 4) || this.W.terrain.solidAt(this.x + this.w - 1, this.y + 4)) this.x = cx - this.w / 2;
    this.vx = -this.face * 60; this.vy = -160; this.onGround = false; this.inv = Math.max(this.inv, 0.5);
    Sound.play('metal', 0.8, 0.8);
    Playtest.use('mech:exit', this);
  },
  // armor gone: the mech explodes and throws the pilot clear
  ejectMech() {
    const W = this.W;
    if (!this.mech) return;
    const V = VEHICLE[this.mech.kind];
    this.mech = null;
    Sound.loop('tread' + this.slot, false);
    const cx = this.cx, cy = this.cy, feet = this.y + this.h;
    W.explode(cx, cy, 44, { owner: 'p', dmg: 16, tileDmg: 40 });
    FX.debris(cx, cy, V.colors, 18, 1.5);
    this.w = 10; this.h = 15; this.x = cx - this.w / 2; this.y = feet - this.h - 6;
    this.vx = -this.face * 90; this.vy = -330; this.onGround = false; this.inv = 1.5;
    Playtest.use('mech:lost', this);
  },
  mechMuzzle() {
    const M = this.mech;
    if (M && M.kind === 'tank') return { x: this.cx + this.face * (6 + Math.cos(M.aim) * 13), y: this.y + 4 - Math.sin(M.aim) * 13 };
    return { x: this.cx + this.face * 18, y: this.y + 12 };
  },
  mechBoxFree(x, y) {
    const T = this.W.terrain;
    for (const yy of [y + 1, y + this.h * 0.33, y + this.h * 0.66, y + this.h - 1]) {
      for (const xx of [x + 1, x + this.w / 2, x + this.w - 1]) if (T.solidAt(xx, yy)) return false;
    }
    return true;
  },
  // damage lands on the armor instead of the pilot
  mechDamage(cause, info) {
    const M = this.mech;
    if (cause === 'doom') { this.ejectMech(); this.inv = 0; return this.kill('doom', info); }
    if (cause === 'spikes') return false;
    if (M.hitCd > 0 && cause !== 'explosion') return true;
    M.hitCd = cause === 'crush' ? 0.5 : 0.1;
    const dmg = cause === 'explosion' ? 5 * (info.dmg || 1) : cause === 'crush' ? 12 : 1;
    M.hp -= dmg; M.flash = 0.08;
    Sound.play('bossHit', 0.9);
    if (M.hp <= 0) this.ejectMech();
    return true;
  },
  updateMech(dt, inp) {
    const W = this.W, T = W.terrain, M = this.mech;
    M.fireCd -= dt; M.rocketCd -= dt; M.punchCd -= dt; M.hitCd -= dt; M.flash -= dt; M.hint -= dt;
    if (M.kind === 'tank') { this.updateTank(dt, inp); return; }
    const mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (mx) this.face = mx;
    this.vx = approach(this.vx, mx * 74, (this.onGround ? 800 : 300) * dt);
    if (inp.hit('jump') && this.onGround) {
      this.vy = -270; this.onGround = false;
      Sound.play('jump', 1, 0.55); FX.dust(this.cx, this.y + this.h, 4);
    }
    this.vy = Math.min(this.vy + GRAVITY * 1.25 * dt, 520);
    const wasGround = this.onGround, preVy = this.vy;
    moveBody(this, T, dt);
    // walk up one-tile steps
    if (this.hitWall && wasGround && mx && this.mechBoxFree(this.x + mx * 2, this.y - TILE - 0.5)) { this.y -= TILE + 0.5; this.x += mx * 2; }
    if (this.onGround && !wasGround && preVy > 280) this.mechStomp(preVy);
    // footfalls
    if (this.onGround && Math.abs(this.vx) > 10) {
      M.walk += dt * 9;
      const st = (M.walk / Math.PI) | 0;
      if (st !== M.lastStep) { M.lastStep = st; Sound.play('stomp', 0.22, 1.7); W.shake(0.5); FX.dust(this.cx - this.face * 6, this.y + this.h, 2); }
    }
    // heavy machine gun
    if ((inp.down('fire') || (inp !== NULL_INPUT && Settings.autoFire() && this.autoFireTarget())) && M.fireCd <= 0) {
      M.fireCd = 0.075;
      const m = this.mechMuzzle(), a = this.aimAssist(480) + rand(-0.04, 0.04);
      W.projectiles.push(new Projectile({ x: m.x, y: m.y, vx: Math.cos(a) * 620 * this.face, vy: Math.sin(a) * 620, team: 'p', kind: 'bullet', dmg: 2, tileDmg: 5, life: 0.75, force: 140 }));
      FX.muzzle(m.x, m.y, this.face, 5); FX.shell(this.cx + this.face * 8, m.y, this.face, 'heavy');
      Sound.play('mg', 1, 0.75); W.noise(this.cx, this.cy, 180); W.kick(-this.face * 0.6); W.shake(0.4);
    }
    // rocket salvo from the back pod
    if (inp.hit('special')) {
      if (M.rocketCd > 0) Sound.play('nope');
      else {
        M.rocketCd = 2.5;
        const ra = this.aimAssist(420);
        for (let i = 0; i < 3; i++) {
          W.schedule(i * 0.12, () => {
            if (!this.mech || this.dead) return;
            const px = this.cx - this.face * 4, py = this.y + 3, a = ra + (i - 1) * 0.1;
            W.projectiles.push(new Projectile({
              x: px, y: py, vx: this.face * Math.cos(a) * 160, vy: Math.sin(a) * 160, kind: 'rocket', team: 'p',
              accel: 900, maxSpeed: 460, radius: 32, explodeDmg: 10, explodeTile: 40, life: 2, sprite: Sprites.props.rocket,
            }));
            FX.smokePuff(px - this.face * 6, py, 0.7); Sound.play('rocket', 0.8);
          });
        }
      }
    }
    if (inp.hit('melee')) this.mechPunch();
    // hold DOWN to climb out
    if (inp.down('down') && this.onGround) { M.exitT += dt; if (M.exitT > 0.5) { this.exitMech(); return; } } else M.exitT = 0;
    unstick(this, T);
    // standing in fire scorches the armor
    if (T.fireAtRect(this.x + 2, this.y + 6, this.w - 4, this.h - 6, 'p')) this.kill('fire');
  },
  mechPunch() {
    const W = this.W, M = this.mech;
    if (M.punchCd > 0) return;
    M.punchCd = 0.45;
    const bx = this.face > 0 ? this.x + this.w - 2 : this.x - 24, by = this.y + 2, bw = 26, bh = this.h - 2;
    const ev = ++W.evSeq;
    let hit = false;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable || !rectsOverlap(bx, by, bw, bh, e.x, e.y, e.w, e.h)) continue;
      e.hurt(e.isBoss ? 8 : 30, { kind: 'melee', dirX: this.face, force: 380, team: 'p', bowl: true, ev });
      hit = true;
    }
    for (const o of W.props) {
      if (!o.hittable || o.dead || !rectsOverlap(bx, by, bw, bh, o.x, o.y, o.w, o.h)) continue;
      if (o instanceof Barrel) o.kick(this.face); else o.hurt(8, { kind: 'melee', dirX: this.face, team: 'p' });
      hit = true;
    }
    for (const c of W.corpses) if (!c.dead && rectsOverlap(bx, by, bw, bh, c.x, c.y, c.w, c.h)) { c.kick(this.face, W); hit = true; }
    // smash the wall in front
    const tcx = Math.floor((this.cx + this.face * 18) / TILE);
    for (let py = this.y + 2; py < this.y + this.h; py += 8) W.terrain.damage(tcx, Math.floor(py / TILE), 40, 'explosion');
    FX.addEffect({ type: 'slash', x: this.cx + this.face * 16, y: this.cy, face: this.face, r: 16, dur: 0.12 });
    Sound.play('punch', 1, 0.6); W.shake(3); W.kick(this.face * 2);
    if (hit) W.freeze(0.05);
  },
  // a hard landing flattens whoever is standing under or next to the feet
  mechStomp(v) {
    const W = this.W, fx = this.cx, fy = this.y + this.h;
    for (const e of W.enemies) {
      if (e.dead || e.isBoss || Math.abs(e.cx - fx) > 34 || Math.abs(e.y + e.h - fy) > 20) continue;
      e.hurt(e.def.heavy ? 10 : 99, { kind: 'crush', dirX: Math.sign(e.cx - fx) || 1, team: 'p' });
    }
    FX.dust(fx, fy, 10); FX.addEffect({ type: 'ring', x: fx, y: fy, r: 40, dur: 0.3 });
    Sound.play('stomp', 1); W.shake(Math.min(8, v / 70));
    for (let dx = -1; dx <= 1; dx++) W.terrain.damage(Math.floor(fx / TILE) + dx, Math.floor((fy + 4) / TILE), 12, 'explosion');
  },
  // ---------------------------------------------------------------- the tank
  updateTank(dt, inp) {
    const W = this.W, T = W.terrain, M = this.mech;
    M.mgCd -= dt; M.ramCd -= dt; M.crushCd -= dt; M.recoil = Math.max(0, M.recoil - dt * 4);
    if (M.ramT > 0) M.ramT -= dt;
    const mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (mx && M.ramT <= 0) this.face = mx;
    const target = M.ramT > 0 ? this.face * 150 : mx * 62;
    this.vx = approach(this.vx, target, (this.onGround ? 520 : 200) * dt);
    this.vy = Math.min(this.vy + GRAVITY * 1.3 * dt, 520);
    const wasGround = this.onGround, preVy = this.vy;
    moveBody(this, T, dt);
    const dir = Math.abs(this.vx) > 4 ? Math.sign(this.vx) : this.face;
    // up a one-tile step
    if (this.hitWall && wasGround && (mx || M.ramT > 0) && this.mechBoxFree(this.x + dir * 2, this.y - TILE - 0.5)) { this.y -= TILE + 0.5; this.x += dir * 2; }
    // soft walls (dirt, sand, wood, sandbags, crates) grind away under the tracks; rock and steel stop it
    if (this.hitWall && (mx || M.ramT > 0)) {
      const fx = dir > 0 ? this.x + this.w + 1 : this.x - 1;
      for (let py = this.y + 2; py < this.y + this.h - 1; py += 6) {
        const tcx = Math.floor(fx / TILE), tcy = Math.floor(py / TILE), t = T.get(tcx, tcy);
        if (t && !TDEF[t].indestructible && TDEF[t].hp <= 14) T.damage(tcx, tcy, (M.ramT > 0 ? 140 : 50) * dt, 'melee');
      }
      if (Math.random() < dt * 14) FX.debris(fx, this.y + this.h - 6, W.debrisColors('dirt'), 1, 0.6);
    }
    if (this.onGround && !wasGround && preVy > 260) { W.shake(Math.min(6, preVy / 80)); FX.dust(this.cx, this.y + this.h, 8); Sound.play('stomp', 0.8, 0.8); }
    // the tracks: clatter, dust
    const rolling = this.onGround && Math.abs(this.vx) > 8;
    if (rolling) { M.walk += dt * Math.abs(this.vx) * 0.25; if (Math.random() < dt * 10) FX.dust(this.cx - dir * 14, this.y + this.h, 1, -dir); }
    Sound.loop('tread' + this.slot, rolling, W.volAt(this.cx, this.cy));
    // run soldiers over; a heavy takes a beating, barrels get shoved ahead
    if (Math.abs(this.vx) > 25) {
      const bx = dir > 0 ? this.x + this.w - 6 : this.x - 2;
      for (const e of W.enemies) {
        if (e.dead || e.isBoss || !e.hittable || !rectsOverlap(bx, this.y + 3, 8, this.h - 3, e.x, e.y, e.w, e.h)) continue;
        if (e.def.heavy || e.def.static) { if (M.crushCd <= 0) { e.hurt(M.ramT > 0 ? 8 : 4, { kind: 'crush', dirX: dir, force: 200, team: 'p' }); M.crushCd = 0.3; } }
        else e.hurt(99, { kind: 'crush', dirX: dir, force: 220, team: 'p', style: STYLE.crush });
      }
      for (const o of W.props) if (o instanceof Barrel && !o.dead && rectsOverlap(bx, this.y + 3, 8, this.h - 3, o.x, o.y, o.w, o.h)) o.kick(dir);
    }
    // the cannon
    if ((inp.down('fire') || (inp !== NULL_INPUT && Settings.autoFire() && this.autoFireTarget())) && M.fireCd <= 0) this.tankFire();
    // coaxial machine gun: a burst on SPECIAL
    if (inp.hit('special')) {
      if (M.mgCd > 0) Sound.play('nope');
      else { M.burst = 12; M.burstT = 0; M.mgCd = 2.2; }
    }
    if (M.burst > 0) {
      M.burstT -= dt;
      if (M.burstT <= 0) {
        M.burst--; M.burstT = 0.06;
        const mx0 = this.cx + this.face * 15, my0 = this.y + 9, a = this.aimAssist(460) + rand(-0.05, 0.05);
        W.projectiles.push(new Projectile({ x: mx0, y: my0, vx: Math.cos(a) * 600 * this.face, vy: Math.sin(a) * 600, team: 'p', kind: 'bullet', dmg: 1.5, tileDmg: 4, life: 0.75, force: 120 }));
        FX.muzzle(mx0, my0, this.face, 3); FX.shell(this.cx, this.y + 6, this.face, 'brass');
        Sound.play('mg', 0.9, 0.9); W.noise(this.cx, this.cy, 160);
      }
    }
    // MELEE: ram - a lunge that crushes and grinds through what's ahead
    if (inp.hit('melee') && M.ramCd <= 0) { M.ramT = 0.55; M.ramCd = 1.6; Sound.play('truck', 1); W.shake(2); FX.dust(this.cx - this.face * 14, this.y + this.h, 6, -this.face); }
    // hold DOWN to climb out
    if (inp.down('down') && this.onGround) { M.exitT += dt; if (M.exitT > 0.5) { this.exitMech(); return; } } else M.exitT = 0;
    unstick(this, T);
    if (T.fireAtRect(this.x + 2, this.y + 4, this.w - 4, this.h - 4, 'p')) this.kill('fire');
  },
  // the cannon lays a ballistic arc on the nearest soldier ahead (or fires out low and flat)
  tankFire() {
    const W = this.W, M = this.mech;
    M.fireCd = 0.95;
    let tgt = null, bd = Infinity;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable) continue;
      const dx = (e.cx - this.cx) * this.face;
      if (dx < 24 || dx > 340 || Math.abs(e.cy - this.cy) > 96 || !W.onScreen(e.cx, e.cy, 10)) continue;
      const d = dx + Math.abs(e.cy - this.cy);
      if (d < bd) { bd = d; tgt = e; }
    }
    const g = 480;
    // raise the barrel first so the shell leaves from its real muzzle
    let vx, vy;
    if (tgt) {
      const m0 = this.mechMuzzle(), dx = tgt.cx - m0.x, dy = tgt.cy - m0.y, Tf = clamp(Math.abs(dx) / 300, 0.45, 1.1);
      vx = dx / Tf; vy = (dy - 0.5 * g * Tf * Tf) / Tf;
    } else { vx = this.face * 330; vy = -80; }
    M.aim = clamp(Math.atan2(-vy, Math.abs(vx)), -0.1, 1.0);
    const m = this.mechMuzzle();
    W.projectiles.push(new Projectile({ x: m.x, y: m.y, vx, vy, grav: g, team: 'p', kind: 'shell', sprite: Sprites.props.shell, radius: 34, explodeDmg: 14, explodeTile: 34, life: 3 }));
    FX.muzzle(m.x, m.y, this.face, 8); FX.smokePuff(m.x, m.y, 1.1); FX.smokePuff(m.x - this.face * 3, m.y + 2, 0.7);
    FX.shell(this.cx - this.face * 2, this.y + 3, this.face, 'heavy');
    Sound.play('explosion', 0.45, 1.9); W.shake(3); W.kick(-this.face * 3); W.noise(this.cx, this.cy, 260);
    this.vx -= this.face * 45; M.recoil = 1;
  },

  drawMech(ctx, cx, cy) {
    const M = this.mech;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (M.kind === 'tank') drawTankSprite(ctx, x, y, this.face, M.walk, this.hero.id, M.flash > 0, M.aim, M.recoil);
    else drawMechSprite(ctx, x, y, this.face, M.walk, this.hero.id, M.flash > 0);
    // armor bar
    const bw = this.w - 2, f = clamp(M.hp / M.maxHp, 0, 1);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x + 1, y - 5, bw + 2, 4);
    ctx.fillStyle = f > 0.35 ? '#7cff7c' : '#ff5a3a'; ctx.fillRect(x + 2, y - 4, Math.round(bw * f), 2);
    if (M.exitT > 0) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 2, y - 7, Math.round(bw * Math.min(1, M.exitT / 0.5)), 1); }
    // (how to get out, HOLD [S] ▶ EXIT, floats over the vehicle on the HUD layer: Hud.heroKeys)
  },
});
