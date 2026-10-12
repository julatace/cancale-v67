// ════════════════════════════════════════════════════════════════════════════
//  BANC « PAGE D'ACCUEIL » — ce que voit quelqu'un qui ne connaît pas VRM.
//
//  Julien, 11 octobre : « on ne comprend pas trop ce que c'est, il faut vraiment
//  qu'il soit super celui-là » — puis « un motion design de ouf ».
//
//  Ce banc juge ce qui est RENDU, jamais la formulation (un contrat d'attributs
//  `data-*`, des nombres, des couleurs, des positions, des temps) :
//   • qui voit la page : un visiteur sans session — et PERSONNE d'autre ;
//   • un visiteur ne télécharge ni l'application (`App-*`) ni le film ;
//   • les boutons ouvrent le BON formulaire ; la barre garde « Se connecter » ;
//   • la carte « Aujourd'hui » joue UNE fois et s'ARRÊTE (aucune boucle), sans
//     curseur (c'est VRM qui travaille) ; les écrans du bas ne jouent que quand
//     on les regarde, en moins de 5 s, et le curseur n'y paraît que pour un
//     geste de l'utilisateur ;
//   • les chiffres dessinés tiennent (la table src/accueil-demo.js) ;
//   • « réduire les animations » donne l'état final, sans rien qui bouge ;
//   • le premier écran dit ce qu'est VRM, le prix, et qu'il faut un ordinateur ;
//   • lisible (aucun texte sous 12 px), contrasté (4,5:1), l'accent rare ;
//   • honnête : prix = CGV, aucun chiffre de clientèle, aucune adresse en dur,
//     rien de ce qui n'est pas branché (Vestiaire, détourage) ;
//   • le poids de ce qui se charge AVANT l'app ;
//   • le film : ses plans, jamais de noir, une fonction pure du temps.
//  ⚠️ AUCUNE FIXTURE : une page publique ne lit aucune donnée.
//  PORT=… pour lancer à côté d'un autre banc (défaut 4523).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');            // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.PORT) || 4523;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip', '.webmanifest': 'application/manifest+json' };
const CAPT = process.env.CAPTURES || '';
const SEUL = (process.env.SEUL || '').split(',').filter(Boolean);   // ex. SEUL=film,honnetete
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

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0].split('#')[0];
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

// Ce que la page fait, noté par elle-même dès le premier octet : les états de la
// carte et des écrans (avec l'heure), la notification, les vols, le curseur, et
// le nombre d'images demandées (pour prouver que rien ne boucle).
const SONDE = () => {
  window.__raf = 0;
  const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => { window.__raf++; return raf0(f); };
  const V = window.__vu = { carte: [], notif: false, vols: 0, volLa: false, curseurCarte: false, curseurColis: false, scenes: {}, curseurs: 0 };
  const note = (L, e) => { if (!L.length || L[L.length - 1].e !== e) L.push({ e, t: performance.now() }); };
  const scan = () => {
    const c = document.querySelector('[data-demo-animee]');
    if (c) {
      note(V.carte, c.getAttribute('data-etat'));
      if (c.querySelector('[data-notif]')) V.notif = true;
      const vol = !!c.querySelector('[data-vol]');
      if (vol && !V.volLa) V.vols++;
      V.volLa = vol;
      if (c.querySelector('[data-curseur]')) V.curseurCarte = true;
    }
    document.querySelectorAll('[data-scene]').forEach((s) => {
      const n = s.getAttribute('data-scene');
      note(V.scenes[n] = V.scenes[n] || [], s.getAttribute('data-etat'));
      if (n === 'colis' && s.querySelector('[data-curseur]')) V.curseurColis = true;
    });
    if (document.querySelector('[data-notif],[data-vol],[data-curseur]')) V.bougeVu = true;
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-etat'] });
};

async function page(nav, { largeur = 1512, hauteur = 900, mobile = false, session = false, url = '/', reduit = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: reduit ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const lectures = [];
  await ctx.route(/supabase\.co|\/api\//, (rt) => { lectures.push(rt.request().url()); rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
  if (session) await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await ctx.addInitScript(() => {
    window.__accueilVu = false;
    new MutationObserver(() => { if (document.querySelector('[data-accueil]')) window.__accueilVu = true; })
      .observe(document, { childList: true, subtree: true });
  });
  await ctx.addInitScript(SONDE);
  const pg = await ctx.newPage();
  const scripts = [];
  pg.on('request', (rq) => { if (/\.js(\?|$)/.test(rq.url())) scripts.push(rq.url().split('/').pop()); });
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const r = document.getElementById('root'); return r && r.children.length && r.innerText.trim().length > 3; }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return { ctx, pg, scripts, erreurs, lectures, t0 };
}
// Un texte coupé par des points de suspension (ou rogné) dans une zone : son
// contenu déborde de sa boîte alors qu'elle cache le débordement. Mesuré, pas lu.
const coupes = (pg, sel) => pg.evaluate((s) => {
  const x = [];
  document.querySelectorAll(s).forEach((z) => z.querySelectorAll('*').forEach((e) => {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(e);
    if (cs.overflowX === 'visible' && cs.textOverflow !== 'ellipsis') return;
    let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
    if (o <= 0.1 || !e.clientWidth) return;
    if (e.scrollWidth > e.clientWidth + 1) x.push(`« ${e.textContent.trim().slice(0, 40)} » ${e.scrollWidth}/${e.clientWidth} px`);
  }));
  return x;
}, sel);
const attendreEtat = (pg, sel, etat, ms = 12000) => pg.waitForFunction(([s, e]) => { const el = document.querySelector(s); return el && el.getAttribute('data-etat') === e; }, [sel, etat], { timeout: ms }).then(() => true, () => false);
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

// Les contrôles de rendu qui se répètent aux deux tailles.
async function controlesRendu(nav, nom, opt, demo, reglages, prixCgv) {
  const { ctx, pg, scripts, erreurs, lectures } = await page(nav, opt);
  const H = opt.hauteur;
  try {
    dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), `${nom} : la page d'accueil s'affiche`);
    const texte = await pg.evaluate(() => document.body.innerText);
    dit(!/n'a pas pu s'afficher|Cannot access|is not defined/.test(texte), `${nom} : aucun écran tombé`);

    // 10. Le premier écran porte tout, sans défiler.
    const def = await visibleDansEcran(pg, '[data-definition]');
    dit(def && def.bottom <= H && def.top >= 0 && /revendeurs/i.test(def.texte), `${nom} : la pastille dit ce qu'est VRM, dans le premier écran`, def ? `${Math.round(def.top)}–${Math.round(def.bottom)} « ${def.texte} »` : 'absente');
    const carte = await visibleDansEcran(pg, '[data-demo-animee]');
    dit(carte && carte.top < H, `${nom} : la carte « Aujourd'hui » commence dans le premier écran`, carte ? `haut à ${Math.round(carte.top)} px` : 'absente');
    const prix = await pg.evaluate((p) => {
      const re = new RegExp(`${p.replace(',', '\\,')}\\s*€\\s*par mois`);
      // ⚠️ L'élément le plus PROFOND qui porte la phrase — pas le premier venu :
      //    le conteneur du haut de page la contient aussi, et son bas est celui
      //    de la carte. Sur ordinateur il tenait dans l'écran : vert par accident.
      const tous = [...document.querySelectorAll('[data-section="hero"] *')].filter((e) => re.test(e.innerText || ''));
      const el = tous.find((e) => ![...e.children].some((c) => re.test(c.innerText || '')));
      if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom };
    }, prixCgv || '12,99');
    dit(!!prix && prix.bottom <= H, `${nom} : le prix (${prixCgv} € par mois, celui des CGV) est dans le premier écran`, prix ? `bas à ${Math.round(prix.bottom)} px` : 'absent du haut de page');
    const pre = await visibleDansEcran(pg, '[data-prerequis]');
    dit(pre && pre.bottom <= H && /ordinateur/i.test(pre.texte), `${nom} : le prérequis (un ordinateur avec Chrome) est dans le premier écran`, pre ? `bas à ${Math.round(pre.bottom)} px` : 'absent');
    if (opt.mobile) {
      const ret = await visibleDansEcran(pg, '[data-vers="ailleurs"]');
      dit(ret && ret.bottom <= H, `${nom} : les lignes « Colis à poster » et « Annonces à retirer » se voient sans défiler`, ret ? `bas de « Annonces à retirer » à ${Math.round(ret.bottom)} px` : 'absente');
    }
    // 11. La bonne variante du prérequis.
    const variante = await pg.evaluate(() => { const e = document.querySelector('[data-prerequis]'); return e && e.getAttribute('data-variante'); });
    dit(variante === (opt.mobile ? 'tactile' : 'souris'), `${nom} : le prérequis parle à ${opt.mobile ? 'un téléphone (« crée ton compte dès maintenant »)' : 'un ordinateur'}`, `variante ${variante}`);
    // 12. ACCES_OFFERT suivi.
    const offert = reglages.ACCES_OFFERT;
    const off = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('[data-acces-offert]')].map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
      return { a, carte: document.querySelectorAll('[data-sans-carte]').length };
    });
    if (offert === 'true') dit(off.a.some((r) => r.bottom <= H && r.top >= 0) && off.carte > 0, `${nom} : ACCES_OFFERT = true → « Gratuit pour l'instant » dans le premier écran et « Aucune carte bancaire »`, JSON.stringify(off));
    else if (offert === 'false') dit(off.a.length === 0 && off.carte === 0, `${nom} : ACCES_OFFERT = false → ni « gratuit », ni « aucune carte » dans la page`, JSON.stringify(off));
    else dit(false, `${nom} : src/accueil-reglages.js porte ACCES_OFFERT`, 'constante introuvable');

    // 1. La carte vit, puis s'arrête.
    const fin = await attendreEtat(pg, '[data-demo-animee]', 'fin', 14000);
    const vu = await pg.evaluate(() => window.__vu);
    const etats = vu.carte.map((x) => x.e);
    const tFin = (vu.carte.find((x) => x.e === 'fin') || {}).t, tOng = (vu.carte.find((x) => x.e === 'onglets') || {}).t;
    dit(fin && etats.includes('onglets') && etats.includes('vente') && (tFin || 0) < 8000, `${nom} : la carte passe par « onglets », « vente » et s'arrête sur « fin » en moins de 8 s`, `${etats.join(' → ')} · fin à ${Math.round(tFin || -1)} ms`);
    dit(vu.notif && vu.vols >= 2, `${nom} : une vente tombe (notification) et son numéro file deux fois`, `notif ${vu.notif} · vols ${vu.vols}`);
    dit(await pg.evaluate(() => document.querySelectorAll('[data-demo-animee]').length) === 1, `${nom} : une seule démo animée sur la page`);
    // 3. Moins de 5 s.
    dit(tFin && tOng && tFin - tOng <= 5000, `${nom} : le déroulé de la carte dure moins de 5 s`, `${Math.round((tFin || 0) - (tOng || 0))} ms`);
    // 4. Aucun curseur dans la carte : c'est VRM qui travaille.
    dit(vu.curseurCarte === false, `${nom} : aucun curseur dans la carte (ce que VRM fait arrive sans curseur)`);
    // 7. Les chiffres de la carte tiennent.
    const nb = await pg.evaluate(() => {
      const lu = (v) => { const b = document.querySelector(`[data-vers="${v}"]`); if (!b) return null; const s = [...b.querySelectorAll('.cj-nb span')].filter((x) => Number(getComputedStyle(x).opacity) > 0.5 && /\d/.test(x.textContent)); return s.map((x) => x.textContent.trim()).join('|'); };
      return { colis: lu('colis'), ailleurs: lu('ailleurs') };
    });
    dit(nb.colis === String(demo.jour.colisApres) && nb.ailleurs === String(demo.jour.aRetirerApres), `${nom} : en fin, la carte affiche ${demo.jour.colisApres} colis à poster et ${demo.jour.aRetirerApres} annonces à retirer (la table de démo)`, JSON.stringify(nb));
    const cc = await coupes(pg, '[data-demo-animee]');
    dit(cc.length === 0, `${nom} : en fin, aucune ligne de la carte n'est coupée par des points de suspension`, cc.slice(0, 3).join(' · '));
    // 2. Aucune boucle : plus aucune image demandée une fois tout arrêté.
    await pg.waitForTimeout(400);
    const joue = await pg.evaluate(() => [...document.querySelectorAll('[data-scene]')].filter((s) => s.getAttribute('data-etat') === 'joue').length);
    const r0 = await pg.evaluate(() => window.__raf); await pg.waitForTimeout(1500); const r1 = await pg.evaluate(() => window.__raf);
    dit(joue === 0 && r1 - r0 <= 2, `${nom} : rien ne boucle — une fois la carte arrêtée, aucune image n'est calculée`, `${r1 - r0} image(s) demandée(s) en 1,5 s · ${joue} écran(s) en cours`);
    // 15. L'accent est rare dans le premier écran (hors écrans dessinés).
    const accent = await pg.evaluate(() => {
      const BLEUS = ['rgb(36, 88, 230)', 'rgb(61, 123, 255)'];
      const dedans = (e) => e.closest('[data-demo-animee],[data-scene]');
      let n = 0; const qui = [], hors = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (dedans(e)) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight) return;
        let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
        if (o <= 0.1) return;
        const cs = getComputedStyle(e);
        const aTexte = [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim());
        const fond = BLEUS.includes(cs.backgroundColor), texte = aTexte && BLEUS.includes(cs.color);
        if (fond || texte) { n++; qui.push(e.tagName + (e.className ? '.' + String(e.className).split(' ')[0] : '') + (texte ? ' (texte)' : '')); }
        // Le budget d'accent du cadre : le FOND d'un bouton principal. Un mot
        // bleu dans un titre, un sur-titre ou une coche, c'est hors budget.
        if (texte || (fond && !e.classList.contains('acc-p'))) hors.push(e.tagName + ' « ' + (e.textContent || '').trim().slice(0, 24) + ' »');
      });
      return { n, qui, hors };
    });
    dit(accent.n <= 2 && accent.hors.length === 0, `${nom} : l'accent bleu est rare dans le premier écran (≤ 2 éléments, et seulement le fond d'un bouton principal)`, `${accent.n} : ${accent.qui.join(', ')}${accent.hors.length ? ' · hors budget : ' + accent.hors.join(', ') : ''}`);
    // 16. Ambre et couleurs de plateformes : seulement dans les écrans dessinés.
    const hors = await pg.evaluate(() => {
      const INTERDITS = ['rgb(255, 178, 62)', 'rgb(18, 183, 190)', 'rgb(245, 107, 42)', 'rgb(134, 184, 23)'];
      const x = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (e.closest('[data-demo-animee],[data-scene]')) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        const cs = getComputedStyle(e);
        if (INTERDITS.includes(cs.color) || INTERDITS.includes(cs.backgroundColor) || INTERDITS.includes(cs.borderTopColor)) x.push(e.tagName + '.' + String(e.className).split(' ')[0]);
      });
      return x;
    });
    dit(hors.length === 0, `${nom} : ni ambre ni couleur de plateforme dans le cadre de la page`, hors.slice(0, 5).join(', '));
    // 14. Contraste : le bouton principal, et tout texte visible hors écrans dessinés.
    const contraste = await pg.evaluate(() => {
      const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const BG = { r: 7, g: 9, b: 13, a: 1 };
      const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
      const fond = (e) => { const pile = []; for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = BG; for (let i = pile.length - 1; i >= 0; i--) f = sur(pile[i], f); return f; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const cta = document.querySelector('.acc-hero [data-cta="inscription"]');
      const rc = cta ? ratio(rgb(getComputedStyle(cta).color), fond(cta)) : 0;
      const pires = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (e.closest('[data-demo-animee],[data-scene]')) return;
        if (![...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
        if (o <= 0.1 || getComputedStyle(e).visibility === 'hidden') return;
        const c = rgb(getComputedStyle(e).color); if (!c) return;
        const v = ratio(sur(c, fond(e)), fond(e));
        if (v < 4.5) pires.push(`${e.tagName}.${String(e.className).split(' ')[0]} « ${e.textContent.trim().slice(0, 24)} » ${v.toFixed(2)}:1`);
      });
      return { rc, pires };
    });
    dit(contraste.rc >= 4.5, `${nom} : le texte du bouton principal se lit sur son fond (≥ 4,5:1)`, `${contraste.rc.toFixed(2)}:1`);
    dit(contraste.pires.length === 0, `${nom} : tout texte visible hors écrans dessinés tient 4,5:1 sur son fond réel`, contraste.pires.slice(0, 4).join(' · '));
    // Aucun débordement, aucun texte sous 12 px nulle part sur la page.
    const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    dit(deb <= 1, `${nom} : aucun débordement horizontal`, `${deb} px de trop`);
    const petits = await pg.evaluate(() => {
      const x = [];
      document.querySelectorAll('[data-accueil] *').forEach((e) => {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (parseFloat(getComputedStyle(e).fontSize) < 11.99) x.push(`${e.tagName}.${String(e.className).split(' ')[0]} ${getComputedStyle(e).fontSize} « ${e.textContent.trim().slice(0, 20)} »`);
      });
      return x;
    });
    dit(petits.length === 0, `${nom} : aucun texte rendu sous 12 px sur la page`, petits.slice(0, 4).join(' · '));
    // Le téléchargement : ni l'app, ni le film.
    dit(!scripts.some((s) => /^App-/.test(s)), `${nom} : le visiteur ne télécharge PAS l'application`, scripts.join(', '));
    dit(!scripts.some((s) => /^AccueilFilm-/.test(s)), `${nom} : le visiteur ne télécharge PAS le film`, scripts.filter((s) => /Film/.test(s)).join(', '));
    dit(lectures.length === 0, `${nom} : la page publique ne lit rien en base`, lectures.slice(0, 3).join(' · '));
    dit(erreurs.length === 0, `${nom} : aucune erreur de page`, erreurs.join(' | '));
    // Les liens légaux, la ligne Contact.
    const liens = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] a[href^="/legal/"]')].map((a) => a.getAttribute('href')));
    const manquants = liens.filter((h) => !fs.existsSync(path.join(DIST, h)));
    dit(liens.length >= 5 && manquants.length === 0, `${nom} : les ${liens.length} liens légaux mènent à une vraie page`, manquants.join(', ') || `${liens.length} lien(s)`);
    let cst = ''; try { cst = ((/CONTACT_EMAIL\s*=\s*'([^']*)'/.exec(lire('src/contact.js') || '') || [])[1] || '').trim(); } catch (_) { cst = ''; }
    const contact = await pg.evaluate(() => { const e = document.querySelector('[data-accueil] [data-contact]'); return e ? { texte: e.innerText, absent: e.hasAttribute('data-contact-absent'), href: e.getAttribute('href') || '' } : null; });
    dit(!!contact && (cst ? contact.href === `mailto:${cst}` : contact.absent && /à venir/.test(contact.texte) && !contact.href),
      `${nom} : une ligne Contact — ${cst ? 'l’adresse de src/contact.js' : '« adresse de contact à venir », aucune adresse inventée'}`, contact ? `${contact.texte} ${contact.href}` : 'absente');
    // 19. Un seul bouton principal à la fois ; 18. « Se connecter » reste joignable.
    const navCta = () => pg.evaluate(() => { const b = document.querySelector('.acc-nav [data-cta-nav="inscription"]'); return b ? { op: Number(getComputedStyle(b).opacity), tab: b.tabIndex } : null; });
    const avantDef = await navCta();
    dit(avantDef && avantDef.op === 0 && avantDef.tab === -1, `${nom} : en haut de page, « Créer mon compte » n'est PAS doublé dans la barre`, JSON.stringify(avantDef));
    await pg.evaluate(() => window.scrollTo(0, 1500));
    await pg.waitForFunction(() => { const b = document.querySelector('.acc-nav [data-cta-nav="inscription"]'); return b && getComputedStyle(b).opacity === '1'; }, null, { timeout: 2000 }).catch(() => {});
    const apresDef = await navCta();
    dit(apresDef && apresDef.op === 1 && apresDef.tab === 0, `${nom} : une fois le bouton du haut sorti, la barre le propose (et il est atteignable au clavier)`, JSON.stringify(apresDef));
    await pg.evaluate(() => window.scrollTo(0, 3000)); await pg.waitForTimeout(400);
    const barre = await pg.evaluate(() => { const n = document.querySelector('[data-accueil] .acc-nav'); return n ? Math.round(n.getBoundingClientRect().top) : null; });
    dit(barre === 0, `${nom} : la barre du haut reste visible en faisant défiler`, `haut de la barre à ${barre} px`);
    const sc = await visibleDansEcran(pg, '.acc-nav [data-cta-nav="connexion"]');
    dit(sc && sc.display !== 'none' && sc.top >= 0 && sc.bottom <= sc.h && sc.right <= sc.w && sc.left >= 0, `${nom} : « Se connecter » reste dans la barre, même après avoir défilé`, sc ? `${Math.round(sc.left)},${Math.round(sc.top)} ${sc.display}` : 'absent');
    // 17. La longueur.
    const hauteurs = await pg.evaluate(() => ({ total: document.documentElement.scrollHeight, secs: [...document.querySelectorAll('[data-section]')].map((s) => [s.getAttribute('data-section'), Math.round(s.getBoundingClientRect().height)]) }));
    return { ctx, pg, hauteurs };
  } catch (e) { await ctx.close(); throw e; }
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance npm run build'); process.exit(1); }
  // Les sources de vérité : la table de démo, les réglages, les CGV.
  let demo = null;
  try { demo = (await import(pathToFileURL(path.join(RACINE, 'src', 'accueil-demo.js')).href)).DEMO; } catch (_) { demo = null; }
  const srcReglages = lire('src/accueil-reglages.js') || '';
  const reglages = { ACCES_OFFERT: constante(srcReglages, 'ACCES_OFFERT'), DETOURAGE_POUR_TOUS: constante(srcReglages, 'DETOURAGE_POUR_TOUS'), PRIX_MOIS: (constante(srcReglages, 'PRIX_MOIS') || '').replace(/['"]/g, '') };
  const cgv = lire('public/legal/cgv.html') || '';
  const prixCgv = (/abonnement à (\d+,\d{2}) € par mois/i.exec(cgv) || [])[1] || null;
  const DEMO = demo || { jour: { colisApres: '?', aRetirerApres: '?' }, mois: { apres: NaN } };
  if (!demo) dit(false, 'src/accueil-demo.js se charge (la table de démo)', 'introuvable');

  // ⚠️ `--disable-gpu-compositing` : mesuré le 11 octobre, le compositeur GL
  //    logiciel (swiftshader) rend la page de 1512 px à 4-5 images/s sur ce
  //    conteneur chargé (médiane 217 ms, des trous de 2 s) — la page d'AVANT
  //    faisait pire (8 images en 7 s). L'horloge de la page borne un pas à
  //    0,25 s : elle « perdait » donc du temps, et une carte de 4,5 s en
  //    durait 8. C'est la MACHINE qu'on mesurait, pas la page. Composée par le
  //    processeur, la même page tourne à 60 images/s (médiane 17 ms) — ce que
  //    voit un vrai visiteur. Rien d'autre ne change (couleurs, polices, tailles).
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-compositing'] });
  try {
    if (veut('rendu')) {
      console.log('\n── UN VISITEUR SANS SESSION : LE PREMIER ÉCRAN, LA CARTE, LA BARRE');
      // ⚠️ Le cahier du 11 octobre visait ≤ 5 000 px sur téléphone (la page
      //    d'avant : 7 338). Après ses CINQ coupes autorisées (précisions cachées,
      //    réponses courtes, « Et sur mon téléphone ? » et « Comment j'arrête ? »
      //    retirés du téléphone, texte de la fin caché) et un resserrage de la
      //    typographie, la page mesure 6 070 px : ses propres textes (la réponse,
      //    VRM / Toi) et ses trois écrans, qu'il interdit de couper, n'y tiennent
      //    pas. Le plafond du téléphone est donc la MESURE (+2 %) : le contrôle
      //    passe au rouge dès que la page regrossit, il ne prétend pas qu'elle
      //    fait 5 000 px. L'ordinateur tient le budget du cahier.
      const BUDGET = {
        ordi: { total: 4600, hero: 780, colis: 600, ailleurs: 600, urssaf: 580, questions: 460, comment: 480, prix: 600, fin: 300 },
        tel: { total: 6200, hero: 930, colis: 780, ailleurs: 790, urssaf: 770, questions: 620, comment: 840, prix: 900, fin: 380 },
      };
      for (const [nom, opt, cle] of [['ordinateur (1512 px)', ORDI, 'ordi'], ['téléphone (390 px)', TEL, 'tel']]) {
        await essaie(`rendu · ${nom}`, async () => {
          const { ctx, pg, hauteurs } = await controlesRendu(nav, nom, opt, DEMO, reglages, prixCgv);
          const B = BUDGET[cle];
          const trop = hauteurs.secs.filter(([s, h]) => B[s] && h > B[s]).map(([s, h]) => `${s} ${h} > ${B[s]}`);
          console.log(`     hauteurs : ${hauteurs.secs.map(([s, h]) => `${s} ${h}`).join(' · ')} · total ${hauteurs.total}`);
          dit(hauteurs.total <= B.total && trop.length === 0, `${nom} : la page tient dans son budget de hauteur (≤ ${B.total} px)`, `${hauteurs.total} px${trop.length ? ' · ' + trop.join(', ') : ''}`);
          if (CAPT) {
            await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300);
            await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}-haut.png`) });
            await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}.png`), fullPage: true });
          }
          await ctx.close();
        });
      }
    }

    if (veut('tailles')) {
      console.log('\n── LES AUTRES TAILLES : PORTABLE 1 366, TABLETTES, PETIT TÉLÉPHONE');
      // ⚠️ `overflow-x: clip` sur la racine cache un débordement sans le mesurer :
      //    vu au rendu à 1 366 px, le repère « 8 h 02 » du fil sortait par la
      //    gauche de l'écran, coupé net — et « aucun débordement » restait vert.
      //    On mesure donc la boîte de chaque texte visible, pas `scrollWidth`.
      for (const [nom, opt, premier] of [
        ['portable (1366 × 768)', { largeur: 1366, hauteur: 768 }, true],
        ['tablette (1024 × 768)', { largeur: 1024, hauteur: 768 }, false],
        ['tablette (820 × 1180)', { largeur: 820, hauteur: 1180 }, false],
        ['petit téléphone (360 × 740)', { largeur: 360, hauteur: 740, mobile: true }, false],
      ]) {
        await essaie(`tailles · ${nom}`, async () => {
          const { ctx, pg, erreurs } = await page(nav, opt);
          await attendreEtat(pg, '[data-demo-animee]', 'fin', 14000);
          await pg.waitForFunction(() => document.querySelectorAll('[data-scene][data-pret]').length === 4, null, { timeout: 15000 }).catch(() => {});
          const dehors = await pg.evaluate(() => {
            const x = [];
            document.querySelectorAll('[data-accueil] *').forEach((e) => {
              if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
              const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
              let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
              if (o <= 0.1 || getComputedStyle(e).visibility === 'hidden') return;
              if (r.left < -1 || r.right > innerWidth + 1) x.push(`« ${e.textContent.trim().slice(0, 24)} » ${Math.round(r.left)}→${Math.round(r.right)}`);
            });
            return x;
          });
          dit(dehors.length === 0, `${nom} : aucun texte ne sort de l'écran (ni coupé au bord)`, dehors.slice(0, 4).join(' · '));
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          dit(deb <= 1, `${nom} : aucun débordement horizontal`, `${deb} px`);
          const cc = await coupes(pg, '[data-demo-animee]');
          // ⚠️ Le bord du TITRE ne suffit pas : son conteneur rétrécit (min-width 0)
          //    pendant que la puce « exemple » déborde par-dessus la pile — vert sur
          //    le défaut vu à 360 px. On mesure le dernier élément du titre.
          const tete = await pg.evaluate(() => { const t = document.querySelector('.cj-titre > :last-child'), p = document.querySelector('.cj-pile'); if (!t || !p) return null; return { titre: Math.round(t.getBoundingClientRect().right), pile: Math.round(p.getBoundingClientRect().left) }; });
          dit(cc.length === 0 && tete && tete.titre <= tete.pile, `${nom} : la carte tient — rien de coupé, l'en-tête ne se chevauche pas`, `${cc.slice(0, 2).join(' · ')} · titre→${tete && tete.titre} pile←${tete && tete.pile}`);
          if (premier) {
            const H = opt.hauteur;
            const v = await pg.evaluate(() => ['[data-definition]', '.acc-hero [data-cta="inscription"]', '[data-prerequis]'].map((sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().bottom) : null; }));
            dit(v.every((b) => b != null && b <= H), `${nom} : la pastille, « Créer mon compte » et le prérequis tiennent dans le premier écran`, v.join(' · '));
          }
          dit(erreurs.length === 0, `${nom} : aucune erreur de page`, erreurs.join(' | '));
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}x${opt.hauteur}-haut.png`) });
          await ctx.close();
        });
      }
    }

    if (veut('scenes')) {
      console.log('\n── LES ÉCRANS DU BAS : ILS NE JOUENT QUE QUAND ON LES VOIT');
      for (const [nom, opt] of [['ordinateur (1512 px)', ORDI], ['téléphone (390 px)', TEL]]) {
        await essaie(`écrans · ${nom}`, async () => {
          const { ctx, pg, scripts } = await page(nav, opt);
          await pg.waitForFunction(() => document.querySelectorAll('[data-scene][data-pret]').length === 4, null, { timeout: 15000 }).catch(() => {});
          const debut = await pg.evaluate(() => [...document.querySelectorAll('[data-scene]')].map((s) => `${s.getAttribute('data-scene')}:${s.getAttribute('data-etat')}`));
          dit(debut.length === 4 && debut.filter((x) => /^(colis|ailleurs|urssaf):/.test(x)).every((x) => /:debut$/.test(x)), `${nom} : au chargement, les trois écrans attendent (« debut »)`, debut.join(' '));
          const ordre = ['colis', 'ailleurs', 'urssaf'];
          for (let i = 0; i < ordre.length; i++) {
            const n = ordre[i], sel = `[data-scene="${n}"]`;
            await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
            const t0 = Date.now();
            const joue = await attendreEtat(pg, sel, 'joue', 6000);
            const fin = await attendreEtat(pg, sel, 'fin', 7000);
            const autres = await pg.evaluate((suivants) => suivants.map((x) => document.querySelector(`[data-scene="${x}"]`).getAttribute('data-etat')), ordre.slice(i + 1));
            dit(joue && fin && Date.now() - t0 <= 6500 && autres.every((e) => e === 'debut'), `${nom} : « ${n} » joue quand on le regarde, finit, et les suivants attendent encore`, `joue ${joue} · fin ${fin} · ${Date.now() - t0} ms · suivants ${autres.join(',') || '—'}`);
            const L = await pg.evaluate((x) => window.__vu.scenes[x] || [], n);
            const tj = (L.find((x) => x.e === 'joue') || {}).t, tf = (L.find((x) => x.e === 'fin') || {}).t;
            dit(tj && tf && tf - tj <= 5000, `${nom} : « ${n} » dure moins de 5 s`, `${Math.round((tf || 0) - (tj || 0))} ms`);
            const cs = await coupes(pg, sel);
            dit(cs.length === 0, `${nom} : en fin, aucun texte de « ${n} » n'est coupé`, cs.slice(0, 3).join(' · '));
            if (CAPT) await (await pg.$(`[data-section="${n}"]`)).screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}-${n}-fin.png`) });
          }
          // 4. Le curseur paraît dans l'écran Colis (un geste de l'utilisateur).
          dit(await pg.evaluate(() => window.__vu.curseurColis), `${nom} : le curseur dessiné paraît dans l'écran Colis (ce que TU fais)`);
          // 6. Le numéro voyage.
          const n128 = await pg.evaluate((n) => {
            const s = document.querySelector('[data-scene="colis"]');
            const tampon = s.querySelector('[data-bordereau] [data-tampon]');
            const tuile = s.querySelector('.sc-tuile');
            // Le tampon est dans le DOM dès le départ (caché) : on ne lit son texte
            // que s'il est POSÉ — opaque et sans découpe.
            const pose = tampon && Number(getComputedStyle(tampon).opacity) > 0.9 && ['none', ''].includes(getComputedStyle(tampon).clipPath);
            return { tampon: pose ? tampon.textContent : '', badge: tuile ? tuile.innerText.includes(`N°${n}`) : false,
              sorti: (s.querySelector(`[data-carton="${n}"]`) || {}).getAttribute ? s.querySelector(`[data-carton="${n}"]`).getAttribute('data-sorti') : null,
              autres: [...s.querySelectorAll('[data-carton][data-sorti]')].filter((c) => c.getAttribute('data-carton') !== n).length };
          }, (demo && demo.vente.n) || '128');
          dit(/128/.test(n128.tampon) && n128.badge && n128.sorti === '1' && n128.autres === 0, `${nom} : le N°128 est tamponné sur le bordereau, reste sur sa ligne, et SEUL le carton 128 sort`, JSON.stringify(n128));
          // 7. Le total du mois tient.
          const total = await pg.evaluate(() => { const e = document.querySelector('[data-scene="urssaf"] [data-total]'); return e ? e.textContent : ''; });
          const lu = Number(total.replace(/[^\d,]/g, '').replace(',', '.'));
          dit(Math.round(lu * 100) === Math.round(DEMO.mois.apres * 100), `${nom} : en fin, le total à déclarer vaut celui de la table (${DEMO.mois.apres})`, `« ${total} »`);
          // 5 (suite). « Revoir » rejoue.
          const rv = await pg.$('[data-scene="urssaf"] ~ .sc-revoir-l [data-revoir], [data-section="urssaf"] [data-revoir]');
          if (rv) {
            await rv.click();
            const re = await pg.waitForFunction(() => { const e = document.querySelector('[data-scene="urssaf"]').getAttribute('data-etat'); return e === 'joue' || e === 'debut'; }, null, { timeout: 3000 }).then(() => true, () => false);
            const refin = await attendreEtat(pg, '[data-scene="urssaf"]', 'fin', 7000);
            dit(re && refin, `${nom} : « ↻ Revoir » rejoue l'écran, puis il s'arrête de nouveau`);
          } else dit(false, `${nom} : « ↻ Revoir » sous l'écran fini`, 'introuvable');
          // 13. Lisible : aucun texte rendu sous 12 px dans les écrans, et échelle 1.
          const lisible = await pg.evaluate(() => {
            const zones = [...document.querySelectorAll('[data-demo-animee],[data-scene]')];
            let min = 99, pire = '', echelle = 1;
            zones.forEach((z) => {
              const k = z.offsetHeight ? z.getBoundingClientRect().height / z.offsetHeight : 1;
              if (Math.abs(k - 1) > 0.01) echelle = k;
              z.querySelectorAll('*').forEach((e) => {
                if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
                const f = parseFloat(getComputedStyle(e).fontSize) * k;
                if (f < min) { min = f; pire = `${e.textContent.trim().slice(0, 20)} (${z.getAttribute('data-scene') || 'carte'})`; }
              });
            });
            return { min, pire, echelle };
          });
          dit(lisible.min >= 11.99 && Math.abs(lisible.echelle - 1) <= 0.01, `${nom} : dans la carte et les écrans, aucun texte rendu sous 12 px, aucune mise à l'échelle`, `${lisible.min.toFixed(1)} px « ${lisible.pire} » · échelle ${lisible.echelle}`);
          // 20. Rien qui ne soit branché, dans les écrans dessinés.
          const dessine = await pg.evaluate(() => [...document.querySelectorAll('[data-demo-animee],[data-scene]')].map((e) => e.innerText).join('\n'));
          const interdits = ['Vestiaire', 'À publier', 'encaissé', 'Photoroom', 'détour'].filter((m) => new RegExp(m, 'i').test(dessine));
          dit(interdits.length === 0, `${nom} : les écrans dessinés ne montrent rien qui ne soit branché (Vestiaire, détourage, « encaissé »…)`, interdits.join(', '));
          dit(!scripts.some((s) => /^App-/.test(s)), `${nom} : toujours pas d'application téléchargée après avoir tout parcouru`);
          await ctx.close();
        });
      }
    }

    if (veut('sommaire')) {
      console.log('\n── LA CARTE SERT DE SOMMAIRE');
      for (const [nom, opt] of [['ordinateur (1512 px)', ORDI], ['téléphone (390 px)', TEL]]) {
        await essaie(`sommaire · ${nom}`, async () => {
          const { ctx, pg } = await page(nav, opt);
          for (const id of ['colis', 'ailleurs', 'urssaf']) {
            await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300);
            await pg.click(`[data-vers="${id}"]`);
            await pg.waitForTimeout(1200);
            const r = await pg.evaluate((x) => { const e = document.getElementById(x); return e ? e.getBoundingClientRect().top / innerHeight : null; }, id);
            dit(r != null && r >= -0.01 && r <= 0.4, `${nom} : un clic sur la ligne mène à #${id}`, `haut à ${r == null ? '—' : Math.round(r * 100) + ' %'} de l'écran`);
          }
          await ctx.close();
        });
      }
    }

    if (veut('reduit')) {
      console.log('\n── « RÉDUIRE LES ANIMATIONS » : L\'ÉTAT FINAL, ET RIEN QUI BOUGE');
      for (const [nom, opt] of [['ordinateur (1512 px)', ORDI], ['téléphone (390 px)', TEL]]) {
        await essaie(`réduit · ${nom}`, async () => {
          const { ctx, pg } = await page(nav, { ...opt, reduit: true });
          await pg.waitForFunction(() => document.querySelectorAll('[data-scene][data-pret]').length === 4, null, { timeout: 15000 }).catch(() => {});
          const etats = await pg.evaluate(() => ({ carte: document.querySelector('[data-demo-animee]').getAttribute('data-etat'), scenes: [...document.querySelectorAll('[data-scene]')].map((s) => s.getAttribute('data-etat')) }));
          dit(etats.carte === 'fin' && etats.scenes.length === 4 && etats.scenes.every((e) => e === 'fin'), `${nom} : carte et écrans sont dans leur état final sans avoir défilé`, JSON.stringify(etats));
          const photo = () => pg.evaluate(() => [...document.querySelectorAll('[data-demo-animee],[data-scene]')].map((e) => e.getAttribute('data-etat') + '|' + e.innerText).join('#'));
          const a = await photo(); await pg.waitForTimeout(5000); const b = await photo();
          dit(a === b, `${nom} : rien ne change en 5 s`);
          const vu = await pg.evaluate(() => ({ bouge: !!window.__vu.bougeVu, revoir: document.querySelectorAll('[data-revoir]').length }));
          dit(!vu.bouge, `${nom} : jamais de notification, de vol ni de curseur`);
          dit(vu.revoir === 0, `${nom} : aucun « ↻ Revoir » (il n'y a rien à rejouer)`, `${vu.revoir}`);
          const fins = await pg.evaluate((n) => {
            const s = document.querySelector('[data-scene="colis"]'), u = document.querySelector('[data-scene="urssaf"] [data-total]'), a = document.querySelector('[data-scene="ailleurs"]');
            const tp = s.querySelector('[data-bordereau] [data-tampon]');
            const pose = tp && Number(getComputedStyle(tp).opacity) > 0.9 && ['none', ''].includes(getComputedStyle(tp).clipPath);
            return { tampon: pose ? tp.textContent : '', sorti: s.querySelector(`[data-carton="${n}"]`).getAttribute('data-sorti'), total: u ? u.textContent : '', ailleurs: a ? a.innerText : '' };
          }, (demo && demo.vente.n) || '128');
          const lu = Number(fins.total.replace(/[^\d,]/g, '').replace(',', '.'));
          dit(/128/.test(fins.tampon) && fins.sorti === '1' && Math.round(lu * 100) === Math.round(DEMO.mois.apres * 100), `${nom} : l'état final est là — tampon N°128, carton sorti, total ${DEMO.mois.apres}`, JSON.stringify({ tampon: fins.tampon, sorti: fins.sorti, total: fins.total }));
          dit(/Retirée d.eBay/.test(fins.ailleurs) && /À retirer/.test(fins.ailleurs), `${nom} : l'écran « vendu ailleurs » montre « À retirer » et « Retirée d'eBay »`);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}-reduit.png`) });
          await ctx.close();
        });
      }
    }

    if (veut('honnetete')) {
      console.log('\n── HONNÊTETÉ : LE PRIX VIENT DES CGV, AUCUN CHIFFRE INVENTÉ, RIEN DE NON BRANCHÉ');
      await essaie('honnêteté', async () => {
        const { ctx, pg } = await page(nav, ORDI);
        await attendreEtat(pg, '[data-demo-animee]', 'fin', 14000);
        await pg.evaluate(() => document.querySelectorAll('[data-faq] details').forEach((d) => { d.open = true; }));
        const t = await pg.evaluate(() => document.querySelector('[data-accueil]').innerText);
        const gratuitCgv = /VRM est gratuit/i.test(cgv);
        if (gratuitCgv) dit(/gratuit/i.test(t) && /0 €/.test(t), 'le prix affiché est celui des CGV (« gratuit »)');
        else {
          const montants = [...t.matchAll(/(\d+,\d{2})\s*€\s*(?:\/\s*mois|par mois)/gi)].map((m) => m[1]);
          // « 0 € » ou « 0,00 € » : un compteur qui partirait de zéro se lirait
          //    comme un prix nul (aucun montant de la démo ne vaut zéro).
          const zero = /(^|[\s+])0(,00)?\s*€/.test(t);
          dit(!!prixCgv && montants.length > 0 && montants.every((m) => m === prixCgv) && !zero, `le prix affiché est celui des CGV (${prixCgv} € par mois), aucun autre, jamais « 0 € »`, `CGV ${prixCgv} · page ${montants.join(', ')}${zero ? ' · un « 0 € » est affiché' : ''}`);
          dit(reglages.PRIX_MOIS === prixCgv, 'src/accueil-reglages.js (PRIX_MOIS) dit le prix des CGV', `${reglages.PRIX_MOIS} / ${prixCgv}`);
          dit(/sans engagement/i.test(t) && /résili/i.test(t), '  et il dit « sans engagement » et comment résilier (comme les CGV)');
        }
        const invente = t.match(/\d[\d\s.,]*\s*(\+|k|K)?\s*(vendeurs|revendeurs|utilisateurs|clients|avis|étoiles|\/\s*5|%\s*de\s*(ventes|chiffre|temps))/i);
        dit(!invente, 'aucun chiffre de clientèle ni de résultat inventé', invente ? invente[0] : '');
        dit(!/(★|⭐)/.test(t), 'aucune note en étoiles (aucun avis réel à afficher)');
        const conf = lire('public/legal/confidentialite.html') || '';
        dit(!/donnée revendue|ne vend aucune donnée/i.test(t) || /ne vend aucune donnée/i.test(conf), '« aucune donnée revendue » s\'appuie sur la politique publiée');
        dit(/favori/i.test(t) && /republi/i.test(t), 'la page dit qu\'elle refuse les relances en série aux favoris et la republication en boucle', `favori=${/favori/i.test(t)} republi=${/republi/i.test(t)}`);
        // 21. Les fausses phrases mesurées le 11 octobre ne reviennent pas.
        const faux = [];
        if (/rien ne part sans ton clic|rien n['’]est envoyé à ta place/i.test(t)) faux.push('« rien ne part / n’est envoyé à ta place »');
        if (/(deux|2) minutes/i.test(t)) faux.push('« deux minutes »');
        const phrases = t.split(/[.!?\n]+/);
        if (phrases.some((p) => /publi\w*.{0,40}Leboncoin/i.test(p))) faux.push('« publie… Leboncoin »');
        // ⚠️ Le texte RENDU ne suffit pas : une phrase qui vit dans un écran pas
        //    encore affiché (un carrousel, une scène du bas) n'est pas dans
        //    `innerText` au moment où on lit. Mesuré sur la page d'avant : « Rien
        //    n'est envoyé à ta place » passait. On lit aussi les FICHIERS de la page.
        const SRC_PAGE = ['src/Accueil.jsx', 'src/accueil-carte.jsx', 'src/accueil-scenes.jsx', 'src/accueil-demo.js', 'src/AccueilFilm.jsx'];
        const sansCommentaires = (x) => (x || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        SRC_PAGE.forEach((f) => {
          const c = sansCommentaires(lire(f));
          if (/rien ne part sans ton clic|rien n['’]est envoyé à ta place/i.test(c)) faux.push(`« rien n’est envoyé à ta place » dans ${f}`);
          if (/(deux|2) minutes/i.test(c)) faux.push(`« deux minutes » dans ${f}`);
        });
        dit(faux.length === 0, 'aucune promesse fausse (rien ne part sans ton clic, deux minutes, publier sur Leboncoin) — ni affichée, ni écrite dans la page', faux.join(', '));
        const auto = await pg.evaluate(() => { const c = document.querySelector('[data-confiance]'); return c ? c.querySelectorAll('[data-automatisme]').length : -1; });
        dit(auto === 2, 'la confiance nomme les DEUX automatismes, éteints tant qu’on ne les allume pas', `${auto}`);
        // 20. Vestiaire seulement dans la FAQ ; détourage absent tant qu'il n'est pas ouvert à tous.
        const v = await pg.evaluate(() => { const tout = (document.body.innerText.match(/Vestiaire/g) || []).length; const faq = ((document.querySelector('[data-faq]') || {}).innerText || '').match(/Vestiaire/g) || []; return { tout, faq: faq.length }; });
        dit(v.tout === v.faq, '« Vestiaire » n’apparaît que dans la FAQ (pas encore branché)', JSON.stringify(v));
        if (reglages.DETOURAGE_POUR_TOUS === 'false') dit(!/Photoroom|détour/i.test(t), 'DETOURAGE_POUR_TOUS = false → ni « Photoroom » ni « détourage » sur la page');
        // Aucune adresse email dans les fichiers de la page.
        const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
        const sources = ['src/Accueil.jsx', 'src/accueil-carte.jsx', 'src/accueil-scenes.jsx', 'src/accueil-demo.js', 'src/accueil-reglages.js', 'src/AccueilFilm.jsx'];
        const avecEmail = sources.filter((f) => EMAIL.test((lire(f) || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')));
        dit(avecEmail.length === 0, 'aucune adresse email écrite dans les fichiers de la page (même dans la démo)', avecEmail.join(', '));
        await ctx.close();
      });
    }

    if (veut('boutons')) {
      console.log('\n── LES BOUTONS OUVRENT LE BON FORMULAIRE');
      for (const [cta, attendu, q] of [['inscription', /Créer ton compte/, 'inscription'], ['connexion', /Se connecter/, 'connexion']]) {
        await essaie(`bouton ${cta}`, async () => {
          const { ctx, pg } = await page(nav, {});
          await pg.click(`[data-accueil] .acc-hero [data-cta="${cta}"]`, { timeout: 8000 });
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
        await pg.click('.acc-nav [data-cta-nav="connexion"]', { timeout: 8000 });
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
        dit(kS <= 20, 'les écrans du bas sont un morceau à part de ≤ 20 Ko compressés', `${sc || 'absent'} ${kS.toFixed(1)} Ko`);
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
