// Geometry and materials for a mini loaf cake in its foil tray, the way Nadine's cake cart serves them:
// a sponge base, a row of piped star rosettes, then sprinkles or sparkles, then a drizzle.
// Everything is built in the tray's local space: the tray floor sits at y = 0, its long side runs along x.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

export const TRAY = { hx0: 0.088, hz0: 0.024, r0: 0.010, hx1: 0.099, hz1: 0.032, r1: 0.014, h: 0.038 };

import { BASES, FROSTINGS, TINTS, DRIZZLES } from './menu.js?v=6';
export { BASES, FROSTINGS, TINTS, TOPPINGS, DRIZZLES } from './menu.js?v=6';

const SPRINKLE_COLORS = [0xe8475f, 0xf6c445, 0x4fb3e8, 0x7ac36a, 0xf08ad0, 0xfdfbf7, 0x9b6fe0, 0xff8a3d];
const FLOWER_COLORS = [0xf58bb5, 0x86b7f0, 0xb48be8, 0xffa25c, 0xf7d74a, 0x9fd8a2];

// ------------------------------------------------------------------ small helpers
const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const smooth = (t) => t * t * (3 - 2 * t);

/** A grid surface. fn(u, v) -> [x, y, z]. Columns wrap when closedU. flip swaps the winding. */
function grid(cols, rows, fn, { closedU = true, flip = false, uvScale = [1, 1] } = {}) {
  const pos = [], uv = [], idx = [];
  const cu = closedU ? cols : cols + 1;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < cu; i++) {
      const u = i / cols, v = j / rows;
      pos.push(...fn(u, v, i, j));
      uv.push(u * uvScale[0], v * uvScale[1]);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const i1 = closedU ? (i + 1) % cols : i + 1;
      const a = j * cu + i, b = j * cu + i1, c = (j + 1) * cu + i, d = (j + 1) * cu + i1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Points around a rounded rectangle, the same count for any size so rings can be lofted. */
const RING = { long: 30, short: 8, corner: 12 };
const RING_N = 2 * RING.long + 2 * RING.short + 4 * RING.corner;
function ring(hx, hz, r) {
  const pts = [];
  const ex = hx - r, ez = hz - r;
  const line = (x0, z0, x1, z1, n, nx, nz) => {
    for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz, c: 0 }); }
  };
  const corner = (cx, cz, a0) => {
    for (let k = 0; k < RING.corner; k++) {
      const t = k / RING.corner, a = a0 + t * Math.PI / 2;
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a), c: Math.sin(t * Math.PI), ct: t });
    }
  };
  line(hx, -ez, hx, ez, RING.short, 1, 0); corner(ex, ez, 0);
  line(ex, hz, -ex, hz, RING.long, 0, 1); corner(-ex, ez, Math.PI / 2);
  line(-hx, ez, -hx, -ez, RING.short, -1, 0); corner(-ex, -ez, Math.PI);
  line(-ex, -hz, ex, -hz, RING.long, 0, -1); corner(ex, -ez, Math.PI * 1.5);
  return pts;
}
const lerp = (a, b, t) => a + (b - a) * t;
function trayRing(t) {
  return ring(lerp(TRAY.hx0, TRAY.hx1, t), lerp(TRAY.hz0, TRAY.hz1, t), lerp(TRAY.r0, TRAY.r1, t));
}

// ------------------------------------------------------------------ textures shared by every cake
let TEX = null;
export function loadCakeTextures(loader, aniso) {
  const t = (f, repeat = 1) => {
    const x = loader.load(f); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(repeat, repeat); x.anisotropy = aniso; return x;
  };
  TEX = {
    foilN: t('assets/3d/foil-normal.jpg'), foilR: t('assets/3d/foil-rough.jpg'),
    sponge: t('assets/3d/sponge-normal.jpg', 1), spongeColor: (() => { const c = t('assets/3d/sponge-color.jpg', 1); c.colorSpace = THREE.SRGBColorSpace; return c; })(), icing: t('assets/3d/icing-normal.jpg', 2),
  };
  return TEX;
}

// ------------------------------------------------------------------ foil tray
let trayGeo = null;
function buildTrayGeometry() {
  const { h } = TRAY;
  const rows = 12;
  const rings = [];
  for (let j = 0; j <= rows; j++) rings.push(trayRing(j / rows));
  // walls: pleated at the corners, as pressed foil trays are
  const wall = grid(RING_N, rows, (u, v, i, j) => {
    const p = rings[j][i];
    const pleat = p.c ? Math.sin(p.ct * Math.PI * 7) * 0.0011 * p.c * (0.25 + v) : 0;
    return [p.x + p.nx * pleat, v * h, p.z + p.nz * pleat];
  }, { uvScale: [7, 1] });
  // floor
  const floor = grid(RING_N, 6, (u, v, i) => {
    const p = rings[0][i], s = 1 - v;
    return [p.x * s, 0.0004, p.z * s];
  }, { flip: true, uvScale: [5, 1] });
  // flat flange, then a rolled edge
  const top = rings[rows];
  const flange = grid(RING_N, 2, (u, v, i) => {
    const p = top[i], o = v * 0.0055;
    return [p.x + p.nx * o, h + v * 0.0004, p.z + p.nz * o];
  }, { uvScale: [7, 0.2] });
  const roll = grid(RING_N, 10, (u, v, i) => {
    const p = top[i], a = v * Math.PI * 2, rr = 0.0019, o = 0.0068;
    const n = Math.cos(a) * rr;
    return [p.x + p.nx * (o + n), h + 0.0016 + Math.sin(a) * rr, p.z + p.nz * (o + n)];
  }, { uvScale: [7, 0.4] });
  return mergeGeometries([wall, floor, flange, roll]);
}

let foilMat = null;
function getFoil() {
  if (!foilMat) {
    foilMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.92, roughness: 1, roughnessMap: TEX.foilR,   // the map holds the real roughness (0.2 to 0.45)
      normalMap: TEX.foilN, normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide, envMapIntensity: 1.7,
    });
  }
  return foilMat;
}

// ------------------------------------------------------------------ sponge (only the domed top shows)
// The loaf rises above the foil rim and bulges over it a little, so the cake base shows all
// round the frosting, the way it does on the real mini cakes.
const LOAF_TOP = TRAY.h + 0.0088;   // the flat-ish top the frosting sits on
function spongeTopY(x, z) {
  const sx = x / (TRAY.hx1 - 0.004), sz = z / (TRAY.hz1 - 0.005);
  return LOAF_TOP + 0.0025 * Math.max(0, 1 - sx * sx) * Math.max(0, 1 - sz * sz);
}
// side profile from the inside of the tray wall up over the rim: [outward offset from the rim, height]
const LOAF_SIDE = [
  [-0.0008, TRAY.h - 0.006], [-0.0002, TRAY.h - 0.0005], [0.0012, TRAY.h + 0.0025],
  [0.0016, TRAY.h + 0.0045], [0.0008, TRAY.h + 0.0067], [-0.0015, TRAY.h + 0.0082], [-0.0045, LOAF_TOP],
];
function buildSpongeGeometry(seed) {
  const r = rand(seed);
  const sideRings = LOAF_SIDE.map(([d]) => ring(TRAY.hx1 + d, TRAY.hz1 + d, Math.max(0.002, TRAY.r1 + d)));
  const inner = sideRings[sideRings.length - 1];
  const topRows = 12, rows = LOAF_SIDE.length - 1 + topRows;
  const bumps = Array.from({ length: 9 }, () => [r() * 0.2 - 0.1, r() * 0.06 - 0.03, r() * Math.PI * 2]);
  const crumb = (x, z) => {
    let y = 0;
    for (const [bx, bz, ph] of bumps) y += 0.00035 * Math.sin(x * 160 + ph) * Math.cos(z * 140 + bx * 50 + bz) + 0.00012 * Math.sin(x * 900 + ph * 3) * Math.cos(z * 820 + bz);
    return y;
  };
  return grid(RING_N, rows, (u, v, i, j) => {
    if (j < LOAF_SIDE.length) {
      const p = sideRings[j][i];
      const wobble = j > 1 ? crumb(p.x, p.z) * 1.5 : 0;
      return [p.x + p.nx * wobble, LOAF_SIDE[j][1], p.z + p.nz * wobble];
    }
    const k = (j - LOAF_SIDE.length + 1) / topRows, sc = 1 - k;
    const p = inner[i];
    const x = p.x * sc, z = p.z * sc;
    return [x, spongeTopY(x, z) + crumb(x, z), z];
  }, { flip: false, uvScale: [6, 2] });
}

// ------------------------------------------------------------------ piped star rosettes
function rosetteGeometry(R, H, seed) {
  const r = rand(seed);
  const points = 8;
  const twist = 0.9 + r() * 0.5;
  const phase = r() * Math.PI * 2;
  const lean = [r() * 2 - 1, r() * 2 - 1];
  return grid(112, 30, (u, v) => {
    const th = u * Math.PI * 2;
    // a bulging, tapering swirl that closes to a soft curled tip
    let rad = R * Math.pow(Math.max(0, 1 - Math.pow(v, 1.5)), 0.62) * (1 + 0.16 * Math.sin(Math.PI * Math.min(1, v * 1.4)));
    const f = Math.cos(points * th + phase + twist * v * Math.PI * 2);
    const ridge = Math.sign(f) * Math.pow(Math.abs(f), 0.65);
    rad *= 1 + 0.17 * ridge * (1 - v * 0.6);
    const y = H * (v - 0.05 * Math.sin(v * Math.PI)) - 0.0012;
    const curl = Math.pow(v, 3) * R * 0.32;
    return [Math.cos(th) * rad + lean[0] * curl, y, Math.sin(th) * rad + lean[1] * curl];
  }, { uvScale: [3, 1] });
}

/** Where each rosette goes. 'row': one row of big stars. 'double': two staggered rows of smaller stars. */
function rosetteLayout(layout, seed) {
  const r = rand(seed + 11);
  const out = [];
  if (layout === 'double') {
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 8; k++) {
        const x = -0.077 + k * 0.022 + (row ? 0.011 : 0);
        if (x > 0.083) continue;
        out.push({ x, z: row ? -0.0135 : 0.0135, R: 0.0128 + r() * 0.0014, H: 0.019 + r() * 0.003 });
      }
    }
  } else {
    for (let k = 0; k < 7; k++) {
      out.push({ x: -0.078 + k * 0.026 + (r() - 0.5) * 0.002, z: (r() - 0.5) * 0.003, R: 0.0205 + r() * 0.002, H: 0.026 + r() * 0.004 });
    }
  }
  return out;
}

// ------------------------------------------------------------------ topping shapes (shared)
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const flower = (() => {
    const s = new THREE.Shape();
    const n = 5, R = 0.0058;
    for (let k = 0; k <= n * 16; k++) {
      const a = (k / (n * 16)) * Math.PI * 2;
      const rr = R * (0.55 + 0.45 * Math.abs(Math.cos(a * n / 2)));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0006, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const nut = (() => {
    const g = new THREE.DodecahedronGeometry(1, 0);
    const p = g.attributes.position, r = rand(5);
    const jit = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!jit.has(key)) jit.set(key, 0.7 + r() * 0.6);
      const k = jit.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    g.scale(0.0021, 0.0021, 0.0021);
    return g;
  })();
  const marsh = new THREE.LatheGeometry([
    [0, 0], [0.0036, 0], [0.0043, 0.0006], [0.0045, 0.0018], [0.0045, 0.0052], [0.0043, 0.0064], [0.0036, 0.007], [0, 0.0071],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  marsh.translate(0, -0.0035, 0);
  SHAPES = {
    rod: new THREE.CapsuleGeometry(0.00062, 0.0034, 2, 6),
    dot: new THREE.SphereGeometry(0.00078, 8, 6),
    glitter: (() => { const g = new THREE.CylinderGeometry(0.0014, 0.0014, 0.0003, 6); return g; })(),
    flake: (() => { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(0.0026, 0.00075, 0.0019); return g; })(),
    nut, marsh,
    ball: new THREE.SphereGeometry(0.0085, 32, 20),
    flower,
    center: new THREE.SphereGeometry(0.0017, 10, 8),
  };
  return SHAPES;
}

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
    candy: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffcf6e, metalness: 1, roughness: 0.08, envMapIntensity: 2.6, emissive: 0x8a5a14, emissiveIntensity: 0.6 }),
    choc: new THREE.MeshPhysicalMaterial({ color: 0x3e2216, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    nut: new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.78 }),
    marsh: new THREE.MeshPhysicalMaterial({ roughness: 0.82, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    ball: new THREE.MeshPhysicalMaterial({ color: 0x4a2617, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    sugar: new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf6cf3e, roughness: 0.5 }),
  };
  return MATS;
}

// ------------------------------------------------------------------ the cake
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _n = new THREE.Vector3(), _t = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const ray = new THREE.Raycaster();

/**
 * A cake in its tray. config: { base, frosting, tint, toppings: [], drizzle, layout, seed }.
 * update(config) swaps only what changed and animates the change in (sprinkles fall, drizzle pours).
 */
export class MiniCake {
  constructor(config, { animate = true } = {}) {
    this.group = new THREE.Group();
    this.animate = animate;
    this.anims = [];
    this.parts = {};
    const tray = new THREE.Mesh(trayGeo ||= buildTrayGeometry(), getFoil());
    tray.castShadow = tray.receiveShadow = true;
    this.group.add(tray);
    this.config = {};
    this.update({ layout: 'row', seed: 3, tint: 'natural', toppings: [], drizzle: 'none', ...config }, { instant: true });
  }

  update(next, { instant = false } = {}) {
    const prev = this.config;
    const cfg = { ...prev, ...next };
    this.config = cfg;
    const quick = instant || !this.animate;
    const shapeChanged = cfg.layout !== prev.layout || cfg.seed !== prev.seed;

    if (cfg.base !== prev.base || shapeChanged) this.#buildSponge(cfg, quick, prev.base !== undefined);
    if (cfg.frosting !== prev.frosting || cfg.tint !== prev.tint || shapeChanged) this.#buildFrosting(cfg, quick, shapeChanged || prev.frosting !== cfg.frosting);
    const topKey = (c) => (c.toppings || []).join(',');
    if (shapeChanged || topKey(cfg) !== topKey(prev)) this.#buildToppings(cfg, prev, quick, shapeChanged);
    if (shapeChanged || cfg.drizzle !== prev.drizzle) this.#buildDrizzle(cfg, quick);
  }

  #buildSponge(cfg, quick, fade) {
    const b = BASES[cfg.base];
    if (!this.parts.sponge) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: b.color, map: TEX.spongeColor, roughness: 0.94, normalMap: TEX.sponge, normalScale: new THREE.Vector2(2.2, 2.2),
        sheen: 0.35, sheenRoughness: 0.9, sheenColor: new THREE.Color(b.crumb),
      });
      this.parts.sponge = new THREE.Mesh(buildSpongeGeometry(cfg.seed), mat);
      this.parts.sponge.receiveShadow = true;
      this.group.add(this.parts.sponge);
      return;
    }
    const mat = this.parts.sponge.material;
    if (fade && !quick) this.#tweenColor(mat.color, b.color, 0.7), this.#tweenColor(mat.sheenColor, b.crumb, 0.7);
    else mat.color.set(b.color), mat.sheenColor.set(b.crumb);
  }

  #frostingColor(cfg) {
    const f = FROSTINGS[cfg.frosting];
    const tint = f.tintable && TINTS[cfg.tint]?.color;
    if (!tint) return new THREE.Color(f.color);
    return new THREE.Color(f.color).lerp(new THREE.Color(tint), 0.88);
  }

  #buildFrosting(cfg, quick, repipe) {
    const f = FROSTINGS[cfg.frosting];
    const color = this.#frostingColor(cfg);
    if (!this.parts.frosting) {
      this.parts.frosting = new THREE.Mesh(undefined, new THREE.MeshPhysicalMaterial({
        color, roughness: f.rough, normalMap: TEX.icing, normalScale: new THREE.Vector2(0.35, 0.35),
        sheen: 0.55, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xfff6ee), clearcoat: 0.12, clearcoatRoughness: 0.55,
      }));
      this.parts.frosting.castShadow = this.parts.frosting.receiveShadow = true;
      this.group.add(this.parts.frosting);
    }
    const mesh = this.parts.frosting;
    if (!mesh.geometry.attributes.position || repipe && (cfg.layout !== mesh.userData.layout || cfg.seed !== mesh.userData.seed)) {
      const spots = rosetteLayout(cfg.layout, cfg.seed);
      const geos = spots.map((s, k) => {
        const g = rosetteGeometry(s.R, s.H, cfg.seed * 31 + k);
        g.rotateY(k * 1.7);
        g.translate(s.x, spongeTopY(s.x, s.z), s.z);
        return g;
      });
      mesh.geometry.dispose();
      mesh.geometry = mergeGeometries(geos);
      mesh.geometry.computeBoundingBox();
      mesh.userData = { spots, layout: cfg.layout, seed: cfg.seed };
      // a detached copy for ray tests in tray space, whatever the cake's place in the scene
      this.probe = new THREE.Mesh(mesh.geometry);
      this.sampler = new MeshSurfaceSampler(mesh).build();
    }
    mesh.material.roughness = f.rough;
    if (quick) mesh.material.color.copy(color);
    else {
      this.#tweenColor(mesh.material.color, color, 0.6);
      if (repipe) this.#pop(mesh, 0.55);
    }
  }

  /** Height of the frosting (or sponge) at x, z in tray space. */
  surfaceAt(x, z) {
    ray.set(_p.set(x, 0.2, z), _t.set(0, -1, 0));
    const hit = ray.intersectObject(this.probe, false)[0];
    return hit ? { y: hit.point.y, n: hit.face.normal.clone() } : { y: spongeTopY(x, z), n: UP.clone() };
  }

  #buildToppings(cfg, prev, quick, rebuildAll) {
    const old = this.parts.toppings || {};
    const keep = {};
    const want = new Set(cfg.toppings);
    for (const [id, obj] of Object.entries(old)) {
      if (want.has(id) && !rebuildAll) keep[id] = obj;
      else this.#remove(obj, quick);
    }
    const count = cfg.toppings.length;
    for (const id of cfg.toppings) {
      if (keep[id]) continue;
      keep[id] = this.#makeTopping(id, cfg, count);
      this.group.add(keep[id]);
      if (!quick) this.#drop(keep[id]);
    }
    this.parts.toppings = keep;
  }

  #scatter(n, seed, minNy = 0.35) {
    const r = rand(seed);
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 20) {
      this.sampler.sample(_p, _n);
      if (_n.y < minNy || Math.abs(_p.x) > TRAY.hx1 - 0.006) continue;
      out.push({ p: _p.clone(), n: _n.clone(), r: r() });
    }
    return out;
  }

  #instanced(geo, mat, items, orient, colors) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const r = rand(items.length * 13 + 7);
    const targets = [];
    items.forEach((it, i) => {
      orient(it, r);
      _m.compose(_p.copy(it.pos), _q.copy(it.quat), _s.setScalar(it.scale ?? 1));
      mesh.setMatrixAt(i, _m);
      targets.push({ pos: it.pos.clone(), quat: it.quat.clone(), scale: it.scale ?? 1 });
      if (colors) mesh.setColorAt(i, new THREE.Color(colors[Math.floor(r() * colors.length)]));
    });
    mesh.userData.targets = targets;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  #makeTopping(id, cfg, count) {
    const S = shapes(), M = mats();
    const g = new THREE.Group();
    g.userData.id = id;
    const seed = cfg.seed * 97 + id.length * 7;
    // fewer of each when several are chosen, so the cake doesn't get buried
    const share = count > 1 ? 0.62 : 1;
    // lie flat along the surface in a random direction
    const lie = (it, r) => {
      it.pos = it.p.clone().addScaledVector(it.n, 0.0004);
      _t.set(r() - 0.5, 0, r() - 0.5).normalize();
      _t.addScaledVector(it.n, -_t.dot(it.n)).normalize();
      it.quat = new THREE.Quaternion().setFromUnitVectors(UP, _t);
      it.scale = 0.85 + r() * 0.3;
    };
    const sit = (sink) => (it, r) => {
      it.pos = it.p.clone().addScaledVector(it.n, sink);
      it.quat = new THREE.Quaternion().setFromUnitVectors(UP, it.n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * 6.3));
      it.scale = 0.8 + r() * 0.4;
    };
    const tumble = (it, r) => {
      it.pos = it.p.clone().addScaledVector(it.n, 0.0005);
      it.quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3));
      it.scale = 0.7 + r() * 0.6;
    };
    const spots = this.parts.frosting.userData.spots;
    const tops = spots.map((s) => {
      const hit = this.surfaceAt(s.x, s.z);
      return new THREE.Vector3(s.x, hit.y, s.z);
    });

    switch (id) {
      case 'rainbow':
        g.add(this.#instanced(S.rod, M.candy, this.#scatter(Math.round(320 * share), seed), lie, SPRINKLE_COLORS)); break;
      case 'hundreds':
        g.add(this.#instanced(S.dot, M.candy, this.#scatter(Math.round(650 * share), seed), sit(0.0004), SPRINKLE_COLORS)); break;
      case 'gold':
        g.add(this.#instanced(S.glitter, M.gold, this.#scatter(Math.round(280 * share), seed), tumble)); break;
      case 'shavings':
        g.add(this.#instanced(S.flake, M.choc, this.#scatter(Math.round(230 * share), seed, 0.25), tumble, [0x3e2216, 0x4b2a1b, 0x2f190f, 0x6a4129])); break;
      case 'nuts':
        g.add(this.#instanced(S.nut, M.nut, this.#scatter(Math.round(170 * share), seed, 0.3), tumble, [0xc89a62, 0xd8ae78, 0xb88752, 0xe2c08f])); break;
      case 'marshmallows': {
        // stood between the stars, the way they sit on the pink cakes
        const items = [];
        for (let k = 0; k < tops.length - 1; k++) {
          if (cfg.layout === 'double' && k % 2) continue;
          const x = (spots[k].x + spots[k + 1].x) / 2 + 0.002, z = (k % 2 ? 1 : -1) * 0.006;
          const hit = this.surfaceAt(x, z);
          items.push({ p: new THREE.Vector3(x, hit.y, z), n: hit.n.lerp(UP, 0.6).normalize() });
        }
        const pick = items.slice(0, Math.max(3, Math.round(items.length * (count > 2 ? 0.6 : 1))));
        g.add(this.#instanced(S.marsh, M.marsh, pick, (it, r) => {
          it.pos = it.p.clone().addScaledVector(it.n, 0.0016);
          it.quat = new THREE.Quaternion().setFromUnitVectors(UP, it.n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.45 + r() * 0.3)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * 6));
          it.scale = 0.95 + r() * 0.15;
        }, [0xfdfaf4, 0xfdfaf4, 0xf8d4de]));
        break;
      }
      case 'choc-balls': {
        const pick = [1, 3, 5].filter((k) => k < tops.length).map((k) => ({ p: tops[k], n: UP.clone() }));
        g.add(this.#instanced(S.ball, M.ball, pick, (it) => {
          it.pos = it.p.clone().add(new THREE.Vector3(0, 0.0012, 0)); it.quat = new THREE.Quaternion(); it.scale = 1;
        }));
        break;
      }
      case 'flowers': {
        const pick = tops.map((p) => ({ p, n: UP.clone() })).filter((_, k) => cfg.layout !== 'double' || k % 2 === 0);
        const orient = (it, r) => {
          it.pos = it.p.clone().add(new THREE.Vector3(0, -0.0012, 0));
          it.quat = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 6.3, (r() - 0.5) * 0.5));
          it.scale = 1.1 + r() * 0.3;
        };
        const petals = this.#instanced(S.flower, M.sugar, pick, orient, FLOWER_COLORS);
        const centers = this.#instanced(S.center, M.yellow, pick.map((it) => ({ ...it })), (it, r) => {
          orient(it, r); it.pos.y += 0.0013; it.scale = 1;
        });
        g.add(petals, centers);
        break;
      }
    }
    return g;
  }

  #buildDrizzle(cfg, quick) {
    if (this.parts.drizzle) this.#remove(this.parts.drizzle, quick);
    this.parts.drizzle = null;
    const d = DRIZZLES[cfg.drizzle];
    if (!d || !d.color) return;
    const r = rand(cfg.seed * 5 + 3);
    const pts = [];
    const crossings = 6.5, A = 0.024;
    for (let k = 0; k <= 260; k++) {
      const t = k / 260;
      const x = -0.086 + t * 0.172;
      const z = Math.sin(t * Math.PI * crossings + 0.4) * A * (0.9 + 0.1 * Math.sin(t * 9)) + (r() - 0.5) * 0.0008;
      const hit = this.surfaceAt(x, z);
      pts.push(new THREE.Vector3(x, hit.y + 0.0011, z));
    }
    // ease the line over peaks a little, like a thick sauce does
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 1; k < pts.length - 1; k++) pts[k].y = Math.max(pts[k].y, (pts[k - 1].y + pts[k + 1].y) / 2 - 0.0006);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = 520, radial = 10;
    const geo = new THREE.TubeGeometry(curve, segs, 0.0023, radial, false);
    // a drizzle is never one even thickness
    const pos = geo.attributes.position;
    for (let i = 0; i <= segs; i++) {
      const c = curve.getPointAt(i / segs);
      const k = 0.75 + 0.35 * Math.sin(i * 0.11 + 1.3) * Math.sin(i * 0.037) + 0.15 * Math.sin(i * 0.53);
      for (let j = 0; j <= radial; j++) {
        const v = i * (radial + 1) + j;
        _p.fromBufferAttribute(pos, v).sub(c);
        _p.y *= 0.72;   // slumps flat
        _p.multiplyScalar(k).add(c);
        pos.setXYZ(v, _p.x, _p.y, _p.z);
      }
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhysicalMaterial({
      color: d.color, roughness: d.rough, clearcoat: 1, clearcoatRoughness: 0.06, sheen: cfg.drizzle === 'white-chocolate' ? 0.4 : 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.ownsGeometry = true;
    this.group.add(mesh);
    this.parts.drizzle = mesh;
    if (!quick) {
      const total = geo.index.count;
      const step = radial * 6;
      geo.setDrawRange(0, 0);
      this.anims.push({ t: 0, dur: 1.5, run: (k) => geo.setDrawRange(0, Math.floor(smooth(k) * total / step) * step) });
    }
  }

  // ------------------------------------------------ animation
  #tweenColor(color, to, dur) {
    const from = color.clone(), target = new THREE.Color(to);
    this.anims.push({ t: 0, dur, run: (k) => color.copy(from).lerp(target, smooth(k)) });
  }

  #pop(mesh, dur) {
    this.anims.push({ t: 0, dur, run: (k) => {
      const e = 1 + Math.sin(k * Math.PI) * 0.06;
      mesh.scale.set(1, e, 1);
    } });
  }

  #drop(group) {
    group.children.forEach((mesh) => {
      const targets = mesh.userData.targets;
      if (!targets) return;
      const delays = targets.map(() => Math.random() * 0.45);
      const run = (k) => {
        const time = k * 1.1;
        targets.forEach((tg, i) => {
          const u = Math.min(1, Math.max(0, (time - delays[i]) / 0.5));
          // fall, then a small bounce
          const fall = u < 1 ? (1 - u) * (1 - u) * 0.07 : 0;
          const bounce = u < 1 ? Math.max(0, Math.sin(u * Math.PI * 2.2)) * 0.0015 * (1 - u) : 0;
          _m.compose(_p.copy(tg.pos).add(_t.set(0, fall + bounce, 0)), tg.quat, _s.setScalar(u <= 0 ? 0.0001 : tg.scale));
          mesh.setMatrixAt(i, _m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      run(0);
      this.anims.push({ t: 0, dur: 1.1, run });
    });
  }

  #remove(obj, quick) {
    // toppings share geometry and materials, so only free what this object owns
    const owned = new Set();
    const dispose = () => {
      this.group.remove(obj);
      obj.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        else if (o.isMesh && o.userData.ownsGeometry) o.geometry.dispose();
      });
      owned.forEach((m) => m.dispose());
    };
    if (quick) return dispose();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      owned.add(o.material);
    });
    this.anims.push({ t: 0, dur: 0.35, run: (k) => {
      owned.forEach((m) => { m.opacity = 1 - k; });
      obj.position.y = k * 0.004;
    }, done: dispose });
  }

  tick(dt) {
    if (!this.anims.length) return false;
    for (const a of this.anims) {
      a.t = Math.min(a.dur, a.t + dt);
      a.run(a.t / a.dur);
    }
    const finished = this.anims.filter((a) => a.t >= a.dur);
    this.anims = this.anims.filter((a) => a.t < a.dur);
    finished.forEach((a) => a.done?.());
    return true;
  }
}

// ------------------------------------------------------------------ props built from the same bits
/** A white glazed ramekin filled with one topping, for the cart's topping station. */
export function ramekin(topping, seed) {
  const g = new THREE.Group();
  const profile = [[0, 0], [0.026, 0], [0.029, 0.002], [0.031, 0.006], [0.033, 0.03], [0.0345, 0.0322], [0.0335, 0.0334], [0.0312, 0.0322], [0.0295, 0.006], [0.0, 0.006]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), new THREE.MeshPhysicalMaterial({ color: 0xf7f4ef, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
  cup.castShadow = cup.receiveShadow = true;
  g.add(cup);
  // a heaped pile
  const pile = new THREE.Mesh(grid(48, 10, (u, v) => {
    const a = u * Math.PI * 2, rr = 0.0295 * (1 - v);
    return [Math.cos(a) * rr, 0.026 + 0.008 * Math.pow(Math.sin(v * Math.PI / 2), 0.7), Math.sin(a) * rr];
  }), new THREE.MeshStandardMaterial({ color: topping === 'gold' ? 0xb89048 : topping === 'shavings' ? 0x3a2015 : 0xd9c3b0, roughness: 0.8 }));
  g.add(pile);
  const S = shapes(), M = mats(), r = rand(seed);
  const n = topping === 'shavings' ? 160 : 420;
  const geo = topping === 'gold' ? S.glitter : topping === 'shavings' ? S.flake : S.rod;
  const mat = topping === 'gold' ? M.gold : topping === 'shavings' ? M.choc : M.candy;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.028, v = d / 0.0295;
    const y = 0.026 + 0.008 * (1 - v ** 2) + r() * 0.001;
    _m.compose(_p.set(Math.cos(a) * d, y, Math.sin(a) * d), _q.setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), _s.setScalar(0.8 + r() * 0.4));
    mesh.setMatrixAt(i, _m);
    if (topping !== 'gold' && topping !== 'shavings') mesh.setColorAt(i, new THREE.Color(SPRINKLE_COLORS[Math.floor(r() * SPRINKLE_COLORS.length)]));
  }
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

/** A squeeze bottle of drizzle sauce. */
export function squeezeBottle(color) {
  const g = new THREE.Group();
  const body = new THREE.LatheGeometry([
    [0, 0], [0.024, 0], [0.0272, 0.003], [0.0278, 0.012], [0.0272, 0.13], [0.025, 0.142], [0.0125, 0.149], [0, 0.149],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const bottle = new THREE.Mesh(body, new THREE.MeshPhysicalMaterial({
    color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color(0xffffff),
  }));
  const cap = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0.147], [0.0135, 0.147], [0.0138, 0.162], [0.0108, 0.166], [0.0042, 0.19], [0.0016, 0.201], [0, 0.202],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 32), new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.35, clearcoat: 0.6 }));
  // a paper label
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0281, 0.0281, 0.05, 40, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0xf7efe6, roughness: 0.9 }));
  label.position.y = 0.07;
  for (const m of [bottle, cap, label]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  return g;
}
