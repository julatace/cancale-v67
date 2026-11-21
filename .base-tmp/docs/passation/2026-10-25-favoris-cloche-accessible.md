# Favoris 5.224 — reconnaissance des contrôles de notifications

Le rapport réel de l’utilisateur confirme extension5.223.0, étapecommande, ouvertfalse, codecloche_introuvable. La commande répond ; le destinataire n’est pas encore atteint. Cela précise l’étape, sans fournir le DOM de sa page.

Le détecteur 5.223 ne cherchait que button/[role=button] avec aria-label ou title. Il ignorait les ancres, les noms aria-labelledby, le texte visible et les titres SVG. Les fixtures de ces cas reproduisent le refus sur la source 5.223.

La 5.224 lit les noms sémantiques avec priorité aria-labelledby/aria-label puis texte et titre, reconnaît aussi les liens HTTPS de même origine et les noms localisés. Elle refuse l’ambiguïté, les contrôles masqués/inertes, les soumissions de formulaires et les liens externes. Un nom explicite du parent ne peut pas être remplacé par le titre d’une icône enfant. Le même détecteur est utilisé par scripting et le relais MAIN Orion.

Aucun chemin Vinted inventé ni appel API ajouté. On clique uniquement le contrôle natif visible et identifié. La vérification du lien et du destinataire, le quota et l’exclusion des conversations commencées ne changent pas. Aucun message réel envoyé. La présence de ces formes exactes dans le DOM du vendeur reste non observée : ne pas promettre une résolution réelle sur la seule base des fixtures.

Validation : 42 assertions de sémantique et de refus (test de régression échoue sur5.223), navigation native16, relais page/monde isolé17, worker sans scripting14 ; contrôles d’archive/contexte et audits des paquets. Versions attendues, moteur et paquets Chrome/Orion passent ensemble à5.224.0.
