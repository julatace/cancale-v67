// ═══════════════════════════════════════════════════════════════════════════
// BANC : « VINTED ATTEND UNE RÉPONSE AVANT UNE ÉCHÉANCE » (18 octobre)
//        node scripts/bancs/emails-action.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré dans sa base : « L'acheteur souhaite annuler son achat ! » et
// « {article} - Confirmation requise » (un ACHAT livré, à vérifier avant une
// date limite) tombaient dans « aucune règle ne le reconnaît » : aucune
// notification, alors que passé l'échéance Vinted tranche seul (l'annulation)
// ou finalise la vente (plus de remboursement possible).
// On EXÉCUTE la vraie route contre la fausse base à état du banc des messages
// (même harnais), avec des emails INVENTÉS à la forme des vrais (sujet, phrases
// clés ; aucun pseudo ni article réel).
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

const emailAnnul = {
  from: "\"L'équipe Vinted\" <no-reply@vinted.fr>", to: 'boite-de-reception@banc.test',
  subject: "L'acheteur souhaite annuler son achat !",
  text: " E-mail Vinted \n<https://links.vinted.com/t/x> \n  \n[image: Photo] \n\nacheteur_banc souhaiterait annuler l'achat de l'article Paire de banc \ntaille 42 pour la raison suivante :  \"je me suis trompé de taille \". \n\nTu peux accepter ou refuser cette annulation, depuis votre conversation, en \ncliquant ci-dessous : \n\nAller sur la conversation \n",
  html: '', attachments: [],
};
const emailLivre = {
  from: "\"L'équipe Vinted\" <no-reply@vinted.fr>", to: 'boite-de-reception@banc.test',
  subject: 'Veste de banc - Confirmation requise',
  text: " E-mail Vinted \n\nBonjour compte_banc, \n\nIl a été indiqué que ta commande a été livrée.   \n\nSi tu as bien reçu ta commande et que l’article est conforme à sa \ndescription, confirme-le en appuyant sur sur le bouton Tout est OK dans ta \nconversation avec le vendeur. \n\nTu as jusqu’au 18 oct. 11:25 pour signaler un problème. \n\nSi tu ne signales pas de problème dans le délai indiqué, la transaction \nsera finalisée.",
  html: '', attachments: [],
};
const emailRembourse = {
  from: "\"L'équipe Vinted\" <no-reply@vinted.fr>", to: 'boite-de-reception@banc.test',
  subject: 'La commande "Paire de banc" a été remboursée !',
  text: "Bonjour compte_banc,\nLe paiement que tu as fait à vendeur_banc a été annulé. Tu seras remboursé sous 5 jours ouvrés.", html: '', attachments: [],
};
const emailInconnu = { from: 'quelquun@ailleurs.test', to: 'boite-de-reception@banc.test', subject: 'Une lettre sans rapport', text: 'rien à voir', html: '', attachments: [] };
const famillesInconnues = () => [...base.entries()].filter(([k]) => k.split('|')[1].startsWith('email_inconnu_')).map(([, d]) => d);

(async () => {
  const inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
  const libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js'));
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const reset = (prefs) => {
    base.clear(); pannes = new Set(); latence = {}; ecritures = []; pushes.length = 0; morts.clear();
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
    base.set(`${OWNER}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
    if (prefs) base.set(`${OWNER}|push_prefs`, prefs);
  };

  console.log('\n── A. « L\'acheteur souhaite annuler son achat ! » → notification, sans rien inventer');
  await essaie('A', async () => {
    reset();
    const res = await recoit(emailAnnul);
    const p = pushes[0] || {};
    console.log(`     ce que lit le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(res.code === 200, 'l’email est accepté', `HTTP ${res.code}`);
    dit(pushes.length === 1, 'une notification part (catégorie activée par défaut)', `${pushes.length}`);
    dit(/annulation/i.test(p.title || '') && /Paire de banc taille 42/.test(p.title || ''), 'le titre dit « annulation » et nomme l’article lu dans l’email', JSON.stringify(p.title));
    dit(/acheteur_banc/.test(p.body || '') && /trompé de taille/.test(p.body || '') && /accepte ou refuse/i.test(p.body || ''), 'le texte nomme l’acheteur, sa raison, et le geste', JSON.stringify(p.body));
    const fam = famillesInconnues().map((d) => d.famille);
    dit(fam.includes("demande d'annulation de l'acheteur"), 'l’email reste conservé, rangé dans sa famille', JSON.stringify(fam));
    pushes.length = 0; await recoit(emailAnnul);
    dit(pushes.length === 0, 'le même email renvoyé ne sonne pas une seconde fois', `${pushes.length}`);
  });

  console.log('\n── B. « … - Confirmation requise » (achat livré) → notification avec la date limite');
  await essaie('B', async () => {
    reset();
    await recoit(emailLivre);
    const p = pushes[0] || {};
    console.log(`     ce que lit le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(pushes.length === 1, 'une notification part', `${pushes.length}`);
    dit(/Achat livré/i.test(p.title || '') && /Veste de banc/.test(p.title || ''), 'le titre nomme l’achat (lu dans le sujet)', JSON.stringify(p.title));
    dit(/18 oct\. 11:25/.test(p.body || ''), 'le texte porte la date limite LUE dans l’email', JSON.stringify(p.body));
    const sansDate = Object.assign({}, emailLivre, { subject: 'Autre paire - Confirmation requise', text: emailLivre.text.replace(/Tu as jusqu’au .+? pour signaler un problème\./, '') });
    pushes.length = 0; await recoit(sansDate);
    const p2 = pushes[0] || {};
    dit(pushes.length === 1 && !/jusqu'au/.test(p2.body || ''), 'sans date dans l’email : aucune date inventée', JSON.stringify(p2.body));
  });

  console.log('\n── C. La catégorie se coupe ; le reste ne change pas');
  await essaie('C', async () => {
    reset({ action: false });
    await recoit(emailAnnul); await recoit(emailLivre);
    dit(pushes.length === 0, 'catégorie « À trancher » coupée : rien ne sonne', `${pushes.length}`);
    reset();
    await recoit(emailRembourse); await recoit(emailInconnu);
    dit(pushes.length === 0, 'un remboursement d’achat et un email sans rapport ne sonnent pas', `${pushes.length}`);
    const ds = famillesInconnues();
    dit(ds.some((d) => d.famille === "remboursement d'un de tes achats"), 'le remboursement d’un achat est reconnu (famille connue, sans action)', JSON.stringify(ds.map((d) => d.famille)));
    dit(ds.some((d) => d.type === 'inconnu' && d.famille === ''), 'l’email sans rapport reste « non reconnu », conservé', JSON.stringify(ds.map((d) => d.type)));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec (${ok} verts)` : `\n✅ ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
