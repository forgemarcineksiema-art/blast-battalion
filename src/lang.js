'use strict';
// ============================================================================
//  Languages (1.29): English, Spanish, Brazilian Portuguese, German, French, Polish;
//  1.34: Italian and Turkish (Poki's first batch is English, French, Italian, German, Spanish, Turkish).
//  The game is written in English, and everything it draws goes through Font (src/gfx.js),
//  which hands the text to L10N.tr: an exact phrase from the language's table, or a rule for
//  a phrase put together from parts ("MISSION 4 - TIGER CLAW", "SHOT BY A SNIPER",
//  "EVERY 4TH BULLET EXPLODES"). What isn't in the table stays in English, so a new line
//  never breaks - it just waits for its translation. Hero and boss names, key names and the
//  random Arcade operation names stay as they are. The tables: src/lang_*.js.
// ============================================================================

const LANGS = [['en', 'ENGLISH'], ['es', 'ESPAÑOL'], ['pt', 'PORTUGUÊS'], ['de', 'DEUTSCH'], ['fr', 'FRANÇAIS'], ['it', 'ITALIANO'], ['tr', 'TÜRKÇE'], ['pl', 'POLSKI']];

// phrases put together from parts: [id, pattern]. Each language has a template per id:
// {1} = part 1 as it is, {1t} = part 1 translated, {1?text} = text only when part 1 is there
// (# in it = the part), {1|one|few|many} = the plural form that fits the number in part 1
const L10N_RULES = [
  ['mission_title', /^MISSION (\d+) - (.+)$/],
  ['mission_n', /^MISSION (\d+)$/],
  ['operation', /^OPERATION (.+)$/],
  ['go3', /^★ (\d+\/\d+) - GO FOR 3 STARS$/],
  ['daily_best', /^DAILY: (.+?)   BEST ([\d,]+)$/],
  ['daily', /^DAILY: (.+)$/],
  ['day_row', /^DAY (\d+) IN A ROW - TOMORROW \+\$(\d+)$/],
  ['day_one', /^DAY (\d+) - TOMORROW \+\$(\d+)$/],
  ['come_back', /^COME BACK TOMORROW: \+\$(\d+)$/],
  ['locked', /^LOCKED - FINISH MISSION (\d+) FIRST$/],
  ['best', /^BEST ([\d,]+)$/],
  ['free_n', /^FREE (\d+) PRISONERS$/],
  ['starts_as', /^EVERY MISSION STARTS AS (.+) \(PICK AGAIN FOR RANDOM\)$/],
  ['worn', /^(.+) - WORN \(CLICK TO TAKE OFF\)$/],
  ['owned', /^(.+) - OWNED \(CLICK TO WEAR\)$/],
  ['buy_again', /^(.+)  \$([\d,]+) - CLICK AGAIN TO BUY$/],
  ['try_on', /^(.+)  \$([\d,]+) - CLICK TO TRY ON$/],
  ['no_cash', /^(.+)  \$([\d,]+) - NOT ENOUGH CASH YET$/],
  ['own_hat', /^(.+)'S OWN HAT$/],
  ['own_colors', /^(.+)'S OWN COLORS$/],
  ['daily_mission', /^DAILY MISSION - (.+)$/],
  ['arcade_stage', /^ARCADE STAGE (\d+)$/],
  ['all_prisoners_n', /^ALL PRISONERS (\d+\/\d+)$/],
  ['stage_cleared', /^STAGE (\d+) CLEARED!$/],
  ['kills_style', /^(\d+)  \((\d+) STYLE\)$/],
  ['unlocked', /^UNLOCKED: (.+)$/],
  ['next_hero', /^NEXT HERO: (.+)$/],
  ['retry_lives', /^RETRY  \+(\d+) LI(?:FE|VES)$/],
  ['stage_score', /^STAGE (\d+)   SCORE ([\d,]+)$/],
  ['all_down', /^ALL HEROES DOWN\. SCORE ([\d,]+)$/],
  ['attempt', /^\+\$(\d+) FOR THE ATTEMPT$/],
  ['total_stars', /^TOTAL STARS: (\d+\/\d+)$/],
  ['total_score', /^TOTAL SCORE: ([\d,]+)$/],
  ['key_taken', /^(.+) IS TAKEN - PICK ANOTHER$/],
  ['reinforcements', /^REINFORCEMENTS: \+(\d+) LI(?:FE|VES)$/],
  ['obj_depots', /^OBJECTIVE: DESTROY (\d+) FUEL DEPOTS$/],
  ['depots_n', /^DESTROY FUEL DEPOTS (\d+\/\d+)$/],
  ['depot_destroyed', /^DEPOT DESTROYED (\d+\/\d+)$/],
  ['p_back', /^P(\d) IS BACK!$/],
  ['p_down', /^P(\d) DOWN!$/],
  ['revive', /^FREE A PRISONER TO REVIVE P(\d)!$/],
  ['shot_by', /^SHOT BY (.+)$/],
  ['blown_by', /^BLOWN UP BY (.+)$/],
  ['burned_by', /^BURNED BY (.+)$/],
  ['crushed_by', /^CRUSHED BY (.+)$/],
  ['bashed_by', /^BASHED BY (.+)$/],
  ['new_hero', /^NEW HERO UNLOCKED: (.+)$/],
  ['special_ready', /^SPECIAL: (.+) READY$/],
  ['going_down', /^(.+) IS GOING DOWN!$/],
  ['landing', /^LANDING ZONE: (\d+) KILLS?$/],
  ['rockets_n', /^ROCKETS (\d+)$/],
  ['hold_skip', /^HOLD (.+) TO SKIP$/],
  ['rail_keys', /^ARROWS OR MOUSE: AIM   (.+): SHOOT   (.+): ROCKET$/],
  ['boom_every', /^EVERY (\d+)(?:ST|ND|RD|TH) BULLET EXPLODES$/],
  ['vampire', /^EVERY (\d+)(?:ST|ND|RD|TH) KILL HEALS 1 HP$/],
  ['blasts', /^YOUR BLASTS (\d+)% BIGGER$/],
  ['zaps', /^EVERY KILL ZAPS (\d+) SOLDIERS NEARBY$/],
  ['special_every', /^\+(\d+) SPECIAL FOR EVERY HERO$/],
  ['hp_every', /^\+(\d+) HIT POINTS? FOR EVERY HERO$/],
  ['shoot_faster', /^SHOOT (\d+)% FASTER$/],
  ['run_faster', /^RUN (\d+)% FASTER$/],
  ['cash_run', /^\+(\d+)% CASH THIS RUN$/],
  ['hero_today', /^EVERY HERO TODAY IS (.+)$/],
  ['hero_day', /^(.+) DAY$/],
  ['multi', /^MULTI KILL ×(\d+)$/],
  ['style_pts', /^(.+?)(?: ×(\d+))?! \+(\d+)$/],
  ['gap2', /^(.+?)( {2,})(.+)$/],
  ['kit', /^(.+) \+ (.+)$/],
  ['kit_top', /^(.+) \+$/],
  ['mark', /^([★¤▶◀↑↓←→✓•=]+ )(.+)$/],
  ['pair', /^(.+?): (.+)$/],
];

// the rules that only put translated parts back together look the same in every language
const L10N_DEFAULTS = { style_pts: '{1t}{2? ×#}! +{3}', gap2: '{1t}{2}{3t}', kit: '{1t} + {2t}', kit_top: '{1t} +', mark: '{1}{2t}', pair: '{1t}: {2t}' };

const L10N = {
  lang: 'en',
  raw: 0, // > 0: draw the text as given (the typed-out slice of a line that's already translated)
  tables: {},
  memo: new Map(),
  add(code, table) { this.tables[code] = table; },
  name(code) { const l = LANGS.find((q) => q[0] === code); return l ? l[1] : 'ENGLISH'; },
  // the player's choice (OPTIONS), else the browser's language, else English
  pick() {
    const saved = typeof Save !== 'undefined' && Save.data && Save.data.lang;
    if (saved && (saved === 'en' || this.tables[saved])) return saved;
    // the language of the portal page the game sits in (Poki: the site's language), then the browser's
    const site = typeof Platform !== 'undefined' && Platform.language && Platform.language();
    if (site && (site === 'en' || this.tables[site])) return site;
    const list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of list) {
      const c = String(l || '').slice(0, 2).toLowerCase();
      if (c === 'en') return 'en';
      if (this.tables[c]) return c;
    }
    return 'en';
  },
  set(code) {
    this.lang = code === 'en' || this.tables[code] ? code : 'en';
    this.memo.clear();
    if (Font.clear) Font.clear();
    // the page's own words: loading, the "rotate your phone" screen
    const dom = this.lang === 'en' ? null : this.tables[this.lang].dom;
    const put = (sel, en, key) => { const el = document.querySelector(sel); if (el) el.textContent = dom && dom[key] || en; };
    put('#boot', 'Loading', 'loading');
    put('#rotate > div:not(.phone)', 'Rotate your device', 'rotate');
    put('#rotate small', 'Blast Battalion plays in landscape', 'landscape');
    if (document.documentElement) document.documentElement.lang = this.lang === 'pt' ? 'pt-BR' : this.lang;
  },
  // the next language in the list (OPTIONS)
  next() { const i = LANGS.findIndex((q) => q[0] === this.lang); return LANGS[(i + 1) % LANGS.length][0]; },
  tr(s) {
    if (this.lang === 'en' || this.raw) return s;
    let r = this.memo.get(s);
    if (r === undefined) {
      r = this.look(s);
      if (this.memo.size > 6000) this.memo.clear();
      this.memo.set(s, r);
    }
    return r;
  },
  look(s) {
    const T = this.tables[this.lang];
    const w = T.words[s];
    if (w !== undefined) return w;
    // spaces around a phrase stay where they were ("DEPLOYED  " before the kit)
    const sp = /^(\s*)(.*?)(\s*)$/.exec(s);
    if (sp[1] || sp[3]) {
      if (!sp[2]) return s;
      const t = this.look(sp[2]);
      return t === sp[2] ? s : sp[1] + t + sp[3];
    }
    for (const [id, re] of L10N_RULES) {
      const tpl = T.rules[id] !== undefined ? T.rules[id] : L10N_DEFAULTS[id];
      if (tpl === undefined) continue;
      const m = re.exec(s);
      if (m) return this.fill(tpl, m, T);
    }
    return s;
  },
  fill(tpl, m, T) {
    return tpl.replace(/\{(\d)(t?)(\?[^}]*)?(\|[^}]*)?\}/g, (all, g, t, opt, plur) => {
      const v = m[+g];
      if (opt !== undefined) return v ? opt.slice(1).replace(/#/g, v) : '';
      if (plur !== undefined) {
        const forms = plur.slice(1).split('|'), n = parseInt(String(v || '0').replace(/,/g, ''), 10) || 0;
        return forms[Math.min(forms.length - 1, (T.plural || L10N.plural)(n))];
      }
      if (v === undefined) return '';
      return t ? this.look(v) : v;
    });
  },
  plural(n) { return n === 1 ? 0 : 1; },
};
