require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PRIX MINI MANQUANTS » (11 nov., lot prix-mini) — Messages → Favoris &
//  offres → Offres auto, et la carte de Ma journée.
//  390 px tactile ET 1512 px, clair ET sombre. Données INVENTÉES (le jeu de
//  `nouveau-vendeur.cjs` : 12 annonces en ligne, comptes 111 et 222), faux pont
//  d'extension (à jour : la virgule est lue) qui NOTE toute commande.
//   J. Ma journée : clair ⇒ offres auto ALLUMÉES ⇒ « 10 annonces sans prix mini »
//      (12 en ligne − N°2 réglé − N°3 « 45,5 ») ; sombre ⇒ ÉTEINTES ⇒ aucune carte ;
//      « Saisir » ouvre Offres auto, la liste juste sous l'interrupteur ;
//   L. la liste : 10 lignes, la plus chère d'abord, N°5 « acheté 30 € » (prix
//      d'achat de SA fiche), aucun champ prérempli (jamais un prix proposé) ;
//   S. la saisie : « 20,5 » sur N°6 (acheté 50 €) ⇒ « Sous ton coût » (ambre) ;
//      Entrée ⇒ le champ suivant (N°5) ; « 40 » ⇒ bénéfice +8 € en direct
//      (40 − 30 − emballage 2) ; « Enregistrer » ⇒ confirmation « sous ton coût »
//      ⇒ N°5 à 40, N°6 à 20.5 (lisibles par le moteur), les deux sortent de la liste ;
//   F. rien n'est parti vers l'extension ; 44 px au doigt ; aucun débordement ;
//      aucune erreur. Captures SHOTS — à REGARDER (§6.2).
//  §6.1 : sur le build d'avant, la carte et la liste n'existent pas ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-prix-mini-manquants');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.342.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__envois = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'vendeuse_a' }, cmds: {} } });
    if (d.__vmr === 'cmd' || d.__vmr === 'exec') { window.__envois.push({ t: d.__vmr, cmd: d.cmd || d.endpoint || '' }); post({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: { ok: false } }); }
  });
  post({ __vmr: 'ready', version: o.version });
};
const attr = (pg, sel, a) => pg.getAttribute(sel, a).catch(() => null);

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre', allume = !sombre;
      const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
      const main = lignes.find((l) => l.id === 'main').data;
      main.vinted_offres_auto = allume;
      const N = main.vinted_annonce_numeros;
      Object.assign(N['51001'], { min: '45' });
      Object.assign(N['51002'], { min: '45,5' });
      Object.assign(N['51003'], { refuse: '30' });
      Object.assign(N['51004'], { buyPrice: '30', emballage: '2' });
      Object.assign(N['51005'], { buyPrice: '50' });
      main.vinted_offres_garde = { v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 };
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
      await pg.route('**/api/compte?mode=favoris*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, vue: {} }) }));
      await pg.addInitScript(PONT, { version: VERSION });
      try {
        // ── J : Ma journée ──
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-job]', { timeout: 20000 }).catch(() => {});
        await pg.waitForFunction(() => !!document.querySelector('[data-job="prix-mini-manquants"]'), null, { timeout: allume ? 15000 : 5000 }).catch(() => {});
        const carte = await pg.evaluate(() => { const e = document.querySelector('[data-job="prix-mini-manquants"]'); return e ? { n: e.getAttribute('data-n'), txt: e.innerText.replace(/\s+/g, ' ') } : null; });
        if (allume) dit(carte && carte.n === '10' && /10 annonces sans prix mini/.test(carte.txt), `J ${tag} : allumées ⇒ « 10 annonces sans prix mini »`, carte);
        else dit(!carte, `J ${tag} : éteintes ⇒ aucune carte`, carte);
        if (carte) { await pg.locator('[data-job="prix-mini-manquants"]').first().scrollIntoViewIfNeeded().catch(() => {}); await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `pmm-${tag}-0-journee.png`) }); }
        // L'écran : par la carte (allumées), sinon par Annonces → Outils → « Régler par paire ».
        if (carte) await pg.locator('[data-job="prix-mini-manquants"]').first().click().catch(() => {});
        else {
          await pg.goto(`http://localhost:${NV.PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
          await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 15000 }).catch(() => {});
          await pg.click('[aria-label="Outils des annonces"]').catch(() => {});
          await pg.waitForSelector('[data-offres-auto-regler]', { timeout: 6000 }).catch(() => {});
          await pg.click('[data-offres-auto-regler]').catch(() => {});
        }
        const ouvert = await pg.waitForSelector('[data-offres-auto-ecran] [data-pmm]', { timeout: 15000 }).then(() => true, () => false);
        dit(ouvert, `J ${tag} : ${carte ? '« Saisir » ouvre' : 'Outils ouvre'} Offres auto, « Prix mini manquants » sous l’interrupteur`);
        await pg.waitForFunction(() => document.querySelectorAll('[data-pmm-ligne]').length >= 10, null, { timeout: 15000 }).catch(() => {});
        await pg.evaluate(() => window.scrollTo(0, 0)); await attendre(500);
        await pg.screenshot({ path: path.join(SHOTS, `pmm-${tag}-1-haut.png`) });
        // ── L : la liste ──
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-pmm-ligne]')].map((e) => ({ id: e.getAttribute('data-pmm-ligne'), achat: e.getAttribute('data-pmm-achat'), v: e.querySelector('input').value, txt: e.innerText.replace(/\s+/g, ' ') })));
        const ids = L.map((x) => x.id);
        dit(L.length === 10 && !ids.includes('51001') && !ids.includes('51002') && ids.includes('51003'), `L ${tag} : 10 lignes (N°2 et N°3 réglés absents, N°4 « Refuser sous » seul présent)`, ids);
        dit(ids[0] === '51013' && ids.indexOf('51005') < ids.indexOf('51004'), `L ${tag} : la plus chère d’abord`, ids.slice(0, 4));
        const l5 = L.find((x) => x.id === '51004') || {};
        dit(l5.achat === '30' && /N°5/.test(l5.txt) && /65 €/.test(l5.txt) && /acheté 30 €/.test(l5.txt), `L ${tag} : N°5 · 65 € · acheté 30 € (sa fiche)`, l5);
        dit(L.length > 0 && L.every((x) => x.v === ''), `L ${tag} : aucun champ prérempli (jamais un prix proposé)`, L.map((x) => x.v));
        dit((L.find((x) => x.id === '51006') || {}).achat === '' && /achat pas saisi/.test((L.find((x) => x.id === '51006') || {}).txt || ''), `L ${tag} : achat inconnu ⇒ « achat pas saisi », jamais un chiffre`);
        // ── S : la saisie en série ──
        const c6 = pg.locator('[data-pmm-ligne="51005"] input');
        await c6.scrollIntoViewIfNeeded().catch(() => {});
        await c6.click(); await c6.fill('20,5');
        await attendre(150);
        const s6 = await pg.evaluate(() => { const e = document.querySelector('[data-pmm-ligne="51005"]'); return { sous: e.getAttribute('data-pmm-sous'), benef: e.getAttribute('data-pmm-benef'), txt: e.innerText.replace(/\s+/g, ' ') }; });
        dit(s6.sous === '1' && s6.benef === '-29.5' && /Sous ton coût/.test(s6.txt), `S ${tag} : « 20,5 » sur N°6 (acheté 50 €) ⇒ −29,50 €, « Sous ton coût »`, s6);
        await c6.press('Enter'); await attendre(150);
        const suiv = await pg.evaluate(() => { const a = document.activeElement; const li = a && a.closest('[data-pmm-ligne]'); return li ? li.getAttribute('data-pmm-ligne') : (a && a.tagName); });
        dit(suiv === '51004', `S ${tag} : Entrée ⇒ le champ suivant (N°5)`, suiv);
        await pg.keyboard.type('40'); await attendre(150);
        const s5 = await attr(pg, '[data-pmm-ligne="51004"]', 'data-pmm-benef');
        const s5t = await pg.evaluate(() => (document.querySelector('[data-pmm-ligne="51004"] [data-pmm-benef-txt]') || {}).innerText || '');
        dit(s5 === '8' && /\+8 €/.test(s5t), `S ${tag} : « 40 » ⇒ +8 € en direct (40 − 30 − emballage 2)`, [s5, s5t]);
        dit(await attr(pg, '[data-pmm-enregistrer]', 'data-pmm-enregistrer') === '2', `S ${tag} : UN « Enregistrer » pour les 2 saisies`);
        await pg.locator('[data-pmm-pied]').scrollIntoViewIfNeeded().catch(() => {}); await attendre(300);
        await pg.screenshot({ path: path.join(SHOTS, `pmm-${tag}-2-saisie.png`) });
        // 44 px au doigt, aucun débordement (dans l'écran entier).
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-offres-auto-ecran] button, [data-offres-auto-ecran] input, [data-offres-auto-ecran] label.vrm-oa-case, [data-offres-auto-ecran] textarea')].filter((x) => { if (x.closest('[hidden],details:not([open])') || x.type === 'checkbox') return false; const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 30)));
        if (tel) dit(!petits.length, `F ${tag} : cibles ≥ 44 px au doigt`, petits);
        const deb = await pg.evaluate(() => { const el = document.querySelector('[data-offres-auto-ecran]'); const r = el.getBoundingClientRect(); const trop = [...el.querySelectorAll('*')].filter((x) => { const q = x.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map((x) => String(x.className || x.tagName)).slice(0, 5); return { page: document.documentElement.scrollWidth - innerWidth, trop }; });
        dit(deb.page <= 0 && !deb.trop.length, `F ${tag} : aucun débordement`, deb);
        await pg.click('[data-pmm-enregistrer]');
        const conf = await pg.waitForSelector('.vrm-confirmation', { timeout: 5000 }).then(() => true, () => false);
        const confTxt = conf ? await pg.evaluate(() => document.querySelector('.vrm-confirmation').innerText.replace(/\s+/g, ' ')) : '';
        dit(conf && /sous ton coût/.test(confTxt) && /N°6/.test(confTxt) && !/N°5 /.test(confTxt), `S ${tag} : la confirmation nomme N°6 sous son coût (et pas N°5)`, confTxt);
        await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `pmm-${tag}-3-confirmation.png`) });
        await pg.locator('.vrm-confirmation button').last().click().catch(() => {});
        await pg.waitForFunction(() => !document.querySelector('[data-pmm-ligne="51004"]') && !document.querySelector('[data-pmm-ligne="51005"]'), null, { timeout: 6000 }).catch(() => {});
        const apres = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-pmm-ligne]').length, m5: (document.querySelector('[data-oa-paire="51004"]') || { getAttribute: () => null }).getAttribute('data-oa-min'), m6: (document.querySelector('[data-oa-paire="51005"]') || { getAttribute: () => null }).getAttribute('data-oa-min'), envois: window.__envois }));
        dit(apres.n === 8 && apres.m5 === '40' && apres.m6 === '20.5', `S ${tag} : enregistrés ⇒ N°5 à 40, N°6 à 20.5 (lisibles par le moteur), 8 lignes restent`, apres);
        dit(!(apres.envois || []).length, `F ${tag} : rien n’est parti vers l’extension`, apres.envois);
        await pg.evaluate(() => window.scrollTo(0, 0)); await attendre(300);
        await pg.screenshot({ path: path.join(SHOTS, `pmm-${tag}-4-apres.png`), fullPage: !tel });
        const errs = journal.erreurs.concat(journal.console.filter((c) => !/Failed to load|ERR_|favicon|net::/.test(c)));
        dit(!errs.length, `F ${tag} : aucune erreur de page`, errs);
      } catch (e) { dit(false, `${tag} : le banc a levé`, e.message.split('\n')[0]); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\nKO  prix mini manquants : ${ko} rouge(s) — captures : ${SHOTS}` : `\nOK  prix mini manquants : la liste, la saisie en série et la carte de Ma journée — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
