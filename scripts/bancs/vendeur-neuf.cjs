// ════════════════════════════════════════════════════════════════════════
//  BANC « VENDEUR NEUF » (1er nov. 2026) — Sophie, revendeuse, découvre VRM.
//
//  Adapté du banc jetable de l'audit « un autre vendeur que Julien » (19
//  défauts) : une vendeuse INVENTÉE (sophie@exemple.fr), une base VIDE, aucune
//  extension, et la base qui dit qu'elle n'est PAS propriétaire de
//  l'installation. Aucune fixture, aucune donnée réelle, aucun réseau.
//  Il juge des data-* et des nombres rendus (§6.4), et rapporte (ne meurt pas) :
//   1. Colis ne dit ni « 0 » ni « Vinted ne te demande aucun envoi » sans
//      compte relié : « Relie ton compte Vinted pour voir tes colis » + geste ;
//   2. Ventes a un filtre Vinted (le site principal) et dit « aucun compte
//      relié » au lieu de taire Vinted ;
//   3. Annonces · eBay ne renvoie plus vers une section « Compte » disparue :
//      un geste vers Paramètres → Comptes eBay ;
//   4. la pastille du haut ne dit pas « Lecture seule » avant toute
//      installation (« Extension à installer ») ;
//   5. aucune consigne d'administrateur (Supabase, Vercel, eBay Developer,
//      VAPID) ni le nom de Julien/Cancale à l'écran d'un autre vendeur ;
//      base injoignable ⇒ « VRM est momentanément indisponible » ;
//   6. le réglage « Import des emails · date de début » (qui n'agit que pour
//      la boîte du propriétaire) n'est pas proposé ;
//   7. l'assistant IA (clé de Julien, §2.9) n'apparaît pas ;
//   8. aucune erreur JavaScript sur aucun écran.
//  Et l'autre sens : le PROPRIÉTAIRE garde ses consignes (eBay non configuré,
//  réglage d'import), sinon il ne pourrait plus rien réparer.
// ════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.7)
const PORT = Number(process.env.BANC_PORT) || 4977;
const SORTIE = process.env.BANC_SORTIE || path.join(require('os').tmpdir(), 'banc-vendeur-neuf');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — un autre banc tourne. Relance celui-ci seul.`) : e));
  srv.listen(PORT, () => res(srv));
});

// Rend un écran pour Sophie (ou le propriétaire) et renvoie le texte, les
// attributs utiles et les erreurs JS.
async function rendre(nav, { tab, proprietaire = false, baseKO = false, telephone = false, apres = null }) {
  const ctx = await nav.newContext(telephone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_base_ko_depuis', new Date(Date.now() - 3 * 3600e3).toISOString()); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user, factors: [] }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if (/\/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ obligatoire: false, proprietaire, acces: true }) });
    if (baseKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    const json = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (/mode=confidentialite/.test(u)) return json({ ok: true, uid: SESSION.user.id });
    if (/mode=abonnement/.test(u)) return json({ ok: true, configure: false, obligatoire: false, proprietaire, acces: true, essaiDispo: false });
    if (/\/api\/ebay/.test(u) && r.request().method() === 'GET') return json({ ok: true, ready: false, canConsent: false });
    if (/\/api\/ebay/.test(u)) return json({ ok: true, ready: false, canConsent: false, connected: false });
    if (/\/api\/push\?etat=1/.test(u)) return json({ pret: false, devices: 0 });
    // §2.9 : la route ne dit « prête » qu'au propriétaire (api/ai.js).
    if (/\/api\/ai/.test(u)) return json({ ok: true, ready: proprietaire });
    return json({});
  });
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  if (apres) { try { await apres(pg); } catch (e) { erreurs.push('geste : ' + String(e).slice(0, 160)); } await pg.waitForTimeout(1500); }
  const lu = await pg.evaluate(() => ({
    texte: document.body.innerText,
    sansCompteColis: !!document.querySelector('[data-colis-sans-compte]'),
    relierColis: !!document.querySelector('[data-colis-relier]'),
    colonnes: !!document.querySelector('[data-colis-onglet]'),
    filtreVinted: !!document.querySelector('[data-filtre-site] [data-site="vinted"], .vrm-filtre-site [data-site="vinted"]'),
    etatVinted: (document.querySelector('[data-toutes-etat-site="vinted"]') || {}).getAttribute ? document.querySelector('[data-toutes-etat-site="vinted"]').getAttribute('data-etat') : null,
    versComptesEbay: !!document.querySelector('[data-vers-comptes-ebay]'),
    pastille: ((document.querySelector('.vrm-etat-pastille') || {}).innerText || '').trim(),
    panneVendeur: !!document.querySelector('[data-panne-vendeur]'),
    ebayAdmin: (document.querySelector('[data-ebay-admin]') || { getAttribute: () => null }).getAttribute('data-ebay-admin'),
    rediger: [...document.querySelectorAll('button')].some((b) => /Rédiger/.test(b.innerText)),
  }));
  if (!fs.existsSync(SORTIE)) fs.mkdirSync(SORTIE, { recursive: true });
  await pg.screenshot({ path: path.join(SORTIE, `${tab}${proprietaire ? '-proprio' : ''}${baseKO ? '-panne' : ''}${telephone ? '-tel' : ''}.png`) });
  await ctx.close();
  return { ...lu, erreurs };
}
const ADMIN = /Restart project|supabase\.com|VAPID_PRIVATE_KEY|EBAY_RUNAME|docs\/ebay-api|AI_API_KEY|Environment Variables|cancale-v67/i;
const JULIEN = /Julien|Cancale|hopcancale|vanessa5723|angeled92/i;

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance d’abord `npm run build`.'); process.exit(1); }
  await ecouter();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const ecrans = {};
    for (const tab of ['journee', 'annonces', 'ventes', 'messages', 'cat_bord', 'achats', 'garage', 'dashboard', 'compta', 'settings', 'communaute', 'vintedaccounts', 'ebay_annonces']) {
      ecrans[tab] = await rendre(nav, { tab });
      dit(!ecrans[tab].erreurs.length, `${tab} : aucune erreur JavaScript`, ecrans[tab].erreurs.slice(0, 2).join(' | '));
      dit(!ADMIN.test(ecrans[tab].texte), `${tab} : aucune consigne d'administrateur à l'écran d'une vendeuse`, (ecrans[tab].texte.match(ADMIN) || [''])[0]);
      dit(!JULIEN.test(ecrans[tab].texte), `${tab} : ni « Julien » ni « Cancale »`, (ecrans[tab].texte.match(JULIEN) || [''])[0]);
    }
    console.log('— 1. Colis sans compte relié');
    const c = ecrans.cat_bord;
    dit(c.sansCompteColis && c.relierColis, 'Colis dit « Relie ton compte Vinted pour voir tes colis » avec le geste', JSON.stringify({ sansCompte: c.sansCompteColis, geste: c.relierColis }));
    dit(!c.colonnes, 'Colis ne montre pas quatre colonnes à « 0 » sur une lecture qui n’a pas eu lieu');
    dit(!/Vinted ne te demande aucun envoi|Aucun colis à envoyer/.test(c.texte), '« Aucun colis à envoyer » / « Vinted ne te demande aucun envoi » ne sont pas dits à qui n’a rien relié', (c.texte.match(/Aucun colis à envoyer|Vinted ne te demande aucun envoi/) || [''])[0]);
    console.log('— 2. Ventes');
    const v = ecrans.ventes;
    dit(v.filtreVinted, 'Ventes a un filtre « Vinted » (le site principal), même sans compte');
    dit(v.etatVinted === 'jamais' && /aucun compte relié/.test(v.texte), 'Ventes dit « Vinted : aucun compte relié » et le geste', `data-etat=${v.etatVinted}`);
    console.log('— 3. Annonces · eBay');
    const e = ecrans.ebay_annonces;
    dit(!/section « Compte »/.test(e.texte), 'Annonces · eBay ne renvoie plus vers une section « Compte » disparue');
    // (3 nov.) Le geste est un bouton « Relier eBay » (sans la phrase « Connecte ton compte… » — retirée à la demande de Julien, 3 nov.).
    dit(e.versComptesEbay && /Relier eBay/.test(e.texte), 'il mène à Paramètres → Comptes eBay (un geste : « Relier eBay »)', JSON.stringify({ geste: e.versComptesEbay }));
    console.log('— 4. La pastille du haut');
    dit(!/Lecture seule/.test(ecrans.journee.pastille) && /Extension/.test(ecrans.journee.pastille), 'avant toute installation : « Extension à installer », pas « Lecture seule »', `« ${ecrans.journee.pastille} »`);
    console.log('— 5. Base injoignable');
    const p = await rendre(nav, { tab: 'journee', baseKO: true });
    dit(p.panneVendeur && /momentanément indisponible/.test(p.texte), 'base injoignable : « VRM est momentanément indisponible, réessaie dans quelques minutes »', p.texte.slice(0, 160).replace(/\s+/g, ' '));
    dit(!ADMIN.test(p.texte), 'aucune consigne Supabase (Restart project, supabase.com) à une vendeuse', (p.texte.match(ADMIN) || [''])[0]);
    const pp = await rendre(nav, { tab: 'journee', baseKO: true, proprietaire: true });
    dit(!pp.panneVendeur && /Restart project/.test(pp.texte), "l'autre sens : le propriétaire garde la consigne Supabase (lui seul peut redémarrer)", pp.texte.slice(0, 120).replace(/\s+/g, ' '));
    console.log('— 6. Paramètres');
    const s = ecrans.settings;
    dit(!/Import des emails Vinted/.test(s.texte), 'le réglage « Import des emails Vinted » (inopérant pour elle) n’est pas proposé');
    const sp = await rendre(nav, { tab: 'settings', proprietaire: true });
    dit(/Import des emails Vinted/.test(sp.texte), "l'autre sens : le propriétaire le garde");
    console.log('— 6 bis. eBay non configuré');
    const ep = await rendre(nav, { tab: 'plat_ebay', apres: null });
    const epp = await rendre(nav, { tab: 'plat_ebay', proprietaire: true });
    dit(ep.ebayAdmin !== 'proprietaire' && !/docs\/ebay-api|clés eBay dans Vercel/.test(ep.texte), 'eBay non configuré : la vendeuse lit « pas encore activé sur VRM », pas la marche à suivre Vercel', `data-ebay-admin=${ep.ebayAdmin}`);
    dit(epp.ebayAdmin !== 'vendeur', "l'autre sens : le propriétaire garde la marche à suivre", `data-ebay-admin=${epp.ebayAdmin}`);
    console.log('— 7. L’assistant IA');
    dit(!ecrans.annonces.rediger, 'aucun bouton « ✨ Rédiger » chez une vendeuse (la clé du serveur est celle de Julien, §2.9)');
    console.log('— téléphone');
    const t = await rendre(nav, { tab: 'cat_bord', telephone: true });
    dit(!t.erreurs.length && t.sansCompteColis, 'Colis au téléphone : le même geste, aucune erreur', t.erreurs.join(' | '));
  } catch (e) {
    dit(false, 'le banc a levé', String(e && e.stack || e).slice(0, 300));
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
