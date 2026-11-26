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
//   V5  l'offre refusée par Vinted (422) ⇒ aucun message (jamais une offre annoncée qui n'existe pas)
//   V6  Vinted freine (429) dès la conversation ⇒ plus rien ne part, le frein est dit
//   V7  `vintedPageFavori` refuse toute autre écriture (supprimer, prix, ancienne messagerie) : rien ne part
//   V8  `vrmFavorisChemin: 'interface'` ⇒ l'ancien chemin par les clics (réserve), aucune requête d'écriture fabriquée
//   V9  sans onglet vinted.fr sur ce compte ⇒ rien ne part
//   V10 la transaction absente de la nouvelle messagerie ⇒ lue par l'ancien n° de CETTE conversation, vérifiée, envoyé
//  `--mutation=nom` ; `--prouve` : chaque mutation doit rendre l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
let BG = path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  'sans-personne': ["if(opp.length!==1||opp[0]!==body.recipientId){noterDiag('favori_vintex_autre_personne');", "if(false){"],
  'sans-historique': ['if(ecritsAvant>0||(cv.pagination', 'if(false&&(cv.pagination'],
  'sans-article-tx': ["if(!tr||artTx!==body.itemId){", "if(!tr){"],
  'offre-ignoree': ["if(!offreFaite)return o.status", "if(false)return o.status"],
  'porte-ouverte': ['function ecritureFavoriPermise(adresse) { const a = String(adresse || \'\'); return ECRITURES_FAVORI.some((re) => re.test(a)); }', 'function ecritureFavoriPermise(adresse) { return true; }'],
  'chemin-ignore': ["if((await cheminFavoris())==='vintex'){", "if(true){"],
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
  const conv = Object.assign({ id: UUID, core_id_deprecated: 301, allow_reply: true, opposite_users: [{ id: 201, login: 'pseudo_banc' }], data: { transaction_id: 5001, items: [{ id: 101 }] }, messages: [] }, o.conv || {});
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } } };
  const store = { __commeBleamDefaut: true, ...(o.chemin ? { vrmFavorisChemin: o.chemin } : { __favorisVintex: true }) };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store,
    vinted: (e) => {
      if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return o.inquiry || { status: 201, body: { id: UUID, conversation_id: UUID } };
      if (e.methode === 'GET' && e.chemin === `/messaging/main/conversations/${UUID}`) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/conversations/301') return { status: 200, body: { conversation: { id: 301, opposite_user: { id: 201 }, transaction: { id: 5001, item_id: 101 } } } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/transactions/5001') return { status: 200, body: { transaction: Object.assign({ id: 5001, item_id: 101, buyer_id: 201, item_title: 'Baskets banc', item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } }, o.tx || {}) } };
      if (e.methode === 'POST' && e.chemin === '/api/v2/transactions/5001/offers') return o.offre || { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && e.chemin === `/messaging/main/conversations/${UUID}/replies`) return { status: 201, body: { conversation_id: UUID, data: { content: 'x' } } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(op.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, message: 'Bonjour, il te plaît toujours ?', offre: { mode: 'pct', valeur: 10, arrondi: false } } } : { ok: true, autorise: true, uid: UID };
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
    dit(res(r).resultat === 'refuse' && res(r).raison === 'identite_non_confirmee' && ecr(f).length === 1, 'V2 autre personne dans la conversation ⇒ ni offre ni message', court(f, r)); }
  { const f = monter({ conv: { messages: [{ entity_type: 'message', content: 'Salut' }] } }); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && ecr(f).length === 1, 'V3 conversation déjà écrite ⇒ ni offre ni message', court(f, r)); }
  { const f = monter({ tx: { item_id: 102, item: { id: 102, price: { amount: '50.0', currency_code: 'EUR' } } } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'identite_non_confirmee' && ecr(f).length === 1, 'V4 transaction d’un autre article ⇒ ni offre ni message', court(f, r)); }
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
  console.log(ko ? `❌ favoris par requêtes comme Vintex : ${ko} rouge(s), ${ok} vert(s)` : `✅ favoris par requêtes comme Vintex : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
