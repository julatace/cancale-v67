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
  const enregistrements = [], manques = []; let pret = sourcePrincipalePresente();
  const vus = new Set();
  for (const fn of SOURCES.values()) {
    let r = null; try { r = fn(); } catch (_) { r = null; }
    if (!r) continue;
    if (!r.pret) pret = false;
    for (const m of (Array.isArray(r.manques) ? r.manques : [])) if (m && !manques.includes(m)) manques.push(m);
    for (const e of (Array.isArray(r.enregistrements) ? r.enregistrements : [])) {
      if (!e || e.cle == null) continue;
      const k = `${e.sorte || ''}:${e.cle}`; if (vus.has(k)) continue; vus.add(k); enregistrements.push(e);
    }
  }
  return { pret, enregistrements, manques };
}

// L'ouverture : le disque « + » ⇒ Scanner, et les boutons de Ventes et d'Achats.
export const EV_RETROUVER = 'vrm:retrouver';
export function ouvrirRetrouver(depuis = '') { try { window.dispatchEvent(new CustomEvent(EV_RETROUVER, { detail: { depuis } })); } catch (_) {} }
