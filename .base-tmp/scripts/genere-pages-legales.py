# Génère public/legal/*.html (les textes vivent ici ; l'identité de l'éditeur dans public/legal/editeur.js).
import os
D='/home/user/cancale-v67/public/legal'
MAJ='30 septembre 2026'
PAGES=[('mentions-legales','Mentions légales'),('cgu','Conditions d’utilisation'),('cgv','Conditions de vente'),('confidentialite','Confidentialité'),('cookies','Cookies et traceurs')]
def E(k): return f'<span data-e="{k}"></span>'
def page(slug,titre,corps):
    AC=' aria-current="page"'
    nav=''.join(f'<a href="/legal/{s}.html"{AC if s==slug else ""}>{t}</a>' for s,t in PAGES)
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titre} — VRM</title>
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="stylesheet" href="/legal/legal.css">
</head>
<body>
<div class="page">
<header><img src="/logo-vrm-192.png" alt=""><a href="/">VRM</a></header>
<nav aria-label="Documents légaux">{nav}</nav>
<main>
<h1>{titre}</h1>
<p class="maj">Dernière mise à jour : {MAJ}</p>
{corps}
</main>
<footer>VRM est un outil indépendant. Il n’est ni affilié, ni approuvé, ni sponsorisé par Vinted, Leboncoin, eBay ou Vestiaire Collective ; ces noms sont des marques de leurs propriétaires respectifs.</footer>
</div>
<script src="/legal/editeur.js"></script>
</body>
</html>
'''
SOUS=f'''<table>
<tr><th>Prestataire</th><th>Rôle</th><th>Données concernées</th><th>Lieu</th></tr>
<tr><td>Supabase Inc.</td><td>Base de données et authentification</td><td>Toutes les données du compte</td><td>Union européenne (Irlande, région eu-west-1)</td></tr>
<tr><td>Vercel Inc.</td><td>Hébergement du site et des fonctions serveur</td><td>Données en transit, journaux techniques</td><td>États-Unis / réseau mondial</td></tr>
<tr><td>Cloudflare Inc.</td><td>Réception et routage des e-mails transférés vers VRM</td><td>Contenu des e-mails reçus</td><td>États-Unis / réseau mondial</td></tr>
<tr><td>Anthropic PBC</td><td>Suggestions et réponses automatiques aux messages (uniquement si tu les actives)</td><td>Texte du message de l’acheteur, titre et prix de l’annonce</td><td>États-Unis</td></tr>
<tr><td>Photoroom SAS</td><td>Retrait du fond des photos d’annonce avant publication (uniquement si tu l’actives)</td><td>Les photos de l’annonce concernée, rien d’autre</td><td>Société française ; lieu des traitements : voir la politique de Photoroom</td></tr>
<tr><td>Google LLC, Discord Inc.</td><td>Connexion « Continuer avec Google / Discord » (si tu la choisis)</td><td>Adresse e-mail, identifiant du compte</td><td>États-Unis</td></tr>
<tr><td>Apple, Google, Mozilla (services de notification)</td><td>Acheminement des notifications sur ton téléphone</td><td>Jeton de l’appareil, texte de la notification</td><td>États-Unis / Union européenne</td></tr>
<tr><td>Fondation OpenStreetMap (Nominatim), CARTO</td><td>Recherche de ville et fond de carte des points relais</td><td>Nom de la ville saisie, adresse IP</td><td>Union européenne / Royaume-Uni</td></tr>
<tr><td>Stripe Payments Europe Ltd.</td><td>Paiement de l’abonnement (lorsqu’une offre payante est ouverte)</td><td>Données de paiement (VRM ne voit jamais ton numéro de carte)</td><td>Union européenne (Irlande) / États-Unis</td></tr>
</table>'''

ML=f'''
<h2>Éditeur du site</h2>
<div class="encadre">
<p><b>{E("nom")}</b><br>{E("forme")}<br>{E("adresse")}<br>
SIRET : {E("siret")}<br>{E("rcs")}<br>{E("tva")}<br>
E-mail : {E("email")}<br>Téléphone : {E("telephone")}</p>
<p>Directeur de la publication : {E("directeur")}</p>
</div>
<p>Le site <b>vrm.center</b>, l’application web VRM et l’extension navigateur « VRM » sont édités par la personne indiquée ci-dessus (art. 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique).</p>

<h2>Hébergement</h2>
<p><b>Vercel Inc.</b>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — <a href="https://vercel.com">vercel.com</a>.</p>
<p>Les données des comptes sont stockées par <b>Supabase</b> (<a href="https://supabase.com">supabase.com</a>) dans l’Union européenne (région Irlande). La liste complète des prestataires figure dans la <a href="/legal/confidentialite.html">politique de confidentialité</a>.</p>

<h2>Point de contact</h2>
<p>Pour toute question, signalement de contenu illicite ou demande des autorités (règlement européen sur les services numériques, art. 11 et 12) : {E("email")}. Les échanges peuvent se faire en français ou en anglais.</p>

<h2>Propriété intellectuelle</h2>
<p>Le nom VRM, le logo, l’interface et le code de l’application sont protégés. Toute reproduction sans autorisation écrite est interdite. Les photos, titres et descriptions d’annonces restent la propriété de leurs auteurs ; VRM ne les utilise que pour le compte de l’utilisateur qui les a importés.</p>

<h2>Marques de tiers</h2>
<p>Vinted, Leboncoin, eBay et Vestiaire Collective sont des marques de leurs propriétaires respectifs. VRM est un outil indépendant, sans lien d’affiliation, de partenariat ou d’approbation avec ces plateformes. Ces noms ne sont cités que pour désigner les services avec lesquels VRM fonctionne.</p>

<h2>Accessibilité</h2>
<p>VRM cherche à respecter les principes du référentiel général d’amélioration de l’accessibilité (RGAA) : contrastes suffisants, navigation au clavier, textes alternatifs, mode sombre. Si un écran te pose un problème d’accès, écris à {E("email")} : une solution te sera proposée.</p>

<h2>Documents</h2>
<ul>
<li><a href="/legal/cgu.html">Conditions générales d’utilisation</a></li>
<li><a href="/legal/cgv.html">Conditions générales de vente</a></li>
<li><a href="/legal/confidentialite.html">Politique de confidentialité</a></li>
<li><a href="/legal/cookies.html">Cookies et traceurs</a></li>
</ul>
'''

CGU=f'''
<p>Les présentes conditions générales d’utilisation (« CGU ») encadrent l’utilisation de l’application VRM (vrm.center) et de l’extension navigateur VRM, éditées par {E("nom")} (« l’Éditeur »). Créer un compte vaut acceptation des CGU.</p>

<h2>1. Le service</h2>
<p>VRM aide les revendeurs à gérer leur activité sur les plateformes de seconde main : annonces, ventes, achats, colis, numéros de rangement, factures et suivi comptable. VRM regroupe les informations que <b>tu</b> importes : données captées par l’extension dans ton propre navigateur, e-mails que tu transfères, informations que tu saisis.</p>
<p>VRM est un outil d’organisation. Il ne vend rien pour ton compte, ne détient pas ton argent et n’est pas un intermédiaire de paiement.</p>

<h2>2. Compte</h2>
<ul>
<li>Le service est réservé aux personnes majeures, capables de contracter.</li>
<li>Tu fournis une adresse e-mail valide et tu gardes ton mot de passe confidentiel. Toute action faite depuis ton compte est réputée faite par toi.</li>
<li>Un compte est personnel. Chaque utilisateur ne voit que ses propres données.</li>
</ul>

<h2>3. L’extension navigateur</h2>
<p>L’extension fonctionne <b>dans ton navigateur</b>, avec la session que tu as ouverte sur la plateforme concernée. Elle lit les informations que la plateforme affiche déjà pour toi (annonces, ventes, achats, messages, bordereaux) et les range dans ton espace VRM.</p>
<p>Certaines actions peuvent être automatisées à ta demande et uniquement si tu les actives : récupération des bordereaux, réponse aux questions des acheteurs, acceptation d’offres au-dessus d’un prix plancher que tu fixes, préparation d’annonces sur d’autres plateformes. Ces actions agissent seulement sur le compte ouvert dans ton onglet, et dans des limites de fréquence.</p>

<h2>4. Ta responsabilité vis-à-vis des plateformes</h2>
<p>Tu restes seul titulaire de tes comptes sur Vinted, Leboncoin, eBay ou toute autre plateforme, et seul responsable du respect de leurs conditions d’utilisation. Une plateforme peut limiter ou suspendre un compte selon ses propres règles ; l’Éditeur n’a aucun contrôle sur ces décisions et ne peut en être tenu responsable. Tu t’engages à ne pas utiliser VRM pour envoyer des messages non sollicités en masse, manipuler des favoris ou des avis, ou contourner les protections d’une plateforme.</p>

<h2>5. Les données de tes clients : VRM est ton sous-traitant</h2>
<p>Tes ventes et achats contiennent des données personnelles de tiers (pseudo, nom, adresse de livraison, messages des acheteurs). Pour ces données, <b>tu es responsable du traitement</b> et l’Éditeur agit comme <b>sous-traitant</b> au sens de l’article 28 du RGPD. À ce titre, l’Éditeur s’engage à :</p>
<ul>
<li>ne traiter ces données que pour fournir le service, sur tes instructions (l’usage de l’app vaut instruction) ;</li>
<li>garantir la confidentialité des données et limiter l’accès aux personnes qui en ont besoin ;</li>
<li>mettre en œuvre des mesures de sécurité adaptées (chiffrement des échanges, séparation des comptes, sauvegardes) ;</li>
<li>ne recourir qu’aux sous-traitants ultérieurs listés dans la <a href="/legal/confidentialite.html">politique de confidentialité</a>, et t’informer de tout changement ;</li>
<li>t’aider à répondre aux demandes des personnes concernées et à tes obligations de sécurité ;</li>
<li>te notifier toute violation de données dans les meilleurs délais, et au plus tard 48 heures après en avoir eu connaissance ;</li>
<li>supprimer ces données à la clôture de ton compte, sauf obligation légale de conservation ;</li>
<li>mettre à ta disposition les informations nécessaires pour démontrer le respect de ces obligations.</li>
</ul>

<h2>6. Chiffres et informations comptables</h2>
<p>Les montants affichés (chiffre d’affaires, bénéfice, cotisations estimées, rapports) sont calculés à partir des données disponibles et de tes réglages (taux, régime fiscal). Ce sont des <b>aides</b>, pas des déclarations. Tu restes responsable de tes déclarations auprès de l’URSSAF et de l’administration fiscale ; en cas de doute, vérifie auprès d’un expert-comptable.</p>
<p>Les factures générées par VRM le sont à partir des informations que tu renseignes (raison sociale, SIRET, mentions). Leur exactitude et leur conformité relèvent de ta responsabilité.</p>

<h2>7. Disponibilité</h2>
<p>L’Éditeur s’efforce d’assurer un accès continu au service, sans garantie d’absence d’interruption (maintenance, panne d’un prestataire, changement d’une plateforme tierce). Une plateforme peut modifier son fonctionnement à tout moment : certaines fonctions peuvent alors cesser de marcher temporairement.</p>

<h2>8. Responsabilité</h2>
<p>La responsabilité de l’Éditeur ne peut être engagée qu’en cas de faute prouvée, et est limitée aux dommages directs et prévisibles. Elle ne couvre pas : les décisions prises par une plateforme tierce sur tes comptes, les pertes de chiffre d’affaires, ni les conséquences d’informations inexactes que tu as saisies. Rien dans les présentes ne limite les droits que la loi te garantit si tu es consommateur.</p>

<h2>9. Suspension et clôture</h2>
<p>Tu peux clôturer ton compte à tout moment depuis l’application (Paramètres → Mon compte → Fermer mon compte) ou en écrivant à {E("email")} ; tes données sont alors supprimées dans les conditions prévues par la <a href="/legal/confidentialite.html">politique de confidentialité</a>. Avant la clôture, tu peux exporter tes données depuis Réglages → Sauvegarde. L’Éditeur peut suspendre un compte en cas de manquement grave aux CGU, après t’avoir prévenu sauf urgence.</p>

<h2>10. Modification des CGU</h2>
<p>Les CGU peuvent évoluer. En cas de changement important, tu es prévenu dans l’application au moins 30 jours à l’avance ; tu peux alors clôturer ton compte si tu refuses les nouvelles conditions.</p>

<h2>11. Droit applicable et litiges</h2>
<p>Les CGU sont soumises au droit français. En cas de litige, une solution amiable est recherchée en priorité ({E("email")}). Si tu es consommateur, tu peux recourir gratuitement au médiateur de la consommation indiqué dans les <a href="/legal/cgv.html">conditions de vente</a>. À défaut d’accord, les tribunaux français sont compétents, sous réserve des règles protectrices applicables aux consommateurs.</p>
'''

CGV=f'''
<div class="encadre"><b>À ce jour, VRM est gratuit.</b> Les présentes conditions générales de vente (« CGV ») s’appliqueront à toute offre payante ouverte ultérieurement. Aucun paiement ne peut être demandé sans que le prix et ces CGV t’aient été présentés et acceptés au préalable.</div>

<h2>1. Vendeur</h2>
<p>{E("nom")} — {E("adresse")} — SIRET {E("siret")} — {E("email")}.</p>

<h2>2. Offres et prix</h2>
<p>Les offres, leur contenu et leur prix sont décrits sur la page d’abonnement de l’application. Les prix sont indiqués en euros, toutes taxes comprises ; lorsque la TVA n’est pas applicable, la mention « TVA non applicable, art. 293 B du CGI » figure sur la facture. Le prix payé est celui affiché au moment de la souscription.</p>

<h2>3. Souscription et paiement</h2>
<ul>
<li>La souscription se fait en ligne. Avant de valider, tu vois le récapitulatif de l’offre, son prix et sa durée, et tu acceptes les présentes CGV ; le bouton de validation indique clairement qu’il entraîne une obligation de paiement.</li>
<li>Le paiement est traité par Stripe. VRM n’a jamais accès à ton numéro de carte.</li>
<li>Une facture est disponible pour chaque paiement.</li>
</ul>

<h2>4. Durée, renouvellement et résiliation</h2>
<ul>
<li>L’abonnement est mensuel (ou annuel si cette option est proposée) et se renouvelle automatiquement à chaque échéance.</li>
<li>Tu peux <b>résilier à tout moment, en quelques clics</b>, depuis l’application (Réglages → Abonnement), par une fonction de résiliation directement accessible (art. L215-1-1 du Code de la consommation). La résiliation prend effet à la fin de la période en cours ; tu gardes l’accès jusque-là.</li>
<li>Pour un abonnement annuel, tu es informé par écrit de la date limite de non-reconduction au plus tôt trois mois et au plus tard un mois avant la fin de la période (art. L215-1).</li>
</ul>

<h2>5. Droit de rétractation (consommateurs)</h2>
<p>Si tu es consommateur, tu disposes d’un délai de <b>14 jours</b> à compter de la souscription pour te rétracter, sans avoir à te justifier (art. L221-18). Il suffit d’écrire à {E("email")}. Tu es remboursé dans les 14 jours, par le même moyen de paiement.</p>
<p>Si tu demandes expressément à utiliser le service payant avant la fin de ce délai, et que tu te rétractes ensuite, seul le montant correspondant à la période écoulée jusqu’à ta rétractation reste dû (art. L221-25).</p>
<p>Si tu souscris pour les besoins de ton activité professionnelle, le droit de rétractation ne s’applique pas, sauf dans les conditions de l’article L221-3 (professionnel employant cinq salariés au plus, contrat hors du champ de son activité principale).</p>

<h2>6. Garantie légale de conformité</h2>
<p>En tant que service numérique, VRM est couvert par la garantie légale de conformité des articles L224-25-12 et suivants du Code de la consommation, pendant toute la durée de l’abonnement. En cas de défaut, tu peux demander la mise en conformité ; à défaut, une réduction du prix ou la résolution du contrat.</p>

<h2>7. Médiation de la consommation</h2>
<p>En cas de litige non résolu par une réclamation écrite à {E("email")}, tu peux saisir gratuitement le médiateur de la consommation : {E("mediateur")} (art. L612-1 du Code de la consommation).</p>

<h2>8. Droit applicable</h2>
<p>Les présentes CGV sont soumises au droit français. Les dispositions protectrices du pays de résidence du consommateur restent applicables lorsqu’elles sont plus favorables.</p>
'''

CONF=f'''
<p>Cette politique explique quelles données VRM traite, pourquoi, pendant combien de temps, avec qui, et comment exercer tes droits. Elle s’applique à l’application vrm.center et à l’extension navigateur VRM.</p>

<h2>1. Qui est responsable ?</h2>
<p><b>Pour les données de ton compte</b> (ton e-mail, tes réglages, ton utilisation du service) : {E("nom")}, {E("adresse")}, contact : {E("email")}.</p>
<p><b>Pour les données de tes clients</b> présentes dans tes ventes et achats (pseudo, nom, adresse de livraison, messages) : c’est toi qui es responsable ; VRM agit comme ton sous-traitant (voir <a href="/legal/cgu.html">CGU, article 5</a>).</p>

<h2>2. Quelles données, pour quoi faire ?</h2>
<table>
<tr><th>Données</th><th>Finalité</th><th>Base légale (art. 6 RGPD)</th></tr>
<tr><td>E-mail, prénom (facultatif), mot de passe (stocké chiffré par le service d’authentification), identifiant Google/Discord si tu l’utilises</td><td>Créer et sécuriser ton compte</td><td>Exécution du contrat</td></tr>
<tr><td>Données captées par l’extension sur tes comptes de revente : annonces, ventes, achats, messages, offres, soldes du porte-monnaie, bordereaux, identifiants de session de ces comptes</td><td>Afficher ton activité, préparer les colis, calculer tes chiffres, exécuter les actions que tu actives</td><td>Exécution du contrat</td></tr>
<tr><td>E-mails que tu transfères vers VRM (ventes, bordereaux, suivis de colis, factures)</td><td>Retrouver ventes, bordereaux et codes de retrait</td><td>Exécution du contrat</td></tr>
<tr><td>Informations de facturation que tu saisis (raison sociale, adresse, SIRET, logo)</td><td>Générer tes factures et reçus</td><td>Exécution du contrat</td></tr>
<tr><td>Jeton de notification de ton appareil, préférences de notification</td><td>T’envoyer les notifications que tu as choisies</td><td>Consentement (activation dans l’app)</td></tr>
<tr><td>Texte d’un message d’acheteur, titre et prix de l’annonce</td><td>Suggestions et réponses automatiques par intelligence artificielle, uniquement si tu les actives</td><td>Consentement (activation dans l’app)</td></tr>
<tr><td>Journaux techniques (adresse IP, date, erreurs)</td><td>Sécurité, prévention des abus, diagnostic</td><td>Intérêt légitime</td></tr>
<tr><td>Factures et paiements (offre payante)</td><td>Comptabilité</td><td>Obligation légale</td></tr>
</table>
<p>VRM ne vend aucune donnée, ne fait pas de publicité et ne dresse pas de profil marketing. Aucune décision produisant des effets juridiques à ton égard n’est prise de façon entièrement automatisée.</p>

<h2>3. Ce que fait l’extension navigateur</h2>
<ul>
<li>Elle n’agit que sur les sites de revente concernés (vinted.fr, leboncoin.fr, ebay.fr…) et sur vrm.center.</li>
<li>Elle lit les réponses que ces sites envoient déjà à ta page, et range dans ton espace VRM ce qui concerne ta propre activité.</li>
<li>Elle utilise la session de ton compte sur la plateforme pour les actions que tu as activées. Ces identifiants de session sont stockés dans ton espace VRM, séparé de celui des autres utilisateurs.</li>
<li>Elle ne collecte pas ton historique de navigation, ni les données bancaires, d’identité ou de double authentification échangées avec la plateforme.</li>
</ul>

<h2>4. Qui reçoit les données ?</h2>
<p>Seul l’Éditeur accède aux données, pour faire fonctionner le service. Il s’appuie sur les sous-traitants suivants :</p>
{SOUS}
<p><b>Transferts hors de l’Union européenne</b> : lorsqu’un prestataire traite des données aux États-Unis, le transfert est encadré par le cadre de protection des données UE–États-Unis (Data Privacy Framework) pour les entreprises certifiées, ou à défaut par les clauses contractuelles types de la Commission européenne (art. 46 RGPD).</p>

<h2>5. Combien de temps ?</h2>
<ul>
<li>Données du compte et données importées : tant que ton compte est actif. Elles sont supprimées dans un délai de 30 jours après la clôture du compte (sauvegardes techniques comprises, dans un délai de 90 jours).</li>
<li>Factures et pièces comptables liées à un paiement : 10 ans (art. L123-22 du Code de commerce).</li>
<li>Journaux techniques : 12 mois au plus.</li>
<li>Compte inactif depuis 3 ans : tu es prévenu, puis le compte est supprimé si tu ne te reconnectes pas.</li>
</ul>

<h2>6. Sécurité</h2>
<p>Échanges chiffrés (HTTPS), mots de passe jamais stockés en clair, séparation des données entre utilisateurs, accès restreints, sauvegardes. Aucune mesure n’est infaillible : en cas de violation présentant un risque pour tes droits, tu en seras informé et la CNIL sera notifiée dans les délais légaux.</p>

<h2>7. Tes droits</h2>
<p>Tu disposes des droits d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, ainsi que du droit de retirer ton consentement à tout moment et de définir des directives sur le sort de tes données après ton décès (loi Informatique et Libertés, art. 85). Tu peux exporter tes données toi-même (Réglages → Sauvegarde) ou écrire à {E("email")}. Une réponse t’est apportée dans un délai d’un mois.</p>
<p>Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL : <a href="https://www.cnil.fr/fr/plaintes">cnil.fr/fr/plaintes</a>, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.</p>

<h2>8. Mineurs</h2>
<p>Le service est réservé aux personnes majeures.</p>

<h2>9. Modifications</h2>
<p>Cette politique peut évoluer ; la date de mise à jour figure en haut de la page. En cas de changement important, tu en es informé dans l’application.</p>
'''

COOK=f'''
<p>Cette page décrit les informations enregistrées sur ton appareil quand tu utilises VRM (article 82 de la loi Informatique et Libertés, lignes directrices et recommandation de la CNIL du 17 septembre 2020).</p>

<h2>En bref</h2>
<div class="encadre"><b>VRM n’utilise aucun cookie publicitaire, aucun outil de mesure d’audience et aucun traceur de réseau social.</b> Les seules informations stockées sur ton appareil servent à faire fonctionner l’application. Elles sont exemptées de consentement : c’est pourquoi aucun bandeau cookies ne s’affiche.</div>

<h2>Ce qui est stocké sur ton appareil</h2>
<table>
<tr><th>Élément</th><th>Rôle</th><th>Durée</th></tr>
<tr><td>Session de connexion (stockage local du navigateur)</td><td>Te garder connecté</td><td>Jusqu’à la déconnexion ou l’expiration de la session</td></tr>
<tr><td>Préférences (mode sombre, zoom, filtres, onglet ouvert)</td><td>Retrouver l’app comme tu l’as laissée</td><td>Jusqu’à ce que tu effaces les données du site</td></tr>
<tr><td>Copie locale de tes données et cache hors ligne (service worker)</td><td>Afficher l’app plus vite et en cas de réseau faible</td><td>Mise à jour à chaque visite</td></tr>
<tr><td>Abonnement aux notifications</td><td>Recevoir les notifications que tu as activées</td><td>Jusqu’à la désactivation</td></tr>
</table>

<h2>Services tiers chargés par l’application</h2>
<ul>
<li>Les polices de caractères sont hébergées par VRM : aucun appel à Google Fonts.</li>
<li>Le fond de carte des points relais (CARTO) et la recherche de ville (OpenStreetMap) ne sont chargés que lorsque tu ouvres la carte. Ils reçoivent ton adresse IP, comme tout serveur web, mais ne déposent pas de traceur par l’intermédiaire de VRM.</li>
<li>Les photos d’annonces sont affichées depuis les serveurs de la plateforme concernée.</li>
</ul>

<h2>Comment les supprimer</h2>
<p>Tu peux effacer à tout moment les données du site depuis les réglages de ton navigateur (confidentialité → données des sites). Tu seras alors déconnecté et tes préférences locales seront réinitialisées ; les données de ton compte restent en ligne.</p>

<h2>Évolution</h2>
<p>Si VRM ajoute un jour un outil de mesure d’audience ou tout autre traceur soumis à consentement, un choix clair (accepter / refuser, aussi simple l’un que l’autre) te sera proposé avant tout dépôt.</p>
'''
for (slug,t),c in zip(PAGES,[ML,CGU,CGV,CONF,COOK]):
    titre={'cgu':'Conditions générales d’utilisation','cgv':'Conditions générales de vente','confidentialite':'Politique de confidentialité'}.get(slug,t)
    open(os.path.join(D,slug+'.html'),'w').write(page(slug,titre,c))
print('ok')
