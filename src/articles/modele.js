// ══════════════════════════════════════════════════════════════════════════
//  L'ARTICLE, PAS L'ANNONCE VINTED (19 nov. 2026)
//
//  Julien, 19 novembre (photo de l'écran Annonces → Leboncoin : des rangées vides et un
//  énorme « Relier à Vinted ») : « je veux que tout soit comme Vinted, avec toutes les
//  informations à côté : les prix minimum acceptés, relier un achat, relié à Vinted. Ce
//  n'est pas parce que Vinted est ma plateforme principale que c'est la plateforme
//  principale des autres. »
//
//  Avant : le N°, le prix d'achat, l'achat relié, le prix mini vivaient sur la FICHE d'une
//  annonce Vinted (`vinted_annonce_numeros[idVinted]`). Une annonce Leboncoin, eBay ou
//  Vestiaire n'avait ces faits que « reliée à Vinted ». Mesuré sur la base (lecture seule,
//  19 nov.) : 9 annonces Leboncoin en ligne ⇒ 1 seule avec un N°, 0 prix d'achat, 0 prix
//  mini, 0 place.
//
//  LE MODÈLE. Un ARTICLE = une paire physique, avec une ou plusieurs ANNONCES (une par site
//  et par compte). Deux annonces sont le même article seulement par IDENTITÉ (§5) :
//    · le lien posé par SON toucher (`vrm_lbc_liens`, `vrm_ebay_liens`, `vrm_vc_liens`) ;
//    · le même N° lu par les règles de l'app (référence VRM, SKU « VRM-{n°} », N° donné) —
//      jamais le titre, jamais une ressemblance. 50 annonces au même titre = 50 articles.
//  Les FAITS d'un article (prix d'achat, achat relié, prix mini, seuil de refus) :
//    · il a une annonce Vinted ⇒ la fiche Vinted les porte (comme avant, rien ne bouge) ;
//    · sinon ⇒ `vrm_articles_sites['<Site>:<id>']` : une entrée par annonce, sous
//      l'IDENTIFIANT de l'annonce de son site. Le N° reste où toute l'app le lit déjà
//      (`vrm_lbc_liens`, `vrm_vc_numeros`, SKU / `vrm_ebay_liens`), la place dans `vrm_slots`
//      (par N°). Aucune donnée d'avant n'est déplacée ni réécrite.
//  Quand le lien avec Vinted est posé PLUS TARD : les faits de l'annonce du site complètent
//  la fiche là où elle est vide (`opsFusion`) ; une valeur différente des deux côtés, ou deux
//  N° en jeu ⇒ RIEN n'est tranché seul, c'est demandé (`questions`).
//
//  Module PUR (aucun accès au navigateur ni à la base) : l'écran (src/natif/ecrans/Annonces.jsx,
//  src/articles/branchement.js) et `scripts/audit-parite-sites.cjs` exécutent LES MÊMES fonctions.
//  Rien ici n'écrit : les `ops…` rendent des OPÉRATIONS (src/gesteAnnulable.js) que l'app joue
//  par `gesteVrm` — une lecture ratée (carte `null`) ne rend aucune opération.
// ══════════════════════════════════════════════════════════════════════════
import { coutsVente } from '../beneficePaire.js';

export const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
export const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
// La clé synchronisée des faits d'un article SANS annonce Vinted.
export const CLE_ARTICLES = 'vrm_articles_sites';
// Les mêmes clés que le parcours de liaison (src/liaisonSites.js, `cleAnnonce`) : « Leboncoin:123 ».
export const cleSite = (site, id) => `${NOM_SITE[site] || site}:${String(id)}`;
export const CHAMPS_FAITS = ['buyPrice', 'buyFromId', 'buyFrom', 'min', 'refuse'];

const arr = (a) => (Array.isArray(a) ? a : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const str = (v) => (v == null ? '' : String(v).trim());
export const cleDefaut = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
// Un montant LU : un nombre > 0 ou null (jamais 0 pour « pas su »). `zero` : 0 admis (un don, un achat gratuit).
export const montantLu = (v, { zero = false } = {}) => {
  if (v == null || v === '') return null;
  const brut = objet(v) ? (v.amount != null ? v.amount : v.valeur != null ? v.valeur : v.value) : v;
  const n = typeof brut === 'number' ? brut : Number(String(brut == null ? '' : brut).replace(/\s|€/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !zero)) return null;
  return Math.round(n * 100) / 100;
};
const dateLue = (d) => { if (d == null || d === '') return null; const n = Number(d); const t = Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(d)); return Number.isFinite(t) && t > 0 ? t : null; };
const entier = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
// (21 nov., Julien : « quand un compte est ban je veux quand même voir les annonces qu'il y avait dessus ») `bloque` : la DERNIÈRE
// annonce connue d'un compte Vinted bloqué (lue avant le blocage, ou sa fiche) — jamais « en ligne », hors de tout total.
// (22 nov.) + la modération de Vestiaire (`corriger`, `attente`, `refusee` : présentes, PAS en ligne — api/_lib/vestiaire-regle.js).
const RANG = { enligne: 0, masquee: 1, pause: 2, aconfirmer: 3, bloque: 4, corriger: 4.2, attente: 4.4, refusee: 4.6, brouillon: 5, vendue: 6, retiree: 7 };

// ── CE QUE CHAQUE SITE PERMET (le tableau de parité : une seule source pour l'écran, le récit et l'audit) ──
// 'oui' · 'lecture' (VRM le lit quand le site le donne) · 'extension' (geste joué par l'extension, capacité nommée) ·
// 'api' · 'non' (limite du SITE, dite une fois, sobrement — `LIMITES`).
export const PARITE = {
  numero:       { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  place:        { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  prix:         { vinted: 'lecture', leboncoin: 'lecture', ebay: 'lecture', vestiaire: 'lecture' },
  prixMini:     { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  achat:        { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  achatRelie:   { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  benefice:     { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  depuis:       { vinted: 'lecture', leboncoin: 'lecture', ebay: 'lecture', vestiaire: 'lecture' },   // (20 nov., 5.410) `listingDate` lue
  favoris:      { vinted: 'lecture', leboncoin: 'lecture', ebay: 'lecture', vestiaire: 'lecture' },
  vues:         { vinted: 'lecture', leboncoin: 'lecture', ebay: 'lecture', vestiaire: 'non' },
  messages:     { vinted: 'lecture', leboncoin: 'lecture', ebay: 'non', vestiaire: 'non' },
  etat:         { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  fiche:        { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
  baisserPrix:  { vinted: 'extension', leboncoin: 'extension', ebay: 'api', vestiaire: 'extension' },
  offreAuto:    { vinted: 'extension', leboncoin: 'non', ebay: 'api', vestiaire: 'non' },
  completer:    { vinted: 'oui', leboncoin: 'oui', ebay: 'oui', vestiaire: 'oui' },
};
// La capacité de l'extension qu'un geste demande (`EXT_CAPACITES`, App.jsx) — l'app répond « absente / retard / ok ».
export const CAPACITE_GESTE = { baisserPrix: { vinted: 'baisseprix', leboncoin: 'lbcprix', vestiaire: 'vcprix' } };
// Les limites d'un site, par clé de texte (`egalite.limite.*`) : dites UNE fois (en pied de liste), jamais par rangée.
export const LIMITES = {
  leboncoin: ['offreAuto'],
  ebay: ['messages'],
  vestiaire: ['vues', 'messages', 'offreAuto'],
  vinted: [],
};
export const limitesDe = (sites) => { const out = []; for (const s of SITES) if (arr(sites).includes(s)) for (const l of LIMITES[s]) out.push({ site: s, quoi: l }); return out; };

// ── LES FAITS D'UNE ANNONCE DE SITE (`vrm_articles_sites`) ─────────────────────
export const faitsDuSite = (faits, site, id) => { const e = objet(faits) && id != null ? faits[cleSite(site, id)] : null; return objet(e) || null; };
const rempli = (v) => v != null && str(v) !== '';

// ── CONSTRUIRE LES ARTICLES ────────────────────────────────────────────────
// `annonces` : la forme commune (src/articles/sources.js) —
//   { site, id, compte, pseudo, titre, photo, prix, taille, condition, depuis, favoris, vues, messages,
//     etat: 'enligne'|'masquee'|'pause'|'aconfirmer'|'vendue'|'retiree', numero (identité, '' = aucun),
//     vintedId (le lien posé vers une annonce Vinted, '' sinon), url, propre (déclarée « pas sur Vinted ») }
// `fiches`      : `vinted_annonce_numeros` · `faits` : `vrm_articles_sites` · `achatsParNum` : `vinted_buyprice_by_num`
// `slots`       : `vrm_slots` ({ [cléN°]: { m, i } }) · `cle` : l'identité d'un N° (`cleNum`)
// `aVinted`     : le vendeur a-t-il des annonces Vinted ? (null = pas su) — décide « à relier ».
// Rend { articles, parCle: Map, numerosEnDouble: Set }.
export function construireArticles({ annonces, fiches = null, faits = null, achatsParNum = null, slots = null, cle = cleDefaut, aVinted = null, meubleDe = null } = {}) {
  const A = arr(annonces).filter((a) => a && a.site && a.id != null);
  const F = objet(fiches) || {}, FS = objet(faits) || {}, PN = objet(achatsParNum) || {}, SL = objet(slots) || {};
  const parent = A.map((_, i) => i);
  const racine = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const lie = (i, j) => { const a = racine(i), b = racine(j); if (a !== b) parent[a] = b; };
  const vu = new Map();
  // Le N° de chaque annonce : pour Vinted, celui de SA fiche (la fiche fait foi).
  const numDe = (a) => (a.site === 'vinted' ? str((F[String(a.id)] || {}).numero) || str(a.numero) : str(a.numero));
  A.forEach((a, i) => {
    const cles = [a.site + '#' + String(a.id)];
    if (a.site !== 'vinted' && str(a.vintedId)) cles.push('vinted#' + str(a.vintedId));
    const k = cle(numDe(a)); if (k) cles.push('n#' + k);
    for (const c of cles) { if (vu.has(c)) lie(i, vu.get(c)); else vu.set(c, i); }
  });
  // (§5) Deux annonces du MÊME site et du même compte sous un N° = deux paires sous un numéro : on ne les
  // réunit pas (le seul rouge) — sauf Vinted, où deux fiches au même N° sont déjà traitées par l'app.
  const groupes = new Map();
  A.forEach((a, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(a); });
  const fichesParNum = new Map();
  for (const [id, f] of Object.entries(F)) { const k = f && cle(f.numero); if (!k) continue; if (!fichesParNum.has(k)) fichesParNum.set(k, []); fichesParNum.get(k).push(String(id)); }
  const articles = []; const numerosEnDouble = new Set();
  for (const g of groupes.values()) {
    g.sort((x, y) => (SITES.indexOf(x.site) - SITES.indexOf(y.site)) || ((RANG[x.etat] ?? 9) - (RANG[y.etat] ?? 9)));
    const vinted = g.filter((a) => a.site === 'vinted');
    const nums = [...new Set(g.map((a) => cle(numDe(a))).filter(Boolean))];
    // La fiche Vinted de l'article : celle de son annonce Vinted ; sinon l'UNIQUE fiche qui porte son N° (une annonce
    // Vinted vendue ou retirée garde sa fiche) ; deux fiches sous ce N° ⇒ aucune n'est choisie.
    let ficheId = vinted.length ? String(vinted[0].id) : '';
    if (!ficheId && nums.length === 1) { const fs = fichesParNum.get(nums[0]) || []; if (fs.length === 1) ficheId = fs[0]; }
    const fiche = ficheId ? (objet(F[ficheId]) || null) : null;
    const t = g[0];
    const numero = fiche && str(fiche.numero) ? str(fiche.numero) : (g.map(numDe).find(Boolean) || '');
    const k = cle(numero);
    // Deux annonces d'un même site ET d'un même compte dans un groupe réuni par le N° seul : un doublon de N°.
    const parSiteCompte = new Map();
    for (const a of g) { const c = a.site + '|' + str(a.compte); parSiteCompte.set(c, (parSiteCompte.get(c) || 0) + (['vendue', 'retiree'].includes(a.etat) ? 0 : 1)); }
    const doublon = [...parSiteCompte.values()].some((n) => n > 1);
    if (doublon && k) numerosEnDouble.add(k);
    // Les faits : la fiche d'abord ; ce qu'elle n'a pas, l'annonce du site le complète ; deux valeurs différentes ⇒ conflit.
    const sources = g.filter((a) => a.site !== 'vinted').map((a) => ({ a, f: faitsDuSite(FS, a.site, a.id) })).filter((x) => x.f);
    const conflits = [];
    const lire = (champ) => {
      const vals = [];
      if (fiche && rempli(fiche[champ])) vals.push({ v: fiche[champ], de: 'fiche' });
      for (const s of sources) if (rempli(s.f[champ])) vals.push({ v: s.f[champ], de: cleSite(s.a.site, s.a.id) });
      if (!vals.length) return { v: null, de: '' };
      const distincts = [...new Set(vals.map((x) => (champ === 'buyFromId' || champ === 'buyFrom' ? str(x.v) : String(montantLu(x.v, { zero: true })))))];
      if (distincts.length > 1) conflits.push({ champ, valeurs: vals.map((x) => ({ valeur: x.v, de: x.de })) });
      return vals[0];
    };
    const ach = lire('buyPrice'), rel = lire('buyFromId'), mn = lire('min'), rf = lire('refuse');
    let achat = montantLu(ach.v, { zero: true }), achatDe = ach.de;
    // Le miroir par N° (import, atelier d'arrivée) : seulement quand rien d'autre ne le dit, et que le N° désigne UN article.
    if (achat == null && k && !doublon && rempli(PN[numero] != null ? PN[numero] : PN[k])) { achat = montantLu(PN[numero] != null ? PN[numero] : PN[k], { zero: true }); achatDe = achat != null ? 'numero' : ''; }
    const enVente = g.filter((a) => !['vendue', 'retiree', 'brouillon'].includes(a.etat));
    const ref = enVente[0] || t;
    const prix = montantLu(ref.prix);
    const frais = fiche ? coutsVente(fiche) : { valid: true, cents: 0 };
    const benefice = prix != null && achat != null && frais.valid ? Math.round((prix * 100 - achat * 100 - frais.cents)) / 100 : null;
    const somme = (champ) => { const vs = g.map((a) => entier(a[champ])).filter((x) => x != null); return vs.length ? vs.reduce((s, x) => s + x, 0) : null; };
    const dates = enVente.map((a) => dateLue(a.depuis)).filter((x) => x != null);
    const slot = k && objet(SL[k]) ? SL[k] : null;
    const etat = g.map((a) => a.etat).sort((x, y) => (RANG[x] ?? 9) - (RANG[y] ?? 9))[0] || 'aconfirmer';
    const horsVinted = !vinted.length && !fiche;
    const art = {
      cle: vinted.length ? 'vinted#' + String(vinted[0].id) : t.site + '#' + String(t.id),
      numero, cleNumero: k, numeros: nums, deuxNumeros: nums.length > 1, doublon,
      titre: str((g.find((a) => str(a.titre)) || t).titre), photo: (g.find((a) => a.photo) || t).photo || null,
      taille: str((g.find((a) => str(a.taille)) || t).taille), condition: str((g.find((a) => str(a.condition)) || t).condition),
      annonces: g.map((a) => ({ site: a.site, id: String(a.id), compte: str(a.compte), pseudo: str(a.pseudo), prix: montantLu(a.prix), etat: a.etat,
        // (19 nov., publier-agent) ce que CETTE annonce dit d'elle-même — la fiche article neutre (src/publier/agent.js) les lit, site par site.
        titre: str(a.titre), photo: a.photo || null, taille: str(a.taille), condition: str(a.condition), marque: str(a.marque), depuis: dateLue(a.depuis), url: str(a.url),
        favoris: entier(a.favoris), vues: entier(a.vues), messages: entier(a.messages), lu: Number.isFinite(a.lu) ? a.lu : null, numero: numDe(a),
        venduLe: a.etat === 'vendue' ? dateLue(a.venduLe) : null,   // (22 nov.) la date de SA vente, lue (jamais devinée)
        // (21 nov.) la trace d'une annonce d'un compte bloqué : { le (ms ou null), par: 'lecture' | 'vu' | 'numero' }.
        bloque: a.etat === 'bloque' && objet(a.bloque) ? { le: Number.isFinite(a.bloque.le) ? a.bloque.le : null, par: str(a.bloque.par) || 'lecture' } : null, relie: a.site !== 'vinted' && (!!str(a.vintedId) || (!!cle(numDe(a)) && (vinted.length > 0 || !!fiche))) })),
      sites: [...new Set(g.map((a) => a.site))],
      prix, prixAnnonce: { site: ref.site, id: String(ref.id) },
      prixMini: montantLu(mn.v), refuse: montantLu(rf.v),
      achat, achatDe, achatRelie: rempli(rel.v) ? str(rel.v) : '',
      benefice, beneficeRaison: benefice != null ? '' : prix == null ? 'prix' : achat == null ? 'achat' : 'frais',
      depuis: dates.length ? Math.min(...dates) : null,
      // (22 nov.) la vente la plus récente LUE de ses annonces vendues (Annonces · « Vendue » : la date de vente) ; null = pas lue.
      venduLe: (() => { const v = g.filter((a) => a.etat === 'vendue').map((a) => dateLue(a.venduLe)).filter((x) => x != null); return v.length ? Math.max(...v) : null; })(),
      favoris: somme('favoris'), vues: somme('vues'), messages: somme('messages'),
      place: slot ? { m: slot.m, i: slot.i, nom: typeof meubleDe === 'function' ? str(meubleDe(slot)) : '' } : null,
      etat,
      ficheVinted: ficheId,
      // Où s'écrivent les faits de CET article : la fiche Vinted, sinon l'annonce de son site (la première, par ordre de site).
      porteur: ficheId ? { type: 'fiche', id: ficheId } : { type: 'site', site: t.site, id: String(t.id), cle: cleSite(t.site, t.id) },
      conflits,
      // « À relier » : une annonce d'un autre site, sans N° ni lien, chez un vendeur qui a AUSSI des annonces Vinted et qui
      // ne l'a pas déclarée propre à son site. Un vendeur sans Vinted n'a rien à relier (pas su ⇒ on ne le dit pas).
      aRelier: horsVinted && !k && aVinted === true && !g.some((a) => a.propre),
      sansVinted: horsVinted,
    };
    articles.push(art);
  }
  const parCle = new Map(articles.map((a) => [a.cle, a]));
  return { articles, parCle, numerosEnDouble };
}

// ── FILTRER, TRIER, COMPTER (l'écran) ─────────────────────────────────────────
// (22 nov.) Une annonce Vestiaire en attente de validation, à corriger ou refusée n'est PAS « en ligne » : rangée sous « À publier ».
export const ETATS_FILTRE = { enligne: ['enligne', 'masquee', 'pause', 'aconfirmer'], apublier: ['brouillon', 'corriger', 'attente', 'refusee'], dorment: ['enligne'], bloque: ['bloque'], vendues: ['vendue'], retirees: ['retiree'] };
// Les segments de l'écran (audit d'utilité du 19 nov. : « En ligne · À publier · Dorment ») ; vendues / retirées restent
// filtrables (la fiche, la recherche), pas en segment.
export const SEGMENTS = ['enligne', 'apublier', 'dorment'];
export const JOUR_MS = 24 * 3600 * 1000;
// Un article est dans un segment par CE qu'une de ses annonces (du site et du compte choisis) est :
//   · « En ligne » : une annonce présente (en ligne, masquée, en pause, à confirmer) ;
//   · « À publier » : un brouillon, et aucune annonce présente ;
//   · « Dorment » : une annonce EN LIGNE (lecture fraîche) dont la date de mise en ligne LUE a au moins `seuil` jours
//     (la règle de src/quiDorment.js : date inconnue ⇒ dans aucune liste ; « à confirmer » n'y entre jamais).
export function filtrerArticles(articles, { site = 'tous', etat = 'enligne', recherche = '', compte = '', seuil = 30, maintenant = Date.now(), cle = cleDefaut } = {}) {
  const q = str(recherche).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const mots = q.split(/\s+/).filter(Boolean);
  const dans = ETATS_FILTRE[etat] || ETATS_FILTRE.enligne;
  return arr(articles).filter((a) => {
    const ann = a.annonces.filter((x) => (site === 'tous' || x.site === site) && (!compte || str(x.compte) === str(compte)));
    if (!ann.length) return false;
    const enVente = ann.some((x) => ETATS_FILTRE.enligne.includes(x.etat));
    if (etat === 'enligne') { if (!enVente) return false; }
    else if (etat === 'dorment') { if (!ann.some((x) => x.etat === 'enligne' && x.depuis != null && maintenant - x.depuis >= seuil * JOUR_MS)) return false; }
    // (21 nov.) « Comptes bloqués » : la dernière trace connue d'un compte bloqué — à part, jamais dans « En ligne » ni ses totaux.
    else if (etat === 'bloque') { if (!ann.some((x) => x.etat === 'bloque')) return false; }
    else if (enVente || !ann.some((x) => dans.includes(x.etat))) return false;
    if (!mots.length) return true;
    const texte = [a.titre, a.numero ? 'n' + a.numero + ' n°' + a.numero + ' ' + cle(a.numero) : '', a.taille, ...a.annonces.map((x) => x.pseudo + ' ' + NOM_SITE[x.site])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return mots.every((m) => texte.includes(m));
  });
}
export function compterArticles(articles, opts = {}) {
  const out = {};
  for (const s of ['tous', ...SITES]) { out[s] = {}; for (const e of ['enligne', 'apublier', 'dorment', 'bloque', 'vendues', 'retirees']) out[s][e] = filtrerArticles(articles, { ...opts, site: s, etat: e, recherche: '' }).length; }
  return out;
}
// (19 nov. soir, le tableau de travail) L'état d'un article pour le site et le compte choisis : le MEILLEUR état de SES annonces
// de ce site / de ce compte (l'ordre RANG, celui de `construireArticles`) ; aucune annonce ⇒ null (l'article n'y est pas).
// Cocher En ligne · Masquée · En pause · À confirmer = le segment « En ligne » (`filtrerArticles` etat 'enligne') : même nombre.
export const STATUTS_TABLEAU = ['enligne', 'masquee', 'pause', 'aconfirmer', 'bloque', 'corriger', 'attente', 'refusee', 'brouillon', 'vendue', 'retiree'];
export const STATUTS_EN_LIGNE = ETATS_FILTRE.enligne;
export function statutTableau(a, { site = 'tous', compte = '' } = {}) {
  const ann = arr(a && a.annonces).filter((x) => (site === 'tous' || x.site === site) && (!compte || str(x.compte) === str(compte)));
  if (!ann.length) return null;
  return ann.map((x) => x.etat).sort((x, y) => (RANG[x] ?? 9) - (RANG[y] ?? 9))[0] || null;
}
// Les comptes vus dans les annonces (un compte appartient à UN site) : [{ cle: 'site:compte', site, compte, pseudo }].
export function comptesDesArticles(articles, site = 'tous') {
  const m = new Map();
  for (const a of arr(articles)) for (const x of arr(a.annonces)) {
    if (site !== 'tous' && x.site !== site) continue;
    if (!str(x.compte)) continue;
    const c = x.site + ':' + str(x.compte);
    if (!m.has(c)) m.set(c, { cle: c, site: x.site, compte: str(x.compte), pseudo: str(x.pseudo) });
    else if (!m.get(c).pseudo && str(x.pseudo)) m.get(c).pseudo = str(x.pseudo);
  }
  return [...m.values()].sort((x, y) => (SITES.indexOf(x.site) - SITES.indexOf(y.site)) || (x.pseudo || x.compte).localeCompare(y.pseudo || y.compte, 'fr'));
}
// Le plus récent d'abord (date de mise en ligne lue) ; sans date : après, par N° puis titre — un ordre STABLE.
export function trierArticles(articles) {
  return [...arr(articles)].sort((a, b) => ((b.depuis || 0) - (a.depuis || 0)) || String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }) || a.titre.localeCompare(b.titre, 'fr') || a.cle.localeCompare(b.cle));
}

// ── ÉCRIRE UN FAIT (sur SA saisie) ───────────────────────────────────────────
// `champs` : { buyPrice?, buyFromId?, buyFrom?, min?, refuse? } — '' ou null RETIRE le fait.
// `cartes` : { fiches, faits, parNum } telles que l'app vient de les RELIRE ; une carte `null` (lecture ratée) ⇒
//   { refus: 'pas-su' } et AUCUNE opération. Rend { ops, porteur }.
// La fiche Vinted garde ses règles : `buyPrice` y est aussi reflété dans la table par N° (le miroir existant).
export function opsFait({ article, champs, cartes, maintenant = new Date().toISOString() } = {}) {
  const C = cartes || {};
  const fiches = objet(C.fiches), faits = objet(C.faits), parNum = objet(C.parNum);
  if (!article || !objet(article.porteur) || !objet(champs)) return { refus: 'identite' };
  const propres = {};
  for (const c of CHAMPS_FAITS) if (Object.prototype.hasOwnProperty.call(champs, c)) {
    const v = champs[c];
    if (c === 'buyFromId' || c === 'buyFrom') { propres[c] = rempli(v) ? (objet(v) ? v : str(v)) : undefined; continue; }
    if (!rempli(v)) { propres[c] = undefined; continue; }
    const n = montantLu(v, { zero: c === 'buyPrice' });
    if (n == null) return { refus: 'montant', champ: c };
    propres[c] = String(n);
  }
  if (!Object.keys(propres).length) return { refus: 'identite' };
  const ops = [];
  if (article.porteur.type === 'fiche') {
    if (!fiches || !parNum) return { refus: 'pas-su' };
    const id = String(article.porteur.id), f = objet(fiches[id]);
    if (!f) return { refus: 'pas-su' };
    const avant = {}; for (const c of Object.keys(propres)) avant[c] = f[c];
    ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id, apres: propres, avant });
    const num = str(f.numero);
    if (num && Object.prototype.hasOwnProperty.call(propres, 'buyPrice')) ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: num, apres: propres.buyPrice, avant: parNum[num] });
    return { ops, porteur: article.porteur };
  }
  if (!faits) return { refus: 'pas-su' };
  const k = article.porteur.cle || cleSite(article.porteur.site, article.porteur.id);
  const avant = objet(faits[k]);
  const apres = { ...(avant || {}) };
  for (const [c, v] of Object.entries(propres)) { if (v === undefined) delete apres[c]; else apres[c] = v; }
  apres.at = maintenant;
  const vide = !CHAMPS_FAITS.some((c) => rempli(apres[c])) && !objet(apres.numero);
  ops.push({ k: CLE_ARTICLES, type: 'cle', id: k, apres: vide ? undefined : apres, avant: avant || undefined });
  return { ops, porteur: article.porteur };
}

// ── LE LIEN AVEC VINTED POSÉ PLUS TARD : FUSION SANS PERTE ───────────────────────
// L'annonce d'un site (avec SES faits, parfois SON N°) rejoint une annonce Vinted (sa fiche, son N°).
//   · un fait que la fiche n'a pas ⇒ copié sur la fiche ;
//   · le même fait des deux côtés, de valeur différente ⇒ `questions` (rien n'est choisi seul) ;
//   · DEUX N° en jeu ⇒ `questions` porte { champ: 'numero', valeurs: [N° Vinted, N° du site] } : son choix
//     (`choix.numero` = 'vinted' | 'site') — le N° qui ne reste pas va dans « N° à barrer » (jamais redonné : le pool
//     est append-only, on n'y touche pas).
// `choix` : { numero?: 'vinted'|'site', buyPrice?: 'fiche'|'site', min?: …, refuse?: …, buyFromId?: … }
// Rend { refus } · { questions: [...] } (AUCUNE opération tant qu'une question est ouverte) · { ops, numero, barre }.
// ⚠️ Ces opérations ne posent PAS le lien lui-même (`vrm_lbc_liens`…) : c'est le parcours de liaison
//    (src/liaisonSites.js, `opsRelier`) — celles-ci s'y AJOUTENT, dans le même geste.
export function opsFusion({ annonce, numeroSite = '', ficheId, cartes, choix = {}, cle = cleDefaut, maintenant = new Date().toISOString() } = {}) {
  const C = cartes || {};
  const fiches = objet(C.fiches), faits = objet(C.faits), parNum = objet(C.parNum);
  if (!fiches || !faits || !parNum) return { refus: 'pas-su' };
  if (!annonce || annonce.id == null || !annonce.site || ficheId == null) return { refus: 'identite' };
  const fid = String(ficheId), f = objet(fiches[fid]);
  if (!f) return { refus: 'pas-su' };
  const kSite = cleSite(annonce.site, annonce.id), fs = objet(faits[kSite]) || {};
  const nV = str(f.numero), nS = str(numeroSite);
  const questions = [];
  const deuxNumeros = !!cle(nV) && !!cle(nS) && cle(nV) !== cle(nS);
  if (!cle(nV) && !cle(nS)) return { refus: 'sans-numero' };
  if (deuxNumeros && !['vinted', 'site'].includes(choix.numero)) questions.push({ champ: 'numero', valeurs: [{ valeur: nV, de: 'fiche' }, { valeur: nS, de: kSite }] });
  const patch = {};
  for (const c of CHAMPS_FAITS) {
    const a = f[c], b = fs[c];
    if (!rempli(b)) continue;
    if (!rempli(a)) { patch[c] = b; continue; }
    const meme = c === 'buyFromId' ? str(a) === str(b) : c === 'buyFrom' ? true : montantLu(a, { zero: true }) === montantLu(b, { zero: true });
    if (meme) continue;
    if (c === 'buyFrom') continue;   // suit `buyFromId`
    if (choix[c] === 'site') { patch[c] = b; if (c === 'buyFromId' && rempli(fs.buyFrom)) patch.buyFrom = fs.buyFrom; }
    else if (choix[c] !== 'fiche') questions.push({ champ: c, valeurs: [{ valeur: a, de: 'fiche' }, { valeur: b, de: kSite }] });
  }
  if (questions.length) return { questions };
  const garde = deuxNumeros ? (choix.numero === 'site' ? nS : nV) : (cle(nV) ? nV : nS);
  const barre = deuxNumeros ? (choix.numero === 'site' ? nV : nS) : '';
  if (cle(garde) !== cle(nV)) patch.numero = garde;
  const ops = [];
  if (Object.keys(patch).length) {
    const avant = {}; for (const c of Object.keys(patch)) avant[c] = f[c];
    ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: fid, apres: patch, avant });
    if (Object.prototype.hasOwnProperty.call(patch, 'buyPrice') && cle(garde)) ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: garde, apres: String(patch.buyPrice), avant: parNum[garde] });
  }
  // L'entrée du site garde la trace (rien n'est effacé) : reliée à cette fiche, et le N° à barrer s'il y en a un.
  const trace = { ...fs, reliee: { fiche: fid, at: maintenant }, ...(barre ? { barre: { numero: barre, vers: garde, at: maintenant, ecrit: null } } : {}) };
  ops.push({ k: CLE_ARTICLES, type: 'cle', id: kSite, apres: trace, avant: objet(faits[kSite]) || undefined });
  return { ops, numero: garde, barre };
}
// Les N° à barrer sur un carton après une fusion (jusqu'à « C'est écrit »).
export function numerosABarrerSites(faits) {
  return Object.entries(objet(faits) || {}).filter(([, e]) => objet(e) && objet(e.barre) && str(e.barre.numero) && !e.barre.ecrit)
    .map(([k, e]) => ({ cle: k, de: str(e.barre.numero), vers: str(e.barre.vers) }));
}
