'use strict';
// ============================================================================
//  Live tuning panel for designers. F2 (or the key under Esc) toggles it in
//  dev / web / artifact builds - never in the Poki or CrazyGames packages.
//  Every slider acts on the running game at once; changed values persist in
//  this browser and can be copied as JSON to bake into TUNE_DEFS (core.js).
// ============================================================================

const TunePanel = {
  KEY: 'blast_battalion_tune',
  el: null, rows: {}, note: null, text: null,

  enabled() { return String(window.GAME_PLATFORM || 'none') === 'none'; },

  init() {
    if (!this.enabled()) return;
    try {
      const o = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      for (const k in o) if (k in TUNE && typeof o[k] === 'number') TUNE[k] = o[k];
    } catch (e) { /* storage blocked: defaults */ }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2' || e.code === 'Backquote') { e.preventDefault(); this.toggle(); }
    });
  },

  changed() {
    const o = {};
    for (const d of TUNE_DEFS) if (Math.abs(TUNE[d.key] - d.def) > 1e-9) o[d.key] = TUNE[d.key];
    return o;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.changed())); } catch (e) { /* ignore */ } },
  fmt(d, v) {
    const dec = d.step < 0.01 ? 3 : d.step < 0.1 ? 2 : d.step < 1 ? 1 : 0;
    return (+v).toFixed(dec) + (d.unit || '');
  },

  toggle() {
    if (!this.el) this.build();
    const show = this.el.style.display === 'none';
    this.el.style.display = show ? 'block' : 'none';
    if (!show && document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
  },

  set(d, v, quiet) {
    TUNE[d.key] = v;
    const r = this.rows[d.key];
    if (r) {
      r.val.textContent = this.fmt(d, v);
      r.input.value = v;
      r.row.classList.toggle('chg', Math.abs(v - d.def) > 1e-9);
    }
    if (d.key === 'heroHp') this.applyHp();
    if (!quiet) this.save();
  },
  // hit points apply to the heroes already on the field
  applyHp() {
    const W = window.world;
    if (!W || !W.players) return;
    for (const p of W.players) {
      const mh = TUNE.heroHp > 0 ? TUNE.heroHp : Math.max(1, (W.skill && W.skill.hp) || 2);
      p.maxHp = mh; p.hp = mh;
    }
  },

  copy() {
    const json = JSON.stringify(this.changed(), null, 1);
    const ok = () => { this.note.textContent = 'Changed values copied - paste them in the chat.'; };
    const fallback = () => {
      this.text.style.display = 'block'; this.text.value = json; this.text.focus(); this.text.select();
      this.note.textContent = 'Selected - copy with Ctrl+C.';
    };
    try { navigator.clipboard.writeText(json).then(ok, fallback); } catch (e) { fallback(); }
  },
  reset() {
    for (const d of TUNE_DEFS) this.set(d, d.def, true);
    this.save();
    this.note.textContent = 'Defaults restored.';
  },

  build() {
    const css = document.createElement('style');
    css.textContent = `
#tune { position: fixed; top: 8px; right: 8px; width: 290px; max-height: calc(100vh - 16px); overflow-y: auto; z-index: 1000;
  background: rgba(14,12,22,0.94); color: #e8e4f8; border: 1px solid #4a4666; border-radius: 8px; padding: 8px 10px 10px;
  font: 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,0.5); user-select: none; }
#tune .hd { display: flex; align-items: center; gap: 5px; }
#tune .hd b { flex: 1; font-size: 13px; color: #ffd23a; }
#tune button { background: #2c2a3e; color: #e8e4f8; border: 1px solid #4a4666; border-radius: 4px; padding: 2px 7px; font: inherit; cursor: pointer; }
#tune button:hover { background: #3a3852; }
#tune .note { color: #9a98b0; font-size: 11px; margin: 4px 0 2px; min-height: 14px; }
#tune details { margin-top: 8px; }
#tune summary { cursor: pointer; color: #9ad8ff; font-weight: 600; letter-spacing: 0.05em; font-size: 11px; }
#tune .row { margin-top: 6px; }
#tune .lab { display: flex; justify-content: space-between; gap: 8px; }
#tune .val { color: #c8c4e0; font-variant-numeric: tabular-nums; white-space: nowrap; }
#tune .row.chg .val { color: #ffd23a; font-weight: 600; }
#tune input[type=range] { width: 100%; margin: 2px 0 0; accent-color: #ffd23a; }
#tune textarea { display: none; width: 100%; height: 90px; margin-top: 6px; box-sizing: border-box; background: #0e0c16; color: #e8e4f8;
  border: 1px solid #4a4666; font: 11px/1.3 ui-monospace, Consolas, monospace; }`;
    document.head.appendChild(css);

    const el = document.createElement('div');
    el.id = 'tune';
    el.style.display = 'none';
    const hd = document.createElement('div');
    hd.className = 'hd';
    const title = document.createElement('b');
    title.textContent = 'Game tuning';
    const bCopy = document.createElement('button'); bCopy.textContent = 'Copy'; bCopy.title = 'Copy changed values as JSON';
    const bReset = document.createElement('button'); bReset.textContent = 'Reset'; bReset.title = 'Reset everything to defaults';
    const bClose = document.createElement('button'); bClose.textContent = '×'; bClose.title = 'Close (F2)';
    bCopy.addEventListener('click', () => this.copy());
    bReset.addEventListener('click', () => this.reset());
    bClose.addEventListener('click', () => this.toggle());
    hd.append(title, bCopy, bReset, bClose);
    this.note = document.createElement('div');
    this.note.className = 'note';
    this.note.textContent = 'Applies at once and is saved in this browser. Double-click a slider = default value.';
    this.text = document.createElement('textarea');
    this.text.readOnly = true;
    el.append(hd, this.note, this.text);

    let group = null, box = null;
    for (const d of TUNE_DEFS) {
      if (d.group !== group) {
        group = d.group;
        box = document.createElement('details');
        box.open = true;
        const sum = document.createElement('summary');
        sum.textContent = group;
        box.appendChild(sum);
        el.appendChild(box);
      }
      const row = document.createElement('div');
      row.className = 'row';
      row.title = (d.hint ? d.hint + ' · ' : '') + 'default ' + this.fmt(d, d.def);
      const lab = document.createElement('div');
      lab.className = 'lab';
      const name = document.createElement('span');
      name.textContent = d.label;
      const val = document.createElement('span');
      val.className = 'val';
      lab.append(name, val);
      const input = document.createElement('input');
      input.type = 'range'; input.min = d.min; input.max = d.max; input.step = d.step;
      input.addEventListener('input', () => this.set(d, +input.value));
      // hand the keyboard back to the game as soon as the slider is released
      input.addEventListener('change', () => input.blur());
      row.addEventListener('dblclick', () => this.set(d, d.def));
      row.append(lab, input);
      box.appendChild(row);
      this.rows[d.key] = { row, val, input };
      this.set(d, TUNE[d.key], true);
    }
    // keys pressed inside the panel stay in the panel (F2 / Esc close it)
    el.addEventListener('keydown', (e) => {
      if (e.code === 'F2' || e.code === 'Backquote' || e.code === 'Escape') { e.preventDefault(); this.toggle(); }
      e.stopPropagation();
    });
    document.body.appendChild(el);
    this.el = el;
  },
};
