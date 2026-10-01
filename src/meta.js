'use strict';
// ============================================================================
//  The long game: cash earned in every mission, permanent upgrades bought with
//  it, the daily supply drop (a streak of days pays more) and the road to the
//  next hero. Everything lives in the save (Save.data.coins / up / dailyDrop).
// ============================================================================

const UPGRADES = [
  { id: 'power', name: 'FIREPOWER', desc: '+15% DAMAGE', costs: [120, 280, 500] },
  { id: 'special', name: 'SUPPLY PACK', desc: '+1 SPECIAL, EVERY HERO', costs: [150, 350] },
  { id: 'lives', name: 'RESERVES', desc: '+1 LIFE EACH MISSION', costs: [200, 450] },
  { id: 'armor', name: 'BODY ARMOR', desc: '+1 HIT POINT', costs: [400] },
];
const UPG_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
// the daily supply drop by day of the streak (the 7th day and on pay the most)
const DAILY_DROP = [50, 60, 70, 80, 100, 120, 150];

const Meta = {
  coins() { return Save.data.coins || 0; },
  add(n) { Save.data.coins = this.coins() + Math.max(0, Math.round(n)); Save.save(); },
  level(id) { return (Save.data.up && Save.data.up[id]) || 0; },
  // price of the next level, null when maxed out
  cost(id) { const u = UPG_BY_ID[id], l = this.level(id); return l < u.costs.length ? u.costs[l] : null; },
  canBuy(id) { const c = this.cost(id); return c != null && this.coins() >= c; },
  buy(id) {
    if (!this.canBuy(id)) return false;
    Save.data.coins = this.coins() - this.cost(id);
    Save.data.up = Object.assign({}, Save.data.up, { [id]: this.level(id) + 1 });
    Save.save();
    return true;
  },
  // what the upgrades do in a mission
  damageMul() { return 1 + 0.15 * this.level('power'); },
  extraSpecials() { return this.level('special'); },
  extraLives() { return this.level('lives'); },
  extraHp() { return this.level('armor'); },
  // hit points and lives a hero starts a mission with (the level select card shows them)
  heroHp(skill) { return (TUNE.heroHp > 0 ? TUNE.heroHp : Math.max(1, skill.hp || 2)) + this.extraHp(); },
  missionLives(skill, coop) { return Math.max(1, (coop ? 5 : 3) + skill.lives) + this.extraLives(); },

  // coins for a finished mission, as rows for the results screen
  missionReward(W, stars, newMedals) {
    const rows = [];
    const freed = W.rescued * 5;
    if (W.arcade) rows.push(['STAGE ' + W.arcade.stage, 20 + W.arcade.stage * 10]);
    else if (W.daily) rows.push(['DAILY MISSION', 60], ['STARS', stars * 20]);
    else {
      rows.push(['MISSION', 40], ['STARS', stars * 20]);
      const fresh = (newMedals & 1) + ((newMedals >> 1) & 1) + ((newMedals >> 2) & 1);
      if (fresh) rows.push(['NEW MEDALS', fresh * 30]);
    }
    if (freed) rows.push(['PRISONERS', freed]);
    // BOUNTY perk: the run pays more
    const bounty = W.mods && W.mods.bounty;
    if (bounty) rows.push(['BOUNTY +' + 50 * bounty + '%', Math.round(rows.reduce((a, r) => a + r[1], 0) * 0.5 * bounty)]);
    return { rows, total: rows.reduce((a, r) => a + r[1], 0) };
  },
  // a failed mission still pays a little: something to show for the attempt
  failReward(W) { return 10 + W.rescued * 3; },

  // ---- the daily supply drop
  dayIndex(key) { return Math.floor(Date.UTC((key / 10000) | 0, (((key / 100) | 0) % 100) - 1, key % 100) / 86400000); },
  daily() {
    const d = Save.data.dailyDrop, today = this.dayIndex(todayKey());
    const ready = !d || d.day < today;
    const streak = !d ? 1 : d.day === today - 1 ? d.streak + 1 : d.day === today ? d.streak : 1;
    return { ready, streak, amount: DAILY_DROP[Math.min(streak, DAILY_DROP.length) - 1], tomorrow: DAILY_DROP[Math.min(streak + 1, DAILY_DROP.length) - 1] };
  },
  claimDaily() {
    const d = this.daily();
    if (!d.ready) return null;
    Save.data.dailyDrop = { day: this.dayIndex(todayKey()), streak: d.streak };
    Funnel.ev('daily-drop', 'streak-' + d.streak, 'claimed');
    this.add(d.amount);
    return d;
  },
  // the daily drop shows up once the player has finished a mission (new players go straight to play)
  dailyVisible() { return Object.keys(Save.data.stars).length > 0; },

  // the road to the next hero: rescues so far against the next unlock threshold
  nextHero() {
    const r = Save.data.rescues || 0;
    let prev = 0;
    for (const h of HEROES) {
      if (h.unlock > r) return { hero: h, have: r, need: h.unlock, from: prev };
      prev = h.unlock;
    }
    return null;
  },
};
