// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES CARTES « À RENVOYER » / « À VÉRIFIER » COMPACTES (25 nov., lot achats-retours-design — après `npm run build` ;
//        node scripts/bancs/retours-cartes-compactes.cjs ; BANC_PORT=…, BANC_DIST=…, BANC_SHOTS=…, BANC_TEXTES=fichier.json)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (25 nov., iPhone, style Monochrome, Achats) : chaque carte de retour faisait « un écran par carte » —
// « Remboursé » écrit trois fois (pastille, titre, étape), « date pas vue » répété sous deux étapes, « Livré au ven- deur »
// coupé, deux ou trois gros boutons, « ✓ ⋯ » seuls sur une ligne en haut. « Tu peux améliorer ce design. »
// Mêmes données INVENTÉES que retours-renvoyer-suivi.cjs (Nike remboursé, Autry délai dépassé, Salomon « à vérifier »).
// Style par défaut ET Monochrome, 390 tactile et 1512, clair et sombre. Jugé sur la RÈGLE (data-*, géométrie, texte VISIBLE) :
//   K1 un état écrit UNE fois : dans chaque carte, le mot de l'état (« Remboursé », « Délai dépassé », « En route »…) et
//      « date pas vue » se lisent au plus une fois à l'écran (texte rendu visible, pas l'aide au lecteur d'écran) ;
//   K2 aucun libellé de frise coupé : chaque libellé tient sur UNE ligne, sans débordement ni troncature ;
//   K3 un seul bouton PLEIN par carte, et un seul dans toute la section ;
//   K4 hauteur bornée : à 390, une carte en cours ≤ 300 px (≈ 1/3 d'écran), une carte terminée (remboursée) ≤ 96 px repliée,
//      une rangée « À vérifier » ≤ 100 px ; aucun débordement de carte ;
//   K5 aucun geste perdu : chaque carte garde ses gestes (Autry : Vinted, Imprimer, Déposé visibles ; Nike : Suivre et Vinted
//      après l'avoir dépliée ; Salomon : Vinted et Réglé) ; « Pourquoi ? » garde son texte ;
//   K6 en haut d'Achats, aucune ligne qui ne porte QUE « ✓ » et « ⋯ » (au téléphone) : ces deux ronds sont dans l'en-tête.
// BANC_TEXTES : écrit le texte VISIBLE de chaque carte (pour comparer avant / après : rien de perdu, seules les redites).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4486;
const SHOTS = process.env.BANC_SHOTS || os.tmpdir();
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/></svg>`);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'banc_cancale', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const TXN = '990048248', TXA = '990051379', SN = '81230048', SA = 'XU900051378JF';
const NIKE = 'Baskets banc Air Max. Blanc et rose. Pointure 42.5', AUTRY = 'Autry banc Medalist', SALOMON = 'Salomon banc xt6';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const LIM_A = new Date(MAINTENANT - 3 * H).toISOString(), LIM_N = new Date(MAINTENANT - 13 * 24 * H).toISOString(), LIM_S = new Date(MAINTENANT - 40 * 24 * H).toISOString();
const txtLim = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} 10 h 00`; };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 500)); } };

async function pdf(titre) { const a = await PDFDocument.create(); const p = a.addPage([595, 842]); const f = await a.embedFont(StandardFonts.Helvetica); p.drawText(titre, { x: 40, y: 700, size: 12, font: f }); a.setTitle(titre); return Buffer.from(await a.save()).toString('base64'); }
async function lignes() {
  const achat = (tx, title, eur, status, h, c) => ({ transaction_id: Number(tx), title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'waiting', conversation_id: 'conv-' + tx, date: ilYaH(h), photo: { url: PH(c) } });
  return [
    { id: 'main', data: {} },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [achat(TXA, AUTRY, 34.32, 'Commande expédiée et en cours d’acheminement !', 460, '#B9A58C'), achat(TXN, NIKE, 35.98, 'Commande expédiée et en cours d’acheminement !', 600, '#E6B8C8')] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: `email_bordretour_${TXN}`, data: { type: 'bordereau-retour', sens: 'achat', transaction: TXN, suivi: SN, transporteurPdf: 'mondialrelay', pdfLu: 'ok', dateLimite: txtLim(LIM_N), dateLimiteIso: LIM_N, article: NIKE, uid: '111', account: 'banc_cancale', filename: `Bon-Retour-Vinted-${TXN}.pdf`, pdfB64: await pdf('BANC RETOUR ' + TXN), receivedAt: ilYaH(15 * 24) } },
    { id: `email_bordretour_${TXA}`, data: { type: 'bordereau-retour', sens: 'achat', transaction: TXA, suivi: SA, transporteurPdf: 'chronopost', pdfLu: 'ok', dateLimite: txtLim(LIM_A), dateLimiteIso: LIM_A, article: AUTRY, uid: '111', account: 'banc_cancale', filename: `Bon-Retour-Vinted-${TXA}.pdf`, pdfB64: await pdf('BANC RETOUR ' + TXA), receivedAt: ilYaH(8 * 24) } },
    { id: `email_track_mondialrelay_${SN}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: SN, status: 'transit', statusLabel: 'En transit', sens: 'sortant', subject: 'Votre colis est entre de bonnes mains', emailAt: ilYaH(13 * 24), receivedAt: ilYaH(13 * 24) } },
    { id: `email_rembachat_${TXN}`, data: { type: 'remboursement-achat', sens: 'achat', transaction: TXN, montant: 35.98, article: NIKE, receivedAt: ilYaH(5 * 24) } },
    { id: 'email_retourdemande_banc0000salomon', data: { type: 'retour-demande', sens: 'achat', article: SALOMON, conv: '', uid: '111', account: 'banc_cancale', subject: 'Retourne ta commande : ' + SALOMON, limiteIso: LIM_S, limiteJour: LIM_S.slice(0, 10), receivedAt: ilYaH(47 * 24) } },
  ];
}

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/pdfjs/') ? path.join(NM, 'pdfjs-dist', 'build', path.basename(f)) : path.join(DIST, f);
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
    if (seg_pdf(src) && row.data && row.data.pdfB64) x = true;
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const seg_pdf = (src) => /(^|->>|->)_pdf$/.test(src);
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, ROWS, { sombre = false, style = '' } = {}) {
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(mobile ? { isMobile: true, hasTouch: true, userAgent: UA_IPHONE } : {}) });
  const errs = [], versVinted = [], selectData = [];
  await ctx.addInitScript(([s, st]) => {
    try { if (st) localStorage.setItem('vrm_style', JSON.stringify(st)); } catch (_) {}
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); localStorage.setItem('vrm_reclasse_retours_at', String(Date.now())); } catch (_) {}
    // Ce que l'impression OUVRE : la feuille de partage (iPhone) et les PDF fabriqués (blob).
    window.__partages = []; window.__blobs = [];
    const cou = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o) => { const u = cou(o); try { if (o && o.type === 'application/pdf') window.__blobs.push({ u, o }); } catch (_) {} return u; };
    try {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && Array.isArray(d.files) && d.files.length) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__partages.push({ d, actif: navigator.userActivation ? navigator.userActivation.isActive : null }); return Promise.resolve(); } });
    } catch (_) {}
  }, [sombre, style]);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.(fr|com)/i.test(u) && !/images\d*\.vinted\.net/.test(u)) versVinted.push(u);
    // pdf.js (celui que l'app charge du CDN) servi depuis node_modules : la recherche de zone blanche tourne vraiment.
    if (/pdfjs-dist@[^/]+\/build\/pdf\.worker\.min\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(NM, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await ctx.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/email_bordretour_/.test(u) && /select=data(&|$)/.test(u)) selectData.push(u);
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
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=reclasser/.test(r.request().url()) ? '{"ok":true,"faits":[],"restes":[],"transporteurs":[]}' : '{"pret":true}' }));
  const page = async () => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const pg = await page();
  return { ctx, pg, page, errs, versVinted, selectData };
}

// Ce que montrent les cartes, en texte VISIBLE et en géométrie (même mesure sur le code d'avant et d'après).
const mesurer = (pg) => pg.evaluate(() => {
  const vis = (el) => !!el && (typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : el.getClientRects().length > 0) && el.getBoundingClientRect().width > 1 && el.getBoundingClientRect().height > 1;
  // Le texte qu'on VOIT : ni l'aide au lecteur d'écran (rognée à 1 px), ni l'intérieur d'un repli fermé (sauf son titre).
  const texteVu = (x) => {
    const out = []; const w = document.createTreeWalker(x, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement; if (!el || !vis(el)) continue;
      const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue;
      const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t);
    }
    return out.join(' ').replace(/\s+/g, ' ');
  };
  const compte = (s, re) => (s.match(re) || []).length;
  const MOT = { rembourse: /Rembours/g, depassee: /dépass/gi, route: /En route/g, livre: /Livré/g, relais: /relais/gi, revient: /Revient/g, 'a-deposer': /À déposer/g, depose: /Déposé le|Déposé ·/g };
  const cartes = [...document.querySelectorAll('[data-retours-achat] [data-retour-achat]')].map((c) => {
    const r = c.getBoundingClientRect();
    const etat = c.getAttribute('data-retour-etat-carte') || '';
    const txt = texteVu(c);
    const libs = [...c.querySelectorAll('[data-retour-et] > b')].filter(vis).map((b) => { const cs = getComputedStyle(b); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
      return { t: b.innerText.trim(), h: Math.round(b.getBoundingClientRect().height), lh: Math.round(lh), coupe: b.getBoundingClientRect().height > lh * 1.4 || b.scrollWidth > b.clientWidth + 1 }; });
    const pleins = [...c.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
    const gestes = ['vinted', 'imprimer', 'depose', 'suivre'].filter((g) => [...c.querySelectorAll('[data-retour-' + g + ']')].some(vis));
    const deborde = [...c.querySelectorAll('*')].filter(vis).some((e) => { const q = e.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; });
    const pq = c.querySelector('.vrm-rt-pq .n-pourquoi-texte, [data-n-pourquoi] .n-pourquoi-texte');
    return { tx: c.getAttribute('data-retour-achat'), etape: c.getAttribute('data-retour-etape'), etat, h: Math.round(r.height), w: Math.round(r.width), txt,
      motEtat: MOT[etat] ? compte(txt, MOT[etat]) : 0, pasVue: compte(txt, /dates? pas vues?/gi), libs, pleins, gestes, deborde, pourquoi: pq ? pq.textContent.trim() : '',
      repliable: !!c.querySelector('details.vrm-rt-fini'), ouvert: !!c.querySelector('details.vrm-rt-fini[open]') };
  });
  const sec = document.querySelector('[data-retours-achat]');
  const pleinsSection = sec ? [...sec.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length : 0;
  const verifs = [...document.querySelectorAll('[data-retours-a-verifier] [data-retour-perime]')].map((v) => {
    const r = v.getBoundingClientRect();
    return { h: Math.round(r.height), txt: texteVu(v), pleins: [...v.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length,
      gestes: ['perime-vinted', 'regle'].filter((g) => [...v.querySelectorAll('[data-retour-' + g + ']')].some(vis)),
      deborde: [...v.querySelectorAll('*')].filter(vis).some((e) => { const q = e.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }) };
  });
  // « ✓ ⋯ » : les deux ronds d'Achats sont-ils SEULS sur leur ligne (rien d'autre de visible à leur hauteur) ?
  const ronds = [...document.querySelectorAll('.vrm-achats-selection, .vrm-achats-plus')].filter(vis);
  let rondsSeuls = null;
  if (ronds.length) {
    const r0 = ronds[0].getBoundingClientRect(), mid = r0.top + r0.height / 2;
    const voisins = [...document.querySelectorAll('body *')].filter((e) => vis(e) && !ronds.some((x) => x === e || x.contains(e) || e.contains(x)) && e.children.length === 0 && (e.textContent || '').trim())
      .filter((e) => { const q = e.getBoundingClientRect(); return q.top < mid && q.bottom > mid; });
    rondsSeuls = voisins.length === 0;
  }
  return { cartes, pleinsSection, verifs, rondsSeuls, nRonds: ronds.length, horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});

(async () => {
  let b; const textes = {};
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const ROWS0 = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const cas = [];
    for (const style of ['', 'monochrome']) for (const sombre of [false, true]) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) cas.push([vp, sombre, style]);
    for (const [vp, sombre, style] of cas) {
      const nom = `${style || 'défaut'} ${vp.width} px ${sombre ? 'sombre' : 'clair'}`, suff = `${style || 'defaut'}-${vp.width}-${sombre ? 'sombre' : 'clair'}`, tel = vp.width < 600;
      console.log(`── ${nom}`);
      const ROWS = ROWS0.map((r) => ({ ...r, data: { ...r.data } }));
      const P = await preparer(b, vp, ROWS, { sombre, style });
      const { pg } = P;
      await essaie(nom, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXN}"][data-retour-etape="rembourse"]`, { timeout: 45000 }).catch(() => {});
        await pg.waitForSelector('[data-retours-a-verifier]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        await pg.screenshot({ path: path.join(SHOTS, `rcc-haut-${suff}.png`) }).catch(() => {});
        const m = await mesurer(pg);
        const A = m.cartes.find((c) => c.tx === TXA), N = m.cartes.find((c) => c.tx === TXN), V = m.verifs[0];
        textes[suff] = { autry: A && A.txt, nike: N && N.txt, salomon: V && V.txt, pourquoi: A && A.pourquoi, hauteurs: [A && A.h, N && N.h, V && V.h] };
        // K1
        dit(A && N && A.motEtat <= 1 && N.motEtat <= 1 && A.pasVue <= 1 && N.pasVue <= 1, `${nom} K1 un état écrit une fois (Autry « dépassé » ×${A && A.motEtat}, Nike « Remboursé » ×${N && N.motEtat}, « date pas vue » ×${N && N.pasVue})`, JSON.stringify([A && A.txt, N && N.txt]));
        // K2
        const coupes = m.cartes.flatMap((c) => c.libs.filter((l) => l.coupe).map((l) => c.tx + ':' + l.t));
        dit(coupes.length === 0, `${nom} K2 aucun libellé de frise coupé`, JSON.stringify(coupes));
        // K3
        dit(m.cartes.every((c) => c.pleins <= 1) && m.pleinsSection <= 1 && (!V || V.pleins <= 1), `${nom} K3 un seul bouton plein par carte (section : ${m.pleinsSection})`, JSON.stringify(m.cartes.map((c) => [c.tx, c.pleins])));
        // K4
        if (tel) {
          dit(A && A.h <= 300, `${nom} K4 la carte en cours (Autry) ≤ 300 px (${A && A.h})`);
          dit(N && N.h <= 96, `${nom} K4 la carte remboursée (Nike) repliée ≤ 96 px (${N && N.h})`);
          dit(V && V.h <= 100, `${nom} K4 la rangée « À vérifier » ≤ 100 px (${V && V.h})`);
        }
        dit(m.cartes.every((c) => !c.deborde) && (!V || !V.deborde) && m.horizontal <= 0, `${nom} K4 rien ne déborde de sa carte, pas de défilement horizontal`);
        // K5
        dit(A && ['vinted', 'imprimer', 'depose'].every((g) => A.gestes.includes(g)) && A.pourquoi.length > 20, `${nom} K5 Autry garde Vinted, Imprimer, Déposé et « Pourquoi ? »`, JSON.stringify(A && [A.gestes, A.pourquoi]));
        dit(V && V.gestes.length === 2, `${nom} K5 « À vérifier » garde Vinted et Réglé`, JSON.stringify(V && V.gestes));
        if (N && N.repliable) await pg.locator(`[data-retour-achat="${TXN}"] details.vrm-rt-fini > summary`).click().catch(() => {});
        await pg.waitForTimeout(250);
        const m2 = await mesurer(pg);
        const N2 = m2.cartes.find((c) => c.tx === TXN);
        textes[suff].nikeOuvert = N2 && N2.txt;
        dit(N2 && ['suivre', 'vinted'].every((g) => N2.gestes.includes(g)) && N2.pasVue <= 1 && N2.motEtat <= 1 && N2.libs.every((l) => !l.coupe), `${nom} K5 Nike déplié : Suivre et Vinted, étapes lisibles, « Remboursé » et « date pas vue » une fois`, JSON.stringify(N2 && [N2.gestes, N2.txt]));
        // K6
        if (tel) dit(m.rondsSeuls === false || m.nRonds === 0, `${nom} K6 « ✓ ⋯ » jamais seuls sur une ligne (${m.nRonds} rond(s))`, String(m.rondsSeuls));
        await pg.locator('[data-retours-achat]').first().screenshot({ path: path.join(SHOTS, `rcc-renvoyer-${suff}.png`) }).catch(() => {});
        await pg.locator('[data-retours-a-verifier]').first().screenshot({ path: path.join(SHOTS, `rcc-verifier-${suff}.png`) }).catch(() => {});
      });
      dit(P.errs.length === 0, `${nom} aucune erreur de page`, P.errs.join(' | ').slice(0, 300));
      await P.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  if (process.env.BANC_TEXTES) fs.writeFileSync(process.env.BANC_TEXTES, JSON.stringify(textes, null, 1));
  console.log(ko ? `\n❌ retours-cartes-compactes : ${ko} rouge(s)` : '\n✅ retours-cartes-compactes : tout est vert');
  process.exit(ko ? 1 : 0);
})();
