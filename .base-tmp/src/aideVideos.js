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
  ventes: { titre: 'Imprimer tes bordereaux', geste: 'Tout imprimer, le N° tamponné sur chaque bordereau', duree: 16 },
  colis: { titre: 'Retirer un colis', geste: 'Le code d’un toucher, copié, puis en grand au comptoir', duree: 12 },
  achats: { titre: 'Ajouter un achat', geste: 'Une brocante, un magasin : titre, prix, N°', duree: 15 },
  annonces: { titre: 'Tes annonces', geste: 'Chaque annonce et son N°, prix d’achat et marge', duree: 12 },
  garage: { titre: 'Retrouver une paire', geste: 'Tape son N° : le meuble et la case', duree: 14 },
  compta: { titre: 'Déclarer le mois', geste: 'Le montant daté au versement, copié pour l’URSSAF', duree: 14 },
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

export const DOSSIER_VIDEOS = '/aide/videos/';
export const urlVideo = (id, ext = 'mp4') => `${DOSSIER_VIDEOS}${id}.${ext}`;
export const videosDe = (cle) => (VIDEOS_ECRAN[cle] || []).filter((id) => VIDEOS_AIDE[id]);
export const dureeLisible = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
