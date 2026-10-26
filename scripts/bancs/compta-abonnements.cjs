// Banc : l'onglet COMPTABILITÉ — abonnements récurrents, profil fiscal, CA par
// période (16 octobre).
//
// Données INVENTÉES (aucune donnée réelle : il vit dans le dépôt, qui est public).
// Il exige, à 390 px (téléphone émulé) et à 1512 px :
//   1. le CA par période (mois en cours) lit les règles existantes — VENDU
//      (`ventesFaites` : 80 € finalisée + 50 € en cours + 60 € eBay = 190 €),
//      FINALISÉ au jour de la vente (80 + 60 = 140 €), REÇU au jour du versement
//      (80 + 40 vendue le mois dernier versée ce mois + 60 eBay = 180 €) ;
//   2. un abonnement de 10 €/mois commencé le 1er du mois il y a 3 mois compte
//      QUATRE échéances (la règle : payé d'avance, le mois du début et le mois en
//      cours comptent) ⇒ 10 € ce mois-ci, 40 € cumulés, le résultat baisse de
//      40 €, le CA déclaré et les trois CA par période NE BOUGENT PAS ;
//   3. une fin avant le début est REFUSÉE, et dite ;
//   4. un SIREN à la clé fausse est dit invalide (sans bloquer), un vrai est dit
//      valide, un SIRET aussi ;
//   5. aucun débordement horizontal, aucune erreur d'app.
// On juge des `data-*` et des NOMBRES, jamais un libellé (§6.5).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4571;
const CAPT = process.env.CAPTURES || os.tmpdir();

const auj = new Date();
const J = Math.max(4, Math.min(auj.getDate(), 28));   // jours du mois en cours utilisables
const jour = (d, decal = 0) => new Date(auj.getFullYear(), auj.getMonth() + decal, d, 12).toISOString();
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const cur = ym(auj);
const vente = (id, titre, prix, statut, date) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date });
// Si on est en début de mois, les ventes « de ce mois » restent dans ce mois
// (jamais dans le futur : `J` est au moins 4, le banc ne tourne pas avant).
const jj = Math.min(auj.getDate(), J);
const VENTES = [
  vente(8001, 'Nike test finalisée', 80, 'Commande finalisée', jour(Math.max(1, jj - 3))),
  vente(8002, 'Adidas test en cours', 50, 'Paiement validé', jour(Math.max(1, jj - 1))),
  vente(8003, 'Puma test annulée', 30, 'Commande annulée', jour(Math.max(1, jj - 1))),
  vente(8004, 'Asics test vendue le mois dernier', 40, 'Commande finalisée', jour(20, -1)),
];
const VERS = { 8001: jour(Math.max(1, jj - 2)), 8004: jour(1) };
const EBAY = [{ orderId: 'E9', orderPaymentStatus: 'PAID', creationDate: jour(Math.max(1, jj - 2)), pricingSummary: { total: { value: '66.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '65.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '5.00', currency: 'EUR' }, lineItems: [{ title: 'Salomon test ebay' }] }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const rows = [
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
];
// Le CA déclaré publié par l'écran Ventes (`vinted_urssaf_mois`) : 500 € ce mois.
const URSSAF = { mois: [{ ym: cur, n: 3, ca: 500 }], at: Date.now() };
const debutAbo = new Date(auj.getFullYear(), auj.getMonth() - 3, 1);
const debutIso = `${debutAbo.getFullYear()}-${String(debutAbo.getMonth() + 1).padStart(2, '0')}-01`;
const memeAnnee = debutAbo.getFullYear() === auj.getFullYear();

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const ecritures = [];
const brancher = async (pg) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() === 'POST' || req.method() === 'PATCH') { try { ecritures.push(JSON.parse(req.postData() || 'null')); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

const lire = (pg) => pg.evaluate(() => {
  const at = (sel, a) => { const e = document.querySelector(sel); return e ? e.getAttribute(a) : null; };
  const num = (v) => (v == null || v === '') ? null : Number(v);
  const ca = {};
  for (const e of document.querySelectorAll('[data-ca-cur]')) ca[e.getAttribute('data-ca-cur')] = num(e.getAttribute('data-ca-eur'));
  const abo = document.querySelector('[data-abo]');
  return {
    resultat: num(at('[data-compta-resultat]', 'data-compta-resultat')),
    caDecl: num(at('[data-compta-resultat]', 'data-compta-ca')),
    charges: num(at('[data-compta-resultat]', 'data-compta-charges')),
    kpiAbo: num(at('[data-compta-kpi="abo"]', 'data-eur')),
    kpiMois: num(at('[data-compta-kpi="mois"]', 'data-eur')),
    kpiAnnee: num(at('[data-compta-kpi="annee"]', 'data-eur')),
    caEtat: at('[data-ca-periode]', 'data-ca-etat'), caPartiel: at('[data-ca-periode]', 'data-ca-partiel'), ca,
    abo: abo ? { cumul: num(abo.getAttribute('data-abo-cumul')), n: num(abo.getAttribute('data-abo-echeances')) } : null,
    nAbo: document.querySelectorAll('[data-abo]').length,
    aboErr: (document.querySelector('[data-abo-erreur]') || {}).innerText || '',
    siren: at('[data-siren]', 'data-siren'), sirenTxt: (document.querySelector('[data-siren]') || {}).innerText || '',
    profil: at('[data-profil-fiscal]', 'data-profil-fiscal'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); for (;;) { const r = await lire(pg); if (f(r) || Date.now() - t0 > ms) return r; await pg.waitForTimeout(250); } };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript((u) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_urssaf_mois', JSON.stringify(u)); } catch (_) {} }, URSSAF);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await brancher(pg);
      await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
      const r0 = await attendre(pg, (r) => r.caEtat === 'lu' && r.ca.recu != null);
      dit(r0.caEtat === 'lu', 'le CA par période est lu', r0.caEtat);
      dit(r0.ca.vendu === 190, 'VENDU ce mois = 80 finalisée + 50 en cours + 60 eBay (l’annulée et la vente du mois dernier exclues)', JSON.stringify(r0.ca));
      dit(r0.ca.finalise === 140, 'FINALISÉ ce mois (au jour de la vente) = 80 + 60', String(r0.ca.finalise));
      dit(r0.ca.recu === 180, 'REÇU (versé) ce mois = 80 + 40 (vendue le mois dernier, versée ce mois) + 60 eBay', String(r0.ca.recu));
      dit(r0.caPartiel === '0', 'toutes les sources lues : rien n’est dit partiel', r0.caPartiel);
      dit(r0.caDecl === 500 && r0.charges === 0 && r0.resultat === 500, 'avant : CA déclaré 500, charges 0, résultat 500', `${r0.caDecl} · ${r0.charges} · ${r0.resultat}`);
      await pg.setViewportSize({ width: vp.width, height: 3400 }); await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(CAPT, `compta-avant-${vp.width}.png`) });
      await pg.setViewportSize(vp); await pg.waitForTimeout(200);

      // ── Un abonnement de 10 €/mois commencé le 1er du mois il y a 3 mois.
      // (16 oct.) Le formulaire est replié derrière « + Ajouter un abonnement » :
      // on l'ouvre comme lui (un formulaire ouvert d'office n'existe plus).
      const ouvrirAbo = async () => { if (!(await pg.$('[data-abo-libelle]'))) { const o = await pg.$('[data-abo-ouvrir]'); if (o) await o.click(); await pg.waitForSelector('[data-abo-libelle]', { timeout: 3000 }).catch(() => {}); } };
      try {
        await ouvrirAbo();
        await pg.fill('[data-abo-libelle]', 'Logiciel test');
        await pg.fill('[data-abo-montant]', '10');
        await pg.selectOption('[data-abo-periode]', 'mois');
        await pg.fill('[data-abo-debut]', debutIso);
        await pg.click('[data-abo-ajouter]');
      } catch (e) { dit(false, 'le formulaire d’abonnement existe et se remplit', String(e.message).slice(0, 120)); }
      const r1 = await attendre(pg, (r) => r.abo != null, 3000);
      dit(r1.abo && r1.abo.n === 4 && r1.abo.cumul === 40, 'l’abonnement compte 4 échéances (mois du début → mois en cours) : 40 € cumulés', JSON.stringify(r1.abo));
      dit(r1.kpiAbo === 10, 'la charge d’abonnement du mois en cours = 10 €', String(r1.kpiAbo));
      dit(r1.kpiMois === 10, 'les charges du mois = 10 €', String(r1.kpiMois));
      if (memeAnnee) {
        dit(r1.kpiAnnee === 40 && r1.charges === 40, 'les charges de l’année = 40 €', `${r1.kpiAnnee} · ${r1.charges}`);
        dit(r1.resultat === 460, 'le résultat baisse d’autant : 500 − 40 = 460', String(r1.resultat));
      }
      dit(r1.caDecl === 500, 'le CA déclaré NE BOUGE PAS (une charge n’est jamais du CA)', String(r1.caDecl));
      dit(r1.ca.vendu === r0.ca.vendu && r1.ca.finalise === r0.ca.finalise && r1.ca.recu === r0.ca.recu, 'les trois CA par période ne bougent pas', JSON.stringify(r1.ca));
      await pg.waitForTimeout(900);
      const stock = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_compta') || 'null'); } catch (_) { return null; } });
      const a = stock && Array.isArray(stock.abonnements) && stock.abonnements[0];
      dit(a && a.montant === 10 && a.periode === 'mois' && a.debut === debutIso && a.fin === '', 'l’abonnement est rangé dans `vrm_compta` (synchronisé)', JSON.stringify(a));

      // ── Une fin avant le début est refusée, et dite.
      await ouvrirAbo();
      await pg.fill('[data-abo-libelle]', 'Mauvais');
      await pg.fill('[data-abo-montant]', '5');
      await pg.fill('[data-abo-debut]', `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-10`);
      await pg.fill('[data-abo-fin]', debutIso);
      await pg.click('[data-abo-ajouter]');
      await pg.waitForTimeout(300);
      const r2 = await lire(pg);
      dit(r2.nAbo === 1 && /avant/.test(r2.aboErr), 'une fin avant le début n’est pas ajoutée, et c’est dit', `${r2.nAbo} · ${r2.aboErr}`);

      // ── Le SIREN.
      dit(r2.profil === 'lu', 'le profil fiscal est lu (la ligne `vrm_pro_facture` a répondu)', r2.profil);
      try {
        await pg.fill('[data-profil-champ="siret"]', '123456789');
        let r3 = await lire(pg);
        dit(r3.siren === 'invalide', 'un SIREN à la clé fausse est dit invalide', r3.sirenTxt.slice(0, 120));
        const val = await pg.inputValue('[data-profil-champ="siret"]');
        dit(val === '123456789', 'il n’est pas bloqué : la saisie reste', val);
        await pg.fill('[data-profil-champ="siret"]', '732 829 320');
        r3 = await lire(pg);
        dit(r3.siren === 'ok', 'un vrai SIREN (espaces compris) est dit valide', r3.sirenTxt.slice(0, 120));
        await pg.fill('[data-profil-champ="siret"]', '73282932000074');
        r3 = await lire(pg);
        dit(r3.siren === 'ok' && /SIRET/.test(r3.sirenTxt), 'un vrai SIRET est dit valide', r3.sirenTxt.slice(0, 120));
        await pg.fill('[data-profil-champ="siret"]', '73282932000075');
        r3 = await lire(pg);
        dit(r3.siren === 'invalide', 'un SIRET à la clé fausse est dit invalide', r3.sirenTxt.slice(0, 120));
        await pg.waitForTimeout(900);
        const w = ecritures.flat().filter((x) => x && x.id === 'vrm_pro_facture').pop();
        dit(w && w.data && w.data.siret === '73282932000075', 'la saisie part dans `vrm_pro_facture` (même ligne que Réglages)', JSON.stringify(w && w.data));
      } catch (e) { dit(false, 'le profil fiscal se remplit', String(e.message).slice(0, 120)); }

      const rf = await lire(pg);
      dit(rf.sw <= rf.cw + 1, 'aucun débordement horizontal', `${rf.sw} > ${rf.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await pg.evaluate(() => window.scrollTo(0, 0));
      await pg.setViewportSize({ width: vp.width, height: 3400 }); await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(CAPT, `compta-apres-${vp.width}.png`) });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc se déroule', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
