# Conformité légale de VRM (France / Union européenne) — état au 30 septembre 2026

⚠️ Ce document est une aide pratique, pas un avis juridique. Avant d'ouvrir une
offre payante au public, une relecture par un avocat ou un juriste est conseillée.

## Ce qui est en place

| obligation | texte | où |
|---|---|---|
| Mentions légales (éditeur, hébergeur, contact) | LCEN art. 6-III | `/legal/mentions-legales.html` |
| Conditions générales d'utilisation | droit des contrats, C. civ. 1127-1 | `/legal/cgu.html` |
| Clauses de sous-traitance pour les données des acheteurs | RGPD art. 28 | CGU article 5 |
| Conditions générales de vente (prêtes pour l'offre payante) | C. conso L111-1, L221-5, L221-18, L215-1-1, L224-25-12, L612-1 | `/legal/cgv.html` |
| Politique de confidentialité (finalités, bases légales, durées, sous-traitants, transferts, droits, CNIL) | RGPD art. 12 à 14, 44 à 46 | `/legal/confidentialite.html` |
| Information cookies / traceurs | loi Informatique et Libertés art. 82, recommandation CNIL 2020 | `/legal/cookies.html` |
| Polices hébergées sur le site (plus d'IP envoyée à Google) | recommandation CNIL, LG München 3 O 17493/20 | `src/main.jsx` (@fontsource) |
| Aucun traceur publicitaire ni mesure d'audience → pas de bandeau cookies nécessaire | art. 82 | vérifié : aucune requête vers un tiers au chargement |
| Point de contact des autorités et des utilisateurs | DSA art. 11 et 12 | mentions légales |
| Information au moment de l'inscription | RGPD art. 13, C. civ. 1127-1 | phrase sous « Créer mon compte » |
| Liens légaux accessibles sans compte | LCEN | pied de l'écran de connexion + Réglages |
| Export des données | RGPD art. 20 | Réglages → Sauvegarde complète |
| Pas d'envoi de données bancaires / identité par l'extension | RGPD art. 5.1.c (minimisation) | extension 5.119 (`storeWriteReq`) |
| Mention « non affilié à Vinted… » | droit des marques | pied de chaque page légale |

Les informations sur l'éditeur se remplissent **à un seul endroit** :
`public/legal/editeur.js`. Tant qu'un champ est vide, les pages affichent
« à compléter » en surligné. Aucune valeur n'est inventée.

## Ce que Julien doit fournir ou faire (personne ne peut le faire à sa place)

1. **Remplir `public/legal/editeur.js`** : raison sociale (ou nom + « entrepreneur
   individuel »), forme juridique, adresse, SIRET, immatriculation, TVA (ou « non
   applicable, art. 293 B du CGI »), e-mail de contact, téléphone, directeur de la
   publication. → Il suffit de me les donner, je les pose.
2. **Choisir un médiateur de la consommation** avant de vendre un abonnement à
   des particuliers (obligatoire, art. L612-1). La liste officielle est sur
   `economie.gouv.fr/mediation-conso`. Coût : quelques dizaines d'euros par an.
3. **Fermer la base de données (étape 2 du verrouillage Supabase).** Tant que la
   clé publique permet de lire et d'écrire toutes les données, l'obligation de
   sécurité du RGPD (art. 32) n'est pas remplie. C'est le point le plus important
   de cette liste. Le script est prêt : `supabase/migrations/002-fermeture.sql`.
4. **Passer le dépôt GitHub en privé.**
5. **Supprimer les données sensibles déjà captées** (IBAN, scan de passeport,
   jetons de carte, codes 2FA dans `harvest_*_wreq_*`) — demandé, en attente de
   son accord.
6. Si l'extension est publiée sur le Chrome Web Store : y indiquer le lien de la
   politique de confidentialité (`https://vrm.center/legal/confidentialite.html`).

## Ce qui reste à construire dans l'app

- **Bouton « Supprimer mon compte »** (droit à l'effacement, art. 17). Aujourd'hui
  la politique renvoie vers une demande par e-mail — c'est admis, mais un bouton
  est préférable. Il faut d'abord que la base soit cloisonnée (point 3), pour
  qu'un compte ne puisse effacer que ses propres lignes.
- **Offre payante** : le jour où Stripe est branché, il faut, au moment du
  paiement, une case « je demande l'accès immédiat et je reconnais… » (art.
  L221-25), un bouton qui indique « commande avec obligation de paiement », et le
  bouton de résiliation en quelques clics dans Réglages (art. L215-1-1). Les CGV
  le prévoient déjà.
- **Durées de conservation annoncées** dans la politique : suppression 30 jours
  après la clôture (90 jours pour les sauvegardes), journaux 12 mois, compte
  inactif 3 ans. Ce sont des **engagements** : il faudra une tâche planifiée qui
  les applique avant d'ouvrir l'app au public.
- **Registre des traitements** (art. 30) : recommandé dès qu'un traitement est
  régulier. Le tableau de la politique de confidentialité en est la base.

## Accessibilité

L'Acte européen sur l'accessibilité (en vigueur depuis le 28 juin 2025) exempte
les microentreprises (moins de 10 personnes et moins de 2 M€ de chiffre
d'affaires) pour les services. Une phrase d'engagement et un contact figurent
dans les mentions légales.
