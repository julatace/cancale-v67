// ══════════════════════════════════════════════════════════════════════════
// « RELIER MES ANNONCES » — LA LIAISON GUIDÉE ENTRE VINTED ET LES AUTRES SITES (19 nov.)
//
// Julien : « la liaison des articles entre les différentes applications […] ça doit vraiment
// être accompagné par l'application, absolument parfaitement. Ça doit être irréprochable. Il ne
// peut pas y avoir d'erreur. » — et : « l'outil doit être pratique, pas chiant ».
//
// Ce lien décide QUELLE annonce VRM dit de retirer ailleurs quand la paire est vendue, et sous
// QUEL N° elle est rangée. Un lien faux retire la mauvaise annonce ou envoie la mauvaise
// chaussure : « mieux vaut un blanc qu'un faux » (§5).
//
// • Module PUR (aucun accès au navigateur, à la base, à l'extension) : l'app
//   (src/LiaisonSites.jsx, App.jsx) et `scripts/audit-liaison-sites.cjs` exécutent LES MÊMES
//   fonctions (§11). Rien ici n'écrit : les fonctions `ops…` rendent des OPÉRATIONS
//   (src/gesteAnnulable.js : une sous-valeur posée, et son inverse), que l'app joue par
//   `gesteVrm` — chaque écriture relit la clé et n'y pose que SA sous-valeur ; une lecture
//   ratée n'écrit rien.
// • L'identité d'une annonce n'est JAMAIS décidée ici : l'app la lit avec ses règles
//   (`numeroLbcIdentite`, `numEbayLu`, `numVcAnnonce`, `numeroExterne` pour un N° d'avant la
//   remise à zéro) et la passe (`annonce.relie`, `annonce.numero`, `annonce.identites`).
// • Les GARDES (toutes silencieuses quand tout va bien) :
//     1. une annonce ne se relie qu'à UNE paire (déjà reliée ⇒ refus) ;
//     2. une paire n'a qu'UNE annonce par site (sauf déclaration explicite « deux annonces ») ;
//     3. taille LUE des deux côtés et différente ⇒ refus ; lue « peut-être » dans un titre
//        (un nombre isolé, sans le mot « taille ») ⇒ UNE question qui montre les deux ;
//     4. écart de prix fort, marque différente ⇒ UNE question qui montre les deux ;
//     5. N° porté par deux paires présentes, paire sans N° ⇒ refus ;
//     6. « pas su » (une carte de liens pas lue) ⇒ rien n'est écrit ;
//     7. jamais de présélection sur une ressemblance : seule « même photo · sûr », UNIQUE et
//        sans aucun doute, est mise en avant — et c'est encore SON toucher qui relie.
// ══════════════════════════════════════════════════════════════════════════
import { tailleNorm } from './suggestionsAchat.js';
import { poserLienVc, lienDe, produitDeVinted } from './lienVestiaire.js';

export const SITES_LIAISON = ['Leboncoin', 'eBay', 'Vestiaire'];
// La clé synchronisée de CE parcours : { 'lien:Site:id': { numero, vinted, par, at, … },
// 'tard:Site:id': iso, 'propre:Site:id': { at, numero? }, 'garde:<contradiction>': { at, choix } }.
export const CLE_LIAISON = 'vrm_liaison_sites';
export const CLES_LIENS = { Leboncoin: 'vrm_lbc_liens', eBay: 'vrm_ebay_liens', Vestiaire: 'vrm_vc_liens' };
// La preuve d'un lien (dite sur la fiche et dans le parcours).
export const PREUVES = ['photo-sure', 'photo', 'recherche', 'relecture', 'propre'];
// « Écart de prix fort » : le plus cher vaut au moins le DOUBLE de l'autre ET 20 € de plus.
// Mesuré le 19 nov. sur les 4 liens réels lisibles (lecture seule) : rapports 1,00 · 1,07 · 1,10 ·
// 1,62 (24 €) — aucun vrai lien ne déclenche la question à 2.
export const PRIX_RAPPORT_FORT = 2;
export const PRIX_ECART_MIN = 20;

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
const LETTRES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
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
// La taille d'une annonce d'un site ou d'une paire Vinted : son champ d'abord, son titre sinon.
export function tailleDe(x) {
  if (!x) return { taille: '', sure: false };
  const c = tailleLue(x.taille, { champ: true });
  return c.taille ? c : tailleLue(x.titre);
}
// 'egales' · 'differentes' (lues sûres des deux côtés) · 'doute' (différentes, l'une « peut-être ») · 'inconnu'.
export function comparerTailles(a, p) {
  const ta = tailleDe(a), tp = tailleDe(p);
  if (!ta.taille || !tp.taille) return { verdict: 'inconnu', annonce: ta.taille, paire: tp.taille };
  if (ta.taille === tp.taille) return { verdict: 'egales', annonce: ta.taille, paire: tp.taille };
  return { verdict: ta.sure && tp.sure ? 'differentes' : 'doute', annonce: ta.taille, paire: tp.taille };
}

// ── LE PRIX, LA MARQUE ────────────────────────────────────────────────────
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

// ── JUGER UN LIEN (avant tout toucher qui relie, et ENCORE à l'écriture) ─────────────
// `annonce` : { plateforme, id, compte, titre, taille?, prix?, marque?, relie, numero }
// `paire`   : { id (annonce Vinted), numero, titre, taille?, prix?, marque? }
// `autres`  : toutes ses annonces des autres sites (pour « une paire, une annonce par site ») ;
// `accepte` : { plusieurs: true } (il a déclaré « la même paire en deux annonces »),
//             { doutes: true } (il a confirmé la question prix / marque / taille « peut-être »).
// Rend { ok: true, numero, doutes, plusieurs } · { ok: false, refus, … } · { ok: false, confirmer: [...], … }.
export function jugerLien({ annonce, paire, autres = [], numerosDouteux = null, cle = cleDefaut, marqueDe = null, accepte = {} } = {}) {
  if (!annonce || annonce.id == null || !SITES_LIAISON.includes(annonce.plateforme) || !paire || paire.id == null) return { ok: false, refus: 'identite' };
  // 1. Une annonce ne se relie qu'à UNE paire.
  if (annonce.relie || cle(annonce.numero || '')) return { ok: false, refus: 'annonce-reliee', numero: cle(annonce.numero || '') };
  const n = cle(paire.numero || '');
  if (!n) return { ok: false, refus: 'sans-numero' };
  // 5. Deux paires présentes sous ce N° : il ne désigne personne.
  const douteux = numerosDouteux instanceof Set ? numerosDouteux : new Set(arr(numerosDouteux).map((x) => cle(x)));
  if (douteux.has(n)) return { ok: false, refus: 'numero-double', numero: n };
  // 3. La taille.
  const t = comparerTailles(annonce, paire);
  if (t.verdict === 'differentes') return { ok: false, refus: 'taille', tailleAnnonce: t.annonce, taillePaire: t.paire, numero: n };
  // 2. Une paire n'a qu'UNE annonce par site.
  const prise = arr(autres).find((x) => x && x.plateforme === annonce.plateforme && String(x.id) !== String(annonce.id) && x.enVente !== false && cle(x.numero || '') === n);
  if (prise && !(accepte && accepte.plusieurs)) return { ok: false, refus: 'paire-prise', autre: prise, numero: n, declarable: annonce.plateforme !== 'Vestiaire' };
  // 4. Les vrais doutes : UNE question, qui montre les deux.
  const doutes = [];
  if (t.verdict === 'doute') doutes.push('taille');
  if (ecartPrixFort(annonce.prix, paire.prix)) doutes.push('prix');
  if (marquesDifferentes(annonce, paire, marqueDe)) doutes.push('marque');
  if (doutes.length && !(accepte && accepte.doutes)) return { ok: false, confirmer: doutes, numero: n, tailleAnnonce: t.annonce, taillePaire: t.paire };
  return { ok: true, numero: n, doutes, plusieurs: !!prise };
}

// ── LES CANDIDATES ET LA FILE ──────────────────────────────────────────────
// `autres`    : ses annonces Leboncoin / eBay / Vestiaire, telles que l'app les lit
//               ({ …, relie, numero, identites: [{ sorte, numero }], enVente: true|false|null }) ;
//               `null` ⇒ pas lues ;
// `paires`    : ses paires Vinted PRÉSENTES avec un N° ({ id, numero, titre, photo, taille, prix,
//               marque, compte, compteNom, place }) ; `null` ⇒ pas lues (pas su ≠ aucune) ;
// `memePhoto` : la sortie de `propositionsMemePhoto` (src/memePhoto.js), ou null (pas lue : aucune
//               candidate par photo, la recherche reste) ;
// `journal`   : `vrm_liaison_sites`.
// Rend { lu, entrees, file, relies, propres, compteur, parCle, contradictions }.
//   entrée = { cle, annonce, etat: 'aRelier'|'relie'|'aVerifier'|'propre', plusTard, taille,
//              candidats: [{ paire, niveau: 'sur'|'verifier', raison, photoAutre, photoVinted }],
//              ambigu, avant: idPaire | null }
//   `avant` : la SEULE candidate mise en avant — « même photo · sûr », unique, sans aucun doute
//   ni refus. Jamais posée sur une ressemblance, jamais reliée sans son toucher.
export function construireLiaison({ autres = null, paires = null, memePhoto = null, journal = {}, numerosDouteux = null, numerosConnus = null, cle = cleDefaut, marqueDe = null } = {}) {
  const vide = { lu: false, entrees: [], file: [], relies: [], propres: [], contradictions: [], compteur: { aRelier: 0, surs: 0, aVerifier: 0, plusTard: 0, contradictions: 0 }, parCle: new Map() };
  if (!Array.isArray(autres) || !Array.isArray(paires)) return vide;
  const J = objet(journal) || {};
  const parId = new Map(), parNum = new Map();
  for (const p of paires) {
    if (!p || p.id == null) continue;
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
  const litiges = contradictions({ autres, paires, journal: J, numerosConnus, cle, marqueDe });
  const enLitige = new Set(); for (const c of litiges) for (const a of c.annonces) enLitige.add(cleAnnonce(a));
  const entrees = [];
  for (const a of autres) {
    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme)) continue;
    const k = cleAnnonce(a);
    const relie = !!(a.relie || cle(a.numero || ''));
    const propre = !relie && !!J[cleJournal('propre', k)];
    const ph = relie || propre ? null : photo.get(k);
    // Chaque candidate porte SON jugement (la carte montre une taille différente en ambre, sans phrase).
    const candidats = ph ? ph.candidats.map((c) => ({ ...c, jugement: jugerLien({ annonce: a, paire: c.paire, autres, numerosDouteux, cle, marqueDe }) })).filter((c) => !['identite', 'sans-numero', 'annonce-reliee'].includes(c.jugement.refus)) : [];
    let avant = null;
    if (candidats.length === 1 && !ph.ambigu && candidats[0].niveau === 'sur') {
      const j = candidats[0].jugement;
      if (j.ok && !j.doutes.length && !j.plusieurs) avant = String(candidats[0].paire.id);
    }
    const lien = objet(J[cleJournal('lien', k)]);
    entrees.push({
      cle: k, annonce: a, etat: enLitige.has(k) ? 'aVerifier' : relie ? 'relie' : propre ? 'propre' : 'aRelier',
      numero: relie ? cle(a.numero || '') : '', preuve: relie ? ((lien && lien.par) || (arr(a.identites)[0] || {}).sorte || '') : '', lieLe: relie && lien ? lien.at || '' : '',
      plusTard: !relie && !propre && !!J[cleJournal('tard', k)], taille: tailleDe(a), candidats, ambigu: !!(ph && ph.ambigu), avant,
    });
  }
  const rang = (e) => (e.plusTard ? 3 : e.avant ? 0 : e.candidats.length ? 1 : 2);
  const ordre = (x, y) => rang(x) - rang(y) || SITES_LIAISON.indexOf(x.annonce.plateforme) - SITES_LIAISON.indexOf(y.annonce.plateforme) || String(x.annonce.id).localeCompare(String(y.annonce.id), 'fr', { numeric: true });
  const file = entrees.filter((e) => e.etat === 'aRelier').sort(ordre);
  const parCle = new Map(entrees.map((e) => [e.cle, e]));
  return {
    lu: true, entrees, file, parCle, contradictions: litiges,
    relies: entrees.filter((e) => e.etat === 'relie'), propres: entrees.filter((e) => e.etat === 'propre'),
    compteur: { aRelier: file.length, surs: file.filter((e) => e.avant).length, aVerifier: file.filter((e) => !e.avant && e.candidats.length).length, plusTard: file.filter((e) => e.plusTard).length, contradictions: litiges.length },
  };
}
// Les « sûres » du lot « Relier les N sûres » : celles mises en avant, hors « plus tard ».
export const sursDuLot = (res) => (res && res.lu ? res.file.filter((e) => e.avant && !e.plusTard) : []);

// ── LA RECHERCHE (N°, titre, taille) ───────────────────────────────────────
// Un outil pour TROUVER, pas une proposition : le tri est celui des N° (jamais « la plus
// ressemblante »), sauf le N° tapé exactement, en tête. `taille` : ne garde que cette taille
// (la puce « Taille 42 », qu'il peut retirer). `prises` : Set des N° (clé) qui ont déjà une
// annonce sur CE site — sortis de la liste par défaut, toujours trouvables en tapant leur N°.
export function chercherPaires(paires, q = '', { taille = '', prises = null, cle = cleDefaut } = {}) {
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const numTape = mots.map((m) => { const x = /^n?°?([a-z]{0,3}\d{1,6})$/.exec(m); return x ? cle(x[1]) : ''; }).filter(Boolean);
  const out = [];
  for (const p of arr(paires)) {
    if (!p || p.id == null) continue;
    const k = cle(p.numero || '');
    const exact = !!k && numTape.includes(k);
    if (!mots.length) {
      if (prises && k && prises.has(k)) continue;
      if (taille && tailleDe(p).taille !== taille) continue;
    } else if (!exact) {
      const texte = sansAccent([p.titre, p.marque, p.taille, p.compteNom, k ? 'n' + k : '', k ? 'n°' + k : '', k].join(' '));
      if (!mots.every((m) => texte.includes(m))) continue;
    }
    out.push({ paire: p, exact });
  }
  out.sort((x, y) => Number(y.exact) - Number(x.exact) || String(x.paire.numero || '').localeCompare(String(y.paire.numero || ''), 'fr', { numeric: true }) || String(x.paire.id).localeCompare(String(y.paire.id)));
  return out.map((x) => x.paire);
}
// Les N° (clé) qui ont déjà une annonce reliée sur ce site.
export function numerosPris(autres, plateforme, cle = cleDefaut) {
  const s = new Set();
  for (const a of arr(autres)) if (a && a.plateforme === plateforme && a.enVente !== false) { const k = cle(a.numero || ''); if (k) s.add(k); }
  return s;
}

// ── LES OPÉRATIONS (src/gesteAnnulable.js) ──────────────────────────────────
// `cartes` : les valeurs COURANTES, relues au moment du geste — { lbc, ebay, vc, journal } ;
// l'une `undefined` / `null` ⇒ PAS SU ⇒ refus 'pas-su', RIEN n'est écrit.
const carteLue = (c) => (c === undefined || c === null ? null : objet(c) || null);
const dejaLie = (plateforme, id, C) => {
  if (plateforme === 'Leboncoin') { const v = C.lbc[String(id)]; return v != null && String(v).trim() ? { numero: String(v) } : null; }
  if (plateforme === 'eBay') { const v = objet(C.ebay[String(id)]); return v && v.pairId ? v : null; }
  return lienDe(C.vc, id);
};
function cartesLues(cartes) {
  const C = { lbc: carteLue(cartes && cartes.lbc), ebay: carteLue(cartes && cartes.ebay), vc: carteLue(cartes && cartes.vc), journal: carteLue(cartes && cartes.journal) };
  return C.lbc && C.ebay && C.vc && C.journal ? C : null;
}
// RELIER, sur SON toucher. Rend { ops, numero, entree } ou { refus, … } / { confirmer, … }.
// Le jugement est REFAIT ici, sur les cartes courantes : une feuille périmée ne relie rien.
export function opsRelier({ annonce, paire, preuve = 'recherche', cartes, autres = [], numerosDouteux = null, cle = cleDefaut, marqueDe = null, accepte = {}, numeroVc = '', maintenant = new Date().toISOString() } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null || !paire) return { refus: 'identite' };
  const id = String(annonce.id);
  const deja = dejaLie(annonce.plateforme, id, C);
  if (deja) return { refus: 'annonce-reliee', numero: cle(deja.numero || '') };
  const j = jugerLien({ annonce, paire, autres, numerosDouteux, cle, marqueDe, accepte });
  if (!j.ok) { const { ok: _ok, ...reste } = j; return reste; }
  if (!PREUVES.includes(preuve)) return { refus: 'identite' };
  const numero = String(paire.numero).trim();
  const ops = [];
  if (annonce.plateforme === 'Leboncoin') ops.push({ k: CLES_LIENS.Leboncoin, type: 'cle', id, apres: numero, avant: undefined });
  else if (annonce.plateforme === 'eBay') ops.push({ k: CLES_LIENS.eBay, type: 'cle', id, apres: { pairId: String(paire.id), numero, at: Date.parse(maintenant) || Date.now(), par: preuve }, avant: undefined });
  else {
    const r = poserLienVc({ liens: C.vc, productId: id, item: paire.id, numeroVinted: numero, numeroVc, cleNum: cle, maintenant });
    if (r.refus) return { refus: r.refus === 'vinted-deja-relie' ? 'paire-prise' : r.refus === 'deja-relie' ? 'annonce-reliee' : r.refus, autreId: r.refus === 'vinted-deja-relie' ? produitDeVinted(C.vc, paire.id) : undefined, numero: j.numero };
    ops.push({ k: CLES_LIENS.Vestiaire, type: 'cle', id, apres: { ...r.liens[id], par: preuve }, avant: undefined });
  }
  const entree = { numero, vinted: String(paire.id), par: preuve, at: maintenant, ...(j.plusieurs ? { plusieurs: true } : {}), ...(j.doutes.length ? { doutes: j.doutes } : {}) };
  const k = cleAnnonce(annonce);
  ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: entree, avant: C.journal[cleJournal('lien', k)] });
  for (const s of ['tard', 'propre']) if (C.journal[cleJournal(s, k)] !== undefined) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal(s, k), apres: undefined, avant: C.journal[cleJournal(s, k)] });
  return { ops, numero: j.numero, entree, doutes: j.doutes, plusieurs: j.plusieurs };
}
// DÉLIER, sur SON toucher : le lien posé DANS VRM est retiré, tout revient à l'état d'avant.
// Une identité écrite SUR le site (référence Leboncoin, SKU eBay) ne se délie pas d'ici : refus
// 'ecrit-sur-le-site' (l'écran dit de corriger l'annonce).
export function opsDelier({ annonce, cartes, cle = cleDefaut } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null) return { refus: 'identite' };
  const id = String(annonce.id), k = cleAnnonce(annonce);
  const deja = dejaLie(annonce.plateforme, id, C);
  if (!deja) return { refus: 'ecrit-sur-le-site' };
  const brut = annonce.plateforme === 'Leboncoin' ? C.lbc[id] : annonce.plateforme === 'eBay' ? C.ebay[id] : C.vc[id];
  const ops = [{ k: CLES_LIENS[annonce.plateforme], type: 'cle', id, apres: undefined, avant: brut }];
  if (C.journal[cleJournal('lien', k)] !== undefined) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: undefined, avant: C.journal[cleJournal('lien', k)] });
  return { ops, numero: cle(deja.numero || '') };
}
// « Plus tard » : l'annonce passe en fin de file (rien d'autre). `annuler` la remet à sa place.
export function opsPlusTard({ annonce, cartes, annuler = false, maintenant = new Date().toISOString() } = {}) {
  const J = carteLue(cartes && cartes.journal);
  if (!J) return { refus: 'pas-su' };
  const id = cleJournal('tard', annonce);
  return { ops: [{ k: CLE_LIAISON, type: 'cle', id, apres: annuler ? undefined : maintenant, avant: J[id] }] };
}
// « Elle n'est pas sur Vinted » : l'annonce est propre à son site. `numero` : le N° NEUF que
// l'app vient de lui donner par LA règle des numéros (`prochainLibre` : après le plus haut,
// jamais un trou, jamais un N° déjà servi) — '' quand le site le porte déjà (Vestiaire) ou
// quand VRM ne peut pas le poser (eBay : son N° vit dans son SKU). Leboncoin : le N° est posé
// comme son lien (`vrm_lbc_liens`), l'identité que toute l'app lit déjà.
export function opsPropre({ annonce, numero = '', cartes, servis = null, cle = cleDefaut, maintenant = new Date().toISOString() } = {}) {
  const C = cartesLues(cartes);
  if (!C) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null) return { refus: 'identite' };
  const id = String(annonce.id), k = cleAnnonce(annonce);
  if (dejaLie(annonce.plateforme, id, C) || annonce.relie) return { refus: 'annonce-reliee' };
  const n = cle(numero || '');
  // Un N° déjà SERVI (pool, fiches, liens, ventes) ne se redonne jamais.
  if (n && servis && (servis instanceof Set ? servis.has(n) : arr(servis).map((x) => cle(x)).includes(n))) return { refus: 'numero-servi', numero: n };
  if (n && annonce.plateforme !== 'Leboncoin') return { refus: 'identite' };
  const ops = [];
  if (n) ops.push({ k: CLES_LIENS.Leboncoin, type: 'cle', id, apres: String(numero).trim(), avant: undefined });
  ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('propre', k), apres: { at: maintenant, ...(n ? { numero: String(numero).trim() } : {}) }, avant: C.journal[cleJournal('propre', k)] });
  if (n) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: { numero: String(numero).trim(), vinted: '', par: 'propre', at: maintenant }, avant: C.journal[cleJournal('lien', k)] });
  if (C.journal[cleJournal('tard', k)] !== undefined) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('tard', k), apres: undefined, avant: C.journal[cleJournal('tard', k)] });
  return { ops, numero: n };
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
// une à une, chacune REJUGÉE sur les cartes laissées par la précédente (deux annonces vers la
// même paire ⇒ la seconde reste dans la file). Rend { ops, faits: [{ cle, numero }], restes: [{ cle, refus }] }.
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
// `relue` : l'annonce telle que l'app la relit APRÈS l'écriture (ses règles d'identité).
// 'verifie' · 'autre' (elle désigne un autre N° : dit, et rangé « à vérifier ») · 'pas-su'.
export function verifierLien({ relue, attendu, cle = cleDefaut } = {}) {
  if (!relue) return 'pas-su';
  const n = cle(relue.numero || '');
  if (!relue.relie || !n) return 'pas-su';
  if (n !== cle(attendu || '')) return 'autre';
  const autresN = new Set(arr(relue.identites).map((i) => cle(i && i.numero)).filter(Boolean));
  autresN.delete(n);
  return autresN.size ? 'autre' : 'verifie';
}

// ── LES LIENS QUI SE CONTREDISENT ──────────────────────────────────────────
// Rien n'est tranché tout seul : chaque cas est MONTRÉ (les deux côtés), il garde ou délie.
//   'deux-numeros'  : l'annonce porte deux identités qui désignent deux N° (le lien posé dit
//                     N°A, la référence / le SKU écrit sur le site dit N°B) ;
//   'deux-annonces' : deux annonces EN VENTE du même site sous le même N° (sans déclaration) ;
//   'taille'        : annonce reliée, tailles lues des deux côtés et différentes ;
//   'prix'          : annonce reliée, écart de prix fort ;
//   'orphelin'      : annonce reliée à un N° qu'AUCUNE paire connue ne porte (N° lus seulement).
// `journal['garde:<id>']` : il a dit « garder » — le cas ne revient plus.
export function contradictions({ autres = [], paires = [], journal = {}, numerosConnus = null, cle = cleDefaut, marqueDe = null } = {}) {
  const J = objet(journal) || {};
  const parNum = new Map();
  for (const p of arr(paires)) { const k = p ? cle(p.numero || '') : ''; if (k && !parNum.has(k)) parNum.set(k, p); }
  const connus = numerosConnus instanceof Set ? numerosConnus : null;
  const out = [];
  const pousser = (c) => { if (!J[cleJournal('garde', c.id)]) out.push(c); };
  const groupes = new Map();
  for (const a of arr(autres)) {
    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme)) continue;
    const k = cleAnnonce(a);
    const ids = arr(a.identites).filter((i) => i && cle(i.numero || '')).map((i) => ({ sorte: i.sorte, numero: cle(i.numero) }));
    const nums = [...new Set(ids.map((i) => i.numero))];
    if (nums.length >= 2) pousser({ id: `2n:${k}:${nums.slice().sort().join('|')}`, type: 'deux-numeros', plateforme: a.plateforme, annonces: [a], numeros: nums, identites: ids, paires: nums.map((n) => parNum.get(n) || null) });
    const n = cle(a.numero || '');
    if (!n || !(a.relie || n)) continue;
    if (a.enVente !== false) { const g = `${a.plateforme}|${n}`; if (!groupes.has(g)) groupes.set(g, []); groupes.get(g).push(a); }
    // Le N° que VRM a donné à une annonce propre à son site ne désigne aucune paire Vinted : rien à comparer.
    const propreAuSite = ids.length > 0 && ids.every((i) => i.sorte === 'vrm') || !!J[cleJournal('propre', k)];
    if (propreAuSite) continue;
    const p = parNum.get(n) || null;
    if (!p) { if (connus && !connus.has(n)) pousser({ id: `o:${k}:${n}`, type: 'orphelin', plateforme: a.plateforme, annonces: [a], numeros: [n], paires: [null] }); continue; }
    const t = comparerTailles(a, p);
    const lien = objet(J[cleJournal('lien', k)]);
    const vus = new Set(arr(lien && lien.doutes));
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
