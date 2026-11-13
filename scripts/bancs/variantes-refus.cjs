require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MESSAGES VARIÉS » — le message de refus automatique (12 nov., ext. 5.369)
//  Julien : « VRM ferait tourner plusieurs versions que tu écris toi-même […].
//  Personne ne reçoit exactement la même phrase que le précédent. »
//  Messages → Favoris & offres → Offres auto → « Message de refus » (et Annonces →
//  Outils → ⓘ). 390 px tactile ET 1512 px, clair ET sombre. Données INVENTÉES (jeu de
//  `nouveau-vendeur.cjs`), un faux pont d'extension qui NOTE toute commande.
//   V. sous le champ existant (1re version, inchangé) : la version 2 relue du nuage ;
//      « + Ajouter une variante » ajoute un champ VIDE (aucun texte inventé) ; on
//      l'écrit ⇒ rangé dans `vinted_offre_refus_variantes` (une source, synchronisée) ;
//      5 versions au plus (le bouton disparaît) ; « Retirer » enlève la bonne ;
//   E. extension 5.369 (clair) : rien à dire ; plus ancienne (sombre) : « Extension
//      5.369 requise », la version 1 part ;
//   H. l'historique dit « · version 2 » pour un refus noté avec sa version ;
//   F. rien n'est parti vers l'extension ; cibles ≥ 44 px ; aucun débordement ;
//      aucune erreur.
//  §6.1 : sur la branche de départ (5.362), aucun champ « version » ⇒ rouge.
//  Captures : SHOTS — à REGARDER (§6.2). BANC_PORT : le port.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-variantes-refus');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.369.0';
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
const lireVariantes = () => { try { return JSON.parse(localStorage.getItem('vinted_offre_refus_variantes')); } catch (_) { return 'illisible'; } };

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre';
      const t = Date.now();
      const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
      const main = lignes.find((l) => l.id === 'main').data;
      main.vinted_offres_auto = true;
      main.vinted_offre_refus_msg = 'Merci pour ton offre, c’est un peu bas pour moi.';
      main.vinted_offre_refus_variantes = ['Pas à ce prix, désolé ! Refais-moi une offre.'];
      Object.assign(main.vinted_annonce_numeros['51003'], { refuse: '30' });
      main.vinted_offres_garde = { v: 1, at: t, items: [], complet: true, manques: [], ambigus: 0 };
      lignes.push({ id: 'journal_vrm_111_aaaaaaaaaaaaaaaa', data: { e: [{ t: t - 2 * 3600000, s: 'offre_refusee', a: '51003', x: '62010', p: 18, auto: true, v: 2 }] } });
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
      await pg.route('**/api/compte?mode=favoris*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, vue: {} }) }));
      const vExt = sombre ? '5.362.0' : VERSION;
      await pg.addInitScript(PONT, { version: vExt });
      try {
        await pg.goto(`http://localhost:${NV.PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 15000 }).catch(() => {});
        await pg.click('[aria-label="Outils des annonces"]').catch(() => {});
        await pg.waitForSelector('[data-offres-auto-regler]', { timeout: 6000 }).catch(() => {});
        await pg.click('[data-offres-auto-regler]').catch(() => {});
        // Messages s'ouvre ; sous « Tous les sites » il montre les fils : on choisit Vinted
        // (Favoris & offres → Offres auto est une section de Vinted).
        await pg.waitForSelector('[data-filtre-site="messages"]', { timeout: 10000 }).catch(() => {});
        if (!(await pg.$('[data-offres-auto-ecran]'))) {
          await pg.click('[data-filtre-site="messages"] [data-site="vinted"]').catch(() => {});
          await pg.waitForSelector('[data-messages-zone="favoris"]', { timeout: 8000 }).catch(() => {});
          await pg.click('[data-messages-zone="favoris"]').catch(() => {});
          await attendre(500);
          await pg.locator('.vrm-fav-zones button', { hasText: 'Offres auto' }).click().catch(() => {});
        }
        const ouvert = await pg.waitForSelector('[data-offres-auto-ecran]', { timeout: 15000 }).then(() => true, () => false);
        if (!ouvert) await pg.screenshot({ path: path.join(SHOTS, `variantes-refus-${tag}-0-pas-ouvert.png`) });
        dit(ouvert, `O ${tag} : l'écran Offres auto s'ouvre`);
        const zone = pg.locator('[data-offres-auto-ecran] [data-versions="refus"]');
        const la = await zone.waitFor({ timeout: 8000 }).then(() => true, () => false);
        dit(la, `V ${tag} : sous « Message de refus », les autres versions`);
        if (la) {
          await zone.scrollIntoViewIfNeeded().catch(() => {});
          const v0 = await pg.evaluate(() => ({ premier: (document.querySelector('[data-offres-auto-ecran] [data-oa-refus-msg]') || {}).value, v: [...document.querySelectorAll('[data-offres-auto-ecran] [data-versions="refus"] [data-version]')].map((x) => [x.getAttribute('data-version'), x.value]), n: (document.querySelector('[data-offres-auto-ecran] [data-versions="refus"]') || { getAttribute: () => null }).getAttribute('data-versions-n') }));
          dit(/un peu bas/.test(v0.premier || '') && v0.v.length === 1 && v0.v[0][0] === '2' && /Pas à ce prix/.test(v0.v[0][1]) && v0.n === '2', `V ${tag} : la 1re version (champ d'avant) et la version 2 relues du nuage`, v0);
          const maj = await pg.locator('[data-offres-auto-ecran] [data-versions-maj]').count();
          dit(sombre ? maj === 1 : maj === 0, `E ${tag} : extension ${vExt} ⇒ ${sombre ? '« Extension 5.369 requise »' : 'rien à dire'}`, maj);
          await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `variantes-refus-${tag}-1.png`) });
          // + Ajouter une variante ⇒ un champ VIDE, puis on l'écrit.
          await zone.locator('[data-version-ajouter]').click();
          const v3 = zone.locator('[data-version="3"]');
          const vide = await v3.inputValue().catch(() => null);
          dit(vide === '', `V ${tag} : « + Ajouter une variante » ajoute un champ VIDE (aucun texte inventé)`, vide);
          await v3.fill('Un peu plus haut et c’est bon ?');
          await attendre(900);   // la sauvegarde attend 500 ms (save, App.jsx)
          const rangees = await pg.evaluate(lireVariantes);
          dit(JSON.stringify(rangees) === JSON.stringify(['Pas à ce prix, désolé ! Refais-moi une offre.', 'Un peu plus haut et c’est bon ?']), `V ${tag} : rangé dans vinted_offre_refus_variantes (une source)`, rangees);
          dit(await zone.getAttribute('data-versions-n') === '3', `V ${tag} : « 3 versions » dit sous les champs`);
          await zone.locator('[data-version-ajouter]').click(); await zone.locator('[data-version-ajouter]').click();
          dit(await zone.locator('[data-version]').count() === 4 && await zone.locator('[data-version-ajouter]').count() === 0, `V ${tag} : 5 versions au plus (le bouton disparaît)`);
          await zone.locator('[data-version-retirer="2"]').click(); await attendre(900);
          const apres = await pg.evaluate(lireVariantes);
          dit(Array.isArray(apres) && apres[0] === 'Un peu plus haut et c’est bon ?' && apres.length === 3, `V ${tag} : « Retirer » enlève la version 2, les suivantes remontent`, apres);
          const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-offres-auto-ecran] [data-versions] button')].filter((x) => { const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => x.textContent.trim()));
          if (tel) dit(!petits.length, `F ${tag} : boutons des versions ≥ 44 px au doigt`, petits);
          const deb = await pg.evaluate(() => { const el = document.querySelector('[data-offres-auto-ecran]'); const r = el.getBoundingClientRect(); const trop = [...el.querySelectorAll('[data-versions] *')].filter((x) => { const q = x.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map((x) => x.className || x.tagName).slice(0, 5); return { page: document.documentElement.scrollWidth - innerWidth, trop }; });
          dit(deb.page <= 0 && !deb.trop.length, `F ${tag} : aucun débordement`, deb);
          await zone.scrollIntoViewIfNeeded().catch(() => {});
          await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `variantes-refus-${tag}-2-quatre.png`) });
        }
        // H : l'historique dit la version notée.
        await pg.waitForFunction(() => { const g = document.querySelector('[data-oa-historique]'); return g && !/lecture/.test(g.getAttribute('data-oa-historique')); }, null, { timeout: 8000 }).catch(() => {});
        const h = await pg.evaluate(() => [...document.querySelectorAll('[data-oa-histo]')].map((e) => e.innerText.replace(/\s+/g, ' ')));
        dit(h.length === 1 && /Refusée \(auto\) · version 2/.test(h[0]), `H ${tag} : l'historique dit « · version 2 » (jamais le texte)`, h);
        const env = await pg.evaluate(() => window.__envois);
        dit(!(env || []).length, `F ${tag} : rien n'est parti vers l'extension`, env);
        const errs = journal.erreurs.concat(journal.console.filter((c) => !/Failed to load|ERR_|favicon|net::/.test(c)));
        dit(!errs.length, `F ${tag} : aucune erreur de page`, errs);
      } catch (e) { dit(false, `${tag} : le banc a levé`, e.message.split('\n')[0]); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\nKO  versions du refus : ${ko} rouge(s) — captures : ${SHOTS}` : `\nOK  versions du refus : écrites par lui, rangées une fois, 5 au plus — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
