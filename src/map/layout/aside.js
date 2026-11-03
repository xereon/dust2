// A side + CT: CT spawn, the underpass below short, short (the bridge up from the short
// stairs), A site with its retaining walls, the steps to the back platform, the A ramp, the
// ramp from CT spawn up to long ("under A"), long A, pit, side pit, the long hall, long doors
// and outside long.
import { zx, zy, zc } from './util.js';

const KERB = { h: 8, out: 12, mat: 'curb_redwhite' };
// raised sidewalk along the street walls: paved top, red/white kerb on its edge, lane line beside it
const WALK = { h: 8, out: 70, mat: 'concrete_floor', redMat: 'concrete_floor#curbred', redSide: [1, 0], topMat: 'paving_setts', walk: true, line: 26 };

export function build(K) {
  const ochre = { h: 56, mat: 'plaster_white#mustard' };
  const teal = { h: 52, mat: 'plaster_white#teal' };
  const white = { h: 36, mat: 'plaster_wall#dark' };

  // ---- CT spawn and the underpass below short ------------------------------------------------
  K.region('ct_spawn', zc([
    [-316, 1977], [-7, 1977], [96, 2040], [234, 2041], [234, 2087], [250, 2087], [250, 2574], [37, 2574],
    [37, 2399], [-43, 2318], [-316, 2318],
  ], -126), { mat: 'paving_setts', top: 210, tops: { 6: 230, 7: 200, 8: 200, 9: 200 }, paint: teal, cornice: {} });
  K.region('ct_under', zc([[275, 2041], [489, 2041], [489, 2556], [250, 2556], [250, 2087], [275, 2087]], -122),
    { mat: 'concrete_floor', ceil: 36, ceilTop: 96, roof: false, ceilMat: 'wood_planks', beams: { dir: 'x', step: 64 }, headerMat: 'stone_wall', paint: white });
  K.region('ct_under_mouth', zc([[489, 2042], [513, 2042], [513, 2404], [489, 2404]], -122),
    { mat: 'concrete_floor', arch: { spring: -40, crown: 36 }, ceilTop: 96, roof: false, wallMat: 'stone_wall', paint: white });

  // ---- short: bridge from the short stairs over the underpass to A --------------------------------
  K.region('short_br', zc([
    [239, 1800], [395, 1800], [395, 1760], [513, 1760], [513, 2042], [513, 2404], [513, 2420], [250, 2420], [250, 2087], [275, 2087], [275, 1922], [239, 1922],
  ], 96), { mat: 'paving_setts', bottom: 36, top: 380, tops: { 5: 128 }, paint: ochre, cornice: {} });
  K.slab([250, 2087], [250, 2574], 96, 132, 12, 'plaster_wall', { side: 'left' });
  K.slab([513, 2404], [513, 2042], 96, 124, 14, 'plaster_wall', { side: 'left' });

  // ---- A site plateau (z 96) with its low retaining walls ---------------------------------------
  K.region('a_main', zc([
    [250, 2420], [513, 2420], [1040, 2420], [1040, 2330], [1245, 2330], [1245, 2780], [1001, 2780], [1001, 2794],
    [238, 2794], [238, 2718], [274, 2718], [274, 2574], [250, 2574],
  ], 96), { mat: 'flagstone', bottom: 36, top: 400, tops: { 1: 128, 2: 128, 3: 128, 4: 128, 6: 206, 7: 206 }, paint: ochre, cornice: {} });
  K.stairs('a_steps', [[1001, 2780], [1245, 2780], [1245, 2830], [1001, 2830]], 96, 120, 3, { mat: 'stone_block', tops: { e: 128, w: 210 } });
  K.region('a_north', zc([[1001, 2830], [1245, 2830], [1245, 2790], [1265, 2790], [1598, 2790], [1598, 3089], [1001, 3089]], 120),
    { mat: 'flagstone', top: 420, tops: { 1: 128, 2: 128, 4: 480, 5: 232, 6: 232 }, paint: ochre, cornice: {}, windows: 'arched' });
  K.region('aramp', zy([[1265, 2297], [1629, 2297], [1629, 2790], [1265, 2790]], 2297, -2, 2790, 112),
    { base: KERB, mat: 'asphalt', top: 420, tops: { w: 128 }, paint: teal, cornice: {} });

  // ---- under A: ramp from the underpass up to the top of long ------------------------------------
  K.region('undera_m', zx([[513, 2042], [540, 2042], [540, 2096], [900, 2096], [900, 2006], [960, 2006], [960, 2404], [513, 2404]], 540, -122, 960, 0),
    { mat: 'stone_block', top: 300, tops: { 6: 128 }, paint: white, cornice: {} });
  // steps climbing beside the ramp along its south wall
  K.stairs('undera_st', [[540, 2096], [540, 2042], [900, 2042], [900, 2096]], -122, -17.4, 9, { mat: 'stone_block', top: 300 });
  // timber post-and-beam frame in the underpass
  for (const [x, y] of [[290, 2050], [390, 2050], [478, 2050], [262, 2546], [390, 2546], [478, 2546], [262, 2100], [262, 2320]])
    K.box([x - 5, y - 5, -122], [x + 5, y + 5, 36], 'wood_planks', { color: 0.72 });
  K.box([484, 2042, 22], [492, 2404, 36], 'wood_planks', { col: false, color: 0.7 });
  K.region('undera_e', zc([[960, 2006], [1228, 2006], [1228, 2314], [1024, 2314], [1024, 2404], [960, 2404]], 0),
    { mat: 'concrete_floor', top: 300, tops: { 2: 128, 3: 128, 4: 128 }, paint: teal, cornice: {} });

  // ---- long A ---------------------------------------------------------------------------------
  K.region('longa_n', zc([
    [1228, 1833], [1806, 1833], [1806, 2069], [1800, 2099], [1800, 2145], [1793, 2156], [1793, 2262], [1785, 2297],
    [1629, 2297], [1265, 2297], [1265, 2314], [1228, 2314],
  ], -2), { base: WALK, mat: 'asphalt', top: 330, tops: { 10: 128, 11: 128 }, paint: teal, cornice: {} });
  K.region('longa_m', zc([
    [1228, 1230], [1598, 1230], [1598, 1397], [1612, 1412], [1612, 1668], [1673, 1784], [1729, 1784], [1729, 1833],
    [1228, 1833], [1228, 1806], [1210, 1801], [1210, 1537], [1228, 1532],
  ], -4), { base: WALK, mat: 'asphalt', top: 330, paint: teal, cornice: {} });
  K.region('longhall', zc([
    [482, 784], [883, 784], [936, 731], [936, 810], [1245, 810], [1262, 810], [1588, 810], [1600, 810],
    [1790, 810], [1790, 1042], [1754, 1047], [1719, 1047], [1708, 1054], [1622, 1054], [1598, 1060], [1598, 1230],
    [1228, 1230], [718, 1230], [701, 1224], [482, 1185],
  ], 0), { mat: 'asphalt', top: 320, tops: { 4: 32, 6: 80 }, paint: ochre, cornice: {} });

  // ---- pit, side pit, the raised strip beside the pit -------------------------------------------
  K.region('ld_ledge', zy([[936, 196], [1245, 196], [1245, 315], [1245, 810], [936, 810]], 196, 14, 810, 2),
    { mat: 'sand_floor', top: 300, tops: { 2: 32 }, paint: teal, cornice: {} });
  K.region('pit_floor', zy([[1262, 160], [1588, 160], [1588, 300], [1262, 300]], 160, -194, 300, -186),
    { mat: 'sand_floor', top: 300, paint: white });
  K.region('pit_ramp', zy([[1262, 300], [1588, 300], [1588, 318], [1588, 810], [1262, 810], [1262, 315]], 300, -186, 810, -4),
    { mat: 'sand_floor', top: 300, tops: { 2: 80, 4: 32 }, paint: white });
  K.region('side', zc([[1600, 287], [1790, 287], [1790, 690], [1600, 690]], 56),
    { mat: 'concrete_floor', top: 360, tops: { w: 80 }, paint: teal, cornice: {} });
  K.stairs('side_st', [[1600, 690], [1790, 690], [1790, 810], [1600, 810]], 56, 0, 7, { mat: 'stone_block', tops: { w: 80, e: 360 } });

  // ---- long doors ---------------------------------------------------------------------------------
  // roofed sandstone-block passage with arched doorways and a checker tile floor
  K.region('ld_corr', zc([[507, 314], [550, 314], [722, 314], [772, 314], [772, 746], [723, 746], [550, 746], [507, 746]], 0),
    { mat: 'stone_block', wallMat: 'stone_block', ceil: 274, ceilTop: 350, ceilMat: 'wood_planks', beams: { dir: 'x', step: 72 }, headerMat: 'stone_block', paint: null, base: { h: 10, out: 3, mat: 'stone_wall' } });
  // small diagonal tiles (green / terracotta / white) laid on the diagonal
  {
    const T = 8, h = T / Math.SQRT2;
    const cols = [[0.47, 0.63, 0.52], [0.8, 0.5, 0.4], [0.9, 0.88, 0.82]];
    for (let i = -60; i < 60; i++) for (let j = 0; j < 90; j++) {
      const cx = 507 + (i + j) * h, cy = 314 + (j - i) * h;
      if (cx - h < 509 || cx + h > 770 || cy - h < 316 || cy + h > 744) continue;
      const k = ((i % 3) + 3 + (j % 2) * 2) % 3;
      const c = cols[k], v = 0.94 + 0.06 * Math.sin(i * 7.1 + j * 3.3);
      K.poly('plaster_white#decal', [[cx, cy - h + 0.4, 0.1], [cx + h - 0.4, cy, 0.1], [cx, cy + h - 0.4, 0.1], [cx - h + 0.4, cy, 0.1]],
        { col: [c[0] * v, c[1] * v, c[2] * v], normal: [0, 0, 1] });
    }
  }
  K.region('ld_door1', zc([[550, 272], [722, 272], [722, 314], [550, 314]], 0),
    { mat: 'stone_block', wallMat: 'stone_block', arch: { spring: 132, crown: 226, pointed: true }, ceilTop: 350, archMat: 'stone_block' });
  K.region('ld_door2', zc([[550, 746], [723, 746], [723, 784], [550, 784]], 0),
    { mat: 'stone_block', wallMat: 'stone_block', arch: { spring: 132, crown: 226, pointed: true }, ceilTop: 350, archMat: 'stone_block' });

  // ---- outside long ---------------------------------------------------------------------------------
  K.region('olong', zc([
    [82, -400], [388, -400], [388, -382], [529, -382], [529, -417], [776, -417], [776, 272], [722, 272], [550, 272],
    [469, 272], [469, 287], [113, 287], [113, -233], [82, -238],
  ], 0), { mat: 'paving_setts', top: 330, tops: { 5: 100, 11: 260, 12: 260, 13: 260 }, wallMats: { 6: 'stone_block', 8: 'stone_block' }, paint: teal, cornice: {} });
}
