// ════════════════════════════════════════════════════════════════════════════
//  Banc (13 nov., lot 7) : LE NOM DE LA PAIRE SUR CHAQUE COLIS À RETIRER.
//  Julien : « chaque colis à retirer porte le nom de la paire qui est dedans » (titre de l'achat + photo),
//  au lieu de « Colis Mondial Relay » — relié UNIQUEMENT par identité (§5), jamais par ressemblance.
//  Base SYNTHÉTIQUE (dépôt public, valeurs inventées), à la forme mesurée sur la vraie base le 13 nov. :
//   · un Mondial Relay (e-mail du transporteur, aucun titre) relié à SON achat par la ligne de suivi Vinted
//     (`harvest_{uid}_suivi_{tx}`, n° de suivi) ;
//   · un Vinted Go (e-mail sans titre) relié par son CODE de retrait, lu dans la conversation de SA commande
//     (`panel_colis_relais`) ;
//   · un e-mail Vinted « Commande mise à jour pour … » relié par la CONVERSATION de sa commande (sans photo) ;
//   · un Chronopost Pickup qu'AUCUNE identité ne relie, au même point qu'un achat « au point relais » sans n°
//     (le piège de la ressemblance) : il reste « Colis Chronopost Pickup », sans photo, sans nom deviné.
//  Exige, sur ce qui est RENDU et PUBLIÉ (jamais un libellé de code) :
//   A. Colis → À retirer : le titre ET la photo de l'achat relié sur les trois lignes reliées ; le Chronopost
//      sans nom ni photo d'un autre achat ;
//   B. le mode relais : le même nom sur chaque carte ;
//   C. la liste publiée pour le widget (`vrm_colis_retirer.colis[i][7]`), les codes hors ligne
//      (`vrm_codes_hors_ligne`) et la photo hors ligne de Ma journée (`vrm_hl_photo_*`) : le même nom ;
//      '' pour le Chronopost (le widget écrit « Colis Chronopost ») ;
//   D. Ma journée : la case « À retirer » dit le nom des paires (deux au plus, le reste compté), jamais « Colis ».
//  390 tactile et 1512, clair et sombre. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
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
const PORT = Number(process.env.BANC_PORT || 4438);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 13, 10, 19, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const SUPERU = 'SUPER U ACCUEIL, 2 Avenue de la Mer, 35260 Cancale';
const PRESSE = 'MAISON DE LA PRESSE, 4 Place de l’Église, 35260 Cancale';
const CASIER = 'CONSIGNE VINTED GO, 9 Rue du Port, 35260 Cancale';
const AU_RELAIS = 'La livraison n\'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais';
const EN_ROUTE = 'Commande expédiée et en cours d\'acheminement ! ';
const achat = (id, titre, statut, k, extra = {}) => ({ transaction_id: id, conversation_id: 'c-' + id, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: statut, date: ilYa(6), photo: { url: url(k) }, ...extra });
// Les noms (inventés) : chacun n'est relié que par SON identité.
const N_MR = 'Adidas Spezial bleu 42', N_VGO = 'Nike P6000 argent', N_CONV = 'Autry Medalist blanches', N_PIEGE = 'Salomon XT-6 noires';
const ACHATS = [
  achat(9501, N_MR, EN_ROUTE, 21),
  achat(9502, N_VGO, AU_RELAIS, 22, { transaction_user_status: 'needs_action' }),
  achat(9503, N_CONV, AU_RELAIS, 23, { transaction_user_status: 'needs_action' }),
  achat(9504, N_PIEGE, AU_RELAIS, 24, { transaction_user_status: 'needs_action' }),
];
const track = (id, d) => ({ id, data: Object.assign({ type: 'suivi', status: 'available', statusLabel: 'Arrivé au point de retrait', receivedAt: ilYa(1), emailAt: ilYa(1), arriveLe: ilYa(1), limite: jourDans(4), consigne: false, account: 'compte_a' }, d) });
const TRACKS = [
  track('email_track_mondialrelay_40000001', { carrier: 'mondialrelay', suivi: '40000001', code: '400001', lieu: SUPERU, subject: 'Votre colis 40000001 est disponible 📦' }),
  track('email_track_vinted_1VGO00000001', { carrier: 'vinted', suivi: '1VGO00000001', code: '482913', lieu: CASIER, subject: 'Ton colis t’attend dans la consigne #1VGO00000001' }),
  track('email_track_autre_conv-c-9503', { carrier: 'autre', suivi: '', code: null, conv: 'c-9503', source: 'vinted-commande', artTitle: N_CONV, lieu: PRESSE, subject: `Commande mise à jour pour ${N_CONV}` }),
  track('email_track_chronopost_06000000000001', { carrier: 'chronopost', suivi: '06000000000001', code: '700001', lieu: SUPERU, subject: 'Votre colis VINTED est arrivé en relais Pickup' }),
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  // La ligne de suivi Vinted de l'achat 9501 (forme réelle : `tx`, `suivi`, `transporteur`, `source`).
  { id: 'harvest_111_suivi_9501', data: { v: 1, tx: '9501', suivi: '40000001', transporteur: 'MONDIAL', source: 'journey', capturedAt: cap, etapes: [], dernier: null } },
  // Le code lu dans la conversation de l'achat 9502 ; l'achat 9504 (le piège) n'a ni code ni n°.
  { id: 'panel_colis_relais', data: { 9502: { tx: '9502', code: '482913', lieu: CASIER, transporteur: 'vinted', at: ilYa(1), conv: 'c-9502' } } },
  ...TRACKS,
];
// Ma journée se lit SANS le piège : un achat « au point relais » sans identité y est « à vérifier » (la ligne de la
// case le dit, en ambre, à la place des noms) — la règle des noms se juge seule.
// (14 nov., Julien : aucun colis SANS code dans « À retirer ») Ma journée juge les NOMS : l'e-mail de la conversation y porte un code.
const LIGNES_JOURNEE = LIGNES.map((r) => (r.id === 'harvest_111_orders_purchased' ? { ...r, data: { ...r.data, payload: { my_orders: ACHATS.filter((o) => o.transaction_id !== 9504) } } } : r.id === 'email_track_autre_conv-c-9503' ? { ...r, data: { ...r.data, code: '650003' } } : r));
let LIGNES_SERVIES = LIGNES;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
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
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
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
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES_SERVIES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES_SERVIES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES_SERVIES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const shotDe = (pg, nom) => async (k) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `nom-paire-${k}-${nom}.png`), fullPage: false }); };

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— Le nom de la paire · ${nom}`);
      // ── A, B, C : Colis → À retirer, le mode relais, ce qui est publié ──
      LIGNES_SERVIES = LIGNES;
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord'); const shot = shotDe(pg, nom);
        await essaie(`${nom} : À retirer`, async () => {
          await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
          await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
          await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]').length >= 4, null, { timeout: 30000 }).catch(() => {});
          await pg.waitForTimeout(900);
          const L = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]')].map((l) => {
            const im = [...l.querySelectorAll('.vrm-rpf-vignette img')].map((i) => i.getAttribute('src') || '').filter((s) => /images1\.vinted\.net/.test(s));
            return { cle: l.getAttribute('data-cc-carte'), titre: ((l.querySelector('.vrm-rpf-titre') || {}).textContent || '').trim(), code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait'), photo: (/\/t\/b(\d+)\//.exec(im[0] || '') || [])[1] || '', vu: l.getBoundingClientRect().height > 0, verif: l.getAttribute('data-a-verifier-raison') };
          }));
          for (let i = 0; i < 3; i++) { await pg.evaluate((i) => { const e = document.querySelectorAll('.vrm-rpf-point')[i]; if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } }, i); await pg.waitForTimeout(250); await shot(`retirer-point${i + 1}`); }
          const par = (code) => L.find((l) => l.code === code) || null;
          const mr = par('400001'), vgo = par('482913'), conv = L.find((l) => l.titre.includes(N_CONV)) || null, cp = par('700001');
          dit(!!mr && mr.titre.includes(N_MR) && mr.photo === '21', `${nom} : A1 Mondial Relay relié par son n° de suivi (ligne de suivi Vinted) ⇒ « ${N_MR} » et SA photo`, JSON.stringify(mr));
          dit(!!vgo && vgo.titre.includes(N_VGO) && vgo.photo === '22', `${nom} : A2 Vinted Go relié par son CODE (conversation de sa commande) ⇒ « ${N_VGO} » et SA photo`, JSON.stringify(vgo));
          dit(!!conv && conv.photo === '23' && conv.verif === 'sans_code', `${nom} : A3 e-mail Vinted relié par la CONVERSATION de sa commande ⇒ « ${N_CONV} » et SA photo — sans code, dans « À vérifier » (14 nov.)`, JSON.stringify(conv));
          dit(!!cp && /^(N°\d+ · )?Colis Chronopost/.test(cp.titre) && !cp.photo && !L.some((l) => l.code === '700001' && l.titre.includes(N_PIEGE)), `${nom} : A4 Chronopost sans identité ⇒ « Colis Chronopost… », sans photo — jamais le nom de l'achat au même point (${N_PIEGE})`, JSON.stringify(cp));
          // B. Le mode relais : chaque carte, son nom.
          const btn = pg.locator('[data-relais-ouvrir]:visible').first();
          if (await btn.count()) {
            await btn.click(); await pg.locator('.vrm-relais').first().waitFor({ timeout: 10000 });
            const cartes = [];
            for (let i = 0; i < 8; i++) {
              const c = await pg.evaluate(() => { const e = document.querySelector('.vrm-relais-carte'); return e ? { code: (e.querySelector('[data-relais-code]') || { getAttribute: () => '' }).getAttribute('data-relais-code'), titre: ((e.querySelector('[data-relais-titre]') || {}).textContent || '').trim() } : null; });
              if (c) cartes.push(c);
              if (i === 0) await shot('mode-relais');
              const s = pg.locator('[data-relais-suivant]:not([disabled])'); if (!(await s.count())) break; await s.first().click(); await pg.waitForTimeout(150);
            }
            const t = (code) => (cartes.find((c) => c.code === code) || {}).titre || '';
            dit(t('400001').includes(N_MR) && t('482913').includes(N_VGO) && /^Colis Chronopost/.test(t('700001')) && !cartes.some((c) => c.titre.includes(N_CONV)), `${nom} : B mode relais — le même nom sur chaque carte, « Colis Chronopost… » pour celui qu'aucune identité ne relie ; le colis SANS code n'y est pas (14 nov.)`, JSON.stringify(cartes));
            await pg.locator('[data-relais-fermer]').first().click().catch(() => {});
          } else dit(false, `${nom} : B le bouton « Mode relais » est là`);
          // C. Ce qui est publié (widget), gardé hors ligne (codes, Ma journée).
          await pg.waitForTimeout(600);
          const pub = await pg.evaluate(() => { const lit = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
            const k = Object.keys(localStorage).find((x) => x.startsWith('vrm_hl_photo_'));
            return { colis: (lit('vrm_colis_retirer') || {}).colis || null, codes: (lit('vrm_codes_hors_ligne') || {}).codes || null, hl: k ? ((lit(k) || {}).retirer || null) : null }; });
          const nomPub = (id) => ((pub.colis || []).find((c) => Array.isArray(c) && c[3] === id) || [])[7];
          dit(nomPub('e:40000001') === N_MR && nomPub('e:1VGO00000001') === N_VGO && !(pub.colis || []).some((c) => c[7] === N_CONV) && nomPub('e:06000000000001') === '', `${nom} : C1 la liste publiée pour le widget porte le nom [7] (vide pour le Chronopost)`, JSON.stringify(pub.colis));
          const titreCode = (L2, code) => ((L2 || []).find((c) => c.code === code) || {}).titre;
          dit(titreCode(pub.codes, '400001') === N_MR && titreCode(pub.codes, '482913') === N_VGO && !titreCode(pub.codes, '700001'), `${nom} : C2 codes hors ligne — le nom de la paire avec son code`, JSON.stringify(pub.codes && pub.codes.map((c) => [c.code, c.titre])));
          dit(titreCode(pub.hl, '400001') === N_MR && titreCode(pub.hl, '482913') === N_VGO && !(pub.hl || []).some((r) => r.titre === N_CONV) && !titreCode(pub.hl, '700001'), `${nom} : C3 Ma journée hors ligne — le nom de la paire sur chaque colis relié`, JSON.stringify(pub.hl && pub.hl.map((c) => [c.code, c.titre])));
        });
        dit(!errs.length, `${nom} : aucune erreur (Colis)`, errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── D : Ma journée ──
      LIGNES_SERVIES = LIGNES_JOURNEE;
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'journee'); const shot = shotDe(pg, nom);
        await essaie(`${nom} : Ma journée`, async () => {
          await pg.locator('[data-case="retirer"]').first().waitFor({ timeout: 30000 });
          await pg.waitForFunction(() => { const e = document.querySelector('[data-case="retirer"] [data-sous-ligne]'); return !!e; }, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(500);
          const c = await pg.evaluate(() => { const e = document.querySelector('[data-case="retirer"]'); const s = e && e.querySelector('[data-sous-ligne]'); if (e) e.scrollIntoView({ block: 'center' }); return e ? { n: e.getAttribute('data-n'), cle: s ? s.getAttribute('data-sous-ligne') : null, texte: s ? s.textContent.trim() : '' } : null; });
          await shot('journee');
          const noms = [N_MR, N_VGO, N_CONV, N_PIEGE].filter((x) => c && c.texte.includes(x));
          dit(!!c && c.cle === 'noms' && noms.length === 2 && !/\bColis\b/.test(c.texte) && (Number(c.n) <= 2 || new RegExp(`et ${Number(c.n) - 2} autres?$`).test(c.texte)), `${nom} : D Ma journée — la case « À retirer » dit le nom de deux paires, le reste compté, jamais « Colis »`, JSON.stringify(c));
        });
        dit(!errs.length, `${nom} : aucune erreur (Ma journée)`, errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-nom-paire : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
