require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc — l'écran E-mails, DENSE comme Mail sur Mac (11 nov., lot emails-ecran)
//  Julien : « les mails doivent être retravaillés, je n'aime pas trop, surtout
//  sur ordi : tout fait trop gros ». (19 nov., lot emails-mail) Réécrit sur l'écran « comme Mail » : sans sélection
//  la liste prend toute la place, le code de retrait est EN GRAND (demande du 19 nov.), deux volets à l'ouverture.
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
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} }, [SESSION, sombre]);
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
// (19 nov., lot emails-mail) Sur l'écran « comme Mail » (classes `n-mail-*`) : la ligne = expéditeur, sujet, ce que VRM
// a compris, date ; sans sélection la liste prend toute la place, un e-mail ouvert ⇒ deux volets.
const mesurerListe = (pg) => pg.evaluate(() => {
  const z = (n) => (n && typeof n.currentCSSZoom === 'number' ? n.currentCSSZoom : 1);
  const px = (n, p = 'fontSize') => (n ? Math.round(parseFloat(getComputedStyle(n)[p]) * z(n) * 10) / 10 : null);
  const r = (n) => (n ? n.getBoundingClientRect() : null);
  const vh = window.innerHeight, vw = window.innerWidth;
  const h1 = [...document.querySelectorAll('.vrm-main h1')].find((n) => n.getBoundingClientRect().height > 0);
  const lignes = [...document.querySelectorAll('.n-mail-ligne[data-boite-email]')].filter((n) => r(n).height > 0);
  const hauteurs = lignes.slice(0, 16).map((n) => r(n).height).sort((a, b) => a - b);
  const med = hauteurs.length ? Math.round(hauteurs[Math.floor(hauteurs.length / 2)]) : null;
  const col = document.querySelector('[data-boite-liste-col]'), ecran = document.querySelector('[data-boite-emails]');
  const cs = ecran ? getComputedStyle(ecran) : null; const utile = ecran ? r(ecran).width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : 0;
  const visibles = lignes.filter((n) => { const b = r(n); return b.top >= 0 && b.bottom <= vh + 0.5; }).length;
  const l0 = lignes[0];
  const de = l0 && l0.querySelector('.n-mail-de'), sujet = l0 && l0.querySelector('.n-mail-sujet'), compris = l0 && l0.querySelector('.n-mail-compris'), heure = l0 && l0.querySelector('.n-mail-date time');
  return {
    vw, vh, titreEcran: px(h1), listeLargeur: col ? Math.round(r(col).width) : null, listePart: col && utile ? Math.round((r(col).width / utile) * 100) / 100 : null,
    dePolice: px(de), sujetPolice: px(sujet), comprisPolice: px(compris), heurePolice: px(heure), jourPolice: px(document.querySelector('.n-mail-jour-titre')),
    ligneHauteur: med, visibles, chercheHauteur: Math.round((r(document.querySelector('.n-mail-cherche')) || { height: 0 }).height), segHauteur: Math.round((r(document.querySelector('.n-mail-seg')) || { height: 0 }).height),
    avatar: l0 ? Math.round(r(l0.querySelector('.n-mail-marque')).width) : null,
    margeMin: Math.min(...lignes.slice(0, 40).map((n) => parseFloat(getComputedStyle(n).paddingTop) * z(n))),
    comprisUneLigne: compris ? Math.round(r(compris).height) <= Math.round(px(compris, 'lineHeight') * 1.3) : null,
  };
});
// ── Les mesures de la LECTURE ouverte ────────────────────────────────────────
const mesurerLecture = (pg) => pg.evaluate(() => {
  const z = (n) => (n && typeof n.currentCSSZoom === 'number' ? n.currentCSSZoom : 1);
  const px = (n, p = 'fontSize') => (n ? Math.round(parseFloat(getComputedStyle(n)[p]) * z(n) * 10) / 10 : null);
  const r = (n) => (n ? n.getBoundingClientRect() : null);
  const lec = document.querySelector('[data-boite-lecture]');
  const msg = document.querySelector('.n-mail-msg');
  let car = null;
  const p = msg && msg.querySelector('p');
  if (p) {
    const s = document.createElement('span'); s.style.whiteSpace = 'nowrap'; s.style.visibility = 'hidden'; s.style.position = 'absolute';
    s.textContent = 'Nous transférerons le paiement sur ton porte-monnaie une fois la commande ter'.repeat(2);
    p.appendChild(s); const moy = s.getBoundingClientRect().width / s.textContent.length; s.remove();
    car = Math.round(r(p).width / moy);
  }
  const f = document.querySelector('.vrm-boite-cadre-iframe'), g = document.querySelector('.n-mail-gestes button'), col = document.querySelector('[data-boite-lecture-col]');
  return {
    lectureLargeur: lec ? Math.round(r(lec).width) : null, colBas: col ? Math.round(r(col).bottom) : null,
    titre: px(document.querySelector('.n-mail-sujet-grand')), deQui: px(document.querySelector('.n-mail-entete-txt b')),
    corps: px(msg), corpsInterligne: px(msg, 'lineHeight'), caracteres: car,
    code: px(document.querySelector('.n-mail-retrait-chiffres')), montant: px(document.querySelector('[data-boite-montant] dd')),
    geste: px(g), gesteHauteur: g ? Math.round(r(g).height) : null,
    comprisAvant: (() => { const h = document.querySelector('[data-boite-heros]'), o = document.querySelector('[data-boite-origine]'); return !!(h && o && (h.compareDocumentPosition(o) & 4)); })(),
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
          dit(L.titreEcran <= 34, `${nom} : le titre de l'écran reste celui du natif (≤ 34 px)`, L.titreEcran);
          // (19 nov.) Remplace « la liste fait 340 à 420 px » : sans sélection elle prend TOUTE la place (Julien : « quand je ne
          // clique sur rien tout est regroupé à gauche, condensé »), 340–440 seulement quand un e-mail est ouvert (deux volets).
          dit(L.listePart >= 0.92, `${nom} : sans sélection, la liste prend toute la largeur utile`, L.listePart);
          dit(L.dePolice >= 13 && L.dePolice <= 17 && L.sujetPolice >= 13 && L.sujetPolice <= 17 && L.comprisPolice >= 13 && L.comprisPolice <= 15, `${nom} : expéditeur, sujet 13–17 px, « compris » 13–15 px`, `${L.dePolice} / ${L.sujetPolice} / ${L.comprisPolice}`);
          dit(L.ligneHauteur <= 56, `${nom} : une rangée pleine largeur fait au plus 56 px`, L.ligneHauteur);
          dit(L.margeMin >= 5, `${nom} : chaque ligne garde sa marge (≥ 5 px en haut)`, L.margeMin);
          dit(L.comprisUneLigne !== false, `${nom} : « ce que VRM a compris » tient sur une ligne`);
          dit(L.visibles >= (viewport.height >= 900 ? 10 : 8), `${nom} : au moins ${viewport.height >= 900 ? 10 : 8} e-mails visibles sans défiler`, L.visibles);
          dit(Lt.titre <= 24 && Lt.titre >= 17, `${nom} : le titre de la lecture fait 17–24 px`, Lt.titre);
          dit(Lt.corps >= 15 && Lt.corps <= 17, `${nom} : le corps du message est en 15–17 px`, Lt.corps);
          dit(Lt.caracteres != null && Lt.caracteres <= 75, `${nom} : la lecture fait au plus 75 caractères par ligne`, Lt.caracteres);
          // (19 nov.) Remplace « le code ≤ 34 px » : le coordinateur et Julien veulent « le code de retrait en grand ».
          dit(Lc.code != null && Lc.code >= 40, `${nom} : le code de retrait EN GRAND (≥ 40 px), dans « Ce que VRM a compris »`, Lc.code);
          dit(Lc.comprisAvant && Lh.comprisAvant, `${nom} : « Ce que VRM a compris » avant le message d'origine`);
          dit(Lh.montant == null || Lh.montant <= 28, `${nom} : le montant ≤ 28 px`, Lh.montant);
          dit(Lh.colBas != null && Lh.colBas <= viewport.height + 1, `${nom} : le volet de lecture tient dans la fenêtre (il défile seul)`, Lh.colBas);
          dit(w < 1500 ? Lh.cadreEchelle != null && Number(Lh.cadreEchelle) <= 1 : Lh.cadreEchelle === '1', `${nom} : l'e-mail HTML ${w < 1500 ? 'tient dans le volet (échelle ≤ 1, jamais de côté)' : "s'affiche à sa taille naturelle (échelle 1)"}`, Lh.cadreEchelle);
          await pg.locator(`[data-boite-email="${ID.vente}"]`).first().click();
          await pg.locator(`[data-boite-lecture="${ID.vente}"]`).waitFor();
          const deux = await pg.evaluate(() => { const c = document.querySelector('[data-boite-liste-col]'); return c ? Math.round(c.getBoundingClientRect().width) : 0; });
          dit(deux >= 300 && deux <= 440, `${nom} : un e-mail ouvert ⇒ deux volets, la liste 300–440 px`, deux);
          await pg.keyboard.press('ArrowDown');
          const apres = await pg.locator('[data-boite-lecture]').first().getAttribute('data-boite-lecture').catch(() => null);
          dit(apres === ID.retrait, `${nom} : ↓ ouvre l'e-mail suivant`, apres && apres.slice(-6));
          await pg.keyboard.press('ArrowUp');
          const avant = await pg.locator('[data-boite-lecture]').first().getAttribute('data-boite-lecture').catch(() => null);
          dit(avant === ID.vente, `${nom} : ↑ revient au précédent`);
          await pg.keyboard.press('Escape');
          dit(!(await pg.locator('[data-boite-lecture]').count()), `${nom} : Échap ferme la lecture (la liste reprend toute la place)`);
        } else {
          dit(L.dePolice >= 14 && L.dePolice <= 17 && L.sujetPolice >= 14 && L.sujetPolice <= 17, `${nom} : expéditeur et sujet en 14–17 px au doigt`, `${L.dePolice} / ${L.sujetPolice}`);
          dit(L.margeMin >= 6, `${nom} : chaque ligne garde sa marge (≥ 6 px en haut)`, L.margeMin);
          dit(L.ligneHauteur >= 44 && L.ligneHauteur <= 84, `${nom} : une ligne fait 44 à 84 px (trois étages comme Mail)`, L.ligneHauteur);
          dit(L.listePart >= 0.99, `${nom} : la liste prend toute la largeur`, L.listePart);
          dit(Lt.titre >= 18 && Lt.titre <= 24, `${nom} : le titre de la lecture fait 18–24 px`, Lt.titre);
          dit(Lt.corps >= 15 && Lt.corps <= 17, `${nom} : le corps du message est en 15–17 px`, Lt.corps);
          dit(Lc.code != null && Lc.code >= 40, `${nom} : le code de retrait EN GRAND (≥ 40 px)`, Lc.code);
          dit(Lt.gesteHauteur == null || Lt.gesteHauteur >= 44, `${nom} : le geste principal fait 44 px au doigt`, Lt.gesteHauteur);
          dit(Lh.cadreEchelle != null && Number(Lh.cadreEchelle) <= 1, `${nom} : l'e-mail HTML tient dans l'écran (jamais de côté)`, Lh.cadreEchelle);
          await pg.locator('[data-boite-fermer]').first().click();
          dit(!(await pg.locator('[data-boite-feuille]').count()), `${nom} : 1 toucher pour revenir à la liste`);
        }
        // Rien de perdu : recherche, segments, « ⋯ » (non lus, codes, offres, relier), compte.
        await pg.locator('[data-v2-mail-plus]').click();
        await pg.locator('[data-v2-mail-choix="relier"]').waitFor({ timeout: 5000 }).catch(() => {});
        const fonctions = await pg.evaluate(() => ({
          recherche: !!document.querySelector('[data-boite-cherche-champ]'), tout: !!document.querySelector('[data-boite-rubrique-v2="tout"]'), atraiter: !!document.querySelector('[data-boite-rubrique-v2="atraiter"]'),
          codes: !!document.querySelector('[data-v2-mail-choix="codes"]'), nonlus: !!document.querySelector('[data-v2-mail-choix="nonlus"]'), offres: !!document.querySelector('[data-v2-mail-choix="offres"]'),
          compte: !!document.querySelector('[data-boite-adresse], [data-v2-mail-compte-feuille] select'), relier: !!document.querySelector('[data-v2-mail-choix="relier"]'),
        }));
        dit(Object.values(fonctions).every(Boolean), `${nom} : aucune fonction perdue (recherche, segments, non lus, codes, offres, compte, relier)`, JSON.stringify(fonctions));
        await pg.keyboard.press('Escape');
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
