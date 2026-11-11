// ════════════════════════════════════════════════════════════════════════════
//  PUBLIER PARTOUT — DEPUIS L'ANNONCE VINTED (11 nov. 2026, demande de Julien)
// ════════════════════════════════════════════════════════════════════════════
// « Publier partout en un geste — mais ça doit PARTIR DE L'ANNONCE VINTED. »
// L'annonce Vinted est la SOURCE (titre, prix, photos, taille, état,
// description, N°) ; VRM la reporte sur Leboncoin, Vestiaire et eBay avec LEURS
// champs, une case par site, UN bouton.
//
// Ce module ne refait AUCUN moteur. Chaque site part par SA voie existante,
// avec ses gardes (compte de l'onglet, plafond de 50 actions/h, une requête à la
// fois — tenus par l'extension ou la route eBay) :
//   · Leboncoin : la commande `lbcPublier` de l'extension, avec la FICHE
//     (`appliquerAnnonceLbc`, capacité `lbcfiche`) — titre ≤ 50, prix réglé,
//     état du vocabulaire Leboncoin, photos captées, description « Réf. VRM-{n°} »
//     (règle `valideAnnonceLbc` de l'app, la même que la fiche) ;
//   · Vestiaire : la commande `vcPreparer` (capacité `vcpublier`) — l'extension
//     part de l'annonce Vinted elle-même ; son prix est le prix Vinted (la voie ne
//     prend pas d'autre prix : le dire, jamais le promettre) ; catégorie et état
//     se choisissent sur Vestiaire (« à finir sur le site ») ; détourage : celui
//     de la voie Vestiaire, la seule détourée (décision du 17 oct.) ;
//   · eBay : un BROUILLON (`ebay_brouillons`, la règle `itemDeBrouillon`) —
//     catégorie suggérée par eBay et critères remplis par des FAITS Vinted ;
//     JAMAIS publié d'ici : la mise en ligne reste celle des brouillons eBay
//     (frais annoncés, une confirmation par annonce, P12). Livraison gérée par
//     eBay, l'acheteur paie le port (§2.8) : aucun champ de port n'existe ici.
//
// ⚠️ IDENTITÉ (§5) : rien ne part sans N°. Chaque annonce publiée ailleurs porte
//    SON identité — Leboncoin et Vestiaire : « Réf. VRM-{n°} » dans la
//    description (que l'extension relit) ; eBay : le N° du brouillon, qui devient
//    le SKU `VRM-{n°}`. « Déjà en ligne sur X » se juge par CETTE identité
//    (`sitesDuNumero`), jamais par un titre. C'est elle que « vendu ailleurs ⇒
//    retirer » (src/retirerAilleurs.js) lit ensuite.
// ⚠️ PAS SU NE VAUT PAS NON : une liste du site pas lue ⇒ la case est DÉCOCHÉE
//    par défaut et le dit (il l'a peut-être publiée à la main).
// ⚠️ JAMAIS DEVINÉ : un prix ajusté se règle (égal par défaut), un champ
//    obligatoire inconnu (prix pas lu, état hors vocabulaire Leboncoin) est
//    DEMANDÉ dans la feuille — la case reste bloquée tant qu'il manque.
// ⚠️ L'UN APRÈS L'AUTRE : l'extension n'a qu'UN dépôt en attente par site
//    (`vrmPendingAd`, `vrmPendingVc`) — un second dépôt écraserait le premier.
//    Chaque envoi attend la FIN du précédent (job « fait » / « abandonné ») ;
//    un dépôt qui ne finit pas arrête ce site pour le reste de la série
//    (« pas envoyé : le dépôt précédent n'est pas fini »), jamais deux en vol.
//
// Module PUR (aucune lecture) : la feuille (src/PublierPartout.jsx), l'hôte de
// l'app et scripts/audit-publier-partout.cjs exécutent CES fonctions.
import { apercuEnvoi, manquesEnvoi, refVrm } from './publierAilleurs.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);
const cents = (n) => Math.round(n * 100) / 100;

// L'ordre d'envoi : les deux dépôts d'extension d'abord (ils ouvrent un onglet),
// le brouillon eBay ensuite (rien ne s'ouvre).
export const SITES_PARTOUT = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
export const NOM_PARTOUT = Object.freeze({ leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' });
// La limite de titre de chaque site (Leboncoin 50, eBay 80 ; Vestiaire : le titre
// que l'extension compose, `lbcTitre(…, 80)`).
export const TITRE_MAX_PARTOUT = Object.freeze({ leboncoin: 50, vestiaire: 80, ebay: 80 });
// Le prix se règle-t-il par site ? Vestiaire : non (la voie part du prix Vinted).
export const PRIX_REGLABLE = Object.freeze({ leboncoin: true, vestiaire: false, ebay: true });

// ── LE PRIX PAR SITE ───────────────────────────────────────────────────────
// Réglage rangé dans `vrm_partout_prix` (SYNC_KEYS) : { [site]: { mode, valeur } }.
//   mode : 'egal' (le prix Vinted — le défaut) · 'eur' (± euros) · 'pct' (± %).
//   valeur : un nombre, négatif pour baisser. Rien de lisible ⇒ 'egal'.
export const CLE_PRIX_PARTOUT = 'vrm_partout_prix';
export const MODES_PRIX = Object.freeze(['egal', 'eur', 'pct']);
export function reglagePrix(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const out = {};
  for (const site of SITES_PARTOUT) {
    const r = b[site] && typeof b[site] === 'object' ? b[site] : {};
    const mode = PRIX_REGLABLE[site] && MODES_PRIX.includes(r.mode) ? r.mode : 'egal';
    const v = Number(String(r.valeur == null ? '' : r.valeur).replace(',', '.'));
    const valeur = mode === 'egal' || !Number.isFinite(v) ? 0 : (mode === 'pct' ? Math.max(-90, Math.min(200, v)) : Math.max(-99999, Math.min(99999, v)));
    out[site] = { mode: valeur === 0 ? 'egal' : mode, valeur };
  }
  return out;
}
// Le prix qui part sur ce site. null = pas su (prix Vinted pas lu) ou impossible
// (≤ 0 après l'ajustement) — jamais un prix deviné.
export function prixPourSite(prixVinted, r) {
  const p = Number(prixVinted);
  if (!Number.isFinite(p) || p <= 0) return null;
  const x = r && typeof r === 'object' ? r : { mode: 'egal' };
  let n = p;
  if (x.mode === 'eur') n = p + Number(x.valeur || 0);
  else if (x.mode === 'pct') n = p * (1 + Number(x.valeur || 0) / 100);
  n = cents(n);
  return n > 0 ? n : null;
}
// « +5 € », « −10 % », « prix Vinted ».
export function texteReglage(r) {
  const x = r || {};
  if (!x.mode || x.mode === 'egal' || !x.valeur) return 'prix Vinted';
  const s = x.valeur > 0 ? '+' : '−';
  const v = String(Math.abs(x.valeur)).replace('.', ',');
  return x.mode === 'pct' ? `${s}${v} %` : `${s}${v} €`;
}

// ── LE VOCABULAIRE DE CHAQUE SITE ──────────────────────────────────────────
// L'état Vinted (« Neuf avec étiquette », « Neuf sans étiquette », « Très bon
// état », « Bon état », « Satisfaisant ») traduit dans les mots du site — vers
// une valeur que le site PROPOSE seulement, sinon null (demandé).
//   etatsLbc : la liste de l'app (`LBC_ETATS`).
export function etatPourLbc(etatVinted, etatsLbc = []) {
  const e = str(etatVinted).toLowerCase();
  const l = arr(etatsLbc).map(str);
  if (!e) return null;
  const exact = l.find((x) => x.toLowerCase() === e);
  if (exact) return exact;
  const cherche = /neuf avec/.test(e) ? /neuf avec/i : /tr[eè]s bon/.test(e) ? /tr[eè]s bon/i : /^bon [eé]tat/.test(e) ? /^bon [eé]tat/i : /satisfaisant/.test(e) ? /satisfaisant/i : null;
  return cherche ? (l.find((x) => cherche.test(x)) || null) : null;
}
// eBay : l'identifiant d'état (1000 neuf avec étiquette, 1500 neuf sans, 3000 occasion).
export const NOM_ETAT_EBAY = Object.freeze({ 1000: 'Neuf avec étiquettes', 1500: 'Neuf sans étiquette', 3000: 'Occasion' });
export function etatPourEbay(etatVinted) {
  const e = str(etatVinted).toLowerCase();
  if (!e) return null;
  return /neuf avec/.test(e) ? '1000' : /neuf sans/.test(e) ? '1500' : /(tr[eè]s bon|bon [eé]tat|satisfaisant)/.test(e) ? '3000' : null;
}
// Ce que chaque site recevra, champ par champ, dans SES mots.
//   r.categorieLbc(titre, desc, taille, marque) : la catégorie Leboncoin de l'app.
export function vocabulaire(site, paire, saisie = {}, r = {}) {
  const p = paire || {};
  const s = saisie || {};
  if (site === 'leboncoin') {
    const lu = etatPourLbc(p.etat, r.etatsLbc);
    const choisi = str(s.etatLbc) && arr(r.etatsLbc).includes(str(s.etatLbc)) ? str(s.etatLbc) : '';
    let categorie = '';
    try { categorie = typeof r.categorieLbc === 'function' ? str(r.categorieLbc(p.title, p.desc, p.taille, p.marque)) : ''; } catch (_) { categorie = ''; }
    return { etat: choisi || lu || null, etatDemande: !(choisi || lu), categorie: categorie || null, categorieQuand: 'maintenant', taille: str(p.taille) || null };
  }
  if (site === 'ebay') {
    const id = etatPourEbay(p.etat);
    return { etat: id ? NOM_ETAT_EBAY[id] : null, etatId: id, etatDemande: false, categorie: null, categorieQuand: 'au-depart', taille: str(p.taille) || null };
  }
  if (site === 'vestiaire') return { etat: null, etatDemande: false, categorie: null, categorieQuand: 'sur-le-site', taille: str(p.taille) || null };
  return null;
}

// ── UNE LIGNE : CE QUI PART, SITE PAR SITE ─────────────────────────────────
// paire : la source partagée (`useEbayPaires`) { id, num, title, taille, marque,
//   etat, couleur, photos, desc, prix, uid, cover, chezMoi }.
// ctx :
//   enLigne   : { [site]: true (vue PAR IDENTITÉ) · false (liste lue, absente) · null (pas su) }
//   ext       : { [site]: '' (la voie est prête) · 'raison' (extension / route pas prête) }
//   reglage   : sortie `reglagePrix`
//   saisie    : ce qu'il a tapé dans la feuille pour CETTE paire { prix, etatLbc }
//   regles    : règles de l'app passées à `apercuEnvoi` + { etatsLbc, categorieLbc }
//   achat, famille, mpLbc, facultatifs : comme `manquesEnvoi`
// Rend { id, num, ref, titre, cover, sites: [{ site, apercu, vocab, manques,
//   demandes, deja, cochable, cocheDefaut, raison }] }.
export function lignePartout(paire, ctx = {}) {
  const p = paire || {};
  const s = (ctx.saisie && typeof ctx.saisie === 'object') ? ctx.saisie : {};
  const prixTape = Number(String(s.prix == null ? '' : s.prix).replace(',', '.').replace(/[\s€]/g, ''));
  const prixSource = p.prix != null && p.prix !== '' && Number(p.prix) > 0 ? Number(p.prix) : (Number.isFinite(prixTape) && prixTape > 0 ? cents(prixTape) : null);
  const reg = reglagePrix(ctx.reglage);
  const sites = SITES_PARTOUT.map((site) => {
    const prix = prixPourSite(prixSource, reg[site]);
    const ap = apercuEnvoi(site, { ...p, prix }, ctx.regles || {});
    const vocab = vocabulaire(site, p, s, ctx.regles || {});
    // Les manques de la vérification de l'app (la même que celle des moteurs).
    let manques = manquesEnvoi(site, ap, { achat: ctx.achat == null ? null : ctx.achat, famille: ctx.famille || '', mpLbc: ctx.mpLbc !== false, horsVinted: p.chezMoi === true, facultatifs: ctx.facultatifs === true });
    // « Prix pas lu » se DEMANDE ici : le geste de la feuille, pas « ouvre Vinted ».
    // Un titre trop long pour Leboncoin/eBay serait REFUSÉ par la voie (`valideAnnonceLbc`, eBay) : bloquant.
    manques = manques.map((m) => (m.code === 'prix-absent' ? { ...m, bloque: true, geste: 'Tape le prix ci-dessous (celui de l’annonce Vinted)' }
      : m.code === 'titre' && site !== 'vestiaire' ? { ...m, bloque: true } : m));
    if (prixSource != null && prix == null) manques.push({ code: 'prix-regle', texte: 'Prix ajusté impossible', geste: 'Ton réglage de prix pour ce site donne 0 € ou moins : change-le', bloque: true });
    if (ap && ap.titre && TITRE_MAX_PARTOUT[site] && ap.titre.length > TITRE_MAX_PARTOUT[site] && !manques.some((m) => m.code === 'titre')) manques.push({ code: 'titre-long', texte: `Titre trop long (${ap.titre.length}/${TITRE_MAX_PARTOUT[site]})`, geste: 'Raccourcis le titre de l’annonce Vinted', bloque: true });
    if (vocab && vocab.etatDemande) manques.push({ code: 'etat-lbc', texte: p.etat ? `État « ${str(p.etat)} » inconnu de Leboncoin` : 'État pas lu', geste: 'Choisis l’état Leboncoin ci-dessous', bloque: true });
    const demandes = [];
    if (prixSource == null) demandes.push('prix');
    if (vocab && vocab.etatDemande) demandes.push('etat-lbc');
    const extRaison = str(ctx.ext && ctx.ext[site]);
    const vu = ctx.enLigne ? ctx.enLigne[site] : null;
    const deja = vu === true ? true : vu === false ? false : null;
    let raison = '';
    if (!ap || !ap.num) raison = 'pas-de-numero';
    else if (deja === true) raison = 'deja';
    else if (extRaison) raison = 'ext';
    else if (manques.some((m) => m.bloque)) raison = 'manque';
    const cochable = !raison;
    return { site, apercu: ap, vocab, manques, demandes, deja, cochable, cocheDefaut: cochable && deja === false, raison, extRaison };
  });
  return { id: str(p.id), num: str(p.num), ref: refVrm(p.num), titre: str(p.title), cover: p.cover || null, prixSource, sites };
}

// ── LE PLAN : CE QUI PART, DANS L'ORDRE ────────────────────────────────────
// lignes : sorties `lignePartout` ; coches : Set de `${id}:${site}`.
// Une case non cochable n'entre JAMAIS dans le plan (double garde avec la feuille).
export const cleCase = (id, site) => `${id}:${site}`;
export function planPartout(lignes, coches) {
  const c = coches instanceof Set ? coches : new Set(arr(coches));
  const out = [];
  for (const site of SITES_PARTOUT) {          // site par site : un dépôt à la fois par site
    for (const l of arr(lignes)) {
      const x = arr(l && l.sites).find((y) => y.site === site);
      if (!x || !x.cochable || !c.has(cleCase(l.id, site))) continue;
      if (!x.apercu || !x.apercu.num || !x.apercu.ref) continue;   // aucune identité ⇒ rien ne part
      out.push({ cle: cleCase(l.id, site), id: l.id, num: l.num, site, apercu: x.apercu, vocab: x.vocab });
    }
  }
  return out;
}

// ── L'ENVOI, L'UN APRÈS L'AUTRE ────────────────────────────────────────────
// envoyer : { leboncoin(e), vestiaire(e), ebay(e) } → réponse de la voie :
//   extension : { accepte, etape, jobId, code, raison } (ou null : pas de réponse) ;
//   eBay      : { accepte, etape: 'brouillon', complet, manque: [...], code, raison }.
// attendre(jobId) → { etape, raison } quand le dépôt est FINI (« fait »,
//   « abandonne », « echec ») ou { etape: 'delai' } s'il ne finit pas à temps.
// surEtat(cle, etat) : chaque changement, pour la feuille.
// États : envoi · attente · publie · a-finir · refuse · pas-envoye.
// Un refus qui dit « plafond », « pause », 429 ou « en cours » ARRÊTE ce site
// pour le reste de la série (jamais insister) ; les autres sites continuent.
const ARRET_SITE = /^(plafond|quota|pause|limite|429|403|frein|en-cours|compte|onglet|delai)$/;
export async function executerPartout({ plan, envoyer = {}, attendre, surEtat } = {}) {
  const res = {};
  const arrete = {};
  const dire = (cle, e) => { res[cle] = e; if (typeof surEtat === 'function') { try { surEtat(cle, e); } catch (_) {} } };
  for (const e of arr(plan)) {
    if (!e || !e.num || !e.apercu || !e.apercu.ref) { if (e && e.cle) dire(e.cle, { etat: 'pas-envoye', raison: 'pas de N° : aucune identité, rien ne part' }); continue; }
    if (arrete[e.site]) { dire(e.cle, { etat: 'pas-envoye', raison: arrete[e.site] }); continue; }
    const f = envoyer[e.site];
    if (typeof f !== 'function') { dire(e.cle, { etat: 'pas-envoye', raison: 'cette voie n’est pas prête ici' }); continue; }
    dire(e.cle, { etat: 'envoi' });
    let r = null;
    try { r = await f(e); } catch (_) { r = null; }
    if (!r) { const raison = 'pas de réponse — rien n’est sûr : regarde sur le site avant de relancer'; dire(e.cle, { etat: 'refuse', raison, geste: 'verifier' }); arrete[e.site] = 'pas envoyé : le site d’avant n’a pas répondu'; continue; }
    if (!r.accepte) {
      const code = str(r.code);
      dire(e.cle, { etat: 'refuse', raison: str(r.raison) || 'refusé', code });
      if (ARRET_SITE.test(code)) arrete[e.site] = `pas envoyé : ${str(r.raison) || 'ce site a dit stop'}`;
      continue;
    }
    if (e.site === 'ebay') {
      // Un brouillon eBay : jamais « publié » d'ici.
      dire(e.cle, { etat: 'a-finir', raison: r.complet ? 'brouillon prêt : mets-le en ligne depuis tes brouillons eBay' : `brouillon enregistré : ${arr(r.manque).length ? 'à choisir sur eBay — ' + arr(r.manque).join(', ') : 'à finir sur eBay'}`, complet: !!r.complet, brouillonId: r.brouillonId || null, deja: !!r.deja });
      continue;
    }
    if (str(r.etape) === 'fait') { dire(e.cle, { etat: 'publie' }); continue; }
    // Un dépôt ouvert : on attend SA fin avant le suivant (un seul dépôt par site).
    dire(e.cle, { etat: 'attente', jobId: r.jobId || null });
    let fin = null;
    try { fin = typeof attendre === 'function' && r.jobId ? await attendre(r.jobId) : { etape: 'delai' }; } catch (_) { fin = { etape: 'delai' }; }
    const et = str(fin && fin.etape);
    if (et === 'fait') dire(e.cle, { etat: 'publie' });
    else if (et === 'abandonne' || et === 'echec') dire(e.cle, { etat: 'refuse', raison: str(fin && fin.raison) ? `dépôt pas fini (${str(fin.raison)})` : 'dépôt pas fini', geste: 'site' });
    else { dire(e.cle, { etat: 'a-finir', raison: 'le dépôt est ouvert sur le site : finis-le là-bas' }); arrete[e.site] = 'pas envoyé : le dépôt précédent n’est pas fini'; }
  }
  return res;
}

// L'état AFFICHÉ : « publié ✓ relu » quand le site montre l'annonce PAR SON
// IDENTITÉ après coup (`vu` : sortie `sitesDuNumero` relue), sinon l'état de l'envoi.
export function etatAffiche(r, vu) {
  if (!r) return '';
  if (r.etat === 'publie' && vu === true) return 'publie-relu';
  return r.etat;
}
export function resumePartout(res) {
  const n = { publie: 0, 'a-finir': 0, refuse: 0, 'pas-envoye': 0 };
  for (const r of Object.values(res || {})) if (r && n[r.etat] != null) n[r.etat]++;
  return n;
}

// ── LES PASTILLES « AUSSI SUR » DE L'ANNONCE VINTED ────────────────────────
// Les sites où CE N° est en ligne, prouvé par identité : `lbc` (posée et encore
// en vente, `lbcAussi`), `ebay` (SKU), `vestiaire` (N° donné au produit, lien
// posé ou référence relue). Rien de su ⇒ aucune pastille (jamais une fausse).
export function aussiSur({ lbc = false, ebay = false, vestiaire = false } = {}) {
  return ['leboncoin', 'ebay', 'vestiaire'].filter((s) => (s === 'leboncoin' ? lbc : s === 'ebay' ? ebay : vestiaire) === true);
}
export const texteAussiSur = (l) => {
  const x = arr(l).map((s) => NOM_PARTOUT[s] || s);
  return x.length ? 'aussi sur ' + x.join(' · ') : '';
};
