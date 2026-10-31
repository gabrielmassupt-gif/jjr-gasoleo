// Máquinas: análise por máquina (horas, consumo médio, litros do mês) e histórico.
import { state, save } from '../store.js';
import { machineStats, lhOf, T } from '../calc.js';
import { h, ic, nf, whenLabel, openSheet } from '../ui.js';
import { brandRow } from './header.js';

function spark(vals) {
  if (vals.length < 2) return '';
  const W = 300, H = 56, max = Math.max(...vals) * 1.08, min = Math.min(...vals) * 0.92;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - ((v - min) / (max - min || 1)) * H]);
  return h('div', { class: 'spark', html: `<svg viewBox="0 0 ${W} ${H + 8}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4.5" fill="currentColor"/></svg>` });
}

export function renderMaquinas(root, a) {
  const list = state.machines.map((m) => ({ m, s: machineStats(state, m.id) })).sort((x, y) => (y.s.last ? T(y.s.last) : 0) - (x.s.last ? T(x.s.last) : 0));
  root.replaceChildren(
    h('header', { class: 'hero compact' }, brandRow(a.settings), h('div', { class: 'page-title' }, 'Máquinas')),
    h('main', {}, list.length
      ? h('div', { class: 'stack' }, list.map(({ m, s }) => h('button', { type: 'button', class: 'card mrow', onclick: () => machineSheet(m, a) },
        h('div', { class: 'mrow-top' }, h('span', { class: 'plate' }, m.id), h('span', { class: 'model' }, m.modelo || 'Sem modelo'), s.high ? h('span', { class: 'badge' }, 'Consumo alto') : null),
        h('div', { class: 'stats3' },
          h('div', {}, h('b', {}, s.last ? `${nf(s.last.horas)}` : '–'), h('span', {}, 'horas')),
          h('div', {}, h('b', {}, s.avg ? nf(s.avg) : '–'), h('span', {}, 'L/h médio')),
          h('div', {}, h('b', {}, nf(s.monthLiters, 0)), h('span', {}, 'litros no mês'))))))
      : h('div', { class: 'empty' }, ic('maq', 36), h('b', {}, 'Ainda não há máquinas'), h('span', {}, 'Adiciona a primeira em Hoje → Nova máquina.'))));
}

function machineSheet(m, a) {
  const s = machineStats(state, m.id);
  const lhs = s.lhs.filter((x) => x != null);
  const recent = [...s.list].reverse().slice(0, 10);
  const sh = openSheet(`${m.id} · ${m.modelo || 'Sem modelo'}`, h('div', {},
    s.high ? h('div', { class: 'note', style: 'margin-bottom:10px' }, ic('warn', 20), `Último consumo ${nf(s.lastLh)} L/h, acima do normal (${nf(s.prevAvg)} L/h).`) : null,
    lhs.length > 1 ? h('div', {}, h('div', { class: 'spark-cap' }, 'Consumo L/h ao longo do tempo'), spark(lhs.slice(-12))) : null,
    recent.length
      ? h('div', { class: 'card list', style: 'margin-top:10px;box-shadow:none;background:var(--bg)' }, recent.map((f) => h('button', { type: 'button', class: 'li', onclick: () => sh.close(() => a.editFueling(f)) },
        h('span', { class: 'li-main' }, h('b', {}, `${nf(f.horas)} h`), h('small', {}, whenLabel(f.ts))),
        h('span', { class: 'li-val' }, `${nf(f.litros)} L`, lhOf(state, f) ? h('small', {}, `${nf(lhOf(state, f))} L/h`) : null))))
      : h('p', { class: 'confirm-msg' }, 'Sem abastecimentos ainda.'),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: () => sh.close(() => renameMachine(m)) }, ic('edit', 20), 'Modelo'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => sh.close(() => a.fuel(m)) }, ic('fuel', 20), 'Abastecer'))));
}

function renameMachine(m) {
  const input = h('input', { class: 'input', value: m.modelo, maxlength: '40' });
  const sh = openSheet('Modelo da máquina', h('div', {}, h('label', { class: 'field' }, h('span', {}, m.id), input),
    h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: () => sh.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'btn primary', onclick: async () => { await save('machines', { ...m, modelo: input.value.trim() }); sh.close(); } }, 'Guardar'))));
}
