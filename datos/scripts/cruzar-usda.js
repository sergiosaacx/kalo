// Cruza datos/alimentos-lista.csv con los CSV del USDA (Foundation + SR Legacy).
// Uso: node cruzar-usda.js <carpeta-usda>
// Escribe datos/alimentos-usda.json (nutrientes por 100 g + porciones) y lista los que no casan.
const fs = require('fs');
const path = require('path');

const raiz = process.argv[2];
const DATOS = path.join(__dirname, '..');

// CSV con comillas dobles ("" escapa una comilla)
function leerCSV(archivo) {
  const txt = fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '');
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.filter(f => f.length > 1).map(f => Object.fromEntries(cab.map((h, i) => [h, f[i]])));
}

const buscarDir = patron => fs.readdirSync(raiz).filter(d => d.includes(patron)).map(d => {
  const dentro = path.join(raiz, d, d);
  return fs.existsSync(dentro) ? dentro : path.join(raiz, d);
})[0];
// SR Legacy primero: sus registros vienen completos; Foundation solo si el nombre no existe en SR
const fuentes = [['sr_legacy', buscarDir('sr_legacy')], ['foundation', buscarDir('foundation')]];

// Nutrientes que guarda Kalo: id USDA → clave
const NUT = {
  1008: 'kcal', 2047: 'kcal_atwater', 2048: 'kcal_atwater', 1085: 'grasa_g', 1050: 'carbos_g', 1003: 'proteina_g', 1005: 'carbos_g', 1004: 'grasa_g',
  1079: 'fibra_g', 2000: 'azucar_g', 1093: 'sodio_mg', 1258: 'grasa_sat_g', 1253: 'colesterol_mg',
  1087: 'calcio_mg', 1089: 'hierro_mg', 1090: 'magnesio_mg', 1091: 'fosforo_mg', 1092: 'potasio_mg',
  1095: 'zinc_mg', 1098: 'cobre_mg', 1101: 'manganeso_mg', 1103: 'selenio_ug',
  1106: 'vit_a_ug', 1162: 'vit_c_mg', 1114: 'vit_d_ug', 1109: 'vit_e_mg', 1185: 'vit_k_ug',
  1165: 'b1_mg', 1166: 'b2_mg', 1167: 'b3_mg', 1175: 'b6_mg', 1177: 'folato_ug', 1178: 'b12_ug',
};

const porDescripcion = new Map(); // descripción en minúscula → {fdc_id, fuente}
const datos = {}; // fdc_id → {nut:{}, porciones:[]}
for (const [fuente, dir] of fuentes) {
  for (const f of leerCSV(path.join(dir, 'food.csv'))) {
    if (fuente === 'foundation' && f.data_type !== 'foundation_food') continue;
    const k = f.description.trim().toLowerCase();
    if (!porDescripcion.has(k)) porDescripcion.set(k, { fdc_id: f.fdc_id, fuente, descripcion: f.description });
  }
}
const lista = leerCSV(path.join(DATOS, 'alimentos-lista.csv'));
const buscados = new Set();
const casados = lista.map(a => {
  const m = a.usda ? porDescripcion.get(a.usda.trim().toLowerCase()) : null;
  if (m) buscados.add(m.fdc_id);
  return { ...a, m };
});

for (const [, dir] of fuentes) {
  const unidades = Object.fromEntries(leerCSV(path.join(dir, 'measure_unit.csv')).map(u => [u.id, u.name]));
  for (const n of leerCSV(path.join(dir, 'food_nutrient.csv'))) {
    if (!buscados.has(n.fdc_id) || !NUT[n.nutrient_id]) continue;
    (datos[n.fdc_id] ??= { nut: {}, porciones: [] }).nut[NUT[n.nutrient_id]] = Number(n.amount);
  }
  for (const p of leerCSV(path.join(dir, 'food_portion.csv'))) {
    if (!buscados.has(p.fdc_id)) continue;
    const unidad = unidades[p.measure_unit_id];
    const texto = [p.amount, unidad && unidad !== 'undetermined' ? unidad : '', p.modifier, p.portion_description]
      .filter(x => x && x.trim()).join(' ').trim();
    (datos[p.fdc_id] ??= { nut: {}, porciones: [] }).porciones.push({ texto, gramos: Number(p.gram_weight) });
  }
}

const salida = [], faltan = [];
for (const a of casados) {
  if (!a.m) { faltan.push(`${a.id} (${a.usda || 'sin dato USDA'})`); continue; }
  const d = datos[a.m.fdc_id] || { nut: {}, porciones: [] };
  // Algunos registros Foundation no traen energía: Atwater general o, si no, 4/4/9 de los macros
  if (d.nut.kcal == null && d.nut.kcal_atwater != null) d.nut.kcal = d.nut.kcal_atwater;
  if (d.nut.kcal == null && (d.nut.proteina_g != null || d.nut.grasa_g != null || d.nut.carbos_g != null)) {
    d.nut.kcal = Math.round(4 * d.nut.proteina_g + 4 * (d.nut.carbos_g || 0) + 9 * (d.nut.grasa_g || 0));
    d.nut.kcal_calculadas = true;
  }
  delete d.nut.kcal_atwater;
  salida.push({
    id: a.id, nombre: a.nombre, sinonimos: a.sinonimos ? a.sinonimos.split('|') : [], categoria: a.categoria,
    fuente: `USDA ${a.m.fuente} · ${a.m.fdc_id}`, usda: a.m.descripcion, por_100g: d.nut, porciones: d.porciones,
  });
}
fs.writeFileSync(path.join(DATOS, 'alimentos-usda.json'), JSON.stringify(salida, null, 1));
const sinKcal = salida.filter(s => s.por_100g.kcal == null).map(s => s.id);
console.log(`casados ${salida.length} de ${lista.length} · sin kcal: ${sinKcal.join(', ') || 'ninguno'}`);
console.log('FALTAN:\n' + faltan.join('\n'));
