# Mise en ligne — accueillir beaucoup de vendeurs

*Écrit le 4 octobre 2026. Demande de Julien : « prépare le site pour l'arrivée
de beaucoup de personnes, et comment redistribuer les infos qui arrivent par mail
aux bonnes personnes. » Ce fichier dit CE QUI EST PRÊT, les gestes qui
n'appartiennent qu'à Julien, et les leviers d'ingénierie classés. Ne rien
re-deviner : tout est mesuré dans le dossier (CLAUDE.md) ou dans le code cité.*

---

## 1. La redistribution des emails — DÉJÀ FAITE ET ACTIVE

**Le « comment » est résolu, et de la seule façon sûre.** Un email qui arrive ne
dit pas à qui il est — on le décide par **l'adresse de RÉCEPTION**, jamais par
l'expéditeur, le sujet ou le corps (n'importe qui écrirait « shopcancale35 » pour
voler des données). Chaîne complète, déjà en place :

- `api/_lib/proprietaire-email.js` → `resoudreProprietaire(adresses, registre, defaut)` :
  1. adresse exacte dans le registre `vrm_email_owners` → ce vendeur ;
  2. repli `recu+xxx@` → `recu@` (étiquette « + ») ;
  3. repli « installation à un seul vendeur » **qui s'éteint dès qu'un 2ᵉ
     vendeur existe** (sinon un email mal adressé partirait chez le propriétaire
     de l'installation — irréversible) ;
  4. sinon **quarantaine**, jamais une devinette.
- `api/email-inbound.js` **tague chaque ligne écrite du `owner` résolu**
  (`contexteVendeur` → `withOwnerAll`) → **RLS isole** chaque vendeur.
- **Quarantaine** : `email_quarantaine_*`, affichée dans l'app, rattachable d'un
  clic (`/api/email-rattacher`, `__ownerForce`). Perdre un email est réparable ;
  le donner au mauvais vendeur, non.
- Preuve : `scripts/audit-proprietaire-email.cjs` (16 contrôles) — un email dont
  l'expéditeur/sujet/corps nomment un autre vendeur reste chez le bon.

**RLS est déjà ACTIF** (migration `004-meta-et-rls-rapide.sql` passée : sans
session, `app_data`/`vinted_accounts` renvoient `[]`). Le trou du 12 septembre
(clé publique qui lisait tout, jetons compris) est **fermé**.

### Ce qu'il reste à faire par NOUVEAU vendeur (opérationnel, pas du code)
1. Il crée son compte VRM (même email partout).
2. Dans **Réglages → tes adresses de réception**, il déclare l'adresse où
   arrivent ses emails Vinted/transporteurs.
3. Il **fait suivre** cette boîte vers l'adresse de réception de l'app
   (`recu@usevrm.com` via Cloudflare — ou mieux, une adresse `+étiquette` par
   vendeur, voir §3).
4. Il installe l'extension et se connecte **avec le même email que sur VRM**
   (l'étape qui sépare les vendeurs — déjà expliquée par la carte d'accueil et la
   fenêtre de l'extension).

> ⚠️ Le Gmail perso de Julien (`vrm.vinted35@gmail.com` + `gmail-forwarder.gs`)
> est SON installation. Ce n'est pas le mécanisme multi-utilisateurs : chaque
> vendeur branche SA boîte. Le script Gmail ne sert qu'à lui.

---

## 2. Les gestes qui n'appartiennent qu'à Julien (il possède les comptes)

Classés par rapport impact / effort. Le n°1 est **gratuit et sans risque**.

1. ⭐ **Prendre le « Free Upgrade » Nano → Micro** sur le dashboard Supabase
   (inclus dans le plan Pro, **0 €**). Mesuré le 3 oct : **CPU 62 % avec UN seul
   vendeur** sur Nano — c'est le COMPUTE qui casse en premier (→ 522 /
   DatabaseTimeout), pas le disque. Doubler la RAM est le plus gros gain
   disponible pour zéro euro. **À faire en premier.**
2. **Garder le dépôt public ou le passer en privé** : la clé anon ne lit plus
   rien (RLS), donc ce n'est plus un trou de sécurité — mais un dépôt privé reste
   plus propre pour une mise en ligne. Son choix (`SECURITE.md`).
3. **Surveiller compute + égress** sur le dashboard quand les vendeurs arrivent :
   le plan Pro inclut 10 $ de crédit compute et 250 Go d'égress ; au-delà c'est
   du **surcoût**, pas un bug (voir `docs/capacite-utilisateurs.md`).

---

## 3. Les leviers d'ingénierie, classés — à faire AVANT une vraie foule

Aucun n'est bloquant pour quelques vendeurs ; tous comptent à l'échelle. **À faire
avec bancs, jamais à l'aveugle.**

| levier | pourquoi | risque si bâclé |
|---|---|---|
| **§4.5 pagination des balayages serveur** ✅ FAIT (4 oct, `widget` + `ship-reminders`) | au-delà de 1000 lignes Supabase tronque en silence | des rappels/colis perdus sans erreur |
| **Crons / routes par-propriétaire** ✅ FAIT (4 oct) | `ship-reminders` (push par vendeur) ET `widget` (clé `?k=` → owner, lectures filtrées) ne mélangent plus les vendeurs | *(corrigé)* le résumé d'un vendeur partait à tout le monde, et le widget de B agrégeait A |
| **PDF des bordereaux → Supabase Storage** | le Disk IO (62 %) et l'égress viennent surtout des PDF lus/écrits dans le JSONB ; la purge (5.146) soulage déjà | gros chantier : capture + lecture + purge à migrer ensemble |
| **Adresse `+étiquette` par vendeur** | `recu+{token}@usevrm.com` rend l'attribution exacte même si le transfert masque le destinataire d'origine | sans ça, un transfert qui réécrit le « To » tombe en quarantaine |

### Les crons/routes par-propriétaire — la forme retenue (FAIT le 4 oct)
- Chaque vendeur a SA ligne (`main`, `push_subs`…) grâce à la PK `(owner,id)` :
  on résout SON `owner` d'abord, puis on calcule dans `contexteVendeur.run`, et
  chaque lecture se filtre (`owner=eq.<lui>`). `ship-reminders` énumère les
  owners actifs et pousse à chacun ; `widget` prend l'owner de la clé `?k=`.
- Preuves 2-vendeurs : `scripts/bancs/ship-multi.cjs` (5 rouges sur l'avant) et
  `scripts/bancs/widget-multi.cjs` (7 rouges sur l'avant) — chacun ne voit QUE
  ses chiffres. `serveur.cjs` (base non cloisonnée) reste vert = rien ne change
  tant qu'il n'y a qu'un vendeur.

---

## 4. Ce qui est DÉJÀ prêt pour l'échelle (ne pas refaire)
- **Routes/crons par vendeur** : `ship-reminders` pousse le rappel au bon
  vendeur (banc `ship-multi.cjs`), `widget` filtre par la clé `?k=` → owner
  (banc `widget-multi.cjs`). Base non cloisonnée → comportement d'aujourd'hui.
- **Isolation** : RLS `owner = auth.uid()` + `vinted_accounts` par owner, actif.
- **Vitesse** : colonne `meta` (lecture d'un petit champ sans décompresser la
  ligne), lectures app en parallèle + paginées.
- **Emails** : résolution + tag owner + quarantaine + rattachement (§1).
- **Cache / zip** : service worker v5 (purge les vieilles versions), `/assets/`
  immuable, zip de l'extension servi réseau-d'abord.
- **Démarrage par vendeur** : `AppCoeur` monte `key = user.id` (changer de vendeur
  remonte tout à neuf, aucun effet de données avant la session).

---

## 5. L'ordre recommandé
1. Julien prend le **Free Upgrade Micro** (gratuit, tout de suite).
2. On teste **à 2–3 comptes réels** (Julien + un essai) : un email arrive, il
   atterrit chez le bon, la quarantaine marche, l'isolation tient, et chaque
   vendeur ne voit QUE son widget / ses rappels d'expédition.
3. Au-delà de ~quelques dizaines d'actifs : **PDF → Storage** et monter le tier
   compute selon la courbe de `docs/capacite-utilisateurs.md`.

### Fait le 4 octobre (session fiabilité / échelle)
- **`ship-reminders` en parallèle borné** : 8 vendeurs à la fois (mille à la
  queue leu leu dépassaient les 300 s de Vercel), un vendeur qui plante n'arrête
  plus les autres, sonde de cloisonnement en panne = « pas su » (plus de passe
  globale qui mélangerait les vendeurs). Banc `ship-multi.cjs` (24 vendeurs).
  Grouper en mémoire (une lecture globale bucketée) reste possible plus tard ;
  avec 8 en parallèle, mille vendeurs tiennent dans la fenêtre.
- **Journal des plantages** (`plantage_*`, au nom de chaque vendeur) : à
  l'échelle, c'est lui qui dit quel écran tombe chez qui — sans fournisseur tiers.
- **Code mort retiré** (7 fonctions, 220 lignes).
- **Détourage Photoroom** : coût borné par vendeur (plafond mensuel atomique,
  cache par empreinte) et réservé aux abonnés qui paient vraiment.
