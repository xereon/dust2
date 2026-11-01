#!/usr/bin/env node
// In-game event audit for the audio module. Runs a real bots-only match (?botsim=rules) with
// audio unlocked, hooks World.emit from page start, and reports for every event the audio
// module subscribes to: how often it fired, the payload keys seen, and which sounds started.
//
//   node tools/audio_gameaudit.mjs [--secs 120] [--out /tmp/audio/audit.json]
//
// Exit 2 on console errors, or when a sound was asked for that the catalog doesn't know.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { acquireSlot } from './slot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const n = args[i + 1]; opt[args[i].slice(2)] = n === undefined || n.startsWith('--') ? true : (i++, n); }
const SECS = +opt.secs || 120;
const OUT = opt.out || '/tmp/audio/audit.json';
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// events audio.js subscribes to (keep in sync with Audio._wire)
const SUBSCRIBED = ['fire', 'footstep', 'jump', 'land', 'impact', 'damage', 'death', 'shell_land', 'flashed', 'reload', 'weapon_shell_in',
  'weapon_reload_end', 'weapon_mode', 'weapon_drop', 'bomb_dropped', 'weapon_pickup', 'bomb_pickup', 'radio', 'dryfire', 'zoom', 'silencer',
  'deploy', 'buy', 'sound', 'grenade_pin', 'grenade_throw', 'grenade_bounce', 'hegrenade_detonate', 'flashbang_detonate', 'smokegrenade_detonate',
  'smoke_expire', 'molotov_detonate', 'incgrenade_detonate', 'inferno_expire', 'decoy_start', 'decoy_fire', 'bomb_plant_start', 'bomb_plant_abort',
  'bomb_planted', 'bomb_defuse_start', 'bomb_defuse_abort', 'bomb_defused', 'bomb_exploded', 'bomb_beep', 'round_live', 'round_start', 'round_end',
  'round_mvp', 'pointerlock'];

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const release = await acquireSlot('audio_gameaudit');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--enable-webgl', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
let report = null;
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  // hook World.emit the moment world.js publishes it
  await page.addInitScript(() => {
    const log = { counts: {}, keys: {}, sample: {} };
    window.__evlog = log;
    let W;
    Object.defineProperty(window, 'World', {
      configurable: true,
      get() { return W; },
      set(v) {
        W = v;
        const emit = v.emit.bind(v);
        v.emit = (name, p) => {
          log.counts[name] = (log.counts[name] || 0) + 1;
          if (p && typeof p === 'object') {
            const k = log.keys[name] || (log.keys[name] = {});
            for (const key of Object.keys(p)) k[key] = (k[key] || 0) + (p[key] != null ? 1 : 0);
            if (!log.sample[name]) log.sample[name] = Object.fromEntries(Object.entries(p).map(([a, b]) => [a, b == null ? null : typeof b === 'object' ? (b.isVector3 ? 'Vector3' : b.constructor?.name || 'object') : b]));
          }
          return emit(name, p);
        };
      },
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?botsim=rules&botfreeze=2&botmoney=4000&quality=low`);
  await page.waitForFunction(() => window.__READY || window.__BOOT_ERROR, null, { timeout: 400000, polling: 500 });
  if (await page.evaluate(() => window.__BOOT_ERROR)) throw new Error('boot error: ' + await page.evaluate(() => window.__BOOT_ERROR));
  // unlock audio as a user gesture would, then tally what the audio module starts
  await page.mouse.click(5, 5);
  await page.evaluate(() => {
    const A = window.World.audio;
    A.unlock();
    window.__snd = { started: {}, missing: {}, dropped: 0 };
    const orig = A._start.bind(A);
    A._start = (name, pos, o) => {
      const h = orig(name, pos, o);
      const S = window.__snd;
      if (h) S.started[name] = (S.started[name] || 0) + 1;
      else if (A.bank?.meta && !A.bank.meta.soundDef(name)) S.missing[name] = (S.missing[name] || 0) + 1;
      else S.dropped++;
      return h;
    };
  });
  const t0 = Date.now();
  let gameT = 0;
  while (Date.now() - t0 < SECS * 1000) {
    await page.waitForTimeout(5000);
    gameT = await page.evaluate(() => window.World.time);
    process.stdout.write(`\r  game time ${gameT.toFixed(1)} s, real ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  }
  console.log();
  report = await page.evaluate((sub) => {
    const L = window.__evlog, S = window.__snd, A = window.World.audio;
    const events = {};
    for (const n of sub) events[n] = { fired: L.counts[n] || 0, keys: L.keys[n] || {}, sample: L.sample[n] || null };
    const others = Object.fromEntries(Object.entries(L.counts).filter(([n]) => !sub.includes(n)));
    return { gameTime: window.World.time, events, unsubscribed: others, sounds: S, stats: A.stats() };
  }, SUBSCRIBED);
} catch (err) { errors.push(String(err.stack || err)); }
finally { await browser.close(); server.close(); release(); }

if (report) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(`game time ${report.gameTime.toFixed(1)} s · audio ${JSON.stringify(report.stats)}`);
  console.log('\nsubscribed events (fired · payload keys):');
  for (const [n, e] of Object.entries(report.events)) if (e.fired) console.log(`  ${n.padEnd(22)} ${String(e.fired).padStart(5)}  ${Object.keys(e.keys).join(', ')}`);
  console.log('\nnever fired:', Object.entries(report.events).filter(([, e]) => !e.fired).map(([n]) => n).join(', '));
  console.log('\nemitted but not subscribed:', JSON.stringify(report.unsubscribed));
  console.log('\nsounds started:', JSON.stringify(report.sounds.started));
  console.log('dropped (not rendered yet / out of range / voice limit):', report.sounds.dropped);
  if (Object.keys(report.sounds.missing).length) { console.log('UNKNOWN SOUND NAMES:', JSON.stringify(report.sounds.missing)); errors.push('unknown sound names'); }
  console.log(`\nwrote ${OUT}`);
}
if (errors.length) { console.error([...new Set(errors)].slice(0, 20).map((e) => '  ✗ ' + e).join('\n')); process.exit(2); }
