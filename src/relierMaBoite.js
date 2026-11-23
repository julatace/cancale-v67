// ══════════════════════════════════════════════════════════════════════════════
// « RELIER MA BOÎTE », ACCOMPAGNÉ (19 nov., lot emails-mail) — les étapes, pures
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 19 nov. : « Relier la boîte mail à l'application : un processus beaucoup plus accompagné,
// beaucoup plus simple. » ⇒ UNE étape par écran, par messagerie (Gmail, Outlook, iCloud, puis Orange,
// Free, Yahoo ou une autre derrière « Autre »), chacune avec une capture DESSINÉE (aucune vraie capture,
// aucun logo : une fenêtre neutre « exemple ») et UN geste (ouvrir la bonne page, copier l'adresse VRM,
// copier « vinted », le code que la messagerie envoie à l'adresse VRM, affiché tout seul).
// Puis l'e-mail d'essai, guetté en direct par la route EXISTANTE (`email-rattacher?mode=adresse-unique`,
// src/adresseReception.js : `etatEssai`, une identité — le code de l'objet — jamais une heure).
//
// Ce fichier ne lit RIEN et n'écrit RIEN : il dit les étapes (clés de traduction, scènes). La règle de
// l'adresse vit au serveur (api/_lib/adresse-reception.js) ; la preuve d'adresse, par lien, reste celle
// d'aujourd'hui (api/_lib/preuve-adresse.js) — ce parcours n'y touche pas.
// Chemins de menu : ceux de src/adresseReception.js (pages d'aide officielles relevées le 6 et le 10 nov.).
// ══════════════════════════════════════════════════════════════════════════════
import { FOURNISSEURS, messagerieDeDomaine, messagerieDetectee } from './adresseReception.js';

// Les quatre tuiles du premier écran ; « autre » ouvre la liste des autres messageries.
export const TUILES = ['gmail', 'outlook', 'icloud', 'autre'];
export const AUTRES = ['orange', 'free', 'yahoo', 'inconnue'];

const lien = (id) => (FOURNISSEURS.find((f) => f.id === id) || {}).lien || '';

// Une étape d'une messagerie :
//   cle    `relier.<messagerie>.<n>` ⇒ `.titre` et `.phrase` dans le dictionnaire
//   geste  'ouvrir' (la page de réglages, `lien`) · 'copier' (l'adresse VRM) · 'vinted' (le mot) · 'code' · ''
//   scene  la capture dessinée : { k: 'menu'|'champ'|'code'|'coche'|'regle', items: [clés], surligne: i }
export const ETAPES_MESSAGERIE = {
  gmail: [
    { cle: 'relier.gmail.1', geste: 'ouvrir', lien: lien('gmail'), scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.libelles', 'relier.sc.transfertGmail', 'relier.sc.filtres'], surligne: 2 } },
    { cle: 'relier.gmail.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.ajouterTransfert', 'relier.sc.suivant'] } },
    { cle: 'relier.gmail.3', geste: 'code', scene: { k: 'code', items: ['relier.sc.codeConfirmation', 'relier.sc.valider'] } },
    { cle: 'relier.gmail.4', geste: '', scene: { k: 'coche', items: ['relier.sc.desactiver', 'relier.sc.transfererCopie', 'relier.sc.enregistrer'], surligne: 1 } },
  ],
  outlook: [
    { cle: 'relier.outlook.1', geste: 'ouvrir', lien: lien('outlook'), scene: { k: 'menu', items: ['relier.sc.disposition', 'relier.sc.regles', 'relier.sc.transfert', 'relier.sc.comptes'], surligne: 2 } },
    { cle: 'relier.outlook.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.activerTransfert', 'relier.sc.enregistrer'] } },
    { cle: 'relier.outlook.3', geste: '', scene: { k: 'coche', items: ['relier.sc.activerTransfert', 'relier.sc.conserverCopie', 'relier.sc.enregistrer'], surligne: 1 } },
  ],
  icloud: [
    { cle: 'relier.icloud.1', geste: 'ouvrir', lien: lien('icloud'), scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.comptes', 'relier.sc.regles', 'relier.sc.disposition'], surligne: 2 } },
    { cle: 'relier.icloud.2', geste: 'vinted', scene: { k: 'regle', items: ['relier.sc.siDe', 'relier.sc.contient'] } },
    { cle: 'relier.icloud.3', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.transfererA', 'relier.sc.enregistrer'] } },
  ],
  orange: [
    { cle: 'relier.orange.1', geste: 'ouvrir', lien: lien('orange'), scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.transfererMails', 'relier.sc.filtres'], surligne: 1 } },
    { cle: 'relier.orange.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.envoyerCopie', 'relier.sc.valider'] } },
  ],
  free: [
    { cle: 'relier.free.1', geste: 'ouvrir', lien: lien('free'), scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.mail', 'relier.sc.filtres'], surligne: 1 } },
    { cle: 'relier.free.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.faireSuivre', 'relier.sc.enregistrer'] } },
  ],
  yahoo: [
    { cle: 'relier.yahoo.1', geste: 'ouvrir', lien: lien('yahoo'), scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.boites', 'relier.sc.filtres'], surligne: 1 } },
    { cle: 'relier.yahoo.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.adresseTransfert', 'relier.sc.verifier'] } },
    { cle: 'relier.yahoo.3', geste: 'code', scene: { k: 'code', items: ['relier.sc.lienRecu', 'relier.sc.enregistrer'] } },
  ],
  inconnue: [
    { cle: 'relier.inconnue.1', geste: '', scene: { k: 'menu', items: ['relier.sc.general', 'relier.sc.transfert', 'relier.sc.filtres'], surligne: 1 } },
    { cle: 'relier.inconnue.2', geste: 'copier', scene: { k: 'champ', items: ['relier.sc.transfererA', 'relier.sc.enregistrer'] } },
    { cle: 'relier.inconnue.3', geste: 'code', scene: { k: 'code', items: ['relier.sc.codeConfirmation', 'relier.sc.valider'] } },
  ],
};

// Le nom affiché de chaque messagerie (une marque se nomme, elle ne se traduit pas).
export const NOM_MESSAGERIE = { gmail: 'Gmail', outlook: 'Outlook', icloud: 'iCloud Mail', orange: 'Orange', free: 'Free', yahoo: 'Yahoo' };

// La messagerie de src/adresseReception.js → celle du parcours (« autre » = une messagerie inconnue).
export function messagerieDuParcours(id) {
  if (ETAPES_MESSAGERIE[id]) return id;
  return id === 'autre' ? 'inconnue' : '';
}

// La messagerie proposée d'emblée : celle de l'adresse du compte choisi (son domaine), sinon la plus
// présente parmi SES adresses connues. Jamais devinée autrement ; un relais d'Apple n'est pas une boîte.
export function messagerieProposee({ compteAdresse = '', adresses = [] } = {}) {
  const m = messagerieDeDomaine(compteAdresse);
  if (m && m !== 'relais-apple' && m !== 'autre') return m;
  return messagerieDetectee(adresses) || '';
}

// Le fil du parcours : la liste des écrans, dans l'ordre.
//   'messagerie' → 'adresse' → les étapes de la messagerie → 'essai' → 'recu'
export function filDuParcours(messagerie) {
  const m = messagerieDuParcours(messagerie);
  const etapes = m ? ETAPES_MESSAGERIE[m].map((e, i) => ({ id: `${m}.${i + 1}`, k: 'messagerie-etape', ...e })) : [];
  return [{ id: 'messagerie', k: 'messagerie' }, { id: 'adresse', k: 'adresse' }, ...etapes, { id: 'essai', k: 'essai' }, { id: 'recu', k: 'recu' }];
}

// L'écran à montrer. La PREUVE lue passe devant le pas où il s'était arrêté : l'essai reçu (ou le compte
// relié) ⇒ « Reçu » ; une messagerie inconnue ⇒ son choix. Jamais au-delà de « essai » sans preuve.
export function ecranCourant({ fil, voulu, recu }) {
  const n = fil.length;
  if (recu) return n - 1;
  const i = fil.findIndex((x) => x.id === voulu);
  if (i < 0) return 0;
  return Math.min(i, n - 2);
}

// « Étape 3 sur 6 » : le choix de la messagerie et « Reçu » ne se comptent pas.
export function compteEtapes(fil, i) {
  const total = Math.max(1, fil.length - 2);
  const n = Math.min(total, Math.max(0, i));
  return { n, total };
}

// La reprise (un confort sur CET appareil ; la preuve est au serveur).
export const CLE_REPRISE = 'vrm_relier_ma_boite';
export function repriseLue(brut, adresse) {
  try {
    const x = typeof brut === 'string' ? JSON.parse(brut) : brut;
    if (!x || typeof x !== 'object' || x.adresse !== adresse) return null;
    const m = messagerieDuParcours(x.messagerie) || '';
    return { messagerie: m, ecran: typeof x.ecran === 'string' ? x.ecran : 'messagerie' };
  } catch (_) { return null; }
}
