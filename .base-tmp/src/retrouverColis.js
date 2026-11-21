// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR RETROUVER — LES SOURCES ET L'OUVERTURE (15 nov.)
//  Module léger (dans le JS de l'app) : le scanner lui-même (src/ScannerRetrouver.jsx,
//  la caméra, ZXing) se charge à la demande.
//
//  Les écrans qui ONT les données s'enregistrent : Ventes / Achats (`Comptabilite
//  only="bordereaux"` : ventes et bordereaux Vinted, achats et colis à retirer, retours,
//  Vestiaire), la coque (Leboncoin). `fn()` ⇒ { pret, enregistrements, manques } ; chaque
//  enregistrement : { sorte, site, cle, suivis: [n°…], titre, num, photo, taille, compte,
//  etat, aFaire, detail, code, lieu, lien }. Le scanner les lit AU MOMENT du scan.
//  ⚠️ Les n° de suivi d'un enregistrement sont ceux que VRM a LUS (bordereau, e-mail du
//  transporteur, suivi de l'extension, lien de suivi) — jamais un titre (§5).
// ════════════════════════════════════════════════════════════════════════════
const SOURCES = new Map();
export function enregistrerSourceColis(nom, fn) {
  if (!nom || typeof fn !== 'function') return () => {};
  SOURCES.set(nom, fn);
  return () => { if (SOURCES.get(nom) === fn) SOURCES.delete(nom); };
}
// La source principale (ventes, achats, retours) vient d'un écran Ventes / Achats monté.
export const sourcePrincipalePresente = () => [...SOURCES.keys()].some((k) => k.startsWith('comptabilite'));
// Toutes les sources, un enregistrement (sorte + clé) une fois. `pret` : la source principale est là
// ET chaque source a fini de lire ; sinon le scanner attend (« pas lu » n'est jamais « rien »).
export function lireSourcesColis() {
  const enregistrements = [], manques = [], chercheurs = []; let pret = sourcePrincipalePresente();
  const vus = new Set();
  for (const fn of SOURCES.values()) {
    let r = null; try { r = fn(); } catch (_) { r = null; }
    if (!r) continue;
    if (!r.pret) pret = false;
    if (typeof r.chercher === 'function') chercheurs.push(r.chercher);
    for (const m of (Array.isArray(r.manques) ? r.manques : [])) if (m && !manques.includes(m)) manques.push(m);
    for (const e of (Array.isArray(r.enregistrements) ? r.enregistrements : [])) {
      if (!e || e.cle == null) continue;
      const k = `${e.sorte || ''}:${e.cle}`; if (vus.has(k)) continue; vus.add(k); enregistrements.push(e);
    }
  }
  return { pret, enregistrements, manques, chercheurs };
}
// (17 nov., lot scan-bordereau-vente) Un code lu qui n'est pas un n° de suivi connu : chaque source qui sait
// chercher dans ses étiquettes (`chercher(code)` ⇒ { etat, enregistrements, pasLus }) le cherche ; les trouvés
// sont réunis (sorte + clé une fois). Rend { etat: 'un' | 'plusieurs' | 'aucun' | 'pasSu', trouves }.
export async function chercherCodeSources(code, chercheurs) {
  const vus = new Map(); let pasSu = false;
  for (const f of (Array.isArray(chercheurs) ? chercheurs : [])) {
    let r = null; try { r = await f(code); } catch (_) { r = null; }
    if (!r) { pasSu = true; continue; }
    if (r.etat === 'pasSu') pasSu = true;
    for (const e of (Array.isArray(r.enregistrements) ? r.enregistrements : [])) if (e && e.cle != null) vus.set(`${e.sorte || ''}:${e.cle}`, e);
  }
  const trouves = [...vus.values()];
  if (trouves.length === 1) return { etat: 'un', trouves };
  if (trouves.length > 1) return { etat: 'plusieurs', trouves };
  return { etat: pasSu ? 'pasSu' : 'aucun', trouves: [] };
}

// L'ouverture : le disque « + » ⇒ Scanner, et les boutons de Ventes et d'Achats.
// (16 nov., lot scan-achat) `code` : un code DÉJÀ lu (la douchette) — le scanner s'ouvre sur son résultat.
export const EV_RETROUVER = 'vrm:retrouver';
// (20 nov., lot arrivee-scan) `mode` 'arrivee' : le scanner de l'arrivée d'un colis (achats seulement ⇒ l'écran d'arrivée).
export function ouvrirRetrouver(depuis = '', code = '', mode = '') { try { window.dispatchEvent(new CustomEvent(EV_RETROUVER, { detail: { depuis, code: String(code || ''), mode: mode === 'arrivee' ? 'arrivee' : '' } })); } catch (_) {} }
export const ouvrirScanArrivee = (depuis = '') => ouvrirRetrouver(depuis, '', 'arrivee');
// Un code lu par la douchette PENDANT que le scanner est ouvert : il le résout comme un code tapé.
export const EV_RETROUVER_CODE = 'vrm:retrouver-code';
export const scannerRetrouverOuvert = () => { try { return document.documentElement.hasAttribute('data-scan-retrouver'); } catch (_) { return false; } };
// (16 nov., lot scan-achat) « Colis inconnu · Relier à un achat » : le choix de l'achat (la feuille de Achats → À
// retirer, src/relierColis.js) s'ouvre sur CE n°. SON clic choisit l'achat ; le n° devient l'identité de cet achat.
// Le premier écran qui sait relier prend la demande (`prendre`) : une seule feuille, jamais deux.
export const EV_RELIER_COLIS = 'vrm:relier-colis';
export function demanderRelierColis({ suivi, transporteur = '', nom = '' } = {}) {
  const d = { suivi: String(suivi || ''), transporteur: String(transporteur || ''), nom: String(nom || ''), pris: false };
  if (!d.suivi) return false;
  try { window.dispatchEvent(new CustomEvent(EV_RELIER_COLIS, { detail: d })); } catch (_) {}
  return d.pris;
}
