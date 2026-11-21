# Coller les modèles d'e-mails dans Supabase (8 nov.)

Où : **Supabase → projet `lgonxzrzjcqthjtbdpzo` → Authentication → Emails → Templates**.
Pour chaque onglet ci-dessous, dans cet ordre : colle le **Sujet** (Subject), puis
remplace tout le **contenu** (Message body, onglet « Source ») par le fichier indiqué,
puis **Save**.

Les fichiers sont fabriqués par `scripts/modeles-email.cjs` (ne pas les modifier à la
main : changer le script, puis `node scripts/modeles-email.cjs --ecrire`). Contrôle :
`node scripts/audit-modeles-email.cjs --prouve` (rend chaque modèle avec le vrai moteur
de Go, en français, en anglais et sans langue).

## La langue

VRM n'a pas de sélecteur de langue (il reste en France). L'app range la langue du
navigateur du vendeur dans son compte (`user_metadata.langue`, `fr` ou `en`) : à
l'inscription, et une fois au premier chargement pour les comptes déjà créés
(`src/langueCompte.js`). Les modèles écrivent en **anglais seulement si cette langue vaut
`en`**, en français sinon (vieux compte, invitation, langue absente).

Le **sujet** suit la même règle : Supabase passe aussi le sujet au moteur de modèles.
Si un jour un e-mail arrive avec des accolades `{{ … }}` dans le sujet, recolle à la
place le sujet « français seul » indiqué sous chaque onglet.

## Les six onglets

| # | onglet Supabase | Sujet à coller (une seule ligne) | Contenu à coller |
|---|---|---|---|
| 1 | **Confirm signup** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}Confirm your VRM email address{{ else }}Confirme ton adresse e-mail VRM{{ end }}` — français seul : `Confirme ton adresse e-mail VRM` | `supabase/templates/confirmation.html` |
| 2 | **Invite user** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}You’re invited to VRM{{ else }}On t’invite sur VRM{{ end }}` — français seul : `On t’invite sur VRM` | `supabase/templates/invite.html` |
| 3 | **Magic Link** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}Your VRM code{{ else }}Ton code VRM{{ end }}` — français seul : `Ton code VRM` | `supabase/templates/magic_link.html` |
| 4 | **Change Email Address** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}Confirm your new VRM email address{{ else }}Confirme ta nouvelle adresse VRM{{ end }}` — français seul : `Confirme ta nouvelle adresse VRM` | `supabase/templates/email_change.html` |
| 5 | **Reset Password** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}Choose a new VRM password{{ else }}Choisis un nouveau mot de passe VRM{{ end }}` — français seul : `Choisis un nouveau mot de passe VRM` | `supabase/templates/recovery.html` |
| 6 | **Reauthentication** | `{{- $en := eq (printf "%v" .Data.langue) "en" -}}{{ if $en }}Your VRM confirmation code{{ else }}Ton code de confirmation VRM{{ end }}` — français seul : `Ton code de confirmation VRM` | `supabase/templates/reauthentication.html` |

## Ce que fait chaque e-mail

- **Confirm signup, Invite user, Change Email Address** : un bouton bleu vers le lien
  de Supabase (`{{ .ConfirmationURL }}`), le même lien en clair dessous.
- **Magic Link** : le **code à 6 chiffres** (`{{ .Token }}`) en grand, copiable
  (« Ton code VRM — valable 1 h, une seule fois »), pour la connexion par code de
  l'extension 5.330, **et** le bouton « Me connecter » pour qui ouvre l'e-mail sur
  l'appareil. « 1 h » est la durée par défaut de Supabase (Authentication → Providers →
  Email → *Email OTP Expiration* = 3600 s) : si tu la changes, dis-le pour qu'on corrige
  la phrase.
- **Reset Password** : un bouton vers `https://vrm.center/recuperation.html#token_hash=…&type=recovery`.
  La page vérifie elle-même le jeton : un robot de messagerie qui « visite » le lien pour
  l'analyser ne le consomme pas (c'est sans doute ce qui t'a montré « lien incomplet »
  avec le modèle par défaut : le lien par défaut se consomme à la première visite).
- **Reauthentication** : le code seul, en grand.

Tous : style Apple sobre (blanc, encre, un bouton bleu `#0071E3` de 44 px), 520 px de
large, mode sombre pris en charge par les messageries qui le savent, pied « Tu reçois cet
e-mail parce que… ».

## Plus vite (facultatif)

`SUPABASE_ACCESS_TOKEN=… node scripts/configurer-auth-production.mjs --appliquer` pose
les six sujets et les six contenus d'un coup, puis les relit (jeton d'accès Supabase
personnel, jamais dans un chat). Sans `--appliquer`, il ne fait qu'un aperçu.

## Vérifier

Demande « Mot de passe oublié » depuis vrm.center : l'e-mail doit être en français,
avec le bouton « Changer mon mot de passe » ; il ouvre la page « Choisis un nouveau mot
de passe » ; « Enregistrer » te connecte et « Ouvrir VRM » t'amène dans l'app.
