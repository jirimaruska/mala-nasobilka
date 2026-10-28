import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + '/' + entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(rel)));
    else out.push(rel);
  }
  return out;
}

async function readSw() {
  return readFile(path.join(root, 'sw.js'), 'utf8');
}

function parseAssets(sw) {
  const match = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(match, 'sw.js musí mít seznam ASSETS');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('sw.js má CACHE_VERSION a appka ukazuje stejnou verzi', async () => {
  const match = (await readSw()).match(/const CACHE_VERSION = '([^']+)';/);
  assert.ok(match, 'sw.js musí mít CACHE_VERSION');
  const { APP_VERSION } = await import('../js/version.js');
  assert.equal(APP_VERSION, match[1], 'APP_VERSION v js/version.js musí být stejná jako CACHE_VERSION v sw.js');
});

test('ASSETS obsahuje všechny soubory appky a nic navíc', async () => {
  const assets = parseAssets(await readSw()).sort();
  const files = [
    'index.html',
    'manifest.webmanifest',
    ...(await listFiles('css')),
    ...(await listFiles('js')),
    ...(await listFiles('icons')),
  ].sort();
  assert.deepEqual(assets, files);
});
