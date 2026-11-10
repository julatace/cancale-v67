require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc de rendu — la feuille « Ton adresse VRM » (8 nov.)
//  Données INVENTÉES, dans la vraie forme de `/api/email-rattacher?mode=adresse-unique`
//  (GET : { pret, adresse, actif, dernier, code } ; POST { geste }). Ouverte depuis
//  E-mails → « Relier ma boîte » → « Ton adresse VRM », à 390 px tactile et
//  1512 px, clair et sombre. Juge : l'adresse affichée = celle de la route, en
//  monospace, entière (jamais coupée par « … ») ; « Copier l'adresse » met
//  l'adresse dans le presse-papiers ; « Envoyer un e-mail d'essai » est un
//  `mailto:` vers elle ; « Dernier e-mail reçu il y a 3 min » ; le code Gmail en
//  grand avec « Copier le code » et le lien Google ; « Adresse active » envoie
//  `{geste:'actif'}` et la feuille le dit ; « Remplacer » demande d'abord, puis
//  montre la nouvelle ; un refus du serveur fait revenir l'interrupteur ; les
//  quatre messageries ont leur pas-à-pas et leur schéma ; « pas encore ouverte »
//  et « pas su » ont leur phrase ; ni débordement, ni cible < 44 px, ni erreur
//  JavaScript, ni violet, ni rouge. Captures dans CAPTURE_DIR (à REGARDER).
//  (10 nov., lot AQ) Et depuis Paramètres → Mes e-mails : la ligne « Mon adresse
//  VRM », juste avant « SMS de colis » (gardée), ouvre la MÊME feuille, qui lit
//  la route et se referme ; captures `reglages-*` (390/1512, clair/sombre).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7981);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-adresse-reception');
fs.mkdirSync(CAPT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const MAINTENANT = Date.UTC(2026, 10, 8, 15, 5);
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };
const A1 = 'k7p2m9x4q8w3e6r5t2y7u9a3@recu-banc.test', A2 = 'n4h8c2v6b3z9m5x7q2w8e4r6@recu-banc.test';

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { viewport, tactile, sombre, etat = 'pret', refusActif = false, depuis = 'emails' }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_reglages_vue', 'reglages'); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 201, contentType: 'application/json', body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })));
  // La route, à état (la forme réelle de api/email-rattacher.js).
  const srvEtat = { adresse: A1, actif: true, dernier: { at: new Date(MAINTENANT - 3 * 60000).toISOString(), sujet: "Ton article s'est vendu !", de: 'Vinted <no-reply@vinted.fr>' }, code: { fournisseur: 'gmail', code: '482913765', lien: 'https://mail-settings.google.com/mail/vf-banc', source: 'sophie.perso@gmail.com', signe: true, recuLe: new Date(MAINTENANT - 60000).toISOString() } };
  const appels = [];
  await pg.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) });
    if (u.pathname === '/api/email-rattacher' && u.searchParams.get('mode') === 'adresse-unique') {
      const m = r.request().method(); let corps = null; try { corps = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
      appels.push({ m, corps, auth: r.request().headers().authorization || '' });
      if (etat === 'panne') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'base-injoignable' }) });
      if (etat === 'pas-prete') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pret: false, manque: 'domaine', message: '…' }) });
      if (m === 'POST' && corps && corps.geste === 'actif') { if (refusActif) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'base-injoignable' }) }); srvEtat.actif = corps.actif; }
      if (m === 'POST' && corps && corps.geste === 'remplacer') { srvEtat.adresse = A2; srvEtat.actif = true; srvEtat.dernier = null; srvEtat.code = null; }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pret: true, ...srvEtat, creeLe: '2026-11-08T10:00:00Z', remplaceLe: null }) });
    }
    if (u.pathname === '/api/email-rattacher') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0, parRubrique: {} }, adresses: [] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  if (depuis === 'reglages') {
    // (10 nov., lot AQ) Paramètres → Mes e-mails → « Mon adresse VRM ».
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.locator('[data-reglage-adresse-vrm]').first().waitFor({ timeout: 30000 });
    return { ctx, pg, erreurs, appels };
  }
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-boite-vue="relier"]').click({ timeout: 15000 });
  await pg.locator('[data-ouvrir-adresse-reception]').first().click();
  await pg.locator('[data-feuille-adresse-reception]').waitFor();
  await pg.waitForFunction(() => document.querySelector('[data-feuille-adresse-reception]')?.dataset.etat !== 'lecture', null, { timeout: 8000 });
  await pg.waitForTimeout(450);   // la feuille fini de monter
  return { ctx, pg, erreurs, appels };
}

// Au doigt (390 tactile) : 44 px partout (§7). À la souris, le segmenté garde la hauteur de
// toute l'app (36 px, src/styles-coque.css) ; les boutons restent à 44.
const regles = async (pg, nom, tactile = true) => {
  const f = pg.locator('[data-feuille-adresse-reception]');
  const petites = await f.evaluate((n, tactile) => [...n.querySelectorAll('button, a[href], [role="switch"]')].filter((x) => { const r = x.getBoundingClientRect(); const min = !tactile && x.classList.contains('vrm-seg-btn') ? 32 : 43.5; return r.width > 0 && (r.height < min || (r.width < 43.5)); }).map((x) => (x.innerText || x.getAttribute('aria-label') || x.className).trim().slice(0, 40) + ' ' + Math.round(x.getBoundingClientRect().width) + '×' + Math.round(x.getBoundingClientRect().height)), tactile);
  dit(petites.length === 0, `${nom} : chaque cible fait au moins 44 px${tactile ? '' : ' (segmenté à la souris : la hauteur de l’app)'}`, petites.slice(0, 5).join(' · '));
  // (vu sur la première capture : les cartes passaient sous le bord droit — la feuille,
  // elle, gardait sa largeur ; on juge donc chaque élément contre l'ÉCRAN et la zone qui défile.)
  const debord = await pg.evaluate(() => { const f = document.querySelector('[data-feuille-adresse-reception]'); const r = f.getBoundingClientRect(); const corps = f.querySelector('.vrm-fs-corps'); const sortis = [...f.querySelectorAll('*')].filter((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && !x.closest('.vrm-ar-schema-champ') && (q.right > Math.min(r.right, innerWidth) + 1 || q.left < Math.max(r.left, 0) - 1); }).map((x) => x.className || x.tagName); return { page: document.documentElement.scrollWidth > innerWidth + 1, corps: corps ? corps.scrollWidth > corps.clientWidth + 1 : false, sortis: sortis.slice(0, 3), n: sortis.length }; });
  dit(!debord.page && !debord.corps && debord.n === 0, `${nom} : rien ne déborde (ni de l'écran, ni de la feuille)`, JSON.stringify(debord));
  const couleurs = await f.evaluate((n) => [...n.querySelectorAll('*')].map((x) => getComputedStyle(x).color + '|' + getComputedStyle(x).backgroundColor).join(' '));
  const rgb = [...couleurs.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].map((m) => m.slice(1).map(Number));
  const violet = rgb.filter(([r, g, b]) => b > 150 && r > 110 && g < 90), rouge = rgb.filter(([r, g, b]) => r > 190 && g < 70 && b < 70);
  dit(!violet.length && !rouge.length, `${nom} : ni violet ni rouge (une adresse n'est pas un doublon de N°)`, JSON.stringify([violet[0], rouge[0]]));
};

(async () => {
  srv.listen(PORT);
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [nom, vp, tactile, sombre] of [['390 clair', { width: 390, height: 844 }, true, false], ['390 sombre', { width: 390, height: 844 }, true, true], ['1512 clair', { width: 1512, height: 945 }, false, false], ['1512 sombre', { width: 1512, height: 945 }, false, true]]) {
      await essaie(nom, async () => {
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { viewport: vp, tactile, sombre });
        const f = pg.locator('[data-feuille-adresse-reception]');
        const tag = nom.replace(/\s+/g, '-');
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `${tag}-haut.png`) });
        const adr = await f.locator('[data-adresse-reception]').first();
        const lu = await adr.evaluate((n) => ({ t: n.innerText.replace(/\s+/g, ''), d: n.dataset.adresseReception, ff: getComputedStyle(n).fontFamily, coupe: n.scrollWidth > n.clientWidth + 1 || /…/.test(n.innerText) }));
        dit(lu.t === A1 && lu.d === A1 && /mono|Menlo/i.test(lu.ff) && !lu.coupe, `${nom} : l'adresse de la route, entière, en monospace`, JSON.stringify(lu));
        dit(appels.length >= 1 && appels[0].m === 'GET' && /^Bearer jeton-de-banc/.test(appels[0].auth), `${nom} : lue par SA session (GET, jeton de la session)`, JSON.stringify(appels[0]));
        if (!tactile) {
          await f.locator('[data-copier-adresse]').click();
          const presse = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
          dit(presse === A1 && /Copié/.test(await f.locator('[data-copier-adresse]').innerText()), `${nom} : « Copier l'adresse » la met dans le presse-papiers et le dit`, presse);
        }
        const essai = await f.locator('[data-essai]').getAttribute('href');
        dit(String(essai).startsWith('mailto:' + A1), `${nom} : « Envoyer un e-mail d'essai » écrit à SON adresse`, essai);
        const etat = await f.locator('.vrm-ar-etat').evaluate((n) => ({ t: n.innerText.replace(/\s+/g, ' '), ton: n.dataset.ton }));
        dit(etat.ton === 'ok' && /Dernier e-mail reçu il y a 3\s?min/.test(etat.t), `${nom} : « Dernier e-mail reçu il y a 3 min » (la preuve que le transfert marche)`, etat.t);
        const code = f.locator('[data-code-transfert="gmail"]');
        const cl = await code.evaluate((n) => ({ v: n.querySelector('[data-code-valeur]')?.dataset.codeValeur, lien: n.querySelector('[data-lien-confirmation]')?.getAttribute('href'), src: n.innerText.includes('sophie.perso@gmail.com'), taille: parseFloat(getComputedStyle(n.querySelector('[data-code-valeur]')).fontSize) }));
        dit(cl.v === '482913765' && /^https:\/\/mail-settings\.google\.com\//.test(cl.lien) && cl.src && cl.taille >= 28, `${nom} : le code Gmail en grand, sa source, « Copier le code » et le lien de Google`, JSON.stringify(cl));
        if (!tactile) {
          await f.locator('[data-copier-code]').click();
          dit(await pg.evaluate(() => navigator.clipboard.readText().catch(() => '')) === '482913765', `${nom} : « Copier le code » copie les chiffres seuls (sans les espaces fines d'affichage)`);
        }
        // Les quatre messageries.
        const pas = {};
        for (const id of ['gmail', 'icloud', 'outlook', 'yahoo']) {
          await f.locator(`[data-fournisseur="${id}"]`).click();
          pas[id] = await f.locator(`[data-etapes="${id}"] li`).count() + (await f.locator(`[data-schema="${id}"]`).count() ? 100 : 0);
        }
        dit(Object.values(pas).every((n) => n >= 103), `${nom} : Gmail, iCloud, Outlook, Yahoo — chacun son pas-à-pas et son schéma`, JSON.stringify(pas));
        await f.locator('[data-fournisseur="gmail"]').click();
        dit(await f.locator('[data-bloc="vinted"]').count() === 1 && /Paramètres → Compte → E.mail/.test(await f.locator('[data-bloc="vinted"]').innerText()) && /expéditeur d’origine/.test(await f.locator('[data-bloc="manuel"]').innerText()), `${nom} : « Ou l'e-mail d'un compte Vinted » et « Pas de transfert à la main » sont dits`);
        await regles(pg, nom, tactile);
        await f.locator('[data-bloc="transfert"]').scrollIntoViewIfNeeded();
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `${tag}-transfert.png`) });
        // Adresse active ⇒ éteinte.
        await f.locator('[data-interrupteur-adresse]').click();
        await pg.waitForFunction(() => document.querySelector('[data-feuille-adresse-reception]')?.dataset.etat === 'off');
        const post = appels.find((a) => a.m === 'POST' && a.corps && a.corps.geste === 'actif');
        dit(post && post.corps.actif === false && await f.locator('[data-interrupteur-adresse]').getAttribute('aria-checked') === 'false' && /Désactivée/.test(await f.locator('.vrm-ar-etat').innerText()), `${nom} : « Adresse active » éteinte ⇒ {geste:'actif', actif:false}, la feuille dit « Désactivée »`, JSON.stringify(post));
        await f.locator('[data-interrupteur-adresse]').click();
        await pg.waitForFunction(() => document.querySelector('[data-feuille-adresse-reception]')?.dataset.etat === 'active');
        // Remplacer : demande d'abord.
        await f.locator('[data-remplacer]').scrollIntoViewIfNeeded();
        await f.locator('[data-remplacer]').click();
        const nAv = appels.filter((a) => a.m === 'POST' && a.corps && a.corps.geste === 'remplacer').length;
        dit(await f.locator('[data-confirmer-remplacer]').count() === 1 && nAv === 0, `${nom} : « Remplacer l'adresse » DEMANDE d'abord (rien d'envoyé)`);
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `${tag}-remplacer.png`) });
        await f.locator('[data-remplacer-ok]').click();
        await pg.waitForFunction((a) => document.querySelector('[data-adresse-reception]')?.dataset.adresseReception === a, A2);
        dit(/Adresse remplacée/.test(await f.locator('[data-retour]').innerText()) && await f.locator('[data-code-transfert]').count() === 0 && /Aucun e-mail reçu/.test(await f.locator('.vrm-ar-etat').innerText()), `${nom} : remplacée ⇒ la nouvelle adresse, plus le code ni le « dernier reçu » de l'ancienne`);
        await f.locator('[data-termine]').click();
        await pg.waitForTimeout(500);
        dit(await pg.locator('[data-feuille-adresse-reception]').count() === 0, `${nom} : « Terminé » ferme la feuille`);
        dit(erreurs.length === 0, `${nom} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
    await essaie('refus du serveur', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, refusActif: true });
      const f = pg.locator('[data-feuille-adresse-reception]');
      await f.locator('[data-interrupteur-adresse]').click();
      await f.locator('[data-retour]').waitFor();
      dit(await f.locator('[data-interrupteur-adresse]').getAttribute('aria-checked') === 'true' && /Pas enregistré/.test(await f.locator('[data-retour]').innerText()), 'refus : l’interrupteur revient sur « active » et la feuille dit « Pas enregistré »');
      dit(erreurs.length === 0, 'refus : aucune erreur JavaScript', erreurs.join(' '));
      await ctx.close();
    });
    for (const [nom, vp, tactile, sombre] of [['390 clair', { width: 390, height: 844 }, true, false], ['390 sombre', { width: 390, height: 844 }, true, true], ['1512 clair', { width: 1512, height: 945 }, false, false], ['1512 sombre', { width: 1512, height: 945 }, false, true]]) {
      await essaie('Paramètres ' + nom, async () => {
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { viewport: vp, tactile, sombre, depuis: 'reglages' });
        const tag = 'reglages-' + nom.replace(/\s+/g, '-');
        const g = pg.locator('[data-groupe-reglages="emails-reglages"]');
        await g.scrollIntoViewIfNeeded();
        const ordre = await g.evaluate((n) => [...n.querySelectorAll('.vrm-set-ligne')].map((x) => x.hasAttribute('data-reglage-adresse-vrm') ? 'adresse' : x.getAttribute('data-sous-ouvrir') === 'sms-colis' ? 'sms' : 'autre'));
        const iA = ordre.indexOf('adresse');
        dit(iA >= 0 && ordre[iA + 1] === 'sms', `${nom} : Mes e-mails — « Mon adresse VRM » juste avant « SMS de colis » (gardée)`, ordre.join(' · '));
        const h = await pg.locator('[data-reglage-adresse-vrm]').first().evaluate((n) => Math.round(n.getBoundingClientRect().height));
        dit(h >= 44, `${nom} : la ligne fait au moins 44 px`, String(h));
        dit(appels.length === 0, `${nom} : rien n'est demandé au serveur avant son toucher`, String(appels.length));
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `${tag}-ligne.png`) });
        await pg.locator('[data-reglage-adresse-vrm]').first().click();
        const f = pg.locator('[data-feuille-adresse-reception]');
        await f.waitFor({ timeout: 15000 });
        await pg.waitForFunction(() => document.querySelector('[data-feuille-adresse-reception]')?.dataset.etat === 'active', null, { timeout: 15000 });
        await pg.waitForTimeout(450);
        const adr = await f.locator('[data-adresse-reception]').first().getAttribute('data-adresse-reception');
        dit(adr === A1 && appels.length >= 1 && appels[0].m === 'GET' && /^Bearer jeton-de-banc/.test(appels[0].auth), `${nom} : la feuille lit SON adresse (GET, sa session)`, adr);
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `${tag}-feuille.png`) });
        await f.locator('[data-termine]').scrollIntoViewIfNeeded();
        await f.locator('[data-termine]').click();
        await pg.waitForTimeout(500);
        dit(await pg.locator('[data-feuille-adresse-reception]').count() === 0 && await pg.locator('[data-reglage-adresse-vrm]').count() === 1, `${nom} : « Terminé » ramène à Paramètres`);
        dit(erreurs.length === 0, `${nom} (Paramètres) : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
    for (const [etat, sombre] of [['pas-prete', false], ['panne', true]]) {
      await essaie(etat, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { viewport: { width: 390, height: 844 }, tactile: true, sombre, etat });
        const f = pg.locator('[data-feuille-adresse-reception]');
        await pg.screenshot({ timeout: 30000, animations: 'disabled', path: path.join(CAPT, `390-${etat}.png`) });
        if (etat === 'pas-prete') dit(await f.getAttribute('data-etat') === 'pas-prete' && /pas encore ouverte/.test(await f.innerText()) && await f.locator('[data-adresse-reception="pas-prete"]').count() === 1 && await f.locator('code').count() === 0, 'pas encore ouverte : la feuille le dit (sans consigne d’administrateur pour un vendeur), aucune adresse inventée');
        else dit(await f.getAttribute('data-etat') === 'pas-su' && await f.getByRole('button', { name: /Réessayer/ }).count() === 1 && await f.locator('[data-adresse-reception]').evaluateAll((l) => l.every((x) => !/@/.test(x.innerText))), 'pas su : la raison et « Réessayer », jamais une adresse');
        dit(erreurs.length === 0, `${etat} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log({ ok, ko, captures: CAPT }); process.exit(ko ? 1 : 0);
})();
