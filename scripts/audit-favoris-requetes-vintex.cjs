#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS « COMME VINTEX » PAR LES REQUÊTES DE LA PAGE (ext. 5.455, `favorisvintex`)
//
//  Julien, 26 nov. soir, après les rapports de l'Observateur (Vintex : aucune action à la main, tout depuis l'onglet vinted.fr) :
//  « A, fais comme Vintex ». On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) face à un faux Vinted :
//   V1  l'ordre de Vintex : inquiries → conversation relue → transaction → offre → message ; les corps de Vintex ; envoyé ;
//       aucun clic (`interfaceVinted` jamais appelé) ; jamais d'`Authorization` ; cookies de la page (`credentials: include`)
//   V2  la conversation relue porte une AUTRE personne ⇒ ni offre ni message
//   V3  la conversation porte déjà un message écrit ⇒ ni offre ni message (« déjà contactée »)
//   V4  la transaction porte un AUTRE article ⇒ ni offre ni message
//   V11 un 400 quand Vinted exige de vérifier le téléphone ⇒ « telephone_a_verifier », la version du texte n'est PAS punie
//   V5  l'offre refusée par Vinted (422) ⇒ aucun message (jamais une offre annoncée qui n'existe pas)
//   V6  Vinted freine (429) dès la conversation ⇒ plus rien ne part, le frein est dit
//   V7  `vintedPageFavori` refuse toute autre écriture (supprimer, prix, ancienne messagerie) : rien ne part
//   V8  `vrmFavorisChemin: 'interface'` ⇒ l'ancien chemin par les clics (réserve), aucune requête d'écriture fabriquée
//   V9  sans onglet vinted.fr sur ce compte ⇒ rien ne part
//   V10 la transaction absente de la nouvelle messagerie ⇒ lue par l'ancien n° de CETTE conversation, vérifiée, envoyé
//  5.455.3 (Julien, 27 nov. 17:31 « 0 envoyé · article ou destinataire pas confirmé », la file arrêtée ; 17:40 « tu dois faire
//  comme les concurrents ») — la FORME MESURÉE le 23 nov. (`inquiries` 201 → {inquiry_id, transaction_id, conversation_id,
//  read_after_write_token} ; conversation : id, core_id_deprecated, opposite_users[], data SANS items ; ancienne relecture 404) :
//   V12 création fraîche, conversation sans `data.items` ni transaction ⇒ la transaction de la CRÉATION, offre + message envoyés
//   V13 conversation sans `opposite_users` ni `data.items`, transaction sans acheteur ⇒ envoyé (l'identité de la demande)
//   V14 conversation pas encore servie (404) à la 1re lecture ⇒ relue, envoyé
//   V15 conversation jamais relue ⇒ SAUTÉ (`ignore`, `fil_non_relu`), ni offre ni message, la file continue
//   V16 contradictions LUES ⇒ refus nommé à l'étape « vérification » : autre personne, autre article (`item_id` d'une ligne),
//       deux transactions différentes ; ids en texte, le vendeur lui-même dans la liste ⇒ envoyé
//   V17 {marque} inconnue ⇒ la version neutre part ; jamais « article ou destinataire pas confirmé »
//   V18 transaction illisible ⇒ le prix de SON dressing (par l'identifiant), le plancher tenu, offre + message
//  `AUDIT_BG=<chemin>` juge un autre background.js (le code d'avant : rouge).
//  `--mutation=nom` ; `--prouve` : chaque mutation doit rendre l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
let BG = process.env.AUDIT_BG || path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  'sans-personne': ["if(personnes.length>1||(personnes.length===1&&personnes[0]!==body.recipientId)){noterDiag('favori_req_autre_personne');", "if(false){"],
  'tx-creation-ignoree': ["const txQ=txCreationFavori(q.json);", "const txQ='';"],
  'une-seule-lecture': ["for(let k=0;k<3&&!cv;k++){", "for(let k=0;k<1&&!cv;k++){"],
  'identite-stricte': ["if(!trLu)noterDiag(", "if(!trLu&&!(articles.length===1&&personnes.length===1))return rep('refuse',ln.status,'identite_non_confirmee');if(!trLu)noterDiag("],
  'fil-arrete': ["return rep('ignore',ln&&ln.status||0,'fil_non_relu');", "return rep('refuse',ln&&ln.status||0,'identite_non_confirmee');"],
  'sans-article': ["if(articles.length>1||(articles.length===1&&articles[0]!==body.itemId)){", "if(false){"],
  'sans-prix-dressing': ["if(it&&!(Number(prixAnnonce)>0)){", "if(false){"],
  'variable-bloque': ["if (manques.size && [...manques].every((k) => NEUTRES.includes(k) && !val[k])) {", "if (false) {"],
  'sans-historique': ['if(ecritsAvant>0||(cv.pagination', 'if(false&&(cv.pagination'],
  'sans-article-tx': ["if(!tr||artTx!==body.itemId){", "if(!tr){"],
  'offre-ignoree': ["if(!offreFaite)return o.status", "if(false)return o.status"],
  'porte-ouverte': ['function ecritureFavoriPermise(adresse) { const a = String(adresse || \'\'); return ECRITURES_FAVORI.some((re) => re.test(a)); }', 'function ecritureFavoriPermise(adresse) { return true; }'],
  'telephone-ignore': ["if(await telephoneAVerifierVinted(acc)===true){", "if(false){"],
  'chemin-ignore': ["if((await cheminFavoris())==='requetes'){", "if(true){"],
};
const argMut = (() => { const a = process.argv.find((x) => x.startsWith('--mutation=')); return a ? a.slice(11) : ''; })();
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ V\d/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8'); if (!s.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  const dest = path.join(os.tmpdir(), `bg-favoris-vintex-${argMut}-${process.pid}.js`); fs.writeFileSync(dest, s.split(M[0]).join(M[1])); BG = dest;
  process.on('exit', () => { try { fs.unlinkSync(dest); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };
const UID = '111', JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', UUID = '01a1fdff-71a1-4c2b-9d3e-0123456789ab';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
function monter(o = {}) {
  const conv = o.convBrute || Object.assign({ id: UUID, core_id_deprecated: 301, allow_reply: true, opposite_users: [{ id: 201, login: 'pseudo_banc' }], data: { transaction_id: 5001, items: [{ id: 101 }] }, messages: [] }, o.conv || {});
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } }, ...(o.dressing ? { [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: o.dressing } } } : {}) };
  let lectures = 0;
  const store = { __commeBleamDefaut: true, ...(o.chemin ? { vrmFavorisChemin: o.chemin } : { __favorisVintex: true }) };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store,
    vinted: (e) => {
      if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return o.inquiry || { status: 201, body: { id: UUID, conversation_id: UUID } };
      if (e.methode === 'GET' && e.chemin === `/messaging/main/conversations/${UUID}`) { lectures++; if (o.convJamais || lectures <= (o.conv404 || 0)) return { status: 404, body: { code: 404 } }; return { status: 200, body: o.convPlate ? conv : { conversation: conv } }; }
      if (e.methode === 'GET' && e.chemin === '/api/v2/conversations/301') return o.ancienne404 ? { status: 404, body: { code: 404 } } : { status: 200, body: { conversation: { id: 301, opposite_user: { id: 201 }, transaction: { id: 5001, item_id: 101 } } } };
      if (e.methode === 'GET' && /^\/api\/v2\/transactions\/\d+$/.test(e.chemin)) { if (o.tx404) return { status: 404, body: { code: 404 } }; return { status: 200, body: { transaction: o.txBrute || Object.assign({ id: 5001, item_id: 101, buyer_id: 201, item_title: 'Baskets banc', item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } }, o.tx || {}) } }; }
      if (e.methode === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(e.chemin)) return o.offre || { status: 200, body: { code: 0 } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/authorization/check/phone_verification') return o.tel || { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && e.chemin === `/messaging/main/conversations/${UUID}/replies`) return o.reponse || { status: 201, body: { conversation_id: UUID, data: { content: 'x' } } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(op.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, message: o.message || 'Bonjour, il te plaît toujours ?', offre: { mode: 'pct', valeur: 10, arrondi: false } } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, op);
  };
  f.ctx.notifierApp = async () => {};
  if (o.sansOnglet) f.ctx.pageVintedPour = async () => ({ refus: 'onglet' });
  f.clics = [];
  const bg = f.ctx.interfaceVinted;
  f.ctx.interfaceVinted = async (acc, geste, d, op) => { f.clics.push(geste); return o.chemin === 'interface' ? bg(acc, geste, d, op) : { ok: false, rienParti: true, sansPage: 'element' }; };
  return f;
}
const jouer = (f) => f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.stack || e) }));
const ecr = (f) => f.j.vinted.filter((v) => v.methode !== 'GET');
const res = (r) => (r && r.json) || {};
const court = (f, r) => JSON.stringify({ r: r && (r.json || r.erreur), v: f.j.vinted.map((x) => x.methode + ' ' + x.chemin) }).slice(0, 700);
(async () => {
  { const f = monter(); const r = await jouer(f);
    const v = f.j.vinted.map((x) => x.methode + ' ' + x.chemin);
    const ordre = ['POST /messaging/main/inquiries', `GET /messaging/main/conversations/${UUID}`, 'GET /api/v2/transactions/5001', 'POST /api/v2/transactions/5001/offers', `POST /messaging/main/conversations/${UUID}/replies`];
    const idx = ordre.map((x) => v.indexOf(x));
    const W = ecr(f), corps = W.map((x) => { try { return JSON.parse(x.corps); } catch (_) { return null; } });
    const sansAuth = W.every((x) => !Object.keys(x.entetes || {}).some((k) => /^authorization$/i.test(k)) && x.credentials === 'include');
    dit(res(r).resultat === 'envoye' && idx.every((k, i) => k >= 0 && (i === 0 || k > idx[i - 1])) && W.length === 3 && !f.clics.length && sansAuth, 'V1 l’ordre de Vintex (conversation, relecture, transaction, offre, message), aucun clic, aucun Authorization, cookies de la page', court(f, r));
    const [q, o, m] = corps;
    dit(q && JSON.stringify(q.item_ids) === '["101"]' && q.receiver_id === '201' && o && o.offer && o.offer.currency === 'EUR' && o.offer.price === '45.0' && m && typeof m.content === 'string' && m.content.length > 0 && m.is_personal_data_sharing_check_skipped === false && m.photo_temp_uuids === null, 'V1b les corps de Vintex : {item_ids, receiver_id} · {offer:{currency, price « 45.0 »}} · {content, is_personal_data_sharing_check_skipped:false, photo_temp_uuids:null}', JSON.stringify(corps)); }
  { const f = monter({ conv: { opposite_users: [{ id: 999 }] } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'destinataire_different' && res(r).etape === 'verification' && ecr(f).length === 1, 'V2 autre personne dans la conversation ⇒ ni offre ni message, raison « destinataire_different », étape vérification', court(f, r)); }
  { const f = monter({ conv: { messages: [{ entity_type: 'message', content: 'Salut' }] } }); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && ecr(f).length === 1, 'V3 conversation déjà écrite ⇒ ni offre ni message', court(f, r)); }
  { const f = monter({ tx: { item_id: 102, item: { id: 102, price: { amount: '50.0', currency_code: 'EUR' } } } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'article_different' && ecr(f).length === 1, 'V4 transaction d’un autre article ⇒ ni offre ni message (« article_different »)', court(f, r)); }
  { const f = monter({ reponse: { status: 400, body: { code: 106 } }, tel: { status: 400, body: { code: 106 } } }); const r = await jouer(f);
    const refusees = JSON.stringify(Object.entries(f.store || {}).filter(([k]) => /refus/i.test(k)));
    dit(res(r).resultat === 'refuse' && res(r).raison === 'telephone_a_verifier' && !/Bonjour/.test(refusees), 'V11 400 + téléphone à vérifier ⇒ « telephone_a_verifier », le texte n’est pas puni', court(f, r) + refusees); }
  { const f = monter({ reponse: { status: 400, body: { code: 99 } } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'texte_refuse', 'V11b 400 avec téléphone vérifié ⇒ texte refusé (comme avant)', court(f, r)); }
  { const f = monter({ offre: { status: 422, body: { code: 99, message: 'non' } } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && !ecr(f).some((x) => /replies$/.test(x.chemin)), 'V5 offre refusée ⇒ aucun message', court(f, r)); }
  { const f = monter({ inquiry: { status: 429, body: {} } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && ecr(f).length === 1 && !f.j.vinted.some((x) => /transactions/.test(x.chemin)), 'V6 Vinted freine (429) ⇒ plus rien ne part', court(f, r)); }
  { const f = monter(); const n0 = f.j.vinted.length;
    const a = await f.ctx.vintedPageFavori(ACC, '/api/v2/items/101/delete', {});
    const b = await f.ctx.vintedPageFavori(ACC, '/api/v2/conversations/301/replies', { reply: { body: 'x' } });
    const c = await f.ctx.vintedPageFavori(ACC, 'https://api.vinted.fr/messaging/main/conversations/../../users/1', {});
    dit([a, b, c].every((x) => x && x.rienParti === true) && f.j.vinted.length === n0, 'V7 toute autre écriture refusée par la porte des favoris : rien ne part', JSON.stringify([a, b, c])); }
  { const f = monter({ chemin: 'interface' }); const r = await jouer(f);
    dit(f.clics.length > 0 && !f.j.vinted.some((x) => x.chemin === '/messaging/main/inquiries'), 'V8 réglage « interface » ⇒ l’ancien chemin par les clics (réserve), aucune requête Vintex', court(f, r)); }
  { const f = monter({ sansOnglet: true }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && !ecr(f).length, 'V9 sans onglet vinted.fr sur ce compte ⇒ rien ne part', court(f, r)); }
  { const f = monter({ conv: { data: { items: [{ id: 101 }] } } }); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && f.j.vinted.some((x) => x.chemin === '/api/v2/conversations/301'), 'V10 transaction lue par l’ancien n° de CETTE conversation, vérifiée ⇒ envoyé', court(f, r)); }
  // ── 5.455.3 : la forme MESURÉE de la nouvelle messagerie ──
  const MESUREE = { inquiry: { status: 201, body: { inquiry_id: 'inq-1', transaction_id: 5002, conversation_id: UUID, read_after_write_token: 'eyJ.x.y' } },
    convBrute: { id: UUID, core_id_deprecated: 302, conversation_type: 'inquiry', allow_reply: true, is_read: true, opposite_users: [{ id: 201, photo: null }], data: { id: 'd-1', order_id: '26000001', escrow_order_id: '26000001' }, messages: [] },
    ancienne404: true, txBrute: { id: 5002, item_id: 101, buyer_id: 201, seller_id: 111, item_title: 'Baskets banc', item: { id: 101, price: { amount: '53.0', currency_code: 'EUR' } } } };
  const parti = (f) => ecr(f).some((x) => /\/offers$/.test(x.chemin)) && ecr(f).some((x) => /replies$/.test(x.chemin));
  { const f = monter(MESUREE); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f) && f.j.vinted.some((x) => x.chemin === '/api/v2/transactions/5002/offers'), 'V12 forme mesurée (sans data.items ni transaction dans la conversation, ancienne relecture 404) ⇒ transaction de la CRÉATION, offre + message envoyés', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: { id: UUID, allow_reply: true, messages: [] }, txBrute: { id: 5002, item_id: 101, item: { id: 101, price: { amount: '53.0', currency_code: 'EUR' } } } })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f), 'V13 ni opposite_users ni data.items, transaction sans acheteur ⇒ envoyé (identité de la demande, comme les concurrents)', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { conv404: 1, convPlate: true })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f), 'V14 conversation pas encore servie (404) puis relue (réponse à plat) ⇒ envoyé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convJamais: true })); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && res(r).raison === 'fil_non_relu' && ecr(f).length === 1, 'V15 conversation jamais relue ⇒ sauté (« fil_non_relu »), ni offre ni message, la file continue', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { opposite_users: [{ id: '999' }] }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'destinataire_different' && res(r).etape === 'verification' && ecr(f).length === 1, 'V16a autre personne LUE (id en texte) ⇒ refus nommé, rien de plus', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { data: { items: [{ id: 555, item_id: 102 }] } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'article_different' && ecr(f).length === 1, 'V16b autre article LU (`item_id` de la ligne) ⇒ refus nommé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { data: { transaction_id: 7777 } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'article_different' && ecr(f).length === 1, 'V16c deux transactions différentes (création ≠ conversation) ⇒ refus nommé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { opposite_users: [{ id: '111' }, { id: '201', login: 'lea' }], data: { items: [{ id: 555, item_id: '101' }] } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f), 'V16d ids en texte, le vendeur lui-même dans la liste, `item_id` de la ligne ⇒ envoyé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { message: 'Ta paire {marque} te plaît ?' })); const r = await jouer(f);
    const m = ecr(f).find((x) => /replies$/.test(x.chemin)); let t = ''; try { t = JSON.parse(m.corps).content; } catch (_) {}
    dit(res(r).resultat === 'envoye' && /^Ta paire te plaît \?$/.test(t), 'V17 {marque} inconnue ⇒ la version neutre part : ' + JSON.stringify(t), court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { tx404: true, dressing: [{ id: 101, title: 'Baskets dressing', price: { amount: '60.0', currency_code: 'EUR' } }] })); const r = await jouer(f);
    const o = ecr(f).find((x) => /\/offers$/.test(x.chemin)); let px = ''; try { px = JSON.parse(o.corps).offer.price; } catch (_) {}
    dit(res(r).resultat === 'envoye' && px === '54.0', 'V18 transaction illisible ⇒ prix de SON dressing (60 € − 10 % = 54), offre + message', court(f, r) + ' prix=' + px); }
  console.log(ko ? `❌ favoris par requêtes comme Vintex : ${ko} rouge(s), ${ok} vert(s)` : `✅ favoris par requêtes comme Vintex : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
