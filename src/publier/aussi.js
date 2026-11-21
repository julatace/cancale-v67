// ════════════════════════════════════════════════════════════════════════════
//  « PUBLIER AUSSI SUR… » — UNE ANNONCE VINTED VERS LEBONCOIN ET VESTIAIRE EN UN GESTE (21 nov. 2026, ext. 5.424)
// ════════════════════════════════════════════════════════════════════════════
// Julien (choix n° 45) : « il faut que ce soit parfait et irréprochable ». Sur la page d'une de SES annonces sur
// vinted.fr, ou dans le panneau (Articles), il choisit Leboncoin, Vestiaire ou les deux ; VRM montre, champ par
// champ, ce que l'annonce Vinted devient sur chaque site (✓ ou « à choisir ») ; RIEN ne part tant qu'un champ est à
// choisir ; puis l'extension remplit le formulaire du site PAR SON INTERFACE (vrm-depot-aussi.js), relit le
// formulaire contre ce qui est attendu (`relireFormulaire`) AVANT « Publier », et garde l'annonce créée par son
// identifiant, reliée au même N°.
//
// Ce module PUR (aucune lecture, aucune écriture) ne réinvente aucune correspondance : il passe par l'AGENT DE
// PUBLICATION (src/publier/agent.js : `ficheArticle`, `planSite`, `envoiPour`) et ses tables vérifiées
// (src/publier/tables.js, src/correspondances.js). Il ajoute ce que « Publier aussi » exige en plus :
//   · la SOURCE est l'annonce Vinted LUE, par son identifiant (`id`, jamais le titre) + la fiche VRM (N°, prix mini) ;
//   · la TAILLE : une pointure EU telle quelle (« 42 », « 42,5 », « EU 42 ») ; toute autre grille (US, UK, 42 ⅔…)
//     n'a AUCUNE conversion exacte sans le guide de la marque ⇒ « à choisir », jamais convertie ;
//   · la MARQUE et la COULEUR lues sur Vinted mais absentes de la liste du site ⇒ « à choisir » (bloquant) ;
//   · le PRIX : le même, ou « +N % » (son réglage par site), à l'euro supérieur (les deux sites ne prennent pas les
//     centimes), JAMAIS sous son plancher (prix mini, sinon achat + 10 %) ;
//   · la référence « Réf. VRM-{N°} » dans la description (l'identité qui relie la vente plus tard) ;
//   · « déjà publiée sur ce site » (relu par identité) ⇒ rien ne repart ;
//   · la RELECTURE du formulaire (`relireFormulaire`) : chaque champ attendu doit avoir été RELU sur la page, égal.
// Recopié dans l'extension par scripts/recopier-gardes-extension.cjs (jamais à la main) ; exécuté par
// scripts/audit-publier-aussi.cjs et le banc scripts/bancs/publier-aussi.cjs.
import { ficheArticle, planSite, envoiPour, retenirReponses, titrePour, refVrm, PHOTOS_MAX } from './agent.js';
import { pointureEU, cheminVinted, CATEGORIES_VRM, norm } from './tables.js';
import { LBC_VALEURS } from '../correspondances.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const NUM_OK = /^[A-Z]{0,3}\d{1,6}$/;
const cleNumero = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

export const SITES_AUSSI = Object.freeze(['leboncoin', 'vestiaire']);
// « +N % sur ce site » : les seuls choix (0 = le même prix).
export const PCT_AUSSI = Object.freeze([0, 5, 10, 15, 20]);
export const NOM_SITE_AUSSI = Object.freeze({ leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', vinted: 'Vinted' });

// ── LA TAILLE : SEULEMENT CE QUI SE CONVERTIT EXACTEMENT ───────────────────
// La grille de chaussures des quatre sites est l'EU (src/correspondances.js) : une pointure EU passe telle quelle.
// « EU 42 », « 42 EU », « 42.5 » ⇒ la même pointure. Toute autre écriture (US 9, UK 8, 42 ⅔, 42 2/3, M, 9.5…) ⇒ null :
// la conversion US/UK → EU dépend de la marque (une US 9 Nike n'est pas une US 9 adidas) — jamais devinée.
export function pointureExacte(t) {
  const s = str(t).replace(/\s+/g, ' ');
  const m = /^(?:EU ?)?(\d{2}(?:[.,]5)?)(?: ?EU)?$/i.exec(s);
  if (!m) return null;
  const p = pointureEU(m[1]);
  if (!p) return null;
  const n = Number(p.replace(',', '.'));
  return n >= 16 && n <= 50 ? p : null;
}
// Les pointures qu'il peut choisir (celles que Leboncoin sert, de 33 à 50 — la liste du site, rien d'inventé).
export const POINTURES_CHOIX = Object.freeze(LBC_VALEURS.shoe_size.filter((x) => /^\d{2}(,5)?$/.test(x) && Number(x.replace(',', '.')) >= 33));

// ── LE PRIX ────────────────────────────────────────────────────────────────
// prix : euros (le prix Vinted lu) ; pct : son réglage (0, 5, 10, 15, 20) ; plancher : euros ou null.
// Rend { ok, prix (euros entiers), arrondi, plancher } · { ok: false, code } — jamais sous le plancher.
export function plancherAussi(prixMini, achat) {
  const m = Number(prixMini), a = Number(achat);
  if (Number.isFinite(m) && m > 0) return { valeur: Math.round(m * 100) / 100, de: 'mini' };
  if (Number.isFinite(a) && a > 0) return { valeur: Math.round(a * 110) / 100, de: 'achat' };
  return null;
}
export function prixAussi(prix, pct, plancher) {
  const p = Number(prix);
  if (!(Number.isFinite(p) && p > 0 && p < 100000)) return { ok: false, code: 'prix-pas-lu' };
  const k = Number(pct || 0);
  if (!PCT_AUSSI.includes(k)) return { ok: false, code: 'pct' };
  const brut = Math.round(p * (100 + k)) / 100;
  // L'euro supérieur (jamais l'inférieur : le prix ne descend jamais sous celui qu'il a choisi).
  const ent = Math.ceil(brut - 1e-9);
  const pl = plancher && Number.isFinite(Number(plancher.valeur)) ? plancher : null;
  if (pl && ent < pl.valeur - 1e-9) return { ok: false, code: 'sous-plancher', prix: ent, plancher: pl };
  return { ok: true, prix: ent, arrondi: Math.abs(ent - brut) > 1e-9, pct: k, plancher: pl };
}

// ── LA SOURCE : L'ANNONCE VINTED LUE + LA FICHE VRM ────────────────────────
// entree : { id (identifiant d'annonce Vinted), titre, description, marque, taille, etat, couleur, catalogId, prix,
//   photos: [url pleine résolution, dans l'ordre], numero, prixMini, achat }.
export function sourceAussi(entree) {
  const e = obj(entree) || {};
  const id = str(e.id);
  if (!/^\d{4,15}$/.test(id)) return { ok: false, code: 'annonce' };
  const numero = cleNumero(e.numero);
  if (!NUM_OK.test(numero)) return { ok: false, code: 'sans-numero' };
  const photos = [...new Set(arr(e.photos).map(str).filter((u) => /^https:\/\//.test(u)))];
  const prix = Number(e.prix);
  return { ok: true, source: { id, numero, titre: str(e.titre).replace(/\s+/g, ' '), description: String(e.description == null ? '' : e.description).replace(/\r\n?/g, '\n').trim(),
    marque: str(e.marque), taille: str(e.taille), pointure: pointureExacte(e.taille), etat: str(e.etat), couleur: str(e.couleur), catalogId: /^\d{1,7}$/.test(str(e.catalogId)) ? str(e.catalogId) : '',
    prix: Number.isFinite(prix) && prix > 0 ? Math.round(prix * 100) / 100 : null, photos, prixMini: Number(e.prixMini) > 0 ? Number(e.prixMini) : null, achat: Number(e.achat) > 0 ? Number(e.achat) : null } };
}
// L'article et la lecture que l'agent attend (une annonce Vinted, par SON identifiant).
function articleDe(s) {
  return {
    article: { cle: 'vinted:' + s.id, numero: s.numero, prix: s.prix, prixMini: s.prixMini,
      annonces: [{ site: 'vinted', id: s.id, etat: 'enligne', titre: s.titre, photo: '', marque: s.marque, taille: s.pointure || s.taille, condition: s.etat }] },
    lectures: { vinted: { [s.id]: { codes: s.catalogId ? { catalog_id: s.catalogId } : {}, description: s.description, photos: s.photos.slice(), couleur: s.couleur } } },
  };
}
// SES réponses de la feuille : { 'site|champ': valeur } ou { champ: valeur } ⇒ la forme de l'agent.
export function reponsesAgent(rep) {
  const o = obj(rep) || {};
  return Object.entries(o).filter(([, v]) => v != null && str(v)).slice(0, 30).map(([k, v]) => { const [a, b] = String(k).split('|'); return b ? { site: a, champ: b, valeur: str(v).slice(0, 200) } : { site: '', champ: a, valeur: str(v).slice(0, 200) }; });
}

// ── LA FEUILLE AVANT / APRÈS ───────────────────────────────────────────────
// ctx : { memoire (vrm_agent_publier), corr (vrm_correspondances), formulairesLbc, reponses ({ 'site|champ': v }),
//   pct: { leboncoin, vestiaire }, sites: ['leboncoin', 'vestiaire'], deja: { [site]: { id, lien } | false | null },
//   marqueVc: { etat: 'listee'|'absente'|'bannie'|'pas-su', valeur } (la liste des marques de Vestiaire, lue par le fond) }.
// Rend { ok, code?, source, memoire, sites: { [site]: { site, etat: 'pret'|'a-choisir'|'refus'|'deja', lignes, photos,
//   prix, envoi, attendu, refus } }, pret } — `pret` : TOUS les sites choisis sont prêts (rien ne part sinon).
const Q_CHAMP = { pointure: 'taille', sous: 'categorie', univers: 'univers', type: 'type', categorie: 'categorie', etat: 'etat', marque: 'marque', couleur: 'couleur', taille: 'taille' };
export function feuilleAussi(entree, ctx = {}) {
  const s0 = sourceAussi(entree);
  if (!s0.ok) return { ok: false, code: s0.code, sites: {}, pret: false };
  const s = s0.source;
  const sites = arr(ctx.sites).filter((x) => SITES_AUSSI.includes(x));
  if (!sites.length) return { ok: false, code: 'site', source: s, sites: {}, pret: false };
  const { article, lectures } = articleDe(s);
  let memoire = ctx.memoire || null;
  const f0 = ficheArticle(article, lectures, memoire);
  const repL = reponsesAgent(ctx.reponses);
  if (repL.length) memoire = retenirReponses(memoire, f0, repL);
  const fiche = ficheArticle(article, lectures, memoire);
  const out = { ok: true, source: s, memoire, sites: {}, pret: true };
  // Le plancher : celui que le fond a lu par SA règle (`plancherBaisse` : prix mini, sinon achat + 10 %), sinon le même calcul ici.
  const pl = obj(ctx.plancher) && Number(ctx.plancher.valeur) > 0 ? { valeur: Number(ctx.plancher.valeur), de: str(ctx.plancher.de) } : plancherAussi(s.prixMini, s.achat);
  for (const site of sites) {
    const r = feuilleSite(site, s, fiche, memoire, ctx, pl);
    out.sites[site] = r;
    if (r.etat !== 'pret') out.pret = false;
  }
  return out;
}
function feuilleSite(site, s, fiche, memoire, ctx, pl) {
  const res = { site, etat: 'pret', lignes: [], photos: s.photos.slice(0, PHOTOS_MAX), photosEnTrop: Math.max(0, s.photos.length - PHOTOS_MAX), prix: null, envoi: null, attendu: null, refus: null };
  const deja = obj(ctx.deja) ? ctx.deja[site] : null;
  if (deja && deja !== true && obj(deja) && (str(deja.id) || deja.vu)) { res.etat = 'deja'; res.refus = { code: 'deja', id: str(deja.id), lien: str(deja.lien) }; return res; }
  if (deja === true) { res.etat = 'deja'; res.refus = { code: 'deja' }; return res; }
  const plan = planSite(fiche, site, memoire, { corr: ctx.corr || null, ext: { leboncoin: true, vestiaire: true }, formulairesLbc: ctx.formulairesLbc || null });
  if (plan.etat === 'refus' && !(plan.refus && plan.refus.code === 'marque-hors-liste')) { res.etat = 'refus'; res.refus = plan.refus; return res; }
  const v = plan.valeurs;
  // Les questions : bloquantes ; la marque et la couleur LUES sur Vinted mais absentes de la liste du site deviennent bloquantes.
  const questions = arr(plan.questions).map((q) => ({ ...q, bloque: q.bloque || ((q.champ === 'marque' && !!s.marque) || (q.champ === 'couleur' && !!s.couleur)) }));
  // Vestiaire : la marque doit être dans SA liste (lue par le fond) ; pas lue ⇒ à choisir ; absente / refusée ⇒ refus.
  if (site === 'vestiaire' && s.marque && !questions.some((q) => q.champ === 'marque')) {
    const mv = obj(ctx.marqueVc);
    if (!mv || mv.etat === 'pas-su') questions.push({ champ: 'marque', site, choix: [], bloque: true, raison: 'marques-vc-pas-lues' });
    else if (mv.etat === 'listee' && str(mv.valeur)) v.marque = str(mv.valeur);
    else { res.etat = 'refus'; res.refus = { code: 'marque-hors-liste', marque: s.marque, bannie: mv.etat === 'bannie' }; return res; }
  }
  if (site === 'vestiaire' && !s.marque) questions.push({ champ: 'marque', site, choix: [], bloque: true, raison: 'marque-pas-lue' });
  // La pointure : SEULEMENT une pointure EU exacte ; sinon « à choisir » parmi celles du site.
  const C = fiche.champs.categorie ? CATEGORIES_VRM[fiche.champs.categorie.v] : null;
  const chaussure = !C || C.famille === 'chaussures';
  if (chaussure && !s.pointure && !questions.some((q) => q.champ === 'pointure' || q.champ === 'taille')) questions.push({ champ: 'pointure', site: '', choix: POINTURES_CHOIX.slice(), bloque: true });
  for (const q of questions) if (q.champ === 'pointure' && !(q.choix && q.choix.length)) q.choix = POINTURES_CHOIX.slice();
  const bloquantes = questions.filter((q) => q.bloque);
  const aChoisir = (champ) => bloquantes.find((q) => Q_CHAMP[q.champ] === champ) || null;
  const ligne = (champ, vinted, valeur, extra = {}) => {
    const q = aChoisir(champ);
    const ok = !q && valeur != null && str(valeur) !== '';
    res.lignes.push({ champ, vinted: vinted == null ? '' : String(vinted), site: ok ? String(valeur) : '', etat: ok ? 'ok' : 'a-choisir',
      ...(q ? { question: { champ: q.champ, site: q.site || '', choix: arr(q.choix).slice(0, 120), raison: q.raison || '' } } : {}), ...extra });
  };
  // Le prix d'abord calculé (il entre dans l'envoi).
  const pct = obj(ctx.pct) ? Number(ctx.pct[site] || 0) : 0;
  const px = prixAussi(s.prix, pct, pl);
  const titre = titrePour(site, s.titre);
  ligne('titre', s.titre, titre, titre !== s.titre ? { coupe: true } : {});
  const env = envoiPour(fiche, { ...plan, etat: 'pret' }, {});
  const description = env && env.msg && env.msg.fiche ? env.msg.fiche.description : '';
  ligne('description', s.description, description, { ref: refVrm(s.numero) });
  const chemin = cheminVinted(fiche.champs.categorie && fiche.champs.categorie.v) || '';
  if (site === 'leboncoin') {
    ligne('categorie', chemin, v.rubrique && v.sousNom ? `${v.rubrique} › ${v.sousNom}` : '');
    if (aChoisir('univers') || v.univers) ligne('univers', '', v.univers || '');
    if (aChoisir('type') || v.type) ligne('type', '', v.type || '');
    if (s.marque || aChoisir('marque')) ligne('marque', s.marque, v.marque || '');
    ligne('taille', s.taille, v.taille || '');
    ligne('etat', s.etat, v.etat || '');
    if (s.couleur || aChoisir('couleur')) ligne('couleur', s.couleur, v.couleur || '');
  } else {
    ligne('categorie', chemin, v.univers && v.categorie && v.sous ? `${v.univers} › ${v.categorie} › ${v.sous}` : '');
    ligne('marque', s.marque, v.marque || '');
    ligne('taille', s.taille, v.taille || '');
    ligne('etat', s.etat, v.etat || '');
  }
  res.prix = { vinted: s.prix, pct: px.ok ? px.pct : pct, site: px.ok ? px.prix : null, arrondi: !!px.arrondi, plancher: pl, code: px.ok ? '' : px.code };
  res.lignes.push({ champ: 'prix', vinted: s.prix == null ? '' : String(s.prix), site: px.ok ? String(px.prix) : '', etat: px.ok ? 'ok' : 'a-choisir', ...(px.ok ? {} : { raison: px.code, ...(px.plancher ? { plancher: px.plancher.valeur } : {}) }) });
  res.lignes.push({ champ: 'photos', vinted: String(s.photos.length), site: String(res.photos.length), etat: res.photos.length ? 'ok' : 'a-choisir', ...(res.photosEnTrop ? { enTrop: res.photosEnTrop } : {}) });
  res.questions = bloquantes.map((q) => ({ champ: q.champ, site: q.site || '', choix: arr(q.choix).slice(0, 120), raison: q.raison || '' }));
  if (res.lignes.some((l) => l.etat !== 'ok') || bloquantes.length || plan.etat !== 'pret' && !(plan.etat === 'refus' && site === 'vestiaire')) { res.etat = 'a-choisir'; return res; }
  if (!env || env.voie !== 'extension') { res.etat = 'a-choisir'; return res; }
  const f = { ...env.msg.fiche, prix: px.prix, titre, photos: res.photos.slice(), ...(site === 'vestiaire' ? { marque: v.marque } : {}) };
  res.envoi = { site, fiche: f };
  res.attendu = attenduDe(site, f, v);
  res.chemin = site === 'leboncoin' ? [v.rubrique, v.sousNom].filter(Boolean) : [v.univers, v.categorie, v.sous].filter(Boolean);
  return res;
}
// Ce que le formulaire du site doit MONTRER avant « Publier » (relu champ par champ).
export function attenduDe(site, fiche, valeurs) {
  const f = obj(fiche) || {}; const v = obj(valeurs) || {};
  const a = { titre: str(f.titre), description: String(f.description || ''), prix: Number(f.prix), photos: arr(f.photos).length, etat: str(site === 'leboncoin' ? (f.etat || v.etat) : (v.etat || f.etat)) };
  if (site === 'leboncoin') { a.categorie = str(v.sousNom); for (const k of ['univers', 'type', 'marque', 'taille', 'couleur']) if (str(v[k])) a[k] = str(v[k]); }
  else { a.categorie = str(v.sous); a.univers = str(v.univers); a.marque = str(v.marque || f.marque); if (str(v.taille)) a.taille = str(v.taille); }
  return a;
}

// ── LA RELECTURE DU FORMULAIRE, AVANT « PUBLIER » ──────────────────────────
// attendu : `attenduDe` ; lu : { champ: valeur relue sur la page } (null/absent = pas vu sur la page).
// Rend { ok, ecarts: [{ champ, attendu, lu, code: 'different'|'pas-relu' }] } — UN écart ⇒ rien n'est publié.
const texteNorm = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
export function relireFormulaire(attendu, lu) {
  const a = obj(attendu); const l = obj(lu) || {};
  if (!a) return { ok: false, ecarts: [{ champ: '*', code: 'pas-relu' }] };
  const ecarts = [];
  for (const [k, va] of Object.entries(a)) {
    const vl = l[k];
    if (vl == null || vl === '') { ecarts.push({ champ: k, attendu: va, lu: null, code: 'pas-relu' }); continue; }
    let egal;
    if (k === 'prix') { const n = Number(String(vl).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')); egal = Number.isFinite(n) && Math.round(n * 100) === Math.round(Number(va) * 100); }
    else if (k === 'photos') egal = Number(vl) === Number(va);
    else if (k === 'description') egal = texteNorm(vl) === texteNorm(va);
    else egal = norm(vl) === norm(va);
    if (!egal) ecarts.push({ champ: k, attendu: va, lu: vl, code: 'different' });
  }
  return { ok: ecarts.length === 0, ecarts };
}

// ── DÉJÀ PUBLIÉE SUR CE SITE ? (par IDENTITÉ seulement) ────────────────────
// lectures : { lbcPubliees: { [adId]: { numero } } | null, lbcItems: { [adId]: { ref, body } } | null,
//   vcLiens: { [productId]: N° } | null, vcPubliees: [{ numero, productId }] | null, faits: { 'site:N°': { id, at } } }.
// Rend { [site]: { id, lien } (déjà) · false (non, tout lu) · null (pas su ⇒ rien ne part) }.
const refDans = (t, n) => new RegExp('VRM-' + n + '(?!\\d)', 'i').test(str(t));
export function dejaAussi(numero, lectures = {}) {
  const n = cleNumero(numero);
  const L = obj(lectures) || {};
  const out = {};
  const fait = (site) => { const x = obj(L.faits) && L.faits[site + ':' + n]; return x ? { id: str(x.id), lien: str(x.lien), vu: true } : null; };
  // Leboncoin : l'annonce créée par VRM (son identifiant rendu au dépôt) ou une annonce lue qui porte « VRM-{N°} ».
  { const f = fait('leboncoin');
    if (f) out.leboncoin = f;
    else if (L.lbcPubliees == null || L.lbcItems == null) out.leboncoin = null;
    else {
      const p = Object.entries(L.lbcPubliees).find(([, e]) => e && cleNumero(e.numero) === n);
      const it = !p ? Object.entries(L.lbcItems).find(([, ad]) => ad && (refDans(ad.ref, n) || refDans(ad.customRef, n) || refDans(ad.body, n))) : null;
      const id = p ? p[0] : it ? it[0] : '';
      out.leboncoin = id ? { id, lien: lienAnnonce('leboncoin', id) } : false;
    } }
  { const f = fait('vestiaire');
    if (f) out.vestiaire = f;
    else if (L.vcLiens == null || L.vcPubliees == null) out.vestiaire = null;
    else {
      const l = Object.entries(L.vcLiens).find(([, num]) => cleNumero(num) === n);
      const p = !l ? arr(L.vcPubliees).find((x) => x && cleNumero(x.numero) === n) : null;
      out.vestiaire = l ? { id: l[0], lien: lienAnnonce('vestiaire', l[0]) } : p ? { id: str(p.productId), lien: str(p.productId) ? lienAnnonce('vestiaire', p.productId) : '' } : false;
    } }
  return out;
}
// Le lien vers l'annonce créée (son identifiant) : la forme que ces sites servent pour une annonce.
export function lienAnnonce(site, id) {
  const i = str(id);
  if (site === 'leboncoin' && /^\d{6,15}$/.test(i)) return 'https://www.leboncoin.fr/ad/x/' + i;
  if (site === 'vestiaire' && /^[\w-]{1,40}$/.test(i)) return 'https://fr.vestiairecollective.com/' + i + '.shtml';
  return '';
}

// ── LA FRISE ───────────────────────────────────────────────────────────────
// Les étapes dites à l'écran pendant la publication, dans l'ordre (le fond les date sur leur PREUVE).
export const ETAPES_AUSSI = Object.freeze(['verifie', 'onglet', 'compte', 'photos', 'champs', 'relu', 'publie', 'retenue']);
export function friseAussi(etapes) {
  const e = obj(etapes) || {};
  const i = ETAPES_AUSSI.findIndex((k) => !e[k]);
  return ETAPES_AUSSI.map((k, j) => ({ k, etat: e[k] ? 'fait' : j === i ? 'en-cours' : 'a-venir', at: e[k] || null }));
}
