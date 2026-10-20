import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function appFiles(dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await appFiles(rel)));
    else if (/\.(js|html)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

test('texty appky jsou bez em-dash', async () => {
  for (const file of ['index.html', ...(await appFiles('js'))]) {
    const text = await readFile(path.join(root, file), 'utf8');
    const line = text.split('\n').findIndex((l) => l.includes('—'));
    assert.equal(line, -1, `${file}:${line + 1} obsahuje em-dash`);
  }
});

test('index.html je česky a připravený pro iPhone', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<html lang="cs">/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /rel="manifest"/);
  assert.doesNotMatch(html, /https?:\/\//, 'žádné externí zdroje');
});
