#!/usr/bin/env node
// In-game character check: boots the game in harness mode, starts a match, frames a bot and
// screenshots. Reports per-frame timings so stalls are visible.
//   node tools/charlab_game.mjs --out /tmp/x.png [--team T] [--idx 0] [--dist 110] [--live] [--w 960 --h 540]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { acquireSlot } from './slot.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) { const a = args[i]; if (!a.startsWith('--')) continue; const n = args[i + 1]; opt[a.slice(2)] = n === undefined || n.startsWith('--') ? true : (i++, n); }
const W = +opt.w || 960, H = +opt.h || 540;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const release = await acquireSlot('charlab_game');
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const q = new URLSearchParams({ harness: '1', pose: opt.pose || 't_spawn' });
  if (opt.live) q.set('live', '1');
  if (opt.quality) q.set('quality', opt.quality);
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY || window.__BOOT_ERROR, null, { timeout: 300000, polling: 500 });
  const t0 = Date.now();
  await page.evaluate(() => World.match.beginMatch('CT', { teamSize: 5 }));
  console.log(`beginMatch ${Date.now() - t0}ms`);
  const r = await page.evaluate(([team, idx, dist, eval2]) => {
    const bs = World.entities.filter((e) => e.isBot && e.team === team);
    const b = bs[idx]; if (!b) return 'nobot';
    if (eval2) (0, eval)(eval2);
    const o = b.origin, a = b.yaw * Math.PI / 180;
    const ex = o.x + Math.cos(a) * dist + Math.sin(a) * dist * 0.3, ez = o.z - Math.sin(a) * dist + Math.cos(a) * dist * 0.3;
    const yaw = Math.atan2(-(o.z - ez), o.x - ex) * 180 / Math.PI;
    window.__harness.applyPose({ eye: [ex, o.y + 50 + dist * 0.05, ez], pitch: 5, yaw, fov: +(window.__FOV || 55) });
    return `${b.name} at ${o.x.toFixed(0)},${o.y.toFixed(0)},${o.z.toFixed(0)} model=${!!b.model} bots=${bs.length}`;
  }, [opt.team || 'T', +opt.idx || 0, +opt.dist || 110, opt.eval || '']);
  console.log(r);
  for (let i = 0; i < (+opt.frames || 6); i++) {
    const t = Date.now();
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => res())));
    console.log(`frame ${i}: ${Date.now() - t}ms`);
  }
  const info = await page.evaluate(() => { const i = World.renderer.renderer.info.render; return `calls ${i.calls} tris ${i.triangles}`; });
  console.log(info);
  await page.screenshot({ path: opt.out || '/tmp/charlab_game.png', timeout: 120000 });
  console.log('wrote', opt.out);
} catch (e) { errors.push(String(e.stack || e)); }
finally { await browser.close(); server.close(); release(); }
if (errors.length) { console.error([...new Set(errors)].slice(0, 15).join('\n')); process.exit(2); }
