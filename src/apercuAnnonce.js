// ── L'APERÇU DE L'ANNONCE TELLE QUE L'ACHETEUR LA VERRA (14 nov., lot 128) ──────
// Julien : « Aperçu de l'annonce telle que l'acheteur la verra, avant “Créer sur Vinted”. »
// Rendu LOCAL avec SES champs : le titre et la description que « Créer sur Vinted »
// enverra (`texteAnnonceVinted`, src/annonceVinted.js — la même règle, appelée par
// l'écran), ses photos, son prix, sa marque, sa taille, son état. AUCUNE requête
// Vinted, aucune image chargée ailleurs que depuis ce qu'il a déjà dans la page.
// Pur (aucun import) : src/ApercuAnnonce.jsx le dessine, l'audit l'exécute.
// Ce qui n'est pas su n'est pas inventé : pas de prix ⇒ « — » ; pas de photo ⇒ la
// case vide (Vinted refusera de publier : l'écran de création le dit déjà).
// Les frais de protection acheteur s'ajoutent chez Vinted : on ne les calcule pas
// (le barème est le leur), on le DIT en une ligne.
const net = (v, n = 2000) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, n);
export const prixAffiche = (p) => { const n = Number(String(p == null ? '' : (typeof p === 'object' ? p.amount : p)).replace(',', '.')); return Number.isFinite(n) && n > 0 ? `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',')} €` : '—'; };

// `fiche` : { titre, marque, taille, etat, prix, couleur } · `texte` : le résultat de
// `texteAnnonceVinted(fiche, reglages)` · `photos` : les adresses choisies (≤ 20).
export function apercuAnnonce(fiche = {}, texte = null, photos = []) {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const ok = !!(texte && texte.ok);
  const ph = (Array.isArray(photos) ? photos : []).filter((u) => typeof u === 'string' && /^(data:image\/|blob:|https:\/\/)/.test(u)).slice(0, 20);
  const details = [['marque', net(f.marque, 60)], ['taille', net(f.taille, 30)], ['etat', net(f.etat, 40)], ['couleur', net(f.couleur, 30)]].filter(([, v]) => v);
  return {
    titre: ok ? net(texte.titre, 100) : net(f.titre, 100),
    description: ok ? net(texte.description) : net(f.description),
    prix: prixAffiche(f.prix),
    photos: ph,
    details,
    pret: ok && ph.length > 0,
  };
}
