// ════════════════════════════════════════════════════════════════════════
//  BANC « PUBLIER AUSSI SUR… » — LE PANNEAU (21 nov., ext. 5.424, `publieraussi`)
//        node scripts/bancs/publier-aussi-panneau.cjs        (BANC_EXT=<arbre d'avant>/vinted-sync-extension : rouge attendu)
//
//  Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page d'annonce vinted.fr (faux `chrome`), SES articles INVENTÉS ;
//  chaque question « Publier aussi » est répondue par le VRAI fond (background.js dans un vm, scripts/bancs/publier-aussi.cjs :
//  fausse base à état, VRAIS onglets Chromium de dépôt Leboncoin / Vestiaire où tourne le vrai vrm-depot-aussi.js). On juge :
//   P1. sur la page d'une de SES annonces : « Cette annonce · Publier aussi sur… » ;
//   P2. la feuille avant / après : « Vinted → Leboncoin » et « Vinted → Vestiaire », champ par champ, ✓ partout, les
//       photos dans l'ordre (les 3 du coffre de CETTE annonce), le prix ; « Publier sur 2 sites » ouvert ;
//   P3. une taille « US 9 » : « à choisir » (liste du site), « Publier » FERMÉ, « Rien ne part… » ; choisie ⇒ ouvert ;
//   P4. rien ne part avant SA confirmation ; « Confirmer la publication » ⇒ la frise, puis « Publiée » et « Voir sur… » ;
//   G.  cibles 44 px, rien ne déborde, aucune erreur de page.
//  Tailles : 390 Orion clair et sombre d'abord, puis 1512 clair et sombre. Captures dans SHOTS (ou scripts/bancs/captures/).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.SHOTS ? path.join(process.env.SHOTS, 'panneau') : path.join(__dirname, 'captures', 'publier-aussi');
const { scenario, IDS, NUMS, TITRE, photo } = require('./publier-aussi.cjs');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 300)}`); return null; } };
const T0 = Date.now(), J = 86400000;
const I = 30;   // LA 31e des 50 annonces au même titre
const ANN = [I, 31, 32].map((i, k) => ({ id: IDS[i], titre: TITRE, prix: 59, photo: photo(i, 1), photos: [photo(i, 1), photo(i, 2), photo(i, 3)], num: NUMS[i], jours: 3 + k, favoris: 2, depuis: T0 - (3 + k) * J, taille: '42', marque: 'Nike', etat: 'Très bon état', vues: 40, statut: 'en_vente', mini: 45 }));
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_banc' }, offres: [],
  annonces: { lu: T0 - 60000, aConfirmer: false, total: ANN.length, liste: ANN, toutes: ANN, nTous: ANN.length, statuts: { en_vente: 3, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
  automatisations: null, notifications: { vu: T0, liste: [] }, ventes: { lu: T0, total: 0, liste: [] }, messages: { lu: T0, liste: [] }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.424.0', code: '5.424.0', vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_banc', choix: 'oui', jauge: { h: 3, maxH: 50, j: 10, maxJ: 200, complet: true }, favoris: { apercu: null, file: null } }, secu: { niveau: 'ok', texte: 'Tout va bien' }, toutArrete: false, flux: { okAt: T0 }, liens: [], capteCoupe: false };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, B, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/vinted\.net\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">vinted.fr</header><main style="padding:20px;height:2000px">Nike Air Max 90 blanche — 59 €</main></body></html>' });
  });
  await pg.exposeFunction('__fond', async (s) => { const m = JSON.parse(s); const r = await B.F.envoyer(m, { id: 'x', tab: { id: 7, url: 'https://www.vinted.fr/items/' + IDS[I] } }); return JSON.stringify(r === undefined ? null : r); });
  await pg.goto('https://www.vinted.fr/items/' + IDS[I] + '-nike-air-max-90-blanche');
  await pg.evaluate(({ e, js, ui, L }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          if (/^publierAussi/.test(String(msg.action || ''))) { window.__fond(JSON.stringify(msg)).then((r) => cb && cb(JSON.parse(r))); return; }
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, L: LISTES });
  await pg.waitForTimeout(300);
  return { ctx, pg, erreurs };
}
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(250); };
const choisir = async (pg, sel, v) => { await pg.evaluate(({ s, v }) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (c) { c.value = v; c.dispatchEvent(new Event('change', { bubbles: true })); } }, { s: sel, v }); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(500);
};
const attendreQue = async (pg, fn, ms = 20000) => { for (const fin = Date.now() + ms; Date.now() < fin;) { const r = await pg.evaluate(fn).catch(() => null); if (r) return r; await pg.waitForTimeout(300); } return null; };
const lire = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const f = q('[data-geste="aussi"]');
  const sites = {};
  for (const s of r.querySelectorAll('[data-aussi-site]')) sites[s.getAttribute('data-aussi-site')] = { etat: s.getAttribute('data-etat'), lignes: Object.fromEntries(Array.from(s.querySelectorAll('[data-aussi-ligne]')).map((l) => [l.getAttribute('data-aussi-ligne'), { etat: l.getAttribute('data-etat'), texte: l.textContent.replace(/\s+/g, ' ').trim() }])),
    photos: Array.from(s.querySelectorAll('.au6-vig img')).map((i) => i.getAttribute('src')), voir: (s.querySelector('[data-aussi-voir]') || {}).href || '', frise: Array.from(s.querySelectorAll('[data-etape]')).map((x) => x.getAttribute('data-etape') + ':' + x.getAttribute('data-etat')) };
  const ctl = f ? Array.from(f.querySelectorAll('button, select, a.vu-btn')).filter(vis) : [];
  return { ici: !!q('[data-aussi-ici]'), f: vis(f), job: f ? f.getAttribute('data-aussi-job') : null, pret: f ? f.getAttribute('data-aussi-pret') : null, sites,
    publier: q('[data-aussi-publier]') ? !q('[data-aussi-publier]').disabled : null, rien: !!q('[data-aussi-rien]'), conf: !!q('[data-aussi-conf]'),
    comptes: Array.from(r.querySelectorAll('[data-aussi-compte]')).map((x) => x.getAttribute('data-aussi-compte') + ':' + x.getAttribute('data-ok')),
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || '').slice(0, 24)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (f && f.scrollWidth > f.clientWidth + 1),
    lances: window.__envoyes.filter((m) => m.action === 'publierAussiLancer').length };
});
const cap = async (pg, nom) => { try { fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
const defiler = async (pg, sel) => { await pg.evaluate((s) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); }, sel); await pg.waitForTimeout(200); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const TAILLES = [{ T: '390 Orion', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light', lancer: true }, { T: '390 Orion sombre', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { T: '1512 clair', largeur: 1512, scheme: 'light', lancer: true }, { T: '1512 sombre', largeur: 1512, scheme: 'dark' }];
  for (const o of TAILLES) {
    const T = o.T, N = (s) => T.replace(/ /g, '-') + '-' + s;
    console.log('\n' + T);
    // ── P1–P2 : la feuille avant / après, tout ✓ ──
    const B = await scenario(nav, {});
    const t = await ouvrir(nav, B, o);
    await essaie(T, async () => {
      await montrer(t.pg, o.mobile);
      let e = await lire(t.pg);
      dit(e.ici, `${T} P1 — sur la page de SON annonce : « Cette annonce · Publier aussi sur… »`);
      await clic(t.pg, '[data-aussi-un]');
      e = await attendreQue(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return r.querySelector('[data-aussi-pret]') ? true : null; }) && await lire(t.pg);
      dit(e && e.f && e.pret === '1' && e.publier === true && !e.rien, `${T} P2 — la feuille s’ouvre, prête : « Publier sur 2 sites » ouvert`, JSON.stringify(e && { pret: e.pret, publier: e.publier, rien: e.rien }));
      const lb = e && e.sites.leboncoin, vc = e && e.sites.vestiaire;
      const tousOk = (s) => s && Object.values(s.lignes).length >= 6 && Object.values(s.lignes).every((l) => l.etat === 'ok');
      dit(tousOk(lb) && tousOk(vc), `${T} P2 — « Vinted → Leboncoin » et « Vinted → Vestiaire » : chaque champ ✓`, JSON.stringify(e && e.sites));
      dit(lb && /Mode › Chaussures/.test(lb.lignes.categorie.texte) && /42/.test(lb.lignes.taille.texte) && /Réf\. VRM-/.test(lb.lignes.description.texte) && vc && /Mode homme › Chaussures › Baskets/.test(vc.lignes.categorie.texte),
        `${T} P2 — avant / après lisible : Hommes > Chaussures > Baskets → Mode › Chaussures (Leboncoin) / Mode homme › Chaussures › Baskets (Vestiaire), 42, la référence`, JSON.stringify(lb && lb.lignes));
      dit(lb && JSON.stringify(lb.photos) === JSON.stringify([photo(I, 1), photo(I, 2), photo(I, 3)]), `${T} P2 — les photos dans l’ordre : celles de CETTE annonce (la 31e de 50 au même titre)`, JSON.stringify(lb && lb.photos));
      dit(e && e.comptes.join(',') === 'leboncoin:1,vestiaire:1', `${T} P2 — le compte de l’onglet de chaque site est dit vérifié`, JSON.stringify(e && e.comptes));
      dit(e && !e.petits.length && !e.debord, `${T} G — cibles ≥ 44 px, rien ne déborde`, JSON.stringify(e && { petits: e.petits, debord: e.debord }));
      await cap(t.pg, N('feuille-haut'));
      await defiler(t.pg, '[data-aussi-site="vestiaire"]'); await cap(t.pg, N('feuille-vestiaire'));
      if (o.lancer) {
        // ── P4 : rien avant SA confirmation, puis la frise et le résultat ──
        await clic(t.pg, '[data-aussi-publier]');
        e = await lire(t.pg);
        dit(e.conf && e.lances === 0, `${T} P4 — « Publier sur 2 sites » : SA confirmation d’abord, rien n’est parti`, JSON.stringify({ conf: e.conf, lances: e.lances }));
        await cap(t.pg, N('confirmation'));
        await clic(t.pg, '[data-aussi-confirmer]');
        await t.pg.waitForTimeout(2500);
        e = await lire(t.pg);
        dit(e.job === 'en-cours' && e.lances === 1, `${T} P4 — confirmé : UN lancement, la frise en cours`, JSON.stringify({ job: e.job, lances: e.lances }));
        await cap(t.pg, N('frise-en-cours'));
        e = await attendreQue(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; const f = r.querySelector('[data-aussi-job="fini"]'); return f ? true : null; }, 240000) && await lire(t.pg);
        dit(e && e.sites.leboncoin && e.sites.leboncoin.etat === 'publiee' && e.sites.vestiaire.etat === 'publiee' && /leboncoin\.fr\/ad\//.test(e.sites.leboncoin.voir) && /vestiairecollective/.test(e.sites.vestiaire.voir) && e.sites.leboncoin.frise.every((x) => /:fait$/.test(x)),
          `${T} P4 — « Publiée » sur les deux sites, « Voir sur Leboncoin » / « Voir sur Vestiaire », frise complète`, JSON.stringify(e && e.sites));
        await cap(t.pg, N('publiee'));
      }
      dit(!t.erreurs.length, `${T} G — aucune erreur de page`, t.erreurs.join(' | '));
    });
    await t.ctx.close(); await B.fermer();
    // ── P3 : taille « US 9 » ⇒ à choisir, rien ne part ; choisie ⇒ ouvert ──
    const B2 = await scenario(nav, { taille: 'US 9' });
    const t2 = await ouvrir(nav, B2, o);
    await essaie(T + ' P3', async () => {
      await montrer(t2.pg, o.mobile);
      await clic(t2.pg, '[data-aussi-un]');
      let e = await attendreQue(t2.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return r.querySelector('[data-aussi-pret]') ? true : null; }) && await lire(t2.pg);
      const lt = e && e.sites.leboncoin && e.sites.leboncoin.lignes.taille;
      dit(e && e.pret === '0' && e.publier === false && e.rien && lt && lt.etat === 'a-choisir' && /US 9/.test(lt.texte), `${T} P3 — « US 9 » : la taille « à choisir », « Publier » FERMÉ, « Rien ne part… »`, JSON.stringify(e && { pret: e.pret, publier: e.publier, lt }));
      await defiler(t2.pg, '[data-aussi-ligne="taille"]'); await cap(t2.pg, N('a-choisir'));
      await choisir(t2.pg, '[data-aussi-ligne="taille"] select', '43');
      e = await attendreQue(t2.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; return r.querySelector('[data-aussi-pret="1"]') ? true : null; }) && await lire(t2.pg);
      dit(e && e.publier === true && /43/.test(e.sites.leboncoin.lignes.taille.texte) && e.lances === 0, `${T} P3 — SA pointure (43) choisie : prête, rien n’est parti tout seul`, JSON.stringify(e && e.sites.leboncoin && e.sites.leboncoin.lignes.taille));
    });
    await t2.ctx.close(); await B2.fermer();
  }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} banc publier-aussi-panneau : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
