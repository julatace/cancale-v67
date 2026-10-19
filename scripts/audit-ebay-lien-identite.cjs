// AUDIT — une annonce eBay désigne une paire par IDENTITÉ, jamais par un numéro
// redonné depuis (19 octobre).
//
// Mesuré chez Julien : ses annonces VRM-82, 81, 48 publiées du 15 au 17 octobre,
// pendant la panne de synchro ; la renumérotation du 18 a redonné ces numéros à
// d'AUTRES paires. VRM-82 (une Air Max 1 noire) désignait la Vapor Pro : « en
// vente sur eBay » à tort, la vraie paire « pas en vente », et le retrait
// automatique aurait visé la mauvaise annonce.
//
// Exécute le VRAI `numEbayLu` (et ce dont il dépend) d'App.jsx dans un `vm`, sur
// des fiches inventées à la forme réelle. `--prouve` réaffaiblit la règle (le SKU
// seul, comme avant) : les contrôles doivent repasser au rouge.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
let parser = null;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); } catch (_) {}
const PROUVE = process.argv.includes('--prouve');

function decls(APP, noms) {
  const ast = parser.parse(APP, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const want = new Set(noms), out = [], trouve = new Set();
  for (const n of ast.program.body) {
    let names = [];
    if (n.type === 'FunctionDeclaration' && n.id) names = [n.id.name];
    else if (n.type === 'VariableDeclaration') names = n.declarations.map((d) => d.id && d.id.name).filter(Boolean);
    if (names.some((x) => want.has(x))) { out.push(APP.slice(n.start, n.end)); names.forEach((x) => trouve.add(x)); }
  }
  return { src: out.join('\n'), manquants: noms.filter((x) => !trouve.has(x)) };
}
const NOMS = ['cleNum', 'NUM_OK', 'numDeSkuEbay', 'skuEbayDe', 'traductionAnnonce', 'numeroExterne', 'PANNE_NUMEROS', 'ficheAVerifier', 'normTitle',
  'LIENS_EBAY', '_depuisEbay', '_fichesEbayMemo', 'fichesPourEbay', 'lienEbay', 'noterLienEbay', 'numEbayLu', 'skuEbayDouteux'];

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

function charger(store) {
  let APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  if (PROUVE) APP = APP.replace(/const numEbayLu = \(sku, itemId, dateMs, depuis\) => \{/, "const numEbayLu = (sku, itemId, dateMs, depuis) => { return numeroExterne(numDeSkuEbay(sku), itemId, 'ebayAnnonces', dateMs);");
  const { src, manquants } = decls(APP, NOMS);
  if (manquants.length) dit(false, 'les règles se trouvent dans App.jsx', manquants.join(', '));
  const ctx = { archiveNumeros: () => '', marqueurNumerotation: () => null, coupureNumerotation: () => null,
    load: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), save: (k, v) => { store[k] = v; },
    console, Date, Math, JSON, Map, Set, Object, String, Number };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.F = { numEbayLu, skuEbayDouteux, noterLienEbay, _fichesEbayMemo };', ctx);
  return ctx.F;
}

if (!parser) { dit(false, '@babel/parser est disponible'); process.exit(1); }
const PANNE = '2026-10-18T08:26:45.251Z';
const fiches = {
  // La Vapor Pro : son N°82 lui a été donné le 18, APRÈS la publication de l'annonce VRM-82.
  vapor: { numero: '82', auto: true, numberedAt: PANNE },
  // L'Air Max 1 noire (la vraie paire de l'annonce VRM-82), renumérotée N°81 le 18.
  airmax: { numero: '81', auto: true, numberedAt: PANNE },
  // Deux paires sous le N°59 (14 et 18 octobre).
  sacai: { numero: '59', auto: true, numberedAt: '2026-10-14T15:47:09.775Z' },
  autry: { numero: '59', auto: true, numberedAt: PANNE },
  // Une paire normale, numérotée avant la publication de son annonce.
  normale: { numero: '30', auto: true, numberedAt: '2026-10-01T10:00:00.000Z' },
  // Une paire numérotée pendant la panne, annonce sans date connue.
  panne: { numero: '70', auto: true, numberedAt: '2026-10-15T10:00:00.000Z' },
  ancienne: { numero: '31', auto: true, numberedAt: '2026-10-01T10:00:00.000Z' },
};
const store = { vinted_annonce_numeros: fiches, vrm_ebay_liens: {} };
const F = charger(store);

dit(F.numEbayLu('VRM-82', '128137572355', null, '2026-10-15T21:37:54.000Z') == null,
  'VRM-82 publiée le 15 : le N°82 redonné le 18 (Vapor Pro) ne désigne PAS cette annonce', String(F.numEbayLu('VRM-82', '128137572355', null, '2026-10-15T21:37:54.000Z')));
dit(F.skuEbayDouteux({ sku: 'VRM-82', itemId: '128137572355', depuis: '2026-10-15T21:37:54.000Z' }), '… et la carte la dit « à vérifier »');
dit(F.numEbayLu('VRM-59', '128141087704', null, '2026-10-17T16:18:42.000Z') == null, 'un N° porté par DEUX paires ne désigne personne', String(F.numEbayLu('VRM-59', '128141087704', null, '2026-10-17T16:18:42.000Z')));
dit(F.numEbayLu('VRM-30', '111', null, '2026-10-05T10:00:00.000Z') === '30', 'une paire numérotée AVANT la publication : son SKU la désigne, comme avant');
dit(F.numEbayLu('VRM-70', '222') == null, 'date de publication inconnue + numéro donné pendant la panne : pas su');
dit(F.numEbayLu('VRM-31', '333') === '31', 'date inconnue + numéro d\'avant la panne : le SKU fait foi');
// Le lien par identité gagne, et suit la paire si son numéro change.
F.noterLienEbay('128137572355', 'airmax', '81', 'main'); F._fichesEbayMemo.at = 0;
dit(F.numEbayLu('VRM-82', '128137572355', null, '2026-10-15T21:37:54.000Z') === '81', 'reliée à la main : l\'annonce désigne sa VRAIE paire (N°81), quel que soit son SKU');
dit(!F.skuEbayDouteux({ sku: 'VRM-82', itemId: '128137572355', depuis: '2026-10-15T21:37:54.000Z' }), '… et n\'est plus « à vérifier »');
fiches.airmax.numero = '90'; F._fichesEbayMemo.at = 0;
dit(F.numEbayLu('VRM-82', '128137572355') === '90', 'si la paire change de numéro, l\'annonce la suit (identité, pas numéro)');
// Un lien venu d'un brouillon ne remplace pas un lien posé à la main.
F.noterLienEbay('128137572355', 'vapor', '82', 'brouillon'); F._fichesEbayMemo.at = 0;
dit(F.numEbayLu('VRM-82', '128137572355') === '90', 'un brouillon ne remplace pas un lien posé à la main');

console.log(ko ? `\n❌ audit-ebay-lien-identite : ${ko} rouge(s)` : '\n✅ audit-ebay-lien-identite : tout est vert.');
process.exit(ko ? 1 : 0);
