#!/usr/bin/env node
// In-game walking clip of a live bot (side-on chase camera) + foot-skate measurement.
//   node tools/charlab_clip.mjs --out /tmp/char/clip --frames 12 --step 3 [--team T] [--w 960 --h 540]
// Writes clip_NN.png per captured frame and skate.json (planted-foot drift per frame).
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
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const n = args[i + 1]; opt[args[i].slice(2)] = n === undefined || n.startsWith('--') ? true : (i++, n); }
const W = +opt.w || 960, H = +opt.h || 540, N = +opt.frames || 12, STEP = +opt.step || 3, team = opt.team || 'T';
const out = opt.out || '/tmp/charclip';
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const release = await acquireSlot('charlab_clip');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?harness=1&live=1&viewmodel=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY || window.__BOOT_ERROR, null, { timeout: 600000, polling: 500 });
  await page.evaluate(() => World.match.beginMatch('CT', { teamSize: 5 }));
  await page.evaluate(() => window.__harness.applyPose('t_spawn'));
  await page.evaluate(() => window.__harness.frames(150));       // let bots buy / start walking
  const skate = [];
  // per-frame sampler of the followed bot's toe positions (world)
  await page.evaluate(() => {
    window.__samples = [];
    const tick = () => {
      const b = window.__clipBot;
      if (b?.model?.anim) {
        const m = b.model, A = m.anim, o = b.renderOrigin || b.origin, s = { t: World.time, o: [o.x, o.z], v: Math.hypot(b.velocity.x, b.velocity.z) };
        for (const side of ['L', 'R']) {
          const i = m.bones.findIndex((x) => x.name === 'toe_' + side);
          const p = A.Pm[i].clone().applyQuaternion(m.rootQuat).add(m.root.position);
          s[side] = [p.x, p.y - o.y, p.z];
        }
        window.__samples.push(s);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let k = 0; k < N; k++) {
    const info = await page.evaluate(({ team, step }) => {
      const DEG = Math.PI / 180;
      const bots = World.entities.filter((e) => e.isBot && e.team === team && e.alive && e.model);
      bots.sort((a, b) => Math.hypot(b.velocity.x, b.velocity.z) - Math.hypot(a.velocity.x, a.velocity.z));
      const b = window.__clipBot && bots.includes(window.__clipBot) ? window.__clipBot : (window.__clipBot = bots[0]);
      if (!b) return null;
      const o = b.renderOrigin || b.origin;
      const mv = Math.atan2(-b.velocity.z, b.velocity.x);
      const side = mv + Math.PI / 2;
      const ex = o.x + Math.cos(side) * 130, ez = o.z - Math.sin(side) * 130;
      const yaw = Math.atan2(-(o.z - ez), o.x - ex) / DEG;
      window.__harness.applyPose({ eye: [ex, o.y + 44, ez], pitch: 6, yaw, fov: 70 });
      return new Promise((res) => window.__harness.frames(step).then(() => {
        const m = b.model, A = m.anim, toes = {};
        for (const s of ['L', 'R']) {
          const i = m.bones.findIndex((x) => x.name === 'toe_' + s);
          const p = A.Pm[i].clone().applyQuaternion(m.rootQuat).add(m.root.position);
          toes[s] = [p.x, p.y - o.y, p.z];
        }
        res({ name: b.name, speed: Math.hypot(b.velocity.x, b.velocity.z), toes, t: World.time });
      }));
    }, { team, step: STEP });
    if (!info) { console.log('no bot'); break; }
    skate.push(info);
    await (await page.$('canvas#game')).screenshot({ path: path.join(out, `clip_${String(k).padStart(2, '0')}.png`), timeout: 240000 });
  }
  const S = await page.evaluate(() => window.__samples);
  // planted-foot drift: horizontal toe motion between consecutive frames while the toe is down
  const st = { L: [], R: [] }, body = [];
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    body.push(Math.hypot(b.o[0] - a.o[0], b.o[1] - a.o[1]));
    for (const f of ['L', 'R']) if (a[f][1] < 2.4 && b[f][1] < 2.4) st[f].push(Math.hypot(b[f][0] - a[f][0], b[f][2] - a[f][2]));
  }
  const stat = (x) => x.length ? { n: x.length, mean: +(x.reduce((p, c) => p + c, 0) / x.length).toFixed(3), max: +Math.max(...x).toFixed(3) } : null;
  const rep = { frames: S.length, bodyPerFrame: stat(body), plantedL: stat(st.L), plantedR: stat(st.R), meanSpeed: +(S.reduce((p, c) => p + c.v, 0) / Math.max(1, S.length)).toFixed(1) };
  console.log('skate', JSON.stringify(rep));
  fs.writeFileSync(path.join(out, 'skate.json'), JSON.stringify({ rep, skate }, null, 1));
  console.log(`wrote ${skate.length} frames to ${out}`);
} catch (e) { errors.push(String(e.stack || e)); }
finally { await browser.close(); server.close(); release(); }
if (errors.length) { console.error([...new Set(errors)].slice(0, 10).join('\n')); process.exit(2); }
