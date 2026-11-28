// ═════════════════════════════════════════════════════════════════════════════
//  LA COTE « VRM » D'UNE RÉFÉRENCE + POINTURE (28 nov. 2026, lot sneakers-cote)
// ═════════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : « on ne peut pas faire sans clé ? » puis « je ne veux pas avoir à mettre de clé, ni ceux des
// utilisateurs, débrouille-toi ». ⇒ La cote est calculée sur SES PROPRES ventes passées (toutes plateformes), de la
// même référence fabricant et de la même pointure ; trop peu ⇒ la même référence, toutes pointures (et c'est DIT).
// StockX : pas sans clé, écarté sur décision du 28 nov. — aucune clé, aucune route, aucune lecture de stockx.com.
//
// Ce que rend une cote : prix médian vendu, nombre de ventes, délai de vente moyen (quand la date de mise en ligne
// est lue), dernière vente datée, et sa COUVERTURE (« 4 ventes sur 12 mois »). Zéro vente ⇒ `null` : rien n'est
// inventé, l'écran dit qu'il n'y a pas encore de vente de cette référence.
//
// ⚠️ CLAUDE.md §3 : « prix conseillé à la mise en ligne » est REFUSÉ (11 oct.). La cote se montre à l'ACHAT (la
//    calculette, « marge possible ») et dans la VALEUR DU STOCK (Argent → Prix qui marche, la feuille Sneakers) —
//    JAMAIS dans un écran de mise en ligne (`scripts/audit-sneakers.cjs` §C le vérifie, mutation ⇒ rouge).
// ⚠️ §5 : la référence est celle d'un MODÈLE ; une vente ne devient jamais « celle de ce N° » par sa référence.
// Module PUR. Exécuté par scripts/audit-sneakers.cjs.
// ═════════════════════════════════════════════════════════════════════════════
import { normaliserRef, refEffective, normaliserPointure, pointureDuTexte, clePointure } from './reference.js';

export const FENETRE_JOURS = 365;          // les ventes des 12 derniers mois
export const MIN_POINTURE = 2;             // en dessous de 2 ventes à la pointure : la référence toutes pointures
const JOUR = 86400000;

const cents = (v) => { const n = Number(typeof v === 'object' && v ? v.amount : String(v == null ? '' : v).replace(',', '.')); return v == null || v === '' || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100); };
export const mediane = (l) => { const a = [...l].sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };

// Une vente, rendue comparable : { site, prixC, venduMs, misEnLigneMs, ref, refSource, pointure, cleP }, ou null
// (prix pas lu, date pas lue, autre devise : écartée — jamais 0 €).
//   v.ref / v.pointure : posées par LUI sur le N° de la vente (quand ce N° est connu PAR IDENTITÉ) ;
//   v.titre / v.taille : ce que l'annonce disait (la référence unique du titre ; la taille de l'annonce).
export function venteCotable(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.devise && String(v.devise).toUpperCase() !== 'EUR') return null;
  const prixC = Number.isInteger(v.prixC) && v.prixC > 0 ? v.prixC : cents(v.prix);
  const venduMs = Number(v.venduMs);
  if (prixC == null || !Number.isFinite(venduMs) || venduMs <= 0) return null;
  const r = refEffective(v.ref, v.titre);
  if (!r.ref) return null;
  const pointure = (v.pointure && v.pointure.sys ? v.pointure : null) || normaliserPointure(v.taille) || pointureDuTexte(v.titre);
  const mis = Number(v.misEnLigneMs);
  return { site: String(v.site || ''), prixC, venduMs, misEnLigneMs: Number.isFinite(mis) && mis > 0 && mis <= venduMs ? mis : null, ref: r.ref, refSource: r.source, pointure, cleP: clePointure(pointure, r.ref) };
}

// LA COTE. `ventes` : déjà passées par `venteCotable` (ou brutes : elles le sont ici).
// Rend null (référence illisible) ou :
//   { ref, cleP, niveau: 'pointure' | 'reference' | 'aucune', n, nPointure, nReference, medianeC, minC, maxC,
//     delaiJours (moyen, ou null), nDelai, derniere: { prixC, ms, site } | null, fenetreJours, depuisMs }
export function coteVRM(ventes, { ref, pointure = null } = {}, { maintenant = Date.now(), fenetreJours = FENETRE_JOURS, minPointure = MIN_POINTURE } = {}) {
  const R = normaliserRef(ref);
  if (!R) return null;
  const p = pointure && pointure.sys ? pointure : normaliserPointure(pointure);
  const cle = clePointure(p, R);
  const depuis = maintenant - fenetreJours * JOUR;
  const toutes = (ventes || []).map((v) => (v && v.cleP !== undefined && v.prixC ? v : venteCotable(v))).filter((v) => v && v.ref === R && v.venduMs >= depuis && v.venduMs <= maintenant + JOUR);
  const aLaPointure = cle ? toutes.filter((v) => v.cleP === cle) : [];
  const niveau = aLaPointure.length >= minPointure ? 'pointure' : toutes.length ? 'reference' : 'aucune';
  const l = niveau === 'pointure' ? aLaPointure : toutes;
  const base = { ref: R, cleP: cle, niveau, n: l.length, nPointure: aLaPointure.length, nReference: toutes.length, fenetreJours, depuisMs: depuis };
  if (!l.length) return { ...base, medianeC: null, minC: null, maxC: null, delaiJours: null, nDelai: 0, derniere: null };
  const prix = l.map((v) => v.prixC);
  const avecDelai = l.filter((v) => v.misEnLigneMs != null);
  const derniere = l.reduce((a, v) => (!a || v.venduMs > a.venduMs ? v : a), null);
  return { ...base, medianeC: mediane(prix), minC: Math.min(...prix), maxC: Math.max(...prix),
    delaiJours: avecDelai.length ? Math.round(avecDelai.reduce((s, v) => s + (v.venduMs - v.misEnLigneMs), 0) / avecDelai.length / JOUR) : null,
    nDelai: avecDelai.length, derniere: { prixC: derniere.prixC, ms: derniere.venduMs, site: derniere.site } };
}

// « MARGE POSSIBLE » à l'achat : la médiane de la cote moins le prix d'achat tapé — AVANT les frais (la calculette
// les ajoute quand il prend la cote comme prix de revente). Pas de cote ou pas d'achat ⇒ null.
export function margePossible(cote, achatC) {
  if (!cote || cote.medianeC == null || !Number.isInteger(achatC) || achatC <= 0) return null;
  return cote.medianeC - achatC;
}

// LA VALEUR DU STOCK « au prix VRM » : chaque paire présente dont la référence (posée, sinon l'unique du titre)
// a une cote. Rend { total, cotees, valeurC, parNiveau: { pointure, reference }, sansRef, sansVente, lignes } —
// la couverture « N sur M cotées » se lit dans `cotees` / `total`. Une paire sans cote n'est JAMAIS comptée 0 €.
//   stock : [{ cle (N° ou annonce), ref, pointure, titre, taille }]
export function valeurStockCote(stock, ventes, opts = {}) {
  const v = (ventes || []).map(venteCotable).filter(Boolean);
  const memo = new Map();
  const lignes = [];
  let valeurC = 0, cotees = 0, sansRef = 0, sansVente = 0;
  const parNiveau = { pointure: 0, reference: 0 };
  for (const s of stock || []) {
    if (!s) continue;
    const r = refEffective(s.ref, s.titre);
    if (!r.ref) { sansRef++; lignes.push({ cle: s.cle, ref: '', cote: null }); continue; }
    const p = (s.pointure && s.pointure.sys ? s.pointure : null) || normaliserPointure(s.taille) || pointureDuTexte(s.titre);
    const k = r.ref + '|' + clePointure(p, r.ref);
    if (!memo.has(k)) memo.set(k, coteVRM(v, { ref: r.ref, pointure: p }, opts));
    const c = memo.get(k);
    if (!c || c.medianeC == null) { sansVente++; lignes.push({ cle: s.cle, ref: r.ref, refSource: r.source, cote: c }); continue; }
    cotees++; valeurC += c.medianeC; parNiveau[c.niveau]++;
    lignes.push({ cle: s.cle, ref: r.ref, refSource: r.source, cote: c });
  }
  return { total: (stock || []).filter(Boolean).length, cotees, valeurC: cotees ? valeurC : null, parNiveau, sansRef, sansVente, lignes };
}
