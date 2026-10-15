// The booking page: Nadine's charcuterie cart enquiry and booking form, and the mini cake order form.
// Both build a WhatsApp message from what the visitor chose; nothing is sent or stored by the site.
import { EXPERIENCES, EXTRAS, TRAVEL_FEE, GUESTS, MINI_CAKES, ORDER_NOTICE_DAYS } from './booking-menu.js?v=1';

const WA = '27627248788';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rand = (n) => `R${n.toLocaleString('en-ZA').replace(/ /g, ',')}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
$('#year').textContent = new Date().getFullYear();

const isoDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const niceDate = (v) => (v ? new Date(`${v}T12:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '');

// In a message, '' is a deliberate blank line between sections; optional lines that don't apply are null.
function sendWhatsApp(lines) {
  const text = lines.filter((l) => l !== null && l !== undefined && l !== false).join('\n');
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

function showError(el, text, focus) {
  el.textContent = text;
  el.hidden = false;
  if (focus) {
    focus.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    focus.focus?.({ preventScroll: true });
  }
}

// ---------------------------------------------------------------- tabs
const tabs = $$('[role="tab"]');
function showTab(id) {
  tabs.forEach((t) => {
    const on = t.getAttribute('aria-controls') === id;
    t.setAttribute('aria-selected', String(on));
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t) => t.addEventListener('click', (e) => {
  e.preventDefault();
  const id = t.getAttribute('aria-controls');
  history.replaceState(null, '', `#${id}`);
  showTab(id);
}));
showTab(location.hash === '#mini-cakes' ? 'mini-cakes' : 'charcuterie');
addEventListener('hashchange', () => showTab(location.hash === '#mini-cakes' ? 'mini-cakes' : 'charcuterie'));

$$('[data-print]').forEach((b) => b.addEventListener('click', () => print()));

// ================================================================ charcuterie cart
const charc = $('#charc-form');
const menu = $('#menu');
const groupsEl = $('#menu-groups');
const extrasEl = $('#extras');
$('#c-date').min = isoDay(1);

// remember choices per experience, so switching Classic/Deluxe doesn't lose shared picks
const picks = {};

function renderMenu(expId) {
  const exp = EXPERIENCES[expId];
  menu.hidden = false;
  groupsEl.innerHTML = '';
  exp.groups.forEach((g, gi) => {
    const fs = document.createElement('fieldset');
    fs.className = 'group';
    fs.dataset.group = g.id;
    fs.dataset.choose = g.choose;
    const chosen = picks[g.id] || [];
    fs.innerHTML = `
      <legend><span class="group-title">${gi + 1}. ${g.title}</span>
        <span class="group-count" aria-live="polite"><span class="n">0</span> of ${g.choose} chosen</span></legend>
      ${g.note ? `<p class="group-note">${g.note}</p>` : ''}
      <div class="options">${g.items.map((item) => `
        <label class="option"><input type="checkbox" name="g-${g.id}" value="${item}"${chosen.includes(item) ? ' checked' : ''}><span>${item}</span></label>`).join('')}
      </div>
      <p class="group-error" role="alert" hidden></p>`;
    groupsEl.append(fs);
    syncGroup(fs);
  });
}

function syncGroup(fs) {
  const max = Number(fs.dataset.choose);
  const boxes = $$('input', fs);
  const on = boxes.filter((b) => b.checked);
  // trim any carried-over picks that no longer fit the limit
  on.slice(max).forEach((b) => { b.checked = false; });
  const count = Math.min(on.length, max);
  boxes.forEach((b) => { b.disabled = !b.checked && count >= max; });
  $('.n', fs).textContent = count;
  fs.classList.toggle('is-complete', count === max);
  picks[fs.dataset.group] = boxes.filter((b) => b.checked).map((b) => b.value);
  if (count === max) $('.group-error', fs).hidden = true;
}

function renderExtras() {
  extrasEl.innerHTML = EXTRAS.map((x) => `
    <fieldset class="group extra" data-extra="${x.id}">
      <legend><span class="group-title">${x.title}</span> <span class="group-count">R${x.price} per person, choose 1</span></legend>
      <p class="group-note">${x.note}</p>
      <div class="options">
        <label class="option"><input type="radio" name="x-${x.id}" value="" checked><span>${x.none}</span></label>
        ${x.items.map((item) => `<label class="option"><input type="radio" name="x-${x.id}" value="${item}"><span>${item}</span></label>`).join('')}
      </div>
    </fieldset>`).join('');
}
renderExtras();

function readCharc() {
  const f = new FormData(charc);
  const expId = f.get('experience');
  const guests = Number(f.get('guests')) || 0;
  const extras = EXTRAS.map((x) => ({ ...x, choice: f.get(`x-${x.id}`) || '' }));
  return { f, expId, exp: expId && EXPERIENCES[expId], guests, extras };
}

function updateEstimate() {
  const { expId, exp, guests, extras } = readCharc();
  const g = Math.min(Math.max(guests, 0), GUESTS.max);
  const lines = [];
  let total = TRAVEL_FEE;
  if (exp) {
    const sub = exp.price * g;
    total += sub;
    lines.push([`${exp.label} experience, R${exp.price} × ${g || '?'} guests`, rand(sub)]);
  } else {
    lines.push(['Choose an experience', 'R0']);
  }
  extras.filter((x) => x.choice).forEach((x) => {
    const sub = x.price * g;
    total += sub;
    lines.push([`${x.title}: ${x.choice}, R${x.price} × ${g || '?'}`, rand(sub)]);
  });
  lines.push(['Travelling, setup, breakdown and 3 hours hosting', rand(TRAVEL_FEE)]);
  $('#est-lines').innerHTML = lines.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  $('#est-total').textContent = rand(total);
  $('#est-bar-total').textContent = rand(total);
  if (exp && g) $('#est-lines').insertAdjacentHTML('beforeend', `<div class="pp"><dt>Per guest, before the travel and hosting fee</dt><dd>${rand(exp.price + extras.filter((x) => x.choice).reduce((a, x) => a + x.price, 0))}</dd></div>`);

  // how much of the menu is still to choose
  const progress = $('#est-progress');
  if (!expId) { progress.textContent = ''; return; }
  const left = $$('.group[data-group]', groupsEl).filter((fs) => !fs.classList.contains('is-complete'));
  progress.textContent = left.length ? `${left.length} menu ${left.length === 1 ? 'group' : 'groups'} still to choose` : 'Menu complete';
  progress.classList.toggle('is-done', !left.length);
}

charc.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'experience') {
    renderMenu(t.value);
    $('#exp-error').hidden = true;
  }
  const fs = t.closest('.group[data-group]');
  if (fs) syncGroup(fs);
  if (t.name === 'colour') $('#c-colour').hidden = !t.checked;
  if (t.matches('[aria-invalid]') && t.value) t.removeAttribute('aria-invalid');
  updateEstimate();
});
charc.addEventListener('input', (e) => {
  if (e.target.name === 'guests') updateEstimate();
  if (e.target.value) e.target.removeAttribute('aria-invalid');
});
updateEstimate();

// phones: a floating total while choosing, hidden once the summary itself is on screen
const estBar = $('#est-bar');
new IntersectionObserver(([e]) => estBar.classList.toggle('is-hidden', e.isIntersecting)).observe($('#charc-form .estimate-card'));

function checkRequired(form) {
  for (const el of $$('[required]', form)) {
    if (!el.value.trim()) {
      el.setAttribute('aria-invalid', 'true');
      const label = $(`label[for="${el.id}"]`)?.childNodes[0]?.textContent.trim() || el.getAttribute('aria-label') || el.placeholder || 'this field';
      return { el, text: `Fill in "${label}" before sending.` };
    }
  }
  return null;
}

charc.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#charc-error');
  err.hidden = true;
  const missing = checkRequired(charc);
  if (missing) return showError(err, missing.text, missing.el);
  const { f, expId, exp, guests, extras } = readCharc();
  const guestsEl = $('#c-guests');
  if (guests < GUESTS.min || guests > GUESTS.max) {
    guestsEl.setAttribute('aria-invalid', 'true');
    return showError(err, `The charcuterie cart is for ${GUESTS.min} to ${GUESTS.max} guests. Change the number of guests, or WhatsApp Nadine to talk about your event.`, guestsEl);
  }
  if (!exp) {
    showError($('#exp-error'), 'Choose the Classic or Deluxe experience.');
    return showError(err, 'Choose the Classic or Deluxe experience.', $('.experiences'));
  }
  for (const fs of $$('.group[data-group]', groupsEl)) {
    if (!fs.classList.contains('is-complete')) {
      const n = Number(fs.dataset.choose);
      const title = $('.group-title', fs).textContent.replace(/^\d+\.\s*/, '');
      const msg = `Choose ${n} from ${title.toLowerCase()}.`;
      showError($('.group-error', fs), msg);
      return showError(err, msg, fs);
    }
  }

  const total = TRAVEL_FEE + guests * (exp.price + extras.filter((x) => x.choice).reduce((a, x) => a + x.price, 0));
  const lines = [
    "Hi Nadine, I'd like to book the charcuterie cart.",
    '',
    '*My details*',
    `Name: ${f.get('name')}`,
    `Phone/WhatsApp: ${f.get('phone')}`,
    f.get('email') ? `Email: ${f.get('email')}` : null,
    '',
    '*My event*',
    `Event: ${f.get('type')}`,
    `Date: ${niceDate(f.get('date'))}`,
    `Time: ${f.get('time')}`,
    `Location: ${f.get('location')}`,
    `Guests: ${guests}`,
    f.get('allergies') ? `Dietary needs or allergies: ${f.get('allergies')}` : null,
    '',
    `*${exp.label} experience (R${exp.price} per person)*`,
    ...exp.groups.map((g) => `${g.title}: ${(picks[g.id] || []).join(', ')}`),
    '',
    '*Extras*',
    ...extras.map((x) => `${x.title}: ${x.choice || 'none'}`),
    f.get('colour') ? `Colour scheme help: yes${f.get('colourScheme') ? ` (${f.get('colourScheme')})` : ''}` : null,
    f.get('balloons') ? 'Balloon garland: yes, please quote' : null,
    f.get('notes') ? `Notes: ${f.get('notes')}` : null,
    '',
    `Estimate from the website: ${rand(total)}, including the R1,500 travel and hosting fee. I look forward to your quotation.`,
  ];
  sendWhatsApp(lines);
});

// ================================================================ mini cakes
const cakeForm = $('#cake-form');
const minDate = isoDay(ORDER_NOTICE_DAYS);
$('#m-date').min = minDate;
$('#m-date-hint').textContent = `At least ${ORDER_NOTICE_DAYS} days from today, so ${niceDate(minDate)} or later.`;
$('#flavours').innerHTML = MINI_CAKES.map((c) => `
  <label class="flavour" for="fl-${slug(c.name)}">
    <input type="checkbox" id="fl-${slug(c.name)}" name="flavour" value="${c.name}">
    <span class="fl-name">${c.name}</span>
    <span class="fl-detail">${c.detail}</span>
  </label>`).join('');

function updateCakeSummary() {
  const f = new FormData(cakeForm);
  const chosen = f.getAll('flavour');
  const el = $('#cake-summary');
  el.innerHTML = chosen.length
    ? `<strong>${chosen.length} ${chosen.length === 1 ? 'flavour' : 'flavours'}:</strong> ${chosen.join(', ')}`
    : 'No flavours chosen yet.';
  $('#m-address').hidden = f.get('collect') !== 'Delivery';
  $('#m-address').required = f.get('collect') === 'Delivery';
  if (chosen.length) $('#flavour-error').hidden = true;
}
cakeForm.addEventListener('change', updateCakeSummary);
cakeForm.addEventListener('input', (e) => { if (e.target.value) e.target.removeAttribute('aria-invalid'); });
updateCakeSummary();

cakeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#cake-error');
  err.hidden = true;
  const f = new FormData(cakeForm);
  const chosen = f.getAll('flavour');
  if (!chosen.length) {
    showError($('#flavour-error'), 'Choose at least one flavour.');
    return showError(err, 'Choose at least one flavour.', $('#flavours'));
  }
  const missing = checkRequired(cakeForm);
  if (missing) return showError(err, missing.text, missing.el);
  const dateEl = $('#m-date');
  if (f.get('date') < minDate) {
    dateEl.setAttribute('aria-invalid', 'true');
    return showError(err, `Mini cakes need at least ${ORDER_NOTICE_DAYS} days' notice. Choose ${niceDate(minDate)} or later, or WhatsApp Nadine to ask.`, dateEl);
  }
  sendWhatsApp([
    "Hi Nadine, I'd like to order mini cakes.",
    '',
    `Name: ${f.get('name')}`,
    `Contact number: ${f.get('phone')}`,
    `Flavours: ${chosen.join(', ')}`,
    `Quantity: ${f.get('quantity')}`,
    `Date required: ${niceDate(f.get('date'))}`,
    `Pick-up or delivery: ${f.get('collect')}${f.get('collect') === 'Delivery' ? ` to ${f.get('address')}` : ''}`,
    f.get('notes') ? `Notes: ${f.get('notes')}` : null,
  ]);
});
