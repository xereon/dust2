// Prop placement at the real Dust II spots (Source coordinates), read off the overview.
// Uses props.js factories when available and falls back to textured boxes so the map is
// always complete and always has the same collision footprint.

/** A crate: base centre pos, size number or [sx, sy, h], yaw deg. */
export function crate(K, pos, size = 64, yaw = 0, variant = 0) {
  const [sx, sy, sz] = Array.isArray(size) ? size : [size, size, size];
  K.prop('crate', [[sx, sz, sy], variant], pos, yaw, () => K.obox(pos, [sx, sy, sz], yaw, 'wood_crate'));
}
function tarpCrate(K, pos, size = 64, yaw = 0, color = 'teal', variant = 0) {
  const [sx, h, sy] = Array.isArray(size) ? size : [size, size, size];
  K.emitter('amb_tarp', [pos[0], pos[1], pos[2] + h], 700);
  K.prop('tarpCrate', [size, color, variant], pos, yaw, () => {
    K.obox(pos, [sx, sy, h], yaw, 'wood_crate');
    K.obox([pos[0], pos[1], pos[2] + h], [sx + 4, sy + 4, 3], yaw, 'cloth_tarp', { col: false });
  });
}

/** Sprayed bombsite marker (orange circle and cross) lying on a flat floor at z. */
const up = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a < 0 ? P.slice().reverse() : P; };

export function bombMark(K, [cx, cy], z, r = 44, rot = 20) {
  const mat = 'plaster_white#decal', col = [1.0, 0.36, 0.08], w = 5, N = 40, zz = z + 0.15;
  const a0 = rot * Math.PI / 180;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI, b = ((i + 1) / N) * 2 * Math.PI;
    const ri = r - w + 1.2 * Math.sin(i * 1.7), ro = r + 1.4 * Math.sin(i * 2.3 + 1);
    K.poly(mat, up([[cx + ri * Math.cos(a), cy + ri * Math.sin(a), zz], [cx + ri * Math.cos(b), cy + ri * Math.sin(b), zz],
      [cx + ro * Math.cos(b), cy + ro * Math.sin(b), zz], [cx + ro * Math.cos(a), cy + ro * Math.sin(a), zz]]), { col, normal: [0, 0, 1] });
  }
  for (const k of [0, 1]) {
    const a = a0 + Math.PI / 4 + k * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), L = r * 0.92, t = w * 0.6;
    K.poly(mat, up([[cx - ux * L - uy * t, cy - uy * L + ux * t, zz + 0.05], [cx - ux * L + uy * t, cy - uy * L - ux * t, zz + 0.05],
      [cx + ux * L + uy * t, cy + uy * L - ux * t, zz + 0.05], [cx + ux * L - uy * t, cy + uy * L + ux * t, zz + 0.05]]), { col, normal: [0, 0, 1] });
  }
}

/** Irregular patch of a floor material laid over a flat floor at z (star-shaped, fan from the centre). */
export function floorPatch(K, mat, [cx, cy], z, r, seed = 1, n = 18) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const k = 0.72 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + seed * 2.3);
    P.push([cx + r * k * Math.cos(a), cy + r * k * Math.sin(a) * 0.85, z + 0.1]);
  }
  const C = [cx, cy, z + 0.1];
  for (let i = 0; i < n; i++) K.poly(mat + '#decal', up([C, P[i], P[(i + 1) % n]]), { col: 0.96, normal: [0, 0, 1] });
}

/** Faded site plaque (own design): cream board, big orange 'B', a heading bar and text lines. */
function siteSign(K, [x, y], z, [mx, my], k = 1) {
  const ux = -my, uy = mx;                         // along the wall (right when facing it from the site)
  const W = 60 * k, H = 84 * k;
  const P = (s, zz, off) => [x + ux * s + mx * off, y + uy * s + my * off, zz];
  const face = (pts, col, off) => {
    let Q = pts.map(([s, zz]) => P(s, zz, off));
    let nx = 0, ny = 0;
    for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); }
    if (nx * mx + ny * my < 0) Q = Q.reverse();
    K.poly('plaster_white#decal', Q, { col, normal: [mx, my, 0] });
  };
  const rect = (s0, z0, s1, z1, col, off = 1.2) => face([[s0, z0], [s1, z0], [s1, z1], [s0, z1]], col, off);
  rect(-W / 2 - 2 * k, z - 2 * k, W / 2 + 2 * k, z + H + 2 * k, [0.42, 0.36, 0.3], 0.8);
  rect(-W / 2, z, W / 2, z + H, [0.93, 0.89, 0.8]);
  const or = [0.86, 0.36, 0.2];
  // the letter B: stem + three bars + two bowls (rect approximations)
  const s0 = -W * 0.32, s1 = W * 0.18, zb = z + H * 0.36, zt = z + H * 0.9, t = 7 * k;
  rect(s0, zb, s0 + t, zt, or, 1.4);
  rect(s0, zt - t, s1 - 4 * k, zt, or, 1.4);
  rect(s0, (zb + zt) / 2 - t / 2, s1 - 2 * k, (zb + zt) / 2 + t / 2, or, 1.4);
  rect(s0, zb, s1 - 4 * k, zb + t, or, 1.4);
  rect(s1 - 6 * k, (zb + zt) / 2 + t / 2, s1 + 1 * k, zt - t, or, 1.4);
  rect(s1 - 4 * k, zb + t, s1 + 3 * k, (zb + zt) / 2 - t / 2, or, 1.4);
  // text lines
  for (let i = 0; i < 3; i++) rect(-W * 0.36, z + H * (0.22 - i * 0.07), W * (0.36 - i * 0.1), z + H * (0.22 - i * 0.07) + 2.4 * k, [0.3, 0.27, 0.24], 1.4);
}

/** Pillar of rough dressed stone blocks, courses of two or three blocks with ragged joints. */
function stonePillar(K, [cx, cy], z, [w, d], courses = 4, ch = 27) {
  for (let c = 0; c < courses; c++) {
    const n = c % 2 ? 2 : 3, z0 = z + c * ch, z1 = z0 + ch - 0.6;
    for (let i = 0; i < n; i++) {
      const x0 = cx - w / 2 + (w * i) / n, x1 = cx - w / 2 + (w * (i + 1)) / n;
      const j = ((c * 7 + i * 3) % 5) - 2;
      K.box([x0 + 0.4 + j * 0.4, cy - d / 2 - (j % 2), z0], [x1 - 0.4 + j * 0.3, cy + d / 2 + (j % 3) * 0.5, z1 - (i % 2) * 2], 'stone_block',
        { color: 0.86 + 0.04 * j, uvScale: 96 });
    }
  }
}

/** Corrugated metal sheet nailed to timber posts, from a to b (Source [x,y]) on floor z, height h. */
function corrugatedFence(K, a, b, z, h = 92, { posts = true, brace = true } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
  // galvanised sheet, both faces; ribbed metal texture turned so the corrugations run vertically
  const uv = (q) => [q[2] / 64, ((q[0] - a[0]) * ux + (q[1] - a[1]) * uy) / 64];
  const P = (s, o, zz) => [a[0] + ux * s + nx * o, a[1] + uy * s + ny * o, zz];
  const zt = z + h;
  K.poly('metal_door', [P(0, 0.8, z + 2), P(L, 0.8, z + 2), P(L, 0.8, zt), P(0, 0.8, zt)], { uv, col: 0.95, normal: [nx, ny, 0] });
  K.poly('metal_door', [P(L, -0.8, z + 2), P(0, -0.8, z + 2), P(0, -0.8, zt), P(L, -0.8, zt)], { uv, col: 0.85, normal: [-nx, -ny, 0] });
  K.colPrism([P(0, 2, 0), P(L, 2, 0), P(L, -2, 0), P(0, -2, 0)].map((q) => [q[0], q[1]]), z, zt, 'metal');
  if (posts) {
    const np = Math.max(2, Math.round(L / 52) + 1);
    for (let i = 0; i < np; i++) {
      const s = (i / (np - 1)) * (L - 8) + 4;
      const c = [a[0] + ux * s - nx * 5, a[1] + uy * s - ny * 5];
      K.obox([c[0], c[1], z], [6, 6, h + 6], Math.atan2(uy, ux) * 180 / Math.PI, 'wood_planks', { col: false, color: 0.75 });
    }
    // horizontal rails
    for (const zr of [z + 14, z + h - 14]) K.slab([a[0] - nx * 5, a[1] - ny * 5], [b[0] - nx * 5, b[1] - ny * 5], zr, zr + 6, 3, 'wood_planks', { col: false, color: 0.7 });
  }
  if (brace) {
    // diagonal timber brace across the sheet face (thin box rotated in the wall plane, approximated as a stepped run)
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const s0 = L * 0.15 + t0 * L * 0.7, s1 = L * 0.15 + t1 * L * 0.7;
      const zz0 = z + 8 + t0 * (h - 20), zz1 = z + 8 + t1 * (h - 20);
      const q0 = [a[0] + ux * s0 - nx * 6, a[1] + uy * s0 - ny * 6], q1 = [a[0] + ux * s1 - nx * 6, a[1] + uy * s1 - ny * 6];
      K.slab(q0, q1, Math.min(zz0, zz1), Math.max(zz0, zz1) + 7, 3, 'wood_planks', { col: false, color: 0.72 });
    }
  }
}
function barrel(K, pos, variant = 0, yaw = 0) {
  K.prop('barrel', [variant], pos, yaw, () => K.obox(pos, [22, 22, 35], yaw, 'metal_barrel'));
}
function car(K, pos, yaw, variant = 0) {
  K.prop('car', [variant], pos, yaw, () => {
    K.obox(pos, [160, 64, 30], yaw, 'metal_door', { color: 0.9 });
    K.obox([pos[0], pos[1], pos[2] + 30], [90, 58, 24], yaw, 'glass', { color: 0.8 });
  });
}
function metalCrate(K, pos, size, yaw, variant = 0) {
  const [sx, sy, sz] = size;
  K.prop('metalCrate', [[sx, sz, sy], variant], pos, yaw, () => K.obox(pos, [sx, sy, sz], yaw, 'metal_door'));
}
function palm(K, pos, h = 260, variant = 0, yaw = 0) {
  K.prop('palm', [h, variant], pos, yaw, () => K.obox(pos, [12, 12, h], yaw, 'wood_planks', { col: true }));
}
function prop(K, name, args, pos, yaw = 0, fallback = null) { K.prop(name, args, pos, yaw, fallback); }

/**
 * Door leaf: planked slab from hinge [x,y] toward tip [x,y], standing on z, height h.
 * Two ledges on one face so it reads as a boarded door, not a plank.
 */
export function leaf(K, hinge, tip, z, h = 128, t = 5, mat = 'wood_door') {
  K.slab(hinge, tip, z, z + h, t, mat, { color: 0.95 });
  const dx = tip[0] - hinge[0], dy = tip[1] - hinge[1], l = Math.hypot(dx, dy);
  const nx = dy / l, ny = -dx / l;
  const a = [hinge[0] + dx * 0.06 + nx * (t / 2 + 1), hinge[1] + dy * 0.06 + ny * (t / 2 + 1)];
  const b = [tip[0] - dx * 0.06 + nx * (t / 2 + 1), tip[1] - dy * 0.06 + ny * (t / 2 + 1)];
  for (const f of [0.18, 0.78]) K.slab(a, b, z + h * f, z + h * f + 7, 2.5, mat, { col: false, color: 0.8 });
}

export function build(K) {
  // ---------------------------------------------------------------- doors
  // long doors: outer pair (west leaf swung in, east leaf swung out) and the inner pair
  leaf(K, [553, 296], [621, 348], 0, 130);
  leaf(K, [719, 296], [646, 252], 0, 130);
  leaf(K, [553, 764], [620, 812], 0, 130);
  leaf(K, [720, 764], [655, 716], 0, 130);
  // mid doors: west leaf swung toward T, east leaf toward CT, the famous crack between them
  leaf(K, [-515, 1640], [-432, 1592], -128, 132);
  leaf(K, [-319, 1622], [-404, 1672], -128, 132);
  K.slab([-518, 1638], [-316, 1638], 10, 200, 20, 'plaster_wall');     // wall over the doors
  K.slab([-518, 1638], [-316, 1638], 4, 10, 26, 'wood_planks');        // timber lintel
  // B doors: one leaf pushed into the site, the other half-open across the frame
  leaf(K, [-1333, 2300], [-1392, 2226], 3, 136, 5, 'wood_door');
  leaf(K, [-1305, 2116], [-1343, 2198], 3, 136, 5, 'wood_door');

  // ---------------------------------------------------------------- T spawn
  crate(K, [-1946, -886, 128], [74, 170, 64]);
  crate(K, [-927, -659, 128], 60);
  crate(K, [-1013, -501, 128], [74, 200, 56], 0, 1);
  crate(K, [-1717, -270, 128], [74, 74, 36], 0, 2);
  crate(K, [-1680, -195, 128], [48, 48, 36], 20, 1);
  barrel(K, [-1545, -186, 128]); barrel(K, [-1520, -205, 128], 1);
  crate(K, [-1119, -173, 128], 47);
  barrel(K, [-978, -165, 128], 2); barrel(K, [-968, -190, 128]);
  car(K, [-1840, -960, 128], 90, 2);

  // ---------------------------------------------------------------- outside tunnels / T mid
  crate(K, [-1433, -74, 6], [61, 52, 64], 0, 1);
  crate(K, [-1408, 29, 6], [110, 64, 48], 50);
  crate(K, [-1838, 570, 32], [36, 40, 36], 18);
  crate(K, [-474, -150, 0], [64, 64, 64], 0, 3);
  crate(K, [-480, -80, 0], [48, 48, 48], 10, 1);
  crate(K, [-678, 228, 0], [28, 48, 40], 11);
  crate(K, [-217, 573, 0], [34, 64, 48]);
  crate(K, [-588, 670, 0], [72, 64, 64], 0, 2);
  crate(K, [-588, 720, 0], [48, 40, 48], 8);
  barrel(K, [-300, 610, 0]); barrel(K, [-276, 612, 0], 1);

  // ---------------------------------------------------------------- outside long / long doors / long
  car(K, [657, -44, 0], 105.9, 2);                                        // old yellow sedan
  // beyond the waist-high wall at the east end of outside long: palm, olive, a house
  K.clip([776, -417, 100], [800, 272, 420]);
  palm(K, [860, -300, 99], 280, 1);
  prop(K, 'plant', [1], [850, 80, 99], 30);
  K.box([900, -260, -40], [1120, -40, 300], 'plaster_white', { col: false, color: 0.9 });
  K.box([896, -264, 300], [1124, -36, 318], 'plaster_trim', { col: false, color: 0.95 });
  K.box([880, 20, -40], [1060, 190, 240], 'plaster_white', { col: false, color: 0.86 });
  crate(K, [162, -52, 0], [74, 74, 64], 0, 1);
  crate(K, [200, -40, 0], [64, 48, 48], 0, 2);
  crate(K, [142, 53, 0], 34);
  crate(K, [700, 690, 0], [64, 64, 64], 0, 0);                            // box stack in the doors corridor
  crate(K, [730, 628, 0], [48, 48, 48], 0, 2);
  crate(K, [676, 640, 0], [70, 36, 40], -35, 1);
  crate(K, [700, 690, 64], [48, 48, 36], 12, 3);
  barrel(K, [817, 817, 0], 2);
  metalCrate(K, [800, 1160, 0], [180, 120, 100], 0, 0);                   // "blue"
  crate(K, [930, 1180, 0], [60, 64, 64], 0, 1);
  crate(K, [1746, 1021, 0], [34, 64, 48]);
  car(K, [1682, 2034, -2], 90 + 15.9, 0);                                  // A car at the top of long
  barrel(K, [1293, 2841, 120]); barrel(K, [1337, 2845, 120], 1);

  // ---------------------------------------------------------------- A site
  tarpCrate(K, [1004, 2515, 96], 64, 8, 'teal', 4);
  tarpCrate(K, [1066, 2505, 96], 64, -6, 'teal', 4);
  tarpCrate(K, [1034, 2512, 160], 48, 30, 'teal', 4);
  tarpCrate(K, [1180, 2545, 96], 60, 0, 'teal', 4);
  crate(K, [606, 2746, 96], [64, 64, 64], 0, 4);
  crate(K, [668, 2746, 96], [40, 64, 64], 8, 5);
  crate(K, [710, 2746, 96], [64, 34, 40], 0, 4);
  for (const [x, y] of [[870, 2704], [825, 2710], [855, 2735], [853, 2770], [300, 2745], [330, 2770], [360, 2740], [280, 2770], [390, 2765]]) barrel(K, [x, y, 96], (x + y) % 3);
  barrel(K, [547, 2561, 96], 1); barrel(K, [520, 2603, 96], 2);
  crate(K, [459, 2005, 96], [64, 64, 36]);
  crate(K, [600, 2320, -101], [36, 74, 48], 0, 5);
  crate(K, [660, 2320, -82], [36, 74, 48], 0, 4);
  crate(K, [586, 2375, -105], [64, 34, 36], 7);
  crate(K, [459, 1395, 0], [72, 64, 64], 0, 5);

  // ---------------------------------------------------------------- mid
  tarpCrate(K, [-312, 1428, -125], [80, 97, 80], 0, 'olive', 0);         // xbox, under its green canvas
  crate(K, [-826, 1356, -112], [64, 64, 64], 0, 1);
  crate(K, [-1174, 1497, -112], [64, 64, 36], 0, 2);
  crate(K, [-1097, 1497, -112], [64, 64, 36], 6, 3);
  crate(K, [-1268, 1250, 32], [64, 64, 64], 0, 1);
  crate(K, [-1350, 1248, 32], [70, 34, 40]);
  crate(K, [-1804, 1285, 32], [70, 44, 48], 56);
  crate(K, [-2113, 1351, 32], [120, 128, 96], 0, 1);

  // ---------------------------------------------------------------- CT
  crate(K, [-111, 2022, -126], 64);
  crate(K, [-173, 2256, -126], [96, 96, 64], 0, 1);
  crate(K, [39, 2308, -126], [80, 80, 64], 45, 2);
  car(K, [-465, 2507, -96], 180 + 83.7 - 90, 1);                           // van/car at CT mid
  crate(K, [-1152, 2093, 3], [72, 36, 48], 82);
  crate(K, [-1090, 2106, -11], [64, 64, 64], 0, 2);
  crate(K, [-1083, 2658, 36], [38, 120, 110], 0, 1);                      // tall stack by the window ramp

  // ---------------------------------------------------------------- B
  crate(K, [-1600, 1712, 4], 64, 45, 1);
  crate(K, [-1820, 1833, 4], [64, 72, 64]);
  crate(K, [-1589, 1874, 4], [180, 70, 64], 29.4, 2);
  crate(K, [-1807, 2377, 4], [96, 96, 96], 0, 0);
  // plank-walled box on the west of the site (the "fence" cover), boards facing the site
  crate(K, [-1631, 2546, 4], [64, 120, 104], 0, 1);
  prop(K, 'plankFence', [120, 104], [-1598, 2546, 4], 90, null);
  // stone-block pillar with corrugated sheets nailed to posts in front of the window ledge
  stonePillar(K, [-1440, 2582], 4, [64, 40], 4);
  corrugatedFence(K, [-1450, 2556], [-1396, 2556], 4, 62, { brace: false });
  corrugatedFence(K, [-1404, 2588], [-1336, 2588], 4, 104);
  crate(K, [-1829, 2654, 32], [70, 36, 36], 45);
  crate(K, [-2058, 2856, 32], 60, 0, 3);
  crate(K, [-2060, 2482, 32], [34, 70, 36]);
  barrel(K, [-1361, 2344, 4]); barrel(K, [-1358, 2379, 4], 1);
  // the big timber gate in B's north wall and the tarp-covered pallets
  prop(K, 'bigDoorMetal', [150, 160, 0, { paint: 'brown' }], [-1620, 2895, 4], 0);
  siteSign(K, [-1334, 2440], 40, [-1, 0], 1.6);
  prop(K, 'tarp', [84, 64, 56, 'bluegrey'], [-1590, 2776, 4], 2);
  prop(K, 'tarp', [60, 52, 44, 'bluegrey'], [-1420, 2430, 4], -12);
  prop(K, 'stoneBlocks', [48, 40, 5], [-1690, 2600, 4], 0);
  prop(K, 'stoneBlocks', [48, 40, 4], [-1690, 2650, 4], 90);
  // bombsite markers
  bombMark(K, [-1545, 2645], 4, 54, 14);
  bombMark(K, [1118, 2462], 96, 44, -8);
  // B floor: dusty dirt with worn flagstone patches
  floorPatch(K, 'flagstone', [-1545, 2650], 4, 140, 1);
  floorPatch(K, 'flagstone', [-1430, 2380], 4, 110, 2);
  floorPatch(K, 'flagstone', [-1640, 2780], 4, 95, 3);
  floorPatch(K, 'flagstone', [-1560, 2200], 4, 120, 4);
  barrel(K, [-1774, 2786, 32], 2);
  car(K, [-1950, 3080, 32], 90, 0);
  // palms on the terrace behind A and in the T-spawn yard
  palm(K, [1090, 3030, 120], 300, 0); palm(K, [1470, 3040, 120], 260, 1); palm(K, [1320, 3060, 120], 330, 2);
  palm(K, [-2150, -1000, 128], 280, 1);
}
