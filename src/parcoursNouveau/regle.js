// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS D'UN NOUVEAU — LA RÈGLE (15 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Améliore le parcours. » Mesuré avant (docs/passation/2026-11-15-parcours-nouveau.md) :
// un compte neuf voyait QUATRE accueils empilés — Bienvenue (7 écrans, le premier
// « Choisis ton univers »), la visite en bulles (3), « Ma configuration » (plein écran)
// et la carte « Démarrer avec VRM » (3 étapes) — avec deux pleins sur Ma journée
// (« Commencer » et « Continuer ») et, sur iPhone, « installe-la sur ton ordinateur ».
//
// UN parcours, huit étapes, une phrase et UN geste chacune, dans l'ordre où elles
// servent :
//   1 bienvenue   — le compte est créé (la session le prouve) ;
//   2 plateformes — « Où vends-tu ? » (`vrm_plateformes_affichees`, la clé de toujours) ;
//   3 extension   — l'installer : ordinateur (zip), iPhone (Orion + le raccourci
//                   « Ouvrir les URL »), Android (Firefox) ; prouvée par le pont ;
//   4 comptes     — relier ses comptes : Vinted ouvert une fois (preuve : une lecture
//                   rangée), Leboncoin / Vestiaire (lignes de l'extension), eBay (relié) ;
//   5 numeros     — qui numérote (VRM / moi-même) et « j'ai déjà mes N° sur mes cartons »
//                   (`vrm_numero_ecrit`, la forme de src/guideDemarrage.js / cartonsNumeros.js) ;
//   6 historique  — l'import des 12 derniers mois (`import_vinted_{uid}`, lu, jamais deviné) ;
//   7 journee     — ce que Ma journée montrera (capture RÉELLE du mode exemple) ;
//   8 abonnement  — l'état LU du serveur (etatAbonnement) + Solo / Pro + ce que voit un
//                   non-abonné (§3 « Sans abonnement »).
// Chaque étape se juge sur une PREUVE lue : `fait` · `afaire` · `encours` · `passu`
// (« pas su » n'est jamais « fait », §5) · `info` (rien à prouver : on lit, on passe).
// La position est rangée dans `main` (`vrm_parcours_nouveau`, synchronisée) : on
// reprend là où on s'est arrêté, sur n'importe quel appareil. « Plus tard » met de
// côté 3 jours. Fini ⇒ Bienvenue, la visite en bulles ne s'empilent plus derrière.
// JS pur, sans React : scripts/audit-parcours-nouveau.cjs l'exécute.
// ═══════════════════════════════════════════════════════════════════════════
import { mobileIci, estOrionIci } from '../navigateurExtension.js';

export const CLE_PARCOURS_NOUVEAU = 'vrm_parcours_nouveau';
export const ETAPES_NOUVEAU = Object.freeze(['bienvenue', 'plateformes', 'extension', 'comptes', 'numeros', 'historique', 'journee', 'abonnement']);
export const JOURS_PLUS_TARD = 3;
const JOUR_MS = 864e5;
export const ETATS_ETAPE = Object.freeze(['fait', 'afaire', 'encours', 'passu', 'info', 'inutile']);

// La position rangée → { etape, vues, fini, plusTard } ; `null` = jamais commencé (ou illisible).
export function lireParcoursNouveau(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const etape = ETAPES_NOUVEAU.includes(v.etape) ? v.etape : 'bienvenue';
  const vues = Array.isArray(v.vues) ? ETAPES_NOUVEAU.filter((e) => v.vues.includes(e)) : [];
  const date = (x) => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null);
  return { etape, vues, fini: v.fini === true, finiLe: date(v.finiLe), plusTard: date(v.plusTard), at: date(v.at) };
}

// Ce qu'on range quand il avance, recule, met de côté ou finit. Rien d'autre n'est écrit.
export function positionApres(avant, geste, { etape = null, maintenant = Date.now() } = {}) {
  const p = lireParcoursNouveau(avant) || { etape: 'bienvenue', vues: [], fini: false, finiLe: null, plusTard: null, at: null };
  const at = new Date(maintenant).toISOString();
  const cible = ETAPES_NOUVEAU.includes(etape) ? etape : p.etape;
  const vues = [...new Set([...p.vues, p.etape])].filter((e) => ETAPES_NOUVEAU.includes(e));
  if (geste === 'fin') return { etape: 'abonnement', vues: ETAPES_NOUVEAU.slice(), fini: true, finiLe: at, plusTard: null, at };
  if (geste === 'plusTard') return { ...p, vues, plusTard: at, at };
  return { ...p, etape: cible, vues, plusTard: null, at };
}

// Faut-il l'ouvrir au lancement ? Seulement pour un compte NEUF, jamais en mode exemple,
// jamais pour le propriétaire de l'installation (« pas su » ⇒ on n'ouvre pas : on
// n'interrompt jamais un vendeur installé sur une lecture ratée).
//  · une position rangée : rouvert à son étape, sauf fini ou mis de côté depuis < 3 jours ;
//  · aucune position : seulement un premier jour (aucun compte Vinted rangé) ET un
//    Bienvenue jamais vu (celui qui l'a vu avant ce parcours est déjà installé).
export function parcoursNouveauAOuvrir({ pret, exemple = false, proprietaire, premierJour, valeur, bienvenueVue = false, maintenant = Date.now() } = {}) {
  if (pret !== true || exemple) return false;
  if (proprietaire !== false) return false;
  const v = lireParcoursNouveau(valeur);
  if (v) {
    if (v.fini) return false;
    if (v.plusTard && maintenant - Date.parse(v.plusTard) < JOURS_PLUS_TARD * JOUR_MS) return false;
    return true;
  }
  return premierJour === true && !bienvenueVue;
}

// L'appareil d'ICI, pour l'étape « extension » : un repère pour CHOISIR une consigne,
// jamais une capacité (l'extension se prouve par le pont). `force` : l'aperçu du
// propriétaire seulement (src/modeExemple.js, bac à sable) montre l'iPhone depuis un Mac.
export const APPAREILS = Object.freeze(['ordinateur', 'iphone', 'android']);
export function appareilIci(ua, force = null) {
  if (APPAREILS.includes(force)) return force;
  const m = mobileIci(ua);
  if (m === 'ios' || m === 'ios-orion') return 'iphone';
  if (m === 'android' || m === 'firefox-android' || m === 'samsung' || m === 'duckduckgo') return 'android';
  return 'ordinateur';
}
export const dansOrionIci = (ua) => mobileIci(ua) === 'ios-orion' || (ua == null && estOrionIci());

// L'étape de l'arrivée (src/parcoursArrivee.js, `etatParcours`) pour une clé : son état,
// ou `null` si l'arrivée n'est pas lue.
const etapeArrivee = (arrivee, cles) => (arrivee && Array.isArray(arrivee.etapes) ? arrivee.etapes.find((e) => cles.includes(e.cle)) || null : null);
const etatSur = (x) => (x && ETATS_ETAPE.includes(x.etat) ? x.etat : 'passu');

// LES ÉTATS DES HUIT ÉTAPES, chacun sur sa preuve. `p` :
//   session (bool) · plateformes (lu : objet ou null ; `undefined` = pas encore lu) ·
//   arrivee (etatParcours, ou undefined) · numerotation (réglage brut ; `undefined` = pas lu) ·
//   imports ({ uid: état|null } de lireImportDepart ; `null` pas su ; `undefined` en cours) ·
//   abonnement (etatAbonnement(…) ; `{etat:'chargement'}` en cours) · route ({cle}).
export function etatsEtapes(p = {}) {
  const route = (p.route && p.route.cle) || (p.arrivee && p.arrivee.route) || 'vinted';
  const out = {};
  out.bienvenue = { etat: p.session === true ? 'fait' : 'passu' };
  out.plateformes = { etat: p.plateformes === undefined ? 'encours' : (p.plateformes && Array.isArray(p.plateformes.sites) && p.plateformes.sites.length ? 'fait' : 'afaire'),
    sites: p.plateformes && Array.isArray(p.plateformes.sites) ? p.plateformes.sites.slice() : [] };
  if (route === 'ebay') out.extension = { etat: 'inutile' };
  else if (p.arrivee === undefined) out.extension = { etat: 'encours' };
  else { const e = etapeArrivee(p.arrivee, ['extension']); out.extension = { etat: e ? etatSur(e) : 'passu', detail: e && e.detail ? e.detail : null }; }
  if (p.arrivee === undefined) out.comptes = { etat: 'encours', site: route };
  else { const e = etapeArrivee(p.arrivee, ['vinted', 'leboncoin', 'vestiaire', 'ebay']); out.comptes = { etat: e ? etatSur(e) : 'passu', site: e ? e.cle : route, detail: e && e.detail ? e.detail : null }; }
  if (p.numerotation === undefined) out.numeros = { etat: 'encours' };
  else { const o = p.numerotation && typeof p.numerotation === 'object' ? p.numerotation : null; const choisi = !!(o && (typeof o.depuis === 'string' || typeof o.choisi === 'string')); out.numeros = { etat: choisi ? 'fait' : 'afaire', choix: choisi ? (o.par === 'cartons' ? 'cartons' : o.actif === true ? 'moi' : 'vrm') : null }; }
  out.historique = etatHistorique(p.imports, route);
  out.journee = { etat: 'info' };
  const a = p.abonnement && typeof p.abonnement === 'object' ? p.abonnement : null;
  out.abonnement = { etat: !a || a.etat === 'chargement' ? 'encours' : a.etat === 'pas-su' ? 'passu' : 'info', abo: a ? a.etat : null, jours: a && Number.isInteger(a.jours) ? a.jours : null };
  return out;
}

// L'import des 12 mois : seulement Vinted le fait (5.375 `importpasse`). Lu, jamais deviné :
// aucun compte lu ⇒ « commence quand Vinted est ouvert » (afaire) ; une ligne qui avance ⇒
// encours avec n / N ; toutes finies ⇒ fait ; lecture ratée ⇒ passu.
export function etatHistorique(imports, route = 'vinted') {
  if (route !== 'vinted') return { etat: 'inutile' };
  if (imports === undefined) return { etat: 'encours', n: null, N: null };
  if (imports === null) return { etat: 'passu', n: null, N: null };
  const lignes = Object.values(imports || {}).filter(Boolean);
  if (!lignes.length) return { etat: 'afaire', n: null, N: null };
  let n = 0, N = 0, Nsu = true;
  for (const l of lignes) {
    n += (l.ventes && l.ventes.lus || 0) + (l.achats && l.achats.lus || 0);
    if (l.ventes && l.achats && l.ventes.total != null && l.achats.total != null) N += l.ventes.total + l.achats.total; else Nsu = false;
  }
  const fini = lignes.every((l) => l.etat === 'fini');
  return { etat: fini ? 'fait' : 'encours', n, N: Nsu ? N : null, souci: lignes.some((l) => l.souci) };
}

// La progression montrée en haut : « Étape 3 sur 8 » et les segments faits.
export function progression(etape, etats) {
  const i = Math.max(0, ETAPES_NOUVEAU.indexOf(etape));
  const faites = ETAPES_NOUVEAU.filter((e) => etats && etats[e] && (etats[e].etat === 'fait' || etats[e].etat === 'inutile')).length;
  return { rang: i + 1, total: ETAPES_NOUVEAU.length, faites };
}
export const etapeSuivante = (etape) => ETAPES_NOUVEAU[Math.min(ETAPES_NOUVEAU.length - 1, ETAPES_NOUVEAU.indexOf(etape) + 1)] || null;
export const etapePrecedente = (etape) => ETAPES_NOUVEAU[Math.max(0, ETAPES_NOUVEAU.indexOf(etape) - 1)] || null;
export const estDerniere = (etape) => ETAPES_NOUVEAU.indexOf(etape) === ETAPES_NOUVEAU.length - 1;

// La numérotation choisie à l'étape 5 : la MÊME forme que le guide (src/guideDemarrage.js
// `reglageDuChoix`) et que « J'ai déjà mes N° sur mes cartons » (cartonsNumeros `reponseCartons`).
export function reglageNumerotation(choix, at = new Date().toISOString(), avant = null) {
  const base = avant && typeof avant === 'object' && !Array.isArray(avant) ? avant : {};
  if (choix === 'cartons') return { ...base, actif: true, depuis: at, choisi: at, par: 'cartons' };
  if (choix === 'moi') return { ...base, actif: true, depuis: at, choisi: at };
  if (choix === 'vrm') return { ...base, actif: false, depuis: at, choisi: at };
  return null;
}
// Les plateformes choisies à l'étape 2 : la forme de ChoixPlateformes (`{ sites, at }`).
export const SITES_PARCOURS = Object.freeze(['vinted', 'leboncoin', 'ebay', 'vestiaire']);
export function reglagePlateformes(sites, at = new Date().toISOString()) {
  const s = SITES_PARCOURS.filter((x) => Array.isArray(sites) && sites.includes(x));
  return s.length ? { sites: s, at } : null;
}

// Les captures RÉELLES du mode exemple servies par la vitrine (public/accueil/captures.json :
// `modeExemple: true`). Jamais un faux chiffre dessiné à la main.
export const CAPTURES = Object.freeze({ journee: 'journee', numeros: 'numeros', bienvenue: 'expedier' });
export const captureDe = (cle, sombre = false) => (CAPTURES[cle] ? `/accueil/${CAPTURES[cle]}-${sombre ? 'sombre' : 'clair'}.webp` : null);

// Les liens de l'étape 3 (jamais devinés : ceux que le centre d'aide et l'app servent déjà).
export const LIENS_EXTENSION = Object.freeze({ zip: '/VRM-extension.zip', orion: 'https://apps.apple.com/app/id1484498200', orionFichier: '/VRM-Orion.xpi', aide: '/aide/extension', aideOrion: '/aide/extension#orion', aideRaccourci: '/aide/extension#raccourci', vinted: 'https://www.vinted.fr' });
