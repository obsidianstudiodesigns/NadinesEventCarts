// Page behaviour: the 3D scene and its scroll-driven camera, the cake builder and the booking form.
import { BASES, FROSTINGS, TINTS, TOPPINGS, DRIZZLES } from './menu.js?v=6';

const WA = '27627248788';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
$('#year').textContent = new Date().getFullYear();

// ---------------------------------------------------------------- header and menu
const header = $('.site-header');
const nav = $('#main-nav');
const toggle = $('.nav-toggle');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open);
  toggle.textContent = open ? 'Close' : 'Menu';
});
nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Menu'; }
});

// ---------------------------------------------------------------- loading screen
// Progress: the 3D libraries download first (0 to 15%), then the scene's textures (15 to 95%), then shaders compile.
// The first visit in a session keeps it up for at least a moment so it doesn't flash; later visits skip that.
const loader = $('#loader');
const loaderBar = $('#loader-bar');
const loaderPct = $('#loader-pct');
const firstVisit = (() => {
  try { const seen = sessionStorage.getItem('nec-visited'); sessionStorage.setItem('nec-visited', '1'); return !seen; } catch { return true; }
})();
const loadStart = performance.now();
let shown = 0;
function setLoad(p) {
  const v = Math.round(Math.min(100, Math.max(shown, p * 100)));
  if (v === shown) return;
  shown = v;
  loaderBar.style.strokeDashoffset = String(100 - v);
  loaderPct.textContent = v;
}
// creep forward while the libraries download, so the ring never looks stuck
const creep = setInterval(() => setLoad(Math.min(0.14, shown / 100 + 0.012)), 120);
let finished = false;
function finishLoading() {
  if (finished) return;
  finished = true;
  clearInterval(creep);
  setLoad(1);
  const wait = Math.max(0, (firstVisit && !reducedMotion ? 1400 : 0) - (performance.now() - loadStart));
  setTimeout(() => {
    loader.classList.add('is-leaving');
    document.documentElement.classList.remove('is-loading');
    document.documentElement.classList.add('is-loaded');
    loader.addEventListener('animationend', (e) => { if (e.target === loader) loader.remove(); });
  }, wait + 250);
}
// never hold the page hostage: stop waiting after 20 seconds
setTimeout(finishLoading, 20000);

// ---------------------------------------------------------------- 3D
const canvas = $('#scene');
const hero = $('.hero');
const build = $('#build');
const paper = $('.paper');
const mobileBar = $('.mobile-bar');
let scene = null;

function supportsWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; }
}

if (supportsWebGL()) {
  import('./scene.js?v=6').then(({ createScene }) => {
    clearInterval(creep);
    setLoad(0.15);
    scene = createScene(canvas, {
      reducedMotion,
      onProgress: (f) => setLoad(0.15 + f * 0.8),
      onReady: finishLoading,
    });
    if (location.hash === '#debug') window.__cart = scene;
    scene.setCake(readBuilder());
    onScroll();
  }).catch((err) => {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
    finishLoading();
  });
} else {
  document.documentElement.classList.add('no-webgl');
  // no 3D: wait for the still picture behind the hero instead
  if (document.readyState === 'complete') finishLoading();
  else addEventListener('load', finishLoading);
}

function onScroll() {
  const y = scrollY, vh = innerHeight;
  header.classList.toggle('is-solid', y > 40);
  mobileBar.classList.toggle('is-hidden', build.getBoundingClientRect().top < vh * 0.5 && build.getBoundingClientRect().bottom > vh * 0.3);
  if (!scene) return;
  // 0 at the top of the page (the cart), 1 once the builder fills the screen (your cake)
  const p = Math.min(1, Math.max(0, y / Math.max(1, build.offsetTop)));
  scene.setProgress(p);
  // stop drawing once the paper sections cover the canvas
  scene.setActive(paper.getBoundingClientRect().top > 0);
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

addEventListener('pointermove', (e) => {
  if (!scene || e.pointerType !== 'mouse') return;
  scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
}, { passive: true });

// ---------------------------------------------------------------- the cake builder
const builder = $('#builder');
const tints = $('#tints');
const summary = $('#cake-summary');
const send = $('#send-cake');
const MAX_TOPPINGS = 3;

function readBuilder() {
  const f = new FormData(builder);
  return {
    base: f.get('base'),
    frosting: f.get('frosting'),
    tint: f.get('tint'),
    toppings: f.getAll('toppings'),
    drizzle: f.get('drizzle'),
  };
}

function list(items) {
  if (items.length < 2) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function describe(c) {
  const fr = FROSTINGS[c.frosting];
  const colour = fr.tintable && c.tint !== 'natural' ? `${TINTS[c.tint].label.toLowerCase()} ` : '';
  const tops = c.toppings.map((t) => TOPPINGS[t].label.toLowerCase());
  const drizzle = c.drizzle === 'none' ? 'no drizzle' : `a ${DRIZZLES[c.drizzle].label.toLowerCase()} drizzle`;
  const drizzleText = c.drizzle === 'none' ? '' : `, finished with ${drizzle}`;
  return `${BASES[c.base].label} cake with ${colour}${fr.label.toLowerCase()} frosting${tops.length ? `, ${list(tops)}` : ''}${drizzleText}.`;
}

function syncBuilder() {
  const c = readBuilder();
  const tintable = FROSTINGS[c.frosting].tintable;
  tints.setAttribute('aria-disabled', String(!tintable));
  $$('input', tints).forEach((i) => { i.disabled = !tintable; });
  const full = c.toppings.length >= MAX_TOPPINGS;
  $$('input[name="toppings"]', builder).forEach((i) => { i.disabled = full && !i.checked; });
  const text = describe(c);
  summary.textContent = `Your cake: ${text}`;
  send.href = `https://wa.me/${WA}?text=${encodeURIComponent(`Hi Nadine, I'd like to book the cake cart. I designed this mini cake on your website: ${text}`)}`;
  return c;
}

builder.addEventListener('change', () => scene?.setCake(syncBuilder()));
builder.addEventListener('submit', (e) => e.preventDefault());
syncBuilder();

// ---------------------------------------------------------------- booking form -> WhatsApp
const form = $('#book-form');
const err = $('#form-error');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const name = String(f.get('name') || '').trim();
  const nameInput = $('#f-name');
  if (!name) {
    err.textContent = 'Add your name so Nadine knows who the booking is for.';
    err.hidden = false;
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.focus();
    return;
  }
  err.hidden = true;
  nameInput.removeAttribute('aria-invalid');
  const date = f.get('date') ? new Date(f.get('date') + 'T12:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'not set yet';
  const want = f.getAll('want');
  const lines = [
    `Hi Nadine, my name is ${name}. I'd like to book for a ${String(f.get('occasion')).toLowerCase()}.`,
    `Date: ${date}`,
    f.get('guests') && `Guests: ${f.get('guests')}`,
    f.get('suburb') && `Suburb: ${f.get('suburb')}`,
    want.length && `I'm interested in: ${want.join(', ')}`,
    f.get('message') && `\n${f.get('message')}`,
  ].filter(Boolean);
  open(`https://wa.me/${WA}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
