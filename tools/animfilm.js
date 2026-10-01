// Dev-only (never shipped): film strips of character moments (1.32) - a run of frames around one
// character, side by side, to check an animation's timing. Needs tools/harness.js first:
//   const s = document.createElement('script'); s.src = '/tools/animfilm.js'; document.body.appendChild(s);
//   await FILM.scene('grunt')      -> %TEMP%/blast_shots/film_grunt.png
// Every scene starts a fresh mission 1, clears the soldiers, and stages one moment next to the hero.
/* eslint-disable no-undef */
window.FILM = {
  // step n frames; every `every` frames grab a w x h box around who() (world coords of its feet)
  async strip(name, n, every, who, opts = {}) {
    const W = window.world, S = opts.S || 4, w = opts.w || 56, h = opts.h || 44, cols = Math.ceil(n / every);
    const c = document.createElement('canvas'); c.width = cols * w * S; c.height = (h + 8) * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#20202a'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0, k = 0; i < n; i++) {
      if (opts.before) opts.before(i);
      Input.poll(); App.update(STEP);
      if (i % every) continue;
      App.draw(Gfx.ctx);
      const v = W.view || W.cam, o = who();
      if (!o) break;
      const sx = Math.round(o[0] - v.x - w / 2), sy = Math.round(o[1] - v.y - h + 8);
      x.drawImage(Gfx.canvas, sx, sy, w, h, k * w * S, 8 * S, w * S, h * S);
      x.save(); x.scale(S, S); Font.draw(x, (i / 60).toFixed(2) + (opts.tag ? ' ' + opts.tag(i) : ''), k * w + 2, 1, '#ffffff'); x.restore();
      x.fillStyle = '#000'; x.fillRect((k + 1) * w * S - 1, 0, 1, c.height);
      k++;
    }
    const r = await fetch('/__shot?name=film_' + name, { method: 'POST', body: c.toDataURL('image/png') });
    return r.text();
  },
  // a fresh mission 1 with the hero standing on flat ground, no soldiers, nothing hurting him
  stage(level = 0) {
    Save.data.favorite = 'havoc';
    TT.start(level);
    const W = window.world, p = W.player;
    W.enemies.length = 0; W.props = W.props.filter((o) => !(o instanceof Barrel) && !o.isCage);
    p.kill = () => false; p.inv = 0;
    for (const k in Input.kb) Input.kb[k] = false;
    W.coach = null; W.messages.length = 0; W.intelCard = null; W.tip = null; W.radio = null; W.card = null;
    Save.data.tips = Object.assign(Save.data.tips || {}, { e_grunt: 1, e_bomber: 1, e_grenadier: 1, e_rpg: 1, e_heavy: 1, e_shield: 1, e_scout: 1, e_mortar: 1, e_sniper: 1, e_flamer: 1, e_officer: 1, e_dog: 1, e_turret: 1, e_truck: 1 });
    TT.step(20);
    return { W, p };
  },
  spawn(type, dx, opts = {}) {
    const W = window.world, p = W.player, x = p.cx + dx;
    const gy = W.terrain.groundBelow(x, p.y - 40, 200);
    const e = new Enemy(W, type, x, gy == null ? p.y + p.h : gy, Object.assign({ awake: true, face: dx > 0 ? -1 : 1 }, opts));
    W.enemies.push(e);
    return e;
  },
  feet(o) { return () => (o.dead ? null : [o.x + o.w / 2, o.y + o.h]); },
  pair(a, b) { return () => [(a.x + a.w / 2 + b.x + b.w / 2) / 2, Math.max(a.y + a.h, b.y + b.h)]; },
  // walk the hero into a boss arena, wait for the fight, then film the boss
  async boss(level, name, tag, n = 420, every = 7) {
    const { W, p } = this.stage(level);
    const a = W.arena;
    p.x = a.x0 + 7 * TILE; p.y = a.g * TILE - p.h - 2; p.vy = 0;
    for (let i = 0; i < 600 && !(W.boss && W.boss.state === 'fight'); i++) { Input.poll(); App.update(STEP); }
    const b = W.boss;
    if (!b) return 'no boss';
    W.messages.length = 0;
    return this.strip(name, n, every, () => (b.dead ? null : [b.x + b.w / 2, b.y + b.h + 4]), { w: 150, h: 100, S: 3, tag: () => tag(b) });
  },
  async scene(name) {
    const S = this.scenes[name];
    if (!S) return 'no scene ' + name;
    return S.call(this);
  },
  scenes: {
    // the hero: run, turn (skid), jump (apex), land, shoot standing (recoil), knife
    async hero() {
      const { p } = this.stage();
      return this.strip('hero', 150, 4, this.feet(p), {
        before: (i) => {
          Input.kb.right = i < 40; Input.kb.left = i >= 40 && i < 52;
          if (i === 60) { Input.latch.jump = true; Input.kb.jump = true; } if (i === 76) Input.kb.jump = false;
          Input.kb.fire = i >= 108 && i < 124;
          if (i === 136) Input.latch.melee = true, Input.kb.melee = true; if (i === 138) Input.kb.melee = false;
        },
        tag: () => p.animFrame() === p.gfx.pose('skid') ? 'SKID' : '',
      });
    },
    // standing about: the fidgets
    async idle() {
      const { p } = this.stage();
      TT.step(200);
      return this.strip('idle', 240, 10, this.feet(p));
    },
    // a grunt spots the hero: the start and hop, the aim, the burst, the reload
    async grunt() {
      const { p } = this.stage();
      const e = this.spawn('grunt', 110);
      e.state = 'idle'; e.stateT = 9; e.face = -1;
      return this.strip('grunt', 240, 6, this.feet(e), { tag: () => e.state.slice(0, 4) + (e.aimT > 0 ? ' A' : '') + (e.reloadT > 0 ? ' R' : '') });
    },
    async grenadier() {
      this.stage();
      const e = this.spawn('grenadier', 100, { alert: true });
      return this.strip('grenadier', 150, 5, this.feet(e), { tag: () => (e.windT > 0 ? 'WIND' : e.throwT > 0 ? 'THROW' : '') });
    },
    async mortar() {
      this.stage();
      const e = this.spawn('mortar', 130, { alert: true });
      e.cd = 0.2;
      return this.strip('mortar', 150, 5, this.feet(e), { tag: () => (e.windT > 0 ? 'WIND' : e.earsT > 0 ? 'EARS' : '') });
    },
    async sniper() {
      this.stage();
      const e = this.spawn('sniper', 150, { alert: true });
      e.cd = 0;
      return this.strip('sniper', 200, 8, this.feet(e), { tag: () => (e.snipeT > 0 ? 'AIM' : e.boltT > 0 ? 'BOLT' : '') });
    },
    async flamer() {
      this.stage();
      const e = this.spawn('flamer', 60, { alert: true });
      e.cd = 0;
      return this.strip('flamer', 150, 6, this.feet(e));
    },
    async officer() {
      this.stage();
      const e = this.spawn('officer', 150, { alert: true });
      e.strikeCd = 0;
      return this.strip('officer', 120, 6, this.feet(e), { tag: () => (e.callT > 0 ? 'CALL' : '') });
    },
    async shield() {
      const { p } = this.stage();
      const e = this.spawn('shield', 30, { alert: true });
      e.cd = 0;
      return this.strip('shield', 90, 3, this.feet(e), { tag: () => (e.bashT > 0 ? 'BRACE' : e.throwT > 0 ? 'BASH' : '') });
    },
    async dog() {
      const { p } = this.stage();
      const e = this.spawn('dog', 140);
      e.state = 'patrol'; e.stateT = 1;
      return this.strip('dog', 150, 5, this.feet(e));
    },
    async heavy() {
      this.stage();
      const e = this.spawn('heavy', 120, { alert: true });
      e.cd = 0;
      return this.strip('heavy', 180, 6, this.feet(e), { tag: () => (e.aimT > 0 ? 'AIM' : e.burst > 0 ? 'FIRE' : e.smokeT > 0 ? 'SMOKE' : '') });
    },
    async bomber() {
      this.stage();
      const e = this.spawn('bomber', 170, { alert: true });
      return this.strip('bomber', 100, 4, this.feet(e));
    },
    async panic() {
      const { W, p } = this.stage();
      const a = this.spawn('grunt', 60, { alert: true }), b = this.spawn('grenadier', 80, { alert: true });
      TT.step(2);
      W.scare(p.cx + 40, p.cy, 120, 1.5);
      return this.strip('panic', 90, 3, this.feet(a));
    },
    // a hard landing among soldiers: flat on their backs, then up
    async knockdown() {
      const { W, p } = this.stage();
      const a = this.spawn('grunt', 30), b = this.spawn('rpg', -30);
      p.y -= 150; p.apexY = p.y; p.vy = 0; p.onGround = false;
      return this.strip('knockdown', 90, 3, this.feet(a), { w: 140 });
    },
    // the hero goes down: the soldiers cheer; the hat flies
    async cheer() {
      const { W, p } = this.stage();
      const a = this.spawn('grunt', 70, { alert: true }), b = this.spawn('grunt', 100, { alert: true }), d = this.spawn('dog', -60, { alert: true });
      TT.step(30);
      delete p.kill; p.inv = 0; p.hp = 1; W.lives = 3;
      p.kill('shot', { dirX: -1, src: 'grunt' });
      return this.strip('cheer', 150, 5, this.feet(a), { w: 180 });
    },
    // soldiers dying: the flinch in the air, then limp; hats fly
    async deaths() {
      const { W, p } = this.stage();
      const a = this.spawn('grunt', 50, { alert: true }), b = this.spawn('heavy', 90, { alert: true });
      TT.step(4);
      a.hurt(99, { kind: 'bullet', dirX: 1, force: 120, team: 'p' });
      b.hurt(99, { kind: 'explosion', dirX: 1, force: 300, team: 'p' });
      return this.strip('deaths', 120, 4, () => [p.cx + 80, p.y + p.h], { w: 150 });
    },
    // a prisoner in his cage: slumped, waving as the hero comes, jumping, ducking a blast
    async cage() {
      const { W, p } = this.stage();
      const c = new Cage(p.cx + 150, p.y + p.h); W.props.push(c);
      return this.strip('cage', 240, 8, this.feet(c), {
        before: (i) => { Input.kb.right = i > 40 && i < 110; if (i === 170) W.explode(c.x + 30, c.y + 10, 20, { owner: 'p', dmg: 0, tileDmg: 0, small: true, quiet: true }); },
        tag: () => c.mood.slice(0, 5),
      });
    },
    // a prisoner freed from afar: runs to his rescuer
    async freed() {
      const { W, p } = this.stage();
      W.props.push(new Prisoner(p.cx + 120, p.y + p.h));
      const q = W.props[W.props.length - 1];
      return this.strip('freed', 120, 5, () => [p.cx + 60, p.y + p.h], { w: 170 });
    },
    // a turret turns round (the barrel pulls in), then fires (the barrel kicks back)
    async turret() {
      this.stage();
      const e = this.spawn('turret', 90);
      e.face = 1; // its back to the hero
      return this.strip('turret', 150, 5, this.feet(e), { tag: () => (e.turnT > 0 ? 'TURN' : e.aimT > 0 ? 'AIM' : e.burst > 0 ? 'FIRE' : '') });
    },
    // bosses (1.32): the telegraphs before each attack
    async tank() { return this.boss(4, 'tank', (b) => (b.warmT > 0 ? 'WARM' : b.mgWarnT > 0 ? 'MG!' : b.recoilT > 0 ? 'KICK' : '')); },
    async gunship() { return this.boss(9, 'gunship', (b) => (b.podT > 0 ? 'POD' : b.bayT > 0 ? 'BAY' : b.mode.slice(0, 5))); },
    async mech() { return this.boss(14, 'mech', (b) => (b.action || '') + (b.stagger > 0 ? ' ST' : '')); },
    // the walker's leap and its flamer, forced one after the other
    async mechmoves() {
      let b = null;
      const orig = this.strip;
      this.strip = function (name, n, every, who, opts) {
        b = window.world.boss; b.atkCd = 99;
        const before = (i) => { if (i === 5) { b.action = 'stomp'; b.actT = 0; } if (i === 150) { b.action = 'flame'; b.actT = 0; b.stagger = 0; } };
        return orig.call(this, 'mechmoves', 260, 5, who, Object.assign({}, opts, { before }));
      };
      try { return await this.boss(14, 'mech', (bb) => (bb.action || '') + (bb.stagger > 0 ? ' ST' : '') + (bb.landSq > 0 ? ' SQ' : '')); } finally { this.strip = orig; }
    },
    // a paratrooper drifts down, lands in a crouch; the canopy comes down after him
    async para() {
      const { W, p } = this.stage();
      const e = this.spawn('grunt', 90, { para: true });
      e.y -= 60;
      return this.strip('para', 150, 5, () => [e.x + e.w / 2, p.y + p.h], { h: 110 });
    },
  },
};
