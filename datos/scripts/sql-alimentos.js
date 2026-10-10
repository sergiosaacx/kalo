// Genera datos/alimentos.sql (upsert en public.alimentos) desde datos/alimentos-usda.json.
// Uso: node sql-alimentos.js
const fs = require('fs');
const path = require('path');
const DATOS = path.join(__dirname, '..');
const { porcionesEs, porcionBase } = require('./porciones-es');
const leer = f => fs.existsSync(path.join(DATOS, f)) ? JSON.parse(fs.readFileSync(path.join(DATOS, f), 'utf8')) : [];
// USDA + recetas calculadas + alimentos investigados en otras fuentes (estos dos ya traen porciones_es)
const lista = [...leer('alimentos-usda.json'), ...leer('recetas-calculadas.json'), ...leer('alimentos-investigados.json')];

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const redondear = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]));


const ajustes = JSON.parse(fs.readFileSync(path.join(DATOS, 'porciones-ajustes.json'), 'utf8'));
const conAjuste = (id, lista) => ajustes[id] ? [ajustes[id], ...lista.filter(p => p.texto !== ajustes[id].texto)] : lista;
const filas = lista.map(a => {
  const porciones = conAjuste(a.id, a.porciones_es || porcionesEs(a.porciones));
  const base = ajustes[a.id] || porcionBase(porciones);
  return `(${[
  q(a.id), q(a.nombre), `array[${a.sinonimos.map(q).join(',')}]::text[]`, q(a.categoria), q(a.fuente),
  q(JSON.stringify(redondear(a.por_100g))) + '::jsonb', q(JSON.stringify(porciones)) + '::jsonb',
  q(JSON.stringify(base)) + '::jsonb', q(sinTildes([a.nombre, ...a.sinonimos].join(' '))),
].join(', ')})`; });

const sql = `insert into public.alimentos (id, nombre, sinonimos, categoria, fuente, por_100g, porciones, porcion_base, busqueda) values
${filas.join(',\n')}
on conflict (id) do update set nombre = excluded.nombre, sinonimos = excluded.sinonimos, categoria = excluded.categoria,
  fuente = excluded.fuente, por_100g = excluded.por_100g, porciones = excluded.porciones,
  porcion_base = excluded.porcion_base, busqueda = excluded.busqueda;
`;
fs.writeFileSync(path.join(DATOS, 'alimentos.sql'), sql);
console.log(`${filas.length} alimentos → datos/alimentos.sql`);
