// Ecrãs de registo: abastecer (1 ecrã), encher depósito, acertar nível, nova máquina e edição.
import { state, settings, save, remove, uid } from '../store.js';
import { levelNow, lastFueling, preview } from '../calc.js';
import { h, ic, nf, parseNum, agoLabel, whenLabel, toLocalInput, toast, vibrate, openFull, openSheet, confirmSheet, popLayer, Pad } from '../ui.js';

const plate = (id, sm) => h('span', { class: `plate${sm ? ' sm' : ''}` }, id);
const cell = (el, label) => h('div', {}, el, h('span', {}, label));
const topbar = (...kids) => h('div', { class: 'layer-top' }, h('button', { type: 'button', class: 'x', 'aria-label': 'Fechar', onclick: () => popLayer() }, ic('close', 26)), ...kids);

// ---------------------------------------------------------------- abastecer
export function startFuel(machine) {
  const last = lastFueling(state, machine.id);
  const lvl = levelNow(state);
  const dh = h('b'), lh = h('b'), after = h('b');
  const calc = h('div', { class: 'calc' }, cell(dh, 'Trabalhou'), cell(lh, 'Consumo'), cell(after, 'Depósito fica'));
  const slot = h('div', { class: 'slot' });
  const cta = h('button', { type: 'button', class: 'cta' });
  let pad;

  const setCell = (el, text, dim) => { el.textContent = text; el.classList.toggle('dim', !!dim); };

  function refresh(v, active) {
    const hOk = v.horas > 0, lOk = v.litros > 0;
    const p = preview(state, machine.id, v.horas, v.litros);
    setCell(dh, p.dh != null ? `${p.dh >= 0 ? '+' : ''}${nf(p.dh)} h` : '–', p.dh == null);
    setCell(lh, p.lh != null ? `${nf(p.lh)} L/h` : '–', p.lh == null);
    setCell(after, p.after != null ? `${nf(Math.max(0, p.after), 0)} L` : `${nf(lvl, 0)} L`, p.after == null);

    slot.innerHTML = '';
    if (active === 'litros' && !p.notes.length) {
      slot.append(h('div', { class: 'chips' }, [50, 80, 100, 150, 200].map((n) => h('button', { type: 'button', class: 'chip', onclick: () => { vibrate(8); pad.set('litros', n); } }, `${n} L`))));
    } else if (p.notes.length) {
      slot.append(h('div', { class: 'note' }, ic('warn', 20), p.notes[0].text));
    } else if (active === 'horas' && !hOk) {
      slot.append(h('div', { class: 'note info' }, ic('clock', 20), last ? `Última vez: ${nf(last.horas)} h · ${agoLabel(last.ts)}` : 'Horas que o contador marca agora'));
    }

    cta.innerHTML = '';
    if (active === 'horas') { cta.className = 'cta'; cta.disabled = !hOk; cta.append('Seguinte', ic('next', 26)); }
    else { cta.className = 'cta ok'; cta.disabled = !(hOk && lOk); cta.append(ic('check', 28), 'Guardar abastecimento'); }
  }

  pad = Pad({ fields: [{ key: 'horas', label: 'Horas', unit: 'h', max: 7 }, { key: 'litros', label: 'Litros', unit: 'L', max: 5 }], onChange: refresh });

  cta.addEventListener('click', async () => {
    if (pad.active === 'horas') { pad.setActive('litros'); return; }
    const v = pad.get();
    if (!(v.horas > 0 && v.litros > 0)) return;
    cta.disabled = true;
    const rec = { id: uid(), ts: new Date().toISOString(), machineId: machine.id, horas: v.horas, litros: v.litros };
    await save('fuelings', rec);
    vibrate([20, 40, 20]);
    popLayer(() => toast(`Guardado · ${machine.id} · ${nf(v.litros, 0)} L`, { label: 'Anular', ms: 10000, kind: 'ok', onAction: async () => { await remove('fuelings', rec.id); toast('Abastecimento anulado'); } }));
  });

  openFull(h('div', {},
    topbar(plate(machine.id, true), h('div', { class: 'ttl' }, h('b', {}, machine.modelo || machine.id), h('span', {}, last ? `Última: ${nf(last.horas)} h · ${agoLabel(last.ts)}` : 'Primeiro abastecimento'))),
    h('div', { class: 'layer-body' }, pad.fieldsEl, calc, slot, pad.keypadEl, h('div', { class: 'cta-bar' }, cta))));
  pad.refresh();
}

// ---------------------------------------------------------------- encher depósito
export function startRefill() {
  const cap = settings.capacity;
  const lvl = levelNow(state);
  const missing = Math.max(0, Math.round(cap - lvl));
  let extra = { preco: '', local: '' };
  let cta;

  async function commit(litros) {
    const p = parseNum(extra.preco);
    const rec = { id: uid(), ts: new Date().toISOString(), tipo: 'enchimento', litros, preco: p > 0 ? p : undefined, local: extra.local.trim() || undefined };
    await save('refills', rec);
    vibrate([20, 40, 20]);
    popLayer(() => toast(`Depósito +${nf(litros, 0)} L`, { label: 'Anular', ms: 10000, kind: 'ok', onAction: async () => { await remove('refills', rec.id); toast('Enchimento anulado'); } }));
  }

  const pad = Pad({ fields: [{ key: 'litros', label: 'Ou escreve os litros', unit: 'L', max: 5 }], onChange: (v) => { if (cta) cta.disabled = !(v.litros > 0); } });
  cta = h('button', { type: 'button', class: 'cta ok', disabled: true, onclick: () => { const v = pad.get().litros; if (v > 0) { cta.disabled = true; commit(v); } } }, ic('check', 28), 'Guardar enchimento');
  const full = h('button', { type: 'button', class: 'cta', disabled: missing <= 0, onclick: () => { full.disabled = true; commit(missing); } },
    ic('drop', 26), missing > 0 ? `Encher até cheio · +${nf(missing, 0)} L` : 'Depósito já está cheio');
  const more = h('details', { class: 'more' }, h('summary', {}, 'Preço e local (opcional)'),
    h('label', { class: 'field' }, h('span', {}, 'Preço por litro (€)'), h('input', { class: 'input', inputmode: 'decimal', oninput: (e) => (extra.preco = e.target.value) })),
    h('label', { class: 'field' }, h('span', {}, 'Local / posto'), h('input', { class: 'input', oninput: (e) => (extra.local = e.target.value) })));

  openFull(h('div', {},
    topbar(h('div', { class: 'ttl' }, h('b', {}, 'Encher depósito'), h('span', {}, `Agora ${nf(lvl, 0)} de ${nf(cap, 0)} L`))),
    h('div', { class: 'layer-body' }, full, pad.fieldsEl, pad.keypadEl, more, h('div', { class: 'cta-bar' }, cta))));
  pad.refresh();
}

// ---------------------------------------------------------------- acertar nível
export function adjustLevel() {
  const known = state.refills.length > 0;
  let btn;
  const pad = Pad({ fields: [{ key: 'litros', label: 'Litros no depósito agora', unit: 'L', value: known ? Math.round(levelNow(state)) : '', max: 5 }], onChange: (v) => { if (btn) btn.disabled = !(v.litros >= 0); } });
  btn = h('button', { type: 'button', class: 'cta', onclick: async () => {
    const v = pad.get().litros;
    if (!(v >= 0)) return;
    await save('refills', { id: uid(), ts: new Date().toISOString(), tipo: 'ajuste', litros: null, nivel: v });
    s.close(() => toast('Nível do depósito atualizado', { kind: 'ok' }));
  } }, 'Guardar nível');
  const s = openSheet('Quanto tem o depósito?', h('div', { style: 'display:grid;gap:10px' }, pad.fieldsEl, pad.keypadEl, btn));
  pad.refresh();
}

// ---------------------------------------------------------------- nova máquina
export function newMachine(onDone) {
  const id = h('input', { class: 'input', placeholder: 'Ex.: C12', autocapitalize: 'characters', autocomplete: 'off', maxlength: '12' });
  const modelo = h('input', { class: 'input', placeholder: 'Ex.: Caterpillar 930', autocomplete: 'off', maxlength: '40' });
  const err = h('div', { class: 'form-err' });
  const s = openSheet('Nova máquina', h('div', {},
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, 'Só é preciso fazer isto uma vez por máquina.'),
    h('label', { class: 'field' }, h('span', {}, 'ID da máquina'), id),
    h('label', { class: 'field' }, h('span', {}, 'Modelo'), modelo), err,
    h('button', { type: 'button', class: 'cta', onclick: async () => {
      const code = id.value.trim().toUpperCase();
      if (!code) { err.textContent = 'Escreve o ID da máquina.'; id.focus(); return; }
      let m = state.machines.find((x) => x.id.toLowerCase() === code.toLowerCase());
      if (!m) { m = { id: code, modelo: modelo.value.trim(), criadaEm: new Date().toISOString() }; await save('machines', m); }
      s.close(() => onDone?.(m));
    } }, 'Guardar e abastecer')));
}

// ---------------------------------------------------------------- editar registos
const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
const num = (v) => String(v).replace('.', ',');

export function editFueling(f) {
  const sel = h('select', { class: 'input' }, state.machines.map((m) => h('option', { value: m.id, selected: m.id === f.machineId }, `${m.id} · ${m.modelo}`)));
  const when = h('input', { class: 'input', type: 'datetime-local', value: toLocalInput(f.ts) });
  const horas = h('input', { class: 'input', inputmode: 'decimal', value: num(f.horas) });
  const litros = h('input', { class: 'input', inputmode: 'decimal', value: num(f.litros) });
  const err = h('div', { class: 'form-err' });
  const s = openSheet('Editar abastecimento', h('div', {}, field('Máquina', sel), field('Data e hora', when), field('Horas', horas), field('Litros', litros), err,
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn danger-soft', onclick: async () => { if (await confirmSheet('Eliminar este abastecimento?', 'Eliminar', true)) { await remove('fuelings', f.id); s.close(() => toast('Eliminado')); } } }, ic('trash', 20), 'Eliminar'),
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const hh = parseNum(horas.value), ll = parseNum(litros.value);
        if (!(hh > 0) || !(ll > 0) || !when.value) { err.textContent = 'Confirma as horas, os litros e a data.'; return; }
        // a hora só muda se o utilizador a alterar (o campo só tem minutos)
        await save('fuelings', { ...f, machineId: sel.value, ts: when.value === toLocalInput(f.ts) ? f.ts : new Date(when.value).toISOString(), horas: hh, litros: ll });
        s.close(() => toast('Guardado', { kind: 'ok' }));
      } }, 'Guardar'))));
}

export function editRefill(r) {
  if (r.tipo === 'ajuste') {
    const s = openSheet('Acerto de nível', h('div', {}, h('p', { class: 'confirm-msg' }, `Nível acertado para ${nf(r.nivel, 0)} L (${whenLabel(r.ts)}).`),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn danger-soft', onclick: async () => { await remove('refills', r.id); s.close(() => toast('Eliminado')); } }, ic('trash', 20), 'Eliminar'),
        h('button', { type: 'button', class: 'btn', onclick: () => s.close() }, 'Fechar'))));
    return;
  }
  const when = h('input', { class: 'input', type: 'datetime-local', value: toLocalInput(r.ts) });
  const litros = h('input', { class: 'input', inputmode: 'decimal', value: num(r.litros) });
  const preco = h('input', { class: 'input', inputmode: 'decimal', placeholder: 'Opcional', value: r.preco ? num(r.preco) : '' });
  const local = h('input', { class: 'input', placeholder: 'Opcional', value: r.local || '' });
  const err = h('div', { class: 'form-err' });
  const s = openSheet('Editar enchimento', h('div', {}, field('Data e hora', when), field('Litros', litros), field('Preço por litro (€)', preco), field('Local', local), err,
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn danger-soft', onclick: async () => { if (await confirmSheet('Eliminar este enchimento?', 'Eliminar', true)) { await remove('refills', r.id); s.close(() => toast('Eliminado')); } } }, ic('trash', 20), 'Eliminar'),
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const ll = parseNum(litros.value), p = parseNum(preco.value);
        if (!(ll > 0) || !when.value) { err.textContent = 'Confirma os litros e a data.'; return; }
        await save('refills', { ...r, ts: when.value === toLocalInput(r.ts) ? r.ts : new Date(when.value).toISOString(), litros: ll, preco: p > 0 ? p : undefined, local: local.value.trim() || undefined });
        s.close(() => toast('Guardado', { kind: 'ok' }));
      } }, 'Guardar'))));
}
