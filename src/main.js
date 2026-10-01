'use strict';
// ============================================================================
//  Boot + main loop (fixed 60 Hz simulation, render every animation frame,
//  interpolated between the last two steps)
// ============================================================================

(function () {
  let started = false;
  let lastErr = 0;

  async function start(hotData) {
    if (started) return;
    started = true;
    Gfx.init();
    Hud.init(); // the HUD's own layer over the game (src/hud.js)
    Input.init(Gfx.canvas);
    Gfx.resize(); // again, now that Input knows it's a touch device (portrait "rotate" screen)
    FX.init();
    // the portal SDK, the typeface and the sprites load side by side (1.34): the SDK's round trips
    // to its servers no longer hold everything else up
    const sdkReady = Platform.init();
    const fontReady = Promise.race([Font.load(), new Promise((r) => setTimeout(r, 2000))]); // the typeface (src/gfx.js)
    await new Promise((r) => setTimeout(r, 0)); // the requests go out before the sprites take the main thread
    Sprites.build();
    await sdkReady;
    Platform.loadingStart();
    await fontReady;
    Save.load();
    L10N.set(L10N.pick()); // the player's language (src/lang.js)
    applyFxSetting();
    Settings.apply();
    TunePanel.init();
    Playtest.init();
    Sound.sfxOn = Save.data.sfx !== false;
    Sound.musicOn = Save.data.music !== false;
    Input.setCoop(!!Save.data.coop);
    Wardrobe.applyAll(); // the outfits the heroes wear
    const bootEl = document.getElementById('boot');
    if (bootEl) bootEl.remove();
    Platform.loadingDone();

    const qs = new URLSearchParams(location.search);
    // ?debug=1 exposes internals for testing (web build / artifact only; portal builds ship without it)
    if (qs.get('debug') === '1' && TunePanel.enabled()) window.__bb = { App, Gfx, Input, Sound, Save, Platform, PlayScene, TitleScene, LEVELS, STEP, Playtest, TUNE };
    const direct = qs.get('level');
    const resumeLevel = hotData && typeof hotData.level === 'number' ? hotData.level : null;
    if (direct !== null && !isNaN(+direct)) App.go(PlayScene, clamp(+direct - 1, 0, LEVELS.length - 1));
    else if (resumeLevel !== null) App.go(PlayScene, clamp(resumeLevel, 0, LEVELS.length - 1));
    // the first launch skips the title: straight into mission 1, the logo over the drop (1.31)
    else if (isNewPlayer()) { PlayScene.firstRun = true; App.go(PlayScene, 0); }
    else App.go(TitleScene);

    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        window.claude.hot.snapshot(() => ({ level: App.scene === PlayScene ? PlayScene.level : null }));
      }
    } catch (e) { /* optional */ }

    let last = performance.now(), acc = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      FXAuto.sample(dt);
      // a frame that took about a whole number of half steps (a 60 or 120 Hz screen) counts as
      // exactly that: timer jitter can't make one frame run two steps and the next one none
      const q = STEP / 2, m = Math.round(dt / q);
      if (m >= 1 && m <= 4 && Math.abs(dt - m * q) < 0.0005) dt = m * q;
      try {
        if (!Platform.adActive) {
          acc += dt;
          let n = 0;
          while (acc >= STEP && n < 4) { Input.poll(); App.tick++; App.update(STEP); acc -= STEP; n++; }
          if (n === 4) acc = 0;
        }
        // the world is drawn between its last two steps (World.draw): smooth on 75-240 Hz screens
        App.alpha = Math.min(1, acc / STEP);
        App.draw(Gfx.ctx);
        App.alpha = 1; // whatever else draws (the test harness, videos) gets the latest step
        // the characters' poses, drawn in the background (1.32): only in a frame with time to spare
        // (a slow device doesn't pay for them mid-fight), and more while nobody plays (menus, pauses)
        const spent = performance.now() - now, playing = App.scene === PlayScene && !PlayScene.overlay && !App.pending;
        if (spent < 9 && !document.hidden) Sprites.warm(playing ? 1 : 4);
      } catch (e) {
        App.alpha = 1;
        if (now - lastErr > 1000) { lastErr = now; console.error(e); }
      }
    }
    requestAnimationFrame(frame);

    const autoPause = () => { if (App.scene === PlayScene && !PlayScene.overlay && PlayScene.world && !App.pending) PlayScene.pause('blur'); };
    document.addEventListener('visibilitychange', () => {
      Sound.setHidden(document.hidden);
      if (document.hidden) autoPause();
    });
    window.addEventListener('blur', autoPause);
    Gfx.canvas.focus();
  }

  const boot = () => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.ready) hot.ready(start);
    else start((hot && hot.data) || {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
