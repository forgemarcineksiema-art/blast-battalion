'use strict';
// ============================================================================
//  Attract mode (1.31). The title plays the game behind its menu: a demo pilot runs a hero
//  through a real mission, a few showcase missions in turn, cut through black. The demo world
//  is silent (the title music plays), its hero can't be hurt, and nothing in it is saved or
//  counted - no rescues, cash, tips, playtest events, portal gameplay events or vibration
//  (World.demo guards those).
// ============================================================================

// [mission index, seconds on screen, seconds played through unseen first]. Picked by measuring
// the pilot's runs (the most going on, the hero always in the picture, never stuck): a jungle
// raid, the tank in the snow, the fuel depots in the desert, the walker mech in the snow
const DEMO_CLIPS = [[3, 16, 0], [11, 17, 9], [5, 16, 0], [13, 17, 8]];

// a hero's input driven by code: the same down() / hit() a player's input slot has. It plays
// like the test bot (tools/harness.js): runs right, shoots what's ahead, climbs what blocks
// the way, digs out when stuck, throws a special now and then (the show needs blasts)
class DemoPilot {
  constructor() { this.held = {}; this.hits = {}; this.reset(); }
  reset() { this.held = {}; this.hits = {}; this.stuck = 0; this.lastX = 0; this.unstuck = 0; this.letGo = 0; this.wallT = 0; this.wallY = null; this.digT = 0; this.n = 0; }
  down(b) { return !!this.held[b]; }
  hit(b) { return !!this.hits[b]; }
  press(b) { this.hits[b] = true; this.held[b] = true; }
  think(W) {
    const p = W.player, H = this.held;
    this.hits = {};
    H.right = true; H.left = false; H.fire = false; H.up = false;
    this.n++;
    if (!p || p.dead) return;
    const ahead = (x, y) => x - p.cx > -4 && x - p.cx < 190 && Math.abs(y - p.cy) < 24;
    let fire = W.enemies.some((e) => !e.dead && ahead(e.cx, e.cy)) || W.props.some((o) => o.isDepot && !o.dead && ahead(o.cx, o.y + o.h / 2));
    if (this.digT > 0) { this.digT--; fire = true; }
    else if (p.onGround && p.touchingWall(1)) this.press('jump');
    else if (p.vy > 60) H.jump = false;
    // on a wall: climb it; stuck there under a ceiling - let go and dig from the ground
    if (p.wall) { this.wallT = Math.abs(p.y - (this.wallY == null ? -1e9 : this.wallY)) > 0.5 ? 0 : this.wallT + 1; this.wallY = p.y; } else this.wallT = 0;
    this.letGo = p.wall && this.wallT >= 40 ? 24 : Math.max(0, this.letGo - 1);
    if (this.letGo === 24) this.digT = 124;
    H.up = (!!p.wall && !this.letGo) || p.state === 'ladder';
    if (Math.abs(p.x - this.lastX) < 0.05) this.stuck++; else this.stuck = 0;
    this.lastX = p.x;
    if (this.stuck > 70) { this.unstuck = 45; this.stuck = 0; if (Math.random() < 0.3) this.press('special'); }
    if (this.unstuck > 0) { this.unstuck--; H.right = false; fire = true; }
    // a mini-boss right ahead: over it, shooting the soft top on the way
    if (p.onGround && W.enemies.some((e) => e.isMini && !e.dead && e.awake && e.cx - p.cx > -8 && e.cx - p.cx < e.w / 2 + 44 && Math.abs(e.cy - p.cy) < 30)) { this.press('jump'); fire = true; }
    // a parked mech or tank: in it (it's the best part of the show)
    if (!p.mech && p.state === 'normal' && W.props.some((o) => o.isMech && !o.dead && overlap(p, o))) this.press('up');
    if (this.letGo) { H.right = false; H.left = true; fire = false; }
    H.fire = fire;
    if (this.n % 150 === 75) this.press('special');
  }
}

const Attract = {
  world: null, pilot: null, clip: -1, mode: 'off', black: 1, t: 0, dur: 0, lastHero: null,
  // the band the hero stays in, between the title's logo and its menu (TitleScene.layout)
  band: null,
  // the title opens: the next showcase mission (a different one on every visit)
  start() {
    this.pilot = this.pilot || new DemoPilot();
    if (this.clip < 0) this.clip = (Math.random() * DEMO_CLIPS.length) | 0;
    this.load();
  },
  stop() {
    Sound.stopAllLoops();
    if (window.world && window.world === this.world) window.world = null;
    this.world = null; this.mode = 'off';
    FX.reset(null);
  },
  // build the next mission; its drop is then played through unseen, a few steps a frame
  load() {
    this.clip = (this.clip + 1) % DEMO_CLIPS.length;
    const [lv, dur, skip] = DEMO_CLIPS[this.clip], all = Save.unlockedHeroes(), pool = all.filter((id) => id !== this.lastHero);
    const hero = pick(pool.length ? pool : all);
    this.lastHero = hero;
    this.world = this.quietly(() => new World({ def: LEVELS[lv], seed: lv, demo: true, hero }));
    this.world.pilot = this.pilot; this.pilot.reset();
    this.mode = 'ff'; this.black = 1; this.t = 0; this.dur = dur; this.skip = skip || 0; this.ffT = 0; this.bestX = -1; this.bestT = 0;
  },
  // the demo world makes no sound and writes no score popups (the title draws its own words)
  quietly(fn) {
    Sound.quiet = true; FX.muteText = true;
    try { return fn(); } finally { Sound.quiet = false; FX.muteText = false; }
  },
  step(dt) {
    const W = this.world, b = this.band;
    W.camFrame = b ? { feet: Math.round((b.top + b.bottom) / 2 + 12), top: b.top, low: b.bottom } : null;
    this.pilot.think(W);
    this.quietly(() => W.update(dt));
  },
  update(dt) {
    const W = this.world;
    if (!W) return;
    if (this.mode === 'ff') {
      // the chopper drop, the landing and the clip's skip, unseen; then the picture fades in
      for (let i = 0; i < 24 && this.mode === 'ff'; i++) {
        this.step(dt);
        const p = W.player;
        if (W.state === 'play' && p && !p.dead && (p.onGround || this.ffT > 0)) this.ffT += dt;
        if (this.ffT > 0.6 + this.skip || W.time > 8 + this.skip) this.mode = 'in';
      }
      return;
    }
    this.step(dt);
    const p = W.player;
    if (this.mode === 'in' && (this.black -= dt / 0.4) <= 0) { this.black = 0; this.mode = 'show'; }
    if (this.mode === 'out' && (this.black += dt / 0.35) >= 1) { this.load(); return; }
    this.t += dt;
    // a hero that makes no headway for a while is cut away from, like the end of the clip
    if (p && !p.dead && p.cx > this.bestX + 40) { this.bestX = p.cx; this.bestT = this.t; }
    const over = this.t > this.dur || this.t - this.bestT > 4.5 || !p || p.dead || (W.state !== 'play' && W.state !== 'extract');
    if (over && this.mode === 'show') this.mode = 'out';
  },
  draw(ctx) {
    const W = this.world;
    if (!W || this.mode === 'ff') { ctx.fillStyle = '#0c0b10'; ctx.fillRect(0, 0, Gfx.W, Gfx.H); return; }
    W.draw(ctx);
    if (this.black > 0) { ctx.fillStyle = 'rgba(12,11,16,' + this.black.toFixed(3) + ')'; ctx.fillRect(0, 0, Gfx.W, Gfx.H); }
  },
};
