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
// Style : Apple sobre — fond #F2F2F7, carte blanche, encre #1D1D1F, UN bouton
// bleu #0071E3 de 44 px, police système. Tables et styles en ligne (clients
// mail) ; le bloc <style> ne sert qu'au mode sombre des clients qui le lisent.
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
    sujet: { fr: 'Ton lien de connexion VRM', en: 'Your VRM sign-in link' },
    lien: '{{ .ConfirmationURL }}',
    fr: {
      apercu: 'Connecte-toi à VRM sans mot de passe.',
      titre: 'Ton lien de connexion',
      texte: 'Touche le bouton pour te connecter à VRM, sans mot de passe. Le lien ne marche qu’une fois.',
      bouton: 'Me connecter',
      pied: 'Tu reçois cet e-mail parce qu’un lien de connexion a été demandé pour {{ .Email }}. Si ce n’est pas toi, ignore-le : personne ne peut se connecter sans ce lien.',
    },
    en: {
      apercu: 'Sign in to VRM without a password.',
      titre: 'Your sign-in link',
      texte: 'Tap the button to sign in to VRM, no password needed. The link only works once.',
      bouton: 'Sign me in',
      pied: 'You’re receiving this email because a sign-in link was requested for {{ .Email }}. If this wasn’t you, ignore it: nobody can sign in without this link.',
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
    sujet: { fr: 'Ton code VRM', en: 'Your VRM code' },
    code: '{{ .Token }}',
    fr: {
      apercu: 'Ton code pour confirmer que c’est bien toi.',
      titre: 'Ton code de confirmation',
      texte: 'Saisis ce code dans VRM pour confirmer que c’est bien toi. Il ne marche qu’une fois.',
      pied: 'Tu reçois cet e-mail parce qu’une action protégée a été demandée sur ton compte VRM ({{ .Email }}). Si ce n’est pas toi, ne donne ce code à personne et change ton mot de passe.',
    },
    en: {
      apercu: 'Your code to confirm it’s really you.',
      titre: 'Your confirmation code',
      texte: 'Enter this code in VRM to confirm it’s really you. It only works once.',
      pied: 'You’re receiving this email because a protected action was requested on your VRM account ({{ .Email }}). If this wasn’t you, don’t share this code and change your password.',
    },
  },
];

const POLICE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
const SECOURS = { fr: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :', en: 'Button not working? Copy this link into your browser:' };

const bloc = (m, l) => {
  const t = m[l];
  const action = m.code
    ? `<tr><td style="padding:4px 0 20px"><div class="c-code" style="font-family:${POLICE};font-size:34px;line-height:44px;font-weight:700;letter-spacing:8px;color:#1D1D1F;background:#F2F2F7;border-radius:12px;padding:12px 16px;text-align:center">${m.code}</div></td></tr>`
    : `<tr><td style="padding:4px 0 20px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0071E3" style="background:#0071E3;border-radius:12px"><a class="c-btn" href="${m.lien}" style="display:inline-block;padding:12px 24px;font-family:${POLICE};font-size:17px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px">${t.bouton}</a></td></tr></table></td></tr>`;
  const note = t.note ? `<tr><td class="c-doux" style="padding:0 0 16px;font-family:${POLICE};font-size:14px;line-height:20px;color:#6E6E73">${t.note}</td></tr>` : '';
  const secours = m.code ? '' : `<tr><td class="c-trait" style="padding:16px 0 0;border-top:1px solid #E5E5EA;font-family:${POLICE};font-size:13px;line-height:19px;color:#6E6E73"><span class="c-doux">${SECOURS[l]}</span><br><a class="c-lien" href="${m.lien}" style="color:#0066CC;text-decoration:underline;word-break:break-all">${m.lien}</a></td></tr>`;
  return [
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${t.apercu}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="c-fond" style="background:#F2F2F7"><tr><td align="center" style="padding:32px 16px">`,
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px">`,
    `<tr><td style="padding:0 4px 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle"><img src="https://vrm.center/vrm-logo-v5-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px"></td><td class="c-encre" style="vertical-align:middle;padding-left:10px;font-family:${POLICE};font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#1D1D1F">VRM</td></tr></table></td></tr>`,
    `<tr><td class="c-carte" style="background:#FFFFFF;border-radius:14px;padding:32px 28px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`,
    `<tr><td class="c-encre" style="padding:0 0 12px;font-family:${POLICE};font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px;color:#1D1D1F">${t.titre}</td></tr>`,
    `<tr><td class="c-texte" style="padding:0 0 24px;font-family:${POLICE};font-size:16px;line-height:24px;color:#424245">${t.texte}</td></tr>`,
    action, note, secours,
    `</table></td></tr>`,
    `<tr><td class="c-doux" style="padding:20px 8px 0;font-family:${POLICE};font-size:12px;line-height:18px;color:#86868B">${t.pied}<br><br>VRM · <a href="https://vrm.center" style="color:#86868B;text-decoration:underline">vrm.center</a></td></tr>`,
    `</table></td></tr></table>`,
  ].join('\n');
};

const STYLE = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
@media (prefers-color-scheme:dark){
 .c-fond,body{background:#000000!important}
 .c-carte{background:#1C1C1E!important}
 .c-encre{color:#F5F5F7!important}
 .c-texte{color:#D1D1D6!important}
 .c-doux{color:#98989D!important}
 .c-trait{border-top-color:#3A3A3C!important}
 .c-code{background:#2C2C2E!important;color:#F5F5F7!important}
 .c-lien{color:#409CFF!important}
}
</style>`;

const html = (m) => [
  EN,
  `<!doctype html>`,
  `<html lang="{{ if $en }}en{{ else }}fr{{ end }}">`,
  `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>VRM</title>`,
  STYLE,
  `</head>`,
  `<body class="c-fond" style="margin:0;padding:0;background:#F2F2F7">`,
  `{{ if $en }}`,
  bloc(m, 'en'),
  `{{ else }}`,
  bloc(m, 'fr'),
  `{{ end }}`,
  `</body>`,
  `</html>`,
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
