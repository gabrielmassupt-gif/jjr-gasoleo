// Sincronização com a folha Google (Apps Script). O telemóvel é a fonte de verdade; cada
// alteração entra numa fila (outbox) e segue quando houver rede. Última alteração por id ganha.
import * as idb from './db.js';
import { lhOf, timeline } from './calc.js';

let cfg;
let status = { pending: 0, error: null, sending: false };
const listeners = new Set();
let timer;
export const onStatus = (fn) => { listeners.add(fn); fn(status); };
const set = (p) => { status = { ...status, ...p }; listeners.forEach((f) => f(status)); };
export const enabled = () => { const s = cfg.settings(); return !s.demo && !!s.url && !!s.token; };

export function init(c) {
  cfg = c;
  addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
  setInterval(flush, 60000);
  refresh().then(flush);
}
async function refresh() { const all = await idb.getAll('outbox'); set({ pending: all.length }); return all; }

const p2 = (n) => String(n).padStart(2, '0');
const dmy = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
const hm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const rnd = (n, d = 1) => (n == null ? '' : Math.round(n * 10 ** d) / 10 ** d);
const SHEET = { fuelings: 'Abastecimentos', refills: 'Deposito', machines: 'Maquinas' };

function toRow(kind, rec, state) {
  const d = new Date(rec.ts || rec.criadaEm || Date.now());
  if (kind === 'fuelings') {
    const m = state.machines.find((x) => x.id === rec.machineId);
    return { id: rec.id, data: dmy(d), hora: hm(d), maquina: rec.machineId, modelo: m?.modelo ?? '', horas: rec.horas, litros: rec.litros,
      l_por_hora: rnd(lhOf(state, rec)), deposito_restante: rnd(Math.max(0, timeline(state).after.get(rec.id) ?? 0), 0), ts: rec.ts };
  }
  if (kind === 'refills') {
    return { id: rec.id, data: dmy(d), hora: hm(d), tipo: rec.tipo, litros: rec.litros ?? '', nivel_depois: rnd(timeline(state).after.get(rec.id), 0),
      preco_litro: rec.preco ?? '', local: rec.local ?? '', ts: rec.ts };
  }
  return { id: rec.id, modelo: rec.modelo, criada_em: rec.criadaEm };
}

export async function enqueue(kind, op, rec, state) {
  if (cfg.settings().demo) return;
  const sheet = SHEET[kind];
  const n = Math.max(0, ...(await idb.getAll('outbox')).map((x) => x.n)) + 1;
  await idb.put('outbox', { key: `${sheet}:${rec.id}`, sheet, op, id: rec.id, row: op === 'upsert' ? toRow(kind, rec, state) : null, n });
  await refresh();
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}
export async function enqueueAll(state) {
  for (const m of state.machines) await enqueue('machines', 'upsert', m, state);
  for (const r of state.refills) await enqueue('refills', 'upsert', r, state);
  for (const f of state.fuelings) await enqueue('fuelings', 'upsert', f, state);
}

const tokenErr = (j) => new Error(j.error === 'token' ? 'Código de ligação inválido' : j.error || 'Erro no envio');

export async function flush() {
  if (status.sending || !cfg || !enabled() || !navigator.onLine) return;
  const ops = await refresh();
  if (!ops.length) return;
  const { url, token } = cfg.settings();
  set({ sending: true });
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, ops: ops.map(({ sheet, op, id, row }) => ({ sheet, op, id, row })) }) });
    const j = await res.json();
    if (!j.ok) throw tokenErr(j);
    const now = await idb.getAll('outbox');
    for (const s of ops) { const cur = now.find((x) => x.key === s.key); if (cur && cur.n === s.n) await idb.del('outbox', s.key); }
    set({ error: null });
  } catch (e) { set({ error: e.message || 'Sem ligação' }); }
  finally { set({ sending: false }); refresh(); }
}

const q = (action) => { const { url, token } = cfg.settings(); return `${url}${url.includes('?') ? '&' : '?'}action=${action}&token=${encodeURIComponent(token)}`; };
export async function pull() { const j = await (await fetch(q('all'))).json(); if (!j.ok) throw tokenErr(j); return j; }
export async function test() { const j = await (await fetch(q('ping'))).json(); if (!j.ok) throw tokenErr(j); return true; }
