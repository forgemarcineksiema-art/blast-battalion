import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const noop = () => {};
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

async function mainLoop({ portrait = false, hidden = false } = {}) {
  const frames = [];
  let updates = 0;
  const play = { world: {}, pause: noop };
  const context = createContext({
    console, URLSearchParams, STEP: 1 / 60, LEVELS: [{}], clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    performance: { now: () => 0 }, setTimeout: callback => { callback(); return 0; },
    requestAnimationFrame: callback => frames.push(callback), location: { search: '' },
    window: { addEventListener: noop },
    document: { readyState: 'complete', hidden, getElementById: () => ({ remove: noop }), addEventListener: noop },
    Gfx: { portraitBlocked: portrait, init: noop, resize: noop, ctx: {}, canvas: { focus: noop } },
    Hud: { init: noop }, Input: { init: noop, poll: noop, clear: noop, setCoop: noop },
    FX: { init: noop }, FXAuto: { sample: noop }, Font: { load: async () => false },
    Sprites: { build: noop, warm: noop }, Sound: { setHidden: noop },
    Platform: { init: async () => {}, loadingStart: noop, loadingDone: noop, adActive: false },
    Save: { load: noop, data: {} }, L10N: { pick: () => 'en', set: noop },
    applyFxSetting: noop, Settings: { apply: noop }, TunePanel: { init: noop, enabled: () => true },
    Playtest: { init: noop }, Wardrobe: { applyAll: noop }, isNewPlayer: () => true,
    PlayScene: play, TitleScene: {},
    App: { pending: false, tick: 0, go(scene) { this.scene = scene; }, update() { updates++; }, draw: noop },
  });
  new Script(source('main.js'), { filename: 'main.js' }).runInContext(context);
  for (let i = 0; i < 20 && !frames.length; i++) await Promise.resolve();
  assert.ok(frames.length, 'game scheduled its first animation frame');
  return { context, updates: () => updates, frame(now) { const callback = frames.shift(); assert.ok(callback); callback(now); } };
}

test('portrait rotation prompt suspends simulation without accumulating catch-up steps', async () => {
  const game = await mainLoop({ portrait: true });
  game.frame(100);
  game.frame(1000);
  assert.equal(game.updates(), 0);
  game.context.Gfx.portraitBlocked = false;
  game.frame(1000 + 1000 / 60);
  assert.equal(game.updates(), 1, 'rotating back advances one normal step');
});

test('hidden document does not continue simulation', async () => {
  const game = await mainLoop({ hidden: true });
  game.frame(100);
  assert.equal(game.updates(), 0);
});

test('touch rotation pauses an existing mission once and clears held input', () => {
  let cleared = 0, reset = 0, paused = 0;
  const wrapper = { clientWidth: 390, clientHeight: 844 };
  const rotate = { style: {} };
  const play = { world: {}, pause(reason) { assert.equal(reason, 'orientation'); paused++; } };
  const context = createContext({
    console, window: { devicePixelRatio: 1 }, document: { getElementById: () => rotate },
    Input: { isTouchDevice: true, clear: () => { cleared++; } }, Touch: { reset: () => { reset++; } },
    App: { scene: play }, PlayScene: play,
  });
  new Script(source('gfx.js')).runInContext(context);
  const gfx = new Script('Gfx').runInContext(context);
  gfx.canvas = { parentElement: wrapper, style: {} };
  gfx.ctx = {};
  gfx.resize();
  assert.equal(rotate.style.display, 'flex');
  assert.equal(gfx.portraitBlocked, true);
  assert.equal(paused, 1);
  assert.equal(cleared, 1);
  assert.equal(reset, 1);
  gfx.resize();
  assert.equal(paused, 1, 'repeated resize does not reopen pause');
  wrapper.clientWidth = 844; wrapper.clientHeight = 390;
  gfx.resize();
  assert.equal(gfx.portraitBlocked, false);
  assert.equal(rotate.style.display, 'none');
});
