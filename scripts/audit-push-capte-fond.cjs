// ════════════════════════════════════════════════════════════════════════════
//  « SUR MON TÉLÉPHONE » — LE CÔTÉ EXTENSION (21 nov., ext. 5.422, `pushcapte`)
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs : base, Vinted et vrm.center inventés).
//  La source est celle de la carte et du journal (`annoncerCapte`) ; on regarde ce qui part vers
//  `POST vrm.center/api/push { action:'capte' }` :
//   F1. l'historique (1re lecture d'un compte) ne sonne JAMAIS ;
//   F2. une vente NOUVELLE ⇒ UN appel, tout de suite, qui ne porte que des identités ({ s, p, c, id }) ;
//   F3. jamais deux fois : la même vente relue, un autre passage ⇒ aucun appel de plus ;
//   F4. plusieurs en 2 min ⇒ elles attendent et partent ENSEMBLE, en UN appel, au bout des 2 min ;
//   F5. base muette (503), sans session : la file attend (rien perdu), repart UNE fois, pas de doublon ;
//   F6. une offre Vinted en attente dans une conversation rangée ⇒ « offre » (`conv@n° de l'offre`) ;
//   F7. Leboncoin, Vestiaire : ventes et messages, par la même source ;
//   F8. rien de plus vieux que 24 h ne part.
//  §6.1 : `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  vus: ['      if (st.vus[k]) continue;                              // jamais deux fois le même événement\n', ''],
  fenetre: ["  if (maintenant - st.dernier < PUSH_CAPTE_FENETRE_MS) { await ranger(); return { etat: 'attente'", "  if (false) { await ranger(); return { etat: 'attente'"],
  echec: ['  const fini = (status >= 200 && status < 300) || status === 400;', '  const fini = true;'],
  identites: ["body: JSON.stringify({ action: 'capte', evenements: lot.map((x) => ({ s: x.s, p: x.p, c: x.c, id: x.id })) })", "body: JSON.stringify({ action: 'capte', evenements: lot })"],
  branche: ["    if (nouveaux.length && PUSH_CAPTE_SORTES[sorte]) sansRejet(pousserCapte(plateforme, c, sorte, nouveaux), 'push_capte');   // 5.422 : sur son téléphone\n", ''],
  offre: ["  if (type === 'conversation' && uid) { const it = itemsOffreVinted(lus);", "  if (false) { const it = itemsOffreVinted(lus);"],
  age: ['  st.file = st.file.filter((x) => x && maintenant - Number(x.at || 0) < PUSH_CAPTE_AGE_MAX_MS);', ''],
  // (5.435) le message-offre aussi compté comme « message »
  lbcdouble: ["x.deMoi === false && x.id && !idsOffres.has(x.id)), () => compteFil", "x.deMoi === false && x.id), () => compteFil"],
  // (5.435) l'offre Leboncoin jamais captée
  lbcoffre: ["  if (ok === true && deVrm !== true && offresNeuves.length) await capteLbc('offres',", "  if (false) await capteLbc('offres',"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 180000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) { const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } SRC = path.join(os.tmpdir(), `bg-push-capte-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b)); }
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const UID = '111';
function monter({ statut = () => 200 } = {}) {
  const appels = [];
  const f = faireFond({ src: SRC, connecte: UID, lignes: {}, vrm: (e) => { if (/\/api\/push$/.test(new URL(e.url).pathname) && e.corps && e.corps.action === 'capte') { appels.push(e.corps); const st = statut(appels.length); return { status: st, body: st === 200 ? { ok: true } : { erreur: 'pas-su' } }; } return { status: 404, body: {} }; } });
  return { f, appels };
}
const H = 3600e3;
const ventes = (l) => ({ my_orders: l.map(([tx, t]) => ({ transaction_id: tx, title: 'Paire ' + tx, price: { amount: '45.0' }, date: new Date(t).toISOString() })) });
const capte = (m) => m.f.ctx.capteVinted(UID, 'orders_sold', m.p);
(async () => {
  {
    const t = monter();
    if (typeof t.f.ctx.pousserCapte !== 'function' || typeof t.f.ctx.pushCapteTick !== 'function') { dit(false, 'pousserCapte / pushCapteTick existent'); console.log(`\n❌ audit-push-capte-fond : ${ok} vert(s), ${ko + 1} rouge(s)`); process.exit(1); }
  }
  const T0 = Date.now();
  console.log('\nF1. L’historique ne sonne jamais');
  const m = monter();
  {
    await m.f.ctx.capteVinted(UID, 'orders_sold', ventes([[91000000001, T0 - 30 * 864e5], [91000000002, T0 - 2 * 864e5]]));
    await m.f.ctx.pushCapteTick(Date.now());
    dit(m.appels.length === 0, '1re lecture du compte (deux ventes anciennes) : aucun appel', JSON.stringify(m.appels));
  }
  console.log('\nF2. Une vente nouvelle ⇒ un appel, tout de suite, des identités seulement');
  {
    await m.f.ctx.capteVinted(UID, 'orders_sold', ventes([[91000000003, Date.now()], [91000000001, T0 - 30 * 864e5], [91000000002, T0 - 2 * 864e5]]));
    await m.f.ctx.pushCapteTick(Date.now());
    dit(m.appels.length === 1 && JSON.stringify(m.appels[0].evenements) === JSON.stringify([{ s: 'vente', p: 'vinted', c: UID, id: '91000000003' }]), 'UN appel { action:"capte", evenements:[{ s:"vente", p:"vinted", c, id }] }', JSON.stringify(m.appels));
    dit(m.appels.every((a) => a.evenements.every((e) => Object.keys(e).sort().join(',') === 'c,id,p,s')), 'ni titre, ni prix, ni pseudo dans le corps');
  }
  console.log('\nF3. Jamais deux fois');
  {
    await m.f.ctx.capteVinted(UID, 'orders_sold', ventes([[91000000003, Date.now()], [91000000001, T0 - 30 * 864e5]]));
    await m.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000003']);
    await m.f.ctx.pushCapteTick(Date.now() + 10 * 60000);
    dit(m.appels.length === 1, 'la même vente relue, poussée à nouveau, 10 min plus tard : aucun appel de plus', JSON.stringify(m.appels.length));
  }
  console.log('\nF4. Plusieurs en 2 min ⇒ un seul appel au bout des 2 min');
  {
    const n = monter();
    await n.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000010']);
    const t1 = Date.now();
    await n.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000011']);
    await n.f.ctx.pousserCapte('vinted', UID, 'messages', ['7003@2026-11-21T10:05:00+01:00']);
    const r1 = await n.f.ctx.pushCapteTick(t1 + 60e3);
    dit(n.appels.length === 1 && r1 && r1.etat === 'attente' && r1.n === 2, 'la 1re part seule ; les deux suivantes attendent (1 min après : toujours en attente)', JSON.stringify([n.appels.length, r1]));
    await n.f.ctx.pushCapteTick(t1 + 2 * 60e3 + 1000);
    dit(n.appels.length === 2 && n.appels[1].evenements.length === 2 && n.appels[1].evenements.map((e) => e.s).join(',') === 'vente,message', 'au bout des 2 min : UN appel avec les deux (le serveur en fait une notification)', JSON.stringify(n.appels));
    await n.f.ctx.pushCapteTick(t1 + 10 * 60e3);
    dit(n.appels.length === 2, 'puis plus rien');
  }
  console.log('\nF5. Base muette, sans session : rien perdu, rien en double');
  {
    const n = monter({ statut: (i) => (i === 1 ? 503 : 200) });
    await n.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000020']);
    const t1 = Date.now();
    await n.f.ctx.pushCapteTick(t1 + 30e3);
    dit(n.appels.length === 1, '503 : la file garde la vente ; 30 s après, on n’insiste pas', JSON.stringify(n.appels.length));
    await n.f.ctx.pushCapteTick(t1 + 61e3);
    await n.f.ctx.pushCapteTick(t1 + 5 * 60e3);
    dit(n.appels.length === 2 && n.appels[1].evenements[0].id === '91000000020', 'une minute après : repart UNE fois, puis plus rien', JSON.stringify(n.appels.map((a) => a.evenements.map((e) => e.id))));
    const s = monter();
    const vraie = s.f.ctx.authToken; s.f.ctx.authToken = async () => null;
    await s.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000021']);
    const avant = s.appels.length;
    s.f.ctx.authToken = vraie;
    await s.f.ctx.pushCapteTick(Date.now() + 1000);
    dit(avant === 0 && s.appels.length === 1 && s.appels[0].evenements[0].id === '91000000021', 'sans session : rien ne part, la vente attend ; la session revenue, elle part', JSON.stringify([avant, s.appels.length]));
  }
  console.log('\nF6. Une offre Vinted en attente');
  {
    const n = monter();
    const conv = (id, oid, t) => ({ conversation: { id, opposite_user: { id: 4242, login: 'julie_92' }, transaction: { item_title: 'Adidas Samba' }, messages: [{ entity_type: 'offer_request_message', created_at_ts: new Date(t).toISOString(), entity: { offer_request_id: oid, transaction_id: 5001, user_id: 4242, status: 10, status_title: 'En attente', current: true, price: { amount: '45.0' } } }] } });
    await n.f.ctx.capteVinted(UID, 'conversation', conv(7001, 8001, Date.now() - 864e5));
    await n.f.ctx.pushCapteTick(Date.now());
    dit(n.appels.length === 0, 'la 1re offre lue de ce compte : point de départ, en silence');
    await n.f.ctx.capteVinted(UID, 'conversation', conv(7002, 8002, Date.now()));
    await n.f.ctx.pushCapteTick(Date.now());
    dit(n.appels.length === 1 && JSON.stringify(n.appels[0].evenements) === JSON.stringify([{ s: 'offre', p: 'vinted', c: UID, id: '7002@8002' }]), 'une offre neuve ⇒ { s:"offre", id:"conv@n° de l’offre" }', JSON.stringify(n.appels));
    const sans = conv(7003, 8003, Date.now()); sans.conversation.messages[0].entity.status = 30; sans.conversation.messages[0].entity.status_title = 'Offre acceptée';
    await n.f.ctx.capteVinted(UID, 'conversation', sans);
    await n.f.ctx.pushCapteTick(Date.now() + 10 * 60e3);
    dit(n.appels.length === 1, 'une offre déjà tranchée ⇒ rien');
  }
  console.log('\nF7. Leboncoin, Vestiaire');
  {
    const n = monter();
    await n.f.ctx.pousserCapte('leboncoin', '77', 'ventes', ['lbc-tx-1']);
    await n.f.ctx.pousserCapte('vestiaire', 'vc1', 'offres', ['555@2026-11-21T09:30:00.000Z']);
    await n.f.ctx.pushCapteTick(Date.now() + 2 * 60e3 + 1000);
    const evs = n.appels.flatMap((a) => a.evenements);
    dit(evs.some((e) => e.p === 'leboncoin' && e.s === 'vente' && e.id === 'lbc-tx-1') && evs.some((e) => e.p === 'vestiaire' && e.s === 'offre'), 'une vente Leboncoin, une offre Vestiaire : dites', JSON.stringify(evs));
    await n.f.ctx.pousserCapte('vinted', UID, 'annonces', ['5000000001']);
    await n.f.ctx.pushCapteTick(Date.now() + 10 * 60e3);
    dit(!n.appels.flatMap((a) => a.evenements).some((e) => e.id === '5000000001'), 'une annonce (ni vente, ni offre, ni message) : jamais');
  }
  console.log('\nF9. Leboncoin : une offre reçue dans un fil (ext. 5.435), par le vrai rangement du fil');
  {
    const n = monter();
    n.f.store.vrmLbcCompte = { v: 2, id: '77' };
    if (typeof n.f.ctx.rangerLbcFil !== 'function') dit(false, 'rangerLbcFil existe');
    const fil = (msgs, offres) => n.f.ctx.rangerLbcFil({ conv: 'conv-lbc-1', messages: msgs, offres }, '77');
    const at0 = new Date(Date.now() - 3 * 864e5).toISOString();
    await fil([{ id: 'm1', t: 'Bonjour', deMoi: false, at: at0 }], [{ id: 'm0', at: at0, deMoi: false, c: 3000, s: '' }]);
    await n.f.ctx.pushCapteTick(Date.now() + 3 * 60e3);
    dit(!n.appels.length, 'le 1er fil lu (l’historique, une offre ancienne) ne sonne pas', JSON.stringify(n.appels));
    const ligne = n.f.lignes.lbc_fil_conv_lbc_1 || n.f.lignes['lbc_fil_conv-lbc-1'];
    dit(ligne && Array.isArray(ligne.offres) && ligne.offres.length === 1 && ligne.offres[0].c === 3000, 'l’offre est rangée dans le fil (identité, montant en centimes)', JSON.stringify(ligne && ligne.offres));
    const at1 = new Date().toISOString();
    await fil([{ id: 'm1', t: 'Bonjour', deMoi: false, at: at0 }, { id: 'm2', t: 'Je vous propose 40 €', deMoi: false, at: at1 }], [{ id: 'm0', at: at0, deMoi: false, c: 3000, s: '' }, { id: 'm2', at: at1, deMoi: false, c: 4000, s: '' }]);
    await n.f.ctx.pushCapteTick(Date.now() + 6 * 60e3);
    let evs = n.appels.flatMap((a) => a.evenements);
    dit(evs.length === 1 && evs[0].s === 'offre' && evs[0].p === 'leboncoin' && evs[0].id === 'conv-lbc-1:m2' && evs[0].c === '77', 'une offre NOUVELLE de l’autre personne ⇒ « offre » (`conv:n° du message`)', JSON.stringify(evs));
    dit(!evs.some((e) => e.s === 'message' && e.id === 'conv-lbc-1:m2'), 'le message qui EST l’offre ne sonne pas une 2e fois comme « message »', JSON.stringify(evs));
    await fil([{ id: 'm2', t: 'Je vous propose 40 €', deMoi: false, at: at1 }], [{ id: 'm2', at: at1, deMoi: false, c: 4000, s: '' }]);
    await n.f.ctx.pousserCapte('leboncoin', '77', 'offres', ['conv-lbc-1:m2']);
    await n.f.ctx.pushCapteTick(Date.now() + 12 * 60e3);
    evs = n.appels.flatMap((a) => a.evenements);
    dit(evs.filter((e) => e.id === 'conv-lbc-1:m2').length === 1, 'jamais deux fois : le fil relu, un autre passage ⇒ rien de plus', JSON.stringify(evs));
    const at2 = new Date(Date.now() + 1000).toISOString();
    await fil([], [{ id: 'm5', at: at2, deMoi: true, c: 4500, s: '' }]);
    await n.f.ctx.pushCapteTick(Date.now() + 20 * 60e3);
    evs = n.appels.flatMap((a) => a.evenements);
    dit(!evs.some((e) => e.id === 'conv-lbc-1:m5'), 'SA propre offre ne sonne pas', JSON.stringify(evs));
  }
  console.log('\nF8. Rien de plus vieux que 24 h');
  {
    const n = monter({ statut: () => 503 });
    await n.f.ctx.pousserCapte('vinted', UID, 'ventes', ['91000000030']);
    const nb = n.appels.length;
    const m2 = monter();
    m2.f.store.vrmPushCapte = JSON.parse(JSON.stringify(n.f.store.vrmPushCapte));
    await m2.f.ctx.pushCapteTick(Date.now() + 25 * H);
    dit(nb === 1 && m2.appels.length === 0 && (m2.f.store.vrmPushCapte.file || []).length === 0, 'une vente restée en file 25 h (serveur muet) : jetée, jamais dite en retard', JSON.stringify([nb, m2.appels.length, m2.f.store.vrmPushCapte]));
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-push-capte-fond : ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.unlinkSync(SRC); } catch (_) {}
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
