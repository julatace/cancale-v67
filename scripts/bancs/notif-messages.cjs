// ═══════════════════════════════════════════════════════════════════════════
// BANC : « LES NOTIFICATIONS DES MESSAGES VINTED NE SONT PAS TOUJOURS ENVOYÉES »
//        node scripts/bancs/notif-messages.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Plainte de Julien, 11 octobre. Mesuré (plaintes-11oct/notifications.md et
// ses deux relectures) : le serveur n'a perdu AUCUNE notification les 9 et
// 10 octobre ; les manques viennent de comptes dont les emails n'arrivent
// jamais à VRM et de Vinted. Mais quatre faiblesses de la route ont été
// REPRODUITES, et la notification ne nommait jamais la paire :
//
//   A. la notification d'un message ne dit pas DE QUELLE PAIRE il s'agit, alors
//      que le sujet de l'email la donne (« Nouveau message à propos de … ») ;
//   C. préférences ILLISIBLES ⇒ « pas su » retombait sur le DÉFAUT, et le défaut
//      de « message » est NON : un message activé par Julien se taisait ;
//   D. mémo anti-doublon ILLISIBLE ⇒ réécrit à partir de RIEN ⇒ au renvoi
//      suivant du fil (le script Gmail renvoie tout le fil), tous les anciens
//      messages re-sonnaient ;
//   E. clé anti-doublon = sujet + 200 premiers caractères ⇒ un second message
//      au début identique était AVALÉ ;
//   F. deux appareils qui s'abonnent en même temps ⇒ lire-ajouter-réécrire
//      sans verrou : l'un des deux disparaissait de `push_subs` (et l'app lui
//      avait répondu « activé ») ; G. pareil pour la purge d'un appareil mort
//      pendant qu'un autre s'abonne.
//
// §4.10 : on EXÉCUTE la VRAIE route (api/email-inbound.js, api/push.js,
// api/_lib/push.js) contre une fausse base À ÉTAT — ce qui est écrit est relu,
// les écritures conditionnelles (PATCH filtré, insertion sans écrasement) sont
// appliquées comme PostgREST les applique — et un faux Web Push qui note ce qui
// partirait. Données inventées : aucun acheteur, aucun email réel.
// ⚠️ Le CORPS d'un email de message n'est conservé nulle part en base : il est
//    reconstitué ici avec la seule contrainte mesurée (l'analyse n'en tire ni
//    l'acheteur ni le texte, 59 emails sur 59). Le SUJET et l'expéditeur, eux,
//    ont la forme mesurée.
// §6.1 : copié dans un arbre d'avant et lancé DEPUIS cet arbre, il doit être
// rouge (RACINE se déduit de __dirname, jamais un chemin absolu).
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const OWNER = '11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
delete process.env.EMAIL_INBOUND_SECRET;

const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
const morts = new Set();                       // endpoints qu'Apple/Google disent disparus (410)
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => {
  await dort(5);
  if (morts.has(sub.endpoint)) { const e = new Error('Gone'); e.statusCode = 410; throw e; }
  pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) });
  return { statusCode: 201 };
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { ko++; console.log(`❌ ${m} — a levé : ${String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')}`); } };
const dort = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fausse base à état (PostgREST simplifié, mais FIDÈLE sur ce qui compte) ─
const HTML522 = '<!DOCTYPE html><title>522</title>';
const base = new Map();                          // `${owner}|${id}` → data
let pannes = new Set();                          // ids dont la LECTURE répond 522 (l'écriture passe : le cas qui détruit)
let latence = {};                                // id → ms de retard en lecture ; `ecriture` → ms en écriture
let ecritures = [];
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const champ = (data, chemin) => {                // `data->>rev` → data.rev en texte (PostgREST)
  const k = chemin.replace(/^data->>/, '');
  const v = data && data[k];
  return v == null ? null : String(v);
};
const filtrer = (u) => {                         // les lignes qui passent TOUS les filtres de l'URL
  const f = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order'].includes(k)) continue;
    f.push([decodeURIComponent(k), v]);
  }
  return [...base.entries()].filter(([cle, data]) => {
    const [own, id] = cle.split('|');
    return f.every(([k, v]) => {
      const valeur = k === 'id' ? id : k === 'owner' ? own : k.startsWith('data->>') ? champ(data, k) : undefined;
      if (v === 'is.null') return valeur == null;
      if (v.startsWith('eq.')) return valeur === decodeURIComponent(v.slice(3));
      return true;
    });
  });
};
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
  if (u.pathname === '/auth/v1/user') return rep({ id: OWNER, email: 'vendeur@banc.test' });
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([{ vinted_user_id: '900', login: 'compte_banc' }]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const rows = JSON.parse(opts.body || '[]');
    if (latence.ecriture) await dort(latence.ecriture);
    const sansEcraser = /ignore-duplicates/.test(prefer);
    const rendus = [];
    for (const r of rows) {                       // appliqué d'un bloc, après l'attente : atomique comme en vrai
      const cle = `${r.owner || OWNER}|${r.id}`;
      if (sansEcraser && base.has(cle)) continue;
      base.set(cle, r.data); ecritures.push(r.id); rendus.push(r);
    }
    return /return=representation/.test(prefer) ? rep(rendus, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    if (latence.ecriture) await dort(latence.ecriture);
    const corps = JSON.parse(opts.body || '{}');
    const touchees = filtrer(u);                  // le filtre est réévalué AU MOMENT d'écrire (comme Postgres)
    for (const [cle] of touchees) { base.set(cle, corps.data); ecritures.push(cle.split('|')[1]); }
    const rendus = touchees.map(([cle]) => ({ id: cle.split('|')[1], data: base.get(cle) }));
    return /return=representation/.test(prefer) ? rep(rendus) : new Response('', { status: 204 });
  }
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée, comme en production
  const id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, ''));
  if (latence[id]) await dort(latence[id]);
  if (pannes.has(id)) return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
  if (id === 'vrm_email_owners') return rep([]);                                 // registre vide (mesuré)
  const lignes = filtrer(u);
  if (sel.startsWith('data->')) { const k = sel.slice(6); return rep(lignes.map(([, d]) => ({ [k]: d && d[k] }))); }
  return rep(lignes.map(([cle, d]) => ({ owner: cle.split('|')[0], id: cle.split('|')[1], data: d })));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const lire = (id) => base.get(`${OWNER}|${id}`);

// ── La forme RÉELLE de l'email (sujet et expéditeur mesurés) ────────────────
const ARTICLE = 'salomon XT-6 gris taille 40';
const emailMessage = (n, entete = '', article = ARTICLE) => ({
  from: "\"L'équipe Vinted\" <no-reply@vinted.fr>",
  to: 'boite-de-reception@banc.test',
  subject: `Nouveau message à propos de ${article}`,
  text: `${entete}Bonjour compte_banc,\nTu as reçu un nouveau message.\nRépondre\nhttps://www.vinted.fr/inbox/${1000 + n}\nVinted, UAB`,
  html: '', attachments: [],
});
const emailFavori = { from: 'no-reply@vinted.fr', to: 'boite-de-reception@banc.test', subject: 'Ton article a été ajouté aux favoris', text: 'quelquun a ajouté ton article « Paire banc » dans ses favoris', html: '', attachments: [] };
const deuxAppareils = () => ({ subs: [{ endpoint: 'https://web.push.apple.com/iphone' }, { endpoint: 'https://fcm.googleapis.com/chrome' }] });

(async () => {
  const inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
  const pushRoute = await import('file://' + path.join(RACINE, 'api', 'push.js'));
  const libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js'));
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  // Les mémoires d'instance (préférences vues, clés envoyées pendant un hoquet)
  // se vident entre deux scénarios : chacun part d'une instance « froide ».
  const froid = () => {
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
  };
  const reset = (prefs) => {
    base.clear(); pannes = new Set(); latence = {}; ecritures = []; pushes.length = 0; morts.clear(); froid();
    base.set(`${OWNER}|push_subs`, deuxAppareils());
    if (prefs) base.set(`${OWNER}|push_prefs`, prefs);
  };
  const sonnes = () => pushes.length / 2;        // 2 appareils : une notification = 2 envois

  // ══ A. La notification NOMME la paire et le compte ═════════════════════════
  console.log('\n── A. Un message : la notification dit de quelle paire il s’agit, et sur quel compte');
  await essaie('A', async () => {
    reset({ achat: true, suivi: true, favori: true, facture: true, message: true });   // ses préférences mesurées
    const res = await recoit(emailMessage(1));
    dit(res.code === 200 && res.corps && res.corps.type === 'message', 'l’email est reconnu comme un message', `HTTP ${res.code} type=${res.corps && res.corps.type}`);
    dit(pushes.length === 2, 'une notification part vers chacun des 2 appareils', `${pushes.length} envoi(s)`);
    const p = pushes[0] || {};
    console.log(`     ce que lit le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(String(p.title || '').includes(ARTICLE), 'le TITRE nomme la paire lue dans le sujet de l’email', JSON.stringify(p.title));
    dit(/nouveau message sur compte_banc/i.test(String(p.body || '')), 'le texte dit « nouveau message sur {compte} »', JSON.stringify(p.body));
    // L'AUTRE SENS : la paire SUIT le sujet (pas un titre figé).
    pushes.length = 0;
    await recoit(emailMessage(2, '', 'nike shox TL rose taille 35,5'));
    const p2 = pushes[0] || {};
    dit(String(p2.title || '').includes('nike shox TL rose taille 35,5') && !String(p2.title || '').includes(ARTICLE),
      'une autre paire, un autre titre : la notification suit le sujet', JSON.stringify(p2.title));
    // Un sujet sans paire : pas de titre inventé.
    pushes.length = 0;
    const sansPaire = Object.assign(emailMessage(3), { subject: 'Tu as reçu un nouveau message' });
    await recoit(sansPaire);
    const p3 = pushes[0] || {};
    dit(pushes.length === 2 && /message vinted/i.test(String(p3.title || '')), 'sujet sans paire : « Message Vinted », jamais une paire inventée', JSON.stringify(p3.title));
  });

  // ══ B. Le fil renvoyé en entier : seul le message nouveau sonne ═══════════
  console.log('\n── B. Le script Gmail renvoie tout le fil : seul le NOUVEAU message sonne');
  await essaie('B', async () => {
    reset({ message: true });
    for (let n = 1; n <= 3; n++) await recoit(emailMessage(n, `Message ${n}\n`));
    const avant = sonnes();
    for (let n = 1; n <= 4; n++) await recoit(emailMessage(n, `Message ${n}\n`));
    dit(avant === 3 && sonnes() - avant === 1, 'fil de 4 renvoyé : 1 seule notification (le 4ᵉ)', `${avant} puis +${sonnes() - avant}`);
  });

  // ══ C. Préférences illisibles ══════════════════════════════════════════════
  console.log('\n── C. Préférences illisibles (522, la base debout par ailleurs)');
  await essaie('C', async () => {
    reset({ message: true });
    pannes.add('push_prefs');
    await recoit(emailMessage(1));
    dit(sonnes() === 1, 'préférences illisibles : le message activé sonne quand même (« pas su » ne coupe pas)',
      `${sonnes()} notification(s) — le défaut de « message » est non`);
    // L'AUTRE SENS 1 : une préférence LUE à « non » est respectée.
    reset({ message: false });
    await recoit(emailMessage(1));
    dit(sonnes() === 0, 'préférence lue à « non » : le message ne sonne pas', `${sonnes()} notification(s)`);
    // L'AUTRE SENS 2 : préférence lue à « non » une fois, puis un hoquet : la
    // dernière préférence connue décide, on ne sonne pas « parce qu'on ne sait pas ».
    pannes.add('push_prefs');
    await recoit(emailMessage(2, 'Message 2\n'));
    dit(sonnes() === 0, 'préférence « non » lue avant le hoquet : elle tient pendant le hoquet', `${sonnes()} notification(s)`);
    // Une catégorie sans action (favori : défaut non), préférences illisibles,
    // jamais lues : on ne réveille pas pour ce qui n'appelle aucun geste.
    reset({ favori: true });
    pannes.add('push_prefs');
    await recoit(emailFavori);
    dit(sonnes() === 0, 'favori, préférences jamais lues et illisibles : reste au défaut (rien à faire, pas de réveil)', `${sonnes()} notification(s)`);
  });

  // ══ D. Mémo anti-doublon illisible ═════════════════════════════════════════
  console.log('\n── D. Mémo anti-doublon illisible pendant qu’un message arrive');
  await essaie('D', async () => {
    reset({ message: true });
    for (let n = 1; n <= 5; n++) await recoit(emailMessage(n, `Message ${n}\n`));
    const cles = ((lire('push_dedup') || {}).keys || []).length;
    pannes.add('push_dedup');
    const r6 = await recoit(emailMessage(6, 'Message 6\n'));          // un nouveau message pendant le hoquet
    const pendant = sonnes() - 5;
    pannes.delete('push_dedup');
    const apres = ((lire('push_dedup') || {}).keys || []).length;
    dit(apres >= cles && cles === 5, 'une lecture ratée du mémo ne l’EFFACE pas', `${cles} clés avant → ${apres} après`);
    dit(pendant === 1, 'le message arrivé pendant le hoquet sonne quand même (un message manqué ne se rattrape pas)', `${pendant} notification(s), HTTP ${r6.code}`);
    const avant = sonnes();
    for (let n = 1; n <= 7; n++) await recoit(emailMessage(n, `Message ${n}\n`));   // le fil renvoyé + le 7ᵉ
    dit(sonnes() - avant === 1, 'au renvoi suivant du fil, seul le message NOUVEAU sonne (ni les 5 anciens, ni celui du hoquet)', `${sonnes() - avant} notification(s)`);
  });

  // ══ E. Deux messages au début identique ════════════════════════════════════
  console.log('\n── E. Deux messages DIFFÉRENTS, même sujet, mêmes 200 premiers caractères');
  await essaie('E', async () => {
    reset({ message: true });
    const long = 'Bonjour compte_banc,\n' + 'Tu as reçu un nouveau message sur Vinted à propos de ton article. '.repeat(4) + '\n';
    const m1 = emailMessage(1, long); m1.text += '\nTexte : premier message';
    const m2 = emailMessage(1, long); m2.text += '\nTexte : second message, différent';
    await recoit(m1); await recoit(m2);
    dit(sonnes() === 2, 'les deux sonnent', `${sonnes()} notification(s) sur 2 messages`);
    await recoit(m1); await recoit(m2);
    dit(sonnes() === 2, 'et le renvoi de l’un ou de l’autre ne re-sonne pas', `${sonnes()} notification(s) après renvoi`);
  });
  await essaie('E-transition', async () => {
    // ⚠️ LE JOUR DU DÉPLOIEMENT : le mémo porte des clés à l'ANCIEN format.
    //    Un fil renvoyé ne doit pas faire re-sonner d'un coup tous ses anciens
    //    messages (le « ~300 notifications » du 3 octobre, refait autrement).
    reset({ message: true });
    let h = 0; const m = emailMessage(1, 'Message 1\n');
    const ancien = String(m.subject) + String(m.text).slice(0, 200);
    for (let i = 0; i < ancien.length; i++) h = ((h << 5) - h + ancien.charCodeAt(i)) | 0;
    base.set(`${OWNER}|push_dedup`, { keys: [`msg-${Math.abs(h).toString(36)}`] });
    await recoit(m);
    dit(sonnes() === 0, 'une clé à l’ancien format (avant le déploiement) est encore reconnue : pas de rafale au déploiement', `${sonnes()} notification(s)`);
  });

  // ══ F. Deux appareils s'abonnent en même temps ═════════════════════════════
  console.log('\n── F. Deux appareils s’abonnent en même temps (iPhone + Chrome)');
  const abo = (e, action = 'subscribe') => ({ method: 'POST', query: {}, headers: { authorization: 'Bearer a.b.c' },
    body: action === 'subscribe' ? { action, sub: { endpoint: e, keys: { p256dh: 'x', auth: 'y' } } } : { action, endpoint: e } });
  await essaie('F', async () => {
    reset({ message: true });
    base.set(`${OWNER}|push_subs`, { subs: [] });
    latence.push_subs = 30; latence.ecriture = 40;                // ordres de grandeur mesurés
    const r1 = faireRes(), r2 = faireRes();
    await Promise.all([pushRoute.default(abo('https://web.push.apple.com/iphone'), r1), pushRoute.default(abo('https://fcm.googleapis.com/chrome'), r2)]);
    const fin = ((lire('push_subs') || {}).subs || []).map((s) => s.endpoint.split('/').pop());
    dit(r1.code === 200 && r2.code === 200 && fin.length === 2, 'les deux répondent « activé » ET les deux restent inscrits',
      `réponses ${r1.code}/${r2.code} · liste finale [${fin.join(', ')}]`);
    // Première inscription (aucune ligne encore) : même course.
    base.delete(`${OWNER}|push_subs`);
    const r3 = faireRes(), r4 = faireRes();
    await Promise.all([pushRoute.default(abo('https://web.push.apple.com/ipad'), r3), pushRoute.default(abo('https://fcm.googleapis.com/mac'), r4)]);
    const fin2 = ((lire('push_subs') || {}).subs || []).map((s) => s.endpoint.split('/').pop());
    dit(r3.code === 200 && r4.code === 200 && fin2.length === 2, 'même chose quand la ligne n’existe pas encore', `réponses ${r3.code}/${r4.code} · [${fin2.join(', ')}]`);
    // Un appareil déjà inscrit qui rouvre l'app : rien n'est réécrit.
    latence = {}; ecritures = [];
    const r5 = faireRes();
    await pushRoute.default(abo('https://web.push.apple.com/ipad'), r5);
    dit(r5.code === 200 && !ecritures.includes('push_subs'), 'un appareil déjà inscrit : « activé », sans réécrire la liste', `HTTP ${r5.code} · écritures ${JSON.stringify(ecritures)}`);
    // L'autre sens : une désinscription pendant une inscription — chacune garde son effet.
    latence.push_subs = 30; latence.ecriture = 40;
    const r6 = faireRes(), r7 = faireRes();
    await Promise.all([pushRoute.default(abo('https://web.push.apple.com/ipad', 'unsubscribe'), r6), pushRoute.default(abo('https://fcm.googleapis.com/pc'), r7)]);
    const fin3 = ((lire('push_subs') || {}).subs || []).map((s) => s.endpoint.split('/').pop()).sort();
    dit(JSON.stringify(fin3) === JSON.stringify(['mac', 'pc']), 'une désinscription et une inscription simultanées : les deux comptent', `[${fin3.join(', ')}]`);
  });

  // ══ G. La purge d'un appareil mort pendant qu'un autre s'abonne ═══════════
  console.log('\n── G. Un envoi purge un appareil disparu pendant qu’un autre s’abonne');
  await essaie('G', async () => {
    reset({ message: true });
    base.set(`${OWNER}|push_subs`, { subs: [{ endpoint: 'https://fcm.googleapis.com/vieux-mort' }, { endpoint: 'https://web.push.apple.com/iphone' }] });
    morts.add('https://fcm.googleapis.com/vieux-mort');
    latence.push_subs = 30; latence.ecriture = 40;
    const r = faireRes();
    // L'envoi est appelé directement (la vraie fonction de _lib/push.js) pour que
    // les deux lectures de la liste tombent au même moment : par la route des
    // emails, les lectures d'avant (registre, préférences, mémo) le décaleraient.
    await Promise.all([libPush.sendPushToAll({ title: 'banc', body: 'banc', tag: 'banc-g' }), pushRoute.default(abo('https://fcm.googleapis.com/neuf'), r)]);
    const fin = ((lire('push_subs') || {}).subs || []).map((s) => s.endpoint.split('/').pop()).sort();
    dit(r.code === 200 && fin.includes('neuf') && !fin.includes('vieux-mort') && fin.includes('iphone'),
      'l’appareil disparu est retiré, celui qui s’abonnait au même moment reste', `[${fin.join(', ')}]`);
  });

  // ══ H. Le journal des emails n'est pas effacé par une lecture ratée ═══════
  console.log('\n── H. Le journal des emails : une lecture ratée ne le vide pas');
  await essaie('H', async () => {
    reset({ message: true });
    for (let n = 1; n <= 3; n++) await recoit(emailMessage(n, `Message ${n}\n`));
    const avant = ((lire('email_journal') || {}).entries || []).length;
    pannes.add('email_journal');
    await recoit(emailMessage(4, 'Message 4\n'));
    pannes.delete('email_journal');
    const apres = ((lire('email_journal') || {}).entries || []).length;
    dit(avant === 3 && apres >= avant, 'le journal garde ses lignes après une lecture ratée', `${avant} lignes → ${apres}`);
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) au vert, ${ko} au rouge.`);
  process.exit(ko ? 1 : 0);
})();
