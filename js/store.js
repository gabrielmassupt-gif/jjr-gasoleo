// Estado em memória (espelho do IndexedDB) e definições.
import * as idb from './db.js';
import * as sync from './sync.js';
import { seedDemo } from './demo.js';

const KEY = 'jjr-gasoleo-v2';
const defaults = { nome: 'Carlos Costa', capacity: 600, threshold: 100, url: '', token: '', demo: false, onboarded: false };
export const settings = { ...defaults };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}

export const state = { machines: [], fuelings: [], refills: [] };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((f) => f());

export function setSettings(patch) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  emit();
}
export const firstName = () => (settings.nome || '').trim().split(/\s+/)[0] || 'Chefe';
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export async function init() {
  await idb.open(settings.demo ? 'jjr-gasoleo-demo' : 'jjr-gasoleo');
  for (const k of Object.keys(state)) state[k] = await idb.getAll(k);
  if (settings.demo && !state.machines.length) {
    const seed = seedDemo(settings);
    for (const k of Object.keys(seed)) for (const r of seed[k]) await idb.put(k, r);
    Object.assign(state, seed);
  }
  try { navigator.storage?.persist?.(); } catch {}
  sync.init({ settings: () => settings, state: () => state });
}

export async function save(kind, rec) {
  const i = state[kind].findIndex((x) => x.id === rec.id);
  if (i >= 0) state[kind][i] = rec; else state[kind].push(rec);
  await idb.put(kind, rec);
  sync.enqueue(kind, 'upsert', rec, state);
  emit();
}
export async function remove(kind, id) {
  state[kind] = state[kind].filter((x) => x.id !== id);
  await idb.del(kind, id);
  sync.enqueue(kind, 'delete', { id }, state);
  emit();
}

export async function restore(json) {
  const machines = (json.Maquinas || []).map((r) => ({ id: String(r.id), modelo: String(r.modelo || ''), criadaEm: r.criada_em || new Date().toISOString() }));
  const fuelings = (json.Abastecimentos || []).map((r) => ({ id: String(r.id), ts: new Date(r.ts).toISOString(), machineId: String(r.maquina), horas: Number(r.horas), litros: Number(r.litros) }));
  const refills = (json.Deposito || []).map((r) => ({ id: String(r.id), ts: new Date(r.ts).toISOString(), tipo: r.tipo === 'ajuste' ? 'ajuste' : 'enchimento',
    litros: r.litros === '' ? null : Number(r.litros), nivel: r.tipo === 'ajuste' ? Number(r.nivel_depois) : undefined,
    preco: r.preco_litro === '' ? undefined : Number(r.preco_litro), local: r.local || undefined }));
  for (const [k, list] of Object.entries({ machines, fuelings, refills })) {
    await idb.clear(k);
    for (const r of list) await idb.put(k, r);
    state[k] = list;
  }
  if (refills.length) setSettings({ onboarded: true });
  emit();
  return { machines: machines.length, fuelings: fuelings.length, refills: refills.length };
}
