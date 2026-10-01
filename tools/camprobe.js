// Camera probe (dev only): a Human bot plays missions while every updateCamera() is recorded;
// reports snaps, velocity kicks, hero framing, falls, shake/kick, creep and hero flicker.
//   await CAMPROBE({ levels: [0,1,2,3,4,5], steps: 60 * 80, prof: 'casual' })   (at TT.logical(480, 270))
window.CAMPROBE = async function (opts = {}) {
  const levels = opts.levels || [0, 1, 2, 3, 4, 5];
  const steps = opts.steps || 60 * 80;
  const prof = opts.prof || 'casual';
  const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const backup = JSON.stringify(Save.data);
  const wasOn = Playtest.on; Playtest.on = false;
  const proto = World.prototype, orig = proto.updateCamera;
  let rec = null;
  proto.updateCamera = function (dt) {
    orig.call(this, dt);
    if (!rec || this !== window.world) return;
    const c = this.cam, p = this.player;
    rec.push({
      x: c.x, y: c.y, dx: this.viewCam().x, dy: this.view.y,
      bx: Math.round(c.x), by: Math.round(c.y),
      sh: Math.abs(Math.round(c.x + c.sx) - Math.round(c.x)) + Math.abs(Math.round(c.y + c.sy) - Math.round(c.y)),
      kk: Math.abs(Math.round(c.x + c.kx) - Math.round(c.x)) + Math.abs(Math.round(c.y + c.ky) - Math.round(c.y)),
      alive: !!(p && !p.dead), pcx: p ? p.cx : 0, feet: p ? p.y + p.h : 0, top: p ? p.y : 0, vx: p ? p.vx : 0, vy: p ? p.vy : 0,
      g: !!(p && p.onGround), wall: !!(p && p.wall), ps: p ? p.state : '', hs: this.hitstop > 0, lock: !!this.camLock, st: this.state,
      mech: !!(p && p.mech), dt,
    });
  };
  const W = Gfx.W, H = Gfx.H;
  const out = [];
  window.__cam = { done: 0, of: levels.length, out };
  try {
    for (const lv of levels) {
      Save.data = Object.assign(Save.defaults(), { unlocked: LEVELS.length, rescues: 20 });
      TT.start(lv);
      Human.reset(HUMAN_PROFILES[prof]);
      rec = [];
      let i = 0, end = 'timeout';
      for (; i < steps; i++) { Human.step(); const o = Bot.outcome(); if (o) { end = o; break; } if (i % 900 === 899) await yieldNow(); }
      Human.release();
      const s = rec; rec = null;
      const n = s.length;
      let snaps = [], vjumpX = 0, vjumpY = 0, vjEx = [], nearBottom = 0, offBottom = 0, nearTop = 0, nearSide = 0, aliveN = 0;
      let shake1 = 0, shake3 = 0, shakeMax = 0, kick1 = 0, crawl = 0, standN = 0, vertMoveGround = 0, groundN = 0;
      let stepChange = 0, stepsHist = {}, jitterFlips = 0, steadyN = 0;
      const falls = [];
      let air = null;
      for (let k = 1; k < n; k++) {
        const a = s[k - 1], b = s[k];
        const ddx = b.bx - a.bx, ddy = b.by - a.by;
        if ((Math.abs(ddx) > 8 || Math.abs(ddy) > 8) && k > 5) snaps.push({ k, t: +(k / 60).toFixed(1), ddx, ddy, ps: b.ps, st: b.st, lock: b.lock, alive: b.alive });
        if (k >= 2) {
          const z = s[k - 2];
          const v1x = a.x - z.x, v2x = b.x - a.x, v1y = a.y - z.y, v2y = b.y - a.y;
          if (Math.abs(v2x - v1x) > 1) { vjumpX++; if (vjEx.length < 12) vjEx.push({ t: +(k / 60).toFixed(2), ax: 'x', dv: +(v2x - v1x).toFixed(2), ps: b.ps, g: b.g, wall: b.wall, alive: b.alive, st: b.st }); }
          if (Math.abs(v2y - v1y) > 1) { vjumpY++; if (vjEx.length < 12) vjEx.push({ t: +(k / 60).toFixed(2), ax: 'y', dv: +(v2y - v1y).toFixed(2), ps: b.ps, g: b.g, wall: b.wall, alive: b.alive, st: b.st }); }
        }
        if (b.alive) {
          aliveN++;
          const fy = b.feet - b.y, ty = b.top - b.y, sx = b.pcx - b.x;
          if (fy > H - 24) nearBottom++;
          if (fy > H) offBottom++;
          if (ty < 16) nearTop++;
          if (sx < 48 || sx > W - 48) nearSide++;
          if (b.sh >= 1) shake1++;
          if (b.sh >= 3) shake3++;
          shakeMax = Math.max(shakeMax, b.sh);
          if (b.kk >= 1) kick1++;
          if (b.g && Math.abs(b.vx) < 1 && !b.hs) { standN++; if (Math.abs(ddx) === 1) crawl++; }
          if (b.g && !b.wall && b.ps !== 'ladder') { groundN++; if (ddy !== 0) vertMoveGround++; }
          if (b.g && Math.abs(b.vx) > 90 && Math.abs(b.x - a.x) > 1.2 && Math.abs(b.x - a.x) < 2.2 && !b.hs && b.sh === 0 && b.kk === 0) {
            steadyN++;
            stepsHist[Math.abs(ddx)] = (stepsHist[Math.abs(ddx)] || 0) + 1;
            if (k >= 2 && Math.abs(ddx) !== Math.abs(a.bx - s[k - 2].bx)) stepChange++;
            if (k >= 2) {
              const h0 = Math.round(s[k - 2].pcx) - s[k - 2].dx, h1 = Math.round(a.pcx) - a.dx, h2 = Math.round(b.pcx) - b.dx;
              if ((h1 - h0) * (h2 - h1) < 0) jitterFlips++;
            }
          }
        }
        if (b.alive && !b.g && !b.wall && b.ps !== 'ladder' && !b.mech) {
          if (!air) air = { k0: k, apex: b.feet, maxFy: 0 };
          air.apex = Math.min(air.apex, b.feet);
          air.maxFy = Math.max(air.maxFy, b.feet - b.y);
        } else if (air) {
          if (b.alive && (b.g || b.wall)) {
            const drop = b.feet - air.apex;
            if (drop > 80) {
              const kk0 = Math.max(air.k0, k - 18);
              const seen = b.feet - s[kk0].y <= H - 8;
              falls.push({ t: +(k / 60).toFixed(1), drop: Math.round(drop), maxFy: Math.round(air.maxFy), landSeen03: seen, landFy03: Math.round(b.feet - s[kk0].y) });
            }
          }
          air = null;
        }
      }
      const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : 0;
      out.push({
        lv: lv + 1, end, secs: +(n / 60).toFixed(1), W, H,
        snaps: snaps.length, snapEx: snaps.slice(0, 8),
        vJumpX_perMin: +(vjumpX / (n / 3600)).toFixed(1), vJumpY_perMin: +(vjumpY / (n / 3600)).toFixed(1), vjEx,
        heroNearBottomPct: pct(nearBottom, aliveN), heroOffBottomFrames: offBottom, heroNearTopPct: pct(nearTop, aliveN), heroNearSidePct: pct(nearSide, aliveN),
        shakeOnPct: pct(shake1, aliveN), shake3pxPct: pct(shake3, aliveN), shakeMax, kickOnPct: pct(kick1, aliveN),
        crawlFramesWhileStanding: crawl, standSecs: +(standN / 60).toFixed(1),
        vertMoveWhileGroundPct: pct(vertMoveGround, groundN),
        steadySecs: +(steadyN / 60).toFixed(1), stepsHist, stepChangePct: pct(stepChange, steadyN), heroScreenJitterFlipsPerSec: steadyN ? +(jitterFlips / (steadyN / 60)).toFixed(1) : 0,
        falls: falls.length, fallsLandingUnseen: falls.filter((f) => !f.landSeen03).length, fallEx: falls.slice(0, 6),
      });
      window.__cam.done++;
      await yieldNow();
    }
  } finally {
    proto.updateCamera = orig;
    Save.data = JSON.parse(backup); Save.save(); Playtest.on = wasOn;
  }
  window.__cam.finished = true;
  return out;
};

// Controlled camera scenarios (dev only) for the camera in TUNE.camNew: a stop after a run, a turn,
// falls into shafts dug into a flat test course, respawns from set distances and the boss arena.
//   CAMTEST()   (at TT.logical(480, 270); set TUNE.camNew = 0 / 1 to compare)
window.CAMTEST = function () {
  const backup = JSON.stringify(Save.data), wasOn = Playtest.on, H = Gfx.H;
  Playtest.on = false;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { Input.poll(); App.update(STEP); } };
  const clear = (w) => { w.enemies.length = 0; w.props = []; w.projectiles.length = 0; w.corpses.length = 0; w.falling.length = 0; w.doom = null; w.coach = null; };
  const start = (lv) => {
    Save.data = Object.assign(Save.defaults(), { unlocked: LEVELS.length, rescues: 20, favorite: 'havoc' });
    TT.start(lv);
    const w = window.world; clear(w);
    return w;
  };
  // a flat course: air above row `base`, rock below, from column a on
  const course = (w, a, base, shaftAt, depth, width = 10) => {
    const T = w.terrain;
    for (let cx = a; cx < a + 80 && cx < T.w; cx++) for (let cy = 0; cy < T.h - 1; cy++) T.set(cx, cy, cy < base ? 0 : 2); // 0 = empty, 2 = rock
    if (shaftAt != null) for (let cx = shaftAt; cx < shaftAt + width; cx++) for (let cy = base; cy < base + depth && cy < T.h - 1; cy++) T.set(cx, cy, 0);
  };
  const place = (w, x, feet) => { const p = w.player; p.x = x; p.y = feet - p.h; p.vx = 0; p.vy = 0; p.inv = 999; p.camY = null; p.wall = 0; w.cam.x = x - Gfx.W / 2; w.cam.y = feet - H * 0.6; if (w.cam.vx != null) { w.cam.vx = 0; w.cam.vy = 0; } return p; };
  const dvMax = (arr) => { let m = 0; for (let i = 2; i < arr.length; i++) m = Math.max(m, Math.abs((arr[i] - arr[i - 1]) - (arr[i - 1] - arr[i - 2]))); return +m.toFixed(2); };
  const out = { mode: TUNE.camNew ? 'new' : 'old' };
  try {
    // --- stop after a run, then a turn
    {
      const w = start(1), a = 20, base = 12;
      course(w, a, base, null, 0);
      const p = place(w, (a + 10) * TILE, base * TILE);
      step(90);
      Input.kb.right = true; step(100); Input.kb.right = false;
      const xs = [], rx = []; let stopAt = null;
      for (let i = 0; i < 150; i++) { step(); xs.push(w.cam.x); rx.push(w.viewCam().x); if (stopAt == null && Math.abs(p.vx) < 1) stopAt = i; }
      let last = 0, sparse = 0, idle = 0, moved = 0;
      for (let i = Math.max(1, stopAt); i < rx.length; i++) {
        const d = Math.abs(rx[i] - rx[i - 1]);
        if (d) { moved += d; last = i; if (d === 1 && idle >= 2) sparse++; idle = 0; } else idle++;
      }
      out.stop = { tailS: +((last - stopAt) / 60).toFixed(2), pxAfterStop: moved, sparse1pxSteps: sparse, maxDvPerFrame: dvMax(xs) };
      Input.kb.right = true; step(90); Input.kb.right = false; Input.kb.left = true;
      const tx = [];
      for (let i = 0; i < 150; i++) { step(); tx.push(w.cam.x); }
      Input.kb.left = false;
      out.turn = { maxDvPerFrame: dvMax(tx), maxSpeed: Math.round(Math.max(...tx.slice(1).map((x, i) => Math.abs(x - tx[i]) * 60))) };
    }
    // --- falls into shafts dug into the course (depth in tiles): walk off the edge; a running jump
    // into a wide shaft; a hop at the edge that lands back on it; a jump over a 3-tile gap
    out.falls = [];
    const cases = [];
    for (const depth of [3, 6, 10, 16]) cases.push({ depth, how: 'walk', width: 14 }, { depth, how: 'jump', width: 14 });
    cases.push({ depth: 10, how: 'hop', width: 14 }, { depth: 10, how: 'gap', width: 3 });
    for (const cs of cases) {
      const w = start(1), a = 20, base = 8, edge = a + 20;
      course(w, a, base, edge, cs.depth, cs.width);
      const p = place(w, (a + 13) * TILE, base * TILE);
      step(120);
      Input.kb.right = true;
      let jumped = false;
      if (cs.how === 'hop') {
        // walk up to the edge, stop, and jump straight up: it lands back on the ledge
        for (let i = 0; i < 240 && p.x + p.w < (edge - 0.3) * TILE; i++) step();
        Input.kb.right = false; step(40);
        Input.latch.jump = true; Input.kb.jump = true; step();
      } else for (let i = 0; i < 240 && p.onGround; i++) {
        if (cs.how !== 'walk' && !jumped && p.x + p.w > (edge - 0.6) * TILE) { jumped = true; Input.latch.jump = true; Input.kb.jump = true; }
        step();
      }
      if (cs.how === 'walk' || cs.how === 'hop') Input.kb.right = false;
      const rows = [];
      let landed = null;
      for (let k = 0; k < 400; k++) {
        if (k === 14) Input.kb.jump = false;
        if (cs.how === 'jump' && p.y + p.h > base * TILE + 4) Input.kb.right = false;
        step();
        rows.push({ feet: p.y + p.h, cy: w.cam.y, g: p.onGround || !!p.wall });
        if (landed == null && (p.onGround || p.wall) && k > 3) { landed = k; Input.kb.right = false; }
        if (landed != null && k > landed + 120) break;
      }
      Input.kb.jump = false; Input.kb.right = false;
      if (landed == null) { out.falls.push({ depth: cs.depth, how: cs.how, landed: false }); continue; }
      const landY = rows[landed].feet;
      const air = rows.slice(0, landed);
      const maxFeet = Math.max(...air.map((r) => (r.feet - r.cy) / H));
      const vis = (landY - rows[Math.max(0, landed - 18)].cy) / H;
      const after = rows.slice(landed), fin = after[after.length - 1].cy;
      let settle = null;
      for (let k = 0; k < after.length; k++) if (after.slice(k).every((r) => Math.abs(r.cy - fin) < 0.5)) { settle = +(k / 60).toFixed(2); break; }
      let low = -1e9, bounce = 0;
      for (const r of rows) { low = Math.max(low, r.cy); bounce = Math.max(bounce, low - r.cy); }
      out.falls.push({ depth: cs.depth, how: cs.how, dropPx: Math.round(landY - base * TILE), heroMaxPct: Math.round(maxFeet * 100), landAtMinus03Pct: Math.round(vis * 100), seen: vis * H <= H - 8, bouncePx: +bounce.toFixed(1), settleS: settle, maxDvPerFrame: dvMax(rows.map((r) => r.cy)) });
    }
    // --- respawn from set distances (the camera from the death to the new hero)
    out.respawn = [];
    for (const d of [150, 400, 800, 1500]) {
      const w = start(3), p = w.player;
      for (let i = 0; i < 900 && p.cx < 2000; i++) { Input.kb.right = true; if (p.onGround && p.touchingWall(1)) { Input.latch.jump = true; Input.kb.jump = true; } else Input.kb.jump = false; step(); }
      Input.kb.right = false; Input.kb.jump = false;
      const cx = Math.max(40, p.cx - d), gy = w.terrain.groundBelow(cx, 0, w.terrain.h * TILE);
      w.checkpoint = { x: cx, y: gy };
      step(30);
      p.inv = 0; p.roid = 0; p.kill('shot', { dmg: 99, src: 'grunt' });
      const xs = []; let alive = null, cut = false;
      for (let i = 0; i < 60 * 7; i++) {
        step(); xs.push(w.cam.x);
        if (i && Math.abs(xs[i] - xs[i - 1]) > 64) cut = true;
        if (alive == null && w.player && !w.player.dead && w.player !== p) alive = i;
        if (alive != null && i > alive + 30) break;
      }
      const sp = xs.slice(1).map((x, i) => Math.abs(x - xs[i]) * 60).filter((v) => v < 64 * 60);
      out.respawn.push({ distPx: Math.round(p.cx - cx), cut, peakPxPerS: Math.round(Math.max(...sp)), maxDvPerFrame: dvMax(xs.filter((x, i) => !i || Math.abs(x - xs[i - 1]) <= 64)), newHeroAfterS: alive == null ? null : +(alive / 60).toFixed(2) });
    }
    // --- the boss arena
    {
      const w = start(4), p = w.player, a = w.arena;
      p.x = a.x0 - 12 * TILE; p.y = a.g * TILE - p.h - 1; p.vx = 0; p.vy = 0; p.inv = 999; p.camY = null;
      step(120);
      const xs = []; let trig = null;
      for (let i = 0; i < 400; i++) { Input.kb.right = true; p.inv = 999; step(); xs.push(w.cam.x); if (w.bossActive && trig == null) trig = i; if (trig != null && i > trig + 120) break; }
      Input.kb.right = false;
      const seg = xs.slice(Math.max(0, trig - 2));
      const jumps = seg.slice(1).map((x, i) => Math.abs(x - seg[i]));
      let inAt = null; for (let i = 0; i < seg.length; i++) if (seg[i] >= a.x0 - 0.5) { inAt = i; break; }
      out.boss = { maxJumpPx: +Math.max(...jumps).toFixed(1), maxDvPerFrame: dvMax(seg), insideArenaAfterS: inAt == null ? null : +((inAt - 2) / 60).toFixed(2) };
    }
  } finally {
    Input.kb.right = false; Input.kb.left = false; Input.kb.jump = false;
    Save.data = JSON.parse(backup); Playtest.on = wasOn;
  }
  return out;
};
