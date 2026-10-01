// Dev-only: a minimal MP4 (ISO BMFF) muxer for a single H.264 video track, so preview videos can be
// encoded in the browser with WebCodecs (VideoEncoder, avc.format 'avc') and saved as plain .mp4.
// Samples must come in decode order without B-frames (the software encoder makes none).
// Layout: ftyp, moov (up front, so players can start before the whole file arrives), mdat.
/* eslint-disable no-undef */
window.MP4 = {
  // samples: [{ data: Uint8Array, key: bool }], avcC: decoderConfig.description bytes
  mux(samples, avcC, width, height, fps) {
    const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const u16 = (n) => [(n >>> 8) & 255, n & 255];
    const str = (s) => Array.from(s, (c) => c.charCodeAt(0));
    const zeros = (n) => new Array(n).fill(0);
    const concat = (parts) => {
      const flat = [];
      let len = 0;
      const walk = (p) => {
        if (p instanceof Uint8Array) { flat.push(p); len += p.length; } else if (p.length && typeof p[0] !== 'number') p.forEach(walk);
        else { const a = Uint8Array.from(p); flat.push(a); len += a.length; }
      };
      parts.forEach(walk);
      const out = new Uint8Array(len);
      let o = 0;
      for (const a of flat) { out.set(a, o); o += a.length; }
      return out;
    };
    const box = (type, ...parts) => { const body = concat(parts); return concat([u32(body.length + 8), str(type), body]); };
    const full = (type, version, flags, ...parts) => box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
    const matrix = [...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

    const n = samples.length;
    const ms = Math.round(n * 1000 / fps);
    const keys = [];
    samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const moov = (offset) => box('moov',
      full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), zeros(10), matrix, zeros(24), u32(2)),
      box('trak',
        full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), zeros(8), u16(0), u16(0), u16(0), u16(0), matrix, u32(width << 16), u32(height << 16)),
        box('mdia',
          full('mdhd', 0, 0, u32(0), u32(0), u32(fps), u32(n), u16(0x55c4), u16(0)),
          full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler'), [0]),
          box('minf',
            full('vmhd', 0, 1, zeros(8)),
            box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
            box('stbl',
              full('stsd', 0, 0, u32(1), box('avc1',
                zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1),
                zeros(32), u16(0x0018), u16(0xffff), box('avcC', avcC))),
              full('stts', 0, 0, u32(1), u32(n), u32(1)),
              full('stss', 0, 0, u32(keys.length), keys.map(u32)),
              full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
              full('stsz', 0, 0, u32(0), u32(n), samples.map((s) => u32(s.data.length))),
              full('stco', 0, 0, u32(1), u32(offset)),
            )))));
    const ftyp = box('ftyp', str('isom'), u32(512), str('isomiso2avc1mp41'));
    const head = moov(0).length;
    const data = concat(samples.map((s) => s.data));
    return concat([ftyp, moov(ftyp.length + head + 8), u32(data.length + 8), str('mdat'), data]);
  },
};
