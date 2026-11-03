// Layout helpers (Source coordinates). Polygons are [[x, y, z?], ...].
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Assign z by linear ramp along x between (xa, za) and (xb, zb), clamped. */
export const zx = (pts, xa, za, xb, zb) => pts.map(([x, y]) => [x, y, za + (zb - za) * clamp((x - xa) / (xb - xa), 0, 1)]);
/** Assign z by linear ramp along y between (ya, za) and (yb, zb), clamped. */
export const zy = (pts, ya, za, yb, zb) => pts.map(([x, y]) => [x, y, za + (zb - za) * clamp((y - ya) / (yb - ya), 0, 1)]);
export const zc = (pts, z) => pts.map(([x, y]) => [x, y, z]);

/**
 * Blind arch on a wall face: two pilasters and a semicircular ring standing `d` proud of the
 * wall, so the bay between them reads as an inset with lit reveals. Wall line a->b (Source
 * [x,y]), n = unit normal pointing into the room, floor z0, spring zs.
 */
export function blindArch(K, a, b, n, z0, zs, { d = 12, w = 10, mat = 'stone_block', col = 0.9 } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const P = (s, z, off) => [a[0] + ux * s + n[0] * off, a[1] + uy * s + n[1] * off, z];
  const orient = (Q, nn) => {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
    return nx * nn[0] + ny * nn[1] + nz * nn[2] < 0 ? Q.slice().reverse() : Q;
  };
  const face = (Q, nn, c = col) => K.poly(mat, orient(Q, nn), { col: c, normal: nn });
  const N3 = [n[0], n[1], 0], U3 = [ux, uy, 0];
  // pilasters (front + both reveals)
  for (const [s0, s1] of [[0, w], [L - w, L]]) {
    face([P(s0, z0, d), P(s1, z0, d), P(s1, zs, d), P(s0, zs, d)], N3);
    face([P(s0, z0, 0), P(s0, z0, d), P(s0, zs, d), P(s0, zs, 0)], [-ux, -uy, 0], col * 0.8);
    face([P(s1, z0, 0), P(s1, z0, d), P(s1, zs, d), P(s1, zs, 0)], U3, col * 0.8);
  }
  // ring
  const r0 = (L - 2 * w) / 2, r1 = r0 + w, cs = L / 2, K8 = 10;
  const ring = (r, t) => [cs - r * Math.cos(t), zs + r * Math.sin(t)];
  for (let i = 0; i < K8; i++) {
    const t0 = Math.PI * i / K8, t1 = Math.PI * (i + 1) / K8;
    const [ia, iz] = ring(r0, t0), [ib, jz] = ring(r0, t1), [oa, oz] = ring(r1, t0), [ob, pz] = ring(r1, t1);
    face([P(ia, iz, d), P(ib, jz, d), P(ob, pz, d), P(oa, oz, d)], N3);
    const tm = (t0 + t1) / 2;
    face([P(ia, iz, 0), P(ib, jz, 0), P(ib, jz, d), P(ia, iz, d)], [Math.cos(tm) * ux, Math.cos(tm) * uy, -Math.sin(tm)], col * 0.75);
    face([P(oa, oz, 0), P(ob, pz, 0), P(ob, pz, d), P(oa, oz, d)], [-Math.cos(tm) * ux, -Math.cos(tm) * uy, Math.sin(tm)], col * 0.95);
  }
}
