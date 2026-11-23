# 23 nov. · Lot F — Démarrage guidé : « Bien démarrer », un vrai accompagnement animé (`claude/demarrage-guide`)

Julien (validé le 23 nov.) : « démarrage guidé d'un nouveau vendeur en 5 min : relier ses comptes, installer l'extension
(Chrome/Edge/Orion), voir ses premiers chiffres, coche verte par étape, reprise là où il s'est arrêté ; s'appuie sur
l'onboarding existant au lieu d'en créer un second ». Puis (message du jour) : « un vrai accompagnement avec du motion
design pour expliquer : animations courtes à chaque étape (CSS/SVG, prefers-reduced-motion respecté, passables), ton
chaleureux et simple » ; et la palette du jour : gris clair, cartes blanches, texte foncé, AUCUN orange/ambre.

## Ce qui existait
Trois chemins d'arrivée : le guide « Démarrer avec VRM » (6-8 nov., `src/guideDemarrage.js`), le parcours nouveau
(15 nov., `src/parcoursNouveau/`), et la carte « Bien démarrer 3/5 » d'Aujourd'hui (21 nov., `src/bienDemarrer/`,
cinq étapes cochées sur PREUVE : extension, compte, lecture, numéros, statut fiscal). Ce lot part de la plus récente —
aucun quatrième parcours. Il manquait : l'étape « compte » ne connaissait que Vinted (un vendeur Leboncoin seul ne la
cochait jamais) ; toucher une étape envoyait directement sur un écran, sans explication ; rien ne disait « reprends ici ».

## Ce qui est fait
1. **Preuve « compte »** (`src/bienDemarrer/regle.js`) : un compte Vinted OU Leboncoin / Vestiaire / eBay RELIÉ (la
   lecture de Paramètres → Mes comptes, `useComptesAutresSites`, lancée seulement pour un compte NOUVEAU) ; rien de lu ⇒
   « pas su ». Un vendeur sans Vinted : « Voir tes premiers chiffres » se coche sur son site relié.
2. **L'accompagnement** (`src/bienDemarrer/accompagnement.js` règle pure, `Accompagnement.jsx`, `accompagnement.css`) :
   « Reprendre où tu t'es arrêté » / « Me guider pas à pas » ouvre une feuille sur la 1re étape pas faite (ou celle
   touchée) : « Étape 2 sur 5 », une SCÈNE SVG jouée une fois (≈ 2 s, chaque mouvement ≤ 420 ms), « Passer
   l'animation » / « Revoir », un titre chaleureux, une phrase, 2-3 petites marches, UN bouton plein (le geste : il
   OUVRE l'écran qui le fait), « Étape suivante » (saute les faites). Une étape faite : « ✓ C'est fait, bravo ».
3. **Le navigateur** n'est nommé que s'il est SU (`navigateurIci`, `mobileIci`) : Chrome/Edge/Brave… « Installer pour
   Edge », Firefox, Orion (« Télécharge le dossier VRM pour Orion »), iPhone hors Orion : « seule l'app Orion accepte
   les extensions », Android hors Firefox ou inconnu : « ouvre vrm.center sur ton ordinateur ».
4. Mouvement réduit ⇒ aucune animation (la scène posée) ; palette neutre : gris, blanc, encre, la coche en vert ;
   aucun ambre, aucun rouge, aucune capitale. Textes `acc.*` en 5 langues ; `uxr.bd.compte` / `uxr.bd.lecture`
   reformulés (« Relier ton premier compte », « Voir tes premiers chiffres »). Quoi de neuf `demarrage-accompagne`.

## Preuves
`node scripts/audit-demarrage-guide.cjs` vert (≈ 30 contrôles), `--prouve` 9/9 mutations rougissent (autres sites
ignorés, silence coché, iPhone ⇒ Chrome, reprise au début, suivante faite, mouvement réduit oublié, animation trop
longue, ambre ajouté, geste sur une étape faite). `audit-ux-reglages`, `audit-style-vintex`, `audit-variables`,
`audit-tdz`, `audit-traduction`, `audit-quoi-de-neuf` : verts. Banc `scripts/bancs/ux-reglages.cjs` complété (B6-B9 :
« Me guider » ouvre l'étape à faire avec scène et marches, « Passer » fige, « Étape suivante » avance, aucune coche par
un toucher) — à lancer après 15:30 UTC, captures `b-guide-390/1512-clair/sombre`.

## ÉTAT À LA REPRISE
- Poussé sur `claude/demarrage-guide`. Après 15:30 UTC : build, banc `ux-reglages` (avant/après), captures ; re-merge
  de main (jetons gris clair de l'agent design) ; PR ; fusion demain après 07:00 UTC ; ligne CLAUDE.md §9 à la fusion.
- Geste de Julien : aucun.

## (23 nov., après-midi) « Trop de texte, pas assez de beaux boutons » (Julien)
Chaque étape : une phrase de 8 mots au plus (« Ton assistant lit Vinted pour toi. »), le détail sous « Pourquoi ? »
(`PourquoiReplie`, replié) ; les marches raccourcies (≤ 8 mots) ; le geste en bouton plein avec son icône, « Étape
suivante » / « C'est bon pour l'instant » en boutons teintés avec icône (le `Bouton` natif). Contrôlé par
`audit-demarrage-guide` G9 (phrases ≤ 8 mots, « Pourquoi ? » par étape, icônes).
