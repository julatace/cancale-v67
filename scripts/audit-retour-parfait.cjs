#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE RETOUR D'UN ACHAT, DE BOUT EN BOUT (15 nov., lot retour-parfait)
//  node scripts/audit-retour-parfait.cjs [--prouve : chaque mutation doit rougir]
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Tu as bien mis en place le retour de mon achat avec son bordereau ? Je veux que ce
// soit parfait et irréprochable. » Ses DEUX retours, mesurés en base (lecture seule), reproduits ici
// avec des valeurs INVENTÉES à la même forme (le dépôt est public) :
//   · « Nike » : bordereau Mondial Relay (n° de 8 chiffres), limite 16 nov. 10 h, l'e-mail Mondial
//     Relay « en transit » du même n° le 10 nov. ⇒ « Déposé le 10 nov. · en route vers le vendeur » ;
//   · « Autry » : bordereau reçu le 15 nov. 13 h, n° `XU#########JF`, limite 23 nov. 10 h (Paris),
//     PDF A4 PAYSAGE (842×595) qui nomme Chronopost (« Chrono Relais Europe », pied « Chronopost …
//     75014 Paris »), `transporteurPdf` ABSENT (ligne d'avant la lecture du PDF à la réception) ; son
//     achat Vinted dit encore « colis déposé en bureau de Poste ou point relais » (la forme mesurée).
// Ce fichier EXÉCUTE (§4.10) :
//   T  le transporteur : la lecture du PDF (`transporteurDuPdf`) sur un PDF inventé de la forme
//      Chronopost ; le RATTRAPAGE par la vraie route `/api/email-rattacher?mode=reclasser` (fausse base
//      PostgREST, filtres `meta->>` servis) — écrit SEULEMENT le manquant, idempotent, écriture
//      conditionnelle, lecture ratée ⇒ rien ; puis le serveur lit son départ chez Chronopost, et le
//      lien « Suivre ↗ » est la page publique de Chronopost ;
//   C  la carte : date limite en clair (lun. 23 nov. 10 h, Paris), étapes jusqu'au remboursement,
//      chaque coche PROUVÉE (e-mail du transporteur, lecture du départ, remboursement) ;
//   P  jamais « à retirer » (la règle partagée app / widget / rappel) ;
//   N  les notifications : rappel la veille au soir et le matin du dernier jour, « Retour déposé » /
//      « Livré au vendeur » lus chez le transporteur, une fois chacune, textes 5 langues.
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'rattrapage-ecrase-le-present': [['api/_lib/reclasser-retours.js', "  if (!String(data.transporteurPdf || '').trim() && c.transporteurPdf) out.transporteurPdf = c.transporteurPdf;", "  if (c.transporteurPdf) out.transporteurPdf = c.transporteurPdf;"]],
  'rattrapage-sans-condition': [['api/email-rattacher.js', "&meta->>pdfLu=is.null&select=id`", "&select=id`"]],
  'rattrapage-absent': [['api/email-rattacher.js', "  try { t = await transporteursRetours({ owner, lire, lireLigne, ecrireSi }); }", "  try { t = { ok: true, passu: false, faits: [] }; }"]],
  'rattrapage-relit-toujours': [['api/_lib/reclasser-retours.js', "  + '&meta->>_pdf=eq.true&meta->>pdfLu=is.null'", "  + '&meta->>_pdf=eq.true'"], ['api/_lib/reclasser-retours.js', "  if (data.pdfLu != null && data.pdfLu !== '') return null;\n", '']],
  // (23 nov., lot retours-suivi — Julien : « une étape postérieure prouvée implique les précédentes ») :
  'etape-impliquee-oubliee': [['src/retoursAchat.js', "  const impl = () => (voyage ? 'fait' : 'saute');", "  const impl = () => 'saute';"]],
  'implique-sans-voyage': [['src/retoursAchat.js', "  const voyage = c.etape !== 'rembourse' || (!(remb && remb.partiel) && !!(c.pdf || c.source === 'bordereau' || c.depose || f));", "  const voyage = true;"]],
  'rappel-apres-son-clic': [['api/_lib/retour-notifs.js', "    if (lui) continue;\n", '']],
  'rappel-mauvais-jour': [['api/_lib/retour-notifs.js', "if (moment === 'soir' && jour === demain)", "if (moment === 'soir' && jour === auj)"]],
  'depose-vieux-sonne': [['api/_lib/retour-notifs.js', "if (!lui && dep != null && maintenant - dep <= NOTIF_RETOUR_AGE_MAX_MS && maintenant >= dep)", "if (!lui && dep != null)"]],
  'deux-fois': [['api/_lib/retour-notifs.js', "    if (r === false) { deja++; continue; }\n", '']],
  'pas-su-envoie': [['api/_lib/retour-notifs.js', "if (!Array.isArray(track) || !(departs instanceof Map) || deposes === undefined || !Array.isArray(remb)) return", "if (false) return"]],
  'cron-soir-oublie': [['api/ship-reminders.js', "  try { retoursAchat = await notifsRetoursAchat('soir'); }", "  try { retoursAchat = null; }"]],
  'faux-rappel-pendant-lecture': [['src/retoursAchat.js', "aRenvoyer: cartes.filter((c) => c.etape === 'a-deposer' && !c.faitsEnCours)", "aRenvoyer: cartes.filter((c) => c.etape === 'a-deposer')"]],
  'forme-sans-cle': [['src/retoursAchat.js', "return l && l.transporteur && l.transporteur !== 'postal' ? l.transporteur : '';", "return /^[XZ][WU]\\d{9}JF$/.test(str(n)) ? 'chronopost' : '';"]],
  'tampon-par-dessus': [['src/App.jsx', "const t = await tamponnerBordereau(PL, pdf, { numero: c.num || '', titre: `RETOUR · ", "const t = await (async () => null)(PL, pdf, { numero: c.num || '', titre: `RETOUR · "]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 500) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 500)); } };
const importer = (p) => import('file://' + path.join(R, p));

// Valeurs INVENTÉES, à la forme mesurée.
const TX_NIKE = '99000048248', TX_AUTRY = '99000051379';
const SUIVI_NIKE = '81230048', SUIVI_AUTRY = 'XU900051378JF';
const NIKE = 'Baskets banc Air Max. Blanc et rose. Pointure 42.5', AUTRY = 'Autry banc Medalist';
const STATUT_AUTRY = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";   // la forme mesurée de l'achat
const LIM_NIKE = '2026-11-16T09:00:00.000Z', LIM_AUTRY = '2026-11-23T09:00:00.000Z';   // 10 h, Paris
const RECU_NIKE = '2026-11-08T15:52:33.799Z', RECU_AUTRY = '2026-11-15T13:00:36.602Z';
const MAINTENANT = Date.parse('2026-11-15T19:30:00Z');

// Un PDF inventé de la FORME du bordereau Chronopost (A4 paysage, Helvetica, textes « Chrono Relais
// Europe », « Consignement », pied de la société) — aucun nom, aucune adresse réels.
async function pdfChronopost(suivi) {
  const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([842, 595]); const f = await d.embedFont(StandardFonts.Helvetica);
  const t = (s, x, y, size = 9) => p.drawText(s, { x, y, size, font: f });
  t('FICHE DESTINATAIRE', 43, 552); t('Chrono Relais - Banc Expediteur', 516, 480); t('Chrono Relais Europe', 516, 300, 12);
  t('Consignement : ' + suivi, 516, 290); t('N de colis : ' + suivi, 43, 500); t('2SHOP EUR', 700, 200);
  t('Chronopost 3 Boulevard Romain Rolland - 75014 Paris - France', 43, 60, 7);
  d.setTitle('BANC ' + suivi);
  return Buffer.from(await d.save()).toString('base64');
}
async function pdfMondialRelay(suivi) {
  const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([595, 842]); const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText('MONDIAL RELAY  Point Relais banc  N de suivi : ' + suivi, { x: 40, y: 700, size: 12, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
const ligneBord = (tx, suivi, article, lim, recu, pdfB64, extra = {}) => ({ type: 'bordereau-retour', sens: 'achat', transaction: tx, suivi, dateLimite: lim === LIM_NIKE ? '16/11/2026 10 h 00' : '23/11/2026 10 h 00',
  dateLimiteJour: lim.slice(0, 10), dateLimiteIso: lim, article, account: 'banc_compte', uid: '111', pdfB64, filename: `Bon-Retour-Vinted-${tx}.pdf`, receivedAt: recu, ...extra });

(async () => {
  const PDF_A = await pdfChronopost(SUIVI_AUTRY), PDF_N = await pdfMondialRelay(SUIVI_NIKE);

  await essaie('T le transporteur de l’Autry', async () => {
    const TP = await importer('api/_lib/transporteur-pdf.js');
    const dec = await TP.transporteurDuPdf(PDF_A);
    dit(dec && dec.etat === 'ok' && dec.t === 'chronopost', 'T1 le PDF de la forme Chronopost (« Chrono Relais Europe », pied Chronopost) est lu « chronopost » par la règle de la réception', JSON.stringify(dec));
    const SC = await importer('api/_lib/suivi-colis.js');
    dit(SC.transporteurDeForme(SUIVI_AUTRY) === null, 'T1 la règle SERVEUR des formes (`transporteurDeForme`, XW/ZW…TS/SP) ne connaît pas XU…JF : côté serveur, c’est l’étiquette qui le prouve (rattrapage ci-dessous)');
    // La clé UPU S10 (poids 8 6 4 2 3 5 9 7) et la règle du scanner (src/scanColis.js, la même) : Chronopost par la forme.
    const SCAN = await importer('src/scanColis.js');
    const lu = SCAN.lireCodeColis(SUIVI_AUTRY), faux = SCAN.lireCodeColis(SUIVI_AUTRY.slice(0, 10) + '9JF');
    dit(SCAN.s10Valide(SUIVI_AUTRY) && lu && lu.transporteur === 'chronopost' && faux === null, 'T1 la clé S10 est juste et la forme XU…JF est celle des n° Chronopost mesurés (règle du scanner) ; une clé fausse ⇒ rien', JSON.stringify({ lu, faux }));
    const l = SC.lienSuivi('chronopost', SUIVI_AUTRY);
    dit(l && l.site === true && l.url === `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${SUIVI_AUTRY}`, 'T4 « Suivre ↗ » : la page PUBLIQUE de Chronopost (adresse attestée), n° pré-rempli', JSON.stringify(l));

    // Le rattrapage, par la VRAIE route (sa session).
    const { fauxInbound, A } = require('./_faux-inbound.cjs');
    const F = fauxInbound(R);
    F.filtresMeta(true);
    await F.charger();
    const f0 = global.fetch;
    let intercepte = null;
    global.fetch = async (url, o) => {
      if (/\/auth\/v1\/user/.test(String(url))) return new Response(JSON.stringify({ id: A, email: 'banc@banc.test' }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (intercepte) { const r = await intercepte(String(url), o || {}); if (r) return r; }
      return f0(url, o);
    };
    const route = (await importer('api/email-rattacher.js')).default;
    const appeler = async () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {};
      await route({ method: 'POST', query: { mode: 'reclasser' }, headers: { authorization: 'Bearer jeton-banc' }, body: '{}' }, r); return r; };
    const poser = () => {
      F.vider(); F.filtresMeta(true);
      F.base.set(`${A}|email_bordretour_${TX_AUTRY}`, ligneBord(TX_AUTRY, SUIVI_AUTRY, AUTRY, LIM_AUTRY, RECU_AUTRY, PDF_A));
      F.base.set(`${A}|email_bordretour_${TX_NIKE}`, ligneBord(TX_NIKE, SUIVI_NIKE, NIKE, LIM_NIKE, RECU_NIKE, PDF_N));
      // Une ligne qui A DÉJÀ son transporteur (rangé à la réception) mais pas de marque : rien n'est remplacé.
      F.base.set(`${A}|email_bordretour_99000000777`, ligneBord('99000000777', 'XU900000777JF', 'Banc deja range', LIM_AUTRY, RECU_AUTRY, PDF_A, { transporteurPdf: 'mondialrelay' }));
      // La ligne d'un AUTRE vendeur : jamais lue, jamais écrite.
      F.base.set(`99999999-0000-0000-0000-000000000000|email_bordretour_99000000888`, ligneBord('99000000888', 'XU900000888JF', 'Banc autre vendeur', LIM_AUTRY, RECU_AUTRY, PDF_A));
    };
    poser();
    const avant = JSON.parse(JSON.stringify(F.base.get(`${A}|email_bordretour_${TX_AUTRY}`)));
    let r = await appeler();
    const apres = F.base.get(`${A}|email_bordretour_${TX_AUTRY}`) || {};
    dit(r.code === 200 && apres.transporteurPdf === 'chronopost' && apres.pdfLu === 'ok', 'T2 la ligne ANCIENNE de l’Autry reçoit `transporteurPdf: chronopost` (la route, sa session)', JSON.stringify({ code: r.code, t: apres.transporteurPdf, lu: apres.pdfLu, corps: r.corps }));
    const ajoute = Object.keys(apres).filter((k) => !(k in avant)).sort();
    dit(Object.keys(avant).every((k) => JSON.stringify(avant[k]) === JSON.stringify(apres[k])) && ajoute.every((k) => ['pdfLu', 'pdfRegle', 'transporteurPdf', 'suiviPdf'].includes(k)),
      'T2 seulement le MANQUANT est écrit : PDF, n°, date limite, compte… identiques ; ajoutés : ' + ajoute.join(', '), JSON.stringify(ajoute));
    const deja = F.base.get(`${A}|email_bordretour_99000000777`) || {};
    dit(deja.transporteurPdf === 'mondialrelay' && deja.pdfLu === 'ok', 'T2 un transporteur DÉJÀ rangé n’est jamais remplacé (même si l’étiquette en nomme un autre)', JSON.stringify(deja.transporteurPdf));
    const autre = F.base.get(`99999999-0000-0000-0000-000000000000|email_bordretour_99000000888`) || {};
    dit(!autre.pdfLu && !autre.transporteurPdf, 'T2 la ligne d’un AUTRE vendeur n’est ni lue ni écrite (filtre `owner` = lui)');
    const n = F.ecritures.length;
    let relus = 0;
    intercepte = async (url, o) => { if ((!o.method || o.method === 'GET') && /select=data(&|$)/.test(url)) relus++; return null; };
    r = await appeler();
    intercepte = null;
    dit(r.code === 200 && F.ecritures.length === n && relus === 0 && (r.corps.transporteurs || []).length === 0, 'T2 un 2e passage ne relit (aucun PDF) ni n’écrit rien (idempotent : la marque `pdfLu`)', JSON.stringify({ avant: n, apres: F.ecritures.length, relus, c: r.corps }));
    // Lecture ratée de la ligne ⇒ rien écrit, 503.
    poser();
    intercepte = async (url, o) => ((!o.method || o.method === 'GET') && /id=eq\.email_bordretour_/.test(decodeURIComponent(url)) && /select=data/.test(url) ? new Response('<html>522</html>', { status: 522 }) : null);
    const n0 = F.ecritures.length;
    r = await appeler();
    intercepte = null;
    dit(r.code === 503 && F.ecritures.length === n0 && !(F.base.get(`${A}|email_bordretour_${TX_AUTRY}`) || {}).transporteurPdf, 'T2 lecture de la ligne ratée ⇒ RIEN écrit, 503 (« pas su »)', JSON.stringify({ code: r.code, ecr: F.ecritures.length - n0 }));
    // Une réception rejouée ENTRE la lecture et l'écriture (la ligne a déjà sa marque) : jamais écrasée.
    poser();
    intercepte = async (url, o) => {
      if (o.method === 'PATCH' && /email_bordretour_99000051379/.test(decodeURIComponent(url))) {
        const k = `${A}|email_bordretour_${TX_AUTRY}`; F.base.set(k, { ...F.base.get(k), pdfLu: 'ok', transporteurPdf: 'chronopost', rejoue: true });
      }
      return null;
    };
    r = await appeler();
    intercepte = null;
    dit((F.base.get(`${A}|email_bordretour_${TX_AUTRY}`) || {}).rejoue === true, 'T2 l’écriture est CONDITIONNELLE (`pdfLu` toujours absent) : une réception rejouée entre-temps n’est jamais écrasée', JSON.stringify(F.base.get(`${A}|email_bordretour_${TX_AUTRY}`) && Object.keys(F.base.get(`${A}|email_bordretour_${TX_AUTRY}`))));
    global.fetch = f0;

    // T3 : le départ est lu chez Chronopost SEULEMENT avec le transporteur lu sur l'étiquette.
    const D = await importer('api/_lib/depart-colis.js');
    const choix = (tp) => D.departsAInterroger({ sortants: D.sortantsDuVendeur({ retours: [{ suivi: SUIVI_AUTRY, transaction: TX_AUTRY, receivedAt: RECU_AUTRY, transporteurPdf: tp }] }), departs: new Map(), entrants: new Set(), maintenant: MAINTENANT, max: 3, parTransporteur: 3 });
    const sans = choix(''), avec = choix('chronopost');
    dit(sans.length === 0 && avec.length === 1 && avec[0].carrier === 'chronopost' && avec[0].suivi === SUIVI_AUTRY, 'T3 avec `transporteurPdf` le serveur lit le départ du retour chez Chronopost (`depart_`, jamais `transp_`) ; sans, rien (la forme ne suffit pas)', JSON.stringify({ sans, avec }));
  });

  await essaie('C la carte', async () => {
    const RA = await importer('src/retoursAchat.js');
    const bord = (tx, suivi, article, lim, recu, extra = {}) => ({ tx, suivi, dateLimite: lim === LIM_NIKE ? '16/11/2026 10 h 00' : '23/11/2026 10 h 00', dateLimiteIso: lim, article, uid: '111', account: 'banc_compte', at: recu, pdf: true, sens: 'achat', ...extra });
    const achats = [{ transaction_id: TX_AUTRY, title: AUTRY, status: STATUT_AUTRY, conversation_id: 'conv-a', photo: { url: 'x' } }, { transaction_id: TX_NIKE, title: NIKE, status: 'Commande expédiée et en cours d’acheminement !', conversation_id: 'conv-n' }];
    const trackN = [{ suivi: SUIVI_NIKE, status: 'transit', emailAt: '2026-11-10T17:52:04.000Z', at: '2026-11-10T17:52:33.548Z', carrier: 'mondialrelay' }];
    const base = { bords: [bord(TX_NIKE, SUIVI_NIKE, NIKE, LIM_NIKE, RECU_NIKE), bord(TX_AUTRY, SUIVI_AUTRY, AUTRY, LIM_AUTRY, RECU_AUTRY, { transporteurPdf: 'chronopost' })], achats, remb: [], track: trackN, departs: new Map(), maintenant: MAINTENANT };
    let r = RA.retoursAchat(base);
    const a = r.cartes.find((c) => c.tx === TX_AUTRY), n = r.cartes.find((c) => c.tx === TX_NIKE);
    dit(n && n.etape === 'en-route' && n.faits && n.faits.deposeAt === '2026-11-10T17:52:04.000Z' && n.faits.source === 'email', 'C1 Nike : « Déposé le 10 nov. · en route vers le vendeur » (l’e-mail Mondial Relay du MÊME n°)', JSON.stringify(n && [n.etape, n.faits]));
    const eN = RA.etapesRetour(n).map((e) => e.cle + ':' + e.etat).join(' ');
    dit(eN === 'bordereau:fait deposer:fait route:ici livre:avenir rembourse:avenir' && RA.etapesRetour(n)[1].at === '2026-11-10T17:52:04.000Z', 'C1 Nike : étapes « bordereau ✓ · déposé ✓ (10 nov.) · en route ← ici · livré · remboursé »', eN);
    dit(a && a.etape === 'a-deposer' && a.transporteur === 'chronopost' && a.titre === AUTRY && a.achat && r.aRenvoyer.map((c) => c.tx).join() === TX_AUTRY, 'C2 Autry : à déposer, transporteur Chronopost, photo/titre par SON n° de transaction ; seul en tête de Ma journée', JSON.stringify(a && [a.etape, a.transporteur, a.titre]));
    const q = RA.quandLimite(a, MAINTENANT);
    const jourMots = new Date(Date.parse(q.jour + 'T12:00:00Z')).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
    dit(q.cle === 'date' && q.jour === '2026-11-23' && a.heure === '10 h' && jourMots === 'lun. 23 nov.' && RA.joursAvantLimite(a, MAINTENANT) === 8, 'C2 Autry : « À déposer avant lun. 23 nov. 10 h · dans 8 jours » (heure de Paris ; le 23 nov. 2026 est un LUNDI)', JSON.stringify({ q, h: a.heure, jourMots, j: RA.joursAvantLimite(a, MAINTENANT) }));
    // Sans `transporteurPdf` (la ligne d'avant le rattrapage), la carte nomme déjà Chronopost par la forme (clé S10 juste) ; une clé fausse ⇒ personne.
    const sansPdf = RA.retoursAchat({ ...base, bords: [bord(TX_AUTRY, SUIVI_AUTRY, AUTRY, LIM_AUTRY, RECU_AUTRY)] }).cartes[0];
    const cleFausse = RA.retoursAchat({ ...base, bords: [bord(TX_AUTRY, SUIVI_AUTRY.slice(0, 10) + '9JF', AUTRY, LIM_AUTRY, RECU_AUTRY)] }).cartes[0];
    dit(sansPdf.transporteur === 'chronopost' && sansPdf.transporteurSource === 'forme' && a.transporteurSource === 'etiquette' && cleFausse.transporteur === '', 'C2 sans l’étiquette lue : Chronopost par la forme (clé S10 juste, règle du scanner) ; l’étiquette passe d’abord ; une clé fausse ⇒ personne', JSON.stringify([sansPdf.transporteur, sansPdf.transporteurSource, a.transporteurSource, cleFausse.transporteur]));
    const eA = RA.etapesRetour(a).map((e) => e.cle + ':' + e.etat).join(' ');
    dit(eA === 'bordereau:fait deposer:ici route:avenir livre:avenir rembourse:avenir' && RA.etapesRetour(a)[0].transporteur === 'chronopost', 'C2 Autry : étapes « bordereau ✓ Chronopost · à déposer ← ici · … »', eA);
    // L'avancement, fait par fait (le faux e-mail transporteur, la lecture du départ, le remboursement).
    const avance = (extra) => RA.retoursAchat({ ...base, ...extra }).cartes.find((c) => c.tx === TX_AUTRY);
    let c = avance({ track: [...trackN, { suivi: SUIVI_AUTRY, status: 'transit', emailAt: '2026-11-20T09:12:00.000Z', carrier: 'chronopost' }] });
    dit(c.etape === 'en-route' && c.faits.source === 'email' && c.faits.deposeAt === '2026-11-20T09:12:00.000Z', 'C3 un e-mail Chronopost « en transit » du n° EXACT ⇒ « Déposé le 20 nov. »', JSON.stringify(c.faits));
    c = avance({ track: [...trackN, { suivi: SUIVI_AUTRY.slice(0, -1) + 'G', status: 'transit', emailAt: '2026-11-20T09:12:00.000Z', carrier: 'chronopost' }] });
    dit(c.etape === 'a-deposer' && !c.faits, 'C3 l’e-mail d’un AUTRE n° (une lettre d’écart) ne bouge rien');
    c = avance({ departs: new Map([[SUIVI_AUTRY, { carrier: 'chronopost', priseAt: '2026-11-20T09:12:00Z', etat: 'en_route', etatAt: '2026-11-20T09:12:00Z' }]]) });
    dit(c.etape === 'en-route' && c.faits.source === 'transporteur', 'C3 la lecture chez Chronopost (prise en charge, `depart_`) ⇒ déposé, « lu chez Chronopost »', JSON.stringify(c.faits));
    c = avance({ departs: new Map([[SUIVI_AUTRY, { carrier: 'chronopost', priseAt: '2026-11-20T09:12:00Z', etat: 'livre', etatAt: '2026-11-22T15:00:00Z' }]]) });
    dit(c.etape === 'recu-vendeur' && RA.etapesRetour(c).map((e) => e.etat).join() === 'fait,fait,fait,fait,ici', 'C3 livré au vendeur ⇒ « livré ✓ (22 nov.) · remboursé ← ici (sous 2 jours) »', JSON.stringify(RA.etapesRetour(c)));
    c = avance({ departs: new Map([[SUIVI_AUTRY, { carrier: 'chronopost', priseAt: '2026-11-20T09:12:00Z', etat: 'livre', etatAt: '2026-11-22T15:00:00Z' }]]), remb: [{ tx: TX_AUTRY, montant: '34.32', at: '2026-11-24T10:00:00Z' }] });
    const eR = RA.etapesRetour(c);
    dit(c.etape === 'rembourse' && eR.every((e) => e.etat === 'fait') && eR[4].montant === 34.32, 'C3 l’e-mail « … a été remboursée » ⇒ « Remboursé · 34,32 € », toutes les étapes cochées (chacune prouvée)', JSON.stringify(eR));
    c = avance({ remb: [{ tx: TX_AUTRY, montant: '34.32', at: '2026-11-24T10:00:00Z' }] });
    // (23 nov., lot retours-suivi) Julien, sur sa capture (« Remboursé ✓ » mais « En route ○ · Livré ○ ») : une étape postérieure
    // PROUVÉE implique les précédentes — faites, « date pas vue » (`implicite`, `at` nul) : jamais une date inventée.
    const eI = RA.etapesRetour(c);
    dit(c.etape === 'rembourse' && eI.map((e) => e.etat + (e.implicite ? '*' : '')).join() === 'fait,fait*,fait*,fait*,fait' && eI.slice(1, 4).every((e) => !e.at),
      'C4 remboursé (bordereau reçu, aucun fait du transporteur) : déposé / en route / livré au vendeur FAITS, « date pas vue », aucune date inventée', JSON.stringify(eI));
    const cP = avance({ montantDe: () => 34.32, remb: [{ tx: TX_AUTRY, montant: '5.00', at: '2026-11-24T10:00:00Z' }] });
    const cA = RA.retoursAchat({ ...base, bords: [], achats: [{ transaction_id: Number(TX_AUTRY), title: AUTRY, status: 'Retour initié', price: { amount: '34.32' } }], remb: [{ tx: TX_AUTRY, montant: '34.32', at: '2026-11-24T10:00:00Z' }] }).cartes.find((x) => x.tx === TX_AUTRY);
    dit(cP && cP.rembourse.partiel && RA.etapesRetour(cP).map((e) => e.etat).join() === 'fait,saute,saute,saute,fait' && cA && cA.etape === 'rembourse' && RA.etapesRetour(cA).map((e) => e.etat).join() === 'saute,saute,saute,saute,fait',
      'C4 le remboursement ne prouve PAS que le colis a voyagé (remboursement PARTIEL, ou aucun bordereau ni dépôt ni fait) : étapes du colis grisées, rien de coché', JSON.stringify([cP && RA.etapesRetour(cP).map((e) => e.etat), cA && RA.etapesRetour(cA).map((e) => e.etat)]));
    const cM = avance({ track: [...trackN, { suivi: SUIVI_AUTRY, status: 'transit', emailAt: '2026-11-20T09:12:00.000Z', carrier: 'chronopost' }], remb: [{ tx: TX_AUTRY, montant: '34.32', at: '2026-11-24T10:00:00Z' }] });
    const eM = RA.etapesRetour(cM);
    dit(eM.map((e) => e.etat + (e.implicite ? '*' : '')).join() === 'fait,fait,fait*,fait*,fait' && eM[1].at === '2026-11-20T09:12:00.000Z' && !eM[3].at,
      'C4 le cas de Julien (Mondial Relay : « en transit » lu, puis remboursé) : déposé DATÉ, en route et livré « date pas vue »', JSON.stringify(eM));
    c = avance({ deposes: { ['r:' + TX_AUTRY]: '2026-11-21T08:00:00Z' } });
    dit(c.etape === 'depose' && RA.etapesRetour(c)[1].parLui === true && RA.etapesRetour(c)[1].etat === 'fait', 'C4 « Déposé » de SA main (aucun fait lu) : étape notée « par toi », la carte n’invente rien de plus', JSON.stringify(RA.etapesRetour(c)[1]));
    // Les e-mails du transporteur pas encore LUS : aucun retour qui a un n° n'est dit « à déposer » en tête (Nike est peut-être parti).
    const enCours = RA.retoursAchat({ ...base, track: [], trackEnCours: true });
    dit(enCours.aRenvoyer.length === 0 && enCours.cartes.find((x) => x.tx === TX_NIKE).faitsEnCours === true && RA.retoursAchat({ ...base }).aRenvoyer.length === 1, 'C5 pendant la lecture des e-mails du transporteur, rien n’est pressé « à déposer » (jamais un faux rappel du Nike déjà déposé)', JSON.stringify(enCours.aRenvoyer.map((x) => x.tx)));
  });

  await essaie('P jamais « à retirer »', async () => {
    const S = await importer('api/_lib/suivi-colis.js');
    const txs = S.txAchatsEnRetour([{ transaction: TX_NIKE, sens: 'achat' }, { transaction: TX_AUTRY, sens: 'achat' }]);
    dit(txs && txs.has(TX_AUTRY) && txs.has(TX_NIKE) && S.achatEnRetour({ transaction_id: Number(TX_AUTRY), status: STATUT_AUTRY }, txs), 'P1 les deux achats sont « en retour » par LEUR bordereau (n° de transaction) — l’Autry « colis déposé en point relais » n’est jamais « à retirer »');
    dit(S.finDeCommandeAchat({ statut: STATUT_AUTRY, auRelais: true, retour: true }) === 'retire', 'P1 le rappel du matin le tient pour fini (la règle partagée app / widget / rappel ; widget et rappel EXÉCUTÉS par audit-retour-pas-a-retirer)');
    const RN = await importer('api/_lib/retour-notifs.js');
    dit(!/retrait|a-retirer|arrivee/.test(JSON.stringify(RN.CLES_NOTIF_RETOUR)) && /cat: 'colis', title: t\.title/.test(fs.readFileSync(path.join(R, 'api/_lib/retour-notifs.js'), 'utf8')), 'P2 aucune notification de retour ne prend la forme « à retirer » (ses clés : rappel, déposé, livré)');
  });

  await essaie('N les notifications', async () => {
    const RN = await importer('api/_lib/retour-notifs.js');
    const bords = [{ tx: TX_NIKE, suivi: SUIVI_NIKE, article: NIKE, dateLimiteIso: LIM_NIKE, dateLimite: '16/11/2026 10 h 00', sens: 'achat', transporteurPdf: '' },
      { tx: TX_AUTRY, suivi: SUIVI_AUTRY, article: AUTRY, dateLimiteIso: LIM_AUTRY, dateLimite: '23/11/2026 10 h 00', sens: 'achat', transporteurPdf: 'chronopost' }];
    const trackN = [{ suivi: SUIVI_NIKE, status: 'transit', emailAt: '2026-11-10T17:52:04.000Z', carrier: 'mondialrelay' }];
    const cles = (o) => RN.notifsRetours({ bords, track: trackN, departs: new Map(), ...o }).map((x) => x.cle);
    const soir22 = Date.parse('2026-11-22T18:00:00Z'), matin23 = Date.parse('2026-11-23T05:00:00Z');
    dit(cles({ moment: 'soir', maintenant: soir22 }).join() === `retour-rappel-veille-${TX_AUTRY}`, 'N1 le 22 nov. au soir : « Retour à déposer avant demain 10 h » pour l’Autry seulement (Nike est déjà déposé)', cles({ moment: 'soir', maintenant: soir22 }).join());
    dit(cles({ moment: 'matin', maintenant: matin23 }).join() === `retour-rappel-jour-${TX_AUTRY}`, 'N1 le 23 nov. au matin : « Dernier jour pour ton retour · à déposer avant 10 h »', cles({ moment: 'matin', maintenant: matin23 }).join());
    dit(cles({ moment: 'soir', maintenant: MAINTENANT }).length === 0 && cles({ moment: 'matin', maintenant: Date.parse('2026-11-23T10:00:00Z') }).length === 0, 'N1 ni trop tôt (le 15 au soir), ni après la limite (le 23 à 11 h)');
    dit(cles({ moment: 'soir', maintenant: soir22, deposes: { ['r:' + TX_AUTRY]: '2026-11-21T08:00:00Z' } }).length === 0 && cles({ moment: 'soir', maintenant: soir22, rembTx: new Set([TX_AUTRY]) }).length === 0, 'N1 pas de rappel après SON « Déposé », ni après un remboursement');
    dit(cles({ moment: 'matin', maintenant: MAINTENANT }).every((k) => !/depose|livre/.test(k)), 'N2 Nike déposé le 10 nov. : « Retour déposé » ne sonne PAS 5 jours après (72 h au plus)');
    const dep = new Map([[SUIVI_AUTRY, { suivi: SUIVI_AUTRY, carrier: 'chronopost', priseAt: '2026-11-20T09:12:00Z', etat: 'en_route', etatAt: '2026-11-20T09:12:00Z' }]]);
    const l2 = RN.notifsRetours({ bords, track: trackN, departs: dep, moment: 'soir', maintenant: Date.parse('2026-11-20T18:00:00Z') });
    dit(l2.length === 1 && l2[0].cle === `retour-depose-${TX_AUTRY}` && l2[0].sorte === 'retourDepose' && l2[0].transporteur === 'chronopost', 'N2 pris en charge lu CHEZ Chronopost ⇒ « Retour déposé » (la clé de la voie e-mail : jamais deux fois)', JSON.stringify(l2));
    const liv = new Map([[SUIVI_AUTRY, { suivi: SUIVI_AUTRY, carrier: 'chronopost', priseAt: '2026-11-20T09:12:00Z', etat: 'livre', etatAt: '2026-11-22T15:00:00Z' }]]);
    const l3 = RN.notifsRetours({ bords, track: trackN, departs: liv, moment: 'soir', maintenant: Date.parse('2026-11-23T12:00:00Z') }).map((x) => x.cle);
    dit(l3.includes(`retour-livre-${TX_AUTRY}`) && !l3.includes(`retour-depose-${TX_AUTRY}`), 'N2 livré au vendeur ⇒ « Retour livré au vendeur » (le dépôt, vieux de plus de 72 h, ne resonne pas)', l3.join());
    // La passe, entrées injectées : une fois, et rien sur « pas su ».
    const pousses = [], dedup = new Set();
    const io = (o = {}) => ({ moment: 'soir', maintenant: soir22, lire: async (q) => (/email_bordretour_/.test(q) ? bords : /email_track_/.test(q) ? trackN : []), lireDeparts: async () => new Map(), lireDeposes: async () => null,
      reserver: async (k) => { if (dedup.has(k)) return false; dedup.add(k); return true; }, envoyer: async (n) => { pousses.push(n); return { sent: 1 }; },
      texte: (n) => ({ title: 'T ' + n.sorte, body: 'B' }), active: async () => true, lien: (n) => '/achats?tx=' + n.tx, ...o });
    let p = await RN.passeNotifsRetours(io());
    const p2 = await RN.passeNotifsRetours(io());
    dit(p.fait && p.envoyees === 1 && p2.envoyees === 0 && p2.deja === 1 && pousses.length === 1 && pousses[0].cat === 'colis' && pousses[0].tag === `retour-rappel-veille-${TX_AUTRY}` && pousses[0].echeance === LIM_AUTRY, 'N3 la passe du cron : envoyée UNE fois (`push_dedup`), famille « colis », échéance = la limite lue', JSON.stringify({ p, p2, pousses }));
    pousses.length = 0; dedup.clear();
    p = await RN.passeNotifsRetours(io({ lireDeposes: async () => undefined }));
    const p3 = await RN.passeNotifsRetours(io({ lire: async (q) => (/email_track_/.test(q) ? null : /email_bordretour_/.test(q) ? bords : []) }));
    dit(!p.fait && !p3.fait && pousses.length === 0, 'N3 une lecture ratée (son « Déposé », les e-mails du transporteur) ⇒ RIEN envoyé', JSON.stringify({ p, p3 }));
    const pr = await RN.passeNotifsRetours(io({ active: async () => false }));
    dit(pousses.length === 0 && pr.raison === 'désactivé par le vendeur', 'N3 la famille « colis » coupée par lui ⇒ rien');
    // Les textes : 5 langues, titre ≤ 40, corps ≤ 90, sans identifiant, la date en clair.
    const NR = await importer('api/_lib/notif-redaction.js');
    const tous = [];
    for (const l of NR.LANGUES_NOTIF) {
      const v = NR.rediger({ sorte: 'retourRappel', article: AUTRY, limite: LIM_AUTRY, quand: 'veille', heure: true }, { langue: l, maintenant: soir22 });
      const j = NR.rediger({ sorte: 'retourRappel', article: AUTRY, limite: LIM_AUTRY, quand: 'jour', heure: true }, { langue: l, maintenant: matin23 });
      tous.push([l, v, j]);
    }
    dit(tous.every(([, v, j]) => v && j && v.title.length <= NR.TITRE_MAX && j.title.length <= NR.TITRE_MAX && v.body.length <= NR.CORPS_MAX && j.body.length <= NR.CORPS_MAX && !/\d{9,}/.test(v.title + v.body + j.title + j.body) && !/…$/.test(v.title)),
      'N4 5 langues : titre ≤ 40, corps ≤ 90, aucun n° de transaction, rien de coupé', JSON.stringify(tous));
    const fr = tous[0];
    dit(fr[1].title === 'Retour à déposer avant demain 10 h' && fr[1].body === `${AUTRY} · Imprime le bordereau, emballe, dépose le colis.` && fr[2].title === 'Dernier jour pour ton retour' && fr[2].body === `À déposer avant 10 h · ${AUTRY}`, 'N4 en français : « Retour à déposer avant demain 10 h » / « Dernier jour pour ton retour · À déposer avant 10 h »', JSON.stringify(fr));
    const dd = NR.rediger({ sorte: 'retourDepose', article: AUTRY, transporteur: 'Chronopost' }, { langue: 'fr' }), rb = NR.rediger({ sorte: 'rembourse', montant: 34.32, article: AUTRY }, { langue: 'fr' }), lv = NR.rediger({ sorte: 'retourLivre', article: AUTRY }, { langue: 'fr' });
    dit(/^Retour déposé/.test(dd.title) && /Chronopost/.test(dd.body) && /^Retour livré au vendeur/.test(lv.title) && /^Remboursé · 34,32\s€/.test(rb.title), 'N4 « Retour déposé · Pris en charge par Chronopost » · « Retour livré au vendeur » · « Remboursé · 34,32 € »', JSON.stringify([dd, lv, rb]));
    // Le cron les appelle : le matin ET le soir (lu sur la source, commentaires retirés).
    const SR = sansCommentaires(fs.readFileSync(path.join(R, 'api/ship-reminders.js'), 'utf8'));
    dit(/retoursAchat = await notifsRetoursAchat\('matin'\)/.test(SR) && /retoursAchat = await notifsRetoursAchat\('soir'\)/.test(SR) && /reserver: async \(cle\) => \{\s*const r = await modifierCas\('push_dedup'/.test(SR), 'N5 le cron du matin ET celui du soir passent les retours, réservation dans `push_dedup`');
  });

  await essaie('I l’impression', async () => {
    const APP = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    const m = /const preparerRetourPdf = async \(c\) => \{[\s\S]*?\n  \};\n  const imprimerRetourAchat = \(c\) => \{[\s\S]*?\n  \};/.exec(APP);
    dit(!!m && /tamponnerBordereau\(PL, pdf,/.test(m[0]) && !/tamponnerRetour\(/.test(m[0]), 'I1 le bordereau de retour passe par LE chemin des bordereaux (`tamponnerBordereau` : zone blanche sinon fiche après l’étiquette) — plus de rectangle posé par-dessus', m ? '' : 'introuvable');
    dit(!!m && /if \(deja && deja\.url\) return ouvrirPdfLot\(deja, \{ geste: true/.test(m[0]), 'I2 le toucher ouvre le PDF DÉJÀ préparé sans rien attendre (iPhone : la feuille « Imprimer » dans le geste)');
  });

  console.log(ko ? `\n❌ audit-retour-parfait : ${ko} rouge(s)` : '\n✅ audit-retour-parfait : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
