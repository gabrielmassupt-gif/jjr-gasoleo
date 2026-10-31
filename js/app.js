// Arranque: separadores, topo de apresentação, estado de envio e atualização automática.
import * as store from './store.js';
import * as sync from './sync.js';
import { state, settings, setSettings, onChange } from './store.js';
import { $, $$, h, ic, toast, layersOpen, onIdle } from './ui.js';
import { VERSION } from './version.js';
import { setSync } from './views/header.js';
import { renderHoje } from './views/hoje.js';
import { renderMaquinas } from './views/maquinas.js';
import { renderMes } from './views/mes.js';
import { openSettings } from './views/definicoes.js';
import { startFuel, startRefill, adjustLevel, newMachine, editFueling, editRefill } from './views/registo.js';
import { showIntro } from './views/onboarding.js';

let current = 'hoje';
let reg = null;
let updateReady = false;

const actions = {
  settings: () => openSettings({ checkUpdate }),
  adjust: () => adjustLevel(),
  refill: () => startRefill(),
  fuel: (m) => startFuel(m),
  newMachine: () => newMachine((m) => startFuel(m)),
  editFueling, editRefill,
};
const VIEWS = { hoje: renderHoje, maquinas: renderMaquinas, mes: renderMes };

function go(view) {
  current = view;
  $$('.tab').forEach((t) => { t.classList.toggle('on', t.dataset.view === view); t.setAttribute('aria-current', t.dataset.view === view ? 'page' : 'false'); });
  render();
  scrollTo({ top: 0 });
}
function render() {
  VIEWS[current]($('#view'), actions);
  setSync(...syncNow);
}

// ---------- estado de envio (ponto no topo) ----------
let syncNow = ['ok', ''];
function bindSync() {
  const paint = (st) => {
    if (settings.demo) syncNow = ['off', 'Apresentação'];
    else if (!sync.enabled()) syncNow = ['off', 'Só neste telemóvel'];
    else if (!navigator.onLine) syncNow = ['off', st.pending ? `Sem rede · ${st.pending} por enviar` : 'Sem rede'];
    else if (st.error) syncNow = ['bad', st.error];
    else if (st.pending || st.sending) syncNow = ['wait', `${st.pending} por enviar`];
    else syncNow = ['ok', 'Sincronizado'];
    setSync(...syncNow);
  };
  sync.onStatus(paint);
  addEventListener('online', () => paint({ pending: 0 }));
  addEventListener('offline', () => paint({ pending: 0 }));
}

// ---------- atualização automática ----------
// 1) o service worker procura versão nova ao abrir e ao voltar à app; 2) se houver, recarrega
// sozinho (sem interromper um registo); 3) se algo falhar, version.json mostra um botão manual.
async function checkUpdate(manual = false) {
  try {
    await reg?.update();
    const j = await (await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    if (j.v !== VERSION) {
      if (updateReady) return applyUpdate();
      if (manual) toast('A atualizar…');
      setTimeout(() => { if (j.v !== VERSION) showUpdateBanner(true); }, manual ? 4000 : 9000);
    } else if (manual) toast(`Está na versão mais recente (${VERSION}) ✓`, { kind: 'ok' });
  } catch { if (manual) toast('Sem rede para verificar'); }
}
async function hardRefresh() {
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.reload();
}
function applyUpdate() {
  try { sessionStorage.setItem('jjr-updated', '1'); } catch {}
  location.reload();
}
function showUpdateBanner(hard) {
  if ($('#upd')) return;
  $('#toasts').append(h('div', { class: 'toast in', id: 'upd' }, h('span', {}, 'Nova versão disponível'), h('button', { type: 'button', onclick: hard ? hardRefresh : applyUpdate }, 'Atualizar')));
}
function setupUpdates() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((r) => {
    reg = r;
    checkUpdate();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
    setInterval(checkUpdate, 30 * 60 * 1000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; } // 1.ª instalação a assumir o controlo: não é uma atualização
    updateReady = true;
    if (layersOpen()) { showUpdateBanner(false); onIdle(applyUpdate); } else applyUpdate();
  });
  try { if (sessionStorage.getItem('jjr-updated')) { sessionStorage.removeItem('jjr-updated'); setTimeout(() => toast(`App atualizada ✓ (${VERSION})`, { kind: 'ok' }), 600); } } catch {}
}

// ---------- ligação por link: #setup=<url>&t=<código>&n=<nome> ----------
function applySetupFromHash() {
  if (!location.hash.startsWith('#setup=')) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const url = p.get('setup'), t = p.get('t');
  if (!(url && t)) return false;
  setSettings({ url, token: t, demo: false, ...(p.get('n') ? { nome: p.get('n') } : {}) });
  return true;
}

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) { setSettings({ demo: true }); history.replaceState(null, '', location.pathname); }
  const linked = applySetupFromHash();
  await store.init();

  document.body.classList.toggle('demo-on', settings.demo);
  if (settings.demo) {
    $('#demo-bar').hidden = false;
    $('#demo-exit').onclick = () => { setSettings({ demo: false }); location.reload(); };
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.view)));
  onChange(() => { render(); });
  bindSync();
  setupUpdates();
  go('hoje');
  document.body.classList.add('ready');
  if (linked) toast('Ligado à folha Google ✓', { kind: 'ok' });

  if (!settings.demo && !settings.onboarded && state.refills.length === 0) {
    // telemóvel novo ligado a uma folha que já tem registos: recupera tudo em vez de recomeçar
    if (sync.enabled() && navigator.onLine) {
      try {
        const j = await Promise.race([sync.pull(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
        if (j.Deposito?.length) { const n = await store.restore(j); toast(`Dados recuperados da folha ✓ (${n.fuelings} abastecimentos)`, { kind: 'ok' }); go('hoje'); return; }
      } catch {}
    }
    showIntro(() => go('hoje'));
  }
}
boot();
