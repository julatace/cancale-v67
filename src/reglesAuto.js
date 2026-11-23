// ── LES DEUX GESTES AUTOMATIQUES DÉCIDÉS PAR JULIEN (19 nov., « 1 oui, 3 oui », extension 5.409) ──
// 1. La BAISSE PAR RÈGLE : une règle par compte Vinted (`vinted_baisse_regle` de `main`), posée
//    sur SON clic, ÉTEINTE par défaut. L'extension l'applique seule (background.js
//    `regleBaisseTick`) : elle range une baisse dans la file des baisses en attente, exécutée par
//    le chemin `baisserPrixVinted` (compte de l'onglet, prix lu avant / relu après, 45/h, sécurité,
//    discrétion). Plancher : le prix mini, sinon l'achat + 10 %, sinon AUCUNE baisse.
// 2. VENDUE AILLEURS ⇒ MASQUÉE sur Vinted : l'app publie la liste (`vinted_masquer_ailleurs`),
//    l'extension masque (réversible, jamais une suppression), démasque si la vente est annulée.
// Le bloc <regles-auto-regle> est le MÊME ici et dans l'extension (audit-regles-auto --recopie).
// <regles-auto-regle> — la RÈGLE, recopiée telle quelle dans vinted-sync-extension/background.js (node scripts/audit-regles-auto.cjs --recopie).
const REGLE_PCT = [3, 30];                 // % d'une baisse : bornes
const REGLE_JOURS = [3, 90];               // jours sans vente entre deux baisses : bornes
const REGLE_MARGE_ACHAT = 110;             // sans prix mini : jamais sous l'achat + 10 %
const MASQ_V = 1;
const MASQ_AGE_MAX_MS = 48 * 3600000;      // une liste plus vieille ne fait plus rien (ni masquer, ni démasquer)
const DRESSING_AGE_MAX_MS = 24 * 3600000;  // « en ligne » : la lecture du dressing de moins de 24 h fait foi
const RE_MASQUER_CHEMIN = /^\/api\/v2\/items\/\d{4,15}\/is_hidden$/;
// La règle d'UN compte : { pct, jours } — ou null (éteinte, absente, illisible : rien ne baisse).
function regleBaisseDe(regles, uid) {
  const c = regles && typeof regles === 'object' && regles.comptes && typeof regles.comptes === 'object' ? regles.comptes[String(uid)] : null;
  if (!c || typeof c !== 'object' || c.actif !== true) return null;
  const pct = Number(c.pct), jours = Number(c.jours);
  if (!Number.isInteger(pct) || pct < REGLE_PCT[0] || pct > REGLE_PCT[1]) return null;
  if (!Number.isInteger(jours) || jours < REGLE_JOURS[0] || jours > REGLE_JOURS[1]) return null;
  return { pct, jours };
}
// Un montant posé par LUI (« 45,5 », « 45.50 € ») en centimes, ou null — jamais un nombre inventé.
function centimesPoses(v) {
  if (v == null || typeof v === 'object' || typeof v === 'boolean') return null;
  const t = String(v).replace(/\s|€/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null;
}
// Le plancher en centimes : le prix mini (`fiche.min`), sinon l'achat + 10 % (`fiche.buyPrice`,
// sinon le prix d'achat rangé sous son N°), sinon null — et null veut dire : aucune baisse.
function plancherBaisse(fiche, achatParNum) {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const mini = centimesPoses(f.min);
  if (mini != null) return { c: mini, de: 'mini' };
  const num = f.numero != null ? String(f.numero).trim() : '';
  const brut = f.buyPrice != null && String(f.buyPrice).trim() !== '' ? f.buyPrice : (num && achatParNum && typeof achatParNum === 'object' ? achatParNum[num] : null);
  const achat = centimesPoses(brut);
  if (achat != null) return { c: Math.ceil(achat * REGLE_MARGE_ACHAT / 100), de: 'achat' };
  return null;
}
// La baisse DUE pour une annonce : { vouluC } ou { non: raison }. `depuis` : la dernière date où le
// prix a pu changer (mise en ligne, dernière baisse rangée). Le nouveau prix est arrondi à l'euro
// INFÉRIEUR, puis remonté au plancher s'il passait dessous ; jamais une hausse, jamais sous 1 €.
function baisseDue({ prixC, depuis, regle, plancher, maintenant }) {
  if (!regle) return { non: 'eteinte' };
  if (!plancher || !Number.isInteger(plancher.c)) return { non: 'sans-plancher' };
  if (!Number.isInteger(prixC) || prixC <= 0) return { non: 'prix' };
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (!(Number(depuis) > 0) || t - Number(depuis) < regle.jours * 864e5) return { non: 'trop-tot' };
  if (prixC <= plancher.c) return { non: 'au-plancher' };
  let v = Math.floor(prixC * (100 - regle.pct) / 100 / 100) * 100;
  if (v < plancher.c) v = plancher.c;
  if (v >= prixC) return { non: 'au-plancher' };
  if (v < 100) return { non: 'trop-bas' };
  return { vouluC: v };
}
// La liste publiée par l'app : null si elle peut servir, sinon pourquoi (rien ne bouge).
function masquerListeDit(liste, maintenant) {
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  if (!liste || typeof liste !== 'object' || liste.v !== MASQ_V || !Array.isArray(liste.items)) return 'absente';
  const at = Number(liste.at);
  if (!Number.isFinite(at) || t - at > MASQ_AGE_MAX_MS || at > t + 120000) return 'perimee';
  return null;
}
// Ce qu'il y a à faire pour UN compte : { masquer: [id], demasquer: [id] }.
//   masquer   : dans la liste, de CE compte, EN LIGNE à la dernière lecture (< 24 h) du dressing,
//               pas déjà masquée ou en cours par VRM ;
//   démasquer : masquée PAR VRM (registre), plus dans une liste COMPLÈTE, toujours masquée au
//               dressing, jamais fermée (vendue) — « pas su » ne démasque rien.
function masquerAFaire({ liste, dressing, registre, uid, maintenant }) {
  const out = { masquer: [], demasquer: [] };
  const u = String(uid || '');
  if (masquerListeDit(liste, maintenant)) return out;
  if (!dressing || !Array.isArray(dressing.items)) return out;
  const t = Number.isFinite(maintenant) ? maintenant : Date.now();
  const cap = Date.parse(String(dressing.capturedAt || ''));
  if (!Number.isFinite(cap) || t - cap > DRESSING_AGE_MAX_MS) return out;
  const parId = new Map(dressing.items.filter((x) => x && x.id != null).map((x) => [String(x.id), x]));
  const reg = registre && typeof registre === 'object' ? registre : {};
  const dans = new Set();
  for (const e of liste.items) {
    if (!e || typeof e !== 'object' || !/^\d{4,15}$/.test(String(e.id)) || String(e.uid) !== u) continue;
    dans.add(String(e.id));
    const it = parId.get(String(e.id));
    const r = reg[String(e.id)];
    if (!it || it.is_closed || it.is_hidden || it.is_draft) continue;
    if (r && (r.etat === 'envoye' || (r.etat === 'refuse' && t - Number(r.at || 0) < 24 * 3600000))) continue;
    out.masquer.push(String(e.id));
  }
  if (liste.complet === true) {
    for (const id of Object.keys(reg)) {
      const r = reg[id];
      if (!r || String(r.uid) !== u || r.etat !== 'masquee' || dans.has(id)) continue;
      const it = parId.get(id);
      if (!it || it.is_hidden !== true || it.is_closed) continue;
      out.demasquer.push(id);
    }
  }
  return out;
}
// Le geste « masquer » est-il APPRIS ? Ses propres gestes rangés : `PUT`, l'adresse
// `/api/v2/items/{id}/is_hidden`, un corps d'UNE clé booléenne `is_hidden`. Sinon : pas appris.
function masquerAppris(rows) {
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || String(r.m || '').toUpperCase() !== 'PUT' || !RE_MASQUER_CHEMIN.test(String(r.p || ''))) continue;
    let o = null; try { o = JSON.parse(String(r.b || '')); } catch (_) { o = null; }
    if (o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 1 && typeof o.is_hidden === 'boolean') return true;
  }
  return false;
}
// </regles-auto-regle>

export { REGLE_PCT, REGLE_JOURS, REGLE_MARGE_ACHAT, MASQ_V, MASQ_AGE_MAX_MS, regleBaisseDe, centimesPoses, plancherBaisse, baisseDue, masquerListeDit, masquerAFaire, masquerAppris };

// ── CÔTÉ APP ────────────────────────────────────────────────────────────────
export const REGLE_CLE = 'vinted_baisse_regle';
export const MASQUER_CLE = 'vinted_masquer_ailleurs';
export const MASQUEES_CLE = 'vinted_masquees_vrm';
// Les paliers proposés à l'écran (un toucher chacun) : jamais une saisie libre.
export const PALIERS_PCT = [5, 10, 15];
export const PALIERS_JOURS = [7, 14, 30];
export const REGLE_DEFAUT = { actif: false, pct: 5, jours: 14 };
// La règle d'un compte telle que l'écran la montre (toujours une valeur, éteinte par défaut).
export function regleDuCompte(regles, uid) {
  const c = regles && typeof regles === 'object' && regles.comptes && typeof regles.comptes === 'object' ? regles.comptes[String(uid)] : null;
  if (!c || typeof c !== 'object') return { ...REGLE_DEFAUT };
  const pct = PALIERS_PCT.includes(Number(c.pct)) ? Number(c.pct) : REGLE_DEFAUT.pct;
  const jours = PALIERS_JOURS.includes(Number(c.jours)) ? Number(c.jours) : REGLE_DEFAUT.jours;
  return { actif: c.actif === true, pct, jours };
}
// La valeur à ranger après SON geste (les autres comptes ne bougent pas).
export function avecRegle(regles, uid, maj, maintenant = Date.now()) {
  const comptes = regles && typeof regles === 'object' && regles.comptes && typeof regles.comptes === 'object' ? { ...regles.comptes } : {};
  const r = { ...regleDuCompte(regles, uid), ...(maj || {}) };
  comptes[String(uid)] = { actif: r.actif === true, pct: PALIERS_PCT.includes(r.pct) ? r.pct : REGLE_DEFAUT.pct, jours: PALIERS_JOURS.includes(r.jours) ? r.jours : REGLE_DEFAUT.jours, at: maintenant };
  return { v: 1, comptes };
}
// La liste à publier : les annonces VINTED dont la paire est VENDUE sur un AUTRE site (preuve de
// vente engagée, par identité : `articlesVendusAilleurs`), jamais une « remise en vente » à
// confirmer, jamais une vente sur un autre compte Vinted (ce n'est pas « ailleurs »).
// `complet` : toutes les plateformes relues (sinon VRM ne DÉMASQUE rien : « pas su »).
// `data` : la sortie de `chargerRetraitsMulti` ; `calcul` : `articlesVendusAilleurs(data)`.
export function listeMasquerAilleurs(data, calcul, maintenant = Date.now()) {
  const items = [], vus = new Set();
  for (const l of (calcul && calcul.lignes) || []) {
    if (!l || l.plateforme !== 'Vinted' || l.id == null || l.aConfirmer) continue;
    if (!/^\d{1,20}$/.test(String(l.compte || ''))) continue;
    const ailleurs = (l.ventes || []).filter((v) => v && v.engagee === true && v.plateforme && v.plateforme !== 'Vinted');
    if (!ailleurs.length || vus.has(String(l.id))) continue;
    vus.add(String(l.id));
    items.push({ id: String(l.id), uid: String(l.compte), num: String(l.numero || '').slice(0, 12), site: String(ailleurs[0].plateforme).slice(0, 20) });
  }
  const manques = Array.isArray(data && data.manques) ? data.manques.map(String) : ['rien lu'];
  return { v: MASQ_V, at: maintenant, items: items.sort((a, b) => a.id.localeCompare(b.id)), complet: !!data && manques.length === 0 };
}
