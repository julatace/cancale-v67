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
  // (10 nov., lot BB) Une vente en litige ou en retour : la réponse a une date limite.
  // Publié par l'écran « Litiges en cours » (et Ma journée, Ventes), règle src/litigesEcran.js.
  { cle: 'litiges-en-cours', ecran: 'Litiges', quoi: (n) => `${n} ${pl(n, 'litige ou retour', 'litiges ou retours')} en cours`,
    pourquoi: 'réponds avant la date limite', geste: { libelle: 'Voir', tab: 'litiges' } },
  { cle: 'numeros-a-ecrire', ecran: 'Colis', quoi: (n) => `${n} ${pl(n, 'nouveau N°', 'nouveaux N°')} à écrire sur ${pl(n, 'son carton', 'leurs cartons')}`,
    pourquoi: 'le carton porte encore l’ancien numéro', geste: { libelle: 'Voir', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-numeros-a-ecrire]' } },
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
  // (10 nov., lot BH) Un même achat enregistré deux fois (même n° de transaction / de
  // commande / de facture — jamais par ressemblance) : publié par l'écran Achats,
  // règle src/achatsDoubles.js. Il compterait deux fois dans « dépensé » et le bénéfice.
  { cle: 'achats-doubles', ecran: 'Achats', quoi: (n) => `${n} ${pl(n, 'achat saisi', 'achats saisis')} deux fois`,
    pourquoi: 'il compterait deux fois dans tes dépenses', geste: { libelle: 'Choisir', tab: 'achats', cible: '[data-achats-doubles]' } },
  { cle: 'achats-sans-prix', ecran: 'Annonces', quoi: (n) => `${n} ${pl(n, 'annonce numérotée', 'annonces numérotées')} sans prix d’achat`,
    pourquoi: 'le bénéfice ne compte pas ces paires', geste: { libelle: 'Saisir', tab: 'cat_annonces', vue: 'sansachat' } },
  { cle: 'adresses-sans-compte', ecran: 'E-mails', quoi: (n) => `${n} ${pl(n, 'adresse e-mail', 'adresses e-mail')} sans compte relié`,
    pourquoi: 'leurs ventes et bordereaux n’ont pas de compte', geste: { libelle: 'Relier', tab: 'emails', clic: '[data-boite-vue="relier"]', cible: '[data-adresses-sans-compte]' } },
  { cle: 'comptes-a-relire', ecran: 'Colis', quoi: (n) => `${n} ${pl(n, 'compte', 'comptes')} à relire`,
    pourquoi: 'leurs ventes datent de plus d’un jour', geste: { libelle: 'Mes comptes', tab: 'vintedaccounts' } },
  { cle: 'ventes-a-dater', ecran: 'Ventes', quoi: (n) => `${n} ${pl(n, 'vente', 'ventes')} à dater`,
    pourquoi: 'sans date de versement : dans aucun mois déclaré', geste: { libelle: 'Dater', tab: 'compta', clic: '[data-urssaf-dater]' } },
];
// Le nom d'une source quand son nombre n'est pas su (sans nombre dans la phrase).
export const NOMS = {
  'numeros-double': 'N° portés par deux paires',
  'colis-postes': 'Colis cochés « posté » pas vus partir',
  'colis-retirer': 'Colis à retirer à vérifier',
  'litiges-en-cours': 'Litiges et retours en cours',
  'numeros-a-ecrire': 'Nouveaux N° à écrire sur les cartons',
  'numeros-a-verifier': 'N° à vérifier sur leur carton',
  'sms-vestiaire': 'Ventes Vestiaire reçues par SMS',
  'sms-pickup': 'Colis Pickup reçus par SMS',
  'supprimes-vinted': 'Articles supprimés de Vinted',
  'remise-en-ligne': 'Annonces remises en ligne',
  'achats-doubles': 'Achats saisis deux fois',
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
// (10 nov., cartes) `ex` (facultatif) : les premières CHOSES de ce nombre, telles que
// l'écran propriétaire les a sous les yeux — { id, num, photo, photo2, de } seulement
// (`exemplesPropres` : aucun titre, aucun montant, rien de l'acheteur) ; la photo est
// celle de L'ANNONCE elle-même (son identité, §5), jamais une ressemblance.
export function publierSource(storage, uid, cle, n, maintenant = Date.now(), ex = undefined) {
  if (!storage || !uid || !CLES_SOURCES.includes(cle)) return false;
  if (!(Number.isInteger(n) && n >= 0)) return false;
  const brut = lireBrut(storage);
  const s = brut && brut.uid === String(uid) && brut.s && typeof brut.s === 'object' ? { ...brut.s } : {};
  const avant = s[cle];
  const exP = ex === undefined ? (avant && avant.n === n ? exemplesPropres(avant.ex) : []) : exemplesPropres(ex);
  const memeEx = JSON.stringify(exP) === JSON.stringify(exemplesPropres(avant && avant.ex));
  // Même nombre, mêmes choses, publié il y a moins d'une heure : rien (pas d'écriture à chaque rendu).
  if (avant && avant.n === n && memeEx && maintenant - Number(avant.at) < 3600e3) return false;
  s[cle] = { n, at: maintenant, ...(exP.length && n > 0 ? { ex: exP } : {}) };
  try { storage.setItem(CLE_A_TRANCHER, JSON.stringify({ uid: String(uid), s })); } catch (_) { return false; }
  return true;
}
// Les choses publiées : au plus EX_MAX, champs bornés ; une photo n'est gardée que si
// c'est une adresse https (ou une image `data:image/`). Rien d'autre ne passe.
export const EX_MAX = 4;
const court = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
const photoPropre = (v) => (typeof v === 'string' && v.length <= 2000 && (/^https:\/\/[^\s"'<>]+$/.test(v) || /^data:image\/(png|jpeg|jpg|webp|svg\+xml)[;,]/.test(v)) ? v : '');
export function exemplesPropres(ex) {
  if (!Array.isArray(ex)) return [];
  const out = []; const vus = new Set();
  for (const x of ex) {
    if (!x || typeof x !== 'object') continue;
    const id = court(x.id, 64); if (!id || vus.has(id)) continue; vus.add(id);
    const e = { id };
    const num = court(x.num, 12); if (num) e.num = num;
    const ph = photoPropre(x.photo); if (ph) e.photo = ph;
    const ph2 = photoPropre(x.photo2); if (ph2) e.photo2 = ph2;
    const de = court(x.de, 12); if (de) e.de = de;
    out.push(e);
    if (out.length >= EX_MAX) break;
  }
  return out;
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
  return { n: Number(p.n), raison: '', ex: exemplesPropres(p.ex) };
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
    return { cle: src.cle, nom: NOMS[src.cle] || src.cle, ordre, n: e.n, raison: e.raison, quoi: Number(e.n) > 0 ? src.quoi(e.n) : '', pourquoi: src.pourquoi, geste: src.geste, ecran: src.ecran, noms: e.noms || null, ex: Number(e.n) > 0 && Array.isArray(e.ex) ? e.ex.slice(0, Number(e.n)) : [] };
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

// ══════════════════════════════════════════════════════════════════════════════
//  (10 nov., « Améliore ça » — moins de texte, du visuel) LES CARTES
// ══════════════════════════════════════════════════════════════════════════════
//  UNE carte par doute quand l'écran propriétaire a publié ses choses (`ex` : photo
//  de l'annonce par identité, N°), sinon UNE carte par source avec son nombre. Une
//  question de 12 mots au plus ; un geste : deux boutons quand le geste est binaire
//  ET interne à VRM (annulable 5 s), sinon UN bouton qui OUVRE l'endroit où il se
//  fait. Les doutes groupés par type (un titre court, un compte). Rien n'est décidé
//  ici : les nombres et leurs règles sont ceux de `lignesATrancher`.
export const TYPES = [
  { type: 'numeros', titre: 'Numéros', cles: ['numeros-double', 'numeros-a-ecrire', 'numeros-a-verifier'] },
  { type: 'colis', titre: 'Colis', cles: ['colis-postes', 'colis-retirer', 'sms-vestiaire', 'sms-pickup'] },
  { type: 'ventes', titre: 'Ventes', cles: ['litiges-en-cours'] },
  { type: 'paires', titre: 'Paires', cles: ['supprimes-vinted', 'remise-en-ligne', 'achats-sans-prix'] },
  { type: 'comptes', titre: 'Comptes', cles: ['adresses-sans-compte', 'comptes-a-relire'] },
  { type: 'compta', titre: 'Compta', cles: ['achats-doubles', 'ventes-a-dater'] },
];
// La question : `n` (carte d'une source, le nombre est dans la vignette) ou `x` (une chose).
export const QUESTIONS = {
  'numeros-double': { n: () => 'N° portés par deux paires', x: () => 'Deux paires sous ce N°' },
  'colis-postes': { n: (n) => (n > 1 ? 'Colis cochés « posté », pas vus partir' : 'Colis coché « posté », pas vu partir') },
  'colis-retirer': { n: () => 'Colis à retirer : à vérifier' },
  'litiges-en-cours': { n: (n) => (n > 1 ? 'Litiges ou retours en cours' : 'Litige ou retour en cours'), x: () => 'Litige en cours : réponds à temps' },
  'numeros-a-ecrire': { n: () => 'Nouveaux N° à écrire à leur place', x: () => 'Écris ce N° là où est la paire' },
  'numeros-a-verifier': { n: () => 'N° à vérifier sur place', x: () => 'Vérifie ce N° là où est la paire' },
  'sms-vestiaire': { n: (n) => (n > 1 ? 'Ventes Vestiaire reçues par SMS, à relier' : 'Vente Vestiaire reçue par SMS, à relier') },
  'sms-pickup': { n: () => 'Colis Pickup reçus par SMS, sans code' },
  'supprimes-vinted': { n: () => 'Supprimés de Vinted : encore chez toi ?', x: () => 'Supprimée de Vinted. Encore chez toi ?' },
  'remise-en-ligne': { n: () => 'Remises en ligne : même paire ?', x: (x) => (x.de ? `Remise en ligne : même paire que N°${x.de} ?` : 'Remise en ligne : même paire qu’une ancienne ?') },
  'achats-doubles': { n: (n) => (n > 1 ? 'Achats saisis deux fois : garde le bon' : 'Achat saisi deux fois : garde le bon') },
  'achats-sans-prix': { n: () => 'Annonces sans prix d’achat', x: () => 'Prix d’achat pas saisi' },
  'adresses-sans-compte': { n: (n) => (n > 1 ? 'Adresses e-mail sans compte relié' : 'Adresse e-mail sans compte relié') },
  'comptes-a-relire': { n: (n) => (n > 1 ? 'Comptes à relire sur Vinted' : 'Compte à relire sur Vinted') },
  'ventes-a-dater': { n: (n) => (n > 1 ? 'Ventes sans date de versement' : 'Vente sans date de versement') },
};
// Les gestes BINAIRES faits ici même : internes à VRM, réversibles (« Annuler » 5 s),
// sur UNE chose désignée par son identité. « Non » n'écrit rien : il ouvre l'écran
// où se disent les autres réponses. Seul « toujours chez moi » l'est aujourd'hui
// (la même écriture que la pilule de Ma journée, `vrm_cycle_decisions`) ; une
// remise en ligne « même paire » CHANGE un N° (§5) : elle reste dans Annonces.
export const BINAIRES = {
  'supprimes-vinted': { oui: 'Oui, chez moi', non: 'Non' },
};
export const PAR_SOURCE = 3;     // au plus 3 cartes par source, le reste « + N »
export const MOTS_MAX = 12;
export const mots = (t) => String(t || '').replace(/[«»?.:,;!]/g, ' ').split(/\s+/).filter(Boolean).length;
// La cible d'UNE chose dans l'écran propriétaire, quand il la marque (sinon le bloc).
const CIBLE_CHOSE = { 'remise-en-ligne': (x) => `[data-remise-ligne="${String(x.id).replace(/"/g, '')}"]`,
  'litiges-en-cours': (x) => `[data-litige-carte="${String(x.id).replace(/"/g, '')}"]` };
export function cartesATrancher(etat, { parSource = PAR_SOURCE } = {}) {
  if (!etat || !Array.isArray(etat.lignes)) return { groupes: [], total: 0, partiel: false, manque: [] };
  const parCle = new Map(etat.lignes.map((l) => [l.cle, l]));
  const groupes = [];
  for (const T of TYPES) {
    const sources = [];
    for (const cle of T.cles) {
      const l = parCle.get(cle);
      if (!l || !(Number(l.n) > 0)) continue;
      const Q = QUESTIONS[cle] || { n: () => l.nom };
      const ton = cle === 'numeros-double' ? 'rouge' : 'geste';
      const ex = Array.isArray(l.ex) ? l.ex : [];
      let cartes;
      if (ex.length && Q.x) {
        cartes = ex.slice(0, parSource).map((x) => ({ cle, id: x.id, num: x.num || '', photo: x.photo || '', photo2: x.photo2 || '',
          question: Q.x(x), binaire: BINAIRES[cle] || null,
          geste: CIBLE_CHOSE[cle] ? { ...l.geste, cible: CIBLE_CHOSE[cle](x) } : l.geste }));
      } else {
        cartes = [{ cle, id: '', n: l.n, question: Q.n(l.n), binaire: null, geste: l.geste, noms: l.noms || null }];
      }
      const montrees = cartes[0].id ? cartes.length : l.n;
      sources.push({ cle, n: l.n, ton, cartes, autres: Math.max(0, l.n - montrees), geste: l.geste, nom: l.nom });
    }
    if (!sources.length) continue;
    const n = sources.reduce((t, s) => t + s.n, 0);
    // Le même nombre ne s'écrit pas deux fois : une source seule, sans cartes de choses,
    // porte déjà son nombre dans sa vignette ⇒ le titre du groupe n'en remet pas.
    const compteVisible = sources.length > 1 || !!sources[0].cartes[0].id;
    groupes.push({ type: T.type, titre: T.titre, n, compteVisible, sources });
  }
  return { groupes, total: etat.total, partiel: etat.partiel, manque: etat.manque || [] };
}
// Un geste fait ici (optimiste) : la chose sort tout de suite, le nombre de sa source
// baisse d'autant — tant que la publication la porte encore (elle se recalcule ensuite
// chez son propriétaire : une chose qui n'est plus publiée ne retire plus rien).
// `tranches` : Set de « cle:id ».
export function appliquerTranches(etat, tranches) {
  if (!etat || !Array.isArray(etat.lignes) || !tranches || !tranches.size) return etat;
  let change = false;
  const lignes = etat.lignes.map((l) => {
    if (!Array.isArray(l.ex) || !l.ex.length || !Number.isInteger(l.n)) return l;
    const reste = l.ex.filter((x) => !tranches.has(`${l.cle}:${x.id}`));
    if (reste.length === l.ex.length) return l;
    change = true;
    const n = Math.max(0, l.n - (l.ex.length - reste.length));
    const src = SOURCES.find((s) => s.cle === l.cle);
    return { ...l, n, ex: reste, quoi: n > 0 && src ? src.quoi(n) : '' };
  });
  if (!change) return etat;
  const total = lignes.filter((l) => Number.isInteger(l.n)).reduce((t, l) => t + l.n, 0);
  return { ...etat, lignes, total, aTrancher: lignes.filter((l) => l.n > 0) };
}
// Les photos de la ligne de Ma journée : les premières choses publiées (identité), 3 au plus.
export const photosJournee = (etat) => (etat && Array.isArray(etat.aTrancher)
  ? etat.aTrancher.flatMap((l) => (Array.isArray(l.ex) ? l.ex.map((x) => x.photo).filter(Boolean) : [])).slice(0, 3) : []);
// Le détail de la ligne de Ma journée : les types concernés, rien d'autre.
export const typesJournee = (etat) => cartesATrancher(etat).groupes.map((g) => g.titre).join(' · ');
