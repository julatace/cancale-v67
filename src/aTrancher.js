// ══════════════════════════════════════════════════════════════════════════════
//  « À TRANCHER » (9 nov., lot AC — proposition 43, « tu ne peux pas avoir
//  d'hésitation ») : UN seul endroit pour tout ce que VRM n'a pas pu décider.
// ══════════════════════════════════════════════════════════════════════════════
//  Ce module NE DÉCIDE RIEN. Chaque ligne est le nombre qu'un écran PROPRIÉTAIRE
//  compte déjà avec SA règle (§5, « une seule règle par notion, un seul
//  propriétaire ») ; la liste le CONSOMME :
//    · les publications existantes : `vrm_colis_retirer` (Colis, `pickupUnion` :
//      `aVerifier` + `enVerification`) et `vinted_urssaf_mois.aDater` (Ventes,
//      `ventesDeclarables`) ;
//    · `vrm_a_trancher` (cet appareil, ce compte VRM) : ce qui ne vivait qu'en
//      mémoire d'un écran, publié PAR CET ÉCRAN au moment où il le compte
//      (`publierSource`) — Colis/Annonces/Ma journée (`Comptabilite` : N° portés
//      deux fois, N° à écrire, N° à vérifier, remises en ligne, annonces sans prix
//      d'achat, colis cochés « posté » pas vus partir, articles supprimés de Vinted),
//      « Reçu par SMS » (src/InfosSms.jsx), « Adresses sans compte » (E-mails) ;
//    · les comptes à relire : `comptesARelireDe(liveStats)`, LA règle de la puce de
//      Colis (déplacée ici telle quelle, Colis l'appelle).
//  Trois états par ligne (§5) : `undefined` pas encore là · `null` pas su (jamais
//  relu sur cet appareil, ou trop ancien) · un nombre. Pas su ⇒ « — » et la
//  raison, jamais 0. Le total est la somme de ce qui est SU ; s'il manque une
//  source, il est « au moins » et le manque est nommé.
//  Rien ici n'écrit autre chose que `vrm_a_trancher` (un nombre par source, local,
//  jamais synchronisé, jamais une donnée métier) ; un geste n'ouvre qu'un écran.
//  Pur (le stockage est passé en paramètre) : scripts/audit-a-trancher.cjs l'exécute.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_A_TRANCHER = 'vrm_a_trancher';
// Une publication d'écran se croit 12 h (la règle des badges de Colis,
// `publicationColisFraiche`) ; le CA déclaré, 3 jours (celle du widget).
export const FRAIS_MS = 12 * 3600e3;
export const FRAIS_URSSAF_MS = 3 * 86400e3;

const pl = (n, s, p) => (n > 1 ? p : s);

// L'ordre = la priorité : ce qui coûte un colis ou de l'argent d'abord.
// `ecran` : où se publie le nombre (la raison d'un « — ») ; `geste` : ce que
// le bouton ouvre (`tab`, `onglet` de Colis, `vue` d'Annonces, `cible` = le bloc
// de l'écran propriétaire où il tranche, rejoint par défilement).
export const SOURCES = [
  { cle: 'numeros-double', ecran: 'Colis', quoi: (n) => `${n} N° ${pl(n, 'porté', 'portés')} par deux paires`,
    pourquoi: 'au moment d’expédier, la mauvaise paire part', geste: { libelle: 'Corriger', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-numeros-double]' } },
  { cle: 'colis-postes', ecran: 'Colis', quoi: (n) => `${n} colis ${pl(n, 'coché', 'cochés')} « posté » que Vinted n’a pas vu${pl(n, '', 's')} partir`,
    pourquoi: 'vérifie le dépôt avant la date limite', geste: { libelle: 'Vérifier', tab: 'cat_bord', onglet: 'envoyes' } },
  { cle: 'colis-retirer', ecran: 'Colis', quoi: (n) => `${n} colis à retirer à vérifier`,
    pourquoi: 'délai dépassé, incident ou achat pas encore relié', geste: { libelle: 'Voir', tab: 'cat_bord', onglet: 'retirer' } },
  { cle: 'numeros-a-ecrire', ecran: 'Colis', quoi: (n) => `${n} ${pl(n, 'nouveau N°', 'nouveaux N°')} à écrire sur ${pl(n, 'son carton', 'leurs cartons')}`,
    pourquoi: 'le carton porte encore l’ancien numéro', geste: { libelle: 'C’est écrit ?', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-numeros-a-ecrire]' } },
  { cle: 'numeros-a-verifier', ecran: 'Annonces', quoi: (n) => `${n} N° à vérifier sur ${pl(n, 'son carton', 'leurs cartons')}`,
    pourquoi: 'numéroté pendant une panne de synchro : il peut désigner une autre paire', geste: { libelle: 'Vérifier', tab: 'cat_annonces', cible: '[data-numeros-a-verifier]' } },
  { cle: 'sms-vestiaire', ecran: 'Colis', quoi: (n) => `${n} ${pl(n, 'vente Vestiaire reçue', 'ventes Vestiaire reçues')} par SMS, pas ${pl(n, 'reliée', 'reliées')}`,
    pourquoi: 'sans n° de commande : rien n’est relié tout seul', geste: { libelle: 'Relier', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-infos-sms="vestiaire"]' } },
  { cle: 'sms-pickup', ecran: 'Colis', quoi: (n) => `${n} colis Pickup ${pl(n, 'reçu', 'reçus')} par SMS, sans n° ni code`,
    pourquoi: 'peut-être plusieurs fois le même colis', geste: { libelle: 'Voir', tab: 'cat_bord', onglet: 'retirer', cible: '[data-infos-sms="pickup"]' } },
  { cle: 'supprimes-vinted', ecran: 'Ma journée', quoi: (n) => `${n} ${pl(n, 'article supprimé', 'articles supprimés')} de Vinted : encore chez toi ?`,
    pourquoi: 'vendu ailleurs, remis en ligne ou toujours là', geste: { libelle: 'Répondre', tab: 'journee', cible: '[data-job="supprime-vinted"]' } },
  { cle: 'remise-en-ligne', ecran: 'Annonces', quoi: (n) => `${n} ${pl(n, 'annonce remise', 'annonces remises')} en ligne : même paire ?`,
    pourquoi: 'si oui, elle garde son N° ; ton clic relie', geste: { libelle: 'Répondre', tab: 'cat_annonces', cible: '[data-remise-bloc]' } },
  { cle: 'achats-sans-prix', ecran: 'Annonces', quoi: (n) => `${n} ${pl(n, 'annonce numérotée', 'annonces numérotées')} sans prix d’achat`,
    pourquoi: 'le bénéfice ne compte pas ces paires', geste: { libelle: 'Saisir', tab: 'cat_annonces', vue: 'sansachat' } },
  { cle: 'adresses-sans-compte', ecran: 'E-mails', quoi: (n) => `${n} ${pl(n, 'adresse e-mail', 'adresses e-mail')} sans compte relié`,
    pourquoi: 'leurs ventes et bordereaux n’ont pas de compte', geste: { libelle: 'Relier', tab: 'emails', clic: '[data-boite-vue="relier"]', cible: '[data-adresses-sans-compte]' } },
  { cle: 'comptes-a-relire', ecran: 'Colis', quoi: (n) => `${n} ${pl(n, 'compte', 'comptes')} à relire`,
    pourquoi: 'leurs ventes datent de plus d’un jour', geste: { libelle: 'Mes comptes', tab: 'vintedaccounts' } },
  { cle: 'ventes-a-dater', ecran: 'Ventes', quoi: (n) => `${n} ${pl(n, 'vente', 'ventes')} à dater`,
    pourquoi: 'sans date de versement : dans aucun mois déclaré', geste: { libelle: 'Voir', tab: 'compta' } },
];
// Le nom d'une source quand son nombre n'est pas su (sans nombre dans la phrase).
export const NOMS = {
  'numeros-double': 'N° portés par deux paires',
  'colis-postes': 'Colis cochés « posté » pas vus partir',
  'colis-retirer': 'Colis à retirer à vérifier',
  'numeros-a-ecrire': 'Nouveaux N° à écrire sur les cartons',
  'numeros-a-verifier': 'N° à vérifier sur leur carton',
  'sms-vestiaire': 'Ventes Vestiaire reçues par SMS',
  'sms-pickup': 'Colis Pickup reçus par SMS',
  'supprimes-vinted': 'Articles supprimés de Vinted',
  'remise-en-ligne': 'Annonces remises en ligne',
  'achats-sans-prix': 'Annonces sans prix d’achat',
  'adresses-sans-compte': 'Adresses e-mail sans compte',
  'comptes-a-relire': 'Comptes à relire',
  'ventes-a-dater': 'Ventes à dater',
};
export const CLES_SOURCES = SOURCES.map((s) => s.cle);

// ── la règle de la puce « N comptes à relire » de Colis (déplacée telle quelle) ──
// `liveStats` absent ⇒ undefined ; lecture ratée (`dataAgeComptes` null sans âge)
// ⇒ null ; sinon la liste [{ login, jours }] (vide = aucun).
export function comptesARelireDe(ls) {
  if (!ls) return undefined;
  if (Number(ls.dataAgeJours) > 1) {
    const l = Array.isArray(ls.dataAgeComptes) ? ls.dataAgeComptes.filter((x) => x && x.login) : [];
    return l.length ? l : [{ login: ls.dataAgeCompte || '', jours: ls.dataAgeJours }];
  }
  return ls.dataAgeComptes === null && ls.dataAgeJours == null ? null : [];
}

// ── la publication (un nombre par source, local à l'appareil et au compte) ──────
const lireBrut = (storage) => { try { const t = storage.getItem(CLE_A_TRANCHER); const v = t ? JSON.parse(t) : null; return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
// Rend true si la ligne a changé. `n` non entier ⇒ rien n'est écrit (pas su ne
// s'écrit jamais : il garde la dernière valeur lue, qui vieillira).
export function publierSource(storage, uid, cle, n, maintenant = Date.now()) {
  if (!storage || !uid || !CLES_SOURCES.includes(cle)) return false;
  if (!(Number.isInteger(n) && n >= 0)) return false;
  const brut = lireBrut(storage);
  const s = brut && brut.uid === String(uid) && brut.s && typeof brut.s === 'object' ? { ...brut.s } : {};
  const avant = s[cle];
  // Même nombre et publié il y a moins d'une heure : rien (pas d'écriture à chaque rendu).
  if (avant && avant.n === n && maintenant - Number(avant.at) < 3600e3) return false;
  s[cle] = { n, at: maintenant };
  try { storage.setItem(CLE_A_TRANCHER, JSON.stringify({ uid: String(uid), s })); } catch (_) { return false; }
  return true;
}
export function lirePublications(storage, uid) {
  const brut = lireBrut(storage);
  return brut && uid && brut.uid === String(uid) && brut.s && typeof brut.s === 'object' ? brut.s : {};
}

const ilYa = (ms) => { const h = Math.round(ms / 3600e3); return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`; };
const etatPub = (p, frais, maintenant, ecran) => {
  if (!p || !Number.isFinite(Number(p.at))) return { n: null, raison: `pas encore compté sur cet appareil : ouvre ${ecran}` };
  const age = maintenant - Number(p.at);
  if (age > frais) return { n: null, raison: `compté il y a ${ilYa(age)} : ouvre ${ecran} pour le recompter` };
  return { n: Number(p.n), raison: '' };
};

// ── les lignes ──────────────────────────────────────────────────────────────────
// pubs         : `lirePublications(...)`
// colisRetirer : la ligne `vrm_colis_retirer` (ou null)
// urssafMois   : la ligne `vinted_urssaf_mois` (ou null)
// comptes      : `comptesARelireDe(liveStats)`
export function lignesATrancher({ pubs = {}, colisRetirer = null, urssafMois = null, comptes, maintenant = Date.now() } = {}) {
  const lignes = SOURCES.map((src, ordre) => {
    let e;
    if (src.cle === 'colis-retirer') {
      const p = colisRetirer && typeof colisRetirer === 'object' && Number.isFinite(Number(colisRetirer.aVerifier))
        ? { n: Number(colisRetirer.aVerifier) + (Number(colisRetirer.enVerification) || 0), at: colisRetirer.at } : null;
      e = etatPub(p, FRAIS_MS, maintenant, src.ecran);
    } else if (src.cle === 'ventes-a-dater') {
      const ad = urssafMois && urssafMois.aDater;
      const p = ad && Number.isFinite(Number(ad.n)) ? { n: Number(ad.n), at: urssafMois.at } : null;
      e = etatPub(p, FRAIS_URSSAF_MS, maintenant, src.ecran);
    } else if (src.cle === 'comptes-a-relire') {
      e = Array.isArray(comptes) ? { n: comptes.length, raison: '', noms: comptes.map((c) => c.login).filter(Boolean) }
        : comptes === null ? { n: null, raison: 'la fraîcheur des lectures n’a pas pu être lue' } : { n: undefined, raison: 'lecture…' };
    } else {
      e = etatPub(pubs[src.cle], FRAIS_MS, maintenant, src.ecran);
    }
    return { cle: src.cle, nom: NOMS[src.cle] || src.cle, ordre, n: e.n, raison: e.raison, quoi: Number(e.n) > 0 ? src.quoi(e.n) : '', pourquoi: src.pourquoi, geste: src.geste, ecran: src.ecran, noms: e.noms || null };
  });
  const sues = lignes.filter((l) => Number.isInteger(l.n));
  const total = sues.reduce((t, l) => t + l.n, 0);
  const manque = lignes.filter((l) => !Number.isInteger(l.n));
  return { lignes, total, partiel: manque.length > 0, manque, aTrancher: lignes.filter((l) => l.n > 0) };
}

// Le compteur de la navigation : la somme SUE, et rien si elle est nulle (jamais « 0 »).
export const badgeATrancher = (r) => (r && r.total > 0 ? r.total : null);
// La ligne de Ma journée : seulement s'il y a quelque chose à trancher.
export const phraseJournee = (r) => (r && r.total > 0
  ? `${r.partiel ? 'Au moins ' : ''}${r.total} ${r.total > 1 ? 'choses' : 'chose'} à trancher` : '');
