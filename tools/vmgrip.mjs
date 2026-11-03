#!/usr/bin/env node
// Offline grasp solver for viewmodel hands. For each weapon hand anchor it places the arm rig
// exactly like Viewmodel._place, then curls every finger joint (MCP -> PIP -> DIP, thumb too)
// until the segment touches the weapon mesh. Writes src/weapons/models/grips.js (fitted poses).
//
//   node --import ./tools/three-resolve.mjs tools/vmgrip.mjs [keys...]
import fs from 'node:fs';
import * as THREE from 'three';
import { buildWeaponModel } from '../src/weapons/models/index.js';
import { Arm, handQuat, POSES } from '../src/weapons/models/arms.js';

const PALM = new THREE.Vector3(0, -0.6, -2.0);
const OUT = new URL('../src/weapons/models/grips.js', import.meta.url);
const KEYS = process.argv.slice(2).length ? process.argv.slice(2) : ['ak47', 'm4a4', 'm4a1s', 'awp', 'ssg08', 'galil', 'sg553', 'famas', 'aug',
  'glock', 'usp', 'deagle', 'p250', 'fiveseven', 'tec9', 'mp9', 'mac10', 'mp5sd', 'ump45', 'p90', 'nova', 'xm1014', 'mag7', 'negev', 'm249',
  'g3sg1', 'scar20', 'knife_ct', 'knife_t'];
const ray = new THREE.Raycaster();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3(), _y = new THREE.Vector3();

function hits(meshes, from, to, r, bone) {
  // centre ray + rays offset to the palmar side and both palmar flanks of the segment
  _d.subVectors(to, from); const len = _d.length(); _d.normalize();
  _y.set(0, -1, 0).transformDirection(bone.matrixWorld);          // palmar
  const side = _a.set(1, 0, 0).transformDirection(bone.matrixWorld);
  for (const [py, px] of [[0, 0], [0.85, 0], [0.5, 0.7], [0.5, -0.7]]) {
    _o.copy(from).addScaledVector(_y, py * r).addScaledVector(side, px * r);
    ray.set(_o, _d); ray.near = 0; ray.far = len + r * 0.8;
    const h = ray.intersectObjects(meshes, false);
    if (h.length && h[0].distance > 0.02) return true;
  }
  return false;
}

function fit(key, side, anchor, hs, team) {
  const m = buildWeaponModel(key);
  m.root.updateMatrixWorld(true);
  const meshes = [];
  m.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; meshes.push(o); } });
  const left = side === 'L';
  const arm = new Arm(team, left);
  const mount = arm.mount;
  mount.scale.set(left ? -hs : hs, hs, hs);
  const q = handQuat(anchor.across, anchor.palm, left);
  mount.quaternion.copy(q);
  mount.position.copy(new THREE.Vector3(...anchor.p)).sub(PALM.clone().multiplyScalar(hs).applyQuaternion(q));
  const base = typeof anchor.pose === 'string' ? POSES[anchor.pose] : anchor.pose;
  const P = JSON.parse(JSON.stringify(base));
  const R = [[0.36, 0.32, 0.29], [0.37, 0.34, 0.3], [0.35, 0.32, 0.28], [0.31, 0.27, 0.25]];
  const L = [[1.6, 0.96, 0.78], [1.76, 1.08, 0.82], [1.66, 1.02, 0.8], [1.28, 0.78, 0.7]];
  const MAX = [95, 115, 75];
  const pos = (n) => new THREE.Vector3().setFromMatrixPosition(arm.byName[n].matrixWorld);
  const tip = (n, len) => new THREE.Vector3(0, 0, -len).applyMatrix4(arm.byName[n].matrixWorld);
  const apply = () => { arm.setPose(P); mount.updateMatrixWorld(true); };
  const trigger = side === 'R' && anchor.pose === 'trigger';
  // coupled curl: joints flex together (ratio), contact freezes the joints up to that segment
  const curl = (get, set, segs, radii, ratio, max, start, from = 0) => {
    const n = segs.length;
    for (let j = 0; j < n; j++) set(j, start[j]);
    apply();
    let first = 0;
    for (let it = 0; it < 120 && first < n; it++) {
      const prevv = []; for (let j = 0; j < n; j++) prevv.push(get(j));
      let moved = false;
      for (let j = first; j < n; j++) { const v = Math.min(max[j], get(j) + 2 * ratio[j]); if (v !== get(j)) moved = true; set(j, v); }
      if (!moved) break;
      apply();
      let hit = -1;
      for (let k = Math.max(first, from); k < n; k++) { const [a, b, bone] = segs[k](); if (hits(meshes, a, b, radii[k], bone)) { hit = k; break; } }
      if (hit >= 0) { for (let j = first; j < n; j++) set(j, prevv[j]); apply(); first = hit + 1; }
    }
  };
  for (let i = 0; i < 4; i++) {
    if (trigger && i === 0) continue;               // index stays on/along the trigger
    const segs = [0, 1, 2].map((j) => () => [pos(`f${i}${j}`), j < 2 ? pos(`f${i}${j + 1}`) : tip(`f${i}2`, L[i][2]), arm.byName[`f${i}${j}`]]);
    const gripHand = side === 'R' && (anchor.pose === 'trigger' || anchor.pose === 'grip');
    curl((j) => P.f[i][j], (j, v) => { P.f[i][j] = v; }, segs, R[i].map((r) => r * hs), [0.75, 1, 0.6], MAX, gripHand ? [35, 45, 20] : [Math.min(P.f[i][0], 5), 0, 0]);
  }
  const TL = [1.5, 1.18, 0.98];
  if (key.startsWith('knife')) { P.t = [[38, -8, 0], 28, 24]; apply(); } else {
  const tsegs = [0, 1, 2].map((j) => () => [pos(`t${j}`), j < 2 ? pos(`t${j + 1}`) : tip('t2', TL[2]), arm.byName[`t${j}`]]);
  curl((j) => (j === 0 ? P.t[0][0] : P.t[j]), (j, v) => { if (j === 0) P.t[0][0] = v; else P.t[j] = v; }, tsegs, [0.45, 0.4, 0.36].map((r) => r * hs),
    [0.5, 1, 0.8], [45, 70, 70], [Math.min(P.t[0][0], side === 'R' ? 10 : 0), 0, 0], 1);
  }
  const r1 = (v) => Math.round(v);
  return { f: P.f.map((f) => f.map(r1)), t: [P.t[0].map(r1), r1(P.t[1]), r1(P.t[2])] };
}

let prev = {};
try { prev = (await import(OUT.href + '?' + Date.now())).GRIPS || {}; } catch { /* first run */ }
const out = { ...prev };
for (const key of KEYS) {
  const m = buildWeaponModel(key);
  const H = m.cfg.hands || {};
  const hs = m.cfg.handScale || 1;
  const team = m.cfg.team || 'CT';
  for (const side of ['R', 'L']) {
    if (!H[side] || m.cfg.dual) continue;
    const t0 = Date.now();
    const pose = fit(key, side, H[side], hs, team);
    out[`${key}_${side}`] = pose;
    console.log(key, side, JSON.stringify(pose), `${Date.now() - t0}ms`);
  }
}
const body = Object.entries(out).sort().map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
fs.writeFileSync(OUT, `// GENERATED by tools/vmgrip.mjs — fitted finger poses (fingers curled until they touch the
// weapon mesh). Re-run after moving a hand anchor or changing a grip. Format = arms.js POSES.
export const GRIPS = {\n${body}\n};\n`);
console.log('wrote', OUT.pathname);
