// ═══════════════════════════════════════════════════════════════════════════
// BANC : « 📍 COLIS À RETIRER » QUAND L'EXTENSION RANGE UN CODE NEUF LU DANS
//        UNE CONVERSATION VINTED (node scripts/bancs/retrait-conv-push.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// 21 octobre (extension 5.204). Avant, seule la voie EMAIL sonnait : un code
// Vinted Go lu dans la conversation (aucun email ne le porte) restait muet.
// L'extension appelle `api/push` { action: 'retrait', tx } ; la route relit la
// ligne `panel_colis_relais` du vendeur (jamais ce que dirait l'extension) et
// sonne une fois. Anti-doublon PARTAGÉ avec l'email par le CODE de retrait (la
// seule identité commune, §5).
// §4.10 : les VRAIES routes `api/push.js` et `api/email-inbound.js` contre une
// fausse base À ÉTAT (cloisonnée, une session) et un faux Web Push. Données
// inventées. §6.1 : RACINE se déduit de __dirname.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const OWNER = '11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
process.env.EMAIL_INBOUND_SECRET='cle-banc-notifications'; // obligatoire depuis dc4799f

const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { ko++; console.log(`❌ ${m} — a levé : ${String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')}`); } };

// ── Fausse base à état ─────────────────────────────────────────────────────
const HTML522 = '<!DOCTYPE html><title>522</title>';
const base = new Map();
let pannes = new Set(), acces = true;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const champ = (data, k) => { const v = data && data[k.replace(/^data->>/, '')]; return v == null ? null : String(v); };
const filtrer = (u) => {
  const f = [];
  for (const [k, v] of u.searchParams) { if (['select', 'on_conflict', 'limit', 'order'].includes(k)) continue; f.push([decodeURIComponent(k), v]); }
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
  if (u.pathname === '/auth/v1/user') { const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || ''); return /aaa\.bbb\.ccc/.test(a) ? rep({ id: OWNER, email: 'banc@banc.test' }) : rep({ msg: 'non' }, 401); }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(acces);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([{ vinted_user_id: '900', login: 'compte_banc' }]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const rows = JSON.parse(opts.body || '[]');
    const sansEcraser = /ignore-duplicates/.test(prefer); const rendus = [];
    for (const r of rows) { const cle = `${r.owner || OWNER}|${r.id}`; if (sansEcraser && base.has(cle)) continue; base.set(cle, r.data); rendus.push(r); }
    return /return=representation/.test(prefer) ? rep(rendus, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const touchees = filtrer(u);
    for (const [cle] of touchees) base.set(cle, corps.data);
    return /return=representation/.test(prefer) ? rep(touchees.map(([cle]) => ({ id: cle.split('|')[1], data: base.get(cle) }))) : new Response('', { status: 204 });
  }
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  const id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, ''));
  if (pannes.has(id)) return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
  if (id === 'vrm_email_owners') return rep([{ owner: OWNER, data: { adresses: { 'boite@banc.test': { owner: OWNER } } } }]); // boîte DÉCLARÉE (repli installation retiré, deba4c7)
  const lignes = filtrer(u);
  if (sel.startsWith('data->')) { const k = sel.slice(6); return rep(lignes.map(([, d]) => ({ [k]: d && d[k] }))); }
  return rep(lignes.map(([cle, d]) => ({ owner: cle.split('|')[0], id: cle.split('|')[1], data: d })));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };


// ── Les emails (forme Mondial Relay, données inventées) ───────────────────
const SUIVI = '87654321';
const mr = (sujet, corps) => ({ from: 'noreply@mondialrelay.fr', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<mr-${Math.random()}@banc>` });
const dispo = (code) => mr(`Votre colis ${SUIVI} est disponible 📦`,
  `Bonjour,\nVotre colis est disponible.\n${code ? `Votre code de retrait est ${code}\n` : ''}Point Relais\nPhone Cash Banc\n17 Rue Inventée\n56000 Vannes\nHoraires`);
// La ligne que l'EXTENSION range (panel_colis_relais, par transaction).
const TX = '30000000001';
const entreeConv = (code, at = new Date().toISOString()) => ({ tx: TX, item: '1', titre: 'Baskets banc', lieu: 'Consigne Banc, 1 rue Inventée', code, qr: '', transporteur: 'vinted', conv: '9', url: 'https://www.vinted.fr/inbox/9', arriveLe: at, at });
const JETON = 'aaa.bbb.ccc';

(async () => {
  let inbound, push, libPush, libAbo = {};
  try { inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js')); } catch (e) { dit(false, 'api/email-inbound.js se charge', e.message); }
  try { push = await import('file://' + path.join(RACINE, 'api', 'push.js')); } catch (e) { dit(false, 'api/push.js se charge', e.message); }
  try { libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js')); } catch (_) { libPush = {}; }
  try { libAbo = await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-notifications'}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const extension = async (tx, jeton = JETON) => { const res = faireRes(); await push.default({ method: 'POST', query: {}, headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: { action: 'retrait', tx } }, res); return res; };
  const reset = (prefs) => {
    base.clear(); pannes = new Set(); acces = true; pushes.length = 0;
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    if (inbound && typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
    base.set(`${OWNER}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
    if (prefs) base.set(`${OWNER}|push_prefs`, prefs);
  };
  const relais = () => pushes.filter((p) => /point de retrait|à retirer/i.test(`${p.title} ${p.body}`));

  console.log('── A. L’extension range un code neuf : « 📍 Colis à retirer », une fois');
  await essaie('A', async () => {
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735') });
    const r = await extension(TX);
    const p = relais()[0] || {};
    console.log(`     sur le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(r.code === 200, 'la route répond 200', `HTTP ${r.code} ${JSON.stringify(r.corps)}`);
    dit(relais().length === 1 && /Colis à retirer/.test(p.title || ''), 'une notification « 📍 Colis à retirer »', `${relais().length}`);
    dit(/C65735/.test(p.body || '') && /Consigne Banc/.test(p.body || ''), 'le code et le lieu relus dans SA ligne sont dedans', p.body);
    dit(p.url === '/?tab=cat_achats', 'le clic ouvre Achats', p.url);
    await extension(TX);
    dit(relais().length === 1, 'redemandée (nouvel essai de l’extension) : rien de plus', `${relais().length}`);
  });

  console.log('\n── B. Email PUIS conversation, même code : une seule notification');
  await essaie('B', async () => {
    reset();
    await recoit(dispo('482913'));
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('482913') });
    await extension(TX);
    dit(relais().length === 1, 'le code est l’identité commune : la conversation se tait', `${relais().length}`);
  });

  console.log('\n── C. Conversation PUIS email, même code : une seule notification');
  await essaie('C', async () => {
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('482913') });
    await extension(TX);
    await recoit(dispo('482913'));
    dit(relais().length === 1, 'l’email se tait (même code)', `${relais().length}`);
  });

  console.log('\n── D. Deux colis, deux codes : deux notifications (rien n’est confondu)');
  await essaie('D', async () => {
    reset();
    await recoit(dispo('482913'));
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C11111') });
    await extension(TX);
    dit(relais().length === 2, 'un autre code = un autre colis', `${relais().length}`);
  });

  console.log('\n── E. Les refus');
  await essaie('E', async () => {
    reset({ colis: false });
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735') });
    await extension(TX);
    dit(relais().length === 0, 'préférence « colis » coupée ⇒ rien', `${relais().length}`);
    reset(); acces = false;
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735') });
    await extension(TX);
    dit(relais().length === 0, 'abonnement coupé ⇒ rien', `${relais().length}`);
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('') });
    const r1 = await extension(TX);
    dit(relais().length === 0 && r1.code === 200, 'sans code ⇒ rien (on ne sonne que pour un code)', `${relais().length} HTTP ${r1.code}`);
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735', new Date(Date.now() - 5 * 86400000).toISOString()) });
    await extension(TX);
    dit(relais().length === 0, 'une entrée rangée il y a 5 jours ⇒ rien (pas de rattrapage)', `${relais().length}`);
    reset();
    const r2 = await extension('31234');
    dit(r2.code === 404 && relais().length === 0, 'une transaction inconnue ⇒ 404, rien', `HTTP ${r2.code}`);
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735') });
    pannes.add('panel_colis_relais');
    const r3 = await extension(TX);
    dit(r3.code === 503 && relais().length === 0, 'ligne illisible ⇒ 503 « pas su » (l’extension réessaiera), rien d’inventé', `HTTP ${r3.code}`);
    reset();
    base.set(`${OWNER}|panel_colis_relais`, { [TX]: entreeConv('C65735') });
    const r4 = await extension(TX, '');
    dit(r4.code === 401 && relais().length === 0, 'sans session (base cloisonnée) ⇒ 401, rien', `HTTP ${r4.code}`);
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
