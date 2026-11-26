#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA PHOTO DE PROFIL D'UN COMPTE VIENT DE SA LIGNE (25 nov., logo-vinted-pp)
//  node scripts/audit-photo-profil-compte.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien : « le logo de Vinted, mais pour le compte la pp du compte Vinted ». Le rond du compte (`AvatarCompte`) montre la
// photo lue par src/natif/visuel/photosProfil.js. CLAUDE.md §5 (identité) : cette photo vient de `harvest_{uid}_profile`
// du MÊME uid, jamais d'un pseudo ressemblant. Ce que l'audit EXÉCUTE (la règle chargée telle quelle) :
//   A  une ligne → la photo de SON uid ; une ligne dont `payload.user.id` dit un AUTRE compte ⇒ rien ;
//   B  https seulement (http, javascript:, vide ⇒ rien) ; un id qui n'est pas `harvest_{chiffres}_profile` ⇒ rien ;
//   C  la clé d'un rond : `vinted:{uid}` seulement (Leboncoin, eBay, Vestiaire, un pseudo ⇒ aucune photo) ;
//   D  la lecture est PROJETÉE (jamais `select=data`) et ne lit que les lignes de profil ;
//   E  AvatarCompte rend la photo par le rendu posé (PhotoVinted), avec l'initiale en repli, et passe à l'initiale sur erreur ;
//      l'écran Annonces pose la source (lecteur + session + PhotoVinted) ;
//   F  la photo n'est servie qu'au vendeur qui l'a lue (`qui` comparé à chaque lecture de l'instantané).
// --prouve : chaque mutation du code DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const F = path.join(R, 'src', 'natif', 'visuel', 'photosProfil.js');
const INV = path.join(R, 'src', 'natif', 'visuel', 'Inventaire.jsx');
const EG = path.join(R, 'src', 'ecrans', 'AnnoncesEgalite.jsx');
const MUTS = {
  'autre-compte': [F, "if (pid !== null && pid !== m[1]) continue;", ''],
  'http': [F, "if (!/^https:\\/\\/[^\\s\"'<>]+$/i.test(url)) continue;", "if (!url) continue;"],
  'toute-cle': [F, "const m = /^vinted:(\\d{1,20})$/.exec(String(cle || ''));", "const m = /^[a-z]+:(.+)$/.exec(String(cle || ''));"],
  'ligne-entiere': [F, "&select=id,photo:data->payload->user->photo->>url,pid:data->payload->user->>id", "&select=id,data"],
  'sans-repli': [INV, ' repli={lettre}', ''],
  'autre-vendeur': [F, "return q && q === etat.qui ? etat.photos : undefined;", 'return etat.photos;'],
};
const arg = process.argv.slice(2);
if (arg[0] === '--prouve') {
  let tenues = 0;
  for (const [nom, [fichier, de, vers]] of Object.entries(MUTS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ppc-'));
    for (const f of [F, INV, EG]) { const d = path.join(t, path.relative(R, f)); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(f, d); }
    const cible = path.join(t, path.relative(R, fichier)); const src = fs.readFileSync(cible, 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : le texte à muter n'existe plus`); process.exitCode = 1; continue; }
    fs.writeFileSync(cible, src.replace(de, vers));
    let rouge = false; try { execFileSync(process.execPath, [__filename, '--racine', t], { stdio: 'pipe' }); } catch (_) { rouge = true; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`); if (rouge) tenues++; else process.exitCode = 1;
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(`\n${tenues}/${Object.keys(MUTS).length} mutations rougissent`);
  process.exit(process.exitCode || 0);
}
const racine = arg[0] === '--racine' ? arg[1] : R;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
(async () => {
  const src = fs.readFileSync(path.join(racine, 'src', 'natif', 'visuel', 'photosProfil.js'), 'utf8');
  // La règle chargée telle quelle (React n'y sert qu'au crochet : une doublure suffit pour les fonctions pures).
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ppc-mod-'));
  const mod = path.join(t, 'photosProfil.mjs');
  fs.writeFileSync(mod, src.replace(/^import React from 'react';$/m, 'const React = { useSyncExternalStore: () => undefined };'));
  const M = await import('file://' + mod);
  const U = '3150000000', V = '3150001111';
  const pp = (u) => `https://images1.vinted.net/t/pp-${u}/50x50/a.jpeg`;
  const lignes = [
    { id: `harvest_${U}_profile`, photo: pp(U), pid: U },
    { id: `harvest_${V}_profile`, photo: pp(V), pid: '999' },
    { id: 'harvest_42_profile', photo: 'http://images1.vinted.net/t/x.jpeg', pid: null },
    { id: 'harvest_43_profile', photo: 'javascript:alert(1)', pid: null },
    { id: 'harvest_44_profile', photo: pp(44), pid: null },
    { id: 'harvest_45_releve_1', photo: pp(45) },
    { id: 'lbc_profile', photo: pp(46) },
  ];
  const ph = M.photosDesLignes(lignes);
  dit(ph[U] === pp(U), 'A la ligne d’un compte donne la photo de SON uid', ph);
  dit(!(V in ph), 'A une ligne qui dit un AUTRE compte (payload.user.id) ⇒ aucune photo', ph);
  dit(ph['44'] === pp(44), 'A une ligne sans payload.user.id garde sa photo (son id fait foi)', ph);
  dit(!('42' in ph) && !('43' in ph), 'B https seulement (http, javascript: ⇒ rien)', ph);
  dit(!('45' in ph) && Object.keys(ph).length === 2, 'B seules les lignes `harvest_{uid}_profile` comptent', Object.keys(ph));
  dit(M.photosDesLignes(null) && !Object.keys(M.photosDesLignes(null)).length, 'B « pas su » (null) ⇒ aucune photo, sans erreur');
  dit(M.uidPhotoDe('vinted:' + U) === U, 'C `vinted:{uid}` ⇒ l’uid de SA ligne');
  dit(['leboncoin:' + U, 'ebay:abc', 'vestiaire:12', 'vinted:shop_cancale', U, '', null].every((c) => M.uidPhotoDe(c) === null), 'C Leboncoin, eBay, Vestiaire, un pseudo ⇒ aucune photo');
  const q = M.REQUETE_PHOTOS_COMPTES;
  dit(/^id=like\.harvest_\*_profile&/.test(q) && !/select=[^&]*\bdata(,|&|$)/.test(q) && /photo->>url/.test(q) && /user->>id/.test(q), 'D la lecture est projetée (photo, id du compte), lignes de profil seulement', q);
  dit(/q && q === etat\.qui \? etat\.photos : undefined/.test(src), 'F l’instantané n’est servi qu’au vendeur qui l’a lu');
  const inv = fs.readFileSync(path.join(racine, 'src', 'natif', 'visuel', 'Inventaire.jsx'), 'utf8');
  const av = inv.slice(inv.indexOf('export function AvatarCompte'), inv.indexOf('export function AvatarsComptes'));
  dit(/usePhotoCompte\(cle\)/.test(av) && /<Photo src=\{photo\}[^>]*loading="lazy"[^>]*repli=\{lettre\}[^>]*onError=/.test(av) && !/<img\b/.test(av), 'E AvatarCompte : la photo par le rendu posé (PhotoVinted), paresseuse, l’initiale en repli et sur erreur, aucun <img> brut');
  const eg = fs.readFileSync(path.join(racine, 'src', 'ecrans', 'AnnoncesEgalite.jsx'), 'utf8');
  dit(/poserSourcePhotosComptes\(\{ lire: \(q\) => lireTout\(q\), qui: \(\) => \(AUTH\.user && AUTH\.user\.id\) \|\| '', Photo: PhotoProfil \}\)/.test(eg) && /const PhotoProfil = \(p\) => <PhotoVinted \{\.\.\.p\}\/>/.test(eg), 'E Annonces pose la source : lireTout, la session, PhotoVinted');
  fs.rmSync(t, { recursive: true, force: true });
  console.log(`\n${ko ? '❌' : '✅'} audit-photo-profil-compte : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
