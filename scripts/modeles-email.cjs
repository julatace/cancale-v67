#!/usr/bin/env node
// Modèles des e-mails de compte Supabase (8 nov.) — UNE source pour les six
// modèles : supabase/templates/*.html et supabase/templates/sujets.json sont
// FABRIQUÉS ici, jamais modifiés à la main.
//   node scripts/modeles-email.cjs --ecrire     réécrit les fichiers
//   node scripts/modeles-email.cjs --verifier   échoue si un fichier diffère
//
// Langue : VRM n'a pas de sélecteur de langue (il reste en France). L'app range
// la langue du navigateur dans `user_metadata.langue` ('fr' | 'en',
// src/langueCompte.js) ; Supabase la passe aux modèles sous `.Data`. Français
// par défaut ; anglais seulement si `.Data.langue` vaut exactement "en".
// `printf "%v"` : une langue absente (vieux compte, invitation) rend "<nil>"
// au lieu d'une erreur de comparaison.
//
// Style : « Verre dépoli » (15 nov.) — api/_lib/mail-verre.js, commun à tous les
// e-mails. Tables et styles en ligne (clients mail) ; le bloc <style> ne sert
// qu'au mode sombre et au téléphone des clients qui le lisent.
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'supabase', 'templates');
const EN = '{{- $en := eq (printf "%v" .Data.langue) "en" -}}';
const LIEN_RECUPERATION = 'https://vrm.center/recuperation.html#token_hash={{ .TokenHash }}&amp;type=recovery';

// Ordre de l'écran Supabase (Authentication → Emails → Templates).
const MODELES = [
  {
    id: 'confirmation', onglet: 'Confirm signup', cle: 'confirmation',
    sujet: { fr: 'Confirme ton adresse e-mail VRM', en: 'Confirm your VRM email address' },
    lien: '{{ .ConfirmationURL }}',
    fr: {
      apercu: 'Un geste pour ouvrir ton espace VRM.',
      titre: 'Confirme ton adresse e-mail',
      texte: 'Ton compte VRM est presque prêt. Touche le bouton pour confirmer ton adresse et ouvrir ton espace.',
      bouton: 'Confirmer mon adresse',
      pied: 'Tu reçois cet e-mail parce qu’un compte VRM vient d’être créé avec l’adresse {{ .Email }}. Si ce n’est pas toi, ignore-le : aucun compte ne sera activé.',
    },
    en: {
      apercu: 'One tap to open your VRM workspace.',
      titre: 'Confirm your email address',
      texte: 'Your VRM account is almost ready. Tap the button to confirm your address and open your workspace.',
      bouton: 'Confirm my address',
      pied: 'You’re receiving this email because a VRM account was just created with {{ .Email }}. If this wasn’t you, ignore it: no account will be activated.',
    },
  },
  {
    id: 'invite', onglet: 'Invite user', cle: 'invite',
    sujet: { fr: 'On t’invite sur VRM', en: 'You’re invited to VRM' },
    lien: '{{ .ConfirmationURL }}',
    fr: {
      apercu: 'Accepte l’invitation et choisis ton mot de passe.',
      titre: 'On t’invite sur VRM',
      texte: 'Tu es invité à rejoindre VRM, l’outil qui range tes ventes, tes colis et tes chiffres. Touche le bouton pour accepter.',
      bouton: 'Accepter l’invitation',
      pied: 'Tu reçois cet e-mail parce que quelqu’un t’a invité sur VRM avec l’adresse {{ .Email }}. Si tu ne t’y attendais pas, ignore-le.',
    },
    en: {
      apercu: 'Accept the invitation and choose your password.',
      titre: 'You’re invited to VRM',
      texte: 'You’ve been invited to join VRM, the tool that keeps your sales, parcels and numbers in order. Tap the button to accept.',
      bouton: 'Accept the invitation',
      pied: 'You’re receiving this email because someone invited you to VRM with {{ .Email }}. If you weren’t expecting it, ignore it.',
    },
  },
  {
    id: 'magic_link', onglet: 'Magic Link', cle: 'magic_link',
    // (8 nov.) L'extension 5.330 connecte par CODE reçu par e-mail
    // (signInWithOtp puis verify type email) : le code en grand, ET le bouton.
    sujet: { fr: 'Ton code VRM', en: 'Your VRM code' },
    lien: '{{ .ConfirmationURL }}',
    code: '{{ .Token }}',
    fr: {
      apercu: 'Ton code VRM pour te connecter, valable 1 h.',
      titre: 'Ton code de connexion',
      texte: 'Saisis ce code là où VRM te le demande (l’extension ou l’app) pour te connecter sans mot de passe.',
      legende: 'Ton code VRM — valable 1 h, une seule fois',
      ou: 'Ou touche le bouton pour te connecter sur cet appareil :',
      bouton: 'Me connecter',
      pied: 'Tu reçois cet e-mail parce qu’une connexion a été demandée pour {{ .Email }}. Si ce n’est pas toi, ignore-le et ne donne ce code à personne : personne ne peut se connecter sans lui.',
    },
    en: {
      apercu: 'Your VRM code to sign in, valid for 1 hour.',
      titre: 'Your sign-in code',
      texte: 'Enter this code where VRM asks for it (the extension or the app) to sign in without a password.',
      legende: 'Your VRM code — valid for 1 hour, single use',
      ou: 'Or tap the button to sign in on this device:',
      bouton: 'Sign me in',
      pied: 'You’re receiving this email because a sign-in was requested for {{ .Email }}. If this wasn’t you, ignore it and don’t share this code: nobody can sign in without it.',
    },
  },
  {
    id: 'email_change', onglet: 'Change Email Address', cle: 'email_change',
    sujet: { fr: 'Confirme ta nouvelle adresse VRM', en: 'Confirm your new VRM email address' },
    lien: '{{ .ConfirmationURL }}',
    fr: {
      apercu: 'Confirme le changement d’adresse de ton compte VRM.',
      titre: 'Confirme ta nouvelle adresse',
      texte: 'Tu as demandé à remplacer <b>{{ .Email }}</b> par <b>{{ .NewEmail }}</b> sur ton compte VRM. Touche le bouton pour confirmer.',
      bouton: 'Confirmer la nouvelle adresse',
      pied: 'Tu reçois cet e-mail parce qu’un changement d’adresse a été demandé sur ton compte VRM. Si ce n’est pas toi, ignore-le et change ton mot de passe.',
    },
    en: {
      apercu: 'Confirm the new email address of your VRM account.',
      titre: 'Confirm your new address',
      texte: 'You asked to replace <b>{{ .Email }}</b> with <b>{{ .NewEmail }}</b> on your VRM account. Tap the button to confirm.',
      bouton: 'Confirm the new address',
      pied: 'You’re receiving this email because an address change was requested on your VRM account. If this wasn’t you, ignore it and change your password.',
    },
  },
  {
    id: 'recovery', onglet: 'Reset Password', cle: 'recovery',
    sujet: { fr: 'Choisis un nouveau mot de passe VRM', en: 'Choose a new VRM password' },
    // La forme qui marche : la page vérifie le jeton elle-même (un robot qui
    // « visite » le lien pour l'analyser ne le consomme pas).
    lien: LIEN_RECUPERATION,
    fr: {
      apercu: 'Touche le bouton pour choisir un nouveau mot de passe.',
      titre: 'Choisis un nouveau mot de passe',
      texte: 'Tu as demandé à changer le mot de passe de ton compte VRM. Touche le bouton : une page s’ouvre pour en choisir un nouveau.',
      bouton: 'Changer mon mot de passe',
      note: 'Le lien ne marche qu’une fois. Si tu as demandé plusieurs e-mails, ouvre le plus récent.',
      pied: 'Tu reçois cet e-mail parce qu’un nouveau mot de passe a été demandé pour {{ .Email }}. Si ce n’est pas toi, ignore-le : ton mot de passe ne change pas.',
    },
    en: {
      apercu: 'Tap the button to choose a new password.',
      titre: 'Choose a new password',
      texte: 'You asked to change the password of your VRM account. Tap the button: a page opens where you can choose a new one.',
      bouton: 'Choose a new password',
      note: 'The link only works once. If you asked for several emails, open the most recent one.',
      pied: 'You’re receiving this email because a new password was requested for {{ .Email }}. If this wasn’t you, ignore it: your password stays the same.',
    },
  },
  {
    id: 'reauthentication', onglet: 'Reauthentication', cle: 'reauthentication',
    sujet: { fr: 'Ton code de confirmation VRM', en: 'Your VRM confirmation code' },
    code: '{{ .Token }}',
    fr: {
      legende: 'Ton code VRM — une seule fois',
      apercu: 'Ton code pour confirmer que c’est bien toi.',
      titre: 'Ton code de confirmation',
      texte: 'Saisis ce code dans VRM pour confirmer que c’est bien toi. Il ne marche qu’une fois.',
      pied: 'Tu reçois cet e-mail parce qu’une action protégée a été demandée sur ton compte VRM ({{ .Email }}). Si ce n’est pas toi, ne donne ce code à personne et change ton mot de passe.',
    },
    en: {
      legende: 'Your VRM code — single use',
      apercu: 'Your code to confirm it’s really you.',
      titre: 'Your confirmation code',
      texte: 'Enter this code in VRM to confirm it’s really you. It only works once.',
      pied: 'You’re receiving this email because a protected action was requested on your VRM account ({{ .Email }}). If this wasn’t you, don’t share this code and change your password.',
    },
  },
];

// (15 nov., « Verre dépoli », Julien : « J'aime la 9 » ; « intègre les e-mails ») LA FORME vient
// d'api/_lib/mail-verre.js — la MÊME que les e-mails que VRM envoie (api/_lib/mail-gabarit.js) :
// fond bleu profond (couleur unie #174C88 + dégradé en image de fond), logo hébergé + « VRM » et
// le TITRE en blanc sur le bleu, carte blanche arrondie, code EN GRAND, UN plein d'encre, pied en
// clair. Un document entier par langue (`{{ if $en }}…{{ else }}…{{ end }}`) : le `lang` suit.
const { VERRE, teteVerre, boutonVerre, codeVerre, enveloppeVerre } = require('../api/_lib/mail-verre.js');
const SECOURS = { fr: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :', en: 'Button not working? Copy this link into your browser:' };

const bloc = (m, l) => {
  const t = m[l], P = VERRE.police;
  const ligne = (html, pad = '0 0 20px') => `<tr><td style="padding:${pad}">${html}</td></tr>`;
  const corps = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`,
    ligne(`<p class="vv-encre" style="margin:0;font-family:${P};font-size:16px;line-height:25px;color:${VERRE.encre}">${t.texte}</p>`, '0 0 22px'),
    m.code ? ligne(codeVerre({ codeHtml: m.code, legendeHtml: t.legende }), '0 0 22px') : '',
    m.code && m.lien ? ligne(`<p class="vv-gris" style="margin:0;font-family:${P};font-size:15px;line-height:22px;color:${VERRE.gris}">${t.ou}</p>`, '0 0 6px') : '',
    m.lien ? ligne(boutonVerre({ urlHtml: m.lien, motHtml: t.bouton }), '0') : '',
    t.note ? ligne(`<p class="vv-gris" style="margin:0;font-family:${P};font-size:14px;line-height:21px;color:${VERRE.gris}">${t.note}</p>`, '0 0 16px') : '',
    m.lien ? ligne(`<p class="vv-gris vv-filet" style="margin:0;padding:16px 0 0;border-top:1px solid ${VERRE.filet};font-family:${P};font-size:13px;line-height:19px;color:${VERRE.gris}">${SECOURS[l]}<br><a class="vv-lien" href="${m.lien}" style="color:${VERRE.lien};text-decoration:underline;word-break:break-all">${m.lien}</a></p>`, '0') : '',
    `</table>`,
  ].join('');
  const pied = `<p style="margin:0 0 10px;font-family:${P};font-size:13px;line-height:20px;color:${VERRE.surBleu2}">${t.pied}</p>`
    + `<p style="margin:0;font-family:${P};font-size:13px;line-height:20px;color:${VERRE.surBleu2}">VRM · <a href="https://vrm.center" style="color:${VERRE.surBleu};text-decoration:underline">vrm.center</a></p>`;
  return enveloppeVerre({ lang: l, titreDoc: 'VRM', apercuHtml: t.apercu, teteHtml: teteVerre({ titreHtml: t.titre }), corpsHtml: corps, piedHtml: pied });
};

const html = (m) => [
  EN,
  `{{ if $en }}`,
  bloc(m, 'en'),
  `{{ else }}`,
  bloc(m, 'fr'),
  `{{ end }}`,
  '',
].join('\n');

// Sujet : Supabase passe aussi le sujet au moteur de modèles (Go). Si un jour
// ce n'était plus le cas, `sujetFr` (français seul) se colle à la place.
const sujet = (m) => `${EN}{{ if $en }}${m.sujet.en}{{ else }}${m.sujet.fr}{{ end }}`;

const fichiers = () => {
  const out = {};
  for (const m of MODELES) out[path.join(DOSSIER, `${m.id}.html`)] = html(m);
  out[path.join(DOSSIER, 'sujets.json')] = JSON.stringify(Object.fromEntries(MODELES.map((m) => [m.id, { onglet: m.onglet, sujet: sujet(m), sujetFr: m.sujet.fr, sujetEn: m.sujet.en }])), null, 2) + '\n';
  return out;
};

module.exports = { MODELES, html, sujet, fichiers, DOSSIER, LIEN_RECUPERATION };

if (require.main === module) {
  const f = fichiers();
  if (process.argv.includes('--ecrire')) {
    fs.mkdirSync(DOSSIER, { recursive: true });
    for (const [p, c] of Object.entries(f)) fs.writeFileSync(p, c);
    console.log(`${Object.keys(f).length} fichiers écrits dans supabase/templates/.`);
  } else {
    const diff = Object.entries(f).filter(([p, c]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c).map(([p]) => path.relative(RACINE, p));
    if (diff.length) { console.error('Modèles à refabriquer (node scripts/modeles-email.cjs --ecrire) : ' + diff.join(', ')); process.exit(1); }
    console.log('OK : les 6 modèles et leurs sujets sont ceux de scripts/modeles-email.cjs.');
  }
}
