# 8 novembre — deux fermetures involontaires reproduites

Base `a49ebbc4` (PR 1051 conservée, extension 5.328 inchangée). Demande : chercher et corriger des bugs.

## Défauts et corrections

1. SheetShell traitait pointercancel et lostpointercapture comme pointerup. Après un déplacement important, une interruption du navigateur pouvait donc appeler onClose et faire disparaître une saisie non enregistrée. Ces interruptions annulent maintenant le geste et remettent la feuille à sa position initiale. Le vrai lâcher conserve sa règle de fermeture ; un autre identifiant de pointeur ne pilote pas le geste.
2. Le gestionnaire clavier des conversations eBay fermait le fil sur Échap même si la touche servait à la composition du texte, ou avait déjà été traitée par un contrôle. Il respecte désormais defaultPrevented, isComposing, le code 229 et les événements compositionstart/compositionend (pour un navigateur dont isComposing est incomplet). Les écouteurs sont retirés au démontage. Échap normal et le retour du focus à l'appelant sont conservés.

## Preuves

- Les deux scénarios échouent séparément sur le code initial, puis depuis une archive git de la base.
- Une mutation rebranchant pointercancel sur la fermeture refait échouer le test. Une autre retirant le suivi de composition échoue sur le scénario où isComposing n'est pas renseigné.
- 56 contrôles Chromium : 390/1512 px, mouvement normal/réduit, contenu saisi conservé, restauration de position, fermeture volontaire et retour du focus. Événements standards simulés sur les vrais composants ; aucune action marchande.
- Banc existant des composants : 274 verts, dont les glissements réels à la souris, la croix, le voile et les feuilles lumineuses. Audit composants et compilation verts. Capture de la feuille restant ouverte examinée.

Le banc ne certifie pas les gestes de chaque appareil physique ni toutes les combinaisons d'IME. Aucun envoi, compte client ni écriture de production utilisé. Nouveau test intégré à la CI de reprise.
