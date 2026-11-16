require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
//  BANC « AIDE À LA DÉCISION » (16 nov., lot aide-decision) — 390 px tactile ET
//  1512 px, clair ET sombre. Données INVENTÉES (le jeu de `nouveau-vendeur.cjs`),
//  un faux pont d'extension 5.402 (compte de l'onglet : 111) qui NOTE toute commande.
//   C. Offres auto : moteur allumé + « Contre-offre au prix mini » allumée ⇒ la ligne
//      de l'option dit « allumée », l'offre de 35 € sur N°2 (refus sous 30, dès 45,
//      annonce à 50 €) est dite « Contre-offre au mini · 45 € » ; rien n'est envoyé ;
//   D. Statistiques → « L'argent qui dort, par meuble » : Annonces a PUBLIÉ la lecture
//      (même base que la valeur du stock) ; Armoire (N°3, N°4 : 55 + 60 €) avant
//      Étagère (N°1 : 45 €, N°2 sans prix NOMMÉ) ; toucher l'Armoire ⇒ ses N° ;
//   R. « Ce qui rapporte le plus » : « reste … par vente » sur chaque ligne ;
//   V. « Vitesse d'envoi » : la moyenne par compte et l'alerte douce (ambre) du
//      compte qui ralentit (20 h → 60 h) ;
//   F. aucun débordement, aucune erreur, aucun rouge sur les nouveaux blocs.
//  §6.1 : sur origin/main, ni l'option ni la carte n'existent ⇒ rouge.
//  Captures : SHOTS — à REGARDER (§6.2).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-aide-decision');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
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

async function sain(pg, tag, sel) {
  const r = await pg.evaluate((sel) => {
    const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
    const rouge = [...document.querySelectorAll(sel)].some((root) => [root, ...root.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); }));
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText, rouge };
  }, sel);
  dit(r.sw <= r.cw + 1, `F ${tag} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `F ${tag} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
  dit(!r.rouge, `F ${tag} : aucun rouge sur les nouveaux blocs (§7)`);
}

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
      main.vinted_offres_contre = true;
      Object.assign(main.vinted_annonce_numeros['51001'], { min: '45', refuse: '30' });
      main.vinted_offres_garde = { v: 1, at: t, items: [], complet: true, manques: [], ambigus: 0 };
      // Les prix d'achat SAISIS (inventés) : N°1 45 €, N°3 55 €, N°4 60 € ; N°2 sans prix.
      Object.assign(main.vinted_annonce_numeros['51000'], { buyPrice: '45' });
      Object.assign(main.vinted_annonce_numeros['51002'], { buyPrice: '55' });
      Object.assign(main.vinted_annonce_numeros['51003'], { buyPrice: '60' });
      main.vrm_meubles = [{ id: 'm1', name: 'Étagère du garage', cols: 4, rows: 3 }, { id: 'm2', name: 'Armoire de la chambre', cols: 3, rows: 2 }];
      main.vrm_slots = { 1: { m: 'm1', i: 0 }, 2: { m: 'm1', i: 1 }, 3: { m: 'm2', i: 0 }, 4: { m: 'm2', i: 1 } };
      lignes.push(offre(311, 51001, 'Adidas Samba OG noire taille 39', 35));
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
      await pg.route('**/api/compte?mode=favoris*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
      await pg.addInitScript(PONT, { version: '5.402.0' });
      try {
        // ── C : Offres auto ──
        await pg.goto(`http://localhost:${NV.PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 15000 }).catch(() => {});
        await pg.click('[aria-label="Outils des annonces"]').catch(() => {});
        await pg.waitForSelector('[data-offres-auto-regler]', { timeout: 6000 }).catch(() => {});
        await pg.click('[data-offres-auto-regler]').catch(() => {});
        await pg.waitForSelector('[data-offres-auto-ecran]', { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction((t0) => { try { return Number(JSON.parse(localStorage.getItem('vinted_offres_garde')).at) > t0; } catch (_) { return false; } }, t, { timeout: 15000 }).catch(() => {});
        await pg.waitForSelector('[data-oa-offre="111_311"]', { timeout: 15000 }).catch(() => {});
        await attendre(600);
        const c = await pg.evaluate(() => {
          const o = document.querySelector('[data-oa-contre]');
          const l = document.querySelector('[data-oa-offre="111_311"]');
          const sw = o && o.querySelector('[data-oa-contre-toggle]'); const r = sw ? sw.getBoundingClientRect() : null;
          return { etat: o && o.getAttribute('data-oa-contre'), ext: o && o.getAttribute('data-oa-contre-ext'), t: o && o.innerText.replace(/\s+/g, ' '), dec: l && l.getAttribute('data-oa-decision'), lt: l && l.innerText.replace(/\s+/g, ' '), h: r && r.height, envois: (window.__envois || []).length };
        });
        dit(c.etat === 'on' && c.ext === 'ok' && /Contre-offre au prix mini/.test(c.t || ''), `C ${tag} : l’option « Contre-offre au prix mini » est là et dit « allumée » (extension 5.402)`, c);
        // L'app REPUBLIE la garde des autres sites (src/offresGarde.js) : complète ⇒ « Contre-offre au mini · 45 € » ;
        // un site pas relu ⇒ « Pas acceptée · un site pas relu » (une contre-offre prise VEND : même garde que l'acceptation).
        const gComplet = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_offres_garde')).complet === true; } catch (_) { return null; } });
        dit(gComplet ? (c.dec === 'contrer' && /Contre-offre au mini · 45/.test(c.lt || '')) : (c.dec === 'garde' && /Pas acceptée · un site pas relu/.test(c.lt || '')), `C ${tag} : 35 € sur N°2 (refus sous 30, dès 45, annonce 50 €) ⇒ ${gComplet ? '« Contre-offre au mini · 45 € »' : 'garde incomplète : « Pas acceptée · un site pas relu »'}`, c);
        dit(c.envois === 0, `C ${tag} : rien n’est envoyé d’ici (aperçu)`, c);
        await pg.evaluate(() => { const x = document.querySelector('[data-oa-contre]'); if (x) x.scrollIntoView({ block: 'center' }); });
        await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `aide-${tag}-1-offres.png`) });
        await sain(pg, `${tag} offres`, '[data-oa-contre], [data-oa-offre]');
        // ── D, R, V : Statistiques ──
        await pg.goto(`http://localhost:${NV.PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        const pub = await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_argent_dort')); } catch (_) { return false; } }, null, { timeout: 25000 }).then(() => true, () => false);
        dit(pub, `D ${tag} : Annonces publie l’argent qui dort (vrm_argent_dort)`);
        const H = 3600000, now = Date.now();
        await pg.evaluate(({ owner, now, H }) => {
          const l = [];
          for (let i = 0; i < 5; i++) { l.push(['a' + i, '111', 'vendeuse_a', now - (40 + i) * 24 * H, now - (40 + i) * 24 * H + 20 * H]); l.push(['b' + i, '111', 'vendeuse_a', now - (5 + i) * 24 * H, now - (5 + i) * 24 * H + 60 * H]); }
          l.push(['c0', '222', 'vendeuse_b', now - 3 * 24 * H, now - 3 * 24 * H + 10 * H]);
          localStorage.setItem('vrm_vitesse_envoi', JSON.stringify({ v: 1, owner, partiel: false, l, at: now }));
        }, { owner: '7a1e0c55-2b1d-4c3e-9f00-0000000000aa', now, H });
        await pg.goto(`http://localhost:${NV.PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-stats-carte="argent-dort"] [data-ad-etat="lu"]', { timeout: 25000 }).catch(() => {});
        const d = await pg.evaluate(() => {
          const c = document.querySelector('[data-stats-carte="argent-dort"]'); if (!c) return null;
          const m = [...c.querySelectorAll('[data-ad-meuble]')].map((x) => [x.getAttribute('data-ad-meuble'), x.getAttribute('data-centimes'), x.getAttribute('data-sans-prix'), x.getAttribute('data-n')]);
          return { etat: (c.querySelector('[data-ad-etat]') || { getAttribute: () => null }).getAttribute('data-ad-etat'), m, t: c.innerText.replace(/\s+/g, ' ') };
        });
        dit(d && d.etat === 'lu' && d.m[0] && d.m[0][0] === 'm2' && d.m[0][1] === '11500' && d.m[1] && d.m[1][0] === 'm1' && d.m[1][1] === '4500' && d.m[1][2] === '1', `D ${tag} : Armoire 115 € (N°3 + N°4) avant Étagère 45 € et « 1 sans prix » nommé`, d);
        const carte = await pg.$('[data-stats-carte="argent-dort"]');
        if (carte) {
          await pg.click('[data-ad-meuble="m2"] .vrm-ad-ligne').catch(() => {});
          await attendre(300);
          const a = await pg.evaluate(() => [...document.querySelectorAll('[data-ad-meuble="m2"] [data-ad-article]')].map((x) => x.getAttribute('data-ad-article')));
          dit(a.length === 2 && a.includes('3') && a.includes('4'), `D ${tag} : toucher l’Armoire ⇒ ses articles (N°3, N°4)`, a);
          const h = await pg.evaluate(() => { const b = document.querySelector('[data-ad-meuble="m2"] .vrm-ad-ligne'); return b ? b.getBoundingClientRect().height : 0; });
          dit(h >= 44, `D ${tag} : une ligne de meuble se touche au doigt (≥ 44 px)`, h);
          await carte.scrollIntoViewIfNeeded().catch(() => {}); await attendre(200);
          await carte.screenshot({ path: path.join(SHOTS, `aide-${tag}-2-argent-dort.png`) }).catch(() => {});
        }
        await pg.waitForSelector('[data-stats-carte="vitesse-envoi"] [data-ve-ralenti]', { timeout: 15000 }).catch(() => {});
        const v = await pg.evaluate(() => { const c = document.querySelector('[data-stats-carte="vitesse-envoi"]'); if (!c) return null; const r = c.querySelector('[data-ve-ralenti]'); return { ralenti: r && r.getAttribute('data-ve-ralenti'), t: r && r.innerText, moy: c.querySelectorAll('[data-ve-moyenne]').length, couleur: r && getComputedStyle(r).color }; });
        dit(v && v.ralenti === '111' && /envoie plus lentement/.test(v.t || '') && v.moy >= 1, `V ${tag} : la moyenne par compte et l’alerte douce du compte qui ralentit (20 h → 60 h)`, v);
        const cv = await pg.$('[data-stats-carte="vitesse-envoi"]');
        if (cv) { await cv.scrollIntoViewIfNeeded().catch(() => {}); await cv.screenshot({ path: path.join(SHOTS, `aide-${tag}-3-vitesse.png`) }).catch(() => {}); }
        const r = await pg.evaluate(() => { const c = document.querySelector('[data-stats-carte="sv-rapporte"]'); return c ? { regle: !!c.querySelector('[data-cr-regle-reste]'), lignes: c.querySelectorAll('[data-cr-reste]').length, repl: c.hasAttribute('data-sv-repliee') } : null; });
        dit(r && (r.repl || (r.regle && r.lignes > 0)), `R ${tag} : « Ce qui rapporte le plus » dit « reste … par vente » (ou se replie sans vente finalisée)`, r);
        const cr = await pg.$('[data-stats-carte="sv-rapporte"]');
        if (cr) { await cr.scrollIntoViewIfNeeded().catch(() => {}); await cr.screenshot({ path: path.join(SHOTS, `aide-${tag}-4-rapporte.png`) }).catch(() => {}); }
        await sain(pg, `${tag} stats`, '[data-stats-carte="argent-dort"], [data-stats-carte="vitesse-envoi"], [data-stats-carte="sv-rapporte"]');
        dit(!journal.erreurs.length, `F ${tag} : aucune erreur de page`, journal.erreurs.join(' | '));
      } catch (e) { dit(false, `${tag} : le banc a pu s’exécuter`, e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n❌ banc aide-decision : ${ko} KO — captures : ${SHOTS}` : `\n✅ banc aide-decision : tout OK — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
