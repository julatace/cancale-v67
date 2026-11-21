// ════════════════════════════════════════════════════════════════════════
//  BANC « VRM A CAPTÉ » — le petit message près du logo (extension 5.377)
//
//  Julien : « l'extension capte des nouvelles choses, on a un petit popup qui
//  dit que l'extension a capté ça ». Le VRAI vrm-badge.js dans une page qui imite
//  vinted.fr (faux `chrome` : il rend le lot que rendrait le service worker — la
//  règle « nouveau par identité » est EXÉCUTÉE sur le vrai background.js par
//  scripts/audit-popup-capte.cjs). 390 px au doigt et 1512 px à la souris, clair
//  et sombre ; captures dans `captures/popup-capte`. Le banc juge (data-*, nombres) :
//   · il apparaît près du logo, dans l'écran, avec le compte et « 2 nouvelles ventes ·
//     1 bordereau · 3 messages » ; « Voir » mène à la page du SITE ;
//   · il ne recouvre AUCUN bouton ni lien du site (une barre de boutons est posée
//     exprès là où il irait d'abord : il prend une autre place) ;
//   · la croix fait 44 px ; un toucher le ferme ; seul, il part après ~6 s ;
//   · montré ⇒ `capteVu` une fois ; le même lot ne revient pas ; réglage coupé ⇒ rien ;
//   · « Compte relié · 14 annonces · 3 ventes lues » à la connexion ;
//   · jamais par-dessus la carte ouverte ; aucune erreur de page.
//  Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'popup-capte') : path.join(__dirname, 'captures', 'popup-capte');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };

const LOT = { lot: 'l1', p: 'vinted', compte: '111', nom: 'shop_sophie', relie: false, n: { ventes: 2, bordereaux: 1, messages: 3 }, at: Date.now(), maj: Date.now(), voir: 'https://www.vinted.fr/my_orders/sold' };
const RELIE = { lot: 'l2', p: 'vinted', compte: '222', nom: 'julien_kicks', relie: true, n: { annonces: 14, ventes: 3 }, at: Date.now(), maj: Date.now(), voir: 'https://www.vinted.fr/my_orders/sold' };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.377.0', code: '5.377.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui' }, flux: { okAt: Date.now() - 60000 }, liens: [{ cle: 'ventes', libelle: 'Mes ventes', url: 'https://www.vinted.fr/my_orders/sold' }], capteCoupe: false };

// La page : un en-tête, des annonces, et une barre d'actions FIXE en bas à droite, juste
// au-dessus du logo (là où le message irait d'abord) — il ne doit pas la recouvrir.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#fff;font-family:sans-serif">
<header style="height:64px;border-bottom:1px solid #ddd;padding:12px 20px;display:flex;gap:12px;align-items:center"><b>Vinted (banc)</b><button style="height:40px">Vendre</button><a href="/inbox">Messages</a></header>
<main style="padding:20px;height:2000px">${Array.from({ length: 12 }, (_, i) => `<p><a href="/items/${i}">Annonce ${i}</a></p>`).join('')}</main>
<div id="barre" style="position:fixed;right:12px;bottom:110px;display:flex;gap:6px;z-index:10"><button style="height:40px;padding:0 14px">Filtrer</button><button style="height:40px;padding:0 14px">Trier</button></div>
</body></html>`;

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, lots = [LOT], coupe = false } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, lots, coupe }) => {
    window.__envoyes = []; window.__ecoutes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    window.__lots = copie(lots); window.__vus = new Set();
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'capteLot') { const l = window.__lots.find((x) => !window.__vus.has(x.lot)); rep = coupe ? { ok: true, coupe: true, lot: null } : { ok: true, coupe: false, lot: l ? copie(l) : null }; }
          else if (msg.action === 'capteVu') { window.__vus.add(msg.lot); }
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } },
        onChanged: { addListener(f) { window.__ecoutes.push(f); } } },
    };
    window.__signaler = () => { for (const f of window.__ecoutes) try { f({ vrmCapteLots: { newValue: {} } }, 'local'); } catch (_) {} };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, lots, coupe });
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const c = q('.capte');
  const vis = !!(c && !c.hidden && c.getClientRects().length && getComputedStyle(c).visibility !== 'hidden');
  const site = Array.from(document.querySelectorAll('button, a[href]')).filter((x) => !h.contains(x)).map(rect).filter((x) => x && x.w > 0);
  const rc = vis ? rect(c) : null;
  const recouvre = rc ? site.filter((s) => s.x < rc.r && s.r > rc.x && s.y < rc.b && s.b > rc.y) : [];
  const x = q('[data-capte-fermer]'), v = q('[data-capte-voir]');
  return { vis, rc, btn: rect(q('.btn')), recouvre, place: c && c.getAttribute('data-capte-place'), fin: c && c.getAttribute('data-capte-fin'),
    titre: q('.capte-t') ? q('.capte-t').innerText.trim() : '', ligne: q('[data-capte-ligne]') ? q('[data-capte-ligne]').innerText.trim() : '',
    croix: x ? rect(x) : null, voir: v ? v.href : '', voirH: v ? Math.round(v.getBoundingClientRect().height) : 0, ventes: c && c.getAttribute('data-capte-ventes'),
    carteOuverte: !!(q('.carte') && q('.carte').classList.contains('on')),
    dbg: rc ? document.elementsFromPoint(rc.r - 12, (rc.y + rc.b) / 2).map((e) => e.tagName + (e.id ? '#' + e.id : '')).join(',') : '',
    vus: window.__envoyes.filter((m) => m.action === 'capteVu').map((m) => m.lot), debord: document.documentElement.scrollWidth > window.innerWidth };
});
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W && c.b <= H;

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${largeur} ${scheme}`;
      console.log(`\n${T}`);
      await essaie(`A ${T}`, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile });
        await t.pg.waitForTimeout(1600);
        const a = await lire(t.pg);
        await cap(t.pg, `popup-${largeur}-${scheme}`);
        dit(a && a.vis && dedans(a.rc, largeur, hauteur), `${T} : le message apparaît près du logo, dans l’écran`, JSON.stringify(a && a.rc));
        dit(a && /^VRM a capté · shop_sophie$/.test(a.titre) && a.ligne === '2 nouvelles ventes · 1 bordereau · 3 messages', `${T} : « VRM a capté · shop_sophie » · « 2 nouvelles ventes · 1 bordereau · 3 messages »`, JSON.stringify({ t: a && a.titre, l: a && a.ligne }));
        dit(a && a.recouvre.length === 0 && a.place !== '0', `${T} : il ne recouvre aucun bouton ni lien du site (la barre posée au-dessus du logo le fait changer de place)`, JSON.stringify({ r: a && a.recouvre, p: a && a.place, d: a && a.dbg, rc: a && a.rc }));
        const dist = a && a.rc && a.btn ? Math.min(Math.abs(a.rc.b - a.btn.y), Math.abs(a.rc.r - a.btn.x), Math.abs(a.rc.y - a.btn.b), Math.abs(a.rc.x - a.btn.r)) : 999;
        dit(dist <= 16, `${T} : collé au logo (≤ 16 px)`, String(dist));
        dit(a && a.voir === 'https://www.vinted.fr/my_orders/sold' && a.voirH >= 44, `${T} : « Voir » mène à Mes ventes sur vinted.fr (cible 44 px)`, JSON.stringify({ v: a && a.voir, h: a && a.voirH }));
        dit(a && a.croix && a.croix.w >= 44 && a.croix.h >= 44, `${T} : la croix fait 44 px`, JSON.stringify(a && a.croix));
        dit(a && a.vus.length === 1 && a.vus[0] === 'l1', `${T} : montré ⇒ noté vu une fois`, JSON.stringify(a && a.vus));
        await t.pg.waitForTimeout(6300);
        const b = await lire(t.pg);
        dit(b && !b.vis && b.fin === 'seul', `${T} : il part seul après ~6 s`, JSON.stringify({ v: b && b.vis, f: b && b.fin }));
        await t.pg.evaluate(() => window.__signaler()); await t.pg.waitForTimeout(500);
        const c = await lire(t.pg);
        dit(c && !c.vis, `${T} : le même lot ne revient pas`, JSON.stringify(c && c.vis));
        dit(t.erreurs.length === 0 && !(c && c.debord), `${T} : aucune erreur de page, rien ne déborde`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
      await essaie(`B ${T}`, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, lots: [RELIE] });
        await t.pg.waitForTimeout(1600);
        const a = await lire(t.pg);
        await cap(t.pg, `relie-${largeur}-${scheme}`);
        dit(a && a.vis && a.titre === 'Compte relié · julien_kicks' && a.ligne === '3 ventes · 14 annonces lues', `${T} : « Compte relié · julien_kicks » · « 3 ventes · 14 annonces lues »`, JSON.stringify({ t: a && a.titre, l: a && a.ligne }));
        // Un toucher le ferme.
        if (mobile) await t.pg.tap('#vrm-badge', { position: { x: a.rc.x - a.btn.x + 20, y: a.rc.y - a.btn.y + 14 } }).catch(() => {});
        else await t.pg.mouse.click(a.rc.x + 20, a.rc.y + 14);
        await t.pg.waitForTimeout(250);
        const b = await lire(t.pg);
        dit(b && !b.vis && b.fin === 'toucher' && !b.carteOuverte, `${T} : un toucher le ferme (sans ouvrir la carte)`, JSON.stringify({ v: b && b.vis, f: b && b.fin, c: b && b.carteOuverte }));
        await t.ctx.close();
      });
    }
    console.log('\nRéglage, carte ouverte');
    await essaie('coupe', async () => {
      const t = await ouvrir(nav, { coupe: true, mobile: true, largeur: 390, hauteur: 844 });
      await t.pg.waitForTimeout(1600);
      const a = await lire(t.pg);
      dit(a && !a.vis && a.vus.length === 0, 'réglage coupé ⇒ rien', JSON.stringify(a));
      await t.ctx.close();
    });
    await essaie('croix', async () => {
      const t = await ouvrir(nav, { mobile: true, largeur: 390, hauteur: 844 });
      await t.pg.waitForTimeout(1600);
      await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-capte-fermer]').click());
      await t.pg.waitForTimeout(200);
      const a = await lire(t.pg);
      dit(a && !a.vis && a.fin === 'fermer', 'la croix ferme', JSON.stringify({ v: a && a.vis, f: a && a.fin }));
      await t.ctx.close();
    });
    await essaie('carte', async () => {
      const t = await ouvrir(nav, { largeur: 1512, hauteur: 900, lots: [] });
      await t.pg.waitForTimeout(400);
      const a0 = await lire(t.pg);
      await t.pg.mouse.click(a0.btn.x + 20, a0.btn.y + 20);
      await t.pg.waitForTimeout(300);
      await t.pg.evaluate((l) => { window.__lots.push(l); window.__signaler(); }, LOT);
      await t.pg.waitForTimeout(600);
      const a = await lire(t.pg);
      dit(a && a.carteOuverte && !a.vis, 'carte ouverte ⇒ le message attend (jamais par-dessus)', JSON.stringify({ c: a && a.carteOuverte, v: a && a.vis }));
      await t.ctx.close();
    });
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ popup-capte : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ popup-capte : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
