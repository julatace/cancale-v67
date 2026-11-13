require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE PARRAINAGE, CLAIR ET VISIBLE » (13 nov., lot 54) — RENDU, avec un
//  faux serveur (aucun Stripe, aucune base réelle) :
//    1. Réglages → Mon abonnement → Parrainage : la phrase « Parraine un
//       vendeur : 1 mois offert pour toi et pour lui », le lien personnel,
//       « Copier le lien » (le presse-papiers reçoit LE lien), « Partager » par
//       le partage natif quand il existe (téléphone), absent sinon ; le total de
//       mois gagnés (parrain + son propre mois de filleul) ; une ligne PAR
//       filleul (inscrit · a payé son 1er mois · mois offert) SANS identité ; le
//       nom affiché chez le filleul, refus du serveur DIT, nom accepté rangé ;
//    2. le menu « Plus » (téléphone) : UNE ligne « Parrainer » quand le
//       programme est ouvert, qui amène au groupe Parrainage ; aucune ligne s'il
//       est fermé ; aucune pop-up ;
//    3. le lien ouvert SANS session (`/r/CODE`, `/?parrain=CODE`) : l'INSCRIPTION
//       s'ouvre (jamais la page d'accueil, qui perdait le code), avec « Offert
//       par <nom choisi> » (ou « un vendeur VRM »), rien quand c'est fermé ; le
//       code part avec l'inscription (`data.parrain`).
//    390 px tactile (sombre) et 1512 px (clair) ; rien ne déborde.
//  Aucune fixture : tout est inventé ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 24311;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-parrainage-lot54');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION_BANC = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse@exemple.test' } };
const PHRASE = 'Parraine un vendeur : 1 mois offert pour toi et pour lui';
const CODE = 'K7MQ4RZP', LIEN = 'https://vrm.center/r/' + CODE;
const ABO = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: true, prix: { montant: 16.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, statut: 'active', finPeriode: new Date(Date.now() + 20 * 864e5).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' } };
const PARRAIN = {
  ok: true, installe: true, ouvert: true, code: CODE, modeTest: true, moisCentimes: 1699, nom: 'Julie',
  suivi: { inscrits: 3, payes: 2, moisOfferts: 1, enAttente: 0 },
  filleuls: [{ rang: 1, inscritLe: '2026-11-02', etat: 'offert' }, { rang: 2, inscritLe: '2026-11-09', etat: 'paye' }, { rang: 3, inscritLe: '2026-11-12', etat: 'inscrit' }],
  filleul: { parraine: true, moisOffert: true, paye: true, offertPar: 'Marc', attendVinted: false },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

// `session` : un vendeur connecté (Réglages, menu) · sans : le lien ouvert par un inconnu.
async function ouvrir(nav, { chemin = '/?tab=settings', largeur = 1512, sombre = false, session = true, parrain = PARRAIN, apercu = { ok: true, ouvert: true, connu: true, nom: 'Julie' }, partage = null }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre, session, partage }) => {
    try {
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
      if (session) {
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now()));
        localStorage.setItem('vrm_reglages_vue', 'abonnement');
        localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 }));
        const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t }));
      }
    } catch (_) {}
    // Le partage natif : présent (téléphone) ou absent (ordinateur) — jamais celui du système du banc.
    window.__partages = [];
    try {
      if (partage) Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: function (d) { window.__partages.push(d); return Promise.resolve(); } });
      else { try { delete Navigator.prototype.share; } catch (_) {} Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined }); }
    } catch (_) {}
  }, { s: SESSION_BANC, sombre, session, partage });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  const inscriptions = [];
  await pg.route('**/auth/v1/**', (r) => {
    const u = r.request().url();
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: false, discord: false }, disable_signup: false, mailer_autoconfirm: false }) });
    if (/\/auth\/v1\/signup/.test(u)) { inscriptions.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', email: 'nouvelle@exemple.test', confirmation_sent_at: new Date().toISOString() }) }); }
    if (!session) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"pas de session"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION_BANC.user }) });
  });
  await pg.route('**/rest/v1/**', (r) => {
    const m = r.request().method();
    if (m !== 'GET' && !/\/rpc\//.test(r.request().url())) { let rows = []; try { const b = JSON.parse(r.request().postData() || '[]'); rows = Array.isArray(b) ? b : [b]; } catch (_) {} return r.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(rows) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  let etat = JSON.parse(JSON.stringify(parrain));
  await pg.route('**/api/**', async (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ABO) });
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, carte: null, factures: [] }) });
    if (/mode=parrainage/.test(u)) {
      const corps = r.request().postData() || '';
      appels.push({ m, u, corps, auth: !!(r.request().headers().authorization) });
      if (m === 'GET' && /[?&]code=/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apercu) });
      if (m === 'POST') {
        let b = {}; try { b = JSON.parse(corps); } catch (_) {}
        if (b.action === 'nom') {
          if (/juju/i.test(b.nom)) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, raison: 'pseudo-vinted', message: 'C’est ton pseudo Vinted : choisis plutôt ton prénom ou un pseudo VRM.' }) });
          etat = { ...etat, nom: b.nom.trim() || null };
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, nom: etat.nom }) });
        }
        return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, raison: 'deja-parraine', message: 'Ton compte a déjà un parrain.' }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(etat) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, erreurs, appels, inscriptions };
}
const attendre = (pg, sel, ms = 12000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true, () => false);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ pas de dist/ (npm run build)'); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── 1. Réglages → Mon abonnement → Parrainage');
    for (const [largeur, sombre, partage] of [[1512, false, false], [390, true, true]]) {
      await essaie('écran ' + largeur, async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { largeur, sombre, partage });
        const vu = await attendre(pg, '[data-parrainage="ouvert"]');
        await pg.locator('[data-parrainage="ouvert"]').scrollIntoViewIfNeeded().catch(() => {});
        const r = await pg.evaluate(() => {
          const g = document.querySelector('[data-parrainage="ouvert"]'); if (!g) return null;
          const t = (s) => { const e = g.querySelector(s); return e ? e.innerText.trim() : null; };
          return {
            titre: t('[data-parrainage-titre]'), lien: t('[data-lien-parrainage]'), mois: t('[data-chiffre-mois]'), gagnes: g.getAttribute('data-mois-gagnes'),
            copier: !!g.querySelector('[data-copier-parrainage]'), partager: !!g.querySelector('[data-partager-parrainage]'),
            filleuls: [...g.querySelectorAll('[data-filleul]')].map((x) => ({ e: x.getAttribute('data-filleul'), t: x.innerText.replace(/\s+/g, ' ').trim() })),
            nom: (g.querySelector('[data-parrainage-nom]') || {}).getAttribute ? g.querySelector('[data-parrainage-nom]').getAttribute('data-parrainage-nom') : null,
            parraine: (g.querySelector('[data-parraine]') || { innerText: '' }).innerText.replace(/\s+/g, ' '), texte: g.innerText,
            deborde: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        dit(vu && !!r && r.titre === 'Parraine un vendeur : 1 mois offert pour toi et pour lui', `${largeur} px : la phrase « ${PHRASE} »`, JSON.stringify(r && r.titre));
        dit(!!r && r.lien === LIEN && r.copier, '  le lien personnel et « Copier le lien »', JSON.stringify(r && { l: r.lien, c: r.copier }));
        dit(!!r && r.partager === partage, partage ? '  téléphone : « Partager » (partage natif)' : '  sans partage natif : pas de bouton « Partager » qui ne mènerait nulle part', JSON.stringify(r && r.partager));
        dit(!!r && r.mois === '2' && r.gagnes === '2', '  « Mois gagnés : 2 » (1 comme parrain + le sien comme filleul)', JSON.stringify(r && r.mois));
        const etats = r ? r.filleuls.map((x) => x.e).join(',') : '';
        dit(etats === 'offert,paye,inscrit' && /^Filleul 1 inscrit le 2 nov\. · a payé son 1er mois Mois offert$/.test(r.filleuls[0].t) && /a payé son 1er mois/.test(r.filleuls[1].t) && /A payé$/.test(r.filleuls[1].t) && /pas encore payé son 1er mois Inscrit$/.test(r.filleuls[2].t), '  une ligne par filleul : inscrit · a payé son 1er mois · mois offert', JSON.stringify(r && r.filleuls));
        dit(!!r && !/@|[0-9a-f]{8}-[0-9a-f]{4}-/.test(r.texte), '  aucune adresse ni identifiant à l’écran');
        dit(!!r && r.nom === 'Julie' && /Offert par Marc/.test(r.parraine), '  « Ton nom chez tes filleuls : Julie » ; son propre parrainage « Offert par Marc »', JSON.stringify(r && { n: r.nom, p: r.parraine }));
        dit(appels.every((a) => a.m === 'GET'), '  ouvrir l’écran n’écrit rien');
        if (largeur === 390) dit(r && r.deborde <= 0, '  390 px : rien ne déborde', String(r && r.deborde));
        await capture(pg, `reglages-${largeur}${sombre ? '-sombre' : ''}`);
        // Copier : le presse-papiers reçoit LE lien.
        await pg.click('[data-copier-parrainage]');
        await pg.waitForTimeout(300);
        const presse = await pg.evaluate(() => navigator.clipboard.readText().catch(() => null));
        dit(presse === LIEN, '  « Copier le lien » met le lien dans le presse-papiers', JSON.stringify(presse));
        if (partage) {
          await pg.click('[data-partager-parrainage]'); await pg.waitForTimeout(200);
          const p = await pg.evaluate(() => window.__partages);
          dit(p.length === 1 && p[0].url === LIEN && /1 mois/.test(p[0].text || ''), '  « Partager » ouvre le partage natif avec le lien', JSON.stringify(p));
        }
        // Le nom : un refus du serveur est DIT ; un nom accepté est rangé.
        await pg.click('[data-parrainage-nom-ouvrir] button, button[data-parrainage-nom-ouvrir], [data-parrainage-nom-ouvrir]');
        await attendre(pg, '[data-parrainage-nom-form] input', 4000);
        await pg.fill('[data-parrainage-nom-form] input', 'juju_sneakers');
        await pg.click('[data-parrainage-nom-enregistrer]');
        const refus = await attendre(pg, '[data-parrainage-nom-refus]', 4000);
        const tRefus = refus ? await pg.innerText('[data-parrainage-nom-refus]') : '';
        dit(refus && /pseudo Vinted/.test(tRefus), '  un pseudo Vinted : refusé, et la raison est dite', tRefus);
        if (largeur === 390) await capture(pg, 'nom-refus-390-sombre');
        await pg.fill('[data-parrainage-nom-form] input', 'Julie B');
        await pg.click('[data-parrainage-nom-enregistrer]');
        await pg.waitForTimeout(500);
        const nom2 = await pg.evaluate(() => { const e = document.querySelector('[data-parrainage-nom]'); return e && e.getAttribute('data-parrainage-nom'); });
        const post = appels.filter((a) => a.m === 'POST').map((a) => JSON.parse(a.corps));
        dit(nom2 === 'Julie B' && post.length === 2 && post.every((b) => b.action === 'nom' && !('owner' in b)), '  « Julie B » accepté et affiché ; le corps ne porte que le nom (jamais un owner)', JSON.stringify({ nom2, post }));
        dit(!erreurs.length, '  aucune erreur de page', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    console.log('\n── 2. Le menu « Plus » (téléphone) : une ligne « Parrainer »');
    await essaie('menu ouvert', async () => {
      const { ctx, pg } = await ouvrir(nav, { largeur: 390, sombre: false, chemin: '/?tab=journee', partage: true });
      await pg.click('.vrm-nav-more');
      const tuile = await attendre(pg, '[data-nav-entree="parrainage"]', 6000);
      const n = await pg.evaluate(() => document.querySelectorAll('[data-nav-entree="parrainage"]').length);
      dit(tuile && n === 1, 'programme ouvert : UNE ligne « Parrainer » dans « Plus »', String(n));
      const lib = tuile ? await pg.innerText('[data-nav-entree="parrainage"]') : '';
      dit(/Parrainer/.test(lib), '  son nom : « Parrainer »', lib);
      await capture(pg, 'menu-plus-390');
      if (tuile) await pg.click('[data-nav-entree="parrainage"]');
      const arrive = await attendre(pg, '[data-parrainage="ouvert"]', 12000);
      await pg.waitForTimeout(900);
      const r = await pg.evaluate(() => { const g = document.querySelector('[data-parrainage="ouvert"]'); if (!g) return null; const b = g.getBoundingClientRect(); return { haut: Math.round(b.top), h: window.innerHeight, url: location.search, modal: !!document.querySelector('[role="dialog"][aria-modal="true"]') }; });
      dit(arrive && r && r.haut >= 0 && r.haut < r.h, '  la toucher amène au groupe Parrainage (Réglages → Mon abonnement), à l’écran', JSON.stringify(r));
      dit(r && !r.modal, '  aucune pop-up');
      await capture(pg, 'menu-vers-parrainage-390');
      await ctx.close();
    });
    await essaie('menu fermé', async () => {
      const { ctx, pg } = await ouvrir(nav, { largeur: 390, chemin: '/?tab=journee', apercu: { ok: true, ouvert: false, connu: false, nom: null } });
      await pg.click('.vrm-nav-more'); await pg.waitForTimeout(1200);
      const n = await pg.evaluate(() => document.querySelectorAll('[data-nav-entree="parrainage"]').length);
      const autres = await pg.evaluate(() => document.querySelectorAll('[data-nav-entree]').length);
      dit(n === 0 && autres > 0, 'programme fermé : aucune ligne « Parrainer » (le reste du menu est là)', `${n} / ${autres}`);
      await ctx.close();
    });

    console.log('\n── 3. Le lien ouvert sans session : l’inscription, « Offert par … »');
    for (const [chemin, largeur] of [[`/r/${CODE}`, 390], [`/?parrain=${CODE}`, 1512]]) {
      await essaie('lien ' + chemin, async () => {
        const { ctx, pg, appels, inscriptions } = await ouvrir(nav, { session: false, chemin, largeur, sombre: largeur === 390 });
        const vu = await attendre(pg, '[data-parrain-offert]', 12000);
        const r = await pg.evaluate(() => {
          const b = document.querySelector('[data-parrain-offert]');
          const h = document.getElementById('vrm-cx-titre-formulaire');
          let code = null; try { code = localStorage.getItem('vrm_parrain_code'); } catch (_) {}
          return { b: b ? b.innerText.replace(/\s+/g, ' ') : null, attr: b && b.getAttribute('data-parrain-offert'), titre: h ? h.innerText : null, prenom: !!document.querySelector('input[autocomplete="given-name"]'), code, deborde: document.documentElement.scrollWidth - window.innerWidth };
        });
        dit(vu && r.attr === 'Julie' && /Offert par Julie/.test(r.b) && /1 mois de VRM offert/.test(r.b), `${chemin} : « Offert par Julie » (le nom choisi)`, JSON.stringify(r));
        dit(r.prenom && /Crée|Créer|compte/i.test(r.titre || ''), '  c’est l’INSCRIPTION qui s’ouvre (jamais la page d’accueil)', JSON.stringify(r.titre));
        dit(r.code === CODE, '  le code est gardé pour le rattachement après connexion', JSON.stringify(r.code));
        const pub = appels.filter((a) => /code=/.test(a.u));
        dit(pub.length >= 1 && pub.every((a) => a.m === 'GET' && !a.auth), '  le nom est lu SANS session (GET public)', JSON.stringify(pub.map((a) => a.m + (a.auth ? '+auth' : ''))));
        if (largeur === 390) dit(r.deborde <= 0, '  390 px : rien ne déborde', String(r.deborde));
        await capture(pg, `inscription-${largeur}${largeur === 390 ? '-sombre' : ''}`);
        // L'inscription emporte le code (confirmation ouverte ailleurs : il suit le compte).
        await pg.fill('input[type="email"]', 'nouvelle@exemple.test').catch(() => {});
        await pg.fill('#vrm-cx-password', 'Un-mot-de-passe-long-42!').catch(() => {});
        const cgv = await pg.$$('input[type="checkbox"]'); for (const c of cgv) await c.check().catch(() => {});
        await pg.click('form.vrm-cx-form button[type="submit"]').catch(() => {});
        await pg.waitForTimeout(1500);
        const corps = inscriptions.map((x) => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean);
        dit(corps.length === 1 && corps[0].data && corps[0].data.parrain === CODE, '  l’inscription envoie `data.parrain` (le code suit le compte)', JSON.stringify(corps.map((c) => c.data)));
        await ctx.close();
      });
    }
    await essaie('lien sans nom choisi', async () => {
      const { ctx, pg } = await ouvrir(nav, { session: false, chemin: `/r/${CODE}`, largeur: 390, apercu: { ok: true, ouvert: true, connu: true, nom: null } });
      const vu = await attendre(pg, '[data-parrain-offert]', 12000);
      const t = vu ? (await pg.innerText('[data-parrain-offert]')).replace(/\s+/g, ' ') : '';
      dit(vu && /Offert par un vendeur VRM/.test(t), 'aucun nom choisi : « Offert par un vendeur VRM » (jamais un pseudo deviné)', t);
      await ctx.close();
    });
    await essaie('lien programme fermé', async () => {
      const { ctx, pg } = await ouvrir(nav, { session: false, chemin: `/r/${CODE}`, largeur: 390, apercu: { ok: true, ouvert: false, connu: false, nom: null } });
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => ({ b: !!document.querySelector('[data-parrain-offert]'), form: !!document.querySelector('form.vrm-cx-form') }));
      dit(r.form && !r.b, 'programme fermé : l’inscription s’ouvre, rien n’est promis', JSON.stringify(r));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(`\n${ko ? '❌' : '✅'} banc parrainage-lot54 : ${ok} verts, ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  }
})();
