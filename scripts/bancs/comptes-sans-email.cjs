// ═══════════════════════════════════════════════════════════════════════════
// BANC : « QUELS COMPTES N'ENVOIENT AUCUN EMAIL À VRM, ET DEPUIS QUAND »
//        (node scripts/bancs/comptes-sans-email.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Plainte du 11 octobre (« les notifications des messages ne sont pas toujours
// envoyées »). Mesuré : `angeled92` et `tomj606` n'ont JAMAIS envoyé un email à
// VRM, `arthuror2` plus aucun depuis le 23 septembre — leurs ventes et leurs
// messages ne peuvent pas sonner. L'app :
//   · le disait dans Réglages → Notifications, mais seulement pour les VENTES
//     (« ne te préviendra d'aucune vente »), sans le geste ni la date ;
//   · le disait dans Achats en ROUGE (« aucun email »), y compris pour
//     `jujuf38` dont 9 messages sont bien arrivés (le journal n'était pas lu),
//     et pour un compte qui n'a rien vendu (rien n'avait à arriver).
// Il exige, aux deux tailles (390 px tactile et 1512 px), sur des comptes et des
// ventes INVENTÉS (aucune fixture : le banc vit dans le dépôt, qui est public) :
//   1. Réglages : les 3 comptes muets nommés, et eux seuls ; « ni ventes ni
//      messages » ; depuis quand ; le geste (Notifications de Vinted, et
//      « Masquer mon adresse » d'Apple → Transférer à) ;
//   2. Achats : le même bloc en tête ; `jujuf38` compté (ses messages), pas
//      « aucun email » ; le compte qui n'a rien vendu en gris, jamais en rouge ;
//      aucune ligne de compte en rouge ;
//   3. emails illisibles (journal en 522) : AUCUN compte accusé, et on le dit ;
//   4. aucun débordement, aucun écran tombé sur le garde-fou.
//   5. REVUE DU 11 OCTOBRE (défauts reproduits au rendu) :
//      · la note « ces comptes n'ont pas encore vendu » ne tombe que sous des
//        comptes qui n'ont RIEN vendu depuis le premier email reçu ; un compte
//        qui a vendu sans email, sous le seuil, a sa propre phrase (« 1 vente
//        sans email depuis le … — pas encore de quoi conclure ») ;
//      · un compte dormant (ventes d'avant le premier email) n'est pas accusé ;
//      · le bloc dit l'effet PROUVÉ, jamais « leurs codes de retrait
//        n'arrivent pas » ; il parle au singulier pour UN compte. ⚠️ (22 oct.)
//        « pas de rappel du matin pour leurs colis » est devenu FAUX : le rappel
//        du matin compte maintenant toutes les ventes à expédier. L'effet
//        prouvé qui reste : leur date limite est ESTIMÉE (vente + 7 j, sans
//        l'heure). Le banc exige la nouvelle phrase ET l'absence de l'ancienne ;
//      · Réglages déplié ne redit pas le résumé ; la table ne redit pas un compte
//        déjà nommé dans le bloc ;
//      · Achats : une ligne compacte (≤ 60 px à 390 px), APRÈS les colis jamais
//        retirés — elle ne repousse plus de l'argent perdu.
// On juge les ATTRIBUTS (`data-comptes-muets`, `data-compte-muet`,
// `data-compte-email`, `data-statut`) et, là où l'ancien écran n'en avait pas,
// le texte RENDU (§6.1 : le banc doit pouvoir être rouge sur le build d'avant).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4812;

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const ACC = {
  angeled92: '3175765377', tomj606: '3170801262', arthuror2: '3179807757',
  jujuf38: '3999000001', compte_neuf: '3999000002', llloollllaa: '24602614',
  dormant: '3999000003', une_vente: '3999000004', recentes: '3999000005',
};
const ACCOUNTS = Object.entries(ACC).map(([login, uid], i) => ({ id: i + 1, vinted_user_id: uid, login, domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }));
let tx = 9000;
const vente = (titre, j) => ({ transaction_id: ++tx, title: titre, price: { amount: '50', currency_code: 'EUR' },
  status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(j) });
const VENTES = {
  angeled92: [vente('Alpha Runner taille 42', 30), vente('Bravo Runner taille 41', 20), vente('Charlie Runner taille 40', 11)],
  tomj606: [vente('Delta Runner taille 43', 25), vente('Echo Runner taille 39', 9)],
  arthuror2: [vente('Foxtrot Runner taille 44', 18), vente('Golf Runner taille 38', 16), vente('Hotel Runner taille 45', 8)],
  jujuf38: [],
  compte_neuf: [],
  llloollllaa: [vente('India Runner taille 37', 14), vente('Juliet Runner taille 36', 6)],
  // Revue du 11 octobre : ventes AVANT le premier email reçu (il y a 60 jours).
  dormant: [vente('Kilo Runner taille 41', 150), vente('Lima Runner taille 42', 130)],
  // A vendu sans email, sous le seuil : jamais « n'a pas encore vendu ».
  une_vente: [vente('Mike Runner taille 40', 20)],
  recentes: [vente('November Runner taille 39', 2), vente('Oscar Runner taille 38', 1)],
};
const bord = (login, v) => ({ id: `email_bord_${v.transaction_id}`, data: { transaction: String(v.transaction_id), account: login, receivedAt: v.date, filename: '' } });
const ROWS = [
  { id: 'main', data: { vinted_account_emails: { [ACC.angeled92]: 'x1@privaterelay.appleid.com', [ACC.tomj606]: 'x2@privaterelay.appleid.com', [ACC.arthuror2]: 'x3@privaterelay.appleid.com', [ACC.llloollllaa]: 'vendeur@gmail.com' } } },
  ...Object.entries(VENTES).map(([login, v]) => ({ id: `harvest_${ACC[login]}_orders_sold`, data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: v } } })),
  ...Object.values(ACC).map((uid) => ({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } })),
  // arthuror2 : le bordereau de sa vente d'il y a 18 jours est arrivé, plus rien ensuite.
  bord('arthuror2', VENTES.arthuror2[0]),
  // llloollllaa : tout arrive.
  ...VENTES.llloollllaa.map((v) => bord('llloollllaa', v)),
  { id: 'email_sale_banc1', data: { account: 'llloollllaa', receivedAt: ilYa(6) } },
  // Le PREMIER email que VRM ait reçu (il y a 60 jours) : le début de la réception.
  { id: 'email_track_mondialrelay_BANC0001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: 'BANC0001', status: 'delivered', statusLabel: 'Livré', subject: 'Votre colis a été livré', account: 'llloollllaa', receivedAt: ilYa(60) } },
  // Un colis JAMAIS RETIRÉ (arrivé il y a 20 jours, jamais coché) : l'alerte de
  // configuration doit passer APRÈS lui.
  { id: 'email_track_chronopost_BANC0002', data: { type: 'suivi', carrier: 'chronopost', suivi: 'BANC0002', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis est disponible', code: '482913', lieu: 'Relais Banc', account: 'llloollllaa', receivedAt: ilYa(20) } },
  // jujuf38 : aucune ligne email_* — mais 9 MESSAGES au journal.
  { id: 'email_journal', data: { entries: Array.from({ length: 9 }, (_, i) => ({ type: 'message', subject: 'Nouveau message à propos de Kilo Runner', account: 'jujuf38', at: ilYa(1 + i * 0.1) })) } },
];
const DANGER = ['rgb(192, 57, 43)', 'rgb(255, 107, 107)'];   // C.danger, clair et sombre (THEMES)

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST (§6.3) : `alias:data->>champ` / `alias:data->champ`.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Les notifications vivent dans un SOUS-ÉCRAN de Réglages (au téléphone depuis
// le 16 oct., sur ordinateur aussi depuis le 28 oct.) : on l'ouvre, comme lui,
// puis on attend que son repli soit VISIBLE (pas un délai fixe).
async function ouvrirPush(pg) {
  const sousPush = pg.locator('[data-sous-ouvrir="push"]').first();
  await sousPush.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await sousPush.isVisible().catch(() => false)) await sousPush.click();
  await pg.locator('summary', { hasText: 'Ce que tu reçois sur ton téléphone' }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
}
async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((ex) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (ex) localStorage.setItem('vinted_accounts_hidden', JSON.stringify(ex)); } catch (_) {} }, opts.exclus || null);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && opts.journalKO && eq[1] === 'email_journal') return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
async function sain(pg, ecran, errs) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m && !errs.length, `${ecran} : l'écran n'est pas tombé, aucune erreur de page`, (m && m[0]) || errs[0]);
}
const MUETS = ['angeled92', 'tomj606', 'arthuror2'];
const PAS_MUETS = ['jujuf38', 'compte_neuf', 'llloollllaa', 'dormant', 'une_vente', 'recentes'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 982 }]) {
    const T = `${vp.width}px`;
    // ── 1. Réglages → Notifications ───────────────────────────────────────
    await essaie(`${T} Réglages`, async () => {
      const { ctx, pg, errs } = await preparer(b, vp);
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(5500);
      // Au téléphone (16 octobre), les notifications vivent dans un SOUS-ÉCRAN
      // (Réglages → Notifications du téléphone) : on l'ouvre, comme lui.
      await ouvrirPush(pg);
      const sum = pg.locator('summary', { hasText: 'Ce que tu reçois sur ton téléphone' }).first();
      await sum.scrollIntoViewIfNeeded({ timeout: 5000 });
      const resume = (await sum.innerText()).replace(/\s+/g, ' ');
      console.log(`     ${T} résumé : « ${resume.slice(0, 220)} »`);
      await sum.click();
      await pg.waitForTimeout(500);
      const det = (await pg.locator('details', { has: sum }).first().innerText()).replace(/\s+/g, ' ');
      // §7 (revue du 11 oct.) : déplié, la même chose n'est pas dite deux fois.
      const nFois = (det.match(/n’envoient? aucun email à VRM/g) || []).length;
      dit(nFois === 1 && !/déplie pour savoir/i.test(det), `${T} Réglages déplié : « n’envoie(nt) aucun email à VRM » dit UNE fois, et plus « déplie pour savoir lesquels »`, `${nFois} fois · ${(det.match(/.{0,60}déplie pour savoir.{0,10}/) || [''])[0]}`);
      // ⚠️ Jugé dans le BLOC seul : la liste des notifications dessous dit
      //    légitimement « avec le code de retrait » (📍 Colis à retirer).
      const blocR = await pg.evaluate(() => { const e = document.querySelector('[data-comptes-muets]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
      dit(/date limite[^.]{0,40}estimée/i.test(blocR) && !/pas de rappel du matin/i.test(blocR) && !/codes? de retrait/i.test(blocR), `${T} Réglages : l’effet PROUVÉ (leur date limite est estimée), plus « pas de rappel du matin » (faux depuis le 22 oct.), pas « leurs codes de retrait »`, (blocR.match(/s’affichent bien.{0,240}/) || [''])[0]);
      const nommes = MUETS.filter((l) => det.includes(l));
      const aTort = PAS_MUETS.filter((l) => det.includes(l));
      dit(nommes.length === 3 && !aTort.length, `${T} Réglages : les 3 comptes muets sont nommés, et eux seuls`, `nommés ${JSON.stringify(nommes)} · à tort ${JSON.stringify(aTort)}`);
      dit(/\b3 comptes\b/.test(resume), `${T} Réglages : le résumé dit 3 comptes`, resume.slice(0, 160));
      dit(/messages/i.test(resume) && /ventes/i.test(resume), `${T} Réglages : ni les ventes NI LES MESSAGES de ces comptes ne sonneront`, resume.slice(0, 200));
      dit(/arthuror2[^.]*depuis le \d{1,2} [a-zéû]+/i.test(det), `${T} Réglages : depuis quand (arthuror2 : « depuis le … »)`, (det.match(/arthuror2[^.]{0,120}/) || [''])[0]);
      dit(/angeled92[^.]*jamais/i.test(det), `${T} Réglages : angeled92 « jamais »`, (det.match(/angeled92[^.]{0,120}/) || [''])[0]);
      dit(/Paramètres → Notifications/.test(det) && /Masquer mon adresse/.test(det) && /Transférer à/.test(det),
        `${T} Réglages : le geste (Notifications de Vinted, puis « Masquer mon adresse » d’Apple → Transférer à)`, det.slice(det.indexOf('Pour'), det.indexOf('Pour') + 260));
      if (process.env.BANC_CAPTURES) await pg.locator('details', { has: sum }).first().screenshot({ path: path.join(process.env.BANC_CAPTURES, `reglages-${vp.width}.png`) }).catch(() => {});
      await sain(pg, `${T} Réglages`, errs);
      await ctx.close();
    });
    // ── 2. Achats → En attente ────────────────────────────────────────────
    await essaie(`${T} Achats`, async () => {
      const { ctx, pg, errs } = await preparer(b, vp);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(5500);
      // Revue du 11 octobre : UNE ligne compacte, APRÈS les colis jamais retirés.
      const pos = await pg.evaluate(() => {
        const c = document.querySelector('[data-muets-compact]');
        // Le bloc des colis qui ne comptent plus « à retirer » : trouvé par son
        // attribut (23 oct. : « colis à vérifier — sans doute repartis »), par son
        // ancien titre sur un build d'avant — la règle, pas l'orthographe (§6.5).
        const o = document.querySelector('[data-a-verifier], [data-oublies]') || [...document.querySelectorAll('div')].find((d) => /^\d+ colis jamais retirés$/.test((d.textContent || '').trim()));
        const rc = c && c.getBoundingClientRect(), ro = o && o.getBoundingClientRect();
        return { c: !!c, h: rc ? Math.round(rc.height) : null, yc: rc ? rc.top + scrollY : null, o: !!o, yo: ro ? ro.top + scrollY : null };
      });
      dit(pos.c && pos.h != null && pos.h <= 60, `${T} Achats : les comptes muets tiennent en UNE ligne repliée (≤ 60 px)`, JSON.stringify(pos));
      dit(pos.o && pos.c && pos.yc > pos.yo, `${T} Achats : elle passe APRÈS les colis jamais retirés / à vérifier (de l’argent perdu d’abord)`, JSON.stringify(pos));
      const compact = pg.locator('[data-muets-compact] > summary').first();
      const resumeCompact = (await compact.innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (await compact.count()) { await compact.click().catch(() => {}); await pg.waitForTimeout(400); }
      const txt = (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
      const iBloc = txt.search(/comptes? Vinted n’envoie/);
      const bloc = iBloc < 0 ? '' : txt.slice(iBloc, iBloc + 1400);
      dit(MUETS.every((l) => bloc.includes(l)) && !PAS_MUETS.some((l) => bloc.slice(0, bloc.indexOf('Pour') > 0 ? bloc.indexOf('Pour') : 600).includes(l)),
        `${T} Achats : le bloc (une fois ouvert) nomme les 3 comptes muets, et eux seuls`, bloc.slice(0, 220));
      dit(/\b3 comptes\b/.test(resumeCompact) && !/Masquer/.test(resumeCompact), `${T} Achats : la ligne repliée dit le nombre`, resumeCompact);
      dit(/arthuror2[^.]*depuis le \d{1,2} [a-zéû]+/i.test(bloc), `${T} Achats : arthuror2 « plus aucun email depuis le … »`, (bloc.match(/arthuror2[^.]{0,120}/) || [''])[0]);
      dit(/date limite[^.]{0,40}estimée/i.test(bloc) && !/pas de rappel du matin/i.test(bloc) && !/codes? de retrait/i.test(bloc.slice(0, bloc.indexOf('Pour') > 0 ? bloc.indexOf('Pour') : 1400)), `${T} Achats : l’effet prouvé (date limite estimée), plus « pas de rappel du matin », pas les codes de retrait`, (bloc.match(/s’affichent bien.{0,240}/) || [''])[0]);
      // Le détail des comptes (déplié s'il est replié).
      const resumes = pg.locator('summary', { hasText: /détail|Réception des emails/ });
      if (await resumes.count()) { await resumes.first().click().catch(() => {}); await pg.waitForTimeout(400); }
      const lignes = await pg.evaluate((DANGER) => {
        // Les lignes du tableau « Tes comptes Vinted et leurs emails » : login → (texte, couleur).
        const out = {};
        const titre = [...document.querySelectorAll('div')].find((d) => /^Tes comptes Vinted et leurs emails$/.test((d.textContent || '').trim()));
        if (!titre) return out;
        const zone = titre.parentElement;
        for (const row of zone.querySelectorAll('div')) {
          const kids = row.children;
          if (kids.length !== 2) continue;
          const login = (kids[0].textContent || '').trim(), etat = (kids[1].textContent || '').trim();
          if (!login || out[login]) continue;
          out[login] = { etat, rouge: DANGER.includes(getComputedStyle(kids[1]).color) };
        }
        return out;
      }, DANGER);
      console.log(`     ${T} comptes : ${JSON.stringify(lignes)}`);
      const j = lignes.jujuf38 || {};
      dit(/9 emails?/.test(j.etat || '') && !/aucun email/i.test(j.etat || ''), `${T} Achats : jujuf38 compte ses 9 messages (le journal), pas « aucun email »`, JSON.stringify(j));
      const n = lignes.compte_neuf || {};
      dit(!!n.etat && !n.rouge && !/^aucun email$/i.test(n.etat), `${T} Achats : un compte qui n’a rien vendu n’est pas accusé en rouge`, JSON.stringify(n));
      const rouges = Object.entries(lignes).filter(([, v]) => v.rouge).map(([k]) => k);
      dit(Object.keys(lignes).length >= 6 && !rouges.length, `${T} Achats : aucune ligne de compte en rouge (§7)`, `rouges ${JSON.stringify(rouges)} sur ${Object.keys(lignes).length}`);
      dit(!MUETS.some((l) => lignes[l]), `${T} Achats : la table ne redit pas un compte déjà nommé dans le bloc (§7)`, JSON.stringify(MUETS.filter((l) => lignes[l])));
      const st = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-compte-email]')].map((e) => [e.getAttribute('data-compte-email'), e.getAttribute('data-statut')])));
      dit(st.une_vente === 'surveiller' && /1 vente sans email depuis le \d{1,2} [a-zéû]+/i.test((lignes.une_vente || {}).etat || ''),
        `${T} Achats : une vente sans email il y a 20 j — « 1 vente sans email depuis le … », pas « aucun email pour l’instant »`, JSON.stringify({ st: st.une_vente, l: lignes.une_vente }));
      dit(st.recentes === 'surveiller' && /moins de 3 jours/.test((lignes.recentes || {}).etat || ''), `${T} Achats : deux ventes d’hier — « leur email peut encore arriver »`, JSON.stringify(lignes.recentes));
      dit(st.dormant === 'calme' && st.compte_neuf === 'calme', `${T} Achats : dormant (ventes d’avant le premier email) et compte neuf : « calme », pas accusés`, JSON.stringify({ dormant: st.dormant, neuf: st.compte_neuf }));
      const note = await pg.evaluate(() => { const n = document.querySelector('[data-note-calme]'); return n ? n.textContent : ''; });
      dit(/rien vendu depuis le \d{1,2} [a-zéû]+/i.test(note), `${T} Achats : la note « calme » dit depuis quand, et rien d’autre que la vérité de ces comptes-là`, note);
      if (process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, `achats-${vp.width}.png`), fullPage: false }).catch(() => {});
      await sain(pg, `${T} Achats`, errs);
      await ctx.close();
    });
  }
  // ── 2b. UN seul compte muet : le bloc parle au singulier ─────────────────
  await essaie('un seul compte muet', async () => {
    const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 982 }, { exclus: [ACC.tomj606, ACC.arthuror2] });
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(5500);
    // (28 oct.) Le sous-écran « Notifications » s'ouvre aussi sur ordinateur.
    await ouvrirPush(pg);
    const sum = pg.locator('summary', { hasText: 'Ce que tu reçois sur ton téléphone' }).first();
    await sum.scrollIntoViewIfNeeded({ timeout: 5000 });
    await sum.click(); await pg.waitForTimeout(500);
    const bloc = await pg.evaluate(() => { const e = document.querySelector('[data-comptes-muets]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
    const n = await pg.evaluate(() => { const e = document.querySelector('[data-comptes-muets]'); return e ? e.getAttribute('data-comptes-muets') : null; });
    dit(n === '1' && /\bSes ventes\b/.test(bloc) && !/\b[Ll]eurs\b/.test(bloc.slice(0, bloc.indexOf('Pour') > 0 ? bloc.indexOf('Pour') : bloc.length)),
      'un seul compte muet : « Ses ventes … ses messages », jamais « Leurs »', bloc.slice(0, 300));
    await sain(pg, 'un seul compte muet', errs);
    await ctx.close();
  });
  // ── 3. Emails illisibles : personne n'est accusé ─────────────────────────
  await essaie('pas su', async () => {
    const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 982 }, { journalKO: true });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(5500);
    const resumes = pg.locator('summary', { hasText: /Réception des emails|détail/ });
    if (await resumes.count()) { await resumes.first().click().catch(() => {}); await pg.waitForTimeout(400); }
    const txt = (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    dit(!/comptes? Vinted n’envoie/.test(txt) && !(await pg.locator('[data-comptes-muets]').count()), 'journal illisible : aucun compte n’est dit muet');
    // Jugé sur les COMPTES (une ligne de transporteur « aucun email reçu » est
    // une autre mesure, juste : les suivis, eux, ont été lus).
    const zoneComptes = txt.slice(Math.max(0, txt.indexOf('Tes comptes Vinted et leurs emails')));
    dit(txt.includes('Tes comptes Vinted et leurs emails') && !/aucun email\b(?! pour l)/i.test(zoneComptes.replace(/aucun email de suivi/gi, '')), 'journal illisible : aucun « aucun email » affirmé sur un compte', (zoneComptes.match(/.{40}aucun email.{40}/i) || [''])[0]);
    dit(/pas pu lire les emails reçus/.test(txt), 'et l’écran DIT qu’il n’a pas pu lire', '');
    await sain(pg, 'pas su', errs);
    await ctx.close();
  });
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Les comptes muets sont dits, sur preuve, avec le geste — et personne n’est accusé à tort.'}`);
  process.exit(ko ? 1 : 0);
})();
