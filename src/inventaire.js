// ── LE MODE INVENTAIRE (6 nov. 2026, vague 1, demande de Julien) ─────────────
// Il passe devant ses cartons et dit à VRM quels N° sont physiquement là. VRM
// répond trois listes :
//   · MANQUE   — attendu en stock, pas vu ;
//   · EN TROP  — vu, mais VRM ne l'attend pas (plus en annonce, jamais numéroté,
//                archive « B ») ;
//   · VENDU MAIS ENCORE RANGÉ — vu, et prouvé vendu : à sortir pour l'envoi.
//
// Module PUR (aucun accès au navigateur ni à la base) : l'écran
// (`InventaireStock`, src/InventaireStock.jsx, ouvert depuis le Stock) et
// `scripts/audit-inventaire.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ L'ATTENDU N'EST PAS RECALCULÉ ICI. Il vient du Stock, tel quel (une seule
//    source, jamais une copie) : les annonces actuelles (`annoncesActuelles`,
//    src/stockAnnonces.js — la règle unique « en ligne » : en ligne, à confirmer,
//    masquées par Vinted, eBay, Leboncoin, Vestiaire, une fois par paire), les
//    N° prouvés vendus (`vrm_stock_vendus`, publiés par Annonces), les paires
//    « encore là » qu'IL a gardées (`vrm_stock_garder`, `vrm_stock_garde_hors_ligne`),
//    et la question « toutes les lectures qui pourraient porter ce N° ont-elles
//    répondu ? » (`jugeable`, la même que « Plus en ligne »).
// ⚠️ L'IDENTITÉ EST LE N° SEUL (§5) : `cle` = `cleNum` de l'app (« 007 » = « 7 »,
//    « b125 » = « B125 », « B125 » ≠ « 125 »). Jamais le titre, la marque, la
//    taille : 50 paires au même titre ne changent rien. Un texte qui n'est pas
//    un N° est « illisible », jamais rapproché d'une paire.
// ⚠️ « PAS SU » N'EST PAS « MANQUE » : un compte dont la lecture a raté n'a
//    aucune paire attendue (rien n'est conclu sur lui, il est NOMMÉ) ; une
//    annonce « à confirmer » (lecture de plus de 24 h) pas vue va dans « pas su »,
//    jamais dans « manque » ; un N° vu qu'aucune lecture complète ne juge est
//    « pas su », jamais « en trop ». Ventes jamais publiées (`vendus: null`) ⇒ un
//    N° vu hors des annonces actuelles est « pas su » (il est peut-être vendu).
// ⚠️ AUCUN NUMÉRO N'EST CHANGÉ PAR L'INVENTAIRE (§5 : rien ne change un numéro
//    tout seul). Il n'écrit que SA ligne (`vrm_inventaire`). Les gestes du bilan
//    (ouvrir la fiche, « Je l'ai sortie ») passent par ceux du Stock.
// ⚠️ LE ROUGE (§7) : seulement deux paires présentes sous un même N° — le
//    conflit déjà connu de l'app (`vrm_num_doublons`, publié depuis
//    `conflitsDeNumeros`), ou deux cartons qu'IL dit porter le même N° pendant
//    l'inventaire (« C'est un 2ᵉ carton »). Tout le reste : vert (attendu),
//    ambre (en trop, vendu), neutre (pas su).
//
// LA LIGNE `vrm_inventaire` (synchronisée, survit à la fermeture de l'app) :
//   { rev, courant: Session | null, anciens: [Session] (≤ 3) }
//   Session = { id, debut, finAt, reprisAt, n, saisies: { [sid]: Saisie }, annulees: { [sid]: at } }
//   Saisie  = { k (clé du N°), s (tel que tapé), at (ms), c? ('meuble:case'), d? (1 = 2ᵉ carton) }
// Écrite par LIRE-FUSIONNER-RÉÉCRIRE en comparer-et-échanger sur `data.rev`
// (`enregistrerInventaire`, §5) : une lecture ratée n'écrit RIEN ; deux appareils
// au même moment ne perdent aucune saisie (union par `sid`, annulations comprises).

import { cleNum as cleNumServeur } from '../api/_lib/numerotation.js';

export const LIGNE_INVENTAIRE = 'vrm_inventaire';
// Un N° accepté : la règle de l'app (`NUM_OK`) — des chiffres, ou 1 à 3 lettres puis des chiffres.
export const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
const MAX_ANCIENS = 3;

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const estArchiveDe = (k, arch) => !!arch && new RegExp('^' + arch + '\\d+(\\+' + arch + '\\d+)*$').test(k);

// ── 1. L'ATTENDU, tel que le Stock le connaît ────────────────────────────────
//   stock = {
//     su        : au moins une lecture a répondu (`aa.su`)
//     articles  : `aa.articles` — { cle, numero, aussi, titre, photo, etat, plateformes, comptes }
//     manque    : `aa.manque` — les lectures qui manquent, NOMMÉES
//     vendus    : Set des clés prouvées vendues | null (jamais publié : pas su)
//     physiques : Set des clés présentes publiées (`vinted_nums_physiques`) | null
//     garder    : { [cle]: ts } — « Elle est encore là », « Remettre »
//     gardees   : { [cle]: { numero, titre } } — ce qu'on sait d'une paire gardée
//     jugeable  : (cle) => bool
//     connues   : Set des clés jamais données (pool, fiches) | null
//     archive   : 'B' | ''
//     doublons  : Set des clés en conflit (deux paires présentes) | null
//     slots     : { [cle]: { m, i } }
//   }
// Rend { unites: [{ id, cles, numero, titre, photo, etat, plateformes, comptes, source }],
//        parCle: Map<cle, unite>, sansNumero }.
export function indexerAttendu(stock, cle = cleNumServeur) {
  const s = stock || {};
  const unites = [], parCle = new Map();
  let sansNumero = 0;
  for (const a of (Array.isArray(s.articles) ? s.articles : [])) {
    if (!a) continue;
    const k0 = a.cle ? cle(a.cle) : (a.numero ? cle(a.numero) : '');
    if (!k0) { sansNumero += 1; continue; }
    const cles = [...new Set([k0, ...(Array.isArray(a.aussi) ? a.aussi : []).map((n) => cle(n)).filter(Boolean)])];
    const u = { id: 'a:' + k0, cles, numero: String(a.numero || k0), titre: String(a.titre || ''), photo: a.photo || null,
      etat: a.etat === 'aconfirmer' ? 'aconfirmer' : (a.etat === 'masquee' ? 'masquee' : 'enligne'),
      plateformes: Array.isArray(a.plateformes) ? a.plateformes : [], comptes: Array.isArray(a.comptes) ? a.comptes : [], source: 'annonce' };
    if (cles.some((k) => parCle.has(k))) continue;          // déjà porté (même paire sous deux N°)
    unites.push(u); for (const k of cles) parCle.set(k, u);
  }
  // Une paire qu'IL a dite « encore là » (gardée, remise) est attendue aussi.
  for (const k0 of Object.keys(estObjet(s.garder) ? s.garder : {})) {
    if (!s.garder[k0]) continue;
    const k = cle(k0); if (!k || parCle.has(k)) continue;
    const g = (estObjet(s.gardees) && s.gardees[k]) || {};
    const u = { id: 'g:' + k, cles: [k], numero: String(g.numero || k), titre: String(g.titre || ''), photo: g.photo || null, etat: 'gardee', plateformes: [], comptes: [], source: 'gardee' };
    unites.push(u); parCle.set(k, u);
  }
  return { unites, parCle, sansNumero };
}

// ── 2. LE JUGEMENT D'UN N° VU (le retour immédiat, et le bilan) ──────────────
// Rend { k, etat, raison, unite, doublon, parti, aConfirmer }.
//   etat : 'illisible' · 'attendu' · 'vendu' · 'trop' · 'passu'
//   raison (trop) : 'archive' · 'jamais' (jamais numéroté) · 'plusenligne'
//   parti (vendu) : true (colis parti selon VRM : à vérifier) · false (à envoyer) · null (pas su)
export function jugerSaisie(k, stock, { index = null, cle = cleNumServeur } = {}) {
  const s = stock || {};
  const kk = k ? cle(k) : '';
  if (!kk || !NUM_OK.test(kk)) return { k: kk, etat: 'illisible', raison: '', unite: null, doublon: false, parti: null, aConfirmer: false };
  const idx = index || indexerAttendu(s, cle);
  const doublon = !!(s.doublons && typeof s.doublons.has === 'function' && s.doublons.has(kk));
  const u = idx.parCle.get(kk) || null;
  const vendus = s.vendus && typeof s.vendus.has === 'function' ? s.vendus : null;
  // Une vendue l'emporte sur tout, comme dans le Stock (`classerRangees`).
  if (vendus && vendus.has(kk)) {
    const physiques = s.physiques && typeof s.physiques.has === 'function' ? s.physiques : null;
    return { k: kk, etat: 'vendu', raison: '', unite: u, doublon, parti: physiques ? !physiques.has(kk) : null, aConfirmer: false };
  }
  if (u) return { k: kk, etat: 'attendu', raison: u.source === 'gardee' ? 'gardee' : '', unite: u, doublon, parti: null, aConfirmer: u.etat === 'aconfirmer' };
  // Hors des annonces actuelles : en trop SEULEMENT si tout ce qui pourrait le porter a été lu.
  if (!vendus || !s.su || typeof s.jugeable !== 'function' || !s.jugeable(kk)) {
    return { k: kk, etat: 'passu', raison: !vendus ? 'ventes' : 'lectures', unite: null, doublon, parti: null, aConfirmer: false };
  }
  const raison = estArchiveDe(kk, s.archive) ? 'archive'
    : (s.connues && typeof s.connues.has === 'function' && !s.connues.has(kk) ? 'jamais' : 'plusenligne');
  return { k: kk, etat: 'trop', raison, unite: null, doublon, parti: null, aConfirmer: false };
}

// ── 3. LA SESSION : saisir, annuler, terminer, reprendre ─────────────────────
const idCourt = (at, alea = Math.random) => Number(at).toString(36) + Math.floor(alea() * 1679616).toString(36).padStart(4, '0');
export const nouvelleSession = ({ maintenant = Date.now(), id = null, alea = Math.random } = {}) =>
  ({ id: id || 'inv' + idCourt(maintenant, alea), debut: maintenant, finAt: 0, reprisAt: 0, n: 0, saisies: {}, annulees: {} });

// Les saisies encore valables (ni annulées), dans l'ordre où il les a dites.
export function saisiesVivantes(session) {
  if (!estObjet(session) || !estObjet(session.saisies)) return [];
  const mortes = estObjet(session.annulees) ? session.annulees : {};
  return Object.entries(session.saisies)
    .filter(([sid, x]) => estObjet(x) && x.k && !mortes[sid])
    .map(([sid, x]) => ({ sid, k: String(x.k), s: String(x.s == null ? x.k : x.s), at: Number(x.at) || 0, c: x.c ? String(x.c) : '', d: x.d ? 1 : 0 }))
    .sort((a, b) => (a.at - b.at) || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0));
}
// Le nombre de N° différents vus (un 2ᵉ carton du même N° compte une fois de plus).
export const compterVus = (session) => {
  const v = saisiesVivantes(session); const ks = new Set(v.map((x) => x.k));
  return ks.size + v.filter((x) => x.d).length;
};
export const enCours = (session) => estObjet(session) && !(Number(session.finAt) > Number(session.reprisAt || 0));
const avecN = (s) => ({ ...s, n: compterVus(s) });

export function ajouterSaisie(session, { k, s, at = Date.now(), c = '', d = 0, sid = null, alea = Math.random } = {}) {
  if (!estObjet(session) || !k) return session;
  const id = sid || ('s' + idCourt(at, alea));
  const x = { k: String(k), s: String(s == null ? k : s).slice(0, 24), at };
  if (c) x.c = String(c);
  if (d) x.d = 1;
  return avecN({ ...session, saisies: { ...(session.saisies || {}), [id]: x } });
}
// « Annuler le dernier » : la dernière saisie encore valable. Rend { session, annulee }.
export function annulerDerniere(session, at = Date.now()) {
  const v = saisiesVivantes(session);
  if (!v.length) return { session, annulee: null };
  const der = v[v.length - 1];
  return { session: avecN({ ...session, annulees: { ...(session.annulees || {}), [der.sid]: at } }), annulee: der };
}
// (9 nov.) `constat` : le bilan FIGÉ au moment où il termine (`constatInventaire`) — ce
// qu'il a constaté CE jour-là, relisible plus tard tel quel (« Inventaires précédents »),
// même quand les annonces ont changé depuis. Absent (inventaire d'avant) ⇒ rien d'inventé.
export const terminerSession = (session, at = Date.now(), constat = null) => {
  if (!estObjet(session)) return session;
  const finAt = Math.max(Number(at) || 0, Number(session.reprisAt || 0) + 1);
  return estObjet(constat) ? { ...session, finAt, constat: { ...constat, at: finAt } } : { ...session, finAt };
};
export const reprendreSession = (session, at = Date.now()) => (estObjet(session) ? { ...session, reprisAt: Math.max(Number(at) || 0, Number(session.finAt || 0) + 1) } : session);

// ── 4. LA FUSION (deux appareils, une écriture qui a raté) ───────────────────
// Union par `sid` (une saisie n'est jamais perdue), annulations unies, fin et
// reprise : la plus récente gagne. Deux sessions différentes : la plus récente
// est la courante, l'autre est gardée dans `anciens` (jamais jetée).
export function fusionnerSession(a, b) {
  if (!estObjet(a)) return estObjet(b) ? avecN(b) : null;
  if (!estObjet(b)) return avecN(a);
  const saisies = { ...(estObjet(b.saisies) ? b.saisies : {}), ...(estObjet(a.saisies) ? a.saisies : {}) };
  const annulees = { ...(estObjet(b.annulees) ? b.annulees : {}), ...(estObjet(a.annulees) ? a.annulees : {}) };
  const debut = Math.min(Number(a.debut) || Infinity, Number(b.debut) || Infinity);
  // (9 nov.) Le constat le plus récent gagne (une fin plus récente porte le sien).
  const ca = estObjet(a.constat) ? a.constat : null, cb = estObjet(b.constat) ? b.constat : null;
  const constat = ca && cb ? ((Number(cb.at) || 0) > (Number(ca.at) || 0) ? cb : ca) : (ca || cb);
  return avecN({ id: a.id, debut: Number.isFinite(debut) ? debut : 0,
    finAt: Math.max(Number(a.finAt) || 0, Number(b.finAt) || 0), reprisAt: Math.max(Number(a.reprisAt) || 0, Number(b.reprisAt) || 0), saisies, annulees,
    ...(constat ? { constat } : {}) });
}
export const inventaireVide = () => ({ courant: null, anciens: [] });
export function normaliserInventaire(d) {
  const o = estObjet(d) ? d : {};
  const courant = estObjet(o.courant) && o.courant.id ? o.courant : null;
  const anciens = Array.isArray(o.anciens) ? o.anciens.filter((x) => estObjet(x) && x.id) : [];
  return { courant, anciens };
}
export function fusionnerInventaire(serveur, local) {
  const A = normaliserInventaire(serveur), B = normaliserInventaire(local);
  const toutes = new Map();
  for (const s of [A.courant, ...A.anciens, B.courant, ...B.anciens]) {
    if (!s) continue;
    toutes.set(s.id, toutes.has(s.id) ? fusionnerSession(toutes.get(s.id), s) : avecN(s));
  }
  const liste = [...toutes.values()].sort((x, y) => (Number(y.debut) || 0) - (Number(x.debut) || 0) || (x.id < y.id ? 1 : -1));
  const courant = liste[0] || null;
  // Un ancien sans aucune saisie n'apprend rien : pas gardé.
  const anciens = liste.slice(1).filter((s) => Object.keys(s.saisies || {}).length).slice(0, MAX_ANCIENS);
  return { courant, anciens };
}
// (9 nov.) Comparé SANS l'ordre des clés : une ligne relue après fusion porte les mêmes
// saisies dans un autre ordre — sans ça, chaque rejeu (retour du réseau) réécrivait la
// ligne pour rien (rev +1). Rejouer est maintenant sans effet quand rien n'a changé.
const stable = (v) => (Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : (estObjet(v) ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v)));
const memeContenu = (x, y) => stable(normaliserInventaire(x)) === stable(normaliserInventaire(y));

// ── 5. L'ÉCRITURE : lire, fusionner, réécrire en comparer-et-échanger ─────────
//   lire()   → { existe, data } | null/undefined (pas su : RIEN ne s'écrit)
//   ecrire({ existe, rev, data }) → 'ok' | 'conflit' (la ligne a changé) | 'ko'
// Rend { ok, data (la ligne fusionnée), ecrit, raison }.
export async function enregistrerInventaire({ lire, ecrire, local, essais = 3 } = {}) {
  if (typeof lire !== 'function' || typeof ecrire !== 'function') return { ok: false, raison: 'outils', data: null, ecrit: false };
  for (let e = 0; e < essais; e++) {
    let l; try { l = await lire(); } catch (_) { l = null; }
    if (!l || typeof l !== 'object') return { ok: false, raison: 'lecture', data: null, ecrit: false };
    const brut = estObjet(l.data) ? l.data : {};
    const rev = Number.isSafeInteger(brut.rev) && brut.rev >= 0 ? brut.rev : null;
    const fusion = fusionnerInventaire(brut, local);
    if (l.existe && memeContenu(fusion, brut)) return { ok: true, raison: '', data: fusion, ecrit: false };
    let r; try { r = await ecrire({ existe: !!l.existe, rev, data: { ...fusion, rev: (rev == null ? 0 : rev) + 1 } }); } catch (_) { r = 'ko'; }
    if (r === 'ok') return { ok: true, raison: '', data: fusion, ecrit: true };
    if (r !== 'conflit') return { ok: false, raison: 'ecriture', data: null, ecrit: false };
  }
  return { ok: false, raison: 'conflit', data: null, ecrit: false };
}

// ── 6. LE BILAN ─────────────────────────────────────────────────────────────
// Rend {
//   n, vus: [{ k, s, fois, cases, jugement }],
//   attendus, vendus, trop, passu, illisibles  — les N° vus, par jugement
//   manque     : unités attendues pas vues (lectures fraîches seulement)
//   aConfirmer : unités « à confirmer » pas vues (lecture vieille : pas su)
//   doublons   : N° vus portés par deux paires (conflit connu, ou 2ᵉ carton dit)
//   pasASaPlace: N° attendus vus dans une autre case que la leur (inventaire case par case)
//   vendusNonVus: vendus à envoyer (encore présents selon VRM) pas vus — déjà emballés ?
//   lectures   : les lectures qui manquent (nommées) · sansNumero · su
// }
export function bilanInventaire({ session, stock, cle = cleNumServeur } = {}) {
  const s = stock || {};
  const idx = indexerAttendu(s, cle);
  const vivantes = saisiesVivantes(session);
  const parK = new Map();
  for (const x of vivantes) {
    const k = cle(x.k); if (!k) continue;
    const e = parK.get(k) || { k, s: x.s, fois: 0, deuxieme: false, cases: new Set(), at: x.at };
    e.fois += 1; if (x.d) e.deuxieme = true; if (x.c) e.cases.add(x.c);
    parK.set(k, e);
  }
  const vus = [], attendus = [], vendus = [], trop = [], passu = [], illisibles = [], doublons = [], pasASaPlace = [];
  const vusCles = new Set();
  for (const e of parK.values()) {
    const j = jugerSaisie(e.k, s, { index: idx, cle });
    const v = { k: e.k, s: e.s, fois: e.fois, cases: [...e.cases], jugement: j };
    vus.push(v); vusCles.add(e.k);
    if (j.etat === 'attendu') attendus.push(v);
    else if (j.etat === 'vendu') vendus.push(v);
    else if (j.etat === 'trop') trop.push(v);
    else if (j.etat === 'passu') passu.push(v);
    else illisibles.push(v);
    if (j.etat !== 'illisible' && (j.doublon || e.deuxieme)) doublons.push({ ...v, raison: e.deuxieme ? 'cartons' : 'conflit' });
    if (j.etat === 'attendu' && e.cases.size && estObjet(s.slots)) {
      const sl = s.slots[e.k] || (j.unite ? j.unite.cles.map((c) => s.slots[c]).find(Boolean) : null);
      if (sl && sl.m != null && !e.cases.has(String(sl.m) + ':' + Number(sl.i))) pasASaPlace.push({ ...v, notee: { m: String(sl.m), i: Number(sl.i) } });
    }
  }
  const vendusSet = s.vendus && typeof s.vendus.has === 'function' ? s.vendus : null;
  const manque = [], aConfirmer = [];
  if (s.su) {
    for (const u of idx.unites) {
      if (u.cles.some((k) => vusCles.has(k))) continue;
      if (vendusSet && u.cles.some((k) => vendusSet.has(k))) continue;   // vendue : pas « attendue », elle part
      if (u.etat === 'aconfirmer') aConfirmer.push(u); else manque.push(u);
    }
  }
  const vendusNonVus = [];
  if (vendusSet && s.physiques && typeof s.physiques.has === 'function') {
    for (const k of vendusSet) if (s.physiques.has(k) && !vusCles.has(k)) vendusNonVus.push(k);
  }
  const triK = (a, b) => { const x = String(a.k || a.cles[0]), y = String(b.k || b.cles[0]); const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y); return nx && ny ? Number(x) - Number(y) : (nx ? -1 : ny ? 1 : x.localeCompare(y)); };
  [attendus, vendus, trop, passu, illisibles, doublons, pasASaPlace, manque, aConfirmer].forEach((l) => l.sort(triK));
  return { n: compterVus(session), vus, attendus, vendus, trop, passu, illisibles, manque, aConfirmer, doublons, pasASaPlace,
    vendusNonVus: vendusNonVus.sort(), lectures: Array.isArray(s.manque) ? s.manque : [], sansNumero: idx.sansNumero, su: !!s.su };
}

// ── 7. LE CONSTAT FIGÉ (9 nov.) ─────────────────────────────────────────────
// Ce que le bilan disait AU MOMENT où il a terminé : des N° et des nombres, rien
// d'autre (ni titre, ni photo, ni compte — la ligne reste légère). `base` : l'heure
// de la liste des paires utilisée quand l'inventaire a été fait HORS CONNEXION
// (src/inventaireHorsLigne.js) ; `null` = la liste du moment, lue en ligne.
// « Pas su » reste « pas su » : `su: false` ⇒ aucun « à chercher » n'est figé.
const MAX_CONSTAT = 300;
export function constatInventaire(bilan, { base = null } = {}) {
  if (!estObjet(bilan)) return null;
  const ks = (l) => (Array.isArray(l) ? l : []).map((v) => String(v.k)).slice(0, MAX_CONSTAT);
  const ns = (l) => (Array.isArray(l) ? l : []).map((u) => String(u.numero || (u.cles && u.cles[0]) || '')).filter(Boolean).slice(0, MAX_CONSTAT);
  return {
    v: 1, base: Number.isFinite(base) ? base : null, su: !!bilan.su,
    vus: Number(bilan.n) || 0, attendus: Array.isArray(bilan.attendus) ? bilan.attendus.length : 0,
    manque: bilan.su ? ns(bilan.manque) : [], aConfirmer: ns(bilan.aConfirmer),
    trop: ks(bilan.trop), vendus: ks(bilan.vendus), doublons: ks(bilan.doublons), passu: ks(bilan.passu),
    lectures: (Array.isArray(bilan.lectures) ? bilan.lectures : []).map((m) => String((m && m.nom) || '')).filter(Boolean).slice(0, 20),
  };
}
