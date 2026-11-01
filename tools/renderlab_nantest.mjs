// Scan the built map for geometry that yields NaN in lighting (NaN positions, zero/NaN normals).
//   node --import ./tools/three-resolve.mjs tools/renderlab_nantest.mjs
import * as THREE from 'three';
globalThis.self ??= globalThis;
const { buildDust2 } = await import('../src/map/dust2.js');
const map = await buildDust2();
let bad = 0;
const src = new THREE.Vector3(), out = [];
map.root.updateMatrixWorld(true);
map.root.traverse((o) => {
  if (!o.isMesh) return;
  if (o.isInstancedMesh) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); const d = m.determinant(); if (!isFinite(d) || Math.abs(d) < 1e-9) out.push(`instanced ${o.name} [${o.material?.name}] instance ${i} det=${d}`); }
  }
  const g = o.geometry, p = g.attributes.position, n = g.attributes.normal;
  let nanP = 0, zeroN = 0, nanN = 0, first = -1;
  for (let i = 0; i < p.count; i++) {
    if (!isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) nanP++;
    if (n) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = x * x + y * y + z * z;
      if (!isFinite(l)) { nanN++; if (first < 0) first = i; }
      else if (l < 1e-8) { zeroN++; if (first < 0) first = i; }
    }
  }
  const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name).join(',');
  if (nanP || zeroN || nanN || (!n && o.material && !o.material.flatShading)) {
    bad++;
    if (first >= 0) src.fromBufferAttribute(p, first).applyMatrix4(o.matrixWorld); else src.set(NaN, NaN, NaN);
    out.push(`${o.name || '(mesh)'} [${mats}] verts=${p.count} nanPos=${nanP} zeroN=${zeroN} nanN=${nanN} noNormals=${!n} ud=${JSON.stringify(o.userData).slice(0, 80)} at three(${src.x.toFixed(0)},${src.y.toFixed(0)},${src.z.toFixed(0)}) source(${src.x.toFixed(0)},${(-src.z).toFixed(0)},${src.y.toFixed(0)})`);
  }
});
console.log(out.slice(0, 40).join('\n'));
console.log(`meshes with problems: ${bad}`);
