// ══════════════════════════════════════════════════════════════════════════════
// COMPTES LIÉS — TOUTES LES PLATEFORMES (3 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « Comptes liés : il doit y avoir les comptes Leboncoin, Vestiaire et
// eBay ; tout ce qui est fait pour Vinted doit être fait pour le reste ».
// Une liste, groupée par plateforme, la MÊME carte pour chaque compte. Ce module
// ne lit rien : il range ce que l'écran a lu (règles testables à part).
//
// D'où vient chaque compte (mesuré en lecture seule sur sa base le 3 nov.) :
//   · Vinted     : table `vinted_accounts` (+ profil capté, `panel_comptes_etat`) ;
//   · Leboncoin  : `lbc_accounts.accounts` (id, name, type, seenAt, sessionAt) —
//                  `8442…` et `lbc-account:8442…` sont LE MÊME compte ;
//                  `lbc_listings.lectures[id].at` = dernière liste complète lue ;
//   · Vestiaire  : `vc_session` ({ id, at, comptes: { id: date } }) — jamais un
//                  nom (Vestiaire ne le donne pas, l'extension ne le garde pas) ;
//                  une capture SANS compte relevé ⇒ la carte « non identifié » ;
//   · eBay       : `ebay_comptes.comptes` (pseudo, principal, deconnecteLe, site,
//                  type) ; `ebay_orders{_clé}.capturedAt` = dernière lecture.
//
// L'ÉTAT d'un compte (`etatCompteLie`), le plus fort d'abord :
//   banni (RELEVÉ, Vinted seulement) · délié (eBay déconnecté) · ouvert (la
//   session de l'onglet) · jamais lu · à relire (> 24 h, la règle « en ligne ») ·
//   lu (avec son âge). « Pas su » ne fait jamais « banni ».
import { SANS_COMPTE_VC } from '../api/_lib/comptes-exclus.js';

export const A_RELIRE_MS = 24 * 3600e3;
export const PLATEFORMES_COMPTES = Object.freeze([
  { id: 'vinted', nom: 'Vinted' },
  { id: 'vestiaire', nom: 'Vestiaire Collective' },
  { id: 'leboncoin', nom: 'Leboncoin' },
  { id: 'ebay', nom: 'eBay' },
]);

const ts = (x) => {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : (/^\d{10,}$/.test(String(x)) ? Number(x) : Date.parse(String(x)));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const plusRecent = (...xs) => { let m = null; for (const x of xs) { const t = ts(x); if (t != null && (m == null || t > m)) m = t; } return m; };
const idLbc = (x) => String(x == null ? '' : x).trim().replace(/^lbc-account:/i, '');

export function etatCompteLie({ banni = false, delie = false, ouvert = false, lu = null, maintenant = Date.now() } = {}) {
  if (banni) return 'banni';
  if (delie) return 'delie';
  if (ouvert) return 'ouvert';
  const t = ts(lu);
  if (t == null) return 'jamais';
  if (maintenant - t > A_RELIRE_MS) return 'a-relire';
  return 'lu';
}

// « il y a 3 h », « il y a 2 j » — l'âge d'une lecture, jamais une date inventée.
export function ageLecture(lu, maintenant = Date.now()) {
  const t = ts(lu); if (t == null) return '';
  const min = Math.max(0, Math.round((maintenant - t) / 60000));
  if (min < 60) return min <= 1 ? 'à l’instant' : `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

// ── LEBONCOIN ── un compte par identité ; le nom tel que Leboncoin l'a donné.
export function comptesLbcLies(accounts, lectures, ouvert = '') {
  const par = new Map();
  for (const [cle, a] of Object.entries(accounts && typeof accounts === 'object' ? accounts : {})) {
    if (!a || typeof a !== 'object') continue;
    const id = idLbc(a.id || cle);
    if (!id) continue;
    const p = par.get(id) || { plateforme: 'leboncoin', id, nom: '', type: '', session: null, vu: null };
    if (!p.nom && typeof a.name === 'string' && a.name.trim()) p.nom = a.name.trim().slice(0, 64);
    if (!p.type && (a.type === 'pro' || a.type === 'particulier')) p.type = a.type;
    p.session = plusRecent(p.session, a.sessionAt);
    p.vu = plusRecent(p.vu, a.seenAt);
    par.set(id, p);
  }
  const lec = {};
  for (const [k, v] of Object.entries(lectures && typeof lectures === 'object' ? lectures : {})) { const id = idLbc(k); if (id && v) lec[id] = plusRecent(lec[id], v.at); }
  const ouv = idLbc(ouvert);
  return [...par.values()].map((p) => ({ ...p, lu: plusRecent(lec[p.id], p.session), ouvert: !!ouv && ouv === p.id }));
}

// ── VESTIAIRE ── l'identifiant seul ; « non identifié » quand une capture existe
// sans compte relevé (c'est le cas chez lui le 3 nov. : `vc_session` jamais écrit).
export function comptesVcLies(session, { captures = [], sansCompte = false } = {}, ouvert = '') {
  const s = session && typeof session === 'object' ? session : {};
  const vus = new Map();
  for (const [id, at] of Object.entries(s.comptes && typeof s.comptes === 'object' ? s.comptes : {})) if (/^[\w-]{1,40}$/.test(id)) vus.set(id, plusRecent(vus.get(id), at));
  if (/^[\w-]{1,40}$/.test(String(s.id || ''))) vus.set(String(s.id), plusRecent(vus.get(String(s.id)), s.at));
  const out = [...vus.entries()].map(([id, lu]) => ({ plateforme: 'vestiaire', id, nom: '', lu, ouvert: !!ouvert && ouvert === id }));
  const cap = plusRecent(...captures);
  if (sansCompte || (!out.length && cap != null)) out.push({ plateforme: 'vestiaire', id: SANS_COMPTE_VC, nom: '', nonIdentifie: true, lu: cap, ouvert: false });
  return out;
}

// ── eBAY ── le registre (comptes déconnectés compris : ils se relient d'ici).
export function comptesEbayLies(registre, captures = {}) {
  const l = (registre && Array.isArray(registre.comptes) ? registre.comptes : []).filter((e) => e && typeof e === 'object');
  const out = [];
  for (const e of l) {
    const principal = e.principal === true;
    const cle = /^[0-9a-f]{16}$/.test(String(e.cle || '')) ? String(e.cle) : '';
    if (!principal && !cle) continue;
    const ref = principal ? 'principal' : cle;
    out.push({ plateforme: 'ebay', id: ref, ref, cle, principal, nom: String(e.pseudo || '').slice(0, 64), type: e.type === 'pro' || e.type === 'particulier' ? e.type : '',
      site: typeof e.site === 'string' ? e.site : '', delie: !!Number(e.deconnecteLe), lu: plusRecent(captures[ref]) });
  }
  return out;
}

// La référence d'un compte eBay d'après l'identifiant de sa ligne de commandes.
export const refDeLigneEbay = (id) => { const m = String(id || '').match(/^ebay_orders(?:_([0-9a-f]{16}))?$/); return !m ? null : (m[1] || 'principal'); };

// Le nom affiché : celui LU ; sinon l'identifiant (jamais un nom deviné).
export function nomCompteLie(c) {
  if (!c) return '';
  if (c.nom) return c.nom;
  if (c.plateforme === 'vestiaire') return c.nonIdentifie ? 'Compte non identifié' : `n° ${c.id}`;
  if (c.plateforme === 'ebay') return c.principal ? 'Compte principal' : `n° ${String(c.id).slice(0, 8)}`;
  return `n° ${String(c.id).slice(0, 8)}`;
}

export const LIBELLE_ETAT = Object.freeze({ banni: 'Banni', delie: 'Délié', ouvert: 'Ouvert', jamais: 'Jamais lu', 'a-relire': 'À relire', lu: 'Lu' });
