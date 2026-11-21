import { lireSmsMondialRelay } from '../api/_lib/sms-mondialrelay.js';
for (const t of ["Votre colis 81234560 est arrivé au P. Relais TABAC D'ICI.  Retirez-le vite avec le code 712340. + d'infos: mrcolis.fr",
"Votre colis 81234561 est arrivé au P. Relais PHONE PLUS. Retirez-le vite avec le code 712341. + d'infos: mrcolis.fr",
"Retirez vite votre colis 81234560 avec le code 712340! Il vous attend au Point Relais TABAC D'ICI",
"Au cas où le point de retrait pour votre colis 81234562 serait indisponible, sélectionnez-en un autre sur : www.mondialrelay.fr/s/?m=F3&e=81234562"]) console.log(JSON.stringify(lireSmsMondialRelay({texte:t, expediteur:'MRELAY'})));
