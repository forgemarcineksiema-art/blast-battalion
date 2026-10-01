"""Predicted portal metrics from simulated players (dev tool, never shipped).

Input: the JSON that HUMANSIM() in tools/harness.js returns (one row per mission attempt of a
simulated first-time player: profile, mission, outcome, time, deaths). This bootstraps whole
sessions from those attempts and applies churn assumptions typical of web-portal traffic,
then reports the three numbers the portals judge a game by:

  conversion  - share of players who start a mission and play at least 60 s
  playtime    - average time in the game per session (menus and results included)
  D1          - share coming back the next day (a rough mapping from session length and
                whether the campaign is left unfinished; the least certain of the three)

The churn numbers below are assumptions (see ASSUME), not measurements - compare builds with
them, don't read the absolute values as a forecast.

  python tools/funnel.py runs.json [runs_after.json] [--n 20000] [--drop-after] [--timeouts fail|pass]
"""
import json, math, random, sys
from collections import defaultdict

ASSUME = {
    'mix': {'rookie': 0.35, 'casual': 0.45, 'skilled': 0.20},  # portal audience
    'human_time': 1.25,     # people take longer than the bot: reading, looking around
    'title_leave': 0.03,    # leave on the title screen (one click to play)
    'bounce': 0.10,         # "not my kind of game": leave somewhere in the first minute
    'bore0': 0.025,         # per-minute chance to drift away while playing ...
    'bore_grow': 0.0008,    # ... growing a little with every minute (novelty wears off)
    'death_quit': 0.015,    # rage-quit chance per lost hero
    'fail_quit': [0.25, 0.40, 0.55, 0.65],  # leave after the 1st/2nd/3rd/4th failure in a row
    'break_quit': 0.08,     # leave at a mission's results screen (natural stopping point)
    'ad_quit': 0.03,        # extra, when an ad plays there (portals cap them at ~1 per 3 min)
    'between': 20,          # seconds in results screens / menus per mission
    'timeout_as': 150,      # a stuck attempt: seconds before the person gives up on it
    'timeouts': 'fail',     # a simulated player stuck until the time limit (the bot can't find
                            # the way up to the colonel, or an objective): 'fail' = a person gives
                            # up too (pessimistic), 'pass' = a person finds the way after a minute
                            # of searching, following the objective arrow (optimistic)
    'drop_d1': 1.10,        # --drop: players who saw the supply drop panel (and tomorrow's bigger
                            # drop) in session one come back a little more often (+10% relative)
}


def load(path):
    rows = json.load(open(path, encoding='utf-8'))
    # per profile, per mission: the attempt sequences of every simulated player who got there
    seqs = defaultdict(lambda: defaultdict(list))
    cur = {}
    for r in rows:
        key = (r['player'], r['lv'])
        if key not in cur:
            cur[key] = []
            seqs[r['prof']][r['lv']].append(cur[key])
        cur[key].append(r)
    # median time of a completed attempt per mission (for --timeouts pass)
    done = defaultdict(list)
    for r in rows:
        if r['end'] == 'complete':
            done[r['lv']].append(r['time'])
    seqs['_median'] = {lv: sorted(v)[len(v) // 2] for lv, v in done.items()}
    return seqs


def d1_chance(minutes, unfinished):
    """Rough next-day return by session length (web portals); finishing the campaign removes
    the main reason to come back. Returns a probability."""
    table = [(2, 0.02), (5, 0.06), (10, 0.10), (20, 0.16), (40, 0.22), (1e9, 0.25)]
    for lim, p in table:
        if minutes < lim:
            base = p
            break
    return base if unfinished else base * 0.6


def session(seqs, prof, rng, A):
    """One simulated first session: returns (seconds played, reached 60 s, missions cleared, D1 chance)."""
    t = 0.0          # time in the game
    play = 0.0       # time actually playing (for the 60 s conversion rule)
    last_ad = 0.0
    if rng.random() < A['title_leave']:
        return 5.0, False, 0, 0.0
    bounce_at = rng.uniform(10, 60) if rng.random() < A['bounce'] else None
    cleared = 0
    minutes = lambda: t / 60
    for lv in range(1, 16):
        options = seqs[prof].get(lv)
        if not options:
            # no simulated player of this kind got this far: end the session here
            return t, play >= 60, cleared, d1_chance(minutes(), True)
        attempts = rng.choice(options)
        fails = 0
        done = False
        for a in attempts:
            end = a['end']
            if end == 'timeout' and A['timeouts'] == 'pass':
                end = 'complete'
                dur = (seqs['_median'].get(lv, 120) + 60) * A['human_time']
            else:
                dur = (A['timeout_as'] if end == 'timeout' else a['time']) * A['human_time']
            # drift away mid-attempt (boredom grows with time), or bounce in the first minute
            h = A['bore0'] + A['bore_grow'] * minutes()
            leave_in = rng.expovariate(h / 60) if h > 0 else 1e9
            if bounce_at is not None and play + dur >= bounce_at:
                leave_in = min(leave_in, bounce_at - play)
            for _ in range(a['deaths']):
                if rng.random() < A['death_quit']:
                    leave_in = min(leave_in, rng.uniform(0, dur))
            if leave_in < dur:
                t += leave_in; play += leave_in
                return t, play >= 60, cleared, d1_chance(minutes(), True)
            t += dur; play += dur
            if end == 'complete':
                done = True
                break
            fails += 1
            if rng.random() < A['fail_quit'][min(fails, 4) - 1]:
                return t, play >= 60, cleared, d1_chance(minutes(), True)
            t += 8  # the failure screen
        if not done:
            # every recorded attempt failed: this person is stuck here and leaves
            return t, play >= 60, cleared, d1_chance(minutes(), True)
        cleared = lv
        t += A['between']
        quit_p = A['break_quit']
        if t - last_ad >= 180:
            quit_p += A['ad_quit']; last_ad = t; t += 15
        if lv < 15 and rng.random() < quit_p:
            return t, play >= 60, cleared, d1_chance(minutes(), True)
    return t + 60, play >= 60, cleared, d1_chance(minutes(), cleared < 15)


def report(path, n, A, label, drop=False):
    seqs = load(path)
    rng = random.Random(7)
    profs = list(A['mix'])
    weights = [A['mix'][p] for p in profs]
    tot = conv = d1 = 0.0
    reach = defaultdict(int)
    for _ in range(n):
        prof = rng.choices(profs, weights)[0]
        secs, c, cleared, p1 = session(seqs, prof, rng, A)
        if drop and cleared >= 1:
            p1 *= A['drop_d1']
        tot += secs; conv += c; d1 += p1
        reach[cleared] += 1
    print(f'== {label}: {path}')
    print(f'   conversion (>=60 s play): {100 * conv / n:5.1f} %')
    print(f'   avg time per session:     {tot / n / 60:5.1f} min')
    print(f'   D1 (rough):               {100 * d1 / n:5.1f} %')
    cum = 0
    line = []
    for lv in range(0, 16):
        cum += reach[lv]
    left = n
    for lv in range(1, 16):
        left -= reach[lv - 1]
        line.append(f'M{lv}:{100 * left / n:.0f}%')
    print('   players who clear ... ', ' '.join(line[:8]))
    print('                         ', ' '.join(line[8:]))
    # per-mission difficulty seen in the simulation
    print('   mission  1st-try clear  (rookie/casual/skilled)   avg attempt time')
    for lv in range(1, 16):
        cells, times = [], []
        for p in profs:
            opts = seqs[p].get(lv, [])
            if opts:
                cells.append(f'{100 * sum(o[0]["end"] == "complete" for o in opts) / len(opts):3.0f}%')
                times += [a['time'] for o in opts for a in o if a['end'] == 'complete']
            else:
                cells.append('  - ')
        avg = f'{sum(times) / len(times):4.0f} s' if times else '   -'
        print(f'   M{lv:<2}     {" / ".join(cells)}          {avg}')


if __name__ == '__main__':
    # python tools/funnel.py before.json [after.json] [--n 20000] [--drop-after] [--timeouts fail|pass]
    argv = sys.argv[1:]
    n = int(argv[argv.index('--n') + 1]) if '--n' in argv else 20000
    if '--timeouts' in argv:
        ASSUME['timeouts'] = argv[argv.index('--timeouts') + 1]
    args = [a for i, a in enumerate(argv) if not a.startswith('--') and not (i and argv[i - 1] in ('--n', '--timeouts'))]
    for i, path in enumerate(args):
        label = 'before' if i == 0 and len(args) > 1 else 'after' if i else 'build'
        report(path, n, ASSUME, label, drop=(i > 0 and '--drop-after' in argv))
