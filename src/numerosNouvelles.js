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

// MODE « MOI » : les articles à DEMANDER. En ligne (la liste ne porte que les
// annonces en ligne : jamais « à confirmer »), lecture complète de leur compte,
// numérotables (après la remise à zéro), sans N° sur leur fiche, et SANS N° écrit
// lisible (`lecture.etat !== 'lu'` — un N° écrit est pris par la numérotation ;
// deux N° écrits, un ancien N° ⇒ « à vérifier », déjà dit ailleurs : pas ici).
export function demandesNumero({ items, fiches, listings, mode, numerotable = () => true, lectureEcrite = () => null } = {}) {
  if (mode !== 'moi') return [];
  const out = [], vus = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || it.id == null) continue;
    const id = String(it.id); if (vus.has(id)) continue; vus.add(id);
    const f = fiches && fiches[id];
    if (f && String(f.numero == null ? '' : f.numero).trim()) continue;
    if (!lectureCompleteDe(it, listings)) continue;
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
