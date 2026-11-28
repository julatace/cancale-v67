#!/usr/bin/env node
// Banc de l'extension SÉPARÉE « VRM Observateur Vestiaire » (outils/observateur-vestiaire/).
// Charge la vraie extension dans Chromium (contexte persistant, --load-extension), sert une FAUSSE
// fr.vestiairecollective.com, une fausse apiv2.vestiairecollective.com et une fausse messagerie Stream
// (chat.stream-io-api.com, REST + WebSocket) — tout est intercepté par le banc, rien ne sort —, joue des
// requêtes fetch / XHR / WebSocket inventées, des clics humains et simulés, une « autre extension », et vérifie :
//  · éteint ⇒ rien ; allumé ⇒ requêtes (méthode, URL, statut, durée, type, initiateur, onglet/cadre, NOMS des
//    en-têtes, corps envoyés et reçus), WebSocket, navigation SPA, gestes isTrusted, autre extension ;
//  · masquage : jetons, cookies, mots de passe, cartes, IBAN, e-mails, téléphones jamais gardés (base ET exports) ;
//  · export JSON (résumé lisible en tête : routes, likes, notifications, messages, offres, séquence d'un envoi) + CSV ;
//  · rien ne part vers un autre hôte (requêtes du navigateur relevées, espion local jamais joint, fond bloqué par la CSP) ;
//  · règles statiques : aucune permission en trop, aucun « blocking », les en-têtes par leur NOM seulement.
// Usage : node scripts/bancs/observateur-vestiaire.cjs   (MUTATION=1 : réaffaiblit le masquage, le banc doit rougir)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const RACINE = path.resolve(__dirname, '..', '..');
const EXT_SRC = path.join(RACINE, 'outils', 'observateur-vestiaire');
let pw;
for (const c of [path.join(RACINE, 'node_modules', 'playwright'), 'playwright', path.join(RACINE, '..', 'cancale-v67', 'node_modules', 'playwright')]) { try { pw = require(c); break; } catch (_) {} }
if (!pw) { console.error('playwright introuvable'); process.exit(2); }
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

let ok = 0; let ko = 0;
const verifier = (cond, quoi, info) => { if (cond) { ok++; console.log('  ✓ ' + quoi); } else { ko++; console.log('  ✗ ' + quoi + (info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// MUTATION=1 : une copie de l'extension dont le masquage est cassé (les clés sensibles ne sont plus reconnues,
// le texte libre n'est plus masqué). Le banc DOIT alors rougir — sinon il ne prouve rien.
function preparerExtension() {
  const mut = process.env.MUTATION;
  if (!mut) return EXT_SRC;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'obsvc-mut-'));
  for (const f of fs.readdirSync(EXT_SRC)) fs.copyFileSync(path.join(EXT_SRC, f), path.join(d, f));
  if (mut === 'liste') {
    // MUTATION=liste : la liste noire de l'exploration retirée (plus aucun libellé interdit).
    const p = path.join(d, 'regles.js');
    const s = fs.readFileSync(p, 'utf8');
    const s2 = s.replace(/const CLIC_INTERDIT = \/.*\/;/, 'const CLIC_INTERDIT = /(?!)/;');
    if (s2 === s) throw new Error('mutation « liste » non posée');
    fs.writeFileSync(p, s2);
    console.log('MUTATION : liste noire de l\'exploration retirée dans ' + d);
    return d;
  }
  // MUTATION=1 (ou « masquage ») : les clés sensibles ne sont plus reconnues, le texte libre n'est plus masqué.
  for (const f of ['regles.js', 'capteur-page.js']) {
    const p = path.join(d, f);
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/const CLE_SECRETE = \/.*\/i;/, 'const CLE_SECRETE = /^jamais$/i;').replace('function masquerLibre(t) {', 'function masquerLibre(t) { return String(t);');
    fs.writeFileSync(p, s);
  }
  console.log('MUTATION : masquage réaffaibli dans ' + d);
  return d;
}
const EXT = preparerExtension();
const regles = () => { const vm = require('vm'); const bac = { TextDecoder, URL, console, encodeURIComponent, decodeURIComponent }; bac.self = bac; vm.runInNewContext(fs.readFileSync(path.join(EXT, 'regles.js'), 'utf8'), bac); return bac.VRMObs; };

// Les secrets inventés : aucun ne doit survivre, nulle part.
const SECRETS = ['JETONAUTHSECRET', 'JETONCSRFSECRET', 'COOKIESECRET', 'CLESTREAMSECRETE', 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiMTIzNDU2In0.SIGNATURESTREAM', 'julien@exemple.fr', 'marie@exemple.fr', '0600000000', '06 12 34 56 78', 'motdepasse123', '4111111111111111', '4111 1111 1111 1111', 'FR7630006000011234567890189', 'NAVSECRET', 'CORPSCSRF'];

// ── 1. Règles statiques ──────────────────────────────────────────────────────
function statique() {
  console.log('Règles statiques');
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  verifier(man.name === 'VRM Observateur Vestiaire' && man.manifest_version === 3, 'nom et MV3');
  verifier(JSON.stringify(man.permissions.slice().sort()) === JSON.stringify(['debugger', 'management', 'storage', 'unlimitedStorage', 'webRequest']), 'permissions exactes', man.permissions);
  verifier(!/webRequestBlocking|declarativeNetRequest|"cookies"|"scripting"|"tabs"|<all_urls>/.test(JSON.stringify(man)), 'ni blocage, ni cookies, ni scripting, ni tabs, ni <all_urls>');
  const hotesOk = man.host_permissions.every((h) => /^(https|wss):\/\/\*\.(vestiairecollective\.com|stream-io-api\.com|stream-chat\.com|getstream\.io)\/\*$/.test(h));
  verifier(hotesOk && man.host_permissions.includes('https://*.vestiairecollective.com/*') && man.host_permissions.includes('wss://*.stream-io-api.com/*'), 'hôtes : *.vestiairecollective.com + messagerie Stream (https et wss), rien d\'autre', man.host_permissions);
  verifier(/connect-src 'none'/.test(man.content_security_policy.extension_pages), 'pages et fond de l\'extension : connect-src \'none\'');
  const mainCs = man.content_scripts.find((c) => c.world === 'MAIN');
  verifier(mainCs && mainCs.run_at === 'document_start' && mainCs.all_frames && mainCs.js[0] === 'capteur-page.js' && mainCs.matches.join() === 'https://*.vestiairecollective.com/*', 'capteur du monde MAIN à document_start, toutes les frames, Vestiaire seulement');
  const fond = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8').replace(/\/\/.*$/gm, '');
  verifier(!/['"]blocking['"]|extraHeaders/.test(fond), 'webRequest sans « blocking » ni extraHeaders');
  const usages = fond.match(/[.\w]*requestHeaders[\]\w)]*/g) || [];
  verifier(usages.length > 0 && usages.every((u) => u === "requestHeaders'" || u === 'd.requestHeaders)' || u === 'requestHeaders') && /noms\(d\.requestHeaders\)/.test(fond), 'en-têtes de requête : passés à noms() seulement (jamais une valeur)', usages);
  verifier(!/h\.value/.test(fond.replace(/=== 'content-length'\) \{ const n = Number\(h\.value\)/, '').replace(/=== 'content-type'\) e\.mime = String\(h\.value/, '')), 'valeur d\'en-tête lue : content-length et content-type seulement');
  verifier(!/Fetch\.|setRequestInterception|continueRequest|fulfillRequest|setExtraHTTPHeaders|setCookie|Runtime\.evaluate|Page\.navigate|Input\./.test(fond), 'débogueur : aucune commande qui modifie, injecte ou pilote');
  verifier(!/headers\[|headers\)\.map\(\(\[|Object\.(values|entries)\([^)]*headers/.test(fond), 'débogueur : en-têtes par leur nom (Object.keys), jamais leurs valeurs');
  for (const f of ['background.js', 'page.js', 'popup.js', 'relais.js', 'regles.js', 'idb.js']) {
    const s = fs.readFileSync(path.join(EXT, f), 'utf8').replace(/\/\/.*$/gm, '');
    verifier(!/\bfetch\s*\(|new XMLHttpRequest|new WebSocket|sendBeacon\(|new EventSource|importScripts\(['"]https?:/.test(s), f + ' : aucune requête sortante');
  }
  const cp = fs.readFileSync(path.join(EXT, 'capteur-page.js'), 'utf8');
  verifier((cp.match(/fOrig\.apply\(this, arguments\)/g) || []).length === 1, 'capteur MAIN : fetch d\'origine appelé une seule fois, avec les arguments de la page');
  const bloc = (s) => { const a = s.indexOf('// <masquage>'); const b = s.indexOf('// </masquage>'); return a < 0 || b < 0 ? null : s.slice(a, b); };
  const rg = fs.readFileSync(path.join(EXT, 'regles.js'), 'utf8');
  verifier(bloc(rg) && bloc(rg) === bloc(cp), 'capteur MAIN et règles : le MÊME bloc de masquage, octet pour octet');
  const R = regles();
  verifier(R.masquerUrl('https://apiv2.vestiairecollective.com/x?csrf_token=abc&page=2').recherche === 'csrf_token=[masqué]&page=2', 'csrf_token=abc ⇒ [masqué], page=2 gardé');
  const t = R.masquerTexte('{"user":{"email":"a@b.fr","password":"secret1","login":"moi","bio":"appelle 06 12 34 56 78, carte 4111 1111 1111 1111, FR7630006000011234567890189","ts":1700000000000,"id":"4970101234567890"}}');
  verifier(!/secret1|a@b\.fr|06 12|4111|FR76/.test(t) && /moi/.test(t) && /1700000000000/.test(t) && /4970101234567890/.test(t), 'e-mail, mot de passe, téléphone, carte, IBAN masqués ; pseudo, horodatage et identifiant (non-Luhn) gardés', t);
  const ws = R.masquerUrl('wss://chat.stream-io-api.com/connect?json=' + encodeURIComponent('{"user_id":"123","user_details":{"email":"x@y.fr"}}') + '&api_key=abc123&authorization=eyJa.eyJb.c');
  verifier(!/x%40y|abc123|eyJa/.test(ws.recherche) && /user_id/.test(decodeURIComponent(ws.recherche)), 'URL de connexion Stream : JSON de la requête masqué dedans, api_key et authorization masqués', ws.recherche);
  verifier(R.reconnaitre({ src: 'reseau', methode: 'POST', hote: 'chat.stream-io-api.com', chemin: '/channels/chat_channel/987654-111222333/message' }).id === 'message', 'Stream POST …/message ⇒ message envoyé');
  verifier(R.reconnaitre({ src: 'reseau', methode: 'POST', chemin: '/negotiations' }).id === 'offre_faite' && R.reconnaitre({ src: 'reseau', methode: 'POST', chemin: '/products/12/like' }).id === 'aime', 'POST negotiations ⇒ offre ; POST like ⇒ j\'aime');
  verifier(R.normChemin('/channels/chat_channel/987654-111222333/message') === '/channels/chat_channel/{n}-{n}/message' && R.normChemin('/products/111222333/likes') === '/products/{n}/likes', 'routes sans identifiants');
  verifier(R.reconnaitre({ src: 'geste', geste: 'clic', isTrusted: false }).id === 'geste_clic_auto', 'clic isTrusted faux ⇒ geste simulé');
  verifier(/const EXPL_DEFAUT = \{ min: 3000, max: 9000, maxPages: 200, profMax: 3,/.test(fond), 'exploration : 3 à 9 s entre deux pages, 200 pages, profondeur 3 par défaut');
  verifier(['Envoyer', 'J\'aime', 'Acheter', 'Payer', 'Faire une offre', 'Accepter', 'Refuser', 'Ne plus aimer', 'Suivre', 'Supprimer', 'Modifier', 'Enregistrer', 'Signaler', 'Se déconnecter', 'Publier'].every((t) => !R.clicPermis({ texte: t }).ok)
    && ['Voir plus', 'Description', 'Messages', 'Offres reçues', 'Mes commandes', 'Voir qui a aimé (3)'].every((t) => R.clicPermis({ texte: t }).ok)
    && !R.clicPermis({ texte: '12', testid: 'like-button' }).ok, 'liste noire : ce qui écrit refusé, ce qui ouvre permis');
  verifier(!R.lienPermis('/logout', 'https://fr.vestiairecollective.com/', '').ok && !R.lienPermis('/checkout/1', 'https://fr.vestiairecollective.com/', '').ok && !R.lienPermis('https://exemple.org/', 'https://fr.vestiairecollective.com/', '').ok && R.lienPermis('/chat/1-2', 'https://fr.vestiairecollective.com/', '').compte, 'liens : déconnexion, panier, autre site refusés ; messagerie suivie');
}

// ── 2. Le navigateur ─────────────────────────────────────────────────────────
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiMTIzNDU2In0.SIGNATURESTREAM';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Faux Vestiaire</title></head><body>
<h1>Faux Vestiaire Collective</h1>
<button id="envoyer" data-testid="chat-send-button">Envoyer</button>
<button id="offre" data-testid="make-offer">Faire une offre</button>
<button id="robot" data-testid="robot-btn">Bouton du robot</button>
<textarea name="message" id="msg"></textarea>
<input type="password" name="password" id="mdp">
<input name="cardNumber" id="carte">
<script>
  window.__r = {};
  const API = 'https://apiv2.vestiairecollective.com';
  const STREAM = 'https://chat.stream-io-api.com';
  document.getElementById('envoyer').addEventListener('click', async () => {
    const r = await fetch(STREAM + '/channels/chat_channel/987654-111222333/message?api_key=CLESTREAMSECRETE&user_id=123456', { method: 'POST', headers: { 'content-type': 'application/json', authorization: '${JWT}', 'stream-auth-type': 'jwt', 'x-stream-client': 'stream-chat-js' }, body: JSON.stringify({ message: { id: 'a1b2', text: document.getElementById('msg').value } }) });
    window.__r.envoi = await r.text();
    if (window.__ws) window.__ws.send(JSON.stringify({ type: 'typing.stop', cid: 'chat_channel:987654-111222333' }));
  });
  document.getElementById('offre').addEventListener('click', () => {
    const x = new XMLHttpRequest(); x.open('POST', API + '/negotiations'); x.withCredentials = true;
    x.setRequestHeader('content-type', 'application/json'); x.setRequestHeader('x-csrf-token', 'JETONCSRFSECRET');
    x.onload = () => { window.__r.offre = x.responseText; };
    x.send(JSON.stringify({ productId: '111222333', buyerId: '987654', price: { cents: 9000, currency: 'EUR' }, csrf_token: 'CORPSCSRF' }));
  });
</script>
</body></html>`;

const recus = [];   // ce que les faux serveurs ont reçu

// ── La fausse Vestiaire à explorer (plusieurs pages, chargement infini, boutons piégés) ──
const SITE = { mode: 'test', documents: [], pieges: [] };
const ENTETE = `<header style="height:60px">
<button id="menu" aria-haspopup="menu" aria-expanded="false">Mon compte</button>
<nav id="menu-liste" hidden>
  <a href="/members/profile-123456.shtml">Mon profil</a> <a href="/notifications/">Notifications</a> <a href="/chat/">Messagerie</a>
  <a href="/my-account/orders/">Mes commandes</a> <a href="/my-account/negotiations/">Mes offres</a> <a href="/my-account/favorites/">Mes favoris</a>
  <a href="/my-account/settings/">Réglages</a> <a href="/logout">Se déconnecter</a> <a href="/checkout/">Panier</a>
</nav>
<a href="/women/bags/">Sacs</a> <a href="https://exemple.org/">Ailleurs</a> <a href="https://faq.vestiairecollective.com/aide">Aide</a>
<button aria-haspopup="dialog" data-testid="sell-button">Vendre</button>
</header>`;
// Chaque piège écrit vers /piege/… : si l'exploration en touchait un, le faux serveur le verrait.
const SCRIPT = `<script>
  const API = 'https://apiv2.vestiairecollective.com';
  const piege = (n) => fetch(API + '/piege/' + n, { method: 'POST', credentials: 'include', body: '{}' });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'menu') { document.getElementById('menu-liste').hidden = false; b.setAttribute('aria-expanded', 'true'); }
    if (b.dataset.piege) piege(b.dataset.piege);
    if (b.dataset.get) fetch(API + b.dataset.get, { credentials: 'include' }).then((r) => r.text()).then((t) => { const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.textContent = t.slice(0, 80); if (b.dataset.lien) d.innerHTML += '<a href="' + b.dataset.lien + '">profil</a>'; document.body.appendChild(d); });
    if (b.getAttribute('role') === 'tab') { b.parentNode.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); }
  });
</script>`;
const PIEGE = (n, texte, attr) => `<button ${attr || 'aria-expanded="false"'} data-testid="${n}-button" data-piege="${n}">${texte}</button>`;
function pageSite(p) {
  const html = (corps, extra) => `<!doctype html><html><head><meta charset="utf-8"><title>Vestiaire ${p}</title></head><body>${ENTETE}<main>${corps}</main>${SCRIPT}${extra || ''}</body></html>`;
  const art = (id) => `<a class="article" href="/sac-article-${id}.shtml" style="display:block;height:420px">Article ${id}</a>`;
  if (p === '/') return html(`<h1>Accueil</h1><details><summary>À propos</summary><p>texte</p></details>
    <form method="post" action="/recherche"><input name="q"><button>Voir plus</button></form>`);
  if (p === '/members/profile-123456.shtml') return html(`<h1>Mon dressing</h1>${PIEGE('follow', 'Suivre')}<div id="liste">${[1, 2, 3].map((i) => art(111000000 + i)).join('')}</div><a href="/members/profile-987654.shtml">Marie</a>`,
    `<script>let page = 1, charge = false;
      addEventListener('scroll', async () => {
        if (charge || page >= 3 || innerHeight + scrollY < document.documentElement.scrollHeight - 100) return;
        charge = true; page++;
        const j = await (await fetch('https://apiv2.vestiairecollective.com/users/123456/products?page=' + page, { credentials: 'include' })).json();
        for (const x of j.data) document.getElementById('liste').insertAdjacentHTML('beforeend', '<a class="article" href="/sac-article-' + x.id + '.shtml" style="display:block;height:420px">Article ' + x.id + '</a>');
        charge = false;
      });</script>`);
  let m = /^\/sac-article-(\d+)\.shtml$/.exec(p);
  if (m && Number(m[1]) > 111000000 && Number(m[1]) <= 111000009) return html(`<h1>Article ${m[1]}</h1>
    ${PIEGE('like', 'J\'aime')} ${PIEGE('buy', 'Acheter', 'aria-haspopup="dialog"')} ${PIEGE('offer', 'Faire une offre', 'aria-haspopup="dialog"')} ${PIEGE('send', 'Envoyer')}
    <button aria-haspopup="dialog" data-testid="likers-open" data-get="/products/${m[1]}/likes" data-lien="/members/profile-987654.shtml">Voir qui a aimé (2)</button>
    <details><summary>Description</summary><p>Un sac.</p></details>
    <div role="tablist"><button role="tab" aria-selected="true">Détails</button><button role="tab" aria-selected="false" data-get="/products/${m[1]}/shipping">Livraison</button></div>`);
  if (p === '/notifications/') return html(`<h1>Notifications</h1><div role="tablist"><button role="tab" aria-selected="false" data-get="/notification-feed?category=messages">Messages</button><button role="tab" aria-selected="false" data-get="/notification-feed?category=updates">Activité</button></div>
    <button data-get="/notification-feed?page=2">Voir plus</button> ${PIEGE('lu', 'Tout marquer comme lu')}`);
  if (p === '/chat/') return html(`<h1>Messagerie</h1>${[1, 2, 3].map((i) => `<a href="/chat/987654-11100000${i}">Conversation ${i}</a>`).join(' ')}`,
    `<script>fetch('https://chat.stream-io-api.com/channels?api_key=CLESTREAMSECRETE', { method: 'POST', body: '{"filter_conditions":{}}' });</script>`);
  m = /^\/chat\/(987654-11100000\d)$/.exec(p);
  if (m) return html(`<h1>Conversation</h1><textarea name="message"></textarea>${PIEGE('message', 'Envoyer')}`,
    `<script>fetch('https://chat.stream-io-api.com/channels/chat_channel/${m[1]}/query?api_key=CLESTREAMSECRETE', { method: 'POST', body: '{"state":true}' });</script>`);
  if (p === '/my-account/orders/') return html(`<h1>Commandes</h1><a href="/my-account/orders/1">Commande 1</a>`);
  if (p === '/my-account/orders/1') return html(`<h1>Commande 1</h1><a href="/my-account/orders/1/detail">Détail</a>${PIEGE('annuler', 'Annuler la commande')}`);
  if (p === '/my-account/orders/1/detail') return html(`<h1>Détail</h1><a href="/my-account/orders/1/detail/plus">Plus loin</a>`);
  if (p === '/my-account/orders/1/detail/plus') return html('<h1>Trop profond</h1>');
  if (p === '/my-account/negotiations/') return html(`<h1>Offres</h1><div role="tablist"><button role="tab" aria-selected="false" data-get="/negotiations?role=seller">Offres reçues</button><button role="tab" aria-selected="false" data-get="/negotiations?role=buyer">Envoyées</button></div>
    ${PIEGE('accepter', 'Accepter', 'aria-haspopup="dialog"')} ${PIEGE('refuser', 'Refuser', 'aria-haspopup="dialog"')}`);
  if (p === '/my-account/favorites/') return html(`<h1>Favoris</h1>${PIEGE('retirer', 'Retirer des favoris')}`);
  if (p === '/my-account/settings/') return html(`<h1>Réglages</h1><details><summary>Préférences</summary><p>…</p></details>
    <form method="post" action="/my-account/settings/"><input name="pseudo"><button>Enregistrer</button></form>${PIEGE('logout', 'Se déconnecter')}`);
  if (p === '/women/bags/' || p === '/members/profile-987654.shtml') return html('<h1>Hors compte</h1>');
  return null;
}
const ATTENDUES = ['/', '/members/profile-123456.shtml', '/notifications/', '/chat/', '/chat/987654-111000001', '/chat/987654-111000002', '/chat/987654-111000003',
  '/my-account/orders/', '/my-account/orders/1', '/my-account/orders/1/detail', '/my-account/negotiations/', '/my-account/favorites/', '/my-account/settings/']
  .concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => '/sac-article-' + (111000000 + i) + '.shtml'));
const JAMAIS_VUES = ['/women/bags/', '/logout', '/checkout/', '/members/profile-987654.shtml', '/my-account/orders/1/detail/plus'];
const vus = [];     // toute requête vue par le navigateur
const CORS = (req) => ({ 'access-control-allow-origin': req.headers().origin || 'https://fr.vestiairecollective.com', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization,x-csrf-token,stream-auth-type,x-stream-client', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'x-request-id' });

async function router(ctx) {
  ctx.on('request', (r) => vus.push(r.url()));
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*vestiairecollective\.com\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    recus.push({ hote: u.host, methode: req.method(), chemin: u.pathname, recherche: u.search, corps: req.postData(), entetes: req.headers() });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS(req) });
    const json = (status, o) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'set-cookie': 'vc_session=COOKIESECRET; Path=/', 'x-request-id': 'r-1' }, CORS(req)), body: JSON.stringify(o) });
    if (u.host === 'fr.vestiairecollective.com' && SITE.mode !== 'test' && req.resourceType() === 'document') {
      SITE.documents.push(u.pathname);
      if (SITE.mode === 'captcha') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Un instant…</title><div class="cf-turnstile"></div><p>Vérifiez que vous êtes humain pour continuer.</p>' });
      if (SITE.mode === '429' && u.pathname === '/notifications/') return route.fulfill({ status: 429, contentType: 'text/html', body: '<!doctype html><p>Too many requests</p>' });
      const h = pageSite(u.pathname);
      if (!h) return route.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><title>404</title><p>Introuvable</p>' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: h });
    }
    if (u.host === 'fr.vestiairecollective.com' && req.method() !== 'GET') return json(200, { ok: true });
    if (u.host === 'fr.vestiairecollective.com') return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'set-cookie': 'vc_session=COOKIESECRET; Path=/' }, body: HTML });
    if (/^\/piege\//.test(u.pathname)) { SITE.pieges.push(req.method() + ' ' + u.pathname); return json(200, { ok: true }); }
    if (/\/users\/123456\/products/.test(u.pathname)) return json(200, { data: [1, 2, 3].map((i) => ({ id: 111000000 + (Number(u.searchParams.get('page')) - 1) * 3 + i })) });
    if (u.pathname === '/users/me') return json(200, { meta: {}, data: { id: '123456', firstName: 'Pseudotest', email: 'julien@exemple.fr', phone: '0600000000' } });
    if (/notification-feed-counter/.test(u.pathname)) return json(200, { data: { unseen: { messages: 2, notifications: 5 } } });
    if (/notification-feed/.test(u.pathname)) return json(200, { data: [{ id: 'n1', eventType: 'custom_community', textBody: 'Marie vient d\'aimer votre pièce, envoyez-lui un message !', date: '2026-11-27T10:00:00Z', productLink: { deeplink: 'vc://like_item/111222333', meta: { type: 'chat', data: { id: '987654-111222333' } } } }] });
    if (/\/products\/\d+\/likes/.test(u.pathname)) return json(200, { data: [{ id: 987654, firstName: 'Marie', email: 'marie@exemple.fr' }], meta: { total: 1 } });
    if (/\/chat\/user\/token/.test(u.pathname)) return json(200, { userToken: { token: JWT, provider: 'stream' } });
    if (/\/chat\/channel/.test(u.pathname)) return json(200, { data: { id: '987654-111222333', type: 'chat_channel', product: '111222333' } });
    if (/\/negotiations/.test(u.pathname)) return json(201, { data: { id: 'neg-1', status: 'pending', price: { cents: 9000 } } });
    if (/graphql/.test(u.pathname)) return json(200, { data: { likeProduct: { liked: true } } });
    if (/\/login/.test(u.pathname)) return json(200, { ok: true, accessToken: JWT });
    if (/\/payment/.test(u.pathname)) return json(200, { ok: true });
    if (/\/lecture/.test(u.pathname)) return json(200, { n: Number(u.searchParams.get('n')) });
    return json(200, { ok: true });
  });
  await ctx.route(/^https:\/\/chat\.stream-io-api\.com\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    recus.push({ hote: u.host, methode: req.method(), chemin: u.pathname, recherche: u.search, corps: req.postData(), entetes: req.headers() });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS(req) });
    const json = (o) => route.fulfill({ status: 201, contentType: 'application/json', headers: CORS(req), body: JSON.stringify(o) });
    if (/\/message$/.test(u.pathname)) return json({ message: { id: 'a1b2', text: JSON.parse(req.postData()).message.text, user: { id: '123456', name: 'Pseudotest' } }, duration: '4ms' });
    if (/\/query$/.test(u.pathname)) return json({ channel: { id: '987654-111222333', type: 'chat_channel' }, messages: [{ id: 'm0', text: 'Bonjour, il est encore dispo ? Écrivez-moi à marie@exemple.fr', user: { id: '987654', name: 'Marie' } }], read: [{ user: { id: '123456' }, unread_messages: 0 }] });
    return json({ channels: [] });
  });
  await ctx.routeWebSocket(/^wss:\/\/chat\.stream-io-api\.com\//, (ws) => {
    recus.push({ hote: 'chat.stream-io-api.com', methode: 'WS', chemin: new URL(ws.url()).pathname, recherche: new URL(ws.url()).search });
    ws.send(JSON.stringify({ type: 'health.check', connection_id: 'c-1', me: { id: '123456', name: 'Pseudotest', email: 'julien@exemple.fr' } }));
    ws.onMessage((m) => { recus.push({ hote: 'chat.stream-io-api.com', methode: 'WS-msg', corps: String(m) }); ws.send(JSON.stringify({ type: 'message.new', cid: 'chat_channel:987654-111222333', message: { text: 'Merci ! Mon numéro : 06 12 34 56 78', user: { id: '987654' } } })); });
  });
}

// Une « autre extension » de test : un script du monde MAIN et un script isolé qui appellent l'API de la page.
function autreExtension() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'obsvc-autre-'));
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Outil de test', version: '1.0', host_permissions: ['https://*.vestiairecollective.com/*'], content_scripts: [
    { matches: ['https://fr.vestiairecollective.com/*'], js: ['main.js'], world: 'MAIN', run_at: 'document_idle' },
    { matches: ['https://fr.vestiairecollective.com/*'], js: ['isole.js'], run_at: 'document_idle' }] }));
  fs.writeFileSync(path.join(d, 'main.js'), "setTimeout(function outilDeTest() { fetch('https://apiv2.vestiairecollective.com/products/555/likes?from=outil-main', { credentials: 'include' }); }, 300);");
  fs.writeFileSync(path.join(d, 'isole.js'), "setTimeout(() => { fetch('https://apiv2.vestiairecollective.com/products/556/likes?from=outil-isole', { credentials: 'include' }); }, 300);");
  return d;
}

async function lancer(autre) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'obsvc-banc-'));
  const ctx = await pw.chromium.launchPersistentContext(dossier, {
    executablePath: CHROMIUM, headless: true, acceptDownloads: true,
    // Rien ne sort : ce que les routes ne servent pas (services de Chrome…) va vers un mandataire mort.
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' },   // l'espion local reste joignable en direct
    args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-extensions-except=' + EXT + ',' + autre, '--load-extension=' + EXT + ',' + autre, '--no-first-run', '--disable-background-networking', '--disable-component-update'],
  });
  let sw = ctx.serviceWorkers().find((w) => /background\.js$/.test(w.url()));
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000, predicate: (w) => /background\.js$/.test(w.url()) });
  const id = sw.url().split('/')[2];
  return { ctx, sw, id, dossier };
}

async function lireTout(pageExt) { return pageExt.evaluate(async () => { await chrome.runtime.sendMessage({ quoi: 'vider' }); return window.VRMBase.tout(); }); }
async function reglage(pageExt, o) { await pageExt.evaluate((x) => chrome.storage.local.set(x), o); await attendre(300); }
const sansSecret = (texte) => SECRETS.filter((s) => texte.includes(s));

async function scenario() {
  // L'espion : un serveur local. Si l'extension envoyait quoi que ce soit, c'est lui qui le recevrait.
  let espion = 0; let sonde = 0;
  const srv = http.createServer((req, res) => { if (req.url === '/sonde') sonde++; else espion++; res.end('ok'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const PORT = srv.address().port;
  const autre = autreExtension();
  const { ctx, sw, id, dossier } = await lancer(autre);
  console.log('Extension chargée : ' + id);
  await router(ctx);
  const pageExt = await ctx.newPage();
  await pageExt.goto('chrome-extension://' + id + '/page.html');
  const idAutre = await pageExt.evaluate(async () => { const r = await chrome.runtime.sendMessage({ quoi: 'extensions' }); return (r.liste.find((x) => x.name === 'Outil de test') || {}).id; });

  try {
    console.log('Éteint par défaut');
    const v0 = await ctx.newPage();
    await v0.goto('https://fr.vestiairecollective.com/');
    await v0.evaluate(() => fetch('https://apiv2.vestiairecollective.com/users/me', { credentials: 'include' }).then((r) => r.text()));
    await v0.click('#robot');
    await attendre(1200);
    verifier((await lireTout(pageExt)).length === 0, 'éteint : 0 événement');
    verifier(await sw.evaluate(() => chrome.action.getBadgeText({})) === '', 'voyant éteint (aucun badge)');
    await v0.close();

    console.log('Allumé');
    await reglage(pageExt, { obs_on: true });
    verifier(await sw.evaluate(() => chrome.action.getBadgeText({})) === 'REC', 'voyant : « REC » sur l\'icône');
    const pop = await ctx.newPage();
    await pop.goto('chrome-extension://' + id + '/popup.html');
    await attendre(300);
    const vuPop = await pop.evaluate(() => ({ voyant: document.getElementById('voyant').dataset.on, bouton: document.getElementById('basculer').textContent, mode: document.querySelector('ol').innerText, exporter: !!document.getElementById('exporter'), effacer: !!document.getElementById('effacer') }));
    verifier(vuPop.voyant === '1' && /notifications/.test(vuPop.mode) && /aimé/.test(vuPop.mode) && /conversation/.test(vuPop.mode) && /UN/.test(vuPop.mode) && /offre/.test(vuPop.mode) && vuPop.exporter && vuPop.effacer && vuPop.bouton === 'Arrêter', 'popup : voyant rouge, bouton « Arrêter », mode d\'emploi (notifications, aimé, conversation, UN message, offre), Exporter, Effacer', vuPop);
    await pop.screenshot({ path: path.join(os.tmpdir(), 'observateur-vestiaire-popup.png') });
    await pop.close();

    const v = await ctx.newPage();
    await v.goto('https://fr.vestiairecollective.com/chat/');
    await attendre(500);
    const res = await v.evaluate(async (JWT) => {
      const API = 'https://apiv2.vestiairecollective.com'; const STREAM = 'https://chat.stream-io-api.com';
      const o = {};
      const h = { authorization: 'Bearer JETONAUTHSECRET', 'x-csrf-token': 'JETONCSRFSECRET' };
      o.moi = await (await fetch(API + '/users/me', { credentials: 'include', headers: h })).text();
      await (await fetch(API + '/notification-feed-counter/v2', { credentials: 'include' })).text();
      o.notifs = await (await fetch(API + '/notification-feed?category=updates&limit=20', { credentials: 'include' })).text();
      o.likes = await (await fetch(API + '/products/111222333/likes?offset=0', { credentials: 'include', headers: h })).text();
      await (await fetch(API + '/chat/user/token', { credentials: 'include', headers: h })).text();
      await (await fetch(API + '/chat/channel/', { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, h), body: JSON.stringify({ productId: '111222333', buyerId: '987654' }) })).text();
      // la messagerie Stream : connexion WebSocket (jeton et clé dans l'URL), puis la conversation
      const q = 'json=' + encodeURIComponent(JSON.stringify({ user_id: '123456', user_details: { id: '123456', email: 'julien@exemple.fr' } })) + '&api_key=CLESTREAMSECRETE&authorization=' + JWT + '&stream-auth-type=jwt';
      window.__ws = new WebSocket('wss://chat.stream-io-api.com/connect?' + q);
      await new Promise((r) => { window.__ws.onopen = r; setTimeout(r, 2000); });
      await new Promise((r) => setTimeout(r, 300));
      window.__ws.send(JSON.stringify({ type: 'typing.start', cid: 'chat_channel:987654-111222333' }));
      o.conv = await (await fetch(STREAM + '/channels/chat_channel/987654-111222333/query?api_key=CLESTREAMSECRETE&user_id=123456&connection_id=c-1', { method: 'POST', headers: { 'content-type': 'application/json', authorization: JWT, 'stream-auth-type': 'jwt' }, body: JSON.stringify({ state: true, watch: true }) })).text();
      // GraphQL, connexion, paiement (inventés : pour le masquage)
      await (await fetch(API + '/graphql', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operationName: 'LikeProduct', query: 'mutation LikeProduct($id: ID!) { likeProduct(id: $id) { liked } }', variables: { id: '111222333' } }) })).text();
      await (await fetch(API + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'julien@exemple.fr', password: 'motdepasse123' }) })).text();
      await (await fetch(API + '/payment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ card_number: '4111111111111111', iban: 'FR7630006000011234567890189', note: 'ma carte 4111 1111 1111 1111' }) })).text();
      // clic simulé, navigation SPA, iframe d'extension
      document.getElementById('robot').click();
      history.pushState({}, '', '/chat/987654-111222333?token=NAVSECRET&tab=messages');
      const ifr = document.createElement('iframe'); ifr.src = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/panneau.html'; document.body.appendChild(ifr);
      o.fetchNom = window.fetch.name;
      return o;
    }, JWT);
    verifier(JSON.parse(res.moi).data.email === 'julien@exemple.fr' && JSON.parse(res.likes).data[0].email === 'marie@exemple.fr', 'la page reçoit ses réponses INTACTES (rien modifié)');
    verifier(res.fetchNom === 'fetch', 'fetch garde son nom');

    // gestes humains : écrire un message (avec un numéro), l'envoyer, faire une offre
    await v.click('#msg');
    await v.type('#msg', 'Bonjour, je vous fais -10 % ! Mon tel 06 12 34 56 78');
    await v.type('#mdp', 'motdepasse123');
    await v.type('#carte', '4111111111111111');
    await attendre(1100);
    await v.click('#envoyer');
    await attendre(600);
    await v.click('#offre');
    await attendre(1800);
    const r2 = await v.evaluate(() => window.__r);
    const recuEnvoi = recus.find((x) => /\/message$/.test(x.chemin || ''));
    verifier(r2.envoi && JSON.parse(r2.envoi).message.text === 'Bonjour, je vous fais -10 % ! Mon tel 06 12 34 56 78' && recuEnvoi && recuEnvoi.entetes.authorization === JWT, 'le message part INTACT (texte et jeton tels que la page les envoie)');
    verifier(r2.offre && JSON.parse(r2.offre).data.id === 'neg-1' && recus.some((x) => /negotiations/.test(x.chemin || '') && x.entetes['x-csrf-token'] === 'JETONCSRFSECRET'), 'l\'offre (XHR) part intacte, réponse intacte');

    // onglet ouvert puis fermé
    const v2 = await ctx.newPage(); await v2.goto('https://fr.vestiairecollective.com/'); await attendre(900); await v2.close();
    await attendre(1500);

    const tout = await lireTout(pageExt);
    const texte = JSON.stringify(tout);
    console.log('  (' + tout.length + ' événements bruts)');

    console.log('Requêtes');
    const moiF = tout.find((e) => e.src === 'reseau' && e.chemin === '/users/me' && e.methode === 'GET' && e.hote === 'apiv2.vestiairecollective.com');
    verifier(moiF && moiF.statut === 200 && typeof moiF.duree === 'number' && moiF.type === 'xmlhttprequest' && moiF.initiator === 'https://fr.vestiairecollective.com' && moiF.tabId > 0 && moiF.frameId === 0, 'fond : méthode, hôte, chemin, statut, durée, type, initiateur, onglet, cadre', moiF);
    verifier(moiF && moiF.entetesRequete.includes('authorization') && moiF.entetesRequete.includes('x-csrf-token') && moiF.entetesReponse.includes('content-type'), 'fond : NOMS des en-têtes envoyés et reçus', moiF && [moiF.entetesRequete, moiF.entetesReponse]);
    const moiP = tout.find((e) => e.src === 'page' && e.api === 'fetch' && e.chemin === '/users/me');
    verifier(moiP && moiP.reponse && /Pseudotest/.test(moiP.reponse.texte) && /"email":"\[masqué\]"/.test(moiP.reponse.texte) && moiP.entetesRequete.includes('authorization'), 'page : réponse JSON captée (e-mail masqué), noms des en-têtes', moiP && moiP.reponse);
    const likes = tout.find((e) => e.src === 'page' && /\/products\/111222333\/likes$/.test(e.chemin));
    verifier(likes && /Marie/.test(likes.reponse.texte) && /987654/.test(likes.reponse.texte), 'liste des personnes qui ont aimé : réponse captée');
    verifier(tout.some((e) => e.src === 'page' && /notification-feed$/.test(e.chemin) && /vient d'aimer/.test((e.reponse || {}).texte || '')), 'notifications (« vient d\'aimer votre pièce ») captées');
    const envoi = tout.find((e) => e.src === 'page' && e.hote === 'chat.stream-io-api.com' && /\/message$/.test(e.chemin));
    verifier(envoi && /je vous fais -10 %/.test(envoi.corps.texte) && !/06 12/.test(envoi.corps.texte) && envoi.entetesRequete.includes('authorization') && /api_key=\[masqué\]/.test(envoi.recherche), 'message Stream : corps gardé (téléphone masqué), clé masquée, noms des en-têtes', envoi);
    verifier(tout.some((e) => e.src === 'reseau' && e.hote === 'chat.stream-io-api.com' && /\/message$/.test(e.chemin) && e.statut === 201), 'message Stream : vu aussi par le fond (statut 201)');
    const offre = tout.find((e) => e.src === 'page' && e.api === 'xhr' && /negotiations$/.test(e.chemin));
    verifier(offre && /9000/.test(offre.corps.texte) && /neg-1/.test(offre.reponse.texte) && offre.entetesRequete.includes('x-csrf-token') && offre.entetesReponse.length > 0, 'offre (XHR) : corps, réponse, noms des en-têtes', offre);
    verifier(tout.some((e) => e.src === 'page' && /graphql$/.test(e.chemin) && /LikeProduct/.test(e.corps.texte)), 'GraphQL : opération captée');
    const wsE = tout.filter((e) => e.api === 'ws');
    verifier(wsE.some((e) => e.sens === 'ouvert' && e.hote === 'chat.stream-io-api.com' && /api_key=\[masqué\]/.test(e.recherche) && /authorization=\[masqué\]/.test(e.recherche)) && wsE.some((e) => e.sens === 'reçu' && /health\.check/.test(e.reponse.texte)) && wsE.some((e) => e.sens === 'envoyé' && /typing\.start/.test(e.corps.texte)) && wsE.some((e) => e.sens === 'reçu' && /message\.new/.test(e.reponse.texte)), 'WebSocket de la messagerie : ouvert (jetons masqués), reçu, envoyé', wsE.map((e) => e.sens + ' ' + e.recherche));
    verifier(tout.some((e) => e.src === 'nav' && e.detail === 'pushState' && /token=\[masqué\]&tab=messages/.test(e.recherche)), 'navigation SPA (pushState) notée, jeton masqué');

    console.log('Gestes et autres extensions');
    verifier(tout.some((e) => e.src === 'geste' && e.geste === 'clic' && e.isTrusted === false && e.cible && e.cible.testid === 'robot-btn'), 'clic simulé (isTrusted faux) avec son data-testid');
    const clicEnvoi = tout.find((e) => e.src === 'geste' && e.geste === 'clic' && e.isTrusted === true && e.cible && e.cible.testid === 'chat-send-button');
    verifier(clicEnvoi && clicEnvoi.cible.texte === 'Envoyer' && clicEnvoi.cible.bouton === 'button', 'clic humain : data-testid et texte du bouton', clicEnvoi && clicEnvoi.cible);
    const sMsg = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'message');
    verifier(sMsg && /je vous fais -10 %/.test(sMsg.valeur) && /\[masqué\]/.test(sMsg.valeur) && sMsg.isTrusted === true, 'saisie du message : texte gardé, téléphone masqué', sMsg && sMsg.valeur);
    const sMdp = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'password');
    const sCarte = tout.find((e) => e.src === 'geste' && e.geste === 'saisie' && e.champ === 'cardNumber');
    verifier(sMdp && sMdp.valeur === undefined && sMdp.longueur === 13 && sCarte && sCarte.valeur === undefined, 'mot de passe et carte : longueur seulement, jamais la valeur');
    const extMain = tout.find((e) => e.src === 'page' && /\/products\/555\/likes$/.test(e.chemin));
    verifier(idAutre && extMain && (extMain.extPile || []).includes(idAutre), 'requête d\'une autre extension (script dans la page) : son identifiant relevé dans la pile', { idAutre, extMain });
    verifier(tout.some((e) => e.src === 'reseau' && /\/products\/556\/likes$/.test(e.chemin)), 'requête d\'une autre extension (script isolé) : vue par le fond');
    verifier(tout.some((e) => e.src === 'dom' && e.extId === 'abcdefghijklmnopabcdefghijklmnop'), 'iframe chrome-extension:// ajoutée : identifiant lu');
    verifier(tout.some((e) => e.src === 'compte' && e.userId === '123456'), 'compte connecté vu (identifiant)');
    verifier(tout.some((e) => e.src === 'onglet' && /fermé/.test(e.detail)), 'onglet Vestiaire ouvert puis fermé');

    console.log('Masquage (base locale)');
    const restes = sansSecret(texte);
    verifier(restes.length === 0, 'aucun secret dans la base locale (jetons, cookies, clé Stream, e-mails, téléphones, mot de passe, carte, IBAN)', restes);
    verifier(!/"cookie"\s*:|"authorization"\s*:|"x-csrf-token"\s*:/i.test(texte), 'aucun en-tête stocké avec sa valeur');

    console.log('Export');
    await pageExt.reload();
    await attendre(900);
    const vuPage = await pageExt.evaluate(() => ({ routes: Array.from(document.querySelectorAll('#routes tbody tr')).map((t) => t.dataset.route), seq: !!document.querySelector('#sequence-table tr[data-etape="envoi"]'), voyant: document.getElementById('voyant').dataset.on }));
    verifier(vuPage.routes.includes('POST chat.stream-io-api.com/channels/chat_channel/{n}-{n}/message') && vuPage.seq && vuPage.voyant === '1', 'page : routes regroupées, séquence de l\'envoi, voyant', vuPage.routes.slice(0, 12));
    await pageExt.screenshot({ path: path.join(os.tmpdir(), 'observateur-vestiaire-page.png'), fullPage: true });
    // « Exporter » du popup : ouvre la page de l'extension qui télécharge JSON puis CSV.
    const pop2 = await ctx.newPage();
    await pop2.goto('chrome-extension://' + id + '/popup.html');
    const dls = [];
    ctx.on('page', (p) => p.on('download', (d) => dls.push(d)));
    await pop2.click('#exporter').catch(() => {});
    for (let i = 0; i < 40 && dls.length < 2; i++) await attendre(250);
    verifier(dls.length === 2, 'un bouton « Exporter » ⇒ deux fichiers (JSON + CSV)', dls.map((d) => d.suggestedFilename()));
    const fichiers = {};
    for (const d of dls) fichiers[path.extname(d.suggestedFilename())] = fs.readFileSync(await d.path(), 'utf8');
    const j = fichiers['.json'] ? JSON.parse(fichiers['.json']) : null;
    const csv = fichiers['.csv'] || '';
    if (j) {
      const cles = Object.keys(j);
      verifier(cles.indexOf('resume_lisible') < cles.indexOf('routes') && cles.indexOf('routes') < cles.indexOf('evenements') && /résumé/.test(j.resume_lisible[0]), 'JSON : le résumé lisible en tête, puis les routes, puis les événements', cles);
      const pt = j.resume.parTheme;
      verifier(pt.aimes.some((r) => /likes/.test(r.route)) && pt.notifications.some((r) => /notification-feed/.test(r.route)) && pt.messages.some((r) => /\/message$/.test(r.route)) && pt.messages.some((r) => /^WS/.test(r.route)) && pt.offres.some((r) => /negotiations/.test(r.route)), 'résumé : likes, notifications, conversations/messages (REST et WebSocket), offres', Object.fromEntries(Object.entries(pt).map(([k, v]) => [k, v.map((r) => r.route)])));
      const seq = j.resume.sequencesMessage[j.resume.sequencesMessage.length - 1];
      verifier(seq && seq.etapes.some((e) => /Saisie dans un champ \(humain\)/.test(e.quoi)) && seq.etapes.some((e) => /Clic \(humain\).*chat-send-button/.test(e.quoi)) && seq.etapes.some((e) => e.cetEnvoi && /\/message/.test(e.quoi)) && seq.apresGesteHumain === true, 'résumé : séquence du message envoyé (saisie, clic « Envoyer », POST …/message)', seq);
      verifier(j.resume_lisible.some((l) => /CET ENVOI/.test(l)) && j.resume_lisible.some((l) => /Likes/.test(l)), 'résumé lisible : séquence et thèmes écrits en clair');
      const rEnvoi = j.routes.find((r) => r.cle === 'POST chat.stream-io-api.com/channels/chat_channel/{n}-{n}/message');
      verifier(rEnvoi && rEnvoi.enTetesRequete.includes('authorization') && rEnvoi.params.includes('api_key') && rEnvoi.themes.includes('messages'), 'route du message : en-têtes (noms), paramètres, thème', rEnvoi);
      verifier(j.evenements.length > 20, 'JSON : événements complets');
    }
    verifier(csv.startsWith('﻿t_iso,') && /Message envoyé/.test(csv) && /route/.test(csv.split('\r\n')[0]) && /entetes_requete/.test(csv.split('\r\n')[0]), 'CSV : colonnes (route, en-têtes…) et lignes');
    const restesExp = sansSecret((fichiers['.json'] || '') + csv);
    verifier(fichiers['.json'] && restesExp.length === 0, 'exports : aucun secret', restesExp);
    const [dlh] = await Promise.all([pageExt.waitForEvent('download'), pageExt.click('#export-html')]);
    const html = fs.readFileSync(await dlh.path(), 'utf8');
    verifier(/Routes vues/.test(html) && !/<script/i.test(html) && sansSecret(html).length === 0, 'résumé HTML : routes, sans script, sans secret');

    await explorationBanc(ctx, sw, id, pageExt, v);

    console.log('Rien ne sort');
    const hotes = new Set(vus.map((u) => { try { const x = new URL(u); return x.protocol === 'chrome-extension:' ? 'extension' : x.host; } catch (_) { return u; } }));
    const permis = /^(fr|apiv2)\.vestiairecollective\.com$|^chat\.stream-io-api\.com$|^extension$/;
    verifier([...hotes].every((h) => permis.test(h)), 'toutes les requêtes du navigateur vont aux faux hôtes servis par le banc', [...hotes]);
    const fuite = await sw.evaluate((p) => fetch('http://127.0.0.1:' + p + '/fuite').then(() => 'parti', (e) => 'bloqué : ' + e.message), PORT);
    verifier(/bloqué/.test(fuite) && espion === 0, 'le fond de l\'extension ne peut rien envoyer (CSP connect-src \'none\'), l\'espion local n\'a rien reçu', { fuite, espion });
    const ps = await ctx.newPage(); await ps.goto('http://127.0.0.1:' + PORT + '/sonde').catch(() => {}); await ps.close();
    verifier(sonde === 1, 'contre-épreuve : l\'espion local est bien joignable (une page ordinaire l\'atteint)', sonde);

    console.log('Arrêter, puis effacer');
    const pop3 = await ctx.newPage();
    await pop3.goto('chrome-extension://' + id + '/popup.html');
    await attendre(300);
    await pop3.click('#basculer');
    await attendre(500);
    verifier(await pop3.evaluate(() => document.getElementById('basculer').textContent) === 'Allumer l\'enregistrement' && (await pageExt.evaluate(() => chrome.storage.local.get('obs_on'))).obs_on === false, 'popup : « Arrêter » éteint l\'enregistrement');
    await pop3.close();
    verifier(await sw.evaluate(() => chrome.action.getBadgeText({})) === '', 'arrêté : voyant éteint');
    const avant = (await lireTout(pageExt)).length;
    await v.evaluate(async () => { await fetch('https://apiv2.vestiairecollective.com/users/me', { credentials: 'include' }); document.getElementById('robot').click(); });
    await attendre(1200);
    const apres = await lireTout(pageExt);
    verifier(apres.slice(avant).every((e) => e.src === 'debut'), 'arrêté : plus rien noté', apres.slice(avant));
    pageExt.once('dialog', (d) => d.accept());
    await pageExt.click('#effacer');
    await attendre(700);
    verifier((await lireTout(pageExt)).length === 0, 'tout effacé');
  } finally {
    await ctx.close();
    srv.close();
    fs.rmSync(dossier, { recursive: true, force: true });
    fs.rmSync(autre, { recursive: true, force: true });
  }
}

async function etatExpl(pageExt) { return (await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_etat' }))).etat; }
async function attendreExpl(pageExt, cond, ms) { const fin = Date.now() + ms; let s; while (Date.now() < fin) { s = await etatExpl(pageExt); if (cond(s)) return s; await attendre(250); } return s; }

async function explorationBanc(ctx, sw, id, pageExt, v) {
  console.log('Exploration du site');
  await pageExt.evaluate(() => chrome.storage.local.set({ obs_expl_essai: { min: 150, max: 400 } }));
  SITE.mode = 'exploration'; SITE.documents = []; SITE.pieges = [];
  const recusAvant = recus.length;
  const pop = await ctx.newPage();
  await pop.goto('chrome-extension://' + id + '/popup.html');
  await attendre(300);
  await pop.click('#expl-lancer');
  // pendant ce temps, l'utilisateur clique dans SON onglet
  await attendre(1500);
  await v.click('h1');
  let progression = 0;
  // pendant : le popup compte les pages
  const enCours = await attendreExpl(pageExt, (x) => x && x.n >= 3, 60000);
  await attendre(1300);
  const pendantTxt = await pop.evaluate(() => document.getElementById('expl-etat').textContent);
  verifier(enCours && /^\d+ pages vues · \d+ en attente · exploration en cours$/.test(pendantTxt) && !(await pop.evaluate(() => document.getElementById('expl-arreter').hidden)), 'pendant : « N pages vues · … · exploration en cours », bouton Arrêter actif', pendantTxt);
  const s = await attendreExpl(pageExt, (x) => { return x && !x.actif; }, 180000);
  await attendre(1300);
  progression = Number(await pop.evaluate(() => document.getElementById('expl-etat').dataset.n));
  const texteEtat = await pop.evaluate(() => document.getElementById('expl-etat').textContent);
  verifier(s && s.arret && s.arret.fini && /tout ce qui était à voir/.test(s.arret.raison), 'l\'exploration va au bout d\'elle-même', s && s.arret);
  verifier(progression === s.n && new RegExp('^' + s.n + ' pages vues · 0 en attente · terminée').test(texteEtat), 'à la fin : « ' + texteEtat + ' »');
  const docs = new Set(SITE.documents);
  const manque = ATTENDUES.filter((p) => !docs.has(p));
  verifier(!manque.length, 'toutes les pages du compte visitées : accueil, profil, les 9 articles (chargement infini), notifications, messagerie et chaque conversation, commandes, offres, favoris, réglages', { manque, vues: [...docs] });
  const interdites = JAMAIS_VUES.filter((p) => docs.has(p));
  verifier(!interdites.length, 'jamais ouvertes : catalogue hors compte, déconnexion, panier, profil d\'une autre personne, 4ᵉ niveau de profondeur', interdites);
  const pendant = recus.slice(recusAvant);
  verifier(pendant.some((x) => /products/.test(x.chemin || '') && /page=3/.test(x.recherche || '')), 'chargement infini : les pages 2 et 3 du dressing demandées en défilant');
  const likers = new Set(pendant.filter((x) => /\/products\/1110000\d\d\/likes$/.test(x.chemin || '')).map((x) => x.chemin));
  verifier(likers.size === 9, '« Voir qui a aimé » ouvert sur chacun des 9 articles', [...likers]);
  verifier(pendant.some((x) => /shipping$/.test(x.chemin || '')) && pendant.some((x) => /page=2/.test(x.recherche || '') && /notification-feed/.test(x.chemin || '')) && pendant.some((x) => /role=buyer/.test(x.recherche || '')) && pendant.some((x) => /category=messages/.test(x.recherche || '')), 'onglets, accordéons, « Voir plus » ouverts (livraison, notifications page 2, offres envoyées, onglet Messages)');
  verifier(SITE.pieges.length === 0, 'AUCUN bouton piégé cliqué (Envoyer, J\'aime, Acheter, Faire une offre, Suivre, Vendre, Accepter, Refuser, Annuler, Tout marquer comme lu, Retirer des favoris, Se déconnecter)', SITE.pieges);
  const nonGet = pendant.filter((x) => x.methode && !/^(GET|OPTIONS|WS|WS-msg)$/.test(x.methode));
  const propres = nonGet.filter((x) => x.hote === 'chat.stream-io-api.com' && /^\/channels(\/chat_channel\/[\d-]+\/query)?$/.test(x.chemin));
  verifier(nonGet.length === propres.length && propres.length === 4, 'aucune requête non-GET provoquée : seules celles que les pages de messagerie font d\'elles-mêmes au chargement (4)', nonGet.map((x) => x.methode + ' ' + x.chemin));
  verifier(!pendant.some((x) => /recherche|settings/.test(x.chemin || '') && x.methode === 'POST'), 'aucun formulaire soumis');
  const delais = s.delais || [];
  verifier(delais.length >= 20 && new Set(delais).size === delais.length && delais.every((d) => d >= 150 && d <= 400), 'rythme au hasard, jamais deux fois le même temps', delais.slice(0, 10));
  const tout = await lireTout(pageExt);
  const R = regles();
  const ex = R.exploration(tout);
  verifier(ex.pages.length === s.n && ex.nonGet.length >= 4 && ex.nonGet.every((x) => !x.apresClic), 'résumé : pages vues, requêtes non-GET notées, aucune après un clic de l\'exploration', ex.nonGet);
  const refus = ex.refus.map((r) => r.libelle);
  verifier(['J\'aime', 'Acheter', 'Faire une offre', 'Envoyer', 'Suivre', 'Vendre', 'Tout marquer comme lu', 'Accepter', 'Refuser', 'Se déconnecter'].every((x) => refus.includes(x)), 'liste noire : chaque piège vu et refusé, avec sa raison', [...new Set(refus)]);
  verifier(ex.parTheme.aimes.some((r) => /likes/.test(r.route)) && ex.parTheme.notifications.some((r) => /notification-feed/.test(r.route)) && ex.parTheme.messages.some((r) => /stream-io-api/.test(r.route)) && ex.parTheme.offres.some((r) => /negotiations/.test(r.route)), 'résumé : routes découvertes par thème (likes, notifications, messagerie Stream, offres)', ex.parTheme);
  const exT = tout.filter((e) => e.origine === 'exploration');
  verifier(exT.some((e) => e.src === 'reseau') && exT.some((e) => e.src === 'page') && exT.some((e) => e.src === 'geste' && e.isTrusted === false), 'ce que l\'exploration provoque est capté (fond, page, ses clics), marqué « exploration »');
  verifier(tout.some((e) => e.src === 'geste' && e.isTrusted === true && e.origine !== 'exploration' && e.t > s.debut), 'les gestes de l\'utilisateur restent captés dans son onglet, pendant l\'exploration, à part');
  const o = R.outil(R.attribuer(R.fusionner(tout)), []);
  verifier(o.exploration > 0 && !Object.keys(o.autoParType).some((k) => /exploration/.test(k)), '« Ce que l\'outil a fait » ne mélange pas l\'exploration aux gestes de l\'utilisateur');
  const pages = ctx.pages().map((p) => p.url());
  verifier(!pages.some((u) => /my-account\/settings/.test(u)), 'fini : la fenêtre d\'exploration est refermée', pages);

  console.log('Limite, arrêt, reprise');
  await pageExt.evaluate(() => chrome.storage.local.set({ obs_expl_essai: { min: 150, max: 400, maxPages: 5 } }));
  SITE.documents = [];
  await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_lancer' }));
  const s2 = await attendreExpl(pageExt, (x) => x && !x.actif, 60000);
  verifier(s2.n === 5 && /limite de 5 pages/.test(s2.arret.raison) && SITE.documents.length === 5, 'limite de pages respectée (5)', { n: s2.n, docs: SITE.documents });
  await pageExt.evaluate(() => chrome.storage.local.set({ obs_expl_essai: { min: 150, max: 400 } }));
  await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_lancer' }));
  await attendreExpl(pageExt, (x) => x && x.n >= 2, 30000);
  await pop.reload(); await attendre(400);
  await pop.click('#expl-arreter');
  const s3 = await attendreExpl(pageExt, (x) => x && !x.actif, 3000);
  await attendre(1500);
  const s3b = await etatExpl(pageExt);
  verifier(s3 && !s3.actif && /arrêtée par toi/.test(s3.arret.raison) && s3b.n === s3.n, '« Arrêter » arrête tout de suite, plus rien ne bouge', { n: s3 && s3.n, apres: s3b.n });
  await pop.reload(); await attendre(1200);
  verifier(!(await pop.evaluate(() => document.getElementById('expl-reprendre').hidden)), 'bouton « Reprendre » proposé');
  await pop.click('#expl-reprendre');
  const s4 = await attendreExpl(pageExt, (x) => x && x.n >= s3.n + 2, 30000);
  verifier(s4 && s4.n >= s3.n + 2 && !s4.vus.slice(0, s3.vus.length).some((u, i) => u !== s3.vus[i]), 'reprise : continue là où elle s\'était arrêtée', { avant: s3.n, apres: s4 && s4.n });
  await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_arreter' }));
  await attendreExpl(pageExt, (x) => x && !x.actif, 5000);

  console.log('Arrêt sur vérification, sur 429');
  SITE.mode = 'captcha'; SITE.documents = [];
  await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_lancer' }));
  const s5 = await attendreExpl(pageExt, (x) => x && !x.actif, 30000);
  verifier(s5 && /vérification affichée/.test(s5.arret.raison) && s5.n === 1 && SITE.documents.length === 1, 'faux captcha : arrêt immédiat à la première page', s5 && { n: s5.n, raison: s5.arret.raison, docs: SITE.documents, vus: s5.vus });
  verifier(ctx.pages().some((p) => /fr\.vestiairecollective\.com\/$/.test(p.url())), 'l\'onglet reste ouvert pour que tu voies la vérification');
  SITE.mode = '429'; SITE.documents = [];
  await pageExt.evaluate(() => chrome.runtime.sendMessage({ quoi: 'expl_lancer' }));
  const s6 = await attendreExpl(pageExt, (x) => x && !x.actif, 60000);
  verifier(s6 && /429/.test(s6.arret.raison) && SITE.documents[SITE.documents.length - 1] === '/notifications/', '429 : arrêt immédiat', s6 && { raison: s6.arret.raison, docs: SITE.documents });
  await pop.close();
  SITE.mode = 'test';
}

(async () => {
  statique();
  try { await scenario(); } catch (e) { ko++; console.log('  ✗ le scénario a planté : ' + (e && e.stack || e)); }
  console.log('\n' + ok + ' vert(s), ' + ko + ' rouge(s)');
  process.exit(ko ? 1 : 0);
})();
