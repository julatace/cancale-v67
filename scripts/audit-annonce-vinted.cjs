// ════════════════════════════════════════════════════════════════════════════
//  « CRÉER SUR VINTED » DEPUIS UNE FICHE VRM (11 nov., extension 5.367 — lot annonce-vinted)
//
//  Demande validée par Julien : sur SON clic, l'extension prépare un BROUILLON sur
//  vinted.fr depuis une fiche VRM (photos, titre, taille, état, marque, couleur,
//  catégorie, prix, N°) ; tout champ du catalogue que VRM ne sait pas faire
//  correspondre est DEMANDÉ avec les vraies valeurs de Vinted ; le N° est relié à
//  l'identifiant que Vinted rend ; c'est LUI qui clique « Publier ».
//
//  E. L'EXTENSION, EXÉCUTÉE (`scripts/_fond-vm.cjs` : le vrai background.js dans un
//     vm, faux vinted.fr qui note chaque requête, fausse base à état) :
//     E1 tout prêt : lectures (grille, couleurs), photos ×2, UN brouillon — jamais de
//        mise en ligne, jamais de suppression, jamais de création directe ; tout part
//        de la page, sans « Authorization » ; le corps porte les valeurs EXACTES de
//        Vinted ; le brouillon est rangé (`parVRM`, fiche, N°) ; le N° est LIÉ à
//        l'identifiant rendu (`panel_num_reserves.items`) ; UNE action comptée.
//     E2–E5 une catégorie / une taille / un état inconnus ⇒ la QUESTION avec les
//        valeurs de Vinted, AUCUN geste ; une réponse hors liste ⇒ redemandée ;
//        « je le choisirai sur Vinted » ⇒ champ vide et DIT.
//     G1–G8 gardes : sans confirmation, autre compte, sans onglet, N° déjà porté,
//        brouillon déjà fait (ce Chrome ou la base), base muette, plafond 45/h ⇒
//        aucune requête chez Vinted.
//     R1–R4 refus : brouillon refusé ⇒ frein (la suivante n'envoie rien) ; réponse
//        floue ⇒ « peut-être », la même fiche bloquée ; photo refusée ⇒ aucun
//        brouillon, l'action rendue.
//  T. LA RÈGLE DE L'APP (src/annonceVinted.js), exécutée : texte (N° selon les
//     réglages), payload, manques, issue pour le suivi.
//  `--prouve` : sur origin/main, `creerVintedFiche` n'existe pas (tout E rouge) ;
//  et des MUTATIONS de la règle de l'app rendent T rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det !== undefined ? '  → ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : '')); } };
const nowISO = () => new Date().toISOString();
const jpeg = (s) => 'data:image/jpeg;base64,' + Buffer.from('JPEG' + s).toString('base64');
const CATALOGUE = { catalogs: [
  { id: 5, title: 'Hommes', catalogs: [{ id: 6, title: 'Chaussures', catalogs: [{ id: 1242, title: 'Baskets' }, { id: 1243, title: 'Bottes' }] }] },
  { id: 7, title: 'Femmes', catalogs: [{ id: 8, title: 'Chaussures', catalogs: [{ id: 1234, title: 'Baskets' }] }] },
] };
const GRILLE = { status: 200, body: { attributes: [
  { code: 'size', configuration: { options: [{ id: 56, title: '42' }, { id: 57, title: '43' }, { id: 58, title: '42,5' }] } },
  { code: 'condition', configuration: { options: [{ id: 2, title: 'Très bon état' }, { id: 3, title: 'Bon état' }] } },
] } };
const COULEURS = { status: 200, body: { colors: [{ id: 1, title: 'Noir' }, { id: 12, title: 'Blanc' }, { id: 3, title: 'Gris' }] } };
const RECETTE = JSON.stringify({ item: { id: 9101, catalog_id: 1242, brand_id: 53, brand: 'Nike', color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }], package_size_id: 1 } });
const FICHE = (o = {}) => ({ id: 'nab12', numero: '41', titre: 'Nike Air Max 90 blanches N°41', description: 'Très bon état, portées deux fois.\n\nN°41', prix: 65, marque: 'Nike', taille: '42', etat: 'Très bon état', couleur: 'Blanc', photos: [jpeg('1'), jpeg('2')], ...o });

function monter({ src, connecte = '111', brouillon = 200, photo = 200, extra = null, lectureKO = null, onglets } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '12' } } }, vinted_catalogue: { corps: JSON.stringify(CATALOGUE) },
    vrm_vinted_modele: { '9101': { corps: RECETTE, uid: '111', at: nowISO() } }, panel_num_reserves: { attente: {}, items: {} } };
  if (extra) Object.assign(lignes, extra);
  let n = 500;
  const o = { src, lignes, connecte, lectureKO: lectureKO || (() => false), vinted: (e) => {
    if (e.methode === 'GET' && /\/api\/v2\/item_upload\/colors$/.test(e.chemin)) return COULEURS;
    if (e.methode === 'POST' && /\/api\/v2\/item_upload\/attributes$/.test(e.chemin)) return GRILLE;
    if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: photo, body: { id: ++n } };
    if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: brouillon, body: brouillon === 200 ? { draft: { id: 88001 } } : { errors: [{ field: 'package_size_id', value: 'Choisis la taille du colis' }], message: 'refusé' } };
    return { status: 404, body: {} };
  } };
  if (onglets) o.onglets = onglets;
  return faireFond(o);
}
const LECTURE = /\/item_upload\/(colors|attributes)$/;
const gestes = (j) => j.vinted.filter((v) => !LECTURE.test(v.chemin));
const seq = (j) => gestes(j).map((v) => /photos$/.test(v.chemin) ? 'P' : /drafts\/?$/.test(v.chemin) ? 'B' : /completion$/.test(v.chemin) ? 'M' : /delete$/.test(v.chemin) ? 'S' : /item_upload\/items/.test(v.chemin) ? 'C' : '?').join('');
async function creer(f, msg = {}) {
  if (typeof f.ctx.creerVintedFiche !== 'function') return { absent: true };
  try { return await f.ctx.creerVintedFiche({ cmd: 'creerVintedFiche', uid: '111', confirme: true, fiche: FICHE(), ...msg }); } catch (e) { return { erreur: String(e && e.message) }; }
}
const actions = (f) => (((f.store.vrmActions || {})['111']) || []).filter((t) => Date.now() - Number(t) < 3600000).length;

async function partieE(src) {
  const rep1 = { catalog_id: '1242' };
  // E1 — tout prêt (la catégorie répondue, le reste au libellé exact).
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1 });
    dit(r.accepte === true && r.etape === 'fait' && r.draftId === '88001' && seq(f.j) === 'PPB', 'E1 tout prêt : photos ×2 puis UN brouillon — rien d’autre (ni mise en ligne, ni suppression, ni création directe)', { r, seq: seq(f.j) });
    const pg = f.j.vinted;
    dit(pg.length > 0 && pg.every((v) => v.origine === 'page' && v.credentials === 'include' && !Object.keys(v.entetes || {}).some((k) => /^authorization$/i.test(k))), 'E1b tout part de l’onglet vinted.fr (cookies de la page, aucun « Authorization »)', pg.map((v) => [v.origine, v.credentials]));
    let c = {}; try { c = JSON.parse((gestes(f.j).find((v) => /drafts/.test(v.chemin)) || {}).corps || '{}'); } catch (_) {}
    const d = c.draft || {};
    const attrs = JSON.stringify((d.item_attributes || []).slice().sort((a, b) => a.code.localeCompare(b.code)));
    dit(d.id === null && d.catalog_id === 1242 && attrs === JSON.stringify([{ code: 'condition', ids: [2] }, { code: 'size', ids: [56] }]) && JSON.stringify(d.color_ids) === '[12]' && d.brand_id === 53 && d.brand === 'Nike', 'E1c le corps porte les valeurs EXACTES de Vinted (catégorie répondue, taille « 42 », état, couleur « Blanc », marque de ses annonces)', d);
    dit(d.title === 'Nike Air Max 90 blanches N°41' && /N°41$/.test(d.description) && d.price === '65' && d.package_size_id === null && c.upload_session_id === d.temp_uuid && JSON.stringify((d.assigned_photos || []).map((p) => p.id)) === '[501,502]', 'E1d titre, description (N° en bas), prix, photos rendues par Vinted ; la taille du colis reste vide (jamais devinée)', d);
    dit(Array.isArray(r.aFinir) && r.aFinir.includes('la taille du colis') && !r.aFinir.includes('la couleur'), 'E1e ce qui reste à choisir sur Vinted est DIT (taille du colis)', r.aFinir);
    const b = f.lignes.vinted_brouillon_88001 || {};
    dit(b.parVRM === true && b.ficheId === 'nab12' && b.numero === '41' && b.etat === 'brouillon' && String(b.uid) === '111', 'E1f le brouillon est rangé pour « Publier » depuis VRM (parVRM, fiche, N°)', b);
    const it = ((f.lignes.panel_num_reserves || {}).items || {})['88001'];
    dit(it && it.numero === '41' && it.fiche === 'nab12' && r.lie === true, 'E1g le N° est LIÉ à l’identifiant que Vinted a rendu (panel_num_reserves.items)', it);
    dit(actions(f) === 1, 'E1h UNE action comptée dans les 50/h du compte', actions(f));
    const r2 = await creer(f, { reponses: rep1 });
    dit(r2.accepte === false && r2.code === 'deja' && seq(f.j) === 'PPB', 'E1i un second clic sur la même fiche n’envoie rien (« déjà son brouillon »)', r2); }
  // E2 — la catégorie inconnue : la question, avec le catalogue de Vinted, aucun geste.
  { const f = monter({ src }); const r = await creer(f);
    const q = r.question || {};
    const ids = (q.options || []).map((o) => o[0]).sort().join(',');
    dit(r.accepte === false && r.code === 'question' && q.champ === 'catalog_id' && ids === '1234,1242,1243' && (q.options || []).some((o) => o[1] === 'Hommes > Chaussures > Baskets') && gestes(f.j).length === 0, 'E2 catégorie inconnue ⇒ la question avec les catégories FINALES du catalogue Vinted (chemin entier), aucun geste', { code: r.code, q, n: gestes(f.j).length }); }
  // E2b — « Baskets » seul : deux catégories de Vinted ⇒ jamais choisi.
  { const f = monter({ src }); const r = await creer(f, { fiche: FICHE({ categorie: 'Baskets' }) });
    dit(r.code === 'question' && r.question && r.question.champ === 'catalog_id', 'E2b « Baskets » (Hommes ET Femmes chez Vinted) ⇒ demandé, jamais choisi', r.code);
    const f2 = monter({ src }); const r2 = await creer(f2, { fiche: FICHE({ categorie: 'Hommes > Chaussures > Baskets' }) });
    dit(r2.etape === 'fait' && JSON.parse(gestes(f2.j).find((v) => /drafts/.test(v.chemin)).corps).draft.catalog_id === 1242, 'E2c le chemin exact du catalogue ⇒ posé sans question', r2.code || r2.etape); }
  // E3 — une taille hors grille : la question avec la grille de la catégorie.
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ taille: '44' }) });
    const q = r.question || {};
    dit(r.code === 'question' && q.champ === 'size' && (q.options || []).map((o) => o[1]).join('|') === '42|43|42,5' && gestes(f.j).length === 0, 'E3 taille « 44 » absente de la grille ⇒ la question avec les tailles de Vinted, aucun geste', { code: r.code, q }); }
  // E3b — « 42.5 » = « 42,5 » (même libellé) ; « 42 » ne vaut pas « 42,5 ».
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ taille: '42.5' }) });
    const d = r.etape === 'fait' ? JSON.parse(gestes(f.j).find((v) => /drafts/.test(v.chemin)).corps).draft : {};
    dit(r.etape === 'fait' && (d.item_attributes || []).some((a) => a.code === 'size' && a.ids[0] === 58), 'E3b « 42.5 » ⇒ « 42,5 » de la grille (libellé identique), jamais « 42 »', d.item_attributes); }
  // E4 — l'état et la couleur hors liste : demandés l'un après l'autre.
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ etat: 'Comme neuf', couleur: 'Blanc cassé' }) });
    dit(r.code === 'question' && r.question.champ === 'condition' && r.question.options.map((o) => o[1]).join('|') === 'Très bon état|Bon état' && gestes(f.j).length === 0, 'E4 état « Comme neuf » (pas une valeur de cette grille) ⇒ demandé avec les états de Vinted', r.question);
    const r2 = await creer(f, { reponses: { ...rep1, condition: '3' }, fiche: FICHE({ etat: 'Comme neuf', couleur: 'Blanc cassé' }) });
    dit(r2.code === 'question' && r2.question.champ === 'color' && r2.question.options.some((o) => o[1] === 'Blanc') && gestes(f.j).length === 0, 'E4b puis la couleur « Blanc cassé » ⇒ demandée avec la liste de Vinted', r2.question && r2.question.champ); }
  // E5 — une réponse HORS liste ⇒ redemandée ; « je le choisirai sur Vinted » ⇒ vide et dit.
  { const f = monter({ src }); const r = await creer(f, { reponses: { catalog_id: '999999' } });
    dit(r.code === 'question' && r.question.champ === 'catalog_id' && gestes(f.j).length === 0, 'E5 une réponse qui n’est pas une valeur de Vinted n’est jamais posée (redemandée)', r.code);
    const f2 = monter({ src }); const r2 = await creer(f2, { reponses: { ...rep1, color: 'vinted' }, fiche: FICHE({ couleur: 'Blanc cassé' }) });
    const d = r2.etape === 'fait' ? JSON.parse(gestes(f2.j).find((v) => /drafts/.test(v.chemin)).corps).draft : {};
    dit(r2.etape === 'fait' && JSON.stringify(d.color_ids) === '[]' && r2.aFinir.includes('la couleur'), 'E5b « je la choisirai sur Vinted » ⇒ couleur vide dans le brouillon, et c’est DIT', { aFinir: r2.aFinir, c: d.color_ids }); }
  // E6 — marque inconnue de ses annonces : demandée avec SES marques Vinted.
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ marque: 'Adidas' }) });
    dit(r.code === 'question' && r.question.champ === 'brand' && JSON.stringify(r.question.options) === '[["53","Nike"]]', 'E6 marque « Adidas » inconnue ⇒ demandée avec les marques de Vinted déjà vues sur SES annonces', r.question); }
  // G — les gardes : aucune requête chez Vinted.
  { const f = monter({ src }); const r = await creer(f, { confirme: false, reponses: rep1 });
    dit(r.code === 'confirmation' && f.j.vinted.length === 0, 'G1 sans confirmation : aucune requête', r.code); }
  { const f = monter({ src, connecte: '222' }); const r = await creer(f, { reponses: rep1 });
    dit(r.accepte === false && /autre|absent/.test(r.code || '') && f.j.vinted.length === 0, 'G2 l’onglet est sur un autre compte Vinted : aucune requête', r.code); }
  { const f = monter({ src }); f.ctx.chrome.tabs.query = async () => [];
    const r = await creer(f, { reponses: rep1 });
    dit(r.accepte === false && r.code === 'onglet-vinted' && gestes(f.j).length === 0, 'G3 sans onglet vinted.fr : aucun geste, « ouvre vinted.fr » dit', r); }
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ numero: '12' }) });
    dit(r.code === 'numero-pris' && f.j.vinted.length === 0, 'G4 le N° est déjà porté par une annonce : rien ne part', r.code); }
  { const f = monter({ src, extra: { vinted_brouillon_77777: { uid: '111', ficheId: 'nab12', etat: 'brouillon', corps: '{}' } } }); const r = await creer(f, { reponses: rep1 });
    dit(r.code === 'deja' && r.draftId === '77777' && f.j.vinted.length === 0, 'G5 la base dit que cette fiche a déjà son brouillon (un autre Chrome) : rien ne part', r); }
  { const f = monter({ src, lectureKO: (u) => /vinted_brouillon_/.test(u) }); const r = await creer(f, { reponses: rep1 });
    dit(r.code === 'lecture' && f.j.vinted.length === 0, 'G6 base muette sur les brouillons : pas su ⇒ rien ne part', r.code); }
  { const f = monter({ src }); const t = Date.now(); f.store.vrmActions = { '111': Array.from({ length: 45 }, (_, k) => t - k * 1000) };
    const r = await creer(f, { reponses: rep1 });
    dit(r.accepte === false && /plafond/.test(r.code || '') && gestes(f.j).length === 0, 'G7 45 actions déjà faites cette heure (réserve 5) : rien ne part', r.code); }
  { const f = monter({ src }); const r = await creer(f, { reponses: rep1, fiche: FICHE({ photos: ['https://exemple.test/a.jpg'] }) });
    dit(r.code === 'photos' && f.j.vinted.length === 0, 'G8 une photo d’ailleurs que VRM ou Vinted : refusée avant tout', r.code); }
  // R — les refus.
  { const f = monter({ src, brouillon: 422 }); const r = await creer(f, { reponses: rep1 });
    dit(r.accepte === true && r.etape === 'echec' && seq(f.j) === 'PPB' && /refusé/.test(r.raison || ''), 'R1 brouillon refusé : UN envoi, jamais retenté, dit', { r, s: seq(f.j) });
    const n = gestes(f.j).length; const r2 = await creer(f, { reponses: rep1 });
    dit(r2.code === 'frein-refus' && gestes(f.j).length === n, 'R2 après un refus, le compte est freiné : la création suivante n’envoie rien', r2.code); }
  { const f = monter({ src, brouillon: 502 }); const r = await creer(f, { reponses: rep1 });
    dit(r.etape === 'incertain' && /PEUT-ÊTRE/.test(r.raison || ''), 'R3 réponse floue : « peut-être dans tes brouillons », jamais « fait »', r);
    const n = gestes(f.j).length; const r2 = await creer(f, { reponses: rep1 });
    dit(r2.code === 'incertaine' && gestes(f.j).length === n, 'R3b la même fiche est bloquée 30 min (jamais deux brouillons)', r2.code); }
  { const f = monter({ src, photo: 422 }); const r = await creer(f, { reponses: rep1 });
    dit(r.etape === 'echec' && seq(f.j) === 'P' && actions(f) === 0, 'R4 photo refusée : aucun brouillon, l’action réservée est rendue', { s: seq(f.j), a: actions(f) }); }
}

async function partieT(fichier) {
  const M = await import(pathToFileURL(fichier).href + '?t=' + Date.now());
  const E = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'etiquetteNumero.js')).href);
  const N = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'numeroEcrit.js')).href);
  const f = { id: 'n1', numero: '41', titre: 'Nike Air Max 90', description: 'Très bon état.', prix: 65, marque: 'Nike', taille: '42', etat: 'Très bon état' };
  // T1 réglage « nulle part » et « je numérote moi-même » éteint : le texte ne change pas.
  { const t = M.texteAnnonceVinted(f, {});
    dit(t.ok && t.titre === 'Nike Air Max 90' && t.description === 'Très bon état.', 'T1 réglages éteints : le texte de la fiche part tel quel', t); }
  // T2 « Je numérote moi-même » (fin de la description) : le N° est écrit en bas, et RELU par la règle de lecture.
  { const t = M.texteAnnonceVinted(f, { numeroEcrit: { actif: true, ou: ['description'] } });
    const lu = N.lireNumeroEcrit({ description: t.description, titre: t.titre, ou: ['description'] });
    dit(t.ok && /\n\nN°41$/.test(t.description) && lu.etat === 'lu' && lu.cle === '41', 'T2 « je numérote moi-même » : « N°41 » à la fin de la description, relu par la règle de VRM', { t, lu }); }
  // T3 l'étiquette choisie (fin du titre) est posée par la règle de l'étiquette.
  { const t = M.texteAnnonceVinted(f, { etiquette: { place: 'titre_fin', forme: 'diese' } });
    dit(t.ok && t.titre === 'Nike Air Max 90 #41', 'T3 l’étiquette réglée (fin du titre, #) est celle de src/etiquetteNumero.js', t.titre); }
  // T4 un AUTRE N° déjà écrit dans le texte ⇒ refusé (jamais deux numéros).
  { const t = M.texteAnnonceVinted({ ...f, description: 'Très bon état.\n\nN°40' }, { numeroEcrit: { actif: true } });
    dit(!t.ok && /N°40/.test(t.raison || ''), 'T4 un autre N° déjà écrit dans la fiche ⇒ refus nommé, rien ne part', t); }
  // T5 le titre trop long avec l'étiquette ⇒ refus (jamais coupé en silence).
  { const t = M.texteAnnonceVinted({ ...f, titre: 'x'.repeat(98) }, { etiquette: { place: 'titre_fin', forme: 'numero' } });
    dit(!t.ok && /100/.test(t.raison || ''), 'T5 titre > 100 avec l’étiquette ⇒ refus, jamais coupé', t); }
  // T6 les manques d'une fiche : photos, prix, N°, description courte.
  { const m = M.manquesFiche({ ...f, prix: null, numero: '' }, []);
    dit(m.includes('photos') && m.includes('prix') && m.includes('numero') && !m.includes('titre'), 'T6 manques nommés (photos, prix, N°)', m);
    dit(M.manquesFiche(f, [jpeg('x')]).length === 0, 'T6b une fiche complète avec une photo : rien ne manque', M.manquesFiche(f, [jpeg('x')])); }
  // T7 l'issue pour le suivi : « fait » ⇒ ok ; « incertain » ⇒ à la main ; refus ⇒ refus avec geste ; plafond ⇒ arrêter tout.
  { const a = M.issueCreation({ accepte: true, etape: 'fait', draftId: '88001', aFinir: ['la taille du colis'] });
    const b = M.issueCreation({ accepte: true, etape: 'incertain', raison: 'x' });
    const c = M.issueCreation({ accepte: false, code: 'plafond', raison: '50 actions' });
    const d = M.issueCreation({ sansReponse: true });
    const e = M.issueCreation({ accepte: false, envoye: false, raison: 'pas d’extension' });
    dit(a.etat === 'ok' && b.etat === 'main' && c.etat === 'refus' && c.arreterTout === true && d.etat === 'main' && e.etat === 'refus' && e.arreterTout === true, 'T7 issues : fait ⇒ ok · flou ou sans réponse ⇒ à vérifier · plafond / sans extension ⇒ refus qui arrête la série', { a, b, c, d, e }); }
  // T8 le payload ne transporte que la liste blanche (aucun prix d'achat, aucune identité d'une autre annonce).
  { const p = M.payloadFiche({ ...f, buyPrice: 30, vinted_item_id: '123', photos: ['x'] }, { titre: 'T', description: 'Desc.' }, [jpeg('1')]);
    dit(JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['categorie', 'couleur', 'description', 'etat', 'id', 'marque', 'numero', 'photos', 'prix', 'taille', 'titre']) && p.photos.length === 1 && p.titre === 'T', 'T8 le payload : liste blanche (ni prix d’achat, ni identifiant d’une autre annonce)', p); }
  // T9 l'état d'une fiche : « à créer » · « brouillon » (draftId) ; « en ligne » quand l'annonce du draftId est lue sans is_draft.
  { const s1 = M.etatFicheVinted({ ...f }, []); const s2 = M.etatFicheVinted({ ...f, vinted: { draftId: '88001', uid: '111' } }, []);
    const s3 = M.etatFicheVinted({ ...f, vinted: { draftId: '88001', uid: '111' } }, [{ id: 88001, is_draft: false }]);
    const s4 = M.etatFicheVinted({ ...f, vinted: { draftId: '88001', uid: '111' } }, [{ id: 88002, is_draft: false, title: 'Nike Air Max 90' }]);
    dit(s1 === 'a-creer' && s2 === 'brouillon' && s3 === 'en-ligne' && s4 === 'brouillon', 'T9 l’état suit l’IDENTIFIANT rendu par Vinted (jamais un titre semblable)', [s1, s2, s3, s4]); }
  void E;
}

(async () => {
  const fichierApp = path.join(__dirname, '..', 'src', 'annonceVinted.js');
  if (process.argv.includes('--prouve')) {
    const avant = path.join(os.tmpdir(), 'bg-avant-annonce-vinted.js');
    fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }));
    const f = monter({ src: avant }); const r = await creer(f, { reponses: { catalog_id: '1242' } });
    const rougeAvant = r.absent === true;
    console.log(rougeAvant ? '✅ §6.1 — sur origin/main : `creerVintedFiche` n’existe pas (E1 rouge)' : '❌ §6.1 — la fonction existait déjà sur origin/main ?');
    // Mutations de la règle de l'app : chacune doit rendre T rouge.
    const SRC = fs.readFileSync(fichierApp, 'utf8');
    const MUT = [
      ['le N° n’est plus écrit quand il numérote lui-même', [/if \(ecritFin\)/, 'if (false)']],
      ['un autre N° écrit n’est plus refusé', [/if \(autre\) return/, 'if (false) return']],
      ['« incertain » compté réussi', [/etape === 'incertain'/, "etape === '__jamais'"]],
      ['le payload laisse passer tout', [/const BLANCHE = \[/, "const BLANCHE = ['buyPrice', 'vinted_item_id', "]],
      ['l’état suit le titre', [/String\(x && x\.id\) === String\(d\)/, '(String(x && x.id) === String(d) || x.title === f.titre)']],
    ];
    let mortes = 0;
    for (const [nom, [re, par]] of MUT) {
      if (!re.test(SRC)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
      const tmp = path.join(os.tmpdir(), `annonceVinted-mut-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
      fs.writeFileSync(tmp, SRC.replace(re, par).replace(/from '\.\//g, `from '${pathToFileURL(path.join(__dirname, '..', 'src')).href}/`));
      const ko0 = ko; ok = 0; ko = 0;
      const log = console.log; console.log = () => {};
      try { await partieT(tmp); } catch (_) { ko++; }
      console.log = log;
      const rouge = ko > 0; ko = ko0;
      if (rouge) mortes++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}`);
    }
    const tout = rougeAvant && mortes === MUT.length;
    console.log(tout ? `\n✅ preuve : rouge sur le code d’avant, ${mortes}/${MUT.length} mutations rouges` : `\n❌ preuve incomplète (${mortes}/${MUT.length})`);
    process.exit(tout ? 0 : 1);
  }
  await partieE(process.env.BG_SRC || undefined);
  await partieT(fichierApp);
  console.log(`\n${ko ? '❌' : '✅'} audit-annonce-vinted : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
