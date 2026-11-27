// ═══════════════════════════════════════════════════════════════════════════
// « PAIRES QUI DORMENT » — LE PLAN (27 nov., choix de Julien ; retenu le 11 oct. : « plan des paires qui dorment »)
// ═══════════════════════════════════════════════════════════════════════════
// Ce qui existait (et reste) : le segment « Dorment » d'Annonces (`filtrerArticles` etat 'dorment', seuil réglable),
// « À republier en priorité » (src/republierPriorite.js), la liste « Qui dorment » de l'écran Annonces Vinted d'hier
// (src/quiDorment.js, src/dormantes.js). Ce module ÉTEND : un PLAN, rangé par l'ARGENT qui dort.
//
//   · QUI : un article (§2.11 : l'objet central, tous sites) dont une annonce est EN LIGNE (l'état que <enligne-regle>
//     et chaque site ont donné — jamais « à confirmer », masquée, en pause, bloquée, vendue) depuis PLUS DE 21 JOURS
//     (date de mise en ligne LUE ; inconnue ⇒ hors plan, comptée à part, jamais devinée) ;
//   · RANGÉ PAR l'argent qui dort = le prix d'achat CONNU (§2.5 : jamais deviné, un lot jamais divisé) du plus grand au plus
//     petit ; achat inconnu ⇒ après, « — » et la porte pour le saisir ; à égalité le plus ancien, puis la clé (stable) ;
//   · LE TOTAL : la somme des achats CONNUS, avec la couverture (« sur N ») — jamais un total partiel présenté comme complet ;
//   · VUES ET FAVORIS : le DERNIER JOUR LU de la courbe de l'annonce (`courbes_annonces_{uid}_{nav}`, ext. 5.428,
//     src/courbeAnnonce.js : un point = ce que Vinted a écrit ce jour-là), sinon la lecture du dressing ; jamais interpolés,
//     pas lus ⇒ `null` (« — »), jamais 0 ;
//   · LES GESTES (rien n'est fait ici, chacun est SON toucher, avec les confirmations existantes) :
//       republier (Vinted : l'atelier, `republierDansApp`) · baisser JUSQU'À SON PLANCHER (prix mini, sinon achat + 10 % —
//       `gardePlancher`, la règle de src/gardePrix.js et de `plancherBaisse` ; ni l'un ni l'autre ⇒ aucune baisse) ·
//       offre aux favoris (Vinted : la page favoris du panneau, CETTE annonce). Chacun passe d'abord par LA porte
//       (`peutAgir`, src/agir/peutAgir.js) : non ⇒ lecture seule, le bouton éteint dit pourquoi.
//
// IDENTITÉ (§5) : une ligne est désignée par la clé de l'article ET site:compte:identifiant de SON annonce — jamais par un
// titre. Deux paires au même titre restent deux lignes, chacune avec SES chiffres et SES gestes.
// Module PUR : aucune lecture, aucune écriture, aucune langue. Exécuté par scripts/audit-paires-dorment.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { gardePlancher, gardePrixRegle } from './gardePrix.js';

export const SEUIL_PLAN_JOURS = 21;
const JOUR_MS = 24 * 3600 * 1000;
const RE_ID_COURBE = /^\d{4,15}$/;
const str = (v) => String(v == null ? '' : v).trim();
const centimes = (v) => { if (v == null || v === '' || typeof v === 'boolean' || typeof v === 'object') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null; };
const entier = (v) => (v == null || v === '' || typeof v === 'boolean' ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
export const cleLignePlan = (article, annonce) => str(article && article.cle) + '|' + str(annonce && annonce.site) + ':' + str(annonce && annonce.compte) + ':' + str(annonce && annonce.id);

// ── LES COURBES : UNE lecture projetée pour plusieurs annonces (jamais la ligne entière : 500 annonces × 120 j) ──────────
// `ids` : identifiants d'annonces Vinted ; rend { select, alias: { [id]: 'pN' } } ou null (rien à lire).
export function selectCourbesPlan(ids) {
  const l = [...new Set((Array.isArray(ids) ? ids : []).map(str).filter((x) => RE_ID_COURBE.test(x)))].slice(0, 60);
  if (!l.length) return null;
  const alias = {};
  l.forEach((id, i) => { alias[id] = 'p' + i; });
  return { select: 'id,' + l.map((id, i) => `p${i}:data->a->%22${id}%22`).join(','), alias };
}
const pointValide = (x) => Array.isArray(x) && x.length === 5 && Number.isInteger(x[0]) && x[0] > 0 && [1, 2].every((i) => x[i] === null || (Number.isInteger(x[i]) && x[i] >= 0));
// Le DERNIER jour LU d'une annonce, dans les lignes de SON compte seulement (`courbes_annonces_{uid}_…`) : { j, vues, favoris }
// ou null. Un point qui ne porte ni vues ni favoris ne compte pas ; deux navigateurs : le jour le plus récent, puis la
// minute la plus tardive (la règle de `serieCourbe`). Rien n'est interpolé ni additionné.
export function dernierPointLu(rows, { uid, id, alias } = {}) {
  if (!Array.isArray(rows) || !alias || !alias[str(id)]) return null;
  const k = alias[str(id)], pre = 'courbes_annonces_' + str(uid) + '_';
  if (!str(uid)) return null;
  let m = null;
  for (const r of rows) {
    if (!r || !str(r.id).startsWith(pre) || !Array.isArray(r[k])) continue;
    for (const x of r[k]) {
      if (!pointValide(x) || (x[1] === null && x[2] === null)) continue;
      if (!m || x[0] > m[0] || (x[0] === m[0] && Number(x[4]) > Number(m[4]))) m = x;
    }
  }
  return m ? { j: m[0], vues: m[1], favoris: m[2] } : null;
}

// ── LE PLAN ───────────────────────────────────────────────────────────────────────────────────────────────────────
// `articles` : les articles de src/articles/modele.js. `courbes` : { rows, alias } (lu) · null (pas su) · undefined (en cours).
// Rend null si rien n'est lu ; sinon { seuil, n, sansDate, argentC, achatsConnus, lignes }.
// `comptesExclus` : Set des comptes qui ne vendent pas (rôle « achats », comme « À republier en priorité ») — hors plan.
export function planPairesDorment(articles, { seuil = SEUIL_PLAN_JOURS, maintenant = Date.now(), courbes, comptesExclus = null } = {}) {
  if (!Array.isArray(articles)) return null;
  const s = Number.isFinite(Number(seuil)) && Number(seuil) > 0 ? Number(seuil) : SEUIL_PLAN_JOURS;
  const vus = new Set();
  const lignes = [];
  let sansDate = 0;
  for (const a of articles) {
    if (!a || !Array.isArray(a.annonces)) continue;
    const enLigne = a.annonces.filter((x) => x && x.etat === 'enligne' && str(x.id) && str(x.compte) && !(comptesExclus && comptesExclus.has(str(x.compte))));
    if (!enLigne.length) continue;
    const datees = enLigne.filter((x) => Number.isFinite(Number(x.depuis)) && Number(x.depuis) > 0);
    if (!datees.length) { sansDate++; continue; }
    const plusVieille = datees.reduce((p, q) => (Number(q.depuis) < Number(p.depuis) ? q : p));
    const jours = Math.floor((maintenant - Number(plusVieille.depuis)) / JOUR_MS);
    if (!(jours > s)) continue;
    // L'annonce sur laquelle portent les gestes : la Vinted en ligne (republier, favoris), sinon la plus ancienne.
    const v = enLigne.find((x) => x.site === 'vinted');
    const annonce = v || plusVieille;
    const cle = cleLignePlan(a, annonce);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const achatC = centimes(a.achat);
    const prixC = centimes(annonce.prix);
    const plancher = gardePlancher(centimes(a.prixMini), achatC);
    // La baisse jusqu'au plancher : à l'euro ENTIER au-dessus du plancher (jamais dessous), et seulement si c'est une baisse.
    const versC = plancher && prixC != null ? Math.max(100, Math.ceil(plancher.c / 100) * 100) : null;
    const baisseC = versC != null && versC < prixC ? versC : null;
    const garde = baisseC != null ? gardePrixRegle({ prixC: baisseC, actuelC: prixC, plancher, mode: 'main' }) : null;
    let vues = null, favoris = null, source = '';
    const pt = annonce.site === 'vinted' && courbes && Array.isArray(courbes.rows) ? dernierPointLu(courbes.rows, { uid: annonce.compte, id: annonce.id, alias: courbes.alias }) : null;
    if (pt) { vues = pt.vues; favoris = pt.favoris; source = 'courbe'; }
    if (vues == null && favoris == null) { vues = entier(annonce.vues); favoris = entier(annonce.favoris); source = vues != null || favoris != null ? 'lecture' : ''; }
    lignes.push({ cle, article: a, annonce, site: annonce.site, compte: str(annonce.compte), id: str(annonce.id), numero: str(a.numero), titre: str(a.titre),
      jours, achatC, prixC, plancher, baisseC, aConfirmer: !!(garde && !garde.ok), vues, favoris, source, verif: !!str(annonce.verif) });
  }
  lignes.sort((x, y) => {
    if (x.achatC != null && y.achatC == null) return -1;
    if (x.achatC == null && y.achatC != null) return 1;
    if (x.achatC != null && y.achatC != null && x.achatC !== y.achatC) return y.achatC - x.achatC;
    return y.jours - x.jours || (x.cle < y.cle ? -1 : x.cle > y.cle ? 1 : 0);
  });
  const connus = lignes.filter((l) => l.achatC != null);
  return { seuil: s, n: lignes.length, sansDate, argentC: connus.reduce((t, l) => t + l.achatC, 0), achatsConnus: connus.length, lignes };
}

// ── LES GESTES D'UNE LIGNE ────────────────────────────────────────────────────────────────────────────────────────
// `juger(site, compte, geste, par)` : LA porte (`agirMaintenant`). Rend [{ k, ok, raison, verdict, versC }] — `raison` est un
// code de CE plan ('sans-plancher', 'au-plancher', 'sans-favori', 'favoris-pas-lus', 'verif', 'site') ; `verdict` celui de la
// porte quand c'est elle qui dit non. Republier et favoris : Vinted seulement (aucun autre site ne les a) ; baisser : chaque site.
export function gestesLignePlan(l, juger) {
  if (!l) return [];
  const j = typeof juger === 'function' ? juger : () => ({ ok: false, raison: 'passu' });
  const porte = (site, geste, par) => { const v = j(site, l.compte, geste, par) || { ok: false, raison: 'passu' }; return v.ok ? null : v; };
  const out = [];
  const g = (k, raison, verdict, extra = {}) => out.push({ k, ok: !raison && !verdict, raison: raison || '', verdict: verdict || null, ...extra });
  if (l.site === 'vinted') g('republier', l.verif ? 'verif' : '', l.verif ? null : porte('vinted', 'republier', 'file'));
  if (['vinted', 'leboncoin', 'vestiaire'].includes(l.site)) {
    const r = !l.plancher ? 'sans-plancher' : l.baisseC == null ? 'au-plancher' : l.verif ? 'verif' : '';
    g('baisser', r, r ? null : porte(l.site, 'baisser', 'file'), { versC: l.baisseC, aConfirmer: !!l.aConfirmer });
  }
  if (l.site === 'vinted') {
    const r = l.favoris == null ? 'favoris-pas-lus' : l.favoris === 0 ? 'sans-favori' : l.verif ? 'verif' : '';
    g('favoris', r, r ? null : porte('vinted', 'favoris', 'panneau'));
  }
  return out;
}
// Aucun compte du plan ne peut agir (la porte dit non partout) ⇒ le verdict à dire UNE fois, en tête ; sinon null.
export function lectureSeulePlan(lignes, juger) {
  const l = Array.isArray(lignes) ? lignes : [];
  if (!l.length) return null;
  let premier = null;
  for (const x of l) {
    const gs = gestesLignePlan(x, juger);
    if (gs.some((y) => y.ok)) return null;
    const v = gs.find((y) => y.verdict);
    if (v && !premier) premier = v.verdict;
  }
  return premier;
}
