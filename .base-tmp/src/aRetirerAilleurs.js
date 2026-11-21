// ── « À RETIRER AILLEURS » : UN ENDROIT, UN GESTE PAR SITE (15 nov., lot retrait-ailleurs) ──
// Julien : « je veux que le retrait d'une paire qui est vendue sur Vinted, le retrait sur
// Leboncoin soit hyper intuitif, accompagné par l'application, vraiment beaucoup mieux ».
//
// Module PUR (aucun accès au navigateur, à la base ni à l'extension) : Ma journée, la fiche
// de la paire et `scripts/audit-a-retirer-ailleurs.cjs` exécutent les MÊMES fonctions (§11).
//
// L'ENTRÉE est le plan de src/retirerAilleurs.js (`planRetirerAilleurs`), lui-même tiré de
// `articlesVendusAilleurs` : la vente PROUVÉE (règle `<preuve-vente-regle>` côté Vinted,
// commande eBay engagée, vente Leboncoin vendeur, vente Vestiaire par référence) × l'annonce
// encore en ligne AILLEURS, reliées par l'IDENTITÉ (N° de la fiche, réf. VRM / lien posé,
// SKU `VRM-{n°}`, identifiant d'annonce) — JAMAIS par le titre (§5). Ce module ne rapproche
// rien de neuf : il dit, pour chaque site, OÙ on en est et LE geste qui reste.
//
// Les états d'un site (`etat`) et son geste (`geste`) :
//   · 'aRetirer'   geste 'lbc' (« Retirer de Leboncoin », par l'extension, au nom du compte
//                  de l'onglet) ou 'ebay' (« Retirer d'eBay », la route `retirer`) ;
//   · 'ebayAuto'   le retrait automatique d'eBay est ALLUMÉ : il s'en charge ; « Retirer
//                  maintenant » reste à son doigt ;
//   · 'ebayEnvoye' le retrait automatique l'a déjà demandé à eBay : rien à faire, on attend
//                  la relecture ;
//   · 'main'       VRM n'a pas de voie (Vestiaire, Vinted — §3 —, Leboncoin sans extension) :
//                  geste 'lien' (l'annonce elle-même) + « C'est retiré » sur SON clic ;
//   · 'note'       il a dit « C'est retiré » ; aucune lecture complète de ce site n'est venue
//                  depuis (la prochaine dira) ;
//   · 'onglet'     l'extension n'a trouvé aucun onglet leboncoin.fr connecté sur le bon
//                  compte : « Ouvre leboncoin.fr », VRM reprend tout seul en revenant ;
//   · 'encours'    la demande est partie ; · 'retire' le site a dit oui (`relu` : une lecture
//                  complète APRÈS ne la montre plus) ; · 'incertain' pas de réponse claire
//                  (« regarde avant de recommencer » — jamais un second envoi à l'aveugle) ;
//                  · 'refuse' le site a dit non (« Réessayer ») ;
//   · 'verifier'   « pas su » : lecture ancienne, état pas confirmé, deux annonces sous ce N°,
//                  paire remise en vente, ou VENTE PAS PROUVÉE (peut-être vendue) — aucun geste
//                  de retrait, la raison est dite.

import { FRAIS_MS } from './retirerAilleurs.js';
import { cleNum } from '../api/_lib/numerotation.js';   // (16 nov.) l'identité d'un N° (§5)

const arr = (a) => (Array.isArray(a) ? a : []);
const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const ORDRE_SITES = ['Leboncoin', 'eBay', 'Vestiaire', 'Vinted'];   // l'ordre du plan (src/retirerAilleurs.js)
export const SITE_MARQUE = { Leboncoin: 'leboncoin', eBay: 'ebay', Vestiaire: 'vestiaire', Vinted: 'vinted' };
export const LIEN_SITE = {
  Leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces',
  eBay: 'https://www.ebay.fr/sh/lst/active',
  Vestiaire: 'https://fr.vestiairecollective.com/',
  Vinted: 'https://www.vinted.fr/',
};
// Les réponses de l'extension qui veulent dire « il me faut un onglet leboncoin.fr connecté
// sur le bon compte » (supprimeLbcDepuisApp) : le geste devient « Ouvre leboncoin.fr ».
export const CODES_ONGLET = ['lbc-absent', 'session', 'autre-compte', 'canal'];
// Au plus : une reprise toutes les 15 s, 6 reprises par site (une session qui ne revient pas
// n'est pas relancée sans fin), et seulement sur un signe qu'il est revenu (onglet VRM
// redevenu visible, ou l'extension qui vient de lire leboncoin.fr).
export const REPRISE_MS = 15000;
export const REPRISES_MAX = 6;

// Une marque « C'est retiré » vaut tant qu'aucune lecture COMPLÈTE de ce site et de ce
// compte, faite APRÈS elle, ne montre l'annonce encore en ligne. L'annonce est dans le
// plan ⇒ la dernière lecture la voyait en ligne : si cette lecture est postérieure à la
// marque, la marque est démentie (« encore en ligne à la lecture du … »).
export function marqueValide(site, marque, completes) {
  if (!marque || !fini(Number(marque.at))) return { ok: false, dementie: false };
  const lu = arr(completes).filter((c) => c && c.plateforme === site.plateforme && String(c.compte) === String(site.compte) && fini(c.at)).map((c) => c.at);
  const derniere = lu.length ? Math.max(...lu) : null;
  if (derniere != null && derniere > Number(marque.at)) return { ok: false, dementie: true, lu: derniere };
  return { ok: true, dementie: false };
}

// ctx : { resultats: { [cle]: { statut, texte, at, relu, code } }, enCours: cle | null,
//         attente: { [cle]: { raison, at, n } }, marques: { [cle]: { at, numero } },
//         completes: [{ plateforme, compte, at }], ebayAuto: bool, ebayTentes: Set<itemId> }
export function etatSite(site, ctx = {}) {
  const r = ctx.resultats && ctx.resultats[site.cle];
  const base = { geste: null, texte: site.raison || '', relu: false };
  if (ctx.enCours && ctx.enCours === site.cle) return { ...base, etat: 'encours', texte: '' };
  if (ctx.attente && ctx.attente[site.cle] && site.voie === 'auto') return { ...base, etat: 'onglet', geste: 'lbc', texte: ctx.attente[site.cle].raison || '' };
  if (r && r.statut === 'retire') return { ...base, etat: 'retire', relu: !!r.relu, texte: r.texte || '' };
  if (r && r.statut === 'incertain') return { ...base, etat: 'incertain', geste: 'lien', texte: r.texte || '' };
  if (r && r.statut === 'refuse' && site.voie === 'auto') return { ...base, etat: 'refuse', geste: site.moyen, texte: r.texte || '' };
  if (site.voie === 'verifier') return { ...base, etat: 'verifier' };
  const m = marqueValide(site, ctx.marques && ctx.marques[site.cle], ctx.completes);
  if (m.ok) return { ...base, etat: 'note' };
  const dementie = m.dementie ? { dementieLe: m.lu } : {};
  if (site.voie === 'main') return { ...base, ...dementie, etat: 'main', geste: 'lien' };
  if (site.moyen === 'ebay') {
    if (ctx.ebayAuto && ctx.ebayTentes && typeof ctx.ebayTentes.has === 'function' && ctx.ebayTentes.has(String(site.id))) return { ...base, etat: 'ebayEnvoye' };
    if (ctx.ebayAuto) return { ...base, etat: 'ebayAuto', geste: 'ebay' };
    return { ...base, ...dementie, etat: 'aRetirer', geste: 'ebay' };
  }
  if (site.moyen === 'lbc') return { ...base, ...dementie, etat: 'aRetirer', geste: 'lbc' };
  return { ...base, etat: 'main', geste: 'lien' };
}

// La liste rendue : chaque article (N°) avec ses sites et leur état ; les nombres que
// l'écran affiche ; les sites que « Tout retirer » enchaînerait (dans l'ordre du plan).
// `numero` (facultatif) : un seul N° (la fiche de la paire).
export function listeARetirer(plan, ctx = {}, numero = null) {
  const articles = arr(plan && plan.articles)
    // Un lot « 12+15 » répond à 12 ET à 15 (le N° du plan est déjà une clé `cleNum`).
    .filter((a) => numero == null || cleNum(a.numero) === cleNum(numero) || String(a.numero).split('+').map(cleNum).includes(cleNum(numero)))
    .map((a) => {
      const sites = arr(a.sites).map((s) => ({ ...s, ...etatSite(s, ctx) }));
      return { ...a, douteuse: !!a.douteuse, sites };
    });
  const tous = articles.flatMap((a) => a.sites.map((s) => ({ a, s })));
  const serie = tous.filter(({ s }) => (s.geste === 'lbc' || s.geste === 'ebay') && (s.etat === 'aRetirer' || s.etat === 'ebayAuto')).map(({ a, s }) => ({ numero: a.numero, cle: s.cle }));
  const reste = tous.filter(({ s }) => !['retire', 'note', 'ebayEnvoye'].includes(s.etat));
  return {
    articles,
    serie,
    nSites: tous.length,
    nReste: reste.length,
    nVerifier: tous.filter(({ s }) => s.etat === 'verifier').length,
    nAttente: tous.filter(({ s }) => s.etat === 'onglet').length,
    // Un article dont TOUS les sites sont réglés (retiré, noté) reste montré tant que l'écran
    // a des résultats à dire ; l'écran le range ensuite.
    regles: articles.filter((a) => a.sites.every((s) => ['retire', 'note', 'ebayEnvoye'].includes(s.etat))).map((a) => a.numero),
  };
}

// Les sites en attente d'un onglet leboncoin.fr qui peuvent être repris MAINTENANT.
export function aReprendre(attente, maintenant = Date.now()) {
  return Object.entries(attente || {})
    .filter(([, x]) => x && (Number(x.n) || 0) < REPRISES_MAX && maintenant - (Number(x.at) || 0) >= REPRISE_MS)
    .map(([cle]) => cle);
}

// Une issue de l'extension Leboncoin ⇒ « il faut un onglet » ? (la place est rendue par
// l'extension : rien n'est parti).
export const veutOnglet = (rep) => !!(rep && rep.accepte === false && CODES_ONGLET.includes(String(rep.code || '')));

// La coque pose aussi ses alertes « N à retirer de Leboncoin / d'eBay » (son ancienne règle) :
// une alerte dont CHAQUE N° est déjà dans « À retirer ailleurs » pour CE site n'est pas redite
// (UN endroit). Un N° absent du plan ⇒ l'alerte reste (rien ne disparaît en silence, §4.11).
export function alerteCouverte(plan, plateforme, numeros, cle = (x) => String(x == null ? '' : x).trim().toUpperCase()) {
  const nums = arr(numeros).map(cle).filter(Boolean);
  if (!nums.length) return false;
  const dans = new Set();
  for (const a of arr(plan && plan.articles)) for (const s of arr(a.sites)) if (s.plateforme === plateforme) for (const k of String(a.numero).split('+')) dans.add(cle(k));
  return nums.every((n) => dans.has(n));
}

// Après un retrait, la relecture fait sortir l'annonce du plan (elle n'est plus en ligne) :
// le résultat resterait sans ligne où se dire. Les sites sur lesquels il a agi CETTE session
// (`gardes` : { [cle]: { art, site } }, pris au plan du moment) sont remis dans le plan
// affiché, à leur article — ils se lisent alors « retiré ✓ relu » (src/retirerAilleurs.js,
// `avecRelecture`). Aucun site neuf : seulement ce qui était déjà dans un plan.
export function fusionPlan(plan, gardes) {
  const articles = arr(plan && plan.articles).map((a) => ({ ...a, sites: [...arr(a.sites)] }));
  const parNum = new Map(articles.map((a) => [String(a.numero), a]));
  for (const g of Object.values(gardes || {})) {
    if (!g || !g.art || !g.site) continue;
    let a = parNum.get(String(g.art.numero));
    if (!a) { a = { numero: g.art.numero, venduSur: arr(g.art.venduSur), titre: g.art.titre || '', photo: g.art.photo || null, douteuse: !!g.art.douteuse, sites: [] }; articles.push(a); parNum.set(String(a.numero), a); }
    if (!a.sites.some((s) => s.cle === g.site.cle)) { a.sites.push(g.site); a.sites.sort((x, y) => ORDRE_SITES.indexOf(x.plateforme) - ORDRE_SITES.indexOf(y.plateforme)); }
  }
  return { ...(plan || {}), articles };
}

// « Frais » : la lecture qui prouve l'annonce en ligne a moins de 24 h (même borne que le plan).
export const lectureFraiche = (t, maintenant = Date.now()) => fini(t) && maintenant - t <= FRAIS_MS;
