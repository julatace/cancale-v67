// ── BANC : LE SUIVI DES COLIS PAR N° ET PAR VINTED (23 oct.) ─────────────────
// Julien : « quand on reçoit un mail comme quoi on a retiré un colis, le numéro
// de suivi est comparé à ceux dans les colis à retirer et ça retire les
// concernés » ; « enregistrer le numéro de suivi et tracer le colis » ; « que ça
// me prévienne dès qu'il y a une mise à jour d'un colis ».
// Formes MESURÉES sur sa base (lecture seule, 23 oct.), valeurs INVENTÉES :
//   · le même n° sous deux clés (`email_track_mondialrelay_N` « disponible »,
//     `email_track_vinted_…` « retiré ») et, souvent, le n° dans le SEUL sujet
//     après « # » (« Ton colis a été retiré #… », « …à la consigne #VGS… ») ;
//   · « Uw pakket is afgehaald door de ontvanger » (NL) rangé « info » ;
//   · un rappel « disponible » reçu APRÈS le « retiré » ;
//   · la ligne de suivi Vinted relevée par l'extension
//     (`harvest_{uid}_suivi_{tx}`, contrat du 23 oct.) : le n°, le transporteur,
//     la dernière étape écrite par Vinted — reliée à SON achat par la
//     transaction ET le compte, jamais par le titre (deux achats au même titre).
// Exige, à 390 px tactile (clair et sombre) et 1512 px :
//   · un colis retiré (autre clé, n° du sujet, NL, retiré puis rappel) n'est plus
//     « à retirer », un achat au même n° non plus ; le colis toujours là reste ;
//   · « Suivre sur le site du transporteur ↗ » sur chaque colis qui a un n°
//     (≥ 44 px), Mondial Relay avec le code postal LU, sinon une recherche dite ;
//   · « Vinted : « … » » seulement sur la carte de SON achat (ou de l'e-mail relié
//     par le code de retrait) — jamais sur l'achat de même titre ;
//   · trois états de lecture du suivi Vinted (lu · pas su · pas encore relevé) ;
//   · « Ajouter un n° de suivi » : transporteur lu à la forme, ambigu ⇒ demandé,
//     rangé une ligne par n°, jamais « à retirer » ;
//   · et, côté serveur (la vraie route du cron du matin) : « 📍 Dernier jour pour
//     retirer » part une fois, et pas pour un colis retiré sous une autre clé.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9705);

const NOW = Date.now();
const j = (n) => new Date(NOW - n * 86400000).toISOString();
const dans = (n) => new Date(NOW + n * 86400000).toISOString().slice(0, 10);
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const achat = (tx, conv, title) => ({ transaction_id: tx, conversation_id: conv, title, price: { amount: '45', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: j(1.5) });
const ACHATS = [
  achat(9601, 7601, 'Asics Gel bleue taille 43'),
  achat(9602, 7602, 'Asics Gel bleue taille 43'),          // MÊME titre, aucune ligne de suivi à lui
  achat(9603, 7603, 'Puma Suede noire taille 42'),         // retirée par son n° (e-mail « retiré », autre clé)
  achat(9604, 7604, 'Nike Dunk grise taille 44'),          // reliée à un e-mail par le CODE de retrait
];
const NV_9601 = 'Ton colis est arrivé au point relais Banc';
const NV_9604 = 'Colis disponible au relais — étape relevée pour la commande 9604';
const NV_AUTRE = 'Étape d’un AUTRE compte, même transaction';
const suiviVinted = (uid, tx, o) => ({ id: `harvest_${uid}_suivi_${tx}`, data: { v: 1, tx: String(tx), source: 'journey', capturedAt: j(0.05), transporteur: 'mondialrelay', etapes: [], forme: {}, ...o } });
const track = (id, o) => ({ id, data: { type: 'suivi', status: 'available', statusLabel: 'Arrivé au point de retrait', limite: dans(3), receivedAt: j(1), account: 'compte_banc', ...o } });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(NOW).toISOString() }];
const BASE = () => [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: { '9604': { code: '582614', lieu: 'Tabac Banc, 9 Rue Exemple, 35260 Cancale', at: j(0.5), url: 'https://www.vinted.fr/inbox/7604' } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: j(0.05), payload: { my_orders: ACHATS } } },
  suiviVinted('111', 9601, { suivi: '30000057', dernier: { t: NV_9601, at: j(0.4), code: null } }),
  suiviVinted('222', 9602, { suivi: '30000058', dernier: { t: NV_AUTRE, at: j(0.4), code: null } }),   // un autre compte : ne relie rien
  suiviVinted('111', 9603, { suivi: '30000053', dernier: { t: 'Commande expédiée', at: j(2), code: null } }),
  suiviVinted('111', 9604, { suivi: '', dernier: { t: NV_9604, at: j(0.3), code: null } }),
  // Mondial Relay, le colis toujours là, code postal dans le lieu
  track('email_track_mondialrelay_30000051', { carrier: 'mondialrelay', suivi: '30000051', subject: 'Votre colis 30000051 est disponible 📦', code: '482913', lieu: 'Bar Banc, 5 Rue Exemple, 35260 Cancale' }),
  // retiré sous une AUTRE clé, n° dans le seul sujet
  track('email_track_mondialrelay_30000052', { carrier: 'mondialrelay', suivi: '30000052', subject: 'Votre colis 30000052 est disponible 📦', code: '111222', lieu: 'Bar Banc, 5 Rue Exemple, 35260 Cancale' }),
  track('email_track_vinted_aa1', { carrier: 'vinted', suivi: '', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Ton colis a été retiré #30000052', receivedAt: j(0.2), limite: null }),
  // Chronopost retiré : la ligne NL rangée « info » (relue avec la règle d'aujourd'hui)
  track('email_track_chronopost_XW000000055FR', { carrier: 'chronopost', suivi: 'XW000000055FR', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '333444', lieu: 'Relais Banc, 7 Rue Exemple, 35000 Rennes' }),
  track('email_track_dpd_XW000000055FR', { carrier: 'dpd', suivi: 'XW000000055FR', status: 'info', statusLabel: 'Information', subject: 'Uw pakket is afgehaald door de ontvanger', receivedAt: j(0.2), limite: null }),
  // retiré, PUIS un rappel « disponible » plus récent : ne ressuscite pas
  track('email_track_vinted_aa2', { carrier: 'vinted', suivi: '', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Ton colis a été retiré #30000054', receivedAt: j(0.6), limite: null }),
  track('email_track_mondialrelay_30000054', { carrier: 'mondialrelay', suivi: '30000054', subject: 'Le temps file : votre colis vous attend avec impatience ⏳', receivedAt: j(0.1), arriveLe: j(2), code: '555666', lieu: 'Bar Banc, 5 Rue Exemple, 35260 Cancale' }),
  // achat 9603 retiré par son n° : e-mail « retiré » sous une clé Vinted, n° dans le sujet
  track('email_track_vinted_aa3', { carrier: 'vinted', suivi: '', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Ton colis a été retiré #30000053', receivedAt: j(0.2), limite: null }),
  // Vinted Go : le n° n'est QUE dans le sujet — montré, avec son n°
  track('email_track_vinted_aa4', { carrier: 'vinted', suivi: '', subject: 'Ton colis est arrivé à la consigne #VGS12345678061', code: 'C61616', lieu: 'Consigne Vinted Go, 4 Rue Exemple, 35000 Rennes', limite: null }),
  // Vinted Go : n° du sujet des deux côtés, retiré sous une autre clé
  track('email_track_vinted_aa5', { carrier: 'vinted', suivi: '', subject: 'Ton colis est arrivé à la consigne #VGS12345678062', code: 'C62626', lieu: 'Consigne Vinted Go, 4 Rue Exemple, 35000 Rennes', limite: null }),
  track('email_track_vinted_aa6', { carrier: 'vinted', suivi: '', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Ton colis a été retiré #VGS12345678062', receivedAt: j(0.2), limite: null }),
  // l'e-mail relié à la commande 9604 par le CODE de retrait (même code des deux côtés)
  track('email_track_mondialrelay_30000064', { carrier: 'mondialrelay', suivi: '30000064', subject: 'Votre colis 30000064 est disponible 📦', code: '582614', lieu: 'Tabac Banc, 9 Rue Exemple, 35260 Cancale' }),
];

const SESSION = { access_token: 'session-suivi-colis', refresh_token: 'r', totp: [], expires_at: NOW + 30 * 86400000, user: { id: '11111111-1111-4111-8111-111111111111', email: 'suivi@example.test', totp: [] } };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(NOW).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.suivisVinted` : 'ko' ⇒ la lecture `harvest_*_suivi_*` répond 503.
// La base est À ÉTAT pour les n° ajoutés à la main (`colis_suivi_*`) : écrits,
// relus, retirés ; le reste des écritures de l'app est ignoré.
async function preparer(b, vp, sombre, opts = {}) {
  const ROWS = opts.rows || BASE();
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(mobile ? { isMobile: true, hasTouch: true } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('dialog', (d) => d.accept());
  const ecrits = [];
  await pg.addInitScript(([s, dark]) => { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', dark ? 'true' : 'false'); }, [SESSION, !!sombre]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const rep = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    const m = req.method();
    if (m === 'POST') {
      let corps = []; try { corps = JSON.parse(req.postData() || '[]'); } catch (_) {}
      for (const r of (Array.isArray(corps) ? corps : [corps])) {
        if (!r || !/^colis_suivi_/.test(String(r.id || ''))) continue;
        ecrits.push(r.id);
        const i = ROWS.findIndex((x) => x.id === r.id);
        if (i >= 0) ROWS[i] = { id: r.id, data: r.data }; else ROWS.push({ id: r.id, data: r.data });
      }
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (m === 'DELETE') {
      const eq = /id=eq\.([^&]*)/.exec(u);
      if (eq && /^colis_suivi_/.test(eq[1])) { const i = ROWS.findIndex((x) => x.id === eq[1]); if (i >= 0) ROWS.splice(i, 1); }
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (m !== 'GET') return rep([]);
    if (/id=like\.harvest_\*_suivi_\*/.test(u) && opts.suivisVinted === 'ko') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"indisponible"}' });
    if (/select=owner/.test(u)) return rep([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return rep(ACCOUNTS);
    if (/\/rest\/v1\/rpc\//.test(u)) return rep(null);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && !/^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(NOW).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return rep(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ins = /id=in\.\(([^)]*)\)/.exec(u); if (ins) { const ids = ins[1].split(','); return rep(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return rep(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return rep([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('mode=confidentialite') ? { ok: true, uid: SESSION.user.id } : { ok: true, pret: true, obligatoire: false, acces: true }) }));
  return { ctx, pg, errs, ROWS, ecrits };
}

const ouvrir = async (pg, errs) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-pickup-card').first().waitFor({ timeout: 20000 }).catch(async (e) => { console.log('ÉCRAN : ' + (await pg.locator('body').innerText()).slice(0, 1200)); console.log('ERREURS : ' + errs.join(' | ')); throw e; });
  await pg.waitForTimeout(1800);
};
const lire = (pg) => pg.evaluate(() => {
  const cartes = [...document.querySelectorAll('.vrm-pickup-card')].map((c) => {
    const s = c.querySelector('[data-colis-suivi]');
    const conv = [...c.querySelectorAll('a[href*="/inbox/"]')].map((a) => a.getAttribute('href'));
    return {
      t: c.innerText, suivi: s ? s.getAttribute('data-colis-suivi') : null, conv,
      nv: [...c.querySelectorAll('[data-nouvelle-vinted]')].map((x) => x.getAttribute('data-nouvelle-vinted')),
      suivre: [...c.querySelectorAll('a[data-suivre-colis]')].map((a) => { const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), site: a.getAttribute('data-suivre-site'), n: a.getAttribute('data-suivre-colis'), cp: a.getAttribute('data-suivre-cp'), h: r.height, t: a.innerText }; }),
    };
  });
  const onglet = document.querySelector('[data-achats-onglet="attente"]');
  const etat = document.querySelector('[data-suivi-vinted-etat]');
  return {
    cartes, total: onglet ? onglet.getAttribute('data-n') : null,
    nNouvelles: [...document.querySelectorAll('[data-nouvelle-vinted]')].map((x) => x.getAttribute('data-nouvelle-vinted')),
    etatSuivi: etat ? etat.getAttribute('data-suivi-vinted-etat') : null, etatSuiviTexte: etat ? etat.innerText : '',
    texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    bg: getComputedStyle(document.body).backgroundColor,
  };
});

async function navigateur() {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tailles = [['390 clair', { width: 390, height: 844 }, false], ['1512', { width: 1512, height: 950 }, false], ['390 sombre', { width: 390, height: 844 }, true]];
  try {
    for (const [nom, vp, sombre] of tailles) {
      // ── A. Les colis retirés sortent, les autres restent, et chacun se suit ──
      await essaie(`${nom} A`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, sombre);
        await ouvrir(pg, errs);
        const r = await lire(pg);
        const parSuivi = (n) => r.cartes.filter((c) => c.suivi === n);
        const parConv = (c) => r.cartes.filter((x) => x.conv.some((h) => h.endsWith('/inbox/' + c)));
        dit(parSuivi('30000051').length === 1, `${nom} : le colis toujours là (Mondial Relay 30000051) est « à retirer »`);
        dit(!parSuivi('30000052').length && !/30000052/.test(r.texte.split('repartis')[0] || ''), `${nom} : un « retiré » sous une AUTRE clé, n° dans le seul sujet, sort le colis 30000052`);
        dit(!parSuivi('XW000000055FR').length, `${nom} : « Uw pakket is afgehaald door de ontvanger » (NL, rangé « info ») sort le colis Chronopost`);
        dit(!parSuivi('30000054').length, `${nom} : un rappel « disponible » reçu APRÈS le « retiré » ne ressuscite pas 30000054`);
        dit(!parSuivi('VGS12345678062').length, `${nom} : Vinted Go, n° du sujet des deux côtés, retiré sous une autre clé ⇒ sorti`);
        const vgo = parSuivi('VGS12345678061')[0];
        dit(!!vgo, `${nom} : un « disponible » dont le n° n'est QUE dans le sujet est montré AVEC son n°`, r.cartes.map((c) => c.suivi).join(' · '));
        dit(!parConv('7603').length, `${nom} : l'achat 9603 sort aussi : un « retiré » à SON n° (relevé par Vinted) est arrivé sous une autre clé`);
        const a1 = parConv('7601')[0], a2 = parConv('7602')[0];
        dit(!!a1 && !!a2, `${nom} : les deux achats au même titre sont montrés, chacun sa carte`);
        dit(a1 && a1.nv.length === 1 && a1.nv[0] === NV_9601, `${nom} : « Vinted : « … » » sur la carte de SON achat (9601), le texte tel quel`, a1 && a1.nv.join(' | '));
        dit(a2 && a2.nv.length === 0 && !r.nNouvelles.includes(NV_AUTRE), `${nom} : JAMAIS sur l'achat au même titre (9602), ni la ligne d'un autre compte`, a2 && a2.nv.join(' | '));
        const e64 = parSuivi('30000064')[0];
        dit(e64 && e64.nv.length === 1 && e64.nv[0] === NV_9604 && r.nNouvelles.filter((x) => x === NV_9604).length === 1, `${nom} : l'e-mail relié à la commande 9604 par le CODE de retrait porte SA nouvelle, une fois`, e64 && e64.nv.join(' | '));
        const s51 = parSuivi('30000051')[0];
        const b51 = s51 && s51.suivre[0];
        dit(b51 && b51.site === 'transporteur' && /mondialrelay\.fr\/suivi-de-colis\/\?numeroExpedition=30000051&codePostal=35260$/.test(b51.href) && /Suivre sur le site du transporteur/.test(b51.t), `${nom} : « Suivre sur le site du transporteur ↗ », n° pré-rempli, code postal LU dans le lieu`, b51 && b51.href);
        const bv = vgo && vgo.suivre[0];
        dit(bv && bv.site === 'recherche' && /q=VGS12345678061/.test(bv.href) && /Chercher ce n° de suivi/.test(bv.t), `${nom} : Vinted Go (pas de page connue) : une RECHERCHE du n°, dite comme telle`, bv && bv.href);
        const ba1 = a1 && a1.suivre[0];
        dit(ba1 && /numeroExpedition=30000057$/.test(ba1.href), `${nom} : l'achat suivi par Vinted a son bouton, sans code postal (aucun lieu lu)`, ba1 && ba1.href);
        dit(a2 && a2.suivre.length === 0, `${nom} : l'achat au même titre n'emprunte pas le n° d'un autre`);
        const tous = r.cartes.flatMap((c) => c.suivre);
        dit(tous.length >= 4 && tous.every((x) => x.h >= 43.5), `${nom} : chaque « Suivre » fait au moins 44 px`, tous.map((x) => Math.round(x.h)).join(','));
        dit(r.total === '5', `${nom} : « À retirer » compte 5 (3 e-mails + 2 achats) — les retirés n'y sont pas`, `data-n=${r.total}`);
        dit(r.etatSuivi === 'absente' && /Suivre le colis/.test(r.etatSuiviTexte), `${nom} : 1 achat sans suivi relevé : c'est DIT, avec le geste qui marche sans extension`, `${r.etatSuivi} · ${r.etatSuiviTexte.slice(0, 120)}`);
        dit(!r.deborde, `${nom} : rien ne déborde`);
        if (sombre) dit(/rgb\((\d{1,2}), (\d{1,2}), (\d{1,2})\)/.test(r.bg), `${nom} : le fond est sombre`, r.bg);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `suivi-colis-${nom.replace(/\s+/g, '-')}.png`), fullPage: true });
        dit(!errs.length, `${nom} : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
    // ── B. La ligne de suivi Vinted illisible : « pas pu lire », aucune nouvelle ──
    await essaie('B', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { suivisVinted: 'ko' });
      await ouvrir(pg, errs);
      const r = await lire(pg);
      dit(r.etatSuivi === 'passu' && /n'a pas pu être lu/.test(r.etatSuiviTexte), 'lecture du suivi Vinted ratée : « pas pu être lu » — jamais « aucun suivi »', r.etatSuivi);
      dit(r.nNouvelles.length === 0, 'aucune nouvelle de Vinted inventée');
      dit(r.cartes.some((c) => c.conv.some((h) => h.endsWith('/inbox/7601'))), 'les colis restent à l\'écran (rien n\'est perdu)');
      dit(!errs.length, 'aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
    // ── C. Ajouter un n° de suivi à la main ──
    for (const [nom, vp] of [['390', { width: 390, height: 844 }], ['1512', { width: 1512, height: 950 }]]) {
      await essaie(`C ${nom}`, async () => {
        const { ctx, pg, errs, ROWS, ecrits } = await preparer(b, vp, false);
        await ouvrir(pg, errs);
        const total0 = (await lire(pg)).total;
        await pg.locator('[data-suivi-ajouter]').click();
        await pg.locator('[data-suivi-saisie]').fill('30 000 071');
        dit(await pg.locator('[data-suivi-transporteur="mondialrelay"]').count() === 1, `C ${nom} : 8 chiffres ⇒ Mondial Relay, lu à la forme du n°`);
        await pg.locator('[data-suivi-cp]').fill('35260');
        await pg.locator('[data-suivi-enregistrer]').click();
        await pg.locator('[data-suivi-manuel="30000071"]').waitFor({ timeout: 8000 });
        const ligne = ROWS.find((x) => x.id === 'colis_suivi_mondialrelay_30000071');
        dit(ligne && ligne.data.suivi === '30000071' && ligne.data.transporteur === 'mondialrelay' && ligne.data.codePostal === '35260' && !ligne.data.tx, `C ${nom} : rangé UNE ligne par n° (colis_suivi_mondialrelay_30000071), sans achat relié`, JSON.stringify(ligne && ligne.data));
        const m = pg.locator('[data-suivi-manuel="30000071"]');
        dit((await m.getAttribute('data-suivi-etape')) === 'attente' && /Suivi ajouté — en attente d’une nouvelle/.test(await m.innerText()), `C ${nom} : « Suivi ajouté — en attente d'une nouvelle »`);
        const href = await m.locator('a[data-suivre-colis]').getAttribute('href');
        dit(/numeroExpedition=30000071&codePostal=35260$/.test(href || ''), `C ${nom} : « Suivre ↗ » avec le code postal qu'il a donné`, href);
        dit((await lire(pg)).total === total0, `C ${nom} : JAMAIS « à retirer » (le compte ne bouge pas)`, `${total0}`);
        // Un n° à la forme ambiguë : on DEMANDE le transporteur.
        await pg.locator('[data-suivi-ajouter]').click();
        await pg.locator('[data-suivi-saisie]').fill('09440000000072');
        dit(await pg.locator('[data-suivi-transporteur="a-choisir"]').count() === 1, `C ${nom} : forme ambiguë ⇒ « Quel transporteur ? »`);
        await pg.locator('[data-suivi-enregistrer]').click();
        dit(/Choisis le transporteur/.test(await pg.locator('[data-suivi-msg]').first().innerText()) && !ecrits.some((x) => /09440000000072/.test(x)), `C ${nom} : rien n'est rangé tant qu'il n'a pas choisi`);
        await pg.locator('[data-suivi-choix="chronopost"]').click();
        await pg.locator('[data-suivi-enregistrer]').click();
        await pg.locator('[data-suivi-manuel="09440000000072"]').waitFor({ timeout: 8000 });
        dit(ROWS.some((x) => x.id === 'colis_suivi_chronopost_09440000000072'), `C ${nom} : son choix est rangé (colis_suivi_chronopost_…)`);
        // Un n° déjà connu par e-mail : la ligne le DIT (jamais une preuve d'arrivée inventée).
        await pg.locator('[data-suivi-ajouter]').click();
        await pg.locator('[data-suivi-saisie]').fill('30000051');
        await pg.locator('[data-suivi-enregistrer]').click();
        await pg.locator('[data-suivi-manuel="30000051"]').waitFor({ timeout: 8000 });
        dit((await pg.locator('[data-suivi-manuel="30000051"]').getAttribute('data-suivi-etape')) === 'nouvelle', `C ${nom} : un n° que les e-mails connaissent dit leur dernière nouvelle`);
        // Relier à un achat : SON clic seulement.
        await pg.locator('[data-suivi-relier="30000071"]').click();
        await pg.locator('[data-suivi-achat="9602"]').click();
        await pg.locator('[data-suivi-lie="9602"]').waitFor({ timeout: 8000 });
        const lie = ROWS.find((x) => x.id === 'colis_suivi_mondialrelay_30000071');
        dit(lie && lie.data.tx === '9602' && lie.data.uid === '111', `C ${nom} : relié à l'achat qu'il a CHOISI (transaction + compte)`, JSON.stringify(lie && lie.data));
        const a2 = (await lire(pg)).cartes.find((c) => c.conv.some((h) => h.endsWith('/inbox/7602')));
        dit(a2 && a2.suivre.some((x) => /numeroExpedition=30000071/.test(x.href)), `C ${nom} : l'achat relié a maintenant son « Suivre ↗ »`);
        dit(!errs.length, `C ${nom} : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { await b.close(); }
}

// ── D. Le cron du matin, la vraie route : « 📍 Dernier jour » une fois ──────────
async function cronDuMatin() {
  const A = SESSION.user.id;
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service'; process.env.VRM_OWNER_UID = A; process.env.CRON_SECRET = 'cle-banc-cron'; process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
  const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
  const pushes = []; webpush.setVapidDetails = () => {}; webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const base = new Map([
    ['main', { vrm_colis_collected: [] }], ['push_subs', { subs: [{ endpoint: 'https://web.push.apple.com/banc' }] }], ['push_prefs', { colis: true }],
    ['email_track_mondialrelay_30000081', { status: 'available', suivi: '30000081', carrier: 'mondialrelay', subject: 'Votre colis 30000081 est disponible 📦', receivedAt: j(2), arriveLe: j(2), limite: null, lieu: 'Bar Banc, 5 Rue Exemple, 35260 Cancale' }],
    ['email_track_mondialrelay_30000082', { status: 'available', suivi: '30000082', carrier: 'mondialrelay', subject: 'Votre colis 30000082 est disponible 📦', receivedAt: j(2), arriveLe: j(2), limite: null, lieu: 'Bar Banc, 5 Rue Exemple, 35260 Cancale' }],
    ['email_track_vinted_bb1', { status: 'delivered', suivi: '', carrier: 'vinted', subject: 'Ton colis a été retiré #30000082', receivedAt: j(0.3) }],
  ]);
  const metaDe = (d) => { const m = {}; for (const [k, v] of Object.entries(d || {})) if (v != null && typeof v !== 'object' && String(v).length <= 600) m[k] = String(v); return m; };
  const val = (id, d, k) => k === 'id' ? id : k === 'owner' ? A : k.startsWith('meta->>') ? metaDe(d)[k.slice(7)] : undefined;
  const ok = (x, op) => { const i = op.indexOf('.'), o = op.slice(0, i), v = op.slice(i + 1); if (o === 'eq') return x === v; if (o === 'like') return x != null && new RegExp('^' + v.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$').test(x); if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').includes(x); return true; };
  const vraiFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url)); const m = (opts.method || 'GET').toUpperCase();
    const rep = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    if (m === 'POST') { for (const r of JSON.parse(opts.body || '[]')) base.set(r.id, r.data); return new Response('', { status: 201 }); }
    if (m !== 'GET') return rep([]);
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
    const conds = [...u.searchParams].filter(([k]) => !['select', 'limit', 'order', 'offset', 'on_conflict'].includes(k));
    const lignes = [...base.entries()].filter(([id, d]) => conds.every(([k, v]) => ok(val(id, d, k), v)));
    return rep(lignes.map(([id, d]) => {
      if (!sel || sel === 'data' || sel === '*') return { id, owner: A, data: d };
      const o = {};
      for (const part of sel.split(',')) { const [al, ch] = part.includes(':') ? part.split(/:(.+)/) : [part, part];
        if (ch === 'id' || ch === 'owner') o[al] = ch === 'id' ? id : A; else if (ch === 'data') o[al] = d; else if (ch.startsWith('meta->>')) o[al] = metaDe(d)[ch.slice(7)] ?? null;
        else { let x = d; for (const s of ch.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? undefined : x[s]; o[al] = x === undefined ? null : x; } }
      return o;
    }));
  };
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  base.get('email_track_mondialrelay_30000081').limite = auj; base.get('email_track_mondialrelay_30000082').limite = auj;
  try {
    const cron = (await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'))).default;
    const lancer = async () => { const r = { code: 0 }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; r.send = () => r; await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); return r; };
    await lancer();
    const d1 = pushes.filter((p) => /^📍 Dernier jour pour retirer/.test(p.title || ''));
    dit(d1.length === 1 && /30000081/.test(d1[0].body || ''), 'cron du matin : « 📍 Dernier jour pour retirer » part pour le colis dont la limite LUE est aujourd\'hui', JSON.stringify(d1.map((p) => p.body)));
    dit(!pushes.some((p) => /30000082/.test(`${p.title} ${p.body}`)), 'cron du matin : rien pour le colis retiré sous une autre clé (n° du sujet)');
    const n = pushes.length; await lancer();
    dit(pushes.length === n, 'cron du matin relancé le même jour : rien de plus (une fois par colis)');
  } finally { global.fetch = vraiFetch; }
}

(async () => {
  srv.listen(PORT);
  try {
    await navigateur();
    await essaie('D', cronDuMatin);
  } finally { srv.close(); }
  console.log(ko ? `\n❌ suivi des colis : ${ko} rouge(s).` : '\n✅ suivi des colis : tout est vert');
  process.exit(ko ? 1 : 0);
})();
