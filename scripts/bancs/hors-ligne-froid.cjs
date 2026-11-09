// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'OUVERTURE HORS LIGNE « À FROID » (9 nov., src/porteHorsLigne.js)
// ════════════════════════════════════════════════════════════════════════════
//  La VRAIE porte (BANC_PORTE_STRICTE : le crochet _porte-banc n'est pas posé).
//  Le build est servi en local ; TOUTES les données (base Supabase, /api/) sont
//  coupées comme un réseau absent (requête abandonnée « internet disconnected »),
//  jusqu'au « retour du réseau » du scénario. 390 px tactile et 1512 px.
//   A. drapeau du MÊME uid, même session, < 7 j ⇒ l'app s'ouvre, bandeau
//      « hors ligne », AUCUNE requête vers la base ni /api/ (sauf la vérification),
//      une écriture tentée dans la page est refusée par la garde, aucun message
//      `__vmr` (hors « ping ») ne part vers l'extension ;
//   B. drapeau d'un AUTRE uid ⇒ fermé ; C. drapeau rangé sous l'uid mais écrit
//      pour un autre ⇒ fermé ; D. sans session ⇒ écran de connexion ;
//      E. drapeau de plus de 7 j ⇒ fermé ; F. autre session (même uid) ⇒ fermé ;
//      G. jeton d'un autre compte ⇒ fermé ; H. abonnement jamais lu ⇒ fermé ;
//   I. dernier état « sans abonnement » ⇒ l'APERÇU (carte, reste flouté) ;
//   J. retour du réseau, le serveur REFUSE (401) ⇒ refermé, drapeau effacé ;
//   K. retour du réseau, le serveur dit oui ⇒ bandeau parti, drapeau redaté,
//      les requêtes repartent (la garde est levée).
//  BANC_DIST=<dossier dist> pour juger un autre build (arbre d'avant, mutation).
// ════════════════════════════════════════════════════════════════════════════
process.env.BANC_PORTE_STRICTE = '1';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const SORTIE = path.join(__dirname, 'captures');
const PORT = 4877;
const SUPA = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UID = '33333333-3333-3333-3333-333333333333';
const AUTRE = '44444444-4444-4444-4444-444444444444';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, aal: 'aal1', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature-de-banc`;
const empreinte = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16) + ':' + s.length; };
const RT = 'jeton-de-renouvellement-de-banc';
const session = (sub = UID, rt = RT) => ({ access_token: jwt(sub), refresh_token: rt, expires_at: Date.now() + 3600e3, totp: [], user: { id: UID, email: 'vendeuse@exemple.test' } });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `stock` : ce que l'appareil porte AVANT l'ouverture (clé → valeur JSON ou texte).
async function ouvrir(nav, viewport, stock) {
  const tactile = viewport.width < 600;
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ stock }) => {
    if (sessionStorage.getItem('__banc_pose')) return; sessionStorage.setItem('__banc_pose', '1');
    for (const [k, v] of Object.entries(stock)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, { stock });
  await pg.addInitScript(() => {
    window.__vmrVus = [];
    window.addEventListener('message', (e) => { const d = e.data; if (d && typeof d === 'object' && typeof d.__vmr === 'string') window.__vmrVus.push(d.__vmr); });
  });
  const etat = { reseau: false, verdict: 'ok', requetes: [] };
  const route = async (r) => {
    const q = r.request(); const u = q.url();
    etat.requetes.push({ m: q.method(), u, reseau: etat.reseau });
    if (!etat.reseau) return r.abort('internetdisconnected');
    if (u.includes('mode=confidentialite')) return r.fulfill({ status: etat.verdict === 'ok' ? 200 : 401, contentType: 'application/json', body: JSON.stringify(etat.verdict === 'ok' ? { ok: true, uid: UID } : { ok: false, raison: 'session' }) });
    if (u.includes('mode=abonnement')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, acces: true, statut: 'active', configure: true }) });
    if (u.startsWith(SUPA + '/auth/v1/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jwt(UID), refresh_token: RT, expires_in: 3600, user: { id: UID, email: 'vendeuse@exemple.test' } }) });
    if (u.startsWith(SUPA)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  };
  await pg.route(/supabase\.co/, route);
  await pg.route('**/api/**', route);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? route(r) : r.abort()));
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, erreurs, etat };
}
const appareil = (extra) => Object.assign({
  vrm_local_owner: UID, schema_cloisonne: '1', vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_conseils_appareil: 'coupes',
}, extra);
const drapeau = (o) => Object.assign({ uid: UID, at: Date.now() - 86400000, rt: empreinte(RT) }, o);
const aboActif = { uid: UID, at: Date.now() - 86400000, x: { acces: true, statut: 'active', configure: true } };
const base = (extra) => appareil(Object.assign({ vrm_session: session(), ['vrm_porte_ok_' + UID]: drapeau(), ['vrm_abo_dernier_' + UID]: aboActif }, extra));

const porte = (pg) => pg.evaluate(() => { const m = document.querySelector('[data-confidentialite]'); return m ? { etat: m.getAttribute('data-confidentialite'), raison: m.getAttribute('data-confidentialite-raison') } : null; });
const coeurMonte = (pg) => pg.evaluate(() => !!document.querySelector('.vrm-app-shell, [data-attente-ecran]'));
// Avant la porte, l'app sonde le schéma (clé publique, `select=owner&limit=1`, aucune
// ligne d'un vendeur) et lit les moyens de connexion (`/auth/v1/settings`) : rien de
// la boutique. Tout le reste compte.
const deBoutique = (x) => !/mode=confidentialite/.test(x.u) && !/auth\/v1\/settings/.test(x.u) && !/app_data\?select=owner&limit=1$/.test(x.u);
const bandeau = (pg) => pg.locator('[data-hors-ligne-froid]').count();

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('dist absent : npm run build'); process.exit(2); }
  fs.mkdirSync(SORTIE, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const w = viewport.width;
      console.log(`\n── ${w} px ──`);
      await essaie(`A ${w}`, async () => {
        const { ctx, pg, erreurs, etat } = await ouvrir(nav, viewport, base());
        dit(await porte(pg) === null, `A ${w} : même uid, même session, < 7 j ⇒ la porte laisse passer`, JSON.stringify(await porte(pg)));
        dit(await bandeau(pg) === 1, `A ${w} : bandeau « hors ligne · lecture seule »`);
        dit(await coeurMonte(pg), `A ${w} : l'app (le cœur) est montée`);
        const parties = etat.requetes.filter(deBoutique);
        dit(parties.length === 0, `A ${w} : aucune requête vers la base ni /api/ (hors la vérification)`, parties.slice(0, 4).map((x) => x.m + ' ' + x.u.slice(0, 90)).join(' | '));
        dit(etat.requetes.every((x) => x.m === 'GET'), `A ${w} : aucune écriture tentée`);
        const essai = await pg.evaluate((S) => fetch(S + '/rest/v1/app_data', { method: 'POST', body: '[]' }).then(() => 'passe', (e) => 'refuse:' + e.message), SUPA);
        dit(essai === 'refuse:vrm-hors-ligne', `A ${w} : une écriture tentée dans la page est refusée par la garde`, essai);
        const lecture = await pg.evaluate((S) => fetch(S + '/rest/v1/app_data?select=id').then(() => 'passe', (e) => 'refuse:' + e.message), SUPA);
        dit(lecture === 'refuse:vrm-hors-ligne', `A ${w} : une LECTURE de la base aussi (rien que l'appareil n'a déjà)`, lecture);
        const api = await pg.evaluate(() => fetch('/api/compte?mode=abonnement').then(() => 'passe', (e) => 'refuse:' + e.message));
        dit(api === 'refuse:vrm-hors-ligne', `A ${w} : nos routes /api/ aussi`, api);
        await pg.evaluate(() => { window.__vmrVus = []; window.postMessage({ __vmr: 'exec', endpoint: '/x' }, '*'); window.postMessage({ __vmr: 'session', session: null }, '*'); window.postMessage({ __vmr: 'ping' }, '*'); });
        await pg.waitForTimeout(300);
        const vus = await pg.evaluate(() => window.__vmrVus);
        dit(JSON.stringify(vus) === '["ping"]', `A ${w} : aucun message à l'extension hors « ping »`, JSON.stringify(vus));
        dit(erreurs.length === 0, `A ${w} : aucune erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await pg.screenshot({ path: path.join(SORTIE, `hors-ligne-froid-${w}.png`) });
        await ctx.close();
      });
      const refus = [
        ['B', 'drapeau d\'un AUTRE uid seulement', { ['vrm_porte_ok_' + UID]: null, ['vrm_porte_ok_' + AUTRE]: drapeau({ uid: AUTRE }) }, 'aucun'],
        ['C', 'drapeau sous cet uid mais écrit pour un autre', { ['vrm_porte_ok_' + UID]: drapeau({ uid: AUTRE }) }, 'autre-compte'],
        ['E', 'drapeau de plus de 7 jours', { ['vrm_porte_ok_' + UID]: drapeau({ at: Date.now() - 8 * 86400000 }) }, 'perime'],
        ['F', 'drapeau d\'une autre session du même compte', { ['vrm_porte_ok_' + UID]: drapeau({ rt: empreinte('une-autre-session') }) }, 'autre-session'],
        ['G', 'jeton d\'un autre compte dans la session', { vrm_session: session(AUTRE) }, 'jeton'],
        ['H', 'abonnement jamais lu sur l\'appareil', { ['vrm_abo_dernier_' + UID]: null }, 'abonnement-inconnu'],
      ];
      for (const [id, nom, extra, raison] of refus) {
        await essaie(`${id} ${w}`, async () => {
          const st = base(extra); for (const k of Object.keys(st)) if (st[k] === null) delete st[k];
          const { ctx, pg, etat } = await ouvrir(nav, viewport, st);
          const p = await porte(pg);
          dit(p && p.etat === 'indisponible' && p.raison === raison, `${id} ${w} : ${nom} ⇒ rien ne passe (${raison})`, JSON.stringify(p));
          dit(!(await coeurMonte(pg)) && (await bandeau(pg)) === 0, `${id} ${w} : le cœur n'est pas monté`);
          dit(etat.requetes.filter(deBoutique).length === 0, `${id} ${w} : aucune lecture de boutique`);
          await ctx.close();
        });
      }
      await essaie(`D ${w}`, async () => {
        const st = base(); delete st.vrm_session;
        const { ctx, pg } = await ouvrir(nav, viewport, st);
        dit(await porte(pg) === null && !(await coeurMonte(pg)) && (await bandeau(pg)) === 0, `D ${w} : sans session ⇒ écran de connexion, rien d'ouvert`);
        dit(await pg.getByText(/connecter|connexion/i).count() > 0, `D ${w} : l'écran de connexion est là`);
        await ctx.close();
      });
      await essaie(`I ${w}`, async () => {
        const { ctx, pg } = await ouvrir(nav, viewport, base({ ['vrm_abo_dernier_' + UID]: { uid: UID, at: Date.now() - 86400000, x: { acces: false, lecture: true, statut: 'canceled' } } }));
        await pg.waitForTimeout(1500);
        dit(await bandeau(pg) === 1, `I ${w} : ouvert hors ligne`);
        dit(await pg.locator('[data-carte-apercu]').count() === 1, `I ${w} : dernier état « sans abonnement » ⇒ la carte de l'aperçu`);
        dit(await pg.locator('[data-apercu]').count() >= 1, `I ${w} : l'écran est marqué aperçu (reste flouté)`);
        await pg.screenshot({ path: path.join(SORTIE, `hors-ligne-froid-apercu-${w}.png`) });
        await ctx.close();
      });
      await essaie(`J ${w}`, async () => {
        const { ctx, pg, etat } = await ouvrir(nav, viewport, base());
        dit(await bandeau(pg) === 1, `J ${w} : ouvert hors ligne`);
        etat.reseau = true; etat.verdict = 'refus';
        await pg.evaluate(() => window.dispatchEvent(new Event('online')));
        await pg.locator('[data-confidentialite]').waitFor({ timeout: 8000 });
        const p = await porte(pg);
        dit(p && p.etat === 'indisponible' && p.raison === 'refus', `J ${w} : le serveur refuse au retour ⇒ refermé aussitôt`, JSON.stringify(p));
        dit(!(await coeurMonte(pg)), `J ${w} : le cœur est démonté`);
        const reste = await pg.evaluate((k) => localStorage.getItem(k), 'vrm_porte_ok_' + UID);
        dit(reste === null, `J ${w} : le drapeau est effacé`, String(reste).slice(0, 80));
        await ctx.close();
      });
      await essaie(`K ${w}`, async () => {
        const { ctx, pg, etat } = await ouvrir(nav, viewport, base());
        const avant = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)).at, 'vrm_porte_ok_' + UID);
        etat.reseau = true; etat.verdict = 'ok';
        await pg.evaluate(() => window.dispatchEvent(new Event('online')));
        await pg.waitForFunction(() => !document.querySelector('[data-hors-ligne-froid]'), null, { timeout: 8000 });
        dit(await porte(pg) === null && await coeurMonte(pg), `K ${w} : retour du réseau, vérifié ⇒ l'app ouverte, bandeau parti`);
        const apres = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)).at, 'vrm_porte_ok_' + UID);
        dit(apres > avant, `K ${w} : le drapeau est redaté par la vérification réussie`);
        await pg.waitForTimeout(2500);
        dit(etat.requetes.some((x) => x.reseau && x.u.startsWith(SUPA + '/rest/')), `K ${w} : les lectures de la base repartent (garde levée)`);
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log({ ok, ko });
  process.exit(ko ? 1 : 0);
})();
