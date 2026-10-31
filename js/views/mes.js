// Mês: totais, barras por máquina (mesma escala), partilha, Excel e PDF.
import { state } from '../store.js';
import { monthReport, lhOf } from '../calc.js';
import { h, ic, nf, dmy, hm, monthName, whenLabel, toast } from '../ui.js';
import { brandRow } from './header.js';

const now = new Date();
const view = { y: now.getFullYear(), m: now.getMonth() };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function shareText(rep) {
  const l = [`Gasóleo JJR · ${cap(monthName(view.y, view.m))}`, `Consumo: ${nf(rep.litros, 0)} L em ${rep.count} abastecimentos`, `Enchimentos do depósito: ${nf(rep.enchido, 0)} L${rep.custo ? ` (${nf(rep.custo, 2)} €)` : ''}`, ''];
  rep.rows.forEach((r) => l.push(`${r.machine.id}${r.machine.modelo ? ' ' + r.machine.modelo : ''}: ${nf(r.litros, 0)} L · ${nf(r.horas)} h${r.lh ? ` · ${nf(r.lh)} L/h` : ''}`));
  return l.join('\n');
}
function csv(rep) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Data', 'Hora', 'Máquina', 'Modelo', 'Horas', 'Litros', 'L/h'].map(q).join(';')];
  rep.fuelings.forEach((f) => { const m = state.machines.find((x) => x.id === f.machineId); const lh = lhOf(state, f); rows.push([dmy(f.ts), hm(f.ts), f.machineId, m?.modelo ?? '', String(f.horas).replace('.', ','), String(f.litros).replace('.', ','), lh ? nf(lh) : ''].map(q).join(';')); });
  return '﻿' + rows.join('\r\n');
}

export function renderMes(root, a) {
  const rep = monthReport(state, view.y, view.m);
  const isNow = view.y === now.getFullYear() && view.m === now.getMonth();
  const shift = (d) => { const t = new Date(view.y, view.m + d, 1); view.y = t.getFullYear(); view.m = t.getMonth(); renderMes(root, a); };
  const max = Math.max(1, ...rep.rows.map((r) => r.litros));

  const bars = rep.rows.length
    ? h('div', { class: 'card bars' }, rep.rows.map((r) => h('div', { class: 'bar-row' },
      h('span', { class: 'bar-id' }, r.machine.id),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(r.litros / max) * 100}%` })),
      h('div', { class: 'bar-txt' }, h('span', {}, `${nf(r.horas)} h${r.lh ? ` · ${nf(r.lh)} L/h` : ''}`), h('b', {}, `${nf(r.litros, 0)} L`)))))
    : h('div', { class: 'empty' }, ic('mes', 36), h('b', {}, 'Sem abastecimentos neste mês'));

  const actions = h('div', { class: 'actions' },
    h('button', { type: 'button', class: 'btn', onclick: async () => { const text = shareText(rep); try { if (navigator.share) await navigator.share({ title: 'Gasóleo JJR', text }); else { await navigator.clipboard.writeText(text); toast('Resumo copiado', { kind: 'ok' }); } } catch {} } }, ic('share', 20), 'Enviar'),
    h('button', { type: 'button', class: 'btn', onclick: () => { const x = h('a', { href: URL.createObjectURL(new Blob([csv(rep)], { type: 'text/csv;charset=utf-8' })), download: `gasoleo-${view.y}-${String(view.m + 1).padStart(2, '0')}.csv` }); document.body.append(x); x.click(); x.remove(); } }, ic('download', 20), 'Excel'),
    h('button', { type: 'button', class: 'btn', onclick: () => window.print() }, ic('print', 20), 'PDF'));

  const regs = [...rep.fuelings.map((x) => ({ k: 'f', x })), ...rep.refills.map((x) => ({ k: 'r', x }))].sort((p, q) => +new Date(q.x.ts) - +new Date(p.x.ts));

  root.replaceChildren(
    h('header', { class: 'hero compact' }, brandRow(a.settings), h('div', { class: 'page-title' }, 'Mês'),
      h('div', { class: 'month' },
        h('button', { type: 'button', class: 'arr', 'aria-label': 'Mês anterior', onclick: () => shift(-1) }, ic('back', 26)),
        h('div', { class: 'name' }, monthName(view.y, view.m)),
        h('button', { type: 'button', class: 'arr', 'aria-label': 'Mês seguinte', disabled: isNow, onclick: () => shift(1) }, ic('next', 26))),
      h('div', { class: 'big3' },
        h('div', {}, h('b', {}, nf(rep.litros, 0), h('small', {}, 'L')), h('span', {}, 'Consumo')),
        h('div', {}, h('b', {}, rep.horas > 0 ? nf(rep.horas, 0) : '–', rep.horas > 0 ? h('small', {}, 'h') : null), h('span', {}, 'Trabalho')),
        h('div', {}, h('b', {}, nf(rep.enchido, 0), h('small', {}, 'L')), h('span', {}, 'Enchimentos')))),
    h('main', {}, h('div', { class: 'sec' }, h('h2', {}, 'Por máquina'), h('span', {}, rep.custo ? `Combustível ${nf(rep.custo, 0)} €` : '')), bars,
      rep.rows.length ? actions : null,
      regs.length ? [h('div', { class: 'sec no-print' }, h('h2', {}, 'Registos do mês')), h('div', { class: 'card list no-print' }, regs.map(({ k, x }) => k === 'f'
        ? h('button', { type: 'button', class: 'li', onclick: () => a.editFueling(x) }, h('span', { class: 'plate sm' }, x.machineId), h('span', { class: 'li-main' }, h('b', {}, `${nf(x.horas)} h`), h('small', {}, whenLabel(x.ts))), h('span', { class: 'li-val' }, `${nf(x.litros)} L`))
        : h('button', { type: 'button', class: 'li', onclick: () => a.editRefill(x) }, h('span', { class: 'li-ic' }, ic('drop', 22)), h('span', { class: 'li-main' }, h('b', {}, 'Enchimento'), h('small', {}, whenLabel(x.ts))), h('span', { class: 'li-val plus' }, `+${nf(x.litros, 0)} L`))))] : null));
}
