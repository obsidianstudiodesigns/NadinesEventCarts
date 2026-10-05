// The 3D cake cart: Nadine's white panelled cart with its pine top and umbrella, standing in a garden,
// with mini cakes in foil trays, topping bowls, drizzle bottles and the "create your own" chalkboard.
// Two camera shots: 'cart' (the hero) and 'cake' (a close-up of the cake you design).
// Light and background come from a real Gauteng garden (Poly Haven "Pretoria Gardens", CC0).
import * as THREE from 'three';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  EffectComposer, RenderPass, EffectPass, DepthOfFieldEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode,
  NoiseEffect, BloomEffect, BlendFunction, SMAAEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { MiniCake, loadCakeTextures, ramekin, squeezeBottle } from './cake.js?v=6';

const A = 'assets/3d/';
const GROUND = -0.93;            // the counter top is y = 0
const CART = { w: 1.24, d: 0.58, topW: 1.34, topD: 0.7 };

// The sun's position in the panorama (from the Graphite Pools scene, same HDRI), turned so it lights the cart from the front-left.
const SUN_EL = THREE.MathUtils.degToRad(52), SUN_AZ0 = (0.6005 - 0.5) * Math.PI * 2;
const SUN_AZ = Math.atan2(0.75, -0.55);
const ENV_ROT = SUN_AZ0 - SUN_AZ;
const SUN_DIR = new THREE.Vector3(Math.cos(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.sin(SUN_AZ) * Math.cos(SUN_EL));

// The trays on the counter. The first is the one you design.
const DESIGN_AT = new THREE.Vector3(-0.15, 0, 0.17);
const DISPLAY = [
  { at: [0.15, 0, 0.17], rot: -0.06, cake: { base: 'chocolate', frosting: 'vanilla', toppings: ['shavings', 'choc-balls'], drizzle: 'none', seed: 5 } },
  { at: [-0.16, 0, 0.075], rot: 0.04, cake: { base: 'vanilla', frosting: 'buttercream', tint: 'pink', layout: 'double', toppings: ['rainbow', 'marshmallows'], drizzle: 'none', seed: 8 } },
  { at: [0.14, 0, 0.078], rot: 0.07, cake: { base: 'vanilla', frosting: 'cream-cheese', toppings: ['nuts'], drizzle: 'caramel', seed: 13 } },
  { at: [-0.13, 0, -0.02], rot: -0.03, cake: { base: 'chocolate', frosting: 'chocolate', toppings: ['hundreds'], drizzle: 'white-chocolate', seed: 21 } },
  { at: [0.17, 0, -0.016], rot: 0.02, cake: { base: 'red-velvet', frosting: 'buttercream', tint: 'blush', layout: 'double', toppings: ['gold'], drizzle: 'none', seed: 34 } },
];

// Camera shots: pos/target in world space; shift moves the subject across the frame (fractions of width/height).
const SHOTS = {
  cart: { pos: [0.52, 0.2, 0.77], target: [-0.03, -0.08, 0.05], fov: 34, shift: [0.17, 0.02] },
  cake: { pos: [DESIGN_AT.x + 0.14, 0.3, DESIGN_AT.z + 0.41], target: [DESIGN_AT.x + 0.004, 0.026, DESIGN_AT.z], fov: 27, shift: [-0.16, 0.03] },
};
const SHOTS_PORTRAIT = {
  cart: { pos: [0.78, 0.36, 1.3], target: [-0.02, -0.3, 0.02], fov: 40, shift: [0, -0.03] },
  cake: { pos: [DESIGN_AT.x + 0.17, 0.4, DESIGN_AT.z + 0.6], target: [DESIGN_AT.x, 0.02, DESIGN_AT.z], fov: 38, shift: [0, -0.26] },
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function qualityTier(renderer) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  if (coarse || cores <= 4 || /Intel|Mali|Adreno [1-5]|PowerVR|SwiftShader|llvmpipe/i.test(gpu)) return /SwiftShader|llvmpipe/i.test(gpu) ? 0 : 1;
  return 2;
}

export function createScene(canvas, { onReady, onProgress, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
  const tier = qualityTier(renderer);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let pixelRatio = Math.min(Math.max(devicePixelRatio, 1), tier === 2 ? 2 : 1.5);
  const MIN_RATIO = Math.min(1, pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.02, 200);

  // Draw only when something changes; the hand-held drift (fast GPUs only) keeps it drawing every frame.
  let dirty = 2;
  const invalidate = () => { dirty = Math.max(dirty, 2); };
  const drift = tier === 2 && !reducedMotion;

  // When every file is in, compile the shaders before saying we're ready, so the first frames don't stutter.
  const manager = new THREE.LoadingManager(async () => {
    try { await renderer.compileAsync(scene, camera); } catch { /* older drivers: compile on first draw */ }
    invalidate();
    requestAnimationFrame(() => requestAnimationFrame(() => { canvas.classList.add('is-ready'); onReady?.(); }));
  });
  manager.onProgress = (url, loaded, total) => { invalidate(); onProgress?.(loaded / total); };
  const texLoader = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (file, { srgb = false, repeat = [1, 1] } = {}) => {
    const t = texLoader.load(A + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.repeat.set(...repeat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  loadCakeTextures(texLoader, aniso);

  // ----- the garden: panorama for what you see, HDR for the light -----
  const pano = texLoader.load(A + 'garden-panorama.jpg');
  pano.mapping = THREE.EquirectangularReflectionMapping;
  pano.colorSpace = THREE.SRGBColorSpace;
  const skybox = new GroundedSkybox(pano, 1.75, 60, 96);
  skybox.position.y = 1.75 + GROUND;
  skybox.rotation.y = ENV_ROT;
  skybox.material.toneMapped = false;
  scene.add(skybox);
  new RGBELoader(manager).load(A + 'garden-light-1k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
  });
  scene.environmentRotation.y = ENV_ROT;
  scene.environmentIntensity = 0.62;

  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier ? 2048 : 1024, tier ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -1.1, right: 1.1, top: 1.1, bottom: -1.1, near: 0.5, far: 12 });
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.004;
  sun.shadow.radius = 4;
  sun.position.copy(SUN_DIR).multiplyScalar(5);
  scene.add(sun, sun.target);
  // soft bounce off the white cart and paving
  const fill = new THREE.HemisphereLight(0xfff7f2, 0xc8b8a8, 0.25);
  scene.add(fill);

  const add = (geo, mat, pos = [0, 0, 0], { cast = true, receive = true, rot, parent = scene } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  };

  // ground contact: the panorama can't take shadows, so a shadow catcher sits on it
  add(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.42 }), [0, GROUND + 0.002, 0], { cast: false, rot: [-Math.PI / 2, 0, 0] });

  // ----- the cart -----
  const pine = new THREE.MeshPhysicalMaterial({
    map: tex('cart-top-color.jpg', { srgb: true, repeat: [1.2, 0.6] }), normalMap: tex('coated-pine-normal.jpg', { repeat: [1.2, 0.6] }),
    roughnessMap: tex('coated-pine-rough.jpg', { repeat: [1.2, 0.6] }), roughness: 0.75, clearcoat: 0.55, clearcoatRoughness: 0.22,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
    add(new RoundedBoxGeometry(CART.topW, 0.04, CART.topD, 3, 0.006), pine, [0, -0.02, 0]);

  const plankTex = (repeat) => {
    const c = tex('white-planks-clean-color.jpg', { srgb: true, repeat }), n = tex('white-planks-clean-normal.jpg', { repeat }), r = tex('white-planks-clean-rough.jpg', { repeat });
    return new THREE.MeshStandardMaterial({ map: c, normalMap: n, roughnessMap: r, color: 0xffffff, normalScale: new THREE.Vector2(0.9, 0.9) });
  };
  const bodyH = -GROUND - 0.1;
  const body = new THREE.BoxGeometry(CART.w, bodyH, CART.d);
  const bodyMats = [plankTex([0.9, 1]), plankTex([0.9, 1]), plankTex([1, 1]), plankTex([1, 1]), plankTex([1.6, 1]), plankTex([1.6, 1])];
  add(body, bodyMats, [0, -0.04 - bodyH / 2, 0]);
  // kick board
  add(new THREE.BoxGeometry(CART.w - 0.04, 0.06, CART.d - 0.04), new THREE.MeshStandardMaterial({ color: 0xe9e4dc, roughness: 0.7 }), [0, GROUND + 0.03, 0]);
  // the round Nadine's sign on the front
  const signMap = texLoader.load('assets/brand/logo-round-512.png');
  signMap.colorSpace = THREE.SRGBColorSpace; signMap.anisotropy = aniso;
  const signZ = CART.d / 2 + 0.004;
  add(new THREE.CircleGeometry(0.2, 96), new THREE.MeshPhysicalMaterial({ map: signMap, transparent: true, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }), [0, -0.46, signZ + 0.0065], { cast: false });
  add(new THREE.CylinderGeometry(0.212, 0.212, 0.008, 96), new THREE.MeshStandardMaterial({ color: 0xc9a165, metalness: 1, roughness: 0.3 }), [0, -0.46, signZ], { rot: [Math.PI / 2, 0, 0] });

  // ----- umbrella, behind the cart -----
  const umb = new THREE.Group();
  umb.position.set(0.05, 0, -0.5);
  scene.add(umb);
  const bronze = new THREE.MeshStandardMaterial({ color: 0x3b332d, metalness: 0.8, roughness: 0.38 });
  add(new THREE.CylinderGeometry(0.019, 0.022, 2.35, 20), bronze, [0, GROUND + 1.175, 0], { parent: umb });
  const canopyH = GROUND + 2.25, R = 1.42;
  const canopyGeo = (() => {
    const cols = 128, rows = 24, pos = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = (i / cols) * Math.PI * 2, v = j / rows;
        const between = 1 - Math.abs(Math.cos(a * 4));
        const rr = R * v * (1 - 0.035 * between * v);
        const y = canopyH + 0.36 * (1 - Math.pow(v, 1.35)) - 0.05 * between * Math.sin(v * Math.PI);
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const i1 = (i + 1) % cols, a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  })();
  add(canopyGeo, new THREE.MeshPhysicalMaterial({ color: 0x8b776a, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xc8b4a4), side: THREE.DoubleSide }), [0, 0, 0], { parent: umb });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    // from the top of the pole to the canopy edge, just under the fabric
    const from = new THREE.Vector3(0, canopyH + 0.34, 0), to = new THREE.Vector3(Math.cos(a) * R * 0.98, canopyH - 0.01, Math.sin(a) * R * 0.98);
    const len = from.distanceTo(to);
    const rib = add(new THREE.CylinderGeometry(0.005, 0.005, len, 6), bronze, [0, 0, 0], { parent: umb });
    rib.position.lerpVectors(from, to, 0.5);
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  add(new THREE.SphereGeometry(0.03, 16, 12), bronze, [0, canopyH + 0.39, 0], { parent: umb });

  // ----- the cakes -----
  const cakes = [];
  // starts plain (sponge and frosting); the visitor adds sprinkles and a drizzle
  const designed = new MiniCake({ base: 'red-velvet', frosting: 'cream-cheese', toppings: [], drizzle: 'none', seed: 3 }, { animate: !reducedMotion });
  designed.group.position.copy(DESIGN_AT);
  designed.group.rotation.y = 0.05;
  scene.add(designed.group);
  cakes.push(designed);
  for (const d of DISPLAY) {
    const c = new MiniCake(d.cake, { animate: false });
    c.group.position.set(...d.at);
    c.group.rotation.y = d.rot;
    scene.add(c.group);
    cakes.push(c);
  }

  // topping bowls and drizzle bottles at the back of the counter
  [['rainbow', -0.44, -0.2], ['gold', -0.355, -0.235], ['shavings', -0.4, -0.12]].forEach(([t, x, z], k) => {
    const r = ramekin(t, 40 + k); r.position.set(x, 0, z); scene.add(r);
  });
  [[0x3a1d12, 0.36], [0xb5621c, 0.42], [0xf1e5cc, 0.48], [0xd23a5a, 0.54]].forEach(([c, x], k) => {
    const b = squeezeBottle(c); b.position.set(x, 0, -0.24 + (k % 2) * 0.03); b.rotation.y = k * 0.6; scene.add(b);
  });

  // loose sprinkles on the counter
  {
    const S = new THREE.CapsuleGeometry(0.0006, 0.0032, 2, 6);
    const n = 34, m = new THREE.InstancedMesh(S, new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7 }), n);
    const cols = [0xe8475f, 0xf6c445, 0x4fb3e8, 0x7ac36a, 0xf08ad0, 0xfdfbf7];
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const x = -0.42 + Math.random() * 0.14, z = -0.2 + Math.random() * 0.2;
      q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.random() * 6.3));
      mx.compose(new THREE.Vector3(x, 0.0007, z), q, new THREE.Vector3(1, 1, 1));
      m.setMatrixAt(i, mx);
      m.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    m.castShadow = true;
    scene.add(m);
  }

  // the chalkboard: "create your own mini cake" in four steps
  const board = new THREE.Group();
  board.position.set(-0.53, 0, 0.06);
  board.rotation.y = 0.55;
  scene.add(board);
  const chalk = document.createElement('canvas');
  chalk.width = 512; chalk.height = 680;
  const chalkTex = new THREE.CanvasTexture(chalk);
  chalkTex.colorSpace = THREE.SRGBColorSpace; chalkTex.anisotropy = aniso;
  const drawChalk = () => {
    const c = chalk.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#2a2d2a'; c.fillRect(0, 0, 512, 680);
    // smudges
    for (let i = 0; i < 40; i++) {
      const g = c.createRadialGradient(Math.random() * 512, Math.random() * 680, 0, Math.random() * 512, Math.random() * 680, 60 + Math.random() * 120);
      g.addColorStop(0, 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 512, 680);
    }
    c.fillStyle = 'rgba(250,247,240,0.92)';
    c.textAlign = 'center';
    c.font = '78px Allura, cursive';
    c.fillText('Create your own', 256, 120);
    c.font = '104px Allura, cursive';
    c.fillText('mini cake', 256, 215);
    c.font = '300 31px Jost, sans-serif';
    c.textAlign = 'left';
    ['1  Choose your cake base', '2  Pick your frosting', '3  Add sprinkles & sparkles', '4  Top it off with a drizzle'].forEach((s, k) => c.fillText(s, 52, 320 + k * 70));
    c.font = '58px Allura, cursive'; c.textAlign = 'center';
    c.fillStyle = 'rgba(244,183,198,0.9)';
    c.fillText('Small cakes… big joy!', 256, 630);
    // chalk grain
    const img = c.getImageData(0, 0, 512, 680);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] > 90 && Math.random() < 0.18) img.data[i + 3] = 150;
    }
    c.putImageData(img, 0, 0);
    chalkTex.needsUpdate = true;
    invalidate();
  };
  document.fonts?.ready.then(drawChalk); drawChalk();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a6544, roughness: 0.7 });
  const bw = 0.2, bh = 0.265;
  const face = new THREE.Group();
  face.rotation.x = -0.2;
  board.add(face);
  add(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: chalkTex, roughness: 0.95 }), [0, bh / 2 + 0.012, 0.0035], { parent: face });
  add(new THREE.BoxGeometry(bw + 0.022, bh + 0.022, 0.006), frameMat, [0, bh / 2 + 0.012, 0], { parent: face });
  add(new THREE.BoxGeometry(0.012, bh, 0.006), frameMat, [0, bh / 2 - 0.01, -0.07], { parent: board, rot: [0.28, 0, 0] });

  // ----- post-processing -----
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: tier === 2 ? 4 : 0 });
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (tier >= 1) {
    ao = new N8AOPostPass(scene, camera, 1, 1);
    Object.assign(ao.configuration, { aoRadius: 0.06, distanceFalloff: 0.6, intensity: 2.2, color: new THREE.Color(0x1a0f0a), halfRes: tier === 1 });
    ao.setQualityMode(tier === 2 ? 'Medium' : 'Low');
    composer.addPass(ao);
  }
  const dof = new DepthOfFieldEffect(camera, { worldFocusRange: 0.5, bokehScale: 3, resolutionScale: tier === 2 ? 1 : 0.75 });
  dof.target = new THREE.Vector3();
  const bloom = new BloomEffect({ luminanceThreshold: 0.92, luminanceSmoothing: 0.1, intensity: 0.35, mipmapBlur: true });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.42 });
  const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true });
  grain.blendMode.opacity.value = 0.12;
  const effects = [dof, bloom, tone, vignette, grain];
  if (tier < 2) effects.unshift(new SMAAEffect());
  composer.addPass(new EffectPass(camera, ...effects));

  // ----- camera -----
  const v = (a) => new THREE.Vector3(...a);
  let progress = 0, active = true, raf = 0, last = performance.now();
  const pointer = new THREE.Vector2(), pointerSmooth = new THREE.Vector2();
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const size = { w: 1, h: 1 };

  function shotsFor() {
    return size.w / size.h < 0.9 ? SHOTS_PORTRAIT : SHOTS;
  }

  function placeCamera(time) {
    const S = shotsFor();
    const t = ease(clamp01(progress));
    camPos.lerpVectors(v(S.cart.pos), v(S.cake.pos), t);
    camTarget.lerpVectors(v(S.cart.target), v(S.cake.target), t);
    // a slow, hand-held drift and a little parallax from the pointer
    const d = drift ? 1 : 0, par = reducedMotion ? 0 : 1;
    const scale = THREE.MathUtils.lerp(1, 0.18, t);
    camPos.x += (Math.sin(time * 0.00021) * 0.05 * d + pointerSmooth.x * 0.08 * par) * scale;
    camPos.y += (Math.sin(time * 0.00017 + 1) * 0.02 * d + pointerSmooth.y * 0.04 * par) * scale;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.fov = THREE.MathUtils.lerp(S.cart.fov, S.cake.fov, t);
    const sx = THREE.MathUtils.lerp(S.cart.shift[0], S.cake.shift[0], t);
    const sy = THREE.MathUtils.lerp(S.cart.shift[1], S.cake.shift[1], t);
    camera.setViewOffset(size.w, size.h, -sx * size.w, -sy * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
    // focus on the front cakes, then on yours
    dof.target.lerpVectors(new THREE.Vector3(0, 0.02, 0.15), designed.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.03, 0)), t);
    dof.cocMaterial.worldFocusRange = THREE.MathUtils.lerp(0.55, 0.42, t);
    dof.bokehScale = THREE.MathUtils.lerp(3.2, 2.4, t);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    size.w = w; size.h = h;
    renderer.setPixelRatio(pixelRatio);
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // drop resolution if frames are slow
  let slow = 0, drewLast = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!active) { drewLast = false; return; }

    const pointerMoving = pointerSmooth.distanceToSquared(pointer) > 1e-6;
    pointerSmooth.lerp(pointer, 1 - Math.pow(0.02, dt));
    let animating = false;
    for (const c of cakes) animating = c.tick(dt) || animating;

    if (!(drift || pointerMoving || animating || dirty > 0)) { drewLast = false; return; }
    dirty = Math.max(0, dirty - 1);
    if (drewLast) {
      if (dt > 1 / 32) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
      if (slow > 1.5 && pixelRatio > MIN_RATIO) { pixelRatio = Math.max(MIN_RATIO, pixelRatio - 0.25); slow = 0; resize(); }
    }
    drewLast = true;
    placeCamera(now);
    composer.render(dt);
  }
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { if (p !== progress) { progress = p; invalidate(); } },
    setActive(a) { if (a && !active) invalidate(); active = a; },
    setPointer(x, y) { pointer.set(x, y); },
    setCake(cfg) { designed.update(cfg); invalidate(); },
    get config() { return designed.config; },
    tier,
    debug: { scene, camera, renderer, composer, cakes, ao, dof },
  };
}
