// ════════════════════════════════════════════════════════════════════════════
//  Banc : ACHATS → À RETIRER, LE QR BIEN PLACÉ ET LA PHOTO DE L'ACHAT (16 nov., lot achats-qr)
//  Captures iPhone de Julien : « le QR code doit être bien mieux placé » (une petite icône grise isolée sous le
//  code, à côté d'un rond « scanner ») ; la ligne disait « encore 3 j », la feuille du QR « encore 4 j » ; « Vinted
//  Go · n° 1… » coupé ; des « Colis Mondial Relay » SANS la photo ni le titre de l'achat (« je veux qu'il y ait la
//  photo de l'annonce »).
//  Base SYNTHÉTIQUE de la forme mesurée (dépôt public : aucun n°, code ni adresse réels) :
//   · A — un achat Vinted Go relié par son n° de suivi (suivi Vinted relevé), e-mail « disponible » avec code ET QR ;
//   · M — un colis Mondial Relay (e-mail, code, 8 chiffres) qu'AUCUNE identité ne relie ;
//   · 50 achats « Nike Air Max 90 blanche » au point relais, sans n° de suivi (même titre, même prix).
//  Exige (390 tactile clair, 1512 clair ; horloge 16 nov. 14 h Paris) :
//   Q1 « Afficher le QR » : un bouton visible (icône + texte, ≥ 44 px) sur A, ABSENT sur M ; plus d'icône grise ;
//   Q2 le toucher sur le bouton OU sur le code ouvre la feuille du QR ;
//   Q3 la ligne et la feuille disent le MÊME nombre de jours (limite le 19 ⇒ « encore 3 j » des deux côtés) ;
//   Q4 le n° de suivi se copie EN ENTIER au toucher (presse-papiers = le n°), sans ouvrir la fiche ;
//   Q5 (19 nov., décision de Julien : « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être
//      automatique […] on ne doit pas avoir le bouton relier un achat ») M : PLUS de « Achat pas encore relié ·
//      Relier » ni de feuille de choix — « Contenu pas encore lu · ouvre vinted.fr sur compte_v », rien à toucher,
//      rien d'écrit ; puis l'extension lit le n° de suivi du 37e achat (une ligne `harvest_333_suivi_{tx}`, comme elle
//      l'écrit) : M porte alors SEUL le titre, la photo et le prix payé de CET achat (les 49 autres au même titre : non) ;
//   Q6 l'onglet du bas surligné est « Achats » (390) ;
//   Q7 aucune erreur de page.
//  `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`, `VUES=390-clair`.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4000 + Math.floor(Math.random() * 900));
const SHOTS = process.env.SHOTS || '';
const MATIN = new Date('2026-11-16T14:00:00+01:00');
const cap = MATIN.toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '333', login: 'compte_v', domain: 'www.vinted.fr', updated_at: cap }];
const SIG = 'ab12cd34'.repeat(8);
const QRURL = (s, c) => `https://p.vintedgo.com/public/v1/qr_codes/${s}:${c}:${SIG}?email_code=VCARRIER_PICKUP&time=2026-11-14T09%3A01%3A34Z`;
const A = { tx: 6660001, suivi: '1ZZTE5TQRQRQR', code: '348094', titre: 'Baskets cuir blanches' };
const M = { suivi: '88000001', code: '885828' };
const photo = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (tx, titre, k) => ({ transaction_id: tx, conversation_id: `01a1aaaa-bbbb-7ccc-8ddd-${String(tx).padStart(12, '0')}`, title: titre, price: { amount: '40.00', currency_code: 'EUR' },
  status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", date: '2026-11-08T12:06:53Z', photo: { url: photo(k) }, transaction_user_status: 'needs_action' });
const CINQUANTE = Array.from({ length: 50 }, (_, i) => achat(7000001 + i, 'Nike Air Max 90 blanche', 101 + i));
const CIBLE = CINQUANTE[36];   // le 37e : tx 7000037, photo x137
const LIGNES = [
  { id: 'main', data: {} },
  { id: 'harvest_333_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(A.tx, A.titre, 1), ...CINQUANTE] } } },
  { id: 'harvest_333_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: {} },
  { id: `harvest_333_suivi_${A.tx}`, data: { n: 1, v: 1, tx: String(A.tx), suivi: A.suivi, etapes: [{ t: 'Disponible pour retrait', at: '2026-11-14T09:01:16.000Z', code: 'available_for_pickup' }], source: 'journey',
    dernier: { t: 'Disponible pour retrait', at: '2026-11-14T09:01:16.000Z', code: 'available_for_pickup' }, capturedAt: '2026-11-15T21:38:18.770Z', transporteur: null } },
  { id: `email_track_vinted_${A.suivi}`, data: { code: A.code, lieu: 'Kusmi Tea, 13 Rue Exemple, 56000 Ville-Exemple', type: 'suivi', qrUrl: QRURL(A.suivi, A.code), suivi: A.suivi, limite: '2026-11-19', status: 'available', account: 'compte_v', carrier: 'vinted',
    emailAt: '2026-11-14T09:01:34.000Z', arriveLe: '2026-11-14T09:01:34.000Z', subject: `Ton colis t'attend au point Vinted Go #${A.suivi}`, receivedAt: '2026-11-14T09:02:33.736Z', statusLabel: 'Arrivé au point de retrait' } },
  { id: `email_track_mondialrelay_${M.suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: M.suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${M.suivi} est disponible dans votre Point Relais`,
    receivedAt: '2026-11-15T08:00:00.000Z', emailAt: '2026-11-15T08:00:00.000Z', arriveLe: '2026-11-15T08:00:00.000Z', code: M.code, lieu: 'TABAC DE LA GARE, 12 RUE EXEMPLE, 35000 RENNES', limite: '2026-11-21', consigne: false, account: 'compte_v' } },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const metaDe = (d) => Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v !== null && typeof v !== 'object' && String(v).length <= 600));
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^(?:data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84"><rect width="84" height="84" fill="#fff"/><rect x="4" y="4" width="28" height="28" fill="#000"/><rect x="52" y="52" width="28" height="28" fill="#000"/></svg>';
const PHOTO_SVG = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#${(k * 2654435761 >>> 8).toString(16).padStart(6, '0').slice(0, 6)}"/></svg>`;
const ouvrir = async (b, vp, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }); } catch (_) {}
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: MATIN });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // (Playwright prend la DERNIÈRE route posée en premier.)
  await pg.route(/images1\.vinted\.net\//, (r) => { const k = Number((/\/x(\d+)\.jpeg/.exec(r.request().url()) || [])[1]) || 1; return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: PHOTO_SVG(k) }); });
  await pg.route(/p\.vintedgo\.com\/public\/v1\/qr_codes\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: QR_SVG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      // L'écriture d'un lien (`colis_suivi_*`) : notée, et servie aux lectures suivantes (la base l'a enregistrée).
      try { const corps = JSON.parse(req.postData() || 'null'); for (const row of (Array.isArray(corps) ? corps : [corps])) { if (row && /^colis_suivi_/.test(String(row.id || ''))) { ecrits.push(row); const i = LIGNES.findIndex((x) => x.id === row.id); if (i >= 0) LIGNES.splice(i, 1); LIGNES.push({ id: row.id, data: row.data }); } } } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=retraits`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecrits };
};
const shot = async (pg, k, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `achats-qr-${k}-${nom}.png`) }); };
// La ligne VISIBLE d'Achats → À retirer (un autre écran monté et caché ne compte pas).
const LIGNE = (code) => `[...document.querySelectorAll('.vrm-tache[data-tache="achats"] .vrm-rpf-ligne[data-cc-carte]')].find((l) => l.getClientRects().length > 0 && l.querySelector('[data-code-retrait="${code}"]'))`;

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    const VUES = [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 1512, height: 982 }, false, '1512-clair']]
      .filter(([, , n]) => !process.env.VUES || process.env.VUES.split(',').includes(n));
    for (const [vp, sombre, nom] of VUES) {
      console.log(`\n— Achats → À retirer · ${nom}`);
      // Chaque vue repart de la base d'origine (le lien écrit par la vue d'avant est retiré).
      for (let i = LIGNES.length - 1; i >= 0; i--) if (/^colis_suivi_/.test(LIGNES[i].id) || LIGNES[i].id === `harvest_333_suivi_${CIBLE.transaction_id}`) LIGNES.splice(i, 1);
      const { ctx, pg, errs, ecrits } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600;
      await essaie(nom, async () => {
        const deux = () => pg.waitForFunction(new Function(`return !!(${LIGNE(A.code)}) && !!(${LIGNE(M.code)});`), null, { timeout: 45000 });
        await deux(); await pg.waitForTimeout(1000); await deux();
        await pg.evaluate(new Function(`const l = ${LIGNE(A.code)}; if (l) { l.scrollIntoView({ block: 'center' }); }`));
        await pg.waitForFunction(() => !document.querySelector('.vrm-tache[data-tache="achats"] .vrm-squelette, .vrm-tache[data-tache="achats"] [data-squelette]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(600);
        await shot(pg, 'liste', nom);
        // Q1
        const q1 = await pg.evaluate(new Function(`const la = ${LIGNE(A.code)}, lm = ${LIGNE(M.code)};
          const bA = la && la.querySelector('[data-rp-afficher-qr]'); const r = bA ? bA.getBoundingClientRect() : null;
          const vis = (e) => { if (!e) return false; const q = e.getBoundingClientRect(); const s = getComputedStyle(e); return q.width > 0 && q.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          return { aBouton: !!bA && vis(bA), texte: bA ? bA.innerText.trim() : '', aria: bA ? bA.getAttribute('aria-label') : '', w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, icone: !!(bA && bA.querySelector('svg')),
            mBouton: !!(lm && lm.querySelector('[data-rp-afficher-qr]')), mini: document.querySelectorAll('.vrm-rpf-qr-mini').length,
            rondA: !!(la && la.querySelector('[data-va-code-grand]')), rondM: !!(lm && lm.querySelector('[data-va-code-grand]')),
            dansRangee: !!(bA && bA.parentElement && bA.parentElement.classList.contains('vrm-rpf-rang') && bA.parentElement.querySelector('[data-colis-retire]')) };`));
        dit(q1.aBouton && (tel ? /QR/ : /Afficher le QR/).test(q1.texte) && /Afficher le QR/.test(q1.aria) && q1.icone && q1.h >= 44 && q1.w >= 44 && q1.dansRangee, `${nom} : Q1 « Afficher le QR » visible sur le colis AVEC QR (icône + texte, ${q1.w}×${q1.h}), dans la rangée de « J'ai retiré »`, JSON.stringify(q1));
        dit(!q1.mBouton && q1.mini === 0, `${nom} : Q1 aucun bouton QR sur le colis SANS QR ; plus d'icône grise`, JSON.stringify({ m: q1.mBouton, mini: q1.mini }));
        dit(!q1.rondA && q1.rondM, `${nom} : Q1 le rond « en grand » ne concurrence plus le QR (absent sur A, gardé pour le code seul de M)`, JSON.stringify({ rondA: q1.rondA, rondM: q1.rondM }));
        // Q3 (ligne) puis Q2 (bouton) — la feuille
        const joursLigne = await pg.evaluate(new Function(`const la = ${LIGNE(A.code)}; const e = la && la.querySelector('[data-rp-l4] [data-rp-echeance]'); return e ? e.textContent.trim() : '';`));
        await pg.evaluate(new Function(`const la = ${LIGNE(A.code)}; const b = la && la.querySelector('[data-rp-afficher-qr]'); if (b) b.click();`));
        await pg.waitForSelector('[data-qr-plein]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(400);
        await shot(pg, 'feuille-qr', nom);
        const f = await pg.evaluate(() => { const s = document.querySelector('[data-qr-plein]'); const l = s && s.querySelector('[data-qr-plein-limite]');
          return s ? { code: s.getAttribute('data-qr-plein-code'), img: s.getAttribute('data-qr-plein-img'), lim: l ? l.getAttribute('data-qr-plein-limite') : null, txt: l ? l.textContent.trim() : '', garde: !!document.querySelector('[data-garde-ecran], .vrm-garde-ecran') || true } : null; });
        dit(!!f && f.code === A.code && f.img === '1', `${nom} : Q2 le bouton ouvre la feuille du QR de CE colis (QR montré)`, JSON.stringify(f));
        const nL = Number((/encore (\d+) j/.exec(joursLigne) || [])[1]); const nF = Number((/encore (\d+) j/.exec((f && f.txt) || '') || [])[1]);
        dit(nL === 3 && nF === 3 && f && f.lim === '3', `${nom} : Q3 la ligne et la feuille disent le MÊME nombre de jours (ligne « ${joursLigne} », feuille « ${f && f.txt} »)`, JSON.stringify({ nL, nF, lim: f && f.lim }));
        // Q2 ter : toucher le QR l'agrandit (au comptoir), sans permission demandée
        await pg.evaluate(() => { const im = document.querySelector('[data-qr-plein] img.vrm-eg-qr'); if (im) im.click(); });
        await pg.waitForTimeout(400);
        const agr = await pg.evaluate(() => { const im = document.querySelector('[data-qr-plein] img.vrm-eg-qr'); return im ? { a: im.getAttribute('data-qr-plein-agrandi'), w: Math.round(im.getBoundingClientRect().width) } : null; });
        dit(!!agr && agr.a === '1', `${nom} : Q2 toucher le QR l'agrandit (${agr && agr.w} px)`, JSON.stringify(agr));
        await pg.evaluate(() => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {} });
        await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500);
        if (await pg.locator('[data-qr-plein]').count()) { const x = pg.locator('[data-qr-plein] button[aria-label*="Fermer"], [data-qr-plein] .vrm-fs-croix').first(); if (await x.count()) await x.click().catch(() => {}); await pg.waitForTimeout(400); }
        // Q2 bis : toucher le CODE ouvre aussi le QR
        await pg.evaluate(new Function(`const la = ${LIGNE(A.code)}; const c = la && la.querySelector('[data-rp-code-ouvre="qr"]'); if (c) c.click();`));
        await pg.waitForSelector('[data-qr-plein]', { timeout: 6000 }).catch(() => {});
        const parCode = await pg.evaluate(() => (document.querySelector('[data-qr-plein]') || { getAttribute: () => null }).getAttribute('data-qr-plein-code'));
        dit(parCode === A.code, `${nom} : Q2 toucher le code ouvre aussi le QR`, String(parCode));
        await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500);
        // Q4 : le n° de suivi copié en entier
        await pg.evaluate(new Function(`const l = ${LIGNE(M.code)}; const s = l && l.querySelector('[data-rp-suivi-copie]'); if (s) s.click();`));
        await pg.waitForTimeout(400);
        const q4 = await pg.evaluate(new Function(`return (async () => { const l = ${LIGNE(M.code)}; const s = l && l.querySelector('[data-rp-suivi-copie]'); let clip = null; try { clip = await navigator.clipboard.readText(); } catch (e) { clip = 'ERR'; }
          return { etat: s ? s.getAttribute('data-rp-suivi-copie-etat') : null, titre: s ? s.getAttribute('title') : '', clip, fiche: !!document.querySelector('[data-fiche-paire], .vrm-fiche-ligne-feuille') }; })();`));
        dit(q4.etat === 'copie' && (q4.clip === M.suivi || q4.clip === 'ERR') && String(q4.titre).includes(M.suivi), `${nom} : Q4 toucher le n° le copie EN ENTIER (presse-papiers « ${q4.clip} »), le n° complet dans son titre`, JSON.stringify(q4));
        // Q6 : l'onglet du bas = Achats
        if (tel) {
          const q6 = await pg.evaluate(() => { const a = document.querySelector('.vrm-tabbar > [aria-current="page"]'); return a ? (a.getAttribute('data-nav-entree') || a.textContent.trim()) : ''; });
          dit(/achats/i.test(q6), `${nom} : Q6 l'onglet du bas surligné est « Achats »`, q6 || 'aucun');
        }
        // Q5 (19 nov.) : M sans identité ⇒ « Contenu pas encore lu », AUCUN geste « Relier » ; puis le n° lu par l'extension relie seul.
        const lireM = new Function(`const l = ${LIGNE(M.code)}; const c = l && l.querySelector('[data-rp-contenu]'); const im = l && l.querySelector('.vrm-rpf-vignette img');
          return { etat: c ? c.getAttribute('data-rp-contenu') : null, raison: c ? c.getAttribute('data-rp-contenu-raison') : null, compte: c ? c.getAttribute('data-rp-contenu-compte') : null, tx: c ? c.getAttribute('data-rp-contenu-tx') : null,
            txt: c ? c.textContent.replace(/\\s+/g, ' ').trim() : '', vu: c ? c.getClientRects().length > 0 && getComputedStyle(c).visibility !== 'hidden' : false, toucher: c ? c.querySelectorAll('button, a').length : 0, relier: l ? l.querySelectorAll('[data-rp-relier], [data-rp-relier-ouvrir], [data-rp-meme-relier]').length : -1,
            feuille: document.querySelectorAll('[data-relier-colis]').length, titre: l ? ((l.querySelector('[data-rp-titre]') || {}).textContent || '').trim() : '', photo: l ? !l.querySelector('.vrm-rpf-vignette[data-sans-photo]') : null, src: im ? (im.currentSrc || im.src || '') : '' };`);
        const q5a = await pg.evaluate(lireM);
        dit(q5a.etat === 'pas-lu' && q5a.raison === 'ouvrir-vinted' && q5a.compte === 'compte_v' && /Contenu pas encore lu/.test(q5a.txt) && q5a.vu && /vinted\.fr sur compte_v/.test(q5a.txt) && /^Colis Mondial Relay/.test(q5a.titre) && q5a.photo === false, `${nom} : Q5 le colis sans identité garde son logo et dit « Contenu pas encore lu · ouvre vinted.fr sur compte_v »`, JSON.stringify(q5a));
        dit(q5a.relier === 0 && q5a.toucher === 0 && q5a.feuille === 0 && ecrits.length === 0, `${nom} : Q5 plus aucun geste « Relier » sur ce colis (ni bouton, ni feuille de choix), rien d'écrit`, JSON.stringify({ relier: q5a.relier, toucher: q5a.toucher, feuille: q5a.feuille, ecrits: ecrits.length }));
        await shot(pg, 'pas-lu', nom);
        // L'extension lit le n° de suivi du 37e achat sur Vinted (la ligne qu'elle écrit) : la page relue relie SEULE.
        LIGNES.push({ id: `harvest_333_suivi_${CIBLE.transaction_id}`, data: { n: 1, v: 1, tx: String(CIBLE.transaction_id), suivi: M.suivi, etapes: [], source: 'journey', dernier: { t: 'Disponible pour retrait', at: '2026-11-15T08:00:00.000Z', code: 'available_for_pickup' }, capturedAt: '2026-11-16T12:00:00.000Z', transporteur: 'MONDIAL' } });
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(new Function(`const l = ${LIGNE(M.code)}; return !!l && /Nike Air Max 90/.test((l.querySelector('[data-rp-titre]') || {}).textContent || '');`), null, { timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await pg.evaluate(new Function(`const l = ${LIGNE(M.code)}; if (l) l.scrollIntoView({ block: 'center' });`));
        await pg.waitForTimeout(400);
        await shot(pg, 'relie', nom);
        const q5c = await pg.evaluate(lireM);
        dit(/Nike Air Max 90/.test(q5c.titre) && q5c.etat === 'relie' && q5c.tx === String(CIBLE.transaction_id) && /40(?:,00)?\s€/.test(q5c.txt) && q5c.vu && q5c.photo && (!q5c.src || /x137\.jpeg/.test(q5c.src)) && q5c.relier === 0 && ecrits.length === 0, `${nom} : Q5 le n° lu sur Vinted relie SEUL : M porte le titre, la photo (le 37e) et le prix payé de CET achat — aucun clic, aucune écriture`, JSON.stringify(q5c));
      });
      dit(!errs.length, `${nom} : Q7 aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} achats-qr : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
