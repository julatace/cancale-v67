// ════════════════════════════════════════════════════════════════════════════
//  LES MOYENNES DE LA REVUE DE L'EXTENSION (ext. 5.362, second agent), JOUÉES
//  sur le vrai code : `background.js` dans `_fond-vm.cjs`, le vrai `lbc-relay.js`
//  dans une page imitée (un script de la page qui forge un résultat), la vraie
//  règle de cadre de `popup.js`. Numéros = ceux de la revue
//  (`docs/passation/robustesse/extension.md`, branche claude/agent2-robustesse).
//  Usage : node scripts/audit-extension-moyennes.cjs [--ext dossier] [--prouve]
//  `--ext` : un autre dossier d'extension (preuve sur la branche de départ, §6.1) ;
//  `--prouve` : chaque mutation (règle réaffaiblie) doit rendre SON rouge.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(__dirname, '..', 'vinted-sync-extension');
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = '111';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };
const LBC = 'aaaa1111-0000-4000-8000-000000000001';      // un compte Leboncoin (inventé)
const AD = '3290000001';

async function auditer(dossier) {
  const BG = path.join(dossier, 'background.js');
  const out = [];
  const dit = (ok, m, d) => out.push({ ok: !!ok, m, d: d === undefined ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, `${nom} — a levé : ${String(e && e.message || e).slice(0, 160)}`); } };
  const fond = (o = {}) => faireFond(Object.assign({ src: BG }, o));
  const actions = (f, u = UID) => ((f.store.vrmActions || {})[u] || []).length;

  // ── 27 : la porte d'entrée du moteur des offres ne prend aucune place ──
  await essaie('27', async () => {
    const f = fond();
    const r = await f.ctx.garde(UID, ACC, { compter: false });
    dit(r === null && actions(f) === 0, '27 la porte d’entrée d’un passage du moteur (compte, pause) ne prend AUCUNE place — seul le geste compte la sienne', { r, n: actions(f) });
  });
  // ── 28 / 29 : places justes dans executerPourApp ──
  await essaie('28', async () => {
    const f = fond();
    f.ctx.executerMessageFavori = async () => ({ ok: true, status: 200, json: { resultat: 'ignore' } });
    await f.ctx.executerPourApp({ method: 'POST', endpoint: '/vrm/favoris', uid: UID, body: {} }, { origin: 'https://vrm.center' });
    dit(actions(f) === 0, '28 un message à un favori ne prend pas une place de plus à la porte (il réserve lui-même ses 2-3 places)', { n: actions(f) });
  });
  await essaie('29', async () => {
    const f = fond();
    let n = 0; f.ctx.activeAccountId = async () => (++n === 1 ? UID : '222');
    const r = await f.ctx.executerPourApp({ method: 'POST', endpoint: '/api/v2/conversations/55/replies', uid: UID, body: { reply: { body: 'x' } } }, { origin: 'https://vrm.center' });
    dit(r && r.ok === false && actions(f) === 0 && !f.j.vinted.length, '29 compte basculé pendant l’attente : rien ne part ET la place prise à la porte est rendue', { r: r && r.code, n: actions(f), v: f.j.vinted.length });
  });
  // ── 30 / 32 : lecture de fond sans compte connu ──
  await essaie('30', async () => {
    const f = fond();
    f.ctx.activeAccountId = async () => null;
    const r = await f.ctx.gardeLecture(UID, ACC, 'photos');
    dit(r && r.ok === false && r.code === 'vinted-absent', '30/32 compte connecté inconnu : aucune lecture de fond (« pas su » ne vaut pas « oui »)', r);
  });
  // ── 33 : le budget de lecture est celui du compte ──
  await essaie('33', async () => {
    const t = Date.now();
    const f = fond({ lignes: { [`actions_compte_${UID}_aaaaaaaaaaaaaaaa`]: { uid: UID, nav: 'aaaaaaaaaaaaaaaa', ts: [], lec: Array.from({ length: 20 }, (_, i) => t - 1000 * (i + 1)) } } });
    const c = await f.ctx.compterLecture(UID);
    dit(c && c.ok === false, '33 un AUTRE Chrome a déjà lu 20 fois ce compte dans l’heure : ce Chrome ne lit plus (budget du compte)', c);
    const g = fond();
    await g.ctx.compterLecture(UID);
    const lignes = Object.keys(g.lignes).filter((k) => k.startsWith(`actions_compte_${UID}_`));
    dit(lignes.length === 1 && Array.isArray(g.lignes[lignes[0]].lec) && g.lignes[lignes[0]].lec.length === 1, '33 chaque lecture est publiée dans la ligne du navigateur (`lec`), lue par les autres', lignes.map((k) => g.lignes[k].lec));
  });
  // ── 34 / 37 : moisson plafonnée et sous verrou ──
  await essaie('37', async () => {
    const f = fond();
    let n = 0; f.ctx.pageActiveFetch = async () => { n++; await attendre(20); return true; };
    await Promise.all([f.ctx.runActive(), f.ctx.runActive(), f.ctx.runActive()]);
    dit(n === 1, '37 trois moissons demandées en même temps : UNE seule part', { n });
  });
  await essaie('34', async () => {
    const f = fond();
    let n = 0; f.ctx.pageActiveFetch = async () => { n++; return true; };
    for (let i = 0; i < 7; i++) await f.ctx.runActive();
    dit(n === 4, '34 la moisson a son plafond explicite : 4 par heure et par compte (7 demandées)', { n });
  });
  // ── 36 : une place de la file a une durée maximale ──
  await essaie('36', async () => {
    const f = fond();
    vm.runInContext('FILE_VINTED.maxMs = 40', f.ctx);
    const r = await Promise.race([f.ctx.requeteVinted('api', () => new Promise(() => {}), ACC), attendre(3000).then(() => 'bloque')]);
    const r2 = await Promise.race([f.ctx.requeteVinted('api', async () => ({ status: 200, ok: true }), ACC), attendre(3000).then(() => 'bloque')]);
    dit(r && r.delai === true && r.status === 0 && r2 && r2.ok === true, '36 un `executeScript` qui ne revient jamais ne bloque plus la file : place rendue (« incertain »), la requête suivante part', { r, r2 });
  });
  // ── 38 : un seul identifiant de navigateur ──
  await essaie('38', async () => {
    const f = fond();
    const ids = await Promise.all([f.ctx.idNavigateur(), f.ctx.idNavigateur(), f.ctx.idNavigateur()]);
    dit(new Set(ids).size === 1 && /^[0-9a-f]{16}$/.test(ids[0]) && f.store.vrmIdNavigateur === ids[0], '38 trois appels au premier lancement : UN identifiant, celui qui est rangé', ids);
  });
  // ── 39 / 40 : la ligne partagée ──
  await essaie('39', async () => {
    const f = fond({ ecritureKO: (id) => /^actions_compte_/.test(id) });
    await f.ctx.compterAction(UID);
    dit(f.j.diags.includes('actions_partagees_pas_ecrites'), '39 la ligne partagée pas écrite : c’est NOTÉ (les autres Chrome ne voient pas ces actions)', f.j.diags);
  });
  await essaie('40', async () => {
    const f = fond({ lectureKO: (u) => /actions_compte_/.test(u) });
    let ok = 0; for (let i = 0; i < 30; i++) { const c = await f.ctx.compterAction(UID); if (c && c.ok) ok++; }
    dit(ok === 25, '40 base muette sur les autres Chrome : CE Chrome n’en prend que 25 (jamais 50 + 50)', { ok });
  });
  // ── 41 / 42 : vrmCmds ──
  await essaie('41', async () => {
    const f = fond({ store: { vrmCmds: { 'bord:111:9001': { etape: 'generation', at: Date.now(), uid: UID, tx: '9001' } } } });
    const c = (await f.ctx.lireCmds())['bord:111:9001'];
    dit(c && c.etape === 'echec' && c.code === 'interrompu', '41 un bordereau « en cours » d’un worker mort n’est plus « en cours » : interrompu, dit', c);
  });
  await essaie('42', async () => {
    const f = fond();
    await Promise.all(Array.from({ length: 12 }, (_, i) => f.ctx.majCmd('job:' + i, { etape: 'file' })));
    const n = Object.keys(f.store.vrmCmds || {}).length;
    dit(n === 12, '42 douze mises à jour simultanées de `vrmCmds` : aucune perdue', { n });
  });
  // ── 46 : la pagination suit total_pages ──
  await essaie('46', async () => {
    const f = fond({ vinted: (e) => { const m = /page=(\d+)/.exec(e.chemin); const p = Number(m && m[1]); return /my_orders/.test(e.chemin) ? { status: 200, body: { my_orders: Array.from({ length: 20 }, (_, i) => ({ transaction_id: p * 100 + i })), pagination: { current_page: p, total_pages: 3, total_entries: 60 } } } : null; } });
    const r = await f.ctx.fetchAllOrders(ACC, 'sold', 8, {});
    dit(r && r.my_orders.length === 60, '46 Vinted plafonne à 20 par page et annonce 3 pages : les 3 pages sont lues (avant : la 1re seule, sans le dire)', { n: r && r.my_orders.length });
  });
  // ── 47 : un compte ignoré ──
  await essaie('47', async () => {
    const f = fond();
    f.ctx.compteNonCapte = async () => true;
    await f.ctx.storeWriteReq('www.vinted.fr', 'POST', '/api/v2/items/123/favourites', '{}');
    dit(!f.j.posts.length, '47 compte supprimé / ignoré : ses requêtes d’écriture ne sont plus rangées', f.j.posts);
  });
  // ── 48 : le profil maigre ──
  await essaie('48', async () => {
    const f = fond();
    const p = f.ctx.alleger('profile', { user: { id: 7, login: 'moi', email: 'e@exemple.test', real_name: 'Nom Réel', phone_number: '0600000000', birthday: '1990-01-01', default_address: { city: 'X' }, balance: 12, is_on_holiday: false, feedback_reputation: 1, business_account: { id: 3, legal_name: 'Société', address: 'rue' }, photo: { url: 'https://images1.vinted.net/p.jpg', thumbnails: [{ type: 'thumb100', url: 'https://images1.vinted.net/t.jpg' }] } } });
    const s = JSON.stringify(p);
    dit(!/Nom Réel|0600000000|1990-01-01|"city"|balance|Société|legal_name/.test(s) && p.user.login === 'moi' && p.user.email && p.user.photo && p.user.business_account && p.user.business_account.id === 3, '48 le profil est rangé MAIGRE : ni nom réel, ni téléphone, ni naissance, ni adresse, ni solde, ni données de la société', s);
  });
  // ── 49 : aucun morceau de corps dans le diagnostic ──
  await essaie('49', async () => {
    const src = lire(BG);
    const m = /async function echantillonRate\([^)]*\)\s*\{[\s\S]*?\n\}/.exec(src);
    const corps = m ? m[0].replace(/\/\/.*$/gm, '') : '';
    dit(!!corps && !/slice\(0,\s*160\)|\btete\s*:/.test(corps) && /formeEchantillon\(body\)/.test(corps), '49 l’échantillon d’une réponse ratée ne garde que sa FORME (jamais les 160 premiers caractères)', corps.slice(0, 200));
  });
  // ── 51 / 52 / 53 : Vinted, page d'annonce et réservation ──
  await essaie('51', async () => {
    const f = fond();
    await f.envoyer({ from: 'cancale-vcapture', action: 'saveDate', id: '5550001', ts: Date.now() - 864e5, text: 'il y a 1 jour' }, { tab: { id: 5, url: 'https://www.vinted.fr/items/5550001' }, url: 'https://www.vinted.fr/items/5550001' });
    await attendre(30);
    dit(!f.lignes.vinted_listing_dates, '51 la date d’une annonce qui n’est PAS à lui n’est pas rangée', f.lignes.vinted_listing_dates);
  });
  await essaie('52', async () => {
    const f = fond();
    const r = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.com' }, { tab: { id: 5 }, url: 'https://evil.exemple.test/' });
    dit(r && r.ok === false && r.raison === 'onglet', '52 le N° se réserve sur le compte de L’ONGLET Vinted — un domaine dicté par le message ne suffit pas', r);
  });
  await essaie('53', async () => {
    const f = fond({ store: { vrmNumResaOnglets: { 5: { numero: '7', at: Date.now(), uid: UID }, 6: { numero: '8', at: Date.now(), uid: UID, item: '123' } } } });
    await f.ctx.purgerResaOnglets(5);
    const l = f.store.vrmNumResaOnglets || {};
    dit(!l[5] && l[6], '53 l’onglet fermé perd sa réservation (une publication vue, pas encore rangée, reste)', l);
  });
  // ── 56 / 57 : Leboncoin dans les 50 actions du compte, et freiné ──
  const fondLbc = (store) => fond({ onglets: [{ id: 1, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }],
    lignes: { lbc_listings: { items: { [AD]: { id: AD, account: LBC, status: 'active' } } }, lbc_accounts: { accounts: {} } },
    store: Object.assign({ vrmLbcTransport: { 1: { source: 'prive', compte: 'lbc-account:' + LBC, at: Date.now() } } }, store) });
  await essaie('56', async () => {
    const t = Date.now();
    const f = fondLbc({ vrmActions: { ['lbc:' + LBC]: Array.from({ length: 50 }, (_, i) => t - 1000 * (i + 1)) } });
    const r = await f.ctx.pauseLbcDepuisApp({ id: AD });
    dit(r && r.accepte === false && r.code === 'plafond', '56 une mise en pause Leboncoin compte dans les 50 actions/heure DU COMPTE (plafond plein : rien ne part)', r);
  });
  await essaie('57', async () => {
    const f = fondLbc({ vrmPauseLbcMsg: { jusqua: Date.now() + 30 * 60000, statut: 429 } });
    const r = await f.ctx.supprimeLbcDepuisApp({ id: AD, confirme: true });
    dit(r && r.accepte === false && r.code === 'lbc-pause', '57 Leboncoin a demandé de ralentir (429/403) : une suppression ne part pas', r);
  });
  // ── 60 : un script de la page forge un résultat — jamais cru ──
  await essaie('60', async () => {
    const REL = lire(path.join(dossier, 'lbc-relay.js'));
    const ecoutes = [], onMsg = [];
    const win = {};
    // « Un script de la page » : il lit chaque ordre posté sur `window` et répond 200.
    win.postMessage = (m) => { const d = JSON.parse(JSON.stringify(m)); setTimeout(() => {
      for (const f of ecoutes.slice()) { try { f({ source: win, origin: 'https://www.leboncoin.fr', data: d, ports: [] }); } catch (_) {} }
      if (d && d.__tag === 'CANCALE_LBC_ORDRE') win.postMessage({ __tag: 'CANCALE_LBC', kind: d.kind === 'repondre' ? 'lbcenvoiresultat' : 'lbcpauseresultat', jeton: d.jeton, statut: 200, corps: '{"ok":true}' });
    }, 0); };
    win.addEventListener = (t, f) => { if (t === 'message') ecoutes.push(f); };
    win.top = win;
    const ctx = { window: win, self: win, location: { origin: 'https://www.leboncoin.fr', hostname: 'www.leboncoin.fr', href: 'https://www.leboncoin.fr/' }, console: { log() {}, warn() {}, error() {} },
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 60)), clearTimeout, setInterval: () => 0, clearInterval() {}, TextEncoder, URL, crypto: { randomUUID: () => 'jeton-' + Math.random().toString(16).slice(2, 12) },
      chrome: { runtime: { id: 'ext', lastError: null, sendMessage: (m, cb) => { if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener: (f) => onMsg.push(f) } } } };
    vm.createContext(ctx); vm.runInContext(REL, ctx, { filename: 'lbc-relay.js' });
    const ordre = (msg) => new Promise((res) => { let g = false; for (const f of onMsg) { if (f(msg, { id: 'ext' }, res) === true) g = true; } if (!g) setTimeout(() => res(undefined), 30); });
    const r1 = await ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: AD, compte: LBC });
    const r2 = await ordre({ from: 'vrm-fond', action: 'lbcRepondre', conv: 'conv-123', texte: 'Bonjour', compte: LBC });
    const cru = (r) => r && r.ok === true && Number(r.statut) === 200;
    dit(!cru(r1) && !cru(r2), '60 un script de la page lit l’ordre et poste un faux résultat 200 : il n’est JAMAIS cru (canal privé seulement)', { r1, r2 });
  });
  // ── 68 : le popup ne s'affiche qu'encadré par la page principale d'un site permis ──
  await essaie('68', async () => {
    const src = lire(path.join(dossier, 'popup.js'));
    const m = /const HOTES_CADRE = [\s\S]*?\nfunction cadreAutorise\(\) \{[\s\S]*?\n\}/.exec(src);
    if (!m) { dit(false, '68 le popup vérifie QUI l’encadre (`cadreAutorise`)', 'règle absente'); return; }
    const juger = (ancetres, parentEstTop = true) => { const top = {}; const w = { top, parent: parentEstTop ? top : {} };
      const c = { window: w, location: { ancestorOrigins: ancetres }, document: { referrer: '' }, URL }; vm.createContext(c); vm.runInContext(m[0] + ';this.r=cadreAutorise();', c); return c.r; };
    const ok = juger(['https://www.vinted.fr']) === true && juger(['https://evil.exemple.test']) === false && juger(['https://www.vinted.fr', 'https://pub.exemple.test']) === false && juger(['https://www.vinted.fr'], false) === false;
    dit(ok, '68 `?mode=carte` / `?mode=reparer` : seulement posé par la page principale d’un site permis (un cadre de pub, un autre site : rien)', '');
  });
  // ── 69 : jamais le mot de passe dans la carte dessinée ──
  await essaie('69', async () => {
    const src = lire(path.join(dossier, 'vrm-badge.js')).replace(/\/\/.*$/gm, '');
    dit(/const MDP_PERMIS = CADRE;/.test(src) && /modeCx === 'mdp' && MDP_PERMIS/.test(src) && /MDP_PERMIS \? '<button[^']*data-basculer-mode/.test(src), '69 la carte DESSINÉE (DOM de la page) ne propose jamais le mot de passe : code par e-mail seulement', '');
  });
  // ── 72 : un rafraîchissement du jeton n'est pas un changement de compte ──
  await essaie('72', async () => {
    const f = fond();
    const a = await f.ctx.compteCookieChange('www.vinted.fr');
    const b = await f.ctx.compteCookieChange('www.vinted.fr');
    f.ctx.activeAccountId = async () => '222';
    const c = await f.ctx.compteCookieChange('www.vinted.fr');
    dit(a === true && b === false && c === true, '72 le jeton rafraîchi (même compte) ne relance pas de moisson ; un autre compte, si', { a, b, c });
  });
  // ── 74 : le monde MAIN n'est refusé que sur une vraie erreur de capacité ──
  await essaie('74', async () => {
    const f = fond();
    const e = f.ctx.estRefusMondeMain;
    dit(e('Error in invocation: Unexpected property "world"') === true && e('TypeError: x.json is not a function') === false && e('Cannot access contents of url (MAIN frame navigated)') === false, '74 « is not a function », « MAIN » dans un message d’une page : ce n’est PAS un refus du navigateur', '');
  });
  // ── 77 / 78 : `owner` sur les lignes de comptes ──
  await essaie('78', async () => {
    const src = lire(BG).replace(/\/\/.*$/gm, '');
    dit(/id=eq\.vrm_blocked_accounts&owner=eq\./.test(src) && /id=eq\.panel_accounts_off&owner=eq\./.test(src) && /_blockedUser !== moi/.test(src), '78 la liste des comptes supprimés est celle de CE compte VRM (filtre `owner`, cache vidé au changement)', '');
    dit(/vinted_accounts\?vinted_user_id=eq\.\$\{encodeURIComponent\(uid\)\}&owner=eq\./.test(src) && /login_compte_pas_ecrit_/.test(src), '77 le login d’un compte n’est réécrit que sur SA ligne (`owner`), un refus est noté', '');
  });
  return out;
}

const MUTATIONS = [
  ['background.js', 'la porte compte une place', "  if (opts && opts.compter === false) return null;\n", '', '27'],
  ['background.js', 'favori compté à la porte', 'lecture: !!permis.lecture || !!permis.favori, recu', 'lecture: !!permis.lecture, recu', '28'],
  ['background.js', 'place pas rendue sur arrêt', "if (arret) { await rendreSaPlace(); return arret; }", 'if (arret) { return arret; }', '29'],
  ['background.js', 'lecture sans compte connu', "if (!actif && classe !== 'clic') {", 'if (false) {', '30'],
  ['background.js', 'lectures des autres ignorées', 'const n0 = list.length + ((autres && autres.lectures) || []).length;', 'const n0 = list.length;', '33'],
  ['background.js', 'plus de verrou de moisson', "if (_moissonEnCours) { noterDiag('moisson_deja_en_cours'); return _moissonEnCours; }", '', '37'],
  ['background.js', 'moisson sans plafond', 'if (l.length >= MOISSONS_MAX_HEURE) return false;', '', '34'],
  ['background.js', 'file sans délai', "const r = await delaiFile(fn(), quoi === 'page' ? FILE_VINTED.maxMoissonMs : FILE_VINTED.maxMs);", 'const r = await fn();', '36'],
  ['background.js', 'id navigateur non sérialisé ni relu', ['if (_idNavigateurEnCours) return _idNavigateurEnCours;', "      const relu = (await chrome.storage.local.get('vrmIdNavigateur')).vrmIdNavigateur;\n      return typeof relu === 'string' && /^[0-9a-f]{16}$/.test(relu) ? relu : '';"], ['', '      return n;'], '38'],
  ['background.js', 'écriture partagée avalée', "if (!ok) noterDiag('actions_partagees_pas_ecrites');", '', '39'],
  ['background.js', 'base muette ⇒ 50', 'const maxBase = autres === null ? Math.min(max, ACTIONS_SANS_AUTRES) : max;', 'const maxBase = max;', '40'],
  ['background.js', 'orphelins gardés', 'if (vivant || c.vie === VIE_WORKER) continue;', 'continue;', '41'],
  ['background.js', 'vrmCmds non sérialisé', "  const suite = _chaineCmds.then(() => majCmdUn(jobId, patch), () => majCmdUn(jobId, patch));\n  _chaineCmds = suite.then(() => {}, () => {});\n  return suite;", '  return majCmdUn(jobId, patch);', '42'],
  ['background.js', 'pagination à la longueur', 'if (Number.isFinite(tp) && tp > 0) return page >= tp;\n', '', '46'],
  ['background.js', 'écritures d’un compte ignoré', "if ((await compteNonCapte(uid)) !== false) { noterDiag('ecriture_compte_non_capte'); return; }", '', '47'],
  ['background.js', 'profil brut', "    if (type === 'profile') return profilMaigre(payload);\n", '', '48'],
  ['background.js', 'date d’une annonce d’un autre', "if (await detailEstASoi(sender, msg.id)) await saveListingDate(msg.id, msg.ts, msg.text); else noterDiag('date_pas_a_soi');", 'await saveListingDate(msg.id, msg.ts, msg.text);', '51'],
  ['background.js', 'LBC hors plafond', "if (!cptLbc.ok) return { accepte: false, code: 'plafond'", "if (false) return { accepte: false, code: 'plafond'", '56'],
  ['background.js', 'LBC sans frein', "if (freinLbc) return { accepte: false, code: 'lbc-pause'", "if (false) return { accepte: false, code: 'lbc-pause'", '57'],
  ['lbc-relay.js', 'ordres et résultats par window', ["const versCapteur=m=>{if(!canalOrdres)return false;try{canalOrdres.postMessage(m);return true;}catch(_){return false;}};", "    if(!canalOrdres){sendResponse({ok:false,code:'canal'});return;}   // 5.362 : sans canal privé, rien ne part\n", "    // 22 oct. : la réponse de Leboncoin à une mise en pause demandée par le fond —\n"],
    ["const versCapteur=m=>{window.postMessage(m,'*');return true;};", '', "    else if (d.kind === 'lbcpauseresultat' || d.kind === 'lbcenvoiresultat') traiterCanal(d);\n"], '60'],
  ['popup.js', 'popup encadrable partout', "    if (window.parent !== window.top) return false;", "    return true;", '68'],
  ['background.js', 'chaque jeton relance la moisson', "if (m[dom] && m[dom].uid === String(uid)) {", 'if (false) {', '72'],
  ['background.js', 'tout texte « MAIN » coupe', "  return /Unexpected property", "  if (/is not a function|MAIN/.test(t)) return true;\n  return /Unexpected property", '74'],
];

(async () => {
  const res = await auditer(EXT);
  let rouges = 0;
  for (const r of res) { console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok || !r.d ? '' : '\n     ' + String(r.d).slice(0, 500)}`); if (!r.ok) rouges++; }
  console.log(`\n${res.length - rouges}/${res.length} verts`);
  if (process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const [fic, nom, a, b, attendu] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-moyennes-'));
      const d = path.join(tmp, 'ext'); fs.cpSync(EXT, d, { recursive: true });
      const f = path.join(d, fic); let src = lire(f);
      // Une mutation peut porter plusieurs morceaux ; chacun est remplacé PARTOUT.
      const as = [].concat(a), bs = [].concat(b);
      if (as.some((x) => !src.includes(x))) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
      as.forEach((x, i) => { src = src.split(x).join(bs[i]); });
      fs.writeFileSync(f, src);
      const r = await auditer(d);
      const rouge = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const vise = rouge.some((x) => x.split('/').includes(attendu) || x === attendu);
      console.log(`${vise ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge.length ? 'rouge : ' + rouge.join(', ') : 'TOUT VERT (le contrôle ne la voit pas)'}`);
      if (vise) tenues++; else rouges++;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\n${tenues}/${MUTATIONS.length} mutations rendent leur rouge`);
  }
  process.exit(rouges ? 1 : 0);
})();
