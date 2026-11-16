// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA FIABILITÉ AUTOMATIQUE (15 nov., lot fiabilite-auto)
//   node scripts/audit-fiabilite-auto.cjs            → les contrôles (EXÉCUTÉS)
//   node scripts/audit-fiabilite-auto.cjs --prouve   → + chaque règle réaffaiblie ⇒ ROUGE
//   AUDIT_RACINE=<arbre> node scripts/audit-fiabilite-auto.cjs → sur un autre arbre (§6.1)
// Aucune donnée réelle : des comptes, des N° et des montants INVENTÉS.
//   A. Le contrôle de nuit, les règles (src/controleNuit.js) : vente récente sans N° (par
//      IDENTITÉ seulement, « annonce pas connue » ≠ « sans N° »), liste des N° rétrécie,
//      lecture « en ligne » de plus de 24 h, totaux du mois (jamais sur une publication plus
//      ancienne que la source), signature de la notification ; « ventes à dater » muet.
//   B. Le contrôle de nuit, le SERVEUR (api/_lib/controle-nuit.js `controleVendeur`) contre
//      une fausse base qui sert la forme PROJETÉE (alias du `select=`) : deux paires
//      PRÉSENTES sous un N° (une masquée par Vinted), une lecture ratée ⇒ « pas su » (jamais
//      0), la vraie règle du bilan (`calculerBilan`) pour les totaux ; la notification du
//      matin (`notifierControle`) : une seule, mémo écrit AVANT et confirmé, rien de neuf ⇒
//      rien ; le texte (api/_lib/notif-redaction.js) : ≤ 40 / ≤ 90, 5 langues, aucun N°.
//   C. Les plantages : 3 personnes ou ouverture bloquée, une fois par jour, propriétaire
//      jamais compté, appareil dans une liste fermée ; le rapport agrégé et anonyme ; la
//      route au propriétaire seul ; le morceau périmé qui REVIENT après le rechargement.
//   D. L'extension de ce navigateur, la santé de chaque compte, « Tout va bien ? · N points ».
//   E. La copie de la règle des masquées est EXACTE ; Ma journée ne porte plus la carte.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync, spawnSync } = require('child_process');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(RACINE, rel)).href);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).slice(0, 300)); } };
const H = 3600e3, J = 864e5;
const T0 = Date.parse('2026-11-15T05:10:00Z');

async function controles() {
  // ── A. LES RÈGLES DU CONTRÔLE DE NUIT ─────────────────────────────────────────
  await essaie('A', async () => {
    const C = await imp('src/controleNuit.js');
    const fiches = { 9001: { numero: 12 }, 9002: { numero: 'B230' }, 9003: { numero: '' }, 9005: { numero: '14+15' } };
    const txItem = new Map([['501', '9001'], ['502', '9003'], ['503', '9004'], ['505', '9005']]);
    const ventes = [
      { tx: 501, ts: T0 - 2 * J }, { tx: 502, ts: T0 - 1 * J }, { tx: 503, ts: T0 - 3 * J }, { tx: 504, ts: T0 - 1 * J },
      { tx: 505, ts: T0 - 1 * J }, { tx: 506, ts: T0 - 20 * J }, { tx: 507, ts: T0 - J, annulee: true }, { tx: 508, ts: T0 - J },
    ];
    txItem.set('506', '9003'); txItem.set('507', '9003'); txItem.set('508', '9003');
    const r = C.ventesSansNumero({ ventes, txItem, fiches, overrides: { 508: { numero: '33' } }, liens: {}, maintenant: T0 });
    dit(JSON.stringify(r) === JSON.stringify(['502', '503']), 'A1 vente récente sans N° : par identité (transaction → annonce → fiche), une vente dont l’annonce n’est pas connue n’est pas comptée, ni une annulée, ni une ancienne, ni une vente au N° posé sur la transaction', r);
    dit(C.ventesSansNumero({ ventes, txItem: null, fiches }) === null, 'A2 table transaction → annonce illisible ⇒ « pas su » (null), jamais une liste');
    const p = C.poolRetreci({ pool: [1, 2, 3, '007', 'B230', 15], fiches, overrides: { 9: { numero: 'B231' } }, avant: 9 });
    dit(JSON.stringify(p) === JSON.stringify({ ids: ['12', '14', 'B231', 'moins-3'], n: 6 }), 'A3 liste des N° rétrécie : un N° porté par une fiche ou une vente absent de la liste (lot 14+15 compris), et la liste plus courte que la nuit d’avant', p);
    dit(JSON.stringify(C.poolRetreci({ pool: [12, 14, 15, 'B230'], fiches, avant: 4 })) === JSON.stringify({ ids: [], n: 4 }), 'A4 liste complète et inchangée ⇒ aucun écart');
    const pc = new Map([['111', { aConfirmer: [{ id: 1 }] }], ['222', { aConfirmer: [] }], ['333', { aConfirmer: [{ id: 2 }] }]]);
    dit(JSON.stringify(C.enLigneVieux(pc, new Set(['111', '222']))) === '["111"]', 'A5 lecture « en ligne » de plus de 24 h : seulement les comptes GARDÉS');
    const src = { vendu: { etat: 'su', n: 5, eur: 400 }, recu: { etat: 'su', eur: 250 } };
    const e1 = C.ecartsTotaux({ src, sourceAt: T0 - 2 * H, widget: { at: T0 - H, n: 4, eur: 400.4 }, urssaf: { at: T0 - H, eur: 230 }, benefice: { at: T0 - 3 * H, n: 6 }, ym: '2026-11' });
    dit(JSON.stringify(e1.ecarts) === JSON.stringify(['widget-n', 'recu-ca', 'benefice-n']), 'A6 totaux du mois : le widget, le reçu et le bénéfice comparés à leur source (1 € de tolérance)', e1);
    const e2 = C.ecartsTotaux({ src, sourceAt: T0, widget: { at: T0 - H, n: 1, eur: 9 }, urssaf: { at: T0 - H, eur: 9 }, ym: '2026-11' });
    dit(!!e2.passu && !e2.ecarts, 'A7 une publication plus ANCIENNE que la dernière lecture des ventes n’est jamais un écart (« pas su », dit)', e2);
    const e3 = C.ecartsTotaux({ src: { vendu: { etat: 'partiel', n: 9, eur: 1 }, recu: { etat: 'pas-su', eur: 0 } }, sourceAt: T0 - 2 * H, widget: { at: T0, n: 1, eur: 1 }, ym: '2026-11' });
    dit(!!e3.passu, 'A8 une source partielle n’est jamais comparée', e3);
    const data = C.resultatControle({ 'numeros-double': ['12'], 'vente-sans-numero': ['502'], 'versement-30j': 1741, 'totaux-mois': ['widget-n'] }, {}, T0, {}, { pool: 6 });
    dit(data.pool === 6 && data.controles['numeros-double'].n === 1, 'A9 le résultat range des nombres et des identifiants, et le nombre de la liste pour la nuit suivante');
    const n1 = C.aNotifierControle(data, null, T0 + 60e3);
    dit(n1 && n1.lignes.map((l) => l.cle).join() === 'numeros-double,vente-sans-numero', 'A10 la notification : seulement les écarts RÉELS qui demandent un geste (jamais les totaux, jamais « à dater »)', n1);
    dit(C.aNotifierControle(data, C.memoControleApres(n1, T0), T0 + 2 * 60e3) === null, 'A11 la même signature qu’hier ⇒ rien de neuf, rien envoyé');
    dit(C.aNotifierControle({ ...data, at: new Date(T0 - 40 * H).toISOString() }, null, T0) === null, 'A12 un contrôle de plus de 36 h ne notifie pas');
    dit(!C.CLES_CONTROLES.includes('versement-30j') && !C.CONTROLES_NOTIFIES.has('versement-30j') && !C.CONTROLES_NOTIFIES.has('totaux-mois'), 'A13 « ventes à dater » n’est plus un contrôle (décision de Julien, 5.390), les totaux jamais notifiés');
  });

  // ── B. LE SERVEUR ─────────────────────────────────────────────────────────────
  await essaie('B', async () => {
    const S = await imp('api/_lib/controle-nuit.js');
    const B = await imp('api/_lib/bilan-semaine.js');
    const iso = (t) => new Date(t).toISOString();
    const ym = '2026-11';
    const items111 = [
      { id: 7001, title: 'Paire A', is_closed: false, is_hidden: false, is_draft: false },
      { id: 7002, title: 'Paire B', is_closed: false, is_hidden: true, is_draft: false },     // masquée par Vinted : PRÉSENTE
      { id: 7003, title: 'Paire C', is_closed: false, is_hidden: false, is_draft: false },
    ];
    const items222 = [{ id: 8001, title: 'Autre', is_closed: false, is_hidden: false, is_draft: false }];
    const fiches = { 7001: { numero: 12 }, 7002: { numero: '12' }, 7003: { numero: 40 }, 8001: { numero: 41 }, 9100: { numero: 50 } };
    const base = (o = {}) => ({
      main: [{ fiches, retirees: {}, masques: [], aDater: { plus30: { n: 3 } }, pool: [12, 40, 41, 50], ov: {}, liens: {}, recu: { [ym]: 120 }, urssafAt: String(T0 - 30 * 60e3), benef: { '2026-11-10': [2, 0, 0], '2026-11-12': [1, 0, 0] }, benefAt: String(T0 - 40 * 60e3), perdues: {} }],
      listings: [
        { id: 'harvest_111_listings', cap: iso(T0 - 2 * H), uid: 111, items: items111 },
        { id: 'harvest_222_listings', cap: iso(T0 - 30 * H), uid: 222, items: items222 },
      ],
      enligne: [], supp: [], comptes: [{ vinted_user_id: '111' }, { vinted_user_id: '222' }], panneau: [{ d: {} }], etats: [{ comptes: {} }], noirs: [{ uids: [] }],
      captures: [{ id: 'harvest_111_listings', uid: '111', cap: iso(T0 - 2 * H), type: 'listings' }, { id: 'harvest_222_listings', uid: '222', cap: iso(T0 - 30 * H), type: 'listings' }],
      widget: [{ vm: '2', ca: '150', at: iso(T0 - 20 * 60e3) }], avant: [{ pool: '6' }], ...o,
    });
    const route = (b, panne) => async (chemin) => {
      const c = decodeURIComponent(chemin);
      if (panne && panne.test(c)) return null;
      if (/id=eq\.main&/.test(c)) return b.main;
      if (/harvest_%_listings/.test(c)) return b.listings;
      if (/harvest_%_enligne/.test(c)) return b.enligne;
      if (/harvest_%_supprimees/.test(c)) return b.supp;
      if (/^vinted_accounts/.test(c)) return b.comptes;
      if (/panel_accounts_off/.test(c)) return b.panneau;
      if (/panel_comptes_etat/.test(c)) return b.etats;
      if (/vrm_blocked_accounts/.test(c)) return b.noirs;
      if (/widget_stats/.test(c)) return b.widget;
      if (/id=eq\.vrm_controle_nuit&/.test(c)) return b.avant;
      if (/harvest_%&meta/.test(c)) return b.captures;
      return [];
    };
    const commande = (tx, t, eur, status = 'Commande finalisée') => ({ transaction_id: tx, id: tx, date: iso(t), status, price: { amount: String(eur), currency_code: 'EUR' }, title: 'x' });
    const bilan = () => ({
      comptes: [{ uid: '111', login: 'compte_a' }, { uid: '222', login: 'compte_b' }],
      commandes: { 111: { orders: [commande(601, T0 - 2 * J, 100), commande(602, T0 - J, 50)], cap: iso(T0 - H) }, 222: { orders: [commande(603, T0 - 3 * J, 40, 'Envoyée')], cap: iso(T0 - 2 * H) } },
      masquesTx: new Set(), masquesComptes: new Set(), exclusAutres: null, panneau: {}, regle: null, lbc: [], ebay: [], vestiaire: [],
      versements: { 601: iso(T0 - 2 * H), 602: iso(T0 - 3 * H) }, txItem: { 601: '7003', 602: '9200', 603: '8001' }, main: {}, decisions: null,
    });
    const ecrits = [];
    const ecrire = async (id, data) => { ecrits.push({ id, data }); return true; };
    const r = await S.controleVendeur({ lireTout: route(base()), ecrire, maintenant: T0, lireBilan: bilan, calculer: B.calculerBilan });
    const c = ecrits.length && ecrits[0].data.controles;
    dit(r.ecrit && ecrits.length === 1 && ecrits[0].id === 'vrm_controle_nuit', 'B1 UNE écriture : sa ligne `vrm_controle_nuit`', ecrits.map((e) => e.id));
    dit(c && c['numeros-double'].n === 1 && c['numeros-double'].ids[0] === '12', 'B2 deux paires PRÉSENTES sous le N°12 : l’une en ligne, l’autre masquée par Vinted (la paire est toujours chez lui)', c && c['numeros-double']);
    dit(c && c['vente-sans-numero'].n === 1 && c['vente-sans-numero'].ids[0] === '602', 'B3 la vente récente dont l’annonce n’a pas de fiche est nommée par son n° de transaction', c && c['vente-sans-numero']);
    dit(c && c['pool-retreci'].n === 1 && c['pool-retreci'].ids.join() === 'moins-2' && ecrits[0].data.pool === 4, 'B4 la liste des N° : 4 au lieu de 6 la nuit d’avant ⇒ dit, rien réparé', c && c['pool-retreci']);
    dit(c && c['enligne-24h'].n === 1 && c['enligne-24h'].ids[0] === '222', 'B5 le compte dont le dressing a été lu il y a 30 h ⇒ « annonces pas relues depuis 24 h »', c && c['enligne-24h']);
    dit(c && Number.isInteger(c['totaux-mois'].n), 'B6 les totaux du mois comparés par la VRAIE règle du bilan (`calculerBilan`)', c && c['totaux-mois']);
    dit(c && JSON.stringify(c['totaux-mois'].ids) === JSON.stringify(['widget-n', 'widget-ca']) || (c && c['totaux-mois'].ids.includes('widget-n')), 'B7 le widget dit 2 ventes / 150 € quand la source en a 3 / 190 € ⇒ écart nommé', c && c['totaux-mois']);
    // Une lecture ratée ⇒ pas su (n: null + raison), les autres continuent.
    ecrits.length = 0;
    await S.controleVendeur({ lireTout: route(base(), /harvest_%_listings/), ecrire, maintenant: T0, lireBilan: bilan, calculer: B.calculerBilan });
    const c2 = ecrits[0].data.controles;
    dit(c2['numeros-double'].n === null && c2['enligne-24h'].n === null && c2['numeros-double'].raison && Number.isInteger(c2['vente-sans-numero'].n), 'B8 annonces illisibles ⇒ « pas su » avec la raison (jamais 0), les autres contrôles continuent', c2);
    ecrits.length = 0;
    await S.controleVendeur({ lireTout: route(base()), ecrire, maintenant: T0, lireBilan: async () => { throw new Error('base'); }, calculer: B.calculerBilan });
    const c3 = ecrits[0].data.controles;
    dit(c3['vente-sans-numero'].n === null && c3['totaux-mois'].n === null, 'B9 ventes illisibles ⇒ ventes sans N° et totaux « pas su »', c3);
    ecrits.length = 0;
    await S.controleVendeur({ lireTout: route(base({ widget: [{ vm: '2', ca: '150', at: iso(T0 - 5 * H) }] })), ecrire, maintenant: T0, lireBilan: bilan, calculer: B.calculerBilan });
    const c4 = ecrits[0].data.controles;
    dit(!(c4['totaux-mois'].ids || []).some((x) => /^widget/.test(x)), 'B10 un widget publié AVANT la dernière lecture des ventes n’est pas comparé', c4['totaux-mois']);
    const sansId = JSON.stringify(ecrits);
    dit(!/compte_a|compte_b|Paire|€/.test(sansId), 'B11 rien de personnel dans la ligne : ni pseudo, ni titre, ni montant');
    // La notification du matin.
    const memo = new Map();
    const envois = [];
    let memoOk = true;
    const getRow = async (id) => (memo.has(id) ? memo.get(id) : null);
    const ecrireM = async (id, d) => { if (!memoOk) return false; memo.set(id, d); return true; };
    const pousser = async (n) => { envois.push({ n, memo: memo.get('vrm_controle_nuit_dit') }); return { sent: 1 }; };
    const data = { ...r.data };
    const n1 = await S.notifierControle({ data, getRow, ecrire: ecrireM, pousser, maintenant: T0 });
    dit(n1.envoye && envois.length === 1 && envois[0].memo && envois[0].n.redaction.sorte === 'controleNuit', 'B12 un écart réel ⇒ UNE notification, le mémo écrit AVANT l’envoi', n1);
    dit(envois[0].n.redaction.lignes.every((l) => Object.keys(l).join() === 'cle,n') && envois[0].n.url === '/?tab=settings&section=toutvabien', 'B13 la notification ne porte que des clés et des nombres, et ouvre « Tout va bien ? »', envois[0].n);
    const n2 = await S.notifierControle({ data, getRow, ecrire: ecrireM, pousser, maintenant: T0 + 60e3 });
    dit(!n2.envoye && envois.length === 1, 'B14 le lendemain, le même écart ⇒ rien envoyé', n2);
    memo.clear(); memoOk = false;
    const n3 = await S.notifierControle({ data, getRow, ecrire: ecrireM, pousser, maintenant: T0 });
    dit(!n3.envoye && envois.length === 1, 'B15 mémo pas écrit ⇒ rien envoyé', n3);
    memoOk = true;
    const n4 = await S.notifierControle({ data, getRow: async () => undefined, ecrire: ecrireM, pousser, maintenant: T0 });
    dit(!n4.envoye && envois.length === 1, 'B16 mémo illisible ⇒ rien envoyé', n4);
    const n5 = await S.notifierControle({ data, getRow, ecrire: ecrireM, pousser, active: async () => false, maintenant: T0 });
    dit(!n5.envoye, 'B17 « Rappels » éteint par le vendeur ⇒ rien');
    const sansEcart = { v: 1, at: new Date(T0).toISOString(), controles: { 'numeros-double': { n: 0, ids: [] }, 'totaux-mois': { n: 2, ids: ['widget-n', 'recu-ca'] }, 'versement-30j': { n: 900 } } };
    const n6 = await S.notifierControle({ data: sansEcart, getRow, ecrire: ecrireM, pousser, maintenant: T0 });
    dit(!n6.envoye, 'B18 des totaux à recompter ou des ventes à dater ne réveillent personne', n6);
    const R = await imp('api/_lib/notif-redaction.js');
    const lignes = [{ cle: 'numeros-double', n: 2 }, { cle: 'vente-sans-numero', n: 1 }, { cle: 'enligne-24h', n: 3 }];
    let bon = true; const vus = [];
    for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = R.rediger({ sorte: 'controleNuit', lignes }, { langue: l }); vus.push(t && t.title); if (!t || t.title.length > 40 || t.body.length > 90 || /N°\s?\d/.test(t.title + t.body)) bon = false; }
    dit(bon && new Set(vus).size === 5, 'B19 le texte : titre ≤ 40, corps ≤ 90, 5 langues, aucun N° ni identifiant', vus);
    dit(R.rediger({ sorte: 'controleNuit', lignes: [{ cle: 'numeros-double', n: 0 }] }) === null, 'B20 rien à dire ⇒ aucun texte');
    const cron = fs.readFileSync(path.join(RACINE, 'api', 'ship-reminders.js'), 'utf8');
    dit(cron.includes('lireBilan: lireDonneesBilan, calculer: calculerBilan })') && /notifierControle\(\{ data: controle && controle\.data/.test(cron), 'B21 le cron du MATIN (pas une 13ᵉ fonction) passe la lecture du bilan et notifie');
  });

  // ── C. LES PLANTAGES ──────────────────────────────────────────────────────────
  await essaie('C', async () => {
    const AP = await imp('src/alertesPlantages.js');
    dit(AP.appareilAlerte('iOS Safari') === 'iOS Safari' && AP.appareilAlerte('Mozilla/5.0 (iPhone…)') === '' && AP.appareilAlerte('julien@x.fr Chrome') === '', 'C1 l’appareil : deux mots d’une liste fermée, rien d’autre');
    let e = {};
    e = AP.compterErreur(e, { message: 'Failed to fetch dynamically imported module: /assets/App-a.js', ecran: 'journee', origine: 'ouverture', appareil: 'iOS Safari' });
    const ev = AP.evenementsAEnvoyer(e);
    dit(ev.length === 1 && ev[0].bloque === true && ev[0].appareil === 'iOS Safari', 'C2 une ouverture bloquée part dès la première fois, avec l’appareil', ev);
    const jour = (types) => ({ types });
    dit(AP.alerteDue(jour({ a: { n: 9, appareils: ['x', 'y'], notifie: 0 } }), T0).enAttente.length === 0, 'C3 deux personnes ⇒ aucune notification');
    dit(AP.alerteDue(jour({ a: { n: 3, appareils: ['x', 'y', 'z'], notifie: 0 } }), T0).due, 'C4 trois personnes ⇒ notification');
    dit(AP.alerteDue(jour({ a: { n: 1, appareils: ['x'], bloque: 1, notifie: 0 } }), T0).due, 'C5 une seule personne dont l’app ne s’ouvre plus ⇒ notification');
    dit(!AP.alerteDue(jour({ a: { n: 8, appareils: ['x', 'y', 'z', 'w'], notifie: 3 } }), T0).due, 'C6 déjà dit aujourd’hui ⇒ rien de plus');
    const apres = AP.apresNotification({ types: { a: { n: 3, appareils: ['x', 'y', 'z'] }, b: { n: 5, appareils: ['x'] } }, rev: 1 }, T0);
    dit(apres.types.a.notifie === 3 && !apres.types.b.notifie, 'C7 seul ce qui a été DIT est marqué : l’erreur d’une personne le sera si elle en touche trois');
    const t = AP.texteAlerte([{ cle: 'a', ecrans: ['journee'], n: 2, appareils: 1, bloque: true }], (x) => x);
    dit(t && /ne s’ouvre plus/.test(t.title) && t.title.length <= 40 && t.body.length <= 90, 'C8 « L’app ne s’ouvre plus chez 1 personne » (≤ 40 / ≤ 90)', t);
    // Le journal des vendeurs : le propriétaire jamais compté, versions et ouvertures.
    const PC = await imp('api/_lib/plantages-comptes.js');
    const at = new Date(T0 - H).toISOString();
    const lignes = [
      { owner: 'v1', message: 'Erreur X', ecran: 'ventes', origine: 'page', navigateur: 'iOS Safari', version: '15 novembre à 10:00', at },
      { owner: 'v2', message: 'Erreur X', ecran: 'ventes', origine: 'demarrage', navigateur: 'Mac Chrome', version: '15 novembre à 10:00', at },
      { owner: 'proprio', message: 'Erreur X', ecran: 'ventes', origine: 'page', navigateur: 'Mac Chrome', version: '15 nov. à 10:00', at },
      { owner: 'proprio', message: 'Erreur du propriétaire seul', ecran: 'ventes', origine: 'page', navigateur: 'Mac Chrome', at },
    ];
    const g = PC.plantagesParComptes(lignes, T0 - 7 * J, 'proprio');
    dit(g.length === 1 && g[0].comptes === 2 && g[0].bloque === 1 && g[0].versions[0] === '15 novembre à 10:00', 'C9 le rapport : 2 personnes (le propriétaire exclu), la version, l’ouverture bloquée', g);
    const RP = await imp('api/_lib/rapport-plantages.js');
    const rap = RP.rapportPlantages({ comptes: g, terrain: [{ jour: '2026-11-15', types: [{ cle: 'morceau', message: 'Failed to fetch dynamically imported module', ecrans: [{ e: 'journee', nom: 'Ma journée' }], n: 2, appareils: 1, bloque: 2, navigateurs: { 'iOS Safari': 2 }, versions: [], dernier: at }] }],
      mesures: [{ jour: '2026-11-14', lignes: [{ ecran: 'ventes', appareil: 'telephone', metrique: 'morceau', n: 4 }, { ecran: 'ventes', metrique: 'peu', n: 50 }] }] });
    dit(rap.types.length === 2 && rap.types.find((x) => x.cle === 'morceau').bloque === 2 && rap.types.find((x) => x.cle === 'morceau').appareils[0] === 'iOS Safari' && rap.morceaux.n === 4 && rap.seuil === 3, 'C10 le rapport réunit les journaux, les ouvertures bloquées (morceaux périmés compris) et les morceaux comptés par les appareils', rap);
    const r0 = RP.rapportPlantages({ comptes: null, terrain: null, mesures: null });
    dit(r0.types === null && r0.morceaux === null, 'C11 rien de lu ⇒ « pas su » (null), jamais 0');
    dit(!/v1|v2|proprio/.test(JSON.stringify(rap)), 'C12 aucun identifiant de vendeur ne sort');
    // La route : au propriétaire seul, par la vraie fonction.
    const MT = await imp('api/_lib/mesures-terrain.js');
    process.env.SUPABASE_SERVICE_KEY = 'cle-de-banc';
    const JULIEN = '11111111-1111-4111-8111-111111111111';
    const rep = (c, st = 200) => new Response(JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });
    const fetcher = async (url) => {
      const u = decodeURIComponent(String(url));
      if (/vrm_reglages/.test(u)) return rep([{ valeur: JULIEN }]);
      if (/rpc\//.test(u)) return rep(true);
      if (/id=like\.plantage_\*/.test(u)) return rep([{ owner: 'v1', message: 'Erreur X', ecran: 'ventes', origine: 'page', navigateur: 'iOS Safari', version: '15 nov.', n: '1', at }, { owner: JULIEN, message: 'Erreur X', ecran: 'ventes', origine: 'page', navigateur: 'iOS Safari', n: '1', at }]);
      if (/plantages_terrain_/.test(u)) return rep([]);
      return rep([]);
    };
    const a = await MT.listerMesures({ utilisateur: { id: JULIEN }, quoi: 'rapport-plantages', fetcher });
    const b = await MT.listerMesures({ utilisateur: { id: '22222222-2222-4222-8222-222222222222' }, quoi: 'rapport-plantages', fetcher });
    dit(a.code === 200 && a.corps.ok && Array.isArray(a.corps.types) && a.corps.types[0] && a.corps.types[0].personnes === 1, 'C13 la route rend le rapport au propriétaire (lui-même jamais compté)', a);
    dit(b.code === 403, 'C14 un autre compte : 403', b.code);
    // Les plantages du PROPRIÉTAIRE ne comptent pour aucune personne : rien n'est rangé pour eux.
    const ecritsT = [], corpsT = [];
    const fetcherT = async (url, o = {}) => { const u = decodeURIComponent(String(url)); if ((o.method || 'GET') !== 'GET' && /plantages_terrain_|on_conflict/.test(u)) { ecritsT.push(u); try { corpsT.push(JSON.parse(o.body)); } catch (_) {} } if (/vrm_reglages/.test(u)) return rep([{ valeur: JULIEN }]); if (/rpc\//.test(u)) return rep(true); if ((o.method || 'GET') === 'GET') return rep([]); return rep([{ id: 'x' }], 201); };
    const corps = JSON.stringify({ v: 1, h: {}, p: [{ ecran: 'ventes', message: 'Erreur du propriétaire', version: '15 novembre à 10:00', n: 4, garde: true }], jeton: 'a.b.c' });
    const rp = await MT.recevoirMesures({ corps, verifierJeton: async () => ({ id: JULIEN }), fetcher: fetcherT, maintenant: T0 });
    // (16 nov., lot anti-bug) RANGÉS à part (`proprio`), jamais une « personne touchée », jamais à dire :
    // avant, rien n'était rangé et le journal restait vide alors que Julien voyait des bugs.
    const typeP = (() => { const l = corpsT.find((c) => Array.isArray(c) && c[0] && /plantages_terrain_/.test(c[0].id)); const t = l && l[0].data && Object.values(l[0].data.types || {})[0]; return t || null; })();
    dit(rp.code === 200 && ecritsT.length === 1 && !!typeP && typeP.proprio === 4 && typeP.appareils.length === 0 && !AP.typeADire(typeP), 'C14b le propriétaire : ses plantages sont RANGÉS (proprio ×4), jamais une « personne touchée », jamais à dire', { rp, ecritsT, typeP });
    const rv = await MT.recevoirMesures({ corps, verifierJeton: async () => ({ id: '33333333-3333-4333-8333-333333333333' }), fetcher: fetcherT, maintenant: T0 });
    dit(rv.code === 200 && ecritsT.length >= 1, 'C14c un autre vendeur : rangé', { rv, ecritsT });
    // (16 nov., lot anti-bug) Une promesse rejetée et un morceau qui ne se charge pas partent dès la 1re fois ;
    // une erreur de page ordinaire attend toujours 3 répétitions.
    {
      const e1 = AP.compterErreur({}, { message: 'Erreur de promesse', ecran: 'ventes', origine: 'promesse' }, { maintenant: T0 });
      const e2 = AP.compterErreur(e1, { message: 'Failed to fetch dynamically imported module', ecran: 'journee', origine: 'morceau' }, { maintenant: T0 });
      const e3 = AP.compterErreur(e2, { message: 'Erreur de page', ecran: 'ventes', origine: 'page' }, { maintenant: T0 });
      const ev = AP.evenementsAEnvoyer(e3);
      const par = Object.fromEntries(ev.map((x) => [x.origine, x]));
      dit(ev.length === 2 && par.promesse && par.promesse.n === 1 && par.morceau && par.morceau.n === 1 && !par.page, 'C14d promesse et morceau partent dès la 1re fois (origine dite), la page attend 3 fois', ev);
      const norm = AP.normaliserEvenements([{ message: 'x', n: 1, origine: 'nimporte' }, { message: 'y', n: 1, origine: 'morceau' }]);
      dit(!('origine' in norm[0]) && norm[1].origine === 'morceau', 'C14e l’origine passe par une liste fermée', norm);
    }
    // Le morceau périmé qui revient APRÈS le rechargement : il bloque l'ouverture.
    const store = {}, sess = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: (k) => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: (k) => { delete sess[k]; } };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Safari/605' }, configurable: true }); } catch (_) {}
    global.window = global.window || { dispatchEvent: () => {} };
    const P = await imp('src/plantages.js');
    P.noterPlantage(new Error('Failed to fetch dynamically imported module: https://vrm.center/assets/Ventes-a.js'), { origine: 'ecran', ecran: 'ventes', version: '15 nov.' });
    // (16 nov., lot anti-bug) Rattrapé, il part quand même — origine « morceau », jamais « ouverture » (rien à notifier).
    const att0 = store.vrm_alertes_attente ? JSON.parse(store.vrm_alertes_attente) : [];
    dit(att0.length === 1 && att0[0].origine === 'morceau', 'C15 un morceau périmé rattrapé par le rechargement : remonté (origine « morceau »), jamais une ouverture bloquée', att0);
    sess.vrm_recharge_morceau = String(Date.now() - 5000);
    P.noterPlantage(new Error('Failed to fetch dynamically imported module: https://vrm.center/assets/Ventes-a.js'), { origine: 'ecran', ecran: 'ventes', version: '15 nov.' });
    const att = store.vrm_alertes_attente ? JSON.parse(store.vrm_alertes_attente) : [];
    dit(att.length === 2 && att[1].origine === 'ouverture' && att[1].appareil === 'iOS Safari', 'C16 le même morceau 5 s APRÈS le rechargement : l’ouverture est bloquée, l’alerte attend la collecte (appareil en deux mots)', att);
    const recus = [];
    P.brancherAlertes((x) => recus.push(x));
    dit(recus.length === 2 && JSON.parse(store.vrm_alertes_attente || '[]').length === 0, 'C17 la collecte branchée reprend les alertes en attente (une fois)', recus);
  });

  // ── D. EXTENSION D'ICI, SANTÉ DES COMPTES, POINTS ─────────────────────────────
  await essaie('D', async () => {
    const F = await imp('src/fiabilite/regles.js');
    const inst = { boutique: false, lien: '/VRM-extension.zip' };
    const r1 = F.retardIci({ on: true, v: '5.329.0', attendue: '5.385.0', nav: 'chrome', nomNav: 'Chrome', inst });
    dit(r1 && r1.version === '5.329' && r1.attendue === '5.385' && r1.lien === '/VRM-extension.zip' && !r1.boutique, 'D1 « Ce Chrome a la 5.329 : installe la 5.385 » avec le zip', r1);
    dit(F.retardIci({ on: true, v: '5.385.0', attendue: '5.385.0', inst }) === null && F.retardIci({ on: true, v: '5.390.0', attendue: '5.385.0', inst }) === null, 'D2 jamais pour une version publiée à jour (ni plus récente)');
    dit(F.retardIci({ on: false, v: '', attendue: '5.385.0' }) === null, 'D3 pas d’extension ici ⇒ rien');
    const m = F.retardIci({ on: true, v: '', attendue: '5.385.0', nav: 'orion', nomNav: 'Orion', inst: { boutique: true, lien: 'https://x' } });
    dit(m && m.version === '' && m.lien === '/VRM-Orion.xpi' && !m.boutique, 'D4 muette (avant la 5.26) = ancienne ; Orion : son paquet, jamais une boutique', m);
    const bq = F.retardIci({ on: true, v: '5.329.0', attendue: '5.385.0', nav: 'chrome', nomNav: 'Chrome', inst: { boutique: true, lien: 'https://chromewebstore.google.com/detail/abc', nomBoutique: 'Chrome Web Store' } });
    dit(bq && bq.boutique === 'https://chromewebstore.google.com/detail/abc', 'D5 la fiche de la boutique, seulement quand elle est publiée');
    const lignes = [
      { plateforme: 'vinted', id: '111', nom: 'compte_a', etat: 'lu', lu: T0 - H, bloque: '', geste: false },
      { plateforme: 'vinted', id: '222', nom: 'compte_b', etat: 'lu', lu: T0 - H, bloque: '', geste: false },
      { plateforme: 'leboncoin', id: 'lbc1', nom: 'Boutique', etat: 'a-relire', lu: T0 - 40 * H, bloque: 'ouvre leboncoin', geste: true },
      { plateforme: 'vinted', id: '333', nom: 'compte_c', etat: 'lu', lu: T0 - H, bloque: '', geste: false },
    ];
    const appareils = [{ nom: 'Chrome · Mac', ver: '5.329.0', code: '5.329.0', at: T0, vus: { vinted: { 333: T0 - H } } }, { nom: 'Edge · Windows', ver: '5.385.0', code: '5.385.0', at: T0, vus: { vinted: { 111: T0 - 2 * H } } }];
    const actions = [
      { id: 'actions_compte_111_aaaaaaaaaaaaaaaa', captcha: String(T0 - H), arret: 'captcha' },
      { id: 'actions_compte_222_bbbbbbbbbbbbbbbb', prudence: String(T0 + 5 * H), maxp: '20' },
    ];
    const s = F.santeDesComptes({ lignes, comptes: [], appareils, pannes: [], actions, reprises: {}, attendue: '5.385.0', maintenant: T0 });
    const de = (id) => s.find((c) => c.id === id);
    dit(de('111').etat === 'arret' && de('111').arret.quoi === 'captcha' && de('111').appareil.version === '5.385', 'D6 un compte en vérification Vinted : « Arrêté », et l’appareil qui le lit avec sa version', de('111'));
    dit(de('222').etat === 'prudence' && de('222').ton !== 'geste', 'D7 la prudence : dite, sans geste (VRM ralentit tout seul)', de('222'));
    dit(de('333').etat === 'extension' && de('333').appareil.etat === 'ancienne', 'D8 lu par un Chrome en 5.329 : « Extension en retard »', de('333'));
    dit(de('lbc1').etat === 'a-relire' && s[0].ton === 'geste', 'D9 Leboncoin aussi ; ce qui demande un geste d’abord');
    const s2 = F.santeDesComptes({ lignes, appareils, actions, reprises: { 111: T0 - 30 * 60e3 }, attendue: '5.385.0', maintenant: T0 });
    dit(s2.find((c) => c.id === '111').etat !== 'arret', 'D10 après son « Reprendre », la vérification n’arrête plus le compte');
    dit(F.santeDesComptes({ lignes: null }) === null, 'D11 comptes pas lus ⇒ « pas su »');
    dit(!JSON.stringify(s).match(/ventes à dater|aDater|versement/), 'D12 aucune « vente à dater » dans la santé des comptes (décision de Julien)');
    const C = await imp('src/controleNuit.js');
    const ctl = C.resultatControle({ 'numeros-double': ['12'], 'versement-30j': 900, 'comptes-48h': ['222'], 'enligne-24h': ['222'], 'vente-sans-numero': [] }, {}, T0);
    const p = F.pointsToutVaBien({ controle: ctl, installation: null, sante: s, ici: r1, maintenant: T0 + H });
    const cles = p.points.map((x) => x.cle);
    dit(p.etat === 'points' && cles.includes('controle:numeros-double') && cles.includes('controle:enligne-24h') && !cles.includes('controle:versement-30j') && !cles.includes('controle:comptes-48h') && cles.includes('extension:ici'), 'D13 « Tout va bien ? · N points » : chaque écart une fois, jamais « à dater », le compte pas relu dit une seule fois', cles);
    dit(F.pointsToutVaBien({ controle: undefined }).etat === 'lecture' && F.pointsToutVaBien({ controle: null }).etat === 'ok', 'D14 en lecture ⇒ rien affirmé ; aucun contrôle ⇒ aucun point');
    const p0 = F.pointsToutVaBien({ controle: C.resultatControle({ 'numeros-double': [], 'versement-30j': 1741 }, {}, T0), maintenant: T0 });
    dit(p0.n === 0, 'D15 des ventes à dater seules ne font jamais un point');
    // La ligne de fraîcheur : l'extension d'ICI d'abord dite, l'appareil de même version pas répété.
    const FR = await imp('src/fraicheur.js');
    const capture = { comptesPrets: true, lignes: [], pannes: [], passu: [], achats: {}, appareils: [{ id: 'a', nom: 'Chrome · Mac', ver: '5.329.0', code: '5.329.0', at: T0 - 60e3 }, { id: 'b', nom: 'Edge · Windows', ver: '5.300.0', code: '5.300.0', at: T0 - 60e3 }] };
    const fr = FR.fraicheurUnique({ capture, emails: { etat: 'lu', muets: [] }, transp: [], attendue: '5.385.0', maintenant: T0, ici: { ...r1, nom: 'Extension de ce navigateur', texte: 'Ce Chrome a la 5.329 : installe la 5.385' } });
    const cl = fr.retards.map((x) => x.cle);
    dit(cl.includes('version:ici') && cl.includes('version:b') && !cl.includes('version:a') && fr.retards.find((x) => x.cle === 'version:ici').lien === '/VRM-extension.zip', 'D16 la ligne du haut : « Ce Chrome a la 5.329 » avec le zip ; l’appareil de même version pas répété, l’autre gardé', cl);
    const fr0 = FR.fraicheurUnique({ capture: { ...capture, appareils: [] }, emails: { etat: 'lu', muets: [] }, transp: [], attendue: '5.385.0', maintenant: T0, ici: null });
    dit(!fr0.retards.some((x) => x.source === 'version'), 'D17 rien en retard ici ⇒ rien de dit');
  });

  // ── E. LA COPIE, MA JOURNÉE ───────────────────────────────────────────────────
  await essaie('E', async () => {
    process.env.RECOPIE_RACINE = RACINE;
    delete require.cache[require.resolve(path.join(__dirname, '_recopie-masquees.cjs'))];
    const RC = require(path.join(__dirname, '_recopie-masquees.cjs'));
    dit(RC.copieLib() === RC.blocApp(), 'E1 api/_lib/masquees-regle.js est la copie EXACTE du bloc <masquees-regle> de l’app');
    const M = await imp('api/_lib/masquees-regle.js');
    const fermees = [{ id: 1, is_hidden: true }, { id: 2, is_hidden: true, is_closed: true }, { id: 3, is_hidden: true }];
    const pres = M.masqueesPresentes(M.masqueesDuCompte(fermees, {}, T0), { 1: { numero: 5 }, 3: { numero: 6 } }, { x: { id: 3 } });
    dit(pres.map((x) => x.id).join() === '1', 'E2 la copie s’exécute : masquée présente, fermée exclue, masquée déclarée partie exclue');
    const vj = fs.readFileSync(path.join(RACINE, 'src', 'VeilleJournee.jsx'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/etatControle|data-controle/.test(vj), 'E3 Ma journée ne porte plus la carte du contrôle de nuit (elle vit dans « Tout va bien ? »)');
    const tvb = fs.readFileSync(path.join(RACINE, 'src', 'ToutVaBien.jsx'), 'utf8');
    dit(/<FiabiliteToutVaBien etat=\{etat\}\/>/.test(tvb) && /proprio \? <RapportPlantages/.test(tvb), 'E4 « Tout va bien ? » pose le contrôle, la santé des comptes, l’extension d’ici et (propriétaire) le rapport');
  });
}

// ── LES MUTATIONS : chaque règle réaffaiblie doit passer au ROUGE ─────────────
const MUTATIONS = [
  ['src/controleNuit.js', "    if (!item) continue;                       // annonce pas connue : pas su, pas compté", "    if (!item) { out.push({ tx, ts: t }); continue; }", 'une vente à l’annonce inconnue comptée « sans N° »'],
  ['src/controleNuit.js', 'if (Number.isInteger(avant) && avant > P.size)', 'if (false)', 'la liste plus courte que la nuit d’avant passe'],
  ['src/controleNuit.js', 'const frais = (at) => Number.isFinite(at) && Number.isFinite(sourceAt) && at >= sourceAt;', 'const frais = (at) => true;', 'une publication ancienne comparée'],
  ['src/controleNuit.js', '  if (m && m.sig === sig) return null;\n', '', 'la même signature renvoyée'],
  ['src/controleNuit.js', 'export const CLES_CONTROLES = CONTROLES.map((c) => c.cle);', "CONTROLES.push({ cle: 'versement-30j', ou: 'vendeur', nom: 'Ventes sans versement', phrase: (n) => `${n} ventes à dater`, geste: { libelle: 'Voir', aller: '/?tab=compta' } });\nexport const CLES_CONTROLES = CONTROLES.map((c) => c.cle);", '« ventes à dater » redevenu un contrôle'],
  ['api/_lib/controle-nuit.js', '      ajouterMasquees(parNum,', '      void (parNum,', 'les masquées oubliées'],
  ['api/_lib/controle-nuit.js', "  if (!(await ecrire(MEMO_CONTROLE, memoControleApres(n, maintenant)))) return", "  if (!(await ecrire(MEMO_CONTROLE, memoControleApres(n, maintenant))) && false) return", 'mémo pas écrit mais envoi'],
  ['src/alertesPlantages.js', 'export const PERSONNES_MIN = 3;', 'export const PERSONNES_MIN = 1;', 'une seule personne notifie'],
  ['src/alertesPlantages.js', ' || Number(t.bloque) > 0);', ');', 'l’ouverture bloquée ne notifie plus'],
  ['api/_lib/mesures-terrain.js', "const deProprio = String(u.id).toLowerCase() === String(proprio).toLowerCase();", 'const deProprio = false;', 'le propriétaire compté'],
  ['src/alertesPlantages.js', "    if (deProprio) t.proprio = (Number(t.proprio) || 0) + e.n;\n", '', 'les plantages du propriétaire plus rangés'],
  ['src/alertesPlantages.js', '    t.appareils = deProprio || ap.includes(empreinte)', '    t.appareils = ap.includes(empreinte)', 'le propriétaire compté comme une personne'],
  ['src/alertesPlantages.js', "const tout_de_suite = (origine) => origine === 'promesse' || origine === 'morceau';", 'const tout_de_suite = (origine) => false;', 'promesse et morceau attendent 3 fois'],
  ['api/_lib/plantages-comptes.js', "lignes = (lignes || []).filter((l) => l && !(moi && String(l.owner || '').toLowerCase() === moi));", 'lignes = lignes || [];', 'le propriétaire compté dans le rapport'],
  ['src/fiabilite/regles.js', "if (e !== 'ancienne') return null; }", '}', 'une version à jour dite en retard'],
  ['src/fiabilite/regles.js', 'if (j.captcha && verificationEnCours(j.captcha, R[String(l.id)]))', 'if (j.captcha)', 'son « Reprendre » ignoré'],
  ['src/plantages.js', "  if (contexte && contexte.origine === 'demarrage') return true;\n  let t = 0;", '  return false;\n  let t = 0;', 'le morceau qui revient jamais dit'],
  ['src/plantages.js', "origine: morceauBloquant(contexte) ? 'ouverture' : 'morceau'", "origine: 'ouverture'", 'tout morceau dit « ouverture bloquée »'],
  ['src/fraicheur.js', "    if (ici && ici.version && versionCourte(a.code || a.ver) === ici.version) continue;\n", '', 'l’extension d’ici dite deux fois'],
];
function prouver() {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'fiab-'));
  let rouges = 0;
  try {
    const tar = execFileSync('git', ['-C', path.join(__dirname, '..'), 'ls-files', 'src', 'api', 'scripts/_recopie-masquees.cjs'], { encoding: 'utf8' }).split('\n').filter(Boolean).filter((f) => /\.(js|jsx|cjs|mjs|json)$/.test(f) && !/i18n\/langues/.test(f));
    for (const f of tar) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(__dirname, '..', f), d); }
    for (const [f, avant, apres, nom] of MUTATIONS) {
      const p = path.join(tmp, f), orig = fs.readFileSync(p, 'utf8');
      if (!orig.includes(avant)) { console.log('❌ mutation introuvable : ' + nom); rouges--; continue; }
      fs.writeFileSync(p, orig.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: tmp }, encoding: 'utf8', timeout: 120000 });
      const rouge = /❌/.test(r.stdout || '') || r.status !== 0;
      console.log((rouge ? '✅ ' : '❌ ') + 'mutation « ' + nom + ' » ⇒ ' + (rouge ? 'rouge' : 'RESTE VERT'));
      if (rouge) rouges++;
      fs.writeFileSync(p, orig);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return rouges;
}

(async () => {
  await controles();
  console.log(`\n${ko ? '❌' : '✅'} audit-fiabilite-auto : ${ok} vert(s), ${ko} rouge(s)`);
  if (process.argv.includes('--prouve') && !process.env.AUDIT_RACINE) {
    const n = prouver();
    console.log(`${n === MUTATIONS.length ? '✅' : '❌'} --prouve : ${n}/${MUTATIONS.length} mutations rouges`);
    if (n !== MUTATIONS.length) process.exitCode = 1;
  }
  if (ko) process.exitCode = 1;
})();
