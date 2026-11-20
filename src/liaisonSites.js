// ══════════════════════════════════════════════════════════════════════════
// « RELIER MES ANNONCES » — LA LIAISON GUIDÉE DES ANNONCES D'UN MÊME ARTICLE (19 nov.)
//
// Julien : « la liaison des articles entre les différentes applications […] ça doit vraiment
// être accompagné par l'application, absolument parfaitement. Ça doit être irréprochable. Il ne
// peut pas y avoir d'erreur. » — « l'outil doit être pratique, pas chiant » — et : « Ce n'est
// pas parce que Vinted est ma plateforme principale que c'est la plateforme principale des
// autres. Tout doit être parfait sur chaque application. »
//
// L'objet central est L'ARTICLE (son N° de rangement), pas l'annonce Vinted. Une annonce
// Leboncoin, eBay ou Vestiaire se relie à un ARTICLE : celui d'une annonce Vinted, ou celui
// d'une annonce d'un autre site (un vendeur sans Vinted relie son annonce Leboncoin à son
// annonce eBay). Ce lien décide QUELLE annonce VRM dit de retirer ailleurs quand l'article est
// vendu, et sous QUEL N° il est rangé : un lien faux retire la mauvaise annonce ou envoie la
// mauvaise chaussure — « mieux vaut un blanc qu'un faux » (§5).
//
// • Module PUR (aucun accès au navigateur, à la base, à l'extension) : l'app
//   (src/LiaisonSites.jsx, src/liaisonActions.js) et `scripts/audit-liaison-sites.cjs`
//   exécutent LES MÊMES fonctions (§11). Rien ici n'écrit : les fonctions `ops…` rendent des
//   OPÉRATIONS (src/gesteAnnulable.js : une sous-valeur posée, et son inverse), que l'app joue
//   par `gesteVrm` — chaque écriture relit la clé et n'y pose que SA sous-valeur ; une lecture
//   ratée n'écrit rien.
// • L'identité d'une annonce n'est JAMAIS décidée ici : l'app la lit avec ses règles
//   (`numeroLbcIdentite`, `numEbayLu`, `numVcAnnonce`, `numeroExterne` pour un N° d'avant la
//   remise à zéro) et la passe (`annonce.relie`, `annonce.numero`, `annonce.identites`,
//   `annonce.numeroSite` : le N° que l'annonce porte À ELLE SEULE).
// • Les GARDES (toutes silencieuses quand tout va bien) :
//     1. une annonce ne se relie qu'à UN article (déjà reliée ⇒ refus) ;
//     2. un article n'a qu'UNE annonce par site (sauf déclaration explicite « deux annonces ») ;
//     3. taille LUE des deux côtés et différente ⇒ refus ; lue « peut-être » dans un titre
//        (un nombre isolé, sans le mot « taille ») ⇒ UNE question qui montre les deux ;
//     4. écart de prix fort, marque différente, référence écrite sur le site qui dit un AUTRE N°
//        ⇒ UNE question qui montre les deux ;
//     5. N° porté par deux articles présents, article sans N° ⇒ refus ;
//     6. DEUX N° en jeu (l'annonce a déjà le sien, l'article a le sien) ⇒ il est DEMANDÉ lequel
//        est écrit sur le carton ; rien n'est tranché seul, l'autre N° reste servi (« à barrer ») ;
//     7. « pas su » (une carte de liens pas lue) ⇒ rien n'est écrit ;
//     8. l'ORDRE des candidates (même photo sûre, à vérifier, même taille + mêmes mots) est un
//        ordre de PROPOSITION : seule « même photo · sûr », UNIQUE et sans aucun doute, est mise
//        en avant — et c'est encore SON toucher qui relie.
// ══════════════════════════════════════════════════════════════════════════
import { tailleNorm, MOTS_VIDES } from './suggestionsAchat.js';
import { poserLienVc, lienDe, produitDeVinted } from './lienVestiaire.js';

export const SITES_LIAISON = ['Leboncoin', 'eBay', 'Vestiaire'];
// La clé synchronisée de CE parcours : { 'lien:Site:id': { numero, vinted, article, par, at, … },
// 'tard:Site:id': iso, 'propre:Site:id': { at, numero?, actif? }, 'garde:<contradiction>': { at, choix } }.
export const CLE_LIAISON = 'vrm_liaison_sites';
export const CLES_LIENS = { Leboncoin: 'vrm_lbc_liens', eBay: 'vrm_ebay_liens', Vestiaire: 'vrm_vc_liens' };
// La preuve d'un lien (dite sur l'annonce et dans le parcours).
export const PREUVES = ['photo-sure', 'photo', 'recherche', 'relecture'];
// « Écart de prix fort » : le plus cher vaut au moins le DOUBLE de l'autre ET 20 € de plus.
// Mesuré le 19 nov. sur les 4 liens réels lisibles (lecture seule) : rapports 1,00 · 1,07 · 1,10 ·
// 1,62 (24 €) — aucun vrai lien ne déclenche la question à 2.
export const PRIX_RAPPORT_FORT = 2;
export const PRIX_ECART_MIN = 20;
// Les pistes « publiée par VRM sur ce site » : au-delà, une liste ne désigne plus personne.
export const PISTES_MAX = 6;

const arr = (a) => (Array.isArray(a) ? a : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const cleDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const sansAccent = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nombre = (v) => { const n = typeof v === 'number' ? v : Number(String(v == null ? '' : (objet(v) ? (v.amount != null ? v.amount : v.valeur != null ? v.valeur : v.value) : v)).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };

export const cleAnnonce = (a) => `${a.plateforme}:${a.id}`;
export const cleJournal = (sorte, a) => `${sorte}:${typeof a === 'string' ? a : cleAnnonce(a)}`;

// ── LA TAILLE ─────────────────────────────────────────────────────────────
// Rend { taille, sure }.
//  · un CHAMP du site (la taille de la fiche Vinted, un attribut) : « 42 », « 42,5 », « M »,
//    « L / 40 / 12 » ⇒ sûre ;
//  · un TITRE : après « taille / pointure / size / EU / T. » ⇒ sûre ; un nombre isolé 34–52,
//    SEUL de son espèce dans le titre ⇒ « peut-être » (`sure: false` : « Pegasus 40 » est un
//    modèle, pas une pointure) ; deux nombres possibles ⇒ pas lue.
const lettreDe = (t) => { const m = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/.exec(String(t || '').trim().toUpperCase().replace(/^2XL$/, 'XXL').replace(/^3XL$/, 'XXXL')); return m ? m[1] : ''; };
export function tailleLue(texte, { champ = false } = {}) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut) return { taille: '', sure: false };
  if (champ) {
    const premier = brut.split('/')[0].trim();
    const l = lettreDe(premier);
    if (l) return { taille: l, sure: true };
    // « 6 ans / 116 cm », « Taille unique » : pas une pointure.
    if (/\b(ans|mois|cm|unique)\b/i.test(brut)) return { taille: '', sure: false };
    const n = tailleNorm(premier) || tailleNorm(brut);
    return n ? { taille: n, sure: true } : { taille: '', sure: false };
  }
  const t = sansAccent(brut);
  const apres = /(?:\btaille|\bpointure|\bsize|\bmaat|\bgr\.?|\beu|\bfr|\bt\.?)\s*[.:]?\s*((?:3[4-9]|4[0-9]|5[0-2])(?:\s*[12]\s*\/\s*3|\s*[.,]\s*5|\s*½)?)(?![0-9])/.exec(t);
  if (apres) { const n = tailleNorm(apres[1]); if (n) return { taille: n, sure: true }; }
  const lettre = /(?:\btaille|\bsize)\s*[.:]?\s*(xxs|xs|s|m|l|xl|xxl|xxxl)\b/.exec(t);
  if (lettre) return { taille: lettre[1].toUpperCase(), sure: true };
  const vus = new Set();
  const re = /(?:^|[^0-9.,/])((?:3[4-9]|4[0-9]|5[0-2])(?:\s+[12]\s*\/\s*3|[.,]5|½)?)(?![0-9/])/g;
  for (let m = re.exec(t); m; m = re.exec(t)) { const n = tailleNorm(m[1]); if (n) vus.add(n); }
  return vus.size === 1 ? { taille: [...vus][0], sure: false } : { taille: '', sure: false };
}
// La taille d'une annonce ou d'un article : son champ d'abord, son titre sinon.
export function tailleDe(x) {
  if (!x) return { taille: '', sure: false };
  const c = tailleLue(x.taille, { champ: true });
  return c.taille ? c : tailleLue(x.titre);
}
// 'egales' · 'differentes' (lues sûres des deux côtés) · 'doute' (différentes, l'une « peut-être ») · 'inconnu'.
export function comparerTailles(a, p) {
  const ta = tailleDe(a), tp = tailleDe(p);
  if (!ta.taille || !tp.taille) return { verdict: 'inconnu', annonce: ta.taille, paire: tp.taille, sures: false };
  if (ta.taille === tp.taille) return { verdict: 'egales', annonce: ta.taille, paire: tp.taille, sures: ta.sure && tp.sure };
  return { verdict: ta.sure && tp.sure ? 'differentes' : 'doute', annonce: ta.taille, paire: tp.taille, sures: ta.sure && tp.sure };
}

// ── LE PRIX, LA MARQUE, LES MOTS ───────────────────────────────────────────
export function ecartPrixFort(pa, pp) {
  const a = nombre(pa), p = nombre(pp);
  if (a == null || p == null) return false;
  const haut = Math.max(a, p), bas = Math.min(a, p);
  return haut >= bas * PRIX_RAPPORT_FORT && haut - bas >= PRIX_ECART_MIN;
}
// Deux marques LUES des deux côtés et différentes (« Nike SB » et « Nike » : la même).
export function marquesDifferentes(a, p, marqueDe) {
  if (typeof marqueDe !== 'function') return false;
  const lire = (x) => sansAccent((x && x.marque && (marqueDe(String(x.marque)) || x.marque)) || marqueDe(String((x && x.titre) || '')) || '').trim();
  const ma = lire(a), mp = lire(p);
  if (!ma || !mp) return false;
  return !(ma === mp || ma.includes(mp) || mp.includes(ma));
}
// Les mots d'un titre qui disent l'article (marque, modèle, couleur) : hors mots vides et tailles.
export function motsTitre(titre) {
  const out = new Set();
  for (const w of sansAccent(titre).replace(/[^a-z0-9]+/g, ' ').split(' ')) {
    if (!w || w.length < 2 || MOTS_VIDES.has(w) || /^(3[4-9]|4[0-9]|5[0-2])$/.test(w)) continue;
    out.add(w);
  }
  return out;
}
// LA PROXIMITÉ d'un article avec une annonce — pour ORDONNER les candidates (jamais pour relier,
// jamais pour mettre en avant) : la même taille d'abord (lue sûre des deux côtés : 20, « peut-être » :
// 10), puis le nombre de mots communs du titre. Une taille différente passe derrière tout.
export function proximite(annonce, article) {
  const t = comparerTailles(annonce, article);
  const ma = motsTitre(annonce && annonce.titre), mp = motsTitre(article && article.titre);
  let communs = 0; for (const w of ma) if (mp.has(w)) communs++;
  const taille = t.verdict === 'egales' ? (t.sures ? 20 : 10) : t.verdict === 'inconnu' ? 0 : -50;
  return taille + communs;
}

// ── LES ARTICLES ──────────────────────────────────────────────────────────
// Ce à quoi une annonce peut se relier : un ARTICLE = un N° et l'annonce qui le porte.
//  · `paires` : ses annonces Vinted PRÉSENTES qui ont un N° (origine 'Vinted') ;
//  · chaque annonce d'un AUTRE site qui porte un N° qu'aucune annonce Vinted présente ne porte
//    (son N° à elle, ou son identité) : un article aussi (origine = son site, `vinted: ''`).
// Rend [{ id, numero, titre, photo, taille, prix, marque, compte, compteNom, place, origine, vinted }].
export function articlesDe({ paires = [], autres = [], cle = cleDefaut } = {}) {
  const out = [], vus = new Set();
  for (const p of arr(paires)) {
    if (!p || p.id == null) continue;
    out.push({ ...p, id: String(p.id), origine: p.origine || 'Vinted', vinted: p.vinted != null ? String(p.vinted) : String(p.id) });
    const k = cle(p.numero || ''); if (k) vus.add(k);
  }
  for (const a of arr(autres)) {
    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme) || a.enVente === false) continue;
    const brut = String(a.numero || a.numeroSite || '').trim();
    const k = cle(brut); if (!k || vus.has(k)) continue;
    vus.add(k);
    out.push({ id: cleAnnonce(a), numero: brut, titre: a.titre || '', photo: a.photo || null, taille: a.taille || '', prix: a.prix != null ? a.prix : null, marque: a.marque || '',
      compte: a.compte || '', compteNom: a.compteNom || '', place: a.place || '', origine: a.plateforme, vinted: '' });
  }
  return out;
}
// L'annonce Vinted d'un article ('' : un article sans Vinted). Un objet sans `origine` ni `vinted` est une
// paire Vinted lue telle quelle (son `id` est celui de l'annonce Vinted).
export const vintedDe = (article) => (!article ? '' : article.vinted != null ? String(article.vinted) : article.origine && article.origine !== 'Vinted' ? '' : String(article.id == null ? '' : article.id));
// Une annonce Leboncoin à qui VRM a donné SON N° (« que sur ce site ») le porte dans la carte des
// liens (`vrm_lbc_liens`, l'identité que toute l'app lit) : l'app la dit donc « reliée ». Le journal
// (`propre:… .numero`) dit que ce N° est le SIEN : elle n'est reliée à aucun AUTRE article.
// (19 nov.) Le N° que l'annonce porte À ELLE SEULE : celui que le parcours lui a donné (« que sur ce site », journal) ou
// celui que l'écran Annonces lui a donné tout seul (src/articles/numerosSites.js : `vrm_articles_sites[« Site:id »].numero`,
// `auto`). Ce N° n'est un lien vers AUCUN autre article : ni « reliée », ni déliable (délier lui retirerait son carton).
export function numeroPropre({ journal = {}, faits = {} } = {}, plateforme, id, cle = cleDefaut) {
  const k = `${plateforme}:${id}`;
  const pr = objet((objet(journal) || {})[cleJournal('propre', k)]);
  if (pr && cle(pr.numero || '')) return String(pr.numero).trim();
  const f = objet((objet(faits) || {})[k]), nf = f && objet(f.numero);
  return nf && nf.auto && cle(nf.valeur || '') ? String(nf.valeur).trim() : '';
}
export function annonceLue(a, journal, cle = cleDefaut, faits = {}) {
  if (!a || !['Leboncoin', 'eBay'].includes(a.plateforme) || !a.relie) return a;
  const propre = numeroPropre({ journal, faits }, a.plateforme, a.id, cle);
  const n = propre ? cle(propre) : '';
  if (!n || cle(a.numero || '') !== n) return a;
  return { ...a, relie: false, numero: '', numeroSite: propre, identites: arr(a.identites).filter((i) => !(i && i.sorte === 'lien' && cle(i.numero || '') === n)).concat([{ sorte: 'vrm', numero: n }]) };
}

// ── JUGER UN LIEN (avant tout toucher qui relie, et ENCORE à l'écriture) ─────────────
// `annonce` : { plateforme, id, compte, titre, taille?, prix?, marque?, relie, numero, numeroSite?, identites? }
// `paire`   : l'ARTICLE visé ({ id, numero, titre, taille?, prix?, marque?, origine, vinted })
// `autres`  : toutes ses annonces des autres sites (pour « un article, une annonce par site ») ;
// `accepte` : { plusieurs: true } (il a déclaré « le même article en deux annonces »),
//             { doutes: true } (il a confirmé la question prix / marque / taille « peut-être »),
//             { garder: 'N°' } (deux N° en jeu : celui qu'IL dit écrit sur le carton).
// Rend { ok: true, numero, garde, barre, doutes, plusieurs } · { ok: false, refus, … } ·
//      { ok: false, demander: 'numero', numeros: [N° de l'article, N° de l'annonce] } ·
//      { ok: false, confirmer: [...], … }.
export function jugerLien({ annonce, paire, autres = [], numerosDouteux = null, cle = cleDefaut, marqueDe = null, accepte = {} } = {}) {
  if (!annonce || annonce.id == null || !SITES_LIAISON.includes(annonce.plateforme) || !paire || paire.id == null) return { ok: false, refus: 'identite' };
  if (String(paire.id) === cleAnnonce(annonce)) return { ok: false, refus: 'identite' };
  // 1. Une annonce ne se relie qu'à UN article.
  if (annonce.relie || cle(annonce.numero || '')) return { ok: false, refus: 'annonce-reliee', numero: cle(annonce.numero || '') };
  const n = cle(paire.numero || '');
  if (!n) return { ok: false, refus: 'sans-numero' };
  // 5. Deux articles présents sous ce N° : il ne désigne personne.
  const douteux = numerosDouteux instanceof Set ? numerosDouteux : new Set(arr(numerosDouteux).map((x) => cle(x)));
  if (douteux.has(n)) return { ok: false, refus: 'numero-double', numero: n };
  // 3. La taille.
  const t = comparerTailles(annonce, paire);
  if (t.verdict === 'differentes') return { ok: false, refus: 'taille', tailleAnnonce: t.annonce, taillePaire: t.paire, numero: n };
  // 2. Un article n'a qu'UNE annonce par site.
  const prise = arr(autres).find((x) => x && x.plateforme === annonce.plateforme && String(x.id) !== String(annonce.id) && x.enVente !== false && cle(x.numero || x.numeroSite || '') === n);
  if (prise && !(accepte && accepte.plusieurs)) return { ok: false, refus: 'paire-prise', autre: prise, numero: n, declarable: annonce.plateforme !== 'Vestiaire' };
  // 6. DEUX N° en jeu : il est demandé lequel est écrit sur le carton.
  const a = cle(annonce.numeroSite || '');
  let garde = n, barre = '';
  if (a && a !== n) {
    const g = cle((accepte && accepte.garder) || '');
    if (g !== n && g !== a) return { ok: false, demander: 'numero', numeros: [n, a], numero: n };
    if (douteux.has(a)) return { ok: false, refus: 'numero-double', numero: a };
    garde = g; barre = g === n ? a : n;
    // Garder le N° de l'annonce quand l'article a une annonce Vinted : son N° vit sur la fiche
    // Vinted (prix d'achat, case du stock y sont attachés) — il se change là, pas ici.
    if (g === a && vintedDe(paire)) return { ok: false, refus: 'garder-vinted', numero: n, garder: a };
  }
  // 4. Les vrais doutes : UNE question, qui montre les deux.
  const doutes = [];
  if (t.verdict === 'doute') doutes.push('taille');
  if (ecartPrixFort(annonce.prix, paire.prix)) doutes.push('prix');
  if (marquesDifferentes(annonce, paire, marqueDe)) doutes.push('marque');
  // L'annonce porte, ÉCRITE sur son site (référence Leboncoin, SKU eBay), un AUTRE N° que celui de l'article.
  const ecrits = arr(annonce.identites).filter((i) => i && i.sorte === 'reference' && cle(i.numero || '')).map((i) => cle(i.numero));
  const ecritAutre = ecrits.find((x) => x !== n && x !== a) || '';
  if (ecritAutre) doutes.push('reference');
  if (doutes.length && !(accepte && accepte.doutes)) return { ok: false, confirmer: doutes, numero: n, tailleAnnonce: t.annonce, taillePaire: t.paire, numeroEcrit: ecritAutre };
  return { ok: true, numero: n, garde, barre, doutes, plusieurs: !!prise };
}

// ── LES CANDIDATES ET LA FILE ──────────────────────────────────────────────
// `autres`    : ses annonces Leboncoin / eBay / Vestiaire, telles que l'app les lit
//               ({ …, relie, numero, numeroSite, identites: [{ sorte, numero }], enVente: true|false|null }) ;
//               `null` ⇒ pas lues ;
// `paires`    : ses annonces Vinted PRÉSENTES avec un N° ({ id, numero, titre, photo, taille, prix,
//               marque, compte, compteNom, place }) ; `null` ⇒ pas lues (pas su ≠ aucune) ; `[]` ⇒
//               aucune (un vendeur sans Vinted : ses annonces se relient entre elles) ;
// `memePhoto` : la sortie de `propositionsMemePhoto` (src/memePhoto.js), ou null (pas lue : aucune
//               candidate par photo, la recherche reste) ;
// `journal`   : `vrm_liaison_sites` ;
// `pistes`    : { Leboncoin|eBay|Vestiaire: [N°…] } — les articles que VRM a PUBLIÉS sur ce site et
//               dont aucune annonce lue ne porte le N° (la référence n'a pas été relue, l'identifiant
//               de l'annonce créée n'a pas été gardé). Un FAIT (VRM l'a publiée là), pas une
//               ressemblance : montrées « à vérifier », jamais mises en avant ; plus de
//               `PISTES_MAX` pour un site ⇒ aucune (une liste trop longue ne désigne personne).
// Rend { lu, entrees, file, relies, propres, articles, compteur, parCle, contradictions }.
//   entrée = { cle, annonce, etat: 'aRelier'|'relie'|'aVerifier'|'propre', numero, numeroSite, plusTard,
//              taille, candidats: [{ paire, niveau: 'sur'|'verifier', raison, photoAutre, photoVinted, jugement }],
//              ambigu, avant: idArticle | null }
//   `avant` : la SEULE candidate mise en avant — « même photo · sûr », unique, sans aucun doute,
//   sans refus, sans deuxième N°. Jamais posée sur une ressemblance, jamais reliée sans son toucher.
export function construireLiaison({ autres = null, paires = null, memePhoto = null, journal = {}, faits = {}, numerosDouteux = null, numerosConnus = null, cle = cleDefaut, marqueDe = null, pistes = null } = {}) {
  const vide = { lu: false, entrees: [], file: [], relies: [], propres: [], articles: [], contradictions: [], compteur: { aRelier: 0, surs: 0, aVerifier: 0, plusTard: 0, contradictions: 0 }, parCle: new Map() };
  if (!Array.isArray(autres) || !Array.isArray(paires)) return vide;
  const J = objet(journal) || {};
  autres = autres.map((a) => annonceLue(a, J, cle, faits));
  const articles = articlesDe({ paires, autres, cle });
  const parId = new Map(), parNum = new Map();
  for (const p of articles) {
    parId.set(String(p.id), p);
    const k = cle(p.numero || ''); if (k) { if (!parNum.has(k)) parNum.set(k, []); parNum.get(k).push(p); }
  }
  // Les candidates par photo : la proposition seule, ou chaque paire d'un cas ambigu.
  const photo = new Map();
  const M = memePhoto && memePhoto.lu ? memePhoto : null;
  const paireDe = (x) => { const v = arr(x.vinted)[0] || {}; return (v.id != null && parId.get(String(v.id))) || (parNum.get(cle(x.numero || '')) || [])[0] || null; };
  if (M) {
    for (const p of arr(M.propositions)) {
      const paire = paireDe(p); if (!paire) continue;
      photo.set(p.id, { ambigu: false, candidats: [{ paire, niveau: p.etat === 'sur' ? 'sur' : 'verifier', raison: p.etat === 'sur' ? null : (p.raison || 'pas-mesure'), photoAutre: p.photoAutre || '', photoVinted: p.photoVinted || '' }] });
    }
    for (const x of arr(M.ambigus)) {
      if (x.raison === 'sans-numero') continue;
      const cs = [];
      for (const p of arr(x.paires)) { const paire = paireDe(p); if (paire && !cs.some((c) => c.paire === paire)) cs.push({ paire, niveau: 'verifier', raison: x.raison, photoAutre: p.photoAutre || '', photoVinted: p.photoVinted || '' }); }
      if (cs.length) photo.set(x.id, { ambigu: true, candidats: cs });
    }
  }
  const litiges = contradictions({ autres, paires, journal: J, faits, numerosConnus, cle, marqueDe });
  const enLitige = new Set(); for (const c of litiges) for (const a of c.annonces) enLitige.add(cleAnnonce(a));
  const entrees = [];
  for (const a of autres) {
    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme)) continue;
    const k = cleAnnonce(a);
    const lien = objet(J[cleJournal('lien', k)]);
    // « Reliée » = elle désigne un N°. Une annonce dite « pas d'article à relier » par l'ancien écran Leboncoin (reliée, sans N°) : « que sur ce site ».
    const relie = !!cle(a.numero || ''), sansArticle = !!a.relie && !relie;
    // Deux articles réunis sous le N° de CETTE annonce : elle garde son N° (rien ne change sur son site), le journal le dit.
    const reunie = !relie && !!lien && !!cle(a.numeroSite || '') && cle(lien.numero || '') === cle(a.numeroSite || '');
    const pr = objet(J[cleJournal('propre', k)]);
    const propre = !relie && !reunie && (sansArticle || (!!pr && pr.actif !== false));
    const libre = !relie && !reunie && !propre;
    const ph = libre ? photo.get(k) : null;
    // Chaque candidate porte SON jugement (la carte montre une taille différente en ambre, sans phrase).
    const candidats = ph ? ph.candidats.map((c) => ({ ...c, jugement: jugerLien({ annonce: a, paire: c.paire, autres, numerosDouteux, cle, marqueDe }) })).filter((c) => !['identite', 'sans-numero', 'annonce-reliee'].includes(c.jugement.refus)) : [];
    let avant = null;
    if (candidats.length === 1 && !ph.ambigu && candidats[0].niveau === 'sur') {
      const j = candidats[0].jugement;
      if (j.ok && !j.doutes.length && !j.plusieurs && !j.barre) avant = String(candidats[0].paire.id);
    }
    // (19 nov.) Le N° ÉCRIT sur l'annonce (SKU eBay, référence Leboncoin) que les règles d'identité n'ont pas pu croire
    // (fiche numérotée APRÈS la publication — panne du 11–18 oct. —, N° porté ailleurs…) : l'article qui porte ce N°
    // aujourd'hui est proposé « à vérifier », jamais mis en avant, jamais relié sans SON toucher.
    if (libre) {
      const ecrits = [...new Set(arr(a.identites).filter((i) => i && i.sorte === 'reference').map((i) => cle(i.numero || '')).filter(Boolean))];
      for (const x of ecrits) {
        const ps = parNum.get(x) || [];
        if (ps.length !== 1) continue;                                                      // aucun ou plusieurs articles sous ce N° : rien proposé
        const paire = ps[0];
        if (!paire || String(paire.id) === k || candidats.some((c) => c.paire === paire)) continue;
        const jugement = jugerLien({ annonce: a, paire, autres, numerosDouteux, cle, marqueDe });
        if (jugement.refus && jugement.refus !== 'numero-double') continue;
        candidats.push({ paire, niveau: 'verifier', raison: 'reference', photoAutre: '', photoVinted: '', jugement });
      }
    }
    // Les pistes « publiée par VRM sur ce site » : après la photo, jamais mises en avant.
    if (libre) {
      const l = arr(objet(pistes) && pistes[a.plateforme]).map((x) => cle(x)).filter(Boolean);
      const pris = numerosPris(autres, a.plateforme, cle);
      const libres = [...new Set(l)].filter((x) => !pris.has(x) && parNum.has(x));
      if (libres.length && libres.length <= PISTES_MAX) for (const x of libres) {
        const paire = (parNum.get(x) || [])[0];
        if (!paire || String(paire.id) === k || candidats.some((c) => c.paire === paire)) continue;
        const jugement = jugerLien({ annonce: a, paire, autres, numerosDouteux, cle, marqueDe });
        if (jugement.refus && jugement.refus !== 'numero-double') continue;
        candidats.push({ paire, niveau: 'verifier', raison: 'publiee', photoAutre: '', photoVinted: '', jugement });
      }
    }
    entrees.push({
      cle: k, annonce: a, etat: enLitige.has(k) ? 'aVerifier' : relie || reunie ? 'relie' : propre ? 'propre' : 'aRelier',
      numero: relie ? cle(a.numero || '') : (reunie || propre ? cle(a.numeroSite || '') : ''), numeroSite: cle(a.numeroSite || ''),
      preuve: relie || reunie ? ((lien && lien.par) || (arr(a.identites)[0] || {}).sorte || '') : '', lieLe: (relie || reunie) && lien ? lien.at || '' : '',
      plusTard: libre && !!J[cleJournal('tard', k)], taille: tailleDe(a), candidats, ambigu: !!(ph && ph.ambigu), avant,
    });
  }
  const rang = (e) => (e.plusTard ? 3 : e.avant ? 0 : e.candidats.length ? 1 : 2);
  const ordre = (x, y) => rang(x) - rang(y) || SITES_LIAISON.indexOf(x.annonce.plateforme) - SITES_LIAISON.indexOf(y.annonce.plateforme) || String(x.annonce.id).localeCompare(String(y.annonce.id), 'fr', { numeric: true });
  const file = entrees.filter((e) => e.etat === 'aRelier').sort(ordre);
  const parCle = new Map(entrees.map((e) => [e.cle, e]));
  return {
    lu: true, entrees, file, parCle, articles, autres, contradictions: litiges,
    relies: entrees.filter((e) => e.etat === 'relie'), propres: entrees.filter((e) => e.etat === 'propre'),
    compteur: { aRelier: file.length, surs: file.filter((e) => e.avant).length, aVerifier: file.filter((e) => !e.avant && e.candidats.length).length, plusTard: file.filter((e) => e.plusTard).length, contradictions: litiges.length },
  };
}
// Les « sûres » du lot « Relier les N sûres » : celles mises en avant, hors « plus tard ».
export const sursDuLot = (res) => (res && res.lu ? res.file.filter((e) => e.avant && !e.plusTard) : []);

// ── LES CANDIDATES À MONTRER (la grille « photo contre photo », la recherche) ───────────────
// Un ORDRE de proposition (jamais un lien, jamais une mise en avant) :
//   0. le N° tapé exactement ;  1. « même photo · sûr » ;  2. « même photo · à vérifier » ;
//   3. « publiée par VRM sur ce site » ;  4. les autres, du plus PROCHE au moins proche (la même
//      taille, puis les mots communs du titre — `proximite`), à égalité par N°.
// 50 articles au même titre et à la même taille sont donc à égalité : ils sortent dans l'ordre de
// leurs N°, aucun n'est choisi pour lui.
// `q` : sa recherche (N°, titre, taille) ; `taille` : la puce « Taille 42 » (ne garde que cette
// taille, hors candidates par photo) ; les articles qui ont déjà une annonce sur CE site sortent
// de la liste par défaut (toujours trouvables en tapant leur N°).
export function candidatesPour(entree, articles, { q = '', taille = '', autres = [], cle = cleDefaut } = {}) {
  if (!entree || !entree.annonce) return [];
  const a = entree.annonce;
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const numTape = mots.map((m) => { const x = /^n?°?([a-z]{0,3}\d{1,6})$/.exec(m); return x ? cle(x[1]) : ''; }).filter(Boolean);
  const prises = numerosPris(autres, a.plateforme, cle);
  const parPhoto = new Map(arr(entree.candidats).map((c) => [String(c.paire.id), c]));
  const out = [];
  for (const p of arr(articles)) {
    if (!p || p.id == null || String(p.id) === entree.cle) continue;
    const k = cle(p.numero || ''); if (!k) continue;
    const c = parPhoto.get(String(p.id)) || null;
    const exact = numTape.includes(k);
    if (!mots.length) {
      if (!c && prises.has(k)) continue;
      if (!c && taille && tailleDe(p).taille !== taille) continue;
    } else if (!exact) {
      const texte = sansAccent([p.titre, p.marque, p.taille, p.compteNom, p.origine, 'n' + k, 'n°' + k, k].join(' '));
      if (!mots.every((m) => texte.includes(m))) continue;
    }
    const rang = exact ? 0 : c ? (c.niveau === 'sur' ? 1 : c.raison === 'publiee' ? 3 : 2) : 4;
    out.push({ paire: p, exact, niveau: c ? c.niveau : '', raison: c ? c.raison : null, photoAutre: c ? c.photoAutre : '', photoVinted: c ? c.photoVinted : '', rang, proche: proximite(a, p) });
  }
  out.sort((x, y) => x.rang - y.rang || y.proche - x.proche || String(x.paire.numero || '').localeCompare(String(y.paire.numero || ''), 'fr', { numeric: true }) || String(x.paire.id).localeCompare(String(y.paire.id)));
  return out;
}
// Les N° (clé) qui ont déjà une annonce sur ce site.
export function numerosPris(autres, plateforme, cle = cleDefaut) {
  const s = new Set();
  for (const a of arr(autres)) if (a && a.plateforme === plateforme && a.enVente !== false) { const k = cle(a.numero || a.numeroSite || ''); if (k) s.add(k); }
  return s;
}

// ── LES OPÉRATIONS (src/gesteAnnulable.js) ──────────────────────────────────
// `cartes` : les valeurs COURANTES, relues au moment du geste — { lbc, ebay, vc, journal } ;
// l'une `undefined` / `null` ⇒ PAS SU ⇒ refus 'pas-su', RIEN n'est écrit.
const carteLue = (c) => (c === undefined || c === null ? null : objet(c) || null);
function cartesLues(cartes) {
  const C = { lbc: carteLue(cartes && cartes.lbc), ebay: carteLue(cartes && cartes.ebay), vc: carteLue(cartes && cartes.vc), journal: carteLue(cartes && cartes.journal),
    // Les N° donnés par l'écran Annonces (`vrm_articles_sites`) : passés ⇒ ils doivent être LUS (pas su ⇒ rien) ; absents ⇒ aucun.
    faits: cartes && 'faits' in cartes ? carteLue(cartes.faits) : {} };
  return C.lbc && C.ebay && C.vc && C.journal && C.faits ? C : null;
}
// Le lien POSÉ DANS VRM pour cette annonce (vers un article partagé), ou null. Le N° qu'une
// annonce Leboncoin porte à elle seule (« que sur ce site », rangé comme son lien) n'en est pas un.
const dejaLie = (plateforme, id, C, cle) => {
  if (plateforme === 'Leboncoin') {
    const v = C.lbc[String(id)];
    if (v == null || !String(v).trim()) return null;
    const propre = numeroPropre(C, 'Leboncoin', id, cle);
    return propre && cle(propre) === cle(v) ? null : { numero: String(v) };
  }
  if (plateforme === 'eBay') { const v = objet(C.ebay[String(id)]); return v && (v.pairId || (v.article === true && cle(v.numero || ''))) ? v : null; }
  return lienDe(C.vc, id);
};
// L'opération qui fait porter le N° `numero` à UNE annonce, sur son site. `article` : l'article dont
// c'est le N° quand il a une annonce Vinted (`article.vinted`) ; null / sans Vinted : le N° seul.
// Rend { op } ou { refus }.
function opPorter({ annonce, numero, article, de = '', preuve, C, cle, maintenant }) {
  const id = String(annonce.id);
  const vinted = vintedDe(article);
  const parVinted = !!(vinted && cle(article.numero || '') === cle(numero));
  if (annonce.plateforme === 'Leboncoin') return { op: { k: CLES_LIENS.Leboncoin, type: 'cle', id, apres: String(numero), avant: C.lbc[id] } };
  if (annonce.plateforme === 'eBay') {
    const at = Date.parse(maintenant) || Date.now();
    // Sans annonce Vinted : `{ numero, article: true }` (lu par `numEbayLu`, App.jsx — le N° de l'article, sans fiche Vinted).
    return { op: { k: CLES_LIENS.eBay, type: 'cle', id, avant: C.ebay[id], apres: parVinted ? { pairId: vinted, numero: String(numero), at, par: preuve } : { numero: String(numero), article: true, at, par: preuve } } };
  }
  if (!/^[\w-]{1,40}$/.test(id)) return { refus: 'identite' };
  if (parVinted) {
    const r = poserLienVc({ liens: C.vc, productId: id, item: vinted, numeroVinted: String(numero), numeroVc: de, cleNum: cle, maintenant });
    if (r.refus) return { refus: r.refus === 'vinted-deja-relie' ? 'paire-prise' : r.refus === 'deja-relie' ? 'annonce-reliee' : r.refus, autreId: r.refus === 'vinted-deja-relie' ? produitDeVinted(C.vc, vinted) : undefined };
    return { op: { k: CLES_LIENS.Vestiaire, type: 'cle', id, apres: { ...r.liens[id], par: preuve }, avant: C.vc[id] } };
  }
  // Un article sans annonce Vinted : la même carte, sans `item` (lue par `lienDe` et `numerosVcAvecLiens`).
  return { op: { k: CLES_LIENS.Vestiaire, type: 'cle', id, apres: { numero: String(numero), item: '', de: de && cle(de) !== cle(numero) ? String(de) : '', at: maintenant, ecrit: null, par: preuve }, avant: C.vc[id] } };
}
// RELIER, sur SON toucher. Rend { ops, numero, entree, barre } ou { refus, … } / { confirmer, … } /
// { demander: 'numero', numeros }. Le jugement est REFAIT ici, sur les cartes courantes : une
// feuille périmée ne relie rien.
export function opsRelier({ annonce, paire, preuve = 'recherche', cartes, autres = [], numerosDouteux = null, cle = cleDefaut, marqueDe = null, accepte = {}, numeroVc = '', maintenant = new Date().toISOString() } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null || !paire) return { refus: 'identite' };
  annonce = annonceLue(annonce, C.journal, cle, C.faits);
  const id = String(annonce.id), k = cleAnnonce(annonce);
  const deja = dejaLie(annonce.plateforme, id, C, cle);
  if (deja) return { refus: 'annonce-reliee', numero: cle(deja.numero || '') };
  const j = jugerLien({ annonce, paire, autres, numerosDouteux, cle, marqueDe, accepte });
  if (!j.ok) { const { ok: _ok, ...reste } = j; return reste; }
  if (!PREUVES.includes(preuve)) return { refus: 'identite' };
  const ops = [];
  const numero = j.garde === j.numero ? String(paire.numero).trim() : String(annonce.numeroSite).trim();
  if (j.garde === j.numero) {
    // Le N° de l'ARTICLE reste : l'annonce le porte (son N° à elle, s'il y en avait un, est « à barrer »).
    const r = opPorter({ annonce, numero, article: paire, de: String(annonce.numeroSite || numeroVc || ''), preuve, C, cle, maintenant });
    if (!r.op) return { refus: r.refus, autreId: r.autreId, numero: j.numero };
    ops.push(r.op);
  } else {
    // Le N° de l'ANNONCE reste (écrit sur le carton) : chaque annonce de l'autre article le prend.
    const autresDuN = arr(autres).filter((x) => x && SITES_LIAISON.includes(x.plateforme) && cleAnnonce(x) !== k && x.enVente !== false && cle(x.numero || x.numeroSite || '') === j.numero);
    for (const x of autresDuN) {
      // Une référence ÉCRITE sur Vestiaire passe devant tout lien : elle ne se change que là-bas.
      if (x.plateforme === 'Vestiaire' && arr(x.identites).some((i) => i && ['reference', 'publication'].includes(i.sorte))) return { refus: 'ecrit-sur-le-site', autre: x, numero: j.numero };
      const r = opPorter({ annonce: x, numero, article: null, de: String(paire.numero).trim(), preuve, C, cle, maintenant });
      if (!r.op) return { refus: r.refus, numero: j.numero };
      ops.push(r.op);
      ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', x), apres: { numero, vinted: '', article: k, par: preuve, at: maintenant, de: j.numero }, avant: C.journal[cleJournal('lien', x)] });
    }
  }
  const entree = { numero, vinted: vintedDe(paire), article: String(paire.id), par: preuve, at: maintenant, ...(j.barre ? { de: j.barre } : {}), ...(j.plusieurs ? { plusieurs: true } : {}), ...(j.doutes.length ? { doutes: j.doutes } : {}) };
  ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: entree, avant: C.journal[cleJournal('lien', k)] });
  if (C.journal[cleJournal('tard', k)] !== undefined) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('tard', k), apres: undefined, avant: C.journal[cleJournal('tard', k)] });
  // « Que sur ce site » : la marque tombe ; si elle porte le N° donné à l'annonce, ce N° reste noté (délier le lui rend).
  const pr = objet(C.journal[cleJournal('propre', k)]);
  if (pr) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('propre', k), apres: pr.numero ? { ...pr, actif: false } : undefined, avant: pr });
  return { ops, numero: j.garde, entree, doutes: j.doutes, plusieurs: j.plusieurs, barre: j.barre };
}
// DÉLIER, sur SON toucher : le lien posé DANS VRM est retiré, tout revient à l'état d'avant.
// Une identité écrite SUR le site (référence Leboncoin, SKU eBay) ne se délie pas d'ici : refus
// 'ecrit-sur-le-site' (l'écran dit de corriger l'annonce).
export function opsDelier({ annonce, cartes, cle = cleDefaut } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null) return { refus: 'identite' };
  const id = String(annonce.id), k = cleAnnonce(annonce);
  const deja = dejaLie(annonce.plateforme, id, C, cle);
  const lienJ = objet(C.journal[cleJournal('lien', k)]);
  if (!deja && !lienJ) return { refus: 'ecrit-sur-le-site' };
  const ops = [];
  if (deja) {
    const brut = annonce.plateforme === 'Leboncoin' ? C.lbc[id] : annonce.plateforme === 'eBay' ? C.ebay[id] : C.vc[id];
    // Une annonce Leboncoin qui portait SON N° avant le lien le reprend ; sinon le lien disparaît.
    const propre = annonce.plateforme === 'Vestiaire' ? '' : numeroPropre(C, annonce.plateforme, id, cle);
    const retour = !propre ? undefined : annonce.plateforme === 'Leboncoin' ? propre : { numero: propre, propre: true };
    ops.push({ k: CLES_LIENS[annonce.plateforme], type: 'cle', id, apres: retour, avant: brut });
  }
  if (lienJ) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: undefined, avant: lienJ });
  return { ops, numero: cle((deja && deja.numero) || (lienJ && lienJ.numero) || '') };
}
// « Plus tard » : l'annonce passe en fin de file (rien d'autre). `annuler` la remet à sa place.
export function opsPlusTard({ annonce, cartes, annuler = false, maintenant = new Date().toISOString() } = {}) {
  const J = carteLue(cartes && cartes.journal);
  if (!J) return { refus: 'pas-su' };
  const id = cleJournal('tard', annonce);
  return { ops: [{ k: CLE_LIAISON, type: 'cle', id, apres: annuler ? undefined : maintenant, avant: J[id] }] };
}
// « Elle n'est que sur ce site » : l'annonce est un article à elle seule. `numero` : le N° NEUF que
// l'app vient de lui donner par LA règle des numéros (`prochainLibre` : après le plus haut,
// jamais un trou, jamais un N° déjà servi) — '' quand l'annonce porte déjà le sien (Vestiaire,
// ou donné ailleurs) ou quand VRM ne peut pas le poser ici. Leboncoin : le N° est rangé comme son
// lien (`vrm_lbc_liens`), l'identité que toute l'app lit déjà. `annuler` : elle revient dans la file
// (le N° donné reste le sien : un N° servi ne se reprend jamais).
export function opsPropre({ annonce, numero = '', cartes, servis = null, annuler = false, cle = cleDefaut, maintenant = new Date().toISOString() } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null) return { refus: 'identite' };
  annonce = annonceLue(annonce, C.journal, cle, C.faits);
  const id = String(annonce.id), k = cleAnnonce(annonce);
  const dejaPr = objet(C.journal[cleJournal('propre', k)]);
  if (annuler) return dejaPr ? { ops: [{ k: CLE_LIAISON, type: 'cle', id: cleJournal('propre', k), apres: dejaPr.numero ? { ...dejaPr, actif: false } : undefined, avant: dejaPr }], numero: '' } : { refus: 'identite' };
  if (dejaLie(annonce.plateforme, id, C, cle) || annonce.relie) return { refus: 'annonce-reliee' };
  const n = cle(numero || '');
  // Un N° déjà SERVI (pool, fiches, liens, ventes) ne se redonne jamais.
  if (n && servis && (servis instanceof Set ? servis.has(n) : arr(servis).map((x) => cle(x)).includes(n))) return { refus: 'numero-servi', numero: n };
  if (n && annonce.plateforme !== 'Leboncoin') return { refus: 'identite' };
  // Elle a déjà SON N° : jamais un deuxième.
  if (n && (cle(annonce.numeroSite || '') || (dejaPr && cle(dejaPr.numero || '')) || (C.lbc[id] != null && String(C.lbc[id]).trim()))) return { refus: 'identite' };
  const ops = [];
  if (n) ops.push({ k: CLES_LIENS.Leboncoin, type: 'cle', id, apres: String(numero).trim(), avant: C.lbc[id] });
  ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('propre', k), apres: { at: maintenant, ...(n ? { numero: String(numero).trim() } : dejaPr && dejaPr.numero ? { numero: dejaPr.numero } : {}) }, avant: C.journal[cleJournal('propre', k)] });
  if (C.journal[cleJournal('tard', k)] !== undefined) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('tard', k), apres: undefined, avant: C.journal[cleJournal('tard', k)] });
  return { ops, numero: n || cle(annonce.numeroSite || '') };
}
// Jouer des opérations sur des cartes (le lot : chaque lien part des cartes laissées par le précédent).
export function appliquerSurCartes(cartes, ops) {
  const nom = { [CLES_LIENS.Leboncoin]: 'lbc', [CLES_LIENS.eBay]: 'ebay', [CLES_LIENS.Vestiaire]: 'vc', [CLE_LIAISON]: 'journal' };
  const out = { ...cartes };
  for (const op of arr(ops)) {
    const c = nom[op.k]; if (!c) continue;
    const m = { ...(objet(out[c]) || {}) };
    if (op.apres === undefined) delete m[String(op.id)]; else m[String(op.id)] = op.apres;
    out[c] = m;
  }
  return out;
}
// LE LOT « Relier les N sûres » : seulement les entrées mises en avant qu'il a gardées cochées,
// une à une, chacune REJUGÉE sur les cartes laissées par la précédente (deux annonces vers le
// même article ⇒ la seconde reste dans la file). Rend { ops, faits: [{ cle, numero }], restes: [{ cle, refus }] }.
export function opsRelierLot({ entrees, cartes, autres = [], numerosDouteux = null, cle = cleDefaut, marqueDe = null, maintenant = new Date().toISOString() } = {}) {
  if (!cartesLues(cartes)) return { refus: 'pas-su', ops: [], faits: [], restes: [] };
  let C = { ...cartes }, vus = arr(autres).slice();
  const ops = [], faits = [], restes = [];
  for (const e of arr(entrees)) {
    const c = e && e.avant ? arr(e.candidats).find((x) => String(x.paire.id) === String(e.avant)) : null;
    if (!c || c.niveau !== 'sur') { restes.push({ cle: e && e.cle, refus: 'pas-sure' }); continue; }
    const r = opsRelier({ annonce: e.annonce, paire: c.paire, preuve: 'photo-sure', cartes: C, autres: vus, numerosDouteux, cle, marqueDe, maintenant });
    if (!r.ops) { restes.push({ cle: e.cle, refus: r.refus || 'question' }); continue; }
    ops.push(...r.ops); faits.push({ cle: e.cle, numero: r.numero });
    C = appliquerSurCartes(C, r.ops);
    vus = vus.map((x) => (x && cleAnnonce(x) === e.cle ? { ...x, relie: true, numero: r.numero } : x));
  }
  return { ops, faits, restes };
}

// ── APRÈS LE LIEN : LA RELECTURE CONFIRME ────────────────────────────────────
// `entree` : l'entrée de l'annonce dans un calcul fait APRÈS l'écriture (les règles d'identité de
// l'app l'ont relue). 'verifie' · 'autre' (elle désigne un autre N°, ou ses identités se
// contredisent : dit, et rangé « à vérifier ») · 'pas-su'.
export function verifierLien({ entree, attendu, cle = cleDefaut } = {}) {
  if (!entree) return 'pas-su';
  if (entree.etat === 'aVerifier') return 'autre';
  if (entree.etat !== 'relie' || !entree.numero) return 'pas-su';
  return cle(entree.numero) === cle(attendu || '') ? 'verifie' : 'autre';
}

// ── LES LIENS QUI SE CONTREDISENT ──────────────────────────────────────────
// Rien n'est tranché tout seul : chaque cas est MONTRÉ (les deux côtés), il garde ou délie.
//   'deux-numeros'  : l'annonce porte deux identités qui désignent deux N° (le lien posé dit
//                     N°A, la référence / le SKU écrit sur le site dit N°B) ;
//   'deux-annonces' : deux annonces EN VENTE du même site sous le même N° (sans déclaration) ;
//   'taille'        : annonce reliée, tailles lues des deux côtés et différentes ;
//   'prix'          : annonce reliée, écart de prix fort ;
//   'orphelin'      : annonce reliée à un N° qu'AUCUN article connu ne porte (N° lus seulement).
// `journal['garde:<id>']` : il a dit « garder » — le cas ne revient plus.
export function contradictions({ autres = [], paires = [], journal = {}, faits = {}, numerosConnus = null, cle = cleDefaut, marqueDe = null } = {}) {
  const J = objet(journal) || {};
  autres = arr(autres).map((a) => annonceLue(a, J, cle, faits));
  const parNum = new Map();
  for (const p of arr(paires)) { const k = p ? cle(p.numero || '') : ''; if (k && !parNum.has(k)) parNum.set(k, p); }
  const connus = numerosConnus instanceof Set ? numerosConnus : null;
  const out = [];
  const pousser = (c) => { if (!J[cleJournal('garde', c.id)]) out.push(c); };
  const groupes = new Map();
  for (const a of autres) {
    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme)) continue;
    const k = cleAnnonce(a);
    const lienJ = objet(J[cleJournal('lien', k)]);
    const vus = new Set(arr(lienJ && lienJ.doutes));
    const ids = arr(a.identites).filter((i) => i && i.sorte !== 'vrm' && cle(i.numero || '')).map((i) => ({ sorte: i.sorte, numero: cle(i.numero) }));
    const nums = [...new Set(ids.map((i) => i.numero))];
    if (nums.length >= 2 && !vus.has('reference')) pousser({ id: `2n:${k}:${nums.slice().sort().join('|')}`, type: 'deux-numeros', plateforme: a.plateforme, annonces: [a], numeros: nums, identites: ids, paires: nums.map((n) => parNum.get(n) || null) });
    const n = cle(a.numero || '');
    if (!n || !a.relie) continue;
    if (a.enVente !== false) { const g = `${a.plateforme}|${n}`; if (!groupes.has(g)) groupes.set(g, []); groupes.get(g).push(a); }
    const p = parNum.get(n) || null;
    if (!p) { if (connus && !connus.has(n) && !(lienJ && lienJ.article && !lienJ.vinted)) pousser({ id: `o:${k}:${n}`, type: 'orphelin', plateforme: a.plateforme, annonces: [a], numeros: [n], paires: [null] }); continue; }
    const t = comparerTailles(a, p);
    if (t.verdict === 'differentes' || (t.verdict === 'doute' && !vus.has('taille'))) pousser({ id: `t:${k}:${n}`, type: 'taille', plateforme: a.plateforme, annonces: [a], numeros: [n], paires: [p], tailleAnnonce: t.annonce, taillePaire: t.paire, sure: t.verdict === 'differentes' });
    else if (ecartPrixFort(a.prix, p.prix) && !vus.has('prix')) pousser({ id: `p:${k}:${n}`, type: 'prix', plateforme: a.plateforme, annonces: [a], numeros: [n], paires: [p] });
  }
  for (const [g, l] of groupes) {
    if (l.length < 2) continue;
    const declarees = l.filter((a) => { const e = objet(J[cleJournal('lien', cleAnnonce(a))]); return e && e.plusieurs; }).length;
    if (declarees >= l.length - 1) continue;
    const n = g.split('|')[1];
    pousser({ id: `2a:${l[0].plateforme}:${n}:${l.map((a) => String(a.id)).sort().join('|')}`, type: 'deux-annonces', plateforme: l[0].plateforme, annonces: l, numeros: [n], paires: [parNum.get(n) || null] });
  }
  const ORDRE = ['deux-numeros', 'deux-annonces', 'taille', 'orphelin', 'prix'];
  out.sort((x, y) => ORDRE.indexOf(x.type) - ORDRE.indexOf(y.type) || SITES_LIAISON.indexOf(x.plateforme) - SITES_LIAISON.indexOf(y.plateforme) || String(x.id).localeCompare(String(y.id)));
  return out;
}
// « Garder » : il a regardé les deux côtés et garde l'état actuel — le cas ne revient plus.
export function opsGarder({ contradiction, choix = 'garder', cartes, maintenant = new Date().toISOString() } = {}) {
  const J = carteLue(cartes && cartes.journal);
  if (!J) return { refus: 'pas-su' };
  if (!contradiction || !contradiction.id) return { refus: 'identite' };
  const id = cleJournal('garde', contradiction.id);
  return { ops: [{ k: CLE_LIAISON, type: 'cle', id, apres: { at: maintenant, choix: String(choix) }, avant: J[id] }] };
}

// ── L'ÉTAT D'UN LIEN, LÀ OÙ IL SERT (une rangée Leboncoin / eBay / Vestiaire, la fiche) ────────
// Rend { etat: 'relie'|'aRelier'|'aVerifier'|'propre'|'passu', numero, preuve, lieLe }.
export function etatLien(res, plateforme, id) {
  if (!res || !res.lu) return { etat: 'passu', numero: '', preuve: '', lieLe: '' };
  const e = res.parCle.get(`${plateforme}:${id}`);
  if (!e) return { etat: 'passu', numero: '', preuve: '', lieLe: '' };
  return { etat: e.etat, numero: e.numero, preuve: e.preuve, lieLe: e.lieLe };
}
// LE compteur d'entrée (« N annonces à relier ») : une source, lue partout (§7).
export function compteurLiaison(res) {
  if (!res || !res.lu) return null;
  return { n: res.compteur.aRelier - res.compteur.plusTard, surs: res.compteur.surs, contradictions: res.compteur.contradictions, plusTard: res.compteur.plusTard };
}

// ── LA PROPOSITION SUR LA RANGÉE (20 nov., « relier depuis la liste ») ──────────────────────────────────────────
// Julien : « on ne peut pas relier des annonces comme ça, on est obligé d'appuyer dessus, regarder la fiche ». Une annonce
// « à relier » montre SUR SA RANGÉE (Annonces, fiche courte) LA meilleure candidate : un toucher la relie (le même `opsRelier`
// que le parcours, toutes les gardes rejouées), « Autre… » ouvre le parcours sur elle.
// Une proposition n'est faite que si elle est UNIQUE et APPUYÉE — jamais par défaut :
//   · « sûr » : la candidate mise en avant par le parcours (`avant` : même photo sûre, unique, sans doute) ;
//   · sinon « à vérifier » : la PREMIÈRE de `candidatesPour` (taille de l'annonce), si elle est seule à son rang ET à sa
//     proximité (deux candidates à égalité ⇒ AUCUNE : 50 paires identiques ne proposent rien), si elle a un appui
//     (même photo à vérifier, N° écrit sur l'annonce, publiée par VRM, ou même taille LUE des deux côtés + 2 mots du modèle
//     en commun), et si le jugement ne la refuse pas (taille différente, déjà prise, N° double…).
// Rend Map(cle ⇒ { cle, paireId, numero, photo, titre, niveau: 'sur'|'verifier', raison }) ; rien relié ici.
export const PROCHE_PROPOSITION = 22;   // taille sûre des deux côtés (20) + 2 mots du modèle en commun
export function propositionsDe(res, { cle = cleDefaut, marqueDe = null, numerosDouteux = null } = {}) {
  const out = new Map();
  if (!res || !res.lu) return out;
  for (const e of arr(res.file)) {
    if (!e || e.etat !== 'aRelier' || !e.annonce) continue;
    let choix = null, niveau = 'verifier';
    if (e.avant) { choix = arr(e.candidats).find((c) => String(c.paire.id) === String(e.avant)) || null; niveau = 'sur'; }
    if (!choix) {
      niveau = 'verifier';
      const t = tailleDe(e.annonce);
      const l = candidatesPour(e, res.articles, { taille: t.taille, autres: res.autres || [], cle });
      const p1 = l[0], p2 = l[1];
      if (!p1) continue;
      if (p2 && p2.rang === p1.rang && p2.proche === p1.proche) continue;          // à égalité : aucune présélection
      const appui = p1.rang <= 3 || p1.proche >= PROCHE_PROPOSITION;
      if (!appui) continue;
      const j = jugerLien({ annonce: e.annonce, paire: p1.paire, autres: res.autres || [], numerosDouteux, cle, marqueDe });
      if (j.refus) continue;
      choix = { ...p1, raison: p1.raison || (p1.rang <= 3 ? 'photo' : 'proche') };
    }
    const p = choix.paire;
    out.set(e.cle, { cle: e.cle, paireId: String(p.id), numero: cle(p.numero || ''), photo: p.photo || '', titre: p.titre || '', niveau, raison: niveau === 'sur' ? 'photo-sure' : (choix.raison || 'proche') });
  }
  return out;
}
