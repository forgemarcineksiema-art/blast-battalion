import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const inlineScripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1])).map(match => match[2]);

test('readable game packages contain valid JavaScript after HTML assembly', () => {
  execFileSync(process.execPath, ['tools/build.mjs', '--no-minify'], { cwd: root, stdio: 'pipe' });
  for (const name of ['web/index.html', 'artifact/blast-battalion.html', 'poki/index.html', 'crazygames/index.html']) {
    const scripts = inlineScripts(readFileSync(join(root, 'dist', name), 'utf8'));
    assert.ok(scripts.length, name);
    for (const [index, source] of scripts.entries()) new Script(source, { filename: `${name}:${index}` });
  }
  for (const name of ['poki/game.js', 'crazygames/game.js']) {
    new Script(readFileSync(join(root, 'dist', name), 'utf8'), { filename: name });
  }
});

test('web and artifact preserve replacement tokens and closing script text literally', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'blast-build-'));
  try {
    mkdirSync(join(fixture, 'tools'));
    mkdirSync(join(fixture, 'src'));
    copyFileSync(join(root, 'tools/build.mjs'), join(fixture, 'tools/build.mjs'));
    const expected = ['$&', '$`', "$'", '$$', '</script>'];
    writeFileSync(join(fixture, 'src/probe.js'), `globalThis.probe = ${JSON.stringify(expected)};`);
    writeFileSync(join(fixture, 'index.html'), '<!doctype html><html><head><title>Build fixture</title><style></style></head><body>' +
      '<script>window.GAME_PLATFORM = window.GAME_PLATFORM || "none";</script>' +
      '<!-- BUILD:SCRIPTS --><script src="src/probe.js"></script><!-- /BUILD:SCRIPTS --></body></html>');
    execFileSync(process.execPath, ['tools/build.mjs', '--no-minify'], { cwd: fixture, stdio: 'pipe' });
    for (const name of ['web/index.html', 'artifact/blast-battalion.html']) {
      const context = createContext({ window: {} });
      for (const source of inlineScripts(readFileSync(join(fixture, 'dist', name), 'utf8'))) {
        new Script(source).runInContext(context);
      }
      assert.equal(JSON.stringify(context.probe), JSON.stringify(expected), name);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
