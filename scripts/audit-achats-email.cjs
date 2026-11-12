#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES ACHATS LEBONCOIN, EBAY, VESTIAIRE LUS DANS LES E-MAILS (11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie route `api/email-inbound.js` (§4.10) contre la fausse base
// PostgREST de `scripts/_faux-inbound.cjs`, sur des e-mails INVENTÉS (aucun vrai
// e-mail n'a été vu : mesuré le 11 nov.). Aucune donnée réelle : n°, articles,
// montants, adresses inventés.
//
//   C  confirmation eBay / Leboncoin / Vestiaire d'un expéditeur officiel ⇒ UN achat
//      (site, n° de commande, date, article/port/protection/total séparés, titre, photo) ;
//   D  rejeu (même Message-ID), deuxième e-mail de la même commande ⇒ la même ligne ;
//      une valeur connue n'est jamais remplacée ; le suivi arrive par le n° de commande ;
//   X  annulation / remboursement ⇒ posés sur l'achat ;
//   V  « à vérifier », RIEN créé : sans n°, deux n°, total qui ne colle pas, autre
//      devise, e-mail TRANSFÉRÉ ; l'e-mail est gardé ENTIER ;
//   N  pas un achat : e-mail de vendeur, faux domaine, autre e-mail du site, vente
//      Vestiaire (toujours rangée en vente) ;
//   E  écriture ratée ⇒ 503, aucun achat écrit.
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { fauxInbound } = require(path.join(__dirname, '_faux-inbound.cjs'));
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };

const html = (lignes, img = '') => `<html><body><table>${img}${lignes.map((l) => `<tr><td>${l}</td></tr>`).join('')}</table></body></html>`;
const texte = (lignes) => lignes.join('\n');

(async () => {
  const F = fauxInbound(R);
  const achats = () => F.ids(/^achat_email_(?!verif_)/);
  const verifs = () => F.ids(/^achat_email_verif_/);
  const inconnus = () => F.ids(/^email_inconnu_/);
  const ligne = (id) => F.base.get(`${F.A}|${id}`);

  // ── C : eBay ──
  const ebay1 = ['Merci pour votre achat !', 'Article : Baskets cuir blanc pointure 42', 'N° de commande : 12-34567-89012', 'Prix de l\'article : 45,00 €', 'Livraison : 6,50 €', 'Total : 51,50 €'];
  let r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée : Baskets cuir blanc pointure 42', text: texte(ebay1), html: html(ebay1, '<img src="https://i.ebayimg.com/images/g/AbC/s-l500.jpg"><img src="https://i.ebayimg.com/images/g/AbC/s-l140.jpg"><img src="https://ir.ebaystatic.com/logo.png">'), messageId: '<e1@banc>' });
  const idE = 'achat_email_ebay_123456789012';
  let a = ligne(idE);
  dit(r.code === 200 && r.corps && r.corps.type === 'achat-site', 'C1 eBay : confirmation rangée (200, achat-site)', String(JSON.stringify(r.corps)).slice(0, 200));
  dit(!!a && a.site === 'ebay' && a.commande === '12-34567-89012', 'C2 eBay : identité = n° de commande libellé', String(JSON.stringify(a)).slice(0, 200));
  dit(a && a.prix?.article === 45 && a.prix.port === 6.5 && a.prix.protection === null && a.prix.total === 51.5 && a.prix.source === 'email', 'C3 eBay : article / port / total séparés, protection non lue = null, source e-mail');
  dit(a && a.titre === 'Baskets cuir blanc pointure 42', 'C4 eBay : titre (libellé)');
  dit(a && a.photo === 'https://i.ebayimg.com/images/g/AbC/s-l500.jpg', 'C5 eBay : UNE photo produit (deux tailles = une image, logo écarté)', a && a.photo);
  dit(a && /^\d{4}-\d{2}-\d{2}/.test(a.date), 'C6 eBay : date posée');
  dit(!a || !JSON.stringify(a).includes('Merci pour votre achat'), 'C7 eBay : aucun texte brut dans la ligne d\'achat');

  // ── D : rejeu, puis expédition ──
  const nAvant = achats().length;
  r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée : Baskets cuir blanc pointure 42', text: texte(ebay1), messageId: '<e1@banc>' });
  dit(r.code === 200 && achats().length === nAvant && (ligne(idE)?.emails || []).length === 1, 'D1 rejeu (même Message-ID) : rien de plus', String(JSON.stringify(ligne(idE)?.emails)));
  const ebay2 = ['Bonne nouvelle', 'N° de commande : 12-34567-89012', 'Numéro de suivi : 6A12345678901', 'Total : 51,50 €'];
  r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre objet a été expédié', text: texte(ebay2), messageId: '<e2@banc>' });
  a = ligne(idE);
  dit(r.code === 200 && achats().length === nAvant && a?.suivi === '6A12345678901', 'D2 expédition : même achat, suivi relié par le n° de commande', String(JSON.stringify(a)).slice(0, 300));
  const ebay3 = ['N° de commande : 12-34567-89012', 'Total : 49,00 €'];
  await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre commande est confirmée', text: texte(ebay3), messageId: '<e3@banc>' });
  a = ligne(idE);
  dit(a?.prix?.total === 51.5 && (a?.desaccords || []).includes('prix.total'), 'D3 un total connu n\'est jamais remplacé (désaccord noté)', String(JSON.stringify(a?.prix)));

  // ── X : annulation ──
  await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre commande a été annulée', text: texte(['N° de commande : 12-34567-89012']), messageId: '<e4@banc>' });
  dit(!!ligne(idE)?.annule && achats().length === nAvant, 'X1 annulation lue ⇒ posée sur l\'achat');

  // ── C : Leboncoin ──
  const lbc = ['Votre paiement a bien été accepté.', 'Annonce : Sneakers montantes noires', 'Numéro de commande : LBC9876543', 'Prix de l\'article : 80,00 €', 'Frais de livraison : 4,99 €', 'Protection acheteurs : 4,70 €', 'Total payé : 89,69 €'];
  r = await F.recoit({ from: 'leboncoin <noreply@leboncoin.fr>', subject: 'Confirmation de votre achat', text: texte(lbc), html: html(lbc, '<img src="https://img.leboncoin.fr/api/v1/lbcpb1/images/aa/bb/cc.jpg?rule=ad-thumb">'), messageId: '<l1@banc>' });
  a = ligne('achat_email_leboncoin_lbc9876543');
  dit(!!a && a.prix?.article === 80 && a.prix.port === 4.99 && a.prix.protection === 4.7 && a.prix.total === 89.69, 'C8 Leboncoin : achat, protection acheteurs séparée', JSON.stringify(a && a.prix));
  dit(a && /^https:\/\/img\.leboncoin\.fr\//.test(a.photo), 'C9 Leboncoin : photo du CDN');
  await F.recoit({ from: 'leboncoin <noreply@leboncoin.fr>', subject: 'Vous avez été remboursé', text: texte(['Numéro de commande : LBC9876543', 'Montant remboursé : 89,69 €']), messageId: '<l2@banc>' });
  dit(!!ligne('achat_email_leboncoin_lbc9876543')?.rembourse, 'X2 remboursement lu ⇒ posé');

  // ── C : Vestiaire achat ; N : vente Vestiaire reste une vente ──
  const vc = ['Merci pour votre commande', 'Numéro de commande : 55512345', 'Article : Sac en toile beige', 'Sous-total : 120,00 €', 'Frais de livraison : 9,00 €', 'Frais d\'authentification : 15,00 €', 'Total : 144,00 €'];
  r = await F.recoit({ from: 'Vestiaire Collective <noreply@vestiairecollective.com>', subject: 'Confirmation de votre commande', text: texte(vc), messageId: '<v1@banc>' });
  a = ligne('achat_email_vestiaire_55512345');
  dit(!!a && a.prix?.protection === 15 && a.prix.total === 144, 'C10 Vestiaire : achat (authentification = protection)', String(JSON.stringify(r.corps)).slice(0, 200));
  const nA = achats().length;
  r = await F.recoit({ from: 'Vestiaire Collective <noreply@vestiairecollective.com>', subject: 'Votre article vient d\'être vendu (#40000999)', text: texte(['Vente confirmée 10/11/26', 'Réf : 40000999', 'MARQUE', 'Sac inventé', 'Votre prix de vente : 100,00 €', 'Vous gagnez : 90,00 €']), messageId: '<v2@banc>' });
  dit(r.corps && r.corps.type === 'vente-vestiaire' && achats().length === nA, 'N1 une VENTE Vestiaire reste une vente (jamais un achat)', String(JSON.stringify(r.corps)).slice(0, 160));

  // ── V : à vérifier ──
  const casV = [
    ['V1 sans n° de commande', { from: 'leboncoin <noreply@leboncoin.fr>', subject: 'Confirmation de votre achat', text: texte(['Votre achat : Sneakers', 'Total payé : 50,00 €']) }],
    ['V2 deux n° de commande différents', { from: 'leboncoin <noreply@leboncoin.fr>', subject: 'Confirmation de votre achat', text: texte(['Numéro de commande : LBC1111111', 'Commande n° LBC2222222', 'Total payé : 50,00 €']) }],
    ['V3 total qui ne colle pas', { from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée', text: texte(['N° de commande : 12-00000-11111', 'Prix de l\'article : 40,00 €', 'Livraison : 5,00 €', 'Total : 60,00 €']) }],
    ['V4 autre devise', { from: 'eBay <ebay@ebay.co.uk>', subject: 'Order confirmed', text: texte(['Order number: 12-00000-22222', 'Total : £45.00']) }],
    ['V8 deux totaux différents', { from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée', text: texte(['N° de commande : 12-00000-33333', 'Total : 50,00 €', 'Total payé : 55,00 €']) }],
    ['V5 e-mail TRANSFÉRÉ par lui', { from: 'Moi <moi@banc.test>', subject: 'TR: Confirmation de votre achat', text: texte(['---------- Forwarded message ---------', 'De : leboncoin <noreply@leboncoin.fr>', 'Objet : Confirmation de votre achat', '', 'Numéro de commande : LBC3333333', 'Total payé : 30,00 €']) }],
  ];
  for (const [nom, mail] of casV) {
    const av = achats().length, vv = verifs().length, iv = inconnus().length;
    r = await F.recoit(mail);
    dit(r.code === 200 && r.corps && r.corps.type === 'achat-a-verifier' && achats().length === av && verifs().length === vv + 1 && inconnus().length === iv + 1,
      nom + ' ⇒ à vérifier, rien créé, e-mail gardé', String(JSON.stringify(r.corps)).slice(0, 200));
  }
  const v5 = verifs().map((l) => l.data).find((d) => /transf/.test(d.raison || ''));
  dit(!!v5 && v5.site === 'leboncoin' && v5.lecture?.numeros?.[0] === 'LBC3333333', 'V6 le transfert garde sa LECTURE pour la vérification (site, n°)');
  const gard = inconnus().map((l) => l.data).find((d) => /TR: Confirmation/.test(d.subject));
  dit(!!gard && gard.type === 'inconnu' && /LBC3333333/.test(gard.brut), 'V7 l\'e-mail transféré est gardé ENTIER');

  // ── N : pas un achat ──
  const casN = [
    ['N2 e-mail de vendeur eBay', { from: 'eBay <ebay@ebay.fr>', subject: 'Vous avez vendu votre objet ! Expédiez-le maintenant', text: texte(['N° de commande : 12-99999-00000', 'Total : 80,00 €']) }],
    ['N3 faux domaine', { from: 'leboncoin <noreply@leboncoin-securite.com>', subject: 'Confirmation de votre achat', text: texte(['Numéro de commande : LBC4444444', 'Total payé : 30,00 €']) }],
    ['N4 autre e-mail du site (mise en vente)', { from: 'eBay <ebay@ebay.fr>', subject: 'L\'objet Baskets a été mis en vente', text: 'Votre objet est en ligne.' }],
  ];
  for (const [nom, mail] of casN) {
    const av = achats().length, vv = verifs().length;
    r = await F.recoit(mail);
    dit(r.code === 200 && achats().length === av && verifs().length === vv && !/achat/.test(String(r.corps && r.corps.type)), nom + ' ⇒ aucun achat, chemin d\'avant', String(JSON.stringify(r.corps)).slice(0, 160));
  }

  // ── E : écriture ratée ──
  F.panne((id) => /^achat_email_/.test(id));
  const av = achats().length;
  r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée', text: texte(['N° de commande : 12-55555-66666', 'Total : 20,00 €']), messageId: '<p1@banc>' });
  dit(r.code === 503 && achats().length === av, 'E1 écriture d\'achat ratée ⇒ 503, rien écrit', String(r.code));
  r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Commande confirmée', text: texte(['Total : 20,00 €']), messageId: '<p2@banc>' });
  dit(r.code === 503, 'E2 écriture « à vérifier » ratée ⇒ 503', String(r.code));
  F.panne(null);

  // ── A : côté app (src/achatsAuto.js), sur les lignes que la route vient d'écrire ──
  const { lignesAchatsEmail, fusionAchatsAuto, entreeDepuisEmail, SELECT_ACHATS_EMAIL } = await import('file://' + path.join(R, 'src', 'achatsAuto.js'));
  dit(lignesAchatsEmail(null) === null, 'A1 lecture ratée ⇒ null (pas su), jamais []');
  // La projection réelle : on la sert telle quelle depuis la fausse base.
  const proj = (l) => { const o = { id: l.id }; for (const part of SELECT_ACHATS_EMAIL.split(',').slice(1)) { const [al, ch] = part.split(':'); const k = ch.replace(/^data->>?/, ''); let v = l.data[k]; if (ch.includes('->>') && v != null && typeof v === 'object') v = JSON.stringify(v); o[al] = v === undefined ? null : (ch.includes('->>') && v != null ? String(v) : v); } return o; };
  const lu = lignesAchatsEmail(F.ids(/^achat_email_/).map(proj));
  dit(lu && lu.achats.length === achats().length && lu.aVerifier.length === verifs().length, 'A2 achats et « à vérifier » séparés', lu && `${lu.achats.length}/${lu.aVerifier.length}`);
  const aE = lu.achats.find((x) => x.site === 'ebay');
  const e = entreeDepuisEmail(aE);
  dit(e.price === '51,50' && e.prixSource === 'email' && e.ref === '12-34567-89012' && e.source === 'eBay', 'A3 « Ajouter » : prix lu proposé, marqué lu dans l\'e-mail, ref = n° de commande', JSON.stringify(e));
  const manuel = { id: 'ob_1', title: '', price: '40,00', date: '', source: '', ref: '12 34567 89012' };
  const f = fusionAchatsAuto([manuel], [aE])[0];
  dit(f.manuel === manuel && f.etat === 'annule', 'A4 achat à la main de même n° (espaces) ⇒ relié ; annulé reste dit');
  const aL = lu.achats.find((x) => x.site === 'vestiaire');
  const f2 = fusionAchatsAuto([{ id: 'ob_2', title: '', price: '100,00', date: '', ref: '55512345' }], [aL])[0];
  dit(f2.etat === 'relie' && f2.patch && f2.patch.title === 'Sac en toile beige' && f2.patch.price === undefined, 'A5 « Compléter » : les vides seulement, SON prix gagne', JSON.stringify(f2.patch));
  const jumeaux = Array.from({ length: 50 }, (_, i) => ({ id: 'ob_t' + i, title: aL.titre, price: '144,00', date: aL.date, ref: '' }));
  dit(fusionAchatsAuto(jumeaux, [aL])[0].etat === 'nouveau', 'A6 50 achats au même titre/prix/date sans n° ⇒ aucun relié (jamais par ressemblance)');
  dit(fusionAchatsAuto([], [lu.achats.find((x) => x.site === 'leboncoin')])[0].etat === 'annule', 'A7 remboursé ⇒ hors dépenses, pas d\'« Ajouter »');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
