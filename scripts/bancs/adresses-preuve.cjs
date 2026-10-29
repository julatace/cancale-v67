require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// BANC : UNE ADRESSE DE RÉCEPTION PROUVÉE, AU RENDU (22 octobre)
//        BANC_PORT=6243 node scripts/bancs/adresses-preuve.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Une adresse déclarée ne suffit plus (base cloisonnée) : VRM envoie un lien À
// CETTE adresse, le clic depuis la session du vendeur la prouve. L'écran
// « Mes adresses de réception » doit dire, pour CHAQUE adresse, l'état que le
// SERVEUR décide (§11) — confirmée · reçue, à confirmer · lien en préparation ·
// lien envoyé · pas confirmée (ses emails sont mis de côté) · relais Apple — et
// le geste qui va avec, la règle UNE fois au-dessus (§7). Le lien de l'email
// ouvre VRM, est transmis à la route AVEC la session, et le résultat est dit
// UNE fois sur la coque.
// Le banc sert une fausse route `/api/email-rattacher` À ÉTAT : une demande de
// lien fait passer l'adresse de « pas confirmée » à « lien en préparation ».
// Trois états de lecture, jamais deux : lu · pas su (503) · base à une boutique.
// ⚠️ Données INVENTÉES : aucune fixture, le banc vit dans le dépôt.
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6243;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
const LIEN = 'a'.repeat(40) + '.' + 'B'.repeat(43);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `etats` : { adresse: { etat, ... } } que la route `preuves` rend (à état).
// `preuves` : 'panne' (503) · 'unique' (base à une boutique) · undefined (lu).
// `confirmer` : le code HTTP que rend `preuve-confirmer` (200 · 404 · 503).
async function ouvrir(nav, { registre, vues = [], etats = {}, installation = false, collecteur = { at: new Date().toISOString() }, preuves, confirmer = 200, url = '/?tab=settings', viewport = { width: 1512, height: 950 } }) {
  const ctx = await nav.newContext({ viewport });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const etat = { registre, etats: JSON.parse(JSON.stringify(etats)), ecritures: [] };
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if (/id=eq\.vrm_email_owners/.test(u) && r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.keys(etat.registre).length ? [{ data: { adresses: etat.registre } }] : []) });
    // SES adresses déjà vues (suggestions) : la même voie d'ajout que la saisie.
    if (/id=like\.email_inconnu_\*/.test(u) && r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vues || []) });
    if (r.request().method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let rows = []; try { rows = JSON.parse(r.request().postData() || '[]'); } catch (_) {}
      for (const x of (Array.isArray(rows) ? rows : [rows])) { etat.ecritures.push(x); if (x && x.id === 'vrm_email_owners' && x.data && x.data.adresses) etat.registre = x.data.adresses; }
      return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    let corps = null; try { corps = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
    const auth = r.request().headers().authorization || '';
    if (/\/api\/email-rattacher\?mode=preuves/.test(u)) {
      appels.push({ mode: 'preuves', auth });
      if (preuves === 'panne') return r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"base-injoignable"}' });
      if (preuves === 'unique') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"cloisonnee":false,"adresses":{}}' });
      const adresses = {};
      // La forme de la VRAIE route (§6.3) : `retenue` dit si ses emails lui sont
      // attribués (prouvée, ou propriétaire de l'installation quel que soit l'état).
      for (const a of Object.keys(etat.registre)) { const e = etat.etats[a.toLowerCase()] || { etat: installation ? 'transition' : 'aucune' }; adresses[a.toLowerCase()] = { ...e, retenue: e.etat === 'prouvee' || installation }; }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cloisonnee: true, installation, adresses, collecteur }) });
    }
    if (/\/api\/email-rattacher\?mode=preuve-demander/.test(u)) {
      appels.push({ mode: 'demander', auth, corps });
      const a = String((corps && corps.adresse) || '').toLowerCase();
      // (22 oct., revue) La vraie route rend « envoi » AUSSI au propriétaire de
      // l'installation (une demande en cours prime sur « à confirmer »).
      etat.etats[a] = { etat: 'envoi', demandeLe: new Date().toISOString(), expire: new Date(Date.now() + 72 * 3600e3).toISOString() };
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"etat":"envoi"}' });
    }
    if (/\/api\/email-rattacher\?mode=preuve-confirmer/.test(u)) {
      appels.push({ mode: 'confirmer', auth, corps });
      if (confirmer === 200) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, etat: 'prouvee', adresse: 'nouvelle@exemple.test' }) });
      return r.fulfill({ status: confirmer, contentType: 'application/json', body: JSON.stringify({ ok: false, raison: confirmer === 404 ? 'inconnu' : 'base', message: 'x' }) });
    }
    if (/\/api\/email-rattacher/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"cloisonnee":true,"emails":[]}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, erreurs, appels, etat };
}
// « Adresses de réception » est un sous-écran de Réglages (au téléphone, et
// sur ordinateur depuis le 28 oct.) : l'ouvrir avant de toucher un geste.
const ouvrirAdresses = async (pg) => { const s = pg.locator('[data-sous-ouvrir="adresses"]').first(); if (await s.isVisible().catch(() => false)) { await s.click(); await pg.locator('[data-reglage-adresses]').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}); } };
const lignes = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-reglage-adresses] [data-adresse]')].map((x) => [x.getAttribute('data-adresse'), {
  etat: x.getAttribute('data-adresse-etat'), texte: x.innerText.replace(/\s+/g, ' ').trim(), bouton: (x.querySelector('[data-confirmer-adresse]') || {}).innerText || null,
  alerte: (() => { const p = x.querySelector('[data-adresse-preuve]'); return p ? getComputedStyle(p).color : null; })() }])));
const panneau = (pg) => pg.evaluate(() => { const t = document.querySelector('[data-reglage-adresses]'); return t ? { texte: t.innerText, expl: [...t.querySelectorAll('[data-preuve-explication]')].map((x) => x.getAttribute('data-preuve-explication')), boite: (t.querySelector('[data-preuve-boite]') || {}).getAttribute?.('data-preuve-boite') || null, pasSu: t.querySelectorAll('[data-preuves="pas-su"]').length,
  promesse: (t.querySelector('[data-adresses-promesse]') || {}).getAttribute?.('data-adresses-promesse') || null, promesseTexte: (t.querySelector('[data-adresses-promesse]') || {}).innerText || '' } : null; });

(async () => {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e)); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const vieux = new Date(Date.now() - 3 * 3600e3).toISOString();
  try {
    for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      console.log(`\n── A. Un vendeur, ${viewport.width} px : chaque adresse dit SON état`);
      await essaie('A', async () => {
        const reg = { 'ok@exemple.test': { owner: SESSION.user.id }, 'envoye@exemple.test': { owner: SESSION.user.id }, 'rien@exemple.test': { owner: SESSION.user.id }, 'refusee@exemple.test': { owner: SESSION.user.id } };
        const etats = { 'ok@exemple.test': { etat: 'prouvee', via: 'lien' }, 'envoye@exemple.test': { etat: 'envoyee', envoyeLe: vieux, demandeLe: vieux }, 'rien@exemple.test': { etat: 'aucune' }, 'refusee@exemple.test': { etat: 'echec', demandeLe: vieux } };
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { registre: reg, etats, viewport });
        await ouvrirAdresses(pg);
        const l = await lignes(pg); const p = await panneau(pg);
        dit(appels.some((a) => a.mode === 'preuves' && a.auth === 'Bearer jeton-de-banc'), 'l’état est demandé à la ROUTE, avec la session', JSON.stringify(appels.map((a) => a.mode)));
        dit(l['ok@exemple.test'] && l['ok@exemple.test'].etat === 'prouvee' && /confirmée/.test(l['ok@exemple.test'].texte) && !l['ok@exemple.test'].bouton, 'confirmée : dit, sans geste', JSON.stringify(l['ok@exemple.test']));
        dit(l['envoye@exemple.test'] && l['envoye@exemple.test'].etat === 'envoyee' && /lien envoyé le/.test(l['envoye@exemple.test'].texte) && l['envoye@exemple.test'].bouton === 'Renvoyer', 'lien envoyé : la date, et « Renvoyer »', JSON.stringify(l['envoye@exemple.test']));
        dit(l['rien@exemple.test'] && l['rien@exemple.test'].etat === 'aucune' && /pas confirmée — ses emails sont mis de côté/.test(l['rien@exemple.test'].texte) && l['rien@exemple.test'].bouton === 'Confirmer', 'pas confirmée : ce que ça coûte (mis de côté) et le geste', JSON.stringify(l['rien@exemple.test']));
        dit(p && p.expl.length === 1 && p.expl[0] === 'vendeur' && (p.texte.match(/Chaque adresse se confirme une fois/g) || []).length === 1, 'la règle est dite UNE fois au-dessus des lignes (§7)', JSON.stringify(p && p.expl));
        dit(p && !/Les tiennes restent reçues/.test(p.texte), 'à un vendeur, jamais « les tiennes restent reçues » (c’est faux pour lui)', '');
        // (22 oct., revue) La phrase qui promet suit la règle : pour un vendeur,
        // AJOUTER ne suffit plus — c'est la confirmation qui attribue (§5).
        dit(p && p.promesse === 'confirmation' && /confirmée/.test(p.promesseTexte) && !/dès que tu l'ajoutes/.test(p.texte), 'REVUE : l’explication en tête ne promet plus « dès que tu l’ajoutes » à un vendeur — « dès que tu l’as ajoutée puis confirmée »', p && p.promesseTexte);
        dit(l['refusee@exemple.test'] && l['refusee@exemple.test'].etat === 'echec' && /n'a pas pu envoyer/.test(l['refusee@exemple.test'].texte) && l['refusee@exemple.test'].bouton === 'Renvoyer', 'REVUE : un lien que la boîte VRM n’a pas pu envoyer est dit, avec « Renvoyer » — jamais « en préparation » pour toujours', JSON.stringify(l['refusee@exemple.test']));
        // Le geste : « Confirmer » envoie la demande POUR CETTE adresse, avec la session.
        await pg.locator('[data-confirmer-adresse="rien@exemple.test"]').click();
        await pg.waitForTimeout(1500);
        const d = appels.find((a) => a.mode === 'demander');
        dit(!!d && d.corps && d.corps.adresse === 'rien@exemple.test' && d.auth === 'Bearer jeton-de-banc', '« Confirmer » demande le lien pour CETTE adresse, avec la session', JSON.stringify(d || null));
        const l2 = await lignes(pg); const p2 = await panneau(pg);
        dit(l2['rien@exemple.test'] && l2['rien@exemple.test'].etat === 'envoi' && /lien en préparation/.test(l2['rien@exemple.test'].texte) && !l2['rien@exemple.test'].bouton, 'puis la ligne suit le serveur : « lien en préparation », plus de bouton', JSON.stringify(l2['rien@exemple.test']));
        dit(p2 && p2.boite === 'active' && /boîte VRM/.test(p2.texte), 'et d’où il part, une fois (la boîte VRM tourne)', p2 && p2.boite);
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        if (process.env.CAPTURE_DIR) { await pg.locator('[data-reglage-adresses]').scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(process.env.CAPTURE_DIR, `adresses-preuve-${viewport.width}.png`) }).catch(() => {}); }
        await ctx.close();
      });
    }

    console.log('\n── B. Le propriétaire de l’installation : ses adresses restent reçues');
    await essaie('B', async () => {
      const reg = { 'julien@exemple.test': { owner: SESSION.user.id }, 'relais@privaterelay.appleid.com': { owner: SESSION.user.id } };
      const { ctx, pg, erreurs } = await ouvrir(nav, { registre: reg, installation: true });
      await ouvrirAdresses(pg); // (28 oct.) sous-écran aussi sur ordinateur
      const l = await lignes(pg); const p = await panneau(pg);
      dit(l['julien@exemple.test'] && l['julien@exemple.test'].etat === 'transition' && /reçue — à confirmer/.test(l['julien@exemple.test'].texte) && l['julien@exemple.test'].bouton === 'Confirmer', 'à confirmer : reçue en attendant, et « Confirmer »', JSON.stringify(l['julien@exemple.test']));
      dit(l['relais@privaterelay.appleid.com'] && l['relais@privaterelay.appleid.com'].etat === 'transition' && !l['relais@privaterelay.appleid.com'].bouton && /relais Apple/.test(l['relais@privaterelay.appleid.com'].texte), 'un relais Apple : aucun bouton qui ne pourrait pas marcher, et pourquoi', JSON.stringify(l['relais@privaterelay.appleid.com']));
      dit(p && p.expl[0] === 'installation' && /Les tiennes restent reçues/.test(p.texte) && !/sont mis de côté/.test(p.texte.split('Chaque adresse')[1] || ''), 'la règle lui dit que ses adresses restent reçues — aucune alerte', p && p.texte.replace(/\n/g, ' ').slice(0, 300));
      const couleurs = Object.values(l).map((x) => x.alerte);
      dit(new Set(couleurs).size === 1, 'aucune ligne en couleur d’alerte (rien ne lui est retiré)', JSON.stringify(couleurs));
      dit(p && p.promesse === 'directe', 'l’explication en tête lui garde « dès que tu l’ajoutes » (ses adresses restent reçues)', p && p.promesseTexte);
      // (22 oct., revue) Après « Confirmer », la ligne le dit — plus de
      // « reçue — à confirmer » + « Confirmer » pour toujours.
      await pg.locator('[data-confirmer-adresse="julien@exemple.test"]').click();
      await pg.waitForTimeout(1500);
      const l3 = await lignes(pg); const p3 = await panneau(pg);
      dit(l3['julien@exemple.test'] && l3['julien@exemple.test'].etat === 'envoi' && /lien en préparation/.test(l3['julien@exemple.test'].texte) && !/reçue — à confirmer/.test(l3['julien@exemple.test'].texte) && !l3['julien@exemple.test'].bouton, 'REVUE : propriétaire, après « Confirmer » : « lien en préparation », plus de « Confirmer » immédiat', JSON.stringify(l3['julien@exemple.test']));
      dit(p3 && p3.boite === 'active' && /boîte VRM/.test(p3.texte), '… et d’où part le lien, une fois', p3 && p3.boite);
      dit(l3['julien@exemple.test'] && l3['julien@exemple.test'].alerte === couleurs[0], '… sans couleur d’alerte : ses emails lui restent attribués', JSON.stringify(l3['julien@exemple.test']));
      dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    console.log('\n── C. Pas su : la route ne répond pas');
    await essaie('C', async () => {
      const reg = { 'a@exemple.test': { owner: SESSION.user.id }, 'b@exemple.test': { owner: SESSION.user.id } };
      const { ctx, pg } = await ouvrir(nav, { registre: reg, preuves: 'panne' });
      await ouvrirAdresses(pg); // (28 oct.) sous-écran aussi sur ordinateur
      const l = await lignes(pg); const p = await panneau(pg);
      dit(p && p.pasSu === 1 && Object.values(l).every((x) => x.etat === 'pas-su' && !/confirmée|pas confirmée/.test(x.texte)), 'une phrase « pas pu vérifier », UNE fois — aucun état deviné sur les lignes', JSON.stringify({ pasSu: p && p.pasSu, l }));
      dit(p && p.promesse === 'passu' && !/te sont proposés/.test(p.promesseTexte), 'pas su : l’explication ne promet rien (« rien n’est perdu »)', p && p.promesseTexte);
      await ctx.close();
    });

    console.log('\n── D. Ajouter une adresse envoie son lien');
    await essaie('D', async () => {
      // Ajoutée d'un clic depuis ses adresses déjà vues : la même voie
      // (`ajouterAdresses`) que la saisie à la main.
      const { ctx, pg, appels, etat } = await ouvrir(nav, { registre: { 'a@exemple.test': { owner: SESSION.user.id } }, etats: { 'a@exemple.test': { etat: 'prouvee' } }, vues: [{ to: 'nouvelle@exemple.test', quand: new Date().toISOString() }] });
      await ouvrirAdresses(pg);
      await pg.locator('[data-suggestion="nouvelle@exemple.test"] button').first().click();
      await pg.waitForTimeout(2000);
      const ecrite = etat.ecritures.find((x) => x && x.id === 'vrm_email_owners');
      const d = appels.filter((a) => a.mode === 'demander');
      dit(!!ecrite && Object.keys(ecrite.data.adresses).includes('nouvelle@exemple.test'), 'l’adresse est déclarée', ecrite ? Object.keys(ecrite.data.adresses).join(', ') : 'aucune écriture');
      dit(d.length === 1 && d[0].corps.adresse === 'nouvelle@exemple.test', 'et son lien de confirmation est demandé tout de suite — pour elle seule (pas pour celle déjà confirmée)', JSON.stringify(d.map((x) => x.corps)));
      const l = await lignes(pg);
      dit(l['nouvelle@exemple.test'] && l['nouvelle@exemple.test'].etat === 'envoi', 'sa ligne dit « lien en préparation »', JSON.stringify(l['nouvelle@exemple.test']));
      await ctx.close();
    });

    console.log('\n── E. La boîte d’envoi n’a jamais tourné : on le dit, sans promettre');
    await essaie('E', async () => {
      const { ctx, pg } = await ouvrir(nav, { registre: { 'a@exemple.test': { owner: SESSION.user.id } }, etats: { 'a@exemple.test': { etat: 'envoi', demandeLe: vieux } }, collecteur: { at: null } });
      await ouvrirAdresses(pg); // (28 oct.) sous-écran aussi sur ordinateur
      const p = await panneau(pg);
      dit(p && p.boite === 'jamais' && /n'a pas encore tourné/.test(p.texte) && !/dans les prochaines minutes/.test(p.texte), 'la boîte n’a jamais tourné : le lien partira dès qu’elle sera en marche — aucune promesse de délai', p && p.boite);
      await ctx.close();
    });

    console.log('\n── F. Une seule boutique : aucune preuve n’est demandée');
    await essaie('F', async () => {
      const { ctx, pg } = await ouvrir(nav, { registre: { 'a@exemple.test': { owner: SESSION.user.id } }, preuves: 'unique' });
      await ouvrirAdresses(pg); // (28 oct.) sous-écran aussi sur ordinateur
      const l = await lignes(pg); const p = await panneau(pg);
      dit(p && !p.expl.length && !p.pasSu && l['a@exemple.test'] && l['a@exemple.test'].etat === 'sans-preuve' && !l['a@exemple.test'].bouton, 'base à une boutique : ni état, ni règle, ni bouton', JSON.stringify(l));
      await ctx.close();
    });

    for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      console.log(`\n── G. Le lien de l’email, ${viewport.width} px`);
      await essaie('G', async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { registre: {}, url: `/?confirmer-adresse=${LIEN}`, viewport });
        const c = appels.find((a) => a.mode === 'confirmer');
        dit(!!c && c.corps && c.corps.lien === LIEN && c.auth === 'Bearer jeton-de-banc', 'le lien est transmis à la route, avec la session', JSON.stringify(c || null));
        const b = await pg.evaluate(() => [...document.querySelectorAll('[data-confirmation-adresse]')].map((x) => ({ e: x.getAttribute('data-confirmation-adresse'), t: x.innerText })));
        dit(b.length === 1 && b[0].e === 'ok' && /nouvelle@exemple\.test/.test(b[0].t) && /confirmée/.test(b[0].t), 'le résultat est dit UNE fois, sur la coque, avec l’adresse', JSON.stringify(b));
        dit(!/confirmer-adresse/.test(await pg.evaluate(() => location.href)), 'le lien est retiré de la barre d’adresse', await pg.evaluate(() => location.href));
        const voir = pg.locator('[data-voir-adresses]').first();
        if (await voir.count()) { await voir.click(); await pg.waitForTimeout(2200); await ouvrirAdresses(pg); }
        const vu = await pg.evaluate(() => !!document.querySelector('[data-reglage-adresses]'));
        dit(vu, '« Voir mes adresses » mène au panneau des adresses', String(vu));
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
    console.log('\n── H. Le lien, quand il ne sert pas');
    await essaie('H', async () => {
      const r1 = await ouvrir(nav, { registre: {}, url: `/?confirmer-adresse=${LIEN}`, confirmer: 404 });
      const b1 = await r1.pg.evaluate(() => (document.querySelector('[data-confirmation-adresse]') || {}).getAttribute?.('data-confirmation-adresse'));
      const t1 = await r1.pg.evaluate(() => (document.querySelector('[data-confirmation-adresse]') || {}).innerText || '');
      dit(b1 === 'inconnu' && /connecté avec le compte qui a ajouté/.test(t1), 'un lien qui n’est pas pour ce compte : dit, avec le geste — jamais « confirmée »', `${b1} · ${t1}`);
      await r1.ctx.close();
      const r2 = await ouvrir(nav, { registre: {}, url: `/?confirmer-adresse=${LIEN}`, confirmer: 503 });
      const t2 = await r2.pg.evaluate(() => (document.querySelector('[data-confirmation-adresse]') || {}).innerText || '');
      const b2 = await r2.pg.evaluate(() => (document.querySelector('[data-confirmation-adresse]') || {}).getAttribute?.('data-confirmation-adresse'));
      dit(b2 === 'passu' && /rien n'est perdu/.test(t2) && /Réessayer/.test(t2), 'le serveur ne répond pas : « pas pu », rien n’est perdu, réessayer — jamais « confirmée »', `${b2} · ${t2}`);
      await r2.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ adresses prouvées : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ adresses prouvées : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
