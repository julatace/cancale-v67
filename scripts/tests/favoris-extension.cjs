// ════════════════════════════════════════════════════════════════════════════
//  LE VRAI MOTEUR DES MESSAGES AUX FAVORIS DE L'EXTENSION (27 nov., porté sur le chemin d'aujourd'hui)
//
//  Ce test jouait le protocole du 29 oct. (5.280 : POST /api/v2/conversations puis /replies par `vintedPage`). Ce chemin
//  a été remplacé exprès : 5.414 (`toutinterface`, docs/passation/2026-11-21-extension-interface.md), puis 5.455 (26 nov. soir,
//  Julien : « A, fais comme Vintex ») — inquiries → conversation relue → transaction → offre → message, depuis la page,
//  seules écritures permises (`ECRITURES_FAVORI`). Le test restait rouge sans être lancé par aucun workflow.
//  Mêmes garanties, sur le VRAI `executerMessageFavori` de background.js (scripts/_fond-vm.cjs : fausse base, faux Vinted
//  qui compte chaque requête, fausse page) ; seuls le serveur VRM (autorisation à usage unique) et Vinted sont simulés.
//  Le canal direct de Chrome (`onMessageExternal`) est jugé sur le contexte d'audit-exec.cjs, comme avant.
//  Données inventées. Aucune requête réelle.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const scripts = path.resolve(__dirname, '..');
const { faireFond } = require('../_fond-vm.cjs');
const BG = path.join(scripts, '..', 'vinted-sync-extension', 'background.js');
let controles = 0; const check = (v, m, d) => { assert.ok(v, m + (d ? ' — ' + String(d).slice(0, 700) : '')); controles++; };
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', UUID = '01a1fdff-71a1-4c2b-9d3e-0123456789ab', TEXTE = 'Bonjour identique !';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
const REPLIES = `/messaging/main/conversations/${UUID}/replies`;

function monter(o = {}) {
  const conv = Object.assign({ id: UUID, core_id_deprecated: 301, allow_reply: !o.interdit, opposite_users: [{ id: o.autreDestinataire ? 999 : 201, login: 'pseudo_banc' }], data: { transaction_id: 5001, items: [{ id: 101 }] }, messages: o.dejaContacte ? [{ entity_type: o.dejaContacte, content: 'message existant' }] : [] }, o.conv || {});
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } } };
  const store = { __commeBleamDefaut: true, __favorisVintex: true, ...(o.sessionAbsente ? { __sansSession: true } : {}) };
  let f = null;
  f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store,
    vinted: (e) => {
      if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return o.creationStatus ? { status: o.creationStatus, body: {} } : { status: 201, body: { id: UUID, conversation_id: UUID } };
      if (e.methode === 'GET' && e.chemin === `/messaging/main/conversations/${UUID}`) { if (o.bascule) { f.ctx.activeAccountId = async () => '999'; f.ctx.activeUidForDomain = async () => '999'; } return { status: 200, body: { conversation: conv } }; }
      if (e.methode === 'GET' && e.chemin === '/api/v2/transactions/5001') return { status: 200, body: { transaction: { id: 5001, item_id: o.autreArticle ? 102 : 101, buyer_id: 201, item_title: 'Baskets banc', item: { id: o.autreArticle ? 102 : 101, price: { amount: '50.0', currency_code: 'EUR' } } } } };
      if (e.methode === 'POST' && e.chemin === '/api/v2/transactions/5001/offers') return { status: 200, body: { code: 0 } };
      if (e.methode === 'GET' && e.chemin === '/api/v2/authorization/check/phone_verification') return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && e.chemin === REPLIES) {
        if (o.reponsePerdue) throw new Error('réponse perdue après départ');
        return { status: o.replyStatus || 201, body: o.sansAccuse ? {} : { conversation_id: UUID, data: { content: TEXTE } } };
      }
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch; const grants = [];
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(op.body || '{}'); grants.push(c.action);
      if (o.grantPerdu && c.action === 'consommer') throw new Error('transport interrompu');
      if (o.grantRefuse || (o.arreteAvantReponse && c.action === 'verifier')) return { ok: false, status: 409, json: async () => ({ ok: false }) };
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 'suivi-non-secret', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, message: TEXTE } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, op);
  };
  f.evenements = [];
  f.ctx.notifierApp = async (e) => { f.evenements.push({ ...e, ecritsAvant: f.j.vinted.filter((x) => x.methode !== 'GET').length }); };
  if (o.sansOnglet) f.ctx.pageVintedPour = async () => ({ refus: 'onglet' });
  f.clics = []; f.ctx.interfaceVinted = async (acc, geste) => { f.clics.push(geste); return { ok: false, rienParti: true, sansPage: 'element' }; };
  f.grants = grants;
  return f;
}
const jouer = async (f) => { const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.stack || e) })); return (r && r.json) || r || {}; };
const ecrits = (f) => f.j.vinted.filter((v) => v.methode !== 'GET');
const reponses = (f) => ecrits(f).filter((v) => v.chemin === REPLIES);
const court = (f, r) => JSON.stringify({ r, v: f.j.vinted.map((x) => x.methode + ' ' + x.chemin), g: f.grants }).slice(0, 700);

(async () => {
  // ── LE CHEMIN POSITIF ─────────────────────────────────────────────────────────────────────────────────────────────────────
  { const f = monter(), r = await jouer(f);
    check(r.resultat === 'envoye', 'chemin positif : message confirmé après création et lecture du bon fil', court(f, r));
    const etapes = f.evenements.filter((e) => e.type === 'favoris').map((e) => e.etape);
    check(etapes[0] === 'autorisation' && etapes[etapes.length - 1] === 'confirmation', 'les étapes émises vont de l’autorisation à la confirmation', etapes.join(','));
    const at = (n) => (f.evenements.find((e) => e.etape === n) || {}).ecritsAvant;
    check(at('autorisation') === 0 && at('conversation') <= 1 && at('envoi') === 1 && at('confirmation') === 2, 'les étapes émises suivent les écritures réelles (rien avant la conversation, le message avant la confirmation)', JSON.stringify(f.evenements.map((e) => [e.etape, e.ecritsAvant])));
    check(f.evenements.every((e) => !JSON.stringify(e).includes(JETON) && !JSON.stringify(e).includes(TEXTE)), 'aucun ticket ou texte privé dans les événements de progression');
    check(ecrits(f).length === 2 && f.grants[0] === 'consommer' && !f.clics.length, 'une consommation ; deux écritures (autorisation sans offre) : conversation, message ; aucun clic', court(f, r));
    const [q, m] = ecrits(f).map((x) => JSON.parse(x.corps));
    check(JSON.stringify(q) === JSON.stringify({ item_ids: ['101'], receiver_id: '201' }), 'format de la conversation observé chez Vinted, sans champ inventé', JSON.stringify(q));
    check(m.content === TEXTE, 'texte exact de l’autorisation serveur', JSON.stringify(m)); }
  // ── CE QUI BLOQUE : AUCUN MESSAGE ─────────────────────────────────────────────────────────────────────────────────────────
  for (const o of [{ autreDestinataire: true }, { interdit: true }, { bascule: true }, { grantRefuse: true }, { arreteAvantReponse: true }, { creationStatus: 429 }, { creationStatus: 401 }]) {
    const f = monter(o), r = await jouer(f);
    check(r.resultat !== 'envoye', 'blocage ' + JSON.stringify(o), court(f, r));
    check(!reponses(f).length, 'aucun message ' + JSON.stringify(o), court(f, r));
  }
  // (27 nov., 5.455.4 — Julien : « fais comme Vintex ») Le fil rouvert par Vinted avec CE même acheteur parle d'un AUTRE
  //    article (sa transaction est celle de l'autre article) et l'inquiry ne rend pas de transaction : comme Vintex, le
  //    message part dans ce fil ; mais AUCUNE offre n'est jamais posée sur la transaction de l'autre article.
  { const f = monter({ autreArticle: true }), r = await jouer(f);
    check(r.resultat === 'envoye' && reponses(f).length === 1, 'fil rouvert sur un autre article du même acheteur : le message part (comme Vintex)', court(f, r));
    check(!ecrits(f).some((x) => /\/transactions\/5001\/offers$/.test(x.chemin)), 'jamais d’offre sur la transaction de l’autre article', court(f, r)); }
  // (27 nov. soir) L'INVITATION de Vinted à faire une offre (un type « offer… » sans montant ni texte) n'est pas un contact :
  //    l'offre et le message partent, comme Vintex.
  { const f = monter({ conv: { messages: [{ entity_type: 'offer_request_message' }] } }), r = await jouer(f);
    check(r.resultat === 'envoye' && reponses(f).length === 1, 'invitation à faire une offre (sans montant ni texte) : le message part', court(f, r)); }
  // ── INCERTAIN : DIT, JAMAIS REJOUÉ ────────────────────────────────────────────────────────────────────────────────────────
  // (5.455) L'accusé d'un message est le 2xx de la messagerie de Vinted (cette API ne porte pas le `code: 0` de l'ancienne) :
  //    le cas « 200 sans code » de l'ancien protocole n'existe plus ; restent la réponse perdue (aucun statut) et le 5xx.
  for (const o of [{ reponsePerdue: true }, { replyStatus: 503 }, { replyStatus: 502 }]) {
    const f = monter(o), r = await jouer(f);
    check(r.resultat === 'incertain', 'incertitude explicite ' + JSON.stringify(o), court(f, r));
    check(reponses(f).length <= 1, 'aucun rejeu ' + JSON.stringify(o), court(f, r));
  }
  { const f = monter({ grantPerdu: true }), r = await jouer(f);
    check(r.resultat !== 'envoye' && !ecrits(f).length, 'autorisation perdue en route : rien ne part chez Vinted', court(f, r)); }
  // ── DÉJÀ CONTACTÉ ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const type of ['message', 'user_message', 'offer_request_message']) {
    const f = monter({ dejaContacte: type }), r = await jouer(f);
    check(r.resultat === 'ignore', 'conversation existante ignorée ' + type, court(f, r));
    check(!reponses(f).length && ecrits(f).length === 1, 'aucun message supplémentaire ' + type, court(f, r));
  }
  // ── SANS ONGLET, SANS SESSION ─────────────────────────────────────────────────────────────────────────────────────────────
  { const f = monter({ sansOnglet: true }), r = await jouer(f);
    check(r.resultat === 'refuse' && !ecrits(f).length, 'sans onglet Vinted : refus, aucun appel Vinted', court(f, r)); }
  { const f = monter({ sessionAbsente: true }), r = await jouer(f);
    check(r.resultat !== 'envoye' && !f.j.vinted.length && !f.grants.length, 'session extension absente : aucun appel Vinted ni VRM', court(f, r)); }

  // ── LE CANAL DIRECT DE CHROME (contexte d'audit-exec.cjs, inchangé) ───────────────────────────────────────────────────────
  let prefix = fs.readFileSync(path.join(scripts, 'audit-exec.cjs'), 'utf8').split('const REPONSE =')[0];
  const bac = { require: require('node:module').createRequire(path.join(scripts, 'audit-exec.cjs')), __dirname: scripts, console, setTimeout, clearTimeout, clearInterval, URL, TextDecoder, TextEncoder, Buffer };
  vm.runInNewContext(prefix + '\nglobalThis.creer=faireCtx;', bac);
  const direct = () => { const c = bac.creer(), appels = []; c.ctx.fetch = async (url) => { appels.push(String(url)); return { ok: false, status: 503, json: async () => ({}) }; }; c.ctx.authEtatRapide = async () => ({ connecte: true, user_id: 'owner-fixture' }); return { ...c, appels }; };
  { const c = direct(); const r = await c.versExt({ type: 'favorisEtat' });
    check(r && r.ok && r.code === JSON.parse(fs.readFileSync(path.join(scripts, '..', 'vinted-sync-extension', 'manifest.json'), 'utf8')).version, 'Chrome répond directement sans pont de page', JSON.stringify(r));
    check(!c.appels.some((u) => /vinted\./.test(u)), 'la santé directe ne contacte pas Vinted', c.appels.join(',')); }
  { const c = direct(); const r = await c.versExt({ type: 'favorisExec', uid: '3175765377', endpoint: '/api/v2/conversations/301/replies', body: { jeton: JETON } });
    check(!(r && r.ok) && !c.envois.length && !c.appels.some((u) => /vinted\./.test(u)), 'le canal direct ne devient pas un relais générique', JSON.stringify(r)); }
  { const c = direct(); const r = await c.versExt({ type: 'favorisEtat' }, 'https://evil.invalid');
    check(!(r && r.ok) && !c.appels.length, 'origine étrangère refusée aussi pour la santé directe', JSON.stringify(r)); }
  { const c = direct(); const r = await c.ctx.executerPourApp({ uid: '3175765377', method: 'POST', endpoint: '/vrm/favoris', body: { jeton: JETON } }, { origin: 'https://vrm.center.imposteur.invalid' });
    check(!(r && r.ok) && !c.appels.length && !c.envois.length, 'origine étrangère : aucune autorisation demandée, aucun Vinted', JSON.stringify(r)); }
  { const c = direct(); const r = await c.ctx.executerPourApp({ uid: '3175765377', method: 'POST', endpoint: '/api/v2/conversations', body: { item_id: '101', opposite_user_id: '201' } }, { origin: 'https://vrm.center' });
    check(!(r && r.ok) && !c.envois.length, 'la création de conversation générique reste hors de la liste blanche', JSON.stringify(r)); }
  console.log(controles + ' contrôles du vrai moteur extension réussis');
})().catch((e) => { console.error(e); process.exitCode = 1; });
