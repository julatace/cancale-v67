require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LISTES : RECHERCHE EN PHRASE, GLISSER POUR COCHER, ÉPINGLES, COMPARER (14 nov., chantiers 92–95)
//  (node scripts/bancs/listes-recherche.cjs — après le build ; BANC_DIST=… pour un autre build)
//  Récit : docs/passation/2026-11-14-listes-recherche.md.
//
//  Base INVENTÉE (`design-passe.cjs` : 3 comptes) + 1 000 annonces sur le premier compte (marques,
//  tailles, prix, dates de mise en ligne étalées sur 200 jours, un N° chacune) et trois colis à
//  retirer publiés par Colis (`vrm_colis_retirer` : Mondial Relay demain, Chronopost demain, Mondial
//  Relay après-demain). Téléphone 390 tactile, clair (et une capture sombre). Il exige :
//   R  la phrase « nike 42 pas vendue depuis 2 mois » dans la recherche d'Annonces : 4 capsules
//      (marque, taille, état, durée), le compte rendu = le nombre ATTENDU (calculé ici sur la base),
//      chaque carte affichée porte une paire de la base qui tient les 4 filtres, en < 300 ms ;
//      « C'est un N° » réécrit la recherche ; « veja campo » dit « rien » ; « colis mondial relay
//      demain » : 3 capsules « pas ici » et « Chercher dans les colis » ouvre la loupe, qui montre
//      LE colis Mondial Relay de demain, lui seul ;
//   G  Sélectionner : un doigt posé sur la 1re case glisse vers le bas (défilement automatique au
//      bord) puis s'arrête sur la 30e ligne ⇒ EXACTEMENT les 30 premières lignes cochées ; un doigt
//      qui glisse ailleurs que sur une case fait défiler sans rien cocher ; chaque ligne garde une
//      vraie case (VoiceOver) ;
//   E  « Épingler » sur deux lignes : l'écriture part vers la base (`vrm_epingles`, par identité),
//      les deux paires passent en tête de leur compte dans la liste, et y restent après un
//      rechargement servi avec la ligne écrite ; la base qui ne répond pas ⇒ rien n'est écrit ;
//   C  « Comparer » deux lignes cochées : deux colonnes, les prix de la base, « — » pour l'achat
//      pas saisi, aucune donnée inventée.
//  Captures : $SHOTS (À REGARDER). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, UID, SESSION, chromium } = P;
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-listes-recherche');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400000, NOW = Date.now();
const MARQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'], MOD = ['air max 1', 'samba', 'xt-6', '550', 'gel-1130', 'old skool', 'dunk low', 'gazelle'];
const jourParis = (ms) => new Date(ms + 3600000).toISOString().slice(0, 10);   // novembre : UTC+1

function baseListes() {
  const b = base();
  const a = b.accounts[0]; const uid = a.vinted_user_id;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const items = []; const num = b.main[0].data.vinted_annonce_numeros;
  for (let i = 0; i < 1000; i++) {
    const id = 7500000000 + i; const age = (i * 7) % 200 + 1;
    items.push({ id, title: `${MARQ[i % 6]} ${MOD[i % 8]} taille ${36 + (i % 10)}`, brand_title: MARQ[i % 6], size_title: String(36 + (i % 10)), status: i % 3 ? 'Très bon état' : 'Bon état',
      price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: i % 5, view_count: 10 + (i % 40),
      created_at_ts: new Date(NOW - age * J).toISOString(), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor((NOW - age * J) / 1000) } } });
    num[id] = { num: String(500 + i), numero: String(500 + i), numberedAt: new Date(NOW - age * J).toISOString() };
  }
  lst.data.payload.items = items; lst.data.nItems = items.length; lst.data.payload.pagination = { total_entries: items.length };
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  if (enl) { enl.data.n = items.length; enl.data.ids = items.map((x) => x.id); enl.data.items = items.map((x) => ({ id: x.id, title: x.title })); }
  b.main[0].data.vinted_used_nums = Object.values(num).map((x) => Number(x.num));
  const dem = jourParis(NOW + J), apres = jourParis(NOW + 2 * J);
  b.main[0].data.vrm_colis_retirer = { total: 3, prets: 3, sansCode: 0, aVerifier: 0, urgents: 2, enVerification: 0, at: NOW,
    colis: [[dem, NOW - J, 'mondialrelay', 'e:MR0001', 1, '', '', 'Salomon XT-6 gris'], [dem, NOW - J, 'chronopost', 'e:CH0001', 1, '', '', 'Asics Gel-1130'], [apres, NOW - J, 'mondialrelay', 'e:MR0002', 1, '', '', 'Nike Dunk Low']],
    verif: [], vus: [], vusTx: [], finis: [] };
  b._items = items; b._uid = uid;
  return b;
}
const ATTENDU_PHRASE = (items) => items.filter((x) => /nike/i.test(x.brand_title + ' ' + x.title) && x.size_title === '42' && Math.floor((NOW - Date.parse(x.created_at_ts)) / J) >= 60);

async function ouvrir(nav, { b, url = '/?tab=annonces', sombre = false, mainKo = false }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: Number(process.env.DSF || 1), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = [], ecrits = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1'); localStorage.setItem('vrm_langue', 'fr');
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  const rest = async (route) => {
    const req = route.request(), m = req.method(); const u = decodeURIComponent(req.url());
    if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (m !== 'GET' && m !== 'HEAD') {
      if (/app_data/.test(u)) ecrits.push({ m, u, corps: req.postData() || '' });
      return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.accounts.map((a) => ({ ...a, owner: UID }))) });
    if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (mainKo && /id=eq\.main(&|$)/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"injoignable"}' });
    const lignes = [...b.main, ...b.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
    const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
  };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (r.request().resourceType() === 'image' || /vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ccd"/></svg>' });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true } }) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: { ...SESSION.user, factors: [] }, id: UID, email: SESSION.user.email, factors: [] }) });
    if (/\/rest\/v1\//.test(u)) return rest(r);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=confidentialite/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: UID }) });
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', rest);
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, ecrits };
}
const taper = (pg, sel, texte) => pg.evaluate(([sel, texte]) => {
  const el = document.querySelector(sel); if (!el) return false;
  const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  poser.call(el, texte); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
}, [sel, texte]);
const CHAMP = '[data-ann-recherche] input, input[data-ann-recherche]';

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  let rouges = 0;
  const dit = (ok, msg, det) => { console.log(`${ok ? '✓' : '✗'} ${msg}${!ok && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : ''}`); if (!ok) rouges++; };
  const essai = async (nom, fn) => { try { await fn(); } catch (e) { rouges++; console.log(`✗ ${nom} : ${String(e.message || e).slice(0, 300)}`); } };
  const b = baseListes();
  const PARTIES = String(process.env.PARTIES || 'R,G,E,C').split(',');

  // ── R. La recherche en phrase ──
  if (PARTIES.includes('R')) await essai('recherche', async () => {
    const o = await ouvrir(nav, { b });
    const vu = await o.pg.waitForSelector('[data-carte-annonce]', { timeout: 60000, state: 'attached' }).then(() => true).catch(() => false);
    dit(vu, 'Annonces : la liste des 1 000 annonces est rendue');
    await o.pg.waitForTimeout(1500);
    const attendus = ATTENDU_PHRASE(b._items);
    const t = await o.pg.evaluate(async ([sel, n]) => {
      const el = document.querySelector(sel); if (!el) return { pasDeChamp: true };
      const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const t0 = performance.now(); poser.call(el, 'nike 42 pas vendue depuis 2 mois'); el.dispatchEvent(new Event('input', { bubbles: true }));
      while (performance.now() - t0 < 8000) {
        const p = document.querySelector('[data-phrase]');
        if (p && p.getAttribute('data-phrase-n') === String(n)) return { ms: Math.round(performance.now() - t0) };
        await new Promise((r) => setTimeout(r, 5));
      }
      const p = document.querySelector('[data-phrase]');
      return { ms: null, n: p && p.getAttribute('data-phrase-n') };
    }, [CHAMP, attendus.length]);
    dit(t.ms != null && t.ms < 300, `« nike 42 pas vendue depuis 2 mois » : ${attendus.length} paires annoncées en ${t.ms} ms (< 300 ms)`, t);
    await o.pg.waitForTimeout(600);
    const caps = await o.pg.$$eval('[data-phrase-filtre]', (l) => l.map((e) => e.getAttribute('data-phrase-filtre') + (e.getAttribute('data-phrase-ambigu') ? '?' : '')));
    dit(caps.join(' ') === 'marque taille? etat depuis', `4 capsules visibles : ${caps.join(' · ')}`, caps);
    const ids = new Set(attendus.map((x) => String(x.id)));
    const cartes = await o.pg.$$eval('[data-carte-annonce]', (l) => l.filter((e) => e.getBoundingClientRect().height > 8).map((e) => e.getAttribute('data-carte-annonce')));
    dit(cartes.length > 0 && cartes.every((id) => ids.has(id)), `les ${cartes.length} cartes affichées tiennent toutes les 4 filtres (aucune devinée)`, cartes.filter((id) => !ids.has(id)).slice(0, 5));
    await o.pg.screenshot({ path: path.join(SHOTS, 'phrase-annonces.png') });
    // la capsule ambiguë : « C'est un N° » réécrit la recherche
    await o.pg.click('[data-phrase-filtre="taille"]');
    await o.pg.waitForSelector('[data-phrase-feuille="taille"]', { timeout: 4000 });
    await o.pg.screenshot({ path: path.join(SHOTS, 'phrase-capsule.png') });
    await o.pg.click('[data-phrase-en-numero]');
    await o.pg.waitForTimeout(400);
    const q2 = await o.pg.$eval(CHAMP, (e) => e.value);
    const caps2 = await o.pg.$$eval('[data-phrase-filtre]', (l) => l.map((e) => e.getAttribute('data-phrase-filtre')));
    dit(q2 === 'nike N°42 pas vendue depuis 2 mois' && caps2.includes('numero') && !caps2.includes('taille'), `« C’est un N° » : la recherche devient « ${q2} »`, caps2);
    dit(await o.pg.$('[data-phrase-rien]') != null, 'aucune paire Nike sous le N°42 : « Rien ne correspond » est dit');
    await taper(o.pg, CHAMP, 'veja campo'); await o.pg.waitForTimeout(500);
    dit(await o.pg.$('[data-phrase-rien]') != null && (await o.pg.$$eval('[data-carte-annonce]', (l) => l.filter((e) => e.getBoundingClientRect().height > 8).length)) === 0, '« veja campo » : rien, et c’est dit');
    await taper(o.pg, CHAMP, 'colis mondial relay demain'); await o.pg.waitForTimeout(500);
    const off = await o.pg.$$eval('[data-phrase-ignore="1"]', (l) => l.map((e) => e.getAttribute('data-phrase-filtre')));
    dit(off.length === 3, `dans Annonces, « colis mondial relay demain » : ${off.join(' · ')} dits « pas ici »`, off);
    await o.pg.screenshot({ path: path.join(SHOTS, 'phrase-pas-ici.png') });
    const lien = await o.pg.$('[data-phrase-ailleurs="colis"]');
    dit(!!lien, '« Chercher dans les colis » est proposé');
    if (lien) {
      await lien.click();
      const ok = await o.pg.waitForSelector('[data-recherche-phrase-type="colis"]', { timeout: 15000 }).then(() => true).catch(() => false);
      const lc = ok ? await o.pg.$$eval('[data-recherche-resultat="phrase-colis"]', (l) => l.map((e) => e.getAttribute('data-phrase-colis') + '@' + e.getAttribute('data-phrase-limite'))) : [];
      dit(lc.length === 1 && lc[0] === `mondialrelay@${jourParis(NOW + J)}`, `la loupe : LE colis Mondial Relay de demain, lui seul (${lc.join(', ')})`, lc);
      await o.pg.screenshot({ path: path.join(SHOTS, 'phrase-loupe-colis.png') });
    }
    if (o.erreurs.length) dit(false, 'erreurs de page', o.erreurs);
    await o.ctx.close();
  });

  // ── G. Glisser pour cocher 30 lignes ──
  let selection = null;
  if (PARTIES.includes('G') || PARTIES.includes('E') || PARTIES.includes('C')) await essai('glisser', async () => {
    const o = await ouvrir(nav, { b });
    await o.pg.waitForSelector('[data-vue-selection]', { timeout: 60000 });
    await o.pg.click('[data-vue-selection]');
    const okP = await o.pg.waitForSelector('[data-glisse-poignee]', { timeout: 20000 }).then(() => true).catch(() => false);
    dit(okP, 'Sélectionner : chaque ligne a sa poignée (la case)');
    if (!okP) { await o.pg.screenshot({ path: path.join(SHOTS, 'glisser-absent.png') }); await o.ctx.close(); return; }
    await o.pg.waitForTimeout(800);
    const cases = await o.pg.$$eval('[data-glisse-cle]', (l) => l.map((e) => ({ k: e.getAttribute('data-glisse-cle'), c: !!e.querySelector('[data-glisse-poignee] input[type="checkbox"][aria-label]') })));
    dit(cases.length >= 1000 && cases.every((x) => x.c), `${cases.length} lignes, chacune une vraie case (VoiceOver coche une à une)`);
    const ordre = cases.map((x) => x.k);
    const cdp = await o.ctx.newCDPSession(o.pg);
    const touche = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
    const centre = (k) => o.pg.evaluate((k) => { const e = document.querySelector(`[data-glisse-cle="${CSS.escape(k)}"] [data-glisse-poignee]`); e.scrollIntoView({ block: 'center' }); return null; }, k);
    await centre(ordre[0]); await o.pg.waitForTimeout(300);
    const pos = (k) => o.pg.evaluate((k) => { const e = document.querySelector(`[data-glisse-cle="${CSS.escape(k)}"] [data-glisse-poignee]`); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, k);
    const coches = () => o.pg.$$eval('[data-sel-coche="1"]', (l) => l.length);
    const scrollY = () => o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return (m && m.scrollHeight > m.clientHeight + 4 ? m.scrollTop : document.scrollingElement.scrollTop); });
    // 1. le doigt ailleurs que sur une case : la liste défile, rien n'est coché
    { const t0 = await pos(ordre[3]); const x = 250; const y0 = Math.min(700, t0.y + 120);
      const av = await scrollY();
      await touche('touchStart', x, y0); for (let i = 1; i <= 10; i++) { await touche('touchMove', x, y0 - i * 25); await o.pg.waitForTimeout(16); } await touche('touchEnd');
      await o.pg.waitForTimeout(600);
      dit((await coches()) === 0, `un doigt qui glisse sur le titre : rien n'est coché (défilement ${Math.round((await scrollY()) - av)} px)`); }
    await centre(ordre[0]); await o.pg.waitForTimeout(300);
    // 2. depuis la 1re case, vers le bas jusqu'au bord (défilement auto), puis sur la 30e ligne
    const p0 = await pos(ordre[0]);
    const av = await scrollY();
    await touche('touchStart', p0.x, p0.y);
    for (let i = 1; i <= 8; i++) { await touche('touchMove', p0.x, p0.y + i * 4); await o.pg.waitForTimeout(16); }
    const bas = await o.pg.evaluate(() => { const n = document.querySelector('.vrm-mobile-nav'); return n && n.getBoundingClientRect().height ? n.getBoundingClientRect().top : innerHeight; });
    let y = p0.y + 32; while (y < bas - 12) { y += 30; await touche('touchMove', p0.x, Math.min(y, bas - 12)); await o.pg.waitForTimeout(16); }
    let tours = 0; while ((await coches()) < 34 && tours++ < 120) { await touche('touchMove', p0.x, bas - 12); await o.pg.waitForTimeout(40); }
    const auto = (await scrollY()) - av;
    const p29 = await o.pg.evaluate((k) => { const e = document.querySelector(`[data-glisse-cle="${CSS.escape(k)}"] [data-glisse-poignee]`); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ordre[29]);
    for (let i = 1; i <= 6; i++) { await touche('touchMove', p0.x, bas - 12 + (p29.y - (bas - 12)) * i / 6); await o.pg.waitForTimeout(30); }
    await o.pg.waitForTimeout(150);
    await touche('touchEnd'); await o.pg.waitForTimeout(700);
    const coch = await o.pg.$$eval('[data-glisse-cle]', (l) => l.filter((e) => e.querySelector('[data-sel-coche="1"]')).map((e) => e.getAttribute('data-glisse-cle')));
    dit(auto > 100, `au bord, la liste a défilé seule (${Math.round(auto)} px)`);
    dit(coch.length === 30 && coch.every((k, i) => k === ordre[i]), `glisser de la 1re à la 30e ligne : ${coch.length} cochées, les 30 premières`, { n: coch.length, premiers: coch.slice(0, 3), dernier: coch[coch.length - 1], attendu: ordre[29] });
    const nBouton = await o.pg.$eval('[data-actions-possibles]', (e) => e.getAttribute('data-actions-possibles')).catch(() => null);
    dit(nBouton === '30', `la barre d’actions dit 30 (${nBouton})`);
    await o.pg.screenshot({ path: path.join(SHOTS, 'glisser-30.png') });
    selection = { ordre };
    if (o.erreurs.length) dit(false, 'erreurs de page', o.erreurs);
    await o.ctx.close();
  });

  // ── E et C. Épingler deux lignes, comparer deux lignes ──
  if ((PARTIES.includes('E') || PARTIES.includes('C')) && selection) await essai('epingles', async () => {
    const o = await ouvrir(nav, { b });
    await o.pg.waitForSelector('[data-vue-selection]', { timeout: 60000 });
    await o.pg.click('[data-vue-selection]');
    await o.pg.waitForSelector('[data-glisse-poignee]', { timeout: 20000 });
    await o.pg.waitForTimeout(800);
    const choisir = async (k) => { await o.pg.evaluate((k) => { const e = document.querySelector(`[data-glisse-cle="${CSS.escape(k)}"] input[type="checkbox"]`); e.scrollIntoView({ block: 'center' }); }, k); await o.pg.waitForTimeout(150); await o.pg.click(`[data-glisse-cle="${k}"] input[type="checkbox"]`); await o.pg.waitForTimeout(150); };
    const [k5, k9] = [selection.ordre[5], selection.ordre[9]];
    await choisir(k5); await choisir(k9);
    if (PARTIES.includes('C')) {
      const bc = await o.pg.$('[data-comparer-ouvrir]');
      dit(!!bc, '« Comparer » apparaît avec exactement deux lignes cochées');
      if (bc) {
        await bc.click(); await o.pg.waitForSelector('[data-comparer]', { timeout: 4000 });
        const v = await o.pg.$$eval('[data-comparer-ligne]', (l) => Object.fromEntries(l.map((e) => [e.getAttribute('data-comparer-ligne'), [...e.querySelectorAll('[data-comparer-val]')].map((d) => ({ brut: d.getAttribute('data-comparer-brut'), txt: d.textContent.trim() }))])));
        const it = (k) => b._items.find((x) => String(x.id) === k.split(':')[1]);
        const pA = Number(it(k5).price.amount), pB = Number(it(k9).price.amount);
        dit(v.prix && Number(v.prix[0].brut) === pA && Number(v.prix[1].brut) === pB, `prix : ${pA} € et ${pB} €, ceux de la base`, v.prix);
        dit(v.achat && v.achat.every((x) => x.brut === '' && x.txt === '—') && v.marge.every((x) => x.txt === '—'), 'achat pas saisi : « — », et donc pas de marge (rien d’inventé)', [v.achat, v.marge]);
        dit(['achat', 'prix', 'depuis', 'etat'].every((k) => v[k] && v[k].length === 2), 'colonnes alignées : achat, prix, en ligne depuis, état', Object.keys(v));
        await o.pg.screenshot({ path: path.join(SHOTS, 'comparer.png') });
        await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(300);
      }
    }
    if (PARTIES.includes('E')) {
      const be = await o.pg.$('[data-epingler="poser"]');
      dit(!!be, '« Épingler » sur la sélection');
      if (be) {
        await be.click();
        let ecrit = null; for (let i = 0; i < 40 && !ecrit; i++) { await o.pg.waitForTimeout(250); ecrit = o.ecrits.find((w) => /vrm_epingles/.test(w.corps)); }
        const cles = ecrit ? (() => { try { const j = JSON.parse(ecrit.corps); const d = Array.isArray(j) ? j[0] : j; return Object.keys(((d && d.data) || d || {}).vrm_epingles || {}); } catch (_) { return (ecrit.corps.match(/a:\d+:\d+/g) || []); } })() : [];
        const voulues = [k5, k9].map((k) => 'a:' + k);
        dit(!!ecrit && voulues.every((k) => cles.includes(k)), `l’écriture part vers la base : vrm_epingles = ${cles.join(', ')}`, ecrit && ecrit.corps.slice(0, 300));
        await o.pg.click('[data-vue-toutes]'); await o.pg.waitForTimeout(1200);
        const enTete = await o.pg.$$eval('[data-vignette-cle]', (l, uid) => l.map((e) => e.getAttribute('data-vignette-cle')).filter((k) => k.startsWith(uid + '_')).slice(0, 2), b._uid);
        const v2 = [k5, k9].map((k) => k.replace(':', '_')).sort();
        dit(enTete.slice().sort().join() === v2.join(), `les deux épinglées sont en tête de leur compte (${enTete.join(', ')})`, { enTete, v2 });
        dit((await o.pg.$$('[data-epinglee]')).length >= 2, 'la marque de l’épingle est posée sur leurs vignettes');
        await o.pg.screenshot({ path: path.join(SHOTS, 'epingles-annonces.png') });
        // rechargement servi avec la ligne écrite : les épingles y sont toujours (synchronisées)
        if (ecrit) {
          let pins = {}; for (const k of voulues) { const [, u, id] = k.split(':'); pins[k] = { uid: u, id, n: '', t: Date.now() - (k === voulues[0] ? 1 : 0) }; }
          const b2 = baseListes(); b2.main[0].data.vrm_epingles = pins;
          const o2 = await ouvrir(nav, { b: b2 });
          await o2.pg.waitForSelector('[data-carte-annonce]', { timeout: 60000, state: 'attached' }); await o2.pg.waitForTimeout(1500);
          const t2 = await o2.pg.$$eval('[data-vignette-cle]', (l, uid) => l.map((e) => e.getAttribute('data-vignette-cle')).filter((k) => k.startsWith(uid + '_')).slice(0, 2), b._uid);
          dit(t2.slice().sort().join() === v2.join(), `un autre appareil (la ligne relue) : les mêmes en tête (${t2.join(', ')})`);
          await o2.ctx.close();
        }
      }
    }
    if (o.erreurs.length) dit(false, 'erreurs de page', o.erreurs);
    await o.ctx.close();
    // La base ne répond pas : rien n'est écrit (« pas su » ne vaut pas « vide »)
    if (PARTIES.includes('E')) {
      const o3 = await ouvrir(nav, { b: baseListes(), mainKo: true });
      const sel = await o3.pg.waitForSelector('[data-vue-selection]', { timeout: 45000 }).then(() => true).catch(() => false);
      if (!sel) { console.log('  (base injoignable : l’écran Annonces ne monte pas — aucune épingle ne peut être posée, donc rien n’est écrit)'); dit(!o3.ecrits.some((w) => /vrm_epingles/.test(w.corps)), 'base injoignable : aucune écriture d’épingle'); }
      else {
        await o3.pg.click('[data-vue-selection]');
        const okc = await o3.pg.waitForSelector('[data-glisse-poignee] input', { timeout: 20000 }).then(() => true).catch(() => false);
        if (okc) { await o3.pg.click('[data-glisse-poignee] input'); const bb = await o3.pg.$('[data-epingler="poser"]'); if (bb) await bb.click(); }
        await o3.pg.waitForTimeout(4000);
        dit(!o3.ecrits.some((w) => /vrm_epingles/.test(w.corps)), `base injoignable : l’épingle n’écrit rien (${o3.ecrits.length} écritures, aucune d’épingle)`);
      }
      await o3.ctx.close();
    }
  });

  // une capture sombre de la phrase (à regarder)
  if (PARTIES.includes('R') && !process.env.SANS_SOMBRE) await essai('sombre', async () => {
    const o = await ouvrir(nav, { b, sombre: true });
    await o.pg.waitForSelector('[data-carte-annonce]', { timeout: 60000, state: 'attached' }); await o.pg.waitForTimeout(1200);
    await taper(o.pg, CHAMP, 'adidas samba < 80 € depuis 2 mois'); await o.pg.waitForTimeout(800);
    await o.pg.screenshot({ path: path.join(SHOTS, 'phrase-sombre.png') });
    await o.ctx.close();
  });

  console.log(rouges ? `✗ ROUGE — ${rouges} défaut(s)` : '✓ VERT — phrase, glisser, épingles, comparer');
  console.log('captures :', SHOTS);
  await nav.close(); srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
