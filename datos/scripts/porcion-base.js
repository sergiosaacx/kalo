// Porciones en español y porción por defecto de un alimento. La usan sql-alimentos.js y sql-menus.js,
// así las cantidades de los menús (guardadas en porciones base) siempre cuadran con la base guardada.
const fs = require('fs');
const path = require('path');
const { porcionesEs, porcionBase } = require('./porciones-es');
const ajustes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'porciones-ajustes.json'), 'utf8'));

function porcionesDe(a) {
  const lista = a.porciones_es || porcionesEs(a.porciones);
  const aj = ajustes[a.id];
  return aj ? [aj, ...lista.filter(p => p.texto !== aj.texto)] : lista;
}

function baseDe(a) {
  if (ajustes[a.id]) return ajustes[a.id];
  const porciones = porcionesDe(a);
  // Grasas: la porción casera es la cucharada, nunca la taza
  let base = (a.categoria === 'grasas' && porciones.find(p => /^1 cucharada$/.test(p.texto))) || porcionBase(porciones);
  // Ninguna porción por defecto de más de 400 kcal: se baja a la más grande que no pase, o a 100 g
  const kcalDe = p => (a.por_100g.kcal || 0) * p.gramos / 100;
  if (kcalDe(base) > 400) {
    base = porciones.filter(p => kcalDe(p) <= 400 && p.gramos >= 10).sort((x, y) => y.gramos - x.gramos)[0] || { texto: '100 g', gramos: 100 };
  }
  return base;
}

module.exports = { porcionesDe, baseDe };
