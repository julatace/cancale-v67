#!/usr/bin/env node
// Modèles des e-mails de compte Supabase (8 nov.) — UNE source pour les six
// modèles : supabase/templates/*.html et supabase/templates/sujets.json sont
// FABRIQUÉS ici, jamais modifiés à la main.
//   node scripts/modeles-email.cjs --ecrire     réécrit les fichiers
//   node scripts/modeles-email.cjs --verifier   échoue si un fichier diffère
//
// Langue : `user_metadata.langue` (fr, en, es, it, de — Paramètres → Langue,
// src/langueCompte.js) ; Supabase la passe aux modèles sous `.Data`. Français
// par défaut ; une autre langue seulement si `.Data.langue` la vaut exactement.
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

// (17 nov., « Améliore les emails aussi ») LES CINQ LANGUES DE L'APP (src/i18n) : l'espagnol,
// l'italien et l'allemand rejoignent le français et l'anglais. `user_metadata.langue` vaut
// fr · en · es · it · de (src/langueCompte.js, `LANGUES_COMPTE`) ; toute autre valeur ⇒ français.
const AUTRES = {
  confirmation: {
    sujet: { es: 'Confirma tu correo de VRM', it: 'Conferma il tuo indirizzo e-mail VRM', de: 'Bestätige deine VRM-E-Mail-Adresse' },
    es: { apercu: 'Un gesto para abrir tu espacio VRM.', titre: 'Confirma tu correo', texte: 'Tu cuenta VRM está casi lista. Pulsa el botón para confirmar tu dirección y abrir tu espacio.', bouton: 'Confirmar mi dirección', pied: 'Recibes este correo porque se acaba de crear una cuenta VRM con la dirección {{ .Email }}. Si no has sido tú, ignóralo: no se activará ninguna cuenta.' },
    it: { apercu: 'Un gesto per aprire il tuo spazio VRM.', titre: 'Conferma il tuo indirizzo e-mail', texte: 'Il tuo account VRM è quasi pronto. Tocca il pulsante per confermare l’indirizzo e aprire il tuo spazio.', bouton: 'Conferma il mio indirizzo', pied: 'Ricevi questa e-mail perché è appena stato creato un account VRM con l’indirizzo {{ .Email }}. Se non sei stato tu, ignorala: nessun account sarà attivato.' },
    de: { apercu: 'Ein Tipp, um deinen VRM-Bereich zu öffnen.', titre: 'Bestätige deine E-Mail-Adresse', texte: 'Dein VRM-Konto ist fast fertig. Tippe auf den Button, um deine Adresse zu bestätigen und deinen Bereich zu öffnen.', bouton: 'Meine Adresse bestätigen', pied: 'Du erhältst diese E-Mail, weil gerade ein VRM-Konto mit der Adresse {{ .Email }} erstellt wurde. Warst du das nicht, ignoriere sie: Es wird kein Konto aktiviert.' },
  },
  invite: {
    sujet: { es: 'Te invitan a VRM', it: 'Sei invitato su VRM', de: 'Du bist zu VRM eingeladen' },
    es: { apercu: 'Acepta la invitación y elige tu contraseña.', titre: 'Te invitan a VRM', texte: 'Te invitan a unirte a VRM, la herramienta que ordena tus ventas, tus paquetes y tus cifras. Pulsa el botón para aceptar.', bouton: 'Aceptar la invitación', pied: 'Recibes este correo porque alguien te ha invitado a VRM con la dirección {{ .Email }}. Si no lo esperabas, ignóralo.' },
    it: { apercu: 'Accetta l’invito e scegli la tua password.', titre: 'Sei invitato su VRM', texte: 'Sei invitato a unirti a VRM, lo strumento che mette in ordine vendite, pacchi e cifre. Tocca il pulsante per accettare.', bouton: 'Accetta l’invito', pied: 'Ricevi questa e-mail perché qualcuno ti ha invitato su VRM con l’indirizzo {{ .Email }}. Se non te lo aspettavi, ignorala.' },
    de: { apercu: 'Nimm die Einladung an und wähle dein Passwort.', titre: 'Du bist zu VRM eingeladen', texte: 'Du bist eingeladen, VRM beizutreten, dem Tool, das deine Verkäufe, Pakete und Zahlen ordnet. Tippe auf den Button, um anzunehmen.', bouton: 'Einladung annehmen', pied: 'Du erhältst diese E-Mail, weil dich jemand mit der Adresse {{ .Email }} zu VRM eingeladen hat. Hast du das nicht erwartet, ignoriere sie.' },
  },
  magic_link: {
    sujet: { es: 'Tu código de VRM', it: 'Il tuo codice VRM', de: 'Dein VRM-Code' },
    es: { apercu: 'Tu código de VRM para iniciar sesión, válido 1 h.', titre: 'Tu código de acceso', texte: 'Escribe este código donde VRM te lo pida (la extensión o la app) para iniciar sesión sin contraseña.', legende: 'Tu código de VRM — válido 1 h, un solo uso', ou: 'O pulsa el botón para iniciar sesión en este dispositivo:', bouton: 'Iniciar sesión', pied: 'Recibes este correo porque se ha pedido un inicio de sesión para {{ .Email }}. Si no has sido tú, ignóralo y no des este código a nadie: nadie puede entrar sin él.' },
    it: { apercu: 'Il tuo codice VRM per accedere, valido 1 ora.', titre: 'Il tuo codice di accesso', texte: 'Inserisci questo codice dove VRM te lo chiede (l’estensione o l’app) per accedere senza password.', legende: 'Il tuo codice VRM — valido 1 ora, una sola volta', ou: 'Oppure tocca il pulsante per accedere su questo dispositivo:', bouton: 'Accedi', pied: 'Ricevi questa e-mail perché è stato chiesto un accesso per {{ .Email }}. Se non sei stato tu, ignorala e non dare questo codice a nessuno: nessuno può accedere senza.' },
    de: { apercu: 'Dein VRM-Code zum Anmelden, 1 Stunde gültig.', titre: 'Dein Anmeldecode', texte: 'Gib diesen Code dort ein, wo VRM danach fragt (Erweiterung oder App), um dich ohne Passwort anzumelden.', legende: 'Dein VRM-Code — 1 Stunde gültig, nur einmal', ou: 'Oder tippe auf den Button, um dich auf diesem Gerät anzumelden:', bouton: 'Anmelden', pied: 'Du erhältst diese E-Mail, weil eine Anmeldung für {{ .Email }} angefordert wurde. Warst du das nicht, ignoriere sie und gib diesen Code an niemanden weiter: Ohne ihn kann sich niemand anmelden.' },
  },
  email_change: {
    sujet: { es: 'Confirma tu nueva dirección de VRM', it: 'Conferma il tuo nuovo indirizzo VRM', de: 'Bestätige deine neue VRM-Adresse' },
    es: { apercu: 'Confirma el cambio de dirección de tu cuenta VRM.', titre: 'Confirma tu nueva dirección', texte: 'Has pedido sustituir <b>{{ .Email }}</b> por <b>{{ .NewEmail }}</b> en tu cuenta VRM. Pulsa el botón para confirmar.', bouton: 'Confirmar la nueva dirección', pied: 'Recibes este correo porque se ha pedido un cambio de dirección en tu cuenta VRM. Si no has sido tú, ignóralo y cambia tu contraseña.' },
    it: { apercu: 'Conferma il cambio di indirizzo del tuo account VRM.', titre: 'Conferma il tuo nuovo indirizzo', texte: 'Hai chiesto di sostituire <b>{{ .Email }}</b> con <b>{{ .NewEmail }}</b> sul tuo account VRM. Tocca il pulsante per confermare.', bouton: 'Conferma il nuovo indirizzo', pied: 'Ricevi questa e-mail perché è stato chiesto un cambio di indirizzo sul tuo account VRM. Se non sei stato tu, ignorala e cambia la password.' },
    de: { apercu: 'Bestätige die Adressänderung deines VRM-Kontos.', titre: 'Bestätige deine neue Adresse', texte: 'Du möchtest <b>{{ .Email }}</b> in deinem VRM-Konto durch <b>{{ .NewEmail }}</b> ersetzen. Tippe auf den Button, um zu bestätigen.', bouton: 'Neue Adresse bestätigen', pied: 'Du erhältst diese E-Mail, weil in deinem VRM-Konto eine Adressänderung angefordert wurde. Warst du das nicht, ignoriere sie und ändere dein Passwort.' },
  },
  recovery: {
    sujet: { es: 'Elige una nueva contraseña de VRM', it: 'Scegli una nuova password VRM', de: 'Wähle ein neues VRM-Passwort' },
    es: { apercu: 'Pulsa el botón para elegir una nueva contraseña.', titre: 'Elige una nueva contraseña', texte: 'Has pedido cambiar la contraseña de tu cuenta VRM. Pulsa el botón: se abre una página para elegir una nueva.', bouton: 'Cambiar mi contraseña', note: 'El enlace solo funciona una vez. Si pediste varios correos, abre el más reciente.', pied: 'Recibes este correo porque se ha pedido una nueva contraseña para {{ .Email }}. Si no has sido tú, ignóralo: tu contraseña no cambia.' },
    it: { apercu: 'Tocca il pulsante per scegliere una nuova password.', titre: 'Scegli una nuova password', texte: 'Hai chiesto di cambiare la password del tuo account VRM. Tocca il pulsante: si apre una pagina per sceglierne una nuova.', bouton: 'Cambia la mia password', note: 'Il link funziona una sola volta. Se hai chiesto più e-mail, apri la più recente.', pied: 'Ricevi questa e-mail perché è stata chiesta una nuova password per {{ .Email }}. Se non sei stato tu, ignorala: la tua password non cambia.' },
    de: { apercu: 'Tippe auf den Button, um ein neues Passwort zu wählen.', titre: 'Wähle ein neues Passwort', texte: 'Du möchtest das Passwort deines VRM-Kontos ändern. Tippe auf den Button: Eine Seite öffnet sich, auf der du ein neues wählst.', bouton: 'Mein Passwort ändern', note: 'Der Link funktioniert nur einmal. Hast du mehrere E-Mails angefordert, öffne die neueste.', pied: 'Du erhältst diese E-Mail, weil für {{ .Email }} ein neues Passwort angefordert wurde. Warst du das nicht, ignoriere sie: Dein Passwort bleibt gleich.' },
  },
  reauthentication: {
    sujet: { es: 'Tu código de confirmación de VRM', it: 'Il tuo codice di conferma VRM', de: 'Dein VRM-Bestätigungscode' },
    es: { legende: 'Tu código de VRM — un solo uso', apercu: 'Tu código para confirmar que eres tú.', titre: 'Tu código de confirmación', texte: 'Escribe este código en VRM para confirmar que eres tú. Solo funciona una vez.', pied: 'Recibes este correo porque se ha pedido una acción protegida en tu cuenta VRM ({{ .Email }}). Si no has sido tú, no des este código a nadie y cambia tu contraseña.' },
    it: { legende: 'Il tuo codice VRM — una sola volta', apercu: 'Il tuo codice per confermare che sei proprio tu.', titre: 'Il tuo codice di conferma', texte: 'Inserisci questo codice in VRM per confermare che sei proprio tu. Funziona una sola volta.', pied: 'Ricevi questa e-mail perché è stata chiesta un’azione protetta sul tuo account VRM ({{ .Email }}). Se non sei stato tu, non dare questo codice a nessuno e cambia la password.' },
    de: { legende: 'Dein VRM-Code — nur einmal', apercu: 'Dein Code, um zu bestätigen, dass du es bist.', titre: 'Dein Bestätigungscode', texte: 'Gib diesen Code in VRM ein, um zu bestätigen, dass du es bist. Er funktioniert nur einmal.', pied: 'Du erhältst diese E-Mail, weil in deinem VRM-Konto ({{ .Email }}) eine geschützte Aktion angefordert wurde. Warst du das nicht, gib diesen Code an niemanden weiter und ändere dein Passwort.' },
  },
};
for (const m of MODELES) { const a = AUTRES[m.id]; Object.assign(m.sujet, a.sujet); m.es = a.es; m.it = a.it; m.de = a.de; }
// Les langues, dans l'ordre des blocs du modèle ; le français est le bloc `else` (défaut).
const LANGUES = ['en', 'es', 'it', 'de', 'fr'];
const TETE = '{{- $l := printf "%v" .Data.langue -}}';

// (15 nov., « Verre dépoli », Julien : « J'aime la 9 » ; « intègre les e-mails ») LA FORME vient
// d'api/_lib/mail-verre.js — la MÊME que les e-mails que VRM envoie (api/_lib/mail-gabarit.js) :
// fond gris clair (couleur unie #DFE1E5 + dégradé en image de fond), logo hébergé + « VRM » et
// le TITRE en blanc sur le bleu, carte blanche arrondie, code EN GRAND, UN plein d'encre, pied en
// clair. Un document entier par langue (`{{ if $en }}…{{ else }}…{{ end }}`) : le `lang` suit.
const { VERRE, teteVerre, boutonVerre, codeVerre, enveloppeVerre } = require('../api/_lib/mail-verre.js');
const SECOURS = { fr: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :', en: 'Button not working? Copy this link into your browser:',
  es: '¿El botón no funciona? Copia este enlace en tu navegador:', it: 'Il pulsante non funziona? Copia questo link nel browser:', de: 'Der Button funktioniert nicht? Kopiere diesen Link in deinen Browser:' };

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
  const pied = `<p class="vv-gris" style="margin:0 0 10px;font-family:${P};font-size:13px;line-height:20px;color:${VERRE.surBleu2}">${t.pied}</p>`
    + `<p class="vv-gris" style="margin:0;font-family:${P};font-size:13px;line-height:20px;color:${VERRE.surBleu2}">VRM · <a class="vv-lien" href="https://vrm.center" style="color:${VERRE.surBleu};text-decoration:underline">vrm.center</a></p>`;
  return enveloppeVerre({ lang: l, titreDoc: 'VRM', apercuHtml: t.apercu, teteHtml: teteVerre({ titreHtml: t.titre }), corpsHtml: corps, piedHtml: pied });
};

// (17 nov.) Un document entier par langue : `{{ if eq $l "en" }}` … `{{ else if eq $l "es" }}` …
// `{{ else }}` <le français> `{{ end }}`. `printf "%v"` : une langue absente rend "<nil>".
const html = (m) => [
  TETE,
  ...LANGUES.flatMap((l, i) => [l === 'fr' ? '{{ else }}' : `{{ ${i ? 'else ' : ''}if eq $l "${l}" }}`, bloc(m, l)]),
  `{{ end }}`,
  '',
].join('\n');
// Les blocs d'un modèle fabriqué, par langue (pour les audits) : { en, es, it, de, fr } ou null.
const blocsLangues = (src) => {
  const out = {};
  const marques = LANGUES.map((l, i) => (l === 'fr' ? '\n{{ else }}\n' : `\n{{ ${i ? 'else ' : ''}if eq $l "${l}" }}\n`));
  let pos = 0;
  const debuts = marques.map((mq) => { const k = src.indexOf(mq, pos); if (k >= 0) pos = k + mq.length; return k < 0 ? -1 : k + mq.length; });
  const fin = src.lastIndexOf('\n{{ end }}');
  if (debuts.some((d) => d < 0) || fin < 0) return null;
  LANGUES.forEach((l, i) => { out[l] = src.slice(debuts[i], i + 1 < LANGUES.length ? debuts[i + 1] - marques[i + 1].length : fin); });
  return out;
};

// Sujet : Supabase passe aussi le sujet au moteur de modèles (Go). Si un jour
// ce n'était plus le cas, `sujetFr` (français seul) se colle à la place.
const sujet = (m) => `${TETE}${LANGUES.map((l, i) => (l === 'fr' ? `{{ else }}${m.sujet.fr}` : `{{ ${i ? 'else ' : ''}if eq $l "${l}" }}${m.sujet[l]}`)).join('')}{{ end }}`;

const fichiers = () => {
  const out = {};
  for (const m of MODELES) out[path.join(DOSSIER, `${m.id}.html`)] = html(m);
  out[path.join(DOSSIER, 'sujets.json')] = JSON.stringify(Object.fromEntries(MODELES.map((m) => [m.id, { onglet: m.onglet, sujet: sujet(m), sujetFr: m.sujet.fr, sujetEn: m.sujet.en, sujetEs: m.sujet.es, sujetIt: m.sujet.it, sujetDe: m.sujet.de }])), null, 2) + '\n';
  return out;
};

module.exports = { MODELES, html, sujet, fichiers, DOSSIER, LIEN_RECUPERATION, LANGUES, blocsLangues, SECOURS };

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
