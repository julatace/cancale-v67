#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES E-MAILS DE RETOUR D'ACHAT, LEUR RECLASSEMENT ET « À RENVOYER »
//  (15 nov., lot retours · node scripts/audit-retours-emails.cjs ·
//   --prouve : chaque mutation doit rendre l'audit ROUGE)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « j'ai un retour sur shop_cancale, je te laisse regarder pour bien le gérer ».
// Mesuré dans sa base (lecture seule, 15 nov. — formes, aucune donnée ici) :
//   · le bordereau de retour du 8 nov. gardé « aucune règle ne le reconnaît » : la règle
//     (api/_lib/retour-email.js) est arrivée le 11 nov. — son corps gardé porte le PDF
//     (forme « gmail-shared » : pièce `content`, corps à astérisques) ;
//   · les avis « Retourne ta commande d'ici le 16 nov. : <article> » : aucune règle ;
//     aucune identité (ni n° ni conversation).
// Formes INVENTÉES ici, fidèles à la forme mesurée (dépôt public : aucun n° réel).
// Ce fichier EXÉCUTE la vraie route (§4.10) et la vraie route de reclassement :
//   E1 bordereau (titre à points « Pointure 42.5 », pièce `content`) ⇒ `email_bordretour_{tx}`,
//      sens « achat » LU, date limite 16/11 10 h (Paris ⇒ 09:00 UTC), article, PDF entier ;
//   E2 « Retourne ta commande d'ici le 16 nov. : … » ⇒ `email_retourdemande_*` (sens lu,
//      jour 2026-11-16 fin de journée Paris), rejoué ⇒ la MÊME ligne ;
//   E3 un corps qui ne dit pas « tu renvoies » ⇒ gardé « à vérifier », rien de rangé ;
//   E4 un e-mail de colis CONDITIONNEL (« s'il n'est pas retiré… sera retourné ») ne
//      constate aucun retour ;
//   E5 écriture ratée ⇒ 503 ;
//   R  reclassement (api/email-rattacher.js ?mode=reclasser, sa session) : les e-mails
//      gardés « inconnu » reconnus maintenant sont rangés À LEUR DATE D'ORIGINE, la ligne
//      gardée reste ENTIÈRE (marquée), un corps coupé reste tel quel, une newsletter n'est
//      pas touchée, un 2e passage ne fait rien, marque ratée ⇒ 503 puis repris sans doublon ;
//   A  « À renvoyer » (src/retoursAchat.js) : une carte par retour ; l'avis rejoint le
//      bordereau seulement si TOUT concorde et qu'il est seul — deux paires identiques ⇒
//      deux cartes, jamais une cachée ; heure lue « 10 h » ; achat « à renvoyer » sans
//      bordereau ⇒ carte sans PDF avec sa raison ; « Déposé » ; n° de vente ⇒ contredit ;
//   W  l'écran : Ma journée n'a plus de ligne « Retour » d'achat, la carte est en tête.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'avis-non-reconnu': [['api/email-inbound.js', '    if (estDemandeRetourAchat(subject)) {\n      const lu = lireDemandeRetourAchat(', '    if (false) {\n      const lu = lireDemandeRetourAchat(']],
  'sens-suppose': [['api/_lib/retour-email.js', "  if (!sens) return { ok: false, raison: 'le corps ne dit pas que tu renvoies (sens pas prouvé)', transaction };\n", '']],
  'sens-avis-suppose': [['api/_lib/retour-email.js', "  if (!SENS_ACHAT_DEMANDE.test(", "  if (false && !SENS_ACHAT_DEMANDE.test("]],
  'avis-cle-instable': [['api/email-inbound.js', "      const id = idDemandeRetour({ messageId: mail.messageId, subject, from: mail.from, texte: corpsTexte });", "      const id = idDemandeRetour({ messageId: String(Date.now()) + Math.random(), subject, from: mail.from, texte: corpsTexte });"]],
  'reclasse-supprime': [['api/_lib/reclasser-retours.js', "const ok = await ecrire(r.id, { ...data, type: 'reclasse',", "const ok = await ecrire(r.id, { type: 'reclasse',"]],
  'reclasse-date-du-jour': [['api/email-rattacher.js', "__ownerForce: owner, __recuLe: recuLe || null };", "__ownerForce: owner, __recuLe: null };"]],
  'reclasse-sans-prevoir': [['api/_lib/reclasser-retours.js', "    if (!p.ok) { restes.push({ id: r.id, famille: p.famille, raison: p.raison }); continue; }\n", '']],
  'reclasse-marque-ignoree': [['api/_lib/reclasser-retours.js', "    if (!data || data.reclasseVers || data.type !== 'inconnu') continue;", "    if (!data) continue;"], ['api/_lib/reclasser-retours.js', "!!r && !r.reclasse && (", "!!r && ("]],
  'regroupe-ambigu': [['src/retoursAchat.js', "    if (rivaux.length === 1 && autresBords.length === 1) poserAvis(cands[0], d);", "    poserAvis(cands[0], d);"], ['src/retoursAchat.js', "    if (cands.length !== 1) continue;", "    if (!cands.length) continue;"]],
  'heure-inventee': [['src/retoursAchat.js', "heure: limiteIso && /\\d\\s*h/.test(str(b.dateLimite)) ? heureParis(limiteIso) : '',", "heure: limiteIso ? heureParis(limiteIso) : '',"]],
  'achat-sans-carte': [['src/retoursAchat.js', "    if (vus.has(tx) || !ACHAT_A_RENVOYER.test(str(o.status))) continue;", "    if (true) continue;"]],
  'contredit-ignore': [['src/retoursAchat.js', "    if (c.contredit) c.pdf = false;", ""]],
  'journee-ligne-retour': [['src/App.jsx', "!(l.sens === 'achat' && l.genre === 'retour')).slice(0, 8);", "!(l.sens === 'achat' && l.genre === 'retour' && l.source === 'commande')).slice(0, 8);"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 400)); } };
const importer = (p) => import('file://' + path.join(R, p));

const TX = '99000011122', SUIVI = '81234567';
const ARTICLE = 'Baskets banc Air. Blanc et rose. Pointure 42.5';
const DE = '"L\'équipe Vinted" <no-reply_at_vinted_fr_banc@relais.banc.test>';
const SUJET_BR = `Bordereau de retour - ${ARTICLE} - à utiliser avant le 16/11/2026 10 h 00`;
const CORPS_BR = (tx, avecSens = true) => [' E-mail Vinted ', '', '*Bonjour banc_acheteur,*', '', avecSens ? '*Ton bordereau de retour est joint à ce message*' : '*Un document est joint à ce message*', '',
  avecSens ? 'Tu as maintenant jusqu’au *16/11/2026 10 h 00 *pour emballer ton colis et \nretourner la commande au·à la vendeur·se. Le remboursement sera effectué' : 'Voici un document.',
  '', '*Informations d’envoi*', `*Article :* ${ARTICLE}`, '*Dimensions du colis :* Under 2000.0 g ', `*Numéro de suivi :* ${SUIVI} `,
  '*Date limite d\'envoi :* 16/11/2026 10 h 00 ', `*Numéro de transaction :* ${tx} `, '', "L'équipe Vinted"].join('\n');
const SUJET_AV = `Retourne ta commande d'ici le 16 nov. : ${ARTICLE}`;
const CORPS_AV = (avecSens = true) => [' E-mail Vinted ', '<https://links.vinted.com/t/aHR0cHM6Ly93d3cudmludGVkLmZyfGJhbmM=> ',
  `Bonjour banc_acheteur, banc_vendeur a demandé le retour de la commande \n${ARTICLE} et a accepté de prendre \nen charge les frais de port.`,
  avecSens ? 'Retourne la commande d\'ici le \n16 nov.. Sinon, tu devras la garder et ton paiement sera transféré au \nvendeur. ' : 'Merci de ta confiance.'].join('\n');

(async () => {
  const { PDFDocument } = require(path.join(R, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create(); doc.addPage([283.46, 425.2]);
  const PDF_B64 = Buffer.from(await doc.save()).toString('base64');
  // La forme « gmail-shared » mesurée : la pièce porte `content` (pas `contentB64`).
  const pjGmail = (tx) => ({ content: PDF_B64, filename: `Bon-Retour-Vinted-${tx}.pdf`, contentType: 'application/pdf' });

  const { fauxInbound, A } = require('./_faux-inbound.cjs');
  const F = fauxInbound(R);
  F.comptes.push({ vinted_user_id: '111', login: 'banc_acheteur' });

  await essaie('E la route', async () => {
    let res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX), attachments: [pjGmail(TX)], source: 'gmail-shared' });
    const l = F.base.get(`${A}|email_bordretour_${TX}`);
    dit(res.code === 200 && res.corps && res.corps.type === 'bordereau-retour' && !!l, 'E1 « Bordereau de retour - … Pointure 42.5 - … » (forme gmail : pièce `content`) reconnu par le SUJET', JSON.stringify(res.corps));
    dit(!!l && l.sens === 'achat' && l.pdfB64 === PDF_B64 && l.transaction === TX && l.suivi === SUIVI && l.article === ARTICLE, 'E1 sens « achat » LU (« retourner la commande au vendeur »), PDF entier, n° de la pièce, suivi, article', JSON.stringify(l && { ...l, pdfB64: (l.pdfB64 || '').length }));
    dit(!!l && l.dateLimiteIso === '2026-11-16T09:00:00.000Z' && l.dateLimite === '16/11/2026 10 h 00', 'E1 date limite LUE : 16/11 10 h (heure de Paris ⇒ 09:00 UTC)', l && l.dateLimiteIso);
    dit(!!l && l.uid === '111' && l.account === 'banc_acheteur', 'E1 le compte : celui que l’e-mail salue (parmi SES comptes)', JSON.stringify(l && [l.uid, l.account]));
    dit(F.ids(/^email_inconnu_/).length === 0, 'E1 rien n’est gardé « aucune règle ne le reconnaît »');
    // E2 — l'avis.
    F.vider();
    const mid = '<banc-avis-1@banc.test>';
    res = await F.recoit({ from: DE, subject: SUJET_AV, text: CORPS_AV(), messageId: mid });
    const av = F.ids(/^email_retourdemande_/).map((x) => x.data);
    dit(res.code === 200 && res.corps && res.corps.type === 'retour-demande' && av.length === 1, 'E2 « Retourne ta commande d’ici le 16 nov. : … » reconnu par le SUJET et rangé `email_retourdemande_*`', JSON.stringify(res.corps));
    const a = av[0] || {};
    dit(a.sens === 'achat' && a.limiteJour === '2026-11-16' && /^2026-11-16T22:59:59/.test(a.limiteIso) && a.article === ARTICLE && !a.transaction, 'E2 sens « achat » LU (« tu devras la garder… »), date du sujet (jour, fin de journée à Paris), article = libellé, AUCUN n° inventé', JSON.stringify(a));
    dit(F.ids(/^email_inconnu_/).length === 0, 'E2 rien d’autre n’est gardé « inconnu »');
    await F.recoit({ from: DE, subject: SUJET_AV, text: CORPS_AV(), messageId: mid });
    dit(F.ids(/^email_retourdemande_/).length === 1, 'E2 le même e-mail rejoué (même Message-ID) ⇒ la MÊME ligne, jamais deux', String(F.ids(/^email_retourdemande_/).length));
    // E3 — sens pas prouvé.
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_AV, text: CORPS_AV(false) });
    const g3 = F.ids(/^email_inconnu_/).map((x) => x.data);
    dit(F.ids(/^email_retourdemande_/).length === 0 && g3.length === 1 && /sens pas prouvé/.test(g3[0].raison) && res.corps && res.corps.garde === true, 'E3 avis dont le corps ne dit pas « tu renvoies » ⇒ gardé ENTIER « à vérifier », rien de rangé', JSON.stringify(g3.map((x) => x.raison)));
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET_BR, text: CORPS_BR(TX, false), attachments: [pjGmail(TX)] });
    const g3b = F.ids(/^email_inconnu_/).map((x) => x.data);
    dit(F.ids(/^email_bordretour_/).length === 0 && g3b.length === 1 && /sens pas prouvé/.test(g3b[0].raison) && /contentB64|content/.test(g3b[0].brut || ''), 'E3 bordereau dont le corps ne dit pas qui renvoie ⇒ gardé ENTIER (PDF compris), jamais rangé', JSON.stringify(g3b.map((x) => x.raison)));
    // E4 — conditionnel.
    F.vider();
    await F.recoit({ from: '"Mondial Relay" <noreply@mondialrelay.banc.test>', subject: 'Ton colis est disponible en Point Relais', text: 'Ton colis 87650001 est disponible. S’il n’est pas retiré sous 8 jours, il sera retourné à l’expéditeur.' });
    const toutes = [...F.base.values()];
    dit(F.ids(/^email_bordretour_|^email_retourdemande_/).length === 0 && !toutes.some((d) => d && (d.status === 'retour' || d.type === 'retour-demande')), 'E4 « s’il n’est pas retiré… il sera retourné » (conditionnel) ne constate AUCUN retour', JSON.stringify(toutes.map((d) => d && [d.type, d.status])).slice(0, 300));
    // E5 — écriture ratée.
    F.vider(); F.panne((id) => /^email_retourdemande_/.test(id));
    res = await F.recoit({ from: DE, subject: SUJET_AV, text: CORPS_AV() });
    F.panne(null);
    dit(res.code === 503, 'E5 l’avis n’a pas pu être rangé ⇒ 503 (le collecteur rejoue), jamais 200', JSON.stringify({ code: res.code }));
  });

  await essaie('R le reclassement', async () => {
    F.vider();
    await F.charger();
    const f0 = global.fetch;
    global.fetch = async (url, o) => (/\/auth\/v1\/user/.test(String(url)) ? new Response(JSON.stringify({ id: A, email: 'banc@banc.test' }), { status: 200, headers: { 'content-type': 'application/json' } }) : f0(url, o));
    const route = (await importer('api/email-rattacher.js')).default;
    const appeler = async () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {};
      await route({ method: 'POST', query: { mode: 'reclasser' }, headers: { authorization: 'Bearer jeton-banc' }, body: '{}' }, r); return r; };
    // Les lignes gardées comme le serveur les gardait avant (la forme mesurée).
    const corpsBr = { messageId: '<banc-br@banc.test>', from: DE, to: 'boite@banc.test', subject: SUJET_BR, text: CORPS_BR(TX), html: '', source: 'gmail-shared', sourceDate: '2026-11-08T15:51:53.000Z', attachments: [pjGmail(TX)] };
    const corpsAv = { messageId: '<banc-av@banc.test>', from: DE, to: 'boite@banc.test', subject: SUJET_AV, text: CORPS_AV(), html: '', source: 'gmail-shared', attachments: [] };
    const garde = (sujet, corps, recu, brut) => ({ type: 'inconnu', famille: '', raison: 'aucune règle ne le reconnaît', subject: sujet, from: DE, to: 'boite@banc.test', receivedAt: recu, brut: brut != null ? brut : JSON.stringify(corps) });
    F.base.set(`${A}|email_inconnu_br1`, garde(SUJET_BR, corpsBr, '2026-11-08T15:52:33.799Z'));
    F.base.set(`${A}|email_inconnu_av1`, garde(SUJET_AV, corpsAv, '2026-11-07T19:54:33.493Z'));
    F.base.set(`${A}|email_inconnu_news`, garde('Découvre les nouveautés', { subject: 'Découvre les nouveautés' }, '2026-11-09T10:00:00.000Z'));
    const coupe = JSON.stringify({ ...corpsBr, messageId: '<banc-br2@banc.test>', text: CORPS_BR('99000099988') }).slice(0, 900);
    F.base.set(`${A}|email_inconnu_br2`, garde(SUJET_BR, null, '2026-11-09T15:52:33.799Z', coupe));
    // Un bordereau gardé dont le corps ne PROUVE pas le sens : la route le garderait encore ⇒ jamais rejoué.
    const corpsBr3 = { ...corpsBr, messageId: '<banc-br3@banc.test>', text: CORPS_BR('99000044455', false), attachments: [pjGmail('99000044455')] };
    F.base.set(`${A}|email_inconnu_br3`, garde(SUJET_BR, corpsBr3, '2026-11-10T08:00:00.000Z'));
    const avant3 = JSON.stringify(F.base.get(`${A}|email_inconnu_br3`));
    const avant = JSON.stringify(F.base.get(`${A}|email_inconnu_br1`));
    // Une marque qui RATE : le rangé existe, la route dit 503, rien n'est doublé ensuite.
    F.panne((id) => id === 'email_inconnu_av1');
    let r = await appeler();
    F.panne(null);
    dit(r.code === 503 && F.ids(/^email_retourdemande_/).length === 1, 'R marque ratée ⇒ 503 (« pas su »), la ligne rangée existe', JSON.stringify({ code: r.code, c: r.corps }));
    r = await appeler();
    const l = F.base.get(`${A}|email_bordretour_${TX}`);
    const av = F.ids(/^email_retourdemande_/).map((x) => x.data);
    dit(r.code === 200 && !!l && l.pdfB64 === PDF_B64 && l.sens === 'achat' && l.dateLimiteIso === '2026-11-16T09:00:00.000Z', 'R le bordereau gardé depuis le 8 nov. est RANGÉ (PDF du corps gardé, sens lu, 16/11 10 h)', JSON.stringify({ code: r.code, c: r.corps }));
    dit(!!l && l.receivedAt === '2026-11-08T15:52:33.799Z' && av.length === 1 && av[0].receivedAt === '2026-11-07T19:54:33.493Z', 'R à leur date d’ORIGINE (jamais celle du reclassement)', JSON.stringify([l && l.receivedAt, av.map((x) => x.receivedAt)]));
    dit(av.length === 1 && av[0].limiteJour === '2026-11-16', 'R l’avis gardé est rangé une fois (la marque ratée puis reprise n’a rien doublé)', String(av.length));
    const g1 = F.base.get(`${A}|email_inconnu_br1`) || {}, g2 = F.base.get(`${A}|email_inconnu_av1`) || {};
    dit(g1.type === 'reclasse' && g1.reclasseVers === `email_bordretour_${TX}` && g1.brut === JSON.parse(avant).brut && g1.receivedAt === JSON.parse(avant).receivedAt && g2.type === 'reclasse' && /^email_retourdemande_/.test(g2.reclasseVers || ''), 'R rien n’est supprimé : la ligne gardée reste ENTIÈRE (corps, date), marquée « reclassée vers … »', JSON.stringify([g1.type, g1.reclasseVers, g2.type, g2.reclasseVers]));
    const g3 = F.base.get(`${A}|email_inconnu_br2`) || {}, n = F.base.get(`${A}|email_inconnu_news`) || {};
    dit(g3.type === 'inconnu' && g3.brut === coupe && !F.base.get(`${A}|email_bordretour_99000099988`) && (r.corps.restes || []).some((x) => /coupé/.test(x.raison)), 'R un corps gardé COUPÉ n’est jamais rejoué amputé : il reste tel quel, la raison est dite', JSON.stringify(r.corps.restes));
    dit(n.type === 'inconnu' && !n.reclasseVers, 'R un e-mail sans rapport (newsletter) n’est pas touché');
    dit(JSON.stringify(F.base.get(`${A}|email_inconnu_br3`)) === avant3 && F.ids(/^email_inconnu_/).length === 5 && (r.corps.restes || []).some((x) => /sens pas prouvé/.test(x.raison)), 'R un e-mail que la route garderait encore « à vérifier » n’est PAS rejoué (ni réécrit daté du jour, ni doublé) ; sa raison est dite', JSON.stringify({ n: F.ids(/^email_inconnu_/).length, restes: r.corps.restes }));
    const nLignes = F.base.size;
    r = await appeler();
    dit(r.code === 200 && (r.corps.faits || []).length === 0 && F.base.size === nLignes, 'R un 2e passage ne fait RIEN (idempotent)', JSON.stringify({ c: r.corps, avant: nLignes, apres: F.base.size }));
    global.fetch = f0;
  });

  await essaie('A « À renvoyer »', async () => {
    const RA = await importer('src/retoursAchat.js');
    const now = Date.parse('2026-11-15T13:15:00Z');
    const bord = (tx, article, iso, extra = {}) => ({ tx, suivi: '', dateLimite: '16/11/2026 10 h 00', dateLimiteIso: iso, article, uid: '111', account: 'banc_acheteur', at: '2026-11-08T15:52:00Z', pdf: true, ...extra });
    const avis = (id, article, jour, extra = {}) => ({ id, article, limiteJour: jour, limiteIso: `${jour}T22:59:59.000Z`, conv: '', uid: '111', account: 'banc_acheteur', recuLe: '2026-11-07T19:54:00Z', ...extra });
    // Le cas de Julien : deux retours (bordereau + avis chacun).
    let r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z'), bord('99000033344', 'Autry banc', '2026-11-23T09:00:00.000Z', { dateLimite: '23/11/2026 10 h 00' })],
      demandes: [avis('d1', ARTICLE, '2026-11-16'), avis('d2', 'Autry banc', '2026-11-23')], achats: [], remb: [], maintenant: now });
    dit(r.cartes.length === 2 && r.cartes.every((c) => c.source === 'bordereau' && c.avis), 'A1 deux retours (bordereau + avis chacun) ⇒ DEUX cartes, l’avis regroupé avec SON bordereau (tout concorde, seul candidat)', JSON.stringify(r.cartes.map((c) => [c.cle, c.source, c.avis && c.avis.id])));
    const c1 = r.cartes[0] || {};
    dit(c1.tx === TX && c1.presse === true && c1.heure === '10 h' && c1.pdf === true && c1.etape === 'a-deposer' && r.aRenvoyer.length === 2, 'A1 la plus pressée d’abord ; « 10 h » LUE ; < 48 h ⇒ pressée ; bordereau imprimable ; « à déposer »', JSON.stringify(c1));
    const sansHeure = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T22:59:00.000Z', { dateLimite: '16/11/2026' })], achats: [], remb: [], maintenant: now }).cartes[0] || {};
    dit(sansHeure.heure === '', 'A1 une date limite écrite SANS heure ⇒ aucune heure affichée (jamais inventée)', JSON.stringify(sansHeure.heure));
    const q = RA.quandLimite(c1, now);
    dit(q && q.cle === 'demain' && q.heure === '10 h', 'A1 « avant demain 10 h » (le 15 nov. à 14 h 15, Paris)', JSON.stringify(q));
    // Deux paires IDENTIQUES (même titre, même jour, même compte), un seul bordereau : rien n'est regroupé.
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z')], demandes: [avis('d1', ARTICLE, '2026-11-16'), avis('d3', ARTICLE, '2026-11-16', { recuLe: '2026-11-07T20:00:00Z' })], achats: [], remb: [], maintenant: now });
    dit(r.cartes.length === 3 && r.cartes.filter((c) => c.source === 'avis').length === 2 && !r.cartes.some((c) => c.avis && c.source === 'bordereau'), 'A2 deux avis identiques pour un bordereau ⇒ RIEN n’est regroupé (trois cartes, aucune cachée)', JSON.stringify(r.cartes.map((c) => [c.cle, c.source])));
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z'), bord('99000055566', ARTICLE, '2026-11-16T09:00:00.000Z')], demandes: [avis('d1', ARTICLE, '2026-11-16')], achats: [], remb: [], maintenant: now });
    dit(r.cartes.length === 3 && r.cartes.find((c) => c.source === 'avis'), 'A2 deux bordereaux identiques pour un avis ⇒ l’avis reste sa carte (jamais posé sur l’un au hasard)', JSON.stringify(r.cartes.map((c) => [c.cle, c.source])));
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z', { uid: '222' })], demandes: [avis('d1', ARTICLE, '2026-11-16')], achats: [], remb: [], maintenant: now });
    dit(r.cartes.length === 2, 'A2 deux comptes différents ⇒ pas le même retour', String(r.cartes.length));
    // Un avis seul : sans PDF, la raison et le geste ; sans heure inventée.
    r = RA.retoursAchat({ bords: [], demandes: [avis('d2', 'Autry banc', '2026-11-23')], achats: [], remb: [], maintenant: now });
    const ca = r.cartes[0] || {};
    dit(ca.source === 'avis' && ca.pdf === false && ca.sansPdf && ca.sansPdf.raison === 'pas-recu' && ca.heure === '' && /vinted\.fr\/inbox/.test(ca.vinted), 'A3 avis seul ⇒ carte sans PDF : « pas encore arrivé », le geste vers Vinted, AUCUNE heure inventée', JSON.stringify(ca));
    // Un achat « Retour initié » sans bordereau : sa carte, par identité.
    const achat = { transaction_id: '99000077788', title: 'Asics banc', status: 'Retour initié', conversation_id: '5550001', _acc: { vinted_user_id: '111' } };
    r = RA.retoursAchat({ bords: [], demandes: [avis('d4', 'Asics banc', '2026-11-20', { conv: '5550001' })], achats: [achat], remb: [], maintenant: now });
    dit(r.cartes.length === 1 && r.cartes[0].source === 'achat' && r.cartes[0].achat === achat && r.cartes[0].avis && r.cartes[0].limiteJour === '2026-11-20', 'A4 achat « Retour initié » sans bordereau ⇒ SA carte ; l’avis le rejoint par SA conversation (identité) et lui donne sa date', JSON.stringify(r.cartes.map((c) => [c.source, c.avis && c.avis.id, c.limiteJour])));
    // « Déposé » (son clic), le transporteur, le remboursement.
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z', { suivi: SUIVI })], achats: [], remb: [], transp: new Map(), deposes: { ['r:' + TX]: '2026-11-15T14:00:00Z' }, maintenant: now });
    dit(r.cartes[0].etape === 'depose' && r.aRenvoyer.length === 0, 'A5 « Déposé » (SON clic) ⇒ plus « à renvoyer »', r.cartes[0].etape);
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z', { suivi: SUIVI })], achats: [], remb: [], transp: new Map([[SUIVI, { libelle: 'Colis livré au destinataire' }]]), maintenant: now });
    dit(r.cartes[0].etape === 'recu-vendeur', 'A5 le transporteur dit livré ⇒ « reçu par le vendeur »', r.cartes[0].etape);
    // Un n° qui est une de SES ventes : contredit.
    r = RA.retoursAchat({ bords: [bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z')], achats: [], remb: [], ventesTx: new Set([TX]), maintenant: now });
    dit(r.cartes[0].contredit === true && r.cartes[0].pdf === false && r.cartes[0].sansPdf.raison === 'contredit', 'A6 le n° est une de SES ventes ⇒ « vérifie », rien d’imprimé', JSON.stringify(r.cartes[0].sansPdf));
    // Le bordereau encore gardé « inconnu » : relu par LA règle du serveur, PDF compris.
    const RE = await importer('api/_lib/retour-email.js');
    const corps = { subject: SUJET_BR, text: CORPS_BR(TX), attachments: [pjGmail(TX)] };
    const bg = RA.bordereauDuGarde({ id: 'email_inconnu_x', subject: SUJET_BR, brut: JSON.stringify(corps), receivedAt: '2026-11-08T15:52:00Z' }, RE.lireBordereauRetour);
    dit(bg && bg.tx === TX && bg.pdfGarde === PDF_B64 && bg.dateLimiteIso === '2026-11-16T09:00:00.000Z', 'A7 bordereau encore gardé « inconnu » : relu (n°, date, PDF) en attendant son reclassement', JSON.stringify(bg && { ...bg, pdfGarde: (bg.pdfGarde || '').length }));
    r = RA.retoursAchat({ bords: [bg, bord(TX, ARTICLE, '2026-11-16T09:00:00.000Z')], achats: [], remb: [], maintenant: now });
    dit(r.cartes.length === 1 && !r.cartes[0].garde, 'A7 reclassé ET encore gardé : une carte (même n°), la ligne rangée gagne', JSON.stringify(r.cartes.map((c) => [c.cle, c.garde])));
  });

  await essaie('W l’écran', async () => {
    const app = sansCommentaires(require('./_source-app.cjs').sourceApp ? require('./_source-app.cjs').sourceApp(R) : fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    dit(/!\(l\.sens === 'achat' && l\.genre === 'retour'\)\)\.slice\(0, 8\)/.test(app), 'W1 Ma journée : plus AUCUNE ligne « Retour » d’achat dans les litiges (une seule place)');
    dit(!/id:'a-renvoyer'/.test(app), 'W1 Ma journée : plus de ligne « Renvoyer N articles (litige) » à part');
    // (16 nov., intégration vague B) Julien : « Ma journée ne montre que ce qui demande un geste » (c8e526af, refonte-journee) :
    // les retours d'achat y passent par « Retours et litiges », tirés de la MÊME liste classée qu'Achats (`retoursClasses.actifs`).
    dit(/<RetoursAchatBloc r=\{retoursAchatVus\}/.test(app) && /const retoursLitigesJ = [\s\S]{0,900}for \(const c of retoursClasses\.actifs\)/.test(app), 'W2 « À renvoyer » : la même liste dans Ma journée (Retours et litiges) et dans Achats');
    dit(/mode=reclasser/.test(app), 'W3 le reclassement est demandé au serveur à l’ouverture');
  });

  console.log(ko ? `\n❌ audit-retours-emails : ${ko} rouge(s)` : '\n✅ audit-retours-emails : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
