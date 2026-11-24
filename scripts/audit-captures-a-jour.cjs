// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES IMAGES QUI MONTRENT L'APP SONT CELLES DU DESIGN D'AUJOURD'HUI
//  (23 nov., Julien : « tous les tutos doivent ressembler à l'application, même
//  l'écran d'accueil »). Avant : la page d'accueil montrait l'ancienne « Ma journée »
//  bleu nuit des jours après le changement de design, sans qu'aucun contrôle le dise.
//
//  Pour chaque image servie qui montre l'app :
//    · public/accueil/*.webp        (page d'accueil, registre public/accueil/captures.json)
//    · public/aide/captures/*.jpg   (centre d'aide, registre public/aide/captures/captures.json)
//    · public/og-vrm.jpg            (image de partage, public/og-vrm.json)
//    · public/accueil/film-45s.jpg  (affiche de « Voir VRM en 45 s », public/accueil/film-45s.json)
//  1. elle est au registre, avec l'empreinte du FICHIER (rien de posé à la main) et
//     `modeExemple: true` (données inventées : dépôt public) ;
//  2. elle porte l'empreinte du DESIGN d'aujourd'hui (scripts/_empreinte-design.cjs :
//     jetons de l'app) — un design changé sans refaire les images rougit ici, avec le
//     geste à faire ;
//  3. aucune image orpheline (au dossier, pas au registre — une ancienne capture), aucune
//     entrée sans fichier, chaque `capture:` du centre d'aide existe ;
//  4. poids raisonnable (la page d'accueil reste rapide).
//
//    node scripts/audit-captures-a-jour.cjs
//    node scripts/audit-captures-a-jour.cjs --mutation   (prouve que chaque règle rougit)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { empreinteDesign } = require('./_empreinte-design.cjs');
const RACINE = path.join(__dirname, '..');
const lireJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8')); } catch (_) { return null; } };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE, f))).digest('hex');
const Ko = (f) => fs.statSync(path.join(RACINE, f)).size / 1024;

// Les poids au plus (Ko). Une capture d'iPhone en WebP qualité 72 pèse ~40–70 Ko.
const POIDS = { tel: 120, bureau: 160, aide: 160, og: 220, affiche: 80 };
const GESTE = 'npm run build && node scripts/accueil-captures.cjs && node scripts/accueil-og.cjs';

function verifier(E) {
  const fautes = [];
  const design = E.design;
  // 1–4 : la page d'accueil.
  const regA = E.lire('public/accueil/captures.json');
  if (!regA) fautes.push('public/accueil/captures.json absent');
  else {
    const fichiers = E.liste('public/accueil').filter((f) => f.endsWith('.webp'));
    for (const f of fichiers) {
      const e = regA[f], chemin = `public/accueil/${f}`;
      if (!e) { fautes.push(`${chemin} : pas au registre (ancienne capture ?) — retire-la ou refais : ${GESTE}`); continue; }
      if (e.modeExemple !== true) fautes.push(`${chemin} : pas faite en mode exemple`);
      if (e.sha256 !== E.sha(chemin)) fautes.push(`${chemin} : le fichier n'est pas celui du registre`);
      if (e.design !== design) fautes.push(`${chemin} : faite avec un autre design (${e.design || 'aucune empreinte'} ≠ ${design}) — ${GESTE}`);
      const max = e.largeur > 600 ? POIDS.bureau : POIDS.tel;
      if (E.ko(chemin) > max) fautes.push(`${chemin} : ${Math.round(E.ko(chemin))} Ko > ${max} Ko`);
    }
    for (const f of Object.keys(regA)) if (!fichiers.includes(f)) fautes.push(`registre de l'accueil : ${f} n'existe plus`);
  }
  // Le centre d'aide.
  const regH = E.lire('public/aide/captures/captures.json');
  if (!regH) fautes.push('public/aide/captures/captures.json absent — ' + GESTE);
  else {
    const fichiers = E.liste('public/aide/captures').filter((f) => /\.(jpe?g|png|webp)$/.test(f));
    for (const f of fichiers) {
      const e = regH[f], chemin = `public/aide/captures/${f}`;
      if (!e) { fautes.push(`${chemin} : pas au registre (ancienne capture ?)`); continue; }
      if (e.modeExemple !== true) fautes.push(`${chemin} : pas faite en mode exemple`);
      if (e.sha256 !== E.sha(chemin)) fautes.push(`${chemin} : le fichier n'est pas celui du registre`);
      if (e.design !== design) fautes.push(`${chemin} : faite avec un autre design — ${GESTE}`);
      if (E.ko(chemin) > POIDS.aide) fautes.push(`${chemin} : ${Math.round(E.ko(chemin))} Ko > ${POIDS.aide} Ko`);
    }
    for (const f of Object.keys(regH)) if (!fichiers.includes(f)) fautes.push(`registre de l'aide : ${f} n'existe plus`);
    for (const c of E.capturesAide) if (!fichiers.includes(c)) fautes.push(`scripts/aide-contenu.cjs montre ${c}, absente de public/aide/captures/`);
  }
  // L'image de partage.
  const og = E.lire('public/og-vrm.json');
  if (!og) fautes.push('public/og-vrm.json absent');
  else {
    if (og.sha256 !== E.sha('public/og-vrm.jpg')) fautes.push('public/og-vrm.jpg : pas celle de scripts/accueil-og.cjs');
    if (og.design !== design) fautes.push(`public/og-vrm.jpg : faite avec un autre design — ${GESTE}`);
    const src = regA && regA[(og.source || '').replace(/^accueil\//, '')];
    if (!src || src.sha256 !== og.sourceSha256) fautes.push('public/og-vrm.jpg : sa capture source n\'est plus au registre (refaire accueil-og après accueil-captures)');
    if (E.ko('public/og-vrm.jpg') > POIDS.og) fautes.push(`public/og-vrm.jpg : ${Math.round(E.ko('public/og-vrm.jpg'))} Ko > ${POIDS.og} Ko`);
  }
  // L'affiche du film de 45 s (la première image vue de « Voir VRM en 45 s »).
  const film = E.lire('public/accueil/film-45s.json');
  if (!film) fautes.push('public/accueil/film-45s.json absent — PUBLIER=1 node scripts/films/accueil-video.cjs');
  else {
    for (const x of ['mp4', 'jpg']) if (film[x] !== E.sha(`public/accueil/film-45s.${x}`)) fautes.push(`public/accueil/film-45s.${x} : pas celui du tournage enregistré`);
    if (film.design !== design) fautes.push('public/accueil/film-45s : tourné avec un autre design — PUBLIER=1 node scripts/films/accueil-video.cjs');
    if (E.ko('public/accueil/film-45s.jpg') > POIDS.affiche) fautes.push('public/accueil/film-45s.jpg trop lourde');
  }
  return fautes;
}

function environnement() {
  const contenu = fs.readFileSync(path.join(RACINE, 'scripts/aide-contenu.cjs'), 'utf8');
  return {
    design: empreinteDesign(),
    lire: lireJson,
    liste: (d) => { try { return fs.readdirSync(path.join(RACINE, d)); } catch (_) { return []; } },
    sha, ko: Ko,
    capturesAide: [...new Set([...contenu.matchAll(/capture:\s*'([^']+)'/g)].map((m) => m[1]))],
  };
}

const E = environnement();
const fautes = verifier(E);
if (process.argv.includes('--mutation')) {
  // Chaque règle doit rougir quand on la casse (CLAUDE.md §6.1).
  const cas = [
    ['les jetons de l\'app changent', { ...E, design: 'ffffffffffffffff' }],
    ['un fichier de l\'accueil est remplacé à la main', { ...E, sha: (f) => (f.endsWith('journee-sombre.webp') ? 'x' : E.sha(f)) }],
    ['une ancienne capture reste au dossier', { ...E, liste: (d) => E.liste(d).concat(d === 'public/accueil' ? ['ancienne-ma-journee.webp'] : []) }],
    ['une capture d\'aide manque', { ...E, capturesAide: E.capturesAide.concat(['colis-ancien.jpg']) }],
    ['une capture trop lourde', { ...E, ko: (f) => (f.endsWith('bureau-clair.webp') ? 900 : E.ko(f)) }],
    ['l\'image de partage n\'est plus faite de sa capture', { ...E, lire: (f) => (f === 'public/og-vrm.json' ? { ...lireJson(f), sourceSha256: 'x' } : lireJson(f)) }],
  ];
  let ko = 0;
  for (const [nom, env] of cas) {
    const n = verifier(env).length - fautes.length;
    console.log(`${n > 0 ? '✓' : '✗'} mutation « ${nom} » : ${n > 0 ? 'rougit' : 'NE ROUGIT PAS'}`);
    if (n <= 0) ko++;
  }
  if (ko) process.exit(1);
}
for (const f of fautes) console.error('✗ ' + f);
if (fautes.length) { console.error(`${fautes.length} faute(s) : les images qui montrent l'app ne sont pas celles du design d'aujourd'hui.`); process.exit(1); }
console.log(`✅ audit-captures-a-jour : accueil, centre d'aide, image de partage et film faits sur le design ${E.design}, en mode exemple, au registre, sans orpheline, poids tenus`);
