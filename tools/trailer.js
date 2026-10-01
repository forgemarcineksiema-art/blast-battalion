// Dev-only: records gameplay clips for the portal preview videos. Needs tools/harness.js (the bot)
// and, for MP4 output, tools/mp4mux.js. Files land in %TEMP%/blast_shots via the dev server.
//
// A clip is found in two passes over the same mission: SCAN plays it with the god-mode bot and
// scores every moment (kills, explosions, boss hits, not standing still), then a replay captures the
// best window. Replays match because Math.random is seeded for the simulation and the page's own
// loop is paused whenever the script is not stepping the game.
//
//   await TRAILER.video('preview_1920x1080', [480, 270], 4, [{ level: 3, sec: 4.5 }, { level: 7, sec: 4.5 }])
//   await TRAILER.make('frames', [480, 270], [{ level: 3, sec: 4.5 }])   // PNG frames, for a closer look
//   await TRAILER.video('poki_animated_1080', [135, 135], 8, POKI_CLIPS, { noHud: true, clean: true, fps: 60 })
/* eslint-disable no-undef */
// Poki's animated thumbnail: a 1080x1080 square, 4-6 s, 2-3 scenes of 1-2 s, 50+ fps, no UI and no text.
// A close view (135 px) keeps the heroes big in a square
window.POKI_CLIPS = [{ level: 3, sec: 1.8 }, { level: 7, sec: 1.8 }, { level: 11, sec: 1.8 }];
window.TRAILER = {
  booms: 0,
  mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // pause the page's own loop (it would step and draw between our awaits)
  lock() {
    if (this.U) return;
    this.U = App.update; this.D = App.draw; this.R = Math.random;
    App.update = () => {}; App.draw = () => {};
    if (!this.wrapped) {
      this.wrapped = true;
      const ex = FX.explosion;
      FX.explosion = function (x, y, r, o) { TRAILER.booms += r; return ex.call(this, x, y, r, o); };
    }
  },
  unlock() {
    if (!this.U) return;
    App.update = this.U; App.draw = this.D; Math.random = this.R; this.U = null;
    if (this.saveSnap) { Save.data = JSON.parse(this.saveSnap); this.saveSnap = null; applyFxSetting(); Settings.apply(); }
  },
  // run fn with the real loop functions and the seeded random; audio is switched off meanwhile,
  // because sound effects draw random numbers on a real-time throttle
  sim(fn) {
    const actx = Sound.ctx;
    App.update = this.U; App.draw = this.D; Math.random = this.rng; Sound.ctx = null;
    try { return fn(); } finally { App.update = () => {}; App.draw = () => {}; Math.random = this.R; Sound.ctx = actx; }
  },
  begin(level, seed, size, noHud) {
    this.lock();
    if (size[0] < size[1] * 1.25) TT.raw(size[0], size[1]); // portrait: the game would letterbox it
    else TT.logical(size[0], size[1]);
    this.rng = this.mulberry(seed);
    // every run starts from the same save (one-time tips and rescues change how a run plays out),
    // the same input state and the same particle slot
    if (!this.saveSnap) this.saveSnap = JSON.stringify(Save.data);
    Save.data = JSON.parse(this.saveSnap);
    // full effects, and the frame-time watchdog kept out (our long loops would look like a slow device)
    Save.data.fx = 'full'; FX.quality = 2; FX.calm = false;
    Save.data.blood = false; // the videos go to the portals: their default look (PEGI 12)
    Input.clear();
    for (const s of Input.slots) for (const b in s.prev) s.prev[b] = false;
    FX.next = 0;
    this.sim(() => {
      for (let i = 0; i < 60 && App.pending; i++) App.update(STEP);
      App.go(PlayScene, level);
      for (let i = 0; i < 60 && (App.pending || App.scene !== PlayScene); i++) App.update(STEP);
      if (noHud) world.drawHUD = () => {};
      // clean: the attract mode's rules - no speech bubbles, announcements or objective pointer
      if (this.clean) world.demo = true;
      Playtest.on = false;
      Bot.reset();
      for (let i = 0; i < 120; i++) { Input.poll(); App.update(STEP); if (i % 2) App.draw(Gfx.ctx); }
    });
  },
  // one bot step; every second step is drawn (every step for a 60 fps video; the same in scan and
  // capture). clip.bossHp trims a boss once its fight starts, so the bot brings it down within a short clip
  tick(i) {
    if (this.bossHp && world.bossActive) for (const e of world.enemies) if (e.isBoss && !e.trimmed) { e.trimmed = true; e.hp = Math.min(e.hp, this.bossHp); }
    Bot.step(i, { god: true, special: true });
    if (this.every || i % 2) App.draw(Gfx.ctx);
  },
  scan(level, seed, size, steps, noHud) {
    this.begin(level, seed, size, noHud);
    this.bossWasDone = false; this.after = 0;
    const score = new Float32Array(steps);
    let end = steps;
    this.sim(() => {
      let kills = world.kills, x = world.player ? world.player.x : 0;
      for (let i = 0; i < steps; i++) {
        this.booms = 0;
        const bossHp = world.enemies.reduce((a, e) => a + (e.isBoss ? e.hp : 0), 0);
        this.tick(i);
        const w = world, p = w.player;
        const bossLeft = w.enemies.reduce((a, e) => a + (e.isBoss ? e.hp : 0), 0), bossHit = bossHp - bossLeft;
        let s = (w.kills - kills) * 3 + this.booms / 12 + Math.max(0, bossHit) * 0.4;
        // the boss going down is the money shot, and the clip should show the blast that follows
        if (w.bossDone && !this.bossWasDone) { s += 40; this.after = 150; }
        if (this.after > 0) { this.after--; s += 0.5; }
        this.bossWasDone = !!w.bossDone;
        if (p && !p.dead && Math.abs(p.x - x) < 0.05 && !w.bossActive) s -= 0.15; // the bot stuck at a wall is dull
        if (w.state !== 'play' && w.state !== 'extract') s -= 1;
        // clean (a small autoplaying tile): the picture must read - the hero in the middle part of the
        // view, and no screen washed white by a blast flash
        if (this.clean && this.every) {
          const v = w.view || { x: 0, y: 0 }, W = Gfx.W, H = Gfx.H;
          if (!p || p.dead || p.cx < v.x + W * 0.15 || p.cx > v.x + W * 0.85 || p.cy < v.y + H * 0.1 || p.cy > v.y + H * 0.9) s -= 1.5;
          const d = Gfx.ctx.getImageData(0, 0, W, H).data;
          let white = 0;
          for (let k = 0; k < d.length; k += 16) if (d[k] > 235 && d[k + 1] > 235 && d[k + 2] > 225) white++;
          s -= 40 * Math.max(0, white / (d.length / 16) - 0.02);
        }
        score[i] = s; kills = w.kills; x = p ? p.x : x;
        if (Bot.outcome()) { end = i + 1; break; }
      }
    });
    return { score, end };
  },
  best(scan, len, skip = 90) {
    let bestAt = skip, bestSum = -1e9, sum = 0;
    const s = scan.score;
    for (let i = skip; i < scan.end; i++) {
      sum += s[i];
      if (i - skip >= len) sum -= s[i - len];
      if (i - skip >= len - 1 && sum > bestSum) { bestSum = sum; bestAt = i - len + 1; }
    }
    return { at: bestAt & ~1, sum: +bestSum.toFixed(1) };
  },
  // replays the mission and captures frames [from, from + len) as PNG data URLs (30 fps)
  capture(level, seed, size, from, len, noHud) {
    this.begin(level, seed, size, noHud);
    const frames = [];
    this.sim(() => {
      for (let i = 0; i < from + len; i++) {
        this.tick(i);
        if (i >= from && i % 2) frames.push(Gfx.canvas.toDataURL('image/png'));
      }
    });
    return frames;
  },
  async post(frames, tag, offset) {
    for (let k = 0; k < frames.length; k++) {
      await fetch('/__shot?name=' + tag + '_' + String(offset + k).padStart(4, '0'), { method: 'POST', body: frames[k] });
    }
  },
  // Encodes the clips straight into an H.264 MP4 in the browser (WebCodecs + tools/mp4mux.js) and
  // saves it as %TEMP%/blast_shots/<tag>.mp4. size = the game's view in pixels, scale = upscale factor
  // (480x270 x4 = 1920x1080 landscape, 180x270 x6 = 1080x1620 portrait). opts: noHud hides the HUD,
  // fps 30 (default) or 60
  async video(tag, size, scale, clips, opts = {}) {
    const fps = opts.fps === 60 ? 60 : 30, W = size[0] * scale, H = size[1] * scale;
    this.every = fps === 60;
    // clean: nothing to read in the picture (English if anything slips through)
    this.clean = !!opts.clean;
    const lang = L10N.lang;
    if (this.clean) L10N.set('en');
    const big = document.createElement('canvas');
    big.width = W; big.height = H;
    const bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    const samples = [];
    let avcC = null, fail = null, n = 0, lastTs = -1;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        const d = new Uint8Array(chunk.byteLength);
        chunk.copyTo(d);
        if (chunk.timestamp <= lastTs) fail = new Error('frames out of order (B-frames?)');
        lastTs = chunk.timestamp;
        samples.push({ data: d, key: chunk.type === 'key' });
        if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description);
      },
      error: (e) => { fail = e; },
    });
    // H.264 level 4.0 tops out near 1080p30; 60 fps needs 4.2
    enc.configure({ codec: opts.codec || (fps === 60 ? 'avc1.64002a' : 'avc1.640028'), width: W, height: H, bitrate: opts.bitrate || 8e6, framerate: fps, hardwareAcceleration: 'prefer-software', avc: { format: 'avc' } });
    const log = [];
    try {
      for (const c of clips) {
        const seed = c.seed || 1000 + c.level * 17, len = Math.round(c.sec * 60);
        this.bossHp = c.bossHp || 0;
        // clip.at (seconds) fixes the start instead of scanning for the best window
        const b = c.at != null ? { at: Math.round(c.at * 60) & ~1, sum: 0 } : this.best(this.scan(c.level, seed, size, c.steps || 4200, opts.noHud), len);
        this.begin(c.level, seed, size, opts.noHud);
        this.sim(() => { for (let i = 0; i < b.at; i++) this.tick(i); });
        for (let i = b.at, first = true; i < b.at + len; i++) {
          this.sim(() => this.tick(i));
          if (!this.every && !(i % 2)) continue;
          bctx.drawImage(Gfx.canvas, 0, 0, W, H);
          if (typeof Hud !== 'undefined' && Hud.canvas) bctx.drawImage(Hud.canvas, 0, 0, W, H);
          const vf = new VideoFrame(big, { timestamp: Math.round(n * 1e6 / fps), duration: Math.round(1e6 / fps) });
          enc.encode(vf, { keyFrame: first || n % (fps * 2) === 0 });
          vf.close();
          n++; first = false;
          while (enc.encodeQueueSize > 3) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
          if (fail) throw fail;
        }
        log.push('M' + (c.level + 1) + ' at ' + (b.at / 60).toFixed(1) + 's (step ' + b.at + ') score ' + b.sum);
      }
      await enc.flush();
    } finally {
      this.every = false;
      if (this.clean) { this.clean = false; L10N.set(lang); }
      this.unlock();
      TT.unforce();
      if (enc.state !== 'closed') enc.close();
    }
    if (fail) throw fail;
    const mp4 = MP4.mux(samples, avcC, W, H, fps);
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([mp4], { type: 'video/mp4' })); });
    const r = await fetch('/__shot?name=' + tag + '&ext=mp4', { method: 'POST', body: url });
    return log.join('\n') + '\n' + n + ' frames, ' + (mp4.length / 1e6).toFixed(1) + ' MB -> ' + (await r.text());
  },
  // clips: [{ level, sec, seed?, steps? }] -> frames tag_0000.png ... in %TEMP%/blast_shots
  async make(tag, size, clips, noHud = false) {
    const log = [];
    let n = 0;
    try {
      for (const c of clips) {
        const seed = c.seed || 1000 + c.level * 17, len = Math.round(c.sec * 60);
        this.bossHp = c.bossHp || 0;
        const sc = this.scan(c.level, seed, size, c.steps || 4200, noHud);
        const b = this.best(sc, len);
        const frames = this.capture(c.level, seed, size, b.at, len, noHud);
        await this.post(frames, tag, n);
        log.push('M' + (c.level + 1) + ' at ' + (b.at / 60).toFixed(1) + 's score ' + b.sum + ' -> ' + frames.length + ' frames');
        n += frames.length;
      }
    } finally {
      this.unlock();
      TT.unforce();
    }
    return log.join('\n') + '\ntotal ' + n + ' frames';
  },
};
