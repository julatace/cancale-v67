// ═══════════════════════════════════════════════════════════════════════════
// LE MODE VACANCES — LA RÈGLE (10 nov., lot O, extension 5.338)
// ═══════════════════════════════════════════════════════════════════════════
// Proposition 16, validée par Julien : « mode vacances sur tous les comptes en
// un clic, puis retour en un clic » — SON clic, compte par compte, dans les
// 50 actions/h. La forme (Paramètres → Mes comptes → Mode vacances) :
// src/ModeVacances.jsx. Le geste : `mettreVacancesVinted` (background.js).
//
// L'ÉTAT D'UN COMPTE, trois états, jamais deux : true (en vacances) · false
// (ouvert) · null (« — », pas su). Deux sources LUES, la plus fraîche gagne :
//   · le profil `users/current` que l'extension range (`harvest_{uid}_profile`),
//     champ `user.is_on_holiday` — MESURÉ sur sa base le 10 nov. (booléen) ;
//   · `vinted_vacances_etat` : l'état relu par l'extension juste après un geste
//     (le sien sur vinted.fr, ou celui de VRM).
// Rien n'est déduit d'une absence : pas de profil, pas de champ ⇒ « — ».
//
// LE GESTE se joue compte par compte, et SEULEMENT pour le compte connecté dans
// l'onglet vinted.fr (l'extension refuse tout autre : `gardeStricte`). Un autre
// compte ⇒ « Ouvre vinted.fr sur ce compte ». Un sens jamais appris (VRM n'a
// jamais vu le geste de Vinted) ⇒ « Fais-le une fois à la main ».
// ═══════════════════════════════════════════════════════════════════════════

export const LIGNE_ETAT_VACANCES = 'vinted_vacances_etat';
export const LIGNE_RECETTE_VACANCES = 'vinted_vacances_recette';
// Projections (jamais `select=data`) : le champ du profil, sa date de capture.
export const SELECT_PROFIL_VACANCES = 'id,h:data->payload->user->is_on_holiday,at:data->>capturedAt';
export const SELECT_ETAT_VACANCES = 'c:data->comptes';
export const SELECT_RECETTE_VACANCES = 'on:data->recettes->on->>chemin,off:data->recettes->off->>chemin,dernier:data->dernier';

// Les sites où VRM ne sait pas (encore) poser le mode vacances : un lien, rien d'autre.
export const AUTRES_SITES_VACANCES = [
  { id: 'leboncoin', nom: 'Leboncoin', url: 'https://www.leboncoin.fr/' },
  { id: 'ebay', nom: 'eBay', url: 'https://www.ebay.fr/' },
  { id: 'vestiaire', nom: 'Vestiaire Collective', url: 'https://fr.vestiairecollective.com/' },
];

const ms = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };

// L'état d'UN compte : le plus frais des deux. `profil` = { h, at } (ligne projetée)
// ou undefined/null ; `etat` = { vacances, at, via } ou undefined/null.
export function etatVacances(profil, etat) {
  const p = profil && typeof profil.h === 'boolean' ? { vacances: profil.h, at: ms(profil.at), source: 'profil' } : null;
  const e = etat && typeof etat.vacances === 'boolean' ? { vacances: etat.vacances, at: ms(etat.at), source: etat.via === 'geste' ? 'geste' : 'relu' } : null;
  if (p && e) return e.at >= p.at ? e : p;
  return e || p || { vacances: null, at: 0, source: '' };
}

// Une ligne par compte Vinted. `profils` : tableau de lignes projetées (ou
// undefined en lecture, null lecture ratée) ; `etats` : objet { uid: … } (idem).
// `onglet` : l'uid du compte ouvert dans vinted.fr (undefined pas su, null aucun).
export function lignesVacances({ comptes = [], profils, etats, onglet, noms = {} } = {}) {
  const parUid = {};
  if (Array.isArray(profils)) for (const r of profils) { const m = /^harvest_(\d{1,20})_profile$/.exec(String((r && r.id) || '')); if (m) parUid[m[1]] = r; }
  return (comptes || []).map((a) => {
    const uid = String((a && a.vinted_user_id) || '');
    const nom = noms[uid] || (a && a.login) || `Compte ${uid}`;
    const lu = (profils === null && etats === null) ? { vacances: null, at: 0, source: '' }
      : etatVacances(parUid[uid] || null, etats && typeof etats === 'object' ? etats[uid] : null);
    return { uid, nom, ...lu, onglet: onglet != null && String(onglet) === uid };
  }).filter((l) => /^\d{1,20}$/.test(l.uid));
}

// Ce que VRM a appris : true (sait) · false (jamais vu) · null (pas su).
export function recetteSait(recette, voulu) {
  if (recette === undefined || recette === null) return null;
  const c = voulu ? recette.on : recette.off;
  return typeof c === 'string' && c.length > 0;
}

// Que faire pour CETTE ligne quand il demande « voulu » (true = vacances) ?
//   'fait'      — l'état LU est déjà celui voulu (rien à envoyer) ;
//   'envoyer'   — c'est le compte de l'onglet, VRM sait le faire ;
//   'apprendre' — compte de l'onglet, mais ce sens n'a jamais été vu ;
//   'ouvrir'    — un autre compte : « Ouvre vinted.fr sur ce compte » ;
//   'passu'     — on ne sait pas quel compte est ouvert (ou ce que VRM a appris).
export function actionVacances(l, { voulu, onglet, sait }) {
  if (l.vacances === voulu) return 'fait';
  if (onglet === undefined) return 'passu';
  if (!onglet || String(onglet) !== l.uid) return 'ouvrir';
  if (sait === null) return 'passu';
  return sait ? 'envoyer' : 'apprendre';
}

// Le plan d'un clic : au plus UN compte part (celui de l'onglet).
export function planVacances(lignes, { voulu, onglet, sait }) {
  const actions = lignes.map((l) => ({ uid: l.uid, action: actionVacances(l, { voulu, onglet, sait }) }));
  const envoyer = actions.find((a) => a.action === 'envoyer');
  return {
    actions,
    envoyer: envoyer ? envoyer.uid : null,
    restent: actions.filter((a) => a.action !== 'fait').length,
    tous: lignes.length > 0 && actions.every((a) => a.action === 'fait'),
  };
}

// La réponse de l'extension, en une issue. « fait » seulement avec un état RELU
// égal au voulu ; « incertain » n'affiche aucun état (jamais l'état voulu).
export function issueVacances(r, voulu) {
  if (!r) return { etat: 'refus', vacances: null, raison: 'Pas de réponse de l’extension' };
  if (r.sansReponse) return { etat: 'incertain', vacances: null, raison: 'L’extension n’a pas répondu à temps : regarde ton profil Vinted' };
  if (r.accepte === false) return { etat: r.code === 'pas-appris' ? 'apprendre' : 'refus', vacances: null, raison: r.raison || 'Rien n’est parti' };
  const v = typeof r.vacances === 'boolean' ? r.vacances : null;
  if ((r.etape === 'fait' || r.etape === 'deja') && v === voulu) return { etat: r.etape, vacances: v, raison: '' };
  if (r.etape === 'ecart' && v !== null) return { etat: 'ecart', vacances: v, raison: r.raison || 'Vinted montre un autre état' };
  if (r.etape === 'echec') return { etat: 'echec', vacances: v, raison: r.raison || 'Vinted a refusé' };
  return { etat: 'incertain', vacances: null, raison: r.raison || 'Envoyé, pas relu : regarde ton profil Vinted' };
}

// « il y a 3 h » — l'âge d'une lecture (rien si inconnue).
export function ageLu(at, maintenant = Date.now()) {
  if (!(at > 0)) return '';
  const m = Math.max(0, Math.round((maintenant - at) / 60000));
  if (m < 2) return 'lu à l’instant';
  if (m < 60) return `lu il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `lu il y a ${h} h`;
  return `lu il y a ${Math.round(h / 24)} j`;
}
