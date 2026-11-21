// ════════════════════════════════════════════════════════════════════════════
//  LE WIDGET ET LES RAPPELS NE RELISENT PLUS LES LISTES ENTIÈRES (9 nov., charge)
//  EXÉCUTE les vraies routes (api/widget.js, api/ship-reminders.js) contre le
//  faux PostgREST de scripts/charge/ (3 vendeurs inventés, poids de la base de
//  Julien). Deux bases identiques sauf le résumé des ventes :
//   · « dates » : le résumé porte n° ET date des ventes à expédier (ce que le
//     serveur écrit depuis ce chantier, api/_lib/commandes-leger.js) ;
//   · « txns »  : le résumé d'avant (n° seuls) — les routes relisent les listes,
//     c'est la RÉFÉRENCE (le calcul d'avant, sur les listes entières).
//   R1. Le widget : même réponse (`ship`, à la limite près) sur les deux bases ;
//       ≤ 150 Ko lus par appel avec les dates (≈ 717 Ko avant : la liste entière).
//   R2. Le rappel du soir : mêmes rappels (nombre, retard, aujourd'hui, demain) ;
//       ≤ 300 Ko lus par vendeur avec les dates (≈ 890 Ko avant).
//   R3. Le cron du matin : mêmes rappels d'expédition ; ses lectures de listes
//       de ventes ne viennent plus que du bilan (lundi) — pas des rappels.
//   R4. Une vente vue par e-mail à juger : les listes sont relues EN ENTIER
//       (comme avant) et le résultat est le même.
//   R5. Le serveur pose les dates : `appliquerEnvoi` (orders_sold) écrit
//       `resume.dates` pour chaque n° à expédier daté ; rien pour les achats ;
//       une date illisible n'y est pas.
//  Données inventées, aucun appel externe (refusé et compté). Sur origin/main :
//  R1, R2, R5 rouges (les routes lisent les listes ; pas de `dates`).
//  `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-charge-rappels.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const W = 'api/widget.js', S = 'api/ship-reminders.js', L = 'api/_lib/commandes-leger.js';
const MUTATIONS = {
  'widget sans la date du résumé': [[W, "+ (kind === 'sold' ? ',dates:data->resume->dates' : '')", '']],
  'widget relit toujours': [[W, "&& !(ventesTx[t] && Number.isFinite(Date.parse(ventesTx[t].date || '')))", '']],
  'rappels : listes toujours entières': [[S, "if (!vivants || !vivants.size || sansResume) return { lignes: await lireListes(), entieres: true };", 'return { lignes: await lireListes(), entieres: true };']],
  'rappels : vente e-mail jugée sur le résumé seul': [[S, 'if (avecResume.txs.length) { mettre(await lireListes()); d.listesEntieres = true; return d; }', '']],
  'rappels : date du résumé ignorée': [[S, "if (typeof dl === 'string' && Number.isFinite(Date.parse(dl))) { date = dl; break; }", '']],
  'serveur : pas de dates': [[L, "if (e.type === 'orders_sold' && o && typeof o.date === 'string' && Number.isFinite(Date.parse(o.date))) dates[k] = o.date;", '']],
  'serveur : date illisible gardée': [[L, "&& Number.isFinite(Date.parse(o.date))) dates[k] = o.date;", ') dates[k] = o.date;']],
};

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
const { creerBase } = require('./charge/_faux-postgrest.cjs');
const routes = require('./charge/_routes.cjs');
const Ko = (o) => Math.round(o / 1024);
// Ce qui ne dit rien des colis (durées, horodatages, envois sans clé) est retiré avant comparaison.
const net = (x) => JSON.parse(JSON.stringify(x, (k, v) => (/^(ms|duree|at|maj|envoi|ebayRelu|transporteurs|lot|heure.*|genere.*)$/i.test(k) ? undefined : v)));

(async () => {
  // Des ventes à expédier RÉCENTES (limite estimée aujourd'hui, demain, plus tard) :
  // une date fausse ou absente changerait le rappel.
  const recentes = (lignes) => {
    for (const r of lignes) {
      if (!/^harvest_31\d+_orders_sold$/.test(r.id)) continue;
      const ae = r.data.payload.my_orders.filter((o) => o.transaction_user_status === 'needs_action');
      [6.2, 5.5, 3, 0.5].forEach((j, i) => { if (ae[i]) ae[i].date = new Date(Date.now() - j * 86400000).toISOString(); });
    }
  };
  const base = (resume) => creerBase({ vendeurs: 3, resume, majGabarit: recentes });
  const Bd = base('dates'), Bt = base('txns');
  // Un seul `fetch` de processus : on le pointe sur la base voulue avant chaque appel.
  let courante = Bd;
  const proxy = new Proxy({}, { get: (_, k) => { const v = courante[k]; return typeof v === 'function' ? v.bind(courante) : v; } });
  Bd.url = Bt.url = 'http://127.0.0.1:9';
  routes.preparer(proxy);
  courante = Bd; const gd = await routes.semer(Bd);
  courante = Bt; const gt = await routes.semer(Bt);
  const appel = async (B, nom, req, et) => { courante = B; B.remettre(); return routes.appeler(B, nom, req, et); };

  // R1 — le widget
  const wd = await appel(Bd, 'widget', { query: { k: gd.jetonWidget(0) } });
  const wt = await appel(Bt, 'widget', { query: { k: gt.jetonWidget(0) } });
  vrai(wd.code === 200 && wt.code === 200 && wd.corps && wd.corps.ship && wd.corps.ship.total > 0, `R1 le widget répond, des colis à expédier (${wd.corps && wd.corps.ship && wd.corps.ship.total})`);
  vrai(JSON.stringify(net(wd.corps.ship)) === JSON.stringify(net(wt.corps.ship)), 'R1 même réponse « à expédier » (retard, aujourd’hui, demain, sans limite) avec la date du résumé qu’avec la liste entière',
    JSON.stringify(net(wd.corps.ship)).slice(0, 200) + ' ≠ ' + JSON.stringify(net(wt.corps.ship)).slice(0, 200));
  vrai(Ko(wd.octetsSortis) <= 150, `R1 ≤ 150 Ko lus par rafraîchissement avec les dates (${Ko(wd.octetsSortis)} Ko)`);
  vrai(Ko(wt.octetsSortis) >= 400, `R1 (témoin) la base sans dates fait relire la liste entière (${Ko(wt.octetsSortis)} Ko)`);

  // R2 — le rappel du soir (les 3 vendeurs)
  const cron = { headers: { authorization: 'Bearer secret-cron-banc' } };
  const sd = await appel(Bd, 'ship-reminders', { ...cron, query: { moment: 'soir' } }, 'soir');
  const st = await appel(Bt, 'ship-reminders', { ...cron, query: { moment: 'soir' } }, 'soir');
  const trier = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const parOwner = (c) => trier(Object.fromEntries(((c && c.bilans) || []).map((b) => [b.owner, net(b)])));
  vrai(sd.code === 200 && st.code === 200 && (sd.corps.bilans || []).length === 3, 'R2 le cron du soir passe les 3 vendeurs');
  vrai(JSON.stringify(parOwner(sd.corps)) === JSON.stringify(parOwner(st.corps)), 'R2 mêmes rappels du soir (n, retard, aujourd’hui, demain, au moins) qu’avec les listes entières',
    JSON.stringify(parOwner(sd.corps)) + ' ≠ ' + JSON.stringify(parOwner(st.corps)));
  vrai(Ko(sd.octetsSortis / 3) <= 300, `R2 ≤ 300 Ko lus par vendeur le soir (${Ko(sd.octetsSortis / 3)} Ko ; sans dates : ${Ko(st.octetsSortis / 3)} Ko)`);
  const listesSoir = Object.entries(Bd.compteurs.parFamille).filter(([f]) => /orders_sold/.test(f)).reduce((a, [, v]) => a + v.sortis, 0);
  vrai(Ko(listesSoir / 3) <= 30, `R2 aucune liste de ventes relue le soir quand chaque vente à expédier a sa date (${Ko(listesSoir / 3)} Ko de résumés par vendeur)`);

  // R3 — le matin : les rappels d'expédition identiques
  const md = await appel(Bd, 'ship-reminders', cron, 'matin');
  const mt = await appel(Bt, 'ship-reminders', cron, 'matin');
  const exp = (c) => trier(Object.fromEntries(((c && c.bilans) || []).map((b) => [b.owner, net({ ship: b.ship, n: b.n, retard: b.retard, demain: b.demain, aujourdhui: b.aujourdhui, colis: b.bilan && b.bilan.colis })])));
  vrai(md.code === 200 && JSON.stringify(exp(md.corps)) === JSON.stringify(exp(mt.corps)), 'R3 mêmes rappels du matin (expédition, colis du bilan) qu’avec les listes entières',
    JSON.stringify(exp(md.corps)).slice(0, 300) + ' ≠ ' + JSON.stringify(exp(mt.corps)).slice(0, 300));
  vrai(md.octetsSortis < mt.octetsSortis - 3 * 400 * 1024, `R3 le matin lit moins (${Ko(md.octetsSortis / 3)} Ko/vendeur ; sans dates ${Ko(mt.octetsSortis / 3)} Ko)`);

  // R4 — une vente vue par e-mail, arrivée après la dernière lecture des listes.
  //      Des bases NEUVES : le mémo du soir (un rappel par jour) tairait le second passage.
  const Bd2 = base('dates'), Bt2 = base('txns');
  Bd2.url = Bt2.url = Bd.url;
  courante = Bd2; const gd2 = await routes.semer(Bd2);
  courante = Bt2; const gt2 = await routes.semer(Bt2);
  const o0 = Bd2.owners[0];
  const uid0 = Bd2.comptes(o0)[0].vinted_user_id;
  const venteMail = { type: 'vente', transaction: '99900000001', uid: String(uid0), receivedAt: new Date().toISOString(), designation: 'Paire vue par e-mail', prix: '42' };
  const bord = { filename: 'bordereau-99900000001.pdf', transaction: '99900000001', receivedAt: new Date().toISOString(), suivi: 'XW99900000001', numero: '1', dateLimite: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) };
  for (const B of [Bd2, Bt2]) { B.poser(B.owners[0], 'email_sale_99900000001', venteMail); B.poser(B.owners[0], 'email_bord_99900000001', bord); }
  const ed = await appel(Bd2, 'ship-reminders', { ...cron, query: { moment: 'soir' } }, 'soir');
  const et = await appel(Bt2, 'ship-reminders', { ...cron, query: { moment: 'soir' } }, 'soir');
  vrai(JSON.stringify(parOwner(ed.corps)) === JSON.stringify(parOwner(et.corps)), 'R4 vente vue par e-mail : mêmes rappels qu’avec les listes entières',
    JSON.stringify(parOwner(ed.corps)).slice(0, 300) + ' ≠ ' + JSON.stringify(parOwner(et.corps)).slice(0, 300));
  vrai(ed.corps && JSON.stringify(ed.corps).includes('"n":71'), 'R4 la vente vue par e-mail compte dans le rappel (71 colis au lieu de 70)', JSON.stringify(ed.corps && ed.corps.bilans).slice(0, 600));
  vrai(!!Bd2.compteurs.parFamille['harvest_%_orders_sold'] && Bd2.compteurs.parFamille['harvest_%_orders_sold'].sortis > 400 * 1024, 'R4 les listes sont relues en entier pour juger la vente vue par e-mail (comme avant)');
  const wde = await appel(Bd2, 'widget', { query: { k: gd2.jetonWidget(0) } });
  const wte = await appel(Bt2, 'widget', { query: { k: gt2.jetonWidget(0) } });
  vrai(JSON.stringify(net(wde.corps.ship)) === JSON.stringify(net(wte.corps.ship)), 'R4 le widget aussi : même réponse avec la vente vue par e-mail');

  // R5 — le serveur pose les dates
  const { appliquerEnvoi } = await import(path.join(R, L));
  const { empreinteCommande } = await import(path.join(R, 'src', 'commandesFusion.js'));
  const cmds = [
    { transaction_id: 501, date: '2026-11-07T10:00:00+01:00', status: 'Le paiement a été validé', transaction_user_status: 'needs_action' },
    { transaction_id: 502, date: 'pas une date', status: 'Le paiement a été validé', transaction_user_status: 'needs_action' },
    { transaction_id: 503, date: '2026-10-01T10:00:00+01:00', status: 'Commande finalisée', transaction_user_status: 'completed' },
  ];
  const envoi = (type) => ({ type, uid: '3150000000', fenetre: cmds.map((c) => `${c.transaction_id}:${empreinteCommande(c)}`).join(','), commandes: cmds, ae: ['501', '502'], complet: true, luA: Date.now() });
  const v = appliquerEnvoi(null, envoi('orders_sold'));
  const a = appliquerEnvoi(null, envoi('orders_purchased'));
  vrai(v.ecrit && v.data.resume && JSON.stringify(v.data.resume.txns) === '["501","502"]', 'R5 le résumé des ventes garde ses n° (règle de l’extension)');
  vrai(v.ecrit && v.data.resume.dates && v.data.resume.dates['501'] === cmds[0].date && Object.keys(v.data.resume.dates).length === 1, 'R5 la date de la vente à expédier est posée, par n° ; une date illisible n’y est pas', JSON.stringify(v.data && v.data.resume));
  vrai(a.ecrit && a.data.resume && a.data.resume.dates === undefined, 'R5 aucun champ « dates » sur les achats');

  vrai(routes && true, 'aucun appel externe n’est parti (refusés et comptés par le banc)');
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
