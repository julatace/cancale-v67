// ══════════════════════════════════════════════════════════════════════════
// LEBONCOIN : LE N° ÉCRIT À LA FIN DE LA DESCRIPTION RELIE L'ANNONCE À SA PAIRE (24 nov., lot lbc-numero-ecrit)
//
// Julien, 24 novembre, à la question « relier une annonce Leboncoin à sa paire par le N° écrit en fin de
// description ? » : « Oui, relie par le N° ». Une annonce dont la description finit par « N°132 » est
// reliée à la paire 132. Sans N° écrit, rien n'est deviné.
//
// CLAUDE.md §5 : une référence VRM ou un lien posé à la main sont des identités Leboncoin ; le N° qu'IL
// écrit lui-même dans SON annonce en est une aussi — jamais le titre, jamais une ressemblance. La lecture
// est celle de src/numeroEcrit.js (`lireNumeroTexte`, recopiée dans l'extension : `numEcrit`, 5.334, la
// description ENTIÈRE). Ce module ne relit pas le texte : il JUGE une lecture.
//
// Une annonce est reliée par son N° écrit SEULEMENT si :
//   · la description est lue EN ENTIER (la lecture de l'extension, ou un texte gardé en entier) ;
//   · elle porte UN seul N° (fin de description ; un autre N° dans le titre ⇒ deux numéros) ;
//   · elle est à LUI (un de ses comptes Leboncoin, prouvé) ;
//   · le N° (traduit par la remise à zéro du 11 oct. : `traduire`, la règle `numeroExterne`) désigne
//     UNE paire connue, pas deux (`douteux`), et aucune autre de ses annonces Leboncoin ne la porte ;
//   · il n'a rien décidé lui-même pour cette annonce : un lien posé (même vide = défait) gagne toujours,
//     « Délier » (= « pas la même paire » pour CE N°, noté dans le journal du parcours) n'est jamais refait.
// Sinon : rien n'est relié ; une annonce à lui qui porte un N° écrit est « à relier », la raison dite.
//
// RIEN N'EST ÉCRIT : l'identité est CALCULÉE à chaque lecture et superposée aux liens posés
// (`liensLbcAvecNumeroEcrit`, même forme que `liensLbcAvecPhoto` de la PR #1348). Module PUR (sauf l'état
// publié en bas) : l'app et scripts/audit-lbc-numero-ecrit.cjs exécutent les mêmes fonctions.
// ══════════════════════════════════════════════════════════════════════════

export const PREUVE_NUMERO_ECRIT = 'numero-ecrit';
// La clé du journal (`vrm_liaison_sites`) où « Délier » est retenu : { numero, at }.
export const cleNonEcrit = (id) => `nonEcrit:Leboncoin:${id}`;
// Les raisons d'un « à relier » (clé de traduction `lia.ecrit.<raison>`).
export const RAISONS_ECRIT = ['deux-numeros', 'partielle', 'inconnu', 'deux-paires', 'deux-annonces', 'autre-vendeur', 'delie'];

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const plein = (v) => v != null && String(v).trim() !== '';
const cleDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const a = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// LA RÈGLE.
// `annonces`  : { [id]: annonce Leboncoin } (lbc_listings.items) ;
// `lecture(ad)` : { etat: 'lu'|'ambigu'|'rien', cle, descriptionSue } — la fin de la description, lue en ENTIER
//                 (src/numeroEcrit.js `lireNumeroEcrit`, source 'description' seule) ;
// `titre(ad)`   : la lecture du titre (`lireNumeroTexte(titre, 'titre')`) : un AUTRE N° ⇒ deux numéros ;
// `sienne(ad)`  : vrai si l'annonce est sur un de SES comptes (prouvé) ;
// `traduire(cle, ad)` : la clé après la remise à zéro (`numeroExterne`) ;
// `connus`    : Set des N° (clés) de ses paires ; `null` ⇒ pas su ⇒ RIEN n'est relié ;
// `douteux`   : Set des N° portés par deux paires présentes ;
// `poses`     : SES liens (`vrm_lbc_liens`) ; une clé présente (même vide) est SA décision ;
// `journal`   : `vrm_liaison_sites` (les « Délier » : `nonEcrit:Leboncoin:<id>`).
// Rend { lu, Leboncoin: { [id]: N° }, aRelier: { [id]: { numero, raison } }, liste: [{ id, numero }] }.
export function identitesNumeroEcrit({ annonces = null, lecture, titre = null, sienne, traduire = (k) => k, connus = null, douteux = null, poses = {}, journal = {}, cle = cleDefaut } = {}) {
  const out = { lu: false, Leboncoin: {}, aRelier: {}, liste: [] };
  const A = objet(annonces), P = objet(poses), J = objet(journal);
  if (!A || !P || !J || !(connus instanceof Set) || typeof lecture !== 'function' || typeof sienne !== 'function') return out;
  out.lu = true;
  const D = douteux instanceof Set ? douteux : new Set();
  // Les N° déjà portés par une annonce Leboncoin reliée À LA MAIN (un article n'a qu'UNE annonce par site).
  const parLien = new Map();
  for (const [id, n] of Object.entries(P)) { const k = cle(n); if (k) parLien.set(k, (parLien.get(k) || 0) + 1); }
  const candidats = [];
  for (const [id0, ad] of Object.entries(A)) {
    if (!ad || typeof ad !== 'object') continue;
    const id = String(ad.id != null ? ad.id : id0);
    if (a(P, id)) continue;                                            // SA décision (un lien, ou un lien défait) gagne
    const l = lecture(ad) || null;
    const t = typeof titre === 'function' ? titre(ad) : null;
    if (!l || (l.etat !== 'lu' && l.etat !== 'ambigu')) {
      // Rien d'écrit : rien n'est deviné. Une description lue en partie : on ne sait pas — dit si l'annonce est à lui.
      if (l && l.descriptionSue === false && sienne(ad)) out.aRelier[id] = { numero: '', raison: 'partielle' };
      continue;
    }
    if (!sienne(ad)) { out.aRelier[id] = { numero: l.etat === 'lu' ? l.cle : '', raison: 'autre-vendeur', sienne: false }; continue; }
    if (l.etat === 'ambigu' || (t && t.etat === 'ambigu') || (t && t.etat === 'lu' && cle(t.cle) !== cle(l.cle))) { out.aRelier[id] = { numero: '', raison: 'deux-numeros' }; continue; }
    const k = cle(traduire(cle(l.cle), ad) || '');
    if (!k) { out.aRelier[id] = { numero: l.cle, raison: 'inconnu' }; continue; }
    const non = objet(J[cleNonEcrit(id)]);
    if (non && cle(non.numero) === k) { out.aRelier[id] = { numero: k, raison: 'delie' }; continue; }
    if (D.has(k)) { out.aRelier[id] = { numero: k, raison: 'deux-paires' }; continue; }
    if (!connus.has(k)) { out.aRelier[id] = { numero: k, raison: 'inconnu' }; continue; }
    if (parLien.has(k)) { out.aRelier[id] = { numero: k, raison: 'deux-annonces' }; continue; }
    candidats.push({ id, numero: k });
  }
  // Deux de SES annonces Leboncoin écrivent le même N° : aucune n'est reliée (laquelle est la paire ?).
  const parNum = new Map();
  for (const c of candidats) parNum.set(c.numero, (parNum.get(c.numero) || 0) + 1);
  for (const c of candidats) {
    if (parNum.get(c.numero) > 1) { out.aRelier[c.id] = { numero: c.numero, raison: 'deux-annonces' }; continue; }
    out.Leboncoin[c.id] = c.numero;
    out.liste.push(c);
  }
  return out;
}

// LES LIENS LUS : ses liens (posés, défaits) d'abord, puis le N° écrit là où il n'a rien décidé.
// La même forme que `liensLbcAvecPhoto` (PR #1348) : les deux se composent (`liensLbcLus`, App.jsx).
// `journal` (relu à l'instant) : un « Délier » posé depuis le calcul gagne déjà.
export function liensLbcAvecNumeroEcrit(manuels, ident, journal = null) {
  const m = objet(manuels) || {};
  const p = ident && ident.lu ? objet(ident.Leboncoin) || {} : {};
  if (!Object.keys(p).length) return m;
  const J = objet(journal) || {};
  const out = { ...m };
  for (const [id, n] of Object.entries(p)) {
    const non = objet(J[cleNonEcrit(id)]);
    if (!a(m, id) && plein(n) && !(non && cleDefaut(non.numero) === cleDefaut(n))) out[id] = n;
  }
  return out;
}

// Les annonces de « Relier mes annonces » (forme de src/memePhoto.js) vues À TRAVERS le N° écrit :
// reliée (preuve « N° écrit dans l'annonce », en tête) ou, à relier, la raison portée par l'annonce.
export function autresAvecNumeroEcrit(autres, ident) {
  const L = Array.isArray(autres) ? autres : [];
  if (!ident || !ident.lu) return L;
  const p = objet(ident.Leboncoin) || {}, r = objet(ident.aRelier) || {};
  return L.map((x) => {
    if (!x || x.plateforme !== 'Leboncoin') return x;
    const id = String(x.id);
    if (!x.relie && !plein(x.numero) && plein(p[id])) return { ...x, relie: true, numero: String(p[id]), identites: [{ sorte: PREUVE_NUMERO_ECRIT, numero: String(p[id]) }, ...(Array.isArray(x.identites) ? x.identites : [])] };
    if (!x.relie && !plein(x.numero) && r[id] && r[id].sienne !== false) return { ...x, numeroEcrit: { numero: String(r[id].numero || ''), raison: r[id].raison } };
    return x;
  });
}

// Une signature stable (prévenir les lecteurs seulement si les identités CHANGENT).
export function signatureNumeroEcrit(ident) {
  if (!ident || !ident.lu) return 'pas-su';
  return Object.entries(ident.Leboncoin || {}).map(([i, n]) => `${i}=${n}`).sort().join('|');
}

// ── L'ÉTAT PUBLIÉ (un propriétaire : `chargerNumerosEcritsLbc`, App.jsx) ─────────────────────
let _ident = null;                                    // null = pas encore calculé ⇒ aucun lien par le N° écrit
export const EVT_NUMERO_ECRIT_LBC = 'vrm:lbc-numero-ecrit';
export function poserNumerosEcritsLbc(ident) {
  const avant = signatureNumeroEcrit(_ident);
  _ident = ident && ident.lu ? ident : null;
  const change = avant !== signatureNumeroEcrit(_ident);
  if (change) { try { window.dispatchEvent(new CustomEvent(EVT_NUMERO_ECRIT_LBC, { detail: { n: _ident ? _ident.liste.length : 0 } })); } catch (_) { /* hors navigateur */ } }
  return change;
}
export const lireNumerosEcritsLbc = () => _ident;
