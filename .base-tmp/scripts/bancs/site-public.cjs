require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE SITE PUBLIC » (15 nov., lot site-public) — ce que voit un visiteur NON connecté,
//  au niveau d'un vrai site de logiciel (Julien : « améliore tout le site, là il est pas ouf »).
//  Ce banc juge le RENDU (positions, nombres, attributs), jamais une formulation :
//   P1 le PREMIER ÉCRAN, sans défiler (390 × 844 tactile et 1512 × 900, clair et sombre) : le h1
//      (les ventes, Vinted), une VRAIE capture de l'app (au registre du mode exemple) chargée et
//      visible sur au moins 160 px, UN SEUL bouton plein à l'écran (« Essayer gratuitement »), la
//      touche « Découvrir avec des exemples » (vrai lien /?exemple, 44 px), le prix et le prérequis ;
//   P2 aucun débordement horizontal (320, 390, 768, 1024, 1512) ;
//   P3 AUCUN FAUX : ni « +N vendeurs/utilisateurs/clients », ni avis, ni étoiles, ni note sur 5, ni
//      témoignage, ni logo de presse, ni « partenaire officiel » / affiliation affirmée ; la
//      non-affiliation est dite en pied ; les marques des plateformes ne sont que des pictogrammes
//      monochromes servis par VRM (public/brands/, fabriqués depuis src/plateformes/marques.js) ;
//   P4 le partage : titre, description, canonical, Open Graph et Twitter, image 1200 × 630 qui est
//      au registre (scripts/accueil-og.cjs), manifeste aux couleurs du studio ;
//   P5 le poids : tout ce qui est transféré avant de défiler (390, serveur SANS compression) ;
//   P6 la suite de l'adresse (`?utm_source=…&ref=…`) passe INTACTE jusqu'à l'inscription
//      (src/accueil/lienEntree.js exécuté, puis les liens rendus, puis le clic) ;
//   P7 chaque image a un texte alternatif (ou est décorative), largeur et hauteur fixées ; seules
//      les images du premier écran sont « eager » ;
//   P8 l'écran de connexion : e-mail + mot de passe d'abord, un fournisseur (Google/Discord) n'est
//      montré que s'il est ACTIVÉ chez Supabase, et SOUS le formulaire ; aucun « recevoir un code »
//      mis en avant ; liens légaux présents ; 44 px ; rien ne déborde.
//  CAPTURES=dossier : premier écran et page entière (390 et 1512, clair et sombre) — à REGARDER (§6.2).
//  BANC_DIST=chemin d'un autre build (preuve sur le code d'avant). BANC_PORT=… (défaut aléatoire).
//  ⚠️ AUCUNE FIXTURE : une page publique ne lit aucune donnée.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || (14000 + Math.floor(Math.random() * 4000));
const CAPT = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
const POIDS_MAX_KO = 520;   // avant de défiler, 390 px, NON compressé (Vercel compresse : ~1/3 pour le JS et le CSS)

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return null; } };

const REECRIT = (() => { try { return (JSON.parse(lire('vercel.json')).rewrites || []).filter((r) => !/^\/api\//.test(r.source)); } catch (_) { return []; } })();
const fichierDe = (url) => {
  const p = url.split('?')[0].split('#')[0];
  for (const r of REECRIT) { const m = new RegExp('^' + r.source + '$').exec(p); if (m) return r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)]); }
  return p;
};
const srv = http.createServer((q, r) => {
  let f = fichierDe(q.url);
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

const TEL = { largeur: 390, hauteur: 844, mobile: true }, ORDI = { largeur: 1512, hauteur: 900 };
async function ouvrir(nav, { largeur, hauteur, mobile = false, sombre = false, url = '/', auth = null }) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'fr-FR' });
  const lectures = [];
  // ⚠️ Playwright essaie la DERNIÈRE route posée en premier (§6.6) : la coupure d'Internet d'abord, la base ensuite.
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
  await ctx.route(/supabase\.co|\/api\//, (rt) => {
    const u = rt.request().url();
    if (auth && /\/auth\/v1\/settings/.test(u)) return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth) });
    lectures.push(u); return rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const pg = await ctx.newPage();
  const octets = { n: 0, liste: [] };
  pg.on('response', async (rs) => { try { const b = await rs.body(); octets.n += b.length; octets.liste.push([rs.url().replace(/^https?:\/\/[^/]+/, ''), b.length]); } catch (_) {} });
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => { const r = document.getElementById('root'); return r && r.innerText.trim().length > 40; }, null, { timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(900);
  return { ctx, pg, octets, erreurs, lectures };
}

async function premierEcran(nav, nom, opt, registre) {
  const { ctx, pg, octets, erreurs, lectures } = await ouvrir(nav, opt);
  try {
    const H = opt.hauteur;
    await pg.waitForFunction(() => { const i = document.querySelector('[data-scene-haut] picture[data-capture="journee"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
    const v = await pg.evaluate((H) => {
      const vis = (e) => { if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { top: r.top, bottom: r.bottom, h: r.height, w: r.width, op: Number(cs.opacity), d: cs.display, vis: cs.visibility }; };
      const h1 = document.querySelector('[data-accueil] h1');
      const caps = [...document.querySelectorAll('[data-scene-haut] picture[data-capture] img')].map((i) => {
        const r = i.getBoundingClientRect();
        return { nom: i.closest('picture').getAttribute('data-capture'), src: (i.currentSrc || i.src).split('/').pop(), charge: i.complete && i.naturalWidth > 0, visible: Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)), w: r.width, alt: i.getAttribute('alt') || '' };
      }).filter((c) => c.w > 0);
      // « plein » = un fond opaque qui TRANCHE sur le fond de la page (l'encre sur le bleu clair, la porcelaine
      // claire sur le bleu-nuit) ; une touche en porcelaine reste proche du fond. On lit les couleurs rendues.
      const lumDe = (s) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(s || ''); if (!m) return null; return { l: (Number(m[1]) * 0.2126 + Number(m[2]) * 0.7152 + Number(m[3]) * 0.0722) / 255, a: m[4] == null ? 1 : Number(m[4]) }; };
      const page = lumDe(getComputedStyle(document.querySelector('[data-accueil]')).backgroundColor) || { l: 1 };
      const pleins = [...document.querySelectorAll('[data-accueil] a, [data-accueil] button')].filter((b) => {
        const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        if (!r.width || !r.height || r.bottom <= 0 || r.top >= H || Number(cs.opacity) < 0.5 || cs.visibility === 'hidden') return false;
        const f = lumDe(cs.backgroundColor); if (!f || f.a < 0.9) return false;
        return Math.abs(f.l - page.l) > 0.5;
      }).map((b) => (b.getAttribute('data-cta') || b.getAttribute('data-cta-nav') || b.innerText.trim()).slice(0, 30));
      const ex = document.querySelector('[data-section="hero"] [data-cta="exemple"]');
      return { h1: h1 ? { ...vis(h1), t: h1.innerText } : null, sous: (document.querySelector('[data-section="hero"]') || {}).innerText || '', caps, pleins, ex: ex ? { ...vis(ex), href: ex.getAttribute('href'), t: ex.innerText.trim() } : null,
        prix: vis(document.querySelector('[data-prix-ligne]')), prereq: vis(document.querySelector('[data-prerequis]')), cta: vis(document.querySelector('[data-section="hero"] [data-cta="inscription"]')) };
    }, H);
    dit(!!v.h1 && v.h1.bottom <= H && /ventes/i.test(v.h1.t) && /Vinted/.test(v.h1.t), `${nom} P1 le h1 (tes ventes Vinted…) est dans le premier écran`, v.h1 ? `${v.h1.t} · bas ${Math.round(v.h1.bottom)}` : 'absent');
    dit(/colis/i.test(v.sous) && /compta/i.test(v.sous) && /retrait/i.test(v.sous) && /rangement/i.test(v.sous), `${nom} P1 le haut de page dit numéros de rangement, colis, retraits, compta`);
    const vraie = v.caps.filter((c) => c.charge && c.visible >= 160 && registre[c.src] && registre[c.src].modeExemple === true);
    dit(vraie.length >= 1, `${nom} P1 une VRAIE capture de l'app (registre du mode exemple), chargée, visible sur ≥ 160 px sans défiler`, JSON.stringify(v.caps.map((c) => [c.src, Math.round(c.visible), c.charge, !!registre[c.src]])));
    dit(v.caps.every((c) => /exemple/i.test(c.alt)), `${nom} P1 chaque capture du haut dit « données d'exemple » (texte alternatif)`);
    dit(v.pleins.length === 1 && v.pleins[0] === 'inscription', `${nom} P1 UN seul bouton plein à l'écran : « Essayer gratuitement »`, JSON.stringify(v.pleins));
    dit(!!v.cta && v.cta.top >= 0 && v.cta.bottom <= H && v.cta.h >= 43.5, `${nom} P1 « Essayer gratuitement » dans le premier écran, 44 px`, v.cta ? `${Math.round(v.cta.top)}–${Math.round(v.cta.bottom)}` : 'absent');
    dit(!!v.ex && v.ex.href === '/?exemple' && v.ex.bottom <= H && v.ex.h >= 43.5 && v.ex.t === 'Découvrir avec des exemples', `${nom} P1 « Découvrir avec des exemples » : vrai lien, premier écran, 44 px`, JSON.stringify(v.ex));
    dit(!!v.prix && v.prix.bottom <= H && !!v.prereq && v.prereq.bottom <= H, `${nom} P1 le prix et le prérequis (l'ordinateur) restent dans le premier écran`, `prix ${v.prix && Math.round(v.prix.bottom)} · prérequis ${v.prereq && Math.round(v.prereq.bottom)}`);
    if (opt.mobile && !opt.sombre) {
      const ko_ = octets.n / 1024;
      console.log(`     avant de défiler : ${Math.round(ko_)} Ko transférés (non compressés) — ${octets.liste.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([u, n]) => `${u.split('/').pop()} ${Math.round(n / 1024)}`).join(' · ')}`);
      dit(ko_ > 0 && ko_ <= POIDS_MAX_KO, `${nom} P5 avant de défiler, ≤ ${POIDS_MAX_KO} Ko transférés (serveur sans compression)`, `${Math.round(ko_)} Ko`);
      const lazy = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] img')].map((i) => ({ src: (i.getAttribute('src') || '').split('/').pop(), alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.getAttribute('loading'), haut: !!i.closest('[data-section="hero"], .av-nav') })));
      const sansAlt = lazy.filter((i) => i.alt == null), sansTaille = lazy.filter((i) => !i.w || !i.h), eager = lazy.filter((i) => !i.haut && i.lazy !== 'lazy');
      dit(sansAlt.length === 0 && sansTaille.length === 0 && eager.length === 0, 'P7 chaque image : un texte alternatif (vide = décor), largeur et hauteur fixées, « lazy » hors du premier écran', JSON.stringify({ sansAlt, sansTaille, eager }).slice(0, 300));
    }
    if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `site-${opt.largeur}-${opt.sombre ? 'sombre' : 'clair'}-1-premier-ecran.png`), timeout: 120000 }); }
    // On défile toute la page : chaque capture des fonctions arrive, au registre, en version du thème.
    const Ht = await pg.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Ht; y += Math.round(H * 0.7)) { await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(120); }
    await pg.waitForTimeout(1200);
    const theme = opt.sombre ? 'sombre' : 'clair';
    const tuiles = await pg.evaluate(() => [...document.querySelectorAll('[data-section="fonctions"] [data-moment]')].map((t) => { const i = t.querySelector('img'); return { id: t.getAttribute('data-moment'), src: i ? (i.currentSrc || i.src).split('/').pop() : null, ok: !!i && i.complete && i.naturalWidth > 0, h3: !!t.querySelector('h3') }; }));
    const attendues = ['numeros', 'expedier', 'colis', 'comptes', 'compta', 'extension'];
    dit(attendues.every((a) => tuiles.some((t) => t.id === a && t.h3)), `${nom} les six fonctions montrées : numéros, bordereaux, retraits, comptes et plateformes, compta, extension`, tuiles.map((t) => t.id).join(','));
    const avecImg = tuiles.filter((t) => t.id !== 'extension');
    dit(avecImg.length === 5 && avecImg.every((t) => t.ok && t.src.endsWith(`-${theme}.webp`) && registre[t.src] && registre[t.src].modeExemple === true), `${nom} chaque fonction (sauf l'extension) a SA capture réelle, chargée, au registre, version ${theme}`, JSON.stringify(avecImg.map((t) => [t.id, t.src, t.ok])));
    const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    dit(deb <= 1, `${nom} P2 aucun débordement horizontal`, `${deb} px`);
    dit(erreurs.length === 0, `${nom} aucune erreur de page`, erreurs.join(' | '));
    dit(lectures.length === 0, `${nom} la page publique ne lit rien en base`, lectures.slice(0, 2).join(' · '));
    if (CAPT) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `site-${opt.largeur}-${theme}-2-page.png`), fullPage: true, timeout: 240000 }); }
  } finally { await ctx.close(); }
}

// P3 — les motifs interdits, cherchés dans le texte RENDU (et les alt, title, aria-label).
const INTERDITS = [
  [/\+\s?\d[\d\s.,]*\s*(k\s*)?(vendeurs|revendeurs|utilisateurs|clients|membres|boutiques)/i, '« +N vendeurs »'],
  [/\b\d[\d\s.,]*\s*(k\s*)?(vendeurs|revendeurs|utilisateurs|clients|membres)\b(?! par)/i, 'un nombre de clients'],
  [/\bavis\b/i, '« avis »'],
  [/[★⭐☆]/, 'des étoiles'],
  [/\d[,.]\d\s*\/\s*5|\b\d\s*\/\s*5\b/, 'une note sur 5'],
  [/témoign|ils (nous )?font confiance|nos clients|ils en parlent|vu (à|dans) la (télé|presse)/i, 'un témoignage ou la presse'],
  [/partenaire officiel|approuvé par (Vinted|Leboncoin|eBay|Vestiaire)|certifié par|(?<!n['’]est pas )affilié à/i, 'une affiliation affirmée'],
  [/n[°º]\s?1 |numéro un|le meilleur outil|leader/i, 'un superlatif invérifiable'],
];
async function aucunFaux(nav) {
  const { ctx, pg } = await ouvrir(nav, ORDI);
  try {
    const Ht = await pg.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Ht; y += 700) { await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(60); }
    await pg.waitForTimeout(1500);
    const t = await pg.evaluate(() => {
      const r = document.querySelector('[data-accueil]');
      const attrs = [...r.querySelectorAll('[alt],[title],[aria-label]')].map((e) => [e.getAttribute('alt'), e.getAttribute('title'), e.getAttribute('aria-label')].filter(Boolean).join(' '));
      return r.innerText + '\n' + attrs.join('\n') + '\n' + document.title;
    });
    const trouves = INTERDITS.filter(([re]) => re.test(t)).map(([re, nom]) => `${nom} : « ${(t.match(re) || [''])[0]} »`);
    dit(trouves.length === 0, 'P3 aucun faux : ni nombre de clients, ni avis, ni étoiles, ni note, ni témoignage, ni presse, ni affiliation', trouves.join(' · '));
    const pied = await pg.evaluate(() => { const f = document.querySelector('[data-accueil] footer [data-affiliation]'); return f ? f.innerText : ''; });
    dit(/n[’']est pas affilié/.test(pied) && /Vinted/.test(pied) && /Leboncoin/.test(pied) && /eBay/.test(pied) && /Vestiaire/.test(pied), 'P3 la non-affiliation (Vinted, Leboncoin, eBay, Vestiaire) est dite en pied', pied);
    const logos = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('[data-accueil] img')].map((i) => i.getAttribute('src') || '');
      const masques = [...document.querySelectorAll('[data-accueil] .av-picto')].map((e) => getComputedStyle(e, '::after').maskImage || getComputedStyle(e, '::after').webkitMaskImage || '');
      return { imgs, masques };
    });
    const imgsAutorisees = logos.imgs.every((s) => /^\/(accueil\/[a-z]+-(clair|sombre)\.webp|vrm-logo-v5-(96|192)\.png)$/.test(s));
    dit(imgsAutorisees, 'P3 aucune image hors des captures du registre et du logo de VRM (aucun logo de presse ni de client)', logos.imgs.filter((s) => !/^\/(accueil|vrm-logo)/.test(s)).join(', '));
    dit(logos.masques.length >= 4 && logos.masques.every((m) => /\/brands\/(vinted|leboncoin|ebay|vestiaire)\.svg/.test(m)), 'P3 les plateformes : des pictogrammes monochromes servis par VRM (public/brands/, de src/plateformes/marques.js)', logos.masques.slice(0, 4).join(' | '));
    const marques = lire('src/plateformes/marques.js') || '';
    const svgs = ['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => lire(`public/brands/${s}.svg`) || '');
    dit(/simple-icons/i.test(marques) && svgs.every((s) => /<path/.test(s) && !/fill="#(?!000)[0-9a-f]{3,6}"/i.test(s)), 'P3 les pictogrammes viennent de la source unique des marques, sans couleur de marque');
  } finally { await ctx.close(); }
}

async function partage() {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const meta = (re) => ((re.exec(html) || [])[1] || '').trim();
  const titre = meta(/<title>([^<]*)<\/title>/), desc = meta(/<meta name="description" content="([^"]*)"/);
  dit(titre.length >= 20 && titre.length <= 70 && /^VRM\b/.test(titre) && /Vinted/.test(titre), 'P4 titre de 20 à 70 signes, qui commence par VRM et nomme Vinted', `${titre.length} · ${titre}`);
  dit(desc.length >= 80 && desc.length <= 170 && /Vinted/.test(desc) && /Leboncoin/.test(desc) && /eBay/.test(desc), 'P4 description de 80 à 170 signes, qui nomme les plateformes', `${desc.length} · ${desc}`);
  dit(/<link rel="canonical" href="https:\/\/vrm\.center\/"/.test(html), 'P4 canonical https://vrm.center/');
  const og = {}; for (const m of html.matchAll(/<meta property="og:([a-z:_]+)" content="([^"]*)"/g)) og[m[1]] = m[2];
  const tw = {}; for (const m of html.matchAll(/<meta name="twitter:([a-z:_]+)" content="([^"]*)"/g)) tw[m[1]] = m[2];
  dit(['title', 'description', 'url', 'image', 'type', 'site_name', 'locale', 'image:alt'].every((k) => og[k]) && og.title === titre, 'P4 Open Graph complet (titre = titre de la page, description, url, image et son texte, type, site, langue)', JSON.stringify(Object.keys(og)));
  dit(tw.card === 'summary_large_image' && tw.title === titre && !!tw.description && tw.image === og.image, 'P4 carte Twitter/X large, mêmes titre et image', JSON.stringify(tw));
  const f = (og.image || '').replace('https://vrm.center', '');
  const img = fs.existsSync(path.join(DIST, f)) ? fs.readFileSync(path.join(DIST, f)) : null;
  const dims = (() => { if (!img || img[0] !== 0xFF || img[1] !== 0xD8) return null; let i = 2; while (i < img.length) { if (img[i] !== 0xFF) return null; const m = img[i + 1], l = img.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC3) return { h: img.readUInt16BE(i + 5), w: img.readUInt16BE(i + 7) }; i += 2 + l; } return null; })();
  let reg = null; try { reg = JSON.parse(lire('public/og-vrm.json')); } catch (_) { reg = null; }
  dit(!!dims && dims.w === 1200 && dims.h === 630 && img.length <= 150 * 1024 && !!reg && reg.sha256 === crypto.createHash('sha256').update(img).digest('hex') && reg.modeExemple === true, 'P4 image de partage : JPEG 1200 × 630, ≤ 150 Ko, celle de scripts/accueil-og.cjs (empreinte, mode exemple)', dims ? `${dims.w}×${dims.h} ${Math.round(img.length / 1024)} Ko` : 'absente');
  let man = null; try { man = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8')); } catch (_) { man = null; }
  dit(!!man && man.theme_color === '#EEF6FD' && man.background_color === '#EEF6FD' && /Vinted/.test(man.description || ''), 'P4 manifeste aux couleurs du studio (bleu clair), description qui nomme les plateformes', man ? `${man.theme_color} ${man.background_color}` : 'illisible');
}

async function suiteAdresse(nav) {
  // Le module, EXÉCUTÉ (pur, sans dépendance).
  const src = lire('src/accueil/lienEntree.js') || '';
  let M = null;
  try { const tmp = path.join(require('os').tmpdir(), `lienEntree-${process.pid}.mjs`); fs.writeFileSync(tmp, src); M = await import('file://' + tmp); fs.unlinkSync(tmp); } catch (_) { M = null; }
  dit(!!M && M.lienEntree('inscription', '') === '/?inscription' && M.lienEntree('inscription', '?utm_source=insta&code=AB12') === '/?inscription&utm_source=insta&code=AB12'
    && M.lienEntree('connexion', '?inscription&ref=x') === '/?connexion&ref=x'
    // (15 nov.) Le lien d'un partenaire (`/p/CODE` → `/?partenaire=CODE`, branche claude/partenaires) : intact aussi.
    && M.lienEntree('inscription', '?partenaire=LEO') === '/?inscription&partenaire=LEO' && M.lienEntree('inscription', '?%E0%A4%A=1&a=b') === '/?inscription&%E0%A4%A=1&a=b',
    'P6 lienEntree : la suite passe intacte (nos seuls mots retirés, rien décodé ni réécrit)');
  const { ctx, pg } = await ouvrir(nav, { ...ORDI, url: '/?utm_source=insta&ref=AB12' });
  try {
    const hrefs = await pg.evaluate(() => [...document.querySelectorAll('[data-cta="inscription"], [data-cta-nav="inscription"], [data-cta-nav="connexion"]')].map((a) => a.getAttribute('href')));
    dit(hrefs.length >= 3 && hrefs.every((h) => /^\/\?(inscription|connexion)&utm_source=insta&ref=AB12$/.test(h)), 'P6 « Essayer gratuitement » et « Se connecter » portent la suite de l’adresse', hrefs.join(' · '));
    await pg.click('[data-section="hero"] [data-cta="inscription"]', { timeout: 15000 });
    await pg.waitForFunction(() => /Créer ton compte/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    dit(/[?&]inscription&utm_source=insta&ref=AB12$/.test(pg.url()) && /Créer ton compte/.test(await pg.evaluate(() => document.body.innerText)), 'P6 au clic, le formulaire d’inscription s’ouvre ET l’adresse garde la suite', pg.url());
  } finally { await ctx.close(); }
}

async function connexion(nav, opt, nom) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { ...opt, url: '/?connexion', auth: { external: { discord: true, google: false, email: true }, mailer_autoconfirm: false } });
  try {
    await pg.waitForSelector('[data-connexion] form', { timeout: 45000 }).catch(() => {});
    await pg.waitForFunction(() => [...document.querySelectorAll('[data-connexion] button')].some((b) => /Discord/.test(b.innerText)), null, { timeout: 20000 }).catch(() => {});
    const v = await pg.evaluate(() => {
      const y = (e) => (e ? e.getBoundingClientRect().top + window.scrollY : null);
      const email = document.querySelector('[data-connexion] input[type="email"]');
      const mdp = document.querySelector('[data-connexion] input[type="password"]');
      const valider = document.querySelector('[data-connexion] [data-auth-valider]');
      const fournisseurs = [...document.querySelectorAll('[data-connexion] button')].filter((b) => /Google|Discord|Apple/.test(b.innerText)).map((b) => ({ t: b.innerText.trim(), y: y(b), h: b.getBoundingClientRect().height }));
      const texte = document.querySelector('[data-connexion]').innerText;
      const legaux = [...document.querySelectorAll('[data-connexion] a[href^="/legal/"], [data-connexion] a[href="/confiance"]')].map((a) => a.getAttribute('href'));
      const petits = [...document.querySelectorAll('[data-connexion] a, [data-connexion] button, [data-connexion] summary, [data-connexion] input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[data-cx-qr] > div'); }).map((e) => `${(e.innerText || e.getAttribute('aria-label') || e.type || '').trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().height)}`);
      return { email: y(email), mdp: y(mdp), valider: y(valider), fournisseurs, texte, legaux, petits, deb: document.documentElement.scrollWidth - innerWidth };
    });
    dit(v.email != null && v.mdp != null && v.valider != null && v.email < v.mdp && v.mdp < v.valider, `${nom} P8 l’e-mail, le mot de passe, puis « Se connecter »`, JSON.stringify([v.email, v.mdp, v.valider]));
    dit(v.fournisseurs.length === 1 && /Discord/.test(v.fournisseurs[0].t) && v.fournisseurs[0].y > v.valider && v.fournisseurs[0].h >= 43.5, `${nom} P8 seul le fournisseur ACTIVÉ (Discord) est montré, SOUS le formulaire, 44 px`, JSON.stringify(v.fournisseurs));
    dit(!/recevoir un code|code par e-?mail|lien magique|connexion par code/i.test(v.texte), `${nom} P8 aucun « recevoir un code » mis en avant (les e-mails de code ne sont pas configurés)`);
    dit(['/legal/cgu.html', '/legal/confidentialite.html', '/legal/mentions-legales.html'].every((h) => v.legaux.includes(h)), `${nom} P8 les liens légaux sont là (discrets)`, v.legaux.join(', '));
    dit(v.petits.length === 0, `${nom} P8 chaque cible fait 44 px`, v.petits.slice(0, 6).join(' · '));
    dit(v.deb <= 1, `${nom} P8 rien ne déborde`, `${v.deb} px`);
    dit(erreurs.length === 0, `${nom} P8 aucune erreur de page`, erreurs.join(' | '));
    if (CAPT) await pg.screenshot({ path: path.join(CAPT, `connexion-${opt.largeur}-${opt.sombre ? 'sombre' : 'clair'}.png`), fullPage: true, timeout: 120000 });
  } finally { await ctx.close(); }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ ${DIST}/index.html absent — npm run build`); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  let registre = {}; try { registre = JSON.parse(lire('public/accueil/captures.json')); } catch (_) { registre = {}; }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-compositing'] });
  const SEUL = (process.env.SEUL || '').split(',').filter(Boolean);
  const veut = (b) => !SEUL.length || SEUL.includes(b);
  try {
    if (veut('ecran')) for (const [nom, opt] of [['390 · clair', TEL], ['390 · sombre', { ...TEL, sombre: true }], ['1512 · clair', ORDI], ['1512 · sombre', { ...ORDI, sombre: true }]]) {
      console.log(`\n── LE PREMIER ÉCRAN, PUIS LA PAGE — ${nom}`);
      await essaie(nom, () => premierEcran(nav, nom, opt, registre));
    }
    if (veut('largeurs')) {
      console.log('\n── AUCUN DÉBORDEMENT, À TOUTE LARGEUR');
      for (const w of [320, 768, 1024]) await essaie(`largeur ${w}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { largeur: w, hauteur: 800, mobile: w < 760 });
        const Ht = await pg.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < Ht; y += 600) { await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(40); }
        const d = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(d <= 1, `P2 ${w} px : aucun débordement horizontal`, `${d} px`);
        await ctx.close();
      });
    }
    if (veut('faux')) { console.log('\n── AUCUN FAUX'); await essaie('aucun faux', () => aucunFaux(nav)); }
    if (veut('partage')) { console.log('\n── LE PARTAGE (Instagram, TikTok, WhatsApp…)'); await essaie('partage', () => partage()); }
    if (veut('suite')) { console.log('\n── LA SUITE DE L’ADRESSE PASSE JUSQU’À L’INSCRIPTION'); await essaie('suite', () => suiteAdresse(nav)); }
    if (veut('connexion')) for (const [nom, opt] of [['connexion 390 · clair', TEL], ['connexion 390 · sombre', { ...TEL, sombre: true }], ['connexion 1512 · clair', ORDI]]) {
      console.log(`\n── L’ÉCRAN DE CONNEXION — ${nom}`);
      await essaie(nom, () => connexion(nav, opt, nom));
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ site public : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ site public : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
