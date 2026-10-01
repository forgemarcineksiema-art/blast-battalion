// Dev-only test harness (never shipped). Inject with:
//   const s = document.createElement('script'); s.src = '/tools/harness.js'; document.body.appendChild(s);
/* eslint-disable no-undef */
window.TT = {
  size(w = 854, h = 480) { Gfx.forceSize = { w, h }; Gfx.resize(); App.lastW = 0; },
  step(n) { for (let i = 0; i < n; i++) { Input.poll(); App.update(STEP); } App.draw(Gfx.ctx); },
  hold(btns, frames) { for (const b of btns) Input.kb[b] = true; this.step(frames); for (const b of btns) Input.kb[b] = false; this.step(1); },
  tap(b) { Input.latch[b] = true; Input.kb[b] = true; this.step(1); Input.kb[b] = false; this.step(1); },
  info() {
    const w = window.world;
    if (!w) return 'no world';
    const p = w.player;
    return JSON.stringify({
      st: w.state, p: p && { x: Math.round(p.x), y: Math.round(p.y), g: p.onGround, hero: p.hero.id, sp: p.specials, dead: p.dead, state: p.state },
      lives: w.lives, score: w.score, kills: w.kills, freed: w.rescued + '/' + w.prisonersTotal, enemies: w.enemies.length,
      cam: [Math.round(w.cam.x), Math.round(w.cam.y)], time: Math.round(w.time), tw: w.terrain.w,
    });
  },
  async shot(name, scale = 2) {
    App.draw(Gfx.ctx);
    const c = document.createElement('canvas'); c.width = Gfx.W * scale; c.height = Gfx.H * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(Gfx.canvas, 0, 0, c.width, c.height);
    if (typeof Hud !== 'undefined' && Hud.canvas) x.drawImage(Hud.canvas, 0, 0, c.width, c.height); // the HUD layer on top
    const r = await fetch('/__shot?name=' + name, { method: 'POST', body: c.toDataURL('image/png') });
    return await r.text();
  },
  start(level) {
    for (let i = 0; i < 120 && App.pending; i++) this.step(1);
    App.go(PlayScene, level); this.step(30); this.step(150); return this.info();
  },
  god(on = true) { const w = window.world; if (w && w.player) w.player.inv = on ? 9999 : 0; },
  // force an exact logical resolution (whatever the device pixel ratio is)
  // (k: force the device scale, e.g. 3 for the HUD layer at the size players see it)
  logical(w, h, k0) {
    const dpr = window.devicePixelRatio || 1;
    for (const k of k0 ? [k0] : [1, 2, 3, 4, 5]) {
      Gfx.forceSize = { w: (w * k + 0.5) / dpr, h: (h * k + 0.5) / dpr };
      Gfx.resize();
      if (Gfx.H === h) break;
    }
    App.lastW = 0;
    return [Gfx.W, Gfx.H];
  },
  unforce() { Gfx.forceSize = null; Gfx.resize(); App.lastW = 0; },
  // any view size, even one the game itself would letterbox (portrait videos): no rescaling logic
  raw(w, h) { Gfx.W = w; Gfx.H = h; Gfx.canvas.width = w; Gfx.canvas.height = h; Gfx.ctx.imageSmoothingEnabled = false; App.lastW = 0; return [w, h]; },
  go(scene, arg, frames = 40) { App.go(scene, arg); this.step(frames); },
  // screenshot every menu / overlay at the current size: layout QA for small and odd screens
  async screens(tag) {
    const out = [];
    const snap = async (n) => { out.push(n); await this.shot(tag + '_' + n, 2); };
    this.go(TitleScene, undefined, 60); await snap('title');
    this.go(OptionsScene); await snap('options');
    OptionsPanel.mode = 'controls'; OptionsPanel.layout(); this.step(2); await snap('controls');
    OptionsPanel.mode = 'options';
    this.go(LevelSelectScene); await snap('levels');
    this.go(HeroesScene); await snap('heroes');
    this.go(WardrobeScene); await snap('wardrobe');
    this.start(4); this.step(30); await snap('play');
    PlayScene.pause(); this.step(3); await snap('pause');
    PlayScene.overlay = OptionsOverlay; OptionsOverlay.open(); this.step(3); await snap('optov');
    PlayScene.overlay = CompleteOverlay; CompleteOverlay.open(world); this.step(150); await snap('complete');
    PlayScene.overlay = GameOverOverlay; GameOverOverlay.open(world); this.step(90); await snap('gameover');
    this.go(VictoryScene, undefined, 90); await snap('victory');
    this.go(TitleScene);
    return out;
  },
};

// Simple bot: walks right, shoots enemies ahead, jumps/climbs obstacles.
// a global property (not const) so the harness can be injected again after edits
window.Bot = {
  reset() { this.stuck = 0; this.lastX = 0; this.unstuck = 0; this.letGo = 0; this.wallT = 0; this.wallY = null; this.digT = 0; },
  // one simulation step driven by the bot
  step(i, opts) {
    const w = window.world;
    const p = w.player;
    Input.kb.right = true; Input.kb.left = false;
    if (w.state === 'rail') { Input.kb.jump = true; Input.kb.fire = true; Input.poll(); App.update(STEP); return; } // skip the fly-in
    let fire = false;
    if (p && !p.dead) {
      if (opts.god) p.inv = Math.max(p.inv, 1);
      fire = w.enemies.some((e) => !e.dead && (e.cx - p.cx) > -4 && (e.cx - p.cx) < 190 && Math.abs(e.cy - p.cy) < 24) ||
        w.props.some((o) => o.isDepot && !o.dead && (o.cx - p.cx) > -4 && (o.cx - p.cx) < 190 && Math.abs(o.y + o.h / 2 - p.cy) < 24);
      if (this.digT > 0) { this.digT--; fire = true; } // let go of a wall under a ceiling: shoot through it from the ground
      else if (p.onGround && p.touchingWall(1)) { Input.latch.jump = true; Input.kb.jump = true; }
      else if (p.vy > 60) Input.kb.jump = false;
      // on a wall: climb it; stuck there under a ceiling - let go (like a person would) and dig on foot
      if (p.wall) {
        if (Math.abs(p.y - (this.wallY ?? -1e9)) > 0.5) this.wallT = 0; else this.wallT = (this.wallT || 0) + 1;
        this.wallY = p.y;
      } else this.wallT = 0;
      this.letGo = p.wall && this.wallT >= 40 ? 24 : Math.max(0, (this.letGo || 0) - 1);
      if (this.letGo === 24) this.digT = 124;
      Input.kb.up = (!!p.wall && !this.letGo) || p.state === 'ladder'; // on a ladder (UP on a wall may take one): up and off the top
      if (Math.abs(p.x - this.lastX) < 0.05) this.stuck++; else this.stuck = 0;
      this.lastX = p.x;
      if (this.stuck > 70) { this.unstuck = 45; this.stuck = 0; if (Math.random() < 0.3) Input.latch.special = true; }
      if (this.unstuck > 0) { this.unstuck--; Input.kb.right = false; fire = true; }
      if (w.bossActive) {
        // boss fight: turn to the boss (it may be behind) and keep shooting
        fire = true;
        const b = w.enemies.find((e) => e.isBoss && !e.dead);
        if (b) { const dx = b.cx - p.cx; Input.kb.right = dx > 0; Input.kb.left = dx < 0; }
      }
      // extraction: walk to the chopper and jump onto its ladder
      const ev = w.evac;
      if (ev && !ev.dead && ev.state === 'hover' && ev.ladder > 20) {
        const dx = ev.x - p.cx;
        Input.kb.right = dx > 3; Input.kb.left = dx < -3;
        if (Math.abs(dx) < 12 && p.onGround) { Input.latch.jump = true; Input.kb.jump = true; }
      }
      // a mini-boss right ahead: over it (and shoot the soft top or its back on the way)
      if (w.enemies.some((e) => e.isMini && !e.dead && e.awake && (e.cx - p.cx) > -8 && (e.cx - p.cx) < e.w / 2 + 44 && Math.abs(e.cy - p.cy) < 30) && p.onGround) { Input.latch.jump = true; Input.kb.jump = true; fire = true; }
    }
    if (this.letGo) { Input.kb.right = false; Input.kb.left = true; fire = false; } // push away from the wall (without shooting) to let go
    Input.kb.fire = fire;
    if (opts.special && i % 150 === 75) Input.latch.special = true;
    Input.poll(); App.update(STEP);
  },
  release() { Input.kb.right = false; Input.kb.left = false; Input.kb.fire = false; Input.kb.jump = false; Input.kb.up = false; },
  // null while the mission runs, otherwise how it ended
  outcome() {
    if (App.scene !== PlayScene || App.pending) return 'scene';
    if (PlayScene.overlay === CompleteOverlay) return 'complete';
    if (PlayScene.overlay === GameOverOverlay) return 'gameover';
    if (PlayScene.overlay) return 'paused';
    return null;
  },
};

window.AUTO = function (steps, opts = {}) {
  const log = [];
  let lastState = world.state, lastLives = world.lives, lastFreed = world.rescued;
  Bot.reset();
  for (let i = 0; i < steps; i++) {
    const w = window.world;
    Bot.step(i, opts);
    if (w.state !== lastState) { log.push(i + ':state=' + w.state); lastState = w.state; }
    if (w.lives !== lastLives) { log.push(i + ':lives=' + w.lives); lastLives = w.lives; }
    if (w.rescued !== lastFreed) { log.push(i + ':freed=' + w.rescued + '(' + (w.player && w.player.hero.id) + ')'); lastFreed = w.rescued; }
    if (App.scene !== PlayScene || App.pending) { log.push(i + ':scene change'); break; }
    if (PlayScene.overlay) { log.push(i + ':overlay ' + (PlayScene.overlay === CompleteOverlay ? 'complete' : PlayScene.overlay === GameOverOverlay ? 'gameover' : 'pause')); break; }
  }
  Bot.release();
  App.draw(Gfx.ctx);
  log.push('kills=' + world.kills);
  return log.join(' | ') + ' || ' + TT.info();
};

// Regression sweep: the god-mode bot plays every campaign mission (or opts.levels) and reports
// exceptions, NaN positions, runaway object counts and frame cost. Before a release:
//   await REGRESS()                         all 15 missions, 6000 steps (100 s of game time) each
//   await REGRESS({ levels: [3], steps: 3000 })
// Progress is kept in window.__regress, so a long run can be polled while it works.
window.REGRESS = async function (opts = {}) {
  const levels = opts.levels || LEVELS.map((_, i) => i);
  const steps = opts.steps || 6000;
  const botOpts = { god: opts.god !== false, special: opts.special !== false };
  const errors = [];
  const onErr = (e) => errors.push(String((e.error && e.error.stack) || e.message || e.reason || e).split('\n').slice(0, 2).join(' @ '));
  const origErr = console.error;
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr.apply(console, a); };
  const wasOn = Playtest.on;
  Playtest.on = false;
  const rows = [];
  window.__regress = { done: 0, of: levels.length, rows };
  const bad = (v) => !Number.isFinite(v);
  try {
    for (const lv of levels) {
      const e0 = errors.length;
      TT.start(lv);
      Bot.reset();
      const w = window.world;
      // timings are CPU-side and include the odd GC pause, so slow frames are counted rather than
      // judged by a single worst case: updSlow = updates over 8 ms, drawSlow = draws over 16 ms
      const r = { lv: lv + 1, name: LEVELS[lv].name, end: 'timeout', steps: 0, kills: 0, freed: '', progress: '',
        updAvg: 0, updSlow: 0, drawAvg: 0, drawSlow: 0, maxProj: 0, maxEnemies: 0, maxProps: 0, maxFx: 0, maxFuel: 0, nan: 0, errors: 0 };
      let updSum = 0, drawSum = 0, draws = 0;
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now();
        try { Bot.step(i, botOpts); } catch (e) { onErr({ error: e }); r.end = 'EXCEPTION'; break; }
        const dt = performance.now() - t0;
        updSum += dt; if (dt > 8) r.updSlow++; r.steps = i + 1;
        if (i % 2 === 0) {
          const t1 = performance.now();
          try { App.draw(Gfx.ctx); } catch (e) { onErr({ error: e }); r.end = 'EXCEPTION(draw)'; break; }
          const d = performance.now() - t1; drawSum += d; draws++; if (d > 16) r.drawSlow++;
        }
        if (i % 30 === 0) {
          const p = w.player;
          if (p && (bad(p.x) || bad(p.y) || bad(p.vx) || bad(p.vy))) r.nan++;
          for (const e of w.enemies) if (bad(e.x) || bad(e.y)) { r.nan++; break; }
          r.maxProj = Math.max(r.maxProj, w.projectiles.length);
          r.maxEnemies = Math.max(r.maxEnemies, w.enemies.length);
          r.maxProps = Math.max(r.maxProps, w.props.length);
          r.maxFx = Math.max(r.maxFx, FX.count);
          if (w.fuel && w.fuel.cells) r.maxFuel = Math.max(r.maxFuel, w.fuel.cells.size);
        }
        const out = Bot.outcome();
        if (out) { r.end = out; break; }
      }
      Bot.release();
      r.kills = w.kills; r.freed = w.rescued + '/' + w.prisonersTotal;
      r.progress = w.player ? Math.round(100 * w.player.cx / (w.terrain.w * 16)) + '%' : '-';
      r.updAvg = +(updSum / Math.max(1, r.steps)).toFixed(2);
      r.drawAvg = +(drawSum / Math.max(1, draws)).toFixed(2);
      r.errors = errors.length - e0;
      if (r.errors && r.end !== 'EXCEPTION') r.end += '+ERR';
      rows.push(r);
      window.__regress.done++;
      await new Promise((res) => setTimeout(res, 0)); // let the page breathe between missions
    }
  } finally {
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onErr);
    console.error = origErr;
    Playtest.on = wasOn;
  }
  window.__regress.errors = errors;
  const failed = rows.filter((r) => r.errors || r.nan || /EXCEPTION/.test(r.end));
  window.__regress.summary = (failed.length ? 'FAIL ' + failed.map((r) => 'M' + r.lv).join(',') : 'PASS') +
    ' — ' + rows.filter((r) => r.end === 'complete').length + '/' + rows.length + ' completed by the bot';
  console.table(rows);
  return { summary: window.__regress.summary, rows, errors };
};
// ---------------------------------------------------------------------------------------------
// Simulated first-time players: what will real people run into? Unlike Bot (god mode, instant
// answers) a Human needs time to notice a soldier before it shoots back, often stops to aim,
// hesitates now and then, jumps late, dodges only some shots and walks into some pits.
// The profiles are rough portal audiences: rookie = a kid on a phone, casual = the typical
// portal player, skilled = someone who plays platformers.
window.HUMAN_PROFILES = {
  // dodge: fast bullets; dodgeBig: slow, visible explosives (shells, grenades, rockets, mortars)
  rookie: { react: 0.6, stopToShoot: 0.6, hesitate: 0.25, jumpDelay: 0.4, dodge: 0.08, dodgeBig: 0.4, special: 0.25, overshoot: 0.3, pitSense: 0.6 },
  casual: { react: 0.4, stopToShoot: 0.4, hesitate: 0.12, jumpDelay: 0.25, dodge: 0.3, dodgeBig: 0.65, special: 0.5, overshoot: 0.2, pitSense: 0.85 },
  skilled: { react: 0.25, stopToShoot: 0.2, hesitate: 0.05, jumpDelay: 0.12, dodge: 0.6, dodgeBig: 0.85, special: 0.8, overshoot: 0.1, pitSense: 1 },
};
window.Human = {
  reset(prof) {
    this.P = prof; this.t = 0; this.seen = new WeakMap(); this.decided = new WeakMap(); this.fireT = 0;
    this.hesT = 0; this.wallT = 0; this.jumpT = 0; this.stuckT = 0; this.lastX = null; this.unstuck = 0;
    this.specT = 0; this.pitX = -1e9; this.aimT = 0; this.backT = 0; this.tries = 0; this.stuckX = null;
    this.climbT = 0; this.climbX = null; this.climbN = 0; this.ladderX = 0; this.onLadder = false;
    this.ignore = new WeakMap(); this.engaged = null; this.engT = 0; this.evadeT = 0; this.evadeDir = 1;
    this.strafeT = 0; this.strafeDir = 1;
  },
  // how a person sees the target: known for `react` seconds, roughly on the hero's level
  targets(w, p) {
    const out = [], now = this.t, P = this.P;
    const consider = (o, cx, cy, boss) => {
      if (!w.onScreen(cx, cy, -8)) { this.seen.delete(o); return; }
      if (!this.seen.has(o)) this.seen.set(o, now);
      const dx = cx - p.cx, dy = cy - p.cy;
      if (now - this.seen.get(o) < P.react) return;
      if ((this.ignore.get(o) || 0) > now) return; // gave up on this one for a moment
      if (boss || (Math.abs(dx) < 230 && Math.abs(dy) < 34 && this.sight(w.terrain, p.cx, p.cy - 2, cx, cy))) out.push({ o, dx, d: Math.abs(dx) });
    };
    for (const e of w.enemies) if (!e.dead) consider(e, e.cx, e.cy, e.isBoss && !e.isMini);
    for (const o of w.props) if (o.isDepot && !o.dead) consider(o, o.x + o.w / 2, o.y + o.h / 2, false);
    return out.sort((a, b) => a.d - b.d);
  },
  // people shoot at what they can see: rock, steel and walls block the view; a dirt bank on the
  // same level doesn't (bullets dig, and the signs say so)
  sight(ter, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8), flat = Math.abs(y1 - y0) < 12;
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const t = ter.get(Math.floor(x / TILE), Math.floor(y / TILE));
      if (TDEF[t].solid && !(flat && t === T.DIRT)) return false;
    }
    return true;
  },
  // the mission objective the on-screen pointer shows (colonel / nearest depot), if any is left
  objective(w, p) {
    if (w.goal === 'target' && !w.goalDone && w.target && !w.target.dead) return w.target;
    if (w.goal === 'depots' && !w.goalDone) {
      let best = null, bd = Infinity;
      for (const o of w.props) if (o.isDepot && !o.dead) { const d = Math.abs(o.x + o.w / 2 - p.cx); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    return null;
  },
  step() {
    const w = window.world, p = w.player, P = this.P, dt = STEP;
    this.t += dt;
    if (w.state === 'rail') { Input.kb.jump = true; Input.poll(); App.update(STEP); return; } // skip the fly-in
    let right = true, left = false, up = false, fire = false, jump = false, special = false;
    if (p && !p.dead) {
      // onward - or back to an objective the pointer shows behind
      const obj = this.objective(w, p);
      const heading = obj && obj.x + obj.w / 2 < p.cx - 40 ? -1 : 1;
      right = heading > 0; left = heading < 0;
      const tg = this.targets(w, p);
      const t0 = tg[0];
      // a fight that goes nowhere (point blank, a shield, cover): after a while people move on
      if (t0 && !(t0.o.isBoss && !t0.o.isMini)) {
        if (this.engaged !== t0.o) { this.engaged = t0.o; this.engT = 0; }
        if ((this.engT += dt) > 4) { this.ignore.set(t0.o, this.t + 3); this.engaged = null; jump = true; this.jumpT = 0.4; }
      }
      if (t0) {
        fire = true; this.fireT = P.overshoot;
        const want = t0.dx >= 0 ? 1 : -1;
        if (t0.o.isBoss && !t0.o.isMini && t0.o.cy < p.cy - 48) {
          // a boss out of reach up there: keep moving (a still target eats every rocket)
          if ((this.strafeT -= dt) <= 0) { this.strafeT = rand(0.6, 1.4); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
          right = this.strafeDir > 0; left = this.strafeDir < 0;
        } else if (t0.o.isBoss && !t0.o.isMini) {
          // a boss: stand and shoot (turning to face it), never walk into it
          right = p.face !== want && want > 0; left = p.face !== want && want < 0;
        } else {
          // a new target: stop to aim, or keep running and gunning
          if (!this.decided.has(t0.o)) { this.decided.set(t0.o, Math.random() < P.stopToShoot); this.aimT = 0; }
          // nobody stands still for long shooting at something that won't die: move on
          if (this.decided.get(t0.o) && (this.aimT += dt) > 2.5) this.decided.set(t0.o, false);
          const stop = this.decided.get(t0.o);
          if (t0.d < 14) { right = false; left = false; } // on top of it: just shoot
          else if (p.face !== want || !stop) { right = want > 0; left = want < 0; }
          else { right = false; left = false; }
        }
        if (tg.length >= 3 && this.specT <= 0 && p.specials > 0) {
          this.specT = 3;
          if (Math.random() < P.special) special = true;
        }
      } else {
        if (this.fireT > 0) { this.fireT -= dt; fire = true; }
        // people look around now and then
        if (this.hesT > 0) { this.hesT -= dt; right = false; left = false; }
        else if (Math.random() < P.hesitate * dt) this.hesT = rand(0.3, 0.9);
      }
      if (this.specT > 0) this.specT -= dt;
      const dir = left ? -1 : 1;
      // a wall ahead: jump, a little late, and hold it to climb
      if (p.onGround && (right || left) && p.touchingWall(dir)) {
        this.wallT += dt;
        if (this.wallT >= P.jumpDelay) { jump = true; this.jumpT = 0.5; this.wallT = 0; }
      } else this.wallT = 0;
      if (this.jumpT > 0 && !p.onGround && p.vy > 60) this.jumpT = 0; // falling again: let go
      // hanging on a wall: climb it (after a moment, like a person working it out)
      // (stuck there under a ceiling for a second: let go, as people do)
      if (p.wall) {
        this.wallHoldT = (this.wallHoldT || 0) + dt; if (this.wallHoldT > P.jumpDelay) up = true;
        if (Math.abs(p.y - (this.wallY ?? -1e9)) > 0.5) this.wallStillT = 0; else this.wallStillT = (this.wallStillT || 0) + dt;
        this.wallY = p.y;
        if (this.wallStillT > 1) { this.wallStillT = 0; this.letGoT = 0.45; this.letGoDir = -p.wall; }
      } else { this.wallHoldT = 0; this.wallStillT = 0; }
      // a pit ahead: most people see it coming, some walk in
      if (p.onGround && (right || left)) {
        const ax = p.cx + dir * 18;
        const gap = w.terrain.groundBelow(ax, p.y + p.h - 2, 90) === null;
        if (gap && Math.abs(ax - this.pitX) > 40) { this.pitX = ax; if (Math.random() < P.pitSense) { jump = true; this.jumpT = 0.4; } }
      }
      // explosives on the way in (seen for a reaction time): work out where they come down and
      // step out of the blast - some people do, some don't
      for (const q of w.projectiles) {
        if (q.dead || q.team === 'p' || !(q.radius > 0)) continue;
        if (!this.seen.has(q)) this.seen.set(q, this.t);
        if (this.decided.has(q) || this.t - this.seen.get(q) < P.react * 0.8) continue;
        let x = q.x, y = q.y, vx = q.vx, vy = q.vy;
        const g = q.grav || 0, floor = p.y + p.h;
        for (let k = 0; k < 120 && y < floor; k++) { vy += g / 30; x += vx / 30; y += vy / 30; }
        this.decided.set(q, true);
        if (Math.abs(x - p.cx) < q.radius + 10 && Math.random() < P.dodgeBig) {
          this.evadeDir = p.cx >= x ? 1 : -1; this.evadeT = 0.75;
          if (Math.abs(x - p.cx) < 12 && p.onGround) { jump = true; this.jumpT = 0.4; }
        }
      }
      if (this.evadeT > 0) { this.evadeT -= dt; right = this.evadeDir > 0; left = this.evadeDir < 0; }
      // shots on the way in: dodge some of them
      for (const q of w.projectiles) {
        if (q.dead || q.team === 'p' || q.radius > 0 || this.decided.has(q)) continue;
        const dx = p.cx - q.x, dy = p.cy - q.y;
        const closing = Math.sign(q.vx || 0) === Math.sign(dx) && Math.abs(q.vx) > 20;
        if (!closing || Math.abs(dy) > 16 || Math.abs(dx) / Math.abs(q.vx) > 0.35) continue;
        this.decided.set(q, true);
        if (p.onGround && Math.random() < P.dodge) { jump = true; this.jumpT = 0.35; }
      }
      // extraction: walk to the chopper and jump onto its ladder
      const ev = w.evac;
      if (ev && !ev.dead && ev.state === 'hover' && ev.ladder > 20) {
        const dx = ev.x - p.cx;
        right = dx > 3; left = dx < -3;
        if (Math.abs(dx) < 12 && p.onGround) { jump = true; this.jumpT = 0.4; }
      }
      // stuck (a dirt wall, a ledge, a tower): a ladder close by gets climbed; otherwise stand
      // and shoot at it like people do - bullets dig - and after a few tries back off for a run-up
      if (this.lastX != null && Math.abs(p.x - this.lastX) < 0.05 && (right || left)) this.stuckT += dt; else this.stuckT = 0;
      this.lastX = p.x;
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        const T0 = w.terrain;
        const lad = [0, -16, 16, -32, 32].find((d) => T0.ladderAt(p.cx + d, p.y + p.h - 3) || T0.ladderAt(p.cx + d, p.y + 3) || T0.ladderAt(p.cx + d, p.y - 8));
        if (lad !== undefined && !(this.climbX != null && Math.abs(this.climbX - p.cx) < 8 && this.climbN > 1)) {
          this.climbN = this.climbX != null && Math.abs(this.climbX - p.cx) < 8 ? (this.climbN || 0) + 1 : 1;
          this.climbX = p.cx; this.climbT = 4; this.ladderX = Math.floor((p.cx + lad) / TILE) * TILE + TILE / 2; this.onLadder = false;
        } else {
          this.tries = Math.abs(p.x - (this.stuckX ?? -1e9)) < 20 ? (this.tries || 0) + 1 : 1;
          this.stuckX = p.x;
          this.unstuck = 0.75; this.backT = this.tries >= 3 && this.tries % 2 === 1 ? 0.5 : 0;
          if (Math.random() < 0.3 && p.specials > 0) special = true;
        }
      }
      if (this.climbT > 0) {
        this.climbT -= dt;
        up = true; right = false; left = false; jump = false; this.jumpT = 0;
        if (p.state !== 'ladder' && !this.onLadder && Math.abs(this.ladderX - p.cx) > 3) { right = this.ladderX > p.cx; left = !right; }
        if (p.state === 'ladder') this.onLadder = true;
        else if (this.onLadder) { this.climbT = 0; up = false; right = true; } // off the top: on we go
      } else if (this.backT > 0) { this.backT -= dt; right = false; left = true; fire = false; }
      else if (this.unstuck > 0) { this.unstuck -= dt; right = false; left = false; fire = true; }
    }
    if (this.letGoT > 0) { this.letGoT -= dt; up = false; fire = false; right = this.letGoDir > 0; left = this.letGoDir < 0; } // push off the wall
    if (this.jumpT > 0) { this.jumpT -= dt; if (!Input.kb.jump) Input.latch.jump = true; Input.kb.jump = true; } else Input.kb.jump = false;
    if (jump && !Input.latch.jump) Input.latch.jump = true;
    Input.kb.right = right; Input.kb.left = left; Input.kb.up = up; Input.kb.fire = fire;
    if (special) Input.latch.special = true;
    Input.poll(); App.update(STEP);
  },
  release() { Input.kb.right = false; Input.kb.left = false; Input.kb.up = false; Input.kb.fire = false; Input.kb.jump = false; },
};

// Plays the campaign as fresh players of each profile: retries a failed mission (up to
// maxAttempts), spends cash on the cheapest upgrade like a newcomer would, and records time,
// deaths and what killed them. Returns per-mission rows; progress in window.__human.
//   await HUMANSIM({ profiles: ['rookie'], players: 1, levels: [0, 1, 2] })
window.HUMANSIM = async function (opts = {}) {
  const profiles = opts.profiles || ['rookie', 'casual', 'skilled'];
  const players = opts.players || 2, maxAttempts = opts.maxAttempts || 4;
  const levels = opts.levels || LEVELS.map((_, i) => i);
  const maxSteps = opts.maxSteps || 60 * 360;
  const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const backup = JSON.stringify(Save.data);
  const wasOn = Playtest.on; Playtest.on = false;
  const runs = [];
  window.__human = { done: 0, of: profiles.length * players * levels.length, runs };
  const buyCheapest = () => {
    for (;;) {
      const c = UPGRADES.filter((u) => Meta.canBuy(u.id)).sort((a, b) => Meta.cost(a.id) - Meta.cost(b.id))[0];
      if (!c) return; Meta.buy(c.id);
    }
  };
  const playOnce = async (lv, prof) => {
    TT.start(lv);
    const w = window.world;
    Human.reset(HUMAN_PROFILES[prof]);
    const deaths = [];
    const orig = w.onPlayerDeath;
    w.onPlayerDeath = function (p, cause, info) { deaths.push({ t: Math.round(Human.t), what: deathLabel(cause, info), x: Math.round(100 * p.cx / (w.terrain.w * 16)) }); return orig.call(this, p, cause, info); };
    let i = 0, end = 'timeout';
    for (; i < maxSteps; i++) {
      Human.step();
      const o = Bot.outcome();
      if (o) { end = o; break; }
      if (i % 900 === 899) await yieldNow();
    }
    Human.release();
    return { lv: lv + 1, prof, end, time: Math.round(i / 60 + 3), deaths: deaths.length, dAt: deaths.map((d) => d.t + 's@' + d.x + '%'),
      what: deaths.map((d) => d.what), freed: w.rescued + '/' + w.prisonersTotal, kills: w.kills, lives: w.lives,
      progress: w.player ? Math.round(100 * w.player.cx / (w.terrain.w * 16)) : null, cash: Meta.coins() };
  };
  try {
    for (const prof of profiles) {
      for (let k = 0; k < players; k++) {
        Save.data = Save.defaults();
        for (const lv of levels) {
          let cleared = false;
          for (let a = 1; a <= maxAttempts && !cleared; a++) {
            const r = await playOnce(lv, prof);
            r.player = prof + (k + 1); r.attempt = a; r.up = UPGRADES.map((u) => Meta.level(u.id)).join('');
            runs.push(r);
            cleared = r.end === 'complete';
            await yieldNow();
          }
          window.__human.done++;
          if (!cleared) { window.__human.done += levels.length - 1 - levels.indexOf(lv); break; } // stuck: this player gives up
          buyCheapest();
        }
      }
    }
  } finally {
    Save.data = JSON.parse(backup); Save.save(); Playtest.on = wasOn;
  }
  window.__human.finished = true;
  return runs;
};
// One mission, many attempts per profile, with a mid-campaign save (upgrades, heroes): compares
// a boss (or any wall) between builds without playing the whole campaign.
//   await HUMANBOSS({ level: 9, tries: 6 })
window.HUMANBOSS = async function (opts = {}) {
  const lv = opts.level != null ? opts.level : 9, tries = opts.tries || 6;
  const profiles = opts.profiles || ['rookie', 'casual', 'skilled'];
  const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const backup = JSON.stringify(Save.data);
  const wasOn = Playtest.on; Playtest.on = false;
  const out = [];
  window.__boss = { done: 0, of: profiles.length * tries, out };
  try {
    for (const prof of profiles) {
      for (let k = 0; k < tries; k++) {
        Save.data = Object.assign(Save.defaults(), { unlocked: LEVELS.length, rescues: 20, up: opts.up || { power: 2, special: 1, lives: 1 } });
        TT.start(lv);
        const w = window.world;
        Human.reset(HUMAN_PROFILES[prof]);
        const deaths = [];
        const orig = w.onPlayerDeath;
        w.onPlayerDeath = function (p, cause, info) { deaths.push(deathLabel(cause, info) + (window.__detKind ? ' [' + window.__detKind + ']' : '')); return orig.call(this, p, cause, info); };
        let i = 0, end = 'timeout', bossT = null, mWake = null, mDown = null;
        const mb = w.enemies.find((e) => e.isMini);
        for (; i < 60 * 300; i++) {
          Human.step();
          if (w.bossActive && bossT == null) bossT = i;
          if (mb && mb.awake && mWake == null) mWake = i;
          if (mb && mb.dead && mDown == null) mDown = i;
          const o = Bot.outcome();
          if (o) { end = o; break; }
          if (i % 900 === 899) await yieldNow();
        }
        Human.release();
        out.push({ prof, end, time: Math.round(i / 60), fight: bossT == null ? null : Math.round((i - bossT) / 60), deaths: deaths.length, what: deaths,
          mini: mb ? (mDown != null ? 'down ' + Math.round((mDown - mWake) / 60) + 's' : mWake != null ? 'alive' : 'unseen') : undefined });
        window.__boss.done++;
        await yieldNow();
      }
    }
  } finally {
    Save.data = JSON.parse(backup); Save.save(); Playtest.on = wasOn;
  }
  window.__boss.finished = true;
  return out;
};
// which projectile set off a blast (so a death can be put down to a rocket, a bomb, a shell...)
if (!Projectile.prototype.__detWrapped) {
  const det = Projectile.prototype.detonate;
  Projectile.prototype.detonate = function (W) { window.__detKind = this.kind; try { return det.call(this, W); } finally { window.__detKind = null; } };
  Projectile.prototype.__detWrapped = true;
}
window.__harness = true;
