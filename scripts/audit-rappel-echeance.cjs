// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE RAPPEL URSSAF LA VEILLE DE L'ÉCHÉANCE (13 nov., point 17 de Julien)
//         node scripts/audit-rappel-echeance.cjs [--mutation=…]
// ═══════════════════════════════════════════════════════════════════════════
// Remplace l'audit du rappel « 3 jours ou moins » (29 oct.). Exécute :
//   A. la VRAIE règle du serveur (`rappelVeilleUrssaf`, api/_lib/rappel-urssaf.js)
//      sur des dates et une ligne publiée INVENTÉES : la veille seulement (et le
//      jour même si la veille est manquée), « Demain : déclaration URSSAF · X € à
//      déclarer », le montant = celui de la carte « Déclarer » (`previsionUrssaf`,
//      la même règle que la carte où vit « Copier »), « au moins » si partiel,
//      rien pour un statut pas micro, un rythme pas choisi, une période notée
//      « déclarée », des réglages illisibles ; jamais « encaissé ».
//   B. le VRAI cron (api/ship-reminders.js) sur une fausse base qui GARDE ses
//      écritures, faux Web Push : une notification la veille, famille « Rappels »,
//      qui ouvre Argent → Déclarer ; une seule fois par échéance (deux passages,
//      puis le jour même) ; rien pendant les heures calmes (rangée dans la cloche) ;
//      rien si les rappels sont coupés ou la période notée ; aucun montant dans la
//      réponse du cron.
// `--mutation=j3|declare|rythme|dedup|famille` réaffaiblit la règle dans une COPIE
// (jamais le dépôt) : chaque mutation doit faire passer un contrôle au rouge.
// Aucune donnée réelle : tout est inventé ici.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
process.env.VRM_NOTIF_FENETRE = '0';

let API = path.join(R, 'api'), SRC = path.join(R, 'src');
if (MUT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-veille-'));
  fs.cpSync(API, path.join(tmp, 'api'), { recursive: true });
  fs.cpSync(SRC, path.join(tmp, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'public', 'legal'), path.join(tmp, 'public', 'legal'), { recursive: true });
  fs.copyFileSync(path.join(R, 'package.json'), path.join(tmp, 'package.json'));
  fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules'));
  API = path.join(tmp, 'api'); SRC = path.join(tmp, 'src');
  const muter = (f, a, b) => { let g = fs.readFileSync(f, 'utf8'); if (!g.includes(a)) { console.log('❌ mutation impossible : motif absent — ' + a.slice(0, 60)); process.exit(2); } fs.writeFileSync(f, g.replace(a, b)); };
  const regle = path.join(API, '_lib', 'rappel-urssaf.js'), cron = path.join(API, 'ship-reminders.js');
  if (MUT === 'j3') muter(regle, 'if (P.daysLeft !== 1 && P.daysLeft !== 0)', 'if (P.daysLeft > 3 || P.daysLeft < 0)');
  else if (MUT === 'declare') muter(regle, 'declare: objet(mm.vrm_urssaf_declare), taux', 'declare: {}, taux');
  else if (MUT === 'rythme') muter(regle, 'const rythme = mm.vinted_urssaf_freq;', "const rythme = mm.vinted_urssaf_freq || 'trimestriel';");
  else if (MUT === 'dedup') muter(cron, "if (deja && deja.veilleEcheance === n.cle) urssaf", 'if (false) urssaf');
  else if (MUT === 'famille') muter(cron, "sendPushToAll({ cat: 'urssaf', title: n.titre, body: n.corps, tag: 'urssaf-veille-'", "sendPushToAll({ cat: 'doublevente', title: n.titre, body: n.corps, tag: 'urssaf-veille-'");
  else { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  if (MUT === 'dedup') muter(cron, '(d) => !!d && d.veilleEcheance === n.cle, (d)', '(d) => false, (d)');
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const sp = (s) => String(s == null ? '' : s).replace(/[  ]/g, ' ');

(async () => {
  let regle = null, miroir = null, prev = null;
  try {
    regle = await import('file://' + path.join(API, '_lib', 'rappel-urssaf.js'));
    miroir = await import('file://' + path.join(API, '_lib', 'urssaf-regle.js'));
    prev = await import('file://' + path.join(SRC, 'previsionUrssaf.js'));
  } catch (e) { dit(false, 'la règle se charge', String(e.message || e).slice(0, 160)); }
  const V = regle && regle.rappelVeilleUrssaf;
  dit(typeof V === 'function', 'la règle `rappelVeilleUrssaf` existe (api/_lib/rappel-urssaf.js)');
  if (typeof V !== 'function') { console.log(`\n❌ audit-rappel-echeance : ${ko} rouge(s)`); process.exit(1); }

  // Octobre se déclare jusqu'au 30 novembre (mensuel). Ligne publiée le 1er novembre au matin.
  const PUB = { at: Date.parse('2026-11-01T06:00:00Z'), mois: [{ ym: '2026-09', ca: 4508.9, n: 92 }, { ym: '2026-10', ca: 2927.47, n: 52 }, { ym: '2026-11', ca: 867.4, n: 14 }], aDater: { n: 0 } };
  const M = (x = {}) => ({ vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vinted_urssaf_taux: '13,4', vinted_urssaf_mois: PUB, vrm_urssaf_declare: { '2026-09': { ids: ['v:1'], at: 1 } }, ...x });
  // La carte « Déclarer » (la même règle, les mêmes règles d'argent) : son montant à côté de « Copier ».
  const carte = (main, today) => { const [y, m, d] = today.split('-').map(Number); return prev.previsionUrssaf({ regime: main.vinted_regime, rythme: main.vinted_urssaf_freq, now: new Date(y, m - 1, d, 12), ligne: main.vinted_urssaf_mois, declare: main.vrm_urssaf_declare || {}, taux: miroir.tauxDe(main.vinted_urssaf_taux), regle: miroir }); };

  console.log('── A. La règle (pure)');
  const v29 = V({ today: '2026-11-29', main: M() });
  dit(v29.envoyer, '29 nov., veille du 30 : la notification part', v29.raison);
  dit(sp(v29.titre) === 'Demain : déclaration URSSAF · 2927,47 € à déclarer', 'le titre : « Demain : déclaration URSSAF · 2927,47 € à déclarer »', sp(v29.titre));
  const c29 = carte(M(), '2026-11-29');
  dit(c29.etat === 'lu' && !c29.enCours && v29.montant === c29.ca, 'le montant est CELUI de la carte « Déclarer » (où vit « Copier »), au centime', `${v29.montant} / ${c29.ca}`);
  dit(v29.cle === '2026-11-30:2026-10', 'la clé = l’identité de l’échéance (date + mois)', v29.cle);
  dit(v29.url === '/?tab=compta&section=declarer&cible=urssaf', 'le toucher ouvre Argent → « Déclarer », la section URSSAF en évidence', v29.url);
  dit(/cotisations ≈ 392,28 €/.test(sp(v29.corps)) && /copier le montant/.test(v29.corps), 'le corps : la période, la date, les cotisations (13,4 %), « copier le montant »', sp(v29.corps));
  for (const j of ['2026-11-01', '2026-11-20', '2026-11-27', '2026-11-28']) dit(!V({ today: j, main: M() }).envoyer, `${j} : rien (pas encore la veille)`);
  const v30 = V({ today: '2026-11-30', main: M() });
  dit(v30.envoyer && /^Aujourd'hui : déclaration URSSAF/.test(v30.titre) && v30.cle === v29.cle, "30 nov. (veille manquée) : « Aujourd'hui », même clé — une fois par échéance au total", sp(v30.titre));
  dit(!V({ today: '2026-12-01', main: M() }).envoyer, '1er déc. : rien (la notification du 1er est l’autre)');
  const vp = V({ today: '2026-11-29', main: M({ vinted_urssaf_mois: { ...PUB, aDater: { n: 3 } } }) });
  dit(vp.envoyer && sp(vp.titre) === 'Demain : déclaration URSSAF · au moins 2927,47 € à déclarer' && /3 ventes pas encore datées/.test(vp.corps), 'ventes sans date de versement : « au moins », le manque nommé', sp(vp.titre) + ' | ' + sp(vp.corps));
  const vt = V({ today: '2026-11-29', main: M({ vinted_urssaf_mois: { ...PUB, at: Date.parse('2026-10-25T10:00:00Z') } }) });
  dit(vt.envoyer && /au moins 2927,47/.test(sp(vt.titre)) && vt.partiel, 'ligne publiée le 25 oct. (avant la fin d’octobre) : « au moins » (les ventes versées depuis n’y sont pas)', sp(vt.titre));
  dit(!V({ today: '2026-11-29', main: M({ vrm_urssaf_declare: { '2026-09': { ids: [] }, '2026-10': { ids: ['v:2'] } } }) }).envoyer, 'octobre noté « déclaré » : rien');
  const sansFreq = M(); delete sansFreq.vinted_urssaf_freq;
  dit(!V({ today: '2026-11-29', main: sansFreq }).envoyer, 'rythme jamais choisi : rien (jamais « trimestriel » deviné)');
  dit(!V({ today: '2026-10-30', main: sansFreq }).envoyer, 'rythme jamais choisi, veille d’une échéance trimestrielle : rien');
  for (const [r, nom] of [[undefined, 'jamais choisi'], ['particulier', 'particulier'], ['societe', 'société'], ['marge', 'régime de la marge']]) {
    const x = M({ vinted_regime: r }); if (r === undefined) delete x.vinted_regime;
    dit(!V({ today: '2026-11-29', main: x }).envoyer, `statut ${nom} : rien`);
  }
  dit(!V({ today: '2026-11-29', main: undefined }).envoyer && !V({ today: '2026-11-29', main: null }).envoyer, 'réglages illisibles : rien');
  const vs = V({ today: '2026-11-29', main: M({ vinted_urssaf_mois: undefined }) });
  dit(vs.envoyer && vs.montant == null && sp(vs.titre) === 'Demain : déclaration URSSAF' && !/0,00/.test(vs.titre + vs.corps), 'jamais publiée : le rappel SANS montant (jamais 0)', sp(vs.titre));
  // Trimestriel : T3 jusqu'au 31 octobre ; un mois déjà noté n'est pas recompté.
  const T = (x = {}) => M({ vinted_urssaf_freq: 'trimestriel', vinted_urssaf_mois: { at: Date.parse('2026-10-01T06:00:00Z'), mois: [{ ym: '2026-07', ca: 100 }, { ym: '2026-08', ca: 200 }, { ym: '2026-09', ca: 300 }] }, vrm_urssaf_declare: {}, ...x });
  const t30 = V({ today: '2026-10-30', main: T() });
  dit(t30.envoyer && sp(t30.titre) === 'Demain : déclaration URSSAF · 600,00 € à déclarer' && t30.cle === '2026-10-31:2026-07+2026-08+2026-09', 'trimestriel, 30 oct. : T3, 600,00 € à déclarer', sp(t30.titre) + ' ' + t30.cle);
  const t30b = V({ today: '2026-10-30', main: T({ vrm_urssaf_declare: { '2026-08': { ids: [] } } }) });
  dit(t30b.envoyer && /400,00 €/.test(sp(t30b.titre)), 'août déjà noté : 400,00 € (juillet + septembre), comme la carte', sp(t30b.titre));
  dit(!V({ today: '2026-10-30', main: T({ vrm_urssaf_declare: { '2026-07': { ids: [] }, '2026-08': { ids: [] }, '2026-09': { ids: [] } } }) }).envoyer, 'T3 noté en entier : rien');
  const tout = [v29, v30, vp, vs, t30, t30b].map((x) => x.titre + ' ' + x.corps + ' ' + x.raison).join(' ');
  dit(!/encaiss/i.test(tout), 'jamais « encaissé »');

  // ── B. Le vrai cron, une fausse base qui garde ses écritures ──────────────
  console.log('\n── B. Le vrai cron (api/ship-reminders.js), faux Web Push');
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-audit';
  process.env.CRON_SECRET = 'cle-audit-veille';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  let DB = new Map();
  const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  const chemin = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
  const projette = (ligne, select) => {
    if (!select || select === '*') return ligne;
    const out = {};
    for (const item of select.split(',')) {
      const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
      const mor = expr.split(/->>?/); const base = mor.shift();
      let v = base === 'data' ? ligne.data : ligne[base];
      if (mor.length) v = chemin(v, mor);
      if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
      out[alias] = v === undefined ? null : v;
    }
    return out;
  };
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url)), m = (opts.method || 'GET').toUpperCase();
    if (!u.includes('/rest/v1/')) return rep({}, 404);
    const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
    if (table !== 'app_data') return m === 'GET' ? rep([]) : rep('', 201);
    const id = (/(?:^|&)id=eq\.([^&]+)/.exec(q) || [])[1] || null;
    if (m === 'POST') { try { for (const l of [].concat(JSON.parse(opts.body || '[]'))) if (l && l.id) DB.set(l.id, l.data); } catch (_) {} return rep('', 201); }
    if (m === 'PATCH') { try { const b = JSON.parse(opts.body || '{}'); if (id && b && b.data) DB.set(id, b.data); } catch (_) {} return rep(id ? [{ id }] : []); }
    if (m === 'DELETE') { if (id) DB.delete(id); return rep([]); }
    if (/select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
    if (id === 'main' && !/owner=eq\./.test(q)) return rep([{ owner: 'A' }]);
    if (!/owner=eq\.A/.test(q)) return rep([]);
    const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
    if (id) return rep(DB.has(id) ? [projette({ id, owner: 'A', data: DB.get(id) }, select)] : []);
    return rep([]);
  };
  let cron = null;
  try { cron = (await import('file://' + path.join(API, 'ship-reminders.js'))).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e.message || e).slice(0, 160)); }
  const vraiNow = Date.now;
  const nouvelleBase = (main, prefs) => { DB = new Map([['main', main], ['push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/A1', keys: {} }] }]]); if (prefs) DB.set('push_prefs', prefs); };
  const lancer = async (iso) => {
    pushes.length = 0; Date.now = () => Date.parse(iso); process.env.VRM_NOTIF_HORLOGE = iso;
    try {
      const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
      await cron({ method: 'GET', headers: { authorization: 'Bearer cle-audit-veille' }, query: {} }, res);
      return res;
    } finally { Date.now = vraiNow; }
  };
  const veilles = () => pushes.filter((p) => /^urssaf-veille-/.test(p.tag || '') || /déclaration URSSAF/.test(p.title || ''));
  const journal = () => { const j = DB.get('push_journal'); return (j && Array.isArray(j.entrees) ? j.entrees : []).filter((e) => /déclaration URSSAF/.test(e.titre || '')); };
  if (cron) {
    nouvelleBase(M());
    const r1 = await lancer('2026-11-29T09:10:00Z');   // 10 h 10 à Paris : hors heures calmes
    const u = veilles();
    dit(u.length === 1, 'la veille, 10 h 10 : UNE notification URSSAF part', `${u.length} · ${JSON.stringify(r1.corps && r1.corps.urssaf)}`);
    // La forme de toutes les notifications (api/_lib/notif-belle.js, 8 nov.) : un titre ≤ 40 caractères, ce qui suit « · » descend en tête du corps.
    dit(!!(u[0] && sp(u[0].title) === 'Demain : déclaration URSSAF' && /^2927,47 € à déclarer · Octobre 2026/.test(sp(u[0].body))), 'sur le téléphone : « Demain : déclaration URSSAF » / « 2927,47 € à déclarer · … » (la forme de notif-belle)', u[0] && sp(u[0].title + ' | ' + u[0].body));
    dit(!!(u[0] && Array.isArray(u[0].actions) && u[0].actions.some((a) => a.title === 'Déclarer' && /section=declarer/.test(a.url))), 'son geste « Déclarer » mène au même écran', u[0] && JSON.stringify(u[0].actions));
    dit(!!(u[0] && /^\/\?tab=compta&section=declarer&cible=urssaf/.test(u[0].url || '')), 'elle ouvre Argent → « Déclarer » (où vit « Copier »)', u[0] && u[0].url);
    const memo = DB.get('urssaf_reminder_dedup');
    dit(!!(memo && memo.veilleEcheance === '2026-11-30:2026-10'), 'le mémo garde l’identité de l’échéance', JSON.stringify(memo));
    const j = journal();
    dit(j.length === 1 && j[0].famille === 'rappels', 'rangée dans la cloche, famille « Rappels »', JSON.stringify(j.map((e) => [e.famille, e.etat])));
    const corps = JSON.stringify(r1.corps || {});
    dit(!/€|2927|392/.test(corps), 'la réponse du cron ne porte AUCUN montant', corps.slice(0, 160));
    await lancer('2026-11-29T15:10:00Z');
    dit(veilles().length === 0, 'second passage le même jour : rien (une fois par échéance)', `${veilles().length}`);
    await lancer('2026-11-30T09:10:00Z');
    dit(veilles().length === 0, 'le jour même, déjà rappelée la veille : rien', `${veilles().length}`);

    nouvelleBase(M());
    await lancer('2026-11-30T09:10:00Z');
    dit(veilles().length === 1 && /^Aujourd'hui/.test(veilles()[0].title), 'veille manquée : le jour même, « Aujourd’hui », une fois', `${veilles().length}`);

    nouvelleBase(M());
    await lancer('2026-11-28T09:10:00Z');
    dit(veilles().length === 0 && !DB.has('urssaf_reminder_dedup'), '28 nov. : rien, aucun mémo');

    nouvelleBase(M());
    await lancer('2026-11-29T05:00:00Z');   // 6 h à Paris : le passage du cron, dans les heures calmes par défaut
    const jc = journal();
    dit(veilles().length === 0 && jc.length === 1 && jc[0].etat === 'calme', 'heures calmes (6 h à Paris) : rien ne sonne, rangée « calme » dans la cloche (dite au réveil)', `${veilles().length} envoi(s) · ${JSON.stringify(jc.map((e) => e.etat))}`);

    nouvelleBase(M(), { familles: { rappels: false } });
    await lancer('2026-11-29T09:10:00Z');
    dit(veilles().length === 0 && journal().length === 0 && !DB.has('urssaf_reminder_dedup'), 'famille « Rappels » coupée : rien, aucun mémo');

    nouvelleBase(M({ vrm_urssaf_declare: { '2026-09': { ids: [] }, '2026-10': { ids: ['v:2'] } } }));
    await lancer('2026-11-29T09:10:00Z');
    dit(veilles().length === 0, 'octobre noté « déclaré » : rien');

    const sf = M(); delete sf.vinted_urssaf_freq; nouvelleBase(sf);
    await lancer('2026-11-29T09:10:00Z');
    dit(veilles().length === 0, 'rythme pas choisi : rien');
  }
  console.log(ko ? `\n❌ audit-rappel-echeance : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-rappel-echeance : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
