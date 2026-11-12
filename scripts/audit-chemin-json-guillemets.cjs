#!/usr/bin/env node
// Audit (1er nov., X4) : un IDENTIFIANT dans un chemin JSON PostgREST est mis
// ENTRE GUILLEMETS — `data->items->"${id}"`, jamais `data->items->${id}`.
//
// PostgREST lit un segment numérique nu comme un INDEX de tableau : sur un objet
// il rend NULL (« cette annonce n'est pas parmi tes annonces captées »), au-delà
// de 2 147 483 647 il répond 400 (« la base VRM n'a pas répondu »). « Supprimer de
// Leboncoin » et « Mettre en pause » ne partaient donc JAMAIS. Le piège était
// documenté et contourné dans `lireFicheAnnonce` (background.js), pas ailleurs.
//
// 1. Le texte : dans l'app, l'extension et le serveur, tout `->${…}` (ou `->>${…}`)
//    interpolé doit être entre guillemets — sauf les CLÉS FIXES nommées ici
//    (listes de constantes : `${k}:data->${k}`, `meta->>${c}`, un nom de réglage).
// 2. La fausse base des audits (`_chemin-json.cjs`) traite un segment nu comme
//    PostgREST (index ; NULL sur un objet ; 400 au-delà d'un int), sinon aucun
//    audit ne peut voir le défaut (§6.3).
// `--prouve` : retirer les guillemets d'un des deux appels ⇒ rouge.
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const C = require('./_chemin-json.cjs');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const fichiers = [];
const parcourir = (d) => { for (const n of fs.readdirSync(path.join(R, d))) { const p = path.join(d, n); const st = fs.statSync(path.join(R, p)); if (st.isDirectory()) { if (!/node_modules|_lib\/vendor/.test(p)) parcourir(p); } else if (/\.(jsx?|mjs|cjs)$/.test(n)) fichiers.push(p); } };
parcourir('src'); parcourir('api'); parcourir('vinted-sync-extension');

// Clés fixes connues (une constante, jamais un identifiant) : le nom interpolé.
const CLES_FIXES = /^(k|c|cle)$/;
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => {
  let s = fs.readFileSync(path.join(R, f), 'utf8');
  if (PROUVE && f === path.join('vinted-sync-extension', 'background.js')) s = s.replace('select=a:data->items->"${id}"', 'select=a:data->items->${id}');
  return s;
};
// Table de constantes `NOM = { a: 'x', … }` : toutes les valeurs commencent par une lettre.
// Helper `const nom = (id) => 'n' + String(id)` : préfixe d'une lettre (jamais un nombre nu).
function cleNonNumerique(src, expr) {
  let m = /^([A-Z_][A-Z0-9_]*)\[\s*\w+\s*\]$/.exec(expr);
  if (m) {
    const t = new RegExp('(?:export\\s+)?const\\s+' + m[1] + '\\s*=\\s*\\{([^}]*)\\}').exec(src);
    if (!t) return false;
    const vals = [...t[1].matchAll(/:\s*(['"])([^'"]*)\1/g)].map((x) => x[2]);
    const paires = t[1].split(',').map((x) => x.trim()).filter(Boolean).length;
    return vals.length > 0 && vals.length === paires && vals.every((v) => /^[A-Za-z_][\w]*$/.test(v));
  }
  m = /^([a-zA-Z_]\w*)\(\s*\w+\s*\)$/.exec(expr);
  if (m) return new RegExp('const\\s+' + m[1] + "\\s*=\\s*\\(\\s*(\\w+)\\s*\\)\\s*=>\\s*'[A-Za-z_]'\\s*\\+\\s*String\\(\\s*\\1\\s*\\)\\s*;").test(src);
  return false;
}
const fautes = [];
for (const f of fichiers) {
  const s = lire(f);
  const re = /->>?\$\{\s*([^}]+?)\s*\}/g; let m;
  while ((m = re.exec(s))) {
    const expr = m[1];
    if (CLES_FIXES.test(expr)) continue;
    if (/'"'\s*\+/.test(expr)) continue;            // guillemets posés DANS l'expression (`encodeURIComponent('"' + id + '"')`)
    // (8 nov.) Une clé NON NUMÉRIQUE PAR CONSTRUCTION, vérifiée sur sa définition (jamais
    // admise sur son nom seul) : une table de constantes dont chaque valeur commence par
    // une lettre, ou un helper qui préfixe une lettre. Si la définition change (valeur
    // numérique, préfixe retiré), la clé redevient « nue » ⇒ rouge.
    if (cleNonNumerique(s, expr)) continue;
    const ligne = s.slice(0, m.index).split('\n').length;
    fautes.push(`${f}:${ligne} \`${m[0]}\``);
  }
}
dit(fautes.length === 0, 'aucun identifiant interpolé NU dans un chemin JSON (app, extension, serveur)', fautes.join(' · '));
const bg = lire(path.join('vinted-sync-extension', 'background.js'));
const n = (bg.match(/select=a:data->items->"\$\{id\}"/g) || []).length;
dit(n === 3, 'Leboncoin « Supprimer », « Mettre en pause » et « Baisser le prix » (5.363) relisent l\'annonce par sa clé entre guillemets', `${n} appel(s)`);

// 2. La fausse base.
dit(C.appliquerSegment({ 3290: { a: 1 } }, '"3290"') && C.appliquerSegment({ 3290: { a: 1 } }, '"3290"').a === 1, 'fausse base : `->"3290"` est une clé');
dit(C.appliquerSegment({ 3290: { a: 1 } }, '3290') === undefined, 'fausse base : `->3290` nu sur un objet rend NULL (comme PostgREST)');
dit(C.appliquerSegment(['x', 'y'], '1') === 'y', 'fausse base : `->1` sur un tableau est un index');
const e = C.erreurProjection('a:data->items->3290000104');
dit(!!e && e.status === 400, 'fausse base : `->3290000104` nu répond 400 (au-delà d\'un int)', JSON.stringify(e));
dit(C.erreurProjection('a:data->items->"3290000104"') === null, 'fausse base : `->"3290000104"` entre guillemets passe');

console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ un identifiant dans un chemin JSON est toujours une clé');
process.exit(ko ? 1 : 0);
