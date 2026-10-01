'use strict';
// ============================================================================
//  General Grimm's support: troop trucks and bombing runs called in by radio
//  officers.
//  Everything here is telegraphed: the truck is seen (and heard) before its
//  squad jumps out, an air strike is marked by red smoke and target marks
//  on the ground a good second and a half before the bombs land.
// ============================================================================

// called from World.update a few times a second
function armyUpdate(W, dt) {
  W.armyT = (W.armyT || 0) - dt;
  if (W.armyT > 0) return;
  W.armyT = 0.3;
  const p = W.player;
  if (!p || p.dead || W.state === 'intro') return;
  // troop trucks roll in once the hero passes their trigger point
  for (const ev of W.truckEvents) {
    if (ev.done || p.cx < ev.x) continue;
    ev.done = true;
    const dir = -1, x = W.cam.x + Gfx.W + 60;
    if (x > W.terrain.w * TILE - 40) continue;
    const gy = W.terrain.groundBelow(x, W.cam.y - 40, Gfx.H + 240);
    if (gy === null) continue;
    W.props.push(new TroopTruck(W, x, gy, dir, 3 + Math.round(W.diff * 2)));
  }
}

// ---------------------------------------------------------------------------
//  Radio officer's bombing run
// ---------------------------------------------------------------------------
World.prototype.enemyAirstrike = function (src, p) {
  const T = this.terrain;
  const gy = T.groundBelow(p.cx, p.y, 320);
  if (gy === null) return;
  const x0 = p.cx, dir = src.cx < p.cx ? 1 : -1;
  this.props.push(new SmokeFlare(x0, gy, 2.6));
  for (let i = 0; i < 5; i++) {
    const bx = x0 + (i - 2) * 26 + rand(-4, 4), land = 1.55 + i * 0.1;
    const by = T.groundBelow(bx, gy - 48, 220);
    if (by !== null) this.props.push(new TargetMark(bx, by, land));
    // bombs drop in from above the screen and land when their mark runs out
    const fall = Math.max(0.2, ((by !== null ? by : gy) - (this.cam.y - 30)) / 560);
    this.schedule(Math.max(0.05, land - fall), () => {
      this.projectiles.push(new Projectile({
        x: bx, y: this.cam.y - 30, vx: 0, vy: 560, kind: 'missile', team: 'e', src: 'airstrike',
        sprite: Sprites.props.missile, radius: 28, explodeDmg: 10, explodeTile: 30, life: 3,
      }));
    });
  }
  this.schedule(1.05, () => { this.props.push(new JetFlyby(dir)); Sound.play('jet', 0.9); });
  Sound.play('radio', this.volAt(src.cx, src.cy));
};

// red smoke column marking where the bombs will fall
class SmokeFlare {
  constructor(x, gy, dur) { this.x = x; this.y = gy; this.t = dur; this.dead = false; this.hittable = false; this.w = 1; this.h = 1; this.a = 0; }
  update(dt) {
    this.t -= dt; this.a += dt;
    if (this.t <= 0) { this.dead = true; return; }
    if (Math.random() < dt * 16) FX.spawn(this.x + rand(-2, 2), this.y - 4, rand(-10, 10), rand(-55, -30), rand(0.9, 1.5), rand(2, 4), pick(['#e8321e', '#ff6a4a', '#c0302a', '#ff8a6a']), PF.CIRCLE | PF.GROW);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 2, y - 6, 5, 6);
    ctx.fillStyle = ((this.a * 8) | 0) % 2 ? '#ff5a3a' : '#c0302a'; ctx.fillRect(x - 1, y - 5, 3, 5);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(x, y - 6, 1, 1);
  }
}

// the bomber jet: a silhouette streaking across the top of the screen
class JetFlyby {
  constructor(dir) { this.dir = dir; this.t = 0; this.dead = false; this.hittable = false; this.x = 0; this.y = 0; this.w = 1; this.h = 1; }
  update(dt) { this.t += dt; if (this.t > 1.2) this.dead = true; }
  draw(ctx) {
    const W = Gfx.W, k = this.t / 1.1, d = this.dir;
    const x = Math.round(d > 0 ? -40 + k * (W + 80) : W + 40 - k * (W + 80)), y = 30;
    const R = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(d > 0 ? x + xx : x - xx - w, y + yy, w, h); };
    R(-14, -1, 26, 5, '#15131c'); R(-12, 0, 22, 3, '#3a3f48'); R(8, 1, 5, 1, '#3a3f48');   // fuselage + nose
    R(-4, -5, 7, 5, '#15131c'); R(-3, -4, 5, 4, '#2e3238');                               // wing (far)
    R(-4, 3, 9, 4, '#15131c'); R(-3, 3, 7, 3, '#2e3238');                                  // wing (near)
    R(-14, -5, 4, 5, '#15131c'); R(-13, -4, 2, 4, '#2e3238');                             // tail fin
    R(2, 0, 3, 1, '#8fd0ea');                                                              // canopy
    if (((this.t * 30) | 0) % 2) R(-18, 0, 4, 2, '#ffae3a');                              // afterburner
  }
}

// ---------------------------------------------------------------------------
//  Troop truck
// ---------------------------------------------------------------------------
class TroopTruck {
  constructor(W, x, feetY, dir, n) {
    this.W = W; this.w = 46; this.h = 24; this.x = x - this.w / 2; this.y = feetY - this.h;
    this.dir = dir; this.vx = dir * 95; this.vy = 0; this.hp = 22; this.troops = n;
    this.state = 'drive'; this.t = 0; this.unloadT = 0; this.flash = 0; this.engineT = 0; this.wheel = 0;
    this.hittable = true; this.dead = false; this.isTruck = true;
  }
  get cx() { return this.x + this.w / 2; }
  boxFree(x, y) {
    const T = this.W.terrain;
    for (const yy of [y + 1, y + this.h / 2, y + this.h - 1]) for (const xx of [x + 1, x + this.w / 2, x + this.w - 1]) if (T.solidAt(xx, yy)) return false;
    return true;
  }
  update(dt, W) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    const p = W.nearestPlayer(this.cx, this.y);
    if (this.state === 'drive') {
      this.vx = this.dir * 95;
      // stop a little short of the hero and let the squad out
      if (p && Math.abs(p.cx - this.cx) < 150) { this.state = 'unload'; this.unloadT = 0.5; }
    } else this.vx = approach(this.vx, 0, 320 * dt);
    const wasGround = this.onGround;
    moveBody(this, W.terrain, dt);
    if (this.hitWall && this.state === 'drive') {
      // climb a one-tile step, anything taller is where the ride ends
      if (wasGround && this.boxFree(this.x + this.dir * 2, this.y - TILE - 0.5)) { this.y -= TILE + 0.5; this.x += this.dir * 2; }
      else { this.state = 'unload'; this.unloadT = 0.4; }
    }
    this.wheel += this.vx * dt;
    if (this.state === 'unload') {
      this.unloadT -= dt;
      if (this.unloadT <= 0) {
        if (this.troops > 0) {
          this.unloadT = 0.45; this.troops--;
          const pool = ['grunt', 'grunt', 'grunt'];
          if (W.def.pool.grenadier) pool.push('grenadier');
          if (W.def.pool.bomber) pool.push('bomber');
          const e = new Enemy(W, pick(pool), this.dir < 0 ? this.x + this.w - 4 : this.x + 4, this.y + this.h - 2, { alert: true, face: this.dir });
          e.vy = -170; e.vx = -this.dir * 70;
          W.enemies.push(e);
          Sound.play('land', W.volAt(this.cx, this.y) * 0.6);
        } else this.state = 'parked';
      }
    }
    // engine rumble, and smoke once it's badly hit
    this.engineT -= dt;
    if (this.engineT <= 0 && W.onScreen(this.cx, this.y, 80)) { this.engineT = this.state === 'drive' ? 0.4 : 0.9; Sound.play('truck', W.volAt(this.cx, this.y) * (this.state === 'drive' ? 0.8 : 0.35)); }
    if (this.hp < 11 && Math.random() < dt * 6) FX.smokePuff(this.cx + this.dir * 14, this.y + 4, 0.7);
    if (W.terrain.fireAtRect(this.x, this.y, this.w, this.h)) this.hurt(dt * 3, { kind: 'fire', team: W.terrain.fireTeam || 'n' });
  }
  hurt(dmg, info) {
    if (this.dead) return true;
    if (info.team === 'e' && info.kind !== 'explosion') return true; // their own rifles don't stop it
    this.hp -= info.kind === 'explosion' ? dmg * 1.4 : dmg;
    this.flash = 0.06;
    const W = window.world;
    if (W && info.kind !== 'fire') { FX.sparks(this.cx - (info.dirX || 0) * 18, this.y + 10, 2, -(info.dirX || 0)); Sound.play('metal', W.volAt(this.cx, this.y) * 0.7, 0.8); }
    if (this.hp <= 0 && W) this.blow(W, info.team === 'p' ? 'p' : 'n');
    return true;
  }
  blow(W, team) {
    if (this.dead) return;
    this.dead = true;
    const ev = ++W.evSeq, cx = this.cx, cy = this.y + this.h / 2;
    W.explode(cx, cy, 50, { owner: team, dmg: 16, tileDmg: 40, fire: true, env: true, src: 'truck', ev });
    // whoever was still in the back never gets out
    for (let i = 0; i < this.troops; i++) {
      const e = new Enemy(W, 'grunt', cx + rand(-12, 12), this.y + this.h, { alert: true });
      W.enemies.push(e);
      e.hurt(99, { kind: 'explosion', dirX: rand(-1, 1), force: 320, team, env: true, ev });
    }
    this.troops = 0;
    FX.debris(cx, cy, ['#4a5040', '#2a2a30', '#6a6a50', '#8a8a96'], 18, 1.4);
    W.props.push(new FirePatch(cx, this.y + this.h, 48, 3, 'n'));
  }
  draw(ctx, cx, cy) {
    const X = Math.round(this.x - cx), Y = Math.round(this.y - cy), d = this.dir, fl = this.flash > 0;
    // local layout faces right (cab at the right); mirrored when driving left
    const R = (xx, yy, w, h, c) => { ctx.fillStyle = fl ? '#ffffff' : c; ctx.fillRect(d > 0 ? X + xx : X + this.w - xx - w, Y + yy, w, h); };
    const O = '#15131c';
    // soldiers riding in the back (helmets over the tailgate)
    for (let i = 0; i < Math.min(this.troops, 4); i++) { R(3 + i * 6, 0, 5, 3, O); R(4 + i * 6, 0, 3, 2, '#40444e'); }
    // canvas-covered bed
    R(0, 2, 29, 16, O); R(1, 3, 27, 14, '#4f5a3a'); R(1, 3, 27, 2, '#6b7a4a');
    for (let k = 6; k < 28; k += 7) R(k, 4, 1, 12, '#3c4630');
    R(0, 12, 2, 7, '#2a2a30');
    // cab
    R(28, 6, 17, 13, O); R(29, 7, 15, 11, '#4a5040'); R(29, 7, 15, 1, '#6a7258');
    R(36, 8, 7, 5, '#26303a'); R(37, 8, 3, 2, '#8fd0ea');
    R(31, 10, 3, 3, '#c0302a');
    R(44, 11, 2, 7, O); R(44, 12, 2, 2, ((this.t * 2) | 0) % 2 || this.state !== 'drive' ? '#ffe08a' : '#fff6c0');
    // chassis + wheels
    R(0, 17, 46, 3, '#2a2a30');
    for (const wx of [8, 37]) {
      const px = d > 0 ? X + wx : X + this.w - wx;
      ctx.drawImage(circleSprite(O, 5), px - 5, Y + 15);
      ctx.drawImage(circleSprite(fl ? '#ffffff' : '#3a3a44', 4), px - 4, Y + 16);
      const a = this.wheel * 0.25;
      ctx.fillStyle = '#8a8a96'; ctx.fillRect(Math.round(px + Math.cos(a) * 2), Math.round(Y + 20 + Math.sin(a) * 2), 1, 1);
    }
  }
}
