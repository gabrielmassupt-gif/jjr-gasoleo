// Cálculos puros: nível do depósito, consumo L/h, previsão, estatísticas e relatório mensal.
export const T = (x) => +new Date(x.ts);
export const byTs = (a, b) => T(a) - T(b);

// "ajuste" fixa o nível; "enchimento" soma; abastecimento subtrai (por ordem cronológica).
export function timeline(state) {
  const ev = [
    ...state.refills.map((r) => ({ k: 'r', r, ts: T(r) })),
    ...state.fuelings.map((f) => ({ k: 'f', f, ts: T(f) })),
  ].sort((a, b) => a.ts - b.ts || (a.k === 'r' ? -1 : 1));
  let level = 0;
  const after = new Map();
  for (const e of ev) {
    if (e.k === 'r') {
      level = e.r.tipo === 'ajuste' ? e.r.nivel : level + e.r.litros;
      after.set(e.r.id, level);
    } else {
      level -= e.f.litros;
      after.set(e.f.id, level);
    }
  }
  return { level, after };
}
export const levelNow = (state) => Math.max(0, timeline(state).level);

export const machineFuelings = (state, id) => state.fuelings.filter((f) => f.machineId === id).sort(byTs);
export const lastFueling = (state, id) => machineFuelings(state, id).at(-1) ?? null;

export function lhOf(state, f) {
  const prev = machineFuelings(state, f.machineId).filter((x) => x.id !== f.id && T(x) < T(f)).at(-1);
  if (!prev) return null;
  const dh = f.horas - prev.horas;
  return dh > 0 ? f.litros / dh : null;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function machineStats(state, id, now = new Date()) {
  const list = machineFuelings(state, id);
  const lhs = list.map((f) => lhOf(state, f));
  const valid = lhs.filter((x) => x != null);
  const lastLh = lhs.at(-1) ?? null;
  const base = lastLh != null ? valid.slice(0, -1) : valid;
  const prevAvg = base.length >= 3 ? mean(base) : null;
  const monthStart = +new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    list, lhs, last: list.at(-1) ?? null, avg: mean(valid), lastLh, prevAvg,
    high: lastLh != null && prevAvg != null && lastLh > prevAvg * 1.25,
    monthLiters: list.filter((f) => T(f) >= monthStart).reduce((a, f) => a + f.litros, 0),
  };
}

// Pré-visualização enquanto o chefe escreve: trabalho, L/h, depósito e avisos.
export function preview(state, machineId, horas, litros) {
  const last = lastFueling(state, machineId);
  const level = levelNow(state);
  const out = { dh: null, lh: null, after: null, notes: [] };
  if (horas > 0 && last) {
    out.dh = horas - last.horas;
    if (out.dh < 0) out.notes.push({ kind: 'warn', id: 'horas', text: `As horas são menores que da última vez (${fmt(last.horas)} h).` });
  }
  if (litros > 0) {
    out.after = level - litros;
    if (litros > level) out.notes.push({ kind: 'warn', id: 'litros', text: `O depósito só tem ${fmt(level, 0)} L.` });
    if (out.dh > 0) {
      out.lh = litros / out.dh;
      const st = machineStats(state, machineId);
      const ref = st.avg != null && st.lhs.filter((x) => x != null).length >= 3 ? st.avg : null;
      if (ref && out.lh > ref * 1.25) out.notes.push({ kind: 'warn', id: 'lh', text: `Consumo ${Math.round((out.lh / ref - 1) * 100)}% acima do normal (média ${fmt(ref)} L/h).` });
    }
  }
  return out;
}
function fmt(n, d = 1) { const r = Math.round(n * 10 ** d) / 10 ** d; return String(r).replace('.', ','); }

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function sameDay(ts, d = new Date()) { return dayKey(new Date(ts)) === dayKey(d); }

// Dias de trabalho que o depósito ainda dá, pela média dos últimos 14 dias com abastecimentos.
export function forecast(state, now = new Date()) {
  const from = +now - 14 * 864e5;
  const recent = state.fuelings.filter((f) => T(f) >= from);
  const days = new Set(recent.map((f) => dayKey(new Date(f.ts))));
  if (days.size < 2) return null;
  const perDay = recent.reduce((a, f) => a + f.litros, 0) / days.size;
  return perDay > 0 ? { perDay, days: levelNow(state) / perDay } : null;
}

export function monthLiters(state, y, m) {
  return state.fuelings.filter((f) => { const d = new Date(f.ts); return d.getFullYear() === y && d.getMonth() === m; }).reduce((a, f) => a + f.litros, 0);
}

export function monthReport(state, y, m) {
  const start = +new Date(y, m, 1), end = +new Date(y, m + 1, 1);
  const inM = (x) => T(x) >= start && T(x) < end;
  const fuelings = state.fuelings.filter(inM).sort(byTs);
  const refills = state.refills.filter((r) => inM(r) && r.tipo === 'enchimento').sort(byTs);
  const rows = [];
  for (const mach of state.machines) {
    const all = machineFuelings(state, mach.id);
    const inMonth = all.filter(inM);
    if (!inMonth.length) continue;
    const before = all.filter((f) => T(f) < start).at(-1);
    const baseH = before ? before.horas : inMonth[0].horas;
    const used = before ? inMonth : inMonth.slice(1);
    const litros = inMonth.reduce((a, f) => a + f.litros, 0);
    const horas = inMonth.at(-1).horas - baseH;
    const lUsed = used.reduce((a, f) => a + f.litros, 0);
    rows.push({ machine: mach, count: inMonth.length, litros, horas, lh: horas > 0 && lUsed > 0 ? lUsed / horas : null });
  }
  rows.sort((a, b) => b.litros - a.litros);
  return {
    rows, fuelings, refills, count: fuelings.length,
    litros: fuelings.reduce((a, f) => a + f.litros, 0),
    horas: rows.reduce((a, r) => a + Math.max(0, r.horas), 0),
    enchido: refills.reduce((a, r) => a + r.litros, 0),
    custo: refills.reduce((a, r) => a + (r.preco ? r.litros * r.preco : 0), 0),
  };
}
