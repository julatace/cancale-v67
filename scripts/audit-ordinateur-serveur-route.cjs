#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « MODE ORDINATEUR ALLUMÉ », LE CÔTÉ SERVEUR (28 nov., ext. 5.457.0, `serveur`)
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie route `api/push.js` (actions `serveur` et `tour`) et la vraie route des e-mails `api/email-inbound.js`
// sur une fausse base à état (forme app_data owner/id/data, projections, comparer-et-échanger sur `rev`) — §4.10.
// Aucune donnée réelle : tout est inventé (dépôt public).
//   R1  un message NEUF ⇒ UNE notification : le texte de l'acheteur (coupé proprement) · « compte shop_a » · l'article ;
//       le toucher ouvre CETTE conversation de CE compte
//   R2  le même rejoué ⇒ rien (clé réservée AVANT l'envoi)
//   R3  rien sans preuve : un message absent du fil rangé, un message de MOI, un compte Vinted d'un autre vendeur
//   R4  offre ⇒ « Offre 45 € sur Adidas Samba » · « compte shop_a · @julie_92 · Répondre » ; la clé de la voie « capte »
//   R5  « compte déconnecté » ⇒ une notification avec le geste ; rejouée ⇒ rien
//   R6  l'e-mail « nouveau message » de Vinted qui suit (même conversation) ⇒ PAS de seconde notification ;
//       l'e-mail d'une AUTRE conversation sonne toujours
//   R7  lecture ratée ⇒ 503, rien réservé, rien envoyé ; sans session ⇒ 401
//   R8  le tour : deux profils au même instant ⇒ UN seul l'obtient ; l'autre est refusé (qui, jusqu'à quand) ;
//       rendu ⇒ l'autre l'obtient ; périmé ⇒ libre ; un compte différent sur le même profil ⇒ refusé tant qu'il est tenu
//   R9  un seul compte Vinted chez le vendeur ⇒ le nom du compte n'est pas dit (Julien : « si j'en ai plusieurs »)
// `--prouve` : chaque mutation rend l'audit rouge. `--racine dossier` : un autre arbre (origin/main ⇒ rouge, §6.1).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const iR = args.indexOf('--racine');
const R = iR >= 0 ? path.resolve(args[iR + 1]) : path.join(__dirname, '..');

const MUTATIONS = {
  dedup: ['neufs = prouves.filter((x) => !ks.includes(cleServeur(x.e)));', 'neufs = prouves.slice();'],
  demoi: ["if (!de(en) || de(en) === e.c || (opp && de(en) !== opp)) return { rien: 'de-moi' };", ''],
  fil: ["if (!en) return { rien: 'pas-dans-le-fil' };", "if (!en) return { d: { ...base, texte: 'inventé' } };"],
  compte: ["if (!compte) return { rien: 'compte' };", "if (!compte) return { d: {} };"],
  email: ['return at > 0 && maintenant - at < SRV_EMAIL_FENETRE_MS && at <= maintenant + 60000;', 'return false;'],
  emailroute: ['if (!dejaServeur) try { await pushOnce({', 'try { await pushOnce({'],
  lecture: ["if (r === null) return { status: 503, raison: 'pas-su' };\n    if (r.rien) { rien++; continue; }\n    prouves.push({ e, d: r.d || {} });\n  }\n  if (!prouves.length) return { status: 200, envoye: false, coupe, rien, n: 0 };\n  let neufs", "if (r === null) continue;\n    if (r.rien) { rien++; continue; }\n    prouves.push({ e, d: r.d || {} });\n  }\n  if (!prouves.length) return { status: 200, envoye: false, coupe, rien, n: 0 };\n  let neufs"],
  tour: ["if (cur && (cur.par !== app || cur.compte !== compte)) return { refus: 'occupe', tour: cur };", ''],
  texte: ["return { d: { ...base, texte, at:", "return { d: { ...base, texte: '', at:"],
  plusieurs: ['const plusieurs = comptes.length > 1;', 'const plusieurs = false;'],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of ['(témoin, sans mutation)', ...Object.keys(MUTATIONS)]) {
    const dos = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-route-mut-'));
    let rouge = false;
    try {
      execFileSync('cp', ['-r', path.join(R, 'api'), dos]);
      execFileSync('cp', ['-r', path.join(R, 'src'), dos]);
      fs.symlinkSync(path.join(R, 'node_modules'), path.join(dos, 'node_modules'));
      fs.copyFileSync(path.join(R, 'package.json'), path.join(dos, 'package.json'));
      const [a, b] = MUTATIONS[m] || ['', ''];
      let fait = !MUTATIONS[m];
      for (const f of ['api/_lib/push-serveur.js', 'api/email-inbound.js', 'src/ordinateurServeur.js']) {
        const p = path.join(dos, f); const s = fs.readFileSync(p, 'utf8');
        if (a && s.includes(a)) { fs.writeFileSync(p, s.split(a).join(b)); fait = true; }
      }
      if (!fait) { console.log(`❌ mutation ${m} introuvable`); rates++; continue; }
      try { execFileSync(process.execPath, [__filename, '--racine', dos], { stdio: 'pipe', timeout: 180000 }); } catch (e) { rouge = e.status === 1; }
    } finally { try { fs.rmSync(dos, { recursive: true, force: true }); } catch (_) {} }
    if (!MUTATIONS[m]) { console.log(`${rouge ? '❌' : '✅'} ${m} ⇒ ${rouge ? 'ROUGE (la copie ne tourne pas)' : 'vert'}`); if (rouge) rates++; continue; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + String(d).slice(0, 600) : '')); } };
const { fauxInbound, A } = require(path.join(__dirname, '_faux-inbound.cjs'));
const AUTRE = '99999999-2222-3333-4444-555555555555';
const JETON = 'aaa.bbb.julien', JETON_AUTRE = 'aaa.bbb.autre';
const pushes = [];
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

(async () => {
  const F = fauxInbound(R);
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BNbanc';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  webpush.sendNotification = async (sub, body) => { const b = JSON.parse(body); for (const k of ['title', 'body']) if (typeof b[k] === 'string') b[k] = b[k].replace(/[  ]/g, ' '); pushes.push({ tel: sub.endpoint, ...b }); return { statusCode: 201 }; };
  let panne = new Set();
  let compteurs = { comptes: null };
  // La session (`/auth/v1/user`), les comptes Vinted du vendeur, les pannes de lecture ; le reste : la fausse base.
  global.fetch = async (url, o = {}) => {
    const u = new URL(String(url));
    if (u.pathname.endsWith('/auth/v1/user')) {
      const a = String((o.headers || {}).Authorization || (o.headers || {}).authorization || '');
      if (a === 'Bearer ' + JETON) return new Response(JSON.stringify({ id: A, email: 'j@banc.test' }), { status: 200 });
      if (a === 'Bearer ' + JETON_AUTRE) return new Response(JSON.stringify({ id: AUTRE, email: 'k@banc.test' }), { status: 200 });
      return new Response('{}', { status: 401 });
    }
    if (u.pathname === '/rest/v1/vinted_accounts' && (o.method || 'GET') === 'GET') {
      if (panne.has('vinted_accounts')) return new Response('<html>522</html>', { status: 522 });
      const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '');
      const l = (compteurs.comptes || []).filter((x) => !own || x.owner === own);
      return new Response(JSON.stringify(l.map((x) => ({ vinted_user_id: x.vinted_user_id, login: x.login }))), { status: 200 });
    }
    if (u.pathname === '/rest/v1/app_data' && (o.method || 'GET') === 'GET' && [...panne].some((p) => (u.searchParams.get('id') || '').includes(p))) return new Response('<html>522</html>', { status: 522 });
    return F.fauxFetch(url, o);
  };
  const notreFetch = global.fetch;
  const recoit0 = F.recoit; F.recoit = async (m) => { const x = await recoit0(m); global.fetch = notreFetch; return x; };
  await F.charger(); global.fetch = notreFetch;
  const route = (await import('file://' + path.join(R, 'api', 'push.js') + '?srv')).default;
  let P = null; try { P = await import('file://' + path.join(R, 'api', '_lib', 'push.js')); } catch (_) {}
  const appeler = async (corps, jeton = JETON) => { try { P && P.oublierPrefsVues && P.oublierPrefsVues(); } catch (_) {} const res = faireRes(); await route({ method: 'POST', headers: { authorization: 'Bearer ' + jeton, origin: 'chrome-extension://banc' }, body: corps }, res); return res; };
  const get = (id, owner = A) => F.base.get(`${owner}|${id}`);
  const set = (id, d, owner = A) => F.base.set(`${owner}|${id}`, JSON.parse(JSON.stringify(d)));
  const NOW = Date.now();
  const texteLong = 'Bonjour ! Est-ce que la paire taille grand ou normal ? Je fais du 42 en Nike mais du 42,5 en Adidas, et je voudrais être sûr avant de faire une offre, merci beaucoup 🙏';
  function prepare({ unSeul = false } = {}) {
    F.vider(); pushes.length = 0; panne = new Set();
    compteurs.comptes = [{ owner: A, vinted_user_id: '111', login: 'shop_a' }, ...(unSeul ? [] : [{ owner: A, vinted_user_id: '112', login: 'shop_b' }]), { owner: AUTRE, vinted_user_id: '222', login: 'autre_vendeur' }];
    set('push_subs', { subs: [{ endpoint: 'https://web.push.apple.com/iphone-julien', keys: { p256dh: 'x', auth: 'y' } }] });
    set('harvest_111_conv_7001', { type: 'conversation', payload: { conversation: { id: 7001, opposite_user: { id: 4444, login: 'leo_x' }, transaction: { item_title: 'Adidas Samba', item_id: 6001 },
      messages: [
        { entity_type: 'message', created_at_ts: Math.floor((NOW - 3600000) / 1000), entity: { id: 50001, user_id: 4444, body: 'Bonjour, toujours dispo ?' } },
        { entity_type: 'message', created_at_ts: Math.floor((NOW - 3000000) / 1000), entity: { id: 50002, user_id: 111, body: 'Oui !' } },
        { entity_type: 'message', created_at_ts: Math.floor((NOW - 60000) / 1000), entity: { id: 50003, user_id: 4444, body: texteLong } },
      ] } } });
    set('harvest_111_conv_7002', { type: 'conversation', payload: { conversation: { id: 7002, opposite_user: { id: 4242, login: 'julie_92' }, transaction: { item_title: 'Adidas Samba', item_id: 6001 },
      messages: [{ entity_type: 'offer_request_message', created_at_ts: Math.floor((NOW - 30000) / 1000), entity: { offer_request_id: 8001, transaction_id: 5001, user_id: 4242, status: 10, status_title: 'En attente', current: true, price: { amount: '45.0' } } }] } } });
    set('harvest_222_conv_9001', { type: 'conversation', payload: { conversation: { id: 9001, opposite_user: { id: 4646, login: 'x_x' }, messages: [{ entity_type: 'message', created_at_ts: Math.floor(NOW / 1000), entity: { id: 59001, user_id: 4646, body: 'secret' } }] } } }, AUTRE);
  }
  const msg = (o = {}) => Object.assign({ s: 'message', c: '111', conv: '7001', mid: '50003' }, o);

  console.log('\nR1. Un message neuf ⇒ une notification avec SA question et SON compte');
  prepare();
  let r = await appeler({ action: 'serveur', evenements: [msg()] });
  dit(r.code === 200 && pushes.length === 1, 'R1a 200 et UNE notification', JSON.stringify([r.code, r.corps, pushes.length]));
  const p1 = pushes[0] || {};
  dit(p1.title === 'Message de @leo_x', 'R1b titre « Message de @leo_x »', p1.title);
  dit(/^Bonjour ! Est-ce que la paire taille grand ou normal \? /.test(p1.body || '') && /… · compte shop_a · Adidas Samba$/.test(p1.body || ''),
    'R1c corps = le TEXTE de l’acheteur coupé proprement (« … ») · « compte shop_a » · l’article', p1.body);
  { const t = String(p1.body || '').split(' · ')[0]; const tete = t.replace(/…$/, ''); dit(/…$/.test(t) && texteLong.startsWith(tete + ' ') && String(p1.body || '').length <= 90, 'R1d coupé à un espace (jamais au milieu d’un mot), le tout tient en 90 caractères', JSON.stringify([t, String(p1.body || '').length])); }
  dit(/tab=messages/.test(p1.url || '') && /conv=7001/.test(p1.url || '') && /compte=111/.test(p1.url || ''), 'R1e le toucher ouvre CETTE conversation de CE compte', p1.url);
  dit(((get('push_dedup') || {}).keys || []).includes('msg-srv-vinted-7001-50003'), 'R1f la clé (conversation + n° du message) est réservée', JSON.stringify(get('push_dedup')));

  console.log('\nR2. Jamais deux fois');
  r = await appeler({ action: 'serveur', evenements: [msg()] });
  dit(r.code === 200 && pushes.length === 1 && r.corps.deja === 1, 'R2a le même message rejoué ⇒ rien', JSON.stringify([r.corps, pushes.length]));

  console.log('\nR3. Rien sans preuve');
  prepare();
  r = await appeler({ action: 'serveur', evenements: [msg({ mid: '50099' })] });
  dit(r.code === 200 && pushes.length === 0, 'R3a un message absent du fil rangé ⇒ rien', JSON.stringify([r.corps, pushes.length]));
  r = await appeler({ action: 'serveur', evenements: [msg({ mid: '50002' })] });
  dit(r.code === 200 && pushes.length === 0, 'R3b un message de MOI (le vendeur) ⇒ rien', JSON.stringify([r.corps, pushes.length]));
  r = await appeler({ action: 'serveur', evenements: [{ s: 'message', c: '222', conv: '9001', mid: '59001' }] });
  dit(r.code === 200 && pushes.length === 0, 'R3c le compte Vinted d’un AUTRE vendeur ⇒ rien (son texte ne sort jamais)', JSON.stringify([r.corps, pushes.length]));
  r = await appeler({ action: 'serveur', evenements: [{ s: 'message', c: '111', conv: '7001', mid: '50003', texte: 'texte inventé par le corps' }] });
  dit(pushes.length === 1 && !/inventé/.test(pushes[0].body), 'R3d ce que le corps prétend n’est jamais cru : le texte vient de SES lignes', JSON.stringify(pushes[0]));

  console.log('\nR4. Une offre');
  prepare();
  r = await appeler({ action: 'serveur', evenements: [{ s: 'offre', c: '111', conv: '7002', oid: '8001' }] });
  const p4 = pushes[0] || {};
  dit(pushes.length === 1 && p4.title === 'Offre 45 € sur Adidas Samba' && p4.body === 'compte shop_a · @julie_92 · Répondre', 'R4a « Offre 45 € sur Adidas Samba » · « compte shop_a · @julie_92 · Répondre »', JSON.stringify([p4.title, p4.body]));
  dit(/cible=offre/.test(p4.url || '') && /conv=7002/.test(p4.url || ''), 'R4b le toucher ouvre l’offre dans SA conversation', p4.url);
  dit(((get('push_dedup') || {}).keys || []).includes('offer-capte-vinted-8001'), 'R4c la clé de la voie « capte » : l’une des deux se tait');

  console.log('\nR5. Compte déconnecté');
  prepare();
  const at = NOW - 5000;
  r = await appeler({ action: 'serveur', evenements: [{ s: 'deconnecte', c: '111', at, ordi: 'Chrome · Mac' }] });
  const p5 = pushes[0] || {};
  dit(pushes.length === 1 && p5.title === 'Compte shop_a déconnecté' && /Chrome · Mac/.test(p5.body || '') && /reconnecte-toi sur vinted\.fr/.test(p5.body || ''), 'R5a « Compte shop_a déconnecté » avec le geste', JSON.stringify([p5.title, p5.body]));
  dit(/tab=serveur/.test(p5.url || ''), 'R5b le toucher ouvre la page « Ordinateur serveur »', p5.url);
  r = await appeler({ action: 'serveur', evenements: [{ s: 'deconnecte', c: '111', at, ordi: 'Chrome · Mac' }] });
  dit(pushes.length === 1, 'R5c la même déconnexion rejouée ⇒ rien');

  console.log('\nR6. L’e-mail de Vinted qui suit ne sonne pas une seconde fois');
  prepare();
  await appeler({ action: 'serveur', evenements: [msg()] });
  const n0 = pushes.length;
  const email = (conv, n) => ({ from: 'Vinted <no-reply@vinted.fr>', subject: 'Nouveau message à propos de Adidas Samba', text: `leo_x t'a envoyé un message\n\n« ${texteLong.slice(0, 60)} »\n\nRéponds ici : https://www.vinted.fr/inbox/${conv}`, messageId: `<msg-${n}@vinted.banc>` });
  const re1 = await F.recoit(email('7001', 1));
  dit(re1.code === 200 && pushes.length === n0, 'R6a l’e-mail « nouveau message » de la MÊME conversation ⇒ aucune seconde notification', JSON.stringify([re1.code, re1.corps, pushes.slice(n0)]));
  const re2 = await F.recoit(email('7555', 2));
  dit(re2.code === 200 && pushes.length === n0 + 1, 'R6b l’e-mail d’une AUTRE conversation sonne toujours (rien n’est avalé)', JSON.stringify([re2.code, re2.corps, pushes.length - n0]));
  // fenêtre dépassée : l'e-mail sonne
  const vu = get('push_serveur_vu'); if (vu && vu.c && vu.c.k7001) { vu.c.k7001.msgAt = Date.now() - 2 * 3600000; vu.c.k7001.at = Date.now() - 2 * 3600000; set('push_serveur_vu', vu); }
  const re3 = await F.recoit(email('7001', 3));
  dit(re3.code === 200 && pushes.length === n0 + 2, 'R6c plus de 45 min après : l’e-mail sonne (c’est un autre message)', JSON.stringify([pushes.length - n0]));

  console.log('\nR7. Pas su ⇒ rien');
  prepare();
  panne.add('harvest_111_conv_7001');
  r = await appeler({ action: 'serveur', evenements: [msg()] });
  dit(r.code === 503 && pushes.length === 0 && !((get('push_dedup') || {}).keys || []).length, 'R7a lecture ratée ⇒ 503, rien réservé, rien envoyé', JSON.stringify([r.code, r.corps]));
  panne = new Set(['vinted_accounts']);
  r = await appeler({ action: 'serveur', evenements: [msg()] });
  dit(r.code === 503 && pushes.length === 0, 'R7b comptes illisibles ⇒ 503', JSON.stringify([r.code]));
  panne = new Set();
  r = await appeler({ action: 'serveur', evenements: [msg()] }, 'mauvais');
  dit(r.code === 401 && pushes.length === 0, 'R7c sans session ⇒ 401', r.code);
  r = await appeler({ action: 'serveur', evenements: [{ s: 'message', c: 'abc' }] });
  dit(r.code === 400, 'R7d une forme refusée ⇒ 400', r.code);

  console.log('\nR8. Le tour d’écriture des profils');
  prepare();
  const P1 = 'a1a1a1a1a1a1a1a1', P2 = 'b2b2b2b2b2b2b2b2';
  const [t1, t2] = await Promise.all([
    appeler({ action: 'tour', quoi: 'prendre', appareil: P1, compte: '111', geste: 'repondre' }),
    appeler({ action: 'tour', quoi: 'prendre', appareil: P2, compte: '112', geste: 'repondre' }),
  ]);
  const okN = [t1, t2].filter((x) => x.code === 200 && x.corps.ok === true).length;
  const refuse = [t1, t2].find((x) => x.code === 200 && x.corps.ok === false);
  dit(okN === 1 && refuse && refuse.corps.occupe === true, 'R8a deux profils au même instant ⇒ UN seul a le tour', JSON.stringify([t1.corps, t2.corps]));
  const gagnant = t1.corps.ok ? P1 : P2, perdant = t1.corps.ok ? P2 : P1, cg = t1.corps.ok ? '111' : '112', cp = t1.corps.ok ? '112' : '111';
  dit(refuse && refuse.corps.par === gagnant && refuse.corps.compte === cg && refuse.corps.jusqua > Date.now(), 'R8b le refusé sait qui a le tour et jusqu’à quand', JSON.stringify(refuse && refuse.corps));
  r = await appeler({ action: 'tour', quoi: 'prendre', appareil: gagnant, compte: cp });
  dit(r.code === 200 && r.corps.ok === false, 'R8c le même profil pour un AUTRE compte ⇒ refusé tant qu’il est tenu', JSON.stringify(r.corps));
  r = await appeler({ action: 'tour', quoi: 'rendre', appareil: perdant, compte: cp });
  r = await appeler({ action: 'tour', quoi: 'prendre', appareil: perdant, compte: cp });
  dit(r.corps.ok === false, 'R8d « rendre » par un autre profil ne libère rien', JSON.stringify(r.corps));
  await appeler({ action: 'tour', quoi: 'rendre', appareil: gagnant, compte: cg });
  r = await appeler({ action: 'tour', quoi: 'prendre', appareil: perdant, compte: cp });
  dit(r.code === 200 && r.corps.ok === true, 'R8e rendu ⇒ l’autre l’obtient', JSON.stringify(r.corps));
  const tr = get('tour_ecriture'); tr.jusqua = Date.now() - 1000; set('tour_ecriture', tr);
  r = await appeler({ action: 'tour', quoi: 'prendre', appareil: gagnant, compte: cg });
  dit(r.code === 200 && r.corps.ok === true, 'R8f un tour périmé (profil tué) est libre', JSON.stringify(r.corps));
  r = await appeler({ action: 'tour', quoi: 'prendre', appareil: 'pas-un-id', compte: cg });
  dit(r.code === 400, 'R8g une forme refusée ⇒ 400', r.code);
  dit(!F.base.has(`${AUTRE}|tour_ecriture`), 'R8h le tour vit dans la ligne du vendeur de la SESSION');

  console.log('\nR9. Un seul compte Vinted ⇒ le nom du compte n’est pas dit');
  prepare({ unSeul: true });
  await appeler({ action: 'serveur', evenements: [msg()] });
  dit(pushes.length === 1 && !/compte shop_a/.test(pushes[0].body || '') && /· Adidas Samba$/.test(pushes[0].body || ''), 'R9 « compte X » seulement s’il en a plusieurs', pushes[0] && pushes[0].body);

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ exception : ' + (e && e.stack || e)); process.exit(1); });
