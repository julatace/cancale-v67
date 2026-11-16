// ── LES NOUVELLES ANNONCES SANS N° (15 nov.) ─────────────────────────────────
// Julien, 15 novembre : « quand je publie [un article] sur Vinted directement
// dans l'application [du téléphone] sans l'extension, je veux que quand je me
// reconnecte avec l'extension, cela attribue des numéros et que cela me prévienne
// que ça le fait — quand j'ai accepté que ce soit VRM qui fasse la numérotation ;
// sinon c'est à moi de le faire, mais c'est l'application qui me demande à chaque
// fois quel numéro attribuer à chaque [article] que je poste. »
// Précision du même jour : « article » — chaussures, sacs, vêtements, manuels :
// AUCUNE règle de N° ne dépend de la catégorie ; seuls les MOTS suivent le profil
// du vendeur (« paire » pour Sneakers, « article » sinon, src/profilVendeur.js).
//
// QUI NUMÉROTE ? Le réglage synchronisé `vrm_numero_ecrit` (src/numeroEcrit.js,
// jamais un drapeau du navigateur) : éteint ⇒ « VRM numérote », allumé ⇒ « je
// numérote moi-même ». Rien d'autre ne décide.
//
// MODE « VRM NUMÉROTE » — la numérotation des annonces (App.jsx, bloc
// <numerotation-passage>) donne le prochain N° libre (`prochainLibre` : après le
// plus haut, jamais un trou, jamais un ancien, pool append-only) à une annonce EN
// LIGNE sans N° — seulement quand :
//   · aucune IDENTITÉ ne lui donne déjà le sien (vente de la même annonce, N° écrit,
//     N° réservé à côté de « Publier » par son id, même photo, annonce republiée
//     qu'elle remplace — src/repriseNumero.js) : ces chemins passent AVANT ;
//   · la lecture qui la montre est la lecture COMPLÈTE la plus récente de son compte
//     (règle <enligne-regle> : `complets[uid]`, `lectureDressingComplete`, moins de
//     24 h — les « à confirmer » ne sont jamais dans la liste). Une lecture
//     PARTIELLE, un compte qui n'a pas répondu ⇒ AUCUN N° neuf (`numeroNeufPermis`) ;
//   · en ligne (hors ligne : jamais un N° neuf), et pas pendant la retenue
//     « j'ai déjà mes N° sur mes cartons » (src/accueilReste/cartonsNumeros.js).
// Le N° neuf porte `nouveau: { at }` sur SA fiche (synchronisée, fusionnée champ
// par champ, src/fusionNuage.js) : l'appareil qui l'a donné le DIT (notification
// « 3 nouveaux articles numérotés · N°216, 217, 218 », l'extension sur sa carte),
// Ma journée le garde dans « Nouveaux N° à écrire » jusqu'à « C'est écrit »
// (`nouveau.ecrit`). Deux appareils qui donnent le même N° à deux annonces
// différentes : la fusion du nuage REFUSE (`conflit`), rien n'est écrit (§5).
//
// MODE « JE NUMÉROTE MOI-MÊME » — VRM ne donne AUCUN N° ; il lit celui écrit dans
// l'annonce (src/numeroEcrit.js). Une annonce en ligne (lecture complète) sans N°
// et sans N° écrit lisible est DEMANDÉE (`demandesNumero`) : Ma journée en tête,
// une feuille par article, le champ pré-rempli avec la proposition (`prochainLibre`
// sur une COPIE des N° pris : rien n'est réservé), SA validation écrit (le chemin
// de la carte, `poserNumero` : doublon refusé, ancien N° refusé, N° déjà servi
// demandé).
//
// LES DEUX MODES — un article publié DEPUIS VRM (Publier, « Créer sur Vinted »)
// garde le N° donné à la création : l'extension lie la réservation à l'id rendu,
// la numérotation la reprend PAR CET ID avant tout N° neuf.
//
// JS pur, sans React ni navigateur : `scripts/audit-numeros-nouvelles.cjs`
// l'EXÉCUTE, avec le bloc <numerotation-passage> d'App.jsx.
import { lireReglageNumeroEcrit } from './numeroEcrit.js';

export const MODES_NUMEROTATION = ['vrm', 'moi'];
// Le mode, lu dans le réglage synchronisé (`vrm_numero_ecrit`).
export const modeNumerotation = (reglage) => (lireReglageNumeroEcrit(reglage).actif ? 'moi' : 'vrm');

const uidDe = (it) => String((it && it._acc && it._acc.vinted_user_id != null) ? it._acc.vinted_user_id : '');

// La lecture qui montre cette annonce est-elle la lecture COMPLÈTE de son compte ?
// `listings` : l'état de la liste d'annonces (`complets` : uid ⇒ true quand la
// lecture qui fait foi porte tous les articles que Vinted annonce ; `ko` : comptes
// qui n'ont pas répondu). « Pas su » ⇒ false.
export function lectureCompleteDe(it, listings) {
  const uid = uidDe(it);
  if (!uid || !listings || typeof listings !== 'object') return false;
  if (Array.isArray(listings.ko) && listings.ko.map(String).includes(uid)) return false;
  return !!(listings.complets && listings.complets[uid] === true);
}

// ── LES ANNONCES MASQUÉES PAR VINTED (15 nov., audit de fiabilité #3 et #4) ──
// Mesuré chez Julien : 4 annonces masquées (`is_hidden`, ni fermées ni brouillons)
// SANS fiche, chacune liée par l'extension à un N° réservé (209, 210, 211, 214) ;
// chez un autre vendeur, 5 masquées sans fiche. Cause : la numérotation ne
// parcourait que `listings.items` (les annonces EN LIGNE). Une masquée est
// toujours chez lui (`annoncesPresentes`, §5) : elle reçoit son N° comme une
// annonce en ligne — d'abord ses IDENTITÉS (N° réservé lié à SON identifiant,
// vente de la même annonce, même photo, annonce republiée), sinon un N° neuf
// selon le mode, jamais par titre.
// Une masquée vient du DRESSING (seule lecture qui la voit) : un N° NEUF ne lui
// est donné que si CE dressing est COMPLET (`_vrmMasqueeComplete`, tous les
// articles que Vinted annonce) et de moins de 24 h (`_vrmVueMasqueeLe`) — la
// même fraîcheur que « en ligne » (<enligne-regle>). Une masquée vue dans un
// dressing ancien est peut-être supprimée ou vendue depuis : aucun N° brûlé
// pour elle (elle le reçoit à la prochaine lecture fraîche).
export const MASQUEE_FRAIS_MS = 24 * 3600e3;
const AVANCE_HORLOGE_MS = 5 * 60e3;   // une horloge un peu en avance ne rend pas une lecture « future » invalide
export function lectureMasqueeComplete(it, listings, maintenant = Date.now()) {
  if (!it || it._vrmMasquee !== true || it._vrmMasqueeComplete !== true) return false;
  const uid = uidDe(it);
  if (!uid) return false;
  if (listings && Array.isArray(listings.ko) && listings.ko.map(String).includes(uid)) return false;
  const t = Number(it._vrmVueMasqueeLe), now = Number(maintenant);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(now)) return false;
  const age = now - t;
  return age <= MASQUEE_FRAIS_MS && age >= -AVANCE_HORLOGE_MS;
}
// La lecture qui montre CETTE annonce est-elle complète (en ligne : celle du
// compte ; masquée : son dressing, frais) ?
export const lectureCompleteAnnonce = (it, listings, maintenant = Date.now()) => (it && it._vrmMasquee === true ? lectureMasqueeComplete(it, listings, maintenant) : lectureCompleteDe(it, listings));
// Les annonces que la numérotation parcourt : en ligne, PUIS les masquées encore
// sur l'étagère (`masqueesSurEtagere` : moins celles déclarées parties). Une
// même annonce une fois (une démasquée depuis est déjà « en ligne »).
export function annoncesANumeroter(enLigne, masquees) {
  const out = [], vus = new Set();
  for (const l of [enLigne, masquees]) for (const it of Array.isArray(l) ? l : []) {
    if (!it || it.id == null) continue;
    const k = String(it.id); if (vus.has(k)) continue; vus.add(k); out.push(it);
  }
  return out;
}
// #4 — UNE RÉSERVATION LIÉE DONT LA FICHE PORTE UN AUTRE N° (1 cas chez Julien).
// Rien ne change tout seul (un N° est écrit sur un carton) : la ligne « N° à
// vérifier sur ton carton » le montre, SON choix décide. Pas ici :
//   · une fiche déjà vérifiée (`cartonVerifie`, posé par SON choix) ;
//   · une fiche que la règle des doublons a fait passer du N° réservé à ce N°
//     (`reattribue.de` = la réservation, `reattribue.vers` = la fiche) — déjà dite
//     dans « nouveaux numéros à écrire sur tes cartons », jamais deux fois (§7).
// Rend { fiche, reserve } ou null. `cle` : l'identité d'un N° (`cleNum`).
export function reserveEnDesaccord(id, fiche, parItem, cle = (n) => String(n == null ? '' : n).trim().toUpperCase()) {
  if (id == null || !fiche || typeof fiche !== 'object' || !parItem || typeof parItem !== 'object') return null;
  const r = parItem[String(id)];
  const cf = cle(fiche.numero), cr = cle(r);
  if (!cf || !cr || cf === cr) return null;
  if (fiche.cartonVerifie) return null;
  const ra = fiche.reattribue;
  if (ra && typeof ra === 'object' && cle(ra.de) === cr && cle(ra.vers) === cf) return null;
  return { fiche: String(fiche.numero), reserve: String(r) };
}

// Un N° NEUF peut-il être donné (le dernier recours, après toutes les identités) ?
export function numeroNeufPermis({ mode, complet, horsLigne = false, retenue = false } = {}) {
  return mode === 'vrm' && complet === true && horsLigne !== true && retenue !== true;
}

// La fiche d'un N° neuf : la marque « à écrire » (une fois, à sa naissance).
export const marquerNouveau = (fiche, at = new Date().toISOString()) => ({ ...(fiche || {}), nouveau: { at } });
// Encore à écrire sur son carton ?
export const nouveauAEcrire = (f) => !!(f && f.nouveau && typeof f.nouveau === 'object' && !f.nouveau.ecrit && String(f.numero == null ? '' : f.numero).trim());
// « C'est écrit » : la marque seule change, jamais le N°.
export const marquerEcrit = (fiche, at = new Date().toISOString()) => (fiche && fiche.nouveau && typeof fiche.nouveau === 'object' ? { ...fiche, nouveau: { ...fiche.nouveau, ecrit: at } } : fiche);

const valNum = (n) => { const s = String(n == null ? '' : n).toUpperCase(); const m = /^([A-Z]*)(\d+)$/.exec(s); return m ? [m[1], Number(m[2])] : [s, 0]; };
const triNumero = (a, b) => { const x = valNum(a), y = valNum(b); return x[0] === y[0] ? x[1] - y[1] : x[0].localeCompare(y[0]); };

// La liste « Nouveaux N° à écrire » : les articles PRÉSENTS (en ligne ou masqués,
// `annoncesPresentes`) dont la fiche porte un N° neuf pas encore écrit. Par N°.
export function aEcrireNouveaux(presentes, fiches) {
  const out = [], vus = new Set();
  for (const it of Array.isArray(presentes) ? presentes : []) {
    if (!it || it.id == null) continue;
    const id = String(it.id); if (vus.has(id)) continue; vus.add(id);
    const f = fiches && fiches[id];
    if (!nouveauAEcrire(f)) continue;
    out.push({ id, numero: String(f.numero), titre: String(it.title || f.title || ''), photo: it.photo || f.photo || null, at: f.nouveau.at || null, compte: uidDe(it) || (f.accountId != null ? String(f.accountId) : '') });
  }
  return out.sort((a, b) => triNumero(a.numero, b.numero));
}

// « N°216, 217, 218 » (au plus `max`, puis « +N »). Le préfixe « N° » une fois.
export function listeNumeros(nums, max = 5) {
  const l = (Array.isArray(nums) ? nums : []).map((n) => String(n == null ? '' : n).trim()).filter(Boolean).sort(triNumero);
  if (!l.length) return '';
  const vus = l.slice(0, max).join(', ');
  return `N°${vus}${l.length > max ? ` +${l.length - max}` : ''}`;
}

// MODE « MOI » : les articles à DEMANDER. En ligne ou masqués (jamais « à
// confirmer »), lecture complète de leur compte (masquée : son dressing frais),
// numérotables (après la remise à zéro), sans N° sur leur fiche, et SANS N° écrit
// lisible (`lecture.etat !== 'lu'` — un N° écrit est pris par la numérotation ;
// deux N° écrits, un ancien N° ⇒ « à vérifier », déjà dit ailleurs : pas ici).
export function demandesNumero({ items, fiches, listings, mode, numerotable = () => true, lectureEcrite = () => null, maintenant = Date.now() } = {}) {
  if (mode !== 'moi') return [];
  const out = [], vus = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || it.id == null) continue;
    const id = String(it.id); if (vus.has(id)) continue; vus.add(id);
    const f = fiches && fiches[id];
    if (f && String(f.numero == null ? '' : f.numero).trim()) continue;
    if (!lectureCompleteAnnonce(it, listings, maintenant)) continue;
    if (!numerotable(it)) continue;
    const l = lectureEcrite(it);
    if (l && l.etat && l.etat !== 'rien') continue;
    out.push(it);
  }
  return out;
}

// La proposition du champ (mode « moi ») : le prochain N° libre calculé sur une
// COPIE des N° pris — rien n'est réservé, rien n'est écrit. `deja` : les N°
// proposés aux feuilles précédentes de la même série (deux feuilles, deux N°).
export function propositionNumero({ pris, prisCles, pref = '', prochainLibre, deja = [] } = {}) {
  if (typeof prochainLibre !== 'function') return '';
  const p = new Set(pris || []), k = new Set(prisCles || []);
  for (const d of deja || []) { const s = String(d); if (/^\d+$/.test(s)) p.add(Number(s)); else k.add(s); }
  try { return String(prochainLibre(p, k, pref) || ''); } catch (_) { return ''; }
}
