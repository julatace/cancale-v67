// ════════════════════════════════════════════════════════════════════════════
//  LES SÉLECTEURS « RANGÉS » (20 nov., chantier iphone-rapide — docs/passation/2026-11-20-iphone-rapide.md).
//
//  Mesuré (banc iphone-rapide, SELECTEURS=…) : chaque élément de l'app coûtait ~25 µs de recalcul de style (×1), parce
//  que des milliers de règles finissent par `:is(.a, .b, …)` (`:root:root body .vrm-main :is(.vrm-x, .vrm-y)`). Le moteur
//  de style range une règle par la DERNIÈRE partie de son sélecteur (sa classe, son id, sa balise) et ne l'essaie que sur
//  les éléments qui la portent ; une dernière partie `:is(…)` ne se range nulle part : la règle est essayée sur TOUS les
//  éléments, à chaque recalcul (mesuré, Chromium : une liste `:is`/`:where` à UN argument se range, une liste à plusieurs
//  jamais). Ici, au build, `X :is(.a, .b)` devient `X .a, X .b` — la MÊME règle, rangée par classe ; et quand ce n'est pas
//  possible tel quel (arguments complexes, spécificités mêlées : `X :is(button, [role=tab])`), chaque argument passe dans
//  SA liste à un argument : `X :where(button):not(.vz_), X :where([role=tab]):not(.vz_)` (même sélection, `:where` est
//  indulgent comme `:is`, le complément rend la spécificité exacte de la liste d'origine).
//
//  Ce qui ne change pas (et pourquoi) :
//   · ce qui est sélectionné : `X :is(a, b)` ≡ `X :is(a), X :is(b)` ≡ `X :where(a)…, X :where(b)…` ; la forme courte
//     (`X .a`) seulement quand chaque argument est une partie SIMPLE ; aucun argument avec un pseudo-élément ou une
//     pseudo-classe hors de la liste fermée (connue de tous les navigateurs) — sinon la règle reste telle quelle ;
//   · la SPÉCIFICITÉ : `:is()` prend celle de son argument le plus spécifique ; chaque argument moins spécifique reçoit
//     le complément sous une forme qui ne sélectionne rien de plus (`:not(.vz_)`, `:not(#vz_)`, `:not(vz_)` :
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
// Le complément de spécificité : des noms qu'aucun élément ne porte (courts : ils se répètent dans la feuille livrée).
const ZZ = { a: ':not(#vz_)', b: ':not(.vz_)', c: ':not(vz_)' };

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
      if (nom === 'not' || nom === 'is' || nom === 'matches' || nom === 'has') {
        // :not / :is / :has (liste) : la spécificité de son argument le plus fort (chaque argument peut être complexe)
        let mx = null; for (const x of liste(m[3])) { const t = specificiteComplexe(nom === 'has' ? x.replace(/^\s*[>+~]\s*/, '') : x); if (!t) return null; if (!mx || cmp(t, mx) > 0) mx = t; }
        a += mx[0]; b += mx[1]; c += mx[2];
      } else if (nom === 'where') { /* 0 */ }
      else if (/^nth-/.test(nom) && /\sof\s/i.test(m[3] || '')) return null;   // :nth-child(An+B of S) : pas calculé ici
      else if (/^-webkit-|^-moz-/.test(nom)) return null;
      else b++;
    } else if (s !== '*') c++;
  }
  return [a, b, c];
}
const cmp = (x, y) => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);
// La spécificité d'un sélecteur COMPLEXE (`.a > .b c`) : la somme de ses parties composées.
function specificiteComplexe(sel) {
  const parts = decouper(String(sel || '').trim(), (ch) => /[\s>+~]/.test(ch)).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  let a = 0, b = 0, c = 0;
  for (const p of parts) { const t = specificite(p); if (!t) return null; a += t[0]; b += t[1]; c += t[2]; }
  return [a, b, c];
}

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

// Toutes les pseudo-classes d'un argument (imbriquées comprises) sont dans la liste fermée ; aucun pseudo-élément.
const PSEUDOS_LISTES = new Set(['is', 'where', 'not', 'has', 'matches']);
function argConnu(arg) {
  if (/::/.test(arg) || /\|/.test(arg.replace(/\[[^\]]*\]/g, ''))) return false;
  for (const m of arg.replace(/\[[^\]]*\]/g, '[]').matchAll(/:([A-Za-z-]+)/g)) {
    const n = m[1].toLowerCase();
    if (!PSEUDOS_SURES.has(n) && !PSEUDOS_FONCTION_SURES.has(n) && !PSEUDOS_LISTES.has(n)) return false;
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
  // La première liste `:is(…)` / `:where(…)` à plusieurs arguments de la dernière partie : c'est elle qui empêche le rangement
  // (le moteur range une liste à UN argument, jamais une liste à plusieurs — mesuré, Chromium).
  const iIs = l.findIndex((x) => /^:(is|where|matches)\(/i.test(x) && liste(x.slice(x.indexOf('(') + 1, -1)).length >= 2);
  if (iIs < 0) return [s];
  const nom = /^:where\(/i.test(l[iIs]) ? 'where' : 'is';
  const args = liste(l[iIs].slice(l[iIs].indexOf('(') + 1, -1));
  // Chaque argument n'emploie que des pseudo-classes connues de TOUS les navigateurs : un argument inconnu d'un navigateur
  // est ignoré par la liste indulgente, et la spécificité de la liste changerait avec lui — dans ce cas, rien n'est touché.
  if (args.some((x) => !x || !argConnu(x))) return [s];
  const reste = l.filter((_, i) => i !== iIs);
  // La spécificité que portait la liste : celle de son argument le plus fort (`:is`), rien (`:where`).
  let mx = [0, 0, 0], specs = null;
  if (nom === 'is') {
    specs = args.map(specificiteComplexe);
    if (specs.some((x) => !x)) return [s];
    mx = specs.reduce((m, x) => (cmp(x, m) > 0 ? x : m));
  }
  const mut = process.env.VRM_RANGER_MUTATION === 'specificite';
  const padDe = (da, db, dc) => (mut ? '' : ZZ.a.repeat(da) + ZZ.b.repeat(db) + ZZ.c.repeat(dc));
  // 1) Le cas simple (`:is` dont chaque argument est une partie simple, aucun complément négatif) : `X .a, X .b` — la forme
  //    la plus courte, rangée par la classe même.
  const simplesSurs = nom === 'is' && args.every(argSur) && !reste.some((x) => /^:(where|has|is|matches)\(/i.test(x))
    && specs.every((t) => t[0] <= mx[0] && t[1] <= mx[1] && t[2] <= mx[2]);
  if (simplesSurs) {
    const typeReste = reste.find(estType);
    const out = [];
    for (let k = 0; k < args.length; k++) {
      const t = specs[k];
      const la = simples(args[k]);
      const typeArg = la.find(estType);
      if (typeArg && typeReste) { if (typeArg.toLowerCase() !== typeReste.toLowerCase()) continue; }   // ne sélectionne rien
      const type = typeArg || typeReste || '';
      const autres = [...reste.filter((x) => !estType(x)), ...la.filter((x) => !estType(x))];
      // ⚠️ Deux fois la même balise (dans le reste ET dans l'argument) : une seule ; sa spécificité (0,0,1) est rendue.
      let pad = padDe(mx[0] - t[0], mx[1] - t[1], mx[2] - t[2]);
      if (typeArg && typeReste && !mut) pad += ZZ.c;
      out.push(tete + type + autres.join('') + pad + fin);
    }
    return out.length ? out : [s];
  }
  // 2) Le cas général : chaque argument dans SA liste à un argument, `:where(arg)` (spécificité nulle) + le complément qui
  //    rend EXACTEMENT celle de la liste d'origine. Même sélection (`X :is(a, b)` ≡ `X :is(a), X :is(b)`), même validité
  //    (`:where` est indulgent comme `:is`), même spécificité ; la règle se range par la meilleure partie de l'argument.
  const avant = l.slice(0, iIs).join(''), apres = l.slice(iIs + 1).join('');
  const pad = padDe(mx[0], mx[1], mx[2]);
  return args.map((x) => tete + avant + ':where(' + x + ')' + apres + pad + fin);
}

// Une règle : ses sélecteurs dépliés quand c'est sûr ; rend vrai si elle a changé.
function rangerRegle(r, stats) {
  if (r.parent && r.parent.type === 'atrule' && /keyframes/i.test(r.parent.name)) return false;
  const sels = liste(r.selector);
  let change = false;
  const neufs = [];
  for (const x of sels) { const d = deplier(x); if (d.length !== 1 || d[0] !== x.trim()) change = true; neufs.push(...d); }
  if (stats) { stats.regles++; stats.selecteursAvant += sels.length; stats.selecteursApres += neufs.length; if (change) stats.depliees++; }
  if (change) r.selector = neufs.join(',');
  return change;
}
// Le greffon PostCSS (vite.config.js, `css.postcss`) : chaque feuille AVANT le paquet, donc l'empreinte du nom de
// fichier livré suit le contenu réécrit (un contenu, un nom).
const greffonPostcss = () => ({ postcssPlugin: 'vrm-selecteurs-ranges', Rule(r) { rangerRegle(r); } });
greffonPostcss.postcss = true;

// Le CSS entier : chaque règle dont un sélecteur se déplie ; rend { css, stats }.
function rangerSelecteurs(css) {
  const postcss = require('postcss');
  const racine = postcss.parse(css);
  const stats = { regles: 0, depliees: 0, selecteursAvant: 0, selecteursApres: 0 };
  racine.walkRules((r) => { rangerRegle(r, stats); });
  return { css: racine.toResult().css, stats };
}

module.exports = { rangerSelecteurs, rangerRegle, greffonPostcss, deplier, specificite, argSur, liste };

if (require.main === module) {
  const fs = require('fs');
  const [entree, sortie] = process.argv.slice(2);
  const r = rangerSelecteurs(fs.readFileSync(entree, 'utf8'));
  if (sortie) fs.writeFileSync(sortie, r.css);
  console.log(JSON.stringify(r.stats));
}
