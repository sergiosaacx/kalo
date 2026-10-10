// Busca descripciones del USDA (Foundation + SR Legacy). Uso: node buscar-usda.js <carpeta-usda> "regex" ["regex"...]
const fs = require('fs');
const path = require('path');
const raiz = process.argv[2];
const dirs = fs.readdirSync(raiz).filter(d => !d.endsWith('.zip')).map(d => {
  const dentro = path.join(raiz, d, d);
  return fs.existsSync(dentro) ? dentro : path.join(raiz, d);
});
const filas = [];
for (const dir of dirs) {
  for (const linea of fs.readFileSync(path.join(dir, 'food.csv'), 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^"(\d+)","(foundation_food|sr_legacy_food)","((?:[^"]|"")*)"/);
    if (m) filas.push(`${m[2] === 'foundation_food' ? 'F' : 'S'} ${m[1]} ${m[3].replace(/""/g, '"')}`);
  }
}
for (const q of process.argv.slice(3)) {
  const re = new RegExp(q, 'i');
  console.log('== ' + q);
  filas.filter(f => re.test(f)).slice(0, 6).forEach(f => console.log('  ' + f));
}
