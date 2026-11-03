// Cross-process FIFO render-slot queue shared by EVERY headless-browser tool.
//
//   import { acquireSlot } from './slot.mjs';
//   const release = await acquireSlot('texlab');   // before chromium.launch()
//   try { ... } finally { await browser.close(); release(); }
//
// SwiftShader is CPU-bound and this box has 4 cores, so at most SLOTS browsers render at
// once. Waiters are served strictly in arrival order (ticket files sorted by timestamp), so
// nobody starves. Each process may hold at most one ticket. A slot held longer than
// MAX_HOLD_S is considered hung and reaped. `node tools/slot.mjs` prints the queue.
import fs from 'node:fs';
import path from 'node:path';

const SLOTS = +process.env.DUST2_SHOT_SLOTS || 2;
const MAX_HOLD_S = +process.env.DUST2_SHOT_MAX_HOLD || 2400; // boots under load can exceed 10 min
const DIR = '/tmp/dust2-shot-locks';
const QDIR = path.join(DIR, 'q');
fs.mkdirSync(QDIR, { recursive: true });

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

function reap() {
  const now = Date.now() / 1000;
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.lock')) continue;
    const p = path.join(DIR, f);
    const [pid, t] = read(p).split(' ');
    if (!+pid || !alive(+pid) || (+t && now - +t > MAX_HOLD_S)) { try { fs.unlinkSync(p); } catch {} }
  }
  for (const f of fs.readdirSync(QDIR)) {
    const pid = +f.split('-')[1];
    if (!pid || !alive(pid)) { try { fs.unlinkSync(path.join(QDIR, f)); } catch {} }
  }
}

/** Resolves to a release() function once this process holds a render slot. */
export async function acquireSlot(label = path.basename(process.argv[1] || 'tool')) {
  const stamp = String(Date.now() * 1000 + Number(process.hrtime.bigint() % 1000n)).padStart(17, '0');
  const ticket = path.join(QDIR, `${stamp}-${process.pid}`);
  fs.writeFileSync(ticket, label);
  let held = null, announced = false;
  const t0 = Date.now();
  const release = () => {
    if (held && read(held).startsWith(String(process.pid) + ' ')) { try { fs.unlinkSync(held); } catch {} }
    held = null;
  };
  const cleanup = () => { try { fs.unlinkSync(ticket); } catch {} release(); };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { cleanup(); process.exit(130); });

  for (;;) {
    reap();
    const queue = fs.readdirSync(QDIR).sort();
    const rank = queue.indexOf(path.basename(ticket));
    const busy = fs.readdirSync(DIR).filter((f) => f.endsWith('.lock')).length;
    if (rank >= 0 && rank < SLOTS - busy) {
      for (let i = 0; i < SLOTS && !held; i++) {
        const f = path.join(DIR, `slot${i}.lock`);
        try { fs.writeFileSync(f, `${process.pid} ${Math.floor(Date.now() / 1000)} ${label}`, { flag: 'wx' }); held = f; } catch {}
      }
      if (held) {
        try { fs.unlinkSync(ticket); } catch {}
        if (announced) console.error(`[slot] ${label}: got a slot after ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        return release;
      }
    }
    if (!announced) { console.error(`[slot] ${label}: queued at position ${rank + 1} (${busy}/${SLOTS} busy)`); announced = true; }
    await new Promise((r) => setTimeout(r, 400));
  }
}

export function status() {
  reap();
  return {
    slots: SLOTS,
    held: fs.readdirSync(DIR).filter((f) => f.endsWith('.lock')).map((f) => read(path.join(DIR, f))),
    queue: fs.readdirSync(QDIR).sort().map((f, i) => `${i + 1}. ${read(path.join(QDIR, f))} (pid ${f.split('-')[1]})`),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(status(), null, 1));

/**
 * Compatibility shim for tools that still carry the old copied lock loop: waits its turn in
 * the FIFO queue, then returns a private empty directory so the legacy loop takes "slot0"
 * immediately. The real slot is held until the process exits.
 */
export async function legacyDir(label) {
  await acquireSlot(label);
  return fs.mkdtempSync(path.join('/tmp', 'dust2-legacy-'));
}
