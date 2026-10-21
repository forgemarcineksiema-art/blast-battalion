import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

function controls() {
  const context = createContext({ navigator: {}, Gfx: { W: 480, H: 270 } });
  new Script(source('core.js')).runInContext(context);
  const touchCode = source('ui.js').match(/const Touch = \{[\s\S]*?\n\};/)[0];
  new Script(touchCode).runInContext(context);
  const input = new Script('Input').runInContext(context);
  const touch = new Script('Touch').runInContext(context);
  touch.layout();
  return { input, touch };
}

test('moving, firing and jumping can be held by separate fingers', () => {
  const { input, touch } = controls();
  const fire = touch.buttons.find(b => b.name === 'fire');
  const jump = touch.buttons.find(b => b.name === 'jump');
  touch.handle([
    { type: 'down', id: 1, x: 40, y: 220, touch: true },
    { type: 'move', id: 1, x: 85, y: 220, touch: true },
    { type: 'down', id: 2, x: fire.x, y: fire.y, touch: true },
    { type: 'down', id: 3, x: jump.x, y: jump.y, touch: true },
  ]);
  input.poll();
  assert.equal(input.down('right'), true);
  assert.equal(input.down('fire'), true);
  assert.equal(input.hit('jump'), true);
  touch.handle([{ type: 'up', id: 2, x: fire.x, y: fire.y, touch: true }]);
  input.poll();
  assert.equal(input.down('fire'), false);
  assert.equal(input.down('right'), true);
  assert.equal(input.down('jump'), true);
});

test('resetting touch input releases the joystick and held action buttons', () => {
  const { input, touch } = controls();
  const fire = touch.buttons.find(b => b.name === 'fire');
  touch.handle([{ type: 'down', id: 2, x: fire.x, y: fire.y, touch: true }]);
  input.poll();
  assert.equal(input.down('fire'), true);
  touch.reset();
  input.clear();
  input.poll();
  assert.equal(input.down('fire'), false);
  assert.equal(touch.joy, null);
  assert.equal(Object.keys(touch.ptr).length, 0);
});

test('PNG recording composites the real HUD unless explicitly disabled', () => {
  const game = { id: 'game' }, hud = { id: 'hud' }, draws = [];
  const context = createContext({
    Gfx: { W: 480, H: 270, canvas: game }, Hud: { canvas: hud },
    document: { createElement: () => ({ getContext: () => ({ drawImage: layer => draws.push(layer) }), toDataURL: () => 'frame' }) },
  });
  context.window = context;
  new Script(readFileSync(new URL('../tools/trailer.js', import.meta.url), 'utf8')).runInContext(context);
  const trailer = context.TRAILER;
  trailer.begin = () => {};
  trailer.sim = callback => callback();
  trailer.tick = () => {};
  assert.equal(trailer.capture(0, 1, [480, 270], 0, 4, false).length, 2);
  assert.deepEqual(draws, [game, hud, game, hud]);
  draws.length = 0;
  trailer.capture(0, 1, [480, 270], 0, 4, true);
  assert.deepEqual(draws, [game, game]);
});
