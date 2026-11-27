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
//  5.455.4 (Julien, 27 nov. 18:42, arthuror2 « autre article dans la conversation » ; « tout reprendre comme Vintex ») : le chemin
//  RÉÉCRIT court — demande → conversation et transaction de SA réponse → une relecture (historique, personne) → offre (plancher)
//  → message ; registre avant/après. V10 (ancienne conversation) retiré avec son code ; V18 : plus jamais le prix du dressing.
//   V16b/c, V19–V21 une conversation rendue à propos d'un autre article ; V22–V24 4xx = rien d'écrit ; V25 offre déjà là ;
//   V26 auto ; V27 devise ; V28 VRM injoignable ; V29–V31 relance = jamais deux fois ; V32 reprise uuid ; V33–V34 compte rendu
//   rejoué ; V35 texte jugé avant l'offre.
//  `AUDIT_BG=<chemin>` juge un autre background.js (le code d'avant : rouge).
//  `--mutation=nom` ; `--prouve` : chaque mutation doit rendre l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
let BG = process.env.AUDIT_BG || path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  'sans-personne': ["if(personnes.length>1||(personnes.length===1&&personnes[0]!==body.recipientId)){noterDiag('favori_req_autre_personne');", "if(false){"],
  'une-seule-lecture': ["for(let k=0;k<3&&!cv;k++){", "for(let k=0;k<1&&!cv;k++){"],
  'fil-arrete': ["return rep('ignore',ln&&ln.status||0,'fil_non_relu');", "return rep('refuse',ln&&ln.status||0,'identite_non_confirmee');"],
  'article-refuse': ["const personnes=personnesConvFavori(cv.opposite_users,uid);", "const personnes=personnesConvFavori(cv.opposite_users,uid);{const ar=(cv.data&&Array.isArray(cv.data.items)?cv.data.items:[]).map((x)=>articleLigneCommande(x).id).filter(Boolean);if(ar.length&&ar.some((a)=>a!==body.itemId))return rep('refuse',ln.status,'article_different');}"],
  'tx-de-la-conversation': ["const uuid=uuidConversationCree(q.json),tx=txCreationFavori(q.json);", "const uuid=uuidConversationCree(q.json),tx=String((q.json&&q.json.x)||'')||'5001';"],
  'texte-apres-offre': ["if(!texteSurVinted(texteV).ok){noterDiag('favori_texte_final_interdit');return rep('refuse',0,'texte_interdit');}\n    // 4c.", "    // 4c."],
  'prix-dressing': ["if(!titre){const lu=await dressingLu(String(uid)).catch(()=>null);const it=lu&&Array.isArray(lu.items)?lu.items.find((x)=>x&&String(x.id)===body.itemId):null;if(it&&typeof it.title==='string')titre=it.title.slice(0,120);}", "{const lu=await dressingLu(String(uid)).catch(()=>null);const it=lu&&Array.isArray(lu.items)?lu.items.find((x)=>x&&String(x.id)===body.itemId):null;if(it&&!(Number(prixAnnonce)>0))prixAnnonce=Number(prixCarte(it.price));if(it&&!titre&&typeof it.title==='string')titre=it.title.slice(0,120);}"],
  'tx-demande-autre-article': ["if(artTx&&artTx!==body.itemId){noterDiag('favori_req_tx_autre_article');", "if(false){"],
  'ecrit-sur-4xx': ["function ecritureFavoriPartie(x) { if (!x || x.rienParti) return false; const s = Number(x.status) || 0; return !(s >= 400 && s < 500); }", "function ecritureFavoriPartie(x) { return !!x && !x.rienParti; }"],
  'offre-pas-contact': ["    if (/offer/.test(t)) { if (montantMessageOffre(m)) n++; continue; }", "    if (/offer/.test(t)) continue;"],
  'invitation-comptee': ["    if (/offer/.test(t)) { if (montantMessageOffre(m)) n++; continue; }", "    if (/offer/.test(t)) { n++; continue; }"],
  'auto-saute-systeme': ["    if(cv.messages.length>0){noterDiag('favori_req_messages_systeme');", "    if(body.auto===true&&cv.messages.length>0)return rep('ignore',ln.status,'conversation_existante');if(cv.messages.length>0){noterDiag('favori_req_messages_systeme');"],
  'autre-devise': ["if(String(devise)!=='EUR'){", "if(false){"],
  'sans-registre': ["if(deja&&(deja.o||deja.m)){", "if(false){"],
  'registre-apres-message': ["    await noterRegistreFavori(uid,body.itemId,body.recipientId,'m');\n    if(attente){", "    if(attente){"],
  'reprise-uuid-jetee': ["(!uuidR && !/^[1-9]\\d{0,19}$/.test(String(e.convId || '')))", "!/^[1-9]\\d{0,19}$/.test(String(e.convId || ''))"],
  'terminer-perdu': ["if (!(await rejouerTerminers())) return attendre('vrm');", ""],
  'dressing-ancien': ["const frais = lu && Date.now() - Date.parse(String(lu.capturedAt || '')) < DRESSING_FRAIS_MS;", "const frais = !!lu;"],
  'sans-article-vivant': ["const r = await vintedPage(acc, 'GET', `/api/v2/items/${itemId}`, null, { timeoutMs: 12000 });", "const r = null;"],
  'sans-page-annonce': ["const h = await vintedGetHtml(acc, `/items/${encodeURIComponent(itemId)}`);", "const h = null;"],
  'sans-jeton-lecture': ["+(raw&&k<2?'?read_after_write_token='+encodeURIComponent(raw):'')", ""],
  'sans-prix-demande': ["const b = prixDansObjet(reponseDemande); if (b) return Object.assign(b, { source: 'demande' });", ""],
  'sans-bail': ["  tour();\n  try { return await fn(); }", "  try { return await fn(); }"],
  'carte-sans-bail': ["try { r = await avecBailFavori(st.uid, t.jeton, () => executerPourAppCoeur(", "try { r = await ((u, j, fn) => fn())(st.uid, t.jeton, () => executerPourAppCoeur("],
  'auto-dressing-ancien': ["const pv=pl?await prixFavoriVivant(acc,uid,body.itemId,null).catch(()=>null):null;const px=pv&&!pv.frein&&pv.devise==='EUR'?pv.montant:null;", "const lu=pl?await dressingLu(String(uid)).catch(()=>null):null;const it=lu&&Array.isArray(lu.items)?lu.items.find(x=>x&&String(x.id)===String(body.itemId)):null;const px=it?prixCarte(it.price):null;"],
  'autorisation-incertaine': ["}catch{noterDiag('favori_autorisation_injoignable');return rep('refuse',0,'autorisation_expiree','autorisation');}", "}catch{return rep('incertain');}"],
  'variable-bloque': ["if (manques.size && [...manques].every((k) => NEUTRES.includes(k) && !val[k])) {", "if (false) {"],
  'sans-historique': ['if(ecritsAvant>0||(cv.pagination', 'if(false&&(cv.pagination'],
  'offre-ignoree': ["if(!faite)return o.status", "if(false)return o.status"],
  'porte-ouverte': ['function ecritureFavoriPermise(adresse) { const a = String(adresse || \'\'); return ECRITURES_FAVORI.some((re) => re.test(a)); }', 'function ecritureFavoriPermise(adresse) { return true; }'],
  'telephone-ignore': ["x.status===400&&(await telephoneAVerifierVinted(acc))===true?", "false?"],
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
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } }, ...(o.dressing ? { [`harvest_${UID}_listings`]: { capturedAt: new Date(Date.now() - (o.dressingAncien ? 3600000 : 0)).toISOString(), payload: { items: o.dressing } } } : {}) };
  let lectures = 0;
  const store = { __commeBleamDefaut: true, ...(o.chemin ? { vrmFavorisChemin: o.chemin } : { __favorisVintex: true }) };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store,
    vinted: (e) => {
      if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return o.inquiry || { status: 201, body: { id: UUID, conversation_id: UUID, transaction_id: 5001 } };
      if (e.methode === 'GET' && e.chemin.split('?')[0] === `/messaging/main/conversations/${UUID}`) { lectures++; if (o.convJamais || lectures <= (o.conv404 || 0)) return { status: 404, body: { code: 404 } }; return { status: 200, body: o.convPlate ? conv : { conversation: conv } }; }
      if (e.methode === 'GET' && e.chemin === '/api/v2/conversations/301') return o.ancienne404 ? { status: 404, body: { code: 404 } } : { status: 200, body: { conversation: { id: 301, opposite_user: { id: 201 }, transaction: { id: 5001, item_id: 101 } } } };
      if (e.methode === 'GET' && /^\/api\/v2\/transactions\/\d+$/.test(e.chemin)) { if (o.tx404) return { status: 404, body: { code: 404 } }; return { status: 200, body: { transaction: o.txBrute || Object.assign({ id: 5001, item_id: 101, buyer_id: 201, item_title: 'Baskets banc', item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } }, o.tx || {}) } }; }
      if (e.methode === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(e.chemin)) return o.offre || { status: 200, body: { code: 0 } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/items/101') return o.article || { status: 404, body: { code: 404 } };
      if (e.methode === 'GET' && e.chemin === '/items/101') return o.page ? { status: 200, body: o.page, texte: true } : { status: 404, body: '' };
      if (e.methode === 'GET' && e.chemin === '/api/v2/authorization/check/phone_verification') return o.tel || { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && e.chemin === `/messaging/main/conversations/${UUID}/replies`) return o.reponse || { status: 201, body: { conversation_id: UUID, data: { content: 'x' } } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(op.body || '{}');
      (f.appels = f.appels || []).push(c.action);
      if (o.vrmInjoignable && c.action === 'consommer') throw new Error('réseau');
      if (o.terminerPanne && c.action === 'terminer' && o.terminerPanne-- > 0) return { ok: false, status: 503, json: async () => ({ message: 'panne' }) };
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, ...(o.auto ? { auto: true } : {}), message: o.message || 'Bonjour, il te plaît toujours ?', ...(o.sansOffre ? {} : { offre: { mode: 'pct', valeur: 10, arrondi: false } }) } } : { ok: true, autorise: true, uid: UID };
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
    dit(res(r).resultat === 'refuse' && ['article_different', 'offre_prix_inconnu'].includes(res(r).raison) && ecr(f).length === 1, 'V4 transaction (de la conversation) d’un autre article ⇒ ni offre ni message', court(f, r)); }
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
  // ── 5.455.3 : la forme MESURÉE de la nouvelle messagerie ──
  const MESUREE = { inquiry: { status: 201, body: { inquiry_id: 'inq-1', transaction_id: 5002, conversation_id: UUID, read_after_write_token: 'eyJhbGc.x.y' } },
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
  // ── 5.455.4 (Julien, 27 nov. 18:42, arthuror2 : « Ignoré · autre article dans la conversation » sur un vrai favori) ──
  const offreSur = (f) => { const o = ecr(f).find((x) => /\/offers$/.test(x.chemin)); return o ? o.chemin : ''; };
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { data: { items: [{ id: 555, item_id: 102 }] } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f) && offreSur(f) === '/api/v2/transactions/5002/offers', 'V16b conversation rendue à propos d’un AUTRE article (même personne, vide) ⇒ envoyé comme Vintex, offre sur la transaction de la DEMANDE', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { data: { transaction_id: 7777, items: [{ id: 102 }] } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && offreSur(f) === '/api/v2/transactions/5002/offers' && !f.j.vinted.some((x) => /7777/.test(x.chemin)), 'V16c conversation d’un autre article avec SA transaction (7777) ⇒ envoyé, offre sur la transaction de la demande (5002), 7777 jamais touchée', court(f, r)); }
  { const conv = Object.assign({}, MESUREE.convBrute, { data: { transaction_id: 7777, items: [{ id: 102 }] }, messages: [{ entity_type: 'message', content: 'Toujours dispo ?' }] });
    const f = monter(Object.assign({}, MESUREE, { convBrute: conv })); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && res(r).raison === 'conversation_deja_contactee' && ecr(f).length === 1, 'V19 conversation d’un autre article DÉJÀ écrite ⇒ sauté « déjà en conversation », ni offre ni message', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { txBrute: Object.assign({}, MESUREE.txBrute, { item_id: 102, item: { id: 102, price: { amount: '53.0', currency_code: 'EUR' } } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'article_different' && ecr(f).length === 1, 'V20 la transaction rendue par la DEMANDE porte un autre article ⇒ ni offre ni message (contradiction sur l’objet même de l’offre)', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { inquiry: { status: 201, body: { conversation_id: UUID } }, convBrute: Object.assign({}, MESUREE.convBrute, { data: { transaction_id: 7777 } }), txBrute: { id: 7777, item_id: 102, buyer_id: 201, seller_id: 111, item: { id: 102, price: { amount: '80.0', currency_code: 'EUR' } } } })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'offre_prix_inconnu' && !offreSur(f) && !ecr(f).some((x) => /replies$/.test(x.chemin)), 'V21 sans transaction de la demande, celle de la conversation porte un autre article ⇒ écartée : aucune offre sur l’autre article, rien de plus (favori sauté)', court(f, r)); }
  // ── 5.455.4 : tous les cas (27 nov.) ──
  { const f = monter({ inquiry: { status: 400, body: { code: 106 } }, tel: { status: 400, body: {} } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'telephone_a_verifier' && res(r).ecrits === 0, 'V22 création refusée 400 (téléphone à vérifier) ⇒ ecrits 0 (le favori reste à envoyer après la vérification)', court(f, r)); }
  { const f = monter({ inquiry: { status: 429, body: {} } }); const r = await jouer(f);
    dit(res(r).ecrits === 0, 'V23 création refusée 429 ⇒ ecrits 0 (rien n’est créé chez Vinted)', court(f, r)); }
  { const f = monter({ inquiry: { status: 409, body: {} } }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).ecrits === 0 && res(r).cause === 'http_409', 'V24 création refusée 409 ⇒ ecrits 0, cause http_409 (refus propre à CE favori : sauté, la file continue)', court(f, r)); }
  { const conv = Object.assign({}, MESUREE.convBrute, { messages: [{ entity_type: 'offer_message', entity: { price: { amount: '40.0' } } }] });
    const f = monter(Object.assign({}, MESUREE, { convBrute: conv })); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && !offreSur(f) && ecr(f).length === 1, 'V25 SA propre offre déjà dans la conversation (`offer_message`) ⇒ sauté, jamais une 2ᵉ offre', court(f, r)); }
  // Le mode AUTO passe par le MÊME chemin (`favorisAuto` → pilote → `executerMessageFavori`, chemin des requêtes) :
  { const f = monter(Object.assign({}, MESUREE, { auto: true })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f) && !f.clics.length, 'V26 mode AUTO, de bout en bout par le chemin de Vintex : demande, offre au plancher, message ; aucun clic', court(f, r)); }
  { const conv = Object.assign({}, MESUREE.convBrute, { messages: [{ entity_type: 'message', content: 'Toujours dispo ?' }] });
    const f = monter(Object.assign({}, MESUREE, { convBrute: conv, auto: true })); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && res(r).raison === 'conversation_existante' && ecr(f).length === 1, 'V26b mode AUTO : la conversation porte déjà un message ⇒ rien n’est écrit', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { auto: true })); const r1 = await jouer(f); const n1 = ecr(f).length; const r2 = await jouer(f);
    dit(res(r1).resultat === 'envoye' && res(r2).resultat !== 'envoye' && ecr(f).length === n1, 'V26c mode AUTO : le même favori repris ⇒ jamais deux fois (rien de plus chez Vinted)', court(f, r2)); }
  // Julien (27 nov. 19:17) : sur `/inbox/<uuid>?offer_request=true`, la case « Faire une offre » ouverte au PLEIN prix (55 €),
  //    rien de tapé ni envoyé. Le chemin de VRM ne passe par aucune case : l'offre part par la transaction de la demande, au prix
  //    calculé (55 € − 10 % = 49,50 €), puis le message — aucun clic, aucune fenêtre.
  { const f = monter(Object.assign({}, MESUREE, { txBrute: Object.assign({}, MESUREE.txBrute, { item: { id: 101, price: { amount: '55.0', currency_code: 'EUR' } } }) })); const r = await jouer(f);
    const o = ecr(f).find((x) => /\/offers$/.test(x.chemin)); let px = ''; try { px = JSON.parse(o.corps).offer.price; } catch (_) {}
    const io = ecr(f).findIndex((x) => /\/offers$/.test(x.chemin)), im = ecr(f).findIndex((x) => /replies$/.test(x.chemin));
    dit(res(r).resultat === 'envoye' && px === '49.5' && io >= 0 && im > io && !f.clics.length, 'V37 « offer_request » : l’offre faite par la transaction de la demande à 49,50 € (55 € − 10 %), confirmée, PUIS le message ; aucune case ouverte (aucun clic)', court(f, r) + ' prix=' + px); }
  { const f = monter(Object.assign({}, MESUREE, { txBrute: Object.assign({}, MESUREE.txBrute, { item: { id: 101, price: { amount: '55.0', currency_code: 'EUR' } } }), offre: { status: 200, body: { code: 106, message: 'refus' } } })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && !ecr(f).some((x) => /replies$/.test(x.chemin)), 'V37b l’offre pas confirmée par Vinted (code ≠ 0) ⇒ AUCUN message qui annoncerait une offre absente', court(f, r)); }
  // Julien (27 nov. 18:15) : « sur certains comptes, quand on ouvre le favori, l'offre est proposée directement ».
  for (const [nom, m] of [['invitation sans montant', { entity_type: 'offer_suggestion_message' }], ['message du système', { entity_type: 'status_message', content: '' }], ['invitation « offer » sans montant', { type: 'offer', data: {} }]]) {
    for (const auto of [false, true]) {
      const conv = Object.assign({}, MESUREE.convBrute, { messages: [m] });
      const f = monter(Object.assign({}, MESUREE, { convBrute: conv, auto })); const r = await jouer(f);
      const offres = ecr(f).filter((x) => /\/offers$/.test(x.chemin)).length;
      dit(res(r).resultat === 'envoye' && offres === 1 && ecr(f).some((x) => /replies$/.test(x.chemin)), `V36 conversation ouverte avec ${nom}${auto ? ' (auto)' : ''} ⇒ pas « déjà en conversation » : UNE offre puis le message`, court(f, r));
    }
  }
  { const f = monter(Object.assign({}, MESUREE, { txBrute: Object.assign({}, MESUREE.txBrute, { item: { id: 101, price: { amount: '53.0', currency_code: 'GBP' } } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).raison === 'offre_prix_inconnu' && !offreSur(f), 'V27 prix dans une autre devise ⇒ aucune offre (jamais converti), dit', court(f, r)); }
  { const f = monter({ vrmInjoignable: true }); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && res(r).ecrits === 0 && !ecr(f).length, 'V28 VRM injoignable à l’autorisation ⇒ « pas envoyé » (rien n’est parti), plus « incertain »', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { convBrute: Object.assign({}, MESUREE.convBrute, { opposite_users: [{ id: '111' }, { id: '201', login: 'lea' }], data: { items: [{ id: 555, item_id: '101' }] } }) })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f), 'V16d ids en texte, le vendeur lui-même dans la liste, `item_id` de la ligne ⇒ envoyé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { message: 'Ta paire {marque} te plaît ?' })); const r = await jouer(f);
    const m = ecr(f).find((x) => /replies$/.test(x.chemin)); let t = ''; try { t = JSON.parse(m.corps).content; } catch (_) {}
    dit(res(r).resultat === 'envoye' && /^Ta paire te plaît \?$/.test(t), 'V17 {marque} inconnue ⇒ la version neutre part : ' + JSON.stringify(t), court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { tx404: true, dressing: [{ id: 101, title: 'Baskets dressing', price: { amount: '60.0', currency_code: 'EUR' } }] })); const r = await jouer(f);
    const o = ecr(f).find((x) => /\/offers$/.test(x.chemin)); let px = ''; try { px = JSON.parse(o.corps).offer.price; } catch (_) {}
    dit(res(r).resultat === 'envoye' && px === '54.0', 'V18 transaction illisible, article et page muets ⇒ le prix de SON dressing lu À L’INSTANT (60 € − 10 % = 54), offre + message', court(f, r) + ' prix=' + px); }
  { const f = monter(MESUREE); const r = await jouer(f); const lu = f.j.vinted.find((x) => x.methode === 'GET' && /\/messaging\/main\/conversations\//.test(x.chemin));
    dit(res(r).resultat === 'envoye' && lu && /[?&]read_after_write_token=eyJhbGc\.x\.y/.test(lu.chemin), 'V41 (C4) la relecture porte le `read_after_write_token` rendu par la demande', court(f, r)); }
  // 5.455.4 (Julien, 19:40 : « il doit voir le prix ») : les sources, dans l'ordre ; « prix introuvable » seulement si TOUTES échouent.
  const SANS_PRIX = { txBrute: { id: 5002, item_id: 101, buyer_id: 201, seller_id: 111, item_title: 'Baskets banc', item: { id: 101 } } };
  const prixOffre = (f) => { const o = ecr(f).find((x) => /\/offers$/.test(x.chemin)); try { return JSON.parse(o.corps).offer.price; } catch (_) { return ''; } };
  { const f = monter(Object.assign({}, MESUREE, SANS_PRIX, { article: { status: 200, body: { item: { id: 101, price: { amount: '70.0', currency_code: 'EUR' } } } } })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && prixOffre(f) === '63.0' && f.j.vinted.some((x) => x.chemin === '/api/v2/items/101'), 'V39 la transaction sans prix ⇒ le prix lu sur l’ARTICLE (70 € − 10 % = 63), offre + message', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, SANS_PRIX, { inquiry: { status: 201, body: Object.assign({}, MESUREE.inquiry.body, { item: { id: 101, price: { amount: '80.0', currency_code: 'EUR' } } }) } })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && prixOffre(f) === '72.0', 'V39b le prix porté par la réponse de la demande ⇒ utilisé (80 € − 10 % = 72)', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, SANS_PRIX, { page: '<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"item":{"id":101,"title":"x","photos":[{"url":"https://images1.vinted.net/t/x.jpg"}],"price":{"amount":"90.0","currency_code":"EUR"}}}}}</script></html>' })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && prixOffre(f) === '81.0', 'V39c transaction et article muets ⇒ le prix lu sur la PAGE de l’annonce (90 € − 10 % = 81), offre + message', court(f, r) + ' ' + prixOffre(f)); }
  { const f = monter(Object.assign({}, MESUREE, SANS_PRIX, { dressing: [{ id: 101, title: 'B', price: { amount: '60.0', currency_code: 'EUR' } }], dressingAncien: true })); const r = await jouer(f);
    const essais = ['/api/v2/items/101', '/items/101'].every((c) => f.j.vinted.some((x) => x.chemin === c) || f.j.vinted.some((x) => x.url && /\/items\/101$/.test(x.url)));
    dit(res(r).resultat === 'refuse' && res(r).raison === 'offre_prix_inconnu' && !prixOffre(f) && !ecr(f).some((x) => /replies$/.test(x.chemin)) && f.j.vinted.some((x) => x.chemin === '/api/v2/items/101'), 'V40 TOUTES les sources muettes (transaction, demande, article, page, dressing ANCIEN ignoré) ⇒ seulement alors « prix introuvable », ni offre ni message', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { message: 'Bonjour {pseudo} !', convBrute: Object.assign({}, MESUREE.convBrute, { opposite_users: [{ id: 201, login: 'lea.me' }] }) })); const r = await jouer(f);
    dit(res(r).resultat === 'refuse' && !ecr(f).some((x) => /\/offers$/.test(x.chemin)), 'V35 le texte final refusé (pseudo « lea.me » pris pour un lien) ⇒ jugé AVANT l’offre : aucune offre faite pour rien', court(f, r)); }
  // ── 5.455.4 : une relance après N'IMPORTE QUELLE interruption ne refait jamais une offre ni un message (registre) ──
  { const f = monter(MESUREE); const r1 = await jouer(f); const n1 = ecr(f).length; const r2 = await jouer(f);
    dit(res(r1).resultat === 'envoye' && res(r2).resultat === 'ignore' && ecr(f).length === n1, 'V29 le même favori relancé après un envoi ⇒ sauté, rien de plus chez Vinted (ni demande, ni offre, ni message)', court(f, r2)); }
  { const f = monter(Object.assign({}, MESUREE, { reponse: { status: 503, body: {} } })); const r1 = await jouer(f); const n1 = ecr(f).length; const r2 = await jouer(f);
    dit(res(r1).resultat === 'incertain' && res(r2).resultat === 'ignore' && ecr(f).length === n1, 'V30 message à la réponse inconnue (503) puis relance (« Pas parti » choisi) ⇒ jamais un 2ᵉ message ni une 2ᵉ offre', court(f, r2)); }
  { const f = monter(Object.assign({}, MESUREE, { sansOffre: true, reponse: { status: 503, body: {} } })); const r1 = await jouer(f); const n1 = ecr(f).length; const r2 = await jouer(f);
    dit(res(r1).resultat === 'incertain' && res(r2).resultat === 'ignore' && ecr(f).length === n1, 'V30b SANS offre, message à la réponse inconnue puis relance ⇒ jamais un 2ᵉ message (registre posé AVANT l’envoi)', court(f, r2)); }
  { const f = monter(Object.assign({}, MESUREE, { reponse: { status: 422, body: { code: 99 } }, offre: { status: 422, body: {} } })); const r1 = await jouer(f); const r2 = await jouer(f);
    dit(res(r1).resultat === 'refuse' && res(r2).resultat !== 'ignore' && ecr(f).some((x, i, l) => /inquiries$/.test(x.chemin) && l.filter((y) => /inquiries$/.test(y.chemin)).length === 2), 'V31 rien n’est parti (offre refusée 422) ⇒ le favori reste renvoyable (le registre ne retient que ce qui a pu partir)', court(f, r2)); }
  // La reprise après un worker tué entre l'offre et le message (uuid) : le message part UNE fois, le serveur est prévenu.
  { const f = monter(MESUREE); const J2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    f.store.vrmFavoriAttente = { [J2]: { uid: UID, convId: UUID, texte: 'Bonjour, il te plaît toujours ?', variante: 1, tRes: 0, suivi: 's', itemId: '101', recipientId: '201', requetes: true, jusqua: Date.now() - 1000, s: 10, v: '5.455.4' } };
    await f.ctx.reprendreMessagesFavoris(); const n1 = ecr(f).filter((x) => /replies$/.test(x.chemin)).length;
    f.store.vrmFavoriAttente = { [J2]: Object.assign({}, { uid: UID, convId: UUID, texte: 'Bonjour, il te plaît toujours ?', itemId: '101', recipientId: '201', requetes: true, jusqua: Date.now() - 1000 }) };
    await f.ctx.reprendreMessagesFavoris(); const n2 = ecr(f).filter((x) => /replies$/.test(x.chemin)).length;
    dit(n1 === 1 && n2 === 1 && (f.appels || []).includes('terminer'), `V32 worker tué entre l’offre et le message (nouvelle messagerie) ⇒ le message part à la reprise, UNE seule fois (${n1} puis ${n2}), le serveur prévenu`, JSON.stringify(f.appels)); }
  // `terminer` perdu (VRM en panne) : rangé, rejoué AVANT toute nouvelle réservation.
  { const f = monter(Object.assign({}, MESUREE, { terminerPanne: 1 }));
    await f.ctx.terminerFavoriServeur(UID, JETON, { ok: true, data: { resultat: 'envoye', ecrits: 3 } }); const garde = (f.store.vrmFavorisTerminer || []).length;
    await f.ctx.rejouerTerminers(); const apres = (f.store.vrmFavorisTerminer || []).length;
    dit(garde === 1 && apres === 0 && (f.appels || []).filter((a) => a === 'terminer').length === 2, `V33 compte rendu perdu (503) ⇒ rangé (${garde}) puis rejoué (${apres} restant)`, JSON.stringify(f.appels)); }
  { const src = fs.readFileSync(BG, 'utf8'); const i = src.indexOf('async function tickFavorisCarte'), k = src.indexOf("apiFavorisCarte(st.uid, 'suivant')", i);
    dit(i > 0 && k > i && /rejouerTerminers\(\)/.test(src.slice(i, k)), 'V34 la carte rejoue un compte rendu en souffrance AVANT de réserver le favori suivant'); }
  // 5.455.5 : le pré-contrôle « sous prix mini » du mode auto lit le prix MAINTENANT, jamais un dressing ancien.
  { const f = monter(Object.assign({}, MESUREE, { auto: true, dressing: [{ id: 101, title: 'B', price: { amount: '38.0', currency_code: 'EUR' } }], dressingAncien: true, article: { status: 200, body: { item: { id: 101, price: { amount: '60.0', currency_code: 'EUR' } } } } })); const r = await jouer(f);
    dit(res(r).resultat === 'envoye' && parti(f), 'V44 auto : dressing ANCIEN à 38 € (sous le mini 40) mais l’article lu à 60 € ⇒ pas sauté à tort, envoyé', court(f, r)); }
  { const f = monter(Object.assign({}, MESUREE, { auto: true, article: { status: 200, body: { item: { id: 101, price: { amount: '39.0', currency_code: 'EUR' } } } } })); const r = await jouer(f);
    dit(res(r).resultat === 'ignore' && res(r).raison === 'sous_prix_mini' && !ecr(f).length, 'V44b auto : l’article lu à 39 € (sous le mini 40) ⇒ sauté AVANT toute écriture', court(f, r)); }
  // 5.455.5 (C7/C8) : le bail renouvelé tant que la tentative est menée, plus rien après ; la carte ET le mode auto le tiennent.
  { const f = monter(MESUREE); f.ctx.__vrmBailFavoriMs = 40; f.ctx.globalThis && (f.ctx.globalThis.__vrmBailFavoriMs = 40);
    await f.ctx.avecBailFavori(UID, JETON, () => new Promise((ok) => setTimeout(ok, 230)));
    const n1 = (f.appels || []).filter((x) => x === 'prolonger').length; await new Promise((ok) => setTimeout(ok, 100)); const n2 = (f.appels || []).filter((x) => x === 'prolonger').length;
    dit(n1 >= 3 && n2 === n1, `V42 le bail est renouvelé pendant la tentative (${n1} fois) et plus après (${n2})`, JSON.stringify(f.appels)); }
  { const src = fs.readFileSync(BG, 'utf8'); const tc = src.slice(src.indexOf('async function tickFavorisCarte'), src.indexOf('async function favorisPourCarte')); const pi = src.slice(src.indexOf('async function piloteFavorisTick'), src.indexOf('// ══ 5.410 — LA VEILLE DES REPUBLICATIONS'));
    dit(/avecBailFavori\(st\.uid, t\.jeton, \(\) => executerPourAppCoeur/.test(tc) && /avecBailFavori\(uid, tr\.jeton, \(\) => executerPourAppCoeur/.test(pi), 'V43 la carte et le mode auto tiennent le bail de bout en bout'); }
  console.log(ko ? `❌ favoris par requêtes comme Vintex : ${ko} rouge(s), ${ok} vert(s)` : `✅ favoris par requêtes comme Vintex : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
