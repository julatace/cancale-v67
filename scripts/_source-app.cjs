// ════════════════════════════════════════════════════════════════════════════
//  LE TEXTE DE L'APP POUR LES AUDITS (8 nov., démarrage léger)
//  App.jsx a été découpé : les écrans qui ne servent pas au premier écran vivent
//  dans `src/ecrans/*.jsx`, chargés à la demande (React.lazy). Leur code n'a pas
//  changé, il a seulement DÉMÉNAGÉ. Un audit qui lit « le code de l'app » comme
//  texte (regex, extraction de fonction, vm) lit donc App.jsx avec chaque morceau
//  RECOLLÉ À SA PLACE D'ORIGINE : là où une suite d'instructions est partie, App.jsx
//  garde la balise `// ⟦→ ecrans/X.jsx #k⟧`, et l'écran commence ce morceau par
//  `// ⟦← App.jsx #k⟧`. Le texte rendu est donc celui d'avant le découpage (mêmes
//  voisins, même ordre : une tranche « de la fonction A à la fonction B » reste la
//  même). Les imports d'un écran ne sont pas recollés (App.jsx les porte, sauf ceux
//  partis avec l'écran, recollés à leur place eux aussi).
//  ⚠️ Ne pas effacer ces balises : sans elles, le morceau est recollé à la fin.
//
//    const { sourceApp } = require('./_source-app.cjs');
//    const app = sourceApp();              // racine du dépôt déduite de __dirname
//    const app = sourceApp(autreRacine);   // un arbre extrait (git archive)
//
//  ⚠️ Un audit qui MUTE le code (remplace un morceau puis rebâtit) doit écrire le
//  fichier qui PORTE ce morceau : `fichierQuiPorte(texte)` le dit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
// La lecture d'origine (avant `brancher`) : jamais de boucle.
const lireOrig = fs.readFileSync;

function fichiersApp(racine) {
  const R = racine || RACINE;
  const liste = [path.join(R, 'src', 'App.jsx')];
  const dossier = path.join(R, 'src', 'ecrans');
  let noms = [];
  try { noms = fs.readdirSync(dossier).filter((f) => /\.jsx?$/.test(f)).sort(); } catch (_) {}
  for (const f of noms) liste.push(path.join(dossier, f));
  return liste;
}

// Les imports d'un écran découpé, recollés comme s'il était resté dans App.jsx : l'import
// d'App.jsx lui-même disparaît (ses noms sont déclarés plus haut), un nom déjà importé
// n'est pas importé deux fois, et le chemin redevient celui vu de src/ (`../x` → `./x`).
// Le texte entier se lit donc toujours comme UN module (Babel, regex d'import).
function recoller(texte, dejaImportes) {
  return texte.replace(/^import ([^;'"]*?) from (["'])([^"'\n]+)\2;/gm, (ligne, specs, q, chemin) => {
    if (/(^|\/)App\.jsx$/.test(chemin)) return '';
    // (11 nov.) L'import d'un AUTRE écran (`./MessagesLeboncoin.jsx` vu de src/ecrans/) : cet
    // écran est recollé lui aussi, ses noms sont déjà déclarés dans le texte.
    if (/^\.\/[^/]+\.jsx?$/.test(chemin)) return '';
    const vu = (n) => dejaImportes.has(n);
    const garde = [];
    let reste = specs.trim();
    const acc = reste.match(/\{([^}]*)\}/);
    const nommes = acc ? acc[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    reste = reste.replace(/\{[^}]*\}/, '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const r of reste) { const loc = r.replace(/^\*\s+as\s+/, ''); if (!vu(loc)) { garde.push(r); dejaImportes.add(loc); } }
    const n2 = [];
    for (const n of nommes) { const loc = n.split(/\s+as\s+/).pop(); if (!vu(loc)) { n2.push(n); dejaImportes.add(loc); } }
    if (n2.length) garde.push(`{ ${n2.join(', ')} }`);
    if (!garde.length) return '';
    const vers = chemin.startsWith('../') ? './' + chemin.slice(3) : chemin;
    // rien de retiré : le texte d'origine, seul le chemin change
    if (n2.length === nommes.length && garde.length - (n2.length ? 1 : 0) === reste.length) return ligne.replace(q + chemin + q, q + vers + q);
    return `import ${garde.join(', ')} from ${q}${vers}${q};`;
  });
}
function importesDe(texte) {
  const s = new Set();
  for (const m of texte.matchAll(/^import\s+([^'";]*?)\s+from\s+['"][^'"]+['"]/gm)) {
    const specs = m[1];
    const acc = specs.match(/\{([^}]*)\}/);
    if (acc) for (const n of acc[1].split(',')) { const loc = n.trim().split(/\s+as\s+/).pop(); if (loc) s.add(loc); }
    for (const r of specs.replace(/\{[^}]*\}/, '').split(',')) { const loc = r.trim().replace(/^\*\s+as\s+/, ''); if (loc) s.add(loc); }
  }
  return s;
}

// Un chemin relatif vu d'un écran (src/ecrans/) redevient celui vu de src/ : `../x` → `./x`, `../../x` → `../x`.
const cheminVuDeSrc = (p) => (p.startsWith('../../') ? p.slice(3) : p.startsWith('../') ? './' + p.slice(3) : p);
const cheminsVusDeSrc = (t) => t.replace(/(\bfrom\s+|\bimport\(\s*|^import\s+|new URL\(\s*)(['"])(\.\.\/[^'"\n]*)\2/gm, (m, a, q, p) => a + q + cheminVuDeSrc(p) + q);


// ════════════════════════════════════════════════════════════════════════════
// (11 nov., traduction, lot 2) LE TEXTE FRANÇAIS RECOLLÉ À SA PLACE. Les écrans migrés
// vers tr() (src/i18n/langues/fr*.js et fr/<écran>.js) ne portent plus leur phrase dans le code : `>{tr('journee.faire')}<`. Un audit qui juge
// une phrase À SA PLACE (« ce bouton dit "Modifier ma journée" ») lit donc le texte de l'app
// avec chaque appel remplacé par le FRANÇAIS du dictionnaire — ce que l'écran affiche en
// français, à la même place : `>{tr('k')}<` ⇒ `>texte<`, `title={tr('k')}` ⇒ `title="texte"`,
// `tr('k')` ⇒ `'texte'`, `tr('k', { x: String(e) })` ⇒ `` `… ${e} …` ``. Un pluriel ({ one, other })
// reste un appel (aucune forme d'avant à rendre). Rien n'est affaibli : la clé doit exister,
// et sa phrase française doit être celle que l'audit attend, là où il l'attend.
// `VRM_SOURCE_BRUTE=1` rend le code tel quel.
function dicoFrEcrans(racine) {
  const d = {};
  const lang = path.join(racine || RACINE, 'src', 'i18n', 'langues');
  const fichiers = ['fr-accueil.js', 'fr.js'].map((n) => path.join(lang, n));
  try { for (const n of fs.readdirSync(path.join(lang, 'fr'))) if (n.endsWith('.js')) fichiers.push(path.join(lang, 'fr', n)); } catch (_) {}
  for (const f of fichiers) {
    let t = ''; try { t = lireOrig.call(fs, f, 'utf8'); } catch (_) { continue; }
    for (const m of t.matchAll(/^\s*"([^"]+)": ("(?:[^"\\]|\\.)*"),\s*$/gm)) { try { d[m[1]] = JSON.parse(m[2]); } catch (_) {} }
  }
  return d;
}
// L'objet `{ a: String(x), b: y }` d'un appel : ses entrées, coupées aux virgules du premier niveau.
function entreesVars(corps) {
  const out = {}; let prof = 0, debut = 0; const parts = [];
  let q = null;
  for (let i = 0; i < corps.length; i++) {
    const c = corps[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if ('([{'.includes(c)) prof++; else if (')]}'.includes(c)) prof--;
    else if (c === ',' && prof === 0) { parts.push(corps.slice(debut, i)); debut = i + 1; }
  }
  parts.push(corps.slice(debut));
  for (const p of parts) { const m = p.match(/^\s*(\w+)\s*:\s*([\s\S]*?)\s*$/); if (!m) return null; const e = m[2].match(/^String\(([\s\S]*)\)$/); out[m[1]] = e ? e[1] : m[2]; }
  return out;
}
function enFrancais(texte, racine) {
  if (process.env.VRM_SOURCE_BRUTE === '1') return texte;
  const D = dicoFrEcrans(racine);
  if (!Object.keys(D).length) return texte;
  const sq = (v) => "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  const jsxSur = (v) => !/[{}<>]/.test(v);
  let out = '';
  let i = 0;
  const re = /\btr\('([\w.-]+)'/g;
  let m;
  while ((m = re.exec(texte))) {
    const k = m[1]; if (!(k in D)) continue;
    const debut = m.index; let j = re.lastIndex;
    let fin, vars = null;
    if (texte[j] === ')') fin = j + 1;
    else {
      const a = texte.slice(j).match(/^,\s*\{/); if (!a) continue;
      // l'objet jusqu'à sa fermeture, puis `)`
      let prof = 0, q = null, x = j + a[0].length - 1;
      for (; x < texte.length; x++) { const c = texte[x]; if (q) { if (c === '\\') { x++; continue; } if (c === q) q = null; continue; } if (c === "'" || c === '"' || c === '`') { q = c; continue; } if (c === '{' || c === '(' || c === '[') prof++; else if (c === '}' || c === ')' || c === ']') { prof--; if (prof === 0) break; } }
      const apres = texte.slice(x + 1).match(/^\s*\)/); if (!apres) continue;
      vars = entreesVars(texte.slice(j + a[0].length, x)); if (!vars) continue;
      fin = x + 1 + apres[0].length;
    }
    const v = D[k];
    let rempl, a0 = debut, a1 = fin;
    if (vars) rempl = '`' + v.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\{(\w+)\}/g, (mm, n) => (n in vars ? '${' + vars[n] + '}' : mm)) + '`';
    else {
      const av = texte.slice(Math.max(0, debut - 40), debut), ap = texte.slice(fin, fin + 1);
      const attr = av.match(/([\w-]+)=\{$/);
      if (attr && ap === '}' && !v.includes('"')) { a0 = debut - 1; a1 = fin + 1; rempl = '"' + v + '"'; }
      else if (av.endsWith('{') && ap === '}' && jsxSur(v) && !/[\w-]=\{$/.test(av)) { a0 = debut - 1; a1 = fin + 1; rempl = v; }
      else rempl = sq(v);
    }
    out += texte.slice(i, a0) + rempl; i = a1; re.lastIndex = fin;
  }
  return out + texte.slice(i);
}

function sourceApp(racine) { return enFrancais(sourceAppCode(racine), racine); }
function sourceAppCode(racine) {
  const fichiers = fichiersApp(racine);
  const app = lireOrig.call(fs, fichiers[0], 'utf8');
  if (fichiers.length === 1) return app;
  // Les morceaux de chaque écran, par numéro de suite (`// ⟦← App.jsx #k⟧`).
  const morceaux = {};
  const sansBalises = [];
  for (const f of fichiers.slice(1)) {
    const t = lireOrig.call(fs, f, 'utf8');
    const rel = 'ecrans/' + path.basename(f);
    const parts = t.split(/\n\/\/ ⟦← App\.jsx #(\d+)⟧/);
    if (parts.length < 3) { sansBalises.push(t); continue; }
    const m = (morceaux[rel] = {});
    for (let i = 1; i < parts.length; i += 2) m[parts[i]] = parts[i + 1];
    const der = parts[parts.length - 2];
    m[der] = m[der].replace(/\nexport \{[^}]*\};\n*$/, '');
  }
  // Les racines paresseuses (`const Garage = aLaDemande(() => import('./ecrans/…'))`) : leur vraie
  // déclaration (la fonction) est recollée à sa place — la ligne paresseuse est retirée du texte.
  let out = app.replace(/^const \w+ = aLaDemande\(\(\) => import\('\.\/ecrans\/[^\n]*\n/gm, '');
  // Chaque balise `// ⟦→ ecrans/X.jsx #k⟧` reprend le morceau qui était là.
  // (Une balise peut voyager DANS un morceau parti plus tard vers un autre écran : on recommence
  // tant qu'une balise trouve son morceau.)
  for (let tour = 0, change = true; change && tour < 20; tour++) {
    change = false;
    out = out.replace(/\n\/\/ ⟦→ (ecrans\/[^ \n]+) #(\d+)⟧/g, (b, rel, k) => {
      const m = morceaux[rel]; if (!m || m[k] == null) return b;
      const t = m[k]; delete m[k]; change = true; return cheminsVusDeSrc(t);
    });
  }
  // Ce qui n'a pas retrouvé sa place (balise effacée, écran écrit à la main) : à la fin, ses imports recollés.
  const deja = importesDe(out);
  const restes = [];
  for (const rel of Object.keys(morceaux)) for (const k of Object.keys(morceaux[rel])) restes.push(cheminsVusDeSrc(morceaux[rel][k]));
  for (const t of sansBalises) restes.push(recoller(t, deja));
  const tout = restes.length ? out + '\n' + restes.join('\n') : out;
  return sansDoublonsImport(tout);
}
// (8 nov.) Un morceau recollé porte parfois ses propres lignes d'import (elles étaient à
// cette place dans App.jsx). Si App.jsx importe aussi ce nom, le texte recollé le
// déclarerait DEUX fois (Babel : « already been declared »). Dernière passe : chaque nom
// importé n'est gardé qu'à sa PREMIÈRE ligne d'import ; rien d'autre ne change (chemins
// et ordre intacts ; une ligne vidée disparaît).
function sansDoublonsImport(texte) {
  const vus = new Set();
  // (11 nov.) Une ligne suivie d'un commentaire (`; // (10 nov., lot H)`) compte aussi : sans
  // cela DEMANDE_APPAREIL (App.jsx ET Réglages) était déclaré deux fois (Babel).
  return texte.replace(/^import\s+([^'";]*?)\s+from\s+(["'])([^"'\n]+)\2;[ \t]*(?:\/\/[^\n]*)?$/gm, (ligne, specs, q, chemin) => {
    // Un import d'App.jsx par un morceau recollé DANS App.jsx : ses noms y sont déclarés.
    if (/(^|\/)App\.jsx$/.test(chemin)) return '';
    const acc = specs.match(/\{([^}]*)\}/);
    const nommes = acc ? acc[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
    const autres = specs.replace(/\{[^}]*\}/, '').split(',').map((x) => x.trim()).filter(Boolean);
    const garderA = autres.filter((r) => { const loc = r.replace(/^\*\s+as\s+/, ''); if (vus.has(loc)) return false; vus.add(loc); return true; });
    const garderN = nommes.filter((n) => { const loc = n.split(/\s+as\s+/).pop(); if (vus.has(loc)) return false; vus.add(loc); return true; });
    if (garderA.length === autres.length && garderN.length === nommes.length) return ligne;
    const parts = [...garderA]; if (garderN.length) parts.push(`{ ${garderN.join(', ')} }`);
    return parts.length ? `import ${parts.join(', ')} from ${q}${chemin}${q};` : '';
  });
}

// La même chose à partir du chemin d'App.jsx (ce que les audits lisaient avant) :
// `fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8')` → `sourceAppDe(path.join(R, 'src', 'App.jsx'))`.
function sourceAppDe(cheminAppJsx) {
  return sourceApp(path.join(path.dirname(String(cheminAppJsx)), '..'));
}

// Le fichier (App.jsx ou un écran découpé) qui contient `morceau` — null si aucun.
function fichierQuiPorte(morceau, racine) {
  for (const f of fichiersApp(racine)) if (lireOrig.call(fs, f, 'utf8').includes(morceau)) return f;
  return null;
}

// Pour un audit qui garde le chemin d'App.jsx dans une constante et le lit plus loin
// (`fs.readFileSync(APP, 'utf8')`) : `require('./_source-app.cjs').brancher()` en tête
// fait rendre à toute lecture TEXTE d'un `…/src/App.jsx` le texte de l'app entière
// (App.jsx + écrans découpés). Une lecture en octets (sans encodage) n'est pas touchée.
let branche = false;
function brancher() {
  if (branche) return; branche = true;
  fs.readFileSync = function (f, opt, ...reste) {
    const enc = typeof opt === 'string' ? opt : opt && opt.encoding;
    if (enc && (typeof f === 'string' || f instanceof URL)) {
      const p = f instanceof URL ? f.pathname : f;
      if (/(^|[\\/])src[\\/]App\.jsx$/.test(p)) return sourceAppDe(path.resolve(p));
    }
    return lireOrig.call(this, f, opt, ...reste);
  };
  // un script ESM qui a fait `import { readFileSync } from 'fs'` voit la même lecture
  try { require('module').syncBuiltinESMExports(); } catch (_) {}
}

module.exports = { sourceApp, sourceAppCode, enFrancais, sourceAppDe, fichiersApp, fichierQuiPorte, brancher, RACINE };
