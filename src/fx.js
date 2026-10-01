'use strict';
// ============================================================================
//  Particles (pooled, struct-of-arrays) + transient visual effects
// ============================================================================

// TRAIL: drawn as a short streak along its velocity; SMOKE: a burning chunk that
// trails smoke; ADD: drawn additively (glowing embers and sparks)
// TINK: a casing - its first touch of the floor clinks
const PF = { GRAV: 1, BOUNCE: 2, RISE: 4, SHRINK: 8, FLICKER: 16, CIRCLE: 32, DRAG: 64, STICK: 128, GROW: 256, LIGHT: 512, DECAL: 1024, TRAIL: 2048, SMOKE: 4096, ADD: 8192, TINK: 16384 };
const SHELL_RED = '#c8322a';

const RAMPS = [
  ['#ffffff', '#fff4a0', '#ffd23a', '#ff9a2a', '#e8581c', '#a8321a', '#5a3a34', '#3a3032'], // 0 explosion
  ['#fff4a0', '#ffd23a', '#ff9a2a', '#e8581c', '#b8321a', '#5a2a22'],                       // 1 flame
  ['#a8a29c', '#8a847e', '#6e6a66', '#56524f', '#46423f'],                                   // 2 smoke
  ['#ffffff', '#fff4a0', '#ffd23a', '#ff9a2a'],                                              // 3 spark
  ['#ffffff', '#dff8ff', '#8fe4ff', '#2fb8ff', '#1a6aa8'],                                   // 4 electric
  ['#d8ccb8', '#c0b49e', '#a89c88', '#8e8472'],                                              // 5 dust
  ['#ffffff', '#e8ecf4', '#c8d0dc'],                                                          // 6 white puff
  ['#6e4a34', '#5c463c', '#4e4542', '#565050', '#65605e', '#77726f', '#8a8582'],              // 7 sooty smoke: fire-lit at first, greying as it rises
  ['#ffffff', '#fff4a0', '#ffd23a', '#ff9a2a', '#ff6a1a', '#c8321a'],                         // 8 ember
];

// Soft light as concentric bands (pixel-art friendly), drawn additively.
const glowCache = new Map();
function glowSprite(color, r) {
  const key = color + r;
  let c = glowCache.get(key);
  if (c) return c;
  c = makeCanvas(r * 2 + 1, r * 2 + 1);
  const x = c.getContext('2d');
  for (const [f, a] of [[1, 0.035], [0.86, 0.05], [0.72, 0.07], [0.58, 0.09], [0.45, 0.12], [0.32, 0.16], [0.2, 0.22]]) {
    const rr = Math.max(1, Math.round(r * f));
    x.globalAlpha = a; x.drawImage(circleSprite(color, rr), r - rr, r - rr);
  }
  glowCache.set(key, c);
  return c;
}

const circleCache = new Map();
function circleSprite(color, r) {
  const key = color + r;
  let c = circleCache.get(key);
  if (c) return c;
  const d = r * 2 + 1;
  c = makeCanvas(d, d);
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let j = -r; j <= r; j++) {
    const half = Math.floor(Math.sqrt(r * r - j * j + r * 0.8));
    x.fillRect(r - half, r + j, half * 2 + 1, 1);
  }
  circleCache.set(key, c);
  return c;
}

const FX = {
  N: 3500, next: 0, count: 0,
  quality: 2,            // 2 = full (lights, ambience, rich effects), 1 = lite (settings / auto on slow devices)
  calm: false,           // reduced flashing (accessibility): smaller, softer flashes, no light rays
  lights: [], frameLights: [],
  lerpA: 1,              // drawn this far between the last two steps (World.draw sets it)
  init() {
    const N = this.N;
    this.x = new Float32Array(N); this.y = new Float32Array(N);
    this.px = new Float32Array(N); this.py = new Float32Array(N); // where each was a step ago
    this.vx = new Float32Array(N); this.vy = new Float32Array(N);
    this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.size = new Float32Array(N); this.flags = new Uint16Array(N);
    this.ramp = new Int8Array(N); this.col = new Array(N).fill('#fff');
    this.alive = new Uint8Array(N);
    this.effects = [];
    this.terrain = null;
  },
  reset(terrain) {
    this.alive.fill(0); this.effects.length = 0; this.terrain = terrain; this.count = 0;
    this.lights.length = 0; this.frameLights.length = 0;
  },

  // ------------------------------------------------------------ light
  // a light that fades out over dur seconds (explosions, muzzle flashes, bolts)
  light(x, y, r, color, a = 1, dur = 0.3) {
    if (this.quality < 2 || this.lights.length > 90) return;
    this.lights.push({ x, y, r, color, a: this.calm ? a * 0.55 : a, dur, t: 0 });
  },
  // a light for this frame only (fires, rockets, lasers - re-added every frame)
  lightNow(x, y, r, color, a = 1) {
    if (this.quality < 2 || this.frameLights.length > 120) return;
    this.frameLights.push({ x, y, r, color, a });
  },
  drawLights(ctx, camX, camY, vw, vh) {
    if (this.quality < 2 || (!this.lights.length && !this.frameLights.length)) { this.frameLights.length = 0; return; }
    ctx.globalCompositeOperation = 'lighter';
    const one = (L, a) => {
      const r = Math.max(4, Math.min(160, Math.round(L.r / 4) * 4));
      const x = L.x - camX, y = L.y - camY;
      if (x < -r || y < -r || x > vw + r || y > vh + r || a <= 0.01) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowSprite(L.color, r), Math.round(x - r), Math.round(y - r));
    };
    for (const L of this.lights) { const k = L.t / L.dur; one(L, L.a * (1 - k) * (1 - k)); }
    for (const L of this.frameLights) one(L, L.a);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.frameLights.length = 0;
  },

  spawn(x, y, vx, vy, life, size, color, flags = 0, ramp = -1) {
    let i = this.next;
    this.next = (this.next + 1) % this.N;
    if (!this.alive[i]) this.count++;
    this.alive[i] = 1;
    this.x[i] = x; this.y[i] = y; this.px[i] = x; this.py[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.flags[i] = flags;
    this.ramp[i] = ramp; this.col[i] = color;
    return i;
  },

  // remember where everything is before a simulation step (for drawing between steps)
  snap() {
    const x = this.x, y = this.y, px = this.px, py = this.py, alive = this.alive;
    for (let i = 0; i < this.N; i++) if (alive[i]) { px[i] = x[i]; py[i] = y[i]; }
    for (const e of this.effects) e.ly = e.y;
  },
  update(dt) {
    const t = this.terrain;
    for (let i = 0; i < this.N; i++) {
      if (!this.alive[i]) continue;
      let l = this.life[i] - dt;
      if (l <= 0) { this.alive[i] = 0; this.count--; continue; }
      this.life[i] = l;
      const f = this.flags[i];
      if (f & PF.STICK) { continue; }
      // a burning chunk leaves a trail of soot
      if ((f & PF.SMOKE) && Math.random() < dt * 22) this.spawn(this.x[i], this.y[i], rand(-6, 6), rand(-14, -4), rand(0.5, 0.9), rand(1.5, 2.5), '#555', PF.CIRCLE | PF.GROW | PF.FLICKER, 7);
      if (f & PF.GRAV) this.vy[i] += GRAVITY * TUNE.worldGrav * dt; // debris, blood, sparks: the same gravity as bodies
      if (f & PF.RISE) this.vy[i] -= 60 * dt;
      if (f & PF.DRAG) { const k = Math.pow(0.04, dt); this.vx[i] *= k; this.vy[i] *= k; }
      const nx = this.x[i] + this.vx[i] * dt, ny = this.y[i] + this.vy[i] * dt;
      if ((f & PF.BOUNCE) && t) {
        if (t.solidAt(nx, ny)) {
          if (f & PF.DECAL) {
            // blood sticks to the terrain it hits
            t.addDecal(nx, ny, this.col[i], this.size[i] > 1 ? 2 : 1);
            this.alive[i] = 0; this.count--;
            continue;
          }
          if (!t.solidAt(this.x[i], ny)) { this.vx[i] *= -0.4; }
          else {
            if (f & PF.TINK) { this.flags[i] &= ~PF.TINK; this.tink(this.x[i], this.y[i], this.col[i]); }
            this.vy[i] *= -0.35; this.vx[i] *= 0.6; if (Math.abs(this.vy[i]) < 25) { this.vy[i] = 0; this.vx[i] *= 0.5; if (Math.abs(this.vx[i]) < 6) this.flags[i] |= PF.STICK; }
          }
          continue;
        }
      }
      this.x[i] = nx; this.y[i] = ny;
    }
    for (let k = this.effects.length - 1; k >= 0; k--) {
      const e = this.effects[k];
      e.t += dt;
      if (e.vy) e.y += e.vy * dt;
      if (e.t >= e.dur) this.effects.splice(k, 1);
    }
    for (let k = this.lights.length - 1; k >= 0; k--) {
      const L = this.lights[k];
      L.t += dt;
      if (L.t >= L.dur) this.lights.splice(k, 1);
    }
  },

  draw(ctx, camX, camY, vw, vh) {
    const add = this.addList || (this.addList = []);
    add.length = 0;
    const a = this.lerpA, b = 1 - a;
    const X = (i) => (a < 1 ? this.px[i] * b + this.x[i] * a : this.x[i]) - camX;
    const Y = (i) => (a < 1 ? this.py[i] * b + this.y[i] * a : this.y[i]) - camY;
    for (let i = 0; i < this.N; i++) {
      if (!this.alive[i]) continue;
      const sx = X(i), sy = Y(i);
      if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) continue;
      if (this.flags[i] & PF.ADD) { add.push(i); continue; }
      this.drawOne(ctx, i, sx, sy);
    }
    // glowing sparks and embers go on top, added to what's under them
    if (add.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const i of add) this.drawOne(ctx, i, X(i), Y(i));
      ctx.globalCompositeOperation = 'source-over';
    }
  },
  drawOne(ctx, i, sx, sy) {
    const f = this.flags[i];
    const k = 1 - this.life[i] / this.max[i];
    if ((f & PF.FLICKER) && k > 0.7 && ((this.life[i] * 30) | 0) % 2) return;
    let color = this.col[i];
    if (this.ramp[i] >= 0) { const r = RAMPS[this.ramp[i]]; color = r[Math.min(r.length - 1, (k * r.length) | 0)]; }
    let s = this.size[i];
    if (f & PF.SHRINK) s = s * (1 - k * 0.85);
    if (f & PF.GROW) s = s * (0.5 + k * 0.9);
    if (f & PF.TRAIL) {
      // a streak pointing back along the way it came
      const vx = this.vx[i], vy = this.vy[i], sp = Math.hypot(vx, vy) || 1, len = Math.min(7, 1 + sp * 0.025);
      ctx.fillStyle = color;
      for (let d = 0; d < len; d++) ctx.fillRect(Math.round(sx - vx / sp * d), Math.round(sy - vy / sp * d), 1, 1);
      return;
    }
    if (f & PF.CIRCLE) {
      const r = Math.max(1, Math.round(s));
      ctx.drawImage(circleSprite(color, r), Math.round(sx - r), Math.round(sy - r));
    } else {
      const si = Math.max(1, Math.round(s));
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(sx - si / 2), Math.round(sy - si / 2), si, si);
    }
  },

  drawEffects(ctx, camX, camY) {
    const a = this.lerpA;
    for (const e of this.effects) {
      if (e.t < 0) continue; // delayed start
      const k = e.t / e.dur;
      const ey = a < 1 && e.vy && e.ly != null ? e.ly + (e.y - e.ly) * a : e.y; // rising texts glide between steps
      const x = Math.round(e.x - camX), y = Math.round(ey - camY);
      switch (e.type) {
        case 'shock': {
          // blast wave: a bright leading ring with a hot one just behind it
          const r = Math.max(1, Math.round(e.r * easeOutCubic(k)));
          if (k < 0.25) { ctx.globalAlpha = 0.18 * (1 - k * 4); ctx.drawImage(circleSprite('#fff4d0', r), x - r, y - r); ctx.globalAlpha = 1; }
          ctx.lineWidth = Math.max(1, Math.round(3 * (1 - k)));
          ctx.strokeStyle = k < 0.45 ? '#ffffff' : '#ffe6a0';
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          if (r > 6) {
            ctx.lineWidth = 1; ctx.strokeStyle = k < 0.5 ? '#ffae3a' : '#c8501a';
            ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2); ctx.stroke();
          }
          break;
        }
        case 'rays': {
          if (this.calm) break;
          // a burst of light rays: the "that was huge" beat
          const n = e.n || 12, a0 = e.seed || 0, fade = 1 - k;
          if (!e.len) { e.len = []; for (let i = 0; i < n; i++) e.len.push(rand(0.55, 1)); }
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = e.color || '#fff0b0';
          ctx.globalAlpha = 0.85 * fade;
          for (let i = 0; i < n; i++) {
            const a = a0 + i * Math.PI * 2 / n, c = Math.cos(a), s = Math.sin(a);
            const r0 = e.r * (0.18 + 0.4 * k), r1 = e.r * e.len[i] * (0.55 + 0.45 * easeOutCubic(k));
            for (let d = r0; d < r1; d += 1.5) ctx.fillRect(Math.round(x + c * d), Math.round(y + s * d), 1, 1);
          }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ghost': {
          // after-image of a dash
          ctx.globalAlpha = 0.55 * (1 - k);
          drawFrame(ctx, e.frame, x, y, e.face, true);
          ctx.globalAlpha = 1;
          break;
        }
        case 'flash': {
          const r = Math.max(1, Math.round(e.r * (k < 0.3 ? 1 : 1.1 - k) * (this.calm ? 0.55 : 1)));
          ctx.drawImage(circleSprite(k < 0.35 && !this.calm ? '#ffffff' : '#fff4a0', r), x - r, y - r);
          break;
        }
        case 'ring': {
          const r = Math.round(e.r * easeOutCubic(k));
          ctx.strokeStyle = k < 0.5 ? '#ffffff' : '#ffd23a';
          ctx.lineWidth = Math.max(1, Math.round(3 * (1 - k)));
          ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'beam': {
          const wdt = Math.max(1, Math.round(e.w * (1 - k)));
          if (e.y1 != null && Math.abs(e.y1 - e.y) >= 1) {
            // tilted beam (aim-assisted sniper shot): short steps along the line
            const x1 = e.x1 - camX, y1 = e.y1 - camY, n = Math.max(1, Math.ceil(Math.abs(x1 - x) / 2));
            for (let i = 0; i <= n; i++) {
              const px = Math.round(x + (x1 - x) * i / n), py = Math.round(y + (y1 - y) * i / n);
              ctx.fillStyle = e.color2 || '#ffd23a'; ctx.fillRect(px, py - Math.floor(wdt / 2) - 1, 2, wdt + 2);
              ctx.fillStyle = e.color || '#ffffff'; ctx.fillRect(px, py - Math.floor(wdt / 2), 2, wdt);
            }
            break;
          }
          ctx.fillStyle = e.color2 || '#ffd23a';
          ctx.fillRect(Math.min(x, e.x1 - camX), y - Math.floor(wdt / 2) - 1, Math.abs(e.x1 - e.x), wdt + 2);
          ctx.fillStyle = e.color || '#ffffff';
          ctx.fillRect(Math.min(x, e.x1 - camX), y - Math.floor(wdt / 2), Math.abs(e.x1 - e.x), wdt);
          break;
        }
        case 'bolt': {
          if (((e.t * 40) | 0) % 3 === 2) break;
          ctx.fillStyle = e.color || '#dff8ff';
          const pts = e.pts;
          for (let p = 0; p < pts.length - 1; p++) {
            const [ax, ay] = pts[p], [bx, by] = pts[p + 1];
            const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) | 0;
            for (let s = 0; s <= n; s++) {
              const px = ax + (bx - ax) * s / (n || 1), py = ay + (by - ay) * s / (n || 1);
              ctx.fillRect(Math.round(px - camX), Math.round(py - camY), e.thick || 1, e.thick || 1);
            }
          }
          break;
        }
        case 'slash': {
          const a0 = e.face > 0 ? -1.3 : Math.PI + 1.3, a1 = e.face > 0 ? 1.1 : Math.PI - 1.1;
          ctx.strokeStyle = k < 0.4 ? '#ffffff' : '#bfe8ff';
          ctx.lineWidth = Math.max(1, 3 - k * 3);
          ctx.beginPath();
          ctx.arc(x, y, e.r, Math.min(a0, a1), Math.max(a0, a1), e.face < 0);
          ctx.stroke();
          break;
        }
        case 'text': {
          // on the HUD layer, in the typeface (src/hud.js)
          if (k > 0.75 && ((e.t * 20) | 0) % 2) break;
          // a shout pops in: a size bigger and white for the first moment
          const pop = e.pop && e.t < 0.08, F = Hud.F;
          Hud.otext(e.text, x * F, (y - (pop ? 2 : 0)) * F, pop ? '#ffffff' : e.color || '#fff', 'center', Hud.u * ((e.scale || 1) + (pop ? 1 : 0)));
          break;
        }
        case 'muzzle': {
          // star-shaped flash: a long tongue forward, short spikes, white-hot core
          const r = e.r * (1 - k * 0.5), f = e.face, fx = x + f * 2;
          const L = Math.round(r * 2.6), h = Math.max(1, Math.round(r * 0.45));
          ctx.fillStyle = '#ffae3a'; ctx.fillRect(f > 0 ? fx : fx - L, y - (h >> 1), L, h);
          ctx.fillStyle = '#fff4a0'; ctx.fillRect(f > 0 ? fx : fx - Math.round(L * 0.7), y, Math.round(L * 0.7), 1);
          const sp = Math.max(2, Math.round(r * 1.1));
          ctx.fillStyle = '#ffd23a';
          for (let d = 1; d <= sp; d++) { ctx.fillRect(fx + f * d, y - d, 1, 1); ctx.fillRect(fx + f * d, y + d, 1, 1); }
          ctx.fillRect(fx, y - sp, 1, sp * 2 + 1);
          ctx.drawImage(circleSprite('#fff4a0', Math.max(1, Math.round(r))), Math.round(fx - r), Math.round(y - r));
          ctx.drawImage(circleSprite('#ffffff', Math.max(1, Math.round(r * 0.5))), Math.round(fx - r * 0.5), Math.round(y - r * 0.5));
          break;
        }
        case 'line': {
          ctx.fillStyle = e.color;
          const n = Math.max(Math.abs(e.x1 - e.x), Math.abs(e.y1 - e.y)) | 0;
          for (let s = 0; s <= n; s += 1) {
            const px = e.x + (e.x1 - e.x) * s / (n || 1), py = e.y + (e.y1 - e.y) * s / (n || 1);
            ctx.fillRect(Math.round(px - camX), Math.round(py - camY), 1, 1);
          }
          break;
        }
      }
    }
  },

  addEffect(e) { e.t = 0; this.effects.push(e); return e; },

  // ------------------------------------------------------------ emitters
  flame(x, y) {
    this.spawn(x, y, rand(-10, 10), rand(-30, -60), rand(0.3, 0.6), rand(2, 4), '#fff', PF.CIRCLE | PF.SHRINK, 1);
    // now and then an ember drifts up out of the fire
    if (this.quality > 1 && Math.random() < 0.07) this.spawn(x, y - 2, rand(-18, 18), rand(-80, -40), rand(0.7, 1.3), 1, '#fff', PF.RISE | PF.FLICKER | PF.ADD, 8);
  },
  smokePuff(x, y, scale = 1) {
    this.spawn(x, y, rand(-8, 8), rand(-20, -40) * scale, rand(0.8, 1.6) * scale, rand(3, 6) * scale, '#888', PF.CIRCLE | PF.GROW | PF.FLICKER, 2);
  },
  dust(x, y, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) this.spawn(x + rand(-4, 4), y - rand(0, 3), rand(-40, 40) + dir * 30, rand(-30, -5), rand(0.3, 0.6), rand(2, 3), '#ccc', PF.CIRCLE | PF.DRAG | PF.SHRINK, 5);
  },
  sparks(x, y, n = 5, dir = 0) {
    for (let i = 0; i < n; i++) this.spawn(x, y, rand(-110, 110) + dir * 70, rand(-150, 20), rand(0.2, 0.5), 1, '#fff', PF.GRAV | PF.TRAIL | PF.ADD, 3);
    if (n >= 3) this.light(x, y, 12, '#ffcc80', 0.5, 0.06);
  },
  debris(x, y, colors, n = 6, power = 1) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + rand(-6, 6), y + rand(-6, 6), rand(-90, 90) * power, rand(-200, -40) * power, rand(0.6, 1.4), rand(1, 3) | 0,
        colors[(Math.random() * colors.length) | 0], PF.GRAV | PF.BOUNCE | PF.FLICKER);
    }
  },
  // chunks of a destroyed tile: bigger than grit, they bounce, settle and lie there a while
  rubble(x, y, colors, n = 2, power = 1) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + rand(-5, 5), y + rand(-5, 5), rand(-110, 110) * power, rand(-220, -60) * power, rand(2.5, 4.5), rand(2, 3.4),
        colors[(Math.random() * colors.length) | 0], PF.GRAV | PF.BOUNCE);
    }
  },
  // a blast kicks loose bits (brass, rubble, grit) back into the air
  impulse(x, y, r, power = 1) {
    const r2 = r * r;
    for (let i = 0; i < this.N; i++) {
      if (!this.alive[i] || !(this.flags[i] & PF.BOUNCE)) continue;
      const dx = this.x[i] - x, dy = this.y[i] - y, d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) || 1, k = (1 - d / r) * power;
      this.vx[i] += dx / d * 240 * k; this.vy[i] += dy / d * 120 * k - 170 * k;
      this.flags[i] &= ~PF.STICK;
    }
  },
  blood(x, y, dir = 0, n = 8, power = 1) {
    if (typeof Settings !== 'undefined' && !Settings.gore()) { this.hitPuff(x, y, dir, n, power); return; }
    for (let i = 0; i < n; i++) {
      this.spawn(x, y, (rand(-60, 60) + dir * 90) * power, rand(-150, -20) * power, rand(0.5, 1.2), rand(1, 2) | 0,
        Math.random() < 0.6 ? '#a8201c' : '#7a1412', PF.GRAV | PF.BOUNCE | PF.FLICKER | PF.DECAL);
    }
  },
  // the bloodless hit (the portal builds' default): a puff of dust and grit, nothing that stains
  hitPuff(x, y, dir = 0, n = 8, power = 1) {
    for (let i = 0; i < Math.ceil(n * 0.6); i++) {
      this.spawn(x, y, (rand(-50, 50) + dir * 70) * power, rand(-120, -20) * power, rand(0.35, 0.7), rand(1, 2) | 0,
        Math.random() < 0.5 ? '#e8e0d0' : '#a89c88', PF.GRAV | PF.BOUNCE | PF.FLICKER);
    }
    if (n >= 6) this.spawn(x, y, dir * 10, -12, rand(0.35, 0.55), rand(2, 3), '#ccc', PF.CIRCLE | PF.DRAG | PF.GROW, 5);
  },
  gibs(x, y, colors, dir = 0, n = 10) {
    if (typeof Settings !== 'undefined' && !Settings.gore()) {
      // bloodless: smoke and a few bits of kit, no flesh
      this.smokePuff(x, y - 2, 1.2); this.smokePuff(x + 4, y, 0.9);
      this.debris(x, y, ['#4a4a52', '#6a6a70', '#3a3a40'], Math.ceil(n * 0.5), 0.9);
      this.hitPuff(x, y, dir, 8, 1.2);
      return;
    }
    for (let i = 0; i < n; i++) {
      this.spawn(x + rand(-4, 4), y + rand(-6, 6), rand(-160, 160) + dir * 80, rand(-280, -60), rand(1, 2.2), rand(2, 3) | 0,
        colors[(Math.random() * colors.length) | 0], PF.GRAV | PF.BOUNCE | PF.FLICKER);
    }
    this.blood(x, y, dir, 14, 1.4);
  },
  // a spent casing flips out of the gun, bounces with a clink and lies on the floor for a while
  // (kind: 'brass' rifles - 'small' pistols and SMGs - 'heavy' minigun, sniper, mech - 'hull' the shotgun's)
  shell(x, y, face, kind = 'brass') {
    const hull = kind === 'hull';
    this.spawn(x, y, -face * rand(30, 70), rand(-125, -75), rand(3.5, 5), kind === 'small' ? 1 : 2, hull ? SHELL_RED : kind === 'heavy' ? '#e8c050' : '#e0b84a', PF.GRAV | PF.BOUNCE | PF.TINK);
  },
  tink(x, y, col) {
    const W = window.world;
    if (!W || !W.onScreen(x, y, 20)) return;
    Sound.play('tink', W.volAt(x, y) * 0.7, col === SHELL_RED ? 0.5 : rand(0.9, 1.15)); // a hull thuds duller than brass
  },
  muzzle(x, y, face, r = 4) {
    this.addEffect({ type: 'muzzle', x, y, face, r, dur: 0.08 });
    this.light(x + face * 4, y, r * 5, '#ffc466', 0.75, 0.07);
    // a wisp of gun smoke curling off the barrel
    if (this.quality > 1 && Math.random() < 0.3) this.spawn(x + face * 3, y - 1, face * rand(4, 14), rand(-22, -10), rand(0.5, 0.9), Math.max(1.5, r * 0.45), '#999', PF.CIRCLE | PF.GROW | PF.RISE | PF.DRAG, 2);
  },
  text(x, y, text, color = '#fff', scale = 1, dur = 0.9) {
    // the title's demo world (src/attract.js): the menu is the only text on screen
    if (this.muteText) return;
    // popups born on top of each other (multi kills, chain reactions) stack upward instead of overlapping
    const h = 8 * scale + 2, w = Font.width(text, scale);
    // never half off the screen (a hero at the edge, a kill by the border)
    const W = window.world;
    if (W && W.cam) { const hw = w / 2 + 3; x = clamp(x, W.cam.x + hw, W.cam.x + Gfx.W - hw); }
    for (let k = 0; k < 6; k++) {
      const o = this.effects.find((e) => e.type === 'text' && e.t < e.dur * 0.75 && e.y < y + h && y < e.y + 8 * (e.scale || 1) + 2 &&
        Math.abs(e.x - x) * 2 < w + Font.width(e.text, e.scale || 1));
      if (!o) break;
      y = o.y - h;
    }
    this.addEffect({ type: 'text', x, y, text, color, scale, dur, vy: -30, pop: text.indexOf('!') >= 0 });
  },
  // after-image left behind by a dash
  ghost(frame, x, footY, face, dur = 0.2) { this.addEffect({ type: 'ghost', frame, x, y: footY, face, dur }); },

  // Explosion: white-hot core, a blast wave, a fireball, sooty smoke that rolls
  // upward, glowing embers on streaks, burning chunks trailing smoke, a wave of
  // dust along the ground - and for the big ones light rays and a mushroom cloud.
  // o: { gy: ground y below (dust wave), fire: fuel/barrel fireball, mega: boss-sized }
  explosion(x, y, r, o = {}) {
    const full = this.quality > 1, big = r >= 44 || o.mega, L = TUNE.fxLinger;
    this.addEffect({ type: 'flash', x, y, r: r * 0.9, dur: 0.12 });
    this.addEffect({ type: 'shock', x, y, r: r * 1.7, dur: 0.3 * Math.min(L, 1.4) });
    this.light(x, y - r * 0.2, r * 2.3, '#ffa040', 1, (0.4 + r * 0.006) * L);
    if (full && r >= 30) this.addEffect({ type: 'rays', x, y, r: r * 2.4, n: 10 + ((r / 5) | 0), seed: Math.random() * 6.28, dur: 0.24 });
    const n = Math.round((10 + r * 0.6) * (full ? 1 : 0.6));
    // fireball
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.2, 1) * r * 3.2;
      this.spawn(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, Math.cos(a) * s, Math.sin(a) * s - 30, rand(0.35, 0.75) * L, rand(r * 0.12, r * 0.28), '#fff', PF.CIRCLE | PF.DRAG | PF.SHRINK, 0);
    }
    // fuel and barrels throw a column of flame up
    if (o.fire || r >= 36) {
      for (let i = 0; i < n * 0.45; i++) this.spawn(x + rand(-r * 0.35, r * 0.35), y + rand(-4, 4), rand(-30, 30), rand(-190, -70), rand(0.45, 0.9) * L, rand(r * 0.1, r * 0.2), '#fff', PF.CIRCLE | PF.SHRINK | PF.DRAG, 1);
    }
    // sooty smoke that lingers and rolls upward
    for (let i = 0; i < n * (full ? 0.8 : 0.5); i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.2, 1) * r * 1.4;
      this.spawn(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, Math.cos(a) * s, Math.sin(a) * s - 25, rand(1.2, 2.6) * L, rand(r * 0.13, r * 0.27), '#555', PF.CIRCLE | PF.DRAG | PF.GROW | PF.FLICKER | PF.RISE, 7);
    }
    // embers streaking out
    for (let i = 0; i < (6 + r * 0.35) * (full ? 1 : 0.5); i++) {
      this.spawn(x + rand(-3, 3), y + rand(-3, 3), rand(-260, 260), rand(-340, -60), rand(0.5, 1.2) * L, 1, '#fff', PF.GRAV | PF.BOUNCE | PF.TRAIL | PF.ADD, 8);
    }
    // burning chunks trailing smoke
    if (full && r >= 24) {
      for (let i = 0; i < 2 + ((r / 18) | 0); i++) this.spawn(x, y, rand(-160, 160), rand(-280, -130), rand(0.8, 1.5) * L, 2, '#ffae3a', PF.GRAV | PF.SMOKE | PF.FLICKER, 8);
    }
    // the blast wave kicks dust along the ground
    if (o.gy != null && o.gy - y < r * 1.1 && o.gy - y > -8) {
      for (let i = 0; i < (8 + r * 0.3) * (full ? 1 : 0.5); i++) {
        const dir = i % 2 ? 1 : -1;
        this.spawn(x + dir * rand(0, r * 0.5), o.gy - rand(1, 5), dir * rand(r * 2, r * 5.5), rand(-30, -6), rand(0.45, 0.9) * L, rand(2, 4), '#ccc', PF.CIRCLE | PF.DRAG | PF.GROW | PF.FLICKER, 5);
      }
    }
    if (big && full) this.mushroom(x, y, r);
  },
  // big blasts: a smoke column with a rolling cap and a fiery heart
  mushroom(x, y, r) {
    const k = r / 44;
    for (let i = 0; i < 8; i++) this.spawn(x + rand(-3, 3), y - i * 3, rand(-8, 8), -(rand(40, 90) + i * 8) * k, rand(1.7, 2.6), rand(r * 0.13, r * 0.19), '#555', PF.CIRCLE | PF.GROW | PF.DRAG, 7);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 6, y - 10, Math.cos(a) * rand(40, 75) * k, (-rand(130, 165) + Math.sin(a) * 25) * k, rand(1.9, 2.8), rand(r * 0.17, r * 0.25), '#555', PF.CIRCLE | PF.GROW | PF.DRAG, 7);
    }
    for (let i = 0; i < 7; i++) this.spawn(x + rand(-6, 6), y - 8, rand(-25, 25), -rand(130, 165) * k, rand(0.6, 1.0), rand(r * 0.12, r * 0.18), '#fff', PF.CIRCLE | PF.SHRINK | PF.DRAG, 1);
    this.light(x, y - r, r * 2.4, '#ff8a3a', 0.6, 1.4);
  },
  // boss down: rings rolling out one after another, a sky-wide flash of rays
  megaBlast(x, y) {
    for (let i = 0; i < 3; i++) { const e = this.addEffect({ type: 'shock', x, y, r: 150 + i * 60, dur: 0.6 }); e.t = -i * 0.16; }
    this.addEffect({ type: 'rays', x, y, r: 220, n: 26, seed: Math.random() * 6.28, dur: 0.5 });
    this.light(x, y, 160, '#ffd080', 1, 1.2);
    this.mushroom(x, y, 70);
  },
};
