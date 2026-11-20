// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE : DEPUIS QUAND UN ARTICLE EST EN LIGNE (20 nov., lot lbc-vc-interesses, extension 5.410)
//
//  MESURÉ le 20 nov. : « Mes articles » de Vestiaire porte `listingDate` (ISO avec fuseau). L'extension 5.410
//  la range (`misEnLigne`, EXACTE) ; sinon elle date l'article à sa 1re lecture (`vueDepuis`) — une BORNE BASSE.
//  Règle d'écran : une date exacte se dit « en ligne depuis le … » ; une borne basse se dit TOUJOURS « vue en
//  ligne depuis au moins le … » — jamais présentée comme la date de mise en ligne. Rien ⇒ null (rien n'est dit).
//  La baisse par règle (extension `regleBaisseVcTick`) compte ses jours depuis cette date : avec la borne basse
//  elle ne baisse jamais plus tôt qu'avec la vraie date.
// ════════════════════════════════════════════════════════════════════════════
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
export function dateEnLigneVc(it) {
  if (!it || typeof it !== 'object') return null;
  const m = iso(it.misEnLigne);
  if (m != null) return { t: m, exacte: true };
  const v = iso(it.vueDepuis);
  return v != null ? { t: v, exacte: false } : null;
}
// La phrase : `tr` passé par l'écran (une seule source de textes).
export function phraseEnLigneVc(it, tr, langue = 'fr-FR') {
  const d = dateEnLigneVc(it);
  if (!d) return '';
  let jour = '';
  try { jour = new Date(d.t).toLocaleDateString(langue, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }); } catch (_) { jour = new Date(d.t).toISOString().slice(0, 10); }
  return d.exacte ? tr('vcDate.depuis', { jour }) : tr('vcDate.auMoins', { jour });
}
