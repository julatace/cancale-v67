// ════════════════════════════════════════════════════════════════════════════
//  LA VEILLE (11 nov., lot agent2-veille) — EXÉCUTÉE, données inventées.
//   V. Les chiffres qui chutent (src/veilleChiffres.js, api/_lib/veille-chiffres.js) :
//      stock 180 → 120 en une nuit ⇒ alerte ; la même chute EXPLIQUÉE (ventes,
//      suppressions vues) ⇒ rien ; « pas su » (stock, explication, comptes
//      changés) ⇒ rien ; CA d'un mois PASSÉ qui baisse ⇒ alerte, mois en cours,
//      vente déclarée ailleurs, plateforme pas lue, sélection changée ⇒ rien ;
//      un point par jour, 90 jours, ligne petite ; « C'est vérifié » ; la
//      notification UNE fois, mémo écrit AVANT (pas écrit ⇒ rien envoyé).
//   C. Le contrôle de nuit (src/controleNuit.js, api/_lib/controle-nuit.js) :
//      deux paires EN LIGNE sous un N°, ventes sans versement > 30 j, comptes
//      pas relus > 48 h, quarantaine, Stripe ; une lecture ratée ⇒ « pas su »
//      (jamais 0) et « Tout est en ordre ✓ » seulement si tout est lu ; lectures
//      projetées (jamais `select=data` sur `main` ni sur un dressing) ; et le
//      VRAI cron du matin (api/ship-reminders.js) range `vrm_controle_nuit`.
//   P. Les plantages : 20 au plus par heure et par appareil (src/plantages.js) ;
//      tous les comptes triés par fréquence (api/_lib/plantages-comptes.js),
//      sans identité de vendeur, lecture projetée et paginée, page ratée ⇒ null.
//  `--prouve` : chaque mutation rougit.   Lancer : node scripts/audit-veille.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const VC = 'src/veilleChiffres.js', VS = 'api/_lib/veille-chiffres.js', CN = 'src/controleNuit.js', PL = 'src/plantages.js', PC = 'api/_lib/plantages-comptes.js', CS = 'api/_lib/controle-nuit.js';

const MUTATIONS = {
  'chute expliquée ignorée': [[VC, 'const explique = B.v + B.x;', 'const explique = 0;']],
  'comptes changés comparés quand même': [[VC, 'A.c != null && A.c === B.c && B.d === A.j', 'B.d === A.j']],
  'explication pas sue prise pour zéro': [[VC, '&& entier(B.v) != null && entier(B.x) != null) {', ') {']],
  'mois en cours comparé': [[VC, 'if (!(ym < ymA)) continue;', '']],
  'vente déclarée ailleurs non expliquée': [[VC, ' - Math.max(0, (caAilB || 0) - (caAilA || 0))', '']],
  'plateforme pas lue comparée': [[VC, 'MA !== MB && MA.p === MB.p && MA.e === MB.e', 'MA !== MB']],
  '« C’est vérifié » ignoré': [[VC, '!vus[a.k] && ', '']],
  'mémo écrit après l’envoi': [[VS, "if (!(await ecrire(MEMO_VEILLE, memoApres(memo, nouvelles, maintenant)))) return { envoye: false, raison: 'mémo non écrit — rien envoyé' };", 'await ecrire(MEMO_VEILLE, memoApres(memo, nouvelles, maintenant));']],
  'pas su compté 0': [[CN, "else controles[cle] = { n: null, raison", "else controles[cle] = { n: 0, raison"]],
  'en ordre malgré un pas su': [[CN, "etat: lignes.length ? 'probleme' : passu.length ? 'passu' : 'ok'", "etat: lignes.length ? 'probleme' : 'ok'"]],
  'même annonce comptée deux paires': [[CN, 'if (ids.size > 1) out.push(String(num));', 'if ((Array.isArray(l) ? l.length : 0) > 1) out.push(String(num));']],
  '48 h devient 24 h': [[CN, 'export const RELU_MS = 48 * 3600e3;', 'export const RELU_MS = 24 * 3600e3;']],
  'abonnement du propriétaire compté': [[CN, "if (!r || String(r.owner || '').toLowerCase() === String(proprio || '').toLowerCase()) continue;", 'if (!r) continue;']],
  'contrôle sur la ligne main entière': [[CS, "lireTout('app_data?id=eq.main&select=fiches:data->vinted_annonce_numeros,retirees:data->vrm_annonces_retirees,masques:data->vinted_accounts_hidden,aDater:data->vinted_urssaf_mois->aDater')", "lireTout('app_data?id=eq.main&select=data').then((l) => (Array.isArray(l) ? l.map((x) => ({ fiches: x.data && x.data.vinted_annonce_numeros, retirees: x.data && x.data.vrm_annonces_retirees, masques: x.data && x.data.vinted_accounts_hidden, aDater: x.data && x.data.vinted_urssaf_mois && x.data.vinted_urssaf_mois.aDater })) : l))"]],
  'plafond par heure retiré': [[PL, 'if (fen.n >= PLAFOND_HEURE) return null;', '']],
  'identité du vendeur sortie': [[PC, 'comptes: g.vendeurs.size,', 'comptes: g.vendeurs.size, vendeurs: [...g.vendeurs],']],
  'tri par fréquence retiré': [[PC, 'b.comptes - a.comptes || b.fois - a.fois || ', '']],
  'propriétaire neutre compté': [[PC, ".filter((l) => l && String(l.owner || '') !== PROPRIETAIRE_NEUTRE)", '']],
};

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };
const J = (status, x, h = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => h[String(k).toLowerCase()] || null }, json: async () => x, text: async () => JSON.stringify(x) });
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`;
const H = 3600e3, JOUR = 864e5;

(async () => {
  const V = await import(path.join(R, VC));
  // ── V. Les chiffres ─────────────────────────────────────────────────────────
  const t0 = Date.parse('2026-11-09T20:00:00Z'), t1 = Date.parse('2026-11-10T19:00:00Z');
  const comptes = ['111', '222'];
  const releve = (t, stock, o = {}) => ({ maintenant: t, stock, comptes: o.comptes || comptes, ventes: o.ventes === undefined ? [] : o.ventes, suppressions: o.suppressions === undefined ? [] : o.suppressions, urssaf: o.urssaf || null, selection: o.selection || ['[]'] });
  const deux = (a, b, oa = {}, ob = {}) => { const A = V.pointDuJour(releve(t0, a, oa)); const B = V.pointDuJour(releve(t1, b, ob), A); return V.alertesDe([A, B]); };
  let al = deux(180, 120);
  vrai(al.length === 1 && al[0].type === 'stock' && al[0].de === 180 && al[0].a === 120 && al[0].sans === 60, 'V1 stock 180 → 120 en une nuit, rien ne l’explique ⇒ une alerte');
  vrai(/^Ton stock est passé de 180 à 120 en une nuit$/.test(V.texteAlerte(al[0]).titre) && V.texteAlerte(al[0]).geste.aller === '/?tab=cat_annonces', `V1 la phrase et le geste (« ${al[0] && V.texteAlerte(al[0]).titre} »)`);
  const ventes50 = Array.from({ length: 50 }, (_, i) => new Date(t0 + (i + 1) * 60e3).toISOString());
  const suppr8 = Array.from({ length: 8 }, (_, i) => new Date(t0 + (i + 1) * 120e3).toISOString());
  vrai(deux(180, 120, {}, { ventes: ventes50, suppressions: suppr8 }).length === 0, 'V2 la même chute expliquée (50 ventes + 8 suppressions vues) ⇒ rien');
  vrai(deux(180, 120, {}, { ventes: Array.from({ length: 20 }, () => new Date(t0 - 3 * JOUR).toISOString()) }).length === 1, 'V2 des ventes d’AVANT le relevé précédent n’expliquent rien');
  vrai(deux(180, null).length === 0, 'V3 stock pas su (lecture ratée, « à confirmer ») ⇒ rien');
  vrai(deux(180, 120, {}, { ventes: null }).length === 0, 'V3 ventes pas lues sur un compte (explication pas sue) ⇒ rien');
  vrai(deux(180, 120, {}, { comptes: ['111'] }).length === 0, 'V3 un compte en moins (exclu, bloqué) ⇒ c’est un choix, rien');
  vrai(deux(10, 8).length === 0 && deux(40, 33).length === 0 && deux(30, 23).length === 1 && deux(300, 270).length === 1, 'V4 seuils : 10→8 et 40→33 rien ; 30→23 (≥ 20 %) et 300→270 (≥ 30 paires) sonnent');
  // Les mois.
  const U = (oct, nov, o = {}) => ({ at: 1, sources: o.sources || { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, mois: [{ ym: '2026-11', ca: nov, n: 5 }, { ym: '2026-10', ca: oct[0], n: oct[1], caAilleurs: oct[2] || 0, nAilleurs: oct[3] || 0 }, { ym: '2026-09', ca: 500, n: 6 }] });
  al = deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([980, 9], 300) });
  vrai(al.length === 1 && al[0].type === 'mois' && al[0].ym === '2026-10' && al[0].caDe === 1240 && al[0].caA === 980, 'V5 le CA d’octobre (mois passé) passe de 1 240 € à 980 € ⇒ une alerte');
  vrai(al[0] && /^Ton CA de octobre 2026 est passé de 1\s240\s€ à 980\s€$/.test(V.texteAlerte(al[0]).titre.replace(/ /g, ' ')) && V.texteAlerte(al[0]).geste.aller === '/?tab=compta&cible=urssaf', `V5 la phrase et le geste (« ${al[0] && V.texteAlerte(al[0]).titre} »)`);
  vrai(deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([1240, 12], 100) }).length === 0, 'V5 le mois EN COURS qui baisse ⇒ rien');
  vrai(deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([1180, 11, 60, 1], 300) }).length === 0, 'V5 une vente déclarée ailleurs (registre) explique la baisse ⇒ rien');
  vrai(deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([980, 9], 300, { sources: { Vinted: 'lu', Leboncoin: 'pasSu', eBay: 'lu', Vestiaire: 'lu' } }) }).length === 0, 'V5 une plateforme passée « pas lue » ⇒ rien');
  vrai(deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([980, 9], 300), selection: ['["lbc:1"]'] }).length === 0, 'V5 la sélection des comptes a changé (son choix) ⇒ rien');
  { // Le passage d'un mois : octobre était EN COURS au relevé d'avant (31 oct.) ⇒ il peut encore bouger le 1er nov.
    const A0 = V.pointDuJour({ ...releve(Date.parse('2026-10-31T18:00:00Z'), 150), urssaf: { at: 1, sources: { Vinted: 'lu' }, mois: [{ ym: '2026-10', ca: 1240, n: 12 }, { ym: '2026-09', ca: 500, n: 6 }] } });
    A0.m['2026-10'] = [1240, 12, 0, 0];   // (comme si la fenêtre l'avait gardé)
    const B0 = V.pointDuJour({ ...releve(Date.parse('2026-11-01T18:00:00Z'), 150), urssaf: { at: 2, sources: { Vinted: 'lu' }, mois: [{ ym: '2026-10', ca: 900, n: 9 }, { ym: '2026-09', ca: 500, n: 6 }] } }, A0);
    vrai(V.alertesDe([A0, B0]).length === 0, 'V5 au passage du mois, le mois qui était EN COURS au relevé d’avant ⇒ rien');
  }
  al = deux(150, 150, { urssaf: U([1240, 12], 300) }, { urssaf: U([1240, 11], 300) });
  vrai(al.length === 1 && al[0].nDe === 12 && al[0].nA === 11, 'V6 une vente de moins dans un mois passé (même CA) ⇒ une alerte');
  // La ligne.
  let d = null;
  for (let k = 0; k < 120; k++) {
    const t = Date.parse('2026-07-01T18:00:00Z') + k * JOUR;
    const avant = d && d.points.length ? d.points[d.points.length - 1] : null;
    d = V.ajouterPoint(d, V.pointDuJour(releve(t, 200 - (k % 3), { urssaf: U([1240, 12], 300 + k) }), avant));
    if (k === 60) d = V.ajouterPoint(d, V.pointDuJour(releve(t + H, 201, { urssaf: U([1240, 12], 300 + k) }), avant));
  }
  const taille = JSON.stringify(d).length;
  vrai(d.points.length === 90 && new Set(d.points.map((p) => p.j)).size === 90, `V7 un point par jour, 90 jours gardés (${d.points.length})`);
  vrai(taille < 16000, `V7 la ligne reste petite : ${taille} octets pour 90 jours`);
  vrai(!/"(title|titre|login|pseudo|email)"/.test(JSON.stringify(d)), 'V7 nombres seuls (aucun titre, pseudo, e-mail)');
  // Une alerte, puis un relevé plus tard le MÊME jour qui ne montre plus la chute.
  const A = V.pointDuJour(releve(t0, 180));
  let L = V.ajouterPoint(null, A);
  L = V.ajouterPoint(L, V.pointDuJour(releve(t1, 120), A));
  vrai(V.alertesAMontrer(L, t1).length === 1, 'V7 l’alerte est rangée dans la ligne');
  const L2 = V.ajouterPoint(L, V.pointDuJour(releve(t1 + H, 179), A));
  vrai(V.alertesAMontrer(L2, t1 + H).length === 0, 'V7 un relevé du même jour qui retrouve le stock la retire');
  const Lv = V.marquerVue(L, L.alertes[0].k, t1 + H);
  vrai(V.alertesAMontrer(Lv, t1 + H).length === 0 && V.aNotifier(Lv, null, t1 + H).length === 0, 'V7 « C’est vérifié » : elle ne se montre plus et ne sonne plus');
  vrai(V.alertesAMontrer(L, t1 + 8 * JOUR).length === 0, 'V7 une alerte de plus de 7 jours ne se montre plus');
  // La notification (serveur).
  const S = await import(path.join(R, VS));
  const run = async (ligne, memo, o = {}) => {
    const ecrits = [], envois = [];
    const r = await S.notifierAlertesChiffres({
      getRow: async (id) => (id === V.CLE_VEILLE ? ligne : memo),
      ecrire: async (id, data) => { ecrits.push({ id, data, avantEnvoi: envois.length === 0 }); return o.ecrireKo ? false : true; },
      pousser: async (n) => { envois.push(n); return { sent: 1 }; }, maintenant: t1 + H,
    });
    return { r, ecrits, envois };
  };
  let x = await run(L, null);
  vrai(x.envois.length === 1 && /Ton stock est passé de 180 à 120/.test(x.envois[0].title) && x.envois[0].cat === 'veille' && x.envois[0].url === '/?tab=cat_annonces', 'V9 la notification part, famille « veille », avec le geste');
  vrai(x.ecrits.length === 1 && x.ecrits[0].id === V.MEMO_VEILLE && x.ecrits[0].avantEnvoi, 'V9 le mémo est écrit AVANT d’envoyer');
  const memo = x.ecrits[0] && x.ecrits[0].data;
  x = await run(L, memo);
  vrai(x.envois.length === 0, 'V9 la même alerte ne sonne pas deux fois');
  x = await run(L, null, { ecrireKo: true });
  vrai(x.envois.length === 0 && x.r.envoye === false, 'V9 mémo pas écrit ⇒ rien envoyé');
  x = await run(undefined, null);
  vrai(x.envois.length === 0 && x.ecrits.length === 0, 'V9 ligne illisible ⇒ rien écrit, rien envoyé');
  x = await run(L, undefined);
  vrai(x.envois.length === 0 && x.ecrits.length === 0, 'V9 mémo illisible ⇒ rien écrit, rien envoyé');

  // ── C. Le contrôle de nuit ──────────────────────────────────────────────────
  const C = await import(path.join(R, CN));
  vrai(JSON.stringify(C.numerosEnDouble(new Map([['12', [{ id: 'a' }, { id: 'b' }]], ['13', [{ id: 'c' }, { id: 'c' }]], ['14', [{ id: 'd' }]]]))) === '["12"]', 'C1 deux identifiants sous un N° = deux paires ; la même annonce deux fois n’en est pas');
  const maintenant = Date.parse('2026-11-11T05:00:00Z');
  vrai(JSON.stringify(C.comptesPasRelus([{ uid: '1', lu: maintenant - 30 * H }, { uid: '2', lu: maintenant - 50 * H }], maintenant)) === '["2"]', 'C1 un compte lu il y a 30 h n’est pas « > 48 h » ; 50 h l’est');
  vrai(C.versementsEnRetard({ n: 5 }) === null && C.versementsEnRetard({ plus30: { n: 3, ca: 90 } }) === 3, 'C1 ventes sans versement > 30 j : le nombre publié ; ligne d’avant ⇒ pas su');
  const p30 = C.plus30De([{ eur: 10, date: '2026-09-01' }, { eur: 20, date: '2026-11-05' }], (l) => Date.parse(l.date), maintenant);
  vrai(p30.n === 1 && p30.ca === 10, 'C1 plus30De compte la vente du 1er sept., pas celle du 5 nov.');
  // Le contrôle d'un vendeur, données inventées, lectures enregistrées.
  const jour = [];
  const item = (id, extra = {}) => ({ id, title: 'Paire ' + id, is_closed: false, ...extra });
  const base = {
    'app_data?id=eq.main': [{ fiches: { 1001: { numero: '12' }, 1002: { numero: '12' }, 1003: { numero: '13' } }, retirees: {}, masques: [], aDater: { n: 4, plus30: { n: 3, ca: 120 } } }],
    'app_data?id=like.harvest_%25_listings': [{ id: 'harvest_111_listings', cap: new Date(maintenant - 2 * H).toISOString(), uid: 111, items: [item(1001), item(1003)] }, { id: 'harvest_222_listings', cap: new Date(maintenant - 3 * H).toISOString(), uid: 222, items: [item(1002)] }],
    'app_data?id=like.harvest_%25_enligne': [],
    'app_data?id=like.harvest_%25_supprimees': [],
    'vinted_accounts?': [{ vinted_user_id: 111 }, { vinted_user_id: 222 }, { vinted_user_id: 333 }],
    'app_data?id=eq.panel_accounts_off': [],
    'app_data?id=eq.panel_comptes_etat': [],
    'app_data?id=eq.vrm_blocked_accounts': [],
    'app_data?id=like.harvest_%25&meta': [{ id: 'harvest_111_listings', cap: new Date(maintenant - 2 * H).toISOString() }, { id: 'harvest_222_listings', cap: new Date(maintenant - 3 * H).toISOString() }, { id: 'harvest_333_orders_sold', cap: new Date(maintenant - 72 * H).toISOString() }],
  };
  const CSm = await import(path.join(R, CS));
  const controler = async (pannes = []) => {
    const ecrits = [];
    const r = await CSm.controleVendeur({
      lireTout: async (p) => { jour.push(p); const k = Object.keys(base).find((x) => p.startsWith(x)); if (pannes.some((q) => p.startsWith(q))) return null; return k ? JSON.parse(JSON.stringify(base[k])) : []; },
      ecrire: async (id, data) => { ecrits.push({ id, data }); return true; }, maintenant,
    });
    return { r, ecrits };
  };
  let c = await controler();
  const ec = c.ecrits[0];
  vrai(c.ecrits.length === 1 && ec.id === C.CLE_CONTROLE, 'C2 UNE écriture : sa ligne vrm_controle_nuit');
  vrai(ec && ec.data.controles['numeros-double'].n === 1 && JSON.stringify(ec.data.controles['numeros-double'].ids) === '["12"]', `C2 N°12 porté par deux annonces EN LIGNE (deux comptes) ⇒ 1 (${JSON.stringify(ec && ec.data.controles['numeros-double'])})`);
  vrai(ec && ec.data.controles['versement-30j'].n === 3, 'C2 3 ventes sans versement depuis 30 jours (le nombre publié par Ventes)');
  vrai(ec && ec.data.controles['comptes-48h'].n === 1 && JSON.stringify(ec.data.controles['comptes-48h'].ids) === '["333"]', `C2 le compte 333 pas relu depuis 72 h (${JSON.stringify(ec && ec.data.controles['comptes-48h'])})`);
  vrai(jour.filter((p) => /id=eq\.main|harvest_/.test(p)).length >= 5 && !jour.some((p) => /id=eq\.main|harvest_/.test(p) && /select=([^&]*[:,])?data(,|&|$)/.test(p)), 'C2 main et dressings lus projetés : jamais select=data');
  vrai(!/Paire|title/.test(JSON.stringify(ec && ec.data)), 'C2 rien de personnel rangé (ni titre ni pseudo)');
  c = await controler(['app_data?id=like.harvest_%25_listings']);
  const ec2 = c.ecrits[0];
  vrai(ec2 && ec2.data.controles['numeros-double'].n === null && /annonces/.test(ec2.data.controles['numeros-double'].raison) && ec2.data.controles['versement-30j'].n === 3, 'C2 dressings illisibles ⇒ « pas su » avec sa raison (jamais 0), les autres contrôles continuent');
  // L'installation.
  const proprio = uuid(9);
  const abos = [
    { owner: uuid(1), statut: 'active', abonnement_stripe: 'sub_a', fin_periode: new Date(maintenant + 10 * JOUR).toISOString() },
    { owner: uuid(2), statut: 'active', abonnement_stripe: 'sub_b', fin_periode: new Date(maintenant - 5 * JOUR).toISOString() },
    { owner: uuid(3), statut: 'trialing', abonnement_stripe: null, fin_periode: null },
    { owner: uuid(4), statut: 'active', abonnement_stripe: 'sub_d', fin_periode: new Date(maintenant + 10 * JOUR).toISOString() },
    { owner: proprio, statut: 'active', abonnement_stripe: null, fin_periode: null },
    { owner: uuid(5), statut: 'canceled', abonnement_stripe: 'sub_e', fin_periode: new Date(maintenant - 50 * JOUR).toISOString() },
  ];
  const inst = async (o = {}) => {
    const ecrits = [];
    const r = await CSm.controleInstallation({
      lire: async (p) => (o.panne && p.startsWith(o.panne) ? null : p.startsWith('app_data?id=like.email_quarantaine_') ? [{ id: 'email_quarantaine_x1' }, { id: 'email_quarantaine_x2' }] : p.startsWith('abonnements?') ? abos : []),
      ecrire: async (owner, id, data) => { ecrits.push({ owner, id, data }); return true; }, proprio, maintenant,
      stripe: { pret: () => true, api: async (m, ch) => (ch === 'subscriptions/sub_d' ? { ok: true, status: 200, data: { status: 'canceled' } } : ch === 'subscriptions/sub_a' ? { ok: true, status: 200, data: { status: 'active' } } : { ok: false, status: 500, data: {} }) },
    });
    return { r, ecrits };
  };
  let ci = await inst();
  const ei = ci.ecrits[0];
  vrai(ei && ei.owner === proprio && ei.id === C.CLE_CONTROLE_INSTALLATION, 'C3 rangé chez le propriétaire de l’installation');
  vrai(ei && ei.data.controles['emails-quarantaine'].n === 2, 'C3 2 e-mails en quarantaine sans vendeur');
  vrai(ei && ei.data.controles.stripe.n === 3 && JSON.stringify(ei.data.controles.stripe.ids.sort()) === JSON.stringify(['echeance-passee', 'sans-abonnement', 'statut-different']), `C3 3 abonnements incohérents (échéance passée, sans abonnement Stripe, statut différent chez Stripe) ; le propriétaire et un résilié ne comptent pas (${JSON.stringify(ei && ei.data.controles.stripe)})`);
  vrai(!JSON.stringify(ei && ei.data).includes('aaaa-4bbb') && !JSON.stringify(ei && ei.data).includes('sub_'), 'C3 aucun identifiant de vendeur ni d’abonnement rangé');
  ci = await inst({ panne: 'abonnements?' });
  vrai(ci.ecrits[0] && ci.ecrits[0].data.controles.stripe.n === null, 'C3 abonnements illisibles ⇒ « pas su »');
  // Ce que Ma journée montre.
  const vend = (ctl, at = maintenant - 2 * H) => ({ at: new Date(at).toISOString(), controles: ctl });
  const tout0 = { 'numeros-double': { n: 0 }, 'versement-30j': { n: 0 }, 'comptes-48h': { n: 0 } };
  let e = C.etatControle(vend(tout0), null, maintenant);
  vrai(e.etat === 'ok', 'C4 chaque contrôle lu et à 0 ⇒ « Tout est en ordre »');
  e = C.etatControle(vend({ ...tout0, 'versement-30j': { n: null, raison: 'pas lu' } }), null, maintenant);
  vrai(e.etat === 'passu' && e.passu.length === 1, 'C4 un contrôle pas lu ⇒ jamais « Tout est en ordre »');
  e = C.etatControle(vend({ ...tout0, 'numeros-double': { n: 2, ids: ['12', '40'] }, 'comptes-48h': { n: 1, ids: ['333'] } }), vend({ 'emails-quarantaine': { n: 2 }, stripe: { n: 0 } }), maintenant);
  vrai(e.etat === 'probleme' && e.lignes.length === 3 && e.lignes[0].cle === 'numeros-double' && e.lignes[0].ton === 'rouge' && e.lignes.slice(1).every((l) => l.ton === 'geste'), 'C4 problèmes par gravité : rouge seulement pour deux paires sous un N°, ambre pour le reste');
  vrai(C.etatControle(vend(tout0, maintenant - 40 * H), null, maintenant).etat === 'vieux' && C.etatControle(null, null, maintenant).etat === 'absent', 'C4 un contrôle de plus de 36 h ou absent ne dit rien');

  // ── C5. Le VRAI cron du matin range vrm_controle_nuit pour chaque vendeur ───
  process.env.CRON_SECRET = 'secret-cron';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
  process.env.VRM_OWNER_UID = proprio;
  process.env.VRM_CRON_BUDGET_MS = '600000';
  const vendeurs = [uuid(1), uuid(2)];
  const ecritures = [], requetes = [];
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    const m = (o.method || 'GET').toUpperCase();
    requetes.push({ u, m });
    if (/\/rpc\//.test(u)) return J(200, true);
    if (!/\/rest\/v1\//.test(u)) return J(200, []);
    if (/app_data\?select=owner&limit=1$/.test(u)) return J(200, [{ owner: vendeurs[0] }]);
    if (/id=eq\.main&select=owner(&|$)/.test(u)) return J(200, vendeurs.map((x) => ({ owner: x })));
    if (m === 'POST' && /on_conflict=owner,id/.test(u)) { for (const r of JSON.parse(o.body)) ecritures.push(r); return J(201, null); }
    return m === 'GET' ? J(200, []) : J(201, null);
  };
  const cron = (await import(path.join(R, 'api/ship-reminders.js'))).default;
  const res = { code: 0, corps: null, setHeader() {}, status(c2) { this.code = c2; return this; }, json(x2) { this.corps = x2; return this; } };
  await cron({ method: 'GET', query: {}, headers: { authorization: 'Bearer secret-cron' } }, res);
  const ctlEcrits = ecritures.filter((r) => r.id === 'vrm_controle_nuit');
  vrai(ctlEcrits.length === 2 && vendeurs.every((v) => ctlEcrits.some((r) => r.owner === v)), `C5 le cron du matin range vrm_controle_nuit chez chacun des 2 vendeurs (${ctlEcrits.length})`);
  vrai(ecritures.some((r) => r.id === 'vrm_controle_installation' && r.owner === proprio), 'C5 et vrm_controle_installation chez le propriétaire');
  vrai(requetes.some((q) => /select=fiches:data->vinted_annonce_numeros/.test(q.u)) && !requetes.some((q) => q.m === 'GET' && /id=eq\.main&select=data(&|$)/.test(q.u)), 'C5 le cron lit main projeté, jamais select=data');
  vrai(res.corps && Array.isArray(res.corps.bilans) && res.corps.bilans.some((b) => b && b.controle && b.controle.ecrit), 'C5 la réponse du cron dit le contrôle (des nombres)');

  // ── P. Les plantages ────────────────────────────────────────────────────────
  const store = new Map();
  global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  global.window = { addEventListener() {}, dispatchEvent() {} };
  global.CustomEvent = class { constructor(t, d) { this.type = t; this.detail = d && d.detail; } };
  try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone) Safari/605' }, configurable: true }); } catch (_) {}
  const { pathToFileURL } = require('url');
  let notes = 0, P1 = null;
  for (const ouverture of [1, 2, 3]) {   // trois ouvertures de l'app dans la même heure, 10 erreurs chacune
    const P = await import(pathToFileURL(path.join(R, PL)).href + '?ouverture=' + ouverture);
    if (!P1) P1 = P;
    for (let i = 0; i < 10; i++) if (P.noterPlantage(new Error(`erreur ${ouverture} type ${'abcdefghijklmnopqrstuvwxyz'[i]}`), { ecran: 'journee' })) notes++;
  }
  vrai(notes === 20, `P1 20 plantages notés au plus par heure et par appareil, toutes ouvertures confondues (${notes} sur 30)`);
  const e1 = P1.nettoyer('Échec pour julien@example.com : 129,90 € tx 1234567890');
  vrai(!/julien@|129,90|1234567890/.test(e1), `P1 le message part nettoyé (« ${e1} »)`);
  const PCm = await import(path.join(R, PC));
  const at = new Date(maintenant - 2 * H).toISOString();
  const lignesP = [
    { owner: uuid(4), message: 'x is not a function', ecran: 'ventes', navigateur: 'Windows Chrome', n: '9', at: new Date(maintenant - H).toISOString() },
    ...[1, 2, 3].map((n) => ({ owner: uuid(n), message: "Cannot read properties of undefined (reading 'numero')", ecran: 'cat_bord', navigateur: 'iOS Safari', n: '2', at })),
    { owner: NEUTRE, message: 'x is not a function', ecran: 'ventes', navigateur: 'Mac Chrome', n: '1', at },
    { owner: uuid(5), message: 'Failed to fetch', ecran: 'ventes', navigateur: 'Mac Chrome', n: '50', at },
  ];
  const types = PCm.plantagesParComptes(lignesP, maintenant - 7 * JOUR);
  vrai(types.length === 2 && types[0].comptes === 3 && types[0].fois === 6 && types[1].comptes === 1 && types[1].fois === 9, `P2 par type, triés par comptes touchés (3 puis 1), le bruit réseau et le propriétaire neutre écartés (${JSON.stringify(types.map((t) => [t.comptes, t.fois]))})`);
  vrai(!JSON.stringify(types).includes('aaaa-4bbb'), 'P2 aucun identifiant de vendeur ne sort');
  const reqs = [];
  const fx = async (u, o) => { reqs.push({ u: decodeURIComponent(u), o }); return J(200, lignesP); };
  const lu = await PCm.listerPlantagesComptes({ env: { SUPABASE_SERVICE_KEY: 'k' }, fetcher: fx, maintenant });
  vrai(Array.isArray(lu) && lu.length === 2 && reqs.length === 1 && !/select=data(&|$)/.test(reqs[0].u) && /select=owner,message:data->>message/.test(reqs[0].u) && reqs[0].o.headers.Range === '0-999' && /order=/.test(reqs[0].u), 'P2 lecture projetée, paginée par Range, ordre total');
  const lu2 = await PCm.listerPlantagesComptes({ env: { SUPABASE_SERVICE_KEY: 'k' }, fetcher: async () => J(500, {}), maintenant });
  vrai(lu2 === null, 'P2 une page ratée ⇒ null (pas su), jamais une liste partielle');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
