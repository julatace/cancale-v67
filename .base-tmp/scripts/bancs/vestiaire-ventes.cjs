// ═══════════════════════════════════════════════════════════════════════════
// BANC : VENTES VESTIAIRE JUSTES (15 nov.) — après `npm run build`
//        (BANC_PORT pour le port ; SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (iPhone, 15 nov.) : un sac EXPÉDIÉ le 7 nov. était « À envoyer · date limite
// passée » sous « 0 à expédier (au moins) » ; « Vestiaire : « IN_PROGRESS » » ; « n° 37451417 »
// (l'identifiant du COMPTE) sous chaque vente ; le prix affiché était l'argent reçu ; le titre
// se coupait en syllabes (« cavalière / s »). Données INVENTÉES qui reprennent la FORME mesurée
// en base (`vc_ventes`), quatre ventes :
//   V1 « expédiée » : aExpedier true de la liste « à expédier » lue il y a 13 j, frise
//      sellerShipment done, deliveryInProgress ⇒ « Expédiée · en livraison », pas d'ambre ;
//   V2 « vendue sans étape » (IN_PROGRESS) ⇒ « Vendue » ;
//   V3 une vraie vente à envoyer (liste « à expédier » relue APRÈS la frise) ⇒ « À expédier … » ;
//   V4 un mot que rien ne range ⇒ « État Vestiaire non reconnu ».
// À 390 px tactile et 1512 px, clair et sombre : aucun code machine, pas de « n° <compte> »,
// la tête « N à expédier » = les lignes qui le disent, le PRIX DE VENTE en principal et
// « pour toi … » en second, le bénéfice seulement s'il est su, la réf. produit, aucun titre coupé
// au milieu d'un mot, rien ne déborde. La fiche : l'état en mots, la réf., jamais le code.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8093;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const ilYaJ = (j) => new Date(MAINTENANT - j * J).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const COMPTE = '99887766';   // l'identifiant (inventé) du compte Vestiaire : il ne doit JAMAIS s'écrire
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
const E = (o) => ({ sellerSale: 'done', sellerShipment: 'upcoming', sellerDelivery: 'upcoming', sellerConformity: 'upcoming', sellerPayment: 'upcoming', ...o });
const LIGNES = [
  { id: 'main', data: { vinted_used_numeros: [118, 119, 120], vinted_annonce_numeros: { '9001': { numero: '120', title: 'Cabas inventé' } }, vinted_buyprice_by_num: { 120: '110' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
  { id: 'vc_session', data: { id: COMPTE, at: ilYaH(0.1), source: 'users/me', comptes: { [COMPTE]: ilYaH(0.1) } } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: { 70000001: '120' }, items: {} } },
  { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYaH(0.4), total: null, complet: false }, 'a-expedier': { at: ilYaJ(13), total: null, complet: false } }, ventes: {
    V1: { productId: '70000001', titre: 'Cabas en cuir inventé Monogramme GG', photo: PHOTO(70000001), etat: 'IN_PROGRESS', statutVc: 'deliveryInProgress',
      etapesVc: E({ sellerShipment: 'done', sellerDelivery: 'ongoing' }), aExpedier: true, sources: ['ventes', 'a-expedier'], limite: ilYaJ(6),
      suivi: 'XX000000001FR', transporteur: 'Chronopost', paiementEstime: '23 novembre 2026', compte: COMPTE,
      montant: { valeur: 150.5, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: 160.25, devise: 'EUR', cle: 'sellerPrice' },
      vuAt: ilYaH(0.4), premiereVue: ilYaJ(13), date: ilYaJ(13) },
    V2: { productId: '70000002', titre: 'Bottes cavalières inventées', photo: PHOTO(70000002), etat: 'IN_PROGRESS', aExpedier: false, sources: ['ventes'], limite: '', suivi: '', transporteur: '', compte: COMPTE,
      montant: { valeur: 80, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: 100, devise: 'EUR', cle: 'sellerPrice' }, vuAt: ilYaH(0.4), premiereVue: ilYaJ(2), date: ilYaJ(2) },
    V3: { productId: '70000003', titre: 'Mocassins inventés', photo: PHOTO(70000003), etat: 'ACTION_NEEDED', statutVc: 'shipmentInProgress', etapesVc: E({ sellerShipment: 'pending' }),
      etapesAt: ilYaJ(1.5), aExpedier: true, aExpedierAt: ilYaJ(1), sources: ['ventes', 'a-expedier'], limite: dansJ(3), compte: COMPTE,
      montant: { valeur: 60, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: 75, devise: 'EUR', cle: 'sellerPrice' }, vuAt: ilYaH(0.4), premiereVue: ilYaJ(1), date: ilYaJ(1) },
    V4: { productId: '70000004', titre: 'Escarpins inventés', photo: PHOTO(70000004), etat: 'WEIRD_STATE_X', aExpedier: false, sources: ['ventes'], compte: COMPTE,
      montant: { valeur: 40, devise: 'EUR', cle: 'sellerEarning' }, vuAt: ilYaH(0.4), premiereVue: ilYaJ(20), date: ilYaJ(20) },
  } } },
];
const CODES = /IN_PROGRESS|ACTION_NEEDED|deliveryInProgress|shipmentInProgress|WEIRD_STATE_X|sellerShipment|sellerEarning|sellerPrice/;

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
const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
  });
  post({ __vmr: 'ready', version });
};
async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.383.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/images\.vestiairecollective\.com/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#b9a27e"/></svg>' });
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
const capture = async (pg, nom, el) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); if (el) { const h = await pg.$(el); if (h) { await h.scrollIntoViewIfNeeded().catch(() => {}); await h.screenshot({ path: path.join(SHOTS, 'vv-' + nom + '.png') }).catch(() => {}); return; } } await pg.screenshot({ path: path.join(SHOTS, 'vv-' + nom + '.png'), fullPage: false }); };

// Les coupures de ligne d'un titre VISIBLE : chaque passage à la ligne doit tomber sur une espace
// (ou après un trait d'union) — jamais au milieu d'un mot (« cavalière / s »).
const COUPURES = () => {
  const out = [];
  const rangee = (el) => el.closest('[data-vc-vente]') && el.closest('[data-vc-vente]').getAttribute('data-vc-vente');
  for (const el of document.querySelectorAll('[data-vc-vente] .vrm-fu-vente-nom, [data-vc-vente] .vrm-ledger-sale-nom')) {
    const r0 = el.getBoundingClientRect(); if (r0.width < 2 || r0.height < 2) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') continue;
    let ok = true, mots = '', lignes = 1, top = null, prec = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      for (let i = 0; i < n.data.length; i++) {
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const rc = [...rg.getClientRects()].find((x) => x.width > 0); const c = n.data[i];
        if (rc && top != null && rc.top > top + 4 && rc.bottom <= r0.bottom + 1) { lignes++; if (!/[\s\u00a0\-–]/.test(prec) && !/\s/.test(c)) { ok = false; mots = prec + '|' + c; } }
        if (rc && rc.bottom <= r0.bottom + 1) top = rc.top > (top == null ? -1e9 : top + 4) ? rc.top : top;
        prec = c;
      }
    }
    out.push({ id: rangee(el), ok, mots, lignes, cl: el.className });
  }
  return out;
};

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
      const tel = vp.width < 600;
      console.log(`── ${nomVp}`);
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('Ventes Vestiaire', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-vente="V1"]', { timeout: 25000 });
        await pg.waitForTimeout(700);
        const r = await pg.evaluate(() => {
          const carte = document.querySelector('[data-vc-ventes="lu"]');
          const rows = {}; for (const x of document.querySelectorAll('[data-vc-vente]')) rows[x.getAttribute('data-vc-vente')] = {
            etape: x.getAttribute('data-vc-vente-etat'), famille: x.getAttribute('data-vc-vente-etape'), ton: x.getAttribute('data-vc-vente-ton'), prix: x.getAttribute('data-vc-prix-principal'), recu: x.getAttribute('data-vc-recu'),
            t: x.innerText, recuTxt: (x.querySelector('[data-fu-recu]') || { innerText: '' }).innerText, benefSu: (x.querySelector('[data-fu-benef-su]') || { innerText: '' }).innerText,
            bloc: (x.querySelector('.vrm-fu-vente-prixbloc') || { innerText: null }).innerText,
            // L'état VU (pas le texte caché d'une colonne) : la ligne 3 au téléphone, la colonne « État » à l'ordinateur.
            etatVu: (() => { const el = [...x.querySelectorAll('.vrm-fu-vente-l3, .vrm-ledger-sale-state')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).display !== 'none'; }); return el ? el.innerText.trim() : ''; })(), plus: !!x.querySelector('.vrm-fu-plus-vente'), gestes: !!x.querySelector('[data-gestes-ligne]') };
          return { tete: carte ? carte.querySelector('[data-vc-a-expedier]').getAttribute('data-vc-a-expedier') : null, teteTxt: carte ? (carte.querySelector('[data-vc-ventes-resume]') || {}).innerText : '', carte: carte ? carte.innerText : '', rows,
            sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        });
        dit(r.rows.V1 && r.rows.V1.etape === 'expediee' && r.rows.V1.ton === '' && /Expédiée · en livraison/.test(r.rows.V1.t) && !/À envoyer|À expédier|date limite passée/.test(r.rows.V1.t),
          'V1 expédiée (frise plus fraîche que la liste « à expédier ») : « Expédiée · en livraison », sans ambre, plus de « date limite passée »', JSON.stringify({ e: r.rows.V1 && r.rows.V1.etape, t: r.rows.V1 && r.rows.V1.t.replace(/\s+/g, ' ').slice(0, 160) }));
        dit(r.rows.V2 && r.rows.V2.etape === 'vendue' && /\bVendue\b/.test(r.rows.V2.t), 'V2 sans étape : « Vendue »', r.rows.V2 && r.rows.V2.etape);
        // (16 nov., intégration vague B) Décision du 5 nov. (src/libelles.js) : « À envoyer » partout, « À expédier » écarté.
        dit(r.rows.V1.etatVu === 'Expédiée · en livraison' && /^À envoyer avant le /.test(r.rows.V3.etatVu) && r.rows.V4.etatVu === 'État Vestiaire non reconnu', 'l’état est ÉCRIT à l’écran (pas seulement dans une colonne cachée) : V1, V3, V4', JSON.stringify([r.rows.V1.etatVu, r.rows.V3.etatVu, r.rows.V4.etatVu]));
        dit(r.rows.V3 && /^aExpedier/.test(r.rows.V3.etape) && r.rows.V3.famille === 'a-expedier' && r.rows.V3.ton === 'action' && /À envoyer/.test(r.rows.V3.t), 'V3 vraie vente à envoyer (liste relue après la frise) : « À expédier … » en ambre', r.rows.V3 && r.rows.V3.etape);
        dit(r.rows.V4 && r.rows.V4.etape === 'inconnu' && /État Vestiaire non reconnu/.test(r.rows.V4.t), 'V4 mot inconnu : « État Vestiaire non reconnu »', r.rows.V4 && r.rows.V4.etape);
        const nAction = Object.values(r.rows).filter((x) => x.ton === 'action').length;
        dit(r.tete === String(nAction) && nAction === 1 && /1 à expédier/.test(r.teteTxt), 'tête = lignes : « 1 à expédier » et UNE ligne en ambre (une seule règle, §11)', JSON.stringify({ tete: r.tete, lignes: nAction, t: r.teteTxt }));
        const code = CODES.exec(r.carte);
        dit(!code, 'aucun code machine de Vestiaire visible (IN_PROGRESS, deliveryInProgress, …)', code && code[0]);
        dit(!r.carte.includes(COMPTE), 'l’identifiant du compte ne s’écrit nulle part (plus de « n° 99887766 »)', r.carte.includes(COMPTE) ? 'trouvé' : '');
        dit(/Réf\. 70000001/.test(r.carte) && /Réf\. 70000002/.test(r.carte), 'la réf. produit de chaque vente (« Réf. 70000001 », comme sur Vestiaire)');
        dit(r.rows.V1.prix === '16025' && r.rows.V1.recu === '15050' && r.rows.V2.prix === '10000' && r.rows.V2.recu === '8000', 'chiffre principal = PRIX DE VENTE (sellerPrice), reçu à part (sellerEarning)', JSON.stringify([r.rows.V1.prix, r.rows.V1.recu, r.rows.V2.prix, r.rows.V2.recu]));
        dit(/160,25\s€/.test(r.rows.V1.t) && /pour toi 150,50\s€/.test(r.rows.V1.t) && /100,00\s€|100\s€/.test(r.rows.V2.t) && /pour toi 80,00\s€|pour toi 80\s€/.test(r.rows.V2.t), 'à l’écran : « 160,25 € » puis « pour toi 150,50 € » ; « 100 € » puis « pour toi 80 € »', JSON.stringify([r.rows.V1.t, r.rows.V2.t].map((t) => t.replace(/\s+/g, ' ').slice(0, 140))));
        if (tel) {
          dit(/^\+40,50\s€$/.test(r.rows.V1.benefSu) && r.rows.V2.benefSu === '', 'le bénéfice sous le prix seulement s’il est su (+40,50 € pour le N°120, rien pour la vente sans prix d’achat)', JSON.stringify([r.rows.V1.benefSu, r.rows.V2.benefSu]));
          dit(Object.values(r.rows).every((x) => x.bloc == null || !/^—$/m.test(x.bloc)), 'aucun « — » nu sous un prix', JSON.stringify(Object.values(r.rows).map((x) => x.bloc)));
          dit(Object.values(r.rows).every((x) => !x.plus && !x.gestes), 'aucun geste ni « ⋯ » sur la rangée (le prix d’achat se saisit dans la fiche)');
        }
        dit(r.sw <= r.cw + 1, 'rien ne déborde', `${r.sw} > ${r.cw}`);
        const cp = await pg.evaluate(COUPURES);
        dit(cp.length >= 4 && cp.every((x) => x.ok), 'aucun titre coupé au milieu d’un mot', JSON.stringify(cp.filter((x) => !x.ok || x.lignes > 1).map((x) => [x.id, x.lignes, x.mots])));
        if (tel) dit(cp.filter((x) => /vrm-fu-vente-nom/.test(x.cl)).every((x) => x.lignes <= 2), 'au téléphone, le titre tient sur deux lignes au plus', JSON.stringify(cp.map((x) => [x.id, x.lignes])));
        await capture(pg, `liste-${nomVp}`, '[data-vc-ventes="lu"]');
        // La fiche de V1 : l'état en mots, la réf., aucun code.
        await pg.click('[data-vc-vente="V1"] .vrm-ledger-sale-toggle');
        await pg.waitForSelector('[data-recap-phrase]', { timeout: 10000 });
        await pg.waitForTimeout(400);
        const f = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-recap-vente]')].find((x) => x.offsetParent !== null || x.getClientRects().length) || document.querySelector('[data-recap-vente]'); return { t: s ? s.innerText : '', ref: !!(s && s.querySelector('[data-recap-ref-vc]')), phrase: (s && s.querySelector('[data-recap-phrase]') || { innerText: '' }).innerText }; });
        const c2 = CODES.exec(f.t);
        dit(!c2 && f.ref && !/À envoyer/.test(f.phrase), 'la fiche : la réf., aucun code machine, plus « À envoyer »', JSON.stringify({ code: c2 && c2[0], phrase: f.phrase }));
        await capture(pg, `fiche-${nomVp}`);
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Ventes Vestiaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Ventes Vestiaire : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
