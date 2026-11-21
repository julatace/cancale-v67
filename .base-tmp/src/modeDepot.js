// ════════════════════════════════════════════════════════════════════════════
//  MODE « DÉPÔT » AU POINT RELAIS (10 nov., lots AU et AY, validés par Julien)
//
//  ⚠️ CE MODULE NE DÉCIDE RIEN QUE L'APP N'AIT DÉJÀ DÉCIDÉ (§11) :
//   · EN LIGNE, la liste et son ORDRE sont ceux de Colis → « À envoyer »
//     (`colisPreparer()` = `colisAEnvoyerRanges()`, règle `aExpedier`) — les
//     mêmes colis que la liste et que « Préparer mes colis » ;
//   · HORS LIGNE, la liste est celle de la photo de Ma journée gardée sur CET
//     appareil pour CE compte VRM (src/journeeHorsLigne.js, `vrm_hl_photo_{uid}`),
//     datée : « vue à 14:02 », jamais présentée comme fraîche ;
//   · un scan trouve un colis par l'égalité EXACTE de son n° de suivi
//     (`trouverParScan`, src/scanColis.js, §5) — jamais un titre ; un bordereau
//     qui n'est pas dans la liste n'écrit RIEN ;
//   · les écritures sont celles de toujours, passées par l'écran : en ligne
//     `deposeScan` (« Colis fait », annulable 5 s) ; hors ligne le « Déposé » de
//     Ma journée hors ligne (`vinted_ship_done[tx]`, clé = n° de transaction :
//     rejouer ne double rien), gardé dans la file d'envoi (src/fileEnvoi.js)
//     jusqu'à ce que le nuage l'ACCEPTE.
//  Module PUR : l'écran (src/ModeDepot.jsx) et le banc `mode-depot.cjs` lisent
//  les mêmes fonctions.
// ════════════════════════════════════════════════════════════════════════════
import { trouverParScan, normaliserN } from './scanColis.js';

// L'état d'un colis dans le mode : '' (à déposer) · 'attente' (annulable, ou
// hors ligne : en file, part au retour du réseau) · 'fait' (noté déposé).
export const estDepose = (etat) => etat === 'attente' || etat === 'fait';

// Les colis qu'on peut cocher (eBay : l'étiquette et le dépôt se suivent dans eBay, §2.8).
export const comptable = (c) => !!(c && c.peutFaire && !c.sorti);

// « 3 sur 5 déposés » : sur les colis qu'on peut cocher.
export function progressionDepot(colis, etatDe) {
  const L = (Array.isArray(colis) ? colis : []).filter(comptable);
  const deposes = L.filter((c) => estDepose(etatDe(c))).length;
  return { total: L.length, deposes, tout: L.length > 0 && deposes === L.length };
}

// Combien de dépôts attendent le réseau (hors ligne : « 2 dépôts à envoyer »).
export const enFileDepot = (colis, etatDe) => (Array.isArray(colis) ? colis : []).filter((c) => etatDe(c) === 'attente').length;

// Un groupe par transporteur, dans l'ordre de leur premier colis (l'ordre de la
// liste est gardé dans chaque groupe). Chaque colis UNE fois, par sa clé.
export function groupesDepot(colis) {
  const out = []; const par = new Map(); const vus = new Set();
  for (const c of (Array.isArray(colis) ? colis : [])) {
    if (!c || !c.cle || vus.has(c.cle)) continue; vus.add(c.cle);
    const k = c.trCle || (c.trNom ? 'nom:' + c.trNom : '');
    if (!par.has(k)) { const g = { cle: k || 'inconnu', trCle: c.trCle || '', nom: c.trNom || '', colis: [] }; par.set(k, g); out.push(g); }
    par.get(k).colis.push(c);
  }
  return out;
}

// Le scan d'un bordereau, DANS la liste du mode seulement.
//  · { etat: 'trouve', colis }  un seul colis à déposer porte ce n° ;
//  · { etat: 'deja', colis }    il est déjà coché ;
//  · { etat: 'ambigu', colis }  plusieurs colis le portent ⇒ rien ;
//  · { etat: 'hors-liste' }     aucun colis de la liste ⇒ rien n'est écrit.
export function trouverDepot(brut, colis, etatDe) {
  const L = (Array.isArray(colis) ? colis : []).filter(comptable).map((c) => ({ cle: c.cle, suivis: Array.isArray(c.suivis) ? c.suivis : [], deja: estDepose(etatDe(c)), c }));
  const r = trouverParScan(brut, L);
  if (r.etat === 'trouve' || r.etat === 'deja') return { etat: r.etat, colis: r.colis.c };
  if (r.etat === 'ambigu') return { etat: 'ambigu', colis: r.colis.map((x) => x.c) };
  if (r.etat === 'vide') return { etat: 'vide' };
  return { etat: 'hors-liste' };
}

// HORS LIGNE : les colis à déposer de la photo gardée (src/journeeHorsLigne.js).
// Seul ce que la photo porte (titre, N°, transporteur, n° de suivi, n° de
// transaction) ; un colis sans n° de transaction ne se coche pas sans réseau
// (jamais deviné par son titre, §5) ; eBay : suivi dans eBay.
export function colisDepotHorsLigne(photo) {
  const L = photo && Array.isArray(photo.envoyer) ? photo.envoyer : [];
  return L.map((e, i) => {
    const ebay = e && e.plateforme === 'ebay';
    const tx = e && /^\d{1,20}$/.test(String(e.tx || '')) ? String(e.tx) : '';
    const suivi = normaliserN(e && e.suivi);
    return {
      cle: tx ? 'v:' + tx : 'hl:' + i, tx, site: ebay ? 'ebay' : 'vinted', num: String((e && e.numero) || ''), titre: String((e && e.titre) || 'Colis'),
      trCle: String((e && e.tr) || ''), trNom: String((e && e.trNom) || ''), suivis: suivi ? [suivi] : [], photo: null,
      peutFaire: !ebay && !!tx, raison: ebay ? 'ebay' : tx ? '' : 'sans-identite', e,
    };
  });
}

// « vue à 14:02 » (aujourd'hui) · « vue le 9 nov. à 14:02 » (un autre jour).
export function heureVue(at, maintenant = Date.now(), mot = 'vue') {
  const t = Number(at); if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t), m = new Date(maintenant);
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const memeJour = d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth() && d.getDate() === m.getDate();
  return memeJour ? `${mot} à ${hh}` : `${mot} le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${hh}`;
}
