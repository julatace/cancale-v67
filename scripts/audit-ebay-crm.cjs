// AUDIT : le CRM eBay (28 nov. 2026, lot ebay-crm — docs/passation/2026-11-28-ebay-crm.md).
// La VRAIE route `api/ebay.js` (§4.10) est EXÉCUTÉE contre un FAUX eBay (Trading XML, Post-Order,
// Fulfillment, payment_dispute) et une fausse base ; la file des favoris Vinted
// (`api/_lib/favoris-file.js`) est exécutée elle aussi. Formes de la documentation d'eBay,
// données INVENTÉES (dépôt public), aucun appel réel.
//   node scripts/audit-ebay-crm.cjs            (le dépôt)
//   node scripts/audit-ebay-crm.cjs --prouve   (chaque mutation doit rougir)
//   node scripts/audit-ebay-crm.cjs --avant    (l'arbre d'avant le lot doit rougir)
// On exige :
//   I  identité : 50 acheteurs au MÊME nom (« Jean Martin », même adresse) ⇒ 50 fiches, aucune fusion ;
//      l'identifiant fait foi (casse ignorée) ; un pseudo masqué « j***n » n'est rattaché à personne ;
//      total en euros, autre devise écartée et dite, annulée hors total ;
//   A  automatismes : éteints par défaut (rien n'est envoyé) ; allumer exige la confirmation ; les
//      commandes d'AVANT l'allumage ne sont jamais visées ; une fois par commande (deux passages ⇒
//      un message) ; versions au hasard ; rien sur un retour, une réclamation, un litige de paiement,
//      une annulation ; rien si les litiges ne sont pas lus ; « après livraison » seulement sur une
//      livraison PROUVÉE ; {suivi} rempli par le vrai n° ; envoi incertain jamais renvoyé ;
//   F  évaluation automatique : seulement les ventes qu'eBay dit en attente, une fois ; demande
//      d'évaluation sautée quand l'acheteur a déjà évalué ;
//   X  exclusion : un acheteur exclu ne reçoit ni message, ni évaluation automatique (eBay), ni
//      favori (Vinted) ; liste pas lue ⇒ rien ne part ; exclusion par identifiant seulement ;
//   R  répondre à une évaluation (relue, sans réponse, son clic) ; écrire à l'acheteur d'une
//      commande RANGÉE seulement ; litiges triés par échéance ; contester sur son clic, relu avant.
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://base.banc.test';
const JOUR = 86400000;
let MAINTENANT = Date.now();
const _dateNow = Date.now; Date.now = () => MAINTENANT;   // l’horloge du banc (la route lit Date.now)

let ROWS, APPELS, EB;
const cmd = (n, { acheteur, nom = 'Jean Martin', jours = 1, total = '50.00', devise = 'EUR', etat = 'NOT_STARTED', paye = 'PAID', annule = 'NONE_REQUESTED', item } = {}) => ({
  orderId: `27-0000${String(n).padStart(4, '0')}-0000`, creationDate: new Date(MAINTENANT - jours * JOUR).toISOString(),
  buyer: { username: acheteur, buyerRegistrationAddress: { fullName: nom, contactAddress: { addressLine1: '1 rue de la Paix', city: 'Paris' } } },
  orderPaymentStatus: paye, orderFulfillmentStatus: etat, cancelStatus: { cancelState: annule },
  pricingSummary: { total: { value: total, currency: devise } },
  lineItems: [{ lineItemId: String(9000 + n), legacyItemId: item || String(110000000000 + n), title: `Paire ${n}`, quantity: 1 }],
});
const remettre = () => {
  ROWS = {
    ebay_comptes: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 300 * JOUR, vuLe: MAINTENANT }] },
    ebay_tokens: { refresh_token: 'RT', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
    ebay_orders: { orders: [] },
  };
  APPELS = [];
  EB = { retours: [], inquiries: [], cas: [], paiements: [], retoursPanne: false, inquiryPanne: false, livraisons: {}, attente: [], avis: [], aaq: 'ok', suivi: {}, litigeDetail: {} };
};
const json = (o, st = 200) => new Response(o === undefined ? '' : JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response('<?xml version="1.0" encoding="utf-8"?>' + s, { status: 200 });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dexml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const tag = (c, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(c); return m ? dexml(m[1]) : null; };
const ok = (nom, corps = '') => xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${corps}</${nom}Response>`);
global.fetch = async (url, opts = {}) => {
  const u = String(url), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return json({ id: PROPRIO, email: 'p@exemple.test' });
  if (u.includes('identity/v1/oauth2/token')) return json({ access_token: 'AT', expires_in: 7200 });
  if (u.includes('/rest/v1/rpc/')) return json(true);
  if (u.includes('/rest/v1/app_data')) {
    const ud = decodeURIComponent(u);
    const id = (/id=eq\.([^&]*)/.exec(ud) || [])[1];
    if (opts.method && opts.method !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const ligne = Array.isArray(corps) ? corps[0] : corps; const lid = id || (ligne && ligne.id);
      if (lid && ligne && ligne.data) ROWS[lid] = JSON.parse(JSON.stringify(ligne.data));
      return opts.method === 'PATCH' ? json([{ id: lid }]) : json([], 201);
    }
    if (/select=owner&limit=1/.test(ud)) return json([{ owner: PROPRIO }]);
    if (/id=like\.ebay_orders/.test(ud)) return json(Object.keys(ROWS).filter((k) => /^ebay_orders/.test(k)).map((k) => ({ id: k, orders: ROWS[k].orders })));
    if (!id || !(id in ROWS)) return json([]);
    if (id === 'vrm_crm_exclus' && EB.exclusPanne) return json({ message: 'panne' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(ud) || [])[1] || 'data';
    if (/^rev:/.test(sel)) return json([{ rev: ROWS[id].rev != null ? String(ROWS[id].rev) : null }]);
    if (/->>/.test(sel)) { const o = {}; for (const p of sel.split(',')) { const m = /^(?:([^:]+):)?data->>(\w+)$/.exec(p); if (m) o[m[1] || m[2]] = ROWS[id][m[2]] == null ? null : String(ROWS[id][m[2]]); } return json([o]); }
    return json([{ data: ROWS[id] }]);
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '', corps = String(opts.body || '');
    APPELS.push({ nom, corps });
    if (nom === 'GetMemberMessages') {
      const de = tag(corps, 'SenderID');
      const l = (EB.messages || []).filter((m) => !de || m.de.toLowerCase() === de.toLowerCase());
      return ok(nom, `<MemberMessage>${l.map((m) => `<MemberMessageExchange><Item><ItemID>${m.itemId}</ItemID><Title>x</Title></Item><Question><MessageID>${m.id}</MessageID><SenderID>${esc(m.de)}</SenderID><Subject>Q</Subject><Body>b</Body></Question><CreationDate>${new Date(MAINTENANT).toISOString()}</CreationDate></MemberMessageExchange>`).join('')}</MemberMessage>`);
    }
    if (nom === 'GetFeedback') {
      const fid = tag(corps, 'FeedbackID');
      const l = EB.avis.filter((f) => !fid || f.id === fid);
      return ok(nom, `<FeedbackDetailArray>${l.map((f) => `<FeedbackDetail><CommentingUser>${esc(f.de)}</CommentingUser><CommentText>${esc(f.texte || 'Top')}</CommentText><CommentTime>${new Date(MAINTENANT - JOUR).toISOString()}</CommentTime><CommentType>${f.type || 'Positive'}</CommentType><ItemID>${f.itemId}</ItemID><TransactionID>${f.tx || '555'}</TransactionID><FeedbackID>${f.id}</FeedbackID><Role>Buyer</Role>${f.reponse ? `<FeedbackResponse>${esc(f.reponse)}</FeedbackResponse>` : ''}</FeedbackDetail>`).join('')}</FeedbackDetailArray>`);
    }
    if (nom === 'GetItemsAwaitingFeedback') return ok(nom, `<ItemsAwaitingFeedback><TransactionArray>${EB.attente.map((t) => `<Transaction><Item><ItemID>${t.itemId}</ItemID></Item><TransactionID>${t.tx}</TransactionID><Buyer><UserID>${esc(t.acheteur)}</UserID></Buyer></Transaction>`).join('')}</TransactionArray></ItemsAwaitingFeedback>`);
    if (nom === 'GetOrders') {
      const ids = [...corps.matchAll(/<OrderID>([^<]+)<\/OrderID>/g)].map((m) => m[1]);
      return ok(nom, `<OrderArray>${ids.map((i) => `<Order><OrderID>${i}</OrderID>${EB.livraisons[i] ? `<ShippingServiceSelected><ShippingPackageInfo><ActualDeliveryTime>${new Date(EB.livraisons[i]).toISOString()}</ActualDeliveryTime></ShippingPackageInfo></ShippingServiceSelected>` : ''}</Order>`).join('')}</OrderArray>`);
    }
    if (nom === 'AddMemberMessageAAQToPartner') {
      if (EB.aaq === 'panne') return new Response('<html>503</html>', { status: 503 });
      return ok(nom);
    }
    return ok(nom);
  }
  if (/^https:\/\/apiz?\.ebay\.com\//.test(u)) {
    const p = new URL(u).pathname, m = opts.method || 'GET';
    APPELS.push({ chemin: p, methode: m, corps: opts.body || '' });
    if (p === '/post-order/v2/return/search') return EB.retoursPanne ? json({}, 500) : json(EB.retours.length ? { members: EB.retours, total: EB.retours.length } : { total: 0 });
    if (p === '/post-order/v2/inquiry/search') return EB.inquiryPanne ? json({}, 500) : json(EB.inquiries.length ? { members: EB.inquiries } : { total: 0 });
    if (p === '/post-order/v2/casemanagement/search') return json(EB.cas.length ? { members: EB.cas } : { total: 0 });
    if (p === '/sell/fulfillment/v1/payment_dispute_summary') return EB.scopePaiement ? json({}, 403) : json(EB.paiements.length ? { paymentDisputeSummaries: EB.paiements, total: EB.paiements.length } : { total: 0 });
    let r;
    if ((r = /^\/sell\/fulfillment\/v1\/order\/([^/]+)\/shipping_fulfillment$/.exec(p))) return json({ fulfillments: EB.suivi[decodeURIComponent(r[1])] ? [{ shipmentTrackingNumber: EB.suivi[decodeURIComponent(r[1])], shippingCarrierCode: 'COLISSIMO' }] : [] });
    if ((r = /^\/sell\/fulfillment\/v1\/payment_dispute\/([^/]+)$/.exec(p))) return EB.litigeDetail[r[1]] ? json(EB.litigeDetail[r[1]]) : json({}, 404);
    if (/\/contest$/.test(p) || /\/escalate$/.test(p)) return new Response(null, { status: 204 });
    if ((r = /^\/post-order\/v2\/inquiry\/(\d+)$/.exec(p))) return json({ inquiryId: r[1], inquiryStatusEnum: 'OPEN' });
    return json({}, 404);
  }
  return json({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
async function charger(racine) {
  const mod = await import(pathToFileURL(path.join(racine, 'api', 'ebay.js')).href + '?t=' + Math.random());
  const F = await import(pathToFileURL(path.join(racine, 'api', '_lib', 'favoris-file.js')).href + '?t=' + Math.random()).catch(() => null);
  const R = await import(pathToFileURL(path.join(racine, 'api', '_lib', 'ebay-crm-regle.js')).href + '?t=' + Math.random()).catch(() => null);
  const route = (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
  return { route, F, R };
}
const aaq = () => APPELS.filter((a) => a.nom === 'AddMemberMessageAAQToPartner');
const dest = () => aaq().map((a) => tag(a.corps, 'RecipientID'));

async function verifier(racine) {
  const out = []; let ko = 0;
  const dit = (c, m, d) => { out.push((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : '  → ' + String(d).slice(0, 260))); if (!c) ko++; };
  let route, F, R; try { ({ route, F, R } = await charger(racine)); } catch (e) { dit(false, 'la route se charge', e.message); return { ko, out }; }
  const essai = async (t, f) => { try { await f(); } catch (e) { dit(false, t + ' : exception', e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); } };
  const allumer = (quoi, textes, extra = {}) => route({ action: 'crmregler', quoi, textes, actif: true, confirme: true, ...extra });
  const passer = () => route({ action: 'crmpasser' });

  await essai('I', async () => {
    remettre();
    ROWS.ebay_orders.orders = Array.from({ length: 50 }, (_, i) => cmd(i + 1, { acheteur: `jean_martin_${String(i + 1).padStart(2, '0')}` }));
    ROWS.ebay_orders.orders.push(cmd(60, { acheteur: 'Jean_Martin_07', total: '30.00' }), cmd(61, { acheteur: 'jean_martin_07', total: '20.00', devise: 'GBP' }), cmd(62, { acheteur: 'jean_martin_07', annule: 'CANCELED' }), cmd(63, { acheteur: 'j***n' }), cmd(64, { acheteur: 'j***n' }));
    const a = await route({ action: 'crmacheteurs' });
    const l = (a.corps && a.corps.acheteurs) || [];
    dit(a.corps && a.corps.ok && l.length === 50, 'I1. 50 acheteurs au MÊME nom et à la même adresse ⇒ 50 fiches (aucune fusion par nom)', JSON.stringify([a.corps && a.corps.error, l.length]));
    dit(!l.some((x) => x.acheteur.includes('*')), 'I2. un pseudo masqué « j***n » n’est rattaché à personne', JSON.stringify(l.filter((x) => x.acheteur.includes('*'))));
    const f = await route({ action: 'crmfiche', acheteur: 'JEAN_MARTIN_07' });
    const ids = ((f.corps && f.corps.commandes) || []).map((c) => c.orderId).sort();
    dit(f.corps && f.corps.ok && ids.join() === ['27-00000007-0000', '27-00000060-0000', '27-00000061-0000', '27-00000062-0000'].join(), 'I3. la fiche de jean_martin_07 : SES 4 commandes (identifiant, casse ignorée), aucune des 49 autres', JSON.stringify(ids));
    const t = f.corps && f.corps.total;
    dit(t && t.eur === '80.00' && t.nCompte === 2 && t.autresDevises.length === 1 && t.autresDevises[0].devise === 'GBP', 'I4. total 80,00 € sur 2 commandes ; la commande en GBP écartée et DITE ; l’annulée hors total', JSON.stringify(t));
    const f2 = await route({ action: 'crmfiche', acheteur: 'j***n' });
    dit(f2.corps && f2.corps.ok === false && f2.corps.reason === 'acheteur', 'I5. une fiche pour un pseudo masqué est refusée', JSON.stringify(f2.corps));
    dit(f.corps && f.corps.litiges && Array.isArray(f.corps.messages) && Array.isArray(f.corps.avis), 'I6. la fiche lit aussi messages, évaluations, retours et litiges (en direct)', JSON.stringify(f.corps && [f.corps.messages, f.corps.avis, f.corps.litiges]));
  });

  await essai('A', async () => {
    remettre();
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'ancien', jours: 3 })];
    let p = await passer();
    dit(p.corps && p.corps.bilan && p.corps.bilan.raison === 'eteint' && aaq().length === 0, 'A1. éteint par défaut : rien n’est envoyé', JSON.stringify(p.corps));
    const r0 = await route({ action: 'crmregler', quoi: 'apresVente', textes: ['Merci {acheteur} !'], actif: true });
    dit(r0.corps && r0.corps.reason === 'confirmation', 'A2. allumer sans confirmer : refusé', JSON.stringify(r0.corps));
    const r1 = await route({ action: 'crmregler', quoi: 'apresVente', textes: ['Merci {acheteur} pour {inconnue}'], actif: true, confirme: true });
    dit(r1.corps && r1.corps.ok === false && r1.corps.reason === 'texte', 'A3. une variable inconnue est refusée', JSON.stringify(r1.corps));
    await allumer('apresVente', ['Merci {acheteur} pour « {article} » !', 'Bonjour {acheteur}, merci !', 'Merci beaucoup {acheteur}.']);
    MAINTENANT += 60000;
    ROWS.ebay_orders.orders.push(...[2, 3, 4, 5, 6, 7].map((n) => cmd(n, { acheteur: 'client_' + n, jours: 0 })));
    // La commande d'avant l'allumage (créée il y a 3 jours) n'est JAMAIS visée.
    const seq = [0.1, 0.5, 0.9, 0.2, 0.6, 0.95]; let k = 0; const mr = Math.random; Math.random = () => seq[k++ % seq.length];
    p = await passer();
    Math.random = mr;
    dit(aaq().length === 6 && !dest().includes('ancien'), 'A4. allumé : les 6 commandes NOUVELLES reçoivent un message ; celle d’avant l’allumage, aucun', JSON.stringify([dest(), p.corps]));
    const corps = aaq().map((a) => tag(a.corps, 'Body'));
    dit(new Set(corps.map((c) => c.split(' ')[0])).size >= 2 && corps.every((c) => !/\{/.test(c)) && corps.some((c) => c.includes('« Paire 2 »')), 'A5. versions au hasard, variables remplies ({acheteur}, {article})', JSON.stringify(corps));
    await passer(); await passer();
    dit(aaq().length === 6, 'A6. une fois par commande : deux passages de plus n’envoient rien', aaq().length);
    const j = ROWS.ebay_crm_journal;
    dit(j && Array.isArray(j.lignes) && j.lignes.filter((x) => x.quoi === 'apresVente' && x.etat === 'envoye').length === 6, 'A7. journalisé (6 lignes « envoyé »)', JSON.stringify(j && j.lignes && j.lignes.length));
  });

  await essai('B', async () => {
    remettre();
    await allumer('apresVente', ['Merci {acheteur} !']);
    MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'avec_retour', jours: 0 }), cmd(2, { acheteur: 'avec_reclamation', jours: 0, item: '120000000002' }), cmd(3, { acheteur: 'avec_litige', jours: 0 }), cmd(4, { acheteur: 'annulee', jours: 0, annule: 'CANCELED' }), cmd(5, { acheteur: 'rembourse', jours: 0, paye: 'FULLY_REFUNDED' }), cmd(6, { acheteur: 'normal', jours: 0 })];
    EB.retours = [{ returnId: '5001', orderId: '27-00000001-0000', state: 'RETURN_REQUESTED', buyerLoginName: 'avec_retour', creationInfo: { item: { itemId: '110000000001' } } }];
    EB.inquiries = [{ inquiryId: '6001', itemId: '120000000002', inquiryStatusEnum: 'OPEN', buyer: 'avec_reclamation' }];
    EB.paiements = [{ paymentDisputeId: 'PD-1', orderId: '27-00000003-0000', paymentDisputeStatus: 'ACTION_NEEDED', buyerUsername: 'avec_litige' }];
    EB.inquiryPanne = true;
    await passer();
    dit(aaq().length === 0, 'B1. les litiges ne sont pas lus (une source en panne) : RIEN n’est envoyé, même à « normal »', JSON.stringify(dest()));
    EB.inquiryPanne = false;
    await passer();
    dit(dest().join() === 'normal', 'B2. retour, réclamation (par annonce), litige de paiement, annulée, remboursée ⇒ rien ; « normal » seul reçoit', JSON.stringify(dest()));
    remettre(); await allumer('apresVente', ['Merci !']); MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'x1', jours: 0 })]; EB.scopePaiement = true;
    const p = await passer();
    dit(aaq().length === 0 && p.corps.bilan.raison === 'scope-litiges', 'B3. droit des litiges de paiement absent : rien n’est envoyé, la raison est dite (« reconnecte eBay »)', JSON.stringify(p.corps.bilan));
  });

  await essai('L', async () => {
    remettre();
    await allumer('livraison', ['Bien reçu {acheteur} ? Suivi {suivi}', 'Bien reçu {acheteur} ?'], { delaiJ: 1 });
    MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'livre', jours: 0, etat: 'FULFILLED' }), cmd(2, { acheteur: 'pas_prouve', jours: 0, etat: 'FULFILLED' }), cmd(3, { acheteur: 'trop_tot', jours: 0, etat: 'FULFILLED' })];
    EB.livraisons = { '27-00000001-0000': MAINTENANT - 2 * JOUR, '27-00000003-0000': MAINTENANT - 3600000 };
    EB.suivi = { '27-00000001-0000': '6A12345678901' };
    { const mr = Math.random; Math.random = () => 0; await passer(); Math.random = mr; }
    dit(dest().join() === 'livre', 'L1. « après livraison » : seulement la livraison PROUVÉE et passée de son délai (1 j)', JSON.stringify(dest()));
    dit(/6A12345678901/.test(tag((aaq()[0] || {}).corps || '', 'Body') || ''), 'L2. {suivi} rempli par le n° lu chez eBay', JSON.stringify(aaq()[0] && tag(aaq()[0].corps, 'Body')));
    remettre(); await allumer('apresVente', ['Merci !']); MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'incertain', jours: 0 })]; EB.aaq = 'panne';
    await passer(); EB.aaq = 'ok'; await passer(); await passer();
    dit(aaq().length === 1 && ROWS.ebay_crm_journal.lignes[0].etat === 'incertain', 'L3. un envoi sans réponse d’eBay est « incertain » et n’est JAMAIS renvoyé', JSON.stringify([aaq().length, ROWS.ebay_crm_journal.lignes]));
  });

  await essai('F', async () => {
    remettre();
    await allumer('evalAuto', ['Super acheteur, merci !']);
    await allumer('demandeEval', ['Si tout va bien, une évaluation ?'], { delaiJ: 0 });
    MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'paye1', jours: 0, etat: 'FULFILLED' }), cmd(2, { acheteur: 'paye2', jours: 0, etat: 'FULFILLED' }), cmd(3, { acheteur: 'exclu_eb', jours: 0, etat: 'FULFILLED' }), cmd(4, { acheteur: 'non_paye', jours: 0, paye: 'PENDING' })];
    EB.attente = [{ itemId: '110000000001', tx: '701', acheteur: 'paye1' }, { itemId: '110000000003', tx: '703', acheteur: 'exclu_eb' }, { itemId: '110000000004', tx: '704', acheteur: 'non_paye' }];
    EB.livraisons = { '27-00000001-0000': MAINTENANT - JOUR, '27-00000002-0000': MAINTENANT - JOUR, '27-00000003-0000': MAINTENANT - JOUR };
    EB.avis = [{ id: '8001', de: 'paye2', itemId: '110000000002' }];
    const x = await route({ action: 'crmexclure', site: 'ebay', id: 'EXCLU_EB', confirme: true });
    dit(x.corps && x.corps.ok && x.corps.exclus.some((e) => e.id === 'exclu_eb'), 'X1. exclure un acheteur eBay par son identifiant', JSON.stringify(x.corps));
    const xn = await route({ action: 'crmexclure', site: 'ebay', id: 'Jean Martin', confirme: true });
    dit(xn.corps && xn.corps.ok === false && xn.corps.reason === 'identifiant', 'X2. exclure par un NOM est refusé', JSON.stringify(xn.corps));
    await passer(); await passer();
    const lf = APPELS.filter((a) => a.nom === 'LeaveFeedback');
    dit(lf.length === 1 && tag(lf[0].corps, 'TargetUser') === 'paye1' && tag(lf[0].corps, 'TransactionID') === '701', 'F1. évaluation automatique : seulement la vente payée qu’eBay dit en attente, pas l’exclu, pas l’impayée, une fois', JSON.stringify(lf.map((a) => tag(a.corps, 'TargetUser'))));
    dit(dest().join() === 'paye1', 'F2. demande d’évaluation : sautée pour qui a déjà évalué (paye2) et pour l’exclu ; une fois', JSON.stringify(dest()));
    EB.exclusPanne = true; remettre(); EB.exclusPanne = true;
    await allumer('apresVente', ['Merci !']); MAINTENANT += 60000;
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'y', jours: 0 })]; ROWS.vrm_crm_exclus = { liste: [] };
    const p = await passer(); EB.exclusPanne = false;
    dit(aaq().length === 0 && p.corps.bilan.raison === 'exclusion-pas-sue', 'X3. liste d’exclusion pas lue : rien ne part', JSON.stringify(p.corps.bilan));
  });

  await essai('V', async () => {
    if (!F || !F.reserverFile || !R) { dit(false, 'V. la file des favoris et les règles se chargent'); return; }
    const t0 = 1_800_000_000_000;
    const cible = (i, r) => ({ itemId: String(100 + i), recipientId: r, notificationId: 'n' + i, initiator: 'favori' });
    const lance = F.lancerFile(null, { owner: 'o', targets: [cible(1, '42'), cible(2, '43')], message: 'Bonjour', intervalleMinutes: 0, maintenant: t0 });
    const exclus = R.exclusDuSite({ liste: [{ site: 'vinted', id: 'https://www.vinted.fr/member/42-pseudo' }] }, 'vinted');
    const r1 = F.reserverFile(lance.data, { owner: 'o', maintenant: t0 + 1, jeton: 'j1', exclus });
    dit(r1.valeur.travail && r1.valeur.travail.recipientId === '43' && r1.data.groupes.o.jobs.find((j) => j.recipientId === '42').etat === 'annule', 'V1. Vinted : le membre exclu (lien de profil collé) n’est jamais réservé, l’autre oui', JSON.stringify(r1.valeur.travail));
    const r2 = F.reserverFile(lance.data, { owner: 'o', maintenant: t0 + 1, jeton: 'j2', exclus: null });
    dit(!r2.valeur.travail, 'V2. Vinted : liste d’exclusion pas lue ⇒ rien n’est réservé', JSON.stringify(r2.valeur));
  });

  await essai('R', async () => {
    remettre();
    EB.avis = [{ id: '8101', de: 'acheteur_a', itemId: '110000000009', tx: '909', type: 'Negative', texte: 'Lent' }, { id: '8102', de: 'acheteur_b', itemId: '110000000010', reponse: 'Merci' }];
    const s0 = await route({ action: 'crmrepondreavis', feedbackId: '8101', texte: 'Désolé du délai.' });
    dit(s0.corps.reason === 'confirmation' && !APPELS.some((a) => a.nom === 'RespondToFeedback'), 'R1. répondre sans son clic : rien');
    const s1 = await route({ action: 'crmrepondreavis', feedbackId: '8102', texte: 'Merci', confirme: true });
    dit(s1.corps.reason === 'deja' && !APPELS.some((a) => a.nom === 'RespondToFeedback'), 'R2. déjà répondu (relu chez eBay) : rien', JSON.stringify(s1.corps));
    const s2 = await route({ action: 'crmrepondreavis', feedbackId: '8101', texte: 'Désolé du délai.', confirme: true });
    const rf = APPELS.find((a) => a.nom === 'RespondToFeedback');
    dit(s2.corps.ok && rf && tag(rf.corps, 'TargetUserID') === 'acheteur_a' && tag(rf.corps, 'ResponseType') === 'Reply' && tag(rf.corps, 'TransactionID') === '909', 'R3. réponse publique envoyée à l’auteur relu (Reply, sa transaction)', JSON.stringify(s2.corps));
    ROWS.ebay_orders.orders = [cmd(1, { acheteur: 'client_c' })];
    const e0 = await route({ action: 'crmecrire', orderId: '27-00000099-0000', texte: 'Bonjour', confirme: true });
    dit(e0.corps.ok === false && e0.corps.reason === 'commande' && !aaq().length, 'R4. écrire pour une commande non rangée : refusé, rien n’est envoyé', JSON.stringify(e0.corps));
    const e1 = await route({ action: 'crmecrire', orderId: '27-00000001-0000', acheteur: 'client_c', texte: 'Bonjour {acheteur}', confirme: true });
    dit(e1.corps.ok === false && !aaq().length, 'R5. une variable pas remplie ne part pas', JSON.stringify(e1.corps));
    const e1b = await route({ action: 'crmecrire', orderId: '27-00000001-0000', acheteur: 'autre_pseudo', texte: 'Bonjour', confirme: true });
    dit(e1b.corps.ok === false && e1b.corps.reason === 'acheteur' && !aaq().length, 'R5b. l’acheteur vu à l’écran n’est pas celui de la commande : rien n’est envoyé', JSON.stringify(e1b.corps));
    const e2 = await route({ action: 'crmecrire', orderId: '27-00000001-0000', acheteur: 'client_c', texte: 'Bonjour client_c', confirme: true });
    dit(e2.corps.ok && dest().join() === 'client_c', 'R6. écrire à l’acheteur d’une commande rangée : le destinataire est CELUI de la commande', JSON.stringify(e2.corps));
    const e3 = await route({ action: 'crmecrire', itemId: '110000000001', acheteur: 'quelqu_un', texte: 'Bonjour', confirme: true });
    dit(e3.corps.ok === false && e3.corps.reason === 'commande' && dest().length === 1, 'R6b. depuis une conversation : un pseudo SANS commande de cette annonce ⇒ rien n’est envoyé', JSON.stringify(e3.corps));
    const e4 = await route({ action: 'crmecrire', itemId: '110000000001', acheteur: 'CLIENT_C', texte: 'Re', confirme: true });
    dit(e4.corps.ok && dest().join() === 'client_c,client_c', 'R6c. depuis une conversation : l’acheteur de CETTE annonce (sa commande) reçoit', JSON.stringify(e4.corps));
    EB.retours = [{ returnId: '5002', orderId: 'o2', state: 'RETURN_REQUESTED', buyerLoginName: 'b', sellerResponseDue: { respondByDate: { value: new Date(MAINTENANT + 3 * JOUR).toISOString() } }, creationInfo: { item: { itemId: '1' } } }];
    EB.paiements = [{ paymentDisputeId: 'PD-9', orderId: 'o3', paymentDisputeStatus: 'ACTION_NEEDED', respondByDate: new Date(MAINTENANT + JOUR).toISOString(), buyerUsername: 'c' }];
    const li = await route({ action: 'crmlitiges' });
    dit(li.corps.ok && li.corps.litiges.map((x) => x.id).join() === 'PD-9,5002', 'R7. retours et litiges en une liste, l’échéance la plus proche d’abord', JSON.stringify(li.corps.litiges && li.corps.litiges.map((x) => [x.id, x.limite])));
    const c0 = await route({ action: 'crmcontester', sorte: 'paiement', id: 'PD-9', note: 'Colis livré, suivi joint.' });
    dit(c0.corps.reason === 'confirmation' && !APPELS.some((a) => /contest$/.test(a.chemin || '')), 'R8. contester sans son clic : rien');
    EB.litigeDetail['PD-9'] = { paymentDisputeId: 'PD-9', paymentDisputeStatus: 'UNDER_REVIEW', availableChoices: [], revision: 2 };
    const cx = await route({ action: 'crmcontester', sorte: 'paiement', id: 'PD-9', note: 'Colis livré.', confirme: true });
    dit(cx.corps.reason === 'etat' && !APPELS.some((a) => /contest$/.test(a.chemin || '')), 'R8b. relu chez eBay : il n’attend plus de contestation ⇒ rien n’est envoyé', JSON.stringify(cx.corps));
    EB.litigeDetail['PD-9'] = { paymentDisputeId: 'PD-9', paymentDisputeStatus: 'ACTION_NEEDED', availableChoices: ['CONTEST', 'ACCEPT'], revision: 3 };
    const c1 = await route({ action: 'crmcontester', sorte: 'paiement', id: 'PD-9', note: 'Colis livré, suivi joint.', confirme: true });
    const ct = APPELS.find((a) => /contest$/.test(a.chemin || ''));
    dit(c1.corps.ok && ct && JSON.parse(ct.corps).revision === 3, 'R9. contester : relu chez eBay, puis envoyé avec SA version', JSON.stringify(c1.corps));
    const jr = ROWS.ebay_agent_journal && ROWS.ebay_agent_journal.items;
    dit(Array.isArray(jr) && jr.some((x) => x.action === 'crmcontester') && jr.some((x) => x.action === 'crmrepondreavis'), 'R10. les gestes du CRM sont au journal « Ce que VRM a fait »', JSON.stringify(jr && jr.map((x) => x.action)));
  });
  return { ko, out };
}

const MUTATIONS = {
  'fusion-par-nom': ['api/_lib/ebay-crm-regle.js', 'export const acheteurDeCommande = (o) => cleAcheteur(o && o.buyer && o.buyer.username);', "export const acheteurDeCommande = (o) => cleAcheteur(String((o && o.buyer && o.buyer.buyerRegistrationAddress && o.buyer.buyerRegistrationAddress.fullName) || '').replace(/ /g, '_'));"],
  'masque-regroupe': ['api/_lib/ebay-crm-regle.js', "    if (!c || acheteurMasque(c)) continue;\n    if (qq", '    if (!c) continue;\n    if (qq'],
  'sans-exclusion': ['api/_lib/ebay-crm-regle.js', "  if (ex) return { ok: false, raison: 'exclu' };", ''],
  'exclusion-pas-sue-ignoree': ['api/_lib/ebay-crm.js', "    if (exclus === undefined) return { fait: false, raison: 'exclusion-pas-sue' };", "    if (false) return { fait: false, raison: 'exclusion-pas-sue' };"],
  'sans-une-fois': [['api/_lib/ebay-crm-regle.js', "  if (faits && faits[id] && faits[id][quoi]) return { ok: false, raison: 'deja-fait' };", ''], ['api/_lib/ebay-crm.js', '          if (f[o.orderId] && f[o.orderId][quoi]) return undefined;\n', '']],
  'sans-litiges': ['api/_lib/ebay-crm-regle.js', "  if (blocages.commandes && blocages.commandes.has(id)) return 'retour-ou-litige';", ''],
  'litiges-pas-sus-ignores': ['api/_lib/ebay-crm.js', "    if (l.manque.length) return { fait: false", "    if (false) return { fait: false"],
  'historique-relance': ['api/_lib/ebay-crm-regle.js', "  if (cree < reglage.depuis) return { ok: false, raison: 'avant-allumage' };", ''],
  'livraison-supposee': ['api/_lib/ebay-crm-regle.js', "    if (!Number.isFinite(livreLe)) return { ok: false, raison: 'livraison-pas-prouvee', plusTard: true };", '    if (!Number.isFinite(livreLe)) return { ok: true };'],
  'toujours-premiere-version': ['api/_lib/ebay-crm-regle.js', '  const k = Math.min(possibles.length - 1, Math.max(0, Math.floor(Number(aleatoire) * possibles.length) || 0));', '  const k = 0;'],
  'allumer-sans-clic': ['api/_lib/ebay-crm.js', "      if (b.actif === true && b.confirme !== true) return", '      if (false) return'],
  'favori-exclu-envoye': ['api/_lib/favoris-file.js', "if(x.etat==='attente'&&exclus.has(String(x.recipientId)))", 'if(false)'],
  'eval-hors-attente': ['api/_lib/ebay-crm.js', "          if (!ev) { saute('n-attend-pas'); continue; }", "          if (!ev) ev = { itemId: item, transactionId: '0', acheteur: o.buyer.username };"],
  'contester-sans-relire': ['api/_lib/ebay-crm.js', "      if (etat !== 'ACTION_NEEDED' || (choix.length && !choix.includes('CONTEST'))) return", '      if (false) return'],
  'ecrire-a-un-autre': ['api/_lib/ebay-crm.js', "    if (b.acheteur != null && !memeAcheteur(b.acheteur, acheteurDeCommande(o))) return", '    if (false) return'],
  'ecrire-sans-commande': ['api/_lib/ebay-crm.js', "    const o = b.orderId != null ? orders.find((x) => x.orderId === String(b.orderId || '') && (x._compte || 'principal') === refCompte(ctx))", "    const o = b.orderId != null ? (orders.find((x) => x.orderId === String(b.orderId || '')) || orders[0])"],
  'conversation-sans-commande': ['api/_lib/ebay-crm.js', " && memeAcheteur(b.acheteur, acheteurDeCommande(x)) && (x.lineItems || [])", " && (x.lineItems || [])"],
};
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-crm-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(d, 'api'), { recursive: true });
  fs.symlinkSync(path.join(RACINE, 'src'), path.join(d, 'src'));   // l'app n'est pas mutée : un lien suffit
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  const m = MUTATIONS[mut];
  for (const [f, a, b] of Array.isArray(m[0]) ? m : [m]) {
    const p = path.join(d, f), t = fs.readFileSync(p, 'utf8');
    if (!t.includes(a)) throw new Error(`ancre absente dans ${f}`);
    fs.writeFileSync(p, t.replace(a, b));
  }
  return d;
}
function arbreAvant() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-crm-avant-'));
  execFileSync('tar', ['-x', '-C', d], { input: execFileSync('git', ['archive', 'ba4435439', 'api', 'src'], { cwd: RACINE, maxBuffer: 1 << 28 }) });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}
(async () => {
  if (process.argv.includes('--avant')) { const { ko, out } = await verifier(arbreAvant()); out.forEach((l) => console.log(l)); console.log(`\nArbre d'avant : ${ko} rouge(s) (attendu : beaucoup)`); process.exit(ko ? 0 : 1); }
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(RACINE);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  let vertes = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let d; try { d = copie(m); } catch (e) { console.log(`KO  ${m} : ${e.message}`); vertes++; continue; }
    const { ko, out } = await verifier(d);
    console.log(`${ko ? 'OK ' : 'KO '} mutation « ${m} » : ${ko} rouge(s)${ko ? ' — ' + out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 70)).slice(0, 2).join(' | ') : ''}`);
    if (!ko) vertes++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${Object.keys(MUTATIONS).length - vertes}/${Object.keys(MUTATIONS).length} mutations rougies`);
  process.exit(vertes ? 1 : 0);
})();
