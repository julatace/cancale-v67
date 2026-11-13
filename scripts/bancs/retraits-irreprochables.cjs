// Banc : COLIS À RÉCEPTIONNER IRRÉPROCHABLES (docs/passation/2026-11-10-retraits-irreprochables.md)
// Julien (10 nov.) : « il faut vraiment quelque chose de parfait, d'irréprochable, il doit y avoir aucune
// erreur, impossible que ce soit sur les messages, les mails et la lecture sur Vinted directement ».
// Données INVENTÉES de la VRAIE forme (`email_track_*`, `transp_*`, `harvest_{uid}_suivi_{tx}`, achats
// `my_orders`, `panel_colis_relais`) — rien de réel. Colis → À retirer rendu, jugé sur les data-* :
//   R1 un Mondial Relay dont l'e-mail ET la conversation de SA commande donnent le MÊME code ⇒ « sûr »
//      (coche), marques Vinted · e-mail · message · transporteur, « vérifié à … » ;
//   R2 une consigne Vinted Go dont l'e-mail dit B12345 et la conversation C99999 ⇒ « 2 codes » ambre,
//      aucun code choisi, les deux valeurs et leurs sources dans le détail ;
//   R3 un colis REDIRIGÉ (« Votre colis a changé de plan » rangé « livré » par l'ancienne règle) que le
//      transporteur dit maintenant disponible sans nommer le point ⇒ À RETIRER, sous le NOUVEAU point lu
//      dans l'e-mail, avec son code ;
//   R4 un colis dont seul un SMS a donné le code ⇒ marque « SMS » ;
//   R5 un Mondial Relay dont l'e-mail n'a pas de code lisible, mais la conversation de SA commande l'a ⇒ le
//      code est montré (avant : « Code à venir »), source « message ».
// 390 tactile sombre + 1512 clair. BANC_PORT, SHOTS=<dossier>, DIST=<build>, JR_VUES=390-sombre,…
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 12171);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date('2026-11-12T09:00:00Z');   // 10 h à Paris
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const Z = (s) => `2026-${s}:00.000Z`;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const capFrais = iso(MS - 2 * 3600e3);   // achats de compte_a relus il y a 2 h
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const P1 = 'TABAC DU PORT, 12 RUE DU PORT, 35260 CANCALE';
const P2 = 'Consigne Vinted Go, BOUTIQUE TEST, 13 RUE EXEMPLE, 56000 VANNES';
const P3 = 'INTERMARCHE EXEMPLE, LE PORTAIL, 35350 ST MELOIR DES ONDES';
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ligne = (carrier, suivi, o) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code2: null, qrB64: null, qrUrl: null, qrType: null, consigne: false, account: 'compte_a', artTitle: null, ...o } });
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', lieuRue: '', limite: null, limiteSure: false, lu: null, source: 'serveur', essai: iso(MS - 600e3), essaiRes: 'ok', essais: 0, voie: carrier === 'mondialrelay' ? 'mr-fr-mvc' : carrier === 'chronopost' ? 'cp-ws2' : 'vg-v3', fini: false, evenements: [], ...o } });
const suiviV = (tx, suivi, transporteur) => ({ id: `harvest_111_suivi_${tx}`, data: { v: 1, n: 2, tx: String(tx), uid: '111', suivi, transporteur, capturedAt: capFrais, source: 'journey', dernier: { t: 'Disponible pour retrait', at: Z('11-11T09:00'), code: 'available_for_pickup' }, etapes: [{ t: 'Disponible pour retrait', at: Z('11-11T09:00'), code: 'available_for_pickup' }] } });
const ACHATS = [
  { transaction_id: 9500001, conversation_id: 'c-r1', title: 'Achat R1 code sûr', price: { amount: '40.0', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: Z('11-08T10:00'), photo: null },
  { transaction_id: 9500002, conversation_id: 'c-r2', title: 'Achat R2 deux codes', price: { amount: '42.0', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: Z('11-08T11:00'), photo: null },
  { transaction_id: 9500005, conversation_id: 'c-r5', title: 'Achat R5 code du message', price: { amount: '45.0', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: Z('11-08T12:00'), photo: null },
];
const RELAIS = {
  9500001: { tx: '9500001', conv: 'c-r1', code: '700001', lieu: P1, at: iso(MS - 3600e3), arriveLe: Z('11-11T09:05'), titre: 'Achat R1 code sûr', qr: '' },
  9500002: { tx: '9500002', conv: 'c-r2', code: 'C99999', lieu: P2, at: iso(MS - 3600e3), arriveLe: Z('11-11T10:05'), titre: 'Achat R2 deux codes', qr: '' },
  9500005: { tx: '9500005', conv: 'c-r5', code: '700005', lieu: P1, at: iso(MS - 3600e3), arriveLe: Z('11-11T11:05'), titre: 'Achat R5 code du message', qr: '' },
};
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: capFrais, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: capFrais, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  // R1 — e-mail Mondial Relay 700001 + conversation de SA commande (n° de suivi) 700001 ; lu chez le transporteur.
  ligne('mondialrelay', '87660001', { code: '700001', lieu: P1, emailAt: Z('11-11T09:00'), receivedAt: Z('11-11T09:01'), arriveLe: Z('11-11T09:00'), limite: '2026-11-18' }),
  suiviV(9500001, '87660001', 'MONDIAL'),
  transp('mondialrelay', '87660001', { etat: 'disponible', etatAt: Z('11-11T08:50'), lu: Z('11-12T08:40'), libelle: 'Colis disponible au Point Relais', cp: '35260' }),
  // R2 — consigne Vinted Go : l'e-mail dit B12345, la conversation de SA commande (n° de suivi) dit C99999.
  ligne('vinted', '1790000000000062', { code: 'B12345', lieu: P2, consigne: true, emailAt: Z('11-11T10:00'), receivedAt: Z('11-11T10:01'), arriveLe: Z('11-11T10:00'), limite: '2026-11-16' }),
  suiviV(9500002, '1790000000000062', 'vinted'),
  // R3 — « changé de plan » rangé « livré » par l'ancienne règle ; le transporteur dit maintenant disponible, sans nommer le point.
  { id: 'email_track_mondialrelay_87660003', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '87660003', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Votre colis a changé de plan 📍', code: '700003', code2: null, lieu: P3, limite: '2026-11-15', account: 'compte_a', emailAt: Z('11-10T10:01'), receivedAt: Z('11-10T10:02'), retireLe: Z('11-09T23:55'), consigne: false, qrB64: null, qrUrl: null, qrType: null, artTitle: null } },
  transp('mondialrelay', '87660003', { etat: 'disponible', etatAt: Z('11-11T14:00'), lu: Z('11-12T08:30'), libelle: 'Colis disponible au Point Relais', cp: '35350' }),
  // R4 — un SMS Mondial Relay seul (forme `api/_lib/sms-mondialrelay.js`).
  ligne('mondialrelay', '87660004', { source: 'sms', code: '700004', lieu: P1, subject: 'SMS Mondial Relay', emailAt: Z('11-11T12:00'), receivedAt: Z('11-11T12:00'), arriveLe: Z('11-11T12:00'), limite: '2026-11-19' }),
  // R5 — l'e-mail Mondial Relay sans code lisible ; la conversation de SA commande (n° de suivi) porte 700005.
  ligne('mondialrelay', '87660005', { code: null, extraitCode: 'Présentez votre code de retrait', lieu: P1, emailAt: Z('11-11T11:00'), receivedAt: Z('11-11T11:01'), arriveLe: Z('11-11T11:00'), limite: '2026-11-18' }),
  suiviV(9500005, '87660005', 'MONDIAL'),
];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = capFrais; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
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
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: capFrais, cap: r.data && r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    const ors = /[?&]or=\(([^&]*)\)/.exec(u);
    if (ors) { const pats = [...ors[1].matchAll(/id\.like\.([^,)]*)/g)].map((m) => new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); if (pats.length) return j(LIGNES.filter((r) => pats.some((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

const lire = (pg) => pg.evaluate(() => {
  const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
  const lignes = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].map((l) => ({
    cle: l.getAttribute('data-cc-carte'), sources: l.getAttribute('data-rp-sources') || '', verifie: l.getAttribute('data-rp-verifie') || '',
    sur: l.getAttribute('data-rp-code-sur') === '1', desaccord: l.getAttribute('data-rp-codes-desaccord') || '',
    code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait') || '',
    aVenir: !!l.querySelector('[data-rp-code-a-venir]'), horsCompte: l.hasAttribute('data-hors-compte'),
    verifieTexte: ((l.querySelector('[data-rp-verifie-texte]') || {}).textContent || '').trim(),
    marques: [...l.querySelectorAll('[data-rp-source]')].map((e) => e.textContent.trim()),
    point: ((l.closest('[data-rp-point], [data-relais-point], section, details') || { textContent: '' }).textContent || '').slice(0, 400),
    bouton2: !!l.querySelector('[data-rp-code-desaccord]'),
  }));
  const onglet = document.querySelector('[data-colis-onglet-choix="retirer"]');
  return { pub, lignes, ongletN: (() => { /* (11 nov., lot DJ3) « À retirer » n'a plus d'onglet : le nombre de SA liste (`data-cc-n`) */ const c = document.querySelector('[data-cc-colonne="retirer"]'); return c ? c.getAttribute('data-cc-n') : (onglet ? onglet.getAttribute('data-colis-onglet-n') : null); })(), deb: document.documentElement.scrollWidth - window.innerWidth };
});

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer, d'où vient chaque information · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 40000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForSelector('.vrm-rpf-ligne[data-cc-carte]', { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const m = await lire(pg);
        const L = (k) => m.lignes.find((l) => l.cle.includes(k)) || null;
        const J = (o) => JSON.stringify(o);
        dit(m.ongletN === '5' && m.pub && m.pub.total === 5, 'les cinq colis sont À RETIRER (liste = publication)', J({ onglet: m.ongletN, pub: m.pub && m.pub.total }));
        const r1 = L('87660001');
        dit(!!r1 && r1.code === '700001' && r1.sur, 'R1 e-mail + conversation de SA commande au même code ⇒ « sûr »', J(r1 && { code: r1.code, sur: r1.sur }));
        dit(!!r1 && r1.sources === 'vinted,email,message,transporteur' && r1.marques.join('·') === 'Vinted·e-mail·message', 'R1 les marques : Vinted · e-mail · message (11 nov. : « transporteur » est dit par « vérifié par Mondial Relay », pas deux fois)', r1 && r1.sources);
        dit(!!r1 && Number(r1.verifie) === Date.parse('2026-11-12T08:40:00.000Z') && /^vérifié par Mondial Relay à 09:40$/.test(r1.verifieTexte), 'R1 « vérifié par Mondial Relay à 09:40 » (la lecture chez le transporteur, la plus récente ; 11 nov. : la source est dite)', r1 && `${r1.verifie} · ${r1.verifieTexte}`);
        const r2 = L('1790000000000062');
        dit(!!r2 && !r2.code && r2.bouton2 && /email:B12345/.test(r2.desaccord) && /message:C99999/.test(r2.desaccord), 'R2 e-mail B12345 et conversation C99999 ⇒ « 2 codes » ambre, AUCUN code choisi', J(r2 && { code: r2.code, d: r2.desaccord }));
        const r3 = L('87660003');
        dit(!!r3 && !r3.horsCompte && r3.code === '700003', 'R3 colis redirigé, disponible chez le transporteur ⇒ À RETIRER, avec le code de l’e-mail de ce n°', J(r3 && { code: r3.code, hors: r3.horsCompte }));
        dit(!!r3 && /INTERMARCHE|Intermarche|ST MELOIR|St Meloir|Saint/i.test(r3.point), 'R3 …sous le NOUVEAU point lu dans l’e-mail (jamais « point pas encore connu »)', r3 && r3.point.slice(0, 120));
        const r4 = L('87660004');
        dit(!!r4 && r4.sources.split(',').includes('sms') && r4.code === '700004', 'R4 le code venu d’un SMS est marqué « SMS »', J(r4 && { s: r4.sources, code: r4.code }));
        const r5 = L('87660005');
        dit(!!r5 && r5.code === '700005' && !r5.aVenir && r5.sources.includes('message'), 'R5 e-mail sans code lisible, conversation de SA commande avec le code ⇒ montré (plus « Code à venir »)', J(r5 && { code: r5.code, aVenir: r5.aVenir }));
        const sec2 = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((e) => /1790000000000062/.test(e.getAttribute('data-cc-carte'))); const s = l && l.closest('[data-rp-section]'); return s ? s.getAttribute('data-rp-section') : ''; });
        dit(sec2 !== 'avenir', 'R2 deux codes : jamais rangé sous « Code à venir »', sec2);
        const alerte = await pg.evaluate(() => [...document.querySelectorAll('[data-relais-change-suivi]')].map((e) => e.getAttribute('data-relais-change-suivi')));
        dit(!alerte.includes('87660003'), 'R3 arrivé (transporteur) : plus annoncé « point changé · pas encore arrivé »', JSON.stringify(alerte));
        dit(m.deb <= 1, 'rien ne déborde', `${m.deb}px`);
        if (SHOTS) {
          await pg.evaluate(() => { const e = document.querySelector('.vrm-rpf-ligne[data-cc-carte]'); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); });
          await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `retraits-irreprochables-${nom}.png`) });
          // Le détail du désaccord (R2), ouvert.
          const r2b = pg.locator('[data-rp-code-desaccord]').first();
          if (await r2b.count()) { await r2b.click(); await pg.waitForTimeout(300); await pg.evaluate(() => { const e = document.querySelector('[data-rp-desaccord]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(SHOTS, `retraits-irreprochables-desaccord-${nom}.png`) }); }
        }
        const det = await pg.evaluate(() => [...document.querySelectorAll('[data-rp-desaccord-valeur]')].map((e) => e.getAttribute('data-rp-desaccord-source') + ':' + e.getAttribute('data-rp-desaccord-valeur')));
        if (SHOTS) dit(det.includes('email:B12345') && det.includes('message:C99999'), 'R2 le détail montre les deux valeurs et leur source', J(det));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
