// ════════════════════════════════════════════════════════════════════════════
//  BANC « CE QUE VRM SAIT, SUR VINTED » (11 nov., lot AA, extension 5.339)
//  Une fausse page vinted.fr (fixture INVENTÉE, le dépôt est public), les VRAIS
//  vinted-capture.js, vrm-regles-achat.js et vinted-infos.js de l'extension ; le
//  faux `chrome.runtime` répond par le VRAI background.js exécuté dans un `vm`
//  (`_fond-vm.cjs`) sur une base inventée — aucune réponse fabriquée à la main.
//   A. son dressing, 50 cartes AU MÊME TITRE : chaque carte porte SA ligne
//      « N°… · acheté … · en ligne depuis … », le N° de SA fiche (par
//      identifiant) ; la pastille N° de la carte se tait (le N° une fois) ;
//      aucune ligne sur les annonces d'un autre compte ; pas de prix ⇒
//      « prix d'achat ? », pas de date ⇒ pas de « depuis » ; aucun débordement.
//   B. le dressing d'un AUTRE de ses comptes ⇒ aucune ligne.
//   C. sa propre annonce : la ligne sous le titre, pas d'encart.
//   D. l'annonce d'un autre vendeur : l'encart « VRM » replié ; ouvert, la
//      calculette (prix lu sur la page, revente tapée ⇒ « Tu gagnes au plus
//      60 € ») et « Peut-être N paires proches » ; aucune requête Vinted,
//      aucune écriture ; la page n'entend pas les touches tapées.
//  390 px tactile et 1512 px, clair et sombre ; captures dans BANC_CAPTURES (ou
//  le dossier temporaire).
//  `BANC_EXT=<dossier vinted-sync-extension>` : juge une autre copie (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond } = require('../_fond-vm.cjs');

const EXT = process.env.BANC_EXT ? path.resolve(process.env.BANC_EXT) : path.join(__dirname, '..', '..', 'vinted-sync-extension');
const CAPT = process.env.BANC_CAPTURES || fs.mkdtempSync(path.join(os.tmpdir(), 'banc-infos-vinted-'));
const lire = (f) => { try { return fs.readFileSync(path.join(EXT, f), 'utf8'); } catch (_) { return null; } };
let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail && !bon ? ' — ' + detail : ''}`); };

const UID = '111', AUTRE = '222', PID = '9001', PID2 = '9002', VENDEUR = '5555';
const TITRE = 'Nike Air Max 95 noir taille 42';
const MAINT = Date.now();
const ids = Array.from({ length: 50 }, (_, k) => String(10400000001 + k));
const idsAutre = Array.from({ length: 2 }, (_, k) => String(10500000001 + k));
const SANS_PRIX = ids[7], SANS_DATE = ids[8];
function base() {
  const fiches = {}, buy = {};
  ids.forEach((id, k) => {
    const f = { numero: String(100 + k), accountId: UID };
    if (id !== SANS_PRIX) { if (k % 2) f.buyPrice = String(30 + k); else buy[String(100 + k)] = String(40 + k) + ',5'; }
    fiches[id] = f;
  });
  idsAutre.forEach((id, k) => { fiches[id] = { numero: String(900 + k), accountId: AUTRE, buyPrice: '55' }; });
  const item = (id, x = {}) => Object.assign({ id: Number(id), title: TITRE, brand_title: 'Nike', size_title: '42', is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor((MAINT - (5 + Number(id) % 40) * 864e5) / 1000) }, x);
  return {
    main: { vinted_annonce_numeros: fiches, vinted_buyprice_by_num: buy },
    vinted_listing_dates: {},
    [`harvest_${UID}_profile`]: { payload: { user: { id: Number(PID) } } },
    [`harvest_${AUTRE}_profile`]: { payload: { user: { id: Number(PID2) } } },
    [`harvest_${UID}_listings`]: { capturedAt: new Date(MAINT - 60000).toISOString(), payload: { items: ids.map((id) => (id === SANS_DATE ? item(id, { created_at_ts: null }) : item(id))) } },
    [`harvest_${AUTRE}_listings`]: { capturedAt: new Date(MAINT - 60000).toISOString(), payload: { items: idsAutre.map((id) => item(id)) } },
  };
}
const GIF = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260"><rect width="200" height="260" fill="#c9ccd1"/></svg>');
const tete = (nuit) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;font:14px/1.4 -apple-system,system-ui,sans-serif;background:${nuit ? '#121212' : '#fff'};color:${nuit ? '#eee' : '#111'}}
  header{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #8884}
  .feed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;padding:16px}
  .new-item-box__image-container{position:relative}.new-item-box__image-container img{width:100%;height:auto;display:block;border-radius:4px}
  .new-item-box__overlay{position:absolute;inset:0}.summary{font-size:13px;margin-top:4px}.prix{font-weight:600}
  main.item{max-width:960px;margin:0 auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
  @media (min-width:900px){main.item{grid-template-columns:1fr 360px}}
  .photo img{width:100%;max-width:520px;display:block;border-radius:4px}
</style></head><body><header><b>Vinted</b><a href="/member/${PID}-moi">Mon profil</a></header>`;
const carte = (id, t) => `<div class="feed-grid__item"><div class="new-item-box__container"><div class="new-item-box__image-container"><img src="${GIF}" width="200" height="260"><a class="new-item-box__overlay" href="/items/${id}-${t.toLowerCase().replace(/\W+/g, '-')}"></a></div><div class="summary"><div>${t}</div><div class="prix">45,00 €</div><div>42 · Très bon état</div></div></div></div>`;
const PAGES = {
  dressing: (nuit) => tete(nuit) + `<div class="feed-grid">${ids.concat(idsAutre).map((id) => carte(id, TITRE)).join('')}</div></body></html>`,
  autreDressing: (nuit) => tete(nuit) + `<div class="feed-grid">${idsAutre.concat(ids.slice(0, 2)).map((id) => carte(id, TITRE)).join('')}</div></body></html>`,
  annonce: (nuit, vendeur) => tete(nuit) + `<main class="item"><div class="photo"><img src="${GIF}" width="520" height="676"></div><aside>
    <h1>${vendeur ? 'Nike Air Max 95 blanche 42' : TITRE}</h1><div data-testid="item-price">45,00 €</div>
    <div data-testid="item-attributes-brand" itemprop="brand"><a href="/brand/53-nike"><span itemprop="name">Nike</span></a></div>
    <div data-testid="item-attributes-size"><span itemprop="size">42</span></div>
    <a href="/member/${vendeur ? VENDEUR : PID}-pseudo">${vendeur ? 'vendeur_x' : 'moi'}</a>
    <button>Acheter</button><button>Faire une offre</button><p>Description de l’article.</p></aside></main></body></html>`,
};

async function ouvrir(nav, chemin, html, taille, f) {
  const ctx = await nav.newContext(taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const vinted = [];
  await pg.route('https://www.vinted.fr/**', (r) => { const u = new URL(r.request().url()); if (u.pathname.startsWith('/api/')) vinted.push(u.pathname); return r.fulfill({ status: 200, contentType: 'text/html', body: u.pathname === chemin ? html : '<html><body></body></html>' }); });
  await pg.exposeFunction('__fond', async (m, url) => JSON.parse(JSON.stringify((await f.envoyer(m, { tab: { id: 7, url } })) || null)));
  await pg.addInitScript(() => {
    window.__msgs = []; window.__touches = 0;
    document.addEventListener('keydown', () => { window.__touches++; });
    window.chrome = { runtime: { id: 'x', lastError: null, sendMessage: (m, cb) => { window.__msgs.push(m); window.__fond(m, location.href).then((r) => cb && cb(r)); } } };
  });
  await pg.goto('https://www.vinted.fr' + chemin, { waitUntil: 'domcontentloaded' });
  for (const fic of ['vinted-capture.js', 'vrm-regles-achat.js', 'vinted-infos.js']) { const c = lire(fic); if (c == null) throw new Error(`${fic} absent de l’extension jugée`); await pg.addScriptTag({ content: c }); }
  await pg.waitForTimeout(3600);
  return { ctx, pg, vinted };
}
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false });

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const taille of [1512, 390]) for (const nuit of [false, true]) {
      const tag = `${taille}-${nuit ? 'sombre' : 'clair'}`;
      console.log(`\n── ${taille} px, ${nuit ? 'sombre' : 'clair'}`);
      const f = faireFond({ src: path.join(EXT, 'background.js'), lignes: base(), connecte: UID });
      // A. son dressing
      let o = await ouvrir(nav, `/member/${PID}-moi`, PAGES.dressing(nuit), taille, f);
      const L = await o.pg.evaluate(() => [...document.querySelectorAll('[data-vrm-infos-pour]')].map((e) => ({ id: e.getAttribute('data-vrm-infos-pour'), num: e.getAttribute('data-vrm-infos-num'), achat: e.getAttribute('data-vrm-infos-achat'), jours: e.getAttribute('data-vrm-infos-jours'), texte: e.getAttribute('data-vrm-infos-texte'),
        carte: (e.closest('.feed-grid__item') && (e.closest('.feed-grid__item').querySelector('a[href*="/items/"]').getAttribute('href').match(/\/items\/(\d+)/) || [])[1]) || '', h: e.getBoundingClientRect().height })));
      const parId = Object.fromEntries(L.map((x) => [x.id, x]));
      const justes = ids.filter((id, k) => parId[id] && parId[id].num === String(100 + k) && parId[id].carte === id).length;
      dit(justes === 50 && L.length === 50, 'A · 50 cartes au même titre : chacune porte SA ligne, avec le N° de SA fiche', `${justes}/50 · ${L.length} lignes`);
      dit(idsAutre.every((id) => !parId[id]), 'A · aucune ligne sur une annonce d’un autre compte');
      const k1 = parId[ids[1]] || {}, k0 = parId[ids[0]] || {}, sp = parId[SANS_PRIX] || {}, sd = parId[SANS_DATE] || {};
      dit(k1.achat === '31' && /^N°101 · acheté 31\s€ · en ligne depuis \d+\sj$/.test(k1.texte) && k0.achat === '40.5' && /acheté 40,50\s€/.test(k0.texte), 'A · « N°101 · acheté 31 € · en ligne depuis N j » (prix de la fiche, ou celui du N°)', `${k1.texte} | ${k0.texte}`);
      dit(sp.achat === '' && /prix d’achat \?/.test(sp.texte || '') && !/acheté/.test(sp.texte || ''), 'A · pas de prix d’achat ⇒ « prix d’achat ? », jamais un montant', sp.texte);
      dit(sd.jours === '' && !/depuis/.test(sd.texte || '') && /^N°108/.test(sd.texte || ''), 'A · pas de date ⇒ pas de « depuis » (jamais 0)', sd.texte);
      const pastilles = await o.pg.evaluate(() => [...document.querySelectorAll('.feed-grid__item')].filter((c) => c.querySelector('[data-vrm-infos-pour]')).map((c) => [...c.querySelectorAll('[data-vrm-num-pour]')].filter((p) => getComputedStyle(p).display !== 'none').length).reduce((a, b) => a + b, 0));
      dit(pastilles === 0, 'A · le N° une seule fois : la pastille de la carte se tait', String(pastilles));
      const larg = await o.pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg <= taille, 'A · aucun débordement horizontal', String(larg));
      dit(L.every((x) => x.h > 10 && x.h < 60), 'A · une ligne discrète (une à deux lignes de texte)', JSON.stringify(L.slice(0, 2).map((x) => x.h)));
      await capture(o.pg, `A-dressing-${tag}`);
      await o.ctx.close();
      // B. le dressing d'un autre de ses comptes
      o = await ouvrir(nav, `/member/${PID2}-autre`, PAGES.autreDressing(nuit), taille, f);
      const nB = await o.pg.evaluate(() => document.querySelectorAll('[data-vrm-infos-pour]').length);
      dit(nB === 0, 'B · le dressing d’un autre profil : aucune ligne', String(nB));
      await o.ctx.close();
      // C. sa propre annonce
      o = await ouvrir(nav, `/items/${ids[2]}-air-max`, PAGES.annonce(nuit, false), taille, f);
      const C = await o.pg.evaluate(() => { const e = document.querySelector('h1 + [data-vrm-infos-pour]'); return { t: e && e.getAttribute('data-vrm-infos-texte'), encart: !!document.querySelector('[data-vrm-achat]') }; });
      dit(/^N°102 · acheté 4\d,50\s€ · en ligne depuis \d+\sj$/.test(C.t || '') && !C.encart, 'C · sa propre annonce : la ligne sous le titre, pas d’encart', JSON.stringify(C));
      await capture(o.pg, `C-son-annonce-${tag}`);
      await o.ctx.close();
      // D. l'annonce d'un autre vendeur
      o = await ouvrir(nav, '/items/20000000001-air-max-blanche', PAGES.annonce(nuit, true), taille, f);
      const D0 = await o.pg.evaluate(() => { const e = document.querySelector('[data-vrm-achat]'); return e ? { prix: e.getAttribute('data-vrm-achat-prix-lu'), apres: !!(e.previousElementSibling && e.previousElementSibling.tagName === 'H1'), h: e.getBoundingClientRect().height, lignes: document.querySelectorAll('[data-vrm-infos-pour]').length } : null; });
      dit(!!D0 && D0.apres && D0.h >= 44 && D0.h < 70 && D0.lignes === 0, 'D · l’annonce d’un autre vendeur : l’encart « VRM » replié sous le titre (44 px)', JSON.stringify(D0));
      dit(D0 && D0.prix === '45,00', 'D · le prix de l’annonce lu sur la page', JSON.stringify(D0));
      const hote = await o.pg.$('[data-vrm-achat]');
      await hote.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await o.pg.waitForTimeout(200);
      await capture(o.pg, `D-replie-${tag}`);
      const b = await hote.boundingBox();
      if (taille === 390) await o.pg.touchscreen.tap(b.x + 40, b.y + 22); else await o.pg.mouse.click(b.x + 40, b.y + 22);
      await o.pg.waitForTimeout(600);
      // L'ombre est FERMÉE : on touche le champ « Je la revends » à sa place (colonne de droite).
      const b2 = await hote.boundingBox();
      const cx = b2.x + 14 + (b2.width - 28) * 0.75, cy = b2.y + 44 + 18 + 22;
      if (taille === 390) await o.pg.touchscreen.tap(cx, cy); else await o.pg.mouse.click(cx, cy);
      const r0 = await o.pg.evaluate(() => document.querySelector('[data-vrm-achat]').getAttribute('data-vrm-calc-etat'));
      dit(r0 === 'vide', 'D · ouvert : rien de calculé tant que la revente n’est pas tapée (aucun prix conseillé)', r0);
      await o.pg.keyboard.type('105');
      await o.pg.waitForTimeout(300);
      const D1 = await o.pg.evaluate(() => { const e = document.querySelector('[data-vrm-achat]'); return { etat: e.getAttribute('data-vrm-calc-etat'), ben: e.getAttribute('data-vrm-calc-benefice'), borne: e.getAttribute('data-vrm-calc-borne'), stock: e.getAttribute('data-vrm-stock'), touches: window.__touches }; });
      dit(D1.etat === 'ok' && D1.ben === '6000' && D1.borne === 'au-plus', 'D · « 45 € → 105 € sur Vinted » : tu gagnes au plus 60 € (emballage pas compté) — la règle de l’app', JSON.stringify(D1));
      dit(D1.stock === '52', 'D · « Peut-être 52 paires proches en ligne chez toi » (même marque, même modèle ; ses deux comptes)', JSON.stringify(D1));
      dit(D1.touches === 0, 'D · la page n’entend pas les touches tapées dans l’encart', String(D1.touches));
      dit(o.vinted.length === 0, 'D · aucune requête Vinted', o.vinted.join(','));
      dit(f.j.vinted.length === 0 && f.j.posts.length === 0, 'A–D · le fond n’a rien demandé à Vinted ni rien écrit', `${f.j.vinted.length} · ${f.j.posts.length}`);
      const larg2 = await o.pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg2 <= taille, 'D · aucun débordement horizontal', String(larg2));
      await hote.scrollIntoViewIfNeeded();
      await capture(o.pg, `D-ouvert-${tag}`);
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); }
  console.log(`\n  captures : ${CAPT}`);
  console.log(ko ? `\n❌ infos sur Vinted : ${ko} rouge(s)` : '\n✅ infos sur Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
