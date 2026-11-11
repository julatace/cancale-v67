// ═══════════════════════════════════════════════════════════════════════════
// BANC : RETOURS ET LITIGES — bordereaux de retour, « Tout imprimer », pas à pas
//        (11 nov., lot retours-litiges · node scripts/bancs/retours-litiges.cjs —
//         après `npm run build` ; BANC_PORT=…, BANC_DIST=…, BANC_SHOTS=…)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public) à la forme mesurée le 11 nov. :
//   achats `orders_purchased` : 9501 (Dunk, bordereau de retour, fiche N°31 reliée par SON
//   clic `buyFromId`), 9502 (Samba, bordereau de retour + e-mail « a été remboursée »
//   45,90 €), 9503 (MÊME TITRE que 9501, aucun bordereau ⇒ jamais une carte) ;
//   `email_bordretour_{tx}` (scalaires + PDF), `email_rembachat_9502` ;
//   une vente à expédier 9420 (bordereau e-mail) pour ouvrir « Tout imprimer » ;
//   une vente en retour 9401 (transaction 440, N°21) pour la feuille « Pas à pas ».
// Il exige (390 px tactile et 1512 px, clair ; 390 sombre) : Achats → « Retours » =
// EXACTEMENT 9501 et 9502, N°31 par identité (pas la jumelle), « À déposer avant le … »
// en ambre (< 48 h), « Pas encore remboursé » / « Remboursé 45,90 € » ; « Imprimer le
// bordereau » ouvre la visionneuse (PDF lu par SON n°) ; « Tout imprimer » porte une section
// « Retours » (9501 seule : 9502 est remboursée) ; Litiges → « Pas à pas » : délais avec
// leur source, « Paire revenue · N°21 », le lien pour contester ; aucun rouge, rien ne
// déborde, aucune requête vers Vinted, aucune erreur.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4419;
const SHOTS = process.env.BANC_SHOTS || os.tmpdir();
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansH = (h) => new Date(MAINTENANT + h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/></svg>`);
const T = 'Nike Dunk Low noir taille 42';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 500)); } };

async function lignes() {
  const { PDFDocument, StandardFonts } = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const pdf = async (t) => { const d = await PDFDocument.create(); const p = d.addPage([283.46, 425.2]); p.drawText('ETIQUETTE ' + t, { x: 30, y: 200, size: 14, font: await d.embedFont(StandardFonts.Helvetica) }); return Buffer.from(await d.save()).toString('base64'); };
  const achat = (tx, title, eur, status, h) => ({ transaction_id: tx, title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'completed', date: ilYaH(h), photo: { url: PH('#636366') } });
  const vente = (tx, title, status, tus, h) => ({ transaction_id: tx, title, status, transaction_user_status: tus, conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' } });
  return [
    { id: 'main', data: { vinted_annonce_numeros: { i401: { numero: '21', title: T, auto: false }, i420: { numero: '40', title: 'Asics Gel 1130 43', auto: false }, i9501: { numero: '31', title: T, auto: false, buyFromId: '9501' } }, vinted_used_numeros: [21, 31, 40] } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [
      achat(9501, T, 45.9, 'Retour initié', 120), achat(9502, 'Adidas Samba OG blanc 41', 45.9, 'Retour initié', 200), achat(9503, T, 50, 'Commande finalisée', 300),
    ] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [vente(9401, T, 'Retour initié', 'needs_action', 120), vente(9420, 'Asics Gel 1130 43', 'Le paiement a été validé', 'needs_action', 10)] } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: 'harvest_111_txn_9401', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 9401, item_id: 'i401', status: 440, status_title: '', shipment: { status_title: 'colis déposé en point relais' } } } } },
    { id: 'harvest_111_txn_9420', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 9420, item_id: 'i420' } } } },
    { id: 'email_bord_9420', data: { transaction: '9420', uid: '111', filename: 'bordereau-9420.pdf', modele: 'Asics Gel 1130 43', article: 'Asics Gel 1130 43', receivedAt: ilYaH(2), pdfB64: await pdf('9420'), suivi: '81000420' } },
    { id: 'email_bordretour_9501', data: { type: 'bordereau-retour', sens: 'achat', transaction: '9501', suivi: '82000501', dateLimite: '', dateLimiteIso: dansH(30), article: T, uid: '111', account: 'compte_a', filename: 'Bon-Retour-Vinted-9501.pdf', pdfB64: await pdf('RETOUR9501'), receivedAt: ilYaH(20) } },
    { id: 'email_bordretour_9502', data: { type: 'bordereau-retour', sens: 'achat', transaction: '9502', suivi: '82000502', dateLimite: '', dateLimiteIso: dansH(200), article: 'Adidas Samba OG blanc 41', uid: '111', account: 'compte_a', filename: 'Bon-Retour-Vinted-9502.pdf', pdfB64: await pdf('RETOUR9502'), receivedAt: ilYaH(100) } },
    { id: 'email_rembachat_9502', data: { type: 'remboursement-achat', transaction: '9502', montant: 45.9, estime: '2026-11-14', receivedAt: ilYaH(5) } },
    { id: 'transp_mondialrelay_82000501', data: { suivi: '82000501', carrier: 'mondialrelay', etat: 'en_route', libelle: 'Déposé en point relais', etatAt: ilYaH(3), lu: ilYaH(2) } },
  ];
}

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, ROWS, { sombre = false } = {}) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], versVinted = [], lusPdf = [], selectData = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/vinted\.(fr|com)/i.test(r.request().url()) && !/images\d*\.vinted\.net/.test(r.request().url())) versVinted.push(r.request().url());
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/email_bordretour_/.test(u) && /select=data(&|$)/.test(u)) selectData.push(u);
    if (/email_bordretour_\d+.*pdfB64/.test(u)) lusPdf.push(u);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, versVinted, lusPdf, selectData };
}
const rougeIci = (pg, sel) => pg.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
  return [...el.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); });
}, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const ROWS = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const cas = [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, true]];
    for (const [vp, sombre] of cas) {
      const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${nom}`);
      const P = await preparer(b, vp, ROWS, { sombre });
      const { pg } = P;
      await essaie('Achats → Retours', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-retour-achat]', { timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => [...document.querySelectorAll('[data-retour-achat]')].map((x) => ({
          tx: x.getAttribute('data-retour-achat'), num: x.getAttribute('data-retour-num'), presse: x.getAttribute('data-retour-presse'), remb: x.getAttribute('data-retour-rembourse'), montant: x.getAttribute('data-retour-montant'),
          limite: (x.querySelector('[data-retour-phrase-limite]') || {}).innerText || '', phraseRemb: (x.querySelector('[data-retour-phrase-remb]') || {}).innerText || '',
          ambre: (() => { const l = x.querySelector('[data-retour-phrase-limite]'); return l ? getComputedStyle(l).color : ''; })(),
          bouton: (() => { const bt = x.querySelector('[data-retour-imprimer]'); return bt ? bt.getBoundingClientRect().height : 0; })(),
        })));
        const txs = r.map((x) => x.tx).sort().join(',');
        dit(txs === '9501,9502', `${nom} : Achats → « Retours » = EXACTEMENT les deux bordereaux de retour (pas la jumelle au même titre)`, txs);
        const a = r.find((x) => x.tx === '9501') || {}, s = r.find((x) => x.tx === '9502') || {};
        dit(a.num === '31' && s.num === '', `${nom} : 9501 porte N°31 (la fiche reliée à CET achat) ; 9502 « Sans N° »`, JSON.stringify([a.num, s.num]));
        dit(a.presse === '1' && /À déposer avant le/.test(a.limite) && !/rgb\(110, 110, 115\)/.test(a.ambre), `${nom} : 9501 à déposer dans moins de 48 h ⇒ la date en ambre`, JSON.stringify([a.limite, a.ambre]));
        dit(a.remb === 'non' && /Pas encore remboursé/.test(a.phraseRemb), `${nom} : 9501 « Pas encore remboursé » (rien de prouvé)`, a.phraseRemb);
        dit(s.remb === 'oui' && s.montant === '45.9' && /Remboursé/.test(s.phraseRemb) && /45,90/.test(s.phraseRemb), `${nom} : 9502 « Remboursé 45,90 € » (e-mail du même n°)`, s.phraseRemb);
        dit((await pg.$('[data-a-renvoyer] [data-retour-tx="9501"]')) === null, `${nom} : 9501 n’est pas redit dans « à renvoyer » (son bordereau est déjà là, une fois)`);
        dit(a.bouton >= 44, `${nom} : « Imprimer le bordereau » fait 44 px et plus`, String(a.bouton));
        dit((await rougeIci(pg, '[data-retours-achat]')) === false, `${nom} : aucun rouge sur « Retours »`);
        await pg.locator('[data-retours-achat]').first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `retours-achats-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`), fullPage: false }).catch(() => {});
        if (!sombre) {
          await pg.click('[data-retour-imprimer="9501"]');
          await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 15000 }).catch(() => {});
          const ouvert = await pg.$('[data-visionneuse-pdf="pret"]');
          const pasImp = await pg.$('[data-retour-pas-imprime]');
          dit(vp.width < 600 || (!!ouvert && !pasImp), `${nom} : « Imprimer le bordereau » ouvre le PDF tamponné dans la visionneuse`, JSON.stringify({ ouvert: !!ouvert, pasImp: !!pasImp }));
          dit(P.lusPdf.some((u) => /id=eq\.email_bordretour_9501/.test(u)), `${nom} : le PDF est lu par SON n° de transaction, seulement à l’impression`, P.lusPdf.join(' ').slice(0, 200));
          if (ouvert) await pg.keyboard.press('Escape').catch(() => {});
        }
        dit(P.selectData.length === 0, `${nom} : jamais \`select=data\` sur un bordereau de retour`);
        dit((await deborde(pg)) <= 1, `${nom} : Achats, rien ne déborde`);
      });
      if (!sombre) await essaie('Tout imprimer → Retours', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const bt = await pg.$('button[data-lot-ouvrir="1"]');
        if (bt) await bt.click();
        await pg.waitForSelector('[data-lot-section="retours"]', { timeout: 12000 }).catch(() => {});
        const l = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-section="retours"] [data-lot-retour]')].map((x) => x.getAttribute('data-lot-retour')));
        dit(!!bt && l.join(',') === '9501', `${nom} : « Tout imprimer » porte une section « Retours » (9501 ; la remboursée n’y est plus)`, JSON.stringify({ bouton: !!bt, l }));
        await pg.screenshot({ path: path.join(SHOTS, `retours-tout-imprimer-${vp.width}.png`), fullPage: false }).catch(() => {});
        dit((await deborde(pg)) <= 1, `${nom} : « Tout imprimer », rien ne déborde`);
      });
      await essaie('Litiges → Pas à pas', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=litiges`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-pap-ouvrir="v:9401"]', { timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const ouv = await pg.$('[data-pap-ouvrir="v:9401"]');
        dit(!!ouv, `${nom} : la carte du retour porte « Pas à pas »`);
        if (ouv) await ouv.click();
        await pg.waitForSelector('[data-pap="v:9401"]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const p = await pg.evaluate(() => {
          const f = document.querySelector('[data-pap="v:9401"]'); if (!f) return null;
          const rev = f.querySelector('[data-pap-revenue]'), con = f.querySelector('[data-pap-contester]');
          return { etape: f.getAttribute('data-pap-etape'), preuve: (f.querySelector('[data-pap-preuve]') || { getAttribute: () => '' }).getAttribute('data-pap-preuve'),
            delais: [...f.querySelectorAll('[data-pap-delai]')].map((x) => x.getAttribute('data-pap-delai') + ':' + x.getAttribute('data-pap-source')),
            revenue: rev ? rev.getAttribute('data-pap-revenue') : null, revH: rev ? rev.getBoundingClientRect().height : 0, contester: con ? con.getAttribute('href') : '', txt: f.innerText };
        });
        dit(p && p.etape === 'recevoir' && p.preuve === 'transaction', `${nom} : la feuille dit l’étape (le colis revient) et la PREUVE (la transaction Vinted)`, JSON.stringify(p && [p.etape, p.preuve]));
        dit(p && p.delais.join('|') === 'repondre:non-ecrite|verifier:regle-vinted' && /2 jours après réception/.test(p.txt), `${nom} : chaque délai porte SA source (date non écrite ; 2 jours = règle écrite par Vinted)`, JSON.stringify(p && p.delais));
        dit(p && p.revenue === '21' && p.revH >= 44, `${nom} : « Paire revenue · N°21 » (SON N°), 44 px et plus`, JSON.stringify(p && [p.revenue, p.revH]));
        dit(p && /vinted\.fr\/inbox\/24618679401$/.test(p.contester), `${nom} : « Pas la bonne paire / abîmée » ouvre SA conversation`, p && p.contester);
        dit((await rougeIci(pg, '[data-pap="v:9401"]')) === false, `${nom} : aucun rouge dans la feuille`);
        await pg.screenshot({ path: path.join(SHOTS, `retours-pas-a-pas-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`), fullPage: false }).catch(() => {});
        dit((await deborde(pg)) <= 1, `${nom} : Litiges, rien ne déborde`);
      });
      dit(P.versVinted.length === 0, `${nom} : aucune requête vers Vinted`, P.versVinted.slice(0, 3).join(' '));
      dit(P.errs.length === 0, `${nom} : aucune erreur de page`, P.errs.join(' | ').slice(0, 300));
      await P.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ retours et litiges : ${ko} rouge(s)` : '\n✅ retours et litiges : tout est vert');
  process.exit(ko ? 1 : 0);
})();
