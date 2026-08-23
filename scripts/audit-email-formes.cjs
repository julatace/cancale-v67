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

console.log(ko ? `\n${ko} forme(s) d'email illisibles.` : "\nToutes les formes d'email connues sont lisibles.");
process.exit(ko ? 1 : 0);
})();
