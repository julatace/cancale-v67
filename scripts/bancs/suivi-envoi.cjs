// Banc : LE SUIVI D'UN ENVOI (24 nov., lot suivi-ventes — Julien : « retrait des articles vendus, fais un vrai
// suivi »). La piste d'un colis vendu dans le tiroir de la vente, et « Mes envois » (Ventes → Envoyés), au
// téléphone (390 px tactile) et sur ordinateur (1512 px), en clair et en sombre. Données INVENTÉES (dépôt public),
// à la FORME mesurée le 24 nov. (lignes `depart_*` lues par `meta->>`, `email_bord_*`, transaction 450).
//
// Il juge la RÈGLE, pas l'orthographe (§6.4) — data-* et nombres rendus :
//   1. 8002 Vinted Go au point, date limite LUE demain ⇒ « Au point » fait, le nom du point, `data-envoi-limite`,
//      le danger « veille » ; « Retiré » et l'argent « pas encore su » ; la piste REMPLACE la frise (une seule) ;
//   2. 8005 Chrono Relais Europe (jamais lu chez le transporteur), Vinted « Commande livrée ! » ⇒ « Retiré » d'après
//      Vinted SANS date ; « Au point » pas su ;
//   3. 8004 finalisée (450) ⇒ l'argent coché à la date du versement LUE ;
//   4. (7002 pas encore partie : dans aucun groupe — le compte de « Mes envois » le prouve) ;
//   5. « Mes envois » : 1 en route · 1 au point · 2 retirés · 1 argent versé ; « 3 sur 5 lus chez le transporteur » ;
//      la tuile « au point » ouvre sa liste (le point, la date limite, le danger) ;
//   6. aucun orange (teintes calculées), aucun débordement, cibles de 44 px au téléphone, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=47xx node scripts/bancs/suivi-envoi.cjs ; captures : SHOTS=<dossier>.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4741);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date('2026-11-24T08:00:00Z');   // mardi 24 nov., 9 h à Paris
const H = 3600000, J = 86400000;
const il = (ms) => new Date(maintenant.getTime() - ms).toISOString();
const A = '111';
const vente = (id, titre, prix, statut, ilya, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: il(ilya), photo: { url: `https://images1.vinted.net/t/b${id % 4}/f800/a.jpeg` } });
const VENTES = [
  vente(7002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', 1 * J, 'needs_action'),
  vente(8001, 'New Balance 9060 gris taille 43', 110, "Commande expédiée et en cours d'acheminement ! ", 4 * J, 'waiting'),
  vente(8002, 'Nike Air Max 90 blanche taille 42', 65, "Commande expédiée et en cours d'acheminement ! ", 5 * J, 'waiting'),
  vente(8003, 'Asics Gel-1130 argent taille 41', 85, "Commande expédiée et en cours d'acheminement ! ", 7 * J, 'waiting'),
  vente(8004, 'Nike Dunk Low Panda taille 44', 79, "Commande finalisée - l'acheteur a validé la commande", 12 * J, 'completed'),
  vente(8005, 'Salomon XT-6 noir taille 42', 120, 'Commande livrée ! ', 8 * J, 'waiting'),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'compte_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const bord = (tx, suivi, ilya, tr = '') => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), uid: A, filename: `b${tx}.pdf`, suivi, transporteur: tr, receivedAt: il(ilya) } });
const dep = (carrier, suivi, x) => ({ id: `depart_${carrier}_${suivi}`, data: { v: 1, sens: 'sortant', suivi, carrier, essaiRes: 'ok', essais: 0, lu: il(30 * 60000), essai: il(30 * 60000), fini: true, clos: false, ...x } });
const LIMITE_8002 = new Date(maintenant.getTime() + 26 * H + 34 * 60000).toISOString();   // mer. 25 nov. 11 h 34 (Paris)
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  bord(8001, '41234567', 4 * J - H, 'mondialrelay'), bord(8002, 'VGS9000000000002', 5 * J - H), bord(8003, 'XW100000003TS', 7 * J - H), bord(8004, 'XW100000004TS', 12 * J - H), bord(8005, 'XU123456785JF', 8 * J - H),
  dep('mondialrelay', '41234567', { etat: 'en_route', etatAt: il(3 * J), priseAt: il(3 * J), derLib: 'Colis pris en charge en Point Relais' }),
  dep('vinted', 'VGS9000000000002', { etat: 'disponible', etatAt: il(20 * H), arriveeAt: il(20 * H), priseAt: il(4 * J), lieuNom: 'Consigne Test Centre', lieuVille: 'Testville', limite: '2026-11-25', limiteAt: LIMITE_8002, limiteSure: true }),
  dep('chronopost', 'XW100000003TS', { etat: 'livre', etatAt: il(1 * J), arriveeAt: il(3 * J), priseAt: il(6 * J), lieuNom: 'Tabac Test', derLib: 'Livraison effectuée', clos: true }),
  { id: `harvest_${A}_txn_8004`, data: { capturedAt: cap, payload: { transaction: { id: 8004, item_id: 9904, status: 450, status_title: 'Commande finalisée', status_updated_at: il(2 * J) } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 300)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 270 300 272 L90 272 C70 272 64 262 70 250Z" fill="#8a8f98"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
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
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  try { await pg.locator('[data-vn="ventes"]').first().waitFor({ timeout: 40000 }); }
  catch (e) { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'echec-ouverture.png') }); console.log('DOM : ' + (await pg.evaluate(() => document.body.innerText.slice(0, 600))).replace(/\s+/g, ' ')); throw e; }
  await pg.locator('button, [role="radio"], [role="tab"]').filter({ hasText: /^En route/ }).first().click({ timeout: 10000 });
  await pg.locator('[data-mes-envois]').first().waitFor({ timeout: 20000 });
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
};

// Ventes natif → En route : un groupe de « Mes envois » (ou aucun), puis la rangée de la vente (par SA transaction) ; la fiche.
const choisirGroupe = async (pg, g) => {
  const retour = pg.locator('.n-poussee .n-barre-retour:visible').first();
  if (await retour.count()) { await retour.click().catch(() => {}); await pg.waitForTimeout(500); }
  const cur = await pg.evaluate(() => { const t = document.querySelector('[data-mes-envois-groupe][aria-pressed="true"]'); return t ? t.getAttribute('data-mes-envois-groupe') : 'tous'; });
  if (cur === g) return;
  if (cur !== 'tous') { await pg.click(`[data-mes-envois-groupe="${cur}"]`); await pg.waitForTimeout(300); }
  if (g !== 'tous') { await pg.click(`[data-mes-envois-groupe="${g}"]`); await pg.waitForTimeout(500); }
};
const ouvrirVente = async (pg, tx, groupe = 'tous') => {
  const retour = pg.locator('.n-poussee .n-barre-retour:visible').first();
  if (await retour.count()) { await retour.click().catch(() => {}); await pg.waitForTimeout(500); }
  await choisirGroupe(pg, groupe);
  const l = pg.locator(`[data-vn-route="v:${tx}"]`).first();
  await l.waitFor({ timeout: 10000 });
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await pg.locator(`[data-vn-parcours="${tx}"]`).first().waitFor({ state: 'visible', timeout: 10000 });
  await pg.waitForTimeout(400);
  return tx;
};
// La piste rendue dans le tiroir, et ce qui l'entoure.
const lirePiste = (pg, id) => pg.evaluate((id) => {
  const d = document.querySelector(`[data-vn-parcours="${id}"]`); if (!d) return null;
  const p = d.querySelector('[data-envoi-parcours]');
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const etapes = p ? [...p.querySelectorAll('[data-envoi-etape]')].map((li) => ({ cle: li.getAttribute('data-envoi-etape'), etat: li.getAttribute('data-envoi-etat'), t: li.getAttribute('data-envoi-t'), source: li.getAttribute('data-envoi-source'), txt: li.innerText.replace(/\s+/g, ' ').trim() })) : [];
  const petites = p ? [...p.querySelectorAll('a, button')].filter(vis).map((e) => e.getBoundingClientRect().height).filter((h) => h < 43.5) : [];
  const hors = [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
  return {
    piste: !!p, frise: !!document.querySelector(`[data-vn-etapes="v:${id}"]`), groupe: p && p.getAttribute('data-envoi-groupe'), danger: p && p.getAttribute('data-envoi-danger'),
    limite: (p && p.querySelector('[data-envoi-limite]') || { getAttribute: () => null }).getAttribute('data-envoi-limite'),
    lieu: (p && p.querySelector('[data-envoi-lieu]') || {}).textContent || '', suivi: (p && p.querySelector('[data-envoi-suivi]') || { getAttribute: () => null }).getAttribute('data-envoi-suivi'),
    lien: !!(p && p.querySelector('a[data-envoi-suivi][href^="https://"]')), logo: !!(p && p.querySelector('.vrm-env-logo [data-transporteur-logo], .vrm-env-logo svg, .vrm-env-logo span')),
    dangerTxt: (p && p.querySelector('[data-envoi-danger-ligne]') || {}).textContent || '',
    etapes, petites, hors: hors.slice(0, 4), deb: document.documentElement.scrollWidth - vw,
  };
}, id);
// Aucun orange : les couleurs CALCULÉES des éléments du lot (teinte 15–50°, saturation ≥ 30 %, luminosité 20–85 % ⇒ orange).
const oranges = (pg, sel) => pg.evaluate((sel) => {
  const hsl = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c); if (!m || (m[4] != null && Number(m[4]) < 0.2)) return null; const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const dd = mx - mn; const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; return { h: h * 60, s, l }; };
  const out = [];
  for (const e of document.querySelectorAll(sel)) for (const el of [e, ...e.querySelectorAll('*')]) {
    const cs = getComputedStyle(el);
    for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const x = hsl(c); if (x && x.h >= 15 && x.h <= 50 && x.s >= 0.3 && x.l >= 0.2 && x.l <= 0.85) out.push(`${el.className || el.tagName}: ${c}`); }
  }
  return [...new Set(out)].slice(0, 5);
}, sel);
const et = (r, c) => r.etapes.find((e) => e.cle === c) || {};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600;
      const nf = nom.replace(/\s+/g, '-');
      await essaie('8002 au point Vinted Go', async () => {
        const id = await ouvrirVente(pg, '8002', 'tous');
        const r = await lirePiste(pg, id);
        dit(r.piste && !r.frise, '8002 parti : la piste de l’envoi REMPLACE les étapes de la fiche (une seule piste)', `piste ${r.piste} frise ${r.frise}`);
        dit(r.groupe === 'aupoint' && et(r, 'aupoint').etat === 'fait' && /Consigne Test Centre/.test(r.lieu), '8002 « Au point » fait, le nom du point LU', JSON.stringify([r.groupe, et(r, 'aupoint'), r.lieu]));
        dit(r.limite === String(Date.parse(LIMITE_8002)) && r.danger === 'veille' && r.dangerTxt.length > 0, '8002 « à retirer avant » = la date LUE ; « Colis en danger » (veille) dit sur la ligne', JSON.stringify([r.limite, r.danger, r.dangerTxt]));
        dit(et(r, 'retire').etat === 'passu' && et(r, 'argent').etat === 'passu' && et(r, 'retire').t === '', '8002 « Retiré » et l’argent : « pas encore su », aucune date', JSON.stringify([et(r, 'retire'), et(r, 'argent')]));
        dit(r.suivi === 'VGS9000000000002' && r.lien, '8002 le n° de suivi ouvre la page du transporteur', JSON.stringify([r.suivi, r.lien]));
        dit(r.deb <= 1 && !r.hors.length, '8002 aucun débordement horizontal', `${r.deb}px ${r.hors.join(' | ')}`);
        if (tel) dit(!r.petites.length, '8002 au téléphone : le lien du n° fait 44 px', r.petites.join(','));
        const o = await oranges(pg, '[data-envoi-parcours]');
        dit(!o.length, '8002 aucun orange dans la piste (couleurs calculées)', o.join(' | '));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `envoi-8002-${nf}.png`) });
      });
      await essaie('8005 Chrono Relais Europe', async () => {
        const r = await lirePiste(pg, await ouvrirVente(pg, '8005', 'retire'));
        dit(et(r, 'retire').etat === 'fait' && et(r, 'retire').source === 'vinted' && et(r, 'retire').t === '' && et(r, 'aupoint').etat === 'passu', '8005 jamais lu chez le transporteur : « Retiré » d’après Vinted, sans date inventée ; « Au point » pas su', JSON.stringify(r.etapes));
      });
      await essaie('8003 Chronopost retiré', async () => {
        const r = await lirePiste(pg, await ouvrirVente(pg, '8003', 'retire'));
        dit(r.groupe === 'retire' && et(r, 'aupoint').etat === 'fait' && et(r, 'retire').etat === 'fait' && et(r, 'retire').source === 'transporteur' && et(r, 'argent').etat === 'passu', '8003 Chronopost : au point puis retiré (dates lues), argent en attente', JSON.stringify(r.etapes));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `envoi-8003-${nf}.png`) });
      });
      await essaie('8004 finalisée', async () => {
        const r = await lirePiste(pg, await ouvrirVente(pg, '8004', 'argent'));
        dit(r.groupe === 'argent' && et(r, 'argent').etat === 'fait', '8004 commande finalisée (450) ⇒ argent versé', JSON.stringify(et(r, 'argent')));
      });
      await essaie('Mes envois', async () => {
        await choisirGroupe(pg, 'tous');
        const L = await pg.evaluate(() => { const s = document.querySelector('[data-mes-envois]'); const g = {}; for (const t of s.querySelectorAll('[data-mes-envois-groupe]')) g[t.getAttribute('data-mes-envois-groupe')] = Number(t.getAttribute('data-mes-envois-n'));
          const petites = [...s.querySelectorAll('button')].map((e) => e.getBoundingClientRect().height).filter((h) => h < 43.5);
          return { n: s.getAttribute('data-mes-envois'), couv: s.getAttribute('data-mes-envois-couverture') || (s.querySelector('[data-mes-envois-couverture]') || {}).getAttribute?.('data-mes-envois-couverture'), g, petites, deb: document.documentElement.scrollWidth - window.innerWidth }; });
        dit(L.g.enroute === 1 && L.g.aupoint === 1 && L.g.retire === 2 && L.g.argent === 1, 'Mes envois : 1 en route · 1 au point · 2 retirés · 1 argent versé', JSON.stringify(L.g));
        dit(L.n === '5' && L.couv === '3/5', 'Mes envois : la couverture « 3 sur 5 lus chez le transporteur »', JSON.stringify([L.n, L.couv]));
        if (tel) dit(!L.petites.length, 'Mes envois : tuiles de 44 px au moins', L.petites.join(','));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `mes-envois-${nf}.png`) });
        await choisirGroupe(pg, 'aupoint');
        const G = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-route]')].map((e) => ({ cle: e.getAttribute('data-vn-route'), h: e.getBoundingClientRect().height })).filter((x) => x.h > 0));
        dit(G.length === 1 && G[0].cle === 'v:8002', 'la tuile « au point » : la liste d’« En route » devient CE groupe (une seule liste)', JSON.stringify(G));
        const o = await oranges(pg, '[data-mes-envois]');
        dit(!o.length, 'Mes envois : aucun orange (couleurs calculées)', o.join(' | '));
        dit(L.deb <= 1, 'Mes envois : aucun débordement horizontal', `${L.deb}px`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `mes-envois-aupoint-${nf}.png`) });
        await choisirGroupe(pg, 'tous');
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
