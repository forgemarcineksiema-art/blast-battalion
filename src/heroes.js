'use strict';
// ============================================================================
//  Heroes (playable roster) + Player controller
// ============================================================================

// unlock = total prisoners freed; the first few come quickly
const HEROES = [
  { id: 'havoc', name: 'MAX HAVOC', unlock: 0, weapon: 'ASSAULT RIFLE', special: 'FRAG GRENADES', specials: 3, tag: 'RAPID FIRE ALL-ROUNDER' },
  { id: 'buck', name: 'BUCKSHOT', unlock: 0, weapon: 'SHOTGUN', special: 'DYNAMITE', specials: 3, tag: 'DEVASTATING UP CLOSE' },
  { id: 'scorch', name: 'SCORCH', unlock: 2, weapon: 'FLAME THROWER', special: 'FIREBOMB', specials: 3, fireproof: true, tag: 'FIREPROOF. BURNS EVERYTHING' },
  { id: 'ronin', name: 'RONIN', unlock: 5, weapon: 'KATANA', special: 'SHADOW DASH', specials: 3, tag: 'SLICES BULLETS BACK' },
  { id: 'chrono', name: 'CHRONO', unlock: 8, weapon: 'BURST RIFLE', special: 'TIME WARP', specials: 2, tag: 'SLOWS THE WORLD DOWN' },
  { id: 'boomer', name: 'BOOMER', unlock: 11, weapon: 'ROCKET LAUNCHER', special: 'AIRSTRIKE', specials: 2, tag: 'EVERYTHING GOES BOOM' },
  { id: 'skyhawk', name: 'SKYHAWK', unlock: 15, weapon: 'TWIN PISTOLS', special: 'MISSILE SWARM', specials: 3, jetpack: true, tag: 'HOLD JUMP TO FLY' },
  { id: 'brutus', name: 'BRUTUS', unlock: 19, weapon: 'MINIGUN', special: 'GROUND POUND', specials: 3, tag: 'SPIN UP. MOW DOWN.' },
  { id: 'ricochet', name: 'RICOCHET', unlock: 24, weapon: 'RAZOR DISCS', special: 'BLADE STORM', specials: 3, tag: 'DISCS COME BACK' },
  { id: 'deadeye', name: 'DEADEYE', unlock: 29, weapon: 'SNIPER RIFLE', special: 'RAILGUN', specials: 2, tag: 'PIERCES WALLS & ENEMIES' },
  { id: 'phantom', name: 'PHANTOM', unlock: 35, weapon: 'SILENCED SMG', special: 'DECOY + CLOAK', specials: 3, tag: 'UNSEEN, UNHEARD' },
  { id: 'volt', name: 'VOLT', unlock: 42, weapon: 'TESLA GUN', special: 'THUNDER STORM', specials: 2, tag: 'CHAIN LIGHTNING' },
];
const HERO_BY_ID = {};
HEROES.forEach((h) => { HERO_BY_ID[h.id] = h; });

const NULL_INPUT = { down: () => false, hit: () => false };
// what a hero does with his hands when left standing (1.32): looks out, checks his weapon
const HERO_FIDGETS = ['brow', 'reload'];

// Damage per hit. Heroes carry a few hit points (RECRUIT 3, SOLDIER 2, VETERAN 1);
// anything not listed here (crushing, spikes, the detonation wall) is always fatal.
const HIT_DMG = { shot: 1, bite: 1, bash: 1, fire: 1, explosion: 2 };

// Gold-crate power-ups: one held at a time, fired with SPECIAL before the hero's own
const POCKET_ITEMS = {
  airstrike: { name: 'AIRSTRIKE' },
  timewarp: { name: 'TIME WARP' },
  swarm: { name: 'MISSILE SWARM' },
  roid: { name: 'BERSERK' },
};

// PHANTOM's hologram: every enemy nearby targets it; pops in a small blast
class Decoy {
  constructor(W, p) {
    this.W = W; this.x = p.x; this.y = p.y; this.w = p.w; this.h = p.h; this.face = p.face; this.gfx = p.gfx;
    this.t = 5; this.dead = false; this.state = 'normal'; this.vx = 0; this.vy = 0; this.slot = p.slot; this.isDecoy = true; this.anim = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) { this.t -= dt; this.anim += dt; if (this.t <= 0) this.pop(); }
  kill() { this.pop(); return true; }
  pop() {
    if (this.dead) return;
    this.dead = true;
    this.W.explode(this.cx, this.cy, 30, { owner: 'p', dmg: 8, tileDmg: 12, small: true });
    FX.smokePuff(this.cx, this.cy, 1.2);
  }
  draw(ctx, cx, cy) {
    if (this.dead || ((this.anim * 14) | 0) % 5 === 0) return; // hologram flicker
    ctx.globalAlpha = 0.6;
    drawFrame(ctx, this.gfx.idle[((this.anim * 2) | 0) % 2], this.cx - cx, this.y + this.h - cy, this.face, false);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(124,255,124,0.35)';
    ctx.fillRect(Math.round(this.x - cx) - 1, Math.round(this.y - cy) + ((this.anim * 30) | 0) % this.h, this.w + 2, 1);
  }
}

class Player {
  constructor(W, heroId, x, feetY, slot = 0) {
    this.slot = slot;
    this.W = W;
    this.hero = HERO_BY_ID[heroId];
    this.gfx = Sprites.chars[heroId];
    this.specials = this.maxSpecials();
    this.w = 10; this.h = 15;
    this.x = x - this.w / 2; this.y = feetY - this.h;
    this.vx = 0; this.vy = 0; this.face = 1;
    this.onGround = false; this.state = 'normal';
    this.inv = 2; this.fireCd = 0; this.coyote = 0; this.jumpBuf = 0; this.jumping = false; this.wall = 0; this.wallGrace = 0;
    this.wallLock = 0; this.lockDir = 0; this.animT = 0; this.throwT = 0; this.slashT = 0;
    this.spin = 0; this.dashT = 0; this.stompPhase = 0; this.charge = 0; this.dropThrough = 0;
    this.dead = false; this.recoil = 0; this.climbing = false; this.firing = false; this.landVy = 0; this.meleeCd = 0;
    this.fuel = 1; this.jetting = false; this.burstN = 0; this.burstT = 0; this.cloak = 0; this.alt = 0;
    this.pocket = null; this.roid = 0;
    this.carry = null; this.carryT = 0; this.meleeHold = -1; this.mech = null;
    this.maxHp = Meta.heroHp(W.skill) + (W.mods.armor || 0); this.hp = this.maxHp; this.hurtT = 0; // difficulty + BODY ARMOR (upgrade, perk)
    this.slideT = 0; this.slideCd = 0; this.sqT = 0; this.sqK = 0; this.sqA = 0; this.stompCd = 0;
    this.landT = 0; this.landPose = 'land'; this.stabT = 0; this.shotT = 0; this.castT = 0; this.cheerT = 0; this.idleT = 0; this.stride = 0; // poses (1.32)
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    const W = this.W, T = W.terrain;
    if (this.dead) return;
    this.animT += dt;
    if (this.state === 'extract') return;
    if (this.inv > 0) this.inv -= dt;
    if (this.cloak > 0) this.cloak -= dt;
    if (this.roid > 0) {
      // BERSERK: can't be killed, faster, flattens anyone it touches
      this.roid -= dt;
      for (const e of W.enemies) {
        if (!e.dead && !e.isBoss && e.hittable && overlap(this, e)) e.hurt(99, { kind: 'melee', dirX: this.face, force: 320, team: 'p' });
      }
      if (Math.random() < dt * 3) W.scare(this.cx, this.cy, 130, 1);
      if (Math.random() < dt * 20) FX.spawn(this.cx + rand(-5, 5), this.y + rand(0, this.h), rand(-20, 20), rand(-60, -20), 0.3, 2, '#ff5a3a', PF.SHRINK, 1);
    }
    // FAST HANDS (the rapid perk) speeds up the gun only
    this.fireCd -= dt * (1 + 0.2 * (W.mods.rapid || 0)); this.throwT -= dt; this.slashT -= dt; this.recoil -= dt; this.meleeCd -= dt;
    this.hurtT -= dt; this.slideCd -= dt; this.sqT -= dt; this.stompCd -= dt;
    this.landT -= dt * (Math.abs(this.vx) > 30 ? 3 : 1); this.stabT -= dt; this.shotT -= dt; this.castT -= dt; this.cheerT -= dt;
    if (this.flipT > 0) { this.flipT -= dt; if (this.flipT <= 0 || this.onGround) { this.flipT = 0; this.flipDur = 0; } }
    if (this.wallLock > 0) this.wallLock -= dt;
    if (this.dropThrough > 0) this.dropThrough -= dt;

    // the title's demo hero is driven by its pilot (src/attract.js)
    const inp = W.pilot || (W.inputEnabled ? Input.slots[this.slot] : NULL_INPUT);
    this.inp = inp;
    if (this.state !== 'normal' || this.mech) this.idleT = 0; // (a ladder, a slide, a vehicle: not standing about)
    let mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    const up = inp.down('up'), down = inp.down('down');
    // auto fire (option, on by default on touch screens): pull the trigger when a soldier is in the line of fire
    const auto = inp !== NULL_INPUT && !W.pilot && Settings.autoFire() && !this.carry && this.autoFireTarget();
    const fireHeld = inp.down('fire') || auto, autoPress = auto && !this.autoWas;
    this.autoWas = auto;
    const ladderHere = T.ladderAt(this.cx, this.y + this.h - 3) || T.ladderAt(this.cx, this.y + 3);
    const ladderBelow = T.ladderAt(this.cx, this.y + this.h + 3);
    const jumpPressed = inp.hit('jump') || (inp.hit('up') && !ladderHere && !this.wall);
    const jumpHeld = inp.down('jump') || (inp.down('up') && this.state !== 'ladder' && !ladderHere);
    if (this.state !== 'normal' || this.mech) this.wall = 0;
    if (this.mech) { this.updateMech(dt, inp); return; }

    if (this.state === 'dash') { this.updateDash(dt); return; }
    if (this.state === 'stomp') { this.updateStomp(dt); return; }
    if (this.state === 'charge') { this.updateCharge(dt); return; }
    if (this.state === 'slide') { this.updateSlide(dt, jumpPressed); return; }

    if (this.wallLock > 0 && mx === this.lockDir) mx = 0;

    // ------------------------------------------------ ladder
    if (this.state !== 'ladder') {
      if ((ladderHere && up) || (ladderHere && down && !this.onGround) || (ladderBelow && down && this.onGround)) {
        this.state = 'ladder'; this.vx = 0; this.vy = 0; this.jumping = false;
        if (ladderBelow && !ladderHere) { this.y += 3; this.dropThrough = 0.2; }
      }
    }
    if (this.state === 'ladder') {
      this.vy = up ? -85 : down ? 95 : 0;
      this.vx = mx * 55;
      if (mx !== 0) this.face = mx;
      const lcx = Math.floor(this.cx / TILE) * TILE + TILE / 2;
      if (mx === 0) this.x += (lcx - this.cx) * Math.min(1, dt * 14);
      this.dropThrough = 0.08;
      moveBody(this, T, dt);
      const still = T.ladderAt(this.cx, this.y + this.h - 2) || T.ladderAt(this.cx, this.y + 2);
      if (!still) { this.state = 'normal'; if (up) this.vy = -175; }
      else if (inp.hit('jump')) { this.state = 'normal'; this.vy = -250; this.jumping = true; Sound.play('jump'); }
      else if (this.onGround && (down || (mx !== 0 && !up))) this.state = 'normal';
      this.climbing = false;
      this.handleWeapons(dt, fireHeld, inp.hit('fire'));
      if (inp.hit('special')) this.doSpecial();
      if (inp.hit('melee')) this.melee();
      this.checkHazards();
      return;
    }

    // ------------------------------------------------ run
    const maxV = (this.hero.id === 'brutus' && this.spin > 0.1 ? TUNE.runSpeed * 0.47 : TUNE.runSpeed) * (this.roid > 0 ? 1.4 : 1) * (this.carry ? 0.85 : 1) * (1 + 0.12 * (W.mods.fleet || 0));
    if (mx !== 0) {
      // reversing bites twice as hard (with skid dust); airborne speed above the cap is kept (slide-jumps)
      const turning = this.onGround && this.vx * mx < -20;
      if (!this.onGround && this.vx * mx > 0 && Math.abs(this.vx) > maxV) this.vx = approach(this.vx, mx * maxV, 90 * dt);
      else this.vx = approach(this.vx, mx * maxV, (this.onGround ? TUNE.accel * (turning ? TUNE.turnMul : 1) : TUNE.airAccel) * dt);
      if (turning && Math.random() < 0.5) FX.dust(this.cx - mx * 3, this.y + this.h, 1, -mx);
      this.face = mx;
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? 1500 : 260) * dt);
    }

    // ------------------------------------------------ slide: tap DOWN while running on solid ground
    // (ducks under chest-high fire and trips soldiers in the way)
    if (inp.hit('down') && this.onGround && !this.carry && Math.abs(this.vx) > 60 && this.slideCd <= 0 && !ladderBelow && this.onSolidGround()) {
      this.startSlide();
      return;
    }

    // ------------------------------------------------ jump (buffer + coyote)
    if (jumpPressed) this.jumpBuf = TUNE.jumpBuffer; else this.jumpBuf -= dt;
    this.coyote = this.onGround ? TUNE.coyote : this.coyote - dt;
    let groundJumped = false;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -TUNE.jumpVel; this.jumpBuf = 0; this.coyote = 0; this.jumping = true; this.onGround = false; groundJumped = true;
      Sound.play('jump'); FX.dust(this.cx, this.y + this.h, 3); this.sq(-1);
    }
    if (this.jumping && !jumpHeld && this.vy < -90) { this.vy *= TUNE.jumpCut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;

    // ------------------------------------------------ walls (1.26)
    // A jump along a wall is an ordinary jump (it used to run the hero up the wall at jump speed
    // with no gravity: 240 px instead of 58). Coming down against a wall while holding toward it
    // grabs it, and on the wall the hero faces the way it was last pushed, as on the ground:
    // pushing into the wall (or UP) climbs it at a steady pace, and FIRE digs into it; letting go
    // hangs there; pushing away turns the hero round to shoot away from the wall, and held a moment
    // longer without shooting lets go. DOWN slides down, JUMP kicks off. A ledge at chest height
    // gets vaulted onto
    let climbing = false;
    if (this.wall && (this.onGround || !this.touchingWall(this.wall) || this.vy < -150)) this.wall = 0; // landed, the wall's gone, or a blast threw the hero off
    if (this.wall && mx === -this.wall && !fireHeld) {
      this.awayT = (this.awayT || 0) + dt;
      if (this.awayT > 0.25) { this.wallGrace = 0.12; this.graceDir = this.wall; this.wall = 0; this.vx = mx * 60; } // let go (a jump right after still kicks off)
    } else this.awayT = 0;
    this.wallGrace -= dt;
    const jetIntent = jumpHeld && (this.hero.jetpack || W.mods.jetpack) && this.fuel > 0;
    const side = this.wall || (!this.onGround && mx !== 0 && this.touchingWall(mx) ? mx : 0);
    if (side && !this.wallAt(side, this.y + 2)) {
      // ledge: vault over
      this.vy = Math.min(this.vy, -215); this.vx = side * 70; this.wall = 0;
    } else if ((side || this.wallGrace > 0) && jumpPressed && !groundJumped) {
      const d = side || this.graceDir;
      this.vx = -d * 180; this.vy = -TUNE.jumpVel * 0.91; this.wallLock = 0.22; this.lockDir = d; this.face = -d;
      this.flipT = this.flipDur = 0.3; // a flip off the wall
      this.jumping = true; this.jumpBuf = 0; this.wall = 0; this.wallGrace = 0;
      // chained wall jumps climb in pitch and kick up more dust
      this.wallChain = (this.wallChain || 0) + 1;
      Sound.play('jump', 1, 1 + 0.07 * Math.min(5, this.wallChain - 1)); FX.dust(this.cx + d * 5, this.cy, 3 + Math.min(4, this.wallChain), -d); this.sq(-1);
      if (this.wallChain >= 3) for (let i = 0; i < 4; i++) FX.spawn(this.cx + d * 4, this.y + rand(2, 13), d * rand(60, 120), rand(-20, 20), 0.14, 1, '#ffffff', PF.TRAIL);
      Playtest.use('walljump', this);
    } else if (side && (this.wall || (this.vy > -40 && !jetIntent))) {
      if (!this.wall) this.grabWall(side);
      const d = this.wall, wx = d > 0 ? this.x + this.w : this.x;
      this.vx = 0;
      if (mx === d || (up && mx === 0 && !down)) {
        climbing = true; this.vy = -TUNE.climbSpeed; this.face = d;
        if (Math.random() < dt * 8) FX.dust(wx, this.y + this.h - 2, 1, -d);
      } else if (down) {
        this.vy = Math.min(Math.max(this.vy, 0) + GRAVITY * dt, 130);
        if (Math.random() < dt * 14) FX.dust(wx, this.y + this.h - 2, 1, -d);
      } else this.vy = 0; // hanging on, facing the way it was last pushed
    }
    this.climbing = climbing;

    // SKYHAWK: keep holding jump past the apex and the jetpack kicks in
    let jet = false;
    if (this.hero.jetpack || W.mods.jetpack) { // ROCKET BOOTS give everyone SKYHAWK's jetpack
      if (this.onGround) this.fuel = Math.min(1, this.fuel + dt * 1.6);
      else if (!this.wall && jumpHeld && !this.jumping && this.fuel > 0) {
        jet = true; this.fuel -= dt * 0.9;
        this.vy = approach(this.vy, -72, 1500 * dt);
        if (Math.random() < 0.85) FX.spawn(this.cx - this.face * 4, this.y + this.h - 2, rand(-12, 12), rand(70, 130), 0.22, 2, pick(['#ffd23a', '#ff8a3a', '#ffffff']), PF.CIRCLE | PF.SHRINK, 1);
      }
      if (jet !== this.jetting) Sound.loop('flame' + this.slot, jet, 0.4);
    }
    this.jetting = jet;
    if (!this.wall && !jet) {
      // snappy arc: normal gravity on the way up, a short floaty apex while jump is held, heavier fall
      let g = GRAVITY;
      if (this.vy > 0) g *= TUNE.fallGrav;
      if (Math.abs(this.vy) < 40 && jumpHeld) g *= TUNE.apexHang;
      this.vy = Math.min(this.vy + g * dt, TUNE.maxFall);
    }

    // drop through one-way platforms
    if (down && this.onGround && !jumpPressed) {
      const fy = this.y + this.h + 2;
      if (!T.solidAt(this.x + 1, fy) && !T.solidAt(this.x + this.w - 1, fy) &&
        (T.standableAt(this.x + 1, fy) || T.standableAt(this.x + this.w - 1, fy))) {
        this.dropThrough = 0.22; this.y += 2; this.onGround = false;
      }
    }

    if (this.onGround || this.vy <= 0 || this.apexY == null) this.apexY = this.y; // the top of the arc: a fall is measured from it
    const wasGround = this.onGround, preVy = this.vy;
    if (this.vy < 0) this.cornerNudge(T, dt);
    moveBody(this, T, dt);
    if (this.onGround && !wasGround) {
      this.wallChain = 0;
      // the knees give (1.32): a crouch on a real landing, a kneel after a long drop or out of the chopper
      const pk = TUNE.poseTime;
      if (this.dropIn) { this.dropIn = false; this.landT = 0.45 * pk; this.landPose = 'kneel'; FX.dust(this.cx, this.y + this.h, 5); }
      else if (this.y - this.apexY >= 112) { this.landT = 0.3 * pk; this.landPose = 'kneel'; }
      else if (this.landVy > 150) { this.landT = 0.11 * pk; this.landPose = 'land'; }
      if (this.y - this.apexY >= 112) this.hardLanding(this.y - this.apexY);
      if (this.landVy > 200 && T.weak) this.breakWeak(); // a jump onto cracked ground breaks through
      if (this.landVy > 150) this.sq(Math.min(1, this.landVy / 420));
      if (this.landVy > 240) { FX.dust(this.cx, this.y + this.h, 4); Sound.play('land', 0.5); }
      if (this.landVy > 380) W.kick(0, 1.5);
    }
    if (preVy > 80) this.checkStomp(jumpHeld);
    if (this.onGround) strideStep(this, dt);
    if (this.onGround && Math.abs(this.vx) > 30) {
      this.stepT = (this.stepT || 0) + dt * Math.abs(this.vx) / 100;
      if (this.stepT > 0.3) {
        this.stepT = 0; Sound.play('step', 0.8, rand(0.85, 1.15));
        // a puff of dust (snow in the arctic) kicked up at every stride
        if (Math.abs(this.vx) > 70) FX.spawn(this.cx - this.face * 3, this.y + this.h - 1, -this.face * rand(8, 22), rand(-14, -5), rand(0.25, 0.4), 1.5, '#ccc', PF.CIRCLE | PF.DRAG | PF.SHRINK, W.def.theme === 'arctic' ? 6 : 5);
      }
    }

    // hands full while carrying a soldier: FIRE / MELEE throw him instead. Climbing a wall no longer
    // holds the gun (1.25.1): most jumps here go up a ledge, and the shots now chip the wall on the
    // way up and fly over the edge the moment the hero clears it
    if (!this.carry) this.handleWeapons(dt, fireHeld, inp.hit('fire') || autoPress);
    if (inp.hit('special') && !this.carry) this.doSpecial();
    this.handleMeleeInput(dt, inp, climbing);
    // standing about with nothing pressed: after a while the hero fidgets (the look only)
    this.idleT = mx || fireHeld || up || down || jumpHeld || !this.onGround || this.wall || Math.abs(this.vx) > 5 ? 0 : this.idleT + dt;
    this.checkHazards();
  }

  // the moment a hero grabs a wall: a puff of dust, a scuff - and, the first two times, how walls work
  grabWall(d) {
    this.wall = d; this.vy = 0; this.jumping = false; this.flipT = 0; this.face = d; this.awayT = 0;
    FX.dust(d > 0 ? this.x + this.w : this.x, this.cy, 3, -d); Sound.play('land', 0.45, 1.35);
    Playtest.use('wallgrab', this);
  }

  // A long fall ends in a hard landing: a thump that shakes the screen and a shockwave along the
  // ground that knocks nearby soldiers off their feet (it never kills) and bounces loose things.
  // Rocket jumps, jetpack drops and roof leaps all end with one
  hardLanding(drop) {
    const W = this.W, k = Math.min(1, (drop - 112) / 160), fx = this.cx, fy = this.y + this.h;
    const r = 36 + 26 * k + (this.hero.id === 'brutus' ? 12 : 0);
    W.shake(2 + 3 * k); W.kick(0, 2.5 + 2 * k); W.freeze(0.03 + 0.03 * k);
    Sound.play('thud', 0.8 + 0.4 * k);
    this.sq(1);
    for (let i = 0; i < 12; i++) {
      const dir = i % 2 ? 1 : -1;
      FX.spawn(fx + dir * rand(0, 4), fy - rand(1, 4), dir * rand(90, 220), rand(-40, -8), rand(0.35, 0.7), rand(2, 3.5), '#ccc', PF.CIRCLE | PF.DRAG | PF.GROW | PF.FLICKER, W.def.theme === 'arctic' ? 6 : 5);
    }
    FX.addEffect({ type: 'shock', x: fx, y: fy - 2, r: r * 1.2, dur: 0.25 });
    FX.impulse(fx, fy, r, 0.7);
    let hit = 0;
    for (const e of W.enemies) {
      if (e.dead || e.isBoss || e.def.static || !e.hittable) continue;
      const dx = e.cx - fx;
      if (Math.abs(dx) > r || Math.abs(e.y + e.h - fy) > 18) continue;
      const dir = Math.sign(dx) || this.face, kk = e.def.heavy ? 0.4 : 1;
      e.vx = dir * 150 * kk; e.vy = -150 * kk; e.onGround = false;
      e.stun = Math.max(e.stun || 0, e.def.heavy ? 0.45 : 0.8); e.aimT = 0; e.burst = 0; e.awake = true;
      e.icon = '*'; e.iconT = 0.8;
      if (e.knockDown) e.knockDown(); // flat on his back, then up again (1.32)
      hit++;
    }
    for (const c of W.corpses) if (Math.abs(c.x + 6 - fx) < r && Math.abs(c.y - fy) < 20) { c.vy = -rand(140, 200); c.vx += Math.sign(c.x + 6 - fx) * 60; c.onGround = false; }
    for (const o of W.props) {
      if (!(o instanceof Barrel) || o.dead || Math.abs(o.x + o.w / 2 - fx) > r || Math.abs(o.y + o.h - fy) > 20) continue;
      o.vy = -160; o.vx += Math.sign(o.x + o.w / 2 - fx) * 70; o.onGround = false;
    }
    if (hit) {
      const bonus = Math.round(50 * hit * W.skill.score);
      W.score += bonus;
    }
  }

  // cracked ground (a secret vault's roof) gives way under a landing
  breakWeak() {
    const T = this.W.terrain, cy = Math.floor((this.y + this.h + 2) / TILE);
    for (const fx of [this.x + 2, this.cx, this.x + this.w - 2]) {
      const cx = Math.floor(fx / TILE), i = cy * T.w + cx;
      if (!T.weak.has(i) || !T.solid(cx, cy)) continue;
      T.weak.delete(i); T.damage(cx, cy, 99, 'melee');
      FX.dust(cx * TILE + 8, cy * TILE, 4); Sound.play('crumble', 0.8);
    }
  }

  // squash (k > 0, landing) / stretch (k < 0, take-off) for a few frames
  sq(k) { this.sqK = Math.sign(k); this.sqA = Math.min(1, Math.abs(k)); this.sqT = 0.12; }

  onSolidGround() {
    const T = this.W.terrain, fy = this.y + this.h + 2;
    return T.solidAt(this.x + 1, fy) || T.solidAt(this.x + this.w - 1, fy);
  }

  // jumping into a ceiling corner by a few pixels slides you past it instead of stopping dead
  cornerNudge(T, dt) {
    const ny = this.y + this.vy * dt - 0.5;
    const L = T.solidAt(this.x + 0.5, ny), R = T.solidAt(this.x + this.w - 0.5, ny);
    if (L === R) return;
    for (let s = 1; s <= 5; s++) {
      const nx = this.x + (L ? s : -s);
      if (T.solidAt(nx + 0.5, ny) || T.solidAt(nx + this.w - 0.5, ny)) continue;
      if (T.solidAt(nx + 0.5, this.y + 1) || T.solidAt(nx + this.w - 0.5, this.y + 1)) return;
      if (T.solidAt(nx + 0.5, this.y + this.h - 1) || T.solidAt(nx + this.w - 0.5, this.y + this.h - 1)) return;
      this.x = nx;
      return;
    }
  }

  // landing on a soldier's head flattens him and bounces you back up (hold jump = higher)
  checkStomp(jumpHeld) {
    const W = this.W;
    if (this.stompCd > 0 || this.dead) return;
    const feet = this.y + this.h;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable || e.isBoss || e.para) continue;
      if (this.x + this.w <= e.x + 1 || this.x >= e.x + e.w - 1) continue;
      if (feet < e.y - 3 || feet > e.y + 8) continue;
      e.hurt(e.def.heavy || e.def.static ? 5 : 99, { kind: 'melee', dirX: this.face, force: 40, team: 'p', style: STYLE.stomp });
      this.y = e.y - this.h - 0.5; this.vy = jumpHeld ? -(TUNE.stompBounce + 100) : -TUNE.stompBounce; this.jumping = jumpHeld; this.onGround = false;
      this.stompCd = 0.15; this.sq(-1);
      W.freeze(0.05); W.shake(2.5); Sound.play('punch'); FX.dust(this.cx, feet, 5);
      Playtest.use('stomp', this);
      return;
    }
  }

  startSlide() {
    this.state = 'slide'; this.slideT = TUNE.slideTime; this.slideCd = 0.3;
    this.vx = this.face * Math.max(Math.abs(this.vx) + 70, TUNE.slideSpeed);
    this.slideHit = new Set(); this.sq(0.6);
    FX.dust(this.cx, this.y + this.h, 4, -this.face); Sound.play('land', 0.7, 1.4);
    Playtest.use('slide', this);
  }
  updateSlide(dt, jumpPressed) {
    const W = this.W, T = W.terrain;
    this.slideT -= dt;
    this.vx = approach(this.vx, this.face * 60, 300 * dt);
    this.vy = Math.min(this.vy + GRAVITY * TUNE.fallGrav * dt, TUNE.maxFall);
    moveBody(this, T, dt);
    if (Math.random() < 0.7) FX.dust(this.cx - this.face * 4, this.y + this.h, 1, -this.face);
    if (Math.random() < 0.6) FX.spawn(this.cx - this.face * 6, this.y + rand(3, 13), -this.face * rand(80, 140), 0, 0.12, 1, '#ffffff', PF.TRAIL); // speed lines
    for (const e of W.enemies) {
      if (e.dead || e.isBoss || !e.hittable || this.slideHit.has(e) || !overlap(this, e)) continue;
      this.slideHit.add(e);
      if (e.def.static || e.def.heavy) { e.hurt(2, { kind: 'melee', dirX: this.face, force: 60, team: 'p' }); continue; }
      e.hurt(99, { kind: 'melee', dirX: this.face, force: 150, team: 'p', style: STYLE.tackle });
      W.freeze(0.03); Sound.play('punch', 0.8);
    }
    if (jumpPressed && this.onGround) {
      // slide-jump keeps the speed: a long, low leap
      this.state = 'normal'; this.vy = -TUNE.jumpVel * 0.94; this.jumping = true; this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
      this.sq(-1); Sound.play('jump'); FX.dust(this.cx, this.y + this.h, 3);
      this.flipT = this.flipDur = 0.36; // a diving front flip out of the slide
      Playtest.use('slidejump', this);
      return;
    }
    if (this.slideT <= 0 || !this.onGround || this.hitWall) this.state = 'normal';
    this.checkHazards();
  }

  wallAt(dir, py) {
    const px = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    if (px < 0 || px >= this.W.terrain.w * TILE) return false; // no climbing the world border
    return this.W.terrain.solidAt(px, py);
  }
  touchingWall(dir) { return this.wallAt(dir, this.y + 3) || this.wallAt(dir, this.y + this.h - 3); }

  checkHazards() {
    const T = this.W.terrain;
    unstick(this, T);
    if (!this.hero.fireproof && this.inv <= 0 && T.fireAtRect(this.x + 2, this.y + 3, this.w - 4, this.h - 3, 'p')) this.kill('fire', { src: T.fireSrc === 'fuel' ? 'burning fuel' : 'ground fire' });
  }

  // ------------------------------------------------------------ weapons
  muzzle() { return this.mech ? this.mechMuzzle() : { x: this.cx + this.face * 12, y: this.y + 5 }; }

  // Light aim assist: if the nearest visible enemy ahead stands a level above or
  // below (within ~1.75 tiles of the gun) and a level shot would miss him, the
  // shot tilts toward him - at most ~18 degrees. Anything farther off still needs a jump.
  aimAssist(range) {
    const maxA = TUNE.aimMax * Settings.aimMul() * Math.PI / 180;
    if (maxA <= 0) return 0;
    const W = this.W, T = W.terrain, m = this.muzzle();
    let best = null, bdx = Infinity;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable) continue;
      const dx = (e.cx - m.x) * this.face;
      if (dx < 6 || dx > range || dx >= bdx) continue;
      if (Math.abs(e.cy - m.y) > TUNE.aimBand * Settings.aimBandMul()) continue;
      if (!T.los(m.x, m.y, e.cx, e.cy)) continue;
      best = e; bdx = dx;
    }
    if (!best || (m.y >= best.y - 1 && m.y <= best.y + best.h + 1)) return 0; // nobody, or already in the line of fire
    return clamp(Math.atan2(best.cy - m.y, bdx), -maxA, maxA);
  }

  // is anyone worth shooting ahead? (same reach the weapon has, same band the aim assist uses)
  autoFireTarget() {
    const W = this.W, T = W.terrain, m = this.muzzle(), range = this.mech ? 320 : AUTO_RANGE[this.hero.id] || 300;
    const band = Math.max(10, TUNE.aimBand * Settings.aimBandMul() * (Settings.aimMul() > 0 ? 1 : 0.4));
    for (const e of W.enemies) {
      if (e.dead || !e.hittable || e.held) continue;
      const dx = (e.cx - m.x) * this.face;
      if (dx < -4 || dx > range || Math.abs(e.cy - m.y) > band) continue;
      if (!W.onScreen(e.cx, e.cy, -6) || !T.los(m.x, m.y, e.cx, e.cy)) continue;
      return true;
    }
    return false;
  }

  maxSpecials() { return this.hero.specials + Meta.extraSpecials() + (this.W.mods.supply || 0); } // SUPPLY PACK upgrade and perk
  bullet(angle, speed, dmg, tileDmg, life, extra) {
    const m = this.muzzle();
    this.W.projectiles.push(new Projectile(Object.assign({
      x: this.cx + this.face * 7, y: m.y, vx: Math.cos(angle) * speed * this.face, vy: Math.sin(angle) * speed,
      team: 'p', kind: 'bullet', dmg, tileDmg, life,
    }, extra || {})));
  }

  // Knife / punch. Instant kill on regular soldiers, also the contextual
  // point-blank attack when FIRE is tapped with an enemy right in front.
  meleeBox() {
    return { x: this.face > 0 ? this.x + this.w - 1 : this.x - 19, y: this.y - 2, w: 20, h: this.h + 2 };
  }
  // MELEE tap = knife / kick; hold it (0.18 s) next to a soldier = grab him.
  // A held soldier soaks up bullets from the front; FIRE or MELEE throws him.
  handleMeleeInput(dt, inp, blocked) {
    if (this.carry) {
      this.carryT -= dt;
      if (this.carry.dead) { this.carry = null; return; }
      if (inp.hit('melee') || inp.hit('fire') || this.carryT <= 0) this.throwCarry();
      return;
    }
    if (blocked) { this.meleeHold = -1; return; }
    if (inp.hit('melee')) {
      if (this.grabTarget()) this.meleeHold = 0; // decide on release (knife) or hold (grab)
      else this.melee();
    }
    if (this.meleeHold >= 0) {
      if (inp.down('melee')) {
        this.meleeHold += dt;
        if (this.meleeHold >= 0.18) {
          const e = this.grabTarget();
          this.meleeHold = -1;
          if (e) this.grab(e); else this.melee();
        }
      } else { this.meleeHold = -1; this.melee(); }
    }
  }
  grabTarget() {
    const b = this.meleeBox();
    for (const e of this.W.enemies) {
      if (e.dead || !e.hittable || e.isBoss || e.def.static || e.def.heavy || e.para || e.held) continue;
      if (e.shieldUp && e.face === -this.face) continue; // not through a raised riot shield
      if (rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) return e;
    }
    return null;
  }
  grab(e) {
    this.carry = e; this.carryT = 3.5;
    e.held = this; e.aimT = 0; e.burst = 0; e.bashT = 0; e.windup = 0; e.shieldHits = 0; e.awake = true;
    this.throwT = 0.2;
    Playtest.use('grab', this);
    Sound.play('punch', 0.7, 0.8);
  }
  throwCarry() {
    const e = this.carry, W = this.W;
    this.carry = null;
    if (!e || e.dead) return;
    e.held = null;
    Playtest.use('throw', this);
    e.x = this.cx + this.face * 6 - e.w / 2; e.y = this.y - 2;
    // thrown bodies fly and bowl over whoever they hit (a bomber still ticks)
    e.hurt(99, { kind: 'melee', dirX: this.face, force: 380, team: 'p', bowl: true, style: STYLE.thrown, ev: ++W.evSeq });
    this.throwT = 0.25;
    Sound.play('throw', 1, 0.8); W.kick(this.face * 1.5);
  }

  enemyInMeleeRange() {
    const b = this.meleeBox();
    return this.W.enemies.some((e) => !e.dead && e.hittable && !e.isBoss && rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) ||
      this.W.props.some((o) => o instanceof Barrel && !o.dead && o.fuse < 0 && !(o.rocketT > 0) && rectsOverlap(b.x, b.y, b.w, b.h, o.x, o.y, o.w, o.h));
  }
  melee(auto) {
    const W = this.W;
    if (this.meleeCd > 0 || this.state !== 'normal' && this.state !== 'ladder') return false;
    this.meleeCd = 0.32; this.throwT = 0.14; this.stabT = 0.16;
    Playtest.use(auto ? 'knife:auto' : 'knife', this);
    const b = this.meleeBox();
    let hit = false;
    const ev = ++W.evSeq;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable || !rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
      // the kick sends the body flying into his friends (bowling)
      e.hurt(e.isBoss ? 3 : 6, { kind: 'melee', dirX: this.face, force: 300, team: 'p', bowl: true, ev });
      FX.blood(e.x + e.w / 2, e.y + 6, this.face, 7);
      hit = true;
    }
    for (const o of W.props) {
      if (!o.hittable || o.dead || !rectsOverlap(b.x, b.y, b.w, b.h, o.x, o.y, o.w, o.h)) continue;
      if (o instanceof Barrel) { o.kick(this.face); Playtest.use('barrel kick', this); }
      else o.hurt(3, { kind: 'melee', dirX: this.face, team: 'p' });
      hit = true;
    }
    // (bodies from this very swing are already flying - don't re-kick them)
    for (const c of W.corpses) if (!c.dead && c.ev !== ev && rectsOverlap(b.x, b.y - 6, b.w, b.h + 6, c.x, c.y, c.w, c.h)) { c.kick(this.face, W); hit = true; }
    // bat live grenades back where they came from
    for (const q of W.projectiles) {
      if (q.dead || q.team !== 'e' || !(q.fuse > 0) || !rectsOverlap(b.x - 4, b.y - 4, b.w + 8, b.h + 8, q.x - 2, q.y - 2, 4, 4)) continue;
      q.team = 'p'; q.reflected = true; q.vx = this.face * 260; q.vy = -170; q.stuck = false; q.fuse = Math.max(q.fuse, 0.6);
      FX.sparks(q.x, q.y, 5, this.face); hit = true;
      Playtest.use('bat grenade', this);
    }
    W.terrain.damage(Math.floor((this.cx + this.face * 11) / TILE), Math.floor((this.y + 6) / TILE), 3, 'melee');
    FX.addEffect({ type: 'slash', x: this.cx + this.face * 8, y: this.y + 6, face: this.face, r: 8, dur: 0.08 });
    Sound.play(hit ? 'punch' : 'throw');
    if (hit) { W.freeze(0.035); W.shake(1.5); }
    if (this.onGround) this.vx += this.face * 30;
    return hit;
  }

  handleWeapons(dt, fireHeld, firePressed) {
    const W = this.W, id = this.hero.id;
    if (this.burstN > 0) {
      // CHRONO's three-round burst keeps going after the trigger is released
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstN--; this.burstT = 0.055;
        const bm = this.muzzle();
        this.bullet(rand(-0.015, 0.015) + this.aimAssist(540), 620, 1.4, 3.6, 0.9);
        FX.muzzle(bm.x, bm.y, this.face, 4); FX.shell(this.cx, bm.y, this.face);
        Sound.play('burst', 0.9); W.noise(this.cx, this.cy, 140); this.recoil = 0.05; W.kick(-this.face * 0.9); this.shotT = 0.09;
      }
    }
    if (firePressed && id !== 'ronin' && this.enemyInMeleeRange()) { this.melee(true); this.fireCd = Math.max(this.fireCd, 0.2); return; }
    this.firing = fireHeld;
    if (id === 'scorch') Sound.loop('flame' + this.slot, fireHeld, 1);
    if (id === 'brutus') {
      this.spin = fireHeld ? Math.min(0.5, this.spin + dt) : Math.max(0, this.spin - dt * 1.4);
      Sound.loop('spin' + this.slot, this.spin > 0.02, 1);
    }
    if (!fireHeld || this.fireCd > 0) return;
    const m = this.muzzle();
    switch (id) {
      case 'havoc':
        this.fireCd = 0.085;
        this.bullet(rand(-0.03, 0.03) + this.aimAssist(480), 600, 1, 3.4, 0.85);
        FX.muzzle(m.x, m.y, this.face, 4); FX.shell(this.cx, m.y, this.face);
        Sound.play('rifle', 1, rand(0.95, 1.05)); W.noise(this.cx, this.cy, 140); this.recoil = 0.05; W.kick(-this.face * 0.7);
        break;
      case 'buck':
        this.fireCd = 0.52;
        const sev = ++W.evSeq, sa = this.aimAssist(200);
        // point blank the blast throws the body across the screen, and the kill lands harder
        const pb = W.enemies.some((e) => !e.dead && e.hittable && (e.cx - this.cx) * this.face > 0 && Math.abs(e.cx - this.cx) < 52 && Math.abs(e.cy - this.cy) < 16);
        for (let i = 0; i < 6; i++) this.bullet(rand(-0.17, 0.17) + sa, rand(470, 590), 1, 5, rand(0.28, 0.4), { force: pb ? 280 : 120, ev: sev, freezeMul: pb ? 1.6 : 1.2 });
        W.schedule(0.3, () => { if (!this.dead) FX.shell(this.cx, this.y + 6, this.face, 'hull'); }); // racked: out flies the red hull
        if (this.onGround) this.vx -= this.face * 60;
        W.shake(2.5); W.kick(-this.face * 3); FX.muzzle(m.x, m.y, this.face, 7); FX.smokePuff(m.x + this.face * 4, m.y, 0.6);
        Sound.play('shotgun'); W.noise(this.cx, this.cy, 180); this.recoil = 0.12;
        break;
      case 'scorch': {
        this.fireCd = 0.03;
        const fa = this.aimAssist(110);
        W.projectiles.push(new Projectile({
          x: this.cx + this.face * 11, y: m.y, vx: this.face * rand(230, 290) + this.vx * 0.5, vy: rand(-26, 12) + Math.sin(fa) * 260,
          kind: 'flame', team: 'p', life: rand(0.5, 0.62), dmg: 0,
        }));
        W.noise(this.cx, this.cy, 90);
        break;
      }
      case 'ronin': this.slash(); break;
      case 'boomer': {
        this.fireCd = 0.8;
        const ra = this.aimAssist(400);
        W.projectiles.push(new Projectile({
          x: this.cx + this.face * 12, y: this.y + 3, vx: this.face * Math.cos(ra) * 150, vy: Math.sin(ra) * 150, kind: 'rocket', team: 'p',
          accel: 900, maxSpeed: 460, radius: 36, explodeDmg: 10, explodeTile: 44, life: 2, sprite: Sprites.props.rocket,
        }));
        if (this.onGround) this.vx -= this.face * 50;
        FX.smokePuff(this.cx - this.face * 12, this.y + 3, 0.8);
        W.shake(1.5); W.kick(-this.face * 2.5); Sound.play('rocket'); W.noise(this.cx, this.cy, 160); this.recoil = 0.15;
        break;
      }
      case 'brutus':
        if (this.spin < 0.3) return;
        this.fireCd = 0.045;
        this.bullet(rand(-0.09, 0.09) + this.aimAssist(440), 540, 1, 3, 0.85, { freezeMul: 0.6 }); // a light hold: a spray shouldn't stutter
        FX.muzzle(m.x + this.face * 2, m.y + 1, this.face, 4); FX.shell(this.cx, m.y, this.face, 'heavy');
        Sound.play('mg'); W.noise(this.cx, this.cy, 150);
        if (this.onGround) this.vx -= this.face * 14;
        W.shake(0.5); this.recoil = 0.04; W.kick(-this.face * 0.5);
        break;
      case 'deadeye': this.snipe(); break;
      case 'volt': this.tesla(); break;
      case 'chrono': this.fireCd = 0.36; this.burstN = 3; this.burstT = 0; break;
      case 'skyhawk': {
        this.fireCd = 0.12; this.alt = 1 - this.alt;
        const my = m.y + (this.alt ? -1 : 2), pa = this.aimAssist(440);
        W.projectiles.push(new Projectile({ x: this.cx + this.face * 7, y: my, vx: this.face * Math.cos(pa) * 540, vy: Math.sin(pa) * 540 + rand(-8, 8), team: 'p', kind: 'bullet', dmg: 1, tileDmg: 2.6, life: 0.85 }));
        FX.muzzle(m.x, my, this.face, 3); FX.shell(this.cx, my, this.face, 'small');
        Sound.play('pistol', 0.85, this.alt ? 1 : 1.08); W.noise(this.cx, this.cy, 120); W.kick(-this.face * 0.5);
        break;
      }
      case 'ricochet': {
        let out = 0;
        for (const q of W.projectiles) if (q.kind === 'disc' && q.owner === this && !q.dead) out++;
        if (out >= 2) return;
        this.fireCd = 0.22; this.throwT = 0.15;
        const da = this.aimAssist(240);
        W.projectiles.push(new Projectile({ x: this.cx + this.face * 8, y: m.y, vx: this.face * Math.cos(da) * 380, vy: Math.sin(da) * 380, team: 'p', kind: 'disc', owner: this, phase: 0, dmg: 3, tileDmg: 5, life: 3.5, pierce: 99 }));
        Sound.play('throw', 1, 1.3); W.noise(this.cx, this.cy, 50);
        break;
      }
      case 'phantom':
        this.fireCd = 0.07;
        this.bullet(rand(-0.045, 0.045) + this.aimAssist(470), 580, 1, 2.6, 0.85);
        FX.muzzle(m.x, m.y, this.face, 2); FX.shell(this.cx, m.y, this.face, 'small');
        Sound.play('silenced', 0.9); W.noise(this.cx, this.cy, 36); W.kick(-this.face * 0.3); // suppressed: barely wakes anyone
        break;
    }
    this.shotT = 0.09; // a shot went off: the firing stance (1.32)
  }

  // SKYHAWK: six mini-missiles pop up, then hunt the closest enemies on screen
  missileSwarm() {
    const W = this.W;
    const targets = W.enemies.filter((e) => !e.dead && e.hittable && W.onScreen(e.cx, e.cy, 10))
      .sort((a, b) => Math.abs(a.cx - this.cx) - Math.abs(b.cx - this.cx));
    for (let i = 0; i < 6; i++) {
      W.schedule(i * 0.07, () => {
        if (this.dead) return;
        W.projectiles.push(new Projectile({
          x: this.cx - this.face * 3, y: this.y + 2, vx: this.face * rand(-30, 70), vy: -rand(230, 290), team: 'p', kind: 'homing',
          target: targets.length ? targets[i % targets.length] : null, sprite: Sprites.props.minimissile,
          radius: 24, explodeDmg: 8, explodeTile: 24, life: 2.6,
        }));
        Sound.play('rocket', 0.55, 1.4);
      });
    }
    this.throwT = 0.3;
  }

  slash() {
    const W = this.W, T = W.terrain;
    this.fireCd = 0.26; this.slashT = 0.16;
    const hx = this.face > 0 ? this.x + this.w - 2 : this.x - 28, hy = this.y - 5, hw = 30, hh = this.h + 8;
    let connected = false;
    const ev = ++W.evSeq;
    for (const e of W.enemies) if (!e.dead && e.hittable && rectsOverlap(hx, hy, hw, hh, e.x, e.y, e.w, e.h)) {
      e.hurt(4, { kind: 'melee', dirX: this.face, force: 170, team: 'p', ev });
      FX.blood(e.x + e.w / 2, e.y + 6, this.face, 6);
      connected = true;
    }
    if (connected) W.freeze(0.03);
    for (const o of W.props) if (o.hittable && !o.dead && rectsOverlap(hx, hy, hw, hh, o.x, o.y, o.w, o.h)) o.hurt(3, { kind: 'melee', dirX: this.face, team: 'p' });
    for (const c of W.corpses) if (!c.dead && rectsOverlap(hx, hy, hw, hh, c.x, c.y, c.w, c.h)) c.hurt(3, { kind: 'melee', dirX: this.face });
    for (const pr of W.projectiles) {
      if (pr.team === 'e' && !pr.dead && pr.x > hx - 4 && pr.x < hx + hw + 4 && pr.y > hy - 4 && pr.y < hy + hh + 4) {
        pr.team = 'p'; pr.reflected = true; pr.vx = -pr.vx * 1.5; pr.vy = -pr.vy * 0.3; pr.life = Math.max(pr.life, 1); if (pr.fuse > 0) pr.fuse += 0.3;
        FX.sparks(pr.x, pr.y, 6, this.face); Sound.play('metal', 1);
      }
    }
    const tcx = Math.floor((this.cx + this.face * 14) / TILE);
    for (let py = this.y - 2; py <= this.y + this.h + 2; py += 8) T.damage(tcx, Math.floor(py / TILE), 6, 'melee');
    FX.addEffect({ type: 'slash', x: this.cx + this.face * 6, y: this.cy - 2, face: this.face, r: 14, dur: 0.12 });
    Sound.play('slash'); W.noise(this.cx, this.cy, 60);
    if (this.onGround) this.vx += this.face * 40;
  }

  snipe() {
    const W = this.W, T = W.terrain;
    this.fireCd = 0.6;
    const m = this.muzzle();
    const hitSet = new Set(), ev = ++W.evSeq, slope = Math.tan(this.aimAssist(540)), reach = 560 * TUNE.rangeMul;
    let tiles = 0, endX = m.x + this.face * reach, endY = m.y + reach * slope;
    let lastCell = -1;
    outer:
    for (let d = 0; d < reach; d += 3) {
      const x = m.x + this.face * d, y = m.y + d * slope;
      const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
      if (T.solid(cx, cy) && cx !== lastCell) {
        lastCell = cx;
        const t = T.get(cx, cy);
        const destroyed = T.damage(cx, cy, 22, 'bullet');
        FX.debris(x, y, W.debrisColors(TDEF[t].debris), 4, 0.8); FX.sparks(x, y, 3, -this.face);
        tiles++;
        if (!destroyed || tiles >= 3) { endX = x; endY = y; break; }
      }
      for (const e of W.enemies) {
        if (e.dead || !e.hittable || hitSet.has(e)) continue;
        if (x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h) {
          if (e.blocksFrom && e.blocksFrom(this.face, y)) { e.breakShield(); FX.sparks(x, y, 6, -this.face); endX = x; endY = y; break outer; }
          hitSet.add(e);
          e.hurt(6, { kind: 'bullet', dirX: this.face, force: 240, team: 'p', ev, freezeMul: 1.8 });
          FX.blood(x, y, this.face, 8, 1.3);
          if (hitSet.size >= 5) { endX = x; endY = y; break outer; }
        }
      }
      for (const o of W.props) {
        if (!o.hittable || o.dead || hitSet.has(o)) continue;
        if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) { hitSet.add(o); o.hurt(5, { kind: 'bullet', dirX: this.face, team: 'p' }); }
      }
    }
    FX.addEffect({ type: 'beam', x: m.x, y: m.y, x1: endX, y1: endY, w: 2, dur: 0.14, color: '#ffffff', color2: '#ffd23a' });
    if (T.solidAt(endX, endY)) T.addDecal(endX, endY, '#1e1612', 2); // where the round stopped
    FX.muzzle(m.x, m.y, this.face, 6);
    FX.shell(this.cx, m.y, this.face, 'heavy');
    Sound.play('sniper'); W.shake(2); W.kick(-this.face * 3); W.noise(this.cx, this.cy, 200); this.recoil = 0.15;
  }

  tesla() {
    const W = this.W, T = W.terrain;
    this.fireCd = 0.3;
    const m = this.muzzle();
    let best = null, bd = 1e9;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable) continue;
      const dx = (e.cx - m.x) * this.face;
      if (dx < -6 || dx > 220 * TUNE.rangeMul) continue;
      const dy = Math.abs(e.cy - m.y);
      if (dy > 60) continue;
      const d = dx + dy * 1.6;
      if (d < bd && T.los(m.x, m.y, e.cx, e.cy)) { bd = d; best = e; }
    }
    if (best) {
      const chain = [], ev = ++W.evSeq;
      let from = [m.x, m.y], cur = best;
      while (cur && chain.length < 4) {
        chain.push(cur);
        W.bolt(from[0], from[1], cur.cx, cur.cy);
        cur.hurt(2, { kind: 'shock', dirX: this.face, force: 50, team: 'p', ev });
        FX.sparks(cur.cx, cur.cy, 4);
        from = [cur.cx, cur.cy];
        let next = null, nd = 110 * TUNE.rangeMul;
        for (const e of W.enemies) {
          if (e.dead || !e.hittable || chain.includes(e)) continue;
          const d = dist(from[0], from[1], e.cx, e.cy);
          if (d < nd && T.los(from[0], from[1], e.cx, e.cy)) { nd = d; next = e; }
        }
        cur = next;
      }
    } else {
      const bare = 110 * TUNE.rangeMul;
      let ex = m.x + this.face * bare;
      for (let d = 0; d <= bare; d += 4) {
        const x = m.x + this.face * d;
        if (T.solidAt(x, m.y)) { T.damage(Math.floor(x / TILE), Math.floor(m.y / TILE), 7, 'bullet'); ex = x; FX.sparks(x, m.y, 4, -this.face); break; }
      }
      W.bolt(m.x, m.y, ex, m.y + rand(-6, 6));
      for (const o of W.props) if (o.hittable && !o.dead && rectsOverlap(Math.min(m.x, ex), m.y - 6, Math.abs(ex - m.x), 12, o.x, o.y, o.w, o.h)) o.hurt(3, { kind: 'bullet', team: 'p' });
    }
    Sound.play('zap'); W.noise(this.cx, this.cy, 120);
  }

  // ------------------------------------------------------------ specials
  usePocket() {
    const W = this.W, it = this.pocket;
    this.pocket = null;
    switch (it) {
      case 'airstrike':
        this.throwProj({ kind: 'flare', sprite: Sprites.props.flare, fuse: 0.9, bounce: 0.3, radius: 0 }, 170, -190);
        break;
      case 'timewarp': W.timeWarp(6); this.castT = 0.45; break;
      case 'swarm': this.missileSwarm(); break;
      case 'roid':
        this.roid = 8; this.castT = 0.5;
        W.scare(this.cx, this.cy, 180, 2); W.shake(4);
        Sound.play('stomp');
        break;
    }
  }

  doSpecial() {
    const W = this.W;
    if (this.pocket) { Playtest.use('pocket', this); this.usePocket(); return; }
    if (this.specials <= 0) { Playtest.use('special:empty', this); Sound.play('nope'); return; }
    const P = Sprites.props;
    this.specials--;
    Playtest.use('special', this);
    switch (this.hero.id) {
      case 'havoc': this.throwProj({ kind: 'grenade', sprite: P.grenade, fuse: 1.3, radius: 42, explodeDmg: 10, explodeTile: 42, bounce: 0.45 }, 205, -210); break;
      case 'buck': this.throwProj({ kind: 'dynamite', sprite: P.dynamite, fuse: 1.7, radius: 56, explodeDmg: 14, explodeTile: 65, bounce: 0.3 }, 185, -225); break;
      case 'scorch': this.throwProj({ kind: 'firebomb', sprite: P.firebomb, radius: 1, life: 4 }, 185, -200); break;
      case 'boomer': this.throwProj({ kind: 'flare', sprite: P.flare, fuse: 0.9, bounce: 0.3, radius: 0 }, 170, -190); break;
      case 'ronin':
        this.state = 'dash'; this.dashT = 0.2; this.vx = this.face * 530; this.vy = 0; this.dashHit = new Set(); this.dashEv = ++W.evSeq;
        Sound.play('slash'); Sound.play('throw');
        break;
      case 'brutus':
        this.state = 'stomp';
        if (this.onGround) { this.stompPhase = 0; this.vy = -280; } else { this.stompPhase = 1; }
        Sound.play('jump');
        break;
      case 'deadeye':
        this.state = 'charge'; this.charge = 0.35; this.vx = 0;
        Sound.play('railgun');
        break;
      case 'volt': W.thunderstorm(this); this.castT = 0.45; break;
      case 'chrono': W.timeWarp(5); this.castT = 0.45; break;
      case 'skyhawk': this.missileSwarm(); break;
      case 'ricochet':
        const dev = ++W.evSeq;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          W.projectiles.push(new Projectile({ x: this.cx, y: this.cy - 2, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, team: 'p', kind: 'disc', storm: true, dmg: 4, tileDmg: 6, life: 1.6, pierce: 99, bounce: 1, ev: dev }));
        }
        Sound.play('slash'); Sound.play('throw'); W.shake(2); this.throwT = 0.25;
        break;
      case 'phantom':
        W.decoys.push(new Decoy(W, this));
        this.cloak = 3.2; this.inv = Math.max(this.inv, 0.4);
        FX.smokePuff(this.cx, this.cy, 1.2); FX.smokePuff(this.cx - 6, this.cy + 3, 1); FX.smokePuff(this.cx + 6, this.cy + 2, 1);
        Sound.play('throw');
        break;
    }
  }

  throwProj(o, vxBase, vyBase) {
    const down = !!(this.inp && this.inp.down('down'));
    const vx = down ? this.face * 50 : this.face * vxBase + this.vx * 0.4;
    const vy = down ? -60 : vyBase;
    this.W.projectiles.push(new Projectile(Object.assign({
      x: this.cx + this.face * 6, y: this.y + 4, vx, vy, grav: 750, team: 'p', life: 6, tileDmg: 0, dmg: 0,
    }, o)));
    this.throwT = 0.25;
    Sound.play('throw');
  }

  updateDash(dt) {
    const W = this.W;
    this.dashT -= dt;
    this.inv = Math.max(this.inv, 0.12);
    this.vy = 0;
    const px = this.x;
    moveBody(this, W.terrain, dt);
    if (((this.dashT * 60) | 0) % 2 === 0) FX.ghost(this.gfx.slash[1], this.cx, this.y + this.h, this.face); // after-images
    const x0 = Math.min(px, this.x) - 4, x1 = Math.max(px, this.x) + this.w + 4;
    for (const e of W.enemies) {
      if (e.dead || !e.hittable || this.dashHit.has(e)) continue;
      if (rectsOverlap(x0, this.y - 4, x1 - x0, this.h + 8, e.x, e.y, e.w, e.h)) {
        this.dashHit.add(e);
        e.hurt(12, { kind: 'melee', dirX: this.face, force: 220, team: 'p', ev: this.dashEv });
        FX.blood(e.x + e.w / 2, e.y + 6, this.face, 10, 1.4);
        FX.addEffect({ type: 'slash', x: e.x + e.w / 2, y: e.y + e.h / 2, face: this.face, r: 12, dur: 0.12 });
      }
    }
    for (const o of W.props) if (o.hittable && !o.dead && rectsOverlap(x0, this.y - 4, x1 - x0, this.h + 8, o.x, o.y, o.w, o.h)) o.hurt(3, { kind: 'melee', dirX: this.face, team: 'p' });
    for (let i = 0; i < 3; i++) FX.spawn(this.cx + rand(-6, 6), this.y + rand(0, this.h), -this.face * rand(10, 40), rand(-10, 10), 0.3, 2, '#3a3a6a', PF.SHRINK);
    if (this.dashT <= 0 || this.hitWall) { this.state = 'normal'; this.vx *= 0.3; }
  }

  updateStomp(dt) {
    const W = this.W;
    this.inv = Math.max(this.inv, 0.1);
    if (this.stompPhase === 0) {
      this.vy += GRAVITY * dt;
      this.vx *= 0.9;
      if (this.vy > -40) this.stompPhase = 1;
    } else {
      this.vy = 560; this.vx = 0;
      FX.spawn(this.cx + rand(-4, 4), this.y, rand(-10, 10), -40, 0.25, 3, '#fff', PF.CIRCLE | PF.SHRINK, 6);
    }
    moveBody(this, W.terrain, dt);
    if (this.stompPhase === 1 && this.onGround) {
      W.explode(this.cx, this.y + this.h, 52, { owner: 'p', dmg: 12, tileDmg: 28 });
      FX.addEffect({ type: 'ring', x: this.cx, y: this.y + this.h, r: 80, dur: 0.35 });
      FX.dust(this.cx, this.y + this.h, 12);
      W.shake(8); Sound.play('stomp');
      this.state = 'normal'; this.vy = -120; this.inv = 0.3;
    }
  }

  updateCharge(dt) {
    const W = this.W;
    this.charge -= dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 440);
    this.vx = approach(this.vx, 0, 1500 * dt);
    moveBody(this, W.terrain, dt);
    const m = this.muzzle();
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(10, 18);
      FX.spawn(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, -Math.cos(a) * r * 5, -Math.sin(a) * r * 5, 0.2, 1, '#fff', 0, 4);
    }
    if (this.charge <= 0) { this.fireRail(); this.state = 'normal'; }
  }

  fireRail() {
    const W = this.W, T = W.terrain;
    const m = this.muzzle();
    const len = Gfx.W + 60;
    const y0 = m.y - 7, y1 = m.y + 7;
    for (let d = 0; d < len; d += 8) {
      const x = m.x + this.face * d;
      for (let py = y0; py <= y1; py += 7) T.damage(Math.floor(x / TILE), Math.floor(py / TILE), 400, 'explosion');
      if (d % 32 === 0) FX.debris(x, m.y, ['#fff', '#8fe4ff', '#ffd23a'], 1, 0.6);
    }
    const bx0 = Math.min(m.x, m.x + this.face * len), bw = len, ev = ++W.evSeq;
    for (const e of W.enemies) if (!e.dead && e.hittable && rectsOverlap(bx0, y0 - 2, bw, y1 - y0 + 4, e.x, e.y, e.w, e.h)) e.hurt(25, { kind: 'rail', dirX: this.face, force: 300, team: 'p', ev });
    for (const o of W.props) if (o.hittable && !o.dead && rectsOverlap(bx0, y0 - 2, bw, y1 - y0 + 4, o.x, o.y, o.w, o.h)) o.hurt(10, { kind: 'explosion', dirX: this.face, force: 200, team: 'p' });
    FX.addEffect({ type: 'beam', x: m.x, y: m.y, x1: m.x + this.face * len, w: 14, dur: 0.4, color: '#ffffff', color2: '#8fe4ff' });
    W.shake(7); W.flashT = 0.08; W.noise(this.cx, this.cy, 300);
    for (let d = 0; d < len; d += 48) FX.light(m.x + this.face * d, m.y, 44, '#8fe4ff', 0.8, 0.45); // the rail lights up the whole line
    if (this.onGround) this.vx -= this.face * 120;
  }

  // Every hit on a hero goes through here (returns true when the hit landed).
  kill(cause, info) {
    info = info || {};
    // the title's demo hero can't be hurt (src/attract.js)
    if (this.W.demo) return false;
    if (this.dead || this.inv > 0 || this.roid > 0 || this.state === 'dash' || this.state === 'extract') return false;
    if (this.mech) return this.mechDamage(cause, info);
    if (cause === 'fire' && this.hero.fireproof) return false;
    this.hp -= info.dmg != null ? info.dmg : (HIT_DMG[cause] || 99);
    if (this.hp > 0) { this.onHurt(cause, info); return true; }
    this.hp = 0;
    this.dead = true;
    this.W.onPlayerDeath(this, cause, info);
    return true;
  }
  // survived a hit: knocked back, a moment of invulnerability, loud feedback
  onHurt(cause, info) {
    const dir = info.dirX || -this.face, kb = info.force ? Math.min(260, info.force * 0.6) : 150;
    this.wall = 0; // a hit knocks the hero off the wall
    this.inv = TUNE.hurtInv; this.hurtT = 0.3;
    this.vx = dir * kb; this.vy = Math.min(this.vy, -180); this.onGround = false;
    if (this.state === 'slide' || this.state === 'ladder' || this.state === 'charge') this.state = 'normal';
    this.W.onPlayerHurt(this, cause, info);
  }

  // The picture for this frame (1.32): a pose for every moment. None of them holds up the controls -
  // a pose shows only while the hero isn't doing anything that needs another one
  animFrame() {
    const g = this.gfx, W = this.W;
    if (!TUNE.charAnim) return this.animFrameOld();
    const P = (n) => g.pose(n);
    if (this.state === 'extract') return W.evac && W.evac.state === 'leave' && W.evac.t > 0.35 ? g.wave[((this.animT * 4) | 0) % 2] : g.climb[((this.animT * 5) | 0) % 2]; // waving goodbye
    if (this.state === 'ladder') return g.climb[(Math.abs(this.vy) > 1 || Math.abs(this.vx) > 1 ? ((this.animT * 8) | 0) : 0) % 2];
    if (this.climbing && !this.firing) return g.climb[((this.animT * 10) | 0) % 2];
    if (this.state === 'dash') return g.slash[1];
    if (this.state === 'slide') return g.slide;
    if (this.state === 'charge') return P('kneel'); // the railgun charges on one knee
    if (this.state === 'stomp') return this.stompPhase === 0 ? P('hang') : g.fall; // fists up, then down he comes
    if (this.slashT > 0) return g.slash[this.slashT > 0.08 ? 0 : 1];
    if (this.stabT > 0) return P('stab');
    if (this.carry) return P('carry');
    if (this.throwT > 0) return this.throwT > 0.17 ? g.throw : P('throw2'); // the throw, then its follow-through
    if (this.castT > 0) return P('hang'); // a storm, a time warp: arms up
    if (this.hurtT > 0.06 && !this.firing) return P('hurt');
    if (this.wall) return this.face === this.wall ? g.jump : g.cling; // gun to the wall, or back to it
    if (!this.onGround) return this.vy < -55 ? g.jump : this.vy > 55 ? g.fall : P('apex');
    if (this.vx * this.face < -30) return P('skid'); // braking into a turn
    if (Math.abs(this.vx) > 12) return g.run[((this.stride || 0) * 4) | 0];
    if (this.landT > 0) return P(this.landPose || 'land');
    if (this.shotT > 0) return P('recoil');
    if (this.firing) return P('aim'); // on the trigger (a minigun spinning up)
    if (this.cheerT > 0) return P('cheer');
    const k = this.idleT - TUNE.idleFidget;
    if (TUNE.idleFidget > 0 && k > 0 && k % 5.2 < 1.1) return P(HERO_FIDGETS[((k / 5.2) | 0) % HERO_FIDGETS.length]);
    return g.idle[((this.animT * (this.hp === 1 && this.maxHp > 1 ? 3.2 : 1.4)) | 0) % 2]; // on his last hit point he breathes hard
  }
  // the 1.31 poses (TUNE.charAnim 0, for comparison)
  animFrameOld() {
    const g = this.gfx;
    if (this.state === 'extract') return g.climb[((this.animT * 5) | 0) % 2];
    if (this.state === 'ladder') return g.climb[(Math.abs(this.vy) > 1 || Math.abs(this.vx) > 1 ? ((this.animT * 8) | 0) : 0) % 2];
    if (this.climbing && !this.firing) return g.climb[((this.animT * 10) | 0) % 2];
    if (this.state === 'dash') return g.slash[1];
    if (this.state === 'slide') return g.slide;
    if (this.slashT > 0) return g.slash[this.slashT > 0.08 ? 0 : 1];
    if (this.throwT > 0 || this.carry) return g.throw;
    if (this.wall) return this.face === this.wall ? g.jump : g.cling;
    if (!this.onGround) return this.vy < 0 ? g.jump : g.fall;
    if (Math.abs(this.vx) > 12) return g.run[((this.animT * 12) | 0) % 4];
    return g.idle[((this.animT * 2) | 0) % 2];
  }

  draw(ctx, cx, cy) {
    if (this.dead) return;
    if (this.mech) { this.drawMech(ctx, cx, cy); return; }
    if (this.inv > 0 && this.state !== 'dash' && this.state !== 'stomp' && this.state !== 'extract' && ((this.inv * 16) | 0) % 2 === 0) return;
    const f = this.animFrame();
    const ox = this.recoil > 0 ? -this.face : 0;
    const fx = this.cx - cx + ox, fy = this.y + this.h - cy;
    const flash = (this.roid > 0 && ((this.animT * 12) | 0) % 3 === 0) || this.hurtT > 0.18;
    if (this.cloak > 0) ctx.globalAlpha = this.cloak < 0.6 && ((this.cloak * 20) | 0) % 2 ? 0.7 : 0.28;
    if (this.flipT > 0 && !this.onGround) {
      // a flip: one full turn around the middle of the body
      const a = (1 - this.flipT / (this.flipDur || 0.3)) * Math.PI * 2 * this.face;
      ctx.save(); ctx.translate(Math.round(fx), Math.round(fy - this.h / 2)); ctx.rotate(a);
      drawFrame(ctx, f, 0, this.h / 2, this.face, flash);
      ctx.restore();
    } else if (this.sqT > 0) {
      const k = (this.sqT / 0.12) * this.sqA;
      const sx = this.sqK > 0 ? 1 + 0.28 * k : 1 - 0.16 * k, sy = this.sqK > 0 ? 1 - 0.22 * k : 1 + 0.18 * k;
      ctx.save(); ctx.translate(Math.round(fx), Math.round(fy)); ctx.scale(sx, sy);
      drawFrame(ctx, f, 0, 0, this.face, flash);
      ctx.restore();
    } else drawFrame(ctx, f, fx, fy, this.face, flash);
    ctx.globalAlpha = 1;
    if ((this.hero.jetpack || this.W.mods.jetpack) && this.fuel < 0.98 && !this.onGround) {
      const bx = Math.round(this.cx - cx) - 6, by = Math.round(this.y - cy) - 7;
      ctx.fillStyle = '#15131c'; ctx.fillRect(bx - 1, by - 1, 14, 4);
      ctx.fillStyle = this.fuel > 0.3 ? '#ffd23a' : '#ff5a3a'; ctx.fillRect(bx, by, Math.max(0, Math.round(12 * this.fuel)), 2);
    }
    const m = this.muzzle();
    if (this.hero.id === 'scorch' && this.state === 'normal' && !this.climbing) {
      ctx.fillStyle = ((this.animT * 20) | 0) % 2 ? '#ffd23a' : '#ff8a2a';
      ctx.fillRect(Math.round(m.x - cx - this.face * 3), Math.round(m.y - cy), 1, 1);
    }
    if (this.state === 'charge') {
      const r = Math.round(2 + (0.35 - this.charge) * 14);
      ctx.drawImage(circleSprite('#8fe4ff', r), Math.round(m.x - cx - r), Math.round(m.y - cy - r));
      ctx.drawImage(circleSprite('#ffffff', Math.max(1, r - 2)), Math.round(m.x - cx - r + 2), Math.round(m.y - cy - r + 2));
    }
    if (this.hero.id === 'brutus' && this.spin > 0.05 && !this.climbing && this.state !== 'ladder') {
      if (((this.animT * 30) | 0) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(m.x - cx - this.face * 2), Math.round(m.y - cy - 1), 1, 3); }
    }
  }
}
