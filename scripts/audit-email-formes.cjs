#!/usr/bin/env node
// AUDIT : l'app doit savoir LIRE un email entrant, quelle que soit sa forme.
// ⚠️ Posé le 23 août 2026 après un email arrivé à 06:36 avec expéditeur ET
// sujet VIDES, classé « ignoré », dont il ne reste aucune trace — pendant que
// Julien attendait ses codes de retrait Chronopost.
// Aucun rapprochement métier ici : on vérifie seulement qu'on sait ouvrir le
// contenant. Lecture seule, aucun réseau.
const path = require('path');
let ko = 0;
const ok = (t) => console.log('✅ ' + t);
const nok = (t, d) => { ko++; console.log('❌ ' + t + (d ? ' — ' + d : '')); };

(async () => {
const { normaliserEntrant } = await import('file://' + path.resolve(__dirname, '../api/_lib/lire-email.js'));

const SUJET = 'Votre colis Chronopost est arrivé en consigne Pickup';
const DE = 'Chronopost Pickup <chronopost@network1.pickup.fr>';
const TEXTE = 'Identifiant : *8156*\nCode d’ouverture : *9539*\nÀ retirer jusqu’au vendredi 21 août 2026.';
const HTML = '<html><body><p>Pickup Pass</p><img src="https://www.pickup-services.com/api/barcode/DataMatrix?d=FR1971A;09843408317167|81569539" alt=""></body></html>';

const cas = [];
const V = (nom, entree, attendu) => cas.push({ nom, entree, attendu });

// Les 4 formes déjà connues — non-régression.
V('Postmark', { FromFull:{Email:DE}, ToFull:[{Email:'a@b.fr'}], Subject:SUJET, TextBody:TEXTE, HtmlBody:HTML }, {});
V('SendGrid / JSON à plat', { from:DE, to:'a@b.fr', subject:SUJET, text:TEXTE, html:HTML }, {});
V('Mailgun', { sender:DE, recipient:'a@b.fr', subject:SUJET, 'body-plain':TEXTE, 'body-html':HTML }, {});
V('Mailgun (stripped)', { sender:DE, recipient:'a@b.fr', subject:SUJET, 'stripped-text':TEXTE, 'stripped-html':HTML }, {});

// Les formes qui passaient à travers.
const mime = [
  'Delivered-To: vinted35260@icloud.com',
  'From: =?UTF-8?B?' + Buffer.from('Chronopost Pickup').toString('base64') + '?= <chronopost@network1.pickup.fr>',
  'To: a@b.fr',
  'Subject: =?UTF-8?Q?Votre_colis_Chronopost_est_arriv=C3=A9_en_consigne_Pickup?=',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="BB"',
  '',
  '--BB',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Identifiant : *8156*=\n',
  'Code d=E2=80=99ouverture : *9539*',
  '',
  '--BB',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from(HTML).toString('base64'),
  '',
  '--BB--',
  '',
].join('\n');

V('MIME brut (corps = la chaîne)', mime, { qr:true });
V('MIME dans un champ « raw »', { raw: mime }, { qr:true });
V('MIME dans « rawEmail »', { rawEmail: mime }, { qr:true });
V('emballé dans { message: {...} }', { message:{ from:DE, subject:SUJET, text:TEXTE, html:HTML } }, {});
V('emballé dans { data: { email: {...} } }', { data:{ email:{ from:DE, subject:SUJET, text:TEXTE, html:HTML } } }, {});
V('en-têtes en tableau', { headers:[{name:'From',value:DE},{name:'Subject',value:SUJET}], text:TEXTE, html:HTML }, {});
V('en-têtes en objet + envelope', { headers:{From:DE,Subject:SUJET}, envelope:{to:['a@b.fr']}, text:TEXTE, html:HTML }, {});
V('chaîne JSON (corps non parsé)', JSON.stringify({ from:DE, subject:SUJET, text:TEXTE, html:HTML }), {});
V('Buffer JSON', Buffer.from(JSON.stringify({ from:DE, subject:SUJET, text:TEXTE, html:HTML })), {});
V('Buffer MIME', Buffer.from(mime), { qr:true });

for (const c of cas) {
  const r = normaliserEntrant(c.entree);
  const pbs = [];
  if (!/chronopost/i.test(r.from || '')) pbs.push('expéditeur « ' + (r.from || '(vide)') + ' »');
  if (!/consigne Pickup/i.test(r.subject || '')) pbs.push('sujet « ' + (r.subject || '(vide)') + ' »');
  if (!/8156/.test(r.text || '') && !/8156/.test(r.html || '')) pbs.push('identifiant 8156 introuvable');
  if (!/9539/.test(r.text || '') && !/9539/.test(r.html || '')) pbs.push('code 9539 introuvable');
  if (c.attendu.qr && !/barcode\/DataMatrix/i.test(r.html || '')) pbs.push('le Pickup Pass n’est pas dans le HTML');
  pbs.length ? nok(c.nom, pbs.join(' · ')) : ok(c.nom + ' → forme « ' + r.forme + ' »');
}

// Un contenant vraiment vide doit rester vide (et pas inventer).
const v = normaliserEntrant({ inconnu: 42 });
(!v.from && !v.subject && !v.text && !v.html) ? ok('un contenant illisible ne fabrique rien') : nok('un contenant illisible ne fabrique rien');

// ── LES FAMILLES « CONNUES, SANS ACTION » ───────────────────────────────────
// ⚠️ Mesuré le 23 août : 28 emails « non compris » dont 27 étaient des
// évaluations, des newsletters, des « commande mise à jour » et les emails que
// Julien envoie lui-même à Vinted. Un compteur qui crie au loup finit par ne
// plus être regardé (le défaut du panneau Garage, §5.14).
// La règle vit DEUX FOIS (serveur, pour ce qui arrive ; app, pour ce qui est
// déjà en base et ne sera jamais réécrit — §5.37). Elles doivent trancher
// pareil : deux règles qui divergent, c'est deux chiffres qui se contredisent.
{
  const fs2 = require('fs');
  const srvSrc = fs2.readFileSync(path.resolve(__dirname, '../api/email-inbound.js'), 'utf8');
  const appSrc = fs2.readFileSync(path.resolve(__dirname, '../src/App.jsx'), 'utf8');
  const coupe = (src, deb, fin) => { const i = src.indexOf(deb); const j = src.indexOf(fin, i); return i < 0 || j < 0 ? '' : src.slice(i, j + fin.length); };
  const srv = coupe(srvSrc, 'function familleConnue(', "\n}");
  const app = coupe(appSrc, 'const familleEmail = (', "\n};");
  if (!srv || !app) { nok('les deux règles de famille sont trouvables'); }
  else {
    const fSrv = new Function(srv + '\nreturn familleConnue;')();
    const fApp = new Function(app + '\nreturn familleEmail;')();
    // Sujets RÉELS relevés dans la base le 23 août.
    const cas = [
      ["Le membre euroscalco t'a laissé une évaluation", "L'équipe Vinted <no-reply@vinted.fr>", true],
      ['Laisse une évaluation', "L'équipe Vinted <no-reply@vinted.fr>", true],
      ['Commande mise à jour pour nike p-6000 blanc/jaune taille 40', "L'équipe Vinted <no-reply@vinted.fr>", true],
      ['julatace35260 a mis en ligne un nouvel article', "L'équipe Vinted <no-reply@vinted.fr>", true],
      ['Contestation formelle – Demande de réexamen humain', 'vinted@vinted.fr', true],
      ['DEMANDE URGENTE – Je souhaite être mis en relation avec un conseiller', 'vinted@vinted.fr', true],
      ["C'est déjà l'heure de la rentrée ? 😲", 'Vinted <no-reply@team.vinted.com>', true],
      // ⚠️ Ce qui ne doit JAMAIS être rangé en « sans action » :
      ['Votre colis Chronopost est arrivé en consigne Pickup', 'chronopost@network1.pickup.fr', false],
      ['Nouvelle offre pour nike zoom fly 5', "L'équipe Vinted <no-reply@vinted.fr>", false],
      ['Ton article est vendu !', "L'équipe Vinted <no-reply@vinted.fr>", false],
      ["Bordereau d'envoi pour ta commande", "L'équipe Vinted <no-reply@vinted.fr>", false],
      ['La transaction est finalisée', "L'équipe Vinted <no-reply@vinted.fr>", false],
    ];
    let mauvais = 0, divergents = 0;
    for (const [sujet, de, attenduConnu] of cas) {
      const a = fSrv(sujet, de), b = fApp(sujet, de);
      if (a !== b) { divergents++; nok('serveur et app tranchent pareil', `« ${sujet.slice(0, 40)} » → serveur « ${a} » / app « ${b} »`); }
      if (!!a !== attenduConnu) { mauvais++; nok(attenduConnu ? 'famille reconnue' : 'ne doit PAS être « sans action »', `« ${sujet.slice(0, 46)} » → « ${a || '(rien)'} »`); }
    }
    if (!mauvais && !divergents) ok(`familles « connu, sans action » : ${cas.length} sujets réels, serveur et app d'accord`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) LE TITRE D'ARTICLE D'UN REÇU N'EST PAS UN MORCEAU DE PHRASE
//    L'ancienne règle rendait les deux-points FACULTATIFS après « article », donc
//    toute phrase contenant ce mot était capturée. Mesuré sur les 48 reçus réels
//    en base : « est conforme à sa » figure **16 fois** comme titre d'article
//    (extrait de « l'article est conforme à sa description ») et 22 reçus sur 48
//    ont un titre « contenu » dans celui d'un autre. Ce champ sert ensuite à
//    rattacher le reçu à un achat : un titre faux vaut moins que pas de titre.
{
  const SRV = require('fs').readFileSync(path.join(__dirname, '..', 'api', 'email-inbound.js'), 'utf8');
  const m = SRV.match(/const article = \(\(achText[\s\S]*?\)\[1\] \|\| ''\)\.trim\(\);/);
  if (!m) { nok("le titre d'article d'un reçu se lit", 'extraction introuvable dans api/email-inbound.js'); }
  else {
    let lire;
    try { lire = new Function('achText', m[0] + ' return article;'); }
    catch (e) { lire = null; nok("le titre d'article d'un reçu se lit", 'code non exécutable : ' + e.message); }
    if (lire) {
      const cas = [
        ["Ton reçu pour la commande\nMerci ! L'article est conforme à sa description.", '', 'une phrase contenant « article »'],
        ['Ton reçu pour la commande « Nike Air Max 90 taille 42 »', 'Nike Air Max 90 taille 42', 'titre entre guillemets'],
        ['Reçu\nArticle : Adidas Spezial noir 38\nPrix : 22,00 €', 'Adidas Spezial noir 38', 'étiquette suivie de deux-points'],
        ["Merci pour ton achat\nLes articles sont dans leur état d'origine.", '', 'une phrase contenant « articles sont »'],
        ['Reçu\nAchat : Salomon XT-6', 'Salomon XT-6', 'étiquette « Achat : »'],
        ['Ton article te plaît ? Laisse une évaluation', '', 'aucune étiquette : on ne rend rien'],
      ];
      let mauvais = 0;
      for (const [txt, attendu, nom] of cas) {
        let r = ''; try { r = lire(txt); } catch (_) {}
        if (r !== attendu) { mauvais++; nok("titre d'article : " + nom, `rendu ${JSON.stringify(r)}, attendu ${JSON.stringify(attendu)}`); }
      }
      if (!mauvais) ok(`titre d'article d'un reçu : ${cas.length} cas, aucun morceau de phrase capturé`);
    }
  }
}

console.log(ko ? `\n${ko} forme(s) d'email illisibles.` : "\nToutes les formes d'email connues sont lisibles.");
process.exit(ko ? 1 : 0);
})();
