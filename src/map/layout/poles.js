// Timber utility poles along the main streets with sagging wires strung pole to pole (all
// wires in one merged mesh). Lines are authored in Source coordinates at street level, kept
// to the street edges so they never block a route.

// [x, y, floor z] per pole; consecutive poles in a line are wired together
const LINES = [
  // T spawn plateau and the road down to outside long (south side, ~60u off the walls)
  [[-1300, -1010, 128], [-750, -1002, 128], [-150, -1128, 48.6], [430, -963, 8]],
  // outside long (west side) to the long-doors front
  [[118, -300, 0], [130, 250, 0]],
  // long hall and up long A
  [[505, 1205, 0], [1050, 1212, 0], [1262, 1750, 4], [1772, 2250, 6]],
  // top mid and the mid lane (west side)
  [[-630, 600, 0], [-505, 1150, -97.5]],
  // catwalk to short
  [[190, 1340, 0], [500, 1740, 0]],
  // goose / A back plaza
  [[1030, 3070, 120], [1580, 2810, 120]],
  // CT spawn
  [[-300, 1995, -126], [235, 2560, -126]],
];

export function build(K) {
  const spans = [];
  let n = 0;
  for (const line of LINES) {
    let prev = null;
    for (let i = 0; i < line.length; i++) {
      const [x, y, z] = line[i];
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const yaw = dir * 180 / Math.PI + 90; // crossarm across the line, wires run along it
      const h = 290 + ((i * 37) % 3) * 20;
      const r = K.prop('utilityPole', [h], [x, y, z], yaw, () => K.obox([x, y, z], [11, 11, h], yaw, 'wood_planks', { color: 0.7 }));
      n++;
      const loc = r?.object?.userData?.wireAttach;
      if (!loc) { prev = null; continue; }
      const ca = Math.cos(yaw * Math.PI / 180), sa = Math.sin(yaw * Math.PI / 180);
      // local Three -> Source (x, -z, y), rotate by yaw, offset; then Source -> Three for wireSpans
      const W = loc.map(([lx, ly, lz]) => {
        const sx = lx, sy = -lz;
        const X = x + sx * ca - sy * sa, Y = y + sx * sa + sy * ca, Z = z + ly;
        return [X, Z, -Y];
      });
      if (prev) {
        const L = Math.hypot(W[0][0] - prev[0][0], W[0][2] - prev[0][2]);
        // pair insulators by side so wires don't cross between differently turned poles
        const d0 = Math.hypot(W[0][0] - prev[0][0], W[0][2] - prev[0][2]) + Math.hypot(W[3][0] - prev[3][0], W[3][2] - prev[3][2]);
        const d1 = Math.hypot(W[0][0] - prev[3][0], W[0][2] - prev[3][2]) + Math.hypot(W[3][0] - prev[0][0], W[3][2] - prev[0][2]);
        const map = d0 <= d1 ? [0, 1, 2, 3] : [3, 2, 1, 0];
        for (let k = 0; k < 4; k++) if (k !== 1 || L < 520) spans.push({ a: prev[map[k]], b: W[k], sag: 16 + L * 0.03 + k * 2 });
      }
      prev = W;
    }
  }
  if (spans.length) K.prop('wireSpans', [spans], [0, 0, 0], 0);
  K.poleStats = { poles: n, spans: spans.length };
}
