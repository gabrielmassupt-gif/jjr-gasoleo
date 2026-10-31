// Dados fictícios (modo apresentação): realistas, para mostrar à direção sem tocar nos registos reais.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }

const MACHINES = [
  { id: 'E01', modelo: 'Caterpillar 320', lph: 14, start: 3820, perDay: 3.5 },
  { id: 'C12', modelo: 'Caterpillar 930', lph: 9.5, start: 6210, perDay: 4.5 },
  { id: 'R05', modelo: 'Volvo ABG P6820', lph: 16, start: 2470, perDay: 3.5 },
  { id: 'F03', modelo: 'Bomag BW 161', lph: 7, start: 4905, perDay: 2.5 },
  { id: 'M09', modelo: 'Wirtgen W 100', lph: 38, start: 1660, perDay: 2.5 },
  { id: 'T07', modelo: 'Hamm HD 12', lph: 6.5, start: 5340, perDay: 3.5 },
];

export function seedDemo(settings) {
  const rnd = rng(11);
  const cap = settings.capacity || 600;
  const id = () => `demo-${Math.floor(rnd() * 1e9).toString(36)}-${Math.floor(rnd() * 1e9).toString(36)}`;
  const now = new Date();
  const machines = MACHINES.map((m) => ({ id: m.id, modelo: m.modelo, criadaEm: new Date(now - 30 * 864e5).toISOString() }));
  const fuelings = [];
  const refills = [{ id: id(), ts: new Date(new Date(now - 28 * 864e5).setHours(7, 0, 0, 0)).toISOString(), tipo: 'ajuste', litros: null, nivel: cap }];
  let level = cap;
  const hours = Object.fromEntries(MACHINES.map((m) => [m.id, m.start]));
  const gap = Object.fromEntries(MACHINES.map((m) => [m.id, 0]));

  for (let back = 27; back >= 0; back--) {
    const day = new Date(now - back * 864e5);
    if (day.getDay() === 0) continue;
    MACHINES.forEach((m) => {
      gap[m.id] += m.perDay * (0.8 + rnd() * 0.4);
      if (back === 0 && m.id !== 'C12' && m.id !== 'E01') return; // hoje: poucos registos
      if (rnd() < 0.62 && !(back === 0 && m.id === 'C12')) return;
      const dh = Math.round(gap[m.id] * 2) / 2;
      let litros = Math.round(dh * m.lph * (0.93 + rnd() * 0.14));
      if (m.id === 'C12' && back === 0) litros = Math.round(dh * m.lph * 1.5); // consumo alto, para mostrar o aviso
      if (litros < 15) return;
      if (level < litros + 20) {
        const ts = new Date(day); ts.setHours(7, 20, 0, 0);
        refills.push({ id: id(), ts: ts.toISOString(), tipo: 'enchimento', litros: cap - level, preco: 1.62, local: 'Posto' });
        level = cap;
      }
      hours[m.id] += dh; gap[m.id] = 0; level -= litros;
      const ts = new Date(day); ts.setHours(8 + Math.floor(rnd() * 7), Math.floor(rnd() * 60), 0, 0);
      if (ts > now) ts.setTime(+now - 60000 * (5 + Math.floor(rnd() * 30)));
      fuelings.push({ id: id(), ts: ts.toISOString(), machineId: m.id, horas: hours[m.id], litros });
    });
  }
  return { machines, fuelings, refills };
}
