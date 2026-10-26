require('./_porte-banc.cjs');
// BANC — SIRET → nom de l'entreprise dans l'en-tête, et le MODE STREAM qui
// floute partout (17 octobre, Julien).
//
// A. « Quand on remplit son SIRET, en haut à gauche à côté du logo il y a le
//    nom de l'entreprise qui s'affiche — l'utilisateur n'a pas besoin de mettre
//    son nom d'entreprise. » Comptabilité → « Ton entreprise » : il tape un
//    SIRET valide ; le faux registre (`/api/compte?mode=entreprise`) répond ; le
//    nom se remplit tout seul, part dans la ligne `vrm_pro_facture`, et
//    s'affiche à côté du logo (téléphone : en-tête ; ordinateur : la barre).
//    L'autre sens : registre muet ⇒ aucun nom inventé, la phrase le dit.
//
// B. « Le mode stream ne marche pas très bien : les pseudos des comptes Vinted
//    sur lesquels sont connectées les extensions ne sont pas floutés, et les
//    données sensibles non plus. » Mode stream allumé, extension simulée
//    (le dialogue du pont : compte Vinted ouvert dans Chrome), on balaie
//    plusieurs écrans et on exige qu'AUCUN texte affiché qui porte un pseudo,
//    une adresse email ou le nom de l'entreprise ne soit lisible (un ancêtre
//    flouté). Et l'autre sens : le banc vérifie qu'il en a bien VU (sinon il
//    serait vert sur un écran vide), et que hors mode stream rien n'est flou.
//
// Aucune fixture : données inventées.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4971;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const UID = '11111111-2222-3333-4444-555555555555';
const MAIL_VRM = 'vendeur.secret@exemple.fr';
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: MAIL_VRM } };
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
const VERSION = ((/const EXT_ATTENDUE\s*=\s*['"]([\d.]+)['"]/.exec(SRC)) || [])[1] || '5.184.0';
const LOGIN = 'compte_secret_42', LOGIN2 = 'autre_pseudo_77', MAIL_COMPTE = 'boutique.secrete@exemple.fr';
const NOM = 'LA RÉSERVE DE BANC';
const COMPTES = [
  { vinted_user_id: '901', account_id: '901', login: LOGIN, email: MAIL_COMPTE, owner: UID, updated_at: new Date().toISOString() },
  { vinted_user_id: '902', account_id: '902', login: LOGIN2, owner: UID, updated_at: new Date().toISOString() },
];
// Un SIRET dont la clé de Luhn est juste (le formulaire le vérifie).
function luhn(s) { let t = 0; for (let i = 0; i < s.length; i++) { let c = Number(s[s.length - 1 - i]); if (i % 2) { c *= 2; if (c > 9) c -= 9; } t += c; } return t % 10 === 0; }
function siretValide() {
  // Un SIREN puis un établissement dont les deux clés de Luhn sont justes.
  for (let a = 0; a < 1000; a++) { const siren = '73282' + String(a).padStart(3, '0'); for (let d = 0; d < 10; d++) { if (!luhn(siren + d)) continue; for (let e = 0; e < 100; e++) { const s = siren + d + '000' + String(e).padStart(2, '0'); if (luhn(s)) return s; } } }
  return '';
}
const SIRET = siretValide();

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

// Le pont de l'extension, simulé : elle répond, elle est à jour, et Chrome est
// connecté sur LOGIN.
const PONT = ({ version, login }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat' && d.reqId) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '901', login }, cmds: {} } });
  });
  post({ __vmr: 'ready', version });
};

async function page(nav, telephone, tab, { stream = false, registre = 'ok', profil = null } = {}) {
  const ctx = await nav.newContext(telephone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const ecrits = [];
  await pg.addInitScript(([s, st]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_stream', st ? '1' : '0'); } catch (_) {} }, [SESSION, stream]);
  await pg.addInitScript(PONT, { version: VERSION, login: LOGIN });
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', async (r) => {
    const q = r.request(); const u = decodeURIComponent(q.url());
    if (q.method() !== 'GET') { try { ecrits.push(JSON.parse(q.postData() || 'null')); } catch (_) {} return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (/vinted_accounts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COMPTES) });
    if (/id=eq\.vrm_pro_facture/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profil ? [{ data: profil }] : []) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=entreprise/.test(u)) {
      if (registre === 'muet') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'muet', code: 'pas-su' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ etat: 'trouve', siren: SIRET.slice(0, 9), siret: SIRET, nom: NOM, adresse: '33 boulevard du Banc', codePostal: '44000', ville: 'NANTES', etabTrouve: true }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3200);
  return { ctx, pg, ecrits };
}

// Les textes AFFICHÉS qui portent un secret, et ceux qui restent lisibles.
const lireSecrets = (pg, secrets) => pg.evaluate((secrets) => {
  const vus = [], clairs = [];
  const flou = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const f = getComputedStyle(n).filter || ''; if (/blur/.test(f)) return true; } return false; };
  const visible = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; } return true; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = w.nextNode())) {
    const v = t.nodeValue || ''; const el = t.parentElement; if (!el) continue;
    const hit = secrets.find((s) => v.toLowerCase().includes(s.toLowerCase()));
    if (!hit || !visible(el)) continue;
    vus.push(hit);
    if (!flou(el)) clairs.push(v.trim().slice(0, 80));
  }
  for (const c of document.querySelectorAll('input, textarea')) {
    const hit = secrets.find((s) => String(c.value || '').toLowerCase().includes(s.toLowerCase()));
    if (!hit || !visible(c)) continue;
    vus.push(hit); if (!flou(c)) clairs.push('[champ] ' + c.value.slice(0, 60));
  }
  return { vus, clairs };
}, secrets);

(async () => {
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }); }
  catch (e) { console.log(`❌ port ${PORT} pris — relance ce banc seul`); process.exit(1); }
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  dit(SIRET.length === 14, 'le banc a un SIRET valide', SIRET);
  try {
    for (const tel of [true, false]) {
      const qui = tel ? 'téléphone' : 'ordinateur';
      console.log(`── A. ${qui} : le SIRET suffit`);
      {
        const { ctx, pg, ecrits } = await page(nav, tel, 'compta');
        const champ = pg.locator('input[data-profil-champ="siret"]');
        const existe = await champ.count();
        dit(existe > 0, `${qui} : « Ton entreprise » propose le champ SIRET`, '');
        const titre = await pg.evaluate(() => { const c = document.querySelector('[data-profil-fiscal]'); return c ? c.innerText : ''; });
        dit(/Ton entreprise/.test(titre) && !/Profil fiscal/.test(titre), `${qui} : la carte dit « Ton entreprise » (plus « Profil fiscal »)`, titre.slice(0, 80));
        if (existe) { await champ.fill(SIRET); await pg.waitForTimeout(2200); }
        const nom = await pg.evaluate(() => { const c = document.querySelector('input[data-profil-champ="nom"]'); return c ? c.value : null; });
        dit(nom === NOM, `${qui} : le nom de l'entreprise s'est rempli tout seul`, String(nom));
        const tete = await pg.evaluate((tel) => { const e = document.querySelector(tel ? '.vrm-hdr-entreprise' : '.vrm-sidebar-entreprise'); if (!e) return null; const r = e.getBoundingClientRect(); return { t: e.innerText, vis: r.width > 0 && getComputedStyle(e).display !== 'none' }; }, tel);
        dit(!!tete && tete.vis && tete.t === NOM, `${qui} : le nom s'affiche à côté du logo`, JSON.stringify(tete));
        const range = ecrits.flat().filter(Boolean).find((l) => l.id === 'vrm_pro_facture');
        dit(!!range && range.data && range.data.nom === NOM && range.data.siret === SIRET, `${qui} : le nom et le SIRET sont rangés dans l'entité des reçus`, range ? JSON.stringify(range.data).slice(0, 120) : 'aucune écriture');
        await ctx.close();
      }
      {
        const { ctx, pg } = await page(nav, tel, 'compta', { registre: 'muet' });
        const champ = pg.locator('input[data-profil-champ="siret"]');
        if (await champ.count()) { await champ.fill(SIRET); await pg.waitForTimeout(2000); }
        const etat = await pg.evaluate(() => { const c = document.querySelector('input[data-profil-champ="nom"]'); const r = document.querySelector('[data-registre]'); return { nom: c ? c.value : null, reg: r ? r.getAttribute('data-registre') : null, txt: r ? r.innerText : '' }; });
        dit(etat.nom === '', `${qui} : registre muet ⇒ aucun nom inventé`, String(etat.nom));
        dit(etat.reg === 'passu' && /ne répond pas/.test(etat.txt), `${qui} : registre muet ⇒ la phrase le dit`, `${etat.reg} · ${etat.txt}`);
        await ctx.close();
      }
    }
    const SECRETS = [LOGIN, LOGIN2, MAIL_COMPTE, MAIL_VRM, NOM];
    const PROFIL = { nom: NOM, siret: SIRET, nomAuto: NOM };
    for (const tel of [true, false]) {
      const qui = tel ? 'téléphone' : 'ordinateur';
      console.log(`── B. ${qui} : le mode stream floute partout`);
      let vusTotal = 0;
      for (const tab of ['journee', 'plat_vinted', 'vintedaccounts', 'settings', 'compta', 'cat_bord']) {
        const { ctx, pg } = await page(nav, tel, tab, { stream: true, profil: PROFIL });
        // Le panneau de l'extension (le compte ouvert dans Chrome) : on l'ouvre.
        if (tab === 'journee') { const b = pg.locator('[data-etat-actions]'); if (await b.count()) { try { await b.first().click({ timeout: 3000 }); await pg.waitForTimeout(600); } catch (_) {} } }
        if (tab === 'settings') { const b = pg.locator('button', { hasText: /Mon compte/ }); if (await b.count()) { try { await b.first().click({ timeout: 3000 }); await pg.waitForTimeout(800); } catch (_) {} } }
        const r = await lireSecrets(pg, SECRETS);
        vusTotal += r.vus.length;
        dit(r.clairs.length === 0, `${qui} · ${tab} : aucun pseudo, email ou nom d'entreprise lisible`, r.clairs.slice(0, 4).join(' | '));
        await ctx.close();
      }
      dit(vusTotal >= 3, `${qui} : le banc a bien VU des données sensibles à l'écran (${vusTotal}) — sinon il serait vert sur du vide`, String(vusTotal));
    }
    console.log('── C. hors mode stream : rien n’est flou');
    {
      const { ctx, pg } = await page(nav, false, 'vintedaccounts', { stream: false, profil: PROFIL });
      const r = await lireSecrets(pg, SECRETS);
      dit(r.vus.length > 0 && r.clairs.length === r.vus.length, 'hors mode stream, les pseudos se lisent normalement', `${r.clairs.length}/${r.vus.length}`);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ entreprise et mode stream : ${ko} rouge(s)` : '\n✅ entreprise et mode stream : le SIRET suffit, le mode stream floute partout');
  process.exit(ko ? 1 : 0);
})();
