// ════════════════════════════════════════════════════════════════════════════
//  L'AGENT DE PUBLICATION, SANS IA (19 nov. 2026, chantier publier-agent)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « il faut un agent totalement intelligent capable de poster, peu importe ; s'il y a un
// doute il regarde, et s'il ne trouve pas il demande l'information à l'utilisateur » — « tu
// n'intègres pas d'IA » — « c'est l'extension qui va publier dans tous les cas ».
//
// 1. LA FICHE ARTICLE NEUTRE (`ficheArticle`) : catégorie VRM, genre, marque, pointure (EU), état,
//    couleurs, matières, dimensions, titre, description, photos, prix, prix mini — remplie à la
//    LECTURE des annonces de l'article (Vinted, Leboncoin, eBay, Vestiaire). Chaque champ dit d'où il
//    vient (`de`) ; un champ pas lu reste `null` (dans `manques`) ; deux annonces qui disent deux
//    choses différentes ⇒ `conflit`, jamais un choix au hasard.
// 2. LE PLAN PAR SITE (`planSite`) : chaque champ du site, dans l'ordre de confiance —
//    (a) les tables vérifiées (src/publier/tables.js, src/correspondances.js) ;
//    (b) SES réponses passées (retenues par catégorie VRM, par marque, par article) ;
//    (c) ce qui se LIT sur le site cible (la liste de catégories qu'eBay propose ; le libellé exact
//        que l'extension trouve sur le formulaire Leboncoin ; la liste des marques Vestiaire) ;
//    ce qui reste ⇒ UNE question groupée par article (`questionsArticle`). Rien ne part sans
//    catégorie sûre ni champ obligatoire sûr ; un site qui refuse ⇒ « pas vendable ici », dit.
// 3. L'ENVOI (`envoiPour`) : ce que l'EXTENSION reçoit (commande `publierFiche`, 5.409) — elle publie
//    depuis l'onglet du site, au nom du compte de l'onglet, dans ses plafonds, une à la fois. eBay :
//    un brouillon (la mise en ligne reste sa confirmation, §2.8 : aucun port).
// 4. LA RELECTURE (`relireEnvoi`) : la catégorie que le site a ENREGISTRÉE, lue sur ses annonces
//    (par identité : « Réf. VRM-{n°} », SKU `VRM-{n°}`), comparée à la voulue ; un écart dit quoi faire.
// 5. LA COUVERTURE (`couverture`) : chaque catégorie du stock × site : sûre · à demander · impossible.
// Module PUR : l'écran (src/ecrans/PublierAgent.jsx) et scripts/audit-publier-agent.cjs exécutent CES fonctions.
import { ficheSite, criteresPourLbc, lireMemoire as lireCorr, choixDe, TABLE_VINTED } from '../correspondances.js';
import { CATEGORIES_VRM, CLES_VRM, estCleVrm, depuisVinted, depuisLeboncoin, depuisEbay, vcDepuisVrm, choixVc, ETATS, etatNeutre, etatDepuisEbay,
  etatVersLbc, etatVersEbay, pointureEU, marqueVersLbc, marqueVersVc, marquesVcPermises, marquesLbcPermises, chercheExact, norm, cheminVinted } from './tables.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
export const SITES_AGENT = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
export const CLE_AGENT = 'vrm_agent_publier';
export const TITRE_MAX = Object.freeze({ leboncoin: 50, vestiaire: 80, ebay: 80 });
export const PHOTOS_MAX = 10;
const NUM_OK = /^[A-Z]{0,3}\d{1,6}$/;
const cleNumero = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

// ── LA MÉMOIRE : SES RÉPONSES ──────────────────────────────────────────────
// `vrm_agent_publier` (synchronisée, écrite sur SON toucher seulement) :
//   { v: 1, articles: { [cleArticle]: { categorie, etat, pointure, marque, sites: { leboncoin: { taille, etat, couleur } } } },
//     cat: { [cleVrm]: { leboncoin: { sous, univers, type }, vestiaire: { univers, categorie, sous }, ebay: { id, nom, chemin } } },
//     marque: { leboncoin: { [marque lue, normalisée]: libellé du site }, vestiaire: { … } },
//     envois: { ['site:N°']: { site, numero, voulu, at } } }
// Une valeur hors de la liste du site n'y entre JAMAIS (relue à chaque lecture).
const cleArt = (k) => (/^[\w:#.-]{1,80}$/.test(str(k)) ? str(k) : '');
export function lireMemoireAgent(brut) {
  const b = obj(brut) || {};
  const out = { v: 1, articles: {}, cat: {}, marque: { leboncoin: {}, vestiaire: {} }, envois: {} };
  for (const [k, x] of Object.entries(obj(b.articles) || {})) {
    const c = cleArt(k); const a = obj(x); if (!c || !a) continue;
    const e = {};
    if (estCleVrm(a.categorie)) e.categorie = str(a.categorie);
    if (etatNeutre(a.etat)) e.etat = etatNeutre(a.etat);
    if (pointureEU(a.pointure)) e.pointure = pointureEU(a.pointure);
    if (str(a.marque) && str(a.marque).length <= 40 && !/[<>]/.test(a.marque)) e.marque = str(a.marque);
    const sl = obj(a.sites) && obj(a.sites.leboncoin);
    if (sl) { const l = {}; for (const ch of ['taille', 'etat', 'couleur']) if (str(sl[ch]) && str(sl[ch]).length <= 60) l[ch] = str(sl[ch]); if (Object.keys(l).length) e.sites = { leboncoin: l }; }
    if (Object.keys(e).length) out.articles[c] = e;
  }
  for (const [k, x] of Object.entries(obj(b.cat) || {})) {
    if (!estCleVrm(k) || !obj(x)) continue;
    const e = {};
    const vc = obj(x.vestiaire);
    if (vc) { const v = {}; const u = chercheExact(choixVc('univers'), vc.univers); if (u) v.univers = u;
      const ca = chercheExact(choixVc('categorie', { univers: u || vcDepuisVrm(k).valeurs?.univers }), vc.categorie); if (ca) v.categorie = ca;
      const s = chercheExact(choixVc('sous', { univers: u || (vcDepuisVrm(k).valeurs || {}).univers, categorie: ca || (vcDepuisVrm(k).valeurs || {}).categorie }), vc.sous); if (s) v.sous = s;
      if (Object.keys(v).length) e.vestiaire = v; }
    const lb = obj(x.leboncoin);
    if (lb) { const l = {}; const so = chercheExact(choixDe('leboncoin', 'sous'), lb.sous); if (so) l.sous = so;
      const ctx = so || ((TABLE_VINTED[CATEGORIES_VRM[k].vinted] || {}).lbc || {}).sous || '';
      for (const ch of ['univers', 'type']) { const v = chercheExact(choixDe('leboncoin', ch, { sous: ctx.split(' › ').pop() }), lb[ch]); if (v) l[ch] = v; }
      if (Object.keys(l).length) e.leboncoin = l; }
    const eb = obj(x.ebay);
    if (eb && /^\d{1,9}$/.test(str(eb.id))) e.ebay = { id: str(eb.id), nom: str(eb.nom).slice(0, 80), chemin: str(eb.chemin).slice(0, 200) };
    if (Object.keys(e).length) out.cat[k] = e;
  }
  const mq = obj(b.marque) || {};
  for (const [m, v] of Object.entries(obj(mq.leboncoin) || {})) { const ok = chercheExact(marquesLbcPermises(), v); if (norm(m) && ok) out.marque.leboncoin[norm(m).slice(0, 40)] = ok; }
  for (const [m, v] of Object.entries(obj(mq.vestiaire) || {})) { const ok = chercheExact(marquesVcPermises(), v); if (norm(m) && ok) out.marque.vestiaire[norm(m).slice(0, 40)] = ok; }
  for (const [k, x] of Object.entries(obj(b.envois) || {})) {
    const e = obj(x); if (!e || !SITES_AGENT.includes(e.site) || !NUM_OK.test(cleNumero(e.numero)) || k !== `${e.site}:${cleNumero(e.numero)}`) continue;
    out.envois[k] = { site: e.site, numero: cleNumero(e.numero), voulu: obj(e.voulu) || {}, at: Number(e.at) || 0 };
  }
  return out;
}

// ── 1. LA FICHE ARTICLE NEUTRE ─────────────────────────────────────────────
// article : un article de `construireArticles` (src/articles/modele.js) — { cle, numero, prix, prixMini, annonces: [{ site, id, titre, photo,
//   prix, taille, condition, marque }] } ; lectures : { vinted: { [id]: fiche de la page (codes, description, photos, couleur) },
//   ebay: { [itemId]: detail (categoryName, condition, specifics, description, photos) }, leboncoin: { [id]: { category, body, images } } }.
export const CHAMPS_FICHE = Object.freeze(['categorie', 'genre', 'marque', 'pointure', 'etat', 'couleurs', 'matieres', 'dimensions', 'titre', 'description', 'photos', 'prix', 'prixMini']);
const ORDRE_SITES = ['vinted', 'ebay', 'leboncoin', 'vestiaire'];
function accorder(cands, egal = (a, b) => norm(a) === norm(b)) {
  const l = cands.filter((c) => c && c.v != null && c.v !== '' && !(Array.isArray(c.v) && !c.v.length));
  if (!l.length) return null;
  const autres = l.filter((c) => !egal(c.v, l[0].v));
  return autres.length ? { v: null, conflit: l.map((c) => ({ v: c.v, de: c.de })) } : { v: l[0].v, de: l[0].de };
}
export function ficheArticle(article, lectures = {}, memoire = null) {
  const a = obj(article) || {};
  const mem = lireMemoireAgent(memoire);
  const rep = mem.articles[cleArt(a.cle)] || {};
  const L = { vinted: obj(lectures.vinted) || {}, ebay: obj(lectures.ebay) || {}, leboncoin: obj(lectures.leboncoin) || {} };
  const ann = arr(a.annonces).slice().sort((x, y) => ORDRE_SITES.indexOf(x.site) - ORDRE_SITES.indexOf(y.site));
  const lu = { categorie: [], partielle: [], marque: [], pointure: [], taille: [], etat: [], couleurs: [], matieres: [], titre: [], description: [], photos: [] };
  const inconnues = [];
  for (const x of ann) {
    const s = x.site;
    const d = s === 'vinted' ? obj(L.vinted[String(x.id)]) : s === 'ebay' ? obj(L.ebay[String(x.id)]) : s === 'leboncoin' ? obj(L.leboncoin[String(x.id)]) : null;
    if (s === 'vinted') {
      const codes = d && obj(d.codes);
      const r = codes ? depuisVinted(codes.catalog_id) : null;
      if (r && r.cle) lu.categorie.push({ v: r.cle, de: s }); else if (r && r.inconnue) inconnues.push(s + ':' + r.inconnue);
      if (d && str(d.couleur)) lu.couleurs.push({ v: str(d.couleur).split(/\s*[/,]\s*/).filter(Boolean), de: s });
      if (d && str(d.description)) lu.description.push({ v: str(d.description), de: s });
      if (d && arr(d.photos).length) lu.photos.push({ v: arr(d.photos).map((p) => (typeof p === 'string' ? p : p && p.url)).filter((u) => /^https:\/\//.test(str(u))), de: s });
    }
    if (s === 'ebay' && d) {
      const r = depuisEbay(d.categoryName); if (r && r.cle) lu.categorie.push({ v: r.cle, de: s }); else if (r && r.horsTable) inconnues.push('ebay:' + r.horsTable.slice(0, 60));
      const sp = obj(d.specifics) || {};
      const premier = (k) => { const v = sp[k]; return str(Array.isArray(v) ? v[0] : v); };
      if (premier('Marque')) lu.marque.push({ v: premier('Marque'), de: s });
      if (pointureEU(premier('Pointure EU'))) lu.pointure.push({ v: pointureEU(premier('Pointure EU')), de: s });
      if (premier('Couleur')) lu.couleurs.push({ v: [premier('Couleur')], de: s });
      const mat = premier('Matière') || premier('Matière extérieure') || premier('Matière de la tige');
      if (mat) lu.matieres.push({ v: [mat], de: s });
      if (etatDepuisEbay(d.condition)) lu.etat.push({ v: etatDepuisEbay(d.condition), de: s });
      if (str(d.description)) lu.description.push({ v: str(d.description), de: s });
      if (arr(d.photos).length) lu.photos.push({ v: arr(d.photos).map(str).filter((u) => /^https:\/\//.test(u)), de: s });
    }
    if (s === 'leboncoin' && d) {
      const r = depuisLeboncoin(d.category); if (r && r.candidates) lu.partielle.push({ famille: r.famille, candidates: r.candidates, de: s });
      if (str(d.body)) lu.description.push({ v: str(d.body), de: s });
      const im = arr(d.images).map((p) => (typeof p === 'string' ? p : p && p.url)).filter((u) => /^https:\/\//.test(str(u)));
      if (im.length) lu.photos.push({ v: im, de: s });
    }
    if (str(x.marque)) lu.marque.push({ v: str(x.marque), de: s });
    const pt = pointureEU(x.taille);
    if (pt) lu.pointure.push({ v: pt, de: s }); else if (str(x.taille)) lu.taille.push({ v: str(x.taille), de: s });
    if (etatNeutre(x.condition)) lu.etat.push({ v: etatNeutre(x.condition), de: s });
    if (str(x.titre)) lu.titre.push({ v: str(x.titre), de: s });
    if (str(x.photo)) lu.photos.push({ v: [str(x.photo)], de: s + '-vignette' });
  }
  const champs = {};
  const conflits = {};
  const poser = (k, r) => { if (!r) { champs[k] = null; return; } if (r.conflit) { champs[k] = null; conflits[k] = r.conflit; return; } champs[k] = { v: r.v, de: r.de }; };
  // Catégorie : une SÛRE lue ; deux sûres différentes ⇒ conflit ; une partielle contraire à la sûre ⇒ conflit.
  let cat = accorder(lu.categorie, (x, y) => x === y);
  if (cat && cat.v && lu.partielle.some((p) => !p.candidates.includes(cat.v))) cat = { v: null, conflit: [{ v: cat.v, de: cat.de }, ...lu.partielle.map((p) => ({ v: p.famille, de: p.de }))] };
  if (estCleVrm(rep.categorie)) cat = { v: rep.categorie, de: 'reponse' };
  poser('categorie', cat);
  const C = champs.categorie ? CATEGORIES_VRM[champs.categorie.v] : null;
  champs.genre = C ? { v: C.genre, de: champs.categorie.de } : null;
  poser('marque', rep.marque ? { v: rep.marque, de: 'reponse' } : accorder(lu.marque));
  poser('pointure', rep.pointure ? { v: rep.pointure, de: 'reponse' } : accorder(lu.pointure, (x, y) => x === y));
  if (!champs.pointure && lu.taille.length) { const t = accorder(lu.taille); if (t && t.v) champs.taille = { v: t.v, de: t.de }; }
  poser('etat', rep.etat ? { v: rep.etat, de: 'reponse' } : accorder(lu.etat, (x, y) => x === y));
  poser('couleurs', lu.couleurs[0] ? { v: lu.couleurs[0].v, de: lu.couleurs[0].de } : null);
  poser('matieres', lu.matieres[0] ? { v: lu.matieres[0].v, de: lu.matieres[0].de } : null);
  champs.dimensions = null;                 // aucun site ne les rend sur ses annonces lues
  poser('titre', lu.titre[0] ? { v: lu.titre[0].v, de: lu.titre[0].de } : null);
  poser('description', lu.description[0] ? { v: lu.description[0].v, de: lu.description[0].de } : null);
  const ph = lu.photos.find((p) => p.v.length) || null;
  poser('photos', ph ? { v: [...new Set(ph.v)].slice(0, PHOTOS_MAX), de: ph.de } : null);
  const prix = typeof a.prix === 'number' && a.prix > 0 ? a.prix : null;
  champs.prix = prix != null ? { v: prix, de: 'annonce' } : null;
  champs.prixMini = typeof a.prixMini === 'number' && a.prixMini > 0 ? { v: a.prixMini, de: 'vrm' } : null;
  const manques = CHAMPS_FICHE.filter((k) => !champs[k]);
  return { cle: str(a.cle), numero: cleNumero(a.numero) && NUM_OK.test(cleNumero(a.numero)) ? cleNumero(a.numero) : '', sites: [...new Set(ann.map((x) => x.site))],
    enLigne: Object.fromEntries(ann.filter((x) => x.etat === 'enligne').map((x) => [x.site, String(x.id)])), vintedId: (ann.find((x) => x.site === 'vinted') || {}).id || '',
    champs, conflits, manques, inconnues, candidates: lu.partielle.length ? [...new Set(lu.partielle.flatMap((p) => p.candidates))] : [] };
}
const v = (f, k) => (f && f.champs && f.champs[k] ? f.champs[k].v : null);

// ── 2. LE PLAN D'UN SITE ───────────────────────────────────────────────────
// ctx : { corr (vrm_correspondances brut), ext: { leboncoin, vestiaire } (l'extension sait publier une fiche : true/false),
//   deja: { [site]: true|false|null } (déjà en ligne sur ce site, par identité ; null = pas su) }.
// Rend { site, etat: 'pret' | 'question' | 'refus' | 'deja', valeurs, origine, questions, refus: { code } | null, chemin }.
const Q = (champ, choix, { site = '', bloque = true, saisie = '', candidates = null } = {}) => ({ champ, site, choix: choix || [], bloque: !!bloque, saisie, ...(candidates ? { candidates } : {}) });
function questionsFiche(f, besoins) {
  const q = [];
  if (besoins.includes('categorie') && !v(f, 'categorie')) {
    const cands = f.conflits.categorie ? [...new Set(f.conflits.categorie.map((c) => c.v).filter(estCleVrm))] : f.candidates;
    q.push(Q('categorie', cands && cands.length ? cands : CLES_VRM.slice(), { candidates: cands && cands.length ? cands : null }));
  }
  if (besoins.includes('etat') && !v(f, 'etat')) q.push(Q('etat', ETATS.slice()));
  // La famille est sûre si la catégorie l'est, ou si TOUTES les candidates lues la partagent (Leboncoin « Chaussures ») :
  // la pointure se demande alors dans la MÊME question que la catégorie.
  const cands = v(f, 'categorie') ? [v(f, 'categorie')] : arr(f.candidates);
  const chaussure = cands.length > 0 && cands.every((k) => CATEGORIES_VRM[k] && CATEGORIES_VRM[k].famille === 'chaussures');
  if (besoins.includes('pointure') && chaussure && !v(f, 'pointure')) q.push(Q('pointure', [], { saisie: 'pointure' }));
  if (besoins.includes('marque') && !v(f, 'marque')) q.push(Q('marque', [], { saisie: 'texte' }));
  return q;
}
export function planSite(fiche, site, memoire, ctx = {}) {
  const f = fiche || { champs: {}, conflits: {}, manques: CHAMPS_FICHE.slice() };
  const mem = lireMemoireAgent(memoire);
  const out = { site, etat: 'pret', valeurs: {}, origine: {}, questions: [], refus: null, chemin: '' };
  const refuser = (code, extra = {}) => { out.etat = 'refus'; out.refus = { code, ...extra }; return out; };
  if (ctx.deja && ctx.deja[site] === true) { out.etat = 'deja'; return out; }
  if (!f.numero) return refuser('sans-numero');
  if (ctx.ext && ctx.ext[site] === false) return refuser('extension');
  if (!v(f, 'prix')) return refuser('prix-pas-lu');
  if (!arr(v(f, 'photos')).length) return refuser('sans-photo');
  if (!v(f, 'titre')) return refuser('sans-titre');
  const besoins = site === 'ebay' ? ['categorie', 'etat'] : site === 'vestiaire' ? ['categorie', 'etat', 'pointure', 'marque'] : ['categorie', 'etat', 'pointure'];
  out.questions.push(...questionsFiche(f, besoins));
  const cle = v(f, 'categorie');
  const C = cle ? CATEGORIES_VRM[cle] : null;
  const repA = mem.articles[cleArt(f.cle)] || {};
  if (site === 'leboncoin' && C) {
    // La table vérifiée (par l'identifiant Vinted équivalent), SES réponses d'avant (vrm_correspondances) et celles de l'agent.
    const corr = lireCorr(ctx.corr);
    const mc = mem.cat[cle] && mem.cat[cle].leboncoin;
    if (mc) corr.cat[C.vinted] = { ...(corr.cat[C.vinted] || {}), leboncoin: { ...((corr.cat[C.vinted] || {}).leboncoin || {}), ...mc } };
    const r = ficheSite('leboncoin', { catalogId: C.vinted, taille: v(f, 'pointure') || (f.champs.taille && f.champs.taille.v) || '', etat: v(f, 'etat') || '', couleur: arr(v(f, 'couleurs'))[0] || '', marque: '' },
      corr, (repA.sites && repA.sites.leboncoin) || {});
    out.chemin = cheminVinted(cle);
    Object.assign(out.valeurs, r.valeurs); Object.assign(out.origine, r.origine);
    for (const d of r.demandes) if (!(d.champ === 'etat' && !v(f, 'etat')) && !(d.champ === 'taille' && !v(f, 'pointure') && C.famille === 'chaussures')) out.questions.push(Q(d.champ, d.choix, { site, bloque: d.bloque }));
    // La marque : la liste du site (793 libellés pour les chaussures), sinon SA réponse par marque ; hors liste ⇒ demandée, JAMAIS « Autre » d'office.
    const m = v(f, 'marque');
    if (m) {
      const mm = marqueVersLbc(m, C.famille);
      const memM = mem.marque.leboncoin[norm(m)];
      if (mm.etat === 'sure') { out.valeurs.marque = mm.valeur; out.origine.marque = 'table'; }
      else if (memM) { out.valeurs.marque = memM; out.origine.marque = 'memoire'; }
      else if (mm.etat === 'a-lire') { out.valeurs.marque = mm.valeur; out.origine.marque = 'lu-site'; }
      else out.questions.push(Q('marque', marquesLbcPermises(), { site, bloque: false }));
    }
  }
  if (site === 'vestiaire' && C) {
    const t = vcDepuisVrm(cle);
    if (t.hors) return refuser('hors-site');
    const mv = (mem.cat[cle] && mem.cat[cle].vestiaire) || {};
    const val = {};
    for (const ch of ['univers', 'categorie', 'sous']) {
      const choix = choixVc(ch, val);
      const deTable = t.valeurs[ch] && chercheExact(choix, t.valeurs[ch]);
      const deMem = mv[ch] && chercheExact(choix, mv[ch]);
      if (deTable && !(deMem && deMem !== deTable)) { val[ch] = deTable; out.origine[ch] = 'table'; }
      else if (deMem) { val[ch] = deMem; out.origine[ch] = 'memoire'; }
      else { out.questions.push(Q(ch, choix, { site })); break; }
    }
    Object.assign(out.valeurs, val);
    out.chemin = cheminVinted(cle);
    const m = v(f, 'marque');
    if (m) {
      const mm = marqueVersVc(m);
      const memM = mem.marque.vestiaire[norm(m)];
      if (mm.etat === 'sure') { out.valeurs.marque = mm.valeur; out.origine.marque = 'table'; }
      else if (memM) { out.valeurs.marque = memM; out.origine.marque = 'memoire'; }
      else if (mm.etat === 'a-lire') { out.valeurs.marque = mm.valeur; out.origine.marque = 'lu-site'; }
      else { out.questions.push(Q('marque', marquesVcPermises(), { site, bloque: true })); out.refus = { code: 'marque-hors-liste', marque: m }; }
    }
    if (v(f, 'etat')) { out.valeurs.etat = v(f, 'etat'); out.origine.etat = 'fiche'; }
    if (v(f, 'pointure')) { out.valeurs.taille = v(f, 'pointure'); out.origine.taille = 'fiche'; }
  }
  if (site === 'ebay' && C) {
    const corr = lireCorr(ctx.corr);
    const me = (mem.cat[cle] && mem.cat[cle].ebay) || (corr.cat[C.vinted] && corr.cat[C.vinted].ebay) || null;
    if (me) { out.valeurs.categorie = me; out.origine.categorie = 'memoire'; }
    else out.questions.push(Q('categorieEbay', [], { site, saisie: 'ebay', bloque: true, candidates: null }));
    out.requete = (TABLE_VINTED[C.vinted] && TABLE_VINTED[C.vinted].ebay.requete) || '';
    out.chemin = cheminVinted(cle);
    if (v(f, 'etat') && etatVersEbay(v(f, 'etat'))) { out.valeurs.etat = etatVersEbay(v(f, 'etat')); out.origine.etat = 'table'; }
    if (v(f, 'pointure')) { out.valeurs.pointureEU = v(f, 'pointure'); out.origine.pointureEU = 'fiche'; }
  }
  if (out.questions.some((q) => q.bloque)) { out.etat = out.refus ? 'refus' : 'question'; }
  return out;
}

// ── LA QUESTION GROUPÉE D'UN ARTICLE ───────────────────────────────────────
// Toutes les inconnues de l'article pour tous les sites choisis, sans doublon (la catégorie, l'état,
// la pointure ne se demandent qu'une fois, quel que soit le nombre de sites).
export function questionsArticle(fiche, plans) {
  const vus = new Set(); const out = [];
  for (const p of arr(plans)) for (const q of arr(p.questions)) {
    const k = (q.site && !['categorie', 'etat', 'pointure', 'marque'].includes(q.champ) ? q.site : (q.site && q.champ === 'marque' ? q.site : '')) + ':' + q.champ;
    if (vus.has(k)) continue; vus.add(k); out.push(q);
  }
  // L'ordre : ce qui vaut pour tous les sites d'abord (catégorie, état, pointure), puis par site.
  const rang = (q) => (q.site ? 10 : 0) + ['categorie', 'etat', 'pointure', 'marque'].indexOf(q.champ);
  return { cle: fiche ? fiche.cle : '', numero: fiche ? fiche.numero : '', questions: out.sort((a, b) => rang(a) - rang(b)) };
}

// ── RETENIR SES RÉPONSES ───────────────────────────────────────────────────
// reponses : [{ champ, site, valeur }] ; rend une NOUVELLE mémoire. Une valeur hors de la liste du site ⇒ ignorée.
export function retenirReponses(memoire, fiche, reponses) {
  const m = lireMemoireAgent(memoire);
  const ca = cleArt(fiche && fiche.cle);
  const art = { ...(m.articles[ca] || {}) };
  let cle = v(fiche, 'categorie');
  for (const r of arr(reponses)) {
    const val = r && r.valeur; const site = str(r && r.site); const ch = str(r && r.champ);
    if (!ch) continue;
    if (!site) {
      if (ch === 'categorie' && estCleVrm(val)) { art.categorie = str(val); cle = str(val); }
      else if (ch === 'etat' && etatNeutre(val)) art.etat = etatNeutre(val);
      else if (ch === 'pointure' && pointureEU(val)) art.pointure = pointureEU(val);
      else if (ch === 'marque' && str(val) && str(val).length <= 40 && !/[<>]/.test(val)) art.marque = str(val);
      continue;
    }
    if (ch === 'marque' && (site === 'leboncoin' || site === 'vestiaire')) {
      const src = v(fiche, 'marque') || art.marque; const liste = site === 'leboncoin' ? marquesLbcPermises() : marquesVcPermises();
      const ok = chercheExact(liste, val); if (src && ok) m.marque[site] = { ...m.marque[site], [norm(src).slice(0, 40)]: ok };
      continue;
    }
    if (!cle) continue;
    const e = { ...(m.cat[cle] || {}) };
    if (site === 'vestiaire' && ['univers', 'categorie', 'sous'].includes(ch)) e.vestiaire = { ...(e.vestiaire || {}), [ch]: str(val) };
    else if (site === 'leboncoin' && ['sous', 'univers', 'type'].includes(ch)) { e.leboncoin = { ...(e.leboncoin || {}), [ch]: str(val) }; if (ch === 'sous') { delete e.leboncoin.univers; delete e.leboncoin.type; } }
    else if (site === 'leboncoin' && ['taille', 'etat', 'couleur'].includes(ch)) { art.sites = { leboncoin: { ...((art.sites && art.sites.leboncoin) || {}), [ch]: str(val) } }; continue; }
    else if (site === 'ebay' && ch === 'categorieEbay' && obj(val) && /^\d{1,9}$/.test(str(val.id))) e.ebay = { id: str(val.id), nom: str(val.nom), chemin: str(val.chemin) };
    else continue;
    m.cat[cle] = e;
  }
  if (ca && Object.keys(art).length) m.articles[ca] = art;
  return lireMemoireAgent(m);
}

// ── 3. L'ENVOI ─────────────────────────────────────────────────────────────
// Le titre dans la limite du site, coupé à un mot (jamais au milieu).
export function titrePour(site, t) {
  const max = TITRE_MAX[site] || 80; const s = str(t).replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const c = s.slice(0, max + 1); const i = c.lastIndexOf(' ');
  return (i > 20 ? c.slice(0, i) : s.slice(0, max)).trim();
}
export const refVrm = (n) => `Réf. VRM-${n}`;
// Rend { voie: 'extension', msg } · { voie: 'ebay-brouillon', p, categorie } · null (pas prêt : rien ne part).
export function envoiPour(fiche, plan) {
  if (!fiche || !plan || plan.etat !== 'pret') return null;
  const n = fiche.numero; if (!n) return null;
  const desc0 = str(v(fiche, 'description'));
  const description = new RegExp('VRM-' + n + '(?!\\d)').test(desc0) ? desc0 : (desc0 ? desc0 + '\n\n' : '') + refVrm(n);
  const base = { cle: fiche.cle, numero: n, titre: titrePour(plan.site, v(fiche, 'titre')), description, prix: v(fiche, 'prix'), photos: arr(v(fiche, 'photos')).slice(0, PHOTOS_MAX),
    ...(fiche.vintedId ? { vintedId: String(fiche.vintedId) } : {}) };
  if (plan.site === 'leboncoin') {
    const c = criteresPourLbc({ site: 'leboncoin', valeurs: plan.valeurs, ambigu: false });
    if (!c.categorie) return null;                                   // rien ne part sans catégorie sûre
    return { voie: 'extension', msg: { cmd: 'publierFiche', site: 'leboncoin', fiche: { ...base, etat: etatVersLbc(v(fiche, 'etat')) || '', categorie: c.categorie, criteres: c.criteres } } };
  }
  if (plan.site === 'vestiaire') {
    const x = plan.valeurs;
    if (!x.univers || !x.categorie || !x.sous || !x.marque) return null;
    return { voie: 'extension', msg: { cmd: 'publierFiche', site: 'vestiaire', fiche: { ...base, etat: x.etat || '', taille: x.taille || '', marque: x.marque, marqueAVerifier: plan.origine.marque === 'lu-site',
      categorie: { univers: x.univers, categorie: x.categorie, sous: x.sous } } } };
  }
  if (plan.site === 'ebay') {
    if (!plan.valeurs.categorie) return null;
    return { voie: 'ebay-brouillon', categorie: plan.valeurs.categorie,
      p: { id: fiche.cle, num: n, title: base.titre, marque: v(fiche, 'marque') || '', taille: v(fiche, 'pointure') || '', tailleVinted: v(fiche, 'pointure') || '', couleur: arr(v(fiche, 'couleurs'))[0] || '',
        etat: v(fiche, 'etat') || '', desc: description, photos: base.photos, catalogId: CATEGORIES_VRM[v(fiche, 'categorie')].vinted } };
  }
  return null;
}
// Ce que VRM retient d'un envoi accepté (pour la relecture) : la catégorie VOULUE seulement.
export function voulu(plan) {
  if (!plan) return {};
  if (plan.site === 'leboncoin') return { categorie: str(plan.valeurs.sousNom || plan.valeurs.sous), univers: str(plan.valeurs.univers), type: str(plan.valeurs.type) };
  if (plan.site === 'vestiaire') return { univers: plan.valeurs.univers, categorie: plan.valeurs.categorie, sous: plan.valeurs.sous };
  if (plan.site === 'ebay') return { id: plan.valeurs.categorie ? plan.valeurs.categorie.id : '', nom: plan.valeurs.categorie ? plan.valeurs.categorie.nom : '' };
  return {};
}
export function noterEnvoi(memoire, site, numero, plan, at = Date.now()) {
  const m = lireMemoireAgent(memoire); const n = cleNumero(numero);
  if (!SITES_AGENT.includes(site) || !NUM_OK.test(n)) return m;
  m.envois[`${site}:${n}`] = { site, numero: n, voulu: voulu(plan), at };
  return lireMemoireAgent(m);
}

// ── 4. LA RELECTURE ────────────────────────────────────────────────────────
// lectures : { leboncoin: items de `lbc_listings` (null = pas lu), ebay: items de `ebay_listings` (null = pas lu) }.
// Rend { etat: 'ok' | 'ecart' | 'pas-encore' | 'pas-su' | 'non-relisible', voulu, relu }.
const refDans = (t, n) => new RegExp('VRM-' + n + '(?!\\d)', 'i').test(str(t));
export function relireEnvoi(envoi, lectures = {}) {
  const e = obj(envoi); if (!e) return { etat: 'pas-su' };
  const n = e.numero; const w = obj(e.voulu) || {};
  if (e.site === 'leboncoin') {
    const items = lectures.leboncoin; if (items == null) return { etat: 'pas-su', voulu: w };
    // Par IDENTITÉ seulement (« Réf. VRM-{n°} ») ; la plus récemment vue d'abord.
    const quand = (ad) => { const t = Date.parse(str(ad.publieeLe || ad.seenAt)); return Number.isFinite(t) ? t : 0; };
    const l = Object.values(items).filter((ad) => ad && (refDans(ad.ref, n) || refDans(ad.body, n))).sort((a, b) => quand(b) - quand(a));
    if (!l.length) return { etat: 'pas-encore', voulu: w };
    const relu = str(l[0].category);
    if (!relu) return { etat: 'pas-encore', voulu: w };
    return { etat: norm(relu) === norm(w.categorie) ? 'ok' : 'ecart', voulu: w, relu: { categorie: relu }, id: String(l[0].id || '') };
  }
  if (e.site === 'ebay') {
    const items = lectures.ebay; if (items == null) return { etat: 'pas-su', voulu: w };
    const l = arr(items).filter((x) => x && (str(x.sku).toUpperCase() === 'VRM-' + n));
    if (!l.length) return { etat: 'pas-encore', voulu: w };
    const d = obj(l[0].detail) || {};
    if (!str(d.categoryId)) return { etat: 'pas-encore', voulu: w };
    return { etat: str(d.categoryId) === str(w.id) ? 'ok' : 'ecart', voulu: w, relu: { id: str(d.categoryId), nom: str(d.categoryName) }, id: String(l[0].itemId || '') };
  }
  // Vestiaire ne rend pas la catégorie dans ses annonces lues : posée telle quelle au dépôt, pas relue.
  return { etat: 'non-relisible', voulu: w };
}

// ── 5. LA COUVERTURE ───────────────────────────────────────────────────────
// Pour chaque catégorie VRM présente dans le stock (fiches), par site : 'sure' · 'demander' · 'impossible'.
export function couverture(fiches, memoire, ctx = {}) {
  const mem = lireMemoireAgent(memoire); const corr = lireCorr(ctx.corr);
  const parCat = new Map(); let sans = 0;
  for (const f of arr(fiches)) { const c = v(f, 'categorie'); if (!c) { sans++; continue; } parCat.set(c, (parCat.get(c) || 0) + 1); }
  const lignes = [...parCat.entries()].sort((a, b) => b[1] - a[1]).map(([cle, n]) => {
    const C = CATEGORIES_VRM[cle];
    const lbc = ficheSite('leboncoin', { catalogId: C.vinted, taille: '', etat: 'Très bon état' }, (() => { const x = lireCorr(ctx.corr); const mc = mem.cat[cle] && mem.cat[cle].leboncoin; if (mc) x.cat[C.vinted] = { ...(x.cat[C.vinted] || {}), leboncoin: mc }; return x; })());
    const lbcEtat = lbc.demandes.some((d) => ['sous', 'univers', 'type'].includes(d.champ)) ? 'demander' : 'sure';
    const t = vcDepuisVrm(cle); const mv = (mem.cat[cle] && mem.cat[cle].vestiaire) || {};
    const vcEtat = t.hors ? 'impossible' : t.demandes.every((ch) => mv[ch]) ? 'sure' : 'demander';
    const ebEtat = (mem.cat[cle] && mem.cat[cle].ebay) || (corr.cat[C.vinted] && corr.cat[C.vinted].ebay) ? 'sure' : 'demander';
    return { cle, n, chemin: cheminVinted(cle), sites: { leboncoin: lbcEtat, vestiaire: vcEtat, ebay: ebEtat } };
  });
  return { lignes, sansCategorie: sans };
}
