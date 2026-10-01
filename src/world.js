'use strict';
// ============================================================================
//  World: one mission in progress (entities, rules, camera, HUD).
//  Supports 1-2 heroes (local co-op) sharing one pool of lives.
// ============================================================================

// What killed a hero, in words: shown over the body while time slows down, so a death is never a mystery
// First mission only: short prompts over the hero at the moment they are needed (move when the
// mission starts, shoot when a target is in sight, jump when stuck at a step), shown by the HUD as
// keys (World.coachStep). Each one goes away for good once done

const KILLER_NAMES = {
  grunt: 'A SOLDIER', bomber: 'A BOMBER', grenadier: 'A GRENADIER', rpg: 'A ROCKETEER', heavy: 'A HEAVY GUNNER',
  turret: 'A TURRET', dog: 'A DOG', shield: 'A SHIELD TROOPER', scout: 'A SCOUT', mortar: 'A MORTAR', sniper: 'A SNIPER',
  flamer: 'A FLAMETHROWER', officer: 'AN OFFICER', colonel: 'THE COLONEL', boss: 'THE BOSS', truck: 'A TRUCK',
  airstrike: 'AN AIRSTRIKE', mine: 'A MINE', barrel: 'A BARREL', 'propane tank': 'A GAS TANK', 'fuel drum': 'A FUEL DRUM',
  'flamer tank': 'A FUEL TANK', 'bomber bomb': "A BOMBER'S BOMB", 'mech wreck': 'A MECH WRECK', 'falling block': 'FALLING DEBRIS',
  dozer: 'THE DOZER', jugger: 'THE JUGGERNAUT',
};
function deathLabel(cause, info) {
  const who = info && info.src ? KILLER_NAMES[info.src] : null;
  switch (cause) {
    case 'shot': return who ? 'SHOT BY ' + who : 'SHOT';
    case 'explosion': return who ? 'BLOWN UP BY ' + who : 'BLOWN UP';
    case 'fire': return who && info.src === 'flamer' ? 'BURNED BY ' + who : 'BURNED';
    case 'crush': return who ? 'CRUSHED BY ' + who : 'CRUSHED';
    case 'bash': return who ? 'BASHED BY ' + who : 'BASHED BY A SHIELD TROOPER';
    case 'bite': return 'MAULED BY A DOG';
    case 'spikes': return 'IMPALED ON SPIKES';
    case 'doom': return 'CAUGHT BY THE DETONATION';
  }
  return null;
}

class FirePatch {
  constructor(x, y, w, dur, team) { this.x = x - w / 2; this.w = w; this.y = y; this.t = dur; this.team = team; this.dead = false; this.hittable = false; this.h = 12; }
  update(dt, W) {
    this.t -= dt;
    if (this.t <= 0) { this.dead = true; return; }
    const T = W.terrain;
    for (let i = 0; i < 3; i++) {
      const fx = this.x + Math.random() * this.w;
      const gy = T.groundBelow(fx, this.y - 24, 60);
      if (gy !== null && Math.random() < 0.8) FX.flame(fx, gy - 2);
    }
    const x0 = this.x, x1 = this.x + this.w;
    for (const e of W.enemies) {
      if (e.dead || e.isBoss) continue;
      if (e.x + e.w > x0 && e.x < x1 && Math.abs(e.y + e.h - this.y) < 26) e.hurt(0.3, { kind: 'fire', team: this.team });
    }
    if (this.team !== 'p') {
      for (const p of W.players) if (!p.dead && p.x + p.w > x0 && p.x < x1 && Math.abs(p.y + p.h - this.y) < 20) p.kill('fire', { src: 'fire patch' });
    }
    W.fuel.igniteRect(x0, this.y - 20, x1 - x0, 24, this.team);
    for (const o of W.props) if (o.ignite && o.x + o.w > x0 && o.x < x1 && Math.abs(o.y + o.h - this.y) < 20) o.ignite(this.team);
    if (Math.random() < dt * 2) W.scare(this.x + this.w / 2, this.y, this.w * 0.5 + 30, 0.8);
  }
  draw() {}
}

const THEME_TRANSPOSE = { jungle: 0, desert: 2, arctic: -2 };
const PLAYER_COLORS = ['#5ab4ff', '#ff8a3a'];

class World {
  // mission: a campaign index, or { def, seed, arcade: { stage, runSeed, score, lives } }
  constructor(mission) {
    window.world = this;
    const m = typeof mission === 'number' ? { index: mission, def: LEVELS[mission], seed: mission } : mission;
    this.mission = m;
    // attract mode (the title's demo, src/attract.js): one hero, no music of its own, nothing
    // saved, unlocked, paid or counted, no words on screen
    this.demo = !!m.demo; this.demoHero = m.hero || null;
    this.levelIndex = m.index != null ? m.index : -1;
    this.arcade = m.arcade || null;
    this.daily = m.daily || null;
    this.mods = missionMods(m); // the rule of the day or the Arcade run's perk cards (src/mods.js)
    GRAVITY = BASE_GRAVITY * (this.mods.gravity || 1);
    this.def = m.def;
    this.diff = this.def.diff;
    this.numPlayers = Input.coop && !this.demo ? 2 : 1;
    this.skill = currentSkill(); // before spawning enemies (they read it)
    const gen = new LevelGen(this.def, m.seed).generate();
    this.terrain = gen.terrain;
    this.terrain.onDestroy = (cx, cy, t, src) => this.onTileDestroyed(cx, cy, t, src);
    this.terrain.onFall = (cx, cy, t, hp, burning) => this.falling.push(new FallingBlock(cx, cy, t, hp, burning));
    // a structure that lost its support creaks (and shakes the camera a little) before it gives way
    this.terrain.onCrack = (c) => {
      const j = c.cells[0], x = (j % this.terrain.w) * TILE + 8, y = ((j / this.terrain.w) | 0) * TILE + 8;
      if (!this.onScreen(x, y, 60)) return;
      Sound.play('creak', this.volAt(x, y) * Math.min(1, 0.5 + c.cells.length * 0.05));
      if (c.cells.length >= 6) this.shake(Math.min(3, c.cells.length * 0.15));
    };
    this.terrain.buildCanvas();
    this.theme = THEMES[this.def.theme];
    this.par = Sprites.parallax[this.def.theme];
    FX.reset(this.terrain);
    Atmos.reset(this.def.theme);

    this.enemies = []; this.projectiles = []; this.props = []; this.falling = []; this.corpses = []; this.timers = [];
    // this mission's cast gets its poses drawn first (1.32)
    Sprites.warmFor(['grunt', 'prisoner'].concat(Object.keys(this.def.pool || {}).map((t) => ENEMY_DEFS[t] && ENEMY_DEFS[t].look).filter(Boolean), Save.unlockedHeroes()));
    this.decor = gen.decor;
    this.arena = gen.arena; this.bossSpawn = gen.bossSpawn;
    this.prisonersTotal = gen.prisoners;
    // spilled fuel counts as fire for everything that checks the terrain for fire
    this.fuel = new FuelField(this); this.bridges = []; this.blastOwner = null; this.truckEvents = [];
    this.terrain.extraFire = (x, y, w, h, who) => this.fuel.fireAt(x, y, w, h, who);
    for (const f of gen.feats) this.spawnFeature(f);

    // co-op gets a couple of extra shared lives; difficulty adds or removes some
    this.lives = Meta.missionLives(this.skill, this.numPlayers > 1); // difficulty + RESERVES upgrade
    if (this.arcade && this.arcade.lives != null) this.lives = this.arcade.lives; // lives carry over between arcade stages
    // a campaign mission that beat the player last time sends extra reinforcements (+1 life per
    // failed attempt in a row, up to +2): the retry is easier, the wall gets climbed
    this.assist = !this.arcade && !this.daily && this.levelIndex >= 0 ? Math.min(2, (Save.data.fails || {})[this.levelIndex] || 0) : 0;
    this.lives += this.assist;
    this.score = 0; this.kills = 0; this.deaths = 0; this.rescued = 0; this.time = 0;
    this.evSeq = 0; this.evKills = new Map(); this.styleKills = 0; this.hurtFlash = 0; this.kfT = 0; this.clock = 0; this.heat = 0;
    this.checkpoint = { x: gen.spawn.x, y: gen.spawn.y };
    this.state = 'intro';
    this.players = []; this.choppers = []; this.dropQueue = new Set(); this.evac = null;
    this.boss = null; this.bossActive = false; this.bossDone = false; this.extracting = false;
    this.messages = []; this.flashT = 0; this.inputEnabled = true;
    this.reinforce = 0; this.reinforceT = 0; this.completeT = 0; this.continued = false;
    this.lastHero = {}; this.camLock = null; this.unlockedNow = [];
    this.hitstop = 0; this.slowT = 0; this.slowScale = 1; this.warpT = 0; this.decoys = [];
    this.boomShots = 0; this.vampKills = 0; this.rainT = 2.5; // perk counters
    this.bubbles = []; this.radio = null; this.radioQ = null; this.chatT = 0; this.bragT = 0; this.hushT = 0; // chatter
    this.rail = null; this.railHero = null; this.cine = null; // the fly-in, cinema bars
    this.secret = this.secret || null;
    this.cam = { x: 0, y: 0, shake: 0, sx: 0, sy: 0, kx: 0, ky: 0 };
    this.cam.x = clamp(gen.spawn.x - Gfx.W * 0.35, 0, Math.max(0, this.terrain.w * TILE - Gfx.W));
    this.cam.y = clamp(gen.spawn.y - Gfx.H * 0.62, 0, Math.max(0, this.terrain.h * TILE - Gfx.H));
    this.focus = { x: gen.spawn.x, y: gen.spawn.y };
    // mission objective: gates the extraction flag (escape missions get a chasing blast instead)
    this.goal = this.def.boss ? 'boss' : this.def.goal || 'extract';
    this.goalDone = true; this.lockMsgT = 0; this.doom = null; this.finale = null; this.target = null;
    if (this.goal === 'target') { this.target = this.enemies.find((e) => e.def.target) || null; this.goalDone = !this.target; }
    else if (this.goal === 'depots') { this.depotsTotal = this.depotsLeft = this.props.filter((o) => o.isDepot).length; this.goalDone = this.depotsTotal === 0; }
    else if (this.goal === 'escape') this.doom = { x: -1e4, on: false, armed: false, t: 0, pause: 0, fx: 0 };
    // FLY-IN (the first mission of a new zone): the chopper strafes the base before it lands -
    // not on a retry after a lost attempt, not in co-op
    const retry = this.levelIndex >= 0 && !this.arcade && !this.daily && (Save.data.fails || {})[this.levelIndex];
    if (this.def.flyin && this.numPlayers === 1 && !retry && !this.demo) this.startRail();
    else this.dropHeroes(this.numPlayers > 1 ? [0, 1] : [0]);
    this.camStarted = true; // from now on a drop moves the camera (the first one places it)
    if (!this.demo) Music.play('action', THEME_TRANSPOSE[this.def.theme] || 0);
    // no titles over the start: the mission, the operation and the objective were on the screens
    // before it, and the route at the top shows the goal
    this.radioSay(grimmStartLine(this), 2.8);
    this.coach = this.def.tutorial && !this.arcade && !this.daily && !this.demo ? { step: 'move', t: 0, x0: null, stuck: 0, target: null } : null;
    if (!this.demo) Playtest.startRun(this);
  }

  objectiveText() {
    switch (this.goal) {
      case 'target': return this.goalDone ? 'TARGET DOWN - GET TO THE CHOPPER' : 'ELIMINATE THE COLONEL';
      case 'depots': return this.goalDone ? 'DEPOTS DESTROYED - GET TO THE CHOPPER' : 'DESTROY FUEL DEPOTS ' + (this.depotsTotal - this.depotsLeft) + '/' + this.depotsTotal;
      case 'escape': return this.extracting ? null : 'OUTRUN THE DETONATION!';
    }
    return null;
  }
  flagLocked() {
    if (this.lockMsgT > 0) return;
    this.lockMsgT = 2.5;
    Playtest.flagLocked(this);
    this.announce(this.goal === 'target' ? 'ELIMINATE THE COLONEL FIRST!' : 'DESTROY THE FUEL DEPOTS FIRST!', '#ff8a3a', 1.8, 1);
    Sound.play('beep');
  }
  onTargetDown(e) {
    if (this.goal !== 'target' || this.goalDone) return;
    this.goalDone = true;
    this.score += 2500;
    this.freeze(0.08); this.slowmo(0.8, 0.35);
    this.radioSay(GRIMM_TARGET_DOWN, 2.2);
    Sound.play('unlock');
  }
  onDepotDestroyed(d) {
    if (this.goal !== 'depots' || this.goalDone) return;
    this.depotsLeft = Math.max(0, this.depotsLeft - 1);
    this.score += 1500;
    if (this.depotsLeft === 0) {
      this.goalDone = true;
      this.radioSay(GRIMM_DEPOTS_DOWN, 2.2);
      Sound.play('unlock');
    }
  }

  // Escape missions: a wall of detonations sweeps the base from the left. It
  // rubber-bands to hang about a screen behind, so stopping is what kills you.
  updateDoom(dt) {
    const d = this.doom;
    if (this.state !== 'play' && this.state !== 'extract') return;
    if (!d.armed) {
      d.armed = true; d.t = 4.5;
      Sound.play('siren', 0.8);
      return;
    }
    if (!d.on) {
      d.t -= dt;
      if (d.t <= 0) { d.on = true; d.x = this.cam.x - 60; this.announce('RUN!', '#ff3a2a', 1.2, 3); Sound.play('siren', 1); }
      return;
    }
    if (d.pause > 0) { d.pause -= dt; return; }
    if (this.extracting) return; // flag raised: the blast dies down short of the landing zone
    const alive = this.alivePlayers();
    if (!alive.length) return;
    let rear = Infinity;
    for (const p of alive) rear = Math.min(rear, p.x);
    const gap = rear - d.x;
    const base = (24 + this.diff * 12) * (this.skill.id === 'recruit' ? 0.85 : this.skill.id === 'veteran' ? 1.12 : 1);
    // catch up fast when far behind, crawl for the last few steps (close calls, not cheap deaths)
    d.x += (gap > Gfx.W * 0.85 ? base * 4 : gap > Gfx.W * 0.5 ? base * 1.7 : gap < 110 ? base * 0.7 : base) * dt;
    for (const p of alive) if (p.x + p.w * 0.5 < d.x) p.kill('doom', { dirX: 1, force: 300 });
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.x + e.w > d.x) continue;
      e.dead = true;
      if (this.onScreen(e.cx, e.cy, 20)) FX.gibs(e.cx, e.cy, e.def.gib || ['#666', '#444'], 1, 8);
    }
    if (d.x > this.cam.x - 30 && d.x < this.cam.x + Gfx.W + 30) {
      for (let i = 0; i < 3; i++) FX.flame(d.x - rand(0, 12), this.cam.y + rand(0, Gfx.H));
      d.fx -= dt;
      if (d.fx <= 0) {
        d.fx = rand(0.12, 0.22);
        const ex = d.x - rand(0, 16);
        const gy = this.terrain.groundBelow(ex, this.cam.y + 10, Gfx.H);
        const ey = gy !== null && Math.random() < 0.7 ? gy + rand(-10, 6) : this.cam.y + rand(20, Gfx.H - 20);
        this.explode(ex, ey, rand(16, 24), { owner: 'p', dmg: 20, tileDmg: 26, small: true, quiet: true });
        this.shake(2);
      }
    }
  }
  drawDoom(ctx, cx, vw, vh) {
    const sx = Math.round(this.doom.x - cx), t = this.time;
    if (sx <= -20) {
      // off-screen but closing in: pulse the left edge
      const k = clamp(1 - (-sx - 20) / 240, 0, 1);
      if (k > 0) { ctx.fillStyle = 'rgba(255,50,20,' + (0.12 + 0.28 * k * (0.6 + 0.4 * Math.sin(t * 10))).toFixed(3) + ')'; ctx.fillRect(0, 0, 3 + Math.round(9 * k), vh); }
      return;
    }
    ctx.fillStyle = 'rgba(46,10,4,0.5)'; ctx.fillRect(0, 0, clamp(sx - 14, 0, vw), vh);
    for (let y = 0; y < vh; y += 6) {
      const wob = Math.round(Math.sin(y * 0.15 + t * 9) * 4 + Math.sin(y * 0.05 - t * 5) * 3);
      ctx.fillStyle = 'rgba(255,90,20,0.35)'; ctx.fillRect(sx - 20 + wob, y, 16, 6);
      ctx.fillStyle = 'rgba(255,200,80,0.5)'; ctx.fillRect(sx - 6 + wob, y, 5, 6);
    }
  }

  // the base goes up behind the departing chopper
  updateFinale(dt) {
    const f = this.finale;
    if (!f || f.n >= 18) return;
    f.next -= dt;
    if (f.next > 0) return;
    f.next = rand(0.06, 0.15); f.n++;
    const x = this.cam.x + rand(8, Gfx.W - 8);
    const gy = this.terrain.groundBelow(x, this.cam.y + 30, Gfx.H + 60);
    if (gy === null) return;
    // the last blast of the base is the big one
    const last = f.n >= 18;
    this.explode(last ? this.cam.x + Gfx.W * 0.5 : x, last ? (this.terrain.groundBelow(this.cam.x + Gfx.W * 0.5, this.cam.y + 30, Gfx.H + 60) || gy) : gy + rand(-8, 10), last ? 62 : rand(20, 34), { owner: 'p', dmg: 20, tileDmg: 34, fire: last || Math.random() < 0.3 });
  }

  // off-screen objective pointer (colonel / nearest depot)
  drawPointer(ctx, cx, cy, vw, vh) {
    let tgt = null;
    if (this.goal === 'target' && !this.goalDone && this.target && !this.target.dead) tgt = this.target;
    else if (this.goal === 'depots' && !this.goalDone) {
      let bd = Infinity;
      for (const o of this.props) if (o.isDepot && !o.dead) { const dd = Math.abs(o.cx - this.focus.x); if (dd < bd) { bd = dd; tgt = o; } }
    }
    if (!tgt) return;
    const tx = tgt.x + tgt.w / 2 - cx, ty = tgt.y + tgt.h / 2 - cy;
    if (tx >= 0 && tx <= vw && ty >= 0 && ty <= vh) return;
    const ax = Math.round(clamp(tx, 12, vw - 12)), ay = Math.round(clamp(ty, 48, vh - 16));
    const ch = tx > vw ? '→' : tx < 0 ? '←' : ty < 0 ? '↑' : '↓';
    const col = ((this.time * 3) | 0) % 2 ? '#ff8a3a' : '#ffd23a';
    Font.drawOutlined(ctx, ch, ax, ay - 4, col, 1, 'center');
    // the word under it, on the HUD layer (kept whole: translated words run longer)
    const lab = this.goal === 'target' ? 'TARGET' : 'DEPOT', F = Hud.F, hw = Math.ceil(Hud.tw(lab) / 2) + 3 * Hud.u;
    Hud.otext(lab, clamp(ax * F, hw, Hud.canvas.width - hw), (ay + 6) * F, '#ff8a3a', 'center');
  }

  spawnFeature(f) {
    switch (f.kind) {
      case 'enemy': this.enemies.push(new Enemy(this, f.type, f.x, f.y, { guard: f.guard, face: f.face })); break;
      case 'turret': this.enemies.push(new Enemy(this, 'turret', f.x, f.y, { face: -1 })); break;
      case 'cage': this.props.push(new Cage(f.x, f.y)); break;
      case 'barrel': { const b = new Barrel(f.x, f.y, 'barrel'); if (f.hp) b.hp = f.hp; this.props.push(b); break; }
      case 'propane': this.props.push(new Barrel(f.x, f.y, 'propane')); break;
      case 'ammo':
      case 'bonus': { const p = new Pickup(f.x, f.y, f.kind); p.vx = 0; p.vy = 0; p.t = 1; p.persistent = true; p.secret = !!f.secret; this.props.push(p); break; }
      case 'flag': this.props.push(new Flag(f.x, f.y, f.flagKind)); break;
      case 'sign': this.props.unshift(new Sign(f.x, f.y, f.key)); break;
      case 'alarm': this.props.push(new Alarm(f.x, f.y)); break;
      case 'mine': this.props.push(new Mine(f.x, f.y)); break;
      case 'spikes': this.props.push(new Spikes(f.x - 8, f.y, f.w)); break;
      case 'depot': this.props.push(new Depot(f.x, f.y)); break;
      case 'mech': this.props.push(new Mech(f.x, f.y)); break;
      case 'tank': this.props.push(new Mech(f.x, f.y, null, 'tank')); break;
      case 'miniboss': this.enemies.push(new MiniBoss(this, f.mb, f.x, f.y)); break;
      case 'secret': this.secret = { x0: f.x0 * TILE, x1: (f.x1 + 1) * TILE, y0: f.y0 * TILE, y1: (f.y1 + 1) * TILE, c: f, found: false, glintT: 1 }; break;
      case 'drum': this.props.push(new FuelDrum(f.x, f.y, 'drum')); break;
      case 'truck': this.truckEvents.push({ x: f.x, done: false }); break;
      case 'pipe': this.props.push(new FuelDrum(f.x, f.y, 'pipe')); break;
      case 'bridge': {
        const b = new Bridge(this, f.c0, f.c1, f.row), gy = f.row * TILE;
        b.posts = [new BridgePost(b, (f.c0 - 1) * TILE + 8, gy), new BridgePost(b, (f.c1 + 1) * TILE + 8, gy)];
        this.bridges.push(b);
        this.props.push(b, ...b.posts);
        break;
      }
    }
  }

  nearestAlarm(x, y, maxd) {
    let best = null, bd = maxd;
    for (const o of this.props) {
      if (!o.isAlarm || o.dead || o.active) continue;
      const d = Math.abs(o.cx - x) + Math.abs(o.y - y) * 0.5;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // mortar round: marker on the ground now, shell drops from the sky ~1.2 s later
  // (it falls straight down, so a roof overhead really does protect you)
  mortarShell(src, x, gy) {
    const fall = 1.25 * (this.skill.id === 'recruit' ? 1.15 : 1);
    this.props.push(new TargetMark(x, gy, fall));
    this.projectiles.push(new Projectile({
      x, y: gy - 520 * fall, vx: 0, vy: 520, team: 'e', src: 'mortar', kind: 'shell', sprite: Sprites.props.shell,
      radius: 28, explodeDmg: 10, explodeTile: 30, life: fall + 1.5,
    }));
    Sound.play('smallboom', this.volAt(src.cx, src.cy) * 0.7, 0.6);
    this.schedule(Math.max(0, fall - 0.75), () => Sound.play('whistle', this.volAt(x, gy)));
  }

  // squad of paratroopers drifting down around x (spawned just above the view)
  paradrop(x, n) {
    const pool = Object.assign({}, this.def.pool);
    delete pool.dog; delete pool.heavy; delete pool.mortar;
    const rng = new RNG((Math.random() * 1e9) | 0);
    for (let i = 0; i < n; i++) {
      const px = clamp(x + (i - (n - 1) / 2) * 30 + rand(-8, 8), 16, this.terrain.w * TILE - 16);
      const e = new Enemy(this, rng.weighted(pool), px, this.cam.y - 6 - i * 14, { para: true, face: rand(0, 1) < 0.5 ? -1 : 1 });
      this.enemies.push(e);
    }
  }

  // morale break: nearby foot soldiers scream and run for a moment
  scare(x, y, r, dur = 0.9) {
    let said = false;
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.def.static || e.def.heavy || e.type === 'bomber' || e.type === 'dog' || e.para) continue;
      if (Math.abs(e.cx - x) < r && Math.abs(e.cy - y) < r * 0.6) {
        e.panicT = Math.max(e.panicT || 0, dur * rand(0.8, 1.2));
        e.face = e.cx < x ? -1 : 1; e.awake = true; e.icon = '!'; e.iconT = 0.5; e.burst = 0; e.aimT = 0;
        if (!said) { said = true; this.chatter(e, 'panic'); }
      }
    }
  }

  // ------------------------------------------------------------ players
  // "the" player for single-hero logic (first living hero, else anyone)
  get player() { return this.players.find((p) => !p.dead) || this.players[0] || null; }
  alivePlayers() { return this.players.filter((p) => !p.dead && p.state !== 'extract'); }
  nearestPlayer(x, y) {
    let best = null, bd = Infinity;
    // a live decoy nearby draws everyone's attention; cloaked heroes are invisible
    for (const dc of this.decoys) if (!dc.dead && Math.abs(dc.cx - x) < 280 && Math.abs(dc.cy - y) < 160) return dc;
    for (const p of this.players) {
      if (p.dead || p.state === 'extract' || p.cloak > 0) continue;
      const d = (p.cx - x) * (p.cx - x) + (p.cy - y) * (p.cy - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // CHRONO: enemies and their bullets crawl for a while
  timeWarp(dur) {
    this.warpT = Math.max(this.warpT, dur);
    Sound.play('railgun', 0.7, 0.5);
  }
  touchingPlayer(box) {
    for (const p of this.players) if (!p.dead && p.state !== 'extract' && overlap(p, box)) return p;
    return null;
  }
  setPlayer(p) {
    const i = this.players.findIndex((q) => q.slot === p.slot);
    if (i >= 0) this.players[i] = p; else this.players.push(p);
    this.players.sort((a, b) => a.slot - b.slot);
    Playtest.hero(this, p);
  }
  stopLoops(slot) { Sound.loop('flame' + slot, false); Sound.loop('spin' + slot, false); Sound.loop('tread' + slot, false); }

  randomHero(slot) {
    if (this.mods.hero) { this.lastHero[slot] = this.mods.hero; return this.mods.hero; } // HERO DAY
    const pool = Save.unlockedHeroes();
    const taken = this.players.filter((p) => !p.dead && p.slot !== slot).map((p) => p.hero.id);
    let choices = pool.filter((id) => id !== this.lastHero[slot] && !taken.includes(id));
    if (!choices.length) choices = pool.filter((id) => !taken.includes(id));
    if (!choices.length) choices = pool;
    const id = pick(choices);
    this.lastHero[slot] = id;
    return id;
  }

  // ------------------------------------------------------------ helpers
  schedule(t, fn) { this.timers.push({ t, fn }); }
  shake(v) { this.cam.shake = Math.min(14, Math.max(this.cam.shake, v * SHAKE_LEVELS[Save.data.shake == null ? 2 : Save.data.shake])); }
  onScreen(x, y, m = 0) { return x >= this.cam.x - m && x <= this.cam.x + Gfx.W + m && y >= this.cam.y - m && y <= this.cam.y + Gfx.H + m; }
  nearCamera(x, y, m) { return this.onScreen(x, y, m); }
  volAt(x, y) {
    const dx = Math.abs(x - (this.cam.x + Gfx.W / 2)) - Gfx.W / 2, dy = Math.abs(y - (this.cam.y + Gfx.H / 2)) - Gfx.H / 2;
    const d = Math.max(0, dx, dy);
    const v = clamp(1 - d / 260, 0, 1);
    // the sound comes from where it happened; off-screen it is also muffled
    Sound.at(clamp((x - (this.cam.x + Gfx.W / 2)) / (Gfx.W * 0.55), -1, 1) * 0.75, 1 - v);
    return v;
  }
  // a call the player has to act on (RUN!, the flag is locked): a few words, one at a time - a new
  // one takes the old one's place. Everything else the game says happens in pictures, sounds and
  // the cast's chatter
  announce(text, color = '#ffffff', dur = 1.6, size = 2) { if (this.demo) return; this.messages = [{ text, color, t: 0, dur, size }]; }
  // big "new hero" card sliding in from the left (drop-in, rescue, revive)
  heroCard(id, slot, label) {
    this.card = { id, slot, label, t: 0 };
    // the new hero's line, once he's landed
    const hp = this.players.find((q) => q.slot === slot && !q.dead);
    if (hp && HERO_LINES[id]) this.schedule(0.55, () => { if (!hp.dead) this.say(hp, pick(HERO_LINES[id]), 1.8); });
    if (HERO_BY_ID[id].jetpack) this.schedule(0.8, () => { const q = this.players.find((q) => q.slot === slot && !q.dead); if (q) q.flyHint = 2.6; }); // keys over his head (Hud.heroKeys)
  }
  debrisColors(kind) {
    const th = this.theme;
    switch (kind) {
      case 'dirt': return [th.dirt[0], th.dirt[1], th.dirt[2], th.top[0]];
      case 'rock': return th.rock;
      case 'wood': return th.wood;
      case 'brick': return ['#9a9aa0', '#7a7a80', '#5a5a60'];
      case 'steel': return ['#5f6f80', '#7d8fa2', '#3e4a58'];
      case 'sand': return ['#b8a070', '#d4bd8a', '#8a7550'];
      case 'stone': return [th.stone[0], th.stone[1], th.stone[2]];
      default: return ['#888', '#666'];
    }
  }
  bolt(x0, y0, x1, y1) {
    const pts = [[x0, y0]];
    const n = Math.max(2, Math.round(dist(x0, y0, x1, y1) / 8));
    for (let i = 1; i < n; i++) pts.push([lerp(x0, x1, i / n) + rand(-4, 4), lerp(y0, y1, i / n) + rand(-5, 5)]);
    pts.push([x1, y1]);
    FX.addEffect({ type: 'bolt', x: 0, y: 0, pts, dur: 0.16, color: '#dff8ff', thick: 1 });
    FX.light(x1, y1, 44, '#8fe4ff', 0.9, 0.22); FX.light((x0 + x1) / 2, (y0 + y1) / 2, 30, '#8fe4ff', 0.5, 0.16);
  }

  // ------------------------------------------------------------ spawning
  // Heroes arrive by helicopter at the last checkpoint. Slots queued while a
  // helicopter is still flying in ride along with it.
  dropHeroes(slots) {
    for (const s of slots) this.dropQueue.add(s);
    if (this.choppers.some((c) => c.state === 'in')) return;
    const x = this.checkpoint.x, groundY = this.checkpoint.y;
    // the camera goes to the drop zone (eased, or a dip to black when far) and the chopper flies in
    // once it's there (src/camera.js); the 1.29 camera chased the chopper instead
    const from = this.camRespawn(x, groundY);
    this.focus = { x, y: groundY };
    if (this.doom && this.doom.on) { this.doom.x = Math.min(this.doom.x, x - Gfx.W * 0.7); this.doom.pause = 3.5; }
    this.choppers.push(new Chopper(this, 'drop', x, groundY - 72, (ch) => {
      const list = [...this.dropQueue].sort();
      this.dropQueue.clear();
      const fav = Save.data.favorite;
      list.forEach((slot, i) => {
        const useFav = !this.mods.hero && this.state === 'intro' && slot === 0 && fav && Save.unlockedHeroes().includes(fav);
        const demoHero = this.demoHero && slot === 0 && this.state === 'intro' ? this.demoHero : null;
        const id = demoHero || (useFav ? fav : slot === 0 && this.railHero ? this.railHero : this.randomHero(slot)); // the door gunner lands
        if (slot === 0) this.railHero = null;
        if (useFav) this.lastHero[slot] = fav;
        const p = new Player(this, id, ch.x + i * 10 - 5 * (list.length - 1), ch.y + 2, slot);
        p.inv = 2.2; p.vy = 30 + i * 25; p.dropIn = true; // lands on one knee (1.32)
        if (TUNE.camNew) p.camY = groundY; // the view keeps the drop zone's ground, not the chopper's height
        this.setPlayer(p);
        this.heroCard(id, slot, this.state === 'intro' ? 'DEPLOYED' : 'REINFORCEMENT');
      });
      if (this.state === 'intro') { this.state = 'play'; if (!this.demo && typeof PlayScene !== 'undefined') { PlayScene.onGameplay(); Funnel.start(this); } }
    }, from));
  }

  continueGame() {
    this.continued = true;
    this.lives = 3;
    // resume the evac phase if the flag was raised / the boss was already destroyed
    this.state = this.extracting ? 'extract' : 'play';
    const slots = [];
    for (let s = 0; s < this.numPlayers; s++) {
      const p = this.players.find((q) => q.slot === s);
      if (!p || p.dead) slots.push(s);
    }
    for (const p of this.players) p.waiting = false;
    this.dropHeroes(slots);
  }

  // ------------------------------------------------------------ events
  onPlayerDeath(p, cause, info) {
    this.deaths++;
    if (!this.demo) Settings.haptic(170);
    Playtest.death(this, p, cause, info);
    p.deadT = 1.7;
    this.freeze(0.08);
    Sound.play('playerDie');
    this.stopLoops(p.slot);
    this.shake(5); Sound.duck(0.7, 0.8);
    const dirX = info.dirX || 0;
    const hatOff = TUNE.charAnim && p.gfx.hatPops && cause !== 'fire'; // the hat flies off (1.32)
    if (hatOff) this.props.push(new Hat(p.gfx, p.cx, p.y + p.h, p.face, dirX * rand(40, 90) + rand(-20, 20), -rand(170, 240)));
    if (Settings.gore() && (cause === 'explosion' || cause === 'crush' || cause === 'doom')) FX.gibs(p.cx, p.cy, ['#d8b84a', '#e8b48a', '#4f6b2d', '#b8302a'], dirX, 14);
    else {
      FX.blood(p.cx, p.cy, dirX, 12);
      const blast = cause === 'explosion' || cause === 'doom';
      const c = new Corpse(p.gfx, p.cx, p.y + p.h, p.w, p.face, dirX * (blast ? 180 : 140) + rand(-20, 20), blast ? -260 : -200, cause === 'fire');
      c.hatOff = hatOff;
      this.corpses.push(c);
    }
    this.enemiesCheer(p);
    if (TUNE.deathSlow > 0) this.slowmo(TUNE.deathSlow, 0.35);
    // what got him - the one text of the moment: nobody talks over it
    const why = deathLabel(cause, info);
    // kept whole on screen even when the hero fell at its edge
    if (why) { const hw = Font.width(why) / 2 + 4; FX.text(clamp(p.cx, this.cam.x + hw, this.cam.x + Gfx.W - hw), p.y - 16, why, '#ff9a7a', 1, 2.4); this.hushT = 2.6; }
  }

  // The last hero standing goes down (1.32): the soldiers around him cheer - a fist in the air, a jeer -
  // and they hold their fire while they do (in co-op, while the other hero still fights, nobody cheers)
  enemiesCheer(p) {
    if (!TUNE.charAnim || TUNE.enemyCheer <= 0 || this.alivePlayers().length) return;
    let said = false;
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.def.static || e.held || e.burning > 0 || e.panicT > 0 || e.para || !e.awake) continue;
      if (Math.abs(e.cx - p.cx) > 240 || Math.abs(e.cy - p.cy) > 120 || !this.onScreen(e.cx, e.cy, 20)) continue;
      e.cheerT = TUNE.enemyCheer * rand(0.85, 1.15); e.cheerDelay = rand(0.25, 0.6); e.aimT = 0; e.burst = 0; e.windT = 0;
      if (!said && e.type !== 'dog') {
        said = true;
        this.schedule(e.cheerDelay + 0.1, () => { if (!e.dead) { this.chatT = Math.max(this.chatT, 2); this.say(e, pick(ENEMY_LINES.cheer), 1.2); } });
      }
    }
  }

  // Kills are worth more when the world did the job: named style kills
  // (crushed, splat, chain reaction...) and several kills from one blast/shot.
  onEnemyKilled(e, info, noScore) {
    this.kills++;
    if (info.team === 'p' || info.env) this.killEffects(e, info);
    if (e.def.heavy) this.freeze(0.05);
    // a kill holds the frame for the eye; a knife kill (one deliberate blow) a little longer.
    // Not every kill of a spray, though: that would stutter
    else if (this.kfT <= 0 && TUNE.killFreeze > 0 && (info.kind === 'bullet' || info.kind === 'melee' || info.kind === 'shock')) { this.freeze(TUNE.killFreeze / 1000 * (info.freezeMul || (info.kind === 'melee' ? 1.5 : 1))); this.kfT = 0.2; } // each weapon lands its own weight
    if (noScore) return;
    const base = Math.round((e.def.score || 100) * this.skill.score);
    let style = info.style || null;
    if (!style) {
      if (info.kind === 'crush') style = STYLE.crush;
      else if (info.kind === 'fire') style = STYLE.burn;
      else if (info.kind === 'explosion' && info.team === 'e') style = STYLE.friendly;
      else if (info.kind === 'explosion' && info.env) style = STYLE.chain;
      else if (!e.onGround && !e.para && !e.isBoss && (info.kind === 'bullet' || info.kind === 'shock')) style = STYLE.air;
    }
    Playtest.kill(this, e, info, style);
    const bonus = style ? Math.round(style[1] * this.skill.score) : 0;
    this.score += base + bonus;
    if (style) { this.styleKills++; Sound.play('style', 0.8); }
    if (info.ev) {
      const g = this.evKills.get(info.ev) || { n: 0, x: e.cx, y: e.y, last: 0, pending: false };
      g.n++; g.x = e.cx; g.y = e.y; g.last = this.clock;
      this.evKills.set(info.ev, g);
      if (!g.pending) { g.pending = true; this.schedule(0.25, () => this.resolveMulti(info.ev)); }
    }
  }
  // settle a multi-kill once the event (blast, piercing shot, domino of bodies) has gone quiet
  resolveMulti(ev) {
    const g = this.evKills.get(ev);
    if (!g) return;
    const quiet = this.clock - g.last;
    if (quiet < 0.24) { this.schedule(0.25 - quiet, () => this.resolveMulti(ev)); return; }
    this.evKills.delete(ev);
    if (g.n < 2) return;
    this.score += Math.round(50 * g.n * (g.n - 1) * this.skill.score);
    if (g.n >= 3 && this.bragT <= 0) {
      // the hero gloats (not every time)
      const p = this.nearestPlayer(g.x, g.y);
      if (p && !p.dead) { this.say(p, pick(HERO_BRAGS), 1.4); this.bragT = 8; p.cheerT = TUNE.poseTime; }
    }
    if (g.n >= 3) {
      Sound.play('unlock', 0.6); this.shake(3);
      // the big beat: light rays, and (not too often) a breath of slow motion
      FX.addEffect({ type: 'rays', x: g.x, y: g.y - 8, r: 50 + g.n * 10, n: 12 + g.n * 2, seed: Math.random() * 6.28, dur: 0.35 });
      if (this.clock - (this.epicT || -9) > 6) { this.epicT = this.clock; this.slowmo(0.45, 0.4); }
    }
  }
  onPlayerHurt(p, cause, info) {
    if (!this.demo) Settings.haptic(45);
    Playtest.hurt(this, p, cause, info);
    this.freeze(0.08); this.shake(4); this.hurtFlash = 0.35; Sound.duck(0.6, 0.5);
    Sound.play('hurt', 1, 0.75); Sound.play('metal', 0.6, 0.6);
    FX.blood(p.cx, p.cy, info.dirX || 0, 6);
  }
  // directional camera jolt (recoil); scaled by the shake setting
  kick(dx, dy = 0) {
    const k = SHAKE_LEVELS[Save.data.shake == null ? 2 : Save.data.shake] * TUNE.kickMul;
    if (TUNE.camNew) { this.camKick(dx * k, dy * k); return; } // a soft push (src/camera.js)
    this.cam.kx = clamp(this.cam.kx + dx * k, -6, 6); this.cam.ky = clamp(this.cam.ky + dy * k, -6, 6);
  }

  onTileDestroyed(cx, cy, t, src) {
    // breaking into the secret vault (its cracked roof, a wall, the floor) shows it
    const sc = this.secret && this.terrain.mask && this.secret.c;
    if (sc && cx >= sc.x0 - 1 && cx <= sc.x1 + 1 && cy >= sc.y0 - 1 && cy <= sc.y1 + 1) this.terrain.unmask();
    // a plank gone = the whole rope bridge goes
    for (const b of this.bridges) if (b.has(cx, cy)) b.snap(this, src === 'explosion' ? this.blastOwner || 'n' : src === 'melee' ? 'p' : 'n');
    const d = TDEF[t];
    const px = cx * TILE + 8, py = cy * TILE + 8;
    FX.debris(px, py, this.debrisColors(d.debris), src === 'explosion' ? 2 : 5, src === 'explosion' ? 1.3 : 0.8);
    if (FX.quality > 1 || Math.random() < 0.5) FX.rubble(px, py, this.debrisColors(d.debris), src === 'explosion' ? 2 : 1, src === 'explosion' ? 1.2 : 0.7); // chunks that stay a while
    if (src !== 'explosion') { FX.dust(px, py + 6, 2); Sound.play('crumble', this.volAt(px, py) * 0.35); }
    if (d.drop === 'ammo') this.props.push(new Pickup(px, py + 6, Math.random() < 0.12 ? 'bonus' : 'ammo'));
  }

  // A freed prisoner either brings a fallen co-op partner back, or becomes
  // the rescuer's new hero (+1 life), exactly like the original's bro swap.
  rescue(p, x, feetY) {
    if (!p || p.dead) return;
    this.rescued++;
    Playtest.use('rescue', p);
    this.score += 1000;
    const unlocked = this.demo ? [] : Save.addRescue();
    const waiting = this.players.find((q) => q.dead && q.waiting);
    let np;
    const fresh = unlocked.length ? unlocked[0] : null;
    if (waiting) {
      const id = fresh || this.randomHero(waiting.slot);
      if (fresh) this.lastHero[waiting.slot] = fresh;
      np = new Player(this, id, x, feetY, waiting.slot);
      np.vy = -200; np.inv = 1.6; np.onGround = false; np.face = p.face; np.cheerT = 1.1 * TUNE.poseTime;
      this.setPlayer(np);
      this.heroCard(id, waiting.slot, 'P' + (waiting.slot + 1) + ' IS BACK!');
    } else {
      this.lives = Math.min(this.lives + 1, 9);
      if (p.mech) {
        // a pilot keeps the mech: the prisoner just adds a life
        np = p; p.cheerT = 1.1 * TUNE.poseTime;
      } else {
        const id = fresh || this.randomHero(p.slot);
        if (fresh) this.lastHero[p.slot] = fresh;
        np = new Player(this, id, p.cx, p.y + p.h, p.slot);
        np.vx = p.vx; np.vy = -170; np.face = p.face; np.inv = 1.2; np.onGround = false; np.cheerT = 1.1 * TUNE.poseTime;
        this.setPlayer(np);
        this.stopLoops(p.slot);
        this.heroCard(id, p.slot, fresh ? 'NEW HERO!' : 'RESCUED!');
      }
    }
    FX.addEffect({ type: 'flash', x: np.cx, y: np.cy, r: 22, dur: 0.15 });
    for (let i = 0; i < 24; i++) FX.spawn(np.cx, np.cy, rand(-160, 160), rand(-220, -40), rand(0.6, 1.2), 2, pick(['#ffd23a', '#7cff7c', '#5ab4ff', '#ff6a8a', '#ffffff']), PF.GRAV | PF.FLICKER);
    Sound.play('rescue');
    for (const hid of unlocked) {
      this.unlockedNow.push(hid);
      Funnel.ev('hero', hid, 'unlocked');
      this.schedule(1.0, () => Sound.play('unlock')); // (named on the mission complete screen)
    }
  }
  freePrisoner(x, feetY) { this.props.push(new Prisoner(x, feetY)); }

  pickup(pk, p) {
    p = p || this.player;
    if (!p) return;
    if (pk.kind === 'bonus') {
      p.pocket = pick(Object.keys(POCKET_ITEMS));
      Playtest.use('gold crate', p);
      this.score += 250;
      Sound.play('unlock');
      return;
    }
    p.specials = p.maxSpecials();
    if (p.hp < p.maxHp) p.hp++;
    this.score += 100;
    Sound.play('pickup');
  }

  onFlag(flag) {
    Playtest.flag(this, flag);
    for (const q of this.players) if (!q.dead && Math.abs(q.cx - flag.px) < 40) q.cheerT = 0.9 * TUNE.poseTime; // a fist in the air (1.32)
    if (flag.kind === 'checkpoint') {
      this.checkpoint = { x: flag.px, y: flag.gy };
      this.score += 250;
      Sound.play('checkpoint');
    } else {
      this.checkpoint = { x: flag.px, y: flag.gy };
      Sound.play('checkpoint');
      this.state = 'extract'; this.extracting = true;
      this.reinforce = 2 + Math.round(this.diff * 5) + (this.numPlayers - 1) * 2; this.reinforceT = 1.2;
      this.schedule(3.2, () => this.callExtraction(flag.px + 20, flag.gy));
    }
  }

  callExtraction(x, gy) {
    const tx = clamp(x, this.cam.x + 60, this.cam.x + Gfx.W - 40);
    // separate slot from the drop choppers, so a respawn can never replace the evac ride
    this.evac = new Chopper(this, 'extract', tx, gy - 80, () => this.onExtracted());
    this.announce('GET ON THE LADDER!', '#ffd23a', 2, 1);
  }

  onExtracted() {
    if (this.state === 'leaving' || this.state === 'complete') return;
    this.state = 'leaving';
    this.completeT = 0;
    this.cinema(3.6); // the base goes up in a letterboxed shot
    Sound.play('win');
    Sound.stopWeaponLoops();
    for (const e of this.enemies) if (!e.isBoss) e.awake = false;
    this.finale = { n: 0, next: 0.35, camX: this.cam.x, camY: this.cam.y };
  }

  onBossDestroyed(boss) {
    this.bossDone = true; this.bossActive = false; this.camLock = null;
    this.freeze(0.12); this.slowmo(1.6, 0.3);
    this.score += 10000;
    this.kills++;
    this.props.push(new Wreck(boss));
    if (!this.demo) Settings.haptic([90, 50, 180]);
    FX.megaBlast(boss.cx, boss.cy);
    for (const q of this.players) if (!q.dead) q.cheerT = 1.8 * TUNE.poseTime;
    this.cinema(2.8);
    this.radioSay(GRIMM_BOSS_DOWN[boss.type], 2.2);
    if (!this.demo) Platform.happyTime();
    if (this.state !== 'gameover' && !this.demo) Music.play('action', THEME_TRANSPOSE[this.def.theme] || 0);
    for (const e of this.enemies) if (!e.dead && !e.isBoss) e.hurt(99, { kind: 'explosion', dirX: 0 });
    this.extracting = true;
    // a simultaneous last-life death must keep the Game Over screen (continueGame restores 'extract')
    if (this.state !== 'gameover') this.state = 'extract';
    this.schedule(2.2, () => {
      const p = this.nearestPlayer(boss.cx, boss.cy);
      const px = p ? p.cx : this.cam.x + Gfx.W / 2;
      const gy = this.terrain.groundBelow(px, (p ? p.y : this.cam.y) - 10, 400) || this.arena.g * TILE;
      this.callExtraction(px, gy);
    });
  }

  // ------------------------------------------------------------ combat
  explode(x, y, r, o = {}) {
    const T = this.terrain;
    const owner = o.owner || 'n';
    if (owner === 'p' && !o.env) r *= TUNE.blastMul * (1 + 0.3 * (this.mods.blast || 0)); // BIG BOOM
    const dmg = o.dmg != null ? o.dmg : 10;
    const tileDmg = o.tileDmg != null ? o.tileDmg : 40;
    const ev = o.ev || ++this.evSeq;
    const prevOwner = this.blastOwner;
    this.blastOwner = owner; // who broke what (bridges)
    const cr = Math.ceil(r / TILE) + 1, ccx = Math.floor(x / TILE), ccy = Math.floor(y / TILE);
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
      const cx = ccx + dx, cy = ccy + dy;
      const d = Math.hypot(cx * TILE + 8 - x, cy * TILE + 8 - y);
      if (d > r + 6) continue;
      const f = 1 - d / (r + 6);
      T.damage(cx, cy, tileDmg * (0.35 + 0.65 * f), 'explosion');
      if (Math.random() < (o.fire ? 0.35 : 0.06)) T.ignite(cx, cy);
    }
    const hit = (u, isPlayer) => {
      const ux = u.x + u.w / 2, uy = u.y + u.h / 2;
      const d = Math.max(0, Math.hypot(ux - x, uy - y) - Math.min(u.w, u.h) / 2);
      if (d > r) return;
      const f = 1 - d / r;
      const dirX = ux >= x ? 1 : -1;
      const force = 140 + 260 * f;
      if (isPlayer) {
        if (owner === 'p' || u.inv > 0 || u.roid > 0 || u.state === 'dash' || u.state === 'stomp') {
          // your own blasts only shove you - point-blank they launch you (rocket / grenade jumps)
          if (u.state !== 'extract') {
            u.vx += dirX * force * 0.5; u.vy = Math.max(-420, Math.min(u.vy, -force * (owner === 'p' ? TUNE.blastJump : 0.45)));
            u.onGround = false; if (u.state === 'slide') u.state = 'normal';
          }
          return;
        }
        u.kill('explosion', { dirX, force, dmg: f > 0.55 ? 2 : 1, src: o.src || (owner === 'e' ? 'enemy blast' : 'blast') });
        return;
      }
      u.hurt(dmg * (0.5 + 0.5 * f), { kind: 'explosion', dirX, force, team: owner, ev, env: o.env, style: o.style, x, y });
    };
    for (const p of this.players) if (!p.dead) hit(p, true);
    for (const e of this.enemies) if (!e.dead) hit(e, false);
    for (const pr of this.props) if (!pr.dead && pr.hurt) hit(pr, false);
    for (const c of this.corpses) if (!c.dead) hit(c, false);
    // beyond the blast's reach, its shove: soldiers stagger back - their shot spoiled, some
    // tumble off a ledge - and bodies and barrels get pushed
    const R = r * 1.6;
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.def.static || e.def.heavy || e.para) continue;
      const ux = e.x + e.w / 2, uy = e.y + e.h / 2, d = Math.hypot(ux - x, uy - y);
      if (d <= r || d > R) continue;
      const f = 1 - (d - r) / (R - r), dir = ux >= x ? 1 : -1;
      e.vx += dir * 140 * f;
      if (e.onGround) { e.vy = Math.min(e.vy, -70 * f); e.onGround = false; }
      e.stun = Math.max(e.stun || 0, 0.1 + 0.25 * f); e.aimT = 0; e.burst = 0; e.awake = true;
      e.flinchT = Math.max(e.flinchT || 0, 0.15 + 0.2 * f); // staggered (1.32)
    }
    for (const c of this.corpses) {
      const d = Math.hypot(c.x + 6 - x, c.y + 3 - y);
      if (d <= r || d > R || c.dead) continue;
      const f = 1 - (d - r) / (R - r);
      c.vx += (c.x + 6 >= x ? 1 : -1) * 150 * f; c.vy = Math.min(c.vy, -110 * f); c.onGround = false;
    }
    this.fuel.igniteCircle(x, y, r, owner);
    // a big blast near the hero is felt too (phones)
    if (r >= 30 && !this.demo && this.clock - (this.hapT || -9) > 0.15 && this.players.some((q) => !q.dead && Math.abs(q.cx - x) < 150 && Math.abs(q.cy - y) < 110)) { this.hapT = this.clock; Settings.haptic(r >= 44 ? 40 : 22); }
    this.blastOwner = prevOwner;
    for (const pr of this.props) {
      if ((pr instanceof Pickup || pr instanceof Prisoner) && Math.hypot(pr.x - x, pr.y - y) < r) { pr.vy = -200; pr.vx += (pr.x > x ? 1 : -1) * 80; }
      else if (pr.isCage && !pr.dead && Math.hypot(pr.x + 8 - x, pr.y + 13 - y) < r * 2.5 + 30) pr.cowerT = 1.1; // the man inside ducks (1.32)
    }
    FX.explosion(x, y, r, { gy: T.groundBelow(x, y - 6, r + 20), fire: o.fire || o.env });
    FX.impulse(x, y, r * 1.4, Math.min(1.5, r / 30)); // the blast scatters the brass and rubble lying around
    if (!o.small) FX.debris(x, y, this.debrisColors('dirt'), 6, 1.2);
    if (!o.quiet) this.shake(Math.min(10, r / 4.5));
    if (r >= 36 && this.onScreen(x, y, 40)) this.freeze(r >= 50 ? 0.07 : 0.045);
    Sound.play(r > 22 ? 'explosion' : 'smallboom', this.volAt(x, y), r >= 44 ? 0.8 : 1);
    if (this.onScreen(x, y, 40)) { this.heat = Math.min(1, this.heat + 0.25); if (r >= 34) Sound.duck(0.55, 0.45); }
    this.noise(x, y, r * 5);
    if (r >= 36) this.flashT = Math.max(this.flashT, 0.05);
  }

  noise(x, y, r) {
    for (const e of this.enemies) {
      if (e.dead || !e.awake) continue;
      if (Math.abs(e.cx - x) < r && Math.abs(e.cy - y) < r * 0.6) e.hearNoise(x, y);
    }
  }

  // o.soft: light debris (bridge planks) that never crushes a hero; o.style: the kill's name
  // falling debris: soldiers get flattened; a hero takes a hit point and a shove clear of the fall
  // (an instant death from a block nobody saw coming reads as unfair). Returns true when it landed
  // on a hero, so the block can break up instead of setting in the ground on top of him
  crush(x, y, w, h, o) {
    let hero = false;
    if (!o || !o.soft) {
      for (const p of this.players) {
        if (p.dead || !rectsOverlap(x, y, w, h, p.x, p.y, p.w, p.h)) continue;
        hero = true;
        p.kill('crush', { dirX: Math.sign(p.cx - (x + w / 2)) || -p.face, force: 240, dmg: 1, src: 'falling block' });
      }
    }
    for (const e of this.enemies) if (!e.dead && !e.isBoss && rectsOverlap(x, y, w, h, e.x, e.y, e.w, e.h)) e.hurt(99, { kind: 'crush', dirX: 0, team: 'p', style: o ? o.style : null });
    for (const o of this.props) if (o instanceof Barrel && !o.dead && rectsOverlap(x, y, w, h, o.x, o.y, o.w, o.h)) o.hurt(5, { kind: 'crush' });
    return hero;
  }

  firebomb(x, y, team) {
    this.explode(x, y, 20, { owner: team, dmg: 4, tileDmg: 8, small: true });
    const gy = this.terrain.groundBelow(x, y - 8, 80);
    this.props.push(new FirePatch(x, gy !== null ? gy : y, 80, 3.4, team));
    const T = this.terrain;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) T.ignite(Math.floor(x / TILE) + dx, Math.floor(y / TILE) + dy);
    Sound.play('flameTick', 1);
  }

  airstrike(x, team) {
    Sound.play('rocket', 1);
    for (let i = 0; i < 5; i++) {
      this.schedule(0.35 + i * 0.14, () => {
        const mx = x + (i - 2) * 22 + rand(-6, 6);
        this.projectiles.push(new Projectile({ x: mx, y: this.cam.y - 20, vx: rand(-10, 10), vy: 520, kind: 'missile', team, sprite: Sprites.props.missile, radius: 34, explodeDmg: 12, explodeTile: 45, life: 3 }));
      });
    }
  }

  thunderstorm(caster) {
    const c = caster || this.player;
    const targets = this.enemies.filter((e) => !e.dead && e.hittable && this.onScreen(e.cx, e.cy, 8));
    if (c) targets.sort((a, b) => Math.abs(a.cx - c.cx) - Math.abs(b.cx - c.cx));
    const list = targets.slice(0, 14), ev = ++this.evSeq;
    this.flashT = 0.12;
    this.shake(4);
    const n = Math.max(list.length, 4);
    for (let i = 0; i < n; i++) {
      this.schedule(0.05 + i * 0.07, () => {
        const e = list[i];
        let tx, ty;
        if (e && !e.dead) { tx = e.cx; ty = e.y + e.h; }
        else { tx = c ? c.cx + c.face * rand(40, 180) : this.cam.x + rand(0, Gfx.W); ty = this.terrain.groundBelow(tx, this.cam.y, 500) || this.cam.y + Gfx.H; }
        this.bolt(tx + rand(-20, 20), this.cam.y - 10, tx, ty);
        this.bolt(tx + rand(-20, 20), this.cam.y - 10, tx, ty);
        if (e && !e.dead) e.hurt(5, { kind: 'shock', dirX: 0, force: 40, team: 'p', ev });
        this.explode(tx, ty - 4, 12, { owner: 'p', dmg: 3, tileDmg: 12, small: true });
        Sound.play('zap', 1);
      });
    }
  }

  updateCoach(dt) {
    const c = this.coach, p = this.player;
    if (!p || p.dead || this.state !== 'play') return;
    c.t += dt;
    if (c.x0 == null) c.x0 = p.x;
    if (c.step === 'move' && Math.abs(p.x - c.x0) > 24) c.step = 'shoot';
    if (c.step === 'shoot') {
      // only once a target is in sight ahead: the barrels or a soldier
      c.target = this.props.find((o) => o instanceof Barrel && !o.dead && (o.x - p.cx) * p.face > 0 && Math.abs(o.x - p.cx) < 300) ||
        this.enemies.find((e) => !e.dead && (e.cx - p.cx) * p.face > 0 && Math.abs(e.cx - p.cx) < 260 && Math.abs(e.cy - p.cy) < 40) || null;
      if (this.kills > 0 || this.projectiles.some((q) => q.team === 'p')) c.step = 'jump';
    }
    if (c.step === 'jump') {
      c.stuck = p.onGround && p.touchingWall(p.face) ? c.stuck + dt : 0;
      if (!p.onGround && p.vy < -60) c.step = 'done';
    }
    if (c.step === 'done') this.coach = null;
  }
  // the first mission's prompt for right now ('move' / 'shoot' / 'jump'); the HUD shows it as keys
  // over the hero's head
  coachStep() {
    const c = this.coach, p = this.player;
    if (!c || !p || p.dead || this.state !== 'play') return null;
    if (c.step === 'move') return c.t > 0.3 ? 'move' : null;
    if (c.step === 'shoot') return c.target ? 'shoot' : null;
    if (c.step === 'jump') return c.stuck > 0.35 ? 'jump' : null;
    return null;
  }

  // ------------------------------------------------------------ perks and the rule of the day
  // what a kill sets off: HEAVY METAL (the soldier blows up), CHAIN LIGHTNING, VAMPIRE
  killEffects(e, info) {
    const m = this.mods;
    if (e.isBoss) return;
    if (m.heavy) {
      const x = e.cx, y = e.cy;
      FX.addEffect({ type: 'flash', x, y, r: 6, dur: 0.3 });
      Sound.play('beep', this.volAt(x, y) * 0.7, 1.4);
      this.schedule(0.35, () => this.explode(x, y, 20, { owner: 'p', dmg: 6, tileDmg: 12, env: true, src: 'blast' }));
    }
    if (m.chain && !info.perk) this.schedule(0.05, () => this.zapFrom(e.cx, e.cy, m.chain));
    if (m.vampire && ++this.vampKills >= VAMPIRE_EVERY[Math.min(2, m.vampire)]) {
      this.vampKills = 0;
      const p = this.nearestPlayer(e.cx, e.cy);
      if (p && !p.dead && !p.mech && p.hp < p.maxHp) { p.hp++; Sound.play('pickup', 0.8, 1.3); }
    }
  }
  // CHAIN LIGHTNING: a bolt jumps from the fallen soldier to the nearest ones in sight
  zapFrom(x, y, n) {
    const ev = ++this.evSeq, hit = [];
    let from = [x, y];
    for (let i = 0; i < n; i++) {
      let best = null, bd = 95;
      for (const e of this.enemies) {
        if (e.dead || !e.hittable || e.isBoss || hit.includes(e)) continue;
        const d = dist(from[0], from[1], e.cx, e.cy);
        if (d < bd && this.terrain.los(from[0], from[1], e.cx, e.cy)) { bd = d; best = e; }
      }
      if (!best) return;
      hit.push(best);
      this.bolt(from[0], from[1], best.cx, best.cy);
      best.hurt(2, { kind: 'shock', dirX: best.cx >= from[0] ? 1 : -1, force: 50, team: 'p', ev, perk: true });
      FX.sparks(best.cx, best.cy, 4);
      from = [best.cx, best.cy];
    }
  }
  // BARREL RAIN: every few seconds a barrel drops from the sky onto a soldier in view
  // (never over a hero); it lands whole, ready to be shot
  updateBarrelRain(dt) {
    this.rainT -= dt;
    if (this.rainT > 0) return;
    this.rainT = rand(3, 5);
    const c = this.enemies.filter((e) => !e.dead && !e.isBoss && !e.def.static && this.onScreen(e.cx, e.cy, -16) &&
      this.players.every((p) => p.dead || Math.abs(p.cx - e.cx) > 48));
    if (!c.length) return;
    const e = pick(c), x = e.cx + rand(-10, 10), y = this.cam.y - 4;
    if (this.terrain.solidAt(x, y) || this.terrain.solidAt(x, y + 14)) return;
    const b = new Barrel(x, y + 14); b.vy = 80; b.rain = true;
    this.props.push(b);
    Sound.play('whistle', this.volAt(x, e.cy) * 0.7);
  }

  // SECRET: a glint rises from the cracked roof now and then; found when a hero drops into the vault
  updateSecret(dt) {
    const s = this.secret;
    if ((s.glintT -= dt) <= 0) {
      s.glintT = rand(2.2, 3.6);
      const x = rand(s.x0 + 2, s.x1 - 2), y = s.y0 - TILE;
      if (this.onScreen(x, y, 0)) FX.spawn(x, y + 1, 0, -14, 0.6, 1, '#fff4a0', PF.FLICKER | PF.ADD, 3);
    }
    for (const p of this.players) {
      if (p.dead || p.cx < s.x0 || p.cx > s.x1 || p.cy < s.y0 - 2 || p.cy > s.y1) continue;
      s.found = true; p.cheerT = 1.2 * TUNE.poseTime;
      this.score += 1000; if (!this.demo) Meta.add(50);
      if (!this.arcade && !this.daily && this.levelIndex >= 0) { (Save.data.secrets || (Save.data.secrets = {}))[this.levelIndex] = 1; Save.save(); }
      Sound.play('unlock'); this.freeze(0.05);
      for (let i = 0; i < 18; i++) FX.spawn(p.cx + rand(-10, 10), p.cy, rand(-90, 90), rand(-160, -40), rand(0.6, 1.1), 2, '#ffd23a', PF.GRAV | PF.FLICKER);
      break;
    }
  }

  // ------------------------------------------------------------ chatter
  // The cast's lines are colour, never the news: one line on screen at a time, a breath between two,
  // and none over a call the player has to act on or over what just killed the hero
  quiet() { return !this.bubbles.length && !this.radio && !this.messages.length && this.hushT <= 0; }
  // a line in a speech bubble over a hero or a soldier - dropped when someone else is talking
  say(who, text, dur = 1.5) {
    if (this.demo || !this.quiet()) return;
    this.bubbles.push({ who, text, t: 0, dur });
  }
  // soldiers shout now and then (spotting you, panicking, throwing, charging) - never a wall of text
  chatter(e, kind) {
    if (this.chatT > 0 || e.isBoss || !this.onScreen(e.cx, e.cy, -8)) return;
    const lines = ENEMY_LINES[kind];
    if (!lines || Math.random() > (kind === 'spot' || kind === 'panic' ? 0.35 : 0.75)) return;
    this.chatT = rand(2.6, 4.2);
    this.say(e, pick(lines), 1.3);
  }
  // General Grimm on the radio: his line waits for a quiet moment - and is dropped if none comes
  radioSay(text, delay = 0) {
    if (!text || this.demo) return;
    this.schedule(delay, () => { this.radioQ = { text, wait: 6 }; });
  }
  updateChatter(dt) {
    if (this.chatT > 0) this.chatT -= dt;
    if (this.bragT > 0) this.bragT -= dt;
    if (this.hushT > 0) this.hushT -= dt;
    if (this.bubbles.length) {
      for (const b of this.bubbles) b.t += dt;
      this.bubbles = this.bubbles.filter((b) => b.t < b.dur && !b.who.dead);
      if (!this.bubbles.length) this.hushT = Math.max(this.hushT, 1.5);
    }
    if (this.radio && (this.radio.t += dt) > this.radio.dur) { this.radio = null; this.hushT = Math.max(this.hushT, 1.5); }
    const q = this.radioQ;
    if (q && (q.wait -= dt) <= 0) this.radioQ = null;
    else if (q && this.quiet()) {
      this.radioQ = null;
      this.radio = { text: 'GRIMM: ' + q.text, t: 0, dur: 2.6 + q.text.length * 0.05 };
      Sound.play('radio', 0.45);
    }
  }
  // a label over the world (a speech bubble) moves up clear of the sign boards it would cover
  clearOfSigns(x, y, w, h, cx, cy) {
    for (let k = 0; k < 3; k++) {
      let moved = false;
      for (const o of this.props) {
        if (!(o instanceof Sign) || Math.abs(o.x - cx - x) > 220) continue;
        const b = o.board(cx, cy);
        if (b && x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) { y = b.y - h - 2; moved = true; }
      }
      if (!moved) break;
    }
    return y;
  }
  // the line in a white bubble over the speaker - on the HUD layer, in the HUD's finer pixels
  drawBubbles(cx, cy) {
    const H = Hud, u = H.u, F = H.F;
    for (const b of this.bubbles) {
      if (b.t > b.dur - 0.2 && ((b.t * 20) | 0) % 2) continue;
      const who = b.who, w = H.tw(b.text) + 8 * u, h = 13 * u, hx = Math.round((who.x + who.w / 2 - cx) * F);
      const x = clamp(Math.round(hx - w / 2), 2 * u, H.canvas.width - w - 2 * u);
      const gy = this.clearOfSigns(x / F, who.y - cy - 8 - h / F + (b.t < 0.1 ? (0.1 - b.t) * 30 : 0), w / F, h / F + 3, cx, cy);
      const y = Math.round(gy * F);
      b.y = gy; // (the HUD keeps its key prompts above it)
      H.R(x - u, y - u, w + 2 * u, h + 2 * u, H.ink); H.R(x, y, w, h, '#ffffff');
      // the tail points at the speaker
      const tx = clamp(hx, x + 2 * u, x + w - 4 * u);
      H.R(tx, y + h, 2 * u, 2 * u, '#ffffff'); H.R(tx - u, y + h, u, 3 * u, H.ink); H.R(tx + 2 * u, y + h, u, 2 * u, H.ink);
      H.text(b.text, x + 4 * u, y + 3 * u, H.ink);
    }
  }

  // freeze frames sell impacts; slow-mo for the big moments (boss kill, a hero's death)
  freeze(t) { this.hitstop = Math.max(this.hitstop || 0, t); }
  slowmo(dur, scale) { this.slowT = dur; this.slowScale = scale; }

  // ------------------------------------------------------------ update
  update(dt) {
    this.lerpSnap(); // where everything is before this step: the screen is drawn between steps (src/camera.js)
    dt *= TUNE.timeScale * (this.mods.pace || 1); // DOUBLE TIME
    if (this.hitstop > 0) { this.hitstop -= dt; this.updateCamera(dt); return; }
    if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowScale; }
    const done = this.state === 'complete' || this.state === 'gameover';
    if (!done && this.state !== 'leaving' && this.state !== 'rail') this.time += dt;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    if (this.state === 'rail') this.updateRail(dt);
    if (this.secret && !this.secret.found) this.updateSecret(dt);
    if (this.cine && (this.cine.t += dt / (this.slowT > 0 ? this.slowScale : 1)) > this.cine.dur) this.cine = null;
    if (this.doom) this.updateDoom(dt);
    if (this.coach) this.updateCoach(dt);
    if (this.mods.barrels && this.state === 'play') this.updateBarrelRain(dt);
    this.updateChatter(dt);
    if (this.lockMsgT > 0) this.lockMsgT -= dt;
    if (this.goal === 'target' && !this.goalDone && this.target && this.target.dead) this.onTargetDown(this.target);

    const edt = this.warpT > 0 ? dt * 0.28 : dt;
    if (this.warpT > 0) this.warpT -= dt;
    for (const p of this.players) p.update(dt);
    for (const e of this.enemies) e.update(edt);
    for (const pr of this.projectiles) pr.update(pr.team === 'e' ? edt : dt, this);
    for (const dc of this.decoys) dc.update(dt);
    if (this.decoys.length) this.decoys = this.decoys.filter((dc) => !dc.dead);
    for (const o of this.props) o.update(dt, this);
    this.fuel.update(dt);
    armyUpdate(this, dt);
    for (const f of this.falling) f.update(dt, this);
    for (const c of this.corpses) c.update(dt, this);
    for (const ch of this.choppers) ch.update(dt, this);
    if (this.evac) { this.evac.update(dt, this); if (this.evac.dead) this.evac = null; }
    this.terrain.update(dt, FX);
    FX.update(dt);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projectiles = this.projectiles.filter((q) => !q.dead);
    this.props = this.props.filter((o) => !o.dead);
    this.falling = this.falling.filter((f) => !f.dead);
    this.corpses = this.corpses.filter((c) => !c.dead);
    this.choppers = this.choppers.filter((c) => !c.dead);
    if (this.corpses.length > 40) this.corpses.splice(0, this.corpses.length - 40);
    if (this.projectiles.length > 400) this.projectiles.splice(0, this.projectiles.length - 400);

    this.clock += dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.kfT > 0) this.kfT -= dt;
    // combat heat drives the music: calm while exploring, fuller once shots fly
    let fight = false;
    for (const e of this.enemies) if (!e.dead && (e.state === 'attack' || e.aimT > 0) && this.onScreen(e.cx, e.cy, 60)) { fight = true; break; }
    this.heat = clamp(this.heat + (fight ? dt * 1.2 : -dt * 0.2), 0, 1);
    if (!this.demo) Music.intensity = this.bossActive ? 1 : this.heat;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.card) { this.card.t += dt / (this.slowT > 0 ? this.slowScale : 1); if (this.card.t > 2.1) this.card = null; }
    for (const p of this.players) if (p.flyHint > 0) p.flyHint -= dt;
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);

    // death & respawn (shared pool of lives)
    if (!done) {
      for (const p of this.players) {
        if (!p.dead || p.handled) continue;
        p.deadT -= dt;
        if (p.deadT > 0) continue;
        p.handled = true;
        this.lastHero[p.slot] = p.hero.id;
        if (this.lives > 0) { this.lives--; this.dropHeroes([p.slot]); }
        else if (this.numPlayers > 1) {
          p.waiting = true;
          if (this.alivePlayers().length) this.announce('FREE A PRISONER TO REVIVE P' + (p.slot + 1) + '!', '#ffd23a', 2.2, 1);
        }
      }
      const everyoneDown = this.players.length > 0 && this.players.every((p) => p.dead && p.handled);
      if (everyoneDown && this.dropQueue.size === 0 && this.lives <= 0) {
        this.state = 'gameover'; this.completeT = 0; Sound.play('lose'); if (!this.demo) Music.stop();
      }
    }

    // boss trigger
    if (this.arena && !this.bossActive && !this.bossDone && this.alivePlayers().some((p) => p.cx > this.arena.x0 + 4 * TILE)) {
      this.startBoss();
    }

    // reinforcements while waiting for extraction
    if (this.state === 'extract' && this.reinforce > 0 && !(this.evac && this.evac.state !== 'in')) {
      this.reinforceT -= dt;
      if (this.reinforceT <= 0) {
        this.reinforceT = rand(1.1, 1.9);
        this.reinforce--;
        const side = Math.random() < 0.75 ? 1 : -1;
        const x = side > 0 ? this.cam.x + Gfx.W + 12 : this.cam.x - 12;
        if (x > 8 && x < this.terrain.w * TILE - 8) {
          const gy = this.terrain.groundBelow(x, this.cam.y, Gfx.H + 200);
          if (gy !== null) {
            const type = pick(['grunt', 'grunt', 'bomber', 'bomber', this.def.pool.dog ? 'dog' : 'grunt']);
            this.enemies.push(new Enemy(this, type, x, gy, { alert: true, face: -side }));
          }
        }
      }
    }

    if (this.state === 'leaving') {
      this.completeT += dt;
      this.updateFinale(dt);
      if (this.completeT > 2.9) { this.state = 'complete'; this.completeT = 0; }
    } else if (done) this.completeT += dt;

    Playtest.tick(this, dt);
    Funnel.tick(this);
    this.updateCamera(dt);
    Atmos.update(dt, this);
  }

  startBoss() {
    this.bossActive = true;
    const s = this.bossSpawn, a = this.arena;
    let b;
    if (s.type === 'tank') b = new TankBoss(this, s.x, s.y, a);
    else if (s.type === 'gunship') b = new GunshipBoss(this, s.x, s.y, a);
    else b = new MechBoss(this, s.x, s.y, a);
    // co-op bosses get tougher
    if (this.numPlayers > 1) { b.hp = b.maxHp = Math.round(b.maxHp * 1.5); }
    this.boss = b;
    this.enemies.push(b);
    this.camLock = { x0: a.x0, x1: a.x1 };
    this.cinema(2.6); this.slowmo(1.1, 0.45); // it rolls in like in a film
    this.radioSay(GRIMM_BOSS[b.type], 3.2);
    if (!this.demo) Music.play('boss', 0);
  }

  // Look-ahead (1.25.1): the view shows more of the side the hero heads to, but it follows where
  // the hero runs, not where it faces - turning around to shoot behind doesn't move the view - and
  // a real change of direction (0.25 s of running the other way) slides it over in camTurn seconds
  // (it used to whip ~130 px across in 0.2 s, up to 9 px a frame)
  camLead(alive, dt) {
    const c = this.cam, L = Math.round(Gfx.W * TUNE.camLead / 100);
    if (alive.length !== 1) { c.lead = approach(c.lead || 0, 0, 200 * dt); return c.lead; }
    const p = alive[0];
    if (c.leadDir == null) c.leadDir = p.face;
    const md = Math.abs(p.vx) > 40 && !p.wall ? Math.sign(p.vx) : 0;
    if (md && md !== c.leadDir) { c.leadT = (c.leadT || 0) + dt; if (c.leadT > 0.25) { c.leadDir = md; c.leadT = 0; } }
    else c.leadT = 0;
    c.lead = approach(c.lead == null ? c.leadDir * L : c.lead, c.leadDir * L, 2 * L / Math.max(0.05, TUNE.camTurn) * dt);
    return c.lead;
  }
  // The height the camera keeps for a hero: the ground it last stood on, so a jump doesn't bob
  // the view (it moved ~40 px with every jump). Falling below that ground, or rising more than
  // camJump above it (a blast jump, the jetpack), is followed
  camFeet(p) {
    const feet = p.y + p.h, band = TUNE.camJump;
    if (p.camY == null || p.onGround || p.state === 'ladder' || p.wall || band <= 0) p.camY = feet;
    else if (feet > p.camY) p.camY = feet;
    else if (feet < p.camY - band) p.camY = feet + band;
    return p.camY;
  }
  // the 1.29 camera (TUNE.camNew = 0, for comparison); the current one is in src/camera.js
  updateCameraOld(dt) {
    const vw = Gfx.W, vh = Gfx.H, c = this.cam;
    const alive = this.alivePlayers();
    let tx, ty;
    if (alive.length) {
      let minX = Infinity, maxX = -Infinity, sy = 0;
      for (const p of alive) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w); sy += this.camFeet(p); }
      tx = (minX + maxX) / 2 + this.camLead(alive, dt) - vw / 2;
      if (alive.length > 1) tx = Math.min(Math.max(tx, maxX + 6 - vw), minX - 6); // keep both heroes in shot
      ty = sy / alive.length - vh * 0.6;
      this.focus.x = (minX + maxX) / 2; this.focus.y = sy / alive.length;
    } else if (this.rail) {
      tx = this.rail.x; ty = this.railCamY(this.rail.x);
    } else if (this.state === 'leaving' && this.finale) {
      // hold the shot on the base while it blows up; the chopper flies out of frame
      tx = this.finale.camX + this.completeT * 20; ty = this.finale.camY;
    } else if (this.players.some((p) => p.state === 'extract') && this.evac) {
      tx = this.evac.x - vw / 2; ty = this.evac.y + 70 - vh * 0.6;
    } else if (this.players.some((p) => p.dead && !p.handled && p.deadT > 0.6)) {
      // a hero just went down: hold the shot on the spot (the body, the words over it) before
      // looking for the ride back in
      tx = this.focus.x - vw / 2; ty = this.focus.y - vh * 0.6;
    } else if (this.choppers.length) {
      const ch = this.choppers[this.choppers.length - 1];
      tx = ch.x - vw / 2; ty = ch.y + 70 - vh * 0.6;
    } else {
      tx = this.focus.x - vw / 2; ty = this.focus.y - vh * 0.6;
    }
    const k = 1 - Math.exp(-dt * 5), ky = 1 - Math.exp(-dt * 3.5);
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * ky;
    let minX = 0, maxX = this.terrain.w * TILE - vw;
    if (this.camLock) { minX = Math.max(minX, this.camLock.x0); maxX = Math.min(maxX, this.camLock.x1 - vw); }
    if (maxX < minX) maxX = minX;
    c.x = clamp(c.x, minX, maxX);
    c.y = clamp(c.y, 0, Math.max(0, this.terrain.h * TILE - vh));
    c.kx *= Math.exp(-dt * 16); c.ky *= Math.exp(-dt * 16);
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt * 22);
      const s = c.shake;
      c.sx = (Math.random() * 2 - 1) * s * 0.6; c.sy = (Math.random() * 2 - 1) * s * 0.6;
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
  }

  // ------------------------------------------------------------ draw
  draw(ctx) {
    const vw = Gfx.W, vh = Gfx.H;
    const { x: cx, y: cy } = this.viewCam(); // whole pixels, with the shake (src/camera.js)
    this.drawBackground(ctx, cx, cy, vw, vh);
    Atmos.drawBack(ctx);
    this.drawDecor(ctx, cx, cy, vw);
    this.terrain.draw(ctx, cx, cy, vw, vh);
    this.fuel.draw(ctx, cx, cy, vw);
    for (const o of this.props) o.draw(ctx, cx, cy);
    for (const c of this.corpses) c.draw(ctx, cx, cy);
    for (const f of this.falling) f.draw(ctx, cx, cy);
    for (const e of this.enemies) {
      if (e.x + e.w < cx - 40 || e.x > cx + vw + 40) continue;
      e.draw(ctx, cx, cy);
    }
    for (const dc of this.decoys) dc.draw(ctx, cx, cy);
    for (const p of this.players) p.draw(ctx, cx, cy);
    for (const p of this.players) if (p.carry && !p.carry.dead && !p.dead) p.carry.draw(ctx, cx, cy, true);
    if (!this.demo) this.drawBubbles(cx, cy);
    if (this.rail) this.drawRail(ctx, cx, cy);
    if (this.numPlayers > 1) {
      for (const p of this.players) {
        if (p.dead) continue;
        Hud.otext('P' + (p.slot + 1), (p.cx - cx) * Hud.F, (p.y - cy - 16) * Hud.F, PLAYER_COLORS[p.slot], 'center');
      }
    }
    for (const ch of this.choppers) ch.draw(ctx, cx, cy);
    if (this.evac) this.evac.draw(ctx, cx, cy);
    for (const pr of this.projectiles) pr.draw(ctx, cx, cy);
    FX.draw(ctx, cx, cy, vw, vh);
    worldLights(this, cx, cy, vw, vh);
    FX.drawLights(ctx, cx, cy, vw, vh);
    FX.drawEffects(ctx, cx, cy);
    Atmos.drawFront(ctx);
    if (this.doom && this.doom.on) this.drawDoom(ctx, cx, vw, vh);
    if (this.theme.fog) { ctx.fillStyle = this.theme.fog; ctx.fillRect(0, 0, vw, vh); }
    if (this.warpT > 0) {
      const a = Math.min(1, this.warpT * 2) * 0.22;
      ctx.fillStyle = 'rgba(90,100,220,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = 'rgba(160,170,255,' + (a * 1.6).toFixed(3) + ')'; ctx.fillRect(0, 0, vw, 2); ctx.fillRect(0, vh - 2, vw, 2);
    }
    if (!this.demo) this.drawPointer(ctx, cx, cy, vw, vh);
    if (this.flashT > 0 && !FX.calm) { ctx.fillStyle = 'rgba(255,248,230,0.3)'; ctx.fillRect(0, 0, vw, vh); }
    Atmos.vignette(ctx);
    if (this.hurtFlash > 0) {
      const a = Math.min(1, this.hurtFlash / 0.35) * (FX.calm ? 0.5 : 1); // reduced flashing: only a soft red frame
      if (!FX.calm) { ctx.fillStyle = 'rgba(255,30,20,' + (0.16 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, vw, vh); }
      ctx.fillStyle = 'rgba(255,30,20,' + (0.55 * a).toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, 4); ctx.fillRect(0, vh - 4, vw, 4); ctx.fillRect(0, 0, 4, vh); ctx.fillRect(vw - 4, 0, 4, vh);
    }
    this.drawHUD(ctx, vw, vh);
  }

  drawBackground(ctx, cx, cy, vw, vh) {
    const th = this.theme;
    if (!this.sky || this.skyH !== vh) {
      this.skyH = vh;
      this.sky = makeCanvas(1, vh);
      const sx = this.sky.getContext('2d');
      const g = sx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, th.skyTop); g.addColorStop(1, th.skyBot);
      sx.fillStyle = g; sx.fillRect(0, 0, 1, vh);
    }
    ctx.drawImage(this.sky, 0, 0, vw, vh);
    const sunX = Math.round(vw * 0.72 - cx * 0.02), sunY = Math.round(vh * 0.2 + (430 - cy) * 0.03);
    ctx.drawImage(circleSprite(th.sun, 14), sunX - 14, sunY - 14);
    const refCamY = 30 * TILE - vh * 0.62;
    const layers = [[this.par.far, 0.08, 0.6, th.far], [this.par.mid, 0.2, 0.74, th.mid], [this.par.near, 0.36, 0.9, th.near]];
    for (const [img, f, base, col] of layers) {
      const off = -Math.round((cx * f) % 512);
      const bottom = Math.round(vh * base + (refCamY - cy) * f * 0.9);
      const top = bottom - img.height;
      for (let x = off; x < vw; x += 512) ctx.drawImage(img, x, top);
      if (bottom < vh) { ctx.fillStyle = col; ctx.fillRect(0, bottom, vw, vh - bottom); }
    }
  }

  drawDecor(ctx, cx, cy, vw) {
    const D = Sprites.decor, T = this.terrain;
    for (const d of this.decor) {
      if (d.dead) continue;
      if (d.x < cx - 40 || d.x > cx + vw + 40) continue;
      if (!T.solidAt(d.x, d.y + 2)) {
        d.dead = true;
        FX.debris(d.x, d.y - 8, ['#2f6a1c', '#4f9a2c', '#7a5838'], 8, 0.7);
        continue;
      }
      const set = D[d.name];
      const img = set[d.v % set.length];
      ctx.drawImage(img, Math.round(d.x - img.width / 2 - cx), Math.round(d.y - img.height + 2 - cy));
    }
  }

  // cinema bars: the big moments (a boss rolling in, a boss going down, the base blowing up) and
  // the fly-in are letterboxed like a film
  cinema(dur) { this.cine = { t: 0, dur }; }
  drawCinema(ctx, vw, vh) {
    let h = this.rail ? 10 : 0;
    const c = this.cine;
    if (c) h = Math.max(h, Math.round(16 * Math.max(0, Math.min(1, c.t / 0.3, (c.dur - c.t) / 0.45))));
    if (h <= 0) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, h); ctx.fillRect(0, vh - h, vw, h);
  }

  drawHUD(ctx, vw, vh) {
    this.drawCamFade(ctx, vw, vh); // a respawn far away: a dip to black
    this.drawCinema(ctx, vw, vh);
    // the title draws its own logo and menu over the demo
    if (this.demo) return;
    // the call of the moment, under the strips at the top - on the HUD layer (src/hud.js), like the
    // rest of what's written
    const F = Hud.F, u = Hud.u, mx = Hud.canvas.width / 2;
    let my = Math.max(Math.round(vh * 0.26 * F), Hud.top ? Hud.top + 4 * u : 0), mw = 0;
    const my0 = my;
    for (const m of this.messages) {
      const k = m.t / m.dur, s = Math.max(1, Math.round(u * [1, 1.4, 2, 2.6][m.size]));
      mw = Math.max(mw, Font.width(m.text, s));
      if (!(k > 0.85 && ((m.t * 20) | 0) % 2)) {
        const pop = m.t < 0.15 ? easeOutBack(m.t / 0.15) : 1;
        Hud.otext(m.text, mx, my, m.color, 'center', Math.max(1, Math.round(s * pop)));
      }
      my += 9 * s + 4 * u;
    }
    // where it is (in game pixels), so the keys over a hero don't cover it
    this.msgBand = my > my0 ? { x0: (mx - mw / 2) / F - 2, x1: (mx + mw / 2) / F + 2, y0: my0 / F - 2, y1: my / F } : null;
    if (this.rail) this.drawRailHud(ctx, vw, vh);
    Hud.drawWorld(this);
  }
}
