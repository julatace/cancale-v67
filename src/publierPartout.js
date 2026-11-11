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

// ── TOUS LES PARAMÈTRES DE PUBLICATION, PAR SITE (précisions de Julien, 11 nov. soir) ──
// « Proposer TOUS les paramètres de publication de chaque site, un réglage PAR
// DÉFAUT pour tous, puis modifiable PAR ANNONCE ; ce que VRM ne trouve pas, il le
// DEMANDE. » Chaque champ dit COMMENT la voie d'aujourd'hui le pose (`porte`) — la
// feuille ne promet que ce qui partira vraiment :
//   'fiche'    la fiche de VRM le porte (Leboncoin : l'état, le prix) ;
//   'vinted'   la voie le recopie ELLE-MÊME de l'annonce Vinted (catégorie, marque,
//              taille, couleur) : une autre valeur ne partirait pas ;
//   'reglages' la voie prend le réglage de VRM (Leboncoin : ta ville, Réglages) ;
//   'fixe'     la voie fait toujours la même chose (livraison activée ; aucune
//              option payante — le boost est impossible par construction, 17 oct.) ;
//   'site'     la voie ne le pose pas : il se choisit sur le site.
// La valeur d'un champ : celle de CETTE annonce, sinon le défaut du site, sinon ce
// que la voie posera d'elle-même (« auto »), sinon RIEN (demandé). Jamais devinée.
// Une valeur choisie que la voie ne peut pas porter :
//   · Leboncoin (la voie publie toute seule) : si la voie poserait une AUTRE valeur
//     ⇒ la case est bloquée et le dit (jamais une annonce publiée avec un autre
//     choix que le sien) ; si elle ne poserait rien ⇒ requis : « à choisir sur
//     Leboncoin » (le dépôt l'attend), facultatif : « ne partira pas » (dit avant) ;
//   · Vestiaire : le dépôt s'ouvre SANS publier tout seul, et la feuille dit quoi
//     choisir là-bas (« à finir sur Vestiaire : Matière « Cuir » »).
// ⚠️ Une extension qui saura recevoir ces champs (une version à réserver) n'aura
//    qu'à passer leur `porte` à 'fiche' : la règle et la feuille n'ont rien d'autre à changer.
export const CLE_PARAMS_PARTOUT = 'vrm_partout_params';
export const LBC_CATEGORIES = Object.freeze({
  Mode: ['Chaussures', 'Vêtements', 'Accessoires & Bagagerie', 'Montres & Bijoux'],
  Famille: ['Chaussures enfants', 'Vêtements enfants', 'Accessoires & bagagerie enfants', 'Montres & bijoux enfants'],
  Loisirs: ['Livres'],
});
export const VC_UNIVERS = Object.freeze(['Mode femme', 'Mode homme']);
const OUI_NON = Object.freeze(['oui', 'non']);
export const CHAMPS_PARTOUT = Object.freeze({
  leboncoin: Object.freeze([
    { champ: 'categorie', requis: true, porte: 'vinted', choix: Object.keys(LBC_CATEGORIES) },
    { champ: 'sousCategorie', requis: true, porte: 'vinted', choix: 'lbcSous' },
    { champ: 'marque', requis: false, porte: 'vinted' },
    { champ: 'taille', requis: true, porte: 'vinted' },
    { champ: 'couleur', requis: false, porte: 'vinted' },
    { champ: 'etat', requis: true, porte: 'fiche', choix: 'etatsLbc' },
    { champ: 'matiere', requis: false, porte: 'site' },
    { champ: 'livraison', requis: true, porte: 'fixe', choix: OUI_NON, fixe: 'oui' },
    { champ: 'mainPropre', requis: false, porte: 'site', choix: OUI_NON },
    { champ: 'lieu', requis: true, porte: 'reglages' },
    { champ: 'options', requis: false, porte: 'fixe', choix: ['aucune'], fixe: 'aucune', lecture: true },
  ]),
  vestiaire: Object.freeze([
    { champ: 'univers', requis: true, porte: 'vinted', choix: VC_UNIVERS },
    { champ: 'categorie', requis: true, porte: 'vinted' },
    { champ: 'marque', requis: true, porte: 'vinted' },
    { champ: 'taille', requis: true, porte: 'vinted' },
    { champ: 'etat', requis: true, porte: 'vinted' },
    { champ: 'couleur', requis: false, porte: 'vinted' },
    { champ: 'matiere', requis: false, porte: 'site' },
    { champ: 'authenticite', requis: false, porte: 'site', choix: OUI_NON },
  ]),
});
// Ce que la voie posera D'ELLE-MÊME (null = rien : demandé). `AU_DEPOT` = la voie
// le retrouve au dépôt (Vestiaire : la catégorie de Vinted sur SON catalogue) —
// ni une valeur inventée ni un manque.
export const AU_DEPOT = 'au-depot';
export const PROFIL = 'profil';
export function sousCategoriesLbc(categorie) { return categorie && LBC_CATEGORIES[categorie] ? LBC_CATEGORIES[categorie].slice() : Object.values(LBC_CATEGORIES).flat(); }
export function categorieLbcDeSous(sous) {
  for (const [c, l] of Object.entries(LBC_CATEGORIES)) if (l.includes(str(sous))) return c;
  return null;
}
export function autoChamp(site, champ, paire, r = {}) {
  const p = paire || {};
  if (site === 'leboncoin') {
    if (champ === 'sousCategorie' || champ === 'categorie') {
      let sous = '';
      try { sous = typeof r.categorieLbc === 'function' ? str(r.categorieLbc(p.title, p.desc, p.taille, p.marque)) : ''; } catch (_) { sous = ''; }
      if (!sous || !categorieLbcDeSous(sous)) return null;          // hors vocabulaire mesuré ⇒ demandé
      return champ === 'sousCategorie' ? sous : categorieLbcDeSous(sous);
    }
    if (champ === 'marque') return str(p.marque) || null;
    if (champ === 'taille') return str(p.taille) || null;
    if (champ === 'couleur') return str(p.couleur) || null;
    if (champ === 'etat') return etatPourLbc(p.etat, r.etatsLbc);
    if (champ === 'lieu') return str(r.ville) || PROFIL;               // vide ⇒ celle de son profil Leboncoin (lbc.js n'y touche pas)
    if (champ === 'livraison') return 'oui';
    if (champ === 'options') return 'aucune';
    return null;
  }
  if (site === 'vestiaire') {
    if (champ === 'univers' || champ === 'categorie') return AU_DEPOT;
    if (champ === 'marque') return str(p.marque) || null;
    if (champ === 'taille') return str(p.taille) || null;
    if (champ === 'etat') return str(p.etat) || null;
    if (champ === 'couleur') return str(p.couleur) || null;
    return null;
  }
  return null;
}
const normVal = (v) => str(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
// Une valeur rangée : texte court, ou une valeur de la liste du champ. Rien d'autre.
function valeurPermise(site, d, v, r = {}) {
  const s = str(v).replace(/\s+/g, ' ').slice(0, 60);
  if (!s) return '';
  if (d.lecture) return '';
  const liste = d.choix === 'etatsLbc' ? arr(r.etatsLbc) : d.choix === 'lbcSous' ? sousCategoriesLbc('') : Array.isArray(d.choix) ? d.choix : null;
  if (liste && !liste.includes(s)) return '';
  return s;
}
// Le réglage par défaut, rangé dans `vrm_partout_params` (SYNC_KEYS) :
// { leboncoin: { [champ]: valeur }, vestiaire: { … } } ; '' = auto.
export function reglageParams(brut, r = {}) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const out = {};
  for (const [site, champs] of Object.entries(CHAMPS_PARTOUT)) {
    const x = b[site] && typeof b[site] === 'object' ? b[site] : {};
    out[site] = {};
    for (const d of champs) { const v = valeurPermise(site, d, x[d.champ], r); if (v) out[site][d.champ] = v; }
  }
  return out;
}
// Les champs d'un site pour UNE annonce.
//   defaut : sortie `reglageParams` ; annonce : { [champ]: valeur } de CETTE annonce.
// Rend [{ champ, requis, porte, valeur, auto, source, demande, horsVoie, effet }] :
//   source : 'annonce' · 'defaut' · 'auto' · null (rien) ;
//   effet (Leboncoin) : '' · 'bloque' (la voie poserait autre chose) ·
//                       'sur-site' (requis, rien posé : à choisir pendant le dépôt) ·
//                       'perdu' (facultatif, la voie ne le pose pas : ne partira pas) ;
//          (Vestiaire) : '' · 'sur-site' (le dépôt s'ouvre sans publier tout seul).
export function champsSite(site, paire, { defaut = {}, annonce = {}, regles = {} } = {}) {
  const champs = CHAMPS_PARTOUT[site];
  if (!champs) return [];
  const def = (defaut && defaut[site]) || {};
  const ann = annonce && typeof annonce === 'object' ? annonce : {};
  const out = [];
  for (const d of champs) {
    const auto = autoChamp(site, d.champ, paire, regles);
    const va = valeurPermise(site, d, ann[d.champ], regles);
    const vd = valeurPermise(site, d, def[d.champ], regles);
    const choisi = va || vd;
    const source = va ? 'annonce' : vd ? 'defaut' : auto != null ? 'auto' : null;
    const valeur = choisi || auto;
    // Choisi ET différent de ce que la voie poserait d'elle-même : la voie ne le porte pas.
    const horsVoie = !!choisi && d.porte !== 'fiche' && (auto == null || auto === AU_DEPOT || auto === PROFIL || normVal(choisi) !== normVal(auto));
    let effet = '';
    if (site === 'leboncoin') {
      if (horsVoie && auto != null && auto !== PROFIL) effet = 'bloque';
      else if (horsVoie && auto === PROFIL) effet = 'bloque';                       // lbc.js garde la ville de son profil
      else if ((horsVoie || valeur == null) && d.requis && d.porte !== 'fiche') effet = 'sur-site';
      else if (horsVoie) effet = 'perdu';
    } else if (site === 'vestiaire') {
      if (horsVoie || (valeur == null && d.requis)) effet = 'sur-site';
    }
    // Demandé : un champ requis que rien ne donne (ni lui, ni le défaut, ni la voie).
    // Bloquant seulement là où la voie publierait sans (l'état Leboncoin, porté par
    // la fiche : `etat-lbc` dans `lignePartout`) ; ailleurs, le site l'attend au dépôt.
    const demande = valeur == null && !!d.requis;
    out.push({ champ: d.champ, requis: !!d.requis, porte: d.porte, choix: d.choix || null, lecture: !!d.lecture, valeur: valeur == null ? null : valeur, auto, source, demande, horsVoie, effet });
  }
  return out;
}
// Ce qui reste à faire sur le site, champ par champ (pour le dépôt et le bilan).
export const NOM_CHAMP = Object.freeze({ categorie: 'Catégorie', sousCategorie: 'Sous-catégorie', marque: 'Marque', taille: 'Taille', couleur: 'Couleur', etat: 'État',
  matiere: 'Matière', livraison: 'Livraison', mainPropre: 'Remise en main propre', lieu: 'Lieu', options: 'Options', univers: 'Univers', authenticite: 'Preuve d’authenticité', prix: 'Prix' });
export function aFinirSurSite(champs) {
  return arr(champs).filter((c) => c.effet === 'sur-site').map((c) => (c.valeur && c.valeur !== AU_DEPOT && c.valeur !== PROFIL && c.horsVoie ? `${NOM_CHAMP[c.champ] || c.champ} « ${c.valeur} »` : (NOM_CHAMP[c.champ] || c.champ)));
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
  const defParams = reglageParams(ctx.params, ctx.regles || {});
  const sites = SITES_PARTOUT.map((site) => {
    // Le prix de CETTE annonce sur CE site (tapé dans la feuille) passe avant le réglage.
    const pa = s.prixSite && typeof s.prixSite === 'object' ? Number(String(s.prixSite[site] == null ? '' : s.prixSite[site]).replace(',', '.').replace(/[\s€]/g, '')) : NaN;
    const prixAnnonce = PRIX_REGLABLE[site] && Number.isFinite(pa) && pa > 0 ? cents(pa) : null;
    const prix = prixAnnonce != null && prixSource != null ? prixAnnonce : prixPourSite(prixSource, reg[site]);
    const ap = apercuEnvoi(site, { ...p, prix }, ctx.regles || {});
    // Les paramètres du site : CETTE annonce, sinon le défaut, sinon ce que la voie pose.
    const annSite = { ...((s.params && s.params[site]) || {}) };
    if (site === 'leboncoin' && !annSite.etat && str(s.etatLbc)) annSite.etat = str(s.etatLbc);   // la demande d'état d'avant
    const champs = champsSite(site, p, { defaut: defParams, annonce: annSite, regles: ctx.regles || {} });
    const vocab = vocabulaire(site, p, { ...s, etatLbc: annSite.etat || s.etatLbc }, ctx.regles || {});
    if (site === 'leboncoin') { const sc = champs.find((c) => c.champ === 'sousCategorie'); if (sc && sc.valeur) vocab.categorie = sc.valeur; }
    // Les manques de la vérification de l'app (la même que celle des moteurs).
    let manques = manquesEnvoi(site, ap, { achat: ctx.achat == null ? null : ctx.achat, famille: ctx.famille || '', mpLbc: ctx.mpLbc !== false, horsVinted: p.chezMoi === true, facultatifs: ctx.facultatifs === true });
    // « Prix pas lu » se DEMANDE ici : le geste de la feuille, pas « ouvre Vinted ».
    // Un titre trop long pour Leboncoin/eBay serait REFUSÉ par la voie (`valideAnnonceLbc`, eBay) : bloquant.
    manques = manques.map((m) => (m.code === 'prix-absent' ? { ...m, bloque: true, geste: 'Tape le prix ci-dessous (celui de l’annonce Vinted)' }
      : m.code === 'titre' && site !== 'vestiaire' ? { ...m, bloque: true } : m));
    if (prixSource != null && prix == null) manques.push({ code: 'prix-regle', texte: 'Prix ajusté impossible', geste: 'Ton réglage de prix pour ce site donne 0 € ou moins : change-le', bloque: true });
    if (ap && ap.titre && TITRE_MAX_PARTOUT[site] && ap.titre.length > TITRE_MAX_PARTOUT[site] && !manques.some((m) => m.code === 'titre')) manques.push({ code: 'titre-long', texte: `Titre trop long (${ap.titre.length}/${TITRE_MAX_PARTOUT[site]})`, geste: 'Raccourcis le titre de l’annonce Vinted', bloque: true });
    if (vocab && vocab.etatDemande) manques.push({ code: 'etat-lbc', texte: p.etat ? `État « ${str(p.etat)} » inconnu de Leboncoin` : 'État pas lu', geste: 'Choisis l’état Leboncoin ci-dessous', bloque: true });
    // Un choix que la voie ne porte pas encore : dit AVANT (jamais une annonce publiée autrement).
    for (const c of champs) {
      const nom = NOM_CHAMP[c.champ] || c.champ;
      if (c.effet === 'bloque') manques.push({ code: 'hors-voie-' + c.champ, texte: `${nom} « ${c.valeur} » ne partirait pas`, geste: c.champ === 'lieu' ? 'Ton extension pose la ville de tes Réglages : change-la là, ou remets « auto »' : 'Ton extension pose encore celle de Vinted : remets « auto » ou change-la sur Leboncoin après', bloque: true });
      else if (c.effet === 'perdu') manques.push({ code: 'perdu-' + c.champ, texte: `${nom} : ne partira pas`, geste: 'Ton extension ne sait pas encore le poser : règle-le sur Leboncoin après', bloque: false });
    }
    const finir = aFinirSurSite(champs);
    const demandes = [];
    if (prixSource == null) demandes.push('prix');
    if (vocab && vocab.etatDemande) demandes.push('etat-lbc');
    for (const c of champs) if (c.demande && !(site === 'leboncoin' && c.champ === 'etat')) demandes.push('champ:' + c.champ);
    const extRaison = str(ctx.ext && ctx.ext[site]);
    const vu = ctx.enLigne ? ctx.enLigne[site] : null;
    const deja = vu === true ? true : vu === false ? false : null;
    let raison = '';
    if (!ap || !ap.num) raison = 'pas-de-numero';
    else if (deja === true) raison = 'deja';
    else if (extRaison) raison = 'ext';
    else if (manques.some((m) => m.bloque)) raison = 'manque';
    const cochable = !raison;
    return { site, apercu: ap, vocab, champs, finir, prixAnnonce, manques, demandes, deja, cochable, cocheDefaut: cochable && deja === false, raison, extRaison };
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
      out.push({ cle: cleCase(l.id, site), id: l.id, num: l.num, titre: l.titre, site, apercu: x.apercu, vocab: x.vocab, champs: arr(x.champs), finir: arr(x.finir) });
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
// doitSArreter() : lu ENTRE deux envois (jamais au milieu d'un dépôt), peut être une
//   promesse (« Mettre en pause » du suivi SuiviTravail attend Reprendre / Arrêter) ;
//   vrai ⇒ ce qui reste n'est PAS envoyé, et le dit.
// Vestiaire avec des champs « à finir sur le site » (`e.finir`) : le dépôt s'ouvre
//   sans publier tout seul ⇒ « à finir sur Vestiaire : … » tout de suite, et ce site
//   s'arrête (un seul dépôt en attente : le suivant écraserait celui-ci).
export async function executerPartout({ plan, envoyer = {}, attendre, surEtat, doitSArreter } = {}) {
  const res = {};
  const arrete = {};
  let stop = '';
  const dire = (cle, e) => { res[cle] = e; if (typeof surEtat === 'function') { try { surEtat(cle, e); } catch (_) {} } };
  for (const e of arr(plan)) {
    if (!stop && typeof doitSArreter === 'function') { let v = false; try { v = !!(await doitSArreter()); } catch (_) { v = true; } if (v) stop = 'pas envoyé : arrêté par toi'; }
    if (stop) { if (e && e.cle) dire(e.cle, { etat: 'pas-envoye', raison: stop }); continue; }
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
    const finir = arr(e.finir);
    if (e.site === 'vestiaire' && finir.length) {
      dire(e.cle, { etat: 'a-finir', raison: 'à finir sur Vestiaire : ' + finir.join(', '), finir });
      arrete[e.site] = 'pas envoyé : le dépôt précédent est à finir sur Vestiaire';
      continue;
    }
    // Un dépôt ouvert : on attend SA fin avant le suivant (un seul dépôt par site).
    dire(e.cle, { etat: 'attente', jobId: r.jobId || null, ...(finir.length ? { raison: 'à choisir sur ' + (NOM_PARTOUT[e.site] || e.site) + ' : ' + finir.join(', '), finir } : {}) });
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
