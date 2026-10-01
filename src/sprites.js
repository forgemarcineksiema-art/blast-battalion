'use strict';
// ============================================================================
//  Procedural pixel-art: characters (paper-doll), tiles, props, backgrounds.
//  Everything is generated at boot - no external image assets.
// ============================================================================

const THEMES = {
  jungle: {
    name: 'JUNGLE',
    skyTop: '#4f9fd0', skyBot: '#cfeaf0', sun: '#fff6c8',
    far: '#86b8c0', mid: '#4f8f72', near: '#2c664a',
    dirt: ['#6e4b2e', '#57391f', '#86603c', '#3a2716'],
    top: ['#4f9a2c', '#7cc23b', '#2f6a1c'],
    rock: ['#6f6c6a', '#55524f', '#8d8a86'],
    stone: ['#7a8068', '#5d6350', '#9aa084', '#4f8a3a'],
    bgDirt: '#2e2016',
    wood: ['#8a5a32', '#6b4325', '#a8743f'],
    decor: ['palm', 'palm', 'bush', 'fern', 'bush'],
    fog: 'rgba(200,235,240,0.10)',
  },
  desert: {
    name: 'DESERT',
    skyTop: '#d9824a', skyBot: '#f7dca4', sun: '#fff1c0',
    far: '#d9a877', mid: '#c48a58', near: '#9b6640',
    dirt: ['#c08650', '#9c6a3c', '#d8a468', '#6a4628'],
    top: ['#e6c07a', '#f6dca2', '#c49a58'],
    rock: ['#a5826a', '#86664f', '#c09c80'],
    stone: ['#d2ae78', '#ae8a56', '#ead09c', '#ae8a56'],
    bgDirt: '#4a3020',
    wood: ['#8e6238', '#6e4a2a', '#ad7c48'],
    decor: ['cactus', 'deadbush', 'cactus', 'bones', 'deadbush'],
    fog: 'rgba(255,220,170,0.10)',
  },
  arctic: {
    name: 'ARCTIC',
    skyTop: '#2f4f82', skyBot: '#a9c6e0', sun: '#eef6ff',
    far: '#8ea8c8', mid: '#67819f', near: '#46607e',
    dirt: ['#6a6058', '#524840', '#83786d', '#352e28'],
    top: ['#e8f0fa', '#ffffff', '#aebfd4'],
    rock: ['#7a8490', '#5c6570', '#98a2ad'],
    stone: ['#8c96a2', '#6c7680', '#aab4c0', '#d8e6f2'],
    bgDirt: '#2a2622',
    wood: ['#7e5634', '#5e3e24', '#9c6e44'],
    decor: ['pine', 'pine', 'snowbush', 'pine', 'rockpile'],
    fog: 'rgba(230,240,255,0.12)',
  },
};

// ---------------------------------------------------------------------------
//  Character looks
// ---------------------------------------------------------------------------
const LOOKS = {
  havoc: { skin: '#e8b48a', skinD: '#c48d66', hair: '#231b17', hat: 'bandana', hatC: '#d8322a', hatD: '#9e1f1a', shirt: '#4f6b2d', shirtD: '#3a5020', torso: 'tank', arm: 'skin', pants: '#5a6a3a', pantsD: '#434f2a', boots: '#2a2420', gear: '#4a3522', weapon: 'rifle' },
  buck: { skin: '#e0a77c', skinD: '#b9835c', hair: '#6b4a2a', hat: 'cowboy', hatC: '#7a5230', hatD: '#4e331d', shirt: '#3d6fb0', shirtD: '#2c528a', torso: 'vest', vest: '#7a5230', arm: 'shirt', pants: '#35507a', pantsD: '#263a5a', boots: '#4a3020', gear: '#2a1e14', weapon: 'shotgun' },
  scorch: { skin: '#e8b48a', skinD: '#c48d66', hair: '#333', hat: 'gasmask', hatC: '#5a5a64', hatD: '#3c3c44', mask: '#8a8a96', shirt: '#e07a22', shirtD: '#b45a14', torso: 'suit', arm: 'shirt', pants: '#d06a1a', pantsD: '#a24f10', boots: '#2a2a30', gear: '#3a3a44', back: 'tank', weapon: 'flamer' },
  ronin: { skin: '#e3ae84', skinD: '#bf8a62', hair: '#111', hat: 'hood', hatC: '#1f2233', hatD: '#12131c', shirt: '#262a40', shirtD: '#181a2a', torso: 'gi', arm: 'shirt', pants: '#262a40', pantsD: '#181a2a', boots: '#15161f', gear: '#c42a2a', back: 'sheath', weapon: 'katana' },
  boomer: { skin: '#d49a6e', skinD: '#b07a50', hair: '#333', hat: 'helmet', hatC: '#5d7240', hatD: '#3c4a28', shirt: '#6b7a45', shirtD: '#4f5a32', torso: 'jacket', arm: 'shirt', pants: '#55603a', pantsD: '#3e4629', boots: '#2a2420', gear: '#3a2e1e', back: 'pack', weapon: 'rocket' },
  brutus: { skin: '#c98b62', skinD: '#a56d48', hair: '#2a1c14', hat: 'bald', shirt: '#2a2a30', shirtD: '#18181c', torso: 'bigvest', arm: 'skin', pants: '#3a3a44', pantsD: '#26262e', boots: '#18181c', gear: '#c8a040', weapon: 'minigun', wide: true },
  deadeye: { skin: '#e3ae84', skinD: '#bf8a62', hair: '#4a3a2a', hat: 'boonie', hatC: '#6b7a45', hatD: '#4a5530', shirt: '#5b6b3a', shirtD: '#3f4a28', torso: 'camo', arm: 'shirt', pants: '#5b6b3a', pantsD: '#3f4a28', boots: '#2a2420', gear: '#3a2e1e', weapon: 'sniper' },
  volt: { skin: '#f0c29c', skinD: '#cc9e78', hair: '#f4f4f8', hat: 'spiky', shirt: '#e8ecf2', shirtD: '#b8c0cc', torso: 'coat', arm: 'shirt', pants: '#3a4a6a', pantsD: '#2a3650', boots: '#20242e', gear: '#2fb8ff', weapon: 'tesla' },
  chrono: { skin: '#e8b48a', skinD: '#c48d66', hair: '#1a1418', hat: 'shades', shirt: '#3e3252', shirtD: '#2a2238', torso: 'coat', arm: 'shirt', pants: '#2a2432', pantsD: '#1c1822', boots: '#15131c', gear: '#8a8aff', weapon: 'burst' },
  skyhawk: { skin: '#e0a77c', skinD: '#b9835c', hair: '#6b4a2a', hat: 'aviator', hatC: '#7a5230', hatD: '#4e331d', shirt: '#8a5a32', shirtD: '#6a4222', torso: 'jacket', arm: 'shirt', pants: '#4a5a3a', pantsD: '#36422a', boots: '#2a2420', gear: '#e8e0c8', back: 'jetpack', weapon: 'pistols' },
  ricochet: { skin: '#f0c29c', skinD: '#cc9e78', hair: '#c8401a', hat: 'ponytail', hatC: '#2fb8a8', shirt: '#2a8a80', shirtD: '#1e6a62', torso: 'tank', arm: 'skin', pants: '#3a3a4a', pantsD: '#2a2a36', boots: '#1e1e26', gear: '#e8c547', weapon: 'disc' },
  phantom: { skin: '#d8a47c', skinD: '#b58560', hair: '#111', hat: 'balaclava', hatC: '#1e1e26', hatD: '#121218', shirt: '#26262e', shirtD: '#18181e', torso: 'suit', arm: 'shirt', pants: '#22222a', pantsD: '#16161c', boots: '#101014', gear: '#7cff7c', weapon: 'smg' },

  grunt: { skin: '#d8a47c', skinD: '#b58560', hat: 'visor', hatC: '#40444e', hatD: '#2a2c33', mask: '#2a2c33', shirt: '#4c515c', shirtD: '#363a43', torso: 'uniform', arm: 'shirt', pants: '#3a3d46', pantsD: '#2a2c33', boots: '#18181c', gear: '#c0302a', weapon: 'ak' },
  bomber: { skin: '#d8a47c', skinD: '#b58560', hair: '#1e1a18', hat: 'crazy', hatC: '#c0302a', hatD: '#8a1e1a', shirt: '#7a6a4a', shirtD: '#5a4e36', torso: 'uniform', arm: 'skin', pants: '#4a4a52', pantsD: '#35353c', boots: '#18181c', gear: '#e8c547', weapon: 'none' }, // his bomb: drawBomb (entities.js)
  grenadier: { skin: '#d8a47c', skinD: '#b58560', hat: 'gasmaskE', hatC: '#3d4a36', hatD: '#2a3326', mask: '#5a5f56', shirt: '#4a5540', shirtD: '#353e2e', torso: 'uniform', arm: 'shirt', pants: '#3a4232', pantsD: '#2a3024', boots: '#18181c', gear: '#c0302a', weapon: 'grenade' },
  rpg: { skin: '#d8a47c', skinD: '#b58560', hat: 'visor', hatC: '#5a4a38', hatD: '#3e3326', mask: '#2a2c33', shirt: '#6a5a44', shirtD: '#4e4232', torso: 'uniform', arm: 'shirt', pants: '#4a4034', pantsD: '#342d24', boots: '#18181c', gear: '#c0302a', weapon: 'rpg' },
  heavy: { skin: '#c98b62', skinD: '#a56d48', hat: 'heavyhelm', hatC: '#34363e', hatD: '#1e2026', mask: '#26282e', shirt: '#44474f', shirtD: '#2c2e34', torso: 'armor', arm: 'shirt', pants: '#303238', pantsD: '#202226', boots: '#141418', gear: '#c0302a', weapon: 'hmg', big: true },
  shield: { skin: '#d8a47c', skinD: '#b58560', hat: 'visor', hatC: '#3a4a66', hatD: '#26324a', mask: '#2a2c33', shirt: '#3e4c66', shirtD: '#2c3850', torso: 'armor', arm: 'shirt', pants: '#2c3850', pantsD: '#1e2840', boots: '#141418', gear: '#c0302a', weapon: 'shield' },
  scout: { skin: '#d8a47c', skinD: '#b58560', hair: '#2a1e14', hat: 'beret', hatC: '#b8302a', hatD: '#7a1e1a', shirt: '#7a7458', shirtD: '#5a5640', torso: 'uniform', arm: 'shirt', pants: '#5a5640', pantsD: '#423f2e', boots: '#18181c', gear: '#c0302a', weapon: 'none', back: 'radio' },
  prisoner: { skin: '#e0a77c', skinD: '#b9835c', hair: '#5a4030', hat: 'messy', shirt: '#d8d0bc', shirtD: '#aaa28e', torso: 'rags', arm: 'skin', pants: '#6a6056', pantsD: '#4e463e', boots: '#3a3028', gear: '#4a3a2a', weapon: 'none' },
  general: { skin: '#d8a47c', skinD: '#b58560', hair: '#ddd', hat: 'visor', hatC: '#5a1a1a', hatD: '#3a1010', mask: '#2a2c33', shirt: '#5a1a1a', shirtD: '#3a1010', torso: 'uniform', arm: 'shirt', pants: '#2a2020', pantsD: '#1a1414', boots: '#111', gear: '#e8c547', weapon: 'none' },
};

LOOKS.shieldless = Object.assign({}, LOOKS.shield, { weapon: 'none' });
LOOKS.colonel = Object.assign({}, LOOKS.general, { weapon: 'pistol', hair: '#3a2a1a' });
LOOKS.mortar = Object.assign({}, LOOKS.grunt, { hat: 'helmet', hatC: '#4a5040', hatD: '#343a2c', shirt: '#5a6048', shirtD: '#444a36', pants: '#444a36', pantsD: '#343a2c', weapon: 'none' });
LOOKS.esniper = Object.assign({}, LOOKS.grunt, { hatC: '#4a5040', hatD: '#343a2c', shirt: '#5a6048', shirtD: '#444a36', torso: 'camo', pants: '#444a36', pantsD: '#343a2c', weapon: 'sniper' });
LOOKS.eflamer = Object.assign({}, LOOKS.grenadier, { hatC: '#5a3a2a', hatD: '#3e281c', mask: '#6a5a4a', shirt: '#6a4a34', shirtD: '#4e3626', torso: 'armor', pants: '#4e3626', pantsD: '#3a281c', back: 'tank', weapon: 'flamer' });
LOOKS.officer = { skin: '#d8a47c', skinD: '#b58560', hair: '#2a2018', hat: 'cap', hatC: '#3a4a3a', hatD: '#243024', shirt: '#4a5a44', shirtD: '#34402e', torso: 'uniform', arm: 'shirt', pants: '#34402e', pantsD: '#242c20', boots: '#111', gear: '#c0302a', weapon: 'pistol', back: 'radio' };

// pose = legs:[backDx, frontDx, backLift, frontLift], bob (a crouch; negative = up on the toes), arms,
// and since 1.32: lean (the upper body, px forward; the feet stay put), head [dx, dy], gun [dx, dy]
// (the weapon and the hands on it), shield (px: a riot shield pulled back or thrust out), noHat
const NO_OFS = [0, 0];
// hats that fly off when their wearer goes down (1.32); the metal ones clink when they land
const HAT_POPS = { visor: 1, heavyhelm: 1, helmet: 1, cowboy: 1, boonie: 1, cap: 1, beret: 1, aviator: 1, party: 1, tophat: 1, viking: 1, crown: 1 };
const HAT_METAL = { visor: 1, heavyhelm: 1, helmet: 1, viking: 1, crown: 1 };
const POSES = {
  idle: { legs: [0, 0, 0, 0], bob: 0, arms: 'gun' },
  idle2: { legs: [0, 0, 0, 0], bob: 0, arms: 'gun', lower: 1 },
  run0: { legs: [-2, 2, 0, 0], bob: 0, arms: 'gun' },
  run1: { legs: [-1, 0, 0, 2], bob: -1, arms: 'gun' },
  run2: { legs: [2, -2, 0, 0], bob: 0, arms: 'gun' },
  run3: { legs: [0, -1, 2, 0], bob: -1, arms: 'gun' },
  jump: { legs: [-1, 2, 2, 2], bob: 0, arms: 'gun' },
  fall: { legs: [-2, 1, 0, 1], bob: 0, arms: 'gun' },
  climb0: { legs: [0, 1, 3, 0], bob: 0, arms: 'up' },
  climb1: { legs: [1, 0, 0, 3], bob: 0, arms: 'up2' },
  throw: { legs: [-1, 2, 0, 0], bob: 0, arms: 'throw' },
  slide: { legs: [-3, 5, 0, 1], bob: 4, arms: 'gun', lower: 1 },
  slash0: { legs: [-1, 2, 0, 0], bob: 0, arms: 'slashUp' },
  slash1: { legs: [-2, 3, 0, 0], bob: 1, arms: 'slashFwd' },
  wave0: { legs: [0, 0, 0, 0], bob: 0, arms: 'wave' },
  cling: { legs: [-2, 1, 3, 0], bob: 0, arms: 'gun' }, // on a wall, back to it: one foot up against the wall, gun out
  wave1: { legs: [0, 0, 0, 0], bob: -1, arms: 'wave2' },
  // ---- 1.32: a pose for every moment (drawn the first time a character needs it: buildCharacter)
  land: { legs: [-2, 2, 0, 0], bob: 2, arms: 'gun' },                           // the knees give on landing
  kneel: { legs: [-3, 2, 0, 0], bob: 4, arms: 'gun', lean: 1 },                 // a hard landing, a sniper's kneel
  skid: { legs: [-1, 4, 0, 0], bob: 1, arms: 'gun', lean: -1, gun: [-1, -1] },  // braking into a turn
  apex: { legs: [-1, 1, 3, 3], bob: 0, arms: 'gun' },                           // legs tucked at the top of a jump
  aim: { legs: [-2, 2, 0, 0], bob: 1, arms: 'gun', lean: 1, gun: [0, -1] },     // the gun up to the eye, knees soft
  snipe: { legs: [-3, 2, 0, 0], bob: 2, arms: 'gun', lean: 1, gun: [0, -2] },   // a half-kneel, the rifle where the laser starts
  recoil: { legs: [-2, 2, 0, 0], bob: 0, arms: 'gun', gun: [-1, 0] },           // the gun kicks back
  hurt: { legs: [-3, 1, 0, 2], bob: 0, arms: 'gun', lean: -1, head: [-1, 0], gun: [-1, -2] }, // knocked back (and a startle)
  dead: { legs: [-3, 3, 0, 0], bob: 0, arms: 'limp', head: [0, 1] },
  stab: { legs: [-3, 3, 0, 0], bob: 1, arms: 'stab', lean: 1 },                 // the knife
  carry: { legs: [-2, 2, 0, 0], bob: 0, arms: 'carry', lean: -1 },              // holding a grabbed soldier
  throw2: { legs: [-2, 3, 0, 0], bob: 1, arms: 'throw2', lean: 1 },             // a throw's follow-through
  flail0: { legs: [-1, 1, 0, 1], bob: 0, arms: 'flail' },
  flail1: { legs: [-1, 1, 1, 0], bob: -1, arms: 'flail2' },
  panic0: { legs: [-2, 2, 0, 0], bob: 0, arms: 'flail' },                       // running with the arms in the air
  panic1: { legs: [-1, 0, 0, 2], bob: -1, arms: 'flail2' },
  panic2: { legs: [2, -2, 0, 0], bob: 0, arms: 'flail' },
  panic3: { legs: [0, -1, 2, 0], bob: -1, arms: 'flail2' },
  // 1.34: the bomber's charge, his bomb held high in both hands (drawBomb sits on the hands)
  bomb0: { legs: [-2, 2, 0, 0], bob: 0, arms: 'hang' },
  bomb1: { legs: [-1, 0, 0, 2], bob: -1, arms: 'hang' },
  bomb2: { legs: [2, -2, 0, 0], bob: 0, arms: 'hang' },
  bomb3: { legs: [0, -1, 2, 0], bob: -1, arms: 'hang' },
  ears: { legs: [-2, 2, 0, 0], bob: 3, arms: 'ears', head: [0, 1] },            // ducking, hands over the ears
  radio: { legs: [-1, 1, 0, 0], bob: 0, arms: 'radio' },                        // the handset at the ear, pointing at you
  cheer: { legs: [-2, 2, 0, 0], bob: 0, arms: 'cheer' },                        // a fist in the air
  brow: { legs: [-1, 1, 0, 0], bob: 0, arms: 'brow', lean: 1, gun: [-2, 2] },   // a hand over the eyes, looking out
  reload: { legs: [-1, 1, 0, 0], bob: 1, arms: 'reload', head: [0, 1], gun: [-1, 2] },
  hang: { legs: [0, 1, 0, 1], bob: 0, arms: 'hang' },                           // both arms up: a parachute, a stretch, a spell
  slump: { legs: [-2, 2, 0, 0], bob: 3, arms: 'down', head: [0, 1], lean: 1 },  // a prisoner who's given up hope
  brace: { legs: [-3, 2, 0, 0], bob: 1, arms: 'gun', lean: -1, shield: -2 },    // the shield drawn back before a bash
  bash: { legs: [-3, 3, 0, 0], bob: 0, arms: 'gun', lean: 1, shield: 3 },
};

function humanLayout(look) {
  if (look.big) return { W: 38, H: 28, cx: 15, headW: 7, headH: 7, torsoW: 9, torsoH: 8, legH: 7, legW: 3, armT: 3 };
  return { W: 32, H: 22 + (look.tall || 0), cx: 13, headW: 6, headH: 6, torsoW: look.wide ? 7 : 6, torsoH: 6, legH: 6, legW: 2, armT: 2 };
}

function drawHuman(ctx, look, pose, L) {
  const R = (x, y, w, h, c) => { if (!c) return; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, fn) => {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (let i = 0; i < 64; i++) { fn(x, y); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
  };
  const bob = pose.bob || 0, lean = pose.lean || 0, hd = pose.head || NO_OFS, gd = pose.gun || NO_OFS;
  const footY = L.H - 1;
  const hipY = L.H - L.legH + bob;
  const tt = hipY - L.torsoH;
  const ht = tt - L.headH + hd[1];
  const tw = L.torsoW, th = L.torsoH, hw = L.headW, hh = L.headH;
  const cx0 = L.cx + lean; // the upper body's middle (it leans; the feet stay where they are)
  const tl = cx0 - Math.floor(L.torsoW / 2);
  const hl = cx0 - Math.floor(L.headW / 2) + hd[0];
  const hx = tl + tw + 1 + gd[0], hy = tt + 2 + (pose.lower || 0) + gd[1];
  const skin = look.skin, skinD = look.skinD || shadeHex(look.skin, 0.8);
  const armC = look.arm === 'skin' ? skin : look.shirt;
  const armD = look.arm === 'skin' ? skinD : look.shirtD;
  const eye = '#1a1410';
  let weapon = look.weapon;
  let arms = pose.arms;
  if (weapon === 'none' && (arms === 'gun' || arms === 'reload')) arms = 'down';
  if (weapon === 'katana' && arms === 'gun') arms = 'katana';

  // ---- back items (behind body)
  if (look.back === 'tank') { R(tl - 3, tt, 3, th - 1, '#c83a2a'); R(tl - 3, tt, 1, th - 1, '#8e2418'); R(tl - 2, tt - 1, 1, 1, '#8a8a96'); }
  if (look.back === 'pack') { R(tl - 3, tt + 1, 3, th - 2, '#4f5a32'); R(tl - 3, tt + 1, 3, 1, '#6b7a45'); }
  if (look.back === 'sheath' && arms !== 'slashUp') { line(tl - 2, tt + th, tl + 3, tt - 2, (x, y) => P(x, y, '#3a2020')); }
  if (look.back === 'jetpack') { R(tl - 4, tt, 4, th, '#6e6e7a'); R(tl - 4, tt, 1, th, '#9a9aa6'); R(tl - 4, tt + th, 3, 1, '#3a3a44'); P(tl - 3, tt + th + 1, '#ffae3a'); }
  if (look.back === 'radio') { R(tl - 3, tt + 1, 3, th - 2, '#4a4a36'); R(tl - 3, tt + 1, 3, 1, '#6a6a4e'); R(tl - 2, tt - 6, 1, 7, '#2a2a30'); P(tl - 2, tt - 7, '#e8321e'); }

  // ---- hand positions by arm mode
  let fH, bH; // front/back hand
  const fS = [cx0 + 1, tt + 1], bS = [cx0 - 2, tt + 1];
  const low = [cx0 - 3, tt + th - 2]; // a free hand hanging at the side
  switch (arms) {
    case 'gun': fH = [hx - 1, hy]; bH = [hx + 2, hy]; if (weapon === 'rocket' || weapon === 'rpg') { fH = [hx - 1, hy - 2]; bH = [hx + 2, hy - 1]; } break;
    case 'katana': fH = [hx - 1, hy]; bH = [hx - 2, hy + 1]; break;
    case 'down': fH = [cx0 + 2, tt + th - 2]; bH = low; break;
    case 'up': fH = [cx0 + 2, ht - 2]; bH = [cx0 - 1, ht - 1]; break;
    case 'up2': fH = [cx0 + 2, ht - 1]; bH = [cx0 - 1, ht - 2]; break;
    case 'throw': fH = [cx0 + 4, ht - 1]; bH = [hx, hy + 1]; break;
    case 'wave': fH = [cx0 + 3, ht - 3]; bH = [cx0 - 4, ht - 2]; break;
    case 'wave2': fH = [cx0 + 4, ht - 1]; bH = [cx0 - 5, ht - 1]; break;
    case 'slashUp': fH = [cx0 + 1, ht - 1]; bH = [cx0, ht]; break;
    case 'slashFwd': fH = [hx + 1, hy - 1]; bH = [hx, hy]; break;
    // ---- 1.32
    case 'stab': fH = [hx + 2, hy]; bH = low; break;                            // the knife arm thrust out
    case 'carry': fH = [hx, hy - 2]; bH = [hx - 1, hy - 1]; break;               // both hands on a grabbed soldier
    case 'throw2': fH = [hx + 2, hy + 2]; bH = [cx0 - 3, tt + 2]; break;         // the arm follows the throw through
    case 'flail': fH = [cx0 + 5, ht - 3]; bH = [cx0 - 6, ht - 1]; break;     // both arms up and out, clear of the head
    case 'flail2': fH = [cx0 + 4, ht - 1]; bH = [cx0 - 7, ht - 3]; break;
    case 'ears': fH = [hl + hw - 1, ht + 2]; bH = [hl - 1, ht + 2]; break;       // hands over the ears
    case 'radio': fH = [hx + 3, hy - 3]; bH = [hl - 1, ht + 2]; break;           // the handset at the ear, the other hand points
    case 'cheer': fH = weapon === 'none' ? [cx0 + 2, tt + th - 2] : [hx - 1, hy]; bH = [cx0 - 5, ht - 3]; break; // a fist in the air
    case 'brow': fH = [hl + hw, ht + 1]; bH = weapon === 'none' ? low : [hx, hy + 1]; break;  // a hand over the eyes
    case 'reload': fH = [hx - 1, hy]; bH = [hx + 2, hy + 3]; break;              // the other hand at the magazine
    case 'hang': fH = [cx0 + 3, ht - 3]; bH = [cx0 - 4, ht - 3]; break;
    case 'limp': fH = [cx0 + 4, tt + th]; bH = [cx0 - 5, tt + th - 1]; break;
    default: fH = [hx - 1, hy]; bH = [hx + 2, hy];
  }
  const armLine = (s, e, c) => line(s[0], s[1], e[0], e[1], (x, y) => R(x, y, 1, L.armT, c));

  // ---- back arm
  armLine(bS, bH, armD);

  // ---- legs
  const [bdx, fdx, bl, fl] = pose.legs;
  const leg = (x0, dx, lift, c, boot) => {
    const bottom = footY - lift;
    const bootTop = bottom - 1;
    const rows = bootTop - hipY;
    for (let r = 0; r < rows; r++) {
      const t = rows <= 1 ? 1 : r / (rows - 1);
      R(x0 + Math.round(dx * t + lean * (1 - t)), hipY + r, L.legW, 1, c);
    }
    R(x0 + dx, bootTop, L.legW + 1, 2, boot);
    R(x0 + dx + L.legW, bottom, 1, 1, shadeHex(boot, 0.7));
  };
  leg(L.cx - L.legW, bdx, bl, look.pantsD, shadeHex(look.boots, 0.8));
  leg(L.cx, fdx, fl, look.pants, look.boots);

  // ---- torso
  R(tl, tt, tw, th, look.shirt);
  R(tl, tt, 1, th, look.shirtD);
  const belt = look.torso === 'gi' ? look.gear : '#2a2018';
  switch (look.torso) {
    case 'tank':
      R(tl + tw - 1, tt, 1, 2, skin); R(tl + 1, tt, 1, 1, skin);
      for (let i = 0; i < th - 1; i++) P(tl + i + 1, tt + i, i % 2 ? '#d8b84a' : look.gear);
      break;
    case 'vest': R(tl, tt, 2, th - 1, look.vest); R(tl + tw - 2, tt, 2, th - 1, look.vest); P(tl + tw - 1, tt + 2, '#d8b84a'); break;
    case 'suit': for (let i = 1; i < th - 1; i++) P(tl + tw - 2, tt + i, look.shirtD); R(tl + 1, tt, tw - 1, 1, shadeHex(look.shirt, 1.15)); break;
    case 'gi': P(tl + tw - 2, tt, shadeHex(look.shirt, 1.5)); P(tl + tw - 3, tt + 1, shadeHex(look.shirt, 1.5)); P(tl + tw - 1, tt, skin); break;
    case 'jacket': R(tl + tw - 3, tt + 1, 2, 2, look.shirtD); for (let i = 0; i < th - 1; i++) P(tl + tw - 1 - i, tt + i, look.gear); break;
    case 'bigvest': R(tl + tw - 2, tt, 2, th - 1, skin); R(tl + tw - 2, tt, 1, th - 1, skinD); for (let i = 0; i < th - 1; i++) P(tl + 1 + i, tt + i, i % 2 ? '#e0c050' : '#8a6a2a'); break;
    case 'camo': [[1, 1], [3, 2], [4, 4], [2, 4], [5, 1]].forEach(([a, b]) => { if (a < tw) P(tl + a, tt + b, '#3a4726'); }); P(tl + 2, tt + 1, '#7a8a50'); break;
    case 'coat': R(tl + tw - 2, tt, 1, th, look.gear); R(tl + 1, tt, 2, 1, '#ffffff'); break;
    case 'uniform': R(tl + tw - 3, tt + 1, 2, 1, look.shirtD); P(tl + tw - 1, tt + 3, look.gear); break;
    case 'armor': R(tl + 1, tt + 1, tw - 2, th - 3, shadeHex(look.shirt, 1.25)); R(tl + 1, tt + th - 3, tw - 2, 1, look.gear); R(tl + 2, tt + 2, 2, 1, shadeHex(look.shirt, 1.5)); break;
    case 'rags': P(tl + 2, tt + th - 2, skin); P(tl + 4, tt + 1, skinD); P(tl + tw - 1, tt + th - 2, skin); break;
  }
  R(tl, tt + th - 1, tw, 1, belt);
  if (look.torso !== 'rags') P(tl + tw - 2, tt + th - 1, '#d8b84a');
  if (look.torso === 'coat') { R(tl, tt + th, tw - 1, 2, look.shirt); R(tl, tt + th, 1, 2, look.shirtD); }

  // ---- head
  const E = hl + hw - 2; // eye column
  R(hl, ht, hw, hh, skin);
  R(hl, ht + hh - 1, 2, 1, skinD);
  if (pose.noHat && HAT_POPS[look.hat]) {
    // the hat has flown off: a masked face stays masked, anyone else shows their hair
    if (look.hat === 'visor' || look.hat === 'heavyhelm') { R(hl, ht, hw, hh, look.mask); R(hl + 2, ht + 2, hw - 1, 1, '#e8321e'); P(hl + hw, ht + 2, '#ff9a7a'); }
    else { const hair = look.hair || '#2a2018'; R(hl, ht - 1, hw, 2, hair); R(hl, ht + 1, 1, 2, hair); P(E, ht + 2, eye); }
  } else switch (look.hat) {
    case 'bandana':
      R(hl, ht - 1, hw, 2, look.hair); R(hl, ht + 1, 2, 3, look.hair);
      R(hl, ht + 1, hw, 1, look.hatC); P(hl - 1, ht + 1, look.hatC); P(hl - 2, ht + 2, look.hatC); P(hl - 1, ht + 2, look.hatD);
      P(hl + 1, ht - 2, look.hair); P(hl + 3, ht - 2, look.hair);
      P(E, ht + 2, eye); P(E, ht + 3, eye); R(hl + 3, ht + hh - 1, hw - 3, 1, skinD);
      break;
    case 'cowboy':
      R(hl, ht + 1, 1, 3, look.hair);
      R(hl + 1, ht - 3, hw - 2, 2, look.hatC); R(hl + 1, ht - 1, hw - 2, 1, look.hatD);
      R(hl - 2, ht, hw + 4, 1, look.hatC); P(hl - 2, ht + 1, look.hatD); P(hl + hw + 1, ht - 1, look.hatC);
      P(E, ht + 2, eye); R(hl + hw - 3, ht + hh - 2, 3, 1, look.hair);
      break;
    case 'gasmask':
      R(hl, ht - 1, hw, hh + 1, look.hatC); R(hl - 1, ht, hw + 1, 1, look.hatD); R(hl, ht - 1, hw, 1, look.hatD);
      R(hl + 2, ht + 1, hw - 2, hh - 1, look.mask); R(E - 1, ht + 2, 2, 1, '#f2c12e'); P(E, ht + 2, '#fff6b0');
      R(hl + hw - 1, ht + hh - 2, 2, 2, '#2a2a30'); P(hl + hw, ht + hh - 2, '#55555f');
      break;
    case 'hood':
      R(hl, ht - 1, hw, hh + 1, look.hatC); R(hl, ht + hh - 2, 2, 2, look.hatD);
      R(hl + 2, ht + 2, hw - 2, 1, skin); P(E, ht + 2, eye);
      R(hl, ht, hw, 1, look.gear); P(hl - 1, ht, look.gear); P(hl - 2, ht + 1, look.gear); P(hl - 3, ht + 1, '#8a1e1e');
      break;
    case 'helmet':
      R(hl, ht - 2, hw - 1, 1, look.hatC); R(hl - 1, ht - 1, hw + 1, 2, look.hatC); R(hl - 1, ht + 1, hw + 2, 1, look.hatD);
      R(E - 1, ht - 1, 2, 1, '#f28a1e'); P(E, ht - 1, '#ffd08a'); P(hl + 1, ht - 2, shadeHex(look.hatC, 1.3));
      P(E, ht + 3, eye); R(hl + 1, ht + 2, 1, 3, look.hatD);
      break;
    case 'bald':
      R(hl, ht, hw, 1, shadeHex(skin, 1.12)); R(hl + 2, ht + 2, hw - 1, 1, '#111116'); P(hl + hw, ht + 2, '#111116');
      R(hl + 1, ht + hh - 2, hw - 1, 2, look.hair); P(hl + 1, ht + 3, skinD);
      break;
    case 'boonie':
      R(hl, ht - 2, hw, 2, look.hatC); R(hl - 2, ht, hw + 4, 1, look.hatC); P(hl - 2, ht + 1, look.hatD); P(hl + hw + 1, ht + 1, look.hatD);
      P(hl + 1, ht - 2, look.hatD); P(hl + 4, ht - 1, look.hatD); P(hl, ht, look.hatD);
      P(E, ht + 2, eye); R(hl + 2, ht + 3, hw - 2, 1, '#4a5a30'); R(hl + 1, ht + 1, 1, 2, look.hair);
      break;
    case 'spiky':
      R(hl, ht - 1, hw, 2, look.hair); R(hl, ht + 1, 1, 3, look.hair);
      P(hl, ht - 2, look.hair); P(hl + 2, ht - 3, look.hair); P(hl + 2, ht - 2, look.hair); P(hl + 4, ht - 2, look.hair); P(hl - 1, ht - 1, look.hair); P(hl + 5, ht - 3, look.hair);
      R(hl + 2, ht + 2, hw - 1, 1, '#3fd8ff'); P(E, ht + 2, '#dffaff'); R(hl, ht + 2, 2, 1, '#20242e');
      break;
    case 'visor':
    case 'heavyhelm':
      R(hl, ht, hw, hh, look.mask);
      R(hl, ht - 2, hw - 1, 1, look.hatC); R(hl - 1, ht - 1, hw + 1, 2, look.hatC); R(hl - 1, ht + 1, hw + 2, 1, look.hatD);
      P(hl + 1, ht - 2, shadeHex(look.hatC, 1.3));
      R(hl + 2, ht + 2, hw - 1, look.hat === 'heavyhelm' ? 2 : 1, '#e8321e'); P(hl + hw, ht + 2, '#ff9a7a');
      if (look.hat === 'heavyhelm') R(hl + 2, ht + 4, hw - 2, 2, look.hatD);
      break;
    case 'crazy':
      P(hl + 1, ht - 1, look.hair); P(hl + 3, ht - 1, look.hair); P(hl + 5, ht - 1, look.hair);
      R(hl, ht, hw, 1, look.hatC); P(hl - 1, ht, look.hatC); P(hl - 2, ht + 1, look.hatD);
      P(E, ht + 2, '#ffffff'); P(E + 1, ht + 2, '#111'); R(E - 1, ht + hh - 2, 2, 1, '#5a1a1a'); R(hl, ht + 1, 1, 3, look.hair);
      break;
    case 'gasmaskE':
      R(hl, ht, hw, hh, look.hatC);
      R(hl, ht - 2, hw - 1, 1, look.hatC); R(hl - 1, ht - 1, hw + 1, 2, look.hatC); R(hl - 1, ht + 1, hw + 2, 1, look.hatD);
      R(hl + 2, ht + 2, hw - 2, hh - 2, look.mask); R(E - 1, ht + 2, 2, 1, '#e8321e');
      R(hl + hw - 1, ht + hh - 2, 2, 2, '#2a2a30');
      break;
    case 'messy':
      R(hl, ht - 1, hw, 2, look.hair); R(hl, ht + 1, 2, 3, look.hair); P(hl + 1, ht - 2, look.hair); P(hl + 4, ht - 2, look.hair);
      P(E, ht + 2, eye); R(hl + 2, ht + hh - 2, hw - 2, 2, look.hair);
      break;
    case 'shades':
      R(hl, ht - 1, hw, 2, look.hair); R(hl, ht + 1, 1, 3, look.hair); P(hl - 1, ht, look.hair); P(hl + 2, ht - 2, look.hair);
      R(hl + 2, ht + 2, hw - 1, 1, '#111116'); P(hl + hw, ht + 2, '#111116'); P(E, ht + 2, '#8a8aff');
      R(hl + 3, ht + hh - 1, hw - 3, 1, skinD);
      break;
    case 'aviator':
      R(hl, ht - 1, hw, 3, look.hatC); R(hl - 1, ht, 1, 4, look.hatD); R(hl, ht + 2, 1, 3, look.hatD);
      R(hl + 1, ht, hw - 1, 1, '#8fd0ea'); P(E, ht, '#d8f4ff');
      P(E, ht + 3, eye);
      break;
    case 'ponytail':
      R(hl, ht - 1, hw, 2, look.hair); R(hl, ht + 1, 2, 3, look.hair);
      R(hl - 2, ht, 2, 2, look.hair); R(hl - 3, ht + 1, 2, 3, look.hair); P(hl - 3, ht + 4, look.hair);
      R(hl, ht + 1, hw, 1, look.hatC);
      P(E, ht + 2, eye); P(E, ht + 3, eye);
      break;
    case 'balaclava':
      R(hl, ht - 1, hw, hh + 1, look.hatC); R(hl, ht - 1, hw, 1, look.hatD);
      R(hl + 2, ht + 2, hw - 1, 1, skin); P(E, ht + 2, '#7cff7c');
      break;
    case 'cap': // officer's peaked cap with a badge, and a mustache
      R(hl, ht + 1, 1, 3, look.hair);
      R(hl - 1, ht - 2, hw + 1, 2, look.hatC); R(hl, ht - 3, hw - 1, 1, look.hatC); P(hl + 1, ht - 3, shadeHex(look.hatC, 1.3));
      R(hl + 1, ht, hw + 1, 1, '#15151a'); P(hl + 2, ht - 2, '#e8c547');
      P(E, ht + 2, eye); R(E - 1, ht + hh - 2, 2, 1, look.hair);
      break;
    case 'beret':
      R(hl, ht + 1, 1, 3, look.hair);
      R(hl - 1, ht - 1, hw + 1, 2, look.hatC); R(hl, ht - 2, hw - 1, 1, look.hatC); P(hl - 2, ht, look.hatD); P(hl + 1, ht - 2, shadeHex(look.hatC, 1.3));
      R(hl + 2, ht + 2, hw - 1, 1, '#15151a'); P(E - 2, ht + hh - 2, skinD);
      break;
    // ---- wardrobe hats (1.25): each one draws the hair and the eyes too, like the hats above
    case 'party': // a striped cone with a pompom, worn at an angle
      R(hl, ht, hw, 1, look.hair); R(hl, ht + 1, 1, 3, look.hair);
      R(hl, ht - 1, 5, 1, look.hatC); R(hl + 1, ht - 2, 4, 1, look.hatD); R(hl + 1, ht - 3, 3, 1, look.hatC);
      R(hl + 2, ht - 4, 2, 1, look.hatD); P(hl + 2, ht - 5, look.hatC); P(hl + 2, ht - 6, '#ffffff'); P(hl + 3, ht - 6, '#e8e4f8');
      P(E, ht + 2, eye); R(hl + 3, ht + hh - 1, hw - 3, 1, skinD);
      break;
    case 'tophat': // tall silk hat with a red band
      R(hl, ht + 1, 1, 3, look.hair);
      R(hl, ht - 5, hw - 1, 5, look.hatC); R(hl, ht - 5, 1, 5, look.hatD); R(hl + 1, ht - 5, 1, 3, shadeHex(look.hatC, 1.6));
      R(hl, ht - 2, hw - 1, 1, '#b8302a'); R(hl - 1, ht, hw + 2, 1, look.hatC); P(hl - 1, ht, look.hatD);
      P(E, ht + 2, eye); R(hl + 3, ht + hh - 1, hw - 3, 1, skinD);
      break;
    case 'viking': // horned helmet, nose guard and a beard
      R(hl, ht + 1, 1, 3, look.hair);
      R(hl, ht - 2, hw - 1, 1, look.hatC); R(hl - 1, ht - 1, hw + 1, 2, look.hatC); R(hl - 1, ht + 1, hw + 2, 1, look.hatD);
      P(hl + 1, ht - 2, shadeHex(look.hatC, 1.3)); R(hl + hw - 1, ht + 2, 1, 2, look.hatD);
      P(hl - 2, ht - 1, '#e8e0c8'); P(hl - 3, ht - 2, '#e8e0c8'); P(hl - 3, ht - 3, '#c8bea0');
      P(hl + hw, ht - 1, '#e8e0c8'); P(hl + hw + 1, ht - 2, '#e8e0c8'); P(hl + hw + 1, ht - 3, '#c8bea0');
      P(E, ht + 2, eye); R(hl + 2, ht + hh - 1, hw - 1, 2, look.hair); P(hl + hw - 1, ht + hh + 1, look.hair);
      break;
    case 'crown': // gold, three points, two jewels
      R(hl, ht, hw, 1, look.hair); R(hl, ht + 1, 1, 3, look.hair);
      R(hl, ht - 2, hw, 2, look.hatC); R(hl, ht - 1, hw, 1, look.hatD);
      P(hl, ht - 3, look.hatC); P(hl + 3, ht - 3, look.hatC); P(hl + 5, ht - 3, look.hatC); P(hl + 3, ht - 4, '#fff4a0');
      P(hl + 1, ht - 2, '#e8321e'); P(hl + 4, ht - 2, '#3a8aff'); P(hl + 2, ht - 2, shadeHex(look.hatC, 1.3));
      P(E, ht + 2, eye); R(hl + 3, ht + hh - 1, hw - 3, 1, skinD);
      break;
  }

  // ---- weapon
  const W = (c) => c;
  const drawWeapon = () => {
    switch (weapon) {
      case 'rifle':
        R(hx - 5, hy, 3, 2, '#2a2420'); R(hx - 2, hy - 1, 7, 2, '#3a3a44'); R(hx - 1, hy - 1, 5, 1, '#55555f');
        R(hx + 5, hy - 1, 3, 1, '#23232a'); R(hx + 2, hy + 1, 2, 2, '#2a2a30'); P(hx + 1, hy - 2, '#23232a');
        break;
      case 'ak':
        R(hx - 5, hy, 3, 2, '#7a4a28'); R(hx - 2, hy - 1, 7, 2, '#2a2a30'); R(hx + 2, hy - 1, 3, 1, '#7a4a28');
        R(hx + 5, hy - 1, 3, 1, '#1e1e24'); P(hx + 2, hy + 1, '#2a2a30'); P(hx + 2, hy + 2, '#2a2a30'); P(hx + 3, hy + 2, '#2a2a30');
        break;
      case 'shotgun':
        R(hx - 5, hy, 4, 2, '#7a4a28'); R(hx - 1, hy - 1, 4, 2, '#2e2e36'); R(hx + 3, hy - 1, 6, 1, '#4a4a55');
        R(hx + 4, hy, 3, 1, '#8a5a32'); P(hx + 8, hy - 1, '#23232a');
        break;
      case 'flamer':
        R(hx - 3, hy - 1, 5, 3, '#6e6e7a'); R(hx - 3, hy - 1, 5, 1, '#9a9aa6'); R(hx + 2, hy - 1, 6, 2, '#4a4a55');
        R(hx + 8, hy - 1, 1, 2, '#23232a'); P(hx + 9, hy, '#ffae3a'); line(tl - 2, tt + 3, hx - 3, hy + 1, (x, y) => P(x, y, '#2a2a30'));
        break;
      case 'pistol':
      case 'pistols':
        R(hx - 1, hy - 1, 5, 2, '#2a2a30'); R(hx, hy - 1, 3, 1, weapon === 'pistols' ? '#b8b8c4' : '#55555f'); R(hx - 1, hy + 1, 2, 2, '#2a2a30');
        if (weapon === 'pistols') { R(hx - 3, hy + 1, 4, 2, '#2a2a30'); P(hx - 2, hy + 1, '#8a8a96'); }
        break;
      case 'burst':
        R(hx - 5, hy, 3, 2, '#2a2a38'); R(hx - 2, hy - 1, 8, 2, '#3a3a50'); R(hx - 1, hy - 1, 6, 1, '#6a6aa0');
        R(hx + 6, hy - 1, 2, 1, '#8a8aff'); R(hx + 2, hy + 1, 2, 2, '#2a2a38');
        break;
      case 'smg':
        R(hx - 3, hy, 2, 2, '#2a2a30'); R(hx - 1, hy - 1, 6, 2, '#2e2e36'); R(hx + 5, hy - 1, 5, 2, '#1a1a20');
        R(hx + 1, hy + 1, 1, 3, '#2a2a30'); P(hx, hy - 2, '#55555f');
        break;
      case 'disc':
        R(hx, hy - 3, 5, 5, '#d8dee8'); R(hx + 1, hy - 2, 3, 3, '#8a94a4'); P(hx + 2, hy - 1, '#2a2a30'); P(hx, hy - 3, '#ffffff');
        break;
      case 'katana':
        R(hx - 1, hy - 1, 1, 3, '#2a2a30'); P(hx, hy - 1, '#d8b84a');
        line(hx + 1, hy - 2, hx + 7, hy - 8, (x, y) => { P(x, y, '#e8eef4'); P(x + 1, y, '#9aa6b4'); });
        break;
      case 'rocket':
      case 'rpg': {
        const c1 = weapon === 'rocket' ? '#5d7240' : '#4a4a30', c2 = weapon === 'rocket' ? '#3c4a28' : '#2e2e1e';
        R(hx - 10, hy - 5, 18, 3, c1); R(hx - 10, hy - 5, 18, 1, shadeHex(c1, 1.25));
        R(hx + 7, hy - 6, 2, 5, c2); R(hx - 11, hy - 6, 2, 5, c2); R(hx - 1, hy - 2, 1, 2, '#23232a');
        if (weapon === 'rpg') { R(hx + 9, hy - 5, 2, 3, '#6a6a40'); P(hx + 11, hy - 4, '#6a6a40'); }
        else P(hx + 9, hy - 4, '#d23a2a');
        break;
      }
      case 'minigun':
      case 'hmg': {
        const b = weapon === 'hmg' ? 1 : 0;
        R(hx - 3, hy - 2, 7, 5 + b, '#34343c'); R(hx - 3, hy - 2, 7, 1, '#50505a');
        R(hx + 4, hy - 2, 7 + b, 1, '#9a9aa6'); R(hx + 4, hy, 7 + b, 1, '#9a9aa6'); R(hx + 4, hy + 2, 7 + b, 1, '#9a9aa6');
        R(hx + 4, hy - 1, 7 + b, 1, '#2a2a30'); R(hx + 4, hy + 1, 7 + b, 1, '#2a2a30');
        R(hx + 9 + b, hy - 2, 1, 5, '#5a5a64'); R(hx - 2, hy - 4, 4, 1, '#23232a');
        P(hx - 1, hy + 3 + b, '#e0c050'); P(hx - 2, hy + 4 + b, '#e0c050'); P(hx - 2, hy + 5 + b, '#b89830');
        break;
      }
      case 'sniper':
        R(hx - 6, hy, 4, 2, '#5a3b24'); R(hx - 2, hy - 1, 6, 2, '#2e3a2a'); R(hx + 4, hy - 1, 8, 1, '#1f2420');
        R(hx - 1, hy - 3, 5, 1, '#15151a'); P(hx + 4, hy - 3, '#5ab4ff'); P(hx, hy - 2, '#15151a'); P(hx + 2, hy - 2, '#15151a');
        P(hx + 11, hy - 2, '#1f2420');
        break;
      case 'tesla':
        R(hx - 2, hy - 2, 7, 4, '#c8cfda'); R(hx - 2, hy - 2, 7, 1, '#eef2f8'); R(hx - 2, hy + 1, 7, 1, '#8a94a4');
        R(hx, hy - 3, 1, 6, '#2fb8ff'); R(hx + 2, hy - 3, 1, 6, '#2fb8ff'); R(hx + 5, hy - 1, 2, 2, '#aef4ff'); P(hx + 6, hy - 1, '#ffffff');
        break;
      case 'grenade': {
        const gh = arms === 'brow' ? bH : fH;
        R(gh[0] + 1, gh[1] - 1, 2, 2, '#4a6a30'); P(gh[0] + 2, gh[1] - 2, '#c8c8d2');
        break;
      }
    }
  };
  if (arms === 'gun' || arms === 'katana' || arms === 'throw' || arms === 'cheer' || arms === 'brow' || arms === 'reload') drawWeapon();

  // ---- katana poses
  if (arms === 'slashUp') {
    line(fH[0], fH[1], fH[0] - 7, fH[1] - 4, (x, y) => { P(x, y, '#e8eef4'); P(x, y + 1, '#9aa6b4'); });
  } else if (arms === 'slashFwd') {
    R(fH[0] + 1, fH[1], 10, 1, '#e8eef4'); R(fH[0] + 1, fH[1] + 1, 9, 1, '#9aa6b4'); P(fH[0], fH[1], '#d8b84a');
  }

  // ---- front arm & hands
  armLine(fS, fH, armC);
  if (look.gear && (look.torso === 'uniform')) P(fS[0], fS[1] + 1, look.gear);
  if (arms === 'radio') { R(bH[0] - 1, bH[1] - 1, 2, 4, '#2a2a30'); P(bH[0] - 1, bH[1] - 1, '#6a6a74'); } // the radio handset
  R(bH[0], bH[1], 2, 2, skinD);
  R(fH[0], fH[1], 2, 2, skin);
  if (arms === 'throw' && weapon !== 'katana') { /* grenade in hand shows as dark dot */ P(fH[0] + 1, fH[1] - 1, '#2a2a30'); }
  if (arms === 'stab') { R(fH[0] + 2, fH[1], 3, 1, '#e8eef4'); P(fH[0] + 2, fH[1] + 1, '#8a94a4'); P(fH[0] + 5, fH[1], '#ffffff'); } // the knife
  // riot shield held in front: tall steel slab with a vision slit (a dead man lets go of it)
  if (weapon === 'shield' && arms !== 'up' && arms !== 'up2' && arms !== 'limp') {
    const sx = hx - 1 + (pose.shield || 0), sy = ht - 1, sh = footY - 1 - sy;
    R(sx, sy, 4, sh, '#4a5468'); R(sx, sy, 1, sh, '#7a86a0'); R(sx + 3, sy, 1, sh, '#2e3444');
    R(sx + 1, sy + 3, 2, 1, '#8fd0f0'); R(sx, sy + Math.round(sh * 0.55), 4, 1, '#c0302a');
  }
}

// frames: 0-3 run, 4 leap, 5 crouched to pounce, 6 sniffing the ground, 7 barking, 8 standing with the tail down (a wag)
function drawDog(ctx, frame) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const fur = '#2a2226', tan = '#8a5a34', dark = '#18141a';
  const bob = frame === 1 || frame === 3 || frame === 8 ? -1 : frame === 5 ? 2 : 0;
  const rear = frame === 5 ? -2 : 0; // crouched: the front goes down, the haunches stay up
  const hx = frame === 6 ? 1 : 0, hy = frame === 6 ? 4 : frame === 7 ? -1 : frame === 5 ? 1 : 0; // the head
  // legs: [backA, backB, frontA, frontB] x-offsets
  const legsets = [[-1, 1, 1, -1], [0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0], [-2, -2, 2, 2], [-1, 0, 1, 2], [0, 0, 0, 1], [0, 0, 1, 0], [0, 0, 0, 0]];
  const lg = legsets[frame] || legsets[0];
  const baseY = 13;
  const legXs = [6, 8, 15, 17];
  for (let i = 0; i < 4; i++) {
    const lx = legXs[i] + lg[i], top = 9 + bob + (i < 2 ? rear : 0);
    const c = i % 2 ? fur : dark;
    R(lx, top, 1, baseY - top, c);
    R(lx, baseY - (frame === 4 ? 1 : 0), 2, 1, c);
  }
  R(5, 5 + bob + rear, 6, 4, fur); R(11, 5 + bob, 7, 4, fur);
  R(6, 8 + bob + rear, 5, 1, tan); R(11, 8 + bob, 5, 1, tan);
  const ty = 5 + bob + rear;
  if (frame === 8) { R(4, ty + 1, 2, 1, fur); P(3, ty + 2, fur); P(2, ty + 3, fur); } // tail down
  else { R(4, ty, 2, 1, fur); P(3, ty - 1, fur); P(2, ty - 2, fur); }
  const X = hx, Y = bob + hy;
  R(16 + X, 3 + Y, 4, 4, fur);
  if (frame === 7) { R(20 + X, 4 + Y, 2, 1, fur); P(21 + X, 4 + Y, '#111'); R(19 + X, 6 + Y, 3, 1, tan); P(20 + X, 5 + Y, '#c0302a'); } // the jaws open
  else { R(20 + X, 5 + Y, 2, 2, fur); P(21 + X, 5 + Y, '#111'); R(19 + X, 6 + Y, 2, 1, tan); }
  P(17 + X, 1 + Y, fur); P(17 + X, 2 + Y, fur); P(18 + X, 2 + Y, dark);
  if (frame === 5) { P(16 + X, 1 + Y, fur); P(15 + X, 2 + Y, fur); } // ears laid back
  P(18 + X, 4 + Y, '#e8321e');
  R(15, 7 + bob, 3, 1, '#c0302a'); P(16, 8 + bob, '#c8c8d2');
}

function buildCharacter(look) {
  const L = humanLayout(look);
  // 'name~' = the pose with the hat knocked off (a death that sends it flying)
  const make = (poseName) => {
    const bare = poseName.endsWith('~'), base = bare ? poseName.slice(0, -1) : poseName;
    const c = makeCanvas(L.W, L.H, true);
    drawHuman(c.getContext('2d'), look, bare ? Object.assign({}, POSES[base], { noHat: true }) : POSES[base], L);
    const o = outlineCanvas(c);
    return makeFrame(o, L.cx, L.H);
  };
  const set = {
    L,
    idle: [make('idle'), make('idle2')],
    run: [make('run0'), make('run1'), make('run2'), make('run3')],
    jump: make('jump'), fall: make('fall'), slide: make('slide'),
    climb: [make('climb0'), make('climb1')],
    throw: make('throw'),
    slash: [make('slash0'), make('slash1')],
    wave: [make('wave0'), make('wave1')],
    cling: make('cling'),
  };
  // 1.32: every other pose (landing, aiming, recoil, a flinch, panic, a cheer...) is drawn the first
  // time something needs it - most characters never use most of them
  const cache = {};
  set.pose = (name) => cache[name] || (cache[name] = POSES[name.replace('~', '')] ? make(name) : set.idle[0]);
  set.hatPops = !!HAT_POPS[look.hat];
  set.hatMetal = !!HAT_METAL[look.hat];
  set.hat = () => (cache.$hat !== undefined ? cache.$hat : (cache.$hat = buildHat(look, L)));
  // portrait: crop around the head of the idle frame
  const src = set.idle[0].r;
  const hl = L.cx - Math.floor(L.headW / 2);
  const ht = L.H - L.legH - L.torsoH - L.headH;
  const pw = 14, ph = 13;
  const pc = makeCanvas(pw, ph);
  pc.getContext('2d').drawImage(src, hl - 4, ht - 4 - Math.min(2, look.tall || 0), pw, ph, 0, 0, pw, ph); // a tall hat shows too
  set.portrait = pc;
  set.silhouette = silhouette(src, '#0c0b10');
  return set;
}

// The hat on its own (1.32): the pixels above the eyes that a hatless head doesn't have. It flies off
// when its wearer goes down. ox/oy: its top-left corner from the feet, facing right
function buildHat(look, L) {
  if (!HAT_POPS[look.hat]) return null;
  const a = makeCanvas(L.W, L.H, true), b = makeCanvas(L.W, L.H, true);
  drawHuman(a.getContext('2d'), look, POSES.idle, L);
  drawHuman(b.getContext('2d'), look, Object.assign({}, POSES.idle, { noHat: true }), L);
  const A = a.getContext('2d').getImageData(0, 0, L.W, L.H).data, B = b.getContext('2d').getImageData(0, 0, L.W, L.H).data;
  const top = L.H - L.legH - L.torsoH - L.headH + 1; // the head's top row, and one more (a helmet's rim)
  const keep = new Uint8Array(L.W * L.H);
  let x0 = L.W, y0 = L.H, x1 = -1, y1 = -1;
  for (let y = 0; y <= top; y++) for (let x = 0; x < L.W; x++) {
    const i = (y * L.W + x) * 4;
    if (!A[i + 3] || (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2] && A[i + 3] === B[i + 3])) continue;
    keep[y * L.W + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 3, h = y1 - y0 + 3, c = makeCanvas(w, h, true), cx = c.getContext('2d'), img = cx.createImageData(w, h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!keep[y * L.W + x]) continue;
    const i = (y * L.W + x) * 4, j = ((y - y0 + 1) * w + (x - x0 + 1)) * 4;
    for (let k = 0; k < 4; k++) img.data[j + k] = A[i + k];
  }
  cx.putImageData(img, 0, 0);
  const o = outlineCanvas(c);
  return { r: o, l: flipCanvas(o), w, h, ox: x0 - 1 - L.cx, oy: y0 - 1 - L.H };
}

// A frame: r faces right; l (mirrored), wr / wl (the white hit flash) are made the first time they're
// drawn (1.32) - many frames never face left or flash, and building them all up front was half the cost
const FRAME_PROTO = {
  get l() { return this._l || (this._l = flipCanvas(this.r)); },
  get wr() { return this.hasFlash ? this._wr || (this._wr = silhouette(this.r, '#ffffff')) : undefined; },
  get wl() { return this.hasFlash ? this._wl || (this._wl = flipCanvas(this.wr)) : undefined; },
};
function makeFrame(canvas, ax, ay, withFlash = true) {
  const f = Object.create(FRAME_PROTO);
  f.r = canvas; f.ax = ax; f.ay = ay; f.w = canvas.width; f.h = canvas.height; f.hasFlash = withFlash;
  f._l = null; f._wr = null; f._wl = null;
  return f;
}

function drawFrame(ctx, f, footX, footY, face, flash) {
  const img = face >= 0 ? (flash ? f.wr : f.r) : (flash ? f.wl : f.l);
  const ax = face >= 0 ? f.ax : f.w - f.ax;
  ctx.drawImage(img, Math.round(footX - ax), Math.round(footY - f.ay));
}

// ---------------------------------------------------------------------------
//  Tiles
// ---------------------------------------------------------------------------
function paintTile(fn) {
  const c = makeCanvas(TILE, TILE);
  const x = c.getContext('2d');
  const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  fn(R, x);
  return c;
}

function buildTileSet(themeName) {
  const th = THEMES[themeName];
  const rng = new RNG(themeName.length * 7919 + 31);
  const fg = {}, bg = {};
  const [dB, dD, dL, dK] = th.dirt;

  fg[T.DIRT] = [0, 1, 2, 3].map(() => paintTile((R) => {
    R(0, 0, 16, 16, dB);
    for (let i = 0; i < 3; i++) { const y = rng.int(2, 13); for (let k = 0; k < 16; k++) if (rng.chance(0.4)) R(k, y, 1, 1, dD); }
    for (let i = 0; i < 24; i++) R(rng.int(0, 15), rng.int(0, 15), 1, 1, rng.chance(0.55) ? dD : dL);
    for (let i = 0; i < 2; i++) {
      const px = rng.int(1, 12), py = rng.int(2, 12);
      R(px, py, 3, 2, th.rock[0]); R(px, py, 2, 1, th.rock[2]); R(px, py + 2, 3, 1, dK);
    }
  }));
  fg[T.ROCK] = [0, 1, 2].map(() => paintTile((R) => {
    const [b, d, l] = th.rock;
    R(0, 0, 16, 16, b);
    for (let i = 0; i < 46; i++) R(rng.int(0, 15), rng.int(0, 15), rng.int(1, 2), 1, rng.chance(0.55) ? d : shadeHex(b, 1.1));
    for (let k = 0; k < 2; k++) {
      let x = rng.int(0, 15), y = rng.int(0, 6);
      for (let s = 0; s < rng.int(5, 9); s++) { R(x, y, 1, 1, shadeHex(d, 0.72)); R(x + 1, y, 1, 1, shadeHex(b, 1.15)); x = clamp(x + rng.int(-1, 1), 0, 14); y++; }
    }
    for (let i = 0; i < 4; i++) { const px = rng.int(1, 13), py = rng.int(1, 14); R(px, py, 2, 1, l); R(px, py + 1, 2, 1, shadeHex(d, 0.8)); }
  }));
  fg[T.BEDROCK] = [0, 1].map((v) => paintTile((R) => {
    R(0, 0, 16, 16, '#24232b');
    for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
      const ox = bx * 8 + (by && v ? 4 : 0) % 16, oy = by * 8;
      R(ox, oy, 8, 8, '#2e2d37'); R(ox, oy, 8, 1, '#45444f'); R(ox, oy, 1, 8, '#3c3b46');
      R(ox, oy + 7, 8, 1, '#17161c'); R(ox + 7, oy, 1, 8, '#17161c');
    }
  }));
  const [wB, wD, wL] = th.wood;
  fg[T.WOOD] = [0, 1].map((v) => paintTile((R) => {
    for (let p = 0; p < 4; p++) {
      const x0 = p * 4;
      R(x0, 0, 4, 16, (p + v) % 2 ? wB : wL);
      R(x0 + 3, 0, 1, 16, wD);
      for (let k = 0; k < 3; k++) R(x0 + rng.int(0, 2), rng.int(0, 15), 1, rng.int(2, 4), wD);
      R(x0 + 1, 2, 1, 1, '#2a2420'); R(x0 + 1, 13, 1, 1, '#2a2420');
    }
    R(0, 0, 16, 1, wL);
  }));
  fg[T.BRICK] = [0, 1].map(() => paintTile((R) => {
    R(0, 0, 16, 16, '#5a5a60');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let b = -1; b < 2; b++) {
        const bx = b * 8 + off, by = row * 4;
        const c = rng.chance(0.3) ? '#8e8e94' : '#9a9aa0';
        R(bx, by, 7, 3, c); R(bx, by, 7, 1, '#b4b4ba'); R(bx, by + 2, 7, 1, '#7a7a80');
      }
    }
    for (let i = 0; i < 6; i++) R(rng.int(0, 15), rng.int(0, 15), 1, 1, '#6a6a70');
  }));
  fg[T.STEEL] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 16, '#4c5a6a'); R(1, 1, 14, 14, '#5f6f80'); R(1, 1, 14, 1, '#7d8fa2'); R(1, 1, 1, 14, '#728599');
    R(1, 14, 14, 1, '#3e4a58'); R(14, 1, 1, 14, '#3e4a58');
    for (const [a, b] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { R(a, b, 1, 1, '#b8c6d4'); R(a + 1, b + 1, 1, 1, '#34404c'); }
    for (let i = 0; i < 5; i++) R(5 + i, 9 - i, 1, 1, '#8fa2b6');
  }));
  fg[T.SANDBAG] = [0].map(() => paintTile((R) => {
    const bag = (bx, by) => {
      R(bx + 1, by, 6, 7, '#b8a070'); R(bx, by + 1, 8, 5, '#b8a070'); R(bx + 1, by, 6, 1, '#d4bd8a');
      R(bx + 1, by + 6, 6, 1, '#8a7550'); R(bx + 7, by + 1, 1, 5, '#8a7550'); R(bx + 3, by + 3, 2, 1, '#9c8660');
    };
    bag(0, 1); bag(8, 1); bag(-4, 8); bag(4, 8); bag(12, 8);
  }));
  fg[T.LADDER] = [0].map(() => paintTile((R) => {
    R(2, 0, 2, 16, wD); R(12, 0, 2, 16, wD); R(2, 0, 1, 16, wB); R(12, 0, 1, 16, wB);
    for (const r of [1, 5, 9, 13]) { R(4, r, 8, 2, wL); R(4, r + 1, 8, 1, wD); }
  }));
  fg[T.PLATFORM] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 4, wB); R(0, 0, 16, 1, wL); R(0, 3, 16, 1, wD);
    R(5, 1, 1, 1, wD); R(11, 2, 1, 1, wD); R(1, 1, 1, 1, '#2a2420'); R(14, 1, 1, 1, '#2a2420');
    R(1, 4, 2, 2, wD); R(13, 4, 2, 2, wD);
  }));
  fg[T.CRATE] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 16, '#3f4a28'); R(1, 1, 14, 14, '#5b6b3a'); R(1, 1, 14, 1, '#7a8a50');
    R(2, 2, 12, 1, '#3f4a28'); R(2, 13, 12, 1, '#3f4a28');
    R(5, 4, 6, 8, '#e8c547'); R(6, 3, 4, 1, '#e8c547'); R(7, 2, 2, 1, '#e8c547'); R(5, 10, 6, 2, '#b8952a');
    R(6, 5, 1, 4, '#fff0a0');
  }));
  fg[T.ROOF] = [0].map(() => paintTile((R) => {
    for (let x = 0; x < 16; x++) {
      const k = x % 4;
      R(x, 0, 1, 16, k === 0 ? '#9a8a7a' : k === 1 ? '#7e6e60' : k === 2 ? '#5e5046' : '#7e6e60');
    }
    R(0, 0, 16, 1, '#b8a898'); R(0, 15, 16, 1, '#3e342c');
    for (let i = 0; i < 5; i++) R(rng.int(0, 15), rng.int(1, 14), 1, rng.int(1, 3), '#8a4a2a');
  }));
  const [sB, sD, sL, sM] = th.stone;
  fg[T.STONE] = [0, 1].map((v) => paintTile((R) => {
    R(0, 0, 16, 16, sD);
    const blocks = v ? [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]] : [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 16, 8]];
    for (const [a, b, w, h] of blocks) { R(a, b, w - 1, h - 1, sB); R(a, b, w - 1, 1, sL); R(a, b, 1, h - 1, sL); }
    for (let i = 0; i < 4; i++) R(rng.int(0, 14), rng.int(0, 2) + (rng.chance(0.5) ? 8 : 0), rng.int(1, 3), 1, sM);
  }));

  // background tiles
  bg[BG.DIRT] = [0, 1].map(() => paintTile((R) => {
    R(0, 0, 16, 16, th.bgDirt);
    for (let i = 0; i < 16; i++) R(rng.int(0, 15), rng.int(0, 15), 1, 1, shadeHex(th.bgDirt, rng.chance(0.5) ? 0.75 : 1.25));
  }));
  bg[BG.WOOD] = [0].map(() => paintTile((R) => {
    for (let p = 0; p < 4; p++) { R(p * 4, 0, 4, 16, p % 2 ? shadeHex(wB, 0.42) : shadeHex(wB, 0.5)); R(p * 4 + 3, 0, 1, 16, shadeHex(wD, 0.35)); }
  }));
  bg[BG.BRICK] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 16, '#2c2c30');
    for (let row = 0; row < 4; row++) { const off = row % 2 ? 4 : 0; for (let b = -1; b < 2; b++) R(b * 8 + off, row * 4, 7, 3, '#3c3c42'); }
  }));
  bg[BG.STONE] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 16, shadeHex(sD, 0.45));
    R(0, 0, 7, 7, shadeHex(sB, 0.45)); R(8, 0, 7, 7, shadeHex(sB, 0.42)); R(0, 8, 15, 7, shadeHex(sB, 0.45));
  }));
  bg[BG.STEEL] = [0].map(() => paintTile((R) => {
    R(0, 0, 16, 16, '#262d36'); R(1, 1, 14, 14, '#2e3742'); R(2, 2, 1, 1, '#46525e'); R(13, 13, 1, 1, '#46525e');
  }));

  // grass / sand / snow caps
  const [cM, cL, cD] = th.top;
  const cap = [0, 1, 2, 3].map(() => paintTile((R) => {
    for (let i = 0; i < 16; i++) {
      const d = rng.int(3, 4) + (rng.chance(0.3) ? 1 : 0) + (themeName === 'arctic' ? 1 : 0);
      R(i, 0, 1, d, cM); R(i, d, 1, 1, cD);
      if (rng.chance(0.55)) R(i, 0, 1, 1, cL);
      if (themeName === 'jungle' && rng.chance(0.18)) R(i, d + 1, 1, 1, cD);
    }
  }));

  // damage cracks
  const crack = [1, 2].map((lvl) => paintTile((R) => {
    for (let k = 0; k < lvl * 2; k++) {
      let x = rng.int(3, 12), y = rng.int(3, 12);
      for (let s = 0; s < 4 + lvl * 3; s++) {
        R(x, y, 1, 1, 'rgba(10,6,4,0.75)');
        x += rng.int(-1, 1); y += rng.int(-1, 1);
        x = clamp(x, 0, 15); y = clamp(y, 0, 15);
      }
    }
  }));
  const scorch = paintTile((R) => {
    for (let i = 0; i < 70; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(0, 8); R(8 + Math.cos(a) * r | 0, 8 + Math.sin(a) * r | 0, 2, 2, 'rgba(0,0,0,0.35)'); }
  });
  return { fg, bg, cap, crack, scorch, theme: th };
}

// ---------------------------------------------------------------------------
//  Props, projectiles, decor, vehicles
// ---------------------------------------------------------------------------
function paintSprite(w, h, fn, outline = true) {
  const c = makeCanvas(w, h, outline);
  const x = c.getContext('2d');
  const R = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(a, b, ww, hh); };
  fn(R, x);
  return outline ? outlineCanvas(c) : c;
}

function buildProps() {
  const P = {};
  P.barrel = makeFrame(paintSprite(12, 16, (R) => {
    R(1, 2, 10, 13, '#b8302a'); R(3, 2, 1, 13, '#e04a3a'); R(8, 2, 2, 13, '#7e1e1a');
    R(1, 2, 10, 1, '#6e1a16'); R(1, 14, 10, 1, '#6e1a16'); R(2, 0, 8, 2, '#8a8a96'); R(2, 0, 8, 1, '#b8b8c4');
    R(1, 7, 10, 3, '#f2c12e'); for (let i = 0; i < 10; i += 3) R(1 + i, 7, 1, 3, '#2a2a30');
  }), 6, 16);
  P.propane = makeFrame(paintSprite(10, 16, (R) => {
    R(1, 3, 8, 12, '#e8e8ec'); R(2, 3, 1, 12, '#ffffff'); R(7, 3, 1, 12, '#b0b0b8'); R(3, 1, 4, 2, '#8a8a96'); R(4, 0, 2, 1, '#555');
    R(1, 8, 8, 2, '#d23a2a');
  }), 5, 16);
  P.ammo = makeFrame(paintSprite(14, 11, (R) => {
    R(1, 1, 12, 9, '#5b6b3a'); R(1, 1, 12, 1, '#7a8a50'); R(1, 5, 12, 2, '#e8c547'); R(4, 3, 1, 6, '#3f4a28'); R(9, 3, 1, 6, '#3f4a28');
  }), 7, 11);
  P.bonus = makeFrame(paintSprite(14, 11, (R) => {
    R(1, 1, 12, 9, '#c8961e'); R(1, 1, 12, 1, '#ffe07a'); R(1, 9, 12, 1, '#8a6414'); R(1, 1, 1, 9, '#e8b83a');
    R(6, 3, 2, 5, '#fff6c0'); R(4, 5, 6, 1, '#fff6c0'); R(5, 4, 4, 3, '#fff6c0');
  }), 7, 11);
  P.grenade = makeFrame(paintSprite(6, 7, (R) => { R(1, 2, 4, 4, '#4a6a30'); R(1, 2, 2, 1, '#6a8a44'); R(2, 1, 2, 1, '#8a8a96'); R(4, 0, 1, 2, '#c8c8d2'); }), 3, 6, false);
  P.egrenade = makeFrame(paintSprite(6, 7, (R) => { R(1, 2, 4, 4, '#3a3a40'); R(1, 2, 2, 1, '#5a5a64'); R(2, 1, 2, 1, '#8a8a96'); R(3, 3, 1, 1, '#e8321e'); }), 3, 6, false);
  P.dynamite = makeFrame(paintSprite(5, 10, (R) => { R(1, 3, 3, 6, '#d23a2a'); R(1, 3, 1, 6, '#f06a4a'); R(1, 5, 3, 1, '#e8c547'); R(2, 1, 1, 2, '#c8c0a0'); }), 2, 9, false);
  P.firebomb = makeFrame(paintSprite(5, 9, (R) => { R(1, 3, 3, 5, '#3a7a4a'); R(2, 1, 1, 2, '#3a7a4a'); R(2, 0, 1, 1, '#f2e8d0'); R(1, 4, 1, 3, '#6aba7a'); }), 2, 8, false);
  P.flare = makeFrame(paintSprite(4, 7, (R) => { R(1, 1, 2, 5, '#d23a2a'); R(1, 0, 2, 1, '#ffd24a'); }), 2, 6, false);
  P.rocket = makeFrame(paintSprite(11, 5, (R) => { R(1, 1, 7, 3, '#5d7240'); R(8, 1, 2, 3, '#d23a2a'); R(10, 2, 1, 1, '#d23a2a'); R(0, 0, 2, 5, '#3c4a28'); R(2, 1, 6, 1, '#7d9058'); }), 5, 3, false);
  P.erocket = makeFrame(paintSprite(11, 5, (R) => { R(1, 1, 7, 3, '#4a4a30'); R(8, 1, 2, 3, '#6a6a40'); R(10, 2, 1, 1, '#6a6a40'); R(0, 0, 2, 5, '#2e2e1e'); }), 5, 3, false);
  P.shell = makeFrame(paintSprite(8, 5, (R) => { R(1, 1, 5, 3, '#3a3a40'); R(6, 1, 1, 3, '#8a8a96'); R(1, 1, 5, 1, '#5a5a64'); }), 4, 3, false);
  P.minimissile = makeFrame(paintSprite(4, 9, (R) => { R(1, 1, 2, 6, '#c8cfda'); R(1, 7, 2, 1, '#d23a2a'); R(0, 1, 4, 1, '#6e6e7a'); }), 2, 5, false);
  P.missile = makeFrame(paintSprite(5, 12, (R) => { R(1, 2, 3, 8, '#8a8a96'); R(1, 10, 3, 1, '#d23a2a'); R(2, 11, 1, 1, '#d23a2a'); R(0, 1, 5, 2, '#55555f'); R(1, 2, 1, 8, '#b8b8c4'); }), 2, 6, false);

  // cage frames with prisoner inside
  // the cage is bars only: the prisoner inside is drawn by Cage.draw (1.32: he has moods)
  const prisoner = buildCharacter(LOOKS.prisoner);
  P.prisoner = prisoner;
  // (no outline pass: it would fill the gaps between the bars - Cage.draw puts the dark inside behind him)
  P.cageBars = makeFrame(paintSprite(20, 28, (R) => {
    R(1, 1, 18, 3, '#4a4a55'); R(1, 1, 18, 1, '#6e6e7a'); R(1, 25, 18, 3, '#4a4a55'); R(1, 25, 18, 1, '#6e6e7a');
    for (const bx of [1, 5, 9, 13, 17]) { R(bx, 4, 2, 21, '#5a5a66'); R(bx, 4, 1, 21, '#8a8a96'); }
    R(9, 13, 3, 3, '#d8b84a'); R(10, 14, 1, 1, '#6a5a2a');
  }, false), 10, 28, false);

  // flags
  const flag = (enemy, f) => paintSprite(16, 11, (R) => {
    for (let col = 0; col < 14; col++) {
      const off = Math.round(Math.sin((col / 14) * Math.PI * 2 + f * Math.PI) * 1);
      R(1 + col, 1 + off, 1, 8, enemy ? (col % 7 < 1 ? '#7a1a16' : '#b8302a') : (col < 5 ? '#2e5aa8' : '#2c8a3a'));
      if (!enemy && col >= 5) R(1 + col, 1 + off + (col % 2 ? 0 : 7), 1, 1, '#236e2e');
    }
    if (enemy) { R(6, 3, 5, 4, '#1a1a1e'); R(7, 4, 1, 1, '#b8302a'); R(9, 4, 1, 1, '#b8302a'); R(7, 7, 3, 1, '#1a1a1e'); }
    else { R(2, 3, 1, 1, '#fff'); R(3, 2, 1, 3, '#fff'); R(2, 3, 3, 1, '#fff'); R(4, 3, 1, 1, '#fff'); }
  });
  P.flagEnemy = [flag(true, 0), flag(true, 1)];
  P.flagHero = [flag(false, 0), flag(false, 1)];

  // friendly helicopter
  P.heli = [0, 1, 2].map((f) => {
    const c = makeCanvas(72, 30, true);
    const x = c.getContext('2d');
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const body = '#5a6e3a', bodyL = '#76905a', bodyD = '#3e4e28';
    R(4, 12, 24, 4, body); R(4, 12, 24, 1, bodyL); R(2, 6, 4, 8, body); R(2, 6, 2, 8, bodyD);
    R(22, 8, 34, 14, body); R(24, 7, 28, 1, bodyL); R(22, 8, 34, 2, bodyL); R(22, 20, 34, 2, bodyD);
    R(52, 9, 8, 9, body); R(56, 11, 6, 7, body); R(62, 14, 2, 3, bodyD);
    R(52, 10, 7, 6, '#8fd0ea'); R(53, 10, 3, 2, '#d8f4ff'); R(52, 15, 7, 1, '#5a9ab8');
    R(30, 11, 10, 9, '#23281a'); R(30, 11, 10, 1, '#15180f');
    R(26, 14, 2, 1, '#fff'); R(25, 13, 1, 3, '#fff'); R(27, 13, 1, 3, '#fff');
    R(26, 23, 2, 4, '#2a2a30'); R(46, 23, 2, 4, '#2a2a30'); R(22, 27, 32, 2, '#2a2a30'); R(20, 26, 3, 1, '#2a2a30');
    R(37, 4, 3, 4, '#2a2a30');
    const rl = [58, 36, 16][f];
    R(38 - rl / 2, 3, rl, 1, '#1e1e24'); if (f === 2) R(38 - 22, 3, 6, 1, '#1e1e24');
    const tr = [[0, 4, 1, 9], [0, 8, 6, 1], [2, 5, 3, 7]][f];
    R(tr[0] + 1, tr[1], tr[2], tr[3], '#1e1e24');
    return makeFrame(outlineCanvas(c), 36, 30, false);
  });

  // pickups/ui icons
  P.iconGrenade = paintSprite(6, 7, (R) => { R(1, 2, 4, 4, '#6a9a40'); R(1, 2, 2, 1, '#9aca60'); R(2, 1, 2, 1, '#c8c8d2'); R(4, 0, 1, 2, '#e8e8f0'); });
  P.specialIcon = {
    havoc: P.iconGrenade,
    buck: paintSprite(6, 8, (R) => { R(1, 2, 3, 5, '#d23a2a'); R(1, 2, 1, 5, '#f06a4a'); R(1, 4, 3, 1, '#e8c547'); R(2, 0, 1, 2, '#e8e0c0'); }),
    scorch: paintSprite(6, 8, (R) => { R(1, 3, 4, 4, '#3a8a4a'); R(2, 1, 2, 2, '#3a8a4a'); R(2, 0, 2, 1, '#ffae3a'); R(1, 4, 1, 2, '#7aca8a'); }),
    ronin: paintSprite(8, 8, (R) => { for (let i = 0; i < 6; i++) R(1 + i, 6 - i, 1, 1, '#dff8ff'); R(0, 3, 3, 1, '#5a6aff'); R(1, 5, 3, 1, '#5a6aff'); }),
    boomer: paintSprite(5, 8, (R) => { R(1, 2, 3, 5, '#d23a2a'); R(1, 0, 3, 2, '#ffd23a'); }),
    brutus: paintSprite(8, 8, (R) => { R(3, 0, 2, 8, '#ffae3a'); R(0, 3, 8, 2, '#ffae3a'); R(1, 1, 6, 6, '#ffd23a'); R(3, 3, 2, 2, '#ffffff'); }),
    deadeye: paintSprite(8, 6, (R) => { R(0, 2, 8, 2, '#8fe4ff'); R(0, 2, 8, 1, '#ffffff'); R(6, 1, 2, 4, '#2fb8ff'); }),
    volt: paintSprite(6, 8, (R) => { R(3, 0, 2, 3, '#ffd23a'); R(1, 3, 4, 1, '#ffd23a'); R(1, 4, 2, 2, '#ffd23a'); R(0, 6, 2, 2, '#fff4a0'); }),
    chrono: paintSprite(7, 7, (R) => { R(1, 1, 5, 5, '#8a8aff'); R(2, 2, 3, 3, '#e8ecff'); R(3, 2, 1, 2, '#2a2a38'); R(3, 3, 2, 1, '#2a2a38'); }),
    skyhawk: paintSprite(4, 8, (R) => { R(1, 1, 2, 5, '#c8cfda'); R(1, 0, 2, 1, '#d23a2a'); R(0, 5, 4, 1, '#8a8a96'); R(1, 6, 2, 2, '#ffae3a'); }),
    ricochet: paintSprite(7, 7, (R) => { R(1, 2, 5, 3, '#d8dee8'); R(2, 1, 3, 5, '#d8dee8'); R(3, 3, 1, 1, '#2a2a30'); R(0, 3, 1, 1, '#ffffff'); R(6, 3, 1, 1, '#ffffff'); R(3, 0, 1, 1, '#ffffff'); R(3, 6, 1, 1, '#ffffff'); }),
    phantom: paintSprite(6, 8, (R) => { R(1, 1, 4, 6, '#4a4a5a'); R(2, 2, 2, 1, '#7cff7c'); R(1, 7, 1, 1, '#4a4a5a'); R(4, 7, 1, 1, '#4a4a5a'); }),
  };
  P.pocketIcon = {
    airstrike: P.specialIcon.boomer,
    timewarp: P.specialIcon.chrono,
    swarm: P.specialIcon.skyhawk,
    roid: paintSprite(8, 6, (R) => { R(1, 1, 6, 4, '#e8e8ec'); R(1, 1, 3, 4, '#e8321e'); R(1, 1, 6, 1, '#ffffff'); }),
  };
  // hit points: full / lost / flashing heart
  const heart = (c, hi) => paintSprite(9, 8, (R) => { R(1, 1, 3, 2, c); R(5, 1, 3, 2, c); R(1, 2, 7, 3, c); R(2, 5, 5, 1, c); R(3, 6, 3, 1, c); if (hi) R(2, 2, 1, 1, hi); });
  P.iconHeart = heart('#e8321e', '#ff9a8a');
  P.iconHeartOff = heart('#3a3848');
  P.iconHeartLit = heart('#ffffff');
  // lives (heroes left to drop in): a soldier's head in a helmet
  P.iconLife = paintSprite(9, 8, (R) => {
    R(2, 1, 5, 1, '#5d7a3a'); R(1, 2, 7, 2, '#5d7a3a'); R(2, 2, 2, 1, '#8fb060'); R(1, 4, 7, 1, '#3c5226');
    R(2, 5, 5, 2, '#e8b48a'); R(3, 5, 1, 1, '#1a1410'); R(5, 5, 1, 1, '#1a1410');
  });
  P.iconStar = paintSprite(11, 11, (R) => {
    R(5, 1, 1, 2, '#ffd23a'); R(4, 3, 3, 1, '#ffd23a'); R(1, 4, 9, 2, '#ffd23a'); R(2, 6, 7, 1, '#ffd23a'); R(3, 7, 5, 1, '#ffd23a');
    R(2, 8, 3, 1, '#ffd23a'); R(6, 8, 3, 1, '#ffd23a'); R(2, 9, 1, 1, '#ffd23a'); R(8, 9, 1, 1, '#ffd23a'); R(4, 4, 1, 1, '#fff6c0');
  });
  P.iconStarOff = silhouette(P.iconStar, '#3a3848');
  P.iconLock = paintSprite(9, 11, (R) => { R(2, 1, 5, 1, '#9a9aa6'); R(1, 2, 1, 3, '#9a9aa6'); R(7, 2, 1, 3, '#9a9aa6'); R(1, 5, 7, 5, '#e8c547'); R(4, 7, 1, 2, '#6a5a2a'); });
  P.iconSkull = paintSprite(9, 9, (R) => { R(1, 1, 7, 5, '#e8e8e0'); R(2, 6, 5, 2, '#e8e8e0'); R(2, 3, 2, 2, '#1a1a1e'); R(5, 3, 2, 2, '#1a1a1e'); R(3, 7, 1, 1, '#1a1a1e'); R(5, 7, 1, 1, '#1a1a1e'); });
  P.iconPause = paintSprite(14, 14, (R) => { R(1, 1, 12, 12, 'rgba(20,18,28,0.7)'); R(4, 3, 2, 8, '#fff'); R(8, 3, 2, 8, '#fff'); }, false);
  return P;
}

// Background decorations per theme (non-colliding sprites that stand on terrain)
function buildDecor() {
  const D = {};
  D.palm = [0, 1].map((v) => paintSprite(34, 56, (R, x) => {
    let tx = 16, w = 3;
    for (let y = 55; y > 14; y--) {
      const bend = Math.round(Math.sin((55 - y) / 40 * 1.3) * (v ? 5 : -4));
      R(tx + bend, y, w, 1, (y % 4 === 0) ? '#5a4028' : '#7a5838');
      R(tx + bend, y, 1, 1, '#4a3420');
    }
    const top = Math.round(Math.sin(41 / 40 * 1.3) * (v ? 5 : -4)) + tx + 1;
    const frond = (dx, dy, len, droop) => {
      for (let i = 0; i < len; i++) {
        const fx = top + Math.round(dx * i), fy = 14 + Math.round(dy * i + droop * i * i / (len * len));
        R(fx, fy, 2, 2, i % 3 === 0 ? '#3f8a2c' : '#2f6a1c'); R(fx, fy - 1, 1, 1, '#5cae3a');
      }
    };
    frond(1, -0.3, 15, 6); frond(-1, -0.3, 15, 6); frond(0.8, -0.8, 10, 5); frond(-0.8, -0.8, 10, 5); frond(0.2, -1, 7, 2); frond(1, 0.3, 11, 4); frond(-1, 0.3, 11, 4);
    R(top - 1, 14, 4, 3, '#6a4a2a'); R(top, 15, 2, 2, '#8a6a3a');
  }));
  D.bush = [0, 1].map(() => paintSprite(24, 12, (R) => {
    const blobs = [[3, 5, 7], [9, 3, 8], [15, 5, 6], [7, 6, 9]];
    for (const [bx, by, s] of blobs) { R(bx, by, s, 12 - by, '#2f6a1c'); R(bx + 1, by, s - 2, 2, '#4f9a2c'); R(bx + 2, by, 2, 1, '#7cc23b'); }
  }));
  D.fern = [paintSprite(16, 12, (R) => {
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; for (let k = 0; k < 8; k++) R(8 + Math.round(Math.sin(a) * k), 11 - Math.round(Math.cos(a) * k * 1.2), 1, 1, k > 5 ? '#5cae3a' : '#2f6a1c'); }
  })];
  D.cactus = [0, 1].map((v) => paintSprite(16, 30, (R) => {
    R(6, 4, 4, 26, '#4f8a3a'); R(7, 4, 1, 26, '#6aaa4a'); R(9, 4, 1, 26, '#3a6a2a'); R(6, 3, 4, 1, '#4f8a3a');
    R(2, 12 + v * 3, 4, 3, '#4f8a3a'); R(2, 6 + v * 3, 3, 7, '#4f8a3a'); R(3, 6 + v * 3, 1, 7, '#6aaa4a');
    R(10, 16 - v * 2, 4, 3, '#4f8a3a'); R(11, 9 - v * 2, 3, 8, '#4f8a3a'); R(12, 9 - v * 2, 1, 8, '#6aaa4a');
    for (let i = 0; i < 6; i++) R(5 + (i % 2) * 5, 6 + i * 4, 1, 1, '#d8e0a0');
  }));
  D.deadbush = [paintSprite(18, 12, (R) => {
    const br = [[9, 11, -1, -1, 6], [9, 11, 1, -1, 6], [9, 11, 0, -1, 8], [9, 11, -1, -0.5, 7], [9, 11, 1, -0.5, 7]];
    for (const [x0, y0, dx, dy, n] of br) for (let i = 0; i < n; i++) R(x0 + Math.round(dx * i), y0 + Math.round(dy * i), 1, 1, '#7a5a3a');
  })];
  D.bones = [paintSprite(16, 7, (R) => { R(2, 3, 10, 2, '#e8e0d0'); R(1, 2, 2, 4, '#e8e0d0'); R(11, 2, 2, 4, '#e8e0d0'); R(12, 4, 3, 3, '#e8e0d0'); R(13, 5, 1, 1, '#2a2a30'); })];
  D.pine = [0, 1].map((v) => paintSprite(26, 46 + v * 6, (R) => {
    const h = 46 + v * 6;
    R(12, h - 8, 3, 8, '#5a3e28');
    for (let layer = 0; layer < 5; layer++) {
      const y0 = 4 + layer * ((h - 12) / 5), wdt = 4 + layer * 4;
      for (let r = 0; r < 9; r++) {
        const ww = Math.round(wdt * (r / 8));
        R(13 - ww, y0 + r, ww * 2 + 1, 1, r % 3 === 0 ? '#2e5a46' : '#244a3a');
        if (r < 2) R(13 - ww, y0 + r, ww * 2 + 1, 1, '#eef4fb');
      }
    }
    R(12, 1, 3, 4, '#eef4fb');
  }));
  D.snowbush = [paintSprite(22, 10, (R) => { R(2, 4, 18, 6, '#244a3a'); R(4, 2, 14, 3, '#eef4fb'); R(2, 4, 18, 1, '#eef4fb'); R(6, 1, 6, 1, '#ffffff'); })];
  D.rockpile = [paintSprite(20, 10, (R) => { R(2, 4, 8, 6, '#7a8490'); R(8, 2, 9, 8, '#8c96a2'); R(9, 2, 7, 1, '#eef4fb'); R(2, 4, 8, 1, '#eef4fb'); R(12, 6, 3, 2, '#5c6570'); })];
  return D;
}

// Tileable parallax layers
function buildParallax(themeName) {
  const th = THEMES[themeName];
  const Wl = 512;
  const layer = (h, color, fn) => {
    const c = makeCanvas(Wl, h);
    const x = c.getContext('2d');
    x.fillStyle = color;
    fn(x, (px, top) => x.fillRect(px, top, 1, h - top));
    return c;
  };
  const wave = (px, k, seed) => Math.sin((px / Wl) * Math.PI * 2 * k + seed);
  const far = layer(170, th.far, (x, col) => {
    for (let px = 0; px < Wl; px++) {
      let t;
      if (themeName === 'desert') t = 95 + Math.round(wave(px, 2, 1) * 12 + (wave(px, 5, 2) > 0.55 ? -26 : 0) + wave(px, 9, 3) * 2);
      else if (themeName === 'arctic') t = 60 + Math.round(Math.abs(wave(px, 3, 1)) * -40 + wave(px, 7, 2) * 10 + 40);
      else t = 80 + Math.round(wave(px, 2, 0.4) * 22 + wave(px, 5, 1.7) * 9 + wave(px, 11, 2) * 3);
      col(px, t);
      if (themeName === 'arctic') { x.fillStyle = '#e8f0fa'; x.fillRect(px, t, 1, 6 + Math.round(wave(px, 13, 1) * 3)); x.fillStyle = th.far; }
    }
  });
  const mid = layer(150, th.mid, (x, col) => {
    for (let px = 0; px < Wl; px++) {
      let t;
      if (themeName === 'jungle') t = 60 + Math.round(-Math.abs(wave(px, 14, 0.5)) * 14 + wave(px, 3, 1) * 10);
      else if (themeName === 'desert') t = 80 + Math.round(wave(px, 3, 0.5) * 16 + wave(px, 7, 2) * 5);
      else t = 70 + Math.round(wave(px, 4, 1) * 10) - ((px % 23 < 12) ? Math.round((12 - Math.abs(px % 23 - 6) * 2)) : 0);
      col(px, t);
    }
  });
  const near = layer(120, th.near, (x, col) => {
    for (let px = 0; px < Wl; px++) {
      let t;
      if (themeName === 'jungle') t = 50 + Math.round(-Math.abs(wave(px, 20, 0.2)) * 18 + wave(px, 4, 2) * 6);
      else if (themeName === 'desert') t = 70 + Math.round(wave(px, 5, 1.2) * 10 + (wave(px, 2, 0.3) > 0.8 ? -20 : 0));
      else t = 60 + Math.round(-Math.max(0, 16 - Math.abs((px % 37) - 18) * 2) + wave(px, 6, 1) * 5);
      col(px, t);
    }
  });
  return { far, mid, near };
}

const Sprites = {
  chars: {}, tiles: {}, props: null, decor: null, parallax: {}, dog: null,
  // 1.32: a character's poses are drawn on first use; warm() draws the rest in the background, a
  // millisecond a frame, the current mission's cast first - so no soldier's first panic costs a frame
  warmQ: [],
  warmFor(ids) {
    const names = Object.keys(POSES), front = [];
    for (const id of new Set(ids)) if (this.chars[id]) for (const n of names) front.push(id + '|' + n);
    const lift = new Set(front);
    this.warmQ = this.warmQ.filter((k) => !lift.has(k)).concat(front.reverse());
  },
  warm(ms) {
    const q = this.warmQ;
    if (!q.length) return;
    const t0 = performance.now();
    do {
      const k = q.pop(), i = k.indexOf('|'), s = this.chars[k.slice(0, i)];
      if (s && s.pose) s.pose(k.slice(i + 1)).l; // eslint-disable-line no-unused-expressions
    } while (q.length && performance.now() - t0 < ms);
  },
  build() {
    for (const id in LOOKS) this.chars[id] = buildCharacter(LOOKS[id]);
    this.warmQ = []; this.warmFor(['grunt', 'havoc', 'buck', 'prisoner'].concat(Object.keys(LOOKS)));
    // dog frames
    const dogFrames = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((f) => {
      const c = makeCanvas(24, 14, true);
      drawDog(c.getContext('2d'), f);
      return makeFrame(outlineCanvas(c), 12, 14);
    });
    this.dog = { run: dogFrames.slice(0, 4), idle: [dogFrames[1], dogFrames[8]], jump: dogFrames[4], crouch: dogFrames[5], sniff: dogFrames[6], bark: dogFrames[7] };
    for (const t in THEMES) { this.tiles[t] = buildTileSet(t); this.parallax[t] = buildParallax(t); }
    this.props = buildProps();
    this.decor = buildDecor();
  },
};
