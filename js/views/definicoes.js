// Definições (folha a partir do avatar): nome, depósito, folha Google, apresentação e versão.
import * as store from '../store.js';
import * as sync from '../sync.js';
import { state, settings, setSettings } from '../store.js';
import { h, ic, parseNum, openSheet, confirmSheet, toast } from '../ui.js';
import { VERSION } from '../version.js';
import { adjustLevel } from './registo.js';

export function openSettings({ checkUpdate }) {
  const numField = (label, key, unit, min) => h('label', { class: 'field' }, h('span', {}, `${label} (${unit})`),
    h('input', { class: 'input', inputmode: 'numeric', value: String(settings[key]), onchange: (e) => { const n = parseNum(e.target.value); if (n >= min) setSettings({ [key]: Math.round(n) }); else e.target.value = settings[key]; } }));
  const urlIn = h('input', { class: 'input', placeholder: 'https://script.google.com/…', value: settings.url, autocapitalize: 'off', autocorrect: 'off' });
  const tokIn = h('input', { class: 'input', placeholder: 'Código secreto', value: settings.token, autocapitalize: 'off', autocorrect: 'off' });
  const msg = h('div', { class: 'form-note' });
  const say = (t, kind) => { msg.textContent = t; msg.className = `form-note ${kind || ''}`; };

  const s = openSheet('Definições', h('div', {},
    h('label', { class: 'field' }, h('span', {}, 'Nome do chefe de equipa'), h('input', { class: 'input', value: settings.nome, maxlength: '40', onchange: (e) => setSettings({ nome: e.target.value.trim() || 'Chefe' }) })),
    h('div', { class: 'row2' }, numField('Capacidade', 'capacity', 'L', 1), numField('Reserva', 'threshold', 'L', 0)),
    h('button', { type: 'button', class: 'btn', style: 'width:100%', onclick: () => s.close(() => adjustLevel()) }, ic('drop', 20), 'Acertar nível do depósito'),

    h('div', { class: 'set-sec' }, 'Folha Google'),
    h('p', { class: 'muted' }, settings.url && settings.token ? 'Ligada. Cada registo é enviado sozinho.' : 'Ainda não ligada: os registos ficam só neste telemóvel.'),
    h('details', { class: 'more' }, h('summary', {}, 'Ligação'),
      h('label', { class: 'field' }, h('span', {}, 'Endereço (URL)'), urlIn), h('label', { class: 'field' }, h('span', {}, 'Código'), tokIn),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: async () => {
        setSettings({ url: urlIn.value.trim(), token: tokIn.value.trim() }); say('A testar…');
        try { await sync.test(); say('✓ Ligação OK', 'ok'); sync.flush(); } catch (e) { say(`✗ ${e.message}`, 'bad'); }
      } }, 'Guardar e testar')), msg,
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: async () => { if (!sync.enabled()) return say('Liga primeiro a folha.', 'bad'); await sync.enqueueAll(state); toast('A enviar tudo para a folha…', { kind: 'ok' }); } }, ic('cloud', 20), 'Enviar tudo'),
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          if (!sync.enabled()) return say('Liga primeiro a folha.', 'bad');
          if (!(await confirmSheet('Substituir os dados deste telemóvel pelos da folha?', 'Restaurar', true))) return;
          try { const n = await store.restore(await sync.pull()); toast(`Restaurado: ${n.fuelings} abastecimentos`, { kind: 'ok' }); } catch (e) { say(`✗ ${e.message}`, 'bad'); }
        } }, ic('download', 20), 'Restaurar'))),

    h('div', { class: 'set-sec' }, 'Apresentação'),
    h('p', { class: 'muted' }, settings.demo ? 'A mostrar dados fictícios. Nada é enviado para a folha.' : 'Mostra a app com dados de exemplo, sem tocar nos registos reais.'),
    h('button', { type: 'button', class: `btn ${settings.demo ? 'primary' : ''}`, style: 'width:100%;margin-top:8px', onclick: () => { setSettings({ demo: !settings.demo }); location.reload(); } }, settings.demo ? 'Sair da apresentação' : 'Ver apresentação'),

    h('div', { class: 'set-sec' }, 'App'),
    h('div', { class: 'row2', style: 'align-items:center' }, h('span', { class: 'muted' }, `Versão ${VERSION}`),
      h('button', { type: 'button', class: 'btn', onclick: () => checkUpdate(true) }, 'Procurar atualização'))));
}
