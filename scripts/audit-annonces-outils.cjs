// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES QUATRE OUTILS DES ANNONCES (3 novembre 2026, choix de Julien)
//
//  EXÉCUTE les vraies règles (aucune copie), sur des données INVENTÉES (dépôt public) :
//    P · le prix partout          src/prixPartout.js (+ src/rechercheNumero.js, l'identité)
//    D · dupliquer une annonce    src/dupliquerFiche.js + le VRAI `prochainLibre` d'App.jsx
//    H · l'histoire d'un article  src/histoireArticle.js (+ src/fichePaire.js)
//    M · les modèles              src/modelesDescription.js
//    A · App.jsx                  les branchements (aucun envoi hors du clic, pool avant fiche…)
//
//  `--prouve` (§6.1) : (1) les mêmes contrôles sur origin/main (ou `--avant <ref>`) :
//  ils doivent être ROUGES ; (2) des MUTATIONS des règles, une à la fois, sur une copie :
//  chacune doit rendre au moins un contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.OUTILS_RACINE || path.join(__dirname, '..');
const FICHIERS = ['prixPartout.js', 'dupliquerFiche.js', 'histoireArticle.js', 'modelesDescription.js', 'rechercheNumero.js', 'fichePaire.js', 'beneficePaire.js'];

async function charger(racine) {
  const imp = async (rel) => { try { return await import(pathToFileURL(path.join(racine, rel)).href + '?t=' + Date.now() + Math.random()); } catch (e) { return { __erreur: String(e && e.message || e).slice(0, 160) }; } };
  return { P: await imp('src/prixPartout.js'), D: await imp('src/dupliquerFiche.js'), H: await imp('src/histoireArticle.js'), M: await imp('src/modelesDescription.js'), R: await imp('src/rechercheNumero.js') };
}
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

async function controles(racine, silencieux) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, msg, d) => { if (c) ok++; else { ko++; rouges.push(msg); } if (!silencieux) console.log((c ? '✅ ' : '❌ ') + msg + (!c && d ? '  → ' + String(d).slice(0, 240) : '')); };
  const essai = async (msg, f) => { try { const r = await f(); dit(r === true, msg, r === true ? '' : JSON.stringify(r)); } catch (e) { dit(false, msg, e && e.message); } };
  const { P, D, H, M, R } = await charger(racine);
  let APP = ''; try { APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8'); } catch (_) {}
  dit(typeof P.sitesDuNumero === 'function' && typeof P.appliquerPrix === 'function' && typeof P.envoisPrix === 'function', 'P · src/prixPartout.js se charge', P.__erreur);
  dit(typeof D.dupliquerFiche === 'function', 'D · src/dupliquerFiche.js se charge', D.__erreur);
  dit(typeof H.histoireArticle === 'function', 'H · src/histoireArticle.js se charge', H.__erreur);
  dit(typeof M.remplirModele === 'function', 'M · src/modelesDescription.js se charge', M.__erreur);

  // ── Une base de 50 articles au MÊME titre, N°1 à N°50, sur quatre sites ──
  const TITRE = 'Nike Air Max 90 blanche taille 42';
  const fiches = {}, listingsEbay = [], lbcItems = {}, vcItems = {}, vcLiens = {};
  for (let n = 1; n <= 50; n++) {
    fiches[String(9000 + n)] = { numero: String(n), title: TITRE, accountId: '111', price: '60', photo: `https://x/${n}.jpg`, photoK: `pk${n}`, numberedAt: `2026-10-${String(10 + (n % 15)).padStart(2, '0')}T08:00:00.000Z`, ...(n === 27 ? { min: '55' } : {}) };
    listingsEbay.push({ itemId: String(7000 + n), sku: 'VRM-' + n, title: TITRE, price: '65', _compte: 'principal', depuis: '2026-10-20T09:00:00.000Z' });
    lbcItems[String(5000 + n)] = { subject: `${TITRE} n${n}`, ref: 'VRM-' + n, price: 59, status: 'active', url: `https://www.leboncoin.fr/ad/chaussures/${5000 + n}` };
    vcItems[String(3000 + n)] = { titre: TITRE, statut: 'published', prix: { valeur: 70 } }; vcLiens[String(3000 + n)] = String(n);
  }
  lbcItems['5999'] = { subject: `${TITRE} n27`, price: 40, status: 'active' };   // « n27 » dans le TITRE seulement : pas une identité
  const enLigne = new Set(Object.keys(fiches));
  const RO = { cleNum, numEbayAnnonce: (a) => (/^VRM-(\w+)$/.exec(String(a.sku || '')) || [])[1] || null, conflits: () => [] };
  const rnDe = (q, extra = {}) => R.toutSurLeNumero(q, { fiches, pool: Object.keys(fiches).map((id) => Number(fiches[id].numero)), enLigne, aConfirmer: new Set(), masquees: new Set(), ventes: [], txnItem: {}, saleOv: {}, bordereaux: [], lbcVentes: [], ebayCommandes: [], ebayAnnonces: listingsEbay, plan: {}, archive: 'B', ...extra }, RO, ['B']);
  const OPT = (cap = 'ok') => ({ cleNum, capVinted: cap, numLbc: (ad) => { const m = /VRM-(\w+)/.exec(String(ad.ref || '')); return m ? cleNum(m[1]) : ''; }, numVc: (id) => vcLiens[id] || '' });
  const sitesDe = (q, cap, extra) => P.sitesDuNumero(q, { rn: rnDe(q, extra), fiches, lbcItems, vcItems }, OPT(cap));

  // ── P · LE PRIX PARTOUT ─────────────────────────────────────────────────────
  await essai('P1 · 50 articles au même titre : le N°27 désigne UNE annonce par site (Vinted 9027, eBay 7027, Leboncoin 5027, Vestiaire 3027)', () => {
    const { sites } = sitesDe('27');
    const ids = sites.map((s) => s.site + ':' + s.id).sort().join(',');
    return ids === 'ebay:7027,leboncoin:5027,vestiaire:3027,vinted:9027' || ids;
  });
  await essai('P2 · le « n27 » d\'un TITRE Leboncoin ne désigne rien (identité = référence ou lien)', () => !sitesDe('27').sites.some((s) => s.id === '5999') || 'pris par le titre');
  await essai('P3 · une annonce Vinted masquée ou « à confirmer » ne reçoit pas de prix', () => {
    const r = P.sitesDuNumero('27', { rn: rnDe('27', { enLigne: new Set([...enLigne].filter((x) => x !== '9027')), masquees: new Set(['9027']) }), fiches, lbcItems, vcItems }, OPT());
    return !r.sites.some((s) => s.site === 'vinted') || r.sites;
  });
  await essai('P4 · une source pas lue est NOMMÉE (pas « pas en ligne »)', () => {
    const r = P.sitesDuNumero('27', { rn: rnDe('27'), fiches, lbcItems: null, vcItems: null }, OPT());
    return (r.manques.includes('Leboncoin') && r.manques.includes('Vestiaire')) || r.manques;
  });
  await essai('P5 · prix tapé : « 72 », « 72,5 » lus ; « 72 € », « 0 », « -5 », « 1.250 », « 1e3 », « » refusés', () => {
    const bons = P.prixTape('72') === 72 && P.prixTape('72,5') === 72.5 && P.prixTape('72.50') === 72.5;
    const mauvais = ['72 €', '0', '-5', '1.250', '1e3', '', '0,001'].every((x) => P.prixTape(x) === null);
    return (bons && mauvais) || { bons, mauvais };
  });
  const espion = () => { const appels = []; return { appels, envoyer: { vinted: async (s, p) => { appels.push(['vinted', s.id, p]); return { etat: 'fait' }; }, ebay: async (s, p) => { appels.push(['ebay', s.id, p]); return { etat: 'fait' }; } } }; };
  await essai('P6 · aucun envoi sans case cochée ; seuls les sites COCHÉS partent', async () => {
    const { sites } = sitesDe('27'); const e = espion();
    const r0 = await P.appliquerPrix({ sites, coches: new Set(), prix: '50', envoyer: e.envoyer });
    const n0 = e.appels.length;
    await P.appliquerPrix({ sites, coches: new Set(['ebay:7027']), prix: '50', envoyer: e.envoyer });
    return (n0 === 0 && Object.values(r0.res).every((x) => x.etat === 'ignore') && e.appels.length === 1 && e.appels[0][0] === 'ebay') || { n0, appels: e.appels };
  });
  await essai('P7 · prix illisible ⇒ rien ne part', async () => { const { sites } = sitesDe('27'); const e = espion(); const r = await P.appliquerPrix({ sites, coches: new Set(sites.map((s) => s.cle)), prix: '72 €', envoyer: e.envoyer }); return (e.appels.length === 0 && r.erreur === 'prix') || e.appels; });
  await essai('P8 · capacité Vinted absente ou en retard ⇒ « À faire sur le site » avec le lien, jamais envoyé', async () => {
    for (const cap of ['absente', 'retard']) {
      const { sites } = sitesDe('27', cap); const e = espion();
      const v = sites.find((s) => s.site === 'vinted');
      const r = await P.appliquerPrix({ sites, coches: new Set(sites.map((s) => s.cle)), prix: '50', envoyer: e.envoyer });
      if (!v || v.mode !== 'site' || !/vinted\.fr\/items\/9027/.test(v.lien) || r.res[v.cle].etat !== 'a-faire' || e.appels.some((a) => a[0] === 'vinted')) return { cap, v, res: r.res, appels: e.appels };
    }
    return true;
  });
  await essai('P9 · Leboncoin et Vestiaire : « À faire sur le site » avec le lien, jamais envoyés', async () => {
    const { sites } = sitesDe('27'); const e = espion();
    const r = await P.appliquerPrix({ sites, coches: new Set(sites.map((s) => s.cle)), prix: '50', envoyer: { ...e.envoyer, leboncoin: async () => { e.appels.push(['lbc']); return { etat: 'fait' }; }, vestiaire: async () => { e.appels.push(['vc']); return { etat: 'fait' }; } } });
    const l = sites.find((s) => s.site === 'leboncoin');
    return (r.res['leboncoin:5027'].etat === 'a-faire' && r.res['vestiaire:3027'].etat === 'a-faire' && !e.appels.some((a) => a[0] === 'lbc' || a[0] === 'vc') && /leboncoin\.fr\/ad\/chaussures\/5027/.test(l.lien)) || { res: r.res, appels: e.appels };
  });
  await essai('P10 · eBay part CONFIRMÉ, au prix VU (`revise`, `confirme:true`, `prixVu`) ; Vinted par `republierVinted` confirmé, sur SON compte', async () => {
    const corps = [];
    const env = P.envoisPrix({ appelEbay: async (c) => { corps.push(c); return c.confirme === true ? { code: 200, j: { ok: true } } : { code: 400, j: { ok: false, reason: 'confirmation' } }; },
      resultatReviseEbay: ({ j }) => (j && j.ok ? { etat: 'ok' } : { etat: 'ko', msg: 'refus' }), corpsCompteEbay: () => ({}),
      vmrCmdSuivi: async (p) => { corps.push(p); return p.confirme === true ? { accepte: true, etape: 'fait' } : { accepte: false, raison: 'confirmation' }; } });
    const { sites } = sitesDe('27');
    const r = await P.appliquerPrix({ sites, coches: new Set(['ebay:7027', 'vinted:9027']), prix: '50', envoyer: env });
    const eb = corps.find((c) => c.action === 'revise'), vi = corps.find((c) => c.cmd === 'republierVinted');
    return (eb && eb.confirme === true && eb.prixVu === 65 && eb.price === '50' && eb.itemId === '7027' && vi && vi.confirme === true && vi.uid === '111' && vi.id === '9027' && vi.prix === 50
      && r.res['ebay:7027'].etat === 'fait' && r.res['vinted:9027'].etat === 'fait') || { corps, res: r.res };
  });
  await essai('P11 · eBay sans confirmation : la route refuse (garde serveur P12 présente dans api/ebay.js)', () => {
    let src = ''; try { src = fs.readFileSync(path.join(racine, 'api', 'ebay.js'), 'utf8'); } catch (_) {}
    return /\(action === 'revise' && b\.price != null\)\) && b\.confirme !== true\)/.test(src) || 'garde absente';
  });
  await essai('P12 · un refus et une coupure se disent (Refusé + raison · Pas sûr), jamais « Fait »', async () => {
    const env = P.envoisPrix({ appelEbay: async () => ({ code: 0, j: null }), resultatReviseEbay: () => ({ etat: 'incertain', msg: 'eBay n\'a pas répondu' }), corpsCompteEbay: () => ({}),
      vmrCmdSuivi: async () => ({ accepte: false, code: 'modele-absent', raison: 'je n\'ai pas encore vu le format' }) });
    const { sites } = sitesDe('27');
    const r = await P.appliquerPrix({ sites, coches: new Set(['ebay:7027', 'vinted:9027']), prix: '50', envoyer: env });
    return (r.res['ebay:7027'].etat === 'incertain' && r.res['vinted:9027'].etat === 'refuse' && /format/.test(r.res['vinted:9027'].raison)) || r.res;
  });
  await essai('P13 · le prix mini des offres est DIT s\'il dépasse le nouveau prix, et jamais changé', async () => {
    const avant = JSON.stringify(fiches);
    const { sites } = sitesDe('27');
    const m = P.minisAuDessus(sites, 50), m2 = P.minisAuDessus(sites, 60);
    await P.appliquerPrix({ sites, coches: new Set(sites.map((s) => s.cle)), prix: '50', envoyer: espion().envoyer });
    return (m.length === 1 && m[0].mini === 55 && m2.length === 0 && JSON.stringify(fiches) === avant) || { m, m2 };
  });
  await essai('P14 · le journal des prix ne garde que les sites FAITS', () => {
    const { sites } = sitesDe('27');
    const j = P.noterJournalPrix({}, '27', 50, sites, { 'ebay:7027': { etat: 'fait' }, 'vinted:9027': { etat: 'refuse' }, 'leboncoin:5027': { etat: 'a-faire' } }, '2026-11-03T10:00:00.000Z');
    return (j['27'] && j['27'].length === 1 && j['27'][0].sites.length === 1 && j['27'][0].sites[0].site === 'ebay') || j;
  });

  // ── D · DUPLIQUER ───────────────────────────────────────────────────────────
  let prochainLibre = null;
  try { const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APP); prochainLibre = x ? new Function(x[0] + '\nreturn prochainLibre;')() : null; } catch (_) { prochainLibre = null; }
  dit(typeof prochainLibre === 'function', 'D0 · le VRAI `prochainLibre` extrait d\'App.jsx');
  const source = { ...D.champsSource ? D.champsSource(fiches['9027'], { brand: 'Nike', etat: 'Très bon état', desc: 'Portée 2 fois', title: TITRE, size: '42', price: '60' }) : {} };
  const dup = (pris, pref = '') => D.dupliquerFiche(source, { pris, pref, prochainLibre, cleNum, id: 'n1', maintenant: '2026-11-03T10:00:00.000Z' });
  await essai('D1 · le N° neuf vient après le PLUS HAUT servi (jamais un trou, jamais un ancien)', () => {
    const r = dup({ int: new Set([1, 2, 5, 50]), cles: new Set(['1', '2', '5', '50', 'B230', 'B51']) });
    return r.fiche.numero === '51' || r.fiche.numero;
  });
  await essai('D2 · série à lettres : C1…C3 servis ⇒ C4', () => { const r = dup({ int: new Set([7]), cles: new Set(['C1', 'C2', 'C3', '7']) }, 'C'); return r.fiche.numero === 'C4' || r.fiche.numero; });
  await essai('D3 · un N° jamais réutilisé : deux duplications successives donnent deux N° neufs', () => {
    const pris = { int: new Set([1, 2, 3]), cles: new Set(['1', '2', '3']) };
    const a = dup(pris); pris.int.add(Number(a.fiche.numero)); pris.cles.add(a.fiche.numero);
    const b = dup(pris);
    return (a.fiche.numero === '4' && b.fiche.numero === '5') || [a.fiche.numero, b.fiche.numero];
  });
  await essai('D4 · aucune identité copiée (ni annonce, ni photo, ni compte, ni achat, ni prix mini, ni N° d\'origine)', () => {
    const r = dup({ int: new Set([50]), cles: new Set(['50']) });
    const permis = new Set(['id', 'numero', 'creeAt', 'photos', ...D.CHAMPS_DUPLIQUES]);
    const etrangers = Object.keys(r.fiche).filter((k) => !permis.has(k));
    const txt = JSON.stringify(r.fiche);
    return (!etrangers.length && r.fiche.photos.length === 0 && !/9027|pk27|x\/27\.jpg|"111"|"55"/.test(txt) && r.fiche.numero !== '27') || { etrangers, txt };
  });
  await essai('D5 · mêmes champs : titre, marque, taille, état, description, prix', () => {
    const r = dup({ int: new Set([50]), cles: new Set(['50']) }).fiche;
    return (r.titre === TITRE && r.marque === 'Nike' && r.taille === '42' && r.etat === 'Très bon état' && r.description === 'Portée 2 fois' && r.prix === 60) || r;
  });
  await essai('D6 · une fiche dupliquée sort de « À publier » dès qu\'une annonce porte SON N°', () => {
    const neuves = { a: { id: 'a', numero: '51', creeAt: '2026-11-03' }, b: { id: 'b', numero: '52', creeAt: '2026-11-03' } };
    const l = D.fichesAPublier(neuves, new Set(['51']), cleNum);
    return (l.length === 1 && l[0].numero === '52') || l;
  });

  // ── H · L'HISTOIRE ──────────────────────────────────────────────────────────
  const venteTx = '880001';
  const ventes = [{ transaction_id: venteTx, title: TITRE, price: { amount: '72.0', currency_code: 'EUR' }, date: '2026-10-28T12:00:00.000Z', status: 'Commande finalisée', _uid: '111' },
    { transaction_id: '880002', title: TITRE, price: { amount: '70.0' }, date: '2026-10-27T12:00:00.000Z', status: 'Commande finalisée', _uid: '111' }];
  const fichesH = { ...fiches, 9027: { ...fiches['9027'], buyPrice: '30', buyFromId: '440027', buyFrom: { date: '2026-10-01T10:00:00.000Z', title: TITRE, seller: 'x' } } };
  const rnH = (extra = {}) => R.toutSurLeNumero('27', { fiches: fichesH, pool: [27], enLigne: new Set(), aConfirmer: new Set(), masquees: new Set(), ventes, txnItem: { [venteTx]: '9027', 880002: '9028' }, saleOv: {}, bordereaux: [{ tx: venteTx, pdf: true }], imprimes: {}, postes: {}, lbcVentes: [], ebayCommandes: [], ebayAnnonces: listingsEbay, plan: {}, archive: 'B', ...extra }, { ...RO, expediee: () => true, aPoster: () => false }, ['B']);
  const OH = { etapeVente: () => ({ label: 'Commande finalisée', step: 4 }), venteAnnulee: (v) => /annul|retour/i.test(v.status || ''), commandeEbayEngagee: () => true, montantRecuEbay: () => ({ eur: null }), lbcAnnulee: () => false, lbcFinalisee: () => true };
  const offres = [
    { item: '9027', at: '2026-10-25T09:00:00.000Z', prix: 50, sens: 'recue', etat: 'Refusée' },
    { item: '9028', at: '2026-10-26T09:00:00.000Z', prix: 51, sens: 'recue', etat: 'Acceptée' },   // un AUTRE article au même titre
  ];
  const DH = (extra = {}) => ({ fiches: fichesH, saleOv: {}, buyByNum: {}, stats: { 9027: { favoris: 7, vues: 120 }, 9028: { favoris: 99, vues: 1 } }, versements: { [venteTx]: '2026-11-01T08:00:00.000Z' },
    coffres: { 9027: { firstSavedAt: '2026-10-12T07:00:00.000Z' } }, offres, recus: new Set(['440027']), autresEnLigne: [], journalPrix: [{ at: '2026-10-22T10:00:00.000Z', prix: 65, sites: [{ site: 'ebay', id: '7027', avant: 70 }] }], prixVinted: [{ item: '9028', avant: 80, apres: 60, at: '2026-10-21T00:00:00.000Z' }], ...extra });
  const hist = (rn, d) => H.histoireArticle(rn, d, OH);
  await essai('H1 · les étapes suivent l\'ordre du cycle (achat → … → versement → retour)', () => {
    const h = hist(rnH(), DH()); const cles = h.etapes.map((e) => e.cle);
    return JSON.stringify(cles) === JSON.stringify(H.ORDRE_HISTOIRE) || cles;
  });
  const ev = (h, cle) => (h.etapes.find((e) => e.cle === cle) || { evenements: [] }).evenements;
  const et = (h, cle) => (h.etapes.find((e) => e.cle === cle) || {}).etat;
  await essai('H2 · chaque date vient de SA donnée : achat, numérotage, mise en ligne, prix, offre, vente, versement', () => {
    const h = hist(rnH(), DH());
    const ok = ev(h, 'achat')[0].at === '2026-10-01T10:00:00.000Z' && ev(h, 'numero')[0].at === fichesH['9027'].numberedAt
      && ev(h, 'annonces').some((x) => x.at === '2026-10-12T07:00:00.000Z') && ev(h, 'annonces').some((x) => x.at === '2026-10-20T09:00:00.000Z')
      && ev(h, 'prix').length === 1 && ev(h, 'prix')[0].at === '2026-10-22T10:00:00.000Z'
      && ev(h, 'offres').length === 1 && ev(h, 'offres')[0].at === '2026-10-25T09:00:00.000Z'
      && ev(h, 'vente').length === 1 && ev(h, 'vente')[0].at === '2026-10-28T12:00:00.000Z' && ev(h, 'argent')[0].at === '2026-11-01T08:00:00.000Z';
    return ok || h.etapes.map((e) => [e.cle, e.etat, e.evenements.map((x) => x.at)]);
  });
  await essai('H3 · 50 au même titre : ni l\'offre, ni les favoris, ni le prix, ni la vente du N°28 n\'entrent dans le N°27', () => {
    const h = hist(rnH(), DH());
    const t = JSON.stringify(h.etapes);
    return (!/880002|\b51 €|99 favori|60 €/.test(t) && /7 favoris/.test(h.etapes.find((e) => e.cle === 'favoris').titre)) || t.slice(0, 600);
  });
  await essai('H4 · le reçu de CET achat est dit (« reçu rangé »), un achat sans reçu « pas de reçu », non lu « reçu pas lu »', () => {
    const a = ev(hist(rnH(), DH()), 'achat')[0].texte, b = ev(hist(rnH(), DH({ recus: new Set() })), 'achat')[0].texte, c = ev(hist(rnH(), DH({ recus: null })), 'achat')[0].texte;
    return (/reçu rangé/.test(a) && /pas de reçu/.test(b) && /reçu pas lu/.test(c)) || [a, b, c];
  });
  await essai('H5 · « pas su » : offres, journal, favoris non lus ⇒ étapes « passu », jamais « absent »', () => {
    const h = hist(rnH(), DH({ offres: null, journalPrix: null, stats: null }));
    return (et(h, 'offres') === 'passu' && et(h, 'prix') === 'passu' && et(h, 'favoris') === 'passu') || h.etapes.map((e) => [e.cle, e.etat]);
  });
  await essai('H6 · ventes Vinted pas lues ⇒ vente et retour « passu » (jamais « pas encore vendue »)', () => {
    const h = hist(rnH({ ventes: null }), DH());
    return (et(h, 'vente') === 'passu' && et(h, 'retour') === 'passu') || h.etapes.map((e) => [e.cle, e.etat]);
  });
  await essai('H7 · lu et vide ⇒ « absent » (aucune offre, aucun changement de prix)', () => {
    const h = hist(rnH(), DH({ offres: [], journalPrix: [], prixVinted: [] }));
    return (et(h, 'offres') === 'absent' && et(h, 'prix') === 'absent') || h.etapes.map((e) => [e.cle, e.etat]);
  });
  await essai('H8 · aucune date inventée : coffre pas lu ⇒ mise en ligne Vinted SANS date', () => {
    const h = hist(rnH(), DH({ coffres: null }));
    const v = ev(h, 'annonces').find((x) => /Vinted/.test(x.texte));
    return (v && v.at === null) || ev(h, 'annonces');
  });
  await essai('H9 · une vente annulée ou retournée va dans « Retour », jamais dans « Vente »', () => {
    const vs = [{ ...ventes[0], status: 'Commande annulée' }];
    const h = hist(rnH({ ventes: vs }), DH());
    return (et(h, 'retour') === 'fait' && ev(h, 'vente').length === 0) || h.etapes.map((e) => [e.cle, e.etat, e.evenements.length]);
  });
  await essai('H10 · offresDeConversation : l\'item vient de la transaction, le sens de l\'auteur (inconnu ⇒ ni « reçue » ni « faite »)', () => {
    const conv = { transaction: { item_id: 9027 }, messages: [{ entity_type: 'offer_request_message', created_at_ts: 1761382800, entity: { price: { amount: '27.0' }, user_id: 5, status_title: 'Refusée' } }, { entity_type: 'message', entity: { body: 'x' } }] };
    const a = H.offresDeConversation(conv, '111'), b = H.offresDeConversation(conv, '5'), c = H.offresDeConversation(conv, null);
    return (a.length === 1 && a[0].item === '9027' && a[0].prix === 27 && a[0].sens === 'recue' && a[0].at === new Date(1761382800000).toISOString() && b[0].sens === 'faite' && c[0].sens === null) || { a, b, c };
  });

  // ── M · LES MODÈLES ─────────────────────────────────────────────────────────
  await essai('M1 · variables remplacées ({taille}, {marque}, {N°}, {titre}, {prix}) ; sans valeur, la variable RESTE écrite', () => {
    const t = M.remplirModele('Taille {taille} · {marque} · {N°} · {prix} · {inconnue}', { taille: '42', marque: 'Nike', numero: '27', prix: 60 });
    const u = M.remplirModele('Taille {taille} · {marque}', { taille: '' });
    return (t === 'Taille 42 · Nike · N°27 · 60 € · {inconnue}' && u === 'Taille {taille} · {marque}') || [t, u];
  });
  await essai('M2 · insertion au curseur, séparée par une ligne vide, rien d\'écrasé', () => {
    const a = M.insererDans('Bonjour\nfin', 'MODELE', 7), b = M.insererDans('', 'MODELE'), c = M.insererDans('Texte', 'MODELE');
    return (a.texte === 'Bonjour\n\nMODELE\n\n\nfin' || a.texte === 'Bonjour\n\nMODELE\nfin') && b.texte === 'MODELE' && c.texte === 'Texte\n\nMODELE' || [a, b, c];
  });
  await essai('M3 · lecture rangée : vides, doublons d\'id et formes étrangères écartés', () => {
    const l = M.lireModeles([{ id: 'a', nom: 'État', texte: 'x' }, { id: 'a', nom: 'bis', texte: 'y' }, { id: 'b', texte: '   ' }, null, 'z', { id: 'c', texte: 'Envoi soigné' }]);
    return (l.length === 2 && l[1].nom === 'Envoi soigné') || l;
  });

  // ── A · LES BRANCHEMENTS DANS App.jsx ───────────────────────────────────────
  const sansCom = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  await essai('A1 · les envois (`ENVOIS_PRIX`) ne sont appelés QUE dans « Appliquer » (`onAppliquer`)', () => {
    const usages = (sansCom.match(/ENVOIS_PRIX/g) || []).length;
    const dans = /onAppliquer=\{async\(\{ coches, prix, surEtat \}\)=>\{[^}]*envoyer: ENVOIS_PRIX/.test(sansCom);
    return (usages === 2 && dans) || { usages, dans };
  });
  await essai('A2 · la capacité Vinted lue est `republiermodif` (extSait), jamais supposée', () => /capVinted: extSait\('republiermodif'\)/.test(sansCom) || 'absente');
  await essai('A3 · dupliquer : réservations lues (rien sur « pas su »), pool écrit AVANT la fiche', () => {
    const f = (/async function dupliquerNumero[\s\S]*?\n\}\n/.exec(sansCom) || [''])[0];
    const iPool = f.indexOf("save('vinted_used_numeros'"), iFiche = f.indexOf("save('vrm_fiches_neuves'");
    return (f && /panel_num_reserves/.test(f) && /if \(!Array\.isArray\(jr\)\) return \{ ok: false/.test(f) && iPool > 0 && iFiche > iPool && /numerosReserves\(/.test(f)) || { iPool, iFiche };
  });
  await essai('A4 · fiches neuves, journal des prix et modèles synchronisés (SYNC_KEYS)', () => ['vrm_fiches_neuves', 'vrm_prix_journal', 'vrm_modeles_desc'].every((k) => new RegExp(`'${k}'`).test((/const SYNC_KEYS = \[[\s\S]*?\];/.exec(APP) || [''])[0])) || 'manquant');
  await essai('A5 · les modèles sont insérables dans 4 descriptions (Leboncoin, eBay publier, eBay modifier, brouillon)', () => { const n = (sansCom.match(/<ChipsModeles /g) || []).length; return n >= 4 || n; });
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['P : Leboncoin pris au titre', 'src/prixPartout.js', 'if (!meme(o.numLbc ? o.numLbc(ad, id) : null)) continue;', 'if (!meme(o.numLbc ? o.numLbc(ad, id) : null) && !String(ad.subject || \'\').includes(\'n\' + k)) continue;'],
  ['P : Vinted masquée reçoit le prix', 'src/prixPartout.js', "if (!a || a.etat !== 'en-ligne') continue;", 'if (!a) continue;'],
  ['P : capacité ignorée', 'src/prixPartout.js', "const auto = o.capVinted === 'ok' &&", 'const auto = true ||'],
  ['P : les non-cochés partent', 'src/prixPartout.js', "if (!coches || !coches.has(s.cle)) { res[s.cle] = { etat: 'ignore', raison: null }; continue; }", ''],
  ['P : eBay sans confirmation', 'src/prixPartout.js', "prixVu: s.prix, confirme: true, ...dep", 'prixVu: s.prix, ...dep'],
  ['P : prix illisible accepté', 'src/prixPartout.js', "if (!/^\\d{1,5}(?:\\.\\d{1,2})?$/.test(s)) return null;", ''],
  ['P : source pas lue = pas en ligne', 'src/prixPartout.js', "if (lbcItems == null) manques.push('Leboncoin');\n  else", 'if (lbcItems)'],
  ['P : journal note les refus', 'src/prixPartout.js', "res[s.cle].etat === 'fait' && !res[s.cle].inchange", 'res[s.cle]'],
  ['D : comble les trous', 'src/dupliquerFiche.js', "if (!numero || avant.has(cleNum(numero))) throw new Error('numéro déjà servi');", ''],
  ['D : copie la photo', 'src/dupliquerFiche.js', "const fiche = { id: String(id), numero, creeAt: maintenant, photos: [] };", "const fiche = { id: String(id), numero, creeAt: maintenant, photos: [], ...src };"],
  ['H : offres d\'un autre article', 'src/histoireArticle.js', "d.offres.filter((x) => x && idsSet.has(str(x.item)) && Number.isFinite(Number(x.prix)))", 'd.offres.filter((x) => x && Number.isFinite(Number(x.prix)))'],
  ['H : offres pas lues = aucune', 'src/histoireArticle.js', "if (d.offres == null) pose('offres', 'passu', 'Offres', [], 'conversations pas lues');\n  else {", '{ d.offres = d.offres || [];'],
  ['H : date de mise en ligne inventée', 'src/histoireArticle.js', "else ev.push({ at: null, texte: 'Sur Vinted'", "else ev.push({ at: new Date().toISOString(), texte: 'Sur Vinted'"],
  ['H : ordre perdu', 'src/histoireArticle.js', 'etapes.sort((a, b) => ORDRE_HISTOIRE.indexOf(a.cle) - ORDRE_HISTOIRE.indexOf(b.cle));', 'etapes.reverse();'],
  ['H : vente annulée comptée', 'src/histoireArticle.js', "    if (annulee(v)) continue;\n", ''],
  ['M : variable vide effacée', 'src/modelesDescription.js', 'return x != null && str(x).trim() ? str(x).trim() : tout;', "return x != null ? str(x).trim() : '';"],
];

const copieArbre = (src) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'outils-'));
  fs.mkdirSync(path.join(d, 'src'), { recursive: true }); fs.mkdirSync(path.join(d, 'api'), { recursive: true });
  for (const f of FICHIERS) { const p = path.join(src, 'src', f); if (fs.existsSync(p)) fs.copyFileSync(p, path.join(d, 'src', f)); }
  fs.copyFileSync(path.join(src, 'src', 'App.jsx'), path.join(d, 'src', 'App.jsx'));
  fs.copyFileSync(path.join(src, 'api', 'ebay.js'), path.join(d, 'api', 'ebay.js'));
  fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
  return d;
};

(async () => {
  const prouve = process.argv.includes('--prouve');
  console.log('— Les outils des annonces, sur ' + RACINE);
  const r = await controles(RACINE, false);
  console.log(`\n${r.ko ? '❌' : '✅'} audit-annonces-outils : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (!prouve) process.exit(r.ko ? 1 : 0);
  const ia = process.argv.indexOf('--avant'); const avant = ia > 0 ? process.argv[ia + 1] : 'origin/main';
  const dAv = fs.mkdtempSync(path.join(os.tmpdir(), 'outils-avant-'));
  cp.execSync(`git -C ${JSON.stringify(RACINE)} archive ${avant} src api | tar -x -C ${JSON.stringify(dAv)}`);
  fs.writeFileSync(path.join(dAv, 'package.json'), '{"type":"module"}');
  const rav = await controles(dAv, true);
  console.log(`\n— Sur ${avant} : ${rav.ko} rouge(s) sur ${rav.ok + rav.ko} (attendu : des rouges) ${rav.ko ? '✅' : '❌'}`);
  let tuees = 0;
  for (const [nom, fichier, de, vers] of MUTATIONS) {
    const d = copieArbre(RACINE); const p = path.join(d, fichier); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation introuvable : ${nom}`); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const rm = await controles(d, true);
    if (rm.ko) tuees++;
    console.log(`${rm.ko ? '✅' : '❌'} mutation « ${nom} » : ${rm.ko} rouge(s)${rm.ko ? ' — ' + rm.rouges[0] : ''}`);
  }
  console.log(`\n${tuees === MUTATIONS.length && rav.ko ? '✅' : '❌'} preuve : ${tuees}/${MUTATIONS.length} mutations attrapées, ${rav.ko} rouge(s) sur le code d'avant`);
  process.exit(tuees === MUTATIONS.length && rav.ko && !r.ko ? 0 : 1);
})();
