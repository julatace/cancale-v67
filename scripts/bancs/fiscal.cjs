// ═══════════════════════════════════════════════════════════════════════════
// BANC : MON ENTREPRISE (PROFIL FISCAL) ET FACTURES / AVOIRS
//        node scripts/bancs/fiscal.cjs        (ports 5981, rendu de dist/)
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Julien, 15 octobre : SIREN, micro / réel / société, TVA, régime de
// la marge, versement libératoire — « et pour les factures, il va falloir faire
// ça parfaitement ». Ce banc REND l'app (données inventées, aucune fixture) et
// juge ce qu'elle FAIT, pas ce qu'elle écrit :
//   A. Réglages → « Mon entreprise » : la clé du SIREN est vérifiée, rien n'est
//      déduit du SIREN, l'app n'affiche que ce qui concerne le profil déclaré,
//      chaque règle porte sa source et sa date, et le profil est RANGÉ.
//   B. Factures, profil incomplet : rien ne s'émet (bouton grisé avec la raison),
//      et aucune facture ne se supprime (plus de « 🗑 »).
//   C. Factures, profil complet : émettre → une ligne `facture_AAAA_000001`
//      insérée SANS écrasement, figée (mention, SIREN, empreinte) ; avoir →
//      n° 000002 qui la cite ; export CSV ; PDF ; jamais un PATCH ni un DELETE.
//   D. Un autre appareil prend le n° 1 entre la lecture et l'écriture : l'app
//      prend le n° 2 et n'écrase rien.
//   E. Les factures ne se lisent pas : « pas pu lire », jamais « aucune », et
//      rien ne s'émet.
//   F. Régime de la marge : la mention « Biens d'occasion », aucune TVA.
//   G. (relecture du 16 octobre) Le TABLEAU DE BORD suit le régime : au réel,
//      aucun « À payer (13,5 %) », aucun « Déclarer sur l'URSSAF », aucun
//      « (versement libératoire) » ; micro sans VL : la phrase ne parle plus de
//      versement libératoire ; micro avec VL : elle le dit encore (l'autre sens).
//   I. Écriture « incertaine » (elle passe, la base répond 503) puis second
//      clic : UN seul document (le jeton est celui du formulaire).
//   J. Une facture sans nom de client ne s'émet pas ; l'avoir ne répète pas
//      « Avoir sur la facture X » deux fois dans la liste (§7).
//   K. Les numéros des ANCIENNES factures (`vinted_invoices`) ne se redonnent
//      jamais la même année.
//   L. Une vente Pro gardée « en attente du profil » s'émet d'un clic depuis
//      Factures, et sa ligne d'envoi devient réelle.
//   + rendu à 390 et 1512 px, clair et sombre (captures dans scripts/bancs/).
//   (Les exports du rapport et du bilan au réel : scripts/bancs/fiscal-rapports.cjs.)
// ⚠️ Les nombres et identités sont INVENTÉS (SIREN 123 456 782 a une clé juste,
//    il n'appartient à personne de connu ici) — §6 : aucune donnée réelle.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const PORT = Number(process.env.PORT_BANC || 5981);
const AN = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date()));

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le banc a levé : ' + String(e && e.message || e).slice(0, 220)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const BASE = { siren: '123456782', nom: 'Julie Exemple', adresse: '1 rue de la Mer', cp: '35260', ville: 'Cancale' };
const PROFIL_FRANCHISE = { v: 1, forme: 'micro', tva: 'franchise', marge: null, vl: false, ...BASE };
const PROFIL_MARGE = { v: 1, forme: 'societe', tva: 'assujetti', marge: true, vl: null, tvaIntra: 'FR11123456782', formeJuridique: 'SAS', capital: '1000', rcs: 'Saint-Malo', ...BASE, nom: 'Exemple SAS' };
const ANCIENNES = [
  { id: 'inv_1', number: `${AN}-000001`, entrepriseId: 'ent_1', productId: '12', itemName: 'Paire inventée A', sellPrice: 40, saleDate: `${AN}-09-01`, buyerName: 'Client A' },
  { id: 'inv_2', number: `${AN}-000002`, entrepriseId: 'ent_1', productId: '13', itemName: 'Paire inventée B', sellPrice: 55, saleDate: `${AN}-09-02`, buyerName: 'Client B' },
];

// Une base À ÉTAT : lectures eq / like / data->>k (le `meta->>` traduit),
// projection select=, écritures merge (remplace) ou ignore-duplicates (insère si
// absent). Tout ce qui touche `facture_*` est journalisé.
const projette = (r, sel) => {
  if (!sel) return r;
  const o = {}; let vu = false;
  for (const champ of sel.split(',')) {
    if (champ === 'id') { o.id = r.id; vu = true; continue; }
    if (champ === 'data') { o.data = r.data; vu = true; continue; }
    if (champ === 'updated_at') { o.updated_at = new Date().toISOString(); vu = true; continue; }
    const m = /^(?:(\w+):)?data((?:->>?\w+)+)$/.exec(champ); if (!m) continue;
    vu = true;
    let v = r.data; for (const p of m[2].split(/->>?/).filter(Boolean)) v = v == null ? v : v[p];
    const alias = m[1] || m[2].split(/->>?/).filter(Boolean).pop();
    o[alias] = (v != null && /->>\w+$/.test(m[2])) ? String(v) : v;
  }
  return vu ? o : { ...r };
};

// `etat` (mutable, partagé avec le scénario) : `etat.jetonKO` fait échouer la
// recherche par jeton (522), `etat.ecritSans5xx` fait PASSER l'écriture d'une
// facture mais répondre 503 (le cas « incertain » du 16 octobre), `seed` pose
// des clés localStorage, `lignes` ajoute des lignes à la base.
const ouvrir = async (b, { vp, sombre, main, tab, facturesKO, voleur, seed, lignes, etat = {} }) => {
  // Le mode sombre est un réglage SYNCHRONISÉ : le nuage le rattrape au
  // chargement, il doit donc être dans la ligne `main` (pas seulement dans le
  // navigateur) — sinon la capture « sombre » sort en clair.
  const store = new Map([['main', { id: 'main', data: sombre ? { ...main, vinted_dark: true } : main }]]);
  for (const l of lignes || []) store.set(l.id, { id: l.id, data: l.data });
  const journal = { factures: [], interdits: [], mainEcrits: [] };
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((dark) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); if (dark) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {}
    // Le PDF s'ouvre dans une fenêtre : on garde ce qui y est écrit.
    window.__docs = [];
    window.open = () => ({ document: { write: (h) => window.__docs.push(String(h)), close() {} }, focus() {}, print() {}, close() {} });
  }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const meth = req.method();
    const h = { 'access-control-allow-origin': '*' };
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([]);
    if (meth === 'GET') {
      if (etat.jetonKO && /facture_/.test(u) && /jeton/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: h, body: '<html>522</html>' });
      if (facturesKO && /facture_/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: h, body: '<html>522</html>' });
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
      let rows = [...store.values()].sort((a, c) => a.id.localeCompare(c.id));
      const eq = /[?&]id=eq\.([^&]*)/.exec(u); if (eq) rows = rows.filter((r) => r.id === eq[1]);
      const lk = /[?&]id=like\.([^&]*)/.exec(u);
      if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
      for (const m of u.matchAll(/[?&]data->>(\w+)=eq\.([^&]*)/g)) rows = rows.filter((r) => r.data && String(r.data[m[1]]) === m[2]);
      if (!eq && !lk) rows = [];
      return j(rows.map((r) => projette(r, sel)));
    }
    if (meth === 'POST') {
      const prefer = req.headers()['prefer'] || '';
      let lot = []; try { lot = JSON.parse(req.postData() || '[]'); } catch (_) {}
      const rendus = [];
      for (const r of lot) {
        if (/^facture_/.test(r.id)) {
          journal.factures.push({ id: r.id, prefer });
          if (voleur && voleur(r.id, store)) { /* un autre appareil vient de le prendre */ }
          if (!/ignore-duplicates/.test(prefer)) journal.interdits.push('POST ' + prefer + ' ' + r.id);
          if (/ignore-duplicates/.test(prefer) && store.has(r.id)) continue;
        }
        if (r.id === 'main') journal.mainEcrits.push(r.data);
        store.set(r.id, { id: r.id, data: r.data });
        rendus.push(r);
      }
      // Le cas « incertain » (16 octobre) : l'écriture PASSE (la ligne est en
      // base) mais la base répond 503 — l'app ne doit jamais réémettre.
      if (etat.ecritSans5xx && lot.some((r) => /^facture_/.test(r.id))) return route.fulfill({ status: 503, contentType: 'text/html', headers: h, body: '<html>503</html>' });
      return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: /return=representation/.test(prefer) ? JSON.stringify(rendus) : '' });
    }
    if (meth === 'PATCH') {
      // La ligne d'envoi « en attente du profil » devient une vraie ligne
      // d'envoi (status profil → draft) : PostgREST n'applique le PATCH que si
      // les filtres passent — la fausse base fait pareil.
      if (/facture_/.test(u)) { journal.interdits.push(meth + ' ' + u.split('?')[1]); return j([]); }
      const eq = /[?&]id=eq\.([^&]*)/.exec(u);
      const row = eq && store.get(eq[1]);
      let corps = null; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
      let passe = !!row;
      if (row) for (const m of u.matchAll(/[?&]data->>(\w+)=eq\.([^&]*)/g)) if (!(row.data && String(row.data[m[1]]) === m[2])) passe = false;
      if (passe && corps && corps.data) { store.set(row.id, { id: row.id, data: corps.data }); return j([{ id: row.id }]); }
      return j([]);
    }
    if (/facture_/.test(u)) journal.interdits.push(meth + ' ' + u.split('?')[1]);
    return j([]);
  });
  if (seed) await pg.addInitScript((sd) => { try { for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, seed);
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, errs, store, journal };
};
const texte = (pg) => pg.evaluate(() => document.body.innerText || '');
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const mort = (t) => /n'a pas pu s'afficher|Cannot access|is not defined/.test(t);
const confirmer = async (pg) => {
  // La feuille de confirmation de l'app (ConfirmHost) : le bouton « Émettre ».
  await pg.locator('button', { hasText: /^Émettre$/ }).last().click({ timeout: 5000 });
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // ══ A. Réglages → Mon entreprise ═════════════════════════════════════════
  console.log('── A. Réglages → Mon entreprise (profil vide, ancien choix « micro »)');
  await essaie('A', async () => {
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro' }, tab: 'settings' });
    const { pg, store } = o;
    const carte = pg.locator('[data-profil-entreprise]');
    dit(await carte.count() === 1, 'la carte « Mon entreprise » est rendue dans Réglages');
    const siren = pg.locator('input[data-champ="siren"]');
    await siren.fill('123456789');
    await pg.waitForTimeout(300);
    dit(await pg.locator('[data-siren-etat="cle"]').count() === 1, 'une faute de frappe dans le SIREN est signalée (clé de contrôle)');
    dit(await pg.locator('[data-annuaire]').count() === 0, 'et aucun lien d\'annuaire n\'est proposé pour un SIREN faux');
    await siren.fill('123 456 782');
    await pg.waitForTimeout(300);
    dit(await pg.locator('[data-siren-etat="ok"]').count() === 1, 'un SIREN juste est reconnu (espaces admis)');
    const href = await pg.locator('[data-annuaire]').getAttribute('href').catch(() => '');
    dit(/^https:\/\/annuaire-entreprises\.data\.gouv\.fr\/.*123456782/.test(href || ''), 'la consultation publique est un lien vers le site de l\'État, sur son clic', href || 'aucun lien');
    // Rien n'est déduit du SIREN : la TVA reste à choisir (l'ancien « micro » ne
    // décide que la forme).
    const tvaChoisie = await pg.locator('[data-champ="tva"] button[aria-pressed="true"]').count();
    dit(tvaChoisie === 0, 'le SIREN ne décide pas le régime de TVA (aucune option cochée d\'office)');
    dit(await pg.locator('[data-champ="vl"]').count() === 1 && await pg.locator('[data-champ="marge"]').count() === 0,
      'micro-entreprise : le versement libératoire est proposé, le régime de la marge non (TVA pas encore facturée)');
    await pg.locator('[data-champ="tva"] button', { hasText: 'Franchise' }).click();
    await pg.locator('[data-champ="vl"] button', { hasText: 'Oui' }).click();
    await pg.waitForTimeout(2600);
    const p = (store.get('main') || {}).data || {};
    const pe = p.vrm_profil_entreprise || {};
    dit(pe.siren === '123456782' && pe.forme === 'micro' && pe.tva === 'franchise' && pe.vl === true, 'le profil est RANGÉ dans la ligne synchronisée', JSON.stringify({ siren: pe.siren, forme: pe.forme, tva: pe.tva, vl: pe.vl }));
    dit(p.vinted_regime === 'micro', 'et le régime publié pour les rapports suit le profil', String(p.vinted_regime));
    await pg.locator('[data-regles-ouvrir]').click();
    await pg.waitForTimeout(200);
    const regles = await pg.$$eval('[data-regle]', (els) => els.map((e) => ({ id: e.dataset.regle, s: e.dataset.source, d: e.dataset.verifieLe })));
    dit(regles.length >= 4 && regles.every((r) => r.s && /^\d{4}-\d{2}-\d{2}$/.test(r.d || '')), 'chaque règle affichée porte sa source et sa date', regles.map((r) => r.id).join(','));
    dit(regles.some((r) => r.id === 'vl') && regles.some((r) => r.id === 'franchise') && !regles.some((r) => /^marge/.test(r.id)),
      'les règles suivent le profil déclaré (versement libératoire, franchise ; pas de marge)');
    dit(/à faire valider par ton comptable/.test(await texte(pg)), 'et le bloc dit que ce n\'est pas un conseil certain');
    // Société : plus de versement libératoire, et la forme/capital/RCS demandés.
    await pg.locator('[data-champ="forme"] button', { hasText: 'Société' }).click();
    await pg.waitForTimeout(200);
    dit(await pg.locator('[data-champ="vl"]').count() === 0, 'société : le versement libératoire disparaît (il n\'existe qu\'en micro-entreprise)');
    await pg.locator('[data-coordonnees]').click();
    await pg.waitForTimeout(200);
    dit(await pg.locator('input[data-champ="capital"]').count() === 1 && await pg.locator('input[data-champ="rcs"]').count() === 1, 'société : forme, capital et RCS sont demandés pour les factures');
    const regles2 = await pg.$$eval('[data-regle]', (els) => els.map((e) => e.dataset.regle));
    dit(!regles2.includes('urssaf') && regles2.includes('reel'), 'société : aucune règle URSSAF de micro-entreprise', regles2.join(','));
    await pg.screenshot({ path: SC + '/z-fiscal-profil-1512.png', fullPage: true });
    dit(o.errs.length === 0 && !mort(await texte(pg)), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });

  // ══ B. Factures, profil incomplet, anciennes factures ═════════════════════
  console.log('\n── B. Factures : profil incomplet, anciennes factures');
  await essaie('B', async () => {
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vinted_invoices: ANCIENNES }, tab: 'invoices' });
    const { pg } = o;
    const t = await texte(pg);
    const poubelles = await pg.locator('button', { hasText: '🗑' }).count();
    dit(poubelles === 0, 'aucune facture ne se supprime (plus de « 🗑 »)', `${poubelles} bouton(s) de suppression`);
    const nouv = pg.locator('[data-nouvelle-facture]');
    dit(await nouv.count() === 1 && await nouv.isDisabled(), 'profil incomplet : « Nouvelle facture » est grisé (rien ne s\'émet sans régime de TVA ni SIREN)');
    dit(await pg.locator('[data-facture-bloquee]').count() === 1 && /régime de TVA/.test(t) && /SIREN/.test(t), 'et la raison est dite, avec le geste « Compléter »');
    dit(await pg.locator('[data-anciennes-factures]').count() === 1, 'les factures d\'avant restent lisibles (repliées, jamais supprimées)');
    dit(o.errs.length === 0 && !mort(t), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });

  // ══ C. Émettre, corriger par un avoir, exporter, imprimer ════════════════
  for (const [vp, sombre] of [[{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, true]]) {
    console.log(`\n── C. Émettre puis avoir (${vp.width} px, ${sombre ? 'sombre' : 'clair'})`);
    await essaie('C' + vp.width, async () => {
      const o = await ouvrir(b, { vp, sombre, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices' });
      const { pg, store, journal } = o;
      dit(await pg.locator('[data-factures-vide]').count() === 1, 'liste lue et vide : « Aucune facture émise »');
      await pg.locator('[data-nouvelle-facture]').click();
      await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Nike Air Max 90 inventée');
      await pg.locator('[data-facture-form="facture"] input').nth(1).fill('54,00');
      await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client Inventé');
      dit(/TVA non applicable, art\. 293 B du CGI/.test(await pg.locator('[data-apercu-montants]').innerText()), 'l\'aperçu montre la mention tirée du profil (franchise)');
      await pg.locator('[data-emettre]').click();
      await confirmer(pg);
      await pg.waitForTimeout(1500);
      const id1 = `facture_${AN}_000001`;
      const d1 = (store.get(id1) || {}).data;
      dit(!!d1, 'émettre crée la ligne de la facture n° 1', [...store.keys()].filter((k) => /^facture_/.test(k)).join(','));
      dit(journal.factures.length >= 1 && journal.factures.every((x) => /ignore-duplicates/.test(x.prefer)), 'et l\'insertion se fait SANS écrasement (ignore-duplicates)', journal.factures.map((x) => x.prefer).join(' | '));
      dit(d1 && JSON.stringify(d1.mentions) === JSON.stringify(['TVA non applicable, art. 293 B du CGI']) && d1.vendeur && d1.vendeur.siren === '123456782' && /EI$/.test(d1.vendeur.nom) && d1.ttcC === 5400,
        'la facture est FIGÉE avec son vendeur (SIREN, « EI »), sa mention et son montant', d1 ? JSON.stringify({ m: d1.mentions, v: d1.vendeur && d1.vendeur.nom, ttc: d1.ttcC }) : '');
      dit(d1 && /^[0-9a-f]{64}$/.test(d1.empreinte || ''), 'et elle porte son empreinte (SHA-256)');
      dit(await pg.locator(`[data-document="${AN}-000001"]`).count() === 1, 'la facture apparaît dans la liste');
      // ⚠️ Vu au rendu (15 octobre) : l'écran se trompait sur ses propres
      //    factures (« modifiée depuis l'émission » partout). Une fausse alerte
      //    sur un document légal fait cesser de lire les vraies.
      dit(await pg.locator('[data-empreinte-ko]').count() === 0, 'une facture qu\'on vient d\'émettre ne se dit pas « modifiée »');
      dit(/n° 1 à 1, suite continue/.test(await texte(pg)), 'la continuité de la suite est dite');
      // L'avoir.
      await pg.locator(`[data-faire-avoir="${AN}-000001"]`).click();
      dit(/54,00/.test(await pg.locator('[data-facture-form="avoir"] input').nth(1).inputValue()), 'l\'avoir propose ce qui reste de la facture (54,00 €)');
      await pg.locator('[data-emettre]').click();
      await confirmer(pg);
      await pg.waitForTimeout(1500);
      const d2 = (store.get(`facture_${AN}_000002`) || {}).data;
      dit(d2 && d2.type === 'avoir' && d2.origineNumero === `${AN}-000001` && d2.ttcC === 5400, 'l\'avoir prend le n° 2 de la même suite et cite la facture', d2 ? JSON.stringify({ t: d2.type, o: d2.origineNumero }) : 'absent');
      dit((store.get(id1) || {}).data === d1, 'la facture d\'origine n\'est pas réécrite');
      dit(await pg.locator('[data-annulee]').count() === 1, 'la facture se dit « annulée par avoir »');
      dit(await pg.locator(`[data-faire-avoir="${AN}-000001"]`).count() === 0, 'et ne propose plus d\'avoir (plus rien à créditer)');
      dit(journal.interdits.length === 0, 'aucun PATCH, DELETE ni écrasement sur une facture', journal.interdits.join(' | '));
      // Export.
      const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }), pg.locator('[data-exporter-factures]').click()]);
      const csv = fs.readFileSync(await dl.path(), 'utf8');
      dit(csv.includes(`"${AN}-000001"`) && csv.includes(`"${AN}-000002"`) && /"Avoir"/.test(csv) && /"-54,00"/.test(csv) && /"[0-9a-f]{64}"/.test(csv),
        'l\'export porte la facture, l\'avoir signé (−54,00) et les empreintes', csv.split('\n').length + ' lignes');
      // PDF.
      await pg.locator(`[data-document="${AN}-000001"] button`, { hasText: 'PDF' }).click();
      await pg.waitForTimeout(400);
      const html = await pg.evaluate(() => window.__docs[window.__docs.length - 1] || '');
      dit(/FACTURE/.test(html) && html.includes(`${AN}-000001`) && /SIREN 123456782/.test(html) && /293 B/.test(html) && /Julie Exemple EI/.test(html) && !/Cancale Shoes/.test(html),
        'le PDF reprend la facture figée (n°, SIREN, « EI », mention) et aucun logo d\'un autre vendeur', html.length + ' car.');
      dit(await deborde(pg) <= 1, 'aucun débordement horizontal', `${await deborde(pg)} px`);
      await pg.screenshot({ path: SC + `/z-fiscal-factures-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`, fullPage: true });
      dit(o.errs.length === 0 && !mort(await texte(pg)), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
      await o.ctx.close();
    });
  }

  // ══ C'. L'autre sens : une ligne RÉÉCRITE en base est vue ═══════════════
  console.log('\n── C\'. Une facture réécrite en base après émission');
  await essaie('Cbis', async () => {
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices' });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Paire inventée C');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('20');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client C');
    await pg.locator('[data-emettre]').click();
    await confirmer(pg);
    await pg.waitForTimeout(1500);
    const id = `facture_${AN}_000001`;
    const d = (store.get(id) || {}).data;
    dit(!!d && await pg.locator('[data-empreinte-ko]').count() === 0, 'émise : aucune alerte');
    if (d) store.set(id, { id, data: { ...d, ttcC: 100 } });   // quelqu'un change le montant en base
    await pg.goto(`http://localhost:${PORT}/?tab=invoices`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4500);
    dit(await pg.locator('[data-empreinte-ko]').count() === 1, 'réécrite en base : l\'écran le dit (« modifiée depuis l\'émission »)',
      `${await pg.locator('[data-document]').count()} document(s) affiché(s) · ${(await texte(pg)).slice(0, 300).replace(/\n/g, ' | ')}`);
    await o.ctx.close();
  });

  // ══ D. Un autre appareil prend le numéro ════════════════════════════════
  console.log('\n── D. Un autre appareil prend le n° 1 entre la lecture et l\'écriture');
  await essaie('D', async () => {
    let fait = false;
    const voleur = (id, store) => { if (!fait) { fait = true; store.set(id, { id, data: { type: 'facture', numero: 'AUTRE-APPAREIL', creeVia: 'app' } }); return true; } return false; };
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices', voleur });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Paire inventée D');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('30');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client D');
    await pg.locator('[data-emettre]').click();
    await confirmer(pg);
    await pg.waitForTimeout(1800);
    dit(((store.get(`facture_${AN}_000001`) || {}).data || {}).numero === 'AUTRE-APPAREIL', 'la facture de l\'autre appareil n\'est pas écrasée');
    const d2 = (store.get(`facture_${AN}_000002`) || {}).data;
    dit(d2 && d2.numero === `${AN}-000002` && d2.ttcC === 3000, 'la nouvelle facture prend le n° 2, libre', d2 ? d2.numero : 'absente');
    await o.ctx.close();
  });

  // ══ E. Les factures ne se lisent pas ═══════════════════════════════════
  console.log('\n── E. La base ne rend pas les factures');
  await essaie('E', async () => {
    const o = await ouvrir(b, { vp: { width: 390, height: 844 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices', facturesKO: true });
    const { pg, journal } = o;
    const t = await texte(pg);
    dit(await pg.locator('[data-factures-pas-lues]').count() === 1, 'l\'écran dit qu\'il n\'a pas pu lire les factures');
    dit(!/Aucune facture émise/.test(t), 'et n\'affirme jamais « aucune facture » sur une lecture ratée');
    dit(await pg.locator('[data-nouvelle-facture]').isDisabled(), 'et rien ne peut être émis (le numéro serait calculé sur une liste inconnue)');
    dit(journal.factures.length === 0, 'aucune écriture de facture', journal.factures.map((x) => x.id).join(','));
    await o.ctx.close();
  });

  // ══ F. Régime de la marge ══════════════════════════════════════════════
  console.log('\n── F. Société au régime de la marge');
  await essaie('F', async () => {
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, sombre: true, main: { vinted_regime: 'marge', vinted_tva: 20, vrm_profil_entreprise: PROFIL_MARGE }, tab: 'invoices' });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Salomon XT-6 inventée');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('99');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client F');
    const ap = await pg.locator('[data-apercu-montants]').innerText();
    dit(/Régime particulier – Biens d'occasion/.test(ap) && !/TVA 20/.test(ap) && !/293 B/.test(ap), 'l\'aperçu : la mention de la marge, aucune TVA, pas de mention de franchise', ap.replace(/\n/g, ' · '));
    await pg.locator('[data-emettre]').click();
    await confirmer(pg);
    await pg.waitForTimeout(1500);
    const d = (store.get(`facture_${AN}_000001`) || {}).data;
    dit(d && d.mode === 'marge' && d.tvaC === null && /Biens d'occasion/.test((d.mentions || [])[0] || ''), 'la facture figée est au régime de la marge, sans montant de TVA');
    dit(d && d.vendeur && d.vendeur.tvaIntra === 'FR11123456782' && d.vendeur.formeJuridique === 'SAS' && d.vendeur.rcs === 'Saint-Malo', 'et porte n° de TVA, forme, RCS');
    await pg.locator(`[data-document="${AN}-000001"] button`, { hasText: 'PDF' }).click();
    await pg.waitForTimeout(400);
    const html = await pg.evaluate(() => window.__docs[window.__docs.length - 1] || '');
    dit(/Biens d(?:'|&#39;)occasion/.test(html) && !/TVA 20/.test(html) && /SAS au capital de 1000/.test(html), 'le PDF : mention de la marge, aucune TVA, forme et capital');
    await pg.screenshot({ path: SC + '/z-fiscal-marge-1512-sombre.png', fullPage: true });
    dit(o.errs.length === 0 && !mort(await texte(pg)), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });

  // ══ Rendu du profil à 390 px, sombre ═══════════════════════════════════
  console.log('\n── Rendu : Mon entreprise à 390 px (sombre), profil société complet');
  await essaie('R', async () => {
    const o = await ouvrir(b, { vp: { width: 390, height: 844 }, sombre: true, main: { vinted_regime: 'marge', vinted_tva: 20, vrm_profil_entreprise: PROFIL_MARGE }, tab: 'settings' });
    const { pg } = o;
    await pg.locator('[data-coordonnees]').click().catch(() => {});
    await pg.locator('[data-regles-ouvrir]').click().catch(() => {});
    await pg.waitForTimeout(300);
    await pg.locator('[data-profil-entreprise]').scrollIntoViewIfNeeded().catch(() => {});
    dit(await deborde(pg) <= 1, 'aucun débordement horizontal à 390 px', `${await deborde(pg)} px`);
    const t = await pg.locator('[data-profil-entreprise]').innerText().catch(() => '');
    dit(/Régime particulier – Biens d'occasion/.test(t) || /Biens d'occasion/.test(t), 'les règles de la marge sont listées pour ce profil');
    await pg.screenshot({ path: SC + '/z-fiscal-profil-390-sombre.png', fullPage: true });
    dit(o.errs.length === 0 && !mort(await texte(pg)), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });

  // ══ G. Le tableau de bord suit le RÉGIME (relecture du 16 octobre) ═══════
  // Société / EI au réel : « À payer (13,5 %) », « Déclarer sur l'URSSAF »,
  // « (versement libératoire) » et « Prochaine déclaration URSSAF » sont des
  // notions de MICRO — elles s'affichaient pour tout le monde, à côté d'un
  // profil qui dit « tes cotisations ne sont pas un % du CA » (§11).
  console.log('\n── G. Tableau de bord : le régime décide (réel · micro sans VL · micro avec VL)');
  const ym = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
  const URSSAF_MOIS = { mois: [{ ym, n: 3, ca: 1000, nMasq: 0, caMasq: 0, par: { Vinted: { n: 3, ca: 1000 } }, nApres: 0, caApres: 0, nDouble: 0, caDouble: 0, nAilleurs: 0, caAilleurs: 0, ailleurs: {}, declare: null }],
    aDater: { n: 0, ca: 0, par: {} }, ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' }, declare: 'lu', at: Date.now() };
  const SOC_REEL = { v: 1, forme: 'societe', tva: 'assujetti', marge: false, vl: null, tvaIntra: 'FR11123456782', formeJuridique: 'SAS', capital: '1000', rcs: 'Saint-Malo', siren: '123456782', nom: 'Exemple SAS', adresse: '1 rue de la Mer', cp: '35260', ville: 'Cancale' };
  const MICRO_SANS_VL = { ...PROFIL_FRANCHISE, vl: false };
  const MICRO_AVEC_VL = { ...PROFIL_FRANCHISE, vl: true };
  await essaie('G-reel', async () => {
    const m = { vinted_regime: 'reel', vinted_tva: 20, vinted_urssaf_freq: 'mensuel', vrm_profil_entreprise: SOC_REEL, vinted_urssaf_mois: URSSAF_MOIS };
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: m, seed: m, tab: 'dashboard' });
    const { pg } = o;
    const t = await texte(pg);
    dit(!/À payer \(13,5 %\)/i.test(t) && !/135,00/.test(t), 'société au réel : AUCUN « À payer (13,5 %) », aucun 135,00 € inventé');
    dit(!/Déclarer sur l'URSSAF/.test(t) && !/Prochaine déclaration URSSAF/i.test(t), 'ni bouton « Déclarer sur l\'URSSAF », ni échéance de déclaration micro');
    dit(!/\(versement libératoire\)/.test(t), 'et jamais « (versement libératoire) » (une notion de micro)');
    dit(await pg.locator('[data-cotisations-regime="reel"]').count() === 1 && /au réel : pas un % du CA/.test(t), 'à la place : « Cotisations — · au réel : pas un % du CA » (les mots du rapport, §11)');
    dit(/Calculé sur le CA des ventes/.test(t), 'le CA du mois, lui, reste affiché (il sert à sa TVA et à son comptable)');
    // Le CSV du récap comptable mensuel ne chiffre pas non plus.
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.getByText('Exporter (CSV', { exact: false }).first().click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    dit(!/Cotisations\+impot/.test(csv) && /pas un % du CA/.test(csv) && !/;135\.00;/.test(csv), 'le CSV du récap mensuel ne chiffre aucune cotisation au réel', csv.split('\n')[0]);
    dit(o.errs.length === 0 && !mort(t), 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });
  await essaie('G-micro-sans-vl', async () => {
    const m = { vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vrm_profil_entreprise: MICRO_SANS_VL, vinted_urssaf_mois: URSSAF_MOIS };
    const o = await ouvrir(b, { vp: { width: 390, height: 844 }, main: m, seed: m, tab: 'dashboard' });
    const t = await texte(o.pg);
    dit(/À payer \(13,5 %\)/i.test(t) && /Prochaine déclaration URSSAF/i.test(t), 'micro : la carte URSSAF reste entière (l\'autre sens — tout retirer partout passerait sinon)');
    dit(!/\(versement libératoire\)/.test(t) && /somme de cotisations à verser/.test(t), 'mais sans VL déclaré, la phrase ne dit plus « (versement libératoire) »');
    await o.ctx.close();
  });
  await essaie('G-micro-avec-vl', async () => {
    const m = { vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vrm_profil_entreprise: MICRO_AVEC_VL, vinted_urssaf_mois: URSSAF_MOIS };
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: m, seed: m, tab: 'dashboard' });
    const t = await texte(o.pg);
    dit(/\(versement libératoire\)/.test(t), 'VL déclaré : la phrase le dit — la mention suit la DONNÉE, pas une formule figée');
    await o.ctx.close();
  });

  // ══ I. « Émettre » après une écriture incertaine : JAMAIS deux factures ══
  // Reproduit le 16 octobre : l'écriture PASSE mais la base répond 503 ; le
  // formulaire restait ouvert, et un second clic créait une 2e facture pour la
  // même vente (chaque clic tirait un jeton neuf). Le jeton est maintenant
  // celui du FORMULAIRE : le second clic retrouve le document déjà écrit.
  console.log('\n── I. Écriture incertaine puis second clic : un seul document');
  await essaie('I', async () => {
    const etat = {};
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices', etat });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Paire inventée Q');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('45');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client Q');
    etat.ecritSans5xx = true; etat.jetonKO = true;      // l'écriture passe, la base répond 503, le jeton ne se lit plus
    await pg.locator('[data-emettre]').click(); await confirmer(pg); await pg.waitForTimeout(1500);
    const n1 = [...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k)).length;
    dit(await pg.locator('[data-facture-form="facture"]').count() === 1, 'le formulaire reste ouvert après l\'échec (rien n\'est perdu de sa saisie)');
    etat.ecritSans5xx = false; etat.jetonKO = false;    // la base répond de nouveau
    await pg.locator('[data-emettre]').click(); await pg.waitForTimeout(600);
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === 'Émettre'); if (bs.length) bs[bs.length - 1].click(); });
    await pg.waitForTimeout(1800);
    const docs2 = [...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k));
    dit(docs2.length === 1, `UN seul document en base après les deux clics (il y en avait ${n1} après le premier)`, docs2.join(','));
    dit(await pg.locator('[data-facture-form="facture"]').count() === 0, 'et le formulaire est fermé (le document existe, il le dit)');
    await o.ctx.close();
  });

  // ══ J. Une facture sans client ne s'émet pas ; l'avoir ne se répète pas ══
  console.log('\n── J. Le client est une mention : exigé ; l\'avoir ne répète pas sa facture (§7)');
  await essaie('J', async () => {
    const o = await ouvrir(b, { vp: { width: 390, height: 844 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices' });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Paire inventée J');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('120');
    await pg.locator('[data-emettre]').click(); await pg.waitForTimeout(700);
    dit([...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k)).length === 0 && /nom du client est obligatoire/i.test(await texte(pg)),
      'sans nom de client : rien ne s\'émet, et la raison est dite (le document imprimait « Client » à la place du nom)');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client J');
    await pg.locator('[data-emettre]').click(); await confirmer(pg); await pg.waitForTimeout(1500);
    const d1 = (store.get(`facture_${AN}_000001`) || {}).data;
    dit(!!d1 && d1.client && d1.client.nom === 'Client J', 'avec le nom : la facture s\'émet, le client est figé dedans');
    // L'avoir : sa désignation est L'ARTICLE — le badge « Avoir · facture X »
    // et le document (« Sur la facture N° X ») citent déjà l'origine (§7).
    await pg.locator(`[data-faire-avoir="${AN}-000001"]`).click();
    await pg.locator('[data-emettre]').click(); await confirmer(pg); await pg.waitForTimeout(1500);
    const d2 = (store.get(`facture_${AN}_000002`) || {}).data;
    dit(!!d2 && d2.type === 'avoir' && !/Avoir sur la facture/.test((d2.lignes[0] || {}).designation || ''), 'la désignation de l\'avoir est l\'article, pas « Avoir sur la facture X — … »', d2 ? (d2.lignes[0] || {}).designation : 'absent');
    const ligne = await pg.locator(`[data-document="${AN}-000002"]`).innerText().catch(() => '');
    dit((ligne.match(new RegExp(`${AN}-000001`, 'g')) || []).length === 1, 'la liste ne cite la facture d\'origine qu\'UNE fois (badge), plus deux (§7)', ligne.replace(/\n/g, ' · '));
    await o.ctx.close();
  });

  // ══ K. Les anciens numéros (`vinted_invoices`) ne se redonnent jamais ════
  console.log('\n── K. Anciennes factures 2026-000001/2 : la nouvelle suite continue à 3');
  await essaie('K', async () => {
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vinted_invoices: ANCIENNES, vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices' });
    const { pg, store } = o;
    await pg.locator('[data-nouvelle-facture]').click();
    await pg.locator('[data-facture-form="facture"] input').nth(0).fill('Paire inventée K');
    await pg.locator('[data-facture-form="facture"] input').nth(1).fill('40');
    await pg.locator('[data-facture-form="facture"] input[placeholder="Prénom Nom"]').fill('Client K');
    await pg.locator('[data-emettre]').click(); await confirmer(pg); await pg.waitForTimeout(1500);
    const ids = [...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k));
    dit(ids.length === 1 && ids[0] === `facture_${AN}_000003`, 'la nouvelle facture prend le n° 3 — jamais un numéro qu\'une ancienne facture de la même année porte déjà', ids.join(','));
    await o.ctx.close();
  });

  // ══ L. Une vente « en attente du profil » s'émet d'un clic ═══════════════
  // Le serveur garde la vente (ligne d'envoi, status 'profil') quand elle
  // arrive profil incomplet ; une fois « Mon entreprise » complété, c'est ICI
  // qu'elle s'émet — avant le 16 octobre elle n'était JAMAIS facturée.
  console.log('\n── L. La vente gardée « en attente du profil » s\'émet depuis Factures');
  await essaie('L', async () => {
    const attente = { id: 'email_invoice_testcle1', data: { type: 'facture_pro', status: 'profil', sourceId: 'email_sale_testcle1', designation: 'Paire inventée L', prix: '70,00', buyerName: 'Cliente L', buyerEmail: 'cliente@exemple.test', buyerAddress: '2 rue du Port, 35260 Cancale', numero: '12', account: 'compte_test', createdAt: new Date().toISOString(), manque: ['ton SIREN'] } };
    const o = await ouvrir(b, { vp: { width: 1512, height: 950 }, main: { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_FRANCHISE }, tab: 'invoices', lignes: [attente] });
    const { pg, store } = o;
    dit(await pg.locator('[data-envoi-statut="profil"]').count() === 1 && /en attente de ton profil/.test(await texte(pg)), 'la vente gardée est listée « en attente de ton profil »');
    await pg.locator('[data-emettre-attente]').click(); await confirmer(pg); await pg.waitForTimeout(1800);
    const ids = [...store.keys()].filter((k) => /^facture_\d{4}_\d{6}$/.test(k));
    const d = ids.length === 1 ? store.get(ids[0]).data : null;
    dit(!!d && d.sourceId === 'email_sale_testcle1' && d.client && d.client.nom === 'Cliente L' && d.ttcC === 7000, 'un clic émet SA facture (sourceId de la vente, client, 70,00 €)', ids.join(','));
    const ligne = (store.get('email_invoice_testcle1') || {}).data || {};
    dit(ligne.status === 'draft' && ligne.number === (d && d.numero) && /vrm-doc/.test(ligne.html || ''), 'et la ligne d\'envoi devient réelle (numéro + document imprimable, prête pour « Envoyer »)', JSON.stringify({ status: ligne.status, number: ligne.number }));
    // Recliquer ne réémet jamais (le sourceId retrouve la facture vivante).
    await pg.waitForTimeout(400);
    dit(await pg.locator('[data-emettre-attente]').count() === 0, 'le bouton a disparu (la ligne n\'est plus en attente)');
    await o.ctx.close();
  });

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nProfil d\'entreprise et factures : tenus.');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('KO  le banc est tombé :', e && e.message); process.exit(1); });
