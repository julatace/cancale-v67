#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA LIGNE DE FRAÎCHEUR UNIQUE (9 nov., lot AG) — la RÈGLE, exécutée
//  (src/fraicheur.js), et son branchement dans la coque (src/App.jsx).
//  · tout frais ⇒ « a-jour » ; jamais quand une source est pas sue, en cours,
//    hors ligne, base injoignable ;
//  · un compte vieux de 3 j ⇒ nommé, avec son geste ;
//  · deux sources en retard ⇒ la plus grave d'abord (panne > extension > compte
//    > suivi > e-mails > version) ;
//  · les seuils sont CEUX des propriétaires (aucun seuil inventé) ;
//  · un compte retiré des totaux (son choix) n'est jamais nommé.
//  `--prouve` : chaque mutation réaffaiblit la règle ⇒ rouge (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'hors ligne ignoré': [['src/fraicheur.js', "if (horsLigne) return { etat: 'cache', raison: 'hors-ligne', retards: [], passu: [] };", '']],
  'base injoignable ignorée': [['src/fraicheur.js', "if (baseKO) return { etat: 'cache', raison: 'base', retards: [], passu: [] };", '']],
  'pas su = à jour': [['src/fraicheur.js', "if (passu.length) return { etat: 'passu', retards, passu, verifieAt };", '']],
  'en cours = à jour': [['src/fraicheur.js', "|| transp === undefined || (emails && emails.etat === 'encours') || emails === undefined) return", ') return']],
  'gravité oubliée (ordre de lecture)': [['src/fraicheur.js', 'retards.sort((x, y) => (x.gravite - y.gravite) || ', 'retards.sort((x, y) => ']],
  'seuil des comptes à 3 jours': [['src/comptesLies.js', 'export const A_RELIRE_MS = 24 * 3600e3;', 'export const A_RELIRE_MS = 72 * 3600e3 + 3600e3;']],
  'compte exclu nommé': [['src/fraicheur.js', ".filter((l) => !estExclu(l.plateforme, l.id));", ';']],
  'extension muette tue': [['src/fraicheur.js', '} else if (maintenant - sig.at > ACTIF_MS) {', '} else if (false) {']],
  'suivi transporteur jamais en retard': [['src/fraicheur.js', 'if (maintenant - base > limite) { n++;', 'if (false) { n++;']],
  'e-mails muets ignorés': [['src/fraicheur.js', "else if (emails && emails.etat === 'lu') for (const m of (emails.muets || [])) {", "else if (false) for (const m of []) {"]],
  'la coque ne rend plus la ligne': [['src/App.jsx', '<LigneFraicheurParesseuse baseKO={baseKO}', '<LigneFraicheurAbsente baseKO={baseKO}']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const importer = (p) => import('file://' + path.join(R, p));

(async () => {
  const F = await importer('src/fraicheur.js');
  const { lignesFraicheur } = await importer('src/fraicheurComptes.js');
  const { A_RELIRE_MS } = await importer('src/comptesLies.js');
  const G = await importer('api/_lib/garde-capture.js');
  const T = await importer('api/_lib/transporteurs.js');
  const H = 3600e3, J = 864e5, MIN = 60000;
  const N = Date.parse('2026-11-09T15:00:00Z');
  const ext = { appareils: [{ id: 'a1', at: N - 5 * MIN, ver: '5.335.0', code: '5.335.0', nom: 'Chrome · Mac', flux: {}, vus: {} }], ancien: { ver: '5.335.0', code: '', at: N - 5 * MIN } };
  const compte = (id, nom, lu, x = {}) => ({ plateforme: 'vinted', id, nom, lu, ventesLu: lu, annoncesLu: lu, ...x });
  const capture = (comptes, extra = {}) => ({ ...ext, lignes: lignesFraicheur(comptes, { maintenant: N, dans: 'dans le navigateur où est l’extension VRM' }), pannes: [], passu: [], comptesPrets: true, achats: {}, ...extra });
  const emailsOk = { etat: 'lu', muets: [] };
  const transpOk = [{ id: 'transp_vinted_1', etat: 'disponible', lu: new Date(N - 5 * MIN).toISOString(), fini: false }];
  const base = { capture: capture([compte('1', 'compte_a', N - 2 * H), compte('2', 'compte_b', N - 30 * MIN)]), emails: emailsOk, transp: transpOk, attendue: '5.335.0', verifieAt: N - 3 * MIN, maintenant: N };

  // 1. Tout frais.
  const a = F.fraicheurUnique(base);
  dit(a.etat === 'a-jour' && a.retards.length === 0 && a.verifieAt === N - 3 * MIN, 'tout frais ⇒ « a-jour », vérifié il y a 3 min', JSON.stringify(a));

  // 2. Un compte vieux de 3 j ⇒ nommé avec son geste.
  const b = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 3 * J), compte('2', 'compte_b', N - 30 * MIN)]) });
  const r0 = b.retards[0] || {};
  dit(b.etat === 'retard' && b.retards.length === 1 && r0.nom === 'compte_a' && /pas relu depuis 3 j/.test(r0.texte) && /vinted\.fr/.test(r0.gesteCourt) && /vinted\.fr/.test(r0.geste), 'un compte pas relu depuis 3 j ⇒ NOMMÉ, « pas relu depuis 3 j — ouvre vinted.fr sur ce compte »', JSON.stringify(b.retards));
  dit(F.phraseRetard(r0) === 'compte_a pas relu depuis 3 j', 'la phrase écrite une fois : « compte_a pas relu depuis 3 j »', F.phraseRetard(r0));

  // 3. Le seuil est celui de comptesLies (24 h), pas un nouveau.
  dit(F.SEUILS.compte === A_RELIRE_MS && A_RELIRE_MS === 24 * H, 'seuil des comptes = A_RELIRE_MS de src/comptesLies.js (24 h)');
  const c23 = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 23 * H)]) });
  const c25 = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 25 * H)]) });
  dit(c23.etat === 'a-jour' && c25.etat === 'retard', 'relu il y a 23 h ⇒ à jour ; il y a 25 h ⇒ nommé (la frontière des 24 h)', `${c23.etat} / ${c25.etat}`);
  dit(F.SEUILS.extension === G.ACTIF_MS && F.SEUILS.panne === G.PANNE_MS, 'extension et panne : ACTIF_MS / PANNE_MS de api/_lib/garde-capture.js');
  dit(F.SEUILS.suiviCadence === T.CADENCE_COLIS_MS && F.SEUILS.suiviMarge === T.MARGE_RYTHME_MS, 'suivi : RYTHME_MS + CADENCE_COLIS_MS + MARGE_RYTHME_MS de api/_lib/transporteurs.js');

  // 4. Base injoignable, hors ligne, pas su, en cours : jamais « à jour ».
  for (const [nom, x] of [['base injoignable', { baseKO: true }], ['hors ligne', { horsLigne: true }]]) {
    const r = F.fraicheurUnique({ ...base, ...x });
    dit(r.etat === 'cache', `${nom} ⇒ la ligne se tait (l'état existant prime), jamais « à jour »`, r.etat);
  }
  const p1 = F.fraicheurUnique({ ...base, capture: { ...base.capture, passu: ['Vinted'] } });
  dit(p1.etat === 'passu' && p1.passu.includes('Vinted'), 'Vinted pas lu ⇒ « pas pu tout vérifier », jamais « à jour »', p1.etat);
  const p2 = F.fraicheurUnique({ ...base, transp: null });
  dit(p2.etat === 'passu' && p2.passu.includes('le suivi des colis'), 'suivi transporteur pas lu ⇒ « pas su »', p2.etat);
  const p3 = F.fraicheurUnique({ ...base, emails: { etat: 'pasSu', muets: [] } });
  dit(p3.etat === 'passu', 'e-mails pas lus ⇒ « pas su »', p3.etat);
  const p4 = F.fraicheurUnique({ ...base, capture: { ...base.capture, appareils: null, ancien: null } });
  dit(p4.etat === 'passu' && p4.passu.includes('l’extension'), 'extension pas lue ⇒ « pas su »', p4.etat);
  for (const [nom, x] of [['capture en cours', { capture: undefined }], ['suivi en cours', { transp: undefined }], ['e-mails en cours', { emails: { etat: 'encours' } }]]) {
    const r = F.fraicheurUnique({ ...base, ...x });
    dit(r.etat === 'encours', `${nom} ⇒ « Vérification… », rien d'affirmé`, r.etat);
  }

  // 5. Deux sources en retard ⇒ la plus grave d'abord.
  const vieuxExt = { appareils: [{ ...ext.appareils[0], at: N - 2 * J }], ancien: { ...ext.ancien, at: N - 2 * J } };
  const d = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 3 * J)], vieuxExt),
    emails: { etat: 'lu', muets: [{ uid: '2', login: 'compte_b', depuis: new Date(N - 2 * J).toISOString() }] } });
  dit(d.retards.map((r) => r.source).join(',') === 'extension,compte,emails', 'extension muette (2 j), compte (3 j), e-mails ⇒ extension d’abord (la cause), puis le compte, puis les e-mails', d.retards.map((r) => r.source + ':' + r.nom).join(' | '));
  const pannes = [{ plateforme: 'vinted', id: '2', nom: 'compte_b', lu: N - 14 * H, age: 'il y a 14 h', cause: 'réseau coupé', refus: null, appareil: { nom: 'Orion · iPhone' }, geste: 'ouvre Orion', cle: 'vinted:2:1' }];
  const e = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 3 * J), compte('2', 'compte_b', N - 14 * H)], { pannes }) });
  dit(e.retards[0] && e.retards[0].source === 'panne' && /réseau coupé/.test(e.retards[0].texte) && /Orion · iPhone/.test(e.retards[0].texte) && e.retards[1].nom === 'compte_a', 'une panne prouvée passe AVANT un compte vieux de 3 j (et garde la cause, l’appareil)', e.retards.map((r) => r.source + ':' + r.nom + ':' + r.texte).join(' | '));
  dit(e.retards.filter((r) => r.nom === 'compte_b').length === 1, 'un compte en panne n’est pas nommé deux fois');
  const deux = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 2 * J), compte('2', 'compte_b', N - 5 * J)]) });
  dit(deux.retards.map((r) => r.nom).join(',') === 'compte_b,compte_a', 'deux comptes en retard ⇒ le plus ancien d’abord', deux.retards.map((r) => r.nom).join(','));

  // 6. Les autres sources.
  const s = F.fraicheurUnique({ ...base, transp: [{ id: 'transp_vinted_1', etat: 'disponible', lu: new Date(N - 2 * H).toISOString(), fini: false }, { id: 'transp_vinted_2', etat: 'retire', lu: new Date(N - 5 * J).toISOString(), fini: true }] });
  dit(s.etat === 'retard' && s.retards[0].source === 'suivi' && /2 h/.test(s.retards[0].texte), 'un colis au point relais pas relu depuis 2 h (rythme 15 min + 15 + 1) ⇒ suivi nommé ; un colis FINI ne compte pas', JSON.stringify(s.retards));
  const s2 = F.fraicheurUnique({ ...base, transp: [{ id: 'transp_vinted_1', etat: 'en_route', lu: new Date(N - 70 * MIN).toISOString(), fini: false }] });
  dit(s2.etat === 'a-jour', 'un colis en route relu il y a 70 min (rythme 1 h + 16 min) ⇒ encore à jour', s2.etat);
  const ach = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 2 * H)], { achats: { 1: N - 3 * J } }) });
  dit(ach.etat === 'retard' && /achats pas relus depuis 3 j/.test(ach.retards[0].texte), 'achats d’un compte relus il y a 3 j (> FRAICHEUR_ACHATS_J = 2 j) ⇒ nommés', JSON.stringify(ach.retards));
  dit(F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 2 * H)], { achats: null }) }).etat === 'passu', 'achats pas lus ⇒ « pas su »');
  const v = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 2 * H)], { appareils: [{ ...ext.appareils[0], ver: '5.320.0', code: '5.320.0' }] }) });
  dit(v.etat === 'retard' && v.retards[0].source === 'version' && /5\.335/.test(v.retards[0].gesteCourt), 'une extension 5.320 active ⇒ « installe la 5.335 »', JSON.stringify(v.retards));
  const vr = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 2 * H, { ventesLu: N - 9 * H, annoncesLu: N - 2 * H })]) });
  dit(vr.etat === 'retard' && /ventes pas relues/.test(vr.retards[0].texte) && /Mes commandes/.test(vr.retards[0].gesteCourt), 'ventes 7 h derrière les annonces (RETARD_VENTES_MS 1 h) ⇒ « ventes pas relues — ouvre Vinted › Mes commandes »', JSON.stringify(vr.retards));

  // 7. Ses choix ne sont jamais nommés.
  const ex = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 3 * J), compte('2', 'compte_b', N - 30 * MIN)]), exclu: (p, id) => p === 'vinted' && id === '1' });
  dit(ex.etat === 'a-jour', 'un compte retiré des totaux (son choix) n’est jamais nommé', JSON.stringify(ex.retards));
  const ma = F.fraicheurUnique({ ...base, capture: capture([compte('1', 'compte_a', N - 3 * J, { masque: true }), compte('2', 'compte_b', N - 30 * MIN)]) });
  dit(ma.etat === 'a-jour', 'un compte masqué n’est jamais nommé', JSON.stringify(ma.retards));
  const rien = F.fraicheurUnique({ ...base, capture: { lignes: [], pannes: [], passu: [], comptesPrets: true, appareils: [], ancien: { ver: '', code: '', at: 0 }, achats: {} } });
  dit(rien.etat === 'cache', 'rien de relié ⇒ rien affirmé (le guide de démarrage parle)', rien.etat);

  // 8. Le branchement : une ligne dans la coque, la ligne ambre fondue dedans.
  const app = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
  const lf = sansCommentaires(fs.readFileSync(path.join(R, 'src/LigneFraicheur.jsx'), 'utf8'));
  dit((app.match(/<LigneFraicheurParesseuse /g) || []).length === 1 && /\{!baseKO && <Suspense[^\n]*<LigneFraicheurParesseuse baseKO=\{baseKO\}/.test(app), 'la coque rend la ligne UNE fois, jamais pendant une panne de base');
  dit(!/AlerteCaptureParesseuse|<AlerteCapture/.test(app), 'la ligne ambre « compte qui n’arrive plus » n’est plus une seconde voix');
  dit(/data-alerte-capture=/.test(lf) && /data-alerte-voir=/.test(lf), 'la ligne garde `data-alerte-capture` / `data-alerte-voir` pour une panne');
  dit(/horsLigneActif\(\)/.test(lf) && /navigator\.onLine === false/.test(lf), 'hors ligne (mesuré ou mode froid) ⇒ la ligne se tait');
  dit(!/data-comptes-a-relire=/.test(app) && !/data-fraicheur-achats=/.test(app) && !/<VintedResume /.test(app), 'plus de puce « Relire compte », de ligne d’Achats, de tête Vinted : une voix');
  dit(/data-retirer-verifie=/.test(app), '« Suivi vérifié il y a N min » reste sur Colis → À retirer (l’âge du statut des colis de CETTE liste)');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
