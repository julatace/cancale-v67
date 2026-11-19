require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Banc — E-mails comme Mail et « Relier ma boîte » accompagné (19 nov., lot emails-mail)
//  Julien : « quand je ne clique sur rien tout est regroupé à gauche, condensé. "À traiter · Colis ·
//  Ventes" peut être en haut et prendre toute la largeur, et après on a le beau mail directement dans
//  l'application » ; « relier la boîte mail : un processus beaucoup plus accompagné ».
//  Données INVENTÉES dans la vraie forme de `/api/email-rattacher?mode=journal` (page, `lire=`) et de
//  `?mode=adresse-unique` (GET { pret, adresse, actif, dernier, essai, code }). Base de VOLUME (64 e-mails,
//  toutes les natures, titres longs, codes, sans résumé) et base VIDE. 390 tactile, 1280 et 1512, clair et
//  sombre. Il MESURE (data-*, boîtes, styles calculés — jamais un libellé) :
//   A  le segmenté EN HAUT, sur toute la largeur de l'écran, au-dessus de la liste ;
//   B  sans sélection, la liste prend TOUTE la place (≥ 92 % de l'écran), aucune colonne de lecture vide ;
//   C  chaque rangée : expéditeur, sujet (le vrai), ce que VRM a compris (une ligne), date ;
//   D  un e-mail ouvert à l'ordinateur ⇒ deux volets (liste 300–440 | lecture à droite, plus large) ;
//      au téléphone ⇒ une feuille OPAQUE ; « Ce que VRM a compris » AVANT le message d'origine ; le code
//      de retrait en grand (≥ 40 px), le point, la date limite ; « Ranger » présent ;
//   E  contrastes ≥ 4,5:1 sur le fond RENDU, cibles ≥ 44, UN plein au plus, rien de coupé, pas de
//      défilement de côté ;
//   F  « Relier ma boîte » : une étape par écran, 4 messageries, l'adresse copiable, une capture
//      dessinée par étape de Gmail, l'essai guetté en direct ⇒ « Reçu ✓ » quand la route range LE code
//      de l'objet ; aucune écriture (aucun POST) pendant le parcours.
//  Captures dans CAPTURE_DIR (hors dépôt). `BANC_SEUL=1512-clair` pour une seule combinaison.
// ════════════════════════════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7981);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-emails-mail');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const MAINTENANT = Date.UTC(2026, 10, 19, 15, 5);
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };

// ── La base inventée (vraie forme) ───────────────────────────────────────────────────────────────────
const H = (min) => new Date(MAINTENANT - min * 60000).toISOString();
const id = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'e'.repeat(60);
const E = [
  { id: id(1), at: H(3), etat: 'integre', type: 'suivi', subject: 'Votre colis 12345678 est disponible dans votre Point Relais®', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port, 12 rue du Port 44000 Nantes', lim: '2026-11-21' }, pj: 0, lu: false },
  { id: id(2), at: H(9), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90 Triple White taille 42 très bon état", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '1042', pdf: 1, a: 'Nike Air Max 90 Triple White' }, pj: 1, lu: false },
  { id: id(3), at: H(20), etat: 'integre', type: 'vente-vestiaire', subject: 'Votre article a été vendu', from: 'Vestiaire Collective <no-reply@vestiairecollective.com>', resume: { v: 1, t: 'vente-vestiaire', a: 'Jordan 1 Mid Chicago', mt: '1 182,40', lim: '2026-11-20' }, pj: 0, lu: true },
  { id: id(4), at: H(34), etat: 'integre', type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: 'Adidas Samba OG', px: '55', n: '17' }, pj: 0, lu: true },
  { id: id(5), at: H(61), etat: 'integre', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', pdf: 1 }, pj: 1, lu: true },
  { id: id(6), at: H(90), etat: 'a-verifier', type: 'ignoré', subject: 'Une forme jamais vue', from: 'contact@exemple.test', resume: { v: 1, t: 'incompris', av: 'incompris' }, pj: 0, lu: false },
  { id: id(7), at: H(200), etat: 'integre', type: 'connu-sans-action', subject: 'Les nouveautés de la semaine', from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' }, pj: 0, lu: true },
  { id: id(8), at: H(1500), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Vans Old Skool", from: 'no-reply@vinted.fr', resume: null, pj: null, lu: true },
];
for (let i = 9; i <= 64; i++) E.push({ id: id(i), at: H(1500 + i * 47), etat: 'integre', type: i % 3 ? 'suivi' : 'offre', subject: i % 3 ? `Votre colis CH${1000 + i} est en route vers son point` : `Nouvelle offre sur ton article ${i}`, from: i % 3 ? 'Chronopost <suivi@chronopost.fr>' : 'Vinted <no-reply@vinted.fr>', resume: i % 3 ? { v: 1, t: 'suivi', s: 'CH' + (1000 + i), st: 'transit' } : { v: 1, t: 'offre', mt: '30' }, pj: 0, lu: true });
E.forEach((e, i) => { e.adresses = [i % 4 === 3 ? 'second@exemple.test' : 'vendeuse@exemple.test']; e.compte = { id: String(i % 4 === 3 ? 2 : 1), nom: i % 4 === 3 ? 'compte-deux' : 'compte-un' }; e.compteAmbigu = false; e.sourceDate = null; });
const RUB = (e) => (e.type === 'suivi' && e.resume && e.resume.code ? 'codes' : ['vente', 'finalisation', 'vente-vestiaire'].includes(e.type) ? 'ventes' : e.type === 'achat' ? 'achats' : ['suivi', 'bordereau'].includes(e.type) ? 'colis' : e.type === 'offre' ? 'offres' : 'autres');
const dans = (e, r) => !r || (r === 'colis' ? ['colis', 'codes'].includes(RUB(e)) : RUB(e) === r);
const parRubrique = { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 }; E.forEach((e) => { const r = RUB(e); parRubrique[r]++; if (r === 'codes') parRubrique.colis++; });
const COMPTEURS = { sur: E.length, plus: false, integre: E.length - 1, aVerifier: 1, erreur: 0, incompris: 1, nonLus: E.filter((e) => e.lu === false).length, parRubrique };
const ADRESSES = [{ adresse: 'vendeuse@exemple.test', nom: 'compte-un' }, { adresse: 'second@exemple.test', nom: 'compte-deux' }];
const HTML1 = '<div style="max-width:600px;margin:0 auto;font-family:Arial"><h1 style="font-size:20px">Votre colis est disponible</h1><p>Bonjour, votre colis vous attend au <b>Relais Tabac du Port</b>.</p><p>Code : <b>418205</b></p><p><a href="https://suivi.exemple.test/12345678">Suivre mon colis</a></p><img src="https://images.exemple.test/logo.png" width="120" height="40" alt="logo"></div>';
const TEXTE = { [id(1)]: 'Bonjour,\n\nVotre colis est disponible au Relais Tabac du Port.\nCode de retrait : 418205\nSuivre : https://suivi.exemple.test/12345678', [id(2)]: 'Ton bordereau est prêt. N° de transaction : 12345678901', [id(4)]: 'Ton article Adidas Samba OG est vendu.' };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { viewport, tactile, sombre, vide = false }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 201, contentType: 'application/json', body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })));
  const etat = { essai: null, appels: [] };
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const q = Object.fromEntries(u.searchParams.entries());
    if (q.mode === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) });
    etat.appels.push({ chemin: u.pathname, q, m: r.request().method() });
    if (u.pathname === '/api/email-rattacher' && q.mode === 'adresse-unique') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pret: true, adresse: 'vendeuse-k7p2@recu-vrm.exemple', actif: true, dernier: null, essai: etat.essai, code: null }) });
    }
    if (u.pathname === '/api/email-rattacher' && q.mode === 'journal') {
      const base = vide ? [] : E;
      if (q.lire) { const e = base.find((x) => x.id === q.lire); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: q.lire, email: e ? { ...e, receivedAt: e.at, pieces: e.pj === null ? null : [], texte: TEXTE[e.id] || null, texteCoupe: false, origine: e.id === id(1) ? { etat: 'garde', html: HTML1, images: 1, sombre: false } : undefined } : null }) }); }
      let l = base.filter((e) => dans(e, q.boite || ''));
      if (q.etat === 'a-verifier') l = l.filter((e) => e.etat === 'a-verifier');
      if (q.adresse) l = l.filter((e) => e.adresses.includes(q.adresse));
      const n = Number(q.parPage || 50), p = Number(q.page || 0);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: p, parPage: n, suite: l.length > (p + 1) * n, emails: l.slice(p * n, p * n + n), compteurs: vide ? { ...COMPTEURS, sur: 0, aVerifier: 0, nonLus: 0, parRubrique: { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 } } : COMPTEURS, adresses: ADRESSES, lus: 'lu', dernierAt: base[0] ? base[0].at : null }) });
    }
    if (q.mode === 'liste') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, etat };
}

// Le contraste du texte sur le fond RENDU (on remonte jusqu'au premier fond opaque).
const MESURE_QUALITE = (racineSel) => {
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const alpha = (c) => { const m = String(c).match(/[\d.]+/g); return m && m.length >= 4 ? Number(m[3]) : 1; };
  const melange = (fg, bg) => { const f = String(fg).match(/[\d.]+/g).map(Number), b = String(bg).match(/[\d.]+/g).map(Number); const a = f.length >= 4 ? f[3] : 1; return `rgb(${f[0] * a + b[0] * (1 - a)}, ${f[1] * a + b[1] * (1 - a)}, ${f[2] * a + b[2] * (1 - a)})`; };
  const fondDe = (n) => { const pile = []; for (let x = n; x; x = x.parentElement) { const s = getComputedStyle(x); const bg = s.backgroundColor; if (bg && alpha(bg) > 0) { pile.push(bg); if (alpha(bg) >= 0.99) break; } } let f = 'rgb(255, 255, 255)'; if (pile.length && alpha(pile[pile.length - 1]) >= 0.99) f = pile.pop(); else f = getComputedStyle(document.body).backgroundColor || f; while (pile.length) f = melange(pile.pop(), f); return f; };
  const racine = document.querySelector(racineSel) || document.body;
  const bas = [], petits = [], coupes = [];
  const vu = (n) => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !n.closest('[aria-hidden="true"]') && r.bottom > 0 && r.top < innerHeight; };
  for (const n of racine.querySelectorAll('*')) {
    if (!vu(n) || n.closest('iframe') || n.getBoundingClientRect().width <= 2) continue;
    const texte = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (texte) {
      const s = getComputedStyle(n); const fg = s.color; const bg = fondDe(n);
      const L1 = lum(alpha(fg) < 1 ? melange(fg, bg) : fg), L2 = lum(bg);
      if (L1 != null && L2 != null) { const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (cr < 4.5) bas.push(`${n.className || n.tagName}:${n.textContent.trim().slice(0, 24)}=${cr.toFixed(2)}`); }
      if (parseFloat(s.fontSize) < 13) petits.push(`${n.className}:${s.fontSize}`);
      if (s.textOverflow !== 'ellipsis' && n.scrollWidth > n.clientWidth + 1 && s.overflow !== 'visible' && s.overflowX !== 'visible') coupes.push(`${n.className}:${n.textContent.trim().slice(0, 30)}`);
    }
  }
  const cibles = [...racine.querySelectorAll('button, a[href], input, select, [role="radio"]')].filter(vu).filter((n) => !n.closest('.n-mail-msg') && !n.closest('[data-boite-mentions]'))
    // L'interrupteur d'une rangée : la RANGÉE entière le bascule (≥ 44 de haut) — c'est elle, la cible.
    .filter((n) => !(n.classList.contains('n-interrupteur') && n.closest('.n-rangee') && n.closest('.n-rangee').getBoundingClientRect().height >= 44))
    .map((n) => { const r = n.getBoundingClientRect(); return { k: (n.className || n.tagName) + '|' + (n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44);
  const pleins = [...document.querySelectorAll('[data-n-variante="plein"]')].filter(vu).length;
  return { bas, petits, coupes, cibles, pleins, cote: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
};

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const COMBOS = [];
  for (const sombre of [false, true]) for (const [viewport, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1280, height: 860 }, false], [{ width: 1512, height: 950 }, false]]) COMBOS.push({ sombre, viewport, tactile, nom: `${viewport.width}-${sombre ? 'sombre' : 'clair'}` });
  const seul = process.env.BANC_SEUL || '';
  try {
    for (const { sombre, viewport, tactile, nom } of COMBOS) {
      if (seul && !seul.split(',').includes(nom)) continue;
      const large = viewport.width >= 1024;
      await essaie('boîte ' + nom, async () => {
        const { ctx, pg, erreurs, etat } = await ouvrir(nav, { viewport, tactile, sombre });
        const ecran = pg.locator('[data-boite-emails]');
        await ecran.locator('[data-boite-email]').first().waitFor({ timeout: 9000 });
        // A — le segmenté en haut, sur toute la largeur.
        const A = await pg.evaluate(() => {
          const ec = document.querySelector('[data-boite-emails]'), seg = ec && ec.querySelector('[role="radiogroup"]'), l1 = ec && ec.querySelector('[data-boite-email]');
          if (!ec || !seg || !l1) return null;
          const re = ec.getBoundingClientRect(), rs = seg.getBoundingClientRect(), rl = l1.getBoundingClientRect();
          const cs = getComputedStyle(ec); const utile = re.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const choix = [...seg.querySelectorAll('[role="radio"]')];
          const libs = choix.map((b) => { const l = b.querySelector('.n-segmente-libelle') || b; return { t: b.textContent.trim(), coupe: l.scrollWidth > l.clientWidth + 1 }; });
          return { part: rs.width / utile, auDessus: rs.bottom <= rl.top, n: choix.length, libs };
        });
        dit(!!A && A.part >= 0.95 && A.auDessus && A.n === 5 && A.libs.every((x) => !x.coupe), `${nom} : A — le segmenté (5 choix) EN HAUT, sur toute la largeur de l'écran, au-dessus de la liste, aucun libellé coupé`, JSON.stringify(A));
        // B — sans sélection, la liste prend toute la place.
        const B = await pg.evaluate(() => {
          const ec = document.querySelector('[data-boite-emails]'), col = ec.querySelector('[data-boite-liste-col]'), l1 = ec.querySelector('[data-boite-email]');
          const re0 = ec.getBoundingClientRect(), cs = getComputedStyle(ec), re = { width: re0.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }, rc = col.getBoundingClientRect(), rl = l1.closest('li').getBoundingClientRect();
          const lecture = ec.querySelector('[data-boite-lecture], [data-boite-vide-lecture], .vrm-boite-lecture-col, [data-boite-lecture-col]');
          return { col: rc.width / re.width, ligne: rl.width / re.width, lecture: !!(lecture && lecture.getBoundingClientRect().width > 0) };
        });
        dit(B.col >= 0.92 && B.ligne >= 0.9 && !B.lecture, `${nom} : B — sans sélection, la liste prend toute la place (${Math.round(B.col * 100)} % de la largeur utile), aucune colonne de lecture vide`, JSON.stringify(B));
        // C — chaque rangée : expéditeur, sujet, compris, date.
        const C = await pg.evaluate((sujets) => [...document.querySelectorAll('[data-boite-email]')].slice(0, 30).map((b) => {
          const de = b.querySelector('[data-boite-de-ligne]'), su = b.querySelector('[data-boite-sujet-ligne]'), co = b.querySelector('[data-boite-compris] [data-boite-quoi]'), t = b.querySelector('time');
          const vis = (n) => !!(n && n.getBoundingClientRect().width > 0 && n.textContent.trim());
          return { id: b.dataset.boiteEmail, ok: vis(de) && vis(su) && vis(co) && vis(t) && su.textContent.trim() === (sujets[b.dataset.boiteEmail] || ''), compris1: co && co.closest('[data-boite-compris]').getBoundingClientRect().height < 26 };
        }), Object.fromEntries(E.map((e) => [e.id, e.subject])));
        dit(C.length >= 20 && C.every((x) => x.ok && x.compris1), `${nom} : C — chaque rangée dit l'expéditeur, le VRAI sujet, ce que VRM a compris sur UNE ligne, la date`, JSON.stringify(C.filter((x) => !x.ok || !x.compris1).slice(0, 3)));
        const qListe = await pg.evaluate(MESURE_QUALITE, '[data-boite-emails]');
        dit(!qListe.bas.length && !qListe.petits.length && !qListe.cibles.length && qListe.pleins <= 1 && !qListe.cote && !qListe.coupes.length, `${nom} : E — liste : contrastes ≥ 4,5, ≥ 13 px, cibles ≥ 44, ${qListe.pleins} plein, rien de coupé, pas de défilement de côté`, JSON.stringify({ bas: qListe.bas.slice(0, 4), petits: qListe.petits.slice(0, 3), cibles: qListe.cibles.slice(0, 4), coupes: qListe.coupes.slice(0, 3), pleins: qListe.pleins, cote: qListe.cote }));
        await pg.screenshot({ path: path.join(CAPT, `liste-${nom}.png`) });
        // D — ouvrir le colis à retirer.
        await ecran.locator(`[data-boite-email="${id(1)}"]`).click();
        await pg.locator('[data-boite-lecture] [data-boite-heros]').waitFor({ timeout: 8000 });
        await pg.waitForTimeout(500);
        const D = await pg.evaluate(() => {
          const ec = document.querySelector('[data-boite-emails]');
          const lec = document.querySelector('[data-boite-lecture]'), col = ec.querySelector('[data-boite-liste-col]');
          const feuille = lec.closest('[data-boite-feuille]');
          const h = lec.querySelector('[data-boite-heros]'), o = lec.querySelector('[data-boite-origine]'), code = lec.querySelector('[data-boite-code] .vrm-sensible, [data-boite-code] [data-stream-type="code"]');
          const rl = lec.getBoundingClientRect(), rc = col.getBoundingClientRect();
          return {
            feuille: !!feuille, opaque: feuille ? getComputedStyle(feuille).backgroundColor.replace(/\s/g, '') : '', listeL: Math.round(rc.width), lectureL: Math.round(rl.width), aDroite: rl.left >= rc.right - 1,
            avant: !!(h && o && (h.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING)), heros: h && h.dataset.boiteHeros, code: code ? parseFloat(getComputedStyle(code).fontSize) : 0, lieu: !!lec.querySelector('[data-boite-lieu]'), limite: !!lec.querySelector('[data-boite-limite]'),
            ranger: !!lec.querySelector('[data-boite-ranger]'), origine: o && o.getAttribute('data-boite-origine'), images: !!lec.querySelector('[data-cadre-images-bloquees]'),
          };
        });
        const opaque = /^rgb\(/.test(D.opaque) || /^rgba\([^)]*,1\)$/.test(D.opaque);
        dit(large ? (!D.feuille && D.listeL >= 300 && D.listeL <= 440 && D.lectureL > D.listeL && D.aDroite) : (D.feuille && opaque), `${nom} : D — un e-mail ouvert ⇒ ${large ? 'deux volets (liste | lecture à droite, plus large)' : 'une feuille opaque'}`, JSON.stringify(D));
        dit(D.avant && D.heros === 'retrait' && D.code >= 40 && D.lieu && D.limite && D.ranger && D.origine === 'html' && D.images, `${nom} : D — « Ce que VRM a compris » AVANT le message d'origine : code de retrait en grand (${D.code} px), point, date limite ; « Ranger » ; le HTML d'origine dans le cadre, images à la demande`, JSON.stringify(D));
        const qLec = await pg.evaluate(MESURE_QUALITE, '[data-boite-lecture]');
        dit(!qLec.bas.length && !qLec.petits.length && !qLec.cibles.length && qLec.pleins <= 1 && !qLec.cote, `${nom} : E — lecture : contrastes, ≥ 13 px, cibles ≥ 44, ${qLec.pleins} plein`, JSON.stringify({ bas: qLec.bas.slice(0, 4), petits: qLec.petits.slice(0, 3), cibles: qLec.cibles.slice(0, 4), pleins: qLec.pleins }));
        await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
        // Une vente reliée par identité : le geste (UN plein) et la plaque du N° lu.
        if (large) {
          await ecran.locator(`[data-boite-email="${id(2)}"]`).click();
          await pg.locator(`[data-boite-lecture="${id(2)}"] [data-boite-heros]`).waitFor({ timeout: 8000 });
          const V = await pg.evaluate(() => { const l = document.querySelector('[data-boite-lecture]'); return { objet: !!l.querySelector('[data-boite-objet]'), ident: [...l.querySelectorAll('[data-boite-ident]')].map((x) => x.dataset.boiteIdent).filter(Boolean), num: (l.querySelector('[data-boite-num]') || {}).dataset ? l.querySelector('[data-boite-num]').dataset.boiteNum : '' }; });
          dit(V.objet && V.ident.length >= 1 && V.num === '1042', `${nom} : D — un bordereau : le geste PAR IDENTITÉ (n° de transaction) et le N° LU sur sa plaque`, JSON.stringify(V));
          const q2 = await pg.evaluate(MESURE_QUALITE, '[data-boite-emails]');
          dit(q2.pleins === 1, `${nom} : E — un seul plein à l'écran (le geste de l'e-mail ouvert)`, String(q2.pleins));
          await pg.keyboard.press('Escape');
        }
        dit(!erreurs.length, `${nom} : aucune erreur JavaScript`, erreurs.slice(0, 2).join(' | '));
        dit(!etat.appels.some((a) => a.m !== 'GET' && ['journal', 'adresse-unique'].includes(a.q.mode)), `${nom} : la boîte n'écrit rien par ses lectures (journal, adresse)`, JSON.stringify(etat.appels.filter((a) => a.m !== 'GET').map((a) => a.q.mode)));
        await ctx.close();
      });
      // Base VIDE
      await essaie('vide ' + nom, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { viewport, tactile, sombre, vide: true });
        await pg.locator('[data-boite-etat="vide"]').waitFor({ timeout: 9000 });
        const Q = await pg.evaluate(MESURE_QUALITE, '[data-boite-emails]');
        const plein = await pg.locator('[data-boite-etat="vide"] [data-n-variante="plein"]').count();
        dit(plein === 1 && Q.pleins === 1 && !Q.bas.length && !Q.cibles.length && !Q.cote, `${nom} : base vide — une phrase et UN plein « Relier ma boîte », contrastes et cibles`, JSON.stringify({ plein, bas: Q.bas.slice(0, 3), cibles: Q.cibles.slice(0, 3) }));
        await pg.screenshot({ path: path.join(CAPT, `vide-${nom}.png`) });
        dit(!erreurs.length, `${nom} : vide — aucune erreur JavaScript`, erreurs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      // F — « Relier ma boîte », accompagné.
      await essaie('relier ' + nom, async () => {
        const { ctx, pg, erreurs, etat } = await ouvrir(nav, { viewport, tactile, sombre, vide: true });
        await pg.locator('[data-boite-etat="vide"] [data-boite-etat-geste="relier"]').click();
        const r = pg.locator('[data-relier-ma-boite]');
        await r.locator('[data-relier-ecran="messagerie"]').waitFor({ timeout: 8000 });
        const tuiles = await r.locator('[data-choix-messagerie] [data-fournisseur]').evaluateAll((l) => l.map((x) => x.dataset.fournisseur));
        dit(tuiles.join() === 'gmail,outlook,icloud,autre', `${nom} : F — premier écran : Gmail, Outlook, iCloud, Autre`, tuiles.join());
        await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `relier-0-${nom}.png`) });
        await r.locator('[data-fournisseur="gmail"]').click();
        await r.locator('[data-relier-ecran="adresse"]').waitFor();
        const adr = await r.locator('[data-adresse-reception]').getAttribute('data-adresse-reception');
        const prog = await r.locator('[data-relier-progression]').getAttribute('data-relier-progression');
        await r.locator('[data-copier-adresse]').click();
        await pg.waitForTimeout(200);
        const copie = await r.locator('[data-copier-adresse]').getAttribute('data-copie');
        dit(adr === 'vendeuse-k7p2@recu-vrm.exemple' && prog === '1/6' && copie === 'ok', `${nom} : F — l'adresse VRM de la route, copiée d'UN toucher ; « Étape 1 sur 6 »`, JSON.stringify({ adr, prog, copie }));
        await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `relier-1-${nom}.png`) });
        const vus = [];
        for (let k = 0; k < 5; k++) {
          const suiv = r.locator('[data-suivant]');
          const vers = await suiv.getAttribute('data-suivant');
          await suiv.click();
          await r.locator(`[data-relier-ecran="${vers}"]`).waitFor();
          const ec = await pg.evaluate(() => { const s = document.querySelector('[data-relier-ecran]'); return { id: s.dataset.relierEcran, scene: !!s.querySelector('figure[data-scene][aria-hidden="true"]'), geste: (s.querySelector('[data-geste]') || {}).dataset ? s.querySelector('[data-geste]').dataset.geste : '', lien: (s.querySelector('[data-ouvrir-messagerie]') || {}).href || '', pleins: document.querySelectorAll('[data-relier-ma-boite] [data-n-variante="plein"]').length }; });
          vus.push(ec);
          if (!tactile) await pg.mouse.move(2, 2);   // l'état au repos (le survol d'un bouton n'est pas son contraste de repos)
          await pg.waitForTimeout(450);
          const Q = await pg.evaluate(MESURE_QUALITE, '[data-relier-ma-boite]');
          if (Q.bas.length || Q.cibles.length || Q.cote || Q.petits.length) dit(false, `${nom} : F — écran ${ec.id} : contrastes, cibles, taille`, JSON.stringify({ bas: Q.bas.slice(0, 3), cibles: Q.cibles.slice(0, 3), petits: Q.petits.slice(0, 3), cote: Q.cote }));
          if (k === 0 || k === 2) await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `relier-${k + 2}-${nom}.png`) });
          if (ec.id === 'essai') break;
        }
        const g = vus.filter((x) => /^gmail\./.test(x.id));
        dit(g.length === 4 && g.every((x) => x.scene && x.pleins === 1) && /mail\.google\.com/.test(g[0].lien) && g[1].geste === 'copier' && g[2].geste === 'code' && vus[vus.length - 1].id === 'essai', `${nom} : F — Gmail en 4 écrans, chacun sa capture DESSINÉE et UN plein ; « Ouvrir Gmail » vers le transfert, « Copier », le code en direct, puis l'essai`, JSON.stringify(vus));
        // L'essai : le code de l'objet, puis la route le range ⇒ « Reçu ✓ ».
        const code = await r.locator('[data-essai-code]').getAttribute('data-essai-code');
        await r.locator('[data-copier-objet]').click();
        await pg.locator('[data-essai-phrase][data-essai-etat="attente"]').waitFor({ timeout: 5000 });
        await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `relier-essai-${nom}.png`) });
        etat.essai = { code, at: new Date(MAINTENANT).toISOString() };
        await pg.locator('[data-relier-ecran="recu"]').waitFor({ timeout: 12000 });
        const recu = await r.locator('[data-essai-recu]').getAttribute('data-essai-recu');
        dit(/^[A-Z2-9]{4}$/.test(code || '') && recu === code, `${nom} : F — en direct : « Reçu ✓ » quand la route range LE code de l'objet (${code})`, recu);
        await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `relier-recu-${nom}.png`) });
        const ecrits = etat.appels.filter((a) => a.m !== 'GET' && a.q.mode === 'adresse-unique');
        dit(!ecrits.length, `${nom} : F — le parcours n'écrit RIEN sur l'adresse (aucun POST adresse-unique)`, JSON.stringify(ecrits.slice(0, 2)));
        dit(!erreurs.length, `${nom} : relier — aucune erreur JavaScript`, erreurs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    await nav.close(); srv.close();
  }
  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s) — captures : ${CAPT}` : `\n✅ ${ok} verts — captures : ${CAPT}`);
  process.exit(ko ? 1 : 0);
})();
