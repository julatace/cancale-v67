#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE L'AGENT « PUBLIER SUR… » (19 nov., src/publier/ + extension 5.409 `publierFiche`) — lecture seule.
//  Julien : « je veux être sûr que pour chaque article, peu importe ce que c'est, ça publie au bon endroit
//  dans la bonne catégorie » — « sans IA » — « c'est l'extension qui va publier dans tous les cas ».
//  EXÉCUTE les vraies règles (copiées dans un dossier neuf, la mutation y est posée) et le VRAI background.js
//  (scripts/_fond-vm.cjs). Aucune donnée réelle : articles, comptes, annonces inventés (le dépôt est public).
//   A. la fiche article neutre : chaque champ LU (et d'où), jamais deviné du titre ; deux annonces qui se
//      contredisent ⇒ conflit (demandé) ; une catégorie Leboncoin partielle n'est jamais « sûre » ; la pointure
//      reste EU ; une réponse vaut pour SON article seulement (50 articles identiques : aucune fuite) ;
//   B. les tables dans les deux sens : Vinted ⇄ VRM bijectif ; Vestiaire = valeurs du catalogue de dépôt ;
//      eBay entrant : seulement un chemin vu ; marque Leboncoin et Vestiaire : la liste du site, jamais forcée ;
//   C. le plan : rien ne part sans catégorie sûre ; une marque hors liste n'est jamais posée ; l'envoi porte
//      catégorie, critères et « VRM-{n°} » ; UNE question groupée par article ;
//   D. les réponses retenues (par article, par catégorie VRM, par marque) et seulement dans la liste du site ;
//   E. la relecture : catégorie enregistrée = voulue ⇒ ok ; différente ⇒ écart ; pas lue ⇒ jamais « ok » ;
//   F. la couverture par catégorie du stock × site ;
//   G. l'extension (vrai background.js) : fiche revérifiée, catégorie sûre exigée, marque Vestiaire cherchée
//      dans la liste du site, deux comptes ⇒ rien, un dépôt à la fois ;
//   H. le câblage (synchronisée, capacité, commande, action, 5 langues).
//
//   node scripts/audit-publier-agent.cjs                 l'audit
//   node scripts/audit-publier-agent.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-publier-agent.cjs --prouve        chaque mutation doit rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F = {
  agent: path.join(RACINE, 'src', 'publier', 'agent.js'),
  tables: path.join(RACINE, 'src', 'publier', 'tables.js'),
  bg: path.join(RACINE, 'vinted-sync-extension', 'background.js'),
  app: path.join(RACINE, 'src', 'App.jsx'),
  ecran: path.join(RACINE, 'src', 'ecrans', 'PublierAgent.jsx'),
  annonces: path.join(RACINE, 'src', 'ecrans', 'AnnoncesEgalite.jsx'),
};
const MUTATIONS = {
  'titre-devine': ['agent', 'let cat = accorder(lu.categorie, (x, y) => x === y);', "let cat = accorder(lu.categorie, (x, y) => x === y) || (lu.titre[0] && /basket|nike/i.test(lu.titre[0].v) ? { v: 'chaussures/baskets/homme', de: 'titre' } : null);"],
  'conflit-ignore': ['agent', 'return autres.length ? { v: null, conflit:', 'return false ? { v: null, conflit:'],
  'lbc-partielle-sure': ['tables', '  return { famille: f[0], candidates };', '  return candidates.length === 1 ? { cle: candidates[0] } : { famille: f[0], candidates };'],
  'pointure-convertie': ['tables', 'return m ? (m[2] ? `${m[1]},5` : m[1]) : null;', 'return m ? String(Number(m[1]) - 33) : null;'],
  'marque-lbc-forcee': ['agent', "else out.questions.push(Q('marque', marquesLbcPermises(), { site, bloque: false }));", "else { out.valeurs.marque = 'Autre'; out.origine.marque = 'table'; }"],
  'marque-vc-forcee': ['agent', "else { out.questions.push(Q('marque', marquesVcPermises(), { site, bloque: true })); out.refus = { code: 'marque-hors-liste', marque: m }; }", "else { out.valeurs.marque = m; out.origine.marque = 'lu-site'; }"],
  'part-sans-categorie': ['agent', 'if (out.questions.some((q) => q.bloque)) {', 'if (false) {'],
  'relecture-aveugle': ['agent', "etat: norm(relu) === norm(w.categorie) ? 'ok' : 'ecart'", "etat: 'ok'"],
  'relecture-pas-su-ok': ['agent', "const items = lectures.leboncoin; if (items == null) return { etat: 'pas-su', voulu: w };", "const items = lectures.leboncoin; if (items == null) return { etat: 'ok', voulu: w };"],
  'reponse-hors-liste': ['agent', 'if (s) v.sous = s;', 'if (vc.sous) v.sous = String(vc.sous);'],
  'reponse-oubliee': ['agent', '  if (ca && Object.keys(art).length) m.articles[ca] = art;', ''],
  'reponse-fuit': ['agent', 'const rep = mem.articles[cleArt(a.cle)] || {};', 'const rep = Object.values(mem.articles)[0] || {};'],
  'ext-sans-categorie': ['bg', "    if (!cr.categorie) return non('categorie', 'aucune catégorie sûre pour Leboncoin — rien n’est parti');\n", ''],
  'ext-marque-vc-ignoree': ['bg', "if (l.etat !== 'listee') return { accepte: false, code: 'marque-hors-liste'", "if (false) return { accepte: false, code: 'marque-hors-liste'"],
  'ext-deux-comptes': ['bg', "if (vus.size > 1) return { ok: false, code: 'deux-comptes', raison: 'deux comptes Leboncoin", "if (false) return { ok: false, code: 'deux-comptes', raison: 'deux comptes Leboncoin"],
  'ext-un-a-la-fois': ['bg', 'if (pend && pend.ad && Date.now() - Number(pend.at || 0) < 30 * 60000) return', 'if (false) return'],
  'sync-oublie': ['app', "  'vrm_agent_publier',", "  'vrm_agent_publier_x',"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    if (r.status !== 0 && rouges) ok++;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  const src = {};
  for (const [k, p] of Object.entries(F)) src[k] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]] || !src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } };

  // Les modules purs, copiés dans un dossier neuf (la mutation y vit).
  let A = null, T = null;
  if (!src.agent || !src.tables) dit(false, 'src/publier/agent.js ou tables.js absent : pas d’agent');
  else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-publier-agent-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    const copies = new Set();
    const copier = (f, txt) => {
      if (copies.has(f)) return; copies.add(f);
      const t = txt != null ? txt : fs.readFileSync(path.join(RACINE, 'src', f), 'utf8');
      fs.mkdirSync(path.dirname(path.join(dir, 'src', f)), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', f), t);
      for (const m of t.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.\.?\/[^'"]+\.js)['"]/g)) copier(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    };
    copier('publier/tables.js', src.tables);
    copier('publier/agent.js', src.agent);
    try { T = await import(pathToFileURL(path.join(dir, 'src', 'publier', 'tables.js')).href); A = await import(pathToFileURL(path.join(dir, 'src', 'publier', 'agent.js')).href); }
    catch (e) { dit(false, 'les modules ne se chargent pas : ' + e.message); }
  }

  // Des articles inventés, à la forme de `construireArticles` (src/articles/modele.js).
  const art = (cle, numero, annonces, x = {}) => ({ cle, numero, prix: 80, prixMini: 60, annonces, ...x });
  const vinted = (id, x = {}) => ({ site: 'vinted', id, titre: 'Paire de baskets Nike Air Max 90 blanches', photo: 'https://images1.vinted.net/t/a.jpg', taille: '42.5', condition: 'Très bon état', marque: 'Nike', etat: 'enligne', ...x });
  const lectV = (id, catalog_id, x = {}) => ({ vinted: { [id]: { codes: catalog_id == null ? {} : { catalog_id }, description: 'Très belle paire.', photos: ['https://images1.vinted.net/t/a.jpg', 'https://images1.vinted.net/t/b.jpg'], ...x } } });

  if (A && T) {
    await essaie('A', async () => {
      console.log('── A. la fiche article neutre : lu, jamais deviné');
      const f = A.ficheArticle(art('vinted#1', '42', [vinted('1')]), lectV('1', 1242));
      dit(f.champs.categorie && f.champs.categorie.v === 'chaussures/baskets/homme' && f.champs.categorie.de === 'vinted', 'A1 catalog_id 1242 lu ⇒ « chaussures/baskets/homme », lu sur Vinted', f.champs.categorie);
      const f2 = A.ficheArticle(art('vinted#2', '43', [vinted('2', { titre: 'Nike baskets homme Air Max' })]), lectV('2', null));
      dit(f2.champs.categorie === null && f2.manques.includes('categorie'), 'A2 sans catalog_id lu ⇒ catégorie VIDE et demandée (jamais tirée du titre)', f2.champs.categorie);
      const f3 = A.ficheArticle(art('vinted#3', '44', [vinted('3'), { site: 'ebay', id: '77', titre: 'x', etat: 'enligne' }]),
        { ...lectV('3', 2632), ebay: { 77: { categoryName: 'Vêtements, accessoires:Homme : vêtements, accessoires:Homme : chaussures:Baskets', specifics: {} } } });
      dit(f3.champs.categorie === null && Array.isArray(f3.conflits.categorie) && f3.conflits.categorie.length === 2, 'A3 Vinted « femme » et eBay « homme » ⇒ conflit, rien de choisi', f3.conflits);
      const f4 = A.ficheArticle(art('leboncoin#9', '45', [{ site: 'leboncoin', id: '9', titre: 'Sac', photo: 'https://img.leboncoin.fr/a.jpg', etat: 'enligne' }]), { leboncoin: { 9: { category: 'Accessoires & Bagagerie', body: 'x' } } });
      dit(f4.champs.categorie === null && f4.candidates.length >= 1, 'A4 Leboncoin « Accessoires & Bagagerie » (une seule candidate connue) ⇒ PAS sûre, proposée', { cat: f4.champs.categorie, c: f4.candidates });
      dit(f.champs.pointure && f.champs.pointure.v === '42,5', 'A5 pointure « 42.5 » ⇒ « 42,5 » EU, jamais convertie', f.champs.pointure);
      const f5 = A.ficheArticle(art('vinted#5', '46', [vinted('5', { taille: 'US 9' })]), lectV('5', 1242));
      dit(f5.champs.pointure === null && f5.champs.taille && f5.champs.taille.v === 'US 9', 'A5b une taille US n’est pas une pointure EU : gardée telle quelle, pointure demandée', { p: f5.champs.pointure, t: f5.champs.taille });
      // 50 articles identiques : la réponse donnée pour l'un ne vaut pas pour les autres (§5).
      const cinquante = Array.from({ length: 50 }, (_, i) => art('leboncoin#' + (100 + i), String(100 + i), [{ site: 'leboncoin', id: String(100 + i), titre: 'Baskets Nike', photo: 'https://img.leboncoin.fr/a.jpg', etat: 'enligne' }]));
      const lect50 = { leboncoin: Object.fromEntries(cinquante.map((a) => [a.annonces[0].id, { category: 'Chaussures', body: 'x' }])) };
      const m = A.retenirReponses(null, A.ficheArticle(cinquante[7], lect50), [{ champ: 'categorie', valeur: 'chaussures/course/homme' }]);
      const fs50 = cinquante.map((a) => A.ficheArticle(a, lect50, m));
      dit(fs50.filter((x) => x.champs.categorie).length === 1 && fs50[7].champs.categorie.v === 'chaussures/course/homme', 'A6 50 articles identiques : la réponse ne vaut que pour SON article (1 sur 50)', fs50.filter((x) => x.champs.categorie).length);
    });

    await essaie('B', async () => {
      console.log('── B. les tables, dans les deux sens');
      const bij = T.CLES_VRM.every((k) => { const r = T.depuisVinted(T.CATEGORIES_VRM[k].vinted); return r && r.cle === k; });
      dit(bij && new Set(T.CLES_VRM.map((k) => T.CATEGORIES_VRM[k].vinted)).size === T.CLES_VRM.length, 'B1 Vinted ⇄ VRM : une catégorie VRM par catalog_id, et retour', T.CLES_VRM.length);
      const hors = [];
      for (const k of T.CLES_VRM) { const r = T.vcDepuisVrm(k); if (r.hors) continue; const v = r.valeurs; if (v.univers && !T.choixVc('univers').includes(v.univers)) hors.push(k); if (v.categorie && !T.choixVc('categorie', v).includes(v.categorie)) hors.push(k); if (v.sous && !T.choixVc('sous', v).includes(v.sous)) hors.push(k); }
      dit(!hors.length, 'B2 Vestiaire : chaque valeur sortante existe dans le catalogue de dépôt', hors);
      dit(T.vcDepuisVrm('livres/manuel-scolaire/').hors && T.vcDepuisVrm('jouets/pate-a-modeler/').hors, 'B2b livre, jouet ⇒ Vestiaire ne vend pas ça');
      dit(T.depuisEbay('Vêtements, accessoires:Femme : chaussures:Baskets').horsTable && T.depuisEbay('Vêtements, accessoires:Homme : vêtements, accessoires:Homme : chaussures:Baskets').cle === 'chaussures/baskets/homme', 'B3 eBay entrant : seulement un chemin VU, un autre ⇒ hors table');
      dit(T.marqueVersLbc('salomon', 'chaussures').valeur === 'Salomon' && T.marqueVersLbc('Nike SB', 'chaussures').etat === 'hors-liste', 'B4 Leboncoin : « salomon » ⇒ « Salomon » (liste du site) ; « Nike SB » hors liste (jamais « Autre »)');
      dit(T.marqueVersVc('adidas').valeur === 'Adidas' && T.marqueVersVc('Nike SB').etat === 'hors-liste' && T.marqueVersVc('Marque jamais vue').etat === 'a-lire', 'B5 Vestiaire : « adidas » ⇒ « Adidas » ; « Nike SB » hors liste ; inconnue ⇒ vérifiée par l’extension');
    });

    await essaie('C', async () => {
      console.log('── C. le plan : rien ne part sans catégorie sûre, rien de forcé');
      const sans = A.ficheArticle(art('vinted#20', '20', [vinted('20')]), lectV('20', null));
      const plans = A.SITES_AGENT.map((s) => A.planSite(sans, s, null, {}));
      dit(plans.every((p) => p.etat !== 'pret' && A.envoiPour(sans, p) === null), 'C1 catégorie pas lue ⇒ aucun site prêt, aucun envoi', plans.map((p) => p.site + ':' + p.etat));
      const sb = A.ficheArticle(art('vinted#21', '21', [vinted('21', { marque: 'Nike SB' })]), lectV('21', 1242));
      const pl = A.planSite(sb, 'leboncoin', null, {});
      const e = A.envoiPour(sb, pl);
      dit(pl.valeurs.marque === undefined && pl.questions.some((q) => q.champ === 'marque' && !q.bloque) && e && !('marque' in e.msg.fiche.criteres), 'C2 marque hors liste Leboncoin : jamais posée (demandée, facultative)', { v: pl.valeurs.marque, crit: e && e.msg.fiche.criteres });
      const vc = A.planSite(sb, 'vestiaire', null, {});
      dit(vc.etat === 'refus' && vc.refus.code === 'marque-hors-liste' && A.envoiPour(sb, vc) === null, 'C2b marque hors liste Vestiaire ⇒ « pas vendable ici », rien ne part', { e: vc.etat, r: vc.refus });
      const ok = A.ficheArticle(art('vinted#22', '22', [vinted('22')]), lectV('22', 1242));
      const p2 = A.planSite(ok, 'leboncoin', null, {});
      const e2 = A.envoiPour(ok, p2);
      dit(p2.etat === 'pret' && e2 && e2.msg.cmd === 'publierFiche' && e2.msg.fiche.categorie === 'Chaussures' && e2.msg.fiche.criteres.univers === 'Homme' && e2.msg.fiche.criteres.type === 'Baskets & Sneakers' && e2.msg.fiche.criteres.taille === '42,5' && /VRM-22(?!\d)/.test(e2.msg.fiche.description) && e2.msg.fiche.titre.length <= 50,
        'C3 prêt ⇒ l’extension reçoit catégorie, univers, type, pointure, « VRM-22 », titre ≤ 50', e2 && e2.msg.fiche);
      const lb = A.ficheArticle(art('leboncoin#30', '30', [{ site: 'leboncoin', id: '30', titre: 'Baskets', photo: 'https://img.leboncoin.fr/a.jpg', etat: 'enligne' }]), { leboncoin: { 30: { category: 'Chaussures', body: 'x' } } });
      const ps = A.SITES_AGENT.map((s) => A.planSite(lb, s, null, {}));
      const q = A.questionsArticle(lb, ps).questions;
      dit(q.filter((x) => x.champ === 'categorie').length === 1 && q.some((x) => x.champ === 'pointure') && q.some((x) => x.champ === 'etat'), 'C4 UNE question groupée : la catégorie une fois pour 3 sites, avec l’état et la pointure', q.map((x) => x.site + ':' + x.champ));
      dit(A.planSite(A.ficheArticle(art('vinted#23', '', [vinted('23')]), lectV('23', 1242)), 'leboncoin', null, {}).refus.code === 'sans-numero'
        && A.planSite(ok, 'leboncoin', null, { ext: { leboncoin: false } }).refus.code === 'extension' && A.planSite(ok, 'leboncoin', null, { deja: { leboncoin: true } }).etat === 'deja', 'C5 sans N° ⇒ refus ; extension trop vieille ⇒ refus ; déjà sur le site ⇒ pas reproposé');
    });

    await essaie('D', async () => {
      console.log('── D. ses réponses, retenues, dans la liste du site');
      const f = A.ficheArticle(art('vinted#40', '40', [vinted('40')]), lectV('40', 1453));     // course homme : Vestiaire n'a pas de « course »
      const p = A.planSite(f, 'vestiaire', null, {});
      dit(p.etat === 'question' && p.questions.some((q) => q.champ === 'sous' && q.choix.includes('Baskets')), 'D1 Vestiaire « course » ⇒ la sous-catégorie se demande parmi la liste du site', p.questions.map((q) => q.champ));
      const m = A.retenirReponses(null, f, [{ site: 'vestiaire', champ: 'sous', valeur: 'Baskets' }]);
      const g = A.ficheArticle(art('vinted#41', '41', [vinted('41')]), lectV('41', 1453), m);
      const pg = A.planSite(g, 'vestiaire', m, {});
      dit(pg.etat === 'pret' && pg.valeurs.sous === 'Baskets' && pg.origine.sous === 'memoire', 'D2 la réponse est retenue pour la catégorie : l’article suivant part seul', { e: pg.etat, o: pg.origine });
      const m2 = A.retenirReponses(null, f, [{ site: 'vestiaire', champ: 'sous', valeur: 'Running' }]);
      dit(!(m2.cat['chaussures/course/homme'] && m2.cat['chaussures/course/homme'].vestiaire && m2.cat['chaussures/course/homme'].vestiaire.sous), 'D3 une réponse hors de la liste du site n’est jamais retenue', m2.cat);
      const sb = A.ficheArticle(art('vinted#42', '42', [vinted('42', { marque: 'Nike SB' })]), lectV('42', 1242));
      const m3 = A.retenirReponses(null, sb, [{ site: 'vestiaire', champ: 'marque', valeur: 'Nike' }]);
      const sb2 = A.ficheArticle(art('vinted#43', '43', [vinted('43', { marque: 'Nike SB' })]), lectV('43', 1242), m3);
      const p3 = A.planSite(sb2, 'vestiaire', m3, {});
      dit(p3.etat === 'pret' && p3.valeurs.marque === 'Nike' && p3.origine.marque === 'memoire', 'D4 « Nike SB » ⇒ SA réponse « Nike » (de la liste) retenue par marque', { e: p3.etat, v: p3.valeurs.marque });
      const m4 = A.retenirReponses(null, sb, [{ site: 'leboncoin', champ: 'marque', valeur: 'Nike SB Pro inventée' }]);
      dit(!Object.keys(m4.marque.leboncoin).length, 'D5 une marque hors des 793 de Leboncoin n’est jamais retenue', m4.marque);
      const f6 = A.ficheArticle(art('leboncoin#44', '44', [{ site: 'leboncoin', id: '44', titre: 'Baskets', photo: 'https://img.leboncoin.fr/a.jpg', etat: 'enligne' }]), { leboncoin: { 44: { category: 'Chaussures', body: 'x' } } });
      const m6 = A.retenirReponses(null, f6, [{ champ: 'categorie', valeur: 'chaussures/baskets/femme' }, { champ: 'etat', valeur: 'Bon état' }, { champ: 'pointure', valeur: '39' }]);
      const g6 = A.ficheArticle(f6.cle ? art('leboncoin#44', '44', [{ site: 'leboncoin', id: '44', titre: 'Baskets', photo: 'https://img.leboncoin.fr/a.jpg', etat: 'enligne' }]) : null, { leboncoin: { 44: { category: 'Chaussures', body: 'x' } } }, m6);
      dit(g6.champs.categorie && g6.champs.categorie.de === 'reponse' && g6.champs.etat.v === 'Bon état' && g6.champs.pointure.v === '39' && A.planSite(g6, 'leboncoin', m6, {}).etat === 'pret', 'D6 un champ pas lu se demande UNE fois : sa réponse remplit la fiche et l’article part', g6.champs);
    });

    await essaie('E', async () => {
      console.log('── E. la relecture : la catégorie enregistrée par le site');
      const env = { site: 'leboncoin', numero: '42', voulu: { categorie: 'Chaussures' }, at: 1 };
      dit(A.relireEnvoi(env, { leboncoin: { 9: { id: 9, ref: 'Réf. VRM-42', body: '… Réf. VRM-42', category: 'Chaussures' } } }).etat === 'ok', 'E1 Leboncoin a enregistré « Chaussures » ⇒ conforme');
      dit(A.relireEnvoi(env, { leboncoin: { 9: { id: 9, body: 'Réf. VRM-42', category: 'Vêtements' } } }).etat === 'ecart', 'E2 Leboncoin a enregistré « Vêtements » ⇒ écart dit');
      dit(A.relireEnvoi(env, { leboncoin: { 9: { id: 9, body: 'Réf. VRM-420', category: 'Chaussures' } } }).etat === 'pas-encore' && A.relireEnvoi(env, { leboncoin: null }).etat === 'pas-su', 'E3 « VRM-420 » n’est pas le 42 ; liste pas lue ⇒ « pas su », jamais « conforme »');
      dit(A.relireEnvoi({ site: 'ebay', numero: '42', voulu: { id: '15709' } }, { ebay: [{ itemId: '1', sku: 'VRM-42', detail: { categoryId: '95672' } }] }).etat === 'ecart', 'E4 eBay : catégorie enregistrée différente ⇒ écart');
      dit(A.relireEnvoi({ site: 'vestiaire', numero: '42', voulu: {} }, {}).etat === 'non-relisible', 'E5 Vestiaire (catégorie absente de ses annonces lues) ⇒ « posée, pas relue », jamais « conforme »');
    });

    await essaie('F', async () => {
      console.log('── F. la couverture du stock');
      const fs1 = [A.ficheArticle(art('vinted#50', '50', [vinted('50')]), lectV('50', 1242)), A.ficheArticle(art('vinted#51', '51', [vinted('51')]), lectV('51', 1242)),
        A.ficheArticle(art('vinted#52', '52', [vinted('52')]), lectV('52', 5426)), A.ficheArticle(art('vinted#53', '53', [vinted('53')]), lectV('53', null))];
      const c = A.couverture(fs1, null);
      const b = c.lignes.find((x) => x.cle === 'chaussures/baskets/homme'); const l = c.lignes.find((x) => x.cle === 'livres/manuel-scolaire/');
      dit(b && b.n === 2 && b.sites.leboncoin === 'sure' && b.sites.vestiaire === 'sure' && b.sites.ebay === 'demander' && l && l.sites.vestiaire === 'impossible' && c.sansCategorie === 1, 'F1 baskets homme : 2, sûre/sûre/à demander ; livre : Vestiaire impossible ; 1 sans catégorie', c);
      const m = A.retenirReponses(null, fs1[0], [{ site: 'ebay', champ: 'categorieEbay', valeur: { id: '15709', nom: 'Baskets', chemin: 'Homme > Baskets' } }]);
      dit(A.couverture(fs1, m).lignes.find((x) => x.cle === 'chaussures/baskets/homme').sites.ebay === 'sure', 'F2 une fois la catégorie eBay choisie, elle devient sûre');
    });
  }

  // ── G. LE VRAI background.js ────────────────────────────────────────────
  await essaie('G', async () => {
    console.log('── G. l’extension (vrai background.js) : tout revérifié, rien de forcé');
    const tmp = path.join(os.tmpdir(), 'audit-publier-agent-bg-' + process.pid + '.js');
    fs.writeFileSync(tmp, src.bg);
    const { faireFond } = require('./_fond-vm.cjs');
    const catVc = { data: [{ id: '1', title: 'Mode homme', categories: [{ id: '3', title: 'Chaussures', subCategories: [{ id: '64', title: 'Baskets' }] }] }] };
    const marques = { data: [{ id: '9', name: 'Nike', banned: false }, { id: '10', name: 'Marque Bannie', banned: true }] };
    const lignes = { vc_catalogue: { deposit_catalog: { corps: JSON.stringify(catVc) }, deposit_brands: { corps: JSON.stringify(marques) } } };
    const ficheL = { numero: '42', titre: 'Nike Air Max 90 T42,5', description: 'Belle paire.\n\nRéf. VRM-42', prix: 80, photos: ['https://images1.vinted.net/t/a.jpg'], etat: 'Très bon état', categorie: 'Chaussures', criteres: { univers: 'Homme', type: 'Baskets & Sneakers' } };
    const ficheV = { numero: '43', titre: 'Nike Air Max', description: 'Réf. VRM-43', prix: 90, photos: ['https://img.leboncoin.fr/x.jpg'], etat: 'Très bon état', marque: 'Nike', taille: '43', categorie: { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Baskets' } };
    const b = faireFond({ src: tmp, lignes: JSON.parse(JSON.stringify(lignes)), onglets: [{ id: 7, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }, { id: 8, url: 'https://fr.vestiairecollective.com/', status: 'complete' }] });
    const c = b.ctx;
    dit(typeof c.ficheAgentValide === 'function' && typeof c.publierFicheSite === 'function' && typeof c.marqueVcListee === 'function', 'G0 publierFicheSite, ficheAgentValide, marqueVcListee existent');
    const v1 = c.ficheAgentValide({ ...ficheL, categorie: '' }, 'leboncoin', null);
    const v2 = c.ficheAgentValide({ ...ficheL, categorie: 'Voitures' }, 'leboncoin', null);
    const v3 = c.ficheAgentValide({ ...ficheL, description: 'Belle paire. VRM-420' }, 'leboncoin', null);
    const v4 = c.ficheAgentValide({ ...ficheL, photos: ['https://exemple.invalid/a.jpg'] }, 'leboncoin', null);
    const v5 = c.ficheAgentValide(ficheL, 'leboncoin', null);
    dit(!v1.ok && v1.code === 'categorie' && !v2.ok && !v3.ok && v3.code === 'reference' && !v4.ok && v4.code === 'photos' && v5.ok && v5.ad.category === 'Chaussures' && v5.ad.criteres.univers === 'Homme',
      'G1 Leboncoin : sans catégorie, catégorie inconnue, sans « VRM-42 », photo d’un site inconnu ⇒ refusé ; fiche entière ⇒ acceptée', [v1.code, v2.code, v3.code, v4.code, v5.ok]);
    const w1 = c.ficheAgentValide({ ...ficheV, categorie: { univers: 'Mode homme', categorie: 'Chaussures', sous: 'Running' } }, 'vestiaire', catVc);
    const w2 = c.ficheAgentValide(ficheV, 'vestiaire', catVc);
    dit(!w1.ok && w1.code === 'categorie' && w2.ok && w2.ad.vcCategorie.ids.sous === '64', 'G2 Vestiaire : une sous-catégorie absente du catalogue capté ⇒ refusée ; exacte ⇒ ses ids', [w1.code, w2.ok]);
    const l1 = c.marqueVcListee('nike', marques), l2 = c.marqueVcListee('Nike SB', marques), l3 = c.marqueVcListee('marque bannie', marques), l4 = c.marqueVcListee('Nike', null);
    dit(l1.etat === 'listee' && l1.valeur === 'Nike' && l2.etat === 'absente' && l3.etat === 'bannie' && l4.etat === 'pas-su', 'G3 marque Vestiaire : listée (libellé exact) · absente · bannie · liste pas lue', [l1.etat, l2.etat, l3.etat, l4.etat]);
    let crees = 0; c.chrome.tabs.create = async (o) => { crees++; return { id: 100 + crees, url: o.url }; };
    b.store.vrmLbcTransport = { 7: { source: 'prive', compte: 'lbc-account:aaaa1111-0000-0000-0000-000000000001', at: 1 }, 8: { source: 'prive', compte: 'lbc-account:aaaa1111-0000-0000-0000-000000000002', at: 2 } };
    b.onglets = undefined;
    c.chrome.tabs.get = async (id) => ({ id, url: id === 8 || id === 7 ? 'https://www.leboncoin.fr/compte/part/mes-annonces' : 'https://fr.vestiairecollective.com/' });
    const r1 = await c.publierFicheSite({ cmd: 'publierFiche', site: 'leboncoin', fiche: ficheL });
    dit(r1 && r1.accepte === false && r1.code === 'deux-comptes' && crees === 0 && !b.store.vrmPendingAd, 'G4 deux comptes Leboncoin ouverts ⇒ rien ne part (aucun onglet, aucun dépôt)', r1);
    b.store.vrmLbcTransport = { 7: { source: 'prive', compte: 'lbc-account:aaaa1111-0000-0000-0000-000000000001', at: 1 } };
    const r2 = await c.publierFicheSite({ cmd: 'publierFiche', site: 'leboncoin', fiche: ficheL });
    dit(r2 && r2.accepte === true && crees === 1 && b.store.vrmPendingAd && b.store.vrmPendingAd.ad.category === 'Chaussures' && b.store.vrmPendingAd.ad.publier === true, 'G5 un seul compte ⇒ dépôt ouvert, catégorie et critères portés', r2);
    const r3 = await c.publierFicheSite({ cmd: 'publierFiche', site: 'leboncoin', fiche: { ...ficheL, numero: '44', description: 'Réf. VRM-44' } });
    dit(r3 && r3.accepte === false && r3.code === 'en-cours' && crees === 1, 'G6 un dépôt à la fois : le second attend la fin du premier', r3);
    b.store.vrmVcOnglets = { 8: { compte: '12345', at: Date.now() } };
    c.chrome.tabs.query = async () => [{ id: 8, url: 'https://fr.vestiairecollective.com/', active: true }];
    const r4 = await c.publierFicheSite({ cmd: 'publierFiche', site: 'vestiaire', fiche: { ...ficheV, marque: 'Nike SB' } });
    dit(r4 && r4.accepte === false && r4.code === 'marque-hors-liste' && crees === 1 && !b.store.vrmPendingVc, 'G7 Vestiaire : marque absente de SA liste ⇒ pas vendable ici, rien ne part', r4);
    const r5 = await c.publierFicheSite({ cmd: 'publierFiche', site: 'vestiaire', fiche: ficheV });
    dit(r5 && r5.accepte === true && b.store.vrmPendingVc && b.store.vrmPendingVc.ad.marque === 'Nike' && b.store.vrmPendingVc.ad.vcCategorie.sous === 'Baskets', 'G8 Vestiaire : marque listée, catégorie exacte ⇒ préparation ouverte', r5);
    try { fs.unlinkSync(tmp); } catch (_) {}
  });

  await essaie('H', async () => {
    console.log('── H. le câblage');
    dit(/\n\s*'vrm_agent_publier',/.test(src.app || ''), 'H1 `vrm_agent_publier` est synchronisée (SYNC_KEYS)');
    dit(/publierfiche: '5\.409\.0'/.test(src.app || ''), 'H2 capacité `publierfiche` = 5.409.0 (EXT_CAPACITES)');
    dit(/msg\.cmd === 'publierFiche'\) return await publierFicheSite\(msg\)/.test(src.bg || ''), 'H3 l’extension reçoit la commande `publierFiche`');
    dit(/cle: 'agent'/.test(src.annonces || '') && /setAgent\(choisis\)/.test(src.annonces || ''), 'H4 Annonces → Actions → « Publier sur… »');
    dit(/vmrCmd\(e\.msg/.test(src.ecran || '') && /attendreFin\(r\.jobId\)/.test(src.ecran || '') && /extSait\('publierfiche'\)/.test(src.ecran || ''), 'H5 l’écran envoie par l’extension, un dépôt après l’autre, seulement à une extension qui sait');
    const langues = ['fr', 'en', 'es', 'it', 'de'].map((l) => { const p = path.join(RACINE, 'src', 'i18n', 'langues', l, 'publierAgent.js'); return fs.existsSync(p) ? (fs.readFileSync(p, 'utf8').match(/"agent\.[^"]+"/g) || []).length : 0; });
    dit(langues.every((x) => x === langues[0] && x > 50), 'H6 les textes existent dans les 5 langues, les mêmes clés', langues);
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-publier-agent : ${n - ko} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
