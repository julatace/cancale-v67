// ═══════════════════════════════════════════════════════════════════════════
// REMETTRE EN VENTE UNE VENTE ANNULÉE AVANT L'ENVOI (6 nov., vague 2 · point 1)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré en lecture seule sur sa base (6 nov.) : 10 ventes Vinted annulées avant
// l'envoi depuis août (transaction 510/520, l'expédition n'a jamais bougé —
// `txnAnnuleeAvantEnvoi`, la règle de l'app). La paire est chez lui. Chez Vinted,
// l'annonce de ces ventes reste FERMÉE (`is_closed: true`,
// `item_closing_action: "sold"`, 7 sur 7 relues dans son dressing) : Vinted ne
// la remet pas en ligne, et rien ne l'a remise depuis (aucune recréation, aucun
// suivi « à la main »).
//
// LE MOTEUR NE SAIT PAS LA RECRÉER SANS SUPPRIMER (mesuré dans le code de
// `recreerVinted`, vinted-sync-extension/background.js, 5.322) : il lit
// l'annonce (`GET item_upload/items/{id}`), range un brouillon, puis SUPPRIME
// l'ancienne (`POST items/{id}/delete`) AVANT la mise en ligne — c'est l'ordre
// voulu par Julien (§3, « ne PAS remettre recréer puis supprimer »). Sur une
// annonce fermée par une vente, cette suppression vise une annonce vendue :
// refusée, le brouillon reste « en trop » et le message dirait « elle est
// toujours en ligne » (faux) ; acceptée, VRM aurait supprimé une annonce liée à
// une transaction. Et l'atelier n'accepte que des annonces EN LIGNE
// (`ACTIONS_SELECTION.recreer.etats`). Donc : « Remettre en vente » ouvre
// « Republier à la main » accompagné, depuis le COFFRE (`coffre_{uid}_{item}` :
// photos, titre, description, prix) ; rien ne part chez Vinted d'ici, et rien
// n'est promis que le moteur ne sait pas faire.
//
// Le N° : celui de la vente (par identité, `numeroDe`), repris sur la nouvelle
// annonce par la règle des republications (`repriseNumerosRecreation`,
// src/repriseNumero.js) quand SON tap désigne la nouvelle (« C'est celle-ci ») ;
// un ancien numéro (archive « B… », migration 013) ne se redonne jamais : la
// nouvelle en prendra un neuf. Sans N° : « paire pas reliée ».
//
// Règles PURES, exécutées par scripts/audit-annulees-chez-toi.cjs. Rien ici
// n'écrit, rien ne part : jamais automatique, toujours SON clic.
// ─────────────────────────────────────────────────────────────────────────────

export const VERDICT_MOTEUR = Object.freeze({
  moteur: 'main',
  raison: 'Le moteur Republier supprime toujours l’ancienne annonce avant de mettre la nouvelle en ligne ; une annonce fermée par une vente ne se supprime pas comme une annonce en ligne. VRM t’accompagne : tu publies toi-même, il remet le N°.',
});

const idAnnonce = (v) => (/^\d{4,15}$/.test(String(v == null ? '' : v)) ? String(v) : '');
const prixDe = (o) => { const v = Number(o && o.price && typeof o.price === 'object' ? o.price.amount : o && o.price); return Number.isFinite(v) && v > 0 ? v : null; };

// Où en est une remise en vente qu'il a commencée (`vrm_repub_main[item]`) :
//   'a-remettre' (rien de commencé) · 'en-cours' (Vinted ouvert, ou la nouvelle
//   désignée mais le N° pas encore dessus) · 'fait' (la nouvelle porte le N°, ou
//   désignée quand il n'y a pas de N° à reprendre).
export function etatRemise(suivi, { num = '', reprenable = null, numeros = null, cle = null } = {}) {
  if (!suivi || typeof suivi !== 'object') return 'a-remettre';
  if (!suivi.nouvelId) return 'en-cours';
  const ok = typeof reprenable === 'function' ? reprenable : (n) => !!String(n || '').trim();
  if (!String(num || '').trim() || !ok(num)) return 'fait';
  const k = typeof cle === 'function' ? cle : (n) => String(n == null ? '' : n).trim().toUpperCase();
  const e = numeros && numeros[String(suivi.nouvelId)];
  return e && k(e.numero) === k(num) ? 'fait' : 'en-cours';
}

// Les ventes annulées avant l'envoi dont la paire est chez lui, à remettre en vente.
//   ventes            : la liste Vinted (`sales.items`) ;
//   annuleeAvantEnvoi : (o) → true SEULEMENT si la transaction le PROUVE
//                       (`txnAnnuleeAvantEnvoi`) — « pas su » ne vaut pas « oui » ;
//   identite          : (o) → id de l'annonce (`identiteAnnonce` : transaction → item_id) ;
//   numeroDe          : (o) → N° de la vente, par identité (`effEntry(o).numero`) ;
//   ecarte            : (o) → vrai pour un compte exclu ;
//   presente          : (item) → vrai si l'annonce est de nouveau chez lui sur Vinted
//                       (en ligne, masquée, brouillon) — alors rien à remettre ;
//   reglees           : { [tx]: at } — « Déjà remise en vente » (SON clic) ;
//   suivis            : `vrm_repub_main` ; recrees : { nouvelId: ancienId } (extension) ;
//   numeros, reprenable, cle : pour juger qu'une remise est faite.
// Rend [{ tx, uid, item, titre, prix, photo, date, num, archive, sansNum, etat }]
// (jamais les remises faites), les plus récentes d'abord.
export function annuleesChezToi({ ventes, annuleeAvantEnvoi, identite, numeroDe, ecarte = null, presente = null, reglees = null,
  suivis = null, recrees = null, numeros = null, reprenable = null, cle = null } = {}) {
  if (!Array.isArray(ventes) || typeof annuleeAvantEnvoi !== 'function') return [];
  const ok = typeof reprenable === 'function' ? reprenable : (n) => !!String(n || '').trim();
  const dejaRecree = new Set(Object.values(recrees && typeof recrees === 'object' ? recrees : {}).map(String));
  const vus = new Set();
  const out = [];
  for (const o of ventes) {
    if (!o || o.transaction_id == null || o._fromEmail) continue;
    const tx = String(o.transaction_id);
    if (vus.has(tx)) continue; vus.add(tx);
    if (typeof ecarte === 'function' && ecarte(o)) continue;
    if (annuleeAvantEnvoi(o) !== true) continue;
    if (reglees && reglees[tx]) continue;
    const item = idAnnonce(typeof identite === 'function' ? identite(o) : '');
    if (item && typeof presente === 'function' && presente(item)) continue;
    if (item && dejaRecree.has(item)) continue;
    const num = String((typeof numeroDe === 'function' ? numeroDe(o) : '') || '').trim();
    const suivi = item && suivis ? suivis[item] : null;
    const etat = etatRemise(suivi, { num, reprenable: ok, numeros, cle });
    if (etat === 'fait') continue;
    const d = Date.parse(o.date || '');
    out.push({
      tx, uid: String((o._acc && o._acc.vinted_user_id) || ''), item, titre: String(o.title || ''), prix: prixDe(o),
      photo: o.photo && typeof o.photo === 'object' ? (o.photo.url || '') : (o.photo || ''), date: Number.isFinite(d) ? d : null,
      domain: (o._acc && o._acc.domain) || 'www.vinted.fr',
      num, archive: !!num && !ok(num), sansNum: !num, etat,
    });
  }
  return out.sort((a, b) => (b.date || 0) - (a.date || 0));
}

// La paire que « Remettre en vente » ouvre dans « Republier à la main ». Le N°
// suivi n'est que celui qui se REPREND (un numéro d'archive part vide : la
// nouvelle annonce en recevra un neuf, comme toute annonce).
export function paireARemettre(x, { reprenable = null } = {}) {
  if (!x || !x.item) return null;
  const ok = typeof reprenable === 'function' ? reprenable : (n) => !!String(n || '').trim();
  return {
    ancienId: x.item, uid: x.uid, num: x.num && ok(x.num) ? x.num : '', numAffiche: x.num || '', titre: x.titre, prix: x.prix,
    photo: x.photo, domain: x.domain || 'www.vinted.fr', annulee: true, tx: x.tx, archive: !!x.archive, sansNum: !!x.sansNum,
  };
}

// L'ancienne fiche que la reprise du N° lit, quand la vente porte le N° mais
// qu'aucune fiche n'existe sous l'annonce (N° posé sur la VENTE, `saleOv`) : la
// reprise (`repriseNumerosRecreation`) ne regarde que `numeros[ancienId]`. Rend
// { [ancienId]: { numero } } pour ces remises-là seulement (un N° d'archive jamais).
export function fichesAnciennesAnnulees(suivis, numeros, { reprenable = null } = {}) {
  const ok = typeof reprenable === 'function' ? reprenable : (n) => !!String(n || '').trim();
  const out = {};
  for (const [anc, s] of Object.entries(suivis && typeof suivis === 'object' ? suivis : {})) {
    if (!s || s.annulee !== true || !idAnnonce(anc)) continue;
    const num = String(s.num || '').trim();
    if (!num || !ok(num)) continue;
    const e = numeros && numeros[anc];
    if (e && String(e.numero || '').trim()) continue;
    out[anc] = { numero: num, title: s.titre || '', annuleeTx: s.tx || '' };
  }
  return out;
}

// La ligne de Ma journée, dite UNE fois (null s'il n'y a rien).
export function ligneJournee(liste) {
  const l = Array.isArray(liste) ? liste : [];
  if (!l.length) return null;
  const n = l.length, sans = l.filter((x) => x.sansNum).length, enCours = l.filter((x) => x.etat === 'en-cours').length;
  const court = `${n} vente${n > 1 ? 's' : ''} annulée${n > 1 ? 's' : ''} avant l’envoi`;
  const morceaux = [n > 1 ? 'Les paires sont chez toi : remets-les en vente' : 'La paire est chez toi : remets-la en vente'];
  if (enCours) morceaux.push(`${enCours} en cours`);
  if (sans) morceaux.push(`${sans} paire${sans > 1 ? 's' : ''} pas reliée${sans > 1 ? 's' : ''}`);
  return { n, court, detail: morceaux.join(' · '), photos: l.map((x) => x.photo).filter(Boolean) };
}
