// Les outils communs aux lecteurs de SMS (api/_lib/sms-*.js) : texte aplati, code
// d'authentification. (9 nov.) Sortis de sms-mondialrelay.js pour que chaque lecteur
// par expéditeur les partage sans import circulaire.
export const plat = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
// Un code d'AUTHENTIFICATION (vérification, connexion, mot de passe à usage
// unique) : jamais rangé, d'où qu'il vienne. Jugé AVANT tout le reste.
export const AUTHENTIFICATION = /code\s+(?:de\s+|d['’]\s*)?(?:v[ée]rification|confirmation|s[ée]curit[ée]|validation|connexion|authentification|acc[èe]s|activation)|verification\s+code|one[- ]time|\bOTP\b|mot\s+de\s+passe|ne\s+(?:le\s+)?(?:communiquez|partagez|transmettez|donnez)/i;
