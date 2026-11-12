require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc — l'écran E-mails, DENSE comme Mail sur Mac (11 nov., lot emails-ecran)
//  Julien : « les mails doivent être retravaillés, je n'aime pas trop, surtout
//  sur ordi : tout fait trop gros ».
//
//  Ce banc MESURE les tailles RENDUES (taille calculée × zoom effectif : au
//  téléphone, `.vrm-main` est à 80 %), à 1512×950 et 1280×800 (souris) et à
//  390×844 (doigt), clair et sombre : titre de l'écran, lignes de la liste
//  (police, interligne, hauteur), lignes visibles sans défiler, largeur de la
//  liste, lecture (titre, corps, caractères par ligne), code de retrait, montant,
//  mise en page HTML d'origine (échelle 1 = taille naturelle) ; puis les GESTES
//  (ouvrir, suivant au clavier, revenir) et les fonctions qui doivent rester.
//
//  La base servie : la boîte inventée (_fx-boite-mail.cjs) + deux e-mails à HTML
//  inventés (_fx-email-html.cjs) ; la route est la VRAIE (api/_lib/reception-email.js).
//  `BANC_DIST=<dist d'avant>` : les mêmes mesures sur le code d'avant (rouge voulu).
//  Mesures dans CAPTURE_DIR/densite.json, captures à regarder.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { servir } = require('./_minipgrest.cjs');
const { VENTE_HTML, RETRAIT_HTML } = require('./_fx-email-html.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 12420);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-emails-densite');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const FX = require('./_fx-boite-mail.cjs').construire();
const OWNER = FX.owner, MAINTENANT = FX.maintenant;
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: OWNER, email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };

const at = (min) => new Date(MAINTENANT - min * 60000).toISOString();
const cle = (c) => (c.repeat(64)).slice(0, 64);
const ID = { vente: 'email_reception_' + cle('d1'), retrait: 'email_reception_' + cle('d2') };
const lignesHtml = (H) => {
  const v = H.assainirHtml(VENTE_HTML), r = H.assainirHtml(RETRAIT_HTML);
  const recu = (id, min, type, resume, subject, from) => ({ owner: OWNER, id, data: { at: at(min), etat: 'integre', type, subject, from, adresses: ['une@exemple.test'], resume, pieces: [] } });
  return [
    recu(ID.vente, 1, 'vente', { v: 1, t: 'vente', a: 'Baskets Exemple Runner 42', px: '55,00' }, 'Ton article est vendu !', "\"L'équipe Vinted\" <no-reply@vinted.fr>"),
    { owner: OWNER, id: ID.vente.replace('reception', 'texte'), data: { at: at(1), texte: 'Ton article est vendu ! acheteur-invente a acheté ton article. Expédie-le dans les 5 jours : le bordereau est dans ta conversation. Nous transférerons le paiement sur ton porte-monnaie une fois la commande terminée.' } },
    { owner: OWNER, id: ID.vente.replace('reception', 'html'), meta: { at: at(1) }, data: { v: 1, at: at(1), html: v.html, octets: v.octets, images: v.images, pixels: v.pixels, sombre: 0 } },
    recu(ID.retrait, 2, 'suivi', { v: 1, t: 'suivi', tr: 'mondialrelay', s: '00001111', st: 'available', code: '418205', lieu: "Relais de l'Exemple" }, 'Votre colis est disponible', 'Mondial Relay <noreply@mondialrelay.fr>'),
    { owner: OWNER, id: ID.retrait.replace('reception', 'texte'), data: { at: at(2), texte: 'Votre colis est disponible au Relais de l’Exemple. Présentez le code 418205 et une pièce d’identité. Il vous attend pendant 8 jours ouvrés ; passé ce délai il repartira chez l’expéditeur.' } },
    { owner: OWNER, id: ID.retrait.replace('reception', 'html'), meta: { at: at(2) }, data: { v: 1, at: at(2), html: r.html, octets: r.octets, images: r.images, pixels: r.pixels, sombre: 1 } },
  ];
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const fetcherDe = (base) => async (u) => {
  const url = new URL(u);
  const table = url.pathname.split('/').pop();
  const rows = table === 'vinted_accounts' ? base.comptes.map((c) => ({ ...c, data: {} })) : base.rows;
  const { body } = servir(rows, u, {});
  const out = table === 'vinted_accounts' ? base.comptes.filter((c) => !url.searchParams.get('owner') || ('eq.' + c.owner) === url.searchParams.get('owner')).map((c) => ({ vinted_user_id: c.vinted_user_id, login: c.login })) : body;
  return { ok: true, status: 200, json: async () => out };
};

async function ouvrir(nav, base, route, { viewport, tactile, sombre }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(12000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push('page: ' + e.message));
  // « Blocked script execution in 'about:srcdoc' » : le script d'initialisation du BANC, bloqué par le `sandbox` du cadre (voulu).
  pg.on('console', (m) => { if (/Blocked script execution in 'about:srcdoc'/.test(m.text())) return; if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) erreurs.push('console: ' + m.text().slice(0, 200)); });
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })));
  await pg.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: OWNER }) });
    const q = Object.fromEntries(u.searchParams.entries());
    if (u.pathname === '/api/email-rattacher' && q.mode === 'journal') {
      try {
        const opts = { owner: OWNER, url: 'http://base.test', headers: {}, fetcher: fetcherDe(base) };
        const j = q.lire ? await route.lireEmailBoite({ ...opts, id: q.lire, html: q.html === '1', maintenant: MAINTENANT })
          : await route.lireJournalEmail({ ...opts, page: q.page, etat: q.etat || '', type: q.type || '', adresse: q.adresse || '', boite: q.boite || '', cherche: q.cherche || '', nonlus: q.nonlus === '1', parPage: Number.parseInt(q.parPage, 10) || undefined });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
      } catch (e) { return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: String(e && e.message) }) }); }
    }
    if (q.mode === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-boite-email]').first().waitFor({ timeout: 20000 });
  await pg.waitForTimeout(700);
  return { ctx, pg, erreurs };
}

// ── Les mesures de la LISTE (tailles rendues = calculée × zoom effectif) ─────
const mesurerListe = (pg) => pg.evaluate(() => {
  const z = (n) => (n && typeof n.currentCSSZoom === 'number' ? n.currentCSSZoom : 1);
  const px = (n, p = 'fontSize') => (n ? Math.round(parseFloat(getComputedStyle(n)[p]) * z(n) * 10) / 10 : null);
  const r = (n) => (n ? n.getBoundingClientRect() : null);
  const vh = window.innerHeight, vw = window.innerWidth;
  const h1 = [...document.querySelectorAll('.vrm-main h1')].find((n) => n.getBoundingClientRect().height > 0);
  window.__h1 = h1 ? [h1.className, h1.parentElement.className, h1.textContent.slice(0, 20)].join(' | ') : '';
  const lignes = [...document.querySelectorAll('.vrm-boite-ligne[data-boite-email]')].filter((n) => r(n).height > 0);
  const hauteurs = lignes.slice(0, 16).map((n) => r(n).height).sort((a, b) => a - b);
  const med = hauteurs.length ? Math.round(hauteurs[Math.floor(hauteurs.length / 2)]) : null;
  // Une ligne est « visible » si elle tient ENTIÈRE dans la fenêtre (et dans sa colonne).
  const col = document.querySelector('.vrm-boite-liste-col');
  const bas = Math.min(vh, col ? r(col).bottom : vh);
  const nav = document.querySelector('.vrm-nav-bas,.vrm-tabbar,nav[aria-label*="avigation"]');
  const visibles = lignes.filter((n) => { const b = r(n); return b.top >= 0 && b.bottom <= bas + 0.5; }).length;
  const quoi = document.querySelector('.vrm-boite-ligne[data-boite-email] .vrm-boite-quoi');
  const ess = document.querySelector('.vrm-boite-ligne[data-boite-email] .vrm-boite-essentiel');
  const pied = document.querySelector('.vrm-boite-ligne[data-boite-email] .vrm-boite-ligne-pied');
  const heure = document.querySelector('.vrm-boite-ligne[data-boite-email] .vrm-boite-ligne-haut time');
  const jour = document.querySelector('.vrm-boite-jour-titre');
  const cherche = document.querySelector('.vrm-boite-cherche');
  const pastille = document.querySelector('[data-boite-rubrique="tout"]');
  const marque = document.querySelector('.vrm-boite-ligne[data-boite-email] .vrm-boite-marque');
  const point = document.querySelector('.vrm-boite-point[data-boite-point="1"]');
  return {
    vw, vh, nav: nav ? Math.round(r(nav).height) : 0,
    titreEcran: px(h1), h1: window.__h1, listeLargeur: col ? Math.round(r(col).width) : null, listeBas: col ? Math.round(r(col).bottom) : null,
    lignePolice: px(quoi), ligneInterligne: px(quoi, 'lineHeight'), extraitPolice: px(ess), piedPolice: px(pied), heurePolice: px(heure), jourPolice: px(jour),
    ligneHauteur: med, premiereLigne: lignes[0] ? Math.round(r(lignes[0]).top) : null, visibles,
    chercheHauteur: cherche ? Math.round(r(cherche).height) : null, pastilleHauteur: pastille ? Math.round(r(pastille).height) : null,
    avatar: marque ? Math.round(r(marque).width) : null, pointNonLu: point ? Math.round(r(point).width) : null,
    // La plus petite marge haute des 40 premières lignes : une règle générique qui l'écrase se voit ici.
    margeMin: Math.min(...lignes.slice(0, 40).map((n) => parseFloat(getComputedStyle(n).paddingTop) * z(n))),
    extraitUneLigne: ess ? Math.round(r(ess).height) <= Math.round(px(ess, 'lineHeight') * 1.3) : null,
  };
});
// ── Les mesures de la LECTURE ouverte ────────────────────────────────────────
const mesurerLecture = (pg) => pg.evaluate(() => {
  const z = (n) => (n && typeof n.currentCSSZoom === 'number' ? n.currentCSSZoom : 1);
  const px = (n, p = 'fontSize') => (n ? Math.round(parseFloat(getComputedStyle(n)[p]) * z(n) * 10) / 10 : null);
  const r = (n) => (n ? n.getBoundingClientRect() : null);
  const lec = document.querySelector('[data-boite-lecture]');
  const msg = document.querySelector('.vrm-boite-msg');
  // Caractères par ligne : la largeur du texte ÷ la largeur moyenne d'un caractère français.
  let car = null;
  const p = msg && msg.querySelector('p');
  if (p) {
    const s = document.createElement('span'); s.style.whiteSpace = 'nowrap'; s.style.visibility = 'hidden'; s.style.position = 'absolute';
    s.textContent = 'Nous transférerons le paiement sur ton porte-monnaie une fois la commande ter'.repeat(2);
    p.appendChild(s); const moy = s.getBoundingClientRect().width / s.textContent.length; s.remove();
    car = Math.round(r(p).width / moy);
  }
  const f = document.querySelector('.vrm-boite-cadre-iframe');
  return {
    lectureLargeur: lec ? Math.round(r(lec).width) : null,
    lecturePadding: lec ? px(lec, 'paddingLeft') : null,
    titre: px(document.querySelector('.vrm-boite-titre')), deQui: px(document.querySelector('.vrm-boite-haut-de')),
    sujet: px(document.querySelector('.vrm-boite-sujet')),
    corps: px(msg), corpsInterligne: px(msg, 'lineHeight'), caracteres: car,
    code: px(document.querySelector('.vrm-boite-billet-chiffres')), montant: px(document.querySelector('.vrm-boite-heros-montant b')),
    geste: px(document.querySelector('.vrm-boite-gestes button')), gesteHauteur: (() => { const b = document.querySelector('.vrm-boite-gestes button'); return b ? Math.round(r(b).height) : null; })(),
    cadreEchelle: f ? f.getAttribute('data-cadre-echelle') : null, cadreLargeur: f ? Math.round(r(f).width) : null,
  };
});

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const H = await import(path.join(RACINE, 'api', '_lib', 'email-html.js'));
  const route = await import(path.join(RACINE, 'api', '_lib', 'reception-email.js'));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const recus = FX.rows.filter((x) => x.id.startsWith('email_reception_')).sort((a, b) => String(b.data.at).localeCompare(String(a.data.at)));
  const tout = {};
  const CONTEXTES = [[{ width: 1512, height: 950 }, false], [{ width: 1280, height: 800 }, false], [{ width: 390, height: 844 }, true]];
  try {
    for (const sombre of [false, true]) for (const [viewport, tactile] of CONTEXTES) {
      const w = viewport.width, nom = `${w}-${sombre ? 'sombre' : 'clair'}`, ordi = !tactile;
      if (process.env.BANC_CTX && !process.env.BANC_CTX.split(',').includes(nom)) continue;
      await essaie('écran ' + nom, async () => {
        const base = { rows: [...lignesHtml(H), ...FX.rows], comptes: FX.comptes.slice() };
        const { ctx, pg, erreurs } = await ouvrir(nav, base, route, { viewport, tactile, sombre });
        const L = await mesurerListe(pg);
        await pg.screenshot({ path: path.join(CAPT, `liste-${nom}.png`) });
        // La lecture : l'e-mail à HTML (la vente, 600 px fixes), puis le colis à retirer, puis une vente en texte.
        const lire = async (id, cap) => {
          await pg.locator(`[data-boite-email="${id}"]`).first().click();
          await pg.locator('[data-boite-lecture] [data-boite-titre]').first().waitFor();
          await pg.waitForTimeout(500);
          const M = await mesurerLecture(pg);
          await pg.screenshot({ path: path.join(CAPT, `${cap}-${nom}.png`) });
          return M;
        };
        const fermer = async () => { if (!ordi) { await pg.locator('[data-boite-fermer]').first().click(); await pg.locator('[data-boite-feuille]').waitFor({ state: 'detached' }); } };
        const Lh = await lire(ID.vente, 'lecture-html'); await pg.locator('.vrm-boite-cadre-iframe[data-cadre-echelle]').waitFor({ timeout: 8000 }).catch(() => {}); Lh.cadreEchelle = await pg.evaluate(() => { const f = document.querySelector('.vrm-boite-cadre-iframe'); return f ? f.getAttribute('data-cadre-echelle') : null; }); await fermer();
        const Lc = await lire(ID.retrait, 'lecture-code'); await fermer();
        // Une vente rangée en TEXTE (sans HTML gardé), parmi les lignes chargées.
        const idTexte = await pg.evaluate((exclu) => { const n = [...document.querySelectorAll('[data-boite-email][data-rubrique="ventes"]')].find((x) => !exclu.includes(x.dataset.boiteEmail)); return n ? n.dataset.boiteEmail : null; }, [ID.vente, ID.retrait]);
        if (!idTexte) throw Error('aucune vente en texte chargée');
        await pg.locator(`[data-boite-email="${idTexte}"]`).first().scrollIntoViewIfNeeded();
        const Lt = await lire(idTexte, 'lecture-texte');
        tout[nom] = { liste: L, html: Lh, code: Lc, texte: Lt };
        console.log(`  📏 ${nom} : ${JSON.stringify({ liste: L, html: { echelle: Lh.cadreEchelle, cadre: Lh.cadreLargeur }, code: Lc.code, montant: Lh.montant, texte: { titre: Lt.titre, corps: Lt.corps, interligne: Lt.corpsInterligne, car: Lt.caracteres, largeur: Lt.lectureLargeur } })}`);

        if (ordi) {
          dit(L.titreEcran <= 30, `${nom} : le titre de l'écran reste raisonnable (≤ 30 px)`, L.titreEcran);
          dit(L.listeLargeur >= 340 && L.listeLargeur <= 420, `${nom} : la liste fait 340 à 420 px de large`, L.listeLargeur);
          dit(L.lignePolice >= 13 && L.lignePolice <= 15, `${nom} : la ligne de liste est en 13–15 px`, L.lignePolice);
          dit(L.extraitPolice >= 12 && L.extraitPolice <= 14 && L.piedPolice >= 11 && L.piedPolice <= 13, `${nom} : extrait 12–14 px, pied 11–13 px`, `${L.extraitPolice} / ${L.piedPolice}`);
          dit(L.ligneHauteur <= 64, `${nom} : une ligne de liste fait au plus 64 px`, L.ligneHauteur);
          dit(L.margeMin >= 5, `${nom} : chaque ligne garde sa marge (≥ 5 px en haut)`, L.margeMin);
          dit(L.extraitUneLigne !== false, `${nom} : l'extrait tient sur une ligne`);
          // Avant : 5 lignes entières à 1512×950, 2 à 1280×800 (mesuré sur le code d'avant).
          dit(L.visibles >= (viewport.height >= 900 ? 8 : 6), `${nom} : au moins ${viewport.height >= 900 ? 8 : 6} e-mails visibles sans défiler (avant : ${viewport.height >= 900 ? 5 : 2})`, L.visibles);
          dit(L.listeBas != null && L.listeBas <= viewport.height + 1 && L.listeBas >= viewport.height - 40, `${nom} : la boîte remplit la fenêtre (colonnes qui défilent seules)`, L.listeBas);
          dit(Lt.titre <= 22 && Lt.titre >= 17, `${nom} : le titre de la lecture fait 17–22 px`, Lt.titre);
          dit(Lt.corps >= 13 && Lt.corps <= 15, `${nom} : le corps du message est en 13–15 px`, Lt.corps);
          dit(Lt.caracteres != null && Lt.caracteres <= 72, `${nom} : la lecture fait au plus 72 caractères par ligne`, Lt.caracteres);
          dit(Lc.code != null && Lc.code <= 34, `${nom} : le code de retrait reste lisible sans crier (≤ 34 px)`, Lc.code);
          dit(Lh.montant == null || Lh.montant <= 28, `${nom} : le montant ≤ 28 px`, Lh.montant);
          dit(Lh.cadreEchelle === '1', `${nom} : l'e-mail HTML s'affiche à sa taille naturelle (échelle 1)`, Lh.cadreEchelle);
          // Les gestes : ↓ ouvre le suivant, ↑ revient, Échap ferme — la liste reste à gauche.
          await pg.locator(`[data-boite-email="${ID.vente}"]`).first().click();
          await pg.locator(`[data-boite-lecture="${ID.vente}"]`).waitFor();
          await pg.keyboard.press('ArrowDown');
          const apres = await pg.locator('[data-boite-lecture]').first().getAttribute('data-boite-lecture').catch(() => null);
          dit(apres === ID.retrait, `${nom} : ↓ ouvre l'e-mail suivant (1 touche au lieu de viser une ligne)`, apres && apres.slice(-6));
          await pg.keyboard.press('ArrowUp');
          const avant = await pg.locator('[data-boite-lecture]').first().getAttribute('data-boite-lecture').catch(() => null);
          dit(avant === ID.vente, `${nom} : ↑ revient au précédent`);
          await pg.keyboard.press('Escape');
          dit(!(await pg.locator('[data-boite-lecture]').count()), `${nom} : Échap ferme la lecture`);
        } else {
          dit(L.lignePolice >= 14 && L.lignePolice <= 17, `${nom} : la ligne de liste est en 14–17 px au doigt`, L.lignePolice);
          dit(L.margeMin >= 6, `${nom} : chaque ligne garde sa marge (≥ 6 px en haut)`, L.margeMin);
          dit(L.ligneHauteur >= 44 && L.ligneHauteur <= 76, `${nom} : une ligne fait 44 à 76 px`, L.ligneHauteur);
          dit(Lt.titre >= 18 && Lt.titre <= 24, `${nom} : le titre de la lecture fait 18–24 px (plus 28)`, Lt.titre);
          dit(Lt.corps >= 15 && Lt.corps <= 17, `${nom} : le corps du message est en 15–17 px`, Lt.corps);
          dit(Lc.code != null && Lc.code <= 38, `${nom} : le code de retrait ≤ 38 px`, Lc.code);
          dit(Lt.gesteHauteur == null || Lt.gesteHauteur >= 44, `${nom} : le geste principal fait 44 px au doigt`, Lt.gesteHauteur);
          dit(Lh.cadreEchelle != null && Number(Lh.cadreEchelle) <= 1, `${nom} : l'e-mail HTML tient dans l'écran (jamais de côté)`, Lh.cadreEchelle);
          // Les gestes : 1 toucher pour lire, 1 pour revenir.
          await pg.locator('[data-boite-fermer]').first().click();
          dit(!(await pg.locator('[data-boite-feuille]').count()), `${nom} : 1 toucher pour revenir à la liste`);
        }
        // Rien de perdu : recherche, pastilles, compte, à vérifier, non lus, Relier ma boîte.
        const fonctions = await pg.evaluate(() => ({
          recherche: !!document.querySelector('[data-boite-cherche-champ]'), tout: !!document.querySelector('[data-boite-rubrique="tout"]'),
          codes: !!document.querySelector('[data-boite-rubrique="codes"]'), nonlus: !!document.querySelector('[data-boite-rubrique="nonlus"]'),
          averifier: !!document.querySelector('[data-boite-rubrique="a-verifier"]'), compte: !!document.querySelector('[data-boite-adresse]'),
          toutLu: !!document.querySelector('[data-boite-tout-lu]'), relier: !!document.querySelector('[data-boite-vue="relier"]'),
        }));
        dit(Object.values(fonctions).every(Boolean), `${nom} : aucune fonction perdue (recherche, rubriques, non lus, à vérifier, compte, tout lu, relier)`, JSON.stringify(fonctions));
        dit(!erreurs.length, `${nom} : aucune erreur JavaScript ni console`, erreurs.slice(0, 3).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    fs.writeFileSync(path.join(CAPT, 'densite.json'), JSON.stringify(tout, null, 1));
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} verts, ${ko} rouges — captures et mesures dans ${CAPT}`);
  process.exit(ko ? 1 : 0);
})();
