// Vygeneruje PNG ikony z icons/icon.svg. Jen pro vývoj, appka to za běhu nepotřebuje.
// Použití: node tools/make-icons.mjs   (potřebuje Playwright s Chromiem)
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = { 'icon-180.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return createRequire(globalRoot + '/')('playwright');
  }
}

const { chromium } = await loadPlaywright();
const svg = await readFile(path.join(root, 'icons/icon.svg'), 'utf8');
const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const browser = await chromium.launch();
for (const [name, size] of Object.entries(SIZES)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}img{display:block}</style><img src="${src}" width="${size}" height="${size}">`
  );
  await page.waitForFunction(() => document.querySelector('img').complete);
  await page.screenshot({ path: path.join(root, 'icons', name) });
  await page.close();
  console.log('icons/' + name);
}
await browser.close();
