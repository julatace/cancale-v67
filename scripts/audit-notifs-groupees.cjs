#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — NOTIFICATIONS GROUPÉES (11 nov., lot `notifs-groupees`)
// ════════════════════════════════════════════════════════════════════════════
// Au lieu de plusieurs alertes, UN résumé (« 1 colis à poster · 1 colis à
// retirer ») ; l'urgent tout de suite, une seule fois ; jamais deux fois la même
// chose (objet + jour) ; heures calmes respectées ; chaque notification ouvre
// l'écran exact (Ventes « À expédier », Achats « À retirer », jamais Colis).
// EXÉCUTE la vraie porte d'envoi (`api/_lib/push.js`) et la VRAIE route
// (`api/ship-reminders.js`, `?moment=groupe` et `?moment=soir`) contre une fausse
// base (app_data owner/id/data, comparer-et-échanger sur `rev`, filtres `data->>`,
// pagination `Range`), téléphones interceptés, horloge de Paris simulée.
//   G  la fenêtre : la 1re sonne, les suivantes attendent, UN résumé à la fin
//   U  l'urgent (échéance < 24 h, double vente) sonne tout de suite
//   I  idempotence : même objet le même jour ⇒ rien ; le lendemain ⇒ oui
//   L  la fenêtre libre : ce qui attendait part AVEC la suivante (un seul son)
//   Q  heures calmes : rien ne sonne, les entrées passent « heures calmes »
//   P  réglages : Non (chaque notification seule), 1 h, heure du résumé du soir
//   E  l'écran exact : Ventes / Achats, jamais `cat_bord`
// `--sur <dossier>` : juge un autre arbre (le code d'avant). Données inventées.
'use strict';
const path = require('path');
const iSur = process.argv.indexOf('--sur');
const R = iSur > 0 ? path.resolve(process.argv[iSur + 1]) : path.join(__dirname, '..');
const NM = path.join(__dirname, '..', 'node_modules');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };
const J = '11111111-1111-4111-8111-111111111111';

// ── La fausse base ─────────────────────────────────────────────────────────
let base = new Map();
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const champ = (d, chemin) => chemin.split('->').reduce((x, c) => (x && typeof x === 'object' ? x[c.replace(/^>/, '')] : undefined), d);
const filtresData = (q) => [...q.entries()].filter(([c]) => c.startsWith('data->'));
const passe = (d, filtres) => filtres.every(([c, v]) => {
  const x = champ(d, c.replace(/^data->>?/, '').replace(/->>/g, '->'));
  const m = /^(eq|lte|lt|gte|gt|is)\.(.*)$/.exec(v); if (!m) return true;
  const [, op, val] = m;
  if (op === 'is') return val === 'null' ? x == null : true;
  if (x == null) return false;
  const s = String(x);
  return op === 'eq' ? s === val : op === 'lte' ? s <= val : op === 'lt' ? s < val : op === 'gte' ? s >= val : s > val;
});
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
  if (u.pathname.includes('/rpc/')) return rep(true);
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, ''); const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (m === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    const fd = filtresData(q).filter(([c]) => c !== 'data->>rev');
    const sel = q.get('select') || '';
    const lignes = [...base.entries()].map(([kk, d]) => { const [o2, i2] = kk.split('|'); return { owner: o2, id: i2, data: d }; })
      .filter((l) => (!id || l.id === id) && (!owner || l.owner === owner) && passe(l.data, fd));
    if (!id) return rep([]);
    if (sel === 'owner') return rep(lignes.map((l) => ({ owner: l.owner })));
    if (sel === 'data' || sel === 'id,data') return rep(lignes.map((l) => ({ id: l.id, data: l.data })));
    return rep(lignes.map((l) => ({ id: l.id, data: l.data, owner: l.owner })));
  }
  if (m === 'POST') {
    let ls; try { ls = JSON.parse(o.body || '[]'); } catch (_) { return rep([], 201); }
    if (!Array.isArray(ls)) ls = [ls];
    const ign = /ignore-duplicates/.test(((o.headers || {}).Prefer) || ''); const out = [];
    for (const l of ls) { if (!l || !l.id) continue; const kk = k(l.owner || owner || J, l.id); if (ign && base.has(kk)) continue; base.set(kk, JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id }); }
    return rep(out, 201);
  }
  if (m === 'PATCH') {
    const kk = k(owner, id); if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk); const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(kk, JSON.parse(o.body).data); return rep([{ id }]);
  }
  if (m === 'DELETE') return rep([]);
  return rep([]);
};
const pushes = [];
const TEL = 'https://web.push.apple.com/iphone-banc';
const prepare = (prefs = null) => {
  base = new Map(); pushes.length = 0;
  base.set(k(J, 'main'), { vinted_accounts: [] });
  base.set(k(J, 'push_subs'), { subs: [{ endpoint: TEL, keys: { p256dh: 'x', auth: 'y' } }] });
  if (prefs) base.set(k(J, 'push_prefs'), prefs);
  base.set(k(J, 'push_journal_lu'), {});
};
const journal = () => (base.get(k(J, 'push_journal')) || { entrees: [] });
const etats = () => journal().entrees.map((e) => `${e.genre || e.cat}:${e.etat}`).reverse().join(',');
// Un instant de Paris (heure locale hh:mm) du jour `jours`, en ISO.
const parisA = (hh, mm = 0, jours = 0) => {
  const now = Date.now() + jours * 864e5;
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  for (const dec of [1, 2]) { const t = Date.parse(`${jour}T${String((hh - dec + 24) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`); const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)); if (p === `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`) return new Date(t).toISOString(); }
  return null;
};
const plus = (iso, min) => new Date(Date.parse(iso) + min * 60e3).toISOString();

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.CRON_SECRET = 'secret-de-banc';
  delete process.env.VRM_NOTIF_FENETRE;           // ce banc juge LA fenêtre
  const webpush = require(path.join(NM, 'web-push'));
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const L = await import('file://' + path.join(R, 'api', '_lib', 'lien-notif.js'));
  const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
  const route = (await import('file://' + path.join(R, 'api', 'ship-reminders.js'))).default;
  const comme = (f) => { P.oublierPrefsVues(); return contexteVendeur.run({ owner: J }, f); };
  const aHeure = async (iso, f) => { const av = process.env.VRM_NOTIF_HORLOGE; process.env.VRM_NOTIF_HORLOGE = iso; try { return await f(); } finally { if (av === undefined) delete process.env.VRM_NOTIF_HORLOGE; else process.env.VRM_NOTIF_HORLOGE = av; } };
  const appeler = async (moment) => {
    let code = 0, corps = null;
    const res = { setHeader() {}, status(c) { code = c; return this; }, json(j) { corps = j; return this; }, end() { return this; } };
    P.oublierPrefsVues();
    await route({ method: 'GET', query: { moment }, headers: { authorization: 'Bearer secret-de-banc' } }, res);
    return { code, corps: corps || {} };
  };
  const BORD = (tx) => ({ cat: 'expedier', title: 'Bordereau prêt à imprimer', body: `Air Max de banc — N°1${tx} — à déposer avant le 20/11.`, tag: `bord-${tx}`, url: L.DESTINATIONS.colis({ tx }) });
  const RELAIS = (n, echeance = null) => ({ cat: 'colis', title: 'Ton colis Mondial Relay t’attend', body: `Tabac de banc · code 45460${n}`, tag: `relais-8460332${n}-code`, url: L.DESTINATIONS.retrait({ suivi: `8460332${n}` }), ...(echeance ? { echeance } : {}) });
  const OFFRE = (n) => ({ cat: 'offre', title: 'Offre de 55 €', body: `Air Force de banc ${n}`, tag: `offer-${n}`, url: L.DESTINATIONS.offre({ conv: `77${n}` }) });
  const DV = { cat: 'doublevente', title: 'N°12 vendu sur Vinted', body: 'Encore en ligne sur Leboncoin', tag: 'dv-12', url: L.DESTINATIONS.doublon({ plat: 'leboncoin', num: '12' }) };
  const t0 = parisA(12);

  await essaie('G — la fenêtre', async () => {
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll(BORD('901'))));
    dit(pushes.length === 1 && pushes[0].title === 'Bordereau prêt à imprimer', 'G1 la première sonne tout de suite, telle quelle', `${pushes.length} · ${pushes[0] && pushes[0].title}`);
    const r2 = await aHeure(plus(t0, 2), () => comme(() => P.sendPushToAll(BORD('902'))));
    const r3 = await aHeure(plus(t0, 4), () => comme(() => P.sendPushToAll(RELAIS(1))));
    dit(pushes.length === 1 && r2 && r2.sent === 0 && r3 && r3.sent === 0, 'G2 deux autres, 2 et 4 min après : rien ne sonne', `${pushes.length} sonneries · ${JSON.stringify([r2, r3])}`);
    dit(/bordereau:envoyee,bordereau:attente,arrivee:attente$/.test(etats()), 'G3 la cloche les range « dans le prochain résumé » (attente)', etats());
    dit(journal().attenteJusqua === plus(t0, 15), 'G4 la fenêtre se ferme 15 min après la sonnerie (jamais repoussée)', journal().attenteJusqua);
    const avant = await aHeure(plus(t0, 10), () => appeler('groupe'));
    dit(avant.code === 200 && pushes.length === 1, 'G5 le passage de 15 min AVANT la fin de la fenêtre : rien', `${avant.code} · ${pushes.length}`);
    const apres = await aHeure(plus(t0, 16), () => appeler('groupe'));
    const s = pushes[1] || {};
    dit(apres.code === 200 && pushes.length === 2, 'G6 après la fin de la fenêtre : UNE notification (la route EXÉCUTÉE)', `${apres.code} · ${pushes.length} · ${JSON.stringify(apres.corps).slice(0, 200)}`);
    dit(s.title === '1 colis à poster · 1 colis à retirer', 'G7 elle les dit toutes : « 1 colis à poster · 1 colis à retirer »', s.title);
    dit(/^Dernier : Ton colis Mondial Relay/.test(s.body || ''), 'G8 le corps dit la dernière', s.body);
    dit(s.url === L.DESTINATIONS.colis({}) && Array.isArray(s.actions) && s.actions.length === 2 && s.actions[0].url === L.DESTINATIONS.colis({}) && s.actions[1].url === L.DESTINATIONS.retrait({}),
      'G9 elle ouvre Ventes « À expédier » ; un geste par genre (Achats « À retirer »)', JSON.stringify([s.url, s.actions]));
    dit(/bordereau:envoyee,bordereau:groupee,arrivee:groupee$/.test(etats()) && !journal().attenteJusqua, 'G10 la cloche les dit « dans un résumé » ; la fenêtre est vidée', etats());
    await aHeure(plus(t0, 31), () => appeler('groupe'));
    dit(pushes.length === 2, 'G11 un second passage ne refait rien', String(pushes.length));
  });

  await essaie('U — l’urgent', async () => {
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll(OFFRE('1'))));
    await aHeure(plus(t0, 1), () => comme(() => P.sendPushToAll(RELAIS(2, plus(t0, 5 * 60)))));
    dit(pushes.length === 2 && pushes[1].title === 'Ton colis Mondial Relay t’attend', 'U1 un retrait qui expire dans 5 h sonne tout de suite, même dans la fenêtre', `${pushes.length} · ${pushes[1] && pushes[1].title}`);
    await aHeure(plus(t0, 2), () => comme(() => P.sendPushToAll(DV)));
    dit(pushes.length === 3 && pushes[2].title === 'N°12 vendu sur Vinted', 'U2 la double vente aussi', String(pushes.length));
    await aHeure(plus(t0, 3), () => comme(() => P.sendPushToAll(RELAIS(3, plus(t0, 3 * 24 * 60)))));
    dit(pushes.length === 3, 'U3 une échéance dans 3 jours n’est pas urgente : elle attend', String(pushes.length));
    await aHeure(plus(t0, 4), () => comme(() => P.sendPushToAll(RELAIS(2, plus(t0, 5 * 60)))));
    await aHeure(plus(t0, 5), () => comme(() => P.sendPushToAll(DV)));
    dit(pushes.length === 3, 'U4 l’urgent ne sonne qu’UNE fois (même objet, même jour)', String(pushes.length));
  });

  await essaie('I — jamais deux fois', async () => {
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll(BORD('701'))));
    const n0 = journal().entrees.length;
    const r = await aHeure(plus(t0, 40), () => comme(() => P.sendPushToAll(BORD('701'))));
    dit(pushes.length === 1 && r && r.doublon === true && journal().entrees.length === n0, 'I1 le même bordereau, 40 min après : rien envoyé, rien rangé', `${pushes.length} · ${JSON.stringify(r)} · ${journal().entrees.length}`);
    await aHeure(plus(t0, 41), () => comme(() => P.sendPushToAll({ ...BORD('701'), title: '📦 Bordereau prêt à imprimer' })));
    dit(pushes.length === 1, 'I2 le même fait avec un emoji en plus reste le même (la clé lit le texte propre)', String(pushes.length));
    await aHeure(parisA(12, 0, 1), () => comme(() => P.sendPushToAll(BORD('701'))));
    dit(pushes.length === 2, 'I3 le lendemain, il sonne de nouveau (clé = objet + jour)', String(pushes.length));
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll({ ...BORD('702'), cle: 'colis-702' })));
    await aHeure(plus(t0, 30), () => comme(() => P.sendPushToAll({ ...BORD('702'), title: 'Rappel bordereau', cle: 'colis-702' })));
    dit(pushes.length === 1, 'I4 une clé posée par l’émetteur fait foi (titre différent, même objet)', String(pushes.length));
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll({ cat: 'test', title: 'Essai', body: 'x', tag: 'vrm-test' })));
    await aHeure(plus(t0, 1), () => comme(() => P.sendPushToAll({ cat: 'test', title: 'Essai', body: 'x', tag: 'vrm-test' })));
    dit(pushes.length === 2, 'I5 le bouton d’essai sonne à chaque fois', String(pushes.length));
  });

  await essaie('L — fenêtre libre', async () => {
    prepare();
    await aHeure(t0, () => comme(() => P.sendPushToAll(OFFRE('5'))));
    await aHeure(plus(t0, 3), () => comme(() => P.sendPushToAll(OFFRE('6'))));
    await aHeure(plus(t0, 20), () => comme(() => P.sendPushToAll(BORD('801'))));
    const s = pushes[1] || {};
    dit(pushes.length === 2 && s.title === '1 colis à poster · 1 offre', 'L1 la suivante après la fenêtre emporte ce qui attendait : UN son, « 1 colis à poster · 1 offre »', `${pushes.length} · ${s.title}`);
    dit(/offre:envoyee,offre:groupee,bordereau:envoyee$/.test(etats()), 'L2 rien n’attend plus', etats());
  });

  await essaie('Q — heures calmes', async () => {
    prepare();
    const t = parisA(21, 50);
    await aHeure(t, () => comme(() => P.sendPushToAll(BORD('601'))));
    await aHeure(plus(t, 5), () => comme(() => P.sendPushToAll(BORD('602'))));
    await aHeure(plus(t, 20), () => appeler('groupe'));
    dit(pushes.length === 1, 'Q1 la fenêtre finit à 22 h 05 (heures calmes) : rien ne sonne', String(pushes.length));
    dit(/bordereau:envoyee,bordereau:calme$/.test(etats()) && !journal().attenteJusqua, 'Q2 l’entrée passe « heures calmes » (le récapitulatif du réveil la dira)', etats());
  });

  await essaie('P — réglages', async () => {
    prepare({ regrouper: false });
    await aHeure(t0, () => comme(() => P.sendPushToAll(BORD('501'))));
    await aHeure(plus(t0, 1), () => comme(() => P.sendPushToAll(BORD('502'))));
    dit(pushes.length === 2, 'P1 « Regrouper : Non » ⇒ chaque notification sonne seule', String(pushes.length));
    prepare({ groupe: { fenetre: 60 } });
    await aHeure(t0, () => comme(() => P.sendPushToAll(BORD('511'))));
    await aHeure(plus(t0, 1), () => comme(() => P.sendPushToAll(OFFRE('9'))));
    await aHeure(plus(t0, 20), () => appeler('groupe'));
    const n1 = pushes.length;
    await aHeure(plus(t0, 62), () => appeler('groupe'));
    dit(n1 === 1 && pushes.length === 2 && pushes[1].title === 'Offre de 55 €', 'P2 « 1 h » : rien à +20 min, la seule en attente sonne telle quelle à +62 min', `${n1} puis ${pushes.length} · ${pushes[1] && pushes[1].title}`);
    // L'heure du résumé du soir.
    prepare({ resumeSoir: '21:00' });
    const s1 = await aHeure(parisA(19, 0), () => appeler('soir'));
    const b1 = JSON.stringify(s1.corps.bilans || s1.corps);
    dit(/à son heure \(21:00\)/.test(b1), 'P3 le cron habituel (19 h) laisse passer un vendeur réglé sur 21 h', b1.slice(0, 220));
    const g1 = await aHeure(parisA(20, 34), () => appeler('groupe'));
    dit(g1.code === 200 && g1.corps.soirs === 0, 'P4 à 20 h 34, le passage ne le prend pas', JSON.stringify(g1.corps).slice(0, 160));
    const g2 = await aHeure(parisA(21, 4), () => appeler('groupe'));
    const bs = (g2.corps.bilans || []).filter((x) => x.q === 'soir');
    dit(g2.code === 200 && g2.corps.soirs === 1 && bs.length === 1 && !/à son heure/.test(String(bs[0].soir)), 'P5 à 21 h 04, le passage lance SON résumé du soir (sans attendre)', JSON.stringify(g2.corps).slice(0, 220));
  });

  await essaie('E — l’écran exact', async () => {
    dit(/^\/\?tab=ventes&/.test(L.DESTINATIONS.colis({ tx: '1' })) && /^\/\?tab=ventes&/.test(L.DESTINATIONS.colis({})), 'E1 un colis à poster ouvre Ventes (« À expédier »)', L.DESTINATIONS.colis({ tx: '1' }));
    dit(/^\/\?tab=achats&/.test(L.DESTINATIONS.retrait({ suivi: '84603328' })) && /^\/\?tab=achats&/.test(L.DESTINATIONS.retrait({})), 'E2 un colis à retirer ouvre Achats (« À retirer »)', L.DESTINATIONS.retrait({}));
    const tous = Object.values(L.DESTINATIONS).map((f) => { try { return f({ tx: '1', suivi: '84603328', conv: '1' }); } catch (_) { return ''; } });
    dit(tous.every((u) => !/tab=cat_bord/.test(u)), 'E3 aucune destination n’ouvre l’onglet Colis', tous.filter((u) => /cat_bord/.test(u)).join(' '));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
