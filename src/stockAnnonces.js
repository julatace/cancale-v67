// ── LE STOCK = TES ANNONCES ACTUELLES (5 nov. 2026, demande de Julien) ─────────
// Julien, mot pour mot : « pour le stock onglet je veux que ça soit les annonces
// actuelles ».
//
// Module PUR (aucun accès au navigateur ni à la base) : l'écran Stock
// (`StockMeubles`, App.jsx) et `scripts/audit-stock-annonces.cjs` exécutent les
// MÊMES fonctions (§11).
//
// ⚠️ « EN LIGNE » N'EST PAS JUGÉ ICI. La règle unique de l'app (<enligne-regle>,
//    `fetchVintedListings` → lecture COMPLÈTE la plus récente ; plus de 24 h ⇒
//    « à confirmer » ; masquée par Vinted = toujours chez lui) a déjà rangé chaque
//    annonce Vinted dans `enLigne`, `aConfirmer` ou `masquees` — les trois
//    ensemble sont les PRÉSENTES (`annoncesPresentes`). eBay (SKU « VRM-{n°} ») et
//    Leboncoin (`annonceLbcEnVente`, N° par identité) arrivent déjà jugés aussi.
//    Ce module ne fait que les RÉUNIR par identité et compter.
// ⚠️ L'IDENTITÉ D'UNE PAIRE (§5) : l'identifiant d'annonce, le N° (`cle`), la
//    PHOTO exacte (`clePhoto`, le fichier). Jamais le titre. Une paire en ligne sur
//    Vinted ET Leboncoin (même N°) compte UNE fois.
// ⚠️ « PAS SU » N'EST PAS « AUCUNE » : un compte dont la lecture a raté, eBay ou
//    Leboncoin pas lus ⇒ `manque` (nommés) et `auMoins` ; rien lu du tout ⇒
//    `su: false` (l'écran dit « — », jamais « aucune annonce »).
// ⚠️ VESTIAIRE (5 nov., « ce qui reste ») : ses annonces EN LIGNE telles que l'app
//    les connaît déjà (`vc_listings`, rangées par l'extension — `rangerVcAnnonces`,
//    `ficheVcAnnonce`), jugées par LA règle de Vestiaire (`etatAnnonceVcBrut`,
//    api/_lib/vestiaire-regle.js) et numérotées par SON identité (`numVcAnnonce` :
//    l'annonce publiée par VRM, la référence VRM-{n°} de l'article, le N° donné
//    par VRM ou celui de l'annonce Vinted qu'IL a reliée — `main.vrm_vc_liens`).
//    Jamais le titre. Sans N° ⇒ pas comptée, NOMMÉE, « au moins ». Lecture
//    absente ⇒ nommée ; plus de 24 h ⇒ « à confirmer », nommée ; liste lue en
//    partie ou état non dit ⇒ nommé, « au moins ».

import { etatAnnonceVcBrut, numVcAnnonce, vcVenteAnnulee } from '../api/_lib/vestiaire-regle.js';

const arr = (a) => (Array.isArray(a) ? a : []);
const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, '');
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
};
const RANG_ETAT = { enligne: 0, masquee: 1, aconfirmer: 2 };

// Les annonces Vestiaire telles que le Stock les compte (module PUR).
//   lst    : `vc_listings` projeté { items, liens, capturedAt, complet } ; null = la
//            lecture a raté (pas su) ; {} = aucune lecture rangée (jamais lu)
//   ventes : `vc_ventes.ventes` (une vente lue, pas annulée, PROUVE « vendue ») ;
//            null = pas lues (rien n'en est tiré, comme l'écran Vestiaire)
//   auto   : les N° donnés par VRM et ceux qu'IL a reliés à Vinted
//            (`numerosVcEffectifs()` : `vrm_vc_numeros` + `vrm_vc_liens`)
// Rend null (pas su) · { lue: false } (jamais lu) · { lue: true, lu, vieille,
//   complet, liste: [{ id, numero, titre, photo, etat }], sansNumero: [{ id, titre }],
//   nonJugees: [{ id, titre, numero }] }.
//   etat : 'enligne' (lecture de moins de 24 h) · 'aconfirmer' (lecture plus
//   vieille, ou annonce plus vue dans une liste relue — rien n'est retiré).
export function annoncesVcStock({ lst, ventes = null, auto = null, maintenant = Date.now() } = {}) {
  if (lst == null || typeof lst !== 'object') return null;
  const items = lst.items && typeof lst.items === 'object' && !Array.isArray(lst.items) ? lst.items : null;
  const lu = Date.parse(lst.capturedAt || '');
  if (!items || !Number.isFinite(lu)) return { lue: false };
  const vieille = !(maintenant - lu <= 24 * 3600e3);
  const vendus = new Set();
  for (const v of Object.values(ventes && typeof ventes === 'object' ? ventes : {})) if (v && v.productId && !vcVenteAnnulee(v)) vendus.add(String(v.productId));
  const liste = [], sansNumero = [], nonJugees = [];
  for (const [id, it] of Object.entries(items)) {
    if (!it || typeof it !== 'object') continue;
    const e = etatAnnonceVcBrut(it, vendus.has(String(id)), lst.capturedAt);
    if (e === 'vendue' || e === 'retiree') continue;
    const titre = String(it.titre || '');
    const numero = numVcAnnonce(id, it, lst.liens, auto);
    // « en attente de validation », mot inconnu, état non dit : ni en ligne ni parti.
    if (e !== 'en-ligne' && e !== 'a-confirmer') { nonJugees.push({ id: String(id), titre, numero }); continue; }
    const etat = e === 'a-confirmer' || vieille ? 'aconfirmer' : 'enligne';
    if (!numero) { sansNumero.push({ id: String(id), titre, etat }); continue; }
    liste.push({ id: String(id), numero, titre, photo: typeof it.photo === 'string' && it.photo ? it.photo : null, etat });
  }
  return { lue: true, lu, vieille, complet: lst.complet === true, liste, sansNumero, nonJugees };
}

// Les annonces actuelles, une par PAIRE.
//   vinted : [{ uid, nom, ok, lu (ms|null), enLigne:[it], aConfirmer:[it], masquees:[it] }]
//            (`ok: false` = la lecture de ce compte a raté : « pas su »)
//            `masquees` : déjà sans celles déclarées parties (`masqueesPresentes`).
//   numeros : { [idAnnonce]: { numero, photo? } } — la fiche de chaque annonce Vinted
//   ebay   : null (pas su) | { liste: [{ numero, title, photo }], illisibles: [nom] }
//   lbc    : null (pas su) | [{ numero, title, photo, etat?, lu? }] — (6 nov.) `etat`
//            'aconfirmer' = la règle « en ligne » de Leboncoin (src/enLigneLbc.js)
//            ne peut pas la confirmer (lecture complète de « Mes annonces » de
//            plus de 24 h, ou jamais faite) : présente, pas comptée en ligne
//   vestiaire : la sortie de `annoncesVcStock` (null pas su · { lue: false } jamais
//            lu) ; `undefined` = Vestiaire pas demandé (appelant d'avant)
//   vendus : Set de clés — N° PROUVÉS vendus (`vrm_stock_vendus`) : une annonce eBay
//            ou Leboncoin restée en ligne n'en refait pas une annonce actuelle
//            (la même exclusion que `articlesAutresPlateformes`).
// Rend { articles, n, nAConfirmer, nMasquees, sansNumero, manque, aConfirmerComptes,
//        vcSansNumero, vcNonJugees, vcVieille, su, auMoins }.
//   article : { cle, numero, ids, titre, photo, plateformes, comptes, etat, aussi }
//   etat : 'enligne' (au moins une annonce en ligne) · 'masquee' · 'aconfirmer'
export function annoncesActuelles({ vinted, numeros, ebay, lbc, vestiaire, vendus, cle = cleDefaut, clePhoto = null } = {}) {
  const parts = [];          // { id, cle, numero, titre, photo, plat, compte, etat }
  const manque = [], aConfirmerComptes = [];
  let lus = 0;
  const sansNumero = { vinted: 0, ebay: 0, leboncoin: 0, vestiaire: 0 };
  const vcSansNumero = [], vcNonJugees = [];
  let vcVieille = null;
  const fiches = numeros && typeof numeros === 'object' ? numeros : {};
  for (const c of arr(vinted)) {
    if (!c) continue;
    if (!c.ok) { manque.push({ plateforme: 'vinted', nom: String(c.nom || c.uid || ''), raison: 'lecture ratée' }); continue; }
    lus++;
    const pousse = (it, etat) => {
      if (!it || it.id == null) return;
      const id = String(it.id), f = fiches[id] || {};
      const numero = f.numero != null ? String(f.numero).trim() : '';
      parts.push({ id: 'v:' + id, cle: numero ? cle(numero) : '', numero, titre: String(it.title || f.title || ''), photo: it.photo || f.photo || null,
        plat: 'vinted', compte: String(c.uid || ''), etat });
    };
    arr(c.enLigne).forEach((it) => pousse(it, 'enligne'));
    arr(c.aConfirmer).forEach((it) => pousse(it, 'aconfirmer'));
    arr(c.masquees).forEach((it) => pousse(it, 'masquee'));
    if (arr(c.aConfirmer).length) aConfirmerComptes.push({ uid: String(c.uid || ''), plateforme: 'vinted', nom: String(c.nom || c.uid || ''), n: arr(c.aConfirmer).length, lu: Number.isFinite(c.lu) ? c.lu : null });
  }
  const autres = (liste, plat) => {
    let nAc = 0, luAc = null, jamais = false;
    for (const a of arr(liste)) {
      const numero = a && a.numero != null ? String(a.numero).trim() : '';
      const k = numero ? cle(numero) : '';
      if (!k) { sansNumero[plat] += 1; continue; }
      if (vendus && vendus.has(k)) continue;
      const etat = a && a.etat === 'aconfirmer' ? 'aconfirmer' : 'enligne';
      if (etat === 'aconfirmer') { nAc++; if (!Number.isFinite(a.lu)) jamais = true; else if (luAc == null || a.lu < luAc) luAc = a.lu; }
      parts.push({ id: plat + ':' + k, cle: k, numero, titre: String((a && a.title) || ''), photo: (a && a.photo) || null, plat, compte: '', etat });
    }
    if (nAc) aConfirmerComptes.push({ uid: '', plateforme: plat, nom: plat === 'leboncoin' ? 'Leboncoin' : plat, n: nAc, lu: jamais ? null : luAc });
  };
  if (ebay == null) manque.push({ plateforme: 'ebay', nom: 'eBay', raison: 'pas lu' });
  else {
    lus++;
    autres(ebay.liste, 'ebay');
    for (const nom of arr(ebay.illisibles)) manque.push({ plateforme: 'ebay', nom: String(nom || 'eBay'), raison: 'lecture ratée' });
  }
  if (lbc == null) manque.push({ plateforme: 'leboncoin', nom: 'Leboncoin', raison: 'pas lu' });
  else { lus++; autres(lbc, 'leboncoin'); }
  // Vestiaire : déjà jugé par `annoncesVcStock` (la règle de Vestiaire) ; ici on
  // le RÉUNIT par identité, comme les autres.
  if (vestiaire === null) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'pas lu' });
  else if (vestiaire && !vestiaire.lue) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'jamais lu' });
  else if (vestiaire) {
    lus++;
    let nAc = 0;
    for (const a of arr(vestiaire.liste)) {
      const numero = a && a.numero != null ? String(a.numero).trim() : '';
      const k = numero ? cle(numero) : '';
      if (!k) { sansNumero.vestiaire += 1; vcSansNumero.push({ id: String((a && a.id) || ''), titre: String((a && a.titre) || '') }); continue; }
      if (vendus && vendus.has(k)) continue;
      if (a.etat === 'aconfirmer') nAc++;
      parts.push({ id: 'vc:' + String(a.id), cle: k, numero, titre: String(a.titre || ''), photo: a.photo || null, plat: 'vestiaire', compte: '', etat: a.etat === 'aconfirmer' ? 'aconfirmer' : 'enligne' });
    }
    for (const a of arr(vestiaire.sansNumero)) { sansNumero.vestiaire += 1; vcSansNumero.push({ id: String((a && a.id) || ''), titre: String((a && a.titre) || '') }); }
    for (const a of arr(vestiaire.nonJugees)) vcNonJugees.push({ id: String((a && a.id) || ''), titre: String((a && a.titre) || ''), cle: a && a.numero ? cle(a.numero) : '' });
    if (!vestiaire.complet) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'lue en partie' });
    if (vestiaire.vieille) vcVieille = { lu: Number.isFinite(vestiaire.lu) ? vestiaire.lu : null };
    if (nAc) aConfirmerComptes.push({ uid: '', plateforme: 'vestiaire', nom: 'Vestiaire', n: nAc, lu: Number.isFinite(vestiaire.lu) ? vestiaire.lu : null, vieille: !!vestiaire.vieille });
  }

  // Réunir par IDENTITÉ : même annonce, même N°, même photo exacte (union-find).
  const parent = parts.map((_, i) => i);
  const racine = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const lie = (i, j) => { parent[racine(i)] = racine(j); };
  const vu = new Map();
  parts.forEach((p, i) => {
    const cles = [p.id];
    if (p.cle) cles.push('n:' + p.cle);
    const ph = clePhoto && p.photo ? clePhoto(p.photo) : '';
    if (ph) cles.push('p:' + ph);
    for (const k of cles) { if (vu.has(k)) lie(i, vu.get(k)); else vu.set(k, i); }
  });
  const groupes = new Map();
  parts.forEach((p, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(p); });
  const articles = [];
  for (const g of groupes.values()) {
    // Le représentant : un N° d'abord (on range un carton par son numéro), Vinted d'abord.
    const t = g.find((p) => p.cle && p.plat === 'vinted') || g.find((p) => p.cle) || g[0];
    const etat = g.map((p) => p.etat).sort((a, b) => RANG_ETAT[a] - RANG_ETAT[b])[0];
    const nums = [...new Set(g.filter((p) => p.cle).map((p) => p.numero))];
    articles.push({
      cle: t.cle, numero: t.numero,
      ids: [...new Set(g.map((p) => p.id))],
      titre: (g.find((p) => p.titre) || t).titre, photo: (g.find((p) => p.photo) || t).photo,
      plateformes: [...new Set(g.map((p) => p.plat))],
      comptes: [...new Set(g.map((p) => p.compte).filter(Boolean))],
      etat, aussi: nums.filter((n) => cle(n) !== t.cle),
    });
    if (!t.cle) sansNumero.vinted += 1;
  }
  const nAConfirmer = articles.filter((a) => a.etat === 'aconfirmer').length;
  const nMasquees = articles.filter((a) => a.etat === 'masquee').length;
  const su = lus > 0;
  return { articles, n: articles.length, nAConfirmer, nMasquees, sansNumero, manque, aConfirmerComptes, vcSansNumero, vcNonJugees, vcVieille, su,
    auMoins: su && (manque.length > 0 || sansNumero.ebay > 0 || sansNumero.leboncoin > 0 || sansNumero.vestiaire > 0 || vcNonJugees.length > 0) };
}

// ⚠️⚠️ (11 nov., lot DJ4 — Julien : « Dans Stock je veux que ce soit que les paires en ligne,
// une seule si elle est présente sur tous les sites, mais là tu me proposes de vieilles
// annonces ».) Mesuré sur sa base (lecture seule) : les « vieilles annonces » étaient les
// articles « à confirmer » (un compte relu le 11 août, un autre le 7 nov. : toute leur liste)
// et les masquées par Vinted (10, dont 6 de septembre sur un même compte), MÉLANGÉES aux
// annonces en ligne dans la liste et le compte du Stock. La liste du Stock = `enLigne` seul ;
// les deux autres sont dites À PART (un repli chacune), jamais mêlées, jamais supprimées.
// Une paire en ligne sur plusieurs sites reste UN article (réunie par identité plus haut).
export function partagerParEtat(articles) {
  const enLigne = [], aConfirmer = [], masquees = [];
  for (const a of arr(articles)) {
    if (!a) continue;
    if (a.etat === 'enligne') enLigne.push(a);
    else if (a.etat === 'masquee') masquees.push(a);
    else aConfirmer.push(a);
  }
  return { enLigne, aConfirmer, masquees };
}

// Ce qui est dans une CASE et n'est plus une annonce actuelle : à sortir du
// carton — jamais disparu en silence.
//   slots     { [cle]: { m, i } }
//   actuelles Set des clés des annonces actuelles
//   vendus    Set des clés prouvées vendues (`vrm_stock_vendus`)
//   garder    { [cle]: ts } — « Remettre » (sortie toute seule) ou « Elle est encore là »
//   jugeable  (cle) => bool — toutes les lectures qui pourraient la porter ont
//             répondu (sinon « pas su » : elle n'est dite ni présente ni partie)
// Rend { [cle]: 'actuelle' | 'vendue' | 'arrivee' | 'gardee' | 'plusenligne' | 'passu' }.
// Une vendue l'emporte sur tout (sa case s'allume jusqu'à ce qu'il la sorte ou
// que le colis parte, `libererCasesPartis`).
// (11 nov., lot rangement-guide) `arrivees` : les N° rangés à l'arrivée d'un achat (fiche à publier,
// `vrm_fiches_neuves` origine 'arrivee') ⇒ 'arrivee' — chez lui, pas encore en ligne : ni « plus en ligne », ni « pas su ».
export function classerRangees({ slots, actuelles, vendus, garder, jugeable, arrivees = null, cle = cleDefaut } = {}) {
  const out = {};
  for (const k0 of Object.keys(slots || {})) {
    if (!slots[k0]) continue;
    const k = cle(k0); if (!k) continue;
    if (vendus && vendus.has(k)) out[k] = 'vendue';
    else if (actuelles && actuelles.has(k)) out[k] = 'actuelle';
    else if (arrivees && arrivees.has(k)) out[k] = 'arrivee';
    else if (garder && garder[k]) out[k] = 'gardee';
    else if (actuelles && jugeable && jugeable(k)) out[k] = 'plusenligne';
    else out[k] = 'passu';
  }
  return out;
}
