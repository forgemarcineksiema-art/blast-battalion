'use strict';
// ============================================================================
//  Modifiers: the daily mission's rule of the day and the Arcade run's perk cards.
//  Both switch on the same effects; a mission's set lives in World.mods and the
//  systems they change read it (heroes, projectiles, explosions, kills, the world).
//
//    boom      every Nth hero round explodes (N = BOOM_EVERY[level])
//    blast     hero explosions +30% radius per level
//    chain     a kill zaps the nearest soldiers (level = how many)
//    ricochet  hero bullets bounce off walls (level = bounces)
//    heavy     fallen soldiers blow up
//    supply    +1 special per level          armor   +1 hit point per level
//    jetpack   every hero can fly            barrels barrels drop near soldiers
//    vampire   every 8th (5th) kill heals    rapid   fire rate +20% per level
//    fleet     run speed +12% per level      bounty  +50% cash per level
//    gravity   gravity ×                     pace    game speed ×
//    hero      every hero dropped in or rescued is this one
// ============================================================================

const BOOM_EVERY = [0, 6, 4, 3];
const ORDINAL = { 3: '3RD', 4: '4TH', 5: '5TH', 6: '6TH', 8: '8TH' };
const VAMPIRE_EVERY = [0, 8, 5];

// 7x7 icons, one row per string ('#' = pixel)
function bits(rows) { return rows.map((r) => [...r].reduce((a, ch, i) => a | (ch === '#' ? 64 >> i : 0), 0)); }

// The Arcade deck: after each cleared stage the run picks 1 of 3 (they last until the run ends)
const PERKS = [
  { id: 'boom', name: 'EXPLOSIVE ROUNDS', max: 3, color: '#ff8a3a', desc: (l) => 'EVERY ' + ORDINAL[BOOM_EVERY[l]] + ' BULLET EXPLODES',
    icon: bits(['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#']) },
  { id: 'blast', name: 'BIG BOOM', max: 3, color: '#ffd23a', desc: (l) => 'YOUR BLASTS ' + (30 * l) + '% BIGGER',
    icon: bits(['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..']) },
  { id: 'chain', name: 'CHAIN LIGHTNING', max: 3, color: '#8fe4ff', desc: (l) => 'EVERY KILL ZAPS ' + (l > 1 ? l + ' SOLDIERS' : 'A SOLDIER') + ' NEARBY',
    icon: bits(['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....']) },
  // RICO\u00ADCHET: the soft hyphen (invisible) keeps the modifier apart from RICOCHET the hero, whose name stays English (src/lang.js)
  { id: 'ricochet', name: 'RICO\u00ADCHET', max: 2, color: '#d8dee8', desc: (l) => 'BULLETS BOUNCE OFF WALLS' + (l > 1 ? ' TWICE' : ''),
    icon: bits(['.......', '#.....#', '.#...##', '..#.#.#', '...#...', '.......', '.......']) },
  { id: 'heavy', name: 'HEAVY METAL', max: 1, color: '#ff5a3a', desc: () => 'FALLEN SOLDIERS EXPLODE',
    icon: bits(['.#####.', '#######', '#..#..#', '#######', '.#####.', '.#.#.#.', '.......']) },
  { id: 'supply', name: 'SUPPLY PACK', max: 3, color: '#9aca60', desc: (l) => '+' + l + ' SPECIAL FOR EVERY HERO', icon: 'special' },
  { id: 'armor', name: 'BODY ARMOR', max: 2, color: '#9ad8ff', desc: (l) => '+' + l + ' HIT POINT' + (l > 1 ? 'S' : '') + ' FOR EVERY HERO', icon: 'armor' },
  { id: 'lives', name: 'REINFORCEMENTS', max: 99, instant: true, color: '#7cff7c', desc: () => '+2 LIVES RIGHT NOW', icon: 'lives' },
  { id: 'jetpack', name: 'ROCKET BOOTS', max: 1, color: '#ffae3a', desc: () => 'EVERY HERO CAN FLY: HOLD JUMP',
    icon: bits(['.##....', '.##....', '.####..', '.#####.', '.......', '.#.#.#.', '#.#.#..']) },
  { id: 'barrels', name: 'BARREL RAIN', max: 1, color: '#e04a3a', desc: () => 'BARRELS DROP ON SOLDIERS',
    icon: bits(['.#####.', '#######', '.......', '#######', '#######', '.......', '.#####.']) },
  { id: 'vampire', name: 'VAMPIRE', max: 2, color: '#ff5a7a', desc: (l) => 'EVERY ' + ORDINAL[VAMPIRE_EVERY[l]] + ' KILL HEALS 1 HP',
    icon: bits(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......']) },
  { id: 'rapid', name: 'FAST HANDS', max: 3, color: '#ffd23a', desc: (l) => 'SHOOT ' + (20 * l) + '% FASTER',
    icon: bits(['#..#...', '.#..#..', '..#..#.', '...#..#', '..#..#.', '.#..#..', '#..#...']) },
  { id: 'fleet', name: 'FLEET FOOT', max: 2, color: '#7cff7c', desc: (l) => 'RUN ' + (12 * l) + '% FASTER',
    icon: bits(['.......', '....#..', '.....#.', '#######', '.....#.', '....#..', '.......']) },
  { id: 'bounty', name: 'BOUNTY', max: 2, color: '#ffd23a', desc: (l) => '+' + (50 * l) + '% CASH THIS RUN', icon: '$' },
];
const PERK_BY_ID = {};
PERKS.forEach((p) => { PERK_BY_ID[p.id] = p; });

// three different cards the run can still take (not maxed), the same ones if the stage is replayed
function perkChoices(runSeed, stage, have) {
  const r = new RNG((runSeed * 13 + stage * 7919) >>> 0);
  const pool = PERKS.filter((p) => (have[p.id] || 0) < p.max && !(p.id === 'lives' && stage < 3));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0].id);
  return out;
}

// The rule of the day: one crazy twist on the daily mission, the same for everyone that day
// in the order they come around, day after day (movement, weapons and chaos take turns)
const DAILY_RULES = [
  { id: 'barrels', name: 'BARREL RAIN', desc: 'BARRELS FALL FROM THE SKY', mods: { barrels: 1 } },
  { id: 'moon', name: 'LOW GRAVITY', desc: 'JUMP HIGHER, FALL SLOWER', mods: { gravity: 0.55 } },
  { id: 'boom', name: 'EXPLOSIVE ROUNDS', desc: 'EVERY 3RD BULLET EXPLODES', mods: { boom: 3 } },
  { id: 'hero', name: 'HERO DAY', desc: null, mods: {} },
  { id: 'heavy', name: 'HEAVY METAL', desc: 'EVERY FALLEN SOLDIER EXPLODES', mods: { heavy: 1 } },
  { id: 'boots', name: 'ROCKET BOOTS', desc: 'EVERYONE CAN FLY: HOLD JUMP', mods: { jetpack: 1 } },
  { id: 'bounce', name: 'RICO\u00ADCHET', desc: 'BULLETS BOUNCE OFF WALLS', mods: { ricochet: 2 } },
  { id: 'turbo', name: 'DOUBLE TIME', desc: 'THE WHOLE WAR RUNS 25% FASTER', mods: { pace: 1.25 } },
  { id: 'blast', name: 'BIG BOOM', desc: 'YOUR EXPLOSIONS 90% BIGGER', mods: { blast: 3 } },
];
// a fixed rotation: every rule comes back exactly every 9 days, never two alike in a row
function dailyRule(day) {
  const di = Meta.dayIndex(day), n = DAILY_RULES.length, cycle = Math.floor(di / n);
  const rule = Object.assign({}, DAILY_RULES[di % n]);
  if (rule.id === 'hero') {
    // every hero today is one of the twelve (locked ones included: a free try); the next
    // hero day brings another one
    const h = HEROES[(cycle * 5 + 2) % HEROES.length];
    rule.mods = { hero: h.id };
    rule.name = h.name + ' DAY';
    rule.desc = 'EVERY HERO TODAY IS ' + h.name;
  }
  return rule;
}

// the effects in play for a mission: the daily rule, the Arcade run's cards, or none
function missionMods(m) {
  if (m.daily) return Object.assign({}, dailyRule(m.daily).mods);
  if (m.arcade && m.arcade.perks) return Object.assign({}, m.arcade.perks);
  return {};
}

// a row of small perk icons with their levels (pause, run over, the card screen), on the HUD layer
function drawPerkRow(ctx, perks, cx, y, label) {
  const ids = PERKS.filter((p) => perks[p.id]).map((p) => p.id);
  const lw = label ? Font.width(label) + 6 : 0;
  const cell = (id) => 9 + (perks[id] > 1 ? Font.width(String(perks[id])) + 1 : 0) + 4;
  const total = lw + ids.reduce((a, id) => a + cell(id), 0) - (ids.length ? 4 : 0);
  let x = Math.round(cx - total / 2);
  if (label) { UI.otext(label, x, y, '#c8c4e0'); x += lw; }
  if (!ids.length) { UI.otext('NONE YET', x, y, '#8a88a0'); return; }
  for (const id of ids) {
    const p = PERK_BY_ID[id];
    UI.rect(x - 1, y - 1, 9, 9, INK);
    UI.icon(p.icon, x, y, p.color, 1);
    x += 9;
    if (perks[id] > 1) { UI.otext(String(perks[id]), x, y, '#ffffff'); x += Font.width(String(perks[id])) + 1; }
    x += 4;
  }
}
