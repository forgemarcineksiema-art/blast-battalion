// Dev-only: renders portal key art (cover / portrait / square) with the game's own
// sprites and effects, and posts the PNGs to the dev server (/__shot). Load after the game booted:
//   const s = document.createElement('script'); s.src = '/tools/keyart.js'; document.head.appendChild(s);
//   await KEYART_ALL()      -> %TEMP%/blast_shots/cover_1920x1080.png etc. (copy them to marketing/)
/* eslint-disable no-undef */
window.KEYART = async function (name, W, H, scale, layout) {
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const saved = { W: Gfx.W, H: Gfx.H, q: FX.quality, calm: FX.calm };
  Gfx.W = W; Gfx.H = H; FX.quality = 2; FX.calm = false;
  FX.reset(null);
  // scenery first, while FX is still empty (Backdrop.draw also draws particles)
  Backdrop.t = 6.3; Backdrop.sky = null;
  Backdrop.draw(ctx, 0.12);
  Atmos.reset('jungle'); Atmos.t = 2; Atmos.lastCx = 0;
  Atmos.drawRays(ctx);

  // explosions frozen at their peak: an older one (fire column, embers, rolling smoke) with a fresh
  // one inside it. Stills skip the flash, blast rings and rays (they read as glass orbs on a poster)
  // and add pale smoke puffs, which carry the silhouette against the dusk sky
  const blast = (booms) => {
    FX.reset(null);
    for (const [x, y, r] of booms) {
      FX.explosion(x * W, y * H, r, { fire: true });
      for (let i = 0; i < 10 + r * 0.4; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(0.3, 1) * r * 1.6;
        FX.spawn(x * W + Math.cos(a) * r * 0.3, y * H + Math.sin(a) * r * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 20, rand(0.9, 1.6), rand(r * 0.14, r * 0.24), '#aaa', PF.CIRCLE | PF.DRAG | PF.GROW, 2);
      }
    }
    for (let i = 0; i < 9; i++) FX.update(1 / 60);
    for (const [x, y, r] of booms) FX.explosion(x * W, y * H, r * 0.6, { fire: true });
    for (let i = 0; i < 4; i++) FX.update(1 / 60);
    FX.effects.length = 0;
  };
  // glow first, so it lights the sky around the fire without washing out the fire itself
  const drawFx = () => { FX.drawLights(ctx, 0, 0, W, H); FX.draw(ctx, 0, 0, W, H); };
  // blasts behind the squad
  if (layout.back) { blast(layout.back); drawFx(); }
  blast(layout.booms);

  const big = (frame, x, y, face, s) => {
    const img = face > 0 ? frame.r : frame.l;
    const ax = face > 0 ? frame.ax : frame.w - frame.ax;
    ctx.drawImage(img, Math.round(x - ax * s), Math.round(y - frame.ay * s), frame.w * s, frame.h * s);
  };
  // chopper
  if (layout.heli) { const f = Sprites.props.heli[1]; big(f, layout.heli[0] * W, layout.heli[1] * H, 1, layout.heli[2]); }
  // enemies blown through the air
  for (const [id, x, y, s, rot] of layout.flyers) {
    const f = Sprites.chars[id].fall;
    ctx.save(); ctx.translate(Math.round(x * W), Math.round(y * H)); ctx.rotate(rot);
    ctx.drawImage(f.r, Math.round(-f.w * s / 2), Math.round(-f.h * s / 2), f.w * s, f.h * s); ctx.restore();
  }
  // heroes
  // lift = how far above the ground the feet are (a jump: 26 unless given)
  for (const [id, pose, x, s, face, fire = true, lift] of layout.heroes) {
    const set = Sprites.chars[id];
    const f = pose === 'run' ? set.run[0] : pose === 'jump' ? set.jump : pose === 'slash' ? set.slash[1] : set.idle[0];
    const feet = H - 20 - (lift != null ? lift : pose === 'jump' ? 26 : 0);
    big(f, x * W, feet, face, s);
    if (pose !== 'slash' && fire) {
      // muzzle flash with its glow, tracers flying outward
      const tipX = x * W + face * (set.L.W - set.L.cx - 5) * s, my = feet - (set.L.H - (set.L.H - set.L.legH - set.L.torsoH + 2)) * s + s;
      FX.light(tipX, my, 30, '#ffc060', 0.9, 1);
      ctx.drawImage(circleSprite('#fff4a0', 2 * s), Math.round(tipX - 2 * s), Math.round(my - 2 * s));
      ctx.drawImage(circleSprite('#ffffff', s), Math.round(tipX - s), Math.round(my - s));
      ctx.fillStyle = '#fff4a0';
      for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(tipX + face * (14 + k * 26) - (face < 0 ? 12 : 0)), Math.round(my + (k % 2 ? -3 : 2)), 12, 1);
    }
  }
  for (const [x, y, len] of layout.bullets || []) {
    ctx.fillStyle = '#fff4a0'; ctx.fillRect(Math.round(x * W), Math.round(y * H), len, 1);
  }
  // fire and smoke in front, and the light it all throws (muzzle flashes included)
  drawFx();
  Atmos.vignette(ctx);
  // logo (CrazyGames: nothing on a cover but the game's title) at letter size logoK.
  // Poki thumbnails carry no text at all: logo: false
  if (layout.logo !== false) {
    const ly = Math.round(layout.logoY * H);
    const bottom = ly + Logo.draw(ctx, W / 2, ly, layout.logoK || Logo.k(W, H)).H;
    if (layout.tagline) Font.drawOutlined(ctx, 'RESCUE  •  SWAP  •  DESTROY', W / 2, bottom + 8, '#ffd23a', 1, 'center');
  }

  Gfx.W = saved.W; Gfx.H = saved.H; FX.quality = saved.q; FX.calm = saved.calm;
  FX.reset(null);
  const out = makeCanvas(W * scale, H * scale);
  const ox = out.getContext('2d'); ox.imageSmoothingEnabled = false; ox.drawImage(c, 0, 0, out.width, out.height);
  const r = await fetch('/__shot?name=' + name, { method: 'POST', body: out.toDataURL('image/png') });
  return r.text();
};

window.KEYART_ALL = async function () {
  const res = [];
  res.push(await KEYART('cover_1920x1080', 480, 270, 4, {
    booms: [[0.07, 0.72, 40], [0.93, 0.66, 48]],
    back: [[0.5, 0.7, 28]],
    heli: [0.13, 0.2, 1],
    flyers: [['grunt', 0.93, 0.44, 2, 0.8], ['eflamer', 0.06, 0.46, 2, -0.9], ['officer', 0.8, 0.3, 2, 2.2]],
    heroes: [['buck', 'idle', 0.3, 3, -1], ['havoc', 'run', 0.43, 3, -1, false], ['ronin', 'slash', 0.57, 3, 1], ['brutus', 'idle', 0.7, 3, 1]],
    logoY: 0.08, logoK: 4, tagline: false,
  }));
  res.push(await KEYART('portrait_800x1200', 200, 300, 4, {
    booms: [[0.06, 0.72, 28], [0.94, 0.64, 32]],
    back: [[0.5, 0.58, 20]],
    heli: [0.5, 0.44, 1],
    flyers: [['grunt', 0.9, 0.46, 2, 0.8], ['eflamer', 0.12, 0.5, 2, -0.7]],
    heroes: [['havoc', 'run', 0.33, 3, -1], ['scorch', 'idle', 0.67, 3, 1]],
    logoY: 0.1, logoK: 3, tagline: false,
  }));
  res.push(await KEYART('square_800x800', 200, 200, 4, {
    booms: [[0.06, 0.7, 26], [0.94, 0.62, 30]],
    flyers: [['grunt', 0.9, 0.42, 2, 0.7]],
    heroes: [['havoc', 'run', 0.33, 3, -1], ['buck', 'idle', 0.67, 3, 1]],
    logoY: 0.08, logoK: 3, tagline: false,
  }));
  res.push(await KEYART_POKI());
  return res.join('\n');
};

// Poki's thumbnail: a full-bleed square with no text at all, one clear hero in his default look,
// in motion, big enough to read on a small tile (developers.poki.com/guide/thumbnail)
window.KEYART_POKI = async function () {
  const worn = Save.data.wardrobe && Save.data.wardrobe.wear;
  if (worn && Object.keys(worn).length) { Save.data.wardrobe.wear = {}; Wardrobe.applyAll(); }
  try {
    return await KEYART('poki_thumbnail_1080', 216, 216, 5, {
      back: [[0.8, 0.5, 44]],
      booms: [[0.06, 0.78, 22], [0.95, 0.8, 30]],
      flyers: [['grunt', 0.82, 0.22, 3, 0.35]],
      heroes: [['havoc', 'jump', 0.36, 6, 1, true, 34]],
      logo: false,
    });
  } finally {
    if (worn && Object.keys(worn).length) { Save.data.wardrobe.wear = worn; Wardrobe.applyAll(); }
  }
};
