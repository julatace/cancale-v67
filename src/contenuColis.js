// ════════════════════════════════════════════════════════════════════════════
//  CE QU'IL Y A DANS UN COLIS À RETIRER — AUTOMATIQUE, OU RIEN (19 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (19 nov., mot pour mot) : « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être
// automatique : quand je fais l'achat, l'extension doit capter le numéro de suivi […] on doit pouvoir voir il y a
// quoi dans chaque code de retrait, ça doit être automatique. Sinon ce n'est pas grave, mais on ne doit pas avoir
// le bouton relier un achat ».
//
// Donc, pour chaque colis à retirer :
//   · RELIÉ par identité (n° de suivi lu sur Vinted, conversation de SA commande, code de retrait — jamais le titre,
//     le lieu, la date ou la ressemblance, §5) ⇒ la carte montre l'achat : photo, titre, prix payé, compte ;
//   · PAS relié ⇒ une ligne discrète et honnête, SANS bouton : « Contenu pas encore lu », et le geste quand on le
//     sait (« ouvre vinted.fr sur {compte} » : c'est l'extension, sur ce compte, qui lit le n° de suivi de l'achat) ;
//   · un lien posé à la main par le passé (`colis_suivi_*` portant tx/uid) reste LU : il est dans l'index des n° de
//     l'achat (`suivis`), comme avant — on ne casse aucun lien existant.
// Mesuré sur sa base le 19 nov. (docs/passation/2026-11-19-colis-achat-auto.md) : la forme des n° n'est jamais en
// cause (0 n° « presque pareil » sur 30 jours) ; ce qui manque, c'est le n° de suivi côté achat (l'extension).
//
// PUR (aucune lecture, aucune écriture, aucune horloge) : l'app et `scripts/audit-colis-achat-auto.cjs`
// exécutent CES fonctions.
import { achatDuColis } from './liensColis.js';
import { commandeUnique } from '../api/_lib/commande-colis.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';

// L'ACHAT D'UNE LIGNE « À RETIRER », LE MÊME PARTOUT (la règle du 13 nov., lot 7, sortie d'App.jsx pour être
// exécutée par l'audit) : le n° de suivi seul (`achatDuColis` : un seul achat candidat, sinon personne) et la
// jonction de `pickupUnion` (conversation, n° de suivi, code de retrait — `jonction`) doivent dire la MÊME
// commande (`commandeUnique`) ; deux commandes différentes ⇒ personne (mieux vaut un blanc qu'un faux).
export function achatDuRetrait(t, { achats = [], index = {}, jonction = null } = {}) {
  if (!t) return null;
  let a = null;
  try { a = achatDuColis(t, achats, index); } catch (_) { a = null; }
  return commandeUnique(a, jonction || null);
}

// CE QUE LA CARTE DIT DU CONTENU. Entrées (déjà calculées par l'écran, par identité) :
//   `ligne`       la ligne de colis (e-mail, SMS, compte du transporteur) — null pour une carte d'achat Vinted ;
//   `suivi`       le n° de suivi de la ligne ('' si elle n'en a pas) ;
//   `achat`       l'achat relié par identité (`achatDuRetrait`, ou l'achat de la carte) — null sinon ;
//   `autreSite`   l'achat Leboncoin / Vestiaire relié par le n° de suivi ({ site, titre }) — null sinon ;
//   `site`, `redirige`  ce que la carte porte déjà ;
//   `prix`        le prix payé LU de l'achat, déjà écrit ('' = pas su : rien n'est inventé) ;
//   `photo`       la photo de l'achat (ce que `Photo` de l'écran sait rendre) ou null ;
//   `compteAchat` le compte de l'achat ('' = pas à dire) ; `compteColis` le compte Vinted du colis (l'adresse qui
//                 a reçu son e-mail — une identité) ou '' (pas su).
// Rend LE SÉLECTEUR D'UN COLIS (posé sur chaque carte « à retirer », `x.contenu` — tous les écrans le lisent) :
//   { etat: 'relie', tx, titre, photo, prix, compte }   l'achat relié ;
//   { etat: 'pas-lu', raison, compte }                  rien ne relie ; `raison` = 'ouvrir-vinted' (le compte du colis
//                                                       est su : c'est là que l'extension lira le n°) ou '' (pas su) ;
//   { etat: 'autre-site', site, titre } · null          (rien à dire : pas un colis Vinted, ou une ligne sans n° de suivi).
export function contenuDuColis({ ligne = null, suivi = '', achat = null, autreSite = null, site = '', redirige = false, photo = null, prix = '', compteAchat = '', compteColis = '' } = {}) {
  if (achat && achat.transaction_id != null) {
    return { etat: 'relie', tx: String(achat.transaction_id), titre: String(achat.title || '').trim(), photo: photo || null, prix: String(prix || ''), compte: String(compteAchat || '') };
  }
  if (autreSite) return { etat: 'autre-site', site: String(autreSite.site || ''), titre: String(autreSite.titre || '').trim() };
  if (!ligne || redirige || (site && site !== 'vinted')) return null;
  if (!normaliserSuivi(suivi)) return null;
  const compte = String(compteColis || '').trim();
  return { etat: 'pas-lu', raison: compte ? 'ouvrir-vinted' : '', compte };
}

// LA PHRASE (une clé par phrase, `tr` passé par l'écran : src/i18n/). '' = rien à écrire.
export function texteContenu(c, tr) {
  if (!c || typeof tr !== 'function') return '';
  if (c.etat === 'pas-lu') return c.raison === 'ouvrir-vinted' && c.compte ? tr('achats.contenu.pasLuCompte', { compte: c.compte }) : tr('achats.contenu.pasLu');
  if (c.etat === 'relie') {
    if (c.prix && c.compte) return tr('achats.contenu.payeCompte', { prix: c.prix, compte: c.compte });
    if (c.prix) return tr('achats.contenu.paye', { prix: c.prix });
    return c.compte || '';
  }
  return '';
}
