#!/usr/bin/env node
// ============================================================================
//  Build: bundles src/*.js (order taken from index.html) into ready-to-upload
//  folders + zip files for each portal.
//
//    node tools/build.mjs              -> dist/{web,poki,crazygames}/ + zips
//    node tools/build.mjs --no-minify  -> same, readable code
//
//  Output
//    dist/web/index.html            single file, no SDK (itch.io, own site, tests)
//    dist/poki/index.html+game.js   Poki SDK v2 wired in
//    dist/crazygames/...            CrazyGames SDK v3 wired in
//    dist/blast-battalion-*.zip     upload these to the developer portals
//    dist/artifact/blast-battalion.html   page fragment for a claude.ai Artifact
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const blockRe = /<!-- BUILD:SCRIPTS -->([\s\S]*?)<!-- \/BUILD:SCRIPTS -->/;
const block = html.match(blockRe);
if (!block) throw new Error('BUILD:SCRIPTS block not found in index.html');
const files = [...block[1].matchAll(/src="([^"]+)"/g)].map((m) => m[1]);

// ---------------------------------------------------------------- bundle
let bundle = files.map((f) => `// ---- ${f}\n` + readFileSync(join(root, f), 'utf8')).join('\n');
// the typeface's files go inside the code: every build is still one page (or page + game.js)
bundle = bundle.replace(/src\/fonts\/[\w.-]+\.woff2/g, (p) => 'data:font/woff2;base64,' + readFileSync(join(root, p)).toString('base64'));
bundle = `(function () {\n${bundle}\n})();\n`;

let code = bundle;
if (!process.argv.includes('--no-minify')) {
  const tmpIn = join(tmpdir(), 'blast_bundle.js'), tmpOut = join(tmpdir(), 'blast_bundle.min.js');
  writeFileSync(tmpIn, bundle);
  try {
    execSync(`npx --yes terser "${tmpIn}" --compress passes=2 --mangle --output "${tmpOut}"`, { stdio: 'pipe' });
    code = readFileSync(tmpOut, 'utf8');
  } catch (e) {
    console.warn('! terser not available - shipping the readable bundle');
  }
}
code = `/* Blast Battalion - (c) ${new Date().getFullYear()} */\n` + code;

// ---------------------------------------------------------------- html
const setPlatform = (src, p) => src.replace(/<script>window\.GAME_PLATFORM[^<]*<\/script>/, `<script>window.GAME_PLATFORM = '${p}';</script>`);
// Poki: the SDK's loader goes in <head>, as Poki's docs ask, so it downloads alongside game.js
// (src/platform.js still loads it itself when it isn't there)
const HEAD_SDK = { poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>' };
const withSdk = (src, p) => (HEAD_SDK[p] ? src.replace('</head>', HEAD_SDK[p] + '\n</head>') : src);
const pageWith = (platform, scriptTag) => withSdk(setPlatform(html, platform), platform).replace(blockRe, scriptTag);
// guard against "</script>" sequences inside the inlined bundle
const inline = (js) => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;

// ---------------------------------------------------------------- zip (store+deflate, no deps)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

// ---------------------------------------------------------------- write
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
const out = (rel, data) => { const p = join(dist, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); return p; };
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';

// single-file web build
const webHtml = pageWith('none', inline(code));
out('web/index.html', webHtml);
out('blast-battalion-web.zip', zip([{ name: 'index.html', data: webHtml }]));

// portal builds (index.html + game.js, the layout both portals expect at the zip root)
for (const p of ['poki', 'crazygames']) {
  const page = pageWith(p, '<script src="game.js"></script>');
  out(`${p}/index.html`, page);
  out(`${p}/game.js`, code);
  out(`blast-battalion-${p}.zip`, zip([{ name: 'index.html', data: page }, { name: 'game.js', data: code }]));
}

// claude.ai Artifact fragment: title + style + body content, no document skeleton
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = setPlatform(html, 'none').match(/<body>([\s\S]*?)<\/body>/)[1].replace(blockRe, inline(code)).trim();
out('artifact/blast-battalion.html', `${title}\n${style}\n${body}\n`);

console.log(`Bundled ${files.length} source files -> ${kb(code)} of JavaScript`);
console.log('  dist/web/index.html                 ' + kb(webHtml));
console.log('  dist/blast-battalion-poki.zip');
console.log('  dist/blast-battalion-crazygames.zip');
console.log('  dist/blast-battalion-web.zip');
console.log('  dist/artifact/blast-battalion.html');
