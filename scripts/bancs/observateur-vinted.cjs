#!/usr/bin/env node
// Banc de l'extension SÉPARÉE « VRM Observateur » (outils/observateur-vinted/).
// Charge la vraie extension dans Chromium, sert une FAUSSE page vinted.fr (routes interceptées : rien ne sort),
// joue des requêtes et des gestes depuis la page, et vérifie :
//  · interrupteur éteint ⇒ rien noté ;
//  · requêtes notées par le fond (webRequest), par la page (monde MAIN : réponses comprises) et par le débogueur ;
//  · masquages (csrf_token=abc ⇒ [masqué], e-mail, mot de passe, cookie jamais gardé) ;
//  · la page reçoit sa réponse intacte et le serveur le corps envoyé intact (rien bloqué ni modifié) ;
//  · gestes isTrusted vrai / faux séparés, écritures « sans geste humain » repérées ;
//  · élément injecté par une extension (id lu), extensions installées, onglets, compte ;
//  · regroupement par action sans double compte, exports JSON / CSV / HTML, plafond, détachement du débogueur ;
//  · règles statiques : aucune permission en trop, aucun « blocking », aucune requête sortante.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const RACINE = path.resolve(__dirname, '..', '..');
const EXT = path.join(RACINE, 'outils', 'observateur-vinted');
let pw;
for (const c of [path.join(RACINE, 'node_modules', 'playwright'), 'playwright', path.join(RACINE, '..', 'cancale-v67', 'node_modules', 'playwright')]) { try { pw = require(c); break; } catch (_) {} }
if (!pw) { console.error('playwright introuvable'); process.exit(2); }
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

let ok = 0; let ko = 0;
const verifier = (cond, quoi, info) => { if (cond) { ok++; console.log('  ✓ ' + quoi); } else { ko++; console.log('  ✗ ' + quoi + (info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } };
// Le dépôt est en « type: module » : regles.js (script classique de l'extension) se charge dans une vm.
const regles = () => { const vm = require('vm'); const bac = { TextDecoder, URL, console }; bac.self = bac; vm.runInNewContext(fs.readFileSync(path.join(EXT, 'regles.js'), 'utf8'), bac); return bac.VRMObs; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Règles statiques ──────────────────────────────────────────────────────
function statique() {
  console.log('Règles statiques');
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  verifier(JSON.stringify(man.permissions.slice().sort()) === JSON.stringify(['debugger', 'management', 'storage', 'unlimitedStorage', 'webRequest']), 'permissions exactes (webRequest, storage, unlimitedStorage, management, debugger)', man.permissions);
  verifier(!/webRequestBlocking|declarativeNetRequest|cookies|scripting|"tabs"/.test(JSON.stringify(man)), 'ni blocage, ni cookies, ni scripting, ni tabs');
  verifier(JSON.stringify(man.host_permissions) === JSON.stringify(['https://*.vinted.fr/*', 'https://*.vinted.com/*']), 'hôtes : vinted.fr et vinted.com seulement');
  verifier(/connect-src 'none'/.test(man.content_security_policy.extension_pages), 'pages de l\'extension : connect-src \'none\' (aucune requête possible)');
  const mainCs = man.content_scripts.find((c) => c.world === 'MAIN');
  verifier(mainCs && mainCs.run_at === 'document_start' && mainCs.js[0] === 'capteur-page.js', 'capteur du monde MAIN à document_start');
  const fond = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8').replace(/\/\/.*$/gm, '');
  verifier(!/['"]blocking['"]|extraHeaders|requestHeaders/.test(fond), 'webRequest sans « blocking », sans extraHeaders, sans en-têtes de requête');
  verifier(!/Fetch\.|setRequestInterception|continueRequest|fulfillRequest|setExtraHTTPHeaders|setCookie|Runtime\.evaluate|Page\.navigate|Input\./.test(fond), 'débogueur : aucune commande qui modifie, injecte ou pilote');
  verifier(!/request\.headers|\.headers\b/.test(fond.replace(/responseHeaders/g, '')), 'débogueur : en-têtes jamais recopiés');
  for (const f of ['background.js', 'page.js', 'popup.js', 'relais.js', 'regles.js', 'idb.js']) {
    const s = fs.readFileSync(path.join(EXT, f), 'utf8').replace(/\/\/.*$/gm, '');
    verifier(!/\bfetch\s*\(|new XMLHttpRequest|new WebSocket|sendBeacon\(|new EventSource|importScripts\(['"]https?:/.test(s), f + ' : aucune requête sortante');
  }
  const cp = fs.readFileSync(path.join(EXT, 'capteur-page.js'), 'utf8');
  verifier((cp.match(/fOrig\.apply\(this, arguments\)/g) || []).length === 1 && !/[^.\w]fetch\(/.test(cp.replace(/\/\/.*$/gm, '').replace(/function fetch\(/g, '')), 'capteur MAIN : fetch appelé une seule fois, pour la page, avec ses arguments');
  const R = regles();
  const reCp = /const CLE_SECRETE = (\/.*\/i);/.exec(cp)[1];
  verifier(reCp === String(R.CLE_SECRETE), 'capteur MAIN et règles : la MÊME liste de clés masquées', [reCp, String(R.CLE_SECRETE)]);
  verifier(R.masquerUrl('https://www.vinted.fr/api/v2/x?csrf_token=abc&page=2').recherche === 'csrf_token=[masqué]&page=2', 'csrf_token=abc ⇒ [masqué], page=2 gardé');
  verifier(!/secret1|a@b\.fr/.test(R.masquerTexte('{"user":{"email":"a@b.fr","password":"secret1","login":"moi"}}')) && /moi/.test(R.masquerTexte('{"user":{"email":"a@b.fr","password":"secret1","login":"moi"}}')), 'e-mail et mot de passe masqués, pseudo gardé');
  verifier(R.reconnaitre({ src: 'reseau', methode: 'POST', chemin: '/api/v2/conversations/1/replies' }).id === 'message', 'POST replies ⇒ message');
  verifier(R.reconnaitre({ src: 'geste', geste: 'clic', isTrusted: false }).id === 'geste_clic_auto', 'clic isTrusted faux ⇒ geste simulé');
}

// ── 2. Le navigateur ─────────────────────────────────────────────────────────
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Faux Vinted</title></head><body>
<h1>Faux Vinted</h1>
<button id="masquer" data-testid="item-hide">Masquer l'annonce</button>
<button id="robot" data-testid="robot-btn">Bouton du robot</button>
<textarea name="message" id="msg"></textarea>
<input type="password" name="password" id="mdp">
<input name="search_text" id="rech">
<script>
  window.__resultats = {};
  document.getElementById('masquer').addEventListener('click', async () => {
    const r = await fetch('/api/v2/items/5/is_hidden', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': 'JETONCSRFSECRET' }, body: JSON.stringify({ is_hidden: true }) });
    window.__resultats.masquer = await r.text();
  });
</script>
</body></html>`;

async function lancer() {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-banc-'));
  const ctx = await pw.chromium.launchPersistentContext(dossier, {
    executablePath: CHROMIUM, headless: true, acceptDownloads: true,
    // Rien ne sort : ce que les routes ne servent pas (favicon, services de Chrome) va vers un mandataire mort.
    proxy: { server: 'http://127.0.0.1:9' },
    args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-first-run', '--disable-background-networking', '--disable-component-update'],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  return { ctx, sw, id, dossier };
}

const recus = [];   // ce que le « serveur » a reçu
async function router(ctx) {
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*vinted\.(fr|com)\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    recus.push({ methode: req.method(), chemin: u.pathname, recherche: u.search, corps: req.postData() });
    const json = (status, o, extra) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'set-cookie': 'sid=COOKIESECRET; Path=/' }, extra || {}), body: JSON.stringify(o) });
    if (u.pathname === '/' || u.pathname.startsWith('/member') || u.pathname.startsWith('/items/new')) return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'set-cookie': '_vinted_fr_session=COOKIESECRET; Path=/' }, body: HTML });
    if (u.pathname === '/api/v2/users/current') return json(200, { user: { id: 42, login: 'pseudo_test', email: 'julien@exemple.fr', phone_number: '0600000000' } });
    if (/\/replies$/.test(u.pathname)) return json(200, { reply: { id: 777, body: 'reçu' }, session_id: 'SESSIONSECRETE', code: 0 });
    if (u.pathname === '/api/v2/offers') return json(200, { offer: { id: 9, price: '10.0' } });
    if (/favourite/.test(u.pathname)) return json(429, { code: 106, message: 'Too many requests' });
    if (/is_hidden/.test(u.pathname)) return json(200, { ok: true, item: { id: 5, is_hidden: true } });
    if (/\/lecture/.test(u.pathname)) return json(200, { n: Number(u.searchParams.get('n')) });
    return json(200, { ok: true });
  });
}

async function lireTout(pageExt) { return pageExt.evaluate(async () => { await chrome.runtime.sendMessage({ quoi: 'vider' }); return window.VRMBase.tout(); }); }
async function reglage(pageExt, o) { await pageExt.evaluate((x) => chrome.storage.local.set(x), o); await attendre(250); }

async function scenario() {
  const { ctx, sw, id, dossier } = await lancer();
  console.log('Extension chargée : ' + id);
  await router(ctx);
  const pageExt = await ctx.newPage();
  await pageExt.goto('chrome-extension://' + id + '/page.html');

  try {
    // ── Éteint par défaut : rien noté ──
    console.log('Interrupteur éteint');
    const v0 = await ctx.newPage();
    await v0.goto('https://www.vinted.fr/');
    await v0.evaluate(() => fetch('/api/v2/conversations/1/replies', { method: 'POST', body: '{"reply":{"body":"x"}}' }).then((r) => r.text()));
    await v0.click('#robot');
    await attendre(1200);
    let tout = await lireTout(pageExt);
    verifier(tout.length === 0, 'éteint par défaut : 0 événement', tout.length);
    await v0.close();

    // ── Allumé ──
    console.log('Interrupteur allumé');
    await reglage(pageExt, { obs_on: true });
    const v = await ctx.newPage();
    await v.goto('https://www.vinted.fr/member/42');
    await attendre(400);
    const res = await v.evaluate(async () => {
      const out = {};
      out.compte = await (await fetch('/api/v2/users/current')).text();
      // un message envoyé PAR UN PROGRAMME (sans clic) avec un jeton dans l'URL et dans le corps
      const corps = JSON.stringify({ reply: { body: 'Bonjour, toujours dispo ?', csrf_token: 'CORPSCSRF' } });
      const r = await fetch('/api/v2/conversations/123/replies?csrf_token=abc&page=1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: corps });
      out.reply = await r.text(); out.replyStatut = r.status;
      // une offre en XHR
      out.offre = await new Promise((ok) => { const x = new XMLHttpRequest(); x.open('POST', '/api/v2/offers'); x.setRequestHeader('content-type', 'application/json'); x.onload = () => ok(x.responseText); x.send(JSON.stringify({ price: '10', transaction_id: 5 })); });
      // un 429
      const f = await fetch('/api/v2/items/9/favourite', { method: 'POST' }); out.fav = f.status;
      // clic simulé par un programme
      document.getElementById('robot').click();
      document.getElementById('robot').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // navigation sans rechargement
      history.pushState({}, '', '/member/42/items?token=NAVSECRET&order=new');
      // un élément injecté « par une extension »
      const ifr = document.createElement('iframe'); ifr.src = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/panneau.html'; document.body.appendChild(ifr);
      const hote = document.createElement('outil-panneau'); hote.attachShadow({ mode: 'closed' }); document.documentElement.appendChild(hote);
      navigator.sendBeacon('/api/v2/events', JSON.stringify({ ev: 'vu', anon_id: 'ANONSECRET' }));
      out.fetchNom = window.fetch.name; out.fetchLongueur = window.fetch.length;
      out.wsInstance = typeof WebSocket === 'function' && WebSocket.OPEN === 1;
      return out;
    });
    verifier(res.reply === JSON.stringify({ reply: { id: 777, body: 'reçu' }, session_id: 'SESSIONSECRETE', code: 0 }) && res.replyStatut === 200, 'la page reçoit sa réponse INTACTE (session_id compris)', res.reply);
    verifier(res.offre === JSON.stringify({ offer: { id: 9, price: '10.0' } }), 'XHR : réponse intacte pour la page');
    verifier(res.fav === 429, 'le 429 arrive tel quel à la page');
    verifier(res.fetchNom === 'fetch' && res.fetchLongueur === 0 + (res.fetchLongueur) && res.wsInstance, 'fetch garde son nom, WebSocket ses constantes');
    const recuReply = recus.find((x) => /replies$/.test(x.chemin) && x.recherche.includes('csrf_token=abc'));
    verifier(recuReply && recuReply.corps === JSON.stringify({ reply: { body: 'Bonjour, toujours dispo ?', csrf_token: 'CORPSCSRF' } }), 'le serveur reçoit le corps et l\'URL INTACTS (rien modifié)', recuReply);
    const recuMasquer0 = recus.filter((x) => /is_hidden/.test(x.chemin)).length;

    // gestes humains (Playwright = vrais événements de souris et de clavier)
    await v.click('#masquer');
    await v.fill('#msg', '');
    await v.type('#msg', 'Salut, je baisse à 40 €');
    await v.type('#mdp', 'motdepasse123');
    await v.type('#rech', 'nike');
    await v.click('h1');
    await attendre(1500);
    const resMasquer = await v.evaluate(() => window.__resultats.masquer);
    verifier(resMasquer === JSON.stringify({ ok: true, item: { id: 5, is_hidden: true } }) && recus.filter((x) => /is_hidden/.test(x.chemin)).length === recuMasquer0 + 1, 'clic humain : la requête part une fois, réponse intacte');

    // onglet ouvert puis fermé
    const v2 = await ctx.newPage();
    await v2.goto('https://www.vinted.fr/items/new');
    await attendre(500);
    await v2.close();
    await attendre(1200);

    tout = await lireTout(pageExt);
    const texte = JSON.stringify(tout);
    console.log('  (' + tout.length + ' événements bruts)');
    const R = regles();
    const fus = R.attribuer(R.fusionner(tout));

    console.log('Réseau et masquages');
    const replyFond = tout.find((e) => e.src === 'reseau' && /replies$/.test(e.chemin));
    verifier(replyFond && replyFond.recherche === 'csrf_token=[masqué]&page=1', 'fond : csrf_token=abc ⇒ [masqué]', replyFond && replyFond.recherche);
    verifier(replyFond && replyFond.corps && /\[masqué\]/.test(replyFond.corps.texte) && /toujours dispo/.test(replyFond.corps.texte), 'fond : corps gardé, csrf du corps masqué', replyFond && replyFond.corps);
    verifier(replyFond && replyFond.statut === 200 && typeof replyFond.duree === 'number' && replyFond.initiator === 'https://www.vinted.fr' && replyFond.tabId > 0, 'fond : statut, durée, origine, onglet', replyFond);
    const replyPage = tout.find((e) => e.src === 'page' && e.api === 'fetch' && /replies$/.test(e.chemin));
    verifier(replyPage && replyPage.reponse && /"session_id":"\[masqué\]"/.test(replyPage.reponse.texte) && /777/.test(replyPage.reponse.texte), 'monde MAIN : réponse captée, session_id masqué', replyPage && replyPage.reponse);
    const offrePage = tout.find((e) => e.src === 'page' && e.api === 'xhr' && /offers$/.test(e.chemin));
    verifier(offrePage && /"price":"10.0"/.test(offrePage.reponse.texte), 'monde MAIN : réponse XHR captée');
    for (const s of ['abc&', 'CORPSCSRF', 'SESSIONSECRETE', 'COOKIESECRET', 'JETONCSRFSECRET', 'julien@exemple.fr', '0600000000', 'motdepasse123', 'NAVSECRET', 'ANONSECRET']) verifier(!texte.includes(s), 'jamais gardé : ' + s);
    verifier(!/"cookie"|"authorization"|"x-csrf-token"/i.test(texte), 'aucun en-tête Cookie / Authorization / X-CSRF gardé');

    console.log('Gestes, page, contexte');
    const auto = tout.filter((e) => e.src === 'geste' && e.geste === 'clic' && e.isTrusted === false);
    verifier(auto.length >= 2 && auto.some((e) => e.cible && e.cible.testid === 'robot-btn' && /robot/.test(e.cible.texte)), 'clic simulé (isTrusted faux) repéré avec sa cible', auto.length);
    const humain = tout.find((e) => e.src === 'geste' && e.geste === 'clic' && e.isTrusted === true && e.cible && e.cible.testid === 'item-hide');
    verifier(!!humain, 'clic humain (isTrusted vrai) repéré');
    const sMsg = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'message');
    verifier(sMsg && sMsg.valeur === 'Salut, je baisse à 40 €' && sMsg.isTrusted === true, 'zone de message : texte gardé', sMsg);
    const sMdp = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'password');
    verifier(sMdp && sMdp.valeur === undefined && sMdp.longueur === 13, 'mot de passe : longueur seulement', sMdp);
    const sRech = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'search_text');
    verifier(sRech && sRech.valeur === undefined && sRech.longueur === 4, 'champ ordinaire : longueur seulement');
    verifier(tout.some((e) => e.src === 'nav' && e.detail === 'pushState' && e.recherche === 'token=[masqué]&order=new'), 'navigation pushState notée, jeton masqué');
    verifier(tout.some((e) => e.src === 'dom' && e.extId === 'abcdefghijklmnopabcdefghijklmnop'), 'iframe chrome-extension:// : id de l\'extension lu');
    verifier(tout.some((e) => e.src === 'dom' && /shadow root closed/.test(e.detail || '')) && tout.some((e) => e.src === 'dom' && /outil-panneau/.test(e.detail || '')), 'shadow root fermé et élément personnalisé à la racine repérés');
    const liste = tout.find((e) => e.src === 'extensions_liste');
    verifier(liste && liste.liste.some((x) => x.id === id && x.permissions.includes('debugger')), 'extensions installées lues (permissions comprises)', liste && liste.liste);
    verifier(tout.some((e) => e.src === 'onglet' && /ouvert|devenu|chargée/.test(e.detail)) && tout.some((e) => e.src === 'onglet' && /fermé/.test(e.detail)), 'onglet Vinted ouvert puis fermé');
    const compte = tout.find((e) => e.src === 'compte');
    verifier(compte && compte.login === 'pseudo_test' && compte.userId === '42', 'compte vu dans la page : pseudo_test');
    verifier(tout.some((e) => e.src === 'page' && e.api === 'beacon' && /\[masqué\]/.test((e.corps || {}).texte || '')), 'sendBeacon noté, anon_id masqué');

    console.log('Regroupement');
    const res2 = R.resumer(fus);
    const n = (idA) => (res2.find((r) => r.id === idA) || { n: 0 });
    verifier(n('message').n === 1, 'message compté UNE fois (fond + page réunis)', n('message'));
    verifier(n('offre_faite').n === 1 && n('favori').s429 === 1 && n('masque').n === 1, 'offre faite 1, favori en 429, masqué 1', res2.map((r) => r.id + ':' + r.n));
    const msgF = fus.find((e) => e._action.id === 'message');
    const masqF = fus.find((e) => e._action.id === 'masque');
    verifier(msgF && msgF.apresGesteHumain === false && msgF.reponse && msgF.vuParPage, 'message sans geste humain, réponse réunie à la ligne du fond');
    verifier(masqF && masqF.apresGesteHumain === true, 'masquer après un clic humain');

    console.log('Page de lecture et exports');
    await pageExt.reload();
    await attendre(800);
    const vu = await pageExt.evaluate(() => ({
      message: !!document.querySelector('#resume tr[data-action="message"]'),
      auto: Number((document.querySelector('[data-cle="gestesAuto"]') || {}).dataset?.n || 0),
      sans: Number((document.querySelector('[data-cle="ecrituresSansGeste"]') || {}).dataset?.n || 0),
      refus: !document.getElementById('alertes-carte').hidden && !!document.querySelector('#alertes tr[data-statut="429"]'),
      ext: !!document.querySelector('#outil-ext tr[data-ext="abcdefghijklmnopabcdefghijklmnop"]'),
      chrono: document.querySelectorAll('#chrono tbody tr').length,
      netexport: document.getElementById('ouvrir-netexport').textContent,
    }));
    verifier(vu.message && vu.auto >= 2 && vu.sans >= 1 && vu.refus && vu.ext && vu.chrono > 5, 'page : par action, gestes simulés, sans geste, 429, extension vue, chronologie', vu);
    verifier(/net-export/.test(vu.netexport), 'bouton « Ouvrir chrome://net-export »');
    await pageExt.screenshot({ path: path.join(os.tmpdir(), 'observateur-page.png'), fullPage: true });
    for (const [bouton, ext, test] of [['#export-json', '.json', (t) => { const j = JSON.parse(t); return j.evenements.length > 10 && j.evenements.some((e) => e.action === 'Message envoyé'); }], ['#export-csv', '.csv', (t) => t.startsWith('﻿t_iso,') && /Message envoyé/.test(t) && /Clic simulé par un programme/.test(t)], ['#export-html', '.html', (t) => /Ce que l'outil a fait/.test(t) && !/<script/i.test(t)]]) {
      const [dl] = await Promise.all([pageExt.waitForEvent('download'), pageExt.click(bouton)]);
      const f = await dl.path();
      const t = fs.readFileSync(f, 'utf8');
      verifier(dl.suggestedFilename().endsWith(ext) && test(t) && !t.includes('SESSIONSECRETE') && !t.includes('COOKIESECRET'), 'export ' + ext + ' : fichier téléchargé, lisible, sans secret', dl.suggestedFilename());
    }

    console.log('Capture complète (débogueur)');
    await reglage(pageExt, { obs_complet: true });
    const v3 = await ctx.newPage();
    await v3.goto('https://www.vinted.fr/member/42');
    await attendre(1500);
    let dbg = await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'debogueur' }));
    const attache = Object.values(dbg.etat || {}).some((x) => x.ok);
    verifier(attache, 'débogueur attaché à l\'onglet Vinted', dbg);
    await v3.evaluate(async () => { await (await fetch('/api/v2/conversations/55/replies?csrf_token=abc', { method: 'POST', body: JSON.stringify({ reply: { body: 'via débogueur' } }) })).text(); });
    await attendre(1500);
    tout = await lireTout(pageExt);
    const cdp = tout.find((e) => e.src === 'cdp' && e.api === 'net' && /55\/replies$/.test(e.chemin));
    verifier(cdp && cdp.statut === 200 && cdp.reponse && /"session_id":"\[masqué\]"/.test(cdp.reponse.texte) && cdp.recherche === 'csrf_token=[masqué]' && /via débogueur/.test(cdp.corps.texte), 'débogueur : requête, corps et réponse captés, masqués', cdp);
    const fus2 = R.fusionner(tout);
    verifier(fus2.filter((e) => /55\/replies$/.test(e.chemin || '')).length === 1, 'débogueur + fond + page : une seule ligne');
    verifier(tout.some((e) => e.src === 'reseau' && /55\/replies$/.test(e.chemin)) && tout.some((e) => e.src === 'page' && /55\/replies$/.test(e.chemin)), 'pendant le débogueur, le fond et la page notent toujours', tout.filter((e) => /55\/replies$/.test(e.chemin || '')).map((e) => e.src));
    verifier(!JSON.stringify(tout).includes('SESSIONSECRETE') && !JSON.stringify(tout).includes('COOKIESECRET'), 'débogueur : aucun secret gardé');
    await reglage(pageExt, { obs_complet: false });
    await attendre(1000);
    const cibles = await sw.evaluate(() => new Promise((ok) => chrome.debugger.getTargets((l) => ok(l.filter((t) => t.attached && t.tabId != null && /vinted/.test(t.url)).length))));
    tout = await lireTout(pageExt);
    verifier(tout.some((e) => e.src === 'debogueur' && /détachée/.test(e.detail)), 'détachement noté');
    dbg = await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'debogueur' }));
    verifier(Object.keys(dbg.etat || {}).length === 0, 'détachement propre : plus aucun onglet suivi', { dbg, cibles });
    await v3.close();

    console.log('Plafond');
    await reglage(pageExt, { obs_plafond: 60 });
    await v.evaluate(async () => { for (let i = 0; i < 90; i++) await (await fetch('/api/v2/lecture?n=' + i)).text(); });
    await attendre(1500);
    tout = await lireTout(pageExt);
    verifier(tout.length <= 60 && tout.length >= 40, 'plafond 60 tenu', tout.length);
    const ns = tout.filter((e) => e.src === 'reseau' && e.chemin === '/api/v2/lecture').map((e) => Number(/n=(\d+)/.exec(e.recherche)[1]));
    verifier(ns.includes(89) && !ns.includes(0), 'les plus anciens sortent, les plus récents restent', { ns: ns.slice(0, 5), srcs: tout.map((e) => e.src + ':' + (e.chemin || e.detail)).slice(0, 12) });

    console.log('Éteint de nouveau');
    await reglage(pageExt, { obs_on: false });
    const avant = (await lireTout(pageExt)).length;
    await v.evaluate(async () => { await fetch('/api/v2/conversations/1/replies', { method: 'POST', body: '{}' }); document.getElementById('robot').click(); });
    await attendre(1200);
    const apres = (await lireTout(pageExt));
    verifier(apres.length === avant + 0 || apres.slice(avant).every((e) => e.src === 'debut'), 'éteint : plus rien noté', apres.slice(avant));

    console.log('Tout effacer');
    pageExt.once('dialog', (d) => d.accept());
    await pageExt.click('#effacer');
    await attendre(600);
    verifier((await lireTout(pageExt)).length === 0, 'tout effacé');
  } finally {
    await ctx.close();
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}

(async () => {
  statique();
  try { await scenario(); } catch (e) { ko++; console.log('  ✗ le scénario a planté : ' + (e && e.stack || e)); }
  console.log('\n' + ok + ' vert(s), ' + ko + ' rouge(s)');
  process.exit(ko ? 1 : 0);
})();
