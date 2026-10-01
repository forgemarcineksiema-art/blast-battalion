# Release on CrazyGames and Poki — checklist

This file describes what to do before and after submitting the game to the portals, and how the game meets the portals' requirements. CrazyGames requirements were checked on 27.09.2026 and Poki's on 29.09.2026, in the portals' documentation (links at the end). Portals change their rules, so take a quick look at the current pages before submitting.

## 0. First, a decision: Poki or CrazyGames

**Poki requires web exclusivity.** A game released on Poki cannot be on other portals or aggregators. Steam, app stores and consoles are allowed. So the game can't be released on both portals at once. Poki's documentation doesn't say when exclusivity starts (from testing or from release), or how Poki treats games that are already on another portal. It also doesn't say whether it covers a web version on itch.io or on your own site (`blast-battalion-web.zip`). Ask Poki about this before uploading the game anywhere.

Recommendation from 29.09.2026: **Poki first, CrazyGames as plan B.** Poki's tests (section 5.1) are free and fast, publish nothing and give real data: player recordings arrive within minutes. The reverse order, i.e. a Basic Launch on CrazyGames, probably closes the road to Poki.

| | Poki | CrazyGames |
|---|---|---|
| exclusivity | required (web only) | not required |
| revenue | 50/50 on Poki traffic, 100% on your own traffic | per CrazyGames agreement |
| pre-release tests | recordings → Player Fit Test → Web Fit Test → review | Basic Launch → Full Launch |
| blood | nowhere (no option) | off by default, player can turn it on |
| thumbnails | square without text + animated 1080×1080 square | 16:9, 2:3, 1:1 covers with the title only |

## 1. Before building

1. Bump `VERSION` in `src/core.js`.
2. **Regression test** (about 1–2 minutes):
   - run `python tools/devserver.py 8321` and open `http://localhost:8321/index.html?debug=1&unlockall=1`;
   - paste into the browser console:
     ```js
     const s = document.createElement('script'); s.src = '/tools/harness.js'; document.head.appendChild(s);
     ```
     and then:
     ```js
     await REGRESS()
     ```
   - the result must start with `PASS`, i.e. 0 exceptions and 0 NaN. The console table shows, for each mission: outcome, kills, average update and draw time, and peak bullet and particle counts;
   - how many missions the bot finished is for information only: the bot can't do everything, e.g. it gets stuck under ceilings.
3. **Screen review** (overlapping elements on unusual screens):
   ```js
   for (const [w, h] of [[494, 240], [379, 214], [360, 192], [341, 256], [648, 270]]) { TT.logical(w, h); await TT.screens('q' + w + 'x' + h); }
   TT.unforce()
   ```
   Screenshots land in `%TEMP%\blast_shots`.
   After changes to difficulty, bosses or the economy, also compare versions with simulated players (approx. 6 min): `copy(JSON.stringify(await HUMANSIM({ players: 4 })))` (the result goes to the clipboard), paste it into a file `new.json` and run `python tools/funnel.py docs/metrics/sim_1.19.json new.json --timeouts pass`. The new version should have no new wall (a mission where many players get stuck) and no shorter average session. Details in [METRICS.md](METRICS.md).
4. **Tester session** following [PLAYTEST.md](PLAYTEST.md): all P1 items fixed.

## 2. Building and checking the packages

1. Run `node tools/build.mjs`. Output goes to `dist/`. The ZIP packages are about 210 KB, with no external files.
2. Web version: open `dist/web/index.html`. The game starts and the console is empty.
3. Poki: upload `blast-battalion-poki.zip` in Poki for Developers and run it through **Poki Inspector**. Locally, `?debug=1` turns on the SDK debug mode. On localhost and 127.0.0.1 the SDK logs every call to the console by itself (`POKI: PokiSDK.gameplayStart()`). With an empty save the game starts in M1, and `gameplayStart` should appear only after the first key press or touch, not when the hero lands.
4. CrazyGames: upload `blast-battalion-crazygames.zip` in the Developer Portal and check in the QA preview, where ads are simulated:
   - ad between missions (NEXT / RETRY / RESTART);
   - rewarded ad (CONTINUE +3 LIVES);
   - whether the sound goes quiet during the ad.
5. Phone (ideally a real Android and iPhone):
   - in portrait a "rotate device" screen appears;
   - in landscape the joystick and the FIRE / JUMP / SPEC / KNIFE buttons are visible;
   - sound comes back after minimizing the browser and touching the screen.

## 3. Portal materials (`marketing/`)

| File | Purpose |
|---|---|
| `cover_1920x1080.png` | CrazyGames: landscape cover 16:9 |
| `portrait_800x1200.png` | CrazyGames: portrait cover 2:3 |
| `square_800x800.png` | CrazyGames: square cover 1:1 |
| `preview_1920x1080.mp4` | CrazyGames: landscape preview video, 18 s, no sound |
| `preview_1080x1620.mp4` | CrazyGames: portrait 2:3 preview video, 18 s, no sound, no HUD |
| `poki_thumbnail_1080.png` | Poki: static thumbnail, 1080×1080 square, no text |
| `poki_animated_1080.mp4` | Poki: animated thumbnail, 1080×1080 square, 60 fps, no sound or HUD |

CrazyGames covers contain only the game's title. CrazyGames doesn't allow any other text, frames or store icons. Poki thumbnails have no text at all, not even the title. According to Poki's tests, players click thumbnails without text more often, and on small tiles text is unreadable anyway. They show one main hero in the default look, in motion, filling the whole area, without frames. Avoid the Poki site background color (#83FFE7).

If the portal form asks about the game's languages, tick: English, Spanish, Portuguese (Brazil), German, French, Polish. Old covers from version 1.0 are in `marketing/previous_v1.0/`, and those with the old logo (1.18) in `marketing/previous_v1.18/`. The `preview_*.mp4` videos still come from version 1.18 (old HUD).

How to regenerate the materials (page with `?debug=1&unlockall=1` on the dev server):
- covers and the Poki thumbnail:
  - inject `tools/harness.js` and `tools/keyart.js`;
  - run `await KEYART_ALL()` (CrazyGames covers and `poki_thumbnail_1080`);
  - copy the files from `%TEMP%\blast_shots` to `marketing/`. Explosions are random, so each run gives a slightly different image;
- Poki animated thumbnail: like the video below, square, at 60 fps and without HUD (Poki wants 4–6 s, 2–3 shots of 1–2 s each, 50+ fps): `await TRAILER.video('poki_animated_1080', [135, 135], 8, POKI_CLIPS, { noHud: true, clean: true, fps: 60 })`. `POKI_CLIPS` is in `tools/trailer.js`;
- video:
  - inject `tools/harness.js`, `tools/trailer.js` and `tools/mp4mux.js`, then run:
    ```js
    await TRAILER.video('preview_1920x1080', [480, 270], 4, [{ level: 3, sec: 4.5 }, { level: 7, sec: 4.5 }, { level: 12, sec: 4.5 }, { level: 4, sec: 4.5, steps: 2000, bossHp: 14 }])
    await TRAILER.video('preview_1080x1620', [180, 270], 6, [...same shots...], { noHud: true })
    ```
  - the bot plays each mission twice with the same random seed. The first time it picks the most spectacular 4.5 s, the second time it records that segment. H.264 encoding is done by the browser (WebCodecs), the file goes to `%TEMP%\blast_shots`.

## 4. CrazyGames requirements and game status

| Requirement | Status |
|---|---|
| Initial size ≤ 50 MB (≤ 20 MB to get onto the homepage on phones) | ✅ about 210 KB (ZIP), 615 KB unpacked |
| Works in Chrome and Edge (Safari: the game may be disabled if it doesn't work) | ✅ Chrome/Edge; Safari to be checked on an iPhone |
| Same physics at 60, 144 and 165 Hz | ✅ fixed 60 Hz simulation step, independent of the screen refresh rate |
| Readability at devicePixelRatio 1 in frames from 907×510 to 1920×1080 and on an 800×450 phone | ✅ integer scaling, and fractional when no integer scale fits (e.g. 640×360 → 445×250 view) |
| English | ✅ the whole game in English, plus Spanish, Portuguese (Brazil), German, French and Polish (browser language, change in OPTIONS → LANGUAGE) |
| No custom fullscreen button | ✅ none |
| No links or cross-promotion | ✅ none |
| PEGI 12 | ✅ cartoon violence; portal packages have no blood by default (BLOOD: OFF — dust instead of blood, an explosion throws the body instead of tearing it apart, no stains); the player can turn blood on in the options. Covers and videos are blood-free |
| Full Launch: a new player in gameplay after at most 1 click | ✅ ▶ PLAY → straight into the tutorial mission; returning player: ▶ CONTINUE → next mission |
| Ads only at natural breaks; frequency is controlled by the portal | ✅ NEXT, REPLAY, RETRY, RESTART, NEXT STAGE; the game has no ad counters of its own |
| Game sound muted during an ad | ✅ `Sound.setAdMuted` on `adStarted`, restored after `adFinished` or `adError` |
| Rewarded ad: optional, with a video icon, next to equally large buttons without an ad | ✅ RETRY above CONTINUE, same size, clapperboard icon |
| No reward on `adError` | ✅ message "NO VIDEO AVAILABLE RIGHT NOW", no reward |
| Game works with an adblocker | ✅ an ad that doesn't arrive doesn't block the game (8 s safety timeout) |
| Progress saving via the Data SDK module | ✅ the game uses `SDK.data` if available, otherwise localStorage. **When submitting, turn on the "Progress Save" toggle**, without it the Data module is disabled |
| Safe areas in the CrazyGames app (notch) | ✅ `env(safe-area-inset-*)` in `index.html` |
| Phone: no text selection or zooming | ✅ `user-select: none`, `touch-action: none` |
| iOS: resume AudioContext after a gesture | ✅ `Sound.unlock()` on every touch, click and key press |
| Covers 1920×1080, 800×1200, 800×800, title only | ✅ `marketing/` |
| Video 15–20 s, 1080p landscape 16:9 and portrait 2:3, no sound, black bars, cursor or ad text, no speed-up | ✅ `marketing/preview_*.mp4` (18 s, 30 fps, real time) |
| Full Launch: CrazyGames account (player name and avatar in the game, automatic login) | ⏳ not done. Not required for Basic Launch; to do if the game moves to Full Launch |

## 5. Poki requirements and game status

Checked on 29.09.2026 against [Poki's requirements](https://developers.poki.com/guide/requirements-quality) and [content rules](https://developers.poki.com/guide/content-player-safety).

| Requirement | Status |
|---|---|
| **Web exclusivity** | ⚠️ decision, see section 0 |
| Desktop, phone and tablet; full screen on phones (portrait or landscape) | ✅ landscape; in portrait a "rotate device" screen |
| 16:9 aspect ratio, scaling to 640×360, 836×470 and 1031×580 | ✅ (640×360 at dpr 1 → 445×250 view at scale 1.44) |
| Loading under 10 s (players leave after 10 s) | ✅ about 210 KB |
| localStorage in try/catch (incognito mode) | ✅ `Platform.storeGet/storeSet` |
| Progress saving | ✅ `Save` in localStorage |
| No external requests (fonts and assets in the package) | ✅ the Russo One font is in the package; only the portal SDK loads from outside |
| No splash screens or outgoing links (a studio logo may be shown on the loading screen) | ✅ |
| Game works with an adblocker, without a "turn off your adblocker" message | ✅ |
| `gameplayStart()` on the **player's first input**, not on load; no two starts or two stops in a row | ✅ since 1.33.1. A new player goes straight into M1, so `Platform` holds the start until the first key, touch, click or gamepad button. Before, the start fired when the hero landed, without any player input. The `inGameplay` flag blocks repeats |
| `gameplayStop()` at every break: pause, menu, end of mission, cutscene | ✅ |
| `commercialBreak()` on the way from a break back to gameplay; no ad counters of your own | ✅ NEXT, REPLAY, RETRY, RESTART, NEXT STAGE |
| Sound muted during an ad | ✅ `Sound.setAdMuted` |
| Reward button is not green, has a 🎬 icon, the regular button is above or next to it and is at least as large | ✅ RETRY above CONTINUE |
| One ad = one reward, no double reward; no reward with an adblocker | ✅ a second click reuses the same ad request; without an ad, "NO VIDEO AVAILABLE RIGHT NOW" |
| Poki ads only: no in-game purchases, third-party ads or dual currencies (e.g. gems + coins) | ✅ one currency ($) earned in the game; the rewarded ad is optional |
| No developer tools in the package | ✅ the F2 and F3 panels and `window.__bb` work only in the web version and the artifact |
| Pause on Esc or Space | ✅ Esc / P |
| Skippable cutscenes | ✅ there are no long cutscenes: mission entry takes 1.3 s, the helicopter departure about 3 s; the gunship flight can be skipped by holding jump |
| Tutorial through pictures, not text | ✅ pictograms with keys (1.27), nothing to read during action (1.33) |
| Touch controls on phones and tablets, key hints on desktop | ✅ touch mode on `pointer: coarse` |
| Content for everyone, including children: no wounds or visible bodily fluids | ✅ since 1.33.1 the Poki package has no blood at all, and the BLOOD option disappears (`Settings.bloodOption`); the ROID RAGE item (steroids) is called BERSERK |
| Static thumbnail: square at least 628×628, no text | ✅ `marketing/poki_thumbnail_1080.png` |
| Animated thumbnail: 1080×1080 square, 4–6 s, 50+ fps, MP4 without sound, no cursor | ✅ `marketing/poki_animated_1080.mp4` |

Things a reviewer may ask about, although the rules don't explicitly forbid them: an enemy screaming during a long fall, burning soldiers running around in panic, dogs among the enemies. In cartoon pixel art this will probably pass; change it only if Poki asks.

### 5.1 Poki testing path

1. **Playtest recordings.** After uploading the package in Poki for Developers, 10 recordings of real players arrive, usually within minutes. They can be ordered repeatedly. You have to watch at least 5 to unlock the next step. The recordings replace the tester session from [PLAYTEST.md](PLAYTEST.md). Look at the same spots: the first 30 s in M1, whether the player finds the colonel in M4, boss fights, players on phones.
2. **Player Fit Test.** The game goes to 500 Poki players. Only playtime is measured. To pass, the average playtime must exceed 3 minutes, and at least 25% of sessions must last over 3 minutes. The test takes about 5 hours, at most 2 per day.
3. **Web Fit Test.** For about 7 days the game is in the portal's real categories. Measured: thumbnail click-through rate, time on page and conversion to play, compared with the category average.
4. **Review** (1–2 weeks), then release. Target before review: 65%+ conversion and 5+ minutes of play on average. An average game on Poki has about 70% conversion and 6+ minutes.

The model from [METRICS.md](METRICS.md) predicts about 84% conversion and about 11-minute sessions, but it hasn't seen a single real player yet. The biggest unknown is phones: the game works only in landscape and has a virtual joystick in a precision shooter.

## 6. After submitting

- Poki: after each test, compare the result with the thresholds from section 5.1. If the Player Fit Test fails, watch the recordings from the spots where players leave (Poki suggests: getting into the game, clarity of controls and goal, loading time), fix things and order another test.
- First days on CrazyGames (Basic Launch), if CrazyGames was chosen:
  - watch the average playtime and the share of players who come back;
  - compare these numbers with the playtest reports (F3), especially with the spots where players got stuck or died.
- Every update:
  - bump `VERSION`;
  - after changing text: add it to the translations (`src/lang_*.js`) and run `python tools/check_lang.py`;
  - run `REGRESS()`;
  - build the packages and upload them again. Players' saves (`blastbattalion_save_v1`) are kept.

## Sources

- CrazyGames:
  - [general requirements](https://docs.crazygames.com/requirements/intro/)
  - [technical](https://docs.crazygames.com/requirements/technical/)
  - [gameplay](https://docs.crazygames.com/requirements/gameplay/)
  - [ads](https://docs.crazygames.com/requirements/ads/)
  - [account and saves](https://docs.crazygames.com/requirements/account-integration/)
  - [Data module](https://docs.crazygames.com/sdk/data/)
  - [covers and video](https://docs.crazygames.com/requirements/game-covers/)
- Poki:
  - [requirements and guidelines](https://developers.poki.com/guide/requirements-quality)
  - [working with Poki (exclusivity, revenue)](https://developers.poki.com/guide/working-with-poki)
  - [how testing works](https://developers.poki.com/guide/how-testing-works)
  - [Player Fit Test](https://developers.poki.com/guide/player-fit-test)
  - [content and player safety](https://developers.poki.com/guide/content-player-safety)
  - [static thumbnail](https://developers.poki.com/guide/thumbnail)
  - [game page and animated thumbnail](https://developers.poki.com/guide/your-game-page)
