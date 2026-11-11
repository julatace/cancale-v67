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
    // (11 nov.) un écran qui importe un AUTRE écran (`./MessagesLeboncoin.jsx`) : cet écran est
    // recollé lui aussi, son nom est déjà déclaré dans le texte (Babel : « already been declared »).
    if (/^\.\/[^/]+\.jsx$/.test(chemin)) return '';
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

function sourceApp(racine) {
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
  // (11 nov.) une ligne d'import peut finir par un commentaire (`…js';   // (lot H)`) : elle compte aussi.
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

module.exports = { sourceApp, sourceAppDe, fichiersApp, fichierQuiPorte, brancher, RACINE };
