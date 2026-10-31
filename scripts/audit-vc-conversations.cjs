// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE : LE COMPTE OUVERT, TES CONVERSATIONS EN CLAIR, RÉPONDRE SUR SON
//  CLIC, ET LES FAVORIS (31 octobre, 5.295)
//
//  Julien : « au moins pouvoir lire les messages et écrire aux personnes, sans
//  forcément automatiser ». Ce qui doit rester vrai :
//   A. (le VRAI vc-inject.js dans Chromium, sous le nom de vestiairecollective.com,
//      nourri de données INVENTÉES de forme plausible — aucune de ces réponses
//      n'a jamais été vue chez lui) :
//      · `/users/me` ⇒ l'identifiant du compte, jamais son nom ni son e-mail ;
//      · un FIL ⇒ le texte des messages, leur date, « de toi » (auteur = compte
//        ouvert, ou une clé booléenne qui le dit) — jamais le nom de l'autre ;
//      · un envoi fait PAR LA PAGE ⇒ une RECETTE : chemin à trou `{conv}`, clé
//        du texte, mots fixes, NOMS des en-têtes — jamais ton texte ni une valeur
//        d'en-tête ; ce qui demanderait de deviner est « pas rejouable » ;
//      · l'ordre « répondre » rejoue EXACTEMENT la recette, avec les en-têtes que
//        la page vient d'envoyer ; sans eux, rien ne part ;
//      · les favoris d'une annonce : un NOMBRE, `null` sans clé qui le dise.
//   B. (le VRAI background.js dans un `vm`, `_fond-vm.cjs`) : le compte est tenu
//      PAR ONGLET ; un fil est rangé (lecture ratée ⇒ rien) ; répondre exige SA
//      commande, une recette rejouable, une conversation lue, un onglet du MÊME
//      compte, une place dans le plafond d'actions, aucune pause ; un 429 pose
//      la pause ; un envoi arrêté avant de partir rend sa place.
//  §4.10 / §6 : on EXÉCUTE le vrai code. `--src` / `--inj` : une autre copie
//  (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const argv = process.argv;
const injPath = argv.includes('--inj') ? path.resolve(argv[argv.indexOf('--inj') + 1]) : path.join(EXT, 'vc-inject.js');
const bgPath = argv.includes('--src') ? path.resolve(argv[argv.indexOf('--src') + 1]) : path.join(EXT, 'background.js');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const MOI = 'U4242', AUTRE = 'U9001', CONV = 'C7777';
const PERSO = ['Julien', 'Mouette', 'julien@exemple.test', 'Jeanne', 'Acheteuse', 'jeanne@exemple.test', 'jeton-tres-secret', 'avatar.exemple.test'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return PERSO.filter((x) => s.includes(x)); };

(async () => {
  // ══ A. vc-inject.js dans un vrai navigateur ══════════════════════════════
  await essaie('A. vc-inject.js', async () => {
    let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
    const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
    const inj = fs.readFileSync(injPath, 'utf8');
    const ouvrir = async () => {
      const c = await nav.newContext(); const p = await c.newPage();
      const recues = [];
      await c.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }));
      await c.route('https://apiv2.vestiairecollective.com/**', async (r) => {
        const q = r.request(); const u = q.url();
        recues.push({ methode: q.method(), url: u, entetes: q.headers(), corps: q.postData() });
        let body = { data: [] }, status = 200;
        if (/\/users\/me\/?$/.test(u)) body = { meta: {}, data: { id: MOI, type: 'users', firstName: 'Julien', lastName: 'Mouette', email: 'julien@exemple.test', avatar: 'https://avatar.exemple.test/a.png' } };
        else if (/\/users\/me\/conversations/.test(u)) body = { meta: { offset: 0, count: 1 }, data: [{ id: CONV, unreadCount: 1, updatedAt: '2026-10-31T09:00:00Z', product: { id: 900001, description: 'Réf. VRM-401' }, lastMessage: { content: 'Toujours dispo ?', sender: { id: AUTRE, firstName: 'Jeanne' } }, interlocutor: { firstName: 'Jeanne', lastName: 'Acheteuse' } }] };
        else if (new RegExp(`/conversations/${CONV}/messages$`).test(u) && q.method() === 'GET') body = { meta: { count: 3 }, data: [
          { id: 'M1', content: 'Bonjour, toujours dispo ?', createdAt: '2026-10-31T08:00:00Z', sender: { id: AUTRE, firstName: 'Jeanne', lastName: 'Acheteuse', email: 'jeanne@exemple.test' } },
          { id: 'M2', content: 'Oui, toujours !', createdAt: '2026-10-31T08:05:00Z', sender: { id: MOI, firstName: 'Julien' } },
          { id: 'M3', content: 'Super, je prends.', createdAt: '2026-10-31T08:06:00Z', sender: { id: AUTRE } }] };
        else if (/\/conversations\/[\w-]+\/messages$/.test(u) && q.method() === 'POST') { status = 201; body = { data: { id: 'M99', type: 'messages' } }; }
        else if (/\/users\/me\/product-listings/.test(u)) body = { meta: { offset: 0, count: 2 }, data: [{ id: 501, likesCount: 3, description: 'VRM-12' }, { id: 502, description: 'VRM-13' }] };
        return r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://fr.vestiairecollective.com', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
      });
      await p.goto('https://fr.vestiairecollective.com/messages/');
      await p.addScriptTag({ content: 'window.__msgs=[];window.addEventListener("message",(e)=>{if(e.data&&e.data.__tag==="CANCALE_VC")window.__msgs.push(e.data)});' });
      await p.addScriptTag({ content: inj });
      return { c, p, recues, msgs: (k) => p.evaluate((kk) => window.__msgs.filter((m) => m.kind === kk), k) };
    };
    const A = await ouvrir();
    const H = { 'x-vc-auth': 'jeton-tres-secret', 'content-type': 'application/json' };
    await A.p.evaluate(async ([h]) => {
      await fetch('https://apiv2.vestiairecollective.com/users/me', { headers: h }).then((r) => r.text());
      await fetch('https://apiv2.vestiairecollective.com/users/me/conversations', { headers: h }).then((r) => r.text());
      await fetch('https://apiv2.vestiairecollective.com/conversations/C7777/messages', { headers: h }).then((r) => r.text());
      await fetch('https://apiv2.vestiairecollective.com/users/me/product-listings?offset=0', { headers: h }).then((r) => r.text());
    }, [H]);
    await pause(400);
    const moi = await A.msgs('vcmoi');
    dit(moi.length === 1 && moi[0].id === MOI, '`/users/me` ⇒ l’identifiant du compte ouvert (et lui seul)', JSON.stringify(moi.map((m) => m.id)));
    dit(fuite(moi).length === 0, 'ni le nom, ni l’e-mail, ni l’avatar du compte ne sortent (la forme dit des types)', fuite(moi).join(','));
    const fil = (await A.msgs('vcfil'))[0];
    dit(!!fil && fil.conv === CONV && fil.messages.length === 3, 'le FIL d’une conversation : ses trois messages', JSON.stringify(fil && fil.messages));
    dit(!!fil && fil.messages[0].t === 'Bonjour, toujours dispo ?' && fil.messages[0].deMoi === false && fil.messages[1].deMoi === true && /2026-10-31T08:05/.test(fil.messages[1].at), 'le texte, la date, et « de toi » = l’auteur est le compte ouvert', JSON.stringify(fil && fil.messages.map((m) => [m.t, m.deMoi, m.at])));
    dit(fuite(fil).length === 0, 'aucun nom, aucun e-mail de l’autre personne ne sort du fil (ni dans sa forme)', fuite(fil).join(','));
    const liste = (await A.msgs('vcmessages'))[0];
    const c0 = liste && liste.conversations.find((c) => c.id === CONV);
    dit(!!c0 && c0.apercu === 'Toujours dispo ?' && c0.apercuDeMoi === false && liste.moi === MOI, 'la liste : l’aperçu du dernier message, « pas de toi », et le compte de l’onglet', JSON.stringify(c0));
    dit(fuite(liste).length === 0, 'la liste ne laisse sortir aucun nom', fuite(liste).join(','));
    const ann = (await A.msgs('vcannonces'))[0];
    const a1 = ann && ann.items.find((x) => x.id === '501'), a2 = ann && ann.items.find((x) => x.id === '502');
    dit(!!a1 && a1.favoris === 3 && a1.cleFavoris === 'likesCount' && !!a2 && a2.favoris === null, 'favoris : un NOMBRE lu sur une clé qui le dit ; sans clé ⇒ `null` (pas su), jamais 0', JSON.stringify([a1, a2]));

    // ── L'envoi que fait la PAGE : la recette, sans le texte ni les valeurs d'en-tête
    await A.p.evaluate(async ([h]) => {
      await fetch('https://apiv2.vestiairecollective.com/conversations/C7777/messages', { method: 'POST', headers: h, body: JSON.stringify({ data: { type: 'messages', attributes: { content: 'Merci beaucoup, je poste demain' } } }) }).then((r) => r.text());
    }, [H]);
    await pause(300);
    const rec = (await A.msgs('vcenvoiappris'))[0];
    const r = rec && rec.recette;
    dit(!!r && r.rejouable === true && r.methode === 'POST' && r.hote === 'apiv2.vestiairecollective.com' && r.modele === '/conversations/{conv}/messages', 'un envoi fait par la page ⇒ une recette REJOUABLE : méthode, hôte, chemin à trou `{conv}`', JSON.stringify(r));
    dit(!!r && JSON.stringify(r.cleTexte) === '["data","attributes","content"]' && JSON.stringify(r.fixes) === '[[["data","type"],"messages","string"]]', 'la clé du texte, et les mots fixes du corps (`type: messages`)', JSON.stringify(r && { t: r.cleTexte, f: r.fixes }));
    dit(!!r && JSON.stringify(r.entetes) === '["x-vc-auth"]' && !JSON.stringify(rec).includes('Merci') && fuite(rec).length === 0, 'les NOMS des en-têtes seulement — jamais leur valeur, jamais ton texte', JSON.stringify(rec));
    // ── Ce qui demanderait de deviner : « pas rejouable », avec sa raison
    await A.p.evaluate(async ([h]) => {
      await fetch('https://apiv2.vestiairecollective.com/conversations/C5555/messages', { method: 'POST', headers: h, body: JSON.stringify({ content: 'Coucou' }) }).then((r) => r.text());
      await fetch('https://apiv2.vestiairecollective.com/conversations/C7777/messages', { method: 'POST', headers: h, body: JSON.stringify({ content: 'Coucou', clientRef: 'a1b2-77zz' }) }).then((r) => r.text());
    }, [H]);
    await pause(300);
    const non = (await A.msgs('vcenvoiappris')).slice(1).map((m) => m.recette);
    dit(non.length === 2 && non[0].rejouable === false && non[0].raison === 'conversation-non-vue' && non[1].rejouable === false && non[1].raison === 'valeur-inconnue', 'une conversation jamais vue dans l’onglet, une valeur inconnue dans le corps ⇒ « pas rejouable », avec la raison', JSON.stringify(non));

    // ── L'ordre « répondre » : la recette rejouée telle quelle, avec les en-têtes DE LA PAGE
    const avant = A.recues.length;
    const res = await A.p.evaluate(async (recette) => {
      const j = 'jeton-ordre-0001';
      const p = new Promise((ok) => { window.addEventListener('message', (e) => { if (e.data && e.data.__tag === 'CANCALE_VC' && e.data.kind === 'vcenvoiresultat' && e.data.jeton === j) ok(e.data); }); setTimeout(() => ok(null), 4000); });
      window.postMessage({ __tag: 'CANCALE_VC_ORDRE', kind: 'repondre', jeton: j, conv: 'C7777', texte: 'Oui, envoi demain matin', recette }, '*');
      return p;
    }, r);
    const envoi = A.recues.slice(avant).filter((x) => x.methode === 'POST');
    dit(!!res && res.statut === 201 && res.idMsg === 'M99', 'l’ordre « répondre » part et rend le statut de Vestiaire et l’identifiant du message', JSON.stringify(res));
    dit(envoi.length === 1 && envoi[0].url === 'https://apiv2.vestiairecollective.com/conversations/C7777/messages' && envoi[0].corps === JSON.stringify({ data: { type: 'messages', attributes: { content: 'Oui, envoi demain matin' } } }), 'UNE requête : l’adresse et le corps de la recette, ton texte à sa place', JSON.stringify(envoi.map((x) => [x.url, x.corps])));
    dit(envoi.length === 1 && envoi[0].entetes['x-vc-auth'] === 'jeton-tres-secret', 'avec l’en-tête que la PAGE vient d’envoyer (gardé en mémoire dans la page, jamais transmis)', JSON.stringify(envoi[0] && envoi[0].entetes));
    const res2 = await A.p.evaluate(async (recette) => {
      const j = 'jeton-ordre-0002';
      const p = new Promise((ok) => { window.addEventListener('message', (e) => { if (e.data && e.data.__tag === 'CANCALE_VC' && e.data.kind === 'vcenvoiresultat' && e.data.jeton === j) ok(e.data); }); setTimeout(() => ok(null), 3000); });
      window.postMessage({ __tag: 'CANCALE_VC_ORDRE', kind: 'repondre', jeton: j, conv: 'C7777', texte: 'x', recette: Object.assign({}, recette, { hote: 'evil.exemple.test' }) }, '*');
      return p;
    }, r);
    dit(!!res2 && res2.statut === 0 && res2.erreur === 'recette', 'une recette vers un AUTRE hôte que Vestiaire est refusée (rien ne part)', JSON.stringify(res2));
    await A.c.close();
    // ── Une page qui n'a encore parlé à personne : pas d'en-têtes ⇒ rien ne part
    const B = await ouvrir();
    const n0 = B.recues.length;
    const res3 = await B.p.evaluate(async (recette) => {
      const j = 'jeton-ordre-0003';
      const p = new Promise((ok) => { window.addEventListener('message', (e) => { if (e.data && e.data.__tag === 'CANCALE_VC' && e.data.kind === 'vcenvoiresultat' && e.data.jeton === j) ok(e.data); }); setTimeout(() => ok(null), 3000); });
      window.postMessage({ __tag: 'CANCALE_VC_ORDRE', kind: 'repondre', jeton: j, conv: 'C7777', texte: 'Bonjour', recette }, '*');
      return p;
    }, r);
    dit(!!res3 && res3.statut === 0 && res3.erreur === 'entetes' && B.recues.length === n0, 'sans les en-têtes de la page (rien chargé depuis l’ouverture) : RIEN ne part, et c’est dit', JSON.stringify({ res3, n: B.recues.length - n0 }));
    await B.c.close();
    await nav.close();
    globalThis.__recette = r;
  });

  // ══ B. background.js dans un vm ══════════════════════════════════════════
  await essaie('B. background.js', async () => {
    const recette = globalThis.__recette || { methode: 'POST', hote: 'apiv2.vestiairecollective.com', chemin: '/conversations/{id}/messages', rejouable: true, raison: '', modele: '/conversations/{conv}/messages', recherche: '', cleTexte: ['data', 'attributes', 'content'], fixes: [[['data', 'type'], 'messages', 'string']], entetes: ['x-vc-auth'] };
    const VC = 'https://fr.vestiairecollective.com/messages/';
    const faire = (opts = {}) => {
      const f = faireFond({ src: bgPath, onglets: opts.onglets || [{ id: 31, url: VC, active: true }], lectureKO: opts.lectureKO || (() => false) });
      const ordres = [];
      f.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => {
        if (m && m.__vmrEvt) { f.j.evts.push(m.evt); if (typeof cb === 'function') cb(); return Promise.resolve(); }
        ordres.push({ id, m: JSON.parse(JSON.stringify(m)) });
        const rep = opts.rep ? opts.rep(m) : { ok: true, statut: 201, idMsg: 'M99', cles: [] };
        return Promise.resolve(rep);
      };
      const page = (msg, tabId = 31, url = VC) => f.envoyer(Object.assign({ from: 'cancale-vc' }, msg), { tab: { id: tabId, url } });
      const cmd = (msg) => f.envoyer(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' });
      return { ...f, ordres, page, cmd };
    };
    // Le compte, par onglet ; le fil ; la recette.
    const F = faire();
    await F.page({ action: 'vcMoi', id: MOI, forme: ['data.id:string'] });
    dit(F.lignes.vc_session && F.lignes.vc_session.id === MOI && F.store.vrmVcOnglets && F.store.vrmVcOnglets['31'] && F.store.vrmVcOnglets['31'].compte === MOI, '`vc_session = { id, at }` rangé, et le compte tenu PAR ONGLET', JSON.stringify({ s: F.lignes.vc_session, o: F.store.vrmVcOnglets }));
    const autreSite = await F.page({ action: 'vcMoi', id: 'PIRATE' }, 32, 'https://evil.exemple.test/');
    dit(F.lignes.vc_session.id === MOI && !(F.store.vrmVcOnglets || {})['32'], 'un message venu d’un autre site que Vestiaire ne pose rien', JSON.stringify(autreSite));
    await F.page({ action: 'vcFil', conv: CONV, productId: '900001', ref: '401', messages: [{ id: 'M1', t: 'Bonjour, toujours dispo ?', deMoi: false, at: '2026-10-31T08:00:00.000Z' }, { id: 'M2', t: 'Oui !', deMoi: true, at: '2026-10-31T08:05:00.000Z' }] });
    const fil = F.lignes[`vc_fil_${CONV}`];
    dit(!!fil && fil.compte === MOI && fil.n === 2 && fil.apercu === 'Oui !' && fil.dernierDeMoi === true && fil.dernierAt === '2026-10-31T08:05:00.000Z', '`vc_fil_{conv}` : les messages, le compte DE L’ONGLET, l’aperçu et le « de toi » du dernier (scalaires lus par l’app)', JSON.stringify(fil && { c: fil.compte, n: fil.n, a: fil.apercu, d: fil.dernierDeMoi }));
    await F.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M3', t: 'Super', deMoi: false, at: '2026-10-31T08:06:00.000Z' }] });
    dit(F.lignes[`vc_fil_${CONV}`].n === 3, 'une page qui ne rend que le dernier message n’efface pas les autres (fusion)', String(F.lignes[`vc_fil_${CONV}`].n));
    const avantKO = JSON.stringify(F.lignes[`vc_fil_${CONV}`]);
    // Répondre avant d'avoir appris : rien ne part, le geste est dit.
    const r0 = await F.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Je poste demain' });
    dit(r0 && r0.accepte === false && r0.code === 'pas-appris' && /envoie UNE réponse toi-même/.test(r0.raison) && F.ordres.length === 0, 'sans recette apprise : RIEN ne part, et le geste est dit', JSON.stringify(r0));
    await F.page({ action: 'vcEnvoiAppris', recette: Object.assign({}, recette, { entetes: ['x-vc-auth', 'cookie'] }) });
    dit(F.lignes.vc_envoi && F.lignes.vc_envoi.appris === true && F.store.vrmVcRecette && JSON.stringify(F.store.vrmVcRecette.recette.entetes) === '["x-vc-auth"]', 'la recette est rangée (sans en-tête interdit), `vc_envoi.appris` pour l’app', JSON.stringify(F.lignes.vc_envoi));
    await F.page({ action: 'vcEnvoiAppris', recette: { methode: 'POST', hote: 'apiv2.vestiairecollective.com', chemin: '/x', rejouable: false, raison: 'valeur-inconnue' } });
    dit(F.store.vrmVcRecette.recette.rejouable === true && F.store.vrmVcRecette.dernierEssai.raison === 'valeur-inconnue', 'un essai « pas rejouable » ne remplace jamais une recette rejouable (il est noté à côté)', JSON.stringify(F.store.vrmVcRecette.dernierEssai));
    // Répondre : la commande part vers l'onglet du MÊME compte, avec la recette.
    const r1 = await F.cmd({ cmd: 'vcRepondre', conv: CONV, texte: '  Je poste demain  ' });
    dit(r1 && r1.accepte === true && r1.etape === 'fait' && F.ordres.length === 1 && F.ordres[0].id === 31 && F.ordres[0].m.action === 'vcRepondre' && F.ordres[0].m.texte === 'Je poste demain' && F.ordres[0].m.conv === CONV, 'sur SA commande : UN ordre vers l’onglet Vestiaire du compte de la conversation, le texte nettoyé', JSON.stringify({ r1, o: F.ordres }));
    const f2 = F.lignes[`vc_fil_${CONV}`];
    const env = f2 && f2.messages.find((m) => m.t === 'Je poste demain');
    dit(!!env && env.deMoi === true && env.envoyeParVrm === true && env.id === 'M99', 'le message envoyé rejoint le fil : « de toi », « envoyé depuis VRM »', JSON.stringify(env));
    dit(Array.isArray((F.store.vrmActions || {})['vc:' + MOI]) && F.store.vrmActions['vc:' + MOI].length === 1, 'il compte UNE action dans le plafond de l’heure, sous le compte Vestiaire', JSON.stringify(F.store.vrmActions));
    // Conversation jamais lue ⇒ refus ; trop long ⇒ refus.
    const r2 = await F.cmd({ cmd: 'vcRepondre', conv: 'C1234', texte: 'x' });
    dit(r2 && r2.accepte === false && r2.code === 'inconnue' && F.ordres.length === 1, 'une conversation que l’extension n’a pas lue : rien ne part', JSON.stringify(r2));
    const r3 = await F.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'x'.repeat(2001) });
    dit(r3 && r3.accepte === false && r3.code === 'invalide' && F.ordres.length === 1, 'un message de plus de 2 000 caractères : rien ne part', JSON.stringify(r3 && r3.code));
    // Le plafond : 50 actions dans l'heure sur ce compte ⇒ refus.
    F.store.vrmActions = { ['vc:' + MOI]: Array.from({ length: 50 }, () => Date.now()) };
    const r4 = await F.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'encore' });
    dit(r4 && r4.accepte === false && r4.code === 'plafond' && F.ordres.length === 1, 'le plafond de 50 actions/heure du compte : refus, rien ne part', JSON.stringify(r4));
    F.store.vrmActions = {};
    // Un 429 ⇒ la pause ; pendant la pause, rien ne part.
    const G = faire({ rep: () => ({ ok: true, statut: 429, cles: [] }) });
    await G.page({ action: 'vcMoi', id: MOI });
    await G.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M1', t: 'Bonjour', deMoi: false, at: '2026-10-31T08:00:00.000Z' }] });
    await G.page({ action: 'vcEnvoiAppris', recette });
    const g1 = await G.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Bonjour' });
    const g2 = await G.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(g1 && g1.etape === 'refuse' && g1.statut === 429 && G.store.vrmPauseVc && g2 && g2.accepte === false && g2.code === 'vc-pause' && G.ordres.length === 1, 'un 429 de Vestiaire pose la pause ; pendant la pause, RIEN ne part', JSON.stringify({ g1, g2, n: G.ordres.length }));
    // Arrêté avant de partir (pas d'en-têtes dans la page) : la place est RENDUE.
    const K = faire({ rep: () => ({ ok: true, statut: 0, erreur: 'entetes', cles: [] }) });
    await K.page({ action: 'vcMoi', id: MOI });
    await K.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M1', t: 'Bonjour', deMoi: false, at: '2026-10-31T08:00:00.000Z' }] });
    await K.page({ action: 'vcEnvoiAppris', recette });
    const k1 = await K.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(k1 && k1.accepte === false && k1.code === 'entetes' && /recharge ta messagerie/.test(k1.raison) && ((K.store.vrmActions || {})['vc:' + MOI] || []).length === 0, 'arrêté AVANT de partir (la page n’a pas encore parlé à son serveur) : dit, et la place du plafond est RENDUE', JSON.stringify({ k1, a: K.store.vrmActions }));
    // L'onglet est sur un AUTRE compte que celui de la conversation ⇒ refus.
    const M = faire();
    await M.page({ action: 'vcMoi', id: MOI });
    await M.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M1', t: 'Bonjour', deMoi: false, at: '2026-10-31T08:00:00.000Z' }] });
    await M.page({ action: 'vcEnvoiAppris', recette });
    await M.page({ action: 'vcMoi', id: 'U5555' });
    const m1 = await M.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(m1 && m1.accepte === false && m1.code === 'autre-compte' && M.ordres.length === 0, 'Vestiaire ouvert sur un AUTRE compte que celui de la conversation : rien ne part', JSON.stringify(m1));
    // Aucun onglet dont on sait le compte ⇒ refus (jamais au nom d'un compte inconnu).
    const N = faire();
    await N.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M1', t: 'Bonjour', deMoi: false, at: '2026-10-31T08:00:00.000Z' }] }, 31);
    await N.page({ action: 'vcEnvoiAppris', recette });
    const n1 = await N.cmd({ cmd: 'vcRepondre', conv: CONV, texte: 'Bonjour' });
    dit(n1 && n1.accepte === false && n1.code === 'session' && N.ordres.length === 0, 'aucun onglet dont l’extension SAIT le compte : rien ne part, le geste est dit', JSON.stringify(n1));
    // Lecture ratée : le fil n'est pas réécrit.
    const L = faire({ lectureKO: (u) => /vc_fil_/.test(u) });
    L.lignes[`vc_fil_${CONV}`] = JSON.parse(avantKO);
    await L.page({ action: 'vcFil', conv: CONV, messages: [{ id: 'M9', t: 'Nouveau', deMoi: false, at: '2026-10-31T09:00:00.000Z' }] });
    dit(JSON.stringify(L.lignes[`vc_fil_${CONV}`]) === avantKO, 'une lecture ratée du fil n’écrit RIEN (elle effacerait les messages déjà rangés)', '');
    // L'app sait que l'extension sait répondre.
    const etat = await F.envoyer({ from: 'vmr-bridge', action: 'etat' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(etat && etat.vcRepondre === true, 'l’état de l’extension dit `vcRepondre: true` (l’app ne propose « Envoyer » qu’à elle)', JSON.stringify(etat && Object.keys(etat)));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
