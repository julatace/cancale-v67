// ════════════════════════════════════════════════════════════════════════════
//  LE CONSEIL DE BAISSE D'UNE PAIRE QUI DORT — MESURÉ (12 nov. 2026, Julien)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « oui, on le garde, mais ça ne doit pas être abusif ». UNE règle, ici :
//   · seulement une paire EN LIGNE depuis au moins 30 jours, sans vente — l'âge
//     LU (date de mise en ligne Vinted ou « Ajouté il y a… » relevé), sinon rien ;
//   · une baisse douce : au plus −10 % du prix actuel, arrondie à l'euro (vers le
//     haut : jamais plus de 10 %) ;
//   · jamais plus d'UNE proposition par paire tous les 14 jours : la date de la
//     dernière baisse LUE (journal des prix lus, prix changés par VRM) ou de la
//     dernière proposition (`vrm_conseil_prix`) ;
//   · jamais sous le prix d'achat + 10 % ; prix d'achat inconnu ⇒ AUCUNE
//     proposition (il le saisit lui-même, CLAUDE.md §2.5 : jamais deviné) ;
//   · une SUGGESTION : « Baisser à 92 € ? » + la raison courte (« en ligne depuis
//     45 j · 3 favoris »). Jamais imposée, jamais rouge, rien n'est envoyé.
// Aucun prix conseillé à la MISE EN LIGNE (refusé le 11 oct.) : une paire neuve
// n'a pas 30 jours, ce module ne lui propose rien.
//
// Module PUR (aucune lecture, aucune écriture) : App.jsx (fiche d'annonce, liste
// « Repricing », baisse eBay en proportion) et scripts/audit-conseil-mesure.cjs
// exécutent les MÊMES fonctions.

export const AGE_MIN_J = 30;          // « en ligne depuis au moins 30 jours »
export const BAISSE_MAX_PCT = 10;     // au plus −10 % par proposition
export const ECART_J = 14;            // une proposition par paire tous les 14 jours
export const MARGE_PLANCHER_PCT = 10; // jamais sous le prix d'achat + 10 %
export const CLE_CONSEIL_PRIX = 'vrm_conseil_prix';
export const MAX_MEMO = 3000;

const JOUR = 86400000;
// Un montant en centimes, ou null (pas su). Accepte un nombre, « 49,90 », { amount }.
export function centimes(v) {
  if (v == null) return null;
  const brut = typeof v === 'object' ? v.amount : v;
  if (brut == null || String(brut).trim() === '') return null;
  const n = typeof brut === 'number' ? brut : Number(String(brut).replace(',', '.').replace(/\s/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// Le plancher : prix d'achat + 10 %, arrondi à l'euro AU-DESSUS (euros entiers), ou null.
export function plancherConseil(achat) {
  const a = centimes(achat);
  if (a == null) return null;
  return Math.ceil(Math.ceil(a * (100 + MARGE_PLANCHER_PCT) / 100) / 100);
}

// La plus petite valeur (euros entiers) qu'une proposition peut atteindre depuis `prix` :
// −10 % arrondi à l'euro AU-DESSUS (une baisse de 10 % au plus, jamais plus).
export function prixMiniPalier(prix) {
  const p = centimes(prix);
  if (p == null) return null;
  return Math.ceil(p * (100 - BAISSE_MAX_PCT) / 10000);
}

// La raison courte : « en ligne depuis 45 j · 3 favoris » (les favoris seulement s'ils ont été lus).
export function raisonConseil(ageJours, favoris) {
  const out = [`en ligne depuis ${ageJours} j`];
  const f = Number(favoris);
  if (favoris != null && Number.isFinite(f) && f >= 0) out.push(f === 0 ? 'aucun favori' : `${f} favori${f > 1 ? 's' : ''}`);
  return out.join(' · ');
}

// La phrase de la suggestion : « Baisser à 92 € ? ».
export const phraseConseil = (sugg) => `Baisser à ${sugg} € ?`;

// La date (ms) de la dernière BAISSE lue d'une annonce, ou null.
//  `journal` : `vrm_prix_lus` ({ v:1, a: { [id]: [[ms, centimes], …] } }) — une baisse est un
//  point plus bas que le précédent, datée par la lecture qui l'a vue ;
//  `historique` : `vinted_prix_historique` ([{ item, avant, apres, at }]) — prix changés depuis VRM.
export function derniereBaisseLue(itemId, journal, historique) {
  const id = String(itemId == null ? '' : itemId);
  if (!id) return null;
  let der = null;
  const pts = journal && journal.a && Array.isArray(journal.a[id]) ? journal.a[id] : [];
  for (let i = 1; i < pts.length; i++) {
    const [t, c] = pts[i] || [], c0 = (pts[i - 1] || [])[1];
    if (Number.isFinite(Number(t)) && Number(c) < Number(c0)) der = Math.max(der ?? 0, Number(t));
  }
  for (const r of (Array.isArray(historique) ? historique : [])) {
    if (!r || String(r.item) !== id) continue;
    const t = Date.parse(r.at || '');
    if (Number.isFinite(t) && Number(r.apres) < Number(r.avant)) der = Math.max(der ?? 0, t);
  }
  return der;
}

// LE CONSEIL D'UNE PAIRE. Rend { sugg, prix, plancher, auPlancher, raison, phrase, nouveau }
// (euros entiers pour `sugg`) — ou { sugg: null, pourquoi } : rien n'est proposé.
//  prix            prix actuel lu (euros, « 49,90 », { amount })
//  ageJours        jours en ligne LUS (null ⇒ rien)
//  achat           prix d'achat SAISI (null ⇒ rien)
//  vendue          une preuve de vente (bordereau…) ⇒ rien
//  favoris         nombre de favoris lu (ou null)
//  derniereBaisse  ms de la dernière baisse lue (ou null)
//  memo            la dernière proposition { at, prix, sugg } (ou null)
export function conseilBaisse({ prix, ageJours, achat, vendue = false, favoris = null, derniereBaisse = null, memo = null, maintenant = Date.now() } = {}) {
  const pC = centimes(prix);
  if (pC == null) return { sugg: null, pourquoi: 'prix' };
  if (vendue) return { sugg: null, pourquoi: 'vendue' };
  const age = ageJours == null || ageJours === '' ? NaN : Number(ageJours);
  if (!Number.isFinite(age) || age < AGE_MIN_J) return { sugg: null, pourquoi: 'age' };
  const plancher = plancherConseil(achat);
  if (plancher == null) return { sugg: null, pourquoi: 'achat' };
  const fenetre = ECART_J * JOUR;
  if (derniereBaisse != null && Number.isFinite(Number(derniereBaisse)) && maintenant - Number(derniereBaisse) < fenetre) return { sugg: null, pourquoi: 'baisse-recente' };
  const raison = raisonConseil(Math.floor(age), favoris);
  const prixE = pC / 100;
  // Une proposition faite il y a moins de 14 jours : la MÊME (si le prix n'a pas bougé), jamais une autre.
  if (memo && Number.isFinite(Number(memo.at)) && maintenant - Number(memo.at) < fenetre) {
    const ms = Math.round(Number(memo.sugg));
    if (centimes(memo.prix) === pC && Number.isFinite(ms) && ms * 100 < pC && ms >= plancher && ms >= prixMiniPalier(prixE)) {
      return { sugg: ms, prix: prixE, plancher, auPlancher: ms === plancher, raison, phrase: phraseConseil(ms), nouveau: false };
    }
    return { sugg: null, pourquoi: 'proposee-recemment' };
  }
  let sugg = prixMiniPalier(prixE);
  let auPlancher = false;
  if (sugg < plancher) { sugg = plancher; auPlancher = true; }
  if (sugg * 100 >= pC) return { sugg: null, pourquoi: 'plancher' };
  return { sugg, prix: prixE, plancher, auPlancher, raison, phrase: phraseConseil(sugg), nouveau: true };
}

// La même baisse, en proportion, sur un AUTRE prix (eBay) : jamais plus de −10 %, jamais
// sous le plancher, jamais un prix égal ou supérieur. null : rien à proposer.
export function baisseProportion(prixAutre, conseil, achat) {
  const p = centimes(prixAutre);
  if (p == null || !conseil || conseil.sugg == null || !(conseil.prix > 0)) return null;
  let s = Math.round((p / 100) * (conseil.sugg / conseil.prix));
  s = Math.max(s, prixMiniPalier(p / 100));
  const pl = plancherConseil(achat);
  if (pl == null) return null;
  if (s < pl) s = pl;
  return s * 100 < p ? s : null;
}

// Le registre des propositions (`vrm_conseil_prix`, synchronisé) :
//   { v: 1, a: { [item_id]: { at, prix, sugg } } }
// Ajoute les propositions NOUVELLES ; rend le même objet si rien n'a changé.
export function noterConseils(memo, propositions, maintenant = Date.now()) {
  const base = memo && memo.v === 1 && memo.a && typeof memo.a === 'object' ? memo : { v: 1, a: {} };
  let a = null;
  for (const [id, c] of (propositions instanceof Map ? propositions : new Map(Object.entries(propositions || {})))) {
    if (!c || !c.nouveau || c.sugg == null) continue;
    if (!a) a = { ...base.a };
    a[String(id)] = { at: maintenant, prix: c.prix, sugg: c.sugg };
  }
  if (!a) return base === memo ? memo : base;
  const ids = Object.keys(a);
  if (ids.length > MAX_MEMO) {
    ids.sort((x, y) => Number(a[y].at) - Number(a[x].at));
    for (const k of ids.slice(MAX_MEMO)) delete a[k];
  }
  return { v: 1, a };
}

// Deux registres (cet appareil · le nuage) : pour chaque paire, la proposition la plus RÉCENTE
// (la plus prudente : elle repousse la suivante le plus loin).
export function fusionConseils(x, y) {
  const ok = (m) => m && m.v === 1 && m.a && typeof m.a === 'object';
  if (!ok(x)) return ok(y) ? y : { v: 1, a: {} };
  if (!ok(y)) return x;
  const a = { ...x.a };
  for (const [k, e] of Object.entries(y.a)) if (!a[k] || Number(e && e.at) > Number(a[k].at)) a[k] = e;
  return { v: 1, a };
}
