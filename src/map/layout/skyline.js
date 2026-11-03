// Far layer: a ring of low-poly 2-4 storey town blocks (parapets, balcony slabs, dark
// windows, water tanks, dishes, antennas, a cell tower) beyond the roof fill, and a ring of
// hills with a few kasbah towers north / north-west of A. Nothing here collides; everything
// lands in the shared per-material buckets, so it adds only a handful of draw calls.
import { rng } from '../../core/mathx.js';

const orient = (P, n) => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? P.slice().reverse() : P;
};
const PAD0 = 500, PAD1 = 2100, CELL = 230;

export function build(K) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const R of K.regions) { x0 = Math.min(x0, R.minx); y0 = Math.min(y0, R.miny); x1 = Math.max(x1, R.maxx); y1 = Math.max(y1, R.maxy); }
  if (!isFinite(x0)) return;
  const r = rng(0x5c71);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const inner = (x, y, pad) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
  let nBlocks = 0, nDish = 0;

  // ---- town ring -----------------------------------------------------------------------------
  for (let y = y0 - PAD1; y < y1 + PAD1; y += CELL) for (let x = x0 - PAD1; x < x1 + PAD1; x += CELL) {
    const bx = x, by = y;
    if (inner(bx + CELL / 2, by + CELL / 2, PAD0 + CELL / 2)) continue;
    if (r() < 0.05) continue;                                   // a rare gap / courtyard
    // contiguous town blocks (no comb of free-standing slabs)
    const w = CELL + 1, d = CELL + 1;
    // distance outward from the map: farther rings a little taller so they peek over the roofs
    const out = Math.max(Math.max(x0 - PAD0 - bx, bx - x1 - PAD0), Math.max(y0 - PAD0 - by, by - y1 - PAD0));
    const storeys = 2 + Math.floor(r() * 2.6 + Math.min(1, out / 1200));
    const zb = -160, top = 120 + storeys * 105 + Math.round(r() * 2) * 16;
    const mat = r() < 0.72 ? 'plaster_white' : (r() < 0.6 ? 'plaster_wall' : 'adobe');
    const tone = 0.86 + 0.1 * r();
    K.box([bx, by, zb], [bx + w, by + d, top], mat, { col: false, color: tone });
    // stepped massing: a set-back upper storey over part of the block
    let top2 = top;
    if (r() < 0.55) {
      const fx0 = bx + w * (r() < 0.5 ? 0 : 0.4), fy0 = by + d * (r() < 0.5 ? 0 : 0.4);
      top2 = top + 90 + Math.round(r()) * 40;
      K.box([fx0, fy0, top], [fx0 + w * 0.6, fy0 + d * 0.6, top2], mat, { col: false, color: tone * 0.97 });
      K.box([fx0 - 3, fy0 - 3, top2], [fx0 + w * 0.6 + 3, fy0 + d * 0.6 + 3, top2 + 6], 'plaster_trim', { col: false, color: 0.93 });
      const sw = w * 0.6, sd = d * 0.6, zw = top + 26;
      for (const [ax, ay, ux, uy, nn, L] of [[fx0, fy0 - 0.6, 1, 0, [0, -1, 0], sw], [fx0, fy0 + sd + 0.6, 1, 0, [0, 1, 0], sw], [fx0 - 0.6, fy0, 0, 1, [-1, 0, 0], sd], [fx0 + sw + 0.6, fy0, 0, 1, [1, 0, 0], sd]]) {
        const nw = Math.max(1, Math.floor(L / 60));
        for (let k = 0; k < nw; k++) {
          const m = (k + 0.5) * L / nw;
          const Q = [[ax + ux * (m - 11), ay + uy * (m - 11), zw], [ax + ux * (m + 11), ay + uy * (m + 11), zw], [ax + ux * (m + 11), ay + uy * (m + 11), zw + 40], [ax + ux * (m - 11), ay + uy * (m - 11), zw + 40]];
          K.poly('window_frame', orient(Q, nn), { col: 0.1, normal: nn });
        }
      }
    }
    // parapet railing (iron posts + rail) on some roofs, a solid rim on others
    if (r() < 0.3) {
      const z0 = top, z1 = top + 30;
      for (const [p0, p1] of [[[bx, by], [bx + w, by]], [[bx + w, by], [bx + w, by + d]], [[bx + w, by + d], [bx, by + d]], [[bx, by + d], [bx, by]]]) {
        const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(2, Math.round(L / 40));
        for (let i = 0; i <= n; i++) { const t = i / n, px = p0[0] + (p1[0] - p0[0]) * t, py = p0[1] + (p1[1] - p0[1]) * t; K.box([px - 1, py - 1, z0], [px + 1, py + 1, z1], 'metal_beam', { col: false, color: 0.4 }); }
        const lo = [Math.min(p0[0], p1[0]) - 1, Math.min(p0[1], p1[1]) - 1], hi = [Math.max(p0[0], p1[0]) + 1, Math.max(p0[1], p1[1]) + 1];
        K.box([lo[0], lo[1], z1 - 2], [hi[0], hi[1], z1], 'metal_beam', { col: false, color: 0.4 });
      }
    } else if (r() < 0.8) {
      const t = 5, ph = 16 + r() * 10;
      K.box([bx - 2, by - 2, top], [bx + w + 2, by + t, top + ph], mat, { col: false, color: tone });
      K.box([bx - 2, by + d - t, top], [bx + w + 2, by + d + 2, top + ph], mat, { col: false, color: tone });
      K.box([bx - 2, by + t, top], [bx + t, by + d - t, top + ph], mat, { col: false, color: tone });
      K.box([bx + w - t, by + t, top], [bx + w + 2, by + d - t, top + ph], mat, { col: false, color: tone });
    }
    // windows (and balcony slabs) on both faces turned toward the map
    for (const fx of [true, false]) {
    const sgn = fx ? Math.sign(cx - (bx + w / 2)) : Math.sign(cy - (by + d / 2));
    const L = fx ? d : w;
    const nwin = Math.max(1, Math.floor(L / 70));
    for (let s = 0; s < storeys; s++) {
      const zw = 120 + s * 105 + 36;
      if (zw + 46 > top) break;
      for (let k = 0; k < nwin; k++) {
        if (r() < 0.25) continue;
        const m = (k + 0.5) * L / nwin;
        const q = fx
          ? [[sgn > 0 ? bx + w + 0.6 : bx - 0.6, by + m - 12], [sgn > 0 ? bx + w + 0.6 : bx - 0.6, by + m + 12]]
          : [[bx + m - 12, sgn > 0 ? by + d + 0.6 : by - 0.6], [bx + m + 12, sgn > 0 ? by + d + 0.6 : by - 0.6]];
        let P = [[q[0][0], q[0][1], zw], [q[1][0], q[1][1], zw], [q[1][0], q[1][1], zw + 44], [q[0][0], q[0][1], zw + 44]];
        const n = fx ? [sgn, 0, 0] : [0, sgn, 0];
        K.poly('window_frame', orient(P, n), { col: 0.1, normal: n });
      }
      if (s > 0 && r() < 0.45) {
        const m = L * (0.3 + 0.4 * r()), bw = 60;
        const zz = 120 + s * 105 + 20;
        if (fx) { const ex = sgn > 0 ? bx + w : bx - 22; K.box([ex, by + m - bw / 2, zz], [ex + 22, by + m + bw / 2, zz + 6], 'stone_block', { col: false, color: 0.9 }); const rx = sgn > 0 ? ex + 21 : ex; K.box([rx, by + m - bw / 2, zz + 6], [rx + 1.5, by + m + bw / 2, zz + 32], 'metal_grate', { col: false }); }
        else { const ey = sgn > 0 ? by + d : by - 22; K.box([bx + m - bw / 2, ey, zz], [bx + m + bw / 2, ey + 22, zz + 6], 'stone_block', { col: false, color: 0.9 }); const ry = sgn > 0 ? ey + 21 : ey; K.box([bx + m - bw / 2, ry, zz + 6], [bx + m + bw / 2, ry + 1.5, zz + 32], 'metal_grate', { col: false }); }
      }
    }
    }
    // roof clutter
    const k = r();
    const rx = bx + w * (0.25 + 0.5 * r()), ry = by + d * (0.25 + 0.5 * r());
    if (k < 0.18 && nDish < 18) { K.prop('satelliteDish', [{ roof: true }], [rx, ry, top], Math.atan2(cy - ry, cx - rx) * 180 / Math.PI + 90); nDish++; }
    else if (k < 0.45) {
      const oct = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; oct.push([rx + 18 * Math.cos(a), ry + 18 * Math.sin(a)]); }
      K.prismSolid(oct, top + 14, top + 46, r() < 0.5 ? 'plaster_white' : 'metal_barrel', { col: false, color: 0.85 });
      K.box([rx - 16, ry - 16, top], [rx + 16, ry + 16, top + 14], 'metal_beam', { col: false, color: 0.5 });
    } else if (k < 0.6) {
      K.box([rx - 1.5, ry - 1.5, top], [rx + 1.5, ry + 1.5, top + 120], 'metal_beam', { col: false, color: 0.45 });
      K.box([rx - 18, ry - 1, top + 90], [rx + 18, ry + 1, top + 92], 'metal_beam', { col: false, color: 0.45 });
    } else if (k < 0.72) {
      K.box([rx - 30, ry - 24, top], [rx + 30, ry + 24, top + 70], mat, { col: false, color: tone * 0.97 });
    }
    nBlocks++;
  }

  // ---- cell tower (lattice approximated by four legs and bracing rungs) ------------------------
  {
    const tx = x0 - 900, ty = y1 + 700, H = 900;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let s = 0; s < 6; s++) {
        const t0 = s / 6, t1 = (s + 1) / 6, w0 = 40 * (1 - t0) + 8 * t0, w1 = 40 * (1 - t1) + 8 * t1;
        K.box([tx + sx * w0 - 2, ty + sy * w0 - 2, -100 + H * t0], [tx + sx * w1 + 2, ty + sy * w1 + 2, -100 + H * t1], 'metal_beam', { col: false, color: 0.55 });
      }
    }
    for (let s = 1; s < 12; s++) {
      const t = s / 12, w = 40 * (1 - t) + 8 * t, z = -100 + H * t;
      K.box([tx - w, ty - w, z], [tx + w, ty - w + 2, z + 2], 'metal_beam', { col: false, color: 0.5 });
      K.box([tx - w, ty + w - 2, z], [tx + w, ty + w, z + 2], 'metal_beam', { col: false, color: 0.5 });
    }
    for (let s = 0; s < 3; s++) K.box([tx - 26, ty - 4, 760 - s * 30], [tx + 26, ty + 4, 776 - s * 30], 'plaster_white', { col: false, color: 0.9 });
  }

  // ---- hills: a low, far, hazy range to the west / north-west only (out of the T-spawn and
  // long sightlines). Pale grey-blue vertex tint so they sit in the horizon haze.
  const RAD = [8400, 9200, 9900, 10500];
  const A0 = 150 * Math.PI / 180, A1 = 232 * Math.PI / 180, N = 40;
  const hz = (a, k) => {
    const t = (a - A0) / (A1 - A0), edge = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));   // taper at the sector ends
    const n = 0.55 + 0.25 * Math.sin(a * 7 + 1.3) + 0.12 * Math.sin(a * 17 + 0.4) + 0.08 * Math.sin(a * 31 + 2.2);
    const base = [-220, 380, 900, 600][k];
    return k === 0 ? base : -220 + (base + 220) * edge * (0.55 + 0.7 * n);
  };
  const P = (a, k) => [cx + RAD[k] * Math.cos(a), cy + RAD[k] * Math.sin(a), hz(a, k)];
  const uv = (p) => [p[0] / 1400, p[1] / 1400];
  const haze = (k) => { const f = 0.82 + 0.05 * k; return [f * 0.92, f * 0.95, f * 1.04]; };
  for (let i = 0; i < N; i++) {
    const a0 = A0 + (A1 - A0) * i / N, a1 = A0 + (A1 - A0) * (i + 1) / N;
    for (let k = 0; k < RAD.length - 1; k++) {
      const A = P(a0, k), B = P(a1, k), C = P(a1, k + 1), D = P(a0, k + 1);
      K.poly('plaster_white', orient([A, B, C], [0, 0, 1]), { uv, col: haze(k) });
      K.poly('plaster_white', orient([A, C, D], [0, 0, 1]), { uv, col: haze(k) });
    }
  }
  // a few kasbah towers on the slopes, just as hazy
  for (let t = 0; t < 5; t++) {
    const a = A0 + (A1 - A0) * (0.25 + t * 0.12), k = 1;
    const R0 = RAD[k] + 200 + r() * 300;
    const px = cx + R0 * Math.cos(a), py = cy + R0 * Math.sin(a);
    const frac = (R0 - RAD[k]) / (RAD[k + 1] - RAD[k]);
    const gz = hz(a, k) * (1 - frac) + hz(a, k + 1) * frac;
    const sz = 110 + r() * 60, H = 200 + r() * 160;
    K.box([px - sz / 2, py - sz / 2, gz - 80], [px + sz / 2, py + sz / 2, gz + H], 'plaster_white', { col: false, color: 0.8 });
  }
  K.skylineStats = { blocks: nBlocks, dishes: nDish };
}
