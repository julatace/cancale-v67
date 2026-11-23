// LE FRANÇAIS DES ÉCRANS À LA DEMANDE (17 nov., lot vitesse-poids).
// ⚠️ Ce fichier est VIDE dans le dépôt, exprès : n'y écris aucune clé (elles vont dans
// fr.js ou fr/<écran>.js, comme toujours). Au build seulement, vite.config.js
// (`francaisDiffere`, analyse : scripts/_francais-differe.cjs) le remplit avec les clés
// de fr.js qu'aucun module du démarrage ne peut lire, et les retire du fr.js que charge
// App.jsx ; chaque module chargé à la demande qui peut en lire une l'importe en premier.
// Sans build (vite dev), fr.js arrive entier et ce module n'ajoute rien.
import { ajouterSourceDifferee } from '../index.js';
ajouterSourceDifferee({});
export default true;
