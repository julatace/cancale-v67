// ════════════════════════════════════════════════════════════════════════════
//  « CE MATIN » — LA LISTE ORDONNÉE DE CE QUI ATTEND (27 nov. 2026, lot scan-ce-matin) — LA RÈGLE, PURE
//  Julien (27 nov.) : en tête d'Aujourd'hui, ce qui m'attend ce matin, DANS CET ORDRE :
//    1. les acheteurs qui attendent MA réponse (conversations captées, sans réponse d'abord) ;
//    2. les bordereaux à imprimer ;
//    3. les colis à retirer, avec l'heure de fermeture du point ;
//    4. les offres à trancher ;
//    5. les comptes qui demandent une vérification.
//  Chaque ligne ouvre LE geste exact ; liste vide ⇒ « Rien d'urgent ». Aucune carte qui gronde (§2.10) : une ligne
//  n'existe que s'il y a quelque chose, et elle s'en va avec.
//
//  ⚠️ AUCUN CHIFFRE CALCULÉ ICI (§5, un seul propriétaire) : chaque nombre arrive déjà compté par SON propriétaire
//  (la case « Messages » d'Aujourd'hui, les bordereaux prêts de « À envoyer », `vrm_colis_retirer`, « offres sans
//  réponse », la règle de santé des comptes `comptesEnVerification`). Ce module les RANGE et dit ce qui n'est pas su.
//  Trois états par source : undefined (on lit) · null (pas su) · { n, ouvrir, ferme? }.
//  « Pas su » n'est jamais « rien » : une liste vide AVEC une source pas lue ne dit pas « Rien d'urgent ».
// ════════════════════════════════════════════════════════════════════════════
export const ORDRE_CE_MATIN = Object.freeze(['messages', 'bordereaux', 'retraits', 'offres', 'verifications']);
const HEURE = /^([01]\d|2[0-4]):[0-5]\d$/;

// `sources` : { messages, bordereaux, retraits, offres, verifications } ; `lecture` : l'écran lit encore (ses sources
// arrivent) — une source encore undefined après la lecture compte comme « pas sue ».
// Rend { etat: 'lecture' | 'liste' | 'rien' | 'passu', lignes: [{ cle, n, ferme, ouvrir }], pasSu: [cle] }.
export function lignesCeMatin(sources = {}, { lecture = false } = {}) {
  const S = sources && typeof sources === 'object' ? sources : {};
  const lignes = [], pasSu = [];
  let enCours = false;
  for (const cle of ORDRE_CE_MATIN) {
    const x = S[cle];
    if (x === undefined) { if (lecture) enCours = true; else pasSu.push(cle); continue; }
    if (x === null || typeof x !== 'object' || !Number.isFinite(Number(x.n)) || Number(x.n) < 0) { pasSu.push(cle); continue; }
    const n = Math.floor(Number(x.n));
    if (n === 0) continue;
    lignes.push({ cle, n, ferme: cle === 'retraits' && HEURE.test(String(x.ferme || '')) ? String(x.ferme) : '', ouvrir: typeof x.ouvrir === 'function' ? x.ouvrir : null });
  }
  const etat = lignes.length ? 'liste' : enCours ? 'lecture' : pasSu.length ? 'passu' : 'rien';
  return { etat, lignes, pasSu };
}

// L'heure de fermeture du point ce jour, d'après `etatOuverture` (api/_lib/horaires-relais.js) : « HH:MM » quand le
// point est OUVERT maintenant et ferme plus tard ; sinon '' (fermé, 24 h/24, horaires pas lus : rien n'est promis).
export function fermeDuPoint(etat) {
  return etat && etat.ouvert && etat.fermeA && HEURE.test(String(etat.fermeA)) ? String(etat.fermeA) : '';
}
