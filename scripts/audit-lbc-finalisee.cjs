#!/usr/bin/env node
// Prouve la règle « finalisée / annulée » des ventes Leboncoin — celle qui décide
// le CA du mois (ventes FINALISÉES uniquement, jamais les ventes en cours : risque
// de litige, « c'est très important » — Julien) et la disparition d'un colis vendu.
// Exécute le VRAI code extrait d'App.jsx dans un vm (§4.10 : on EXÉCUTE la règle).
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

// Extraire le bloc des deux fonctions (const lbcAnnulee … puis lbcFinalisee … };).
const i0 = SRC.indexOf('const lbcAnnulee');
const iF = SRC.indexOf('const lbcEuro');            // borne de fin (fonction suivante)
if (i0 < 0 || iF < 0 || iF < i0) { console.log('❌ bloc introuvable dans App.jsx'); process.exit(2); }
const code = SRC.slice(i0, iF);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.lbcAnnulee = lbcAnnulee; this.lbcFinalisee = lbcFinalisee;', ctx);
const { lbcAnnulee, lbcFinalisee } = ctx;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null ? ' — ' + d : '')); };
const fin = o => lbcFinalisee(o), ann = o => lbcAnnulee(o);

// ── Le bug signalé : Air Max 1 « Paiement effectué » (dernier palier vendeur) ──
dit(fin({ stepLabel: 'Paiement effectué' }) === true,
  'Air Max « Paiement effectué » = FINALISÉE (repli libellé terminal)');
// ── Le signal autoritaire du colis prime sur le libellé ──
dit(fin({ parcelColor: 'finished', stepLabel: 'Colis à envoyer' }) === true,
  'colis « finished » prime → FINALISÉE même si le libellé dit « à envoyer »');
dit(fin({ parcelColor: 'in_progress', stepLabel: 'Paiement effectué' }) === false,
  'colis PRÉSENT mais pas « finished » → PAS finalisée (le colis prime, même sur « Paiement effectué »)');
dit(fin({ parcelStatus: 'delivered' }) === true, 'parcelStatus « delivered » → FINALISÉE');

// ── Le point « très important » : une vente EN COURS n'est JAMAIS dans le CA ──
dit(fin({ stepLabel: 'Colis à envoyer', stepStatus: 'action' }) === false,
  'vente EN COURS « Colis à envoyer » → PAS finalisée (hors CA)');
dit(fin({ parcelStatus: 'en cours de livraison' }) === false,
  '⚠️ « en cours de livraison » = EN TRANSIT → PAS finalisée (pas « livr »)');
dit(fin({ stepLabel: 'En cours' }) === false, '« En cours » → PAS finalisée');
dit(fin({ stepLabel: 'Paiement reçu' }) === false,
  '« Paiement reçu » (palier amont ambigu) → PAS finalisée');

// ── Liste v3 ──
dit(fin({ stepStatus: 'done' }) === true, 'liste v3 step « done » → FINALISÉE');
dit(fin({ stepStatus: 'cancelled' }) === false, 'liste v3 step « cancelled » → PAS finalisée');

// ── Autres libellés terminaux mesurés ──
for (const l of ['Terminé', 'Vente finalisée', 'Colis reçu', 'Clôturé', 'livrée']) {
  dit(fin({ stepLabel: l }) === true, `libellé terminal « ${l} » → FINALISÉE`);
}

// ── Annulée / remboursée ──
dit(ann({ stepStatus: 'cancelled' }) === true, 'step « cancelled » → ANNULÉE');
dit(ann({ stepLabel: 'Vente annulée' }) === true, '« annulée » → ANNULÉE');
dit(ann({ parcelStatus: 'refunded' }) === true, 'colis « refunded » → ANNULÉE');
dit(ann({ stepLabel: 'Paiement effectué' }) === false, 'une vente finalisée normale n\'est PAS annulée');

// ── Le cas réel du bench colisprobe : trois ventes ──
dit(fin({ stepStatus: 'action', stepLabel: 'Colis à envoyer' }) === false
 && fin({ stepStatus: 'action', stepLabel: 'Paiement effectué' }) === true,
  'deux « à envoyer » + un « Paiement effectué » : seul le dernier entre dans le CA');

console.log(ko === 0 ? '\nLe CA du mois ne compte QUE des ventes finalisées, et jamais une vente en cours.'
                     : `\n${ko} CONTRÔLE(S) EN ÉCHEC`);
process.exit(ko ? 1 : 0);
