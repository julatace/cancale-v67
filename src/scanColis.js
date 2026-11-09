// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR DÉPOSER (3 nov., choix de Julien n° 1)
//  Au relais, il scanne le code-barres du bordereau : VRM retrouve le colis PAR
//  SON N° DE SUIVI, exactement (§5 : jamais un titre, jamais une ressemblance),
//  et pose « Déposé » — le geste existant (`marquerColisFait`, annulable 5 s).
//
//  Ce que contient un code-barres de bordereau — MESURÉ (lecture seule, deux
//  vrais bordereaux de sa base, lus par zbar, 3 nov.) :
//   · InPost / Mondial Relay : Code 128 à 26 chiffres « 56 82579787 0101… »,
//     le n° d'expédition imprimé (« N° Expédition V2 82579787 ») est aux
//     chiffres 3 à 10 ;
//   · Vinted (Hermes) : Code 128 à 26 chiffres « 55 15193563 0101… », le n°
//     imprimé (« V1 15193563 ») aux chiffres 3 à 10 ; un 2ᵉ code « H1004… ».
//   · Chronopost (2 lettres + 9 chiffres + 2 lettres) : PAS mesuré — le n° lui-
//     même, ou le n° posé dans un code plus long (une seule occurrence).
//  Chaque lecture donne une LISTE FERMÉE de n° possibles (la valeur brute, et
//  ce que la FORME ci-dessus désigne) ; un colis n'est trouvé que si UN SEUL
//  colis porte exactement l'un d'eux. Deux colis ⇒ rien n'est écrit.
// ════════════════════════════════════════════════════════════════════════════

// Un n° de suivi sous sa forme comparable : majuscules, lettres et chiffres.
export const normaliserN = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Les n° qu'une lecture DÉSIGNE (jamais une approximation : des formes fixes).
export function candidatsDuScan(brut) {
  const s = normaliserN(brut);
  const out = [];
  const ajoute = (x) => { if (x && x.length >= 8 && !out.includes(x)) out.push(x); };
  if (!s) return out;
  ajoute(s);
  // 26 chiffres (InPost, Mondial Relay, Vinted/Hermes) : le n° d'expédition imprimé.
  if (/^\d{26}$/.test(s)) ajoute(s.slice(2, 10));
  // Un n° Chronopost posé dans un code plus long : retenu s'il n'y en a qu'UN.
  const chrono = s.match(/[A-Z]{2}\d{9}[A-Z]{2}/g) || [];
  if (chrono.length === 1) ajoute(chrono[0]);
  return out;
}

// (9 nov., lot V) AU RETRAIT d'un ACHAT, l'étiquette peut porter le n° de suivi OU le
// code de retrait (souvent 6 caractères) : la valeur brute est retenue dès 4 caractères,
// en plus des formes ci-dessus. Toujours une égalité EXACTE ensuite (un code de retrait
// n'existe que pour UN colis, §5).
export function candidatsRetrait(brut) {
  const out = candidatsDuScan(brut);
  const s = normaliserN(brut);
  if (s && s.length >= 4 && !out.includes(s)) out.push(s);
  return out;
}

// `colis` : [{ cle, suivis: [n°…], deja: bool, sansVente?: bool, … }]. Rend
//  · { etat: 'trouve', colis }   un seul colis, pas encore déposé ;
//  · { etat: 'deja', colis }     un seul colis, déjà déposé / parti ;
//  · { etat: 'ambigu', colis: [..] }  plusieurs colis portent ce n° ⇒ rien ;
//  · { etat: 'inconnu' }         aucun colis ne porte ce n° ⇒ rien ;
//  · { etat: 'sansVente', colis } un seul colis, mais son bordereau n'est relié à
//                                 AUCUNE vente (pas de paire à montrer) ⇒ rien ;
//  · { etat: 'vide' }            lecture vide.
// `candidats` : la règle des n° qu'une lecture désigne (`candidatsRetrait` aux achats).
export function trouverParScan(brut, colis, { candidats = candidatsDuScan } = {}) {
  const cands = candidats(brut);
  if (!cands.length) return { etat: 'vide', candidats: cands };
  const parCle = new Map();
  for (const c of (Array.isArray(colis) ? colis : [])) {
    if (!c || c.cle == null) continue;
    const ns = (Array.isArray(c.suivis) ? c.suivis : []).map(normaliserN).filter(Boolean);
    if (ns.some((n) => cands.includes(n))) parCle.set(String(c.cle), c);
  }
  const L = [...parCle.values()];
  if (!L.length) return { etat: 'inconnu', candidats: cands };
  if (L.length > 1) return { etat: 'ambigu', colis: L, candidats: cands };
  if (L[0].deja) return { etat: 'deja', colis: L[0], candidats: cands };
  if (L[0].sansVente) return { etat: 'sansVente', colis: L[0], candidats: cands };
  return { etat: 'trouve', colis: L[0], candidats: cands };
}

// Une même lecture répétée par la caméra (le code reste dans le cadre) ne
// compte qu'une fois pendant `ms`.
export function filtreRepetition(ms = 2500) {
  let dernier = '', at = 0;
  return (brut, maintenant = Date.now()) => {
    const s = normaliserN(brut);
    if (!s) return false;
    if (s === dernier && maintenant - at < ms) return false;
    dernier = s; at = maintenant; return true;
  };
}
