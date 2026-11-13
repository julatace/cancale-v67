// ════════════════════════════════════════════════════════════════════════════
// LE PARRAINAGE, CLAIR ET VISIBLE (13 nov., lot 54)
// « Parraine un vendeur : 1 mois offert pour toi et pour lui. »
// ════════════════════════════════════════════════════════════════════════════
// Ce fichier ne DÉCIDE rien : la règle (qui est filleul, quand le mois part,
// l'anti-abus) est au serveur (api/_lib/parrainage.js) et dans les CGV
// (article 2 bis). Ici : les MOTS d'un état rendu par la route, le total de
// mois gagnés, et ce que l'app sait de l'ouverture du programme (pour la ligne
// du menu « Plus »).
//   · L'état de chaque filleul arrive SANS identité (rang, jour d'inscription,
//     état) : l'écran n'écrit jamais qui.
//   · « Offert par <nom> » : le nom CHOISI par le parrain (jamais un pseudo
//     Vinted, revalidé par le serveur à chaque lecture), sinon « un vendeur VRM ».
// Trois états partout : `undefined` en cours · `null` pas su · la valeur lue.
// ════════════════════════════════════════════════════════════════════════════

export const PHRASE_PARRAINAGE = 'Parraine un vendeur : 1 mois offert pour toi et pour lui';
export const TEXTE_PARTAGE = 'Je t’offre 1 mois de VRM, l’outil qui gère mes ventes. Inscris-toi avec mon lien : on gagne chacun un mois à ton premier paiement.';

// Les états rendus par la route (`etatsFilleuls`) : un mot court (à droite) et sa phrase (dessous).
export const ETATS_FILLEUL = {
  inscrit: { court: 'Inscrit', detail: 'pas encore payé son 1er mois' },
  paye: { court: 'A payé', detail: 'a payé son 1er mois · ton mois arrive' },
  'attente-toi': { court: 'A payé', detail: 'a payé · ton mois t’attend (ton 1er paiement)' },
  offert: { court: 'Mois offert', detail: 'a payé son 1er mois' },
  plafond: { court: 'A payé', detail: 'a payé · plafond de 12 mois atteint' },
  refuse: { court: 'Pas retenu', detail: 'règle anti-abus' },
};
export function texteEtatFilleul(etat) {
  return ETATS_FILLEUL[etat] || ETATS_FILLEUL.inscrit;
}

// « 12 nov. » (heure de Paris, jamais d'heure : on ne date pas une personne à la minute).
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function jourCourt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return `${Number(m[3])} ${MOIS[Number(m[2]) - 1] || ''}`.trim();
}

// Le total de mois GAGNÉS : ceux crédités comme parrain + le sien comme filleul.
// `null` quand le suivi n'est pas lu (jamais un 0 deviné).
export function moisGagnes(p) {
  if (!p || !p.suivi || !Number.isFinite(p.suivi.moisOfferts)) return null;
  return p.suivi.moisOfferts + (p.filleul && p.filleul.moisOffert ? 1 : 0);
}

// « Offert par … » côté filleul : le nom choisi, ou « un vendeur VRM ».
export const offertPar = (nom) => (typeof nom === 'string' && nom.trim() ? nom.trim() : '');

// ── LE PROGRAMME EST-IL OUVERT ? (pour la ligne du menu « Plus ») ─────────────
// Lu UNE fois par la route publique (`?mode=parrainage&code=`, sans rien créer) ;
// jusqu'à la réponse, et si elle ne vient pas, la ligne n'est pas montrée.
let OUVERT = undefined;
const abonnes = new Set();
export const parrainageOuvertConnu = () => OUVERT;
export function poserParrainageOuvert(v) {
  const n = v === true ? true : v === false ? false : null;
  if (n === OUVERT) return;
  OUVERT = n;
  for (const f of abonnes) { try { f(n); } catch (_) {} }
}
export function suivreParrainageOuvert(f) { abonnes.add(f); return () => abonnes.delete(f); }
let enCours = null;
export function lireParrainageOuvert(fetcher = (typeof fetch === 'function' ? fetch : null)) {
  if (OUVERT !== undefined || enCours || !fetcher) return enCours || Promise.resolve(OUVERT);
  enCours = Promise.resolve().then(() => fetcher('/api/compte?mode=parrainage&code=', { cache: 'no-store' }))
    .then(async (r) => { const j = r && r.ok ? await r.json().catch(() => null) : null; poserParrainageOuvert(j && j.ok ? j.ouvert : null); return OUVERT; })
    .catch(() => { poserParrainageOuvert(null); return null; })
    .finally(() => { enCours = null; });
  return enCours;
}

// ── CE QUE VOIT LA PERSONNE QUI OUVRE LE LIEN (sans session) ─────────────────
// { ouvert, connu, nom } · `null` pas su.
export async function lireApercuParrain(code, fetcher = (typeof fetch === 'function' ? fetch : null)) {
  if (!fetcher || !/^[A-HJ-NP-Z2-9]{8}$/.test(String(code || ''))) return null;
  try {
    const r = await fetcher('/api/compte?mode=parrainage&code=' + encodeURIComponent(code), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? { ouvert: j.ouvert === true, connu: j.connu === true, nom: offertPar(j.nom) || null } : null;
  } catch (_) { return null; }
}

// ── ALLER AU PARRAINAGE (menu « Plus », `?tab=parrainage`) ───────────────────
// Réglages → Mon abonnement, et le groupe « Parrainage » amené à l'écran.
export const CLE_DEMANDE_PARRAINAGE = 'vrm_voir_parrainage';
export function demanderParrainage() {
  try { localStorage.setItem('vrm_reglages_vue', 'abonnement'); } catch (_) {}
  try { sessionStorage.setItem(CLE_DEMANDE_PARRAINAGE, '1'); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('vrm:voir-abonnement')); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('vrm:voir-parrainage')); } catch (_) {}
}
export function prendreDemandeParrainage() {
  try { const v = sessionStorage.getItem(CLE_DEMANDE_PARRAINAGE) === '1'; sessionStorage.removeItem(CLE_DEMANDE_PARRAINAGE); return v; } catch (_) { return false; }
}
