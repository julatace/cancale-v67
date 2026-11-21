// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS D'UN NOUVEAU — LA RÈGLE (15 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Améliore le parcours. » Mesuré avant (docs/passation/2026-11-15-parcours-nouveau.md) :
// un compte neuf voyait QUATRE accueils empilés — Bienvenue (7 écrans, le premier
// « Choisis ton univers »), la visite en bulles (3), « Ma configuration » (plein écran)
// et la carte « Démarrer avec VRM » (3 étapes) — avec deux pleins sur Ma journée
// (« Commencer » et « Continuer ») et, sur iPhone, « installe-la sur ton ordinateur ».
//
// (20 nov., Julien : « OK » à « un parcours de 5 minutes : installer l'extension, ouvrir Vinted,
// choisir l'étiquetage, premier import ») — SIX pages poussées, style Paramètres (NATIF.md §1 bis),
// pensées pour 2 000 à 3 000 vendeurs qui ne sont pas tous sur Vinted (CLAUDE.md §2.11) :
//   1 plateformes — « Tu vends où ? » (`vrm_plateformes_affichees`, la clé de toujours ; plusieurs permis) ;
//   2 extension   — l'installer : le navigateur d'ICI est reconnu (`installationIci`) — Chrome, Edge,
//                   Brave (boutique quand la fiche est publiée, sinon le zip guidé), Orion sur iPhone
//                   (son fichier), Safari (iPhone : Orion à installer ; Mac : un autre navigateur) ;
//                   prouvée EN DIRECT par le pont (l'état de la page Extension, src/extension/peutFaire.js) ;
//   3 comptes     — ouvrir chaque site choisi : le compte CAPTÉ s'affiche dès qu'il est lu ;
//   4 etiquetage  — la méthode d'étiquetage (src/etiquetage/methode.js, les trois clés de toujours) ;
//   5 historique  — le premier import (`import_vinted_{uid}`, l'avancement LU, jamais deviné) ;
//   6 pret        — « Tout est prêt » : le résumé des cinq, et ce qui reste (jamais bloquant).
// Les anciennes positions (huit étapes du 15 nov.) se relisent : bienvenue ⇒ plateformes,
// numeros ⇒ etiquetage, journee / abonnement ⇒ pret (`ANCIENNES_ETAPES`).
// Chaque étape se juge sur une PREUVE lue : `fait` · `afaire` · `encours` · `passu`
// (« pas su » n'est jamais « fait », §5) · `info` (rien à prouver) · `inutile` (pas pour ce vendeur).
// La position est rangée dans `main` (`vrm_parcours_nouveau`, synchronisée) : on
// reprend là où on s'est arrêté, sur n'importe quel appareil. « Plus tard » met de
// côté 3 jours ; « Passer » saute une étape sans rien écrire d'autre que la position.
// JS pur, sans React : scripts/audit-parcours-nouveau.cjs l'exécute.
// ═══════════════════════════════════════════════════════════════════════════
import { mobileIci, estOrionIci, navigateurIci, installerExtensionIci } from '../navigateurExtension.js';
import { methodeDe } from '../etiquetage/methode.js';

export const CLE_PARCOURS_NOUVEAU = 'vrm_parcours_nouveau';
export const ETAPES_NOUVEAU = Object.freeze(['plateformes', 'extension', 'comptes', 'etiquetage', 'historique', 'pret']);
// Les étapes du parcours du 15 nov. (huit) : une position rangée avant le 20 nov. reprend à la page qui la remplace.
export const ANCIENNES_ETAPES = Object.freeze({ bienvenue: 'plateformes', numeros: 'etiquetage', journee: 'pret', abonnement: 'pret' });
const etapeLue = (e) => (ETAPES_NOUVEAU.includes(e) ? e : (ANCIENNES_ETAPES[e] || null));
export const JOURS_PLUS_TARD = 3;
const JOUR_MS = 864e5;
export const ETATS_ETAPE = Object.freeze(['fait', 'afaire', 'encours', 'passu', 'info', 'inutile']);

// La position rangée → { etape, vues, fini, plusTard } ; `null` = jamais commencé (ou illisible).
export function lireParcoursNouveau(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const etape = etapeLue(v.etape) || 'plateformes';
  const vues = Array.isArray(v.vues) ? ETAPES_NOUVEAU.filter((e) => v.vues.some((x) => etapeLue(x) === e)) : [];
  const date = (x) => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null);
  return { etape, vues, fini: v.fini === true, finiLe: date(v.finiLe), plusTard: date(v.plusTard), at: date(v.at) };
}

// Ce qu'on range quand il avance, recule, met de côté ou finit. Rien d'autre n'est écrit.
export function positionApres(avant, geste, { etape = null, maintenant = Date.now() } = {}) {
  const p = lireParcoursNouveau(avant) || { etape: 'plateformes', vues: [], fini: false, finiLe: null, plusTard: null, at: null };
  const at = new Date(maintenant).toISOString();
  const cible = ETAPES_NOUVEAU.includes(etape) ? etape : p.etape;
  const vues = [...new Set([...p.vues, p.etape])].filter((e) => ETAPES_NOUVEAU.includes(e));
  if (geste === 'fin') return { etape: 'pret', vues: ETAPES_NOUVEAU.slice(), fini: true, finiLe: at, plusTard: null, at };
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
  out.etiquetage = etatEtiquetage(p.etiquetage);
  out.historique = etatHistorique(p.imports, route);
  out.journee = { etat: 'info' };
  out.pret = { etat: 'info' };
  const a = p.abonnement && typeof p.abonnement === 'object' ? p.abonnement : null;
  out.abonnement = { etat: !a || a.etat === 'chargement' ? 'encours' : a.etat === 'pas-su' ? 'passu' : 'info', abo: a ? a.etat : null, jours: a && Number.isInteger(a.jours) ? a.jours : null };
  return out;
}

// La méthode d'étiquetage (étape 4) : `brut` = { numeroEcrit, prefixe, etiquetage } tels qu'ENREGISTRÉS ;
// `undefined` = pas encore lu. Faite quand « qui numérote » ET « l'étiquette » sont choisis (la série a
// toujours une valeur : chiffres par défaut). Jamais devinée (src/etiquetage/methode.js `methodeDe`).
export function etatEtiquetage(brut) {
  if (brut === undefined) return { etat: 'encours', qui: null, support: null };
  if (brut === null || typeof brut !== 'object') return { etat: 'passu', qui: null, support: null };
  const m = methodeDe(brut);
  return { etat: m.qui && m.support ? 'fait' : 'afaire', qui: m.qui, support: m.support, serie: m.serie, lettre: m.lettre };
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

// ── (20 nov.) L'EXTENSION, SELON LE NAVIGATEUR D'ICI ─────────────────────────────────────
// Un repère pour CHOISIR la consigne et le lien, jamais une capacité (l'extension se prouve par le
// pont). `ua` : l'agent utilisateur (null ⇒ celui d'ici) ; `kagi` : `window.KAGI` présent (Orion) ;
// `liens` : LIENS_BOUTIQUES (vides tant qu'aucune fiche n'est publiée — jamais un lien deviné).
// Rend { nav, mode, lien, nomBoutique } :
//   mode 'boutique'   — la fiche publiée de CE navigateur (Chrome Web Store pour Chrome, Brave, Vivaldi…) ;
//        'zip'        — le paquet Chromium servi, à charger « non empaqueté » (pas à pas guidé) ;
//        'orion'      — Orion sur iPhone : son fichier d'extension ;
//        'orion-app'  — Safari sur iPhone : installer Orion (le seul navigateur d'iPhone qui accepte une extension) ;
//        'autre-nav'  — Safari sur Mac, Firefox d'ordinateur : ouvrir VRM dans Chrome, Edge ou Brave ;
//        'ordinateur' — un téléphone Android : l'extension se pose sur l'ordinateur (Firefox Android : sa boutique, publiée).
export const NAVS_PARCOURS = Object.freeze(['chrome', 'edge', 'brave', 'opera', 'vivaldi', 'orion-iphone', 'safari-iphone', 'safari-mac', 'orion-mac', 'firefox', 'android', 'autre']);
export function installationIci({ ua = null, kagi = undefined, liens = undefined } = {}) {
  const u = String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');
  const orion = kagi !== undefined ? !!kagi : (ua == null && estOrionIci());
  const ios = /iPhone|iPad|iPod/i.test(u);
  const android = /Android/i.test(u);
  const nav = orion ? 'orion' : navigateurIci(ua == null ? undefined : u);
  if (ios) return orion ? { nav: 'orion-iphone', mode: 'orion', lien: LIENS_EXTENSION.orionFichier, nomBoutique: '' }
    : { nav: 'safari-iphone', mode: 'orion-app', lien: LIENS_EXTENSION.orion, nomBoutique: 'App Store' };
  if (android) {
    const fx = liens && liens.firefox;
    return nav === 'firefox' && fx ? { nav: 'android', mode: 'boutique', lien: fx, nomBoutique: 'Firefox Add-ons' } : { nav: 'android', mode: 'ordinateur', lien: '', nomBoutique: '' };
  }
  if (nav === 'orion') return { nav: 'orion-mac', mode: 'autre-nav', lien: '', nomBoutique: '' };
  if (nav === 'safari') return { nav: 'safari-mac', mode: 'autre-nav', lien: '', nomBoutique: '' };
  if (nav === 'firefox') {
    const fx = liens && liens.firefox;
    return fx ? { nav: 'firefox', mode: 'boutique', lien: fx, nomBoutique: 'Firefox Add-ons' } : { nav: 'firefox', mode: 'autre-nav', lien: '', nomBoutique: '' };
  }
  const chromium = { chrome: 'chrome', brave: 'brave', edge: 'edge', opera: 'opera', vivaldi: 'vivaldi', yandex: 'chrome' }[nav];
  if (!chromium) return { nav: 'autre', mode: 'autre-nav', lien: '', nomBoutique: '' };
  const inst = installerExtensionIci(ua == null ? undefined : u, liens);
  return inst.boutique ? { nav: chromium, mode: 'boutique', lien: inst.lien, nomBoutique: inst.nomBoutique } : { nav: chromium, mode: 'zip', lien: inst.lien, nomBoutique: '' };
}
// L'étape « extension » EN DIRECT : la règle de la page Extension (`etatNavigateur` de src/extension/peutFaire.js,
// passée ici en `nav`) prime sur la preuve d'arrivée ; « pas su » reste « pas su ». Un vendeur eBay seul n'en a pas besoin.
export function etatExtensionDirect(navExt, etape = {}) {
  if (etape && etape.etat === 'inutile') return { etat: 'inutile', code: 'inutile' };
  const code = navExt && typeof navExt.code === 'string' ? navExt.code : '';
  if (code === 'ok' || code === 'maj' || code === 'telephone-relais') return { etat: 'fait', code };
  if (code === 'verif' || code === 'vrm-encours') return { etat: etape && etape.etat === 'fait' ? 'fait' : 'encours', code };
  if (code) return { etat: 'afaire', code };
  return { etat: etape && ETATS_ETAPE.includes(etape.etat) ? etape.etat : 'passu', code: '' };
}
// Le compte capté de chaque site choisi (étape 3) : `listes` = { vinted, leboncoin, vestiaire, ebay }, chacune
// `undefined` (on lit) · `null` (pas su) · tableau de { nom }. Rend { site: { etat, noms } }.
export function comptesCaptes(sites, listes = {}) {
  const out = {};
  for (const s of (Array.isArray(sites) && sites.length ? sites : ['vinted'])) {
    const l = listes ? listes[s] : undefined;
    if (l === undefined) { out[s] = { etat: 'encours', noms: [] }; continue; }
    if (!Array.isArray(l)) { out[s] = { etat: 'passu', noms: [] }; continue; }
    const noms = l.map((c) => String((c && (c.nom || c.login || c.name)) || '').trim()).filter(Boolean);
    out[s] = { etat: l.length ? 'fait' : 'afaire', noms, n: l.length };
  }
  return out;
}

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
