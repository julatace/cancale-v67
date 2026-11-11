// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN, TROIS OUTILS DE PLUS (11 nov., lot lbc-plus — extension 5.363)
//        node scripts/audit-lbc-plus.cjs [--prouve]
//
//  1. BAISSER LE PRIX en série, sur SON clic :
//   A. le VRAI lbc-inject.js dans Chromium, sous le nom de leboncoin.fr (réponses
//      INVENTÉES — la vraie requête de Leboncoin n'a jamais été vue d'ici) :
//      · un changement de prix fait PAR LA PAGE ⇒ une RECETTE (chemin à trou `{ad}`,
//        clé du prix, unité lue dans le NOM de la clé, NOMS des en-têtes) — jamais le
//        prix tapé, jamais une valeur d'en-tête ;
//      · une écriture qui porte toute l'annonce (titre, description) ⇒ « pas
//        rejouable » ; une adresse d'argent (paiement, options) ⇒ rien n'est appris ;
//      · l'ordre « prix » rejoue la recette au nom du compte de la page SEULEMENT, avec
//        les en-têtes que la page vient d'envoyer, et rend le prix que Leboncoin montre.
//   B. le VRAI background.js dans un `vm` (`_fond-vm.cjs`) : SA commande seulement ;
//      recette apprise ; prix EN BASE = celui de l'aperçu ; une baisse (jamais une
//      hausse) ; onglet du MÊME compte (aucun onglet ouvert à sa place) ; 45/h (réserve
//      5) ; 429 ⇒ pause 30 min ; un arrêt avant l'envoi rend sa place ; « relu » =
//      seulement le prix montré par Leboncoin ; `lbcRelire` relit en base.
//  2. LES RÈGLES PURES (src/lbcPlus.js, api/_lib/remises-main-propre.js) : la liste
//     proposée (pas su ⇒ rien), la limite d'une fois par N jours, l'espacement, l'ordre,
//     la remise (saisie, rappel une heure avant, « Remis » : stock par identité, date).
//  3. LA VRAIE ROUTE `api/ship-reminders.js?moment=groupe` (fausse base à la vraie
//     forme, téléphone intercepté, horloge fixée) : UNE notification une heure avant,
//     mémo écrit AVANT l'envoi, rien deux fois, `main` lu projeté et filtré.
//  `--prouve` : 8 mutations, chacune doit finir en rouge.
//  Données inventées (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const iSur = process.argv.indexOf('--sur');
const R = iSur > 0 ? path.resolve(process.argv[iSur + 1]) : RACINE;
const NM = path.join(RACINE, 'node_modules');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['recette : corps complet accepté', 'vinted-sync-extension/lbc-inject.js', "if (trop || fixes.length > 8) return non('corps-complet');\n    if (autre) return non(autre);", "if (trop || fixes.length > 8) return non('corps-complet');"],
    ['recette : adresse d\'argent apprise', 'vinted-sync-extension/lbc-inject.js', "    if (PAS_PRIX_LBC.test(u.pathname)) return null;\n    if (typeof corps !== 'string' || !/price|prix|amount/i.test(corps)) return null;", "    if (typeof corps !== 'string' || !/price|prix|amount/i.test(corps)) return null;"],
    ['ordre : compte de la page ignoré', 'vinted-sync-extension/lbc-inject.js', "    if (!moi || String(d.compte || '') !== moi) return fin({ statut: 0, erreur: moi ? 'autre-compte' : 'compte-pas-su' });\n    const h = {};\n    const src = entetesApi", "    const h = {};\n    const src = entetesApi"],
    ['fond : prix de l\'aperçu pas revérifié', 'vinted-sync-extension/background.js', "if (!Number.isFinite(prixBase) || Math.round(prixBase * 100) !== Math.round(avant * 100)) return", "if (false) return"],
    ['fond : plafond sans réserve', 'vinted-sync-extension/background.js', "const cpt = await compterAction('lbc:' + compte, ACTIONS_MAX_HEURE - RESERVE_GESTES);", "const cpt = await compterAction('lbc:' + compte, ACTIONS_MAX_HEURE);"],
    ['fond : « fait » sans prix relu', 'vinted-sync-extension/background.js', "return { accepte: true, etape: 'envoye', statut, note, raison: 'Leboncoin a accepté ; le prix sera relu sur « Mes annonces »' };", "return { accepte: true, etape: 'fait', statut, prixVu: nouveau, note };"],
    ['remise : rappel sans mémo', 'api/_lib/remises-main-propre.js', " && !m[cleEnvoiRemise(r)];", ";"],
    ['remis : stock deviné sur plusieurs fiches', 'src/lbcPlus.js', "    if (ids.length === 1) {", "    if (ids.length >= 1) {"],
  ];
  let rouges = 0;
  for (const [nom, fichier, avant, apres] of MUT) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lbcplus-mut-'));
    for (const x of ['api', 'src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
    fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
    const f = path.join(d, fichier); const t = fs.readFileSync(f, 'utf8');
    if (!t.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges = -999; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, t.replace(avant, apres));
    let code = 0;
    try { execFileSync(process.execPath, [path.join(d, 'scripts', 'audit-lbc-plus.cjs'), '--sur', d], { stdio: 'pipe', env: { ...process.env, NODE_PATH: NM } }); } catch (e) { code = e.status || 1; }
    console.log(`${code ? '✅' : '❌'} mutation « ${nom} » ⇒ ${code ? 'rouge (attendu)' : 'VERT : l’audit ne la voit pas'}`);
    if (code) rouges++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${MUT.length} mutations rouges`);
  process.exit(rouges === MUT.length ? 0 : 1);
}

const { faireFond } = require(path.join(R, 'scripts', '_fond-vm.cjs'));
const EXT = path.join(R, 'vinted-sync-extension');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 600) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${String((e && e.stack) || e).slice(0, 500)}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const U1 = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';   // son compte Leboncoin (inventé)
const U3 = '9e9e9e9e-2222-4333-8444-955566667777';   // un autre compte (inventé)
const AD = '2123456789';
const SECRET = 'jeton-tres-secret';
const URL_PRIX = `https://api.leboncoin.fr/api/adeditor/v1/classifieds/${AD}/price`;

(async () => {
  // ══ A. lbc-inject.js dans un vrai navigateur ═════════════════════════════
  await essaie('A. lbc-inject.js', async () => {
    let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(NM, 'playwright'))); }
    const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
    const inj = fs.readFileSync(path.join(EXT, 'lbc-inject.js'), 'utf8');
    const ouvrir = async (compte) => {
      const c = await nav.newContext(); const p = await c.newPage();
      const recues = [];
      await c.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
      await c.route('https://api.leboncoin.fr/**', async (r) => {
        const q = r.request(); const u = q.url();
        recues.push({ methode: q.method(), url: u, entetes: q.headers(), corps: q.postData() });
        let body = {};
        if (/\/api\/account\/v1\/members\/me\/account$/.test(u)) body = { account: { account_id: compte, type: 'private', email: 'moi@exemple.test' }, member: { account_id: compte } };
        else if (/\/price$/.test(u) && /^(PUT|PATCH|POST)$/.test(q.method())) { let j = {}; try { j = JSON.parse(q.postData() || '{}'); } catch (_) {} body = { list_id: Number(AD), price: j.price || null }; }
        else body = { ok: true };
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
      });
      await p.goto('https://www.leboncoin.fr/compte/part/mes-annonces');
      await p.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_LBC")window.__msgs.push(e.data)});' });
      await p.addScriptTag({ content: inj });
      await p.evaluate(() => window.postMessage({ __tag: 'CANCALE_LBC_RELAY', kind: 'pret' }, '*'));
      return { c, p, recues, msgs: (k) => p.evaluate((kk) => window.__msgs.filter((m) => m.kind === kk), k) };
    };
    const ordre = (A, o) => A.p.evaluate(async (oo) => {
      const p = new Promise((ok) => { window.addEventListener('message', (e) => { if (e.data && e.data.__tag === 'CANCALE_LBC' && e.data.kind === 'lbcprixresultat' && e.data.jeton === oo.jeton) ok(e.data); }); setTimeout(() => ok(null), 4000); });
      window.postMessage(Object.assign({ __tag: 'CANCALE_LBC_ORDRE', kind: 'prix' }, oo), '*');
      return p;
    }, o);
    const A = await ouvrir(U1);
    const H = { 'x-lbc-auth': SECRET, 'content-type': 'application/json' };
    await A.p.evaluate(async () => { await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then((r) => r.text()); });
    await pause(200);
    // Le changement de prix que fait la PAGE (son geste) : la recette.
    await A.p.evaluate(async ([h, u]) => { await fetch(u, { method: 'PUT', headers: h, body: JSON.stringify({ price: [47], list_id: 2123456789 }) }).then((r) => r.text()); }, [H, URL_PRIX]);
    await pause(300);
    const rec = (await A.msgs('lbcprixappris'))[0];
    const r = rec && rec.recette;
    dit(!!r && r.rejouable === true && r.methode === 'PUT' && r.hote === 'api.leboncoin.fr' && r.modele === '/api/adeditor/v1/classifieds/{ad}/price', 'A1 un prix changé PAR LA PAGE ⇒ une recette rejouable : chemin à trou `{ad}`', JSON.stringify(r));
    dit(!!r && JSON.stringify(r.clePrix) === '["price"]' && r.formePrix === 'tableau' && r.unite === 'eur' && JSON.stringify(r.cleIds) === '[[["list_id"],"nombre"]]', 'A2 la clé du prix, sa forme, son unité (lue dans le NOM de la clé), la clé de l’annonce', JSON.stringify(r && { p: r.clePrix, f: r.formePrix, u: r.unite, i: r.cleIds }));
    dit(!!r && JSON.stringify(r.entetes) === '["x-lbc-auth"]' && !JSON.stringify(rec).includes(SECRET) && !/\b47\b/.test(JSON.stringify(rec)), 'A3 les NOMS des en-têtes seulement — jamais leur valeur, jamais le prix tapé', JSON.stringify(rec));
    await A.p.evaluate(async ([h]) => {
      await fetch('https://api.leboncoin.fr/api/adeditor/v1/classifieds/2123456789', { method: 'PUT', headers: h, body: JSON.stringify({ subject: 'Nike Air Max 90 taille 42', body: 'Très bon état, peu portées.', price: [45], list_id: 2123456789 }) }).then((r) => r.text());
      await fetch('https://api.leboncoin.fr/api/adeditor/v1/classifieds/price', { method: 'PATCH', headers: h, body: JSON.stringify({ price_cents: 4500, list_id: 2123456789 }) }).then((r) => r.text());
      await fetch('https://api.leboncoin.fr/api/payment/v1/options/checkout', { method: 'POST', headers: h, body: JSON.stringify({ price: 299, list_id: 2123456789, option: 'urgent' }) }).then((r) => r.text());
    }, [H]);
    await pause(300);
    const autres = (await A.msgs('lbcprixappris')).slice(1).map((m) => m.recette);
    dit(autres.length === 2 && autres[0].rejouable === false && autres[0].raison === 'corps-complet', 'A4 une écriture qui porte TOUTE l’annonce (titre, description) : « pas rejouable », avec la raison', JSON.stringify(autres[0]));
    dit(autres.length === 2 && autres[1].rejouable === true && autres[1].unite === 'cts' && JSON.stringify(autres[1].clePrix) === '["price_cents"]', 'A5 « price_cents » ⇒ le prix part en CENTIMES (l’unité lue dans le nom du champ)', JSON.stringify(autres[1]));
    dit(!autres.some((x) => /payment|option|checkout/.test(String(x && x.chemin))), 'A6 une adresse d’argent (paiement, options) n’est jamais apprise', JSON.stringify(autres.map((x) => x.chemin)));
    // L'ordre « prix » : la recette rejouée telle quelle.
    const avant = A.recues.length;
    const res = await ordre(A, { jeton: 'jeton-ordre-0001', id: AD, prix: 42, recette: r, compte: U1 });
    const env = A.recues.slice(avant).filter((x) => x.methode === 'PUT');
    dit(!!res && res.statut === 200 && res.prixVu === 42, 'A7 l’ordre part et rend le prix que Leboncoin MONTRE pour cette annonce', JSON.stringify(res));
    dit(env.length === 1 && env[0].url === URL_PRIX && env[0].corps === JSON.stringify({ list_id: Number(AD), price: [42] }), 'A8 UNE requête : l’adresse et le corps de la recette, le nouveau prix à sa place', JSON.stringify(env.map((x) => [x.url, x.corps])));
    dit(env.length === 1 && env[0].entetes['x-lbc-auth'] === SECRET, 'A9 avec l’en-tête que la PAGE vient d’envoyer à l’API', JSON.stringify(env[0] && env[0].entetes));
    const n1 = A.recues.length;
    const res2 = await ordre(A, { jeton: 'jeton-ordre-0002', id: AD, prix: 40, recette: r, compte: U3 });
    dit(!!res2 && res2.statut === 0 && res2.erreur === 'autre-compte' && A.recues.length === n1, 'A10 un ordre au nom d’un AUTRE compte que celui de la page : rien ne part', JSON.stringify(res2));
    const res3 = await ordre(A, { jeton: 'jeton-ordre-0003', id: AD, prix: 40, recette: Object.assign({}, r, { hote: 'evil.exemple.test' }), compte: U1 });
    const res3b = await ordre(A, { jeton: 'jeton-ordre-0004', id: AD, prix: 40, recette: Object.assign({}, r, { modele: '/api/payment/v1/{ad}/price' }), compte: U1 });
    dit(!!res3 && res3.erreur === 'recette' && !!res3b && res3b.erreur === 'recette' && A.recues.length === n1, 'A11 une recette vers un autre hôte, ou une adresse d’argent : refusée, rien ne part', JSON.stringify([res3, res3b]));
    await A.c.close();
    const B = await ouvrir(U1);
    await B.p.evaluate(async () => { await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then((r) => r.text()); });
    await pause(200);
    const nb = B.recues.length;
    const res4 = await ordre(B, { jeton: 'jeton-ordre-0005', id: AD, prix: 40, recette: r, compte: U1 });
    dit(!!res4 && res4.statut === 0 && res4.erreur === 'entetes' && B.recues.length === nb, 'A12 une page qui n’a pas encore parlé à l’API avec ses en-têtes : RIEN ne part, et c’est dit', JSON.stringify(res4));
    await B.c.close();
    await nav.close();
    globalThis.__recette = r;
  });

  // ══ B. background.js dans un vm ══════════════════════════════════════════
  await essaie('B. background.js', async () => {
    const recette = globalThis.__recette || { methode: 'PUT', hote: 'api.leboncoin.fr', chemin: '/api/adeditor/v1/classifieds/{id}/price', rejouable: true, raison: '', modele: '/api/adeditor/v1/classifieds/{ad}/price', recherche: '', clePrix: ['price'], formePrix: 'tableau', unite: 'eur', cleIds: [[['list_id'], 'nombre']], fixes: [], entetes: ['x-lbc-auth'] };
    const LBC = 'https://www.leboncoin.fr/compte/part/mes-annonces';
    const annonces = () => ({ items: { [AD]: { id: AD, subject: 'Nike Air Max 90', price: 45, account: U1, status: 'active', seenAt: '2026-11-11T08:00:00.000Z', ref: '124' } } });
    const faire = (opts = {}) => {
      const f = faireFond({ src: path.join(EXT, 'background.js'), lignes: { lbc_listings: annonces() }, onglets: opts.onglets || [{ id: 41, url: LBC, active: true }], lectureKO: opts.lectureKO || (() => false),
        store: Object.assign({ vrmLbcTransport: opts.cartes || { 41: { source: 'prive', compte: 'lbc-account:' + U1, ambigue: false, at: Date.now() } } }, opts.store || {}) });
      const ordres = [];
      f.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
        if (m && m.__vmrEvt) { f.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
        ordres.push({ id, m: JSON.parse(JSON.stringify(m)) });
        return Promise.resolve(opts.rep ? opts.rep(m) : { ok: true, statut: 200, prixVu: m.prix, cles: [] });
      };
      const page = (msg, tabId = 41, url = LBC) => f.envoyer(Object.assign({ from: 'cancale-lbc' }, msg), { tab: { id: tabId, url }, frameId: 0 });
      const cmd = (msg) => f.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
      return { ...f, ordres, page, cmd };
    };
    const baisse = (o = {}) => Object.assign({ cmd: 'lbcPrix', id: AD, prixAvant: 45, prix: 42, confirme: true }, o);
    const F = faire();
    const r0 = await F.cmd(baisse());
    dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && /change UN prix toi-même/.test(r0.raison) && F.ordres.length === 0, 'B1 sans recette apprise : RIEN ne part, le geste est dit', JSON.stringify(r0));
    await F.page({ action: 'lbcPrixAppris', recette: Object.assign({}, recette, { entetes: ['x-lbc-auth', 'cookie'] }) });
    dit(F.lignes.lbc_prix_recette && F.lignes.lbc_prix_recette.appris === true && JSON.stringify(F.store.vrmLbcPrixRecette.recette.entetes) === '["x-lbc-auth"]', 'B2 la recette est rangée (sans en-tête interdit), `lbc_prix_recette.appris` pour l’app', JSON.stringify(F.lignes.lbc_prix_recette));
    await F.page({ action: 'lbcPrixAppris', recette: { methode: 'PUT', hote: 'api.leboncoin.fr', chemin: '/x', rejouable: false, raison: 'corps-complet' } });
    dit(F.store.vrmLbcPrixRecette.recette.rejouable === true, 'B3 un essai « pas rejouable » ne remplace jamais une recette rejouable');
    const pg = await F.page({ action: 'lbcPrix', id: AD, prixAvant: 45, prix: 40, cmd: 'lbcPrix', confirme: true });
    dit(F.ordres.length === 0, 'B4 un message venu de la PAGE Leboncoin (pas de SA commande) : rien ne part', JSON.stringify(pg));
    const rC = await F.cmd(baisse({ confirme: false }));
    const rH = await F.cmd(baisse({ prix: 50 }));
    const rP = await F.cmd(baisse({ prixAvant: 50, prix: 47 }));
    dit(rC && rC.code === 'confirmation' && rH && rH.code === 'invalide' && rP && rP.code === 'perime' && rP.prixVu === 45 && F.ordres.length === 0, 'B5 sans confirmation, une HAUSSE, ou un prix en base différent de l’aperçu : rien ne part', JSON.stringify([rC, rH, rP]));
    const r1 = await F.cmd(baisse());
    dit(r1 && r1.accepte === true && r1.etape === 'fait' && r1.prixVu === 42 && F.ordres.length === 1 && F.ordres[0].id === 41 && F.ordres[0].m.action === 'lbcPrixAnnonce' && F.ordres[0].m.prix === 42 && F.ordres[0].m.compte === U1, 'B6 sur SA commande : UN ordre vers l’onglet du compte de l’annonce ; « fait » seulement avec le prix RELU', JSON.stringify({ r1, o: F.ordres.map((x) => x.m.action) }));
    const it = F.lignes.lbc_listings.items[AD];
    dit(it.prixDemande && it.prixDemande.de === 45 && it.prixDemande.a === 42 && it.price === 45, 'B7 la demande est notée sur l’annonce ; son PRIX ne change qu’à une capture (la donnée lue gagne)', JSON.stringify(it));
    dit(((F.store.vrmActions || {})['lbc:' + U1] || []).length === 1, 'B8 UNE action comptée dans le plafond de l’heure du compte Leboncoin', JSON.stringify(F.store.vrmActions));
    F.store.vrmActions = { ['lbc:' + U1]: Array.from({ length: 45 }, () => Date.now()) };
    const r4 = await F.cmd(baisse());
    dit(r4 && r4.accepte === false && r4.code === 'plafond' && F.ordres.length === 1, 'B9 45 actions dans l’heure (50, réserve 5) : refus, rien ne part', JSON.stringify(r4));
    F.store.vrmActions = {};
    const S = faire({ rep: () => ({ ok: true, statut: 200, cles: [] }) });
    await S.page({ action: 'lbcPrixAppris', recette });
    const s1 = await S.cmd(baisse());
    dit(s1 && s1.accepte === true && s1.etape === 'envoye' && s1.prixVu == null, 'B10 accepté sans prix montré : « envoyé, à relire » — jamais « fait »', JSON.stringify(s1));
    const M = faire({ cartes: { 41: { source: 'prive', compte: 'lbc-account:' + U3, ambigue: false, at: Date.now() } } });
    await M.page({ action: 'lbcPrixAppris', recette });
    const m1 = await M.cmd(baisse());
    M.store.vrmLbcTransport = {};
    const m2 = await M.cmd(baisse());
    dit(m1 && m1.code === 'autre-compte' && m2 && m2.code === 'lbc-absent' && M.ordres.length === 0, 'B11 Leboncoin ouvert sur un AUTRE compte, ou aucun onglet du compte : rien ne part, aucun onglet ouvert à sa place', JSON.stringify([m1, m2]));
    const G = faire({ rep: () => ({ ok: true, statut: 429, cles: [] }) });
    await G.page({ action: 'lbcPrixAppris', recette });
    const g1 = await G.cmd(baisse());
    const g2 = await G.cmd(baisse());
    dit(g1 && g1.etape === 'echec' && g1.code === 'lbc-pause' && G.store.vrmPauseLbcPrix && g2 && g2.accepte === false && g2.code === 'lbc-pause' && G.ordres.length === 1, 'B12 un 429 de Leboncoin pose la pause ; pendant la pause, RIEN ne part', JSON.stringify({ g1, g2, n: G.ordres.length }));
    const K = faire({ rep: () => ({ ok: true, statut: 0, erreur: 'entetes', cles: [] }) });
    await K.page({ action: 'lbcPrixAppris', recette });
    const k1 = await K.cmd(baisse());
    dit(k1 && k1.accepte === false && k1.code === 'entetes' && ((K.store.vrmActions || {})['lbc:' + U1] || []).length === 0, 'B13 arrêté avant de partir (pas d’en-têtes) : dit, et la place du plafond RENDUE', JSON.stringify({ k1, a: K.store.vrmActions }));
    const L = faire({ lectureKO: (u) => /lbc_listings/.test(u) });
    await L.page({ action: 'lbcPrixAppris', recette });
    const l1 = await L.cmd(baisse());
    dit(l1 && l1.accepte === false && l1.code === 'lecture' && L.ordres.length === 0, 'B14 la base illisible : rien ne part chez Leboncoin', JSON.stringify(l1));
    F.lignes.lbc_listings.items['3000000001'] = { id: '3000000001', price: 60, account: U1, status: 'active', ref: '124', seenAt: '2026-11-11T09:00:00.000Z' };
    const rl = await F.cmd({ cmd: 'lbcRelire', ids: [AD], refs: ['124'] });
    dit(rl && rl.annonces && rl.annonces[AD] && rl.annonces[AD].prix === 45 && rl.parRef && rl.parRef['124'] && rl.parRef['124'].map((x) => x.id).sort().join(',') === `${AD},3000000001`, 'B15 « relire » : l’annonce relue EN BASE ; la nouvelle annonce d’une republication se reconnaît à sa RÉFÉRENCE (identité)', JSON.stringify(rl));
    const etat = await F.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(etat && etat.lbcPrix === true, 'B16 l’état de l’extension dit `lbcPrix: true`', JSON.stringify(etat && Object.keys(etat)));
  });

  // ══ C. les règles pures ══════════════════════════════════════════════════
  const charge = (f) => import('file://' + path.join(R, f));
  let X = null, M = null;
  await essaie('C. règles', async () => {
    X = await charge('src/lbcPlus.js'); M = await charge('api/_lib/remises-main-propre.js');
    const T = Date.parse('2026-11-11T12:00:00Z');
    const a = (o) => Object.assign({ id: '1', prix: 50, favoris: 0, statsAt: '2026-11-10T08:00:00Z', publieeLe: '2026-10-01T08:00:00Z' }, o);
    const p = X.propositionBaisse(a(), { maintenant: T });
    dit(p.propose === true && p.raison === '0 favori en 41 jours', 'C1 0 favori LU, en ligne depuis 41 jours : proposée (« 0 favori en 41 jours »)', JSON.stringify(p));
    dit(X.propositionBaisse(a({ favoris: null }), { maintenant: T }).pasSu === 'stats' && X.propositionBaisse(a({ favoris: null }), { maintenant: T }).propose === false, 'C2 statistiques jamais relevées : « pas su », RIEN proposé (jamais « 0 favori »)');
    dit(X.propositionBaisse(a({ statsAt: '2026-10-20T08:00:00Z' }), { maintenant: T }).pasSu === 'stats-anciennes', 'C3 statistiques de plus de 7 jours : pas su, rien proposé');
    dit(X.propositionBaisse(a({ favoris: 2 }), { maintenant: T }).propose === false && X.propositionBaisse(a({ publieeLe: '2026-10-25T08:00:00Z' }), { maintenant: T }).propose === false, 'C4 des favoris, ou moins de 30 jours en ligne : pas proposée');
    const L = X.propositionsBaisse([a({ id: 'x', favoris: 3 }), a({ id: 'y' }), a({ id: 'z', favoris: null })], { maintenant: T });
    dit(L.lignes[0].id === 'y' && L.nProposees === 1 && L.nPasSu === 1, 'C5 la liste : les proposées d’abord, les « pas su » comptés', JSON.stringify(L));
    const j = { '124': '2026-10-20T10:00:00Z' };
    const l1 = X.limiteRepub(j, '124', 30, T), l2 = X.limiteRepub(j, '124', 14, T), l3 = X.limiteRepub(j, '88', 30, T);
    dit(l1.permis === false && new Date(l1.prochaine).toISOString().slice(0, 10) === '2026-11-19' && l2.permis === true && l3.permis === true, 'C6 une fois par 30 jours par annonce (réglable : 14 ⇒ permis), une autre annonce libre', JSON.stringify([l1, l2]));
    dit(X.joursRepub(5) === 30 && X.joursRepub('14') === 14, 'C7 un réglage hors des choix revient à 30 jours');
    dit(X.delaiEspacement({ mode: 'fixe', fixe: 4 }) === 240000 && X.delaiEspacement({ mode: 'alea', min: 2, max: 6 }, () => 0) === 120000 && X.delaiEspacement({ mode: 'alea', min: 2, max: 6 }, () => 1) === 360000 && X.delaiEspacement({ mode: 'fixe', fixe: 0 }) === 60000, 'C8 l’espacement : fixe, au hasard entre ses bornes, jamais moins d’une minute');
    dit(JSON.stringify(X.deplacer(['a', 'b', 'c'], 'c', -1)) === '["a","c","b"]' && JSON.stringify(X.deplacer(['a', 'b'], 'a', -1)) === '["a","b"]', 'C9 l’ordre : monter / descendre d’un cran');
    // Remise
    const N = Date.parse('2026-11-12T08:00:00Z');
    dit(M.remiseSaisie({ tx: '', jour: '2026-11-12', heure: '15:00', lieu: 'Gare' }, N).erreur === 'vente' && M.remiseSaisie({ tx: '123', jour: '2026-11-12', heure: '15:00', lieu: '  ' }, N).erreur === 'lieu' && M.remiseSaisie({ tx: '123', jour: '2026-11-12', heure: '08:30', lieu: 'Gare' }, N).erreur === 'passe', 'C10 rien n’est créé sans vente (identité), sans lieu, ni pour une heure passée');
    const s = M.remiseSaisie({ tx: '7001', num: '0124', jour: '2026-11-12', heure: '15:00', lieu: 'Gare, sortie nord' }, N, 'mbanc00001');
    dit(s.ok && s.remise.num === '124' && new Date(M.instantRemise('2026-11-12', '15:00')).toISOString() === '2026-11-12T14:00:00.000Z' && new Date(M.instantRemise('2026-07-01', '15:00')).toISOString() === '2026-07-01T13:00:00.000Z', 'C11 l’heure de Paris (hiver comme été), le N° en clé', JSON.stringify(s));
    const R0 = [s.remise];
    dit(M.remisesDues(R0, {}, Date.parse('2026-11-12T12:50:00Z')).length === 0 && M.remisesDues(R0, {}, Date.parse('2026-11-12T13:05:00Z')).length === 1 && M.remisesDues(R0, { [M.cleEnvoiRemise(s.remise)]: 'x' }, Date.parse('2026-11-12T13:05:00Z')).length === 0 && M.remisesDues(R0, {}, Date.parse('2026-11-12T14:10:00Z')).length === 0, 'C12 le rappel : une heure avant, pas avant, jamais deux fois, jamais après le rendez-vous');
    const c = { [s.remise.id]: s.remise };
    dit(M.finRemises(c) === '2026-11-12T14:00:00.000Z' && M.finRemises(M.annulerRemise(c, s.remise.id, N)) === '', 'C13 `vrm_remise_fin` : l’heure du dernier rendez-vous prévu (rien de prévu ⇒ vide)');
    const t = M.texteRappelRemise(s.remise);
    dit(t.title === 'Remise à 15 h 00 · N°124' && t.body === 'Rendez-vous : Gare, sortie nord', 'C14 « Remise à 15 h 00 · N°124 » — l’heure, le N°, le lieu ; aucun nom d’acheteur', JSON.stringify(t));
    const cle = (n) => String(n == null ? '' : n).trim().toUpperCase().replace(/^0+(?=\d)/, '');
    const fiches = { '555': { numero: '124' }, '556': { numero: '88' } };
    const base = { carte: c, remise: s.remise, vente: { txId: '7001', price: 4500 }, num: '124', fiches, dates: {}, decisions: {}, vendus: [], cle, maintenant: N };
    const o = X.opsRemis(base);
    const ks = o.ops.map((x) => x.k + ':' + x.id);
    dit(o.stock === 'sortie' && o.date === 'datee' && ks.join(',') === 'vrm_remises:mbanc00001,vrm_lbc_dates:7001,vrm_cycle_decisions:555,vinted_annonces_vendues:555' && o.ops[2].apres.choix === 'vendu-main' && o.ops[2].apres.numero === '124' && o.ops[2].apres.montant === 45 && o.ops[1].apres === '2026-11-12', 'C15 « Remis » : remise faite, vente datée d’aujourd’hui, la fiche du N° « vendue en main propre » (N° gardé), en UN geste', JSON.stringify(o.ops));
    const o2 = X.opsRemis({ ...base, vente: { txId: '7001', price: 4500, dateVente: '2026-11-10T10:00:00Z' } });
    const o3 = X.opsRemis({ ...base, dates: { '7001': '2026-11-11' } });
    dit(o2.date === 'deja' && o3.date === 'deja' && !o2.ops.some((x) => x.k === 'vrm_lbc_dates') && !o3.ops.some((x) => x.k === 'vrm_lbc_dates'), 'C16 une date LUE par l’extension (ou déjà saisie) gagne : rien n’est réécrit');
    const o4 = X.opsRemis({ ...base, fiches: { '555': { numero: '124' }, '557': { numero: '124' } } });
    const o5 = X.opsRemis({ ...base, num: '' });
    dit(o4.stock === 'plusieurs' && o5.stock === 'sans-numero' && !o4.ops.some((x) => x.k === 'vrm_cycle_decisions') && !o5.ops.some((x) => x.k === 'vrm_cycle_decisions'), 'C17 N° porté par DEUX fiches, ou aucun N° : rien ne sort du stock (rien de deviné)');
  });

  // ══ D. la vraie route ════════════════════════════════════════════════════
  await essaie('D. api/ship-reminders.js?moment=groupe', async () => {
    const J = '11111111-1111-4111-8111-111111111111';
    let base = new Map(); let panne = new Set(); let journal = []; let ordreE = [];
    const k = (o, i) => o + '|' + i;
    const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
    const projeter = (sel, id, owner, d) => {
      if (!sel || sel === 'data') return { id, owner, data: d };
      const out = {};
      for (const part of sel.split(',')) {
        if (part === 'owner') { out.owner = owner; continue; }
        if (part === 'id') { out.id = id; continue; }
        if (part === 'data') { out.data = d; continue; }
        const m = /^([a-zA-Z0-9_]+):data(->>?)(.+)$/.exec(part);
        if (!m) continue;
        let v = d; for (const seg of m[3].split(/->>?/)) v = v == null ? undefined : v[seg];
        out[m[1]] = m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : (v === undefined ? null : v);
      }
      return out;
    };
    global.fetch = async (url, o = {}) => {
      const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
      journal.push(`${m} ${decodeURIComponent(u.pathname + u.search)}`);
      if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
      if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
      const id = (q.get('id') || '').replace(/^eq\./, ''); const owner = (q.get('owner') || '').replace(/^eq\./, '');
      const sel = q.get('select') || '';
      if (m === 'GET') {
        if (sel === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
        if (panne.has(id)) return rep('<html>522</html>', 522);
        if (!id) return rep([]);
        const rows = [];
        for (const [kk, d] of base) {
          const [ow, i] = kk.split('|'); if (i !== id || (owner && ow !== owner)) continue;
          // Les filtres de la base sur un scalaire : `data->>x=gte.v` / `lte.v`.
          let garde = true;
          for (const [cle, val] of q.entries()) { const f = /^data->>(\w+)$/.exec(cle); if (!f) continue; const v = d[f[1]]; const [op, ...rest] = val.split('.'); const w = decodeURIComponent(rest.join('.')); if (v == null || (op === 'gte' && !(String(v) >= w)) || (op === 'lte' && !(String(v) <= w))) garde = false; }
          if (garde) rows.push(projeter(sel, i, ow, d));
        }
        return rep(rows);
      }
      if (m === 'POST') {
        const ls = JSON.parse(o.body || '[]'); const out = [];
        for (const l of (Array.isArray(ls) ? ls : [ls])) { if (panne.has('ecrire:' + l.id)) return rep('<html>503</html>', 503); if (l.id === 'remises_rappel_dedup') ordreE.push('memo'); base.set(k(l.owner || J, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id }); }
        return rep(out, 201);
      }
      if (m === 'PATCH') { const kk = k(owner || J, id); if (!base.has(kk)) return rep([]); base.set(kk, JSON.parse(o.body).data); return rep([{ id }]); }
      return rep([]);
    };
    process.env.CRON_SECRET = 'secret-banc'; process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
    process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
    const webpush = require(path.join(NM, 'web-push'));
    const pushes = [];
    webpush.sendNotification = async (sub, body) => { ordreE.push('push'); pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
    const route = (await charge('api/ship-reminders.js')).default;
    const PushL = await charge('api/_lib/push.js');
    const aHeure = (iso) => { process.env.VRM_NOTIF_HORLOGE = iso; };
    const appel = async () => {
      if (PushL.oublierPrefsVues) PushL.oublierPrefsVues();
      const r = { code: 0, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.corps = b; return r; }, send(b) { r.corps = b; return r; }, end() { return r; } };
      await route({ method: 'GET', headers: { authorization: 'Bearer secret-banc' }, query: { moment: 'groupe' } }, r);
      return r;
    };
    const s = M.remiseSaisie({ tx: '7001', num: '124', jour: '2026-11-12', heure: '15:00', lieu: 'Gare, sortie nord' }, Date.parse('2026-11-12T08:00:00Z'), 'mbanc00002').remise;
    const prepare = (remises = { [s.id]: s }) => {
      base = new Map(); panne = new Set(); pushes.length = 0; ordreE = []; journal = [];
      base.set(k(J, 'main'), { rev: 3, vrm_remises: remises, vrm_remise_fin: M.finRemises(remises), vinted_sales: { lourd: 'x'.repeat(50) } });
      base.set(k(J, 'push_subs'), { subs: [{ endpoint: 'https://web.push.apple.com/iphone-banc', keys: { p256dh: 'x', auth: 'y' } }] });
      base.set(k(J, 'push_journal_lu'), {});
    };
    prepare(); aHeure('2026-11-12T12:40:00Z');
    let r = await appel();
    dit(pushes.length === 0 && r.corps && r.corps.remises && r.corps.remises.fait === true, 'D1 à 13 h 40 (rendez-vous à 15 h) : rien ne sonne', JSON.stringify(r.corps && r.corps.remises));
    aHeure('2026-11-12T13:05:00Z');
    r = await appel();
    const p = pushes[0] || {};
    dit(pushes.length === 1 && p.title === 'Remise à 15 h 00 · N°124' && /Gare, sortie nord/.test(p.body || ''), 'D2 à 14 h 05 : UNE notification « Remise à 15 h 00 · N°124 », le lieu', JSON.stringify(pushes.map((x) => [x.title, x.body])));
    dit(/tab=ventes/.test(p.url || '') && /tx=7001/.test(p.url || ''), 'D3 elle ouvre la vente (par sa transaction)', p.url);
    dit(ordreE.indexOf('memo') >= 0 && ordreE.indexOf('memo') < ordreE.indexOf('push'), 'D4 le mémo est écrit AVANT l’envoi', ordreE.join(','));
    const reqMain = journal.filter((x) => /id=eq\.main/.test(x));
    dit(reqMain.length >= 2 && reqMain.some((x) => /data->>vrm_remise_fin=gte\./.test(x) && /select=owner/.test(x)) && !reqMain.some((x) => /select=data(&|$)/.test(x)), 'D5 `main` filtré par la base sur `vrm_remise_fin` et lu PROJETÉ (jamais select=data)', reqMain.join(' ; '));
    dit(!/Gare|N°124|"124"/.test(JSON.stringify(r.corps)), 'D6 la réponse du cron ne porte aucun lieu ni N° (des nombres)', JSON.stringify(r.corps && r.corps.remises));
    aHeure('2026-11-12T13:20:00Z'); pushes.length = 0;
    r = await appel();
    dit(pushes.length === 0, 'D7 le passage suivant (14 h 20) : rien deux fois');
    prepare(); aHeure('2026-11-12T13:05:00Z'); panne.add('ecrire:remises_rappel_dedup');
    r = await appel();
    dit(pushes.length === 0, 'D8 mémo pas écrit ⇒ rien ne part');
    prepare(); aHeure('2026-11-12T13:05:00Z'); panne.add('remises_rappel_dedup');
    r = await appel();
    dit(pushes.length === 0, 'D9 mémo illisible ⇒ rien (sinon il repartirait)');
    prepare({}); aHeure('2026-11-12T13:05:00Z');
    r = await appel();
    dit(pushes.length === 0 && !journal.some((x) => /select=vrm_remises/.test(x)), 'D10 aucun rendez-vous à venir : le vendeur n’est même pas lu');
    const s2 = M.remiseSaisie({ tx: '7002', num: '88', jour: '2026-11-12', heure: '15:30', lieu: 'Place du marché' }, Date.parse('2026-11-12T08:00:00Z'), 'mbanc00003').remise;
    prepare({ [s.id]: s, [s2.id]: s2 }); aHeure('2026-11-12T13:35:00Z');
    r = await appel();
    dit(pushes.length === 1 && /2 remises/.test(pushes[0].title), 'D11 deux rendez-vous dans l’heure : UNE notification qui dit les deux', JSON.stringify(pushes.map((x) => x.title)));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
