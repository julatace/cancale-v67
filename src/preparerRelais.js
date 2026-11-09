// ════════════════════════════════════════════════════════════════════════════
//  « PRÉPARER MES COLIS » PAS À PAS ET MODE RELAIS (9 nov., lot AD, propositions
//  46 et 48 validées par Julien : « fais tout »).
//
//  ⚠️ CE MODULE NE DÉCIDE RIEN QUE L'APP N'AIT DÉJÀ DÉCIDÉ (§11) :
//   · Préparer : la liste et son ORDRE sont ceux de Colis → « À envoyer »
//     (`colisAEnvoyerRanges` : le plus pressé d'abord, rangés par transporteur) —
//     jamais triés par emplacement (refus du 11 octobre). La paire montrée est
//     celle de la VENTE par son n° de transaction (§5) ; l'appelant dit si elle
//     est sûre (`paire: 'sure' | 'a-verifier'`), ce module ne devine rien.
//   · Mode relais : la liste est EXACTEMENT celle que l'écran publie dans
//     `vrm_colis_retirer` (`pickupUnion.emailList` + `pickupUnion.extra`) ;
//     l'identité de chaque colis est celle de la publication (`e:{n°}`,
//     `v:{compte}:{tx}`, `k:{clé}`). Jamais les « comptés avec », jamais les finis.
//   · Les écritures (« Colis fait », « Retiré ») sont celles des cartes, passées
//     par l'appelant. Ici : l'ordre d'une séance et sa mémoire sur l'appareil.
//  Module PUR (sauf la mémoire de séance, sur l'appareil) : l'écran et le banc
//  `preparer-relais.cjs` lisent les mêmes fonctions.
// ════════════════════════════════════════════════════════════════════════════

// L'ordre d'une séance : celui de la liste à l'ouverture ; un colis qui arrive
// pendant la séance s'ajoute À LA FIN (rien ne saute de place sous ses yeux). Un
// colis sorti (fait, retiré, parti) reste à sa place : la séance le montre fait.
export function ordreDeSeance(ordrePrecedent, cles) {
  const ordre = Array.isArray(ordrePrecedent) ? ordrePrecedent.filter((k) => typeof k === 'string' && k) : [];
  const vu = new Set(ordre);
  for (const k of (Array.isArray(cles) ? cles : [])) if (k && !vu.has(k)) { ordre.push(String(k)); vu.add(String(k)); }
  return ordre;
}

// Où reprendre : la place du colis où il en était s'il est encore dans l'ordre,
// sinon le premier colis pas encore fait, sinon le début.
export function indexDeReprise(ordre, cleCourante, faits) {
  const L = Array.isArray(ordre) ? ordre : [];
  const i = cleCourante ? L.indexOf(cleCourante) : -1;
  if (i >= 0) return i;
  const j = L.findIndex((k) => !(faits && faits[k]));
  return j >= 0 ? j : 0;
}

// La progression « 3 sur 18 » : la place du colis montré (1-indexée) sur le
// nombre de colis de la séance ; `faits` = combien sont notés faits pendant elle.
export function progression(ordre, index, faits) {
  const n = Array.isArray(ordre) ? ordre.length : 0;
  const nFaits = (Array.isArray(ordre) ? ordre : []).filter((k) => faits && faits[k]).length;
  return { position: n ? Math.min(n, Math.max(1, index + 1)) : 0, total: n, faits: nFaits };
}

// ── MODE RELAIS : l'ordre au comptoir ─────────────────────────────────────────
// Les colis d'un même point se suivent (on est à UN comptoir), les points dans
// l'ordre de leur premier colis ; dans un point, l'ordre reçu (le plus pressé
// d'abord, celui de la colonne). Aucun colis n'est écarté ni ajouté.
export function ordreRelais(colis) {
  const L = Array.isArray(colis) ? colis.filter(Boolean) : [];
  const rang = new Map();
  L.forEach((c) => { const p = cleDuPoint(c); if (!rang.has(p)) rang.set(p, rang.size); });
  return L.map((c, i) => ({ c, i })).sort((a, b) => (rang.get(cleDuPoint(a.c)) - rang.get(cleDuPoint(b.c))) || (a.i - b.i)).map((x) => x.c);
}
export const cleDuPoint = (c) => String((c && c.lieu) || '').trim().toLowerCase() || '—';

// Les points de la séance (pour choisir « ce comptoir ») : [{ cle, nom, n }].
export function pointsDeSeance(colis) {
  const out = []; const par = new Map();
  for (const c of (Array.isArray(colis) ? colis : [])) {
    const k = cleDuPoint(c);
    if (!par.has(k)) { const p = { cle: k, nom: (c && c.lieu) || 'Point pas encore connu', n: 0 }; par.set(k, p); out.push(p); }
    par.get(k).n++;
  }
  return out;
}

// Le sens d'un glissement horizontal sur la carte du code : -1 (suivant, vers la
// gauche), 1 (précédent), 0 (pas un glissement : trop court, ou plutôt vertical).
export function sensGlisse(dx, dy, seuil = 56) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < seuil || Math.abs(dx) < Math.abs(dy) * 1.3) return 0;
  return dx < 0 ? -1 : 1;
}

// ── LA MÉMOIRE D'UNE SÉANCE « PRÉPARER », SUR L'APPAREIL ──────────────────────
// Une feuille fermée (retour, appel entrant, « Fermer » au milieu) se rouvre là
// où il en était. Rien ne part dans le nuage : ce n'est pas une donnée, c'est le
// fil d'une séance. Par compte VRM (uid) ; oubliée après 12 h.
export const CLE_SEANCE_PREPARER = 'vrm_preparer_seance';
const DUREE_SEANCE = 12 * 3600e3;
const cleStockage = (uid) => CLE_SEANCE_PREPARER + (uid ? '_' + String(uid) : '');
export function lireSeancePreparer(uid, maintenant = Date.now()) {
  const vide = { debut: maintenant, ordre: [], cle: '', faits: {}, memo: {} };
  try {
    const s = JSON.parse(localStorage.getItem(cleStockage(uid)) || 'null');
    if (!s || typeof s !== 'object' || !Number.isFinite(s.debut) || maintenant - s.debut > DUREE_SEANCE) return vide;
    return { debut: s.debut, ordre: Array.isArray(s.ordre) ? s.ordre.filter((k) => typeof k === 'string') : [], cle: typeof s.cle === 'string' ? s.cle : '', faits: s.faits && typeof s.faits === 'object' ? s.faits : {}, memo: s.memo && typeof s.memo === 'object' ? s.memo : {} };
  } catch (_) { return vide; }
}
export function ecrireSeancePreparer(uid, s) { try { localStorage.setItem(cleStockage(uid), JSON.stringify(s)); } catch (_) {} }
export function oublierSeancePreparer(uid) { try { localStorage.removeItem(cleStockage(uid)); } catch (_) {} }
