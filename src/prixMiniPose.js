// ════════════════════════════════════════════════════════════════════════════
//  LE PRIX MINI DEMANDÉ À LA PUBLICATION (22 nov., ext. 5.437 — `prixminipublier`)
// ════════════════════════════════════════════════════════════════════════════
// Julien : quand on PUBLIE un article par l'extension (formulaire Vinted, « Publier partout », une fiche vers
// Vinted / Leboncoin / Vestiaire), l'extension DEMANDE le prix minimum et le range à côté du N°.
//
// L'extension n'écrit JAMAIS `main` (§5) : SA réponse va dans la ligne dédiée `vrm_reglages_auto`, clé
// `vrm_prix_mini` (comparer-et-échanger) : { v: 1, parNum: { [cleNum]: { min, at } }, parItem: { [id annonce]: { min, at } } }.
//   · IDENTITÉ seulement : le N° de la paire (cleNum — « 007 » = « 7 ») ou l'identifiant de l'annonce. Jamais un titre.
//   · `min: null` = il a EFFACÉ son prix mini (rien n'est accepté automatiquement sans lui).
// LA RÈGLE DE LECTURE (la même pour l'app et l'extension, `pmMiniDe`) : le prix mini d'une fiche
// (`vinted_annonce_numeros[id]`) est la valeur la PLUS RÉCENTE entre `fiche.min` (daté par `fiche.minAt`, 0 s'il ne
// l'est pas : un prix mini d'avant ce lot) et les entrées de la ligne pour SON identifiant et SON N°.
// L'app ABSORBE ensuite une entrée plus récente dans sa fiche (`pmAbsorber` : `min` + `minAt`), une fois, sans rien
// écraser de plus récent ; une saisie dans l'app (minAt = maintenant) gagne ensuite.
// LA PROPOSITION (`pmProposition`) : le prix mini déjà connu pour ce N°, sinon l'achat + 10 % arrondi à l'euro du
// dessus (jamais sous le plancher absolu), sinon RIEN (jamais deviné sans base). « Passer » n'écrit rien.
// Module PUR, recopié tel quel dans vinted-sync-extension/background.js (node scripts/audit-prix-mini-pose.cjs --recopie).
// <prix-mini-pose-regle>
const PM_CLE = 'vrm_prix_mini';
const PM_MAX_ENTREES = 20000;
const PM_MAX_EUROS = 100000;
// Un montant tapé (« 45 », « 45,5 », « 45.50 € ») ⇒ euros (2 décimales) ; vide ⇒ null ; illisible ⇒ NaN.
function pmMontant(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v <= PM_MAX_EUROS ? Math.round(v * 100) / 100 : NaN;
  const t = String(v).replace(/\s|€/g, '').replace(',', '.');
  if (!t) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return n > 0 && n <= PM_MAX_EUROS ? Math.round(n * 100) / 100 : NaN;
}
// L'entrée datée lue dans la ligne (forme fausse ⇒ null : ignorée).
function pmEntree(e) {
  if (!e || typeof e !== 'object') return null;
  const at = Number(e.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  if (e.min === null) return { min: null, at };
  const m = pmMontant(e.min);
  return Number.isFinite(m) && m > 0 ? { min: m, at } : null;
}
// La valeur de la ligne, toujours complète.
function pmLigne(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = { v: 1, parNum: {}, parItem: {} };
  for (const k of ['parNum', 'parItem']) {
    const src = o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? o[k] : {};
    for (const id of Object.keys(src).slice(0, PM_MAX_ENTREES)) { const e = pmEntree(src[id]); if (e && id) out[k][id] = e; }
  }
  return out;
}
// Une demande d'écriture { num?, item?, min } (min tapé, ou null pour effacer) ⇒ { ok, valeur } | { ok: false, code, raison }.
function pmNormalise(demande, actuelle, maintenant, cleNumF) {
  const d = demande && typeof demande === 'object' ? demande : {};
  const num = d.num != null && String(d.num).trim() ? cleNumF(d.num) : '';
  const item = d.item != null && /^\d{1,20}$/.test(String(d.item)) ? String(d.item) : '';
  if (!num && !item) return { ok: false, code: 'identite', raison: 'Ni N° ni annonce : le prix mini n’est rangé nulle part.' };
  if (num && !/^[A-Z]{0,3}\d{1,7}$/.test(num)) return { ok: false, code: 'identite', raison: 'N° illisible.' };
  let min;
  if (d.min === null || d.efface === true) min = null;
  else { min = pmMontant(d.min); if (!(Number.isFinite(min) && min > 0)) return { ok: false, code: 'montant', raison: 'Un montant en euros (ex. 45 ou 45,50).' }; }
  if (min != null && Number(d.prix) > 0 && min > Number(d.prix)) return { ok: false, code: 'au-dessus', raison: 'Le prix mini est au-dessus du prix de l’annonce.' };
  const at = Number(maintenant) || 0;
  const v = pmLigne(actuelle);
  if (num) v.parNum[num] = { min, at };
  if (item) v.parItem[item] = { min, at };
  for (const k of ['parNum', 'parItem']) { const ids = Object.keys(v[k]); if (ids.length > PM_MAX_ENTREES) return { ok: false, code: 'plein', raison: 'Trop de prix mini rangés.' }; }
  return { ok: true, valeur: v };
}
// LE prix mini d'une fiche : { min (euros | null), at, de: 'fiche' | 'ligne' }.
function pmMiniDe(fiche, itemId, ligne, cleNumF) {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const L = pmLigne(ligne);
  const fm = pmMontant(f.min);
  const fat = Date.parse(f.minAt || '') || Number(f.minAt) || 0;
  let best = { min: Number.isFinite(fm) && fm > 0 ? fm : null, at: fat, de: 'fiche' };
  const cands = [];
  if (itemId != null && L.parItem[String(itemId)]) cands.push(L.parItem[String(itemId)]);
  const n = f.numero != null && String(f.numero).trim() ? cleNumF(f.numero) : '';
  if (n && L.parNum[n]) cands.push(L.parNum[n]);
  for (const c of cands) if (c.at > best.at) best = { min: c.min, at: c.at, de: 'ligne' };
  return best;
}
// Les fiches telles que les moteurs les lisent (min effectif) — rien n'est modifié en place.
function pmSuperposer(numeros, ligne, cleNumF) {
  const src = numeros && typeof numeros === 'object' ? numeros : {};
  const L = pmLigne(ligne);
  if (!Object.keys(L.parNum).length && !Object.keys(L.parItem).length) return src;
  const out = {};
  for (const id of Object.keys(src)) {
    const f = src[id];
    if (!f || typeof f !== 'object') { out[id] = f; continue; }
    const m = pmMiniDe(f, id, L, cleNumF);
    if (m.de !== 'ligne') { out[id] = f; continue; }
    const g = Object.assign({}, f); if (m.min == null) delete g.min; else g.min = m.min; g.minDe = 'pose';
    out[id] = g;
  }
  return out;
}
// L'absorption par l'app : les fiches dont une entrée de la ligne est PLUS RÉCENTE ⇒ { numeros, ids } (ids vides ⇒ rien).
function pmAbsorber(numeros, ligne, cleNumF) {
  const src = numeros && typeof numeros === 'object' ? numeros : {};
  const L = pmLigne(ligne);
  const ids = []; const out = Object.assign({}, src);
  for (const id of Object.keys(src)) {
    const f = src[id]; if (!f || typeof f !== 'object') continue;
    const m = pmMiniDe(f, id, L, cleNumF);
    if (m.de !== 'ligne') continue;
    const g = Object.assign({}, f); if (m.min == null) delete g.min; else g.min = String(m.min); g.minAt = new Date(m.at).toISOString();
    out[id] = g; ids.push(id);
  }
  return { numeros: ids.length ? out : src, ids };
}
// LA PROPOSITION du champ « Prix minimum » avant de publier : { valeur (euros | null), de: 'connu' | 'achat' | null }.
function pmProposition({ connu, achat } = {}) {
  const c = pmMontant(connu);
  if (Number.isFinite(c) && c > 0) return { valeur: c, de: 'connu' };
  const a = pmMontant(achat);
  if (Number.isFinite(a) && a > 0) return { valeur: Math.ceil(Math.round(a * 110) / 100 - 1e-9), de: 'achat' };
  return { valeur: null, de: null };
}
// </prix-mini-pose-regle>
export { PM_CLE, PM_MAX_ENTREES, pmMontant, pmLigne, pmNormalise, pmMiniDe, pmSuperposer, pmAbsorber, pmProposition };
