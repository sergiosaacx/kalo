// Genera datos/menus.sql: los menús colombianos como opciones de Kalo (fuente 'kalo', sin cuenta).
// En el JSON cada ítem va en gramos; en la base se guarda en porciones base (gramos / porcion_base.gramos).
// Uso: node sql-menus.js   (borra y vuelve a crear las opciones de Kalo)
const fs = require('fs');
const path = require('path');
const DATOS = path.join(__dirname, '..');
const { baseDe } = require('./porcion-base');

const leer = f => fs.existsSync(path.join(DATOS, f)) ? JSON.parse(fs.readFileSync(path.join(DATOS, f), 'utf8')) : [];
const menus = leer('menus-colombianos.json');
// Misma porción base que guarda sql-alimentos.js
const alimentos = Object.fromEntries([...leer('alimentos-usda.json'), ...leer('recetas-calculadas.json'), ...leer('alimentos-investigados.json')]
  .map(a => [a.id, { ...a, base: baseDe(a) }]));
const q = s => `'${String(s).replace(/'/g, "''")}'`;

let sql = `delete from public.opciones where fuente = 'kalo';\n`;
for (const m of menus) {
  let kcal = 0;
  const items = Object.entries(m.items).map(([id, g], i) => {
    const a = alimentos[id];
    if (!a) throw new Error(`${m.nombre}: no existe el alimento ${id}`);
    kcal += (a.por_100g.kcal || 0) * g / 100;
    return `(${q(id)}, ${Math.round(g / a.base.gramos * 100) / 100}, ${i})`;
  });
  sql += `with o as (insert into public.opciones (cuenta_id, comida, nombre, fuente, descripcion) values (null, ${q(m.comida)}, ${q(m.nombre)}, 'kalo', ${q(m.descripcion)}) returning id)
insert into public.opcion_items (opcion_id, alimento_id, cantidad, orden) select o.id, v.a, v.c, v.n from o, (values ${items.join(', ')}) as v(a, c, n);\n`;
  console.log(`${m.comida.padEnd(5)} ${Math.round(kcal).toString().padStart(5)} kcal · ${m.nombre}`);
}
fs.writeFileSync(path.join(DATOS, 'menus.sql'), sql);
console.log(`${menus.length} menús → datos/menus.sql`);
