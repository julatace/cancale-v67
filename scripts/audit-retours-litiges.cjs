#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RETOURS ET LITIGES : BORDEREAUX DE RETOUR, REMBOURSEMENTS, PAS À PAS
//  (11 nov., lot retours-litiges · node scripts/audit-retours-litiges.cjs ·
//   --prouve : chaque mutation doit rendre l'audit ROUGE)
// ════════════════════════════════════════════════════════════════════════════
// Formes MESURÉES dans sa base (lecture seule, 11 nov.) puis INVENTÉES ici (le dépôt
// est public : aucun n° réel). Ce fichier EXÉCUTE la vraie route (§4.10) :
//   E1 « Bordereau de retour » : rangé `email_bordretour_{tx}` (PDF entier, tx de la
//      pièce, suivi, limite heure de Paris), au vendeur de l'ADRESSE DE RÉCEPTION, rien
//      d'autre gardé « inconnu » ; E2 sans PDF / deux n° différents ⇒ gardé « à vérifier »,
//      jamais jeté, aucune ligne de retour ; E3 écriture ratée ⇒ 503 ;
//   E4 « a été remboursée » : `email_rembachat_{tx}` (montant, date estimée), JAMAIS les
//      chiffres de la carte ; illisible ⇒ la famille d'avant ; E5 « Retourne ta commande »
//      (sans n°) reste gardé entier (src/litiges.js le lit) ;
//   A  l'app (src/retoursAchat.js) : achat relié par SON n° jamais par le titre, N° par
//      l'achat, remboursement PROUVÉ par n° sinon « pas encore », trois états ;
//   C  compta : achat remboursé (e-mail, montant entier) sort des coûts ; partiel ⇒ reste ;
//      vente en retour / remboursée dans AUCUN mois du CA déclaré (api/_lib/ventes-regle.js) ;
//   T  le tampon « RETOUR · N°… » (src/tamponRetour.js) sur un vrai PDF ;
//   P  la feuille « Pas à pas » (src/retourPasAPas.js) : délais AVEC leur source, « Paire
//      revenue » seulement avec SON N°, le lien pour contester.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'branche-absente': [['api/email-inbound.js', 'if (estBordereauRetour(subject)) {', 'if (false) {']],
  'tx-du-corps-seul': [['api/_lib/retour-email.js', "  if (deLaPiece && duCorps && deLaPiece !== duCorps) return { ok: false, raison: 'deux n° de transaction différents (pièce et corps)' };\n", '']],
  'sans-pdf-range': [['api/_lib/retour-email.js', "  if (!pdf) return { ok: false, raison: 'aucun PDF de bordereau joint (ou plusieurs)', transaction };\n", "  if (!pdf) return { ok: true, transaction, suivi: '', dateLimite: '', dateLimiteJour: '', dateLimiteIso: '', article: '', pdf: { contentB64: '', filename: '' } };\n"]],
  'jete': [['api/email-inbound.js', "        await garderInconnu(corpsBrut, mail, 'bordereau de retour : ' + lu.raison, '');\n", '']],
  'carte-rangee': [['api/_lib/retour-email.js', '/Remboursement estim[ée][^\\n:]{0,80}:\\s*(\\d{2})\\/(\\d{2})\\/(\\d{4})/i', '/Remboursement estim[ée]([^\\n]{0,80}):\\s*(\\d{2})\\/(\\d{2})\\/(\\d{4})/i']],
  'relie-par-titre': [['src/retoursAchat.js', "    const o = A.get(tx) || null;", "    const o = A.get(tx) || (Array.isArray(achats) ? achats.find((x) => x && str(x.title) === str(b.article)) : null) || null;"]],
  'rembourse-invente': [['src/retoursAchat.js', "    else rembourse = { etat: 'non' };", "    else rembourse = { etat: 'oui', montant: paye, source: 'devine', partiel: false };"]],
  'partiel-sort': [['src/retoursAchat.js', ' || r.montant + 0.005 < paye) return o;', ') return o;']],
  'revenue-sans-numero': [['src/retourPasAPas.js', "  else if (!str(retour.num).trim()) revenue = { possible: false, raison: 'sans-numero' };\n", '']],
  'source-tue': [['src/retourPasAPas.js', ": { quoi: 'repondre', quand: null, source: 'non-ecrite' });", ": { quoi: 'repondre', quand: 'bientôt', source: 'email' });"]],
  'tampon-sans-numero': [['src/retoursAchat.js', "haut: n ? `RETOUR · N°${n}` : 'RETOUR'", "haut: 'RETOUR'"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Formes inventées, fidèles à la forme mesurée (numéros faux) ──
const TX = '99000011122', TX2 = '99000033344', SUIVI = '81234567';
const DE = '"Vinted" <no-reply@vinted.fr>';
const SUJET_BR = 'Bordereau de retour - Nike Dunk banc 42 - à utiliser avant le 18/11/2026 23 h 59';
const CORPS_BR = (tx) => ['Bonjour banc_acheteur,', '', 'Ton bordereau de retour est joint à ce message. Imprime-le et dépose ton colis.', '',
  `*Numéro de suivi :* ${SUIVI}`, '*Date limite d\'envoi :* 18/11/2026 23 h 59', `*Numéro de transaction :* ${tx}`, '*Article :* Nike Dunk banc 42', '',
  'Tu seras remboursé dans les 2 jours qui suivent la réception de la commande par le vendeur, à moins qu\'il ne signale un problème.',
  'Si tu ne l\'envoies pas à temps, la transaction sera conclue et le paiement transféré au vendeur.', '', "L'équipe Vinted"].join('\n');
const SUJET_RB = 'La commande "Adidas Samba banc 40" a été remboursée !';
const CORPS_RB = (tx, montant = '45,90') => ['Bonjour banc_acheteur,', '', 'Le paiement que tu as fait à banc_vendeur a été annulé.', '',
  `*Montant remboursé :* ${montant} €`, `*N° de transaction :* ${tx}`, '*Remboursement estimé sur Carte bancaire •••• 4242 :* 14/11/2026', '', "L'équipe Vinted"].join('\n');

(async () => {
  const { PDFDocument } = require(path.join(R, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create(); doc.addPage([283.46, 425.2]);
  const pdfOctets = await doc.save();
  const PDF_B64 = Buffer.from(pdfOctets).toString('base64');
  const pj = (nom) => ({ filename: nom, contentType: 'application/pdf', contentB64: PDF_B64 });

  await essaie('E la route', async () => {
    const { fauxInbound, A } = require('./_faux-inbound.cjs');
    const F = fauxInbound(R);
    let res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX), attachments: [pj(`Bon-Retour-Vinted-${TX}.pdf`)] });
    const l = F.base.get(`${A}|email_bordretour_${TX}`);
    dit(res.code === 200 && res.corps && res.corps.type === 'bordereau-retour' && !!l, 'E1 « Bordereau de retour » reconnu par le SUJET et rangé `email_bordretour_{tx}`', JSON.stringify(res.corps));
    dit(!!l && l.pdfB64 === PDF_B64 && l.transaction === TX && l.suivi === SUIVI && l.sens === 'achat', 'E1 le PDF ENTIER (plus jamais tronqué), le n° de transaction, le n° de suivi', JSON.stringify(l && { ...l, pdfB64: (l.pdfB64 || '').length }));
    dit(!!l && l.dateLimiteJour === '2026-11-18' && l.dateLimiteIso === '2026-11-18T22:59:00.000Z', 'E1 la date limite LUE, à l’heure de Paris (23 h 59 ⇒ 22:59 UTC en novembre)', l && l.dateLimiteIso);
    dit(F.ids(/^email_inconnu_/).length === 0, 'E1 rien d’autre n’est gardé « aucune règle ne le reconnaît »', F.ids(/^email_inconnu_/).map((x) => x.data.raison).join(','));
    dit(F.ids(/^email_bord_/).length === 0, 'E1 ce n’est PAS un bordereau d’envoi d’une vente (aucune ligne `email_bord_`)');
    dit([...F.base.keys()].filter((k) => k.endsWith('|email_bordretour_' + TX)).every((k) => k.startsWith(A + '|')), 'E1 rangé au vendeur de l’ADRESSE DE RÉCEPTION (propriétaire de la ligne)');
    // E2 — sans PDF, puis deux numéros différents.
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX), attachments: [] });
    const g = F.ids(/^email_inconnu_/).map((x) => x.data);
    dit(res.code === 200 && res.corps && res.corps.garde === true && g.length === 1 && /bordereau de retour/.test(g[0].raison) && F.ids(/^email_bordretour_/).length === 0, 'E2 sans PDF joint : gardé ENTIER « à vérifier » (jamais jeté), aucune ligne de retour', JSON.stringify({ c: res.corps, g: g.map((x) => x.raison) }));
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX2), attachments: [pj(`Bon-Retour-Vinted-${TX}.pdf`)] });
    dit(res.corps && res.corps.garde === true && F.ids(/^email_bordretour_/).length === 0 && F.ids(/^email_inconnu_/).length === 1, 'E2 la pièce et le corps disent deux n° différents : rien n’est rangé sous l’un ou l’autre, gardé « à vérifier »', JSON.stringify(res.corps));
    // E3 — l'écriture rate.
    F.vider(); F.panne((id) => /^email_bordretour_/.test(id));
    res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX), attachments: [pj(`Bon-Retour-Vinted-${TX}.pdf`)] });
    F.panne(null);
    dit(res.code === 503, 'E3 le bordereau de retour n’a pas pu être rangé ⇒ 503 (le collecteur rejoue), jamais 200', JSON.stringify({ code: res.code }));
    // E4 — remboursement d'un achat.
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_RB, text: CORPS_RB(TX) });
    const rb = F.base.get(`${A}|email_rembachat_${TX}`);
    dit(res.code === 200 && !!rb && rb.montant === 45.9 && rb.estime === '2026-11-14' && rb.transaction === TX, 'E4 « a été remboursée » : la PREUVE par SON n° (montant 45,90 €, date estimée)', JSON.stringify({ c: res.corps, rb }));
    dit(!!rb && !/4242/.test(JSON.stringify(rb)) && !/carte|•/i.test(JSON.stringify(rb)), 'E4 les chiffres de la carte ne sont JAMAIS rangés', JSON.stringify(rb));
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_RB, text: 'Le paiement que tu as fait a été annulé. Rien d’autre.' });
    const g4 = F.ids(/^email_inconnu_/).map((x) => x.data);
    dit(F.ids(/^email_rembachat_/).length === 0 && g4.length === 1 && g4[0].famille === "remboursement d'un de tes achats", 'E4 illisible (aucun n°) ⇒ la famille d’avant, gardé, aucune preuve inventée', JSON.stringify(g4.map((x) => [x.type, x.famille])));
    // E5 — « Retourne ta commande » (aucun n° de transaction) : toujours gardé entier pour src/litiges.js.
    F.vider();
    await F.recoit({ from: DE, subject: "Retourne ta commande d'ici le 16 nov. : Nike Dunk banc 42", text: 'banc_vendeur a accepté le retour. Retourne la commande d’ici le 16 nov.' });
    const g5 = F.ids(/^email_inconnu_/).map((x) => x.data);
    dit(g5.length === 1 && g5[0].type === 'inconnu' && F.ids(/^email_bordretour_|^email_rembachat_/).length === 0, 'E5 « Retourne ta commande » : gardé entier, jamais relié à un achat (aucun n°)', JSON.stringify(g5.map((x) => x.type)));
  });

  await essaie('A C P T règles de l’app', async () => {
    const RA = await importer('src/retoursAchat.js');
    const PP = await importer('src/retourPasAPas.js');
    const REG = await importer('src/registres.js');
    const now = Date.parse('2026-11-17T10:00:00Z');
    const achat = (tx, title, eur, status = 'Commande livrée') => ({ transaction_id: tx, title, price: { amount: String(eur), currency_code: 'EUR' }, status, date: '2026-11-01T10:00:00Z' });
    const montantDe = (o) => (o && o.price ? Number(o.price.amount) : null);
    // Deux achats AU MÊME TITRE : seul le n° relie.
    const achats = [achat(TX, 'Nike Dunk banc 42', 45.9), achat(TX2, 'Nike Dunk banc 42', 50)];
    const bord = { tx: TX, suivi: SUIVI, dateLimite: '18/11/2026 23 h 59', dateLimiteIso: '2026-11-18T22:59:00.000Z', article: 'Nike Dunk banc 42', at: '2026-11-08T10:00:00Z', pdf: true };
    const transp = new Map([[SUIVI, { libelle: 'Déposé en point relais' }]]);
    let r = RA.retoursAchat({ bords: [bord], achats, remb: [], transp, numeroDe: (tx) => (tx === TX ? '12' : tx === TX2 ? '77' : ''), montantDe, maintenant: now });
    const c = r.cartes[0] || {};
    dit(r.etat === 'lu' && r.cartes.length === 1 && c.achat === achats[0] && c.num === '12', 'A1 l’achat est relié par SON n° de transaction (deux achats au même titre : le bon, N°12)', JSON.stringify({ n: r.cartes.length, num: c.num }));
    dit(c.rembourse && c.rembourse.etat === 'non' && c.statut.etat === 'ok' && c.statut.libelle === 'Déposé en point relais' && c.presse === true, 'A1 « Pas encore remboursé » (rien de prouvé), suivi lu, date à moins de 48 h ⇒ pressée', JSON.stringify(c.rembourse));
    r = RA.retoursAchat({ bords: [{ ...bord, tx: '99000055566', article: 'Nike Dunk banc 42' }], achats, remb: [], numeroDe: () => '', montantDe, maintenant: now });
    dit(r.cartes[0] && r.cartes[0].achat === null && r.cartes[0].num === '' && r.cartes[0].relie === false, 'A1 un n° sans achat lu : AUCUN achat désigné par le titre, aucun N°', JSON.stringify(r.cartes[0] && { relie: r.cartes[0].relie, num: r.cartes[0].num }));
    r = RA.retoursAchat({ bords: [bord], achats, remb: [{ tx: TX, montant: '45.9', estime: '2026-11-14', at: '2026-11-12T10:00:00Z' }], transp, numeroDe: () => '12', montantDe, maintenant: now });
    dit(r.cartes[0].rembourse.etat === 'oui' && r.cartes[0].rembourse.montant === 45.9 && r.cartes[0].rembourse.partiel === false, 'A2 remboursé PROUVÉ par l’e-mail du même n° (45,90 €)', JSON.stringify(r.cartes[0].rembourse));
    r = RA.retoursAchat({ bords: [bord], achats, remb: [{ tx: TX2, montant: '50', at: '2026-11-12T10:00:00Z' }], numeroDe: () => '12', montantDe, maintenant: now });
    dit(r.cartes[0].rembourse.etat === 'non', 'A2 le remboursement d’un AUTRE n° ne vaut rien ici', JSON.stringify(r.cartes[0].rembourse));
    r = RA.retoursAchat({ bords: [bord], achats, remb: null, transp: null, numeroDe: () => '12', montantDe, maintenant: now });
    dit(r.cartes[0].rembourse.etat === 'passu' && r.cartes[0].statut.etat === 'passu' && r.manques.length === 1, 'A3 e-mails de remboursement pas lus ⇒ « pas lu » (jamais « pas encore »), transporteur pas lu ⇒ « pas lu »', JSON.stringify([r.cartes[0].rembourse, r.cartes[0].statut, r.manques]));
    dit(RA.retoursAchat({ bords: undefined }).etat === 'encours' && RA.retoursAchat({ bords: null }).etat === 'passu', 'A3 trois états : en cours · pas su · lu');
    r = RA.retoursAchat({ bords: [{ ...bord, dateLimiteIso: '' }], achats, remb: [], numeroDe: () => '12', montantDe, maintenant: now });
    dit(r.cartes[0].limiteIso === null && r.cartes[0].limiteTexte === null && r.cartes[0].presse === false, 'A4 pas de date lue ⇒ « Date limite non lue » (jamais une date calculée)');
    // C — compta.
    const remb = RA.remboursementsParTx([{ tx: TX, montant: 45.9, at: 'x' }, { tx: TX2, montant: 20, at: 'x' }]);
    const apres = RA.avecRemboursementsProuves(achats, remb, montantDe);
    dit(REG.achatAnnule(apres[0]) === true && REG.achatAnnule(achats[0]) === false, 'C1 achat remboursé en entier (e-mail, même n°) ⇒ hors des coûts (`achatAnnule`, la règle de « Dépensé » et du registre)', JSON.stringify(apres[0].status));
    dit(REG.achatAnnule(apres[1]) === false && apres[1] === achats[1], 'C1 remboursement PARTIEL (20 € sur 50 €) ⇒ le coût reste, rien ne bouge', JSON.stringify(apres[1].status));
    const regAch = REG.registreDesAchats({ achats: apres, periode: '2026-11' });
    dit(regAch && regAch.lignes.length === 1 && regAch.lignes[0].reference === TX2, 'C1 le registre des achats de novembre ne garde que l’achat non remboursé', JSON.stringify(regAch && regAch.lignes.map((x) => x.reference)));
    const VR = await importer('api/_lib/ventes-regle.js');
    const vente = (status) => ({ transaction_id: '99000077788', title: 'Asics banc', price: { amount: '60', currency_code: 'EUR' }, status, date: '2026-10-20T10:00:00Z' });
    const vers = { '99000077788': '2026-10-28T10:00:00Z' };
    const avant = VR.ventesDeclarables({ vinted: [vente('Commande finalisée')], versements: vers });
    const ret = VR.ventesDeclarables({ vinted: [vente('Remboursement effectué')], versements: vers });
    const ret2 = VR.ventesDeclarables({ vinted: [vente('Retour initié')], versements: vers });
    dit(avant.lignes.length === 1 && avant.lignes[0].ym === '2026-10', 'C2 une vente finalisée compte au mois de son VERSEMENT (octobre)', JSON.stringify(avant.lignes.map((x) => x.ym)));
    dit(ret.lignes.length === 0 && ret.aDater.length === 0 && ret2.lignes.length === 0 && ret2.aDater.length === 0, 'C2 la même vente retournée / remboursée n’est dans AUCUN mois ni « à dater »', JSON.stringify([ret.lignes.length, ret.aDater.length, ret2.lignes.length]));
    // T — le tampon.
    const { tamponnerRetour } = await importer('src/tamponRetour.js');
    const t1 = await tamponnerRetour(pdfOctets, { num: '12', titre: 'Nike Dunk banc 42' });
    const relu = await PDFDocument.load(t1.octets);
    dit(t1.lignes.haut === 'RETOUR · N°12' && relu.getPageCount() === 1 && t1.octets.length > pdfOctets.length, 'T1 « RETOUR · N°12 » posé sur le bordereau (même nombre de pages, PDF relisible)', JSON.stringify(t1.lignes));
    const t2 = await tamponnerRetour(pdfOctets, { num: '', titre: '' });
    dit(t2.lignes.haut === 'RETOUR' && t2.lignes.bas === '', 'T1 sans N° ⇒ « RETOUR » seul (jamais un N° deviné)', JSON.stringify(t2.lignes));
    let leve = false; try { await tamponnerRetour(new Uint8Array([1, 2, 3]), { num: '1' }); } catch (_) { leve = true; }
    dit(leve, 'T2 un PDF illisible LÈVE (l’écran dit « pas imprimé », jamais un bordereau vide)');
    // P — pas à pas.
    const carte = { cle: 'v:1', plateforme: 'vinted', genre: 'retour', tx: '1', num: '12', limiteTexte: null, source: 'commande', geste: { url: 'https://www.vinted.fr/inbox/123' }, preuves: { carton: { etat: 'ok' }, bordereau: { etat: 'aucun' } } };
    let p = PP.pasAPasVente(carte, { retour: { tx: '1', num: '12', etape: 'en-route', recu: false } });
    dit(p.revenue.possible && p.revenue.num === '12' && p.etape === 'recevoir' && p.preuve === 'transaction', 'P1 retour en route, N° par identité ⇒ « Paire revenue · N°12 » (SON N°)', JSON.stringify(p.revenue));
    dit(p.delais[0].quand === null && p.delais[0].source === 'non-ecrite' && p.delais[1] && p.delais[1].jours === 2 && p.delais[1].source === 'regle-vinted', 'P2 chaque délai porte SA source : pas de date lue ⇒ « non écrite » ; 2 jours = la règle écrite par Vinted', JSON.stringify(p.delais));
    dit(p.contester && p.contester.url === 'https://www.vinted.fr/inbox/123' && p.preuves.carton === 'ok', 'P3 « Pas la bonne paire / abîmée » ⇒ la conversation ; la photo du carton est dite');
    p = PP.pasAPasVente(carte, { retour: { tx: '1', num: null, etape: 'en-route' } });
    dit(!p.revenue.possible && p.revenue.raison === 'sans-numero', 'P1 sans N° relié ⇒ pas de « Paire revenue » (jamais un nouveau N°)', JSON.stringify(p.revenue));
    p = PP.pasAPasVente({ ...carte, limiteTexte: '14 nov.', plateforme: 'ebay', source: 'ebay' }, { retour: null });
    dit(p.delais[0].quand === '14 nov.' && p.delais[0].source === 'ebay' && p.delais.length === 1 && p.etape === 'repondre' && p.revenue.raison === 'pas-de-colis', 'P2 eBay : la date donnée par eBay, aucune règle Vinted', JSON.stringify(p.delais));
    p = PP.pasAPasVente(carte, { retour: { tx: '1', num: '12', etape: 'rembourse', recu: true, remis: { num: '12' } } });
    dit(p.etape === 'fait' && !p.revenue.possible && p.revenue.raison === 'deja-remise', 'P1 déjà remise au stock ⇒ rien à refaire');
  });

  await essaie('W l’écran est branché', async () => {
    const app = require('./_source-app.cjs').sourceApp ? require('./_source-app.cjs').sourceApp(R) : fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    dit(/<RetoursAchatBloc r=\{retoursAchatRes\}/.test(app) && /<RetoursAImprimer r=\{retoursAchatRes\}/.test(app), 'W1 Achats → « Retours » et « Tout imprimer » → « Retours » sont rendus');
    dit(/onPasAPas=\{\(c\) => setPapCle\(c\.cle\)\}/.test(app) && /<PasAPasRetour c=\{c\}/.test(app), 'W2 « Pas à pas » est rendu sur l’écran Litiges');
    dit(/id=like\.email_bordretour_\*&select=id,/.test(app) && !/email_bordretour_\*&select=data/.test(app), 'W3 les bordereaux de retour se lisent en PROJECTION (jamais `select=data` : le PDF est lourd)');
  });

  console.log(ko ? `\n❌ audit-retours-litiges : ${ko} rouge(s)` : '\n✅ audit-retours-litiges : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
