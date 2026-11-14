// ── « CE QUE VRM A TROUVÉ CHEZ TOI » (14 nov., idée d'accueil 133) ───────────
// Juste après l'import (l'import de ton passé fini, ou le dressing lu une première
// fois), UNE seule liste des choses à régler, avec le geste de chacune :
//   · paires sans N°            — publié par Annonces (`annStats.sansNum`, la base même
//                                 de la grille), via `publierSansNumero` ;
//   · ventes sans date de versement — `vinted_urssaf_mois.aDater.n` (Ventes, `ventesDeclarables`) ;
//   · colis en retard           — `vrm_colis_aposter.enRetard` (Colis : une limite LUE et
//                                 dépassée, jamais une date estimée).
// ⚠️ AUCUN chiffre n'est calculé ici (§5, une règle par notion, un propriétaire) : chaque
// ligne CONSOMME la publication de l'écran qui compte déjà. Trois états par ligne :
// `undefined` pas encore publié · `null` pas su (publication trop vieille) · un nombre.
// Pas su ⇒ « — » et la raison, jamais 0 ; le total dit « au moins » s'il manque une source.
// Montrée à un compte NEUF (≤ 30 jours) seulement, jusqu'à « C'est noté » (rangé par compte,
// `vrm_aides_accueil.trouveVu`) — ou d'elle-même quand tout ce qui est su vaut 0 (« rien à
// régler », dit une fois). JS pur : scripts/audit-accueil-reste.cjs l'exécute.
import { compteNeuf, lireAides } from './aides.js';

export const CLE_PUB_SANS_NUMERO = 'vrm_trouve_sans_numero';
export const FRAIS_MS = 12 * 3600e3;          // la règle des badges de Colis (`publicationColisFraiche`)
export const FRAIS_URSSAF_MS = 3 * 86400e3;   // celle du widget pour le CA déclaré

// La publication d'Annonces : { uid, n, at } (local à l'appareil ET au compte VRM).
export function publierSansNumero(storage, uid, n, maintenant = Date.now()) {
  if (!storage || !uid || !(Number.isInteger(n) && n >= 0)) return false;
  try {
    const avant = JSON.parse(storage.getItem(CLE_PUB_SANS_NUMERO) || 'null');
    if (avant && avant.uid === String(uid) && avant.n === n && maintenant - Number(avant.at) < 3600e3) return false;
    storage.setItem(CLE_PUB_SANS_NUMERO, JSON.stringify({ uid: String(uid), n, at: maintenant }));
    return true;
  } catch (_) { return false; }
}
export function lireSansNumero(storage, uid) {
  try { const v = JSON.parse(storage.getItem(CLE_PUB_SANS_NUMERO) || 'null'); return v && v.uid === String(uid) ? v : null; } catch (_) { return null; }
}

const etat = (p, frais, maintenant) => {
  if (!p || !Number.isFinite(Number(p.at)) || !Number.isInteger(Number(p.n))) return { n: undefined, raison: 'pasCompte' };
  return maintenant - Number(p.at) > frais ? { n: null, raison: 'ancien' } : { n: Number(p.n), raison: '' };
};

// Les trois lignes, dans l'ordre de ce qui coûte : le colis d'abord, puis l'argent, puis le N°.
// `cartons` : la question des N° (src/accueilReste/cartonsNumeros.js) est posée ⇒ le geste
// des paires sans N° est d'y répondre (et pas d'aller numéroter).
export function lignesTrouve({ sansNumero = null, colisAposter = null, urssafMois = null, cartons = false, maintenant = Date.now() } = {}) {
  const colis = etat(colisAposter && typeof colisAposter === 'object' ? { n: colisAposter.enRetard, at: colisAposter.at } : null, FRAIS_MS, maintenant);
  const ad = urssafMois && urssafMois.aDater;
  const dater = etat(ad && typeof ad === 'object' ? { n: ad.n, at: urssafMois.at } : null, FRAIS_URSSAF_MS, maintenant);
  const num = etat(sansNumero, FRAIS_MS, maintenant);
  const lignes = [
    { cle: 'colis-retard', ...colis, ecran: 'ventes', geste: { cle: 'colis', tab: 'cat_bord', onglet: 'envoyer' } },
    { cle: 'ventes-a-dater', ...dater, ecran: 'compta', geste: { cle: 'dater', tab: 'compta', clic: '[data-urssaf-dater]' } },
    { cle: 'sans-numero', ...num, ecran: 'annonces', geste: cartons ? { cle: 'cartons', cible: '[data-cartons]' } : { cle: 'numeroter', tab: 'cat_annonces', vue: 'nonum' } },
  ];
  const sues = lignes.filter((l) => Number.isInteger(l.n));
  return {
    lignes,
    aRegler: lignes.filter((l) => l.n > 0),
    total: sues.reduce((t, l) => t + l.n, 0),
    partiel: sues.length < lignes.length,
    manque: lignes.filter((l) => !Number.isInteger(l.n)).map((l) => l.cle),
    toutSu: sues.length === lignes.length,
  };
}

// La carte : 'cachee' · 'liste' (au moins une chose à régler) · 'rien' (tout est su
// et vaut 0) · 'attente' (rien de su encore : on ne montre pas une liste vide).
// `pret` : l'import est fini OU le dressing a été lu (la preuve du parcours, étape Vinted).
export function carteTrouve(r, { reglage, creeLe, pret = false, exemple = false, maintenant = Date.now() } = {}) {
  if (exemple || !pret || !r) return 'cachee';
  if (!compteNeuf(creeLe, maintenant)) return 'cachee';
  if (lireAides(reglage).trouveVu) return 'cachee';
  if (r.aRegler.length) return 'liste';
  if (r.toutSu) return 'rien';
  return 'attente';
}
