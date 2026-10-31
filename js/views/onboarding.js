// Primeira abertura: a estrada desenha-se, cumprimenta o chefe e pede só 2 números.
import { settings, setSettings, save, uid, firstName } from '../store.js';
import { h, ic, nf, saudacao, Pad, vibrate } from '../ui.js';

export function showIntro(done) {
  const root = document.createElement('div');
  root.className = 'intro';
  document.body.classList.add('locked');
  document.body.append(root);

  const finish = () => { root.remove(); document.body.classList.remove('locked'); done(); };

  function stage1() {
    root.replaceChildren(
      h('div', { class: 'intro-body' },
        h('div', { class: 'brand-mark' }, h('img', { src: 'img/jjr-mark.png', alt: 'JJR' })),
        h('h1', {}, `${saudacao()},`, h('br'), `${firstName()}.`),
        h('p', { class: 'lead' }, 'O gasóleo da equipa, sempre à vista e sem contas.')),
      h('div', { class: 'way', html: '<svg class="way" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path class="asph" pathLength="1" d="M-30 270 C 90 270, 120 130, 210 160 S 330 270, 440 60"/><path class="mark" d="M-30 270 C 90 270, 120 130, 210 160 S 330 270, 440 60"/></svg>' }),
      h('div', { class: 'intro-foot' }, h('button', { type: 'button', class: 'cta', onclick: stage2 }, 'Começar', ic('next', 26))));
    root.querySelector('.way').style.display = 'contents';
  }

  function stage2() {
    let btn;
    const pad = Pad({ fields: [{ key: 'cap', label: 'Capacidade do depósito', unit: 'L', value: settings.capacity, max: 5 }, { key: 'nivel', label: 'Litros que tem agora', unit: 'L', max: 5 }],
      onChange: (v) => { if (btn) btn.disabled = !(v.cap > 0 && v.nivel >= 0 && v.nivel <= v.cap); } });
    btn = h('button', { type: 'button', class: 'cta', disabled: true, onclick: async () => {
      const v = pad.get();
      if (!(v.cap > 0 && v.nivel >= 0 && v.nivel <= v.cap)) return;
      btn.disabled = true;
      setSettings({ capacity: Math.round(v.cap), threshold: Math.round(v.cap / 6), onboarded: true });
      await save('refills', { id: uid(), ts: new Date().toISOString(), tipo: 'ajuste', litros: null, nivel: v.nivel });
      vibrate([20, 40, 20]);
      finish();
    } }, ic('check', 28), 'Pronto, vamos');
    pad.setActive('nivel');
    root.replaceChildren(
      h('div', { class: 'setup' }, h('h2', {}, 'Dois números e está feito'), h('p', { class: 'lead', style: 'font:500 18px/1.3 var(--text);color:#b7c5d2' }, 'Toca num campo para o escrever.'), pad.fieldsEl, pad.keypadEl),
      h('div', { class: 'intro-foot' }, btn));
    pad.refresh();
  }

  stage1();
}
