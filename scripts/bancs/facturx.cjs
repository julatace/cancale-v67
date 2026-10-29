// Banc : onglet COMPTABILITÉ → « Facturation électronique » (16 octobre).
//   node scripts/bancs/facturx.cjs        (BANC_PORT=4931 par défaut)
//
// Données INVENTÉES (aucune donnée réelle : il vit dans le dépôt, qui est public).
// À 390 px (téléphone émulé) et à 1512 px, il exige :
//   A. profil fiscal complet + régime micro ⇒ une facture se génère depuis une
//      vente : le PDF téléchargé CONTIENT le fichier joint `factur-x.xml` (relation
//      Alternative, /AF au catalogue), dont le XML est BIEN FORMÉ (DOMParser du
//      navigateur), profil BASIC WL, et porte le BON montant, le BON SIREN, la date
//      d'émission (aujourd'hui), la date de la vente, la mention 293 B ; le nom
//      d'acheteur piégé (`<script>&"`) est ÉCHAPPÉ dans le XML (aucune balise
//      brute) et relu à l'identique ; une seconde génération redonne le MÊME
//      numéro ; le numéro est rangé dans `vrm_compta` ;
//   B. le récap e-reporting du mois : total = somme des ventes datées au
//      VERSEMENT (80 Vinted versée ce mois + 40 vendue le mois dernier versée ce
//      mois + 60 eBay = 180 € ; la vente versée le mois dernier exclue), à l'écran,
//      dans le CSV et dans le JSON (somme des lignes == total) ;
//   C. une vente finalisée SANS date de versement ⇒ « au moins » à l'écran ET dans
//      les deux fichiers (statut PARTIEL, `complet:false`, ce qui manque) ;
//   D. profil incomplet (SIREN absent) ⇒ aucune facture (bouton désactivé, aucun
//      téléchargement au clic), la raison ET le geste sont dits ;
//   E. régime jamais choisi ⇒ aucune facture, la raison est dite (on ne retombe
//      pas sur « micro ») ;
//   F. aucun débordement horizontal, aucune erreur d'app.
// On juge des `data-*`, des NOMBRES et du CONTENU des fichiers, jamais un libellé
// d'écran (§6.5) — sauf la présence d'une raison non vide.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } = require('/home/user/cancale-v67/node_modules/pdf-lib');
const zlib = require('zlib');
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4931;
const CAPT = process.env.CAPTURES || os.tmpdir();

const auj = new Date();
const jj = Math.max(4, Math.min(auj.getDate(), 28));
const jour = (d, decal = 0) => new Date(auj.getFullYear(), auj.getMonth() + decal, Math.min(d, jj), 12).toISOString();
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const PIEGE = 'Jean <script>&"';
const vente = (id, titre, prix, statut, date, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date, ...extra });
const VENTES = [
  vente(7001, 'Nike test facture', 80, 'Commande finalisée', jour(jj - 3), { buyerName: PIEGE }),
  vente(7002, 'Adidas test versée le mois dernier', 25, 'Commande finalisée', jour(10, -1)),
  vente(7003, 'Puma test annulée', 30, 'Commande annulée', jour(jj - 1)),
  vente(7004, 'Asics test vendue le mois dernier', 40, 'Commande finalisée', jour(25, -1)),
];
const VERS = { 7001: jour(jj - 2), 7002: jour(12, -1), 7004: jour(1) };
const SANS_VERSEMENT = vente(7005, 'Salomon test pas encore datée', 33, 'Commande finalisée', jour(jj - 1));
const EBAY = [{ orderId: 'E9', orderPaymentStatus: 'PAID', creationDate: jour(jj - 2), pricingSummary: { total: { value: '66.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '65.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '5.00', currency: 'EUR' }, lineItems: [{ title: 'Salomon test ebay' }] }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PROFIL_OK = { nom: 'Boutique Test', siret: '73282932000074', adresse: '1 rue des Tests', codePostal: '35260', ville: 'Cancale' };
const ATTENDU = { total: '180.00', n: 3, siren: '732829320' };

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

const lignes = ({ profil, sansVersement }) => [
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  ...(profil ? [{ id: 'vrm_pro_facture', data: profil }] : []),
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: sansVersement ? [...VENTES, SANS_VERSEMENT] : VENTES } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
];
const brancher = async (pg, rows) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() === 'POST' || req.method() === 'PATCH') return j([]);
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
  const b = document.querySelector('[data-fe-facture="vinted:7001"]');
  return {
    carte: !!document.querySelector('[data-fe-carte]'),
    etat: at('[data-fe-carte]', 'data-fe-etat'), nuage: at('[data-fe-carte]', 'data-fe-nuage'),
    total: at('[data-fe-recap]', 'data-recap-total'), n: at('[data-fe-recap]', 'data-recap-n'), partiel: at('[data-fe-recap]', 'data-recap-partiel'),
    recapTxt: (document.querySelector('[data-fe-recap]') || {}).innerText || '',
    raison: (document.querySelector('[data-fe-raison]') || {}).innerText || '',
    btn: b ? { disabled: b.disabled } : null,
    nVentes: document.querySelectorAll('[data-fe-vente]').length,
    msg: (document.querySelector('[data-fe-msg]') || {}).innerText || '',
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const attendre = async (pg, f, ms = 9000) => { const t0 = Date.now(); for (;;) { const r = await lire(pg); if (f(r) || Date.now() - t0 > ms) return r; await pg.waitForTimeout(250); } };

// Le fichier joint d'un PDF : Names → EmbeddedFiles → [nom, filespec] → EF/F.
const piecesJointes = async (octets) => {
  const doc = await PDFDocument.load(octets);
  const out = {};
  const names = doc.catalog.lookup(PDFName.of('Names'), PDFDict);
  const ef = names && names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
  const arr = ef && ef.lookup(PDFName.of('Names'), PDFArray);
  for (let i = 0; arr && i < arr.size(); i += 2) {
    const nom = arr.lookup(i).decodeText ? arr.lookup(i).decodeText() : String(arr.lookup(i));
    const fsp = arr.lookup(i + 1, PDFDict);
    const st = fsp.lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'));
    let b = st instanceof PDFRawStream ? Buffer.from(st.contents) : Buffer.from(st.getContents ? st.getContents() : []);
    const filtre = st.dict.lookup(PDFName.of('Filter'));
    if (filtre && String(filtre) === '/FlateDecode') b = zlib.inflateSync(b);
    out[nom] = { texte: b.toString('utf8'), af: fsp.lookup(PDFName.of('AFRelationship')) ? String(fsp.lookup(PDFName.of('AFRelationship'))) : '' };
  }
  const af = doc.catalog.lookup(PDFName.of('AF'));
  return { pieces: out, afCatalogue: !!af, pages: doc.getPageCount() };
};
const telecharge = async (pg, clic, ms = 8000) => {
  const p = pg.waitForEvent('download', { timeout: ms }).catch(() => null);
  try { await clic(); } catch (_) { /* un banc ne meurt pas, il rapporte : l'absence de téléchargement sera dite */ }
  const d = await p; if (!d) return null;
  const f = await d.path(); return { nom: d.suggestedFilename(), octets: fs.readFileSync(f) };
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ouvrir = async (vp, { profil, regime, sansVersement }) => {
      const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      pg.setDefaultTimeout(5000);
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript((rg) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (rg) localStorage.setItem('vinted_regime', JSON.stringify(rg)); } catch (_) {} }, regime || null);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await brancher(pg, lignes({ profil, sansVersement }));
      await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
      await ouvrirAvanceCompta(pg); // (29 oct.) ces cartes vivent dans « Avancé », replié
      return { ctx, pg, errs };
    };
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · A/B : profil complet, régime micro`);
      {
        const { ctx, pg, errs } = await ouvrir(vp, { profil: PROFIL_OK, regime: 'micro' });
        const r0 = await attendre(pg, (r) => r.carte && r.total != null && r.etat === 'ok' && r.nuage === '1' && r.btn && !/encore en lecture/.test(r.recapTxt), 20000);
        dit(r0.carte, 'la carte « Facturation électronique » est dans Comptabilité');
        dit(r0.etat === 'ok', 'profil complet + micro ⇒ facturation possible', r0.etat + ' · ' + r0.raison);
        dit(r0.total === ATTENDU.total && Number(r0.n) === ATTENDU.n, 'récap du mois à l’écran = 80 + 40 + 60 = 180 € (3 ventes, datées au versement)', `${r0.total} · ${r0.n}`);
        dit(r0.partiel === '0' && !/au moins/i.test(r0.recapTxt), 'tout est lu : rien n’est dit partiel', r0.partiel);
        dit(r0.btn && !r0.btn.disabled, 'le bouton « Facture » de la vente est actif');
        // ── La facture
        const dl = await telecharge(pg, () => pg.click('[data-fe-facture="vinted:7001"]'));
        dit(!!dl && /\.pdf$/.test(dl.nom), 'un PDF est téléchargé', dl ? dl.nom : 'aucun téléchargement');
        if (dl) {
          let pj = null;
          try { pj = await piecesJointes(dl.octets); } catch (e) { dit(false, 'le PDF se relit avec pdf-lib', String(e.message).slice(0, 120)); }
          const x = pj && pj.pieces['factur-x.xml'];
          dit(!!x, 'le PDF contient le fichier joint factur-x.xml', pj ? Object.keys(pj.pieces).join(',') : '');
          dit(pj && pj.afCatalogue && x && x.af === '/Alternative', 'relation « Alternative » et /AF au catalogue', x ? x.af : '');
          if (x) {
            const xml = x.texte;
            dit(!/<script>/i.test(xml) && /&lt;script&gt;&amp;&quot;/.test(xml), 'le nom d’acheteur piégé est échappé dans le XML (aucune balise brute)');
            const v = await pg.evaluate((s) => {
              const d = new DOMParser().parseFromString(s, 'application/xml');
              if (d.getElementsByTagName('parsererror').length) return { ok: false };
              const t = (n) => { const e = d.getElementsByTagNameNS('*', n)[0]; return e ? e.textContent : null; };
              const occ = d.getElementsByTagNameNS('*', 'OccurrenceDateTime')[0];
              return { ok: true, racine: d.documentElement.localName, guideline: t('GuidelineSpecifiedDocumentContextParameter'), id: t('ID'), total: t('GrandTotalAmount'), du: t('DuePayableAmount'),
                siren: (d.getElementsByTagNameNS('*', 'SpecifiedLegalOrganization')[0] || {}).textContent, acheteur: (d.getElementsByTagNameNS('*', 'BuyerTradeParty')[0] || {}).textContent,
                emise: (d.getElementsByTagNameNS('*', 'IssueDateTime')[0] || {}).textContent, vente: occ ? occ.textContent : null, exo: t('ExemptionReason'), cat: t('CategoryCode') };
            }, xml);
            dit(v.ok && v.racine === 'CrossIndustryInvoice', 'le XML est bien formé (DOMParser) et c’est une CrossIndustryInvoice', JSON.stringify(v).slice(0, 120));
            if (v.ok) {
              dit(/basicwl/.test(v.guideline || ''), 'profil BASIC WL déclaré', v.guideline);
              dit(v.total === '80.00' && v.du === '0.00', 'le bon montant (80,00) et rien à payer (déjà payé)', `${v.total} · ${v.du}`);
              dit((v.siren || '').trim() === ATTENDU.siren, 'le bon SIREN (tiré du SIRET du profil)', v.siren);
              dit((v.emise || '').trim() === ymd(auj), 'la date d’émission = aujourd’hui', v.emise);
              dit((v.vente || '').trim() === ymd(VENTES[0].date), 'la date de la vente', v.vente);
              dit((v.acheteur || '').trim() === PIEGE, 'le nom de l’acheteur relu à l’identique (échappé, pas effacé)', v.acheteur);
              dit(/293 B/.test(v.exo || '') && v.cat === 'E', 'mention « art. 293 B du CGI », catégorie E', `${v.exo} · ${v.cat}`);
            }
          }
          dit(pj && pj.pages === 1, 'une page lisible', pj ? String(pj.pages) : '');
          await pg.waitForTimeout(900);
          const stock = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_compta') || 'null'); } catch (_) { return null; } });
          const num = stock && stock.facturx && stock.facturx.parVente && stock.facturx.parVente['vinted:7001'];
          dit(num && /^FX-\d{4}-0001$/.test(num.numero), 'le numéro est rangé dans vrm_compta (FX-AAAA-0001)', JSON.stringify(num));
          const dl2 = await telecharge(pg, () => pg.click('[data-fe-facture="vinted:7001"]'));
          const stock2 = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_compta') || 'null'); } catch (_) { return null; } });
          dit(dl2 && dl2.nom === dl.nom && stock2.facturx.compteur[String(auj.getFullYear())] === 1, 'regénérer la même vente redonne le même numéro (aucun trou)', dl2 ? dl2.nom : '');
        }
        // ── Le récap
        const csv = await telecharge(pg, () => pg.click('[data-fe-recap-csv]'));
        const js = await telecharge(pg, () => pg.click('[data-fe-recap-json]'));
        dit(!!csv && !!js, 'CSV et JSON téléchargés', `${csv && csv.nom} · ${js && js.nom}`);
        if (csv) { const t = csv.octets.toString('utf8'); dit(/"TOTAL";"";"180\.00"/.test(t) && /"complet"/.test(t) && !/au moins/i.test(t), 'CSV : TOTAL 180.00, statut complet', t.split('\n').find((l) => /TOTAL/.test(l))); }
        if (js) {
          let o = null; try { o = JSON.parse(js.octets.toString('utf8')); } catch (_) {}
          const somme = o ? o.ventes.reduce((s, v) => s + Math.round(Number(v.montant) * 100), 0) : -1;
          dit(o && o.total === '180.00' && o.nombre === 3 && o.complet === true && somme === 18000, 'JSON : total 180.00 = somme des 3 lignes, complet', o ? `${o.total} · ${o.nombre} · ${somme}` : 'illisible');
          dit(o && !o.ventes.some((v) => v.reference === 'vinted:7002'), 'la vente versée le mois dernier n’est pas dans ce mois');
          dit(o && o.vendeur && o.vendeur.siren === ATTENDU.siren, 'le JSON porte le SIREN du vendeur');
        }
        const rf = await lire(pg);
        dit(rf.sw <= rf.cw + 1, 'aucun débordement horizontal', `${rf.sw} > ${rf.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        const carte = await pg.$('[data-fe-carte]');
        if (carte) { await pg.setViewportSize({ width: vp.width, height: 2600 }); await pg.waitForTimeout(300); await carte.scrollIntoViewIfNeeded(); await carte.screenshot({ path: path.join(CAPT, `facturx-ok-${vp.width}.png`) }); }
        await ctx.close();
      }
      console.log(`── ${vp.width} px · C : une vente sans date de versement`);
      {
        const { ctx, pg, errs } = await ouvrir(vp, { profil: PROFIL_OK, regime: 'micro', sansVersement: true });
        const r = await attendre(pg, (x) => x.total != null && x.partiel === '1');
        dit(r.partiel === '1' && /au moins/i.test(r.recapTxt) && r.total === '180.00', 'partiel ⇒ « au moins 180 € » à l’écran, ce qui manque dit', `${r.partiel} · ${r.total}`);
        const csv = await telecharge(pg, () => pg.click('[data-fe-recap-csv]'));
        const js = await telecharge(pg, () => pg.click('[data-fe-recap-json]'));
        if (csv) { const t = csv.octets.toString('utf8'); dit(/PARTIEL/.test(t) && /AU MOINS/i.test(t) && /sans date de versement/.test(t), 'le CSV dit PARTIEL / au moins et ce qui manque'); } else dit(false, 'CSV partiel téléchargé');
        if (js) { const o = JSON.parse(js.octets.toString('utf8')); dit(o.complet === false && o.total_au_moins === true && o.manque.length > 0, 'le JSON dit complet:false, total_au_moins, manque', JSON.stringify(o.manque).slice(0, 120)); } else dit(false, 'JSON partiel téléchargé');
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
      console.log(`── ${vp.width} px · D : profil incomplet (SIREN absent)`);
      {
        const { ctx, pg, errs } = await ouvrir(vp, { profil: { nom: 'Boutique Test', adresse: '1 rue', codePostal: '35260', ville: 'Cancale' }, regime: 'micro' });
        const r = await attendre(pg, (x) => x.etat === 'siren' && x.btn);
        dit(r.etat === 'siren', 'SIREN absent ⇒ pas de facture', r.etat);
        dit(r.btn && r.btn.disabled, 'le bouton « Facture » est désactivé');
        dit(/SIREN/.test(r.raison) && /Ton entreprise/.test(r.raison) && !/Profil fiscal/.test(r.raison), 'la raison ET le geste sont dits', r.raison.slice(0, 140));
        const dl = await telecharge(pg, () => pg.click('[data-fe-facture="vinted:7001"]', { force: true }).catch(() => {}), 2500);
        dit(!dl, 'aucun PDF ne part');
        dit(r.total === ATTENDU.total, 'le récap, lui, reste disponible (il ne dépend pas du profil)', r.total);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        const carte = await pg.$('[data-fe-carte]');
        if (carte) { await pg.setViewportSize({ width: vp.width, height: 2600 }); await pg.waitForTimeout(300); await carte.scrollIntoViewIfNeeded(); await carte.screenshot({ path: path.join(CAPT, `facturx-incomplet-${vp.width}.png`) }); }
        await ctx.close();
      }
      console.log(`── ${vp.width} px · E : régime jamais choisi`);
      {
        const { ctx, pg, errs } = await ouvrir(vp, { profil: PROFIL_OK, regime: null });
        const r = await attendre(pg, (x) => x.etat === 'regime' && x.btn);
        dit(r.etat === 'regime' && r.btn && r.btn.disabled && /régime/i.test(r.raison), 'régime non renseigné ⇒ pas de facture, la raison est dite (pas de repli sur « micro »)', `${r.etat} · ${r.raison.slice(0, 100)}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc se déroule', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
