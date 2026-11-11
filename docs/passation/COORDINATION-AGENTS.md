# Coordination entre agents — à lire par tout nouvel agent (11 nov. 2026)

Deux agents (ou plus) travaillent sur VRM en même temps. Pour ne jamais se marcher dessus :

## Qui fait quoi
- **Agent principal** (session `session_01L9qoLMVoXh8UiDqmdmGtdw`) : **seul à fusionner sur `main`**
  (paquets d'intégration `claude/integration-11nov-*`, PR, contrôles GitHub, mise en ligne).
  Il pilote aussi ~40 sessions cloud de chantiers (une branche `claude/<lot>` chacune).
- **Second agent** : travaille sur **sa propre branche `claude/agent2-<sujet>`**, pousse à chaque
  commit, **n'ouvre pas de PR et ne fusionne pas sur `main`** : il écrit une ligne dans
  « Fini, à intégrer » ci-dessous et l'agent principal l'intègre au prochain paquet.

## Comment se parler
1. **Ce fichier** (branche `claude/coordination`) : chacun y ajoute ses lignes (`git pull`, éditer,
   `git push`). Lire avant de commencer un sujet, relire toutes les heures.
2. Si les deux sessions sont des sessions Claude Code du MÊME compte : l'outil `send_message`
   (serveur claude-code-remote) avec l'identifiant de session ci-dessus.
3. Sinon, Julien recopie le message d'un agent à l'autre.

## Sujets DÉJÀ en cours (ne pas toucher sans prévenir)
Colis (suivi-commandes, revue-colis, ventes-achats-visuel) · connexions Google/Discord
(connexions-oauth, suppression-oauth) · équipe (016) · base-optimisee · securite-revue ·
reseau-instable · actions-serie · accessibilite · budget-vitesse · restauration · e2e-extension ·
parite-plateformes · sante-donnees · journee-perso · webkit-fiable · rappels-perso ·
import-autre-outil · anti-double-vente · alerte-moderation · extension-visuel · avis-negatif ·
ventes-lot · cloture-annee · ipad · verif-publication · reprise-ecrans · notifs-groupees ·
vocabulaire-article · chargement-leger · **traduction (EN/ES/IT/DE)** · fiscalite-pays ·
stats-plus · rapport-mois · meilleurs-fournisseurs · extension-resume · **revue design complète**.
Reportés en fin de journée : cohérence visuelle, nettoyage du code mort, découpe d'App.jsx.

## Numéros d'extension réservés
5.345 → 5.354 sont pris. Un nouvel agent qui touche `vinted-sync-extension/` réserve ici le
suivant libre (**5.355+**) AVANT de coder.

## Réservations du second agent
- (vide — écrire ici « sujet · branche · début »)

## Fini, à intégrer
- (vide)

## Règles
`CLAUDE.md` en entier (§2 à §8 intouchables). Aucune écriture dans la base de production.
Aucune donnée réelle dans le dépôt (il est PUBLIC). Jamais de secret dans le chat.
