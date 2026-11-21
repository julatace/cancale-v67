#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE SUIVI D'UN RETOUR PAR SON N° EXACT (15 nov., lot retours-suivi)
//  node scripts/audit-retours-suivi.cjs [--prouve : chaque mutation doit rougir]
// ════════════════════════════════════════════════════════════════════════════
// Julien : « regarde les retours et câble les numéros de suivi ». Mesuré (lecture seule) :
// le retour Nike était DÉPOSÉ le 10 nov. (e-mail Mondial Relay « Votre colis est entre de
// bonnes mains », même n° que le bordereau de retour) ; la carte disait « avant demain 10 h ».
// Le n° lu sur l'ACHAT Vinted est celui du colis d'ORIGINE (BRT Italie) : jamais le retour.
// Formes INVENTÉES (dépôt public). Ce fichier EXÉCUTE la vraie route des e-mails (§4.10) :
//   S  la règle (api/_lib/retour-suivi.js, src/retoursAchat.js) : un fait ⇒ l'étape avance
//      seule (déposé le …, au relais du vendeur, livré) ; aucun fait / un autre n° ⇒ rien ;
//      « pas su » ⇒ rien ; deux retours au même n° ⇒ ni l'un ni l'autre ; « Déposé » (son
//      clic) reste tant qu'aucun fait n'est lu ; le dépôt sort le retour de « À renvoyer » ;
//   R  la route : le bordereau de retour porte le transporteur LU sur l'étiquette ; l'e-mail
//      Mondial Relay du même n° est rangé SORTANT (jamais « à retirer ») et sonne « Retour
//      déposé · … » une fois — pas si LUI a touché « Déposé » ; « livré » sonne « Retour livré
//      au vendeur » ; « a été remboursée » sonne « Remboursé · 34,32 € » ; un e-mail d'un autre
//      n° ne sonne rien ; deux bordereaux au même n° ⇒ rien ;
//   D  le serveur lit le colis d'un retour comme un DÉPART (`depart_`, jamais `transp_`) ;
//   N  les textes (api/_lib/notif-redaction.js) : titre ≤ 40, sans identifiant, 5 langues.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'egalite-floue': [['api/_lib/retour-suivi.js', "    if (!t || normaliserSuiviRetour(t.suivi) !== k) continue;", "    if (!t || !normaliserSuiviRetour(t.suivi).startsWith(k.slice(0, 6))) continue;"]],
  'partage-ignore': [['src/retoursAchat.js', "    c.suiviPartage = !!(k && partages.has(k));", "    c.suiviPartage = false;"]],
  'pas-su-vaut-depose': [['api/_lib/retour-suivi.js', "  if (!faits.length) return null;", "  if (!faits.length) return { etape: 'en-route', at: null, source: 'email', deposeAt: null, deposeSource: 'email', carrier: '' };"]],
  'fait-ignore': [['src/retoursAchat.js', "      : c.faits ? c.faits.etape\n", "\n"]],
  'retour-non-sortant': [['api/email-inbound.js', "          if (retourLie) sensLigne = 'sortant';", ""]],
  'deux-bordereaux-un-retour': [['api/_lib/retour-suivi.js', "  if (parTx.size !== 1) return null;", "  if (parTx.size < 1) return null;"]],
  'sonne-malgre-son-clic': [['api/email-inbound.js', "          if (Array.isArray(dep) && !lui) await pushOnce(", "          if (Array.isArray(dep)) await pushOnce("]],
  'retours-pas-lus-comme-depart': [['api/_lib/transporteurs-lecture.js', "return { departs, sortants: D.sortantsDuVendeur({ vcVentes, bords, retours }) };", "return { departs, sortants: D.sortantsDuVendeur({ vcVentes, bords }) };"]],
  'rembourse-muet': [['api/email-inbound.js', "        if (!ecritureRatee()) try { await pushOnce({ ...texteRembourse(", "        if (false) try { await pushOnce({ ...texteRembourse("]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 400)); } };
const importer = (p) => import('file://' + path.join(R, p));
const fs = require('fs');

const TX = '99000011122', TX2 = '99000033344', SUIVI = '81234567', SUIVI2 = '81234599';
const ARTICLE = 'Baskets banc Air. Blanc et rose. Pointure 42.5';

(async () => {
  await essaie('S la règle', async () => {
    const RS = await importer('api/_lib/retour-suivi.js');
    const RA = await importer('src/retoursAchat.js');
    const tr = (status, emailAt, extra = {}) => ({ suivi: SUIVI, status, emailAt, at: emailAt, carrier: 'mondialrelay', ...extra });
    let f = RS.faitsRetour(SUIVI, { track: [tr('transit', '2026-11-10T17:52:04Z')] });
    dit(f && f.etape === 'en-route' && f.deposeAt === '2026-11-10T17:52:04.000Z' && f.source === 'email' && f.carrier === 'mondialrelay', 'S1 e-mail « en transit » du même n° ⇒ déposé le 10 nov., en route (source : l’e-mail du transporteur)', JSON.stringify(f));
    f = RS.faitsRetour(SUIVI, { track: [tr('transit', '2026-11-10T17:52:04Z'), tr('available', '2026-11-12T09:00:00Z'), tr('delivered', '2026-11-13T15:00:00Z', { retire: '2026-11-13T15:10:00Z' })] });
    dit(f && f.etape === 'recu-vendeur' && f.at === '2026-11-13T15:10:00.000Z' && f.deposeAt === '2026-11-10T17:52:04.000Z', 'S1 le plus avancé gagne (livré au vendeur le 13), la date de dépôt reste le PREMIER fait', JSON.stringify(f));
    f = RS.faitsRetour(SUIVI, { track: [], departs: new Map([[SUIVI, { carrier: 'chronopost', priseAt: '2026-11-11T08:00:00Z', etat: 'en_route', etatAt: '2026-11-11T08:00:00Z' }]]) });
    dit(f && f.etape === 'en-route' && f.source === 'transporteur' && f.carrier === 'chronopost', 'S1 lecture chez le transporteur (prise en charge) ⇒ déposé, source « transporteur »', JSON.stringify(f));
    f = RS.faitsRetour(SUIVI, { departs: new Map([[SUIVI, { carrier: 'chronopost', priseAt: null, etat: 'en_route', detail: 'prepare' }]]) });
    dit(f === null, 'S2 étiquette seulement créée (« prepare ») ⇒ rien (pas encore déposé)', JSON.stringify(f));
    dit(RS.faitsRetour(SUIVI, { track: [{ ...tr('transit', '2026-11-10T17:52:04Z'), suivi: SUIVI2 }] }) === null && RS.faitsRetour(SUIVI, { track: [] }) === null && RS.faitsRetour(SUIVI, { track: null, departs: null }) === null,
      'S2 un AUTRE n° (un chiffre de différence), aucun fait, « pas su » ⇒ rien');
    dit(RS.retourDuSuivi(SUIVI, [{ tx: TX, suivi: SUIVI, article: 'a' }, { tx: TX2, suivi: SUIVI, article: 'b' }]) === null && RS.retourDuSuivi(SUIVI, null) === null && (RS.retourDuSuivi(' 8123-4567 ', [{ tx: TX, suivi: SUIVI, article: ARTICLE }]) || {}).tx === TX,
      'S3 un n° → UN retour (deux bordereaux au même n° ⇒ personne ; pas su ⇒ personne ; espaces et tirets normalisés)');
    const now = Date.parse('2026-11-15T13:15:00Z');
    const bord = (tx, suivi, iso) => ({ tx, suivi, dateLimite: '16/11/2026 10 h 00', dateLimiteIso: iso, article: ARTICLE, uid: '111', at: '2026-11-08T15:52:00Z', pdf: true });
    let r = RA.retoursAchat({ bords: [bord(TX, SUIVI, '2026-11-16T09:00:00.000Z')], achats: [], remb: [], track: [tr('transit', '2026-11-10T17:52:04Z')], departs: new Map(), maintenant: now });
    let c = r.cartes[0] || {};
    dit(c.etape === 'en-route' && c.faits && c.faits.deposeAt && r.aRenvoyer.length === 0, 'S4 le cas Nike : un fait lu ⇒ la carte avance SEULE (« Déposé le 10 nov. »), plus « à renvoyer » (Ma journée ne la presse plus)', JSON.stringify({ e: c.etape, n: r.aRenvoyer.length }));
    r = RA.retoursAchat({ bords: [bord(TX, SUIVI, '2026-11-16T09:00:00.000Z')], achats: [], remb: [], track: [], departs: new Map(), deposes: { ['r:' + TX]: '2026-11-15T10:00:00Z' }, maintenant: now });
    dit(r.cartes[0].etape === 'depose' && !r.cartes[0].faits, 'S5 aucun fait : « Déposé » reste SON geste (noté par lui)', r.cartes[0].etape);
    r = RA.retoursAchat({ bords: [bord(TX, SUIVI, '2026-11-16T09:00:00.000Z')], achats: [], remb: [], track: null, departs: null, maintenant: now });
    dit(r.cartes[0].etape === 'a-deposer' && r.cartes[0].faitsPasSu === true, 'S5 « pas su » (lectures ratées) ⇒ l’étape ne bouge pas, la carte le dit', JSON.stringify([r.cartes[0].etape, r.cartes[0].faitsPasSu]));
    r = RA.retoursAchat({ bords: [bord(TX, SUIVI, '2026-11-16T09:00:00.000Z'), bord(TX2, SUIVI, '2026-11-23T09:00:00.000Z')], achats: [], remb: [], track: [tr('transit', '2026-11-10T17:52:04Z')], departs: new Map(), maintenant: now });
    dit(r.cartes.length === 2 && r.cartes.every((x) => x.suiviPartage && !x.faits && x.etape === 'a-deposer'), 'S6 deux retours au MÊME n° ⇒ aucun fait rejoint ni l’un ni l’autre, la carte le dit', JSON.stringify(r.cartes.map((x) => [x.tx, x.suiviPartage, x.etape])));
    r = RA.retoursAchat({ bords: [bord(TX, SUIVI, '2026-11-16T09:00:00.000Z'), bord(TX2, SUIVI2, '2026-11-23T09:00:00.000Z')], achats: [], remb: [], track: [tr('transit', '2026-11-10T17:52:04Z')], departs: new Map(), maintenant: now });
    const a = r.cartes.find((x) => x.tx === TX), b = r.cartes.find((x) => x.tx === TX2);
    dit(a && b && a.etape === 'en-route' && b.etape === 'a-deposer' && !b.faits, 'S6 deux retours, deux n° : le fait ne rejoint QUE le sien', JSON.stringify([a && a.etape, b && b.etape]));
  });

  await essaie('R la route', async () => {
    const { fauxInbound, A } = require('./_faux-inbound.cjs');
    const F = fauxInbound(R);
    F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    const { PDFDocument, StandardFonts } = require(path.join(R, 'node_modules', 'pdf-lib'));
    const d = await PDFDocument.create(); const pg = d.addPage([595, 842]);
    pg.drawText('MONDIAL RELAY  Point Relais banc  ' + SUIVI, { x: 40, y: 700, size: 12, font: await d.embedFont(StandardFonts.Helvetica) });
    const PDF = Buffer.from(await d.save()).toString('base64');
    const DE = '"Vinted" <no-reply@vinted.banc.test>';
    const corpsBr = (tx, suivi) => ['*Bonjour banc_acheteur,*', '*Ton bordereau de retour est joint à ce message*', 'Tu as maintenant jusqu’au *16/11/2026 10 h 00 *pour emballer ton colis et retourner la commande au·à la vendeur·se.',
      `*Article :* ${ARTICLE}`, `*Numéro de suivi :* ${suivi} `, "*Date limite d'envoi :* 16/11/2026 10 h 00 ", `*Numéro de transaction :* ${tx} `].join('\n');
    const bordereau = (tx, suivi) => F.recoit({ from: DE, subject: `Bordereau de retour - ${ARTICLE} - à utiliser avant le 16/11/2026 10 h 00`, text: corpsBr(tx, suivi), attachments: [{ filename: `Bon-Retour-Vinted-${tx}.pdf`, contentType: 'application/pdf', contentB64: PDF }] });
    const mr = (suivi, sujet, texte) => F.recoit({ from: '"Mondial Relay" <noreply@mondialrelay.fr>', subject: sujet, text: texte || `Votre colis n° ${suivi} est entre de bonnes mains. Il est en cours d'acheminement.` });
    const cles = () => { const p = F.base.get(`${A}|push_dedup`); return p && Array.isArray(p.keys) ? p.keys : []; };
    await bordereau(TX, SUIVI);
    const l = F.base.get(`${A}|email_bordretour_${TX}`) || {};
    dit(l.suivi === SUIVI && l.transporteurPdf === 'mondialrelay' && l.pdfLu === 'ok', 'R1 le bordereau de retour porte le transporteur LU sur l’étiquette (Mondial Relay)', JSON.stringify({ t: l.transporteurPdf, p: l.pdfLu }));
    let res = await mr(SUIVI, 'Votre colis est entre de bonnes mains 📦');
    const t = F.base.get(`${A}|email_track_mondialrelay_${SUIVI}`) || {};
    dit(res.code === 200 && t.sens === 'sortant' && t.status === 'transit', 'R2 l’e-mail du transporteur du MÊME n° est rangé SORTANT (le colis qu’il renvoie : jamais « à retirer »)', JSON.stringify({ code: res.code, sens: t.sens, st: t.status }));
    dit(cles().includes(`retour-depose-${TX}`), 'R2 « Retour déposé · … » sonne au premier fait', JSON.stringify(cles()));
    await mr(SUIVI, 'Votre colis est entre de bonnes mains 📦');
    dit(cles().filter((k) => k === `retour-depose-${TX}`).length === 1, 'R2 une seule fois (le même fait relu ne resonne pas)');
    await mr(SUIVI, 'Votre colis a été livré', `Votre colis n° ${SUIVI} a été livré. Il a bien été retiré par son destinataire.`);
    dit(cles().includes(`retour-livre-${TX}`), 'R3 « Retour livré au vendeur » sonne à la livraison', JSON.stringify(cles()));
    // Arrivé au point relais du VENDEUR : un e-mail « disponible » (sujet d'un destinataire) — jamais « à retirer » chez lui.
    F.vider(); F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    await bordereau(TX, SUIVI);
    await mr(SUIVI, 'Votre colis est disponible en Point Relais', `Votre colis n° ${SUIVI} est disponible dans votre Point Relais banc, 56000 Vannes. Code de retrait : 123456.`);
    const dispo = F.base.get(`${A}|email_track_mondialrelay_${SUIVI}`) || {};
    dit(dispo.sens === 'sortant' && !cles().some((k) => /^(?:retrait|colis|arrivee|code)/.test(k) && !/^retour-/.test(k)), 'R2 arrivé au relais DU VENDEUR (« disponible ») : rangé sortant par SON bordereau de retour, jamais « à retirer » chez lui', JSON.stringify({ sens: dispo.sens, st: dispo.status, cles: cles() }));
    // Son clic « Déposé » posé AVANT le premier fait : rien ne sonne pour le dépôt.
    F.vider(); F.comptes.length = 0; F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    F.base.set(`${A}|main`, { vrm_retours_deposes: { ['r:' + TX]: '2026-11-15T10:00:00Z' } });
    await bordereau(TX, SUIVI);
    await mr(SUIVI, 'Votre colis est entre de bonnes mains 📦');
    dit(!cles().includes(`retour-depose-${TX}`) && (F.base.get(`${A}|email_track_mondialrelay_${SUIVI}`) || {}).sens === 'sortant', 'R4 il a touché « Déposé » lui-même : le dépôt ne sonne pas (la ligne reste sortante)', JSON.stringify(cles()));
    // Un autre n° : ni sortant par un retour, ni notification de retour.
    F.vider(); F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    await bordereau(TX, SUIVI);
    await mr(SUIVI2, 'Votre colis est entre de bonnes mains 📦');
    dit(!cles().some((k) => /^retour-/.test(k)), 'R5 l’e-mail d’un AUTRE n° (un chiffre d’écart) ne rejoint aucun retour, rien ne sonne', JSON.stringify(cles()));
    // Deux bordereaux au même n° : personne.
    F.vider(); F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    await bordereau(TX, SUIVI); await bordereau(TX2, SUIVI);
    await mr(SUIVI, 'Votre colis est entre de bonnes mains 📦');
    dit(!cles().some((k) => /^retour-/.test(k)), 'R5 deux bordereaux au MÊME n° ⇒ aucun retour désigné, rien ne sonne', JSON.stringify(cles()));
    // Le remboursement.
    F.vider(); F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });
    await F.recoit({ from: DE, subject: `La commande "${ARTICLE}" a été remboursée !`, text: ['Le paiement que tu as fait à banc_vendeur a été annulé.', '*Montant remboursé :* 34,32 €', `*N° de transaction :* ${TX}`].join('\n') });
    dit(cles().includes(`rembourse-${TX}`), 'R6 « Remboursé · 34,32 € » sonne une fois, par SON n° de transaction', JSON.stringify(cles()));
    F.vider(); F.panne((id) => /^email_rembachat_/.test(id));
    res = await F.recoit({ from: DE, subject: `La commande "${ARTICLE}" a été remboursée !`, text: ['Le paiement que tu as fait à banc_vendeur a été annulé.', '*Montant remboursé :* 34,32 €', `*N° de transaction :* ${TX}`].join('\n') });
    F.panne(null);
    dit(res.code === 503 && !cles().includes(`rembourse-${TX}`), 'R6 écriture ratée ⇒ 503 et rien ne sonne', JSON.stringify({ code: res.code }));
  });

  await essaie('D le départ', async () => {
    const D = await importer('api/_lib/depart-colis.js');
    const s = D.sortantsDuVendeur({ bords: [], retours: [{ suivi: 'XW123456789FR', transaction: TX, receivedAt: '2026-11-15T10:00:00Z', transporteurPdf: 'chronopost' }] });
    dit(s.length === 1 && s[0].cle === 'rt:' + TX && s[0].transporteur === 'chronopost', 'D1 le colis d’un retour est un SORTANT (lu comme départ, ligne `depart_`, jamais `transp_`)', JSON.stringify(s));
    const src = fs.readFileSync(path.join(R, 'api/_lib/transporteurs-lecture.js'), 'utf8');
    dit(/email_bordretour_\*&select=suivi:meta->>suivi/.test(src) && /sortantsDuVendeur\(\{ vcVentes, bords, retours \}\)/.test(src), 'D1 le serveur lit les bordereaux de retour en projection et les passe aux départs');
  });

  await essaie('N les textes', async () => {
    const N = await importer('api/_lib/notif-redaction.js');
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      const a = N.rediger({ sorte: 'retourDepose', article: ARTICLE, transporteur: 'Mondial Relay' }, { langue: l });
      const b = N.rediger({ sorte: 'retourLivre', article: ARTICLE }, { langue: l });
      const c = N.rediger({ sorte: 'rembourse', montant: 62, article: ARTICLE }, { langue: l });
      dit(a && b && c && [a, b, c].every((x) => x.title.length <= 40 && x.body.length <= 90 && !N.aUnIdentifiant(x.title + ' ' + x.body)) && /62/.test(c.title), `N1 ${l} : « Retour déposé », « Retour livré au vendeur », « Remboursé · 62 € » (≤ 40, sans identifiant)`, JSON.stringify([a, b, c]));
    }
  });

  console.log(ko ? `\n❌ audit-retours-suivi : ${ko} rouge(s)` : '\n✅ audit-retours-suivi : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
