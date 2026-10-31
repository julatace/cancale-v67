// Banc : COMPTABILITÉ, STOCK et « COMPLÉTER LES PRIX D'ACHAT » (revue du 16 octobre).
//
// Sur des données INVENTÉES (le banc vit dans le dépôt, aucune fixture), rendu
// à 390 px et à 1512 px, il exige ce que la revue a vu de travers :
//   Comptabilité
//     · plus de filet d'accent en haut du résultat, plus de libellé en
//       capitales espacées (casse normale, comme Réglages) ;
//     · les formulaires d'ajout REPLIÉS derrière « + Ajouter… » (trois
//       formulaires toujours ouverts écrasaient l'écran) — et ils s'ouvrent ;
//     · aucun placeholder coupé ;
//     · le segmenté « Mois / Trimestre / Année » est le contrôle PARTAGÉ
//       (`.vrm-seg-btn`), son choix n'est pas rempli d'accent (§7).
//   Stock
//     · la barre des vues est `.vrm-seg`, son choix n'est pas rempli d'accent ;
//     · une seule pièce : « Ma pièce » n'est pas marquée sélectionnée deux fois ;
//     · une pièce vide DIT quoi faire, et son bouton ouvre « Aménager la pièce ».
//   Prix d'achat
//     · « Compléter les prix d'achat » (Réglages) mène à Vinted → Annonces,
//       plus à l'ancien écran isolé ;
//     · la feuille est CENTRÉE sur ordinateur, en bas sur téléphone ;
//     · une fiche sans titre dont l'annonce en porte un affiche ce titre (par
//       identité d'annonce), jamais « (sans titre) ».
// Lancer : npm run build && BANC_PORT=… node scripts/bancs/compta-stock-ui.cjs
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4953;
const CAPT = process.env.CAPTURES || null;
const ACCENT = 'rgb(36, 88, 230)';   // THEMES.light.accent (#2458E6)

const maintenant = new Date();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const ANNONCES = [
  { id: 9001, title: 'Nike Air Max 90 blanc taille 42', price: { amount: '60', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false },
  { id: 9002, title: 'Adidas Samba noir taille 40', price: { amount: '55', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false },
];
// La fiche 9001 n'a PAS gardé son titre : l'annonce, elle, le porte.
const FICHES = { 9001: { numero: '1', numberedAt: 1 }, 9002: { numero: '2', title: 'Adidas Samba noir taille 40', numberedAt: 2 } };
const LIGNES = [{ id: 'harvest_111_listings', data: { capturedAt: maintenant.toISOString(), payload: { items: ANNONCES } } }];
const PIECE_VIDE = { rooms: [{ id: 'r1', name: 'Ma pièce', room: { w: 6, h: 5, wallH: 3 }, items: [] }], active: 'r1' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, String(e && e.message || e).slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

async function ouvrir(b, largeur, tab, init = {}) {
  const mobile = largeur < 600;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([fiches, init]) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches));
    for (const [k, v] of Object.entries(init)) localStorage.setItem(k, v);
  } catch (_) {} }, [FICHES, init]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=eq\.vrm_room&/.test(u)) return j([{ data: JSON.parse(JSON.stringify(PIECE_VIDE)) }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z_]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString() };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const photo = async (pg, nom) => { if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); } };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const L of [390, 1512]) {
      // ── COMPTABILITÉ ─────────────────────────────────────────────────────
      console.log(`\n── Comptabilité, ${L} px`);
      await essaie('comptabilité', async () => {
        const { ctx, pg, errs } = await ouvrir(b, L, 'compta');
        await ouvrirAvanceCompta(pg); // (29 oct.) résultat, packs et entreprise vivent dans « Avancé », replié
        await pg.waitForSelector('[data-compta-resultat]', { timeout: 20000 });
        await pg.waitForTimeout(800);
        await photo(pg, `compta-${L}`);
        const r = await pg.evaluate((ACCENT) => {
          const page = document.querySelector('.vrm-finance-page');
          const rz = document.querySelector('[data-compta-resultat]'); const res = rz ? rz.parentElement : null;   // la carte du résultat
          const filet = res ? [...res.querySelectorAll('div')].some((d) => { const s = getComputedStyle(d); return d.getBoundingClientRect().height <= 4 && d.getBoundingClientRect().width > 100 && s.backgroundColor === ACCENT; }) : null;
          const majuscules = [...page.querySelectorAll('*')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim() && e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim().slice(0, 30));
          // Placeholder coupé : la largeur du texte dépasse la place du champ.
          const cv = document.createElement('canvas').getContext('2d');
          const coupes = [...page.querySelectorAll('input[placeholder]')].filter((i) => i.getBoundingClientRect().width > 0).filter((i) => { const s = getComputedStyle(i); cv.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; const place = i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); return cv.measureText(i.placeholder).width > place + 1; }).map((i) => i.placeholder);
          const choix = document.querySelector('[data-ca-choix][aria-pressed="true"]');
          return {
            filet, majuscules, coupes,
            formOuvert: !!document.querySelector('[data-abo-libelle]'),
            ouvrir: !!document.querySelector('[data-abo-ouvrir]') && !!document.querySelector('[data-dep-ouvrir]') && !!document.querySelector('[data-pack-ouvrir]'),
            choixSeg: choix ? choix.classList.contains('vrm-seg-btn') : null,
            choixFond: choix ? getComputedStyle(choix).backgroundColor : null,
            deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, ACCENT);
        dit(r.filet === false, 'le résultat n’a plus de filet d’accent en haut', String(r.filet));
        dit(r.majuscules.length === 0, 'aucun libellé en capitales espacées', r.majuscules.slice(0, 4).join(' · '));
        dit(!r.formOuvert && r.ouvrir, 'les trois formulaires sont REPLIÉS derrière « + Ajouter… »', `ouvert ${r.formOuvert} · lignes ${r.ouvrir}`);
        dit(r.choixSeg === true && r.choixFond !== ACCENT, 'la période choisie : contrôle partagé `.vrm-seg-btn`, pas rempli d’accent', `${r.choixSeg} · ${r.choixFond}`);
        dit(r.coupes.length === 0, 'aucun placeholder coupé', r.coupes.join(' · '));
        await pg.click('[data-abo-ouvrir]');
        await pg.waitForSelector('[data-abo-libelle]', { timeout: 3000 }).catch(() => {});
        const apres = await pg.evaluate(() => {
          const page = document.querySelector('.vrm-finance-page');
          const cv = document.createElement('canvas').getContext('2d');
          return { ouvert: !!document.querySelector('[data-abo-libelle]'),
            coupes: [...page.querySelectorAll('input[placeholder]')].filter((i) => i.getBoundingClientRect().width > 0).filter((i) => { const s = getComputedStyle(i); cv.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; return cv.measureText(i.placeholder).width > i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) + 1; }).map((i) => i.placeholder) };
        });
        dit(apres.ouvert, '« + Ajouter un abonnement » ouvre le formulaire');
        dit(apres.coupes.length === 0, 'formulaire ouvert : aucun placeholder coupé', apres.coupes.join(' · '));
        await photo(pg, `compta-${L}-ouvert`);
        dit(r.deb <= 1, 'aucun débordement horizontal', `${r.deb} px`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── STOCK ────────────────────────────────────────────────────────────
      console.log(`\n── Stock (pièce vide), ${L} px`);
      await essaie('stock', async () => {
        const { ctx, pg, errs } = await ouvrir(b, L, 'garage', { vinted_garage_view: '"plan"' });
        await pg.waitForFunction(() => /Aménager la pièce/.test(document.body.innerText), null, { timeout: 25000 });
        await pg.waitForTimeout(800);
        await photo(pg, `stock-${L}`);
        const r = await pg.evaluate((ACCENT) => {
          const vues = document.querySelector('[data-stock-vues]') || null;
          const boutons = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0);
          const choisi = boutons.filter((b) => /Ma pièce/.test(b.textContent) && (getComputedStyle(b).backgroundColor === ACCENT || b.getAttribute('aria-current') === 'page' || b.getAttribute('aria-pressed') === 'true'));
          const fondAccent = boutons.filter((b) => /Ma pièce/.test(b.textContent) && getComputedStyle(b).backgroundColor === ACCENT).length;
          return { seg: !!(vues && vues.classList.contains('vrm-seg')), choisi: choisi.length, fondAccent, vide: !!document.querySelector('[data-piece-vide]'), texteVide: (document.querySelector('[data-piece-vide]') || {}).innerText || '', deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        }, ACCENT);
        dit(r.seg, 'la barre des vues est le contrôle partagé `.vrm-seg`');
        dit(r.fondAccent === 0, 'aucun « Ma pièce » rempli d’accent (§7)', String(r.fondAccent));
        dit(r.choisi === 1, '« Ma pièce » n’est marquée choisie qu’UNE fois (l’onglet)', String(r.choisi));
        dit(r.vide && /vide/i.test(r.texteVide) && /meuble/i.test(r.texteVide), 'une pièce vide DIT quoi faire', r.texteVide.replace(/\s+/g, ' ').slice(0, 90));
        await essaie('le geste de la pièce vide', async () => {
          await pg.click('[data-piece-vide-geste]');
          await pg.waitForTimeout(400);
          const ouvert = await pg.evaluate(() => { const d = document.querySelector('[data-amenager]'); return d ? d.open : null; });
          dit(ouvert === true, '« Ajouter un meuble » ouvre « Aménager la pièce »', String(ouvert));
        });
        dit(r.deb <= 1, 'aucun débordement horizontal', `${r.deb} px`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── PRIX D'ACHAT ─────────────────────────────────────────────────────
      console.log(`\n── Compléter les prix d'achat, ${L} px`);
      await essaie('prix d’achat', async () => {
        const { ctx, pg, errs } = await ouvrir(b, L, 'settings');
        await pg.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => /Compléter les prix d'achat/.test(x.textContent)), null, { timeout: 20000 });
        await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Compléter les prix d'achat/.test(x.textContent)).click());
        const feuille = await pg.waitForSelector('[role="dialog"][aria-label="Prix d\'achat à compléter"], [data-fillbuy]', { timeout: 20000 }).then(() => true).catch(() => false);
        await pg.waitForTimeout(800);
        await photo(pg, `prixachat-${L}`);
        const r = await pg.evaluate(() => {
          const vinted = document.querySelector('[data-section="annonces"][aria-current="page"]');
          const d = [...document.querySelectorAll('[data-fillbuy]')][0];
          let boite = d; while (boite && boite.parentElement && !(getComputedStyle(boite).overflow === 'hidden' && boite.getBoundingClientRect().width >= 300)) boite = boite.parentElement;
          const rc = boite ? boite.getBoundingClientRect() : null;
          const fond = d ? d.closest('[data-noswipe]') : null;
          return { vinted: !!vinted, texte: fond ? fond.innerText : '', haut: rc ? rc.top : null, bas: rc ? rc.bottom : null, H: innerHeight };
        });
        dit(feuille, 'la feuille de saisie s’ouvre');
        dit(r.vinted, 'elle s’ouvre sur Vinted → Annonces (plus l’ancien écran isolé)');
        dit(/Nike Air Max 90 blanc taille 42/.test(r.texte) && !/sans titre/i.test(r.texte), 'une fiche sans titre affiche celui de SON annonce, jamais « (sans titre) »', r.texte.replace(/\s+/g, ' ').slice(0, 140));
        if (L >= 768) dit(r.haut > 16 && r.bas < r.H - 16, 'sur ordinateur la feuille est CENTRÉE (pas collée en bas)', `${Math.round(r.haut)} → ${Math.round(r.bas)} / ${r.H}`);
        else dit(r.bas != null && Math.abs(r.bas - r.H) <= 2, 'sur téléphone c’est une feuille du bas', `${Math.round(r.bas)} / ${r.H}`);
        const petits = await pg.evaluate(() => { const f = document.querySelector('[data-fillbuy]'); const fond = f && f.closest('[data-noswipe]'); if (!fond) return []; const out = []; const w = document.createTreeWalker(fond, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim() || !n.parentElement) continue; const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 11) out.push(fs + 'px « ' + n.nodeValue.trim().slice(0, 20) + ' »'); } return out; });
        dit(petits.length === 0, 'aucun texte sous 11 px dans la feuille', petits.slice(0, 4).join(' · '));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ compta-stock-ui : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ compta-stock-ui : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
