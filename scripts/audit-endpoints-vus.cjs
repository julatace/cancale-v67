// ════════════════════════════════════════════════════════════════════════════
//  « LE BOUTON TÉLÉCHARGER MES DONNÉES ME RENVOIE SUR "COMPTE BLOQUÉ" »
//  Demande de Julien, 19 septembre. Son compte PRO Vinted est bloqué et il a
//  besoin de l'export de ses données pour le récupérer.
//
//  ⚠️⚠️ CE QUE JE NE PEUX PAS FAIRE, ET POURQUOI JE NE L'INVENTE PAS.
//  Mesuré sur sa base : sur les **41 chemins d'API** que son extension a
//  observés en tout, **aucun** ne concerne un export. Je n'ai donc JAMAIS vu
//  cet endpoint. Écrire un appel vers une adresse devinée, c'est exactement ce
//  que ce dossier interdit partout — et ici ça se ferait depuis la session d'un
//  compte déjà bloqué, c'est-à-dire au pire endroit possible.
//  ⇒ C'est SON navigateur qui mesure et qui me rapporte, comme pour le
//    formulaire eBay et les étapes Leboncoin : *faire mesurer par ce qui y a
//    accès.*
//
//  ⚠️⚠️ ET LA MESURE QUI MANQUAIT EST LE **STATUT**. Deux situations très
//  différentes se ressemblent de l'extérieur :
//    · la requête d'export PART et le serveur la refuse (403) ⇒ aucun
//      contournement côté navigateur ne servira, la voie écrite est la seule ;
//    · la requête ne part JAMAIS parce que c'est seulement la page qui redirige
//      ⇒ la donnée est peut-être atteignable.
//  Le mouchard notait le chemin et PAS le statut : les deux cas étaient
//  indistinguables. Et il ignorait tout ce qui n'est pas `/api/`, donc une page
//  de réglages ne laissait aucune trace du tout.
//
//  ⚠️ §4.10 : `node --check` ne voit rien de ça. On CHARGE `inject.js` dans une
//  vraie page et on regarde ce qu'il ENVOIE.
//
//  (29 octobre) LES CONVERSATIONS, ET LA ROUTE QUI PORTE LEURS MESSAGES.
//  Mesuré en lecture seule (sa base) : les commandes portent un
//  `conversation_id` UUID, que la règle de capture (`…/conversations/(\d+)`)
//  ignorait ; et depuis le 18 octobre aucune requête `/api/v2/conversations/…`
//  ne part plus de la page d'une conversation — les messages passent par une
//  route que personne n'a vue. Sections C1-C3 (données INVENTÉES) :
//   C1. la règle `<chemin-regle>` est la MÊME dans la page et dans le fond ;
//   C2. la page d'une conversation (VRAI inject.js + content.js) : une
//       conversation chargée par UUID est captée, un sous-chemin (`…/replies`)
//       ne l'est plus, un UUID ne passe plus en clair dans le relevé, et la
//       route des messages est MESURÉE sans être devinée (requêtes hors
//       `/api/`, forme d'une liste de messages, socket, données Next) — jamais
//       une valeur ;
//   C3. le fond (VRAI background.js) : la conversation lue par UUID est rangée
//       sous l'id NUMÉRIQUE de la réponse, jamais sous l'UUID ; une réponse qui
//       porte un autre id n'est pas rangée ; le relevé garde les clés les plus
//       RÉCENTES (il gardait les 400 premières) et fond les UUID d'avant.
//  Mutations (§6.1) : `--mutation nom` (la liste : `--mutation ?`).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./bancs/_meta.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
let SRC = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js'), 'utf8');
let RELAIS = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'content.js'), 'utf8');
let BG_SRC = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
// ── RÉAFFAIBLIR UNE RÈGLE (§6.1) : une mutation par correction du 29 octobre.
const UUID_HARVEST = String.raw`{ re: /\/api\/v\d+\/conversations\/(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:\?|$)/i, type: 'conversation' },`;
const UUID_CHEMIN = String.raw`      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')`;
const MUTATIONS = {
  // la capture ne reconnaît plus une conversation par UUID
  uuid: [['inject', UUID_HARVEST, String.raw`{ re: /\/api\/v\d+\/conversations\/(\d+)\/?(?:\?|$)/i, type: 'conversation' },`]],
  // la règle n'est plus ancrée : un sous-chemin (`…/replies`) est pris pour une conversation
  ancre: [['inject', UUID_HARVEST, String.raw`{ re: /\/api\/v\d+\/conversations\/(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i, type: 'conversation' },`]],
  // un UUID repasse en clair dans le relevé (la page ET le fond : la règle reste la même)
  'chemin-uuid': [['inject', UUID_CHEMIN, ''], ['bg', UUID_CHEMIN, '']],
  // la page d'une conversation n'est plus relevée
  'releve-conv': [['inject', `    try {
      if (!surPageConv()) return;
      noteNextConv();`, `    try {
      return;
      noteNextConv();`]],
  // la socket n'est plus observée
  'canal-ws': [['inject', `    if (typeof WS0 === 'function' && typeof Proxy === 'function') {`, `    if (false) {`]],
  // le relevé garde les 400 PREMIÈRES clés (le défaut d'avant)
  'seen-anciennes': [['bg', `  for (const [k, v] of Object.entries(rep).sort((a, b) => ms(b[1]) - ms(a[1])).slice(0, SEEN_REP_MAX)) reponsesOut[k] = v;`, `  for (const [k, v] of Object.entries(rep).slice(0, SEEN_REP_MAX)) reponsesOut[k] = v;`]],
  // la conversation lue par UUID est rangée sous l'UUID
  'conv-uuid-range': [['bg', `      if (!idRep) { noterDiag('ignore_conversation_sans_id_numerique'); return; }
      id = idRep;`, `      if (!idRep) { noterDiag('ignore_conversation_sans_id_numerique'); return; }`]],
  // une réponse qui porte un AUTRE id est rangée quand même
  'conv-id-different': [['bg', `    } else if (idRep && idRep !== String(id)) { noterDiag('ignore_conversation_id_different'); return; }`, `    }`]],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  const F = { inject: SRC, bg: BG_SRC };
  for (const [f, de, vers] of MUTATIONS[MUT]) {
    const n = F[f].split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${f} — mets la mutation à jour`); process.exit(1); }
    F[f] = F[f].replace(de, vers);
  }
  SRC = F.inject; BG_SRC = F.bg;
  console.log(`(mutation « ${MUT} »)`);
}
const BGF = path.join(os.tmpdir(), `vrm-endpoints-bg-${process.pid}.js`);
fs.writeFileSync(BGF, BG_SRC);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ctx = await nav.newContext();
  const pg = await ctx.newPage();
  // ⚠️ §6.6 : le fourre-tout D'ABORD, les routes précises ENSUITE — Playwright
  //    prend la dernière enregistrée en premier.
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>page</body></html>' }));
  // La page de réglages où vit le bouton, telle qu'il la décrit : elle répond,
  // mais la requête d'export se fait REFUSER par le serveur.
  await pg.route('**/api/v2/data_export**', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"account_blocked"}' }));
  await pg.route('**/api/v2/inbox**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"conversations":[]}' }));
  await pg.goto('https://www.vinted.fr/parametres/donnees-personnelles', { waitUntil: 'domcontentloaded' });

  // On rejoue le pont : `inject.js` poste ses messages par `window.postMessage`.
  await pg.evaluate(() => {
    window.__vus = [];
    window.addEventListener('message', (e) => {
      const d = e && e.data;
      if (d && d.kind === 'seen_urls') window.__vus.push(d);
    });
  });
  // ⚠️⚠️ ON TRAVERSE `content.js`. Mon premier jet lisait le `postMessage` DANS
  //    la page : il prouvait donc que `inject.js` ENVOIE `reponses`, et pas du
  //    tout qu'elles ARRIVENT. Or `content.js` recopiait une liste de champs
  //    FIXE et jetait `reponses` en silence — la donnée mourait entre les deux.
  //    *Un contrôle qui s'arrête au message prouve le message, jamais la
  //    donnée* : le dossier le disait déjà pour `storeLbcRecon`, et j'y suis
  //    retombé. Le banc charge maintenant le VRAI relais.
  await pg.evaluate(() => {
    window.__recu = [];
    window.chrome = { runtime: {
      getURL: (f) => 'about:blank#' + f,          // le banc injecte inject.js lui-même
      sendMessage: (m) => { window.__recu.push(m); },
    } };
  });
  await pg.addScriptTag({ content: SRC });
  await pg.addScriptTag({ content: RELAIS });

  await essaie('le clic sur le bouton', async () => {
    // Ce que fait le bouton : une requête d'export, plus un appel banal à côté.
    await pg.evaluate(async () => {
      try { await fetch('/api/v2/data_export?scope=all&email=julien@exemple.fr', { method: 'POST', body: JSON.stringify({ secret: 'ne-doit-pas-partir' }) }); } catch (_) {}
      try { await fetch('/api/v2/inbox?page=1'); } catch (_) {}
      // et en XHR, parce que Vinted utilise les deux
      await new Promise((res) => { const x = new XMLHttpRequest(); x.open('POST', '/api/v2/data_export/2214455667'); x.onloadend = res; x.onerror = res; x.send('rien'); });
    });
    // ⚠️⚠️ LE DÉLAI EST LE DÉFAUT QUI A FAIT ÉCHOUER SON PREMIER ESSAI.
    //    Il a cliqué, la page l'a renvoyé aussitôt sur « compte bloqué », et le
    //    relevé de CETTE page n'est jamais parti : le vidage n'avait lieu qu'à
    //    5 s. On exige donc qu'un appel qui ÉCHOUE parte SANS ATTENDRE — c'est
    //    exactement le cas où la page ne nous laisse pas le temps.
    await pg.waitForTimeout(800);
    const tot = (await pg.evaluate(() => window.__recu || [])).filter((m) => m && m.kind === 'seen_urls');
    dit(tot.length > 0, 'un appel qui ÉCHOUE part TOUT DE SUITE, sans attendre les 5 s',
      tot.length ? '' : 'rien relayé après 800 ms — une page qui rebondit ne laisserait rien');
    dit(!!(tot.length && tot.some((m) => m.reponses && Object.keys(m.reponses).some((k) => /data_export/.test(k)))),
      'et cet envoi immédiat porte déjà la requête d’export',
      JSON.stringify(tot.map((m) => Object.keys(m.reponses || {}))));
    await pg.waitForTimeout(6000);
    const vus = await pg.evaluate(() => window.__vus || []);
    dit(vus.length > 0, 'le mouchard envoie son relevé', `${vus.length} envoi(s)`);
    // Ce que le RELAIS a réellement transmis au service worker.
    const recu = (await pg.evaluate(() => window.__recu || [])).filter((m) => m && m.kind === 'seen_urls');
    dit(recu.length > 0, 'et le relevé TRAVERSE content.js jusqu’au background', `${recu.length} message(s) relayé(s)`);
    const arrive = recu[recu.length - 1] || {};
    dit(arrive.reponses && Object.keys(arrive.reponses).length > 0,
      'les CODES DE RÉPONSE survivent au relais (ils étaient jetés là)',
      JSON.stringify(Object.keys(arrive.reponses || {})));
    dit(arrive.from === 'cancale-content' && !!arrive.domain,
      'et le relais pose lui-même l’expéditeur et le domaine (la page ne les dicte pas)');
    const dernier = arrive.paths ? arrive : (vus[vus.length - 1] || {});
    const chemins = dernier.paths || [];
    const rep = dernier.reponses || {};

    // 1. LE STATUT — c'est toute la raison de cette passe.
    const cles = Object.keys(rep);
    const exp = cles.filter((k) => /data_export/.test(k));
    dit(exp.length > 0, 'la requête d’export est relevée avec sa MÉTHODE', exp.join(' · '));
    dit(exp.some((k) => rep[k] && rep[k].st === 403),
      'et avec son CODE DE RÉPONSE — c’est lui qui dit si le serveur refuse',
      JSON.stringify(exp.map((k) => k + '→' + (rep[k] || {}).st)));
    dit(cles.some((k) => /inbox/.test(k) && rep[k].st === 200),
      'un appel qui réussit est relevé avec son 200 (sinon on ne distingue rien)');
    // ⚠️ L'AUTRE SENS : *ne rien relever* passerait les contrôles d'absence.
    dit(cles.length >= 2, 'plusieurs appels distincts sont relevés', `${cles.length} clés`);

    // 2. LA PAGE elle-même — sans elle on ne sait même pas qu'il y est passé.
    dit(chemins.some((p) => /donnees-personnelles|parametres/.test(p)),
      'la PAGE de réglages est relevée, pas seulement les appels /api/', JSON.stringify(chemins));

    // 3. LA CONFIDENTIALITÉ : chemin, méthode, statut — et RIEN d'autre.
    const brut = JSON.stringify(dernier);
    dit(!/ne-doit-pas-partir/.test(brut), 'le CORPS de la requête ne part pas');
    dit(!/julien@exemple\.fr/.test(brut), 'les PARAMÈTRES d’URL ne partent pas (ni son adresse)');
    dit(!/2214455667/.test(brut) && /\{id\}/.test(brut),
      'et les identifiants réels sont remplacés par {id}',
      JSON.stringify(cles.filter((k) => /data_export/.test(k))));
  });

  // ════════════════════════════════════════════════════════════════════════
  //  (29 octobre) LES CONVERSATIONS ET LA ROUTE DE LEURS MESSAGES
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── C1. La règle <chemin-regle> est la même dans la page et dans le fond');
  await essaie('C1', async () => {
    const bloc = (t) => { const i = t.indexOf('// <chemin-regle>'), j = t.indexOf('// </chemin-regle>'); return i >= 0 && j > i ? t.slice(i, j).split('\n').map((l) => l.trim()).join('\n') : null; };
    const bi = bloc(SRC), bb = bloc(BG_SRC);
    dit(!!bi && !!bb, 'le bloc <chemin-regle> existe dans inject.js ET background.js', `${!!bi} ${!!bb}`);
    dit(!!bi && bi === bb, 'texte pour texte le même (une règle, deux exécutions)');
  });

  // La page d'une conversation : données INVENTÉES.
  const UUID_CONV = '1f0e2d3c-aaaa-4bbb-8ccc-0123456789ab';
  const UUID_PHISH = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const SECRETS = ['secret-msg-api', 'secret-msg-route', 'secret-ws', 'secret-next', 'SECRETTOKEN', 'acheteur@exemple.fr', UUID_CONV, UUID_PHISH, '12345678', '23052006117', '4444444'];
  console.log('\n── C2. La page d’une conversation (VRAI inject.js + content.js)');
  await essaie('C2', async () => {
    const pc = await ctx.newPage();
    const json = (o, st = 200) => ({ status: st, contentType: 'application/json; charset=utf-8', body: JSON.stringify(o) });
    await pc.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>page</body></html>' }));
    await pc.route('https://www.vinted.fr/inbox/12345678', (r) => r.fulfill({ status: 200, contentType: 'text/html',
      body: '<html><body><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { conversation: { messages: [{ body: 'secret-next' }] } } } }) + '</script>conversation</body></html>' }));
    await pc.route(`**/api/v2/conversations/${UUID_CONV}**`, (r) => r.fulfill(json({ conversation: { id: 98765432, messages: [{ id: 1, entity_type: 'message', body: 'secret-msg-api', created_at_ts: 1700000000 }] } })));
    await pc.route('**/api/v2/conversations/12345678/replies**', (r) => r.fulfill(json({ reply: { id: 77, body: 'secret-msg-api' } })));
    await pc.route('**/api/v2/conversations/12345678?**', (r) => r.fulfill(json({ conversation: { id: 12345678, messages: [{ id: 2, entity_type: 'message', body: 'secret-msg-api' }] } })));
    await pc.route('**/inbox-messaging/v1/threads/12345678/items**', (r) => r.fulfill(json({ data: { thread: { messages: [{ id: 5, text: 'secret-msg-route', created_at: '2026-10-29T10:00:00Z', author: { id: 4444444, login: 'acheteur@exemple.fr' } }] } } })));
    await pc.route(`**/content-detection-tools/api/v1/phishing/educations/safety-passive-reminder/${UUID_PHISH}/status**`, (r) => r.fulfill(json({ shown: false })));
    await pc.route('**/escrow-orders/api/v2/escrow-orders/23052006117**', (r) => r.fulfill(json({ escrow_order: { id: 23052006117, status: 'paid', buyer: { email: 'acheteur@exemple.fr' } } })));
    await pc.route('https://pub.exemple.org/**', (r) => r.fulfill(json({ messages: [{ body: 'secret-msg-route' }] })));
    if (typeof pc.routeWebSocket === 'function') {
      await pc.routeWebSocket(/wss:\/\/www\.vinted\.fr\/cable/, (ws) => {
        setTimeout(() => { try { ws.send(JSON.stringify({ type: 'welcome' })); ws.send(JSON.stringify({ identifier: 'x', message: { messages: [{ id: 9, body: 'secret-ws', created_at_ts: 1 }] } })); } catch (_) {} }, 150);
      });
    }
    await pc.goto('https://www.vinted.fr/inbox/12345678', { waitUntil: 'domcontentloaded' });
    await pc.evaluate(() => { window.__recu = []; window.chrome = { runtime: { getURL: (f) => 'about:blank#' + f, sendMessage: (m) => { window.__recu.push(m); } } }; });
    await pc.addScriptTag({ content: SRC });
    await pc.addScriptTag({ content: RELAIS });
    await pc.evaluate(async (u) => {
      const ok = async (f) => { try { await f(); } catch (_) {} };
      await ok(() => fetch(`/api/v2/conversations/${u.conv}`).then((r) => r.text()));
      await ok(() => fetch('/api/v2/conversations/12345678/replies', { method: 'POST', body: JSON.stringify({ body: 'secret-msg-api' }) }).then((r) => r.text()));
      await ok(() => fetch('/api/v2/conversations/12345678?page=1').then((r) => r.text()));
      await ok(() => fetch('/inbox-messaging/v1/threads/12345678/items?_rsc=abc').then((r) => r.text()));
      await ok(() => fetch(`/content-detection-tools/api/v1/phishing/educations/safety-passive-reminder/${u.phish}/status`).then((r) => r.text()));
      await new Promise((res) => { const x = new XMLHttpRequest(); x.open('GET', '/escrow-orders/api/v2/escrow-orders/23052006117'); x.onloadend = res; x.onerror = res; x.send(); });
      await ok(() => fetch('https://pub.exemple.org/pixel').then((r) => r.text()));
      try { window.__ws = new WebSocket('wss://www.vinted.fr/cable?token=SECRETTOKEN'); } catch (_) {}
    }, { conv: UUID_CONV, phish: UUID_PHISH });
    await pc.waitForTimeout(6500);
    const recu = await pc.evaluate(() => window.__recu || []);
    await pc.close();
    // 1. la capture des conversations
    const harv = recu.filter((m) => m && m.kind === 'harvest' && m.type === 'conversation');
    dit(harv.some((m) => m.id === UUID_CONV), 'une conversation chargée par son UUID est captée (type conversation, l’UUID transmis au fond)', JSON.stringify(harv.map((m) => m.id)));
    dit(!harv.some((m) => /\/replies/.test(m.url || '')), 'un sous-chemin (…/replies) n’est plus pris pour une conversation', JSON.stringify(harv.map((m) => m.url)));
    dit(harv.some((m) => m.id === '12345678'), 'l’autre sens : une conversation par id numérique reste captée', JSON.stringify(harv.map((m) => m.id)));
    // 2. le relevé
    const vus = recu.filter((m) => m && m.kind === 'seen_urls');
    const der = vus[vus.length - 1] || {};
    const conv = [...vus].reverse().find((m) => m.conversation) || {};
    const rel = conv.conversation || {};
    const req = rel.req || {};
    const cleRoute = Object.keys(req).find((k) => /inbox-messaging\/v1\/threads\/\{id\}\/items/.test(k));
    dit(!!cleRoute, 'une requête HORS /api/ de la page d’une conversation est relevée (méthode, chemin normalisé)', JSON.stringify(Object.keys(req)));
    const fm = cleRoute && req[cleRoute].messages;
    dit(!!(fm && fm.chemin === 'data.thread.messages' && fm.n === 1 && fm.cles && fm.cles.text === 'string' && fm.cles['author.id'] === 'number'),
      'et la FORME de sa liste de messages : où, combien, les clés et leur type', JSON.stringify(fm));
    dit(!!(cleRoute && req[cleRoute].st === 200 && /json/.test(req[cleRoute].ct || '')), 'avec son statut et son type de contenu', cleRoute ? JSON.stringify({ st: req[cleRoute].st, ct: req[cleRoute].ct }) : '');
    const cleEscrow = Object.keys(req).find((k) => /escrow-orders\/\{id\}/.test(k));
    dit(!!(cleEscrow && req[cleEscrow].tete && !req[cleEscrow].messages), 'une réponse sans messages (escrow) : sa forme de tête, aucune liste de messages inventée', cleEscrow ? JSON.stringify(req[cleEscrow]) : JSON.stringify(Object.keys(req)));
    dit(!Object.keys(req).some((k) => /exemple\.org/.test(k)), 'un autre site (publicité) n’est pas relevé');
    const canal = Object.entries(rel.canaux || {}).find(([k]) => /^WS www\.vinted\.fr\/cable$/.test(k));
    dit(!!canal, 'l’ouverture d’une socket est relevée (hôte et chemin, jamais la requête)', JSON.stringify(Object.keys(rel.canaux || {})));
    dit(!!(canal && canal[1].messages && canal[1].messages.chemin === 'message.messages' && canal[1].trames >= 2), 'et une trame qui porte des messages : sa forme, et combien de trames', JSON.stringify(canal && canal[1]));
    dit(!!(rel.next && rel.next.nextData === true && rel.next.messages === true), 'les données Next de la page : présentes, et elles parlent de messages (oui/non)', JSON.stringify(rel.next));
    dit(Object.keys(rel.pages || {}).some((k) => k === '/inbox/{id}'), 'la page de la conversation elle-même est notée (normalisée)', JSON.stringify(Object.keys(rel.pages || {})));
    // 3. les UUID ne passent plus en clair
    const cles = Object.keys(der.reponses || {});
    dit(cles.some((k) => /safety-passive-reminder\/\{uuid\}\/status/.test(k)), 'le contrôle anti-hameçonnage : son UUID devient {uuid}', JSON.stringify(cles.filter((k) => /phishing/.test(k))));
    // 4. la confidentialité : aucune valeur, aucun identifiant réel
    const brut = JSON.stringify(vus);
    const fuites = SECRETS.filter((x) => brut.includes(x));
    dit(fuites.length === 0, 'rien ne fuit dans le relevé : ni message, ni login, ni jeton, ni identifiant réel', fuites.join(', '));
  });

  console.log('\n── C3. Le fond (VRAI background.js) : rangée sous l’id NUMÉRIQUE, et un relevé qui garde le plus récent');
  await essaie('C3', async () => {
    const { faireFond } = require('./_fond-vm.cjs');
    const corps = (id, extra = {}) => JSON.stringify({ conversation: Object.assign({ id, messages: [{ id: 1, entity_type: 'message', body: 'bonjour', created_at_ts: 1700000000 }] }, extra) });
    // a. par UUID, la réponse porte l'id numérique
    const la = {};
    const fa = faireFond({ src: BGF, lignes: la });
    await fa.ctx.storeHarvest('www.vinted.fr', 'conversation', UUID_CONV, corps(98765432), `https://www.vinted.fr/api/v2/conversations/${UUID_CONV}`, null, 'GET', 200);
    dit(!!la.harvest_111_conv_98765432, 'la conversation lue par UUID est rangée sous son id NUMÉRIQUE (harvest_111_conv_98765432)', JSON.stringify(Object.keys(la)));
    dit(!Object.keys(la).some((k) => k.includes(UUID_CONV)), 'jamais une ligne sous l’UUID', JSON.stringify(Object.keys(la)));
    // b. par UUID, sans id numérique lisible
    const lb = {};
    const fb = faireFond({ src: BGF, lignes: lb });
    await fb.ctx.storeHarvest('www.vinted.fr', 'conversation', UUID_CONV, corps('abc'), `https://www.vinted.fr/api/v2/conversations/${UUID_CONV}`, null, 'GET', 200);
    dit(!Object.keys(lb).some((k) => /_conv_/.test(k)), 'sans id numérique dans la réponse : rien n’est rangé (mieux vaut un blanc qu’un faux)', JSON.stringify(Object.keys(lb)));
    // c. par id numérique, la réponse en porte un autre
    const lc = {};
    const fc = faireFond({ src: BGF, lignes: lc });
    await fc.ctx.storeHarvest('www.vinted.fr', 'conversation', '12345678', corps(87654321), 'https://www.vinted.fr/api/v2/conversations/12345678', null, 'GET', 200);
    dit(!Object.keys(lc).some((k) => /_conv_/.test(k)), 'une réponse qui porte un AUTRE id que l’adresse n’est pas rangée', JSON.stringify(Object.keys(lc)));
    // d. l'autre sens : par id numérique, la même identité
    const ld = {};
    const fd = faireFond({ src: BGF, lignes: ld });
    await fd.ctx.storeHarvest('www.vinted.fr', 'conversation', '12345678', corps(12345678), 'https://www.vinted.fr/api/v2/conversations/12345678', null, 'GET', 200);
    dit(!!ld.harvest_111_conv_12345678, 'l’autre sens : la conversation par id numérique est rangée comme avant', JSON.stringify(Object.keys(ld)));
    // e. le relevé : 400 clés anciennes + des UUID en clair, puis une clé neuve
    const vieux = {};
    for (let i = 0; i < 400; i++) vieux[`GET /api/v2/vieux_${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`] = { st: 200, n: 1, at: new Date(Date.now() - 86400000 * 3 - i * 1000).toISOString() };
    vieux[`GET /content-detection-tools/api/v1/phishing/educations/safety-passive-reminder/${UUID_PHISH}/status`] = { st: 200, n: 1, at: new Date(Date.now() - 86400000).toISOString() };
    vieux['GET /content-detection-tools/api/v1/phishing/educations/safety-passive-reminder/9a8b7c6d-1111-4222-8333-444455556666/status'] = { st: 200, n: 1, at: new Date(Date.now() - 86400000 + 1000).toISOString() };
    const le = { harvest_111_seen_urls: { uid: '111', paths: ['/api/v2/vieux'], reponses: vieux } };
    const fe = faireFond({ src: BGF, lignes: le });
    await fe.ctx.storeSeenUrls('www.vinted.fr', ['/inbox-messaging/v1/threads/{id}/items'], { 'GET /inbox-messaging/v1/threads/{id}/items': { st: 200, n: 1, at: new Date().toISOString() } },
      { req: { 'GET /inbox-messaging/v1/threads/{id}/items': { st: 200, ct: 'application/json', n: 1, at: new Date().toISOString(), messages: { chemin: 'data.thread.messages', n: 1, cles: { text: 'string' } } } }, canaux: {}, pages: { '/inbox/{id}': { n: 1, at: new Date().toISOString() } }, next: { nextData: true, nextF: false, messages: true } });
    const de = (le.harvest_111_seen_urls || {});
    const rk = Object.keys(de.reponses || {});
    dit(rk.includes('GET /inbox-messaging/v1/threads/{id}/items'), 'une clé NEUVE est gardée, même avec 400 clés anciennes (elle était perdue)', `${rk.length} clés`);
    dit(rk.length <= 400, 'et le relevé reste borné à 400 réponses', String(rk.length));
    dit(!rk.some((k) => /[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)) && rk.filter((k) => /safety-passive-reminder\/\{uuid\}/.test(k)).length === 1, 'les UUID d’avant sont fondus en une seule clé {uuid}', JSON.stringify(rk.filter((k) => /phishing/.test(k))));
    dit(!!(de.conversation && de.conversation.req && de.conversation.req['GET /inbox-messaging/v1/threads/{id}/items'] && de.conversation.req['GET /inbox-messaging/v1/threads/{id}/items'].messages), 'le relevé de la page d’une conversation est rangé avec la ligne du diagnostic', JSON.stringify(de.conversation || null).slice(0, 200));
    // f. une forme déjà vue n'est jamais perdue par un passage qui ne l'a pas relue
    await fe.ctx.storeSeenUrls('www.vinted.fr', [], {}, { req: { 'GET /inbox-messaging/v1/threads/{id}/items': { st: 200, ct: 'application/json', n: 3, at: new Date(Date.now() + 1000).toISOString() } }, canaux: {}, pages: {}, next: null });
    const df = (le.harvest_111_seen_urls || {}).conversation || {};
    dit(!!(df.req && df.req['GET /inbox-messaging/v1/threads/{id}/items'] && df.req['GET /inbox-messaging/v1/threads/{id}/items'].messages && df.req['GET /inbox-messaging/v1/threads/{id}/items'].n === 3), 'la forme des messages déjà vue est gardée quand un passage plus récent ne l’a pas relue', JSON.stringify(df.req || null).slice(0, 200));
    dit(!!(df.next && df.next.messages === true), 'les données Next d’avant sont gardées quand ce passage n’en dit rien', JSON.stringify(df.next));
    // g. lecture de la ligne ratée : rien n'est écrit
    const lg = { harvest_111_seen_urls: { uid: '111', paths: [], reponses: { 'GET /api/v2/x': { st: 200, n: 1, at: new Date().toISOString() } } } };
    const fg = faireFond({ src: BGF, lignes: lg, lectureKO: (u) => /_seen_urls/.test(u) });
    await fg.ctx.storeSeenUrls('www.vinted.fr', ['/api/v2/neuf'], { 'GET /api/v2/neuf': { st: 200, n: 1, at: new Date().toISOString() } }, null);
    dit(!fg.j.posts.some((ids) => ids.includes('harvest_111_seen_urls')), 'lecture de la ligne ratée ⇒ rien n’est réécrit (on n’efface pas le relevé)', JSON.stringify(fg.j.posts));
  });

  // ════════════════════════════════════════════════════════════════════════
  //  ⚠️⚠️ ET LE COMPTE VISÉ EST DANS LA LISTE NOIRE — C'EST LUI QUI L'A VU.
  //  Julien, 19 septembre : « je crois que ça ne va pas marcher car le compte
  //  shop cancale devait être ignoré par l'extension ». Il a raison de le
  //  demander : `shop_cancale` (uid 199082413) est dans `vrm_blocked_accounts`,
  //  la liste des comptes supprimés DÉFINITIVEMENT, et `captureDomain` refuse
  //  d'en enregistrer les jetons — c'est ce qui l'empêchait de « revenir tout
  //  le temps ».
  //  ⇒ Mesuré ici : cette liste ne porte QUE sur les jetons. Le mouchard, lui,
  //    ne lit que le cookie de session (`activeAccountId`) et n'a aucune raison
  //    de se taire — un chemin d'API n'est pas un jeton, et une ligne
  //    `harvest_{uid}_seen_urls` ne fait PAS réapparaître le compte dans l'app
  //    (elle lit la table `vinted_accounts`, jamais `app_data`).
  //  ⚠️ Ce contrôle est là pour que personne ne « complète » la liste noire un
  //    jour en l'étendant au diagnostic : ce serait rendre muet exactement le
  //    compte qu'on cherche à documenter.
  // ⛔ RENVERSÉ LE 16 OCTOBRE (5.180) — décision de Julien : « quand on
  //    supprime un compte, ça doit supprimer vraiment ». Un compte supprimé
  //    définitivement n'est plus capté DU TOUT, diagnostic compris.
  console.log('\n── Le compte est dans la liste noire : RIEN n’est plus relevé (16 octobre)');
  await essaie('un compte supprimé définitivement', async () => {
    const vm = require('vm');
    const BG = BG_SRC;
    const UID = '199082413';                       // shop_cancale, tel qu'il est en base
    const ecrits = [];
    const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
    const c = {
      console: { log() {}, warn() {}, error() {} },
      setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
      URL, TextDecoder, TextEncoder,
      btoa: (x) => Buffer.from(x, 'binary').toString('base64'), atob: (x) => Buffer.from(x, 'base64').toString('binary'),
      chrome: { runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 'banc' }), lastError: null, id: 'x' },
        alarms: { create() {}, onAlarm: { addListener() {} } }, cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
        downloads: { onCreated: { addListener() {} } }, action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
        tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
        storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } } },
      fetch: async (url, opts = {}) => {
        const u = metaVersData(String(url));
        const rep = (b, st = 200) => ({ ok: st < 400, status: st, json: async () => JSON.parse(b), text: async () => b, headers: { get: () => 'application/json' } });
        if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(u)) { try { ecrits.push(JSON.parse(opts.body || '[]')); } catch (_) {} return rep('[]', 201); }
        // La VRAIE liste noire de sa base, avec ce compte dedans.
        if (/id=eq\.vrm_blocked_accounts/.test(u)) return rep(JSON.stringify([{ data: { note: 'shop_cancale supprimé définitivement', uids: [UID], logins: ['shop_cancale'] } }]));
        if (/id=eq\.vrm_unblocked_accounts/.test(u)) return rep('[]');
        if (/_seen_urls/.test(u)) return rep(JSON.stringify([{ data: { uid: UID, paths: ['/api/v2/inbox'], reponses: {} } }]));
        return rep('[]');
      },
    };
    c.self = c; c.globalThis = c; c.window = undefined;
    vm.createContext(c); vm.runInContext(BG, c, { filename: 'background.js' });
    // Il est bien dans la liste noire — on le VÉRIFIE, on ne le suppose pas.
    const noirs = await c.blockedAccounts();
    dit(!!(noirs && noirs.has(UID)), 'le compte est bien dans la liste des supprimés définitivement',
      noirs ? JSON.stringify([...noirs]) : 'liste non lue');
    // Et malgré ça, le mouchard écrit.
    c.activeAccountId = async () => UID;
    await c.storeSeenUrls('www.vinted.fr', ['/parametres/donnees-personnelles'], { 'POST /api/v2/data_export': { st: 403, n: 1 } });
    const ligne = (ecrits.flat() || []).find((e) => e && e.id === `harvest_${UID}_seen_urls`);
    dit(!ligne, 'aucun relevé n’est écrit pour un compte supprimé définitivement', ligne ? 'écrit à tort' : '');
    // Et ses DONNÉES non plus (dressing, ventes) — la voie active comme la passive.
    c.activeAccountId = async () => UID;
    const r = await c.storeHarvestRow(UID, 'listings', { items: [{ id: 1, title: 'x' }], pagination: { total_entries: 1 } }, 'www.vinted.fr');
    await c.storeHarvest('www.vinted.fr', 'orders_sold', '', JSON.stringify({ my_orders: [{ transaction_id: 5, title: 'y' }] }));
    const donnees = (ecrits.flat() || []).filter((e) => e && /^harvest_199082413_/.test(String(e.id || '')));
    dit(r === 'ignore' && donnees.length === 0, 'ni son dressing ni ses ventes ne sont rangés', `${r} · ${donnees.map((e) => e.id).join(',')}`);
    // ⚠️ L'AUTRE MOITIÉ : les JETONS, eux, ne doivent toujours PAS être écrits.
    //    Sans ce contrôle, « faire marcher le diagnostic » pourrait ressusciter
    //    le compte — c'est exactement ce qu'il ne veut pas.
    const jetons = (ecrits.flat() || []).some((e) => e && (e.vinted_user_id || e.access_token));
    dit(!jetons, 'et AUCUN jeton n’est enregistré : le compte ne réapparaît pas dans l’app');
  });

  try { fs.unlinkSync(BGF); } catch (_) {}
  await ctx.close(); await nav.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : `✅ ${ok} contrôles : son clic me dira l’endpoint ET si le serveur refuse.`}`);
  process.exit(ko ? 1 : 0);
})();
