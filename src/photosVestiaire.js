// ════════════════════════════════════════════════════════════════════════════
//  LES PHOTOS QUE VESTIAIRE DEMANDE, AVANT « PRÉPARER SUR VESTIAIRE »
//  (11 nov., lot vestiaire-plus)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « la liste des photos exigées par Vestiaire avant de publier (vues
// obligatoires selon la catégorie, fond, étiquette, numéro de série) : ce qui
// manque est dit avant « Préparer sur Vestiaire », avec le détourage existant ».
//
// D'OÙ VIENT LA LISTE (rien d'inventé, la source est écrite à côté de chaque vue) :
//  · `faq` — l'aide officielle de Vestiaire (« photo checklist » par catégorie,
//    relevée le 11 nov.) : chaussures = étiquette intérieure de la marque,
//    marque sous la semelle, pointure, numéro de série s'il existe ; preuve
//    d'origine = photo du numéro de série OU preuve d'achat OU certificat (elle
//    n'est PAS montrée sur l'annonce : Vestiaire s'en sert pour l'authenticité) ;
//    les défauts en gros plan ; le contrôle qualité compare l'article aux photos.
//  · `smart` — mesuré dans le formulaire de Julien (28 oct., `panel_vc_form`) :
//    la photo de l'ÉTIQUETTE en 2ᵉ (`vrm_vc_etiquettes`).
//  · `guide` — guides de vendeurs (pas Vestiaire) : sac = face, dos, étiquette
//    intérieure, dessous, intérieur ; 1re photo entière, de face, sur fond uni.
//    Dit comme tel (« conseillé »), jamais « exigé ».
// Les listes de Vestiaire pour les vêtements, bijoux et montres n'ont pas été
// relues : ces catégories disent « liste pas relue » (pas su ≠ rien à faire).
//
// CE QUE VRM PEUT VÉRIFIER SEUL (sans IA, §2.9) : le NOMBRE de photos, la photo
// d'étiquette CHOISIE par lui, la clé Photoroom pour le fond détouré (Vestiaire
// seul, §3). Ce que montre une photo (semelle, numéro de série…) VRM ne le sait
// pas : c'est « à vérifier », jamais « manque », jamais « ok ».
// Module PUR : scripts/audit-photos-vestiaire.cjs l'exécute.
// ════════════════════════════════════════════════════════════════════════════

// Une vue : { k, source, exige } — `exige` false = conseillé (guide).
export const VUES_VC = {
  chaussures: [
    { k: 'entiere', source: 'guide', exige: false },
    { k: 'etiquetteInterieure', source: 'faq', exige: true },
    { k: 'semelle', source: 'faq', exige: true },
    { k: 'pointure', source: 'faq', exige: true },
    { k: 'serie', source: 'faq', exige: false, siPresent: true },
  ],
  sacs: [
    { k: 'face', source: 'guide', exige: false },
    { k: 'dos', source: 'guide', exige: false },
    { k: 'etiquetteInterieure', source: 'guide', exige: false },
    { k: 'dessous', source: 'guide', exige: false },
    { k: 'interieur', source: 'guide', exige: false },
    { k: 'serie', source: 'faq', exige: false, siPresent: true },
  ],
};
// Pour toute catégorie : la preuve d'origine (cachée de l'annonce) et les défauts.
export const VUES_COMMUNES_VC = [
  { k: 'origine', source: 'faq', exige: true },
  { k: 'defauts', source: 'faq', exige: false, siPresent: true },
];

// `famille` : celle de l'article (src/App.jsx `familleArticle`, une PROPOSITION :
// la catégorie se choisit sur Vestiaire) ; `nPhotos` ; `etiquette` : 'choisie' |
// 'pas-choisie' | 'introuvable' ; `photoroom` : true (clé utilisable) · false
// (aucune) · null (pas su).
// Rend { vues: [{ k, etat: 'manque'|'ok'|'a-verifier', source, exige }], manque: [k…],
//        liste: 'faq'|'guide'|'pas-relue', famille }.
export function photosExigeesVc({ famille = '', nPhotos = 0, etiquette = 'pas-choisie', photoroom = null } = {}) {
  const f = VUES_VC[famille] ? famille : '';
  const propres = f ? VUES_VC[f] : [];
  const vues = [];
  // Le nombre : au moins autant de photos que de vues EXIGÉES de la catégorie (une par vue).
  const exigees = propres.filter((v) => v.exige && !v.siPresent).length;
  const n = Number.isFinite(Number(nPhotos)) ? Math.max(0, Math.floor(Number(nPhotos))) : 0;
  if (f) vues.push({ k: 'nombre', etat: n >= Math.max(1, exigees + 1) ? 'ok' : 'manque', source: 'faq', exige: true, n, min: exigees + 1 });
  else vues.push({ k: 'nombre', etat: n >= 1 ? 'a-verifier' : 'manque', source: '', exige: true, n, min: 1 });
  // L'étiquette en 2ᵉ (mesuré dans son formulaire) : choisie par lui ou non.
  vues.push({ k: 'etiquette2', etat: etiquette === 'choisie' ? 'ok' : 'manque', source: 'smart', exige: true });
  // Le fond : détouré par SA clé Photoroom (Vestiaire seul) — sinon « à vérifier » (fond uni à la prise de vue).
  vues.push({ k: 'fond', etat: photoroom === true ? 'ok' : photoroom === false ? 'manque' : 'a-verifier', source: 'guide', exige: false });
  for (const v of propres) vues.push({ k: v.k, etat: 'a-verifier', source: v.source, exige: v.exige, siPresent: !!v.siPresent });
  for (const v of VUES_COMMUNES_VC) vues.push({ k: v.k, etat: 'a-verifier', source: v.source, exige: v.exige, siPresent: !!v.siPresent });
  // « Manque » seulement ce que VRM SAIT manquer ; le fond sans clé n'arrête rien (conseillé).
  const manque = vues.filter((v) => v.etat === 'manque' && v.exige).map((v) => v.k);
  const conseille = vues.filter((v) => v.etat === 'manque' && !v.exige).map((v) => v.k);
  return { vues, manque, conseille, famille: f, liste: f === 'chaussures' ? 'faq' : f === 'sacs' ? 'guide' : 'pas-relue' };
}
