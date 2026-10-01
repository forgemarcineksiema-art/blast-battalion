'use strict';
// ============================================================================
//  Game events for the portal's dashboard (1.34): Poki's PokiSDK.measure(category, what, action)
//  through Platform.measure (nothing is sent anywhere else, and nothing at all off Poki).
//  What they answer after a test on Poki:
//   - where players stop: every mission is a funnel, start -> complete | fail, with the quarter
//     marks on the way (at-25 / at-50 / at-75) and restart / quit when they give up on it;
//   - whether the first mission teaches the controls: tutorial move / shoot / jump / kill / rescue;
//   - whether the extras get found: the screens opened, heroes unlocked, upgrades and outfits bought;
//   - the rewarded offer: continue visible -> interact;
//   - the devices: touch / keyboard / gamepad, and phones that fall back to LITE effects.
//  Poki's rules: one complete OR fail per attempt; start/complete/fail and visible/interact pairs
//  share category and what; at most two numbers per event.
// ============================================================================

const Funnel = {
  once: new Set(),
  att: null, // the attempt being played: { key: [category, what], marks, tut }

  ev(category, what, action) { Platform.measure(category, what, action); },
  first(key, category, what, action) { if (this.once.has(key)) return; this.once.add(key); this.ev(category, what, action); },

  // campaign mission 'level' <n>, arcade 'arcade' <stage>, daily 'daily' <rule>
  key(W) {
    if (W.arcade) return ['arcade', String(W.arcade.stage)];
    if (W.daily) return ['daily', dailyRule(W.daily).id];
    return ['level', String(W.levelIndex + 1)];
  },
  // the drop has landed and the mission plays (World: intro -> play); also after a paid continue
  start(W) {
    if (W.demo) return;
    const k = this.key(W), p = W.player;
    this.att = { W, key: k, marks: 0, tut: !W.arcade && !W.daily && W.levelIndex === 0 ? {} : null, x0: p ? p.x : 0, sp0: p ? p.specials : 0 };
    this.ev(k[0], k[1], 'start');
    this.first('input', 'input', Input.mode, 'play');
    if (Input.isTouchDevice) this.first('orient', 'device', Gfx.H > Gfx.W ? 'portrait' : 'landscape', 'play');
  },
  // one outcome per attempt; a later one for the same attempt is dropped
  end(W, action) {
    const a = this.att;
    if (!a || a.W !== W) return;
    this.ev(a.key[0], a.key[1], action);
    this.att = null;
  },
  complete(W) { this.end(W, 'complete'); },
  fail(W) { this.end(W, 'fail'); },
  quit(W, how) { this.end(W, how); }, // 'restart' | 'quit' (custom actions, not the funnel's fail)

  // every frame of a mission: the quarter marks, and in mission 1 the controls as they get used
  tick(W) {
    const a = this.att;
    if (!a || a.W !== W || W.demo) return;
    const p = W.player;
    if (!p) return;
    const q = Math.floor(clamp(p.cx / (W.terrain.w * TILE), 0, 1) * 4);
    while (a.marks < Math.min(3, q)) { a.marks++; this.ev(a.key[0], a.key[1], 'at-' + a.marks * 25); }
    const t = a.tut;
    if (!t || p.dead) return;
    const step = (s) => { if (!t[s]) { t[s] = 1; this.ev('tutorial', s, 'done'); } };
    if (Math.abs(p.x - a.x0) > 24) step('move');
    if (p.firing) step('shoot');
    if (p.jumping) step('jump');
    if (W.kills > 0) step('kill');
    if (W.rescued > 0) step('rescue');
    if (p.specials < a.sp0) step('special');
    a.sp0 = p.specials;
  },

  // the rewarded offer on the game-over screen
  offer(what) { this.ev('rewarded', what, 'visible'); },
  took(what) { this.ev('rewarded', what, 'interact'); },

  // screens beyond the missions: are the heroes, upgrades and wardrobe found at all?
  scene(s) {
    const n = typeof TitleScene !== 'undefined' && s === TitleScene ? 'title' : typeof LevelSelectScene !== 'undefined' && s === LevelSelectScene ? 'missions'
      : typeof HeroesScene !== 'undefined' && s === HeroesScene ? 'heroes' : typeof UpgradesScene !== 'undefined' && s === UpgradesScene ? 'upgrades'
        : typeof WardrobeScene !== 'undefined' && s === WardrobeScene ? 'wardrobe' : typeof OptionsScene !== 'undefined' && s === OptionsScene ? 'options'
          : typeof VictoryScene !== 'undefined' && s === VictoryScene ? 'victory' : null;
    if (n) this.ev('screen', n, 'opened');
  },
};
