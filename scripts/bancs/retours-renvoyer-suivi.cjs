// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE SUIVI DES RETOURS D'ACHAT, ET LEURS CARTES (23 nov., lot retours-suivi — après `npm run build` ;
//        node scripts/bancs/retours-renvoyer-suivi.cjs ; BANC_PORT=…, BANC_DIST=…, BANC_SHOTS=…)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (captures iPhone, Achats → « À renvoyer ») : « je veux que tu fasses le suivi des colis retournés ».
// Ses trois retours, en données INVENTÉES à la forme mesurée (dépôt public) :
//   · « Nike » : bordereau Mondial Relay, DÉPOSÉ (e-mail Mondial Relay « en transit » du même n°), puis REMBOURSÉ
//     35,98 € — Mondial Relay n'écrit jamais l'arrivée à l'expéditeur (mesuré : 29 « transit », 0 « livré ») ;
//   · « Autry » : bordereau Chronopost, date limite de dépôt PASSÉE il y a 3 h, rien de lu ;
//   · « Salomon » : un avis « Retourne ta commande » sans bordereau, limite passée depuis 40 jours ⇒ « À vérifier ».
// Il exige (390 tactile iPhone et 1512, clair et sombre) :
//   R1 Nike : les étapes Bordereau ✓ · Déposé ✓ (daté) · En route ✓ · Livré au vendeur ✓ · Remboursé ✓ — en route et
//      livré « faits, date pas vue » (data-retour-et-implicite=1), AUCUNE date inventée ;
//   R2 Autry : « Date limite de dépôt dépassée » + la date ; étiquette « Délai dépassé » ; AUCUN orange/ambre dans la
//      carte (ni texte, ni fond, ni bord) ; au plus une phrase courte (≤ 8 mots) visible, le reste sous « Pourquoi ? » ;
//   R3 aucun bouton hors d'une carte (tout bouton/lien-bouton de « À renvoyer » est DANS un [data-retour-achat]) et
//      rien ne déborde de sa carte ; les boutons sont des vrais boutons (≥ 44 px au doigt, icône + verbe) ;
//   R4 « À vérifier » : la vignette est dans la carte, le titre a la largeur (≥ 55 % de la ligne), les deux boutons
//      sont sur la même ligne, même hauteur ;
//   R5 SUIVI EN CONTINU : un e-mail Chronopost « en transit » du n° EXACT de l'Autry arrive pendant que l'écran est
//      ouvert (signal `vrm:neuf` « colis », la veille) ⇒ la carte passe « En route » SANS recharger ;
//   R6 aucune requête vers Vinted, aucune erreur, pas de défilement horizontal ; captures regardées.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4481;
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

async function preparer(b, vp, ROWS, { sombre = false } = {}) {
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(mobile ? { isMobile: true, hasTouch: true, userAgent: UA_IPHONE } : {}) });
  const errs = [], versVinted = [], selectData = [];
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); localStorage.setItem('vrm_reclasse_retours_at', String(Date.now())); } catch (_) {}
    // Ce que l'impression OUVRE : la feuille de partage (iPhone) et les PDF fabriqués (blob).
    window.__partages = []; window.__blobs = [];
    const cou = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o) => { const u = cou(o); try { if (o && o.type === 'application/pdf') window.__blobs.push({ u, o }); } catch (_) {} return u; };
    try {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && Array.isArray(d.files) && d.files.length) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__partages.push({ d, actif: navigator.userActivation ? navigator.userActivation.isActive : null }); return Promise.resolve(); } });
    } catch (_) {}
  }, sombre);
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

// Ce que la page montre de « À renvoyer » et « À vérifier », jugé sur la RÈGLE (data-*, géométrie, couleurs calculées).
const mesurer = (pg, tx) => pg.evaluate(([TX, TXN0]) => {
  const vis = (el) => !!el && (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0) && el.getBoundingClientRect().width > 0;
  const rgba = (c) => { const v = (/rgba?\(([^)]+)\)/.exec(c || '') || [, ''])[1].split(/[\s,/]+/).filter(Boolean).map(Number); return v.length >= 3 ? [v[0], v[1], v[2], v[3] == null ? 1 : v[3]] : null; };
  // Orange / ambre : teinte 18–52°, saturée, visible (jamais confondu avec le gris, le vert, le teal, l'encre).
  const orange = (c) => { const v = rgba(c); if (!v || v[3] < 0.15) return false; const [r, g, b] = v.map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return false;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2; const s = d / (1 - Math.abs(2 * l - 1)); return h >= 18 && h <= 52 && s >= 0.45; };
  const carte = (t) => document.querySelector(`[data-retours-achat] [data-retour-achat="${t}"]`);
  const etapes = (x) => x ? [...x.querySelectorAll('[data-retour-et]')].map((e) => ({ cle: e.getAttribute('data-retour-et'), etat: e.getAttribute('data-retour-et-etat'), impl: e.getAttribute('data-retour-et-implicite'), det: ((e.querySelector('[data-retour-et-detail]') || {}).innerText || '').trim() })) : null;
  const orangesDans = (x) => x ? [x, ...x.querySelectorAll('*')].filter(vis).filter((el) => { const cs = getComputedStyle(el); return orange(cs.color) && (el.innerText || '').trim() || orange(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && orange(cs.borderTopColor)); }).map((el) => el.className && String(el.className).slice(0, 40) || el.tagName) : null;
  // Les textes visibles (feuilles de texte), en mots — les titres d'article et la ligne d'état exclus.
  const textesLongs = (x) => {
    if (!x) return null;
    const out = [];
    const w = document.createTreeWalker(x, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) {
      const el = n.parentElement; if (!el || !vis(el)) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      if (el.closest('.vrm-ret-titre, [data-retour-et]')) continue;
      const txt = (el.innerText || '').replace(/\s+/g, ' ').trim(); const mots = txt.split(' ').filter(Boolean).length;
      if (mots > 8 && !out.includes(txt)) out.push(txt);
    }
    return out;
  };
  // Les gestes (boutons et liens-boutons) : dans une carte, et dedans géométriquement.
  const gestes = [...document.querySelectorAll('[data-retours-achat] :is([data-retour-depose], [data-retour-vinted], [data-retour-imprimer], [data-retour-suivre])')].filter(vis).map((el) => {
    const c = el.closest('[data-retour-achat]'); const r = el.getBoundingClientRect(); const rc = c ? c.getBoundingClientRect() : null;
    return { quoi: [...el.attributes].map((a) => a.name).find((n) => /^data-retour-(depose|vinted|imprimer|suivre)$/.test(n)), dans: !!c, dedans: !!rc && r.left >= rc.left - 1 && r.right <= rc.right + 1 && r.top >= rc.top - 1 && r.bottom <= rc.bottom + 1, h: Math.round(r.height), txt: (el.innerText || '').trim() };
  });
  // « À vérifier »
  const v = document.querySelector('[data-retours-a-verifier] [data-retour-perime]');
  let verif = null;
  if (v) {
    const rv = v.getBoundingClientRect();
    const img = v.querySelector('img, .vrm-rl-ph, .vrm-rt-tuile, .vrm-rt-photo');
    const ri = img ? img.getBoundingClientRect() : null;
    const ph = [...v.querySelectorAll('*')].find((e) => /nouvelles/.test(e.textContent || '') && ![...e.children].some((k) => /nouvelles/.test(k.textContent || '')));
    const col = ph ? ph.parentElement.getBoundingClientRect() : null;
    const act = [...v.querySelectorAll('a, button')].filter(vis).map((e) => e.getBoundingClientRect());
    verif = { lw: Math.round(rv.width), vignette: ri ? { l: Math.round(ri.left - rv.left), w: Math.round(ri.width), h: Math.round(ri.height) } : null, colonne: col ? Math.round(col.width) : 0,
      gestes: act.map((r) => ({ t: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) })), phrase: ph ? ph.innerText.trim() : '' };
  }
  const x = carte(TX), n = carte(TXN0);
  return {
    autry: x ? { etape: x.getAttribute('data-retour-etape'), texte: x.innerText.replace(/\s+/g, ' '), tag: ((x.querySelector('[data-retour-tag]') || {}).innerText || '').trim(), oranges: orangesDans(x), longs: textesLongs(x), etapes: etapes(x) } : null,
    nike: n ? { etape: n.getAttribute('data-retour-etape'), etapes: etapes(n), oranges: orangesDans(n), longs: textesLongs(n), texte: n.innerText.replace(/\s+/g, ' ') } : null,
    gestes, verif, orangesSection: orangesDans(document.querySelector('[data-retours-achat]')), horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, [tx, TXN]);

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const ROWS0 = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const cas = [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of cas) {
      const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`, suff = `${vp.width}-${sombre ? 'sombre' : 'clair'}`, doigt = vp.width < 600;
      console.log(`── ${nom}`);
      const ROWS = ROWS0.map((r) => ({ ...r, data: { ...r.data } }));
      const P = await preparer(b, vp, ROWS, { sombre });
      const { pg } = P;
      await essaie(nom, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXN}"][data-retour-etape="rembourse"]`, { timeout: 45000 }).catch(() => {});
        await pg.waitForSelector('[data-retours-a-verifier]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const m = await mesurer(pg, TXA);
        // R1
        const eN = m.nike && m.nike.etapes;
        dit(eN && eN.map((e) => e.cle + ':' + e.etat).join(' ') === 'bordereau:fait deposer:fait route:fait livre:fait rembourse:fait', `${nom} R1 Nike remboursé : les 5 étapes faites (une étape postérieure prouvée implique les précédentes)`, JSON.stringify(eN));
        dit(eN && eN.length === 5 && eN[2].impl === '1' && eN[3].impl === '1' && eN[1].impl !== '1' && /date pas vue/.test(eN[2].det) && /date pas vue/.test(eN[3].det) && !/\d/.test(eN[2].det + eN[3].det) && /\d/.test(eN[1].det) && /35,98/.test(eN[4].det),
          `${nom} R1 en route et livré « date pas vue » (aucune date inventée), déposé daté, remboursé 35,98 €`, JSON.stringify(eN));
        // R2
        const a = m.autry;
        dit(a && /Date limite de dépôt dépassée/.test(a.texte) && /Délai dépassé/.test(a.tag), `${nom} R2 Autry : « Date limite de dépôt dépassée » + étiquette « Délai dépassé »`, JSON.stringify(a && [a.texte.slice(0, 160), a.tag]));
        dit(m.orangesSection && m.orangesSection.length === 0, `${nom} R2 aucun orange ni ambre dans « À renvoyer »`, JSON.stringify(m.orangesSection));
        dit(a && m.nike && a.longs.length === 0 && m.nike.longs.length === 0, `${nom} R2 au plus une phrase courte (≤ 8 mots) visible par carte, le détail sous « Pourquoi ? »`, JSON.stringify(a && [a.longs, m.nike && m.nike.longs]));
        // R3
        dit(m.gestes.length >= 3 && m.gestes.every((g) => g.dans && g.dedans), `${nom} R3 aucun bouton hors d’une carte, rien ne déborde (${m.gestes.length} gestes)`, JSON.stringify(m.gestes));
        dit(m.gestes.every((g) => g.h >= (doigt ? 44 : 36) && g.txt.split(/\s+/).length <= 2 && !/↗/.test(g.txt)), `${nom} R3 des vrais boutons (≥ ${doigt ? 44 : 36} px, un verbe court, pas de « ↗ » en texte)`, JSON.stringify(m.gestes.map((g) => [g.quoi, g.h, g.txt])));
        // R4
        const v = m.verif;
        const memeLigne = v && v.gestes.length === 2 && Math.abs(v.gestes[0].t - v.gestes[1].t) <= 2 && v.gestes[0].h === v.gestes[1].h && v.gestes[0].h >= (doigt ? 44 : 36);
        dit(v && v.vignette && v.vignette.l >= 0 && v.vignette.w > 0 && v.vignette.w <= 56 && v.colonne >= 0.55 * v.lw && memeLigne,
          `${nom} R4 « À vérifier » : vignette dans la carte, texte sur la largeur (${v && v.colonne}/${v && v.lw} px), deux boutons alignés`, JSON.stringify(v));
        dit(m.horizontal <= 0, `${nom} R6 pas de défilement horizontal`, String(m.horizontal));
        await pg.locator('[data-retours-achat]').first().screenshot({ path: path.join(SHOTS, `retours-renvoyer-suivi-${suff}.png`) }).catch(() => {});
        await pg.locator('[data-retours-a-verifier]').first().screenshot({ path: path.join(SHOTS, `retours-renvoyer-verif-${suff}.png`) }).catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `retours-renvoyer-page-${suff}.png`), fullPage: false }).catch(() => {});
        // R5 — un e-mail Chronopost « en transit » du n° EXACT de l'Autry arrive, écran ouvert : la veille le signale.
        const id = `email_track_chronopost_${SA}`;
        ROWS.push({ id, data: { type: 'suivi', carrier: 'chronopost', suivi: SA, status: 'transit', statusLabel: 'En cours d’acheminement', sens: 'sortant', subject: 'Votre colis est en cours d’acheminement', emailAt: ilYaH(1), receivedAt: ilYaH(1) } });
        await pg.evaluate((i) => window.dispatchEvent(new CustomEvent('vrm:neuf', { detail: { ids: [i], quoi: [{ quoi: 'colis', uid: null }], at: Date.now() } })), id);
        const ok = await pg.waitForSelector(`[data-retours-achat] [data-retour-achat="${TXA}"][data-retour-etape="en-route"]`, { timeout: 12000 }).then(() => true, () => false);
        const m2 = await mesurer(pg, TXA);
        dit(ok && m2.autry && /En route/.test(m2.autry.texte) && !/Date limite de dépôt dépassée/.test(m2.autry.texte), `${nom} R5 l’e-mail Chronopost rangé fait avancer l’Autry « En route » SANS recharger`, JSON.stringify(m2.autry && [m2.autry.etape, m2.autry.texte.slice(0, 140)]));
        await pg.locator(`[data-retours-achat] [data-retour-achat="${TXA}"]`).first().screenshot({ path: path.join(SHOTS, `retours-renvoyer-avance-${suff}.png`) }).catch(() => {});
      });
      dit(P.versVinted.length === 0, `${nom} R6 aucune requête vers Vinted`, P.versVinted.slice(0, 3).join(' '));
      dit(P.errs.length === 0, `${nom} R6 aucune erreur de page`, P.errs.join(' | ').slice(0, 300));
      await P.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ retours-renvoyer-suivi : ${ko} rouge(s)` : '\n✅ retours-renvoyer-suivi : tout est vert');
  process.exit(ko ? 1 : 0);
})();
