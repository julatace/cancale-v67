require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MA JOURNÉE HORS LIGNE » (21 octobre)
//
//  Au point relais sans 4G, dans le métro : ouvrir VRM sans réseau doit montrer
//  Ma journée telle qu'à la dernière ouverture RÉUSSIE — colis à expédier, colis
//  à retirer AVEC leurs codes et QR, la liste du soir — en lecture seule, avec
//  UNE ligne « Hors ligne — ce que tu vois date de {heure} ; rien ne peut être
//  envoyé ». Jamais « Tout est à jour » hors ligne.
//
//  Trois scénarios, aux deux tailles (390 tactile, 1512) :
//   A. lecture COMPLÈTE en ligne → photo écrite → hors ligne (jeton EXPIRÉ) :
//      la photo s'affiche, le QR vient de la réserve du service worker, aucun
//      geste actif, pas de déconnexion ; le réseau revient → la ligne disparaît ;
//   B. lecture PARTIELLE (les emails de suivi — les codes — ne répondent pas) → aucune photo → hors
//      ligne : « aucune copie », rien de fêté ;
//   C. un AUTRE vendeur a laissé une photo sur l'appareil (sa clé, et une clé
//      au bon nom dont le contenu le nomme) → hors ligne : rien de lui n'est
//      servi.
//  Aucune fixture : tout est inventé (le banc vit dans le dépôt).
//  Lancer : node scripts/bancs/hors-ligne.cjs   (BANC_PORT pour changer le port)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { servir } = require('./_minipgrest.cjs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4961;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.onnx': 'application/octet-stream' };

const UID_A = '11111111-2222-3333-4444-555555555555';
const UID_B = '99999999-8888-7777-6666-555555555555';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID_A, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID_A, email: 'vendeuse@exemple.fr' }, totp: [] };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', owner: UID_A, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
const QR_URL = 'https://qr.exemple.test/api/barcode/AztecCode?d=PICKUPPASS:BANC';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAHUlEQVR4nGNgYGD4z8DAwMDAxMDAwMDAwMDAwMAAAxQAAXy7tqQAAAAASUVORK5CYII=', 'base64');

const maintenant = new Date();
const iso = (ms) => new Date(ms).toISOString();
const jour = (d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const ligne = (id, data) => ({ id, owner: UID_A, data, meta: meta(data), updated_at: iso(Date.now()) });

const VENTE = { transaction_id: 70001, title: 'Nike Air Max 1 banc', status: 'Le paiement a été validé', transaction_user_status: 'needs_action',
  price: { amount: '60.0', currency_code: 'EUR' }, date: iso(Date.now() - 2 * 864e5) };
const TRACK = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: 'Tabac du Port Cancale', carrier: 'mondial_relay',
  suivi: 'MR999000111', artTitle: '', qrUrl: QR_URL, receivedAt: iso(Date.now() - 3600e3), limite: jour(5) };
const ROWS = [
  ligne('main', {}),
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_sold`, { capturedAt: iso(Date.now()), payload: { my_orders: [VENTE] } }),
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_purchased`, { capturedAt: iso(Date.now()), payload: { my_orders: [] } }),
  ligne('email_track_mondial_relay_MR999000111', TRACK),
  ligne('panel_colis_relais', {}),
];

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

// Un faux Supabase / API / hôte du QR, posé sur le CONTEXTE (il voit aussi les
// requêtes du service worker). `etat.hors` : tout échoue (comme hors ligne).
async function brancher(ctx, etat) {
  const json = (route, d, extra) => route.fulfill({ status: 200, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: JSON.stringify(d) });
  await ctx.route(/supabase\.co\/rest\/v1\//, (route) => {
    if (etat.hors) return route.abort('internetdisconnected');
    const req = route.request(); const u = req.url(); const h = req.headers();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (etat.baseKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (/select=owner/.test(u) && !/rpc/.test(u)) return json(route, []);
    if (req.method() !== 'GET') return json(route, []);
    if (!String(h.authorization || '').includes(JETON)) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(route, [COMPTE]);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    if (etat.suiviKO && /email_track/.test(decodeURIComponent(u))) return route.fulfill({ status: 502, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>502</html>' });
    const r = servir(ROWS, u, h);
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/supabase\.co\/auth\/v1\//, (route) => {
    if (etat.hors) return route.abort('internetdisconnected');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
  });
  await ctx.route(/\/api\//, (route) => etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(/qr\.exemple\.test/, (route) => { etat.qrServis = (etat.qrServis || 0) + 1; return etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await ctx.route(/vinted\.net|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs/, (route) => route.abort());
}

async function ouvrirEnLigne(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
  if (!(await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)))) await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
}
const photoDe = (pg, uid) => pg.evaluate((u) => { try { return JSON.parse(localStorage.getItem('vrm_hl_photo_' + u) || 'null'); } catch (_) { return null; } }, uid);

async function main() {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est pris — relance ce banc seul`) : e)); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱 390' : '🖥️ 1512';
      const opts = { viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) };

      // ── A. lecture complète, puis hors ligne avec un jeton expiré ─────────
      console.log(`\n── ${T} · A. lecture complète → hors ligne → retour du réseau`);
      await essaie(`${T} A`, async () => {
        const ctx = await nav.newContext(opts);
        const etat = { hors: false };
        await brancher(ctx, etat);
        await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID_A]);
        const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
        await ouvrirEnLigne(pg);
        let photo = null;
        for (let i = 0; i < 40 && !(photo = await photoDe(pg, UID_A)); i++) await pg.waitForTimeout(500);
        dit(!!photo, 'en ligne, lecture complète : la photo de CE vendeur est écrite sur l\'appareil', photo ? `${photo.nEnvoyer} à envoyer · ${photo.nRetirer} à retirer` : 'aucune');
        dit(!!photo && photo.uid === UID_A && photo.nEnvoyer === 1 && photo.nRetirer === 1 && photo.retirer[0].code === '4321', 'elle porte le colis à expédier et le colis à retirer avec son code', photo ? JSON.stringify({ e: photo.envoyer.map((x) => x.titre), r: photo.retirer.map((x) => x.code) }) : '');
        let enReserve = 0;
        for (let i = 0; i < 20 && !enReserve; i++) { enReserve = await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).length).catch(() => 0); if (!enReserve) await pg.waitForTimeout(300); }
        dit(enReserve > 0, 'le QR du colis est mis en réserve pour le service worker', enReserve + ' entrée(s)');
        // Hors ligne, jeton EXPIRÉ : la session ne doit pas partir.
        await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('vrm_session')); s.expires_at = Date.now() - 3600e3; localStorage.setItem('vrm_session', JSON.stringify(s)); });
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const r = await pg.evaluate(() => {
          const v = document.querySelector('[data-hors-ligne]');
          const qr = document.querySelector('[data-hl-qr]');
          return {
            vue: v && v.getAttribute('data-hors-ligne'),
            lignes: [...document.querySelectorAll('[data-hors-ligne-ligne]')].map((x) => x.innerText),
            colis: [...document.querySelectorAll('[data-hl-colis]')].map((x) => x.innerText),
            code: !!document.querySelector('[data-hl-code="4321"]'),
            qr: qr ? { etat: qr.getAttribute('data-hl-qr'), w: qr.naturalWidth || 0 } : null,
            soir: document.querySelector('[data-hl-soir]') ? document.querySelector('[data-hl-soir]').getAttribute('data-hl-soir-n') : null,
            gestesActifs: v ? [...v.querySelectorAll('button')].filter((b) => !b.disabled).map((b) => b.innerText) : ['(pas de vue)'],
            gestes: v ? v.querySelectorAll('[data-hl-geste]').length : 0,
            texte: document.body.innerText,
            mdp: !!document.querySelector('input[type="password"]'),
            session: !!localStorage.getItem('vrm_session'),
            debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        dit(r.vue === 'photo', 'hors ligne : Ma journée s\'ouvre sur la photo', 'vue ' + r.vue);
        dit(r.lignes.length === 1 && /^Hors ligne — ce que tu vois date de .+ ; rien ne peut être envoyé\.?$/.test(r.lignes[0].trim()), 'UNE ligne en tête qui dit de quand ça date et que rien ne part', JSON.stringify(r.lignes));
        dit(r.colis.length === 1 && /Nike Air Max 1 banc/.test(r.colis[0]), 'le colis à expédier est là', JSON.stringify(r.colis));
        dit(r.code, 'le code de retrait est là (4321)');
        dit(!!r.qr && r.qr.etat === 'ok' && r.qr.w > 0, 'le QR s\'affiche SANS réseau (réserve du service worker)', JSON.stringify(r.qr));
        dit(r.soir === '1', 'la liste du soir dit le colis à poster demain', 'n=' + r.soir);
        dit(!/Tout est à jour/i.test(r.texte), 'jamais « Tout est à jour » hors ligne');
        dit(r.gestes >= 2 && r.gestesActifs.length === 0, 'aucun geste actif hors ligne (les boutons sont grisés)', `${r.gestes} geste(s) grisé(s) · actifs : ${JSON.stringify(r.gestesActifs)}`);
        dit(!r.mdp && r.session, 'un jeton expiré hors ligne ne déconnecte pas', `écran de connexion : ${r.mdp} · session : ${r.session}`);
        dit(!r.debordement, 'aucun débordement horizontal');
        await pg.screenshot({ path: path.join(require('os').tmpdir(), `hors-ligne-${vp.width}.png`), fullPage: false }).catch(() => {});
        // Le réseau revient : relecture normale, la ligne disparaît.
        etat.hors = false; await ctx.setOffline(false);
        let parti = false;
        for (let i = 0; i < 40 && !parti; i++) { await pg.waitForTimeout(500); parti = await pg.evaluate(() => !document.querySelector('[data-hors-ligne]') && !!document.querySelector('main')).catch(() => false); }
        await pg.waitForTimeout(2500);
        const apres = await pg.evaluate(() => ({ hl: document.querySelectorAll('[data-hors-ligne-ligne]').length, t: document.body.innerText })).catch(() => ({ hl: -1, t: '' }));
        dit(parti && apres.hl === 0, 'le réseau revient : la ligne « Hors ligne » disparaît', `lignes ${apres.hl}`);
        dit(/Je n.arrive pas à joindre/.test(apres.t) === false, 'et la relecture a eu lieu (pas de panne affichée)');
        dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
        await ctx.close();
      });

      // ── B. lecture partielle : aucune photo ───────────────────────────────
      console.log(`\n── ${T} · B. lecture partielle (emails de suivi en panne) → aucune photo`);
      await essaie(`${T} B`, async () => {
        const ctx = await nav.newContext(opts);
        const etat = { hors: false, suiviKO: true };
        await brancher(ctx, etat);
        await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID_A]);
        const pg = await ctx.newPage();
        await ouvrirEnLigne(pg);
        await pg.waitForTimeout(8000);
        const photo = await photoDe(pg, UID_A);
        dit(!photo, 'une lecture partielle n\'écrit AUCUNE photo', photo ? `photo écrite : ${photo.nEnvoyer} à envoyer` : '');
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        const r = await pg.evaluate(() => ({ vue: (document.querySelector('[data-hors-ligne]') || { getAttribute: () => null }).getAttribute('data-hors-ligne'), t: document.body.innerText, lignes: document.querySelectorAll('[data-hors-ligne-ligne]').length }));
        dit(r.vue === 'sans-photo' && r.lignes === 1, 'hors ligne : « aucune copie gardée », dit une fois', `vue ${r.vue} · ${r.lignes} ligne(s)`);
        dit(!/Nike Air Max 1 banc|4321/.test(r.t), 'aucune donnée partielle présentée comme ta journée');
        dit(!/Tout est à jour/i.test(r.t), 'jamais « Tout est à jour » hors ligne');
        await ctx.close();
      });

      // ── C. la photo d'un autre vendeur n'est jamais servie ────────────────
      console.log(`\n── ${T} · C. la photo d'un autre vendeur reste à lui`);
      await essaie(`${T} C`, async () => {
        const ctx = await nav.newContext(opts);
        const etat = { hors: false, baseKO: true };
        await brancher(ctx, etat);
        const photoB = { v: 1, uid: UID_B, at: Date.now() - 600e3, nEnvoyer: 1, nRetirer: 1, nePasPoster: 0,
          envoyer: [{ titre: 'Paire de la vendeuse B', numero: '77', compte: 'compte-b', plateforme: 'vinted', limite: jour(1) }],
          retirer: [{ titre: 'Colis de B', lieu: 'Relais B', code: '9999', qr: '', compte: 'compte-b', transporteur: '', suivi: '', horsDelai: false }] };
        await ctx.addInitScript(([s, uid, uidB, pB]) => { try {
          if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s));
          localStorage.setItem('vrm_local_owner', uid);
          localStorage.setItem('vrm_hl_photo_' + uidB, JSON.stringify(pB));     // sa clé à lui
          localStorage.setItem('vrm_hl_photo_' + uid, JSON.stringify(pB));      // la bonne clé, son contenu à lui
        } catch (_) {} }, [SESSION, UID_A, UID_B, photoB]);
        const pg = await ctx.newPage();
        await ouvrirEnLigne(pg);
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        const r = await pg.evaluate(() => ({ vue: (document.querySelector('[data-hors-ligne]') || { getAttribute: () => null }).getAttribute('data-hors-ligne'), t: document.body.innerText }));
        dit(r.vue === 'sans-photo', 'la photo d\'un autre vendeur n\'est pas servie', 'vue ' + r.vue);
        dit(!/vendeuse B|Colis de B|9999/.test(r.t), 'aucune de ses données n\'apparaît');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ hors-ligne : ${ko} rouge(s)` : '\n✅ hors-ligne : tout est vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
