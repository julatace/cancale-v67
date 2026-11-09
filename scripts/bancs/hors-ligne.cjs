require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MA JOURNÉE HORS LIGNE » (21 octobre)
//
//  Au point relais sans 4G, dans le métro : ouvrir VRM sans réseau doit montrer
//  Ma journée telle qu'à la dernière ouverture RÉUSSIE — colis à expédier, colis
//  à retirer AVEC leurs codes et QR, la liste du soir — en lecture seule, avec
//  UNE ligne « Hors connexion — dernier état du {jour} à {heure} » (6 nov., v36 :
//  les gestes notés partent au retour, banc hors-reseau). Jamais « Tout est à jour ».
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
//   E. (9 nov.) LE COMPTOIR SANS RÉSEAU : le bordereau DÉJÀ OUVERT en ligne (Ventes →
//      « Imprimer ») se rouvre hors connexion (un vrai lien, le PDF de cet appareil,
//      `%PDF`) ; un colis dont le bordereau n'a jamais été ouvert dit « pas gardé ici »
//      (rien n'est téléchargé d'avance) ; la liste s'appelle « À déposer » ; « Déposé »
//      est noté et part au retour (une fois : noté, annulé, renoté ⇒ UNE marque).
//  Aucune fixture : tout est inventé (le banc vit dans le dépôt).
//  Lancer : node scripts/bancs/hors-ligne.cjs   (BANC_PORT pour changer le port)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { servir } = require('./_minipgrest.cjs');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (22 oct. : service worker, QR)
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }

// BANC_DIST=<dist d'avant> : le même banc sur l'arbre d'avant (§6.1, il doit rougir).
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4961;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.onnx': 'application/octet-stream' };

const UID_A = '11111111-2222-3333-4444-555555555555';
const UID_B = '99999999-8888-7777-6666-555555555555';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID_A, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID_A, email: 'vendeuse@exemple.fr' }, totp: [] };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', owner: UID_A, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
const QR_URL = 'https://qr.exemple.test/api/barcode/AztecCode?d=PICKUPPASS:BANC';
// (22 oct., revue) Le QR Vinted Go tel qu'il est dans sa base : en http (15 sur
// 15). Il n'entrait JAMAIS dans la réserve (rechaufferQr et le service worker ne
// prennent que https://) et faisait signaler une violation à chaque affichage.
const QR_VG = 'http://p.vintedgo.com/public/v1/qr_codes/BANC0000000000:C49341:BANC0000000000?v=1';
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
const TRACK_VG = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: 'C49341', lieu: 'Consigne Vinted Go Laverie du Port', carrier: 'vinted',
  suivi: 'VGSBANC000001', artTitle: '', qrUrl: QR_VG, receivedAt: iso(Date.now() - 2 * 3600e3), limite: jour(4) };
const ROWS = [
  ligne('main', {}),
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_sold`, { capturedAt: iso(Date.now()), payload: { my_orders: [VENTE] } }),
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_purchased`, { capturedAt: iso(Date.now()), payload: { my_orders: [] } }),
  ligne('email_track_mondial_relay_MR999000111', TRACK),
  ligne('email_track_vinted_VGSBANC000001', TRACK_VG),
  ligne('panel_colis_relais', {}),
];
// (revue du 23 oct., défauts 9 et 13) Deux colis « à vérifier » de plus : un
// Mondial Relay SANS date limite arrivé il y a 10 jours (plus que la garde de
// Mondial Relay, 5 j) et un colis dont la date limite écrite était hier.
const ROWS_D = ROWS.concat([
  ligne('email_track_mondialrelay_MR555000111', { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '5555', lieu: 'Relais Vieux Cancale', carrier: 'mondialrelay',
    suivi: 'MR555000111', artTitle: '', receivedAt: iso(Date.now() - 10 * 864e5), limite: null }),
  ligne('email_track_chronopost_XW666000111FR', { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '6666', lieu: 'Presse Hier Cancale', carrier: 'chronopost',
    suivi: 'XW666000111FR', artTitle: '', receivedAt: iso(Date.now() - 3 * 864e5), limite: jour(-1) }),
]);

// (9 nov.) E — deux ventes à déposer, chacune avec son bordereau par e-mail (un VRAI petit
// PDF) ; seule la 70001 sera ouverte en ligne.
const PDF_MINI = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 283 425]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');
const VENTE_2 = { ...VENTE, transaction_id: 70002, title: 'Adidas Samba banc' };
const bord = (tx, titre) => ligne('email_bord_' + tx, { type: 'bordereau', transaction: String(tx), filename: 'bordereau-' + tx + '.pdf', pdfB64: PDF_MINI, modele: titre, article: titre,
  account: COMPTE.login, uid: COMPTE.vinted_user_id, receivedAt: iso(Date.now() - 3600e3), dateLimite: jour(3), transporteur: 'Mondial Relay' });
const ROWS_E = ROWS.map((r) => (r.id === `harvest_${COMPTE.vinted_user_id}_orders_sold` ? ligne(r.id, { capturedAt: iso(Date.now()), payload: { my_orders: [VENTE, VENTE_2] } }) : r))
  .concat([bord(70001, VENTE.title), bord(70002, VENTE_2.title)]);

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
// BANC_PHASES=E (ou A,E…) : seulement ces phases ; BANC_TAILLES=390 : une seule taille.
const essaie = async (nom, f) => { if (process.env.BANC_PHASES && !process.env.BANC_PHASES.split(',').includes(nom.trim().split(' ').pop())) return; try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

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
    if (req.method() !== 'GET') { (etat.ecrits = etat.ecrits || []).push({ m: req.method(), u: decodeURIComponent(u), corps: req.postData() || '' }); return json(route, []); }
    if (!String(h.authorization || '').includes(JETON)) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(route, [COMPTE]);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    if (etat.suiviKO && /email_track/.test(decodeURIComponent(u))) return route.fulfill({ status: 502, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>502</html>' });
    const r = servir(etat.rows || ROWS, u, h);
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/supabase\.co\/auth\/v1\//, (route) => {
    if (etat.hors) return route.abort('internetdisconnected');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
  });
  await ctx.route(/\/api\//, (route) => etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(/qr\.exemple\.test/, (route) => { etat.qrServis = (etat.qrServis || 0) + 1; return etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await ctx.route(/^https?:\/\/p\.vintedgo\.com\//, (route) => { const k = route.request().url().startsWith('https:') ? 'vgHttps' : 'vgHttp'; etat[k] = (etat[k] || 0) + 1; return etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
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
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !process.env.BANC_TAILLES || process.env.BANC_TAILLES.split(',').includes(String(v.width)))) {
      const T = vp.width < 600 ? '📱 390' : '🖥️ 1512';
      const opts = { viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) };

      // ── A. lecture complète, puis hors ligne avec un jeton expiré ─────────
      console.log(`\n── ${T} · A. lecture complète → hors ligne → retour du réseau`);
      await essaie(`${T} A`, async () => {
        const ctx = await nav.newContext(opts);
        await cspBanc(ctx, `http://localhost:${PORT}`, `hors-ligne ${vp.width}`);
        const etat = { hors: false };
        await brancher(ctx, etat);
        await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID_A]);
        const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
        await ouvrirEnLigne(pg);
        let photo = null;
        for (let i = 0; i < 40 && !(photo = await photoDe(pg, UID_A)); i++) await pg.waitForTimeout(500);
        dit(!!photo, 'en ligne, lecture complète : la photo de CE vendeur est écrite sur l\'appareil', photo ? `${photo.nEnvoyer} à envoyer · ${photo.nRetirer} à retirer` : 'aucune');
        dit(!!photo && photo.uid === UID_A && photo.nEnvoyer === 1 && photo.nRetirer === 2 && ['4321', 'C49341'].every((c) => photo.retirer.some((x) => x.code === c)), 'elle porte le colis à expédier et les deux colis à retirer avec leur code', photo ? JSON.stringify({ e: photo.envoyer.map((x) => x.titre), r: photo.retirer.map((x) => x.code) }) : '');
        dit(!!photo && photo.retirer.some((x) => /^https:\/\/p\.vintedgo\.com\//.test(x.qr || '')), 'le QR Vinted Go (http dans l\'email) est gardé en https dans la photo', photo ? JSON.stringify(photo.retirer.map((x) => String(x.qr || '').slice(0, 30))) : '');
        let cles = [];
        for (let i = 0; i < 30 && cles.length < 2; i++) { cles = await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).map((r) => decodeURIComponent(r.url.replace(/^.*?u=/, '')))).catch(() => []); if (cles.length < 2) await pg.waitForTimeout(300); }
        dit(cles.length > 0, 'le QR du colis est mis en réserve pour le service worker', cles.length + ' entrée(s)');
        dit(cles.some((u) => /^https:\/\/p\.vintedgo\.com\//.test(u)), 'le QR Vinted Go est mis en réserve aussi (avant : jamais, il était en http)', JSON.stringify(cles.map((u) => u.slice(0, 30))));
        dit(!etat.vgHttp && etat.vgHttps > 0, 'le QR Vinted Go n\'est demandé qu\'en https', `https ${etat.vgHttps || 0} · http ${etat.vgHttp || 0}`);
        // Hors ligne, jeton EXPIRÉ : la session ne doit pas partir.
        await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('vrm_session')); s.expires_at = Date.now() - 3600e3; localStorage.setItem('vrm_session', JSON.stringify(s)); });
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const r = await pg.evaluate(() => {
          const v = document.querySelector('[data-hors-ligne]');
          const qrs = [...document.querySelectorAll('[data-hl-qr]')];
          return {
            vue: v && v.getAttribute('data-hors-ligne'),
            lignes: [...document.querySelectorAll('[data-hors-ligne-ligne]')].map((x) => x.innerText),
            colis: [...document.querySelectorAll('[data-hl-colis]')].map((x) => x.innerText),
            code: !!document.querySelector('[data-hl-code="4321"]') && !!document.querySelector('[data-hl-code="C49341"]'),
            qr: qrs.length ? qrs.map((q) => ({ etat: q.getAttribute('data-hl-qr'), w: q.naturalWidth || 0 })) : null,
            soir: document.querySelector('[data-hl-soir]') ? document.querySelector('[data-hl-soir]').getAttribute('data-hl-soir-n') : null,
            gestesActifs: v ? [...v.querySelectorAll('button')].filter((b) => !b.disabled && !b.hasAttribute('data-hl-file') && !b.hasAttribute('data-hl-en-grand-ouvrir') && !b.hasAttribute('data-hl-inventaire-ouvrir')).map((b) => b.innerText) : ['(pas de vue)'],
            gestes: v ? v.querySelectorAll('[data-hl-geste][data-hl-file]').length : 0,
            texte: document.body.innerText,
            mdp: !!document.querySelector('input[type="password"]'),
            session: !!localStorage.getItem('vrm_session'),
            debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        dit(r.vue === 'photo', 'hors ligne : Ma journée s\'ouvre sur la photo', 'vue ' + r.vue);
        // (6 nov., v36) « Hors connexion — dernier état du <jour> à <heure> » : les gestes
        // notés hors réseau partent au retour (scripts/bancs/hors-reseau.cjs les suit).
        dit(r.lignes.length === 1 && /^Hors connexion — dernier état du \d{1,2} \S+ à \d{2}:\d{2}\. Ce que tu notes ici part au retour du réseau\.$/.test(r.lignes[0].trim()), 'UNE ligne en tête qui dit de quel jour et quelle heure date l\'état, et que les gestes partent au retour', JSON.stringify(r.lignes));
        dit(r.colis.length === 1 && /Nike Air Max 1 banc/.test(r.colis[0]), 'le colis à expédier est là', JSON.stringify(r.colis));
        dit(r.code, 'les codes de retrait sont là (4321, C49341)');
        dit(!!r.qr && r.qr.length === 2 && r.qr.every((q) => q.etat === 'ok' && q.w > 0), 'les deux QR (Pickup et Vinted Go) s\'affichent SANS réseau (réserve du service worker)', JSON.stringify(r.qr));
        dit(r.soir === '1', 'la liste du soir dit le colis à poster demain', 'n=' + r.soir);
        dit(!/Tout est à jour/i.test(r.texte), 'jamais « Tout est à jour » hors ligne');
        // (6 nov., v36) Hors ligne, un geste actif est une NOTE mise en file (`data-hl-file` :
        // « Colis fait », « J'ai retiré ») ou « En grand » — jamais un geste qui parle à Vinted.
        dit(r.gestes >= 2 && r.gestesActifs.length === 0, 'hors ligne, seuls les gestes mis en file et « En grand » sont actifs', `${r.gestes} geste(s) en file · autres actifs : ${JSON.stringify(r.gestesActifs)}`);
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
        await cspBanc(ctx, `http://localhost:${PORT}`, `hors-ligne ${vp.width}`);
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
        dit(!/Nike Air Max 1 banc|4321|C49341/.test(r.t), 'aucune donnée partielle présentée comme ta journée');
        dit(!/Tout est à jour/i.test(r.t), 'jamais « Tout est à jour » hors ligne');
        await ctx.close();
      });

      // ── D. (revue du 23 oct.) « à retirer » hors ligne = la tuile en ligne ──
      console.log(`\n── ${T} · D. les colis « à vérifier » ne comptent pas dans « à retirer » hors ligne`);
      await essaie(`${T} D`, async () => {
        const ctx = await nav.newContext(opts);
        await cspBanc(ctx, `http://localhost:${PORT}`, `hors-ligne ${vp.width}`);
        const etat = { hors: false, rows: ROWS_D };
        await brancher(ctx, etat);
        await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID_A]);
        const pg = await ctx.newPage();
        await ouvrirEnLigne(pg);
        let photo = null;
        for (let i = 0; i < 40 && !(photo = await photoDe(pg, UID_A)); i++) await pg.waitForTimeout(500);
        await pg.waitForTimeout(1500);
        const tuile = await pg.evaluate(() => { const t = document.querySelector('[data-tuile="retirer"]'); return t ? t.getAttribute('data-n') : null; });
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1000);
        const r = await pg.evaluate(() => {
          const ret = document.querySelector('[data-hl-retirer]'), av = document.querySelector('[data-hl-a-verifier]');
          return { retirer: ret ? ret.getAttribute('data-hl-retirer') : null, aVerifier: av ? av.getAttribute('data-hl-a-verifier') : null,
            raisons: [...document.querySelectorAll('[data-hl-raison]')].map((x) => ({ r: x.getAttribute('data-hl-raison'), t: x.innerText })), texte: document.body.innerText,
            codes: ['5555', '6666'].filter((c) => !!document.querySelector(`[data-hl-code="${c}"]`)) };
        });
        dit(tuile === '2' && r.retirer === tuile, 'hors ligne, « À retirer » dit le MÊME nombre que la tuile en ligne (les colis « à vérifier » n\'y sont pas)', `en ligne ${tuile} · hors ligne ${r.retirer}`);
        dit(r.aVerifier === '2' && r.codes.length === 2, 'les deux colis « à vérifier » ont leur bloc à part, avec leur code (peut-être encore au relais)', `bloc ${r.aVerifier} · codes ${r.codes.join(',')}`);
        const tl = r.raisons.find((x) => x.r === 'trop_long'), dd = r.raisons.find((x) => x.r === 'delai_depasse');
        dit(!!tl && /plus de 5 jours/.test(tl.t) && !!dd && /délai de retrait dépassé/.test(dd.t), 'chacun dit SA raison : « plus de 5 jours » (garde Mondial Relay, sans date limite) · « délai de retrait dépassé »', JSON.stringify(r.raisons.map((x) => x.r + ': ' + x.t.replace(/\n/g, ' ¦ ').slice(0, 90))));
        dit(!/hors délai/i.test(r.texte), 'jamais « hors délai » sur un colis sans date limite (le mot n\'est plus écrit hors ligne)');
        await ctx.close();
      });

      // ── E. (9 nov.) le bordereau déjà ouvert, « À déposer », « Déposé » en file ──
      // E se joue en clair puis en sombre (le thème choisi : `vinted_dark`).
      for (const sombre of [false, true]) {
      console.log(`\n── ${T} · E. au comptoir sans réseau (${sombre ? 'sombre' : 'clair'}) : bordereau déjà ouvert, « Déposé » en file`);
      await essaie(`${T} E`, async () => {
        const ctx = await nav.newContext({ ...opts, colorScheme: sombre ? 'dark' : 'light' });
        await ctx.addInitScript((d) => { try { localStorage.setItem('vinted_dark', JSON.stringify(d)); } catch (_) {} }, sombre);
        await cspBanc(ctx, `http://localhost:${PORT}`, `hors-ligne ${vp.width}`);
        const etat = { hors: false, rows: ROWS_E };
        await brancher(ctx, etat);
        await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); } catch (_) {} }, [SESSION, UID_A]);
        const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
        await ouvrirEnLigne(pg);
        // En ligne : il ouvre le bordereau de la 70001 (Ventes → « Imprimer »), pas celui de la 70002.
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        // La ligne de la vente s'ouvre (son tiroir porte le bouton), puis « Imprimer ».
        await pg.waitForSelector('.vrm-ledger-sale-toggle', { timeout: 30000 }).catch(() => {});
        await pg.locator('.vrm-ledger-sale-toggle', { hasText: 'Nike Air Max 1 banc' }).first().click({ timeout: 8000 }).catch(() => {});
        await pg.waitForSelector('[data-bouton-bord="pdf"][data-tx="70001"]', { state: 'attached', timeout: 20000 }).catch(() => {});
        const bouton = await pg.evaluate(() => { const b = document.querySelector('[data-bouton-bord="pdf"][data-tx="70001"]'); if (!b) return [...document.querySelectorAll('[data-bouton-bord]')].map((x) => x.getAttribute('data-bouton-bord') + ':' + x.getAttribute('data-tx')).join(',') || 'aucun bouton'; b.click(); return true; });
        let garde = [];
        for (let i = 0; i < 30 && !garde.length; i++) { await pg.waitForTimeout(400); garde = await pg.evaluate(async () => (await (await caches.open('vrm-hl-pdf')).keys()).map((r) => decodeURIComponent(new URL(r.url).pathname))).catch(() => []); }
        dit(bouton === true && garde.length === 1 && garde[0] === `/hl-pdf/${UID_A}/email_bord_70001`, 'en ligne, le bordereau OUVERT est gardé sur l\'appareil, au nom de CE vendeur (et lui seul)', JSON.stringify({ bouton, garde }));
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        let photo = null;
        for (let i = 0; i < 40; i++) { photo = await photoDe(pg, UID_A); if (photo && photo.nEnvoyer === 2 && photo.envoyer.every((e) => Array.isArray(e.pdf) && e.pdf.length)) break; await pg.waitForTimeout(500); }
        dit(!!photo && photo.envoyer.map((e) => e.tx + ':' + (e.pdf || []).join('+')).sort().join(',') === '70001:email_bord_70001,70002:email_bord_70002', 'la photo relie chaque colis à SES lignes de bordereau (par sa transaction)', photo ? JSON.stringify(photo.envoyer.map((e) => [e.tx, e.pdf])) : 'aucune');
        etat.hors = true; await ctx.setOffline(true);
        await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await pg.waitForSelector('[data-hors-ligne="photo"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForSelector('[data-hl-pdf="70001"]', { timeout: 8000 }).catch(() => {});
        const r = await pg.evaluate(async () => {
          const a = document.querySelector('[data-hl-pdf="70001"]');
          let tete = '';
          if (a) { try { const b = await (await fetch(a.href)).arrayBuffer(); tete = String.fromCharCode(...new Uint8Array(b).slice(0, 5)); } catch (e) { tete = 'KO ' + e.message; } }
          const titres = [...document.querySelectorAll('[data-hors-ligne] div')].filter((d) => /^À déposer · \d/.test(d.innerText.trim()) && d.children.length === 0).map((d) => d.innerText.trim());
          return { lien: !!a, href: a ? a.getAttribute('href').slice(0, 5) : '', tag: a ? a.tagName : '', tete, absent: !!document.querySelector('[data-hl-pdf-absent="70002"]'), lien2: !!document.querySelector('[data-hl-pdf="70002"]'), titres,
            deposer: [...document.querySelectorAll('[data-hl-fait-btn]')].map((b) => b.innerText.trim()), ligne: (document.querySelector('[data-hors-ligne-ligne]') || {}).innerText || '' };
        });
        dit(r.lien && r.tag === 'A' && r.href === 'blob:' && r.tete === '%PDF-', 'hors connexion : « Bordereau » de la 70001 est un vrai lien vers le PDF gardé ici (%PDF)', JSON.stringify({ lien: r.lien, tag: r.tag, href: r.href, tete: r.tete }));
        dit(r.absent && !r.lien2, 'la 70002 (bordereau jamais ouvert ici) : « pas gardé ici », aucun faux bouton', JSON.stringify({ absent: r.absent, lien2: r.lien2 }));
        dit(r.titres.length === 1 && r.titres[0] === 'À déposer · 2' && r.deposer.length === 2 && r.deposer.every((x) => x === 'Déposé'), 'la liste dit « À déposer · 2 », chaque colis a « Déposé »', JSON.stringify({ t: r.titres, d: r.deposer }));
        dit(/^Hors connexion — dernier état du \d{1,2} \S+ à \d{2}:\d{2}\./.test(r.ligne.trim()), 'le bandeau dit l\'heure du dernier état', r.ligne);
        if (process.env.SHOT_HL) await pg.screenshot({ path: `${process.env.SHOT_HL}-${vp.width}-${sombre ? 'sombre' : 'clair'}-comptoir.png`, fullPage: true }).catch(() => {});
        // « Déposé » : noté, annulé, renoté — UNE marque, qui part au retour du réseau.
        const nAvant = (etat.ecrits || []).length;
        const btn = '[data-hl-colis]:has-text("Nike Air Max 1 banc") [data-hl-fait-btn]';
        await pg.locator(btn).click({ timeout: 5000 });
        await pg.waitForTimeout(300);
        await pg.locator('[data-hl-colis]:has-text("Nike Air Max 1 banc") [data-hl-annuler]').click({ timeout: 5000 });
        await pg.waitForTimeout(300);
        await pg.locator(btn).click({ timeout: 5000 });
        await pg.waitForTimeout(600);
        const note = await pg.evaluate(() => ({ fait: [...document.querySelectorAll('[data-hl-fait]')].map((x) => x.getAttribute('data-hl-fait')), ship: JSON.parse(localStorage.getItem('vinted_ship_done') || '{}'), attente: (document.querySelector('[data-file-envoi]') || { getAttribute: () => null }).getAttribute('data-file-envoi') }));
        dit(note.fait.join() === 'attente' && Object.keys(note.ship).join() === '70001' && (etat.ecrits || []).length === nAvant, 'hors connexion : « Déposé » noté (en attente d\'envoi), UNE marque pour la 70001, rien parti', JSON.stringify({ ...note, envois: (etat.ecrits || []).length - nAvant }));
        etat.hors = false; await ctx.setOffline(false);
        let parti = null;
        for (let i = 0; i < 40 && !parti; i++) { await pg.waitForTimeout(500); parti = (etat.ecrits || []).slice(nAvant).find((x) => /vinted_ship_done/.test(x.corps) && /70001/.test(x.corps)); }
        let ship = null; try { const c = JSON.parse(parti ? parti.corps : 'null'); const rows = Array.isArray(c) ? c : [c]; for (const row of rows) { const d = row && (row.data || row); if (d && d.vinted_ship_done) ship = d.vinted_ship_done; } } catch (_) {}
        dit(!!parti && ship && Object.keys(ship).join() === '70001', 'le réseau revient : la marque « Déposé » part, une fois, pour la seule 70001', parti ? JSON.stringify(ship) : 'rien envoyé');
        dit(erreurs.length === 0, 'aucune erreur d\'app (E)', erreurs.join(' | '));
        await ctx.close();
      });
      }

      // ── C. la photo d'un autre vendeur n'est jamais servie ────────────────
      console.log(`\n── ${T} · C. la photo d'un autre vendeur reste à lui`);
      await essaie(`${T} C`, async () => {
        const ctx = await nav.newContext(opts);
        await cspBanc(ctx, `http://localhost:${PORT}`, `hors-ligne ${vp.width}`);
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
  ko += bilanCsp();
  console.log(ko ? `\n❌ hors-ligne : ${ko} rouge(s)` : '\n✅ hors-ligne : tout est vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
