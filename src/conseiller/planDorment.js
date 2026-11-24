// ═══════════════════════════════════════════════════════════════════════════
//  LE PLAN DES PAIRES QUI DORMENT (24 nov., Julien : « paires qui dorment → plan », retenu le 11 oct.)
//  docs/passation/2026-11-24-paires-dorment.md
// ═══════════════════════════════════════════════════════════════════════════
// Chaque matin : les paires en ligne depuis longtemps avec peu de vues ou de favoris, et pour CHACUNE UNE action
// proposée sur SES chiffres — baisser le prix, offre aux favoris, republier, ou la mettre aussi sur un autre site.
// Il valide d'un toucher ; RIEN ne part d'ici (le toucher ouvre le chemin gardé existant : panneau de l'extension,
// compte de l'onglet, plafonds — ou l'écran VRM du site pour la préparer).
// Module PUR : aucune lecture, aucune écriture, aucune langue. Exécuté par scripts/audit-plan-dorment.cjs.
//
// LES SEUILS VIENNENT DE SES DONNÉES (mesure du 24 nov., base réelle, lecture seule, comptes seulement — le récit) :
//   · ses annonces sont JEUNES (il republie) : médiane 10 j en ligne, 90 % sous 17 j ; une seule à 30 j ⇒ la règle
//     « 30 jours » d'Annonces ne lui montrerait qu'une paire. Ses vues par jour tombent de ~10/j la 1re semaine à
//     ~2-3/j ensuite (médianes 9,9 · 2,0 · 2,9 pour 0-7 · 7-14 · 14-21 j) ⇒ une annonce « a eu sa chance » à 14 j
//     (`AGE_MIN_J`), c'est aussi l'écart minimum entre deux baisses (`ECART_J`, src/conseilPrix.js) ;
//   · « peu » = le QUART le plus bas de SES annonces de 14 j et plus, recalculé chaque matin (vues par jour, favoris
//     par jour) : aucun nombre fixe inventé ; moins de `POP_MIN` annonces comparables ⇒ pas de plan (« pas assez de
//     recul »), jamais un seuil deviné.
// « PAS SU » N'EST JAMAIS « DORT » (§5) : âge pas lu, vues pas lues (Vinted rend 0 ⇒ `null`, mapWardrobeItem),
// favoris pas lus ⇒ la paire est comptée à part (`passu`), jamais dans le plan, jamais dans un quartile.
// IDENTITÉ (§5) : une ligne = compte Vinted + identifiant d'annonce (chiffres) ; jamais un titre. Sans identifiant
// lisible ⇒ hors du plan.
// LA BAISSE (§3 « baisses irrégulières », 12 nov. « pas abusif ») : les bornes de src/conseilPrix.js — en ligne depuis
// `AGE_BAISSE_J` (30 j), au plus −10 %, une par paire tous les 14 j, jamais sous le plancher : le plus haut de
// (achat + 10 % — `plancherConseil`), (achat + frais connus — `plancherVente`), (SON prix mini posé à côté du N°).
// Prix d'achat pas saisi ⇒ AUCUNE baisse (§2.5). Le pourcentage varie d'une paire à l'autre (entre 6 et 10 %, tiré de
// l'identifiant : stable pour une paire, différent d'une paire à l'autre), jamais un rond deviné.
// L'EFFET ATTENDU : seulement s'il est MESURÉ dans son historique (`effet`) — aucune source datée de « geste ⇒ vente »
// n'existe en base au 24 nov. (mesuré : aucun historique de prix ni journal de republication relié aux ventes) ⇒ aucune
// promesse affichée.
import { AGE_MIN_J as AGE_BAISSE_J, BAISSE_MAX_PCT, ECART_J, plancherConseil, centimes } from '../conseilPrix.js';

export const AGE_MIN_J = 14;       // « en ligne depuis longtemps » pour LUI (mesuré)
export const QUARTILE = 0.25;      // « peu » = le quart le plus bas de ses annonces comparables
export const POP_MIN = 8;          // annonces comparables (≥ 14 j, vues ET favoris lus) pour parler d'un quartile
export const MAX_PLAN = 8;         // une courte liste du matin (5 à 10)
export const BAISSE_MIN_PCT = 6;   // la baisse varie entre 6 et 10 % (BAISSE_MAX_PCT)
export { AGE_BAISSE_J };
const JOUR = 86400000;

const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const lu = (v) => { if (v == null || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const idOk = (id) => /^\d{1,20}$/.test(String(id == null ? '' : id));
export const cleLigne = (l) => `${String((l && l.uid) || '')}:${String((l && l.id) || '')}`;

// Le quantile (interpolation linéaire, la même que percentile_cont de la mesure).
export function quantile(valeurs, q) {
  const v = (Array.isArray(valeurs) ? valeurs : []).filter(fini).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q, b = Math.floor(pos), r = pos - b;
  return v[b + 1] !== undefined ? v[b] + r * (v[b + 1] - v[b]) : v[b];
}

// Les chiffres d'une ligne : âge, vues et favoris par jour — ou null (pas su).
function mesures(l) {
  const age = lu(l && l.age), vues = lu(l && l.vues), fav = lu(l && l.favoris);
  return { age, vues, fav, vj: age != null && vues != null ? vues / Math.max(1, age) : null, fj: age != null && fav != null ? fav / Math.max(1, age) : null };
}

// LES SEUILS DU MATIN, sur SES annonces comparables.
export function seuilsDormir(lignes) {
  if (!Array.isArray(lignes)) return { etat: 'passu', n: 0 };
  const P = [];
  for (const l of lignes) {
    if (!l || !idOk(l.id)) continue;
    const m = mesures(l);
    if (m.age == null || m.age < AGE_MIN_J || m.vj == null || m.fj == null) continue;
    P.push(m);
  }
  if (P.length < POP_MIN) return { etat: 'peu', n: P.length, min: POP_MIN };
  return { etat: 'su', n: P.length, vuesJour: quantile(P.map((m) => m.vj), QUARTILE), favorisJour: quantile(P.map((m) => m.fj), QUARTILE) };
}

// L'état d'une ligne : 'identite' · 'passu' · 'jeune' · 'dort' · 'eveillee'.
export function etatLigne(l, S) {
  if (!l || !idOk(l.id)) return 'identite';
  const m = mesures(l);
  if (m.age == null) return 'passu';
  if (m.age < AGE_MIN_J) return 'jeune';
  if (m.vj == null || m.fj == null) return 'passu';
  if (!S || S.etat !== 'su') return 'passu';
  return m.vj <= S.vuesJour || m.fj <= S.favorisJour ? 'dort' : 'eveillee';
}

// Le plancher d'une baisse (centimes) : le plus haut de ses bornes ; achat pas saisi ⇒ null (aucune baisse).
export function plancherBaisse({ achat = null, plancherVente = null, mini = null } = {}) {
  const pc = plancherConseil(achat);
  if (pc == null) return null;
  let p = pc * 100;
  const pv = Number(plancherVente); if (Number.isFinite(pv) && pv > p) p = Math.round(pv);
  const mi = centimes(mini); if (mi != null && mi > p) p = mi;
  return p;
}
// Un pourcentage stable par paire, entre 6 et 10 % (au centième) : les baisses ne se ressemblent pas d'une paire à l'autre.
export function pctDe(id) {
  let h = 2166136261;
  for (const c of String(id == null ? '' : id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return BAISSE_MIN_PCT + (h % ((BAISSE_MAX_PCT - BAISSE_MIN_PCT) * 100 + 1)) / 100;
}
// LA BAISSE PROPOSÉE : { sugg (euros), pct, plancher (euros) } ou { sugg: null, pourquoi }.
export function baisseProposee({ id, prix, age, achat = null, plancherVente = null, mini = null, derniereBaisse = null, maintenant = Date.now() } = {}) {
  const p = centimes(prix);
  if (p == null) return { sugg: null, pourquoi: 'prix' };
  const a = lu(age);
  if (a == null || a < AGE_BAISSE_J) return { sugg: null, pourquoi: 'age' };
  const pl = plancherBaisse({ achat, plancherVente, mini });
  if (pl == null) return { sugg: null, pourquoi: 'achat' };
  if (derniereBaisse != null && Number.isFinite(Number(derniereBaisse)) && maintenant - Number(derniereBaisse) < ECART_J * JOUR) return { sugg: null, pourquoi: 'baisse-recente' };
  const pct = pctDe(id);
  // Au dixième d'euro AU-DESSUS : la baisse n'excède jamais le pourcentage tiré (ni −10 %).
  let s = Math.ceil((p * (1 - pct / 100)) / 10) * 10;
  if (s < pl) s = pl;
  if (s > p - 100) return { sugg: null, pourquoi: 'plancher' };   // moins d'1 € de baisse possible : déjà à son plancher
  return { sugg: s / 100, pct: Math.round(((p - s) / p) * 1000) / 10, plancher: pl / 100 };
}

// LES SITES où la mettre AUSSI : ceux qu'il a (`sites`, ses comptes reliés / plateformes affichées ; null = pas su ⇒
// aucun), où elle n'est PAS déjà (`sur.lbc === false` lu ; `null` = pas su ⇒ pas proposé).
const SITES = [['leboncoin', 'surLbc', 'lbc'], ['vestiaire', 'surVc', 'vestiaire'], ['ebay', 'surEbay', 'ebay']];

// L'ACTION UNIQUE d'une paire qui dort. `ctx` : { bloque: { favoris, republier, baisser, prix } (raison ou ''),
// sites: ['leboncoin', …] | null, maintenant }.
export function actionPour(l, S, ctx = {}) {
  const m = mesures(l);
  const bl = (k) => (ctx.bloque && ctx.bloque[k]) || '';
  const peuVue = S && S.etat === 'su' && m.vj != null && m.vj <= S.vuesJour;
  const b = baisseProposee({ id: l.id, prix: l.prix, age: l.age, achat: l.achat, plancherVente: l.plancherVente, mini: l.mini, derniereBaisse: l.derniereBaisse, maintenant: ctx.maintenant || Date.now() });
  const baisse = b.sugg != null ? { k: 'baisser', sugg: b.sugg, pct: b.pct, plancher: b.plancher, bloque: bl('baisser') } : null;
  const ailleurs = Array.isArray(ctx.sites) ? SITES.filter(([s, champ]) => ctx.sites.includes(s) && l[champ] === false).map(([s, , k]) => ({ k, site: s, bloque: '' })) : [];
  const cand = [];
  let pourquoi;
  if (peuVue) { pourquoi = 'vues'; cand.push({ k: 'republier', bloque: bl('republier') }, ...ailleurs); }
  else if (m.fav != null && m.fav > 0) { pourquoi = 'favoris'; cand.push({ k: 'favoris', bloque: bl('favoris') }); if (baisse) cand.push(baisse); }
  else { pourquoi = 'sansFavoris'; if (baisse) cand.push(baisse); cand.push({ k: 'prix', bloque: bl('prix') }); }
  const g = cand.find((x) => !x.bloque) || cand[0] || null;
  if (!g) return null;
  return { ...g, pourquoi, baisseRefus: baisse ? '' : b.pourquoi, effet: null };
}

// LE PLAN DU MATIN. `lignes` : les annonces EN LIGNE (la base d'Annonces, `<enligne-regle>`), chacune
// { id, uid, compte, numero, photo, prix, age, vues, favoris, achat, plancherVente, mini, derniereBaisse, surLbc, surVc, surEbay }.
// Rend { etat: 'su' | 'peu' | 'passu', seuils, total, passu, jeunes, dorment, lignes (≤ MAX_PLAN) }.
export function planDuMatin(lignes, ctx = {}) {
  if (!Array.isArray(lignes)) return { etat: 'passu', seuils: null, total: 0, passu: 0, jeunes: 0, dorment: 0, lignes: [] };
  const vus = new Set(), propres = [];
  for (const l of lignes) { if (!l || !idOk(l.id)) continue; const k = cleLigne(l); if (vus.has(k)) continue; vus.add(k); propres.push(l); }
  const S = seuilsDormir(propres);
  let passu = 0, jeunes = 0;
  const dort = [];
  for (const l of propres) {
    const e = etatLigne(l, S);
    if (e === 'passu') passu += 1; else if (e === 'jeune') jeunes += 1; else if (e === 'dort') dort.push(l);
  }
  const m = (l) => mesures(l);
  dort.sort((x, y) => m(x).vj - m(y).vj || m(x).fj - m(y).fj || m(y).age - m(x).age || (cleLigne(x) < cleLigne(y) ? -1 : cleLigne(x) > cleLigne(y) ? 1 : 0));
  const out = [];
  for (const l of dort) {
    if (out.length >= MAX_PLAN) break;
    const a = actionPour(l, S, ctx);
    if (!a) continue;
    const x = m(l);
    out.push({ cle: cleLigne(l), id: String(l.id), uid: String(l.uid || ''), compte: String(l.compte || ''), numero: String(l.numero || ''), photo: typeof l.photo === 'string' ? l.photo : '',
      prix: centimes(l.prix) == null ? null : centimes(l.prix) / 100, age: x.age, vues: x.vues, favoris: x.fav, action: a });
  }
  return { etat: S.etat === 'su' ? 'su' : S.etat, seuils: S, total: propres.length, passu, jeunes, dorment: dort.length, lignes: out };
}
