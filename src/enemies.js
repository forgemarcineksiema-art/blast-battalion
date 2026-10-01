'use strict';
// ============================================================================
//  Enemies: soldiers of General Grimm's legion + AI
// ============================================================================

const ENEMY_DEFS = {
  grunt: { look: 'grunt', hp: 1, speed: 30, run: 62, sight: 190, react: 0.7, weapon: 'rifle', burst: 3, gap: 0.16, cd: [1.4, 2.3], score: 100, w: 10, h: 15, gib: ['#4c515c', '#40444e', '#d8a47c', '#c0302a'] },
  bomber: { look: 'bomber', hp: 1, speed: 28, run: 112, sight: 170, react: 0.4, weapon: 'kamikaze', score: 150, w: 10, h: 15, gib: ['#7a6a4a', '#d8a47c', '#2e2c3a'] },
  grenadier: { look: 'grenadier', hp: 1, speed: 28, run: 48, sight: 200, react: 0.65, weapon: 'grenade', cd: [2.3, 3.3], score: 150, w: 10, h: 15, gib: ['#4a5540', '#3d4a36', '#5a5f56'] },
  rpg: { look: 'rpg', hp: 1, speed: 26, run: 44, sight: 230, react: 0.75, weapon: 'rocket', cd: [2.8, 3.8], score: 200, w: 10, h: 15, gib: ['#6a5a44', '#5a4a38', '#d8a47c'] },
  heavy: { look: 'heavy', hp: 14, speed: 20, run: 30, sight: 200, react: 0.55, weapon: 'hmg', burst: 10, gap: 0.075, cd: [1.8, 2.6], score: 600, w: 14, h: 21, heavy: true, gib: ['#44474f', '#303238', '#c98b62', '#c0302a'] },
  // h 12 (sprite is 14 with ears) keeps dogs inside the player's chest-height line of fire
  dog: { look: 'dog', hp: 1, speed: 45, run: 145, sight: 170, react: 0.35, weapon: 'bite', score: 150, w: 14, h: 12, gib: ['#2a2226', '#8a5a34'] },
  turret: { hp: 9, sight: 230, react: 0.5, weapon: 'turret', burst: 5, gap: 0.11, cd: [1.3, 1.9], score: 300, w: 14, h: 12, static: true, gib: ['#5a5f6a', '#3a3d46'] },
  // riot shield: bullets from the front ricochet; knife, explosions, fire or a shot in the back work
  shield: { look: 'shield', hp: 2, speed: 24, run: 44, sight: 180, react: 0.5, weapon: 'bash', score: 250, w: 11, h: 15, gib: ['#3e4c66', '#4a5468', '#d8a47c'] },
  // unarmed lookout: sprints to the nearest siren (paratroopers) and alerts everyone on the way
  scout: { look: 'scout', hp: 1, speed: 34, run: 128, sight: 215, react: 0.2, weapon: 'scout', score: 250, w: 10, h: 15, gib: ['#7a7458', '#5a5640', '#d8a47c'] },
  // lobs shells high over cover; a red marker shows where each one will land
  mortar: { look: 'mortar', hp: 1, speed: 0, run: 0, sight: 300, react: 0.9, weapon: 'mortar', cd: [3.4, 4.6], score: 250, w: 10, h: 15, gib: ['#5a6048', '#444a36', '#d8a47c'] },
  // assassination target: pot-shots with a pistol, backs away when you close in
  // laser sight: the red line follows you, turns white and stops for a moment, then one fast shot down that line
  sniper: { look: 'esniper', hp: 1, speed: 0, run: 0, sight: 400, react: 0.6, weapon: 'snipe', cd: [2.4, 3.4], score: 300, w: 10, h: 15, gib: ['#5a6048', '#444a36', '#d8a47c'] },
  // flamethrower: walks up close, the pilot light flares up (the warning), then a stream of fire; fireproof; his tank bursts after he drops
  flamer: { look: 'eflamer', hp: 3, speed: 22, run: 40, sight: 170, react: 0.55, weapon: 'flame', cd: [2.0, 2.8], score: 350, w: 11, h: 15, fireproof: true, gib: ['#6a4a34', '#4e3626', '#d8a47c', '#c83a2a'] },
  // radio officer: keeps his distance and calls in a bombing run (red smoke + marks first); pistol when you close in
  officer: { look: 'officer', hp: 2, speed: 24, run: 70, sight: 260, react: 0.6, weapon: 'radio', burst: 2, gap: 0.3, cd: [1.2, 1.8], score: 400, w: 10, h: 15, gib: ['#4a5a44', '#34402e', '#d8a47c', '#e8c547'] },
  colonel: { look: 'colonel', hp: 6, speed: 26, run: 92, sight: 210, react: 0.45, weapon: 'pistol', burst: 2, gap: 0.28, cd: [1.0, 1.7], score: 1500, w: 10, h: 15, target: true, gib: ['#5a1a1a', '#3a1010', '#d8a47c', '#e8c547'] },
};

// what a soldier does when he stands about unaware (1.32): looks out, stretches, checks his gun, talks on the radio
const ENEMY_FIDGETS = {
  grunt: ['brow', 'hang', 'reload'], grenadier: ['brow', 'reload'], rpg: ['brow', 'reload'], heavy: ['reload'], shield: ['brow'],
  scout: ['brow'], mortar: ['brow', 'hang'], sniper: ['brow'], flamer: ['reload'], officer: ['radio', 'brow'], colonel: ['brow', 'cheer'], bomber: ['hang'],
};

class Enemy {
  constructor(W, type, x, feetY, opts = {}) {
    const d = ENEMY_DEFS[type];
    this.W = W; this.type = type; this.def = d;
    this.w = d.w; this.h = d.h; this.x = x - d.w / 2; this.y = feetY - d.h;
    this.vx = 0; this.vy = 0;
    this.face = opts.face || (Math.random() < 0.7 ? -1 : 1);
    this.hp = d.hp; this.dead = false; this.hittable = true;
    this.guard = !!opts.guard;
    this.state = this.guard ? 'idle' : 'patrol';
    this.stateT = rand(1, 3); this.alertT = 0; this.cd = rand(0.4, 1.2); this.burst = 0; this.burstT = 0;
    this.burning = 0; this.flash = 0; this.animT = Math.random() * 10; this.lostT = 0; this.icon = null; this.iconT = 0;
    this.throwT = 0; this.beepT = 0; this.stun = 0; this.turnT = 0;
    this.aimT = 0; this.aimLen = 0; this.focus = 0; this.suppT = 0; this.fallTop = null;
    this.snipeT = 0; this.lockT = 0; this.lockDur = 0.35; this.aimE = 0; this.laserLen = 0; // sniper
    this.igniteT = 0; this.sprayT = 0; this.emitT = 0;                                      // flamethrower
    this.callT = 0; this.strikeCd = rand(1.5, 3);                                           // radio officer
    this.flinchT = 0; this.kickT = 0; this.reloadT = 0; this.windT = 0; this.spotT = 0; this.downT = 0; this.getupT = 0; // poses (1.32)
    this.cheerT = 0; this.cheerDelay = 0; this.landT = 0; this.earsT = 0; this.barkT = 0; this.boltT = 0; this.fleeT = 0; this.smokeT = 0;
    this.stride = Math.random(); this.bursts = 0; this.poseRot = 0; this.tubeT = 0;
    this.awake = !!opts.awake;
    this.gfx = type === 'dog' ? Sprites.dog : d.look ? Sprites.chars[d.look] : null;
    this.react = d.react * (1.15 - W.diff * 0.5) * W.skill.react;
    this.shieldUp = type === 'shield';
    if (type === 'mortar' || type === 'sniper') { this.guard = true; this.state = 'idle'; }
    this.para = !!opts.para;
    if (opts.alert || this.para) { this.state = 'attack'; this.awake = true; }
  }
  // riot shield stops bullets travelling toward its front
  blocksFrom(dirX) { return this.shieldUp && this.burning <= 0 && Math.sign(dirX) === -this.face; }
  breakShield() {
    if (!this.shieldUp) return;
    this.shieldUp = false;
    FX.debris(this.cx + this.face * 5, this.cy, ['#4a5468', '#7a86a0', '#2e3444'], 8, 1);
    Sound.play('metal', this.W.volAt(this.cx, this.cy));
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    const W = this.W, T = W.terrain, d = this.def;
    if (this.dead) return;
    this.animT += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.iconT > 0) this.iconT -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.suppT > 0) this.suppT -= dt;
    this.tickPoses(dt);
    if (this.held) { this.updateHeld(); return; }
    if (!this.awake) { if (W.nearCamera(this.cx, this.cy, 150)) this.awake = true; else return; }
    if (d.static) { this.updateTurret(dt); return; }
    if (this.para) { this.updatePara(dt); return; }

    if (this.burning > 0) { this.updateBurning(dt); return; }
    if (!d.fireproof && T.fireAtRect(this.x, this.y, this.w, this.h)) { if (T.fireSrc === 'fuel') this.burnStyle = STYLE.flash; this.ignite(); return; }
    if (this.panicT > 0) { this.updatePanic(dt); return; }
    if (this.state !== 'patrol' && this.state !== 'idle' && this.checkLiveExplosives()) { this.updatePanic(dt); return; }

    if (this.stun > 0) {
      this.stun -= dt;
      this.vx = approach(this.vx, 0, 400 * dt);
    } else if (this.cheerT > 0 && this.cheerDelay <= 0) {
      // celebrating a hero's fall (1.32): fist up, a hop or two - and no shooting meanwhile
      this.vx = 0;
      if (this.onGround && this.type !== 'dog' && (this.hopT = (this.hopT || 0) - dt) <= 0) { this.hopT = rand(0.45, 0.7); this.vy = -85; }
    } else {
      const p = W.nearestPlayer(this.cx, this.cy);
      const sees = this.canSee(p);
      this.cd -= dt;
      switch (this.state) {
        case 'patrol':
          this.vx = this.face * d.speed;
          if (this.onGround && (this.blockedAhead(this.face) || this.ledgeAhead(this.face))) {
            this.face = -this.face; this.vx = 0; this.state = 'idle'; this.stateT = rand(0.6, 1.6);
          }
          this.stateT -= dt;
          if (this.stateT <= 0) { this.state = 'idle'; this.stateT = rand(1, 2.5); }
          if (sees) this.spot(false);
          break;
        case 'idle':
          this.vx = 0; this.stateT -= dt;
          if (this.stateT <= 0) {
            if (this.guard) { this.face = -this.face; this.stateT = rand(2, 4); }
            else { this.state = 'patrol'; this.stateT = rand(2, 4); if (Math.random() < 0.5) this.face = -this.face; }
          }
          if (sees) this.spot(false);
          break;
        case 'suspicious':
          this.vx = 0; this.stateT -= dt;
          if (sees) this.spot(true);
          else if (this.stateT <= 0) { this.state = this.guard ? 'idle' : 'patrol'; this.stateT = rand(1, 2); }
          break;
        case 'alert':
          this.vx = 0; this.alertT -= dt;
          if (p && !p.dead) this.face = p.cx > this.cx ? 1 : -1;
          if (this.alertT <= 0) { this.state = 'attack'; this.lostT = 0; }
          break;
        case 'attack':
          this.attack(dt, p, sees);
          break;
      }
    }
    const wasGround = this.onGround;
    this.vy = Math.min(this.vy + GRAVITY * dt, 450);
    moveBody(this, T, dt);
    if (this.onGround) { strideStep(this, dt); if (!wasGround && this.landVy > 150) this.landT = 0.12 * TUNE.poseTime; }
    if (this.smokeT > 0) { this.smokeT -= dt; if (Math.random() < dt * 9) FX.smokePuff(this.cx + this.face * 17, this.y + 8, 0.45); } // a heavy's hot barrels
    unstick(this, T);
    this.trackFall();
  }

  // pose timers (1.32)
  tickPoses(dt) {
    this.flinchT -= dt; this.kickT -= dt; this.reloadT -= dt; this.spotT -= dt; this.landT -= dt; this.earsT -= dt; this.barkT -= dt; this.boltT -= dt; this.fleeT -= dt; this.tubeT -= dt;
    if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.getupT = 0.25; } else this.getupT -= dt;
    if (this.cheerDelay > 0) this.cheerDelay -= dt; else if (this.cheerT > 0) this.cheerT -= dt;
  }
  // knocked off his feet by a hard landing's shockwave (1.32): flat on his back, then up again - the
  // stun made visible (it lasts as long as before)
  knockDown() {
    if (!TUNE.charAnim || TUNE.knockDown <= 0 || this.type === 'dog' || this.def.heavy) { this.flinchT = 0.3; return; }
    this.downT = TUNE.knockDown; this.getupT = 0; this.windT = 0;
    this.stun = Math.max(this.stun || 0, this.downT + 0.25);
  }
  // after a burst (1.32): a rifleman works his gun (every other burst a fresh magazine: the old one
  // drops out), a heavy's barrels smoke - the pause before the next burst, made visible
  afterBurst() {
    if (!TUNE.charAnim) return;
    this.bursts++;
    if (this.def.weapon === 'hmg') { this.smokeT = 0.9; return; }
    this.reloadT = Math.min(0.55, this.cd * 0.6) * TUNE.poseTime;
    if (this.bursts % 2 === 0 && this.W.onScreen(this.cx, this.cy, 20)) {
      this.W.schedule(0.12, () => {
        if (this.dead) return;
        FX.spawn(this.cx + this.face * 3, this.y + 9, this.face * rand(5, 20), -rand(20, 50), rand(2.5, 3.5), 2, '#2a2a30', PF.GRAV | PF.BOUNCE | PF.TINK);
        Sound.play('reload', this.W.volAt(this.cx, this.cy) * 0.6);
      });
    }
  }
  // the grenadier pulls the pin: a ping, the pin flies (1.32)
  pullPin() {
    Sound.play('pin', this.W.volAt(this.cx, this.cy) * 0.7);
    FX.spawn(this.cx + this.face * 3, this.y + 3, this.face * rand(10, 30), -rand(50, 80), 1.2, 1, '#c8c8d2', PF.GRAV | PF.BOUNCE);
  }

  // grabbed by a hero: dangles in front of him, kicking
  updateHeld() {
    const p = this.held;
    if (!p || p.dead || p.carry !== this) { this.held = null; this.stun = 0.6; return; }
    this.face = -p.face; this.vx = 0; this.vy = 0; this.fallTop = null;
    this.x = p.cx + p.face * 9 - this.w / 2;
    this.y = p.y - 1 + Math.round(Math.sin(this.animT * 25));
  }

  // a long drop is fatal: blast the floor away or kick them off a tower
  trackFall() {
    if (!this.onGround) {
      if (this.fallTop == null || this.y < this.fallTop) this.fallTop = this.y;
      // a long way down (1.32): he knows - arms windmilling, a scream
      if (!this.screamed && TUNE.charAnim && this.vy > 150 && this.y - this.fallTop > 3.5 * TILE && !this.def.static && this.type !== 'dog' && !this.para && !this.held) {
        this.screamed = true; Sound.play('scream', this.W.volAt(this.cx, this.cy) * 0.8, rand(0.9, 1.15));
      }
      return;
    }
    this.screamed = false;
    if (this.fallTop == null) return;
    const drop = this.y - this.fallTop, style = this.fallStyle || STYLE.splat;
    this.fallTop = null; this.fallStyle = null;
    if (drop > 5.5 * TILE && !this.isBoss && !this.dead) this.hurt(this.def.heavy ? 8 : 99, { kind: 'fall', dirX: 0, force: 0, team: 'n', style });
  }

  // Telegraphed shots: the soldier raises his gun and a red sight line shows
  // exactly where the burst will go, then fires down that line.
  aimTime() {
    const base = this.def.weapon === 'hmg' ? 0.6 : this.def.weapon === 'rocket' ? 0.55 : 0.45;
    return base * (1.1 - this.W.diff * 0.3) * (this.W.skill.aim || 1) * TUNE.enemyAim;
  }
  startAim() {
    this.aimT = Math.max(0.017, this.aimTime());
    this.aimLen = this.sightLen(this.def.sight);
    Sound.play('beep', this.W.volAt(this.cx, this.cy) * 0.35, 2.2);
  }
  muzzleY() { return this.y + (this.def.static ? 4 : this.def.weapon === 'hmg' ? 9 : this.def.weapon === 'rocket' ? 2 : 5); }
  sightLen(max) {
    const T = this.W.terrain, my = this.muzzleY(), x0 = this.cx + this.face * 12;
    for (let d = 0; d < max; d += 4) if (T.solidAt(x0 + this.face * d, my)) return d;
    return max;
  }
  // a bullet whizzing past makes a soldier flinch - sometimes enough to spoil his aim
  suppress() {
    if (this.dead || this.def.static || this.isBoss || this.suppT > 0) return;
    this.suppT = 1.0;
    this.focus = Math.max(0, this.focus - 0.35);
    if (this.aimT > 0 && Math.random() < 0.6) { this.aimT = 0; this.cd = Math.max(this.cd, 0.45); this.icon = '!'; this.iconT = 0.35; }
    // a near miss can spoil a sniper's tracking (never once the laser has locked)
    if (this.snipeT > 0 && this.lockT <= 0 && Math.random() < 0.4) { this.snipeT = 0; this.cd = Math.max(this.cd, 0.6); this.icon = '!'; this.iconT = 0.35; }
  }

  canSee(p) {
    if (!p || p.dead || p.state === 'extract') return false;
    const dx = p.cx - this.cx, dy = p.cy - this.cy, adx = Math.abs(dx);
    if (adx > this.def.sight || Math.abs(dy) > (this.def.weapon === 'snipe' ? 160 : 72)) return false;
    if (Math.sign(dx) !== this.face && adx > 18 && this.state !== 'attack') return false;
    if (!this.W.onScreen(this.cx, this.cy, 24)) return false;
    return this.W.terrain.los(this.cx, this.y + 4, p.cx, p.y + 5);
  }

  spot(fast) {
    if (this.state === 'alert' || this.state === 'attack') return;
    const W = this.W;
    this.state = 'alert'; this.alertT = (fast ? this.react * 0.5 : this.react) * TUNE.enemyReact;
    this.icon = '!'; this.iconT = 0.9; this.vx = 0;
    // a start (1.32): a jolt and a little hop - the '!' is a body reacting, not only an icon
    if (TUNE.charAnim) {
      this.spotT = 0.24 * TUNE.poseTime;
      if (this.type === 'dog') this.barkT = 0.45;
      else if (this.onGround && !this.def.heavy && TUNE.spotHop > 0) { this.vy = -TUNE.spotHop; this.onGround = false; }
    }
    Sound.play('alert', W.volAt(this.cx, this.cy) * 0.6);
    W.chatter(this, this.type === 'dog' ? 'dog' : this.type === 'bomber' ? 'bomber' : 'spot');
    for (const e of W.enemies) {
      if (e === this || e.dead || e.def.static) continue;
      if (Math.abs(e.cx - this.cx) < 90 && Math.abs(e.cy - this.cy) < 40 && (e.state === 'patrol' || e.state === 'idle')) {
        e.state = 'suspicious'; e.stateT = 0.7; e.awake = true;
        const tp = W.nearestPlayer(e.cx, e.cy);
        if (tp) e.face = tp.cx > e.cx ? 1 : -1;
        e.icon = '?'; e.iconT = 0.7;
      }
    }
  }

  hearNoise(x) {
    if (this.dead || this.state === 'attack' || this.state === 'alert' || this.burning > 0) return;
    if (this.def.static) return;
    this.state = 'suspicious'; this.stateT = rand(0.9, 1.5);
    this.face = x > this.cx ? 1 : -1; this.icon = '?'; this.iconT = 0.8;
  }

  // ------------------------------------------------------------ movement probes
  blockedAhead(dir) {
    const px = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return this.W.terrain.solidAt(px, this.y + this.h - 4) || this.W.terrain.solidAt(px, this.y + 3);
  }
  ledgeAhead(dir) {
    if (!this.onGround) return false;
    const T = this.W.terrain;
    const px = dir > 0 ? this.x + this.w + 2 : this.x - 2;
    return !T.standableAt(px, this.y + this.h + 2) && !T.standableAt(px, this.y + this.h + 18);
  }
  canStepUp(dir) {
    const T = this.W.terrain;
    const px = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return !T.solidAt(px, this.y + this.h - 20) && !T.solidAt(px, this.y - 2) && !T.solidAt(this.cx, this.y - 6);
  }

  attack(dt, p, sees) {
    const d = this.def, W = this.W;
    if (!p || p.dead) { this.state = 'suspicious'; this.stateT = 1.5; this.burst = 0; this.windT = 0; return; }
    const dx = p.cx - this.cx, dy = p.cy - this.cy, adx = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;
    if (sees) this.lostT = 0; else this.lostT += dt;
    // aim settles in over time: the first bursts spray, later ones are accurate
    this.focus = sees ? Math.min(1, this.focus + dt * TUNE.enemyFocus) : Math.max(0, this.focus - dt * 0.3);
    if (this.lostT > 3.2 && d.weapon !== 'kamikaze' && d.weapon !== 'bite' && d.weapon !== 'scout') {
      this.state = 'suspicious'; this.stateT = 1.2; this.icon = '?'; this.iconT = 0.6; this.burst = 0; return;
    }
    const onScr = W.onScreen(this.cx, this.cy, -6);
    let move = 0;
    switch (d.weapon) {
      case 'rifle':
      case 'hmg': {
        if (this.burst > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.fireBullet(); this.burst--; this.burstT = d.gap;
            if (this.burst === 0) { this.cd = rand(d.cd[0], d.cd[1]) * (1.1 - W.diff * 0.3) * W.skill.cd; this.afterBurst(); }
          }
          break;
        }
        if (this.aimT > 0) {
          this.aimT -= dt; this.face = dir; this.aimLen = this.sightLen(d.sight);
          if (this.aimT <= 0) { this.burst = d.burst; this.burstT = 0; }
          break;
        }
        this.face = dir;
        if (sees && Math.abs(dy) < 20 && this.cd <= 0 && onScr) this.startAim();
        else if (adx > 130 || !sees) move = dir * d.run;
        else if (adx < 48) move = -dir * d.speed;
        break;
      }
      case 'pistol': {
        if (this.burst > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.fireBullet(); this.burst--; this.burstT = d.gap;
            if (this.burst === 0) { this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd; this.afterBurst(); }
          }
          break;
        }
        if (this.aimT > 0) {
          this.aimT -= dt; this.face = dir; this.aimLen = this.sightLen(d.sight);
          if (this.aimT <= 0) { this.burst = d.burst; this.burstT = 0; }
          break;
        }
        this.face = dir;
        const cornered = this.blockedAhead(-dir) && !this.canStepUp(-dir) || this.ledgeAhead(-dir);
        if (adx < 72 && Math.abs(dy) < 40 && !cornered) { this.face = -dir; move = -dir * d.run; this.fleeT = 0.15; }
        else if (sees && Math.abs(dy) < 24 && this.cd <= 0 && onScr) this.startAim();
        else if (adx > 160 || !sees) move = dir * d.speed;
        break;
      }
      case 'snipe': {
        // tracks with a turn-rate limit (running makes the laser lag), locks white
        // for the last moment, then one fast shot down the locked line
        if (!(this.snipeT > 0 && this.lockT > 0)) this.face = dir;
        const elev = () => clamp(Math.atan2(p.cy - 1 - this.muzzleY(), Math.max(8, Math.abs(p.cx - this.scopeX()))), -1.05, 1.05);
        if (this.snipeT > 0) {
          this.snipeT -= dt;
          if (this.lockT > 0) this.lockT -= dt;
          else {
            this.aimE = approach(this.aimE, elev(), 1.7 * dt);
            if (this.snipeT <= this.lockDur) { this.lockT = this.lockDur; Sound.play('beep', W.volAt(this.cx, this.cy) * 0.5, 2.8); }
          }
          this.laserLen = this.laserReach(p);
          if (this.snipeT <= 0) { this.snipeT = 0; this.lockT = 0; this.fireSnipe(); this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd; this.throwT = 0.15; }
          break;
        }
        if (sees && this.cd <= 0 && onScr) {
          this.lockDur = 0.35 * (W.skill.aim || 1);
          this.snipeT = 1.25 * (1.1 - W.diff * 0.25) * (W.skill.aim || 1) * TUNE.enemyAim + this.lockDur;
          this.aimE = elev(); this.laserLen = this.laserReach(p);
          Sound.play('beep', W.volAt(this.cx, this.cy) * 0.35, 2.2);
        }
        break;
      }
      case 'flame':
        // walks up close; the pilot light flares for half a second (the warning), then fire
        if (this.sprayT > 0) {
          this.sprayT -= dt; this.emitT -= dt;
          while (this.emitT <= 0) { this.emitT += 0.04; this.fireFlame(); }
          if (Math.random() < dt * 7) Sound.play('flameTick', W.volAt(this.cx, this.cy));
          if (this.sprayT <= 0) this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd;
          break;
        }
        if (this.igniteT > 0) {
          this.igniteT -= dt;
          if (Math.random() < dt * 30) FX.flame(this.cx + this.face * rand(12, 18), this.y + 5 + rand(-2, 2)); // sputtering nozzle
          if (this.igniteT <= 0) { this.sprayT = 1.1; this.emitT = 0; Sound.play('ignite', W.volAt(this.cx, this.cy) * 0.6); }
          break;
        }
        this.face = dir;
        if (sees && adx < 80 && Math.abs(dy) < 22 && this.cd <= 0 && onScr) {
          this.igniteT = 0.55 * (W.skill.aim || 1) * TUNE.enemyAim; this.icon = '!'; this.iconT = 0.5;
          Sound.play('hiss', W.volAt(this.cx, this.cy));
        } else if (adx > 64) move = dir * (sees ? d.speed : d.run);
        else if (adx < 34) move = -dir * d.speed;
        break;
      case 'radio':
        // radio officer: keeps his distance and calls in a bombing run; pistol when you get close
        if (this.callT > 0) {
          this.callT -= dt; this.throwT = 0.1;
          if (this.callT <= 0) { W.enemyAirstrike(this, p); this.strikeCd = rand(8, 10.5) * W.skill.cd; }
          break;
        }
        if (this.burst > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.fireBullet(); this.burst--; this.burstT = d.gap;
            if (this.burst === 0) this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd;
          }
          break;
        }
        if (this.aimT > 0) {
          this.aimT -= dt; this.face = dir; this.aimLen = this.sightLen(d.sight);
          if (this.aimT <= 0) { this.burst = d.burst; this.burstT = 0; }
          break;
        }
        this.face = dir;
        this.strikeCd -= dt;
        if (sees && this.strikeCd <= 0 && onScr && adx > 90) {
          this.callT = 1.3 * (W.skill.aim || 1); this.icon = '!'; this.iconT = 1.3;
          Sound.play('radio', W.volAt(this.cx, this.cy) * 0.8);
        } else if (sees && adx < 110 && Math.abs(dy) < 24 && this.cd <= 0 && onScr) this.startAim();
        else if (adx < 140 && !this.blockedAhead(-dir) && !this.ledgeAhead(-dir)) { this.face = -dir; move = -dir * d.run * 0.7; }
        else if (adx > 250 || !sees) move = dir * d.speed;
        break;
      case 'mortar':
        this.face = dir;
        if (this.windT > 0) {
          // a shell goes down the tube (1.32), then out it comes - and his hands go over his ears
          this.windT -= dt;
          if (this.windT <= 0) this.fireMortar(p);
          break;
        }
        if (this.cd <= 0 && adx < d.sight && onScr && (sees || this.lostT < 2)) {
          this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd;
          if (TUNE.charAnim && TUNE.mortarWind > 0) this.windT = TUNE.mortarWind; else this.fireMortar(p);
        }
        break;
      case 'kamikaze':
        this.face = dir; move = dir * d.run;
        this.beepT -= dt;
        if (this.beepT <= 0) { this.beepT = TUNE.charAnim ? 0.1 + 0.2 * Math.min(1, adx / 180) : 0.22; Sound.play('beep', W.volAt(this.cx, this.cy) * 0.6); } // quicker as he closes in
        if (adx < 14 && Math.abs(dy) < 18) { this.detonate(); return; }
        break;
      case 'grenade':
        this.face = dir;
        if (this.windT > 0) {
          // pin out, arm back (1.32): the throw is coming - and it flies at where you are when it leaves his hand
          this.windT -= dt;
          if (this.windT <= 0) { this.throwGrenade(p); this.throwT = 0.25; }
          break;
        }
        if (sees && this.cd <= 0 && adx < 220 && onScr) {
          this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd; W.chatter(this, 'grenade');
          if (TUNE.charAnim && TUNE.grenadeWind > 0) { this.windT = TUNE.grenadeWind; this.pullPin(); }
          else { this.throwGrenade(p); this.throwT = 0.3; }
        }
        if (adx > 180) move = dir * d.run; else if (adx < 70) move = -dir * d.speed;
        break;
      case 'rocket':
        this.face = dir;
        if (this.aimT > 0) {
          this.aimT -= dt; this.aimLen = this.sightLen(d.sight);
          if (this.aimT <= 0) { this.fireRocket(); this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd; this.throwT = 0.2; }
          break;
        }
        if (sees && Math.abs(dy) < 22 && this.cd <= 0 && onScr) this.startAim();
        if (adx > 200 || (!sees && adx > 60)) move = dir * d.run;
        break;
      case 'bash':
        this.face = dir;
        if (this.bashT > 0) {
          this.bashT -= dt;
          if (this.bashT <= 0) {
            this.throwT = 0.2; this.cd = 0.9;
            Sound.play('punch', W.volAt(this.cx, this.cy));
            if (adx < 22 && Math.abs(dy) < 18) p.kill('bash', { dirX: dir, src: this.type });
          }
          break;
        }
        if (adx < 20 && Math.abs(dy) < 18 && this.cd <= 0) { this.bashT = 0.35; this.icon = '!'; this.iconT = 0.4; break; }
        if (adx > 16) move = dir * (sees ? d.speed : d.run);
        break;
      case 'scout': {
        const al = this.targetAlarm && !this.targetAlarm.dead && !this.targetAlarm.active ? this.targetAlarm : (this.targetAlarm = W.nearestAlarm(this.cx, this.cy, 640));
        if (al) {
          const adir = al.cx > this.cx ? 1 : -1;
          this.face = adir; move = adir * d.run;
          if (Math.abs(al.cx - this.cx) < 8 && Math.abs(al.y + al.h - (this.y + this.h)) < 26) { al.activate(W); this.targetAlarm = null; }
        } else { this.face = -dir; move = -dir * d.run; }
        for (const e of W.enemies) {
          if (e === this || e.dead || e.def.static || e.isBoss || e.state === 'attack') continue;
          if (Math.abs(e.cx - this.cx) < 32 && Math.abs(e.cy - this.cy) < 26) { e.state = 'alert'; e.alertT = 0.25; e.awake = true; e.icon = '!'; e.iconT = 0.6; }
        }
        break;
      }
      case 'bite':
        this.face = dir;
        if (overlap(this, p)) p.kill('bite', { dirX: dir, src: this.type });
        if (this.windup > 0) {
          // short crouch before the pounce gives the player a moment to react
          this.windup -= dt;
          if (this.windup <= 0) {
            this.vy = -125; this.vx = dir * 235; this.cd = 1.1; this.leapT = 0.35;
            Sound.play('hurt', W.volAt(this.cx, this.cy) * 0.4, 1.9);
          }
          break;
        }
        move = dir * d.run;
        if (this.onGround && adx < 50 && adx > 8 && Math.abs(dy) < 26 && this.cd <= 0) { this.windup = 0.22; move = 0; }
        break;
    }
    if (this.leapT > 0) { this.leapT -= dt; return; }
    if (move !== 0) {
      const md = Math.sign(move);
      if (this.onGround && this.blockedAhead(md)) {
        if (this.canStepUp(md)) { this.vy = -250; this.vx = move; }
        else move = 0;
      } else if (this.ledgeAhead(md) && d.weapon !== 'kamikaze' && d.weapon !== 'bite' && d.weapon !== 'scout') move = 0;
    }
    this.vx = this.onGround ? move : approach(this.vx, move, 400 * dt);
  }

  fireBullet() {
    const W = this.W, heavy = this.def.weapon === 'hmg';
    const sp = ((heavy ? 195 : 175) + W.diff * 55) * W.skill.bullet * TUNE.enemyBullet;
    const spread = (heavy ? 0.06 : 0.02) + (1 - this.focus) * TUNE.enemySpread;
    const a = rand(-spread, spread);
    const mx = this.cx + this.face * (heavy ? 17 : 12), my = this.muzzleY();
    W.projectiles.push(new Projectile({ x: this.cx + this.face * 4, y: my, vx: Math.cos(a) * sp * this.face, vy: Math.sin(a) * sp, team: 'e', src: this.type, kind: 'bullet', dmg: 1, tileDmg: 2, life: 1.8 }));
    FX.muzzle(mx, my, this.face, 3);
    FX.shell(this.cx, my, this.face);
    Sound.play('eshot', W.volAt(mx, my) * (heavy ? 0.9 : 0.7));
    this.kickT = 0.07;
  }

  // ---- sniper
  scopeX() { return this.cx + this.face * 11; }
  // the laser runs from the rifle to the first wall, or stops on the hero it paints
  laserReach(p) {
    const T = this.W.terrain, x0 = this.scopeX(), y0 = this.muzzleY() - 1;
    const vx = this.face * Math.cos(this.aimE), vy = Math.sin(this.aimE);
    for (let d = 4; d < 420; d += 3) {
      const x = x0 + vx * d, y = y0 + vy * d;
      if (T.solidAt(x, y)) return d;
      if (p && !p.dead && x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return d;
    }
    return 420;
  }
  fireSnipe() {
    const W = this.W, x0 = this.scopeX(), y0 = this.muzzleY() - 1, sp = 640 * W.skill.bullet * TUNE.enemyBullet;
    const vx = this.face * Math.cos(this.aimE), vy = Math.sin(this.aimE);
    W.projectiles.push(new Projectile({ x: x0, y: y0, vx: vx * sp, vy: vy * sp, team: 'e', src: 'sniper', kind: 'bullet', dmg: 1, tileDmg: 5, life: 1.2, tracer: true }));
    FX.muzzle(x0, y0, this.face, 5);
    Sound.play('sniper', W.volAt(this.cx, this.cy) * 0.75);
    W.noise(this.cx, this.cy, 140);
    if (TUNE.charAnim) {
      // he works the bolt (1.32): the big brass flips out, clack-clack
      this.kickT = 0.12; this.boltT = 0.55 * TUNE.poseTime;
      W.schedule(0.22, () => { if (this.dead) return; FX.shell(this.cx, this.muzzleY(), this.face, 'heavy'); Sound.play('reload', W.volAt(this.cx, this.cy) * 0.55); });
    }
  }
  // the mortar round leaves the tube (a puff of smoke, a jolt of the tube)
  fireMortar(p) {
    const W = this.W;
    this.throwT = TUNE.charAnim ? 0 : 0.3; this.earsT = 0.75 * TUNE.poseTime; this.tubeT = 0.15;
    const gx = clamp(p.cx + (p.vx || 0) * 0.35 * W.diff, 8, W.terrain.w * TILE - 8);
    const gy = W.terrain.groundBelow(gx, p.y, 320);
    if (gy !== null) W.mortarShell(this, gx, gy);
    if (TUNE.charAnim) FX.smokePuff(this.cx + this.face * 8, this.y + 3, 0.8);
  }
  // ---- flamethrower
  fireFlame() {
    const W = this.W;
    W.projectiles.push(new Projectile({ x: this.cx + this.face * 12, y: this.y + 5 + rand(-1, 1), vx: this.face * rand(150, 205), vy: rand(-16, 14), kind: 'flame', team: 'e', src: 'flamer', life: rand(0.42, 0.55), dmg: 0 }));
  }
  // his tank goes up: a small fireball and a patch of burning ground (it hurts his friends too)
  tankBurst(W, x, y) {
    W.explode(x, y, 30, { owner: 'e', dmg: 10, tileDmg: 18, fire: true, src: 'flamer tank' });
    W.props.push(new FirePatch(x, y + 6, 44, 2.4, 'e'));
  }

  throwGrenade(p) {
    const W = this.W;
    const g = 700, T0 = 0.8;
    const dx = p.cx - this.cx, dy = (p.y + p.h - 4) - (this.y + 2);
    const vx = clamp(dx / T0, -240, 240), vy = clamp((dy - 0.5 * g * T0 * T0) / T0, -430, 60);
    W.projectiles.push(new Projectile({
      x: this.cx, y: this.y + 2, vx, vy, grav: g, team: 'e', src: this.type, kind: 'egrenade', sprite: Sprites.props.egrenade,
      fuse: 1.25, radius: 30, explodeDmg: 10, explodeTile: 34, bounce: 0.35, life: 5,
    }));
    Sound.play('throw', W.volAt(this.cx, this.cy));
  }

  fireRocket() {
    const W = this.W;
    W.projectiles.push(new Projectile({
      x: this.cx + this.face * 12, y: this.y + 2, vx: this.face * 165, vy: 0, team: 'e', src: this.type, kind: 'erocket',
      sprite: Sprites.props.erocket, radius: 26, explodeDmg: 10, explodeTile: 32, life: 3,
    }));
    FX.smokePuff(this.cx - this.face * 10, this.y + 2, 0.6);
    Sound.play('rocket', W.volAt(this.cx, this.cy) * 0.8);
  }

  detonate() {
    if (this.dead) return;
    this.dead = true;
    this.W.onEnemyKilled(this, { kind: 'explosion' }, true);
    this.W.explode(this.cx, this.cy, 34, { owner: 'e', dmg: 12, tileDmg: 40, src: this.type });
  }

  // paratrooper: drifts down under a canopy, then joins the fight
  updatePara(dt) {
    this.vy = Math.min(this.vy + GRAVITY * dt, 52);
    this.vx = Math.sin(this.animT * 2.2) * 14;
    moveBody(this, this.W.terrain, dt);
    if (this.onGround) {
      this.para = false; this.vx = 0; this.lostT = 0; FX.dust(this.cx, this.y + this.h, 3);
      if (TUNE.charAnim) {
        // down in a crouch, gathering himself before he fights; the canopy settles after him (1.32)
        this.landT = 0.35 * TUNE.poseTime; this.stun = Math.max(this.stun || 0, 0.35);
        this.W.props.push(new Canopy(this.cx, this.y + this.h, Math.sin(this.animT * 2.2) >= 0 ? 1 : -1));
      }
    }
  }

  // Alerted soldiers scramble away from a lit grenade / dynamite / flare nearby.
  checkLiveExplosives() {
    if (this.def.heavy || this.type === 'bomber' || this.type === 'dog') return false;
    for (const pr of this.W.projectiles) {
      if (pr.dead || pr.team !== 'p' || !(pr.fuse > 0) || pr.fuse > 1.4) continue;
      const dx = pr.x - this.cx;
      if (Math.abs(dx) < 56 && Math.abs(pr.y - this.cy) < 40) {
        this.panicT = rand(0.7, 1.0); this.face = dx > 0 ? -1 : 1;
        this.icon = '!'; this.iconT = 0.6; this.burst = 0; this.aimT = 0;
        if (Math.random() < 0.5) Sound.play('hurt', this.W.volAt(this.cx, this.cy) * 0.5, 1.6);
        this.W.chatter(this, 'panic');
        return true;
      }
    }
    return false;
  }
  updatePanic(dt) {
    const T = this.W.terrain;
    this.panicT -= dt; this.windT = 0;
    this.vx = this.face * this.def.run * 1.25;
    if (this.onGround && this.blockedAhead(this.face)) { if (this.canStepUp(this.face)) this.vy = -250; else this.vx = 0; }
    this.vy = Math.min(this.vy + GRAVITY * dt, 450);
    moveBody(this, T, dt);
    if (this.onGround) strideStep(this, dt);
    this.trackFall();
    if (this.panicT <= 0) { this.state = 'attack'; this.lostT = 0; }
  }

  updateBurning(dt) {
    const W = this.W, T = W.terrain, d = this.def;
    this.burning -= dt;
    if (d.heavy) this.hp -= dt * 3.5;
    this.vx = this.face * d.run * 1.15;
    if (this.onGround && (this.blockedAhead(this.face) || this.ledgeAhead(this.face))) this.face = -this.face;
    if (Math.random() < 0.7) FX.flame(this.cx + rand(-4, 4), this.y + rand(0, this.h));
    if (Math.random() < dt * 2) T.ignite(Math.floor(this.cx / TILE), Math.floor((this.y + this.h + 2) / TILE));
    if (Math.random() < dt * 3) W.scare(this.cx, this.cy, 44, 0.8); // a screaming torch scares his friends
    for (const e of W.enemies) if (e !== this && !e.dead && e.burning <= 0 && !e.def.static && !e.isBoss && overlap(this, e)) e.ignite();
    for (const p of W.players) if (!p.dead && overlap(this, p)) p.kill('fire', { src: 'burning ' + this.type });
    W.fuel.igniteRect(this.x, this.y + this.h - 6, this.w, 8, 'n'); // a running torch lights any fuel it crosses
    if (Math.random() < dt * 3) Sound.play('hurt', W.volAt(this.cx, this.cy) * 0.5, rand(1.2, 1.5));
    this.vy = Math.min(this.vy + GRAVITY * dt, 450);
    moveBody(this, T, dt);
    if (this.onGround) strideStep(this, dt);
    this.trackFall();
    if (!this.dead && (this.burning <= 0 || this.hp <= 0)) this.die({ kind: 'fire', dirX: 0, style: this.burnStyle || null });
  }

  ignite() {
    if (this.dead || this.def.static || this.def.fireproof) return;
    if (this.burning <= 0) {
      this.burning = this.def.heavy ? 3.2 : rand(1.0, 1.5);
      this.icon = null; this.state = 'attack'; this.burst = 0; this.aimT = 0;
      if (this.type === 'bomber') { this.detonate(); return; }
      Sound.play('hurt', this.W.volAt(this.cx, this.cy), 1.3);
    }
  }

  hurt(dmg, info) {
    if (this.dead) return false;
    const W = this.W;
    if (info.team === 'p') dmg *= Meta.damageMul(); // FIREPOWER upgrade
    this.awake = true;
    if (info.kind === 'fire') {
      if (this.def.fireproof) return true;
      if (this.def.static) { this.hp -= 0.15; this.flash = 0.05; if (this.hp <= 0) this.die(info); }
      else this.ignite();
      return true;
    }
    if (this.shieldUp && (info.kind === 'melee' || info.kind === 'explosion' || info.kind === 'rail')) this.breakShield();
    this.hp -= dmg; this.flash = 0.1;
    if (this.hp <= 0) { this.die(info); return true; }
    if (!this.def.static) {
      const k = this.def.heavy ? 0.15 : 1;
      this.vx += (info.dirX || 0) * (info.force || 60) * k;
      if (info.kind === 'explosion' && !this.def.heavy) this.vy = -150;
      if (info.kind === 'shock') this.stun = 0.35;
      this.aimT = 0; this.focus *= 0.5; this.snipeT = 0; this.lockT = 0; this.igniteT = 0; this.callT = 0; // flinch: getting hit spoils the aim (and the call)
      this.flinchT = (this.def.heavy ? 0.12 : 0.2) * TUNE.poseTime; this.windT = 0;
      if (this.state !== 'attack') {
        this.state = 'alert'; this.alertT = 0.2; if (info.dirX) this.face = -info.dirX; this.icon = '!'; this.iconT = 0.6;
      }
    }
    if (this.def.heavy || this.def.static) Sound.play('bossHit', W.volAt(this.cx, this.cy) * 0.7);
    return true;
  }

  die(info) {
    if (this.dead) return;
    this.dead = true;
    const W = this.W;
    W.onEnemyKilled(this, info);
    if (this.def.target) W.onTargetDown(this);
    const dirX = info.dirX || 0;
    if (info.kind === 'melee') W.scare(this.cx, this.cy, 72, 1.0); // gory close kills break morale
    // the blow knocks his hat off (1.32): it tumbles away on its own
    const hatOff = TUNE.charAnim && this.gfx && this.gfx.hatPops && info.kind !== 'fire' && info.kind !== 'fall' && (info.kind !== 'bullet' || Math.random() < 0.75);
    if (hatOff) W.props.push(new Hat(this.gfx, this.cx, this.y + this.h, this.face, dirX * rand(30, 80) + rand(-20, 20), -rand(150, 230)));
    if (this.type === 'bomber') {
      if (info.kind === 'explosion' || info.kind === 'fire' || info.kind === 'crush' || info.kind === 'rail') {
        W.schedule(0.06, () => W.explode(this.cx, this.cy, 34, { owner: 'e', dmg: 12, tileDmg: 40, src: this.type }));
        FX.gibs(this.cx, this.cy, this.def.gib, dirX, 8);
      } else {
        // the vest keeps ticking on the body - get clear!
        const c = new Corpse(this.gfx, this.cx, this.y + this.h, this.w, this.face, dirX * 90 + rand(-20, 20), -rand(90, 150), false);
        c.fuse = 1.1;
        W.corpses.push(c);
        Sound.play('hurt', W.volAt(this.cx, this.cy), 1.1);
      }
      return;
    }
    if (this.type === 'flamer') {
      // the fuel tank on his back: blows at once from fire or a blast, otherwise it hisses first
      if (info.kind === 'explosion' || info.kind === 'crush' || info.kind === 'rail') {
        const x = this.cx, y = this.cy;
        W.schedule(0.05, () => this.tankBurst(W, x, y));
        FX.gibs(this.cx, this.cy, this.def.gib, dirX, 10);
      } else {
        const c = new Corpse(this.gfx, this.cx, this.y + this.h, this.w, this.face, dirX * 80 + rand(-20, 20), -rand(90, 150), false);
        c.fuse = 0.9; c.blast = 'flamer';
        W.corpses.push(c);
        Sound.play('hiss', W.volAt(this.cx, this.cy));
      }
      return;
    }
    if (this.type === 'grenadier' && (this.windT > 0 || Math.random() < 0.8)) { // the pin already out: always
      W.projectiles.push(new Projectile({
        x: this.cx, y: this.y + 4, vx: rand(-40, 40), vy: -120, grav: 700, team: 'e', src: this.type, kind: 'egrenade', sprite: Sprites.props.egrenade,
        fuse: 1.3, radius: 28, explodeDmg: 10, explodeTile: 30, bounce: 0.35, life: 5,
      }));
    }
    if (this.def.static) {
      W.explode(this.cx, this.cy, 22, { owner: 'p', dmg: 6, tileDmg: 20, env: true });
      FX.debris(this.cx, this.cy, this.def.gib, 10, 1.2);
      return;
    }
    if (this.type === 'dog') {
      // (1.34) knocked silly and off it runs, away from the heroes: no dog ever lies dead (Corpse.flee)
      const c = new Corpse(this.gfx, this.cx, this.y + this.h, this.w, this.face, dirX * 120 + rand(-15, 15), -rand(170, 220), false);
      const q = W.nearestPlayer(this.cx, this.cy);
      c.flee = q ? (this.cx >= q.cx ? 1 : -1) : (dirX || 1);
      W.corpses.push(c);
      Sound.play('hurt', W.volAt(this.cx, this.cy), 1.9); // a yelp
      return;
    }
    Sound.play('hurt', W.volAt(this.cx, this.cy), rand(0.85, 1.25));
    // torn apart only with blood on; bloodless, a blast flings the body instead (cartoon style)
    const gib = Settings.gore() && !info.bowl && (info.kind === 'explosion' || info.kind === 'crush' || info.kind === 'rail' || (info.force || 0) > 250);
    if (gib) FX.gibs(this.cx, this.cy, this.def.gib, dirX, this.def.heavy ? 18 : 12);
    else {
      FX.blood(this.cx, this.cy, dirX, info.kind === 'fall' ? 14 : 8);
      // knocked back along the shot, up in a readable arc
      const blast = info.kind === 'explosion' || info.kind === 'rail', crush = info.kind === 'crush';
      const c = new Corpse(this.gfx, this.cx, this.y + this.h, this.w, this.face,
        crush ? 0 : dirX * clamp((info.force || 80) * 1.1, 60, 220) + rand(-15, 15), crush ? 0 : blast ? -rand(200, 270) : -rand(120, 175), info.kind === 'fire');
      if (blast) c.spinV = (dirX || 1) * rand(4, 7);
      if (info.bowl) { c.bowl = 3; c.ev = info.ev || ++W.evSeq; c.vy = -rand(110, 150); }
      c.hatOff = hatOff;
      W.corpses.push(c);
    }
  }

  updateTurret(dt) {
    const W = this.W, T = W.terrain, d = this.def;
    const p = W.nearestPlayer(this.cx, this.cy);
    this.vy = Math.min(this.vy + GRAVITY * dt, 450);
    moveBody(this, T, dt);
    if (!p || p.dead) return;
    const dy = p.cy - this.cy, dx = p.cx - this.cx;
    const sees = Math.abs(dy) < 24 && Math.abs(dx) < d.sight && W.onScreen(this.cx, this.cy, -4) && T.los(this.cx, this.y + 4, p.cx, p.y + 5);
    this.cd -= dt;
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--; this.burstT = d.gap;
        const sp = (200 + W.diff * 50) * W.skill.bullet * TUNE.enemyBullet;
        W.projectiles.push(new Projectile({ x: this.cx + this.face * 6, y: this.y + 4, vx: sp * this.face, vy: rand(-8, 8), team: 'e', src: this.type, kind: 'bullet', dmg: 1, tileDmg: 2, life: 1.6 }));
        FX.muzzle(this.cx + this.face * 13, this.y + 4, this.face, 3);
        Sound.play('eshot', W.volAt(this.cx, this.cy) * 0.8); this.kickT = 0.06;
        if (this.burst === 0) this.cd = rand(d.cd[0], d.cd[1]) * W.skill.cd;
      }
      return;
    }
    if (!sees) { this.turnT = 0; this.aimT = 0; return; }
    const dir = dx > 0 ? 1 : -1;
    if (dir !== this.face) {
      this.turnT += dt;
      if (this.turnT > 0.8) { this.face = dir; this.turnT = 0; }
      return;
    }
    if (this.state !== 'attack') { this.state = 'attack'; this.icon = '!'; this.iconT = 0.7; this.cd = Math.max(this.cd, this.react * TUNE.enemyReact); Sound.play('alert', W.volAt(this.cx, this.cy) * 0.6); }
    if (this.aimT > 0) {
      this.aimT -= dt; this.aimLen = this.sightLen(d.sight);
      if (this.aimT <= 0) { this.burst = d.burst; this.burstT = 0; }
      return;
    }
    if (this.cd <= 0) this.startAim();
  }

  draw(ctx, cx, cy, carried) {
    if (this.dead || (this.held && !carried)) return;
    const x = Math.round(this.cx - cx), fy = Math.round(this.y + this.h - cy);
    if (this.def.static) { this.drawTurret(ctx, x, fy); }
    else {
      const f = this.animFrame();
      const flash = this.flash > 0 || (this.burning > 0 && ((this.animT * 12) | 0) % 2);
      if (this.para) {
        const top = fy - this.h - 24, sway = Math.round(Math.sin(this.animT * 2.2) * 2);
        ctx.fillStyle = '#15131c'; ctx.fillRect(x - 12 + sway, top - 1, 24, 7); ctx.fillRect(x - 10 + sway, top - 3, 20, 3);
        ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 11 + sway, top, 22, 5); ctx.fillRect(x - 9 + sway, top - 2, 18, 3);
        ctx.fillStyle = '#c0302a'; ctx.fillRect(x - 3 + sway, top - 2, 6, 7);
        ctx.fillStyle = '#8a8474';
        for (let k = 0; k < 18; k += 2) { ctx.fillRect(x - 10 + sway + Math.round(k * 0.45), top + 5 + k, 1, 1); ctx.fillRect(x + 10 + sway - Math.round(k * 0.45), top + 5 + k, 1, 1); }
      }
      // a flamethrower's stream and a heavy's burst shake the man behind the gun (1.32)
      const jx = TUNE.charAnim && (this.sprayT > 0 || (this.def.heavy && this.burst > 0)) ? ((this.animT * 30) | 0) % 2 : 0;
      if (this.poseRot) { ctx.save(); ctx.translate(x, fy); ctx.rotate(this.poseRot); drawFrame(ctx, f, 0, 0, this.face, flash); ctx.restore(); }
      else drawFrame(ctx, f, x + jx, fy, this.face, flash);
      if (this.type === 'bomber') {
        // his bomb (1.34): high over his head in the charge, held in front otherwise; in the charge the
        // spark flickers faster the closer he gets (the beeps quicken with it)
        const q = this.W.nearestPlayer(this.cx, this.cy), dd = q ? Math.abs(q.cx - this.cx) : 200;
        const rate = this.state === 'attack' ? 4 + 14 * (1 - Math.min(1, dd / 200)) : 3, up = this.bombUp && TUNE.charAnim;
        drawBomb(ctx, x + jx + this.face * (up ? 0 : 6), fy - (up ? 25 : 10), this.animT, rate);
      }
      if (this.type === 'mortar') {
        // base plate + tube leaning back toward the gunner (the tube jolts when a round goes)
        const bx = x + this.face * 8, fc = this.face, jolt = this.tubeT > 0 ? 1 : 0;
        ctx.fillStyle = '#15131c'; ctx.fillRect(bx - 4, fy - 2, 9, 2);
        ctx.fillStyle = '#3a3d34'; ctx.fillRect(bx - 3, fy - 2, 7, 1);
        for (let i = 0; i < 8; i++) {
          const tx = bx - fc * Math.round(i * 0.5);
          ctx.fillStyle = '#15131c'; ctx.fillRect(tx - 1, fy - 3 - i + jolt, 4, 1);
          ctx.fillStyle = i > 5 ? '#6a7058' : '#4a5040'; ctx.fillRect(tx, fy - 3 - i + jolt, 2, 1);
        }
      }
    }
    if (this.aimT > 0) {
      const mx = x + this.face * (this.def.static ? 13 : this.def.weapon === 'hmg' ? 17 : 12), my = Math.round(this.muzzleY() - cy);
      const len = Math.max(0, Math.round(this.aimLen - 2)), hot = this.aimT < 0.15;
      ctx.fillStyle = hot ? 'rgba(255,70,40,0.9)' : ((this.animT * 20) | 0) % 2 ? 'rgba(255,40,30,0.6)' : 'rgba(255,40,30,0.32)';
      ctx.fillRect(this.face > 0 ? mx : mx - len, my, len, 1);
      ctx.fillStyle = hot ? '#ffffff' : '#ff3a2a'; ctx.fillRect(mx - 1, my - 1, 3, 3);
    }
    if (this.snipeT > 0) {
      // sniper laser: red while it follows you, white once locked - that's when to move
      const x0 = Math.round(this.scopeX() - cx), y0 = Math.round(this.muzzleY() - 1 - cy), len = this.laserLen;
      const vx = this.face * Math.cos(this.aimE), vy = Math.sin(this.aimE), locked = this.lockT > 0, blink = ((this.animT * 24) | 0) % 2;
      ctx.fillStyle = locked ? (blink ? '#ffffff' : '#ffc8b8') : blink ? 'rgba(255,40,30,0.8)' : 'rgba(255,40,30,0.45)';
      for (let dd = 0; dd < len; dd += locked ? 1 : 2) ctx.fillRect(Math.round(x0 + vx * dd), Math.round(y0 + vy * dd), 1, 1);
      ctx.fillStyle = locked ? '#ffffff' : '#ff3a2a';
      ctx.fillRect(Math.round(x0 + vx * len) - 1, Math.round(y0 + vy * len) - 1, 3, 3);
    }
    if (this.type === 'flamer') {
      // pilot light; it flares up while he gets ready to spray
      const nx = x + this.face * 13, ny = fy - 10, k = this.igniteT > 0 ? 1 - this.igniteT / 0.55 : 0;
      const r = this.sprayT > 0 ? 2 : this.igniteT > 0 ? 2 + Math.round(k * 3) : 0;
      const col = ((this.animT * 20) | 0) % 2 ? '#ffd23a' : '#ff8a2a';
      if (r) ctx.drawImage(circleSprite(col, r), nx - r, ny - r);
      else { ctx.fillStyle = col; ctx.fillRect(nx, ny, 1, 1); }
    }
    if (this.callT > 0) {
      // radio officer on the radio: pulses off the antenna
      const ax = x - this.face * 5, ay = fy - 19;
      for (let i = 0; i < 3; i++) {
        const rr = 2 + ((this.animT * 14 + i * 4) % 12);
        ctx.fillStyle = 'rgba(255,90,60,' + Math.max(0, 1 - rr / 14).toFixed(2) + ')';
        for (let a = -0.9; a <= 0.9; a += 0.3) ctx.fillRect(Math.round(ax + Math.sin(a) * rr), Math.round(ay - Math.cos(a) * rr), 1, 1);
      }
    }
    if (this.iconT > 0 && this.icon) {
      const bob = Math.round(Math.sin(this.iconT * 20));
      Font.drawOutlined(ctx, this.icon, x, fy - this.h - 12 + bob, this.icon === '!' ? '#ffd23a' : '#ffffff', 1, 'center');
    } else if (this.def.target) {
      const bob = Math.round(Math.sin(this.animT * 6) * 2);
      Font.drawOutlined(ctx, '↓', x, fy - this.h - 16 + bob, ((this.animT * 4) | 0) % 2 ? '#ff3a2a' : '#ff8a3a', 1, 'center');
    }
    if ((this.def.heavy || this.def.static || this.def.target) && this.hp < this.def.hp) {
      const w = 14;
      ctx.fillStyle = '#15131c'; ctx.fillRect(x - w / 2 - 1, fy - this.h - 5, w + 2, 3);
      ctx.fillStyle = '#e8321e'; ctx.fillRect(x - w / 2, fy - this.h - 4, Math.max(0, Math.round(w * this.hp / this.def.hp)), 1);
    }
  }

  // The picture for this frame (1.32): every state and reaction has its pose. A knockdown's tilt is
  // left in this.poseRot
  animFrame() {
    this.poseRot = 0;
    if (this.type === 'dog') return this.dogFrame();
    if (!TUNE.charAnim) return this.animFrameOld();
    // (bombUp: the pose has both hands up - the bomber's bomb is drawn over his head then)
    const g = this.type === 'shield' && !this.shieldUp ? Sprites.chars.shieldless : this.gfx, P = (n) => { if (/^(hang|bomb|flail|panic)/.test(n)) this.bombUp = true; return g.pose(n); };
    this.bombUp = false;
    const moving = Math.abs(this.vx) > 4, step = ((this.stride || 0) * 4) | 0, flail = (r) => P('flail' + (((this.animT * r) | 0) % 2));
    if (this.held) return flail(9); // kicking in a hero's grip
    if (this.para) return P('hang');
    if (this.downT > 0) { this.poseRot = -this.face * Math.min(1, (TUNE.knockDown - this.downT) / 0.12) * 1.45; return P('hurt'); } // flat on his back
    if (this.getupT > 0) return P('kneel'); // getting up
    if (this.burning > 0 || this.panicT > 0) return moving ? P('panic' + step) : flail(8);
    const cheering = this.cheerT > 0 && this.cheerDelay <= 0;
    if (!this.onGround) return this.screamed ? flail(10) : this.spotT > 0 ? P('hurt') : cheering ? P('cheer') : this.vy < -30 ? g.jump : g.fall;
    if (this.flinchT > 0 || this.spotT > 0) return P('hurt'); // hit, or startled
    if (cheering) return P('cheer');
    if (this.landT > 0) return P('land');
    if (this.callT > 0) return P('radio');
    if (this.windT > 0) return g.throw; // the pin out, arm back / a shell over the tube
    if (this.bashT > 0) return P('brace');
    if (this.throwT > 0 && this.type !== 'officer') { // (an officer's call holds throwT up: his pose is the radio)
      switch (this.type) {
        case 'grenadier': return P('throw2');
        case 'shield': return P('bash');
        case 'rpg': case 'sniper': return P('recoil');
        default: return g.throw;
      }
    }
    if (this.earsT > 0) return P('ears');
    if (this.snipeT > 0) return P('snipe');
    if (this.aimT > 0 || this.igniteT > 0 || this.sprayT > 0) return P('aim');
    if (this.kickT > 0) return P('recoil');
    if (this.boltT > 0 || this.reloadT > 0) return P('reload');
    if (moving) return this.state === 'attack' && this.type === 'bomber' ? P('bomb' + step) : (this.state === 'attack' && this.type === 'scout') || this.fleeT > 0 ? P('panic' + step) : g.run[step];
    if (this.state === 'suspicious') return P('brow'); // peering after that noise
    if (this.state === 'idle' || this.state === 'patrol') {
      const list = ENEMY_FIDGETS[this.type], k = this.animT % 6.5;
      if (list && TUNE.idleFidget > 0 && k < 1.1) return P(list[((this.animT / 6.5) | 0) % list.length]);
    }
    return g.idle[((this.animT * 1.5) | 0) % 2];
  }
  dogFrame() {
    const g = this.gfx;
    if (!TUNE.charAnim) return !this.onGround ? g.jump : Math.abs(this.vx) > 5 ? g.run[((this.animT * 14) | 0) % 4] : g.idle[0];
    if (!this.onGround) return g.jump;
    if (this.windup > 0) return g.crouch; // about to pounce
    if (this.barkT > 0 || (this.cheerT > 0 && this.cheerDelay <= 0)) return ((this.animT * 8) | 0) % 2 ? g.bark : g.idle[0];
    if (Math.abs(this.vx) > 5) return g.run[((this.stride || 0) * 4) | 0];
    if (this.state !== 'attack' && this.state !== 'alert' && this.animT % 3 < 1.1) return g.sniff;
    return g.idle[((this.animT * 3) | 0) % 2]; // the tail going
  }
  // the 1.31 poses (TUNE.charAnim 0, for comparison)
  animFrameOld() {
    const g = this.gfx;
    let f;
    if (this.throwT > 0) f = (this.type === 'shield' && !this.shieldUp ? Sprites.chars.shieldless : g).throw;
    else if (this.para) f = g.idle[0];
    else if (this.held) f = g.fall;
    else if (!this.onGround) f = g.fall;
    else if (Math.abs(this.vx) > 4) f = g.run[((this.animT * (this.state === 'attack' || this.burning > 0 ? 12 : 7)) | 0) % 4];
    else f = g.idle[((this.animT * 1.5) | 0) % 2];
    if (this.type === 'shield' && !this.shieldUp && f !== Sprites.chars.shieldless.throw) {
      const alt = Sprites.chars.shieldless;
      f = f === g.fall ? alt.fall : f === g.idle[0] ? alt.idle[0] : f === g.idle[1] ? alt.idle[1] : alt.run[g.run.indexOf(f)] || alt.idle[0];
    }
    return f;
  }

  drawTurret(ctx, x, fy) {
    const f = this.face, fl = this.flash > 0;
    const c1 = fl ? '#ffffff' : '#5a5f6a', c2 = fl ? '#ffffff' : '#3a3d46', c3 = fl ? '#ffffff' : '#7a808c';
    ctx.fillStyle = '#15131c'; ctx.fillRect(x - 8, fy - 13, 16, 13);
    ctx.fillStyle = c2; ctx.fillRect(x - 7, fy - 5, 14, 5);
    ctx.fillStyle = c1; ctx.fillRect(x - 5, fy - 12, 10, 8);
    ctx.fillStyle = c3; ctx.fillRect(x - 5, fy - 12, 10, 1);
    // the barrel slides back with each shot, and pulls in while the turret turns round (1.32)
    const L = 10 - (TUNE.charAnim && this.kickT > 0 ? 1 : 0) - (TUNE.charAnim && this.turnT > 0 ? Math.round(6 * Math.min(1, this.turnT / 0.8)) : 0);
    ctx.fillStyle = '#15131c'; ctx.fillRect(f > 0 ? x + 4 : x - 4 - L, fy - 10, L, 4);
    ctx.fillStyle = c2; ctx.fillRect(f > 0 ? x + 4 : x - 3 - L, fy - 9, L - 1, 2);
    ctx.fillStyle = (this.state === 'attack' && ((this.animT * 6) | 0) % 2) ? '#ff3a2a' : '#8a1a1a';
    ctx.fillRect(x - 1, fy - 11, 2, 2);
  }
}
