// ═══════════════════════════════════════════════════════════════════════════
// LES PAIRES À REPUBLIER EN PRIORITÉ (21 nov., choix n° 12 de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « Chaque jour, une liste classée des annonces qui dorment le plus, avec la raison chiffrée » — dans Aujourd'hui
// (une rangée « N paires à republier en priorité › ») et dans Annonces (le segment « À republier »).
//
// UNE SEULE RÈGLE (§5, un propriétaire par notion) :
//   · « qui dort » = la règle du segment « Dorment » (`filtrerArticles` etat 'dorment', src/articles/modele.js : une
//     annonce EN LIGNE, lecture fraîche, dont la date de mise en ligne LUE a au moins `seuil` jours ; date inconnue ⇒
//     dans aucune liste ; « à confirmer » n'y entre jamais) — ici pour le site Vinted seul (l'atelier Republier du
//     panneau de l'extension est celui de Vinted) ;
//   · le seuil EST celui du segment « Dorment » (`vrm_qd_seuil`, 30 / 60 / 90 j — `SEUILS_QUI_DORMENT`) : changer
//     « l'âge mini » ici le change là, et inversement — jamais deux seuils pour une même notion ;
//   · les vues et les favoris sont ceux LUS dans le dressing (`entier`, null = pas lu, jamais 0) ;
//   · « vues qui baissent » vient du journal des vues (`vrm_vues_lues`, src/vuesFavoris.js : un point daté par lecture) :
//     le rythme des vues de la seconde moitié de la période suivie est moins de la moitié de celui de la première.
//     Moins de trois points, ou une période trop courte ⇒ `null` (pas su — jamais « elles baissent » sur un doute).
//
// JAMAIS PROPOSÉE (chaque écart est COMPTÉ et dit, jamais caché en silence) :
//   vendue (une annonce de l'article est vendue, sur n'importe quel site) · masquée par Vinted · en litige / retour en
//   cours (son N° ou son identifiant d'annonce, `enLitige`) · d'un compte bloqué (en pause ou bloqué par Vinted) · d'un
//   compte PERSONNEL (src/rolesComptes.js) · d'un compte autre que de vente.
//
// LE CLASSEMENT, en « jours équivalents » (un nombre qu'on peut refaire à la main) :
//   score = jours en ligne
//         + 14 si 0 favori LU            (personne ne l'a gardée)
//         − 7 par favori LU, 4 au plus   (des gens l'attendent : moins pressé)
//         + 14 si les vues baissent      (Vinted la montre de moins en moins)
//         + 7 si moins d'une vue par jour LUE
//   Ordre : score décroissant, puis la plus ancienne, puis son identité (stable d'un jour à l'autre).
//   Le classement ne relie rien et ne décide rien : il range ce qu'il PROPOSE.
// Puis les `parJour` premières (5 / 10 / 20 / 50, 10 par défaut) : la liste du jour.
//
// RIEN NE PART D'ICI (§3 : republication à l'aveugle refusée). L'écran coche, « Republier N » ouvre l'atelier
// Republier du panneau de l'extension avec ces annonces présélectionnées (src/ouvrirPanneau.js) ; c'est LUI qui lance
// dans le panneau. Module PUR (hors `publier…`/`lire…`), exécuté par scripts/audit-republier-priorite.cjs.
import { filtrerArticles, JOUR_MS, cleDefaut } from './articles/modele.js';
import { SEUILS_QUI_DORMENT, seuilValide } from './quiDorment.js';

export const SEUILS_AGE = SEUILS_QUI_DORMENT;               // l'âge mini = le seuil du segment « Dorment »
export const PAR_JOUR_CHOIX = [5, 10, 20, 50];
export const REGLAGE_PRIO_DEFAUT = Object.freeze({ jours: 30, parJour: 10 });
export const CLE_SEUIL_DORMENT = 'vrm_qd_seuil';            // le seuil partagé avec « Dorment » (cet appareil)
export const CLE_PAR_JOUR = 'vrm_repub_priorite_n';          // le nombre par jour (cet appareil)
export const CLE_PUBLICATION_PRIO = 'vrm_repub_priorite';    // ce qu'Annonces publie pour Aujourd'hui (cet appareil)
export const EVT_REPUB_PRIORITE = 'vrm:repub-priorite';
export const EXCLUSIONS = ['vendue', 'masquee', 'litige', 'bloque', 'perso'];
export const POIDS = Object.freeze({ zeroFavori: 14, parFavori: 7, favorisMax: 4, baisse: 14, peuVue: 7 });

const str = (v) => (v == null ? '' : String(v).trim());
const entier = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const ensemble = (s) => (s instanceof Set ? s : new Set(Array.isArray(s) ? s.map(String) : []));

// Lecture tolérante d'un réglage : hors des choix ⇒ le défaut (jamais un seuil inventé).
export function lireReglagePrio({ jours, parJour } = {}) {
  return {
    jours: jours == null || jours === '' ? REGLAGE_PRIO_DEFAUT.jours : seuilValide(jours),
    parJour: PAR_JOUR_CHOIX.includes(Number(parJour)) ? Number(parJour) : REGLAGE_PRIO_DEFAUT.parJour,
  };
}

// LES VUES BAISSENT-ELLES ? `serie` : [[ms, vues|null, favoris|null], …] (le journal `vrm_vues_lues` d'UNE annonce).
// Rend true / false, ou null quand ce n'est pas su (moins de 3 points de vues, ou une moitié de moins de 2 jours).
export const BAISSE_MIN_JOURS = 2;
export function vuesEnBaisse(serie) {
  const pts = (Array.isArray(serie) ? serie : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && entier(p[1]) != null)
    .map((p) => ({ t: p[0], v: entier(p[1]) })).sort((a, b) => a.t - b.t);
  if (pts.length < 3) return null;
  const a = pts[0], z = pts[pts.length - 1];
  const milieu = a.t + (z.t - a.t) / 2;
  // Le point le plus proche du milieu, ni le premier ni le dernier.
  let m = pts[1];
  for (const p of pts.slice(1, -1)) if (Math.abs(p.t - milieu) < Math.abs(m.t - milieu)) m = p;
  const d1 = (m.t - a.t) / JOUR_MS, d2 = (z.t - m.t) / JOUR_MS;
  if (d1 < BAISSE_MIN_JOURS || d2 < BAISSE_MIN_JOURS) return null;
  const r1 = (m.v - a.v) / d1, r2 = (z.v - m.v) / d2;
  if (!(r1 > 0)) return false;           // aucune vue gagnée avant : rien ne « baisse »
  return r2 < r1 / 2;
}

// Le score d'une annonce (les poids ci-dessus) ; `jours` connu (la règle « Dorment » l'a lu).
export function scorePriorite({ jours, vues = null, favoris = null, baisse = null }) {
  const f = entier(favoris), v = entier(vues);
  let s = Number(jours) || 0;
  if (f === 0) s += POIDS.zeroFavori;
  else if (f != null) s -= POIDS.parFavori * Math.min(f, POIDS.favorisMax);
  if (baisse === true) s += POIDS.baisse;
  if (v != null && jours > 0 && v / jours < 1) s += POIDS.peuVue;
  return s;
}

// `articles` : `construireArticles(...).articles` (src/articles/modele.js). `null`/`undefined` ⇒ rendu tel quel (pas lu ≠ rien).
// opts : { jours, parJour, maintenant, cle (`cleNum`), comptesBloques (Set d'uid), comptesPersonnels (Set d'uid),
//          comptesHorsVente (Set d'uid : achats), enLitige ({ nums: Set de clés N°, ids: Set d'identifiants d'annonce } | null),
//          journalVues (`vrm_vues_lues`.a : { 'vinted#id': série }) }
// Rend { n (proposables), liste (les `parJour` premières, classées), classees (toutes, classées), reste, exclues: { vendue, masquee, litige, bloque, perso },
//        sansCompteur (proposables dont vues ou favoris ne sont pas lus), reglage }.
export function republierEnPriorite(articles, opts = {}) {
  if (!Array.isArray(articles)) return articles === undefined ? undefined : null;
  const reglage = lireReglagePrio(opts);
  const maintenant = Number.isFinite(opts.maintenant) ? opts.maintenant : Date.now();
  const cle = typeof opts.cle === 'function' ? opts.cle : cleDefaut;
  const bloques = ensemble(opts.comptesBloques), perso = ensemble(opts.comptesPersonnels), horsVente = ensemble(opts.comptesHorsVente);
  const litige = opts.enLitige && typeof opts.enLitige === 'object' ? { nums: ensemble(opts.enLitige.nums), ids: ensemble(opts.enLitige.ids) } : null;
  const J = opts.journalVues && typeof opts.journalVues === 'object' ? opts.journalVues : {};
  const exclues = { vendue: 0, masquee: 0, litige: 0, bloque: 0, perso: 0 };
  const proposables = [];
  let sansCompteur = 0;
  for (const a of articles) {
    if (!a || !Array.isArray(a.annonces)) continue;
    // Une annonce Vinted assez ancienne mais MASQUÉE par Vinted, ou d'un compte BLOQUÉ mis en pause (sa dernière trace) : elle
    // n'est pas « en ligne », la règle « Dorment » ne la voit pas — elle est COMPTÉE parmi les écartées (dite, jamais cachée).
    const vieille = (etat) => a.annonces.some((y) => y.site === 'vinted' && y.etat === etat && y.depuis != null && maintenant - y.depuis >= reglage.jours * JOUR_MS);
    // LA règle « Dorment », au site Vinted.
    if (!filtrerArticles([a], { site: 'vinted', etat: 'dorment', seuil: reglage.jours, maintenant, cle }).length) {
      if (vieille('masquee')) exclues.masquee += 1; else if (vieille('bloque')) exclues.bloque += 1;
      continue;
    }
    // L'annonce à republier : SA plus ancienne annonce Vinted en ligne (la règle ci-dessus a dit qu'elle dort ; on ne la redit pas).
    const enLigne = a.annonces.filter((x) => x.site === 'vinted' && x.etat === 'enligne' && x.depuis != null)
      .sort((x, y) => x.depuis - y.depuis || (str(x.id) < str(y.id) ? -1 : 1));
    const x = enLigne[0];
    if (!x) continue;
    const compte = str(x.compte);
    let raison = '';
    if (a.annonces.some((y) => y.etat === 'vendue')) raison = 'vendue';
    else if (a.annonces.some((y) => y.site === 'vinted' && y.etat === 'masquee')) raison = 'masquee';
    else if (litige && (litige.ids.has(str(x.id)) || (cle(a.numero) && litige.nums.has(cle(a.numero))))) raison = 'litige';
    else if (bloques.has(compte) || a.annonces.some((y) => y.etat === 'bloque')) raison = 'bloque';
    else if (perso.has(compte) || horsVente.has(compte)) raison = 'perso';
    if (raison) { exclues[raison] += 1; continue; }
    const jours = Math.floor((maintenant - x.depuis) / JOUR_MS);
    const vues = entier(x.vues), favoris = entier(x.favoris);
    const baisse = vuesEnBaisse(J['vinted#' + str(x.id)]);
    if (vues == null || favoris == null) sansCompteur += 1;
    proposables.push({ cle: a.cle, article: a, annonce: { id: str(x.id), compte, pseudo: str(x.pseudo) }, numero: str(a.numero),
      jours, vues, favoris, baisse, score: scorePriorite({ jours, vues, favoris, baisse }) });
  }
  proposables.sort((p, q) => q.score - p.score || q.jours - p.jours || (p.annonce.id < q.annonce.id ? -1 : p.annonce.id > q.annonce.id ? 1 : 0));
  proposables.forEach((p, i) => { p.rang = i + 1; });
  const liste = proposables.slice(0, reglage.parJour);
  return { n: proposables.length, liste, classees: proposables, reste: proposables.length - liste.length, exclues, sansCompteur, reglage };
}

// LA RAISON d'une ligne, en morceaux (l'écran les dit dans sa langue) : « 41 j · 136 vues · 0 favori · vues qui baissent ».
// Un compteur pas lu ⇒ son morceau « pas lu » (jamais 0).
export function raisonPriorite(l) {
  if (!l) return [];
  const out = [{ k: 'jours', n: l.jours }];
  out.push(l.vues == null ? { k: 'vuesPasLues' } : { k: 'vues', n: l.vues });
  out.push(l.favoris == null ? { k: 'favorisPasLus' } : { k: 'favoris', n: l.favoris });
  if (l.baisse === true) out.push({ k: 'baisse' });
  return out;
}

// LE GESTE : les identifiants Vinted des lignes cochées, d'UN compte (l'atelier agit au nom du compte de l'onglet,
// `garde` de l'extension). Plusieurs comptes ⇒ refus nommé (rien n'est ouvert) ; aucune ⇒ refus.
// Rend { ok, ids, compte } ou { ok: false, raison: 'aucune' | 'comptes' }.
export function selectionRepublier(lignes, coches) {
  const C = coches instanceof Set ? coches : new Set(coches || []);
  const choisies = (Array.isArray(lignes) ? lignes : []).filter((l) => l && C.has(l.cle));
  if (!choisies.length) return { ok: false, raison: 'aucune' };
  const comptes = [...new Set(choisies.map((l) => l.annonce.compte))];
  if (comptes.length > 1) return { ok: false, raison: 'comptes', comptes };
  return { ok: true, ids: choisies.map((l) => l.annonce.id), compte: comptes[0] };
}

// ── Publication (un propriétaire : l'écran Annonces ; un lecteur : Aujourd'hui) — cet appareil, CE compte VRM ──
// Une lecture ratée (`res` null/undefined) ne publie rien : la publication d'avant reste, avec son heure.
export function publierPriorite(res, { owner = '', maintenant = Date.now() } = {}) {
  if (!res || !Number.isFinite(res.n)) return false;
  const p = { owner: String(owner || ''), n: res.n, montres: res.liste.length, jours: res.reglage.jours, parJour: res.reglage.parJour, at: maintenant };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_PUBLICATION_PRIO) || 'null');
    if (avant && JSON.stringify({ ...avant, at: 0 }) === JSON.stringify({ ...p, at: 0 })) return false;
    localStorage.setItem(CLE_PUBLICATION_PRIO, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_REPUB_PRIORITE, { detail: p })); } catch (_) {}
  return true;
}
// null = jamais publiée pour CE compte VRM (Aujourd'hui ne dit alors rien : pas su ≠ zéro).
export function lirePriorite(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PUBLICATION_PRIO) || 'null');
    if (!p || typeof p !== 'object' || String(p.owner || '') !== String(owner || '') || !Number.isFinite(p.n)) return null;
    return p;
  } catch (_) { return null; }
}
// Ce qu'Aujourd'hui montre : la rangée seulement s'il y a au moins une paire proposée (les « montres » du jour).
export const rangeeAujourdhui = (p) => (p && p.montres > 0 ? { n: p.montres, total: p.n, jours: p.jours } : null);
