// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN PAR L'INTERFACE DE LA PAGE (21 nov., ext. 5.416.0 — `lbcinterface`)
//        node scripts/bancs/lbc-interface.cjs [--ecrire f] [--inject f] [--relay f] [--prouve]
//
//  Julien (21 nov.) : « on ne fait plus les requêtes », « pour tous les sites ». Sur leboncoin.fr, la mise en
//  pause, la suppression, le changement de prix et la réponse dans une conversation se font par la PAGE :
//  lbc-ecrire.js clique et tape, la page envoie, lbc-inject.js VOIT l'envoi (la preuve).
//  Le VRAI lbc-inject.js + le VRAI lbc-relay.js + le VRAI lbc-ecrire.js dans un VRAI Chromium, sur un FAUX
//  leboncoin.fr servi par le banc (« Mes annonces » de 50 annonces AU MÊME TITRE, une messagerie, une fiche
//  de prix) — tout INVENTÉ (le dépôt est public) :
//   A1  apprendre : SA mise en pause à la main (clics VRAIS) ⇒ 3 étapes retenues (rangée, menu, confirmation),
//       jamais le titre, jamais le prix ; la base ne reçoit que « appris »
//   A2  50 annonces identiques : l'ordre pour la 31e ⇒ UNE requête, pour la 31e seulement, faite PAR LA PAGE ;
//       « fait » sur la preuve
//   A3  double ordre ⇒ une seule action (l'autre « en cours »)
//   A4  onglet sur un autre compte ⇒ rien (aucun clic)
//   A5  vérification VISIBLE ⇒ arrêt, aucun clic ; un cadre reCAPTCHA invisible ne bloque pas
//   A6  annonce absente de la page ⇒ rien
//   S1  suppression apprise ; la page a changé (bouton final renommé) ⇒ ARRÊT AVANT le geste irréversible,
//       l'élément nommé, aucune requête ; page normale ⇒ UNE suppression, la bonne annonce
//   M1  réponse apprise de SON envoi ; l'ordre ⇒ texte tapé LETTRE À LETTRE, envoyé par la page, « fait » sur
//       la preuve (CE texte, CETTE conversation)
//   M2  la page n'envoie pas ⇒ « pas vu », jamais « fait »
//   M3  page sur une autre conversation ⇒ rien n'est tapé ; brouillon dans le champ ⇒ rien n'est tapé
//   R1  prix appris de SON geste ; l'ordre ⇒ prix RELU sur la fiche (celui de l'aperçu), nouveau tapé, envoyé
//   R2  la fiche montre un autre prix ⇒ rien n'est touché
//   N1  des clics FABRIQUÉS par la page (isTrusted:false) n'apprennent rien
//   P1  (5.426, « retirée partout ») SA réactivation à la main ⇒ apprise à part (la pause reste), jamais notée comme un retrait
//   P2  l'ordre « reprise » ⇒ la 41e seulement (50 au même titre), « fait » sur la preuve ; P3 autre compte ⇒ rien
//  `--prouve` : chaque règle réaffaiblie dans lbc-ecrire.js / lbc-inject.js doit faire rougir le banc.
//  Captures : SHOTS=dossier (390 px puis 1512 px).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  ecrire: arg('--ecrire', path.join(racine, 'vinted-sync-extension/lbc-ecrire.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/lbc-inject.js')),
  relay: arg('--relay', path.join(racine, 'vinted-sync-extension/lbc-relay.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['titreAuLieuId', 'ecrire', "    const l = [...ens];", "    const l = [...document.querySelectorAll('a[href]')].filter((a) => /Air Max/.test(a.textContent)).slice(0, 1).map((a) => a.closest('li'));"],
    ['ambigu', 'ecrire', "    return { el: liste.length === 1 ? liste[0] : null, n: liste.length };", "    return { el: liste[0] || null, n: liste.length };"],
    ['sansCompte', 'ecrire', "      if (String(msg.compte || '') !== et.moi) return arret('autre-compte');", ''],
    ['sansCaptcha', 'ecrire', "        if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true;", ''],
    ['captchaToutCadre', 'ecrire', "        if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true;", '        return true;'],
    ['faitSansVu', 'ecrire', '  const fini = (g, extra) => (g ? ', '  const fini = (g, extra) => ((g = g || { statut: 200, defi: false }) ? '],
    ['deuxALaFois', 'ecrire', "    if (ordreEnCours) return arret('en-cours');", ''],
    ['etapeDevinee', 'ecrire', "      if (!t.el) return { r: arret(t.n ? 'etape-ambigue' : 'etape-introuvable',", "      if (!t.el && false) return { r: arret(t.n ? 'etape-ambigue' : 'etape-introuvable',"],
    ['toutDunCoup', 'ecrire', "    for (const ch of [...texte]) {", "    for (const ch of [texte]) {"],
    ['autreConv', 'ecrire', "      if (!co || co.conv !== conv) return arret(", "      if (false) return arret("],
    ['prixNonRelu', 'ecrire', "        if (vuPage == null || Math.round(vuPage * 100) !== Math.round(avantE * 100)) return arret('prix-page-different', { prixPage: vuPage });", ''],
    ['brouillon', 'ecrire', "      if (contenu(champ)) return arret('champ-pas-vide');", ''],
    ['apprendSynthetique', 'ecrire', "      if (!e.isTrusted) return;\n      const t = e.target", "      const t = e.target"],
    ['apprendTitre', 'ecrire', "    if (avecMot) { const t = propre(el.textContent).slice(0, 40); if (t && !/\\d/.test(t)) s.mot = t; }", "    if (avecMot) { const t = propre(el.parentElement ? el.parentElement.textContent : el.textContent).slice(0, 60); if (t) s.mot = t; }"],
    ['repriseCommePause', 'inject', "      if (!/^(delete|pause)$/i.test(m[1])) return;   // 5.426 : une réactivation n'est pas un retrait (le relais ne la note pas)\n", ''],
    ['repriseOubliee', 'ecrire', "    if (g.quoi === 'pause' || g.quoi === 'supprime' || g.quoi === 'reprise') {\n      if (g.ids.length !== 1)", "    if (g.quoi === 'pause' || g.quoi === 'supprime') {\n      if (g.ids.length !== 1)"],
    ['preuveSansId', 'inject', "        versRelais({ kind: 'lbcgestevu', quoi, ids, statut: st, moi, defi });", "        versRelais({ kind: 'lbcgestevu', quoi, ids: [String(j && j.list_ids && j.list_ids[0] || '')].concat(ids), statut: 200, moi, defi });"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-lbc-interface-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 900000, env: Object.assign({}, process.env, { SHOTS: '' }) });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir le banc' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0, okN = 0;
const dit = (ok, nom, det) => { if (ok) okN++; else ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 600)}`); };
const SHOTS = process.env.SHOTS || '';
const MOI = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b', AUTRE = '9e9e9e9e-2222-4333-8444-955566667777';
const IDS = Array.from({ length: 50 }, (_, i) => String(2876500100 + i * 7));
const C1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', C2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const TITRE = 'Air Max 90 blanche — taille 42';

// ── Le FAUX leboncoin.fr (inventé) ──
const STYLE = `<style>body{font:15px system-ui;margin:0;padding:12px}li.row{display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #ddd}
li.row a{flex:1;color:#222}button{min-height:36px;padding:4px 10px}[role=menu],[role=dialog]{position:fixed;top:30%;left:10%;right:10%;background:#fff;border:1px solid #888;padding:12px;display:flex;gap:8px;z-index:9}</style>`;
const COMPTE_JS = (moi) => `fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then(r=>r.text());`;
function pageAnnonces(o) {
  const rows = IDS.map((id) => `<li class="row" data-qa="row"><a href="/ad/chaussures/${id}">${TITRE}</a><span>120 €</span><button type="button" class="plus" aria-label="Plus d’options">⋯</button></li>`).join('');
  const fin = o.renomme ? 'Valider' : 'Supprimer définitivement';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${STYLE}</head><body>
<h1>Mes annonces</h1><ul style="list-style:none;padding:0">${rows}</ul>
${o.captcha ? '<iframe src="https://geo.captcha-delivery.com/captcha/?x=1" style="position:fixed;top:0;left:0;width:400px;height:300px"></iframe>' : ''}
${o.captchaInvisible ? '<iframe src="https://www.google.com/recaptcha/api2/anchor?k=x" style="width:1px;height:1px;border:0"></iframe>' : ''}
<script>
${COMPTE_JS()}
window.__clicsFaux = 0; document.addEventListener('click', (e) => { if (!e.isTrusted) window.__clicsFaux++; }, true);
let cible = '';
const fermer = () => document.querySelectorAll('[role=menu],[role=dialog]').forEach((x) => x.remove());
const ecrire = (methode, quoi, id) => fetch('https://api.leboncoin.fr/api/pintad/v1/public/manual/' + quoi + '/ads', { method: methode, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list_ids: [Number(id)] }) }).then((r) => r.text());
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('plus')) { fermer(); cible = b.closest('li').querySelector('a').getAttribute('href').split('/').pop();
    const m = document.createElement('div'); m.setAttribute('role', 'menu'); m.innerHTML = '<button type="button" role="menuitem">Désactiver</button><button type="button" role="menuitem">Réactiver</button><button type="button" role="menuitem">Supprimer</button>'; document.body.appendChild(m); return; }
  const t = b.textContent.trim();
  if (t === 'Désactiver' || t === 'Supprimer') { fermer(); const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.dataset.quoi = t === 'Désactiver' ? 'pause' : 'delete';
    d.innerHTML = t === 'Désactiver' ? '<button type="button">Confirmer</button>${o.double ? '<button type="button">Confirmer</button>' : ''}<button type="button">Annuler</button>' : '<button type="button">${fin}</button><button type="button">Annuler</button>'; document.body.appendChild(d); return; }
  if (t === 'Réactiver') { fermer(); const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.dataset.quoi = 'unpause'; d.innerHTML = '<button type="button">Remettre en ligne</button><button type="button">Annuler</button>'; document.body.appendChild(d); return; }
  if (t === 'Remettre en ligne') { fermer(); ecrire('PUT', 'unpause', cible); return; }
  if (t === 'Confirmer') { fermer(); ecrire('PUT', 'pause', cible); return; }
  if (t === 'Supprimer définitivement' || t === 'Valider') { fermer(); ecrire('DELETE', 'delete', cible); return; }
  if (t === 'Annuler') fermer();
}, false);
</script></body></html>`;
}
function pageConv(o, conv) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${STYLE}</head><body>
<h1>Conversation</h1><div id="fil"></div>
<textarea aria-label="Écrire un message" rows="3" style="width:90%;height:60px">${o.brouillon ? 'mon brouillon' : ''}</textarea>
<button type="button" class="envoyer">Envoyer</button>
<script>
window.__clicsFaux = 0; document.addEventListener('click', (e) => { if (!e.isTrusted) window.__clicsFaux++; }, true);
window.__frappes = 0; document.addEventListener('input', () => { window.__frappes++; }, true);
const base = 'https://api.leboncoin.fr/api/messaging/proxy/api/hal/${o.moi || MOI}/conversations/';
const charge = ${JSON.stringify(o.charge || conv)};
fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then((r) => r.text()).then(() => fetch(base + charge + '/messages').then((r) => r.text()));
document.querySelector('.envoyer').addEventListener('click', () => {
  const ta = document.querySelector('textarea'); const t = ta.value;
  if (${o.muet ? 'true' : 'false'} || !t.trim()) return;
  fetch(base + charge + '/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t, type: 'text' }) }).then((r) => r.text());
  ta.value = '';
});
</script></body></html>`;
}
function pagePrix(o, id) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${STYLE}</head><body>
<h1>Modifier l’annonce</h1><p>${TITRE}</p>
<label>Prix <input name="price" inputmode="numeric" value="${o.prix || 120}"></label>
<button type="button" class="valider">Valider les modifications</button>
<script>
window.__clicsFaux = 0; document.addEventListener('click', (e) => { if (!e.isTrusted) window.__clicsFaux++; }, true);
fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then((r) => r.text());
document.querySelector('.valider').addEventListener('click', () => {
  const v = Number(document.querySelector('input[name=price]').value.replace(',', '.'));
  fetch('https://api.leboncoin.fr/api/adedit/v1/ads/${id}', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: ${JSON.stringify(TITRE)}, body: 'Très bon état', category_id: 2, price: [v] }) }).then((r) => r.text());
});
</script></body></html>`;
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(racine, 'node_modules', 'playwright'))); }
const INJ = fs.readFileSync(F.inject, 'utf8'), REL = fs.readFileSync(F.relay, 'utf8'), ECR = fs.readFileSync(F.ecrire, 'utf8');
// `chrome.*` minimal du monde isolé (le banc tient les scripts de l'extension dans la page : la DOM est la même).
const CHROME = (store) => `window.__vrmBancDisjoncteur = { fin: 1 };
window.__envois = []; window.__store = ${JSON.stringify(store || {})}; window.__ecoutes = [];
window.chrome = { runtime: { id: 'x', lastError: null, sendMessage: (m, cb) => { try { window.__envois.push(JSON.parse(JSON.stringify(m))); } catch (_) {} if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener: (f) => window.__ecoutes.push(f) } },
  storage: { local: { get: async (k) => { const o = {}; for (const c of [].concat(k)) if (window.__store[c] !== undefined) o[c] = JSON.parse(JSON.stringify(window.__store[c])); return o; }, set: async (o) => { Object.assign(window.__store, JSON.parse(JSON.stringify(o))); } } } };
window.__ordre = (msg) => new Promise((res) => { let rendu = false; for (const f of window.__ecoutes) { const r = f(msg, { id: 'x' }, (x) => { rendu = true; res(x); }); if (r === true) return; } if (!rendu) res(undefined); });`;

let store = {};
async function ouvrir(nav, url, o = {}) {
  const ctx = await nav.newContext({ viewport: o.vue || { width: 390, height: 844 }, hasTouch: !!o.toucher, isMobile: !!o.toucher });
  const pg = await ctx.newPage();
  const ecrits = [];
  await ctx.route('https://api.leboncoin.fr/**', async (r) => {
    const q = r.request(), u = q.url(), m = q.method();
    let body = {}, status = 200;
    if (/\/api\/account\/v1\/members\/me\/account$/.test(u)) body = { account: { account_id: o.moi || MOI, type: 'private' }, member: { account_id: o.moi || MOI, nickname: { value: 'Vendeur Test' } } };
    else if (/\/conversations\/[\w-]+\/messages$/.test(u) && m === 'GET') body = { conversationContext: { conversationId: u.split('/').slice(-2)[0], itemId: IDS[3] }, _embedded: { messages: [{ id: 'm1', text: 'Bonjour, toujours dispo ?', createdAt: '2026-11-21T08:00:00Z', author: { id: AUTRE } }] } };
    if (m !== 'GET') { ecrits.push({ m, u, corps: q.postData() }); status = o.statutEcriture || (m === 'POST' ? 201 : 200); body = { ok: true }; }
    return r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
  });
  await ctx.route('https://www.leboncoin.fr/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    if (/^\/compte\/part\/mes-annonces/.test(p)) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pageAnnonces(o) });
    const mc = /^\/messages\/id\/([\w-]+)/.exec(p); if (mc) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pageConv(o, mc[1]) });
    const mp = /^\/compte\/part\/annonce\/(\d+)\/modifier/.exec(p); if (mp) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pagePrix(o, mp[1]) });
    return r.fulfill({ status: 404, body: 'x' });
  });
  await ctx.route(/captcha-delivery|google\.com\/recaptcha/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>vérification</body></html>' }));
  await pg.addInitScript({ content: CHROME(store) });
  await pg.addInitScript({ content: INJ });
  await pg.addInitScript({ content: REL });
  await pg.goto(url);
  await pg.waitForTimeout(400);
  await pg.evaluate(ECR);
  await pg.waitForTimeout(250);
  const fin = async () => { try { store = await pg.evaluate(() => window.__store); } catch (_) {} await ctx.close(); };
  return { ctx, pg, ecrits, fin, ordre: (m) => pg.evaluate((mm) => window.__ordre(Object.assign({ from: 'vrm-fond', action: 'lbcGesteUI' }, mm)), m), faux: () => pg.evaluate(() => window.__clicsFaux) };
}
const ANNONCES = 'https://www.leboncoin.fr/compte/part/mes-annonces';
const corpsIds = (e) => { try { return JSON.parse(e.corps).list_ids.map(String); } catch (_) { return null; } };
const shot = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

(async () => {
  const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] } : { args: ['--no-sandbox'] });
  try {
    // ── N1 : des clics FABRIQUÉS par la page n'apprennent rien ──
    { const A = await ouvrir(nav, ANNONCES);
      await A.pg.evaluate((id) => { const li = [...document.querySelectorAll('li.row')].find((x) => x.querySelector('a').getAttribute('href').endsWith(id)); li.querySelector('.plus').click(); [...document.querySelectorAll('[role=menuitem]')].find((b) => b.textContent === 'Désactiver').click(); [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Confirmer').click(); }, IDS[2]);
      await A.pg.waitForTimeout(700);
      const s = await A.pg.evaluate(() => window.__store);
      dit(A.ecrits.length === 1 && !(s.vrmLbcUi && s.vrmLbcUi.pause), 'N1 — une mise en pause faite par des clics FABRIQUÉS (isTrusted:false) n’apprend rien', JSON.stringify({ e: A.ecrits.length, ui: s.vrmLbcUi }));
      await A.fin(); store = {}; }

    // ── A1 : apprendre SA mise en pause (clics VRAIS) ──
    { const A = await ouvrir(nav, ANNONCES);
      const row = A.pg.locator('li.row').nth(6);
      await row.locator('.plus').click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('menuitem', { name: 'Désactiver' }).click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('button', { name: 'Confirmer' }).click(); await A.pg.waitForTimeout(800);
      const s = await A.pg.evaluate(() => window.__store);
      const ui = s.vrmLbcUi && s.vrmLbcUi.pause;
      const env = await A.pg.evaluate(() => window.__envois.filter((m) => m.action === 'lbcUiAppris'));
      dit(A.ecrits.length === 1 && JSON.stringify(corpsIds(A.ecrits[0])) === JSON.stringify([IDS[6]]), 'A1 — SA mise en pause à la main : la page a envoyé la pause de la 7e annonce', JSON.stringify(A.ecrits));
      dit(!!ui && ui.etapes.length === 3 && ui.etapes.map((e) => e.portee).join(',') === 'ligne,page,page' && ui.etapes[1].sig.mot === 'Désactiver' && ui.etapes[2].sig.mot === 'Confirmer', 'A1 — trois étapes apprises : le bouton de LA rangée, « Désactiver », « Confirmer »', JSON.stringify(ui));
      dit(!!ui && !JSON.stringify(ui).includes('Air Max') && !JSON.stringify(ui).includes('120') && !JSON.stringify(ui).includes(IDS[6]) && ui.page.modele === '/compte/part/mes-annonces', 'A1 — ni le titre, ni le prix, ni l’identifiant de l’annonce dans ce qui est appris ; la page apprise', JSON.stringify(ui && ui.page));
      dit(env.length === 1 && env[0].quoi === 'pause' && env[0].appris === true && Object.keys(env[0]).every((k) => ['from', 'action', 'quoi', 'appris', 'etapes'].includes(k)), 'A1 — le fond reçoit « appris » (et le nombre d’étapes), rien d’autre', JSON.stringify(env));
      await A.fin(); }

    // ── A2 : 50 annonces au même titre — l'ordre pour la 31e ──
    { const A = await ouvrir(nav, ANNONCES);
      const r = await A.ordre({ quoi: 'pause', id: IDS[30], compte: MOI });
      dit(!!r && r.confirme === true && r.statut === 200, 'A2 — « fait » : la page a envoyé la pause (preuve vue par le capteur)', JSON.stringify(r));
      dit(A.ecrits.length === 1 && A.ecrits[0].m === 'PUT' && JSON.stringify(corpsIds(A.ecrits[0])) === JSON.stringify([IDS[30]]), 'A2 — 50 annonces au MÊME titre : UNE requête, pour la 31e seulement (jamais une voisine)', JSON.stringify(A.ecrits.map((e) => [e.m, e.corps])));
      dit((await A.faux()) === 3, 'A2 — trois clics de l’extension (isTrusted:false, assumés), pas un de plus', String(await A.faux()));
      await shot(A.pg, '390-mes-annonces-apres-pause');
      await A.fin(); }

    // ── A3 : double ordre ⇒ une seule action ──
    { const A = await ouvrir(nav, ANNONCES);
      const [r1, r2] = await Promise.all([A.ordre({ quoi: 'pause', id: IDS[31], compte: MOI }), A.ordre({ quoi: 'pause', id: IDS[31], compte: MOI })]);
      const parti = [r1, r2].filter((r) => r && r.confirme).length, enCours = [r1, r2].filter((r) => r && r.erreur === 'en-cours').length;
      dit(parti === 1 && enCours === 1 && A.ecrits.length === 1, 'A3 — deux ordres en même temps (double clic) : UNE action, l’autre « en cours »', JSON.stringify({ r1, r2, e: A.ecrits.length }));
      const r3 = await A.ordre({ quoi: 'pause', id: IDS[31], compte: MOI });
      dit(r3 && r3.erreur === 'deja' && A.ecrits.length === 1, 'A3 — la même pause redemandée juste après : « déjà », rien ne repart', JSON.stringify(r3));
      await A.fin(); }

    // ── A4 : onglet sur un AUTRE compte ⇒ rien ──
    { const A = await ouvrir(nav, ANNONCES, { moi: AUTRE });
      const r = await A.ordre({ quoi: 'pause', id: IDS[10], compte: MOI });
      dit(r && r.erreur === 'autre-compte' && !r.geste && A.ecrits.length === 0 && (await A.faux()) === 0, 'A4 — la page est sur un autre compte : rien (aucun clic, aucune requête)', JSON.stringify(r));
      await A.fin(); }

    // ── A5 : vérification VISIBLE ⇒ arrêt ; invisible ⇒ ne bloque pas ──
    { const A = await ouvrir(nav, ANNONCES, { captcha: true });
      const r = await A.ordre({ quoi: 'pause', id: IDS[11], compte: MOI });
      dit(r && r.erreur === 'verification' && A.ecrits.length === 0 && (await A.faux()) === 0, 'A5 — une vérification VISIBLE : arrêt, aucun clic', JSON.stringify(r));
      await shot(A.pg, '390-verification-visible');
      await A.fin();
      const B = await ouvrir(nav, ANNONCES, { captchaInvisible: true });
      const r2 = await B.ordre({ quoi: 'pause', id: IDS[12], compte: MOI });
      dit(r2 && r2.confirme === true && B.ecrits.length === 1, 'A5 — un cadre reCAPTCHA invisible (1 × 1) ne compte pas : le geste se fait', JSON.stringify(r2));
      await B.fin(); }

    // ── A7 : la page montre DEUX « Confirmer » ⇒ VRM ne choisit pas (aucune requête) ──
    { const A = await ouvrir(nav, ANNONCES, { double: true });
      const r = await A.ordre({ quoi: 'pause', id: IDS[13], compte: MOI });
      dit(r && r.erreur === 'etape-ambigue' && r.element === 'Confirmer' && A.ecrits.length === 0, 'A7 — deux boutons « Confirmer » sur la page : VRM ne choisit pas, arrêt avant, aucune requête', JSON.stringify(r));
      await A.fin(); }

    // ── A6 : annonce absente de la page ⇒ rien ──
    { const A = await ouvrir(nav, ANNONCES);
      const r = await A.ordre({ quoi: 'pause', id: '2999999999', compte: MOI });
      dit(r && r.erreur === 'annonce-absente' && A.ecrits.length === 0 && (await A.faux()) === 0, 'A6 — une annonce qui n’est pas sur la page : rien', JSON.stringify(r));
      await A.fin(); }

    // ── S1 : supprimer ──
    { const A = await ouvrir(nav, ANNONCES);
      await A.pg.locator('li.row').nth(2).locator('.plus').click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('menuitem', { name: 'Supprimer' }).click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('button', { name: 'Supprimer définitivement' }).click(); await A.pg.waitForTimeout(800);
      const ui = (await A.pg.evaluate(() => window.__store)).vrmLbcUi.supprime;
      dit(!!ui && ui.etapes.length === 3 && ui.etapes[2].sig.mot === 'Supprimer définitivement', 'S1 — SA suppression à la main : trois étapes apprises, la dernière « Supprimer définitivement »', JSON.stringify(ui));
      await A.fin();
      const B = await ouvrir(nav, ANNONCES, { renomme: true });
      const r = await B.ordre({ quoi: 'supprime', id: IDS[40], compte: MOI });
      dit(r && r.erreur === 'etape-introuvable' && r.etape === 3 && r.derniere === true && r.element === 'Supprimer définitivement' && B.ecrits.length === 0, 'S1 — le bouton final a changé sur la page : ARRÊT AVANT le geste irréversible, l’élément nommé, aucune requête', JSON.stringify(r));
      dit((await B.faux()) === 2, 'S1 — seuls les deux clics d’avant (menu), jamais un bouton deviné', String(await B.faux()));
      await shot(B.pg, '390-suppression-arret-avant');
      await B.fin();
      const C = await ouvrir(nav, ANNONCES);
      const r2 = await C.ordre({ quoi: 'supprime', id: IDS[41], compte: MOI });
      dit(r2 && r2.confirme === true && C.ecrits.length === 1 && C.ecrits[0].m === 'DELETE' && JSON.stringify(corpsIds(C.ecrits[0])) === JSON.stringify([IDS[41]]), 'S1 — page normale : UNE suppression, la bonne annonce, faite par la page', JSON.stringify(C.ecrits));
      await C.fin(); }

    // ── M1 : répondre ──
    { const A = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C1);
      await A.pg.waitForTimeout(300);
      await A.pg.locator('textarea').click(); await A.pg.keyboard.type('Oui, toujours dispo');
      await A.pg.getByRole('button', { name: 'Envoyer' }).click(); await A.pg.waitForTimeout(800);
      const ui = (await A.pg.evaluate(() => window.__store)).vrmLbcUi.message;
      dit(!!ui && ui.envoi && ui.envoi.sig && ui.envoi.sig.mot === 'Envoyer' && ui.page.modele === '/messages/id/{conv}' && !JSON.stringify(ui).includes('dispo'), 'M1 — SA réponse à la main : le champ, « Envoyer », l’adresse d’une conversation (`{conv}`) — jamais son texte', JSON.stringify(ui));
      await A.fin();
      const B = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C1);
      const TXT = 'Bonjour, je peux envoyer lundi 😊';
      const f0 = await B.pg.evaluate(() => window.__frappes);
      const r = await B.ordre({ quoi: 'message', conv: C1, texte: TXT, compte: MOI });
      const f1 = await B.pg.evaluate(() => window.__frappes);
      let corps = null; try { corps = JSON.parse(B.ecrits[0].corps); } catch (_) {}
      dit(r && r.confirme === true && B.ecrits.length === 1 && corps && corps.text === TXT && B.ecrits[0].u.includes(C1), 'M1 — l’ordre : la PAGE envoie CE texte dans CETTE conversation, « fait » sur la preuve', JSON.stringify({ r, e: B.ecrits }));
      dit(f1 - f0 >= [...TXT].length, 'M1 — tapé LETTRE À LETTRE (une frappe par caractère)', `${f1 - f0} frappes pour ${[...TXT].length} caractères`);
      await shot(B.pg, '390-message-envoye');
      await B.fin();
      const C = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C1, { muet: true });
      const r2 = await C.ordre({ quoi: 'message', conv: C1, texte: 'Bien reçu', compte: MOI });
      dit(r2 && r2.erreur === 'pas-vu' && r2.envoye === true && !r2.confirme && C.ecrits.length === 0, 'M2 — la page n’envoie pas : « pas vu », jamais « fait »', JSON.stringify(r2));
      await C.fin();
      const D = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C2);
      const r3 = await D.ordre({ quoi: 'message', conv: C1, texte: 'Bien reçu', compte: MOI });
      dit(r3 && r3.erreur === 'pas-ouverte' && D.ecrits.length === 0 && (await D.pg.evaluate(() => document.querySelector('textarea').value)) === '', 'M3 — la page est sur une AUTRE conversation : rien n’est tapé', JSON.stringify(r3));
      await D.fin();
      const D2 = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C1, { charge: C2 });
      const r3b = await D2.ordre({ quoi: 'message', conv: C1, texte: 'Bien reçu', compte: MOI });
      dit(r3b && r3b.erreur === 'autre-conversation' && D2.ecrits.length === 0 && (await D2.pg.evaluate(() => document.querySelector('textarea').value)) === '', 'M3 — l’adresse dit la conversation, mais la page en a chargé une AUTRE : rien n’est tapé', JSON.stringify(r3b));
      await D2.fin();
      const E = await ouvrir(nav, 'https://www.leboncoin.fr/messages/id/' + C1, { brouillon: true });
      const r4 = await E.ordre({ quoi: 'message', conv: C1, texte: 'Bien reçu', compte: MOI });
      dit(r4 && r4.erreur === 'champ-pas-vide' && E.ecrits.length === 0 && (await E.pg.evaluate(() => document.querySelector('textarea').value)) === 'mon brouillon', 'M3 — un brouillon dans le champ : VRM n’y touche pas', JSON.stringify(r4));
      await E.fin(); }

    // ── R1 / R2 : le prix ──
    { const A = await ouvrir(nav, `https://www.leboncoin.fr/compte/part/annonce/${IDS[4]}/modifier`);
      const champ = A.pg.locator('input[name=price]');
      await champ.click({ clickCount: 3 }); await A.pg.keyboard.press('Backspace'); await A.pg.keyboard.type('110');
      await A.pg.getByRole('button', { name: 'Valider les modifications' }).click(); await A.pg.waitForTimeout(800);
      const ui = (await A.pg.evaluate(() => window.__store)).vrmLbcUi.prix;
      dit(!!ui && ui.page.modele === '/compte/part/annonce/{ad}/modifier' && ui.champ.attrs.name === 'price' && ui.etapes.length === 1 && !JSON.stringify(ui).includes('110'), 'R1 — SON changement de prix : le champ, « Valider », l’adresse de la fiche (`{ad}`) — jamais le prix', JSON.stringify(ui));
      await A.fin();
      const B = await ouvrir(nav, `https://www.leboncoin.fr/compte/part/annonce/${IDS[7]}/modifier`);
      const r = await B.ordre({ quoi: 'prix', id: IDS[7], prix: 100, prixAvant: 120, compte: MOI });
      let corps = null; try { corps = JSON.parse(B.ecrits[0].corps); } catch (_) {}
      dit(r && r.confirme === true && r.prixVu === 100 && B.ecrits.length === 1 && B.ecrits[0].u.endsWith('/' + IDS[7]) && corps && corps.price[0] === 100, 'R1 — l’ordre : prix relu (120 €), 100 tapé, la PAGE envoie 100 € pour CETTE annonce', JSON.stringify({ r, e: B.ecrits }));
      await shot(B.pg, '390-prix-change');
      await B.fin();
      const C = await ouvrir(nav, `https://www.leboncoin.fr/compte/part/annonce/${IDS[8]}/modifier`, { prix: 130 });
      const r2 = await C.ordre({ quoi: 'prix', id: IDS[8], prix: 100, prixAvant: 120, compte: MOI });
      dit(r2 && r2.erreur === 'prix-page-different' && r2.prixPage === 130 && C.ecrits.length === 0 && (await C.pg.evaluate(() => document.querySelector('input').value)) === '130', 'R2 — la fiche montre 130 € (pas les 120 € lus) : rien n’est touché', JSON.stringify(r2));
      await C.fin();
      const D = await ouvrir(nav, `https://www.leboncoin.fr/compte/part/annonce/${IDS[9]}/modifier`);
      const r3 = await D.ordre({ quoi: 'prix', id: IDS[8], prix: 100, prixAvant: 120, compte: MOI });
      dit(r3 && r3.erreur === 'pas-ouverte' && D.ecrits.length === 0, 'R2 — la fiche ouverte est celle d’une AUTRE annonce : rien', JSON.stringify(r3));
      await D.fin(); }

    // ── P1 (5.426) : apprendre SA réactivation (clics VRAIS) — à part de la pause ──
    { const A = await ouvrir(nav, ANNONCES);
      const row = A.pg.locator('li.row').nth(4);
      await row.locator('.plus').click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('menuitem', { name: 'Réactiver' }).click(); await A.pg.waitForTimeout(200);
      await A.pg.getByRole('button', { name: 'Remettre en ligne' }).click(); await A.pg.waitForTimeout(800);
      const s = await A.pg.evaluate(() => window.__store);
      const ui = s.vrmLbcUi && s.vrmLbcUi.reprise;
      const vus = await A.pg.evaluate(() => window.__envois.filter((m) => m.action === 'lbcRetraitVu'));
      dit(A.ecrits.length === 1 && /\/manual\/unpause\/ads/.test(A.ecrits[0].u) && !!ui && ui.etapes.length === 3 && ui.etapes[0].portee === 'ligne' && ui.etapes[1].sig.mot === 'Réactiver' && ui.etapes[2].sig.mot === 'Remettre en ligne', 'P1 — SA réactivation à la main : apprise (la rangée, « Réactiver », « Remettre en ligne »)', JSON.stringify({ e: A.ecrits, ui }));
      dit(!!(s.vrmLbcUi && s.vrmLbcUi.pause && s.vrmLbcUi.pause.etapes[1].sig.mot === 'Désactiver'), 'P1 — la pause apprise avant n’est pas remplacée', JSON.stringify(s.vrmLbcUi && s.vrmLbcUi.pause));
      dit(vus.length === 0, 'P1 — une réactivation n’est jamais notée comme un retrait (pause) chez le fond', JSON.stringify(vus));
      await A.fin(); }
    // ── P2 : l'ordre « reprise » pour la 41e (50 au même titre) ──
    { const A = await ouvrir(nav, ANNONCES);
      const r = await A.ordre({ quoi: 'reprise', id: IDS[40], compte: MOI });
      dit(!!r && r.confirme === true && A.ecrits.length === 1 && /\/manual\/unpause\/ads/.test(A.ecrits[0].u) && JSON.stringify(corpsIds(A.ecrits[0])) === JSON.stringify([IDS[40]]), 'P2 — 50 annonces au MÊME titre : la réactivation part pour la 41e seulement, « fait » sur la preuve', JSON.stringify({ r, e: A.ecrits.map((e) => [e.u, e.corps]) }));
      await shot(A.pg, '390-mes-annonces-apres-reactivation');
      await A.fin(); }
    // ── P3 : la page est sur un AUTRE compte ⇒ rien ──
    { const A = await ouvrir(nav, ANNONCES, { moi: AUTRE });
      const r = await A.ordre({ quoi: 'reprise', id: IDS[41], compte: MOI });
      dit(r && r.erreur === 'autre-compte' && A.ecrits.length === 0 && (await A.faux()) === 0, 'P3 — la page est sur un AUTRE compte : aucune réactivation, aucun clic', JSON.stringify(r));
      await A.fin(); }

    // ── Captures à 1512 px (après 390) ──
    if (SHOTS) {
      const A = await ouvrir(nav, ANNONCES, { vue: { width: 1512, height: 900 } });
      await A.ordre({ quoi: 'pause', id: IDS[20], compte: MOI });
      await shot(A.pg, '1512-mes-annonces-apres-pause');
      await A.fin();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé : ' + (e && e.stack || e)); }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} banc lbc-interface : ${okN} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
