// ── src/ouvrirPanneau.js — le lien qui ouvre LE PANNEAU de l'extension sur le site ──────────
// (20 nov., décision de Julien : « toute action doit être faite dans l'extension, on ne doit plus pouvoir
// faire d'action dans l'app »). L'app ne fait plus aucun geste sur Vinted, Leboncoin ou Vestiaire : chaque
// ancien bouton ouvre le site avec le panneau de l'extension sur la bonne page et la bonne sélection.
//
//   lienPanneau({ site, page, ids, action })
//     → https://www.vinted.fr/?vrm=panneau&page=…&ids=…&action=…
//
// ⚠️ Signature et format d'URL PARTAGÉS avec le chantier du panneau (`claude/panneau-vintex`, qui pose le même
//    module et lit ces paramètres dans l'extension) : ne rien renommer ici sans lui. `ids` est une liste
//    (séparée par des virgules dans l'URL) ; un paramètre vide n'est pas écrit.
// Au téléphone sans extension (iPhone Safari) le lien ouvre le site avec la même URL (Orion porte
// l'extension) : rien ne se passe en douce, le panneau s'ouvre là où l'extension tourne.

export const DOMAINES_PANNEAU = {
  vinted: 'https://www.vinted.fr/',
  leboncoin: 'https://www.leboncoin.fr/',
  vestiaire: 'https://fr.vestiairecollective.com/',
};

// (24 nov., lot agir-si-connecte) LA PORTE, aussi ici (défense en profondeur derrière les boutons) : le panneau ne
// s'ouvre que si l'extension de CE navigateur a le compte visé dans son onglet (src/agir/peutAgir.js, voie 'panneau').
// `compte` absent = '*' (« le compte de l'onglet ») : le panneau agit au nom de SON onglet et sa garde refuse le reste.
// Refusé ⇒ rien ne s'ouvre, l'événement `vrm:agir-refus` porte la raison (l'app la dit).
import { agirMaintenant } from './agir/porte.js';
export function gesteDuPanneau(page, action) {
  const p = String(page || ''), a = String(action || '');
  if (p === 'prix') return a === 'baisser' ? 'baisser' : 'prix';
  if (p === 'republier') return 'republier';
  if (p === 'publier') return a === 'creer' || a === 'deposer' ? 'creer' : 'publier';
  if (p === 'annonces') return a === 'supprimer' ? 'supprimer' : 'pause';
  if (p === 'messages') return 'repondre';
  if (p === 'offres') return 'offre';
  if (p === 'favoris') return 'favoris';
  if (p === 'vacances') return 'vacances';
  return 'automatisations';
}

const propre = (v) => String(v == null ? '' : v).trim().slice(0, 120);

// (24 nov., « Mettre aussi sur… », ext. 5.451) `sites` et `pct` (facultatifs, ajoutés sans rien renommer) : pour
// `action=aussi`, les sites PRÉ-COCHÉS de « Publier aussi sur… » (leboncoin, vestiaire) et le « +N % » de chacun
// (0, 5, 10, 15, 20 — les choix de la voie). Une extension plus ancienne les ignore (elle pré-sélectionne l'annonce).
const SITES_AUSSI_LIEN = ['leboncoin', 'vestiaire'];
const PCT_LIEN = [0, 5, 10, 15, 20];
export function lienPanneau({ site = 'vinted', page = '', ids = [], action = '', sites = [], pct = null } = {}) {
  const base = DOMAINES_PANNEAU[site] || DOMAINES_PANNEAU.vinted;
  const liste = (Array.isArray(ids) ? ids : ids == null ? [] : [ids]).map(propre).filter(Boolean).slice(0, 200);
  const q = ['vrm=panneau'];
  if (propre(page)) q.push('page=' + encodeURIComponent(propre(page)));
  if (liste.length) q.push('ids=' + liste.map(encodeURIComponent).join(','));
  if (propre(action)) q.push('action=' + encodeURIComponent(propre(action)));
  const ss = (Array.isArray(sites) ? sites : []).filter((x) => SITES_AUSSI_LIEN.includes(x));
  if (ss.length) q.push('sites=' + [...new Set(ss)].join(','));
  if (pct && typeof pct === 'object') {
    const pp = ss.filter((x) => PCT_LIEN.includes(Number(pct[x])) && Number(pct[x]) > 0).map((x) => x + ':' + Number(pct[x]));
    if (pp.length) q.push('pct=' + pp.join(','));
  }
  return base + '?' + q.join('&');
}

// Ouvre le lien (SON toucher) : un nouvel onglet ; si le navigateur le refuse (téléphone), la même page.
export function ouvrirPanneau(opts) {
  const url = lienPanneau(opts);
  if (typeof window === 'undefined') return url;
  const o = opts || {};
  const v = agirMaintenant(o.site || 'vinted', o.compte == null || o.compte === '' ? '*' : o.compte, gesteDuPanneau(o.page, o.action), 'panneau');
  if (!v.ok) { try { window.dispatchEvent(new CustomEvent('vrm:agir-refus', { detail: v })); } catch (_) {} return null; }
  // (25 nov., e2e-extension-vert) Une extension d'avant le lien du panneau : rien ne s'ouvre, la phrase dit de la mettre à jour.
  const retard = panneauEnRetard();
  if (retard) { try { window.dispatchEvent(new CustomEvent('vrm:toast', { detail: { texte: retard, ton: 'err' } })); } catch (_) {} return null; }
  let w = null;
  try { w = window.open(url, '_blank'); } catch (_) { w = null; }
  if (w) { try { w.opener = null; } catch (_) {} return url; }
  // Onglet refusé : la même page, mais SEULEMENT sur son toucher (jamais l'app quittée au milieu d'un travail).
  let actif = true;
  try { const ua = typeof navigator !== 'undefined' ? navigator.userActivation : null; if (ua && typeof ua.isActive === 'boolean') actif = ua.isActive; } catch (_) {}
  if (actif) { try { window.location.assign(url); } catch (_) {} }
  return url;
}

// L'app dit au module si l'extension répond dans CE navigateur (le pont). « Pas su » ⇒ non : la phrase
// « s'ouvre sur Vinted avec l'extension » est dite.
let __extIci = () => false;
export function poserExtensionIci(fn) { if (typeof fn === 'function') __extIci = fn; }
export function extensionIci() { try { return !!__extIci(); } catch (_) { return false; } }

// (25 nov., e2e-extension-vert) Une extension QUI RÉPOND dans ce navigateur mais d'avant le panneau ouvert par un lien
// (< 5.410.0, `panneaucomplet` d'EXT_CAPACITES) ignorerait le lien : vinted.fr s'ouvrirait et rien ne s'y passerait — une
// promesse faite à une extension qui ne sait pas la tenir (CLAUDE.md §8). L'app pose ici la phrase à dire (« mets-la à
// jour »), '' sinon. Pas d'extension ici (iPhone Safari, Orion) n'est PAS un retard : le lien s'ouvre comme avant.
let __panneauRetard = () => '';
export function poserPanneauRetard(fn) { if (typeof fn === 'function') __panneauRetard = fn; }
export function panneauEnRetard() { try { const p = __panneauRetard(); return typeof p === 'string' ? p : ''; } catch (_) { return ''; } }
