// ── LA FICHE D'UN ARTICLE, DIRECTION D « FICHE PRODUIT » (15 nov., choisie par Julien) ─────────────
// Julien trouvait l'ancienne fiche « pas ouf », « trop longue » (six écrans). La direction D tient en UN
// écran 390×844 : la photo, le nom et UNE ligne d'état, UNE carte d'action (la seule chose à faire
// maintenant), puis un segment Argent · Sites · Histoire (une vue à la fois). Tout le reste est derrière
// « ⋯ » (feuille de tuiles + « Tout voir »). Récit : docs/passation/2026-11-15-fiche-d.md.
//
// ⚠️ (19 nov., « fiche directe » — docs/passation/2026-11-19-fiche-directe.md) Julien : « je dois cliquer sur la paire puis
// cliquer sur les points pour avoir des informations. Ce n'est pas normal ». Les onglets Argent · Sites · Histoire et la
// feuille « ⋯ » obligatoire sont RETIRÉS : la fiche montre d'un coup l'en-tête compact, une grille de FAITS (`faitsFiche`),
// les sites, UN bouton principal (`actionFiche`), les gestes (`tuilesFiche`) puis l'histoire repliée (`histoireFiche`).
// Aucune règle de calcul ne change : ce module RANGE toujours ce qui a été lu par identité.
//
// Ce module est PUR : il RANGE ce que `histoireArticle` / `parcoursPaire` (src/histoireArticle.js,
// src/fichePaire.js) ont déjà lu PAR IDENTITÉ. Il ne lit rien, n'écrit rien, ne calcule aucun chiffre
// nouveau : le bénéfice est celui de `parcoursPaire` (le même que Ventes), le bénéfice « si vendue » celui
// de `beneficeSiVendue`, l'achat proposé celui de src/liaisonAchat.js (une PROPOSITION : c'est SON clic
// qui relie, §5). « Pas su » reste « pas su » : un chiffre absent est `null`, jamais 0 (§5).
// Les textes sont des CLÉS (`fd.*`, src/i18n) et leurs variables ; l'écran les passe à `tr()`.

const str = (v) => String(v == null ? '' : v).trim();
const ms = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; };
const etape = (p, cle) => (p && Array.isArray(p.etapes) ? p.etapes.find((e) => e.cle === cle) : null) || null;
const evs = (e) => (e && Array.isArray(e.evenements) ? e.evenements : []);
const premiereDate = (e) => { const l = evs(e).map((x) => ms(x.at)).filter((x) => x != null); return l.length ? Math.min(...l) : null; };

// La paire est-elle VENDUE (une vente lue, pas annulée) ? EN VENTE (au moins une annonce en ligne) ?
export function situation(p, sites = []) {
  if (!p) return 'rien';
  const v = etape(p, 'vente');
  if (v && v.etat === 'fait') return 'vendue';
  if (v && v.etat === 'passu') return 'passu';
  const enLigne = (sites || []).filter((s) => s && s.etat === 'en-ligne').length;
  if (enLigne || (p.resume && p.resume.siVendue)) return 'en-vente';
  return 'stock';
}

// La vue ouverte d'abord : Argent pour une vente, Sites pour une annonce (maquette d-vendu / d-vente).
export function vueInitiale(p, sites = []) {
  const s = situation(p, sites);
  return s === 'en-vente' ? 'sites' : 'argent';
}

// Les jours « en ligne depuis » (la règle de `etatArticle`, ligne « Mise en ligne → vente ») — null : pas su.
export function joursEnLigne(etat) {
  const l = etat && Array.isArray(etat.lignes) ? etat.lignes.find((x) => x.cle === 'en-ligne-vente') : null;
  if (!l || l.jours == null || !/^depuis/.test(str(l.borne))) return null;
  return { n: Math.max(0, Math.round(l.jours)), auMoins: l.borne === 'depuis-au-moins' };
}

// UNE ligne d'état sous le nom. `ambre` : il y a un geste à faire (§7 : ambre = geste).
// Rend { cle, vars, ambre } — l'écran fait `tr(cle, vars)`.
// `action` : la sorte de la carte d'action — quand la carte EST « imprimer le bordereau », la ligne d'état ne le redit pas.
export function ligneEtat(p, { sites = [], etat = null, dateCourte = (x) => x, action = null } = {}) {
  if (!p) return null;
  const r = p.resume || {};
  const s = situation(p, sites);
  if (p.double) return { cle: 'fd.etat.double', vars: { n: p.num }, ambre: false, rouge: true };
  if (s === 'vendue') {
    const prix = r.vente != null ? r.vente : null;
    const v = etape(p, 'vente'); const d = premiereDate(v);
    // (16 nov., lot ecrans-restes) Sa date limite d'envoi, quand la règle de Colis la connaît (`p.limiteEnvoi`) :
    // « Vendue 110 € · à poster demain » — la phrase de Colis, jamais une date devinée.
    const lim = p.aPoster && p.limiteEnvoi && p.limiteEnvoi.texte ? p.limiteEnvoi.texte : '';
    if (p.aPoster && action !== 'bordereau' && lim) return { cle: prix != null ? 'fd.etat.vendueLimite' : 'fd.etat.vendueLimiteSansPrix', vars: { prix, limite: lim }, ambre: true, limite: p.limiteEnvoi };
    if (p.aPoster && action !== 'bordereau') return { cle: prix != null ? 'fd.etat.vendueEnvoyer' : 'fd.etat.vendueEnvoyerSansPrix', vars: { prix }, ambre: true };
    return { cle: prix != null && d != null ? 'fd.etat.vendueLe' : prix != null ? 'fd.etat.vendue' : 'fd.etat.vendueSansPrix', vars: { prix, date: d != null ? dateCourte(d) : '' }, ambre: false };
  }
  if (s === 'passu') return { cle: 'fd.etat.passu', vars: {}, ambre: false };
  if (s === 'en-vente') {
    const enL = (sites || []).filter((x) => x && x.etat === 'en-ligne');
    const sv = r.siVendue || null;
    const prix = sv && sv.prix != null ? sv.prix : (enL.length && enL.every((x) => x.prix != null && x.prix === enL[0].prix) ? enL[0].prix : null);
    const j = joursEnLigne(etat);
    const n = enL.length;
    const base = prix != null ? 'fd.etat.enVente' : 'fd.etat.enVenteSansPrix';
    if (n > 1 && j) return { cle: base + 'SitesDepuis', vars: { prix, n, j: j.n }, ambre: false };
    if (n > 1) return { cle: base + 'Sites', vars: { prix, n }, ambre: false };
    if (j) return { cle: base + 'Depuis', vars: { prix, j: j.n, n: j.n }, ambre: false };
    return { cle: base, vars: { prix }, ambre: false };
  }
  return { cle: p.etat === 'rien' ? 'fd.etat.jamais' : 'fd.etat.stock', vars: {}, ambre: false };
}

// (19 nov., fiche directe) L'ÉTAT EN UNE LIGNE COURTE, sous le titre. Le prix, la date et les jours sont dans la grille de
// faits (chaque info UNE fois) : la ligne dit seulement OÙ en est l'article, et le site quand il n'y en a qu'un.
// `ambre` : un geste attend (à envoyer) — jamais quand le bouton principal EST ce geste (« Imprimer le bordereau »).
// Rend { cle (la clé d'avant, gardée pour `data-fd-etat`), court, vars, ambre, rouge, limite }.
const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
export function etatCourt(p, o = {}) {
  const l = ligneEtat(p, o);
  if (!l) return null;
  const sites = o.sites || [];
  const s = situation(p, sites);
  let court = l.cle; const vars = { ...l.vars };
  if (s === 'vendue' && !p.double) {
    const v = (sites || []).find((x) => x && x.etat === 'vendue');
    const site = v ? (NOM_SITE[v.site] || '') : '';
    vars.site = site;
    if (l.limite) court = site ? 'fd.e.vendueSurLimite' : 'fd.e.vendueLimite';
    else if (l.ambre) court = site ? 'fd.e.vendueSurEnvoyer' : 'fd.e.vendueEnvoyer';
    else court = site ? 'fd.e.vendueSur' : 'fd.e.vendue';
  } else if (s === 'en-vente' && !p.double) {
    const noms = [...new Set((sites || []).filter((x) => x && x.etat === 'en-ligne').map((x) => x.site))];
    vars.n = noms.length; vars.site = noms.length === 1 ? (NOM_SITE[noms[0]] || '') : '';
    court = noms.length > 1 ? 'fd.e.enVenteSites' : vars.site ? 'fd.e.enVenteSur' : 'fd.e.enVente';
  }
  return { ...l, court, vars };
}

// Les jours en ligne d'un article sans annonce Vinted : depuis la plus ancienne date de mise en ligne LUE sur ses sites
// (`depuis`, en millisecondes — Leboncoin « publiée le », eBay « depuis ») ; aucune date lue ⇒ null (« — », jamais 0).
function joursDepuisSites(sites, maintenant) {
  const l = (sites || []).filter((x) => x && x.etat === 'en-ligne' && Number.isFinite(x.depuis) && x.depuis > 0 && x.depuis <= maintenant).map((x) => x.depuis);
  return l.length ? { n: Math.floor((maintenant - Math.min(...l)) / 86400000), auMoins: false } : null;
}

// (19 nov., fiche directe) LA GRILLE DE FAITS, toujours visible : Prix (de vente ou vendu) · Acheté · Bénéfice · Taille ·
// En ligne depuis / Vendue le · Prix mini · Favoris et vues (s'ils sont lus) · Place dans le stock.
// §5 « chiffres » : un fait pas su est `null` — l'écran écrit « — » et sa raison COURTE (`raison`, une clé) ; jamais 0,
// jamais « au moins » devant un bénéfice (un bénéfice dont les frais ne sont pas tous confirmés est « au plus », la règle
// d'avant). `porte` : le fait qui se corrige EST la porte (« le chiffre faux est la porte pour le corriger ») :
//   'achat'  — le prix d'achat se tape SUR PLACE (la fiche de l'annonce existe) ; 'relier' — choisir l'achat (une vente
//   sans fiche) ; 'lien' — l'achat est relié : la case mène à son reçu et à « Délier » (dans l'histoire) ;
//   'prix'   — le prix affiché ouvre « Prix partout » ; 'mini' — le prix mini se tape sur place ; 'place' — le Stock.
// Rend [{ cle, lib, cents | texte | jours | date, signe, partiel, raison, porte, large }] — rien de calculé ici.
const RAISON_BENEF = (r) => (r.achat == null ? 'fd.r.sansAchat' : /écartée|convertie|annonce en /.test(str(r.raisonBenef)) ? 'fd.r.devise'
  : /pas lues/.test(str(r.raisonBenef)) ? 'fd.r.ventesPasLues' : /prix de vente/.test(str(r.raisonBenef)) ? 'fd.r.prixIllisible' : 'fd.r.fraisIllisibles');
export function faitsFiche(p, { sites = [], etat = null, taille = '', peut = {}, relie = false, maintenant = Date.now() } = {}) {
  if (!p || p.double) return [];
  const r = p.resume || {};
  const s = situation(p, sites);
  const out = [];
  const enL = (sites || []).filter((x) => x && x.etat === 'en-ligne');
  // PRIX — vendu : le prix de la vente ; en vente : le prix affiché (le même partout, sinon dit) ; sinon pas en vente.
  if (s === 'vendue') out.push({ cle: 'prix', lib: 'fd.f.vendu', cents: r.vente != null ? r.vente : null, raison: r.vente == null ? 'fd.r.prixIllisible' : '' });
  else if (s === 'en-vente') {
    const sv = r.siVendue || null;
    const memePrix = enL.length > 0 && enL.every((x) => x.prix != null && x.prix === enL[0].prix);
    const prix = sv && sv.prix != null ? sv.prix : (memePrix ? enL[0].prix : null);
    out.push({ cle: 'prix', lib: 'fd.f.prix', cents: prix, raison: prix == null ? (enL.length > 1 ? 'fd.r.deuxPrix' : 'fd.r.pasLu') : '', porte: peut.prix ? 'prix' : null });
  } else out.push({ cle: 'prix', lib: 'fd.f.prix', cents: null, raison: s === 'passu' ? 'fd.r.pasLu' : 'fd.r.pasEnVente' });
  // ACHETÉ — la porte de la saisie (ou du choix de l'achat) quand il manque.
  out.push({ cle: 'achat', lib: 'fd.f.achete', cents: r.achat != null ? r.achat : null, raison: r.achat == null ? (s === 'vendue' ? 'fd.r.pasRelie' : 'fd.r.pasSaisi') : '',
    porte: p.ancienNumero ? null : relie ? 'lien' : peut.achat ? 'achat' : (r.achat == null && peut.relier ? 'relier' : null) });
  // BÉNÉFICE — celui de la vente (la règle de Ventes), sinon « si vendue » au prix affiché.
  if (s === 'vendue') out.push({ cle: 'benefice', lib: 'fd.f.benefice', cents: r.benefice != null ? r.benefice : null, signe: true, partiel: !!r.benefPartiel && r.benefice != null, raison: r.benefice == null ? RAISON_BENEF(r) : '', brut: r.benefice == null ? (r.raisonBenef || '') : '' });
  else if (s === 'en-vente' && r.siVendue) {
    const sv = r.siVendue;
    out.push({ cle: 'si-vendue', lib: 'fd.f.siVendue', cents: sv.benefice != null ? sv.benefice : null, signe: true, partiel: sv.etat === 'partiel' && sv.benefice != null,
      raison: sv.benefice == null ? (/deux fois/.test(str(sv.raison)) ? 'fd.r.deuxPrix' : /annonce en /.test(str(sv.raison)) ? 'fd.r.devise' : r.achat == null ? 'fd.r.sansAchat' : 'fd.r.fraisIllisibles') : '', brut: sv.benefice == null ? (sv.raison || '') : '' });
  } else out.push({ cle: 'benefice', lib: 'fd.f.benefice', cents: null, signe: true, raison: s === 'passu' ? 'fd.r.ventesPasLues' : 'fd.r.pasVendue' });
  // TAILLE — celle de la fiche ou de l'annonce (lue par l'écran) ; pas dite ⇒ « — ».
  out.push({ cle: 'taille', lib: 'fd.f.taille', texte: str(taille), raison: str(taille) ? '' : 'fd.r.pasDite' });
  // VENDUE LE / EN LIGNE DEPUIS — une date LUE, sinon « — ».
  if (s === 'vendue') {
    const e = etape(p, 'vente'); const d = premiereDate(e); const t = d != null ? d : ms(e && e.date);
    out.push({ cle: 'quand', lib: 'fd.f.vendueLe', date: t, raison: t == null ? 'fd.r.dateNonLue' : '' });
  } else if (s === 'en-vente') { const j = joursEnLigne(etat) || joursDepuisSites(sites, maintenant); out.push({ cle: 'quand', lib: 'fd.f.enLigne', jours: j ? j.n : null, auMoins: !!(j && j.auMoins), raison: j ? '' : 'fd.r.dateNonLue' }); }
  else out.push({ cle: 'quand', lib: 'fd.f.enLigne', jours: null, raison: s === 'passu' ? 'fd.r.pasLu' : 'fd.r.pasEnLigne' });
  // PRIX MINI (une offre est acceptée dès ce prix) — pour UNE annonce en ligne qui peut le porter (`miniPorte` : dit par
  // l'écran ; aujourd'hui la fiche d'une annonce Vinted). Deux annonces qui le portent ⇒ rien de choisi.
  const v1 = enL.filter((x) => x.miniPorte);
  if (s === 'en-vente' && v1.length === 1 && v1[0].id) out.push({ cle: 'mini', lib: 'fd.f.mini', cents: v1[0].mini != null ? v1[0].mini : null, raison: v1[0].mini == null ? 'fd.r.pasPose' : '', porte: peut.mini ? 'mini' : null, id: String(v1[0].id) });
  // FAVORIS ET VUES — seulement s'ils sont LUS (jamais « 0 » pour « pas lu »).
  const somme = (k) => enL.reduce((t, x) => (Number.isFinite(x[k]) ? (t == null ? 0 : t) + x[k] : t), null);
  const fav = somme('favoris'), vues = somme('vues');
  if (s === 'en-vente' && (fav != null || vues != null)) out.push({ cle: 'interet', lib: fav != null && vues != null ? 'fd.f.favVues' : fav != null ? 'fd.f.favoris' : 'fd.f.vues', favoris: fav, vues });
  // PLACE DANS LE STOCK — lue par le parcours (étape « stock ») ; pas rangée : la porte du rangement.
  const st = etape(p, 'stock');
  const partie = s === 'vendue' && !p.aPoster;
  if (st && st.etat === 'fait' && !st.importee && !st.sortie) out.push({ cle: 'place', lib: 'fd.f.place', texte: str(st.detail), raison: '', porte: peut.place ? 'place' : null, large: true });   // un lieu est long : il prend la rangée
  else if (st && st.etat === 'fait' && st.importee) out.push({ cle: 'place', lib: 'fd.f.place', texte: '', raison: 'fd.r.importee' });
  else if (st && st.etat === 'passu') out.push({ cle: 'place', lib: 'fd.f.place', texte: '', raison: 'fd.r.stockPasLu' });
  else out.push({ cle: 'place', lib: 'fd.f.place', texte: '', raison: (st && st.sortie) || partie ? 'fd.r.partie' : 'fd.r.pasRangee', porte: !partie && !(st && st.sortie) && peut.place && !p.ancienNumero && p.etat !== 'rien' ? 'place' : null });
  // L'ordre du contrat « VRM natif » (docs/design/NATIF.md §4) : Prix · Prix mini · Acheté · Bénéfice · Taille · En ligne depuis · Place · Favoris.
  return out.sort((a, b) => ORDRE_FAITS.indexOf(a.cle) - ORDRE_FAITS.indexOf(b.cle));
}
export const ORDRE_FAITS = ['prix', 'mini', 'achat', 'benefice', 'si-vendue', 'taille', 'quand', 'place', 'interet'];

// LA CARTE D'ACTION : la seule chose à faire maintenant (ou rien). Rend { sorte, … } | null.
//   relier    : vendue, prix d'achat inconnu — l'achat PROPOSÉ (src/liaisonAchat.js) s'il y en a un ;
//   bordereau : vendue, achat connu, colis à déposer — imprimer SON bordereau ;
//   baisser   : en vente — « Baisser le prix » (la baisse existante, son clic) ;
//   saisir    : pas vendue, prix d'achat inconnu — le saisir (la porte du chiffre qui manque, §5).
// ⚠️ §5 : deux paires sous ce N° ⇒ AUCUNE action (on ne choisit pas laquelle).
export function actionFiche(p, { sites = [], etat = null, proposition = undefined, peutRelier = false, peutBordereau = false, peutBaisser = false, peutSaisir = false } = {}) {
  if (!p || p.double || p.ancienNumero) return null;
  const r = p.resume || {};
  const s = situation(p, sites);
  if (s === 'vendue' && r.achat == null && peutRelier) return { sorte: 'relier', proposition: proposition === undefined ? undefined : proposition || null };
  if (s === 'vendue' && p.aPoster && peutBordereau) {
    const c = etape(p, 'colis');
    return { sorte: 'bordereau', tx: p.txAPoster || null, pret: /prêt/.test(str(c && c.detail)), limite: p.limiteEnvoi && p.limiteEnvoi.texte ? p.limiteEnvoi : null };
  }
  if (s === 'en-vente' && peutBaisser) {
    const o = etape(p, 'offres');
    // (19 nov.) Les offres lues sont celles de Vinted : sans annonce Vinted en ligne, « aucune offre » serait un « rien lu »
    // pris pour un « rien » (§5) — on ne dit rien.
    const aVinted = (sites || []).some((x) => x && x.site === 'vinted' && x.etat === 'en-ligne');
    const recues = aVinted && o && o.etat !== 'passu' ? evs(o).filter((x) => /^Reçue/.test(str(x.texte))).length : null;
    const j = joursEnLigne(etat);
    const fav = (sites || []).reduce((t, x) => (x && Number.isFinite(x.favoris) ? (t == null ? 0 : t) + x.favoris : t), null);
    return { sorte: 'baisser', offres: recues, jours: j ? j.n : null, favoris: fav };
  }
  if (s !== 'vendue' && r.achat == null && peutSaisir) return { sorte: 'saisir' };
  return null;
}

// LA VUE « ARGENT » : deux chiffres au plus, chacun UNE fois. `cents` null ⇒ « ? » (ambre si un geste le
// remplit). Les data-* d'avant (`data-fiche-resume-*`) sont portés par l'écran.
export function argentFiche(p, sites = []) {
  if (!p || p.double) return [];
  const r = p.resume || {};
  const s = situation(p, sites);
  if (s === 'vendue') {
    if (r.achat == null) return [
      { cle: 'achat', lib: 'fd.argent.achetee', cents: null, ambre: true },
      { cle: 'benefice', lib: 'fd.argent.benefice', cents: null, ambre: true, raison: r.raisonBenef || '' },
    ];
    return [
      { cle: 'benefice', lib: 'fd.argent.benefice', cents: r.benefice, signe: true, gros: true, partiel: !!r.benefPartiel, raison: r.benefice == null ? (r.raisonBenef || '') : '' },
      { cle: 'achat', lib: 'fd.argent.achetee', cents: r.achat },
    ];
  }
  if (s === 'en-vente' && r.siVendue) {
    const sv = r.siVendue;
    return [
      { cle: 'achat', lib: 'fd.argent.achetee', cents: r.achat, ambre: r.achat == null },
      { cle: 'si-vendue', lib: 'fd.argent.siVendue', cents: sv.benefice, signe: true, partiel: sv.etat === 'partiel', raison: sv.benefice == null ? (sv.raison || '') : '' },
    ];
  }
  return [{ cle: 'achat', lib: 'fd.argent.achetee', cents: r.achat, ambre: r.achat == null }];
}

// LA VUE « HISTOIRE » : quatre ou cinq lignes, dans l'ordre, une par étape qui compte — la même lecture que
// le parcours (dates LUES ; pas de date : rien d'inventé). `ton` : 'am' (geste), 'fait', 'ici' (où elle en est).
export function histoireFiche(p, { sites = [] } = {}) {
  if (!p) return [];
  const out = [];
  const s = situation(p, sites);
  const a = etape(p, 'achat');
  // (19 nov.) L'achat relié montre son vendeur, sa date, son prix (lus sur l'achat relié — `parcoursPaire`).
  if (a && a.etat === 'fait') { const ev = evs(a)[0]; out.push({ cle: 'achat', titre: 'fd.h.achetee', at: ev && ms(ev.at) != null ? ms(ev.at) : ms(a.date), montant: p.resume ? p.resume.achat : null, vendeur: str(a.vendeur), compte: str(a.compteAchat), relie: !!a.buyFromId, ton: 'fait' }); }
  else if (a && a.etat !== 'passu') out.push({ cle: 'achat', titre: 'fd.h.achat', detail: s === 'vendue' ? 'fd.h.pasRelie' : 'fd.h.prixPasSaisi', ton: 'am' });
  const ann = etape(p, 'annonces');
  const num = etape(p, 'numero');
  const dLigne = premiereDate(ann) != null ? premiereDate(ann) : premiereDate(num);
  const nomsSites = [...new Set((sites || []).filter((x) => x && x.etat === 'en-ligne').map((x) => x.site))];
  const depSites = (sites || []).filter((x) => x && x.etat === 'en-ligne' && Number.isFinite(x.depuis) && x.depuis > 0).map((x) => x.depuis);
  if (dLigne != null || (ann && ann.etat === 'fait') || nomsSites.length) out.push({ cle: 'annonces', titre: 'fd.h.miseEnLigne', at: dLigne != null ? dLigne : (depSites.length ? Math.min(...depSites) : null), sites: nomsSites, ton: s === 'en-vente' ? '' : 'fait' });
  if (s === 'vendue') {
    const v = etape(p, 'vente'); const ev = evs(v)[0];
    out.push({ cle: 'vente', titre: 'fd.h.vendue', at: ev ? ms(ev.at) : null, montant: null /* le prix est dans la grille de faits : écrit une fois */, compte: ev ? str(ev.texte).split(' · ').slice(2).join(' · ') : '', ton: 'fait' });
    const c = etape(p, 'colis');
    if (p.aPoster) out.push({ cle: 'colis', titre: 'fd.h.aEnvoyer', detail: c && /prêt/.test(str(c.detail)) ? 'fd.h.bordereauPret' : '', ton: 'am' });
    else if (c && c.etat === 'fait') out.push({ cle: 'colis', titre: 'fd.h.colis', libre: c.titre, at: premiereDate(c), ton: 'fait' });
    const g = etape(p, 'argent');
    if (g && g.etat === 'fait') out.push({ cle: 'argent', titre: 'fd.h.verse', at: premiereDate(g), ton: 'ici' });
    else if (!p.aPoster && !(c && c.etat !== 'fait')) out.push({ cle: 'argent', titre: 'fd.h.versement', detail: g && g.etat === 'passu' ? 'fd.h.pasLu' : 'fd.h.pasRecu', ton: 'ici' });
  } else if (s === 'en-vente') {
    const o = etape(p, 'offres');
    const n = (sites || []).some((x) => x && x.site === 'vinted' && x.etat === 'en-ligne') && o && o.etat !== 'passu' ? evs(o).filter((x) => /^Reçue/.test(str(x.texte))).length : null;
    out.push({ cle: 'en-vente', titre: 'fd.h.enVente', detail: n == null ? '' : n ? 'fd.h.offres' : 'fd.h.aucuneOffre', n, ton: 'ici' });
  }
  return out.slice(0, 6);
}
// (19 nov.) Repliée, l'histoire montre ses N dernières étapes (là où en est l'article) ; « Tout voir » montre le reste.
export const HISTOIRE_REPLIEE = 3;

// LA CIBLE de la liaison pour une VENTE (la forme de `fileVendus` dans Annonces → « Sans achat relié ») :
// le titre de la vente, la taille et la date de mise en ligne de SA fiche (par identité), sinon la date de
// vente. `vente` : { _tx, _item, title, price, date } (rechercheParNumero) · `fiche` : la fiche de son annonce.
export function cibleVente(vente, fiche, cleArticleVente) {
  if (!vente || vente._tx == null) return null;
  const key = typeof cleArticleVente === 'function' ? cleArticleVente(vente._tx) : `v:${vente._tx}`;
  const t = ms(vente.date);
  const enLigneLe = fiche && fiche.numberedAt && t != null && ms(fiche.numberedAt) != null && ms(fiche.numberedAt) <= t ? fiche.numberedAt : null;
  return { key, titre: vente.title || (fiche && fiche.title) || '', marque: '', taille: (fiche && (fiche.size || fiche.taille)) || '', couleur: '',
    dateRef: enLigneLe || vente.date || null, dateRefSource: enLigneLe ? 'en-ligne' : 'vente', prix: vente.price };
}

// LA VENTE qui raconte la paire (la règle de `parcoursPaire` : la plus récente pas annulée).
export function venteDeLaPaire(rn, annulee = () => false) {
  const l = ((rn && rn.ventes && rn.ventes.vinted) || []).slice().sort((a, b) => (ms(b.date) || 0) - (ms(a.date) || 0));
  return l.find((v) => !annulee(v)) || null;
}

// LES GESTES de la fiche (19 nov. : visibles SUR la fiche, plus derrière « ⋯ ») : chacun un geste qui existait (rien de
// neuf), seulement ceux qui ont un sens dans l'état de l'article. `dispo` : ce que l'écran a fourni ; `dispo.action` : la
// sorte du bouton principal — son geste n'est pas redit en tuile (« Baisser le prix » ⇒ pas de tuile « Prix »).
export const TUILES = ['prix', 'photos', 'note', 'republier', 'publier', 'dupliquer', 'emballer', 'bordereau', 'numero', 'rappel', 'certificat', 'taille'];
export function tuilesFiche(p, dispo = {}) {
  if (!p) return [];
  const neuve = !!dispo.neuve, rien = p.etat === 'rien', ancien = !!p.ancienNumero;
  // Seulement ce qui a un sens dans l'état de l'article : « Prix » et « Republier » d'une annonce en ligne, « Ailleurs » tant qu'elle n'est pas vendue.
  const sit = situation(p, dispo.sites || []); const enVente = sit === 'en-vente', vendue = sit === 'vendue';
  const ok = {
    note: !!dispo.note && !ancien, photos: !!dispo.atelier && !ancien, certificat: !!dispo.atelier && !ancien, rappel: !!dispo.rappel && !ancien,
    prix: !!dispo.onPrix && enVente && !neuve && !ancien && dispo.action !== 'baisser', publier: !!dispo.onPublierAilleurs && !vendue && !neuve && !rien && !ancien,
    republier: !!dispo.onRepublier && enVente && (dispo.sites || []).some((x) => x && x.site === 'vinted' && x.etat === 'en-ligne') && !neuve && !ancien && !p.double,
    dupliquer: !!dispo.onDupliquer && !rien && !ancien, taille: !!dispo.outilsIdees && !rien && !ancien && !p.double,
    bordereau: !!dispo.onBordereau && !!p.aPoster && !!p.txAPoster && dispo.action !== 'bordereau', emballer: !!dispo.onEmballer && !!p.aPoster, numero: !!dispo.histoNum,
  };
  return TUILES.filter((t) => ok[t]);
}

// ══ L'ARTICLE DE LA FICHE (19 nov.) ═══════════════════════════════════════════════════════════════════════════════════
// Julien : « Ce n'est pas parce que Vinted est ma plateforme principale que c'est la plateforme principale des autres.
// Tout doit être parfait sur chaque application. » ⇒ la fiche reçoit UN ARTICLE (ses annonces par site, ses faits), pas un
// identifiant Vinted. `articleFiche` est la SEULE entrée de la vue : elle rend un objet prêt à dessiner.
//
// ENTRÉE (la forme exacte attendue — c'est le contrat du branchement) :
//   p     : le parcours du N° (`histoireArticle` / `parcoursPaire`) — { num, titre, taille, photo, double, ancienNumero, etat,
//           manques, idFiche, aPoster, txAPoster, limiteEnvoi, etapes[], resume{ achat, vente, benefice, benefPartiel,
//           raisonBenef, siVendue{ prix, benefice, etat, raison }, detail } } (montants en CENTIMES, null = pas su) ;
//   o.sites : UNE entrée par annonce ou par vente, tous sites confondus :
//           { site: 'vinted'|'leboncoin'|'ebay'|'vestiaire', etat: 'en-ligne'|'vendue', id, compte (pseudo, '' si inconnu),
//             prix (centimes | null), date (ms, vente), depuis (ms, mise en ligne lue | undefined), favoris, vues (nombres
//             lus | undefined), lien (https), titre, photo, mini (centimes | null), miniPorte (cette annonce peut porter un
//             prix mini) } ;
//   o.sitesManques : les sites PAS LUS (noms), undefined = lecture en cours ;
//   o.etat  : `etatArticle` (les durées) ; o.taille ; o.photos[] ; o.neuve ;
//   o.achatParNum : le prix d'achat posé PAR N° (centimes) quand aucune fiche d'annonce ne le porte ;
//   o.siVendue(prixCentimes, achatCentimes) : la règle du bénéfice « si vendue » (`beneficeSiVendue`, fournie par l'écran) ;
//   o.relie (un achat est relié), o.peut { achat, relier, prix, mini, place }, o.dispo (les gestes fournis), o.action { … }.
// SORTIE : { num, titre, taille, photo, photos, double, ancien, situation, etat, faits, prixRef, sites, sitesManques,
//            action, gestes, histoire, p (le parcours complété) }.
// Un N° que ne porte AUCUNE annonce Vinted (Leboncoin seul, eBay seul, Vestiaire seul) est un article comme un autre : son
// titre, sa photo, son prix, ses jours en ligne, ses favoris viennent de l'annonce de SON site ; rien ne dit « relie à Vinted ».
export function articleFiche(p, o = {}) {
  if (!p) return null;
  const sites = (Array.isArray(o.sites) ? o.sites : []).filter(Boolean);
  const enL = sites.filter((x) => x.etat === 'en-ligne');
  const premier = enL[0] || sites[0] || null;
  const r0 = p.resume || {};
  const achat = r0.achat != null ? r0.achat : (Number.isFinite(o.achatParNum) ? o.achatParNum : null);
  // « Si vendue » d'un article sans annonce Vinted en ligne : la MÊME règle (`o.siVendue`), au prix de son annonce (le même
  // partout, sinon rien de deviné).
  let siVendue = r0.siVendue || null;
  if (!siVendue && enL.length && !enL.some((x) => x.site === 'vinted') && typeof o.siVendue === 'function') {
    const meme = enL.every((x) => x.prix != null && x.prix === enL[0].prix);
    if (meme) { try { siVendue = o.siVendue(enL[0].prix, achat) || null; } catch (_) { siVendue = null; } }
    else if (enL.every((x) => x.prix != null)) siVendue = { etat: 'prix', prix: null, benefice: null, raison: 'en ligne deux fois, à deux prix' };
  }
  const q = { ...p, etat: p.etat === 'rien' && sites.length ? 'trouve' : p.etat, titre: p.titre || (premier && premier.titre) || '', photo: p.photo || (premier && premier.photo) || null,
    resume: { ...r0, achat, siVendue } };
  const action = actionFiche(q, { sites, etat: o.etat || null, ...(o.action || {}) });
  const dispo = { ...(o.dispo || {}), sites, action: action && action.sorte };
  const faits = faitsFiche(q, { sites, etat: o.etat || null, taille: o.taille || '', peut: o.peut || {}, relie: !!o.relie, maintenant: o.maintenant });
  return {
    num: q.num, titre: (o.neuve && o.neuve.titre) || q.titre, taille: o.taille || '', photo: q.photo || '', photos: [...new Set([q.photo, ...(o.photos || []), ...sites.map((x) => x.photo)].filter(Boolean))],
    double: !!q.double, ancien: !!q.ancienNumero, situation: situation(q, sites),
    etat: etatCourt(q, { sites, etat: o.etat || null, dateCourte: o.dateCourte, action: action && action.sorte }),
    faits, prixRef: (faits.find((f) => f.cle === 'prix') || {}).cents,
    sites, sitesManques: o.sitesManques, action, gestes: tuilesFiche(q, dispo), histoire: histoireFiche(q, { sites }), p: q,
  };
}
