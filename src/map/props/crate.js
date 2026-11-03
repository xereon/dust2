// Dust II wooden crates: planked panels inside a bevelled frame, braces / mid rails,
// darker end grain, metal corner caps with rivets, steel bands and stencilled markings.
import * as THREE from 'three';
import { PropBuilder, rect, bandPoly, clipOutsideBand, clamp, frame, slab, dome, paint, lerp, smooth, sweep } from './core.js';
import { board } from './woodkit.js';
import { labelUV } from './tex.js';

// Variant table. tint multiplies the bleached crate atlas.
const VARIANTS = [
  { panel: 'cross', planks: 'h', caps: false, bands: false, tint: [1.0, 0.98, 0.95], labels: [['num14', 'ul'], ['star', 'lr']] },
  { panel: 'diag', planks: 'h', caps: true, bands: false, tint: [0.98, 0.9, 0.78], labels: [['arrows', 'ul'], ['stamp', 'lr']] },
  { panel: 'x', planks: 'v', caps: false, bands: true, tint: [0.84, 0.84, 0.83], labels: [['num07', 'top']] },
  { panel: 'plain', planks: 'v', caps: true, bands: true, tint: [1.0, 0.85, 0.66], labels: [['care', 'c']] },
  // 4 — CS2 A-site / goose: smooth WHITE-painted sheet panels in a grid of proud battens,
  //     steel junction plates + straps, black "14" / red star / blue-triangle stencils
  { style: 'panel', paint: 'cratewhite', grid: true, labels: [['num14', 'ul'], ['star', 'lr'], ['rt', 'x'], ['tag', 'x2']] },
  // 5 — CS2 grey ramp crate: perimeter frame + one sheet panel, side handles, "14"
  { style: 'panel', paint: 'crategrey', grid: false, handles: true, labels: [['num14', 'c'], ['tag', 'x']] },
];
export const CRATE_VARIANTS = VARIANTS.length;
/** Named variants accepted wherever a crate variant is: crate(64, 'cs2'). */
export const CRATE_NAMES = { classic: 0, diag: 1, xbrace: 2, plain: 3, cs2: 4, cs2grey: 5 };

/**
 * Build crate geometry into builder pb. size: number | [sx, sy, sz]. Crate occupies
 * x,z ∈ [-s/2, s/2], y ∈ [0, sy].
 */
export function buildCrate(pb, size = 64, variant = 0, opts = {}) {
  const [sx, sy, sz] = Array.isArray(size) ? size : [size, size, size];
  if (typeof variant === 'string') variant = CRATE_NAMES[variant] ?? 0;
  const V = { ...VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length], ...opts };
  if (V.style === 'panel') return buildPanelCrate(pb, [sx, sy, sz], V);
  const r = pb.rand;
  const S = Math.min(sx, sy, sz);
  const fw = clamp(S * 0.13, 3.2, 12) * (V.fwScale ?? 1); // frame board width
  const ft = clamp(S * 0.028, 0.9, 2.4);      // frame thickness (proud of planks)
  const pt = clamp(S * 0.022, 0.7, 1.8);      // plank thickness
  const gap = V.gap ?? clamp(S * 0.007, 0.22, 0.7);
  const tint = V.tint;
  const frameTint = V.frameTint || [tint[0] * 0.93, tint[1] * 0.92, tint[2] * 0.9];
  const W = V.mat || 'wood:crate';

  const faces = [
    { k: '+z', o: [0, sy / 2, sz / 2], r: [1, 0, 0], u: [0, 1, 0], n: [0, 0, 1], w: sx, h: sy, ix: 0, iy: 0 },
    { k: '-z', o: [0, sy / 2, -sz / 2], r: [-1, 0, 0], u: [0, 1, 0], n: [0, 0, -1], w: sx, h: sy, ix: 0, iy: 0 },
    { k: '+x', o: [sx / 2, sy / 2, 0], r: [0, 0, -1], u: [0, 1, 0], n: [1, 0, 0], w: sz, h: sy, ix: ft, iy: 0 },
    { k: '-x', o: [-sx / 2, sy / 2, 0], r: [0, 0, 1], u: [0, 1, 0], n: [-1, 0, 0], w: sz, h: sy, ix: ft, iy: 0 },
    { k: '+y', o: [0, sy, 0], r: [1, 0, 0], u: [0, 0, -1], n: [0, 1, 0], w: sx, h: sz, ix: ft, iy: ft, top: true },
  ];

  const labelsTodo = V.noLabels ? [] : V.labels.slice();
  let labelFace = 0;
  for (const F of faces) {
    const M = frame(F.o, F.r, F.u, F.n);
    const hw = F.w / 2, hh = F.h / 2, ix = F.ix, iy = F.iy;
    // ---- planks (recessed layer) ----
    const pz = -ft - pt;
    const lo = ft + pt; // keep plank ends clear of neighbouring faces
    const vertical = V.planks === 'v' && !F.top;
    const span0 = vertical ? -hw + lo : -hh + lo, span1 = vertical ? hw - lo : hh - lo;
    const len0 = vertical ? -hh + lo * (F.top ? 1 : 0) : -hw + lo, len1 = vertical ? hh - lo : hw - lo;
    const target = V.plankW ?? clamp(S * 0.16, 4.5, 11);
    const n = Math.max(target > 100 ? 1 : 2, Math.round((span1 - span0) / target)); // plankW ≥ 100 → one plywood sheet
    const ws = []; let tot = 0;
    for (let i = 0; i < n; i++) { const w = r.f(0.8, 1.2); ws.push(w); tot += w; }
    const avail = span1 - span0 - gap * (n - 1);
    let c = span0;
    const planks = [];
    for (let i = 0; i < n; i++) {
      const w = (ws[i] / tot) * avail;
      const a = c, b = c + w; c = b + gap;
      const pts = vertical ? rect(a, len0, b, len1) : rect(len0, a, len1, b);
      board(pb, W, pts, pz, pt, M, { angle: vertical ? Math.PI / 2 : 0, tint, chamfer: Math.min(0.3, pt * 0.35), back: false, cap: false, vary: V.vary ?? 0.09 });
      planks.push({ a, b });
    }
    // ---- frame (proud layer) ----
    const fz = -ft, bw = fw, fo = { tint: frameTint, chamfer: Math.min(0.55, ft * 0.35), vary: Math.min(0.05, V.vary ?? 0.05), back: false };
    const x0 = -hw + ix, x1 = hw - ix, y0 = -hh + iy, y1 = hh - iy;
    board(pb, W, rect(x0, y0, x0 + bw, y1), fz, ft, M, { ...fo, angle: Math.PI / 2 });
    board(pb, W, rect(x1 - bw, y0, x1, y1), fz, ft, M, { ...fo, angle: Math.PI / 2 });
    board(pb, W, rect(x0 + bw, y0, x1 - bw, y0 + bw), fz, ft, M, fo);
    board(pb, W, rect(x0 + bw, y1 - bw, x1 - bw, y1), fz, ft, M, fo);
    const ox0 = x0 + bw, ox1 = x1 - bw, oy0 = y0 + bw, oy1 = y1 - bw;
    const open = rect(ox0, oy0, ox1, oy1);
    const panel = F.top ? (V.panel === 'cross' || V.panel === 'plain' ? 'none' : 'mid') : V.panel;
    const flip = (F.k === '-z' || F.k === '+x') ? -1 : 1;
    const bb = fw * 0.82;
    let freeZones = [];
    if (panel === 'cross') {
      const m = bb * 0.85;
      board(pb, W, rect(-m / 2, oy0, m / 2, oy1), fz, ft, M, { ...fo, angle: Math.PI / 2 });
      board(pb, W, rect(ox0, -m / 2, -m / 2, m / 2), fz, ft, M, fo);
      board(pb, W, rect(m / 2, -m / 2, ox1, m / 2), fz, ft, M, fo);
      const qw = (ox1 - ox0 - m) / 2, qh = (oy1 - oy0 - m) / 2;
      freeZones = { ul: [ox0 + qw / 2, oy1 - qh / 2, qw, qh], lr: [ox1 - qw / 2, oy0 + qh / 2, qw, qh], ur: [ox1 - qw / 2, oy1 - qh / 2, qw, qh], c: [ox0 + qw / 2, oy0 + qh / 2, qw, qh] };
    } else if (panel === 'diag' || panel === 'x') {
      const p0 = flip > 0 ? [ox0, oy0] : [ox1, oy0], p1 = flip > 0 ? [ox1, oy1] : [ox0, oy1];
      const angA = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      board(pb, W, bandPoly(p0, p1, bb, open), fz, ft, M, { ...fo, angle: angA });
      if (panel === 'x') {
        const q0 = [p1[0], p0[1]], q1 = [p0[0], p1[1]];
        const angB = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
        const band = bandPoly(q0, q1, bb * 0.9, open);
        for (const s of [-1, 1]) {
          const piece = clipOutsideBand(band, p0, p1, bb + 0.2, s);
          if (piece.length >= 3) board(pb, W, piece, fz + 0.05, ft - 0.05, M, { ...fo, angle: angB });
        }
        const pw = ox1 - ox0, ph = oy1 - oy0;
        freeZones = { top: [0, oy1 - ph * 0.17, pw * 0.34, ph * 0.2], c: [0, oy1 - ph * 0.17, pw * 0.34, ph * 0.2] };
      } else {
        const pw = ox1 - ox0, ph = oy1 - oy0;
        // triangles off the brace: upper-left / lower-right (mirrored when flipped)
        freeZones = {
          ul: [flip > 0 ? ox0 + pw * 0.27 : ox1 - pw * 0.27, oy1 - ph * 0.24, pw * 0.4, ph * 0.3],
          lr: [flip > 0 ? ox1 - pw * 0.27 : ox0 + pw * 0.27, oy0 + ph * 0.24, pw * 0.4, ph * 0.3],
        };
        freeZones.c = freeZones.ul;
      }
    } else if (panel === 'mid') {
      const m = bb * 0.85;
      board(pb, W, rect(ox0, -m / 2, ox1, m / 2), fz, ft, M, fo);
    } else if (panel === 'plain') {
      const pw = ox1 - ox0, ph = oy1 - oy0;
      freeZones = { c: [0, 0, pw * 0.72, ph * 0.5] };
    }
    // ---- stencils on the first two side faces ----
    if (!F.top && labelsTodo.length && (F.k === '+z' || F.k === '+x') && freeZones) {
      const lab = labelsTodo.shift();
      const z = freeZones[lab[1]] || freeZones.c;
      if (z) addLabel(pb, lab[0], z, planks, vertical, pz + pt + 0.04, M, r);
      if (labelsTodo.length && F.k === '+z' && lab[1] !== 'top') {
        const lab2 = labelsTodo.shift();
        const z2 = freeZones[lab2[1]];
        if (z2) addLabel(pb, lab2[0], z2, planks, vertical, pz + pt + 0.04, M, r);
      }
      labelFace++;
    }
    // ---- corner caps ----
    if (V.caps && S >= 28) addCaps(pb, F, M, fw, S);
    // ---- steel bands ----
    if (V.bands && !F.top) {
      const bt = 0.16, bh = clamp(S * 0.028, 1.2, 2.2);
      for (const fy of V.bandY || [0.26, 0.74]) {
        const yc = -hh + F.h * fy;
        const ext = F.k === '+z' || F.k === '-z' ? bt : 0;
        const g = slab(rect(-hw - ext, yc - bh / 2, hw + ext, yc + bh / 2), bt, 0.05, false);
        paint(g, V.bandTint || [0.6, 0.58, 0.55]);
        pb.add('galv', g, M);
        // band clips/nails
        for (const fx of [-hw + fw * 0.5, hw - fw * 0.5]) {
          const d = dome(0.34, 0.22, 5); d.translate(fx, yc, bt); paint(d, [0.5, 0.47, 0.44]); pb.add('galv', d, M);
        }
      }
    }
  }
  // dark interior visible through plank gaps
  const ins = ft + pt + (V.innerInset ?? 0.02);
  const inner = slab(rect(-sx / 2 + ins, -sz / 2 + ins, sx / 2 - ins, sz / 2 - ins), sy - ins, 0, false);
  inner.rotateX(-Math.PI / 2);
  paint(inner, [0.1, 0.085, 0.07]);
  pb.add(W, inner);
  // weathering: dirt creeping up from the ground, bleached tops
  pb.weather((x, y, z, nx, ny) => lerp(0.62, 1, smooth(0, Math.min(14, sy * 0.3), y)) * (ny > 0.9 ? 1.05 : 1), ['label']);
  pb.box([-sx / 2, 0, -sz / 2], [sx / 2, sy, sz / 2], 'crate');
  return pb;
}

/**
 * CS2-style painted panel crate. Smooth sheet panels (no plank lines) recessed behind a grid
 * of proud battens; light steel plates at every batten junction, thin steel straps near top
 * and bottom, optional side handles. Materials: paint (panels + battens), galv, label.
 */
function buildPanelCrate(pb, [sx, sy, sz], V) {
  const r = pb.rand, S = Math.min(sx, sy, sz);
  const P = `paint:${V.paint || 'cratewhite'}:0.03`;
  const bt = clamp(S * 0.016, 0.6, 1.4);          // batten proud height
  const ew = clamp(S * 0.07, 2.2, 5.5);           // edge batten width
  const gw = ew * 0.72;                           // grid batten width
  const pt = 0.5;                                 // sheet thickness
  const faces = [
    { k: '+z', o: [0, sy / 2, sz / 2], r: [1, 0, 0], u: [0, 1, 0], n: [0, 0, 1], w: sx, h: sy, ix: 0, iy: 0 },
    { k: '-z', o: [0, sy / 2, -sz / 2], r: [-1, 0, 0], u: [0, 1, 0], n: [0, 0, -1], w: sx, h: sy, ix: 0, iy: 0 },
    { k: '+x', o: [sx / 2, sy / 2, 0], r: [0, 0, -1], u: [0, 1, 0], n: [1, 0, 0], w: sz, h: sy, ix: bt, iy: 0 },
    { k: '-x', o: [-sx / 2, sy / 2, 0], r: [0, 0, 1], u: [0, 1, 0], n: [-1, 0, 0], w: sz, h: sy, ix: bt, iy: 0 },
    { k: '+y', o: [0, sy, 0], r: [1, 0, 0], u: [0, 0, -1], n: [0, 1, 0], w: sx, h: sz, ix: bt, iy: bt, top: true },
  ];
  const labels = V.noLabels ? [] : V.labels.slice();
  const batten = (M, x0, y0, x1, y1, k = 1) => {
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return;
    const g = slab(rect(x0, y0, x1, y1), bt, Math.min(0.35, bt * 0.45), false);
    g.translate(0, 0, -bt);
    const t = r.f(1.0, 1.07) * k;
    pb.add(P, g, M, [t, t, t * 0.995]);
  };
  const plate = (M, cx, cy, s, rivets = false) => {
    const g = slab(rect(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2), 0.18, 0.06, false);
    pb.add('galv', g, M, [0.86, 0.86, 0.85]);
    if (rivets) for (const [dx, dy] of [[-0.28, -0.28], [0.28, 0.28]]) {
      const d = dome(Math.min(0.42, s * 0.09), 0.25, 5); d.translate(cx + dx * s, cy + dy * s, 0.18); pb.add('galv', d, M, [0.75, 0.75, 0.74]);
    }
  };
  for (const F of faces) {
    const M = frame(F.o, F.r, F.u, F.n);
    const hw = F.w / 2, hh = F.h / 2;
    const x0 = -hw + F.ix, x1 = hw - F.ix, y0 = -hh + F.iy, y1 = hh - F.iy;
    // the sheet: one smooth panel per face, recessed behind the battens
    const sheet = slab(rect(-hw + bt + 0.02, -hh + bt + 0.02, hw - bt - 0.02, hh - bt - 0.02), pt, 0.1, false);
    sheet.translate(0, 0, -bt - pt);
    pb.add(P, sheet, M, [1.07, 1.07, 1.06]);
    // perimeter battens (butt joints like a real box: ±z full width, ±x and top inset)
    batten(M, x0, y0, x0 + ew, y1); batten(M, x1 - ew, y0, x1, y1);
    batten(M, x0 + ew, y0, x1 - ew, y0 + ew); batten(M, x0 + ew, y1 - ew, x1 - ew, y1);
    const ox0 = x0 + ew, ox1 = x1 - ew, oy0 = y0 + ew, oy1 = y1 - ew;
    // grid: vertical battens continuous, horizontal ones butt between them
    const nc = V.grid && !F.top ? clamp(Math.round((ox1 - ox0) / 22), 2, 5) : 1;
    const nr = V.grid && !F.top ? clamp(Math.round((oy1 - oy0) / 30), 2, 4) : 1;
    const xs = [ox0 - ew / 2]; for (let i = 1; i < nc; i++) xs.push(lerp(ox0, ox1, i / nc)); xs.push(ox1 + ew / 2);
    const ys = [oy0 - ew / 2]; for (let j = 1; j < nr; j++) ys.push(lerp(oy0, oy1, j / nr)); ys.push(oy1 + ew / 2);
    for (let i = 1; i < nc; i++) batten(M, xs[i] - gw / 2, oy0, xs[i] + gw / 2, oy1, 0.98);
    for (let j = 1; j < nr; j++) for (let i = 0; i < nc; i++) {
      const a = i === 0 ? ox0 : xs[i] + gw / 2, b = i === nc - 1 ? ox1 : xs[i + 1] - gw / 2;
      batten(M, a, ys[j] - gw / 2, b, ys[j] + gw / 2, 0.98);
    }
    // junction plates where battens meet (rivets on the outer corners only)
    const ps = gw * 1.35;
    for (let i = 0; i <= nc; i++) for (let j = 0; j <= nr; j++) {
      const outer = (i === 0 || i === nc) && (j === 0 || j === nr);
      if (!outer && (i === 0 || i === nc) && (j === 0 || j === nr)) continue;
      if (!outer && !(i > 0 && i < nc) && !(j > 0 && j < nr)) continue;
      plate(M, xs[i], ys[j], outer ? ew * 1.3 : ps, outer);
    }
    // stencils in grid cells (z just in front of the sheet)
    if (!F.top && labels.length && (F.k === '+z' || F.k === '+x' || F.k === '-x')) {
      const cell = (ci, cj) => { const a = ci === 0 ? ox0 : xs[ci] + gw / 2, b = ci === nc - 1 ? ox1 : xs[ci + 1] - gw / 2, c = cj === 0 ? oy0 : ys[cj] + gw / 2, d = cj === nr - 1 ? oy1 : ys[cj + 1] - gw / 2; return [(a + b) / 2, (c + d) / 2, b - a, d - c]; };
      const zones = { ul: cell(0, nr - 1), lr: cell(nc - 1, 0), c: cell(Math.floor(nc / 2), Math.floor(nr / 2)), x: cell(nc - 1, nr - 1), x2: cell(0, 0) };
      const take = F.k === '+z' ? 2 : 1;
      for (let t = 0; t < take && labels.length; t++) {
        const lab = labels.shift();
        const z = zones[lab[1]] || zones.c;
        addLabel(pb, lab[0], [z[0], z[1], z[2] * 0.95, z[3] * 0.85], [{ a: -1e9, b: 1e9 }], false, -bt + 0.04, M, r);
      }
    }
    if (F.top) continue;
    // thin steel straps wrapping the crate near top and bottom
    const sh = clamp(S * 0.022, 1, 1.8), st = 0.14;
    for (const fy of [0.11, 0.89]) {
      const yc = -hh + F.h * fy, ext = F.k === '+z' || F.k === '-z' ? st : 0;
      const g = slab(rect(-hw - ext, yc - sh / 2, hw + ext, yc + sh / 2), st, 0.04, false);
      pb.add('galv', g, M, [0.72, 0.72, 0.72]);
    }
    // side handles (rope-style steel loops) on ±x faces
    if (V.handles && (F.k === '+x' || F.k === '-x') && S >= 30) {
      const hy = hh * 0.45, hl = Math.min(10, F.w * 0.22);
      plate(M, -hl / 2 - 1, hy, 2.6, true); plate(M, hl / 2 + 1, hy, 2.6, true);
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-hl / 2 - 1, hy, 0.3), new THREE.Vector3(-hl / 2, hy - 2.4, 1.6), new THREE.Vector3(hl / 2, hy - 2.4, 1.6), new THREE.Vector3(hl / 2 + 1, hy, 0.3)]);
      pb.add('galv', sweep(c, 10, 5, 0.42), M, [0.6, 0.6, 0.6]);
    }
  }
  // dark interior so a hairline between sheet and batten never shows sky
  const ins = bt + pt + 0.05;
  const inner = slab(rect(-sx / 2 + ins, -sz / 2 + ins, sx / 2 - ins, sz / 2 - ins), sy - ins, 0, false);
  inner.rotateX(-Math.PI / 2);
  pb.add(P, inner, null, [0.25, 0.25, 0.25]);
  // grime: ground dirt, grey run-off under each strap/top edge, slightly bleached top
  pb.weather((x, y, z, nx, ny) => {
    const g = lerp(0.6, 1, smooth(0, Math.min(16, sy * 0.3), y)) * lerp(0.9, 1, smooth(sy - 4, sy * 0.7, y));
    return [g * (ny > 0.9 ? 1.03 : 1), g * (ny > 0.9 ? 1.03 : 1), g * 0.985];
  }, ['label']);
  pb.box([-sx / 2, 0, -sz / 2], [sx / 2, sy, sz / 2], 'crate');
  return pb;
}

// Stencil decal split across planks so paint never bridges a gap.
function addLabel(pb, name, zone, planks, vertical, z, M, r) {
  const [cx, cy, zw, zh] = zone;
  const aspect = 2; // cells are 2:1
  let w = zw * 0.92, h = w / aspect;
  if (h > zh * 0.92) { h = zh * 0.92; w = h * aspect; }
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  const uv = labelUV(name);
  const pos = [], uvs = [];
  const quad = (a0, b0, a1, b1) => {
    const U = (x) => uv.u0 + ((x - x0) / (x1 - x0)) * (uv.u1 - uv.u0);
    const Vv = (y) => uv.v0 + ((y - y0) / (y1 - y0)) * (uv.v1 - uv.v0);
    pos.push(a0, b0, z, a1, b0, z, a1, b1, z, a0, b0, z, a1, b1, z, a0, b1, z);
    uvs.push(U(a0), Vv(b0), U(a1), Vv(b0), U(a1), Vv(b1), U(a0), Vv(b0), U(a1), Vv(b1), U(a0), Vv(b1));
  };
  for (const p of planks) {
    if (vertical) { const a = Math.max(x0, p.a + 0.15), b = Math.min(x1, p.b - 0.15); if (b > a) quad(a, y0, b, y1); }
    else { const a = Math.max(y0, p.a + 0.15), b = Math.min(y1, p.b - 0.15); if (b > a) quad(x0, a, x1, b); }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const k = r.f(0.85, 1);
  paint(g, [k, k, k]);
  pb.add('label', g, M);
}

// Bent-sheet corner protectors on the 4 corners of a face, with rivets.
function addCaps(pb, F, M, fw, S) {
  const c = clamp(fw * 0.95, 3.5, 11), mt = 0.22;
  const hw = F.w / 2, hh = F.h / 2;
  const primary = F.k === '+z' || F.k === '-z';
  for (const sxn of [-1, 1]) for (const syn of [-1, 1]) {
    const ex = primary || F.top ? mt : 0; // wrap over the neighbouring face's plate
    const ey = F.top ? mt : 0;
    const cx = sxn * (hw + ex), cy = syn * (hh + ey);
    // pentagon: square with the inner corner cut off
    const k = 0.5;
    const local = [[0, 0], [c + ex, 0], [c + ex, c * k], [c * k, c + ey], [0, c + ey]];
    const pts = local.map(([u, v]) => [cx - sxn * u, cy - syn * v]);
    const g = slab(pts, mt, 0.07, false);
    paint(g, [0.78, 0.77, 0.75]);
    pb.add('galv', g, M);
    for (const [u, v] of [[c * 0.3, c * 0.3], [c * 0.78, c * 0.22], [c * 0.22, c * 0.78]]) {
      const d = dome(Math.min(0.55, c * 0.06), Math.min(0.35, c * 0.04), 6);
      d.translate(cx - sxn * u, cy - syn * v, mt);
      paint(d, [0.66, 0.64, 0.6]);
      pb.add('galv', d, M);
    }
  }
}

/** Standalone crate prop. */
export function crateProp(size = 64, variant = 0, opts = {}) {
  const key = `crate:${JSON.stringify(size)}:${variant}:${opts.seed ?? 0}`;
  const pb = new PropBuilder(key, key);
  buildCrate(pb, size, variant, opts);
  return pb.finish();
}
