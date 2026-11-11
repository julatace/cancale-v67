// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE DES CHIFFRES, RÉGLABLE PAR PAGE (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 3 nov. 09 h 54 : « je veux l'onglet avec les statistiques, mais qu'il
// soit réglable sur chaque page comme il est déjà là, mais modifiable en
// fonction de ce qu'on a sélectionné » ; « je veux juste le CA, le bénéfice
// etc. dans cette case sombre sur chaque onglet ».
//
// Ce module ne LIT rien et ne CALCULE aucune notion : il porte
//   · le CATALOGUE des chiffres que la carte sait montrer, et pour chacun ce
//     qu'il suit (site, compte, période) ;
//   · le DÉFAUT de chaque page (celui des maquettes Fusion) et la lecture du
//     réglage rangé (`vrm_carte_stats`, synchronisé) ;
//   · le PÉRIMÈTRE dit en tête de carte (« Novembre · Vinted ») ;
//   · `valeursCarte` : pour une sélection, la valeur de chaque chiffre TIRÉE DE
//     SA RÈGLE PROPRIÉTAIRE, que l'app lui passe (`regles`) — `bilanLignes`
//     (le « vendu » de Ventes et Ma journée, sur les lignes de `ventesFaites`),
//     `rythmeVendu` (le panier moyen de Statistiques), `beneficeDe` (la lecture
//     de Comptabilité : `beneficePeriode`), `chiffreBenefice`/`chiffreBrut`
//     (src/beneficeNoms.js), les publications `vrm_colis_aposter`,
//     `vrm_colis_retirer`, `vinted_urssaf_mois`, `vrm_paires_dorment`, le
//     porte-monnaie et les annonces de `liveStats`.
// Trois états partout (§5) : `valeur: null` = pas su (« — »), jamais 0 ;
// `partiel` = un minimum (« au moins »), le manque NOMMÉ dans `manque` ;
// `hors` = le chiffre n'a pas de sens pour cette sélection (« — », et la
// feuille ne le propose pas). Exécuté par scripts/audit-carte-chiffres.cjs.

import { aVenirPour } from '../argentAVenir.js';
import { dateLocale } from '../formatsDate.js';   // (9 nov., vitesse) un format créé une fois

export const CLE_CARTE_STATS = 'vrm_carte_stats';

export const SITES = ['toutes', 'vinted', 'vestiaire', 'leboncoin', 'ebay'];
export const NOM_SITE = { toutes: 'Tous les sites', vinted: 'Vinted', vestiaire: 'Vestiaire', leboncoin: 'Leboncoin', ebay: 'eBay' };
// Le nom de plateforme porté par une ligne de `ventesFaites`.
export const PLATEFORME_DE_SITE = { vinted: 'Vinted', vestiaire: 'Vestiaire', leboncoin: 'Leboncoin', ebay: 'eBay' };

const TOUTES_PERIODES = ['jour', 'semaine', 'mois', 'trimestre', 'annee'];
const PERIODES_BENEF = ['mois', 'trimestre', 'annee'];
export const NOM_PERIODE = { jour: 'Aujourd’hui', semaine: 'Semaine', mois: 'Mois', trimestre: 'Trimestre', annee: 'Année' };
const COURT_PERIODE = { jour: 'aujourd’hui', semaine: 'semaine', mois: 'mois', trimestre: 'trimestre', annee: 'année' };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ── LE CATALOGUE ────────────────────────────────────────────────────────────
// `periodes` : celles où la règle propriétaire répond (null = un instant, pas
//   une période) ; `sites` : les sélections de site où le chiffre a un sens ;
//   `compte` : il suit le compte choisi (Vinted : les lignes portent le login) ;
//   `vinted` : seul Vinted le publie — sur « Tous les sites » la case le dit ;
//   `aller` : l'écran propriétaire (un toucher y mène).
// L'ordre est celui de la feuille « Modifier ».
export const CHIFFRES = {
  vendu:      { nom: 'CA vendu', court: 'vendu', type: 'eur', periodes: TOUTES_PERIODES, sites: SITES, compte: true, aller: 'cat_ventes' },
  ventes:     { nom: 'Nombre de ventes', court: 'ventes', type: 'n', periodes: TOUTES_PERIODES, sites: SITES, compte: true, aller: 'cat_ventes' },
  panier:     { nom: 'Panier moyen 30 j', court: 'panier moyen', type: 'eur', periodes: null, sites: SITES, compte: true, aller: 'dashboard' },
  recu:       { nom: 'Reçu', court: 'reçu', type: 'eur', periodes: ['mois'], sites: ['toutes'], compte: false, aller: 'compta' },
  benefice:   { nom: 'Bénéfice', court: 'bénéfice', type: 'eur', periodes: PERIODES_BENEF, sites: ['toutes'], compte: false, aller: 'compta' },
  brut:       { nom: 'Bénéfice brut', court: 'bénéfice brut', type: 'eur', periodes: TOUTES_PERIODES, sites: ['toutes'], compte: false, aller: 'compta' },
  declarer:   { nom: 'À déclarer', court: 'à déclarer', type: 'eur', periodes: PERIODES_BENEF, sites: ['toutes'], compte: false, aller: 'compta' },
  urssaf:     { nom: 'URSSAF', court: 'URSSAF', type: 'eur', periodes: PERIODES_BENEF, sites: ['toutes'], compte: false, aller: 'compta', titre: 'L’URSSAF de ces ventes, retirée du bénéfice. Celle à payer se calcule sur l’argent reçu (« Combien je dois déclarer ? »).' },
  finalisees: { nom: 'Ventes finalisées', court: 'finalisées', type: 'n', periodes: TOUTES_PERIODES, sites: ['toutes'], compte: false, aller: 'compta' },
  // (5 nov., chantier E1, revue 1.2) Le mot de l'app : « À envoyer » (src/libelles.js). L'id reste
  // `aposter` (les réglages rangés le gardent).
  aposter:    { nom: 'À envoyer', court: 'à envoyer', type: 'n', periodes: null, sites: SITES, compte: false, aller: 'cat_bord' },
  retirer:    { nom: 'À retirer', court: 'à retirer', type: 'n', periodes: null, sites: ['toutes'], compte: false, aller: 'retraits' }, // (11 nov., lot DJ3) « À retirer » vit en tête d'Achats
  // (4 nov.) « Argent à venir » : ce que TES SITES te doivent encore (src/argentAVenir.js,
  // `liveStats.aVenir`) — toutes plateformes, par compte Vinted. L'id reste `attente`
  // (les réglages rangés le gardent) ; il ne lit plus le seul porte-monnaie Vinted.
  attente:    { nom: 'Argent à venir', court: 'à venir', type: 'eur', periodes: null, sites: SITES, compte: true, aller: 'cat_ventes' },
  dispo:      { nom: 'Disponible', court: 'disponible', type: 'eur', periodes: null, sites: ['toutes', 'vinted'], compte: true, vinted: true, aller: 'cat_ventes' },
  enligne:    { nom: 'Annonces en ligne', court: 'en ligne', type: 'n', periodes: null, sites: ['toutes', 'vinted'], compte: true, vinted: true, aller: 'annonces' },
  masquees:   { nom: 'Annonces masquées', court: 'masquées', type: 'n', periodes: null, sites: ['toutes', 'vinted'], compte: true, vinted: true, aller: 'annonces', titre: 'Masquées par Vinted : toujours chez toi, pas en ligne. Une lecture de plus de 24 h est à confirmer (« au moins »).' },
  dorment:    { nom: 'Annonces qui dorment', court: 'qui dorment', type: 'n', periodes: null, sites: ['toutes', 'vinted'], compte: false, vinted: true, aller: 'annonces' },
};
// (6 nov., onglets A) « D'OÙ VIENT CE CHIFFRE ? » — une phrase par chiffre, rangée AVEC sa
// définition (§5 : la phrase qui explique un chiffre vient de la même source que lui). La
// feuille « ? » de la carte (`CarteStats`, prop `aide`) la lit, à côté de la valeur et de sa raison.
export const AIDE_CHIFFRES = {
  vendu: 'Tes ventes de la période, à la date de la vente, sur tous tes sites. Les annulées et les comptes que tu as écartés ne comptent pas.',
  ventes: 'Le nombre de ces mêmes ventes (la règle de « vendu »).',
  panier: 'Le montant moyen de tes ventes des 30 derniers jours.',
  recu: 'L’argent versé par tes sites, au jour du versement : c’est ce que tu déclares. Une vente finalisée sans date de versement n’est dans aucun mois (« à dater ») — l’extension relève ces dates quand tu ouvres Vinted.',
  benefice: 'Tes ventes finalisées moins leurs prix d’achat, les frais, tes dépenses et l’URSSAF : le calcul de Compta.',
  brut: 'Tes ventes finalisées moins leurs prix d’achat — sans dépenses ni URSSAF.',
  declarer: 'Le chiffre d’affaires à déclarer à l’URSSAF : l’argent reçu (le calcul de Compta).',
  urssaf: CHIFFRES.urssaf.titre,
  finalisees: 'Tes ventes finalisées sur la période (Compta).',
  aposter: 'Les colis à envoyer (tous tes sites), en tête de Ventes : touche pour les imprimer.',
  retirer: 'Les colis à aller chercher, en tête d’Achats (e-mails des transporteurs et suivis Vinted).',
  attente: 'L’argent que tes sites te doivent encore : les ventes en cours, pas encore versées.',
  dispo: 'Le solde disponible de ton porte-monnaie Vinted, relu par l’extension.',
  enligne: 'Tes annonces en ligne, d’après la dernière lecture complète de ton dressing (de moins de 24 h).',
  masquees: CHIFFRES.masquees.titre,
  dorment: 'Tes annonces en ligne depuis plus de 30 jours (l’écran Annonces).',
};
export const IDS_CHIFFRES = Object.keys(CHIFFRES);

// ── LES PAGES ET LEUR DÉFAUT (maquettes Fusion) ─────────────────────────────
// Une place = { id, p } (`p` : la période choisie pour CE chiffre quand la page
// n'a pas de filtre de période ; absente ⇒ la première période du chiffre qui
// contient « mois », sinon sa première). Un `id` peut être un chiffre LOCAL de
// la page (ses propres cases : « en route », « à payer », « à imprimer »…),
// déclaré par la page elle-même — jamais proposé ailleurs.
const P = (id, p) => (p ? { id, p } : { id });
export const PAGES_CARTE = {
  journee:   { nom: 'Ma journée', g: P('vendu', 'jour'), c: [P('benefice', 'mois'), P('vendu', 'mois'), P('recu', 'mois')] },
  ventes:    { nom: 'Ventes · Vinted', g: P('vendu', 'mois'), c: [P('aposter'), P('enroute'), P('apayer')] },
  'ventes-toutes': { nom: 'Ventes · tous les sites', g: P('vendu', 'mois'), c: [P('ventes', 'mois'), P('benefice', 'mois'), P('aposter')] },
  leboncoin: { nom: 'Ventes · Leboncoin', g: P('ca'), c: [P('encours'), P('finalisees-site'), P('vendu', 'mois')] },
  ebay:      { nom: 'Ventes · eBay', g: P('ca'), c: [P('encours'), P('finalisees-site'), P('vendu', 'mois')] },
  vestiaire: { nom: 'Ventes · Vestiaire', g: P('vendu', 'mois'), c: [P('ventes', 'mois'), P('aposter'), P('panier')] },
  colis:     { nom: 'Colis', g: P('aposter'), c: [P('imprimer'), P('deposes'), P('retirer')] },
  compta:    { nom: 'Compta', g: P('benefice', 'mois'), c: [P('declarer', 'mois'), P('urssaf', 'mois'), P('finalisees', 'mois')] },
  annonces:  { nom: 'Annonces', g: P('enligne'), c: [P('dorment'), P('ventes', 'mois'), P('vendu', 'mois')] },
  achats:    { nom: 'Achats', g: P('depense'), c: [P('enroute'), P('retirer'), P('recus')] },
};
export const PAGES = Object.keys(PAGES_CARTE);

// La période par défaut d'un chiffre (sa première, « mois » de préférence).
export const periodeDefaut = (def) => (!def || !Array.isArray(def.periodes) || !def.periodes.length) ? null : (def.periodes.includes('mois') ? 'mois' : def.periodes[0]);

// La définition d'un id : un chiffre du catalogue, ou un chiffre LOCAL de la page.
export const defDe = (id, locaux) => (locaux && Object.prototype.hasOwnProperty.call(locaux, id) ? { ...locaux[id], local: true } : (CHIFFRES[id] || null));

// Une place valable : un id connu (catalogue ou local), une période permise.
// (3 nov., le calendrier de la carte) Une PLAGE libre `{ de, a, label }` est gardée
// seulement pour un chiffre qui se calcule sur des dates quelconques (`PLAGE_IDS`).
export const PLAGE_IDS = ['vendu', 'ventes', 'brut', 'finalisees'];
// La clé d'une période (pour « jamais deux fois le même chiffre à la même période »).
export const clePeriode = (p) => (p && typeof p === 'object' ? `${p.de}-${p.a}` : (p || ''));
export const plageValable = (p) => !!(p && typeof p === 'object' && !p.hors && isFinite(Number(p.de)) && isFinite(Number(p.a)) && Number(p.a) > Number(p.de));
const placeValable = (x, locaux) => {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string') return null;
  const d = defDe(x.id, locaux);
  if (!d) return null;
  const per = Array.isArray(d.periodes) ? d.periodes : null;
  if (per && plageValable(x.p) && !d.local && PLAGE_IDS.includes(x.id)) return { id: x.id, p: { de: Number(x.p.de), a: Number(x.p.a), label: String(x.p.label || '') } };
  return per ? { id: x.id, p: per.includes(x.p) ? x.p : periodeDefaut(d) } : { id: x.id };
};

// ── LE RÉGLAGE RANGÉ ────────────────────────────────────────────────────────
// `{ v: 1, pages: { [page]: { g: {id,p}, c: [{id,p}×3] } } }`. Absent, illisible,
// page inconnue ⇒ le défaut. Une place inconnue (chiffre retiré, local d'une
// autre page) retombe sur la place du défaut ; jamais deux fois le même
// chiffre à la même période sur la carte (§7 : un nombre, une fois).
export const reglageDePage = (reglage, page, locaux = null) => {
  const def = PAGES_CARTE[page];
  if (!def) return null;
  const r = reglage && typeof reglage === 'object' && reglage.pages && typeof reglage.pages === 'object' ? reglage.pages[page] : null;
  const g = placeValable(r && r.g, locaux) || placeValable(def.g, locaux) || { id: 'vendu', p: 'mois' };
  const cles = new Set([g.id + '|' + clePeriode(g.p)]);
  const c = [];
  for (let i = 0; i < 3; i++) {
    const brut = r && Array.isArray(r.c) ? r.c[i] : null;
    let x = placeValable(brut, locaux);
    if (!x || cles.has(x.id + '|' + clePeriode(x.p))) x = placeValable(def.c[i], locaux);
    if (!x || cles.has(x.id + '|' + clePeriode(x.p))) x = null;
    if (x) cles.add(x.id + '|' + clePeriode(x.p));
    c.push(x);
  }
  return { g, c: c.filter(Boolean), defaut: !r };
};

// Ce qui s'enregistre pour une page (les autres pages restent telles quelles).
export const reglageAEnregistrer = (reglage, page, choix) => {
  const pages = reglage && typeof reglage === 'object' && reglage.pages && typeof reglage.pages === 'object' ? { ...reglage.pages } : {};
  if (choix == null) delete pages[page];
  else pages[page] = { g: choix.g, c: choix.c.slice(0, 3) };
  return { v: 1, pages };
};

// ── LA PÉRIODE EFFECTIVE D'UNE PLACE ────────────────────────────────────────
// Le filtre de période de la PAGE l'emporte (Compta : mois/trimestre/année ;
// Ventes : une plage du calendrier) ; sinon la période de la place.
// → une clé ('mois'…), un objet plage { de, a, label }, ou null (un instant).
export const periodeDePlace = (place, def, selPeriode) => {
  if (!def || !Array.isArray(def.periodes)) return null;
  if (selPeriode && typeof selPeriode === 'object') return selPeriode;
  if (typeof selPeriode === 'string' && def.periodes.includes(selPeriode)) return selPeriode;
  if (typeof selPeriode === 'string') return { hors: selPeriode };
  return place.p || periodeDefaut(def);
};

// Les bornes [de, a) d'une période (heure locale), par les règles de l'app
// (`debutPeriode`, `decalerPeriode`) ; « jour » = minuit → minuit.
export const bornesPeriode = (p, regles, maintenant = Date.now()) => {
  if (!p) return null;
  if (typeof p === 'object') return p.hors ? null : { de: Number(p.de), a: p.a == null ? null : Number(p.a) };
  if (p === 'jour') { const d = new Date(maintenant); d.setHours(0, 0, 0, 0); const f = new Date(d); f.setDate(f.getDate() + 1); return { de: d.getTime(), a: f.getTime() }; }
  const d = regles.debutPeriode(maintenant, p);
  return { de: d.getTime(), a: regles.decalerPeriode(d, p, 1).getTime() };
};

// Le nom court d'une période, en tête de carte (« Novembre », « T4 2026 »…).
export const nomPeriode = (p, maintenant = Date.now()) => {
  if (!p) return 'Aujourd’hui';
  if (typeof p === 'object') { const l = p.label || 'Période choisie'; return l.charAt(0).toUpperCase() + l.slice(1); }
  const d = new Date(maintenant);
  if (p === 'jour') return 'Aujourd’hui';
  if (p === 'semaine') return 'Cette semaine';
  if (p === 'mois') { const m = MOIS[d.getMonth()]; return m.charAt(0).toUpperCase() + m.slice(1); }
  if (p === 'trimestre') return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return String(d.getFullYear());
};

// ── LE PÉRIMÈTRE, EN 1 À 3 MOTS ─────────────────────────────────────────────
// `sel` = { site, compte: { uid, login, nom } | null, periode }.
export const perimetre = (periodeGrand, sel, maintenant = Date.now()) => {
  const morceaux = [nomPeriode(periodeGrand, maintenant)];
  if (sel && sel.site && sel.site !== 'toutes') morceaux.push(NOM_SITE[sel.site] || sel.site);
  if (sel && sel.compte && (sel.compte.nom || sel.compte.login)) morceaux.push(sel.compte.nom || sel.compte.login);
  return morceaux.join(' · ');
};

// Le chiffre a-t-il un sens pour cette sélection ? (sinon « — » et la feuille
// ne le propose pas) → '' (oui) ou la raison, courte.
export const horsSelection = (id, sel, locaux = null) => {
  const d = defDe(id, locaux);
  if (!d) return 'inconnu';
  if (d.local) return '';
  const site = (sel && sel.site) || 'toutes';
  if (!d.sites.includes(site)) return `pas pour ${NOM_SITE[site] || site} seul`;
  if (sel && sel.compte && !d.compte) return 'pas par compte';
  if (sel && sel.compte && site !== 'vinted' && site !== 'toutes') return 'pas par compte';
  if (sel && sel.periode && Array.isArray(d.periodes)) {
    if (typeof sel.periode === 'object' && !PLAGE_IDS.includes(id)) return 'pas sur une plage de dates';
    if (typeof sel.periode === 'string' && !d.periodes.includes(sel.periode)) return `pas par ${COURT_PERIODE[sel.periode] || sel.periode}`;
  }
  return '';
};

// Le libellé d'une case : le nom court, la période si elle n'est pas celle du
// grand chiffre, « Vinted » si seul Vinted le publie et que le site est « tous ».
export const libelleCase = (def, p, pGrand, sel) => {
  let l = def.court || def.nom || '';
  const cle = (x) => (x && typeof x === 'object' ? (x.label || 'plage') : (x || ''));
  if (p && cle(p) !== cle(pGrand)) l += ' · ' + (typeof p === 'string' ? (COURT_PERIODE[p] || p) : (p.label || 'plage'));
  if (def.vinted && (!sel || !sel.site || sel.site === 'toutes')) l += ' · Vinted';
  return l;
};

// ── L'ARGENT REÇU DU MOIS, LU DANS LA LIGNE PUBLIÉE ─────────────────────────
// La lecture du widget de l'iPhone (`recuDuMoisPublie`, api/widget.js) — la
// même ligne (`vinted_urssaf_mois.recu`, `recuDuMois` sur `ventesDeclarables`
// à la date de VERSEMENT), les mêmes trois états. L'audit compare les deux.
export const RECU_MAX_AGE_MS = 3 * 86400000;
const ymParis = (t) => dateLocale(new Date(t), 'en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
export const recuPublie = (publie, ym, maintenant = Date.now()) => {
  if (!publie || typeof publie !== 'object' || !Array.isArray(publie.mois)) return { valeur: null, raison: 'absente' };
  const at = Number(publie.at);
  if (!isFinite(at) || at <= 0) return { valeur: null, raison: 'illisible' };
  if (ymParis(at) !== ym || maintenant - at > RECU_MAX_AGE_MS) return { valeur: null, raison: 'ancienne' };
  if (!publie.recu || typeof publie.recu !== 'object' || Array.isArray(publie.recu)) return { valeur: null, raison: 'ancienne-app' };
  const recu = publie.recu[ym] == null ? 0 : Number(publie.recu[ym]);
  if (!isFinite(recu) || recu < 0) return { valeur: null, raison: 'illisible' };
  const src = publie.sources && typeof publie.sources === 'object' ? publie.sources : null;
  if (!src) return { valeur: null, raison: 'illisible' };
  const manque = Object.entries(src).filter(([, v]) => v === 'pasSu').map(([k]) => k);
  const nc = publie.nonComptees && typeof publie.nonComptees === 'object' ? publie.nonComptees : null;
  if (nc && Number(nc.n) > 0) for (const k of Object.keys(nc.par || {})) { const s = String(k).split('|')[0]; if (s && !manque.includes(s)) manque.push(s); }
  if (nc && Number(nc.n) > 0 && !Object.keys(nc.par || {}).length) manque.push('ventes au montant pas lu');
  return { valeur: recu, partiel: manque.length > 0, manque, raison: '' };
};

// (4 nov.) Le reçu ENTRE deux instants (« Comparer deux mois ») : la même ligne
// publiée, la même fraîcheur (3 jours), les mêmes sources nommées. Un mois ENTIER
// lit `recu[ym]` ; une coupe (mois en cours au même point) lit `recuJours` (jour
// local) — absent (publication d'une app plus ancienne) ⇒ « — ».
const jourLocal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const recuPublieEntre = (publie, { de, a, ym, complet }, maintenant = Date.now()) => {
  if (!publie || typeof publie !== 'object' || !Array.isArray(publie.mois)) return { valeur: null, raison: 'absente' };
  const at = Number(publie.at);
  if (!isFinite(at) || at <= 0) return { valeur: null, raison: 'illisible' };
  if (maintenant - at > RECU_MAX_AGE_MS) return { valeur: null, raison: 'ancienne' };
  const src = publie.sources && typeof publie.sources === 'object' ? publie.sources : null;
  if (!src) return { valeur: null, raison: 'illisible' };
  let valeur;
  if (complet) {
    if (!publie.recu || typeof publie.recu !== 'object' || Array.isArray(publie.recu)) return { valeur: null, raison: 'ancienne-app' };
    valeur = publie.recu[ym] == null ? 0 : Number(publie.recu[ym]);
  } else {
    if (!publie.recuJours || typeof publie.recuJours !== 'object' || Array.isArray(publie.recuJours)) return { valeur: null, raison: 'ancienne-app' };
    const k0 = jourLocal(de), k1 = jourLocal(a);
    // Jour local : le jour de la coupe compte entier (la publication est au jour).
    valeur = Object.entries(publie.recuJours).reduce((t, [k, v]) => (k >= k0 && k <= k1 ? t + Math.round(Number(v) * 100) : t), 0) / 100;
  }
  if (!isFinite(valeur) || valeur < 0) return { valeur: null, raison: 'illisible' };
  const manque = Object.entries(src).filter(([, v]) => v === 'pasSu').map(([k]) => k);
  const nc = publie.nonComptees && typeof publie.nonComptees === 'object' ? publie.nonComptees : null;
  if (nc && Number(nc.n) > 0) for (const k of Object.keys(nc.par || {})) { const s = String(k).split('|')[0]; if (s && !manque.includes(s)) manque.push(s); }
  if (nc && Number(nc.n) > 0 && !Object.keys(nc.par || {}).length) manque.push('ventes au montant pas lu');
  if (manque.length && !(valeur > 0)) return { valeur: null, partiel: true, manque, raison: 'partiel' };
  return { valeur, partiel: manque.length > 0, manque, raison: '' };
};

// ── LES VALEURS ─────────────────────────────────────────────────────────────
// `sources` (ce que l'app a déjà, rien de relu ici) :
//   vendu      : { lignes (ventesFaites) | null, manque: [noms], enAttente, nonComptees }
//   beneficeDe : (periode) → { B, etat }  (la lecture de Comptabilité)
//   joursBenef : la publication `vrm_benefice_jours` | null (+ etatBenef)
//   ligneUrssaf: `vinted_urssaf_mois` | null
//   colisAPoster, colisARetirer, dorment : les publications | null
//   live       : liveStats | null
//   locaux     : { id → { valeur, partiel, ... } } (les cases propres de la page)
// `regles` (les fonctions propriétaires, passées par l'app) :
//   bilanLignes(lignes, depuis, jusqua) · rythmeVendu(lignes, maintenant) ·
//   chiffreBenefice(B, etat) · chiffreBrut(R) · beneficeDesJours(jours, de, a) ·
//   debutPeriode(t, p) · decalerPeriode(d, p, k)
// → { valeur (nombre | null), partiel, manque: [], hors: '', p, attrs }
// (6 nov., onglets A) UNE règle de fraîcheur pour `vrm_colis_aposter` : la carte et le badge de Colis.
export const PUB_COLIS_MAX_MS = 12 * 3600000;
export const publicationColisFraiche = (pub, maintenant = Date.now()) => !!pub && (!Number.isFinite(Number(pub.at)) || pub.at == null || maintenant - Number(pub.at) < PUB_COLIS_MAX_MS);
export const valeurChiffre = (id, place, sources, sel, regles, maintenant = Date.now()) => {
  const S = sources || {};
  const locaux = S.locaux || null;
  const d = defDe(id, locaux);
  const vide = (raison, extra = {}) => ({ valeur: null, partiel: false, manque: [], hors: '', raison, ...extra });
  if (!d) return vide('inconnu', { hors: 'inconnu' });
  if (d.local) {
    const x = locaux[id] || {};
    return { valeur: x.valeur == null ? null : x.valeur, partiel: !!x.partiel, manque: x.manque || [], hors: '', p: null, raison: x.valeur == null ? (x.raison || 'pasSu') : '' };
  }
  const hors = horsSelection(id, sel, locaux);
  const p = periodeDePlace(place || {}, d, sel && sel.periode);
  if (hors) return vide('hors', { hors, p });
  // Une plage libre sur un chiffre qui ne se calcule pas sur des dates quelconques : « — », jamais un faux total.
  if (p && typeof p === 'object' && !p.hors && !PLAGE_IDS.includes(id)) return vide('hors', { hors: 'pas sur une plage de dates', p });
  const site = (sel && sel.site) || 'toutes';
  const plateforme = PLATEFORME_DE_SITE[site] || null;
  const login = sel && sel.compte ? String(sel.compte.login || '') : '';
  const B = bornesPeriode(p, regles, maintenant);

  if (id === 'vendu' || id === 'ventes' || id === 'panier') {
    const V = S.vendu;
    // (6 nov., onglets A, §5) `undefined` = les ventes de la coque pas encore là : « lecture… »,
    // jamais « pas lu » (une panne annoncée à chaque ouverture) ; `null` = pas su.
    if (V === undefined) return vide('encours', { p });
    if (!V || !Array.isArray(V.lignes)) return vide('pasSu', { p });
    const garde = (l) => (!plateforme || l.plateforme === plateforme) && (!login || (l.plateforme === 'Vinted' && String(l.compte || '') === login));
    const lignes = V.lignes.filter(garde);
    // Ce qui manque, pour CE périmètre : un compte Vinted pas lu ne manque pas à eBay.
    const AUTRES = ['Leboncoin', 'eBay', 'Vestiaire'];
    const manque = (V.manque || []).filter((m) => {
      if (login) return m === login;
      if (!plateforme) return true;
      if (plateforme === 'Vinted') return !AUTRES.includes(m);
      return m === plateforme;
    });
    const attente = !!V.enAttente && (!plateforme || plateforme !== 'Vinted');
    if (id === 'panier') {
      const R = regles.rythmeVendu(lignes, maintenant);
      // Une moyenne sur une partie des ventes n'est pas un minimum : « — ».
      if (!R || manque.length || attente) return vide('partiel', { p, manque });
      return { valeur: R.panier30.moyen, partiel: false, manque: [], hors: '', p, raison: R.panier30.moyen == null ? 'aucune' : '' };
    }
    const r = regles.bilanLignes(lignes, B.de, B.a == null ? null : B.a - 1);
    const nc = (V.nonComptees || []).filter((x) => x && (!plateforme || x.plateforme === plateforme) && !login && (x.ts == null || (x.ts >= B.de && (B.a == null || x.ts < B.a))));
    const partiel = manque.length > 0 || attente || nc.length > 0;
    const val = id === 'vendu' ? r.eur : r.n;
    // « Au moins 0 » ne se dit jamais (§5) : rien de lu ⇒ « — ».
    if (partiel && !(val > 0)) return vide('partiel', { p, manque: [...manque, ...nc.map((x) => x.plateforme)] });
    return { valeur: val, partiel, manque: [...new Set([...manque, ...nc.map((x) => x.plateforme)])], hors: '', p, raison: '' };
  }
  if (id === 'benefice' || id === 'declarer' || id === 'urssaf') {
    const L = S.beneficeDe ? S.beneficeDe(p) : null;
    if (!L) return vide('pasSu', { p });
    const { B: Bn, etat } = L;
    if (id === 'benefice') { const CB = regles.chiffreBenefice(Bn, etat); return { valeur: CB.valeur, partiel: false, manque: [], hors: '', p, raison: CB.valeur == null ? (CB.raison || 'pasSu') : '', attrs: CB.attrs, B: Bn, etat }; }
    if (!Bn) return vide(etat === 'encours' ? 'encours' : 'publication', { p });
    if (id === 'urssaf' && Bn.sansCotis) return vide('hors', { p, hors: 'pas de cotisations pour ton statut' });
    const v = id === 'declarer' ? Bn.caDecl : Bn.cotis;
    return { valeur: v == null ? null : v, partiel: false, manque: [], hors: '', p, raison: v == null ? 'cotisations' : '' };
  }
  if (id === 'brut' || id === 'finalisees') {
    const pub = S.joursBenef;
    if (!pub || !pub.jours) return vide(S.etatBenef === 'encours' ? 'encours' : 'publication', { p });
    const R = regles.beneficeDesJours(pub.jours, new Date(B.de), new Date(B.a == null ? maintenant + 86400000 : B.a));
    if (id === 'finalisees') return { valeur: R.n, partiel: false, manque: [], hors: '', p, raison: '' };
    const CB = regles.chiffreBrut(R);
    return { valeur: CB.valeur, partiel: !!CB.partiel, manque: [], hors: '', p, raison: CB.valeur == null ? 'achats' : '', couverture: CB.partiel ? `${CB.nCout} sur ${CB.n}` : '', attrs: CB.attrs };
  }
  if (id === 'recu') {
    const ym = `${new Date(maintenant).getFullYear()}-${String(new Date(maintenant).getMonth() + 1).padStart(2, '0')}`;
    const R = recuPublie(S.ligneUrssaf, ym, maintenant);
    // (6 nov.) Jamais publiée mais l'écran ouvert la prépare : « lecture… », pas « ouvre Ventes ».
    if (R.valeur == null) return vide(R.raison === 'absente' && S.enPreparation && S.enPreparation.urssaf ? 'encours' : R.raison, { p });
    if (R.partiel && !(R.valeur > 0)) return vide('partiel', { p, manque: R.manque });
    // (5 nov., chantier E1, revue 1.7) Des ventes SANS date de versement (« à dater ») ne
    // sont dans AUCUN mois (§5). Rien de daté ce mois et des ventes à dater : « 0 € » dirait
    // « rien reçu » alors qu'on ne SAIT pas ⇒ « — », la raison nommée. Un montant daté reste,
    // le manque écrit à côté (`aDater`) — jamais caché.
    const nAd = Number(S.ligneUrssaf && S.ligneUrssaf.aDater && S.ligneUrssaf.aDater.n) || 0;
    if (nAd > 0 && !(R.valeur > 0)) return vide('a-dater', { p, aDater: nAd });
    return { valeur: R.valeur, partiel: R.partiel, manque: R.manque, hors: '', p, raison: '', aDater: nAd };
  }
  if (id === 'aposter') {
    const pub = S.colisAPoster;
    // (6 nov., onglets A) La publication n'existe que sur l'appareil qui a ouvert Ma journée, Colis
    // ou Ventes · Vinted (`vrm_colis_aposter`). Mesuré : l'app rouverte sur Ventes · Tous disait
    // « À envoyer — pas lu » au-dessus de 11 ventes « À envoyer ». Absente, ou de plus de 12 h (la
    // règle du badge de Colis : le même nombre ou rien), la case dit le geste (« ouvre Colis »).
    if (!pub || !Number.isFinite(pub.total) || !publicationColisFraiche(pub, maintenant)) return vide('colis');
    if (site === 'toutes') {
      const manque = ['ebay', 'leboncoin', 'vestiaire'].filter((k) => pub[k] === null).map((k) => NOM_SITE[k]);
      if (manque.length && !(pub.total > 0)) return vide('partiel', { manque });
      return { valeur: pub.total, partiel: manque.length > 0, manque, hors: '', p: null, raison: '' };
    }
    const v = pub[site];
    return Number.isFinite(v) ? { valeur: v, partiel: false, manque: [], hors: '', p: null, raison: '' } : vide('pasSu', { manque: [NOM_SITE[site]] });
  }
  if (id === 'retirer') {
    const pub = S.colisARetirer;
    // (6 nov.) Absente pendant que l'écran ouvert la prépare : « lecture… », jamais « pas lu ».
    return pub && Number.isFinite(pub.total) ? { valeur: pub.total, partiel: false, manque: [], hors: '', p: null, raison: '' } : vide(S.enPreparation && S.enPreparation.retirer ? 'encours' : 'pasSu');
  }
  if (id === 'attente' || id === 'dispo' || id === 'enligne') {
    const L = S.live;
    if (!L) return vide('pasSu');
    const uid = sel && sel.compte ? String(sel.compte.uid || '') : '';
    if (id === 'attente') {
      const A = aVenirPour(L.aVenir || null, { plateforme, login });
      return A.valeur == null ? vide(A.raison || 'pasSu', { manque: A.manque }) : { valeur: A.valeur, partiel: A.partiel, manque: A.manque, hors: '', p: null, raison: '' };
    }
    if (id === 'dispo') {
      if (!uid) return L.walletDispo == null ? vide('pasSu') : { valeur: L.walletDispo, partiel: false, manque: [], hors: '', p: null, raison: '' };
      const x = Array.isArray(L.walletParCompte) ? L.walletParCompte.find((w) => String(w.uid) === uid) : null;
      return x && x.dispo != null ? { valeur: x.dispo, partiel: false, manque: [], hors: '', p: null, raison: '' } : vide('pasSu');
    }
    if (!uid) return Number.isFinite(L.online) ? { valeur: L.online, partiel: false, manque: [], hors: '', p: null, raison: '' } : vide('pasSu');
    const n = L.annEnLigne && Object.prototype.hasOwnProperty.call(L.annEnLigne, uid) ? L.annEnLigne[uid] : null;
    return Number.isFinite(n) ? { valeur: n, partiel: false, manque: [], hors: '', p: null, raison: '' } : vide('pasSu');
  }
  // (4 nov.) Les masquées par Vinted, LUES il y a moins de 24 h ; les autres sont « à
  // confirmer » ⇒ « au moins ». Un compte jamais lu n'a pas de ligne ⇒ « — » pour lui.
  if (id === 'masquees') {
    const L = S.live;
    const M = L && L.annMasquees && typeof L.annMasquees === 'object' ? L.annMasquees : null;
    if (!M) return vide('pasSu');
    const uid = sel && sel.compte ? String(sel.compte.uid || '') : '';
    const lignes = uid ? (Object.prototype.hasOwnProperty.call(M, uid) ? [M[uid]] : []) : Object.values(M);
    if (!lignes.length) return vide('pasSu');
    const frais = lignes.reduce((s, x) => s + (Number(x.frais) || 0), 0), n = lignes.reduce((s, x) => s + (Number(x.n) || 0), 0);
    const partiel = n > frais;
    if (partiel && !(frais > 0)) return vide('partiel');
    return { valeur: frais, partiel, manque: partiel ? ['lectures de plus de 24 h'] : [], hors: '', p: null, raison: '' };
  }
  if (id === 'dorment') {
    const pub = S.dorment;
    if (!pub || !Number.isFinite(pub.n)) return vide(S.enPreparation && S.enPreparation.dorment ? 'encours' : 'pasSu');
    // Moins de dates connues que d'annonces : « au moins » (la règle du bilan de la semaine).
    const partiel = Number.isFinite(pub.datesKnown) && Number.isFinite(pub.total) && pub.datesKnown < pub.total;
    if (partiel && !(pub.n > 0)) return vide('partiel');
    return { valeur: pub.n, partiel, manque: [], hors: '', p: null, raison: '' };
  }
  return vide('inconnu');
};

// ── LA RAISON D'UN « — », EN DEUX OU TROIS MOTS (5 nov., chantier E1) ────────
// §5 : un chiffre qu'on ne connaît pas s'écrit « — » AVEC la raison. La case la
// dit sous son libellé (la phrase longue reste dans son titre) ; un montant daté
// qui laisse des ventes « à dater » le dit aussi (le manque nommé, jamais caché).
export const RAISON_COURTE = {
  pasSu: 'pas lu', encours: 'lecture…', publication: 'pas calculé', achats: 'prix d’achat manquants',
  frais: 'frais pas lus', cotisations: 'statut à choisir', rien: 'rien à compter', aucune: 'aucune vente',
  statut: 'statut à choisir', absente: 'ouvre Ventes', ancienne: 'à relire', 'ancienne-app': 'à relire', illisible: 'pas lu',
  // (6 nov., onglets A) des envois sans geste « Colis fait » : le nombre n'est pas su.
  nonNotes: 'envois pas notés',
  // (6 nov., onglets A) « À envoyer » pas encore compté sur cet appareil (ou plus de 12 h) : le geste.
  colis: 'ouvre Colis',
};
// (6 nov., onglets A) Un nombre de ventes s'écrit comme les autres (« 1 772 », jamais « 1772 »).
const nFr = (n) => Number(n).toLocaleString('fr-FR');
export const raisonCourte = (x) => {
  if (!x) return '';
  // (9 nov., capture de Julien : « + 1756 » sans unité, € ou ventes ?) Le manque dit son UNITÉ :
  // un nombre de VENTES sans date de versement, jamais un montant.
  if (x.valeur != null) return x.aDater > 0 ? `+ ${nFr(x.aDater)} vente${x.aDater > 1 ? 's' : ''} à dater` : '';
  if (x.hors) return x.hors;
  // Une case PROPRE à la page dit sa raison elle-même (Compta : « À déclarer » sans statut).
  if (x.def && x.def.local && x.def.raisonCourte) return x.def.raisonCourte;
  if (x.raison === 'a-dater') return `${nFr(x.aDater)} vente${x.aDater > 1 ? 's' : ''} à dater`;
  if (x.raison === 'partiel') return x.manque && x.manque.length ? `sans ${x.manque[0]}` : 'pas tout lu';
  return RAISON_COURTE[x.raison] || 'pas lu';
};

// Toute la carte d'une page : le grand chiffre et les cases, avec le périmètre.
export const valeursCarte = (page, reglage, sources, sel, regles, maintenant = Date.now()) => {
  const locaux = (sources && sources.locaux) || null;
  const R = reglageDePage(reglage, page, locaux);
  if (!R) return null;
  const un = (place) => {
    const def = defDe(place.id, locaux);
    const v = valeurChiffre(place.id, place, sources, sel, regles, maintenant);
    return { place, def, ...v };
  };
  const g = un(R.g);
  const c = R.c.map(un);
  // Un grand chiffre propre à la page dit lui-même sa période (« Depuis le début » pour un CA cumulé).
  const per = g.def && g.def.local && g.def.quand ? [g.def.quand, ...perimetre(null, sel, maintenant).split(' · ').slice(1)].join(' · ') : perimetre(g.p === undefined ? null : g.p, sel, maintenant);
  return { g, c, perimetre: per, defaut: R.defaut };
};

// Les chiffres que la feuille propose sur cette page, pour cette sélection :
// tout le catalogue qui a un sens ici, puis les cases propres de la page.
export const chiffresProposes = (sel, locaux = null) => [
  ...IDS_CHIFFRES.filter((id) => !(locaux && Object.prototype.hasOwnProperty.call(locaux, id)) && !horsSelection(id, sel, locaux)),
  ...Object.keys(locaux || {}),
];

// La courbe du grand chiffre « vendu » : le cumul jour par jour depuis le début
// de la période, par la MÊME règle (`bilanLignes` sur chaque jour, les mêmes
// lignes filtrées) — la courbe de la carte de Ventes d'avant. `null` ailleurs.
export const courbeVendu = (sources, sel, p, regles, maintenant = Date.now()) => {
  if (!(p === 'semaine' || p === 'mois')) return null;
  const V = sources && sources.vendu;
  if (!V || !Array.isArray(V.lignes)) return null;
  const site = (sel && sel.site) || 'toutes';
  const plateforme = PLATEFORME_DE_SITE[site] || null;
  const login = sel && sel.compte ? String(sel.compte.login || '') : '';
  const lignes = V.lignes.filter((l) => (!plateforme || l.plateforme === plateforme) && (!login || (l.plateforme === 'Vinted' && String(l.compte || '') === login)));
  const B = bornesPeriode(p, regles, maintenant);
  const out = []; let cumul = 0;
  for (let d = new Date(B.de); d.getTime() <= maintenant; d.setDate(d.getDate() + 1)) {
    const f = new Date(d); f.setDate(f.getDate() + 1);
    cumul += regles.bilanLignes(lignes, d.getTime(), f.getTime() - 1).eur;
    out.push(cumul);
  }
  return out;
};

// ── L'OBJECTIF DU MOIS (4 nov.) ─────────────────────────────────────────────
// La valeur que la barre compare à l'objectif : LE chiffre « vendu » (CA) ou
// « ventes » (nombre) du MOIS, tous les sites, tous les comptes — par
// `valeurChiffre`, la lecture même du grand chiffre (src/objectifMois.js).
export const SEL_OBJECTIF = { site: 'toutes', compte: null, periode: null };
export const valeurObjectif = (obj, sources, regles, maintenant = Date.now()) => {
  if (!obj) return null;
  const id = CHIFFRE_OBJECTIF[obj.type] || 'vendu';
  return valeurChiffre(id, { id, p: 'mois' }, sources, SEL_OBJECTIF, regles, maintenant);
};
// (11 nov., lot objectifs-mois) Le chiffre de chaque mesure : vendu (date de vente),
// bénéfice brut (seulement les ventes au prix d'achat connu), nombre de ventes.
export const CHIFFRE_OBJECTIF = { ca: 'vendu', benefice: 'brut', ventes: 'ventes' };
// La MÊME valeur pour un mois PLEIN passé [de, a) — la proposition (3 derniers mois)
// et le bilan de fin de mois. `couvert` : une vente au moins est lue AVANT ce mois
// (sinon l'historique commence peut-être au milieu : un « 0 » n'y prouve rien) ;
// le bénéfice, lui, n'est publié que depuis le 1er janvier de l'an passé.
export const valeurObjectifMois = (type, sources, regles, bornes, maintenant = Date.now()) => {
  const id = CHIFFRE_OBJECTIF[type];
  if (!id || !bornes) return null;
  const p = { de: bornes.de, a: bornes.a };
  const x = valeurChiffre(id, { id, p }, sources, { ...SEL_OBJECTIF, periode: p }, regles, maintenant);
  const S = sources || {};
  const L = S.vendu && Array.isArray(S.vendu.lignes) ? S.vendu.lignes : [];
  let couvert = L.some((l) => Number(l.ts) < bornes.de);
  if (id === 'brut') couvert = couvert && new Date(bornes.de).getFullYear() >= new Date(maintenant).getFullYear() - 1 && !!(S.joursBenef && S.joursBenef.jours);
  return { ...x, couvert };
};
