require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LOT 53/55 » (13 nov.) — RENDU, 390 px tactile et 1512 px, clair et sombre :
//    A  Réglages → Aide → « Écrire au support » : la feuille montre EXACTEMENT ce
//       qui part (6 lignes), dit « Rien d'autre ne part… », masque ce qu'il tape
//       (montant, e-mail) ; « Envoyer » ⇒ le corps POSTÉ n'a que les champs de la
//       règle ; « Reçu, réponse par e-mail. » ; refus du serveur ⇒ « Pas envoyé »,
//       le texte reste ;
//    G  un écran tombé (garde-fou) porte « Écrire au support », l'écran part avec ;
//    P  le propriétaire : « Demandes d'aide » (Répondre par e-mail, Traitée) ; un
//       vendeur n'a pas l'entrée ;
//    N  Réglages → Notifications : « Bilan mensuel par e-mail », activé par défaut,
//       et dit qu'aucun bilan ne part quand l'envoi n'est pas configuré ;
//    C  le bouton de l'e-mail (`?tab=compta&cible=bilanmois&mois=<mois dernier>`)
//       ouvre Compta sur « Bilan du mois » de CE mois, mis en évidence.
//  Mode exemple (données inventées) ; les routes `/api/compte?mode=aide|bilan-mois`
//  sont servies par le banc (la règle serveur : scripts/audit-lot5355.cjs).
//  `BANC_PORT` (défaut 23731), `BANC_CAPTURES` (dossier des captures à regarder).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 23731;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-lot5355');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };
const ymDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MOIS_DERNIER = (() => { const d = new Date(); return ymDe(new Date(d.getFullYear(), d.getMonth() - 1, 1)); })();

(async () => {
  const ex = await import('file://' + path.join(RACINE, 'src', 'exempleDonnees.js'));
  const exBase = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js'));
  const regle = await import('file://' + path.join(RACINE, 'src', 'demandeAide.js'));
  const jeu = ex.jeuExemple(Date.now());
  const main = jeu.lignes.find((l) => l.id === 'main');
  if (main) main.data.vrm_configuration = { etat: 'fait', at: new Date().toISOString(), statut: null, version: 1 };
  const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const DEMANDES = [
    { de: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id: 'demande_aide_2026111309_1', texte: 'Comment relier mon deuxième compte ?', version: '13 novembre à 09:10', extension: '5.380.0', ecran: 'vintedaccounts', navigateur: 'Chrome', depuis: 'reglages', at: new Date().toISOString(), traitee: false, repondre: 'vendeur.invente@exemple.test' },
    { de: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id: 'demande_aide_2026111308_1', texte: 'L’écran Colis est tombé.', version: '', extension: null, ecran: 'colis', navigateur: 'Orion', depuis: 'garde', at: new Date(Date.now() - 3600e3).toISOString(), traitee: false, repondre: null },
  ];
  async function ouvrir({ largeur = 1512, sombre = false, proprio = true, url = '/?tab=settings', plante = null, aide = 'ok', bilan = { ok: true, configure: false, actif: true, defaut: true, envois: {} } }) {
    const mobile = largeur < 600;
    const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    const postes = [];
    const qui = { id: ex.UID_EXEMPLE, email: 'proprio@exemple.test' };
    const jeton = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: qui.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
    const session = { access_token: jeton, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: qui };
    await pg.addInitScript(({ s, sombre, plante }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vrm_reglages_vue', 'reglages'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} if (plante) window.__VRM_BANC_PLANTE = plante; }, { s: session, sombre, plante });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
    await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jeton, refresh_token: 'r', expires_in: 3600, user: qui }) }));
    await pg.route('**/rest/v1/**', async (r) => {
      const u = r.request().url(), m = r.request().method();
      if (/rpc\/vrm_acces/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ obligatoire: false, proprietaire: proprio, acces: true, lecture: true }) });
      if (/\/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      const url = new URL(u), table = url.pathname.slice('/rest/v1/'.length).split('/')[0];
      const t = table === 'app_data' ? { lignes: jeu.lignes } : table === 'vinted_accounts' ? { lignes: jeu.comptes } : { lignes: [] };
      const x = exBase.servirTable(t, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps: r.request().postData(), owner: ex.UID_EXEMPLE });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : (typeof x.body === 'string' ? x.body : JSON.stringify(x.body)) });
    });
    await pg.route('**/api/**', async (r) => {
      const q = r.request(), u = new URL(q.url()), mode = u.searchParams.get('mode');
      const json = (code, corps) => r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(corps) });
      if (u.pathname === '/api/compte' && mode === 'aide') {
        if (q.method() === 'POST') {
          const corps = JSON.parse(q.postData() || '{}');
          postes.push(corps);
          if (corps.action === 'traitee') return json(200, { ok: true, de: corps.de, id: corps.id, traitee: corps.traitee });
          if (aide === 'panne') return json(503, { ok: false, raison: 'base' });
          return json(200, { ok: true, id: 'demande_aide_2026111310_1', at: new Date().toISOString() });
        }
        return proprio ? json(200, { ok: true, demandes: DEMANDES, nonTraitees: 2, ecartees: 0 }) : json(403, { ok: false, raison: 'proprietaire' });
      }
      if (u.pathname === '/api/compte' && mode === 'bilan-mois') return json(200, bilan);
      return json(200, { ok: true });
    });
    await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3800);
    return { ctx, pg, erreurs, postes };
  }
  const tap = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
  const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }).catch(() => {});
  const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  try {
    console.log('\n── A · Réglages → Aide → « Écrire au support »');
    for (const [largeur, sombre] of [[390, false], [1512, true], [390, true]]) {
      await essaie(`A ${largeur}`, async () => {
        const { ctx, pg, erreurs, postes } = await ouvrir({ largeur, sombre });
        const T = `${largeur}${sombre ? ' sombre' : ''}`;
        const mobile = largeur < 600;
        const h = await pg.locator('[data-reglage-support]').first().evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
        dit(h >= 44, `${T} · la ligne « Écrire au support » (≥ 44 px)`, h);
        await tap(pg, '[data-reglage-support]', mobile);
        await pg.locator('[data-feuille-support]').first().waitFor({ timeout: 8000 });
        await pg.locator('[data-support-texte]').fill('Ma vente à 87,50 € pour acheteuse.x@exemple.test ne remonte pas');
        const x = await pg.evaluate(() => ({
          lignes: [...document.querySelectorAll('[data-support-apercu] [data-apercu-ligne]')].map((e) => [e.getAttribute('data-apercu-ligne'), e.querySelector('dd').innerText]),
          rien: (document.querySelector('[data-support-rien-dautre]') || {}).innerText || '',
          cibles: [...document.querySelectorAll('[data-feuille-support] button, [data-feuille-support] textarea')].filter((b) => b.getClientRects().length).map((b) => Math.round(b.getBoundingClientRect().height)),
        }));
        const L = Object.fromEntries(x.lignes);
        dit(x.lignes.map((l) => l[0]).join('|') === 'Ton message|Version de l’app|Version de l’extension|Écran|Navigateur|Heure', `${T} · l’aperçu : exactement 6 lignes (message + 5 faits techniques)`, x.lignes.map((l) => l[0]).join('|'));
        dit(/\{montant\}/.test(L['Ton message']) && /\{email\}/.test(L['Ton message']) && !/87,50|acheteuse/.test(L['Ton message']), `${T} · ce qu’il tape est masqué AVANT l’envoi (montant, e-mail)`, L['Ton message']);
        dit(L['Écran'] === 'settings' && /posée à l’envoi/.test(L['Heure']), `${T} · l’écran ouvert, l’heure posée par le serveur`, JSON.stringify(L));
        dit(/ni pseudo, ni montant, ni e-mail d’acheteur/.test(x.rien), `${T} · la feuille DIT que rien d’autre ne part`, x.rien);
        dit(Math.min(...x.cibles) >= 44, `${T} · cibles ≥ 44 px`, x.cibles.join(','));
        dit((await deborde(pg)) <= 0, `${T} · rien ne déborde`);
        await capture(pg, `support-feuille-${largeur}${sombre ? '-sombre' : ''}`);
        await tap(pg, '[data-support-envoyer]', mobile);
        await pg.locator('[data-support-etat="recu"]').first().waitFor({ timeout: 8000 });
        const recu = await pg.locator('[data-support-etat="recu"]').innerText();
        const corps = postes.find((p) => p.texte) || {};
        dit(Object.keys(corps).sort().join(',') === [...regle.CHAMPS_AIDE].sort().join(','), `${T} · le corps POSTÉ n’a que ${regle.CHAMPS_AIDE.join(', ')}`, Object.keys(corps).join(','));
        dit(/Reçu, réponse par e-mail\./.test(recu) && !erreurs.length, `${T} · accusé « Reçu, réponse par e-mail. »`, recu.replace(/\n/g, ' · ') + ' ' + erreurs.join('|'));
        await capture(pg, `support-recu-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    await essaie('A refus', async () => {
      const { ctx, pg } = await ouvrir({ largeur: 390, aide: 'panne' });
      await tap(pg, '[data-reglage-support]', true);
      await pg.locator('[data-support-texte]').fill('Une question qui ne part pas');
      await tap(pg, '[data-support-envoyer]', true);
      await pg.locator('[data-support-refus]').first().waitFor({ timeout: 8000 });
      const t = await pg.locator('[data-support-refus]').innerText();
      const v = await pg.locator('[data-support-texte]').inputValue();
      dit(/Pas envoyé/.test(t) && v === 'Une question qui ne part pas', '390 · refus du serveur ⇒ « Pas envoyé » et la raison, le texte reste', t);
      await capture(pg, 'support-refus-390');
      await ctx.close();
    });

    console.log('\n── G · le garde-fou d’un écran tombé');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`G ${largeur}`, async () => {
        const { ctx, pg, postes } = await ouvrir({ largeur, sombre, url: '/?tab=compta', plante: 'compta' });
        await pg.locator('[data-garde-ecran="compta"]').first().waitFor({ timeout: 10000 });
        const n = await pg.locator('[data-garde-ecran="compta"] [data-support-ouvrir]').count();
        dit(n === 1, `${largeur} · l’écran tombé porte « Écrire au support »`, n);
        await tap(pg, '[data-garde-ecran="compta"] [data-support-ouvrir]', largeur < 600);
        await pg.locator('[data-feuille-support]').first().waitFor({ timeout: 8000 });
        const e = await pg.locator('[data-feuille-support] [data-apercu-ligne="Écran"] dd').innerText();
        dit(e === 'compta', `${largeur} · l’écran tombé part avec (« compta »)`, e);
        await pg.locator('[data-support-texte]').fill('Compta ne s’affiche plus');
        await tap(pg, '[data-support-envoyer]', largeur < 600);
        await pg.locator('[data-support-etat="recu"]').first().waitFor({ timeout: 8000 });
        const c = postes.find((p) => p.texte) || {};
        dit(c.depuis === 'garde' && c.ecran === 'compta', `${largeur} · « depuis : garde », écran compta`, JSON.stringify(c));
        await capture(pg, `support-garde-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }

    console.log('\n── P · « Demandes d’aide » (propriétaire)');
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      await essaie(`P ${largeur}`, async () => {
        const { ctx, pg, postes } = await ouvrir({ largeur, sombre });
        await tap(pg, '[data-reglage-demandes-aide]', largeur < 600);
        await pg.locator('[data-demandes-aide="2"]').first().waitFor({ timeout: 10000 });
        const x = await pg.evaluate(() => ({ cartes: document.querySelectorAll('[data-demande-aide]').length, mailto: (document.querySelector('[data-demande-repondre]') || {}).href || '', sans: document.querySelectorAll('[data-demande-sans-adresse]').length, texte: (document.querySelector('[data-demandes-aide]') || {}).innerText || '' }));
        dit(x.cartes === 2 && /^mailto:vendeur\.invente@exemple\.test/.test(x.mailto) && x.sans === 1, `${largeur} · 2 demandes, « Répondre par e-mail » à l’adresse du compte, « Adresse du compte pas lue » dite`, JSON.stringify(x).slice(0, 300));
        dit(/écran tombé/.test(x.texte) && /App 13 novembre à 09:10 · extension 5\.380\.0 · Chrome/.test(x.texte), `${largeur} · les cinq faits techniques et « écran tombé »`, x.texte.replace(/\n/g, ' · ').slice(0, 300));
        dit((await deborde(pg)) <= 0, `${largeur} · rien ne déborde`);
        await capture(pg, `demandes-aide-${largeur}${sombre ? '-sombre' : ''}`);
        await tap(pg, '[data-demande-traiter="demande_aide_2026111309_1"]', largeur < 600);
        await pg.waitForTimeout(400);
        const p = postes.find((y) => y.action === 'traitee') || {};
        dit(p.de === DEMANDES[0].de && p.id === DEMANDES[0].id && p.traitee === true, `${largeur} · « Traitée » envoie { de, id }`, JSON.stringify(p));
        await ctx.close();
      });
    }
    await essaie('P vendeur', async () => {
      const { ctx, pg } = await ouvrir({ proprio: false });
      dit((await pg.locator('[data-reglage-demandes-aide]').count()) === 0 && (await pg.locator('[data-reglage-support]').count()) === 1, 'un VENDEUR n’a pas « Demandes d’aide », mais a « Écrire au support »');
      await ctx.close();
    });

    console.log('\n── N · « Bilan mensuel par e-mail »');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`N ${largeur}`, async () => {
        const { ctx, pg } = await ouvrir({ largeur, sombre });
        await tap(pg, '[data-sous-ouvrir="push"]', largeur < 600);
        await pg.locator('[data-bilan-mois]').first().waitFor({ timeout: 10000 });
        const x = await pg.evaluate(() => { const b = document.querySelector('[data-bilan-mois]'); b.scrollIntoView({ block: 'center' }); return { etat: b.getAttribute('data-bilan-mois'), conf: b.getAttribute('data-bilan-mois-configure'), defaut: b.getAttribute('data-bilan-mois-defaut'), texte: b.innerText }; });
        dit(x.etat === 'on' && x.defaut === '1' && /Bilan mensuel par e-mail/.test(x.texte), `${largeur} · « Bilan mensuel par e-mail », activé par défaut (compte neuf)`, JSON.stringify(x));
        dit(x.conf === 'non' && /aucun bilan ne part/.test(x.texte), `${largeur} · envoi pas configuré ⇒ « aucun bilan ne part » écrit`, x.texte);
        await capture(pg, `bilan-reglage-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }

    console.log('\n── C · le bouton de l’e-mail ouvre le récap du mois');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`C ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir({ largeur, sombre, url: `/?tab=compta&cible=bilanmois&mois=${MOIS_DERNIER}` });
        await pg.locator(`.vrm-bilan-mois[data-bilan-mois="${MOIS_DERNIER}"]`).first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1500);
        const x = await pg.evaluate((ym) => { const c = document.querySelector(`.vrm-bilan-mois[data-bilan-mois="${ym}"]`); const d = c && c.closest('details'); const r = c ? c.getBoundingClientRect() : null; return { visible: !!(r && r.height > 0 && r.top < window.innerHeight && r.bottom > 0), ouvert: !d || d.open, marque: !!(c && (c.hasAttribute('data-cible-notif') || c.hasAttribute('data-cible-eclaire'))), choix: (document.querySelector('[data-bilan-choix="precedent"]') || {}).getAttribute ? document.querySelector('[data-bilan-choix="precedent"]').getAttribute('aria-pressed') || document.querySelector('[data-bilan-choix="precedent"]').getAttribute('aria-checked') : null }; }, MOIS_DERNIER);
        dit(x.visible && x.ouvert && x.marque && !erreurs.length, `${largeur} · « Bilan du mois » de ${MOIS_DERNIER} (mois dernier) choisi, déplié, à l’écran, mis en évidence`, JSON.stringify(x) + ' ' + erreurs.join('|'));
        await capture(pg, `bilan-recap-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
  } finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ lot5355 : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ lot5355 : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
