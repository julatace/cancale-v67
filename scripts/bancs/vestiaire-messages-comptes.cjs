// BANC : vestiaire-messages-comptes (21 nov.) — après la construction (BANC_PORT pour le port ; SHOTS=dossier pour les captures).
// Messages · Vestiaire et Ventes avec Vestiaire (lot vestiaire-messages, extension 5.412.0). Données INVENTÉES (dépôt public).
// 390 tactile clair, 1512 sombre.
//   A. Messages · Vestiaire : les comptes SÉPARÉS (règle du 12 nov.) — le compte ouvert dans l'onglet d'abord, puis l'autre
//      compte ; dans chaque groupe le plus récent en haut ; un en-tête par groupe ; aucun bouton d'envoi dans l'app (le
//      geste est dans le panneau de l'extension) ; le fil se lit.
//   B. Ventes : la vente Vestiaire (lue par l'extension) est dans la liste, avec le logo du site.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8094;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const MOI = '11112222', AUTRE = '99998888';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
const conv = (id, compte, h, apercu, titre, art) => [id, { productId: art, ref: '', nonLu: false, date: ilYaH(h), apercu, apercuDeMoi: false, compte, titre, photo: PHOTO(art), source: 'notifications' }];
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: [1, 2, 3], vinted_annonce_numeros: {} } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.1), payload: { items: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
  { id: 'vc_session', data: { id: MOI, at: ilYaH(0.1), source: 'stream' } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: {}, items: {
    71000001: { titre: 'Salomon XT-6', photo: PHOTO(71000001), statut: 'published', vuAt: ilYaH(0.3), compte: MOI, prix: { valeur: 220, devise: 'EUR', cle: 'price' } },
  } } },
  { id: 'vc_messages', data: { capturedAt: ilYaH(0.2), compteurs: { [MOI]: { messages: 1, at: ilYaH(0.2) } }, conversations: Object.fromEntries([
    conv('33334444-71000001', MOI, 5, 'Toujours dispo ?', 'Salomon XT-6', '71000001'),
    conv('55556666-71000002', MOI, 1, 'Vous faites un prix ?', 'Sac cabas', '71000002'),
    conv('77778888-71000003', AUTRE, 0.5, 'Envoi rapide ?', 'Escarpins tressés', '71000003'),
  ]) } },
  { id: 'vc_fil_55556666-71000002', data: { conv: '55556666-71000002', compte: MOI, productId: '71000002', n: 2, dernierAt: ilYaH(1), apercu: 'Vous faites un prix ?', dernierDeMoi: false,
    messages: [{ id: 'm1', t: 'Bonjour !', deMoi: false, at: ilYaH(2) }, { id: 'm2', t: 'Vous faites un prix ?', deMoi: false, at: ilYaH(1) }] } },
  { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(0.3), complet: true }, ventes: { at: ilYaH(0.3) } }, ventes: {
    V1: { productId: '71000009', aExpedier: true, date: ilYaH(5), titre: 'Gucci Ace blanche', photo: PHOTO(71000009), etat: 'ACTION_NEEDED', compte: MOI,
      montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost' },
  } } },
];
let LIGNES = lignes();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.mjs': 'text/javascript' };
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
// Le faux pont de l'extension 5.364 : il note les commandes et répond comme le fond.
const PONT = ({ version }) => {
  window.__cmds = []; window.__VRM_BAISSE_PAUSE = 0;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcOffre: true, vcPrix: true } });
    if (d.__vmr === 'cmd') {
      const c = {}; for (const k of Object.keys(d)) if (!['__vmr', 'reqId'].includes(k)) c[k] = d[k];
      window.__cmds.push(c);
      if (d.cmd === 'vcPrix') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', ancien: d.avantCents / 100, prixVu: d.apresCents / 100 } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId: 'vc:' + d.id, etape: 'depot' } });
    }
  });
  post({ __vmr: 'ready', version });
};

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.412.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/images\.vestiairecollective\.com|img\.test|vinted\.net/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#c8b08a"/></svg>' });
    return r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, 'vcm-' + nom + '.png'), fullPage: false }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined|vcMsg\./.exec(r.t);
  dit(!m, `${ecran} : ni garde-fou ni clé de traduction affichée`, m && m[0]);
};
(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${nomVp}`);
      LIGNES = lignes();
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A. Messages · Vestiaire', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=messages`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2000);
        await pg.click('[data-filtre-site="messages"] [data-site="vestiaire"]', { timeout: 15000 });
        await pg.waitForSelector('[data-vc-conv]', { timeout: 20000 });
        await pg.waitForTimeout(500);
        const v = await pg.evaluate(() => ({ ordre: [...document.querySelectorAll('[data-vc-conv]')].map((e) => [e.getAttribute('data-vc-conv'), e.getAttribute('data-vc-conv-compte-rang')]),
          groupes: [...document.querySelectorAll('[data-vc-groupe]')].map((e) => e.getAttribute('data-vc-groupe') + ':' + e.innerText.trim()), phrase: (document.querySelector('[data-vc-groupes]') || {}).innerText || '' }));
        dit(JSON.stringify(v.ordre.map((x) => x[0])) === JSON.stringify(['55556666-71000002', '33334444-71000001', '77778888-71000003']), 'A · le compte ouvert d’abord (le plus récent en haut), puis l’AUTRE compte — même si sa conversation est plus récente', JSON.stringify(v.ordre));
        dit(v.groupes.length === 2 && /^ouvert:Compte ouvert dans ce Chrome$/.test(v.groupes[0]) && /^autre:Autre compte Vestiaire$/.test(v.groupes[1]), 'A · un en-tête par groupe de compte', JSON.stringify(v.groupes));
        dit(/Chaque compte à part/.test(v.phrase), 'A · la règle est dite UNE fois', v.phrase);
        await capture(pg, 'messages-' + nomVp);
        await pg.click('[data-vc-conv="55556666-71000002"] button, [data-vc-conv="55556666-71000002"] [role="button"]', { timeout: 10000 }).catch(() => pg.click('[data-vc-conv="55556666-71000002"]'));
        await pg.waitForSelector('[data-vc-fil="lu"]', { timeout: 15000 });
        const f = await pg.evaluate(() => ({ n: (document.querySelector('[data-vc-fil="lu"]') || { getAttribute: () => '' }).getAttribute('data-vc-fil-n'), pied: (document.querySelector('[data-vc-repondre]') || { getAttribute: () => '' }).getAttribute('data-vc-repondre'),
          envoyer: [...document.querySelectorAll('[data-vc-fil-ouvert] button')].map((x) => x.innerText).filter((t) => /^Envoyer$/i.test(t.trim())).length }));
        dit(f.n === '2' && f.pied === 'panneau' && f.envoyer === 0, 'A · le fil se lit (2 messages) ; répondre ouvre le panneau de l’extension (aucun envoi depuis l’app)', JSON.stringify(f));
        await sain(pg, 'Messages · Vestiaire');
        await capture(pg, 'fil-' + nomVp);
      });
      await essaie('B. Ventes', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => /Gucci Ace blanche/.test(document.body.innerText), null, { timeout: 25000 });
        await pg.waitForTimeout(800);
        const v = await pg.evaluate(() => { const r = [...document.querySelectorAll('li, tr, [role="row"], [data-tx]')].filter((e) => /Gucci Ace blanche/.test(e.innerText) && e.innerText.length < 600); const e = r[r.length - 1]; return { t: e ? e.innerText.replace(/\s+/g, ' ') : '', logo: !!(e && e.querySelector('[data-logo-site="vestiaire"], [data-site="vestiaire"], svg[aria-label*="Vestiaire" i], img[alt*="Vestiaire" i]')) || /Vestiaire/.test(e ? e.innerText : '') }; });
        dit(!!v.t, 'B · la vente Vestiaire est dans Ventes', v.t);
        dit(v.logo, 'B · avec le site (logo ou nom Vestiaire) sur sa rangée', v.t);
        await sain(pg, 'Ventes');
        await capture(pg, 'ventes-' + nomVp);
      });
      dit(errs.length === 0, `${nomVp} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ banc vestiaire-messages-comptes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ banc vestiaire-messages-comptes : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
