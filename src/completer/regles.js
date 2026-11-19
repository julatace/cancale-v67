// ════════════════════════════════════════════════════════════════════════════
//  L'ATELIER « COMPLÉTER » — LES RÈGLES (19 nov. 2026, lot completer-infos)
// ════════════════════════════════════════════════════════════════════════════
// Julien (19 nov., mot pour mot) : « essaye de trouver autre chose pour relier les achats, mettre
// les prix plancher minimum, mettre les prix — toutes les informations en fait sur les annonces,
// sur les paires, ça doit être beaucoup [plus simple et rapide] ». Puis : « dis-toi que l'outil
// doit être pratique, pas chiant ».
//
// UN atelier, UNE question à la fois (src/completer/Completer.jsx). Ce module est PUR : il range
// la file, dit QUELLES questions manquent, calcule les puces de prix mini, l'aperçu de la règle en
// lot et les écritures (des opérations de src/gesteAnnulable.js : une réponse = un geste annulable,
// une lecture ratée n'écrit rien). Il ne décide d'AUCUNE notion : chaque manque vient de SA règle —
//   · « sans prix mini »   : `lignesManquantes` (src/prixMiniManquants.js, ce que le MOTEUR lit) ;
//   · « sans prix d'achat »: `sansAchatRelie` (src/achatsARelier.js) pour une annonce numérotée ;
//                            la liste des ventes est celle de l'app (ni prix ni achat relié) ;
//   · un achat proposé     : l'affectation de src/liaisonAchat.js (la « très probable », puis les
//                            pistes qui passent ses filtres durs) — une PROPOSITION ; c'est SON
//                            toucher qui relie, par le n° de transaction de la carte touchée (§5) ;
//   · un achat libre       : `achatDisponible` (un achat relié n'est plus proposé, un lot l'est
//                            jusqu'à son nombre d'articles).
// §2.5 : aucun prix d'achat n'est deviné. Le prix d'un achat RELIÉ est celui qu'il a payé
// (`propositionPrixAchat` : le reçu juste, sinon l'article) ; « Je ne sais plus » n'écrit aucun prix.
// §3 : le prix mini ne sert que si l'acceptation automatique est allumée ; les puces sont des
// CALCULS dits (« −15 % → 72 € ») depuis SON prix ou SON achat — jamais un prix conseillé.
// Exécuté par scripts/audit-completer.cjs (avec ses mutations).
// ════════════════════════════════════════════════════════════════════════════
import { lignesManquantes, apercuLigne } from '../prixMiniManquants.js';
import { sansAchatRelie } from '../achatsARelier.js';
import { montantSeuil } from '../offresSures.js';
import { achatDisponible, lotDe } from '../suggestionsAchat.js';

export const CLE_SANS = 'vrm_completer_sans';          // { 'a:<id>|achat': at } — « Je ne sais plus », synchronisé
export const CLE_REPRISE = 'vrm_completer_reprise';    // { sujet, cle } — où il s'est arrêté (cet appareil)
export const SUJETS = ['tout', 'achat', 'mini', 'prix', 'numero'];
export const ORDRE_QUESTIONS = ['numero', 'achat', 'prix', 'mini'];   // le N° d'abord, le mini en dernier (ses puces lisent le prix et l'achat)
export const VENTES_JOURS = 30;                        // au-delà : « ventes plus anciennes », comptées à part, jamais cachées
export const LOT_POURCENTS = [10, 15, 20];
export const ACHAT_PLUS = 10;                          // « achat + 10 € »
export const LOT_SEUIL = 5;                            // à partir de 5 sans prix mini, l'entrée « prix mini » ouvre la règle en lot
export const DUREE_ANNULER = 10000;                    // ms : le bandeau « Annuler » d'une réponse

const J = 86400e3;
const cts = (x) => Math.round(Number(x) * 100);
const nombre = (v) => { const x = v && typeof v === 'object' ? v.amount : v; if (x == null || String(x).trim() === '') return null; const n = Number(String(x).replace(/\s|€/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const positif = (v) => { const n = nombre(v); return n != null && n > 0 ? n : null; };
export const cleAnnonce = (id) => `a:${id}`;
export const cleVente = (tx) => `v:${tx}`;
export const cleFiche = (id) => `f:${id}`;
export const cleSans = (cle, sujet) => `${cle}|${sujet}`;

// ── LA FILE ─────────────────────────────────────────────────────────────────
// annonces     : ses annonces EN LIGNE, forme de `annSelectionnables` ({ id, uid, compte, titre, prix,
//                photo, numero, taille, favoris, offres, createdTs, verif: { achat } }) ; pas lues ⇒ null ;
// numeros      : les fiches par identifiant d'annonce ;
// prixAchat    : (fiche) → nombre | null — la règle de l'app (`prixAchatDe`) ;
// ventes       : celles que l'app dit « sans prix d'achat ni achat relié » ({ tx, idf, titre, prix,
//                photo, taille, numero, compte, ts }) ; pas lues ⇒ null ;
// fichesNeuves : les fiches « À publier » ({ id, numero, titre, taille, prix, photo }) ;
// sansNumero   : les identifiants d'annonce à qui l'app DEMANDE un N° (mode « je numérote moi-même ») ;
// sans         : `vrm_completer_sans` (« Je ne sais plus », par article ET par question).
// Rend { file, anciennes, mis, etat } : `file` rangée, chaque article avec SES manques seulement.
export function fileCompleter({ annonces, numeros = {}, prixAchat = null, ventes, fichesNeuves = [], sansNumero = null, sans = null,
  virgule = false, miniActif = true, maintenant = Date.now(), joursVentes = VENTES_JOURS } = {}) {
  const S = sans && typeof sans === 'object' ? sans : {};
  const mis = [];
  const garde = (cle, manques) => manques.filter((m) => { if (S[cleSans(cle, m)] == null) return true; mis.push({ cle, sujet: m }); return false; });
  const recentes = [], anciennes = [], chaudes = [], calmes = [], neuves = [];

  if (Array.isArray(ventes)) {
    const vus = new Set();
    for (const v of ventes) {
      if (!v || v.tx == null) continue;
      const cle = cleVente(v.tx); if (vus.has(cle)) continue; vus.add(cle);
      const manques = garde(cle, ['achat']);
      if (!manques.length) continue;
      const ts = Number(v.ts);
      const art = { cle, genre: 'vente', tx: String(v.tx), idf: v.idf != null && String(v.idf) !== '' ? String(v.idf) : null, id: null, uid: String(v.uid || ''),
        numero: String(v.numero || ''), titre: String(v.titre || ''), taille: String(v.taille || ''), prix: positif(v.prix), photo: typeof v.photo === 'string' ? v.photo : '',
        site: String(v.site || 'vinted'), compte: String(v.compte || ''), favoris: 0, offres: 0, ts: Number.isFinite(ts) ? ts : null, achat: null, frais: null, manques };
      if (art.ts != null && maintenant - art.ts <= joursVentes * J) recentes.push(art); else anciennes.push(art);
    }
  }
  if (Array.isArray(annonces)) {
    const minis = lignesManquantes({ annonces, numeros, virgule }) || [];
    const sansMini = new Map(minis.map((l) => [String(l.id), l]));
    const aNum = sansNumero instanceof Set ? sansNumero : new Set((Array.isArray(sansNumero) ? sansNumero : []).map(String));
    const vus = new Set();
    for (const a of annonces) {
      if (!a || a.id == null) continue;
      if (a.etat != null && a.etat !== 'en-ligne') continue;
      const id = String(a.id); if (vus.has(id)) continue; vus.add(id);
      const f = numeros[id] || null;
      const cle = cleAnnonce(id);
      const bruts = [];
      if (aNum.has(id) && !String((f && f.numero) || '').trim()) bruts.push('numero');
      if (sansAchatRelie(f, prixAchat)) bruts.push('achat');
      if (sansMini.has(id)) bruts.push('mini');
      const manques = garde(cle, bruts);
      if (!manques.length) continue;
      const lm = sansMini.get(id) || null;
      const achatBrut = a.verif ? a.verif.achat : a.achat;
      const achat = achatBrut != null && Number.isFinite(Number(achatBrut)) && Number(achatBrut) >= 0 ? Number(achatBrut) : null;
      const art = { cle, genre: 'annonce', id, tx: null, idf: id, uid: String(a.uid || ''), numero: String(a.numero || (f && f.numero) || ''), titre: String(a.titre || ''),
        taille: String(a.taille || ''), prix: positif(a.prix), photo: typeof a.photo === 'string' ? a.photo : '', site: String(a.site || 'vinted'), compte: String(a.compte || ''),
        favoris: Math.max(0, Number(a.favoris) || 0), offres: Math.max(0, Number(a.offres) || 0), ts: Number.isFinite(Number(a.createdTs)) ? Number(a.createdTs) : null,
        achat, frais: lm ? lm.frais : 0, manques };
      (art.favoris > 0 || art.offres > 0 ? chaudes : calmes).push(art);
    }
  }
  for (const f of (Array.isArray(fichesNeuves) ? fichesNeuves : [])) {
    if (!f || f.id == null || positif(f.prix) != null) continue;
    const cle = cleFiche(f.id);
    const manques = garde(cle, ['prix']);
    if (!manques.length) continue;
    neuves.push({ cle, genre: 'fiche', id: String(f.id), tx: null, idf: null, uid: '', numero: String(f.numero || ''), titre: String(f.titre || ''), taille: String(f.taille || ''),
      prix: null, photo: typeof f.photo === 'string' ? f.photo : '', site: 'vrm', compte: '', favoris: 0, offres: 0, ts: null, achat: null, frais: null, manques });
  }
  const parNum = (x, y) => String(x.numero).localeCompare(String(y.numero), 'fr', { numeric: true });
  const parPrix = (x, y) => (y.prix == null ? -1 : y.prix) - (x.prix == null ? -1 : x.prix) || parNum(x, y);
  // Le plus utile d'abord : les vendues (le bénéfice en dépend), la plus récente en tête ; puis ce qui est en
  // ligne et regardé (offres, puis favoris) ; puis le reste, le plus d'argent en jeu d'abord ; puis « À publier ».
  recentes.sort((x, y) => (y.ts || 0) - (x.ts || 0));
  anciennes.sort((x, y) => (y.ts || 0) - (x.ts || 0));
  chaudes.sort((x, y) => y.offres - x.offres || y.favoris - x.favoris || parPrix(x, y));
  calmes.sort(parPrix);
  neuves.sort(parNum);
  for (const a of recentes) a.rang = 1; for (const a of chaudes) a.rang = 2; for (const a of calmes) a.rang = 3; for (const a of neuves) a.rang = 4; for (const a of anciennes) a.rang = 5;
  return { file: [...recentes, ...chaudes, ...calmes, ...neuves], anciennes, mis, miniActif: miniActif !== false,
    etat: { annonces: Array.isArray(annonces) ? 'lu' : 'pas-su', ventes: Array.isArray(ventes) ? 'lu' : 'pas-su' } };
}

// Les questions d'UN article pour un sujet : seulement ce qui MANQUE, dans l'ordre.
// `miniActif` faux (acceptation automatique éteinte, §3) : le prix mini ne sert à rien aujourd'hui — il
// n'est demandé que s'il le DEMANDE (sujet « mini »), jamais dans « tout » (pratique, pas pénible).
export function questionsDe(article, sujet = 'tout', miniActif = true) {
  const m = (article && Array.isArray(article.manques)) ? article.manques : [];
  return ORDRE_QUESTIONS.filter((q) => m.includes(q) && (sujet === q || ((sujet === 'tout' || sujet === 'anciennes') && (q !== 'mini' || miniActif !== false))));
}
// La file d'un sujet (les ventes plus anciennes : leur propre file).
export function filtrer(res, sujet = 'tout') {
  const r = res || {};
  if (sujet === 'anciennes') return Array.isArray(r.anciennes) ? r.anciennes : [];
  const l = Array.isArray(r.file) ? r.file : [];
  return l.filter((a) => questionsDe(a, sujet, r.miniActif).length > 0);
}
// Les compteurs PAR SORTE (ce que l'entrée de l'atelier dit ; `null` = pas su, jamais 0).
export function compteurs(res) {
  if (!res || !res.etat) return null;
  const f = Array.isArray(res.file) ? res.file : [];
  const n = (q, g) => f.filter((a) => a.manques.includes(q) && (!g || a.genre === g)).length;
  const lu = res.etat.annonces === 'lu', luV = res.etat.ventes === 'lu';
  const tout = f.map((a) => questionsDe(a, 'tout', res.miniActif).length);
  return {
    articles: lu && luV ? tout.filter(Boolean).length : null,
    questions: lu && luV ? tout.reduce((s, x) => s + x, 0) : null,
    achatVentes: luV ? n('achat', 'vente') : null, achatAnnonces: lu ? n('achat', 'annonce') : null,
    achat: lu && luV ? n('achat') : null, mini: lu ? n('mini') : null, numero: lu ? n('numero') : null, prix: n('prix'),
    anciennes: luV ? (res.anciennes || []).length : null, mis: (res.mis || []).length, miniActif: res.miniActif !== false,
  };
}

// ── LE PRIX MINI : des puces CALCULÉES et DITES ─────────────────────────────
// « −15 % → 72 € » : SON prix moins 15 %, à l'euro du dessous (en centimes entiers, sans virgule
// flottante) ; « achat + 10 € → 62 € » : SON achat plus 10 €, au centime. Jamais un prix conseillé.
export function miniPourcent(prix, pct) {
  const p = positif(prix), q = Number(pct);
  if (p == null || !Number.isFinite(q) || q <= 0 || q >= 100) return null;
  const c = Math.floor((cts(p) * Math.round((100 - q) * 100)) / 1000000) * 100;
  return c > 0 && c < cts(p) ? c / 100 : null;
}
export function miniAchatPlus(achat, plus) {
  const a = nombre(achat), n = Number(plus);
  if (a == null || a < 0 || !Number.isFinite(n) || n < 0) return null;
  const c = cts(a) + cts(n);
  return c > 0 ? c / 100 : null;
}
// Le jugement d'une valeur : sous SON coût (achat + frais saisis) · au prix ou plus (n'accepterait rien).
export function jugerMini(article, valeur) {
  const a = article || {};
  const r = apercuLigne({ achat: a.achat == null ? null : a.achat, frais: a.frais == null ? (a.achat == null ? null : 0) : a.frais, prix: a.prix == null ? null : a.prix }, valeur == null ? '' : String(valeur).replace('.', ','));
  return { valeur: r.valeur, erreur: r.erreur, sousAchat: !!r.sousCout, auPrix: !!r.auPrix, cout: r.cout, benefice: r.benefice };
}
// Les puces d'un article : [{ id, sorte: 'pct' | 'achat', v, valeur, sousAchat, cout }]. Une puce « au prix
// ou plus » n'est pas montrée (elle n'accepterait aucune offre) ; deux puces de même valeur : une seule.
export function pucesMini(article, { pourcents = LOT_POURCENTS, plus = ACHAT_PLUS } = {}) {
  const a = article || {}, out = [], vues = new Set();
  const ajoute = (id, sorte, v, valeur) => {
    if (valeur == null) return;
    const j = jugerMini(a, valeur);
    if (j.valeur == null || j.auPrix || vues.has(cts(valeur))) return;
    vues.add(cts(valeur));
    out.push({ id, sorte, v, valeur, sousAchat: j.sousAchat, cout: j.cout });
  };
  for (const p of pourcents) ajoute('p' + p, 'pct', p, miniPourcent(a.prix, p));
  if (a.achat != null) ajoute('a' + plus, 'achat', plus, miniAchatPlus(a.achat, plus));
  return out;
}

// ── LA RÈGLE EN LOT ─────────────────────────────────────────────────────────
// regle : { sorte: 'pct', v: 15 } (prix − 15 %) ou { sorte: 'achat', v: 10 } (achat + 10 €).
// Rend une ligne par article sans prix mini : { cle, id, numero, titre, photo, prix, achat, mini,
// ecartee: '' | 'prix' | 'achat' | 'au-prix' | 'sous-achat', cochable, coche }.
//   · prix (ou achat) pas connu ⇒ écartée, rien à poser (jamais un mini inventé) ;
//   · au prix ou plus ⇒ écartée (elle n'accepterait rien) ;
//   · sous SON achat ⇒ écartée ET DITE ; il peut la cocher (son choix), jamais cochée d'office.
export function apercuLot(articles, regle) {
  const r = regle && (regle.sorte === 'pct' || regle.sorte === 'achat') ? regle : null;
  const out = [];
  for (const a of (Array.isArray(articles) ? articles : [])) {
    if (!a || a.genre !== 'annonce' || !a.manques.includes('mini')) continue;
    let mini = null, ecartee = '';
    if (!r) ecartee = 'regle';
    else if (r.sorte === 'pct') { if (a.prix == null) ecartee = 'prix'; else mini = miniPourcent(a.prix, r.v); }
    else { if (a.achat == null) ecartee = 'achat'; else mini = miniAchatPlus(a.achat, r.v); }
    if (!ecartee && mini == null) ecartee = 'prix';
    let cochable = false;
    if (!ecartee) {
      const j = jugerMini(a, mini);
      if (j.valeur == null) ecartee = 'prix';
      else if (j.auPrix) ecartee = 'au-prix';
      else if (j.sousAchat) { ecartee = 'sous-achat'; cochable = true; }
      else cochable = true;
    }
    out.push({ cle: a.cle, id: a.id, numero: a.numero, titre: a.titre, photo: a.photo, prix: a.prix, achat: a.achat, mini: ecartee && !cochable ? null : mini, ecartee, cochable, coche: !ecartee });
  }
  return out;
}
// Ce qui sera écrit : les lignes cochables que `choix` garde. `choix` : { [cle]: true | false } —
// SES touchers ; absent ⇒ la coche d'origine de l'aperçu. L'aperçu EST l'écriture : même valeur.
export function ecrituresLot(apercu, choix = null) {
  const out = [];
  for (const l of (Array.isArray(apercu) ? apercu : [])) {
    if (!l || !l.cochable || l.mini == null) continue;
    const c = choix && Object.prototype.hasOwnProperty.call(choix, l.cle) ? !!choix[l.cle] : !!l.coche;
    if (c) out.push({ cle: l.cle, id: l.id, numero: l.numero, min: montantSeuil(String(l.mini)), valeur: l.mini });
  }
  return out;
}

// ── LES ACHATS PROPOSÉS (3 au plus) ─────────────────────────────────────────
// liaison : l'affectation de src/liaisonAchat.js ({ parArticle, pistes }) — la « très probable » d'abord,
// puis les pistes ; identite : l'achat qu'une IDENTITÉ désigne (même fichier photo, src/prixAchatPropose.js).
// Un achat déjà relié n'est pas proposé (un lot jusqu'à son nombre) ; un achat « hors relier » non plus.
// Rend { liste: [{ tx, achat, niveau: 'identite' | 'tres-probable' | 'piste', p }], autres }.
export function candidatsAchat({ article, liaison = null, liens = null, identite = null, horsRelier = null, max = 3 } = {}) {
  const out = [], vus = new Set();
  const cle = article ? article.cle : '';
  const ajoute = (achat, niveau, p) => {
    const tx = achat && achat.transaction_id != null ? String(achat.transaction_id) : '';
    if (!tx || vus.has(tx)) return;
    if (!achatDisponible(achat, liens || new Map())) return;
    if (typeof horsRelier === 'function' && horsRelier(achat)) return;
    vus.add(tx); out.push({ tx, achat, niveau, p: p || null, lot: !!lotDe(achat).lot });
  };
  if (identite && identite.achat) ajoute(identite.achat, 'identite', null);
  const L = liaison && typeof liaison === 'object' ? liaison : null;
  for (const p of ((L && L.parArticle && L.parArticle[cle]) || [])) ajoute(p.achat, 'tres-probable', p);
  for (const p of ((L && L.pistes && L.pistes[cle]) || [])) ajoute(p.achat, 'piste', p);
  return { liste: out.slice(0, max), autres: Math.max(0, out.length - max) };
}

// ── LES ÉCRITURES (opérations de src/gesteAnnulable.js) ─────────────────────
// Toutes lisent les valeurs COURANTES passées (`fiches`, `ventes`, `prixParNum`, `sans`) : la sous-valeur
// d'avant est rendue par « Annuler ». Une cible sans identité ⇒ [] (rien n'est écrit).
const ficheDe = (article, fiches) => { const k = article && article.idf != null ? String(article.idf) : ''; const f = k ? (fiches || {})[k] : null; return f && typeof f === 'object' ? { k, f } : null; };

// Un prix d'achat TAPÉ (`patch` : l'écriture de src/prixAuNumerotage.js, { buyPrice, buyFromId: null, buyFrom: null }).
export function opsPrixAchat({ article, patch, fiches = {}, ventes = {}, prixParNum = {}, ficheNeuve = null } = {}) {
  if (!article || !patch || patch.buyPrice == null || String(patch.buyPrice).trim() === '') return [];
  const ops = [];
  const x = ficheDe(article, fiches);
  if (x) {
    ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: x.k, apres: { buyPrice: patch.buyPrice, buyFromId: null, buyFrom: null }, avant: { buyPrice: x.f.buyPrice, buyFromId: x.f.buyFromId, buyFrom: x.f.buyFrom } });
    const n = String(x.f.numero == null ? '' : x.f.numero).trim();
    if (n) ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: n, apres: String(patch.buyPrice), avant: (prixParNum || {})[n] });
    return ops;
  }
  if (article.genre === 'annonce' && article.id != null && ficheNeuve && typeof ficheNeuve === 'object') {
    return [{ k: 'vinted_annonce_numeros', type: 'cle', id: String(article.id), apres: { ...ficheNeuve, buyPrice: patch.buyPrice, buyFromId: null, buyFrom: null }, avant: undefined }];
  }
  if (article.genre === 'vente' && article.tx != null && String(article.tx) !== '') {
    const tx = String(article.tx), cur = (ventes || {})[tx];
    const apres = { ...(cur && typeof cur === 'object' ? cur : {}), buyPrice: patch.buyPrice };
    delete apres.buyFromId; delete apres.buyFrom;
    return [{ k: 'vinted_sale_overrides', type: 'cle', id: tx, apres, avant: cur && typeof cur === 'object' ? cur : undefined }];
  }
  return [];
}
// Un (ou des) prix mini : [{ id, min }] (`min` déjà normalisé « 45.5 », lisible par le moteur).
export function opsMini(ecritures, { fiches = {}, ficheNeuveDe = null } = {}) {
  const ops = [];
  for (const w of (Array.isArray(ecritures) ? ecritures : [])) {
    if (!w || w.id == null || w.min == null || String(w.min).trim() === '') continue;
    const k = String(w.id), f = (fiches || {})[k];
    if (f && typeof f === 'object') ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: k, apres: { min: String(w.min) }, avant: { min: f.min } });
    else {
      const neuve = typeof ficheNeuveDe === 'function' ? ficheNeuveDe(k) : null;
      if (neuve && typeof neuve === 'object') ops.push({ k: 'vinted_annonce_numeros', type: 'cle', id: k, apres: { ...neuve, min: String(w.min) }, avant: undefined });
    }
  }
  return ops;
}
// Le prix d'une fiche « À publier » (VRM seulement : rien ne part chez Vinted).
export function opsPrixFiche({ article, prix, fichesNeuves = {} } = {}) {
  const p = positif(prix);
  const f = article && article.genre === 'fiche' ? (fichesNeuves || {})[String(article.id)] : null;
  if (p == null || !f || typeof f !== 'object') return [];
  return [{ k: 'vrm_fiches_neuves', type: 'champs', id: String(article.id), apres: { prix: Math.round(p * 100) / 100 }, avant: { prix: f.prix } }];
}
// « Je ne sais plus » / « Pas de prix mini » : l'article sort de la file POUR CETTE QUESTION, noté — aucun prix écrit.
export function opsSans({ article, sujet, sans = {}, at = new Date().toISOString() } = {}) {
  if (!article || !article.cle || !ORDRE_QUESTIONS.includes(sujet)) return [];
  const id = cleSans(article.cle, sujet);
  return [{ k: CLE_SANS, type: 'cle', id, apres: at, avant: (sans || {})[id] }];
}
// « Les revoir » : tout ce qu'il avait mis de côté revient (les notes sont retirées, rien d'autre).
export function opsRevoir(sans = {}) {
  return Object.keys(sans || {}).map((id) => ({ k: CLE_SANS, type: 'cle', id, apres: undefined, avant: sans[id] }));
}

// ── CE QUI EST CERTAIN SE REMPLIT SANS LUI (19 nov., Julien) ────────────────
// Un article qu'IL a déjà relié à un achat (`buyFromId`, son toucher) et dont le prix d'achat est resté vide :
// le prix est celui qu'il a payé pour CET achat (`propositionDe(achat)` : `propositionPrixAchat`, le reçu
// juste sinon l'article — jamais pour un lot, dont le prix par article ne se devine pas). Rien d'autre n'est
// rempli seul : une ressemblance, une photo ne relient jamais sans son toucher (§5).
// entrees : [{ ou: 'fiche' | 'vente', cle, entree }] ; achatDe(tx) → l'achat lu ou null.
export function prixCertains({ entrees, achatDe, propositionDe } = {}) {
  const out = [];
  for (const x of (Array.isArray(entrees) ? entrees : [])) {
    const e = x && x.entree;
    if (!e || e.buyFromId == null || String(e.buyFromId).trim() === '') continue;
    if (e.buyPrice != null && String(e.buyPrice).trim() !== '') continue;
    if (e.buyFrom && e.buyFrom.aSaisir) continue;                          // un article de lot : son prix est à saisir
    const a = typeof achatDe === 'function' ? achatDe(String(e.buyFromId)) : null;
    if (!a || String(a.transaction_id) !== String(e.buyFromId) || lotDe(a).lot) continue;
    const p = typeof propositionDe === 'function' ? propositionDe(a) : null;
    if (!p || !Number.isSafeInteger(p.centimes) || p.centimes <= 0 || String(p.tx) !== String(e.buyFromId)) continue;
    out.push({ ou: x.ou, cle: String(x.cle), numero: String(e.numero || '').trim(), buyPrice: p.valeur, centimes: p.centimes });
  }
  return out;
}
export function opsPrixCertains(certains, { fiches = {}, ventes = {}, prixParNum = {} } = {}) {
  const ops = [];
  for (const c of (Array.isArray(certains) ? certains : [])) {
    if (c.ou === 'fiche') {
      const f = (fiches || {})[c.cle]; if (!f || typeof f !== 'object') continue;
      ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: c.cle, apres: { buyPrice: c.buyPrice }, avant: { buyPrice: f.buyPrice } });
      const n = String(f.numero == null ? '' : f.numero).trim();
      if (n) ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: n, apres: String(c.buyPrice), avant: (prixParNum || {})[n] });
    } else if (c.ou === 'vente') {
      const v = (ventes || {})[c.cle]; if (!v || typeof v !== 'object') continue;
      ops.push({ k: 'vinted_sale_overrides', type: 'cle', id: c.cle, apres: { ...v, buyPrice: c.buyPrice }, avant: v });
    }
  }
  return ops;
}

// ── LA PROGRESSION ET LA REPRISE ────────────────────────────────────────────
// « 12 sur 51 » : `fait` (réponses données depuis l'ouverture) sur `fait + reste`. Ce qui reste, par sorte.
export function progression({ file, sujet = 'tout', fait = 0, miniActif = true } = {}) {
  const l = Array.isArray(file) ? file : [];
  const reste = { achat: 0, mini: 0, prix: 0, numero: 0 };
  for (const a of l) for (const q of questionsDe(a, sujet, miniActif)) reste[q]++;
  return { fait, total: fait + l.length, reste };
}
// Où reprendre : l'article noté s'il est encore dans la file, sinon le premier. `passes` : ceux qu'il a
// remis à « plus tard » pendant cette séance (en fin de file, jamais retirés).
export function ordreSeance(file, passes = null) {
  const l = Array.isArray(file) ? file : [];
  const p = passes instanceof Set ? passes : new Set(passes || []);
  return p.size ? [...l.filter((a) => !p.has(a.cle)), ...l.filter((a) => p.has(a.cle))] : l;
}
export function indexReprise(file, reprise, sujet = 'tout') {
  const l = Array.isArray(file) ? file : [];
  if (!reprise || reprise.sujet !== sujet || !reprise.cle) return 0;
  const i = l.findIndex((a) => a.cle === reprise.cle);
  return i < 0 ? 0 : i;
}
// L'article demandé par son N° (« ouvrirCompleter({ num }) ») : sa place dans la file, ou -1.
export function indexNumero(file, num) {
  const n = String(num == null ? '' : num).trim().toUpperCase().replace(/^N°\s*/, '');
  if (!n) return -1;
  return (Array.isArray(file) ? file : []).findIndex((a) => String(a.numero || '').trim().toUpperCase() === n);
}

// ── LE PAVÉ NUMÉRIQUE ───────────────────────────────────────────────────────
// La saisie est un TEXTE (« 52,5 ») : chiffres, une virgule, deux décimales au plus, 6 chiffres avant.
export function toucheSuivante(texte, touche) {
  const t = String(texte || '');
  if (touche === 'efface') return t.slice(0, -1);
  if (touche === ',' || touche === '.') { if (t.includes(',')) return t; return (t === '' ? '0' : t) + ','; }
  if (!/^\d$/.test(String(touche))) return t;
  const [e, d] = t.split(',');
  if (d !== undefined) return d.length >= 2 ? t : t + touche;
  if (e === '0') return String(touche);
  return e.length >= 6 ? t : t + touche;
}
export function montantTape(texte) {
  const s = String(texte || '').replace(/,$/, '');
  if (!/^\d{1,6}(?:,\d{1,2})?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return n > 0 ? Math.round(n * 100) / 100 : null;
}
