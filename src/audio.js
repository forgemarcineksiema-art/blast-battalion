'use strict';
// ============================================================================
//  Audio: synthesized SFX + tiny chiptune sequencer (WebAudio, no assets)
//  Sounds are panned to where they happen on screen and muffled off-screen;
//  the action music thickens while a fight is on.
// ============================================================================

// throttle per sound name (seconds between two plays)
const SFX_GAP = {
  tink: 0.045, whiz: 0.09, ricochet: 0.08, thud: 0.15,
  shot: 0.035, rifle: 0.035, burst: 0.03, pistol: 0.04, silenced: 0.03, eshot: 0.05, mg: 0.03,
  hit: 0.05, hitDirt: 0.045, hitStone: 0.045, hitWood: 0.045, flesh: 0.03, step: 0.08,
  hurt: 0.06, bounce: 0.06, flameTick: 0.1, crumble: 0.08, explosion: 0.04, metal: 0.06, beep: 0.05, style: 0.06,
  gush: 0.3, ignite: 0.12, creak: 0.3, snap: 0.1, radio: 0.3, jet: 0.5, truck: 0.2, hiss: 0.2,
  pin: 0.08, reload: 0.12, scream: 0.35,
};
// dropped first when many sounds overlap
const SFX_LOW = new Set(['step', 'hit', 'hitDirt', 'hitStone', 'hitWood', 'flesh', 'bounce', 'crumble', 'tink', 'whiz', 'ricochet']);

const Sound = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null, dest: null,
  sfxOn: true, musicOn: true, adMuted: false, hiddenMuted: false,
  // on while the title's demo world steps (src/attract.js): it plays silent under the title music
  quiet: false,
  last: {}, voices: 0, loops: {},
  panNext: 0, farNext: 0, posFresh: false,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.dest = this.sfxBus;
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended' && !this.adMuted) this.ctx.resume().catch(() => {});
    Music.kick();
  },

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = (this.adMuted || this.hiddenMuted) ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.5 : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.26 : 0, t, 0.05);
  },
  setAdMuted(v) {
    this.adMuted = v;
    this.applyVolumes();
    if (this.ctx) { if (v) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {}); }
    if (v) this.stopAllLoops();
  },
  setHidden(v) { this.hiddenMuted = v; this.applyVolumes(); if (v) this.stopAllLoops(); },

  // where the next sound comes from (World.volAt calls this): pan -1..1, far 0..1
  at(pan, far) { this.panNext = pan; this.farNext = far; this.posFresh = true; },

  // brief dip of the music under big moments (explosions, getting hit)
  duck(depth, dur) {
    if (!this.ctx || !this.musicOn || this.adMuted || this.hiddenMuted || this.quiet) return;
    const g = this.musicBus.gain, t = this.ctx.currentTime, base = 0.26;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(base * (1 - depth), t + 0.03);
    g.linearRampToValueAtTime(base, t + dur);
  },

  // ---------------------------------------------------------------- helpers
  noise(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  },
  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },
  filt(type, freq, q = 1) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; },
  gain() { return this.ctx.createGain(); },
  osc(type, f0, t) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); return o; },
  track(node, dur) { this.voices++; setTimeout(() => { this.voices--; }, (dur + 0.1) * 1000); },
  // noise burst through one filter: the building block of most effects
  burst(t, dur, type, freq, q, peak, attack, decay) {
    const n = this.noise(t, dur), f = this.filt(type, freq, q), g = this.gain();
    this.env(g, t, peak, attack, decay); n.connect(f); f.connect(g); g.connect(this.dest);
    return f;
  },
  // pitched blip that slides from f0 to f1
  sweep(t, type, f0, f1, peak, dur) {
    const o = this.osc(type, f0, t), g = this.gain();
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, peak, 0.001, dur); o.connect(g); g.connect(this.dest); o.start(t); o.stop(t + dur + 0.03);
  },

  // ---------------------------------------------------------------- SFX
  play(name, vol = 1, pitch = 1) {
    const pan = this.posFresh ? this.panNext : 0, far = this.posFresh ? this.farNext : 0;
    this.posFresh = false;
    if (!this.ctx || !this.sfxOn || this.adMuted || this.hiddenMuted || this.quiet || vol <= 0.02) return;
    const now = this.ctx.currentTime;
    const gap = SFX_GAP[name] || 0.015;
    if (this.last[name] && now - this.last[name] < gap) return;
    if (this.voices > 36 || (this.voices > 22 && SFX_LOW.has(name))) return;
    this.last[name] = now;
    const fn = SFX[name];
    if (!fn) return;
    // off-screen sounds lose their top end; everything sits where it happened
    let dest = this.sfxBus;
    if (far > 0.05) { const lp = this.filt('lowpass', 7500 - far * 6300, 0.6); lp.connect(dest); dest = lp; }
    if (Math.abs(pan) > 0.04 && this.ctx.createStereoPanner) { const pn = this.ctx.createStereoPanner(); pn.pan.value = clamp(pan, -1, 1); pn.connect(dest); dest = pn; }
    this.dest = dest;
    try { fn(this, now, vol, pitch); } catch (e) { /* ignore */ }
    this.dest = this.sfxBus;
  },

  // continuous loops (flamethrower, helicopter, minigun spin)
  loop(name, on, vol = 1) {
    this.posFresh = false;
    if (!this.ctx) return;
    const L = this.loops[name];
    if (on && !L && this.sfxOn && !this.adMuted && !this.hiddenMuted && !this.quiet) {
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const g = this.gain(); g.gain.value = 0;
      let chain = src;
      const kind = name.replace(/\d+$/, ''); // 'flame0' / 'spin1' are per-player loops
      if (kind === 'flame') { const f = this.filt('lowpass', 900, 0.7); const f2 = this.filt('highpass', 150); src.connect(f); f.connect(f2); chain = f2; }
      else if (kind === 'heli') {
        const f = this.filt('lowpass', 320, 1); src.connect(f); chain = f;
        const lfo = this.osc('square', 13, t); const lg = this.gain(); lg.gain.value = 0.35;
        lfo.connect(lg); lg.connect(g.gain); lfo.start(t); this.loops[name + 'lfo'] = lfo;
      } else if (kind === 'spin') { const f = this.filt('bandpass', 1800, 2); src.connect(f); chain = f; }
      else if (kind === 'tread') {
        // tank tracks: a low rumble chopped by the links
        const f = this.filt('lowpass', 260, 1.2); src.connect(f); chain = f;
        const lfo = this.osc('square', 17, t); const lg = this.gain(); lg.gain.value = 0.3;
        lfo.connect(lg); lg.connect(g.gain); lfo.start(t); this.loops[name + 'lfo'] = lfo;
      }
      chain.connect(g); g.connect(this.sfxBus);
      src.start(t);
      g.gain.setTargetAtTime((kind === 'heli' ? 0.35 : kind === 'spin' ? 0.12 : 0.28) * vol, t, 0.05);
      this.loops[name] = { src, g };
    } else if (L) {
      if (!on) {
        const t = this.ctx.currentTime;
        L.g.gain.setTargetAtTime(0, t, 0.05);
        try { L.src.stop(t + 0.3); } catch (e) { /* */ }
        const lfo = this.loops[name + 'lfo']; if (lfo) { try { lfo.stop(t + 0.3); } catch (e) { /* */ } delete this.loops[name + 'lfo']; }
        delete this.loops[name];
      } else {
        const kind = name.replace(/\d+$/, '');
        L.g.gain.setTargetAtTime((kind === 'heli' ? 0.35 : kind === 'spin' ? 0.12 : 0.28) * vol, this.ctx.currentTime, 0.05);
      }
    }
  },
  stopAllLoops() { for (const k of Object.keys(this.loops)) if (!k.endsWith('lfo')) this.loop(k, false); },
  stopWeaponLoops() { for (const k of Object.keys(this.loops)) if (/^(flame|spin)/.test(k)) this.loop(k, false); },
};

// Each recipe: (S, t, vol, pitch). Recipes connect to S.dest (panned bus).
const SFX = {
  // ---- guns: every hero sounds different
  shot(S, t, v, p) {
    S.burst(t, 0.12, 'bandpass', 1700 * p, 0.9, 0.55 * v, 0.002, 0.09);
    S.sweep(t, 'square', 190 * p, 55, 0.14 * v, 0.06); S.track(null, 0.12);
  },
  rifle(S, t, v, p) { // MAX HAVOC: crack + body + low thump
    S.burst(t, 0.1, 'bandpass', 1500 * p, 0.8, 0.6 * v, 0.001, 0.08);
    S.burst(t, 0.02, 'highpass', 4200, 1, 0.35 * v, 0.0005, 0.015);
    S.sweep(t, 'sine', 170 * p, 48, 0.3 * v, 0.07); S.track(null, 0.1);
  },
  burst(S, t, v, p) { // CHRONO: tight sci-fi burst
    const o = S.osc('square', 1400 * p, t), g = S.gain(), f = S.filt('bandpass', 1800, 1.2);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.06);
    S.env(g, t, 0.16 * v, 0.001, 0.06); o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.08);
    S.burst(t, 0.08, 'bandpass', 2400, 0.9, 0.4 * v, 0.001, 0.06); S.track(null, 0.09);
  },
  pistol(S, t, v, p) { // SKYHAWK: light pops
    S.burst(t, 0.08, 'bandpass', 2100 * p, 1, 0.45 * v, 0.001, 0.06);
    S.sweep(t, 'triangle', 320 * p, 90, 0.18 * v, 0.05); S.track(null, 0.08);
  },
  silenced(S, t, v) { // PHANTOM: muffled thup + action click
    S.burst(t, 0.06, 'lowpass', 900, 0.8, 0.4 * v, 0.001, 0.045);
    S.burst(t + 0.012, 0.02, 'bandpass', 3200, 2, 0.12 * v, 0.001, 0.012); S.track(null, 0.07);
  },
  eshot(S, t, v, p) { // enemy rifles: duller, so you can tell them apart
    S.burst(t, 0.12, 'bandpass', 1050 * p, 0.8, 0.4 * v, 0.002, 0.1);
    S.sweep(t, 'sine', 130 * p, 50, 0.12 * v, 0.06); S.track(null, 0.12);
  },
  mg(S, t, v, p) {
    S.burst(t, 0.07, 'bandpass', 1150 * p, 1, 0.5 * v, 0.001, 0.05);
    S.sweep(t, 'square', 110, 40, 0.16 * v, 0.05); S.track(null, 0.08);
  },
  shotgun(S, t, v) {
    S.burst(t, 0.35, 'lowpass', 2600, 0.7, 0.95 * v, 0.002, 0.28);
    S.burst(t, 0.03, 'highpass', 3500, 1, 0.45 * v, 0.0005, 0.025);
    S.sweep(t, 'sine', 110, 38, 0.6 * v, 0.18);
    SFX.pump(S, t + 0.32, v * 0.8);
    S.track(null, 0.45);
  },
  pump(S, t, v) { // shell racked after the blast: chk-chk
    S.burst(t, 0.04, 'bandpass', 1800, 3, 0.28 * v, 0.001, 0.03);
    S.burst(t + 0.09, 0.04, 'bandpass', 1300, 3, 0.28 * v, 0.001, 0.03);
  },
  tink(S, t, v, p) { // a casing hits the floor
    S.sweep(t, 'triangle', 3600 * p, 3100 * p, 0.05 * v, 0.045);
    S.sweep(t + 0.01, 'sine', 5400 * p, 5000 * p, 0.02 * v, 0.03); S.track(null, 0.06);
  },
  ricochet(S, t, v, p) { // a round glancing off steel or stone
    S.sweep(t, 'sine', 3400 * p, 1300 * p, 0.07 * v, 0.16);
    S.burst(t, 0.03, 'highpass', 5000, 1, 0.1 * v, 0.0005, 0.02); S.track(null, 0.17);
  },
  whiz(S, t, v, p) { // a bullet passing close by
    S.burst(t, 0.13, 'bandpass', 2400 * p, 5, 0.16 * v, 0.02, 0.1); S.track(null, 0.14);
  },
  thud(S, t, v, p) { // a hard landing: a deep thump you feel
    S.sweep(t, 'sine', 100 * p, 36, 0.55 * v, 0.2);
    S.burst(t, 0.16, 'lowpass', 420, 1, 0.45 * v, 0.002, 0.14); S.track(null, 0.22);
  },
  pin(S, t, v) { // a grenade's pin pulled (1.32): a bright ping - the throw is coming
    S.sweep(t, 'triangle', 3000, 2500, 0.06 * v, 0.06);
    S.burst(t, 0.02, 'highpass', 4200, 1, 0.12 * v, 0.0005, 0.015); S.track(null, 0.07);
  },
  reload(S, t, v) { // a magazine swapped, a bolt worked: clack-clack
    S.burst(t, 0.035, 'bandpass', 1500, 3, 0.22 * v, 0.001, 0.025);
    S.burst(t + 0.11, 0.035, 'bandpass', 2300, 3, 0.26 * v, 0.001, 0.025); S.track(null, 0.15);
  },
  scream(S, t, v, p) { // a soldier going over the edge: a falling wail
    const o = S.osc('sawtooth', 760 * p, t), g = S.gain(), f = S.filt('bandpass', 1300, 1.5);
    o.frequency.exponentialRampToValueAtTime(260 * p, t + 0.75);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.85); S.track(o, 0.85);
  },
  windup(S, t, v) { // a minigun spinning up: the rising whine before a long burst
    const o = S.osc('sawtooth', 90, t), g = S.gain(), f = S.filt('lowpass', 1400, 1);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.85);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 1); S.track(null, 1);
  },
  sniper(S, t, v) { // crack with a rolling echo
    S.burst(t, 0.5, 'highpass', 700, 1, 0.8 * v, 0.001, 0.4);
    S.sweep(t, 'square', 900, 90, 0.2 * v, 0.12);
    S.burst(t + 0.13, 0.35, 'lowpass', 900, 1, 0.25 * v, 0.004, 0.3);
    S.burst(t + 0.29, 0.35, 'lowpass', 700, 1, 0.12 * v, 0.004, 0.3);
    S.track(null, 0.6);
  },
  // ---- impacts by material
  hit(S, t, v) { S.burst(t, 0.04, 'highpass', 2600, 1, 0.08 * v, 0.001, 0.03); S.track(null, 0.04); },
  hitDirt(S, t, v) { S.burst(t, 0.06, 'lowpass', 700, 1, 0.2 * v, 0.001, 0.045); S.track(null, 0.06); },
  hitStone(S, t, v) {
    S.burst(t, 0.05, 'bandpass', 2600, 2, 0.14 * v, 0.001, 0.035);
    S.sweep(t, 'triangle', 1800, 900, 0.05 * v, 0.03); S.track(null, 0.05);
  },
  hitWood(S, t, v) {
    S.burst(t, 0.06, 'bandpass', 900, 3, 0.2 * v, 0.001, 0.045);
    S.sweep(t, 'triangle', 330, 200, 0.08 * v, 0.04); S.track(null, 0.06);
  },
  flesh(S, t, v) { // bullet into a body
    S.burst(t, 0.07, 'lowpass', 1100, 1, 0.3 * v, 0.001, 0.05);
    S.sweep(t, 'sine', 190, 70, 0.22 * v, 0.06); S.track(null, 0.07);
  },
  metal(S, t, v, p) {
    const o = S.osc('triangle', 2300 * p * rand(0.9, 1.1), t), g = S.gain(); S.env(g, t, 0.09 * v, 0.001, 0.08);
    o.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.1); S.track(o, 0.1);
  },
  // ---- explosions: crack, body, sub-thump and a rattle of debris
  explosion(S, t, v, p) {
    const f = S.burst(t, 1.4, 'lowpass', 1600 * p, 0.8, 1.0 * v, 0.003, 1.2);
    f.frequency.setValueAtTime(2000 * p, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.1);
    S.sweep(t, 'sine', 75 * p, 24, 1.0 * v, 0.6);
    S.burst(t, 0.05, 'highpass', 3000, 1, 0.5 * v, 0.0005, 0.04);
    for (let i = 0; i < 5; i++) {
      const dt = 0.12 + Math.random() * 0.6;
      S.burst(t + dt, 0.04, 'bandpass', rand(900, 2600), 2, rand(0.05, 0.12) * v, 0.001, 0.035);
    }
    S.track(null, 1.4);
  },
  smallboom(S, t, v, p) { SFX.explosion(S, t, v * 0.6, 1.6 * p); },
  // ---- movement
  jump(S, t, v) {
    const o = S.osc('square', 230, t), g = S.gain(); o.frequency.exponentialRampToValueAtTime(460, t + 0.08);
    const f = S.filt('lowpass', 2200); S.env(g, t, 0.07 * v, 0.003, 0.08); o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.1); S.track(o, 0.1);
  },
  land(S, t, v) { S.burst(t, 0.08, 'lowpass', 500, 1, 0.25 * v, 0.002, 0.06); S.track(null, 0.08); },
  step(S, t, v, p) { S.burst(t, 0.04, 'lowpass', 480 * p, 1, 0.22 * v, 0.001, 0.03); S.track(null, 0.04); },
  // ---- bodies
  hurt(S, t, v, p) {
    const o = S.osc('sawtooth', 420 * p, t), g = S.gain(), f = S.filt('lowpass', 1400);
    o.frequency.exponentialRampToValueAtTime(130 * p, t + 0.2); S.env(g, t, 0.16 * v, 0.005, 0.2);
    o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.25);
    S.burst(t, 0.08, 'bandpass', 900, 1, 0.25 * v, 0.002, 0.07); S.track(o, 0.25);
  },
  playerDie(S, t, v) {
    const o = S.osc('sawtooth', 620, t), g = S.gain(), f = S.filt('lowpass', 1800);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.6); S.env(g, t, 0.22 * v, 0.005, 0.6);
    o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.7); S.track(o, 0.7);
  },
  // ---- jingles
  notes(S, t, v, seq, type = 'square', len = 0.075, vol = 0.1) {
    seq.forEach((m, i) => {
      if (!m) return;
      const fr = 440 * Math.pow(2, (m - 69) / 12);
      const o = S.osc(type, fr, t + i * len), g = S.gain();
      S.env(g, t + i * len, vol * v, 0.004, len * 1.6); o.connect(g); g.connect(S.dest); o.start(t + i * len); o.stop(t + i * len + len * 2);
    });
    S.track(null, seq.length * len);
  },
  rescue(S, t, v) { SFX.notes(S, t, v, [72, 76, 79, 84, 88], 'square', 0.07, 0.11); },
  checkpoint(S, t, v) { SFX.notes(S, t, v, [67, 72, 76, 79], 'square', 0.08, 0.1); },
  unlock(S, t, v) { SFX.notes(S, t, v, [60, 64, 67, 72, 67, 72, 76, 84], 'square', 0.08, 0.1); },
  win(S, t, v) { SFX.notes(S, t, v, [67, 67, 67, 72, 0, 76, 79, 84], 'square', 0.11, 0.12); },
  lose(S, t, v) { SFX.notes(S, t, v, [67, 63, 60, 55, 51], 'triangle', 0.16, 0.2); },
  pickup(S, t, v) { SFX.notes(S, t, v, [76, 83, 88], 'square', 0.05, 0.09); },
  alert(S, t, v) { SFX.notes(S, t, v, [81, 88], 'square', 0.045, 0.06); },
  click(S, t, v) { SFX.notes(S, t, v, [84], 'square', 0.03, 0.07); },
  nope(S, t, v) { SFX.notes(S, t, v, [48, 45], 'square', 0.06, 0.08); },
  beep(S, t, v, p) { SFX.notes(S, t, v, [p > 1.5 ? 103 : 96], 'square', 0.03, 0.05); },
  style(S, t, v) { SFX.notes(S, t, v, [88, 95], 'square', 0.045, 0.06); }, // named kill
  // ---- the rest
  throw(S, t, v, p) {
    const f = S.burst(t, 0.16, 'bandpass', 600 * p, 1.5, 0.2 * v, 0.01, 0.12);
    f.frequency.exponentialRampToValueAtTime(2200 * p, t + 0.12); S.track(null, 0.16);
  },
  bounce(S, t, v, p) {
    const o = S.osc('triangle', 1300 * p, t), g = S.gain(); S.env(g, t, 0.07 * v, 0.001, 0.05); o.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.07); S.track(o, 0.07);
  },
  whistle(S, t, v) {
    const o = S.osc('sine', 1500, t), g = S.gain();
    o.frequency.exponentialRampToValueAtTime(380, t + 0.75);
    S.env(g, t, 0.11 * v, 0.06, 0.72); o.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.8); S.track(o, 0.8);
  },
  siren(S, t, v) {
    const o = S.osc('square', 620, t), g = S.gain(), f = S.filt('lowpass', 2200);
    o.frequency.linearRampToValueAtTime(980, t + 0.3); o.frequency.linearRampToValueAtTime(620, t + 0.6);
    S.env(g, t, 0.1 * v, 0.02, 0.62); o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.7); S.track(o, 0.7);
  },
  punch(S, t, v, p) {
    S.burst(t, 0.12, 'lowpass', 900 * p, 1.2, 0.7 * v, 0.002, 0.09);
    S.sweep(t, 'sine', 150 * p, 55, 0.5 * v, 0.09); S.track(null, 0.12);
  },
  slash(S, t, v) {
    const f = S.burst(t, 0.16, 'highpass', 1800, 1, 0.3 * v, 0.004, 0.11);
    f.frequency.exponentialRampToValueAtTime(5000, t + 0.1); S.track(null, 0.16);
  },
  zap(S, t, v) {
    const o = S.osc('sawtooth', 1400, t), g = S.gain(), f = S.filt('bandpass', 2400, 0.8);
    for (let i = 1; i < 8; i++) o.frequency.setValueAtTime(rand(400, 2600), t + i * 0.018);
    S.env(g, t, 0.18 * v, 0.002, 0.16); o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.2); S.track(o, 0.2);
  },
  rocket(S, t, v, p) {
    const f = S.burst(t, 0.5, 'bandpass', 700 * p, 0.9, 0.35 * v, 0.01, 0.42);
    f.frequency.exponentialRampToValueAtTime(1600 * p, t + 0.4); S.track(null, 0.5);
  },
  crumble(S, t, v) { S.burst(t, 0.35, 'lowpass', 520, 1, 0.4 * v, 0.005, 0.3); S.track(null, 0.35); },
  railgun(S, t, v) {
    const o = S.osc('sawtooth', 120, t), g = S.gain(), f = S.filt('lowpass', 3000);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.25); S.env(g, t, 0.25 * v, 0.2, 0.35);
    o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.6);
    SFX.explosion(S, t + 0.22, v * 0.7, 2);
  },
  stomp(S, t, v) {
    S.sweep(t, 'sine', 140, 30, 1.0 * v, 0.45);
    SFX.crumble(S, t, v);
  },
  flameTick(S, t, v) { S.burst(t, 0.15, 'lowpass', 800, 1, 0.12 * v, 0.01, 0.12); S.track(null, 0.15); },
  gush(S, t, v) { // fuel glugging out of a hole
    const f = S.burst(t, 0.35, 'bandpass', 420, 2.5, 0.22 * v, 0.03, 0.3);
    f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(620, t + 0.12); f.frequency.linearRampToValueAtTime(400, t + 0.3);
    S.sweep(t + 0.05, 'sine', 320, 180, 0.08 * v, 0.08); S.sweep(t + 0.18, 'sine', 280, 160, 0.06 * v, 0.07);
    S.track(null, 0.35);
  },
  ignite(S, t, v) { // whoomp: fuel catching fire
    const f = S.burst(t, 0.45, 'lowpass', 300, 0.8, 0.5 * v, 0.02, 0.4);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.18); f.frequency.exponentialRampToValueAtTime(500, t + 0.42);
    S.sweep(t, 'sine', 90, 40, 0.35 * v, 0.25); S.track(null, 0.45);
  },
  creak(S, t, v) { // old wood straining
    const o = S.osc('sawtooth', 110, t), g = S.gain(), f = S.filt('bandpass', 900, 4);
    for (let i = 1; i < 6; i++) o.frequency.setValueAtTime(rand(80, 150), t + i * 0.05);
    S.env(g, t, 0.12 * v, 0.02, 0.3); o.connect(f); f.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.35); S.track(o, 0.35);
  },
  radio(S, t, v) { // officer calling it in: static and a couple of beeps
    S.burst(t, 0.3, 'bandpass', 2400, 1.2, 0.16 * v, 0.01, 0.28);
    SFX.notes(S, t + 0.05, v, [88, 0, 88, 91], 'square', 0.05, 0.05);
  },
  jet(S, t, v) { // bomber streaking overhead
    const f = S.burst(t, 1.3, 'bandpass', 500, 0.7, 0.45 * v, 0.45, 0.8);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.5); f.frequency.exponentialRampToValueAtTime(500, t + 1.2);
    S.track(null, 1.3);
  },
  truck(S, t, v) { // diesel rumble
    S.burst(t, 0.35, 'lowpass', 190, 1, 0.35 * v, 0.02, 0.3);
    S.sweep(t, 'sawtooth', 58, 46, 0.07 * v, 0.3);
  },
  hiss(S, t, v) { S.burst(t, 0.5, 'highpass', 3200, 0.7, 0.2 * v, 0.04, 0.45); S.track(null, 0.5); },
  snap(S, t, v) { // a rope giving way
    S.burst(t, 0.05, 'highpass', 2500, 1, 0.5 * v, 0.0005, 0.04);
    S.sweep(t, 'triangle', 900, 120, 0.2 * v, 0.12);
    S.burst(t + 0.03, 0.25, 'lowpass', 700, 1, 0.3 * v, 0.005, 0.22); S.track(null, 0.3);
  },
  bossHit(S, t, v) {
    const o = S.osc('square', 160, t), g = S.gain(); o.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    S.env(g, t, 0.1 * v, 0.001, 0.06); o.connect(g); g.connect(S.dest); o.start(t); o.stop(t + 0.08); S.track(o, 0.08);
  },
};

// ---------------------------------------------------------------------------
//  Music sequencer
// ---------------------------------------------------------------------------
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function parseNotes(str) {
  return str.trim().split(/\s+/).map((tok) => {
    if (tok === '.' || tok === '-') return null;
    const m = /^([A-G][#b]?)(-?\d)$/.exec(tok);
    if (!m) return tok; // drum token
    return 12 * (parseInt(m[2], 10) + 1) + NOTE_IDX[m[1]];
  });
}

const SONGS = {
  title: {
    bpm: 118,
    bass: parseNotes('C2 . . . C2 . C3 . Ab1 . . . Ab1 . Ab2 . Bb1 . . . Bb1 . Bb2 . G1 . . . G1 . B1 .'),
    lead: parseNotes('C5 . . . G4 . . . C5 . D5 . Eb5 . . . D5 . . . C5 . . . Bb4 . . . G4 . . . Ab4 . . . C5 . . . Eb5 . . . D5 . C5 . D5 . . . . . . . G4 . . . B4 . . .'),
    drums: parseNotes('k - - - s - - - k - k - s - - h'),
    arp: null,
  },
  action: {
    bpm: 150,
    bass: parseNotes('A1 . A1 . A2 . A1 . A1 . A1 . A2 . G1 . F1 . F1 . F2 . F1 . F1 . F1 . F2 . F1 . G1 . G1 . G2 . G1 . G1 . G1 . G2 . G1 . E1 . E1 . E2 . E1 . E1 . E2 . G1 . G#1 .'),
    lead: parseNotes('A4 . . . E5 . . . D5 . C5 . B4 . C5 . A4 . . . . . F4 . A4 . C5 . F5 . E5 . D5 . . . B4 . . . G4 . B4 . D5 . G5 . E5 . . . . . D5 . C5 . B4 . G#4 . . . ' +
      'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 . F5 . . . E5 . . . D5 . . . C5 . . . D5 . . . G5 . . . F5 . E5 . D5 . B4 . C5 . . . B4 . . . G#4 . . . E4 . . .'),
    drums: parseNotes('k - h - s - h - k - k - s - h h'),
  },
  boss: {
    bpm: 168,
    bass: parseNotes('E1 E1 E2 E1 E1 E1 E2 E1 E1 E1 E2 E1 F1 F1 F2 F1 E1 E1 E2 E1 E1 E1 E2 E1 G1 G1 G2 G1 F#1 F#1 F#2 F#1 C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2 B1 B1 B2 B1 B1 B1 B2 B1 B1 B1 B2 B1 D#2 D#2 D#3 D#2'),
    lead: parseNotes('E5 . E5 . . . G5 . . . F#5 . . . D5 . E5 . E5 . . . B5 . . . A5 . G5 . F#5 . G5 . . . . . E5 . . . C5 . E5 . G5 . F#5 . . . D5 . . . F#5 . A5 . D#5 . . . . . B4 . . . D#5 . F#5 . B5 . . .'),
    drums: parseNotes('k - h k s - h - k - h k s - h h'),
  },
};

const Music = {
  songName: null, song: null, step: 0, nextTime: 0, timer: null, transpose: 0,
  // combat intensity 0..1 (set by the World every frame); level follows it smoothly
  intensity: 0, level: 0, lastBass: 45,

  play(name, transpose = 0) {
    if (this.songName === name && this.transpose === transpose && this.timer) return;
    this.songName = name; this.song = SONGS[name]; this.transpose = transpose; this.step = 0;
    this.nextTime = Sound.ctx ? Sound.ctx.currentTime + 0.1 : 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },
  stop() { this.songName = null; this.song = null; if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  kick() { if (this.song && Sound.ctx && this.nextTime < Sound.ctx.currentTime) this.nextTime = Sound.ctx.currentTime + 0.05; },

  tick() {
    const c = Sound.ctx;
    if (!c || !this.song || document.hidden || Sound.adMuted) return;
    if (c.state !== 'running') return;
    if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.05;
    const spb = 60 / this.song.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
  },

  // The action song breathes with the fight: quieter lead and no hats while
  // exploring; an arpeggio and double kicks join once shooting starts.
  playStep(s, t, spb) {
    const S = Sound, song = this.song, tr = this.transpose;
    if (!S.musicOn) return;
    this.level += (this.intensity - this.level) * 0.04;
    const I = this.songName === 'action' ? this.level : this.songName === 'boss' ? 1 : 0.6;
    const b = song.bass[s % song.bass.length];
    if (typeof b === 'number') { this.inst('bass', b + tr, t, spb * 1.8); this.lastBass = b + tr; }
    const l = song.lead[s % song.lead.length];
    if (typeof l === 'number') this.inst('lead', l + tr, t, spb * 2.4, 0.55 + 0.45 * I);
    if (I > 0.55 && s % 2 === 0) this.inst('arp', this.lastBass + (s % 8 < 4 ? 24 : 31), t, spb * 1.1, (I - 0.55) / 0.45);
    const d = song.drums[s % song.drums.length];
    if (d === 'k') this.drum('k', t);
    else if (d === 's') this.drum('s', t);
    else if (d === 'h' && I > 0.3) this.drum('h', t);
    if (I > 0.75 && s % 8 === 6 && d !== 'k') this.drum('k', t);
  },

  inst(kind, midi, t, dur, amp = 1) {
    const S = Sound, c = S.ctx;
    const fr = 440 * Math.pow(2, (midi - 69) / 12);
    const o = c.createOscillator(), g = c.createGain();
    if (kind === 'bass') {
      o.type = 'sawtooth'; o.frequency.value = fr;
      const f = S.filt('lowpass', 520, 1.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g);
    } else if (kind === 'arp') {
      o.type = 'square'; o.frequency.value = fr;
      const f = S.filt('lowpass', 1800, 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g);
    } else {
      o.type = 'square'; o.frequency.value = fr;
      const f = S.filt('lowpass', 2600, 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * amp, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g);
    }
    g.connect(S.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  },

  drum(kind, t) {
    const S = Sound, c = S.ctx;
    if (kind === 'k') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(S.musicBus); o.start(t); o.stop(t + 0.2);
    } else {
      const n = c.createBufferSource(); n.buffer = S.noiseBuf;
      const f = S.filt('highpass', kind === 's' ? 1400 : 7000), g = c.createGain();
      const dur = kind === 's' ? 0.13 : 0.03;
      g.gain.setValueAtTime(kind === 's' ? 0.45 : 0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(S.musicBus); n.start(t, Math.random(), dur + 0.02);
    }
  },
};
