// Interface: criação de elementos, formatação pt-PT, ícones, avisos, camadas e teclado numérico.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (k) => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k.nodeType ? k : document.createTextNode(k));
  };
  kids.forEach(add);
  return el;
}

// ---------- formatação ----------
export function nf(n, max = 1) {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n * 10 ** max) / 10 ** max;
  const [i, f] = String(Math.abs(r)).split('.');
  return (r < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '');
}
export const parseNum = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const p2 = (n) => String(n).padStart(2, '0');
export const dmy = (ts) => { const d = new Date(ts); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const hm = (ts) => { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const dayLabel = (d = new Date()) => d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
export const toLocalInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export function whenLabel(ts) {
  const d = new Date(ts), t = new Date(), y = new Date(t);
  y.setDate(t.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  return `${same(d, t) ? 'Hoje' : same(d, y) ? 'Ontem' : dmy(ts)}, ${hm(ts)}`;
}
export function agoLabel(ts) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
}
export function saudacao(d = new Date()) {
  const hr = d.getHours();
  return hr < 12 ? 'Bom dia' : hr < 20 ? 'Boa tarde' : 'Boa noite';
}
export const vibrate = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

// ---------- ícones ----------
const ICONS = {
  hoje: 'M3 11l9-8 9 8M5 10v10h14V10', maq: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  mes: 'M4 20V10M10 20V4M16 20v-7M22 20H2', drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  check: 'M5 12l5 5L20 7', back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.01', share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6', download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z', fuel: 'M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M6 8h6M14 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V8l-3-3',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2', cloud: 'M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18H7z',
};
export function icon(name, size = 24) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}
export const ic = (name, size) => h('span', { class: 'ic-wrap', html: icon(name, size) });

// ---------- avisos ----------
export function toast(msg, { label, onAction, ms = 5000, kind } = {}) {
  const t = h('div', { class: `toast ${kind || ''}`, role: 'status' }, h('span', {}, msg));
  const close = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 250); };
  if (label) t.append(h('button', { type: 'button', onclick: () => { onAction?.(); close(); } }, label));
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(close, ms);
  return close;
}

// ---------- camadas ----------
// Cada camada aberta entra no histórico: o botão "voltar" do telemóvel fecha-a em vez de sair da app.
const layers = [];
let pending = null;
let idle = null;
export const layersOpen = () => layers.length;
export const onIdle = (fn) => { idle = fn; };
function push(closeFn) {
  layers.push(closeFn);
  document.body.classList.add('locked');
  try { history.pushState({ jjr: layers.length }, ''); } catch {}
}
export function popLayer(then) {
  if (!layers.length) { then?.(); return; }
  pending = then || null;
  history.back();
}
addEventListener('popstate', () => {
  const c = layers.pop();
  c?.();
  if (!layers.length) document.body.classList.remove('locked');
  const t = pending; pending = null;
  t?.();
  if (!layers.length) idle?.();
});

const mount = () => $('#layers');
function animateIn(el) { $('#toasts')?.replaceChildren(); mount().append(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); }
function animateOut(el) { el.classList.remove('in'); setTimeout(() => el.remove(), 280); }

export function openFull(el, { onClose } = {}) {
  el.classList.add('layer');
  animateIn(el);
  push(() => { animateOut(el); onClose?.(); });
  return { el, close: (then) => popLayer(then) };
}

export function openSheet(title, content, { onClose } = {}) {
  const wrap = h('div', { class: 'sheet-wrap' },
    h('div', { class: 'sheet-bd', onclick: () => popLayer() }),
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }), title && h('h3', {}, title), content));
  animateIn(wrap);
  push(() => { animateOut(wrap); onClose?.(); });
  return { el: wrap, close: (then) => popLayer(then) };
}

export function confirmSheet(msg, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const s = openSheet(null, h('div', {},
      h('p', { class: 'confirm-msg' }, msg),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: () => s.close() }, 'Cancelar'),
        h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { fin(true); s.close(); } }, okLabel))),
      { onClose: () => fin(false) });
  });
}

// ---------- teclado numérico gigante com vários campos ----------
const show = (v) => {
  if (v === '') return '0';
  const [i, f] = v.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return v.includes('.') ? `${g},${f}` : g;
};

// Nada é chamado no construtor: quem usa chama refresh() quando os seus elementos já existem.
export function Pad({ fields, decimals = true, onChange }) {
  const vals = Object.fromEntries(fields.map((f) => [f.key, f.value == null ? '' : String(f.value).replace(',', '.')]));
  const max = Object.fromEntries(fields.map((f) => [f.key, f.max || 6]));
  let active = fields[0].key;
  const boxes = {};

  const fieldsEl = h('div', { class: 'pf' }, fields.map((f) => {
    const num = h('span', { class: 'pf-num' });
    const b = h('button', { type: 'button', class: 'pf-box', onclick: () => api.setActive(f.key) },
      h('span', { class: 'pf-label' }, f.label), h('span', { class: 'pf-line' }, num, h('span', { class: 'pf-unit' }, f.unit)));
    boxes[f.key] = { b, num };
    return b;
  }));

  function paint() {
    for (const f of fields) {
      const { b, num } = boxes[f.key];
      const txt = show(vals[f.key]);
      num.textContent = txt;
      num.classList.toggle('blank', vals[f.key] === '');
      num.classList.toggle('sm', txt.length >= 5 && txt.length < 7);
      num.classList.toggle('xs', txt.length >= 7);
      b.classList.toggle('on', f.key === active);
    }
  }
  function press(k) {
    vibrate(8);
    let v = vals[active];
    if (k === 'del') v = v.slice(0, -1);
    else if (k === ',') { if (!decimals || v.includes('.')) return; v = (v || '0') + '.'; }
    else {
      if (v.replace('.', '').length >= max[active]) return;
      if (v.includes('.') && v.split('.')[1].length >= 1) return;
      v = v === '0' ? k : v + k;
    }
    vals[active] = v;
    api.refresh();
  }
  const key = (label, k) => {
    const b = h('button', { type: 'button', class: `kp-key${k === 'del' ? ' kp-del' : ''}`, 'aria-label': k === 'del' ? 'Apagar' : label }, k === 'del' ? ic('back', 28) : label);
    if (k === 'del') {
      let t = null;
      b.addEventListener('pointerdown', () => { t = setTimeout(() => { vals[active] = ''; vibrate(20); api.refresh(); t = null; }, 600); });
      b.addEventListener('pointerup', () => { if (t) { clearTimeout(t); press('del'); } });
      b.addEventListener('pointerleave', () => { clearTimeout(t); t = null; });
    } else b.addEventListener('click', () => press(k));
    return b;
  };
  const keypadEl = h('div', { class: 'kp-grid' }, ...'123456789'.split('').map((d) => key(d, d)), decimals ? key(',', ',') : h('span'), key('0', '0'), key('', 'del'));

  const api = {
    fieldsEl, keypadEl,
    get active() { return active; },
    get() { return Object.fromEntries(fields.map((f) => [f.key, vals[f.key] === '' ? NaN : parseFloat(vals[f.key])])); },
    set(k, v) { vals[k] = v == null || Number.isNaN(v) ? '' : String(v); api.refresh(); },
    setActive(k) { active = k; api.refresh(); },
    refresh() { paint(); onChange?.(api.get(), active); },
  };
  return api;
}
