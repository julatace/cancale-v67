#!/usr/bin/env node
// ── audit-a-retirer-ailleurs — « À RETIRER AILLEURS » : UN ENDROIT, UN GESTE PAR SITE (15 nov.) ──
// Récit : docs/passation/2026-11-15-retrait-ailleurs.md. Exécute les VRAIES règles
// (src/aRetirerAilleurs.js sur src/retirerAilleurs.js sur `articlesVendusAilleurs`) et la
// VRAIE notification serveur (api/_lib/double-vente.js), sur des données INVENTÉES.
// Ce qu'il exige :
//   A · 50 paires identiques (même titre, même marque, même taille) : la vente PROUVÉE du N°7
//       ne propose QUE les annonces du N°7 — jamais une autre par ressemblance (§5) ;
//   B · une vente PAS prouvée (commande sans état, `engagee: null`) n'est JAMAIS proposée au
//       retrait : la paire est dite « à vérifier » avec pourquoi, aucun geste de retrait, hors
//       de « Tout retirer » ; une vente sans identité ne désigne rien ; une vente prouvée du même
//       N° l'emporte ;
//   C · vendue + en ligne ailleurs par identité ⇒ proposée, UN geste par site : Leboncoin
//       (extension), eBay (route), Vestiaire / Vinted (l'annonce + « C'est retiré ») ;
//   D · eBay : retrait automatique allumé ⇒ il s'en charge (« Retirer maintenant » à son doigt),
//       déjà demandé ⇒ rien à faire ;
//   E · pas d'onglet leboncoin.fr ⇒ « Ouvre leboncoin.fr », reprise bornée (15 s, 6 fois) ;
//   F · « C'est retiré » : tenu jusqu'à la prochaine lecture complète, DÉMENTI si elle la voit ;
//   G · après : « pas de réponse claire » ⇒ jamais un second envoi à l'aveugle ; refus ⇒ réessayer ;
//   H · une alerte de la coque n'est tue que si CHAQUE N° est déjà dans le bloc, pour CE site ;
//   I · un site retiré qui sort du plan reste dit (pas de site neuf) ;
//   J · la notification : « N°7 vendue sur Vinted · à retirer de Leboncoin », vers le parcours ;
//   K · l'app : commande Vinted sans état ⇒ pas une preuve ; le bloc en tête de Ma journée, dans
//       la fiche, sur Ventes ; la confirmation existante une fois ; reprise sans redemander.
//   node scripts/audit-a-retirer-ailleurs.cjs                 la règle du dépôt
//   node scripts/audit-a-retirer-ailleurs.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-a-retirer-ailleurs.cjs --prouve        chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  ra: path.join(RACINE, 'src', 'aRetirerAilleurs.js'),
  regle: path.join(RACINE, 'src', 'retirerAilleurs.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  dv: path.join(RACINE, 'api', '_lib', 'double-vente.js'),
};

const MUTATIONS = {
  'douteuse-sure': ['regle', "if (a._venteDouteuse) { voie = 'verifier';", "if (false) { voie = 'verifier';"],
  'douteuse-tue': ['regle', '  if (!douteuses.length) return lignes;', '  return lignes;'],
  'verifier-geste': ['ra', "  if (site.voie === 'verifier') return { ...base, etat: 'verifier' };\n", ''],
  'incertain-relance': ['ra', "return { ...base, etat: 'incertain', geste: 'lien',", "return { ...base, etat: 'incertain', geste: site.moyen,"],
  'reprise-sans-fin': ['ra', '(Number(x.n) || 0) < REPRISES_MAX && ', ''],
  'reprise-rafale': ['ra', ' && maintenant - (Number(x.at) || 0) >= REPRISE_MS', ''],
  'marque-jamais-dementie': ['ra', 'if (derniere != null && derniere > Number(marque.at))', 'if (false)'],
  'alerte-un-suffit': ['ra', 'return nums.every((n) => dans.has(n));', 'return nums.some((n) => dans.has(n));'],
  'alerte-autre-site': ['ra', 'if (s.plateforme === plateforme) for', 'for'],
  'fusion-invente': ['ra', '    if (!g || !g.art || !g.site) continue;', '    if (!g) continue; g.site = g.site || { cle: "x", plateforme: "Leboncoin" }; g.art = g.art || { numero: "999" };'],
  'ebay-auto-ignore': ['ra', '    if (ctx.ebayAuto) return { ...base, etat: \'ebayAuto\', geste: \'ebay\' };\n', ''],
  'notif-ancienne': ['dv', 'const url = DESTINATIONS.retirerAilleurs({ num: h0.numero || nums[0] });', "const url = DESTINATIONS.journee();"],
  'app-sans-etat-prouve': ['app', '        !sansEtatVinted(o) &&\n', ''],
  'app-reprise-redemande': ['app', '  if (!reprise && !(await confirmerRA([{ a: art, s: site }]))) return;', '  if (!(await confirmerRA([{ a: art, s: site }]))) return;'],
  'app-alertes-tues': ['app', '          if (a.dv && a.retrait && alerteCouverte(fusionPlan(RA.plan, RA.gardes), a.retrait.plat, a.retrait.nums, cleNum)) continue;', '          if (a.dv && a.retrait) continue;'],
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
  const src = {};
  for (const [k, f] of Object.entries(F)) src[k] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]] || !src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };

  // Les règles et leurs dépendances, copiées dans un dossier neuf (la mutation y est posée).
  let RA = null, R = null, B = null, DV = null;
  if (src.ra && src.regle) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-a-retirer-ailleurs-'));
    fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'src', 'aRetirerAilleurs.js'), src.ra);
    fs.writeFileSync(path.join(dir, 'src', 'retirerAilleurs.js'), src.regle);
    for (const f of ['src/bilanSynchronisation.js', 'src/profilVendeur.js', 'api/_lib/numerotation.js', 'api/_lib/fetch-delai.js']) fs.copyFileSync(path.join(RACINE, f), path.join(dir, f));
    try {
      RA = await import(pathToFileURL(path.join(dir, 'src', 'aRetirerAilleurs.js')).href);
      R = await import(pathToFileURL(path.join(dir, 'src', 'retirerAilleurs.js')).href);
      B = await import(pathToFileURL(path.join(dir, 'src', 'bilanSynchronisation.js')).href);
    } catch (e) { dit(false, 'la règle ne se charge pas : ' + e.message); }
  } else dit(false, 'src/aRetirerAilleurs.js absent : aucun « À retirer ailleurs »');
  // La notification : le VRAI module serveur, dans l'arbre (sa copie mutée posée à côté).
  if (src.dv) {
    const f = path.join(path.dirname(F.dv), `.audit-dv-${process.pid}.js`);
    try { fs.writeFileSync(f, src.dv); DV = await import(pathToFileURL(f).href); } catch (e) { dit(false, 'double-vente.js ne se charge pas : ' + e.message); } finally { try { fs.unlinkSync(f); } catch (_) {} }
  }

  const MAINT = Date.parse('2026-11-15T12:00:00Z'), H = 3600e3;
  const TITRE = 'Nike Air Max 90 blanche taille 42';
  // 50 paires identiques : la fiche Vinted i porte le N°i ; chacune aussi sur Leboncoin, eBay et Vestiaire.
  const base = () => {
    const numeros = {}, annonces = [];
    for (let i = 1; i <= 50; i++) {
      numeros['900' + i] = { numero: String(i) };
      annonces.push({ id: '900' + i, numero: String(i), plateforme: 'Vinted', compte: '11', compteNom: 'shop_a', titre: TITRE, capture: MAINT - 2 * H, active: true, lien: 'https://www.vinted.fr/items/900' + i });
      annonces.push({ id: String(2800000000 + i), numero: String(i), plateforme: 'Leboncoin', compte: 'aaaa-bbbb', compteNom: 'lbc_a', titre: TITRE, capture: new Date(MAINT - 3 * H).toISOString(), active: true, lien: null });
      annonces.push({ id: String(256000000000 + i), numero: String(i), plateforme: 'eBay', compte: 'principal', compteNom: 'ebay_a', titre: TITRE, capture: MAINT - 1 * H, active: true, lien: 'https://www.ebay.fr/itm/' + (256000000000 + i) });
      annonces.push({ id: 'VC' + i, numero: String(i), plateforme: 'Vestiaire', compte: 'vc', compteNom: '', titre: TITRE, capture: MAINT - 1 * H, active: true, lien: 'https://fr.vestiairecollective.com/p-VC' + i + '.shtml' });
    }
    return { numeros, annonces, ventes: [], manques: [] };
  };
  const vendre = (d, num, o = {}) => { d.ventes.push({ id: '900' + num, numero: String(num), plateforme: 'Vinted', engagee: true, ...o }); if (o.engagee !== null) d.annonces = d.annonces.map((a) => (a.plateforme === 'Vinted' && a.id === '900' + num ? { ...a, active: false } : a)); return d; };
  const verif = (data) => { const c = B.articlesVendusAilleurs(data); return { lignes: c.lignes, peutEtre: R.lignesPeutEtre(data, c.lignes), ambigus: c.ambigus, manques: [], at: MAINT, completes: data.completes || [] }; };
  const liste = (data, ctx = {}, o = {}) => { const v = verif(data); return RA.listeARetirer(R.planRetirerAilleurs(v, { maintenant: MAINT, lbcOk: true, ebayOk: true, ...o }), { completes: v.completes, ...ctx }); };
  const sitesDe = (l) => l.articles.flatMap((a) => a.sites.map((s) => ({ ...s, numero: a.numero })));

  if (RA && R && B) {
    await essaie('A · 50 paires identiques', () => {
      const l = liste(vendre(base(), 7));
      const s = sitesDe(l);
      dit(l.articles.length === 1 && l.articles[0].numero === '7', 'A1 · une seule paire proposée : le N°7 vendu (pas une des 49 autres au même titre)', JSON.stringify(l.articles.map((a) => a.numero)));
      dit(s.length === 3 && s.every((x) => /7$/.test(x.id) && !/[0-9]7$/.test(x.id.replace(/^(2800000007|256000000007|VC7)$/, ''))), 'A2 · ses trois annonces (Leboncoin, eBay, Vestiaire), par leurs identifiants exacts', JSON.stringify(s.map((x) => x.id)));
      dit(l.serie.length === 2 && l.serie.every((x) => x.numero === '7'), 'A3 · « Tout retirer » n’enchaîne que les gestes automatiques du N°7', JSON.stringify(l.serie));
    });
    await essaie('B · vente pas prouvée', () => {
      const d = vendre(base(), 8, { engagee: null, pourquoi: 'commande Vinted sans état de commande', pourquoiCode: 'sans-etat' });
      const l = liste(d);
      const a = l.articles.find((x) => x.numero === '8');
      dit(!!a && a.douteuse === true, 'B1 · la paire « peut-être vendue » est DITE (pas tue) — « Peut-être vendue sur Vinted »', JSON.stringify(l.articles.map((x) => [x.numero, x.douteuse])));
      dit(!!a && a.sites.length === 3 && a.sites.every((x) => x.etat === 'verifier' && x.code === 'douteuse' && x.pourquoiCode === 'sans-etat'), 'B2 · chaque site « à vérifier », avec pourquoi (vente pas prouvée : commande sans état)', JSON.stringify(a && a.sites.map((x) => [x.etat, x.code, x.pourquoiCode])));
      dit(!!a && a.sites.every((x) => x.geste !== 'lbc' && x.geste !== 'ebay') && l.serie.length === 0, 'B3 · aucun geste de retrait, hors de « Tout retirer »', JSON.stringify(l.serie));
      const d2 = base(); d2.ventes.push({ id: 'x', numero: '', plateforme: 'Vinted', engagee: true });
      dit(liste(d2).articles.length === 0, 'B4 · une vente sans identité (aucun N°) ne désigne rien');
      const d3 = vendre(vendre(base(), 9, { engagee: null, pourquoiCode: 'sans-etat' }), 9);
      const a3 = liste(d3).articles.find((x) => x.numero === '9');
      dit(!!a3 && !a3.douteuse && a3.sites.some((x) => x.geste === 'lbc'), 'B5 · une vente PROUVÉE du même N° l’emporte (le geste est proposé)', JSON.stringify(a3 && a3.sites.map((x) => x.etat)));
      const d4 = base(); d4.ventes.push({ id: '9003', numero: '3', plateforme: 'Vinted', engagee: false });
      dit(liste(d4).articles.length === 0, 'B6 · une vente annulée (`engagee: false`) ne désigne rien');
    });
    await essaie('C · un geste par site', () => {
      const l = liste(vendre(base(), 7));
      const par = Object.fromEntries(sitesDe(l).map((x) => [x.plateforme, x]));
      dit(par.Leboncoin && par.Leboncoin.etat === 'aRetirer' && par.Leboncoin.geste === 'lbc', 'C1 · Leboncoin : « Retirer de Leboncoin » (l’extension)', JSON.stringify(par.Leboncoin));
      dit(par.eBay && par.eBay.etat === 'aRetirer' && par.eBay.geste === 'ebay', 'C2 · eBay : « Retirer d’eBay » (la route)');
      dit(par.Vestiaire && par.Vestiaire.etat === 'main' && par.Vestiaire.geste === 'lien' && /VC7/.test(par.Vestiaire.lien || ''), 'C3 · Vestiaire : l’annonce elle-même + « C’est retiré »', JSON.stringify(par.Vestiaire));
      const d = base(); d.ventes.push({ id: '2800000005', numero: '5', plateforme: 'Leboncoin', engagee: true });
      d.annonces = d.annonces.map((a) => (a.plateforme === 'Leboncoin' && a.id === '2800000005' ? { ...a, active: false } : a));
      const v = sitesDe(liste(d)).find((x) => x.plateforme === 'Vinted');
      dit(v && v.etat === 'main' && v.geste === 'lien' && v.code === 'vinted', 'C4 · vendue sur Leboncoin : Vinted à la main (VRM ne supprime jamais une annonce Vinted, §3)', JSON.stringify(v));
      const sansExt = sitesDe(liste(vendre(base(), 7), {}, { lbcOk: false, lbcCode: 'absente' })).find((x) => x.plateforme === 'Leboncoin');
      dit(sansExt && sansExt.etat === 'main' && sansExt.code === 'lbcAbsente', 'C5 · sans extension ici : Leboncoin à la main, la raison dite', JSON.stringify(sansExt));
      const vieux = base(); vendre(vieux, 7); vieux.annonces = vieux.annonces.map((a) => (a.plateforme === 'Leboncoin' ? { ...a, capture: new Date(MAINT - 30 * H).toISOString() } : a));
      const lv = sitesDe(liste(vieux)).find((x) => x.plateforme === 'Leboncoin');
      dit(lv && lv.etat === 'verifier' && lv.code === 'vieille' && !lv.geste, 'C6 · lecture de 30 h : « à vérifier », aucun geste de retrait', JSON.stringify(lv));
    });
    const d7 = vendre(base(), 7);
    const cle = (p) => sitesDe(liste(d7)).find((x) => x.plateforme === p).cle;
    await essaie('D · eBay automatique', () => {
      const a = sitesDe(liste(d7, { ebayAuto: true, ebayTentes: new Set() })).find((x) => x.plateforme === 'eBay');
      dit(a.etat === 'ebayAuto' && a.geste === 'ebay', 'D1 · retrait automatique allumé : il s’en charge, « Retirer maintenant » reste à son doigt', JSON.stringify(a));
      const b = sitesDe(liste(d7, { ebayAuto: true, ebayTentes: new Set(['256000000007']) })).find((x) => x.plateforme === 'eBay');
      dit(b.etat === 'ebayEnvoye' && !b.geste, 'D2 · déjà demandé par le retrait automatique : rien à refaire (jamais doublé)', JSON.stringify(b));
    });
    await essaie('E · onglet Leboncoin', () => {
      const k = cle('Leboncoin');
      const l = liste(d7, { attente: { [k]: { raison: 'x', at: MAINT, n: 1 } } });
      const s = sitesDe(l).find((x) => x.cle === k);
      dit(s.etat === 'onglet' && !l.serie.some((x) => x.cle === k), 'E1 · pas d’onglet connecté : « Ouvre leboncoin.fr », hors de « Tout retirer »', JSON.stringify(s));
      dit(RA.veutOnglet({ accepte: false, code: 'lbc-absent' }) && RA.veutOnglet({ accepte: false, code: 'autre-compte' }) && !RA.veutOnglet({ accepte: false, code: 'plafond' }) && !RA.veutOnglet({ accepte: true, etape: 'fait' }), 'E2 · seuls « pas d’onglet / pas de session / autre compte » demandent l’onglet');
      const now = MAINT + 60000;
      dit(RA.aReprendre({ a: { at: MAINT, n: 1 } }, now).length === 1 && RA.aReprendre({ a: { at: now - 3000, n: 1 } }, now).length === 0, 'E3 · reprise : pas plus d’une toutes les 15 s');
      dit(RA.aReprendre({ a: { at: MAINT, n: 6 } }, now).length === 0, 'E4 · reprise : 6 fois au plus (une session qui ne revient pas n’est pas relancée sans fin)');
    });
    await essaie('F · « C’est retiré »', () => {
      const k = cle('Vestiaire');
      const a = sitesDe(liste(d7, { marques: { [k]: { at: MAINT } } })).find((x) => x.cle === k);
      dit(a.etat === 'note', 'F1 · noté par lui, aucune lecture complète depuis : « notée retirée »', JSON.stringify(a));
      const b = sitesDe(liste({ ...d7, completes: [{ plateforme: 'Vestiaire', compte: 'vc', at: MAINT + 1000 }] }, { marques: { [k]: { at: MAINT } } })).find((x) => x.cle === k);
      dit(b.etat === 'main' && b.dementieLe === MAINT + 1000, 'F2 · une lecture complète APRÈS la voit encore : démenti (« encore en ligne à la lecture du … »)', JSON.stringify(b));
    });
    await essaie('G · après', () => {
      const k = cle('Leboncoin');
      const inc = sitesDe(liste(d7, { resultats: { [k]: { statut: 'incertain', texte: 't' } } })).find((x) => x.cle === k);
      dit(inc.etat === 'incertain' && inc.geste === 'lien' && !liste(d7, { resultats: { [k]: { statut: 'incertain' } } }).serie.some((x) => x.cle === k), 'G1 · pas de réponse claire : « regarde l’annonce », jamais un second envoi à l’aveugle', JSON.stringify(inc));
      const ref = sitesDe(liste(d7, { resultats: { [k]: { statut: 'refuse', texte: 'pas fait — plafond' } } })).find((x) => x.cle === k);
      dit(ref.etat === 'refuse' && ref.geste === 'lbc', 'G2 · refus : « Réessayer » (sur son clic)');
      const ok = liste(d7, { resultats: { [k]: { statut: 'retire', relu: true } } });
      dit(sitesDe(ok).find((x) => x.cle === k).etat === 'retire' && !ok.serie.some((x) => x.cle === k), 'G3 · retirée : dite, plus dans « Tout retirer »');
      dit(sitesDe(liste(d7, { enCours: k })).find((x) => x.cle === k).etat === 'encours', 'G4 · en cours : dit');
    });
    await essaie('H · alertes de la coque', () => {
      const plan = R.planRetirerAilleurs(verif(vendre(vendre(base(), 7), 12)), { maintenant: MAINT, lbcOk: true, ebayOk: true });
      dit(RA.alerteCouverte(plan, 'Leboncoin', ['7', '12']) === true, 'H1 · chaque N° déjà dans le bloc pour Leboncoin : l’alerte n’est pas redite');
      dit(RA.alerteCouverte(plan, 'Leboncoin', ['7', '13']) === false, 'H2 · un N° absent du bloc : l’alerte reste (rien ne disparaît en silence)');
      const sansLbc = { articles: plan.articles.map((a) => ({ ...a, sites: a.sites.filter((s) => s.plateforme !== 'Leboncoin') })) };
      dit(RA.alerteCouverte(sansLbc, 'Leboncoin', ['7']) === false, 'H3 · le N° est dans le bloc, mais pas pour CE site : l’alerte reste');
      dit(RA.alerteCouverte(plan, 'Leboncoin', []) === false, 'H4 · une alerte sans N° (pas su) reste');
    });
    await essaie('I · après la relecture', () => {
      const plan = R.planRetirerAilleurs(verif(d7), { maintenant: MAINT, lbcOk: true, ebayOk: true });
      const s = plan.articles[0].sites[0];
      const f = RA.fusionPlan({ articles: [] }, { [s.cle]: { art: { numero: '7', venduSur: ['Vinted'] }, site: s } });
      dit(f.articles.length === 1 && f.articles[0].sites.length === 1 && f.articles[0].sites[0].cle === s.cle, 'I1 · un site retiré qui sort du plan reste dit (« retirée ✓ relu »)');
      dit(RA.fusionPlan({ articles: [] }, { x: { art: null, site: null } }).articles.length === 0, 'I2 · aucun site inventé');
    });
  }

  await essaie('J · notification', () => {
    if (!DV) { dit(false, 'J · module absent'); return; }
    const n1 = DV.notificationDoubleVente([{ numero: '7', plateforme: 'leboncoin', annonces: [{ id: '2800000007' }] }], TITRE, { venduSur: 'vinted' });
    dit(n1 && n1.title === '⚠️ N°7 vendue sur Vinted · à retirer de Leboncoin', 'J1 · « N°7 vendue sur Vinted · à retirer de Leboncoin »', n1 && n1.title);
    dit(n1 && n1.url === '/?tab=journee&cible=ailleurs&num=7', 'J2 · elle ouvre « À retirer ailleurs » sur le N°7', n1 && n1.url);
    const n2 = DV.notificationDoubleVente([{ numero: '7', plateforme: 'ebay', annonces: [{ itemId: '1' }] }], TITRE, { venduSur: 'vinted' });
    dit(n2 && / · à retirer d'eBay$/.test(n2.title), 'J3 · « à retirer d’eBay »', n2 && n2.title);
  });

  await essaie('K · app', () => {
    const app = sansCommentaires(src.app || '');
    dit(/const sansEtatVinted = \(o\) => !String\(/.test(app) && /!sansEtatVinted\(o\) &&\s*\n\s*txnItem/.test(app) && /engagee: sansEtatVinted\(o\) && !venduesVinted\.has\?\.\(id\) \? null : true/.test(app), 'K1 · une commande Vinted sans état n’est PAS une preuve (`engagee: null`, « à vérifier »)');
    dit(/\{raTete \? blocRetirerAilleurs\(true\) : null\}/.test(app) && /<BlocARetirerAilleurs numero=\{p\.num\}/.test(app) && /\{!baseKO && blocRetirerAilleurs\(false\)\}/.test(app), 'K2 · le bloc : en tête de Ma journée, dans la fiche de la paire, en tête de Ventes');
    dit(/if \(!reprise && !\(await confirmerRA\(\[\{ a: art, s: site \}\]\)\)\) return;/.test(app), 'K3 · la confirmation existante, une fois — la reprise après « Ouvre leboncoin.fr » ne redemande pas');
    dit(/alerteCouverte\(fusionPlan\(RA\.plan, RA\.gardes\), a\.retrait\.plat, a\.retrait\.nums, cleNum\)/.test(app), 'K4 · une alerte de la coque n’est tue que couverte par le bloc (même règle)');
    dit(/'vrm_retraits_main',/.test(app), 'K5 · « C’est retiré » est synchronisé (sa parole suit d’un appareil à l’autre)');
  });

  console.log(`\n${n - ko}/${n} contrôles verts${mut ? ` (mutation « ${mut} »)` : ''}.`);
  process.exit(ko ? 1 : 0);
})();
