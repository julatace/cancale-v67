// ════════════════════════════════════════════════════════════════════════════
//  « RECEVOIR LES SMS MONDIAL RELAY » (6 novembre) — la règle de la carte
//  Réglages → Notifications (src/SmsColis.jsx). Pure, sans React.
//
//  Le jeton `vrm_sms_token` (ligne `main`, synchronisé) : 32 caractères [A-Za-z0-9],
//  créé sur SON clic, jamais automatiquement ; « Régénérer » rend l'ancien
//  inutilisable à la seconde où le nouveau est enregistré ; « Couper » pose
//  « coupe » (qui n'a pas le format d'un jeton : le serveur ne le reconnaît pas).
//  Le serveur range un SMS chez le vendeur DE CE JETON (api/_lib/sms-mondialrelay.js),
//  jamais d'après le texte.
//
//  Le pas-à-pas Raccourcis : les mots des écrans d'iOS 17/18 en français. Ce qu'on
//  sait d'Apple (guide Raccourcis, support.apple.com) : une automatisation
//  personnelle se crée dans l'onglet « Automatisation » ; les déclencheurs
//  « Message » ne pouvaient PAS s'exécuter sans confirmation jusqu'à iOS 16 ;
//  depuis iOS 17 chaque automatisation propose « Exécuter immédiatement » ;
//  l'action « Obtenir le contenu de l'URL » accepte la méthode POST et un
//  « Corps de la requête » JSON. Voir docs/passation/2026-11-06-sms-colis.md.
// ════════════════════════════════════════════════════════════════════════════

export const CLE_JETON_SMS = 'vrm_sms_token';
export const JETON_COUPE = 'coupe';
export const jetonSmsValide = (k) => /^[A-Za-z0-9]{24,64}$/.test(String(k || ''));
// 'aucun' (jamais créé) · 'coupe' (réception coupée) · 'actif'.
export const etatJetonSms = (v) => (jetonSmsValide(v) ? 'actif' : String(v || '') === JETON_COUPE ? 'coupe' : 'aucun');

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// `alea(n)` → n octets aléatoires (crypto.getRandomValues par défaut).
export function nouveauJetonSms(alea) {
  const n = 32;
  let o;
  if (typeof alea === 'function') o = alea(n);
  else { o = new Uint8Array(n); crypto.getRandomValues(o); }
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[o[i] % ALPHA.length];   // 256 % 62 : biais négligeable, 190 bits
  return s;
}

export const ORIGINE_SMS = 'https://vrm.center';
export const urlSms = (jeton, origine = ORIGINE_SMS) => (jetonSmsValide(jeton) ? `${origine}/api/widget?mode=sms&k=${jeton}` : '');

// Le SMS du bouton « Tester » : INVENTÉ (n°, code, enseigne), envoyé en mode essai
// (le serveur vérifie le jeton, lit le SMS, n'écrit rien).
export const SMS_EXEMPLE = 'Votre colis 80000001 est disponible au LOCKER 24/7 EXEMPLE. Retirez-le vite avec le code 700001. Détails sur l\'app mrcolis.fr';

// Le pas-à-pas illustré : `dessin` = le dessin (src/SmsColis.jsx), `mots` = les
// mots exacts à toucher, dans l'ordre.
export const ETAPES_RACCOURCI = [
  { cle: 'automatisation', court: 'Ouvre Raccourcis → Automatisation → « + »', dessin: 'onglet', titre: 'Ouvre Raccourcis, onglet « Automatisation »',
    mots: ['Ouvre l’app Raccourcis', 'Touche l’onglet « Automatisation » en bas', 'Touche « + » (ou « Nouvelle automatisation »)'] },
  { cle: 'declencheur', court: 'Choisis « Message », « Le message contient » : colis', dessin: 'message', titre: 'Choisis « Message »',
    mots: ['Dans la liste, touche « Message »', '« Le message contient » : touche « Choisir », écris « colis », touche « OK »', 'Laisse « Expéditeur » vide : MRELAY (Mondial Relay), Pickup, VintedGo et Chronopost ne sont pas des contacts, et leurs SMS contiennent tous « colis »'] },
  { cle: 'immediat', court: 'Coche « Exécuter immédiatement », puis « Nouveau raccourci vide »', dessin: 'immediat', titre: 'Coche « Exécuter immédiatement »',
    mots: ['Coche « Exécuter immédiatement » (pas « Exécuter après confirmation »)', 'Touche « Suivant »', 'Touche « Nouveau raccourci vide »'] },
  { cle: 'url', court: 'Ajoute « Obtenir le contenu de l’URL » et colle l’adresse copiée', dessin: 'url', titre: 'Ajoute « Obtenir le contenu de l’URL »',
    mots: ['Touche « Ajouter une action », cherche « Obtenir le contenu de l’URL » et touche-la', 'Touche « URL » et colle l’adresse copiée ci-dessus', 'Touche la flèche « › » de l’action pour voir ses réglages'] },
  { cle: 'post', court: 'Méthode POST, corps JSON : champ « texte » = « Entrée du raccourci »', dessin: 'json', titre: 'Méthode « POST », corps « JSON »',
    mots: ['« Méthode » : choisis « POST »', '« Corps de la requête » : choisis « JSON »', '« Ajouter un nouveau champ » → « Texte » : clé texte, valeur : la variable « Entrée du raccourci »', 'Si Raccourcis le propose : un 2ᵉ champ « Texte », clé expediteur, valeur : « Entrée du raccourci » réglée sur « Expéditeur » (facultatif, VRM lit aussi le texte)', 'Touche « OK » en haut à droite'] },
  // (9 nov.) Les SMS de Vestiaire Collective (« VestiaireCo ») ne contiennent pas « colis » :
  // une 2ᵉ automatisation, identique, sur le mot « article ».
  { cle: 'vestiaire', court: 'Pour Vestiaire : refais-la avec le mot « article »', dessin: 'message', titre: 'Vestiaire : une 2ᵉ automatisation sur « article »',
    mots: ['Refais les étapes 1 à 5 avec « Le message contient » : « article »', 'Elle attrape les SMS de VestiaireCo (« Votre article … vient d’etre vendu », « N’oubliez pas d’expédier votre article … »)', 'Chronopost : quand tu en reçois un, copie-le à VRM (il n’est pas encore appris : seul son n° est gardé, « à vérifier »)'] },
];

// (9 nov.) Les expéditeurs que VRM sait lire (api/_lib/sms-*.js) et ce qu'il en fait.
export const EXPEDITEURS_SMS = [
  { nom: 'MRELAY', quoi: 'Mondial Relay : colis arrivé au relais ou en casier, son code, le rappel' },
  { nom: 'VintedGo', quoi: 'Vinted Go : le code de retrait et la date limite (relié au colis qui porte ce code)' },
  { nom: 'Pickup', quoi: 'Pickup : le relais et le Pass à présenter (sans n° : jamais relié tout seul)' },
  { nom: 'VestiaireCo', quoi: 'Vestiaire : la marque vendue et la date limite d’envoi (sans n° de commande : jamais reliée toute seule)' },
  { nom: 'Chronopost', quoi: 'Chronopost : pas encore appris — son n° seul, « à vérifier »' },
];

// Ce que la carte dit du résultat d'un essai (la réponse de la route).
export function texteEssai(statut, j) {
  if (statut === 401) return { ok: false, t: 'Jeton pas reconnu : s’il vient d’être créé, attends quelques secondes qu’il soit enregistré, puis réessaie.' };
  if (statut === 503) return { ok: false, t: 'Le serveur de données n’a pas répondu : réessaie dans un instant.' };
  if (!j || !j.ok) return { ok: false, t: 'Essai raté : réessaie quand tu as du réseau.' };
  return { ok: true, t: String(j.message || 'Essai réussi (rien n’a été rangé)') };
}
