// src/formatsRapides.js — les dates et nombres mis en forme par un formateur gardé rendent EXACTEMENT ce que rend la
// méthode d'origine du moteur, pour toutes les combinaisons d'options que l'app emploie (et les cas qui sortent du
// chemin rapide : date invalide, dateStyle, fuseau inconnu, options étranges). Mutation `--prouve` : sans les options
// complétées (ToDateTimeOptions), le contrôle doit rougir.
//   node scripts/tests/formats-rapides.test.mjs [--prouve]
import { poserFormatsRapides } from '../../src/formatsRapides.js';

const prouve = process.argv.includes('--prouve');
const D = Date.prototype, N = Number.prototype;
const orig = { d: D.toLocaleDateString, t: D.toLocaleTimeString, a: D.toLocaleString, n: N.toLocaleString };
// Un faux « monde » : l'app pose les formats rapides sur globalThis ; ici on garde les originaux pour comparer.
const racine = { Intl, Date: function FauxDate() {}, Number: function FauxNombre() {} };
racine.Date.prototype = Object.create(D); racine.Number.prototype = Object.create(N);
for (const k of ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString', 'getTime']) racine.Date.prototype[k] = D[k];
for (const k of ['toLocaleString', 'valueOf']) racine.Number.prototype[k] = N[k];
// Mutation : le formateur construit SANS compléter les options (ce que ferait un cache naïf).
if (prouve) racine.__vrmFormatsMutation = 'sans-completer';
poserFormatsRapides(racine);
const R = { d: racine.Date.prototype.toLocaleDateString, t: racine.Date.prototype.toLocaleTimeString, a: racine.Date.prototype.toLocaleString, n: racine.Number.prototype.toLocaleString };

const LOCALES = [undefined, 'fr-FR', 'en-GB', 'de-DE', 'es-ES', 'it-IT', 'en-CA', ['fr-FR'], 'fr'];
const OPTIONS = [undefined, {}, { weekday: 'long' }, { month: 'long' }, { day: 'numeric', month: 'short' }, { day: '2-digit', month: '2-digit' },
  { day: 'numeric', month: 'long', year: 'numeric' }, { weekday: 'short', day: 'numeric', month: 'short' }, { hour: '2-digit', minute: '2-digit' },
  { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }, { timeZone: 'Europe/Paris' }, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' },
  { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }, { month: 'long', year: 'numeric' }, { weekday: 'long', hour: 'numeric' },
  { hour: 'numeric' }, { dateStyle: 'medium' }, { timeStyle: 'short' }, { dateStyle: 'short', timeStyle: 'short' }, { month: 'short', day: undefined },
  { hour12: false }, { timeZone: 'America/New_York', hour: '2-digit' }, { era: 'long' }, { timeZoneName: 'short' }, { fractionalSecondDigits: 2, second: 'numeric' }];
const NOPTS = [undefined, {}, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, { style: 'currency', currency: 'EUR' }, { maximumFractionDigits: 0 },
  { style: 'percent' }, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }, { useGrouping: false }, { notation: 'compact' }, { style: 'unit', unit: 'kilogram' }];
const DATES = [new Date(Date.UTC(2026, 10, 20, 9, 5, 7, 123)), new Date(Date.UTC(2026, 0, 1, 0, 0)), new Date(Date.UTC(2025, 2, 30, 1, 30)), new Date('x'), new Date(0)];
const NOMBRES = [0, -0, 1234.5, 1e21, -987654.321, NaN, Infinity, 0.000123, 42];

let ok = 0, ko = 0;
const meme = (nom, f1, f2, ceci, args) => {
  let a, b, ea, eb;
  try { a = f1.apply(ceci, args); } catch (e) { ea = e.constructor.name; }
  try { b = f2.apply(ceci, args); } catch (e) { eb = e.constructor.name; }
  if (a === b && ea === eb) { ok++; return; }
  ko++; if (ko <= 12) console.log(`  ❌ ${nom}(${JSON.stringify(args)}) : « ${a ?? ea} » ≠ « ${b ?? eb} »`);
};
for (let tour = 0; tour < 2; tour++) {   // deux tours : le 2e passe par les formateurs GARDÉS
  for (const d of DATES) for (const l of LOCALES) for (const o of OPTIONS) {
    const args = o === undefined ? (l === undefined ? [] : [l]) : [l, o];
    meme('toLocaleDateString', orig.d, R.d, d, args); meme('toLocaleTimeString', orig.t, R.t, d, args); meme('toLocaleString', orig.a, R.a, d, args);
  }
  for (const x of NOMBRES) for (const l of LOCALES) for (const o of NOPTS) { const args = o === undefined ? (l === undefined ? [] : [l]) : [l, o]; meme('Number#toLocaleString', orig.n, R.n, x, args); }
  // Cas qui sortent du chemin rapide : fuseau inconnu (même erreur), options non simples, `this` qui n'est pas une date.
  meme('toLocaleDateString', orig.d, R.d, DATES[0], ['fr-FR', { timeZone: 'Nulle/Part' }]);
  meme('toLocaleDateString', orig.d, R.d, DATES[0], ['fr-FR', new (class O { constructor() { this.month = 'long'; } })()]);
  meme('toLocaleDateString', orig.d, R.d, {}, ['fr-FR']);
  meme('Number#toLocaleString', orig.n, R.n, Object(12.5), ['fr-FR', { minimumFractionDigits: 2 }]);
}
const g = racine.__vrmFormatsRapides;
console.log(`${ko ? '❌' : '✅'} formats-rapides : ${ok} comparaisons identiques, ${ko} différente(s) ; ${g ? g.cache.size : 0} formateurs gardés`);
if (prouve) { console.log(ko ? '✅ --prouve : la mutation (options non complétées) est vue' : '❌ --prouve : la mutation passe inaperçue'); process.exit(ko ? 0 : 1); }
process.exit(ko ? 1 : 0);
