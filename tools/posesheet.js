// Dev-only (never shipped): every character in every pose on one sheet, to check the pixel art (1.32).
// In the page (the dev server must be running):
//   const s = document.createElement('script'); s.src = '/tools/posesheet.js'; document.body.appendChild(s);
//   await POSESHEET.all()          -> %TEMP%/blast_shots/poses_heroes_1.png, ..._2, poses_enemies_1, _2, poses_extra
//   await POSESHEET.sheet('x', ['havoc', 'grunt'], ['idle', 'aim'], 4)
/* eslint-disable no-undef */
window.POSESHEET = {
  heroes: ['havoc', 'buck', 'scorch', 'ronin', 'chrono', 'boomer', 'skyhawk', 'brutus', 'ricochet', 'deadeye', 'phantom', 'volt'],
  enemies: ['grunt', 'bomber', 'grenadier', 'rpg', 'heavy', 'shield', 'shieldless', 'scout', 'mortar', 'esniper', 'eflamer', 'officer', 'colonel', 'general', 'prisoner'],
  poses() { return Object.keys(POSES); },
  async post(name, c) {
    const r = await fetch('/__shot?name=' + name, { method: 'POST', body: c.toDataURL('image/png') });
    return r.text();
  },
  // ids x poses; each cell shows the pose facing right, its name on top, the look's id on the left
  async sheet(name, ids, poses, S = 2) {
    const cw = 40, ch = 36, lw = 58, top = 10;
    const c = document.createElement('canvas');
    c.width = (lw + poses.length * cw) * S; c.height = (top + ids.length * ch) * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.scale(S, S);
    x.fillStyle = '#5a6a7a'; x.fillRect(0, 0, c.width, c.height);
    poses.forEach((p, j) => {
      x.fillStyle = j % 2 ? '#667688' : '#5f6f81'; x.fillRect(lw + j * cw, 0, cw, top + ids.length * ch);
      Font.draw(x, p.replace('~', '*').toUpperCase().slice(0, 7), lw + j * cw + 1, 1, '#ffffff');
    });
    ids.forEach((id, i) => {
      const set = Sprites.chars[id];
      Font.draw(x, id.toUpperCase().slice(0, 9), 2, top + i * ch + 14, '#ffffff');
      poses.forEach((p, j) => {
        const f = set.pose(p);
        drawFrame(x, f, lw + j * cw + 20, top + i * ch + ch - 4, 1, false);
      });
    });
    return this.post(name, c);
  },
  async all() {
    const P = this.poses(), half = Math.ceil(P.length / 2), out = [];
    out.push(await this.sheet('poses_heroes_1', this.heroes, P.slice(0, half)));
    out.push(await this.sheet('poses_heroes_2', this.heroes, P.slice(half)));
    out.push(await this.sheet('poses_enemies_1', this.enemies, P.slice(0, half)));
    out.push(await this.sheet('poses_enemies_2', this.enemies, P.slice(half)));
    out.push(await this.extra());
    return out;
  },
  // hats on their own, hatless deaths, and the dog's frames
  async extra(S = 3) {
    const ids = this.heroes.concat(this.enemies).filter((id) => Sprites.chars[id].hatPops);
    const c = document.createElement('canvas');
    c.width = 360 * S; c.height = (12 + ids.length * 30 + 40) * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.scale(S, S);
    x.fillStyle = '#5a6a7a'; x.fillRect(0, 0, c.width, c.height);
    Font.draw(x, 'HAT   DEAD   DEAD*   HURT*   IDLE', 60, 2, '#ffffff');
    ids.forEach((id, i) => {
      const set = Sprites.chars[id], y = 12 + i * 30, h = set.hat();
      Font.draw(x, id.toUpperCase().slice(0, 9), 2, y + 10, '#ffffff');
      if (h) { x.drawImage(h.r, 64, y + 8); x.drawImage(h.l, 80, y + 8); }
      drawFrame(x, set.pose('dead'), 120, y + 26, 1, false);
      drawFrame(x, set.pose('dead~'), 160, y + 26, 1, false);
      drawFrame(x, set.pose('hurt~'), 200, y + 26, 1, false);
      drawFrame(x, set.idle[0], 240, y + 26, 1, false);
    });
    const dy = 12 + ids.length * 30 + 6, D = Sprites.dog;
    [D.run[0], D.run[1], D.run[2], D.run[3], D.jump, D.crouch, D.sniff, D.bark, D.idle[1]].forEach((f, k) => drawFrame(x, f, 20 + k * 30, dy + 24, 1, false));
    return this.post('poses_extra', c);
  },
};
