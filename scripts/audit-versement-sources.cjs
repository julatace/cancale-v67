// ════════════════════════════════════════════════════════════════════════════
//  LA DATE DE VERSEMENT : UNE RÈGLE, QUATRE SOURCES, PAR IDENTITÉ SEULEMENT
//  (14 nov., lot dates-versement — docs/passation/2026-11-14-dates-versement.md)
//
//  Julien, devant « 1741 ventes sans date de versement depuis 30 jours » : « il y a
//  les dates dans la conversation, la date de réception d'argent et le jour de la
//  vente ». MESURÉ (lecture seule) : la conversation de la vente porte « Ta vente est
//  finalisée. » à la seconde de la transaction 450. On EXÉCUTE :
//   1. LA règle `datesDeVersement` — celle d'App.jsx (extraite du source) ET sa copie
//      serveur (api/_lib/ventes-regle.js, refabriquée par audit-bilan-semaine --recopie) :
//      chaque source date ; l'ordre de confiance (transaction > relevé > conversation >
//      e-mail) ; deux jours différents dans une source ⇒ pas su ; une source sans
//      identité est ignorée ; 50 ventes au même montant le même jour ⇒ seule celle qui
//      porte SON n° est datée ; la date de VENTE n'entre jamais ; lecture ratée ⇒ null ;
//   2. ce que l'écran compte (`venteDatees`, `sourcesDeVersement`) et la fusion qui
//      garde les sources (`fusionnerVersements`) ;
//   3. l'extension (vrai `background.js`, `_fond-vm.cjs`) : `versementDeConversation`
//      (vendeur, 450, message système daté — rien d'autre), l'ordre (45 derniers jours,
//      puis les plus anciennes d'abord), le repli sur la conversation quand le détail
//      répond 404, DANS le budget (15/h argent), et une conversation d'une AUTRE
//      transaction n'écrit rien ;
//   4. le contrôle de nuit : ce qui est daté, la cause, le ton neutre, la phrase (tr) ;
//   5. le câblage (app, serveur, extension 5.376.0, `EXT_CAPACITES`, 5 langues).
//  Données inventées. Usage : node scripts/audit-versement-sources.cjs
//  (VRM_RACINE=<dossier> : juger un autre arbre — preuve sur origin/main et mutations.)
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { pathToFileURL } = require('url');
const RACINE = process.env.VRM_RACINE ? path.resolve(process.env.VRM_RACINE) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + String((e && e.message) || e).slice(0, 160)); } };

// Une déclaration `const NOM = (…) => { … };` de premier niveau, extraite du texte.
function extraire(src, nom) {
  const i = src.indexOf(`\nconst ${nom} = `);
  if (i < 0) return null;
  const j = src.indexOf('\n};', i);
  return j < 0 ? null : src.slice(i + 1, j + 3);
}
function fonctionDe(src, nom) {
  const t = extraire(src, nom);
  if (!t) return null;
  // Dans CE royaume (`Map`, `Set` de l'audit : `instanceof` comme dans l'app).
  return vm.runInThisContext(`(function () {\n${t}\nreturn ${nom};\n})()`);
}

const T = (tx, s, su) => ({ tx: String(tx), s: String(s), su });
const J1 = '2026-03-04T10:00:00+01:00', J2 = '2026-03-09T18:30:00+01:00', J3 = '2026-03-12T08:00:00+01:00', J4 = '2026-03-15T08:00:00+01:00';

function regle(nom, f) {
  const src = (m) => (m && m.__vrmSources instanceof Map ? m.__vrmSources : new Map());
  console.log(`── 1. La règle (${nom})`);
  if (typeof f !== 'function') { dit(false, `${nom} : datesDeVersement existe`); return; }
  // Chaque source, seule.
  const m1 = f([T(101, 450, J1), T(102, 440, J1)], null, null, null);
  dit(m1 && m1['101'] === J1 && !m1['102'] && src(m1).get('101') === 'transaction', `${nom} : la transaction 450 date (une autre ne date pas)`, JSON.stringify(m1));
  const m2 = f([], { 201: J2 }, null, null);
  dit(m2 && m2['201'] === J2 && src(m2).get('201') === 'releve', `${nom} : le relevé (par n° de transaction) date`, JSON.stringify(m2));
  const m3 = f([], null, [{ tx: '301', at: J3, src: 'conversation' }], null);
  dit(m3 && m3['301'] === J3 && src(m3).get('301') === 'conversation', `${nom} : la conversation de la transaction date`, JSON.stringify(m3));
  const m4 = f([], null, null, [{ tx: '401', at: J4 }]);
  dit(m4 && m4['401'] === J4 && src(m4).get('401') === 'email', `${nom} : l’e-mail qui porte le n° date`, JSON.stringify(m4));
  // L'ordre de confiance : chaque source plus sûre gagne sur les suivantes.
  const m5 = f([T(500, 450, J1)], { 500: J2, 501: J2 }, [{ tx: '500', at: J3, src: 'conversation' }, { tx: '501', at: J3, src: 'conversation' }, { tx: '502', at: J3, src: 'conversation' }],
    [{ tx: '500', at: J4 }, { tx: '501', at: J4 }, { tx: '502', at: J4 }, { tx: '503', at: J4 }]);
  dit(m5 && m5['500'] === J1 && m5['501'] === J2 && m5['502'] === J3 && m5['503'] === J4
    && src(m5).get('500') === 'transaction' && src(m5).get('501') === 'releve' && src(m5).get('502') === 'conversation' && src(m5).get('503') === 'email',
    `${nom} : conflit de dates ⇒ transaction > relevé > conversation > e-mail`, JSON.stringify(m5));
  // Deux jours différents dans une même source ⇒ pas su ; le même jour deux fois ⇒ daté.
  const m6 = f([], null, [{ tx: '601', at: J1, src: 'conversation' }, { tx: '601', at: J2, src: 'conversation' }, { tx: '602', at: J3, src: 'conversation' }, { tx: '602', at: J3, src: 'conversation' }],
    [{ tx: '603', at: J1 }, { tx: '603', at: J2 }]);
  dit(m6 && !m6['601'] && m6['602'] === J3 && !m6['603'], `${nom} : deux jours différents dans une source ⇒ pas su (jamais un choix au hasard)`, JSON.stringify(m6));
  // Sans identité : ignorée.
  const m7 = f([{ s: '450', su: J1 }, T('', 450, J1), T('abc', 450, J1)], null,
    [{ at: J3, src: 'conversation' }, { tx: 'Nike Air Max 90', at: J3, src: 'conversation' }, { tx: '702', at: J3 }, { tx: '703', src: 'conversation', date: J3 }],
    [{ at: J4, montant: '45,00' }, { tx: null, at: J4 }, { tx: '45,00', at: J4 }]);
  dit(m7 && Object.keys(m7).length === 0, `${nom} : une source sans identité (ni n°, un titre, un montant) ou sans date LUE est ignorée`, JSON.stringify(m7));
  // 50 ventes au même montant le même jour : seule celle qui porte SON n° est datée.
  const ventes = Array.from({ length: 50 }, (_, i) => String(9100000 + i));
  const convs = ventes.map(() => ({ at: J3, src: 'conversation', montant: 45, titre: 'Paire' }));
  convs[17] = { tx: ventes[17], at: J3, src: 'conversation', montant: 45, titre: 'Paire' };
  const mails = ventes.map(() => ({ at: J4, montant: '45,00', article: 'Paire' }));
  mails[33] = { tx: ventes[33], at: J4, montant: '45,00', article: 'Paire' };
  const m8 = f(ventes.map((tx) => T(tx, 400, J1)), null, convs, mails);
  dit(m8 && Object.keys(m8).length === 2 && m8[ventes[17]] === J3 && m8[ventes[33]] === J4, `${nom} : 50 ventes au même montant le même jour ⇒ seules les 2 qui portent leur n° sont datées`, JSON.stringify(Object.keys(m8 || {})));
  // La date de VENTE n'entre jamais : la règle ne lit aucun champ de date de vente.
  const m9 = f([{ tx: '901', s: '400', su: J1, date: J1 }], null, [{ tx: '902', src: 'conversation', created_at: J1, date: J1 }], [{ tx: '903', date: J1 }]);
  dit(m9 && Object.keys(m9).length === 0, `${nom} : la date de vente (vendu ≠ reçu) ne date jamais un versement`, JSON.stringify(m9));
  dit(f(null, { 1: J1 }, [{ tx: '1', at: J1, src: 'conversation' }], null) === null, `${nom} : transactions illisibles ⇒ null (pas su), jamais « aucune date »`);
  const m10 = f([T(111, 450, J1)], null, null, null);
  dit(m10 && JSON.stringify(Object.keys(m10)) === '["111"]' && m10.__vrmParReleve instanceof Set, `${nom} : les sources ne se voient pas dans la carte (non énumérables)`, JSON.stringify(Object.keys(m10)));
}

(async () => {
  const app = lire('src/App.jsx');
  const appSans = sans(app);
  // ── 1. La règle : celle de l'app, et sa copie serveur ──
  let fApp = null, fSrv = null;
  try { fApp = fonctionDe(app, 'datesDeVersement'); } catch (e) { dit(false, 'App.jsx : datesDeVersement s’exécute', e.message); }
  regle('app', fApp);
  try { fSrv = (await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'ventes-regle.js')).href)).datesDeVersement; } catch (e) { dit(false, 'api/_lib/ventes-regle.js se charge', e.message); }
  regle('serveur', fSrv);
  const tApp = (extraire(app, 'datesDeVersement') || '').replace(/\s+/g, ' ');
  const tSrv = (extraire(lire('api/_lib/ventes-regle.js').replace(/\nexport const /g, '\nconst '), 'datesDeVersement') || '').replace(/\s+/g, ' ');
  dit(!!tApp && sans(tApp).replace(/\s+/g, ' ') === sans(tSrv).replace(/\s+/g, ' '), 'la copie serveur est la règle de l’app, au caractère près (refabriquée par --recopie)');

  // ── 2. Ce que l'écran compte ──
  console.log('── 2. Ce que l’écran compte');
  await essaie('venteDatees', async () => {
    const A = await import(pathToFileURL(path.join(RACINE, 'src', 'versementRaisons.js')).href);
    const C = await import(pathToFileURL(path.join(RACINE, 'src', 'versementsConnus.js')).href);
    const m = fApp([T(11, 450, J1)], { 12: J2 }, [{ tx: '13', at: J3, src: 'conversation' }, { tx: '14', at: J3, src: 'conversation' }], [{ tx: '15', at: J4 }]);
    const lignes = ['11', '12', '13', '14', '15', '16'].map((tx) => ({ plateforme: 'Vinted', ts: m && m[tx] ? Date.parse(m[tx]) : null, o: { transaction_id: tx } }));
    const R = A.venteDatees(lignes, m && m.__vrmParReleve, A.sourcesDeVersement(m));
    dit(R.n === 5 && R.releve === 1 && R.conversation === 2 && R.email === 1, 'Déclarer compte les datées : dont 1 par le porte-monnaie, 2 par la conversation, 1 par e-mail', JSON.stringify(R));
    const avant = fApp([T(11, 450, J1)], null, null, null);
    const fus = C.fusionnerVersements(avant, m);
    dit(A.sourcesDeVersement(fus).get('13') === 'conversation' && fus.__vrmParReleve instanceof Set && fus.__vrmParReleve.has('12'), 'la fusion « une date connue ne redevient jamais pas lue » GARDE d’où vient chaque date', JSON.stringify([...A.sourcesDeVersement(fus)]));
    dit(A.joursPourDater(1741) === 7 && A.joursPourDater(0) === 0 && A.joursPourDater(10) === 1, '« environ X jours » : 1 741 ventes ⇒ 7 jours (288 par jour, Vinted ouvert)', String(A.joursPourDater(1741)));
  });

  // ── 3. L'extension ──
  console.log('── 3. L’extension (vrai background.js)');
  const bgSrc = path.join(RACINE, 'vinted-sync-extension', 'background.js');
  let faireFond = null;
  try { faireFond = require(path.join(RACINE, 'scripts', '_fond-vm.cjs')).faireFond; } catch (e) { dit(false, '_fond-vm.cjs se charge', e.message); }
  const conv = (tx, o = {}) => ({ conversation: { id: 5500 + Number(String(tx).slice(-3)), transaction: { id: Number(tx), status: o.status != null ? o.status : 450, current_user_side: o.side || 'seller', item_title: 'Paire secrète', offer_price: { amount: '45.0' } },
    opposite_user: { login: 'acheteuse_x', id: 77 },
    messages: o.messages || [
      { entity_type: 'message', created_at_ts: '2026-03-02T10:00:00+01:00', entity: { body: 'Bonjour, toujours dispo ?' } },
      { entity_type: 'status_message', event_type: 'success', event_group: 'sale', created_at_ts: '2026-03-02T11:00:00+01:00', entity: { title: 'Vendu' } },
      { entity_type: 'action_message', event_type: 'completed', event_group: 'completion', created_at_ts: o.at || J3, entity: { title: 'Ta vente est finalisée.', subtitle: 'Tu recevras 45,00 € dans ton porte-monnaie' } },
    ] } });
  await essaie('versementDeConversation', async () => {
    const f = faireFond({ src: bgSrc });
    const v = f.ctx.versementDeConversation;
    if (typeof v !== 'function') { dit(false, '3. versementDeConversation existe dans background.js'); return; }
    const r = v(conv('9200123'));
    dit(r && r.tx === '9200123' && r.at === J3 && JSON.stringify(Object.keys(r).sort()) === '["at","cid","tx"]', '3. vente finalisée, côté vendeur : n° de transaction + date (et rien d’autre : ni texte, ni pseudo, ni montant)', JSON.stringify(r));
    dit(v(conv('9200124', { side: 'buyer' })) === null, '3. un ACHAT (côté acheteur) ne date rien');
    dit(v(conv('9200125', { status: 440 })) === null, '3. une transaction pas finalisée (440) ne date rien');
    dit(v(conv('9200126', { messages: [{ entity_type: 'status_message', event_type: 'success', event_group: 'sale', created_at_ts: J1 }] })) === null, '3. sans le message « vente finalisée » : rien (la date de vente n’est pas un versement)');
    dit(v(conv('9200127', { messages: [{ entity_type: 'action_message', event_type: 'completed', event_group: 'completion', created_at_ts: J1 }, { entity_type: 'action_message', event_type: 'completed', event_group: 'completion', created_at_ts: J2 }] })) === null, '3. deux messages « finalisée » à deux jours différents : pas su');
    dit(v({ conversation: { transaction: { id: 'abc', status: 450, current_user_side: 'seller' }, messages: [] } }) === null && v(null) === null && v({}) === null, '3. sans n° de transaction lisible : rien');
  });
  await essaie('ordre', async () => {
    const f = faireFond({ src: bgSrc });
    const now = Date.parse('2026-11-14T12:00:00Z');
    const L = [{ transaction_id: 1, date: '2025-06-01T10:00:00Z' }, { transaction_id: 2, date: '2026-11-10T10:00:00Z' }, { transaction_id: 3, date: '2025-05-17T10:00:00Z' },
      { transaction_id: 4, date: '2026-11-01T10:00:00Z' }, { transaction_id: 5 }, { transaction_id: 6, date: '2026-06-01T10:00:00Z' }];
    const o = f.ctx.ordreVersements(L, now).map((x) => x.transaction_id).join(',');
    dit(o === '2,4,3,1,6,5', '3. l’ordre : les 45 derniers jours (le plus récent d’abord), puis LES PLUS ANCIENNES, sans date en dernier', o);
  });
  await essaie('repli', async () => {
    const UID = '111';
    const FIN = "Commande finalisée - l'acheteur a validé la commande";
    const V = Array.from({ length: 30 }, (_, i) => ({ transaction_id: 9300000 + i, conversation_id: 8800000 + i, title: 'Paire', price: { amount: '45.0' }, status: FIN, date: `2025-0${1 + (i % 9)}-1${i % 9}T10:00:00Z` }));
    const lignes = { [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: V } } };
    const at = Date.now();
    const store = { vrmLecturesDues: { [UID]: { preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at } } } };
    // Le détail répond 404 ; la conversation répond — celle de 9300005 porte une AUTRE transaction.
    const vinted = (r) => {
      if (/\/api\/v2\/transactions\/\d+$/.test(r.chemin)) return { status: 404, body: {} };
      const m = /\/api\/v2\/conversations\/(\d+)$/.exec(r.chemin);
      if (!m) return { status: 404, body: {} };
      const tx = String(Number(m[1]) - 8800000 + 9300000);
      return { status: 200, body: conv(tx === '9300005' ? '9399999' : tx) };
    };
    const f = faireFond({ src: bgSrc, lignes, vinted, store });
    f.ctx.__vrmPausesVues = [];
    for (let i = 0; i < 4; i++) { Object.assign(f.store, { vrmLecturesDues: store.vrmLecturesDues }); await f.ctx.capterDatesVersement(UID); }
    const conv_ = f.j.vinted.filter((x) => /\/conversations\//.test(x.chemin)).length;
    const tx_ = f.j.vinted.filter((x) => /\/transactions\//.test(x.chemin)).length;
    const rang = Object.keys(f.lignes).filter((k) => /^harvest_111_versement_\d+$/.test(k));
    dit(conv_ > 0 && rang.length > 0, '3. le détail répond 404 ⇒ la conversation de CETTE vente est lue, la date rangée', `${tx_} détail(s), ${conv_} conversation(s), ${rang.length} rangée(s)`);
    dit(tx_ + conv_ <= 15 && ((f.store.vrmLectures || {})[UID] || []).length <= 20, '3. dans le budget : 15 lectures d’argent par heure au plus (détails + conversations), 20 en tout', `${tx_ + conv_} lecture(s) d’argent`);
    dit(f.j.vinted.every((x) => x.methode === 'GET'), '3. rien n’est écrit chez Vinted (des GET seulement)');
    const l = rang.length ? f.lignes[rang[0]] : null;
    dit(!!l && l.source === 'conversation' && /^\d+$/.test(l.tx) && l.at === J3 && !JSON.stringify(l).includes('acheteuse_x') && !JSON.stringify(l).includes('Paire secrète') && !JSON.stringify(l).includes('45'),
      '3. la ligne rangée : n°, date, source — jamais un pseudo, un titre ni un montant', JSON.stringify(l));
    dit(!f.lignes['harvest_111_versement_9300005'] && !f.lignes['harvest_111_versement_9399999'], '3. une conversation qui porte une AUTRE transaction n’écrit rien (l’identité prime)');
  });

  // ── 4. Le contrôle de nuit ──
  console.log('── 4. Le contrôle de nuit');
  await essaie('controle', async () => {
    const N = await import(pathToFileURL(path.join(RACINE, 'src', 'controleNuit.js')).href);
    const aDater = { n: 1741, plus30: { n: 1741, ca: 1 }, datees: { n: 356, releve: 0 }, raisons: [{ cle: 'vinted-detail', n: 1741, ca: 1, comptes: [{ uid: '42', nom: 'boutique_x', n: 1741 }] }] };
    const d = typeof N.detailVersement === 'function' ? N.detailVersement(aDater) : null;
    dit(!!d && d.datees === 356 && d.cause === 'vinted-detail' && d.comptes === 1 && d.total === 1741, '4. le contrôle garde combien sont datées et la cause (des nombres et une clé)', JSON.stringify(d));
    const res = N.resultatControle({ 'versement-30j': 1741 }, {}, Date.now(), { 'versement-30j': d });
    dit(!JSON.stringify(res).includes('boutique_x'), '4. jamais un pseudo dans la ligne rangée');
    const e = N.etatControle(res, null, Date.now());
    const l = e.lignes.find((x) => x.cle === 'versement-30j');
    dit(!!l && l.ton === 'info' && l.detail && l.detail.datees === 356, '4. « en cours de lecture » : ton neutre (pas un geste ambre), le détail passe à l’écran', JSON.stringify(l && { ton: l.ton, detail: l.detail }));
    const autre = N.etatControle(N.resultatControle({ 'versement-30j': 3 }, {}, Date.now(), { 'versement-30j': { datees: 2, cause: 'leboncoin', comptes: null, total: 3 } }), null, Date.now()).lignes[0];
    dit(!!autre && autre.ton === 'geste', '4. une autre cause (Leboncoin à dater à la main) reste un geste');
    const vieux = N.etatControle(N.resultatControle({ 'versement-30j': 9 }, {}, Date.now()), null, Date.now()).lignes[0];
    dit(!!vieux && vieux.ton === 'geste' && /9 ventes sans date de versement/.test(vieux.phrase), '4. une ligne d’avant ce lot (sans détail) garde la phrase d’avant');
  });
  await essaie('phrase', async () => {
    const F = (await import(pathToFileURL(path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'journee.js')).href)).default;
    const vj = sans(lire('src/VeilleJournee.jsx'));
    dit(['veille.versement.titre', 'veille.versement.datees', 'veille.versement.pourquoi1', 'veille.versement.jours', 'veille.versement.geste'].every((k) => F[k] && vj.includes(`'${k}`)), '4. Ma journée dit la phrase par tr() : datées, pourquoi, environ X jours, le geste');
    const tout = Object.values(F).map((x) => (typeof x === 'object' ? Object.values(x).join(' ') : x)).join(' ');
    dit(!/encaiss/i.test(tout), '4. jamais « encaissé » (§5)');
    dit(['en', 'es', 'it', 'de'].every((l) => { const t = lire(`src/i18n/langues/${l}/journee.js`) + lire(`src/i18n/langues/${l}/compta.js`); return ['veille.versement.titre', 'veille.versement.pourquoiN', 'compta.dontConversation', 'compta.environJoursVinted'].every((k) => t.includes(`"${k}"`)); }), '4. les textes neufs existent dans les 5 langues');
  });

  // ── 5. Le câblage ──
  console.log('── 5. Le câblage');
  const fv = (/const fetchVersementsVinted = async \(\) => \{([\s\S]*?)\n\};/.exec(appSans) || [])[1] || '';
  dit(/datesDeVersement\(rows, releve, convL, emailsL\)/.test(fv) && /VERSEMENT_CONV_SELECT/.test(fv) && /VERSEMENT_EMAIL_SELECT/.test(fv), 'l’app date par LA règle, sur les quatre sources');
  dit(/harvest_%25_versement_%25&select=tx:data->>tx,at:data->>at,src:data->>source/.test(app) && /email_final_%25&data->>transaction=not\.is\.null&select=tx:data->>transaction,at:data->>receivedAt/.test(app), 'lectures légères, projetées (jamais select=data, §4.4)');
  dit(/ventesDatees?|venteDatees\(lignes, versementsParReleve\(versements\), sourcesDeVersement\(versements\)\)/.test(appSans), 'Ventes publie les datées par source');
  const srv = sans(lire('api/ship-reminders.js'));
  dit(/versementsDeLignes\(txn, releveL, versConvL, versMailL\)/.test(srv), 'le cron passe les mêmes sources à la même règle');
  const bg = lire('vinted-sync-extension/background.js');   // (pas `sans` : « https://*.vinted.fr/* » ouvrirait un faux commentaire)
  dit(/const versement = versementDeConversation\(brut\)|const v = versementDeConversation\(brut\); if \(v\) await rangerVersementConversation\(uid, v, domain\)/.test(bg), 'extension : une conversation captée en passant range la date (aucune requête de plus)');
  dit(/CODE_VERSION = '5\.376\.0'/.test(bg) && /"version": "5\.376\.0"/.test(lire('vinted-sync-extension/manifest.json')) && /EXT_ATTENDUE = '5\.376\.0'/.test(app) && /versementconv: '5\.376\.0'/.test(app), 'extension 5.376.0, `EXT_CAPACITES.versementconv` = 5.376.0');
  dit(/joursPourDater\(c\.n\)/.test(sans(lire('src/ecrans/Compta.jsx'))) && /data-adater-conversation/.test(lire('src/ecrans/Compta.jsx')), 'Déclarer : « dont N par la conversation » et « environ X jours »');

  console.log(ko ? `\n❌ dates de versement, quatre sources : ${ok} vert(s), ${ko} rouge(s)` : `\n✅ dates de versement, quatre sources : ${ok} vert(s), 0 rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
