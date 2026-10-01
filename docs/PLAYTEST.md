# Playtest — a session with first-time players

**Goal:** see the game through the eyes of someone who doesn't know it, and turn that into a list of fixes.

**Who:** 2–3 people who have never played Blast Battalion. Ideally different: someone who often plays browser or mobile games, and someone who rarely plays.

**How long:** 15–20 minutes of play per person plus 5 minutes of conversation. Each person plays alone, the others don't watch.

---

## 1. Preparation (5 minutes before the first person)

1. **Game version.** There are three options:
   - the artifact (link from the chat) — it's private, so on someone else's device it only works after sharing it in the *Share* menu;
   - locally: `python tools/devserver.py 8321`, then http://localhost:8321;
   - the file `dist/web/index.html`, for example on the tester's own device.

   The Poki and CrazyGames versions have no test log.
2. **Clean start.** Press **F3** (the "Playtest report" panel). Enter a label without a full name, e.g. "Tester A", and click **New tester** twice. The page reloads with empty progress, like for someone playing for the first time. Your own save is set aside.
   - On a phone or tablet without a keyboard, the panel opens with five quick taps on the version number (top-left corner of the title screen). After "New tester" the game starts straight in mission 1, without the title screen (1.31). On a phone, to get the report, go to the title screen via pause (exit the mission, then back).
3. **Tuning.** If the F3 panel shows a yellow warning about changed tuning and you want to test the defaults, open **F2** and click **Reset**.
4. **Conditions.** Sound on (headphones or speaker), a large window or full screen. The kind of device the tester usually plays on: a computer or a phone in landscape.
5. **Notes.** Prepare a sheet of paper or a notebook with the table from section 6, and a clock (you count time from the start).

## 2. What to say at the start

> "This is an action game in the browser. Play the way you would on your own at home. Think out loud: what you're trying to do, what surprises you, what annoys you. We're testing the game, not you. I won't give hints, because I want to see where the game doesn't explain itself."

Explain nothing more: neither the controls nor the goal of the game.

## 3. Rules for the observer

- **Don't give hints.** To "what should I do?" answer "what do you think?".
- **Help only** when someone has been stuck for more than 2 minutes or wants to stop. Then write down exactly what you helped with. That's the most valuable finding of the whole session.
- **Write down the time and the player's exact words.** A quote ("I don't know why I died") says more than a rating.
- **Don't defend the game or explain bugs.** If something doesn't work, note it and keep playing.
- **Watch the face and hands**, not just the screen: laughter, sighs, searching for keys, glancing at the phone.

## 4. Flow (about 20 minutes)

| Time | What happens | What you watch for |
|---|---|---|
| 0–1 min | start: straight into mission 1, logo over the helicopter drop | Do they understand they're already playing? Do they move on their own before seeing the keys above the hero? Are they waiting for something? |
| first seconds of mission 1 | welcome barrels | Do they shoot the barrels after the "J: SHOOT" hint? Does the chain of explosions impress? Do they know how to get out of the crater? |
| 1–10 min | campaign from mission 1 (tutorial), then onward | first minute of moving and shooting, first fight, first death |
| 10–15 min | free play: more missions, Arcade or Heroes, whatever the tester prefers | Do they want to keep playing on their own? What do they choose? |
| end | the tester says "that's enough" (note when and why) or 20 minutes pass | don't drag it out |
| +5 min | conversation (section 5) | |
| at the very end | **F3 → Copy** (after the last person: **Copy all**) | paste the report into the chat together with your notes |

### Observation checklist

**First minute**
- Did they find move, jump and shoot without searching? How long did it take?
- Do they read the tutorial signs? Do they stop at them or walk past?
- Do they understand that bullets dig into the ground and destroy terrain?

**Combat and death**
- Do they notice the enemy's red aiming line? Do they react (jump, slide, take cover)?
- After a hit, do they know they lost a health point? The hearts in the hero panel (top-left corner) are health points; a lost heart turns grey, the last one pulses. The "×3" helmet below is the hero reserve (lives).
- After dying, do they know **why** they died? Ask briefly: "what happened?".
- Is any enemy clearly frustrating (dogs, shield soldiers, mortars, suicide bombers)?

**Understanding the game**
- Do they understand that freeing a prisoner gives a new hero and an extra life?
- Do they notice the hero change and the new weapon?
- Do they understand the mission goal (flag, helicopter; in later missions assassination, fuel depots, escape)?
- Do they know where to go? Do they backtrack needlessly?

**Mechanics: did they discover them on their own?**
- special (K / C) and its counter;
- knife (L / V), kicking a barrel, deflecting a grenade;
- slide (run + ↓), stomping on heads;
- grabbing a soldier (holding knife) and throwing;
- mech (↑ at the mech, exit by holding ↓);
- golden crates and the items from them;
- green barrels and fuel pipes (in mission 2): do they understand that a bullet makes a leak and fire ignites the puddle? Do they come up with the idea of igniting the trail or kicking the barrel?
- rope bridge (in mission 2): do they shoot the post when soldiers are standing on it? After the bridge collapses, do they know how to get out of the chasm (ladder on the other side)?

**Spots flagged by the player simulation (1.19, [METRICS.md](METRICS.md))** — the bot can't settle these, a human can:
- mission 3 (escape before detonation): does the player understand they have to run, or do they stop to shoot?
- mission 4 (assassination): do they find the way up to the colonel on the upper floor of the HQ on their own? The bot doesn't find it;
- bosses (missions 5 and 10): do they see the red projectile markers and step out of them?
- after death: do they read the bar with the yellow TIP label (at the bottom of the screen), and next time do they do what it advises?
- defeat screen: do they choose "RETRY +1 LIFE" (and do they even notice the extra life)?
- after the first mission: do they understand the SUPPLY DROP panel ("more tomorrow")? Ask after the game: "will you come back tomorrow? why?".

**Vehicles, secrets, mini-bosses (1.22–1.24)**
- gunship flight (mission 6): do they fire the gun, or skip the flight right away?
- tank (mission 8): do they get in? Do they understand that the cannon aims along an arc by itself?
- secret: do they notice the glint from the cracked ground and try to jump on it?
- walls (1.26): do they grab a wall on purpose and shoot from it? Do they discover the wall turn (direction away from the wall) and the wall jump? Does anything about jumping surprise them (ask: "what did the hero do that you didn't expect?")?
- wardrobe: do they notice the marker on HEROES and look into WARDROBE? Do they buy anything, and what do they pick? Is trying on (the first click) clear?
- mini-boss (mission 4 JUGGERNAUT, mission 7 THE DOZER): do they discover the weak spot on their own (back, cab), or shoot the armor? Do they dodge the charge after the red light? Do they take cover or jump over when they see the laser?

**HUD and tutorial (1.27)**
- pictogram signs in mission 1: does the tester do what the sign shows without asking? Which one is unclear? After the mission ask: "what did the sign with the cage say? and the one with the wall?";
- dog tag: do they know how many hearts and specials they have, and which key throws a special? Do they notice the prisoner cages and the helmet with lives?
- mission route at the top: do they glance at it to check how much is left? Do they understand the red flag (goal not yet completed)?
- INTEL card: do they read it and do what it advises (e.g. move when the sniper's laser turns white)?
- does anything on screen cover the action or get in the way? Ask after the game: "did anything on screen bother you or was it unclear?".
- menu (1.28): do they click the yellow button right away to keep playing? In mission select, do they understand the routes and the golden line? On the results screen, do they know what they got the medals for?

**Languages (1.29)** — when the tester prefers a language other than English:
- the game picks the browser language by itself; check whether it picked correctly (OPTIONS → LANGUAGE);
- is any text incomprehensible, oddly translated or cut off? Write down the exact wording and the screen;
- does the tester understand sentences with numbers (e.g. how many kills, how many lives) and the cause-of-death text?

**Arcade and daily mission (1.20)** — if the tester goes there on their own:
- do they read the upgrade cards, or click the first one at hand? Which one do they choose, and do they feel its effect?
- after a run ends, do they start a new one right away ("one more")?
- does the daily rule amuse them, and do they understand it from the text at the start alone?
- do they notice the heroes' lines and Grimm's radio? Are they funny or annoying?

**Emotions**
- What caused laughter, a "wow" or "what a ride"?
- Where does frustration or boredom appear (glancing at the phone, aimless fast clicking)?

## 5. Questions after the game

1. Tell me in your own words what this game is about.
2. What was the most fun? What moment will you remember?
3. What was the most frustrating or unfair?
4. Was anything unclear: controls, mission goal, why you died?
5. What did the red line before an enemy's shot mean?
6. What happens when you free a prisoner?
7. Rate from 1 to 5: difficulty (1 = too easy, 3 = just right, 5 = too hard) and control comfort (1 = uncomfortable, 5 = very comfortable).
8. Would you play again? On what: computer or phone? Would you recommend it to someone?
9. What did you miss?

## 6. Note sheet (one per person)

Tester: ________ Device: ________ Date: ________

| Time | What happened | Reaction or quote | My hypothesis |
|---|---|---|---|
| 0:40 | walked past the SLIDE sign and didn't use the slide | "how do I crouch again?" | sign too small / too early |
| | | | |

## 7. What the game records by itself (F3 panel)

- the course of each mission: result, time, farthest point, prisoners, heroes, what the player did at the end (retry, menu, next);
- every death: cause, killer (enemy type, barrel, mine, boss…), location as a percentage of mission length;
- hits that didn't kill, broken down by cause;
- stalls: at least 25 s without progress to the right, with the height of the wall in front of the hero and the number of enemies nearby;
- idleness: at least 15 s without pressing any key;
- attempts to evacuate before completing the mission goal;
- first use of each key and each mechanic (playtime and mission), and a list of those the player didn't use;
- pauses, menu clicks, hardware and screen size, changed tuning;
- a **THINGS TO CHECK** section with automatic hints on what to ask about.

The data stays in this browser (localStorage), nothing is sent anywhere. The archive keeps the last 5 logs. After the last tester, click **Restore my save**: your progress from before the tests comes back.

## 8. After the session

Paste into the chat:
- the reports (**Copy all**);
- the note sheets;
- the answers to the questions.

Claude will turn this into a prioritized list of fixes:
- **P1** — someone got stuck, stopped playing, or kept dying without knowing why;
- **P2** — something was unclear, but the player managed;
- **P3** — polish and cosmetics.

P1 fixes come first, new features after.
