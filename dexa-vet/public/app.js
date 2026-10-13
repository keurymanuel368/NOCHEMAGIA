/* DEXA Vet · MVP de demostración
   Todo corre en el navegador (localStorage). Los datos son de ejemplo y se pueden reiniciar. */
'use strict';

const KEY = 'dexavet-demo-v1';
const CLINICA = 'Clínica Veterinaria Demo';
const ITBIS = 0.18;
const MANUAL_MIN = 14; // referencia estimada: cuaderno + factura a mano + llamada de recordatorio (validar con cada clínica)

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (n, base) => { const d = base ? parseD(base) : new Date(); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());
const diffDays = (a, b) => Math.round((parseD(a) - parseD(b)) / 864e5);
const nf2 = new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });
const money = n => 'RD$ ' + nf2.format(n || 0);
const money0 = n => 'RD$ ' + nf0.format(Math.round(n || 0));
const fdate = s => s ? parseD(s).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fshort = s => s ? parseD(s).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—';
const fday = s => parseD(s).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
const mmss = s => `${Math.floor(s / 60)}:${pad(Math.round(s) % 60)}`;
const pl = (u, n) => (n === 1 || /s$/.test(u)) ? u : u + 's';
const first = n => String(n || '').split(' ')[0];
const relDay = s => { const d = diffDays(s, TODAY); return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : d > 0 ? `en ${d} días` : `hace ${-d} días`; };
const age = nac => {
  if (!nac) return '—';
  const m = Math.max(0, Math.floor(diffDays(TODAY, nac) / 30.44));
  return m < 12 ? `${m} ${m === 1 ? 'mes' : 'meses'}` : `${Math.floor(m / 12)} ${Math.floor(m / 12) === 1 ? 'año' : 'años'}`;
};
const waLink = (tel, text) => {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.8" r="1.8"/><circle cx="14.8" cy="5.8" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M7.8 18c0-2.8 2.1-5.6 4.4-5.6s4.4 2.8 4.4 5.6c0 2-1.6 2.6-2.7 2.2-.8-.3-1.1-.7-1.7-.7s-.9.4-1.7.7c-1.1.4-2.7-.2-2.7-2.2z"/>',
  syringe: '<path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  msg: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
  steth: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="11" r="2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
};
const ic = n => `<span class="i" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[n] || ''}</svg></span>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[el.dataset.icon] || ''}</svg>`; el.removeAttribute('data-icon'); }); }

/* ---------- Datos ---------- */
const VETS = ['Dra. Paola Méndez', 'Dr. Luis Almonte'];
const SERVICIOS = [
  { id: 's1', nombre: 'Consulta general', precio: 1200 },
  { id: 's2', nombre: 'Control / revisión', precio: 600 },
  { id: 's3', nombre: 'Desparasitación (aplicación)', precio: 200 },
  { id: 's4', nombre: 'Baño medicado', precio: 800 },
  { id: 's5', nombre: 'Curación', precio: 700 },
  { id: 's6', nombre: 'Hemograma', precio: 1500 },
  { id: 's7', nombre: 'Aplicación de vacuna', precio: 300 }
];
const DX = ['Paciente sano', 'Gastroenteritis', 'Dermatitis alérgica', 'Otitis externa', 'Parasitosis intestinal', 'Infección respiratoria', 'Sobrepeso', 'Enfermedad periodontal'];

const PLANTILLAS = {
  general: {
    nombre: 'Consulta general',
    s: m => `Propietario refiere ${m.toLowerCase()}. Come y bebe con normalidad.`,
    o: 'Mucosas rosadas, TLLC < 2 s, hidratación adecuada. Sin dolor a la palpación abdominal.',
    a: '', p: '',
    servicios: ['s1'], items: [], next: null
  },
  vacuna: {
    nombre: 'Vacunación',
    s: () => 'Paciente sano, viene a su vacunación anual.',
    o: 'Examen físico dentro de parámetros normales. Apto para vacunar.',
    a: 'Paciente sano.',
    p: 'Se aplica vacuna. Observar 24 h por reacción local. Próxima dosis en 12 meses.',
    servicios: ['s7'], items: ['VAC', 'p1'], next: { tipo: 'vacuna', nombre: 'VAC', dias: 365 }
  },
  desparasitacion: {
    nombre: 'Desparasitación',
    s: () => 'Viene a desparasitación de rutina.',
    o: 'Condición corporal 3/5. Sin hallazgos.',
    a: 'Paciente sano.',
    p: 'Desparasitante oral en consulta. Repetir en 3 meses.',
    servicios: ['s3'], items: ['p6'], next: { tipo: 'vacuna', nombre: 'Desparasitación', dias: 90 }
  },
  dermatologia: {
    nombre: 'Piel',
    s: () => 'Prurito y caída de pelo desde hace 2 semanas.',
    o: 'Alopecia focal en dorso, eritema leve. Sin ectoparásitos visibles.',
    a: 'Dermatitis alérgica (probable).',
    p: 'Baño medicado cada 7 días por 4 semanas. Evitar cambios de alimento.',
    servicios: ['s1', 's4'], items: ['p8'], next: { tipo: 'cita', nombre: 'Control de piel', dias: 15 }
  },
  control: {
    nombre: 'Control',
    s: () => 'Control de evolución. Propietario reporta mejoría.',
    o: 'Evolución favorable.',
    a: 'En recuperación.',
    p: 'Continuar tratamiento hasta completar. Alta si sigue estable.',
    servicios: ['s2'], items: [], next: null
  }
};

function makeFactura({ fecha, duenoId, mascotaId, lineas, metodo }) {
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cant, 0);
  const itbis = Math.round(subtotal * ITBIS * 100) / 100;
  db.seq += 1;
  return { id: uid('f'), numero: 'E32' + String(db.seq).padStart(10, '0'), fecha, duenoId, mascotaId, lineas, subtotal, itbis, total: subtotal + itbis, metodo, hora: '' };
}

function seed() {
  const D = n => addDays(n);
  const data = {
    seedDate: TODAY, seq: 1180, tiempos: [],
    duenos: [
      { id: 'd1', nombre: 'María Fernández', tel: '809-555-0142', dir: 'Los Prados, Santo Domingo' },
      { id: 'd2', nombre: 'José Rodríguez', tel: '829-555-0187', dir: 'Naco, Santo Domingo' },
      { id: 'd3', nombre: 'Ana Lucía Peña', tel: '849-555-0110', dir: 'Bella Vista, Santo Domingo' },
      { id: 'd4', nombre: 'Carlos Taveras', tel: '809-555-0163', dir: 'Gazcue, Santo Domingo' },
      { id: 'd5', nombre: 'Yokasta Jiménez', tel: '829-555-0129', dir: 'Arroyo Hondo, Santo Domingo' },
      { id: 'd6', nombre: 'Ramón Almánzar', tel: '809-555-0175', dir: 'Evaristo Morales, Santo Domingo' }
    ],
    mascotas: [
      { id: 'm1', duenoId: 'd1', nombre: 'Max', especie: 'Canino', raza: 'Labrador', sexo: 'Macho', nac: '2021-03-14', peso: 28.4, alergias: '', notas: 'Muy sociable.' },
      { id: 'm2', duenoId: 'd1', nombre: 'Luna', especie: 'Felino', raza: 'Criolla', sexo: 'Hembra', nac: '2022-07-02', peso: 4.1, alergias: '', notas: 'Se estresa en el transportador.' },
      { id: 'm3', duenoId: 'd2', nombre: 'Coco', especie: 'Canino', raza: 'Poodle', sexo: 'Macho', nac: '2019-11-20', peso: 6.2, alergias: 'Alergia a la penicilina', notas: '' },
      { id: 'm4', duenoId: 'd3', nombre: 'Rocky', especie: 'Canino', raza: 'Pitbull', sexo: 'Macho', nac: '2020-05-09', peso: 31.0, alergias: '', notas: 'Usar bozal.' },
      { id: 'm5', duenoId: 'd4', nombre: 'Canela', especie: 'Canino', raza: 'Sato (mestizo)', sexo: 'Hembra', nac: '2018-02-11', peso: 14.5, alergias: '', notas: 'Esterilizada.' },
      { id: 'm6', duenoId: 'd5', nombre: 'Mía', especie: 'Felino', raza: 'Siamés', sexo: 'Hembra', nac: '2023-01-25', peso: 3.6, alergias: '', notas: '' },
      { id: 'm7', duenoId: 'd6', nombre: 'Bruno', especie: 'Canino', raza: 'Golden Retriever', sexo: 'Macho', nac: '2022-09-17', peso: 30.2, alergias: '', notas: '' },
      { id: 'm8', duenoId: 'd5', nombre: 'Nala', especie: 'Canino', raza: 'Shih Tzu', sexo: 'Hembra', nac: '2021-12-03', peso: 5.8, alergias: '', notas: '' }
    ],
    productos: [
      { id: 'p1', nombre: 'Vacuna antirrábica', cat: 'Vacunas', stock: 24, min: 10, precio: 900, unidad: 'dosis' },
      { id: 'p2', nombre: 'Vacuna séxtuple canina', cat: 'Vacunas', stock: 18, min: 10, precio: 1500, unidad: 'dosis' },
      { id: 'p3', nombre: 'Vacuna triple felina', cat: 'Vacunas', stock: 6, min: 8, precio: 1400, unidad: 'dosis' },
      { id: 'p4', nombre: 'Meloxicam 1.5 mg/ml suspensión', cat: 'Medicamentos', stock: 9, min: 5, precio: 650, unidad: 'frasco', mgkg: 0.1, conc: 1.5, cu: 'ml' },
      { id: 'p5', nombre: 'Amoxicilina + clavulánico 250 mg', cat: 'Medicamentos', stock: 40, min: 20, precio: 35, unidad: 'tableta', mgkg: 12.5, conc: 250, cu: 'tab', beta: true },
      { id: 'p6', nombre: 'Desparasitante oral (praziquantel/pirantel)', cat: 'Medicamentos', stock: 3, min: 12, precio: 250, unidad: 'tableta' },
      { id: 'p7', nombre: 'Pipeta antipulgas 10–20 kg', cat: 'Antiparasitarios', stock: 15, min: 8, precio: 750, unidad: 'pipeta' },
      { id: 'p8', nombre: 'Shampoo medicado clorhexidina', cat: 'Dermatología', stock: 7, min: 4, precio: 900, unidad: 'frasco' },
      { id: 'p9', nombre: 'Metronidazol 250 mg', cat: 'Medicamentos', stock: 30, min: 15, precio: 25, unidad: 'tableta', mgkg: 15, conc: 250, cu: 'tab' },
      { id: 'p10', nombre: 'Alimento renal 2 kg', cat: 'Alimentos', stock: 4, min: 3, precio: 2350, unidad: 'saco' }
    ],
    citas: [
      { id: 'c1', mascotaId: 'm5', fecha: D(0), hora: '08:00', motivo: 'Revisión de piel', tipo: 'control', estado: 'Atendida', vet: VETS[0] },
      { id: 'c2', mascotaId: 'm1', fecha: D(0), hora: '08:30', motivo: 'Vacuna séxtuple anual', tipo: 'vacuna', estado: 'En sala', vet: VETS[0] },
      { id: 'c3', mascotaId: 'm3', fecha: D(0), hora: '09:30', motivo: 'Vómitos desde ayer', tipo: 'general', estado: 'Programada', vet: VETS[1] },
      { id: 'c4', mascotaId: 'm2', fecha: D(0), hora: '10:30', motivo: 'Desparasitación', tipo: 'desparasitacion', estado: 'Programada', vet: VETS[0] },
      { id: 'c5', mascotaId: 'm4', fecha: D(0), hora: '11:30', motivo: 'Control de cojera', tipo: 'control', estado: 'Programada', vet: VETS[1] },
      { id: 'c6', mascotaId: 'm7', fecha: D(0), hora: '15:00', motivo: 'Picazón y caída de pelo', tipo: 'dermatologia', estado: 'Programada', vet: VETS[0] },
      { id: 'c7', mascotaId: 'm8', fecha: D(0), hora: '16:00', motivo: 'Baño medicado', tipo: 'dermatologia', estado: 'Programada', vet: VETS[1] },
      { id: 'c8', mascotaId: 'm6', fecha: D(1), hora: '09:00', motivo: 'Vacuna triple felina', tipo: 'vacuna', estado: 'Programada', vet: VETS[0] },
      { id: 'c9', mascotaId: 'm5', fecha: D(1), hora: '10:30', motivo: 'Control de piel', tipo: 'control', estado: 'Programada', vet: VETS[0] },
      { id: 'c10', mascotaId: 'm3', fecha: D(2), hora: '14:00', motivo: 'Control digestivo', tipo: 'control', estado: 'Programada', vet: VETS[1] }
    ],
    consultas: [
      { id: 'q1', mascotaId: 'm1', fecha: D(-180), vet: VETS[0], tipo: 'Consulta general', motivo: 'Otitis', peso: 27.6, temp: 38.7, fc: 96, s: 'Se rasca la oreja derecha.', o: 'Eritema y secreción en conducto auditivo derecho.', a: 'Otitis externa.', p: 'Limpieza ótica y gotas por 7 días.' },
      { id: 'q2', mascotaId: 'm1', fecha: D(-365), vet: VETS[0], tipo: 'Vacunación', motivo: 'Vacuna anual', peso: 26.9, temp: 38.5, fc: 92, s: 'Paciente sano.', o: 'Normal.', a: 'Paciente sano.', p: 'Séxtuple + antirrábica.' },
      { id: 'q3', mascotaId: 'm3', fecha: D(-60), vet: VETS[1], tipo: 'Consulta general', motivo: 'Sarro dental', peso: 6.4, temp: 38.6, fc: 110, s: 'Mal aliento.', o: 'Sarro grado 2.', a: 'Enfermedad periodontal.', p: 'Programar limpieza dental.' },
      { id: 'q4', mascotaId: 'm4', fecha: D(-25), vet: VETS[1], tipo: 'Consulta general', motivo: 'Cojera pata trasera', peso: 31.4, temp: 38.9, fc: 100, s: 'Cojea desde hace 3 días.', o: 'Dolor leve en rodilla izquierda.', a: 'Esguince (probable).', p: 'Meloxicam 5 días y reposo.' },
      { id: 'q5', mascotaId: 'm5', fecha: D(0), vet: VETS[0], tipo: 'Control', motivo: 'Revisión de piel', peso: 14.5, temp: 38.4, fc: 98, s: 'Mejoró la picazón.', o: 'Piel sin eritema.', a: 'En recuperación.', p: 'Continuar baños 2 semanas más.' },
      { id: 'q6', mascotaId: 'm5', fecha: D(-14), vet: VETS[0], tipo: 'Piel', motivo: 'Picazón', peso: 14.9, temp: 38.6, fc: 100, s: 'Prurito intenso.', o: 'Eritema abdominal.', a: 'Dermatitis alérgica.', p: 'Baño medicado semanal.' },
      { id: 'q7', mascotaId: 'm7', fecha: D(-120), vet: VETS[0], tipo: 'Consulta general', motivo: 'Diarrea', peso: 29.1, temp: 39.0, fc: 104, s: 'Heces blandas 2 días.', o: 'Leve deshidratación.', a: 'Gastroenteritis.', p: 'Metronidazol 5 días, dieta blanda.' },
      { id: 'q8', mascotaId: 'm2', fecha: D(-95), vet: VETS[0], tipo: 'Desparasitación', motivo: 'Rutina', peso: 4.0, temp: 38.5, fc: 160, s: 'Rutina.', o: 'Normal.', a: 'Paciente sano.', p: 'Desparasitante oral.' }
    ],
    vacunas: [
      { id: 'v1', mascotaId: 'm4', nombre: 'Vacuna antirrábica', fecha: D(-370), proxima: D(-5) },
      { id: 'v2', mascotaId: 'm6', nombre: 'Vacuna triple felina', fecha: D(-362), proxima: D(3) },
      { id: 'v3', mascotaId: 'm7', nombre: 'Vacuna séxtuple canina', fecha: D(-355), proxima: D(10) },
      { id: 'v4', mascotaId: 'm5', nombre: 'Vacuna antirrábica', fecha: D(-345), proxima: D(20) },
      { id: 'v5', mascotaId: 'm1', nombre: 'Vacuna séxtuple canina', fecha: D(-365), proxima: D(0) },
      { id: 'v6', mascotaId: 'm1', nombre: 'Vacuna antirrábica', fecha: D(-365), proxima: D(0) },
      { id: 'v7', mascotaId: 'm2', nombre: 'Desparasitación', fecha: D(-95), proxima: D(-5) },
      { id: 'v8', mascotaId: 'm3', nombre: 'Vacuna séxtuple canina', fecha: D(-200), proxima: D(165) },
      { id: 'v9', mascotaId: 'm8', nombre: 'Vacuna antirrábica', fecha: D(-340), proxima: D(25) }
    ],
    facturas: []
  };
  db = data;
  // Ventas de ejemplo de los últimos 6 días (para el reporte) y la consulta de Canela de hoy
  const owners = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
  const petOf = { d1: 'm1', d2: 'm3', d3: 'm4', d4: 'm5', d5: 'm6', d6: 'm7' };
  const combos = [
    [['Consulta general', 1, 1200], ['Amoxicilina + clavulánico 250 mg', 14, 35]],
    [['Vacuna séxtuple canina', 1, 1500], ['Aplicación de vacuna', 1, 300]],
    [['Baño medicado', 1, 800]],
    [['Consulta general', 1, 1200], ['Meloxicam 1.5 mg/ml suspensión', 1, 650]],
    [['Alimento renal 2 kg', 1, 2350]],
    [['Control / revisión', 1, 600]],
    [['Pipeta antipulgas 10–20 kg', 2, 750]]
  ];
  const perDay = [0, 3, 2, 4, 3, 5, 2];
  const metodos = ['Efectivo', 'Tarjeta', 'Transferencia'];
  let k = 0;
  for (let d = 6; d >= 1; d--) {
    for (let j = 0; j < perDay[d]; j++, k++) {
      const o = owners[k % owners.length];
      const lineas = combos[k % combos.length].map(([desc, cant, precio]) => ({ desc, cant, precio }));
      data.facturas.push(makeFactura({ fecha: D(-d), duenoId: o, mascotaId: petOf[o], lineas, metodo: metodos[k % 3] }));
    }
  }
  const fc = makeFactura({ fecha: D(0), duenoId: 'd4', mascotaId: 'm5', lineas: [{ desc: 'Control / revisión', cant: 1, precio: 600 }, { desc: 'Shampoo medicado clorhexidina', cant: 1, precio: 900 }], metodo: 'Tarjeta' });
  fc.hora = '08:22';
  data.facturas.push(fc);
  return data;
}

let db;
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento: la demo sigue en memoria */ } }
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      db = JSON.parse(raw);
      // Mantener la demo "al día": si se abrió otro día, se corren todas las fechas.
      const shift = diffDays(TODAY, db.seedDate);
      if (shift) {
        ['citas', 'consultas', 'vacunas', 'facturas'].forEach(c => db[c].forEach(r => {
          if (r.fecha) r.fecha = addDays(shift, r.fecha);
          if (r.proxima) r.proxima = addDays(shift, r.proxima);
        }));
        db.seedDate = TODAY;
        save();
      }
      return;
    }
  } catch (e) { /* datos corruptos o sin acceso: se vuelve a sembrar */ }
  seed(); save();
}
const pet = id => db.mascotas.find(x => x.id === id);
const owner = id => db.duenos.find(x => x.id === id);
const prod = id => db.productos.find(x => x.id === id);
const lowStock = () => db.productos.filter(p => p.stock <= p.min);
function dueVaccines(windowDays = 30) {
  const latest = {};
  db.vacunas.forEach(v => { const k = v.mascotaId + '|' + v.nombre; if (!latest[k] || latest[k].fecha < v.fecha) latest[k] = v; });
  return Object.values(latest).filter(v => diffDays(v.proxima, TODAY) <= windowDays).sort((a, b) => a.proxima.localeCompare(b.proxima));
}
const lastVisit = mid => db.consultas.filter(c => c.mascotaId === mid).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
const avatar = (p, cls = '') => `<span class="avatar ${p.especie === 'Felino' ? 'felino' : ''} ${cls}">${esc(p.nombre[0])}</span>`;
const estadoPill = e => ({ 'Programada': 'plain', 'En sala': 'blue', 'Atendida': 'ok', 'No asistió': 'bad' }[e] || '');

/* ---------- UI base ---------- */
function toast(msg, icon = 'check') {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = ic(icon) + `<span>${msg}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 3200);
}
function openModal(html, { wide = false, cls = '' } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="backdrop" data-act="close"></div><div class="dialog ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  setTimeout(() => { const f = m.querySelector('[autofocus]') || m.querySelector('input, select, textarea'); f && f.focus(); }, 30);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
const dialogHead = t => `<div class="dialog-h"><h2>${t}</h2><button class="icon-btn" data-act="close" type="button" aria-label="Cerrar">${ic('x')}</button></div>`;

const NAV = [
  ['inicio', 'Inicio', 'home'],
  ['agenda', 'Agenda', 'calendar'],
  ['pacientes', 'Pacientes', 'paw'],
  ['vacunas', 'Vacunas', 'syringe'],
  ['caja', 'Caja', 'receipt'],
  ['inventario', 'Inventario', 'box'],
  ['reportes', 'Reportes', 'chart']
];
function renderNav(active) {
  const badges = {
    agenda: db.citas.filter(c => c.fecha === TODAY && c.estado !== 'Atendida' && c.estado !== 'No asistió').length,
    vacunas: dueVaccines(7).length,
    inventario: lowStock().length
  };
  $('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic(i)}<span>${l}</span>${badges[k] ? `<span class="badge">${badges[k]}</span>` : ''}</a>`).join('');
}

/* ---------- Router ---------- */
let timerInt = null;
function stopTimer() { clearInterval(timerInt); timerInt = null; $('#timer').hidden = true; }
function route() {
  const [, view = 'inicio', arg] = (location.hash || '#/inicio').split('/');
  stopTimer();
  const views = { inicio: vInicio, agenda: vAgenda, pacientes: vPacientes, paciente: vPaciente, consulta: vConsulta, vacunas: vVacunas, caja: vCaja, inventario: vInventario, reportes: vReportes };
  const fn = views[view] || vInicio;
  const navKey = view === 'paciente' || view === 'consulta' ? 'pacientes' : view;
  renderNav(navKey);
  $('#view').innerHTML = fn(arg) || '';
  hydrateIcons($('#view'));
  if (view === 'consulta') mountConsulta();
  window.scrollTo(0, 0);
}

/* ---------- Vistas ---------- */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

function speedCard() {
  const t = db.tiempos;
  const lastT = t.length ? t[t.length - 1] : null;
  const avg = t.length ? t.reduce((s, x) => s + x.seg, 0) / t.length : null;
  const manualSeg = MANUAL_MIN * 60;
  const dexaSeg = avg || 0;
  const pct = avg ? Math.max(4, Math.round(dexaSeg / manualSeg * 100)) : 0;
  const ahorro = avg ? (manualSeg - avg) * t.length / 60 : 0;
  return `<div class="card speed"><div class="card-b">
    <div class="row" style="justify-content:space-between"><span class="lbl">${ic('clock')} Tiempo DEXA · consulta completa</span>${t.length ? `<span class="pill blue">${t.length} medida${t.length > 1 ? 's' : ''} en vivo</span>` : ''}</div>
    ${lastT ? `<div class="speed-big">${mmss(lastT.seg)}<small>última consulta (${esc(lastT.mascota)})</small></div>`
      : `<div class="speed-big">—:—<small>aún sin medir</small></div><p class="small" style="color:#C9CEDA">Abre una cita y pulsa <b>Atender</b>: el cronómetro mide desde que entra el paciente hasta que queda la historia, el cobro y el recordatorio listos.</p>`}
    <div class="speed-bars">
      <div class="bar-row"><span>Cuaderno + Excel</span><span class="bar"><i style="width:100%"></i></span><span class="num">~${MANUAL_MIN} min</span></div>
      <div class="bar-row"><span>Con DEXA Vet</span><span class="bar"><i class="dexa" style="width:${pct}%"></i></span><span class="num">${avg ? mmss(avg) : '—'}</span></div>
    </div>
    ${avg ? `<p class="small" style="color:#fff">Tiempo ahorrado hoy: <b class="mono">${Math.round(ahorro)} min</b> en ${t.length} consulta${t.length > 1 ? 's' : ''}.</p>` : ''}
    <p class="speed-note">Referencia manual estimada (historia en papel, factura a mano y llamada de recordatorio). Se valida con cada clínica.</p>
  </div></div>`;
}

function vInicio() {
  const hoy = db.citas.filter(c => c.fecha === TODAY).sort((a, b) => a.hora.localeCompare(b.hora));
  const atendidas = hoy.filter(c => c.estado === 'Atendida').length;
  const ingresos = db.facturas.filter(f => f.fecha === TODAY).reduce((s, f) => s + f.total, 0);
  const due7 = dueVaccines(7);
  const low = lowStock();
  const pend = hoy.filter(c => c.estado === 'Programada' || c.estado === 'En sala');
  return `
  <div class="page-head"><div><div class="eyebrow">${esc(fday(TODAY))}</div><h1>${greeting()}, ${esc(first(VETS[0]))} ${esc(VETS[0].split(' ')[1])}</h1><p>Así va ${esc(CLINICA)} hoy.</p></div>
    <div class="row"><a class="btn" href="#/agenda">${ic('calendar')} Ver agenda</a></div></div>

  <div class="kpis">
    <div class="card kpi"><span class="lbl">${ic('calendar')} Citas de hoy</span><span class="val">${atendidas}/${hoy.length}</span><span class="sub">${pend.length} por atender</span></div>
    <div class="card kpi"><span class="lbl">${ic('receipt')} Ingresos de hoy</span><span class="val">${money0(ingresos)}</span><span class="sub">ITBIS incluido</span></div>
    <div class="card kpi ${due7.length ? 'alert' : ''}"><span class="lbl">${ic('syringe')} Vacunas a recordar</span><span class="val">${due7.length}</span><span class="sub">vencidas o en 7 días</span></div>
    <div class="card kpi ${low.length ? 'alert' : ''}"><span class="lbl">${ic('box')} Stock bajo</span><span class="val">${low.length}</span><span class="sub">productos bajo el mínimo</span></div>
  </div>

  <div class="cols">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Siguientes en la agenda</h2><a class="btn sm ghost" href="#/agenda">Todo el día ${ic('arrow')}</a></div>
        <div class="list">${pend.slice(0, 5).map(citaRow).join('') || '<div class="empty">No quedan citas pendientes hoy.</div>'}</div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Pendientes que DEXA detectó</h2></div>
        <div class="list">
          ${due7.slice(0, 4).map(v => { const p = pet(v.mascotaId), o = owner(p.duenoId); const d = diffDays(v.proxima, TODAY);
            return `<div class="li">${avatar(p)}<div class="li-main"><b>${esc(p.nombre)} · ${esc(v.nombre)}</b><span class="muted">${esc(o.nombre)} · ${d < 0 ? `vencida ${relDay(v.proxima)}` : `vence ${relDay(v.proxima)}`}</span></div>
              <div class="li-actions"><span class="pill ${d < 0 ? 'bad' : 'warn'}">${d < 0 ? 'Vencida' : 'Por vencer'}</span><a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(o.tel, vacMsg(v))}" data-act="wa-sent">${ic('msg')} Recordar</a></div></div>`; }).join('')}
          ${low.slice(0, 3).map(p => `<div class="li"><span class="avatar" style="background:var(--warn-soft);color:var(--warn)">${ic('box')}</span><div class="li-main"><b>${esc(p.nombre)}</b><span class="muted">Quedan ${p.stock} ${esc(pl(p.unidad, p.stock))} · mínimo ${p.min}</span></div><div class="li-actions"><button class="btn sm" data-act="stock-in" data-id="${p.id}" type="button">Registrar entrada</button></div></div>`).join('')}
          ${!due7.length && !low.length ? '<div class="empty">Todo al día.</div>' : ''}
        </div>
      </div>
    </div>
    <div class="stack">${speedCard()}
      <div class="card"><div class="card-h"><h2>Atajos</h2></div><div class="card-b" style="display:grid;gap:8px">
        <button class="btn" data-act="new-patient" type="button" style="justify-content:flex-start">${ic('plus')} Registrar paciente en segundos</button>
        <button class="btn" data-act="palette" type="button" style="justify-content:flex-start">${ic('search')} Buscar por teléfono del dueño</button>
        <button class="btn" data-act="remind-tomorrow" type="button" style="justify-content:flex-start">${ic('msg')} Recordar las citas de mañana</button>
      </div></div>
    </div>
  </div>`;
}

function citaRow(c) {
  const p = pet(c.mascotaId); if (!p) return '';
  const o = owner(p.duenoId);
  const actions = c.estado === 'Atendida' ? `<a class="btn sm ghost" href="#/paciente/${p.id}">Ver ficha</a>`
    : c.estado === 'No asistió' ? `<button class="btn sm ghost" data-act="cita-estado" data-id="${c.id}" data-estado="Programada" type="button">Reprogramar</button>`
    : `${c.estado === 'Programada' ? `<button class="btn sm" data-act="cita-estado" data-id="${c.id}" data-estado="En sala" type="button">Llegó</button>` : ''}
       <a class="btn sm primary" href="#/consulta/${c.id}">${ic('steth')} Atender</a>`;
  return `<div class="li"><span class="hour">${esc(c.hora)}</span>${avatar(p)}
    <div class="li-main"><b>${esc(p.nombre)} <span class="muted" style="font-weight:400">· ${esc(p.raza)}</span></b><span class="muted">${esc(c.motivo)} · ${esc(o.nombre)} · ${esc(c.vet)}</span></div>
    <div class="li-actions"><span class="pill ${estadoPill(c.estado)}">${esc(c.estado)}</span>${actions}</div></div>`;
}

let agendaDay = TODAY;
function vAgenda() {
  const list = db.citas.filter(c => c.fecha === agendaDay).sort((a, b) => a.hora.localeCompare(b.hora));
  const man = db.citas.filter(c => c.fecha === addDays(1)).length;
  return `
  <div class="page-head"><div><div class="eyebrow">Agenda</div><h1 style="text-transform:capitalize">${esc(fday(agendaDay))}</h1><p>${list.length} cita${list.length === 1 ? '' : 's'} · ${list.filter(c => c.estado === 'Atendida').length} atendida${list.filter(c => c.estado === 'Atendida').length === 1 ? '' : 's'}</p></div>
    <div class="row">
      <div class="seg"><button data-act="day" data-d="-1" type="button" aria-label="Día anterior">‹</button><button data-act="day" data-d="0" type="button" class="${agendaDay === TODAY ? 'on' : ''}">Hoy</button><button data-act="day" data-d="1" type="button" aria-label="Día siguiente">›</button></div>
      <button class="btn wa" data-act="remind-tomorrow" type="button">${ic('msg')} Recordar mañana (${man})</button>
      <button class="btn primary" data-act="new-cita" type="button">${ic('plus')} Nueva cita</button>
    </div></div>
  <div class="card"><div class="list">${list.map(citaRow).join('') || '<div class="empty">Sin citas este día. Pulsa <b>Nueva cita</b> para agendar.</div>'}</div></div>`;
}

let petFilter = '';
function vPacientes() {
  return `
  <div class="page-head"><div><div class="eyebrow">Pacientes</div><h1>${db.mascotas.length} mascotas · ${db.duenos.length} dueños</h1></div>
    <div class="row"><button class="btn primary" data-act="new-patient" type="button">${ic('plus')} Nuevo paciente</button></div></div>
  <div class="card">
    <div class="card-h"><input class="input" id="pet-filter" placeholder="Filtrar por nombre, raza, dueño o teléfono" value="${esc(petFilter)}" style="max-width:420px"></div>
    <div class="table-wrap"><table><thead><tr><th>Mascota</th><th>Especie / raza</th><th>Dueño</th><th>Teléfono</th><th>Última visita</th></tr></thead>
    <tbody id="pet-rows">${petRows()}</tbody></table></div>
  </div>`;
}
function petRows() {
  const q = petFilter.toLowerCase().trim();
  const qd = q.replace(/\D/g, '');
  const rows = db.mascotas.filter(p => {
    if (!q) return true;
    const o = owner(p.duenoId);
    return [p.nombre, p.raza, p.especie, o.nombre].some(s => s.toLowerCase().includes(q)) || (qd.length >= 3 && o.tel.replace(/\D/g, '').includes(qd));
  });
  return rows.map(p => { const o = owner(p.duenoId), lv = lastVisit(p.id);
    return `<tr class="click" data-act="go" data-href="#/paciente/${p.id}"><td><div class="who">${avatar(p)}<b>${esc(p.nombre)}</b>${p.alergias ? ' <span class="pill bad">Alergia</span>' : ''}</div></td>
      <td>${esc(p.especie)} · ${esc(p.raza)}</td><td>${esc(o.nombre)}</td><td class="mono">${esc(o.tel)}</td><td>${lv ? esc(fdate(lv.fecha)) : '<span class="muted">Nuevo</span>'}</td></tr>`; }).join('')
    || '<tr><td colspan="5" class="empty">Sin resultados.</td></tr>';
}

let petTab = 'historial';
function vPaciente(id) {
  const p = pet(id); if (!p) return '<div class="empty">Paciente no encontrado.</div>';
  const o = owner(p.duenoId);
  const hist = db.consultas.filter(c => c.mascotaId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const vacs = db.vacunas.filter(v => v.mascotaId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const facts = db.facturas.filter(f => f.mascotaId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const next = db.citas.filter(c => c.mascotaId === id && c.fecha >= TODAY && c.estado !== 'Atendida').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
  const pesos = hist.filter(h => h.peso).map(h => ({ f: h.fecha, v: h.peso })).reverse();
  let tab = '';
  if (petTab === 'historial') tab = hist.length ? `<div class="timeline">${hist.map(h => `<div class="tl"><span class="when">${esc(fdate(h.fecha))}</span><div class="what"><div class="row"><b>${esc(h.tipo)}</b><span class="muted small">${esc(h.motivo)} · ${esc(h.vet)}</span></div>
      ${h.a ? `<p><b>Diagnóstico:</b> ${esc(h.a)}</p>` : ''}<p><b>Plan:</b> ${esc(h.p || '—')}</p><span class="muted small mono">${h.peso ? h.peso + ' kg' : ''}${h.temp ? ' · ' + h.temp + ' °C' : ''}${h.fc ? ' · ' + h.fc + ' lpm' : ''}${h.duracionSeg ? ' · registrada en ' + mmss(h.duracionSeg) : ''}</span></div></div>`).join('')}</div>` : '<div class="empty">Sin consultas todavía.</div>';
  if (petTab === 'vacunas') tab = vacs.length ? `<div class="table-wrap"><table><thead><tr><th>Vacuna / tratamiento</th><th>Aplicada</th><th>Próxima</th><th></th></tr></thead><tbody>${vacs.map(v => { const d = diffDays(v.proxima, TODAY); return `<tr><td>${esc(v.nombre)}</td><td>${esc(fdate(v.fecha))}</td><td>${esc(fdate(v.proxima))}</td><td>${d < 0 ? '<span class="pill bad">Vencida</span>' : d <= 30 ? '<span class="pill warn">Pronto</span>' : '<span class="pill ok">Al día</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Sin vacunas registradas.</div>';
  if (petTab === 'facturas') tab = facts.length ? `<div class="table-wrap"><table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Método</th><th class="r">Total</th></tr></thead><tbody>${facts.map(f => `<tr class="click" data-act="invoice" data-id="${f.id}"><td class="mono">${f.numero}</td><td>${esc(fdate(f.fecha))}</td><td>${esc(f.metodo)}</td><td class="r num">${money(f.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin facturas.</div>';
  if (petTab === 'peso') tab = `<div class="card-b">${pesos.length > 1 ? lineChart(pesos) : '<div class="empty">Se necesitan al menos dos pesajes.</div>'}</div>`;
  return `
  <div class="page-head"><div><div class="eyebrow"><a href="#/pacientes" style="color:inherit">Pacientes</a> / ficha</div></div></div>
  <div class="card">
    <div class="pet-head">${avatar(p, 'lg')}
      <div class="meta"><h1>${esc(p.nombre)}</h1>
        <div class="facts"><span><b>${esc(p.especie)}</b> · ${esc(p.raza)}</span><span>${esc(p.sexo)}</span><span>${age(p.nac)}</span><span class="mono"><b>${p.peso}</b> kg</span></div>
        <div class="facts"><span>${ic('user')} ${esc(o.nombre)}</span><span class="mono">${esc(o.tel)}</span><span>${esc(o.dir || '')}</span></div>
      </div>
      <div class="row">
        <a class="btn wa" target="_blank" rel="noopener" href="${waLink(o.tel, `Hola ${first(o.nombre)}, le escribimos de ${CLINICA} sobre ${p.nombre}.`)}">${ic('msg')} WhatsApp</a>
        <button class="btn" data-act="new-cita" data-pet="${p.id}" type="button">${ic('calendar')} Agendar</button>
        <button class="btn primary" data-act="walkin" data-pet="${p.id}" type="button">${ic('steth')} Nueva consulta</button>
      </div>
    </div>
    ${p.alergias ? `<div style="padding:0 18px 16px"><div class="allergy">${ic('alert')} ${esc(p.alergias)}</div></div>` : ''}
    ${next ? `<div style="padding:0 18px 16px" class="small muted">Próxima cita: <b style="color:var(--ink)">${esc(fdate(next.fecha))} · ${esc(next.hora)}</b> · ${esc(next.motivo)}</div>` : ''}
    <div class="tabs">${[['historial', `Historia clínica (${hist.length})`], ['vacunas', `Vacunas (${vacs.length})`], ['facturas', `Facturas (${facts.length})`], ['peso', 'Peso']].map(([k, l]) => `<button class="${petTab === k ? 'on' : ''}" data-act="pet-tab" data-tab="${k}" type="button">${l}</button>`).join('')}</div>
    <div>${tab}</div>
  </div>`;
}

function lineChart(pts) {
  const W = 640, H = 200, L = 44, R = 16, T = 18, B = 30;
  const vs = pts.map(p => p.v);
  let mn = Math.min(...vs), mx = Math.max(...vs);
  const padv = Math.max(0.5, (mx - mn) * 0.25); mn = Math.floor((mn - padv) * 2) / 2; mx = Math.ceil((mx + padv) * 2) / 2;
  const x = i => L + (pts.length === 1 ? 0 : i * (W - L - R) / (pts.length - 1));
  const y = v => T + (mx - v) * (H - T - B) / (mx - mn);
  const ticks = [mn, (mn + mx) / 2, mx];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(pts.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
    ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#E4E7EB"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`).join('')}
    <path d="${area}" fill="#3454D1" fill-opacity=".08"/><path d="${d}" fill="none" stroke="#3454D1" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="${i === pts.length - 1 ? '#3454D1' : '#fff'}" stroke="#3454D1" stroke-width="2"/><text x="${x(i)}" y="${H - 10}" text-anchor="middle">${esc(fshort(p.f))}</text>`).join('')}
    <text class="v" x="${x(pts.length - 1) - 8}" y="${y(pts[pts.length - 1].v) - 10}" text-anchor="end">${pts[pts.length - 1].v} kg</text>
  </svg></div>`;
}

function vacMsg(v) {
  const p = pet(v.mascotaId), o = owner(p.duenoId);
  const d = diffDays(v.proxima, TODAY);
  return `Hola ${first(o.nombre)}, le saludamos de ${CLINICA}. A ${p.nombre} le ${d < 0 ? 'toca' : 'tocará'} su ${v.nombre.toLowerCase()} ${d < 0 ? 'desde el ' + fdate(v.proxima) : d === 0 ? 'hoy' : 'el ' + fdate(v.proxima)}. ¿Le agendamos una cita? Responda con el día y la hora que le convenga.`;
}
function vVacunas() {
  const due = dueVaccines(30);
  const row = v => { const p = pet(v.mascotaId), o = owner(p.duenoId), d = diffDays(v.proxima, TODAY);
    return `<div class="li">${avatar(p)}<div class="li-main"><b>${esc(p.nombre)} · ${esc(v.nombre)}</b><span class="muted">${esc(o.nombre)} · ${esc(o.tel)} · ${d < 0 ? 'vencida ' : 'vence '}${relDay(v.proxima)} (${esc(fshort(v.proxima))})</span></div>
      <div class="li-actions"><span class="pill ${d < 0 ? 'bad' : d <= 7 ? 'warn' : 'plain'}">${d < 0 ? 'Vencida' : d <= 7 ? 'Esta semana' : 'Este mes'}</span><a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(o.tel, vacMsg(v))}" data-act="wa-sent">${ic('msg')} Enviar recordatorio</a><button class="btn sm" data-act="new-cita" data-pet="${p.id}" data-motivo="${esc(v.nombre)}" type="button">Agendar</button></div></div>`; };
  const venc = due.filter(v => v.proxima < TODAY), prox = due.filter(v => v.proxima >= TODAY);
  return `
  <div class="page-head"><div><div class="eyebrow">Vacunas y desparasitaciones</div><h1>${due.length} recordatorios para los próximos 30 días</h1><p>DEXA calcula la próxima dosis al guardar cada consulta. Aquí solo queda tocar “Enviar”.</p></div></div>
  <div class="card"><div class="card-h"><h2>Vencidas</h2><span class="pill bad">${venc.length}</span></div><div class="list">${venc.map(row).join('') || '<div class="empty">Ninguna vencida.</div>'}</div></div>
  <div class="card"><div class="card-h"><h2>Próximas</h2><span class="pill warn">${prox.length}</span></div><div class="list">${prox.map(row).join('') || '<div class="empty">Nada por vencer.</div>'}</div></div>`;
}

function vCaja() {
  const hoy = db.facturas.filter(f => f.fecha === TODAY);
  const by = m => hoy.filter(f => f.metodo === m).reduce((s, f) => s + f.total, 0);
  const all = [...db.facturas].sort((a, b) => (b.fecha + b.numero).localeCompare(a.fecha + a.numero)).slice(0, 25);
  return `
  <div class="page-head"><div><div class="eyebrow">Caja</div><h1>Cierre de hoy: ${money(hoy.reduce((s, f) => s + f.total, 0))}</h1><p>${hoy.length} comprobante${hoy.length === 1 ? '' : 's'} · cada consulta factura sola al guardarse.</p></div></div>
  <div class="kpis">
    ${['Efectivo', 'Tarjeta', 'Transferencia'].map(m => `<div class="card kpi"><span class="lbl">${m}</span><span class="val">${money0(by(m))}</span></div>`).join('')}
    <div class="card kpi"><span class="lbl">ITBIS cobrado hoy</span><span class="val">${money0(hoy.reduce((s, f) => s + f.itbis, 0))}</span><span class="sub">listo para el IT-1</span></div>
  </div>
  <div class="card"><div class="card-h"><h2>Comprobantes recientes</h2><span class="muted small">e-CF simulado en la demo</span></div>
    <div class="table-wrap"><table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Mascota</th><th>Método</th><th class="r">Total</th></tr></thead><tbody>
    ${all.map(f => { const o = owner(f.duenoId), p = pet(f.mascotaId); return `<tr class="click" data-act="invoice" data-id="${f.id}"><td class="mono">${f.numero}</td><td>${esc(fdate(f.fecha))}</td><td>${esc(o ? o.nombre : 'Consumidor final')}</td><td>${esc(p ? p.nombre : '—')}</td><td>${esc(f.metodo)}</td><td class="r num">${money(f.total)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}

let invFilter = '';
function vInventario() {
  const q = invFilter.toLowerCase();
  const rows = db.productos.filter(p => !q || (p.nombre + p.cat).toLowerCase().includes(q));
  const valor = db.productos.reduce((s, p) => s + p.stock * p.precio, 0);
  return `
  <div class="page-head"><div><div class="eyebrow">Inventario</div><h1>${db.productos.length} productos · ${money0(valor)} en existencia</h1><p>Se descuenta solo cuando se usa o se vende en una consulta.</p></div></div>
  <div class="card"><div class="card-h"><input class="input" id="inv-filter" placeholder="Buscar producto o categoría" value="${esc(invFilter)}" style="max-width:360px"><span class="pill warn">${lowStock().length} bajo mínimo</span></div>
  <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Existencia</th><th></th><th class="r">Precio</th><th></th></tr></thead><tbody>
  ${rows.map(p => { const r = Math.min(1, p.stock / (p.min * 2.5)); const cls = p.stock === 0 ? 'out' : p.stock <= p.min ? 'low' : '';
    return `<tr><td><b>${esc(p.nombre)}</b></td><td>${esc(p.cat)}</td><td class="num">${p.stock} <span class="muted small">${esc(pl(p.unidad, p.stock))}</span></td>
      <td><div class="row" style="flex-wrap:nowrap"><span class="stockbar"><i class="${cls}" style="width:${Math.max(4, r * 100)}%"></i></span>${cls ? `<span class="pill ${cls === 'out' ? 'bad' : 'warn'}">${cls === 'out' ? 'Agotado' : 'Bajo'}</span>` : ''}</div></td>
      <td class="r num">${money(p.precio)}</td><td class="r"><button class="btn sm" data-act="stock-in" data-id="${p.id}" type="button">+ Entrada</button></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}

function vReportes() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(i - 6));
  const vals = days.map(d => db.facturas.filter(f => f.fecha === d).reduce((s, f) => s + f.total, 0));
  const total = vals.reduce((a, b) => a + b, 0);
  const W = 640, H = 220, L = 10, R = 10, T = 26, B = 30, bw = (W - L - R) / 7;
  const mx = Math.max(...vals, 1);
  const bars = vals.map((v, i) => { const h = (H - T - B) * v / mx; const x = L + i * bw + bw * .18; const w = bw * .64; const isT = i === 6;
    return `<rect x="${x}" y="${H - B - h}" width="${w}" height="${h}" rx="5" fill="${isT ? '#3454D1' : '#C9D3F6'}"/>
      <text x="${x + w / 2}" y="${H - B - h - 7}" text-anchor="middle" class="v">${v ? nf0.format(Math.round(v / 100) / 10) + 'k' : ''}</text>
      <text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${esc(parseD(days[i]).toLocaleDateString('es-DO', { weekday: 'short' }))}</text>`; }).join('');
  const count = {}; db.facturas.filter(f => diffDays(TODAY, f.fecha) <= 6).forEach(f => f.lineas.forEach(l => { count[l.desc] = (count[l.desc] || 0) + l.precio * l.cant; }));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topMax = top.length ? top[0][1] : 1;
  const t = db.tiempos;
  return `
  <div class="page-head"><div><div class="eyebrow">Reportes · últimos 7 días</div><h1>${money0(total)} facturados</h1><p>${db.facturas.filter(f => diffDays(TODAY, f.fecha) <= 6).length} comprobantes · promedio diario ${money0(total / 7)}</p></div></div>
  <div class="cols">
    <div class="card"><div class="card-h"><h2>Ingresos por día</h2><span class="muted small">RD$, ITBIS incluido</span></div><div class="card-b chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos por día">${bars}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#E4E7EB"/></svg></div></div>
    <div class="card"><div class="card-h"><h2>Lo que más vende</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
      ${top.map(([n, v]) => `<div style="display:flex;flex-direction:column;gap:4px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="small" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span><span class="num small">${money0(v)}</span></div><span class="stockbar" style="width:100%"><i style="width:${v / topMax * 100}%;background:var(--blue)"></i></span></div>`).join('')}
    </div></div>
  </div>
  <div class="kpis">
    <div class="card kpi"><span class="lbl">Consultas medidas en vivo</span><span class="val">${t.length}</span></div>
    <div class="card kpi"><span class="lbl">Tiempo promedio</span><span class="val">${t.length ? mmss(t.reduce((s, x) => s + x.seg, 0) / t.length) : '—'}</span><span class="sub">historia + cobro + recordatorio</span></div>
    <div class="card kpi"><span class="lbl">Pacientes activos</span><span class="val">${db.mascotas.length}</span></div>
    <div class="card kpi"><span class="lbl">Recordatorios pendientes</span><span class="val">${dueVaccines(30).length}</span><span class="sub">próximos 30 días</span></div>
  </div>`;
}

/* ---------- Consulta (el corazón de la demo) ---------- */
let cx = null;
function vConsulta(arg) {
  let cita = db.citas.find(c => c.id === arg);
  let mascotaId = cita ? cita.mascotaId : arg && arg.startsWith('m') ? arg : null;
  if (!mascotaId && arg && arg.startsWith('w')) mascotaId = arg.slice(1);
  const p = pet(mascotaId); if (!p) return '<div class="empty">Paciente no encontrado.</div>';
  const o = owner(p.duenoId);
  if (!cx || cx.key !== arg) {
    cx = { key: arg, citaId: cita ? cita.id : null, mascotaId: p.id, start: Date.now(), plantilla: null, motivo: cita ? cita.motivo : 'Consulta', peso: p.peso, temp: '', fc: '', s: '', o: '', a: '', p: '', items: [], servicios: [], next: null, metodo: 'Efectivo', resumen: '', vet: cita ? cita.vet : VETS[0] };
    if (cita && cita.estado === 'Programada') { cita.estado = 'En sala'; save(); }
    applyPlantilla(cita ? cita.tipo : 'general', true);
  }
  const lv = lastVisit(p.id);
  const vacs = dueVaccines(30).filter(v => v.mascotaId === p.id);
  return `
  <div class="page-head"><div><div class="eyebrow">Consulta en curso · ${esc(cx.vet)}</div><h1>${esc(p.nombre)} · ${esc(cx.motivo)}</h1></div>
    <div class="row"><a class="btn ghost" href="#/agenda">Cancelar</a></div></div>
  <div class="cx">
    <div class="cx-side">
      <div class="card"><div class="pet-head" style="padding:16px">${avatar(p)}<div class="meta" style="min-width:0"><h2>${esc(p.nombre)}</h2><span class="muted small">${esc(p.especie)} · ${esc(p.raza)} · ${esc(p.sexo)} · ${age(p.nac)}</span></div></div>
        ${p.alergias ? `<div style="padding:0 16px 12px"><div class="allergy">${ic('alert')} ${esc(p.alergias)}</div></div>` : ''}
        <div class="list">
          <div class="li"><div class="li-main"><span class="lbl">Dueño</span><b>${esc(o.nombre)}</b><span class="muted mono">${esc(o.tel)}</span></div></div>
          <div class="li"><div class="li-main"><span class="lbl">Última visita</span>${lv ? `<b>${esc(fdate(lv.fecha))} · ${esc(lv.tipo)}</b><span class="muted">${esc(lv.a || lv.motivo)}</span>` : '<b>Primera visita</b>'}</div></div>
          ${vacs.length ? `<div class="li"><div class="li-main"><span class="lbl">Pendiente</span>${vacs.map(v => `<b style="color:var(--warn)">${esc(v.nombre)} · ${relDay(v.proxima)}</b>`).join('')}</div></div>` : ''}
          ${p.notas ? `<div class="li"><div class="li-main"><span class="lbl">Notas</span><span>${esc(p.notas)}</span></div></div>` : ''}
        </div>
        <div class="card-b"><a class="btn sm ghost" href="#/paciente/${p.id}" style="width:100%">Ver historia completa</a></div>
      </div>
    </div>

    <div class="stack">
      <div class="card"><div class="card-h"><h2>1 · Plantilla</h2><span class="muted small">Un toque llena la historia, los productos y la próxima cita</span></div>
        <div class="card-b"><div class="chips" id="cx-tpl">${Object.entries(PLANTILLAS).map(([k, t]) => `<button class="chip ${cx.plantilla === k ? 'on' : ''}" data-act="tpl" data-k="${k}" type="button">${t.nombre}</button>`).join('')}</div></div></div>

      <div class="card"><div class="card-h"><h2>2 · Examen y notas</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
        <div class="grid-3">
          <div class="field"><label for="cx-peso">Peso (kg)</label><input class="input num mono" id="cx-peso" data-bind="peso" inputmode="decimal" value="${esc(cx.peso)}"></div>
          <div class="field"><label for="cx-temp">Temperatura (°C)</label><input class="input num mono" id="cx-temp" data-bind="temp" inputmode="decimal" placeholder="38.5" value="${esc(cx.temp)}"></div>
          <div class="field"><label for="cx-fc">Frec. cardiaca (lpm)</label><input class="input num mono" id="cx-fc" data-bind="fc" inputmode="numeric" placeholder="${p.especie === 'Felino' ? '160' : '100'}" value="${esc(cx.fc)}"></div>
        </div>
        <div class="soap">
          <div class="field"><label for="cx-s"><span>S</span>Lo que cuenta el dueño</label><textarea class="input" id="cx-s" data-bind="s">${esc(cx.s)}</textarea></div>
          <div class="field"><label for="cx-o"><span>O</span>Examen físico</label><textarea class="input" id="cx-o" data-bind="o">${esc(cx.o)}</textarea></div>
          <div class="field"><label for="cx-a"><span>A</span>Diagnóstico</label><textarea class="input" id="cx-a" data-bind="a">${esc(cx.a)}</textarea></div>
          <div class="field"><label for="cx-p"><span>P</span>Plan / indicaciones</label><textarea class="input" id="cx-p" data-bind="p">${esc(cx.p)}</textarea></div>
        </div>
        <div class="field"><span class="lbl">Diagnósticos frecuentes</span><div class="chips">${DX.map(d => `<button class="chip" data-act="dx" data-dx="${esc(d)}" type="button">${esc(d)}</button>`).join('')}</div></div>
      </div></div>

      <div class="card"><div class="card-h"><h2>3 · Tratamiento y cobro</h2><span class="muted small">Dosis sugerida por peso · el inventario se descuenta solo</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
        <div class="row">
          <select class="input" id="cx-add-prod" style="flex:1;min-width:200px"><option value="">+ Agregar medicamento o producto…</option>${db.productos.map(x => `<option value="${x.id}">${esc(x.nombre)} · ${money0(x.precio)} (${x.stock} disp.)</option>`).join('')}</select>
          <select class="input" id="cx-add-serv" style="flex:1;min-width:200px"><option value="">+ Agregar servicio…</option>${SERVICIOS.map(s => `<option value="${s.id}">${esc(s.nombre)} · ${money0(s.precio)}</option>`).join('')}</select>
        </div>
        <div class="lines" id="cx-lines"></div>
        <div class="next-box" id="cx-next"></div>
      </div></div>

      <div class="ai-box">
        <div class="row" style="justify-content:space-between"><span class="ai-h">${ic('spark')} Asistente DEXA · resumen para el dueño</span><button class="btn sm" data-act="ai" type="button">${ic('spark')} Redactar con IA</button></div>
        <textarea class="input" id="cx-resumen" data-bind="resumen" placeholder="Pulsa “Redactar con IA”: escribe el mensaje de alta para WhatsApp con diagnóstico, dosis y próxima cita.">${esc(cx.resumen)}</textarea>
        <span class="small muted">En la demo el texto se arma con los datos de la consulta. El veterinario lo revisa antes de enviarlo.</span>
      </div>

      <div class="save-bar">
        <div class="sum"><small>Total a cobrar (ITBIS incl.)</small><b class="num" id="cx-grand">RD$ 0.00</b></div>
        <div class="row"><div class="seg" id="cx-pay">${['Efectivo', 'Tarjeta', 'Transferencia'].map(m => `<button type="button" data-act="pay" data-m="${m}" class="${cx.metodo === m ? 'on' : ''}">${m}</button>`).join('')}</div>
          <button class="btn primary lg" data-act="cx-save" type="button">${ic('check')} Guardar y cobrar</button></div>
      </div>
    </div>
  </div>`;
}

function vacunaPorEspecie(p) { return p.especie === 'Felino' ? 'p3' : 'p2'; }
function applyPlantilla(k, silent) {
  const t = PLANTILLAS[k] || PLANTILLAS.general;
  const p = pet(cx.mascotaId);
  cx.plantilla = k;
  cx.s = t.s(cx.motivo); cx.o = t.o; cx.a = t.a; cx.p = t.p;
  cx.servicios = t.servicios.map(id => ({ ...SERVICIOS.find(s => s.id === id), cant: 1 }));
  cx.items = t.items.map(id => ({ productoId: id === 'VAC' ? vacunaPorEspecie(p) : id, cant: 1 }));
  cx.next = t.next ? { tipo: t.next.tipo, nombre: t.next.nombre === 'VAC' ? prod(vacunaPorEspecie(p)).nombre : t.next.nombre, fecha: addDays(t.next.dias) } : null;
  if (!silent) {
    ['s', 'o', 'a', 'p'].forEach(f => { const el = $('#cx-' + f); if (el) el.value = cx[f]; });
    $$('#cx-tpl .chip').forEach(c => c.classList.toggle('on', c.dataset.k === k));
    renderLines();
  }
}

function doseHint(pr) {
  if (!pr.mgkg) return '';
  const kg = parseFloat(cx.peso);
  if (!kg) return '';
  const mg = pr.mgkg * kg;
  const u = mg / pr.conc;
  const amount = pr.cu === 'tab' ? `${(Math.round(u * 4) / 4).toString().replace('.', ',')} tab` : `${u.toFixed(1).replace('.', ',')} ml`;
  return `Sugerida: ${pr.mgkg} mg/kg × ${kg} kg = ${mg.toFixed(1)} mg ≈ ${amount}`;
}
function cxLines() {
  return [
    ...cx.servicios.map((s, i) => ({ kind: 's', i, desc: s.nombre, cant: s.cant, precio: s.precio })),
    ...cx.items.map((it, i) => { const pr = prod(it.productoId); return { kind: 'p', i, desc: pr.nombre, cant: it.cant, precio: pr.precio, pr }; })
  ];
}
function renderLines() {
  const p = pet(cx.mascotaId);
  const lines = cxLines();
  $('#cx-lines').innerHTML = lines.length ? lines.map(l => {
    const warnBeta = l.pr && l.pr.beta && /penicilina/i.test(p.alergias);
    const warnStock = l.pr && l.cant > l.pr.stock;
    return `<div class="line"><div style="min-width:0"><b>${esc(l.desc)}</b>
      ${l.pr && doseHint(l.pr) ? `<div class="dose">${esc(doseHint(l.pr))}</div>` : ''}
      ${warnBeta ? `<div class="stockwarn" style="color:var(--bad);font-weight:600">${ic('alert')} ${esc(p.nombre)} es alérgico a la penicilina</div>` : ''}
      ${warnStock ? `<div class="stockwarn">Solo hay ${l.pr.stock} en inventario</div>` : ''}</div>
      <input class="input num mono" aria-label="Cantidad" type="number" min="1" step="1" value="${l.cant}" data-act="qty" data-kind="${l.kind}" data-i="${l.i}">
      <span class="num" style="text-align:right">${money(l.precio * l.cant)}</span>
      <button class="icon-btn" type="button" aria-label="Quitar" data-act="rm-line" data-kind="${l.kind}" data-i="${l.i}">${ic('trash')}</button></div>`;
  }).join('') : '<div class="muted small">Sin cargos todavía. Elige una plantilla o agrega un servicio.</div>';
  const sub = lines.reduce((s, l) => s + l.precio * l.cant, 0);
  const it = sub * ITBIS;
  $('#cx-lines').insertAdjacentHTML('beforeend', `<div class="totals" style="padding-top:12px;border-top:1px solid var(--line)"><div><span class="muted">Subtotal</span><span class="num">${money(sub)}</span></div><div><span class="muted">ITBIS 18 %</span><span class="num">${money(it)}</span></div><div class="grand"><span>Total</span><span class="num">${money(sub + it)}</span></div></div>`);
  $('#cx-grand').textContent = money(sub + it);
  $('#cx-next').innerHTML = cx.next
    ? `<div class="field"><label for="cx-next-n">Próximo ${cx.next.tipo === 'vacuna' ? 'recordatorio' : 'control'} (DEXA lo agenda solo)</label><input class="input" id="cx-next-n" data-bind-next="nombre" value="${esc(cx.next.nombre)}"></div>
       <div class="field"><label for="cx-next-f">Fecha</label><input class="input mono" id="cx-next-f" type="date" data-bind-next="fecha" value="${cx.next.fecha}"></div>`
    : `<div class="field"><span class="lbl">Próxima cita</span><span class="muted small">Ninguna programada.</span></div><div class="field" style="justify-content:flex-end"><button class="btn sm" data-act="add-next" type="button">+ Programar control</button></div>`;
  hydrateIcons($('#cx-lines'));
}

function mountConsulta() {
  renderLines();
  const el = $('#timer');
  el.hidden = false;
  const tick = () => { el.innerHTML = `<span class="dot"></span>${mmss((Date.now() - cx.start) / 1000)}`; };
  tick(); timerInt = setInterval(tick, 500);
}

function buildResumen() {
  const p = pet(cx.mascotaId), o = owner(p.duenoId);
  const meds = cx.items.map(it => { const pr = prod(it.productoId); const h = doseHint(pr); return `• ${pr.nombre}${h ? ' — ' + h.replace('Sugerida: ', '') : ''}`; });
  const a = (cx.a || 'Paciente sano').trim().replace(/\.$/, '');
  return [
    `Hola ${first(o.nombre)}, le escribimos de ${CLINICA}.`,
    `Hoy atendimos a ${p.nombre} (${cx.peso} kg).`,
    `Diagnóstico: ${a}.`,
    cx.p ? `Indicaciones: ${cx.p.trim()}` : '',
    meds.length ? `Tratamiento:\n${meds.join('\n')}` : '',
    cx.next ? `Próxima cita: ${cx.next.nombre}, ${fdate(cx.next.fecha)}. Le recordaremos por aquí.` : '',
    '¿Alguna duda? Responda este mensaje.'
  ].filter(Boolean).join('\n');
}
function typeResumen() {
  const ta = $('#cx-resumen'); const text = buildResumen();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ta.value = cx.resumen = text; return; }
  let i = 0; ta.value = '';
  const step = () => { i = Math.min(text.length, i + 6); ta.value = text.slice(0, i); if (i < text.length) requestAnimationFrame(step); else cx.resumen = text; };
  step();
}

function saveConsulta() {
  const p = pet(cx.mascotaId), o = owner(p.duenoId);
  const seg = Math.round((Date.now() - cx.start) / 1000);
  const lines = cxLines();
  if (!lines.length) { toast('Agrega al menos un servicio para cobrar.', 'alert'); return; }
  if (!cx.resumen) cx.resumen = buildResumen();
  const peso = parseFloat(cx.peso) || p.peso;
  const tpl = PLANTILLAS[cx.plantilla];
  db.consultas.push({ id: uid('q'), mascotaId: p.id, fecha: TODAY, vet: cx.vet, tipo: tpl ? tpl.nombre : 'Consulta', motivo: cx.motivo, peso, temp: cx.temp, fc: cx.fc, s: cx.s, o: cx.o, a: cx.a, p: cx.p, duracionSeg: seg });
  p.peso = peso;
  const desc = [];
  cx.items.forEach(it => { const pr = prod(it.productoId); pr.stock = Math.max(0, pr.stock - it.cant); desc.push(`−${it.cant} ${pr.nombre}`); });
  const f = makeFactura({ fecha: TODAY, duenoId: o.id, mascotaId: p.id, lineas: lines.map(l => ({ desc: l.desc, cant: l.cant, precio: l.precio })), metodo: cx.metodo });
  const now = new Date(); f.hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  db.facturas.push(f);
  // vacunas aplicadas hoy
  cx.items.forEach(it => { const pr = prod(it.productoId); if (pr.cat === 'Vacunas') db.vacunas.push({ id: uid('v'), mascotaId: p.id, nombre: pr.nombre, fecha: TODAY, proxima: addDays(365) }); });
  if (cx.next) {
    if (cx.next.tipo === 'vacuna' && !db.vacunas.some(v => v.mascotaId === p.id && v.nombre === cx.next.nombre && v.fecha === TODAY)) db.vacunas.push({ id: uid('v'), mascotaId: p.id, nombre: cx.next.nombre, fecha: TODAY, proxima: cx.next.fecha });
    else if (cx.next.tipo === 'vacuna') { const v = db.vacunas.find(v => v.mascotaId === p.id && v.nombre === cx.next.nombre && v.fecha === TODAY); v.proxima = cx.next.fecha; }
    if (cx.next.tipo === 'cita') db.citas.push({ id: uid('c'), mascotaId: p.id, fecha: cx.next.fecha, hora: '09:00', motivo: cx.next.nombre, tipo: 'control', estado: 'Programada', vet: cx.vet });
  }
  if (cx.citaId) { const c = db.citas.find(c => c.id === cx.citaId); if (c) c.estado = 'Atendida'; }
  db.tiempos.push({ seg, mascota: p.nombre });
  save();
  const msg = cx.resumen;
  const next = cx.next;
  cx = null;
  stopTimer();
  renderNav('pacientes');
  openModal(`${dialogHead('Consulta guardada')}
    <div class="dialog-b">
      <div class="done-time"><div class="num mono">${mmss(seg)}</div><div class="muted small">de principio a fin · con cuaderno y Excel serían ~${MANUAL_MIN} min</div></div>
      <div class="done-list">
        <div>${ic('check')}<span><b>Historia clínica</b> de ${esc(p.nombre)} actualizada (${peso} kg)</span></div>
        <div>${ic('check')}<span><b>Comprobante ${f.numero}</b> por ${money(f.total)} · ${esc(f.metodo)}</span></div>
        ${desc.length ? `<div>${ic('check')}<span><b>Inventario</b> descontado: ${esc(desc.join(', '))}</span></div>` : ''}
        ${next ? `<div>${ic('check')}<span><b>${next.tipo === 'vacuna' ? 'Recordatorio' : 'Cita de control'}</b> programado: ${esc(next.nombre)}, ${esc(fdate(next.fecha))}</span></div>` : ''}
        <div>${ic('check')}<span><b>Mensaje de alta</b> listo para WhatsApp</span></div>
      </div>
    </div>
    <div class="dialog-f">
      <button class="btn" data-act="invoice" data-id="${f.id}" type="button">${ic('receipt')} Ver comprobante</button>
      <a class="btn wa" target="_blank" rel="noopener" href="${waLink(o.tel, msg)}">${ic('msg')} Enviar por WhatsApp</a>
      <button class="btn primary" data-act="go" data-href="#/inicio" type="button">Listo</button>
    </div>`);
}

/* ---------- Modales ---------- */
let npStart = 0;
function modalNewPatient() {
  npStart = Date.now();
  openModal(`${dialogHead('Nuevo paciente')}
    <form data-form="patient">
    <div class="dialog-b">
      <div class="field"><label for="np-tel">Teléfono del dueño (WhatsApp)</label><input class="input mono" id="np-tel" name="tel" inputmode="tel" placeholder="809-000-0000" required autofocus><span class="hint-ok" id="np-hint"></span></div>
      <div class="field"><label for="np-dueno">Nombre del dueño</label><input class="input" id="np-dueno" name="dueno" required placeholder="Nombre y apellido"></div>
      <div class="grid-2">
        <div class="field"><label for="np-nombre">Mascota</label><input class="input" id="np-nombre" name="nombre" required placeholder="Ej.: Toby"></div>
        <div class="field"><span class="lbl">Especie</span><div class="seg" id="np-esp"><button type="button" class="on" data-act="esp" data-v="Canino">Perro</button><button type="button" data-act="esp" data-v="Felino">Gato</button><button type="button" data-act="esp" data-v="Otro">Otro</button></div></div>
      </div>
      <div class="grid-3">
        <div class="field"><label for="np-raza">Raza</label><input class="input" id="np-raza" name="raza" placeholder="Sato, Poodle…"></div>
        <div class="field"><label for="np-sexo">Sexo</label><select class="input" id="np-sexo" name="sexo"><option>Macho</option><option>Hembra</option></select></div>
        <div class="field"><label for="np-peso">Peso (kg)</label><input class="input mono" id="np-peso" name="peso" inputmode="decimal" placeholder="0.0"></div>
      </div>
      <div class="field"><label for="np-alerg">Alergias (opcional)</label><input class="input" id="np-alerg" name="alergias" placeholder="Ninguna conocida"></div>
    </div>
    <div class="dialog-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn" type="submit" name="then" value="ficha">Guardar</button><button class="btn primary" type="submit" name="then" value="atender">${ic('steth')} Guardar y atender</button></div>
    </form>`);
}
function modalNewCita(petId, motivo) {
  const now = new Date(); const m = now.getMinutes() < 30 ? 30 : 0; const h = now.getMinutes() < 30 ? now.getHours() : now.getHours() + 1;
  const hora = `${pad(Math.min(h, 18))}:${pad(m)}`;
  openModal(`${dialogHead('Nueva cita')}
    <form data-form="cita"><div class="dialog-b">
      <div class="field"><label for="nc-pet">Paciente</label><select class="input" id="nc-pet" name="pet" required>${db.mascotas.map(p => `<option value="${p.id}" ${p.id === petId ? 'selected' : ''}>${esc(p.nombre)} — ${esc(owner(p.duenoId).nombre)}</option>`).join('')}</select></div>
      <div class="grid-2"><div class="field"><label for="nc-fecha">Fecha</label><input class="input mono" type="date" id="nc-fecha" name="fecha" value="${agendaDay >= TODAY ? agendaDay : TODAY}" required></div><div class="field"><label for="nc-hora">Hora</label><input class="input mono" type="time" id="nc-hora" name="hora" value="${hora}" required></div></div>
      <div class="field"><label for="nc-motivo">Motivo</label><input class="input" id="nc-motivo" name="motivo" value="${esc(motivo || '')}" placeholder="Vacuna, control, consulta…" required autofocus></div>
      <div class="grid-2"><div class="field"><label for="nc-tipo">Tipo</label><select class="input" id="nc-tipo" name="tipo">${Object.entries(PLANTILLAS).map(([k, t]) => `<option value="${k}" ${motivo && /vacuna/i.test(motivo) && k === 'vacuna' ? 'selected' : ''}>${t.nombre}</option>`).join('')}</select></div>
      <div class="field"><label for="nc-vet">Veterinario</label><select class="input" id="nc-vet" name="vet">${VETS.map(v => `<option>${esc(v)}</option>`).join('')}</select></div></div>
    </div><div class="dialog-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn primary" type="submit">Agendar</button></div></form>`);
}
function modalInvoice(id) {
  const f = db.facturas.find(x => x.id === id); if (!f) return;
  const o = owner(f.duenoId), p = pet(f.mascotaId);
  openModal(`${dialogHead('Comprobante')}
    <div class="dialog-b print-area"><div class="invoice">
      <div class="inv-h"><div><b style="font-family:var(--f-display);font-size:16px">${esc(CLINICA)}</b><div class="muted small">RNC 000-00000-0 (demo) · Santo Domingo</div></div>
        <div style="text-align:right"><div class="lbl">Factura de consumo electrónica</div><div class="mono"><b>${f.numero}</b></div><div class="muted small">${esc(fdate(f.fecha))}${f.hora ? ' · ' + f.hora : ''}</div></div></div>
      <div class="small"><b>Cliente:</b> ${esc(o ? o.nombre : 'Consumidor final')}${p ? ` · <b>Paciente:</b> ${esc(p.nombre)}` : ''} · <b>Pago:</b> ${esc(f.metodo)}</div>
      <div class="table-wrap"><table><thead><tr><th style="padding-left:0">Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r" style="padding-right:0">Importe</th></tr></thead><tbody>
        ${f.lineas.map(l => `<tr><td style="padding-left:0">${esc(l.desc)}</td><td class="r num">${l.cant}</td><td class="r num">${money(l.precio)}</td><td class="r num" style="padding-right:0">${money(l.precio * l.cant)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="totals"><div><span class="muted">Subtotal</span><span class="num">${money(f.subtotal)}</span></div><div><span class="muted">ITBIS 18 %</span><span class="num">${money(f.itbis)}</span></div><div class="grand"><span>Total</span><span class="num">${money(f.total)}</span></div></div>
      <p class="legal">Comprobante simulado para la demostración. La emisión real de e-CF se activa cuando el sistema quede certificado ante la DGII.</p>
    </div></div>
    <div class="dialog-f"><button class="btn" data-act="print" type="button">${ic('print')} Imprimir</button>${o ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(o.tel, `Hola ${first(o.nombre)}, gracias por visitarnos. Su comprobante ${f.numero} por ${money(f.total)} está listo.`)}">${ic('msg')} Enviar por WhatsApp</a>` : ''}<button class="btn primary" data-act="close" type="button">Cerrar</button></div>`, { wide: true });
}
function modalTomorrow() {
  const d = addDays(1);
  const list = db.citas.filter(c => c.fecha === d && c.estado === 'Programada').sort((a, b) => a.hora.localeCompare(b.hora));
  openModal(`${dialogHead('Recordar las citas de mañana')}
    <div class="dialog-b" style="padding:0"><div class="list">${list.map(c => { const p = pet(c.mascotaId), o = owner(p.duenoId);
      const text = `Hola ${first(o.nombre)}, le recordamos la cita de ${p.nombre} mañana a las ${c.hora} en ${CLINICA} (${c.motivo}). Responda 1 para confirmar o 2 para cambiarla.`;
      return `<div class="li"><span class="hour">${esc(c.hora)}</span>${avatar(p)}<div class="li-main"><b>${esc(p.nombre)}</b><span class="muted">${esc(o.nombre)} · ${esc(c.motivo)}</span></div><div class="li-actions"><a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(o.tel, text)}" data-act="wa-sent">${ic('msg')} Enviar</a></div></div>`; }).join('') || '<div class="empty">No hay citas programadas para mañana.</div>'}</div></div>
    <div class="dialog-f"><span class="muted small" style="margin-right:auto">El mensaje ya va escrito; solo hay que tocar enviar.</span><button class="btn primary" data-act="close" type="button">Listo</button></div>`);
}
function modalStockIn(id) {
  const p = prod(id);
  openModal(`${dialogHead('Entrada de inventario')}
    <form data-form="stock" data-id="${id}"><div class="dialog-b"><p><b>${esc(p.nombre)}</b> · hay ${p.stock} ${esc(pl(p.unidad, p.stock))}</p>
      <div class="field"><label for="si-qty">Cantidad que entra</label><input class="input mono" id="si-qty" name="qty" type="number" min="1" value="${Math.max(1, p.min * 2 - p.stock)}" required autofocus></div></div>
    <div class="dialog-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn primary" type="submit">Registrar</button></div></form>`);
}

/* Paleta de búsqueda (Ctrl K) */
let palSel = 0;
function modalPalette() {
  openModal(`<div class="dialog-b"><input id="pal-q" placeholder="Nombre de la mascota, del dueño o teléfono…" autocomplete="off" autofocus aria-label="Buscar"><div class="pal-list" id="pal-list"></div></div>`, { cls: 'palette' });
  palSel = 0; renderPalette('');
}
function palResults(q) {
  q = q.toLowerCase().trim(); const qd = q.replace(/\D/g, '');
  const out = [];
  db.mascotas.forEach(p => { const o = owner(p.duenoId);
    const hit = !q || p.nombre.toLowerCase().includes(q) || o.nombre.toLowerCase().includes(q) || p.raza.toLowerCase().includes(q) || (qd.length >= 3 && o.tel.replace(/\D/g, '').includes(qd));
    if (hit) out.push({ p, o }); });
  return out.slice(0, 8);
}
function renderPalette(q) {
  const r = palResults(q);
  palSel = Math.min(palSel, Math.max(0, r.length - 1));
  $('#pal-list').innerHTML = (r.length ? `<div class="pal-group">Pacientes</div>` + r.map(({ p, o }, i) => `<button class="pal-item ${i === palSel ? 'on' : ''}" data-act="go" data-href="#/paciente/${p.id}" type="button">${avatar(p)}<span class="li-main"><b>${esc(p.nombre)} <span class="muted" style="font-weight:400">· ${esc(p.raza)}</span></b><span class="muted">${esc(o.nombre)} · ${esc(o.tel)}</span></span><span class="btn sm" data-act="walkin" data-pet="${p.id}">Atender</span></button>`).join('') : `<div class="empty">Sin resultados para “${esc(q)}”.</div>`)
    + `<div class="pal-group">Acciones</div><button class="pal-item" data-act="new-patient" type="button"><span class="avatar">${ic('plus')}</span><span class="li-main"><b>Registrar nuevo paciente</b></span></button>`;
  hydrateIcons($('#pal-list'));
}

/* ---------- Eventos ---------- */
const actions = {
  close: closeModal,
  reset: () => {
    openModal(`${dialogHead('Reiniciar la demo')}<div class="dialog-b"><p>Se borran las consultas, cobros y pacientes que agregaste y vuelven los datos de ejemplo.</p></div><div class="dialog-f"><button class="btn" data-act="close" type="button">Cancelar</button><button class="btn primary" data-act="reset-ok" type="button">Reiniciar</button></div>`);
  },
  'reset-ok': () => { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } cx = null; seed(); save(); closeModal(); location.hash = '#/inicio'; route(); toast('Demo reiniciada'); },
  palette: modalPalette,
  'new-patient': () => modalNewPatient(),
  'new-cita': el => modalNewCita(el.dataset.pet, el.dataset.motivo),
  'remind-tomorrow': modalTomorrow,
  'stock-in': el => modalStockIn(el.dataset.id),
  invoice: el => modalInvoice(el.dataset.id),
  print: () => window.print(),
  go: el => { closeModal(); location.hash = el.dataset.href; },
  walkin: el => { closeModal(); cx = null; location.hash = '#/consulta/w' + el.dataset.pet; },
  day: el => { const d = +el.dataset.d; agendaDay = d === 0 ? TODAY : addDays(d, agendaDay); route(); },
  'cita-estado': el => { const c = db.citas.find(c => c.id === el.dataset.id); c.estado = el.dataset.estado; save(); route(); toast(`${pet(c.mascotaId).nombre}: ${c.estado.toLowerCase()}`); },
  'pet-tab': el => { petTab = el.dataset.tab; route(); },
  'wa-sent': () => toast('Abriendo WhatsApp con el mensaje listo', 'msg'),
  tpl: el => { applyPlantilla(el.dataset.k); toast(`Plantilla “${PLANTILLAS[el.dataset.k].nombre}” aplicada`, 'spark'); },
  dx: el => { const ta = $('#cx-a'); const v = el.dataset.dx; ta.value = ta.value.trim() ? ta.value.trim().replace(/\.?$/, '. ') + v + '.' : v + '.'; cx.a = ta.value; },
  'rm-line': el => { (el.dataset.kind === 's' ? cx.servicios : cx.items).splice(+el.dataset.i, 1); renderLines(); },
  'add-next': () => { cx.next = { tipo: 'cita', nombre: 'Control', fecha: addDays(15) }; renderLines(); },
  pay: el => { cx.metodo = el.dataset.m; $$('#cx-pay button').forEach(b => b.classList.toggle('on', b === el)); },
  ai: typeResumen,
  'cx-save': saveConsulta,
  esp: el => { $$('#np-esp button').forEach(b => b.classList.toggle('on', b === el)); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  e.stopPropagation();
  fn(el);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pet-filter') { petFilter = t.value; $('#pet-rows').innerHTML = petRows(); hydrateIcons($('#pet-rows')); return; }
  if (t.id === 'inv-filter') { invFilter = t.value; const pos = t.selectionStart; route(); const n = $('#inv-filter'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.id === 'pal-q') { palSel = 0; renderPalette(t.value); return; }
  if (t.id === 'np-tel') {
    const d = t.value.replace(/\D/g, '');
    const o = d.length >= 10 ? db.duenos.find(x => x.tel.replace(/\D/g, '') === d.slice(-10)) : null;
    $('#np-hint').textContent = o ? `Cliente existente: ${o.nombre} (${db.mascotas.filter(m => m.duenoId === o.id).map(m => m.nombre).join(', ')})` : '';
    if (o) $('#np-dueno').value = o.nombre;
    return;
  }
  if (!cx) return;
  if (t.dataset.bind) { cx[t.dataset.bind] = t.value; if (t.dataset.bind === 'peso') renderLines(); return; }
  if (t.dataset.bindNext && cx.next) { cx.next[t.dataset.bindNext] = t.value; return; }
  if (t.dataset.act === 'qty') { const arr = t.dataset.kind === 's' ? cx.servicios : cx.items; arr[+t.dataset.i].cant = Math.max(1, parseInt(t.value, 10) || 1); const pos = t.dataset.i, kind = t.dataset.kind; renderLines(); const n = $(`#cx-lines [data-act="qty"][data-kind="${kind}"][data-i="${pos}"]`); if (n) { n.focus(); } }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (!cx) return;
  if (t.id === 'cx-add-prod' && t.value) { const ex = cx.items.find(i => i.productoId === t.value); if (ex) ex.cant++; else cx.items.push({ productoId: t.value, cant: 1 }); t.value = ''; renderLines(); }
  if (t.id === 'cx-add-serv' && t.value) { const s = SERVICIOS.find(x => x.id === t.value); cx.servicios.push({ ...s, cant: 1 }); t.value = ''; renderLines(); }
});

document.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  const data = Object.fromEntries(new FormData(f));
  if (f.dataset.form === 'patient') {
    const then = e.submitter ? e.submitter.value : 'ficha';
    const d = data.tel.replace(/\D/g, '');
    let o = db.duenos.find(x => x.tel.replace(/\D/g, '') === d.slice(-10));
    if (!o) { o = { id: uid('d'), nombre: data.dueno.trim(), tel: data.tel.trim(), dir: '' }; db.duenos.push(o); }
    const esp = ($('#np-esp .on') || {}).dataset?.v || 'Canino';
    const p = { id: uid('m'), duenoId: o.id, nombre: data.nombre.trim(), especie: esp, raza: data.raza.trim() || (esp === 'Felino' ? 'Criolla' : 'Sato (mestizo)'), sexo: data.sexo, nac: '', peso: parseFloat(String(data.peso).replace(',', '.')) || '', alergias: data.alergias.trim(), notas: '' };
    db.mascotas.push(p); save();
    const seg = Math.round((Date.now() - npStart) / 1000);
    closeModal();
    toast(`${esc(p.nombre)} registrado en ${mmss(seg)}`);
    if (then === 'atender') { cx = null; location.hash = '#/consulta/w' + p.id; } else location.hash = '#/paciente/' + p.id;
  }
  if (f.dataset.form === 'cita') {
    db.citas.push({ id: uid('c'), mascotaId: data.pet, fecha: data.fecha, hora: data.hora, motivo: data.motivo.trim(), tipo: data.tipo, estado: 'Programada', vet: data.vet });
    save(); closeModal(); agendaDay = data.fecha; toast(`Cita agendada: ${esc(pet(data.pet).nombre)}, ${esc(fshort(data.fecha))} ${esc(data.hora)}`);
    if (location.hash.startsWith('#/agenda')) route(); else location.hash = '#/agenda';
  }
  if (f.dataset.form === 'stock') {
    const p = prod(f.dataset.id); p.stock += Math.max(1, parseInt(data.qty, 10) || 0); save(); closeModal(); route(); toast(`${esc(p.nombre)}: ${p.stock} en existencia`);
  }
});

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modalPalette(); return; }
  if (e.key === '/' && !typing && $('#modal').hidden) { e.preventDefault(); modalPalette(); return; }
  if (e.key === 'Escape' && !$('#modal').hidden) { closeModal(); return; }
  if (document.activeElement.id === 'pal-q') {
    const items = $$('#pal-list .pal-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(items.length - 1, palSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); items[palSel] && items[palSel].click(); return; }
    else return;
    items.forEach((it, i) => it.classList.toggle('on', i === palSel));
    items[palSel] && items[palSel].scrollIntoView({ block: 'nearest' });
  }
});

window.addEventListener('hashchange', route);
load();
$('#clinic-name').textContent = CLINICA;
hydrateIcons();
route();
