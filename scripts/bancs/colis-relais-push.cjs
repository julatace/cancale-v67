// ═══════════════════════════════════════════════════════════════════════════
// BANC : « UN COLIS ACHETÉ ARRIVE AU POINT RELAIS » → UNE NOTIFICATION, AVEC LE
//        CODE ET LE LIEU (node scripts/bancs/colis-relais-push.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Julien (21 octobre). La notification existait (catégorie
// « colis », activée par défaut) — mais elle partageait sa clé anti-doublon
// avec TOUTES les étapes du colis (`track-{suivi}`). Julien a activé « Suivi du
// colis » : le premier email « en transit » consommait la clé, et « arrivé au
// point de retrait » (celui qui porte le code) ne sonnait JAMAIS.
//
// §4.10 : on EXÉCUTE la vraie route `api/email-inbound.js` contre une fausse
// base À ÉTAT (ce qui est écrit est relu) et un faux Web Push. Données
// inventées, rien ne quitte la machine. On exige :
//   A. un email « disponible » avec code + lieu ⇒ UNE notification, le code et
//      le lieu dedans, qui ouvre ?tab=cat_achats ; relancé ⇒ rien de plus ;
//   B. « en transit » PUIS « disponible », « Suivi » activé ⇒ « disponible »
//      sonne quand même (rouge sur le code d'avant) ;
//   C. un premier « disponible » SANS code, puis un rappel AVEC le code ⇒ le
//      code arrive dans une seconde notification ; un troisième, rien ;
//   D. un code illisible (« suivant ») n'est JAMAIS affiché ;
//   E. préférence « colis » coupée ⇒ rien ;
//   F. abonnement coupé (vrm_acces_pour = false) ⇒ rien ;
//   G. lecture de la ligne d'avant ratée ⇒ rien d'inventé (pas de code venu
//      d'ailleurs).
// §6.1 : RACINE se déduit de __dirname (copié dans un arbre d'avant et lancé
// depuis lui, il mesure le code d'avant).
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const OWNER = '11111111-2222-3333-4444-555555555555';
process.env.VRM_OWNER_UID = OWNER;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
delete process.env.EMAIL_INBOUND_SECRET;

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
  if (id === 'vrm_email_owners') return rep([]);
  const lignes = filtrer(u);
  if (sel.startsWith('data->')) { const k = sel.slice(6); return rep(lignes.map(([, d]) => ({ [k]: d && d[k] }))); }
  return rep(lignes.map(([cle, d]) => ({ owner: cle.split('|')[0], id: cle.split('|')[1], data: d })));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };

// ── Les emails (forme Mondial Relay, données inventées) ───────────────────
const SUIVI = '87654321';
const mr = (sujet, corps, n = 1) => ({ from: 'noreply@mondialrelay.fr', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<mr-${n}-${Math.random()}@banc>` });
const transit = () => mr(`Votre colis ${SUIVI} est en cours d'acheminement`, `Bonjour,\nVotre colis ${SUIVI} est en cours d'acheminement vers votre Point Relais.`, 1);
const dispo = (corpsCode = 'Votre code de retrait est 482913\n') => mr(`Votre colis ${SUIVI} est disponible 📦`,
  `Bonjour,\nVotre colis est disponible.\n${corpsCode}Point Relais\nPhone Cash Banc\n17 Rue Inventée\n56000 Vannes\nHoraires`, 2);

(async () => {
  let inbound, libPush, libAbo = {};
  try { inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js')); } catch (e) { dit(false, 'api/email-inbound.js se charge', e.message); }
  try { libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js')); } catch (_) { libPush = {}; }
  try { libAbo = await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const reset = (prefs) => {
    base.clear(); pannes = new Set(); acces = true; pushes.length = 0;
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    if (typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
    base.set(`${OWNER}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
    if (prefs) base.set(`${OWNER}|push_prefs`, prefs);
  };
  const relais = () => pushes.filter((p) => /point de retrait|à retirer/i.test(`${p.title} ${p.body}`));

  console.log('── A. Disponible avec code et lieu : une notification, le code et le lieu dedans');
  await essaie('A', async () => {
    reset();
    const r = await recoit(dispo());
    dit(r.code === 200 && r.corps && r.corps.type === 'suivi' && r.corps.status === 'available', 'l’email est reconnu « disponible »', `HTTP ${r.code} ${JSON.stringify(r.corps && { type: r.corps.type, status: r.corps.status })}`);
    const p = relais()[0] || {};
    console.log(`     sur le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(relais().length === 1, 'une notification « à retirer »', `${relais().length}`);
    dit(/482913/.test(p.body || ''), 'le CODE de retrait est dans la notification', p.body);
    dit(/Phone Cash Banc/.test(p.body || ''), 'le LIEU est dans la notification', p.body);
    dit(p.url === '/?tab=cat_achats', 'le clic ouvre Achats (?tab=cat_achats)', p.url);
    await recoit(dispo());
    dit(relais().length === 1, 'le même email renvoyé : rien de plus (une fois par n° de suivi)', `${relais().length}`);
  });

  console.log('\n── B. « En transit » puis « disponible », Suivi activé (ses préférences mesurées)');
  await essaie('B', async () => {
    reset({ suivi: true, achat: true, message: true });
    await recoit(transit());
    const transits = pushes.length;
    await recoit(dispo());
    dit(transits === 1, '« en transit » sonne (Suivi est activé)', `${transits}`);
    dit(relais().length === 1 && /482913/.test((relais()[0] || {}).body || ''), '« disponible » sonne QUAND MÊME, avec le code — il n’est plus avalé par « en transit »', `${relais().length} notification(s) à retirer`);
  });

  console.log('\n── C. D’abord sans code, puis le rappel apporte le code');
  await essaie('C', async () => {
    reset();
    await recoit(dispo(''));
    const a = relais().length;
    await recoit(dispo('Votre code de retrait est 715204\n'));
    const b = relais();
    await recoit(dispo('Votre code de retrait est 715204\n'));
    dit(a === 1 && b.length === 2 && /715204/.test(b[1].body || ''), 'le code arrivé plus tard part dans une seconde notification', `${a} puis ${b.length}`);
    dit(relais().length === 2, 'un troisième email au même code : rien de plus', `${relais().length}`);
  });

  console.log('\n── D. Un code illisible n’est jamais affiché');
  await essaie('D', async () => {
    reset();
    base.set(`${OWNER}|email_track_mondialrelay_${SUIVI}`, { type: 'suivi', suivi: SUIVI, code: 'suivant', lieu: null });
    await recoit(dispo(''));
    const p = relais()[0] || {};
    dit(relais().length === 1 && !/suivant/i.test(p.body || '') && !/Code :/.test(p.body || ''), '« suivant » (ancien motif trop large) n’apparaît pas comme code', p.body);
  });

  console.log('\n── E. Préférence « colis » coupée');
  await essaie('E', async () => {
    reset({ colis: false });
    await recoit(dispo());
    dit(relais().length === 0, '« Colis à retirer » coupé ⇒ rien', `${relais().length}`);
  });

  console.log('\n── F. Abonnement coupé');
  await essaie('F', async () => {
    reset(); acces = false;
    await recoit(dispo());
    dit(relais().length === 0, 'qui ne paie plus ne reçoit plus rien', `${relais().length}`);
  });

  console.log('\n── G. Lecture de la ligne d’avant ratée : rien d’inventé');
  await essaie('G', async () => {
    reset();
    base.set(`${OWNER}|email_track_mondialrelay_${SUIVI}`, { type: 'suivi', suivi: SUIVI, code: '999111', lieu: 'Autre Lieu' });
    pannes.add(`email_track_mondialrelay_${SUIVI}`);
    await recoit(dispo(''));
    const p = relais()[0] || {};
    dit(relais().length === 1 && !/999111/.test(p.body || ''), 'la ligne d’avant illisible : pas de code venu d’ailleurs, la notification dit seulement le lieu lu', p.body);
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
