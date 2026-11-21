// Banc : « JE N'AI PLUS LES RETRAITS D'ACHAT » (Julien, 14 nov. au soir). Mesuré sur sa base (lecture seule,
// rien de réel ici) : la règle des retraits comptait 3 colis à retirer, chacun avec son code — 2 Mondial Relay
// « disponible » du matin (pas encore de lecture transporteur) et 1 Vinted Go (code lu dans la conversation) —,
// 5 colis « à vérifier » (e-mails Vinted sans code), 47 Mondial Relay de la semaine déjà retirés chez le
// transporteur. La publication `vrm_colis_retirer` disait 3 ; Achats · Vinted, depuis la refonte du 14 nov.,
// rangeait la section « À retirer » dans un repli FERMÉ par défaut, sans ligne pour l'ouvrir : seul un « 3 · À
// retirer » dans la bande. Sa forme, en données INVENTÉES (dépôt public), au volume de son compte (1 000 achats).
// Exige (data-* et boîtes rendues, §6.4) :
//  R1 appareil neuf : Achats ouvre « À retirer » EN TÊTE, ouvert, chaque code des 3 colis VISIBLE, sur le 1er écran ;
//  R2 l'ancien choix « fermé » ('0', d'avant ce correctif) ne cache pas un colis à retirer ;
//  R3 il referme : fermé, et rechargé avec les MÊMES colis, il reste fermé (son choix) ;
//  R4 un colis de plus arrive : rouvert tout seul ;
//  R5 rien à retirer mais des colis à vérifier : fermé (la liste d'abord), la ligne VISIBLE avec « + N à vérifier » ;
//  R6 Ma journée dit « À retirer » avec le même nombre que la publication ;
//  + rien ne déborde, aucune erreur. 390 tactile clair + sombre, 1512 clair.
// Lancer : npm run build ; BANC_PORT=8833 node scripts/bancs/achats-retirer-visible.cjs   (SHOTS=dossier pour les captures)
// Preuves : rouge sur le build d'origin/main (c084e3bf) ; la règle pure et ses mutations : scripts/audit-repli-retirer.cjs --prouve.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 8833);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 14, 20, 30, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jour = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b_avec_un_nom_long', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const cap = ilYa(0.02);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const FIN = "Transaction finalisée - L'acheteur a validé la commande";
const conv = (id) => `0000aaaa-0000-4000-8000-${String(id).padStart(12, '0')}`;
const achat = (id, titre, statut, tus, j, k) => ({ transaction_id: id, conversation_id: conv(id), title: titre, price: { amount: '39.00', currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: ilYa(j), photo: k ? { url: url(k) } : null });
const LIEU = 'TABAC DU PORT, 2 RUE DES QUAIS, 35000 VILLEA';
const mr = (n, j, extra = {}) => ({ id: `email_track_mondialrelay_${n}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: String(n), status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${n} est disponible`, receivedAt: ilYa(j), emailAt: ilYa(j), arriveLe: ilYa(j), code: 'C' + String(n).slice(-5), lieu: LIEU, limite: jour(5 - j), consigne: false, account: 'compte_a', ...extra } });
const tr = (n, etat, j) => ({ id: `transp_mondialrelay_${n}`, data: { v: 1, suivi: String(n), carrier: 'mondialrelay', etat, fini: etat === 'retire', libelle: etat === 'retire' ? 'Colis livré au destinataire' : '5 jours restants pour retirer', etatAt: ilYa(j), lu: ilYa(0.05), source: 'serveur', evenements: [] } });
const vt = (id, titre, j) => ({ id: `email_track_autre_conv-${conv(id)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${titre}`, receivedAt: ilYa(j), emailAt: ilYa(j), arriveLe: ilYa(j), code: null, lieu: LIEU, limite: null, consigne: false, conv: conv(id), source: 'vinted-commande', forme: 'attend', cleLigne: `email_track_autre_conv-${conv(id)}`, artTitle: titre, account: 'compte_a' } });
// Les jeux : « base » = 3 à retirer (2 Mondial Relay + 1 Vinted Go au code lu dans sa conversation) ; « plus » = un 4e
// Mondial Relay arrive ; « vide » = plus rien à retirer (les 3 retirés), il reste les 5 « à vérifier ».
let JEU = 'base';
const lignes = () => {
  const sansCode = Array.from({ length: 5 }, (_, i) => achat(7100 + i, `Baskets sans code ${i + 1}`, DEPOSE, 'needs_action', 2 + i / 2, 30 + i));
  const vg = achat(7001, 'Sneakers Vinted Go 42', DEPOSE, 'needs_action', 4, 3);
  const vieux = Array.from({ length: 1000 }, (_, i) => achat(600000 + i, `Achat fini ${i + 1}`, FIN, 'completed', 8 + i / 5, (i % 7) + 40));
  const retires = Array.from({ length: 12 }, (_, i) => [mr(83000000 + i, 1 + i / 3, { code: 'R' + String(70000 + i) }), tr(83000000 + i, 'retire', 0.5 + i / 4)]).flat();
  const aRetirer = JEU === 'vide' ? [] : [mr(81000001, 0.47), mr(81000002, 0.46), ...(JEU === 'plus' ? [mr(81000003, 0.1)] : [])];
  const relais = JEU === 'vide' ? {} : { 7001: { tx: '7001', code: 'V12345', lieu: 'Consigne Vinted Go, Rue Haute, 56000 Villeb', conv: conv(7001), titre: 'Sneakers Vinted Go 42', at: ilYa(1), arriveLe: ilYa(1), transporteur: 'Vinted Go', qr: '', url: '', item: '', photo: '' } };
  return [
    { id: 'main', data: { vrm_ville: 'Villea' } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, nItems: 1006, payload: { my_orders: [...(JEU === 'vide' ? [] : [vg]), ...sansCode, ...vieux] } } },
    { id: 'harvest_222_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'panel_colis_relais', data: relais },
    ...aRetirer, ...retires, ...sansCode.map((o) => vt(o.transaction_id, o.title, 2)),
  ];
};
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, query, choix = null) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  // Un choix retenu sur l'appareil (`vrm_achats_retirer_ouvert`), posé une fois par onglet (un rechargement garde ce que l'app a écrit).
  if (choix != null) await pg.addInitScript((c) => { try { if (!sessionStorage.getItem('banc_choix_pose')) { localStorage.setItem('vrm_achats_retirer_ouvert', c); sessionStorage.setItem('banc_choix_pose', '1'); } } catch (_) {} }, choix);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc'][m[1] % 4]}"/></svg>` });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(lignes().filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes().filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(lignes().filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?${query}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const deborde = (pg) => pg.evaluate(() => ({ deb: document.documentElement.scrollWidth - window.innerWidth }));
// Ce que montre Achats : l'état du repli, la ligne, les codes VISIBLES (une boîte rendue, hors `hidden`), et leur place.
const mesure = (pg) => pg.evaluate(() => {
  const pub = (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } })();
  const repli = document.querySelector('[data-retirer-repli]');
  const ligne = repli && repli.querySelector('.vrm-achats-retirer-ligne');
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); };
  const corps = document.querySelector('#vrm-achats-retirer-corps');
  const texteCorps = corps && vis(corps) ? corps.innerText.replace(/\s+/g, '') : '';
  const codes = ['C00001', 'C00002', 'C00003', 'V12345'].filter((c) => texteCorps.includes(c));
  const sec = document.querySelector('[data-colis-section="achats"]');
  const liste = document.querySelector('[data-achat-tx]');
  return {
    pub: pub && { total: pub.total, aVerifier: pub.aVerifier, enVerification: pub.enVerification, colis: (pub.colis || []).map((c) => c[3]), verif: (pub.verif || []).map((c) => c[3]) },
    etat: repli ? repli.getAttribute('data-retirer-repli') : null,
    ligneVisible: vis(ligne), ligneTexte: ligne && vis(ligne) ? ligne.innerText.replace(/\s+/g, ' ').trim() : '',
    codes, haut: sec && vis(sec) ? Math.round(sec.getBoundingClientRect().top + window.scrollY) : null,
    avantListe: !!(sec && liste && (sec.compareDocumentPosition(liste) & Node.DOCUMENT_POSITION_FOLLOWING)),
  };
});
const attendre = async (pg) => {
  await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return !!(p && Number.isFinite(p.total)); } catch (_) { return false; } }, null, { timeout: 40000 }).catch(() => {});
  await pg.locator('[data-retirer-repli]').first().waitFor({ state: 'attached', timeout: 30000 });
  await pg.waitForTimeout(2500);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  let choixRetenu = null;
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      console.log(`\n— Achats · ${nom}`);
      JEU = 'base';
      // R1 — appareil neuf (aucun choix retenu).
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=achats');
        await essaie('R1', async () => {
          await attendre(pg);
          const m = await mesure(pg);
          dit(m.pub && m.pub.total === 3, 'la règle compte 3 colis à retirer (publication)', JSON.stringify(m.pub));
          dit(m.etat === 'ouvert', 'R1 appareil neuf : « À retirer » est OUVERT dès qu’un colis est à retirer', String(m.etat));
          dit(m.codes.length === 3 && m.codes.includes('V12345'), 'R1 les 3 codes (2 Mondial Relay + Vinted Go) sont VISIBLES sur Achats', m.codes.join(',') || '(aucun)');
          dit(m.avantListe && m.haut != null && m.haut < vp.height, 'R1 « À retirer » est en tête, sur le premier écran, avant la liste des achats', `haut ${m.haut} px`);
          const d = await deborde(pg); dit(d.deb <= 1, 'rien ne déborde', `${d.deb}px`);
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `r1-${nom}.png`) });
          // R3 — il referme : fermé ; rechargé avec les mêmes colis, il reste fermé.
          const lg = pg.locator('.vrm-achats-retirer-ligne').first();
          if (await lg.isVisible()) { await lg.click(); await pg.waitForTimeout(600); }
          const f = await mesure(pg);
          dit(f.etat === 'ferme', 'R3 il peut refermer (la ligne « À retirer » est là pour ça)', String(f.etat));
          await pg.reload({ waitUntil: 'domcontentloaded' }); await attendre(pg);
          const g = await mesure(pg);
          dit(g.etat === 'ferme', 'R3 rechargé avec les MÊMES colis : il reste fermé (son choix)', String(g.etat));
          choixRetenu = await pg.evaluate(() => { try { return localStorage.getItem('vrm_achats_retirer_ouvert'); } catch (_) { return null; } });
        });
        dit(!errs.length, 'aucune erreur d’app', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // R4 — le lendemain (un nouvel onglet, le choix « fermé » retenu sur l'appareil), un 4e colis est arrivé : rouvert.
      JEU = 'plus';
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=achats', choixRetenu == null ? '' : choixRetenu);
        await essaie('R4', async () => {
          await attendre(pg);
          const h = await mesure(pg);
          dit(h.pub && h.pub.total === 4 && h.etat === 'ouvert' && h.codes.includes('C00003'), 'R4 un colis de plus arrive : rouvert tout seul, son code visible', JSON.stringify({ choix: choixRetenu, n: h.pub && h.pub.total, etat: h.etat, codes: h.codes }));
        });
        dit(!errs.length, 'aucune erreur d’app (R4)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      JEU = 'base';
      // R2 — l'ancien choix « fermé » ('0') ne cache pas un colis à retirer.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=achats', '0');
        await essaie('R2', async () => {
          await attendre(pg);
          const m = await mesure(pg);
          dit(m.etat === 'ouvert' && m.codes.length === 3, 'R2 l’ancien « fermé » (d’avant) ne cache pas les 3 colis à retirer', JSON.stringify({ etat: m.etat, codes: m.codes }));
        });
        dit(!errs.length, 'aucune erreur d’app (R2)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // R5 — rien à retirer, des colis à vérifier : fermé, la ligne visible avec « à vérifier ».
      JEU = 'vide';
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=achats');
        await essaie('R5', async () => {
          await attendre(pg);
          const m = await mesure(pg);
          const nv = m.pub ? (Number(m.pub.aVerifier) || 0) + (Number(m.pub.enVerification) || 0) : -1;
          dit(m.pub && m.pub.total === 0 && nv > 0, 'jeu « vide » : 0 à retirer, des colis à vérifier', JSON.stringify(m.pub));
          dit(m.etat === 'ferme', 'R5 rien à retirer : fermé (la liste des achats d’abord)', String(m.etat));
          dit(m.ligneVisible && new RegExp(`(^|\\D)${nv}(\\D|$)`).test(m.ligneTexte), 'R5 la ligne reste visible et nomme les colis à vérifier (jamais cachés)', m.ligneTexte || '(ligne cachée)');
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `r5-${nom}.png`) });
        });
        dit(!errs.length, 'aucune erreur d’app (R5)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      JEU = 'base';
      // R6 — Ma journée dit « À retirer » avec le même nombre.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=journee');
        await essaie('R6', async () => {
          await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return !!(p && Number.isFinite(p.total)); } catch (_) { return false; } }, null, { timeout: 40000 }).catch(() => {});
          await pg.waitForTimeout(3000);
          const m = await pg.evaluate(() => {
            const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); };
            const n = [...document.querySelectorAll('[data-tuile="retirer"]')].filter(vis).map((e) => e.getAttribute('data-n'));
            const txt = (document.querySelector('.vrm-main') || document.body).innerText;
            return { n, lignes: (txt.match(/[^\n]*retirer[^\n]*/gi) || []).slice(0, 4) };
          });
          dit(m.n.includes('3'), 'R6 Ma journée dit « À retirer » · 3 (la même publication)', JSON.stringify(m));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `r6-journee-${nom}.png`) });
        });
        dit(!errs.length, 'aucune erreur d’app (Ma journée)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  if (ko) process.exitCode = 1;
})();
