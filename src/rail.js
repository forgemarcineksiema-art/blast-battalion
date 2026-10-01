'use strict';
// ============================================================================
//  FLY-IN (1.22): the first mission of a new zone opens aboard the chopper. It
//  sweeps in from the right over the first stretch of the base with the hero on
//  the door gun: the crosshair moves with the arrows / stick (or follows the
//  mouse), FIRE is the minigun, SPECIAL a rocket. Soldiers below shoot back, but
//  it never fails - it's the show before the drop. Hold JUMP to skip. At the
//  landing zone the same chopper takes the hero down as usual.
// ============================================================================

const RAIL_SPEED = 64, RAIL_ROCKETS = 5, RAIL_SPAN = 84; // px/s, rockets, tiles flown over
// what the soldiers below shoot up at the chopper with
const RAIL_SHOOTERS = { grunt: 'gun', heavy: 'gun', sniper: 'gun', officer: 'gun', colonel: 'gun', turret: 'gun', rpg: 'rocket' };

function railControlsHint() {
  const K = (a) => Settings.keyLabel(a, 1);
  if (Input.mode === 'touch') return 'STICK: AIM   FIRE: SHOOT   SPECIAL: ROCKET';
  if (Input.mode === 'gamepad') return 'STICK: AIM   X: SHOOT   B: ROCKET';
  return 'ARROWS OR MOUSE: AIM   ' + K('fire') + ': SHOOT   ' + K('special') + ': ROCKET';
}

Object.assign(World.prototype, {
  startRail() {
    const vw = Gfx.W, sp = this.checkpoint, maxX = this.terrain.w * TILE - vw;
    const endX = clamp(sp.x - vw * 0.35, 0, maxX);
    const startX = clamp(sp.x + RAIL_SPAN * TILE - vw * 0.5, endX, maxX);
    // the hero on the gun is the one who lands
    const fav = Save.data.favorite;
    const hero = !this.mods.hero && fav && Save.unlockedHeroes().includes(fav) ? fav : this.randomHero(0);
    this.rail = { x: startX, endX, t: 0, fireCd: 0, rockets: RAIL_ROCKETS, sx: vw * 0.36, sy: Gfx.H * 0.66, hits: 0,
      skipT: 0, px: Input.pointer.x, py: Input.pointer.y, mouse: false, hero, chX: 0, chY: 0, flashT: 0 };
    this.railHero = hero;
    this.state = 'rail';
    this.cam.x = startX; this.cam.y = this.railCamY(startX);
    this.schedule(2.3, () => {
      if (!this.rail) return;
      this.announce(railControlsHint(), '#c8c4e0', 3.4, 1);
    });
    if (typeof PlayScene !== 'undefined') PlayScene.onGameplay();
  },
  // the camera rides over the lowest ground in view (towers don't make it jump)
  railCamY(x) {
    const vw = Gfx.W, vh = Gfx.H, T = this.terrain;
    let g = 0;
    for (const f of [0.2, 0.5, 0.8]) { const y = T.groundBelow(x + vw * f, 0, T.h * TILE); if (y !== null) g = Math.max(g, y); }
    return clamp(g - vh * 0.72, 0, Math.max(0, T.h * TILE - vh));
  },
  updateRail(dt) {
    const R = this.rail, vw = Gfx.W, vh = Gfx.H;
    R.t += dt;
    if (R.flashT > 0) R.flashT -= dt;
    // hold JUMP to skip to the landing (a dip to black: the camera used to whip ~1300 px across)
    if (Input.down('jump')) {
      R.skipT += dt;
      if (R.skipT > 0.6 && !R.skipping) {
        if (TUNE.camNew) { R.skipping = true; this.camCut(() => { R.x = R.endX; }); } else R.x = R.endX;
      }
    } else R.skipT = 0;
    R.x = Math.max(R.endX, R.x - RAIL_SPEED * dt);
    // the chopper: right of centre, heading left, bobbing
    R.chX = this.cam.x + vw * 0.64; R.chY = this.cam.y + 60 + Math.sin(R.t * 2.4) * 3; // clear of the HUD at the top
    Sound.loop('heli', true, 0.8);
    // aim: arrows / stick move the crosshair; a mouse that moves takes over
    const mx = (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0), my = (Input.down('down') ? 1 : 0) - (Input.down('up') ? 1 : 0);
    if (mx || my) R.mouse = false;
    R.sx = clamp(R.sx + mx * 230 * dt, 8, vw - 8); R.sy = clamp(R.sy + my * 230 * dt, 72, vh - 8);
    if (Input.mode === 'keyboard' && (Input.pointer.x !== R.px || Input.pointer.y !== R.py)) { R.mouse = true; R.px = Input.pointer.x; R.py = Input.pointer.y; }
    if (R.mouse && Input.mode === 'keyboard' && Input.pointer.x >= 0) { R.sx = clamp(Input.pointer.x, 8, vw - 8); R.sy = clamp(Input.pointer.y, 72, vh - 8); }
    const gx = R.chX + 2, gy = R.chY - 10, tx = this.cam.x + R.sx, ty = this.cam.y + R.sy, face = tx < gx ? -1 : 1;
    // FIRE: the door minigun (hold); the brass rains down from the chopper
    R.fireCd -= dt;
    if ((Input.down('fire') || (R.mouse && Input.pointer.down)) && R.fireCd <= 0) {
      R.fireCd = 0.055; R.flashT = 0.04;
      const a = Math.atan2(ty - gy, tx - gx) + rand(-0.035, 0.035), sp = 820, d = Math.hypot(tx - gx, ty - gy);
      this.projectiles.push(new Projectile({ x: gx, y: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: 'p', kind: 'bullet', dmg: 1.5, tileDmg: 3.5, life: d / sp + 0.15, force: 90 }));
      FX.muzzle(gx + Math.cos(a) * 6, gy + Math.sin(a) * 6, face, 3);
      if (Math.random() < 0.5) FX.shell(gx, gy + 2, face, 'heavy');
      Sound.play('mg', 0.8, 1.05); this.kick(-Math.cos(a) * 0.4, -Math.sin(a) * 0.4);
    }
    // SPECIAL: a rocket at the crosshair
    if (Input.hit('special')) {
      if (R.rockets <= 0) Sound.play('nope');
      else {
        R.rockets--;
        const a = Math.atan2(ty - gy, tx - gx);
        this.projectiles.push(new Projectile({ x: gx, y: gy + 2, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, kind: 'rocket', team: 'p', accel: 900, maxSpeed: 520,
          radius: 32, explodeDmg: 12, explodeTile: 40, life: 2.4, sprite: Sprites.props.rocket }));
        Sound.play('rocket', 1); FX.smokePuff(gx, gy, 0.8);
      }
    }
    // the soldiers below shoot back
    for (const e of this.enemies) {
      if (e.dead || !this.onScreen(e.cx, e.cy, -8)) continue;
      e.awake = true;
      const gun = RAIL_SHOOTERS[e.type];
      if (!gun || e.panicT > 0 || e.stun > 0) continue;
      if (e.railCd == null) e.railCd = rand(0.8, 2.4);
      if ((e.railCd -= dt) > 0) continue;
      e.railCd = rand(1.6, 3.2);
      e.face = R.chX > e.cx ? 1 : -1;
      const ox = e.cx + e.face * 6, oy = e.y + 3, a = Math.atan2(R.chY - 12 - oy, R.chX - ox) + rand(-0.09, 0.09);
      if (gun === 'rocket') this.projectiles.push(new Projectile({ x: ox, y: oy, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, team: 'e', src: e.type, kind: 'erocket', sprite: Sprites.props.erocket, radius: 22, explodeDmg: 8, explodeTile: 10, life: 2.5, accel: 120, maxSpeed: 240 }));
      else this.projectiles.push(new Projectile({ x: ox, y: oy, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, team: 'e', src: e.type, kind: 'bullet', dmg: 1, tileDmg: 1, life: 1.6 }));
      FX.muzzle(ox, oy, e.face, 3); Sound.play('eshot', this.volAt(e.cx, e.cy) * 0.7);
    }
    // ... and what hits rings off the hull
    for (const q of this.projectiles) {
      if (q.dead || q.team !== 'e' || q.x < R.chX - 30 || q.x > R.chX + 30 || q.y < R.chY - 26 || q.y > R.chY - 2) continue;
      q.dead = true; R.hits++;
      FX.sparks(q.x, q.y, 4); Sound.play('metal', 0.6, 1.3);
      if (q.kind === 'erocket') { FX.explosion(q.x, q.y, 16); this.shake(4); } else this.shake(1);
    }
    if (R.x <= R.endX + 0.5) this.endRail();
  },
  endRail() {
    const R = this.rail;
    this.rail = null; this.state = 'intro';
    Sound.loop('heli', false);
    this.dropHeroes([0]);
    // the chopper that flew the run goes straight down to the drop
    const ch = this.choppers[this.choppers.length - 1];
    if (ch) { ch.sx = ch.x = R.chX; ch.sy = ch.y = R.chY; ch.face = -1; }
  },
  // the chopper with the gunner in its door, the gun turned to the crosshair
  drawRail(ctx, cx, cy) {
    const R = this.rail;
    if (!R) return;
    const f = Sprites.props.heli[((R.t * 30) | 0) % 3];
    drawFrame(ctx, f, Math.round(R.chX - cx), Math.round(R.chY - cy), -1, false);
    const gx = R.chX + 2 - cx, gy = R.chY - 10 - cy, tx = R.sx, ty = R.sy, face = tx < gx ? -1 : 1;
    const set = Sprites.chars[R.hero];
    if (set) drawFrame(ctx, set.idle[0], Math.round(R.chX + 2 - cx), Math.round(R.chY - 5 - cy), face, false);
    const a = Math.atan2(ty - gy, tx - gx);
    ctx.fillStyle = '#15131c';
    for (let i = 0; i < 9; i++) ctx.fillRect(Math.round(gx + Math.cos(a) * i) - 1, Math.round(gy + Math.sin(a) * i) - 1, 3, 3);
    ctx.fillStyle = '#6e6e7a';
    for (let i = 0; i < 9; i++) ctx.fillRect(Math.round(gx + Math.cos(a) * i), Math.round(gy + Math.sin(a) * i), 1, 1);
  },
  // the crosshair, the rockets left, how to skip
  drawRailHud(ctx, vw, vh) {
    const R = this.rail;
    if (!R) return;
    const x = Math.round(R.sx), y = Math.round(R.sy), s = R.flashT > 0 ? 2 : 0;
    const arm = (c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - 7 - s, y, 5, 1); ctx.fillRect(x + 3 + s, y, 5, 1); ctx.fillRect(x, y - 7 - s, 1, 5); ctx.fillRect(x, y + 3 + s, 1, 5);
    };
    ctx.save(); ctx.translate(1, 1); arm('#15131c'); ctx.restore();
    arm(R.flashT > 0 ? '#ffd23a' : '#ffffff');
    ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x, y, 1, 1);
    // the words on the HUD layer
    const H = Hud, u = H.u, X = H.canvas.width, Y = H.canvas.height;
    H.otext('ROCKETS ' + R.rockets, 8 * H.F, Y - 14 * u, '#ffd23a');
    const skip = Input.mode === 'touch' ? 'HOLD JUMP TO SKIP' : 'HOLD ' + Settings.keyLabel('jump', 1) + ' TO SKIP', sw = H.tw(skip);
    H.otext(skip, X - 8 * H.F, Y - 14 * u, '#c8c4e0', 'right');
    if (R.skipT > 0) H.R(X - 8 * H.F - sw, Y - 4 * u, Math.round(sw * Math.min(1, R.skipT / 0.6)), u, '#ffd23a');
  },
});
