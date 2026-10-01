'use strict';
// ============================================================================
//  Bosses: IRON HOG (tank), SKYREAPER (gunship), GRIMM WALKER (mech)
// ============================================================================

function bossCanvas(w, h, fn) {
  const c = makeCanvas(w, h, true);
  const x = c.getContext('2d');
  const R = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(ww), Math.round(hh)); };
  fn(R, x);
  return outlineCanvas(c);
}

const BossArt = {
  built: false,
  build() {
    if (this.built) return;
    this.built = true;
    // ---------------- tank (faces left)
    this.tankHull = bossCanvas(98, 32, (R) => {
      for (let r = 0; r < 11; r++) { const lx = 4 + Math.round((10 - r) * 0.7); R(lx, 7 + r, 88 - lx, 1, '#4e5448'); }
      R(10, 7, 78, 1, '#6e7466'); R(4, 17, 84, 1, '#353a30');
      R(18, 12, 70, 2, '#b8302a'); R(18, 12, 70, 1, '#d8483a');
      R(60, 8, 7, 4, '#e8e8e0'); R(61, 9, 2, 2, '#1a1a1e'); R(64, 9, 2, 2, '#1a1a1e');
      R(0, 14, 7, 2, '#2a2a30'); R(84, 1, 3, 7, '#3a3a40'); R(84, 1, 3, 1, '#5a5a64');
      R(6, 18, 86, 12, '#26262c'); R(8, 17, 82, 1, '#26262c'); R(8, 30, 82, 1, '#26262c');
      R(7, 20, 84, 8, '#34343c');
    });
    this.tankWheels = [0, 1, 2].map((f) => bossCanvas(98, 32, (R) => {
      for (let i = 0; i < 6; i++) {
        const cx = 14 + i * 14, cy = 24;
        R(cx - 4, cy - 3, 8, 6, '#50505a'); R(cx - 3, cy - 4, 6, 8, '#50505a'); R(cx - 1, cy - 1, 2, 2, '#9a9aa6');
      }
      for (let x = 8 + f * 2; x < 90; x += 6) { R(x, 17, 3, 1, '#4a4a55'); R(x, 30, 3, 1, '#4a4a55'); }
    }));
    this.tankTurret = bossCanvas(46, 18, (R) => {
      for (let r = 0; r < 11; r++) { const lx = 3 + Math.round((10 - r) * 0.5); R(lx, 5 + r, 41 - lx, 1, '#5a6052'); }
      R(8, 5, 34, 1, '#7a8070'); R(3, 15, 39, 1, '#3a3f36');
      R(22, 1, 12, 4, '#3a3f36'); R(24, 0, 8, 1, '#4a4f44');
      R(28, 8, 5, 4, '#b8302a'); R(29, 9, 1, 1, '#1a1a1e'); R(31, 9, 1, 1, '#1a1a1e');
    });
    this.tankBarrel = bossCanvas(36, 7, (R) => { R(1, 2, 34, 3, '#2e322a'); R(1, 2, 34, 1, '#4a4f44'); R(1, 1, 5, 5, '#26262c'); });

    // ---------------- gunship (faces left)
    this.gunship = [0, 1, 2].map((f) => bossCanvas(96, 36, (R) => {
      R(12, 14, 40, 12, '#2e3238'); R(14, 14, 36, 2, '#4a505a'); R(12, 24, 40, 2, '#1e2126');
      R(4, 17, 9, 7, '#2e3238'); R(2, 19, 3, 4, '#2e3238');
      R(14, 9, 22, 6, '#b8402a'); R(16, 9, 6, 2, '#ff9a7a'); R(26, 10, 2, 5, '#1e2126');
      R(50, 17, 36, 4, '#2e3238'); R(50, 17, 36, 1, '#4a505a'); R(58, 18, 26, 1, '#b8302a');
      R(82, 5, 6, 14, '#2e3238'); R(82, 5, 6, 1, '#4a505a');
      R(26, 25, 24, 3, '#3a3f48'); R(27, 28, 9, 5, '#555a64'); R(39, 28, 9, 5, '#555a64'); R(27, 29, 2, 3, '#d23a2a'); R(39, 29, 2, 3, '#d23a2a');
      R(6, 26, 7, 3, '#1a1c20'); R(0, 27, 7, 1, '#1a1c20');
      R(40, 16, 7, 5, '#e8e8e0'); R(41, 17, 2, 2, '#1a1a1e'); R(44, 17, 2, 2, '#1a1a1e');
      R(31, 5, 4, 9, '#1e2126');
      const rl = [80, 50, 24][f];
      R(33 - rl / 2, 4, rl, 1, '#15161a');
      const tr = [[84, 2, 1, 12], [80, 8, 10, 1], [81, 4, 6, 6]][f];
      R(tr[0], tr[1], tr[2], tr[3], '#15161a');
    }));

    // ---------------- mech (faces left)
    this.mechTorso = bossCanvas(56, 38, (R) => {
      R(10, 8, 36, 26, '#5a1e1e'); R(10, 8, 36, 2, '#7a2e2a'); R(10, 32, 36, 2, '#3a1010');
      R(14, 12, 14, 10, '#e8b84a'); R(15, 13, 5, 2, '#fff0a0');
      R(18, 15, 6, 6, '#b58560'); R(18, 14, 7, 2, '#5a1a1a'); R(22, 17, 1, 1, '#1a1a1e');
      R(30, 12, 12, 16, '#6e2a26'); R(31, 13, 10, 1, '#8e3a34');
      R(32, 0, 20, 11, '#44474f'); R(32, 0, 20, 1, '#5e626c');
      for (let i = 0; i < 3; i++) R(34 + i * 6, 2, 4, 3, '#d23a2a');
      R(0, 24, 16, 7, '#34363e'); R(0, 25, 16, 1, '#50535c'); R(0, 26, 4, 3, '#1a1a1e');
      R(12, 34, 32, 4, '#34363e');
    });
    this.mechWreck = silhouette(this.mechTorso, '#2a2220');
  },
};

class BossBase {
  constructor(W) {
    this.W = W; this.isBoss = true; this.dead = false; this.hittable = true; this.flash = 0; this.t = 0;
    this.def = { score: 10000, static: false, gib: ['#4e5448', '#26262c'] };
    this.awake = true; this.burning = 0; this.dyingT = 0; this.state = 'enter'; this.metal = true; // machines: hits spark
    BossArt.build();
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  hearNoise() {}
  ignite() {}
  hurt(dmg, info) {
    if (this.dead || this.state === 'dying' || this.state === 'enter') return true;
    if (info.team === 'e') return true; // immune to its own side's explosions
    if (info.team === 'p') dmg *= Meta.damageMul(); // FIREPOWER upgrade
    let m = 1;
    if (info.kind === 'explosion') m = 1.6;
    if (info.kind === 'fire') { m = 1; dmg = 0.12; }
    // weak spots take a lot more (bullets and blasts carry the point they hit)
    const wk = info.x != null && info.kind !== 'fire' ? this.weakMul(info.x, info.y, info.kind) : 1;
    if (wk > 1) { m *= wk; this.weakHit(info.x, info.y); }
    this.hp -= dmg * m;
    this.flash = 0.06;
    if (info.kind !== 'fire') Sound.play('bossHit', 0.6);
    if (this.hp <= 0) { this.hp = 0; this.state = 'dying'; this.dyingT = 2.6; }
    return true;
  }
  weakMul() { return 1; }
  weakHit(x, y) {
    this.weakFlash = 0.12;
    if (this.t - (this.weakT || -9) > 0.7) { this.weakT = this.t; Sound.play('metal', 1, 0.55); }
  }
  dyingUpdate(dt) {
    const W = this.W;
    this.dyingT -= dt;
    if (Math.random() < dt * 9) {
      W.explode(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(14, 26), { owner: 'p', dmg: 4, tileDmg: 12 });
    }
    if (this.dyingT <= 0) {
      this.dead = true;
      W.explode(this.cx, this.cy, 60, { owner: 'p', dmg: 20, tileDmg: 60, fire: true });
      W.shake(12); W.flashT = 0.2;
      FX.debris(this.cx, this.cy, this.def.gib, 30, 2);
      W.onBossDestroyed(this);
    }
  }
  // heavy bosses smash through whatever blocks them
  plow() {
    if (!this.hitWall) return;
    const T = this.W.terrain;
    const px = this.hitWall > 0 ? this.x + this.w + 2 : this.x - 2;
    for (let py = this.y + 2; py < this.y + this.h - 1; py += 8) {
      const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
      const t = T.get(cx, cy);
      if (t && !TDEF[t].indestructible && T.inb(cx, cy)) T.damage(cx, cy, 45, 'melee');
    }
  }
  smashTiles() {
    const T = this.W.terrain;
    for (let py = this.y + 4; py < this.y + this.h - 2; py += 10) {
      for (let px = this.x + 6; px < this.x + this.w - 4; px += 12) {
        const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
        if (T.solid(cx, cy) && T.inb(cx, cy) && !TDEF[T.get(cx, cy)].indestructible) T.damage(cx, cy, 60, 'melee');
      }
    }
  }
  // running into a boss costs a hit point and throws the hero clear - never an instant death
  crushPlayer(x, y, w, h) {
    for (const p of this.W.players) {
      if (!p.dead && rectsOverlap(x, y, w, h, p.x, p.y, p.w, p.h)) p.kill('crush', { dirX: p.cx > this.cx ? 1 : -1, force: 420, dmg: 1, src: 'boss' });
    }
  }
}

// ----------------------------------------------------------------------------
class TankBoss extends BossBase {
  constructor(W, x, groundY, arena) {
    super(W);
    this.name = 'IRON HOG'; this.type = 'tank';
    this.w = 88; this.h = 40; this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0; this.face = -1; this.arena = arena;
    this.hp = this.maxHp = Math.round(120 + W.diff * 50);
    this.aim = 0.2; this.tread = 0; this.cannonCd = 2.2; this.mgCd = 4.5; this.spawnCd = 9; this.burst = 0; this.burstT = 0;
    this.hatch = 0; this.def.gib = ['#4e5448', '#26262c', '#b8302a'];
    this.warmT = 0; this.warmDur = 0; this.recoilT = 0; this.mgWarnT = 0; // telegraphs (1.32)
  }
  // fuel tanks strapped to the back; and a blast into the open hatch while troops climb out
  weakMul(x, y, kind) {
    const bx = this.face < 0 ? this.x + this.w - 22 : this.x;
    if (x >= bx - 2 && x <= bx + 24 && y >= this.y + 4 && y <= this.y + 32) return 2.5;
    if (kind === 'explosion' && this.hatch > 0 && Math.hypot(x - this.hatchX(), y - (this.y - 8)) < 28) return 3;
    return 1;
  }
  hatchX() { return this.face < 0 ? this.x + 50 : this.x + this.w - 50; }
  update(dt) {
    const W = this.W;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.weakFlash > 0) this.weakFlash -= dt;
    if (this.state === 'dying') { this.vx = 0; this.dyingUpdate(dt); return; }
    const p = W.nearestPlayer(this.cx, this.cy);
    const phase2 = this.hp < this.maxHp * 0.45;
    if (this.state === 'enter') {
      this.vx = -55;
      if (this.x + this.w < W.cam.x + Gfx.W - 20 || this.x <= this.arena.x0 + this.w) this.state = 'fight';
    } else if (p && !p.dead) {
      const dx = p.cx - this.cx;
      this.face = dx < 0 ? -1 : 1;
      const ad = Math.abs(dx);
      const sp = phase2 ? 62 : 40;
      let target = 0;
      if (ad > 200) target = Math.sign(dx) * sp; else if (ad < 120) target = -Math.sign(dx) * sp;
      this.vx = approach(this.vx, target, 120 * dt);
      // turret aim
      const piv = this.pivot();
      const want = clamp(Math.atan2(-(p.cy - piv.y), Math.abs(p.cx - piv.x)) + 0.25, -0.15, 0.95);
      if (!(this.warmT > 0)) this.aim = approach(this.aim, want, dt * 1.2); // the barrel holds still while it loads
      this.cannonCd -= dt; this.mgCd -= dt; this.spawnCd -= dt;
      // 1.32: each attack shows before it comes - the barrel stops and its mouth glows (0.35 s), the MG port blinks red (0.45 s)
      if (this.warmT > 0) { this.warmT -= dt; if (this.warmT <= 0) this.shootCannon(p, phase2); }
      else if (this.cannonCd <= 0) {
        const w = TUNE.charAnim ? 0.35 * TUNE.bossWarn : 0;
        if (w > 0) { this.warmT = this.warmDur = w; Sound.play('reload', 0.7); } else this.shootCannon(p, phase2);
      }
      if (this.mgWarnT > 0) { this.mgWarnT -= dt; if (this.mgWarnT <= 0) { this.burst = phase2 ? 12 : 8; this.burstT = 0; } }
      else if (this.mgCd <= 0 && this.burst === 0) {
        this.mgCd = rand(3.5, 5);
        const w = TUNE.charAnim ? 0.45 * TUNE.bossWarn : 0;
        if (w > 0) { this.mgWarnT = w; Sound.play('beep', 0.6, 2.2); } else { this.burst = phase2 ? 12 : 8; this.burstT = 0; }
      }
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burst--; this.burstT = 0.09;
          const mx = this.face < 0 ? this.x + 2 : this.x + this.w - 2, my = this.y + this.h - 12;
          W.projectiles.push(new Projectile({ x: mx, y: my, vx: this.face * 250, vy: rand(-10, 10), team: 'e', src: 'boss', kind: 'bullet', tileDmg: 2, life: 2 }));
          FX.muzzle(mx, my, this.face, 3); Sound.play('eshot', 0.8);
        }
      }
      if (this.spawnCd <= 0) {
        this.spawnCd = phase2 ? 8 : 11;
        this.hatch = 1.2;
        for (let i = 0; i < 2; i++) {
          W.schedule(0.3 + i * 0.35, () => {
            if (this.dead || this.state === 'dying') return;
            const e = new Enemy(W, Math.random() < 0.3 ? 'bomber' : 'grunt', this.cx + rand(-6, 6), this.y - 2, { alert: true, face: this.face });
            e.vy = -260; e.vx = this.face * rand(60, 110);
            W.enemies.push(e);
          });
        }
      }
      if (phase2 && Math.random() < dt * 4) FX.smokePuff(this.x + rand(20, 70), this.y + 4, 1);
    } else {
      this.vx = approach(this.vx, 0, 200 * dt); // hero down: idle until the next drop
      this.warmT = 0; this.mgWarnT = 0;
    }
    if (this.state === 'fight') {
      const minX = this.arena.x0 + 16 * 3, maxX = this.arena.x1 - this.w - 16;
      if ((this.x < minX && this.vx < 0) || (this.x > maxX && this.vx > 0)) this.vx = 0;
    }
    if (this.hatch > 0) this.hatch -= dt;
    if (this.recoilT > 0) this.recoilT -= dt;
    this.tread += this.vx * dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    moveBody(this, W.terrain, dt);
    this.plow();
    if (Math.abs(this.vx) > 1 && Math.random() < dt * 10) FX.dust(this.face < 0 ? this.x + this.w - 6 : this.x + 6, this.y + this.h, 1);
    this.crushPlayer(this.x + 6, this.y + 10, this.w - 12, this.h - 10);
  }
  pivot() {
    // barrel pivot in world coords (turret front)
    const lx = 30, ly = 3;
    return { x: this.face < 0 ? this.x + lx : this.x + this.w - lx, y: this.y + ly };
  }
  shootCannon(p, phase2) {
    this.fireCannon(p);
    // (the next glow comes out of the same pause: the telegraph shows the shot, it doesn't slow the gun)
    this.cannonCd = (phase2 ? rand(1.6, 2.2) : rand(2.4, 3.2)) - (TUNE.charAnim ? 0.35 * TUNE.bossWarn : 0);
    if (TUNE.charAnim) {
      // the shot rocks the tank back on its tracks, the barrel slams back and runs out again
      this.recoilT = 0.3; this.vx -= this.face * 30;
      FX.dust(this.face < 0 ? this.x + this.w - 10 : this.x + 10, this.y + this.h, 4, -this.face);
    }
  }
  fireCannon(p) {
    const W = this.W, piv = this.pivot();
    const tipX = piv.x + this.face * Math.cos(this.aim) * 34, tipY = piv.y - Math.sin(this.aim) * 34;
    const g = 520;
    const dx = p.cx - tipX, dy = p.cy - tipY;
    const Tf = clamp(Math.abs(dx) / 230, 0.7, 1.5);
    const vx = dx / Tf, vy = (dy - 0.5 * g * Tf * Tf) / Tf;
    // the landing spot is marked on the ground like a mortar round's: a dodge you can read
    const gy = W.terrain.groundBelow(p.cx, p.y + p.h - 4, 120);
    if (gy !== null) W.props.push(new TargetMark(p.cx, gy, Tf));
    W.projectiles.push(new Projectile({
      x: tipX, y: tipY, vx, vy, grav: g, team: 'e', src: 'boss', kind: 'shell', sprite: Sprites.props.shell,
      radius: 32, explodeDmg: 12, explodeTile: 18, life: 4,
    }));
    FX.muzzle(tipX, tipY, this.face, 8); FX.smokePuff(tipX, tipY, 1.2);
    Sound.play('explosion', 0.5, 1.8); W.shake(3);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const A = BossArt;
    const fl = this.flash > 0;
    ctx.save();
    if (this.face > 0) { ctx.translate(x + this.w, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    const hx = x - 5, hy = y + 8;
    // barrel
    const px = x + 30, py = y + 3, rk = this.recoilT > 0 ? Math.round(5 * Math.pow(this.recoilT / 0.3, 2)) : 0;
    ctx.save(); ctx.translate(px, py); ctx.rotate(this.aim);
    ctx.drawImage(A.tankBarrel, -34 + rk, -3);
    if (this.warmT > 0) {
      // the round is in: the muzzle glows, brighter and faster toward the shot
      const k = 1 - this.warmT / (this.warmDur || 0.35);
      if (((this.t * (10 + 20 * k)) | 0) % 2) { ctx.fillStyle = k > 0.6 ? '#fff4a0' : '#ff8a2a'; ctx.fillRect(-35, -2, 3, 3); }
    }
    ctx.restore();
    if (this.warmT > 0) { const piv = this.pivot(); FX.lightNow(piv.x + this.face * Math.cos(this.aim) * 34, piv.y - Math.sin(this.aim) * 34, 22, '#ff9a3a', 0.6); }
    if (this.mgWarnT > 0 && ((this.t * 14) | 0) % 2) {
      // the machine gun port blinks red: a burst along the ground is coming - jump it
      ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x, y + this.h - 14, 4, 3); ctx.fillStyle = '#ffd0c0'; ctx.fillRect(x + 1, y + this.h - 13, 2, 1);
      FX.lightNow(this.face < 0 ? this.x + 2 : this.x + this.w - 2, this.y + this.h - 12, 18, '#ff3a2a', 0.5);
    }
    ctx.drawImage(fl ? (A.tankTurretW || (A.tankTurretW = silhouette(A.tankTurret, '#fff'))) : A.tankTurret, x + 22, y - 6);
    if (this.hatch > 0) { ctx.fillStyle = '#26262c'; ctx.fillRect(x + 44, y - 12, 12, 3); }
    ctx.drawImage(fl ? (A.tankHullW || (A.tankHullW = silhouette(A.tankHull, '#fff'))) : A.tankHull, hx, hy);
    ctx.drawImage(A.tankWheels[((Math.abs(this.tread) / 3) | 0) % 3], hx, hy);
    // the weak spot: two fuel drums strapped on the rear deck, glowing
    const glow = this.weakFlash > 0 || ((this.t * 2) | 0) % 2;
    for (const dx of [70, 79]) {
      ctx.fillStyle = '#15131c'; ctx.fillRect(x + dx - 1, y + 5, 9, 11);
      ctx.fillStyle = fl ? '#ffffff' : '#e8781c'; ctx.fillRect(x + dx, y + 6, 7, 9);
      ctx.fillStyle = fl ? '#ffffff' : '#15131c'; ctx.fillRect(x + dx, y + 9, 7, 1); ctx.fillRect(x + dx, y + 12, 7, 1);
      if (glow) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + dx - 1, y + 4, 9, 1); }
    }
    if (this.hatch > 0 && ((this.t * 8) | 0) % 2) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + 46, y - 13, 8, 1); }
    ctx.restore();
  }
}

// ----------------------------------------------------------------------------
class GunshipBoss extends BossBase {
  constructor(W, x, groundY, arena) {
    super(W);
    this.name = 'SKYREAPER'; this.type = 'gunship';
    this.w = 76; this.h = 24; this.x = x; this.groundY = groundY; this.arena = arena;
    this.hoverY = groundY - 130; this.y = this.hoverY;
    this.vx = 0; this.vy = 0; this.face = -1;
    this.hp = this.maxHp = Math.round(130 + W.diff * 40);
    this.mode = 'hover'; this.modeT = 7; this.side = 1; this.missileCd = 2; this.bombCd = 3; this.gunCd = 0; this.rot = 0;
    this.podT = 0; this.bayT = 0; this.velX = 0; // telegraphs, the lean (1.32)
    this.def.gib = ['#2e3238', '#1e2126', '#b8302a'];
  }
  // the tail boom: the rotor gearbox has no armor
  weakMul(x, y) {
    const tx = this.face < 0 ? this.x + this.w - 18 : this.x - 2;
    return x >= tx && x <= tx + 20 && y >= this.y - 4 && y <= this.y + 16 ? 2.2 : 1;
  }
  update(dt) {
    const W = this.W, p = W.nearestPlayer(this.cx, this.cy);
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.weakFlash > 0) this.weakFlash -= dt;
    if (this.podT > 0) this.podT -= dt;
    // its speed, for the lean into the flight
    this.velX = lerp(this.velX, (this.x - (this.lastX == null ? this.x : this.lastX)) / Math.max(dt, 1e-4), Math.min(1, dt * 6)); this.lastX = this.x;
    Sound.loop('heli', true, W.volAt(this.cx, this.cy) * 0.8);
    if (this.state === 'dying') {
      this.rot += dt * 5; this.vy = Math.min(this.vy + 300 * dt, 300); this.vx *= 0.99;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.random() < 0.8) FX.smokePuff(this.cx + rand(-10, 10), this.cy, 1.2);
      if (W.terrain.solidAt(this.cx, this.y + this.h)) this.dyingT = Math.min(this.dyingT, 0.01);
      this.dyingUpdate(dt);
      if (this.dead) Sound.loop('heli', false);
      return;
    }
    const phase2 = this.hp < this.maxHp * 0.45;
    if (this.state === 'enter') {
      const tx = (this.arena.x0 + this.arena.x1) / 2;
      this.x = approach(this.x, tx, 120 * dt);
      this.y = this.hoverY + Math.sin(this.t * 2) * 6;
      if (Math.abs(this.x - tx) < 2) { this.state = 'fight'; }
      return;
    }
    if (!p || p.dead) { this.y = approach(this.y, this.hoverY, 60 * dt); this.bayT = 0; return; }
    this.modeT -= dt;
    if (this.bayT > 0) { this.bayT -= dt; if (this.bayT <= 0) this.dropBomb(); }
    if (this.mode === 'hover') {
      const tx = clamp(p.cx + this.side * 110 - this.w / 2, this.arena.x0, this.arena.x1 - this.w);
      this.vx = approach(this.vx, clamp((tx - this.x) * 1.5, -140, 140), 220 * dt);
      this.x += this.vx * dt;
      this.y = approach(this.y, this.hoverY + Math.sin(this.t * 1.7) * 8, 80 * dt);
      this.face = p.cx < this.cx ? -1 : 1;
      this.missileCd -= dt; this.bombCd -= dt;
      // one rocket at a time, two when it's hurt (the second boss was the wall the simulated
      // players hit hardest: ~5 lost heroes per attempt with 2-3 rockets a volley)
      if (this.missileCd <= 0) {
        this.missileCd = phase2 ? 1.8 : 2.4;
        // 1.32: the pod lights up a moment before each rocket leaves it
        const w = TUNE.charAnim ? 0.3 * TUNE.bossWarn : 0;
        for (let i = 0; i < (phase2 ? 2 : 1); i++) {
          W.schedule(i * 0.3, () => {
            if (this.dead || this.state === 'dying') return;
            if (w > 0) { this.podT = w; Sound.play('beep', 0.5, 2.2); W.schedule(w, () => this.fireMissile()); } else this.fireMissile();
          });
        }
      }
      if (this.bombCd <= 0 && this.bayT <= 0 && Math.abs(p.cx - this.cx) < 90) {
        this.bombCd = phase2 ? 1.6 : 2.6;
        const w = TUNE.charAnim ? 0.25 * TUNE.bossWarn : 0; // the bomb bay opens first
        if (w > 0) { this.bayT = w; Sound.play('reload', 0.6); } else this.dropBomb();
      }
      if (this.modeT <= 0) {
        this.mode = 'strafeIn'; this.side = p.cx < (this.arena.x0 + this.arena.x1) / 2 ? 1 : -1;
        this.modeT = 4;
      }
    } else if (this.mode === 'strafeIn') {
      const tx = this.side > 0 ? this.arena.x1 - this.w + 40 : this.arena.x0 - 40;
      this.x = approach(this.x, tx, 170 * dt);
      const ty = this.groundY - 44;
      this.y = approach(this.y, ty, 110 * dt);
      this.face = -this.side;
      if ((Math.abs(this.x - tx) < 2 && Math.abs(this.y - ty) < 2) || this.modeT <= 0) { this.mode = 'strafe'; this.modeT = 6; this.gunCd = 0.4; }
    } else if (this.mode === 'strafe') {
      this.x += this.face * (phase2 ? 175 : 140) * dt;
      this.y = this.groundY - 44 + Math.sin(this.t * 4) * 3;
      this.gunCd -= dt;
      if (this.gunCd <= 0) {
        this.gunCd = phase2 ? 0.1 : 0.14;
        const mx = this.face < 0 ? this.x + 2 : this.x + this.w - 2, my = this.y + 20;
        W.projectiles.push(new Projectile({ x: mx, y: my, vx: this.face * 260, vy: rand(-6, 14), team: 'e', src: 'boss', kind: 'bullet', tileDmg: 3, life: 2 }));
        FX.muzzle(mx, my, this.face, 3); Sound.play('eshot', 0.8);
      }
      const done = this.face < 0 ? this.x < this.arena.x0 - 20 : this.x > this.arena.x1 - this.w + 20;
      if (done || this.modeT <= 0) { this.mode = 'hover'; this.modeT = phase2 ? 5 : 7; this.side = -this.side; }
    }
    if (this.mode !== 'hover') this.smashTiles();
    this.crushPlayer(this.x + 8, this.y + 8, this.w - 16, this.h - 8);
  }
  dropBomb() {
    const W = this.W;
    if (this.dead || this.state === 'dying') return;
    const bx = this.cx, by = this.y + this.h, bvx = this.vx * 0.5;
    W.projectiles.push(new Projectile({ x: bx, y: by, vx: bvx, vy: 20, grav: 600, team: 'e', src: 'boss', kind: 'shell', sprite: Sprites.props.shell, radius: 28, explodeDmg: 10, explodeTile: 16, life: 4 }));
    // where it will land, marked on the ground
    const gy = W.terrain.groundBelow(bx, by + 4, 300);
    if (gy !== null) { const t = (-20 + Math.sqrt(400 + 1200 * Math.max(0, gy - by))) / 600; W.props.push(new TargetMark(bx + bvx * t, gy, t)); }
    Sound.play('throw', 0.8);
  }
  // a rocket at a spot on the ground by the hero (straight line, speeding up), the spot marked
  // red like a mortar round's: step off it
  fireMissile() {
    const W = this.W, p = W.nearestPlayer(this.cx, this.cy);
    if (!p || this.dead || this.state === 'dying') return;
    const mx = this.cx + rand(-10, 10), my = this.y + this.h;
    const tx = p.cx + rand(-20, 20), gy = W.terrain.groundBelow(tx, p.y + p.h - 4, 120);
    const ty = gy !== null ? gy - 2 : p.cy;
    const dx = tx - mx, dy = ty - my;
    const d = Math.hypot(dx, dy) || 1;
    W.projectiles.push(new Projectile({ x: mx, y: my, vx: dx / d * 150, vy: dy / d * 150, team: 'e', src: 'boss', kind: 'erocket', sprite: Sprites.props.erocket, radius: 26, explodeDmg: 10, explodeTile: 16, life: 3.5, accel: 120, maxSpeed: 240 }));
    // flight time: from 150 px/s, +120 px/s² up to 240 px/s
    const t = d <= 146.25 ? (-150 + Math.sqrt(22500 + 240 * d)) / 120 : 0.75 + (d - 146.25) / 240;
    if (gy !== null) W.props.push(new TargetMark(tx, gy, t));
    Sound.play('rocket', 0.7);
  }
  draw(ctx, cx, cy) {
    const f = BossArt.gunship[((this.t * 30) | 0) % 3];
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.save();
    ctx.translate(x + this.w / 2, y + this.h / 2);
    // it leans into its flight, nose down the way it goes (1.32; in steps, so the pixels don't crawl)
    const lean = TUNE.charAnim && this.state !== 'dying' ? Math.round(clamp(this.velX / 150, -1, 1) * 2) * 0.05 : 0;
    if (this.rot || lean) ctx.rotate(this.rot + lean);
    if (this.face > 0) ctx.scale(-1, 1);
    const img = this.flash > 0 ? (BossArt.gunshipW || (BossArt.gunshipW = BossArt.gunship.map((c) => silhouette(c, '#fff'))))[((this.t * 30) | 0) % 3] : f;
    ctx.drawImage(img, -48, -22);
    if (this.podT > 0 && ((this.t * 16) | 0) % 2) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(-22, 6, 3, 4); ctx.fillRect(-10, 6, 3, 4); } // the rocket pods light up
    if (this.bayT > 0) { ctx.fillStyle = '#0c0b10'; ctx.fillRect(-5, 4, 10, 2); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(-1, 5, 2, 1); } // the bomb bay open
    if (this.weakFlash > 0 || ((this.t * 3) | 0) % 2) { ctx.fillStyle = this.weakFlash > 0 ? '#ffffff' : '#ff8a2a'; ctx.fillRect(34, -12, 3, 3); } // tail gearbox light
    ctx.restore();
  }
}

// ----------------------------------------------------------------------------
class MechBoss extends BossBase {
  constructor(W, x, groundY, arena) {
    super(W);
    this.name = 'GRIMM WALKER'; this.type = 'mech';
    this.w = 40; this.h = 62; this.x = x; this.y = groundY - this.h; this.arena = arena;
    this.vx = 0; this.vy = 0; this.face = -1;
    this.hp = this.maxHp = Math.round(190 + W.diff * 40);
    this.atkCd = 2.5; this.action = null; this.actT = 0; this.walk = 0; this.burst = 0; this.burstT = 0; this.markers = [];
    this.def.gib = ['#5a1e1e', '#44474f', '#34363e'];
    this.open = 0; this.stagger = 0; this.landSq = 0; this.kickT = 0; // the crouch, the recoil (1.32)
  }
  // the general's cockpit: open (and worth triple) after a stomp landing and while he flames
  weakMul(x, y) {
    if (this.open <= 0) return 1;
    const x0 = this.face < 0 ? this.x + 2 : this.x + 20;
    return x >= x0 && x <= x0 + 18 && y >= this.y + 4 && y <= this.y + 22 ? 3 : 1;
  }
  update(dt) {
    const W = this.W, p = W.nearestPlayer(this.cx, this.cy);
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    for (let i = this.markers.length - 1; i >= 0; i--) { this.markers[i].t -= dt; if (this.markers[i].t <= 0) this.markers.splice(i, 1); }
    if (this.open > 0) this.open -= dt;
    if (this.weakFlash > 0) this.weakFlash -= dt;
    if (this.landSq > 0) this.landSq -= dt;
    if (this.kickT > 0) this.kickT -= dt;
    if (this.state === 'dying') { this.vx = 0; this.vy = Math.min(this.vy + GRAVITY * dt, 500); moveBody(this, W.terrain, dt); this.dyingUpdate(dt); return; }
    const phase2 = this.hp < this.maxHp * 0.5;
    if (this.state === 'enter') {
      this.vx = -45;
      if (this.x + this.w < W.cam.x + Gfx.W - 24 || this.x <= this.arena.x0 + 64) this.state = 'fight';
    } else if (p && !p.dead) {
      const dx = p.cx - this.cx, ad = Math.abs(dx);
      if (this.stagger > 0) { this.stagger -= dt; this.vx = 0; } // rocked by his own landing: cockpit open
      else if (!this.action) {
        this.face = dx < 0 ? -1 : 1;
        this.vx = ad > 110 ? this.face * (phase2 ? 50 : 36) : ad < 60 ? -this.face * 30 : 0;
        this.atkCd -= dt;
        if (this.atkCd <= 0) {
          const opts = [];
          if (ad > 70) opts.push('barrage', 'cannon');
          if (ad < 150) opts.push('stomp');
          if (ad < 90) opts.push('flame', 'flame');
          this.action = pick(opts.length ? opts : ['cannon']); this.actT = 0;
          this.atkCd = phase2 ? rand(0.9, 1.4) : rand(1.5, 2.2);
          if (this.action === 'flame' && TUNE.charAnim) this.atkCd = Math.max(0.3, this.atkCd - 0.4 * TUNE.bossWarn); // the flamer's warm-up doesn't slow the walker down
        }
      } else this.doAction(dt, p, phase2);
    } else if (this.onGround) {
      // hero down: finish any leap, then stand still until the next drop
      this.vx = approach(this.vx, 0, 300 * dt); this.action = null; this.jumped = false;
    }
    if (this.state === 'fight') {
      const minX = this.arena.x0 + 16 * 2, maxX = this.arena.x1 - this.w - 16;
      if ((this.x < minX && this.vx < 0) || (this.x > maxX && this.vx > 0)) this.vx = 0;
    }
    this.walk += Math.abs(this.vx) * dt * 0.12;
    const wasGround = this.onGround;
    this.vy = Math.min(this.vy + GRAVITY * dt, 600);
    moveBody(this, W.terrain, dt);
    this.plow();
    if (this.onGround && !wasGround && this.landVy > 300) {
      W.explode(this.cx, this.y + this.h, 54, { owner: 'e', dmg: 12, tileDmg: 8, src: 'boss' });
      FX.addEffect({ type: 'ring', x: this.cx, y: this.y + this.h, r: 80, dur: 0.4 });
      W.shake(10); Sound.play('stomp');
      this.landSq = 0.22; // it squats under its own weight
    }
    this.crushPlayer(this.x + 4, this.y + 4, this.w - 8, this.h - 4);
  }
  doAction(dt, p, phase2) {
    const W = this.W;
    this.actT += dt;
    if (!(this.action === 'stomp' && this.jumped)) this.vx = 0;
    switch (this.action) {
      case 'barrage': {
        const n = phase2 ? 8 : 6;
        if (this.actT < 0.05) {
          for (let i = 0; i < n; i++) {
            const tx = p.cx + (i - (n - 1) / 2) * 26 + rand(-8, 8);
            this.markers.push({ x: tx, t: 1.3 });
            W.schedule(0.1 + i * 0.07, () => {
              FX.spawn(this.cx + 10, this.y + 2, rand(-30, 30), -340, 0.5, 3, '#fff', PF.CIRCLE | PF.SHRINK, 1);
              Sound.play('rocket', 0.5);
            });
            W.schedule(1.2 + i * 0.07, () => {
              W.projectiles.push(new Projectile({ x: tx, y: W.cam.y - 20, vx: 0, vy: 480, team: 'e', src: 'boss', kind: 'missile', sprite: Sprites.props.missile, radius: 26, explodeDmg: 10, explodeTile: 12, life: 3 }));
            });
          }
        }
        if (this.actT > 0.8) this.action = null;
        break;
      }
      case 'cannon':
        if (this.actT < 0.05) { this.burst = phase2 ? 7 : 5; this.burstT = 0.3; }
        this.burstT -= dt;
        if (this.burst > 0 && this.burstT <= 0) {
          this.burst--; this.burstT = 0.12;
          const mx = this.face < 0 ? this.x - 4 : this.x + this.w + 4, my = this.y + this.h - 30;
          const dy = p.cy - my, dx = Math.abs(p.cx - mx);
          const vy = clamp(dy / Math.max(dx, 1) * 300, -120, 160);
          W.projectiles.push(new Projectile({ x: mx, y: my, vx: this.face * 300, vy, team: 'e', src: 'boss', kind: 'bullet', tileDmg: 3, life: 2 }));
          FX.muzzle(mx, my, this.face, 5); Sound.play('mg', 0.9); this.kickT = 0.06;
        }
        if (this.burst <= 0 && this.actT > 0.4) this.action = null;
        break;
      case 'stomp':
        if (this.actT < 0.45) { if (Math.random() < 0.5) FX.dust(this.cx, this.y + this.h, 1); break; }
        if (!this.jumped) {
          this.jumped = true;
          const dx = clamp(p.cx - this.cx, -200, 200);
          this.vy = -440; this.vx = dx / 0.95;
          Sound.play('jump', 1);
        }
        if (this.jumped && this.onGround && this.actT > 0.6) { this.jumped = false; this.action = null; this.vx = 0; this.stagger = 1.4; this.open = 1.6; }
        return;
      case 'flame': {
        // 1.32: the nozzle sputters first (0.4 s) - step back now - then the stream
        const warm = TUNE.charAnim ? 0.4 * TUNE.bossWarn : 0, t = this.actT - warm;
        const nx = this.face < 0 ? this.x - 2 : this.x + this.w + 2, ny = this.y + this.h - 28;
        this.open = Math.max(this.open, 0.25);
        if (t < 0) {
          if (this.actT <= dt * 1.5) Sound.play('hiss', 0.9);
          if (Math.random() < 0.6) FX.flame(nx + this.face * rand(0, 5), ny + rand(-2, 2));
        } else if (t < 1.3) {
          if (Math.random() < 0.8) {
            W.projectiles.push(new Projectile({
              x: nx, y: ny, vx: this.face * rand(170, 240), vy: rand(-20, 30),
              kind: 'flame', team: 'e', src: 'boss', life: rand(0.4, 0.55), dmg: 0,
            }));
          }
          Sound.play('flameTick', 0.8);
        } else this.action = null;
        break;
      }
    }
  }
  draw(ctx, cx, cy) {
    const A = BossArt;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    for (const m of this.markers) {
      if (((m.t * 10) | 0) % 2) continue;
      const gy = this.W.terrain.groundBelow(m.x, this.W.cam.y, 600);
      if (gy === null) continue;
      ctx.fillStyle = '#ff3a2a';
      const mx = Math.round(m.x - cx), my = Math.round(gy - cy);
      ctx.fillRect(mx - 6, my - 1, 12, 1); ctx.fillRect(mx - 1, my - 5, 2, 4);
    }
    ctx.save();
    ctx.translate(x + this.w / 2, 0);
    if (this.face > 0) ctx.scale(-1, 1);
    const fl = this.flash > 0;
    // 1.32: it crouches before a leap, squats when it lands, rocks while staggered, jolts with its cannon
    let sq = 0;
    if (TUNE.charAnim) {
      if (this.action === 'stomp' && !this.jumped) sq = Math.round(5 * Math.min(1, this.actT / 0.45));
      else if (this.landSq > 0) sq = Math.round(5 * this.landSq / 0.22);
      else if (this.stagger > 0) sq = 1 + Math.round(Math.sin(this.t * 9));
    }
    const jolt = TUNE.charAnim && this.kickT > 0 ? 1 : 0;
    const warm = 0.4 * TUNE.bossWarn;
    if (TUNE.charAnim && this.action === 'flame' && warm > 0 && this.actT < warm) FX.lightNow(this.face < 0 ? this.x - 2 : this.x + this.w + 2, this.y + this.h - 28, 12 + 12 * (this.actT / warm), '#ff9a3a', 0.5); // the nozzle glows up
    // legs
    const legC = fl ? '#ffffff' : '#34363e', legD = fl ? '#ffffff' : '#22242a', footC = fl ? '#ffffff' : '#44474f';
    const hipY = y + 32 + sq;
    for (let side = 0; side < 2; side++) {
      const ph = this.walk * Math.PI * 2 + side * Math.PI;
      const swing = this.onGround ? Math.sin(ph) * 7 : (side ? 6 : -6);
      const lift = this.onGround ? Math.max(0, Math.cos(ph)) * 4 : 4;
      const hx = side ? 6 : -8;
      const kx = hx + swing * 0.5 - 3 - sq, ky = hipY + 14 - lift * 0.5; // a crouch bends the knees forward
      const fx2 = hx + swing, fyy = y + this.h - 4 - lift;
      ctx.fillStyle = '#15131c';
      ctx.fillRect(Math.round(hx - 1), hipY - 1, 10, 16); ctx.fillRect(Math.round(kx - 1), ky - 1, 10, fyy - ky + 2);
      ctx.fillStyle = side ? legC : legD;
      ctx.fillRect(Math.round(hx), hipY, 8, 14); ctx.fillRect(Math.round(kx), ky, 8, fyy - ky);
      ctx.fillStyle = '#15131c'; ctx.fillRect(Math.round(fx2 - 8), fyy - 1, 18, 6);
      ctx.fillStyle = footC; ctx.fillRect(Math.round(fx2 - 7), fyy, 16, 4);
    }
    const img = fl ? (A.mechTorsoW || (A.mechTorsoW = silhouette(A.mechTorso, '#fff'))) : A.mechTorso;
    ctx.drawImage(img, -30 + jolt, y - 4 + sq);
    if (this.open > 0) {
      // canopy up: a glowing frame around the general
      const oy = y + sq;
      ctx.fillStyle = this.weakFlash > 0 ? '#ffffff' : ((this.t * 8) | 0) % 2 ? '#ffd23a' : '#ff8a2a';
      ctx.fillRect(-18 + jolt, oy + 5, 16, 1); ctx.fillRect(-18 + jolt, oy + 5, 1, 12); ctx.fillRect(-3 + jolt, oy + 5, 1, 12); ctx.fillRect(-18 + jolt, oy + 1, 16, 2);
    }
    ctx.restore();
  }
}

// Burnt-out boss hull left on the battlefield.
class Wreck {
  constructor(boss) {
    this.dead = false; this.hittable = false;
    this.x = boss.x; this.y = boss.y; this.w = boss.w; this.h = boss.h; this.face = boss.face; this.type = boss.type;
    this.t = 0;
  }
  update(dt, W) { this.t += dt; if (Math.random() < dt * 3) FX.smokePuff(this.x + rand(10, this.w - 10), this.y + 6, 1); }
  draw(ctx, cx, cy) {
    const A = BossArt;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.type === 'tank') {
      const hull = A.tankHullDark || (A.tankHullDark = silhouette(A.tankHull, '#2a2420'));
      ctx.save();
      if (this.face > 0) { ctx.translate(x + this.w, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
      ctx.drawImage(hull, x - 5, y + 8);
      ctx.restore();
    } else if (this.type === 'mech') {
      ctx.drawImage(A.mechWreck, x - 10, y + this.h - 30);
    }
  }
}
