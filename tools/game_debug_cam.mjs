// one-off camera debug for the menu -> match flow (game agent)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
import { acquireSlot } from './slot.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const release = await acquireSlot('game_debug_cam');
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/html' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?quality=low`);
  await page.waitForFunction(() => window.__READY, null, { timeout: 400000 });
  const frames = (n) => page.evaluate((k) => new Promise((res) => { let l = k; const s = () => (--l <= 0 ? res() : requestAnimationFrame(s)); requestAnimationFrame(s); }), n);
  const dump = (tag) => page.evaluate((tag) => { const c = World.camera; const f = World.hud.flyover; return JSON.stringify({ tag, cam: c.position.toArray().map(Math.round), q: c.quaternion.toArray().map((x) => +x.toFixed(2)), fov: +c.fov.toFixed(1), ov: World.cameraOverride ? { eye: World.cameraOverride.eye.toArray().map(Math.round), p: World.cameraOverride.pitch, y: World.cameraOverride.yaw } : null, shots: f.shots.length, shot0: f.shots[f.i] && { from: f.shots[f.i].from.toArray().map(Math.round), to: f.shots[f.i].to.toArray().map(Math.round), p: f.shots[f.i].pitch, y: f.shots[f.i].yaw }, inP: World.input.pitch, inY: World.input.yaw, local: World.local.origin.toArray().map(Math.round), lp: World.local.pitch, ly: World.local.yaw }); }, tag);
  await frames(20); console.log(await dump('menu'));
  await page.screenshot({ path: '/tmp/hud/dbg_menu.png' });
  await page.click('.mm-btn.primary'); await frames(2);
  await page.click('.ts-card[data-team="T"]'); await frames(10);
  console.log(await dump('match'));
  await page.screenshot({ path: '/tmp/hud/dbg_match.png' });
} finally { await browser.close(); server.close(); release?.(); }
