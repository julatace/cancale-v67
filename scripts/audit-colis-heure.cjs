// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : TES COLIS À L'HEURE — LE RAPPEL DU MATIN, LE SOIR ET LE WIDGET
//         EXÉCUTÉS (node scripts/audit-colis-heure.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 22 octobre sur sa base (lecture seule) :
//   · le rappel du matin a dit « rien à envoyer » (`ship_reminder_dedup` total
//     0) alors que le soir en comptait 3 et qu'UN colis (tomj683) devait partir
//     avant le 23 à 10 h — il sautait un bordereau IMPRIMÉ comme un colis parti,
//     et ne connaissait que les ventes dont le bordereau est arrivé par EMAIL ;
//   · 204 bordereaux sur 205 donnent une HEURE limite (90 à « 10 h 00 ») que
//     tous les lecteurs jetaient (jour seul, 23:59).
// §4.10 : les VRAIES routes (`api/ship-reminders.js` matin et soir,
// `api/widget.js`) sont exécutées sur une fausse base CLOISONNÉE à la forme de
// la sienne — données INVENTÉES, aucune fixture — le 22 octobre 2026 à 7 h 10
// (Paris), l'heure du cron avancé. On exige :
//   1. le matin compte un colis IMPRIMÉ non parti (« 1 demain avant 10 h »),
//      une vente SANS email (date estimée, dite estimée), et passe « en
//      retard » une limite d'aujourd'hui 7 h dès 7 h 10 ; ni le colis coché
//      « posté », ni la vente masquée, ni le compte retiré ;
//   2. le widget dit les MÊMES échéances, à la même heure ;
//   3. le soir : « dont 2 déjà en retard, 1 avec la date limite demain à 10 h » ;
//   4. heure illisible ⇒ le jour seul (le comportement d'avant) ;
//   5. « pas su » se tait : bordereaux ou ventes illisibles ⇒ aucun envoi ;
//   6. le cron du matin est avancé (05:00 UTC), sans cron de plus ;
//   7. la règle est UNE : l'app, le matin, le soir et le widget importent
//      api/_lib/limite-envoi.js, et le module lit l'heure de PARIS (changement
//      d'heure du 25 octobre compris).
// `--src <dossier>` : lance l'audit sur une autre copie du dépôt (preuve §6.1).
const path = require('path'), fs = require('fs');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
// web-push vit dans node_modules du dépôt courant (une copie `git archive` n'en a pas).
const NM = fs.existsSync(path.join(RACINE, 'node_modules', 'web-push')) ? path.join(RACINE, 'node_modules') : path.join(__dirname, '..', 'node_modules');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
// Un audit ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

process.env.VAPID_PRIVATE_KEY = 'audit-cle-privee-factice';
delete process.env.SUPABASE_SERVICE_KEY;
process.env.CRON_SECRET = 'cle-audit-colis-heure';
const webpush = require(path.join(NM, 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const MATIN = Date.parse('2026-10-22T05:10:00Z');   // jeudi 22 octobre, 7 h 10 à Paris
const SOIR = Date.parse('2026-10-22T18:05:00Z');    // le même jour, 20 h 05
const vraiNow = Date.now;
const iso = (t) => new Date(t).toISOString();
const vente = (tx, date, status = 'Bordereau envoyé au vendeur') => ({ transaction_id: Number(tx), title: 'Paire ' + tx, status, transaction_user_status: 'needs_action', date, price: { amount: '40.0' } });
const bord = (tx, dateLimite) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), dateLimite, numero: String(tx).slice(-2), filename: `Bordereau-Vinted-${tx}.pdf`, receivedAt: iso(MATIN - 6 * 86400000) } });

// La forme de SA base, inventée : deux comptes vivants, un compte retiré.
//   901 tomj683 : bordereau IMPRIMÉ le 20, limite « 23/10/2026 10 h 00 »  → demain avant 10 h
//   902 tomj683 : limite « 22/10/2026 07 h 00 »                          → en retard à 7 h 10
//   903 tomj606 : vendue le 15, AUCUN email de bordereau                   → aujourd'hui (estimée)
//   906 tomj606 : vendue le 21 au soir, aucun email                        → plus tard (estimée)
//   904 tomj683 : coché « posté » ; 905 : masquée ; 990 : compte retiré    → jamais comptés
const base = () => ({
  A: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/A1', keys: {} }],
    comptes: [{ vinted_user_id: '683', login: 'compte_683' }, { vinted_user_id: '606', login: 'compte_606' }],
    main: { vinted_sales_hidden: ['905'], vinted_accounts_hidden: [], vinted_ship_done: { 904: MATIN - 86400000 }, vinted_bords_shipped: {},
      vinted_bords_printed: { 901: '2026-10-20T10:31:05.111Z' }, vinted_bords_hidden: {}, vrm_widget_token: 'tokA', vinted_pickup_done: {} },
    ventes: {
      683: { txns: ['901', '902', '904', '905'], orders: [vente(901, '2026-10-15T22:49:32Z'), vente(902, '2026-10-14T05:00:00Z'), vente(904, '2026-10-14T06:00:00Z'), vente(905, '2026-10-14T07:00:00Z')] },
      606: { txns: ['903', '906'], orders: [vente(903, '2026-10-15T09:00:00Z', 'Le paiement a été validé'), vente(906, '2026-10-21T22:08:37Z', 'Le paiement a été validé')] },
      999: { txns: ['990'], orders: [vente(990, '2026-10-13T08:00:00Z')] },
    },
    bords: [bord(901, '23/10/2026 10 h 00'), bord(902, '22/10/2026 07 h 00'), bord(904, '21/10/2026 10 h 00'), bord(905, '21/10/2026 10 h 00'), bord(990, '20/10/2026 10 h 00')],
  },
});

let V, memos, ecrits, pannes;
const reset = () => { V = base(); memos = {}; ecrits = []; pannes = new Set(); pushes.length = 0; };
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
// §6.3 : la projection `select=` est appliquée pour de vrai (alias:data->x->>y).
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/);
    const b = morceaux.shift();
    let v = b === 'meta' ? (ligne.meta || ligne.data) : b === 'data' ? ligne.data : ligne[b];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const lignesDe = (o) => {
  const v = V[o]; if (!v) return [];
  const L = [{ id: 'main', data: v.main }];
  for (const [uid, x] of Object.entries(v.ventes)) L.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(MATIN - 3600000), payload: { my_orders: x.orders }, resume: { txns: x.txns } } });
  for (const b of v.bords) L.push(b);
  L.push({ id: 'harvest_683_orders_purchased', data: { payload: { my_orders: [] }, resume: { txns: [] } } });
  L.push({ id: 'ebay_orders', data: { orders: [] } });
  L.push({ id: 'push_subs', data: { subs: v.subs } });
  for (const [id, data] of Object.entries(memos[o] || {})) L.push({ id, data });
  return L;
};
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q), dans = /(?:^|&)id=in\.\(([^)]*)\)/.exec(q);
  if (eq) return id === eq[1];
  if (dans) return dans[1].split(',').map((x) => x.replace(/^"|"$/g, '')).includes(id);
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (m === 'POST' && table === 'app_data') {
    for (const l of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: l.id, owner: l.owner || null, data: l.data });
      if (pannes.has(`ecrire:${l.owner}:${l.id}`)) return rep('<html>522</html>', 522);
      (memos[l.owner] = memos[l.owner] || {})[l.id] = l.data;
    }
    return rep('', 201);
  }
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.keys(V).map((o) => projette({ owner: o, id: 'main', data: V[o].main }, select)));
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  for (const p of pannes) { const [o, motif] = p.split(':'); if (o === own && (table + '?' + q).includes(motif)) return rep('<html>522</html>', 522); }
  if (table === 'vinted_accounts') return rep((V[own] ? V[own].comptes : []).map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  return rep(lignesDe(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  let cron, widget, L;
  try { cron = (await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'))).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  try { L = await import('file://' + path.join(RACINE, 'api', '_lib', 'limite-envoi.js')); } catch (e) { dit(false, 'api/_lib/limite-envoi.js (la règle de la date limite) existe et se charge', e.message.split('\n')[0]); }
  const lancer = async (t, query = {}) => { Date.now = () => t; try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-audit-colis-heure' }, query }, r); return r; } finally { Date.now = vraiNow; } };
  const appelerWidget = async (t) => { Date.now = () => t; try { const r = res(); await widget({ method: 'GET', headers: {}, query: { k: 'tokA' } }, r); return r; } finally { Date.now = vraiNow; } };
  const bilanA = (r) => (r && r.corps && Array.isArray(r.corps.bilans) ? r.corps.bilans.find((x) => x.owner === 'A') : null) || {};
  const matinDe = () => pushes.filter((p) => p.tag === 'ship-reminder');

  console.log('── 1. Le rappel du matin (22 oct., 7 h 10 à Paris)');
  await essaie('matin', async () => {
    reset();
    const r = await lancer(MATIN);
    const b = bilanA(r), p = matinDe()[0] || {};
    console.log(`     sur le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(b.total === 3, 'le matin compte 3 colis pressés : l’imprimé non parti, la vente sans email, celui de 7 h', `total=${b.total} · ${JSON.stringify({ o: b.overdue, a: b.dueToday, d: b.dueTomorrow, skip: b.skipped || b.vintedSkip })}`);
    dit(b.dueTomorrow === 1 && /1 demain avant 10 h/.test(p.body || ''), 'le colis IMPRIMÉ mais pas parti est compté — « 1 demain avant 10 h » (l’heure lue dans l’email)', p.body);
    dit(b.dueToday === 1 && /Date estimée pour 1/.test(p.body || ''), 'la vente SANS email de bordereau est comptée (vente + 7 j), et dite estimée', p.body);
    dit(b.overdue === 1 && /1 en retard/.test(p.body || '') && /^⏰/.test(p.title || ''), 'la limite « aujourd’hui 7 h 00 » est EN RETARD à 7 h 10 (le retard compte à partir de l’heure)', `${p.title} / overdue=${b.overdue}`);
    dit(matinDe().length === 1 && p.url === '/?tab=cat_bord', 'UNE notification, qui ouvre Colis', `${matinDe().length} · ${p.url}`);
  });

  console.log('\n── 2. Le widget : les mêmes échéances, à la même heure');
  await essaie('widget', async () => {
    reset();
    const w = await appelerWidget(MATIN);
    const s = (w.corps && w.corps.ship) || {};
    dit(w.code === 200 && s.total === 4, 'le widget : 4 colis à expédier (ni le coché « posté », ni la masquée, ni le compte retiré)', `HTTP ${w.code} · total=${s.total}`);
    dit(s.overdue === 1 && s.today === 1 && s.tomorrow === 1, 'le widget : 1 en retard · 1 aujourd’hui · 1 demain — comme le matin (l’imprimé et la vente sans email comptent)', JSON.stringify({ o: s.overdue, a: s.today, d: s.tomorrow }));
    dit(s.heureDemain === '10:00', 'le widget rend l’heure limite de demain (« 10:00 »)', String(s.heureDemain));
  });

  console.log('\n── 3. Le soir (22 oct., 20 h 05) : la même règle');
  await essaie('soir', async () => {
    reset();
    await lancer(SOIR, { moment: 'soir' });
    const p = pushes.find((x) => /^soir-/.test(x.tag || '')) || {};
    console.log(`     sur le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(/Demain : 4 colis à poster/.test(p.title || ''), 'le soir : « Demain : 4 colis à poster »', p.title);
    dit(/2 déjà en retard/.test(p.body || '') && /1 avec la date limite demain à 10 h/.test(p.body || ''), 'le « dont » : 2 déjà en retard (dont la vente sans email), 1 avant demain 10 h — l’heure écrite', p.body);
  });

  console.log('\n── 4. Heure illisible : le jour seul, comme avant');
  await essaie('jour seul', async () => {
    reset();
    V.A.bords = [bord(901, '23/10/2026'), bord(902, '22/10/2026')];
    const r = await lancer(MATIN);
    const b = bilanA(r), p = matinDe()[0] || {};
    dit(b.overdue === 0 && b.dueToday === 2 && b.dueTomorrow === 1, 'sans heure : « aujourd’hui » reste aujourd’hui jusqu’au soir (jamais un retard inventé)', JSON.stringify({ o: b.overdue, a: b.dueToday, d: b.dueTomorrow }));
    dit(!/avant \d/.test(p.body || ''), 'sans heure lue, aucune heure n’est écrite', p.body);
  });

  console.log('\n── 5. « Pas su » se tait');
  await essaie('bordereaux illisibles', async () => {
    reset(); pannes.add('A:email_bord');
    const r = await lancer(MATIN);
    dit(matinDe().length === 0 && !ecrits.some((e) => e.id === 'ship_reminder_dedup'), 'bordereaux illisibles ⇒ aucun envoi, aucun mémo (une date estimée ne remplace pas une heure qu’on n’a pas lue)', JSON.stringify(bilanA(r)).slice(0, 160));
  });
  await essaie('ventes illisibles', async () => {
    reset(); pannes.add('A:orders_sold');
    await lancer(MATIN);
    dit(matinDe().length === 0 && !ecrits.some((e) => e.id === 'ship_reminder_dedup'), 'ventes Vinted illisibles ⇒ aucun envoi, aucun mémo (jamais « 0 »)');
  });
  await essaie('widget, ventes à dater illisibles', async () => {
    reset(); pannes.add('A:id=in.');
    const w = await appelerWidget(MATIN);
    const s = (w.corps && w.corps.ship) || {};
    dit(w.code === 200 && s.datesPasSu === true && s.sansLimite === 2 && s.today === 0, 'widget : les dates de vente illisibles ⇒ ces ventes ne sont classées nulle part (dit), jamais une date inventée', JSON.stringify({ code: w.code, datesPasSu: s.datesPasSu, sansLimite: s.sansLimite, today: s.today }));
  });

  console.log('\n── 6. Le cron du matin, avancé (pas de cron de plus)');
  await essaie('vercel.json', async () => {
    const vj = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
    const crons = Array.isArray(vj.crons) ? vj.crons : [];
    const matin = crons.find((c) => c.path === '/api/ship-reminders');
    const h = matin ? +String(matin.schedule).split(' ')[1] : NaN;
    dit(crons.length === 2 && !!matin && /^0 \d+ \* \* \*$/.test(matin.schedule) && h >= 4 && h <= 6, 'le rappel du matin part entre 6 h et 8 h à Paris (05:00 UTC), deux crons au total', JSON.stringify(crons));
  });

  console.log('\n── 7. Une règle : le module, et ceux qui le lisent');
  await essaie('module', async () => {
    if (!L) throw new Error('module absent');
    const a = L.lireDateLimite('23/10/2026 10 h 00'), b = L.lireDateLimite('26/10/2026 10 h 00'), c = L.lireDateLimite('23/10/2026'), d = L.lireDateLimite('29/03/2026 02 h 30');
    dit(a && a.heure === '10:00' && iso(a.at) === '2026-10-23T08:00:00.000Z', '« 23/10/2026 10 h 00 » = 10 h à Paris (heure d’été, 08:00 UTC)', a && iso(a.at));
    dit(b && iso(b.at) === '2026-10-26T09:00:00.000Z', '« 26/10/2026 10 h 00 » = 10 h à Paris après le passage à l’heure d’hiver (09:00 UTC)', b && iso(b.at));
    dit(c && c.heure === null && iso(c.at) === '2026-10-23T21:59:59.999Z', 'sans heure : la fin de ce jour à Paris', c && iso(c.at));
    dit(d && d.heure === null, 'une heure qui n’existe pas (nuit du passage à l’heure d’été) ⇒ le jour seul, jamais une heure devinée', JSON.stringify(d));
    const t = L.texteLimiteEnvoi(a, MATIN);
    dit(t === 'à poster avant demain 10 h', 'la ligne du colis : « à poster avant demain 10 h »', t);
  });
  await essaie('lecteurs', async () => {
    const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
    const app = lire('src/App.jsx'), matin = lire('api/ship-reminders.js'), wid = lire('api/widget.js');
    const imp = (src, nom) => new RegExp(`import\\s*\\{[^}]*\\b${nom}\\b[^}]*\\}\\s*from\\s*['"][./]*(?:api/)?_lib/limite-envoi\\.js['"]`).test(src);
    dit(imp(app, 'limiteExpedition') && !/\n\s*const\s+limiteExpedition\s*=/.test(app), 'l’app prend `limiteExpedition` dans api/_lib/limite-envoi.js et n’en a pas de seconde', '');
    dit(imp(matin, 'compterEcheances') && imp(wid, 'compterEcheances'), 'le rappel (matin et soir) et le widget comptent avec la MÊME fonction', '');
  });

  console.log(ko ? `\n❌ colis à l’heure : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ colis à l’heure : tout est vert (${ok})`);
  process.exit(ko ? 1 : 0);
})();
