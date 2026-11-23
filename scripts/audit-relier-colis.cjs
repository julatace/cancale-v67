#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — UN COLIS À RETIRER ET SON ACHAT ; LES JOURS DE LA LIGNE ET DU QR (16 nov., lot achats-qr)
// ═══════════════════════════════════════════════════════════════════════════
// Exécute les VRAIES règles (src/relierColis.js, src/delaiRetrait.js, src/liensColis.js) et lit le branchement :
//   R1 · `achatDuSuivi` relie par le n° de suivi SEUL (forme de l'e-mail Mondial Relay = forme du suivi Vinted :
//        8 chiffres, espaces/tirets ôtés), jamais par le titre ; 50 achats au même titre : seul le bon ; deux
//        achats au même n° : personne (« mieux vaut un blanc qu'un faux », §5) ;
//   R2 · `achatsARelier` : les achats EN ATTENTE sans n° de suivi (fini, remboursé, annulé, déjà suivi : exclus),
//        « au point relais » d'abord ; achats pas lus ⇒ null (jamais une liste vide) ;
//   R3 · `ecritureRelierColis` : la ligne `colis_suivi_{transporteur}_{n°}` portant le tx et le compte de L'ACHAT
//        CHOISI ; après elle, `achatDuColis` relie le colis à CET achat (rien d'autre) ;
//   R4 · `joursRestantsRetrait` : des jours civils de Paris — limite le 19, le 16 à 14 h ⇒ 3 (l'ancien calcul de la
//        feuille, `Math.ceil` d'instants, disait 4) ; la ligne (`delaiRetrait`) dit le même nombre ;
//   R5 · branchement : la feuille du QR lit `qrView.delai` / `joursRestantsRetrait` (plus de `Math.ceil` sur la
//        limite) ; la ligne passe SON délai (`ouvrirQr0(dl4…)`) ; « Afficher le QR » seulement avec `ouvrirQr` ;
//        (19 nov., décision de Julien : « on ne doit pas avoir le bouton relier un achat ») PLUS de « Relier » sur un
//        colis à retirer (ni `relierRetrait`, ni `relierDe`, ni `data-rp-relier-ouvrir`) : la feuille ne s'ouvre que
//        depuis le scanner (`EV_RELIER_COLIS`) ; l'écriture passe toujours par `ecritureRelierColis`. Ce que la
//        ligne dit à la place : scripts/audit-colis-achat-auto.cjs.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const importer = (p) => import('file://' + path.join(R, p));
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const { achatDuSuivi, achatsARelier, ecritureRelierColis } = await importer('src/relierColis.js');
  const { delaiRetrait, joursRestantsRetrait } = await importer('src/delaiRetrait.js');
  const { achatDuColis } = await importer('src/liensColis.js');
  const acc = { vinted_user_id: '333' };
  const achat = (tx, extra = {}) => ({ transaction_id: tx, title: 'Nike Air Max 90 blanche 42', _acc: acc, date: '2026-11-10T10:00:00Z', status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", ...extra });
  const cinquante = Array.from({ length: 50 }, (_, i) => achat(7000001 + i));

  // R1
  const idx = { '333:7000037': { uid: '333', suivi: '88763730' } };
  dit(achatDuSuivi('8876 3730', cinquante, idx) === cinquante[36], 'R1 · le n° (espaces ôtés) relie le BON des 50 achats au même titre');
  dit(achatDuSuivi('88763731', cinquante, idx) === null, 'R1 · un autre n° ne relie rien (même titre partout)');
  dit(achatDuSuivi('', cinquante, idx) === null && achatDuSuivi(null, cinquante, idx) === null, 'R1 · sans n° : rien');
  const idx2 = { '333:7000001': { uid: '333', suivi: '88763730' }, '333:7000002': { uid: '333', suivi: '88763730' } };
  dit(achatDuSuivi('88763730', cinquante, idx2) === null, 'R1 · deux achats au même n° : personne (jamais deviné)');
  const idx3 = { '444:7000037': { uid: '444', suivi: '88763730' } };
  dit(achatDuSuivi('88763730', cinquante, idx3) === null, 'R1 · le suivi d’un AUTRE compte ne relie pas cet achat');

  // R2
  const MAINT = Date.parse('2026-11-16T13:00:00Z');
  const mix = [achat(1, { status: "Commande expédiée et en cours d'acheminement ! ", date: '2026-11-14T10:00:00Z' }), achat(2), achat(3, { status: "Transaction finalisée - L'acheteur a validé la commande" }),
    achat(4, { status: 'Remboursement validé' }), achat(5, { status: 'Commande annulée' }), achat(6, { date: '2026-08-01T10:00:00Z' }), achat(7)];
  const l = achatsARelier(mix, { '333:7': { uid: '333', suivi: '12345678' } }, { maintenant: MAINT });
  dit(Array.isArray(l) && l.map((a) => a.transaction_id).join(',') === '2,1', 'R2 · en attente sans n° : « au point relais » puis « expédié » ; finis, remboursés, annulés, anciens et déjà suivis exclus', JSON.stringify(l && l.map((a) => a.transaction_id)));
  dit(achatsARelier(null, {}) === null && achatsARelier(undefined, {}) === null, 'R2 · achats pas lus ⇒ null (« pas su », jamais une liste vide)');
  dit((achatsARelier(cinquante, {}, { maintenant: MAINT }) || []).length === 50, 'R2 · les 50 achats au même titre sont TOUS proposés (le clic décide, rien n’est fusionné)');

  // R3
  const w = ecritureRelierColis({ suivi: '8876-3730', transporteur: 'mondialrelay' }, cinquante[36]);
  dit(!!w && w.id === 'colis_suivi_mondialrelay_88763730' && w.patch.tx === '7000037' && w.patch.uid === '333' && w.patch.suivi === '88763730', 'R3 · l’écriture porte le n° du colis, le tx et le compte de L’ACHAT CHOISI', JSON.stringify(w));
  dit(ecritureRelierColis({ suivi: '', transporteur: 'mondialrelay' }, cinquante[0]) === null && ecritureRelierColis({ suivi: '88763730' }, null) === null, 'R3 · sans n° ou sans achat : aucune écriture');
  dit((ecritureRelierColis({ suivi: '88763730', transporteur: 'inconnu' }, cinquante[0]) || {}).id === 'colis_suivi_autre_88763730', 'R3 · un transporteur hors liste ⇒ « autre » (la même clé que la saisie à la main)');
  // Après l'écriture : l'index de l'app (n° ajouté à la main, sous « compte:transaction ») relie CE colis à CET achat.
  const apres = { [`${w.patch.uid}:${w.patch.tx}`]: { uid: w.patch.uid, suivis: [w.patch.suivi] } };
  dit(achatDuColis({ suivi: '88763730' }, cinquante, apres) === cinquante[36] && achatDuColis({ suivi: '88763730' }, cinquante, {}) === null, 'R3 · après le clic, `achatDuColis` relie le colis à l’achat choisi (avant : rien)');

  // R4
  const J16_14h = Date.parse('2026-11-16T14:00:00+01:00');
  dit(joursRestantsRetrait('2026-11-19', J16_14h) === 3, 'R4 · limite le 19, le 16 à 14 h (Paris) ⇒ encore 3 j', String(joursRestantsRetrait('2026-11-19', J16_14h)));
  const ancien = Math.ceil((new Date('2026-11-19T23:59:59+01:00') - J16_14h) / 86400000);
  dit(ancien === 4, 'R4 · (témoin) l’ancien calcul de la feuille disait 4 pour le même colis', String(ancien));
  const d = delaiRetrait({ arriveeMs: Date.parse('2026-11-13T10:00:00Z'), limite: '2026-11-19' }, J16_14h);
  dit(!!d && d.jours === 3 && d.texte === 'encore 3 j', 'R4 · la ligne (`delaiRetrait`) dit le même nombre', d && d.texte);
  dit(joursRestantsRetrait('2026-11-16', Date.parse('2026-11-16T23:30:00+01:00')) === 0 && joursRestantsRetrait('2026-11-17', Date.parse('2026-11-16T23:30:00Z')) === 0, 'R4 · le jour de PARIS fait foi (23 h 30 UTC le 16 = le 17 à Paris)');
  dit(joursRestantsRetrait('', J16_14h) === null && joursRestantsRetrait('n/a', J16_14h) === null, 'R4 · une limite illisible ⇒ null');

  // R5 — branchement (commentaires retirés : juger le code, pas sa prose)
  const APP = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
  const CR = sansCommentaires(fs.readFileSync(path.join(R, 'src/CarteRelais.jsx'), 'utf8'));
  dit(!/Math\.ceil\(\(new Date\(qrView\.limite/.test(APP) && /joursRestantsRetrait\(jour\)/.test(APP) && /const dl = qrView\.delai/.test(APP), 'R5 · la feuille du QR : le délai de la ligne, sinon `joursRestantsRetrait` (plus de Math.ceil d’instants)');
  dit(/ouvrirQr0\(dl4 && Number\.isFinite\(dl4\.jours\) \? dl4 : null\)/.test(CR) && /openQrView\([^;]*\{ delai: d \|\| delaiColisRetrait\(x\) \}\)/.test(APP), 'R5 · la ligne passe SON délai à la feuille du QR');
  dit(/\{ouvrirQr \? <button[^>]*data-rp-afficher-qr=/.test(CR) && !/vrm-rpf-qr-mini/.test(CR), 'R5 · « Afficher le QR » : un vrai bouton, seulement quand un QR existe (plus l’icône grise)');
  // (19 nov., décision de Julien) Avant : « Relier » quand aucune identité ne reliait le colis. Désormais : aucun geste « Relier »
  // sur un colis à retirer ; la feuille n'a plus qu'une entrée, le scanner (un colis qu'il tient en main).
  const ouvertures = (APP.match(/setRelierColis\(\{/g) || []).length, parScan = (APP.match(/setRelierColis\(\{[^}]*depuis: 'scan' \}\)/g) || []).length;
  dit(!/relierRetrait/.test(APP) && !/relierDe\b/.test(APP) && !/relierDe\b|data-rp-relier-ouvrir|achats\.relier\.pasRelie/.test(CR) && ouvertures > 0 && ouvertures === parScan, 'R5 · plus de « Relier » sur un colis à retirer : la feuille ne s’ouvre que depuis le scanner (décision du 19 nov.)', `${parScan}/${ouvertures} ouverture(s) par le scanner`);
  dit(/const w = ecritureRelierColis\(relierColis, o\); if \(!w\) return;[\s\S]{0,200}await ecrireSuiviManuel\(w\.id, w\.patch\)/.test(APP), 'R5 · le clic écrit par `ecritureRelierColis` (le tx de LA ligne touchée)');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
