// Banc : LOTS BE et BG (10 nov.) — LA FRISE D'UNE VENTE et D'OÙ VIENNENT MES ACHATS.
// Données INVENTÉES (le dépôt est public). 390 px tactile et 1512 px, clair et sombre.
// Il juge la RÈGLE (data-* et nombres rendus, styles calculés), pas l'orthographe :
//   BE (Ventes → toucher une vente → le récapitulatif) :
//     · 8001 payée, sans bordereau      ⇒ Vendue cochée ; « Bordereau » AMBRE (le geste), seule ;
//     · 8002 bordereau (n° XA…) + le transporteur de CE n° lu (pris en charge, livré)
//                                       ⇒ Vendue, Bordereau, Déposée, En route, Livrée, datées ;
//                                         « En route » porte le logo de SON transporteur ;
//     · 8004 finalisée, versée          ⇒ Vendue, Finalisée, Versée ; le reste « pas lu », gris ;
//     · 8005 / 8006 au MÊME titre, bordereaux au MÊME n° (ambigu) + transporteur « livré »
//                                       ⇒ ni En route ni Livrée (rien de lu d'un n° ambigu) ;
//     · 8003 « Retour initié »          ⇒ bifurcation « Retour » après la dernière étape prouvée ;
//     · verticale au téléphone, horizontale sur ordinateur ; rien ne déborde ; jamais de rouge ;
//   BG (Statistiques) : la carte « D'où viennent mes achats », publiée par Ventes :
//     · Vinted (achat relié par sa transaction) : 59 € en moyenne · sur 1 vente · prix d'achat
//       manquant pour 1 ; Magasin (achat hors plateforme relié par SON N°, source saisie) : 40 € ;
//     · une vente sans achat relié : comptée à part, jamais une barre ;
//     · la meilleure source à l'accent, les autres neutres ; aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=96xx node scripts/bancs/frise-source.cjs
// Captures : SHOTS=<dossier> ; BANC_DIST=<un autre dist/> pour juger une autre version.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4398);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 60000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES = [
  vente(8001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Nike Dunk Low Retro Panda 42', 79, 'Le paiement a été validé', il(6, 10), 'waiting'),
  vente(8003, 'Adidas Samba OG noir 40', 72, 'Retour initié', il(7, 10), 'waiting'),
  vente(8004, 'Asics Gel-Kayano 14 argent 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(8005, 'New Balance 550 blanc vert 43', 70, 'Le paiement a été validé', il(5), 'waiting'),
  vente(8006, 'New Balance 550 blanc vert 43', 70, 'Le paiement a été validé', il(5, 14), 'waiting'),
  vente(8007, 'Nike Air Force 1 blanche 41', 60, 'Commande finalisée', il(8), 'completed'),
  vente(8008, 'Puma Suede noir 42', 45, 'Commande finalisée', il(8, 15), 'completed'),
  vente(8009, 'Vans Old Skool 40', 50, 'Commande finalisée', il(8, 16), 'completed'),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'vendeur_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const N1 = 'XA123456789FR', N3 = 'XC555555555FR';
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: 'email_bord_8002', data: { transaction: '8002', uid: A, filename: 'b2.pdf', suivi: N1, receivedAt: il(6, 12).toISOString(), pdfB64: PDF_B64 } },
  { id: 'email_bord_8005', data: { transaction: '8005', uid: A, filename: 'b5.pdf', suivi: N3, receivedAt: il(5, 13).toISOString(), pdfB64: PDF_B64 } },
  { id: 'email_bord_8006', data: { transaction: '8006', uid: A, filename: 'b6.pdf', suivi: N3, receivedAt: il(5, 15).toISOString(), pdfB64: PDF_B64 } },
  // Le transporteur, pour le n° EXACT du bordereau (lignes `depart_`, écrites par le serveur).
  { id: `depart_chronopost_${N1}`, data: { suivi: N1, carrier: 'chronopost', etat: 'livre', etatAt: il(3, 9).toISOString(), priseAt: il(5, 18).toISOString(), lu: cap } },
  { id: `depart_chronopost_${N3}`, data: { suivi: N3, carrier: 'chronopost', etat: 'livre', etatAt: il(2, 9).toISOString(), priseAt: il(4, 18).toISOString(), lu: cap } },
  { id: `harvest_${A}_txn_8004`, data: { capturedAt: cap, payload: { transaction: { id: 8004, item_id: 9904, status: 450, status_title: 'Commande finalisée', status_updated_at: il(6, 9).toISOString() } } } },
  { id: `harvest_${A}_txn_8003`, data: { capturedAt: cap, payload: { transaction: { id: 8003, item_id: 9903, status: 440, status_title: 'Retour initié', status_updated_at: il(4, 9).toISOString() } } } },
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    // 8004 : relié à SON achat Vinted (transaction), prix saisi, frais confirmés ⇒ 89 − 30 = 59 € ;
    // 8009 : relié à un achat Vinted, prix d'achat pas saisi ⇒ bénéfice inconnu ;
    // 8007 : le N° H1, écrit sur un achat hors plateforme « Magasin » ⇒ 60 − 20 = 40 €.
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({
      '8004': { buyFromId: '5551234567', buyPrice: '30', fraisComplets: true },
      '8009': { buyFromId: '5559999999' },
      '8007': { numero: 'H1', buyPrice: '20', fraisComplets: true },
    }));
    localStorage.setItem('vinted_offvinted_buys', JSON.stringify([{ id: 'ob_banc1', title: 'Air Force 1', price: '20', date: '2026-10-20', source: 'Magasin', numero: 'H1' }]));
  } catch (_) {} }, !!sombre);
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
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
};
const allerVentes = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1500);
};
// Ouvre le tiroir d'une vente (par sa TRANSACTION), la feuille ouverte refermée d'abord (sa croix).
const ouvrirVente = async (pg, tx) => {
  const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
  if (await croix.count()) { await croix.first().click(); await pg.waitForTimeout(300); }
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"] [data-frise-prouvee]`).waitFor({ state: 'visible', timeout: 10000 });
  await pg.waitForTimeout(500);
  return id;
};
const ROUGE = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(Number); return r > 180 && g < 80 && b < 80; };
const lireFrise = (pg, id) => pg.evaluate(({ id }) => {
  const d = document.getElementById(id); const f = d && d.querySelector('[data-frise-prouvee]'); if (!f) return null;
  const vw = window.innerWidth;
  const etapes = [...f.querySelectorAll('[data-frv-etape]')].map((li) => { const r = li.getBoundingClientRect(); const nom = li.querySelector('.vrm-frv-nom'); return { cle: li.getAttribute('data-frv-etape'), etat: li.getAttribute('data-frv-etat'), t: li.getAttribute('data-frv-t'), sous: (li.querySelector('.vrm-frv-sous') || {}).textContent || '', top: Math.round(r.top), left: Math.round(r.left), right: r.right, couleur: getComputedStyle(nom).color, logo: !!li.querySelector('[data-frv-transporteur]'), apresBif: li.hasAttribute('data-frv-apres-bif') }; });
  const bif = f.querySelector('[data-frv-bifurcation]');
  const tout = [...f.querySelectorAll('*')].map((e) => getComputedStyle(e).color).concat([...f.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundColor));
  return { etapes, bif: bif ? { genre: bif.getAttribute('data-frv-bifurcation'), ton: bif.getAttribute('data-frv-ton'), txt: bif.innerText.replace(/\s+/g, ' ').trim() } : null, couleurs: tout,
    deb: Math.max(document.documentElement.scrollWidth - vw, 0), hors: [...f.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > Math.min(vw, d.getBoundingClientRect().right) + 1; }).length,
    warn: getComputedStyle(document.documentElement).getPropertyValue('--vrm-warn').trim() };
}, { id });
const faits = (f) => f.etapes.filter((e) => e.etat === 'fait').map((e) => e.cle).join(',');
const E = (f, c) => f.etapes.find((e) => e.cle === c) || {};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600;
      await essaie('Ventes', () => allerVentes(pg));
      await essaie('8001', async () => {
        const id = await ouvrirVente(pg, '8001'); const f = await lireFrise(pg, id);
        dit(faits(f) === 'vendue' && E(f, 'bordereau').etat === 'geste' && f.etapes.filter((e) => e.etat === 'geste').length === 1, 'BE1 payée sans bordereau : Vendue ; « Bordereau » est LE geste attendu', f.etapes.map((e) => e.cle + ':' + e.etat).join(' '));
        dit(!ROUGE(E(f, 'bordereau').couleur) && E(f, 'bordereau').couleur !== E(f, 'deposee').couleur, 'BE2 le geste est ambre (ni rouge, ni la couleur d’une étape pas lue)', E(f, 'bordereau').couleur);
        const tops = new Set(f.etapes.map((e) => e.top));
        dit(tel ? tops.size === f.etapes.length : tops.size === 1, tel ? 'BE3 au téléphone : verticale (une étape par ligne)' : 'BE3 sur ordinateur : horizontale (une ligne)', [...tops].join(','));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `frise-8001-${nom}.png`) });
      });
      await essaie('8002', async () => {
        const id = await ouvrirVente(pg, '8002'); const f = await lireFrise(pg, id);
        dit(faits(f) === 'vendue,bordereau,deposee,enroute,livree', 'BE4 le transporteur du n° de SON bordereau : Déposée, En route, Livrée prouvées', faits(f));
        dit(Number(E(f, 'livree').t) === new Date(il(3, 9)).getTime() && /nov/.test(E(f, 'livree').sous) && /nov/.test(E(f, 'enroute').sous), 'BE5 chaque étape prouvée porte SA date lue (livré le 7 nov.)', `${E(f, 'livree').t} ${E(f, 'livree').sous}`);
        dit(E(f, 'enroute').logo, 'BE6 « En route » porte le logo de son transporteur');
        dit(E(f, 'finalisee').etat === 'paslu' && /pas lu/.test(E(f, 'finalisee').sous), 'BE7 « Finalisée » pas lue : grise, « pas lu »');
        dit(!f.couleurs.some(ROUGE), 'BE8 aucune couleur rouge dans la frise');
        dit(f.deb <= 1 && f.hors === 0, 'BE9 rien ne déborde', `${f.deb}px · ${f.hors}`);
        if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, `frise-8002-${nom}.png`) }); }
      });
      await essaie('8004', async () => {
        const id = await ouvrirVente(pg, '8004'); const f = await lireFrise(pg, id);
        dit(faits(f) === 'vendue,finalisee,versee', 'BE10 finalisée, versée : Vendue, Finalisée, Versée — le reste n’est pas déduit', faits(f));
        dit(['bordereau', 'deposee', 'enroute', 'livree'].every((c) => E(f, c).etat === 'paslu'), 'BE11 Bordereau, Déposée, En route, Livrée : « pas lu »');
      });
      await essaie('8005', async () => {
        const id = await ouvrirVente(pg, '8005'); const f = await lireFrise(pg, id);
        const id2 = await ouvrirVente(pg, '8006'); const f2 = await lireFrise(pg, id2);
        dit(E(f, 'livree').etat !== 'fait' && E(f, 'enroute').etat !== 'fait' && E(f2, 'livree').etat !== 'fait' && E(f2, 'enroute').etat !== 'fait', 'BE12 deux ventes au même titre ET au même n° : rien n’est lu du transporteur', `${faits(f)} | ${faits(f2)}`);
      });
      await essaie('8003', async () => {
        const id = await ouvrirVente(pg, '8003'); const f = await lireFrise(pg, id);
        dit(f.bif && f.bif.genre === 'retour' && f.etapes.filter((e) => e.apresBif).length > 0 && !f.etapes.some((e) => e.etat === 'geste'), 'BE13 un retour : bifurcation après la dernière étape prouvée, les suivantes pâlissent', JSON.stringify(f.bif));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `frise-8003-${nom}.png`) });
      });
      // BG : Ventes a publié ; Statistiques LIT.
      await essaie('Statistiques', async () => {
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_sources_ventes') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 });
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        const carte = pg.locator('[data-stats-carte="sources-achats"]');
        await carte.waitFor({ timeout: 30000 });
        await carte.scrollIntoViewIfNeeded(); await pg.waitForTimeout(800);
        const r = await carte.evaluate((c) => ({
          lignes: [...c.querySelectorAll('[data-sa-source]')].map((l) => ({ k: l.getAttribute('data-sa-source'), moy: l.getAttribute('data-sa-moyenne'), n: l.getAttribute('data-sa-n'), connu: l.getAttribute('data-sa-connu'), txt: l.innerText.replace(/\s+/g, ' '), plus: !!l.querySelector('[data-plus]') })),
          sansAchat: c.querySelector('[data-sa-sans-achat]') ? c.querySelector('[data-sa-sans-achat]').getAttribute('data-sa-sans-achat') : null,
          txt: c.innerText, deb: c.scrollWidth - c.clientWidth,
          rouge: [...c.querySelectorAll('*')].some((e) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(e).color + getComputedStyle(e).backgroundColor); return m && +m[1] > 180 && +m[2] < 80 && +m[3] < 80; }),
        }));
        const v = r.lignes.find((l) => l.k === 'vinted'), m = r.lignes.find((l) => l.k === 'magasin');
        dit(v && v.moy === '5900' && v.n === '2' && v.connu === '1' && /59\s?€ en moyenne/.test(v.txt) && /sur 1 vente · prix d’achat manquant pour 1/.test(v.txt), 'BG1 Vinted (achat relié par sa transaction) : 59 € en moyenne · sur 1 vente · le manque nommé', JSON.stringify(v));
        dit(m && m.moy === '4000' && m.connu === '1', 'BG2 Magasin : la source SAISIE sur l’achat hors plateforme relié par SON N°', JSON.stringify(m));
        dit(r.lignes.length === 2 && r.sansAchat === '1', 'BG3 la vente sans achat relié : comptée à part, jamais une barre', JSON.stringify(r.lignes.map((l) => l.k)) + ' · ' + r.sansAchat);
        dit(r.lignes[0].k === 'vinted' && r.lignes[0].plus && !r.lignes[1].plus, 'BG4 la meilleure moyenne d’abord, seule à l’accent');
        dit(!/au moins/.test(r.txt) && !r.rouge && r.deb <= 1, 'BG5 jamais « au moins » sur un bénéfice, jamais de rouge, rien ne déborde');
        if (SHOTS) await carte.screenshot({ path: path.join(SHOTS, `sources-${nom}.png`) });
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
