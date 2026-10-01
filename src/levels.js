'use strict';
// ============================================================================
//  Campaign definition + procedural level generator (segments + prefabs)
// ============================================================================

const LEVELS = [
  { name: 'WAKE-UP CALL', theme: 'jungle', len: 118, diff: 0.0, pool: { grunt: 10 }, cages: 3, tutorial: true },
  // teach: set pieces placed early so the mission introduces them (with on-screen hints)
  { name: 'MUDSLIDE', theme: 'jungle', len: 150, diff: 0.1, pool: { grunt: 10, bomber: 3 }, cages: 4, teach: ['bridge', 'fuel'] },
  { name: 'HOT PURSUIT', goal: 'escape', theme: 'jungle', len: 150, diff: 0.2, pool: { grunt: 10, bomber: 3, dog: 3 }, cages: 4 },
  { name: 'TIGER CLAW', goal: 'target', theme: 'jungle', len: 175, diff: 0.3, pool: { grunt: 10, bomber: 3, dog: 2, grenadier: 3, shield: 1, flamer: 1 }, cages: 5, mini: 'jugger' },
  { name: 'STEEL RAIN', theme: 'jungle', len: 90, diff: 0.3, pool: { grunt: 10, bomber: 2, grenadier: 2 }, cages: 2, boss: 'tank' },
  { name: 'SANDSTORM', flyin: true, goal: 'depots', theme: 'desert', len: 170, diff: 0.4, pool: { grunt: 10, bomber: 3, grenadier: 3, rpg: 2, shield: 2, sniper: 1, flamer: 1 }, cages: 5, trucks: true },
  { name: 'DRY BONES', mech: true, mini: 'dozer', theme: 'desert', len: 180, diff: 0.45, pool: { grunt: 10, bomber: 3, dog: 3, grenadier: 2, rpg: 2, shield: 2, mortar: 1, sniper: 1, officer: 1 }, cages: 5, turrets: true, trucks: true },
  { name: 'SCORPION NEST', tank: true, goal: 'target', theme: 'desert', len: 185, diff: 0.5, pool: { grunt: 10, bomber: 3, dog: 2, grenadier: 3, rpg: 2, heavy: 1, shield: 2, mortar: 1, sniper: 2, flamer: 1, officer: 1 }, cages: 5, turrets: true, trucks: true },
  { name: 'MIRAGE', goal: 'escape', theme: 'desert', len: 170, diff: 0.55, pool: { grunt: 9, bomber: 3, dog: 2, grenadier: 3, rpg: 3, heavy: 2, shield: 3, mortar: 1, sniper: 1, flamer: 2, officer: 1 }, cages: 6, turrets: true },
  { name: 'DUST DEVIL', theme: 'desert', len: 90, diff: 0.55, pool: { grunt: 10, rpg: 2, bomber: 3 }, cages: 2, boss: 'gunship' },
  { name: 'COLD FEET', flyin: true, mech: true, mini: 'jugger', goal: 'depots', theme: 'arctic', len: 180, diff: 0.6, pool: { grunt: 10, bomber: 3, dog: 3, grenadier: 3, rpg: 2, heavy: 1, shield: 2, mortar: 2, sniper: 2, flamer: 1, officer: 1 }, cages: 5, turrets: true, trucks: true },
  { name: 'AVALANCHE', tank: true, goal: 'escape', theme: 'arctic', len: 170, diff: 0.7, pool: { grunt: 9, bomber: 4, dog: 3, grenadier: 3, rpg: 3, heavy: 2, shield: 3, mortar: 1, sniper: 1, flamer: 2, officer: 1 }, cages: 6, turrets: true },
  { name: 'WHITEOUT', mech: true, goal: 'target', theme: 'arctic', len: 195, diff: 0.8, pool: { grunt: 8, bomber: 4, dog: 3, grenadier: 3, rpg: 3, heavy: 2, shield: 3, mortar: 2, sniper: 2, flamer: 2, officer: 2 }, cages: 6, turrets: true, trucks: true },
  { name: 'DEEP FREEZE', mech: true, mini: 'dozer', theme: 'arctic', len: 200, diff: 0.9, pool: { grunt: 8, bomber: 4, dog: 4, grenadier: 4, rpg: 3, heavy: 3, shield: 3, mortar: 2, sniper: 2, flamer: 2, officer: 2 }, cages: 6, turrets: true, trucks: true },
  { name: 'LAST STAND', theme: 'arctic', len: 100, diff: 0.9, pool: { grunt: 8, bomber: 4, heavy: 2, rpg: 2, flamer: 1 }, cages: 2, boss: 'mech' },
];

// Player-chosen difficulty (Save.data.difficulty): tunes lives, enemy reflexes,
// bullet speed, fire rate and enemy density.
const DIFFICULTY = [
  { id: 'recruit', name: 'RECRUIT', lives: 2, hp: 3, react: 1.45, aim: 1.35, bullet: 0.85, cd: 1.35, density: 0.8, score: 0.8 },
  { id: 'soldier', name: 'SOLDIER', lives: 0, hp: 2, react: 1, aim: 1, bullet: 1, cd: 1, density: 1, score: 1 },
  { id: 'veteran', name: 'VETERAN', lives: -2, hp: 1, react: 0.72, aim: 0.75, bullet: 1.12, cd: 0.8, density: 1.25, score: 1.5 },
];
function currentSkill() {
  const i = (typeof Save !== 'undefined' && Save.data) ? Save.data.difficulty : 1;
  return DIFFICULTY[i == null ? 1 : clamp(i, 0, DIFFICULTY.length - 1)];
}

// ---------------------------------------------------------------------------
//  Arcade: an endless chain of generated missions, tougher every stage
// ---------------------------------------------------------------------------
const ARCADE_WORDS = [
  ['IRON', 'BLOOD', 'THUNDER', 'SCARLET', 'SILENT', 'BURNING', 'STEEL', 'MIDNIGHT', 'RAGING', 'CRIMSON', 'SAVAGE', 'ATOMIC', 'BROKEN', 'RED', 'WILD'],
  ['VIPER', 'HAMMER', 'FALCON', 'STORM', 'JACKAL', 'COBRA', 'RHINO', 'TIGER', 'HORNET', 'WOLF', 'ANVIL', 'SPEAR', 'MAMBA', 'BADGER', 'THUNDERBOLT'],
];
function arcadeDef(stage, runSeed) {
  const r = new RNG(runSeed * 7 + stage * 131);
  const themes = ['jungle', 'desert', 'arctic'];
  const theme = themes[Math.floor((stage - 1) / 3) % 3];
  const pool = { grunt: 10 };
  if (stage >= 2) pool.bomber = 3;
  if (stage >= 3) pool.dog = 2;
  if (stage >= 4) pool.grenadier = 3;
  if (stage >= 5) pool.rpg = 2;
  if (stage >= 7) pool.heavy = 1 + Math.floor(stage / 8);
  if (stage >= 4) pool.shield = stage >= 8 ? 3 : 2;
  if (stage >= 6) pool.mortar = stage >= 10 ? 2 : 1;
  if (stage >= 4) pool.flamer = 1;
  if (stage >= 6) pool.sniper = stage >= 10 ? 2 : 1;
  if (stage >= 7) pool.officer = 1;
  const boss = stage % 5 === 0 ? ['tank', 'gunship', 'mech'][(stage / 5 - 1) % 3] : null;
  const goals = { extract: 3, target: 2, depots: 2 };
  if (stage >= 3) goals.escape = 1.5;
  const goal = boss ? null : stage === 1 ? 'extract' : r.weighted(goals);
  return {
    name: r.pick(ARCADE_WORDS[0]) + ' ' + r.pick(ARCADE_WORDS[1]), goal, mech: !boss && stage >= 5 && r.chance(0.4),
    tank: !boss && stage >= 4 && r.chance(0.3), flyin: !boss && stage > 1 && (stage - 1) % 3 === 0, // a new zone: fly in on the door gun
    theme, diff: Math.min(1, 0.05 + stage * 0.065), pool, turrets: stage >= 6, trucks: !boss && stage >= 6,
    len: boss ? 90 : Math.min(210, 135 + stage * 6), cages: boss ? 2 : 4, boss, arcade: true,
    mini: !boss && goal !== 'escape' && stage >= 3 && r.chance(0.35) ? (stage % 2 ? 'dozer' : 'jugger') : null, // a mini-boss on the way
  };
}

const ARENA_W = 46;
const MINH = 18, MAXH = 33;
const LEVEL_H = 44;
const STRUCT = new Set(['watchtower', 'steeltower', 'hut', 'bunker', 'temple', 'nest', 'barrels', 'mound', 'fuel', 'perch']);
const SEG_WEIGHTS = {
  jungle: { flat: 3, hills: 3, stepUp: 1.6, stepDown: 1.6, valley: 1.5, watchtower: 1.6, hut: 2.2, temple: 1.2, nest: 1.2, barrels: 1, mound: 1, bunker: 0.6, fuel: 0.6, perch: 0.6 },
  desert: { flat: 3, hills: 2, stepUp: 1.6, stepDown: 1.6, valley: 1.2, watchtower: 0.8, steeltower: 1.3, hut: 1.2, bunker: 1.8, nest: 1.6, barrels: 1.3, temple: 1, mound: 1, fuel: 1.3, perch: 1.1 },
  arctic: { flat: 3, hills: 3, stepUp: 2, stepDown: 2, valley: 1.5, steeltower: 1.6, bunker: 1.8, hut: 1.3, nest: 1.4, barrels: 1.1, mound: 1.2, fuel: 1, perch: 1 },
};

// Prefab legend:
//  .  untouched      W wood        P one-way platform   H ladder      B brick/concrete
//  S  steel          s sandbag     M metal roof         X stone       C ammo crate
//  _  air + interior background
//  markers (air): e enemy  t turret  k prisoner cage  a ammo  o barrel  f fuel drum
const PREFABS = {
  watchtower: { bg: 0, rows: [
    '.MMMMM.',
    '.W...W.',
    '.We.eW.',
    'PPPPPPP',
    '.W.H.W.',
    '.W.H.W.',
    '.W.H.W.',
    '.W.H.W.',
  ] },
  steeltower: { bg: 0, rows: [
    '.MMMMM.',
    '.S...S.',
    '.Se.eS.',
    'PPPHPPP',
    '.S.H.S.',
    '.SeH.S.',
    'PPPHPPP',
    '.S.H.S.',
    '.S.H.S.',
    '.S.H.S.',
  ] },
  hut: { bg: BG.WOOD, markerBg: true, rows: [
    '...MMMMM...',
    '..MMMMMMM..',
    '.MMMMMMMMM.',
    '..W_____W..',
    '..W_____W..',
    '.._e_a_eW..',
  ] },
  hutCage: { bg: BG.WOOD, markerBg: true, rows: [
    '...MMMMM...',
    '..MMMMMMM..',
    '.MMMMMMMMM.',
    '..W_____W..',
    '..W_____W..',
    '..We_k_e_..',
  ] },
  bunker: { bg: BG.BRICK, markerBg: true, sink: 2, rows: [
    '.....t......',
    'BBBBBBBBBBBB',
    'B__________B',
    '___________B',
    'B__e__k__e_B',
    'BBBBBBBBBBBB',
  ] },
  temple: { bg: BG.STONE, markerBg: true, rows: [
    '...XXXXXX...',
    '..XX____XX..',
    '..X_e__e_X..',
    '.XXXX__XXXX.',
    '.X________X.',
    '._e__k__o_X.',
  ] },
  nest: { bg: 0, rows: [
    's.....s',
    's.e.e.s',
  ] },
  // sniper's perch: an open platform on stilts - nothing blocks his laser, a ladder leads up to him
  perch: { bg: 0, rows: [
    '...e...',
    'PPPPPPP',
    '.W.H.W.',
    '.W.H.W.',
    '.W.H.W.',
    '.W.H.W.',
  ] },
  // command post: the colonel (G) holds the upper floor
  hq: { bg: BG.BRICK, markerBg: true, rows: [
    '...t......',
    'MMMMMMMMMM',
    'B________B',
    'B____G_e_B',
    'BHBBBBBBBB',
    '_H_______B',
    '_H__e_of_B',
  ] },
};

class LevelGen {
  // def: a LEVELS entry or a generated arcade mission; seed makes it deterministic
  constructor(def, seed) {
    this.L = def; this.seed = seed >>> 0;
    this.rng = new RNG(7777 + this.seed * 104729);
    this.H = LEVEL_H;
    this.heights = new Int16Array(600).fill(30);
    this.feats = []; this.stamps = []; this.ops = []; this.caves = []; this.flats = []; this.secret = null;
    this.noDecor = new Uint8Array(601);
    this.cagesLeft = this.L.cages;
    this.decor = [];
    this.arena = null; this.bossSpawn = null; this.spawn = null;
  }

  // ------------------------------------------------------------ helpers
  pickEnemy() { return this.rng.weighted(this.L.pool); }
  enemy(col, g, opts = {}) {
    if (col < 28 && !opts.force) return; // about one screen of breathing room after the drop
    if (col < 28 && opts.force && this.L.pool.dog && !this.L.tutorial) opts.type = opts.type || 'grunt';
    this.feats.push({ kind: 'enemy', type: opts.type || this.pickEnemy(), x: col * TILE + 8, y: g * TILE, guard: !!opts.guard, face: opts.face });
  }
  feat(kind, col, g, extra) { this.feats.push(Object.assign({ kind, x: col * TILE + 8, y: g * TILE }, extra || {})); }
  sign(col, g, key) { this.feats.push({ kind: 'sign', key, x: col * TILE + 8, y: g * TILE }); this.noDecor[col] = 1; }
  flat(x, w, g) { for (let i = 0; i < w; i++) this.heights[x + i] = g; }
  nd(x, w) { for (let i = 0; i < w; i++) this.noDecor[x + i] = 1; }
  budget(w) {
    const e = w / 10 * (0.75 + this.L.diff * 1.45) * currentSkill().density * (this.L.goal === 'escape' ? 0.7 : 1);
    const n = Math.floor(e);
    return n + (this.rng.chance(e - n) ? 1 : 0);
  }
  scatter(x, w, n) {
    for (let i = 0; i < n; i++) {
      const col = x + this.rng.int(1, Math.max(1, w - 2));
      this.enemy(col, this.heights[col]);
    }
  }
  cage(col, g) { this.feat('cage', col, g); this.cagesLeft--; }
  barrels(col, g, n) { for (let i = 0; i < n; i++) this.feat(this.rng.chance(0.2) ? 'propane' : 'barrel', col + i, g); }

  // ------------------------------------------------------------ segments
  segStart(x, g) {
    this.flat(x, 14, g);
    this.spawn = { x: (x + 4) * TILE + 8, y: g * TILE };
    return [x + 14, g];
  }
  segFlat(x, g, w, quiet) {
    w = w || this.rng.int(7, 12);
    this.flat(x, w, g);
    if (quiet) return [x + w, g];
    // a mini-boss (1.24) holds one wide flat stretch past the middle, alone but for a pair of
    // barrels in front of it (the dozer shoves them at you: shoot them when they're at its blade)
    if (this.L.mini && !this.miniPlaced && x >= (this.L.len || 150) * 0.55 && w >= 10) {
      this.miniPlaced = true;
      this.feat('miniboss', x + w - 3, g, { mb: this.L.mini });
      if (this.L.mini === 'dozer') this.barrels(x + w - 7, g, 2);
      else { this.feat('barrel', x + w - 4, g); this.feat('barrel', x + w - 2, g); } // right beside the juggernaut: one shot, two blasts
      this.nd(x, w);
      return [x + w, g];
    }
    if (w >= 6) this.flats.push({ x, w, g }); // a spot for the secret vault
    this.scatter(x, w, this.budget(w));
    if (this.rng.chance(0.3)) this.barrels(x + this.rng.int(2, w - 3), g, this.rng.int(1, 2));
    else if (this.rng.chance(0.1)) this.feat('drum', x + this.rng.int(2, w - 3), g);
    if (this.rng.chance(0.14)) this.ops.push(['crate', x + this.rng.int(1, w - 2), g - 1]);
    if (this.rng.chance(0.3)) this.caveUnder(x, w);
    if (this.L.diff >= 0.3 && x > 30 && this.rng.chance(0.3)) {
      for (let k = this.rng.int(1, 2); k > 0; k--) this.feat('mine', x + this.rng.int(1, w - 2), g);
    }
    // one parked vehicle (walker mech or tank) per mission that has one, about a third of the way in
    if ((this.L.mech || this.L.tank) && !this.mechPlaced && x >= (this.L.len || 150) * 0.28 && w >= 7) {
      this.mechPlaced = true;
      this.feat(this.L.tank ? 'tank' : 'mech', x + Math.floor(w / 2), g);
    }
    return [x + w, g];
  }
  segHills(x, g, w, quiet) {
    w = w || this.rng.int(9, 14);
    let h = g;
    for (let i = 0; i < w; i++) {
      if (i > 0 && i < w - 1 && i % 2 === 0 && this.rng.chance(0.55)) h = clamp(h + this.rng.pick([-1, 1]), Math.max(MINH, g - 2), Math.min(MAXH, g + 2));
      this.heights[x + i] = h;
    }
    if (!quiet) {
      this.scatter(x, w, this.budget(w));
      if (this.rng.chance(0.25)) this.caveUnder(x, w);
    } else if (quiet === 'one') this.enemy(x + w - 3, this.heights[x + w - 3], { type: 'grunt' });
    return [x + w, h];
  }
  segStep(x, g, dir, fixedK, quiet) {
    let k = fixedK || this.rng.int(2, 4);
    let ng = g - dir * k;
    if (ng < MINH || ng > MAXH) { ng = g + dir * k; dir = -dir; }
    if (ng < MINH || ng > MAXH) return this.segFlat(x, g);
    const w = this.rng.int(5, 8);
    const cliff = x + this.rng.int(2, w - 3);
    for (let i = 0; i < w; i++) this.heights[x + i] = (x + i < cliff) ? g : ng;
    this.noDecor[cliff] = 1; this.noDecor[cliff - 1] = 1;
    if (quiet) return [x + w, ng];
    if (k >= 3 && this.rng.chance(0.45)) {
      if (dir > 0) for (let r = ng; r < g; r++) this.ops.push(['ladder', cliff - 1, r]);
      else for (let r = g; r < ng; r++) this.ops.push(['ladder', cliff, r]);
    }
    if (this.rng.chance(0.6)) {
      const col = dir > 0 ? cliff + 1 : cliff - 2;
      this.enemy(col, this.heights[col], { guard: true, face: -1 });
    }
    return [x + w, ng];
  }
  segValley(x, g, forceRope) {
    const w = this.rng.int(9, 13);
    const roll = this.rng.next();
    // most crossings are rope bridges now (shoot a post and the span drops)
    if (forceRope || roll < 0.42) { const r = this.segRopeBridge(x, g, w); if (r) return r; }
    const floor = Math.min(g + this.rng.int(4, 6), LEVEL_H - 6);
    for (let i = 0; i < w; i++) this.heights[x + i] = (i < 2 || i >= w - 2) ? g : floor;
    const bridged = roll < 0.6; // the rest of the bridges: a plank trestle, sometimes over spikes
    if (bridged) {
      for (let c = x + 2; c < x + w - 2; c++) this.ops.push(['platform', c, g]);
      const mid = x + Math.floor(w / 2);
      for (let r = g + 1; r < floor; r++) this.ops.push(['wood', mid, r]);
      if (this.rng.chance(0.6)) this.enemy(x + 3 + this.rng.int(0, Math.max(0, w - 7)), g);
      // a spiked pit under the bridge: don't fall!
      if (this.L.diff >= 0.25 && this.rng.chance(0.5)) {
        const mid2 = x + Math.floor(w / 2);
        this.feat('spikes', x + 2, floor, { w: (mid2 - x - 2) * TILE });
        this.feat('spikes', mid2 + 1, floor, { w: (x + w - 3 - mid2) * TILE });
        this.nd(x, w);
        return [x + w, g];
      }
    }
    const fc = x + this.rng.int(3, w - 4);
    if (this.cagesLeft > 0 && this.rng.chance(0.3)) this.cage(fc, floor);
    else if (this.rng.chance(0.5)) this.barrels(fc, floor, 2);
    for (let i = 0; i < Math.max(0, this.budget(w) - 1); i++) this.enemy(x + this.rng.int(3, w - 4), floor);
    this.nd(x, w);
    return [x + w, g];
  }
  // Rope bridge over a ravine deep enough to kill a soldier who drops in (heroes
  // don't take fall damage); a ladder leads out on the far side.
  segRopeBridge(x, g, w) {
    const floor = Math.min(g + this.rng.int(7, 8), LEVEL_H - 5);
    if (floor - g < 6) return null;
    for (let i = 0; i < w; i++) this.heights[x + i] = (i < 2 || i >= w - 2) ? g : floor;
    const c0 = x + 2, c1 = x + w - 3;
    for (let c = c0; c <= c1; c++) this.ops.push(['platform', c, g]);
    for (let r = g + 1; r < floor; r++) this.ops.push(['ladder', c1, r]);
    this.feats.push({ kind: 'bridge', c0, c1, row: g, x: c0 * TILE, y: g * TILE });
    const n = 1 + (this.L.diff >= 0.3 ? 1 : 0) + (this.rng.chance(0.35) ? 1 : 0);
    for (let i = 0; i < n; i++) this.enemy(c0 + 1 + Math.floor((c1 - c0 - 1) * (i + 0.5) / n), g, { guard: true, force: true, face: -1 });
    this.nd(x, w);
    return [x + w, g];
  }
  // fuel dump: drums and a fuel pipe, with the guards standing right in it
  segFuel(x, g) {
    const w = 12;
    this.flat(x, w, g);
    this.feat('drum', x + 4, g);
    if (this.rng.chance(0.6)) this.feat('drum', x + 5, g);
    this.feat('pipe', x + 8, g);
    if (this.rng.chance(0.4)) this.barrels(x + 2, g, 1);
    this.enemy(x + 7, g, { guard: true, force: true, face: -1 });
    this.enemy(x + 10, g, { guard: true, force: true, face: -1 });
    this.nd(x, w);
    return [x + w, g];
  }
  segPrefab(x, g, name) {
    const pf = PREFABS[name];
    const w = pf.rows[0].length + 2;
    this.flat(x, w, g);
    this.stamps.push({ pf, x: x + 1, g });
    this.nd(x, w);
    // markers → features right away (so cage budgeting stays accurate)
    this.curPf = name;
    const h = pf.rows.length, top = g - h + (pf.sink || 0);
    pf.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) this.marker(row[c], x + 1 + c, top + r + 1);
    });
    return [x + w, g];
  }
  marker(ch, cx, feetRow) {
    switch (ch) {
      case 'e': this.enemy(cx, feetRow, { guard: true, force: true, type: this.curPf === 'perch' ? (this.L.pool.sniper ? 'sniper' : 'grunt') : undefined }); break;
      case 't':
        if (this.L.turrets) this.feat('turret', cx, feetRow);
        else this.enemy(cx, feetRow, { type: 'grunt', guard: true, force: true });
        break;
      case 'k': if (this.cagesLeft > 0) this.cage(cx, feetRow); else this.feat('ammo', cx, feetRow); break;
      case 'a': this.feat(this.rng.chance(0.25) ? 'bonus' : 'ammo', cx, feetRow); break;
      case 'G': this.enemy(cx, feetRow, { type: 'colonel', guard: true, force: true, face: -1 }); break;
      case 'o': this.feat('barrel', cx, feetRow); break;
      case 'f': this.feat('drum', cx, feetRow); break;
    }
  }
  segCage(x, g, quiet) {
    const w = 7;
    this.flat(x, w, g);
    this.cage(x + 3, g);
    if (!quiet) {
      const guards = this.rng.int(0, 1) + (this.L.diff > 0.2 ? 1 : 0);
      for (let i = 0; i < guards; i++) this.enemy(x + (i ? 5 : 1), g, { guard: true });
      if (this.rng.chance(0.4)) this.barrels(x + 5, g, 1);
    }
    this.nd(x, w);
    return [x + w, g];
  }
  segDepot(x, g) {
    const w = 10;
    this.flat(x, w, g);
    this.feat('depot', x + 5, g);
    this.feat('pipe', x + 3, g); // the depot's feed line: leak it, light it, the depot cooks
    this.ops.push(['sandbag', x + 1, g - 1], ['sandbag', x + 9, g - 1]);
    this.enemy(x + 2, g, { guard: true, force: true, face: -1 });
    if (this.rng.chance(0.6)) this.enemy(x + 8, g, { guard: true, force: true });
    this.nd(x, w);
    this.depotsLeft--;
    return [x + w, g];
  }
  segCheckpoint(x, g) {
    const w = 6;
    this.flat(x, w, g);
    this.feat('flag', x + 3, g, { flagKind: 'checkpoint' });
    this.nd(x, w);
    return [x + w, g];
  }
  segBarrels(x, g) {
    const w = 10;
    this.flat(x, w, g);
    this.barrels(x + 3, g, this.rng.int(3, 4));
    if (this.rng.chance(0.45)) this.feat('drum', x + 2, g);
    this.enemy(x + 1, g, { guard: true }); this.enemy(x + 8, g, { guard: true });
    if (this.rng.chance(0.5)) this.ops.push(['crate', x + 7, g - 1]);
    this.nd(x, w);
    return [x + w, g];
  }
  segMound(x, g) {
    const w = this.rng.int(7, 10), hgt = this.rng.int(2, 4);
    for (let i = 0; i < w; i++) this.heights[x + i] = (i >= 2 && i < w - 2) ? g - hgt : g;
    if (this.rng.chance(0.55)) {
      for (let c = x + 2; c < x + w - 2; c++) this.ops.push(['carve', c, g - 1]);
      this.enemy(x + Math.floor(w / 2), g, { guard: true });
    } else this.enemy(x + Math.floor(w / 2), g - hgt, { guard: true });
    this.nd(x, w);
    return [x + w, g];
  }
  // SECRET (1.23): one vault per mission just under a flat stretch - its roof a strip of
  // cracked topsoil that a jump, a stomp or a blast breaks through; a gold crate waits inside.
  // Not in the first stretch, not over a cave
  placeSecret() {
    const n = this.L.len || 150;
    // every 5-wide spot inside a flat stretch that stays clear of the caves (a cave deep enough below,
    // with solid ground between it and the vault's floor, is fine)
    const clear = (x0, g) => !this.caves.some((c) => c.x1 >= x0 - 1 && c.x0 <= x0 + 5 && c.y0 < g + 4);
    const spots = [];
    for (const f of this.flats) {
      if (f.x < Math.max(28, n * 0.2) || f.x + f.w > n * 0.92 || f.g + 4 >= LEVEL_H - 3) continue;
      for (let x0 = f.x + 1; x0 + 4 <= f.x + f.w - 1; x0++) {
        if (clear(x0, f.g)) spots.push({ x0, g: f.g });
      }
    }
    // no flat stretch to spare: any 5 columns of level natural ground (no structure, sign or placed
    // tile on it)
    if (!spots.length) {
      const blocked = new Set(this.ops.map((o) => o[1]));
      for (const s of this.stamps) for (let c = s.x - 1; c <= s.x + s.pf.rows[0].length; c++) blocked.add(c);
      for (const f of this.feats) if (f.kind === 'sign' || f.kind === 'flag' || f.kind === 'cage' || f.kind === 'depot') for (let c = -2; c <= 2; c++) blocked.add(Math.floor(f.x / TILE) + c);
      for (const f of this.feats) if (f.kind === 'miniboss') for (let c = -10; c <= 3; c++) blocked.add(Math.floor(f.x / TILE) + c);
      for (let x0 = Math.max(28, Math.floor(n * 0.2)); x0 + 5 < n * 0.92; x0++) {
        const g = this.heights[x0];
        let ok = g + 4 < LEVEL_H - 3;
        for (let k = 0; k < 5 && ok; k++) ok = this.heights[x0 + k] === g && !blocked.has(x0 + k);
        if (ok && clear(x0, g)) spots.push({ x0, g });
      }
    }
    if (!spots.length) return;
    const sp = spots[this.rng.int(0, spots.length - 1)], f = { g: sp.g }, x0 = sp.x0, x1 = x0 + 4;
    this.secret = { x0, x1, roof: f.g, y0: f.g + 1, y1: f.g + 2 };
    this.feat('bonus', x0 + 2, f.g + 3, { secret: true });
    this.feats.push({ kind: 'secret', x0, x1, y0: f.g + 1, y1: f.g + 2 });
    this.nd(x0, 5);
  }
  caveUnder(x, w) {
    if (w < 7) return;
    const cw = this.rng.int(5, Math.min(8, w - 1)), cx0 = x + this.rng.int(0, w - cw);
    let surf = 0;
    for (let i = cx0; i < cx0 + cw; i++) surf = Math.max(surf, this.heights[i]);
    const top = surf + this.rng.int(3, 5);
    if (top + 4 >= LEVEL_H - 3) return;
    this.caves.push({ x0: cx0, x1: cx0 + cw - 1, y0: top, y1: top + 1 });
    const floorRow = top + 2, mid = cx0 + (cw >> 1);
    if (this.cagesLeft > 0 && this.rng.chance(0.35)) this.cage(mid, floorRow);
    else this.feat(this.rng.chance(0.3) ? 'bonus' : 'ammo', mid, floorRow);
    if (this.rng.chance(0.6)) this.enemy(cx0 + 1, floorRow, { guard: true, force: true });
  }
  segExtract(x, g) {
    const w = 24;
    this.flat(x, w, g);
    this.scatter(x, 9, this.budget(10));
    this.feat('flag', x + w - 9, g, { flagKind: 'extract' });
    this.nd(x + w - 14, 14);
    if (this.L.tutorial) this.sign(x + w - 13, g, 'extract');
    return [x + w, g];
  }
  segArena(x, g) {
    const w = ARENA_W;
    this.flat(x, w, g);
    this.nd(x, w);
    this.arena = { x0: x * TILE, x1: (x + w) * TILE, g };
    const boss = this.L.boss;
    if (boss === 'tank') {
      this.ops.push(['sandbag', x + 9, g - 1], ['sandbag', x + 10, g - 1], ['sandbag', x + 22, g - 1]);
      for (let c = x + 14; c < x + 19; c++) this.ops.push(['platform', c, g - 4]);
      for (let r = g - 3; r < g; r++) { this.ops.push(['wood', x + 14, r]); this.ops.push(['wood', x + 18, r]); }
      this.bossSpawn = { type: boss, x: (x + w) * TILE - 94, y: g * TILE };
    } else if (boss === 'gunship') {
      for (const [p, hh] of [[7, 4], [19, 6], [31, 5]]) {
        for (let c = x + p; c < x + p + 3; c++) this.heights[c] = g - hh;
        for (let r = g - hh; r < g; r++) this.ops.push(['ladder', x + p - 1, r]);
      }
      this.bossSpawn = { type: boss, x: (x + w) * TILE + 20, y: g * TILE };
    } else {
      this.ops.push(['sandbag', x + 8, g - 1], ['sandbag', x + 26, g - 1], ['sandbag', x + 27, g - 1]);
      for (let c = x + 15; c < x + 20; c++) this.ops.push(['platform', c, g - 5]);
      this.ops.push(['ladder', x + 15, g - 1], ['ladder', x + 15, g - 2], ['ladder', x + 15, g - 3], ['ladder', x + 15, g - 4]);
      this.bossSpawn = { type: boss, x: (x + w) * TILE - 60, y: g * TILE };
    }
    return [x + w, g];
  }

  build(type, x, g) {
    switch (type) {
      case 'flat': return this.segFlat(x, g);
      case 'mini': return this.segFlat(x, g, 12);
      case 'hills': return this.segHills(x, g);
      case 'stepUp': return this.segStep(x, g, 1);
      case 'stepDown': return this.segStep(x, g, -1);
      case 'valley': return this.segValley(x, g);
      case 'cage': return this.segCage(x, g);
      case 'checkpoint': return this.segCheckpoint(x, g);
      case 'barrels': return this.segBarrels(x, g);
      case 'mound': return this.segMound(x, g);
      case 'depot': return this.segDepot(x, g);
      case 'hq': this.hqPlaced = true; return this.segPrefab(x, g, 'hq');
      case 'fuel': return this.segFuel(x, g);
      case 'ropeBridge': return this.segValley(x, g, true);
      case 'hut': return this.segPrefab(this.outpost(x, g), g, this.cagesLeft > 0 && this.rng.chance(0.4) ? 'hutCage' : 'hut');
      default: return this.segPrefab(this.outpost(x, g), g, type);
    }
  }

  // A siren post in front of some structures, watched by a radio lookout who
  // sprints for it when he spots you. Returns where the structure starts.
  outpost(x, g) {
    const max = this.L.diff >= 0.5 ? 3 : 2;
    if (this.L.tutorial || this.L.goal === 'escape' || this.L.diff < 0.1 || x < 34 || (this.alarms || 0) >= max || !this.rng.chance(0.35)) return x;
    this.alarms = (this.alarms || 0) + 1;
    const w = 8;
    this.flat(x, w, g); this.nd(x, w);
    this.enemy(x + 1, g, { type: 'scout', guard: true, force: true, face: -1 });
    this.feat('alarm', x + w - 1, g);
    return x + w;
  }

  tutorial(x, g) {
    this.sign(x - 7, g, 'move');
    // the welcome party, in sight of the drop: two sentries with their backs turned by a stack of
    // barrels. The first shot of the game sets off a chain reaction - the first "wow" comes in
    // seconds, before any reading
    this.flat(x, 14, g); this.sign(x + 1, g, 'shoot');
    for (let i = 0; i < 3; i++) this.feat('barrel', x + 6 + i, g, { hp: 1 }); // a single tap sets them off
    this.enemy(x + 9, g, { type: 'grunt', guard: true, face: 1, force: true });
    this.enemy(x + 11, g, { type: 'grunt', guard: true, face: 1, force: true });
    this.nd(x, 14); x += 14;
    [x, g] = this.segFlat(x, g, 4, true); this.sign(x - 3, g, 'jump');
    [x, g] = this.segStep(x, g, 1, 2, true);
    this.flat(x, 9, g); this.sign(x + 1, g, 'dig');
    for (let r = g - 3; r < g; r++) { this.ops.push(['dirt', x + 5, r]); this.ops.push(['dirt', x + 6, r]); }
    this.nd(x, 9); x += 9;
    this.sign(x + 1, g, 'slide');
    [x, g] = this.segFlat(x, g, 9, true); this.enemy(x - 3, g, { type: 'grunt', guard: true, face: -1 });
    this.sign(x + 1, g, 'rescue');
    [x, g] = this.segFlat(x, g, 4, true);
    [x, g] = this.segCage(x, g, true);
    this.sign(x + 1, g, 'climb');
    this.flat(x, 4, g); this.nd(x, 4); x += 4;
    [x, g] = this.segStep(x, g, 1, 4, true);
    this.flat(x, 12, g); this.sign(x + 2, g, 'special');
    this.barrels(x + 6, g, 2);
    this.enemy(x + 8, g, { type: 'grunt', guard: true, face: -1 }); this.enemy(x + 10, g, { type: 'grunt', guard: true, face: -1 });
    this.nd(x, 12); x += 12;
    // knife + grab: a sentry with his back turned
    this.sign(x + 1, g, 'knife');
    [x, g] = this.segFlat(x, g, 9, true); this.enemy(x - 3, g, { type: 'grunt', guard: true, face: 1 });
    this.sign(x + 1, g, 'flag');
    this.flat(x, 3, g); this.nd(x, 3); x += 3; // keep the flag pole clear of the sign
    [x, g] = this.segCheckpoint(x, g);
    [x, g] = this.segPrefab(x, g, 'hut');
    this.sign(x + 1, g, 'stomp');
    [x, g] = this.segHills(x, g, 10, 'one');
    this.sign(x + 1, g, 'ladder');
    [x, g] = this.segFlat(x, g, 3, true);
    [x, g] = this.segPrefab(x, g, 'watchtower');
    [x, g] = this.segFlat(x, g, 6, true);
    [x, g] = this.segCage(x, g, false);
    [x, g] = this.segFlat(x, g, 6, true);
    return [x, g];
  }

  // ------------------------------------------------------------ main
  generate() {
    const L = this.L, rng = this.rng;
    let x = 0, g = 30;
    [x, g] = this.segStart(x, g);
    if (L.tutorial) [x, g] = this.tutorial(x, g);
    else {
      const endAt = L.len;
      const cageEvery = Math.max(18, Math.floor((endAt - 14) / (this.cagesLeft + 0.6)));
      let sinceCage = 0, sinceCheck = 0, last = '';
      this.depotsLeft = L.goal === 'depots' ? 3 : 0;
      let depotAt = endAt * 0.26;
      while (x < endAt - 6) {
        let type = 'flat';
        if (this.cagesLeft > 0 && sinceCage >= cageEvery) type = 'cage';
        else if (this.depotsLeft > 0 && x >= depotAt) { type = 'depot'; depotAt += endAt * 0.25; }
        else if (L.goal === 'target' && !this.hqPlaced && x >= endAt * 0.58) type = 'hq';
        else if ((L.mech || L.tank) && !this.mechPlaced && x >= endAt * 0.45) type = 'flat'; // make sure the vehicle gets its spot
        else if (L.mini && !this.miniPlaced && x >= endAt * 0.68) type = 'mini'; // and the mini-boss its stretch
        else if (L.teach && L.teach.includes('bridge') && !this.taughtBridge && x >= 36) { type = 'ropeBridge'; this.taughtBridge = true; }
        else if (L.teach && L.teach.includes('fuel') && !this.taughtFuel && x >= 66) { type = 'fuel'; this.taughtFuel = true; }
        else if (sinceCheck >= 52 && endAt - x > 30) type = 'checkpoint';
        else {
          for (let tries = 0; tries < 12; tries++) {
            type = rng.weighted(SEG_WEIGHTS[L.theme]);
            if (type === last && STRUCT.has(type)) continue;
            if (x < 22 && STRUCT.has(type)) continue;
            if (type === 'stepUp' && g - 2 < MINH) continue;
            if (type === 'stepDown' && g + 2 > MAXH) continue;
            if (type === 'perch' && !L.pool.sniper) continue;
            break;
          }
        }
        const x0 = x;
        [x, g] = this.build(type, x, g);
        last = type;
        sinceCage += x - x0; sinceCheck += x - x0;
        // one troop truck per mission that has them, rolling in past the halfway mark
        if (L.trucks && !this.truckPlaced && x >= endAt * 0.5) { this.truckPlaced = true; this.feats.push({ kind: 'truck', x: x * TILE, y: g * TILE }); }
        if (type === 'cage') sinceCage = 0;
        if (type === 'checkpoint') sinceCheck = 0;
      }
      while (this.cagesLeft > 0) [x, g] = this.segCage(x, g);
      while (this.depotsLeft > 0) [x, g] = this.segDepot(x, g);
      if (L.goal === 'target' && !this.hqPlaced) [x, g] = this.build('hq', x, g);
    }
    this.placeSecret();
    if (L.boss) { [x, g] = this.segCheckpoint(x, g); [x, g] = this.segArena(x, g); }
    else [x, g] = this.segExtract(x, g);
    return this.finalize(x);
  }

  finalize(W) {
    const H = this.H;
    const terr = new Terrain(W, H, this.L.theme);
    const noise = makeNoise2D(this.seed * 31 + 7);
    for (let cx = 0; cx < W; cx++) {
      const s = this.heights[cx];
      for (let cy = s; cy < H; cy++) {
        let t = T.DIRT;
        const depth = cy - s;
        if (cy >= H - 2) t = T.BEDROCK;
        else if (cy === H - 3 && this.rng.chance(0.45)) t = T.BEDROCK;
        else if (depth > 5 && noise(cx * 0.17, cy * 0.17) > 0.68 - depth * 0.005) t = T.ROCK;
        const i = cy * W + cx;
        terr.fg[i] = t; terr.hp[i] = TDEF[t].hp; terr.bg[i] = BG.DIRT;
      }
    }
    // boss arenas get a bedrock-ish rock floor so the fight doesn't sink into a pit
    if (this.arena) {
      for (let cx = this.arena.x0 / TILE; cx < this.arena.x1 / TILE; cx++) {
        const s = this.heights[cx];
        for (let cy = s; cy < Math.min(s + 3, H - 2); cy++) {
          const i = cy * W + cx;
          if (terr.fg[i] === T.DIRT) { terr.fg[i] = T.ROCK; terr.hp[i] = TDEF[T.ROCK].hp; }
        }
      }
    }
    for (const c of this.caves) {
      for (let cy = c.y0; cy <= c.y1; cy++) for (let cx = c.x0; cx <= c.x1; cx++) {
        if (!terr.inb(cx, cy)) continue;
        const i = cy * W + cx; terr.fg[i] = 0; terr.hp[i] = 0;
      }
    }
    // the secret vault: carved out and bricked in, its roof cracked (hp 3 of 10 draws the cracks)
    if (this.secret) {
      const s = this.secret;
      terr.weak = new Set(); terr.mask = new Set();
      for (let cy = s.y0; cy <= s.y1; cy++) for (let cx = s.x0; cx <= s.x1; cx++) { const i = cy * W + cx; terr.fg[i] = 0; terr.hp[i] = 0; terr.bg[i] = BG.BRICK; terr.mask.add(i); }
      for (let cx = s.x0; cx <= s.x1; cx++) { const i = s.roof * W + cx; if (terr.fg[i] === T.DIRT) { terr.hp[i] = 3; terr.weak.add(i); } }
    }
    for (const [kind, cx, cy] of this.ops) {
      if (!terr.inb(cx, cy)) continue;
      const i = cy * W + cx;
      const put = (t) => { terr.fg[i] = t; terr.hp[i] = t ? TDEF[t].hp : 0; };
      switch (kind) {
        case 'ladder': put(T.LADDER); break;
        case 'platform': put(T.PLATFORM); break;
        case 'wood': put(T.WOOD); break;
        case 'crate': put(T.CRATE); break;
        case 'sandbag': put(T.SANDBAG); break;
        case 'dirt': put(T.DIRT); terr.bg[i] = BG.DIRT; break;
        case 'carve': put(0); terr.bg[i] = BG.DIRT; break;
      }
    }
    for (const s of this.stamps) this.applyStamp(terr, s);

    // decoration
    const names = THEMES[this.L.theme].decor;
    let lastD = -10;
    for (let cx = 3; cx < W - 2; cx++) {
      if (this.noDecor[cx] || this.noDecor[cx + 1]) continue;
      if (cx - lastD < 4) continue;
      if (this.heights[cx] !== this.heights[cx + 1]) continue;
      if (!this.rng.chance(0.17)) continue;
      const name = this.rng.pick(names);
      this.decor.push({ name, v: this.rng.int(0, 5), x: cx * TILE + 8 + this.rng.int(-4, 4), y: this.heights[cx] * TILE, dead: false });
      lastD = cx;
    }
    const prisoners = this.feats.filter((f) => f.kind === 'cage').length;
    return { terrain: terr, feats: this.feats, spawn: this.spawn, decor: this.decor, arena: this.arena, bossSpawn: this.bossSpawn, prisoners };
  }

  applyStamp(terr, s) {
    const { pf, x, g } = s;
    const rows = pf.rows, h = rows.length, top = g - h + (pf.sink || 0);
    for (let r = 0; r < h; r++) for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      const cx = x + c, cy = top + r;
      if (!terr.inb(cx, cy)) continue;
      const i = cy * terr.w + cx;
      const put = (t) => { terr.fg[i] = t; terr.hp[i] = t ? TDEF[t].hp : 0; };
      switch (ch) {
        case '#': put(T.DIRT); terr.bg[i] = BG.DIRT; break;
        case 'W': put(T.WOOD); if (pf.bg) terr.bg[i] = pf.bg; break;
        case 'P': put(T.PLATFORM); break;
        case 'H': put(T.LADDER); break;
        case 'B': put(T.BRICK); terr.bg[i] = pf.bg || BG.BRICK; break;
        case 'S': put(T.STEEL); break;
        case 's': put(T.SANDBAG); break;
        case 'M': put(T.ROOF); break;
        case 'X': put(T.STONE); if (pf.bg) terr.bg[i] = pf.bg; break;
        case 'C': put(T.CRATE); break;
        case '_': put(0); terr.bg[i] = pf.bg; break;
        default: put(0); if (pf.markerBg) terr.bg[i] = pf.bg;
      }
    }
  }
}
