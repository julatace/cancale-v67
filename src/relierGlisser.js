// ════════════════════════════════════════════════════════════════════════════
//  RELIER EN GLISSANT — LES RÈGLES (16 nov., lot relier-glisser)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Quand je veux relier un achat à une annonce ou à une vente, faire comme quand on
// reste appuyé sur une app sur iPhone : ça vibre, et après tu places [l'achat] sur la vente ou
// l'annonce. Sinon une liste, ça peut être aussi simple. »
//
// L'écran (src/RelierGlisser.jsx) : en haut (téléphone) ou à gauche (ordinateur) ses ACHATS
// LIBRES, les « très probables » d'abord ; en bas / à droite les ANNONCES et VENTES sans achat
// relié. Appui long (~400 ms) sur un achat : il se soulève, suit le doigt ; lâché sur une cible ⇒
// confirmation en une ligne ⇒ relié par l'IDENTITÉ de la ligne (n° de transaction de l'achat,
// identifiant de l'annonce / n° de la vente), annulable 5 s. Lâché ailleurs ⇒ rien.
//
// Règles (§5) : rien n'est relié sans SON geste (le glisser PUIS « Oui ») ; seuls les achats
// LIBRES sont proposés (`tousAchatsLibres` : pas déjà reliés — un lot jusqu'à son nombre —, ni
// annulés, ni en retour / litige / remboursés, src/achatsHorsRelier.js) ; une vente ou annonce déjà
// reliée n'est pas une cible (les listes « sans achat relié » seulement).
//
// VIBRATION : `navigator.vibrate` n'existe PAS dans Safari iOS (ni en web app installée : WebKit
// ne l'a jamais livrée : table de compatibilité de MDN, « Safari on iOS : non »). Elle n'est
// appelée QUE si elle existe (Android / Chrome) ; ailleurs le « soulèvement » (agrandissement,
// ombre, petite oscillation) est le seul retour. Aucun texte ne promet une vibration.
//
// Module PUR : exécuté par scripts/audit-relier-glisser.cjs.
import { tousAchatsLibres } from './suggestionsAchat.js';

export const DELAI_APPUI_MS = 400;     // appui long (iPhone : ~0,5 s pour soulever une icône)
export const SEUIL_DEFILEMENT_PX = 10; // un doigt qui bouge plus avant le délai = un défilement
export const SEUIL_SOURIS_PX = 6;      // à la souris, un glisser franc démarre sans attendre
export const BORD_DEFILEMENT_PX = 56;  // la zone près du bord qui fait défiler la liste cible
export const VITESSE_MAX_PX = 18;      // px par image au bord même

// ── L'appui : une petite machine d'états ────────────────────────────────────
// etat : null · { phase: 'appui', x0, y0, t0, souris } · { phase: 'leve', … } · { phase: 'defile' }
// evt  : { type: 'bouge', x, y, t } · { type: 'temps', t }
// Rend l'état suivant. Un doigt qui bouge AVANT le délai défile (jamais un glisser) ; la souris
// peut glisser tout de suite (aucun défilement au doigt à protéger).
export function appuiSuivant(etat, evt) {
  if (!etat || !evt) return etat;
  if (etat.phase === 'appui') {
    if (evt.type === 'temps') return evt.t - etat.t0 >= DELAI_APPUI_MS ? { ...etat, phase: 'leve' } : etat;
    if (evt.type === 'bouge') {
      const d = Math.hypot(evt.x - etat.x0, evt.y - etat.y0);
      if (etat.souris) return d >= SEUIL_SOURIS_PX ? { ...etat, phase: 'leve' } : etat;
      if (d > SEUIL_DEFILEMENT_PX) return evt.t - etat.t0 >= DELAI_APPUI_MS ? { ...etat, phase: 'leve' } : { phase: 'defile' };
      return evt.t - etat.t0 >= DELAI_APPUI_MS ? { ...etat, phase: 'leve' } : etat;
    }
  }
  return etat;
}

// ── Le défilement automatique près du bord de la liste cible ────────────────
// y : la position du doigt ; haut / bas : les bords de la liste (px de la fenêtre).
// Rend px par image : négatif vers le haut, positif vers le bas, 0 au milieu (ou hors liste).
export function vitesseBord(y, haut, bas) {
  if (!Number.isFinite(y) || !Number.isFinite(haut) || !Number.isFinite(bas) || bas - haut < 2 * BORD_DEFILEMENT_PX) return 0;
  if (y < haut - BORD_DEFILEMENT_PX || y > bas + BORD_DEFILEMENT_PX) return 0;
  if (y < haut + BORD_DEFILEMENT_PX) return -Math.round(VITESSE_MAX_PX * Math.min(1, (haut + BORD_DEFILEMENT_PX - y) / BORD_DEFILEMENT_PX));
  if (y > bas - BORD_DEFILEMENT_PX) return Math.round(VITESSE_MAX_PX * Math.min(1, (y - (bas - BORD_DEFILEMENT_PX)) / BORD_DEFILEMENT_PX));
  return 0;
}

// ── Les deux listes ─────────────────────────────────────────────────────────
// achats      : ses achats lus (`undefined` en cours) ; liens : `liensParAchat`
// tresProbables : { [tx]: [{ key, niveau }] } (`liaison.parAchat`, src/liaisonAchat.js) — marquées en tête
// cibles      : [{ key, genre: 'annonce' | 'vente', … }] (déjà « sans achat relié »)
// Rend { achats: [{ a, tx, propose: key | '' }], cibles } (`achats` undefined pendant la lecture).
export function listesGlisser({ achats, liens, tresProbables = null, cibles = [] } = {}) {
  const cs = (Array.isArray(cibles) ? cibles : []).filter((c) => c && c.key);
  const cles = new Set(cs.map((c) => String(c.key)));
  if (!Array.isArray(achats)) return { achats: achats === null ? null : undefined, cibles: cs };
  const libres = tousAchatsLibres({ achats, liens });
  const out = libres.map((a) => {
    const tx = String(a.transaction_id);
    const p = tresProbables && Array.isArray(tresProbables[tx]) ? tresProbables[tx].find((x) => x && x.niveau === 'tres-probable' && cles.has(String(x.key))) : null;
    return { a, tx, propose: p ? String(p.key) : '' };
  });
  // Les « très probables » d'abord (l'ordre des dates gardé à l'intérieur de chaque groupe).
  out.sort((x, y) => (x.propose ? 0 : 1) - (y.propose ? 0 : 1));
  return { achats: out, cibles: cs };
}

// ── La phrase de confirmation (une ligne) ───────────────────────────────────
// « Relier N°215 à cet achat de 24,63 € ? » ; sans N° : le titre de la cible ; lot : le prix sera demandé.
// `t` : la fonction de traduction ; `montant(n)` : l'euro écrit.
export function phraseConfirmation({ cible, prix = null, lot = false } = {}, t, montant) {
  const qui = cible && cible.num ? `N°${cible.num}` : `« ${String((cible && cible.titre) || '').slice(0, 40)} »`;
  if (lot) return t('glisser.confirmerLot', { qui });
  if (prix != null && Number.isFinite(Number(prix))) return t('glisser.confirmer', { qui, prix: montant(Number(prix)) });
  return t('glisser.confirmerSansPrix', { qui });
}

// ── Les opérations d'une liaison (un geste annulable : src/gesteAnnulable.js) ──
// cible : { genre, id (annonce), tx (vente), idf (annonce vendue) } ; w : l'écriture de « Relier »
// ({ buyPrice, buyFromId, buyFrom }) ; fiches / ventes / prixParNum : les valeurs COURANTES.
// L'annonce (ou l'annonce vendue) porte le lien sur SA fiche ; une vente sans fiche, sur la vente.
// Rend [] si rien ne peut être écrit (cible sans identité).
export function opsRelierGlisse({ cible, w, fiches = {}, ventes = {}, prixParNum = {} } = {}) {
  if (!cible || !w || w.buyFromId == null || String(w.buyFromId) === '') return [];
  const ops = [];
  const idFiche = cible.genre === 'annonce' ? cible.id : cible.idf;
  const f = idFiche != null && String(idFiche) !== '' ? fiches[String(idFiche)] : null;
  const champs = { buyPrice: w.buyPrice, buyFromId: w.buyFromId, buyFrom: w.buyFrom };
  if (f && typeof f === 'object') {
    ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: String(idFiche), apres: champs, avant: { buyPrice: f.buyPrice, buyFromId: f.buyFromId, buyFrom: f.buyFrom } });
    const n = String(f.numero == null ? '' : f.numero).trim();
    if (n && w.buyPrice != null && String(w.buyPrice).trim() !== '') ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: n, apres: String(w.buyPrice), avant: prixParNum[n] });
    return ops;
  }
  if (cible.genre === 'vente' && cible.tx != null && String(cible.tx) !== '') {
    const tx = String(cible.tx), cur = ventes[tx];
    const apres = { ...(cur && typeof cur === 'object' ? cur : {}), ...champs };
    for (const k of Object.keys(apres)) if (apres[k] == null || String(apres[k]).trim() === '') delete apres[k];
    ops.push({ k: 'vinted_sale_overrides', type: 'cle', id: tx, apres, avant: cur && typeof cur === 'object' ? cur : undefined });
  }
  return ops;
}

// La vibration : seulement là où elle existe. Rend true si elle a été demandée.
export function vibrerSiPossible(nav = (typeof navigator !== 'undefined' ? navigator : null), ms = 12) {
  try { if (nav && typeof nav.vibrate === 'function') return nav.vibrate(ms) !== false; } catch (_) {}
  return false;
}
