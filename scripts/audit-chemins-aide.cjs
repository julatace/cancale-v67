#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DES CHEMINS D'AIDE (16 nov., lot traduction-restes)
//      node scripts/audit-chemins-aide.cjs            (lecture seule)
//      node scripts/audit-chemins-aide.cjs --prouve   (chaque mutation doit rougir)
// ════════════════════════════════════════════════════════════════════════════
// Le centre d'aide public (scripts/aide-contenu.cjs ⇒ public/aide/), les gestes du
// « ? » (ETAPES_ECRANS ⇒ src/aideEtapes.js) et les fiches de l'aide intégrée
// (src/aideFiches.js) écrivent des chemins « Paramètres → Mon compte → Mon abonnement ».
// Le 15 nov., Paramètres a été rangé en dix catégories (docs/passation/2026-11-15-parametres.md) ;
// le 11 nov., l'onglet « Colis » a quitté la navigation. Un chemin qui ne mène plus nulle
// part envoie le vendeur chercher un écran qui n'existe pas. Ici, chaque chemin est
// relu CONTRE L'APP :
//   P1 « Paramètres → X » : X est le nom d'une des dix catégories (parametres.cat.*) ;
//   P2 « Paramètres → X → Y » : Y est le nom d'une rangée (`lib` de src/ecrans/Reglages.jsx)
//      ou d'un groupe que CETTE catégorie range (src/parametres/categories.js) ;
//   P3 au-delà (« … → Qui numérote ? Moi ») : le texte existe dans l'app (dictionnaire
//      français ou source) — un contrôle plus faible, dit tel quel ;
//   N1 « Écran → … » : l'écran est une entrée de navigation d'aujourd'hui (`entreeNav`) ;
//      un ancien nom (« Réglages », « Colis ») rougit ;
//   N2 la suite d'un tel chemin existe dans l'app (dictionnaire ou source).
// Les chemins hors de VRM (Gmail, iCloud, Orion, Réglages de l'iPhone) ne sont pas jugés :
// « Réglages » n'est un chemin VRM que s'il est suivi d'un nom de Paramètres.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.CHEMINS_RACINE || path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '\n   → ' + (Array.isArray(d) ? d.join('\n   → ') : String(d)) : ''}`); };

// Les textes qui portent des chemins : chaque chaîne, à toute profondeur.
const chaines = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => chaines(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => chaines(x, out)); return out; };

// Un chemin : des segments séparés par « → », gras retiré. Il s'arrête à la fin de la
// phrase (« . », « , », « : », « ; », parenthèse) — un « ? » reste (« Tout va bien ? »).
function chemins(texte) {
  const out = [];
  // La fin d'un gras qui n'est pas suivie d'une flèche termine le chemin (« **Paramètres → Mon compte** le dit »).
  const parts = String(texte).split('**');   // les parties impaires sont en gras
  const t = parts.map((x, i) => (i % 2 && !/^\s*→/.test(parts[i + 1] || '') ? x + '⟂' : x)).join('');
  // Découpe à la main : chaque « → » relie le mot d'avant et le mot d'après.
  const phrases = t.split(/(?<=[.;:,])\s+|\(|\)|\n|⟂/);
  for (const p of phrases) {
    if (!p.includes('→')) continue;
    const segs = p.split(/\s*→\s*/).map((s) => s.replace(/[.,;:]+$/, '').trim());
    // Le premier segment : les derniers mots avant la première flèche (après « dans », « par »…).
    segs[0] = segs[0].replace(/^.*\b(?:dans|par|ouvre|Ouvre|choisis|Choisis|via|sur|Sur)\s+/u, '').replace(/^(?:l’écran|l'écran)\s+/u, '').trim();
    out.push({ segs, texte: p.trim() });
  }
  return out;
}

async function principal() {
  const imp = async (rel) => import(pathToFileURL(path.join(R, rel)).href + '?v=' + Math.random());
  const fr = { ...(await imp('src/i18n/langues/fr-accueil.js')).default, ...(await imp('src/i18n/langues/fr.js')).default };
  const { CATEGORIES } = await imp('src/parametres/categories.js');
  const { L } = await imp('src/libelles.js');
  const reg = lire('src/ecrans/Reglages.jsx');
  const app = lire('src/App.jsx');

  // Les rangées de Paramètres : id ⇒ son nom affiché (lib), relu dans le code.
  const nomRangee = {};
  for (const m of reg.matchAll(/\{\s*id:\s*'([\w-]+)'[^{}\n]*?lib:\s*(?:tr\(\s*'([^']+)'\s*\)|'([^']+)'|L\.(\w+))/g)) {
    const v = m[2] ? fr[m[2]] : m[3] ? m[3] : (L[m[4]] && (L[m[4]].titre || L[m[4]]));
    if (typeof v === 'string' && !(m[1] in nomRangee)) nomRangee[m[1]] = v;
  }
  const cats = new Map();   // nom de catégorie ⇒ Set des noms qu'elle range (rangées et groupes)
  for (const c of CATEGORIES) {
    const nom = fr[`parametres.cat.${c.id}`];
    const noms = new Set();
    for (const g of c.groupes) { if (g.titre && fr[g.titre]) noms.add(fr[g.titre]); for (const id of g.items) if (nomRangee[id]) noms.add(nomRangee[id]); }
    if (nom) cats.set(nom, noms);
  }
  dit(cats.size === CATEGORIES.length && cats.size >= 10, `les ${cats.size} catégories de Paramètres ont un nom (parametres.cat.*)`);
  dit(Object.keys(nomRangee).length >= 60, `${Object.keys(nomRangee).length} rangées de Paramètres relues avec leur nom`);
  const tousNomsParam = new Set([...cats.keys(), ...[...cats.values()].flatMap((s) => [...s])]);

  // Les écrans de la navigation d'aujourd'hui (entreeNav) — et leurs noms traduits (nav.<id>).
  const ecrans = new Set();
  for (const m of app.matchAll(/entreeNav\(\{(?:\.\.\.\w+,\s*)?id:\s*(?:'(\w+)'|(\w+))[^}]*?label:\s*'([^']+)'/g)) { ecrans.add(m[3]); const k = m[1] && fr[`nav.${m[1]}`]; if (k) ecrans.add(k); }
  dit(ecrans.has('Paramètres') && ecrans.size >= 8, `${ecrans.size} écrans dans la navigation (${[...ecrans].join(', ')})`);
  const ANCIENS = ['Réglages', 'Colis', 'Paires', 'Mon compte', 'Abonnement'];   // noms qui ont quitté la navigation

  // Ce que l'app sait écrire (pour P3 / N2) : les valeurs du français et les textes du code.
  const valeurs = Object.values(fr).flatMap((v) => (v && typeof v === 'object' ? Object.values(v) : [v])).map(String);
  const sources = [];
  (function w(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) w(p); else if (/\.(jsx?|mjs)$/.test(f.name)) sources.push(fs.readFileSync(p, 'utf8')); } })(path.join(R, 'src'));
  const corpus = valeurs.join('\n') + '\n' + sources.join('\n');
  const existe = (s) => s.split(/\s+\/\s+/).every((x) => x && corpus.includes(x.replace(/\s+/g, ' ')));

  // Les textes qui portent des chemins.
  const C = require(path.join(R, 'scripts', 'aide-contenu.cjs'));
  const fiches = (await imp('src/aideFiches.js'));
  const sourcesTexte = [
    ['scripts/aide-contenu.cjs (ARTICLES)', chaines(C.ARTICLES)],
    ['scripts/aide-contenu.cjs (ETAPES_ECRANS)', chaines(C.ETAPES_ECRANS)],
    ['src/aideFiches.js', chaines((fiches.FICHES || fiches.FICHES_AIDE || Object.values(fiches).find((v) => Array.isArray(v) && v.length > 20 && v[0] && v[0].etapes) || []).map((f) => [f.q, f.etapes]))],
  ];
  dit(sourcesTexte.every(([, l]) => l.length > 10), 'les trois sources de l’aide se lisent', sourcesTexte.map(([n, l]) => `${n} : ${l.length} textes`));

  let nParam = 0, nNav = 0;
  const fautes = { P1: [], P2: [], P3: [], N1: [], N2: [] };
  for (const [nomSrc, textes] of sourcesTexte) for (const t of textes) for (const { segs, texte } of chemins(t)) {
    const [a, b, c, ...reste] = segs;
    const ou = `${nomSrc} : « ${texte.slice(0, 110)} »`;
    const versParam = a === 'Paramètres' || (a === 'Réglages' && tousNomsParam.has(b));
    if (versParam) {
      nParam++;
      if (a === 'Réglages') { fautes.N1.push(`${ou} — « Réglages » s'appelle « Paramètres »`); continue; }
      if (!cats.has(b)) { fautes.P1.push(`${ou} — « ${b} » n'est pas une catégorie (${[...cats.keys()].join(' · ')})`); continue; }
      if (c != null && c !== '' && !cats.get(b).has(c)) { fautes.P2.push(`${ou} — « ${c} » n'est pas dans « ${b} » (${[...cats.get(b)].join(' · ')})`); continue; }
      for (const x of reste) if (!existe(x)) fautes.P3.push(`${ou} — « ${x} » introuvable dans l'app`);
      continue;
    }
    if (ecrans.has(a) || ANCIENS.includes(a) && (segs.length > 1)) {
      // Un ancien nom n'est jugé que s'il désigne VRM : « Colis → À retirer », pas « Réglages → ton nom ».
      if (!ecrans.has(a)) { if (a === 'Réglages') continue; nNav++; fautes.N1.push(`${ou} — l'écran « ${a} » n'est plus dans la navigation`); continue; }
      nNav++;
      for (const x of segs.slice(1)) if (!existe(x)) fautes.N2.push(`${ou} — « ${x} » introuvable dans l'app`);
    }
  }
  dit(nParam >= 10, `${nParam} chemins « Paramètres → … » relus, ${nNav} chemins d'écran`);
  dit(!fautes.P1.length, 'P1 chaque « Paramètres → X » nomme une catégorie d’aujourd’hui', fautes.P1);
  dit(!fautes.P2.length, 'P2 chaque « Paramètres → X → Y » nomme une rangée ou un groupe de CETTE catégorie', fautes.P2);
  dit(!fautes.P3.length, 'P3 la suite du chemin existe dans l’app (dictionnaire ou source — contrôle faible)', fautes.P3);
  dit(!fautes.N1.length, 'N1 aucun ancien écran (« Réglages », « Colis ») : chaque chemin part d’un écran de la navigation', fautes.N1);
  dit(!fautes.N2.length, 'N2 la suite d’un chemin d’écran existe dans l’app', fautes.N2);

  // Les pages servies sont celles du contenu (sinon on juge un texte que personne ne lit).
  const g = spawnSync(process.execPath, [path.join(R, 'scripts', 'aide-generer.cjs'), '--verifier'], { cwd: R, encoding: 'utf8' });
  dit(g.status === 0, 'public/aide/ et src/aideEtapes.js sont ceux de scripts/aide-contenu.cjs', (g.stdout + g.stderr).trim().slice(-400));

  console.log(`\n${ko ? '❌' : '✅'} audit-chemins-aide : ${ok} verts, ${ko} rouge(s)`);
  return ko;
}

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['« Réglages → Mon abonnement » revient', 'scripts/aide-contenu.cjs', '**Paramètres → Mon compte → Mon abonnement**', '**Réglages → Mon abonnement**'],
    ['une catégorie renommée dans l’app', 'src/i18n/langues/fr/parametres.js', '"parametres.cat.argent": "Argent"', '"parametres.cat.argent": "Ma compta"'],
    ['une rangée déplacée dans une autre catégorie', 'src/parametres/categories.js', "'liens', 'connexions', 'verifier', 'ebay'", "'liens', 'connexions', 'ebay'"],
    ['l’ancien écran « Colis »', 'scripts/aide-contenu.cjs', "'Ouvre **Achats → À retirer**.'", "'Ouvre **Colis → À retirer**.'"],
    ['une fiche intégrée vers une rangée qui n’existe pas', 'src/aideFiches.js', "'Paramètres → Sécurité des données → Corbeille.'", "'Paramètres → Sécurité des données → Poubelle.'"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chemins-'));
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
    for (const d of ['src', 'scripts', 'public']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|[\\/]bancs[\\/]fx/.test(s) });
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    try { fs.copyFileSync(path.join(R, 'package.json'), path.join(tmp, 'package.json')); } catch (_) {}
    const f = path.join(tmp, rel); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable (elle ne prouve rien)`); continue; }
    fs.writeFileSync(f, src.replace(avant, apres));
    if (rel === 'scripts/aide-contenu.cjs') spawnSync(process.execPath, [path.join(tmp, 'scripts', 'aide-generer.cjs')], { cwd: tmp });
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-chemins-aide.cjs')], { env: { ...process.env, CHEMINS_RACINE: tmp }, encoding: 'utf8', timeout: 180000 });
    if (r.status !== 0) rouges++;
    console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges === MUTS.length ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length ? 0 : 1);
} else {
  principal().then((k) => process.exit(k ? 1 : 0), (e) => { console.error(e); process.exit(1); });
}
