// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  « OBSERVER VINTED (10 MIN) » NE GARDE AUCUNE VALEUR (24 nov., ext. 5.440.3)
//
//  Julien veut voir le chemin que prend la page Vinted quand il envoie, à la main ou avec un autre outil, un message
//  ou une offre à un favori. L'extension note une FRISE de FORMES (pages, requêtes, clics, cloche). Ce banc sert une
//  page vinted.fr remplie de VRAIES valeurs (un pseudo, un message tapé, un e-mail dans l'adresse, des identifiants,
//  un uuid de conversation, un jeton dans l'en-tête et le cookie, un texte d'acheteur dans la réponse), charge le VRAI
//  content.js + le VRAI inject.js (Chromium), joue les gestes (clics vrais et de script, frappe dans le champ,
//  requêtes fetch et XHR), puis passe ce que content.js a relayé au VRAI background.js (`_fond-vm.cjs`) jusqu'à la
//  ligne `observation_vinted_{compte}_{navigateur}` écrite dans la fausse base. On juge :
//   A. la règle `<observation-regle>` est la MÊME, texte pour texte, dans la page et dans le fond ;
//   B. la frise relayée par la page porte chaque sorte (page, req, clic, notifs, cloche) — un banc qui ne garderait
//      rien passerait sinon les contrôles d'absence ;
//   C. AUCUNE valeur dans ce que la page relaie ;
//   D. AUCUNE valeur dans la ligne écrite par le fond ; le fond rebâtit (un champ inconnu tombe) ;
//   E. la page n'a envoyé aucune requête de plus (on ne fait que regarder) ; éteinte, elle ne note plus rien.
//  Mutations (§6.1, `--mutation nom`, `--mutation ?` pour la liste) : chacune réaffaiblit UNE règle ⇒ rouge.
//  Données INVENTÉES (dépôt public).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
const { faireFond } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
let INJ = fs.readFileSync(path.join(EXT, 'inject.js'), 'utf8');
let REL = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
let BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');

const DEUX = (de, vers) => [['inject', de, vers], ['bg', de.replace(/^ {2}/gm, ''), vers.replace(/^ {2}/gm, '')]];
const MUTATIONS = {
  // une valeur de paramètre d'adresse est gardée telle quelle (l'e-mail, l'identifiant)
  'valeur-parametre': DEUX(`    if (/^\\d+$/.test(x)) return '{id}';`, `    return x;`),
  // le morceau d'adresse après un identifiant (/member/{id}-pseudo) n'est plus effacé
  slug: DEUX(`    if (/^\\{id\\}[-_.]/.test(x)) return '{id}-{slug}';`, ``),
  // un nom accessible est gardé même s'il n'est pas fait de mots d'interface
  aria: DEUX(`    if (!mots.length || mots.length > 5 || !mots.every((w) => OBS_MOTS.has(w))) return '{texte}';`, ``),
  // la page relaie la VALEUR d'un champ du corps au lieu de son type (le fond, lui, la refuse : C rougit, D tient)
  'corps-valeur': [['inject', `        else out.push((pre || '(racine)').slice(0, 80) + ':' + typeDe(v));`, `        else out.push((pre || '(racine)').slice(0, 80) + ':' + String(v));`]],
  // la page relaie le TEXTE de l'élément cliqué (le fond le jette : C rougit, D tient)
  'texte-clic': [['inject', `      const e = { k: 'clic', conf: ev.isTrusted === true, tag: String(el.localName || '').slice(0, 20) };`, `      const e = { k: 'clic', conf: ev.isTrusted === true, tag: String(el.localName || '').slice(0, 20), texte: String(el.textContent || el.value || '') };`]],
  // le fond garde l'entrée telle qu'elle arrive (plus rebâtie) — avec « texte-clic », D rougit aussi
  'fond-brut': [['bg', `      const x = entreeObservation(e, s.onglets[tab]);`, `      const x = Object.assign({}, e, { t: Number(e.t) });`], ['bg', `  const e2 = ev.map((x) => entreeObservation(x, x && x.o)).filter(Boolean);`, `  const e2 = ev;`], ['inject', `      const e = { k: 'clic', conf: ev.isTrusted === true, tag: String(el.localName || '').slice(0, 20) };`, `      const e = { k: 'clic', conf: ev.isTrusted === true, tag: String(el.localName || '').slice(0, 20), texte: String(el.textContent || el.value || '') };`]],
  // la page ne s'éteint plus à l'heure de fin
  'sans-fin': [['inject', `  const obsActif = () => obsFin > 0 && Date.now() < obsFin;`, `  const obsActif = () => obsFin > 0;`]],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutations : ${Object.keys(MUTATIONS).join(', ')}`); process.exit(MUT === '?' ? 0 : 2); }
  const F = { inject: INJ, bg: BG };
  for (const [f, de, vers] of MUTATIONS[MUT]) { const n = F[f].split(de).length - 1; if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${f}`); process.exit(2); } F[f] = F[f].replace(de, vers); }
  INJ = F.inject; BG = F.bg;
  console.log(`(mutation « ${MUT} »)`);
}

let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 700) : ''}`); } };

// Les VRAIES valeurs servies (inventées, mais de la forme des vraies).
const PSEUDO = 'lea_du_92', PSEUDO2 = 'marco.vintage', MSG = 'Bonjour Léa ta paire est toujours dispo pour toi', REP_TXT = 'Merci beaucoup je réfléchis';
const EMAIL = 'julien.revente@exemple.fr', JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50X2lkIjoxMTF9.c2lnbmF0dXJlc2VjcmV0ZQ', CSRF = 'csrf-9f8e7d6c5b4a', COOKIE = 'cookievaleur7781';
const UUID = '3c9d7e1a-5b2f-4c8d-9e0a-7f6b5c4d3e2a', ITEM = '91847362', USER = '48213377', TX = '15077788899', IBAN = 'FR7630006000011234567890189';
const SECRETS = [PSEUDO, PSEUDO2, MSG, 'Bonjour', REP_TXT, EMAIL, 'julien.revente', JWT, 'eyJhbGci', CSRF, COOKIE, UUID, ITEM, USER, TX, IBAN, '45.50', 'Paris 11'];

(async () => {
  console.log('── A. une règle, deux exécutions');
  const bloc = (t) => { const i = t.indexOf('// <observation-regle>'), j = t.indexOf('// </observation-regle>'); return i >= 0 && j > i ? t.slice(i, j).split('\n').map((l) => l.trim()).join('\n') : null; };
  const bi = bloc(INJ), bb = bloc(BG);
  dit(!!bi && !!bb && bi === bb, 'le bloc <observation-regle> est le même dans inject.js et background.js', `${!!bi} ${!!bb}`);

  console.log('\n── F. VRM dit la frise en phrases simples (src/observationVinted.js, la vraie règle)');
  {
    const { pathToFileURL } = require('url');
    const R = path.join(__dirname, '..');
    const I = await import(pathToFileURL(path.join(R, 'src', 'i18n', 'index.js')).href);
    I.ajouterSourceApp((await import(pathToFileURL(path.join(R, 'src', 'i18n', 'langues', 'fr.js')).href)).default);
    const O = await import(pathToFileURL(path.join(R, 'src', 'observationVinted.js')).href);
    const t0 = 1795000000000;
    const fr = O.frisePhrases([
      { t: t0, k: 'clic', conf: true, tag: 'button', aria: 'notifications', entete: { i: 2, n: 3 } },
      { t: t0 + 1, k: 'notifs', n: 12, formes: ['vintedfr://messaging?item_id={id}&user_id={id}&portal=fr'], page: 1 },
      { t: t0 + 2, k: 'cloche', lignes: 12, pourquoi: 'clic', formes: [] },
      { t: t0 + 3, k: 'clic', conf: true, tag: 'a', href: '/items/{id}/want_it/new?offering_id={id}' },
      { t: t0 + 4, k: 'req', m: 'POST', h: 'api.vinted.fr', p: '/messaging/main/inquiries', st: 201 },
      { t: t0 + 5, k: 'page', p: '/inbox/{uuid}', o: 2 },
      { t: t0 + 6, k: 'req', m: 'POST', h: 'api.vinted.fr', p: '/messaging/main/conversations/{uuid}/replies', st: 201 },
      { t: t0 + 7, k: 'req', m: 'POST', h: '', p: '/api/v2/transactions/{id}/offers', st: 429 },
      { t: t0 + 8, k: 'clic', conf: false, tag: 'button', aria: '{texte}', tid: 'send-button' },
      { t: t0 + 9, k: 'mouchard' },
    ]).map((x) => x.texte);
    const attendu = ['ouvre la cloche', 'liste de la cloche lue · 12 lignes · liens messaging (app)', 'cloche ouverte · 12 lignes visibles', 'clic sur la ligne (lien want_it)', 'POST api.vinted.fr messaging/main/inquiries 201', 'page /inbox/{uuid} · onglet 2', 'POST api.vinted.fr messaging/main/conversations/{uuid}/replies 201', 'POST transactions/{id}/offers 429', 'clic sur send-button (pas de toi : script)'];
    dit(JSON.stringify(fr) === JSON.stringify(attendu), 'la frise en français simple, dans l’ordre ; une sorte inconnue n’est pas dite', JSON.stringify(fr));
    const rouge = O.frisePhrases([{ t: t0, k: 'req', m: 'POST', h: '', p: '/x', st: 403 }, { t: t0, k: 'req', m: 'GET', h: '', p: '/y', st: 0 }]).map((x) => x.ton);
    dit(JSON.stringify(rouge) === '["refus","refus"]', 'un refus (≥ 400) ou une requête sans réponse est marqué', JSON.stringify(rouge));
  }

  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ctx = await nav.newContext();
  const pg = await ctx.newPage();
  const requetes = [];
  const json = (o, st = 200) => ({ status: st, contentType: 'application/json; charset=utf-8', body: JSON.stringify(o) });
  const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <header><a href="/" aria-label="Vinted">Vinted</a><a href="/inbox" aria-label="Messages">✉</a>
      <button id="cloche" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">🔔</button>
      <a id="moi" href="/member/${USER}-${PSEUDO}" title="${PSEUDO}">${PSEUDO}</a></header>
    <div id="pan" hidden><a id="ligne" data-testid="notification-item-${ITEM}" aria-label="${PSEUDO} a ajouté ton article à ses favoris" href="/inbox/want_it/new?receiver_id=${USER}&item_id=${ITEM}&email=${encodeURIComponent(EMAIL)}">${PSEUDO} a ajouté ton article à ses favoris</a>
      <a data-testid="notification-item" href="/items/${ITEM}-nike-air-${PSEUDO2}/want_it/new?offering_id=${USER}">${PSEUDO2} aime ton article</a>
      <a href="/member/notifications">Voir tout</a></div>
    <main><textarea id="champ" data-testid="conversation-message-input" aria-label="${MSG}" placeholder="Écris"></textarea>
      <input id="iban" name="iban" value="${IBAN}"><button id="env" type="button">Envoyer</button>
      <a id="lienconv" href="/inbox/${UUID}?token=${JWT}#${CSRF}">conversation</a></main>
    <script>document.cookie = 'access_token_web=${JWT}; path=/'; document.cookie = 'v_sid=${COOKIE}; path=/';</script>
  </body></html>`;
  await pg.route('**/*', (r) => { requetes.push(r.request().method() + ' ' + r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }); });
  await pg.route('https://api.vinted.fr/inbox-notifications/v1/notifications**', (r) => { requetes.push('GET ' + r.request().url()); return r.fulfill(json({ notifications: [
    { id: 'n1', body: `${PSEUDO} a ajouté ton article à ses favoris`, link: `vintedfr://messaging?item_id=${ITEM}&user_id=${USER}&portal=fr`, user_id: Number(USER), entry_type: 20, subject_id: Number(ITEM) },
    { id: 'n2', body: `${PSEUDO2} aime`, link: `/items/${ITEM}/want_it/new?offering_id=${USER}&login=${PSEUDO2}`, user_id: 1234567, entry_type: 20 }], pagination: { current_page: 1, total_pages: 3, per_page: 20 } })); });
  await pg.route('https://api.vinted.fr/messaging/main/inquiries', (r) => { requetes.push('POST ' + r.request().url()); return r.fulfill(json({ inquiry_id: 'inq-' + TX, transaction_id: Number(TX), conversation_id: UUID, read_after_write_token: JWT }, 201)); });
  await pg.route(`https://api.vinted.fr/messaging/main/conversations/${UUID}/replies`, (r) => { requetes.push('POST ' + r.request().url()); return r.fulfill(json({ id: 'm1', data: { content: MSG }, conversation_id: UUID, sender: { login: PSEUDO } }, 201)); });
  await pg.route(`https://www.vinted.fr/api/v2/conversations/${TX}**`, (r) => { requetes.push('GET ' + r.request().url()); return r.fulfill(json({ conversation: { id: Number(TX), opposite_user: { login: PSEUDO, email: EMAIL }, messages: [{ body: REP_TXT }] } })); });
  await pg.route('https://www.vinted.fr/api/v2/users/48213377/payouts', (r) => { requetes.push('POST ' + r.request().url()); return r.fulfill(json({ payout: { iban: IBAN, amount: '45.50' } })); });
  await pg.route('https://pub.exemple.org/**', (r) => { requetes.push('GET ' + r.request().url()); return r.fulfill(json({ email: EMAIL })); });
  await pg.goto(`https://www.vinted.fr/catalog?search_text=${encodeURIComponent(EMAIL)}&user_id=${USER}`, { waitUntil: 'domcontentloaded' });
  const FIN = Date.now() + 600000;
  await pg.evaluate((FIN) => {
    window.__recu = []; window.__ecoutes = [];
    const store = { vrmObservation: { actif: true, debut: Date.now() - 1000, fin: FIN } };
    window.__store = store;
    window.chrome = {
      runtime: { id: 'x', getURL: (f) => 'about:blank#' + f, sendMessage: (m, cb) => { window.__recu.push(m); if (typeof cb === 'function') cb(undefined); }, onMessage: { addListener() {} }, lastError: null },
      storage: { local: { get: (k, cb) => { const o = {}; for (const c of [].concat(k)) if (store[c] !== undefined) o[c] = store[c]; if (cb) cb(o); return Promise.resolve(o); }, set: (o, cb) => { const ch = {}; for (const c of Object.keys(o)) { ch[c] = { oldValue: store[c], newValue: o[c] }; store[c] = o[c]; } for (const f of window.__ecoutes) f(ch, 'local'); if (cb) cb(); return Promise.resolve(); } },
        onChanged: { addListener: (f) => window.__ecoutes.push(f) } },
    };
  }, FIN);
  await pg.addScriptTag({ content: REL });
  await pg.addScriptTag({ content: INJ });
  await pg.waitForTimeout(600);
  const avantGestes = requetes.length;
  // Les gestes : clic vrai sur la cloche (elle ouvre la liste et la page lit les notifications), clic de script,
  // la ligne, le champ et la frappe, Envoyer (la page envoie la conversation, le message, une lecture, un virement, un tiers).
  await pg.evaluate(() => {
    document.getElementById('cloche').addEventListener('click', async () => { const p = document.getElementById('pan'); p.hidden = !p.hidden; document.getElementById('cloche').setAttribute('aria-expanded', String(!p.hidden)); await fetch('https://api.vinted.fr/inbox-notifications/v1/notifications?page=1&per_page=20', { credentials: 'include', headers: { Authorization: 'Bearer ' + document.cookie } }).then((r) => r.text()); });
    document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a'); if (a) e.preventDefault(); }, true);
    document.getElementById('env').addEventListener('click', async () => {
      const t = document.getElementById('champ').value;
      await fetch('https://api.vinted.fr/messaging/main/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-9f8e7d6c5b4a' }, body: JSON.stringify({ item_id: '91847362', receiver_id: 48213377, initiator: 'lea_du_92' }) }).then((r) => r.text());
      history.pushState({}, '', '/inbox/3c9d7e1a-5b2f-4c8d-9e0a-7f6b5c4d3e2a?email=julien.revente%40exemple.fr');
      await fetch('https://api.vinted.fr/messaging/main/conversations/3c9d7e1a-5b2f-4c8d-9e0a-7f6b5c4d3e2a/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: t, photo_ids: [], meta: { login: 'lea_du_92', email: 'julien.revente@exemple.fr' } }) }).then((r) => r.text());
      await new Promise((ok) => { const x = new XMLHttpRequest(); x.open('GET', '/api/v2/conversations/15077788899?login=lea_du_92'); x.setRequestHeader('X-CSRF-Token', 'csrf-9f8e7d6c5b4a'); x.onloadend = ok; x.send(); });
      const fd = new FormData(); fd.append('iban', 'FR7630006000011234567890189'); fd.append('amount', '45.50');
      await fetch('/api/v2/users/48213377/payouts', { method: 'POST', body: fd }).then((r) => r.text());
      await fetch('https://pub.exemple.org/pixel?email=julien.revente%40exemple.fr').then((r) => r.text()).catch(() => {});
    });
  });
  await pg.click('#cloche'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.getElementById('cloche').click()); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.getElementById('cloche').click()); await pg.waitForTimeout(1200);
  await pg.click('#ligne'); await pg.click('#moi'); await pg.click('#lienconv');
  await pg.click('#champ'); await pg.keyboard.type(MSG, { delay: 2 });
  await pg.fill('#iban', IBAN);
  await pg.click('#env'); await pg.waitForTimeout(3500);
  await pg.mouse.wheel(0, 400); await pg.waitForTimeout(500);
  const relaye = (await pg.evaluate(() => window.__recu)).filter((m) => m && m.kind === 'observation');
  const ev = relaye.flatMap((m) => m.ev || []);
  const gestesRequetes = requetes.slice(avantGestes);

  console.log('\n── B. la frise porte chaque sorte');
  const sortes = new Set(ev.map((e) => e.k));
  for (const k of ['page', 'req', 'clic', 'notifs', 'cloche']) dit(sortes.has(k), `la page relaie des entrées « ${k} »`, [...sortes].join(','));
  dit(ev.some((e) => e.k === 'req' && e.p === '/messaging/main/conversations/{uuid}/replies' && (e.corps || []).includes('content:string') && (e.corps || []).includes('meta.login:string')), 'le corps envoyé : ses CLÉS et leur type', JSON.stringify(ev.filter((e) => e.k === 'req').map((e) => [e.p, e.corps])).slice(0, 500));
  dit(ev.some((e) => e.k === 'req' && e.via === 'xhr' && e.p === '/api/v2/conversations/{id}' && e.rep && e.rep['conversation.opposite_user'] === 'object'), 'une requête XHR : la forme de la réponse (clés de tête et leur type)', JSON.stringify(ev.filter((e) => e.via === 'xhr')).slice(0, 400));
  dit(ev.some((e) => e.k === 'clic' && e.conf === true && e.aria === 'notifications' && e.entete && e.entete.i === 3 && e.entete.n === 4) && ev.some((e) => e.k === 'clic' && e.conf === false && e.aria === 'notifications'), 'la cloche : clic de lui (place 3 sur 4 dans l’en-tête) et clic de script (isTrusted false)', JSON.stringify(ev.filter((e) => e.k === 'clic').slice(0, 3)));
  dit(ev.some((e) => e.k === 'notifs' && e.n === 2 && e.tp === 3 && (e.formes || []).includes('vintedfr://messaging?item_id={id}&user_id={id}&portal=fr')), 'la liste de la cloche : nombre, pages, forme des liens', JSON.stringify(ev.filter((e) => e.k === 'notifs')));
  dit(ev.some((e) => e.k === 'page' && e.p === '/inbox/{uuid}' && JSON.stringify(e.q) === '["email"]'), 'l’adresse de la page : forme, clés de la requête seules', JSON.stringify(ev.filter((e) => e.k === 'page')));
  dit(!ev.some((e) => e.k === 'req' && /exemple|tiers/.test(JSON.stringify(e))), 'une requête vers un autre site n’est pas notée');

  console.log('\n── C. aucune valeur dans ce que la page relaie');
  const brutPage = JSON.stringify(relaye);
  const fuitesPage = SECRETS.filter((x) => brutPage.includes(x));
  dit(!fuitesPage.length, 'ni pseudo, ni message tapé, ni e-mail, ni identifiant, ni uuid, ni jeton, ni cookie, ni IBAN', fuitesPage.join(' | '));
  dit(!ev.some((e) => e.k === 'clic' && (e.tag === 'textarea' || e.tag === 'input') && Object.keys(e).some((k) => !['k', 't', 'conf', 'tag', 'role', 'tid', 'aria', 'ouvert', 'popup', 'anc', 'entete', 'href', 'type'].includes(k))), 'un clic dans un champ : aucun champ en plus (jamais sa valeur)');

  console.log('\n── D. la ligne écrite par le VRAI fond');
  const BGF = path.join(os.tmpdir(), `vrm-obs-bg-${process.pid}.js`); fs.writeFileSync(BGF, BG);
  const F = faireFond({ src: BGF, store: { vrmIdNavigateur: '0123456789abcdef' } });
  F.ctx.compteConnecte = async () => '111';
  try { fs.unlinkSync(BGF); } catch (_) {}
  const dem = await F.ctx.commandeObservation({ quoi: 'demarrer' });
  dit(dem && dem.actif === true, 'le fond allume l’observation', JSON.stringify(dem));
  const ds = F.store.vrmObservation; ds.debut = Math.min(...ev.map((e) => e.t)) - 1000; F.store.vrmObservation = ds;
  const sender = { tab: { id: 7, url: 'https://www.vinted.fr/inbox' }, url: 'https://www.vinted.fr/inbox', frameId: 0, id: 'x' };
  for (const m of relaye) await F.envoyer(Object.assign({}, m, { from: 'cancale-content', domain: 'www.vinted.fr', canal: 'sur' }), sender);
  // un message forgé avec des champs en plus, des formes fausses : le fond rebâtit
  await F.envoyer({ from: 'cancale-content', domain: 'www.vinted.fr', canal: 'sur', kind: 'observation', ev: [{ k: 'clic', t: Date.now(), tag: 'a', texte: MSG, href: `/member/${PSEUDO}`, aria: PSEUDO, tid: PSEUDO2 + ' x', conf: true }, { k: 'req', t: Date.now(), m: 'POST', h: 'pub.exemple.org', p: '/x', st: 200 }, { k: 'req', t: Date.now(), m: 'POST', h: '', p: `/api/v2/x?email=${EMAIL}`, st: 200, corps: [`${EMAIL}:string`, 'a.b:' + PSEUDO], rep: { [PSEUDO]: 'string', ok: IBAN } }, { k: 'mouchard', t: Date.now(), x: JWT }] }, sender);
  await new Promise((r) => setTimeout(r, 50));
  const w = await F.ctx.envoyerObservation();
  const id = Object.keys(F.lignes).find((k) => /^observation_vinted_111_0123456789abcdef$/.test(k));
  const d = id && F.lignes[id];
  dit(!!d && Array.isArray(d.ev) && d.ev.length >= ev.length, 'la ligne observation_vinted_111_{navigateur} est écrite avec la frise', `${id} · ${d && d.ev && d.ev.length} entrées · ${JSON.stringify(w).slice(0, 200)}`);
  const brut = JSON.stringify(d || {});
  const fuites = SECRETS.filter((x) => brut.includes(x));
  dit(!fuites.length, 'AUCUNE valeur dans la ligne (ni pseudo, message, e-mail, identifiant, uuid, jeton, cookie, IBAN)', fuites.join(' | '));
  dit(!!d && !d.ev.some((e) => e.texte !== undefined || e.k === 'mouchard') && !d.ev.some((e) => e.h === 'pub.exemple.org'), 'un champ inconnu, une sorte inconnue, un autre site : jetés par le fond');
  const forge = d && d.ev.find((e) => e.k === 'clic' && e.href === '/member/{x}');
  dit(!!forge && forge.aria === '{texte}' && forge.tid === '{x}', 'une forme fausse est refaite par le fond (lien, nom accessible, data-testid)', JSON.stringify(forge));

  console.log('\n── E. on ne fait que regarder');
  const attendues = ['inbox-notifications', 'inquiries', '/replies', '/api/v2/conversations/', '/payouts', 'pub.exemple.org'];
  dit(gestesRequetes.length === 8 && gestesRequetes.filter((r) => /inbox-notifications/.test(r)).length === 3 && gestesRequetes.every((r) => attendues.some((a) => r.includes(a))), 'la page n’a envoyé que ses propres requêtes — 3 lectures de la cloche, 5 d’« Envoyer » (aucune de l’observation)', gestesRequetes.join(' | '));
  await pg.evaluate(() => window.chrome.storage.local.set({ vrmObservation: { actif: false, fin: 0 } }));
  await pg.waitForTimeout(300);
  const n0 = (await pg.evaluate(() => window.__recu)).filter((m) => m && m.kind === 'observation').length;
  await pg.click('#cloche'); await pg.waitForTimeout(2200);
  const n1 = (await pg.evaluate(() => window.__recu)).filter((m) => m && m.kind === 'observation').length;
  dit(n1 === n0, 'éteinte : plus rien n’est noté', `${n0} → ${n1}`);
  // L'heure de fin passée : la page s'éteint seule.
  await pg.evaluate(() => window.chrome.storage.local.set({ vrmObservation: { actif: true, fin: Date.now() + 1500 } }));
  await pg.waitForTimeout(2200);
  const n2 = (await pg.evaluate(() => window.__recu)).filter((m) => m && m.kind === 'observation').length;
  await pg.click('#cloche'); await pg.waitForTimeout(2200);
  const n3 = (await pg.evaluate(() => window.__recu)).filter((m) => m && m.kind === 'observation').length;
  dit(n3 === n2, 'l’heure de fin passée : la page s’éteint seule', `${n2} → ${n3}`);

  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} audit-observation-vinted : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack)); process.exit(1); });
