# Favoris : réactiver Vinted et rouvrir la cloche ; messages et offres

## Éléments réellement obtenus

Le contrôle client 5.221 indique étape `commande`, code `notifications_non_affichees`, ouvert false. La commande atteint donc le worker ; ce n'est plus une absence de connexion à l'extension. Le vendeur confirme ensuite que le panneau de la cloche se referme lorsqu'il revient dans VRM. L'ancienne recherche exigeait un lien visible avant de réactiver Vinted : ce parcours ne pouvait pas rouvrir ce panneau.

Le vendeur demande explicitement que l'extension ouvre d'abord la cloche puis le favori/la conversation. Il demande aussi d'améliorer les messages et les offres. Tentatives de lecture publique de https://vtools.fr, https://vintex.app et https://www.vinted.fr : refus du proxy (HTTP403 tunnel). Aucun outil web de recherche callable dans cette session. Ne pas prétendre avoir analysé les méthodes internes des concurrents ni le DOM authentifié actuel de Vinted.

## Extension 5.222

Le worker conserve l'origine et l'identifiant du favori privé sélectionné, contrôle owner et UID courant, puis cherche un onglet de cette origine. Il réactive l'onglet et sa fenêtre, revérifie le compte, puis recherche le lien exact. Si celui-ci n'est pas affiché, un contrôle natif de notifications est recherché par nom accessible (`aria-label` ou `title`) français/anglais, parmi les boutons visibles. Une unique cloche reconnue est activée une seule fois ; `aria-expanded=true` évite de refermer une cloche déjà ouverte. Attente bornée de la liste, puis activation du lien exact. Aucun nom de classe CSS, chemin de route, endpoint ou destinataire n'est inventé.

Le contexte de rapprochement est posé seulement une fois le lien exact présent, avant son activation. Reçu positif uniquement après archivage effectif de la preuve native. Sans cloche identifiable, ou sans le favori exact après activation, refus explicite (`cloche_introuvable`, `cloche_indisponible`, `favori_non_trouve`) ; pas de substitution d'un autre favori, pas de nouvelle page chargée sur la route 404, pas de message de test. La version est conservée aussi dans ces refus. Gardes RLS/owner/UID, historique avant envoi, quota10par60minparUID et absence de rejeu conservés. Seuil envoi217/liste218/suivi216 inchangés, ouverture222 requise.

Limite : le DOM actuel du compte n'est pas accessible ici. Si Vinted ne fournit pas un bouton de notifications avec un nom accessible reconnu ou refuse un clic programmatique, la commande s'arrête ; ne pas annoncer un succès réel avant retour du vendeur.

## Interface messages et offres

- Historique des offres structuré : reçue, envoyée, direction inconnue quand l'auteur n'est pas fourni. Montant validé, devise seulement si fournie par la source ; statut natif conservé. Pas de libellé technique à la place d'une offre lisible.
- Offre reçue à traiter distincte de l'historique. Contre-offre repliée sous « Proposer un autre prix », ouverte sans offre en attente. Prix désactivé pendant une action ; résultats avec rôle status/alert. La logique d'identité, les endpoints, la confirmation d'acceptation et les règles d'offre en attente restent inchangés.
- En-tête : titre d'article natif, jamais l'extrait du dernier message. Recherche élargie au titre natif d'article ; filtre nommé « Offres reçues ».
- Réponses rapides de la page visibles dans Conversations uniquement. Assistance technique reformulée pour ne plus imposer le vieux parcours manuel comme fonctionnement normal.
- Au début d'une vérification, seul un ancien refus de preuve/identité est effacé. Les travaux et résultats incertains restent conservés ; aucune relance automatique.

## Validation

Fixtures uniquement ; aucun message réel ni session utilisateur manipulés. Banc Chromium de cloche masquée : sonde, ouverture unique, absence de fermeture si déjà ouverte, origine et ambiguïté refusées, navigation interne sans nouveau document. Worker : focus avant cloche, apparition différée du lien, reçu d'archivage réel, absence de substitution si favori manquant. Normalisation des offres testée pour sens/statut/devise inconnus, montants invalides, conservation des messages et codes de retrait.

Le banc intégral utilisait initialement des messages synthétiques sans IDs et les fusionnait donc comme des messages distincts. Les fixtures portent désormais les identités natives stables : aucun assouplissement de la fusion réelle et aucune déduplication supposée par texte/montant. Un premier test téléphone attendait à tort un formulaire d'offre sans extension ; il exige désormais l'absence de ce formulaire et conserve les cartes d'historique. Résultats finaux à consigner dans le contexte de publication.
