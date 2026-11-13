#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour cet audit
// AUDIT (13 nov.) — LE NOM DE LA PAIRE DANS LES RAPPELS DE RETRAIT, ET UNE NOTIFICATION PAR COLIS ET PAR JOUR.
// Julien : « avec le n° de suivi on va voir quelle paire est à l'intérieur de chaque colis ».
// Il EXÉCUTE la vraie route api/ship-reminders.js (cron du matin, puis du soir) et la vraie route
// api/email-inbound.js (arrivée « t'attend ») sur une fausse base À ÉTAT, à la forme de PostgREST
// (projections, `meta` calculée comme la base, filtre `cs`). Fixtures INVENTÉES (aucun n°, code,
// point ni titre réel). Ce qu'il juge :
//   1. un colis relié à SON achat par IDENTITÉ (n° de suivi — ligne de suivi Vinted —, code de
//      retrait de la conversation) porte le titre de l'achat : « 📍 Demain dernier jour · <paire> »,
//      « 📍 Dernier jour · <paire> », « <paire> t'attend » ;
//   2. JAMAIS par ressemblance : un achat « au point relais » au même point, le même jour, sans
//      identité commune, ne donne pas son nom ; un n° relié à deux achats ⇒ personne ;
//   3. le résumé du soir ne redit pas un colis qui a eu son « Demain dernier jour » le matin même
//      (une notification par colis et par jour) ; sans rappel du matin, le soir le dit, une fois ;
//   4. lectures légères : aucune `select=data` sur les achats, projection `my_orders` seulement.
// `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE. §6.1 : rouge sur un arbre d'avant.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  // le nom pris par RESSEMBLANCE : un achat au point relais quand aucune identité ne relie
  'nom-par-ressemblance': ['api/_lib/commande-colis.js', "  if (!tx) return null;\n", "  if (!tx) return (achats || []).find((o) => /relais/i.test(String((o && o.status) || ''))) || null;\n"],
  // la jonction coupée côté serveur (le nom de l'achat n'est plus pris)
  'nom-pas-pris': ['api/ship-reminders.js', '    for (const x of liste) x.article = titreDuColis(', '    for (const x of []) x.article = titreDuColis('],
  // deux notifications le même jour : le soir redit le colis déjà rappelé le matin
  'soir-redit-la-veille': ['api/ship-reminders.js', "x.etat === 'demain' && dejaDits[x.cle] !== today", "x.etat === 'demain'"],
  // l'arrivée « t'attend » sans le nom de l'achat relié
  'arrivee-sans-nom': ['api/email-inbound.js', 'texteArrivee({ article: artLie || track.artTitle,', 'texteArrivee({ article: track.artTitle,'],
  // un n° relié à DEUX achats : on prend le premier (deviné)
  'ambigu-devine': ['src/liensColis.js', ' return c&&c.size===1?[...c.values()][0]:null;', ' return c&&c.size?[...c.values()][0]:null;'],
};
if (process.argv.includes('--prouve')) {
  let rates = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-paire-'));
    for (const x of ['api', 'src']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.copyFileSync(path.join(R, 'package.json'), path.join(t, 'package.json'));
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); rates++; fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (!tombe) rates++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non attrapée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 240)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Une fausse base à état, à la forme de PostgREST (reprise d'audit-suivi-colis.cjs, + `cs`) ──
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-paire';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const webpush = require(path.join(R, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const base = new Map();
let pannes = new Set(), acces = true;
const lus = [], ecrits = [];
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
// La colonne `meta` : les scalaires de premier niveau ≤ 600 caractères (vrm_meta).
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  // (13 nov.) `cs` sur un tableau JSON : chaque objet demandé est contenu dans un élément (PostgREST `@>`).
  if (o === 'cs') { try { const arr = JSON.parse(x); const voulu = JSON.parse(v); return Array.isArray(arr) && voulu.every((w) => arr.some((a) => a && Object.entries(w).every(([kk, vv]) => a[kk] === vv))); } catch (_) { return false; } }
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); return [e.slice(0, j), e.slice(j + 1)]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const brut = decodeURIComponent(u.pathname + u.search);
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(acces);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    // (29 oct.) `return=representation` rend les lignes VRAIMENT écrites, comme
    // PostgREST (une ligne ignorée en doublon n'y est pas) — le comparer-et-échanger
    // de `push_dedup` (`modifierCas`) le lit (§6.3 : la forme de la réponse).
    const ecritesIci = [];
    for (const r of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: r.id, owner: r.owner || A });
      if (pannes.has('ecrire:' + r.id)) return rep('<html>522</html>', 522);
      const cle = `${r.owner || A}|${r.id}`;
      if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
      base.set(cle, r.data);
      ecritesIci.push({ owner: r.owner || A, id: r.id, data: r.data });
    }
    return /return=representation/.test(prefer) ? rep(ecritesIci, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data);
    return rep(t.map((l) => ({ id: l.id })));
  }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  lus.push(brut);
  for (const p of pannes) if (p.startsWith('lire:') && brut.includes(p.slice(5))) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

const resetBase = () => {
  base.clear(); pannes = new Set(); acces = true; pushes.length = 0; lus.length = 0; ecrits.length = 0;
  base.set(`${A}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
  base.set(`${A}|push_prefs`, { colis: true, suivi: true, soir: true });
  base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
};
let inbound = null;
const oublis = async () => {
  try { const p = await importer('api/_lib/push.js'); if (typeof p.oublierPrefsVues === 'function') p.oublierPrefsVues(); } catch (_) {}
  try { const a = await importer('api/_lib/abonnement.js'); if (typeof a.oublierAcces === 'function') a.oublierAcces(); } catch (_) {}
  if (inbound && typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
};
// Les achats (deux comptes inventés), les liens par IDENTITÉ, les colis.
const POINT = 'Bar du Banc, 5 Rue Imaginaire, 56000 Vannes';
const achats = () => {
  base.set(`${A}|harvest_9001_orders_purchased`, { capturedAt: '2026-10-26T08:00:00Z', payload: { my_orders: [
    { transaction_id: 7001, conversation_id: 8001, title: 'Air Max 90 blanches 43', status: 'Colis en route', date: '2026-10-20T08:00:00Z' },
    { transaction_id: 7002, conversation_id: 8002, title: 'Jordan 1 Mid noires 42', status: 'Colis en route', date: '2026-10-20T08:00:00Z' },
    // Le PIÈGE : un achat « au point relais », au même point, le même jour — aucune identité commune.
    { transaction_id: 7003, conversation_id: 8003, title: 'Stan Smith vertes 41', status: 'Le colis est arrivé au point relais', date: '2026-10-25T08:00:00Z' },
    { transaction_id: 7004, conversation_id: 8004, title: 'Gazelle bleues 40', status: 'Colis en route', date: '2026-10-20T08:00:00Z' },
  ] } });
  base.set(`${A}|harvest_9002_orders_purchased`, { capturedAt: '2026-10-26T08:00:00Z', payload: { my_orders: [
    { transaction_id: 7005, conversation_id: 8005, title: 'Samba blanches 44', status: 'Colis en route', date: '2026-10-20T08:00:00Z' },
  ] } });
  // N° de suivi relevé par l'extension (panneau « Détails » de Vinted) : 40000001 ↔ 7001.
  base.set(`${A}|harvest_9001_suivi_7001`, { tx: '7001', suivi: '40000001', transporteur: 'Mondial Relay', capturedAt: '2026-10-26T08:00:00Z' });
  // Un n° relié à DEUX achats (deux comptes) : ambigu ⇒ personne.
  base.set(`${A}|harvest_9001_suivi_7004`, { tx: '7004', suivi: '40000004', capturedAt: '2026-10-26T08:00:00Z' });
  base.set(`${A}|harvest_9002_suivi_7005`, { tx: '7005', suivi: '40000004', capturedAt: '2026-10-26T08:00:00Z' });
  // Le code de retrait lu dans la conversation de 7002.
  base.set(`${A}|panel_colis_relais`, { 7002: { code: '612345', lieu: POINT } });
};
const tr = (cle, o) => base.set(`${A}|email_track_${cle}`, { status: 'available', subject: 'Votre colis est disponible', receivedAt: '2026-10-25T08:00:00Z', arriveLe: '2026-10-25T08:00:00Z', carrier: 'mondialrelay', lieu: POINT, ...o });

(async () => {
  const T = Date.parse('2026-10-27T08:00:00Z');        // mardi, 9 h à Paris
  const SOIR = Date.parse('2026-10-27T18:05:00Z');     // le même jour, 19 h 05
  const vraiNow = Date.now;
  let cron = null;
  const lancer = async (t, query = {}) => { Date.now = () => t; try { const r = faireRes(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query }, r); return r; } finally { Date.now = vraiNow; } };
  const prepare = () => {
    resetBase(); achats();
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    tr('mondialrelay_40000001', { suivi: '40000001', limite: '2026-10-28', code: '511111' });               // veille, relié par n° de suivi
    tr('mondialrelay_40000002', { suivi: '40000002', limite: '2026-10-27', code: '612345' });               // jour même, relié par code
    tr('mondialrelay_40000003', { suivi: '40000003', limite: '2026-10-27', code: '733333' });               // aucune identité (le piège 7003)
    tr('mondialrelay_40000004', { suivi: '40000004', limite: '2026-10-27', code: '744444' });               // n° relié à deux achats
    tr('mondialrelay_40000006', { suivi: '40000006', limite: '2026-10-27', code: '766666', artTitle: 'Titre écrit dans l’e-mail' });   // l'e-mail nomme l'article
  };
  await essaie('route api/ship-reminders (matin puis soir)', async () => {
    cron = (await importer('api/ship-reminders.js')).default;
    prepare(); await oublis();
    const r1 = await lancer(T);
    const p = (s) => pushes.find((x) => x.tag === 'retrait-' + s) || {};
    const v1 = p('demain-40000001'), d2 = p('dernier-40000002'), d3 = p('dernier-40000003'), d4 = p('dernier-40000004'), d6 = p('dernier-40000006');
    dit(/Demain dernier jour/.test(v1.title || '') && /Air Max 90 blanches 43/.test(`${v1.title} ${v1.body}`),   // un titre de plus de 40 caractères passe l'article dans le corps (api/_lib/push.js)
     
      'veille : colis relié à son achat par son N° DE SUIVI (ligne de suivi Vinted) ⇒ « 📍 Demain dernier jour · <la paire> »', `${v1.title} | ${v1.body} | HTTP ${r1.code}`);
    dit(/Dernier jour · Jordan 1 Mid noires 42$/.test(d2.title || ''),
      'jour même : colis relié par son CODE DE RETRAIT (conversation) ⇒ « 📍 Dernier jour · <la paire> »', d2.title);
    dit(/Dernier jour · Colis Mondial Relay$/.test(d3.title || '') && !/Stan Smith/.test(JSON.stringify(pushes)),
      'aucune identité : jamais le nom d’un achat « au point relais » du même point et du même jour (ressemblance) ⇒ « Colis Mondial Relay »', d3.title);
    dit(/Dernier jour · Colis Mondial Relay$/.test(d4.title || '') && !/Gazelle|Samba/.test(JSON.stringify(pushes)),
      'un n° relié à DEUX achats : personne (mieux vaut un blanc qu’un faux)', d4.title);
    dit(/Dernier jour · Titre écrit dans l’e-mail$/.test(d6.title || ''), 'pas d’achat relié : l’article écrit dans l’e-mail de CE colis', d6.title);
    const lAchats = lus.filter((u) => /orders_purchased/.test(u));
    dit(lAchats.length > 0 && lAchats.every((u) => /select=id,orders:data->payload->my_orders/.test(u) && !/select=data(&|$)/.test(u)),
      'lecture légère : les achats en projection `my_orders`, jamais `select=data`', lAchats.slice(0, 2).join(' | '));
    // LE SOIR, même jour : le colis 40000001 a eu son « Demain dernier jour » ce matin ⇒ pas redit.
    const avant = pushes.length;
    const r2 = await lancer(SOIR, { moment: 'soir' });
    const soir = pushes.slice(avant).filter((x) => /^soir-/.test(x.tag || ''));
    const notifs40000001 = pushes.filter((x) => x.tag === 'retrait-demain-40000001').length + soir.filter((x) => /retir/i.test(`${x.title} ${x.body}`)).length;
    dit(notifs40000001 === 1, 'UNE notification par colis et par jour : le résumé du soir ne redit pas le colis rappelé ce matin', `${notifs40000001} · soir : ${soir.map((x) => x.title + ' | ' + x.body).join(' / ') || 'rien'} · ${JSON.stringify((r2.corps && (r2.corps.bilans || r2.corps)) || {}).slice(0, 300)}`);
    // Sans rappel du matin (mémo vide : cron du matin sauté) ⇒ le soir le dit, une fois.
    prepare(); await oublis();
    base.set(`${A}|colis_retrait_dedup`, { envoyes: {}, at: new Date(T).toISOString() });
    await lancer(SOIR, { moment: 'soir' });
    const soir2 = pushes.filter((x) => /^soir-/.test(x.tag || ''));
    dit(soir2.length === 1 && /retir/i.test(`${soir2[0].title} ${soir2[0].body}`) && !pushes.some((x) => /^retrait-/.test(x.tag || '')),
      'sans rappel du matin, le résumé du soir dit le retrait de demain (une fois)', soir2.map((x) => x.title + ' | ' + x.body).join(' / ') || 'rien');
    // Mémo illisible le soir ⇒ les retraits ne sont pas dits (pas su ≠ pas envoyé).
    prepare(); await oublis();
    pannes.add('lire:id=eq.colis_retrait_dedup');
    await lancer(SOIR, { moment: 'soir' });
    const soir3 = pushes.filter((x) => /^soir-/.test(x.tag || ''));
    dit(!soir3.some((x) => /retir/i.test(`${x.title} ${x.body}`)), 'mémo du matin illisible ⇒ le soir ne dit pas le retrait (mieux vaut rien que deux fois)', soir3.map((x) => x.title).join(' / '));
  });

  // ── L'ARRIVÉE « t'attend » (route api/email-inbound) ─────────────────────────
  await essaie('route api/email-inbound (arrivée)', async () => {
    inbound = await importer('api/email-inbound.js');
    const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-paire' }, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
    const mail = (suivi, code, n) => ({ messageId: `<arr-${n}@banc>`, to: 'boite@banc.test', from: 'Mondial Relay <noreply@mondialrelay.fr>', sourceDate: '2026-10-25T08:00:00Z', html: '', attachments: [],
      subject: `Votre colis ${suivi} est disponible 📦`, text: `Bonjour,\nVotre colis est disponible.\nVotre code de retrait est ${code}\nPOINT RELAIS®\nBAR DU BANC\n5 Rue Imaginaire\n56000 Vannes\nRETRAIT JUSQU’AU\n\n30/10\n` });
    resetBase(); achats(); base.set(`${A}|main`, { vrm_colis_collected: [] }); await oublis();
    const r1 = await recoit(mail('40000001', '511111', 1));
    const a1 = pushes.find((x) => /t'attend|Air Max/.test(`${x.title} ${x.body}`)) || {};
    dit(r1.code === 200 && /Air Max 90 blanches 43/.test(`${a1.title} ${a1.body}`), 'arrivée : colis relié à son achat par son n° de suivi ⇒ « <la paire> t’attend »', `HTTP ${r1.code} · ${a1.title} | ${a1.body}`);
    pushes.length = 0;
    const r2 = await recoit(mail('40000002', '612345', 2));
    const a2 = pushes[0] || {};
    dit(r2.code === 200 && /Jordan 1 Mid noires 42/.test(`${a2.title} ${a2.body}`), 'arrivée : colis relié par son code de retrait ⇒ le nom de la paire', `${a2.title} | ${a2.body}`);
    pushes.length = 0;
    const r3 = await recoit(mail('40000003', '733333', 3));
    const a3 = pushes[0] || {};
    dit(r3.code === 200 && /t'attend/.test(a3.title || '') && !/Stan Smith|Air Max|Jordan|Gazelle|Samba/.test(`${a3.title} ${a3.body}`), 'arrivée sans identité : jamais un nom par ressemblance', `${a3.title} | ${a3.body}`);
    const lAchats = lus.filter((u) => /orders_purchased/.test(u));
    dit(lAchats.length > 0 && lAchats.every((u) => /my_orders=cs\./.test(u) && /select=id,orders:data->payload->my_orders/.test(u)),
      'arrivée, lecture légère : seules les lignes d’achats qui CONTIENNENT la transaction reliée (`cs`), projetées', lAchats.slice(0, 2).join(' | '));
    // Lecture des liens ratée ⇒ l'arrivée sonne quand même, sans nom deviné.
    resetBase(); achats(); base.set(`${A}|main`, { vrm_colis_collected: [] }); await oublis();
    pannes.add('lire:harvest_*_suivi_*');
    const r4 = await recoit(mail('40000001', '511111', 4));
    const a4 = pushes[0] || {};
    dit(r4.code === 200 && /t'attend/.test(a4.title || '') && !/Air Max/.test(`${a4.title} ${a4.body}`), 'liens illisibles : l’arrivée sonne, sans nom (« pas su » ne devine rien)', `HTTP ${r4.code} · ${a4.title}`);
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec sur ${ok + ko}` : `\n✅ ${ok}/${ok} — le nom de la paire par identité seulement, une notification par colis et par jour.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a planté — ' + ((e && e.stack) || e)); process.exit(2); });
