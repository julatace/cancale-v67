// ════════════════════════════════════════════════════════════════════════════
//  LES SÉLECTEURS « RANGÉS » (20 nov., chantier iphone-rapide — docs/passation/2026-11-20-iphone-rapide.md).
//
//  Mesuré (banc iphone-rapide, SELECTEURS=…) : chaque élément de l'app coûtait ~25 µs de recalcul de style (×1), parce
//  que des milliers de règles finissent par `:is(.a, .b, …)` (`:root:root body .vrm-main :is(.vrm-x, .vrm-y)`). Le moteur
//  de style range une règle par la DERNIÈRE partie de son sélecteur (sa classe, son id, sa balise) et ne l'essaie que sur
//  les éléments qui la portent ; une dernière partie `:is(…)` ne se range nulle part : la règle est essayée sur TOUS les
//  éléments, à chaque recalcul. Ici, au build, `X :is(.a, .b)` devient `X .a, X .b` — la MÊME règle, rangée par classe.
//
//  Ce qui ne change pas (et pourquoi) :
//   · ce qui est sélectionné : seulement quand chaque argument est une partie SIMPLE (aucun combinateur, aucun
//     pseudo-élément, aucun `:is`/`:where`/`:has` imbriqué, seulement des pseudo-classes connues de tous les navigateurs)
//     — sinon la règle reste telle quelle ;
//   · la SPÉCIFICITÉ : `:is()` prend celle de son argument le plus spécifique ; chaque argument moins spécifique reçoit
//     le complément sous une forme qui ne sélectionne rien de plus (`:not(.vrm-zz)`, `:not(#vrm-zz)`, `:not(vrm-zz)` :
//     aucun élément ne porte ces noms) ; si le complément serait négatif (un argument a plus de balises et moins de
//     classes que le plus fort), la règle reste telle quelle ;
//   · la VALIDITÉ : `:is()` est « indulgent » (un argument inconnu est ignoré), une liste ne l'est pas (un sélecteur
//     inconnu fait tomber la règle entière) — d'où la liste fermée des pseudo-classes acceptées ;
//   · l'ordre des règles et leurs déclarations : rien ne bouge, seul le texte du sélecteur change.
//  Preuve : scripts/bancs/styles-identiques.cjs (les styles CALCULÉS de chaque élément, avant/après, sur chaque écran).
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const PSEUDOS_SURES = new Set(['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled', 'enabled', 'checked', 'first-child', 'last-child',
  'only-child', 'first-of-type', 'last-of-type', 'only-of-type', 'empty', 'placeholder-shown', 'required', 'invalid', 'valid', 'visited', 'link', 'target',
  'root', 'read-only', 'read-write', 'default', 'indeterminate', 'optional', 'any-link']);
const PSEUDOS_FONCTION_SURES = new Set(['nth-child', 'nth-last-child', 'nth-of-type', 'nth-last-of-type', 'not']);
const ZZ = { a: ':not(#vrm-zz)', b: ':not(.vrm-zz)', c: ':not(vrm-zz)' };

// Découpe `s` au niveau 0 (hors parenthèses, crochets, chaînes) avec `estSep(car, i)`.
function decouper(s, estSep) {
  const out = []; let prof = 0, crochet = 0, q = null, deb = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') prof++; else if (c === ')') prof--; else if (c === '[') crochet++; else if (c === ']') crochet--;
    else if (!prof && !crochet && estSep(c, i)) { out.push(s.slice(deb, i)); deb = i + 1; }
  }
  out.push(s.slice(deb));
  return out;
}
const liste = (s) => decouper(s, (c) => c === ',').map((x) => x.trim());

// Les simples d'une partie composée : `button.a[x]:hover` → ['button', '.a', '[x]', ':hover'] (null si illisible).
function simples(comp) {
  const out = []; let i = 0;
  const lireNom = () => { const m = /^(?:\\.|[A-Za-z0-9_\- -￿])+/.exec(comp.slice(i)); if (!m) return null; i += m[0].length; return m[0]; };
  while (i < comp.length) {
    const c = comp[i], d = i;
    if (c === '.' || c === '#') { i++; if (!lireNom()) return null; out.push(comp.slice(d, i)); }
    else if (c === '[') { let prof = 0, q = null; for (; i < comp.length; i++) { const x = comp[i]; if (q) { if (x === '\\') { i++; continue; } if (x === q) q = null; continue; } if (x === '"' || x === "'") q = x; else if (x === '[') prof++; else if (x === ']') { prof--; if (!prof) { i++; break; } } } out.push(comp.slice(d, i)); }
    else if (c === ':') {
      i++; if (comp[i] === ':') return null;   // pseudo-élément
      const nom = lireNom(); if (!nom) return null;
      if (comp[i] === '(') { let prof = 0, q = null; for (; i < comp.length; i++) { const x = comp[i]; if (q) { if (x === '\\') { i++; continue; } if (x === q) q = null; continue; } if (x === '"' || x === "'") q = x; else if (x === '(') prof++; else if (x === ')') { prof--; if (!prof) { i++; break; } } } }
      out.push(comp.slice(d, i));
    } else if (c === '*') { i++; out.push('*'); }
    else { if (!lireNom()) return null; out.push(comp.slice(d, i)); }
  }
  return out;
}
const estType = (s) => s === '*' || /^[A-Za-z]/.test(s);

// Spécificité d'une partie composée SIMPLE (arguments déjà vérifiés : :not(simple) seulement).
function specificite(comp) {
  const l = simples(comp); if (!l) return null;
  let a = 0, b = 0, c = 0;
  for (const s of l) {
    if (s[0] === '#') a++;
    else if (s[0] === '.' || s[0] === '[') b++;
    else if (s[0] === ':') {
      const m = /^:([A-Za-z-]+)(\((.*)\))?$/.exec(s); if (!m) return null;
      const nom = m[1].toLowerCase();
      if (nom === 'not') {
        // :not(liste) : la spécificité de son argument le plus fort
        let mx = null; for (const x of liste(m[3])) { const t = specificite(x); if (!t) return null; if (!mx || cmp(t, mx) > 0) mx = t; }
        a += mx[0]; b += mx[1]; c += mx[2];
      } else b++;
    } else if (s !== '*') c++;
  }
  return [a, b, c];
}
const cmp = (x, y) => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);

// Un argument de :is() qu'on sait déplier sans rien changer.
function argSur(arg) {
  if (!arg || /\s|>|\+|~|\|/.test(arg.replace(/\[[^\]]*\]/g, '[]').replace(/\([^)]*\)/g, '()'))) return false;   // combinateur
  const l = simples(arg); if (!l || !l.length) return false;
  for (const s of l) {
    if (s === '*') return false;
    if (s[0] !== ':') continue;
    const m = /^:([A-Za-z-]+)(\((.*)\))?$/.exec(s); if (!m) return false;
    const nom = m[1].toLowerCase();
    if (!m[2]) { if (!PSEUDOS_SURES.has(nom)) return false; continue; }
    if (!PSEUDOS_FONCTION_SURES.has(nom)) return false;
    if (nom === 'not') { for (const x of liste(m[3])) if (!argSur(x)) return false; }
  }
  return true;
}

// Un sélecteur complexe : sa DERNIÈRE partie (après le dernier combinateur de niveau 0).
function derniere(sel) {
  let prof = 0, crochet = 0, q = null, cut = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') prof++; else if (c === ')') prof--; else if (c === '[') crochet++; else if (c === ']') crochet--;
    else if (!prof && !crochet && (c === ' ' || c === '>' || c === '+' || c === '~')) cut = i + 1;
  }
  return cut;
}

// Déplie UN sélecteur complexe ; rend la liste (inchangée si on ne sait pas faire sans risque).
function deplier(sel) {
  const s = sel.trim();
  const cut = derniere(s);
  const tete = s.slice(0, cut), comp = s.slice(cut);
  // Le pseudo-élément final (`::before`) reste à la fin.
  const pe = /::?(?:before|after|placeholder|selection|marker|backdrop|first-line|first-letter|-webkit-[a-z-]+)$/i.exec(comp);
  const corps = pe && pe[0].startsWith('::') ? comp.slice(0, pe.index) : comp;
  const fin = pe && pe[0].startsWith('::') ? pe[0] : '';
  const l = simples(corps);
  if (!l) return [s];
  const iIs = l.findIndex((x) => /^:is\(/i.test(x));
  if (iIs < 0 || l.filter((x) => /^:(is|where|has|matches|-webkit-any)\(/i.test(x)).length !== 1) return [s];
  const args = liste(l[iIs].slice(4, -1));
  if (args.length < 1 || !args.every(argSur)) return [s];
  const reste = l.filter((_, i) => i !== iIs);
  if (reste.some((x) => /^:(where|has)\(/i.test(x))) return [s];
  const typeReste = reste.find(estType);
  const specs = args.map(specificite); if (specs.some((x) => !x)) return [s];
  const mx = specs.reduce((m, x) => (cmp(x, m) > 0 ? x : m));
  const out = [];
  for (let k = 0; k < args.length; k++) {
    const t = specs[k], da = mx[0] - t[0], db = mx[1] - t[1], dc = mx[2] - t[2];
    if (da < 0 || db < 0 || dc < 0) return [s];
    const la = simples(args[k]);
    const typeArg = la.find(estType);
    if (typeArg && typeReste) { if (typeArg.toLowerCase() !== typeReste.toLowerCase()) continue; }   // ne sélectionne rien
    const type = typeArg || typeReste || '';
    const autres = [...reste.filter((x) => !estType(x)), ...la.filter((x) => !estType(x))];
    // ⚠️ Deux fois la même balise (`button` dans le reste ET dans l'argument) : une seule ; sa spécificité compte une fois
    // dans le composé d'origine (la partie hors :is) et une fois dans :is — la retirer coûterait (0,0,1) : on la rend.
    let pad = ZZ.a.repeat(da) + ZZ.b.repeat(db) + ZZ.c.repeat(dc);
    if (typeArg && typeReste) pad += ZZ.c;
    if (process.env.VRM_RANGER_MUTATION === 'specificite') pad = '';   // mutation du banc styles-identiques : ROUGE attendu
    out.push(tete + type + autres.join('') + pad + fin);
  }
  return out.length ? out : [s];
}

// Le CSS entier : chaque règle dont un sélecteur se déplie ; rend { css, stats }.
function rangerSelecteurs(css) {
  const postcss = require('postcss');
  const racine = postcss.parse(css);
  const stats = { regles: 0, depliees: 0, selecteursAvant: 0, selecteursApres: 0 };
  racine.walkRules((r) => {
    if (r.parent && r.parent.type === 'atrule' && /keyframes/i.test(r.parent.name)) return;
    stats.regles++;
    const sels = liste(r.selector);
    stats.selecteursAvant += sels.length;
    let change = false;
    const neufs = [];
    for (const x of sels) { const d = deplier(x); if (d.length !== 1 || d[0] !== x.trim()) change = true; neufs.push(...d); }
    stats.selecteursApres += neufs.length;
    if (change) { stats.depliees++; r.selector = neufs.join(','); }
  });
  return { css: racine.toResult().css, stats };
}

module.exports = { rangerSelecteurs, deplier, specificite, argSur, liste };

if (require.main === module) {
  const fs = require('fs');
  const [entree, sortie] = process.argv.slice(2);
  const r = rangerSelecteurs(fs.readFileSync(entree, 'utf8'));
  if (sortie) fs.writeFileSync(sortie, r.css);
  console.log(JSON.stringify(r.stats));
}
