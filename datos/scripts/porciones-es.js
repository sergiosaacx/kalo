// Traduce las porciones caseras del USDA al español y las limpia.
// Quita medidas en pulgadas, descarta las que no sirven aquí y deja siempre «100 g».
// Se usa desde sql-alimentos.js.

const DESCARTAR = /triscuit|nlea|drink, (small|medium|large|extra)|jigger|quart|pint|liter|lb\b|cubic inch|enchilada|hot dog|foot long|submarine|hoagie|lasagn|farfalle|rotini|penne|shells|elbows|0 (breast|chicken)|yield from 1|yields|edible yield|excluding refuse|with refuse|1 roast|1\.0 can total/i;

// Frases y palabras, de la más larga a la más corta
const FRASES = [
  [/\bfl oz\b/g, 'onzas líquidas'], [/\boz\b/g, 'oz'],
  [/\btablespoons?\b|\btbsp\b/g, 'cucharada'], [/\bteaspoons?\b|\btsp\b/g, 'cucharadita'],
  [/\bcups?\b/g, 'taza'], [/\bslices?\b/g, 'tajada'], [/\bpieces?\b/g, 'trozos'],
  [/\bwedges?\b/g, 'tajada'], [/\bservings?\b/g, 'porción'], [/\bcontainer\b/g, 'envase'],
  [/\bpackage\b/g, 'paquete'], [/\bpacket\b/g, 'sobre'], [/\bbottle\b/g, 'botella'], [/\bcan\b/g, 'lata'],
  [/\bfruit\b/g, 'unidad'], [/\beach\b/g, 'unidad'], [/\bunit\b/g, 'unidad'], [/\bpiece\b/g, 'trozo'],
  [/\bextra large\b/g, 'extra grande'], [/\bextra small\b/g, 'muy pequeño'], [/\bjumbo\b/g, 'extra grande'],
  [/\blarge\b/g, 'grande'], [/\bmedium\b/g, 'mediano'], [/\bsmall\b/g, 'pequeño'], [/\bminiature\b/g, 'mini'],
  [/\bchopped or diced\b|\bchopped or dice\b/g, 'picado'], [/\bchopped\b|\bdiced\b|\bcubed\b|\bcubes\b|\bchunks\b|\bdice\b/g, 'picado'],
  [/\bsliced\b/g, 'en tajadas'], [/\bshredded\b|\bgrated\b/g, 'rallado'], [/\bmashed\b|\bpureed\b/g, 'en puré'],
  [/\bcrumbled\b/g, 'desmenuzado'], [/\bcrushed\b/g, 'triturado'], [/\bground\b/g, 'molido'], [/\bwhipped\b/g, 'batido'],
  [/\bthawed\b|\bunthawed\b/g, 'descongelado'], [/\bdrained solids\b|\bdrained\b/g, 'escurrido'], [/\bcooked\b/g, 'cocido'],
  [/\bhalves\b/g, 'mitades'], [/\bwhole\b/g, 'entero'], [/\bpitted\b|\bwithout pits\b/g, 'sin semilla'],
  [/\bwithout skin and seeds?\b|\bwithout peel\b|\bwithout refuse\b|\bwithout skin\b/g, 'sin cáscara'],
  [/\bwith skin\b/g, 'con piel'], [/\bpacked\b|\bnot packed\b|\bunpacked\b|\bloosely packed\b/g, ''],
  [/\bsections\b/g, 'gajos'], [/\bwith juice\b/g, 'con jugo'], [/\bballs\b/g, 'bolitas'], [/\bpulp\b/g, 'pulpa'],
  [/\bthin\b/g, 'delgada'], [/\bthick\b/g, 'gruesa'], [/\bregular\b/g, 'normal'], [/\bheads?\b/g, 'cabeza'],
  [/\bleaf\b|\bleaves\b/g, 'hoja'], [/\bstalk\b/g, 'tallo'], [/\bspear\b/g, 'tallo'], [/\bsprigs?\b/g, 'ramitas'],
  [/\bbunch\b/g, 'atado'], [/\bclove(s)?\b/g, 'diente$1'], [/\bear\b/g, 'mazorca'], [/\bbaby\b/g, 'baby'],
  [/\bbreast\b/g, 'pechuga'], [/\bthigh\b/g, 'muslo'], [/\bfillet\b/g, 'filete'], [/\bchop\b/g, 'chuleta'],
  [/\bpatty\b/g, 'hamburguesa'], [/\blink\b/g, 'unidad'], [/\bstrips?\b/g, 'tira'], [/\bstick\b/g, 'barra'],
  [/\bpat\b/g, 'cuadrito'], [/\bbar\b/g, 'barra'], [/\bcake(s)?\b/g, 'unidad'], [/\broll\b/g, 'pan'],
  [/\btortilla\b/g, 'tortilla'], [/\bpita\b/g, 'pan árabe'], [/\bcrackers?\b/g, 'galleta'], [/\begg(s)?\b/g, 'huevo'],
  [/\bpotato\b|\bPotato\b/g, 'papa'], [/\bmelon\b/g, 'melón'], [/\bberr(y|ies)\b/g, 'unidad'], [/\bgrapes?\b/g, 'uvas'],
  [/\braisins\b/g, 'uvas pasas'], [/\bnuts\b/g, 'unidades'], [/\bkernels?\b/g, 'granos'], [/\bbeans\b/g, 'vainas'],
  [/\bpods\b/g, 'vainas'], [/\bsprouts?\b/g, 'coles'], [/\brings\b|\bring\b/g, 'aro'], [/\btomato(es)?\b/g, 'tomate'],
  [/\bcherry tomatoes\b/g, 'tomates cherry'], [/\bpepper\b/g, 'pimentón'], [/\bcarrot\b/g, 'zanahoria'],
  [/\bcucumber\b/g, 'pepino'], [/\bbeets?\b/g, 'remolacha'], [/\bleek\b/g, 'puerro'], [/\bplantain\b/g, 'plátano'],
  [/\bartichoke\b/g, 'alcachofa'], [/\beggplant\b/g, 'berenjena'], [/\bchayote\b/g, 'guatila'], [/\bpomegranate\b/g, 'granada'],
  [/\bprune\b/g, 'ciruela'], [/\bdate\b/g, 'dátil'], [/\bcherry\b/g, 'cereza'], [/\balmond\b/g, 'almendra'],
  [/\bpeanut\b/g, 'maní'], [/\bcoconut\b/g, 'coco'], [/\bonion\b|\bOnion\b/g, 'cebolla'], [/\bEdible\b/g, ''],
  [/\bsardines\b/g, 'sardinas'], [/\bscoop\b/g, 'medida'], [/\bliver\b/g, 'hígado'], [/\broot\b/g, 'raíz'],
  [/\bfloweret\b/g, 'arbolito'], [/\bduck\b/g, 'pato'], [/\bblock\b/g, 'bloque'], [/\bbox\b/g, 'cajita'],
  [/\bwith\b/g, 'con'], [/\bwithout\b/g, 'sin'], [/\bor\b/g, 'o'], [/\band\b/g, 'y'], [/\bin shell\b/g, 'con cáscara'],
  [/\bshelled\b/g, 'pelado'], [/\bslivered\b/g, 'fileteado'], [/\bflaked\b/g, 'en hojuelas'], [/\bsolid\b/g, ''],
  [/\bhigh\b/g, ''], [/\bsq\b/g, ''], [/\bdry\b/g, 'seco'], [/\bItalian\b|\bplum\b/g, 'chonto'], [/\bgrams\b/g, 'g'],
];

function traducir(texto) {
  if (DESCARTAR.test(texto)) return null;
  let t = texto
    .replace(/\([^)]*("|dia|long|thick|per |approx|x |high|1\/)[^)]*\)?/gi, '') // medidas en pulgadas
    .replace(/\b\d+(-\d+\/\d+)?"\s*(dia\.?|long|thick)?/gi, '')
    .replace(/\b(1\/\d+) of [^,)]*/gi, '')
    .replace(/\([^)]*\)?/g, '') // cualquier otro paréntesis
    .replace(/crust not eaten/gi, 'sin corteza').replace(/\bvery\b/g, 'muy').replace(/\bcrumbs\b/g, 'migas')
    .replace(/\b(watermelon|cantaloupe|honeydew)\b/g, '');
  for (const [re, es] of FRASES) t = t.replace(re, es);
  t = t.replace(/\b0?\.5\b/g, '½').replace(/\b0?\.25\b/g, '¼').replace(/\b0?\.75\b/g, '¾').replace(/\b0?\.33\b/g, '⅓')
    .replace(/\b(\d+)\.0\b/g, '$1')
    .replace(/[,\s]+$/g, '').replace(/^\s*,/, '').replace(/\s*,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  // 1 trozos → 1 trozo; concordancia con sustantivos femeninos
  t = t.replace(/^1 trozos/, '1 trozo').replace(/^1 onzas líquidas/, '1 onza líquida').replace(/^1 unidades/, '1 unidad');
  if (/\b(taza|tajada|unidad|mazorca|cabeza|hoja|hamburguesa|pechuga|barra|galleta|tortilla|papa|lata|botella|cucharada|cucharadita|chuleta|tira|porción|ciruela|almendra|cereza|granada|zanahoria|remolacha|cebolla|alcachofa|berenjena|guatila)\b/.test(t))
    t = t.replace(/\bpequeño\b/g, 'pequeña').replace(/\bmediano\b/g, 'mediana').replace(/\bentero\b/g, 'entera').replace(/\bpicado\b/g, 'picada').replace(/\brallado\b/g, 'rallada').replace(/\bcocido\b/g, 'cocida').replace(/\bdescongelado\b/g, 'descongelada').replace(/\bmolido\b/g, 'molida');
  t = t.replace(/[,\s]+$/g, '').replace(/\s{2,}/g, ' ').trim();
  if (!/[a-záéíóúñ]/i.test(t)) return null;
  return t;
}

// [{texto, gramos}] USDA → [{texto, gramos}] en español, sin repetidos, más 100 g
function porcionesEs(porciones) {
  const vistos = new Set(), out = [];
  for (const p of porciones) {
    if (!(p.gramos > 0)) continue;
    const texto = traducir(p.texto);
    if (!texto) continue;
    const clave = texto.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ texto, gramos: Math.round(p.gramos * 10) / 10 });
  }
  out.push({ texto: '100 g', gramos: 100 });
  return out;
}

// Porción por defecto: la más casera que haya
const PREFERIDAS = [/^1 mediana?$/, /^1 unidad/, /^1 (tajada|filete|trozo|pechuga|muslo)/, /^1 taza$/, /^1 taza/, /^1 grande/, /^1 cucharada$/, /^3 oz$/];
function porcionBase(lista) {
  for (const re of PREFERIDAS) { const p = lista.find(x => re.test(x.texto)); if (p) return p; }
  return lista[0];
}

module.exports = { porcionesEs, traducir, porcionBase };
