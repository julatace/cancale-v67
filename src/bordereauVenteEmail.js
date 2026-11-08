// ══════════════════════════════════════════════════════════════════════════════
// LE BORDEREAU D'UNE VENTE VUE PAR E-MAIL, PRÊT TOUT DE SUITE (8 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « quand tu reçois le mail de la vente, tu reçois aussi le bordereau :
// tu peux directement mettre le bordereau de la paire, et si tu n'as pas le
// numéro tu ne mets pas le numéro, mais tu peux déjà commencer le tamponnage
// avec son numéro si le gars n'a pas eu le temps de relancer l'extension. »
// Récit : docs/passation/2026-11-08-bordereau-des-email.md.
//
// Avant : une vente connue par son seul e-mail (`_venteEmail`,
// src/venteEmailFraiche.js) n'entrait pas dans Colis ; son bordereau (même n°
// de transaction) n'était rattaché à AUCUNE vente de la liste Vinted ⇒ il ne
// sortait qu'en diagnostic (« bordereau sans vente »), jamais « à imprimer ».
//
// ⇒ (1) LE COLIS. Une vente vue par e-mail dont le bordereau reçu porte le MÊME
//   n° de transaction (l'identité, jamais le titre) est un colis à envoyer, prêt
//   à imprimer, partout où Colis compte (`expeditions`, `lignesLot`, `toShip`,
//   `compteAImprimer`). Sans bordereau : rien ne change (la ligne de Ventes
//   seule). Une vente partie (preuves de api/_lib/depart-vente.js), un bordereau
//   masqué, une vente masquée : rien. Dès que la liste Vinted porte le n°, la
//   ligne Vinted la remplace (`avecVentesEmail`) et sa règle (`aExpedier`) fait
//   foi — une vente annulée sort.
// ⇒ (2) LE N° DU TAMPON (`decisionNumeroVenteEmail`). Seulement une identité
//   sûre : le N° posé à la main sur la transaction, le lien « Relier », l'annonce
//   de la transaction (identité Vinted captée par l'extension, photo exacte), le
//   N° qu'IL a écrit dans le titre de l'annonce (« … n12 », lu dans l'e-mail du
//   bordereau, `numeroEcritDansArticle`) ou — réglage « je numérote moi-même » —
//   dans le titre de la vente. JAMAIS le `numero` qu'un serveur a retrouvé par
//   ressemblance de titre (`findNumeroByTitle`) : 50 paires au même titre, un
//   seul N° serait le bon. Deux sources qui se contredisent ⇒ aucun N°.
//   Aucun N° ⇒ tampon du titre seul, et la carte dit « Sans N° : à écrire à la
//   main ». Un bordereau imprimé sans N° le reste écrit (« Imprimé sans N° »)
//   jusqu'au départ du colis — avec le N° quand il est apparu depuis.
//
// Pur : aucune lecture, aucun React. Testé par scripts/audit-bordereau-des-email.cjs.

import { cleNumero } from './numeroEcrit.js';

// Le « nXXX » du titre de l'annonce, tel que le serveur le lit dans l'e-mail du
// bordereau (`parseBordereauEmail`, api/email-inbound.js — la même expression).
const RE_N_TITRE = /[nN][º°]?(\d{2,6})(?!\d)/;

// Le N° de la ligne de bordereau est-il celui qu'IL a écrit dans le titre de son
// annonce ? Oui seulement si le titre reçu (`article`) le porte en toutes
// lettres. Le serveur range au même endroit (`numero`) un N° retrouvé PAR TITRE
// dans ses fiches : celui-là n'est pas écrit dans `article` ⇒ ''. Rend la clé
// (`cleNum`) ou ''.
export function numeroEcritDansArticle(b) {
  if (!b || typeof b !== 'object') return '';
  const n = cleNumero(b.numero);
  if (!n) return '';
  const m = RE_N_TITRE.exec(String(b.article || ''));
  if (!m) return '';
  return cleNumero(m[1]) === n ? n : '';
}

// Les sources : [{ source, numero }] — source ∈ 'transaction' (posé à la main
// sur la vente), 'lien' (« Relier »), 'annonce' (identité Vinted ou photo),
// 'ecrit' (écrit par lui). Rend :
//   { etat: 'sur', numero, source }          une seule clé, toutes d'accord ;
//   { etat: 'sans', numero: '' }             aucune source ;
//   { etat: 'contredit', numero: '', numeros } deux clés différentes : aucun N°.
export function decisionNumeroVenteEmail(sources) {
  const parCle = new Map();
  for (const s of (Array.isArray(sources) ? sources : [])) {
    if (!s) continue;
    const k = cleNumero(s.numero);
    if (!k) continue;
    if (!parCle.has(k)) parCle.set(k, { numero: String(s.numero).trim(), source: String(s.source || '') });
  }
  if (!parCle.size) return { etat: 'sans', numero: '', source: '' };
  if (parCle.size > 1) return { etat: 'contredit', numero: '', source: '', numeros: [...parCle.values()].map((x) => x.numero) };
  const [x] = parCle.values();
  return { etat: 'sur', numero: x.numero, source: x.source };
}

// Les colis des ventes vues par e-mail : celles dont un bordereau (avec PDF)
// porte le MÊME n° de transaction.
//   · `ventesEmail` : les lignes `_venteEmail` (src/venteEmailFraiche.js) ;
//   · `bordsParTx`  : { tx → bordereau } (`bordsParTransaction`, masqués exclus) ;
//   · `connues`     : (tx) ⇒ vrai si la liste Vinted porte ce n° (elle gagne) ;
//   · `cachee`      : (tx) ⇒ vrai si la vente est masquée à la main ;
//   · `partie`      : (o, b) ⇒ vrai si une preuve dit le colis parti.
// Rend [{ o, b, txn }].
export function colisVentesEmail({ ventesEmail, bordsParTx, connues, cachee, partie } = {}) {
  const out = [];
  if (!Array.isArray(ventesEmail) || !bordsParTx || typeof bordsParTx !== 'object') return out;
  const vus = new Set();
  for (const o of ventesEmail) {
    if (!o || !o._venteEmail || o.transaction_id == null) continue;
    const tx = String(o.transaction_id);
    if (vus.has(tx)) continue;
    vus.add(tx);
    if (typeof connues === 'function' && connues(tx)) continue;
    const b = bordsParTx[tx];
    if (!b || String(b.transaction) !== tx) continue;          // l'identité, rien d'autre
    if (!(b.hasPdf || (b.filename && b.filename !== 'None'))) continue;
    if (typeof cachee === 'function' && cachee(tx)) continue;
    if (typeof partie === 'function' && partie(o, b)) continue;
    out.push({ o, b, txn: tx });
  }
  return out;
}

// La mention d'un colis sans N° sûr, et d'un bordereau déjà imprimé sans N°.
export const MENTION_SANS_NUM = 'Sans N° : à écrire à la main';
export const MENTION_IMPRIME_SANS_NUM = 'Imprimé sans N°';
// Le registre des bordereaux imprimés sans N° (synchronisé) : { tx → date ISO }.
export const CLE_IMPRIMES_SANS_NUM = 'vrm_bords_sans_num';
// La phrase de la carte : imprimé sans N° ⇒ le dire ; et si un N° sûr est
// connu depuis, dire lequel écrire.
export function phraseImprimeSansNumero(registre, tx, numero) {
  const k = tx == null ? '' : String(tx);
  if (!k || !registre || typeof registre !== 'object' || !registre[k]) return '';
  const n = String(numero == null ? '' : numero).trim();
  return n ? `${MENTION_IMPRIME_SANS_NUM} — écris N° ${n} sur l’étiquette` : `${MENTION_IMPRIME_SANS_NUM} — à écrire à la main`;
}
