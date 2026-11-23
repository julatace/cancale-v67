// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA PARITÉ ENTRE LES SITES (19 nov. 2026)
//
//  Julien : « je veux que tout soit comme Vinted […] Ce n'est pas parce que Vinted est ma
//  plateforme principale que c'est la plateforme principale des autres. »
//
//  Base INVENTÉE : un vendeur « Leboncoin seul », un « eBay seul », un « Vestiaire seul », un
//  « Vinted + les trois ». On EXÉCUTE src/articles/ (modele, numerosSites, sources) avec le
//  VRAI `prochainLibre` d'App.jsx et le VRAI `appliquerOp` (src/gesteAnnulable.js) :
//   P1  le tableau de parité : chaque information / geste existe pour chaque site, ou son absence
//       est une limite du SITE, listée (`LIMITES`) — et rien d'autre n'est « non » ;
//   P2  pour chaque vendeur, chaque annonce est UN article qui porte les mêmes faits que Vinted
//       (N°, prix, prix mini, acheté, achat relié, bénéfice, place, depuis, favoris, état) ;
//   P3  le N° d'une annonce sans Vinted : `prochainLibre` (après le plus haut, jamais un N° du
//       pool, jamais un ancien N°) ; vendeur avec Vinted ⇒ « à relier », aucun N° neuf seul ;
//       « je numérote moi-même », « à confirmer », pas su ⇒ aucun ;
//   P4  50 annonces Leboncoin au MÊME titre ⇒ 50 articles, 50 N°, chacune SON achat ;
//   P5  prix d'achat et prix mini écrits puis relus PAR IDENTITÉ (l'identifiant de l'annonce) ;
//   P6  le lien posé plus tard avec Vinted ⇒ UN article, aucun fait perdu, aucun N° en double ;
//       deux N° en jeu, ou deux prix d'achat différents ⇒ une QUESTION, aucune opération ;
//   P7  une lecture ratée (carte `null`) ⇒ aucune opération, nulle part ;
//   P8  deux annonces du même compte sous un N° ⇒ doublon signalé (le seul rouge) ;
//   P9  filtres par site et par état, comptes ;
//   P10 le branchement : `numEbayLu` lit le N° propre d'une annonce eBay, la clé est synchronisée.
//  `--mutation=<nom>|toutes` : chaque règle affaiblie doit rougir. ⚠️ Ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
try { require('./_source-app.cjs').brancher(); } catch (_) {}
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE0 = path.join(__dirname, '..');
const SRC = (process.argv.find((a) => a.startsWith('--src=')) || '').slice(6) || path.join(RACINE0, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  titre: ['articles/modele.js', "const k = cle(numDe(a)); if (k) cles.push('n#' + k);", "const k = cle(numDe(a)); if (k) cles.push('n#' + k); cles.push('t#' + String(a.titre));"],
  pasSuFait: ['articles/modele.js', "  if (!faits) return { refus: 'pas-su' };\n  const k = article.porteur.cle", "  const k = article.porteur.cle"],
  pasSuFiche: ['articles/modele.js', "    if (!fiches || !parNum) return { refus: 'pas-su' };", "    if (!fiches) return { ops: [] };"],
  deuxNumeros: ['articles/modele.js', "if (deuxNumeros && !['vinted', 'site'].includes(choix.numero)) questions.push(", "if (false) questions.push("],
  conflit: ['articles/modele.js', "else if (choix[c] !== 'fiche') questions.push(", "else if (false) questions.push("],
  perte: ['articles/modele.js', "if (!rempli(a)) { patch[c] = b; continue; }", "if (!rempli(a)) { continue; }"],
  identiteFait: ['articles/modele.js', "export const cleSite = (site, id) => `${NOM_SITE[site] || site}:${String(id)}`;", "export const cleSite = (site, id) => `${NOM_SITE[site] || site}:x`;"],
  aRelier: ['articles/numerosSites.js', "if (a.propre || aVinted === false) {", "if (a.propre || aVinted !== null) {"],
  moi: ['articles/numerosSites.js', "if (mode !== 'vrm') {", "if (false) {"],
  pasEnLigne: ['articles/numerosSites.js', "if (a.etat !== 'enligne') {", "if (false) {"],
  dejaNumerotee: ['articles/numerosSites.js', "if (cle(a.numero || '') || String(a.vintedId || '').trim()) continue;", ""],
  servi: ['articles/numerosSites.js', "if (!cle(n) || servis.has(cle(n))) return", "if (!cle(n)) return"],
  pasSuNumero: ['articles/numerosSites.js', "if (!L.leboncoin || !L.ebay || !F || typeof prochainLibre", "if (typeof prochainLibre"],
  renumerote: ['articles/numerosSites.js', "if (deja != null && (typeof deja !== 'object' ? String(deja).trim() : (deja.pairId || deja.numero))) continue;", ""],
  limite: ['articles/modele.js', "  vestiaire: ['depuis', 'vues', 'messages', 'offreAuto'],", "  vestiaire: ['vues', 'messages', 'offreAuto'],"],
  doublon: ['articles/modele.js', "const doublon = [...parSiteCompte.values()].some((n) => n > 1);", "const doublon = false;"],
  miroir: ['articles/modele.js', "if (achat == null && k && !doublon && rempli(", "if (achat == null && k && rempli("],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-parite-'));
    fs.mkdirSync(path.join(t, 'articles'), { recursive: true });
    for (const f of ['beneficePaire.js', 'gesteAnnulable.js', 'articles/modele.js', 'articles/numerosSites.js', 'articles/sources.js']) fs.copyFileSync(path.join(SRC, f), path.join(t, f));
    fs.writeFileSync(path.join(t, 'package.json'), '{"type":"module"}');
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src=' + t, '--sans-branchement'], { encoding: 'utf8', timeout: 120000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(attrapees === noms.length ? `\n✅ ${attrapees}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === noms.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); return !!c; };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.message) || e).slice(0, 300)); return undefined; } };
const charger = (f) => import(pathToFileURL(path.join(SRC, f)).href);
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

(async () => {
  const M = await essaie('src/articles/modele.js se charge', () => charger('articles/modele.js'));
  const N = await essaie('src/articles/numerosSites.js se charge', () => charger('articles/numerosSites.js'));
  const S = await essaie('src/articles/sources.js se charge', () => charger('articles/sources.js'));
  const G = await essaie('src/gesteAnnulable.js se charge', () => charger('gesteAnnulable.js'));
  if (!M || !N || !S || !G) { console.log(`\n❌ Parité des sites : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  const APPSRC = fs.readFileSync(path.join(RACINE0, 'src', 'App.jsx'), 'utf8');
  const prochainLibre = await essaie('le VRAI prochainLibre extrait d’App.jsx', () => {
    const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APPSRC);
    if (!x) throw new Error('prochainLibre introuvable');
    return vm.runInNewContext(x[0] + '\n;prochainLibre', {});
  });
  if (!prochainLibre) { console.log(`\n❌ Parité des sites : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // Une base en mémoire : les clés synchronisées, et le VRAI `appliquerOp` pour jouer les opérations.
  const base = (o = {}) => ({ vinted_annonce_numeros: {}, vrm_articles_sites: {}, vinted_buyprice_by_num: {}, vrm_lbc_liens: {}, vrm_ebay_liens: {}, vrm_slots: {}, vinted_used_numeros: [], ...o });
  const jouer = (B, ops) => { for (const op of ops || []) B[op.k] = G.appliquerOp(B[op.k], op, 'apres'); return B; };
  const cartes = (B) => ({ fiches: B.vinted_annonce_numeros, faits: B.vrm_articles_sites, parNum: B.vinted_buyprice_by_num, lbc: B.vrm_lbc_liens, ebay: B.vrm_ebay_liens });
  const HIER = Date.now() - 86400e3;
  // Les lectures brutes de chaque site, telles que l'app les a (formes des lignes `lbc_listings`, `ebay_listings`, `vc_listings`).
  const adLbc = (id, o = {}) => ({ id: String(id), subject: 'Nike Air Max 90 blanche 42', price: 60, images: ['https://img.example/l' + id + '.jpg'], status: 'active', account: 'c1', accountName: 'atelier-nord', publieeLe: new Date(HIER - Number(String(id).slice(-2)) * 3600e3).toISOString(), stats: { favoris: 3, vues: 40, messages: 1 }, url: 'https://www.leboncoin.fr/ad/' + id, ...o });
  const itEbay = (id, o = {}) => ({ itemId: String(id), title: 'Adidas Samba OG 43', price: 75, currency: 'EUR', photo: 'https://img.example/e' + id + '.jpg', sku: '', depuis: new Date(HIER).toISOString(), vues: 12, observateurs: 2, qty: 1, vendus: 0, _compte: 'principal', _pseudo: 'atelier-ebay', url: 'https://www.ebay.fr/itm/' + id, ...o });
  const itVc = (o = {}) => ({ titre: 'Sac Longchamp Pliage', prix: { valeur: 120, devise: 'EUR' }, photo: 'https://img.example/v.jpg', statut: 'ONLINE', compte: 'atelier-vc', favoris: 4, misEnLigne: '2026-11-01T10:00:00.000Z', vueDepuis: '2026-11-02T10:00:00.000Z', ...o });
  const itVinted = (id, o = {}) => ({ id: String(id), title: 'New Balance 550 blanche 41', price: 55, photo: 'https://img.example/t' + id + '.jpg', size: '41', condition: 'Très bon état', favourites: 6, views: 80, createdTs: Math.round(HIER / 1000), ...o });
  // Les adaptateurs, avec les règles d'identité de l'app passées en fonctions (ici : les cartes de la base inventée).
  const lire = (B, { lbc = {}, ebay = [], vc = {}, vinted = null, propres = new Set() } = {}) => {
    const numEbay = (x) => { const l = B.vrm_ebay_liens[String(x.itemId)]; if (l && l.pairId) return String((B.vinted_annonce_numeros[l.pairId] || {}).numero || ''); if (l && l.propre) return String(l.numero || ''); const m = /^VRM-(\w+)$/.exec(String(x.sku || '')); return m ? m[1] : ''; };
    const a = [
      ...S.annoncesVinted(vinted || []),
      ...S.annoncesLeboncoin(lbc, { etatDe: (ad) => (ad.status === 'active' ? (ad._vieux ? 'aconfirmer' : 'active') : ad.status === 'vendue' ? 'vendue' : 'autre'), numeroDe: (ad) => String(B.vrm_lbc_liens[String(ad.id)] || ad.ref || ''), propreDe: (ad) => propres.has('leboncoin#' + ad.id) }),
      ...S.annoncesEbay(ebay, { numeroDe: numEbay, vintedDe: (x) => { const l = B.vrm_ebay_liens[String(x.itemId)]; return l && l.pairId ? String(l.pairId) : ''; }, propreDe: (x) => propres.has('ebay#' + x.itemId) }),
      ...S.annoncesVestiaire(vc, { etatDe: (id, it) => (it.statut === 'ONLINE' ? 'en-ligne' : it.statut === 'SOLD' ? 'vendue' : 'retiree'), numeroDe: (id, it) => String(it._num || '') }),
    ];
    return a;
  };
  const articles = (B, lu, aVinted) => M.construireArticles({ annonces: lu, fiches: B.vinted_annonce_numeros, faits: B.vrm_articles_sites, achatsParNum: B.vinted_buyprice_by_num, slots: B.vrm_slots, cle: cleNum, aVinted });
  const numeroter = (B, lu, { mode = 'vrm', aVinted = false, pref = '' } = {}) => {
    const c = N.annoncesSitesANumeroter({ annonces: lu, mode, aVinted, cle: cleNum });
    const pris = new Set(), prisK = new Set();
    const add = (v) => { const k = cleNum(v); if (!k) return; prisK.add(k); if (/^\d+$/.test(k)) pris.add(Number(k)); };
    B.vinted_used_numeros.forEach(add); Object.values(B.vinted_annonce_numeros).forEach((f) => add(f && f.numero)); Object.values(B.vrm_lbc_liens).forEach(add); Object.values(B.vrm_ebay_liens).forEach((l) => add(l && l.numero));
    const r = N.attribuerNumerosSites({ ids: c.ids, pris, prisCles: prisK, pref, prochainLibre, cle: cleNum, cartes: cartes(B) });
    if (r.ops) { jouer(B, r.ops); for (const x of r.nouveaux) B.vinted_used_numeros.push(x.numero); }
    return { ...c, ...r };
  };

  // ── P1 ──────────────────────────────────────────────────────────────────
  console.log('— P1. Le tableau de parité');
  await essaie('P1', () => {
    const INFOS = ['numero', 'place', 'prix', 'prixMini', 'achat', 'achatRelie', 'benefice', 'depuis', 'favoris', 'vues', 'messages', 'etat', 'fiche', 'baisserPrix', 'offreAuto', 'completer'];
    dit(INFOS.every((i) => M.PARITE[i] && M.SITES.every((s) => ['oui', 'lecture', 'extension', 'api', 'non'].includes(M.PARITE[i][s]))), 'chaque information / geste a une réponse pour les 4 sites', Object.keys(M.PARITE));
    const non = []; for (const i of Object.keys(M.PARITE)) for (const s of M.SITES) if (M.PARITE[i][s] === 'non') non.push(s + ':' + i);
    const lim = []; for (const s of M.SITES) for (const l of M.LIMITES[s]) lim.push(s + ':' + l);
    dit(JSON.stringify(non.sort()) === JSON.stringify(lim.sort()), 'chaque « non » est une limite du site LISTÉE, et rien d’autre n’est listé', { non, lim });
    dit(['numero', 'place', 'prixMini', 'achat', 'achatRelie', 'benefice', 'fiche', 'completer', 'etat'].every((i) => M.SITES.every((s) => M.PARITE[i][s] === 'oui')), 'N°, place, prix mini, acheté, achat relié, bénéfice, fiche, « Compléter » : « oui » pour TOUS les sites (rien ne dépend de Vinted)');
    dit(M.SITES.every((s) => M.PARITE.baisserPrix[s] !== 'non'), '« Baisser le prix » existe pour les 4 sites (extension ou API)');
    dit(M.limitesDe(['leboncoin']).length === M.LIMITES.leboncoin.length && M.limitesDe(['vinted']).length === 0, 'les limites sont dites pour les sites MONTRÉS seulement');
  });

  // ── P2 / P3 / P5 : un vendeur par site ────────────────────────────────────
  const FAITS = ['numero', 'prix', 'prixMini', 'achat', 'achatRelie', 'benefice', 'place', 'depuis', 'favoris', 'etat', 'titre', 'photo'];
  const vendeurSeul = async (nom, site, source) => {
    console.log(`— P2/P3/P5. Vendeur « ${nom} seul »`);
    await essaie(nom, () => {
      const B = base({ vinted_used_numeros: [1, 2, 3, 'B7', 40] });
      let lu = lire(B, source);
      const avant = articles(B, lu, false);
      dit(avant.articles.length === 2 && avant.articles.every((a) => a.sansVinted && !a.aRelier), `${nom} : chaque annonce est UN article, rien « à relier » (il n’a pas Vinted)`, avant.articles.map((a) => [a.cle, a.aRelier]));
      if (site !== 'vestiaire') {
        const r = numeroter(B, lu, { aVinted: false });
        dit(r.nouveaux && r.nouveaux.length === 2 && r.nouveaux.map((x) => x.numero).join() === '41,42', `${nom} : chaque annonce reçoit SON N° tout seul — après le plus haut (41, 42), jamais un trou`, r);
        dit(r.nouveaux.every((x) => !['1', '2', '3', '40', 'B7', '7'].includes(cleNum(x.numero))), `${nom} : jamais un N° du pool, jamais un ancien N°`);
        const encore = numeroter(B, lire(B, source), { aVinted: false });
        dit(encore.nouveaux && encore.nouveaux.length === 0, `${nom} : relue, une annonce garde son N° (rien n’est renuméroté)`, encore.nouveaux);
        dit(N.numerosSitesAEcrire(B.vrm_articles_sites).length === 2, `${nom} : les N° donnés sont « à écrire » jusqu’à « C’est écrit »`);
        const ec = N.opsNumeroEcrit({ cles: N.numerosSitesAEcrire(B.vrm_articles_sites).map((x) => x.cle), faits: B.vrm_articles_sites }); jouer(B, ec.ops);
        dit(N.numerosSitesAEcrire(B.vrm_articles_sites).length === 0, `${nom} : « C’est écrit » les sort de la liste`);
      }
      lu = lire(B, source);
      let A = articles(B, lu, false);
      const a0 = A.articles.find((a) => a.annonces[0].id === (site === 'vestiaire' ? 'p1' : '1001'));
      dit(!!a0 && !!a0.numero, `${nom} : l’article porte son N°`, a0 && a0.numero);
      // P5 : écrire prix d'achat, achat relié, prix mini, seuil de refus — puis relire par identité.
      const w = M.opsFait({ article: a0, champs: { buyPrice: '31,5', buyFromId: 'achat-77', min: '48', refuse: 30 }, cartes: cartes(B) });
      dit(Array.isArray(w.ops) && w.ops.length === 1 && w.ops[0].k === M.CLE_ARTICLES && w.ops[0].id === M.cleSite(site, a0.annonces[0].id), `${nom} : les faits s’écrivent sous l’IDENTIFIANT de l’annonce de son site (${M.cleSite(site, a0.annonces[0].id)})`, w);
      jouer(B, w.ops);
      B.vrm_slots[cleNum(a0.numero)] = { m: 'm1', i: 4 };
      A = articles(B, lire(B, source), false);
      const a1 = A.articles.find((a) => a.cle === a0.cle), a2 = A.articles.find((a) => a.cle !== a0.cle);
      dit(a1.achat === 31.5 && a1.achatRelie === 'achat-77' && a1.prixMini === 48 && a1.refuse === 30, `${nom} : acheté, achat relié, prix mini, refus RELUS`, [a1.achat, a1.achatRelie, a1.prixMini, a1.refuse]);
      dit(a1.benefice === Math.round((a1.prix - 31.5) * 100) / 100 && a1.place && a1.place.i === 4, `${nom} : bénéfice (prix − achat) et place (par SON N°)`, [a1.benefice, a1.place]);
      dit(a2.achat == null && a2.prixMini == null && a2.benefice == null && a2.beneficeRaison === 'achat', `${nom} : l’AUTRE annonce n’a rien reçu (« — », jamais 0)`, [a2.achat, a2.prixMini, a2.benefice]);
      dit(FAITS.every((f) => Object.prototype.hasOwnProperty.call(a1, f)) && a1.prix > 0 && a1.etat === 'enligne' && !!a1.titre && !!a1.photo, `${nom} : les mêmes champs qu’un article Vinted (${FAITS.length})`);
      const lim = M.limitesDe([site]).map((l) => l.quoi);
      for (const f of ['depuis', 'favoris', 'vues', 'messages']) { const attendu = !lim.includes(f) && M.PARITE[f][site] !== 'non'; if (attendu) dit(a1[f] != null, `${nom} : « ${f} » est lu`, a1[f]); else dit(a1[f] == null, `${nom} : « ${f} » n’existe pas chez ce site ⇒ « — » (limite listée)`, a1[f]); }
      const r0 = M.opsFait({ article: a1, champs: { buyPrice: '' }, cartes: cartes(B) }); jouer(B, r0.ops);
      const A3 = articles(B, lire(B, source), false).articles.find((a) => a.cle === a0.cle);
      dit(A3.achat == null && A3.prixMini === 48, `${nom} : effacer un fait le retire seul (les autres restent)`, [A3.achat, A3.prixMini]);
      dit(M.opsFait({ article: a1, champs: { min: 'abc' }, cartes: cartes(B) }).refus === 'montant', `${nom} : un montant illisible est refusé, rien n’est écrit`);
    });
  };
  await vendeurSeul('Leboncoin', 'leboncoin', { lbc: { 1001: adLbc(1001), 1002: adLbc(1002, { subject: 'Asics Gel Kayano 14' }) } });
  await vendeurSeul('eBay', 'ebay', { ebay: [itEbay(1001), itEbay(1002, { title: 'Puma Suede 42' })] });
  await vendeurSeul('Vestiaire', 'vestiaire', { vc: { p1: itVc({ _num: '5' }), p2: itVc({ titre: 'Veste Sandro 38', _num: '6' }) } });

  // ── Le vendeur « Vinted + les trois » ─────────────────────────────────────
  console.log('— P2/P3/P6. Vendeur « Vinted + Leboncoin + eBay + Vestiaire »');
  await essaie('tout', () => {
    const B = base({ vinted_used_numeros: [10, 11, 12, 57], vinted_annonce_numeros: { 9001: { numero: '12', title: 'New Balance 550 blanche 41', buyPrice: '', min: '' }, 9002: { numero: '11', buyPrice: '20', buyFromId: 'achat-1', min: '40' } },
      vrm_lbc_liens: { 2001: '11' }, vrm_ebay_liens: { 3001: { pairId: '9002', numero: '11' } } });
    const source = { vinted: [{ uid: 'u1', pseudo: 'atelier', ok: true, enLigne: [itVinted(9001), itVinted(9002, { title: 'Nike Dunk Low 44' })], aConfirmer: [], masquees: [] }],
      lbc: { 2001: adLbc(2001, { subject: 'Nike Dunk Low 44', price: 62 }), 2002: adLbc(2002, { subject: 'New Balance 550 blanche 41', price: 58 }) },
      ebay: [itEbay(3001, { title: 'Nike Dunk Low 44', price: 70 })], vc: { p9: itVc({ _num: '11' }) } };
    let lu = lire(B, source);
    let A = articles(B, lu, true);
    const a11 = A.articles.find((a) => cleNum(a.numero) === '11');
    dit(A.articles.length === 3 && a11 && a11.sites.join() === 'vinted,leboncoin,ebay,vestiaire' && a11.annonces.length === 4, 'la même paire sur 4 sites (liens posés, même N°) = UN article, 4 annonces', A.articles.map((a) => [a.numero, a.sites]));
    dit(a11.achat === 20 && a11.achatRelie === 'achat-1' && a11.prixMini === 40 && a11.porteur.type === 'fiche', '… mêmes N°, achat et prix mini (la fiche Vinted), prix PAR SITE', [a11.achat, a11.prixMini, a11.annonces.map((x) => x.prix)]);
    dit(a11.annonces.map((x) => x.prix).join() === '55,62,70,120', '… chaque annonce garde SON prix');
    const seule = A.articles.find((a) => a.cle === 'leboncoin#2002');
    dit(seule && seule.aRelier && !seule.numero, 'une annonce Leboncoin sans lien chez un vendeur qui a Vinted : « à relier », pas de N° inventé', seule);
    const r = numeroter(B, lu, { aVinted: true });
    dit(r.nouveaux.length === 0 && r.attendent.some((x) => x.id === '2002' && x.raison === 'a-relier'), '… AUCUN N° neuf seul (la paire a peut-être déjà son carton) : elle attend SON toucher', r);
    const pasSu = N.annoncesSitesANumeroter({ annonces: lu, aVinted: null, cle: cleNum });
    dit(pasSu.ids.length === 0 && pasSu.attendent.some((x) => x.raison === 'pas-su'), '… « a-t-il Vinted ? » pas su ⇒ aucun N° neuf');
    // « Elle n'est pas sur Vinted » (déclarée propre) ⇒ son N° lui est donné tout seul.
    const luP = lire(B, { ...source, propres: new Set(['leboncoin#2002']) });
    const rp = numeroter(B, luP, { aVinted: true });
    dit(rp.nouveaux.length === 1 && rp.nouveaux[0].numero === '58' && B.vrm_lbc_liens['2002'] === '58', '… déclarée « pas sur Vinted » ⇒ N°58 (après le plus haut, 57), posé comme son identité Leboncoin', rp);
    const moi = N.annoncesSitesANumeroter({ annonces: lire(base(), { lbc: { 1: adLbc(1) } }), mode: 'moi', aVinted: false, cle: cleNum });
    dit(moi.ids.length === 0 && moi.attendent[0].raison === 'moi', '« je numérote moi-même » ⇒ aucun N° neuf');
    const vieux = N.annoncesSitesANumeroter({ annonces: lire(base(), { lbc: { 1: adLbc(1, { _vieux: true }) } }), aVinted: false, cle: cleNum });
    dit(vieux.ids.length === 0 && vieux.attendent[0].raison === 'pas-en-ligne', '« à confirmer » (lecture ancienne) ⇒ aucun N° neuf');
    const ref = N.annoncesSitesANumeroter({ annonces: lire(base(), { lbc: { 1: adLbc(1, { ref: '33' }) }, ebay: [itEbay(2, { sku: 'VRM-34' })] }), aVinted: false, cle: cleNum });
    dit(ref.ids.length === 0, 'une annonce qui porte DÉJÀ son N° chez son site (référence VRM, SKU VRM-34) n’en reçoit pas un second', ref);
    const vendue = N.annoncesSitesANumeroter({ annonces: lire(base(), { lbc: { 1: adLbc(1, { status: 'vendue' }) } }), aVinted: false, cle: cleNum });
    dit(vendue.ids.length === 0 && vendue.attendent.length === 0, 'vendue ⇒ aucun N°, rien à attendre');

    // P6 : l'annonce Leboncoin 2002 (N°58, ses faits) est reliée APRÈS à l'annonce Vinted 9001 (N°12, fiche vide).
    lu = lire(B, source);
    const a58 = articles(B, lu, true).articles.find((a) => a.cle === 'leboncoin#2002');
    jouer(B, M.opsFait({ article: a58, champs: { buyPrice: 30, buyFromId: 'achat-9', min: 45 }, cartes: cartes(B) }).ops);
    const poolAvant = JSON.stringify(B.vinted_used_numeros);
    const q = M.opsFusion({ annonce: { site: 'leboncoin', id: '2002' }, numeroSite: '58', ficheId: '9001', cartes: cartes(B), cle: cleNum });
    dit(Array.isArray(q.questions) && q.questions.length === 1 && q.questions[0].champ === 'numero' && !q.ops, 'lien posé ensuite avec Vinted, DEUX N° en jeu (12 et 58) ⇒ une question, AUCUNE opération', q);
    const f = M.opsFusion({ annonce: { site: 'leboncoin', id: '2002' }, numeroSite: '58', ficheId: '9001', cartes: cartes(B), choix: { numero: 'vinted' }, cle: cleNum });
    dit(Array.isArray(f.ops) && f.numero === '12' && f.barre === '58', '… SON choix « garder le N° de Vinted » ⇒ N°12 reste, N°58 « à barrer »', f);
    const B2 = JSON.parse(JSON.stringify(B)); jouer(B2, f.ops); B2.vrm_lbc_liens['2002'] = '12';   // le lien lui-même : posé par le parcours de liaison
    const Af = articles(B2, lire(B2, source), true);
    const u = Af.articles.find((a) => a.annonces.some((x) => x.site === 'leboncoin' && x.id === '2002'));
    dit(Af.articles.length === 2 && u.sites.join() === 'vinted,leboncoin' && cleNum(u.numero) === '12' && !u.deuxNumeros, '… UN article (Vinted + Leboncoin), UN N°, aucun doublon', Af.articles.map((a) => [a.numero, a.numeros, a.sites]));
    dit(u.achat === 30 && u.achatRelie === 'achat-9' && u.prixMini === 45 && B2.vinted_annonce_numeros['9001'].buyPrice === '30' && B2.vinted_buyprice_by_num['12'] === '30', '… AUCUN fait perdu : acheté 30, achat relié, prix mini 45 passés sur la fiche (et le miroir par N°)', [u.achat, u.achatRelie, u.prixMini, B2.vinted_annonce_numeros['9001']]);
    dit(JSON.stringify(B2.vinted_used_numeros) === poolAvant && M.numerosABarrerSites(B2.vrm_articles_sites).some((x) => x.de === '58' && x.vers === '12'), '… le pool ne bouge pas (58 n’est jamais redonné) ; « N°58 à barrer » est dit');
    const fs2 = M.opsFusion({ annonce: { site: 'leboncoin', id: '2002' }, numeroSite: '58', ficheId: '9001', cartes: cartes(B), choix: { numero: 'site' }, cle: cleNum });
    const B3 = JSON.parse(JSON.stringify(B)); jouer(B3, fs2.ops);
    dit(fs2.numero === '58' && fs2.barre === '12' && B3.vinted_annonce_numeros['9001'].numero === '58', '… SON choix « garder le N° du carton Leboncoin » ⇒ la fiche prend 58, 12 « à barrer »', fs2);
    // Deux prix d'achat différents : demandé.
    const B4 = JSON.parse(JSON.stringify(B)); B4.vinted_annonce_numeros['9001'].buyPrice = '25';
    const c = M.opsFusion({ annonce: { site: 'leboncoin', id: '2002' }, numeroSite: '58', ficheId: '9001', cartes: cartes(B4), choix: { numero: 'vinted' }, cle: cleNum });
    dit(Array.isArray(c.questions) && c.questions.some((x) => x.champ === 'buyPrice') && !c.ops, '… deux prix d’achat différents (25 et 30) ⇒ une question, rien n’est tranché seul', c);
    const c2 = M.opsFusion({ annonce: { site: 'leboncoin', id: '2002' }, numeroSite: '58', ficheId: '9001', cartes: cartes(B4), choix: { numero: 'vinted', buyPrice: 'fiche' }, cle: cleNum });
    jouer(B4, c2.ops);
    dit(B4.vinted_annonce_numeros['9001'].buyPrice === '25' && B4.vinted_annonce_numeros['9001'].min === '45', '… « garder 25 » : la fiche garde 25 et reçoit le prix mini qu’elle n’avait pas');
    // Avant le lien, lu sans fusion : le conflit est VU (jamais une valeur prise au hasard en silence).
    const B5 = JSON.parse(JSON.stringify(B)); B5.vinted_annonce_numeros['9001'].buyPrice = '25'; B5.vrm_lbc_liens['2002'] = '12';
    const u5 = articles(B5, lire(B5, source), true).articles.find((a) => cleNum(a.numero) === '12');
    dit(u5.conflits.some((x) => x.champ === 'buyPrice') && u5.achat === 25, 'un lien posé sans fusion : le désaccord est signalé (`conflits`), la fiche fait foi', u5.conflits);
  });

  // ── P4 ──────────────────────────────────────────────────────────────────
  console.log('— P4. 50 annonces Leboncoin au même titre');
  await essaie('P4', () => {
    const B = base({ vinted_used_numeros: Array.from({ length: 120 }, (_, i) => i + 1) });
    const lbc = {}; for (let i = 0; i < 50; i++) lbc[5000 + i] = adLbc(5000 + i, { subject: 'Nike Air Force 1 blanche 42', images: ['https://img.example/meme.jpg'], price: 60 });
    const r = numeroter(B, lire(B, { lbc }), { aVinted: false });
    const nums = (r.nouveaux || []).map((x) => x.numero);
    dit(nums.length === 50 && new Set(nums).size === 50 && nums[0] === '121' && nums[49] === '170', '50 annonces identiques ⇒ 50 N° différents (121 à 170), chacune le SIEN', nums.slice(0, 5));
    let A = articles(B, lire(B, { lbc }), false);
    dit(A.articles.length === 50 && A.numerosEnDouble.size === 0, '… 50 articles, aucun réuni par son titre ni par sa photo', A.articles.length);
    for (const a of A.articles) jouer(B, M.opsFait({ article: a, champs: { buyPrice: 10 + Number(a.annonces[0].id) - 5000 }, cartes: cartes(B) }).ops);
    A = articles(B, lire(B, { lbc }), false);
    dit(A.articles.every((a) => a.achat === 10 + Number(a.annonces[0].id) - 5000) && new Set(A.articles.map((a) => a.achat)).size === 50, '… chacune SON prix d’achat, relu par son identifiant (50 valeurs, aucune mélangée)');
    dit(Object.keys(B.vrm_articles_sites).length === 50 && Object.keys(B.vrm_articles_sites).every((k) => /^Leboncoin:50\d\d$/.test(k)), '… 50 entrées, sous « Leboncoin:<id> »');
  });

  // ── P7 ──────────────────────────────────────────────────────────────────
  console.log('— P7. Une lecture ratée n’écrit rien');
  await essaie('P7', () => {
    const B = base({ vinted_annonce_numeros: { 9001: { numero: '12' } } });
    const lu = lire(B, { lbc: { 1: adLbc(1) }, vinted: [{ uid: 'u', ok: true, enLigne: [itVinted(9001)], aConfirmer: [], masquees: [] }] });
    const A = articles(B, lu, true);
    const site = A.articles.find((a) => a.sansVinted), fiche = A.articles.find((a) => !a.sansVinted);
    const r1 = M.opsFait({ article: site, champs: { buyPrice: 10 }, cartes: { ...cartes(B), faits: null } });
    const r2 = M.opsFait({ article: fiche, champs: { buyPrice: 10 }, cartes: { ...cartes(B), fiches: null } });
    const r2b = M.opsFait({ article: fiche, champs: { buyPrice: 10 }, cartes: { ...cartes(B), parNum: null } });
    dit(r1.refus === 'pas-su' && !r1.ops && r2.refus === 'pas-su' && !r2.ops && r2b.refus === 'pas-su', 'écrire un fait : une carte pas lue ⇒ « pas su », aucune opération', [r1, r2, r2b]);
    const r3 = M.opsFusion({ annonce: { site: 'leboncoin', id: '1' }, numeroSite: '', ficheId: '9001', cartes: { ...cartes(B), faits: null }, cle: cleNum });
    dit(r3.refus === 'pas-su' && !r3.ops, 'fusionner : pas su ⇒ aucune opération', r3);
    const pris = new Set(), prisK = new Set();
    const r4 = N.attribuerNumerosSites({ ids: [{ site: 'leboncoin', id: '1' }], pris, prisCles: prisK, prochainLibre, cle: cleNum, cartes: { ...cartes(B), lbc: null } });
    dit(r4.refus === 'pas-su' && !r4.ops && pris.size === 0, 'numéroter : la carte des liens pas lue ⇒ aucun N° donné, aucun N° brûlé', r4);
    dit(N.opsNumeroEcrit({ cles: ['Leboncoin:1'], faits: null }).refus === 'pas-su', '« C’est écrit » : pas su ⇒ rien');
    // Un N° déjà SERVI rendu par une règle fautive n'est jamais redonné.
    const r5 = N.attribuerNumerosSites({ ids: [{ site: 'leboncoin', id: '1' }], pris: new Set([1, 2]), prisCles: new Set(['1', '2']), prochainLibre: () => '2', cle: cleNum, cartes: cartes(B) });
    dit(r5.refus === 'numero' && !r5.ops, 'un N° déjà servi ne se redonne JAMAIS : refus, rien n’est écrit', r5);
    // Un autre appareil l'a numérotée entre-temps (carte relue à l'instant) : pas de 2e N°.
    const B6 = base({ vrm_lbc_liens: { 1: '9' } });
    const r6 = N.attribuerNumerosSites({ ids: [{ site: 'leboncoin', id: '1' }], pris: new Set([9]), prisCles: new Set(['9']), prochainLibre, cle: cleNum, cartes: cartes(B6) });
    dit(r6.ops && r6.ops.length === 0 && r6.nouveaux.length === 0, 'déjà numérotée par un autre appareil (carte relue) ⇒ pas de second N°', r6);
  });

  // ── P8 / P9 ─────────────────────────────────────────────────────────────
  console.log('— P8/P9. Doublon de N°, filtres, comptes');
  await essaie('P8', () => {
    const B = base({ vrm_lbc_liens: { 1: '7', 2: '7', 3: '8' }, vinted_buyprice_by_num: { 7: '15', 8: '22' } });
    const lbc = { 1: adLbc(1), 2: adLbc(2, { subject: 'Autre paire' }), 3: adLbc(3, { subject: 'Reebok Club C 43' }), 4: adLbc(4, { status: 'vendue', subject: 'Vendue hier' }) };
    const A = articles(B, lire(B, { lbc, ebay: [itEbay(77)] }), false);
    const d = A.articles.find((a) => cleNum(a.numero) === '7'), s8 = A.articles.find((a) => cleNum(a.numero) === '8');
    dit(d && d.doublon && A.numerosEnDouble.has('7'), 'deux annonces du même compte sous le N°7 ⇒ doublon signalé (le seul rouge)', d && d.doublon);
    dit(d.achat == null && s8.achat === 22 && s8.achatDe === 'numero', 'le prix saisi par N° (import, arrivée) vaut pour le N° qui désigne UN article — jamais pour un doublon', [d.achat, s8.achat]);
    const n = M.compterArticles(A.articles);
    dit(n.tous.enligne === 3 && n.leboncoin.enligne === 2 && n.ebay.enligne === 1 && n.leboncoin.vendues === 1 && n.vinted.enligne === 0, 'comptes par site et par état', n);
    // « À publier » et « Dorment » (les segments de l'écran) : la même règle pour chaque site.
    const J = 24 * 3600e3, now = Date.parse('2026-11-19T12:00:00Z');
    const seg = M.construireArticles({ annonces: [
      { site: 'leboncoin', id: 'v1', etat: 'enligne', depuis: now - 40 * J, numero: '31' },
      { site: 'ebay', id: 'v2', etat: 'enligne', depuis: now - 5 * J, numero: '32' },
      { site: 'vestiaire', id: 'v3', etat: 'aconfirmer', depuis: now - 90 * J, numero: '33' },
      { site: 'vinted', id: 'v4', etat: 'brouillon', numero: '' },
      { site: 'leboncoin', id: 'v5', etat: 'enligne', depuis: null, numero: '35' },
    ], cle: cleNum }).articles;
    const ids = (e) => M.filtrerArticles(seg, { etat: e, maintenant: now, seuil: 30 }).map((a) => a.annonces[0].id).sort().join();
    dit(ids('dorment') === 'v1', '« Dorment » : en ligne (lecture fraîche) depuis 30 j ou plus — date inconnue ou « à confirmer » ⇒ non', ids('dorment'));
    dit(ids('apublier') === 'v4' && !ids('enligne').includes('v4'), '« À publier » : un brouillon, jamais compté « en ligne »', [ids('apublier'), ids('enligne')]);
    dit(M.filtrerArticles(A.articles, { site: 'ebay' }).length === 1 && M.filtrerArticles(A.articles, { etat: 'vendues' }).length === 1 && M.filtrerArticles(A.articles, { recherche: 'reebok' }).length === 1 && M.filtrerArticles(A.articles, { recherche: 'n8' }).length === 1, 'filtre par site, par état, recherche par titre et par N°');
    const t = M.trierArticles(A.articles).map((a) => a.cle);
    dit(JSON.stringify(t) === JSON.stringify(M.trierArticles([...A.articles].reverse()).map((a) => a.cle)), 'un ordre STABLE (le même quelle que soit l’arrivée des lectures)');
  });

  // ── P10 : le branchement dans l'app ──────────────────────────────────────
  if (!process.argv.includes('--sans-branchement')) {
    console.log('— P10. Le branchement');
    await essaie('P10', () => {
      const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
      const app = sans(APPSRC);
      dit(/'vrm_articles_sites'/.test(app), 'la clé `vrm_articles_sites` est synchronisée (liste des clés de l’app)');
      const corpsEbay = (app.match(/const numEbayLu = \([^)]*\) => \{[\s\S]*?\n\};/) || [''])[0];
      const iLien = corpsEbay.search(/if \(lien\)/), iPropre = corpsEbay.search(/l0\.propre\s*&&\s*l0\.numero/), iSku = corpsEbay.search(/numDeSkuEbay\(sku\)/);
      dit(iPropre > iLien && iPropre < iSku && iLien >= 0, '`numEbayLu` lit le N° PROPRE d’une annonce eBay (`vrm_ebay_liens[id].propre`) avant le SKU');
      dit(/numeroterSites\(/.test(app), 'la numérotation des annonces Leboncoin / eBay est lancée par l’app (`numeroterSites`)');
      const vue = fs.existsSync(path.join(SRC, 'natif', 'ecrans', 'Annonces.jsx')) ? sans(fs.readFileSync(path.join(SRC, 'natif', 'ecrans', 'Annonces.jsx'), 'utf8')) : '';
      dit(!!vue && !/from ['"][^'"]*App\.jsx['"]/.test(vue), 'la vue src/natif/ecrans/Annonces.jsx existe et ne lit aucune donnée elle-même');
      // Les rangées (téléphone) et le tableau (ordinateur) ne portent AUCUN plein ; l'écran en a un (sélection OU publier).
      const rangees = (vue.match(/const rangee = \(a\) => \{[\s\S]*?\n  \};/) || [''])[0] + (vue.match(/const tableau = \([\s\S]*?\n  \);/) || [''])[0];
      const plein = (vue.match(/const plein = [\s\S]*?\n\n/) || [''])[0];
      dit(!!vue && !!rangees && !/variante="plein"/.test(rangees) && (plein.match(/variante="plein"/g) || []).length <= 2 && !/relierVinted|Relier à Vinted/.test(vue), '… un seul plein (celui de l’écran, ou celui de la sélection), aucun bouton « Relier à Vinted » par rangée');
    });
  }

  console.log(ko ? `\n❌ Parité des sites : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Parité des sites : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
