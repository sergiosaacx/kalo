// Calcula los nutrientes de las preparaciones sumando sus ingredientes del USDA.
// Lee datos/recetas.json + datos/alimentos-usda.json → escribe datos/recetas-calculadas.json
// por_100g = Σ(ingrediente_100g × gramos/100) / rinde_g × 100
const fs = require('fs');
const path = require('path');
const DATOS = path.join(__dirname, '..');
const base = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DATOS, 'alimentos-usda.json'), 'utf8')).map(a => [a.id, a]));
const recetas = JSON.parse(fs.readFileSync(path.join(DATOS, 'recetas.json'), 'utf8'));

const salida = recetas.map(r => {
  const suma = {};
  for (const [id, g] of Object.entries(r.ingredientes)) {
    const ing = base[id];
    if (!ing) throw new Error(`${r.id}: no existe el ingrediente ${id}`);
    for (const [k, v] of Object.entries(ing.por_100g)) if (typeof v === 'number') suma[k] = (suma[k] || 0) + v * g / 100;
  }
  const por_100g = Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, Math.round(v / r.rinde_g * 100 * 100) / 100]));
  Object.assign(por_100g, r.extra_100g || {});
  return {
    id: r.id, nombre: r.nombre, sinonimos: r.sinonimos, categoria: r.categoria,
    fuente: 'Receta Kalo · ' + Object.entries(r.ingredientes).map(([id, g]) => `${base[id].nombre} ${g} g`).join(', ') + ` → rinde ${r.rinde_g} g`,
    por_100g, porciones_es: [...r.porciones, { texto: '100 g', gramos: 100 }],
  };
});
fs.writeFileSync(path.join(DATOS, 'recetas-calculadas.json'), JSON.stringify(salida, null, 1));
for (const s of salida) console.log(s.id.padEnd(20), s.por_100g.kcal, 'kcal/100 g · porción', s.porciones_es[0].texto, Math.round(s.por_100g.kcal * s.porciones_es[0].gramos / 100), 'kcal');
