// ═══════════════════════════════════════════════════════════════════════════
// ANNONCES : SÉLECTIONNER, PUIS « ACTIONS POSSIBLES » (5 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (pages du 5 nov. + vocal) : « les brouillons ET les annonces masquées
// apparaissent et se sélectionnent (sauf celles en vérification par Vinted) ;
// un petit carré « Actions » qui propose, selon la sélection : republier, en
// ligne → brouillon, brouillon → en ligne, en ligne → en ligne avec les
// modifications, republier à la main avec le suivi ». « Séparer vraiment les
// comptes : les brouillons ne sont pas les mêmes d'un compte à l'autre ; la
// republication ne marche pas d'un compte à l'autre. »
//
// Règles PURES (aucune lecture), exécutées par scripts/audit-annonces-actions.cjs.
// Elles ne refont AUCUN moteur : chaque action renvoie à un geste qui existe
// déjà (`ACTIONS_REPUB` de l'app : recreer · modifier · versBrouillon · enLigne)
// ou au parcours « à la main » (rien ne part chez Vinted).

// L'état d'une annonce de son dressing. `verification` d'abord : Vinted la
// vérifie (`is_processing`, ou une alerte posée sur l'annonce, `item_alert_type`
// — deux champs que Vinted envoie dans le dressing, mesurés le 5 nov. sur deux
// annonces non allégées). ⚠️ L'extension (5.3xx) ne GARDE pas encore ces deux
// champs (`CHAMPS_ARTICLE`) : tant qu'elle ne les garde pas, aucune annonce n'est
// dite « en vérification » (pas su ≠ oui) — et l'extension revérifie tout au
// lancement de toute façon.
import { motsNavigateur } from './navigateurExtension.js';
// (11 nov., famille « N° par cleNum ») l'identité d'un N° : la règle `cleNum` (api/_lib/numerotation.js),
// recopiée ici car des audits chargent ce module SEUL ; scripts/audit-numeros-clenum.cjs vérifie qu'elle rend la même chose.
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
export const ETATS_ANNONCE = {
  'en-ligne': 'En ligne',
  brouillon: 'Brouillon',
  masquee: 'Masquée',
  verification: 'En vérification par Vinted',
};
export function enVerificationVinted(it) {
  if (!it || typeof it !== 'object') return false;
  if (it.verifVinted) return true;
  if (it.is_processing === true) return true;
  const a = it.item_alert_type;
  return typeof a === 'string' && a.trim() !== '';
}
export function etatAnnonceVinted(it) {
  if (!it) return '';
  if (enVerificationVinted(it)) return 'verification';
  if (it._vrmBrouillon || it.is_draft) return 'brouillon';
  if (it._vrmMasquee || it.is_hidden) return 'masquee';
  return 'en-ligne';
}
// (revue du 5 nov.) Ce que le DRESSING dit de la couleur, de la catégorie et de
// l'état, pour « vérifier avant ». Mesuré sur la base (5 nov.) : un dressing non
// allégé envoie `color1: null`, `color1_id: null`, `catalog_id: null` sur des
// annonces qui ONT une couleur et une catégorie — le dressing ne les remplit pas.
// Un `null` y est donc « pas su », jamais « absent » : seule une valeur lue compte.
export function lusDuDressing(it) {
  const x = it && typeof it === 'object' ? it : {};
  const v = (k) => (x[k] != null && String(x[k]).trim() !== '' ? String(x[k]) : '');
  const couleur = v('color1') || v('color1_id');
  return {
    statusLu: x.status != null,
    catalogId: v('catalog_id') || undefined,
    couleur: couleur || undefined,
  };
}
// Une annonce se coche-t-elle ? Toutes, sauf celles que Vinted vérifie.
export function raisonPasSelectionnable(etat) {
  return etat === 'verification' ? 'Vinted la vérifie : rien ne peut partir tant que ce n’est pas fini.' : '';
}

// Les actions, dans l'ordre du carré. `etats` = les états qu'elle accepte ;
// `robot` = elle part chez Vinted par l'extension (compte de Chrome exigé) ;
// `cap` = la capacité d'extension qu'elle demande (`EXT_CAPACITES` de l'app) ;
// `parPaire` = plusieurs annonces, traitées une par une (comptes mélangés permis).
// (5 nov., chantier C — revue 2.5) QUATRE libellés, les mêmes partout : ceux de
// l'ancienne feuille « Republier et brouillons » qui parlaient à Julien
// (« Modifier prix ou titre ») et deux verbes pour les passages d'état — plus de
// flèches « En ligne → en ligne, avec tes modifications ».
export const ACTIONS_SELECTION = [
  { k: 'recreer', titre: 'Republier', desc: 'Supprimer et recréer : favoris et vues repartent de zéro.', etats: ['en-ligne'], robot: true, cap: 'recreer' },
  { k: 'modifier', titre: 'Modifier prix ou titre', desc: 'Sur place : favoris et vues gardés.', etats: ['en-ligne'], robot: true, cap: 'republiermodif' },
  { k: 'versBrouillon', titre: 'Mettre en brouillon', desc: 'Retirée de la vente, gardée dans tes brouillons Vinted.', etats: ['en-ligne'], robot: true, cap: 'versbrouillon' },
  { k: 'enLigne', titre: 'Mettre en ligne', desc: 'Le brouillon part tel qu’il est enregistré sur Vinted.', etats: ['brouillon'], robot: true, cap: 'brouillon' },
  // Pas une cinquième tuile : un lien discret sous les quatre (rien ne part chez Vinted d'ici).
  // (6 nov., sa demande : « régler comme quand c'est VRM qui fait ») Plusieurs annonces à
  // la fois, traitées UNE PAR UNE dans la feuille (« paire 2/5 », Suivante) ; chacune dit
  // son compte : rien ne part chez Vinted d'ici, le compte de Chrome ne décide rien.
  // `parPaire` : comptes mélangés permis, mais chaque annonce doit avoir SON compte connu.
  { k: 'main', titre: 'Republier à la main', desc: 'VRM te donne les photos réglées, le titre, la description et le prix (mêmes réglages que Republier) ; puis remet le N° sur la nouvelle annonce.', etats: ['en-ligne', 'masquee', 'brouillon'], robot: false, parPaire: true, lien: true },
  // (6 nov., vague 2 · point 2) « Prix mini… » : poser « Accepter dès » (et, s'il le
  // veut, « Refuser sous ») sur TOUTES les annonces cochées, depuis leur prix. Rien
  // ne part chez Vinted (une écriture dans ses fiches, `updatePair` … `min`/`refuse`,
  // la même que la case de la carte) : ni robot, ni compte du navigateur, et
  // plusieurs comptes à la fois sont permis. Un lien sous les quatre tuiles, comme
  // « à la main » (les quatre tuiles restent celles des moteurs, chantier C).
  // (10 nov., lot C) « Baisser le prix… » : −X € ou −X % sur les annonces cochées, UNE par UNE
  // par l'extension (5.336, `baisserPrixVinted`), prix relu. Un lien sous les tuiles, comme
  // « à la main » : comptes mélangés permis (`parPaire`) — dans la feuille, une annonce d'un
  // autre compte que celui de l'onglet est dite « Ouvre ce compte » et ne part JAMAIS.
  { k: 'baisser', titre: 'Baisser le prix…', desc: '−X € ou −X % sur les annonces cochées, une par une, prix relu sur Vinted.', etats: ['en-ligne'], robot: false, parPaire: true, lien: true, cap: 'baisseprix' },
  // (11 nov.) « Publier partout » : les annonces cochées vers Leboncoin, Vestiaire et eBay, DEPUIS
  // l'annonce Vinted (src/publierPartout.js). Rien ne part chez Vinted : le compte de l'onglet
  // Vinted ne décide rien (`multiComptes`) ; la feuille dit, site par site, ce qui partira.
  { k: 'partout', titre: 'Publier partout…', desc: 'Leboncoin, Vestiaire, eBay depuis l’annonce Vinted : une case par site, un bouton.', etats: ['en-ligne'], robot: false, lien: true, multiComptes: true },
  // (11 nov., lot visuels-reseaux) « Nouveautés de la semaine » : un visuel carré / story des annonces
  // cochées, dessiné dans le navigateur (src/composants/VisuelsReseaux.jsx). Rien ne part chez Vinted :
  // ni robot, ni compte du navigateur, plusieurs comptes permis. Un lien sous les tuiles.
  { k: 'visuels', titre: 'Nouveautés de la semaine', desc: 'Un visuel carré et une story des annonces cochées, à partager sur tes réseaux.', etats: ['en-ligne'], robot: false, lien: true, multiComptes: true },
  { k: 'mini', titre: 'Prix mini…', desc: '« Accepter dès » (et « Refuser sous ») sur les annonces cochées, calculés depuis leur prix.', etats: ['en-ligne'], robot: false, lien: true, multiComptes: true },
];
// Ce qui se lance au nom d'UN compte (dit d'un mot quand la sélection en mélange deux),
// et le mot court d'une action permise sur plusieurs comptes.
const PAR_COMPTE = 'Republier, modifier, brouillon, mise en ligne';
const COURT = { mini: 'Prix mini', main: 'Republier à la main', baisser: 'Baisser le prix', partout: 'Publier partout', visuels: 'Nouveautés de la semaine' };
// Les quatre tuiles de la feuille, dans l'ordre (« à la main » est un lien à part).
export const ACTIONS_TUILES = ACTIONS_SELECTION.filter((A) => !A.lien).map((A) => A.k);
const POUR_ETAT = { 'en-ligne': 'les annonces en ligne', brouillon: 'les brouillons', masquee: 'les annonces masquées', verification: 'les annonces en vérification' };
const pl = (n, mot, plur) => `${n} ${n > 1 ? (plur || mot + 's') : mot}`;
const COMPTE_ETAT = (n, e) => (e === 'brouillon' ? pl(n, 'brouillon')
  : e === 'masquee' ? `${pl(n, 'annonce')} ${n > 1 ? 'masquées' : 'masquée'}`
  : `${pl(n, 'annonce')} ${e === 'verification' ? 'en vérification' : 'en ligne'}`);

// La liste des actions, selon la sélection.
//   selection : [{ id, uid, etat }] (l'ordre de ses clics) ;
//   chrome    : l'uid du compte Vinted ouvert dans Chrome — `undefined` pas su ·
//               `null` aucun · string ;
//   capOk     : (cap) => true | false — la capacité est-elle là ;
//   nomCompte : (uid) => login.
// Rend [{ k, titre, desc, ok, raison, ids }] : une action qui ne peut pas
// partir reste DANS la liste, grisée, avec SA raison (jamais cachée, §7).
export function actionsPossibles({ selection, chrome, capOk, nomCompte } = {}) {
  const sel = Array.isArray(selection) ? selection.filter((x) => x && x.id != null) : [];
  const nom = (u) => (nomCompte && nomCompte(u)) || (u ? `compte ${u}` : 'compte inconnu');
  const comptes = [...new Set(sel.map((x) => String(x.uid || '')))];
  const parEtat = {}; for (const x of sel) parEtat[x.etat] = (parEtat[x.etat] || 0) + 1;
  const res = ACTIONS_SELECTION.map((A) => {
    const ids = sel.map((x) => String(x.id));
    let raison = '';
    if (!sel.length) raison = 'Coche au moins une annonce.';
    else if (A.multiComptes) { /* une écriture dans ses fiches : le compte ne décide rien */ }
    else if (A.parPaire) { if (comptes.includes('')) raison = sel.length > 1 ? 'VRM ne sait pas à quel compte est l’une de ces annonces.' : 'VRM ne sait pas à quel compte est cette annonce.'; }
    else if (comptes.length > 1) raison = `Ta sélection mélange ${comptes.length} comptes (${comptes.map(nom).join(', ')}). ${PAR_COMPTE} : un compte à la fois.`;
    else if (comptes[0] === '') raison = 'VRM ne sait pas à quel compte est cette annonce.';
    if (!raison && sel.length) {
      const hors = Object.keys(parEtat).filter((e) => !A.etats.includes(e));
      if (hors.length) raison = `Seulement pour ${A.etats.map((e) => POUR_ETAT[e]).join(' ou ')} : ta sélection contient ${hors.map((e) => COMPTE_ETAT(parEtat[e], e)).join(', ')}.`;
    }
    // (10 nov.) Une action sans robot qui part quand même chez Vinted par l'extension (`cap`).
    if (!raison && !A.robot && A.cap && capOk && !capOk(A.cap)) raison = 'Demande une extension VRM plus récente dans ce navigateur.';
    if (!raison && A.robot) {
      if (A.cap && capOk && !capOk(A.cap)) raison = 'Demande une extension VRM plus récente dans ce navigateur.';
      // (5 nov.) Le navigateur est NOMMÉ tel qu'il est (Orion, Chrome…), relu à chaque phrase (`motsNavigateur`).
      const N = motsNavigateur();
      if (chrome === undefined) raison = `VRM ne sait pas encore quel compte Vinted est ouvert ${N.dans}.`;
      else if (chrome === null || chrome === '') raison = `Aucun compte Vinted ouvert ${N.dans} : ouvre vinted.fr sur ${nom(comptes[0])}.`;
      else if (String(chrome) !== comptes[0]) raison = `${N.Ce} est sur ${nom(String(chrome))} : ouvre vinted.fr sur ${nom(comptes[0])} pour agir sur ses annonces.`;
    }
    return { k: A.k, titre: A.titre, desc: A.desc, ok: !raison, raison, ids, robot: !!A.robot };
  });
  // (6 nov., finitions) Deux comptes : la phrase commune disait « une action se lance sur un
  // seul compte » alors que « Prix mini… » (une écriture dans ses fiches) part quand même. Elle
  // dit ce qui reste POSSIBLE — seulement s'il l'est vraiment (un brouillon coché ne le permet pas).
  if (comptes.length > 1) {
    // « Prix mini… » (une écriture dans ses fiches) et « à la main » (une paire à la fois, chacune son compte).
    const possibles = res.filter((x) => x.ok && (((A) => A.multiComptes || A.parPaire)(ACTIONS_SELECTION.find((A) => A.k === x.k) || {}))).map((x) => COURT[x.k] || x.titre);
    if (possibles.length) for (const x of res) if (!x.ok && /^Ta sélection mélange/.test(x.raison)) x.raison = x.raison.replace(/\.$/, '') + ` · ${possibles.join(', ')} : possible.`;
  }
  return res;
}

// (5 nov., chantier C — revue 2.5) LA RAISON SE DIT UNE FOIS, EN TÊTE.
// La feuille répétait la même phrase sous chacune des tuiles (« VRM ne sait pas
// encore quel compte Vinted est ouvert… » quatre fois). Règle : la raison que
// partagent au moins deux tuiles grisées (ou celle de la seule tuile, si toutes
// le sont) se dit une fois en tête ; sous une tuile ne reste que SA raison quand
// elle diffère (« Seulement pour les brouillons… »). Une tuile possible garde sa
// description. Rend { tete, parTuile: { k: texte } } — `tete` = '' sans raison commune.
export function raisonCommune(actions, tuiles = ACTIONS_TUILES) {
  const t = (Array.isArray(actions) ? actions : []).filter((x) => x && tuiles.includes(x.k));
  const off = t.filter((x) => !x.ok && x.raison);
  const compte = new Map();
  for (const x of off) compte.set(x.raison, (compte.get(x.raison) || 0) + 1);
  let tete = ''; let max = 0;
  for (const [r, n] of compte) if (n > max) { max = n; tete = r; }
  if (max < 2 && !(off.length === 1 && t.length === 1)) tete = '';
  const parTuile = {};
  for (const x of t) parTuile[x.k] = x.ok ? (x.desc || '') : (x.raison === tete ? '' : x.raison);
  return { tete, parTuile };
}

// ── REPUBLIER À LA MAIN : REMETTRE LE N° SUR LA NOUVELLE (identité) ─────────
// `suivis` = { [ancienId]: { uid, num, at, nouvelId?, lieAt? } } (synchronisé,
// `vrm_repub_main`). Le lien nouvelle → ancienne est posé par SON clic
// (« C'est celle-ci ») : une IDENTITÉ qu'il donne, jamais une ressemblance de
// titre, de prix ou de date (§5). La reprise du N° elle-même est celle des
// republications (`repriseNumerosRecreation`, src/repriseNumero.js) : la table
// { nouvelId: ancienId } rendue ici s'AJOUTE à celle que l'extension écrit.
export function liensRepubMain(suivis, { presentes, dejaRecrees } = {}) {
  const t = {};
  if (!suivis || typeof suivis !== 'object') return t;
  const num = (x) => (/^\d{4,15}$/.test(String(x || '')) ? String(x) : '');
  // (revue du 5 nov.) `presentes` = les annonces encore chez lui sur Vinted HORS
  // « en ligne » (masquées, à confirmer, brouillons) : la règle de reprise ne
  // regarde que les annonces EN LIGNE, donc l'ancienne MASQUÉE (ou en brouillon)
  // passait pour partie et son N° allait sur la nouvelle — deux paires présentes
  // sous un N°. Tant que l'ancienne est là, sous quelque forme, le lien attend.
  const pres = presentes instanceof Set ? presentes : new Set((presentes || []).map(String));
  // `dejaRecrees` = la table prouvée par l'extension ({ nouvelId: ancienId }) :
  // une annonce qu'elle a déjà reliée n'est jamais re-reliée par un clic.
  const prouve = dejaRecrees && typeof dejaRecrees === 'object' ? dejaRecrees : {};
  for (const anc of Object.keys(suivis)) {
    const s = suivis[anc]; const a = num(anc), n = num(s && s.nouvelId);
    if (!(a && n && a !== n) || t[n]) continue;
    if (pres.has(a) || Object.prototype.hasOwnProperty.call(prouve, n)) continue;
    t[n] = a;
  }
  return t;
}
// La table de reprise : celle de l'extension (une identité PROUVÉE) gagne
// toujours sur un lien posé à la main pour la même nouvelle annonce.
export function fusionLiensRecrees(recrees, manuels) {
  if (recrees === undefined) return undefined;   // la table de l'extension pas encore lue : on attend
  const m = manuels && typeof manuels === 'object' ? manuels : {};
  if (!Object.keys(m).length) return recrees;
  return { ...m, ...(recrees || {}) };
}
// Les annonces qu'il PEUT désigner comme la nouvelle : en ligne, sur le MÊME
// compte, pas l'ancienne, pas déjà désignée pour une autre, sans N° posé à la
// main. Triées de la plus récente à la plus ancienne (pour qu'il la trouve vite) ;
// la date n'est jamais une preuve : rien n'est choisi à sa place.
export function candidatsNouvelle({ ancienId, uid, enLigne, numeros, suivis, debut, recrees }) {
  const anc = String(ancienId || ''); const u = String(uid || '');
  const pris = new Set(Object.entries(suivis || {}).filter(([k, s]) => k !== anc && s && s.nouvelId).map(([, s]) => String(s.nouvelId)));
  const t0 = Number(debut) || 0;
  const date = (it) => { const c = Number(it && it.createdTs); return Number.isFinite(c) && c > 0 ? (c < 1e12 ? c * 1000 : c) : null; };
  return (enLigne || [])
    .filter((it) => it && String(it.uid || '') === u && String(it.id) !== anc && !pris.has(String(it.id)))
    .filter((it) => { const e = (numeros || {})[it.id]; return !(e && String(e.numero || '').trim() && (!e.auto || e.manuelAt)); })
    // (revue du 5 nov.) Déjà la remplaçante PROUVÉE d'une autre annonce (table de
    // l'extension, ou N° déjà repris) : ce n'est pas la nouvelle de celle-ci.
    .filter((it) => { const e = (numeros || {})[it.id]; const r = recrees && typeof recrees === 'object' ? recrees[String(it.id)] : undefined; return !(e && e.recreeDe && String(e.recreeDe) !== anc) && !(r && String(r) !== anc); })
    // Une annonce mise en ligne bien AVANT qu'il commence (plus de 10 min) ne
    // peut pas être la nouvelle : elle sort de la liste (date connue seulement).
    .filter((it) => { const d = date(it); return !(t0 && d != null && d < t0 - 10 * 60000); })
    .sort((a, b) => (date(b) || 0) - (date(a) || 0));
}
// Où en est un suivi : 'attente' (pas encore désignée) · 'lie' (désignée, l'ancienne
// encore en ligne : le N° attend) · 'fait' (la nouvelle porte le N°).
export function etatSuiviMain(s, { numeros, enLigneIds, cle } = {}) {
  // (revue du 5 nov.) Sans N° à remettre, il n'y a rien à suivre : sinon le
  // rappel « choisis la nouvelle annonce » restait au-dessus de la liste à vie.
  if (s && !String(s.num || '').trim()) return 'fait';
  if (!s || !s.nouvelId) return 'attente';
  const k = cle || (cleNum);
  const e = (numeros || {})[String(s.nouvelId)];
  if (e && s.num && k(e.numero) === k(s.num)) return 'fait';
  return 'lie';
}

// ── LES PHOTOS RÉGLÉES (republier à la main) ───────────────────────────────
// (6 nov.) Plus de copie ici : la règle des photos réglées est CELLE de l'atelier
// Republier (src/republierReglages.js — bornes de l'extension, un réglage pour
// toutes). Ces noms restent pour les lecteurs d'avant.
export { PHOTO_NEUTRE as REGLAGES_NEUTRES, filtrePhoto as filtreReglages, nomPhotoReglee, appliquerCouleursPixels } from './republierReglages.js';

// ── « PRIX MINI… » SUR UNE SÉLECTION (6 nov., vague 2 · point 2) ───────────────
// Mesuré (5 nov., lecture seule) : moteur d'offres allumé, ~11 offres par jour,
// 5 annonces sur 60 avec un « Accepter dès ». Le poser une carte à la fois était
// le frein. Règle PURE (exécutée par scripts/audit-prix-mini.cjs) :
//   · mini = prix − X % ou prix − X €, ARRONDI À L'EURO, jamais au-dessus du prix
//     (un arrondi qui passerait au-dessus du prix ⇒ l'euro du dessous) ;
//   · « Refuser sous » en option, par la même règle, et TOUJOURS sous le mini
//     (sinon il n'est pas posé, et c'est dit sur la ligne) ;
//   · prix pas lu ⇒ rien n'est posé sur cette annonce (dit) ; mini sous 1 € ⇒ rien ;
//   · sous un prix d'achat CONNU ⇒ la ligne le dit (`sousAchat`) : rien n'est
//     bloqué, c'est SON choix, mais il le voit avant de confirmer.
// L'extension lit `min`/`refuse` par `Number(...)` : on écrit un entier (« 54 »),
// jamais « 54,5 » (illisible pour elle).
export const MINI_MODES = ['pct', 'eur'];
export function valeurReduction(v, mode) {
  const t = String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.').replace(/[%€]/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (mode === 'pct' && n >= 100) return null;
  return n;
}
export function miniDepuisPrix(prix, mode, valeur) {
  const p = Number(prix); const x = valeurReduction(valeur, mode);
  if (!(Number.isFinite(p) && p > 0) || x == null || !MINI_MODES.includes(mode)) return null;
  const brut = mode === 'pct' ? p * (1 - x / 100) : p - x;
  let m = Math.round(brut);
  if (m > p) m = Math.floor(p);
  return m >= 1 ? m : null;
}
//   annonces : [{ id, numero, titre, prix, achat }] (achat : prix d'achat connu, ou null)
//   mini     : { mode, valeur } ; refuse : null | { mode, valeur }
// Rend { lignes: [{ id, numero, titre, prix, mini, refuse, sousAchat, raison }], aPoser, erreur }.
export function minisSelection({ annonces, mini, refuse = null } = {}) {
  const liste = Array.isArray(annonces) ? annonces.filter((a) => a && a.id != null) : [];
  const m = mini || {};
  if (!MINI_MODES.includes(m.mode) || valeurReduction(m.valeur, m.mode) == null) return { lignes: [], aPoser: 0, erreur: m.mode === 'pct' ? 'Une réduction entre 1 et 99\u00a0%.' : 'Une réduction en euros (ex : 5).' };
  const avecRefus = !!(refuse && String(refuse.valeur == null ? '' : refuse.valeur).trim() !== '');
  if (avecRefus && (!MINI_MODES.includes(refuse.mode) || valeurReduction(refuse.valeur, refuse.mode) == null)) return { lignes: [], aPoser: 0, erreur: 'Le seuil « Refuser sous » est illisible.' };
  const lignes = liste.map((a) => {
    const prix = Number(a.prix);
    const base = { id: String(a.id), numero: a.numero ? String(a.numero) : '', titre: String(a.titre || ''), prix: Number.isFinite(prix) && prix > 0 ? prix : null, mini: null, refuse: null, sousAchat: false, raison: '' };
    if (base.prix == null) return { ...base, raison: 'prix pas lu : rien n’est posé' };
    const mn = miniDepuisPrix(base.prix, m.mode, m.valeur);
    if (mn == null) return { ...base, raison: 'mini sous 1\u00a0€ : rien n’est posé' };
    let rf = null, raison = '';
    if (avecRefus) {
      rf = miniDepuisPrix(base.prix, refuse.mode, refuse.valeur);
      if (rf != null && rf >= mn) { rf = null; raison = '« Refuser sous » pas posé : il doit rester sous le mini'; }
    }
    const achat = a.achat == null || a.achat === '' ? null : Number(a.achat);
    return { ...base, mini: mn, refuse: rf, sousAchat: achat != null && Number.isFinite(achat) && mn < achat, raison };
  });
  return { lignes, aPoser: lignes.filter((l) => l.mini != null).length, erreur: '' };
}
// L'écriture d'une ligne (rien quand le mini n'est pas posé). `refuse` n'est
// écrit que si l'option est cochée : sinon le seuil existant reste tel quel.
export function ecritureMini(l, { avecRefus = false } = {}) {
  if (!l || l.mini == null) return null;
  const w = { min: String(l.mini) };
  if (avecRefus && l.refuse != null) w.refuse = String(l.refuse);
  return w;
}
