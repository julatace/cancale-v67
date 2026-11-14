'use strict';
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CONFORT ET SÉCURITÉ » (14 nov., lots 117–130) — 390 px tactile ET 1512 px,
//  clair ET sombre. Les VRAIS écrans, montés seuls (harnais confort-securite/harnais.jsx,
//  bâti par esbuild : aucun `npm run build`), le serveur bouchonné, données INVENTÉES.
//   118 atelier   : colis du jour (7 à envoyer, 1 en retard en tête), retraits avec code,
//                   le chiffre du jour (4 ventes · 318 €), aucun bouton d'action (lecture seule),
//                   sans photo ⇒ « — » partout ;
//   119 QR        : l'ordinateur montre un QR, attend, se connecte quand le serveur le dit ;
//                   le secret ne part que dans « attendre » ; l'iPhone : « Connecter “Mac de
//                   Julien” ? », RIEN n'est envoyé sans son clic, puis un seul « approuver » ;
//   120 aide      : la page sans compte — aucun « € », codes et bordereaux, « lecture seule » ;
//                   lien coupé ⇒ « plus valable » ; le réglage liste les liens (actif / coupé) ;
//   127 verrou    : le pavé couvre l'app ; le code n'est jamais en clair dans le stockage ;
//                   5 erreurs ⇒ déconnexion ; le bon code ouvre ;
//   128 aperçu    : titre + description qui partiront (le N° à la fin), prix, détails, photos ;
//   129 tournant  : 10 N° tirés parmi 1 000 paires (jamais une vendue / à confirmer),
//                   « Pas trouvé » ⇒ « À chercher », aucun N° changé ;
//   130 merci     : aperçu à son nom, PDF fabriqué.
//  Partout : rien ne déborde, cibles ≥ 44 px au doigt, aucun NaN / undefined, aucune erreur.
//  SHOTS=<dossier> : les captures (à REGARDER, §6.2). MUTATION=aide-montant : la liste
//  blanche réaffaiblie (un « € » passe) ⇒ le banc doit rougir.
// ════════════════════════════════════════════════════════════════════════════
require('./_garde-reseau.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.RACINE_BANC || path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PORT = Number(process.env.BANC_PORT) || 4690;
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 500) : ''}`); };

function batir() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-confort-'));
  const plug = path.join(out, 'plug.cjs');
  const mut = MUTATION === 'aide-montant' ? ".replace(SANS_MONTANT, '')" : '';
  fs.writeFileSync(plug, `const fs = require('fs'); module.exports = { name: 'mutation', setup(b) { ${mut ? `b.onLoad({ filter: /lienAideProjection\\.js$/ }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8').replace(${JSON.stringify(mut)}, ''), loader: 'js' }));` : ''} } };`);
  const script = path.join(out, 'b.cjs');
  fs.writeFileSync(script, `require(${JSON.stringify(path.join(NM, 'esbuild'))}).build({ entryPoints: [${JSON.stringify(path.join(RACINE, 'scripts/bancs/confort-securite/harnais.jsx'))}], bundle: true, outdir: ${JSON.stringify(out)}, entryNames: 'h', jsx: 'automatic', loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.svg': 'dataurl', '.png': 'dataurl' }, nodePaths: [${JSON.stringify(NM)}], define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' }, plugins: [require(${JSON.stringify(plug)})], logLevel: 'error' }).catch((e) => { console.error(e); process.exit(1); });`);
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
  return out;
}

const MESURE = (tel) => {
  const vis = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const texte = document.body.innerText || '';
  const petits = tel ? [...document.querySelectorAll('button, a[href], input, select, textarea, summary')].filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5 && b.getBoundingClientRect().width > 0).map((b) => (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 24)) : [];
  const deborde = document.documentElement.scrollWidth > innerWidth + 1;
  const sortent = [...document.querySelectorAll('.vrm-cf-carte, .vrm-cf-liste, .vrm-at-chiffre, .vrm-cf-feuille')].filter(vis).filter((c) => { const r = c.getBoundingClientRect(); const defile = (x) => { for (let e = x.parentElement; e && e !== c; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
    return [...c.querySelectorAll('*')].filter(vis).filter((x) => !defile(x)).some((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 1.5 || q.left < r.left - 1.5); }); }).length;
  const enDefile = (x) => { for (let e = x.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 1 && e !== document.documentElement && e !== document.body && !e.classList.contains('vrm-at')) return true; } return false; };
  const horsEcran = [...document.querySelectorAll('body *')].filter(vis).filter((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && q.height > 0 && (q.right > innerWidth + 1 || q.left < -1); }).filter((x) => !enDefile(x)).map((x) => (x.className || x.tagName) + ':' + Math.round(x.getBoundingClientRect().right)).slice(0, 4);
  const mauvais = /\bNaN\b|\bundefined\b|Invalid Date|\[object Object\]/.exec(texte);
  return { petits, deborde, sortent, horsEcran, mauvais: mauvais ? mauvais[0] : '' };
};

(async () => {
  const dist = batir();
  const page0 = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/h.css"></head><body><script src="/h.js"></script></body></html>`;
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0].split('#')[0];
    if (u === '/h.js' || u === '/h.css') { const f = path.join(dist, u.slice(1)); r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/css' }); r.end(fs.existsSync(f) ? fs.readFileSync(f) : ''); return; }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end(page0);
  }).listen(PORT, '127.0.0.1');
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const themes = (process.env.THEMES || 'clair,sombre').split(',');
  try {
    for (const [w, hh, tel] of [[390, 844, true], [1512, 900, false]]) for (const theme of themes) {
      const tag = `${w}/${theme}`;
      const ctx = await nav.newContext({ viewport: { width: w, height: hh }, hasTouch: tel, isMobile: tel, deviceScaleFactor: tel ? 2 : 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const erreurs = [];
      const ouvrir = async (scene) => {
        const p = await ctx.newPage();
        p.on('pageerror', (e) => erreurs.push(scene + ': ' + String(e).slice(0, 200)));
        await p.goto(`http://127.0.0.1:${PORT}/#${scene}${theme === 'sombre' ? '-sombre' : ''}`);
        await p.waitForFunction(() => window.__pret, null, { timeout: 10000 });
        await p.waitForTimeout(350);
        return p;
      };
      const capture = async (p, nom) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${nom}-${w}-${theme}.png`) }); } };
      const forme = async (p, quoi) => { const m = await p.evaluate(MESURE, tel); dit(!m.deborde && !m.sortent && !m.horsEcran.length && !m.petits.length && !m.mauvais, `${tag} ${quoi} : rien ne déborde, rien ne sort d'une carte, cibles ≥ 44 px, aucun NaN`, m); };

      // ── 118 atelier ──
      { const p = await ouvrir('atelier');
        const v = await p.evaluate(() => { const a = document.querySelector('[data-atelier]'); return a && { env: a.querySelector('[data-atelier-envoyer]').getAttribute('data-atelier-envoyer'), ret: a.querySelector('[data-atelier-retirer]').getAttribute('data-atelier-retirer'), jour: a.querySelector('[data-atelier-jour]').getAttribute('data-atelier-jour'), jourTxt: a.querySelector('[data-atelier-jour]').innerText.replace(/\s+/g, ' '), premier: (a.querySelector('[data-atelier-colis]') || {}).innerText || '', boutons: [...a.querySelectorAll('button')].map((b) => b.getAttribute('data-atelier-fermer') != null ? 'fermer' : b.textContent), codes: [...a.querySelectorAll('.vrm-at-code')].map((c) => c.textContent), allume: a.getAttribute('data-atelier-allume'), z: getComputedStyle(a).position }; });
        dit(v && v.env === '7' && v.ret === '3' && v.jour === '4' && /318\s?€/.test(v.jourTxt), `${tag} 118 atelier : 7 à envoyer, 3 à retirer, 4 ventes · 318 € aujourd'hui`, v);
        dit(v && /En retard/.test(v.premier) && v.codes.join() === 'AB12CD,583921', `${tag} 118 le colis en retard en tête, les codes de retrait en grand`, v);
        dit(v && v.boutons.length === 1 && v.boutons[0] === 'fermer' && v.z === 'fixed', `${tag} 118 plein écran, LECTURE SEULE : aucun bouton que « Fermer »`, v);
        await capture(p, 'atelier'); await forme(p, '118 atelier'); await p.close(); }
      { const p = await ouvrir('atelier-vide');
        const v = await p.evaluate(() => ({ e: document.querySelector('[data-atelier-envoyer]').getAttribute('data-atelier-envoyer'), j: document.querySelector('[data-atelier-jour]').getAttribute('data-atelier-jour'), t: document.querySelector('[data-atelier]').innerText }));
        dit(v.e === 'pas-su' && v.j === 'pas-su' && !/\b0 vente/.test(v.t) && /—/.test(v.t), `${tag} 118 sans photo ni publication : « — », jamais 0`, v);
        await p.close(); }
      // ── 119 QR, l'ordinateur ──
      { const p = await ouvrir('qr-ordi');
        await capture(p, 'qr-ordi-avant');
        await p.click('[data-qr-lancer]');
        await p.waitForSelector('[data-qr-image]', { timeout: 5000 }).catch(() => {});
        const img = await p.evaluate(() => { const i = document.querySelector('[data-qr-image]'); return i ? { src: /^data:image\/gif|^data:image\/png/.test(i.src), w: i.getBoundingClientRect().width } : null; });
        dit(img && img.src && img.w >= 200, `${tag} 119 l'ordinateur montre le QR (dessiné ici, aucune image externe)`, img);
        await capture(p, 'qr-ordi');
        await p.waitForFunction(() => window.__session, null, { timeout: 12000 }).catch(() => {});
        const a = await p.evaluate(() => ({ s: !!window.__session, appels: window.__appels.map((x) => ({ a: x.corps && x.corps.action, secret: !!(x.corps && x.corps.secret), auth: x.auth })) }));
        const creer = a.appels.filter((x) => x.a === 'creer'), att = a.appels.filter((x) => x.a === 'attendre');
        dit(a.s && creer.length === 1 && att.length >= 3 && creer.every((x) => !x.secret && !x.auth) && att.every((x) => x.secret && !x.auth), `${tag} 119 il attend, puis se connecte quand le serveur le dit ; le secret ne part que dans « attendre », aucun jeton`, a);
        await p.close(); }
      // ── 119 QR, l'iPhone ──
      { const p = await ouvrir('qr-iphone');
        await p.waitForSelector('[data-qr-approuver="question"]', { timeout: 5000 }).catch(() => {});
        const v = await p.evaluate(() => ({ t: (document.querySelector('[data-qr-approuver]') || {}).innerText || '', appels: window.__appels.map((x) => x.corps.action) }));
        dit(/Connecter « Mac de Julien » \?/.test(v.t) && v.appels.join() === 'voir', `${tag} 119 l'iPhone : « Connecter “Mac de Julien” ? », RIEN n'est approuvé sans son clic`, v);
        await capture(p, 'qr-iphone'); await forme(p, '119 iPhone');
        await p.click('[data-qr-oui]'); await p.waitForSelector('[data-qr-approuve]', { timeout: 5000 }).catch(() => {});
        const w2 = await p.evaluate(() => ({ ok: !!document.querySelector('[data-qr-approuve]'), appels: window.__appels.map((x) => x.corps.action + (x.auth ? '+session' : '')) }));
        dit(w2.ok && w2.appels.join() === 'voir+session,approuver+session', `${tag} 119 SON clic : un seul « approuver », avec SA session`, w2);
        await p.close(); }
      // ── 120 la page de l'aide ──
      { const p = await ouvrir('aide');
        await p.waitForSelector('[data-vue-lien-aide="ok"]', { timeout: 5000 }).catch(() => {});
        const v = await p.evaluate(() => ({ t: document.body.innerText, env: document.querySelectorAll('[data-aide-envoyer]').length, ret: document.querySelectorAll('[data-aide-retirer]').length, bord: [...document.querySelectorAll('[data-aide-bordereau]')].map((a) => a.getAttribute('href')), boutons: [...document.querySelectorAll('button')].length, champs: document.querySelectorAll('input, textarea, select').length }));
        dit(!/€|\beur\b|\beuros?\b/i.test(v.t) && !/boutique_au_nom|pseudo_acheteur|12 rue Inventée/.test(v.t), `${tag} 120 la page de l'aide : AUCUN montant, ni compte, ni acheteur`, v.t.slice(0, 300));
        dit(v.env === 7 && v.ret === 3 && /AB12CD/.test(v.t) && v.bord.length === 5 && v.bord.every((h) => /mode=lien-aide&t=.+&bord=email_bord_\d+$/.test(h)), `${tag} 120 colis à envoyer, à retirer avec leurs codes, 5 bordereaux par la route du lien`, { env: v.env, ret: v.ret, bord: v.bord.length });
        dit(v.boutons === 0 && v.champs === 0 && /Lecture seule/.test(v.t), `${tag} 120 lecture seule : aucun bouton d'action, aucun champ`, v);
        await capture(p, 'aide'); await forme(p, '120 aide'); await p.close(); }
      { const p = await ouvrir('aide-fin');
        await p.waitForSelector('[data-vue-lien-aide="fin"]', { timeout: 5000 }).catch(() => {});
        dit(await p.evaluate(() => !!document.querySelector('[data-lien-aide-fin]') && !document.querySelector('[data-aide-envoyer]')), `${tag} 120 lien expiré ou coupé (404) ⇒ « plus valable », rien d'autre`);
        await p.close(); }
      { const p = await ouvrir('aide-reglage');
        await p.waitForSelector('[data-lien-aide-ligne]', { timeout: 5000 }).catch(() => {});
        const v = await p.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-lien-aide-ligne]')].map((l) => l.getAttribute('data-lien-aide-ligne')), t: document.querySelector('[data-lien-aide]').innerText }));
        dit(v.lignes.join() === 'actif,coupe' && /3 ouvertures/.test(v.t) && /Aucun montant/.test(v.t), `${tag} 120 le réglage : liens actifs / coupés, les ouvertures journalisées, ce que voit l'aide`, v);
        await p.click('[data-lien-aide-creer]'); await p.waitForSelector('[data-lien-aide-neuf]', { timeout: 5000 }).catch(() => {});
        const c = await p.evaluate(() => { const cr = window.__appels.find((x) => x.corps && x.corps.action === 'creer'); return { neuf: (document.querySelector('[data-lien-aide-neuf]') || {}).innerText || '', proj: cr ? JSON.stringify(cr.corps.projection) : '' }; });
        dit(/\?aide=C{22}\.\d{13}\.S{43}/.test(c.neuf) && c.proj && !/€|prix|pseudo_acheteur|boutique_au_nom/.test(c.proj), `${tag} 120 « Créer » : le lien prêt à partager ; ce qui part au serveur est déjà la projection sans montant`, c);
        await capture(p, 'aide-reglage'); await forme(p, '120 réglage'); await p.close(); }
      // ── 127 le verrou ──
      { const p = await ouvrir('verrou');
        const v = await p.evaluate(() => { const vv = document.querySelector('[data-verrou-code]'); const r = vv && vv.getBoundingClientRect(); return { la: !!vv, couvre: !!r && r.width >= innerWidth - 1 && r.height >= innerHeight - 1, stock: Object.entries(localStorage).map(([k, x]) => k + '=' + x).join('|') }; });
        dit(v.la && v.couvre, `${tag} 127 à l'ouverture, le pavé couvre toute l'app`, v);
        dit(!/4826/.test(v.stock) && /vrm_code_local/.test(v.stock), `${tag} 127 le code n'est JAMAIS en clair dans le stockage`, v.stock.slice(0, 200));
        await capture(p, 'verrou'); await forme(p, '127 verrou');
        const taper = async (c) => { const avant = await p.evaluate(() => { const v = document.querySelector('[data-verrou-code]'); return v ? v.getAttribute('data-verrou-reste') + '|' + (window.__essais = (window.__essais || 0)) : 'x'; }); for (const x of c) await p.click(`[data-pave="${x}"]`); await p.waitForFunction((a) => { const v = document.querySelector('[data-verrou-code]'); return !v || window.__deconnecte || (v.getAttribute('data-verrou-reste') + '|' + window.__essais) !== a; }, avant, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(150); };
        await taper('1111');
        const r1 = await p.evaluate(() => document.querySelector('[data-verrou-code]') && document.querySelector('[data-verrou-code]').getAttribute('data-verrou-reste'));
        dit(r1 === '4', `${tag} 127 un code faux : « encore 4 essais »`, r1);
        await taper('4826');
        dit(await p.evaluate(() => !document.querySelector('[data-verrou-code]') && !window.__deconnecte), `${tag} 127 le bon code ouvre`);
        await p.reload(); await p.waitForFunction(() => window.__pret); await p.waitForTimeout(400);
        for (let i = 0; i < 5; i++) await taper('2580');
        const fin = await p.evaluate(() => ({ dec: !!window.__deconnecte, code: localStorage.getItem('vrm_code_local') }));
        dit(fin.dec && fin.code === null, `${tag} 127 cinq erreurs ⇒ déconnexion propre, code effacé`, fin);
        await p.close(); }
      { const p = await ouvrir('code');
        const t = await p.evaluate(() => document.querySelector('[data-reglage-code]').innerText);
        dit(/ne protège pas ton compte/.test(t), `${tag} 127 le réglage dit que ce n'est PAS une sécurité du serveur`, t);
        await capture(p, 'code'); await forme(p, '127 réglage'); await p.close(); }
      // ── 128 aperçu ──
      { const p = await ouvrir('apercu');
        const v = await p.evaluate(() => ({ titre: document.querySelector('[data-apercu-titre]').textContent, prix: document.querySelector('[data-apercu-prix]').textContent, desc: document.querySelector('[data-apercu-description]').textContent, ph: document.querySelector('[data-apercu-photos]').getAttribute('data-apercu-photos'), t: document.querySelector('[data-apercu-annonce]').innerText }));
        dit(v.titre === 'Nike Air Max 90 blanche' && /89,50\s?€/.test(v.prix) && /N°124\s*$/.test(v.desc) && v.ph === '2' && /Marque\s*Nike/.test(v.t), `${tag} 128 l'aperçu : le texte qui partira (N° à la fin), le prix, les détails, 2 photos`, v);
        await capture(p, 'apercu'); await forme(p, '128 aperçu'); await p.close(); }
      // ── 129 tournant ──
      { const p = await ouvrir('tournant');
        await p.click('[data-inventaire-tournant-ouvrir]'); await p.waitForTimeout(200);
        const v = await p.evaluate(() => { const nums = [...document.querySelectorAll('[data-tournant-num]')].map((l) => l.getAttribute('data-tournant-num')); const u = window.__unites; return { nums, interdits: nums.filter((n) => { const x = u.find((y) => y.numero === n); return !x || x.etat !== 'enligne'; }) }; });
        dit(v.nums.length === 10 && !v.interdits.length, `${tag} 129 10 N° tirés parmi 1 000 paires, jamais une vendue ni une « à confirmer »`, v);
        const avant = await p.evaluate(() => JSON.stringify(window.__unites));
        const n0 = v.nums[0];
        await p.click(`[data-tournant-absent="${n0}"]`); await p.waitForTimeout(150);
        await p.click(`[data-tournant-vu="${v.nums[1]}"]`); await p.waitForTimeout(150);
        const apres = await p.evaluate((n0) => ({ signal: !!document.querySelector(`[data-tournant-signal="${n0}"]`), etat: window.__etat, u: JSON.stringify(window.__unites) }), n0);
        dit(apres.signal && apres.etat && apres.etat.absents[n0] && apres.u === avant, `${tag} 129 « Pas trouvé » ⇒ « À chercher » (signal), AUCUN N° changé, rien supprimé`, { signal: apres.signal });
        await capture(p, 'tournant'); await forme(p, '129 tournant'); await p.close(); }
      // ── 130 merci ──
      { const p = await ouvrir('merci');
        const t = await p.evaluate(() => document.querySelector('[data-merci-apercu]').innerText);
        dit(/Merci/.test(t) && /Julien/.test(t) && /Atelier Sneakers Inventé/.test(t), `${tag} 130 l'aperçu à SON nom`, t);
        await p.click('[data-merci-imprimer="4"]'); await p.waitForFunction(() => window.__pdf, null, { timeout: 8000 }).catch(() => {});
        const pdf = await p.evaluate(() => window.__pdf);
        dit(pdf && pdf.taille > 1000 && /cartes-merci-a4\.pdf/.test(pdf.nom), `${tag} 130 « Imprimer 4 cartes » fabrique le PDF ici`, pdf);
        await capture(p, 'merci'); await forme(p, '130 merci'); await p.close(); }
      dit(!erreurs.length, `${tag} aucune erreur de page`, erreurs);
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ confort-securite : ${ko} défaut(s), ${ok} vert(s)` : `\n✅ confort-securite : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
