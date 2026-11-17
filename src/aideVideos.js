// ═══════════════════════════════════════════════════════════════════════════
// LES VIDÉOS DU « ? » (13 nov., lot 49) — une vidéo de 30 s au plus par écran
// principal, tournée dans la VRAIE app sur des données INVENTÉES
// (scripts/films/aide-videos.cjs, scénarios dans scripts/films/_aide-scenarios.cjs).
// Fichiers : public/aide/videos/<id>.mp4 (720 × 1280, H.264, sans son, ≤ 1,5 Mo),
// <id>.jpg (aperçu 360 × 640), <id>.vtt (les titres incrustés, en piste).
//
// ⚠️ RIEN n'est demandé au démarrage ni mis dans le service worker (public/sw.js
//    laisse /aide/ au réseau) : l'aperçu se charge quand la feuille du « ? »
//    s'ouvre (un toucher), la vidéo seulement au toucher de « Regarder ».
//    (scripts/bancs/aide-videos.cjs, scripts/audit-aide-videos.cjs)
// ═══════════════════════════════════════════════════════════════════════════

// id → ce que montre la vidéo. `duree` en secondes (mesurée au tournage).
export const VIDEOS_AIDE = {
  journee: { titre: 'Ma journée', geste: 'Le plus pressé en haut, un geste par ligne', duree: 15 },
  ventes: { titre: 'Imprimer tes bordereaux', geste: 'Coche, imprime : le N° tamponné sur chacun', duree: 11 },
  colis: { titre: 'Retirer un colis', geste: 'Le code en grand d’un toucher, copié', duree: 11 },
  achats: { titre: 'Ajouter un achat', geste: 'Une brocante, un magasin : titre, prix, N°', duree: 15 },
  annonces: { titre: 'Tes annonces', geste: 'Chaque annonce et son N°, prix d’achat et marge', duree: 13 },
  garage: { titre: 'Retrouver une paire', geste: 'Tape son N° : le meuble et la case', duree: 14 },
  compta: { titre: 'Déclarer le mois', geste: 'Le montant daté au versement, noté « déclaré »', duree: 12 },
  messages: { titre: 'Lire un message et son offre', geste: 'La paire, son N°, l’offre et ce qu’elle te laisse', duree: 13 },
  emails: { titre: 'Tes e-mails rangés', geste: 'Un code copié d’un geste, les codes seulement', duree: 11 },
  settings: { titre: 'Trouver un réglage', geste: 'Cherche-le par son nom, il s’ouvre', duree: 11 },
};

// Le « ? » de chaque écran → SA vidéo d'abord. Colis n'est plus un onglet
// (11 nov. : « À expédier » dans Ventes, « À retirer » dans Achats) : le « ? »
// d'Achats propose aussi « Retirer un colis ».
export const VIDEOS_ECRAN = {
  journee: ['journee'],
  ventes: ['ventes'],
  colis: ['colis', 'ventes'],
  achats: ['achats', 'colis'],
  annonces: ['annonces'],
  garage: ['garage'],
  compta: ['compta'],
  messages: ['messages'],
  emails: ['emails'],
  settings: ['settings'],
};

// (17 nov., lot aide-videos) Les textes visibles de chaque vidéo passent par tr() : `av.<id>.titre`,
// `av.<id>.geste` et `av.<id>.reponse` (LA réponse en deux lignes, au-dessus de la vidéo, pour qui ne
// veut pas la regarder) — src/i18n/langues/<langue>/aide-videos.js. Les champs ci-dessus restent la
// source française (le tournage et l'audit les lisent).
export const LANGUES_SOUS_TITRES = ['fr', 'en', 'es', 'it', 'de'];
// La piste de sous-titres d'une langue : <id>.vtt (fr, écrite au tournage), <id>.<langue>.vtt sinon
// (scripts/films/aide-sous-titres.cjs, depuis la table traduite).
export const urlSousTitres = (id, langue = 'fr') => `${DOSSIER_VIDEOS}${id}${langue && langue !== 'fr' ? '.' + langue : ''}.vtt`;
// La recherche par mots (le champ « Comment faire… ? » du « ? ») : les vidéos dont le titre, le
// geste ou la réponse contient TOUS les mots cherchés (sans accents, sans casse ; mots de 2 lettres
// et plus). `texteDe(id)` rend le texte de la vidéo dans la langue de l'écran.
const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function chercherVideos(q, texteDe) {
  const mots = normal(q).split(/[^a-z0-9]+/).filter((m) => m.length >= 2);
  if (!mots.length) return [];
  return Object.keys(VIDEOS_AIDE).filter((id) => { const t = normal(texteDe ? texteDe(id) : `${VIDEOS_AIDE[id].titre} ${VIDEOS_AIDE[id].geste}`); return mots.every((m) => t.includes(m)); });
}
export const DOSSIER_VIDEOS = '/aide/videos/';
export const urlVideo = (id, ext = 'mp4') => `${DOSSIER_VIDEOS}${id}.${ext}`;
export const videosDe = (cle) => (VIDEOS_ECRAN[cle] || []).filter((id) => VIDEOS_AIDE[id]);
export const dureeLisible = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
