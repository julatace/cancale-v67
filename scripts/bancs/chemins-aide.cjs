require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES CHEMINS DE L'AIDE, SUIVIS DANS L'APP RENDUE (24 nov., lot textes-restes)
//      npm run build && node scripts/bancs/chemins-aide.cjs
//      CHEMIN=Achats node scripts/bancs/chemins-aide.cjs      (seulement les chemins qui contiennent ce mot)
// ════════════════════════════════════════════════════════════════════════════
// L'aide écrit des chemins : « Achats → À retirer », « Paramètres → Mes plateformes →
// Mon adresse VRM ». La navigation a changé (11 nov. : plus d'onglet Colis ; 15 nov. :
// Paramètres en catégories ; 16 nov. : barre du bas Aujourd'hui · Annonces · Achats ·
// Ventes · Argent) et des chemins menaient à des écrans qui n'existent plus — sans
// aucune erreur nulle part. Ici, chaque chemin est JOUÉ au téléphone (390 px), comme le
// vendeur le lirait :
//   · le 1er nom est un onglet de la barre du bas ou une tuile du menu (☰) ;
//   · chaque nom suivant est un bouton, un onglet ou une rangée VISIBLE après le geste
//     d'avant (texte ou aria-label, guillemets et « + » ignorés) — on le touche ;
//   · le dernier nom peut n'être qu'un titre visible (il ne mène plus nulle part).
// Un nom introuvable rougit, avec ce que l'écran montrait.
// Les textes lus : l'aide publique (scripts/aide-contenu.cjs : articles et gestes du « ? »),
// les fiches de l'aide intégrée (src/aideFiches.js) et chaque texte de l'app en français
// (src/i18n/langues/fr*.js) qui nomme un chemin. Les chemins hors de VRM (iPhone, Gmail,
// Windows, Orion, eBay.com…) ne sont pas jugés. Base vide, un compte Vinted, aucune donnée réelle.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(R, 'node_modules', 'playwright'));
const DIST = process.env.DIST || path.join(R, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4983;
const FILTRE = process.env.CHEMIN || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
const COMPTES = [{ account_id: '901', vinted_user_id: '901', login: 'compte_banc', owner: SESSION.user.id }];

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? '\n   → ' + d : ''}`); };

// ── Les noms d'écran qu'un chemin d'aide peut nommer en premier (d'aujourd'hui OU d'avant :
// un ancien nom est JUGÉ — il doit rougir, c'est le défaut qu'on cherche).
const ECRANS = ['Ma journée', 'Aujourd’hui', 'Annonces', 'Ventes', 'Achats', 'Argent', 'Stock', 'Messages', 'E-mails', 'Paramètres',
  'Communauté', 'Extension', 'Mes comptes', 'Notifications', 'Automatismes', 'Messages aux favoris', 'État des actions',
  'Colis', 'Réglages', 'Statistiques', 'Compta', 'Ma semaine', 'eBay', 'Leboncoin', 'Vestiaire'];
// Une phrase hors de VRM (réglages d'un autre logiciel, d'un téléphone, d'un site) n'est pas jugée.
const DEHORS = /iPhone|iCloud|icloud|Windows|\bMac\b|Chrome|Orion|Gmail|outlook|Outlook|Yahoo|Orange|Free\b|Seller Hub|réglages eBay|eBay → Compte|⚙|Raccourcis|clic droit|Mail\b|•••|Batterie|Système|ton nom|Promotion →/;

// Les guides pas à pas d'AUTRES logiciels (relier une boîte Gmail/Yahoo, garder un ordinateur allumé).
const HORS_CLES = /^(relier\.|adist\.guide\.|ebay\.guide\.|ebay\.err\.(limite|retours))/;

// Un texte ⇒ ses chemins (listes de noms). Gras retiré ; un chemin s'arrête à la fin de sa phrase.
function chemins(texte) {
  const out = [];
  const t = String(texte).replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Un nom entre guillemets garde ses deux-points (« Journal : ce que VRM a fait ») : masqués le temps du découpage.
  const masque = (x) => x.replace(/«[^»]*»|“[^”]*”/g, (g) => g.replace(/ : /g, ' \u2236 '));
  const rend = (x) => x.replace(/ \u2236 /g, ' : ');
  // D'abord la phrase (un geste chez Yahoo ou sur l'iPhone n'est pas jugé), puis ses morceaux.
  for (const phrase of masque(t).split(/(?<=[.;!])\s+|\n/)) {
    if (DEHORS.test(phrase)) continue;
    for (const p of phrase.split(/\s[:—]\s|\(|\)|,\s/)) {
      if (p.includes('→')) {
        const segs = p.split(/\s*→\s*/).map((s) => rend(s.replace(/[.,;:]+$/, '').trim()));
        const avant = segs[0];
        const premier = ECRANS.filter((e) => avant === e || avant.endsWith(' ' + e)).sort((a, b) => b.length - a.length)[0];
        if (!premier) continue;
        segs[0] = premier;
        const fin = segs.findIndex((s) => /[{}]/.test(s) || !s);   // une variable ({nom}) : on juge jusque-là
        out.push({ segs: fin < 0 ? segs : segs.slice(0, fin), texte: rend(p.trim()) });
        continue;
      }
      // « Ouvre Colis. » : un écran seul.
      const m = /\b[Oo]uvre (?:l’écran )?([A-ZÉ][^.,;:«»]*?)\s*(?:[.,;:]|$)/.exec(p);
      if (m && ECRANS.includes(m[1].trim())) out.push({ segs: [m[1].trim()], texte: p.trim() });
    }
  }
  return out;
}
const chaines = (v, o = []) => { if (typeof v === 'string') o.push(v); else if (Array.isArray(v)) v.forEach((x) => chaines(x, o)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => chaines(x, o)); return o; };

async function lireChemins() {
  const imp = async (rel) => import(pathToFileURL(path.join(R, rel)).href);
  const C = require(path.join(R, 'scripts', 'aide-contenu.cjs'));
  const { FICHES_AIDE } = await imp('src/aideFiches.js');
  const dico = {};
  for (const f of fs.readdirSync(path.join(R, 'src', 'i18n', 'langues')).filter((f) => /^fr(-[\w]+)?\.js$/.test(f))) Object.assign(dico, (await imp('src/i18n/langues/' + f)).default || {});
  const sources = [
    ['aide publique', chaines(C.ARTICLES)],
    ['gestes du « ? »', chaines(C.ETAPES_ECRANS)],
    ['fiches de l’aide', chaines(FICHES_AIDE.map((f) => f.etapes))],
    ['textes de l’app', Object.entries(dico).filter(([k]) => !HORS_CLES.test(k)).flatMap(([k, v]) => chaines(v).map((s) => [k, s]))],
  ];
  const vus = new Map();
  for (const [src, liste] of sources) for (const x of liste) {
    const [cle, s] = Array.isArray(x) ? x : [null, x];
    for (const c of chemins(s)) {
      const id = c.segs.join(' → ');
      if (!vus.has(id)) vus.set(id, { segs: c.segs, ou: [] });
      vus.get(id).ou.push(`${src}${cle ? ' ' + cle : ''} : « ${c.texte.slice(0, 90)} »`);
    }
  }
  return [...vus.values()].filter((c) => !FILTRE || c.segs.join(' → ').includes(FILTRE));
}

const SITES = { Vinted: 'vinted', Leboncoin: 'leboncoin', eBay: 'ebay', Vestiaire: 'vestiaire' };

// ── Dans la page : trouver un nom visible, le toucher.
const TROUVER = ({ nom, premier, dernier }) => {
  const norm = (s) => String(s || '').normalize('NFC').replace(/[«»"“”]/g, '').replace(/[’']/g, '’').replace(/ | /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^\+\s*/, '').replace(/…$/, '').trim();
  const voulu = norm(nom);
  const visible = (e) => { if (!e.getClientRects().length) return false; const st = getComputedStyle(e); return st.visibility !== 'hidden' && st.opacity !== '0'; };
  const barre = document.querySelector('nav[data-n-onglets]');
  const CLIC = 'button,a,[role=button],[role=tab],[role=menuitem],[role=option],[role=link],summary,label,[tabindex]';
  const tous = [...document.querySelectorAll('body *')].filter((e) => !e.closest('[aria-hidden="true"]') && (premier || !barre || !barre.contains(e)));
  const correspond = (e) => {
    // Un compteur porte son nombre après son nom (« À retirer : 0 », « Reçus · 3 ») : c'est le nom qui compte.
    const sansNombre = (x) => x.replace(/\s*[:·]\s*[\d—–-][\d\s—–-]*$/, '').trim();
    const aria = sansNombre(norm(e.getAttribute('aria-label')));
    if (aria === voulu || norm(e.getAttribute('title')) === voulu) return true;
    const lignes = String(e.innerText || '').split('\n').map((x) => sansNombre(norm(x))).filter(Boolean);
    if (!(lignes.length > 0 && lignes.length <= 4)) return false;
    // Le dernier nom peut continuer la phrase (« … → Mon abonnement le dit ») : le nom affiché en est le DÉBUT.
    return lignes.includes(voulu) || (dernier && lignes.some((l) => l.length >= 4 && voulu.startsWith(l + ' ')));
  };
  // Le plus petit élément qui porte ce nom, puis son ancêtre qu'on touche.
  const cands = tous.filter((e) => visible(e) && correspond(e) && ![...e.children].some((c) => correspond(c) && visible(c)));
  cands.sort((a, b) => (b.closest(CLIC) ? 1 : 0) - (a.closest(CLIC) ? 1 : 0));
  document.querySelectorAll('[data-banc-chemin]').forEach((e) => e.removeAttribute('data-banc-chemin'));
  const c = cands[0];
  if (!c) {
    const vu = [...new Set([...document.querySelectorAll(CLIC)].filter((e) => visible(e) && (premier || !barre || !barre.contains(e))).map((e) => norm(e.getAttribute('aria-label')) || norm(String(e.innerText || '').split('\n')[0])).filter(Boolean))];
    return { trouve: false, vu: vu.slice(0, 40).join(' · ') };
  }
  const cible = c.closest(CLIC) || c;
  cible.setAttribute('data-banc-chemin', '1');
  return { trouve: true, cliquable: !!c.closest(CLIC) };
};

async function suivre(pg, segs) {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('nav[data-n-onglets]', { timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  for (let i = 0; i < segs.length; i++) {
    const nom = segs[i];
    const dernier = i === segs.length - 1;
    let r = await pg.evaluate(TROUVER, { nom, premier: i === 0, dernier });
    if (!r.trouve && i === 0) {   // pas dans la barre : le menu du haut (☰)
      await pg.locator('[aria-label="Menu et compte"]').first().click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(800);
      r = await pg.evaluate(TROUVER, { nom, premier: true, dernier });
    }
    // Un écran chargé à la demande (« Chargement… ») : on le laisse arriver, 9 s au plus. Sous charge, un toucher
    // pendant un rendu peut se perdre : si le nom d'AVANT est encore à l'écran, on le touche une seconde fois.
    for (let k = 0; !r.trouve && i > 0 && k < 6; k++) {
      await pg.waitForTimeout(1500);
      if (k === 2) {
        const avant = await pg.evaluate(TROUVER, { nom: segs[i - 1], premier: i - 1 === 0, dernier: false });
        if (avant.trouve && avant.cliquable) await pg.locator('[data-banc-chemin]').first().click({ timeout: 4000 }).catch(() => {});
      }
      r = await pg.evaluate(TROUVER, { nom, premier: false, dernier });
    }
    // Un SITE (« Annonces → Leboncoin ») : il se choisit dans le menu de plateforme en tête de l'écran, qui n'apparaît
    // qu'avec des comptes reliés sur plusieurs sites — la base du banc est vide. Le banc vérifie seulement que l'écran
    // range ses sites (Annonces, Ventes, Achats, Messages : src/navigationTache.js) et s'ARRÊTE là : la suite d'un tel
    // chemin n'est pas jugée (dit dans le bilan, jamais compté comme vu).
    if (!r.trouve && i > 0 && SITES[nom]) {
      const tache = await pg.evaluate(() => { const m = document.querySelector('.vrm-main[data-ecran]'); return m ? m.getAttribute('data-ecran') : ''; });
      if (['annonces', 'ventes', 'achats', 'messages'].includes(tache)) return { bon: true, site: i };
      return { bon: false, ou: i, vu: `(un site, mais l’écran « ${tache || '?'} » ne range pas ses sites)` };
    }
    if (!r.trouve) return { bon: false, ou: i, vu: r.vu };
    if (r.cliquable || i < segs.length - 1) {
      await pg.locator('[data-banc-chemin]').first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await pg.locator('[data-banc-chemin]').first().click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(900);
    }
  }
  return { bon: true };
}

(async () => {
  const liste = await lireChemins();
  dit(liste.length >= (FILTRE ? 1 : 30), `${liste.length} chemins relus dans l’aide et les textes de l’app`);
  const srv = http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f);
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }); }
  catch (e) { console.log(`❌ port ${PORT} pris — relance ce banc seul`); process.exit(1); }
  const lancer = () => chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  let nav = await lancer();
  try {
    const partiels = [];
    const erreurs = [];
    // Une page neuve (aussi après un plantage de l'onglet : machine partagée, mémoire juste — un banc ne meurt pas).
    let ctx = null, pg = null;
    const nouvellePage = async () => {
      if (ctx) await ctx.close().catch(() => {});
      if (!nav.isConnected()) { console.log('   (le navigateur s’est fermé : relancé)'); nav = await lancer(); }
      ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      pg = await ctx.newPage();
      pg.on('pageerror', (e) => erreurs.push(e.message));
      await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_acces_direct', '1');
        // Les quatre sites affichés (« Où vends-tu ? ») : sinon Annonces et Ventes ne montrent que Vinted, et un chemin
        // « Annonces → Leboncoin » serait jugé faux pour une préférence, pas pour un écran.
        localStorage.setItem('vrm_plateformes_affichees', JSON.stringify({ sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: Date.now() })); } catch (_) {} }, SESSION);
      // (§6.6) Playwright prend la DERNIÈRE route d'abord : le « tout le reste coupé » d'abord.
      await pg.route(/^https?:\/\/(?!localhost)/i, (r) => r.abort());
      await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
      await pg.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: /vinted_accounts/.test(decodeURIComponent(r.request().url())) ? JSON.stringify(COMPTES) : '[]' }));
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    };
    await nouvellePage();
    // Le premier écran doit être l'app (pas la porte, pas la connexion) — sinon tout rougirait pour rien.
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    const app = await pg.waitForSelector('nav[data-n-onglets]', { timeout: 60000 }).then(() => true, () => false);
    dit(app, 'l’app s’ouvre au téléphone (barre du bas)');
    if (app && process.env.SONDE) {   // SONDE="Paramètres → Mon compte" : suivre ce chemin et montrer l'écran (pour corriger un texte)
      const segs = process.env.SONDE.split(/\s*→\s*/);
      const r = await suivre(pg, segs);
      await pg.waitForTimeout(5000);
      console.log(r.bon ? 'suivi' : 'arrêté à « ' + segs[r.ou] + ' »');
      console.log(await pg.evaluate(() => document.body.innerText));
      await pg.screenshot({ path: process.env.SONDE_IMAGE || '/tmp/chemins-aide-sonde.png' });
    } else if (app) for (const c of liste) {
      let r = null;
      for (let essai = 0; essai < 2 && !r; essai++) {
        try { r = await suivre(pg, c.segs); }
        catch (e) { if (!/crash|closed|Target/i.test(String(e && e.message))) throw e; console.log(`   (l’onglet a planté sur « ${c.segs.join(' → ')} » : page neuve)`); await nouvellePage(); }
      }
      if (!r) r = { bon: false, ou: 0, vu: 'l’onglet a planté deux fois' };
      const nom = c.segs.join(' → ');
      if (r.bon && r.site != null && r.site < c.segs.length) partiels.push(`${nom} (jugé jusqu’à « ${c.segs[r.site - 1]} », un site ensuite)`);
      dit(r.bon, nom, r.bon ? '' : `« ${c.segs[r.ou]} » introuvable${r.ou ? ' après « ' + c.segs.slice(0, r.ou).join(' → ') + ' »' : ' (ni dans la barre du bas, ni dans le menu)'}\n   → écrit dans ${c.ou.slice(0, 3).join(' ; ')}${c.ou.length > 3 ? ` (+${c.ou.length - 3})` : ''}\n   → l’écran montrait : ${r.vu || '—'}`);
    }
    if (partiels.length) console.log(`ℹ️  ${partiels.length} chemin(s) passent par un site (base vide, pas de menu de plateforme) :\n   ${partiels.join('\n   ')}`);
    dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3).join(' | '));
    await ctx.close().catch(() => {});
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 200)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n${ko ? '❌' : '✅'} chemins-aide : ${ok} verts, ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  }
})();
