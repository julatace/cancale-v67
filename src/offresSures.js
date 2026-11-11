// ════════════════════════════════════════════════════════════════════════════
//  OFFRES AUTOMATIQUES « SÛRES » — l'écran et l'anti-blocage (11 nov., lot DJ8)
// ════════════════════════════════════════════════════════════════════════════
// Julien (11 nov.) : « Pour les offres automatiques je pense que tu peux faire
// mieux. Tu peux regarder comment ne jamais te faire ban stp. »
//
// Module PUR (rien lu, rien écrit, rien envoyé) : scripts/audit-offres-sures.cjs
// l'EXÉCUTE, et compare `decisionMoteur` au VRAI moteur de l'extension
// (`autoAccepterOffres`, background.js, exécuté dans un vm) sur une table de cas.
//
// Les règles du moteur NE CHANGENT PAS ici (décisions de Julien, CLAUDE.md §3) :
// éteint par défaut, offre ≥ « Accepter dès » ⇒ acceptée 3 à 20 min après (tiré
// au hasard), < « Refuser sous » ⇒ refusée, entre les deux ⇒ à lui ; garde des
// autres plateformes ; 3 offres par visite ; 50 actions/h, réserve 5.
// Ce fichier DIT ce que le moteur ferait, sans rien lui ajouter.
import { gardeRefuse } from './offresGarde.js';

export const DELAI_OFFRE_MIN = 3;          // minutes — copie des bornes du moteur (DELAI_OFFRE_MIN_MS)
export const DELAI_OFFRE_MAX = 20;         // minutes — (DELAI_OFFRE_MAX_MS)
export const OFFRES_PAR_VISITE = 3;        // OFFRES_MAX_PAR_VISITE
export const PLAFOND_PROCHE = 40;          // une alerte AVANT l'arrêt de l'app à 45 (jamais un nouveau plafond)
export const CALME_MS = 24 * 3600 * 1000;  // une « journée calme » conseillée après un frein de Vinted

// ── LES SEUILS, TELS QUE LE MOTEUR LES LIT ──────────────────────────────────
// L'extension lit `Number(fiche.min)` (offreAutoReglages) : « 45,5 » vaut NaN
// pour elle — le mini est IGNORÉ, alors que l'écran l'affichait « 45,50 € ».
// Mesuré le 11 nov. dans le code : la carte d'annonce écrivait la saisie brute
// (`updatePair(item,{min:v})`, clavier décimal français = virgule).
export function seuilMoteur(v) {
  if (v == null || typeof v === 'object' || typeof v === 'boolean') return null;
  if (typeof v === 'string' && !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// Ce que l'écran lisait (virgule acceptée) : sert seulement à repérer l'écart.
export function seuilEcran(v) {
  if (v == null || typeof v === 'object' || typeof v === 'boolean') return null;
  const s = String(v).replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// L'écriture d'un seuil tapé : « 45,5 € » ⇒ « 45.5 » (lisible par le moteur ET
// par l'écran). Vide ⇒ ''. Illisible ⇒ la saisie telle quelle (dite « — »
// partout : jamais un nombre inventé).
export function montantSeuil(v) {
  const brut = v == null ? '' : String(v).trim();
  if (!brut) return '';
  const n = seuilEcran(brut);
  if (n == null) return brut;
  return String(Math.round(n * 100) / 100);
}
// Les fiches dont un seuil s'AFFICHE mais que le moteur ne lit pas.
export function seuilsIllisibles(numeros) {
  const out = [];
  for (const [id, f] of Object.entries(numeros || {})) {
    if (!f || typeof f !== 'object') continue;
    for (const champ of ['min', 'refuse']) {
      if (seuilEcran(f[champ]) != null && seuilMoteur(f[champ]) == null) out.push({ id: String(id), champ, valeur: String(f[champ]) });
    }
  }
  return out;
}

// ── CE QUE LE MOTEUR FERAIT D'UNE OFFRE ─────────────────────────────────────
// offre : { prix, item } (item = identifiant d'annonce, jamais un titre) ;
// fiche : `vinted_annonce_numeros[item]` ; garde : `vinted_offres_garde`.
// Rend { quoi, raison } :
//   'accepter'  — ≥ mini, garde sûre : acceptée 3 à 20 min après que VRM l'a vue ;
//   'garde'     — ≥ mini, mais la garde dit non (vendue ailleurs, pas vérifiée) ;
//   'refuser'   — sous « Refuser sous » ;
//   'toi'       — entre les deux : c'est lui qui négocie ;
//   'sans'      — aucune règle sur cette annonce (ou annonce pas identifiée).
// L'ordre est celui du moteur : l'acceptation passe avant le refus.
export function decisionMoteur(offre, fiche, garde, maintenant = Date.now()) {
  const prix = Number(offre && offre.prix);
  const item = offre && offre.item != null && offre.item !== '' ? String(offre.item) : null;
  if (!item || !Number.isFinite(prix) || prix <= 0) return { quoi: 'sans', raison: 'annonce' };
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const min = seuilMoteur(f.min), refuse = seuilMoteur(f.refuse);
  if (min != null && prix >= min) {
    const r = gardeRefuse(garde, item, maintenant);
    return r ? { quoi: 'garde', raison: r, min } : { quoi: 'accepter', raison: '', min };
  }
  if (refuse != null && prix < refuse) return { quoi: 'refuser', raison: '', refuse };
  if (min == null && refuse == null) return { quoi: 'sans', raison: seuilEcran(f.min) != null || seuilEcran(f.refuse) != null ? 'illisible' : 'aucune' };
  return { quoi: 'toi', raison: '', min, refuse };
}
export const LIBELLE_DECISION = {
  accepter: `Acceptée ${DELAI_OFFRE_MIN} à ${DELAI_OFFRE_MAX} min après`,
  garde: 'Pas acceptée',
  refuser: 'Refusée',
  toi: 'À toi',
  sans: 'Aucune règle',
};
export const RAISON_GARDE = {
  'vendue-ailleurs': 'vendue ailleurs',
  'garde-absente': 'ouvre VRM pour vérifier les autres sites',
  'garde-perimee': 'ouvre VRM pour vérifier les autres sites',
  'garde-incomplete': 'un site n’a pas pu être relu',
};

// offres : la Map de Messages (`${uid}_${conv}` → { prix, tx, oid, item, titre, side })
// — `undefined` en lecture, `null` pas su. Seules SES ventes (une offre reçue
// quand il achète n'est pas pour le moteur).
export function apercuMoteur({ offres, numeros, garde, maintenant = Date.now(), comptes = null } = {}) {
  if (offres === undefined) return undefined;
  if (offres === null) return null;
  const lignes = [];
  const entrees = offres instanceof Map ? [...offres.entries()] : Object.entries(offres || {});
  for (const [cle, o] of entrees) {
    if (!o || o.side === 'buyer') continue;
    const m = /^(\d{1,20})_(\d{1,20})$/.exec(String(cle));
    if (!m) continue;
    if (comptes && !comptes.has(m[1])) continue;
    const fiche = o.item != null ? (numeros || {})[String(o.item)] : null;
    const d = decisionMoteur(o, fiche, garde, maintenant);
    lignes.push({ cle: String(cle), uid: m[1], conv: m[2], item: o.item != null ? String(o.item) : null, prix: Number(o.prix), titre: String(o.titre || ''), numero: fiche && fiche.numero ? String(fiche.numero) : '', ...d });
  }
  const ordre = { accepter: 0, garde: 1, refuser: 2, toi: 3, sans: 4 };
  lignes.sort((a, b) => (ordre[a.quoi] - ordre[b.quoi]) || (b.prix - a.prix) || a.cle.localeCompare(b.cle));
  const n = (q) => lignes.filter((l) => l.quoi === q).length;
  return { lignes, accepter: n('accepter'), garde: n('garde'), refuser: n('refuser'), toi: n('toi'), sans: n('sans') };
}

// ── L'HISTORIQUE : les gestes NOTÉS par l'extension (lot G, `journal_vrm_*`) ──
// rows : [{ id: 'journal_vrm_{uid}_{nav}', e: [{ t, s, a, x, p, auto }] }] ;
// `null` (lecture ratée) ⇒ null ; `undefined` ⇒ undefined. L'identifiant du
// compte vient de l'identifiant de LA LIGNE, exactement (le `_` d'un LIKE vaut
// n'importe quel caractère : le compte 1111 ne compte jamais pour le 111).
const SORTES_OFFRE = { offre_acceptee: 'acceptee', offre_refusee: 'refusee' };
export function journalOffres(rows, { uids = null, max = 30 } = {}) {
  if (rows === undefined) return undefined;
  if (!Array.isArray(rows)) return null;
  const vus = new Set(), out = [];
  for (const r of rows) {
    const m = /^journal_vrm_(\d{1,20})_[A-Za-z0-9-]{1,64}$/.exec(String(r && r.id || ''));
    if (!m || (uids && !uids.has(m[1]))) continue;
    for (const e of Array.isArray(r.e) ? r.e : []) {
      if (!e || !SORTES_OFFRE[e.s]) continue;
      const t = Number(e.t);
      if (!Number.isFinite(t) || t <= 0) continue;
      const cle = `${m[1]}:${e.s}:${e.x || ''}:${e.a || ''}:${Math.round(t / 1000)}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const p = Number(e.p);
      out.push({ t, uid: m[1], sorte: SORTES_OFFRE[e.s], item: e.a != null ? String(e.a) : null, tx: e.x != null ? String(e.x) : null, prix: Number.isFinite(p) && p > 0 ? p : null, auto: e.auto === true });
    }
  }
  out.sort((a, b) => b.t - a.t);
  return out.slice(0, max);
}

// ── LES SEUILS PAR PAIRE (l'écran les montre et les modifie en série) ────────
// annonces : [{ id, uid, numero, titre, prix }] (ses annonces Vinted en ligne).
export function lignesSeuils(annonces, numeros, { filtre = 'toutes', recherche = '' } = {}) {
  const q = String(recherche || '').trim().toLowerCase();
  const out = [];
  for (const a of Array.isArray(annonces) ? annonces : []) {
    if (!a || a.id == null) continue;
    const f = (numeros || {})[String(a.id)] || {};
    const min = seuilMoteur(f.min), refuse = seuilMoteur(f.refuse);
    const illisible = (seuilEcran(f.min) != null && min == null) || (seuilEcran(f.refuse) != null && refuse == null);
    const l = { id: String(a.id), uid: String(a.uid || ''), numero: String(a.numero || f.numero || ''), titre: String(a.titre || ''), prix: Number(a.prix) > 0 ? Number(a.prix) : null,
      min, refuse, minBrut: f.min == null ? '' : String(f.min), refuseBrut: f.refuse == null ? '' : String(f.refuse), illisible,
      incoherent: min != null && refuse != null && refuse >= min };
    if (filtre === 'avec' && min == null && refuse == null) continue;
    if (filtre === 'sans' && (min != null || refuse != null)) continue;
    if (q && !(`${l.titre} ${l.numero}`.toLowerCase().includes(q) || `n°${l.numero}` === q.replace(/\s/g, ''))) continue;
    out.push(l);
  }
  return out;
}

// ── ANTI-BLOCAGE, CÔTÉ APP (docs/passation/2026-11-11-anti-ban.md) ───────────
// 1. Le plafond : `j` = jaugeDuCompte (src/jaugeActions.js). Une ALERTE avant
//    l'arrêt de l'app (45) — jamais un plafond de plus (50/h : sa décision).
export function alertePlafond(j) {
  if (!j || !Number.isFinite(j.n)) return null;
  const pourApp = Number.isFinite(j.pourApp) ? j.pourApp : 45;
  if (j.n >= pourApp) return { niveau: 'atteint', n: j.n, max: j.max };
  if (j.n >= PLAFOND_PROCHE) return { niveau: 'proche', n: j.n, max: j.max };
  return null;
}
// 2. Les freins de Vinted VUS par l'app (la pause posée par l'extension sur un
//    429/403, `etat.pause.jusqua`). Une liste courte, par appareil : on note
//    chaque pause une fois (par son heure de fin), on garde 48 h.
export function noterPause(liste, pause, maintenant = Date.now()) {
  const l = (Array.isArray(liste) ? liste : []).filter((x) => x && Number(x.vu) > maintenant - 2 * CALME_MS);
  const jusqua = Number(pause && pause.jusqua);
  if (!Number.isFinite(jusqua) || jusqua <= maintenant) return l;
  if (l.some((x) => Math.abs(Number(x.jusqua) - jusqua) < 60000)) return l;
  return [...l, { vu: maintenant, jusqua }].slice(-10);
}
// Une journée calme est CONSEILLÉE (jamais imposée) pendant 24 h après le
// dernier frein vu : rien ne s'éteint tout seul, l'écran le dit et propose
// « Tout arrêter ».
export function journeeCalme(liste, maintenant = Date.now()) {
  const vus = (Array.isArray(liste) ? liste : []).map((x) => Number(x && x.vu)).filter((t) => Number.isFinite(t) && t <= maintenant + 60000);
  if (!vus.length) return null;
  const dernier = Math.max(...vus);
  if (maintenant - dernier >= CALME_MS) return null;
  return { depuis: dernier, jusqua: dernier + CALME_MS, n: vus.filter((t) => maintenant - t < CALME_MS).length };
}
