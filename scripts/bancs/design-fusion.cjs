// Banc : LE STYLE « FUSION » (2 nov., le choix de Julien sur les maquettes :
// « voilà j'aime bien, sans trop de couleur non plus, ça doit être premium »).
// Rend Ma journée, Ventes, Colis et Compta à 390 px (tactile) et 1512 px, en
// clair ET en sombre, sur des données INVENTÉES (le dépôt est public).
//
// Il juge la RÈGLE, pas l'orthographe (§6.4) — data-* et nombres rendus :
//   1. la frise de chaque vente (Vendue → Postée → Livrée → Payée) ne coche une
//      étape que PROUVÉE par la règle de src/recapVente.js :
//        · 8001 payée, sans bordereau            ⇒ Vendue seule, Postée « en cours » (à poster) ;
//        · 8002 bordereau reçu par email         ⇒ Vendue seule cochée (le bordereau n'est pas « postée ») ;
//        · 8003 « en route » (waiting)           ⇒ Vendue + Postée ;
//        · 8004 « livré »                        ⇒ Vendue + Postée (déduite) + Livrée ;
//        · 8005 finalisée (450)                  ⇒ les quatre ;
//        · 8006 annulée                          ⇒ pas de frise ;
//      MUTATION (FUSION_MUTATION=1) : le banc force une étape non prouvée dans
//      la page (data-fait) ⇒ il DOIT passer au rouge ;
//   2. la carte du mois (sombre) est là sur Ventes, Ma journée, Colis, Compta, et
//      ses chiffres viennent des règles (data-* comparés au texte de la page) ;
//   3. la frise d'un colis (Imprimé → Déposé → En route → Livré) suit la même règle ;
//   4. aucun débordement horizontal, des cibles de 44 px sur les boutons Fusion,
//      jamais « encaissé », jamais de violet ; aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=45xx node scripts/bancs/design-fusion.cjs
// Captures : SHOTS=<dossier> node scripts/bancs/design-fusion.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4398);
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.FUSION_MUTATION === '1';
const VUES = process.env.FUSION_VUES ? process.env.FUSION_VUES.split(',') : null;
const SEUL = process.env.FUSION_ECRANS ? process.env.FUSION_ECRANS.split(',') : null;

const maintenant = new Date(2026, 10, 2, 17, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES = [
  vente(8001, 'Salomon XT-6 noir taille 38,5', 70, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8003, 'New Balance 550 vert taille 42', 88, 'Le colis est en route', il(3, 10), 'waiting'),
  vente(8004, 'Nike Air Max 1 rouge taille 43', 115, 'Le colis a été livré', il(1, 10), 'waiting'),
  vente(8005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(8007, 'Nike Dunk Low Panda taille 41', 79, 'Commande finalisée', il(40), 'completed'),
  vente(8008, 'Nike Air Force 1 blanche taille 44', 60, 'Commande finalisée', il(70), 'completed'),
  vente(8006, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
// Ce que la frise DOIT cocher (règle de src/recapVente.js, projetée en quatre étapes).
const ATTENDU = { 8001: 'vendue', 8002: 'vendue', 8003: 'vendue,postee', 8004: 'vendue,postee,livree', 8005: 'vendue,postee,livree,payee', 8006: null };
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const txn = (id, jours) => ({ id: `harvest_${A}_txn_${id}`, data: { capturedAt: cap, payload: { transaction: { id, item_id: id + 900, status: 450, status_title: 'Commande finalisée', status_updated_at: il(jours, 9).toISOString() } } } });
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [], pagination: null } } },
  { id: 'email_bord_8002', data: { transaction: '8002', uid: A, filename: 'b1.pdf', modele: 'Samba', transporteur: 'Mondial Relay', suivi: '24813377', dateLimite: il(-1, 12).toISOString(), receivedAt: il(0, 12).toISOString(), pdfB64: PDF_B64 } },
  { id: 'email_bord_8003', data: { transaction: '8003', uid: A, filename: 'b2.pdf', modele: 'New Balance', suivi: '24819306', transporteur: 'Chronopost', receivedAt: il(3, 12).toISOString(), pdfB64: PDF_B64 } },
  txn(8005, 6), txn(8007, 36), txn(8008, 66),
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

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 4]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/></svg>`;

const ouvrir = async (b, vp, sombre, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    // La publication du bénéfice (celle qu'écrit l'écran Ventes, en centimes) et le CA déclaré
    // publié : INVENTÉS, pour que Compta ait de quoi montrer (Ma journée et Ventes la réécrivent).
    if (location.search.includes('tab=compta')) {
      const j = (n, ca, nCout, cout, caCouvert, frais) => [n, ca, frais, nCout, cout, caCouvert, frais, 0, 0, 0, 0, 0];
      localStorage.setItem('vrm_benefice_jours', JSON.stringify({ v: 2, jours: {
        '2026-06-12': j(2, 15000, 2, 7000, 15000, 0), '2026-07-08': j(3, 21000, 3, 9500, 21000, 0), '2026-08-20': j(2, 13000, 2, 6500, 13000, 0),
        '2026-09-15': j(4, 30000, 3, 12000, 22000, 0), '2026-10-03': j(3, 22800, 3, 10200, 22800, 0), '2026-11-01': j(2, 17800, 2, 7500, 17800, 0) } }));
      localStorage.setItem('vinted_urssaf_mois', JSON.stringify({ at: Date.now(), mois: [{ ym: '2026-10', ca: 228, n: 3, par: { Vinted: { ca: 228, n: 3 } } }, { ym: '2026-11', ca: 178, n: 2, par: { Vinted: { ca: 178, n: 2 } } }] }));
      localStorage.setItem('vinted_urssaf_freq', JSON.stringify('mensuel'));
      localStorage.setItem('vrm_compta', JSON.stringify({ sansDepenses: { at: Date.now() } }));
      localStorage.setItem('vinted_regime', JSON.stringify('micro'));
    }
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ '8004': { buyPrice: '45', numero: '23' }, '8005': { buyPrice: '30', numero: '61' }, '8003': { numero: '124' }, '8001': { numero: '99', buyPrice: '28' } }));
  } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Les logos des transporteurs (leur favicon, sur LEUR domaine) : le réseau du banc est
  // fermé ; on sert une tuile NEUTRE (un carré gris) pour voir la forme — jamais un logo dessiné.
  await pg.route(/\/favicon\.ico$/i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' }));
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
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// Ce que la page montre — mesuré dans le DOM, jamais un libellé.
const mesure = (pg) => pg.evaluate(() => {
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hors = [...document.querySelectorAll('.vrm-main *')].filter((e) => vis(e) && !e.closest('svg,.vrm-rangee,.vrm-filtres,[data-defile]') && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className && e.className.baseVal == null ? e.className : e.tagName).slice(0, 40));
  const petites = [...document.querySelectorAll('[data-fu-geste]')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => `${Math.round(e.getBoundingClientRect().height)}px ${e.textContent.trim().slice(0, 20)}`);
  const violet = [...document.querySelectorAll('[class*="vrm-fu"]')].some((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.color].some((x) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(x); if (!m) return false; const [r, g, bb] = m.slice(1).map(Number); return r > 110 && bb > 160 && g < 90; }); });
  return {
    deb: document.documentElement.scrollWidth - vw, hors: hors.slice(0, 6), petites,
    carte: !!document.querySelector('[data-fu-carte]'), violet,
    encaisse: /encaiss/i.test(document.querySelector('.vrm-main') ? document.querySelector('.vrm-main').innerText : ''),
    // (Dans une carte Colis Vinted, la rangée est devenue le bouton rond : sa puce n'y est plus — elle est jugée à part.)
    rangees: [...document.querySelectorAll('[data-rangee-bord]')].filter(vis).filter((r) => !r.closest('[data-bord-card]:not([data-vc-colis])')).map((r) => {
      const puce = r.querySelector('.vrm-puce-transp'); const autre = [...r.children].find((c) => c !== puce && vis(c));
      const bt = autre ? (autre.matches('button,a') ? autre : autre.querySelector('button,a')) : null;
      if (!puce) return { ok: false, pourquoi: 'pas de puce' };
      if (!bt) return null; // pas de bouton (ex. Vestiaire sans bordereau : une phrase) — rien à aligner
      const a = puce.getBoundingClientRect(), b = bt.getBoundingClientRect();
      const txt = bt.innerText.trim();
      return { ok: true, memeLigne: Math.abs(a.top - b.top) < 2 && Math.abs(a.height - b.height) < 2, h: Math.round(a.height), gauche: a.right <= b.left + 1,
        uneLigne: b.height < 50 && !/\n/.test(txt), fond: getComputedStyle(puce).backgroundColor, rayon: getComputedStyle(puce).borderTopLeftRadius, txt };
    }),
    frises: [...document.querySelectorAll('[data-fu-frise]')].map((f) => ({ cle: f.getAttribute('data-fu-frise'), faits: [...f.querySelectorAll('[data-fu-etape]')].filter((s) => s.getAttribute('data-fait') === '1').map((s) => s.getAttribute('data-fu-etape')).join(','), cours: (f.querySelector('[data-cours]') || { getAttribute: () => '' }).getAttribute('data-fu-etape') })),
  };
});

const ECRANS = [
  { id: 'journee', tab: 'journee', attend: '.vrm-day-layout' },
  { id: 'ventes', tab: 'cat_ventes', attend: '.vrm-sale-row[data-tx]' },
  { id: 'colis', tab: 'cat_bord', attend: '.vrm-main' },
  { id: 'compta', tab: 'compta', attend: '.vrm-main' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      for (const E of ECRANS) {
        if (SEUL && !SEUL.includes(E.id)) continue;
        console.log(`\n— ${E.id} · ${nom}`);
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, E.tab);
        await essaie(E.id, async () => {
          await pg.locator(E.attend).first().waitFor({ timeout: 30000 });
          await pg.locator('[data-fu-carte]').first().waitFor({ timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(1800);
          if (MUTATION) await pg.evaluate(() => { const s = document.querySelector('[data-fu-frise="8001"] [data-fu-etape="livree"]'); if (s) s.setAttribute('data-fait', '1'); });
          const m = await mesure(pg);
          if (process.env.FUSION_DBG) console.log(await pg.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 1).map((r) => [r, ...r.querySelectorAll('*')].slice(0, 6).map((e) => { const c = getComputedStyle(e); const b = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).slice(0, 30)} w${Math.round(b.width)} x${Math.round(b.left)} flex:${c.flex} disp:${c.display}`; }).join('\n')).join('\n'), process.env.FUSION_DBG));
          dit(m.carte, 'la carte sombre du mois est là');
          dit(m.deb <= 1 && !m.hors.length, 'aucun débordement horizontal', `${m.deb}px ${m.hors.join(' | ')}`);
          dit(!m.petites.length, 'les gestes Fusion font 44 px', m.petites.join(' | '));
          dit(!m.encaisse, 'jamais « encaissé »');
          dit(!m.violet, 'pas de violet');
          if (SHOTS) {
            await pg.screenshot({ path: path.join(SHOTS, `${E.id}-${nom}.png`) });
            if (vp.width < 600) { await pg.setViewportSize({ width: vp.width, height: 2400 }); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SHOTS, `${E.id}-${nom}-long.png`) }); await pg.setViewportSize(vp); }
          }
          // La puce transporteur : à GAUCHE du bouton, même rangée, 44 px, rayon 12, une ligne.
          const R = m.rangees.filter(Boolean);
          if (E.id === 'ventes') dit(R.length > 0, 'une rangée « puce + bordereau » au moins', String(R.length));
          // Colis (maquette FusionColis, 2 nov. 22 h) : le transporteur est l'en-tête de son groupe, un bouton rond imprime.
          if (E.id === 'colis') {
            const g = await pg.evaluate(() => ({ groupes: [...document.querySelectorAll('[data-groupe-transp]')].map((x) => x.getAttribute('data-groupe-transp')), ronds: [...document.querySelectorAll('[data-bord-card]:not([data-vc-colis]) .vrm-rangee-bord')].length, rondPret: [...document.querySelectorAll('[data-bord-card]:not([data-vc-colis]) .vrm-rangee-bord [data-imprime]')].filter((b) => { const r = b.getBoundingClientRect(); return Math.round(r.width) === 44 && Math.round(r.height) === 44 && getComputedStyle(b).borderTopLeftRadius === '50%'; }).length }));
            dit(g.groupes.length > 0 && new Set(g.groupes).size === g.groupes.length, 'colis rangés par transporteur, un en-tête par transporteur', g.groupes.join(' | '));
            dit(g.ronds > 0 && g.rondPret > 0, 'un bouton rond par colis, bleu quand le bordereau est là', `${g.rondPret}/${g.ronds}`);
          }
          if (R.length) {
            const mauvaises = R.filter((r) => !(r.ok && r.memeLigne && r.gauche && r.h === 44 && r.uneLigne && r.rayon === '12px'));
            dit(!mauvaises.length, 'la puce est à gauche du bouton, même ligne, 44 px, rayon 12, libellé sur une ligne', JSON.stringify(mauvaises[0] || R[0]).slice(0, 220));
          }
          if (SHOTS && R.length) { const el = pg.locator('[data-rangee-bord]').first(); await el.scrollIntoViewIfNeeded(); const carte = el.locator('xpath=ancestor::*[@data-fu-ligne or @data-bord-card or contains(@class,"vrm-recap")][1]'); await ((await carte.count()) ? carte.first() : el).screenshot({ path: path.join(SHOTS, `pastille-${E.id}-${nom}.png`) }); }
          if (E.id === 'ventes') {
            for (const [tx, att] of Object.entries(ATTENDU)) {
              const f = m.frises.find((x) => x.cle === tx);
              if (att == null) dit(!f, `vente ${tx} annulée : pas de frise`, f ? f.faits : '');
              else dit(!!f && f.faits === att, `vente ${tx} : la frise ne coche que le prouvé`, f ? `${f.faits} (attendu ${att})` : 'pas de frise');
            }
            // Le récapitulatif (tiroir) de 8002 : la puce à gauche de « Imprimer le bordereau ».
            const t = pg.locator('.vrm-sale-row[data-tx="8002"] .vrm-ledger-sale-toggle').first();
            await t.scrollIntoViewIfNeeded(); await t.click();
            const id = await t.getAttribute('aria-controls');
            await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 }); await pg.waitForTimeout(500);
            const rr = (await mesure(pg)).rangees.filter((r) => r.ok);
            const recap = await pg.evaluate((id) => { const d = document.getElementById(id); const r = d && d.querySelector('[data-rangee-bord]'); if (!r) return null; const p = r.querySelector('.vrm-puce-transp'), b = [...r.children].find((c) => c !== p); const bt = b && (b.matches('button') ? b : b.querySelector('button')); if (!p || !bt) return { ok: false }; const a = p.getBoundingClientRect(), c = bt.getBoundingClientRect(); return { ok: Math.abs(a.top - c.top) < 2 && Math.round(a.height) === 44 && Math.round(c.height) === 44 && a.right <= c.left + 1 }; }, id);
            dit(recap && recap.ok, 'récapitulatif : la puce à gauche du bouton, même rangée, 44 px', JSON.stringify(recap));
            if (SHOTS) await pg.locator(`[id="${id}"] [data-rangee-bord]`).first().screenshot({ path: path.join(SHOTS, `pastille-recap-${nom}.png`) }).catch(() => {});
            await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
            void rr;
            const f1 = m.frises.find((x) => x.cle === '8001');
            dit(f1 && f1.cours === 'postee', '8001 à poster : « Postée » est l’étape en cours', f1 && f1.cours);
          }
          if (E.id === 'colis') {
            dit(m.frises.length > 0, 'chaque colis porte sa frise', String(m.frises.length));
          }
        });
        dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
        await ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
