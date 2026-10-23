# Analyses visibles dans Ma journée

Le bloc Marques/Pays était replié par défaut, contrairement au rendu attendu. Il est désormais affiché directement sous le titre Analyses des ventes. Deux anneaux compacts partagent la largeur et conservent les légendes, la couverture et les états inconnus. Le périmètre réel est Vinted / toutes périodes ; les chiffres mensuels sont présentés séparément.

La lecture enrichie part avec l'affichage et garde le cache de dix minutes. Ce cache est désormais estampillé avec le vendeur ; il ne peut pas servir après un changement de session, et une lecture terminée sous un autre vendeur est écartée. Ni pays fictifs, ni changement des calculs de CA, ni modification de l'extension.

Contrôles : build, deux tests de changement de propriétaire du cache, parcours Chromium de Ma journée à 390/1512 px avec assertions visibilité sans clic et inconnus préservés. Données fictives exclusivement.
