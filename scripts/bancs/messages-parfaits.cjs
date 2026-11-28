#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MESSAGES PARFAITS » (28 nov.) — la vraie app (dist/), un faux Supabase à état (_e2e-monde.cjs), une FAUSSE
//  extension qui répond au pont (postMessage `__vmr`), une base INVENTÉE : deux comptes Vinted (boutique_a dans l'onglet,
//  atelier_b), des conversations avec et sans photo de profil (et l'image « pas de photo » de Vinted), une offre de 70 € sur
//  une paire affichée 85 € (prix mini 50 €), un fil Leboncoin. Trois extensions :
//    · « a-jour »   5.455.7, boutique_a dans l'onglet      ⇒ statut « ok » ; gestes ALLUMÉS (Accepter confirmé, Autre prix
//                   sous le plancher seulement forcé + confirmé, Envoyer) ⇒ des commandes `cmd_dist_*` au nom de boutique_a ;
//    · « ancienne » 5.430.0 (sait le panneau, pas la file)  ⇒ statut « différente » ; les gestes mènent au PANNEAU de
//                   l'extension sur CETTE conversation (`?vrm=panneau&page=messages&ids=…`), rien n'est déposé ;
//    · « absente »  aucune                                  ⇒ statut « pas joignable » ; lecture seule, rien ne part.
//  À 390 (tactile) et 1512, clair et sombre. Jugé sur les data-* et la BASE ; temps mesurés DANS la page (MutationObserver) :
//  la liste (1re visite, puis la copie instantanée au retour), l'aperçu du fil, le fil lisible (1re bulle).
//    node scripts/bancs/messages-parfaits.cjs              (après npm run build ; BANC_DIST=… pour un autre build)
//    BANC_CAPTURE=/tmp/x node scripts/bancs/messages-parfaits.cjs
//    BANC_PORT=4861 …   (4860–4869)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4861;
const DIST = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const COURT = process.argv.includes('--court');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 600) : ''}`); } };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mparf-'));
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const A = '41000001', B = '41000002';
const C1 = '7300001', C2 = '7300002', C3 = '7300003', CB = '7300101', TX1 = '8800001', OID1 = '9900001', ITEM1 = 91010001;
const AV = (n) => `https://images1.vinted.net/t/av-${n}/f800/profil.jpeg?s=banc`;
const NUMEROS = { [String(ITEM1)]: { numero: '124', min: '50', buyPrice: '40' } };
let M;

function semer() {
  const t = Date.now(), iso = (ms) => new Date(ms).toISOString(), ts = (min) => Math.round((t - min * 60000) / 1000);
  const app = M.st.tables.app_data = (M.st.tables.app_data || []).filter((r) => !/^(presence_|cmd_dist_|harvest_|ext_appareil_|lbc_)/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: A, login: 'boutique_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: B, login: 'atelier_b', domain: 'www.vinted.fr', owner: U.id }];
  const inbox = (u, convs) => app.push({ id: `harvest_${u}_inbox`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'inbox', domain: 'www.vinted.fr', nItems: convs.length, capturedAt: iso(t - 60000), payload: { conversations: convs, pagination: {} } } });
  inbox(A, [
    { id: Number(C1), unread: true, updated_at: iso(t - 4 * 60000), description: 'Elle taille grand ? Je fais du 42', opposite_user: { id: 5001, login: 'acheteuse_lea', photo: { url: AV('lea') } }, item_photos: [] },
    { id: Number(C2), unread: false, updated_at: iso(t - 50 * 60000), description: 'Merci, bien reçu !', opposite_user: { id: 5002, login: 'marc_92', photo: { url: 'https://static.vinted.com/assets/no-photo/user-clothing/system-photo/default.png', width: 100, height: 100, thumbnails: [] } }, item_photos: [] },
    { id: Number(C3), unread: false, updated_at: iso(t - 300 * 60000), description: 'Vous faites un prix pour deux ?', opposite_user: { id: 5003, login: 'zoe.k' }, item_photos: [] },
  ]);
  inbox(B, [{ id: Number(CB), unread: true, updated_at: iso(t - 20 * 60000), description: 'Toujours dispo ?', opposite_user: { id: 5004, login: 'hugo_sneak', photo: { url: AV('hugo') } }, item_photos: [] }]);
  const fil = (u, conv, opp, messages, tx, item) => app.push({ id: `harvest_${u}_conv_${conv}`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'conv', capturedAt: iso(t - 60000),
    payload: { conversation: { id: Number(conv), allow_reply: true, opposite_user: opp, transaction: tx ? { id: Number(tx), item_id: item } : null, messages } } } });
  fil(A, C1, { id: 5001, login: 'acheteuse_lea', photo: { url: AV('lea') } }, [
    { entity_type: 'message', created_at_ts: ts(30), entity: { id: 1, body: 'Bonjour, la Nike P-6000 est toujours dispo ?', user_id: 5001 } },
    { entity_type: 'message', created_at_ts: ts(26), entity: { id: 2, body: 'Bonjour ! Oui, toujours disponible.', user_id: Number(A) } },
    { entity_type: 'offer_request_message', created_at_ts: ts(5), entity: { offer_request_id: Number(OID1), transaction_id: Number(TX1), status: 10, current: true, price: { amount: '70.0', currency_code: 'EUR' }, user_id: 5001, status_title: 'En attente' } },
    { entity_type: 'message', created_at_ts: ts(4), entity: { id: 3, body: 'Elle taille grand ? Je fais du 42', user_id: 5001 } },
  ], TX1, ITEM1);
  fil(A, C2, { id: 5002, login: 'marc_92' }, [{ entity_type: 'message', created_at_ts: ts(50), entity: { id: 4, body: 'Merci, bien reçu !', user_id: 5002 } }]);
  fil(A, C3, { id: 5003, login: 'zoe.k' }, [{ entity_type: 'message', created_at_ts: ts(300), entity: { id: 5, body: 'Vous faites un prix pour deux ?', user_id: 5003 } }]);
  fil(B, CB, { id: 5004, login: 'hugo_sneak', photo: { url: AV('hugo') } }, [{ entity_type: 'message', created_at_ts: ts(20), entity: { id: 6, body: 'Toujours dispo ?', user_id: 5004 } }]);
  const item = (id, title, prix) => ({ id: Number(id), title, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, is_hidden: false, is_closed: false, is_draft: false, is_reserved: false, photo: { url: 'https://images1.vinted.net/t/' + id + '/f800/photo.jpeg' } });
  for (const u of [A, B]) app.push({ id: `harvest_${u}_listings`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'listings', nItems: 1, capturedAt: iso(t - 2 * 60000), payload: { code: 0, pagination: {}, items: u === A ? [item(ITEM1, 'Nike P-6000 noire', 85)] : [item(91020002, 'Adidas Samba blanche', 60)] } } });
  // Leboncoin : un fil (scalaires `meta->>`), son compte nommé.
  app.push({ id: 'lbc_fil_lbc-conv-1', owner: U.id, updated_at: iso(t), data: { n: 2, dernierAt: iso(t - 90 * 60000), apercu: 'Bonjour, encore disponible ?', dernierDeMoi: false, compte: 'lbc-account:7771', messages: [{ t: 'Bonjour, encore disponible ?', at: iso(t - 90 * 60000), deMoi: false }] } });
  app.push({ id: 'lbc_messages', owner: U.id, updated_at: iso(t), data: { comptes: { 7771: { name: 'Julie (Leboncoin)' } } } });
}
const commandes = () => (M.st.tables.app_data || []).filter((r) => /^cmd_dist_/.test(r.id)).map((r) => r.data || {});

// La fausse extension : `ping` ⇒ ready, `etat` ⇒ son état (compte de l'onglet), `exec GET` d'une conversation ⇒ la conversation
// (600 ms : l'aller-retour à vinted.fr), toute écriture refusée (l'app n'en envoie aucune : elle dépose des commandes).
const PONT = ({ version, uid, login, convs }) => {
  window.__pont = { exec: [], etats: 0 };
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') { window.__pont.etats++; post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: uid ? { uid, login } : null, cmds: {} } }); }
    if (d.__vmr === 'exec') {
      window.__pont.exec.push(d.method + ' ' + d.endpoint);
      const m = /^\/api\/v2\/conversations\/(\d+)$/.exec(String(d.endpoint || ''));
      const c = d.method === 'GET' && m ? convs[m[1]] : null;
      setTimeout(() => post(c ? { __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: { conversation: c } } : { __vmr: 'result', reqId: d.reqId, ok: false, status: 0, data: null }), 600);
    }
  });
  post({ __vmr: 'ready', version });
};
// Les temps, mesurés DANS la page depuis le début de la navigation.
const TEMPS = () => {
  window.__t = {};
  const voir = () => {
    const t = Math.round(performance.now()), T = window.__t;
    if (T.copie == null && document.querySelector('[data-copie-ecran="messages"]')) T.copie = t;
    if (T.liste == null && document.querySelector('[data-fils-tous] button[data-fil]')) T.liste = t;
    if (T.clic != null && T.apercu == null && document.querySelector('.vrm-chat-panel [data-fil-apercu], .vrm-chat-panel .vrm-bulle')) T.apercu = t;
    if (T.clic != null && T.bulle == null && document.querySelector('.vrm-chat-panel .vrm-chat-history .vrm-bulle')) T.bulle = t;
  };
  new MutationObserver(voir).observe(document, { subtree: true, childList: true, attributes: true });
};

async function contexte(nav, { mobile, sombre, ext }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true, serviceWorkers: 'block', colorScheme: sombre ? 'dark' : 'light' },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  // Les photos de profil : deux images de couleur (la photo de Léa, celle d'Hugo) ; le reste, le gris du monde.
  await ctx.route(/images1\.vinted\.net\/t\/av-/, (r) => { const lea = /av-lea/.test(r.request().url());
    r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${lea ? '#7FA7C9' : '#9DBF8E'}"/><circle cx="48" cy="38" r="18" fill="#fff" opacity=".85"/><rect x="18" y="62" width="60" height="34" rx="17" fill="#fff" opacity=".85"/></svg>` }); });
  const s = M.ouvrir(M.USERS.get(U.email));
  const convs = {};
  for (const r of M.st.tables.app_data) { const m = /^harvest_(\d+)_conv_(\d+)$/.exec(r.id); if (m) convs[m[2]] = r.data.payload.conversation; }
  await ctx.addInitScript(({ s, uid, sombre, numeros }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(numeros)); } } catch (_) {}
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre, numeros: NUMEROS });
  await ctx.addInitScript(TEMPS);
  const V = { 'a-jour': { version: '5.455.7', uid: A, login: 'boutique_a' }, ancienne: { version: '5.430.0', uid: A, login: 'boutique_a' }, absente: { version: '' } }[ext];
  await ctx.addInitScript(PONT, { ...V, convs });
  return ctx;
}
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); } catch (_) {} };
const attendreQue = async (pg, f, arg, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await pg.evaluate(f, arg).catch(() => null); if (v) return v; await attendre(300); } return null; };

function lireListe() {
  const rows = [...document.querySelectorAll('[data-fils-tous] button[data-fil]')];
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return {
    rows: rows.filter(vis).map((b) => ({ fil: b.getAttribute('data-fil'), tuile: (b.querySelector('[data-fil-tuile]') || {}).getAttribute ? b.querySelector('[data-fil-tuile]').getAttribute('data-fil-tuile') : null,
      img: !!b.querySelector('.vrm-av img'), ini: ((b.querySelector('.vrm-av-ini') || {}).textContent || '').trim(), bulle: !!b.querySelector('[data-n-glyphe="chat"], .n-tuile-paire') })),
    selects: document.querySelectorAll('select[data-msg-action], select[data-msg-site], [data-fils-tous] select').length,
    puces: [...document.querySelectorAll('[data-fp="messages"] [data-fp-site]')].map((x) => x.getAttribute('data-fp-site')),
    compte: !!document.querySelector('[data-msg-filtre-compte] button[data-tt-ouvre="filtre:compte"]'),
    statut: (() => { const s = document.querySelector('[data-msg-statut]'); return s ? { etat: s.getAttribute('data-msg-statut'), code: s.getAttribute('data-msg-statut-code'), compte: s.getAttribute('data-msg-statut-compte'), at: s.getAttribute('data-msg-statut-at'), texte: s.innerText } : null; })(),
    onglet: [...document.querySelectorAll('[data-msg-groupe-onglet="1"]')].map((g) => g.getAttribute('data-msg-groupe')),
    pageDeb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}
async function ouvrirFil(pg, conv) {
  await pg.evaluate((c) => { window.__t.clic = Math.round(performance.now()); window.__t.apercu = null; window.__t.bulle = null; const b = [...document.querySelectorAll('[data-fils-tous] button[data-fil]')].find((x) => x.getAttribute('data-fil').endsWith(':' + c)); if (b) b.click(); }, conv);
  return attendreQue(pg, () => document.querySelector('.vrm-chat-panel .vrm-chat-history .vrm-bulle') ? true : null, null, 20000);
}

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ pas de build dans ${DIST}`); process.exit(1); }
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  console.log(`app ${DIST}`);
  const temps = [];
  try {
    const formes = COURT ? [[false, false]] : [[true, false], [true, true], [false, false], [false, true]];
    for (const [mobile, sombre] of formes) {
      const nom = `${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      for (const ext of ['a-jour', 'ancienne', 'absente']) {
        console.log(`\n── ${nom} · extension ${ext}`);
        semer();
        const ctx = await contexte(nav, { mobile, sombre, ext }); const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
        await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
        await attendreQue(pg, () => document.querySelectorAll('[data-fils-tous] button[data-fil]').length >= 5 ? true : null);
        const attenduStatut = { 'a-jour': 'ok', ancienne: 'ecart', absente: 'injoignable' }[ext];
        await attendreQue(pg, (e) => { const s = document.querySelector('[data-msg-statut]'); return s && s.getAttribute('data-msg-statut') === e ? true : null; }, attenduStatut, 25000);
        await attendre(1200);
        const L = await pg.evaluate(lireListe);
        const t1 = await pg.evaluate(() => window.__t.liste);
        await photo(pg, `liste-${ext}-${nom}`);

        // 1. La photo de profil
        const parFil = Object.fromEntries(L.rows.map((r) => [r.fil, r]));
        const r1 = parFil[`vinted:${A}:${C1}`], r2 = parFil[`vinted:${A}:${C2}`], r3 = parFil[`vinted:${A}:${C3}`], rb = parFil[`vinted:${B}:${CB}`];
        dit(r1 && r1.tuile === 'avatar' && r1.img && rb && rb.tuile === 'avatar' && rb.img, `${nom} ${ext} : la photo de profil de Léa et d'Hugo sur leur rangée`, JSON.stringify({ r1, rb }));
        dit(r2 && r2.tuile === 'initiale' && r2.ini === 'M' && r3 && r3.tuile === 'initiale' && r3.ini === 'Z', `${nom} ${ext} : sans photo (et « pas de photo » de Vinted) ⇒ l'initiale (M, Z)`, JSON.stringify({ r2, r3 }));
        dit(L.rows.length >= 5 && L.rows.every((r) => !r.bulle), `${nom} ${ext} : plus aucune bulle générique sur les rangées`, JSON.stringify(L.rows.map((r) => r.bulle)));
        // 3. La sélection Site + Compte native
        dit(L.selects === 0, `${nom} ${ext} : plus de « Choisir une action ▾ » ni de liste « Vinted ▾ »`, L.selects);
        dit(L.puces.join(',') === 'toutes,vinted,leboncoin' && L.compte, `${nom} ${ext} : le filtre Site (puces Toutes · Vinted · Leboncoin) et le bouton « Compte » des autres onglets`, JSON.stringify({ p: L.puces, c: L.compte }));
        dit(L.pageDeb <= 0, `${nom} ${ext} : aucun débordement`, L.pageDeb);
        // 5. Le statut
        const S = L.statut || {};
        if (ext === 'a-jour') dit(S.etat === 'ok' && S.compte === A && Number(S.at) > 0 && /boutique_a/.test(S.texte) && /vérifié à/.test(S.texte), `${nom} : statut « Extension connectée · à jour · boutique_a », daté`, JSON.stringify(S));
        if (ext === 'ancienne') dit(S.etat === 'ecart' && S.code === 'maj' && /différente/.test(S.texte), `${nom} : statut « connectée, mais différente » (5.430 < 5.455.7)`, JSON.stringify(S));
        if (ext === 'absente') dit(S.etat === 'injoignable' && !S.compte, `${nom} : statut « pas joignable »`, JSON.stringify(S));
        dit(ext === 'a-jour' ? L.onglet.join() === `vinted:${A}` : L.onglet.length === 0, `${nom} ${ext} : « Compte de l'onglet » seulement quand le statut est « ok » (une seule règle)`, JSON.stringify(L.onglet));

        // Filtre : Leboncoin seul, puis Toutes ; Compte : atelier_b seul.
        await pg.click('[data-fp="messages"] [data-fp-site="leboncoin"]').catch(() => {});
        await attendre(500);
        const fl = await pg.evaluate(() => [...document.querySelectorAll('[data-fils-tous] button[data-fil]')].map((b) => b.getAttribute('data-fil-sites')));
        dit(fl.length === 1 && fl[0] === 'leboncoin', `${nom} ${ext} : la puce Leboncoin ne montre que le fil Leboncoin`, JSON.stringify(fl));
        await pg.click('[data-fp="messages"] [data-fp-site="toutes"]').catch(() => {});
        await attendre(300);
        await pg.click('[data-msg-filtre-compte] button[data-tt-ouvre="filtre:compte"]').catch(() => {});
        await attendre(500);
        await pg.click(`[data-tt-filtre-choix="compte:vinted:${B}"]`).catch(() => {});
        await attendre(500);
        const fc = await pg.evaluate(() => [...document.querySelectorAll('[data-fils-tous] [data-msg-groupe]')].map((g) => g.getAttribute('data-msg-groupe')));
        dit(fc.join() === `vinted:${B}`, `${nom} ${ext} : « Compte » atelier_b ne montre que ses fils`, JSON.stringify(fc));
        await pg.click('[data-msg-filtre-compte] button[data-tt-ouvre="filtre:compte"]').catch(() => {});
        await attendre(400);
        await pg.click('[data-tt-filtre-choix="compte:tous"]').catch(() => {});
        await attendre(500);

        // 2. Le fil : l'aperçu tout de suite, puis lisible ; l'en-tête porte la photo.
        const lu = await ouvrirFil(pg, C1);
        await attendre(1500);
        const tf = await pg.evaluate(() => ({ ...window.__t, mesures: window.__vrmMesuresFil || null }));
        const tete = await pg.evaluate(() => { const a = document.querySelector('.vrm-chat-panel [data-fil-avatar]'); return a ? { a: a.getAttribute('data-fil-avatar'), img: !!a.querySelector('img') } : null; });
        dit(lu && tete && tete.a === 'photo' && tete.img, `${nom} ${ext} : le fil s'ouvre et son en-tête porte la photo de Léa`, JSON.stringify({ lu, tete }));
        temps.push({ forme: nom, ext, liste: t1, apercu: tf.apercu != null ? tf.apercu - tf.clic : null, bulle: tf.bulle != null ? tf.bulle - tf.clic : null, actualise: tf.mesures && tf.mesures.actualise });
        dit(tf.bulle != null && tf.bulle - tf.clic < 2500, `${nom} ${ext} : fil lisible en ${tf.bulle != null ? tf.bulle - tf.clic : '—'} ms (avant l'aller-retour de l'extension)`, JSON.stringify(tf));
        await photo(pg, `fil-${ext}-${nom}`);

        // 4. Les gestes
        const g = await pg.evaluate(() => ({ composer: (document.querySelector('[data-agir-composer="vinted"]') || {}).getAttribute ? document.querySelector('[data-agir-composer="vinted"]').getAttribute('data-agir') : null,
          offre: [...document.querySelectorAll('[data-agir-offre] [data-agir]')].map((x) => x.getAttribute('data-agir')), panneau: [...document.querySelectorAll('[data-mp-panneau-ouvrir]')].length,
          autre: !!document.querySelector('[data-agir-autre-prix]') }));
        if (ext === 'a-jour') {
          dit(g.composer === 'ok' && g.offre.length >= 2 && g.offre.every((x) => x === 'ok') && g.autre && g.panneau === 0, `${nom} : extension à jour ⇒ Répondre, Accepter / Refuser et « Autre prix » ALLUMÉS dans l'app`, JSON.stringify(g));
          // Accepter : la confirmation d'abord.
          await pg.click('[data-agir-accepter]').catch(() => {});
          const f = await attendreQue(pg, () => !!document.querySelector('[data-agir-accepter-confirmer]') || null, null, 8000);
          dit(f && !commandes().some((c) => c.geste === 'accepter'), `${nom} : Accepter ouvre la confirmation (« accepter vend la paire »), rien n'est parti`, JSON.stringify(commandes()));
          await photo(pg, `accepter-confirmer-${nom}`);
          await pg.click('[data-agir-accepter-confirmer]').catch(() => {});
          await attendre(4500);
          const acc = commandes().filter((c) => c.geste === 'accepter');
          dit(acc.length === 1 && acc[0].compte === A && acc[0].args && String(acc[0].args.oid) === OID1, `${nom} : « Oui, accepter » ⇒ UNE commande accepter au nom de boutique_a pour CETTE offre`, JSON.stringify(acc));
          // Autre prix sous le plancher (mini 50 €) : bloqué, puis forcé + confirmé.
          await pg.click('[data-agir-autre-prix]').catch(() => {});
          await attendre(400);
          await pg.fill('[data-agir-contre-saisi]', '45').catch(() => {});
          await attendre(400);
          const c0 = await pg.evaluate(() => { const b = document.querySelector('[data-agir-contre-envoyer]'); const z = document.querySelector('[data-agir-contre-autre]'); return { code: z && z.getAttribute('data-agir-contre-autre'), bloque: b && b.getAttribute('aria-disabled'), forcer: !!document.querySelector('[data-agir-contre-forcer]') }; });
          await pg.click('[data-agir-contre-envoyer]').catch(() => {});
          await attendre(800);
          dit(c0.code === 'sousPlancher' && c0.bloque === 'true' && c0.forcer && !commandes().some((c) => c.geste === 'contreOffre') && !(await pg.$('[data-agir-contre-confirmer]')), `${nom} : 45 € sous le plancher (50 €) ⇒ bouton éteint, rien ne part sans la case`, JSON.stringify(c0));
          await photo(pg, `autre-prix-sous-plancher-${nom}`);
          await pg.check('[data-agir-contre-forcer]').catch(() => {});
          await pg.click('[data-agir-contre-envoyer]').catch(() => {});
          const fc2 = await attendreQue(pg, () => !!document.querySelector('[data-agir-contre-confirmer]') || null, null, 6000);
          dit(fc2 && !commandes().some((c) => c.geste === 'contreOffre'), `${nom} : la case cochée ⇒ une confirmation d'abord, rien n'est parti`);
          await pg.click('[data-agir-contre-confirmer]').catch(() => {});
          await attendre(4500);
          const co = commandes().filter((c) => c.geste === 'contreOffre');
          dit(co.length === 1 && co[0].compte === A && Number(co[0].args.prix) === 45 && String(co[0].args.tx) === TX1, `${nom} : confirmée ⇒ UNE contre-offre de 45 € au nom de boutique_a`, JSON.stringify(co));
          // Envoyer un message.
          await pg.fill('[data-agir-composer="vinted"] textarea', 'Elle taille normalement, prenez votre pointure.').catch(() => {});
          await pg.click('[data-agir-composer="vinted"] [data-agir-envoyer]').catch(() => {});
          await attendre(4500);
          const rep = commandes().filter((c) => c.geste === 'repondre');
          dit(rep.length === 1 && rep[0].compte === A && String(rep[0].args.conv) === C1, `${nom} : Envoyer ⇒ UNE commande repondre au nom de boutique_a, pour CETTE conversation`, JSON.stringify(rep));
          dit(!commandes().some((c) => c.compte === B), `${nom} : rien au nom d'atelier_b`);
          await photo(pg, `gestes-envoyes-${nom}`);
        } else if (ext === 'ancienne') {
          dit(g.composer === 'lecture' && g.panneau >= 2, `${nom} : extension qui ne sait pas recevoir le geste ⇒ « Répondre / Répondre à l'offre dans l'extension »`, JSON.stringify(g));
          const [nouv] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), pg.click('[data-mp-panneau="offre"] [data-mp-panneau-ouvrir]').catch(() => {})]);
          const url = nouv ? nouv.url() : '';
          const dite = await attendreQue(pg, () => !!document.querySelector('[data-mp-panneau-dit]') || null, null, 4000);
          dit(/www\.vinted\.fr\/\?vrm=panneau&page=messages&ids=7300001&action=offre/.test(url) && dite && commandes().length === 0, `${nom} : le panneau de l'extension s'ouvre sur CETTE conversation (offre), c'est dit, rien n'est déposé`, JSON.stringify({ url, dite, n: commandes().length }));
          if (nouv) await nouv.close().catch(() => {});
          await photo(pg, `panneau-${nom}`);
        } else {
          dit(g.composer === 'lecture' && g.panneau === 0 && g.offre.every((x) => x === 'lecture'), `${nom} : sans extension ⇒ lecture seule (rien d'allumé, pas de panneau promis)`, JSON.stringify(g));
          await pg.evaluate(() => { for (const s of ['[data-agir-accepter]', '[data-agir-refuser]', '[data-agir-envoyer]']) { const b = document.querySelector(s); if (b) b.click(); } });
          await attendre(1500);
          dit(commandes().length === 0, `${nom} : toucher les gestes éteints ⇒ rien ne part`, JSON.stringify(commandes()));
        }
        dit(erreurs.length === 0, `${nom} ${ext} : aucune erreur de page`, erreurs.join(' | '));

        // La copie instantanée : au retour sur Messages, la liste est là avant la lecture.
        if (ext === 'a-jour') {
          await pg.goto('https://vrm.center/?tab=journee', { waitUntil: 'domcontentloaded' }).catch(() => {});
          await attendre(2500);
          await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
          await attendreQue(pg, () => document.querySelector('[data-fils-tous] button[data-fil]') ? true : null);
          const t2 = await pg.evaluate(() => window.__t);
          temps.push({ forme: nom, ext: 'retour', liste: t2.liste, copie: t2.copie });
          dit(t2.liste != null, `${nom} : au retour, la liste en ${t2.liste} ms${t2.copie != null ? ` (copie peinte à ${t2.copie} ms)` : ''}`, JSON.stringify(t2));
        }
        await ctx.close();
      }
    }
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log('\nTemps (ms depuis la navigation ; fil : depuis le toucher) :');
  for (const t of temps) console.log(`  ${t.forme.padEnd(12)} ${t.ext.padEnd(9)} liste ${t.liste ?? '—'}${t.copie != null ? ` · copie ${t.copie}` : ''}${t.apercu != null ? ` · aperçu du fil ${t.apercu}` : ''}${t.bulle != null ? ` · fil lisible ${t.bulle}` : ''}${t.actualise != null ? ` · actualisé par l'extension ${t.actualise}` : ''}`);
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
