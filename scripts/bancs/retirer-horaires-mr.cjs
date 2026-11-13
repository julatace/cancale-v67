// ════════════════════════════════════════════════════════════════════════════
//  Banc : LES HORAIRES DES POINTS MONDIAL RELAY DANS « À RETIRER » (13 nov., lot 11 — point 11 de Julien).
//  L'e-mail Mondial Relay ne donne qu'un lien : les horaires sont ceux que le SERVEUR a lus chez Mondial Relay
//  dans la réponse de suivi de CE colis, rangés sur sa ligne `transp_mondialrelay_{n°}` (`horaires`, son n° de
//  point, sa date de lecture). Base SYNTHÉTIQUE (dépôt public, aucune donnée réelle), servie sous la forme réelle
//  (`meta` = les scalaires, `horaires` lu par son chemin `data->horaires`) :
//   · Tabac du Banc (MR, 35000) : lus il y a 1 h, code postal confirmé = celui du point ⇒
//     « Ouvert lun.–sam. 9 h–12 h, 14 h–19 h · ouvert maintenant · ferme à 12 h » (vendredi 10 h 19),
//     « … · fermé — ouvre demain à 9 h » (vendredi 20 h 30) ;
//   · Kiosque du Banc (MR, point à 35700) : la lecture de Mondial Relay est au code postal 35000 ⇒ RIEN ;
//   · Presse du Banc (MR, 35000) : horaires lus il y a 9 jours (plus de 7) ⇒ RIEN ;
//   · Épicerie du Banc (Chronopost) : horaires de son e-mail, inchangés (témoin).
//  La ligne est DANS l'en-tête du point, sous le nom, sans débordement, de la couleur discrète de l'adresse
//  (jamais ambre). 390 tactile et 1512, clair et sombre. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
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
const MATIN = new Date('2026-11-13T10:19:00+01:00'), SOIR = new Date('2026-11-13T20:30:00+01:00');
const MS = MATIN.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => new Date(MS + j * J).toISOString().slice(0, 10);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const SHOTS = process.env.SHOTS || '';
const H_CHRONO = [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '19:30' }] }];
const track = (carrier, suivi, code, lieu, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(1), emailAt: ilYa(1), arriveLe: ilYa(1), code, lieu, limite: jourDans(4), consigne: false, account: 'compte_a' }, extra) });
const H_MR = [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [7], plages: [] }];
const transp = (suivi, cp, horairesAt, extra = {}) => ({ id: `transp_mondialrelay_${suivi}`, data: Object.assign({ v: 1, suivi, carrier: 'mondialrelay', voie: 'mr-fr-mvc', etat: 'disponible', detail: null, etatAt: ilYa(1), libelle: '5 jours restants pour retirer le colis en Point Relais', lu: iso(MS - 3600e3), source: 'serveur', essai: iso(MS - 3600e3), essaiRes: 'ok', essaiSource: 'serveur', essais: 0, cp, cpSource: 'email', fini: false, horaires: H_MR, horairesPoint: '88001', horairesAt }, extra) });
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Rennes' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  track('chronopost', 'XY100000001FR', '482913', 'EPICERIE DU BANC, 1 Rue des Essais, 35000 Rennes', { horaires: H_CHRONO }),
  track('mondialrelay', '12345678', '418205', 'TABAC DU BANC, 3 Place Inventée, 35000 Rennes'),
  track('mondialrelay', '23456789', '529316', 'KIOSQUE DU BANC, 4 Allée Fictive, 35700 Rennes'),
  track('mondialrelay', '34567890', '630427', 'PRESSE DU BANC, 5 Quai Imaginaire, 35000 Rennes'),
  transp('12345678', '35000', iso(MS - 3600e3)),
  transp('23456789', '35000', iso(MS - 3600e3)),
  transp('34567890', '35000', iso(MS - 9 * J)),
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
// La colonne `meta` (migration 004) : les champs SCALAIRES de premier niveau de moins de 600 caractères.
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, quand) => {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: quand });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
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
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nomVp] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      for (const [quand, moment] of [[MATIN, 'matin'], [SOIR, 'soir']]) {
        const nom = `${nomVp} · ${moment}`;
        console.log(`\n— Horaires Mondial Relay · ${nom}`);
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, quand);
        await essaie(nom, async () => {
          await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
          await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-point').length >= 4, null, { timeout: 30000 }).catch(() => {});
          // La relecture des lignes d'avant (texte gardé de l'e-mail) arrive après la première liste : on l'attend.
          await pg.waitForFunction(() => document.querySelectorAll('[data-relais-horaires]').length >= 2, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(500);
          const pts = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf .vrm-rpf-point[data-relais-point]')].map((p) => {
            const h = p.querySelector('.vrm-rpf-tete [data-relais-horaires]'); const tete = p.querySelector('.vrm-rpf-tete'); const nomEl = p.querySelector('.vrm-rpf-nom'); const adr = p.querySelector('.vrm-rpf-adr');
            const R = (e) => e && e.getBoundingClientRect();
            const rh = R(h), rt = R(tete), rn = R(nomEl);
            return { nom: nomEl ? nomEl.textContent.trim() : '', h: h ? h.textContent.replace(/\s+/g, ' ').trim() : null, attr: h ? h.getAttribute('data-relais-horaires') : null, ouvert: h ? h.getAttribute('data-relais-ouvert') : null,
              dedans: !!(rh && rt && rh.left >= rt.left - 1 && rh.right <= rt.right + 1 && rh.top >= rt.top - 1 && rh.bottom <= rt.bottom + 1 && rh.height > 0),
              sousNom: !!(rh && rn && rh.top >= rn.bottom - 1), deborde: h ? h.scrollWidth > h.clientWidth + 1 || (rt && rh && rh.right > rt.right + 1) || [...h.getClientRects()].some((r) => r.right > rt.right + 1) : false,
              couleur: h ? getComputedStyle(h).color : null, couleurAdr: adr ? getComputedStyle(adr).color : null, taille: h ? parseFloat(getComputedStyle(h).fontSize) : 0 };
          }));
          if (SHOTS) {
            fs.mkdirSync(SHOTS, { recursive: true });
            const prem = await pg.$('.vrm-rpf .vrm-rpf-point[data-relais-point]');
            if (prem) { await prem.evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }); await pg.waitForTimeout(300); }
            const sec = await pg.$('.vrm-rpf');
            if (sec) await sec.screenshot({ path: path.join(SHOTS, `horaires-mr-${nomVp}-${moment}.png`) }).catch(() => {});
            // Le point Mondial Relay aux horaires lus chez le transporteur, en gros plan.
            const tabac = pg.locator('.vrm-rpf .vrm-rpf-point[data-relais-point]', { hasText: 'Tabac du Banc' }).first();
            if (await tabac.count()) { await tabac.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(200); await tabac.screenshot({ path: path.join(SHOTS, `horaires-mr-tabac-${nomVp}-${moment}.png`) }).catch(() => {}); }
          }
          const ep = pts.find((p) => /picerie du Banc/i.test(p.nom)), tb = pts.find((p) => /Tabac du Banc/i.test(p.nom)), kq = pts.find((p) => /Kiosque du Banc/i.test(p.nom)), pr = pts.find((p) => /Presse du Banc/i.test(p.nom));
          dit(!!ep && !!tb && !!kq && !!pr, `${nom} : les quatre points sont là`, JSON.stringify(pts.map((p) => p.nom)));
          const attenduTb = moment === 'matin' ? 'Ouvert lun.–sam. 9 h–12 h, 14 h–19 h · ouvert maintenant · ferme à 12 h' : 'Ouvert lun.–sam. 9 h–12 h, 14 h–19 h · fermé — ouvre demain à 9 h';
          dit(!!tb && tb.h === attenduTb && tb.ouvert === (moment === 'matin' ? '1' : '0'), `${nom} : Mondial Relay, horaires lus chez le transporteur « ${attenduTb} »`, tb && JSON.stringify({ h: tb.h, o: tb.ouvert }));
          dit(!!kq && kq.h === null, `${nom} : Mondial Relay lu à un AUTRE code postal que celui du point ⇒ aucune ligne d'horaires`, kq && JSON.stringify(kq.h));
          dit(!!pr && pr.h === null, `${nom} : Mondial Relay, horaires lus il y a 9 jours ⇒ aucune ligne d'horaires`, pr && JSON.stringify(pr.h));
          const attenduEp = moment === 'matin' ? 'Ouvert lun.–sam. 9 h–19 h 30 · ouvert maintenant · ferme à 19 h 30' : 'Ouvert lun.–sam. 9 h–19 h 30 · fermé — ouvre demain à 9 h';
          dit(!!ep && ep.h === attenduEp, `${nom} : Chronopost (horaires de l'e-mail) inchangé`, ep && JSON.stringify(ep.h));
          const avec = [ep, tb].filter(Boolean);
          dit(avec.length === 2 && avec.every((p) => p.dedans && p.sousNom && !p.deborde), `${nom} : la ligne est dans l'en-tête du point, sous le nom, sans débordement`, JSON.stringify(avec.map((p) => [p.dedans, p.sousNom, p.deborde])));
          dit(avec.length === 2 && avec.every((p) => p.couleurAdr && p.couleur === p.couleurAdr && p.taille <= 14), `${nom} : discrète et neutre (la couleur et la taille de l'adresse, jamais ambre)`, JSON.stringify(avec.map((p) => [p.couleur, p.couleurAdr, p.taille])));
        });
        dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-horaires-mr : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
