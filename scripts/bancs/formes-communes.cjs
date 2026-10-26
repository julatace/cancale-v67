// Banc : les FORMES COMMUNES de l'app (revue du 16 octobre), sur des données
// INVENTÉES (aucune donnée réelle : ce banc vit dans le dépôt, qui est public).
// Il juge ce qui est RENDU, jamais un libellé exact (§6.5) :
//   1. Colis, téléphone : le geste principal prend sa ligne, les gestes
//      secondaires (« Imprimé ? », « Colis fait », « Relier ») se partagent UNE
//      ligne — jamais un bouton seul sur la sienne ;
//   2. Colis : « colis à envoyer » n'est dit qu'UNE fois (le titre ne répète pas
//      le compteur) ;
//   3. aucun segment ACTIF à fond bleu (§7 : l'accent ne marque pas une
//      sélection) — Colis (imprimante), Stock (vues), Compta (période),
//      Réglages (taille de l'affichage, détourage) — et ce sont tous le même
//      contrôle (`.vrm-seg`) ;
//   4. un repli porte un chevron et pas le triangle du navigateur ;
//   5. un lien-texte ne gonfle pas sa ligne au téléphone (la boîte de 44 px
//      reste, la ligne non) ;
//   6. une rangée qui déborde au doigt porte un fondu sur son bord ;
//   7. sombre : le logo se détache, le filtre actif n'est pas une pastille
//      blanche, un bouton grisé reste lisible ;
//   8. plus de vert de l'ancienne palette (#0F8A6A) dans Réglages.
// Lancer : npm run build && BANC_PORT=57xx node scripts/bancs/formes-communes.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5781;
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111', B = '222';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES_A = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(7002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(7003, 'Salomon XT-6 Advanced gris taille 43', 110, 'Le paiement a été validé', il(2), 'needs_action'),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Colis en cours d\'acheminement', il(3), 'waiting'),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(4), 'completed'),
  vente(7006, 'Nike Dunk Low panda taille 38', 61, 'Commande finalisée', il(8), 'completed'),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), 'completed'),
  vente(7008, 'Converse Chuck 70 noir taille 42', 38, 'Commande finalisée', il(12), 'completed'),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
const VENTES_B = [
  vente(7010, 'Air Jordan 1 Retro High OG Chicago Lost and Found taille 44,5', 149.9, 'Le paiement a été validé', il(0, 8), 'needs_action'),
];
const ATTENDU = { toutes: 9, sommeToutes: 69690, aExpedier: 4, colis: 4, prets: 3, attente: 1 };

const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'julatace35260', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'tomj606', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx, uid, titre) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid, filename: 'bordereau-' + tx + '.pdf', modele: titre, article: titre, receivedAt: cap, pdfB64: PDF_B64 } });
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES_A } } },
  { id: `harvest_${B}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES_B } } },
  bord(7001, A, VENTES_A[0].title), bord(7002, A, VENTES_A[1].title), bord(7010, B, VENTES_B[0].title),
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

// Projection PostgREST (§6.3) : une requête projetée reçoit la projection.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8', '#d0d4dc'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><ellipse cx="200" cy="300" rx="150" ry="22" fill="rgba(0,0,0,.08)"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, tab, sombre = false) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    // Les filtres `data->>X=not.is.null` / `is.null` (comme colis.cjs).
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    // Le thème est un réglage SYNCHRONISÉ : le nuage porte le même choix.
    if (eq && eq[1] === 'main') return j([{ id: 'main', data: { vinted_dark: sombre } }].map(forme));
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// Un fond « bleu d'accent » (clair #2458E6, sombre #3D7BFF) — à 30 près.
const ACCENTS = [[36, 88, 230], [61, 123, 255]];
// `rgb()` / `rgba()`, et `color(srgb r g b / a)` (ce que rend un color-mix).
const lireRgb = (s) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s || '');
  if (m) return { c: [+m[1], +m[2], +m[3]], a: m[4] == null ? 1 : +m[4] };
  const k = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/.exec(s || '');
  return k ? { c: [k[1] * 255, k[2] * 255, k[3] * 255], a: k[4] == null ? 1 : +k[4] } : null;
};
// Luminance PERÇUE sur fond noir : la couleur pondérée par son opacité.
const estAccent = (s) => { const r = lireRgb(s); return !!r && r.a > 0.5 && ACCENTS.some((a) => a.every((v, i) => Math.abs(v - r.c[i]) <= 30)); };
const lum = (s) => { const r = lireRgb(s); if (!r) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r.c[0] * r.a) + 0.7152 * f(r.c[1] * r.a) + 0.0722 * f(r.c[2] * r.a); };

// Les groupes segmentés visés : leur bouton actif, son fond, et la classe du groupe.
const segments = (pg, label) => pg.evaluate((label) => {
  const g = [...document.querySelectorAll('[role="group"]')].find((e) => e.getAttribute('aria-label') === label);
  if (!g) return null;
  const on = g.querySelector('button[aria-pressed="true"]');
  return { classe: g.className, fond: on ? getComputedStyle(on).backgroundColor : null, n: g.querySelectorAll('button').length };
}, label);

const jugerSegment = async (pg, label, ecran) => {
  const s = await segments(pg, label);
  dit(!!s, `${ecran} : le choix « ${label} » est rendu`);
  if (!s) return;
  dit(!estAccent(s.fond), `${ecran} : le segment actif de « ${label} » n'est pas bleu plein (§7)`, s.fond);
  dit(/\bvrm-seg\b/.test(s.classe), `${ecran} : « ${label} » est le contrôle segmenté commun (.vrm-seg)`, s.classe);
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const TEL = { width: 390, height: 844 }, PC = { width: 1512, height: 950 };

    console.log('\n── Colis, 390 px');
    await essaie('Colis 390', async () => {
      const { ctx, pg } = await ouvrir(b, TEL, 'cat_bord');
      await pg.waitForFunction(() => document.querySelectorAll('.vrm-colis-carte').length > 0, null, { timeout: 15000 });
      await pg.waitForTimeout(1500);
      // 1. Les gestes d'une carte : la ligne principale, puis UNE ligne de secondaires.
      const lignes = await pg.evaluate(() => [...document.querySelectorAll('.vrm-colis-carte .vrm-colis-actions')].map((a) => {
        const kids = [...a.children].filter((k) => { const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !k.classList.contains('vrm-colis-source'); });
        const tops = new Map();
        for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top); tops.set(t, (tops.get(t) || 0) + 1); }
        return [...tops.values()];
      }));
      const seuls = lignes.filter((l) => l.length > 1 && l.slice(1).some((n) => n === 1) && l.slice(1).reduce((s, n) => s + n, 0) > 1);
      dit(lignes.length > 0 && seuls.length === 0, 'Colis : aucun geste secondaire seul sur sa ligne', JSON.stringify(lignes));
      // 2. « colis à envoyer » dit une fois.
      const n = await pg.evaluate(() => ((document.querySelector('.vrm-main') || document.body).innerText.match(/colis à envoyer/gi) || []).length);
      dit(n === 1, 'Colis : « colis à envoyer » n’est dit qu’une fois', `${n} fois`);
      // 3. Imprimante.
      await jugerSegment(pg, 'Imprimante', 'Colis');
      // 4. Les replis de Colis : un chevron, pas de triangle natif.
      const replis = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main details > summary')].filter((s) => s.getBoundingClientRect().height > 0).map((s) => ({
        t: s.innerText.trim().slice(0, 30), apres: getComputedStyle(s, '::after').content, liste: getComputedStyle(s).display,
        marque: getComputedStyle(s, '::marker').content,
      })));
      const sansChevron = replis.filter((r) => r.apres === 'none' || r.liste === 'list-item');
      dit(replis.length >= 2 && sansChevron.length === 0, 'Colis : chaque repli porte le chevron commun, sans triangle du navigateur', JSON.stringify(sansChevron));
      await ctx.close();
    });

    console.log('\n── Ventes, 390 px (rangée qui défile)');
    await essaie('Ventes 390', async () => {
      const { ctx, pg } = await ouvrir(b, TEL, 'cat_ventes');
      await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length > 0, null, { timeout: 15000 });
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rangee')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => ({
        deborde: e.scrollWidth > e.clientWidth + 2, masque: getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || 'none',
      })));
      let debord = r.filter((x) => x.deborde);
      const sage = r.filter((x) => !x.deborde);
      // (19 oct.) Les filtres de Ventes tiennent maintenant en entier à 390 px :
      // aucune rangée ne déborde d'elle-même. On en RÉTRÉCIT une pour juger le
      // mécanisme, sinon le contrôle serait vacant (ou rouge sur un écran juste).
      if (!debord.length) {
        debord = await pg.evaluate(async () => {
          const e = [...document.querySelectorAll('.vrm-rangee')].find((x) => x.getBoundingClientRect().height > 0 && x.children.length > 1);
          if (!e) return [];
          e.style.maxWidth = '90px'; e.style.overflowX = 'auto';
          window.dispatchEvent(new Event('resize'));
          await new Promise((ok) => setTimeout(ok, 400));
          return [{ force: true, deborde: e.scrollWidth > e.clientWidth + 2, masque: getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || 'none' }].filter((x) => x.deborde);
        });
      }
      dit(debord.length > 0 && debord.every((x) => x.masque && x.masque !== 'none'), 'Ventes : une rangée qui déborde porte un fondu sur son bord', JSON.stringify({rangees:r,jugees:debord}));
      dit(sage.every((x) => !x.masque || x.masque === 'none'), 'Ventes : une rangée qui tient en entier n’a aucun fondu', JSON.stringify(sage));
      await ctx.close();
    });

    console.log('\n── Ma journée, 390 px (lien-texte)');
    await essaie('Journée 390', async () => {
      const { ctx, pg } = await ouvrir(b, TEL, 'journee');
      await pg.waitForFunction(() => /Dernières ventes/i.test(document.body.innerText), null, { timeout: 15000 });
      await pg.waitForTimeout(1200);
      const m = await pg.evaluate(() => {
        const lab = [...document.querySelectorAll('.vrm-label')].find((e) => /Dernières ventes/i.test(e.textContent));
        const ligne = lab && lab.parentElement; const bt = ligne && ligne.querySelector('button');
        if (!ligne || !bt) return null;
        return { ligne: Math.round(ligne.getBoundingClientRect().height), bouton: Math.round(bt.getBoundingClientRect().height), libelle: Math.round(lab.getBoundingClientRect().height) };
      });
      dit(!!m && m.bouton >= 43.5, 'Ma journée : le lien « tout voir » garde 44 px au doigt', JSON.stringify(m));
      dit(!!m && m.ligne < 32, 'Ma journée : le lien-texte ne gonfle pas sa ligne (moins de 32 px)', JSON.stringify(m));
      await ctx.close();
    });

    console.log('\n── Stock, Compta, Réglages, 1512 px (segments)');
    await essaie('Stock 1512', async () => {
      const { ctx, pg } = await ouvrir(b, PC, 'garage');
      await pg.waitForTimeout(3500);
      await jugerSegment(pg, 'Vue du stock', 'Stock').catch(() => {});
      // Avant le correctif le groupe n'avait pas de nom : on le cherche aussi par son contenu.
      const fondPiece = await pg.evaluate(() => { const bt = [...document.querySelectorAll('.vrm-main button')].find((x) => /^\s*Ma pièce\s*$/.test(x.innerText)); return bt ? getComputedStyle(bt).backgroundColor : null; });
      dit(fondPiece != null && !estAccent(fondPiece), 'Stock : « Ma pièce » sélectionnée n’est pas un segment bleu plein', fondPiece);
      await ctx.close();
    });
    await essaie('Compta 1512', async () => {
      const { ctx, pg } = await ouvrir(b, PC, 'compta');
      await pg.waitForFunction(() => !!document.querySelector('[data-ca-choix]'), null, { timeout: 15000 });
      await jugerSegment(pg, 'Période', 'Compta');
      await ctx.close();
    });
    await essaie('Réglages 1512', async () => {
      const { ctx, pg } = await ouvrir(b, PC, 'settings');
      await pg.waitForTimeout(3000);
      // « Détourage des photos » a quitté Réglages le 17 octobre (5.185, décision
      // de Julien : détourage pour Vestiaire seul, sans réglage) : plus exigé.
      for (const label of ["Taille de l'affichage"]) {
        let s = await segments(pg, label);
        if (!s) { // un sous-écran : on l'ouvre par son titre
          const cle = label === 'Détourage des photos' ? /Détour/i : /Affichage|Apparence|Taille/i;
          await pg.locator('button, [role="button"], a', { hasText: cle }).first().click({ timeout: 3000 }).catch(() => {});
          await pg.waitForTimeout(800);
        }
        await jugerSegment(pg, label, 'Réglages');
      }
      const vert = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main *')].filter((e) => { const s = getComputedStyle(e); return /rgba?\(15, 138, 106/.test(s.color + ' ' + s.backgroundColor); }).map((e) => (e.innerText ?? ('<' + e.tagName.toLowerCase() + '> ' + (e.closest('[aria-label],[title]')?.getAttribute('aria-label') || e.closest('[title]')?.getAttribute('title') || e.parentElement?.textContent || ''))).trim().slice(0, 60)).slice(0, 5));
      dit(vert.length === 0, 'Réglages : plus de vert de l’ancienne palette (#0F8A6A)', JSON.stringify(vert));
      await ctx.close();
    });

    console.log('\n── Sombre, 390 px');
    await essaie('Sombre Colis', async () => {
      const { ctx, pg } = await ouvrir(b, TEL, 'cat_bord', true);
      await pg.waitForFunction(() => document.querySelectorAll('.vrm-colis-carte').length > 0, null, { timeout: 15000 });
      await pg.waitForTimeout(1200);
      const m = await pg.evaluate(() => {
        const logo = document.querySelector('.vrm-header-logo > img, img[alt="VRM"]');
        const tg = document.querySelector('[data-tout-generer="grise"]');
        // (21 oct.) Depuis la refonte « gestion », le logo est posé sur une tuile
        // ardoise (`.vrm-header-logo`, fond opaque) : la tuile le détache aussi.
        const tuile = logo && logo.closest('.vrm-header-logo');
        const fondTuile = tuile ? getComputedStyle(tuile).backgroundColor : '';
        const ombre = logo ? getComputedStyle(logo).boxShadow : null;
        return { theme: document.documentElement.getAttribute('data-theme'), logo: logo ? (ombre !== 'none' ? ombre : (fondTuile && !/rgba\(0, 0, 0, 0\)|transparent/.test(fondTuile) ? 'tuile ' + fondTuile : 'none')) : null,
          tg: tg ? { op: getComputedStyle(tg).opacity, col: getComputedStyle(tg).color, filtre: getComputedStyle(tg).filter } : null };
      });
      dit(m.theme === 'dark', 'le thème sombre est appliqué', m.theme);
      dit(!!m.logo && m.logo !== 'none', 'sombre : le logo noir porte un liseré (ou une tuile) qui le détache', m.logo);
      dit(!!m.tg && Number(m.tg.op) >= 0.9 && (lum(m.tg.col) || 0) > 0.12 && m.tg.filtre === 'none', 'sombre : « Tout générer » grisé reste lisible', JSON.stringify(m.tg));
      await ctx.close();
    });
    await essaie('Sombre Ventes', async () => {
      const { ctx, pg } = await ouvrir(b, TEL, 'cat_ventes', true);
      await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length > 0, null, { timeout: 15000 });
      await pg.waitForTimeout(1200);
      const fond = await pg.evaluate(() => { const bt = [...document.querySelectorAll('.vrm-rangee > button[aria-pressed="true"]')][0]; return bt ? getComputedStyle(bt).backgroundColor : null; });
      dit(fond != null && (lum(fond) ?? 1) < 0.5, 'sombre : le filtre actif n’est pas une pastille blanche', fond);
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc tourne', String(e && e.message || e).slice(0, 200)); }
  finally { try { if (b) await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
