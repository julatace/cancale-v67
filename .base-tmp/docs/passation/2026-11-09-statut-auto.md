# 9 nov. 2026 — /statut automatique : sondes, incidents, bandeau

Branche `claude/statut-auto` (depuis `origin/main`). Pas de PR, pas de merge.
Julien : « fais tout » — des vendeurs payants arrivent ; la page /statut ne doit plus
dépendre d'un incident écrit à la main.

## 1. Les sondes (`api/_lib/statut-sondes.js`)
- Six morceaux : **base** (deux scalaires de la ligne du collecteur), **connexion**
  (`/auth/v1/settings`), **e-mails reçus** (clé `EMAIL_INBOUND_SECRET`, collecteur, et le
  dernier `email_reception_*` rangé — `meta->>at`, `etat` intégré/à vérifier — comparé à
  l'historique), **envoi des e-mails** (vraie connexion SMTP `seulementConnexion`, aucun
  message, une fois par heure au plus ; pas configuré ⇒ « pas su / pas en service »),
  **notifications** (VAPID + clé de service : une configuration, dite « Configurées »),
  **extension** (dernier `ext_appareil_*` de n'importe quel navigateur : une date, rien
  d'autre).
- Trois états : `ok` · `degrade` · `pas_su`. Pas de réponse (délai, réseau) ⇒ `pas_su`,
  jamais compté comme échec ni comme retour.
- **Silence anormal** (e-mails, extension) : chaque passage apprend les silences ≥ 1 h
  (14 jours) ; seuil = max(6 h, 1,5 × le plus long silence normal), plafonné à 7 jours ;
  moins de 3 jours d'observation ⇒ `pas_su` (« pas encore jugé »). Les nuits sans e-mail
  ne sonnent donc pas.
- **Où ça tourne** : `api/ship-reminders.js?moment=sondes` (aucune 13ᵉ fonction), appelé
  toutes les 10 min par GitHub (`.github/workflows/sondes-statut.yml`, secret `CRON_SECRET`
  comme `reveil-notifs.yml`), et aussi aux crons Vercel du matin et du soir (filet si
  GitHub ne passe pas). 503 si l'état n'a pas pu être lu/écrit ⇒ le job GitHub échoue et
  GitHub prévient par e-mail (cas d'une base TOUT À FAIT tombée : elle ne peut pas
  s'écrire elle-même).

## 2. La ligne d'état et les incidents
- `statut_sondes`, propriétaire **NEUTRE** : c'est l'état de VRM, pas une donnée d'un
  vendeur ; elle survit à un changement de `VRM_OWNER_UID` ; aucune session ne peut la lire
  (RLS) — seul le serveur, et `/api/sante` n'en rend que `statutPublic` (mots fixes, dates,
  durées). Comparer-et-échanger sur `data.rev` (le cron et GitHub peuvent se croiser).
- Deux `degrade` de suite ⇒ incident ouvert (daté de la PREMIÈRE ratée) + **une**
  notification au propriétaire (`cat: 'signalement'`, ses heures calmes s'appliquent) ;
  le drapeau `notifie` est écrit AVANT l'envoi (pas écrit ⇒ rien envoyé). Un `ok` le ferme
  avec sa durée (pas de notification de fermeture). 30 jours d'incidents, 31 jours de
  compteurs `[ok, dégradé, pas su, incident]` par morceau.
- Les incidents à la main (`public/statut-incidents.json`) restent, affichés « Écrit par
  l'équipe de VRM ».

## 3. La page vrm.center/statut
- `public/statut.html` charge seulement `/statut.js` (plus `/etat.js`, qui sert toujours /etat).
- Six rangées, 30 barres (jour par jour, aujourd'hui à droite) : normal = gris foncé,
  incident = ambre, **pas vérifié = gris clair** (jamais la couleur d'un « ok », jamais bleu).
- « Mis à jour il y a N min » ; état rangé il y a plus de 45 min ⇒ tout « Pas vérifié »,
  titre « État pas vérifié » (le serveur ET la page le revérifient).
- La sonde en direct de `/api/sante` (`etat`) prend le relais quand l'état rangé manque ou
  est périmé, et une panne de la base dite en direct passe toujours.

## 4. Le bandeau dans l'app
`BandeauStatut` (App.jsx, sous `BandeauLiaison`), règle `src/statutBandeau.js` : un
incident OUVERT par les sondes ⇒ une ligne neutre (« Les e-mails arrivent en retard — on
s'en occupe. » + « Voir l'état »), une fois par incident et par appareil
(`vrm_statut_bandeaux_vus`, confort local) ; périmé / pas su ⇒ rien.

## Preuves
- `node scripts/audit-statut-auto.cjs` : 26 verts — exécute la VRAIE route cron et la vraie
  `/api/sante` sur une fausse base (forme réelle : projections, `meta->>`, `rev`,
  `return=representation`). `--prouve` : **origin/main rouge (12)** et **13 mutations**
  rouges (un échec suffit, notification à chaque passage, pas de réponse = ok, pas su efface,
  envoi sans écriture, écriture sans rev, fermeture sans durée, périmé lu frais, projection
  qui recopie la base, route débranchée, page « pas su » en vert, bandeau à chaque visite,
  silence jamais jugé).
- `scripts/bancs/statut-auto.cjs` (390/1512, clair/sombre, cas « incident » et « sondes
  arrêtées ») vert, captures regardées ; `scripts/bancs/confiance.cjs` partie S verte.
- `audit-confiance` 39/39 (A12 accepte `statut,`), `audit-fonctions-api`, `audit-variables`,
  `audit-tdz`, `audit-coherence`, `audit-cron-lots`, `npm run build` : verts.
- ⚠️ `audit-confiance --prouve` : « départ » KO déjà avant ce chantier — sa branche de départ
  (`origin/claude/amazing-lovelace-xd7obl`) contient maintenant la confiance ; les 13
  mutations restent rouges.

## Geste de Julien
Vérifier que `CRON_SECRET` est dans les secrets GitHub (Settings → Secrets and variables →
Actions ; déjà nécessaire au réveil). Sans lui : sondes deux fois par jour seulement, et la
page dit « pas vérifié » le reste du temps.
