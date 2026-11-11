#!/usr/bin/env node
// ── audit-retirer-ailleurs — VENDU SUR UN SITE ⇒ RETIRÉ DES AUTRES EN UN TOUCHER (11 nov.) ──
// Exécute la VRAIE règle (src/retirerAilleurs.js) sur la VRAIE vérification
// « Vendus ailleurs » (`articlesVendusAilleurs`, src/bilanSynchronisation.js), sur des
// données INVENTÉES. Ce qu'il exige :
//   · 50 articles au même titre, sur Vinted, Leboncoin et eBay : la vente du N°7
//     ne propose de retirer QUE les annonces du N°7 — jamais le titre (§5) ;
//   · Vinted n'est JAMAIS retiré par VRM (§3) : « à faire sur le site », jamais appelé ;
//     Vestiaire : à faire sur le site ;
//   · lecture de plus de 24 h, état pas confirmé ⇒ « peut-être encore en ligne · vérifier »,
//     jamais affirmé, jamais retiré ;
//   · N° porté par deux paires ⇒ aucune proposition ; deux annonces sous ce N° sur un site,
//     paire remise en vente ⇒ « vérifier », rien ne part ;
//   · l'exécution ne touche que les lignes `auto`, une à la fois, s'arrête sur un site au
//     premier refus, relit `continuer()` avant chaque appel ;
//   · « retiré ✓ relu » seulement sur une lecture APRÈS le retrait qui ne la montre plus ;
//   · l'app : confirmation AVANT tout envoi, les voies existantes (`lbcSupprime`,
//     `action: 'retirer'` sans `auto`), et elle passe par la règle.
//   node scripts/audit-retirer-ailleurs.cjs                 la règle du dépôt
//   node scripts/audit-retirer-ailleurs.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-retirer-ailleurs.cjs --prouve        chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'retirerAilleurs.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

const MUTATIONS = {
  'vinted-auto': ['regle', "else if (a.plateforme === 'Vinted') { voie = 'main';", "else if (a.plateforme === 'Vinted') { voie = 'auto'; moyen = 'lbc';"],
  'vieille-sure': ['regle', 'else if (a._peutEtre || vieille) {', 'else if (a._peutEtre) {'],
  'pas-confirme-sur': ['regle', 'else if (a._peutEtre || vieille) {', 'else if (vieille) {'],
  'peutetre-tu': ['regle', 'const toutes = [...sures, ...douteuses];', 'const toutes = [...sures];'],
  'deux-annonces': ['regle', "else if (parNumSite.get(`${a.numero}|${a.plateforme}`) > 1) {", 'else if (false) {'],
  'aconfirmer-ignore': ['regle', 'if (a.aConfirmer) {', 'if (false) {'],
  'relu-avant': ['regle', "r.statut === 'retire' && lueOk && v.at > r.at && completeApres(r) && !encore.has(k)", "r.statut === 'retire' && lueOk && completeApres(r) && !encore.has(k)"],
  'relu-encore': ['regle', "r.statut === 'retire' && lueOk && v.at > r.at && completeApres(r) && !encore.has(k)", "r.statut === 'retire' && lueOk && v.at > r.at && completeApres(r)"],
  'relu-sans-site': ['regle', "r.statut === 'retire' && lueOk && v.at > r.at && completeApres(r) && !encore.has(k)", "r.statut === 'retire' && lueOk && v.at > r.at && !encore.has(k)"],
  'relu-ratee': ['regle', "const lueOk = !!(v && !v.erreur && Number.isFinite(v.at));", "const lueOk = !!(v && Number.isFinite(v.at));"],
  'stop-ignore': ['regle', "if (r.statut !== 'retire') stop.add(s.plateforme);", ''],
  'main-execute': ['regle', "if (s.voie !== 'auto') continue;", "if (s.voie === 'verifier') continue;"],
  'continuer-ignore': ['regle', "if (!continuer()) {", 'if (false) {'],
  'incertain-retire': ['regle', "if (!j || code === 0 || code === 504 || j.reason === 'incertain') return { statut: 'incertain'", "if (!j || code === 0 || code === 504 || j.reason === 'incertain') return { statut: 'retire'"],
  'lbc-sans-ext': ['regle', 'else if (o.lbcOk) {', 'else if (true) {'],
  'app-sans-confirmation': ['app', "    const ok = await askConfirm({ title: t.titre, desc: t.desc, ok: 'Oui, retirer', cancel: 'Annuler', danger: true, irreversible: true });\n    if (!ok) return;\n", ''],
  'app-ebay-auto': ['app', "body: JSON.stringify({ action: 'retirer', itemId: String(site.id), confirme: true, ...corpsCompteEbay(site.compte) })", "body: JSON.stringify({ action: 'retirer', itemId: String(site.id), confirme: true, auto: true, ...corpsCompteEbay(site.compte) })"],
  'app-sans-regle': ['app', '  const planAilleurs = planRetirerAilleurs(vendusAilleurs.v, {', '  const planAilleurs = ((v) => ({ articles: [], nAuto: 0, nMain: 0, nVerifier: 0, ambigus: 0, manques: [] }))(vendusAilleurs.v, {'],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

(async () => {
  let regleSrc = fs.existsSync(REGLE) ? fs.readFileSync(REGLE, 'utf8') : null;
  let appSrc = fs.readFileSync(APP, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const cible = m[0] === 'app' ? appSrc : regleSrc;
    if (!cible || !cible.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (m[0] === 'app') appSrc = appSrc.replace(m[1], m[2]); else regleSrc = regleSrc.replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };

  // La règle et ses deux dépendances, copiées dans un dossier neuf (la mutation y est posée).
  let R = null, B = null;
  if (regleSrc != null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-retirer-ailleurs-'));
    fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'src', 'retirerAilleurs.js'), regleSrc);
    fs.copyFileSync(path.join(RACINE, 'src', 'bilanSynchronisation.js'), path.join(dir, 'src', 'bilanSynchronisation.js'));
    fs.copyFileSync(path.join(RACINE, 'api', '_lib', 'numerotation.js'), path.join(dir, 'api', '_lib', 'numerotation.js'));
    try { R = await import(pathToFileURL(path.join(dir, 'src', 'retirerAilleurs.js')).href); B = await import(pathToFileURL(path.join(dir, 'src', 'bilanSynchronisation.js')).href); }
    catch (e) { dit(false, 'la règle ne se charge pas : ' + e.message); }
  } else dit(false, 'src/retirerAilleurs.js absent : aucun « Retirer des autres sites »');

  const MAINT = Date.parse('2026-11-11T12:00:00Z'), H = 3600e3;
  const TITRE = 'Nike Air Max 90 blanche taille 42';
  // 50 articles identiques : la fiche Vinted i porte le N°i ; chacun publié aussi sur Leboncoin et eBay.
  const base = (o = {}) => {
    const numeros = {}, annonces = [];
    for (let i = 1; i <= 50; i++) {
      numeros['900' + i] = { numero: String(i) };
      annonces.push({ id: '900' + i, numero: String(i), plateforme: 'Vinted', compte: '11', compteNom: 'shop_a', titre: TITRE, capture: MAINT - 2 * H, active: true, lien: 'https://www.vinted.fr/items/900' + i, onglet: 'cat_annonces' });
      annonces.push({ id: String(2800000000 + i), numero: String(i), plateforme: 'Leboncoin', compte: 'aaaa-bbbb', compteNom: 'lbc_a', titre: TITRE, capture: new Date(MAINT - 3 * H).toISOString(), active: true, lien: null, onglet: 'leboncoin' });
      annonces.push({ id: String(256000000000 + i), numero: String(i), plateforme: 'eBay', compte: 'principal', compteNom: 'ebay_a', titre: TITRE, capture: MAINT - 1 * H, active: true, lien: 'https://www.ebay.fr/itm/' + (256000000000 + i), onglet: 'ebay_annonces' });
    }
    return { numeros, annonces, ventes: [], manques: [], ...o };
  };
  const verif = (data) => {
    const c = B.articlesVendusAilleurs(data);
    return { lignes: c.lignes, peutEtre: R.lignesPeutEtre(data, c.lignes), ambigus: c.ambigus, manques: data.manques || [], at: MAINT };
  };
  const plan = (data, o = {}) => R.planRetirerAilleurs(verif(data), { maintenant: MAINT, lbcOk: true, ebayOk: true, ...o });
  const venteVinted = (num) => ({ id: '900' + num, numero: String(num), plateforme: 'Vinted', engagee: true });

  if (R && B) {
    await essaie('A · 50 articles au même titre', () => {
      const d = base(); d.ventes.push(venteVinted(7));
      d.annonces = d.annonces.map((a) => (a.plateforme === 'Vinted' && a.id === '9007' ? { ...a, active: false } : a));
      const p = plan(d);
      const sites = p.articles.flatMap((a) => a.sites);
      dit(p.articles.length === 1 && p.articles[0].numero === '7', 'A1 · un seul article proposé : le N°7 vendu', JSON.stringify(p.articles.map((a) => a.numero)));
      dit(sites.length === 2 && sites.every((s) => s.id.endsWith('7') && !sites.some((x) => /\d7\d|^\d*[0-68-9]$/.test(x.id.slice(-2)) && false)), 'A2 · seulement les annonces du N°7 (Leboncoin + eBay), jamais une autre au même titre', JSON.stringify(sites.map((s) => s.id)));
      dit(sites.every((s) => String(s.id) === String(2800000007) || String(s.id) === String(256000000007)), 'A3 · les identifiants exacts du N°7', JSON.stringify(sites.map((s) => s.id)));
      dit(sites.every((s) => s.voie === 'auto') && p.nAuto === 2, 'A4 · Leboncoin et eBay frais : VRM peut les retirer', JSON.stringify(sites.map((s) => s.voie)));
      dit(R.phraseArticle(p.articles[0]) === 'N°7 vendu sur Vinted · encore en ligne sur Leboncoin et eBay', 'A5 · la phrase : « N°7 vendu sur Vinted · encore en ligne sur Leboncoin et eBay »', R.phraseArticle(p.articles[0]));
    });
    await essaie('B · vendu sur Leboncoin', () => {
      const d = base(); d.ventes.push({ id: '2800000012', numero: '12', plateforme: 'Leboncoin', engagee: true });
      d.annonces = d.annonces.map((a) => (a.plateforme === 'Leboncoin' && a.numero === '12' ? { ...a, active: false } : a));
      const p = plan(d); const art = p.articles[0] || { sites: [] };
      const vinted = art.sites.find((s) => s.plateforme === 'Vinted');
      dit(p.articles.length === 1 && art.numero === '12', 'B1 · le N°12 seulement');
      dit(vinted && vinted.voie === 'main' && !vinted.moyen, 'B2 · Vinted : à faire sur le site, jamais automatique (§3)', JSON.stringify(vinted));
      dit(vinted && vinted.lien === 'https://www.vinted.fr/items/90012', 'B3 · Vinted : le lien direct vers l’annonce');
      dit(art.sites.find((s) => s.plateforme === 'eBay')?.voie === 'auto', 'B4 · eBay : VRM le retire');
    });
    await essaie('C · Vestiaire et pas su', () => {
      const d = base(); d.ventes.push(venteVinted(3));
      d.annonces = d.annonces.map((a) => (a.id === '9003' ? { ...a, active: false } : a.plateforme === 'eBay' && a.numero === '3' ? { ...a, capture: MAINT - 30 * H } : a));
      d.annonces.push({ id: 'vc77', numero: '3', plateforme: 'Vestiaire', compte: '', compteNom: 'Vestiaire', titre: TITRE, capture: new Date(MAINT - 40 * H).toISOString(), active: null, lien: null, onglet: 'plat_vestiaire' });
      const p = plan(d); const art = p.articles[0] || { sites: [] };
      const eb = art.sites.find((s) => s.plateforme === 'eBay'), vc = art.sites.find((s) => s.plateforme === 'Vestiaire');
      dit(eb && eb.voie === 'verifier', 'C1 · eBay lu il y a 30 h : « vérifier », pas retiré', JSON.stringify(eb));
      dit(vc && vc.voie === 'verifier', 'C2 · Vestiaire à l’état pas confirmé : « peut-être encore en ligne », jamais affirmé', JSON.stringify(vc));
      dit(R.phraseArticle(art) === 'N°3 vendu sur Vinted · encore en ligne sur Leboncoin · peut-être encore en ligne sur eBay et Vestiaire · vérifier', 'C3 · la phrase sépare l’affirmé du « peut-être »', R.phraseArticle(art));
      const d2 = base(); d2.ventes.push(venteVinted(4));
      d2.annonces = d2.annonces.map((a) => (a.id === '9004' ? { ...a, active: false } : a));
      d2.annonces.push({ id: 'vc78', numero: '4', plateforme: 'Vestiaire', compte: '', compteNom: 'Vestiaire', titre: TITRE, capture: new Date(MAINT - 2 * H).toISOString(), active: true, lien: null, onglet: 'plat_vestiaire' });
      const vc2 = plan(d2).articles[0].sites.find((s) => s.plateforme === 'Vestiaire');
      dit(vc2 && vc2.voie === 'main', 'C4 · Vestiaire en ligne (lu) : à faire sur le site (aucune voie de retrait)', JSON.stringify(vc2));
      const d3 = base(); d3.ventes.push(venteVinted(2));
      d3.annonces = d3.annonces.map((a) => (a.id === '9002' ? { ...a, active: false } : a.plateforme === 'Leboncoin' && a.numero === '2' ? { ...a, active: null } : a));
      const lb3 = (plan(d3).articles[0] || { sites: [] }).sites.find((s) => s.plateforme === 'Leboncoin');
      dit(lb3 && lb3.voie === 'verifier', 'C5 · Leboncoin lu il y a 3 h mais état pas confirmé : « vérifier », pas retiré', JSON.stringify(lb3));
    });
    await essaie('D · identité ambiguë', () => {
      const d = base(); d.ventes.push(venteVinted(9));
      d.numeros['77777'] = { numero: '9' };   // une AUTRE paire porte aussi le N°9
      d.annonces = d.annonces.map((a) => (a.id === '9009' ? { ...a, active: false } : a));
      const p = plan(d);
      dit(p.articles.length === 0 && p.nAuto === 0, 'D1 · N° porté par deux paires : aucune proposition de retrait', JSON.stringify(p.articles));
      dit(p.ambigus > 0, 'D2 · l’ambiguïté est comptée (dite à l’écran)');
      const d2 = base(); d2.ventes.push(venteVinted(5));
      d2.annonces = d2.annonces.map((a) => (a.id === '9005' ? { ...a, active: false } : a));
      d2.annonces.push({ id: '2899999999', numero: '5', plateforme: 'Leboncoin', compte: 'aaaa-bbbb', compteNom: 'lbc_a', titre: TITRE, capture: new Date(MAINT - 1 * H).toISOString(), active: true, onglet: 'leboncoin' });
      const lbc = plan(d2).articles[0].sites.filter((s) => s.plateforme === 'Leboncoin');
      dit(lbc.length === 2 && lbc.every((s) => s.voie === 'verifier'), 'D3 · deux annonces Leboncoin sous ce N° : VRM ne choisit pas', JSON.stringify(lbc.map((s) => s.voie)));
      const d3 = base(); d3.ventes.push(venteVinted(6));   // la fiche 9006 reste en vente : paire remise en vente ⇒ aConfirmer
      d3.annonces.push({ id: '9606', numero: '6', plateforme: 'Vinted', compte: '11', titre: TITRE, capture: MAINT - H, active: true });
      d3.numeros['9606'] = { numero: '6', recreeDe: '9006' };
      const p3 = plan(d3); const s3 = p3.articles.flatMap((a) => a.sites);
      dit(s3.length > 0 && s3.filter((s) => s.plateforme !== 'Vinted').every((s) => s.voie === 'verifier'), 'D4 · paire remise en vente : « vérifier », rien ne part', JSON.stringify(s3.map((s) => s.plateforme + ':' + s.voie)));
    });
    await essaie('E · extension', () => {
      const d = base(); d.ventes.push(venteVinted(8)); d.annonces = d.annonces.map((a) => (a.id === '9008' ? { ...a, active: false } : a));
      const lbc = plan(d, { lbcOk: false, lbcPourquoi: 'mets-la à jour' }).articles[0].sites.find((s) => s.plateforme === 'Leboncoin');
      dit(lbc && lbc.voie === 'main' && lbc.raison === 'mets-la à jour', 'E1 · extension absente ou trop ancienne : Leboncoin à faire sur le site, dit pourquoi', JSON.stringify(lbc));
    });
    await essaie('F · exécution', async () => {
      const d = base(); d.ventes.push(venteVinted(10), { id: '2800000020', numero: '20', plateforme: 'Leboncoin', engagee: true }, venteVinted(30));
      d.annonces = d.annonces.map((a) => (['90010', '90030'].includes(a.id) || a.id === '2800000020' ? { ...a, active: false } : a));
      const p = plan(d);
      const appels = [];
      const voies = { lbc: async (s) => { appels.push('lbc:' + s.id); return s.id === '2800000010' ? { statut: 'refuse', texte: 'plafond' } : { statut: 'retire', texte: 'ok' }; },
        ebay: async (s) => { appels.push('ebay:' + s.id); return { statut: 'retire', texte: 'ok' }; } };
      const res = await R.executerRetraits(p, voies, () => true, () => MAINT);
      dit(!appels.some((x) => x.includes('900')), 'F1 · aucune annonce Vinted n’est jamais appelée', appels.join(' '));
      dit(appels.filter((x) => x.startsWith('lbc')).length === 1 && res['Leboncoin:aaaa-bbbb:2800000030'] && res['Leboncoin:aaaa-bbbb:2800000030'].statut === 'arrete', 'F2 · un refus Leboncoin arrête Leboncoin (la suivante n’est pas tentée)', appels.join(' '));
      dit(appels.filter((x) => x.startsWith('ebay')).length === 3, 'F3 · les autres sites continuent (eBay : les 3)', appels.join(' '));
      dit(!Object.keys(res).some((k) => k.startsWith('Vinted:')), 'F6 · une ligne « à faire sur le site » (Vinted) n’est même pas tentée', Object.keys(res).join(' '));
      const appels2 = [];
      await R.executerRetraits(p, { lbc: async () => { appels2.push(1); return { statut: 'retire' }; }, ebay: async () => { appels2.push(1); return { statut: 'retire' }; } }, () => false, () => MAINT);
      dit(appels2.length === 0, 'F4 · `continuer()` faux (session changée) : rien ne part');
      const d4 = base(); d4.ventes.push(venteVinted(3)); d4.annonces = d4.annonces.map((a) => (a.id === '9003' ? { ...a, active: false } : a.numero === '3' && a.plateforme !== 'Vinted' ? { ...a, capture: MAINT - 30 * H } : a));
      const appels3 = [];
      await R.executerRetraits(plan(d4), { lbc: async () => { appels3.push(1); return { statut: 'retire' }; }, ebay: async () => { appels3.push(1); return { statut: 'retire' }; } }, () => true, () => MAINT);
      dit(appels3.length === 0, 'F5 · « vérifier » (lecture ancienne) : rien ne part', String(appels3.length));
    });
    await essaie('G · issues', () => {
      dit(R.issueLbc(null).statut === 'incertain' && R.issueLbc({ accepte: true, etape: 'incertain' }).statut === 'incertain', 'G1 · Leboncoin sans réponse claire : « pas su », jamais « retiré »');
      dit(R.issueLbc({ accepte: false, raison: 'plafond' }).statut === 'refuse' && R.issueLbc({ accepte: true, etape: 'fait' }).statut === 'retire', 'G2 · Leboncoin : refus / fait');
      dit(R.issueEbay(504, { ok: false, reason: 'incertain' }).statut === 'incertain' && R.issueEbay(0, null).statut === 'incertain', 'G3 · eBay 504 / coupure : « pas su »');
      dit(R.issueEbay(200, { ok: true }).statut === 'retire' && R.issueEbay(422, { ok: false, error: 'eBay a refusé' }).statut === 'refuse', 'G4 · eBay : ok / refus');
    });
    await essaie('H · relu', () => {
      const res = { 'eBay:principal:1': { statut: 'retire', texte: 'ok', plateforme: 'eBay', compte: 'principal', at: MAINT }, 'Leboncoin:x:2': { statut: 'retire', texte: 'ok', plateforme: 'Leboncoin', compte: 'x', at: MAINT } };
      const completes = [{ plateforme: 'eBay', compte: 'principal', at: MAINT + 500 }, { plateforme: 'Leboncoin', compte: 'x', at: MAINT + 500 }];
      const apres = R.avecRelecture(res, { lignes: [{ plateforme: 'Leboncoin', compte: 'x', id: '2' }], peutEtre: [], completes, at: MAINT + 1000 });
      dit(apres['eBay:principal:1'].relu === true, 'H1 · absente d’une lecture COMPLÈTE du site faite APRÈS : « retiré ✓ relu »');
      dit(apres['Leboncoin:x:2'].relu === false, 'H2 · encore lue après : pas « relu »');
      const avant = R.avecRelecture(res, { lignes: [], peutEtre: [], completes, at: MAINT - 1000 });
      dit(avant['eBay:principal:1'].relu === false, 'H3 · vérification d’AVANT le retrait : pas « relu »');
      const ratee = R.avecRelecture(res, { lignes: [], peutEtre: [], completes, erreur: 'x', at: MAINT + 1000 });
      dit(ratee['eBay:principal:1'].relu === false, 'H4 · vérification ratée : pas « relu »');
      const sansSite = R.avecRelecture(res, { lignes: [], peutEtre: [], completes: [{ plateforme: 'eBay', compte: 'principal', at: MAINT - 500 }, { plateforme: 'eBay', compte: 'autre', at: MAINT + 500 }], at: MAINT + 1000 });
      dit(sansSite['eBay:principal:1'].relu === false && sansSite['Leboncoin:x:2'].relu === false, 'H6 · le site pas relu en entier depuis (sa lecture complète est d’avant, ou c’est un autre compte) : pas « relu » — la note de VRM n’est pas une relecture');
      dit(R.texteResultat({ statut: 'retire', relu: true, texte: 'eBay a terminé l’annonce' }).startsWith('retiré ✓ relu') && /pas encore relu/.test(R.texteResultat({ statut: 'retire', relu: false, texte: 'x' })), 'H5 · les textes « retiré ✓ relu » / « pas encore relu »');
    });
  }

  // L'app : la règle, la confirmation AVANT, les voies existantes.
  await essaie('I · app', () => {
    const app = sansCommentaires(appSrc);
    const deb = app.indexOf('const retirerDesAutresSites = async () => {');
    const corps = deb >= 0 ? app.slice(deb, app.indexOf('\n  };\n', deb)) : '';
    dit(/planRetirerAilleurs\(vendusAilleurs\.v,/.test(app), 'I1 · Ma journée / Ventes passent par la règle (`planRetirerAilleurs`)');
    const iConf = corps.indexOf('await askConfirm('), iNon = corps.indexOf('if (!ok) return;'), iExe = corps.indexOf('executerRetraits(');
    dit(iConf >= 0 && iNon > iConf && iExe > iNon, 'I2 · confirmation AVANT tout envoi (refusée ⇒ rien ne part)');
    dit(/cmd: 'lbcSupprime', id: String\(site\.id\), confirme: true/.test(corps), 'I3 · Leboncoin : la voie existante de l’extension (`lbcSupprime`, confirmé)');
    dit(/action: 'retirer', itemId: String\(site\.id\), confirme: true/.test(corps) && !/auto:\s*true/.test(corps), 'I4 · eBay : la route `retirer`, jamais en `auto` (c’est SON clic)');
    dit(/data-retirer-ailleurs=""/.test(app) && /blocRetirerAilleurs\(false\)/.test(app) && /blocRetirerAilleurs\(true\)/.test(app), 'I5 · le bouton est rendu sur Ma journée (carte + feuille) et en tête de Ventes');
    dit(!/vinted\.fr[^\n]*(delete|supprim)/i.test(corps), 'I6 · aucun appel de suppression Vinted');
  });

  console.log(`\n${n - ko}/${n} contrôles verts${mut ? ` (mutation « ${mut} »)` : ''}.`);
  process.exit(ko ? 1 : 0);
})();
