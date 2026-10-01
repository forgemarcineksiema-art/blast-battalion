// Dev-only (never shipped): three ways to meet a phone held upright, drawn with the game itself,
// for the 1.34 decision (Poki strongly advises portrait support). Inject after harness.js:
//   await PMOCK.all()     -> %TEMP%/blast_shots/portrait_A.png, _B, _C  (1170 x 2532 = 390 x 844 CSS at DPR 3)
//   A "console":   the game view on top, a control deck under it - thumbs never cover the action
//   B "full":      the game fills the upright screen (a tall, narrow view), controls over it
//   C "rotate":    stays landscape-only, with a proper rotate screen in the game's own style
/* eslint-disable no-undef */
window.PMOCK = {
  PW: 1170, PH: 2532, TOP: 141, BOTTOM: 102, // the notch strip and the home bar of an iPhone 12-15

  // an exact view: w x h game pixels at F device pixels each (no rescaling logic)
  view(w, h, F) { Gfx.forceSize = null; Gfx.scale = F; TT.raw(w, h); Hud.resize(); },
  // a mission with something going on: the bot plays a while
  play(level, steps, touch) {
    Playtest.on = false; Save.data.favorite = 'havoc';
    TT.start(level); TT.god();
    Bot.reset();
    for (let i = 0; i < steps; i++) { Bot.step(i, { god: true }); if (Bot.outcome()) break; }
    Bot.release();
    for (let i = 0; i < 2; i++) { Input.poll(); App.update(STEP); }
    Touch.reset(); Input.mode = touch ? 'touch' : 'keyboard';
    App.draw(Gfx.ctx);
  },
  // an upright view spends its extra height above the hero (upper floors, what falls) rather than
  // on the rock under his feet: the hero at `at` of the height
  frame(at) {
    const w = window.world, p = w.player;
    if (p) w.cam.y = Math.round(clamp(p.y + p.h - Gfx.H * at, 0, w.terrain.h * TILE - Gfx.H));
    Hud.clear(); App.draw(Gfx.ctx);
  },
  canvas() {
    const c = document.createElement('canvas'); c.width = this.PW; c.height = this.PH; c.hiRes = true; // hiRes: the typeface, not the pixel font
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x];
  },
  last: [],
  async save(c, name) { const i = { portrait_A: 0, portrait_B: 1, portrait_C: 2 }[name]; if (i != null) this.last[i] = c; const r = await fetch('/__shot?name=' + name, { method: 'POST', body: c.toDataURL('image/png') }); return r.text(); },
  // draws with the menu kit onto another canvas: the kit writes to Hud.ctx, in device pixels
  onto(x, fn) { const hc = Hud.ctx; Hud.ctx = x; try { fn(); } finally { Hud.ctx = hc; } },

  // ---- A: the view on top, the deck below --------------------------------------------------
  async A() {
    const F = 3; this.view(390, 400, F); // the phone's width at scale 3; a little taller than wide
    this.play(2, 520, false);
    this.frame(0.7);
    const [c, x] = this.canvas(), top = this.TOP, vh = Gfx.H * F;
    x.fillStyle = '#0c0b10'; x.fillRect(0, 0, this.PW, this.PH);
    x.drawImage(Gfx.canvas, 0, top, Gfx.W * F, vh); x.drawImage(Hud.canvas, 0, top);
    this.deck(x, top + vh, this.PH - top - vh, F);
    return this.save(c, 'portrait_A');
  },

  // the control deck: a gunmetal panel, a joystick well on the left, four buttons on the right
  deck(x, Y, H, m) {
    const W = this.PW;
    this.onto(x, () => {
      x.fillStyle = '#15131c'; x.fillRect(0, Y, W, H);
      UI.plateD(5 * m, Y + 9 * m, W - 10 * m, H - this.BOTTOM - 12 * m, 'dark');
      // a hazard edge along the top of the panel
      x.fillStyle = '#ffd23a'; x.fillRect(0, Y, W, 5 * m);
      x.fillStyle = '#15131c';
      for (let sx = -8 * m; sx < W; sx += 12 * m) for (let r = 0; r < 5; r++) x.fillRect(sx + (4 - r) * m, Y + r * m, 5 * m, m);
      x.fillRect(0, Y + 5 * m, W, m);
      // thumbs rest a bit below the middle of the panel
      const cy = Y + Math.round((H - this.BOTTOM) * 0.54);
      // joystick: a recessed well with arrows, the knob pushed a little to the right
      const jx = 96 * m, jr = 60, kr = 26;
      UI.imgD(circleSprite('#15131c', jr + 3), jx - (jr + 3) * m, cy - (jr + 3) * m, m);
      UI.imgD(circleSprite('#23212c', jr), jx - jr * m, cy - jr * m, m);
      UI.imgD(circleSprite('#2e2b38', jr - 5), jx - (jr - 5) * m, cy - (jr - 5) * m, m);
      for (const [dx, dy, s] of [[1, 0, '▶'], [-1, 0, '◀'], [0, -1, '↑'], [0, 1, '↓']]) {
        Font.draw(x, s, jx + dx * (jr - 13) * m, cy + dy * (jr - 13) * m - 7 * m, '#5e5a74', m * 2, 'center');
      }
      const kx = jx + 14 * m;
      UI.imgD(circleSprite('#15131c', kr + 2), kx - (kr + 2) * m, cy - (kr + 2) * m + 2 * m, m);
      UI.imgD(circleSprite('#b8b4cc', kr), kx - kr * m, cy - kr * m + 2 * m, m);
      UI.imgD(circleSprite('#e8e4f6', kr), kx - kr * m, cy - kr * m, m);
      UI.imgD(circleSprite('#ffffff', kr - 12), kx - (kr - 6) * m, cy - (kr - 2) * m, m);
      // the buttons: FIRE big and lowest, JUMP beside it, SPECIAL and KNIFE above (as in landscape)
      const bx = W - 88 * m, by = cy + 22 * m;
      const btns = [
        ['fire', bx, by, 42, '#b8302a', 'FIRE', 'gun'],
        ['jump', bx - 92 * m, by + 16 * m, 34, '#2e5aa8', 'JUMP', '↑'],
        ['special', bx - 4 * m, by - 88 * m, 31, '#2c8a3a', 'SPEC', 'special'],
        ['melee', bx - 94 * m, by - 62 * m, 29, '#7a5a8a', 'KNIFE', 'knife'],
      ];
      for (const [name, X, Yb, r, col, label, ic] of btns) {
        UI.imgD(circleSprite('#15131c', r + 3), X - (r + 3) * m, Yb - (r + 3) * m + 2 * m, m);
        UI.imgD(circleSprite(shadeHex(col, 0.6), r), X - r * m, Yb - r * m + 3 * m, m);
        UI.imgD(circleSprite(col, r), X - r * m, Yb - r * m, m);
        UI.imgD(circleSprite(shadeHex(col, 1.18), r - 6), X - (r - 3) * m, Yb - (r + 1) * m, m);
        UI.imgD(circleSprite(col, r - 6), X - (r - 6) * m, Yb - (r - 5) * m, m);
        const k = 3;
        const sp = name === 'special' && world.player && Sprites.props.specialIcon[world.player.hero.id];
        if (sp) UI.imgD(sp, X - sp.width * k * m / 2, Yb - 2 * m - sp.height * k * m, k * m);
        else UI.iconD(ic, X - 3.5 * k * m, Yb - 2 * m - 7 * k * m, '#ffffff', k);
        UI.stampD(label, X, Yb + 5 * m, '#ffffff', 1, 'center');
      }
    });
  },

  // ---- B: the whole upright screen is the game ---------------------------------------------
  async B() {
    const F = 5; this.view(234, 486, F);
    this.play(2, 520, true);
    this.frame(0.62);
    const [c, x] = this.canvas();
    x.fillStyle = '#0c0b10'; x.fillRect(0, 0, this.PW, this.PH);
    x.drawImage(Gfx.canvas, 0, this.TOP, Gfx.W * F, Gfx.H * F); x.drawImage(Hud.canvas, 0, this.TOP);
    return this.save(c, 'portrait_B');
  },

  // ---- C: landscape only, a better rotate screen --------------------------------------------
  async C() {
    const F = 3; this.view(390, 220, F);
    this.play(2, 520, false);
    const [c, x] = this.canvas(), m = F;
    x.fillStyle = '#0c0b10'; x.fillRect(0, 0, this.PW, this.PH);
    const L = Logo.get(4), lk = 3; // the logo, big
    x.drawImage(L.c, Math.round(this.PW / 2 - L.W * lk / 2), 470, L.W * lk, L.H * lk);
    const cx = this.PW / 2, cy = 1330;
    this.onto(x, () => {
      // the phone on its side, the game playing on it
      UI.plateD(cx - 150 * m / 2 - 12 * m, cy - 52 * m, 150 * m + 24 * m, 104 * m, 'metal');
      x.fillStyle = '#15131c'; x.fillRect(cx - 75 * m, cy - 43 * m, 150 * m, 86 * m);
      x.drawImage(Gfx.canvas, 0, 0, Gfx.W, Gfx.H, cx - 74 * m, cy - 42 * m, 148 * m, 84 * m);
      x.drawImage(Hud.canvas, 0, 0, Hud.canvas.width, Hud.canvas.height, cx - 74 * m, cy - 42 * m, 148 * m, 84 * m);
      x.fillStyle = '#6d757e'; x.fillRect(cx + 80 * m, cy - 6 * m, 3 * m, 12 * m); // the side button
      // a curved arrow: turn it
      Font.draw(x, '↻', cx - 118 * m, cy - 96 * m, '#ffd23a', m * 5, 'center');
      UI.stampD('TURN YOUR PHONE', cx, cy + 80 * m, '#ffd23a', 2, 'center');
      UI.textD('THE BATTLE IS SIDEWAYS', cx, cy + 104 * m, '#c8ccd4', 1, 'center');
    });
    return this.save(c, 'portrait_C');
  },

  async all() {
    const out = [await this.A(), await this.B(), await this.C()];
    TT.unforce();
    out.push(await this.sheet());
    return out;
  },
  // the three side by side, a third of the size, for a quick look
  async sheet() {
    const imgs = [];
    for (const n of ['A', 'B', 'C']) {
      const im = new Image(); im.src = '/tools/../' + 'x'; // placeholder (replaced below)
      imgs.push(n);
    }
    const w = 390, h = 844, gap = 40, c = document.createElement('canvas');
    c.width = 3 * w + 4 * gap; c.height = h + 2 * gap + 60; c.hiRes = true;
    const x = c.getContext('2d'); x.fillStyle = '#e8e6ef'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 3; i++) {
      const src = this.last[i]; if (!src) continue;
      x.fillStyle = '#15131c'; x.fillRect(gap + i * (w + gap) - 6, gap + 54, w + 12, h + 12);
      x.drawImage(src, 0, 0, src.width, src.height, gap + i * (w + gap), gap + 60, w, h);
      Font.draw(x, ['A', 'B', 'C'][i], gap + i * (w + gap) + w / 2, gap + 4, '#15131c', 6, 'center');
    }
    return this.save(c, 'portrait_options');
  },
};
