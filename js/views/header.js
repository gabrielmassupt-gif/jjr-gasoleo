// Linha de marca comum a todos os topos de asfalto: símbolo JJR, nome, estado de envio e avatar.
import { h, $$ } from '../ui.js';
import { firstName } from '../store.js';

let syncKind = 'ok', syncTitle = '';
export function setSync(kind, title = '') {
  syncKind = kind; syncTitle = title;
  $$('.sync').forEach(paint);
}
const paint = (el) => { el.className = `sync ${syncKind === 'ok' ? '' : syncKind}`; el.title = syncTitle; el.setAttribute('aria-label', syncTitle || 'Sincronizado'); };

export function brandRow(onAvatar) {
  const dot = h('span', { class: 'sync', role: 'img' });
  paint(dot);
  return h('div', { class: 'brand' },
    h('div', { class: 'brand-mark' }, h('img', { src: 'img/jjr-mark.png', alt: 'JJR', width: 30, height: 30 })),
    h('div', { class: 'brand-name' }, h('b', {}, 'JJR'), h('span', {}, 'Gasóleo')),
    dot,
    h('button', { type: 'button', class: 'avatar', 'aria-label': 'Definições', onclick: onAvatar }, firstName().charAt(0).toUpperCase()));
}
