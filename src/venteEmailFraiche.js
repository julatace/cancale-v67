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
//       « Formulaire-retour-commande-{tx} » ou « Numéro de transaction ») —
//       ou (16 nov.) AUCUN n° : identifié alors par SA ligne (voir plus bas) ;
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

// ⚠️ (16 nov., lot vente-email-absente) LA VENTE D'UN COMPTE PARTICULIER. Julien,
// cloche : « Vendu 64 € · 9060 vert/blanc T38 » … et rien dans Ventes. Mesuré (lecture
// seule, 16 nov.) : les e-mails de vente des comptes PARTICULIERS ne portent JAMAIS de
// n° de transaction (`transaction` vide : il n'est lu que dans la pièce jointe d'une
// vente Pro) — 0 sur 13 depuis le 1er nov. La condition (a) « un n° numérique » les
// écartait donc TOUS : seule une vente Pro entrait. Désormais (a) admet aussi l'e-mail
// SANS n°, identifié par SA ligne (`email_sale_{empreinte}`, une ligne = une vente,
// jamais un titre) ; (b) et (c) inchangées. Sans n°, la ligne e-mail ne peut pas être
// REMPLACÉE par la ligne Vinted : elle disparaît dès que la liste du compte est relue
// (c : la lecture fait foi) — jamais deux lignes après une relecture. Et si la liste,
// lue AVANT l'e-mail, porte déjà une vente de ce compte datée de moins de
// `FENETRE_AMBIGUE_MS` avant l'e-mail (l'e-mail en retard sur une lecture), on ne
// sait pas si c'est la même : rien n'est ajouté (« pas su », jamais deviné au titre).
// Une ligne sans n° n'a ni bordereau, ni facture, ni colis (tous se relient par n°).

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
// La photo d'un e-mail de vente : une image d'annonce des serveurs de Vinted (la
// même règle que `RE_PHOTO_VINTED` d'api/email-inbound.js).
export const RE_PHOTO_EMAIL = /^https:\/\/images\d*\.vinted\.net\/tc?\/[^\s"'<>]{8,480}$/i;

// La requête PROJETÉE (jamais `select=data` : la ligne porte l'adresse et le
// nom de l'acheteur, inutiles ici). `meta` est remplie par la base (004).
export function requeteVentesEmail(maintenant = Date.now()) {
  const depuis = new Date(maintenant - JOURS_VENTES_EMAIL * 86400000).toISOString();
  // (16 nov.) Plus de filtre sur `transaction` : l'e-mail d'un compte particulier n'en porte pas.
  return 'id=like.email_sale_*&meta->>type=eq.vente'
    + `&meta->>receivedAt=gte.${encodeURIComponent(depuis)}`
    + '&select=id,type:meta->>type,tx:meta->>transaction,uid:meta->>uid,at:meta->>receivedAt,titre:meta->>designation,prix:meta->>prix,photo:meta->>photo';
}

// L'identifiant d'une ligne d'e-mail de vente (`email_sale_{empreinte}`) : l'identité
// d'une vente SANS n° (une ligne = un e-mail de vente, rangée par le serveur).
export const RE_ID_VENTE_EMAIL = /^email_sale_[A-Za-z0-9_-]{4,120}$/;
// Le préfixe de la clé d'une vente sans n° : jamais un nombre (aucune règle « par n° »
// — bordereau, facture, colis, N° posé — ne la prend pour une transaction).
export const PREFIXE_SANS_TX = 'email:';
// La fenêtre où une vente déjà lue pourrait être celle de l'e-mail (e-mail en retard).
export const FENETRE_AMBIGUE_MS = 30 * 60000;

// (a) : la preuve qu'une ligne est une VENTE d'un compte, avec SON n° — ou, sans n°,
//     avec SA ligne. Rend { tx, cle, uid, t } (`tx` vide sans n°) ou null. La base
//     filtre déjà ; on revérifie ici (une base qui ignorerait un filtre ne doit rien
//     faire entrer).
export function preuveVenteEmail(m) {
  if (!m || typeof m !== 'object') return null;
  if (String(m.type || '') !== 'vente') return null;
  const brut = String(m.tx == null ? '' : m.tx).trim();
  // Un n° présent mais pas numérique : la ligne n'est pas sûre ⇒ rien.
  if (brut && !RE_TX_VENTE_EMAIL.test(brut)) return null;
  const tx = brut;
  const id = String(m.id == null ? '' : m.id).trim();
  if (!tx && !RE_ID_VENTE_EMAIL.test(id)) return null;
  const cle = tx || (PREFIXE_SANS_TX + id);
  const uid = String(m.uid == null ? '' : m.uid).trim();
  if (!/^\d+$/.test(uid)) return null;
  const t = Date.parse(String(m.at || ''));
  if (!Number.isFinite(t)) return null;
  return { tx, cle, uid, t };
}

// (23 nov.) Le FICHIER d'une photo de Vinted : le chemin (`/t/{id}/{taille}/{fichier}`), sans l'hôte (images1, images…) ni
// la signature (`?s=`) — jamais un titre. `photo` : une adresse, ou l'objet `{ url }` d'une commande. Rien de sûr ⇒ ''.
export function clePhotoVente(photo) {
  const u = String((photo && typeof photo === 'object' ? photo.url : photo) || '').trim();
  const m = /^https:\/\/images\d*\.vinted\.net(\/tc?\/[^\s?#"'<>]{8,400})/i.exec(u);
  return m ? m[1] : '';
}
// Vrai seulement si la photo de l'e-mail est connue ET qu'AUCUNE vente lue de la fenêtre ambiguë ne porte ce fichier, toutes
// ayant le leur (une vente de la fenêtre sans photo ⇒ on ne sait pas ⇒ faux).
export function autreQueLaFenetre(lues, t, ph) {
  if (!ph) return false;
  const fen = (Array.isArray(lues) ? lues : []).filter((x) => x && x.d >= t - FENETRE_AMBIGUE_MS);
  if (!fen.length) return true;
  return fen.every((x) => x.ph && x.ph !== ph);
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
  // (16 nov.) La vente lue la plus récente de chaque compte (date de vente) : la fenêtre
  // ambiguë d'un e-mail SANS n° (voir l'en-tête).
  const derniereLue = new Map();
  // (23 nov.) Les ventes lues de chaque compte, datées, avec le FICHIER de leur photo (`clePhotoVente`).
  const luesParUid = new Map();
  for (const o of ventes) {
    if (!o || o._venteEmail) continue;
    if (o.transaction_id != null) connues.add(String(o.transaction_id));
    const u = String((o._acc && o._acc.vinted_user_id) || '').trim();
    const d = Date.parse(String(o.date || ''));
    if (u && Number.isFinite(d) && !(derniereLue.get(u) >= d)) derniereLue.set(u, d);
    if (u && Number.isFinite(d)) { const l = luesParUid.get(u) || []; l.push({ d, ph: clePhotoVente(o.photo) }); luesParUid.set(u, l); }
  }
  const parTx = new Map();
  for (const m of mails) {
    const p = preuveVenteEmail(m); if (!p) continue;                    // (a)
    const acc = parUid.get(p.uid); if (!acc) continue;                  // (b) compte lié
    if (typeof ecarte === 'function' && ecarte(p.uid)) continue;        // (b) pas écarté
    if (pasSu.has(p.uid)) continue;                                     // liste pas lue : pas su
    if (p.tx && connues.has(p.tx)) continue;                            // (c) déjà dans la liste
    const lu = lectures ? Number(lectures[p.uid]) : NaN;
    if (!Number.isFinite(lu)) continue;                                 // aucune lecture datée : pas su
    if (!(p.t > lu)) continue;                                          // (c) la lecture fait foi
    // Sans n° : une vente lue de ce compte juste avant l'e-mail pourrait être la même ⇒ pas su.
    // (23 nov.) …sauf si la PHOTO tranche (§5, identité 2 : le fichier exact). Mesuré le 23 nov. (lecture seule) : la photo
    // de l'e-mail de vente est, octet pour octet, celle de la vente dans la liste Vinted (7 sur 7). Une vente de la fenêtre
    // au même fichier ⇒ c'est elle (déjà dans la liste) ; toutes les ventes de la fenêtre ont un AUTRE fichier ⇒ ce n'est
    // aucune d'elles ; un fichier manquant d'un côté ⇒ pas su, comme avant.
    if (!p.tx && derniereLue.get(p.uid) >= p.t - FENETRE_AMBIGUE_MS && !autreQueLaFenetre(luesParUid.get(p.uid), p.t, clePhotoVente(m.photo))) continue;
    const deja = parTx.get(p.cle);
    // Deux e-mails du même n° (une copie transférée) : une ligne, la plus ancienne date.
    if (deja && deja._t <= p.t) continue;
    const titre = String(m.titre || '').trim();
    // (8 nov.) La photo de l'article lue dans l'e-mail (`photoVenteEmail`, le
    // serveur) : affichée tant que la liste Vinted n'a pas la vente. Même
    // contrôle qu'au serveur : une image d'annonce de Vinted, rien d'autre.
    const photo = RE_PHOTO_EMAIL.test(String(m.photo || '')) ? String(m.photo) : null;
    parTx.set(p.cle, {
      transaction_id: p.cle,
      title: titre || 'Vente Vinted',
      price: { amount: montantEmail(m.prix), currency_code: 'EUR' },
      date: new Date(p.t).toISOString(),
      status: STATUT_VENTE_EMAIL,
      ...(photo ? { photo } : {}),
      _venteEmail: true,
      _fromEmail: true,
      _txMail: p.tx,                                                    // vide sans n° : aucune facture, aucun bordereau
      ...(p.tx ? {} : { _sansTx: true }),
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

// (8 nov., « restes ventes ») UNE PHRASE PAR GROUPE (CLAUDE.md §7). Capture de
// Julien : chaque ligne « Vue par e-mail » d'un même compte répétait la même
// phrase (« Vendue — vue par e-mail, pas encore relue sur Vinted · ventes de ce
// compte relues le … » et le geste). Elle dépend du COMPTE (sa date de lecture,
// son geste) : dès que DEUX lignes affichées du même compte la portent, elle se
// dit une fois, en tête de la liste, pour ce compte ; la ligne garde ce qui lui
// est propre (son état, son bordereau). Une seule ligne ⇒ la phrase reste sur elle.
// `lignes` : les ventes AFFICHÉES. Rend Map uid → { uid, acc, lu, txs }.
export const MIN_LIGNES_EN_TETE = 2;
export function groupesVentesEmailEnTete(lignes) {
  const m = new Map();
  for (const o of (Array.isArray(lignes) ? lignes : [])) {
    if (!o || !o._venteEmail || o.transaction_id == null) continue;
    const uid = String((o._acc && o._acc.vinted_user_id) || '');
    if (!uid) continue;
    const g = m.get(uid) || { uid, acc: o._acc, lu: o._lectureVentes, txs: [] };
    g.txs.push(String(o.transaction_id));
    m.set(uid, g);
  }
  for (const [k, g] of [...m]) if (g.txs.length < MIN_LIGNES_EN_TETE) m.delete(k);
  return m;
}
// La phrase d'en-tête : le statut de la ligne, au pluriel (même source).
export const statutVentesEmail = (n) => (n > 1 ? `${n} ventes vues par e-mail, pas encore relues sur Vinted` : STATUT_VENTE_EMAIL);
