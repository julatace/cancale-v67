// ── « EN LIGNE » SUR LEBONCOIN : LA RÈGLE DE VINTED, APPLIQUÉE À LEBONCOIN ─────
// (6 nov. 2026) Julien : « les annonces qui sont captées ne sont plus en ligne,
// il faut absolument que tu améliores ça ».
//
// MESURÉ (sa base, lecture seule, 6 nov.) : VRM disait 8 annonces Leboncoin
// « Actives » ; la dernière capture de ses annonces datait du 30 oct., la
// moitié n'avaient pas été revues depuis le 20 sept., et AUCUNE lecture
// complète de « Mes annonces » n'avait jamais été rangée (`lbc_listings.lectures`
// absent). La seule chose qui faisait foi était le dernier `status` capté —
// « active » pour toujours, même sept semaines plus tard.
//
// LA RÈGLE (la même que Vinted, <enligne-regle>, §5) :
//   · une annonce que la règle partagée `<lbc-en-vente-regle>` (App.jsx, copiée
//     dans l'extension et le serveur) ne dit plus en vente — état mort, vendue
//     (preuve), plus vue dans une liste complète (`plusVueAt`), en pause depuis
//     VRM — n'est PAS en ligne (`sortie`) ;
//   · la lecture COMPLÈTE la plus récente de « Mes annonces » de SON compte fait
//     foi (`lbc_listings.lectures[compte] = { at, total, n, ids? }`, posée par
//     l'extension quand toutes les pages ont été lues, filtrées sur ce seul
//     vendeur) : une annonce ABSENTE de cette lecture n'est plus en ligne (si la
//     lecture porte ses `ids` ; sinon c'est l'extension qui l'a déjà marquée
//     `plusVueAt`), sauf si une capture l'a revue APRÈS (la donnée la plus
//     récente gagne : publiée depuis) ;
//   · cette lecture a moins de 24 h ⇒ « en ligne ». Plus vieille, ou jamais
//     faite ⇒ « à confirmer » : ni en ligne, ni partie — hors des totaux, rien
//     supprimé, dit avec LE geste (« ouvre Mes annonces sur leboncoin.fr »).
//     « Pas su » ne vaut pas « oui » (§5).
//   · une lecture PARTIELLE (une page, un total pas atteint) n'est pas une
//     lecture complète : elle n'efface rien et ne rafraîchit rien.
//   · l'e-mail « Suppression de vos annonces » ne porte AUCUNE identité
//     (mesuré, api/_lib/lbc-suppression.js) : il ne retire rien ici (§5 : le
//     titre n'est pas une identité) ; il dit le geste qui apporte la lecture.
//
// ⚠️ « À confirmer » reste du côté SÛR pour l'anti double vente : la règle
//    partagée `annonceLbcEnVente` (alertes « à retirer de Leboncoin », file à
//    publier, Ma journée) n'est PAS changée — une annonce à confirmer peut
//    encore être en ligne, l'alerte reste. Cette règle-ci décide ce qu'on
//    COMPTE et ce qu'on AFFICHE « en ligne ».
//
// Module PUR : aucun accès au navigateur ni à la base. L'écran Leboncoin, le
// catalogue « Mes annonces », le Stock (`lireLbcEnVente`) et
// `scripts/audit-lbc-en-ligne.cjs` exécutent les MÊMES fonctions (§11).

export const LBC_FRAIS_MS = 24 * 3600e3;
export const LIEN_MES_ANNONCES_LBC = 'https://www.leboncoin.fr/compte/part/mes-annonces';

// « 8442… » et « lbc-account:8442… » sont UN compte.
export const idCompteLbcPur = (x) => String(x == null ? '' : x).replace(/^lbc-account:/i, '');

// La lecture complète la plus récente de CE compte, ou null (jamais lue ou
// illisible). Une lecture qui se dit partielle (n < total) n'en est pas une.
export function lectureCompleteLbc(lectures, compte) {
  const id = idCompteLbcPur(compte);
  if (!id || !lectures || typeof lectures !== 'object') return null;
  let best = null;
  for (const k of [id, 'lbc-account:' + id]) {
    const l = lectures[k];
    if (!l || typeof l !== 'object') continue;
    const at = Date.parse(String(l.at || ''));
    if (!Number.isFinite(at)) continue;
    const total = Number(l.total), n = Number(l.n);
    if (Number.isFinite(total) && Number.isFinite(n) && n < total) continue;
    const ids = Array.isArray(l.ids) && (!Number.isFinite(total) || l.ids.length === total) ? new Set(l.ids.map(String)) : null;
    if (!best || at > best.at) best = { at, total: Number.isFinite(total) ? total : null, ids };
  }
  return best;
}

// L'état « en ligne » d'UNE annonce.
//   ctx.enVente(ad)   : la règle partagée `<lbc-en-vente-regle>` (App.jsx)
//   ctx.lectures      : `lbc_listings.lectures` (objet ; absent = jamais lue)
//   ctx.maintenant    : ms
// Rend { etat: 'enligne' | 'aconfirmer' | 'sortie', compte, lu (ms|null),
//        raison: null | 'jamais' | 'vieille' | 'absente' | 'regle' }.
export function etatEnLigneLbc(ad, { enVente, lectures = null, maintenant = Date.now() } = {}) {
  const compte = idCompteLbcPur(ad && (ad.account || ad.lbcUser));
  if (!ad || ad.id == null) return { etat: 'sortie', compte, lu: null, raison: 'regle' };
  if (typeof enVente !== 'function' || !enVente(ad)) return { etat: 'sortie', compte, lu: null, raison: 'regle' };
  const L = lectureCompleteLbc(lectures, compte);
  if (!L) return { etat: 'aconfirmer', compte, lu: null, raison: 'jamais' };
  const vu = Date.parse(String(ad.seenAt || ''));
  const revueApres = Number.isFinite(vu) && vu > L.at;
  if (L.ids && !L.ids.has(String(ad.id)) && !revueApres) return { etat: 'sortie', compte, lu: L.at, raison: 'absente' };
  if (!(Number(maintenant) - L.at <= LBC_FRAIS_MS)) return { etat: 'aconfirmer', compte, lu: L.at, raison: 'vieille' };
  return { etat: 'enligne', compte, lu: L.at, raison: null };
}

// Toutes les annonces d'un coup : en ligne, à confirmer (avec, par compte, la
// date de sa dernière lecture complète — `null` = jamais), sorties.
export function bilanEnLigneLbc(ads, ctx = {}) {
  const enLigne = [], aConfirmer = [], sorties = [];
  const parCompte = new Map();
  const etats = new Map();
  for (const ad of Array.isArray(ads) ? ads : Object.values(ads || {})) {
    if (!ad || ad.id == null) continue;
    const e = etatEnLigneLbc(ad, ctx);
    etats.set(String(ad.id), e);
    if (e.etat === 'enligne') enLigne.push(ad);
    else if (e.etat === 'aconfirmer') {
      aConfirmer.push(ad);
      const c = parCompte.get(e.compte) || { compte: e.compte, lu: e.lu, n: 0 };
      c.n += 1;
      parCompte.set(e.compte, c);
    } else sorties.push(ad);
  }
  return { enLigne, aConfirmer, sorties, comptes: [...parCompte.values()], etats };
}

// « jamais lue en entier » · « lue il y a 7 j » · « lue il y a 30 h » — la
// phrase qui explique « à confirmer » vient de la même source que lui (§5).
export function quandLectureLbc(lu, maintenant = Date.now()) {
  if (!Number.isFinite(lu)) return 'jamais lue en entier';
  const h = (Number(maintenant) - lu) / 3600e3;
  return h < 48 ? `lue en entier il y a ${Math.max(1, Math.round(h))} h` : `lue en entier il y a ${Math.round(h / 24)} j`;
}
