// Banc : Comptabilité → « Facturation électronique » → SUPER PDP (16 octobre).
//   node scripts/bancs/superpdp.cjs        (BANC_PORT=4941 par défaut)
//
// Données INVENTÉES (le dépôt est public). Le serveur (/api/superpdp) est un
// FAUX qui imite les réponses de la vraie route (api/_lib/superpdp.js) — la
// route elle-même est exécutée par scripts/audit-superpdp-route.cjs. Aucun
// appel réel à Super PDP. À 390 px (téléphone émulé) et 1512 px, il exige :
//   A. pas connecté ⇒ le formulaire (bac à sable / production, identifiant,
//      secret) ; « Connecter » envoie les deux UNE fois, puis les champs se
//      VIDENT et le secret n'apparaît plus NULLE PART dans la page (ni DOM, ni
//      valeur d'un champ) ; l'état passe à « connecté · bac à sable » ;
//   B. « Envoyer à Super PDP » sur une vente : la requête porte le numéro
//      FX-AAAA-0001 et un PDF (commence par %PDF-, contient factur-x.xml) ; la
//      ligne dit « envoyée » avec l'identifiant rendu ; le bouton Envoyer
//      disparaît de cette ligne (aucun double envoi possible d'un clic) ;
//   C. refusée ⇒ la ligne dit « refusée » et la raison de la plateforme ;
//   D. coupure (la réponse n'arrive pas) ⇒ « incertaine », JAMAIS « refusée »,
//      et « Relire » est proposé (pas « Envoyer ») ;
//   E. lecture de la connexion ratée (503) ⇒ ni « connecté » ni formulaire, ni
//      bouton Envoyer : « pas su » ;
//   F. aucun débordement horizontal, aucune erreur d'app.
// On juge des `data-*`, des requêtes et du DOM, jamais un libellé (§6.5).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4941;
const CAPT = process.env.CAPTURES || os.tmpdir();

const auj = new Date();
const jj = Math.max(4, Math.min(auj.getDate(), 28));
const jour = (d, decal = 0) => new Date(auj.getFullYear(), auj.getMonth() + decal, Math.min(d, jj), 12).toISOString();
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const PIEGE = 'Jean <script>&"';
const vente = (id, titre, prix, statut, date, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date, ...extra });
const VENTES = [
  vente(7001, 'Nike test facture', 80, 'Commande finalisée', jour(jj - 3), { buyerName: PIEGE }),
  vente(7002, 'Adidas test versée le mois dernier', 25, 'Commande finalisée', jour(10, -1)),
  vente(7003, 'Puma test annulée', 30, 'Commande annulée', jour(jj - 1)),
  vente(7004, 'Asics test vendue le mois dernier', 40, 'Commande finalisée', jour(25, -1)),
];
const VERS = { 7001: jour(jj - 2), 7002: jour(12, -1), 7004: jour(1) };
const SANS_VERSEMENT = vente(7005, 'Salomon test pas encore datée', 33, 'Commande finalisée', jour(jj - 1));
const EBAY = [{ orderId: 'E9', orderPaymentStatus: 'PAID', creationDate: jour(jj - 2), pricingSummary: { total: { value: '60.00', currency: 'EUR' } }, lineItems: [{ title: 'Salomon test ebay' }] }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PROFIL_OK = { nom: 'Boutique Test', siret: '73282932000074', adresse: '1 rue des Tests', codePostal: '35260', ville: 'Cancale' };
const ATTENDU = { total: '180.00', n: 3, siren: '732829320' };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const lignes = ({ profil, sansVersement }) => [
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  ...(profil ? [{ id: 'vrm_pro_facture', data: profil }] : []),
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: sansVersement ? [...VENTES, SANS_VERSEMENT] : VENTES } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
];
const brancher = async (pg, rows) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() === 'POST' || req.method() === 'PATCH') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ Playwright prend la DERNIÈRE route enregistrée en premier (§6.6) : la
  // route précise du faux Super PDP vient APRÈS le fourre-tout.
  await pg.route('**/api/superpdp**', (r) => fauxSuperPdp(r));
};


const SECRET = 'bon-secret-xyz-0042', CID = 'cid-banc-0001';
let etat, requetes;
const remettre = () => { etat = { connecte: false, env: null, envois: {}, passu: false, n: 0 }; requetes = []; };
remettre();
async function fauxSuperPdp(route) {
  const req = route.request(); const m = req.method();
  const j = (code, d) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(d) });
  if (m === 'GET') {
    if (etat.passu) return j(503, { erreur: 'pas-su', message: 'base injoignable' });
    return j(200, { ok: true, coffre: true, connecte: etat.connecte, illisible: false, env: etat.env, depuis: etat.connecte ? new Date().toISOString() : null, envois: etat.envois });
  }
  let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (_) {}
  requetes.push(b);
  if (b.action === 'connecter') {
    if (b.client_secret !== SECRET) return j(400, { erreur: 'refuse', message: 'Super PDP refuse ces identifiants : « invalid_client ».' });
    etat.connecte = true; etat.env = b.environnement; return j(200, { ok: true, connecte: true, env: b.environnement });
  }
  if (b.action === 'envoyer') {
    etat.n++;
    if (etat.n === 2) { const e = { etat: 'refuse', raison: 'BR-FR-10 : SIREN du vendeur absent de l\'annuaire', at: new Date().toISOString(), env: etat.env }; etat.envois[b.numero] = e; return j(422, { ok: false, erreur: 'refuse', message: 'Super PDP a refusé la facture : « ' + e.raison + ' »', envoi: e }); }
    if (etat.n === 3) { etat.envois[b.numero] = { etat: 'incertain', at: new Date().toISOString(), env: etat.env }; return route.abort('connectionreset'); }
    const e = { etat: 'envoye', id: 'inv-' + etat.n, statut: 'fr:200', at: new Date().toISOString(), env: etat.env }; etat.envois[b.numero] = e;
    return j(200, { ok: true, envoi: e });
  }
  if (b.action === 'relire') return j(200, { ok: true, envoi: etat.envois[b.numero] || null });
  return j(400, { erreur: 'action' });
}

const lire = (pg) => pg.evaluate((s) => {
  const at = (sel, a) => { const e = document.querySelector(sel); return e ? e.getAttribute(a) : null; };
  const ligne = (id) => { const l = document.querySelector(`[data-fe-vente="${id}"]`); if (!l) return null; const st = l.querySelector('[data-spdp-statut]');
    return { statut: st ? st.getAttribute('data-spdp-statut') : null, texte: st ? st.innerText : '', envoyer: !!l.querySelector('[data-spdp-envoyer]'), envoyerActif: !!l.querySelector('[data-spdp-envoyer]:not([disabled])'), relire: !!l.querySelector('[data-spdp-relire]') }; };
  const champs = [...document.querySelectorAll('input')].map((i) => i.value);
  return {
    etat: at('[data-spdp]', 'data-spdp-etat'), env: at('[data-spdp-env]', 'data-spdp-env'),
    form: !!document.querySelector('[data-spdp-secret]'),
    id: (document.querySelector('[data-spdp-id]') || {}).value, secret: (document.querySelector('[data-spdp-secret]') || {}).value,
    fuite: document.documentElement.outerHTML.includes(s) || champs.some((v) => v.includes(s)),
    nEnvoyer: document.querySelectorAll('[data-spdp-envoyer]').length,
    l1: ligne('vinted:7001'), l2: ligne('ebay:E9'), l3: ligne('vinted:7004'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
}, SECRET);
const attendre = async (pg, f, ms = 9000) => { const t0 = Date.now(); for (;;) { const r = await lire(pg); if (f(r) || Date.now() - t0 > ms) return r; await pg.waitForTimeout(200); } };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ouvrir = async (vp) => {
      const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      pg.setDefaultTimeout(5000);
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_regime', JSON.stringify('micro')); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await brancher(pg, lignes({ profil: PROFIL_OK }));
      await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
      return { ctx, pg, errs };
    };
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      remettre();
      console.log(`── ${vp.width} px · A : connexion`);
      const { ctx, pg, errs } = await ouvrir(vp);
      const r0 = await attendre(pg, (r) => r.etat === 'deconnecte' && r.l1);
      dit(r0.etat === 'deconnecte' && r0.form, 'pas connecté ⇒ le formulaire de connexion', r0.etat);
      dit(r0.nEnvoyer === 0, 'pas connecté ⇒ aucun bouton « Envoyer à Super PDP »', String(r0.nEnvoyer));
      try {
        await pg.click('[data-spdp-choix="sandbox"]');
        await pg.fill('[data-spdp-id]', CID);
        await pg.fill('[data-spdp-secret]', SECRET);
        await pg.click('[data-spdp-connecter]');
      } catch (e) { dit(false, 'le formulaire se remplit', String(e.message).slice(0, 120)); }
      const r1 = await attendre(pg, (r) => r.etat === 'connecte');
      const conn = requetes.filter((x) => x.action === 'connecter');
      dit(conn.length === 1 && conn[0].client_secret === SECRET && conn[0].client_id === CID && conn[0].environnement === 'sandbox', 'les identifiants partent UNE fois au serveur, avec l’environnement choisi', JSON.stringify(conn.map((x) => x.environnement)));
      dit(r1.etat === 'connecte' && r1.env === 'sandbox', 'connecté · bac à sable', `${r1.etat} · ${r1.env}`);
      dit(!r1.fuite && !r1.form, 'le secret a quitté la page : ni dans le DOM, ni dans un champ (et le formulaire est parti)', `fuite=${r1.fuite}`);

      console.log(`── ${vp.width} px · B : envoyée`);
      try { await pg.click('[data-spdp-envoyer="vinted:7001"]'); } catch (e) { dit(false, 'le bouton Envoyer existe', String(e.message).slice(0, 120)); }
      const r2 = await attendre(pg, (r) => r.l1 && r.l1.statut === 'envoye');
      const env1 = requetes.filter((x) => x.action === 'envoyer')[0] || {};
      const pdf = env1.pdf ? Buffer.from(env1.pdf, 'base64') : Buffer.alloc(0);
      dit(/^FX-\d{4}-0001$/.test(env1.numero || ''), 'la requête porte le numéro FX-AAAA-0001', env1.numero);
      dit(pdf.subarray(0, 5).toString('latin1') === '%PDF-' && pdf.includes('factur-x.xml'), 'et un PDF Factur-X (%PDF-, factur-x.xml joint)', `${pdf.length} octets`);
      dit(r2.l1 && r2.l1.statut === 'envoye' && /inv-1/.test(r2.l1.texte), 'la ligne dit « envoyée » avec l’identifiant de la plateforme', r2.l1 && r2.l1.texte);
      dit(r2.l1 && !r2.l1.envoyer && r2.l1.relire, 'plus de bouton Envoyer sur cette ligne (pas de double envoi d’un clic) — « Relire » à la place');

      console.log(`── ${vp.width} px · C : refusée`);
      try { await pg.click('[data-spdp-envoyer="ebay:E9"]'); } catch (e) { dit(false, 'le bouton Envoyer (eBay) existe', String(e.message).slice(0, 120)); }
      const r3 = await attendre(pg, (r) => r.l2 && r.l2.statut === 'refuse');
      dit(r3.l2 && r3.l2.statut === 'refuse' && /BR-FR-10/.test(r3.l2.texte), 'refusée ⇒ la ligne le dit avec la raison de la plateforme', r3.l2 && r3.l2.texte);
      dit(r3.l2 && r3.l2.envoyerActif, 'une refusée peut être renvoyée (corrigée)');

      console.log(`── ${vp.width} px · D : coupure`);
      try { await pg.click('[data-spdp-envoyer="vinted:7004"]'); } catch (e) { dit(false, 'le bouton Envoyer (7004) existe', String(e.message).slice(0, 120)); }
      const r4 = await attendre(pg, (r) => r.l3 && r.l3.statut === 'incertain');
      dit(r4.l3 && r4.l3.statut === 'incertain', 'la réponse n’arrive pas ⇒ « incertaine », jamais « refusée »', r4.l3 && r4.l3.statut);
      dit(r4.l3 && r4.l3.relire && !r4.l3.envoyer, '« Relire » est proposé, pas « Envoyer »');

      const rf = await lire(pg);
      dit(rf.sw <= rf.cw + 1, 'aucun débordement horizontal', `${rf.sw} > ${rf.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      const carte = await pg.$('[data-fe-carte]');
      if (carte) { await pg.setViewportSize({ width: vp.width, height: 2800 }); await pg.waitForTimeout(300); await carte.scrollIntoViewIfNeeded(); await carte.screenshot({ path: path.join(CAPT, `superpdp-${vp.width}.png`) }); }
      await ctx.close();

      console.log(`── ${vp.width} px · E : connexion pas lue`);
      remettre(); etat.passu = true;
      { const o = await ouvrir(vp); const r = await attendre(o.pg, (x) => x.etat === 'passu' && x.l1);
        dit(r.etat === 'passu' && !r.form && r.env == null && r.nEnvoyer === 0, '503 ⇒ ni « connecté », ni formulaire, ni bouton Envoyer : « pas su »', `${r.etat} · form=${r.form} · ${r.nEnvoyer}`);
        dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
        await o.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc se déroule', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
