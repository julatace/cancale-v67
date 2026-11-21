// ════════════════════════════════════════════════════════════════════════════
//  PUBLIER AILLEURS — LE PARCOURS GUIDÉ (5 novembre 2026, demande de Julien)
// ════════════════════════════════════════════════════════════════════════════
// « Vinted → Leboncoin, Vestiaire et eBay : beaucoup plus accompagné et
// facile » — « pro, pointilleux et fiable ». Pour UN article (son N°), et pour
// chaque site : quatre étapes VISIBLES —
//   1. Vérifier    : ce qui manque (la règle `problemesAnnonce`, §11), le geste ;
//   2. Ce qui part : le titre, le prix, les photos, la description, la
//                    référence qui porte le N° — tels qu'ils partiront ;
//   3. Publier     : le moteur EXISTANT de ce site, avec ses gardes (fiche
//                    Leboncoin `lbcPublier`, formulaire eBay, `vcPreparer`) —
//                    ce parcours n'envoie RIEN lui-même ;
//   4. Suivi       : préparée · publiée · vue en ligne.
//
// ⚠️ « VUE EN LIGNE » SE PROUVE PAR IDENTITÉ (§5) : l'annonce du site porte CE
//    N° (Leboncoin : lien posé ou référence VRM ; eBay : SKU `VRM-{n°}` ;
//    Vestiaire : lien posé, référence ou N° donné au produit) — la règle
//    `sitesDuNumero` (src/prixPartout.js), jamais un titre. Ainsi le N° est le
//    MÊME sur toutes les annonces : c'est lui qui les désigne.
// ⚠️ « PAS SU » NE VAUT PAS « NON » : une liste du site pas lue ⇒ `pas-su`
//    (jamais « à publier » : il l'a peut-être publiée à la main).
// ⚠️ eBay : l'agent eBay est arrêté (un autre lot le retire) ; ce parcours ne
//    passe QUE par le formulaire « Vendre une paire » (son clic).
//
// Module PUR : la feuille (src/PublierAilleurs.jsx), la coque et
// `scripts/audit-publier-ailleurs.cjs` exécutent CES fonctions. Les règles de
// mise en forme propres à un site (titre et description Leboncoin, description
// eBay) viennent de l'app, passées en paramètre : une seule définition.
import { problemesAnnonce } from './verifAnnonce.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);
const montant = (p) => {
  if (p == null || p === '') return null;
  const n = Number(typeof p === 'object' ? p.amount : String(p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export const SITES_PUBLIER = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
export const ETAPES_PUBLIER = Object.freeze([['verifier', 'Vérifier'], ['apercu', 'Ce qui part'], ['publier', 'Publier'], ['suivi', 'Suivi']]);
export const ETATS_PUBLIER = Object.freeze({ 'a-publier': 'À publier', preparee: 'Préparée', publiee: 'Publiée', 'vue-en-ligne': 'Vue en ligne', 'pas-su': 'En ligne ? pas su' });
const SITE_VERIF = { leboncoin: 'lbc', ebay: 'ebay', vestiaire: 'vestiaire' };
// Au plus, ce que chaque moteur attache (mesuré dans le code : `LBC_PHOTOS_MAX`
// 15 ; eBay 24 photos par annonce ; Vestiaire : l'extension prend celles de
// l'annonce — pas de plafond connu, toutes sont montrées).
export const PHOTOS_MAX = Object.freeze({ leboncoin: 15, ebay: 24, vestiaire: null });

// La référence qui porte le N° (Leboncoin, Vestiaire : dans la description ;
// eBay : le SKU). '' sans N° (rien ne part sans N°).
export const refVrm = (num) => (str(num) ? 'VRM-' + str(num) : '');

// ── 2. Ce qui part ─────────────────────────────────────────────────────────
// p : la paire telle que la source partagée la donne (`useEbayPaires`) :
//     { id, num, title, taille, marque, etat, couleur, photos, desc, prix }.
// r : { titreLbc(marque, titre, taille), titreVc(marque, titre, taille),
//       titreEbay(titre, taille), descriptionLbc({ ref, texte, marque, taille,
//       etat, couleur }), descriptionEbay(paire) } — règles de l'app.
export function apercuEnvoi(site, p, r = {}) {
  const x = p || {};
  const num = str(x.num);
  const ref = refVrm(num);
  const max = PHOTOS_MAX[site];
  const photos = arr(x.photos).map(str).filter(Boolean);
  const partent = max ? photos.slice(0, max) : photos;
  const base = { site, id: str(x.id), num, ref, prix: montant(x.prix), marque: str(x.marque), taille: str(x.taille), etat: str(x.etat),
    photos: partent, nPhotos: partent.length, photosEcartees: photos.length - partent.length };
  if (site === 'leboncoin') {
    const titre = typeof r.titreLbc === 'function' ? str(r.titreLbc(x.marque, x.title, x.taille)) : str(x.title);
    const description = typeof r.descriptionLbc === 'function' ? str(r.descriptionLbc({ ref, texte: x.desc, marque: x.marque, taille: x.taille, etat: x.etat, couleur: x.couleur })) : str(x.desc);
    return { ...base, titre, description, identite: ref ? { quoi: 'Référence', valeur: ref, ou: 'dans la description' } : null };
  }
  // (relecture du 5 nov.) « Ce qui part » = ce que le MOTEUR envoie, pas le texte Vinted brut :
  //   eBay      → le formulaire « Vendre une paire » : titre `ebayTitre(titre, taille)`,
  //               description = la description Vinted, à défaut ses FAITS (`descriptionDeFaits`) ;
  //   Vestiaire → l'extension (`annonceVestiaire` → `buildEbayAd`) : titre `lbcTitre(…, 80)`,
  //               description `descriptionLbcDe` avec « Réf. VRM-{n°} » (la référence que
  //               l'extension relit ensuite sur Vestiaire pour reconnaître l'annonce).
  if (site === 'ebay') {
    const titre = typeof r.titreEbay === 'function' ? str(r.titreEbay(x.title, x.taille)) : str(x.title);
    const description = typeof r.descriptionEbay === 'function' ? str(r.descriptionEbay(x)) : str(x.desc);
    return { ...base, titre, description, identite: ref ? { quoi: 'SKU', valeur: ref, ou: 'sur l’annonce eBay' } : null };
  }
  if (site === 'vestiaire') {
    const titre = typeof r.titreVc === 'function' ? str(r.titreVc(x.marque, x.title, x.taille)) : str(x.title);
    const description = typeof r.descriptionLbc === 'function' ? str(r.descriptionLbc({ ref, texte: x.desc, marque: x.marque, taille: x.taille, etat: x.etat, couleur: x.couleur })) : str(x.desc);
    return { ...base, titre, description, identite: ref ? { quoi: 'Référence', valeur: ref, ou: 'dans la description' } : null };
  }
  return null;
}

// ── 1. Ce qui manque ───────────────────────────────────────────────────────
// La vérification de l'app (`problemesAnnonce`, la même que celle des moteurs),
// plus ce qui bloque AVANT elle : pas de N° (aucune identité), retiré de
// Leboncoin par son choix (`mpLbc === false`, jamais remis tout seul), prix pas
// lu. `achat` : prix d'achat connu (null = pas jugé) ; `famille` : la famille
// d'article (la taille n'est jugée que pour une famille qui en porte une).
// `horsVinted` : l'article n'est plus en ligne sur Vinted (« toujours chez moi ») —
// la publication Leboncoin de VRM part d'une annonce Vinted EN LIGNE (la file
// « À publier » et l'extension lisent le dressing) : sans elle, « Publier »
// n'ouvrirait rien (relecture du 5 nov.). Le geste est dit, rien n'est deviné.
// `facultatifs` (8 nov.) : vendeur hors sneakers ⇒ taille et marque jamais jugées.
export function manquesEnvoi(site, ap, { achat = null, famille = '', mpLbc = true, horsVinted = false, facultatifs = false } = {}) {
  if (!ap) return [];
  const out = [];
  if (!ap.num) out.push({ code: 'numero', texte: 'Pas de N°', geste: 'Mets un N° à cet article d’abord (Annonces)', bloque: true });
  if (site === 'leboncoin' && mpLbc === false) out.push({ code: 'retire', texte: 'Retiré de Leboncoin par toi', geste: 'Remets la case « Leboncoin » sur la fiche de l’annonce (Annonces)', bloque: true });
  if (site === 'leboncoin' && horsVinted === true) out.push({ code: 'hors-vinted', texte: 'Plus en ligne sur Vinted', geste: `VRM publie sur Leboncoin depuis une annonce Vinted en ligne : remets-la en ligne sur Vinted, ou publie-la à la main sur leboncoin.fr avec la référence ${ap.ref || 'VRM-{n°}'}`, bloque: true });
  if (ap.prix == null) out.push({ code: 'prix-absent', texte: 'Prix pas lu', geste: 'Ouvre l’annonce sur Vinted : son prix arrive ici', bloque: false });
  for (const pb of problemesAnnonce({ titre: ap.titre, taille: ap.taille, famille, marque: ap.marque, nPhotos: ap.nPhotos, prix: ap.prix, achat, facultatifs: facultatifs === true }, SITE_VERIF[site])) {
    out.push({ ...pb, bloque: pb.code === 'photos' && !(ap.nPhotos > 0) });
  }
  return out;
}

// ── 4. L'état d'une publication ────────────────────────────────────────────
//   enLigne  : true (vue sur le site PAR IDENTITÉ) · false (liste lue, pas vue) · null (pas su)
//   job      : le travail de l'extension pour cette paire ({ etape, at }) ou null
//   marquee  : notée publiée (« Déjà publiée », fin de dépôt) : true · false · null (pas su)
//   brouillon: un brouillon eBay existe pour cette paire (préparée)
export const DUREE_DEPOT_MS = 30 * 60000;
export function etatPublication({ enLigne = null, job = null, marquee = false, brouillon = false, maintenant = Date.now() } = {}) {
  if (enLigne === true) return 'vue-en-ligne';
  if ((job && job.etape === 'fait') || marquee === true) return 'publiee';
  const recent = job && Number.isFinite(Number(job.at)) && (maintenant - Number(job.at)) >= 0 && (maintenant - Number(job.at)) < DUREE_DEPOT_MS;
  if ((recent && /^(depot|prepare|ouvert|envoi)$/.test(str(job.etape))) || brouillon === true) return 'preparee';
  if (enLigne === null || marquee === null) return 'pas-su';
  return 'a-publier';
}

// L'étape où il en est (celle qui est mise en avant) : un manque BLOQUANT ⇒
// « Vérifier » ; rien de bloquant ⇒ « Publier » ; préparée / publiée ⇒ « Suivi » ;
// vue en ligne ⇒ tout est fait.
export function etapeCourante(etat, manques) {
  if (etat === 'vue-en-ligne') return 'fini';
  if (etat === 'publiee' || etat === 'preparee') return 'suivi';
  if (arr(manques).some((m) => m && m.bloque)) return 'verifier';
  return 'publier';
}
// L'état de chaque étape pour la frise : 'fait' · 'ici' · 'a-venir' · 'a-corriger'.
export function frisePublication(etat, manques) {
  const ici = etapeCourante(etat, manques);
  const ordre = ETAPES_PUBLIER.map(([k]) => k);
  const iIci = ici === 'fini' ? ordre.length : ordre.indexOf(ici);
  const nPb = arr(manques).length;
  return ETAPES_PUBLIER.map(([k, l], i) => {
    let e = i < iIci ? 'fait' : i === iIci ? 'ici' : 'a-venir';
    if (k === 'verifier' && nPb && e !== 'a-venir') e = arr(manques).some((m) => m && m.bloque) ? 'a-corriger' : (e === 'fait' ? 'fait' : e);
    if (k === 'suivi' && etat === 'vue-en-ligne') e = 'fait';
    return { cle: k, label: l, etat: e };
  });
}

// L'état de CHAQUE site pour une paire, depuis les lectures de l'app.
//   sitesVus : sortie `sitesDuNumero(num).sites` (null = pas su) ; manquesLecture :
//   ses `manques` (les sites dont la liste n'a pas été lue : 'Leboncoin', 'eBay', 'Vestiaire').
//   jobs : `__vmrJobs` ; postes : { leboncoin: Set|null, vestiaire: Set|null } ;
//   brouillonsEbay : Set des identifiants de paires (null = pas su).
const NOM_LECTURE = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const JOB = { leboncoin: 'lbc:', vestiaire: 'vc:', ebay: null };
export function enLigneSur(site, sitesVus, manquesLecture) {
  if (!Array.isArray(sitesVus)) return null;
  if (sitesVus.some((s) => s && s.site === site)) return true;
  if (arr(manquesLecture).includes(NOM_LECTURE[site])) return null;
  return false;
}
//   publiesEbay : Set des paires dont un brouillon eBay a été MIS EN LIGNE ou programmé
//   (`programme.itemId`) ⇒ « publiée » (null = pas su).
export function etatsPaire(p, { sitesVus = null, manquesLecture = [], jobs = {}, postes = {}, brouillonsEbay = null, publiesEbay = null, maintenant = Date.now() } = {}) {
  const id = str(p && p.id);
  const out = {};
  for (const site of SITES_PUBLIER) {
    const pref = JOB[site];
    const job = pref && jobs ? jobs[pref + id] || null : null;
    const set = postes ? postes[site] : undefined;
    const marquee = site === 'ebay' ? !!(publiesEbay && typeof publiesEbay.has === 'function' && publiesEbay.has(id)) : (set == null ? null : (typeof set.has === 'function' && set.has(id)));
    const brouillon = site === 'ebay' && brouillonsEbay && typeof brouillonsEbay.has === 'function' ? brouillonsEbay.has(id) : false;
    out[site] = etatPublication({ enLigne: enLigneSur(site, sitesVus, manquesLecture), job, marquee, brouillon, maintenant });
  }
  return out;
}

// Le N° partout : les sites où CE N° est vu en ligne (Vinted compris), par identité.
export function partoutLeMeme(sitesVus) {
  const ordre = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
  const vus = new Set(arr(sitesVus).map((s) => s && s.site).filter(Boolean));
  return ordre.filter((s) => vus.has(s));
}
// Le lien de l'annonce vue (le premier, par identité) — pour « Voir l'annonce ↗ ».
export const lienVu = (site, sitesVus) => { const s = arr(sitesVus).find((x) => x && x.site === site && x.lien); return s ? s.lien : ''; };

// ── Choisir l'article ──────────────────────────────────────────────────────
// Le N° tapé d'abord (identité exacte), le titre seulement pour CHERCHER (§5 :
// chaque ligne est une paire par son identifiant, jamais rapprochée par titre).
export function chercherPaires(paires, q, cleNum = (x) => str(x).toUpperCase()) {
  const t = str(q);
  const l = arr(paires).filter((p) => p && str(p.id) && str(p.num));
  if (!t) return l;
  const k = cleNum(t.replace(/^n[°o]?\s*/i, ''));
  const exact = l.filter((p) => cleNum(p.num) === k);
  if (exact.length) return exact;
  const mots = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  return l.filter((p) => { const foin = [p.num, p.title, p.marque].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return mots.every((m) => foin.includes(m)); });
}
