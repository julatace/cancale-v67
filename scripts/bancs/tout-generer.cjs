// Banc : « TOUT GÉNÉRER », LE BORDEREAU DE RETOUR ET L'ÉTAT DE L'EXTENSION
// (revue du 9 octobre, après la fusion de #448-#467).
//
// L'app RENDUE (build de dist/), avec le VRAI dialogue du pont rejoué
// (postMessage `ready` / `etat` / `cmd` / `evt`) sur des ventes INVENTÉES — il
// vit dans le dépôt, qui est public. Ce qu'il exige :
//   · UN CLIC = AU PLUS 6 COMMANDES (la borne d'une visite, §3), le bouton dit
//     ce qui part (« Générer 6 bordereaux (sur 8) »), et un second clic ne
//     renvoie pas les colis déjà en file ;
//   · LE REFUS DE L'EXTENSION EST DIT, UNE FOIS, AVEC SA RAISON (« vinted-pause »,
//     plafond…), on s'arrête au premier refus qui vaut pour tout le lot, et
//     « chaque ligne suit le sien » n'est écrit que si quelque chose est parti ;
//   · UNE ABSENCE DE RÉPONSE N'EST PAS UN REFUS : « je ne sais pas », puis
//     « lancé » dès que l'extension prévient ;
//   · LA PAUSE DE VINTED SE VOIT AVANT LE CLIC (pastille, bouton grisé) ;
//   · LA RAISON COMMUNE D'UN BOUTON GRISÉ EST ÉCRITE UNE FOIS SUR COLIS (§7) ;
//   · LA PASTILLE NE CONTREDIT PAS LE PONT (pas de « à mettre à jour » quand le
//     pont a mesuré une version à jour), ne promet que ce qui manque VRAIMENT,
//     et ne dit pas « publier reste possible » à une extension qui ne sait pas ;
//   · L'ACHAT EN LITIGE À RENVOYER se voit par défaut (Achats, Ma journée), et
//     son lien n'est pas écrit deux fois.
// On juge les ÉTATS (`data-*`) et les NOMBRES (requêtes reçues par le pont,
// occurrences d'une phrase) — jamais une formulation seule (§6.5).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5710;
const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '?';

const auj = new Date();
const ilYaH = (h) => new Date(auj.getTime() - h * 3600e3).toISOString();
const VENTES = Array.from({ length: 8 }, (_, i) => ({ transaction_id: 7001 + i, title: `Paire banc ${i + 1}`, price: { amount: '50', currency_code: 'EUR' },
  status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(1 + i / 10) }));
const ACHATS = [
  { transaction_id: 8101, title: 'Kilo Litige taille 41', price: { amount: '60', currency_code: 'EUR' }, status: 'Retour initié', transaction_user_status: 'needs_action', date: ilYaH(24 * 19) },
  { transaction_id: 8102, title: 'Lima Route taille 42', price: { amount: '30', currency_code: 'EUR' }, status: "Commande expédiée et en cours d'acheminement", transaction_user_status: 'waiting', date: ilYaH(72) },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const lignes = (diagVer) => [
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
  ...(diagVer ? [{ id: 'panel_diag_capture', data: { ver: diagVer, verAt: ilYaH(2), majAt: ilYaH(2) } }] : []),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
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

// Le pont simulé, injecté AVANT l'app. `o.absente` : aucun pont ; `o.version` ;
// `o.connecte` : uid du cookie Vinted ; `o.pause` : ms de pause annoncés dans
// l'état ; `o.refus` {code, raison} renvoyé à partir de la commande
// `o.refusApres + 1` ; `o.muet` : ne répond pas, et prévient « file » au bout
// de `o.muet` ms (l'extension a accepté après le délai de l'app).
const PONT = (o) => {
  window.__cmds = [];
  if (o.absente) return;
  const post = (m) => window.postMessage(m, '*');
  window.__etatCmds = {};
  let n = 0;
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat' && !(o.version < '5.129.0' && o.version.split('.')[1].length === 3)) {
      post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version: o.version, vrm: { ok: true, connecte: true, email: '' },
        vinted: o.connecte ? { uid: o.connecte, login: 'compte_a' } : null, cmds: window.__etatCmds }, o.pause ? { pause: { jusqua: Date.now() + o.pause } } : {}) });
    }
    if (d.__vmr === 'cmd' && d.cmd === 'ventes') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    if (d.__vmr === 'cmd' && d.cmd === 'bordereau') {
      n++; window.__cmds.push(String(d.tx));
      const jobId = `bord:${d.uid}:${d.tx}`;
      if (o.muet) { setTimeout(() => { window.__etatCmds[jobId] = { etape: 'file', at: Date.now(), vivant: true }; post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'file', at: Date.now(), vivant: true } }); }, o.muet); return; }
      if (o.refus && n > (o.refusApres || 0)) { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: o.refus.code, raison: o.refus.raison } }); return; }
      window.__etatCmds[jobId] = { etape: 'file', at: Date.now(), vivant: true };
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'file', vivant: true } });
    }
  });
  post({ __vmr: 'ready', version: o.version });
};

async function rendre(b, { tab = 'cat_bord', tel = false, pont = { absente: true }, diagVer = null, attente = 4500 }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, pont);
  const ROWS = lignes(diagVer);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(attente);
  const lire = () => pg.evaluate(() => {
    const tg = document.querySelector('[data-tout-generer]');
    const bil = document.querySelector('[data-tg-bilan]');
    const et = document.querySelector('[data-etat-actions]');
    return {
      tg: tg ? { etat: tg.getAttribute('data-tout-generer'), lot: tg.getAttribute('data-lot'), txt: tg.innerText.trim() } : null,
      bilan: bil ? { d: bil.getAttribute('data-tg-bilan'), txt: bil.innerText } : null,
      sousTg: tg && tg.parentElement ? tg.parentElement.innerText.replace(tg.innerText, '').trim() : '',
      raisons: [...document.querySelectorAll('[data-raison-bord]')].map((x) => x.getAttribute('data-raison-bord')),
      etat: et ? { niveau: et.getAttribute('data-etat-actions'), code: et.getAttribute('data-etat-code'), titre: et.getAttribute('title') || '' } : null,
      cmds: window.__cmds || [],
      corps: document.body.innerText,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    };
  });
  const panneau = async () => {
    if (!(await pg.$('[data-etat-actions]'))) return null;
    await pg.click('[data-etat-actions]'); await pg.waitForTimeout(900);
    return pg.evaluate(() => { const p = document.querySelector('[data-etat-panneau]'); return p ? p.innerText : null; });
  };
  const cliquerTG = async () => { if (!(await pg.$('[data-tout-generer]'))) return false; await pg.click('[data-tout-generer]', { force: true }); return true; };
  return { ctx, pg, errs, lire, panneau, cliquerTG };
}
const compte = (t, s) => String(t || '').split(s).length - 1;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    console.log('── COLIS · la raison commune d\'un bouton grisé est écrite UNE fois (§7)');
    for (const tel of [false, true]) {
      const r = await rendre(b, { tel }); const v = await r.lire();
      const phrase = tel ? "Depuis ton ordinateur : c'est là que tourne l'extension qui génère les bordereaux." : "Extension VRM pas détectée dans ce navigateur — c'est elle qui génère les bordereaux.";
      dit(v.tg && v.tg.etat === 'grise', `${tel ? 'téléphone' : 'ordinateur sans extension'} : « Tout générer » reste visible, grisé`, JSON.stringify(v.tg));
      dit(compte(v.corps, phrase) === 1, `${tel ? 'téléphone' : 'ordinateur sans extension'} : la raison est écrite une seule fois sur l'écran`, `${compte(v.corps, phrase)} fois`);
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      dit(r.errs.length === 0, 'aucune erreur d\'app', r.errs.join(' | ').slice(0, 140));
      await r.ctx.close();
    }

    // ⚠️ On lit le texte SOUS le bouton (`sousTg`) : il existe aussi sur le
    //    build d'avant — un contrôle posé sur un attribut neuf serait rouge
    //    « parce que l'attribut n'existait pas », ce qui ne prouve rien (§6.1).
    console.log('── COLIS · 8 colis : UN clic = au plus 6 commandes, et le bouton le dit');
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111' } }); const v = await r.lire();
      dit(v.tg && v.tg.etat === 'pret' && /\b6\b/.test(v.tg.txt) && /\b8\b/.test(v.tg.txt), 'le bouton dit les 6 qui partent, sur 8 (pas « Tout générer (8) »)', JSON.stringify(v.tg));
      await r.cliquerTG(); await r.pg.waitForTimeout(2500);
      const v2 = await r.lire();
      dit(v2.cmds.length === 6, 'le pont reçoit 6 commandes, pas 8', `${v2.cmds.length} commande(s)`);
      dit(/\b6 bordereaux lancés/.test(v2.sousTg) && /\b2 autres\b/.test(v2.sousTg), 'le bilan dit 6 lancés et 2 qui attendent le prochain clic', JSON.stringify(v2.sousTg));
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'tout-generer-colis.png') });
      // Un second clic : les 6 déjà en file ne repartent pas.
      await r.cliquerTG(); await r.pg.waitForTimeout(2500);
      const v3 = await r.lire();
      const doublons = v3.cmds.length - new Set(v3.cmds).size;
      dit(v3.cmds.length === 8 && doublons === 0, 'un 2ᵉ clic n\'envoie que les 2 restants — aucun colis en file recommandé', `${v3.cmds.length} commande(s), ${doublons} doublon(s)`);
      await r.ctx.close(); }

    console.log('── COLIS · Vinted a demandé de ralentir (pause annoncée par l\'extension)');
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111', pause: 14 * 60000 } }); const v = await r.lire();
      dit(v.etat && v.etat.code === 'pause' && v.etat.niveau === 'lecture', 'la pastille ne dit plus « Actions possibles » pendant la pause', JSON.stringify(v.etat));
      dit(v.tg && v.tg.etat === 'grise', '« Tout générer » est grisé AVANT le clic', JSON.stringify(v.tg));
      dit(v.raisons.length === 1 && v.raisons[0] === 'pause' && compte(v.corps, 'ralentir') === 1, 'la pause est dite une fois sur l\'écran, avec le temps qui reste', `${JSON.stringify(v.raisons)} · « ralentir » ×${compte(v.corps, 'ralentir')}`);
      await r.cliquerTG(); await r.pg.waitForTimeout(800);
      dit((await r.lire()).cmds.length === 0, 'et le clic n\'envoie rien', '');
      await r.ctx.close(); }

    console.log('── COLIS · l\'extension REFUSE (pause qu\'elle ne sait pas encore annoncer, plafond)');
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111', refus: { code: 'vinted-pause', raison: 'Vinted demande de ralentir — réessaie dans 14 min' } } });
      await r.cliquerTG(); await r.pg.waitForTimeout(2000); const v = await r.lire();
      dit(v.cmds.length === 1, 'on s\'arrête au premier refus qui vaut pour tout le lot (une commande, pas six)', `${v.cmds.length} commande(s)`);
      dit(/ralentir/.test(v.sousTg) && /14 min/.test(v.sousTg), 'la RAISON du refus est écrite, avec son délai (pas seulement « refusés »)', JSON.stringify(v.sousTg));
      dit(!/progression|suit le sien/.test(v.sousTg), 'et rien ne prétend que « chaque colis montre sa progression » quand aucun n\'est parti', JSON.stringify(v.sousTg));
      dit(compte(v.corps, 'ralentir') === 1, 'la raison est écrite une fois (pas sous chaque colis)', `×${compte(v.corps, 'ralentir')}`);
      await r.ctx.close(); }
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111', refusApres: 2, refus: { code: 'plafond', raison: "20 actions sur ce compte dans l'heure — on s'arrête là pour ne pas attirer l'attention. Réessaie dans 12 min." } } });
      await r.cliquerTG(); await r.pg.waitForTimeout(2500); const v = await r.lire();
      dit(v.cmds.length === 3, 'plafond atteint au 3ᵉ : 3 commandes envoyées, pas 6', `${v.cmds.length}`);
      dit(/\b2 bordereaux lancés/.test(v.sousTg) && /20 actions/.test(v.sousTg), 'le bilan dit les 2 lancés ET la raison du refus', JSON.stringify(v.sousTg));
      dit(!/\.\./.test(v.sousTg), 'sans ponctuation doublée', JSON.stringify(v.sousTg));
      await r.ctx.close(); }

    console.log('── COLIS · pas de réponse dans les 9 s : « je ne sais pas », puis « lancé » quand l\'extension prévient');
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111', muet: 11500 } });
      await r.cliquerTG(); await r.pg.waitForTimeout(9800); const v = await r.lire();
      dit(v.cmds.length === 1, 'sans réponse, on n\'envoie pas la suite', `${v.cmds.length} commande(s)`);
      dit(v.sousTg && !/refus/i.test(v.sousTg) && /sais pas/.test(v.sousTg), 'pas de réponse ≠ refus : le bilan dit qu\'on ne sait pas', JSON.stringify(v.sousTg));
      await r.pg.waitForTimeout(3000); const v2 = await r.lire();
      dit(/\b1 bordereau lancé/.test(v2.sousTg) && !/sais pas/.test(v2.sousTg), 'et dès que l\'extension prévient, le bilan dit « lancé »', JSON.stringify(v2.sousTg));
      await r.ctx.close(); }
    { const r = await rendre(b, { pont: { version: '5.163.0', connecte: '111', muet: 11500 } });
      const sel = '[data-bouton-bord][data-tx="7001"]';
      if (await r.pg.$(sel + ' button')) await r.pg.click(sel + ' button', { force: true });
      await r.pg.waitForTimeout(9800);
      const l1 = await r.pg.evaluate((s) => { const x = document.querySelector(s); return x ? x.innerText : ''; }, sel);
      dit(/sais pas/.test(l1), 'le bouton d\'UN colis sans réponse dit aussi « je ne sais pas » (pas « réessaie » tout court)', JSON.stringify(l1));
      await r.pg.waitForTimeout(3000);
      const l2 = await r.pg.evaluate((s) => { const x = document.querySelector(s); return x ? x.innerText : ''; }, sel);
      dit(/En file/.test(l2) && !/pas répondu/.test(l2), 'puis sa ligne suit l\'extension, sans garder le message d\'échec', JSON.stringify(l2));
      await r.ctx.close(); }

    console.log('── PASTILLE · elle ne contredit pas le pont, et ne promet que ce qui manque');
    { const r = await rendre(b, { tab: 'cat_ventes', pont: { version: EXT_ATTENDUE, connecte: '111' }, diagVer: '5.143.0' }); const p = await r.panneau();
      dit(p && !/mettre à jour/i.test(p), `pont à jour (${EXT_ATTENDUE}) + dernière capture en 5.143 : aucun « à mettre à jour » dans le panneau`, JSON.stringify(p).slice(0, 300));
      await r.ctx.close(); }
    { const r = await rendre(b, { tab: 'cat_ventes', tel: true, diagVer: '5.143.0' }); const p = await r.panneau();
      dit(p && /mettre à jour/i.test(p) && /publier une annonce sur Leboncoin/.test(p), 'téléphone + capture en 5.143 : la mise à jour est dite, avec ce qui manque vraiment', JSON.stringify(p).slice(0, 400));
      await r.ctx.close(); }
    { const r = await rendre(b, { tab: 'cat_ventes', tel: true, diagVer: '5.161.0' }); const p = await r.panneau();
      dit(p && /mettre à jour/i.test(p) && !/ne sait pas encore|Vinted\s*Go|rafraîchit|publie une annonce/.test(p), 'téléphone + capture en 5.161 : la version est dite, AUCUNE capacité promise qu\'elle aurait déjà', JSON.stringify(p).slice(0, 400));
      await r.ctx.close(); }
    { const r = await rendre(b, { tab: 'cat_ventes', pont: { version: '5.128.0', connecte: '111' }, diagVer: '5.143.0', attente: 6000 }); const p = await r.panneau();
      dit(p && compte(p, EXT_ATTENDUE) === 1, `extension 5.128 : « ${EXT_ATTENDUE} » écrite une fois dans le panneau (le bouton)`, `${compte(p, EXT_ATTENDUE)} fois`);
      await r.ctx.close(); }

    console.log('── PASTILLE · « publier sur Leboncoin reste possible » seulement si l\'extension sait');
    { const r = await rendre(b, { tab: 'cat_ventes', pont: { version: '5.143.0', connecte: null } }); const v = await r.lire(); const p = await r.panneau();
      dit(v.etat && v.etat.code === 'vinted' && !/reste possible/.test(v.etat.titre), 'extension 5.143, aucun compte Vinted : l\'infobulle ne dit pas que publier reste possible', JSON.stringify(v.etat));
      dit(p && !/publier sur Leboncoin demande l.extension allumée/.test(p), 'ni le panneau', JSON.stringify(p).slice(0, 300));
      await r.ctx.close(); }
    { const r = await rendre(b, { tab: 'cat_ventes', pont: { version: '5.161.0', connecte: null } }); const v = await r.lire();
      dit(v.etat && v.etat.code === 'vinted' && /reste possible/.test(v.etat.titre), 'autre sens : extension 5.161, elle le dit', JSON.stringify(v.etat));
      await r.ctx.close(); }

    console.log('── ACHAT EN LITIGE · le bordereau de retour se voit par défaut');
    for (const tel of [false, true]) {
      const r = await rendre(b, { tab: 'cat_achats', tel, attente: 5000 });
      const v = await r.pg.evaluate(() => ({ bloc: !!document.querySelector('[data-a-renvoyer]'), liens: document.querySelectorAll('a[href*="member/transactions/8101"]').length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(v.bloc && v.liens === 1, `${tel ? '390' : '1512'} px · Achats, onglet par défaut : la paire à renvoyer et son lien de retour (une fois)`, JSON.stringify(v));
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), `tout-generer-achats-${tel ? 390 : 1512}.png`) });
      // « Tous » : la carte porte le lien ; le bloc ne le répète pas.
      try { await r.pg.getByRole('button', { name: /^Tous/ }).last().click({ timeout: 3000 }); await r.pg.waitForTimeout(1200); } catch (_) {}
      const t = await r.pg.evaluate(() => ({ bloc: !!document.querySelector('[data-a-renvoyer]'), liens: document.querySelectorAll('a[href*="member/transactions/8101"]').length }));
      dit(!t.bloc && t.liens === 1, '« Tous » : le lien est sur la carte, une seule fois', JSON.stringify(t));
      dit(r.errs.length === 0, 'aucune erreur d\'app', r.errs.join(' | ').slice(0, 140));
      await r.ctx.close();
    }
    { const r = await rendre(b, { tab: 'journee', attente: 5000 });
      const j = await r.pg.evaluate(() => { const x = document.querySelector('[data-job="a-renvoyer"]'); return x ? x.innerText : null; });
      dit(!!j && /compte_a/.test(j), 'Ma journée : « Renvoyer 1 paire (litige) », avec le compte', JSON.stringify(j));
      await r.ctx.close(); }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ tout-generer : ${ko} rouge(s)` : '\n✅ tout-generer : tout est vert');
  process.exit(ko ? 1 : 0);
})();
