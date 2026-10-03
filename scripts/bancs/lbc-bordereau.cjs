// Banc : LE BORDEREAU LEBONCOIN SORT TAMPONNÉ (3 octobre, extension 5.136).
//
// Julien : « il doit y avoir la messagerie intégrée des derniers comptes, avec
// la possibilité de répondre et de faire l'offre ». Ce banc rend le VRAI écran
// Messages sur des conversations INVENTÉES (aucune donnée réelle : il vit dans
// le dépôt, qui est public), rejoue le VRAI dialogue du pont (`ready`, `exec` →
// `result`) et exige :
//   1. la liste des conversations de TOUS les comptes, non lues d'abord, le
//      compte nommé sur chaque ligne (elle mélange ses comptes) ;
//   2. l'offre EN ATTENTE de l'acheteur lue dans le fil (status 10), avec son
//      montant, et « Accepter » qui demande confirmation puis envoie EXACTEMENT
//      `PUT …/transactions/{tx}/offer_requests/{oid}/accept` ;
//   3. « Faire une offre » qui envoie `POST …/transactions/{tx}/offers` au prix
//      saisi ;
//   4. un fil pas encore capté lu PAR L'EXTENSION (`GET …/conversations/{id}`) ;
//   5. une extension trop ancienne (5.134) : aucun geste d'offre proposé, la
//      raison dite — jamais un bouton qui ne peut pas marcher.
//
// « Le tampon titre + N° partout » : sur Leboncoin, « Imprimer » ouvrait le PDF
// de Leboncoin tel quel. Le PDF est derrière SA session Leboncoin : c'est
// l'extension qui le lit (`pdfLbc`), l'app le tamponne avec la MÊME fonction que
// Vinted et l'ouvre dans l'onglet réservé au clic. Ce banc exige :
//   1. le pont est appelé avec l'adresse EXACTE du bordereau de CE colis ;
//   2. un onglet s'ouvre sur un PDF qui PORTE le titre (tampon), jamais un
//      téléchargement ;
//   3. extension trop ancienne : le lien d'avant (PDF tel quel), aucun appel.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4338;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) }];
const VOUCHER = 'https://api.leboncoin.fr/api/shippingproxy/v1/parcels/abc-123/label';
const rows = [
  { id: 'lbc_ventes', data: { ventes: { A1: { txId: 'A1', isSeller: true, title: 'Jordan 1 test', stepLabel: 'Colis à envoyer', price: 7500, label: { voucherUrl: VOUCHER, reference: 'R1' } } } } },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

const PONT = ({ version, pdf }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'pdfLbc') { window.__pdfLbc && window.__pdfLbc(String(d.url)); setTimeout(() => post({ __vmr: 'pdfLbc:result', reqId: d.reqId, dataUrl: 'data:application/pdf;base64,' + pdf, error: '' }), 50); }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, version) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const appels = [];
  await pg.exposeFunction('__pdfLbc', (u) => appels.push(u));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, { version, pdf: PDF_B64 });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=plat_leboncoin`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  await pg.getByRole('button', { name: 'Colis', exact: true }).first().click();
  await pg.waitForTimeout(800);
  return { ctx, pg, errs, appels };
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    console.log('── extension à jour (5.136)');
    {
      const r = await rendre(b, '5.136.0');
      const onglets = [], telecharges = [];
      r.ctx.on('page', (p) => onglets.push(p));
      r.pg.on('download', (d) => telecharges.push(d.suggestedFilename()));
      try { await r.pg.click('[data-imprime-lbc="A1"]', { timeout: 5000 }); } catch (e) { dit(false, 'le bouton « Imprimer » du colis existe', String(e.message).slice(0, 80)); }
      await r.pg.waitForTimeout(2500);
      dit(r.appels.length === 1 && r.appels[0] === VOUCHER, 'le pont est appelé avec l’adresse EXACTE du bordereau de CE colis', JSON.stringify(r.appels));
      dit(onglets.length === 1 && /^blob:/.test(onglets[0].url()), 'un onglet s’ouvre sur le PDF (pas un téléchargement)', JSON.stringify(onglets.map((p) => p.url())));
      dit(telecharges.length === 0, 'aucun téléchargement', JSON.stringify(telecharges));
      if (onglets[0]) {
        const b64 = await r.pg.evaluate(async (u) => { const t = new Uint8Array(await (await fetch(u)).arrayBuffer()); let s = ''; for (const x of t) s += String.fromCharCode(x); return btoa(s); }, onglets[0].url());
        const brut = Buffer.from(b64, 'base64');
        // pdf-lib compresse ses flux : on les décompresse tous pour chercher le
        // tampon (le texte s'écrit en hexadécimal, `<4A6F…> Tj`).
        const zlib = require('zlib');
        let texte = brut.toString('latin1');
        const re = /stream\r?\n/g; let m;
        while ((m = re.exec(brut.toString('latin1')))) {
          const deb = m.index + m[0].length; const fin = brut.indexOf('endstream', deb);
          if (fin < 0) break;
          try { texte += zlib.inflateSync(brut.subarray(deb, fin)).toString('latin1'); } catch (_) {}
        }
        const titreHex = Buffer.from('Jordan').toString('hex').toUpperCase();
        dit(brut.subarray(0, 4).toString() === '%PDF' && (texte.toUpperCase().includes(titreHex) || texte.includes('Jordan')), 'le PDF ouvert PORTE le titre du colis (tamponné comme sur Vinted)', 'taille ' + brut.length);
      }
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }
    console.log('── extension trop ancienne (5.135)');
    {
      const r = await rendre(b, '5.135.0');
      const lien = await r.pg.evaluate(() => { const a = [...document.querySelectorAll('a')].find((x) => /Imprimer le bordereau/.test(x.innerText)); return a ? a.getAttribute('href') : null; });
      dit(lien === VOUCHER && r.appels.length === 0, 'le lien d’avant (PDF tel quel), aucun appel au pont', String(lien));
      await r.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ bordereau Leboncoin : ${ko} rouge(s)` : '\n✅ bordereau Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
