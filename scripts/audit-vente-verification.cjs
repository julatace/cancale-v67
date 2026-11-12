#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA VENTE « AVEC VÉRIFICATION DE L'ARTICLE » (6 nov., vague 2, point 6)
//  (node scripts/audit-vente-verification.cjs · --prouve : chaque mutation rougit)
// ════════════════════════════════════════════════════════════════════════════
// Mesuré sur sa base (lecture seule) : deux e-mails « Tu as vendu un article sur
// Vinted ! (avec Vérification de l’article) » gardés « reconnu vente, analyse
// impossible » — la forme n'a PAS DE PRIX, l'ancienne règle en exigeait un : ni
// vente, ni notification, ni anti double vente. Et deux ventes à l'état
// « Envoi au centre de vérification ». Ce fichier EXÉCUTE :
//   V1 la VRAIE route (api/email-inbound.js) sur une forme INVENTÉE fidèle (même
//      sujet, même tournure « <pseudo> a acheté <titre> taille <t>. », mêmes
//      paragraphes) : la vente est rangée (`email_sale_*`), sans prix inventé,
//      marquée `verification` ; plus rien n'est « analyse impossible » ;
//   V2 non-régression : une vente ordinaire garde son prix ; une forme sans
//      titre lisible reste GARDÉE entière (« on ne jette aucun e-mail ») ;
//   V3 l'étape « Au centre de vérification » : lue sur l'état de LA transaction
//      (`auCentreDeVerification`), entre Postée et Livrée (`friseVenteFusion`),
//      jamais cochée sans preuve ; une transaction SUSPENDUE n'est pas l'étape ;
//   V4 l'écran Ventes la branche (ligne, récapitulatif, phrase).
// Données INVENTÉES (le dépôt est public).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'prix-exige': [['api/email-inbound.js', "return (data.pseudo && (data.prix || (data.verification && data.designation))) ? data : null;", 'return (data.pseudo && data.prix) ? data : null;']],
  'prix-invente': [['api/email-inbound.js', "  if (!data.verification) delete data.verification;", "  if (!data.verification) delete data.verification; else if (!data.prix) data.prix = '0.00';"]],
  'titre-avale': [['api/email-inbound.js', "a\\s+achet[éeè]\\s+([\\s\\S]{2,200}?)\\.\\s*(?:\\n|Si\\s+l['’]article|$)", "a\\s+achet[éeè]\\s+([\\s\\S]{2,400})\\.\\s*(?:\\n|Si\\s+l['’]article|$)"]],
  'frise-sans-centre': [['src/design/friseFusion.js', 'if (verification === true) {', 'if (false) {']],
  'centre-coche-sans-preuve': [['src/design/friseFusion.js', "fait: apres, preuve: apres ? 'deduite' : null", "fait: true, preuve: 'deduite'"]],
  'statut-large': [['src/verificationArticle.js', 'export const STATUT_CENTRE_VERIFICATION = /envoi\\s+au\\s+centre\\s+de\\s+v[ée]rification/i;', 'export const STATUT_CENTRE_VERIFICATION = /v[ée]rification/i;'], ['src/verificationArticle.js', 'const SUSPENDUE = /suspend/i;', 'const SUSPENDUE = /^$/;']],
  'ligne-sans-etape': [['src/App.jsx', 'friseVenteFusion(preuvesFrise.etapes, { geste: peutDeposer, verification: preuvesFrise.verification })', 'friseVenteFusion(preuvesFrise.etapes, { geste: peutDeposer })']],
  'lue-sans-identite': [['src/App.jsx', 'const verification = !horsParcours && auCentreDeVerification(o);', "const verification = !horsParcours && /v[ée]rification/i.test(String(o.title || ''));"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));

// La forme INVENTÉE, fidèle à celle mesurée (pseudos, titre, liens inventés).
const SUJET = 'Tu as vendu un article sur Vinted ! (avec Vérification de l’article)';
const DE = '"L\'équipe Vinted" <no-reply@vinted.fr>';
const TEXTE = (acheteur, titre) => [
  ' E-mail Vinted ', '<https://links.vinted.com/t/aHR0cHM6Ly93d3cudmludGVkLmZyfGJhbmM=> ', '',
  'Bonjour vendeuse_banc,', '',
  `${acheteur} a acheté ${titre}.`, '',
  "Si l'article est vérifié avec succès, nous transférerons le paiement de ",
  "l'acheteur sur votre porte-monnaie Vinted lorsqu'il aura confirmé que tout ",
  "est en ordre, ou 2 jours après la livraison si nous n'avons pas de ", 'nouvelles de sa part.', '',
  "L’acheteur a également payé les frais de Vérification de l'article, ce qui ",
  "signifie que l'article de cette commande sera vérifié par notre équipe ",
  "d'experts avant d'être envoyé à l'acheteur. Veuillez envoyer la commande à ",
  "notre centre de vérification sous 5 jours. Pour en savoir plus sur ce ",
  "service, veuillez consulter notre Centre d'aide ", '<https://links.vinted.com/t/aHR0cHM6Ly93d3cudmludGVkLmZyL2hlbHA=>', '.', '',
  "Important : cet article doit être envoyé à l'aide du bordereau d'envoi ", 'fourni.', '',
  'Voici la marche à suivre :', '',
  '1. Rendez-vous dans la conversation ', '<https://links.vinted.com/t/aHR0cHM6Ly93d3cudmludGVkLmZyL2luYm94L2JhbmM=> ',
  "avec l'acheteur pour générer le bordereau d'envoi.", "2. Cliquez sur le bouton *Obtenir le bordereau d'envoi.*",
  '3. Suivez les instructions initiales sur Vinted, puis celles du transporteur.', '', "L'équipe Vinted",
].join('\n');

(async () => {
  // ── V1 / V2 : la vraie route ────────────────────────────────────────────────
  await essaie('V1 la route', async () => {
    const { fauxInbound } = require('./_faux-inbound.cjs');
    const F = fauxInbound(R);
    let res = await F.recoit({ from: DE, subject: SUJET, text: TEXTE('acheteur_banc', 'Nike Air Max 1 cactus banc \ntaille 44,5') });
    const ventes = F.ids(/^email_sale_/).map((l) => l.data);
    const gardes = F.ids(/^email_inconnu_/).map((l) => l.data);
    dit(res.code === 200 && res.corps && res.corps.ok === true && res.corps.type === 'vente', 'V1 la route range l’e-mail « avec Vérification de l’article » comme une VENTE (200)', JSON.stringify(res.corps));
    dit(ventes.length === 1, 'V1 une ligne de vente `email_sale_*` est écrite', `${ventes.length} ligne(s)`);
    const v = ventes[0] || {};
    dit(v.pseudo === 'acheteur_banc' && v.designation === 'Nike Air Max 1 cactus banc taille 44,5', 'V1 le pseudo et le titre sont LUS tels que Vinted les écrit (taille comprise, sans le point final)', JSON.stringify({ pseudo: v.pseudo, designation: v.designation }));
    dit(v.prix === '' && v.verification === true, 'V1 aucun prix inventé (l’e-mail n’en donne pas) ; la vente porte `verification`', JSON.stringify({ prix: v.prix, verification: v.verification }));
    dit(!gardes.some((g) => /analyse impossible/.test(g.raison || '')), 'V1 plus rien n’est « reconnu vente, analyse impossible »', JSON.stringify(gardes.map((g) => g.raison)));
    dit(res.corps && res.corps.verification === true, 'V1 la réponse (et donc le journal des e-mails) dit « avec vérification »', JSON.stringify(res.corps));
    const rec = F.ids(/^email_reception_/).map((l) => l.data);
    dit(rec.length === 1 && rec[0].etat === 'integre' && rec[0].type === 'vente' && rec[0].resume && rec[0].resume.vf === 1, 'V1 la ligne de réception dit « vente intégrée, avec vérification »', JSON.stringify(rec.map((r) => ({ etat: r.etat, type: r.type, resume: r.resume }))));
    // V2 — une vente ordinaire garde son prix ; une forme sans titre reste gardée.
    F.vider();
    res = await F.recoit({ from: DE, subject: 'Ton article est vendu !', text: 'Bonjour,\n\nacheteuse_banc a acheté Adidas Samba OG noire taille 40 55,00 €\n\nMerci' });
    const v2 = F.ids(/^email_sale_/).map((l) => l.data)[0] || {};
    dit(res.code === 200 && v2.prix === '55.00' && v2.verification === undefined, 'V2 une vente ordinaire : prix lu, aucune marque « vérification »', JSON.stringify(v2));
    F.vider();
    res = await F.recoit({ from: DE, subject: SUJET, text: 'Bonjour,\n\nVeuillez envoyer la commande à notre centre de vérification sous 5 jours.' });
    const g3 = F.ids(/^email_inconnu_/).map((l) => l.data);
    dit(res.code === 200 && res.corps && res.corps.garde === true && !F.ids(/^email_sale_/).length && g3.length === 1 && /analyse impossible/.test(g3[0].raison), 'V2 une forme SANS pseudo ni titre : aucune vente fabriquée, l’e-mail est GARDÉ', JSON.stringify({ corps: res.corps, gardes: g3.map((g) => g.raison) }));
    // V2 — l'écriture de la vente ratée ⇒ 503 (le collecteur rejoue), jamais 200.
    F.vider(); F.panne((id) => /^email_sale_/.test(id));
    res = await F.recoit({ from: DE, subject: SUJET, text: TEXTE('acheteur_banc', 'Asics Gel banc taille 42') });
    F.panne(null);
    dit(res.code === 503, 'V2 la vente n’a pas pu être écrite ⇒ 503 (le collecteur rejoue), jamais 200', JSON.stringify({ code: res.code, corps: res.corps }));
    const { texteVendu } = await importer('api/_lib/notif-apercus.js');
    const t = texteVendu({ article: 'Nike banc', prix: '', compte: 'vendeuse_banc', verification: true });
    dit(!/€/.test(t.body) && /centre de vérification/.test(t.body), 'V1 la notification ne dit aucun prix et dit le centre de vérification', t.body);
  });

  // ── V3 : l'étape de la frise, lue par identité ──────────────────────────────
  await essaie('V3 frise', async () => {
    const { auCentreDeVerification, STATUT_CENTRE_VERIFICATION } = await importer('src/verificationArticle.js');
    const { friseVenteFusion } = await importer('src/design/friseFusion.js');
    const { friseVente } = await importer('src/recapVente.js');
    // Les états MESURÉS sur sa base (formes, pas de données).
    dit(auCentreDeVerification({ status: 'Envoi au centre de vérification' }) === true, 'V3 « Envoi au centre de vérification » ⇒ l’étape existe');
    dit(auCentreDeVerification({ status: 'Transaction suspendue - en attente de vérification.' }) === false, 'V3 « Transaction suspendue - en attente de vérification. » n’est PAS l’étape (une suspension)');
    dit(['Commande finalisée', "Colis en cours d'acheminement", '', null].every((s) => auCentreDeVerification({ status: s, title: 'Vérification centre' }) === false), 'V3 aucun autre état (ni le TITRE de l’annonce) ne fait l’étape');
    dit(STATUT_CENTRE_VERIFICATION instanceof RegExp, 'V3 la règle est exportée (une seule règle, §11)');
    const p = (o) => friseVente({ vendue: { lu: true, t: Date.now() - 3e8 }, bordereau: { lu: true }, deposee: { lu: !!o.depose }, livree: { lu: !!o.livre }, argent: { lu: !!o.argent } });
    const f1 = friseVenteFusion(p({ depose: true }), { verification: true });
    const cles = f1 ? f1.map((e) => e.cle) : [];
    dit(cles.join(',') === 'vendue,postee,centre,livree,payee', 'V3 avec la vérification : Vendue · Postée · Au centre de vérification · Livrée · Payée', cles.join(','));
    const c1 = f1 && f1.find((e) => e.cle === 'centre');
    dit(c1 && c1.fait === false && c1.cours === true && c1.label === 'Au centre de vérification', 'V3 colis posté, pas livré ⇒ l’étape est EN COURS, jamais cochée sans preuve', JSON.stringify(c1));
    const f2 = friseVenteFusion(p({ depose: true, livre: true }), { verification: true });
    const c2 = f2 && f2.find((e) => e.cle === 'centre');
    dit(c2 && c2.fait === true && c2.preuve === 'deduite', 'V3 livrée ⇒ l’étape est faite, DÉDUITE (la même loi que les autres)', JSON.stringify(c2));
    const f3 = friseVenteFusion(p({ depose: false }), { verification: true });
    const c3 = f3 && f3.find((e) => e.cle === 'centre');
    dit(c3 && !c3.fait && !c3.cours && f3.find((e) => e.cle === 'postee').cours, 'V3 pas encore postée ⇒ l’étape en cours reste « Postée »', JSON.stringify(f3));
    const f4 = friseVenteFusion(p({ depose: true }));
    dit(f4 && f4.length === 4 && !f4.some((e) => e.cle === 'centre'), 'V3 sans l’état lu ⇒ la frise de toujours (4 étapes), rien deviné', JSON.stringify(f4 && f4.map((e) => e.cle)));
  });

  // ── V4 : l'écran Ventes la branche ──────────────────────────────────────────
  await essaie('V4 écran', async () => {
    const APP = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    dit(/const verification = !horsParcours && auCentreDeVerification\(o\);/.test(APP), 'V4 la frise d’une vente lit l’état de SA transaction (`auCentreDeVerification(o)`)');
    dit(/friseVenteFusion\(preuvesFrise\.etapes, \{ geste: peutDeposer, verification: preuvesFrise\.verification \}\)/.test(APP), 'V4 la ligne de la vente porte l’étape');
    // (11 nov.) Depuis le lot BE (10 nov., f58ee6fa) le récapitulatif porte la FRISE PROUVÉE (src/friseProuvee.js) :
    // l'étape « Au centre de vérification » y entre par `verification: … auCentreDeVerification(o)`.
    const recapAvant = /<RecapFrise etapes=\{etapes\} cle=\{txL\} verification=\{preuvesFrise\.verification\}\/>/.test(APP) && /friseVenteFusion\(etapes, \{ verification \}\)/.test(APP);
    const recapProuve = /friseProuvee\(\{ preuves, bifurcation: bif, geste, verification: !bif && auCentreDeVerification\(o\) \}\)/.test(APP) && /<FriseVente frise=\{pre\.frisePv\.frise\}/.test(APP)
      && /if \(verification === true\) liste\.splice\([^\n]*ETAPE_CENTRE\.cle/.test(fs.readFileSync(path.join(R, 'src/friseProuvee.js'), 'utf8'));
    dit(recapAvant || recapProuve, 'V4 le récapitulatif porte l’étape');
    dit(/phraseVente\(\{[^}]*verification: preuvesFrise\.verification \}\)/.test(APP), 'V4 la phrase d’état le dit');
    const FR = fs.readFileSync(path.join(R, 'src/design/Frise.jsx'), 'utf8');
    // (intégration g1) Frise fine (lot ventes-achats-visuel) : le mot court dans la légende, le nom entier lu (vrm-fu-sr).
    dit(/const nom = e\.court \|\| e\.label/.test(FR) && /vrm-fu-sr"[^>]*>\{e\.label\}/.test(FR), 'V4 la frise écrit le mot court sous le trait et garde le nom entier pour la lecture d’écran');
  });

  console.log(ko ? `\n❌ audit-vente-verification : ${ko} rouge(s)` : '\n✅ audit-vente-verification : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
