// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN : LIRE UN FIL ET RÉPONDRE DEPUIS VRM, SUR SON CLIC (3 nov., 5.318)
//        node scripts/audit-lbc-repondre.cjs [--src background.js] [--inj lbc-inject.js] [--mutation=nom]
//
//  Julien a choisi « répondre aux messages Leboncoin depuis VRM ». Ce qui doit
//  rester vrai :
//   A. (le VRAI lbc-inject.js dans Chromium, sous le nom de leboncoin.fr, nourri
//      de réponses INVENTÉES de forme plausible — la vraie forme n'a jamais été
//      vue chez lui, seul le compteur l'a été) :
//      · un FIL ⇒ le texte, la date, « de toi » (auteur = compte privé de la page)
//        — jamais le nom de l'autre personne ;
//      · un envoi fait PAR LA PAGE ⇒ une RECETTE : chemin à trous `{moi}`/`{conv}`,
//        clé du texte, mots fixes, NOMS des en-têtes — jamais ton texte ni une
//        valeur d'en-tête ; ce qui demanderait de deviner est « pas rejouable » ;
//      · l'ordre « répondre » rejoue EXACTEMENT la recette, au nom du compte de la
//        page seulement, avec les en-têtes que la page vient d'envoyer.
//   B. (le VRAI background.js dans un `vm`, `_fond-vm.cjs`) : un fil n'est rangé
//      que si la page et l'onglet disent le même compte ; répondre exige SA
//      commande (depuis l'app), une recette apprise, un fil lu, un onglet du MÊME
//      compte, une place dans les 50 actions/heure, aucune pause ; un 429 pose la
//      pause ; un envoi arrêté avant de partir rend sa place ; un message venu
//      de la page ne fait rien partir.
//  Mutations (`--mutation=`) : `compte` (garde du compte de l'onglet retirée),
//  `plafond` (plafond d'actions retiré), `clic` (la page peut déclencher un envoi).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const argv = process.argv;
const MUT = (argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let injPath = argv.includes('--inj') ? path.resolve(argv[argv.indexOf('--inj') + 1]) : path.join(EXT, 'lbc-inject.js');
let bgPath = argv.includes('--src') ? path.resolve(argv[argv.indexOf('--src') + 1]) : path.join(EXT, 'background.js');
if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-repondre-mut-'));
  let bg = fs.readFileSync(bgPath, 'utf8');
  const remplace = (a, b) => { if (!bg.includes(a)) { console.log('mutation introuvable : ' + a); process.exit(2); } bg = bg.replace(a, b); };
  if (MUT === 'compte') remplace("if (!o.ok && o.autres && o.autres.length) return { accepte: false, code: 'autre-compte'", "if (!o.ok && o.autres && o.autres.length) { o.ok = true; o.tabId = 41; } if (false) return { accepte: false, code: 'autre-compte'");
  if (MUT === 'plafond') remplace("const cpt = await compterAction('lbc:' + compte, ACTIONS_MAX_HEURE);", "const cpt = { ok: true, at: Date.now() };");
  if (MUT === 'clic') remplace("if (msg.action === 'lbcFil' || msg.action === 'lbcEnvoiAppris') {", "if (msg.action === 'lbcRepondre') { sendResponse(await repondreLeboncoin(msg)); return; }\n          if (msg.action === 'lbcFil' || msg.action === 'lbcEnvoiAppris') {");
  bgPath = path.join(tmp, 'background.js'); fs.writeFileSync(bgPath, bg);
}
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const U1 = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';     // son compte (inventé)
const U2 = '7c1d0e2f-1111-4222-8333-944455556666';     // l'autre personne (inventé)
const U3 = '9e9e9e9e-2222-4333-8444-955566667777';     // un autre compte à lui (inventé)
const CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const PERSO = ['Acheteur Test', 'acheteur@exemple.test', 'Julien P', 'jeton-tres-secret', 'avatar.exemple.test'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return PERSO.filter((x) => s.includes(x)); };
const URL_FIL = `https://api.leboncoin.fr/api/messaging/proxy/api/hal/${U1}/conversations/${CONV}/messages`;

(async () => {
  // ══ A. lbc-inject.js dans un vrai navigateur ═════════════════════════════
  await essaie('A. lbc-inject.js', async () => {
    let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); }
    const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
    const inj = fs.readFileSync(injPath, 'utf8');
    const ouvrir = async (compte) => {
      const c = await nav.newContext(); const p = await c.newPage();
      const recues = [];
      await c.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
      await c.route('https://api.leboncoin.fr/**', async (r) => {
        const q = r.request(); const u = q.url();
        recues.push({ methode: q.method(), url: u, entetes: q.headers(), corps: q.postData() });
        let body = {}, status = 200;
        if (/\/api\/account\/v1\/members\/me\/account$/.test(u)) body = { account: { account_id: compte, type: 'private', email: 'acheteur@exemple.test' }, member: { account_id: compte, nickname: { value: 'Julien P' } } };
        else if (u === URL_FIL && q.method() === 'GET') body = { conversation_id: CONV, partner: { name: 'Acheteur Test', avatar: 'https://avatar.exemple.test/a.png' }, _embedded: { messages: [
          { id: 'm1', text: 'Bonjour, toujours dispo ?', createdAt: '2026-11-03T08:00:00Z', author: { id: U2, name: 'Acheteur Test' } },
          { id: 'm2', text: 'Oui !', createdAt: '2026-11-03T08:05:00Z', author: { id: compte } },
          { id: 'm3', text: 'Je prends.', createdAt: '2026-11-03T08:06:00Z', author: { id: U2 } }] } };
        else if (/\/messages$/.test(u) && q.method() === 'POST') { status = 201; body = { id: 'm99' }; }
        return r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
      });
      await p.goto('https://www.leboncoin.fr/messages/id/' + CONV);
      // 5.362 (moyennes 60, 63) : les ordres, leurs résultats et la recette passent par le CANAL PRIVÉ
      // que lbc-inject.js remet au relais (ici, ce banc joue le relais : il prend le port).
      await p.addScriptTag({ content: 'window.__msgs=[];window.__surCanal=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_LBC")window.__msgs.push(e.data);if(!window.__canal&&e.data&&e.data.__tag==="CANCALE_LBC_CANAL"&&e.ports&&e.ports[0]){window.__canal=e.ports[0];window.__canal.onmessage=(m)=>{if(m.data&&m.data.__tag==="CANCALE_LBC"){window.__msgs.push(Object.assign({__canal:true},m.data));for(const f of window.__surCanal)f(m.data);}};}});' });
      await p.addScriptTag({ content: inj });
      await p.evaluate(() => window.postMessage({ __tag: 'CANCALE_LBC_RELAY', kind: 'pret' }, '*'));
      return { c, p, recues, msgs: (k) => p.evaluate((kk) => window.__msgs.filter((m) => m.kind === kk), k) };
    };
    const ordre = (A, o) => A.p.evaluate(async (oo) => {
      const p = new Promise((ok) => { window.__surCanal.push((d) => { if (d.kind === 'lbcenvoiresultat' && d.jeton === oo.jeton) ok(d); }); setTimeout(() => ok(null), 4000); });
      if (!window.__canal) return null;
      window.__canal.postMessage(Object.assign({ __tag: 'CANCALE_LBC_ORDRE', kind: 'repondre' }, oo));
      return p;
    }, o);
    const A = await ouvrir(U1);
    const H = { 'x-lbc-auth': 'jeton-tres-secret', 'content-type': 'application/json' };
    await A.p.evaluate(async ([h, uf]) => {
      await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account', { headers: h }).then((r) => r.text());
      await fetch(uf, { headers: h }).then((r) => r.text());
    }, [H, URL_FIL]);
    await pause(400);
    const fil = (await A.msgs('lbcfil'))[0];
    dit(!!fil && fil.conv === CONV && fil.messages.length === 3 && fil.moi === U1, 'un FIL : ses trois messages, et le compte privé de la page', JSON.stringify(fil && { c: fil.conv, n: fil.messages.length, moi: fil.moi }));
    dit(!!fil && fil.messages[0].t === 'Bonjour, toujours dispo ?' && fil.messages[0].deMoi === false && fil.messages[1].deMoi === true && /2026-11-03T08:05/.test(fil.messages[1].at), 'le texte, la date, et « de toi » = l’auteur est le compte de la page', JSON.stringify(fil && fil.messages.map((m) => [m.t, m.deMoi, m.at])));
    dit(fuite(fil).length === 0, 'aucun nom, aucun avatar de l’autre personne ne sort du fil (ni dans sa forme)', fuite(fil).join(','));
    dit(!(await A.msgs('lbcraw')).some((m) => /messaging/.test(String(m.url || ''))), 'le fil ne part jamais en `lbcraw`');
    // ── L'envoi que fait la PAGE : la recette
    await A.p.evaluate(async ([h, uf]) => { await fetch(uf, { method: 'POST', headers: h, body: JSON.stringify({ text: 'Merci, je poste demain', type: 'text', user_id: '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b' }) }).then((r) => r.text()); }, [H, URL_FIL]);
    await pause(300);
    const rec = (await A.msgs('lbcenvoiappris'))[0];
    const r = rec && rec.recette;
    dit(!!r && r.rejouable === true && r.methode === 'POST' && r.hote === 'api.leboncoin.fr' && r.modele === '/api/messaging/proxy/api/hal/{moi}/conversations/{conv}/messages', 'un envoi fait par la page ⇒ une recette REJOUABLE : chemin à trous `{moi}` et `{conv}`', JSON.stringify(r));
    dit(!!r && JSON.stringify(r.cleTexte) === '["text"]' && JSON.stringify(r.fixes) === '[[["type"],"text","string"],[["user_id"],"{moi}","string"]]', 'la clé du texte, les mots fixes, et ton compte en `{moi}`', JSON.stringify(r && { t: r.cleTexte, f: r.fixes }));
    dit(!!r && JSON.stringify(r.entetes) === '["x-lbc-auth"]' && !JSON.stringify(rec).includes('Merci') && fuite(rec).length === 0, 'les NOMS des en-têtes seulement — jamais leur valeur, jamais ton texte', JSON.stringify(rec));
    await A.p.evaluate(async ([h]) => {
      await fetch('https://api.leboncoin.fr/api/messaging/proxy/api/hal/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b/conversations/bbbbbbbb-0000-4000-8000-000000000001/messages', { method: 'POST', headers: h, body: JSON.stringify({ text: 'Coucou' }) }).then((r) => r.text());
      await fetch('https://api.leboncoin.fr/api/messaging/proxy/api/hal/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b/conversations/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/messages', { method: 'POST', headers: h, body: JSON.stringify({ text: 'Coucou', clientRef: 'a1b2-77zz' }) }).then((r) => r.text());
    }, [H]);
    await pause(300);
    const non = (await A.msgs('lbcenvoiappris')).slice(1).map((m) => m.recette);
    dit(non.length === 2 && non[0].rejouable === false && non[0].raison === 'chemin-ambigu' && non[1].rejouable === false && non[1].raison === 'valeur-inconnue', 'une conversation jamais vue, une valeur inconnue dans le corps ⇒ « pas rejouable », avec la raison', JSON.stringify(non));
    // ── L'ordre « répondre »
    const avant = A.recues.length;
    const res = await ordre(A, { jeton: 'jeton-ordre-0001', conv: CONV, texte: 'Oui, envoi demain matin', recette: r, compte: U1 });
    const env = A.recues.slice(avant).filter((x) => x.methode === 'POST');
    dit(!!res && res.statut === 201 && res.idMsg === 'm99', 'l’ordre part et rend le statut de Leboncoin et l’identifiant du message', JSON.stringify(res));
    dit(env.length === 1 && env[0].url === URL_FIL && env[0].corps === JSON.stringify({ type: 'text', user_id: U1, text: 'Oui, envoi demain matin' }), 'UNE requête : l’adresse et le corps de la recette, ton texte à sa place', JSON.stringify(env.map((x) => [x.url, x.corps])));
    dit(env.length === 1 && env[0].entetes['x-lbc-auth'] === 'jeton-tres-secret', 'avec l’en-tête que la PAGE vient d’envoyer à sa messagerie', JSON.stringify(env[0] && env[0].entetes));
    const n1 = A.recues.length;
    const res2 = await ordre(A, { jeton: 'jeton-ordre-0002', conv: CONV, texte: 'x', recette: r, compte: U3 });
    dit(!!res2 && res2.statut === 0 && res2.erreur === 'autre-compte' && A.recues.length === n1, 'un ordre au nom d’un AUTRE compte que celui de la page : rien ne part', JSON.stringify(res2));
    const res3 = await ordre(A, { jeton: 'jeton-ordre-0003', conv: CONV, texte: 'x', recette: Object.assign({}, r, { hote: 'evil.exemple.test' }), compte: U1 });
    dit(!!res3 && res3.statut === 0 && res3.erreur === 'recette' && A.recues.length === n1, 'une recette vers un autre hôte que Leboncoin : refusée, rien ne part', JSON.stringify(res3));
    await A.c.close();
    const B = await ouvrir(U1);
    await B.p.evaluate(async () => { await fetch('https://api.leboncoin.fr/api/account/v1/members/me/account').then((r) => r.text()); });
    await pause(200);
    const nb = B.recues.length;
    const res4 = await ordre(B, { jeton: 'jeton-ordre-0004', conv: CONV, texte: 'Bonjour', recette: r, compte: U1 });
    dit(!!res4 && res4.statut === 0 && res4.erreur === 'entetes' && B.recues.length === nb, 'une page qui n’a pas encore parlé à sa messagerie : RIEN ne part, et c’est dit', JSON.stringify(res4));
    await B.c.close();
    await nav.close();
    globalThis.__recette = r;
  });

  // ══ B. background.js dans un vm ══════════════════════════════════════════
  await essaie('B. background.js', async () => {
    const recette = globalThis.__recette || { methode: 'POST', hote: 'api.leboncoin.fr', chemin: '/x', rejouable: true, raison: '', modele: '/api/messaging/proxy/api/hal/{moi}/conversations/{conv}/messages', recherche: '', cleTexte: ['text'], fixes: [[['type'], 'text', 'string']], entetes: ['x-lbc-auth'] };
    const LBC = 'https://www.leboncoin.fr/messages';
    const faire = (opts = {}) => {
      const f = faireFond({ src: bgPath, onglets: opts.onglets || [{ id: 41, url: LBC, active: true }], lectureKO: opts.lectureKO || (() => false),
        store: { vrmLbcTransport: opts.cartes || { 41: { source: 'prive', compte: 'lbc-account:' + U1, ambigue: false, at: Date.now() } } } });
      const ordres = [];
      f.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
        if (m && m.__vmrEvt) { f.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
        ordres.push({ id, m: JSON.parse(JSON.stringify(m)) });
        return Promise.resolve(opts.rep ? opts.rep(m) : { ok: true, statut: 201, idMsg: 'm99', cles: [] });
      };
      const page = (msg, tabId = 41, url = LBC) => f.envoyer(Object.assign({ from: 'cancale-lbc' }, msg), { tab: { id: tabId, url }, frameId: 0 });
      const cmd = (msg) => f.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
      return { ...f, ordres, page, cmd };
    };
    const msgsFil = [{ id: 'm1', t: 'Bonjour, toujours dispo ?', deMoi: false, at: '2026-11-03T08:00:00.000Z' }, { id: 'm2', t: 'Oui !', deMoi: true, at: '2026-11-03T08:05:00.000Z' }];
    const F = faire();
    await F.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: msgsFil, page: '/messages/id/' + CONV });
    const fil = F.lignes[`lbc_fil_${CONV}`];
    dit(!!fil && fil.compte === U1 && fil.n === 2 && fil.apercu === 'Oui !' && fil.dernierDeMoi === true, '`lbc_fil_{conv}` : les messages, le compte de l’onglet, l’aperçu du dernier (scalaires lus par l’app)', JSON.stringify(fil && { c: fil.compte, n: fil.n, a: fil.apercu }));
    const G0 = faire();
    await G0.page({ action: 'lbcFil', conv: CONV, moi: U3, messages: msgsFil });
    await G0.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: msgsFil }, 42, 'https://evil.exemple.test/');
    dit(!G0.lignes[`lbc_fil_${CONV}`], 'un fil dont la page dit un AUTRE compte que l’onglet, ou venu d’un autre site : rien n’est rangé', JSON.stringify(G0.lignes[`lbc_fil_${CONV}`]));
    // Rien n'est parti tout seul (fil lu, recette apprise) — seulement sur SA commande.
    const r0 = await F.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Je poste demain' });
    dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && /envoie UNE réponse toi-même/.test(r0.raison) && F.ordres.length === 0, 'sans recette apprise : RIEN ne part, le geste est dit', JSON.stringify(r0));
    await F.page({ action: 'lbcEnvoiAppris', recette: Object.assign({}, recette, { entetes: ['x-lbc-auth', 'cookie'] }) });
    dit(F.lignes.lbc_envoi && F.lignes.lbc_envoi.appris === true && JSON.stringify(F.store.vrmLbcRecette.recette.entetes) === '["x-lbc-auth"]', 'la recette est rangée (sans en-tête interdit), `lbc_envoi.appris` pour l’app', JSON.stringify(F.lignes.lbc_envoi));
    dit(F.ordres.length === 0, 'fil lu ET recette apprise : rien n’est parti sans sa commande');
    const pg = await F.page({ action: 'lbcRepondre', conv: CONV, texte: 'envoyé par la page', cmd: 'lbcRepondre' });
    dit(F.ordres.length === 0, 'un message venu de la PAGE Leboncoin (pas de SA commande dans l’app) : rien ne part', JSON.stringify({ pg, n: F.ordres.length }));
    const r1 = await F.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: '  Je poste demain  ' });
    dit(r1 && r1.accepte === true && r1.etape === 'fait' && F.ordres.length === 1 && F.ordres[0].id === 41 && F.ordres[0].m.action === 'lbcRepondre' && F.ordres[0].m.texte === 'Je poste demain' && F.ordres[0].m.compte === U1, 'sur SA commande : UN ordre vers l’onglet Leboncoin du compte du fil, au nom de ce compte', JSON.stringify({ r1, o: F.ordres }));
    const env = (F.lignes[`lbc_fil_${CONV}`].messages || []).find((m) => m.t === 'Je poste demain');
    dit(!!env && env.deMoi === true && env.envoyeParVrm === true, 'le message envoyé rejoint le fil, « de toi », « envoyé depuis VRM »', JSON.stringify(env));
    dit(Array.isArray((F.store.vrmActions || {})['lbc:' + U1]) && F.store.vrmActions['lbc:' + U1].length === 1, 'il compte UNE action dans le plafond de l’heure du compte Leboncoin', JSON.stringify(F.store.vrmActions));
    const r2 = await F.cmd({ cmd: 'lbcRepondre', conv: 'cccccccc-0000-4000-8000-000000000009', texte: 'x' });
    dit(r2 && r2.accepte === false && r2.code === 'inconnue' && F.ordres.length === 1, 'une conversation que l’extension n’a pas lue : rien ne part', JSON.stringify(r2));
    F.store.vrmActions = { ['lbc:' + U1]: Array.from({ length: 50 }, () => Date.now()) };
    const r4 = await F.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'encore' });
    dit(r4 && r4.accepte === false && r4.code === 'plafond' && F.ordres.length === 1, 'le plafond de 50 actions/heure du compte : refus, rien ne part', JSON.stringify(r4));
    F.store.vrmActions = {};
    // L'onglet est connecté sur un AUTRE compte ⇒ refus.
    const M = faire({ cartes: { 41: { source: 'prive', compte: 'lbc-account:' + U1, ambigue: false, at: Date.now() } } });
    await M.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: msgsFil });
    await M.page({ action: 'lbcEnvoiAppris', recette });
    M.store.vrmLbcTransport = { 41: { source: 'prive', compte: 'lbc-account:' + U3, ambigue: false, at: Date.now() } };
    const m1 = await M.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(m1 && m1.accepte === false && m1.code === 'autre-compte' && M.ordres.length === 0, 'Leboncoin ouvert sur un AUTRE compte que celui de la conversation : rien ne part', JSON.stringify(m1));
    M.store.vrmLbcTransport = {};
    const m2 = await M.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(m2 && m2.accepte === false && m2.code === 'lbc-absent' && M.ordres.length === 0, 'aucun onglet Leboncoin connecté sur ce compte : rien ne part, aucun onglet ouvert à sa place', JSON.stringify(m2));
    // 429 ⇒ pause ; pendant la pause, rien ne part.
    const G = faire({ rep: () => ({ ok: true, statut: 429, cles: [] }) });
    await G.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: msgsFil });
    await G.page({ action: 'lbcEnvoiAppris', recette });
    const g1 = await G.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Bonjour' });
    const g2 = await G.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(g1 && g1.etape === 'refuse' && g1.statut === 429 && G.store.vrmPauseLbcMsg && g2 && g2.accepte === false && g2.code === 'lbc-pause' && G.ordres.length === 1, 'un 429 de Leboncoin pose la pause ; pendant la pause, RIEN ne part', JSON.stringify({ g1, g2, n: G.ordres.length }));
    // Arrêté AVANT de partir : la place est rendue.
    const K = faire({ rep: () => ({ ok: true, statut: 0, erreur: 'entetes', cles: [] }) });
    await K.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: msgsFil });
    await K.page({ action: 'lbcEnvoiAppris', recette });
    const k1 = await K.cmd({ cmd: 'lbcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(k1 && k1.accepte === false && k1.code === 'entetes' && ((K.store.vrmActions || {})['lbc:' + U1] || []).length === 0, 'arrêté avant de partir (pas d’en-têtes dans la page) : dit, et la place du plafond RENDUE', JSON.stringify({ k1, a: K.store.vrmActions }));
    // Lecture ratée : le fil n'est pas réécrit.
    const L = faire({ lectureKO: (u) => /lbc_fil_/.test(u) });
    const avantKO = JSON.stringify(fil);
    L.lignes[`lbc_fil_${CONV}`] = JSON.parse(avantKO);
    await L.page({ action: 'lbcFil', conv: CONV, moi: U1, messages: [{ id: 'm9', t: 'Nouveau', deMoi: false, at: '2026-11-03T09:00:00.000Z' }] });
    dit(JSON.stringify(L.lignes[`lbc_fil_${CONV}`]) === avantKO, 'une lecture ratée du fil n’écrit RIEN', '');
    const etat = await F.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(etat && etat.lbcRepondre === true, 'l’état de l’extension dit `lbcRepondre: true`', JSON.stringify(etat && Object.keys(etat)));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
