// ── MA CONFIGURATION : TOUT CE QUI SE PERSONNALISE, AU DÉPART, EN PLEIN ÉCRAN (9 nov.) ──
// Julien, 9 nov. : « Le choix des plateformes au tout début doit être vraiment en
// plein milieu de l'écran, prendre tout l'écran. Que ce soit là que tu choisis ton
// régime d'entreprise, absolument tout : ta méthode d'étiquetage, sur quelles
// plateformes tu vends, etc. Tout ce qui est personnalisable, tu le fais. »
//
// UNE étape par écran, des cartes à toucher. Chaque étape écrit SES réglages
// (les clés existantes, rien de neuf quand une clé existe déjà) au moment où l'on
// continue : « Plus tard » garde donc tout ce qui a été choisi. Rejouable depuis
// Réglages → « Ma configuration ».
//
// ⚠️ RIEN N'EST ÉCRASÉ : les choix déjà faits sont PRÉ-SÉLECTIONNÉS ; une étape
// n'écrit QUE ce qui a changé par rapport à ce qui était enregistré ; une étape
// sans réponse n'écrit rien. Le statut n'est jamais deviné (« Je ne sais pas
// encore » garde `null`). La méthode d'étiquetage ne renumérote RIEN : elle ne
// touche ni `vinted_annonce_numeros` ni le pool, seulement le réglage
// `vrm_numero_ecrit` (VRM donne-t-il un N° à une annonce sans numéro ?).
//
// LA MÉTHODE D'ÉTIQUETAGE = LE RÉGLAGE DE `claude/numero-etiquette` (fusionné sur
// main le 9 nov., extension 5.334) : `vrm_numero_ecrit` `{ actif, depuis, ou }`,
// `ou` ⊂ ['description', 'titre', 'ref'] (src/numeroEcrit.js, `OU_NUMERO`, jamais
// vide). « VRM numérote » ⇒ `actif: false` (les sources gardées telles quelles) ;
// « Je numérote moi-même » ⇒ `actif: true` et les endroits cochés. Aucune clé à part.
//
// JS pur, sans React ni lecture : `scripts/audit-configuration-depart.cjs` l'exécute.

import { IDS_PLATEFORMES } from './plateformes.js';
import { CLE_PLATEFORMES, lirePlateformes, plateformesAffichees } from './plateformesAffichage.js';
import { CLE_AFFICHAGE, CLE_JE_VENDS, lireReglageAffichage, lireReglageJeVends, CATEGORIES_VENDS, categoriesAPreCocher, reglageJeVendsDe, nomsCategories, affichageAuto } from './profilVendeur.js';
import { CLE_NUMERO_ECRIT, lireReglageNumeroEcrit, OU_NUMERO, NOM_OU } from './numeroEcrit.js';
import { FAMILLES as FAMILLES_NOTIF, familleActive } from '../api/_lib/notif-textes.js';
import { CLE_REGIME, CLE_MICRO_OPTIONS, CLE_RYTHME, CLE_TAUX, CLE_SOCIETE_TVA, regimeLu, tauxMicro, tauxEstOfficiel, activiteMicro } from './profilFiscal.js';

export const CLE_CONFIGURATION = 'vrm_configuration';
export const VERSION_CONFIGURATION = 1;

// ── LES ÉTAPES ───────────────────────────────────────────────────────────────
// `si` : l'étape n'existe que pour certains choix (micro ⇒ URSSAF ; société ⇒ TVA).
export const ETAPES_CONFIGURATION = [
  { cle: 'vends', titre: 'Qu’est-ce que tu vends ?', sous: 'Touche tout ce qui te concerne. Sneakers seules : VRM parle de « paires » ; sinon, d’« articles ».' },
  { cle: 'plateformes', titre: 'Où vends-tu ?', sous: 'Seules ces plateformes s’affichent. Rien n’est supprimé, aucun total ne change.' },
  { cle: 'statut', titre: 'Quel est ton statut ?', sous: 'VRM adapte ta comptabilité. Il ne le devine jamais.' },
  { cle: 'micro', titre: 'Ta micro-entreprise', sous: 'Ce que VRM ne peut pas lire sur ton espace URSSAF.', si: (c) => c.statut === 'micro-vente' || c.statut === 'micro-services' },
  { cle: 'societe', titre: 'Ta TVA', sous: 'Ta société facture-t-elle la TVA ?', si: (c) => c.statut === 'societe' },
  { cle: 'numero', titre: 'Où est ton numéro ?', sous: 'Le numéro de rangement : il dit où est l’article (carton, étagère, bac…).' },
  { cle: 'affichage', titre: 'Tout voir, ou l’essentiel ?', sous: 'Ce choix ne change que le menu et les conseils : aucun chiffre, aucune donnée.' },
  { cle: 'notifs', titre: 'Ce qui sonne sur ton téléphone', sous: 'Les notifications que tu veux recevoir.' },
  { cle: 'recap', titre: 'Tout est prêt', sous: 'Voici ton VRM. Chaque choix se change dans Réglages → Ma configuration.' },
];
export const etapesActives = (choix) => ETAPES_CONFIGURATION.filter((e) => !e.si || e.si(choix || {}));

// ── LES CHOIX DE CHAQUE ÉTAPE ────────────────────────────────────────────────
// (9 nov., soir) Des tuiles à choix MULTIPLE (les catégories de src/profilVendeur.js,
// propriétaire de `vrm_je_vends`). Sneakers SEULES ⇒ « paire », taille et marque jugées ;
// toute autre réponse ⇒ « article », taille et marque facultatives.
export const CHOIX_VENDS = CATEGORIES_VENDS;
export const CHOIX_STATUT = [
  { v: 'particulier', titre: 'Particulier', sous: 'Je vends mes propres affaires.', effet: 'Rien à déclarer à l’URSSAF.' },
  { v: 'micro-vente', titre: 'Micro-entreprise · achat‑revente', sous: 'J’achète pour revendre.', effet: 'VRM estime tes cotisations et te rappelle chaque déclaration.' },
  { v: 'micro-services', titre: 'Micro-entreprise · prestations', sous: 'Je vends un service (BIC).', effet: 'Le taux des prestations de services commerciales.' },
  { v: 'societe', titre: 'Société', sous: 'EI au réel, EURL, SASU, SARL…', effet: 'Livre des recettes et export pour ton comptable.' },
  { v: 'inconnu', titre: 'Je ne sais pas encore', sous: 'Rien n’est calculé tant que tu n’as pas choisi.', effet: 'Une aide courte et les pages officielles.' },
];
export const CHOIX_RYTHME = [
  { v: 'mensuel', titre: 'Chaque mois', sous: 'Tu déclares le mois d’avant.' },
  { v: 'trimestriel', titre: 'Chaque trimestre', sous: 'Tu déclares les trois mois d’avant.' },
];
export const CHOIX_LIBERATOIRE = [
  { v: 'oui', titre: 'Oui', sous: 'L’impôt part avec les cotisations.' },
  { v: 'non', titre: 'Non', sous: 'Impôt sur ta déclaration de revenus.' },
];
export const CHOIX_ACRE = [
  { v: 'non', titre: 'Non', sous: 'Pas d’aide à la création.' },
  { v: 'avant', titre: 'Oui, début avant juillet 2026', sous: 'Cotisations réduites de moitié la 1re année.' },
  { v: 'apres', titre: 'Oui, début depuis juillet 2026', sous: 'Cotisations réduites d’un quart la 1re année.' },
];
export const CHOIX_TVA_SOCIETE = [
  { v: 'franchise', titre: 'Franchise en base', sous: 'Pas de TVA sur mes factures (« TVA non applicable »).' },
  { v: 'normale', titre: 'TVA collectée', sous: 'Je facture la TVA et je la reverse.' },
  { v: 'marge', titre: 'TVA sur la marge', sous: 'Biens d’occasion : la TVA porte sur ma marge.' },
];
export const CHOIX_NUMERO = [
  { v: 'vrm', titre: 'VRM numérote', sous: 'Chaque annonce reçoit un numéro ; tu l’écris là où tu ranges l’article.' },
  { v: 'moi', titre: 'Je numérote moi-même', sous: 'Tu écris le numéro dans l’annonce ; VRM le lit là où tu le mets.' },
];
// Les endroits où il l'écrit (plusieurs possibles, jamais aucun) : ceux de src/numeroEcrit.js.
const SOUS_OU = { description: 'Tu écris « N° 123 » en bas de l’annonce.', titre: 'Tu écris « #123 » dans le titre.', ref: 'SKU eBay, référence Leboncoin.' };
export const CHOIX_OU = OU_NUMERO.map((v) => ({ v, titre: NOM_OU[v], sous: SOUS_OU[v] || '' }));
// (9 nov., soir) Julien : « Cette étape n'est pas claire. » Chaque carte dit, en puces
// CONCRÈTES, ce qu'elle montre ou cache — exactement ce que font `entreeMontree` et
// `caseJourneeMontree` de src/profilVendeur.js (Simple ne cache que des entrées du menu
// et un conseil ; aucun total ne change ; chaque écran reste joignable).
export const CHOIX_AFFICHAGE = [
  { v: 'simple', titre: 'L’essentiel (Simple)', sous: 'Pour démarrer : un compte, peu de ventes.', puces: [
    'Le menu cache Stock tant que tu n’as rangé aucun meuble, et Republier tant que tu n’as jamais republié.',
    'Les plateformes que tu n’as pas reliées n’apparaissent pas.',
    'Ma journée garde tout ce qui est à faire, sans le conseil « Prix à baisser ».',
  ] },
  { v: 'complet', titre: 'Tout voir (Complet)', sous: 'Pour plusieurs comptes ou beaucoup de ventes.', puces: [
    'Tous les écrans dans le menu, même ceux qui ne servent pas encore.',
    'Tous les conseils de Ma journée.',
  ] },
  { v: 'auto', titre: 'Laisser VRM choisir', sous: 'L’essentiel tant que tu as un seul compte Vinted et moins de 30 ventes sur 30 jours ; tout, au-delà.' },
];
// « Recommandé pour toi » : la règle existante (`affichageAuto`), seulement quand on SAIT
// (comptes Vinted et ventes des 30 jours lus). Pas su ⇒ aucune recommandation.
export function affichageRecommande(contexte) {
  const c = contexte || {};
  if (c.proprietaire === true) return 'complet';
  if (c.proprietaire !== false || typeof c.nComptesVinted !== 'number' || typeof c.nVentes30j !== 'number') return null;
  return affichageAuto(c);
}
export const CHEMIN_REGLAGE_AFFICHAGE = 'Réglages → Affichage → Affichage';

// ── LIRE CE QUI EST DÉJÀ ENREGISTRÉ ──────────────────────────────────────────
export function lireConfiguration(brut) {
  const o = brut && typeof brut === 'object' ? brut : null;
  if (!o) return null;
  const etat = o.etat === 'fait' || o.etat === 'plusTard' ? o.etat : null;
  if (!etat) return null;
  return { etat, at: typeof o.at === 'string' ? o.at : null, statut: o.statut === 'inconnu' ? 'inconnu' : null, version: Number(o.version) || 0 };
}

// `lus` : ce que l'app a lu, TEL QUEL (valeurs brutes des clés) :
//   jeVends, plateformes, relies, regime, microOptions, rythme, tauxBrut, societeTva,
//   numeroEcrit, affichage, configuration, pushPrefs (undefined · null · objet).
// Rend les choix PRÉ-SÉLECTIONNÉS : une réponse jamais donnée reste `null`.
export function choixInitiaux(lus = {}) {
  const rp = lirePlateformes(lus.plateformes);
  const regime = regimeLu(lus.regime);
  const conf = lireConfiguration(lus.configuration);
  const mo = lus.microOptions && typeof lus.microOptions === 'object' ? lus.microOptions : {};
  let statut = null;
  if (regime === 'micro') statut = activiteMicro(mo) === 'services' ? 'micro-services' : 'micro-vente';
  else if (regime === 'societe' || regime === 'marge') statut = 'societe';
  else if (regime === 'particulier') statut = 'particulier';
  else if (conf && conf.statut === 'inconnu') statut = 'inconnu';
  const ts = lus.societeTva && typeof lus.societeTva === 'object' ? lus.societeTva.choix : null;
  const ne = lireReglageNumeroEcrit(lus.numeroEcrit);
  const neBrut = lus.numeroEcrit && typeof lus.numeroEcrit === 'object' ? lus.numeroEcrit : null;
  const dejaChoisiNum = !!(neBrut && (typeof neBrut.depuis === 'string' || typeof neBrut.choisi === 'string'));
  const aff = lireReglageAffichage(lus.affichage).choix;
  return {
    // Ce qu'il vend : les catégories cochées (jamais devinées ; rien choisi ⇒ null).
    vends: (() => { const c = categoriesAPreCocher(lus.jeVends); return c.length ? c : null; })(),
    vendsAutre: lireReglageJeVends(lus.jeVends).autre,
    plateformes: plateformesAffichees(rp ? { sites: rp.sites } : null, lus.relies || {}),
    plateformesChoisies: !!rp,
    statut,
    rythme: lus.rythme === 'mensuel' || lus.rythme === 'trimestriel' ? lus.rythme : null,
    liberatoire: mo.liberatoire === 'oui' || mo.liberatoire === 'non' ? mo.liberatoire : null,
    acre: mo.acre === 'apres' ? 'apres' : (mo.acre === true || mo.acre === 'avant') ? 'avant' : (mo.at ? 'non' : null),
    tvaSociete: regime === 'marge' ? 'marge' : (ts === 'franchise' || ts === 'normale' ? ts : null),
    // Allumé ⇒ « je numérote » (et ses endroits) ; éteint ET choisi ⇒ « VRM numérote » ;
    // jamais choisi ⇒ rien de coché. Les endroits : ceux du réglage (tous, par défaut).
    numero: ne.actif ? 'moi' : (dejaChoisiNum ? 'vrm' : null),
    numeroOu: ne.ou.slice(),
    affichage: aff === 'simple' || aff === 'complet' ? aff : (lus.affichage && typeof lus.affichage === 'object' && lus.affichage.choix === 'auto' ? 'auto' : null),
    familles: famillesDe(lus.pushPrefs),
  };
}
// Les familles de notifications lues : `null` tant que la ligne n'est pas LUE
// (ou illisible) — l'étape le dit et n'écrit rien.
// La règle d'une famille est celle du serveur (`familleActive`, api/_lib/notif-textes.js).
export { FAMILLES_NOTIF };
export function famillesDe(prefs) {
  if (!prefs || typeof prefs !== 'object') return null;
  const out = {};
  for (const x of FAMILLES_NOTIF) out[x.id] = familleActive(prefs, x.id);
  return out;
}

// ── CE QU'UNE ÉTAPE ÉCRIT ────────────────────────────────────────────────────
// Rend [{ cle, valeur }] (save de l'app) et, pour les notifications,
// { cle: 'push_prefs', ligne: true, valeur } (la ligne dédiée, lue puis réécrite
// entière). N'écrit QUE ce qui a changé par rapport à `initial` ; rien sur une
// étape sans réponse. `lus` sert à ne jamais remplacer un taux posé à la main.
export function ecrituresEtape(cle, choix, initial, lus = {}, at = new Date().toISOString()) {
  const c = choix || {}, i = initial || {};
  const out = [];
  if (cle === 'vends') {
    const cats = Array.isArray(c.vends) ? c.vends : [];
    const avant = Array.isArray(i.vends) ? i.vends : [];
    const autre = cats.includes('autre') ? String(c.vendsAutre || '').trim() : '';
    const autreAvant = avant.includes('autre') ? String(i.vendsAutre || '').trim() : '';
    if (cats.length && (cats.slice().sort().join() !== avant.slice().sort().join() || autre !== autreAvant)) {
      const v = reglageJeVendsDe(cats, autre, at);
      if (v) out.push({ cle: CLE_JE_VENDS, valeur: v });
    }
  } else if (cle === 'plateformes') {
    const sites = IDS_PLATEFORMES.filter((id) => (c.plateformes || []).includes(id));
    const avant = IDS_PLATEFORMES.filter((id) => (i.plateformes || []).includes(id));
    if (sites.length && (!i.plateformesChoisies || sites.join('|') !== avant.join('|'))) out.push({ cle: CLE_PLATEFORMES, valeur: { sites, at } });
  } else if (cle === 'statut') {
    if (!c.statut || c.statut === i.statut) return out;
    const regimeAvant = regimeLu(lus.regime);
    if (c.statut === 'inconnu') {
      // « Je ne sais pas encore » : le statut reste (ou redevient) NON CHOISI.
      if (regimeAvant !== null) out.push({ cle: CLE_REGIME, valeur: null });
    } else {
      const regime = c.statut.startsWith('micro') ? 'micro' : c.statut === 'societe' ? (regimeAvant === 'marge' ? 'marge' : 'societe') : c.statut;
      if (regime !== regimeAvant) out.push({ cle: CLE_REGIME, valeur: regime });
      if (regime === 'micro') {
        const activite = c.statut === 'micro-services' ? 'services' : 'vente';
        const mo = lus.microOptions && typeof lus.microOptions === 'object' ? lus.microOptions : {};
        if (activiteMicro(mo) !== activite || (activite === 'vente' && mo.activite !== 'vente')) {
          out.push({ cle: CLE_MICRO_OPTIONS, valeur: { ...optionsPropres(mo), activite, at: Date.now() } });
        }
        const t = tauxSiOfficiel(lus.tauxBrut, { activite, liberatoire: mo.liberatoire === 'oui', acre: acreDe(mo.acre) });
        if (t != null) out.push({ cle: CLE_TAUX, valeur: t });
      }
    }
  } else if (cle === 'micro') {
    if (c.rythme && c.rythme !== i.rythme) out.push({ cle: CLE_RYTHME, valeur: c.rythme });
    const change = (c.liberatoire && c.liberatoire !== i.liberatoire) || (c.acre && c.acre !== i.acre);
    if (change) {
      const mo = lus.microOptions && typeof lus.microOptions === 'object' ? lus.microOptions : {};
      const activite = c.statut === 'micro-services' ? 'services' : 'vente';
      const lib = c.liberatoire || (mo.liberatoire === 'oui' || mo.liberatoire === 'non' ? mo.liberatoire : null);
      const acre = c.acre ? (c.acre === 'non' ? false : c.acre) : acreDe(mo.acre);
      out.push({ cle: CLE_MICRO_OPTIONS, valeur: { liberatoire: lib, acre, activite, at: Date.now() } });
      const t = tauxSiOfficiel(lus.tauxBrut, { activite, liberatoire: lib === 'oui', acre });
      if (t != null) out.push({ cle: CLE_TAUX, valeur: t });
    }
  } else if (cle === 'societe') {
    if (!c.tvaSociete || c.tvaSociete === i.tvaSociete) return out;
    const regimeAvant = regimeLu(lus.regime);
    if (c.tvaSociete === 'marge') { if (regimeAvant !== 'marge') out.push({ cle: CLE_REGIME, valeur: 'marge' }); }
    else {
      if (regimeAvant === 'marge') out.push({ cle: CLE_REGIME, valeur: 'societe' });
      out.push({ cle: CLE_SOCIETE_TVA, valeur: { choix: c.tvaSociete, at } });
    }
  } else if (cle === 'numero') {
    if (!c.numero) return out;
    const actif = c.numero === 'moi';
    const ou = OU_NUMERO.filter((k) => (c.numeroOu || []).includes(k));
    if (actif && !ou.length) return out;                       // jamais zéro endroit
    // `vrm_numero_ecrit` seulement s'il CHANGE (allumé ⇄ éteint, endroits) ou n'a jamais été
    // choisi. La date `depuis` ne bouge que si allumé/éteint change ; le reste est gardé.
    const ne = lireReglageNumeroEcrit(lus.numeroEcrit);
    const neBrut = lus.numeroEcrit && typeof lus.numeroEcrit === 'object' ? lus.numeroEcrit : null;
    const jamais = !(neBrut && (typeof neBrut.depuis === 'string' || typeof neBrut.choisi === 'string'));
    const ouChange = actif && ou.join() !== ne.ou.join();
    if (ne.actif !== actif || ouChange || jamais) {
      out.push({ cle: CLE_NUMERO_ECRIT, valeur: { ...(neBrut || {}), actif,
        depuis: ne.actif !== actif || !ne.depuis ? at : ne.depuis, choisi: (neBrut && neBrut.choisi) || at,
        ...(actif ? { ou } : {}) } });
    }
  } else if (cle === 'affichage') {
    if (c.affichage && c.affichage !== i.affichage) out.push({ cle: CLE_AFFICHAGE, valeur: { choix: c.affichage, at } });
  } else if (cle === 'notifs') {
    if (!c.familles || !i.familles || !lus.pushPrefs || typeof lus.pushPrefs !== 'object') return out;
    const diff = Object.keys(c.familles).some((k) => c.familles[k] !== i.familles[k]);
    if (diff) out.push({ cle: 'push_prefs', ligne: true, valeur: { ...lus.pushPrefs, familles: { ...((lus.pushPrefs && lus.pushPrefs.familles) || {}), ...c.familles } } });
  }
  return out;
}
const acreDe = (a) => (a === 'apres' ? 'apres' : (a === true || a === 'avant') ? 'avant' : false);
const optionsPropres = (mo) => ({ liberatoire: mo.liberatoire === 'oui' || mo.liberatoire === 'non' ? mo.liberatoire : null, acre: acreDe(mo.acre) });
// Le taux composé, seulement si le taux enregistré n'a pas été posé à la main
// (sinon `null` : on ne le remplace jamais en silence) et s'il change.
function tauxSiOfficiel(tauxBrut, o) {
  if (!tauxEstOfficiel(tauxBrut)) return null;
  const t = tauxMicro(o);
  const avant = parseFloat(String(tauxBrut == null ? '' : tauxBrut).replace(',', '.'));
  return Number.isFinite(avant) && avant === t ? null : t;
}

// Ce que la configuration elle-même retient (« fait » ou « plus tard », et la
// réponse « Je ne sais pas encore », qui ne s'écrit nulle part ailleurs).
export function ecritureFin(etat, choix, at = new Date().toISOString()) {
  return { cle: CLE_CONFIGURATION, valeur: { etat: etat === 'fait' ? 'fait' : 'plusTard', at, statut: choix && choix.statut === 'inconnu' ? 'inconnu' : null, version: VERSION_CONFIGURATION } };
}

// ── QUAND L'OUVRIR TOUTE SEULE ───────────────────────────────────────────────
// Une fois, au premier lancement : le nuage est LU, la base répond, pas en mode
// exemple, pas pendant la présentation d'arrivée, jamais pour le propriétaire de
// l'installation (il la rejoue depuis Réglages), et seulement si ni la
// configuration ni le choix des plateformes n'a jamais été fait (un vendeur
// installé n'est jamais interrompu). « Pas su » (proprietaire null) ⇒ on n'ouvre pas.
export function configurationAOuvrir({ pret, baseKO, exemple, bienvenue, proprietaire, configuration, plateformes } = {}) {
  if (!pret || baseKO || exemple || bienvenue) return false;
  if (proprietaire !== false) return false;
  if (lireConfiguration(configuration)) return false;
  if (lirePlateformes(plateformes)) return false;
  return true;
}

// ── LE RÉCAP ─────────────────────────────────────────────────────────────────
const nomDe = (liste, v) => ((liste.find((x) => x.v === v) || {}).titre) || null;
export function recapConfiguration(choix, { nomsPlateformes = {}, famillesNotif = FAMILLES_NOTIF } = {}) {
  const c = choix || {};
  const L = [];
  L.push({ etape: 'vends', titre: 'Tu vends', valeur: Array.isArray(c.vends) && c.vends.length ? nomsCategories(c.vends, c.vendsAutre).join(', ') : null });
  L.push({ etape: 'plateformes', titre: 'Tes plateformes', valeur: (c.plateformes || []).map((id) => nomsPlateformes[id] || id).join(', ') || null });
  L.push({ etape: 'statut', titre: 'Ton statut', valeur: nomDe(CHOIX_STATUT, c.statut) });
  if (c.statut === 'micro-vente' || c.statut === 'micro-services') {
    const lib = c.liberatoire === 'oui';
    const acre = c.acre === 'non' || !c.acre ? false : c.acre;
    L.push({ etape: 'micro', titre: 'Tes cotisations', valeur: `${String(tauxMicro({ activite: c.statut === 'micro-services' ? 'services' : 'vente', liberatoire: lib, acre })).replace('.', ',')} % · ${c.rythme === 'mensuel' ? 'chaque mois' : c.rythme === 'trimestriel' ? 'chaque trimestre' : 'rythme à choisir'}` });
  }
  if (c.statut === 'societe') L.push({ etape: 'societe', titre: 'Ta TVA', valeur: nomDe(CHOIX_TVA_SOCIETE, c.tvaSociete) });
  L.push({ etape: 'numero', titre: 'Ton numéro', valeur: c.numero === 'moi' ? `Tu numérotes : ${(c.numeroOu || []).map((k) => NOM_OU[k].replace(/^À la fin de la /, 'fin de la ').replace(/^Dans le champ « référence » de la plateforme$/, 'champ référence').replace(/^Dans le /, '')).join(', ')}` : nomDe(CHOIX_NUMERO, c.numero) });
  L.push({ etape: 'affichage', titre: 'Affichage', valeur: nomDe(CHOIX_AFFICHAGE, c.affichage) });
  if (c.familles) {
    const on = famillesNotif.filter((f) => c.familles[f.id]).length;
    L.push({ etape: 'notifs', titre: 'Notifications', valeur: `${on} sur ${famillesNotif.length}` });
  } else L.push({ etape: 'notifs', titre: 'Notifications', valeur: null });
  return L;
}

// Ce que les écritures d'une étape changent dans `lus` (pour que l'étape suivante
// compare à ce qui est VRAIMENT enregistré maintenant).
const CHAMP_DE = {
  [CLE_JE_VENDS]: 'jeVends', [CLE_PLATEFORMES]: 'plateformes', [CLE_REGIME]: 'regime', [CLE_MICRO_OPTIONS]: 'microOptions',
  [CLE_RYTHME]: 'rythme', [CLE_TAUX]: 'tauxBrut', [CLE_SOCIETE_TVA]: 'societeTva', [CLE_NUMERO_ECRIT]: 'numeroEcrit',
  [CLE_AFFICHAGE]: 'affichage', push_prefs: 'pushPrefs', [CLE_CONFIGURATION]: 'configuration',
};
export function appliquerEcritures(lus, ecritures) {
  const out = { ...(lus || {}) };
  for (const w of ecritures || []) { const k = CHAMP_DE[w.cle]; if (k) out[k] = w.valeur; }
  return out;
}
