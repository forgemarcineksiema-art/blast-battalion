# Forecasting metrics without data — simulated players and a funnel model

Portals judge a game by three numbers: **conversion** (how many players who arrived play at least a minute), **average session time** and **next-day returns (D1)**. Real numbers will only come from a Basic Launch on CrazyGames (at least 7 days and 500 sessions). Until then we compare versions with this tool: simulated new players play the campaign, and a funnel model turns their results into predicted metrics.

**Most important caveat:** absolute values depend on the assumptions (table below). The tool is for comparing versions and finding difficulty walls, not for promising a result.

## 1. Simulated players — `HUMANSIM()` in `tools/harness.js`

The test bot from the regression test is immortal and reacts instantly. A simulated player doesn't:
- notices a soldier only after a reaction time;
- often stops to aim, and sometimes hesitates for no reason;
- jumps late and dodges only some of the projectiles;
- sometimes falls into a pit;
- shoots only at what it sees (rock and walls block sight, ground at the same level doesn't);
- gives up on a target it can't hit after a few seconds;
- climbs a ladder when stuck;
- goes back for a mission goal that the arrow shows behind it.

| Profile | Share of portal traffic | Reaction | Stops to shoot | Dodge: bullets / explosive projectiles | Hesitation |
|---|---|---|---|---|---|
| rookie (e.g. a kid on a phone) | 35% | 0.6 s | 60% | 8% / 40% | 0.25/s |
| average portal player | 45% | 0.4 s | 40% | 30% / 65% | 0.12/s |
| skilled (plays platformers) | 20% | 0.25 s | 20% | 60% / 85% | 0.05/s |

Each simulated player starts from an empty save and plays the campaign from mission 1. A lost mission is repeated (up to 4 attempts), and money is spent on the cheapest upgrade, like a new player would. The output is one row per attempt: time, deaths with cause and location, prisoners, outcome (completed / defeat / stuck after 6 minutes).

```js
await HUMANSIM({ profiles: ['rookie', 'casual', 'skilled'], players: 4 })  // approx. 6 min
await HUMANBOSS({ level: 9, tries: 6 })   // a single mission (e.g. a boss), save from mid-campaign
```

## 2. Funnel model — `tools/funnel.py`

The model assembles 20,000 sessions from the simulated players' attempts and adds behavior typical of portal traffic:

| Assumption | Value |
|---|---|
| leaving on the title screen | 3% |
| "not my kind of game" in the first minute | 10% |
| boredom during play | 2.5% per minute, rising by 0.08 percentage points each minute |
| rage quit after losing a hero | 1.5% |
| leaving after the 1st / 2nd / 3rd / 4th defeat in a row | 25 / 40 / 55 / 65% |
| leaving on the results screen (natural end) | 8%, +3% when an ad plays (portals: at most 1 per approx. 3 min) |
| human vs. bot time | ×1.25 (reading, looking around) |
| D1 by session length | <2 min 2%, 2–5 min 6%, 5–10 min 10%, 10–20 min 16%, 20–40 min 22%, longer 25%; completed campaign ×0.6 |
| supply panel with tomorrow's reward in the 1st session (since 1.19) | D1 ×1.1 |

**Bot stalls.** The bot doesn't find the way up to the upper floor of the colonel's HQ (assassination missions, always at approx. 56% of the map). Sometimes it also misses the evacuation ladder. A human with the goal arrow will usually manage. So the model computes two variants:
- `--timeouts fail`: the human gives up too (lower bound);
- `--timeouts pass`: the human finds the way after a minute of searching (main variant).

```bash
python tools/funnel.py docs/metrics/sim_1.18.json docs/metrics/sim_1.19.json --drop-after --timeouts pass
```

## 3. Results: 1.18 → 1.19

| Metric (portal target) | 1.18 | 1.19 | lower bound 1.18 → 1.19 |
|---|---|---|---|
| conversion, ≥ 1 min of play (80%+) | 84% | 84% | 85% → 83% |
| average session time (10+ min) | 10.7 min | **11.2 min** | 9.3 → 9.1 min |
| D1 (10–15%) | 10.9% | **12.4%** | 10.5 → 11.3% |

More reliable than these numbers is the hard data from the simulation (12 players per version, approx. 220 attempts):

| | 1.18 | 1.19 |
|---|---|---|
| deaths from falling debris | 134 | 13 |
| deaths from colliding with a boss | 14 | 9 (and each is now only 1 HP) |
| lost missions outside mission 10 | 15 | 5 |
| mission 10, targeted test: wins / heroes lost per attempt | 1 of 18 / 5.6 | 5 of 18 / 4.1 |
| share of players who get through M3 / M4 / M5 (model) | 51 / 41 / 28% | 59 / 47 / 33% |

## 4. What the simulation showed

- **Conversion is safe.** One click to play, first explosion after approx. 3 s, mission 1 lasts approx. a minute. The number depends mainly on the bounce assumptions, not on the game. The risks lie outside the model: a pre-roll ad on the portal and the "rotate your phone" screen on mobiles.
- **Session time is the weakest metric.** Sessions end mainly at difficulty walls: mission 3 (escape), mission 4 (colonel on the upper floor), mission 5 (tank), mission 10 (helicopter). The second reason is ordinary exits on the results screen.
- **The most common deaths in 1.18 looked unfair:**
  - falling debris killed in one hit, even in mission 1;
  - touching the tank killed instantly;
  - the tank shell and the helicopter's rockets fell without warning, although the mortar had a red marker.
- **D1 depends on the length of the first session and on a reason to come back.** The daily supply drop was only on the title screen. A player who moves through missions with the NEXT button never saw it in the first session.

## 5. Decisions in 1.19

| Change | Metric | Why |
|---|---|---|
| debris and boss collision: 1 HP and knockback instead of death | session time | the first and second cause of "no-fault deaths"; fewer defeats = fewer exits |
| markers for the tank shell and for the helicopter's rockets and bombs; fewer rockets per salvo | session time | a fair dodge; the biggest wall in the campaign |
| +1 life on the next attempt after a defeat (max +2), "RETRY +1 LIFE" | session time | 25–40% of players leave after a defeat; the promise of an easier attempt keeps some of them, and the wall becomes passable |
| "TIP:" hint after death (and for a boss: how to beat it) | session time, D1 | death teaches instead of just taking a life (the bot doesn't learn, so the model doesn't count this) |
| supply drop after the first mission of the day: "DAY 1 — TOMORROW +$60" | D1 | the player learns already in the 1st session that a bigger reward awaits tomorrow |

## 6. Next steps (in order)

1. **Basic Launch on CrazyGames**: real metrics will replace the model. Compare them with the table in section 3 and correct the assumptions in `ASSUME`.
2. **Playtest with 2–3 new players** focused on the spots from the simulation (list in [PLAYTEST.md](PLAYTEST.md)). In particular: does the player find the colonel in mission 4 on their own, and do they climb the pillars in the helicopter fight.
3. If the average session time comes out below 10 min: flatten the walls pointed out by the F3 report (e.g. the colonel runs down to the ground floor when the player is close; a shorter mission 10 arena).
4. If D1 comes out below 10%: give a stronger reason to come back, e.g. rotating daily mission modifiers or a crate after a 7-day streak with a visible reward (a hero skin).
5. If conversion on phones comes out clearly lower than on computers: a portrait mode instead of the "rotate your phone" screen (a lot of work).

## 7. Limitations

- The bot doesn't learn: post-death hints and markers work on humans, not on the bot. So the model understates the effect of these changes.
- The bot navigates poorly (the upper floor of the colonel's HQ, the pillars in the helicopter arena). Missions 4, 8, 13 and 10 come out harder in the simulation than for humans.
- 12 simulated players per version is a small sample. Differences of a few tenths of a minute are within noise. The direction of change is shown by the hard numbers from section 3 (deaths, defeats, wins).
- The assumptions about leaving come from general knowledge of browser games, not from this game's data. They need to be calibrated after the Basic Launch.
