// ════════════════════════════════════════════════════════════════════════════
//  SAISIE RAPIDE (11 nov.) — trois choses validées par Julien, EXÉCUTÉES :
//   P  le prix d'achat demandé le jour de la vente (src/prixAchatVente.js) :
//      seulement une vente PROUVÉE, sans prix, de moins de 3 jours ; texte « Vendu
//      80 € · N°124 » ; regroupée ; jamais la nuit (Paris) ;
//   S  la route /api/push, action `prixachat` (api/_lib/prix-achat-demande.js),
//      exécutée sur une base servie (src/exempleBase.js) : la transaction RELUE,
//      une notification une seule fois par vente (trois appels en même temps ⇒
//      une), jamais pour une vente non prouvée, jamais la nuit, famille coupée ⇒ rien ;
//   V  « Vendu ailleurs » (src/venteAilleurs.js) : le geste (décision datée, sortie
//      du stock, case libérée, N° gardé, « Annuler » rend l'état exact), et LES
//      règles des totaux (`ventesDeclarables`, `ventesFaites` du miroir serveur
//      identique à l'app, `ventesAutresBenefice` et `ventesAilleursDe` lues dans
//      App.jsx) : comptée UNE fois, au bon mois, jamais en double avec la vente
//      Vinted de la même annonce ;
//   R  la voix (src/rechercheVocale.js) : « vendues en octobre » ⇒ le mois ;
//      « numéro 124 », « N 124 », « Nike taille 42 » inchangés.
//  `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au ROUGE.
//  Données inventées seulement (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const UID = '11111111-2222-3333-4444-555555555555';
const JOUR = '2026-11-11T11:00:00Z';                 // 12 h à Paris
const NUIT = '2026-11-11T22:30:00Z';                 // 23 h 30 à Paris
const MAINT = Date.parse(JOUR);

// Les mutations : [fichier, avant, après]. Chacune doit rendre l'audit ROUGE.
const MUTATIONS = {
  prix_connu_ignore: ['src/prixAchatVente.js', '    if (prixConnu(f, prixDe)) continue;\n', ''],
  fenetre_ignoree: ['src/prixAchatVente.js', 'maintenant - ts > FENETRE_MS || ', ''],
  nuit_jamais: ['src/prixAchatVente.js', '  return h >= 22 || h < 8;', '  return false;'],
  serveur_sans_preuve: ['api/_lib/prix-achat-demande.js', 'const vraies = demandees.filter((v) => ok.has(v.tx));', 'const vraies = demandees;'],
  serveur_sans_memoire: ['api/_lib/prix-achat-demande.js', 'reservees = aDemander(d || {}, vraies).slice(0, MAX_GROUPE);', 'reservees = vraies.slice(0, MAX_GROUPE);'],
  serveur_nuit: ['api/_lib/prix-achat-demande.js', "  if (estNuitParis(instant())) return { status: 200, envoye: false, n: 0, raison: 'nuit' };\n", ''],
  ailleurs_double_vinted: ['src/venteAilleurs.js', '    if (vendusVinted && typeof vendusVinted.has === \'function\' && vendusVinted.has(String(id))) continue;\n', ''],
  ailleurs_date_ignoree: ['src/venteAilleurs.js', "const t = DATE_OK.test(str(d.date)) ? Date.parse(str(d.date) + 'T12:00:00') : Date.parse(str(d.at));", 'const t = Date.parse(str(d.at));'],
  ailleurs_pas_du_stock: ['src/venteAilleurs.js', '  if (!dedans) ops.push(', '  if (false) ops.push('],
  regle_sans_main: ['api/_lib/ventes-regle.js', "    if (garde(l)) lignes.push(place(l));\n  }\n  return { lignes, aDater, ecartees, exclues", "  }\n  return { lignes, aDater, ecartees, exclues"],
  voix_mois_absent: ['src/rechercheVocale.js', '  const i = MOIS.indexOf(m[1]);\n  if (i < 0) return null;\n  const now', '  const i = MOIS.indexOf(m[1]);\n  if (i >= 0) return null;\n  const now'],
};

// Un module ESM chargé depuis une copie (éventuellement mutée) posée À CÔTÉ de
// l'original (ses imports relatifs restent justes), effacée aussitôt.
async function charger(fichier, mut) {
  const src = lire(fichier);
  if (!mut || mut[0] !== fichier) return import('file://' + path.join(R, fichier) + '?v=' + Math.random());
  if (!src.includes(mut[1])) throw new Error('mutation introuvable dans ' + fichier);
  const f = path.join(R, path.dirname(fichier), `.mut-${process.pid}-${Math.random().toString(36).slice(2)}-${path.basename(fichier)}`);
  fs.writeFileSync(f, src.replace(mut[1], mut[2]));
  try { return await import('file://' + f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// Une déclaration `const nom = … ;` lue dans App.jsx (texte exact), à exécuter.
function declaration(src, nom) {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) throw new Error(nom + ' absent d’App.jsx');
  let j = src.indexOf('\n};\n', i);
  return src.slice(i, j + 3);
}

async function audit(mut, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (!c && d != null ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — a levé', String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
  const P = await charger('src/prixAchatVente.js', mut);
  const V = await charger('src/venteAilleurs.js', mut);
  const RV = await charger('src/rechercheVocale.js', mut);
  const G = await import('file://' + path.join(R, 'src', 'gesteAnnulable.js'));

  // ── P · la règle de la demande ──────────────────────────────────────────
  await essaie('P', async () => {
    const h = (n) => new Date(MAINT - n * 3600e3).toISOString();
    const ventes = [
      { transaction_id: 7001, price: { amount: '80.0', currency_code: 'EUR' }, date: h(2), status: 'Bordereau envoyé' },
      { transaction_id: 7002, price: { amount: '55.5' }, date: h(5), status: 'Commande finalisée' },
      { transaction_id: 7003, price: { amount: '40' }, date: h(4), status: 'Bordereau envoyé' },
      { transaction_id: 7004, price: { amount: '30' }, date: h(100), status: 'Commande finalisée' },
      { transaction_id: 7005, price: { amount: '30' }, date: h(1), status: 'Remboursement effectué' },
      { transaction_id: 7006, price: { amount: '30' }, date: h(1), status: 'Bordereau envoyé' },
      { transaction_id: 7007, price: { amount: '30' }, date: h(1), status: 'Bordereau envoyé' },
    ];
    const fiches = { a1: { numero: '124' }, a2: { numero: 'B12' }, a3: { numero: '9', buyPrice: '20' }, a4: { numero: '5' }, a5: { numero: '6' }, a6: { numero: '7', buyFromId: 'tx-achat' }, a7: { numero: '' } };
    const paires = [['7001', 'a1'], ['7002', 'a2'], ['7003', 'a3'], ['7004', 'a4'], ['7005', 'a5'], ['7006', 'a6'], ['7007', 'a7']].map(([tx, item]) => ({ tx, uid: '111', item }));
    const args = { paires, ventes, fiches, prixDe: (f) => (f.buyPrice != null && f.buyPrice !== '' ? Number(f.buyPrice) : null), annulee: (o) => /rembours|annul/i.test(o.status), montant: (o) => Number(o.price.amount), maintenant: MAINT };
    const l = P.ventesSansPrix(args);
    dit(JSON.stringify(l.map((v) => v.tx)) === '["7001","7002"]', 'P1 seules les ventes prouvées, sans prix, de moins de 3 jours, avec un N° (7001, 7002)', JSON.stringify(l.map((v) => v.tx)));
    const sansPreuve = P.ventesSansPrix({ ...args, paires: paires.filter((p) => p.tx !== '7001') });
    dit(!sansPreuve.some((v) => v.tx === '7001'), 'P2 une vente lue mais NON prouvée n\'est jamais demandée');
    const t1 = P.texteDemande([l[0]]);
    dit(t1 && t1.title === 'Vendu 80 € · N°124' && /Combien tu l’avais payée/.test(t1.body), 'P3 « Vendu 80 € · N°124 » + « Combien tu l’avais payée ? »', JSON.stringify(t1));
    const t2 = P.texteDemande(l);
    dit(t2 && /^2 ventes sans prix d’achat$/.test(t2.title) && /N°124, N°B12/.test(t2.body), 'P4 deux ventes en même temps ⇒ UN texte qui les regroupe', JSON.stringify(t2));
    dit(P.estNuitParis(Date.parse(NUIT)) === true && P.estNuitParis(Date.parse('2026-11-11T06:30:00Z')) === true && P.estNuitParis(MAINT) === false && P.estNuitParis(Date.parse('2026-07-11T20:30:00Z')) === true,
      'P5 la nuit, heure de Paris (22 h – 8 h, hiver comme été)');
    const memo = P.reserver({}, ['7001'], MAINT);
    dit(P.aDemander(memo, l).map((v) => v.tx).join() === '7002', 'P6 une vente déjà demandée ne l\'est plus');
    dit(P.lienDemande(['7001', '7002']) === '/?tab=journee&cible=prixachat&tx=7001_7002' && JSON.stringify(P.txsDuLien('?tab=journee&cible=prixachat&tx=7001_7002')) === '["7001","7002"]', 'P7 le toucher ouvre la feuille de CES ventes (identités dans l\'adresse)');
  });

  // ── S · la route, exécutée ─────────────────────────────────────────────
  await essaie('S', async () => {
    process.env.SUPABASE_URL = 'https://banc.supabase.test';
    process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
    process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
    const webpush = require(path.join(R, 'node_modules', 'web-push'));
    const pushes = [];
    webpush.setVapidDetails = () => {};
    webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
    const { servirTable } = await import('file://' + path.join(R, 'src', 'exempleBase.js'));
    let tables;
    const ligne = (id, data) => ({ id, owner: UID, data, updated_at: new Date(MAINT).toISOString() });
    const txn = (uid, tx, item, titre) => ligne(`harvest_${uid}_txn_${tx}`, { capturedAt: new Date(MAINT).toISOString(), payload: { transaction: { id: Number(tx), item_id: Number(item), status: 300, status_title: titre } } });
    const SUB = ligne('push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }], rev: 1 });
    const remettre = (rows) => { tables = { app_data: { lignes: [SUB, ...rows] } }; pushes.length = 0; };
    const fetchAvant = global.fetch;
    global.fetch = async (url, opts = {}) => {
      const u = new URL(String(url));
      const rep = (b, s = 200) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
      if (u.pathname === '/auth/v1/user') return rep({ id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00Z' });
      if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
      const t = u.pathname.replace('/rest/v1/', '');
      if (!tables[t]) return rep([]);
      let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
      // La vraie forme de PostgREST : `resolution=ignore-duplicates` n'écrase JAMAIS une ligne
      // qui existe (rien n'est rendu) — sans quoi deux appareils créeraient chacun « sa » mémoire.
      const pref = String((opts.headers || {}).Prefer || '');
      if ((opts.method || '').toUpperCase() === 'POST' && /ignore-duplicates/.test(pref) && Array.isArray(corps) && corps.every((l) => tables[t].lignes.some((x) => x.id === l.id))) return rep([]);
      const x = servirTable(tables[t], { methode: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, entetes: opts.headers || {}, corps, owner: UID });
      return new Response(x.status === 204 || x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: x.headers });
    };
    const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
    const S = await charger('api/_lib/prix-achat-demande.js', mut);
    const appel = (ventes) => contexteVendeur.run({ owner: UID }, () => S.notifierPrixAchat({ action: 'prixachat', ventes }));
    const memo = () => (tables.app_data.lignes.find((r) => r.id === 'vrm_prix_achat_demandes') || {}).data;
    const V1 = { tx: '7001', uid: '111', num: '124', eur: 80 };
    try {
      process.env.VRM_NOTIF_HORLOGE = JOUR;
      remettre([txn(111, 7001, 501, 'Bordereau envoyé')]);
      const r1 = await appel([V1]);
      dit(r1.status === 200 && pushes.length === 1 && pushes[0].title === 'Vendu 80 € · N°124' && /Combien tu l’avais payée/.test(pushes[0].body) && /cible=prixachat&tx=7001/.test(pushes[0].url), 'S1 vente prouvée sans prix ⇒ UNE notification « Vendu 80 € · N°124 »', JSON.stringify([r1, pushes]));
      dit(!!(memo() && memo().demandes && memo().demandes['7001']), 'S1 la vente est notée « demandée » dans SA ligne');
      await appel([V1]);
      dit(pushes.length === 1, 'S2 rappelée (autre appareil, rechargement) ⇒ rien de plus', String(pushes.length));
      remettre([txn(111, 7001, 501, 'Bordereau envoyé')]);
      await Promise.all([appel([V1]), appel([V1]), appel([V1])]);
      dit(pushes.length === 1, 'S3 trois appels en même temps ⇒ une seule notification', String(pushes.length));
      remettre([txn(111, 7001, 501, '')]);
      await appel([V1]);
      dit(pushes.length === 0 && !memo(), 'S4 une conversation (état vide) n\'est pas une vente ⇒ rien envoyé, rien noté', String(pushes.length));
      remettre([txn(111, 7001, 501, 'Remboursement effectué')]);
      await appel([V1]);
      dit(pushes.length === 0, 'S5 une vente revenue (remboursée) ⇒ rien', String(pushes.length));
      remettre([]);
      await appel([V1]);
      dit(pushes.length === 0, 'S6 une transaction absente de la base (le corps ment) ⇒ rien', String(pushes.length));
      process.env.VRM_NOTIF_HORLOGE = NUIT;
      remettre([txn(111, 7001, 501, 'Bordereau envoyé')]);
      const rN = await appel([V1]);
      dit(pushes.length === 0 && !memo() && rN.raison === 'nuit', 'S7 la nuit (23 h 30 à Paris) ⇒ rien envoyé, RIEN réservé (redemandée le jour)', JSON.stringify(rN));
      process.env.VRM_NOTIF_HORLOGE = JOUR;
      remettre([txn(111, 7001, 501, 'Bordereau envoyé'), ligne('push_prefs', { familles: { ventes: false } })]);
      await appel([V1]);
      dit(pushes.length === 0, 'S8 famille « Ventes » coupée dans ses réglages ⇒ rien', String(pushes.length));
      remettre([txn(111, 7001, 501, 'Bordereau envoyé'), txn(111, 7002, 502, 'Commande finalisée')]);
      await appel([V1, { tx: '7002', uid: '111', num: 'B12', eur: 55.5 }]);
      dit(pushes.length === 1 && /^2 ventes sans prix d’achat$/.test(pushes[0].title), 'S9 deux ventes en même temps ⇒ UNE notification regroupée', JSON.stringify(pushes.map((p) => p.title)));
      remettre([txn(222, 7001, 501, 'Bordereau envoyé')]);
      await appel([V1]);
      dit(pushes.length === 0, 'S10 la transaction d\'un AUTRE compte que celui nommé ⇒ rien', String(pushes.length));
    } finally { global.fetch = fetchAvant; delete process.env.VRM_NOTIF_HORLOGE; }
  });

  // ── V · « Vendu ailleurs » ──────────────────────────────────────────────
  await essaie('V', async () => {
    const carte = { id: '9001', numero: '124', title: 'Nike Air Max' };
    const avantD = { '9000': { choix: 'chez-moi' } }, avantV = ['8000'], avantS = { '124': { meuble: 'm1', i: 3 } };
    const r = V.opsVenduAilleurs({ carte, montant: 45, date: '2026-10-15', decisions: avantD, vendues: avantV, slots: avantS, maintenant: MAINT });
    const d = { vrm_cycle_decisions: avantD, vinted_annonces_vendues: avantV, vrm_slots: avantS };
    const apres = {}; for (const k of Object.keys(d)) apres[k] = G.appliquerOps(d[k], r.ops.filter((o) => o.k === k), 'apres');
    dit(apres.vrm_cycle_decisions['9001'] && apres.vrm_cycle_decisions['9001'].choix === 'vendu-main' && apres.vrm_cycle_decisions['9001'].montant === 45 && apres.vrm_cycle_decisions['9001'].date === '2026-10-15' && apres.vrm_cycle_decisions['9001'].numero === '124',
      'V1 la décision « vendu en main propre » : 45 €, le 15/10, N° gardé', JSON.stringify(apres.vrm_cycle_decisions));
    dit(apres.vinted_annonces_vendues.includes('9001') && !apres.vrm_slots['124'], 'V2 la paire sort du stock (marquée vendue) et sa case est libérée', JSON.stringify([apres.vinted_annonces_vendues, apres.vrm_slots]));
    const defait = {}; for (const k of Object.keys(d)) defait[k] = G.appliquerOps(apres[k], r.ops.filter((o) => o.k === k), 'avant');
    dit(JSON.stringify(defait) === JSON.stringify(d), 'V3 « Annuler » remet l\'état d\'avant, exact', JSON.stringify(defait));
    dit(V.opsVenduAilleurs({ carte, montant: 0, date: '2026-10-15', maintenant: MAINT }) === null && V.opsVenduAilleurs({ carte, montant: 45, date: '2027-01-01', maintenant: MAINT }) === null && V.opsVenduAilleurs({ carte, montant: 45, date: 'hier', maintenant: MAINT }) === null,
      'V4 un prix vide ou une date future ⇒ rien n\'est écrit');

    // Les règles des totaux.
    const RG = await charger('api/_lib/ventes-regle.js', mut);
    const appSrc = lire('src/App.jsx');
    const ctx = vm.createContext({ ventesMainPropre: V.ventesMainPropre, classifyOrderStatus: RG.classifyOrderStatus, lbcAnnulee: RG.lbcAnnulee, lbcFinalisee: RG.lbcFinalisee,
      commandeEbayEngagee: RG.commandeEbayEngagee, montantRecuEbay: RG.montantRecuEbay, vcVenteAnnulee: () => false, etapeMotVc: () => '', montantRecuVc: () => ({ eur: null }), dateVenteVc: () => null,
      cleNum: (v) => { const s = String(v == null ? '' : v).trim().toUpperCase(); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; },
      _txnItemConnu: { '900': '9002' }, CYCLE_DECISIONS: 'vrm_cycle_decisions', __dec: {}, Set, Object, Number, Date, isFinite, Math, String, Array });
    ctx.lireObjet = () => ctx.__dec;
    let txt = declaration(appSrc, 'ficheUniqueDuNumero') + '\n' + declaration(appSrc, 'ventesAutresBenefice') + '\n' + declaration(appSrc, 'ventesAilleursDe');
    if (mut && mut[0] === 'api/_lib/ventes-regle.js') txt = txt.replace("    out.push({ plateforme: 'Ailleurs'", '    if (0) out.push({ plateforme: \'Ailleurs\'');
    vm.runInContext(txt + '\nthis.VAB = ventesAutresBenefice; this.VAD = ventesAilleursDe;', ctx);
    ctx.__dec = {
      '9001': { choix: 'vendu-main', numero: '124', montant: 45, date: '2026-10-15', at: '2026-11-11T10:00:00Z' },
      '9002': { choix: 'vendu-main', numero: '125', montant: 60, date: '2026-10-20', at: '2026-11-11T10:00:00Z' },   // vendue AUSSI sur Vinted (tx 900)
      '9003': { choix: 'separe', numero: '126' },
    };
    const vinted = [{ transaction_id: 900, status: 'Commande finalisée', price: { amount: '70.0' }, date: '2026-10-19T10:00:00Z', _acc: { vinted_user_id: '111' } }];
    const main = ctx.VAD(vinted);
    dit(main.length === 1 && main[0].id === '9001', 'V5 la vente en main propre d\'une paire VENDUE AUSSI sur Vinted (même annonce, par transaction) n\'est pas comptée', JSON.stringify(main));
    const decl = RG.ventesDeclarables({ vinted, versements: { '900': '2026-10-22T10:00:00Z' }, declare: {}, main });
    const oct = decl.lignes.filter((l) => l.ym === '2026-10');
    const somme = oct.reduce((t, l) => t + l.eur, 0);
    dit(oct.length === 2 && somme === 115 && oct.filter((l) => l.plateforme === 'Ailleurs').length === 1, 'V6 CA d\'octobre (URSSAF) = 70 € Vinted + 45 € main propre, chacune UNE fois', JSON.stringify(oct.map((l) => [l.id, l.ym, l.eur])));
    const declD = RG.ventesDeclarables({ vinted, versements: { '900': '2026-10-22T10:00:00Z' }, declare: {}, main: [...main, ...main] });
    dit(declD.lignes.filter((l) => l.plateforme === 'Ailleurs').length === 1, 'V7 la même vente passée deux fois ⇒ comptée une fois (identité main:<annonce>)');
    const vf = RG.ventesFaites({ vinted, main });
    dit(vf.lignes.length === 2 && vf.lignes.some((l) => l.plateforme === 'Ailleurs' && new Date(l.ts).getDate() === 15 && new Date(l.ts).getMonth() === 9), 'V8 « vendu » : la vente en main propre au jour SAISI (15 oct.)', JSON.stringify(vf.lignes));
    const ben = ctx.VAB({ lbc: [], ebay: [], vestiaire: [], numeros: { '9001': { numero: '124', buyPrice: '20' } }, achat: (f) => Number(f.buyPrice), numLbc: () => null, numEbayLigne: () => null, main });
    dit(ben.length === 1 && ben[0].eur === 45 && ben[0].achat === 20 && ben[0].plateforme === 'Ailleurs', 'V9 bénéfice : 45 € vendu, 20 € d\'achat (son N°)', JSON.stringify(ben));
  });

  // ── R · la voix ──────────────────────────────────────────────────────────
  await essaie('R', async () => {
    const m = RV.ventesDuMois('vendues en octobre', MAINT);
    dit(m && m.ym === '2026-10' && m.from.getDate() === 1 && m.to.getDate() === 31 && m.label === 'Octobre 2026', 'R1 « vendues en octobre » ⇒ octobre 2026, du 1er au 31', JSON.stringify(m));
    const d = RV.ventesDuMois('mes ventes de décembre', MAINT);
    dit(d && d.ym === '2025-12', 'R2 « mes ventes de décembre » dit en novembre ⇒ décembre PASSÉ', JSON.stringify(d));
    dit(RV.ventesDuMois('air max octobre', MAINT) === null && RV.ventesDuMois('Nike taille 42', MAINT) === null, 'R3 un mois sans « vendu/ventes » reste du texte libre');
    const q = (t) => RV.requeteDeLaVoix(t);
    dit(q('numéro 124').requete === '124' && q('numéro 124').numero && q('N 124').requete === '124' && q('Nike taille quarante-deux').requete === 'Nike taille 42',
      'R4 « numéro 124 », « N 124 », « Nike taille 42 » : la recherche d\'avant, inchangée');
  });

  // ── C · le branchement dans l'app ────────────────────────────────────────
  await essaie('C', async () => {
    const app = lire('src/App.jsx'), compta = lire('src/ecrans/Compta.jsx'), push = lire('api/push.js');
    const n = (app.match(/main: ventesAilleursDe\(/g) || []).length + (compta.match(/main: ventesAilleursDe\(/g) || []).length;
    dit(n >= 9, 'C1 chaque calcul de CA, de vendu et de bénéfice reçoit les ventes « vendu ailleurs » (une règle)', String(n));
    dit(/action === 'prixachat'/.test(push) && /notifierPrixAchat\(body\)/.test(push), 'C2 /api/push porte l\'action `prixachat`');
    dit(/<VenduAilleurs/.test(app) && /blocVenduAilleurs\(p, rn, etat\)/.test(app), 'C3 la fiche de la paire porte « Vendu ailleurs »');
    dit(/id: 'prix-achat-vente'/.test(app) && /<PrixAchatCoque/.test(app), 'C4 Ma journée porte la carte, la coque la feuille');
    dit(/ventesDuMois\(t\)/.test(app) && /ventesDuMois\(qBrut\)/.test(app), 'C5 la voix ET la frappe comprennent « vendues en octobre »');
    const fns = fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js')).length;
    dit(fns <= 12, 'C6 12 fonctions api/ au plus', String(fns));
  });
  return ko;
}

(async () => {
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    if (await audit(null, false)) { console.log('❌ l’audit n’est pas vert sur le code actuel'); process.exit(1); }
    for (const [nom, m] of Object.entries(MUTATIONS)) {
      let k; try { k = await audit(m, false); } catch (e) { k = 1; }
      console.log((k ? '✅ ' : '❌ ') + `mutation « ${nom} » ⇒ ${k ? 'ROUGE' : 'encore vert'}`);
      if (!k) rate++;
    }
    console.log(rate ? `\n${rate} mutation(s) passent inaperçues` : `\nles ${Object.keys(MUTATIONS).length} mutations sont toutes vues`);
    process.exit(rate ? 1 : 0);
  }
  const ko = await audit(null, true);
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nSaisie rapide : tout est vert.');
  process.exit(ko ? 1 : 0);
})();
