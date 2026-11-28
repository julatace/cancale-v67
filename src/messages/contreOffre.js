// ── src/messages/contreOffre.js — « Autre prix » d'une contre-offre Vinted, jugé AVANT tout envoi (28 nov., messages-parfaits) ──
// Julien (28 nov.) : faire une contre-offre depuis l'app, « prix jamais sous le plancher (prix mini, sinon achat + 10 %) sauf
// si je le force explicitement ». Règle PURE, sans langue : un montant saisi ⇒ un code (la phrase : `mparf.contre.{code}`).
//   saisi     : ce qu'il a tapé (« 62 », « 62,50 », « 62.5 € ») ;
//   offre     : l'offre reçue (euros) — une contre-offre à ou sous l'offre n'a pas de sens (« accepte-la ») ;
//   affiche   : le prix de l'annonce (euros) ou null — au-dessus, refusé (on ne propose pas plus que le prix affiché) ;
//   plancher  : { c (centimes), de: 'mini' | 'achat' } (src/reglesAuto.js `plancherBaisse`) ou null (aucun connu).
// Rend { ok, code, prix?, sous?, sansPlancher? } — `ok: false` ⇒ RIEN ne peut partir ; `sous` / `sansPlancher` ⇒ partir
// exige SA case « je le veux quand même » ET sa confirmation (Agir.jsx). Jamais deviné : un montant illisible n'est pas 0.
export const MIN_CONTRE_C = 100;   // la file de l'extension refuse sous 1 € (`adistArgs`, contreOffre)

export function centimesSaisis(v) {
  if (v == null || typeof v === 'object' || typeof v === 'boolean') return null;
  const t = String(v).replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function prixContreOffre({ saisi, offre, affiche = null, plancher = null } = {}) {
  if (saisi == null || String(saisi).trim() === '') return { ok: false, code: 'vide' };
  const c = centimesSaisis(saisi);
  if (c == null) return { ok: false, code: 'illisible' };
  if (c < MIN_CONTRE_C) return { ok: false, code: 'tropBas' };
  const o = Number.isFinite(Number(offre)) && Number(offre) > 0 ? Math.round(Number(offre) * 100) : null;
  if (o != null && c <= o) return { ok: false, code: 'sousOffre' };
  const a = affiche != null && Number.isFinite(Number(affiche)) && Number(affiche) > 0 ? Math.round(Number(affiche) * 100) : null;
  if (a != null && c > a) return { ok: false, code: 'dessusAffiche' };
  const p = plancher && Number.isSafeInteger(plancher.c) && plancher.c > 0 ? plancher.c : null;
  if (p == null) return { ok: true, code: 'sansPlancher', prix: c / 100, sansPlancher: true };
  if (c < p) return { ok: true, code: 'sousPlancher', prix: c / 100, sous: true };
  return { ok: true, code: 'ok', prix: c / 100 };
}
export default prixContreOffre;
