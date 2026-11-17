// ── LA FICHE D'UN ARTICLE, DIRECTION D « FICHE PRODUIT » (15 nov., choisie par Julien) ─────────────
// Julien trouvait l'ancienne fiche « pas ouf », « trop longue » (six écrans). La direction D tient en UN
// écran 390×844 : la photo, le nom et UNE ligne d'état, UNE carte d'action (la seule chose à faire
// maintenant), puis un segment Argent · Sites · Histoire (une vue à la fois). Tout le reste est derrière
// « ⋯ » (feuille de tuiles + « Tout voir »). Récit : docs/passation/2026-11-15-fiche-d.md.
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
    const recues = o && o.etat !== 'passu' ? evs(o).filter((x) => /^Reçue/.test(str(x.texte))).length : null;
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
  if (a && a.etat === 'fait') { const ev = evs(a)[0]; out.push({ cle: 'achat', titre: 'fd.h.achetee', at: ev ? ms(ev.at) : null, montant: p.resume ? p.resume.achat : null, ton: 'fait' }); }
  else if (a && a.etat !== 'passu') out.push({ cle: 'achat', titre: 'fd.h.achat', detail: s === 'vendue' ? 'fd.h.pasRelie' : 'fd.h.prixPasSaisi', ton: 'am' });
  const ann = etape(p, 'annonces');
  const num = etape(p, 'numero');
  const dLigne = premiereDate(ann) != null ? premiereDate(ann) : premiereDate(num);
  const nomsSites = [...new Set((sites || []).filter((x) => x && x.etat === 'en-ligne').map((x) => x.site))];
  if (dLigne != null || (ann && ann.etat === 'fait')) out.push({ cle: 'annonces', titre: 'fd.h.miseEnLigne', at: dLigne, sites: nomsSites, ton: s === 'en-vente' ? '' : 'fait' });
  if (s === 'vendue') {
    const v = etape(p, 'vente'); const ev = evs(v)[0];
    out.push({ cle: 'vente', titre: 'fd.h.vendue', at: ev ? ms(ev.at) : null, montant: null /* le prix est dans la ligne d'état : écrit une fois */, compte: ev ? str(ev.texte).split(' · ').slice(2).join(' · ') : '', ton: 'fait' });
    const c = etape(p, 'colis');
    if (p.aPoster) out.push({ cle: 'colis', titre: 'fd.h.aEnvoyer', detail: c && /prêt/.test(str(c.detail)) ? 'fd.h.bordereauPret' : '', ton: 'am' });
    else if (c && c.etat === 'fait') out.push({ cle: 'colis', titre: 'fd.h.colis', libre: c.titre, at: premiereDate(c), ton: 'fait' });
    const g = etape(p, 'argent');
    if (g && g.etat === 'fait') out.push({ cle: 'argent', titre: 'fd.h.verse', at: premiereDate(g), ton: 'ici' });
    else if (!p.aPoster && !(c && c.etat !== 'fait')) out.push({ cle: 'argent', titre: 'fd.h.versement', detail: g && g.etat === 'passu' ? 'fd.h.pasLu' : 'fd.h.pasRecu', ton: 'ici' });
  } else if (s === 'en-vente') {
    const o = etape(p, 'offres');
    const n = o && o.etat !== 'passu' ? evs(o).filter((x) => /^Reçue/.test(str(x.texte))).length : null;
    out.push({ cle: 'en-vente', titre: 'fd.h.enVente', detail: n == null ? '' : n ? 'fd.h.offres' : 'fd.h.aucuneOffre', n, ton: 'ici' });
  }
  return out.slice(0, 5);
}

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

// Les TUILES de « ⋯ » : chacune un geste qui existait (rien de neuf). `dispo` : ce que l'écran a fourni.
export const TUILES = ['note', 'photos', 'certificat', 'rappel', 'prix', 'publier', 'dupliquer', 'taille', 'bordereau', 'emballer', 'numero'];
export function tuilesFiche(p, dispo = {}) {
  if (!p) return [];
  const neuve = !!dispo.neuve, rien = p.etat === 'rien', ancien = !!p.ancienNumero;
  const ok = {
    note: !!dispo.note && !ancien, photos: !!dispo.atelier && !ancien, certificat: !!dispo.atelier && !ancien, rappel: !!dispo.rappel && !ancien,
    prix: !!dispo.onPrix && !neuve && !ancien, publier: !!dispo.onPublierAilleurs && !neuve && !rien && !ancien,
    dupliquer: !!dispo.onDupliquer && !rien && !ancien, taille: !!dispo.outilsIdees && !rien && !ancien && !p.double,
    bordereau: !!dispo.onBordereau && !!p.aPoster && !!p.txAPoster, emballer: !!dispo.onEmballer && !!p.aPoster, numero: !!dispo.histoNum,
  };
  return TUILES.filter((t) => ok[t]);
}
