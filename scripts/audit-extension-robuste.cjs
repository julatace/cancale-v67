// ════════════════════════════════════════════════════════════════════════════
//  LA FIN DE LA REVUE DE ROBUSTESSE DE L'EXTENSION (ext. 5.396, lot
//  extension-robuste, 16 nov.) — jouée sur le VRAI code : `background.js` dans
//  `_fond-vm.cjs` (et ses blocs de diagnostic et de journal), les vrais
//  `vc.js` / `vc-inject.js` reliés par un canal de banc, le vrai `lbc-relay.js`,
//  le vrai `inject.js`, le vrai `vrm-mots.js`, le vrai `bridge.js`.
//  Numéros = ceux de la revue (`docs/passation/robustesse/extension.md`,
//  branche claude/agent2-robustesse) ; le récit : 2026-11-16-extension-robuste.md.
//  Usage : node scripts/audit-extension-robuste.cjs [--ext dossier] [--prouve]
//  `--ext` : un autre dossier d'extension (preuve sur le code d'avant, §6.1) ;
//  `--prouve` : chaque mutation (règle réaffaiblie) doit rendre SON rouge.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');
const { FauxCanal, canalVersBanc } = require('./_canal-faux.cjs');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(__dirname, '..', 'vinted-sync-extension');
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const UID = '111';
const VC = 'https://fr.vestiairecollective.com';

// Le vrai relais vc.js dans une page : `win` partagé, un « script de la page » écoute tout.
function relaisVc(dossier, { canal = true } = {}) {
  const REL = lire(path.join(dossier, 'vc.js'));
  const ecoutes = [], onMsg = [], envois = [], vuParLaPage = [];
  const win = {};
  win.postMessage = (m) => { vuParLaPage.push(copie(m)); };
  win.addEventListener = (t, f) => { if (t === 'message') ecoutes.push(f); };
  win.top = win;
  const ctx = { window: win, self: { crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0') } }, crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0') },
    location: { origin: VC, href: VC + '/chat/' }, console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 80)), clearTimeout, URL, JSON, Date, Math, Map, Set, Number, String,
    chrome: { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { envois.push(copie(m)); if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener: (f) => onMsg.push(f) } } } };
  vm.createContext(ctx); vm.runInContext(REL, ctx, { filename: 'vc.js' });
  const mc = new FauxCanal();
  const duCapteur = [];
  mc.port1.onmessage = (e) => duCapteur.push(copie(e.data));
  if (canal) for (const f of ecoutes.slice()) f({ source: win, origin: VC, data: { __tag: 'CANCALE_VC_CANAL' }, ports: [mc.port2] });
  const parLaPage = (d) => { for (const f of ecoutes.slice()) f({ source: win, origin: VC, data: copie(d), ports: [] }); };
  const parLeCanal = (d) => mc.port1.postMessage(d);
  const ordre = (msg) => new Promise((res) => { let g = false; for (const f of onMsg) { if (f(msg, { id: 'banc' }, res) === true) g = true; } if (!g) setTimeout(() => res(undefined), 30); });
  return { envois, vuParLaPage, duCapteur, parLaPage, parLeCanal, ordre, mc };
}

async function auditer(dossier) {
  const BG = path.join(dossier, 'background.js');
  const SRC = lire(BG);
  const out = [];
  const dit = (ok, m, d) => out.push({ ok: !!ok, m, d: d === undefined ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, `${nom} — a levé : ${String(e && e.message || e).slice(0, 160)}`); } };
  const fond = (o = {}) => faireFond(Object.assign({ src: BG }, o));

  // ══ 67 : le stockage local réservé à l'extension, un miroir sans secret pour les pages ══
  await essaie('67', async () => {
    const sess = {};
    const f = fond({ sessionStore: sess, store: { vrmApparence: 'sombre' } });
    await attendre(30);
    dit((f.j.niveaux || {}).local === 'TRUSTED_CONTEXTS' && (f.j.niveaux || {}).session === 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      '67 Chrome/Edge : `local` réservé à l’extension, les pages ne lisent que le miroir (`session`)', f.j.niveaux || null);
    dit(sess.vrmApparence === 'sombre' && !!sess.vrmMiroir, '67 le miroir est posé AVANT le verrou et porte les valeurs sans secret (apparence…)', Object.keys(sess));
    await f.ctx.chrome.storage.local.set({ vrmSession: { access_token: 'JETON-SECRET', refresh_token: 'RENOUV-SECRET', user_id: 'u1', email: 'banc@exemple.test' }, vrmOAuthEtat: { etat: 'erreur', message: 'refus', email: 'banc@exemple.test', f: 'google' } });
    await attendre(30);
    const t = JSON.stringify(sess);
    dit(!/SECRET|banc@exemple/.test(t) && sess.vrmSession && sess.vrmSession.present === true && sess.vrmOAuthEtat && sess.vrmOAuthEtat.etat === 'erreur',
      '67 la session VRM n’arrive au miroir que comme un signal `{ at, present }` ; l’état OAuth sans e-mail', t.slice(0, 300));
    await f.ctx.chrome.storage.session.set({ vrmBadgePos: { vinted: { r: 20, b: 30 } }, vrmSession: { access_token: 'FORGE' } });
    await attendre(30);
    dit(f.store.vrmBadgePos && f.store.vrmBadgePos.vinted && f.store.vrmBadgePos.vinted.r === 20 && f.store.vrmSession && f.store.vrmSession.access_token === 'JETON-SECRET',
      '67 ce qu’une page écrit (position du logo) rejoint `local` ; une clé qu’elle n’a pas à écrire (la session) n’y entre jamais', { pos: f.store.vrmBadgePos, s: f.store.vrmSession && f.store.vrmSession.access_token });
    const g = fond({ sessionStore: {}, niveauKO: 'session' });
    await attendre(30);
    const h = fond({ sessionStore: {}, niveauKO: 'ecriture-session' });
    await attendre(30);
    dit(!(g.j.niveaux || {}).local && !(h.j.niveaux || {}).local, '67 miroir impossible (session refusée, ou son écriture) ⇒ `local` n’est PAS verrouillé (une page n’est jamais sans stockage)', { refusee: g.j.niveaux || null, ecriture: h.j.niveaux || null });
  });
  // ── 67 (page) : vrm-mots.js lit le miroir quand il est posé, `local` sinon ──
  await essaie('67p', async () => {
    const SRCM = lire(path.join(dossier, 'vrm-mots.js'));
    const jouer = (avecMiroir) => new Promise((res) => {
      const ctx = { console, setTimeout, clearTimeout, Promise, JSON, Object,
        chrome: { runtime: { id: 'x', lastError: null }, storage: {
          local: { get: (k, cb) => { const p = avecMiroir ? Promise.reject(new Error('Access to storage is not allowed from this context')) : Promise.resolve({ vrm_vend_ext: { vend: 'sneakers' } }); if (typeof cb === 'function') { p.then(cb, () => { ctx.chrome.runtime.lastError = { message: 'refus' }; cb(undefined); ctx.chrome.runtime.lastError = null; }); return; } return p; } },
          session: { get: (k, cb) => { const o = avecMiroir ? { vrmMiroir: { at: 1 }, vrm_vend_ext: { vend: 'autre' } } : {}; const v = {}; for (const c of [].concat(k)) if (o[c] !== undefined) v[c] = o[c]; if (typeof cb === 'function') { setTimeout(() => cb(v), 0); return; } return Promise.resolve(v); } },
          onChanged: { addListener() {} } } } };
      ctx.globalThis = ctx;
      vm.createContext(ctx); vm.runInContext(SRCM, ctx, { filename: 'vrm-mots.js' });
      setTimeout(() => res(ctx.VRM_MOTS && ctx.VRM_MOTS.vend()), 40);
    });
    const a = await jouer(true), b = await jouer(false);
    dit(a === 'autre' && b === 'sneakers', '67 une page lit le miroir quand le fond l’a posé (Chrome), sinon `local` (Firefox, Orion)', { miroir: a, sans: b });
  });

  // ══ 60-62 : Vestiaire — ordres, résultats, recettes, annonce publiée : canal privé seulement ══
  await essaie('60', async () => {
    const R = relaisVc(dossier);
    R.parLaPage({ __tag: 'CANCALE_VC', kind: 'vcpublie', productId: '777777' });
    R.parLaPage({ __tag: 'CANCALE_VC', kind: 'vcoffreappris', recette: { hote: 'apiv2.vestiairecollective.com', rejouable: true } });
    R.parLaPage({ __tag: 'CANCALE_VC', kind: 'vcaimes', aimes: [{ produit: '123456', acheteur: '654321' }] });
    await attendre(10);
    const forges = R.envois.filter((m) => /vcPublie|vcOffreAppris|vcAimes/.test(m.action));
    dit(forges.length === 0, '61/62 un script de la page poste « annonce publiée », « recette apprise », « ont aimé » sur `window` : RIEN n’est relayé au fond', forges.map((m) => m.action));
    R.parLeCanal({ __tag: 'CANCALE_VC', kind: 'vcpublie', productId: '777777' });
    await attendre(10);
    dit(R.envois.some((m) => m.action === 'vcPublie' && m.productId === '777777'), '61 la même lettre venue du CANAL privé du capteur est relayée (le contrôle n’est pas vide)', R.envois.map((m) => m.action));
    const p = R.ordre({ from: 'vrm-fond', action: 'vcRepondre', conv: 'C7777', texte: 'texte-secret-du-vendeur', recette: { hote: 'apiv2.vestiairecollective.com' }, compte: 'moi1' });
    await attendre(10);
    const ord = R.duCapteur.find((d) => d.__tag === 'CANCALE_VC_ORDRE' && d.kind === 'repondre');
    const fuite = R.vuParLaPage.some((m) => JSON.stringify(m).includes('texte-secret-du-vendeur'));
    dit(!!ord && !fuite, '60 l’ordre du fond (jeton, texte, recette) part par le canal privé, jamais sur `window`', { ordre: !!ord, fuite });
    R.parLaPage({ __tag: 'CANCALE_VC', kind: 'vcenvoiresultat', jeton: ord && ord.jeton, statut: 201, idMsg: 'FAUX' });
    await attendre(10);
    R.parLeCanal({ __tag: 'CANCALE_VC', kind: 'vcenvoiresultat', jeton: ord && ord.jeton, statut: 201, idMsg: 'M99' });
    const r = await p;
    dit(r && r.ok === true && r.idMsg === 'M99', '60 un faux résultat posté par la page n’est jamais cru ; seul celui du canal répond', r);
    const S = relaisVc(dossier, { canal: false });
    const r2 = await S.ordre({ from: 'vrm-fond', action: 'vcOffre', nego: '1700001', geste: 'accepter', compte: 'moi1' });
    dit(r2 && r2.ok === false && r2.code === 'canal' && S.vuParLaPage.length === 0, '60 sans canal privé : rien ne part, réponse immédiate `canal` (le fond rend la place)', { r2, vus: S.vuParLaPage.length });
    dit(/rep\.code === 'canal'\) \{ await rendreActions\('vc:'/.test(SRC), '60 le fond traduit `canal` : place rendue, « recharge la page Vestiaire » (jamais « incertain »)', '');
  });
  await essaie('62i', async () => {
    const INJ = lire(path.join(dossier, 'vc-inject.js'));
    const surWindow = [], ecoutes = [];
    let port = null; const parPort = [];
    const win = { postMessage: (m, o, ports) => { if (m && m.__tag === 'CANCALE_VC_CANAL' && ports && ports[0]) { port = ports[0]; port.onmessage = (e) => parPort.push(copie(e.data)); return; } surWindow.push(copie(m)); },
      addEventListener: (t, f) => { if (t === 'message') ecoutes.push(f); }, fetch: async () => ({ status: 404, ok: false, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => '{}' }) };
    win.top = win; win.self = win;
    const ctx = { MessageChannel: FauxCanal, window: win, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
      location: { origin: VC, hostname: 'fr.vestiairecollective.com', pathname: '/', href: VC + '/' }, history: { pushState() {}, replaceState() {} },
      URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String, Number };
    vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
    const ORD = { __tag: 'CANCALE_VC_ORDRE', kind: 'importpage', jeton: 'jeton-banc-0001', quoi: 'ventes', url: 'pas une adresse', compte: 'x' };
    for (const f of ecoutes.slice()) f({ source: win, origin: VC, data: copie(ORD) });
    await attendre(15);
    const forge = parPort.concat(surWindow).filter((m) => m.kind === 'vcimportresultat');
    dit(forge.length === 0, '62 un ordre posté sur `window` par la page : le capteur n’y répond pas (seul le canal commande)', forge);
    if (port) port.postMessage(ORD);
    await attendre(15);
    const viaPort = parPort.filter((m) => m.kind === 'vcimportresultat'), viaWin = surWindow.filter((m) => m.kind === 'vcimportresultat');
    dit(!!port && viaPort.length === 1 && viaWin.length === 0, '62 le même ordre par le canal : le résultat revient par le canal, jamais sur `window`', { port: !!port, viaPort: viaPort.length, viaWin: viaWin.length });
  });

  // ══ 119 : l'accusé « détail intégré » Leboncoin par le canal seulement ══
  await essaie('119', async () => {
    const REL = lire(path.join(dossier, 'lbc-relay.js'));
    const ecoutes = [], surWindow = [];
    const win = { postMessage: (m) => surWindow.push(copie(m)), addEventListener: (t, f) => { if (t === 'message') ecoutes.push(f); } };
    win.top = win;
    const ctx = { window: win, self: win, location: { origin: 'https://www.leboncoin.fr', hostname: 'www.leboncoin.fr', href: 'https://www.leboncoin.fr/transactions/1', pathname: '/transactions/1' }, console: { log() {}, warn() {}, error() {} },
      document: { readyState: 'loading', visibilityState: 'hidden' }, sessionStorage: { getItem: () => null, setItem() {} },
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 60)), clearTimeout, setInterval: () => 0, clearInterval() {}, TextEncoder, URL, JSON,
      chrome: { runtime: { id: 'ext', lastError: null, sendMessage: (m, cb) => { if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener() {} } } } };
    vm.createContext(ctx); vm.runInContext(REL, ctx, { filename: 'lbc-relay.js' });
    const mc = new FauxCanal(); const parPort = [];
    mc.port1.onmessage = (e) => parPort.push(copie(e.data));
    for (const f of ecoutes.slice()) f({ source: win, origin: 'https://www.leboncoin.fr', data: { __tag: 'CANCALE_LBC_CANAL' }, ports: [mc.port2] });
    for (const f of ecoutes.slice()) f({ source: win, origin: 'https://www.leboncoin.fr', data: { __tag: 'CANCALE_LBC', __vrmSequence: 7, kind: 'lbcvente', url: 'https://api.leboncoin.fr/transactions/1', body: '{"id":1}' }, ports: [] });
    await attendre(40);
    const accW = surWindow.filter((m) => m && m.__tag === 'CANCALE_LBC_ACCUSE'), accP = parPort.filter((m) => m && m.__tag === 'CANCALE_LBC_ACCUSE');
    dit(accW.length === 0 && accP.length === 1 && accP[0].sequence === 7, '119 l’accusé « détail intégré » revient au capteur par le canal privé, jamais sur `window` (forgeable par la page)', { window: accW.length, canal: accP.length });
  });

  // ══ 105 / 103 / 107 : le vrai inject.js ══
  const jouerInject = async ({ canal, gestes }) => {
    const INJ = lire(path.join(dossier, 'inject.js'));
    const surWindow = [], parCanal = [];
    const ctx = { URL, Headers, Request, Response, Promise, Uint8Array, ArrayBuffer, Date, console: { log() {}, warn() {}, error() {} }, JSON, Object, Symbol,
      location: { origin: 'https://www.vinted.fr', host: 'www.vinted.fr', hostname: 'www.vinted.fr', href: 'https://www.vinted.fr/member/1' },
      document: { hidden: false, addEventListener() {}, querySelectorAll() { return []; } }, localStorage: { getItem: () => null, setItem() {} },
      setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
      postMessage: (m) => { if (!(m && m.__tag === 'CANCALE_VINTED_CANAL')) surWindow.push(copie(m)); },
      fetch: async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }) };
    if (canal) ctx.MessageChannel = canalVersBanc((m) => parCanal.push(m));
    ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'inject.js' });
    for (const [u, o] of gestes) { try { await ctx.fetch(u, o); } catch (_) {} }
    await attendre(10);
    return { ctx, surWindow, parCanal, INJ };
  };
  await essaie('105', async () => {
    const a = await jouerInject({ canal: false, gestes: [['/api/v2/items/123/favourite', { method: 'POST', body: '{"x":1}' }]] });
    dit(a.surWindow.length === 0, '105 sans canal privé, inject.js ne poste RIEN sur `window` (jeton CSRF, corps capturés : plus de repli « * »)', a.surWindow.map((m) => m && m.kind));
    const b = await jouerInject({ canal: true, gestes: [['/api/v2/items/123/favourite', { method: 'POST', body: '{"x":1}' }]] });
    dit(b.parCanal.some((m) => m && m.kind === 'writereq'), '105 avec le canal, la même requête d’écriture est bien relayée (le contrôle n’est pas vide)', b.parCanal.map((m) => m && m.kind));
    const cles = Object.keys(b.ctx);
    const sym = Object.getOwnPropertySymbols(b.ctx).map(String);
    dit(!cles.some((k) => /cancale|capteur/i.test(k)) && sym.some((s) => /vrm\.capteur\.vinted/.test(s)), '103 la marque « capteur posé » n’est plus une variable énumérable de la page (clé symbole, non énumérable)', { cles: cles.filter((k) => /cancale|vrm/i.test(k)), sym });
    const c = await jouerInject({ canal: true, gestes: [['/api/v2/catalog/items/9/favourite', { method: 'POST', body: '{}' }], ['/api/v2/dialog/88/close', { method: 'POST', body: '{}' }], ['/api/v2/event_tracking', { method: 'POST', body: '{}' }], ['/api/v2/logs/front', { method: 'POST', body: '{}' }]] });
    const urls = c.parCanal.filter((m) => m && m.kind === 'writereq').map((m) => m.url);
    dit(urls.some((u) => /catalog/.test(u)) && urls.some((u) => /dialog/.test(u)) && !urls.some((u) => /event_tracking|logs/.test(u)), '107 « catalog », « dialog » ne sont plus pris pour du bruit ; « event_tracking », « logs » le restent (segments entiers)', urls);
  });

  // ══ 65 / 101 : la paire en dépôt ne se remplit que dans l'onglet ouvert pour elle ══
  await essaie('65', async () => {
    const t = Date.now();
    const f = fond({ store: { vrmPendingEbay: { ad: { id: 5, numero: '12' }, at: t }, vrmPendingAd: { ad: { id: 6, numero: '13' }, at: t }, vrmCmds: { 'ebay:5': { etape: 'depot', id: '5', tabId: 9, at: t } } } });
    const demande = (from, tab) => f.envoyer({ from, action: 'getPending' }, { tab: { id: tab, url: from === 'cancale-ebay' ? 'https://www.ebay.fr/sl/sell' : 'https://www.leboncoin.fr/deposer-une-annonce' }, frameId: 0 });
    const e9 = await demande('cancale-ebay', 9), e10 = await demande('cancale-ebay', 10), l11 = await demande('cancale-lbc', 11);
    dit(e9 && e9.ad && e9.ad.id === 5 && e10 && e10.ad === null, '65 eBay : la paire en dépôt ne se remplit que dans l’onglet ouvert pour elle (un second onglet eBay : rien)', { e9: e9 && e9.ad, e10: e10 && e10.ad });
    dit(l11 && l11.ad === null, '101 Leboncoin : sans onglet retenu pour ce dépôt, aucun onglet ne reçoit la paire', l11 && l11.ad);
  });

  // ══ 71 / 85 : la ligne de diagnostic par comparer-et-échanger, bornée ══
  await essaie('71', async () => {
    const n = {}; for (let i = 0; i < 700; i++) n['k' + i] = i;
    const f = fond({ lignes: { panel_diag_capture: { n, rates: {}, rev: 3 } } });
    await f.ctx.viderTampon({ n: { neuf_ici: 1 }, rates: {} });
    const l = f.lignes.panel_diag_capture || {};
    dit(l.rev === 4 && (f.j.patchs || []).includes('panel_diag_capture'), '71 la ligne de diagnostic s’écrit par comparer-et-échanger (`rev` 3 → 4, PATCH conditionnel)', { rev: l.rev, patchs: f.j.patchs });
    const cles = Object.keys(l.n || {});
    dit(cles.length <= 600 && l.n.neuf_ici === 1 && l.n.k699 === 699 && !('k0' in l.n), '85 la ligne est bornée (600 compteurs : les plus grands et ceux qu’on ajoute)', { n: cles.length });
  });
  // ── 84 : stockage illisible ⇒ le tampon n'est pas écrasé (le VRAI bloc du fond) ──
  await essaie('84', async () => {
    const deb = SRC.indexOf('const DIAG_BUF'), fin = SRC.indexOf('async function viderTampon');
    if (deb < 0 || fin < 0) { dit(false, '84 bloc du tampon lisible', ''); return; }
    const ecrits = [];
    let lectureKO = true;
    const ctx = { console, Date, JSON, Promise, Object, setTimeout,
      chrome: { storage: { local: { get: async () => { if (lectureKO) throw new Error('stockage muet'); return { vrmDiagBuf: { n: { a: 5 }, rates: {} } }; }, set: async (o) => { ecrits.push(copie(o)); } } } },
      viderTampon: async () => {} };
    vm.createContext(ctx); vm.runInContext(SRC.slice(deb, fin), ctx, { filename: 'background.js#tampon' });
    await ctx.majTampon((b) => { b.n.x = (b.n.x || 0) + 1; });
    dit(ecrits.length === 0, '84 stockage illisible : le tampon de diagnostic n’est PAS réécrit vide (ses compteurs restent)', ecrits);
    lectureKO = false;
    await ctx.majTampon((b) => { b.n.x = (b.n.x || 0) + 1; });
    dit(ecrits.length === 1 && ecrits[0].vrmDiagBuf.n.a === 5 && ecrits[0].vrmDiagBuf.n.x === 1, '84 stockage lisible : le compteur s’ajoute aux autres', ecrits);
  });
  // ── 86 : le journal d'activité, une écriture à la fois (le VRAI bloc) ──
  await essaie('86', async () => {
    const deb0 = ['let _chaineActivite', 'async function logActivity'].map((k) => SRC.indexOf(k)).filter((i) => i >= 0);
    const fin = SRC.indexOf('// --- Capture passive');
    if (!deb0.length || fin < 0) { dit(false, '86 bloc du journal lisible', ''); return; }
    const store = {};
    const ctx = { console, Date, JSON, Promise, String, Array, setTimeout,
      chrome: { storage: { local: { get: async (k) => { await attendre(3); return { [k]: copie(store[k]) }; }, set: async (o) => { await attendre(1); Object.assign(store, copie(o)); } } } } };
    vm.createContext(ctx); vm.runInContext(SRC.slice(Math.min(...deb0), fin), ctx, { filename: 'background.js#journal' });
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((t) => ctx.logActivity(t)));
    await attendre(30);
    dit((store.vrmActivity || []).length === 5, '86 cinq événements au même moment : les cinq sont dans le journal (aucun écrasé)', (store.vrmActivity || []).map((x) => x.text));
  });

  // ══ 92 : une liaison annonce → N° du mois n'est jamais coupée par la borne ══
  await essaie('92', async () => {
    const f = fond();
    const items = {}; const t = Date.now();
    for (let i = 0; i < 500; i++) items[String(10000 + i)] = { numero: String(i + 1), at: new Date(t - i * 60000).toISOString() };
    for (let i = 0; i < 50; i++) items[String(20000 + i)] = { numero: 'V' + i, at: new Date(t - 90 * 86400000 - i).toISOString() };
    const r = f.ctx.resaPropre({ attente: {}, items });
    const n = Object.keys(r.items).length, recents = Object.keys(r.items).filter((k) => k.startsWith('1')).length;
    dit(recents === 500 && n === 500, '92 500 liaisons de la semaine : toutes gardées (les vieilles de 3 mois au-delà des 400 partent)', { n, recents });
  });

  // ══ 95 : une offre encore en attente n'est jamais retraitée après 7 jours ══
  await essaie('95', async () => {
    const vieux = Date.now() - 8 * 86400000;
    const f = fond({ store: { vrmOffresFaites: { O1: vieux, O2: vieux }, vrmOffresPrevues: { O3: { at: Date.now() - 1000, uid: UID, quoi: 'reject' } } } });
    Object.assign(f.ctx, {
      offreAutoReglages: async () => ({ actif: true, mins: {}, refuses: { I3: 20 }, msgRefus: '' }),
      garde: async () => null, lireFreinRepub: async () => null, facteurPrudence: async () => 1, secuGeste: async () => null,
      offresEnAttente: async () => [{ oid: 'O1', item: 'I1', prix: 10, tx: '1' }, { oid: 'O3', item: 'I3', prix: 10, tx: '3' }],
      repondreOffre: async () => ({ ok: true }), noterJournal: async () => {}, prolongerVerrouStock: async () => {}, espaceAcceptMs: () => 0, delaiOffreMs: () => 0,
    });
    await f.ctx.autoAccepterOffresUnPassage(UID, 'v');
    const st = f.store.vrmOffresFaites || {};
    dit(!!st.O1 && !st.O2 && !!st.O3, '95 mémo de plus de 7 jours : gardé pour l’offre ENCORE en attente (jamais traitée deux fois), effacé pour celle qui n’y est plus', Object.keys(st));
  });
  // ══ 96 : le message après un refus revérifie le compte et la pause ══
  await essaie('96', async () => {
    const f = fond();
    let n = 0, envois = 0;
    Object.assign(f.ctx, {
      garde: async () => (++n === 1 ? null : { ok: false, code: 'vinted-pause', error: 'pause' }),
      vintedPage: async () => { envois++; return { ok: true, status: 200, json: {} }; },
      attendreEcriture: async () => ({ ok: true }), varianteDerniere: async () => null, noterVarianteDerniere: async () => {},
    });
    const r = await f.ctx.repondreOffre({ uid: UID, tx: '5', oid: '6', quoi: 'reject', conv: '77', prix: 10, msg: 'Non merci' });
    dit(envois === 1 && r && r.messagePasParti === true, '96 une pause posée entre le refus et le message : le message ne part pas (et c’est dit)', { envois, r });
  });
  // ══ 91 : la place du bordereau est rendue quand rien n'est généré ══
  await essaie('91', async () => {
    const jouer = async (refusASonTour) => {
      const f = fond();
      const rendus = []; let n = 0;
      Object.assign(f.ctx, {
        labelDejaRange: async () => false, fenetreBordereaux: async () => ({ n: 0, resteMs: 0 }), noterBordereauCommande: async () => {},
        gardeStricte: async (uid, acc, o) => { n++; if (o && o.reserve && o.recu) o.recu.at = 777; if (n === 3 && refusASonTour) return { ok: false, code: 'autre-compte', error: 'autre compte' }; return null; },
        rendreActions: async (...a) => { rendus.push(a); },
        recupererLabel: async () => ({ ok: false }), genererBordereau: async () => ({ ok: true }), recupererLabelInsiste: async () => ({ ok: true }), notifierApp: () => {},
      });
      await f.ctx.executerCommande({ cmd: 'bordereau', uid: UID, tx: '999' });
      await attendre(60);
      return rendus;
    };
    const a = await jouer(true), b = await jouer(false);
    dit(a.length === 1 && a[0][1] === 777 && b.length === 0, '91 refus à son tour dans la file : la place réservée est rendue ; une génération partie la garde', { refus: a, genere: b });
  });
  // ══ 93 : une demande d'import pour un autre compte n'est pas perdue ══
  await essaie('93', async () => {
    const f = fond();
    const vus = [];
    f.ctx.importerHistoriqueUn = async (uid) => { vus.push(uid); await attendre(15); return 1; };
    const a = f.ctx.importerHistorique('111'), b = f.ctx.importerHistorique('222');
    await Promise.all([a, b]); await attendre(10);
    dit(vus.join(',') === '111,222', '93 import du compte B demandé pendant celui de A : il passe APRÈS (une requête à la fois), jamais « 0 » en silence', vus);
  });
  // ══ 94 : le passage « une minute après » par alarme ══
  await essaie('94', async () => {
    const f = fond();
    const alarmes = []; f.ctx.chrome.alarms.create = (nom, o) => alarmes.push([nom, o]);
    f.ctx.planifierImport();
    dit(alarmes.some(([nom, o]) => nom === 'vrm-import-bientot' && o && o.delayInMinutes === 1), '94 l’import d’après visite est planifié par une alarme (elle survit au service worker)', alarmes);
  });
  // ══ 79 / 102 : le jeton CSRF survit au réveil et ne relance la lecture que s’il change ══
  await essaie('79', async () => {
    const sess = {};
    const f = fond({ sessionStore: sess });
    let n = 0; f.ctx.captureDomain = async () => { n++; };
    const tab = { tab: { id: 7, url: 'https://www.vinted.fr/' }, frameId: 0 };
    await f.envoyer({ from: 'cancale-content', kind: 'csrf', csrf: 'jeton-csrf-1' }, tab);
    await f.envoyer({ from: 'cancale-content', kind: 'csrf', csrf: 'jeton-csrf-1' }, tab);
    await f.envoyer({ from: 'cancale-content', kind: 'csrf', csrf: 'jeton-csrf-2' }, tab);
    await attendre(10);
    dit(sess.vrmCsrf && sess.vrmCsrf['www.vinted.fr'] === 'jeton-csrf-2', '79 le jeton CSRF vu est rangé dans `storage.session` (il survit au réveil du worker)', sess.vrmCsrf || null);
    dit(n === 2, '102 le même jeton revu ne relance pas la lecture du compte ; un jeton neuf, si', { n });
  });
  // ══ 99 : le formulaire eBay, étapes bornées ══
  await essaie('99', async () => {
    const etapes = {}; for (let i = 0; i < 30; i++) etapes['e' + i] = { at: new Date(Date.now() - (30 - i) * 1000).toISOString(), fields: [] };
    const f = fond({ lignes: { panel_ebay_form: { etapes } } });
    await f.envoyer({ from: 'cancale-ebay', action: 'ebayForm', fields: ['titre'], url: 'https://www.ebay.fr/sl/list/123456789?x=1' }, { tab: { id: 3, url: 'https://www.ebay.fr/sl/list/123456789' }, frameId: 0 });
    const e = (f.lignes.panel_ebay_form || {}).etapes || {};
    dit(Object.keys(e).length <= 24 && Object.keys(e).some((k) => /\{n\}/.test(k)), '99 le relevé du formulaire eBay garde 24 étapes au plus, clés normalisées (pas un n° par annonce)', Object.keys(e).slice(-3));
  });
  // ══ 82 : la mémoire des lectures de visite se purge ══
  await essaie('82', async () => {
    const f = fond();
    const m = vm.runInContext('_memoVisite', f.ctx);
    for (let i = 0; i < 300; i++) m.set('vieux' + i, { at: Date.now() - 60000, p: Promise.resolve([]) });
    await f.ctx.sbGetMemo('app_data?id=eq.x&select=data');
    dit(m.size <= 2, '82 une lecture de visite purge les entrées périmées (la mémoire ne grossit plus pendant la vie du worker)', { taille: m.size });
  });
  // ══ 66 : après une mise à jour, les onglets Vinted / Vestiaire sont invités à recharger ══
  await essaie('66', async () => {
    const f = fond({ onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }] });
    const poses = [];
    f.ctx.chrome.tabs.query = async (q) => ((q && [].concat(q.url || []).includes('https://*.vinted.fr/*')) ? [{ id: 7 }] : []);
    f.ctx.chrome.scripting.executeScript = async (o) => { poses.push({ tab: o.target && o.target.tabId, f: o.func && o.func.name, args: o.args }); return [{}]; };
    await f.ctx.rappelerMiseAJourLbc();
    dit(poses.some((p) => p.tab === 7 && p.args && p.args[1] === 'Vinted'), '66 après une mise à jour, l’onglet vinted.fr ouvert reçoit l’encart « Recharge cet onglet » (jamais rechargé à sa place)', poses);
  });
  // ══ 120 / 123 : plus de `postMessage(…, '*')` du pont et de la carte encadrée ══
  await essaie('120', async () => {
    const SRCB = lire(path.join(dossier, 'bridge.js'));
    const cibles = [];
    const win = { postMessage: (m, o) => cibles.push(o), addEventListener() {}, removeEventListener() {} };
    const ctx = { window: win, location: { origin: 'https://vrm.center', href: 'https://vrm.center/' }, document: { readyState: 'complete', addEventListener() {}, removeEventListener() {} },
      localStorage: { getItem: () => null }, console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, JSON,
      chrome: { runtime: { id: 'x', lastError: null, getManifest: () => ({ version: '5.0.0' }), sendMessage: (m, cb) => { if (typeof cb === 'function') cb(null); }, onMessage: { addListener() {} } }, storage: { local: { get: (k, cb) => cb({}), set() {} }, onChanged: { addListener() {} } } } };
    ctx.globalThis = ctx;
    vm.createContext(ctx); vm.runInContext(SRCB, ctx, { filename: 'bridge.js' });
    dit(cibles.length > 0 && cibles.every((o) => o === 'https://vrm.center'), '120 le pont de vrm.center poste à l’origine exacte, jamais « * »', cibles);
    const SRCV = lire(path.join(dossier, 'vrm-badge.js')), SRCP = lire(path.join(dossier, 'popup.js'));
    dit(!/window\.parent\.postMessage\([^;]*'\*'\)/.test(SRCV) && /__vrmCadreOrigine = origineDuParent\(\)/.test(SRCP), '123 la carte encadrée ne parle qu’à l’origine EXACTE de la page qui l’encadre (`__vrmCadreOrigine`)', '');
  });
  // ══ 68 : la politique de l'extension dit QUI peut l'encadrer ══
  await essaie('68', async () => {
    let m = {}; try { m = JSON.parse(lire(path.join(dossier, 'manifest.json'))); } catch (_) {}
    const csp = String(((m.content_security_policy || {}).extension_pages) || '');
    const fa = /frame-ancestors ([^;]+)/.exec(csp);
    dit(!!fa && /'self'/.test(fa[1]) && /https:\/\/\*\.vinted\.fr/.test(fa[1]) && !/\*(\s|$)/.test(fa[1].replace(/https:\/\/\*\./g, '')), '68 `frame-ancestors` : seulement l’extension et les sites de VRM (le navigateur refuse tout autre encadrement — banc Chromium `extension-stockage-cadre`)', csp);
    const { sansFrameAncestors } = require('./zip-extension.cjs');
    const f2 = sansFrameAncestors(JSON.parse(JSON.stringify(m)));
    dit(!/frame-ancestors/.test(JSON.stringify(f2.content_security_policy || {})), '68 retiré des paquets Firefox / Safari (pas garanti chez eux : `cadreAutorise` les tient)', '');
  });
  return out;
}

const MUTATIONS = [
  ['background.js', 'session recopiée telle quelle', "  if (MIROIR_SIGNAUX.includes(k)) return { at: Date.now(), present: v !== undefined && v !== null };", '', '67'],
  ['background.js', 'une page écrit toute clé', "          if (!MIROIR_ECRIT_PAR_PAGE.includes(k)) continue;", '', '67'],
  ['background.js', 'verrou sans miroir', "  } catch (_) { return false; }                     // pas de miroir ⇒ pas de verrou (les pages garderaient `local`)", "  } catch (_) {}", '67'],
  ['vrm-mots.js', 'la page ignore le miroir', "prendre(ok ? S : local());", 'prendre(local());', '67'],
  ['vc.js', 'lettres privées par window', "      if (SORTES_PRIVEES.has(d.kind) && prive !== true) return;   // forgé par la page : jeté", '', '61/62'],
  ['vc.js', 'ordre sur window', "  const versCapteur = (m) => { if (!canalOrdres) return false; try { canalOrdres.postMessage(m); return true; } catch (_) { return false; } };", "  const versCapteur = (m) => { window.postMessage(m, '*'); return true; };", '60'],
  ['vc-inject.js', 'résultats sur window', "      if (SORTES_PRIVEES.has(m.kind)) { if (canalOrdres) canalOrdres.postMessage(m); return; }", '', '62'],
  ['lbc-relay.js', 'accusé par window', "versCapteur({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true});", "window.postMessage({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true},'*');", '119'],
  ['inject.js', 'repli window', "    try { if (canal) canal.postMessage(m); } catch (_) {}", "    try { if (canal) canal.postMessage(m); else window.postMessage(m, '*'); } catch (_) {}", '105'],
  ['inject.js', 'marque énumérable', "  try { Object.defineProperty(window, MARQUE_CAPTEUR, { value: true, enumerable: false, configurable: false, writable: false }); } catch (_) { try { window[MARQUE_CAPTEUR] = true; } catch (_) {} }", "  window.__cancaleVintedInjected = true;", '103'],
  ['inject.js', 'bruit en sous-chaîne', "    return (h + '/' + p).split(/[./_-]+/).some((seg) => seg && WRITE_NOISE.test(seg));", "    return /(track|metric|event|impression|visit|telemetr|analytic|log|pageview|consent)/i.test(String(url));", '107'],
  ['background.js', 'dépôt eBay sans onglet', "ad && (await ongletDuDepot('ebay:' + String(ad.id), sender)) ? ad : null", 'ad', '65'],
  ['background.js', 'dépôt LBC sans job', "  return !!(job && job.tabId != null && job.tabId === tab);", '  return !(job && job.tabId != null && job.tabId !== tab);', '101'],
  ['background.js', 'diagnostic sans CAS', "  const okDiag = await modifierLigneCas('panel_diag_capture', (d) => {", "  const okDiag = await (async (f) => { const rows = await sbGet('app_data?id=eq.panel_diag_capture&select=data'); if (rows === null) return null; return supabaseUpsert('app_data', [{ id: 'panel_diag_capture', data: f((rows[0] && rows[0].data) || {}) }], 'id'); })((d) => {", '71'],
  ['background.js', 'compteurs sans borne', "    const nBorne = bornerCompteurs(n, buf.n, DIAG_N_MAX);", '    const nBorne = n;', '85'],
  ['background.js', 'tampon écrasé', "    try { const s = await chrome.storage.local.get(DIAG_BUF); buf = (s && s[DIAG_BUF]) || {}; } catch (_) { return; }", "    try { const s = await chrome.storage.local.get(DIAG_BUF); buf = (s && s[DIAG_BUF]) || {}; } catch (_) {}", '84'],
  ['background.js', 'journal sans chaîne', "  const suite = _chaineActivite.then(async () => {", "  const suite = Promise.resolve().then(async () => {", '86'],
  ['background.js', 'liaisons coupées à 400', "if (i < RESA_ITEMS_MAX || (i < RESA_ITEMS_DUR && Date.parse(String(v.at || '')) >= recent)) items[id] = v;", 'if (i < RESA_ITEMS_MAX) items[id] = v;', '92'],
  ['background.js', 'relecture ramène tout', "if (!st[k] && !(stFrais[k] < limite && !encoreLa.has(String(k)))) st[k] = stFrais[k];", 'if (!st[k]) st[k] = stFrais[k];', '95'],
  ['background.js', 'message sans garde', "    if (await garde(uid, acc, { compter: false, sorte: 'offre' })) { noterDiag('offre_auto_refus_message_garde');", "    if (false) { noterDiag('offre_auto_refus_message_garde');", '96'],
  ['background.js', 'place du bordereau gardée', "      if (!genere && recuBord.at) { try { await rendreActions(String(uid), recuBord.at, 1); } catch (_) {} }", '', '91'],
  ['background.js', 'import d’un autre compte perdu', "    if (_importCompte === u) {", '    if (true) {', '93'],
  ['background.js', 'import par minuteur', "    if (chrome.alarms && typeof chrome.alarms.create === 'function') { if (_importMinuteur) return; _importMinuteur = true; chrome.alarms.create('vrm-import-bientot', { delayInMinutes: 1 }); return; }", '', '94'],
  ['background.js', 'csrf en mémoire seulement', "  try { const S = chrome.storage && chrome.storage.session; if (S) S.set({ [CSRF_STORE]: Object.assign({}, lastCsrfByDomain) }).catch(() => {}); } catch (_) {}", '', '79'],
  ['background.js', 'csrf relance toujours', "  if (!d || !t || lastCsrfByDomain[d] === t) return false;", '  if (!d || !t) return false;', '102'],
  ['background.js', 'étapes eBay sans borne', "            if (cles.length > 24) etapes", '            if (false) etapes', '99'],
  ['background.js', 'mémoire jamais purgée', "for (const [k, v] of _memoVisite) if (!v || t - v.at >= VISITE_MEMO_MS) _memoVisite.delete(k);", '', '82'],
  ['background.js', 'Vinted pas prévenu', "['Vinted',['https://*.vinted.fr/*'", "['Vinted',['https://*.vinted.nulle-part/*'", '66'],
  ['bridge.js', 'pont en *', "  const poster = (m) => { try { window.postMessage(m, location.origin); } catch (_) {} };", "  const poster = (m) => { try { window.postMessage(m, '*'); } catch (_) {} };", '120'],
  ['manifest.json', 'encadrable partout', "; frame-ancestors 'self' https://vrm.center", "; frame-ancestors * https://vrm.center", '68'],
];

(async () => {
  const res = await auditer(EXT);
  let rouges = 0;
  for (const r of res) { console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok || !r.d ? '' : '\n     ' + String(r.d).slice(0, 500)}`); if (!r.ok) rouges++; }
  console.log(`\n${res.length - rouges}/${res.length} verts`);
  if (process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const [fic, nom, a, b, attendu] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-robuste-'));
      const d = path.join(tmp, 'ext'); fs.cpSync(EXT, d, { recursive: true });
      const f = path.join(d, fic); let src = lire(f);
      const as = [].concat(a), bs = [].concat(b);
      if (as.some((x) => !src.includes(x))) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
      as.forEach((x, i) => { src = src.split(x).join(bs[i]); });
      fs.writeFileSync(f, src);
      const r = await auditer(d);
      const rouge = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const vise = rouge.some((x) => x === attendu || x.split('/').some((y) => attendu.split('/').includes(y)));
      console.log(`${vise ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge.length ? 'rouge : ' + rouge.join(', ') : 'TOUT VERT (le contrôle ne la voit pas)'}`);
      if (vise) tenues++; else rouges++;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\n${tenues}/${MUTATIONS.length} mutations rendent leur rouge`);
  }
  console.log(rouges ? `❌ extension robuste : ${rouges} rouge(s)` : '✅ extension robuste : tout est vert');
  process.exit(rouges ? 1 : 0);
})();
