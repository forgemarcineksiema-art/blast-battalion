'use strict';
// ============================================================================
//  WARDROBE (1.25): cosmetics bought with cash - a hat and a paint job for each
//  hero. An item is bought once and any hero can wear it. A hero's look is data
//  (LOOKS in sprites.js), so an outfit is only an override of that data and a
//  rebuilt sprite set: the HUD portrait, the hero cards, the fly-in and the
//  mission itself all show it. Nothing here changes how a hero plays.
// ============================================================================

// hats: which head drawing (drawHuman's look.hat) and its colors; tall = extra rows above the head
const WARDROBE_HATS = [
  { id: 'bandana', name: 'BANDANA', cost: 200, hat: 'bandana', hatC: '#d8322a', hatD: '#9e1f1a' },
  { id: 'beret', name: 'GREEN BERET', cost: 250, hat: 'beret', hatC: '#2e7a3a', hatD: '#1e5226' },
  { id: 'boonie', name: 'BOONIE HAT', cost: 250, hat: 'boonie', hatC: '#6b7a45', hatD: '#4a5530' },
  { id: 'helmet', name: 'STEEL POT', cost: 300, hat: 'helmet', hatC: '#5d7240', hatD: '#3c4a28' },
  { id: 'cowboy', name: 'STETSON', cost: 350, hat: 'cowboy', hatC: '#7a5230', hatD: '#4e331d' },
  { id: 'party', name: 'PARTY HAT', cost: 400, hat: 'party', hatC: '#ff5a9a', hatD: '#ffd23a', tall: 3 },
  { id: 'tophat', name: 'TOP HAT', cost: 500, hat: 'tophat', hatC: '#24242c', hatD: '#15151a', tall: 2 },
  { id: 'viking', name: 'VIKING HELM', cost: 700, hat: 'viking', hatC: '#8a8a96', hatD: '#5a5a64', tall: 1 },
  { id: 'crown', name: 'CROWN', cost: 1200, hat: 'crown', hatC: '#e8c547', hatD: '#b8942a', tall: 1 },
];
// paint jobs: the colors of the shirt and the trousers (and boots)
const WARDROBE_PAINTS = [
  { id: 'desert', name: 'DESERT', cost: 150, shirt: '#b8a070', shirtD: '#94804f', pants: '#8a7650', pantsD: '#6a5a3a' },
  { id: 'arctic', name: 'ARCTIC', cost: 150, shirt: '#d8dce4', shirtD: '#aab2c0', pants: '#9aa2b0', pantsD: '#788090' },
  { id: 'urban', name: 'URBAN', cost: 200, shirt: '#6a7282', shirtD: '#4e5564', pants: '#4a505e', pantsD: '#363b46' },
  { id: 'night', name: 'NIGHT OPS', cost: 250, shirt: '#2e2e38', shirtD: '#1e1e26', pants: '#24242c', pantsD: '#16161c', boots: '#101014' },
  { id: 'crimson', name: 'CRIMSON', cost: 300, shirt: '#a8322a', shirtD: '#7e2018', pants: '#4a2a2a', pantsD: '#341c1c' },
  { id: 'neon', name: 'NEON', cost: 400, shirt: '#2fe0c8', shirtD: '#1ea896', pants: '#3a2a5a', pantsD: '#281c40' },
  { id: 'gold', name: 'GOLD PLATED', cost: 900, shirt: '#e0b848', shirtD: '#b08a2a', pants: '#8a6a20', pantsD: '#6a5018', boots: '#4a3a14' },
];
const PAINT_KEYS = ['shirt', 'shirtD', 'pants', 'pantsD', 'boots'];

const Wardrobe = {
  cache: new Map(),
  // Save.data.wardrobe = { own: { 'hat:crown': 1 }, wear: { havoc: { hat, paint } }, seen: { 'hat:crown': 1 } }
  data() {
    const d = Save.data.wardrobe || (Save.data.wardrobe = {});
    d.own = d.own || {}; d.wear = d.wear || {}; d.seen = d.seen || {};
    return d;
  },
  list(kind) { return kind === 'hat' ? WARDROBE_HATS : WARDROBE_PAINTS; },
  item(kind, id) { return this.list(kind).find((it) => it.id === id) || null; },
  owns(kind, id) { return !!this.data().own[kind + ':' + id]; },
  worn(heroId) { return this.data().wear[heroId] || {}; },
  canBuy(kind, id) { const it = this.item(kind, id); return !!it && !this.owns(kind, id) && Meta.coins() >= it.cost; },
  buy(kind, id) {
    if (!this.canBuy(kind, id)) return false;
    Save.data.coins = Meta.coins() - this.item(kind, id).cost;
    this.data().own[kind + ':' + id] = 1;
    Save.save();
    return true;
  },
  // put an item on (or take it off: the same item again, or id null = the hero's own)
  wear(heroId, kind, id) {
    const w = this.data().wear, cur = Object.assign({}, w[heroId]);
    if (id && cur[kind] !== id && (this.owns(kind, id))) cur[kind] = id; else delete cur[kind];
    if (Object.keys(cur).length) w[heroId] = cur; else delete w[heroId];
    Save.save();
    this.apply(heroId);
  },
  // the hero's look with an outfit: what it wears, optionally with `over` tried on ({ hat: '' } = own hat)
  look(heroId, over) {
    const w = Object.assign({}, this.worn(heroId));
    if (over) for (const k in over) { if (over[k]) w[k] = over[k]; else delete w[k]; }
    const out = Object.assign({}, LOOKS[heroId]);
    const p = w.paint && this.item('paint', w.paint);
    if (p) for (const k of PAINT_KEYS) if (p[k]) out[k] = p[k];
    const h = w.hat && this.item('hat', w.hat);
    if (h) { out.hat = h.hat; out.hatC = h.hatC; out.hatD = h.hatD; out.tall = h.tall || 0; }
    return out;
  },
  apply(heroId) { if (LOOKS[heroId]) Sprites.chars[heroId] = buildCharacter(this.look(heroId)); },
  applyAll() { for (const id in this.data().wear) this.apply(id); },
  // a hero in an outfit (16x16, cached) for the wardrobe's item cards: head and shoulders for a
  // hat, head to hips for a paint job
  preview(heroId, over, body) {
    const key = (body ? 'B|' : '') + heroId + '|' + JSON.stringify(this.worn(heroId)) + '|' + JSON.stringify(over || {});
    let c = this.cache.get(key);
    if (c) return c;
    const look = this.look(heroId, over), L = humanLayout(look), cv = makeCanvas(L.W, L.H, true);
    drawHuman(cv.getContext('2d'), look, POSES.idle, L);
    const o = outlineCanvas(cv);
    const hl = L.cx - Math.floor(L.headW / 2), ht = L.H - L.legH - L.torsoH - L.headH;
    c = makeCanvas(16, 16);
    c.getContext('2d').drawImage(o, hl - 5, body ? ht - 1 : ht - 5 - Math.min(2, look.tall || 0), 16, 16, 0, 0, 16, 16);
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(key, c);
    return c;
  },
  // the whole hero in an outfit, one pose (cached): the big figure on the wardrobe's stand
  figure(heroId, over, pose = 'idle') {
    const key = 'F|' + pose + '|' + heroId + '|' + JSON.stringify(this.worn(heroId)) + '|' + JSON.stringify(over || {});
    let c = this.cache.get(key);
    if (c) return c;
    const look = this.look(heroId, over), L = humanLayout(look), cv = makeCanvas(L.W, L.H, true);
    drawHuman(cv.getContext('2d'), look, POSES[pose] || POSES.idle, L);
    c = outlineCanvas(cv); c.ax = L.cx;
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(key, c);
    return c;
  },
  // something new the player can afford (a badge on the HEROES and WARDROBE buttons until they look)
  hasNew() {
    const d = this.data();
    for (const kind of ['hat', 'paint']) for (const it of this.list(kind)) {
      const k = kind + ':' + it.id;
      if (!d.own[k] && !d.seen[k] && Meta.coins() >= it.cost) return true;
    }
    return false;
  },
  markSeen() {
    const d = this.data();
    for (const kind of ['hat', 'paint']) for (const it of this.list(kind)) if (Meta.coins() >= it.cost) d.seen[kind + ':' + it.id] = 1;
    Save.save();
  },
};
