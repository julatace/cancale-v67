// ════════════════════════════════════════════════════════════════════════════
//  Banc : ACHATS → « À RETIRER » — UN COLIS À DEUX N° DE SUIVI, UNE LIGNE (17 nov.).
//  Julien (17 nov., captures) : au point relais, UN colis arrivé, DEUX lignes — « Colis Chronopost Pickup »
//  (code, n° Chronopost, non relié) et l'achat Vinted « Code sur Vinted · Incident ». Un envoi international
//  à deux transporteurs (Shop2Shop puis Chronopost) a deux n° pour le MÊME colis ; la ligne de suivi Vinted
//  ne gardait que le premier. Scène INVENTÉE de la même forme (dépôt public) :
//    1. AVEC la liste des n° (extension 5.403 : `suivisVinted`, `suivisLusAt`) ⇒ UNE ligne, au nom de
//       l'article, avec le code du colis Chronopost (et son QR) ; aucune ligne « Code sur Vinted » ;
//    2. SANS la liste (ligne d'avant) ⇒ DEUX lignes, et — (19 nov., décision de Julien : « je ne dois pas relier
//       l'achat au colis qui est au point relais, ça doit être automatique […] on ne doit pas avoir le bouton relier
//       un achat ») — PLUS de « C'est sans doute le même colis — Relier » : le colis Chronopost dit « Contenu pas
//       encore lu · ouvre vinted.fr sur compte_a », rien à toucher, aucune écriture ; dès que la liste est lue
//       (scène 1), l'identité relie seule ;
//    3. sans la liste, DEUX achats au même point ⇒ aucune proposition non plus ;
//    4. (retirée le 19 nov. avec la proposition : plus de « Ce n'est pas le même ») ;
//    5. liste LUE qui contredit un lien posé à la main ⇒ « Ce lien ne correspond pas au suivi Vinted — délier ? »,
//       « Délier » retire le lien.
//  Scènes 1 et 2 en 390 tactile et 1512, clair et sombre ; 3 à 5 en 390 clair. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
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
const PORT = Number(process.env.BANC_PORT || 4471);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 17, 10, 19, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const AU_RELAIS = 'Colis déposé en point relais';
const LIEU = 'Tabac du Banc, 4 place des Essais, 56000 Banc-Ville';
const N1 = 'SS10000001ES', N2 = 'XW200000002FR', CODE = '737373';
const TX = 9401, TX2 = 9402;
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: AU_RELAIS, transaction_user_status: 'needs_action', date: ilYa(6), photo: { url: url(k) } });
const ligneSuivi = (tx, extra = {}) => ({ id: `harvest_111_suivi_${tx}`, data: Object.assign({ v: 1, tx: String(tx), source: 'passif', capturedAt: ilYa(0.5), etapes: [{ t: 'Disponible pour retrait', at: ilYa(0.5), code: null }], dernier: { t: 'Disponible pour retrait', at: ilYa(0.5), code: null }, n: 1, transporteur: 'SHOP2SHOP', suivi: N1, relaisNom: 'Tabac du Banc', relaisRue: '4 place des Essais', relaisCp: '56000', relaisVille: 'Banc-Ville' }, extra) });
const chrono = { id: `email_track_chronopost_${N2}`, data: { type: 'suivi', carrier: 'chronopost', suivi: N2, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${N2} est disponible`, receivedAt: ilYa(0.6), emailAt: ilYa(0.6), arriveLe: ilYa(0.6), code: CODE, lieu: LIEU, limite: jourDans(6), consigne: false, account: 'compte_a', qrB64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', qrType: 'image/png' } };
const SCENES = {
  avecListe: () => [ligneSuivi(TX, { suivisVinted: `${N1},${N2}`, transporteursVinted: 'SHOP2SHOP,CHRONOPOST', suiviCourant: N2, suivisLusAt: ilYa(0.4) })],
  sansListe: () => [ligneSuivi(TX)],
  deuxAchats: () => [ligneSuivi(TX), ligneSuivi(TX2, { suivi: 'SS10000009ES' })],
  contredit: () => [ligneSuivi(TX, { suivisVinted: N1, suivisLusAt: ilYa(0.4) }), { id: `colis_suivi_chronopost_${N2}`, data: { suivi: N2, transporteur: 'chronopost', tx: String(TX), uid: '111', relieDepuis: 'retrait', at: ilYa(0.3) } }],
};
const lignesDe = (scene) => {
  const achats = [achat(TX, 'Baskets montantes grises 42', 3)];
  if (scene === 'deuxAchats') achats.push(achat(TX2, 'Sac banc écru', 5));
  return [
    { id: 'main', data: { vrm_ville: 'Banc-Ville' } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: achats } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'panel_colis_relais', data: {} },
    chrono,
    ...SCENES[scene](),
  ];
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || d == null ? '' : ' — ' + d)); };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e2dfe8"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre, scene) => {
  const LIGNES = lignesDe(scene);
  const ecrits = [], effaces = [];
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const H = { 'access-control-allow-origin': '*' };
    // Les écritures : une base À ÉTAT (ce qui est écrit se relit, ce qui est effacé disparaît).
    if (req.method() === 'POST' && /\/app_data/.test(u)) {
      let corps = []; try { corps = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const r of (Array.isArray(corps) ? corps : [corps])) if (r && r.id) { ecrits.push(r.id); const i = LIGNES.findIndex((x) => x.id === r.id); if (i >= 0) LIGNES[i] = { id: r.id, data: r.data }; else LIGNES.push({ id: r.id, data: r.data }); }
      return route.fulfill({ status: 201, contentType: 'application/json', headers: H, body: '[]' });
    }
    if (req.method() === 'DELETE') { const eq = /[?&]id=eq\.([^&]*)/.exec(u); if (eq) { effaces.push(eq[1]); const i = LIGNES.findIndex((x) => x.id === eq[1]); if (i >= 0) LIGNES.splice(i, 1); } return route.fulfill({ status: 204, headers: H, body: '' }); }
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: H, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...H, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: H, body: '{"m":1}' });
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
  await pg.locator('[data-colis-section]').first().waitFor({ timeout: 40000 });
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
  await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
  await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]').length >= 1, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(900);
  return { ctx, pg, errs, ecrits, effaces };
};
// Ce que l'écran montre : les lignes visibles (titre, code, « Code sur Vinted »), la proposition, le lien contredit.
const lire = (pg) => pg.evaluate(() => {
  const vis = (e) => !!e && e.getBoundingClientRect().height > 0;
  const lignes = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].filter(vis).map((l) => ({
    cle: l.getAttribute('data-cc-carte'), titre: ((l.querySelector('.vrm-rpf-titre') || {}).innerText || '').trim(),
    code: !!l.querySelector('[data-code-retrait="737373"]') || /737373/.test(l.innerText), surVinted: /Code sur Vinted/.test(l.innerText),
    qr: !!l.querySelector('[data-rp-qr-ligne]'), aVerifier: l.getAttribute('data-a-verifier') === '1',
  }));
  const prop = [...document.querySelectorAll('[data-rp-meme-colis]')].filter(vis);
  const contr = [...document.querySelectorAll('[data-rp-lien-contredit]')].filter(vis);
  const R = (e) => e ? e.getBoundingClientRect() : null;
  const b = prop[0] && prop[0].querySelector('[data-rp-meme-relier]');
  const cont = [...document.querySelectorAll('[data-rp-contenu]')].filter(vis).map((c) => ({ etat: c.getAttribute('data-rp-contenu'), raison: c.getAttribute('data-rp-contenu-raison'), compte: c.getAttribute('data-rp-contenu-compte'), txt: c.textContent.replace(/\s+/g, ' ').trim(), toucher: c.querySelectorAll('button, a').length }));
  const relier = [...document.querySelectorAll('[data-rp-meme-relier], [data-rp-pas-meme], [data-rp-relier-ouvrir], [data-rp-relier]')].filter(vis).length;
  return { cont, relier, lignes, prop: prop.map((p) => ({ txt: p.innerText.replace(/\s+/g, ' ').trim(), achat: p.getAttribute('data-rp-meme-achat'), h: b ? Math.round(R(b).height) : 0 })), contredit: contr.map((c) => c.innerText.replace(/\s+/g, ' ').trim()) };
});
const ecran = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.evaluate(() => { const l = document.querySelector('.vrm-rpf-ligne[data-cc-carte]'); if (l) l.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `multi-${nom}.png`) }); };

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    const vues = [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']];
    for (const [vp, sombre, nom] of vues) {
      console.log(`\n— 1. Avec la liste des n° · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'avecListe');
      await essaie(nom, async () => {
        const m = await lire(pg); await ecran(pg, `avec-liste-${nom}`);
        dit(m.lignes.length === 1, `${nom} : UNE seule ligne pour le colis`, m.lignes.map((l) => l.titre).join(' | '));
        dit(m.lignes.length >= 1 && /Baskets montantes/.test(m.lignes[0].titre) && m.lignes[0].code, `${nom} : au nom de l'article, avec le code du colis Chronopost`, JSON.stringify(m.lignes));
        dit(m.lignes.length >= 1 && m.lignes[0].qr, `${nom} : le QR du colis se touche depuis sa ligne`);
        dit(!m.lignes.some((l) => l.surVinted), `${nom} : aucune ligne « Code sur Vinted »`);
        dit(!m.prop.length && !m.contredit.length, `${nom} : rien à proposer (l'identité relie)`);
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();

      console.log(`\n— 2. Sans la liste (ligne d'avant) · ${nom}`);
      const o2 = await ouvrir(b, vp, sombre, 'sansListe');
      await essaie(nom, async () => {
        const m = await lire(o2.pg); await ecran(o2.pg, `sans-liste-${nom}`);
        dit(m.lignes.length === 2, `${nom} : deux lignes tant que rien ne les relie`, m.lignes.map((l) => l.titre).join(' | '));
        // (19 nov., décision de Julien) Avant : la proposition « même colis — Relier », son toucher rangeait le lien. Désormais : aucun geste.
        dit(!m.prop.length && m.relier === 0, `${nom} : plus de « C'est sans doute le même colis — Relier » (ni « Ce n'est pas le même »)`, JSON.stringify({ prop: m.prop, relier: m.relier }));
        const pl = m.cont.filter((c) => c.etat === 'pas-lu');
        dit(pl.length === 1 && pl[0].raison === 'ouvrir-vinted' && pl[0].compte === 'compte_a' && /Contenu pas encore lu/.test(pl[0].txt) && /vinted\.fr sur compte_a/.test(pl[0].txt) && pl[0].toucher === 0, `${nom} : le colis Chronopost dit « Contenu pas encore lu · ouvre vinted.fr sur compte_a », rien à toucher`, JSON.stringify(m.cont));
        dit(!o2.ecrits.some((id) => /^colis_suivi_/.test(id)), `${nom} : aucun lien écrit`, o2.ecrits.join(' '));
      });
      dit(!o2.errs.length, `${nom} : aucune erreur`, o2.errs.join(' | ').slice(0, 200));
      await o2.ctx.close();
    }
    const vp = { width: 390, height: 844 };
    console.log('\n— 3. Deux achats au même point (sans liste)');
    { const o = await ouvrir(b, vp, false, 'deuxAchats');
      await essaie('3', async () => { const m = await lire(o.pg); await ecran(o.pg, 'deux-achats');
        dit(m.lignes.length === 3 && !m.prop.length && m.relier === 0, 'deux candidats : aucune proposition, aucun geste « Relier »', `${m.lignes.length} lignes, ${m.prop.length} proposition(s)`); });
      dit(!o.errs.length, 'aucune erreur', o.errs.join(' | ').slice(0, 200)); await o.ctx.close(); }
    console.log('\n— 5. La liste LUE contredit un lien posé à la main');
    { const o = await ouvrir(b, vp, false, 'contredit');
      await essaie('5', async () => {
        const m = await lire(o.pg); await ecran(o.pg, 'contredit');
        dit(m.contredit.length === 1 && /ne correspond pas au suivi Vinted/.test(m.contredit[0]), '« Ce lien ne correspond pas au suivi Vinted — délier ? »', JSON.stringify(m.contredit));
        dit(!m.prop.length, 'liste lue : aucune proposition');
        dit(!m.lignes.some((l) => /Baskets montantes/.test(l.titre) && l.code), 'le lien contredit ne relie plus (le colis Chronopost n’est pas dit « Baskets… »)', JSON.stringify(m.lignes));
        await o.pg.locator('[data-rp-delier]').first().click(); await o.pg.waitForTimeout(800);
        const m2 = await lire(o.pg);
        dit(o.effaces.includes(`colis_suivi_chronopost_${N2}`) && !m2.contredit.length, '« Délier » retire le lien, la mention disparaît', o.effaces.join(' '));
      });
      dit(!o.errs.length, 'aucune erreur', o.errs.join(' | ').slice(0, 200)); await o.ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-multi-transporteurs : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
