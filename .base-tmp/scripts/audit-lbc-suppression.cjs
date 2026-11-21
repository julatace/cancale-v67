#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LEBONCOIN « SUPPRESSION DE VOS ANNONCES » (6 nov., vague 2, point 11)
//  (node scripts/audit-lbc-suppression.cjs · --prouve : chaque mutation rougit)
// ════════════════════════════════════════════════════════════════════════════
// Mesuré sur sa base (lecture seule) : 2 e-mails gardés « aucune règle ne le
// reconnaît ». Le corps dit le titre et la date ; le HTML ne porte AUCUNE
// identité d'annonce (aucun lien `/ad/…`, aucun id). Donc (§5) : rien n'est
// retiré, relié ou renuméroté ; l'e-mail est GARDÉ (famille reconnue) et UNE
// notification « Rappels » par jour dit le geste : ouvrir « Mes annonces ».
// Ce fichier EXÉCUTE la vraie route sur une forme INVENTÉE fidèle :
//   L1 rangé (jamais jeté), famille reconnue, même famille côté app ;
//   L2 aucune identité inventée : aucune ligne Leboncoin, aucun N° touché ;
//   L3 la notification : famille « Rappels », UNE par jour (deux e-mails ⇒ une),
//      le geste dit, ouvre Annonces · Leboncoin ;
//   L4 l'écriture de l'e-mail ratée ⇒ 503 (le collecteur rejoue), jamais 200.
// Données INVENTÉES (le dépôt est public).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'branche-absente': [['api/email-inbound.js', 'if (estSuppressionLbc({ subject, from: mail.from, text: corpsTexte })) {', 'if (false) {']],
  'jete': [['api/email-inbound.js', "      await garderInconnu(corpsBrut, mail, 'connu, notifié', FAMILLE_LBC_SUPPRESSION);\n", '']],
  'une-par-email': [['api/email-inbound.js', 'tag: `lbc-suppression-${jourParis()}`', 'tag: `lbc-suppression-${Date.now()}-${Math.random()}`']],
  'famille-messages': [['api/_lib/notif-textes.js', "  lbcsuppression: 'rappels',", "  lbcsuppression: 'messages',"]],
  'titre-englobe': [['api/_lib/lbc-suppression.js', '((?:(?!Votre\\s+annonce)[\\s\\S]){2,200}?)', '([\\s\\S]{2,200}?)']],
  'app-diverge': [['src/App.jsx', "  if (/^Suppression de vos annonces/i.test(s) && /leboncoin/i.test(f + ' ' + s)) return 'annonce Leboncoin supprimée';\n  return '';\n};", "  return '';\n};"]],
  'sans-geste': [['api/_lib/lbc-suppression.js', ' — ouvre « Mes annonces » sur Leboncoin pour que VRM relise la liste.', '.']],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));

const DE = 'leboncoin <no.reply@leboncoin.fr>';
const SUJET = 'Suppression de vos annonces sur leboncoin.fr';
const TEXTE = (titre, date) => [' ', '[image: leboncoin] <https://www.leboncoin.fr> ', '', 'Bonjour ,', '', '*Votre annonce a été supprimée* ', '',
  `Votre annonce ${titre} a bien été supprimée `, `du site leboncoin.fr le ${date}.`, '', titre, '',
  '*Vous avez une autre annonce à déposer ?* ', 'Déposer une nouvelle annonce <https://www.leboncoin.fr/deposer-une-annonce/> ', '',
  'Merci de votre confiance et à très bientôt.', "L'équipe leboncoin", 'www.leboncoin.fr ', 'Accès à nos conditions générales d’utilisation. ', '<https://www.leboncoin.fr/dc/cgu/> '].join('\n');

(async () => {
  await essaie('L1-L4 la route', async () => {
    const { fauxInbound, A } = require('./_faux-inbound.cjs');
    const F = fauxInbound(R);
    // Ses annonces Leboncoin et ses N° : l'e-mail ne doit RIEN y toucher.
    const lbcAvant = { items: { '3100000777': { id: '3100000777', subject: 'Asics Gel banc taille 41', status: 'active', account: 'lbcA' } } };
    F.base.set(`${A}|lbc_listings`, JSON.parse(JSON.stringify(lbcAvant)));
    F.base.set(`${A}|main`, { vinted_annonce_numeros: { 51001: { numero: '12', title: 'Asics Gel banc taille 41' } } });
    let res = await F.recoit({ from: DE, subject: SUJET, text: TEXTE('Asics Gel banc taille 41', '3 Août 2026') });
    const gardes = F.ids(/^email_inconnu_/).map((l) => l.data);
    dit(res.code === 200 && res.corps && res.corps.type === 'action' && res.corps.famille === 'annonce Leboncoin supprimée', 'L1 la route reconnaît l’e-mail (famille « annonce Leboncoin supprimée »)', JSON.stringify(res.corps));
    dit(gardes.length === 1 && gardes[0].type === 'connu-sans-action' && gardes[0].famille === 'annonce Leboncoin supprimée' && /Votre annonce/.test(gardes[0].brut || ''), 'L1 l’e-mail est GARDÉ (jamais jeté), étiqueté par sa famille', JSON.stringify(gardes.map((g) => ({ type: g.type, famille: g.famille, raison: g.raison }))));
    dit(res.corps && res.corps.identite === null, 'L2 la route dit qu’aucune identité n’a été lue (`identite: null`)', JSON.stringify(res.corps));
    const touche = F.ecritures.filter((id) => /^(lbc_|main$|vrm_lbc|vinted_)/.test(id));
    dit(!touche.length && JSON.stringify(F.base.get(`${A}|lbc_listings`)) === JSON.stringify(lbcAvant), 'L2 aucune annonce Leboncoin retirée ni reliée, aucun N° touché (le titre n’est pas une identité)', touche.join(','));
    const j1 = (F.base.get(`${A}|push_journal`) || {}).entrees || [];
    const n1 = j1.filter((e) => e && e.cat === 'lbcsuppression');
    dit(n1.length === 1, 'L3 une notification est rangée (catégorie `lbcsuppression`)', JSON.stringify(j1.map((e) => e && e.cat)));
    const e1 = n1[0] || {};
    dit(e1.famille === 'rappels', 'L3 elle est de la famille « Rappels »', JSON.stringify(e1));
    dit(/Mes annonces/.test(e1.texte || '') && /Asics Gel banc taille 41/.test(e1.texte || '') && /3 Août 2026/.test(e1.texte || ''), 'L3 elle dit ce que l’e-mail dit (titre, date) et LE geste (« Mes annonces »)', e1.texte);
    dit(e1.url === '/?tab=annonces&site=leboncoin', 'L3 elle ouvre Annonces · Leboncoin', e1.url);
    res = await F.recoit({ from: DE, subject: SUJET, text: TEXTE('Nike Dunk banc taille 43', '3 Août 2026') });
    const j2 = ((F.base.get(`${A}|push_journal`) || {}).entrees || []).filter((e) => e && e.cat === 'lbcsuppression');
    dit(res.code === 200 && j2.length === 1 && F.ids(/^email_inconnu_/).length === 2, 'L3 deux e-mails le même jour ⇒ deux e-mails gardés, UNE notification', `${j2.length} notification(s), ${F.ids(/^email_inconnu_/).length} gardé(s)`);
    // L4 — l'écriture de l'e-mail rate.
    F.vider(); F.panne((id) => /^email_inconnu_/.test(id));
    res = await F.recoit({ from: DE, subject: SUJET, text: TEXTE('Salomon XT banc taille 42', '4 Août 2026') });
    F.panne(null);
    dit(res.code === 503, 'L4 l’e-mail n’a pas pu être gardé ⇒ 503 (le collecteur rejoue), jamais 200', JSON.stringify({ code: res.code, corps: res.corps }));
  });

  await essaie('L1 règles pures', async () => {
    const L = await importer('api/_lib/lbc-suppression.js');
    const t = TEXTE('Adidas Spezial banc taille 37,5', '1 Août 2026');
    const lu = L.lireSuppressionLbc({ text: t });
    dit(lu.titre === 'Adidas Spezial banc taille 37,5' && lu.date === '1 Août 2026' && lu.identite === null, 'L1 le titre (jamais « a été supprimée* … ») et la date sont lus tels qu’écrits ; aucune identité', JSON.stringify(lu));
    dit(L.estSuppressionLbc({ subject: SUJET, from: DE, text: t }) && L.estSuppressionLbc({ subject: 'TR: ' + SUJET, from: 'moi@exemple.test', text: t }), 'L1 reconnu direct ET transféré (« TR: »)');
    dit(!L.estSuppressionLbc({ subject: 'Suppression de ton compte', from: '"L\'équipe Vinted" <no-reply@vinted.fr>', text: 'Ton compte' }) && !L.estSuppressionLbc({ subject: 'Votre annonce est en ligne', from: DE, text: 'Votre annonce Nike est en ligne' }), 'L1 rien d’autre n’est pris pour une suppression Leboncoin');
    const T = await importer('api/_lib/notif-textes.js');
    dit(T.familleDe('lbcsuppression') === 'rappels' && T.decisionNotif({ familles: { rappels: false } }, 'lbcsuppression') === false && T.decisionNotif({}, 'lbcsuppression') === true, 'L3 « Rappels » coupé ⇒ elle ne part pas ; par défaut elle part');
    const { DESTINATIONS } = await importer('api/_lib/lien-notif.js');
    dit(typeof DESTINATIONS.lbcAnnonces === 'function' && DESTINATIONS.lbcAnnonces() === '/?tab=annonces&site=leboncoin', 'L3 la destination : Annonces · Leboncoin');
    // L1 — la même famille côté app (les e-mails déjà gardés, §5.37).
    const coupe = (src, deb, fin) => { const i = src.indexOf(deb); const j = src.indexOf(fin, i); return i < 0 || j < 0 ? '' : src.slice(i, j + fin.length); };
    const fApp = new Function(coupe(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'), 'const familleEmail = (', '\n};') + '\nreturn familleEmail;')();
    const fSrv = new Function(coupe(fs.readFileSync(path.join(R, 'api/email-inbound.js'), 'utf8'), 'function familleConnue(', '\n}') + '\nreturn familleConnue;')();
    dit(fApp(SUJET, DE) === 'annonce Leboncoin supprimée' && fSrv(SUJET, DE) === fApp(SUJET, DE), 'L1 serveur et app rangent les e-mails déjà gardés dans la même famille', `${fSrv(SUJET, DE)} / ${fApp(SUJET, DE)}`);
  });

  console.log(ko ? `\n❌ audit-lbc-suppression : ${ko} rouge(s)` : '\n✅ audit-lbc-suppression : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
