'use strict';
// ============================================================================
//  Camera (1.30). The view follows the hero on a critically damped spring, so
//  it eases in and out and never starts or stops with a jolt. It never whips
//  across the level either: after a death it travels to the drop zone, or dips
//  to black when that is far, and the boss arena glides into frame. Bumps of up
//  to a tile don't move it, a fall looks down to where the hero will land, a
//  boss is framed together with the hero. The hero keeps its place on the pixel
//  grid, a shake is a smooth tremor, recoil a soft push, and the world is drawn
//  between the last two 60 Hz steps, so it scrolls smoothly on any screen.
//  TUNE.camNew = 0 brings back the 1.29 camera (World.updateCameraOld) for A/B.
// ============================================================================

// one step of a critically damped spring (exact for any dt): o[k] with velocity o[kv] toward target
function camSpring(o, k, kv, target, w, dt) {
  const d = o[k] - target, e = Math.exp(-w * dt), tmp = (o[kv] + w * d) * dt;
  o[k] = target + (d + tmp) * e;
  o[kv] = (o[kv] - w * tmp) * e;
}
const CAM_TOP = 36;   // the hero's head stays this far under the top edge (the HUD tags live there)
const CAM_EDGE = 36;  // ... and its body this far from the sides
const CAM_LOW = 0.8;  // ... and its feet no lower than this share of the screen
const CAM_KICK = 28;  // recoil spring stiffness: a push peaks after 2 frames and is gone in ~0.15 s

const worldDrawScene = World.prototype.draw;

Object.assign(World.prototype, {
  updateCamera(dt) {
    if (!TUNE.camNew) return this.updateCameraOld(dt);
    const vw = Gfx.W, vh = Gfx.H, c = this.cam;
    if (c.vx == null) { c.vx = 0; c.vy = 0; }
    if (c.kvx == null) { c.kvx = 0; c.kvy = 0; }
    const alive = this.alivePlayers();
    let tx, ty, solo = null, falling = false;
    if (alive.length) {
      this.camGoal = null;
      let minX = Infinity, maxX = -Infinity, sy = 0;
      for (const p of alive) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w); sy += this.camGround(p); }
      const mid = (minX + maxX) / 2, lead = this.camLead(alive, dt);
      tx = mid + lead - vw / 2;
      if (alive.length > 1) tx = Math.min(Math.max(tx, maxX + 6 - vw), minX - 6); // keep both heroes in shot
      // the title's demo (src/attract.js) keeps its hero in the band between the logo and the menu
      const fr = this.camFrame;
      ty = sy / alive.length - (fr ? fr.feet : vh * 0.6);
      this.focus.x = mid; this.focus.y = sy / alive.length;
      if (alive.length === 1) {
        solo = alive[0];
        tx += this.camCue(solo, lead, dt);
        const f = this.camFall(solo);
        if (f != null && f > ty) { ty = f; falling = true; }
      }
    } else if (this.rail) {
      tx = this.rail.x; ty = this.railCamY(this.rail.x);
    } else if (this.state === 'complete' || (this.state === 'leaving' && this.finale)) {
      // the base blows up behind the departing chopper: a slow drift, then the shot holds
      if (this.state === 'leaving') { tx = this.finale.camX + this.completeT * 20; ty = this.finale.camY; } else { tx = c.x; ty = c.y; }
    } else if (this.players.some((p) => p.state === 'extract') && this.evac) {
      tx = this.evac.x - vw / 2; ty = this.evac.y + 70 - vh * 0.6;
    } else if (this.camGoal) {
      // a new hero is on the way: the view waits for the chopper at the drop zone
      tx = this.camGoal.x; ty = this.camGoal.y;
    } else {
      // a hero just went down: the shot holds as it was (the body, the words over it)
      tx = this.focus.x + (c.lead || 0) - vw / 2; ty = this.focus.y - vh * 0.6;
    }
    // the boss arena bounds the target, not the camera: the view glides in instead of cutting
    const worldX = Math.max(0, this.terrain.w * TILE - vw), maxY = Math.max(0, this.terrain.h * TILE - vh);
    let minX = 0, maxX = worldX;
    if (this.camLock) { minX = Math.max(minX, this.camLock.x0); maxX = Math.max(minX, Math.min(maxX, this.camLock.x1 - vw)); }
    tx = clamp(tx, minX, maxX); ty = clamp(ty, 0, maxY);

    const mv = this.camMove;
    if (this.camSnap) { this.camSnap = false; c.x = tx; c.y = ty; c.vx = 0; c.vy = 0; }
    else if (mv && mv.cut) {
      // a dip to black: hold still while the screen goes dark, then a cut (camSnap, next step)
      mv.t += dt;
      if (!mv.done) {
        c.vx = 0; c.vy = 0;
        if (mv.t >= mv.out) { mv.done = true; if (mv.fn) mv.fn(); this.camSnap = true; }
      } else this.camFollow(tx, ty, false, dt);
      if (mv.t >= mv.out + mv.hold + mv.in) this.camMove = null;
    } else if (mv) {
      // the respawn travel: one eased move, whatever the distance (a spring would whip over it)
      mv.t += dt;
      const k = Math.min(1, mv.t / mv.dur), s = k * k * (3 - 2 * k), ds = 6 * k * (1 - k) / mv.dur;
      c.x = mv.x0 + (tx - mv.x0) * s; c.y = mv.y0 + (ty - mv.y0) * s;
      c.vx = (tx - mv.x0) * ds; c.vy = (ty - mv.y0) * ds;
      if (k >= 1) this.camMove = null;
    } else this.camFollow(tx, ty, falling, dt);

    // the hero never leaves the safe frame, whatever the spring is doing (never out of the arena)
    if (solo && !mv) {
      const p = solo, feet = p.y + p.h;
      const loX = Math.max(p.x - CAM_EDGE, minX), hiX = Math.min(p.x + p.w + CAM_EDGE - vw, maxX);
      if (c.x > loX) { c.x = loX; c.vx = Math.min(c.vx, p.vx); } else if (c.x < hiX) { c.x = hiX; c.vx = Math.max(c.vx, p.vx); }
      const fr = this.camFrame, loY = p.y - (fr ? fr.top : CAM_TOP), hiY = feet - (fr ? fr.low : vh * CAM_LOW);
      if (c.y < hiY) { c.y = hiY; c.vy = Math.max(c.vy, p.vy); } else if (c.y > loY) { c.y = loY; c.vy = Math.min(c.vy, p.vy); }
    }
    if (c.x < 0 || c.x > worldX) { c.x = clamp(c.x, 0, worldX); c.vx = 0; }
    if (c.y < 0 || c.y > maxY) { c.y = clamp(c.y, 0, maxY); c.vy = 0; }

    // recoil: a soft push that springs back
    camSpring(c, 'kx', 'kvx', 0, CAM_KICK, dt); camSpring(c, 'ky', 'kvy', 0, CAM_KICK, dt);
    c.kx = clamp(c.kx, -6, 6); c.ky = clamp(c.ky, -6, 6);
    // a shake is a smooth tremor (two waves on each axis) dying away, not a new random spot every frame
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt * 16);
      c.shT = (c.shT || 0) + dt;
      const amp = TUNE.shakeMax * Math.pow(c.shake / 14, 1.4), t = c.shT * Math.PI * 2;
      c.sx = amp * (Math.sin(t * 11 + 1.3) * 0.6 + Math.sin(t * 17 + 4.1) * 0.4);
      c.sy = amp * 0.8 * (Math.sin(t * 13 + 2.7) * 0.6 + Math.sin(t * 19 + 0.5) * 0.4);
    } else { c.sx = 0; c.sy = 0; }

    for (const p of alive) {
      if (this.camLock) {
        if (p.x < this.camLock.x0) p.x = this.camLock.x0;
        if (p.x + p.w > this.camLock.x1) p.x = this.camLock.x1 - p.w;
      }
      // co-op: the screen edges are walls, nobody gets left behind
      if (alive.length > 1) {
        if (p.x < c.x + 2) { p.x = c.x + 2; if (p.vx < 0) p.vx = 0; }
        if (p.x + p.w > c.x + vw - 2) { p.x = c.x + vw - 2 - p.w; if (p.vx > 0) p.vx = 0; }
      }
    }
  },
  camFollow(tx, ty, falling, dt) {
    const c = this.cam;
    camSpring(c, 'x', 'vx', tx, 2 / TUNE.camLagX, dt);
    camSpring(c, 'y', 'vy', ty, 2 / (falling ? Math.min(TUNE.camLagY, 0.2) : TUNE.camLagY), dt);
    // the last fraction of a pixel: settle instead of creeping on for another half second
    if (Math.abs(c.x - tx) < 0.3 && Math.abs(c.vx) < 6) { c.x = tx; c.vx = 0; }
    if (Math.abs(c.y - ty) < 0.3 && Math.abs(c.vy) < 6) { c.y = ty; c.vy = 0; }
  },

  // The ground height the view keeps for a hero. Walking over bumps of up to camStep doesn't move
  // it; landing on another level does. In the air it holds (a jump doesn't bob the view; a fall is
  // camFall's) unless a blast or a jetpack carries the hero higher than camJump above it; on a wall,
  // a ladder, in the air on a jetpack or in a mech it follows beyond that slack either way
  camGround(p) {
    const feet = p.y + p.h, step = TUNE.camStep, band = TUNE.camJump;
    if (p.camY == null || band <= 0) p.camY = feet;
    else if (p.onGround && !p.wall && p.state !== 'ladder') { if (Math.abs(feet - p.camY) > step) p.camY = feet; }
    else if (p.wall || p.state === 'ladder' || p.jetting || p.mech) {
      if (feet > p.camY + step) p.camY = feet;
      else if (feet < p.camY - band) p.camY = feet + band;
    } else if (feet < p.camY - band) p.camY = feet + band;
    return p.camY;
  },
  // Falling to a lower level: frame the hero high on the screen (the way down in view) and wait for
  // it where it will land, so the view stops before the landing instead of after it. The hero's
  // speed is added ahead (the spring would trail a fast fall). Most drops start with a jump, so it
  // starts at the top of the arc - once the hero is over the drop: a hop at the edge of a pit, with
  // the ledge still under the hero, doesn't dip the view. null = not a drop
  camFall(p) {
    if (p.onGround || p.wall || p.state === 'ladder' || p.jetting || p.mech || p.vy < -60) return null;
    const feet = p.y + p.h, T = this.terrain;
    const land = this.camLanding(p), L = land == null ? feet + 400 : land;
    if (L <= p.camY + TUNE.camStep) return null; // it comes down about where it took off: a jump
    if (feet <= p.camY + 1) {
      const reach = p.camY + TUNE.camStep + 2 - feet;
      if (T.groundBelow(p.x + 1, feet, reach) != null || T.groundBelow(p.x + p.w - 1, feet, reach) != null) return null;
    }
    const vh = Gfx.H, top = 0.6 - 0.28 * TUNE.camFall;
    return Math.min(L - vh * 0.6, feet + Math.max(0, p.vy) * Math.min(TUNE.camLagY, 0.2) - vh * top);
  },
  // where a hero in the air will come down: its arc played ahead (up to 1.5 s), walls stop the drift
  camLanding(p) {
    const T = this.terrain, dt = 1 / 30, bottom = T.h * TILE;
    let x = p.x, y = p.y + p.h, vx = p.vx, vy = p.vy;
    for (let i = 0; i < 45; i++) {
      vy = Math.min(vy + GRAVITY * (vy > 0 ? TUNE.fallGrav : 1) * dt, TUNE.maxFall);
      const nx = x + vx * dt;
      if (vx && T.solidAt(vx > 0 ? nx + p.w : nx, y - p.h / 2)) vx = 0; else x = nx;
      const ny = y + vy * dt;
      if (vy > 0 && (T.standableAt(x + 1, ny) || T.standableAt(x + p.w - 1, ny))) return Math.floor(ny / TILE) * TILE;
      y = ny;
      if (y > bottom) return null;
    }
    return null;
  },
  // a boss (or a mini-boss that woke up) near the hero: frame both - the view slides toward the
  // point between them by camCue (1 = centred on it), fading in and out
  camCue(p, lead, dt) {
    const c = this.cam, vw = Gfx.W;
    let cue = null;
    for (const e of this.enemies) {
      if (!e.isBoss || e.dead || (e.isMini ? !e.awake : !this.bossActive)) continue;
      if (Math.abs(e.cx - p.cx) > vw * 1.1) continue;
      cue = e; break;
    }
    c.cueW = approach(c.cueW || 0, cue ? TUNE.camCue * (cue.isMini ? 0.6 : 1) : 0, dt * 1.2);
    if (cue) c.cueX = cue.cx;
    if (!c.cueW || c.cueX == null) return 0;
    return ((p.cx + c.cueX) / 2 - (p.cx + lead)) * c.cueW;
  },

  // A new hero is on the way to (x, groundY): the view goes there - eased if it's near, a dip to
  // black if it's more than camTravel screens away - and the chopper flies in from the edge of that
  // view once the camera is (almost) there. Returns the chopper's flight, or null (the 1.29
  // camera, or a partner still fighting: the view stays with him)
  camRespawn(x, groundY) {
    if (!TUNE.camNew || this.alivePlayers().length) return null;
    const c = this.cam, vw = Gfx.W, vh = Gfx.H;
    const lead = c.lead != null ? c.lead : Math.round(vw * TUNE.camLead / 100);
    let minX = 0, maxX = Math.max(0, this.terrain.w * TILE - vw);
    if (this.camLock) { minX = Math.max(minX, this.camLock.x0); maxX = Math.max(minX, Math.min(maxX, this.camLock.x1 - vw)); }
    const gx = clamp(x + lead - vw / 2, minX, maxX), gy = clamp(groundY - vh * 0.6, 0, Math.max(0, this.terrain.h * TILE - vh));
    this.camGoal = { x: gx, y: gy };
    const from = { x: gx - 60 };
    if (!this.camStarted) { c.x = gx; c.y = gy; c.vx = 0; c.vy = 0; return from; } // the mission starts here
    from.dur = 1;
    // already dark (a skipped fly-in): the pending cut lands here
    if (this.camMove && this.camMove.cut) { from.delay = 0.3; return from; }
    const d = Math.hypot(gx - c.x, gy - c.y);
    if (d < 2) { delete from.dur; return from; }
    if (d <= TUNE.camTravel * vw) {
      const dur = clamp(0.5 + d / 700, 0.5, 1.2); // one screen: ~1.2 s, at most ~600 px/s mid-way
      this.camMove = { x0: c.x, y0: c.y, t: 0, dur };
      from.delay = Math.max(0, dur - 0.6);
    } else {
      this.camCut(null);
      from.delay = 0.3;
    }
    return from;
  },
  // dip to black and cut; fn runs while the screen is dark
  camCut(fn) { this.camMove = { cut: true, t: 0, out: 0.22, hold: 0.1, in: 0.3, fn }; },
  drawCamFade(ctx, vw, vh) {
    const m = this.camMove;
    if (!m || !m.cut || !TUNE.camNew) return; // (switched to the old camera mid-dip in F2: no stuck black)
    const a = m.t < m.out ? m.t / m.out : m.t < m.out + m.hold ? 1 : 1 - (m.t - m.out - m.hold) / m.in;
    if (a <= 0) return;
    ctx.fillStyle = 'rgba(8,6,12,' + Math.min(1, a).toFixed(3) + ')';
    ctx.fillRect(0, 0, vw, vh);
  },
  // recoil as a push on the view's spring (the 1.29 camera jumped the whole offset at once)
  camKick(dx, dy) {
    const c = this.cam, v = CAM_KICK * Math.E; // this velocity peaks at an offset of dx
    c.kvx = (c.kvx || 0) + dx * v; c.kvy = (c.kvy || 0) + dy * v;
  },

  // The camera as drawn, in whole pixels, with the shake and the recoil. While the view travels with
  // the hero it is rounded on the hero's own pixel grid: the hero then keeps its place on the screen
  // instead of flickering a pixel back and forth; the door gunner's chopper likewise
  viewCam() {
    const c = this.cam;
    let x, y;
    if (!TUNE.camNew) { x = Math.round(c.x + c.sx + c.kx); y = Math.round(c.y + c.sy + c.ky); }
    else {
      x = Math.round(c.x); y = Math.round(c.y);
      const alive = this.alivePlayers(), p = alive.length === 1 ? alive[0] : null;
      if (p && Math.abs(c.vx) > 30 && Math.abs(c.vx - p.vx) < 25) x = Math.round(p.cx) - Math.round(p.cx - c.x);
      else if (this.rail) x = Math.round(this.rail.chX) - Math.round(this.rail.chX - c.x);
      x += Math.round(c.sx + c.kx); y += Math.round(c.sy + c.ky);
    }
    this.view = { x, y };
    return this.view;
  },

  // ---- drawing between the simulation steps
  // before each step: where everything is (drawing blends from there to where the step puts it)
  lerpSnap() {
    const g = this.lerpG = (this.lerpG || 0) + 1;
    this.stepTick = App.tick;
    const c = this.cam;
    c.lerpX = c.x; c.lerpY = c.y; c.lerpS = [c.sx, c.sy, c.kx, c.ky];
    const snap = (o) => { o.lerpX = o.x; o.lerpY = o.y; o.lerpG = g; };
    for (const list of [this.players, this.enemies, this.projectiles, this.corpses, this.falling, this.props, this.choppers, this.decoys]) for (const o of list) snap(o);
    for (const p of this.players) if (p.carry) snap(p.carry);
    if (this.evac) snap(this.evac);
    if (this.rail) { this.rail.lerpX = this.rail.chX; this.rail.lerpY = this.rail.chY; }
    for (const q of Atmos.parts) snap(q);
    FX.snap();
  },
  // draw a fraction App.alpha of the way from the last step's start to its end (on a paused game,
  // or with the 1.29 camera, the latest step as it is)
  lerpIn() {
    const a = TUNE.camNew && this.stepTick === App.tick ? App.alpha : 1;
    FX.lerpA = a;
    if (!(a < 1)) return null;
    const g = this.lerpG, out = this.lerpSaved || (this.lerpSaved = []);
    out.length = 0;
    const mix = (o) => {
      if (o.lerpG !== g || o.lerpOn) return;
      const dx = o.x - o.lerpX, dy = o.y - o.lerpY;
      if (Math.abs(dx) > 64 || Math.abs(dy) > 64) return; // a jump (a respawn, weather wrapping round): no smear
      o.lerpOn = true; out.push(o, o.x, o.y);
      o.x = o.lerpX + dx * a; o.y = o.lerpY + dy * a;
    };
    for (const list of [this.players, this.enemies, this.projectiles, this.corpses, this.falling, this.props, this.choppers, this.decoys]) for (const o of list) mix(o);
    for (const p of this.players) if (p.carry) mix(p.carry);
    if (this.evac) mix(this.evac);
    for (const q of Atmos.parts) mix(q);
    const c = this.cam, s = c.lerpS;
    this.lerpCam = null;
    if (s && Math.abs(c.x - c.lerpX) <= 64 && Math.abs(c.y - c.lerpY) <= 64) {
      this.lerpCam = [c.x, c.y, c.sx, c.sy, c.kx, c.ky];
      c.x = lerp(c.lerpX, c.x, a); c.y = lerp(c.lerpY, c.y, a);
      c.sx = lerp(s[0], c.sx, a); c.sy = lerp(s[1], c.sy, a); c.kx = lerp(s[2], c.kx, a); c.ky = lerp(s[3], c.ky, a);
    }
    const R = this.rail;
    this.lerpRail = null;
    if (R && R.lerpX != null) { this.lerpRail = [R.chX, R.chY]; R.chX = lerp(R.lerpX, R.chX, a); R.chY = lerp(R.lerpY, R.chY, a); }
    return out;
  },
  lerpOut(out) {
    FX.lerpA = 1;
    if (!out) return;
    for (let i = 0; i < out.length; i += 3) { const o = out[i]; o.x = out[i + 1]; o.y = out[i + 2]; o.lerpOn = false; }
    out.length = 0;
    const c = this.cam, L = this.lerpCam;
    if (L) { c.x = L[0]; c.y = L[1]; c.sx = L[2]; c.sy = L[3]; c.kx = L[4]; c.ky = L[5]; this.lerpCam = null; }
    if (this.lerpRail && this.rail) { this.rail.chX = this.lerpRail[0]; this.rail.chY = this.lerpRail[1]; }
    this.lerpRail = null;
  },
  draw(ctx) {
    const saved = this.lerpIn();
    try { worldDrawScene.call(this, ctx); } finally { this.lerpOut(saved); }
  },
});
