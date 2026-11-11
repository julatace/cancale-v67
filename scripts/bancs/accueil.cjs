require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PAGE D'ACCUEIL » — ce que voit quelqu'un qui ne connaît pas VRM.
//
//  (8 nov.) La page refaite pour VENDRE (src/Accueil.jsx) : la promesse, la
//  journée en quatre moments montrée par de VRAIES captures de l'app en mode
//  exemple (scripts/accueil-captures.cjs), le prix et l'essai, les questions.
//  Ce banc juge ce qui est RENDU, jamais la formulation (attributs `data-*`,
//  nombres, couleurs, positions, octets) :
//   • rendu à 390 px (doigt) et 1512 px (souris), CLAIR et SOMBRE : le premier
//     écran dit ce qu'est VRM (h1), le prix des CGV, l'essai, le prérequis ;
//     aucun débordement, aucun texte sous 12 px, contraste 4,5:1 partout,
//     l'accent bleu rare (le fond d'un bouton principal seulement), aucun violet ;
//   • les captures : chaque image affichée est une capture du registre
//     public/accueil/captures.json (empreinte du fichier produit en MODE
//     EXEMPLE — une image posée à la main ne passe pas), en WebP, ≤ 80 Ko,
//     la version sombre en thème sombre ; une légende « Données d'exemple » ;
//     seules les images du premier écran sont chargées avant le défilement ;
//   • LCP raisonnable (< 2,5 s, servi en local) ; le visiteur ne télécharge ni
//     l'app ni le film ; la page ne lit rien en base ;
//   • honnête : prix = CGV = PRIX_MOIS ; essai = CGV = serveur = ESSAI_JOURS ;
//     aucun témoignage, aucun chiffre de clientèle, aucune étoile, rien de non
//     branché (Vestiaire, détourage) ; aucune adresse e-mail en dur ;
//   • les liens : légaux, aide (et ses pages), état du service — tous servis ;
//     « Créer mon compte » / « Se connecter » ouvrent le BON formulaire
//     (`?inscription` / `?connexion`) ; personne d'autre ne voit la page ;
//   • le poids de ce qui se charge avant l'app ; le film (`?film`) inchangé.
//  (11 nov., lot accueil-public) + « pour qui » dans le premier écran ; deux
//  cartes d'offre dont le NOM et la PHRASE sont ceux d'OFFRES
//  (api/_lib/plan-regle.js) et le MONTANT celui des CGV ; le SEO (titre,
//  description, Open Graph avec une image 1200 × 630 faite d'une capture en
//  mode exemple, données structurées SANS avis ni note, prix = réglages) ; la
//  FAQ en questions (h3) / réponses ; le chargement mesuré sur une 4G lente.
//  ⚠️ AUCUNE FIXTURE : une page publique ne lit aucune donnée.
//  PORT=… pour lancer à côté d'un autre banc (défaut 4523). SEUL=rendu,captures…
//  CAPTURES=dossier : une capture par taille et par thème (à REGARDER, §6.2).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');            // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.PORT) || 4523;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip', '.webmanifest': 'application/manifest+json' };
const CAPT = process.env.CAPTURES || '';
const SEUL = (process.env.SEUL || '').split(',').filter(Boolean);
const veut = (bloc) => !SEUL.length || SEUL.includes(bloc);

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
// Un banc ne meurt pas : il rapporte.
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return null; } };
const constante = (src, nom) => { const m = src && new RegExp(`export const ${nom}\\s*=\\s*([^;]+);`).exec(src); return m ? m[1].trim() : undefined; };
const sansCommentaires = (x) => (x || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Les réécritures de vercel.json (`/aide`, `/aide/x`, `/etat`) : un lien de la
// page vaut ce que Vercel sert, pas seulement un fichier au même nom.
const REECRIT = (() => { try { return (JSON.parse(lire('vercel.json')).rewrites || []).filter((r) => !/^\/api\//.test(r.source)); } catch (_) { return []; } })();
const fichierDe = (url) => {
  const p = url.split('?')[0].split('#')[0];
  for (const r of REECRIT) {
    const re = new RegExp('^' + r.source.replace(/\(([^)]+)\)/g, '($1)') + '$');
    const m = re.exec(p); if (m) return r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)]);
  }
  return p;
};
const srv = http.createServer((q, r) => {
  let f = fichierDe(q.url);
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul, ou avec PORT=…`) : e));
  srv.listen(PORT, () => res());
});

const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
const ORDI = { largeur: 1512, hauteur: 900 }, TEL = { largeur: 390, hauteur: 844, mobile: true };

async function page(nav, { largeur = 1512, hauteur = 900, mobile = false, session = false, url = '/', reduit = false, sombre = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const lectures = [];
  await ctx.route(/supabase\.co|\/api\//, (rt) => { lectures.push(rt.request().url()); rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
  if (session) await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await ctx.addInitScript(() => {
    window.__accueilVu = false;
    new MutationObserver(() => { if (document.querySelector('[data-accueil]')) window.__accueilVu = true; })
      .observe(document, { childList: true, subtree: true });
    window.__lcp = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (_) {}
  });
  const pg = await ctx.newPage();
  const scripts = [], images = [];
  pg.on('request', (rq) => { const u = rq.url(); if (/\.js(\?|$)/.test(u)) scripts.push(u.split('/').pop()); if (/\/accueil\/.*\.webp/.test(u)) images.push(u.split('/').pop()); });
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const r = document.getElementById('root'); return r && r.children.length && r.innerText.trim().length > 3; }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return { ctx, pg, scripts, images, erreurs, lectures };
}
const visibleDansEcran = (pg, sel) => pg.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: innerHeight, w: innerWidth, display: cs.display, op: Number(cs.opacity), texte: e.innerText };
}, sel);

// ── Un décodeur PNG minimal (8 bits, RVB/RVBA, non entrelacé) : sans
//    dépendance, pour compter les pixels d'une capture du film. ─────────────
function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), nom = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (nom === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); type = d[9]; }
    else if (nom === 'IDAT') idat.push(d);
    else if (nom === 'IEND') break;
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), ligne = w * bpp, px = Buffer.alloc(h * ligne);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (ligne + 1)], src = raw.slice(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let x = 0; x < ligne; x++) {
      const a = x >= bpp ? px[y * ligne + x - bpp] : 0, b = y ? px[(y - 1) * ligne + x] : 0, c = x >= bpp && y ? px[(y - 1) * ligne + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * ligne + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}

// Les contrôles de rendu, à chaque taille et dans chaque thème.
async function controlesRendu(nav, nom, opt, S) {
  const { ctx, pg, scripts, images, erreurs, lectures } = await page(nav, opt);
  const H = opt.hauteur;
  try {
    dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), `${nom} : la page d'accueil s'affiche`);
    const texte = await pg.evaluate(() => document.body.innerText);
    dit(!/n'a pas pu s'afficher|Cannot access|is not defined/.test(texte), `${nom} : aucun écran tombé`);
    // Le premier écran : ce qu'est VRM (h1), le prix, l'essai, le prérequis.
    const h1 = await pg.evaluate(() => { const l = document.querySelectorAll('[data-accueil] h1'); if (l.length !== 1) return { n: l.length }; const r = l[0].getBoundingClientRect(); return { n: 1, top: r.top, bottom: r.bottom, t: l[0].innerText }; });
    dit(h1.n === 1 && h1.bottom <= H && /ventes/i.test(h1.t) && /colis/i.test(h1.t) && /compta/i.test(h1.t), `${nom} : un seul h1, dans le premier écran, la promesse (ventes, colis, compta)`, JSON.stringify(h1));
    const prix = await pg.evaluate((p) => {
      const re = new RegExp(`${p.replace(',', '\\,')}\\s*€\\s*par mois`);
      const tous = [...document.querySelectorAll('[data-section="hero"] *')].filter((e) => re.test(e.innerText || ''));
      const el = tous.find((e) => ![...e.children].some((c) => re.test(c.innerText || '')));
      if (!el) return null; const r = el.getBoundingClientRect(); return { bottom: r.bottom, texte: el.closest('[data-prix-ligne]') ? el.closest('[data-prix-ligne]').innerText : el.innerText };
    }, S.prixCgv || '?');
    dit(!!prix && prix.bottom <= H, `${nom} : le prix des CGV (${S.prixCgv} € par mois) est dans le premier écran`, prix ? `bas à ${Math.round(prix.bottom)} px` : 'absent du haut de page');
    dit(!!prix && new RegExp(`${S.essaiCgv}\\s*jours d.essai gratuit`).test(prix.texte), `${nom} : l'essai (${S.essaiCgv} jours, celui des CGV) est dit à côté du prix`, prix && prix.texte);
    const pour = await visibleDansEcran(pg, '[data-pour-qui]');
    dit(pour && pour.bottom <= H && pour.op > 0.5 && /Vinted/.test(pour.texte) && /revendeur/i.test(pour.texte), `${nom} : « pour qui » (les revendeurs Vinted…) est dans le premier écran`, pour ? `${pour.texte} · bas à ${Math.round(pour.bottom)} px` : 'absent');
    const pre = await visibleDansEcran(pg, '[data-prerequis]');
    dit(pre && pre.bottom <= H && /ordinateur/i.test(pre.texte), `${nom} : le prérequis (un ordinateur) est dans le premier écran`, pre ? `bas à ${Math.round(pre.bottom)} px` : 'absent');
    const variante = await pg.evaluate(() => { const e = document.querySelector('[data-prerequis]'); return e && e.getAttribute('data-variante'); });
    dit(variante === (opt.mobile ? 'tactile' : 'souris'), `${nom} : le prérequis parle à ${opt.mobile ? 'un téléphone' : 'un ordinateur'}`, `variante ${variante}`);
    const cta = await visibleDansEcran(pg, '[data-section="hero"] [data-cta="inscription"]');
    dit(cta && cta.bottom <= H && cta.top >= 0, `${nom} : « Créer mon compte » est dans le premier écran`, cta ? `${Math.round(cta.top)}–${Math.round(cta.bottom)}` : 'absent');
    const offert = S.reglages.ACCES_OFFERT;
    const off = await pg.evaluate(() => ({ a: document.querySelectorAll('[data-acces-offert]').length, carte: document.querySelectorAll('[data-sans-carte]').length }));
    if (offert === 'true') dit(off.a > 0 && off.carte > 0, `${nom} : ACCES_OFFERT = true → « Gratuit pour l'instant » et « Aucune carte bancaire »`, JSON.stringify(off));
    else dit(off.a === 0 && off.carte === 0, `${nom} : ACCES_OFFERT ≠ true → ni « gratuit », ni « aucune carte »`, JSON.stringify(off));

    // Les images du premier écran seulement, avant tout défilement.
    await pg.waitForTimeout(600);
    const avant = [...new Set(images)];
    const attenduesHaut = opt.mobile ? ['journee'] : ['journee', 'bureau'];
    dit(avant.length <= attenduesHaut.length && avant.every((f) => attenduesHaut.some((a) => f.startsWith(a + '-'))), `${nom} : avant de défiler, seules les captures du premier écran se chargent (${attenduesHaut.join(', ')})`, avant.join(', '));
    const theme = opt.sombre ? 'sombre' : 'clair';
    dit(avant.length > 0 && avant.every((f) => f.endsWith(`-${theme}.webp`)), `${nom} : le thème ${theme} charge les captures ${theme}s`, avant.join(', '));
    const lcp = await pg.evaluate(() => window.__lcp);
    dit(lcp > 0 && lcp < 2500, `${nom} : LCP raisonnable (< 2,5 s, servi en local)`, `${Math.round(lcp)} ms`);

    // On fait défiler toute la page (les images paresseuses arrivent).
    const Ht = await pg.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Ht; y += Math.round(H * 0.6)) { await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(90); }
    await pg.waitForTimeout(500);
    const caps = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] picture[data-capture] img')].filter((i) => i.getBoundingClientRect().width > 0)
      .map((i) => ({ src: (i.currentSrc || i.src).split('/').pop(), ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt'), w: i.getBoundingClientRect().width, nw: i.naturalWidth, lazy: i.getAttribute('loading') })));
    dit(caps.length >= 4 && caps.every((c) => c.ok), `${nom} : les ${caps.length} captures affichées sont chargées`, caps.filter((c) => !c.ok).map((c) => c.src).join(', '));
    dit(caps.every((c) => c.src.endsWith(`-${theme}.webp`)), `${nom} : toutes en version ${theme}`, caps.map((c) => c.src).join(', '));
    dit(caps.every((c) => c.nw >= c.w * 1.5), `${nom} : chaque capture est servie à plus de 1,5× sa taille affichée (nette sur Retina)`, caps.map((c) => `${c.src} ${c.nw}/${Math.round(c.w)}`).join(', '));
    const pasReg = caps.filter((c) => !S.registre[c.src]);
    dit(pasReg.length === 0, `${nom} : chaque capture affichée est au registre des captures en mode exemple`, pasReg.map((c) => c.src).join(', '));
    const legende = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] picture[data-capture]')].filter((p) => p.getBoundingClientRect().width > 0)
      .every((p) => { const f = p.closest('figure,article'); const img = p.querySelector('img'); return /exemple/i.test((f && f.innerText) || '') || /exemple/i.test(img.getAttribute('alt') || '') || (img.getAttribute('alt') === '' && p.closest('[aria-hidden="true"]')); }));
    dit(legende, `${nom} : chaque capture dit « Données d'exemple » (légende ou texte alternatif)`);
    if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}-${theme}.png`), fullPage: true }); }

    // Contraste : tout texte visible tient 4,5:1 sur son fond réel.
    const contraste = await pg.evaluate(() => {
      const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const BG = rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
      const fond = (e) => { const pile = []; for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = BG; for (let i = pile.length - 1; i >= 0; i--) f = sur(pile[i], f); return f; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const pires = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (![...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (getComputedStyle(e).visibility === 'hidden') return;
        let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
        if (o <= 0.1) return;
        const c = rgb(getComputedStyle(e).color); if (!c) return;
        const v = ratio(sur(c, fond(e)), fond(e));
        if (v < 4.5) pires.push(`${e.tagName}.${String(e.className).split(' ')[0]} « ${e.textContent.trim().slice(0, 24)} » ${v.toFixed(2)}:1`);
      });
      return pires;
    });
    dit(contraste.length === 0, `${nom} : tout texte visible tient 4,5:1 sur son fond réel`, contraste.slice(0, 4).join(' · '));
    const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    dit(deb <= 1, `${nom} : aucun débordement horizontal`, `${deb} px de trop`);
    const petits = await pg.evaluate(() => {
      const x = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (parseFloat(getComputedStyle(e).fontSize) < 11.99) x.push(`${e.tagName} ${getComputedStyle(e).fontSize} « ${e.textContent.trim().slice(0, 20)} »`);
      });
      return x;
    });
    dit(petits.length === 0, `${nom} : aucun texte sous 12 px`, petits.slice(0, 4).join(' · '));
    // Cibles au doigt : chaque lien et bouton fait 44 px de haut au moins.
    if (opt.mobile) {
      const minus = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] a, [data-accueil] button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('p') && r.height < 43.5; }).map((e) => `« ${e.innerText.trim().slice(0, 20)} » ${Math.round(e.getBoundingClientRect().height)} px`));
      dit(minus.length === 0, `${nom} : chaque lien et bouton isolé fait 44 px au doigt`, minus.slice(0, 5).join(' · '));
    }
    // La couleur : l'accent rare (fond du bouton principal), aucun violet.
    const couleurs = await pg.evaluate(() => {
      const BLEUS = ['rgb(0, 113, 227)', 'rgb(0, 119, 237)', 'rgb(10, 132, 255)'];
      const violet = (s) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(s || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40) return false; let h; if (mx === r) h = ((g - b) / (mx - mn)) * 60; else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60; else h = (4 + (r - g) / (mx - mn)) * 60; h = (h + 360) % 360; return h >= 255 && h <= 320; };
      const fonds = [], violets = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('picture')) return;
        const cs = getComputedStyle(e);
        if (BLEUS.includes(cs.backgroundColor) && !e.classList.contains('av-btn')) fonds.push(e.tagName + '.' + String(e.className).split(' ')[0]);
        if (violet(cs.color) || violet(cs.backgroundColor)) violets.push(e.tagName + '.' + String(e.className).split(' ')[0]);
      });
      const enHaut = [...document.querySelectorAll('[data-accueil] .av-btn')].filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && Number(getComputedStyle(b).opacity) > 0.5; }).length;
      return { fonds, violets, enHaut };
    });
    dit(couleurs.fonds.length === 0, `${nom} : le bleu d'Apple ne sert de fond qu'au bouton principal`, couleurs.fonds.slice(0, 4).join(', '));
    dit(couleurs.violets.length === 0, `${nom} : aucun violet (refusé)`, couleurs.violets.slice(0, 4).join(', '));
    dit(!scripts.some((s) => /^App-/.test(s)), `${nom} : le visiteur ne télécharge PAS l'application`, scripts.join(', '));
    dit(!scripts.some((s) => /^AccueilFilm-/.test(s)), `${nom} : le visiteur ne télécharge PAS le film`, scripts.filter((s) => /Film/.test(s)).join(', '));
    dit(lectures.length === 0, `${nom} : la page publique ne lit rien en base`, lectures.slice(0, 3).join(' · '));
    dit(erreurs.length === 0, `${nom} : aucune erreur de page`, erreurs.join(' | '));
    // Un seul bouton principal à la fois ; « Se connecter » reste joignable.
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400);
    const navCta = () => pg.evaluate(() => { const b = document.querySelector('.av-nav [data-cta-nav="inscription"]'); return b ? { op: Number(getComputedStyle(b).opacity), tab: b.tabIndex, d: getComputedStyle(b).display } : null; });
    const haut = await navCta();
    dit(haut && (haut.op === 0 || haut.d === 'none') && haut.tab === -1, `${nom} : en haut de page, « Créer mon compte » n'est PAS doublé dans la barre`, JSON.stringify(haut));
    if (!opt.mobile) {
      await pg.evaluate(() => window.scrollTo(0, 1600));
      await pg.waitForFunction(() => { const b = document.querySelector('.av-nav [data-cta-nav="inscription"]'); return b && getComputedStyle(b).opacity === '1'; }, null, { timeout: 2000 }).catch(() => {});
      const bas = await navCta();
      dit(bas && bas.op === 1 && bas.tab === 0, `${nom} : le bouton du haut sorti, la barre le propose (atteignable au clavier)`, JSON.stringify(bas));
    }
    await pg.evaluate(() => window.scrollTo(0, 3000)); await pg.waitForTimeout(400);
    const sc = await visibleDansEcran(pg, '.av-nav [data-cta-nav="connexion"]');
    dit(sc && sc.display !== 'none' && sc.top >= 0 && sc.bottom <= sc.h && sc.right <= sc.w, `${nom} : « Se connecter » reste dans la barre en défilant`, sc ? `${Math.round(sc.left)},${Math.round(sc.top)}` : 'absent');
    // Les liens : légaux, aide, état du service — tous servis.
    const liens = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-accueil] a[href^="/"]')].map((a) => a.getAttribute('href')).filter((h) => !/^\/(\?|$)/.test(h) && !/^\/#/.test(h)))]);
    const manquants = liens.filter((h) => { const f = fichierDe(h); return !fs.existsSync(path.join(DIST, f)) || !fs.statSync(path.join(DIST, f)).isFile(); });
    const veutLiens = ['/legal/cgv.html', '/legal/confidentialite.html', '/aide', '/statut'];
    dit(veutLiens.every((h) => liens.includes(h)) && manquants.length === 0, `${nom} : CGV, confidentialité, aide et état du service sont là, et les ${liens.length} liens mènent à une vraie page`, `manquants : ${manquants.join(', ') || '—'} · absents : ${veutLiens.filter((h) => !liens.includes(h)).join(', ') || '—'}`);
    let cst = ''; try { cst = ((/CONTACT_EMAIL\s*=\s*'([^']*)'/.exec(lire('src/contact.js') || '') || [])[1] || '').trim(); } catch (_) { cst = ''; }
    const contact = await pg.evaluate(() => { const e = document.querySelector('[data-accueil] [data-contact]'); return e ? { texte: e.innerText, absent: e.hasAttribute('data-contact-absent'), href: e.getAttribute('href') || '' } : null; });
    dit(!!contact && (cst ? contact.href === `mailto:${cst}` : contact.absent && /à venir/.test(contact.texte) && !contact.href), `${nom} : une ligne Contact (src/contact.js)`, contact ? `${contact.texte} ${contact.href}` : 'absente');
  } finally { await ctx.close(); }
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance npm run build'); process.exit(1); }
  // Les sources de vérité : les réglages, les CGV, le serveur, le registre des captures.
  const srcReglages = lire('src/accueil-reglages.js') || '';
  const reglages = { ACCES_OFFERT: constante(srcReglages, 'ACCES_OFFERT'), DETOURAGE_POUR_TOUS: constante(srcReglages, 'DETOURAGE_POUR_TOUS'), PRIX_MOIS: (constante(srcReglages, 'PRIX_MOIS') || '').replace(/['"]/g, ''), PRIX_PRO_MOIS: (constante(srcReglages, 'PRIX_PRO_MOIS') || '').replace(/['"]/g, ''), ESSAI_JOURS: (constante(srcReglages, 'ESSAI_JOURS') || '').replace(/['"]/g, '') };
  const cgv = lire('public/legal/cgv.html') || '';
  const prixCgv = (/abonnement à (\d+,\d{2})\s€ par mois/i.exec(cgv) || [])[1] || null;
  const prixProCgv = (/Offre Pro : (\d+,\d{2}) € par mois/.exec(cgv) || [])[1] || null;
  let OFFRES = null; try { OFFRES = (await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'))).OFFRES; } catch (_) { OFFRES = null; }
  const essaiCgv = (/essai gratuit de (\d+) jours/i.exec(cgv) || [])[1] || null;
  const essaiStripe = (/trial_period_days:\s*(\d+)/.exec(lire('api/compte.js') || '') || [])[1] || null;
  const essaiRelances = (/DUREE_ESSAI_JOURS\s*=\s*(\d+)/.exec(lire('api/_lib/relances-essai.js') || '') || [])[1] || null;
  let registre = {}; try { registre = JSON.parse(lire('public/accueil/captures.json')); } catch (_) { registre = {}; }
  const S = { reglages, prixCgv, prixProCgv, essaiCgv, registre };
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-compositing'] });
  try {
    if (veut('rendu')) {
      for (const [nom, opt] of [['390 · clair', TEL], ['390 · sombre', { ...TEL, sombre: true }], ['1512 · clair', ORDI], ['1512 · sombre', { ...ORDI, sombre: true }]]) {
        console.log(`\n── UN VISITEUR SANS SESSION — ${nom}`);
        await essaie(nom, () => controlesRendu(nav, nom, opt, S));
      }
    }

    if (veut('captures')) {
      console.log('\n── LES CAPTURES : LA VRAIE APP, EN MODE EXEMPLE, LÉGÈRES');
      await essaie('captures', async () => {
        const src = sansCommentaires(lire('src/Accueil.jsx'));
        const noms = [...new Set([...src.matchAll(/(?:nom|capture):\s*'([a-z]+)'|nom="([a-z]+)"/g)].map((m) => m[1] || m[2]))];
        dit(noms.length >= 6, `la page montre ${noms.length} écrans de l'app (${noms.join(', ')})`);
        const fichiers = noms.flatMap((n) => ['clair', 'sombre'].map((t) => `${n}-${t}.webp`));
        const absents = fichiers.filter((f) => !fs.existsSync(path.join(RACINE, 'public', 'accueil', f)));
        dit(absents.length === 0, 'chaque écran existe en clair ET en sombre (public/accueil/)', absents.join(', '));
        const presents = fichiers.filter((f) => !absents.includes(f));
        const empreinte = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE, 'public', 'accueil', f))).digest('hex');
        const faux = presents.filter((f) => !registre[f] || registre[f].modeExemple !== true || registre[f].sha256 !== empreinte(f));
        dit(Object.keys(registre).length > 0 && faux.length === 0, 'chaque fichier est celui que scripts/accueil-captures.cjs a produit EN MODE EXEMPLE (empreinte au registre)', faux.join(', ') || (Object.keys(registre).length ? '' : 'registre public/accueil/captures.json absent'));
        const webp = presents.filter((f) => fs.readFileSync(path.join(RACINE, 'public', 'accueil', f)).slice(8, 12).toString('ascii') === 'WEBP');
        dit(webp.length === presents.length, 'chaque capture est un vrai WebP (en-tête RIFF/WEBP)', presents.filter((f) => !webp.includes(f)).join(', '));
        const lourds = presents.map((f) => [f, fs.statSync(path.join(RACINE, 'public', 'accueil', f)).size]).filter(([, s]) => s > 80 * 1024);
        dit(lourds.length === 0, 'chaque capture pèse ≤ 80 Ko', lourds.map(([f, s]) => `${f} ${Math.round(s / 1024)} Ko`).join(', '));
        const sc = sansCommentaires(lire('scripts/accueil-captures.cjs'));
        dit(/vrm_mode_exemple/.test(sc) && /mode exemple n'est pas actif/.test(sc) && /route\(\/\^https\?:/.test(sc), 'le script de capture n\'ouvre l\'app qu\'en mode exemple, refuse sinon, et coupe tout le réseau extérieur');
        // Le registre ne garde pas de capture que la page n'affiche plus.
        const orphelins = Object.keys(registre).filter((f) => !fichiers.includes(f));
        dit(orphelins.length === 0, 'le registre ne garde pas de capture que la page n’affiche plus', orphelins.join(', '));
      });
    }

    if (veut('honnetete')) {
      console.log('\n── HONNÊTETÉ : PRIX ET ESSAI = CGV = SERVEUR, AUCUNE PREUVE INVENTÉE');
      await essaie('honnêteté', async () => {
        const { ctx, pg } = await page(nav, ORDI);
        const t = await pg.evaluate(() => document.querySelector('[data-accueil]').innerText);
        const montants = [...t.matchAll(/(\d+,\d{2})\s*€\s*(?:\/\s*mois|par mois)/gi)].map((m) => m[1]);
        const montantsCarte = await pg.evaluate(() => [...document.querySelectorAll('[data-prix]')].map((e) => e.innerText.replace(/\s+/g, ' ')));
        dit(!!prixCgv && !!prixProCgv && montants.length >= 2 && montants.every((m) => m === prixCgv || m === prixProCgv), `chaque prix affiché est un prix des CGV (Solo ${prixCgv} €, Pro ${prixProCgv} €), aucun autre`, `CGV ${prixCgv}/${prixProCgv} · page ${montants.join(', ')}`);
        // Les cartes d'offre : le nom et la phrase d'OFFRES, le montant des CGV.
        const cartes = await pg.evaluate(() => [...document.querySelectorAll('[data-offre]')].map((c) => ({ cle: c.getAttribute('data-offre'), nom: (c.querySelector('h3') || {}).innerText || '', montant: ((c.querySelector('.av-montant b') || {}).innerText || '').replace(/\s+/g, ' '), phrase: (c.querySelector('[data-offre-phrase]') || {}).innerText || '' })));
        const attendu = { solo: prixCgv, pro: prixProCgv };
        const fautes = !OFFRES ? ['OFFRES illisible'] : cartes.filter((c) => !OFFRES[c.cle] || c.nom.trim() !== OFFRES[c.cle].nom || !c.phrase.startsWith(OFFRES[c.cle].phrase) || !c.montant.startsWith(attendu[c.cle] || '?')).map((c) => JSON.stringify(c));
        dit(cartes.length === 2 && cartes.map((c) => c.cle).join() === 'solo,pro' && fautes.length === 0, 'deux cartes, Solo puis Pro : nom et phrase = OFFRES (source unique), montant = CGV', fautes.join(' · ') || cartes.map((c) => `${c.nom} ${c.montant}`).join(' | '));
        dit(reglages.PRIX_PRO_MOIS === prixProCgv, 'PRIX_PRO_MOIS (src/accueil-reglages.js) = CGV (offre Pro)', `${reglages.PRIX_PRO_MOIS} / ${prixProCgv}`);
        dit(reglages.PRIX_MOIS === prixCgv, 'PRIX_MOIS (src/accueil-reglages.js) = CGV', `${reglages.PRIX_MOIS} / ${prixCgv}`);
        dit(!!essaiCgv && reglages.ESSAI_JOURS === essaiCgv && essaiStripe === essaiCgv && essaiRelances === essaiCgv, `l'essai : ESSAI_JOURS = CGV = Stripe (trial_period_days) = relances (DUREE_ESSAI_JOURS)`, `page ${reglages.ESSAI_JOURS} · CGV ${essaiCgv} · Stripe ${essaiStripe} · relances ${essaiRelances}`);
        const essais = [...t.matchAll(/(\d+)\s*jours d.essai/g)].map((m) => m[1]);
        dit(essais.length >= 2 && essais.every((d) => d === essaiCgv), 'chaque « N jours d’essai » rendu dit la durée des CGV', essais.join(', '));
        dit(/sans engagement/i.test(t) && /résili/i.test(t), 'elle dit « sans engagement » et comment résilier (comme les CGV)');
        const invente = t.match(/\d[\d\s.,]*\s*(\+|k|K)?\s*(vendeurs|revendeurs|utilisateurs|clients|avis|étoiles|\/\s*5|%\s*de\s*(ventes|chiffre|temps))/i);
        dit(!invente, 'aucun chiffre de clientèle ni de résultat inventé', invente ? invente[0] : '');
        dit(!/(★|⭐)/.test(t), 'aucune note en étoiles');
        const temoins = await pg.evaluate(() => document.querySelectorAll('[data-accueil] blockquote, [data-accueil] q, [data-accueil] cite').length);
        dit(temoins === 0 && !/témoign|ils (nous )?font confiance|nos clients|« [^»]{10,} » —/i.test(t), 'aucun témoignage (ni citation, ni « ils nous font confiance »)', `${temoins} citation(s)`);
        const conf = lire('public/legal/confidentialite.html') || '';
        dit(!/ne vend (rien|aucune donnée)/i.test(t) || /ne vend aucune donnée/i.test(conf), '« ne vend rien » s’appuie sur la politique publiée');
        const auto = await pg.evaluate(() => { const c = document.querySelector('[data-confiance]'); return c ? c.querySelectorAll('[data-automatisme]').length : -1; });
        dit(auto === 2 && /favori/i.test(t) && /republi/i.test(t), 'la confiance nomme les automatismes éteints, et dit que favoris et republication ne partent que lancés', `${auto} automatisme(s)`);
        // (11 nov.) La phrase de l'offre Solo (OFFRES, la même que les CGV et les
        // Paramètres) nomme « un Vestiaire » parmi les comptes : c'est le périmètre
        // de l'abonnement, pas une promesse de totaux. Ailleurs, rien.
        const v = await pg.evaluate(() => { const n = (t) => ((t || '').match(/Vestiaire/g) || []).length; const tout = n(document.body.innerText); const faq = n((document.querySelector('[data-faq]') || {}).innerText); const offres = [...document.querySelectorAll('[data-offre-phrase]')].reduce((a, e) => a + n(e.innerText), 0); return { tout, faq, offres }; });
        dit(v.tout === v.faq + v.offres, '« Vestiaire » n’apparaît que dans les questions et la phrase d’offre (OFFRES), pas comme fonction branchée', JSON.stringify(v));
        if (reglages.DETOURAGE_POUR_TOUS === 'false') dit(!/Photoroom|détour/i.test(t), 'DETOURAGE_POUR_TOUS = false → ni « Photoroom » ni « détourage »');
        const faux = [];
        if (/rien n['’]est envoyé à ta place|(deux|2) minutes|tout automatique/i.test(t)) faux.push('promesse fausse');
        if (/répond(re)? (aux|à tes) (questions|messages) (des acheteurs )?(tout seul|automatiquement)/i.test(t)) faux.push('réponse automatique (n’existe plus)');
        if (/Depop|Poshmark|Mercari|dollars?|international/i.test(t)) faux.push('international (refusé, §3)');
        dit(faux.length === 0, 'aucune promesse fausse ni refusée (réponse auto, international)', faux.join(', '));
        const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
        const avecEmail = ['src/Accueil.jsx', 'src/accueil-reglages.js'].filter((f) => EMAIL.test(sansCommentaires(lire(f))));
        dit(avecEmail.length === 0, 'aucune adresse e-mail écrite dans les fichiers de la page', avecEmail.join(', '));
        await ctx.close();
      });
    }

    if (veut('faq')) {
      console.log('\n── LES QUESTIONS : UNE QUESTION, SA RÉPONSE');
      await essaie('faq', async () => {
        const { ctx, pg } = await page(nav, TEL);
        const q = await pg.evaluate(() => [...document.querySelectorAll('[data-faq] [data-question]')].map((d) => ({ h3: d.querySelectorAll('h3').length, q: ((d.querySelector('h3') || {}).innerText || '').trim(), r: [...d.querySelectorAll('p')].filter((p) => p.innerText.trim()).length })));
        dit(q.length >= 6 && q.every((x) => x.h3 === 1 && /\?$|\.$/.test(x.q) && x.r >= 1), `${q.length} questions : chacune un titre (h3) et au moins une réponse`, q.filter((x) => !(x.h3 === 1 && x.r >= 1)).map((x) => x.q).join(' · '));
        const h = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] h1, [data-accueil] h2, [data-accueil] h3')].map((e) => Number(e.tagName[1])));
        const saut = h.findIndex((n, i) => i > 0 && n > h[i - 1] + 1);
        dit(h[0] === 1 && saut === -1, 'les titres se suivent sans sauter de niveau (h1 → h2 → h3)', h.join(''));
        await ctx.close();
      });
    }

    if (veut('seo')) {
      console.log('\n── SEO : TITRE, DESCRIPTION, IMAGE DE PARTAGE, DONNÉES STRUCTURÉES SANS AVIS');
      await essaie('seo', async () => {
        const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
        const meta = (re) => ((re.exec(html) || [])[1] || '').trim();
        const titre = meta(/<title>([^<]*)<\/title>/), desc = meta(/<meta name="description" content="([^"]*)"/);
        dit(titre.length >= 20 && titre.length <= 70 && /VRM/.test(titre) && !/sneaker/i.test(titre), 'un titre de 20 à 70 signes, qui nomme VRM, pas « sneakers » seulement', `${titre.length} · ${titre}`);
        dit(desc.length >= 80 && desc.length <= 170 && /Vinted/.test(desc) && !/sneaker/i.test(desc), 'une description de 80 à 170 signes, pour tout revendeur', `${desc.length} · ${desc}`);
        dit(/<link rel="canonical" href="https:\/\/vrm\.center\/"/.test(html), 'canonical : https://vrm.center/');
        const og = {}; for (const m of html.matchAll(/<meta property="og:([a-z:_]+)" content="([^"]*)"/g)) og[m[1]] = m[2];
        dit(['title', 'description', 'url', 'image', 'type'].every((k) => og[k]) && /summary_large_image/.test(html), 'Open Graph complet (titre, description, url, image, type) et carte large', JSON.stringify(Object.keys(og)));
        const fichier = (og.image || '').replace('https://vrm.center', '');
        const img = fs.existsSync(path.join(DIST, fichier)) ? fs.readFileSync(path.join(DIST, fichier)) : null;
        // Dimensions d'un JPEG : le premier marqueur SOFn.
        const dims = (() => { if (!img || img[0] !== 0xFF || img[1] !== 0xD8) return null; let i = 2; while (i < img.length) { if (img[i] !== 0xFF) return null; const m = img[i + 1], l = img.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC3) return { h: img.readUInt16BE(i + 5), w: img.readUInt16BE(i + 7) }; i += 2 + l; } return null; })();
        dit(!!dims && dims.w === 1200 && dims.h === 630 && og['image:width'] === '1200' && og['image:height'] === '630', 'l’image de partage existe : un JPEG 1200 × 630, dimensions déclarées', dims ? `${dims.w}×${dims.h}` : `absente (${fichier})`);
        dit(!!img && img.length <= 150 * 1024, 'l’image de partage pèse ≤ 150 Ko', img ? `${Math.round(img.length / 1024)} Ko` : '');
        let reg = null; try { reg = JSON.parse(lire('public/og-vrm.json')); } catch (_) { reg = null; }
        const src = reg && reg.source && fs.existsSync(path.join(RACINE, 'public', reg.source)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE, 'public', reg.source))).digest('hex') : null;
        const regCap = reg && S.registre[(reg.source || '').replace(/^accueil\//, '')];
        dit(!!img && !!reg && reg.sha256 === crypto.createHash('sha256').update(img).digest('hex') && !!regCap && regCap.modeExemple === true && regCap.sha256 === reg.sourceSha256 && src === reg.sourceSha256, 'elle est celle de scripts/accueil-og.cjs, faite d’une capture au registre du mode exemple (empreintes)', reg ? `${reg.source}` : 'public/og-vrm.json absent');
        const blocs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
        let ld = null; try { ld = JSON.parse(blocs[0]); } catch (_) { ld = null; }
        dit(blocs.length === 1 && !!ld && ld['@type'] === 'SoftwareApplication' && ld.name === 'VRM', 'des données structurées : un SoftwareApplication « VRM », JSON valide');
        dit(!/aggregateRating|"review"|ratingValue|reviewCount/i.test(blocs.join('')), 'aucun avis ni note dans les données structurées (il n’y en a pas)');
        const offresLd = (ld && ld.offers) || [];
        const enPoint = (p) => String(p || '').replace(',', '.');
        const okLd = OFFRES && offresLd.length === 2 && offresLd[0].name === OFFRES.solo.nom && offresLd[1].name === OFFRES.pro.nom && offresLd[0].price === enPoint(reglages.PRIX_MOIS) && offresLd[1].price === enPoint(reglages.PRIX_PRO_MOIS) && offresLd.every((o) => o.priceCurrency === 'EUR');
        dit(!!okLd, 'les offres des données structurées = OFFRES (noms) et réglages/CGV (prix, en euros)', JSON.stringify(offresLd.map((o) => [o.name, o.price, o.priceCurrency])));
        const { ctx, pg } = await page(nav, TEL);
        const t = await pg.evaluate(() => document.title);
        dit(t === titre.replace(/&amp;/g, '&'), 'la page affichée garde le même titre que index.html', t);
        await ctx.close();
      });
    }

    if (veut('lent')) {
      console.log('\n── LE CHARGEMENT SUR UNE 4G LENTE (390 px, mesuré)');
      await essaie('4G lente', async () => {
        const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
        await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
        await ctx.addInitScript(() => { window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (_) {} });
        const pg = await ctx.newPage();
        const cdp = await ctx.newCDPSession(pg);
        // « 4G lente » : 150 ms de latence, 1,6 Mbit/s descendant, 750 kbit/s montant.
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
        let octets = 0; cdp.on('Network.loadingFinished', (e) => { octets += e.encodedDataLength || 0; });
        const t0 = Date.now();
        await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
        const charge = Date.now() - t0;
        await pg.waitForTimeout(800);
        const lcp = await pg.evaluate(() => window.__lcp);
        console.log(`     chargement complet ${charge} ms · LCP ${Math.round(lcp)} ms · ${Math.round(octets / 1024)} Ko transférés avant tout défilement`);
        dit(lcp > 0 && lcp < 4000, 'sur 4G lente, le plus grand élément s’affiche en moins de 4 s', `${Math.round(lcp)} ms`);
        dit(octets > 0 && octets < 400 * 1024, 'avant tout défilement, moins de 400 Ko transférés (compression du serveur de banc : aucune ; Vercel compresse)', `${Math.round(octets / 1024)} Ko`);
        await ctx.close();
      });
    }

    if (veut('reduit')) {
      console.log('\n── « RÉDUIRE LES ANIMATIONS » : RIEN NE BOUGE, TOUT EST LÀ');
      await essaie('réduit', async () => {
        const { ctx, pg } = await page(nav, { ...ORDI, reduit: true });
        const r = await pg.evaluate(() => {
          const anim = document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running').length : 0;
          const caches = [...document.querySelectorAll('[data-accueil] h1, [data-accueil] h2, [data-accueil] p')].filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length;
          return { anim, caches };
        });
        dit(r.anim === 0 && r.caches === 0, 'aucune animation en cours, aucun texte à moitié transparent', JSON.stringify(r));
        await ctx.close();
      });
    }

    if (veut('boutons')) {
      console.log('\n── LES BOUTONS OUVRENT LE BON FORMULAIRE');
      for (const [cta, attendu, q] of [['inscription', /Créer ton compte/, 'inscription'], ['connexion', /Se connecter/, 'connexion']]) {
        await essaie(`bouton ${cta}`, async () => {
          const { ctx, pg } = await page(nav, {});
          await pg.click(`[data-accueil] [data-section="hero"] [data-cta="${cta}"]`, { timeout: 8000 });
          await pg.waitForFunction((re) => new RegExp(re).test(document.body.innerText), attendu.source, { timeout: 15000 }).catch(() => {});
          const t = await pg.evaluate(() => document.body.innerText);
          dit(attendu.test(t) && !(await pg.evaluate(() => !!document.querySelector('[data-accueil]'))), `« ${cta} » ouvre le formulaire « ${String(attendu).replace(/[/\\]/g, '')} »`, t.slice(0, 120));
          dit(new RegExp(`[?&]${q}`).test(pg.url()), `« ${cta} » : l'adresse le dit (lien partageable, rechargement fidèle)`, pg.url());
          await pg.goBack();
          await pg.waitForSelector('[data-accueil]', { timeout: 8000 }).catch(() => {});
          dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), `« ${cta} » : le retour arrière ramène à la page d'accueil`);
          await ctx.close();
        });
      }
      await essaie('barre · se connecter', async () => {
        const { ctx, pg } = await page(nav, TEL);
        await pg.click('.av-nav [data-cta-nav="connexion"]', { timeout: 8000 });
        await pg.waitForFunction(() => /[?&]connexion/.test(location.search), null, { timeout: 8000 }).catch(() => {});
        dit(/[?&]connexion/.test(pg.url()), '« Se connecter » de la barre ouvre la connexion (téléphone)', pg.url());
        await ctx.close();
      });
      await essaie('lien retour depuis la connexion', async () => {
        const { ctx, pg } = await page(nav, { url: '/?connexion' });
        await pg.waitForSelector('[data-retour-accueil]', { timeout: 15000 }).catch(() => {});
        const lien = await pg.$('[data-retour-accueil]');
        dit(!!lien, 'l\'écran de connexion propose de revenir à la page d\'accueil');
        if (lien) { await lien.click(); await pg.waitForSelector('[data-accueil]', { timeout: 8000 }).catch(() => {}); dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), '…et y revient vraiment'); }
        await ctx.close();
      });
    }

    if (veut('personne')) {
      console.log('\n── PERSONNE D\'AUTRE NE LA VOIT (pas même un éclair)');
      for (const [nom, opt] of [
        ['une session', { session: true }],
        ['un retour de lien email (?code=)', { url: '/?code=abc' }],
        ['un retour de lien email (#access_token=)', { url: '/#access_token=x&type=signup' }],
        ['un lien vers un onglet (?tab=)', { url: '/?tab=journee' }],
      ]) {
        await essaie(nom, async () => {
          const { ctx, pg } = await page(nav, opt);
          await pg.waitForTimeout(800);
          dit(await pg.evaluate(() => window.__accueilVu === false), `${nom} : va droit dans l'app, sans éclair de page d'accueil`);
          await ctx.close();
        });
      }
    }

    if (veut('poids')) {
      console.log('\n── LE POIDS DE CE QUI SE CHARGE AVANT L\'APP');
      await essaie('poids', async () => {
        const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
        const entree = (/assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html) || [])[1];
        const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(DIST, 'assets', f))).length;
        const fichiers = fs.readdirSync(path.join(DIST, 'assets'));
        const sc = fichiers.find((f) => /^accueil-scenes-.*\.js$/.test(f)), fi = fichiers.find((f) => /^AccueilFilm-.*\.js$/.test(f));
        const kE = entree ? gz(entree) / 1024 : Infinity, kS = sc ? gz(sc) / 1024 : Infinity, kF = fi ? gz(fi) / 1024 : Infinity;
        console.log(`     entrée ${entree} ${kE.toFixed(1)} Ko gzip · scènes ${kS.toFixed(1)} Ko · film ${kF.toFixed(1)} Ko (avant la refonte : entrée 19,05 Ko, mesurée sur e6bda5c)`);
        dit(kE <= 26, 'le fichier d’entrée (celui que nomme dist/index.html) pèse ≤ 26 Ko compressés', `${kE.toFixed(1)} Ko`);
        dit(!sc || kS <= 20, 'les écrans dessinés de l’ancienne page ne sont plus un morceau que la page charge (le film les embarque)', `${sc || 'aucun morceau séparé'}`);
        dit(kF <= 25, 'le film est un morceau à part de ≤ 25 Ko compressés', `${fi || 'absent'} ${kF.toFixed(1)} Ko`);
      });
    }

    if (veut('film')) {
      console.log('\n── LE FILM « UNE JOURNÉE AVEC VRM »');
      await essaie('film', async () => {
        const { ctx, pg, scripts } = await page(nav, { largeur: 640, hauteur: 360, url: '/?film' });
        await pg.waitForFunction(() => typeof window.__filmT === 'function', null, { timeout: 15000 }).catch(() => {});
        await pg.evaluate(() => document.fonts && document.fonts.ready);
        const duree = await pg.evaluate(() => window.__filmDuree);
        dit(duree === 35, '`?film` dure 35 s', `${duree}`);
        dit(!scripts.some((s) => /^App-/.test(s)) && scripts.some((s) => /^AccueilFilm-/.test(s)), '`?film` charge le film et PAS l’application', scripts.join(', '));
        const plan = async (t) => pg.evaluate((s) => new Promise((res) => { window.__filmT(s); requestAnimationFrame(() => requestAnimationFrame(() => res(document.querySelector('[data-film-plan]').getAttribute('data-film-plan')))); }), t);
        const attendus = [[12, 'colis'], [0.5, 'ouverture'], [6, 'carte'], [20, 'ailleurs'], [33, 'fin']];
        const lus = []; for (const [t] of attendus) lus.push(await plan(t));
        dit(attendus.every(([, p], i) => lus[i] === p), 'les plans tombent aux bons instants (12 s colis · 0,5 ouverture · 6 carte · 20 ailleurs · 33 fin)', lus.join(' · '));
        // Jamais de noir, rien d'interdit — une capture toutes les 0,5 s.
        const noirs = [], interdits = [];
        for (let t = 1.0; t <= 34.5 + 1e-9; t += 0.5) {
          await plan(t);
          const { w, h, bpp, px } = decodePng(await pg.screenshot());
          let diff = 0; const n = w * h;
          for (let i = 0; i < n; i++) { const o = i * bpp; if (Math.abs(px[o] - 7) > 24 || Math.abs(px[o + 1] - 9) > 24 || Math.abs(px[o + 2] - 13) > 24) diff++; }
          if (diff / n <= 0.005) noirs.push(t.toFixed(1));
          const txt = await pg.evaluate(() => document.body.innerText);
          const m = ['12,99', 'par mois', 'gratuit', 'offert', 'Vestiaire', 'Photoroom', '@'].filter((x) => txt.toLowerCase().includes(x.toLowerCase()));
          if (m.length) interdits.push(`${t.toFixed(1)} s : ${m.join(', ')}`);
        }
        dit(noirs.length === 0, 'jamais de noir : à chaque demi-seconde, plus de 0,5 % de l’image est dessiné', noirs.join(', '));
        dit(interdits.length === 0, 'le film ne montre aucun prix d’abonnement, ni « gratuit », ni Vestiaire, ni détourage, ni adresse', interdits.slice(0, 3).join(' · '));
        // Fonction pure du temps : 17,3 puis 4 puis 17,3 donnent la même image.
        await plan(17.3); const a = await pg.screenshot(); await plan(4); await plan(17.3); const b = await pg.screenshot();
        dit(a.equals(b), 'le film est une fonction pure du temps (17,3 s → 4 s → 17,3 s : même image)');
        await ctx.close();
        const c = await page(nav, { largeur: 360, hauteur: 640, url: '/?film=court' });
        await c.pg.waitForFunction(() => typeof window.__filmT === 'function', null, { timeout: 15000 }).catch(() => {});
        dit(await c.pg.evaluate(() => window.__filmDuree) === 15, '`?film=court` dure 15 s');
        await c.ctx.close();
      });
    }
  } finally {
    await nav.close(); srv.close();
  }
  console.log(ko ? `\n❌ accueil : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ accueil : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
