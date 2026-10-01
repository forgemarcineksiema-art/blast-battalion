'use strict';
// ============================================================================
//  Atmosphere and light. Weather per zone - light shafts through the jungle
//  canopy with drifting pollen and falling leaves, sand streaming on the
//  desert wind, arctic snow in two depths with parallax - a soft vignette,
//  every glowing thing in the world gathered into lights each frame, and a
//  frame-time watchdog that drops to the lite effects on slow devices.
// ============================================================================

const Atmos = {
  theme: null, parts: [], rays: [], t: 0, lastCx: null, lastCy: null, wind: 0, gust: 0, gustT: 4,
  vig: null, vigW: 0, vigH: 0,

  reset(theme) {
    this.theme = theme; this.parts = []; this.rays = []; this.t = 0; this.lastCx = null; this.lastCy = null;
    this.wind = 0; this.gust = 0; this.gustT = 4; // a new mission starts calm (and replays the same)
    const W = Gfx.W, H = Gfx.H, lite = FX.quality < 2;
    const add = (n, fn) => { for (let i = 0; i < (lite ? n >> 1 : n); i++) this.parts.push(fn(i)); };
    if (theme === 'arctic') {
      add(46, () => ({ kind: 'snow', z: 0, x: rand(0, W), y: rand(0, H), v: rand(12, 22), s: 1, ph: rand(0, 6.28) }));
      add(26, () => ({ kind: 'snow', z: 1, x: rand(0, W), y: rand(0, H), v: rand(32, 52), s: 2, ph: rand(0, 6.28) }));
    } else if (theme === 'jungle') {
      add(30, (i) => ({ kind: 'pollen', z: i % 3 === 0 ? 1 : 0, x: rand(0, W), y: rand(0, H), v: rand(-6, 6), ph: rand(0, 6.28) }));
      add(6, () => ({ kind: 'leaf', z: 1, x: rand(0, W), y: rand(0, H), v: rand(16, 26), ph: rand(0, 6.28), c: pick(['#5aa83a', '#3e8a2a', '#8ab83a']) }));
      if (!lite) for (let i = 0; i < 3; i++) this.rays.push({ x: rand(0.1, 0.95), w: rand(18, 44), slant: rand(0.32, 0.55), a: rand(0.05, 0.08), ph: rand(0, 6.28) });
    } else if (theme === 'desert') {
      add(44, (i) => ({ kind: 'sand', z: i % 4 === 0 ? 1 : 0, x: rand(0, W), y: rand(0, H), v: rand(70, 140), ph: rand(0, 6.28), len: ((Math.random() * 3) | 0) + 2 }));
    }
  },

  update(dt, W) {
    this.t += dt;
    const cx = W.cam.x, cy = W.cam.y;
    let dx = this.lastCx == null ? 0 : cx - this.lastCx, dy = this.lastCy == null ? 0 : cy - this.lastCy;
    this.lastCx = cx; this.lastCy = cy;
    if (Math.abs(dx) > 120 || Math.abs(dy) > 120) { dx = 0; dy = 0; } // a jump cut (respawn): don't smear the weather
    // wind: a slow swell and every few seconds a gust
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = rand(5, 9); this.gust = 1; }
    this.gust = Math.max(0, this.gust - dt * 0.45);
    this.wind = Math.sin(this.t * 0.35) * 0.5 + this.gust * 1.4;
    const Wd = Gfx.W, Hd = Gfx.H;
    for (const p of this.parts) {
      const par = p.z ? 1.15 : 0.55; // near bits sweep past faster than the camera, far ones slower
      p.x -= dx * par; p.y -= dy * par;
      switch (p.kind) {
        case 'snow': p.y += p.v * dt; p.x += (Math.sin(this.t * 1.3 + p.ph) * (p.z ? 14 : 8) + this.wind * (p.z ? 40 : 24)) * dt; break;
        case 'pollen': p.y += (Math.sin(this.t * 0.7 + p.ph) * 5 + p.v) * dt; p.x += (Math.cos(this.t * 0.5 + p.ph) * 6 + this.wind * 6) * dt; break;
        case 'leaf': p.y += p.v * dt; p.x += (Math.sin(this.t * 2 + p.ph) * 18 + this.wind * 14) * dt; break;
        case 'sand': p.x -= p.v * (1 + this.gust * 1.2) * dt; p.y += Math.sin(this.t * 3 + p.ph) * 8 * dt; break;
      }
      if (p.x < -12) p.x += Wd + 24; else if (p.x > Wd + 12) p.x -= Wd + 24;
      if (p.y < -12) p.y += Hd + 24; else if (p.y > Hd + 12) p.y -= Hd + 24;
    }
  },

  // far weather sits behind the terrain, near weather and light shafts in front of the action
  drawBack(ctx) { this.drawParts(ctx, 0); },
  drawFront(ctx) { this.drawParts(ctx, 1); if (this.rays.length) this.drawRays(ctx); },
  drawParts(ctx, z) {
    for (const p of this.parts) {
      if (p.z !== z) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      switch (p.kind) {
        case 'snow': ctx.fillStyle = z ? '#ffffff' : 'rgba(238,244,255,0.75)'; ctx.fillRect(x, y, p.s, p.s); break;
        case 'pollen':
          ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(this.t * 2.2 + p.ph)); // twinkle
          ctx.fillStyle = z ? '#fff6c0' : '#e8ffb0'; ctx.fillRect(x, y, 1, 1);
          ctx.globalAlpha = 1;
          break;
        case 'leaf': {
          const flip = Math.sin(this.t * 3 + p.ph) > 0;
          ctx.fillStyle = p.c; ctx.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2);
          break;
        }
        case 'sand': ctx.fillStyle = z ? 'rgba(252,232,184,0.6)' : 'rgba(246,224,168,0.35)'; ctx.fillRect(x, y, p.len + (this.gust > 0.3 ? 2 : 0), 1); break;
      }
    }
  },
  // light shafts slanting down through the canopy, breathing slowly
  drawRays(ctx) {
    const W = Gfx.W, H = Gfx.H, span = W + 160;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#fff6d0';
    for (const r of this.rays) {
      const a = r.a * (0.65 + 0.35 * Math.sin(this.t * 0.4 + r.ph));
      const x0 = (((r.x * W - (this.lastCx || 0) * 0.08) % span) + span) % span - 40;
      const bottom = H * 0.92, x1 = x0 - bottom * r.slant;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + r.w, 0); ctx.lineTo(x1 + r.w * 1.7, bottom); ctx.lineTo(x1, bottom); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
  // soft dark corners that frame the action
  vignette(ctx) {
    const W = Gfx.W, H = Gfx.H;
    if (!this.vig || this.vigW !== W || this.vigH !== H) {
      this.vigW = W; this.vigH = H;
      this.vig = makeCanvas(W, H);
      const x = this.vig.getContext('2d');
      const g = x.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, 'rgba(8,4,14,0)'); g.addColorStop(1, 'rgba(8,4,14,0.34)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vig, 0, 0);
  },
};

// Everything in the world that glows, gathered into this frame's lights.
function worldLights(W, cx, cy, vw, vh) {
  if (FX.quality < 2) return;
  const on = (x, y) => x > cx - 40 && x < cx + vw + 40 && y > cy - 40 && y < cy + vh + 40;
  const flick = () => 0.8 + Math.random() * 0.2;
  const T = W.terrain;
  let n = 0;
  for (const i of T.burning) {
    const x = (i % T.w) * TILE + 8, y = ((i / T.w) | 0) * TILE + 8;
    if (!on(x, y) || (n++ & 1)) continue; // every other burning tile is plenty
    FX.lightNow(x, y, 30, '#ff8a2a', 0.5 * flick());
    if (n > 60) break;
  }
  n = 0;
  for (const c of W.fuel.cells.values()) {
    if (c.fire <= 0) continue;
    const x = c.cx * TILE + 8, y = c.row * TILE - 4;
    if (!on(x, y) || (n++ & 1)) continue;
    FX.lightNow(x, y, 28, '#ff9a3a', 0.45 * flick());
  }
  for (const q of W.projectiles) {
    if (q.dead || !on(q.x, q.y)) continue;
    const k = q.kind;
    if (k === 'rocket' || k === 'erocket' || k === 'missile' || k === 'homing') FX.lightNow(q.x, q.y, 20, '#ffae4a', 0.55);
    else if (k === 'flare') FX.lightNow(q.x, q.y, 22, '#ff4a3a', 0.6 * flick());
    else if (q.tracer) FX.lightNow(q.x, q.y, 10, '#fff0d0', 0.5);
    else if (k === 'bullet') FX.lightNow(q.x, q.y, 8, q.team === 'p' ? '#ffd890' : '#ff6a3a', q.team === 'p' ? 0.3 : 0.4); // rounds glow faintly
    else if (k === 'flame' && Math.random() < 0.35) FX.lightNow(q.x, q.y, 16, '#ff8a2a', 0.3);
  }
  for (const e of W.enemies) {
    if (e.dead || !on(e.cx, e.cy)) continue;
    if (e.burning > 0) FX.lightNow(e.cx, e.cy, 24, '#ff8a2a', 0.55 * flick());
    if (e.snipeT > 0) {
      const vx = e.face * Math.cos(e.aimE), vy = Math.sin(e.aimE), x0 = e.scopeX(), y0 = e.muzzleY() - 1;
      FX.lightNow(x0 + vx * e.laserLen, y0 + vy * e.laserLen, e.lockT > 0 ? 12 : 8, e.lockT > 0 ? '#ffffff' : '#ff3a2a', 0.7);
    }
    if (e.type === 'flamer' && (e.sprayT > 0 || e.igniteT > 0)) FX.lightNow(e.cx + e.face * 18, e.y + 5, e.sprayT > 0 ? 38 : 18, '#ff9a3a', 0.6 * flick());
  }
  for (const o of W.props) {
    if (o.dead || !on(o.x, o.y)) continue;
    if (o.isFuel && o.torch > 0) FX.lightNow(o.cx, o.y + 6, 42, '#ff9a3a', 0.7 * flick());
    else if (o instanceof Barrel && o.fuse >= 0) FX.lightNow(o.x + o.w / 2, o.y + 4, 18, '#ff8a2a', 0.5 * flick());
    else if (o instanceof SmokeFlare) FX.lightNow(o.x, o.y - 4, 26, '#ff3a2a', 0.55 * flick());
    else if (o instanceof FirePatch) FX.lightNow(o.x + o.w / 2, o.y - 6, Math.max(24, o.w * 0.7), '#ff8a2a', 0.5 * flick());
  }
  for (const p of W.players) {
    if (p.dead) continue;
    if (p.hero.id === 'scorch' && p.firing) FX.lightNow(p.cx + p.face * 20, p.y + 6, 36, '#ff9a3a', 0.6 * flick());
    if (p.jetting) FX.lightNow(p.cx - p.face * 4, p.y + p.h, 16, '#ffae3a', 0.5);
    if (p.roid > 0) FX.lightNow(p.cx, p.cy, 22, '#ff5a3a', 0.45);
  }
}

// Effects setting: AUTO (full, drops to lite if the device struggles), FULL, LITE
function applyFxSetting() { FX.quality = (Save.data.fx || 'auto') === 'lite' ? 1 : 2; }
const FXAuto = {
  acc: 0, n: 0, slow: 0,
  // fed the real frame time; only judges frames of actual gameplay
  sample(dt) {
    if ((Save.data.fx || 'auto') !== 'auto' || FX.quality < 2) return;
    if (App.scene !== PlayScene || PlayScene.overlay || App.pending || document.hidden || dt > 0.2) { this.acc = 0; this.n = 0; return; }
    this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const avg = this.acc / this.n;
    this.acc = 0; this.n = 0;
    this.slow = avg > 1 / 40 ? this.slow + 1 : 0;
    if (this.slow >= 2) {
      this.slow = 0; FX.quality = 1;
      if (window.world) Atmos.reset(window.world.def.theme);
      Playtest.ev('fx_lite', { fps: Math.round(1 / avg) });
      Funnel.first('fxlite', 'perf', 'fx-lite', 'auto'); // a device too slow for the full effects
    }
  },
};
