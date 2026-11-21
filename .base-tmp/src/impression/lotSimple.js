// ═══════════════════════════════════════════════════════════════════════════
// « IMPRIMER » EN UN TOUCHER (14 nov., chantier impression-simple)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, mot pour mot : « le bouton imprimer donc clairement à améliorer, c'est
// n'importe quoi ça marche pas du tout, tout le processus est horrible, pas du
// tout intuitif, c'est une catastrophe ».
// Mesuré sur le vrai parcours (banc impression-simple, avant) : 4 touchers avant
// que le PDF existe (Tout imprimer · Imprimer · la question du N° · « Place du
// tampon » qui s'ouvrait seule pour chaque transporteur), puis un grand panneau
// « Imprimer les bordereaux · 6 sur 6 » par-dessus tout ; sur iPhone le PDF ne
// s'ouvrait JAMAIS (Safari refuse une fenêtre ouverte après une attente), il
// fallait fermer le panneau puis trouver « Ouvrir le PDF ».
// Règles PURES ici (aucune lecture, aucun DOM) ; l'app les branche.
// ═══════════════════════════════════════════════════════════════════════════

export const FORMATS_IMPRESSION = Object.freeze(['normale', 'thermique', 'planche4']);
// Le format RETENU : un des trois, ou null = jamais choisi (on le demande UNE fois).
export const formatRetenu = (v) => (FORMATS_IMPRESSION.includes(String(v)) ? String(v) : null);

// Ce qui change le PDF : le format, chaque bordereau (sa clé, son empreinte —
// N°, état, compte —, son tampon choisi), dans l'ordre. Un PDF préparé ne sert
// que si la signature est LA MÊME au moment du toucher (sinon : refait).
export const signatureLot = ({ lignes = [], sig = () => '', format = 'normale', tampons = {} } = {}) =>
  [String(format), ...lignes.map((l) => `${l.cle}=${sig(l)}=${(tampons && tampons[l.cle]) || ''}`)].join('|');

// COMMENT OUVRIR LE PDF au toucher. Safari d'iPhone n'ouvre une fenêtre (ou la
// feuille de partage) que DANS le geste : un PDF fait après une attente arrive trop
// tard. D'où : prêt d'avance + toucher ⇒ partage (ou onglet) tout de suite ; pas
// prêt ⇒ un bouton « Ouvrir le PDF » (SON toucher est le geste). L'ordinateur n'a
// pas cette limite : la visionneuse de VRM s'ouvre et lance l'impression seule.
export const voieOuverture = ({ ios = false, android = false, partageFichiers = false, pret = false, geste = false } = {}) => {
  if (!ios && !android) return 'visionneuse';
  if (!pret || !geste) return 'bouton';
  if (partageFichiers) return 'partage';
  return ios ? 'onglet' : 'bouton';
};

// « IL EN MANQUE » : les pages des bordereaux choisis, prises dans le PDF déjà
// tamponné (jamais refait, jamais un autre tampon), dans l'ordre du lot.
// `plages` : [{ cle, debut, n }] (une plage par bordereau : sa page, sa fiche, sa facture).
export const pagesDe = (plages = [], cles = []) => {
  const voulu = new Set((cles || []).map(String));
  const out = [];
  for (const p of plages || []) if (p && voulu.has(String(p.cle))) for (let i = 0; i < (p.n | 0); i++) out.push((p.debut | 0) + i);
  return out;
};

// Ce que la feuille dit après l'impression : chaque bordereau absent est NOMMÉ
// (jamais sauté en silence) avec SA raison.
// (16 nov., lot impression-retours) + les raisons d'un bordereau de RETOUR absent (jamais « génère-le sur la vente »).
export const RAISONS_ABSENT = Object.freeze(['pasLu', 'sansPdf', 'illisible', 'retourSansPdf', 'retourIllisible']);
export const absentsDuLot = (lignes = [], reussies = [], raisons = {}) => {
  const ok = new Set((reussies || []).map(String));
  return (lignes || []).filter((l) => l && !ok.has(String(l.cle))).map((l) => ({ cle: l.cle, num: l.num || '', titre: l.titre || '', raison: RAISONS_ABSENT.includes(raisons[l.cle]) ? raisons[l.cle] : 'pasLu' }));
};
