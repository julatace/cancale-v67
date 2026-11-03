// ════════════════════════════════════════════════════════════════════════════
//  SUGGESTIONS D'ACHAT À RELIER (3 nov. 2026, Julien 14 h 12-14 h 14)
// ════════════════════════════════════════════════════════════════════════════
// « Je veux juste les SUGGESTIONS pour relier une annonce, une vente à un
// achat » — « ne prends pas en compte la photo, mais la couleur, la taille et la
// marque » — « si les suggestions ne sont pas bonnes, on doit pouvoir relier à
// TOUS les achats non reliés, si ce n'est pas des lots ».
//
// Une suggestion est une PROPOSITION (§5 : elle peut utiliser la ressemblance) ;
// c'est TOUJOURS son tap qui relie. Rien ici n'écrit.
//   · même MARQUE obligatoire (inconnue d'un côté ⇒ pas de suggestion) ;
//   · même TAILLE obligatoire, connue des DEUX côtés, comparée après
//     normalisation d'écriture (« 42,5 » = « 42.5 » = « 42½ » ; « 42 2/3 » ≠ « 42,5 ») ;
//   · COULEUR : connue des deux côtés et sans couleur commune ⇒ écartée ;
//     commune ⇒ rang 1 (les trois critères) ; inconnue d'un côté ⇒ rang 2
//     (marque + taille). Jamais la marque seule.
//   · achat ANTÉRIEUR à la mise en ligne / la vente (date d'achat inconnue ⇒ écarté) ;
//   · pas déjà relié ailleurs (sauf un LOT qui n'a pas atteint son nombre d'articles) ;
//   · pas remboursé / annulé / échoué (`ACHAT_SANS_COUT`, la règle de prixAchatPropose).
// Rien ne passe ⇒ RIEN n'est affiché (pas de suggestion faible).
//
// LOTS — forme MESURÉE (3 nov., lecture seule, 734 achats) : Vinted n'expose
// aucun champ de nombre d'articles sur `my_orders` (clés : conversation_id, date,
// photo, photo_url, price, status, title, transaction_id, transaction_user_status) ;
// un lot se lit dans son TITRE : « Lot 3 articles » (titre que Vinted donne à un
// lot, 34 fois), « Lot de 2 paires … », « Lot … » sans nombre (8 fois).
//
// Module PUR : l'app (sélecteur « Relier un achat ») et
// `scripts/audit-suggestions-achat.cjs` exécutent CES fonctions. La marque et
// les couleurs viennent des règles de l'app (`extractBrand`, `extractColors`),
// passées en paramètre : une seule définition (§11).
import { ACHAT_SANS_COUT } from './prixAchatPropose.js';

const txDe = (a) => (a && a.transaction_id != null ? String(a.transaction_id) : '');
const prixDe = (a) => { const v = Number(a && a.price && typeof a.price === 'object' ? a.price.amount : a && a.price); return Number.isFinite(v) && v > 0 ? v : null; };
const dateMs = (d) => { if (d == null || d === '') return NaN; const t = typeof d === 'number' ? (d < 1e12 ? d * 1000 : d) : Date.parse(d); return Number.isFinite(t) ? t : NaN; };

// ── Le lot ──────────────────────────────────────────────────────────────────
// { lot: false } · { lot: true, n: 3 } · { lot: true, n: null } (nombre pas écrit).
export function lotDe(achat) {
  const t = String((achat && achat.title) || '').trim();
  if (!/^lot\b/i.test(t)) return { lot: false, n: null };
  const m = /^lot\s+(?:de\s+)?(\d{1,3})\b/i.exec(t);
  const n = m ? Number(m[1]) : null;
  return { lot: true, n: n && n >= 2 ? n : null };
}

// ── La taille, normalisée d'écriture ───────────────────────────────────────
// « 42,5 » / « 42.5 » / « 42½ » ⇒ « 42.5 » ; « 42 2/3 » ⇒ « 42 2/3 » ; « 42 » ⇒ « 42 ».
export function tailleNorm(s) {
  const t = String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const m = /(?:^|[^0-9])(3[0-9]|4[0-9]|5[0-2])(?:\s*([12])\s*\/\s*3|\s*[.,]\s*5|\s*½)?(?![0-9])/.exec(t);
  if (!m) return '';
  const reste = m[0].slice(m[0].indexOf(m[1]) + m[1].length);
  if (m[2]) return `${m[1]} ${m[2]}/3`;
  if (/[.,½]/.test(reste)) return `${m[1]}.5`;
  return m[1];
}
// Une taille lue dans un TITRE : après « taille / pointure / t / eu / fr / maat /
// n. / size » d'abord, sinon un nombre isolé 34-52 (les modèles 90/95/97/270
// sont hors plage).
export function tailleDuTitre(titre) {
  const t = String(titre || '').toLowerCase();
  const apres = /(?:taille|pointure|size|maat|eu|fr|\bt|\bn)\s*[.:]?\s*((?:3[4-9]|4[0-9]|5[0-2])(?:\s*[12]\s*\/\s*3|\s*[.,]\s*5|\s*½)?)(?![0-9])/.exec(t);
  if (apres) return tailleNorm(apres[1]);
  const seul = /(?:^|[^0-9.,/])((?:3[4-9]|4[0-9]|5[0-2])(?:\s+[12]\s*\/\s*3|[.,]5|½)?)(?![0-9/])/.exec(t);
  return seul ? tailleNorm(seul[1]) : '';
}

// ── Combien d'articles sont reliés à chaque achat ───────────────────────────
// `numeros` (fiches) et `saleOv` (ventes sans fiche) : Map tx → nombre de liens.
export function liensParAchat(numeros, saleOv) {
  const m = new Map();
  for (const src of [numeros, saleOv]) for (const e of Object.values(src || {})) {
    if (!e || e.buyFromId == null || String(e.buyFromId) === '') continue;
    const k = String(e.buyFromId); m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
// L'achat peut-il encore être relié ? `curTx` : celui déjà relié à CET article.
// Un lot reste proposable tant qu'il n'a pas atteint son nombre d'articles
// (nombre pas écrit ⇒ toujours proposable : on ne devine pas sa taille).
export function achatDisponible(achat, liens, curTx = '') {
  const tx = txDe(achat);
  if (!tx) return false;
  if (curTx && String(curTx) === tx) return true;
  const n = (liens && liens.get(tx)) || 0;
  if (!n) return true;
  const l = lotDe(achat);
  return l.lot && (l.n == null || n < l.n);
}
export const achatAnnule = (achat) => ACHAT_SANS_COUT.test(String((achat && achat.status) || ''));
// « lot · 2/5 reliés » (ou « lot · 2 reliés » sans nombre écrit). '' hors lot.
export function etiquetteLot(achat, liens) {
  const l = lotDe(achat); if (!l.lot) return '';
  const n = (liens && liens.get(txDe(achat))) || 0;
  return l.n ? `lot · ${n}/${l.n} reliés` : `lot · ${n} relié${n > 1 ? 's' : ''}`;
}
// Une INDICATION (jamais pré-remplie, jamais écrite) : prix du lot ÷ nombre d'articles.
export function prixIndicatifLot(achat) {
  const l = lotDe(achat), p = prixDe(achat);
  return l.lot && l.n && p != null ? Math.round((p / l.n) * 100) / 100 : null;
}

// ── Les suggestions ─────────────────────────────────────────────────────────
// cible : { titre, marque?, taille?, couleur? (texte), dateRef? (mise en ligne ou
// vente), curTx? } · achats : la liste captée · liens : `liensParAchat`.
// marqueDe(texte) → nom | null ; couleursDe(texte) → [noms].
// Rend [{ achat, rang: 1|2, marque, taille, couleurs }] (au plus `max`).
export function suggestionsAchat({ cible, achats, liens, marqueDe, couleursDe, max = 3 } = {}) {
  if (!cible || typeof marqueDe !== 'function' || typeof couleursDe !== 'function' || !Array.isArray(achats)) return [];
  const bas = (s) => String(s || '').trim().toLowerCase();
  const titre = String(cible.titre || '');
  const marque = bas(cible.marque && marqueDe(String(cible.marque)) || cible.marque || marqueDe(titre));
  const taille = cible.taille ? tailleNorm(cible.taille) : tailleDuTitre(titre);
  const couleurs = (couleursDe([cible.couleur || '', titre].join(' ')) || []).map(bas);
  if (!marque || !taille) return [];
  const ref = dateMs(cible.dateRef);
  const out = [];
  for (const a of achats) {
    if (!a || !txDe(a) || achatAnnule(a) || !achatDisponible(a, liens, cible.curTx)) continue;
    const t = String(a.title || '');
    if (bas(marqueDe(t)) !== marque) continue;
    const ta = tailleDuTitre(t);
    if (!ta || ta !== taille) continue;
    const da = dateMs(a.date);
    if (!Number.isFinite(da) || (Number.isFinite(ref) && !(da < ref))) continue;
    const cs = (couleursDe(t) || []).map(bas);
    let rang = 2;
    if (couleurs.length && cs.length) { if (!cs.some((c) => couleurs.includes(c))) continue; rang = 1; }
    out.push({ achat: a, rang, marque, taille, couleurs: cs, da });
  }
  out.sort((x, y) => (x.rang - y.rang) || (y.da - x.da));
  return out.slice(0, max).map(({ da, ...r }) => r);
}

// ── « Voir tous les achats » ────────────────────────────────────────────────
// Les achats pas encore reliés (un lot reste tant qu'il n'est pas complet), sans
// les remboursés, les plus récents d'abord. q : mot dans le titre, la marque ou
// le n° de transaction ; compte : nom du compte acheteur (compteDe) ; mois : 'AAAA-MM'.
export function tousAchatsLibres({ achats, liens, curTx = '', q = '', compte = '', mois = '', compteDe = null, marqueDe = null } = {}) {
  const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const a of (Array.isArray(achats) ? achats : [])) {
    if (!a || !txDe(a) || achatAnnule(a) || !achatDisponible(a, liens, curTx)) continue;
    if (compte && typeof compteDe === 'function' && String(compteDe(a) || '') !== compte) continue;
    const d = dateMs(a.date);
    if (mois && !(Number.isFinite(d) && new Date(d).toISOString().slice(0, 7) === mois)) continue;
    if (mots.length) {
      const foin = sansAccent([a.title, typeof marqueDe === 'function' ? marqueDe(String(a.title || '')) : '', txDe(a)].join(' '));
      if (!mots.every((m) => foin.includes(m))) continue;
    }
    out.push({ a, d: Number.isFinite(d) ? d : -Infinity });
  }
  return out.sort((x, y) => y.d - x.d).map((x) => x.a);
}
// Les mois et comptes présents (filtres rapides), du plus récent au plus ancien.
export function filtresAchats(achats, compteDe) {
  const mois = new Set(), comptes = new Set();
  for (const a of (Array.isArray(achats) ? achats : [])) {
    const d = dateMs(a && a.date); if (Number.isFinite(d)) mois.add(new Date(d).toISOString().slice(0, 7));
    const c = typeof compteDe === 'function' ? String(compteDe(a) || '') : ''; if (c) comptes.add(c);
  }
  return { mois: [...mois].sort().reverse(), comptes: [...comptes].sort() };
}
// L'écriture d'un LOT : le prix de CET article, SAISI (jamais deviné, jamais le
// prix du lot). Montant illisible ⇒ null (rien n'est écrit).
export function ecritureLot(achat, saisi, { accNom = '', photo = '' } = {}) {
  const v = Number(String(saisi == null ? '' : saisi).replace(/\s/g, '').replace(',', '.'));
  if (!String(saisi == null ? '' : saisi).trim() || !Number.isFinite(v) || v <= 0) return null;
  const l = lotDe(achat);
  return {
    buyPrice: v.toFixed(2).replace('.', ','),
    buyFromId: txDe(achat),
    buyFrom: { title: achat.title || '', date: achat.date || '', photo, price: v, devise: 'EUR', seller: achat.seller || achat.user_login || '',
      status: achat.status || '', account: accNom, lot: true, lotN: l.n, prixLot: prixDe(achat) },
  };
}
