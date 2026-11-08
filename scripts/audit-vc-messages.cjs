// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES VESTIAIRE : LA MESSAGERIE PASSE PAR « STREAM » (3 nov., 5.317)
//
//  Julien (3 nov., 10 h 02) : « les messages Vestiaire ne marchent pas, ils ne
//  sont pas captés, même avec la dernière extension ». MESURÉ sur sa base
//  (lecture seule, noms de clés et hôtes) : la page `/chat/` demande un jeton
//  `provider: 'stream'` puis parle à `chat.stream-chat.com` ; vc-inject.js ne
//  lisait que vestiairecollective.com ⇒ aucune conversation, aucun fil rangé.
//  La seule liste sur vestiairecollective.com — le fil des notifications
//  `category=messages` — était écartée exprès.
//
//  Ce qui doit rester vrai (VRAI vc-inject.js → VRAI vc.js → VRAI background.js
//  dans `_fond-vm.cjs`, réponses FABRIQUÉES à la forme mesurée — aucune donnée
//  réelle, le dépôt est public) :
//   M1  le compte ouvert : le `user_id` que la page donne à Stream (chiffres
//       seulement), jamais à la place d'un `/users/me` lu ; `vc_session.source`.
//   M2  le fil des notifications « messages » ⇒ une conversation par carte :
//       identifiant, article, aperçu, date, titre/photo de l'ARTICLE ; jamais
//       le nom ni la photo de la personne ; « lu » seulement s'il est dit.
//   M3  la liste Stream (`POST /channels`) ⇒ conversations + FILS : texte, date,
//       « de toi » (auteur = compte ouvert), non-lu = la ligne `read` du compte
//       ouvert ; un message supprimé ne passe pas ; aucun nom ne sort.
//   M4  une conversation ouverte (`…/query`, en XHR comme la page) ⇒ son fil.
//   M5  une réponse inconnue n'est PAS « lue, vide » ; `{channels: []}` est une
//       liste vide ; une erreur 4xx ne donne rien.
//   M6  ton envoi par Stream ⇒ noté « pas rejouable » (`messagerie-stream`),
//       ton texte ne sort pas dans la recette ; le message rejoint le fil.
//   M7  ouvrir une conversation (`POST /chat/channel/`) n'est pas un envoi.
//   M8  le fond : conversations rangées (titre, photo), fils rangés, compte de
//       l'onglet ≠ compte de la page ⇒ aucun compte posé ; lecture ratée ⇒ rien
//       écrit ; un essai Stream ne remplace jamais une recette rejouable et
//       « Envoyer » reste refusé sans recette apprise.
//   M9  l'app : le titre/la photo de l'article affichés, la raison Stream dite.
//  `--src`/`--inject`/`--relais`/`--app` : une autre copie (preuve sur le code
//  d'avant). `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['hoteStream', 'inject', "if ((DE_VC(url) || DE_STREAM(url)) && /^(POST|PUT)$/i.test(String(this.__vcMeth || ''))) noteEnvoi(url, this.__vcMeth, this.status, this.__vcCorps, this.__vcH);\n            if (t && DE_STREAM(url)", "if ((DE_VC(url) || DE_STREAM(url)) && /^(POST|PUT)$/i.test(String(this.__vcMeth || ''))) noteEnvoi(url, this.__vcMeth, this.status, this.__vcCorps, this.__vcH);\n            if (false && DE_STREAM(url)"],
    ['fluxEcarte', 'inject', "if (!lien || lien.type !== 'chat' || !lien.data) continue;", 'continue;'],
    ['moiPasChiffres', 'inject', "if (!/^\\d{3,15}$/.test(id)) return;", 'if (!id) return;'],
    ['moiEcrase', 'inject', "if (moiId && moiSource !== 'stream') return;   // `/users/me` lu dans ce document fait foi", ''],
    ['nonLuDevine', 'inject', "if (!moiId || !etat || !Array.isArray(etat.read)) return null;", "if (!moiId || !etat || !Array.isArray(etat.read)) return true;"],
    ['fluxLuDevine', 'inject', "const nonLu = deMoi === true || e.status === 'read' ? false : null;", 'const nonLu = false;'],
    ['supprime', 'inject', "if (e.type === 'deleted' || e.deleted_at) return null;", ''],
    ['inconnuVide', 'inject', "if (!Array.isArray(obj.channels)) { post({ kind: 'vcmessages', conversations: [], offset: 0, total: null, lus: 0, forme: [], inconnu: formeStream(obj), page: pageIci(), moi: moiId }); return; }", "if (!Array.isArray(obj.channels)) { post({ kind: 'vcmessages', conversations: [], offset: 0, total: null, lus: 0, forme: [], page: pageIci(), moi: moiId }); return; }"],
    ['erreurLue', 'inject', "if (!DE_STREAM(url) || !(statut >= 200 && statut < 300)) return;", 'if (!DE_STREAM(url)) return;'],
    ['canalEnvoi', 'inject', "if (/\\/chat\\/(channel|user)(\\/|$)/i.test(u.pathname)) return null;", ''],
    ['streamRejouable', 'inject', "rejouable: false, raison: 'messagerie-stream' };\n    if (!DE_VC(url)", "rejouable: true, raison: 'messagerie-stream' };\n    if (!DE_VC(url)"],
    ['fondStream', 'src', "if (base.methode && /^([a-z0-9-]+\\.)*(stream-chat\\.com|stream-io-api\\.com)$/i.test(String(r.hote || ''))) return { ...base, hote: String(r.hote), rejouable: false, raison: 'messagerie-stream' };", ''],
    ['fondTitre', 'src', "titre: coupeVc(x.titre || prev.titre || '', 120),", ''],
    ['compteOnglet', 'src', "return onglet && page && onglet === page ? onglet : '';", 'return page || onglet;'],
    ['appTitre', 'app', "titre={(fv && fv.titre) || v.titreArticle || (v.num ? '' : 'Pas reliée à un article VRM')}", "titre={(fv && fv.titre) || (v.num ? '' : 'Pas reliée à un article VRM')}"],
    ['appStream', 'app', "envoi && envoi.raison === 'messagerie-stream'", 'false'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-messages-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const STREAM = 'https://chat.stream-chat.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
const Q = '?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR';

// Tout est INVENTÉ (le dépôt est public) — seules les FORMES suivent la mesure.
const MOI = '11112222', ACH1 = '33334444', ACH2 = '55557777', ART1 = '66668888', ART2 = '99990000';
const CONV1 = `${ACH1}-${ART1}`, CONV2 = `${ACH2}-${ART2}`;
const PERSO = ['Jeanne', 'Mouette', 'jeanne@exemple.test', 'Paulo', 'avatar-jeanne', 'jeton-stream-secret', 'Julien Testeur'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return PERSO.filter((x) => s.includes(x)); };
const qs = `?user_id=${MOI}&connection_id=c0nn-1&api_key=cle-banc`;

// Le fil des notifications « messages » — forme mesurée le 3 nov. (noms de clés).
const carte = (o) => Object.assign({ id: '9900000001', date: '2026-11-03T08:00:00Z', type: 'notificationFeed', status: 'read', tapped: true, cardType: 'profile_text_product', category: 'messages',
  senderId: ACH1, textBody: 'Jeanne vous a envoyé un message privé', eventType: 'chat_message_new', cardTypeV2: 'chat', senderName: 'Jeanne', contactName: 'Jeanne',
  productLink: { url: '', meta: { data: { id: CONV1 }, type: 'chat' }, path: `/chat?id=${CONV1}`, mobile: `com.vestiairecollective.vestiaire://action?type=buyerSellerChat&productId=${ART1}&channelId=${CONV1}` },
  profileLink: { url: '', path: `/membres/profil-${ACH1}.shtml`, mobile: '' }, productTitle: 'Nike Baskets Dunk Low', productPicture: { url: `https://images.vestiairecollective.com/produit/${ART1}-1_1.jpg`, name: '', path: `/produit/${ART1}-1_1.jpg` },
  profilePicture: { url: 'https://images.vestiairecollective.com/profil/avatar-jeanne.gif', name: '', path: '/profil/avatar-jeanne.gif' }, lastChatMessage: 'Bonjour, toujours dispo ? 😊' }, o || {});
const FLUX = { data: [
  carte(),
  carte({ id: '9900000002', date: '2026-11-02T18:00:00Z', senderId: MOI, textBody: 'Vous avez envoyé un message privé à Paulo', senderName: 'Paulo', contactName: 'Paulo',
    productLink: { url: '', meta: { data: { id: CONV2 }, type: 'chat' }, path: `/chat?id=${CONV2}`, mobile: '' }, productTitle: 'Gucci Cabas Ophidia', productPicture: { url: `https://images.vestiairecollective.com/produit/${ART2}-1_1.jpg` }, lastChatMessage: 'Je poste demain' }),
  carte({ id: '9900000003', date: '2026-11-01T18:00:00Z', status: 'unseen', productLink: { url: '', meta: { data: { id: CONV1 }, type: 'chat' } }, lastChatMessage: 'ancien' }),
  carte({ id: '9900000004', category: 'updates', eventType: 'price_drop', productLink: { url: '', meta: { data: { id: '424242' }, type: 'product' } }, lastChatMessage: '' }),
], meta: { count: 4, limit: 60, offset: 0 } };
// La forme de l'API REST de Stream Chat (documentée par Stream ; jamais vue
// chez lui : l'extension ne gardait pas ces réponses — à vérifier sur sa base
// après la 5.317 dans `vc_messages.forme`).
const userS = (id, nom) => ({ id, name: nom, image: 'https://images.vestiairecollective.com/profil/avatar-jeanne.gif', role: 'user', online: false });
const msgS = (id, texte, auteur, at, o) => Object.assign({ id, text: texte, html: `<p>${texte}</p>`, type: 'regular', user: userS(auteur, auteur === MOI ? 'Julien Testeur' : 'Jeanne Mouette'), attachments: [], mentioned_users: [], created_at: at, updated_at: at }, o || {});
const etatS = (conv, art, messages, nonLusMoi) => ({
  channel: { id: conv, type: 'messaging', cid: `messaging:${conv}`, product: art, last_message_at: messages.length ? messages[messages.length - 1].created_at : '2026-11-01T00:00:00Z', created_by: userS(MOI, 'Julien Testeur'), member_count: 2 },
  messages, pinned_messages: [], watcher_count: 1,
  read: [{ user: userS(MOI, 'Julien Testeur'), last_read: '2026-11-03T07:00:00Z', unread_messages: nonLusMoi }, { user: userS(ACH1, 'Jeanne Mouette'), last_read: '2026-11-03T07:00:00Z', unread_messages: 0 }],
  members: [{ user_id: MOI, user: userS(MOI, 'Julien Testeur') }, { user_id: ACH1, user: userS(ACH1, 'Jeanne Mouette') }],
});
const LISTE = { channels: [
  etatS(CONV1, ART1, [msgS('m-1', 'Bonjour, toujours dispo ? 😊', ACH1, '2026-11-03T07:58:00.123456Z'), msgS('m-2', 'Oui !', MOI, '2026-11-03T07:59:00Z'), msgS('m-3', 'Super, je prends.', ACH1, '2026-11-03T08:00:00Z'), msgS('m-4', 'effacé', ACH1, '2026-11-03T08:01:00Z', { type: 'deleted', deleted_at: '2026-11-03T08:02:00Z' })], 2),
  etatS(CONV2, ART2, [msgS('m-9', 'Je poste demain', MOI, '2026-11-02T18:00:00Z')], 0),
], duration: '12.3ms' };

// ── Le VRAI vc-inject.js dans une page vestiairecollective.com (/chat/) ─────
function pageVc() {
  const INJ = fs.readFileSync(F.inject, 'utf8');
  const posts = [], ecoutes = [], appels = [];
  const routes = {};   // 'METHODE url' → { status, body }
  const rep = (m, u) => routes[m + ' ' + u] || routes['* ' + u] || { status: 404, body: { message: 'introuvable' } };
  const win = {
    postMessage: (m) => { if (m && m.__tag === 'CANCALE_VC_ORDRE') { for (const f of ecoutes.slice()) f({ source: win, data: copie(m) }); return; } posts.push(copie(m)); },
    fetch: async (u, init) => {
      const m = String((init && init.method) || 'GET').toUpperCase();
      appels.push({ u: String(u), m });
      const r = rep(m, String(u));
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => 'application/json; charset=utf-8' }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => new ArrayBuffer(0) };
    },
    addEventListener: (t, f) => { if (t === 'message') ecoutes.push(f); },
  };
  win.top = win; win.self = win;
  // Un XMLHttpRequest minimal (axios, que Stream utilise dans le navigateur).
  class FauxXhr {
    open(m, u) { this.m = String(m).toUpperCase(); this.u = u; this.ecoutes = []; this.responseType = ''; }
    setRequestHeader() {}
    addEventListener(t, f) { if (t === 'load') this.ecoutes.push(f); }
    getResponseHeader() { return 'application/json; charset=utf-8'; }
    send() {
      appels.push({ u: String(this.u), m: this.m });
      const r = rep(this.m, String(this.u));
      this.status = r.status;
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      setTimeout(() => { this.responseText = texte; this.response = texte; for (const f of this.ecoutes) f.call(this); }, 0);
    }
  }
  win.XMLHttpRequest = FauxXhr;
  const ctx = { window: win, XMLHttpRequest: FauxXhr, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, readyState: 'complete' },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/chat/', href: ORIGINE + '/chat/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
  const appel = async (m, url, corps, status = 200, viaXhr = false, envoye) => {
    routes[m + ' ' + url] = { status, body: corps };
    const n = posts.length;
    if (viaXhr) { const x = new win.XMLHttpRequest(); x.open(m, url); x.send(envoye || null); }
    else await win.fetch(url, { method: m, body: envoye, headers: { 'content-type': 'application/json' } });
    await attendre(25);
    return posts.slice(n);
  };
  return { appel, posts };
}
// Le VRAI relais vc.js : ce qu'il transmet au fond.
function relais() {
  const RELAIS = fs.readFileSync(F.relais, 'utf8');
  const envois = []; let ecoute = null;
  const win = { addEventListener: (t, f) => { if (t === 'message') ecoute = f; }, postMessage() {} };
  win.top = win;
  const ctx = { window: win, self: {}, chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { envois.push(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener() {} } } }, location: { href: ORIGINE + '/chat/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set };
  vm.createContext(ctx); vm.runInContext(RELAIS, ctx, { filename: 'vc.js' });
  return (d) => { const n = envois.length; if (ecoute) ecoute({ source: win, data: d }); return envois.slice(n); };
}
const senderVc = (tab) => ({ tab: { id: tab, url: ORIGINE + '/chat/' }, frameId: 0, url: ORIGINE + '/chat/' });
const de = (posts, k) => posts.filter((x) => x.kind === k);

let capt = {};
async function m1a7() {
  const p = pageVc();
  // M2 d'abord : le fil des notifications arrive AVANT que la messagerie ne parle (compte pas encore su).
  const flux = await p.appel('GET', `${API}/notification-feed${Q.replace('?', '?offset=0&limit=60&category=messages&')}`, FLUX);
  const fm = de(flux, 'vcmessages')[0];
  const c1 = fm && fm.conversations.find((c) => c.id === CONV1), c2 = fm && fm.conversations.find((c) => c.id === CONV2);
  dit(!!fm && fm.conversations.length === 2 && !fm.conversations.some((c) => c.id === '424242'), 'M2 · le fil des notifications « messages » ⇒ une conversation par carte de messagerie (une carte « produit » écartée)', JSON.stringify(fm && fm.conversations.map((c) => c.id)));
  dit(!!c1 && c1.productId === ART1 && c1.apercu === 'Bonjour, toujours dispo ? 😊' && c1.date === '2026-11-03T08:00:00.000Z', 'M2 · son article (`{acheteur}-{article}`), le DERNIER message et sa date (la carte plus ancienne ne gagne pas)', JSON.stringify(c1));
  dit(!!c1 && c1.titre === 'Nike Baskets Dunk Low' && c1.photo === `https://images.vestiairecollective.com/produit/${ART1}-1_1.jpg`, 'M2 · le titre et la photo de l’ARTICLE', JSON.stringify(c1 && [c1.titre, c1.photo]));
  dit(!!c1 && c1.apercuDeMoi === null && c1.nonLu === false && !!c2 && c2.nonLu === false, 'M2 · compte pas encore su ⇒ « de toi » pas su ; « lu » seulement quand la carte le dit (`status: read`)', JSON.stringify([c1 && [c1.apercuDeMoi, c1.nonLu], c2 && c2.nonLu]));
  dit(fuite(de(flux, 'vcmessages')).length === 0, 'M2 · ni le nom, ni la photo de la personne ne sortent du fil des notifications', fuite(flux).join(','));
  capt.flux = fm;

  // M7 : ouvrir une conversation (Vestiaire), ce n'est pas un envoi.
  const canal = await p.appel('POST', `${API}/chat/channel/${Q}`, { data: { id: CONV1, name: CONV1, type: 'chat_channel', buyer: { id: ACH1, type: 'chat_user', username: 'jeanne33334444', picture: { alt: 'Jeanne' } }, seller: { id: MOI, type: 'chat_user', username: 'julien' }, product: ART1, activity: true }, meta: { count: 0, limit: 60, offset: 0 } }, 200, false, JSON.stringify({ productId: ART1, buyerId: ACH1 }));
  dit(!de(canal, 'vcenvoiappris').length, 'M7 · ouvrir une conversation (`POST /chat/channel/`) n’est PAS noté comme un essai d’envoi', JSON.stringify(canal.map((x) => x.kind)));
  const cm = de(canal, 'vcmessages')[0];
  dit(!!cm && cm.conversations[0].id === CONV1 && cm.conversations[0].productId === ART1 && fuite(cm).length === 0, 'M7 · … mais la conversation et son article sont notés, sans l’acheteur', JSON.stringify(cm));

  // M1 + M3 : la liste Stream (XHR, comme axios), `user_id` dans l'adresse.
  const liste = await p.appel('POST', `${STREAM}/channels${qs}`, LISTE, 201, true, JSON.stringify({ filter_conditions: { members: { $in: [MOI] } }, sort: [], state: true, watch: true, message_limit: 25 }));
  const moi = de(liste, 'vcmoi');
  dit(moi.length === 1 && moi[0].id === MOI && moi[0].source === 'stream', 'M1 · le compte ouvert : le `user_id` que la page donne à sa messagerie (source « stream »)', JSON.stringify(moi));
  const lm = de(liste, 'vcmessages')[0];
  const s1 = lm && lm.conversations.find((c) => c.id === CONV1), s2 = lm && lm.conversations.find((c) => c.id === CONV2);
  dit(!!lm && lm.conversations.length === 2 && lm.total == null && !lm.inconnu, 'M3 · la liste Stream ⇒ les conversations (jamais « la liste entière »)', JSON.stringify(lm && { n: lm.conversations.length, total: lm.total, inconnu: lm.inconnu }));
  dit(!!s1 && s1.nonLu === true && !!s2 && s2.nonLu === false, 'M3 · « non lu » = la ligne `read` du COMPTE OUVERT (2 non lus ⇒ oui, 0 ⇒ non)', JSON.stringify([s1 && s1.nonLu, s2 && s2.nonLu]));
  dit(!!s1 && s1.productId === ART1 && s1.apercu === 'Super, je prends.' && s1.apercuDeMoi === false && !!s2 && s2.apercuDeMoi === true, 'M3 · l’article, l’aperçu du dernier message lisible et « de toi »', JSON.stringify([s1, s2]));
  const fils = de(liste, 'vcfil');
  const f1 = fils.find((f) => f.conv === CONV1);
  dit(fils.length === 2 && !!f1 && f1.messages.length === 3 && f1.messages.map((m) => m.deMoi).join() === 'false,true,false', 'M3 · un FIL par conversation : trois messages (le supprimé ne passe pas), « de toi » par l’auteur', JSON.stringify(f1 && f1.messages));
  dit(!!f1 && f1.messages[0].t === 'Bonjour, toujours dispo ? 😊' && f1.messages[0].at === '2026-11-03T07:58:00.123Z' && f1.messages[0].id === 'm-1', 'M3 · le texte (émoji entier), la date et l’identifiant de chaque message', JSON.stringify(f1 && f1.messages[0]));
  dit(fuite(liste.filter((x) => x.kind !== 'vcbrut')).length === 0 && !liste.some((x) => x.kind === 'vcbrut'), 'M3 · aucun nom, aucun avatar ne sort de la messagerie (ni dans la forme), et ses réponses brutes ne sont pas gardées', fuite(liste).join(','));
  capt.liste = liste;

  // M2 bis : une fois le compte su, le fil des notifications dit « de toi ».
  const flux2 = await p.appel('GET', `${API}/notification-feed/v2${Q.replace('?', '?offset=0&limit=60&category=messages&')}`, FLUX);
  const c2b = de(flux2, 'vcmessages')[0] && de(flux2, 'vcmessages')[0].conversations.find((c) => c.id === CONV2);
  dit(!!c2b && c2b.apercuDeMoi === true && c2b.nonLu === false, 'M2 · compte su ⇒ la carte envoyée par TOI est « de toi » et lue', JSON.stringify(c2b));

  // M4 : une conversation ouverte (`…/query`).
  const une = await p.appel('POST', `${STREAM}/channels/messaging/${CONV1}/query${qs}`, etatS(CONV1, ART1, [msgS('m-5', 'Vous pouvez l’envoyer lundi ?', ACH1, '2026-11-03T09:00:00Z')], 1), 201, true, '{}');
  const fu = de(une, 'vcfil')[0];
  dit(!!fu && fu.conv === CONV1 && fu.messages.length === 1 && fu.messages[0].deMoi === false && fu.productId === ART1, 'M4 · une conversation ouverte ⇒ son fil', JSON.stringify(fu));

  // M5 : formes inconnues, liste vide, erreur.
  const inc = await p.appel('POST', `${STREAM}/channels${qs}&x=1`, { results: [{ conv: 'abc' }] }, 201, true);
  const im = de(inc, 'vcmessages')[0];
  dit(!!im && Array.isArray(im.inconnu) && im.inconnu.length > 0 && im.conversations.length === 0, 'M5 · une réponse de forme INCONNUE part comme « forme inconnue », pas comme une liste vide', JSON.stringify(im));
  const vide = await p.appel('POST', `${STREAM}/channels${qs}&x=2`, { channels: [], duration: '1ms' }, 201, true);
  const vm2 = de(vide, 'vcmessages')[0];
  dit(!!vm2 && !vm2.inconnu && vm2.conversations.length === 0, 'M5 · `{channels: []}` est une liste vide (forme connue)', JSON.stringify(vm2));
  const err = await p.appel('POST', `${STREAM}/channels${qs}&x=3`, { code: 17, message: 'token expired', StatusCode: 401 }, 401, true);
  dit(!de(err, 'vcmessages').length && !de(err, 'vcfil').length, 'M5 · une erreur 401 de la messagerie ne donne rien', JSON.stringify(err.map((x) => x.kind)));

  // M6 : ton envoi par Stream.
  const env = await p.appel('POST', `${STREAM}/channels/messaging/${CONV1}/message${qs}`, { message: msgS('m-6', 'Oui, lundi sans faute', MOI, '2026-11-03T09:05:00Z'), duration: '3ms' }, 201, true, JSON.stringify({ message: { id: `${MOI}-a1b2c3d4-0000`, text: 'Oui, lundi sans faute', mentioned_users: [] } }));
  const rec = de(env, 'vcenvoiappris')[0];
  dit(!!rec && rec.recette.rejouable === false && rec.recette.raison === 'messagerie-stream' && rec.recette.hote === 'chat.stream-chat.com', 'M6 · ton envoi par la messagerie ⇒ noté « pas rejouable » (messagerie-stream)', JSON.stringify(rec));
  dit(!!rec && !JSON.stringify(rec).includes('lundi') && !JSON.stringify(rec).includes('cle-banc'), 'M6 · ni ton texte ni la clé de la messagerie ne sortent dans la recette', JSON.stringify(rec));
  const fe = de(env, 'vcfil')[0];
  dit(!!fe && fe.messages.length === 1 && fe.messages[0].deMoi === true && fe.messages[0].t === 'Oui, lundi sans faute', 'M6 · le message envoyé rejoint le fil, « de toi »', JSON.stringify(fe));
  capt.envoi = rec;

  // M1 bis : un `/users/me` lu dans ce document fait foi sur la messagerie.
  const p2 = pageVc();
  await p2.appel('GET', `${API}/users/me${Q}`, { data: { id: '44445555', type: 'user', firstName: 'Julien' }, meta: {} });
  const m2 = await p2.appel('POST', `${STREAM}/channels${qs}`, LISTE, 201, true);
  dit(!de(m2, 'vcmoi').length && de(m2, 'vcmessages')[0] && de(m2, 'vcmessages')[0].moi === '44445555', 'M1 · un `/users/me` lu dans ce document n’est jamais remplacé par la messagerie', JSON.stringify(m2.map((x) => [x.kind, x.moi, x.id])));
  const p3 = pageVc();
  const m3 = await p3.appel('POST', `${STREAM}/channels?user_id=jeanne&api_key=x`, LISTE, 201, true);
  dit(!de(m3, 'vcmoi').length && (de(m3, 'vcmessages')[0] || {}).moi === '' && (de(m3, 'vcmessages')[0] || { conversations: [{}] }).conversations.every((c) => c.nonLu === null), 'M1 · un `user_id` qui n’a pas la forme d’un identifiant Vestiaire ne pose aucun compte (non-lu ⇒ pas su)', JSON.stringify(m3.map((x) => [x.kind, x.moi])));
}

async function m8() {
  const r = relais();
  const pass = (posts) => posts.flatMap((d) => r(d));
  const liste = pass(capt.liste || []), flux = pass(capt.flux ? [Object.assign({ __tag: 'CANCALE_VC', kind: 'vcmessages' }, capt.flux)] : []);
  const f = faireFond({ src: F.src, onglets: [{ id: 41, url: ORIGINE + '/chat/', active: true, status: 'complete' }] });
  for (const m of flux) await f.envoyer(m, senderVc(41));
  for (const m of liste) await f.envoyer(m, senderVc(41));
  const vm1 = f.lignes.vc_messages || {}, conv = vm1.conversations || {};
  dit(!!conv[CONV1] && !!conv[CONV2] && conv[CONV1].nonLu === true && conv[CONV1].productId === ART1, 'M8 · le fond range les conversations (article, non-lu)', JSON.stringify(conv[CONV1]));
  dit(!!conv[CONV1] && conv[CONV1].titre === 'Nike Baskets Dunk Low' && /produit\/66668888-1_1\.jpg$/.test(conv[CONV1].photo || ''), 'M8 · … avec le titre et la photo de l’article (relayés par vc.js)', JSON.stringify(conv[CONV1] && [conv[CONV1].titre, conv[CONV1].photo]));
  const fil = f.lignes[`vc_fil_${CONV1}`];
  dit(!!fil && fil.n === 3 && fil.apercu === 'Super, je prends.' && fil.dernierDeMoi === false && fil.productId === ART1, 'M8 · `vc_fil_{conv}` rangé : messages, aperçu, « de toi » du dernier, article', JSON.stringify(fil && { n: fil.n, a: fil.apercu, d: fil.dernierDeMoi }));
  dit(f.lignes.vc_session && f.lignes.vc_session.id === MOI && f.lignes.vc_session.source === 'stream' && (f.store.vrmVcOnglets || {})['41'] && f.store.vrmVcOnglets['41'].compte === MOI, 'M8 · `vc_session` = le compte de la messagerie (source « stream »), tenu par onglet', JSON.stringify({ s: f.lignes.vc_session, o: f.store.vrmVcOnglets }));
  dit(!!fil && fil.compte === MOI && conv[CONV1].compte === MOI, 'M8 · page et onglet d’accord ⇒ le compte posé sur la conversation et le fil', JSON.stringify([fil && fil.compte, conv[CONV1] && conv[CONV1].compte]));
  dit(fuite(f.lignes).length === 0, 'M8 · aucun nom ni avatar dans ce que le fond écrit', fuite(f.lignes).join(','));
  // L'onglet dit un compte, la page en dit un autre ⇒ aucun compte posé.
  const g = faireFond({ src: F.src, onglets: [{ id: 42, url: ORIGINE + '/chat/', active: true, status: 'complete' }] });
  await g.ctx.noterSessionVc('77778888', 42, []);
  for (const m of liste.filter((x) => x.action !== 'vcMoi')) await g.envoyer(m, senderVc(42));
  const gc = (g.lignes.vc_messages || {}).conversations || {};
  dit(!!gc[CONV1] && gc[CONV1].compte === '' && g.lignes[`vc_fil_${CONV1}`] && g.lignes[`vc_fil_${CONV1}`].compte === '', 'M8 · compte de l’onglet ≠ compte de la page ⇒ AUCUN compte posé (jamais un faux)', JSON.stringify([gc[CONV1] && gc[CONV1].compte, g.lignes[`vc_fil_${CONV1}`] && g.lignes[`vc_fil_${CONV1}`].compte]));
  // Lecture ratée ⇒ rien écrit.
  const avant = { conversations: { X1: { productId: '1', nonLu: true, apercu: 'garde' } }, capturedAt: '2026-11-01T00:00:00Z' };
  const k = faireFond({ src: F.src, lignes: { vc_messages: copie(avant) }, lectureKO: (u) => /vc_messages/.test(u) });
  for (const m of liste.filter((x) => x.action === 'vcMessages')) await k.envoyer(m, senderVc(43));
  dit(JSON.stringify(k.lignes.vc_messages) === JSON.stringify(avant), 'M8 · une lecture ratée de `vc_messages` n’écrit RIEN', JSON.stringify(k.lignes.vc_messages));
  // La recette : un essai Stream noté, jamais rejouable, jamais à la place d'une rejouable.
  const e = pass(capt.envoi ? [capt.envoi] : []);
  const h = faireFond({ src: F.src, onglets: [{ id: 44, url: ORIGINE + '/chat/', active: true, status: 'complete' }] });
  for (const m of e) await h.envoyer(m, senderVc(44));
  dit(h.lignes.vc_envoi && h.lignes.vc_envoi.appris === false && h.lignes.vc_envoi.raison === 'messagerie-stream', 'M8 · `vc_envoi` dit « pas appris — messagerie-stream » (l’app sait l’expliquer)', JSON.stringify(h.lignes.vc_envoi));
  const r0 = await h.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'vcRepondre', conv: CONV1, texte: 'Bonjour' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
  dit(r0 && r0.accepte === false && /^pas-(appris|rejouable)$/.test(r0.code), '« Envoyer sur Vestiaire » reste REFUSÉ sans recette rejouable (rien ne part)', JSON.stringify(r0));
  const rej = { methode: 'POST', hote: 'apiv2.vestiairecollective.com', chemin: '/conversations/{id}/messages', rejouable: true, raison: '', modele: '/conversations/{conv}/messages', recherche: '', cleTexte: ['content'], fixes: [], entetes: [] };
  await h.envoyer({ from: 'cancale-vc', action: 'vcEnvoiAppris', recette: rej }, senderVc(44));
  for (const m of e) await h.envoyer(m, senderVc(44));
  dit(h.store.vrmVcRecette && h.store.vrmVcRecette.recette.rejouable === true && h.store.vrmVcRecette.dernierEssai.raison === 'messagerie-stream', 'M8 · un essai Stream ne remplace jamais une recette rejouable (noté à côté)', JSON.stringify(h.store.vrmVcRecette && h.store.vrmVcRecette.dernierEssai));
}

function m9() {
  const APP = fs.readFileSync(F.app, 'utf8');
  const debut = APP.indexOf('function MessagesVestiaire()'), fin = APP.indexOf('function AchatsVestiaire()');
  const bloc = debut > 0 && fin > debut ? APP.slice(debut, fin) : '';
  dit(/titreArticle:\s*String\(v\.titre/.test(bloc) && /(?:titre|nom)=\{\(fv && fv\.titre\) \|\| v\.titreArticle/.test(bloc), 'M9 · l’écran Messages → Vestiaire affiche le titre de l’article lu quand la conversation n’est reliée à aucune fiche');
  dit(/photoArticle:\s*urlPhotoVc\(/.test(bloc) && /photo=\{\(fv && fv\.photo\) \|\| v\.photoArticle\}/.test(bloc), 'M9 · … et sa photo (adresse vestiairecollective.com vérifiée)');
  const fil = APP.slice(APP.indexOf('function FilVestiaire('), debut);
  dit(/envoi && envoi\.raison === 'messagerie-stream'/.test(fil) && /data-vc-envoi-stream/.test(fil), 'M9 · le pied du fil dit pourquoi VRM n’envoie pas (messagerie à part) au lieu d’un code');
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  const man = JSON.parse(fs.readFileSync(path.join(path.dirname(F.inject), 'manifest.json'), 'utf8'));
  // (4 nov., 5.319) La version d'ARRIVÉE (5.317.0), jamais la dernière publiée (§8) : comparer au manifeste rougissait à chaque montée de version.
  void man;
  dit(!!cap && /vcfil:\s*'5\.317\.0'/.test(cap[1]), '`M9 · EXT_CAPACITES.vcfil` = 5.317.0 (la version qui lit vraiment les fils)', cap && (/vcfil:\s*'[^']*'/.exec(cap[1]) || [''])[0]);
}

(async () => {
  for (const [nom, f] of [['M1-M7', m1a7], ['M8', m8], ['M9', m9]]) {
    try { await f(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 300)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ messages Vestiaire (Stream) : tout est vert');
  process.exit(ko ? 1 : 0);
})();
