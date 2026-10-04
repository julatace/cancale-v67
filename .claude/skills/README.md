# Compétences de design — Emil Kowalski

Ajoutées le 4 octobre 2026 à la demande de Julien. Copiées depuis
`github.com/emilkowalski/skills` (commit `e8a175de`, 2 octobre 2026), licence MIT
(`LICENSE-emilkowalski-skills`). Contenu relu avant l'ajout : des règles de
design et d'animation, aucune commande d'installation ni appel externe.

| compétence | quand elle sert dans VRM |
|---|---|
| `emil-design-eng` | la principale : finition de l'interface, boutons, formulaires, animations |
| `animate` | construire une animation (courbe, durée, propriétés, sortie) |
| `review-animations` | relire une animation de façon stricte |
| `improve-animations` | auditer toutes les animations de l'app et planifier les corrections |
| `find-animation-opportunities` | où une animation aiderait, et où elle gênerait |
| `animation-vocabulary` | nommer un effet qu'on décrit sans connaître son nom |
| `apple-design` | gestes, ressorts, feuilles glissantes, typographie à la Apple |
| `mobile-native` | que l'app installée sur l'iPhone se comporte comme une vraie app |
| `break-ui` | casser un écran avec des données extrêmes (noms longs, 0, 10 000…) |
| `pick-ui-library` | choisir une bibliothèque (seulement si on la demande) |
| `prototype` | plusieurs versions d'un composant, avec un sélecteur (seulement si on la demande) |

Non reprises : `write-swift`, `animate-expo` (iOS/React Native), `ask-sonner`
(VRM n'utilise pas Sonner).

## ⚠️ Les règles de VRM passent AVANT ces conseils

Ces compétences sont des conseils de goût. Quand l'un d'eux contredit
`CLAUDE.md`, c'est `CLAUDE.md` qui gagne :

- **une seule couleur d'accent, et rare** ; un chiffre ne se colore que s'il y a
  vraiment quelque chose à rattraper (§7) ;
- **le chiffre, jamais la promesse** — aucune animation, aucun effet ne remplace
  un « — » honnête par un nombre (§5, §7) ;
- tout passe par l'app réelle **rendue au banc**, aux deux tailles (390 px et
  1512 px), et la capture fait partie du test (§6.2) ;
- `App.jsx` est un seul fichier, aux styles en ligne : on n'ajoute pas de
  bibliothèque d'interface sans raison mesurée (la taille du bundle compte,
  §« vitesse ») ;
- « réduire les animations » est toujours respecté (`prefers-reduced-motion`).
