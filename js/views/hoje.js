// Hoje: depósito em destaque (topo de asfalto), máquinas para tocar e registos do dia.
import { state, settings, firstName } from '../store.js';
import { timeline, forecast, lastFueling, machineStats, sameDay, monthLiters, T } from '../calc.js';
import { h, ic, nf, saudacao, dayLabel, agoLabel, whenLabel, hm } from '../ui.js';
import { brandRow } from './header.js';

let prevLevel = null;

function countTo(el, from, to) {
  const t0 = performance.now(), dur = 900;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = nf(Math.round(from + (to - from) * e), 0);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function renderHoje(root, a) {
  const known = state.refills.length > 0;
  const level = Math.max(0, timeline(state).level);
  const cap = settings.capacity, thr = settings.threshold;
  const pct = Math.max(0, Math.min(100, (level / cap) * 100));
  const tone = level <= thr * 0.4 ? 'bad' : level <= thr ? 'warn' : 'ok';
  const fc = forecast(state);

  const num = h('span', { class: 'tank-num' }, nf(prevLevel ?? 0, 0));
  const fill = h('div', { class: 'road-fill', style: `width:${prevLevel == null ? 0 : Math.max(0, Math.min(100, (prevLevel / cap) * 100))}%` });
  const resPct = Math.min(100, (thr / cap) * 100);

  const forecastText = !known ? 'Diz quantos litros tem o depósito.'
    : fc ? h('span', {}, 'Dá para cerca de ', h('b', {}, `${fc.days < 1 ? 'menos de 1 dia' : nf(fc.days, 1).replace(',0', '') + (Math.round(fc.days * 10) / 10 === 1 ? ' dia' : ' dias')}`), ' de trabalho')
    : 'Previsão com 2 dias de registos';

  const hero = h('header', { class: 'hero' },
    brandRow(a.settings),
    h('div', { class: 'greet' }, `${saudacao()}, ${firstName()}`, h('small', {}, dayLabel())),
    h('button', { type: 'button', class: 'tank', 'data-tone': known ? tone : 'ok', style: 'display:block;width:100%;text-align:left;color:inherit', 'aria-description': 'Toque para acertar o nível do depósito', onclick: a.adjust },
      h('div', { class: 'tank-label' }, 'Depósito da carrinha'),
      h('div', { class: 'tank-row' }, known ? num : h('span', { class: 'tank-num' }, '–'), h('div', { class: 'tank-of' }, 'litros', h('b', {}, `de ${nf(cap, 0)}`))),
      h('div', { class: 'road' }, fill, h('div', { class: 'road-res', style: `left:${resPct}%` })),
      h('div', { class: 'ticks' }, h('span', {}, '0'), h('span', { class: 'res', style: `left:${resPct}%` }, 'reserva'), h('span', {}, `${nf(cap, 0)} L`))),
    known && level <= thr ? h('div', { class: `alert-low ${tone === 'bad' ? 'bad' : ''}` }, ic('warn', 26), h('span', {}, `Só restam ${nf(level, 0)} L · hora de encher`)) : null,
    h('div', { class: 'forecast' }, ic('clock', 22), h('span', {}, forecastText), h('button', { type: 'button', class: 'btn-fill', onclick: a.refill }, ic('drop', 20), 'Encher')));

  // máquinas, as usadas mais recentemente primeiro
  const machines = [...state.machines].sort((x, y) => (lastFueling(state, y.id) ? T(lastFueling(state, y.id)) : 0) - (lastFueling(state, x.id) ? T(lastFueling(state, x.id)) : 0));
  const grid = h('div', { class: 'grid' }, machines.map((m) => {
    const last = lastFueling(state, m.id);
    const st = machineStats(state, m.id);
    return h('button', { type: 'button', class: 'mcard', onclick: () => a.fuel(m), 'aria-label': `Abastecer ${m.id}` },
      h('span', { class: 'plate' }, m.id), h('span', { class: `dot ${st.high ? 'warn' : last ? '' : 'none'}` }),
      h('span', { class: 'model' }, m.modelo || 'Sem modelo'),
      h('span', { class: 'meta' }, last ? [h('b', {}, `${nf(last.horas)} h`), h('span', {}, agoLabel(last.ts))] : h('span', {}, 'Primeiro abastecimento')));
  }), h('button', { type: 'button', class: 'mcard add', onclick: a.newMachine }, ic('plus', 34), h('span', {}, 'Nova máquina')));

  const today = [...state.fuelings.filter((f) => sameDay(f.ts)).map((x) => ({ k: 'f', x })), ...state.refills.filter((r) => sameDay(r.ts) && r.tipo === 'enchimento').map((x) => ({ k: 'r', x }))]
    .sort((p, q) => T(q.x) - T(p.x));
  const litrosHoje = state.fuelings.filter((f) => sameDay(f.ts)).reduce((s, f) => s + f.litros, 0);
  const list = today.length
    ? h('div', { class: 'card list' }, today.map(({ k, x }) => k === 'f'
      ? h('button', { type: 'button', class: 'li', onclick: () => a.editFueling(x) }, h('span', { class: 'plate sm' }, x.machineId),
        h('span', { class: 'li-main' }, h('b', {}, state.machines.find((m) => m.id === x.machineId)?.modelo || x.machineId), h('small', {}, `${nf(x.horas)} h · ${hm(x.ts)}`)),
        h('span', { class: 'li-val' }, `${nf(x.litros)} L`))
      : h('button', { type: 'button', class: 'li', onclick: () => a.editRefill(x) }, h('span', { class: 'li-ic' }, ic('drop', 22)),
        h('span', { class: 'li-main' }, h('b', {}, 'Enchimento do depósito'), h('small', {}, whenLabel(x.ts))),
        h('span', { class: 'li-val plus' }, `+${nf(x.litros, 0)} L`))))
    : h('div', { class: 'empty' }, ic('fuel', 34), h('b', {}, 'Ainda sem registos hoje'), h('span', {}, 'Toca numa máquina para abastecer.'));

  const now = new Date();
  root.replaceChildren(hero,
    h('main', {},
      h('div', { class: 'sec' }, h('h2', {}, 'Quem abasteceu?'), h('span', {}, 'toca na máquina')), grid,
      h('div', { class: 'sec', style: 'margin-top:26px' }, h('h2', {}, 'Hoje'), h('span', {}, today.length ? `${nf(litrosHoje, 0)} L · este mês ${nf(monthLiters(state, now.getFullYear(), now.getMonth()), 0)} L` : '')), list));

  // animação: o depósito "corre" do valor anterior para o atual
  if (known) {
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${pct}%`; }));
    countTo(num, prevLevel ?? 0, level);
    prevLevel = level;
  }
}
