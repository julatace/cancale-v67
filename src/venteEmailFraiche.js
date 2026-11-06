// ══════════════════════════════════════════════════════════════════════════════
// LA VENTE VUE PAR E-MAIL, PAS ENCORE RELUE SUR VINTED (6 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « ma vente n'apparaît pas dans VRM, j'ai capté sur Orion ». Mesuré
// (lecture seule, 6 nov.) : l'e-mail de vente (`email_sale_*`, n° de
// transaction prouvé) et l'e-mail du bordereau (`email_bord_{tx}`) étaient en
// base, mais la liste des ventes du compte (`harvest_{uid}_orders_sold`) datait
// de la veille — et l'écran Ventes ne lit QU'ELLE (« source unique », choix
// d'août : les e-mails de STATUT finissaient en faux achats). Récit :
// docs/passation/2026-11-06-vente-email-fraiche.md.
//
// ⇒ On ne rouvre PAS la reconstruction générale depuis les e-mails. Une vente
//   e-mail entre dans Ventes SEULEMENT si les trois conditions tiennent :
//   (a) c'est un e-mail de VENTE (`type: 'vente'`, la branche « Ton article
//       s'est vendu » du serveur — jamais un statut) qui porte un n° de
//       transaction NUMÉRIQUE (lu par le serveur dans la pièce jointe
//       « Formulaire-retour-commande-{tx} » ou « Numéro de transaction ») ;
//   (b) son compte — l'uid que le serveur a rangé d'après l'adresse de
//       RÉCEPTION (§5), jamais l'expéditeur ni le texte — est un compte lié et
//       pas écarté (masqué, hors des totaux : son choix) ;
//   (c) la transaction est ABSENTE de la liste des ventes de ce compte ET
//       l'e-mail est arrivé APRÈS la dernière lecture de cette liste
//       (`capturedAt`, jamais `updated_at`). Un e-mail plus vieux que la
//       lecture ⇒ rien : la lecture fait foi (la vente a pu être annulée).
//   Une liste pas lue (« pas su ») ne dit rien : aucune vente e-mail pour ce
//   compte (on ne peut juger ni (c) ni « absente »).
// ⇒ Identité = le n° de transaction. Dès que la liste Vinted la porte, la
//   ligne Vinted la remplace — jamais deux lignes (`avecVentesEmail`).
// ⇒ Elle compte dans VENDU (date de vente = arrivée de l'e-mail) ; jamais dans
//   le CA déclaré, daté au VERSEMENT (§5) : elle n'est pas finalisée.
// ⇒ Aucun N° deviné : la ligne passe par la règle de l'écran (`effEntry` :
//   N° posé à la main sur la transaction, identité Vinted, photo). Le `numero`
//   d'un `email_bord_*` n'est PAS une identité — mesuré le 6 nov. : les 135
//   bordereaux numérotés l'ont reçu par TITRE (`findNumeroByTitle`), aucun n'a
//   été lu dans l'e-mail.

import { gesteRelireVentes } from './fraicheurComptes.js';

// Le statut de la ligne : il dit ce qu'elle est (et `classifyOrderStatus` la
// range « en cours » : ni finalisée, ni annulée).
export const STATUT_VENTE_EMAIL = 'Vendue — vue par e-mail, pas encore relue sur Vinted';
// Un n° de transaction Vinted : des chiffres, rien d'autre (la règle du serveur
// et de `ordersFromEmailSales`).
export const RE_TX_VENTE_EMAIL = /^\d{6,20}$/;
// La fenêtre lue : les e-mails de vente des 30 derniers jours (volume borné ;
// au-delà, la liste Vinted a forcément été relue ou le compte est figé —
// l'indicateur des comptes le dit).
export const JOURS_VENTES_EMAIL = 30;

// La requête PROJETÉE (jamais `select=data` : la ligne porte l'adresse et le
// nom de l'acheteur, inutiles ici). `meta` est remplie par la base (004).
export function requeteVentesEmail(maintenant = Date.now()) {
  const depuis = new Date(maintenant - JOURS_VENTES_EMAIL * 86400000).toISOString();
  return 'id=like.email_sale_*&meta->>type=eq.vente&meta->>transaction=not.is.null'
    + `&meta->>receivedAt=gte.${encodeURIComponent(depuis)}`
    + '&select=id,type:meta->>type,tx:meta->>transaction,uid:meta->>uid,at:meta->>receivedAt,titre:meta->>designation,prix:meta->>prix';
}

// (a) : la preuve qu'une ligne est une VENTE d'un compte, avec SON n°.
//     Rend { tx, uid, t } ou null. La base filtre déjà ; on revérifie ici (une
//     base qui ignorerait un filtre ne doit rien faire entrer).
export function preuveVenteEmail(m) {
  if (!m || typeof m !== 'object') return null;
  if (String(m.type || '') !== 'vente') return null;
  const tx = String(m.tx == null ? '' : m.tx).trim();
  if (!RE_TX_VENTE_EMAIL.test(tx)) return null;
  const uid = String(m.uid == null ? '' : m.uid).trim();
  if (!/^\d+$/.test(uid)) return null;
  const t = Date.parse(String(m.at || ''));
  if (!Number.isFinite(t)) return null;
  return { tx, uid, t };
}

const montantEmail = (p) => {
  const s = String(p == null ? '' : p).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? s : null;
};

// Les ventes e-mail à montrer.
//   · `mails`    : les lignes projetées (`requeteVentesEmail`) ; `undefined`
//                  ou `null` (pas lu / pas su) ⇒ aucune ;
//   · `comptes`  : les comptes Vinted LIÉS (objets `{ vinted_user_id, … }`) ;
//   · `ecarte`   : (uid) ⇒ vrai si le compte est écarté par son choix ;
//   · `ventes`   : la liste Vinted lue (toutes les ventes, tous comptes) ;
//                  pas un tableau (pas su) ⇒ aucune ;
//   · `ko`       : les uid dont la liste n'a PAS été lue (pas su) ;
//   · `lectures` : uid → ms de la dernière lecture de SA liste de ventes.
// Rend des lignes à la forme d'une commande Vinted (pour les filtres, la
// ligne, les totaux), marquées `_venteEmail`, triées de la plus récente.
export function ventesEmailFraiches({ mails, comptes, ecarte, ventes, ko, lectures } = {}) {
  if (!Array.isArray(mails) || !Array.isArray(ventes)) return [];
  const parUid = new Map();
  for (const a of (Array.isArray(comptes) ? comptes : [])) {
    const u = String((a && a.vinted_user_id) || '').trim();
    if (u) parUid.set(u, a);
  }
  const pasSu = new Set((Array.isArray(ko) ? ko : []).map(String));
  // L'identité est la transaction : présente dans la liste d'UN compte, elle
  // est connue (jamais une seconde ligne, même rangée sous un autre compte).
  const connues = new Set();
  for (const o of ventes) if (o && o.transaction_id != null && !o._venteEmail) connues.add(String(o.transaction_id));
  const parTx = new Map();
  for (const m of mails) {
    const p = preuveVenteEmail(m); if (!p) continue;                    // (a)
    const acc = parUid.get(p.uid); if (!acc) continue;                  // (b) compte lié
    if (typeof ecarte === 'function' && ecarte(p.uid)) continue;        // (b) pas écarté
    if (pasSu.has(p.uid)) continue;                                     // liste pas lue : pas su
    if (connues.has(p.tx)) continue;                                    // (c) déjà dans la liste
    const lu = lectures ? Number(lectures[p.uid]) : NaN;
    if (!Number.isFinite(lu)) continue;                                 // aucune lecture datée : pas su
    if (!(p.t > lu)) continue;                                          // (c) la lecture fait foi
    const deja = parTx.get(p.tx);
    // Deux e-mails du même n° (une copie transférée) : une ligne, la plus ancienne date.
    if (deja && deja._t <= p.t) continue;
    const titre = String(m.titre || '').trim();
    parTx.set(p.tx, {
      transaction_id: p.tx,
      title: titre || 'Vente Vinted',
      price: { amount: montantEmail(m.prix), currency_code: 'EUR' },
      date: new Date(p.t).toISOString(),
      status: STATUT_VENTE_EMAIL,
      _venteEmail: true,
      _fromEmail: true,
      _txMail: p.tx,
      _acc: acc,
      _lectureVentes: lu,
      _t: p.t,
    });
  }
  return [...parTx.values()].sort((a, b) => b._t - a._t);
}

// La liste Vinted + les ventes e-mail encore absentes. La ligne Vinted gagne
// TOUJOURS (même n° ⇒ la ligne e-mail sort) ; aucune ligne e-mail n'entre dans
// une liste « pas su ».
export function avecVentesEmail(ventes, fraiches) {
  if (!Array.isArray(ventes)) return ventes;
  if (!Array.isArray(fraiches) || !fraiches.length) return ventes;
  const connues = new Set(ventes.filter((o) => o && o.transaction_id != null).map((o) => String(o.transaction_id)));
  const ajout = fraiches.filter((o) => o && !connues.has(String(o.transaction_id)));
  if (!ajout.length) return ventes;
  return [...ventes, ...ajout].sort((a, b) => (Date.parse((b && b.date) || '') || 0) - (Date.parse((a && a.date) || '') || 0));
}

// Le geste, une phrase : là où la liste se relit — LA phrase de l'indicateur
// des comptes (`gesteRelireVentes`, src/fraicheurComptes.js, §11). `dans` vient
// de `motsNavigateur()` (« dans Orion », « dans ce Chrome »…) — jamais un nom de
// navigateur écrit en dur.
export const gesteVenteEmail = (dans) => gesteRelireVentes(dans);
