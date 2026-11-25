# Argent, Messages, Réglages : moins de texte — 25 nov. 2026 (lot B)

Branche `claude/moins-texte-b` (depuis `origin/main`, puis `git merge origin/main` : #1398 C3 doux, #1396 parrainage 20 %).
Pas de PR (le train la prendra). Modèle : `2026-11-25-aujourdhui-moins-texte.md`.

## La demande

Julien, 25 nov. : « je veux vraiment que tu regardes toute l'application et que dès qu'il y a du texte, tu l'enlèves ;
ou alors si c'est vraiment indispensable tu le mets mais tu fais un bel affichage ». Ce lot : **Argent** (Résumé et
ses replis, Statistiques, Déclarer, Factures), **Messages** (liste, fil), **Paramètres** (l'écran et ses catégories),
le **menu**, **Comptes liés**, **Extension**, **À distance**, **Parrainage**. Aujourd'hui (fait), Annonces / Achats /
Colis / loupe et les rangées de Ventes : d'autres lots.

## La méthode (la même qu'Aujourd'hui)

Pour chaque phrase : retirée si elle répète un chiffre, un état ou un titre déjà visible, explique l'évidence ou décrit
un bouton ; sinon raccourcie (≤ 8 mots) ; le reste au lecteur d'écran (`vrm-sr-seul`, `n-lu-seul`, `vg-sr`), au
survol (`title`) ou sous « Pourquoi ? ». Un état en mots remplacé par un signe quand le signe suffit (coche, rond vide,
logo du site). Rien de recalculé : aucune règle, aucune donnée, aucun `data-*` retiré. Textes neufs par `tr()`,
cinq langues : `src/i18n/langues/{fr,en,es,it,de}/moinsTexteB.js` (clés `mtb.*`).

**Jamais retiré** : un chiffre, un geste, une alerte qui dit quoi faire (raccourcie), les mentions de la compta
(« au moins » / ≥, la couverture « 0/30 », « à dater », « — » pour « pas su », jamais « encaissé »), le panneau
« Sécurité des données » (ses phrases restent écrites : `phraseEcrite`, Reglages.jsx), les mentions légales.

## Ce qui change

| écran | avant | après | où |
|---|---|---|---|
| Argent · Résumé | « Tes seuils de l'année » + « Source : Directive (UE) 2021/514 · DAC7 » | la rangée « DAC7 Vinted : seuil atteint », « Source » (le texte officiel au survol et au lecteur d'écran) | `AlertesSeuils.jsx` |
| | « Reçu 1 983 € · au jour du versement » | « Reçu 1 983 € » (la définition au lecteur d'écran) | `Compta.jsx` (`ArgentQuestions`) |
| | « Bénéfice — · prix d'achat manquants · 30 prix à saisir » | « Bénéfice — · 30 prix à saisir › » (le bouton dit la raison) | idem |
| | « 6 derniers mois · Pas encore de prix d'achat sur tes ventes de ces six mois. Les saisir » | rien (la case Bénéfice dit déjà le manque et porte le geste) | idem |
| Argent · replis | « Vendu : jour de la vente. Reçu : jour du versement (il se déclare). » | sous « Pourquoi ? » ; sous chaque tuile, le nombre de ventes seul | `Compta.jsx` (`CarteCA`) |
| | « à déclarer : choisis ton statut, plus bas » (redit la case « À déclarer ») | au lecteur d'écran | idem |
| | Bilan : « au jour de la vente, toutes plateformes », « au jour du versement », « dépenses, abonnements et packs notés », « choisis ton régime : VRM ne le devine pas » | au lecteur d'écran ; restent écrites les notes qui disent un manque (« prix d'achat connus 0/30 », un seuil chiffré, « au moins ») | `noteBilanVue` |
| | Rapport : « Ventes, argent, stock, achats — et ce qui manque. » ; Délai : « médiane sur 90 ventes versées » | au lecteur d'écran ; « médiane · 90 ventes » | idem |
| | Dépenses : « Note ta première dépense — ça prend cinq secondes… », « Ton abonnement VRM, Canva… ? », « Tu as acheté un pack… ? », sous-titres des totaux, « Packs & options (facultatif) » | « Aucune pour l'instant. » / « Aucun pour l'instant. », « Facultatif » | idem |
| Statistiques | « Novembre · comparé à octobre », « −6 % par rapport à octobre » (×3) | « Novembre · vs octobre », « −6 % » (la comparaison au survol) | `Stats.jsx` |
| | « il manque le prix d'achat de 30 ventes finalisées sur 30 », « aucune de tes 30 ventes Vinted n'a de date de mise en ligne », « pas assez de données · prix d'achat connu 0 sur 30 »… | « prix d'achat 0/30 », « mise en ligne 0/30 », « mise en ligne pas lue », « moins de 3 ventes » | idem |
| | notes de méthode (comparer deux comptes, meilleur compte, boosts) | sous « Pourquoi ? » | `Stats.jsx`, `BoostVerdict.jsx` |
| | « par semaine · 8 dernières semaines », « aujourd'hui · 36 annonces datées », « depuis le début » | « 8 dernières semaines », la couverture seulement si des annonces ne sont pas datées, rien | `Stats.jsx` |
| | « Marge par plateforme : 48 ventes · 2 874 € vendu » (un seul site : le Vendu de la tuile) | « 48 ventes » | `MargePlateforme.jsx` |
| | « Une estimation au rythme réel, pas une promesse. » ; « Ce que tu veux toucher, frais du site compris. » ; « La même paire, à un prix différent selon le site. » ; « Aucune vente avec un lieu connu » quand toutes sont « sans lieu » | retirées (l'étiquette « estimation », le champ, le résumé le disent) | `ArgentPlus.jsx`, `ArgentPrix.jsx`, `CarteVentes.jsx` |
| Déclarer | 4 statuts × 2 lignes (« Rien à déclarer à l'URSSAF : VRM ne calcule aucune cotisation »…) | le nom du statut ; sa ligne courte et son effet au survol et au lecteur d'écran | `Compta.jsx` |
| | « Un zip : tableur, récap PDF et factures. », « Tape ton SIRET (14 chiffres, avis INSEE) : le nom suit. », « Ton statut n'est pas choisi : aucune case n'est proposée. » | au lecteur d'écran, « SIRET : 14 chiffres, le nom suit. », « Statut à choisir. » | `Compta.jsx`, `DeclarationAnnuelle.jsx` |
| Factures | « 30 ventes · datées comme ton CA déclaré (au versement pour Vinted) » + pastille « Vinted · 1 983 € · 30 » (un seul site) | « 30 ventes · au versement » ; la pastille seulement à partir de deux sites | `Compta.jsx` |
| | « Connexion Super PDP pas lue : ni « connecté », ni « pas connecté » », « Aucune facture émise pour l'instant. », « Aucune facture en attente. » (redit « En attente (0) »), « Choisis-le dans « Ton entreprise » (Argent → Déclarer). » | « Super PDP : pas lu. », « Aucune facture. », lecteur d'écran, « Argent → Déclarer » | `Compta.jsx`, `FacturePro.jsx` |
| Paramètres | la phrase sous chaque réglage et chaque catégorie (ordinateur), les pieds de groupe | au lecteur d'écran et au survol — **sauf « Sécurité des données »** (phrases écrites, `phraseEcrite`) et les alertes | `Reglages.jsx` |
| | Mon compte : « Tes données ne sont visibles que par toi. », « — pas su (réessaie plus tard) » ×3 | au lecteur d'écran ; « — pas su » | `Reglages.jsx`, `ConnexionsCompte.jsx` |
| Comptes liés | « Pro ou particulier : — · profil pas encore lu. Ouvre Vinted sur ce compte. », « E-mails · reçoit ses e-mails », « Revoir l'accueil des comptes reliés » | « Pro/particulier : — », « E-mails ✓ », « Revoir l'accueil » | `VintedProCompte.jsx`, `Reglages.jsx` |
| Menu | « S'ouvre sur le site, dans le panneau de l'extension. » | au lecteur d'écran | `GrilleMenu.jsx` (`piedLu`) |
| Extension | « Sur le téléphone, c'est l'extension de ton ordinateur qui agit. Laisse VRM ouvert… » + la même consigne dessous | « Ici, ton ordinateur agit pour toi. » + la consigne | `EcranExtension.jsx` |
| | comptes liés : initiale, « Vinted », « Lié » ; étapes « pas encore » ×4 ; groupes « Vinted · vendeur_1 » | logo du site en couleur, coche ; rond vide ○ ; logo + pseudo | idem |
| | pieds « Pour délier un compte… », « Lu dans l'extension… », « Pendant 10 min, l'extension note… » ; « Observer Vinted » en titre ET en rangée | sous « Pourquoi ? » ; la rangée seule | `EcranExtension.jsx`, `ObservationVinted.jsx` |
| À distance | « Aucun ordinateur n'a encore donné signe de vie » + 25 mots ; « pas ouvert sur un ordinateur allumé » sur chaque compte ; « Vinted » écrit ; le pied de la file | « Aucun ordinateur vu » + « Extension 5.436+ sur ton ordinateur, navigateur ouvert. » ; rien quand aucun ordinateur n'est vu (sinon « fermé sur l'ordinateur ») ; logo ; « Pourquoi ? » | `EcranADistance.jsx` |
| Parrainage | « Ce mois : 8,77 € » sous le total (redit par la tuile et le détail du mois), « payé par tes filleuls », « sur ton abonnement » | rien / au lecteur d'écran | `EcranParrainage.jsx` |

Messages (liste, fil) : déjà courts (22 mots d'en-tête à 390 px) — rien retiré ; la phrase « s'ouvre sur Vinted avec
l'extension » sous « Répondre dans l'extension » vient du composant partagé `BoutonExtension` (Annonces, Ventes…) : laissée
à l'autre lot pour ne pas changer leurs écrans.

## Les preuves

(voir plus bas)
