// scripts/emails-catalogue.cjs
// ════════════════════════════════════════════════════════════════════════════
// LE CATALOGUE DE TOUS LES E-MAILS QUE VRM FABRIQUE (17 nov., « Améliore les emails aussi »),
// chacun par SA vraie fonction, sur des données INVENTÉES (jamais la production), dans une
// langue donnée. Servi à scripts/audit-emails-beaux.cjs (les règles) et à
// scripts/emails-planche.cjs (les captures avant → après).
//   catalogue(racine, langue) → [{ id, nom, sujet, texte, html, bouton, montants }]
//   · `bouton`   : le nombre de boutons attendu (1 ; 0 pour ce qui n'a rien à ouvrir :
//                  la facture ou l'avoir d'un vendeur — le document EST la pièce jointe —,
//                  l'essai de SA boîte d'envoi, et « compte supprimé » — il n'y a plus de compte) ;
//   · `montants` : les nombres donnés à la fonction, qui DOIVENT se lire tels quels.
// Sur un arbre d'avant le 17 nov. (pas de `langue`), les fonctions rendent le français :
// c'est voulu (la planche « avant » ; l'audit, lui, rougit sur l'absence de mail-textes.js).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const FIN = Date.parse('2026-11-20T10:00:00Z');
const LIEN_ESSAI = 'https://vrm.center/api/compte?mode=relances&d=demonstration';
const LIEN_BILAN = 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration';
const BILAN = {
  mois: '2026-10', libelle: 'octobre 2026',
  vendu: { etat: 'su', n: 23, eur: 1842.5 }, recu: { etat: 'su', eur: 1610 },
  benefice: { etat: 'su', brut: 655.2, n: 23, nCout: 23, manque: [] },
  meilleure: { eur: 189, plateforme: 'Vinted', titre: 'Paire de démonstration 42' },
};
const BILAN_PARTIEL = {
  mois: '2026-10', libelle: 'octobre 2026',
  vendu: { etat: 'partiel', n: 6, eur: 300, manque: ['compte_demo (lu le 28 oct.)'] }, recu: { etat: 'pas-su', eur: 0, manque: [] },
  benefice: { etat: 'partiel', brut: 120, n: 6, nCout: 4, manque: ['2 prix d’achat manquent'] }, meilleure: null,
};
const FACTURE = (type) => ({
  type, numero: type === 'avoir' ? 'AV-2026-0002' : 'FA-2026-0007', regime: 'franchise', anglais: false,
  vendeur: { nom: 'Boutique Démo', adresse: ['1 rue Inventée', '00000 Démoville'], legal: [] },
  acheteur: { nom: 'Client Démo', adresse: ['2 rue Inventée'] },
  lignes: [{ designation: 'Paire de démonstration 42', quantite: 1, unite: 8990 }],
  totaux: { ht: 8990, ttc: 8990 }, mentions: [], paiement: 'payée le 05/11/2026',
});

async function catalogue(racine, langue = 'fr') {
  const imp = (p) => import(pathToFileURL(path.join(racine, p)).href);
  const RE = await imp('api/_lib/relances-essai.js');
  const BM = await imp('api/_lib/bilan-mois.js');
  const PA = await imp('api/_lib/preuve-adresse.js');
  const FR = await imp('src/facturePro/regle.js');
  const FP = await imp('api/_lib/facture-pro.js');
  const ME = await imp('api/_lib/mail-essai.js');
  const SD = await imp('api/_lib/suppression-differee.js');
  const SC = await imp('api/_lib/suppression-compte.js');
  const CP = await imp('api/_lib/clients-partis.js');
  globalThis.VRM_EDITEUR = undefined;          // l'éditeur pas rempli : rien d'inventé au pied
  const L = langue;
  const fin = new Date(FIN).toISOString();
  const facture = (type) => { const e = FR.emailFacture({}, FACTURE(type), { via: 'vrm' }); return { ...e, sujet: e.sujet }; };
  const boite = { ...FP.mailBoiteEssai(L), sujet: FP.sujetBoiteEssai ? FP.sujetBoiteEssai(L) : 'Essai d’envoi de tes factures' };
  const effaceLe = new Date(FIN + 30 * 864e5).toISOString();
  const etapes = { donnees: 1240, comptesVinted: 2, preuvesAdresse: 1, connexion: 'supprimee', facturesGardees: 3 };
  const liste = [
    { id: 'essai-j1', nom: 'Essai gratuit · jour 1', m: RE.texteRelance('j1', { fin, lien: LIEN_ESSAI, langue: L }), bouton: 1 },
    { id: 'essai-j3', nom: 'Essai gratuit · jour 3', m: RE.texteRelance('j3', { fin, lien: LIEN_ESSAI, relie: { vinted: false, emails: true, notifications: false }, langue: L }), bouton: 1 },
    { id: 'essai-j6', nom: 'Essai gratuit · veille de la fin', m: RE.texteRelance('j6', { fin, lien: LIEN_ESSAI, langue: L }), bouton: 1 },
    { id: 'bilan', nom: 'Bilan du mois', m: BM.texteBilanMois(BILAN, { lien: LIEN_BILAN, langue: L }), bouton: 1, montants: [BILAN.vendu.eur, BILAN.recu.eur, BILAN.benefice.brut, BILAN.meilleure.eur] },
    { id: 'bilan-partiel', nom: 'Bilan du mois (partiel)', m: BM.texteBilanMois(BILAN_PARTIEL, { lien: LIEN_BILAN, langue: L }), bouton: 1, montants: [BILAN_PARTIEL.vendu.eur, BILAN_PARTIEL.benefice.brut] },
    { id: 'preuve', nom: 'Preuve d’adresse de réception', m: PA.emailConfirmation('demo@exemple.test', 'https://vrm.center/?confirmer-adresse=demonstration', L), bouton: 1 },
    { id: 'mail-essai', nom: 'E-mail d’essai (Réglages)', m: ME.mailEssai(L), bouton: 1 },
    { id: 'boite-essai', nom: 'Essai de la boîte des factures', m: boite, bouton: 0 },
    { id: 'avis', nom: 'Avis avant suppression (abonnement fini)', m: CP.mailAvis({ quand: '20/12/2026', quandMs: FIN + 30 * 864e5, langue: L }), bouton: 1 },
    { id: 'demande', nom: 'Suppression demandée (30 jours)', m: SD.mailDemande({ effaceLe, contact: 'contact@exemple.test', langue: L }), bouton: 1 },
    { id: 'supprime', nom: 'Compte supprimé', m: SC.mailSuppression({ fait: ['abonnement résilié (aucun nouveau prélèvement)', 'tes données effacées (1240 éléments)'], etapes, abonnement: 'resilie', contact: 'contact@exemple.test', maintenant: FIN, langue: L }), bouton: 0 },
    // La facture et l'avoir : la langue de L'ACHETEUR (le PDF, bilingue ou non) — jamais celle du vendeur.
    { id: 'facture', nom: 'Facture Pro (au client du vendeur)', m: facture('facture'), bouton: 0, marque: true, montantsCentimes: [8990] },
    { id: 'avoir', nom: 'Avoir Pro (au client du vendeur)', m: facture('avoir'), bouton: 0, marque: true, montantsCentimes: [8990] },
  ];
  return liste.map(({ m, ...x }) => ({ ...x, sujet: (m && m.sujet) || '', texte: (m && m.texte) || '', html: (m && m.html) || '' }));
}

module.exports = { catalogue, BILAN, BILAN_PARTIEL, FACTURE };
