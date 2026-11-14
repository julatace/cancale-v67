// ════════════════════════════════════════════════════════════════════════════
//  Banc : LE COLIS VINTED GO RÉACHEMINÉ (14 nov., captures de Julien sur son iPhone : « il n'y a pas le QR code
//  qui est présent dans l'application » ; le colis est à un AUTRE point que celui choisi).
//  Base SYNTHÉTIQUE de la FORME mesurée en production (dépôt public : aucun n°, code ni adresse réels) :
//   · A — l'achat Vinted Go réacheminé : la conversation (code, lieu nommé), l'e-mail Vinted Go « Nouveau relais :
//     il est temps de récupérer ton colis ! » rangé « en route · point changé » (code, QR http avec `&amp;`, aucun
//     lieu, aucun code postal), le suivi Vinted (n°) et le transporteur (rue + ville, sans nom, disponible 18 s
//     AVANT l'e-mail) ;
//   · B — un autre Vinted Go à retirer dont l'adresse de QR porte un AUTRE code que le sien (jamais montré) ;
//   · C — un achat Vinted SANS e-mail dont la conversation nomme l'ANCIEN point (« Tabac du Port … Ville-Avant ») et
//     que le transporteur dit disponible au NOUVEAU point par un événement daté APRÈS : l'ancien point n'est plus un
//     lieu de retrait nulle part.
//  Exige (boîtes et requêtes rendues, 390 tactile clair + sombre et 1512) : A montre SON QR (image chargée, adresse
//  au n° et au code du colis, `&time=` décodé), sous « Épicerie du Marché · …, 56000 Ville-Exemple » ; B : son code,
//  aucun QR ; C sous le nouveau point, « Ville-Avant » nulle part comme point ou adresse (À retirer, Mode relais,
//  Ma journée) ; le mode relais montre le QR de A. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
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
const PORT = Number(process.env.BANC_PORT || 4519);
const SHOTS = process.env.SHOTS || '';
const MATIN = new Date('2026-11-14T09:46:00+01:00');
const cap = MATIN.toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '333', login: 'compte_v', domain: 'www.vinted.fr', updated_at: cap }];
const SIG = 'ab12cd34'.repeat(8);
const QRURL = (s, c) => `http://p.vintedgo.com/public/v1/qr_codes/${s}:${c}:${SIG}?email_code=VCARRIER_REROUTED_PICKUP&amp;time=2026-11-13T11%3A01%3A34Z`;
const A = { tx: 5550001, suivi: '1ZZTE5TAAAAAA', code: '481516', titre: 'Baskets toile grises' };
const B = { suivi: '1ZZTE5TBBBBBB', code: '272829', titre: 'Colis Vinted Go' };
const C = { tx: 5550003, suivi: '1ZZTE5TCCCCCC', code: '313233', titre: 'Sweat gris chiné' };
const NOUVEAU = 'Épicerie du Marché, 12 Rue de la Fontaine, 56000 Ville-Exemple';
const ANCIEN = 'Tabac du Port, 1 Rue du Port, 35260 Ville-Avant';
const photo = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (o, k) => ({ transaction_id: o.tx, conversation_id: `01a1aaaa-bbbb-7ccc-8ddd-${String(o.tx).padStart(12, '0')}`, title: o.titre, price: { amount: '20.90', currency_code: 'EUR' },
  status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", date: '2026-10-17T12:06:53Z', photo: { url: photo(k) }, transaction_user_status: 'needs_action' });
const transp = (s, rue, ville, etatAt) => ({ id: `transp_vinted_${s}`, data: { v: 1, lu: '2026-11-14T08:46:49.705Z', etat: 'disponible', fini: false, voie: 'vg-v3', suivi: s, etatAt, lieuCp: '', limite: '2026-11-20', source: 'serveur', carrier: 'vinted',
  libelle: 'Le colis est prêt à être retiré en point relais', lieuNom: '', lieuRue: rue, pointId: '900001', limiteAt: '2026-11-20T11:01:15.000Z', lieuVille: ville, limiteSure: true,
  evenements: [{ at: etatAt, code: 'ready_for_pickup', lieu: `${rue}, ${ville}, FR`, libelle: 'Le colis est prêt à être retiré en point relais' }] } });
const suiviVinted = (o) => ({ id: `harvest_333_suivi_${o.tx}`, data: { n: 1, v: 1, tx: String(o.tx), suivi: o.suivi, etapes: [{ t: 'Disponible pour retrait', at: '2026-11-13T11:01:16.000Z', code: 'available_for_pickup' }], source: 'journey',
  dernier: { t: 'Disponible pour retrait', at: '2026-11-13T11:01:16.000Z', code: 'available_for_pickup' }, capturedAt: '2026-11-13T21:38:18.770Z', transporteur: null } });
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Ville-Avant', vrm_points_relais: [{ lat: 48.67, lon: -1.85, nom: 'Tabac du Port', auto: true, full: ANCIEN }] } },
  { id: 'harvest_333_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(A, 1), achat(C, 3)] } } },
  { id: 'harvest_333_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: {
    [A.tx]: { at: '2026-11-13T21:38:15.861Z', qr: '', tx: String(A.tx), url: 'https://www.vinted.fr/inbox/7777', code: A.code, conv: '7777', item: '8881', lieu: NOUVEAU, photo: photo(1), titre: A.titre, arriveLe: '2026-11-13T11:01:19.000Z', transporteur: 'vinted' },
    [C.tx]: { at: '2026-11-12T20:00:00.000Z', qr: '', tx: String(C.tx), url: 'https://www.vinted.fr/inbox/7779', code: C.code, conv: '7779', item: '8883', lieu: ANCIEN, photo: photo(3), titre: C.titre, arriveLe: '2026-11-12T09:00:00.000Z', transporteur: 'vinted' },
  } },
  // A : la forme exacte de la ligne rangée en production (« en route · point changé », aucun lieu, QR http + &amp;).
  { id: `email_track_vinted_${A.suivi}`, data: { code: A.code, lieu: null, type: 'suivi', code2: null, qrB64: null, qrUrl: QRURL(A.suivi, A.code), suivi: A.suivi, limite: '2026-11-19', qrType: null, status: 'transit', account: 'compte_v', carrier: 'vinted',
    emailAt: '2026-11-13T11:01:34.000Z', subject: `Nouveau relais : il est temps de récupérer ton colis ! #${A.suivi}`, artTitle: null, consigne: false, receivedAt: '2026-11-13T11:02:33.736Z', statusLabel: 'Point relais changé', relaisChange: true } },
  // B : un « disponible » dont l'adresse de QR porte un AUTRE code que le sien.
  { id: `email_track_vinted_${B.suivi}`, data: { code: B.code, lieu: NOUVEAU, type: 'suivi', qrUrl: QRURL(B.suivi, '999999'), suivi: B.suivi, limite: '2026-11-19', status: 'available', account: 'compte_v', carrier: 'vinted',
    emailAt: '2026-11-13T15:00:00.000Z', subject: `Ton colis t'attend au point Vinted Go #${B.suivi}`, receivedAt: '2026-11-13T15:00:30.000Z', statusLabel: 'Arrivé au point de retrait' } },
  suiviVinted(A), suiviVinted(C),
  transp(A.suivi, '12 Rue de la Fontaine', 'Ville-Exemple', '2026-11-13T11:01:16.017Z'),
  transp(C.suivi, '12 Rue de la Fontaine', 'Ville-Exemple', '2026-11-13T10:00:00.000Z'),
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
// Une image de QR inventée (deux carrés) — ce qu'importe ici, c'est QUELLE adresse l'app demande.
const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84"><rect width="84" height="84" fill="#fff"/><rect x="4" y="4" width="28" height="28" fill="#000"/><rect x="52" y="52" width="28" height="28" fill="#000"/></svg>';
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = [], qrDemandes = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: MATIN });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // (Playwright prend la DERNIÈRE route posée en premier : celle des QR vient après la garde réseau.)
  await pg.route(/p\.vintedgo\.com\/public\/v1\/qr_codes\//, (r) => { qrDemandes.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: QR_SVG }); });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, qrDemandes };
};
const shot = async (pg, k, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `vinted-go-${k}-${nom}.png`) }); };
const ANCIEN_RE = /Ville-Avant|Tabac du Port/;

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    const VUES = [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]
      .filter(([, , n]) => !process.env.VUES || process.env.VUES.split(',').includes(n));   // `VUES=390-clair` : une seule (mémoire)
    for (const [vp, sombre, nom] of VUES) {
      console.log(`\n— Vinted Go réacheminé · ${nom}`);
      const { ctx, pg, errs, qrDemandes } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 45000 });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        // L'écran Achats se charge à la demande (squelette, puis la liste) : on attend que la liste TIENNE (3 lignes,
        // deux relevés à 1 s d'intervalle) — une condition, jamais un délai seul.
        const lignes3 = () => pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]').length >= 3, null, { timeout: 45000 });
        await lignes3(); await pg.waitForTimeout(1000); await lignes3();
        // Chaque ligne dépliée (le QR vit dans le dépli), puis le QR de A chargé — une condition, jamais un délai fixe.
        // Un dépli à la fois (accordéon) : on ouvre celui de A, puis on juge B sans le déplier (son QR serait dans la
        // ligne fermée aussi : la vignette « QR » de la ligne dit s'il en a un).
        const ligneDe = (code) => `[...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((l) => l.querySelector('[data-code-retrait="${code}"]'))`;
        await pg.evaluate(new Function(`const l = ${ligneDe(A.code)}; const o = l && l.querySelector('.vrm-rpf-ouvrir'); if (o && o.getAttribute('aria-expanded') !== 'true') o.click();`));
        await pg.waitForFunction(new Function(`const l = ${ligneDe(A.code)}; const o = l && l.querySelector('.vrm-rpf-ouvrir'); return !!o && o.getAttribute('aria-expanded') === 'true';`), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction(new Function(`const l = ${ligneDe(A.code)}; const im = l && l.querySelector('[data-colis-qr] img'); return !!(im && im.complete && im.naturalWidth > 0);`), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(300);
        const vue = await pg.evaluate(({ a, bb, c }) => {
          const ligne = (code) => [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((l) => l.querySelector(`[data-code-retrait="${code}"]`));
          const point = (l) => { const p = l && l.closest('.vrm-rpf-point'); return p ? { nom: ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '').trim(), adr: ((p.querySelector('.vrm-rpf-adr') || {}).textContent || '').trim() } : null; };
          const qr = (l) => { const im = l && l.querySelector('[data-colis-qr] img'); return im ? { w: im.naturalWidth, src: im.currentSrc || im.src } : null; };
          const la = ligne(a), lb = ligne(bb), lc = ligne(c);
          const points = [...document.querySelectorAll('.vrm-rpf-point')].map((p) => ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '') + ' | ' + ((p.querySelector('.vrm-rpf-adr') || {}).textContent || ''));
          return { a: !!la, b: !!lb, c: !!lc, pa: point(la), pb: point(lb), pc: point(lc), qa: qr(la), qaLigne: !!(la && la.querySelector('[data-rp-qr-ligne]')), qb: qr(lb) || (lb && lb.querySelector('[data-rp-qr-ligne]') ? 'icône QR' : null), qbPasCharge: !!(lb && lb.querySelector('[data-colis-qr-pas-charge]')), points };
        }, { a: A.code, bb: B.code, c: C.code });
        if (process.env.BANC_DETAIL) console.log(await pg.evaluate(({ a, c }) => { const ligne = (code) => [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((l) => l.querySelector(`[data-code-retrait="${code}"]`));
          const la = ligne(a), lc = ligne(c); return 'A: ' + (la ? la.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 1800) : '—') + '\n\nC: ' + (lc && lc.parentElement ? lc.parentElement.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 700) : '—'); }, { a: A.code, c: C.code }));
        await pg.evaluate((code) => { const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.querySelector(`[data-code-retrait="${code}"]`)); if (l) { l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); } }, A.code);
        await shot(pg, 'a-retirer', nom);
        dit(vue.a && vue.b && vue.c, `${nom} : les trois colis sont à retirer (A, B, C), chacun sa ligne`, JSON.stringify({ a: vue.a, b: vue.b, c: vue.c }));
        const demandeA = qrDemandes.find((u) => u.includes(`${A.suivi}:${A.code}:`)) || '';
        dit(!!vue.qa && vue.qa.w > 0 && !!demandeA, `${nom} : A montre SON QR Vinted Go (image chargée, adresse au n° ${A.suivi} et au code ${A.code})`, JSON.stringify({ qa: vue.qa && { w: vue.qa.w }, demandeA: demandeA.slice(0, 90) }));
        dit(!!demandeA && /[?&]time=/.test(demandeA) && !/&amp;/.test(demandeA) && /^https:/.test(demandeA), `${nom} : …demandée en https, \`&time=\` décodé (plus \`&amp;time=\`)`, demandeA.replace(SIG, '…'));
        dit(!vue.qb && !vue.qbPasCharge && !qrDemandes.some((u) => u.includes(`${B.suivi}:999999:`)), `${nom} : B (adresse de QR à un AUTRE code) — aucun QR montré ni demandé, son code reste`, JSON.stringify({ qb: vue.qb, demandes: qrDemandes.length }));
        dit(!!vue.pa && /Épicerie du Marché/.test(vue.pa.nom) && /56000 Ville-Exemple/.test(vue.pa.adr), `${nom} : A sous « Épicerie du Marché », adresse complète (le lieu du transporteur, sans nom, ne remplace pas le point nommé)`, JSON.stringify(vue.pa));
        dit(!!vue.pc && !ANCIEN_RE.test(vue.pc.nom + vue.pc.adr) && /Fontaine/.test(vue.pc.adr), `${nom} : C (conversation à l'ANCIEN point, transporteur au nouveau, daté après) sous le NOUVEAU point`, JSON.stringify(vue.pc));
        dit(!vue.points.some((p) => ANCIEN_RE.test(p)), `${nom} : l'ancien point n'est plus un lieu de retrait (aucun point ni adresse « Ville-Avant »)`, vue.points.join(' // '));
        // Le mode relais : le QR de A au comptoir, aucun ancien point.
        const bouton = pg.locator('[data-relais-ouvrir]').first();
        if (await bouton.count()) {
          await bouton.click();
          await pg.locator('.vrm-relais').first().waitFor({ timeout: 15000 });
          const mr = await pg.evaluate(async (code) => {
            const out = { qrA: null, lieux: [], n: Number((document.querySelector('.vrm-relais') || { getAttribute: () => 0 }).getAttribute('data-relais')) || 0 };
            const tous = document.querySelector('.vrm-relais [data-relais-point=""]'); if (tous) { tous.click(); await new Promise((r) => setTimeout(r, 250)); }
            for (let i = 0; i < 6; i++) {
              const carte = document.querySelector('.vrm-relais-carte');
              if (carte) {
                out.lieux.push(((carte.querySelector('[data-relais-lieu]') || {}).textContent || '') + ' | ' + ((carte.querySelector('.vrm-relais-adresse') || {}).textContent || ''));
                if (carte.querySelector(`[data-relais-code="${code}"]`)) { const im = carte.querySelector('[data-relais-qr]'); out.qrA = im ? (im.getAttribute('src') || '') : ''; }
              }
              const s = document.querySelector('.vrm-relais [data-relais-suivant]'); if (!s || s.disabled) break; s.click(); await new Promise((r) => setTimeout(r, 300));
            }
            return out;
          }, A.code);
          await shot(pg, 'mode-relais', nom);
          dit(!!mr.qrA && (/qr_codes\//.test(mr.qrA) || /^data:image/.test(mr.qrA)), `${nom} : le mode relais montre le QR de A`, `${mr.qrA === null ? 'carte de A pas vue' : (mr.qrA || 'aucune image').slice(0, 80)} · ${mr.n} colis`);
          dit(!mr.lieux.some((l) => ANCIEN_RE.test(l)), `${nom} : le mode relais ne nomme jamais l'ancien point`, mr.lieux.join(' // '));
          await pg.keyboard.press('Escape').catch(() => {});
          const f = pg.locator('[data-relais-fermer]').first(); if (await f.count()) await f.click().catch(() => {});
        } else dit(false, `${nom} : le bouton « Mode relais » est là`);
        // Ma journée : rien de l'ancien point.
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=journee' })));
        await pg.waitForFunction(() => /Ma journée/.test(document.body.innerText) && !/Ouverture…/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const jt = await pg.evaluate(() => document.body.innerText);
        await shot(pg, 'journee', nom);
        dit(/Ma journée/.test(jt) && !ANCIEN_RE.test(jt), `${nom} : Ma journée ne nomme jamais l'ancien point`, (jt.match(/.{0,40}(Ville-Avant|Tabac du Port).{0,40}/) || [''])[0]);
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-vinted-go : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
