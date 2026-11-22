// ════════════════════════════════════════════════════════════════════════════
// LES OFFRES REÇUES RESTÉES SANS RÉPONSE (22 nov., Julien — choix n° 33)
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/offresSansReponse.js avec les VRAIES règles de chaque site (src/offresVinted.js : `offreVintedEnAttente`,
// `offreOuverte` ; src/offresVestiaire.js : `offresVestiaire`) et exige :
//   1. une offre PROUVÉE en attente seulement (statut 10 de l'acheteur, la règle du fil) : acceptée, refusée,
//      précédente, proposée par lui, une phrase « je propose 50 € » dans un message ⇒ jamais listée ; rien n'est
//      déduit d'une absence ;
//   2. UNE seule source par site (la règle du fil pour Vinted, `aTrancher` pour Vestiaire) ;
//   3. « ni répondu ni réagi » : un message de lui APRÈS l'offre la fait sortir ; avant, ou date pas lue, elle reste ;
//   4. une offre traitée sort : confirmée acceptée / refusée, annonce prouvée partie, contre-offre d'un vendeur à qui
//      IL achète (côté acheteur), Vestiaire expirée ;
//   5. de la plus ancienne à la plus récente ; « il y a 2 h », « hier » ;
//   6. « pas su » ⇒ « pas su » (jamais 0 offre), eBay et Leboncoin NOMMÉS (pas lus) ;
//   7. le branchement : Messages (la liste), Aujourd'hui (« N offres sans réponse › »), le toucher ouvre le panneau de
//      l'extension (aucun geste d'offre dans l'app), textes par tr().
//   node scripts/audit-offres-sans-reponse.cjs            → le contrôle
//   node scripts/audit-offres-sans-reponse.cjs --prouve   → chaque mutation doit faire ROUGIR
// Aucune donnée réelle : tout est inventé ici.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R0 = path.join(__dirname, '..');
const REGLE = path.join(R0, 'src', 'offresSansReponse.js');
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  'repondu-ignore': ['if (off0.msgs !== undefined && aReponduApres(off0.msgs, off0.opp, off0.ts) === true) continue;', ''],
  'confirmees-ignorees': ['confirmees.has(`${uid}:${off0.tx}:${off0.oid}`)) continue;', 'false) continue;'],
  'cote-acheteur': ["if (off0.side === 'buyer') continue;", ''],
  'partie-gardee': ['if (!off) continue;                                                       // l\'annonce est prouvée partie', ''],
  'plus-recente-dabord': ['lignes.sort((a, b) => (a.ts == null ? Infinity : a.ts) - (b.ts == null ? Infinity : b.ts)', 'lignes.sort((a, b) => (b.ts == null ? -Infinity : b.ts) - (a.ts == null ? -Infinity : a.ts)'],
  'pas-su-zero': ["} else if (vinted === null) { pasSu = true; nonLus.unshift('vinted'); }", '}'],
  'pas-su-repondu': ['if (t == null || !Number.isFinite(t0)) { pasSu = true; continue; }', 'if (t == null || !Number.isFinite(t0)) { return true; }'],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + String(d).slice(0, 300) : '')); };
  let regleSrc = fs.existsSync(REGLE) ? fs.readFileSync(REGLE, 'utf8') : null;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue'); process.exit(2); }
    if (!regleSrc || !regleSrc.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    regleSrc = regleSrc.replace(m[0], m[1]);
  }
  let M = null, OV = null, VC = null;
  try { OV = await import(pathToFileURL(path.join(R0, 'src', 'offresVinted.js')).href); VC = await import(pathToFileURL(path.join(R0, 'src', 'offresVestiaire.js')).href); } catch (e) { dit(false, 'les règles des sites se chargent', e.message); }
  if (regleSrc != null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-osr-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'offresSansReponse.js'), regleSrc);
    try { M = await import(pathToFileURL(path.join(dir, 'offresSansReponse.js')).href); } catch (e) { dit(false, 'la règle se charge', e.message); }
  } else dit(false, 'src/offresSansReponse.js existe');
  if (!M || !OV || !VC) { console.log(`\n❌ audit-offres-sans-reponse : ${n - ko} vert(s), ${ko} rouge(s)`); process.exit(1); }

  const MAINT = Date.parse('2026-11-22T15:00:00+01:00');
  const H = 3600e3, MOI = '777', OPP = '900';
  const sec = (ms) => Math.round(ms / 1000);
  const offre = (tx, oid, prix, ts, o = {}) => ({ entity_type: 'offer_request_message', created_at_ts: sec(ts), entity: { transaction_id: tx, offer_request_id: oid, user_id: OPP, status: 10, price: { amount: String(prix), currency_code: 'EUR' }, ...o } });
  const msg = (user, ts, body = 'ok') => ({ entity_type: 'message', created_at_ts: ts == null ? null : sec(ts), entity: { user_id: user, body } });
  // Ce que fait `fetchOffresConversations` (Comptabilite.jsx) : LA règle du fil, puis la ligne, ses messages et l'acheteur.
  const carte = (convs) => {
    const m = new Map();
    for (const c of convs) {
      const off = OV.offreVintedEnAttente({ opposite_user: { id: OPP }, messages: c.messages });
      if (off) m.set(`11_${c.id}`, { ...off, titre: c.titre || 'Nike 42', item: c.item || '501', side: c.side || 'seller', msgs: c.messages, opp: OPP });
    }
    return m;
  };
  const lancer = (o) => M.offresSansReponse({ maintenant: MAINT, ...o });

  console.log('── 1. Une offre PROUVÉE en attente seulement');
  {
    const v = carte([
      { id: '1', messages: [offre(10, 1, 50, MAINT - 2 * H)] },
      { id: '2', messages: [offre(20, 2, 50, MAINT - 2 * H, { status: 20 })] },
      { id: '3', messages: [offre(30, 3, 50, MAINT - 2 * H, { status: 30 })] },
      { id: '4', messages: [offre(40, 4, 50, MAINT - 2 * H, { current: false, status: 10 })] },
      { id: '5', messages: [offre(50, 5, 50, MAINT - 2 * H, { user_id: MOI })] },
      { id: '6', messages: [msg(OPP, MAINT - 2 * H, 'je propose 50 € ?')] },
    ]);
    const r = lancer({ vinted: v });
    dit(r.etat === 'lu' && r.n === 1 && r.lignes[0].conv === '1', 'seule l’offre au statut 10 de l’acheteur est listée (acceptée, refusée, précédente, la sienne, une phrase « je propose » : jamais)', JSON.stringify(r.lignes.map((l) => l.conv)));
    dit(r.lignes[0].offre === 50 && r.lignes[0].site === 'vinted', 'le prix proposé, celui de l’offre');
  }

  console.log('\n── 2. « Ni répondu ni réagi »');
  {
    const v = carte([
      { id: '1', messages: [offre(10, 1, 50, MAINT - 3 * H), msg(MOI, MAINT - 2 * H, 'je regarde')] },
      { id: '2', messages: [msg(MOI, MAINT - 4 * H, 'bonjour'), offre(20, 2, 55, MAINT - 3 * H)] },
      { id: '3', messages: [offre(30, 3, 60, MAINT - 3 * H), msg(MOI, null, 'sans date')] },
      { id: '4', messages: [offre(40, 4, 65, MAINT - 3 * H), msg(OPP, MAINT - 1 * H, 'alors ?')] },
    ]);
    const ids = lancer({ vinted: v }).lignes.map((l) => l.conv).sort().join(',');
    dit(ids === '2,3,4', 'il a écrit APRÈS l’offre ⇒ elle sort ; avant ⇒ elle reste ; message sans date ⇒ elle reste (pas su) ; l’acheteur relance ⇒ elle reste', ids);
  }

  console.log('\n── 3. Une offre traitée sort');
  {
    const v = carte([{ id: '1', messages: [offre(10, 1, 50, MAINT - 2 * H)] }, { id: '2', messages: [offre(20, 2, 50, MAINT - 2 * H)] }, { id: '3', messages: [offre(30, 3, 50, MAINT - 2 * H)], side: 'buyer' }]);
    const confirmees = new Set(['11:10:1']);
    const lecture = { enLigne: new Set(), aConfirmer: new Set(), masquees: new Set(), brouillons: new Set(), lues: { 11: MAINT - H }, ko: new Set() };
    const ouverte = (off, uid) => OV.offreOuverte({ ...off, ts: off.ts }, uid, lecture);
    const r = lancer({ vinted: v, confirmees, ouverte });
    dit(r.n === 0, 'confirmée acceptée / refusée ⇒ sort ; annonce PROUVÉE partie (dressing lu après l’offre, absente) ⇒ sort ; côté acheteur ⇒ jamais', JSON.stringify(r.lignes.map((l) => l.conv)));
    const rc = lancer({ vinted: carte([{ id: '1', messages: [offre(10, 1, 50, MAINT - 2 * H)] }, { id: '2', messages: [offre(20, 2, 50, MAINT - 2 * H)] }]), confirmees });
    dit(rc.n === 1 && rc.lignes[0].conv === '2', 'seule, une acceptation / un refus CONFIRMÉ fait sortir l’offre (l’autre reste)', JSON.stringify(rc.lignes.map((l) => l.conv)));
    const lecture2 = { ...lecture, lues: { 11: MAINT - 3 * H } };
    const r2 = lancer({ vinted: carte([{ id: '2', messages: [offre(20, 2, 50, MAINT - 2 * H)] }]), ouverte: (off, uid) => OV.offreOuverte(off, uid, lecture2) });
    dit(r2.n === 1, 'dressing lu AVANT l’offre ⇒ pas su ⇒ l’offre RESTE (une offre cachée à tort fait rater une vente)');
    const ligneVc = { capturedAt: new Date(MAINT).toISOString(), offres: {
      n1: { id: '1001', produit: '55', compte: 'vc1', titre: 'Dunk', offre: 9000, initial: 12000, min: 8000, ouverte: true, aToi: true, expire: new Date(MAINT + 5 * H).toISOString(), dernier: { action: 'offer', par: 'acheteur', at: new Date(MAINT - 26 * H).toISOString(), cents: 9000 } },
      n2: { id: '1002', produit: '56', compte: 'vc1', titre: 'Jordan', offre: 9000, ouverte: true, aToi: true, expire: new Date(MAINT - H).toISOString(), dernier: { action: 'offer', par: 'acheteur', at: new Date(MAINT - 30 * H).toISOString() } },
      n3: { id: '1003', produit: '57', compte: 'vc1', titre: 'Sa contre', offre: 9500, ouverte: true, aToi: false, dernier: { action: 'offer', par: 'vendeur', at: new Date(MAINT - 2 * H).toISOString() } },
    } };
    const rv = lancer({ vinted: new Map(), vestiaire: VC.offresVestiaire(ligneVc, MAINT) });
    dit(rv.n === 1 && rv.lignes[0].site === 'vestiaire' && rv.lignes[0].offre === 90 && rv.lignes[0].prix === 120 && rv.lignes[0].mini === 80, 'Vestiaire : l’offre « à toi » listée (90 € face à 120 €, mini 80 €) ; expirée ou sa contre-offre en attente ⇒ jamais', JSON.stringify(rv.lignes));
  }

  console.log('\n── 4. L’ordre et l’âge');
  {
    const v = carte([{ id: '1', messages: [offre(10, 1, 50, MAINT - 2 * H)] }, { id: '2', messages: [offre(20, 2, 50, MAINT - 30 * H)] }, { id: '3', messages: [offre(30, 3, 50, MAINT - 72 * H)] }]);
    const r = lancer({ vinted: v });
    dit(r.lignes.map((l) => l.conv).join(',') === '3,2,1', 'de la plus ancienne à la plus récente', r.lignes.map((l) => l.conv).join(','));
    dit(r.lignes[2].age.cle === 'heures' && r.lignes[2].age.n === 2 && r.lignes[1].age.cle === 'hier' && r.lignes[0].age.cle === 'jours', '« il y a 2 h », « hier », « il y a 3 j »', JSON.stringify(r.lignes.map((l) => l.age)));
  }

  console.log('\n── 5. « Pas su » n’est jamais « 0 »');
  {
    const r = lancer({ vinted: null, vestiaire: { etat: 'passu' } });
    dit(r.etat === 'passu' && r.nonLus.includes('vinted'), 'conversations pas lues ⇒ « pas su », Vinted nommé (jamais « 0 offre »)', JSON.stringify(r));
    dit(lancer({ vinted: undefined }).etat === 'encours', 'en cours de lecture ⇒ « encours »');
    const r2 = lancer({ vinted: new Map() });
    dit(r2.etat === 'lu' && r2.n === 0 && r2.nonLus.includes('ebay') && r2.nonLus.includes('leboncoin'), 'lu et vide ⇒ 0, eBay et Leboncoin NOMMÉS (aucune offre rangée)');
    const r3 = lancer({ vinted: null, vestiaire: VC.offresVestiaire({ offres: {} }, MAINT) });
    dit(r3.etat === 'lu' && r3.partiel === true, 'Vinted pas lu, Vestiaire lu ⇒ partiel (dit)');
  }

  console.log('\n── 6. Le branchement');
  {
    const comp = lire('src/ecrans/Comptabilite.jsx'), aj = lire('src/natif/ecrans/Aujourdhui.jsx'), vue = lire('src/natif/ecrans/OffresSansReponse.jsx');
    dit(/offresSansReponse\(\{/.test(comp) && /offreVintedEnAttente|offreEnAttenteDe/.test(comp) && /offresVestiaire\(/.test(comp), 'Comptabilite : la règle sur LES sources existantes (la règle du fil, `offresVestiaire`)');
    dit(/<OffresSansReponse/.test(comp) && /prendreVue\('offressansreponse'\)/.test(comp), 'Messages montre la liste ; Aujourd’hui y mène (la vue « offressansreponse »)');
    dit(/data-osr-journee/.test(aj), 'Aujourd’hui dessine « N offres sans réponse › »');
    dit(/ouvrirPanneau/.test(vue + comp) && !/vmrExec|acceptOffer|accepterOffre/.test(vue), 'le toucher ouvre le PANNEAU de l’extension ; aucun geste d’offre dans la liste');
    dit(/tr\('osr\./.test(vue) && !/>[A-Za-zÀ-ÿ][^<{]{3,}</.test(vue.replace(/\/\/.*$/gm, '')), 'les textes de la liste passent par tr()');
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-offres-sans-reponse : ${n - ko} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
