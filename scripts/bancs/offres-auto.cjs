require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « OFFRES AUTO » (11 nov., lot DJ8) — Messages → Favoris & offres → Offres auto.
//  390 px tactile ET 1512 px, clair ET sombre. Données INVENTÉES (le jeu de
//  `nouveau-vendeur.cjs` : comptes 111 « vendeuse_a » et 222 « vendeuse_b »), un faux
//  pont d'extension (compte de l'onglet : 111) qui NOTE toute commande.
//   O. l'écran s'ouvre par Favoris & offres → « Offres auto » (et depuis Annonces →
//      Outils → « Régler par paire ») ; l'interrupteur est allumé ;
//   A. l'aperçu dit ce que le moteur ferait de chaque offre en attente :
//      48 € sur N°2 (dès 45) ⇒ « Acceptée 3 à 20 min après » ; 20 € sur N°4 (refus
//      sous 30) ⇒ « Refusée » ; 40 € sur N°5 (aucune règle) ⇒ « Aucune règle » ;
//      50 € sur N°3 (mini « 45,5 » : le moteur l'ignore) ⇒ « seuil illisible » ;
//   S. « Corriger » rend le seuil lisible (N°3 ⇒ 45.5, l'offre passe « Acceptée ») ;
//      un seuil tapé « 39,5 » sur N°5 s'écrit 39.5 et l'aperçu suit ; « Régler en
//      série · 2 » ouvre la feuille Prix mini ;
//   H. l'historique : les 2 offres NOTÉES du compte 111 (jamais le 1110, piège du LIKE) ;
//   P. la jauge 41/50 ⇒ « ralentis tes clics » ; un frein vu il y a 2 h ⇒ journée calme ;
//   T. « Tout arrêter » (confirmé) : offres auto éteintes ; auto_stop + arreter partent
//      pour CHAQUE compte, rien d'autre ;
//   F. rien n'est parti vers l'extension ; 44 px ; aucun débordement ; aucune erreur.
//  §6.1 : sur origin/main, l'écran n'existe pas ⇒ rouge.
//  Captures : SHOTS — à REGARDER (§6.2). BANC_PORT : le port (nouveau-vendeur.cjs le lit).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-offres-auto');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.339.0';
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
const offre = (oid, item, titre, prix, uid = 111) => ({ id: `harvest_${uid}_conv_${oid}`, data: { capturedAt: new Date().toISOString(), payload: { conversation: {
  id: oid, opposite_user: { id: 9000 + oid, login: 'acheteur' + oid }, transaction: { item_id: item, item_title: titre, current_user_side: 'seller' },
  messages: [{ entity_type: 'offer_request_message', created_at_ts: Math.floor(Date.now() / 1000) - 600, entity: { user_id: 9000 + oid, current: true, status: 10, status_title: '', price: { amount: String(prix), currency_code: 'EUR' }, transaction_id: 70000 + oid, offer_request_id: 80000 + oid } }],
} } } });

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
      Object.assign(main.vinted_annonce_numeros['51001'], { min: '45' });
      Object.assign(main.vinted_annonce_numeros['51002'], { min: '45,5' });
      Object.assign(main.vinted_annonce_numeros['51003'], { refuse: '30' });
      main.vinted_offres_garde = { v: 1, at: t, items: [], complet: true, manques: [], ambigus: 0 };
      lignes.push(offre(301, 51001, 'Adidas Samba OG noire taille 39', 48), offre(302, 51003, 'Asics Gel-1130 argent taille 41', 20), offre(303, 51004, 'Salomon XT-6 grise taille 42', 40), offre(304, 51002, 'New Balance 550 crème taille 40', 50));
      lignes.push({ id: 'journal_vrm_111_aaaaaaaaaaaaaaaa', data: { e: [{ t: t - 2 * 3600000, s: 'offre_acceptee', a: '51001', x: '62009', p: 47, auto: true }, { t: t - 26 * 3600000, s: 'offre_refusee', a: '51003', x: '62010', p: 18, auto: true }, { t: t - 3600000, s: 'baisse_prix', a: '51001', de: 60, vers: 54 }] } });
      lignes.push({ id: 'journal_vrm_1110_aaaaaaaaaaaaaaaa', data: { e: [{ t: t - 600000, s: 'offre_acceptee', a: '51005', x: '62011', p: 99, auto: true }] } });
      lignes.push({ id: 'actions_compte_111_aaaaaaaaaaaaaaaa', data: { uid: '111', ts: Array.from({ length: 41 }, (_, i) => t - 50 * 60000 + i * 60000), at: new Date(t).toISOString(), max: 50, reserve: 5, v: VERSION } });
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
      const api = [];
      await pg.route('**/api/compte?mode=favoris*', (r) => { const u = new URL(r.request().url()); let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (_) {} api.push({ uid: u.searchParams.get('uid'), action: b.action || 'GET' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, vue: {} }) }); });
      await pg.addInitScript(PONT, { version: VERSION });
      await pg.addInitScript((frein) => { try { localStorage.setItem('vrm_freins_vus', JSON.stringify([frein])); } catch (_) {} }, { vu: t - 2 * 3600000, jusqua: t - 2 * 3600000 + 15 * 60000 });
      try {
        // ── O : l'écran, par Annonces → Outils (le lien) ──
        await pg.goto(`http://localhost:${NV.PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 15000 }).catch(() => {});
        await pg.click('[aria-label="Outils des annonces"]').catch(() => {});
        await pg.waitForSelector('[data-offres-auto-regler]', { timeout: 6000 }).catch(() => {});
        await pg.click('[data-offres-auto-regler]').catch((e) => dit(false, `O ${tag} : le lien « Régler par paire » existe dans Outils`, e.message.split('\n')[0]));
        const ouvert = await pg.waitForSelector('[data-offres-auto-ecran]', { timeout: 15000 }).then(() => true, () => false);
        dit(ouvert, `O ${tag} : Annonces → Outils → « Régler par paire » ouvre Favoris & offres → Offres auto`);
        dit(await pg.getAttribute('[data-offres-auto-ecran] [data-offres-auto-toggle]', 'data-offres-auto-toggle').catch(() => null) === '1', `O ${tag} : l’interrupteur dit « allumé » (le même réglage)`);
        // ── A : l'aperçu ──
        await pg.waitForFunction(() => document.querySelectorAll('[data-oa-offre]').length >= 4, null, { timeout: 15000 }).catch(() => {});
        const dec = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-oa-offre]')].map((e) => [e.getAttribute('data-oa-offre'), e.getAttribute('data-oa-decision') + '|' + e.innerText.replace(/\s+/g, ' ')])));
        dit(/^accepter\|.*Acceptée 3 à 20 min après/.test(dec['111_301'] || ''), `A ${tag} : 48 € sur N°2 (dès 45) ⇒ « Acceptée 3 à 20 min après »`, dec['111_301']);
        dit(/^refuser\|.*Refusée/.test(dec['111_302'] || ''), `A ${tag} : 20 € sur N°4 (refus sous 30) ⇒ « Refusée »`, dec['111_302']);
        dit(/^sans\|.*Aucune règle/.test(dec['111_303'] || ''), `A ${tag} : 40 € sur N°5 sans seuil ⇒ « Aucune règle »`, dec['111_303']);
        dit(/^sans\|.*seuil illisible/.test(dec['111_304'] || ''), `A ${tag} : mini « 45,5 » (ignoré par le moteur) ⇒ « seuil illisible », jamais « Acceptée »`, dec['111_304']);
        dit(await pg.locator('[data-oa-rien-envoye]').count() === 1, `A ${tag} : « Aperçu : rien n’est envoyé d’ici »`);
        await attendre(400); await pg.screenshot({ path: path.join(SHOTS, `offres-auto-${tag}-1-haut.png`) });
        // ── P : jauge, alerte, journée calme ──
        await pg.waitForSelector('[data-offres-auto-ecran] [data-jauge-actions="111"]:not([data-jauge-n="lecture"])', { timeout: 8000 }).catch(() => {});
        const p = await pg.evaluate(() => ({ n: (document.querySelector('[data-offres-auto-ecran] [data-jauge-actions="111"]') || { getAttribute: () => null }).getAttribute('data-jauge-n'), alerte: (document.querySelector('[data-oa-plafond]') || { getAttribute: () => null }).getAttribute('data-oa-plafond'), calme: !!document.querySelector('[data-oa-calme]') }));
        dit(p.n === '41' && p.alerte === 'proche', `P ${tag} : 41/50 ⇒ la jauge et « ralentis tes clics »`, p);
        dit(p.calme, `P ${tag} : un frein de Vinted vu il y a 2 h ⇒ « Journée calme conseillée »`, p);
        // ── H : l'historique ──
        await pg.waitForFunction(() => { const g = document.querySelector('[data-oa-historique]'); return g && !/lecture/.test(g.getAttribute('data-oa-historique')); }, null, { timeout: 8000 }).catch(() => {});
        const h = await pg.evaluate(() => [...document.querySelectorAll('[data-oa-histo]')].map((e) => e.getAttribute('data-oa-histo') + ':' + e.getAttribute('data-oa-histo-auto') + ':' + e.innerText.replace(/\s+/g, ' ')));
        dit(h.length === 2 && /^acceptee:1:Acceptée \(auto\).*47,00/.test(h[0]) && /^refusee:1:/.test(h[1]) && !h.some((x) => /99/.test(x)), `H ${tag} : les 2 offres notées du compte 111, la plus récente d’abord (jamais celle du 1110)`, h);
        // ── S : les seuils ──
        dit(await pg.locator('[data-oa-illisibles="1"]').count() === 1, `S ${tag} : 1 seuil à virgule signalé`);
        await pg.click('[data-oa-corriger]');
        await pg.waitForFunction(() => (document.querySelector('[data-oa-paire="51002"]') || { getAttribute: () => '' }).getAttribute('data-oa-min') === '45.5', null, { timeout: 5000 }).catch(() => {});
        const apres = await pg.evaluate(() => ({ min: (document.querySelector('[data-oa-paire="51002"]') || { getAttribute: () => null }).getAttribute('data-oa-min'), d: (document.querySelector('[data-oa-offre="111_304"]') || { getAttribute: () => null }).getAttribute('data-oa-decision'), ill: document.querySelectorAll('[data-oa-illisibles]').length }));
        dit(apres.min === '45.5' && apres.d === 'accepter' && apres.ill === 0, `S ${tag} : « Corriger » ⇒ N°3 à 45.5, l’offre de 50 € passe « Acceptée »`, apres);
        const champ = pg.locator('[data-oa-paire="51004"] [data-oa-seuil="min"] input');
        await champ.scrollIntoViewIfNeeded().catch(() => {});
        await champ.fill('39,5'); await champ.press('Enter'); await attendre(400);
        const s5 = await pg.evaluate(() => ({ min: (document.querySelector('[data-oa-paire="51004"]') || { getAttribute: () => null }).getAttribute('data-oa-min'), d: (document.querySelector('[data-oa-offre="111_303"]') || { getAttribute: () => null }).getAttribute('data-oa-decision') }));
        dit(s5.min === '39.5' && s5.d === 'accepter', `S ${tag} : « 39,5 » tapé sur N°5 s’écrit 39.5 et l’aperçu suit (40 € ⇒ Acceptée)`, s5);
        await pg.locator('[data-oa-paire="51001"] .vrm-oa-case input').check().catch(() => {});
        await pg.locator('[data-oa-paire="51003"] .vrm-oa-case input').check().catch(() => {});
        dit(await pg.locator('[data-oa-serie-ouvrir="2"]').count() === 1, `S ${tag} : deux paires cochées ⇒ « Régler en série · 2 »`);
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-offres-auto-ecran] button, [data-offres-auto-ecran] input, [data-offres-auto-ecran] label.vrm-oa-case, [data-offres-auto-ecran] textarea')].filter((x) => { if (x.closest('[hidden],details:not([open])') || x.type === 'checkbox') return false; const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 30)));
        dit(!petits.length, `F ${tag} : cibles ≥ 44 px dans l’écran`, petits);
        const deb = await pg.evaluate(() => { const el = document.querySelector('[data-offres-auto-ecran]'); const r = el.getBoundingClientRect(); const trop = [...el.querySelectorAll('*')].filter((x) => { const q = x.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map((x) => x.className || x.tagName).slice(0, 5); return { page: document.documentElement.scrollWidth - innerWidth, trop }; });
        dit(deb.page <= 0 && !deb.trop.length, `F ${tag} : aucun débordement`, deb);
        await pg.locator('[data-oa-paires]').scrollIntoViewIfNeeded().catch(() => {});
        await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `offres-auto-${tag}-2-paires.png`) });
        await pg.click('[data-oa-serie-ouvrir="2"]');
        const feuille = await pg.waitForSelector('[data-prix-mini="2"]', { timeout: 6000 }).then(() => true, () => false);
        dit(feuille, `S ${tag} : « Régler en série » ouvre la feuille Prix mini des 2 paires`);
        await attendre(400); await pg.screenshot({ path: path.join(SHOTS, `offres-auto-${tag}-3-serie.png`) });
        await pg.keyboard.press('Escape').catch(() => {}); await attendre(300);
        if (await pg.$('[data-prix-mini]')) await pg.click('[aria-label="Fermer"]').catch(() => {});
        await attendre(300);
        // ── T : tout arrêter ──
        await pg.locator('[data-oa-tout-arreter]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.click('[data-oa-tout-arreter]');
        await pg.waitForSelector('.vrm-confirmation', { timeout: 5000 }).catch(() => {});
        await pg.locator('.vrm-confirmation button').last().click().catch(() => {});
        await pg.waitForSelector('[data-oa-arret-ok]', { timeout: 8000 }).catch(() => {});
        const fin = await pg.evaluate(() => ({ tog: (document.querySelector('[data-offres-auto-ecran] [data-offres-auto-toggle]') || { getAttribute: () => null }).getAttribute('data-offres-auto-toggle'), ok: (document.querySelector('[data-oa-arret-ok]') || { getAttribute: () => null }).getAttribute('data-oa-arret-ok'), envois: window.__envois }));
        const actions = api.filter((x) => x.action !== 'GET').map((x) => `${x.uid}:${x.action}`).sort();
        dit(fin.tog === '0' && fin.ok === '2', `T ${tag} : « Tout arrêter » ⇒ offres auto éteintes, 2 comptes confirmés`, fin);
        dit(actions.join(',') === '111:arreter,111:auto_stop,222:arreter,222:auto_stop', `T ${tag} : seulement auto_stop + arreter, pour chaque compte`, actions);
        dit(!(fin.envois || []).length, `F ${tag} : rien n’est parti vers l’extension`, fin.envois);
        await attendre(300); await pg.locator('[data-offres-auto-ecran]').scrollIntoViewIfNeeded().catch(() => {});
        await pg.evaluate(() => window.scrollTo(0, 0)); await attendre(200);
        await pg.screenshot({ path: path.join(SHOTS, `offres-auto-${tag}-4-arrete.png`) });
        const errs = journal.erreurs.concat(journal.console.filter((c) => !/Failed to load|ERR_|favicon|net::/.test(c)));
        dit(!errs.length, `F ${tag} : aucune erreur de page`, errs);
      } catch (e) { dit(false, `${tag} : le banc a levé`, e.message.split('\n')[0]); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\nKO  offres auto : ${ko} rouge(s) — captures : ${SHOTS}` : `\nOK  offres auto : l’écran dit ce que le moteur fera, sans rien envoyer — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
