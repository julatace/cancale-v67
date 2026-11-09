// ════════════════════════════════════════════════════════════════════════════
//  « VRM T'AIDE-T-IL ? » — LA NOTE DE SATISFACTION (9 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien veut piloter son entreprise : savoir si VRM aide vraiment ses vendeurs.
// Une question, UNE fois, discrète en bas de Ma journée : une note de 1 à 5 et
// un mot facultatif ; « Plus tard » (7 jours) et « Ne plus demander ».
//
// QUAND (règle pure, jugée ici, testée avec une horloge simulée) :
//   · jamais au PROPRIÉTAIRE de l'installation (c'est sa propre app) ; « pas su »
//     (abonnement pas lu) ⇒ on ne demande pas ;
//   · pas avant 14 jours d'usage : 14 jours depuis la CRÉATION du compte VRM
//     (la seule date d'arrivée que l'app connaît sans deviner) ;
//   · pas pendant les 3 premiers jours d'un abonnement PAYÉ : l'app ne connaît pas
//     la date du premier paiement — elle note le jour où elle a vu l'abonnement
//     payé pour la première fois (`payeVu`) et attend 3 jours à partir de là
//     (un abonné plus ancien attend donc 3 jours de trop : jamais trop tôt) ;
//   · une fois : répondu ou « Ne plus demander » ⇒ plus jamais ; « Plus tard » ⇒
//     7 jours de silence ;
//   · une lecture ratée de SA ligne ⇒ rien n'est montré (on ne redemande pas à
//     quelqu'un qui a peut-être déjà répondu).
//
// OÙ : SA ligne `vrm_satisfaction` (app_data, owner = lui, RLS). Le serveur
// (tableau du propriétaire, api/_lib/pilotage.js) ne projette QUE la note, le mot
// et la date — jamais le propriétaire de la ligne — et masque une adresse e-mail
// ou un numéro tapés dans le mot (`motSansIdentite`).
// ════════════════════════════════════════════════════════════════════════════

export const ID_SATISFACTION = 'vrm_satisfaction';
export const JOURS_USAGE = 14;
export const JOURS_APRES_PAIEMENT = 3;
export const JOURS_PLUS_TARD = 7;
export const MOT_MAX = 280;
export const COMMENTAIRES_MAX = 8;
const JOUR_MS = 864e5;
// Un abonnement PAYÉ (pas un essai) : Stripe prélève (`active`) ou réessaie (`past_due`).
export const STATUTS_PAYES = Object.freeze(['active', 'past_due']);

const ms = (iso) => { const t = Date.parse(String(iso || '')); return Number.isFinite(t) ? t : null; };
const objet = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

// Le mot tapé, nettoyé : sans caractères de contrôle, espaces resserrés, borné.
export function nettoyerMot(mot) {
  return String(mot == null ? '' : mot).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MOT_MAX);
}
// Ce que le tableau du propriétaire montre d'un mot : une adresse e-mail, un
// numéro de téléphone ou une longue suite de chiffres (n° de commande, de suivi)
// deviennent « … ». Un pseudo Vinted ne se reconnaît pas à coup sûr : le tableau
// ne montre jamais de qui vient un mot, seulement sa note et son jour.
export function motSansIdentite(mot) {
  return nettoyerMot(mot)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/https?:\/\/\S+/gi, '…')
    .replace(/\+?\d[\d .\-]{6,}\d/g, '…');
}
export const noteValide = (n) => Number.isInteger(n) && n >= 1 && n <= 5;

// Faut-il montrer la question ? → { montrer, raison }.
//   etat : la ligne lue (objet) · `null` absente · `undefined` pas su.
//   proprietaire : true · false · undefined (pas su).
//   statut : le statut d'abonnement lu (chaîne ou `null` sans abonnement) · `undefined` pas su.
export function questionDue({ maintenant = Date.now(), compteCreeLe, proprietaire, statut, etat } = {}) {
  if (proprietaire === true) return { montrer: false, raison: 'proprietaire' };
  if (proprietaire !== false) return { montrer: false, raison: 'pas-su' };
  if (etat === undefined) return { montrer: false, raison: 'pas-su' };
  const e = objet(etat);
  if (e.reponse && noteValide(Number(e.reponse.note))) return { montrer: false, raison: 'repondu' };
  if (ms(e.jamais) != null) return { montrer: false, raison: 'jamais' };
  const tard = ms(e.plusTard);
  if (tard != null && maintenant - tard < JOURS_PLUS_TARD * JOUR_MS) return { montrer: false, raison: 'plus-tard' };
  const cree = ms(compteCreeLe);
  if (cree == null) return { montrer: false, raison: 'pas-su' };
  if (maintenant - cree < JOURS_USAGE * JOUR_MS) return { montrer: false, raison: 'trop-tot' };
  if (statut === undefined) return { montrer: false, raison: 'pas-su' };
  if (STATUTS_PAYES.includes(String(statut || ''))) {
    const vu = ms(e.payeVu);
    if (vu == null || maintenant - vu < JOURS_APRES_PAIEMENT * JOUR_MS) return { montrer: false, raison: 'paiement-recent' };
  }
  return { montrer: true, raison: 'due' };
}

// Faut-il noter « payé vu » maintenant ? (une seule écriture, la première fois)
export const doitNoterPaye = (statut, etat) => etat !== undefined && STATUTS_PAYES.includes(String(statut || '')) && ms(objet(etat).payeVu) == null;

// La ligne après un geste. `null` = geste refusé (rien à écrire).
export function etatApres(etat, geste, { maintenant = Date.now(), note, mot } = {}) {
  const e = { ...objet(etat), v: 1 };
  const at = new Date(maintenant).toISOString();
  if (geste === 'plus-tard') return { ...e, plusTard: at };
  if (geste === 'jamais') return { ...e, jamais: at };
  if (geste === 'paye-vu') return ms(e.payeVu) == null ? { ...e, payeVu: at } : null;
  if (geste === 'repondre') {
    const n = Number(note);
    if (!noteValide(n)) return null;
    const m = nettoyerMot(mot);
    return { ...e, reponse: m ? { note: n, mot: m, at } : { note: n, at } };
  }
  return null;
}

// L'agrégat du tableau du propriétaire. `lignes` : [{ note, mot, at }] (projetées,
// SANS propriétaire). Rend { n, moyenne, repartition[5], commentaires[] }.
// Un commentaire garde sa note et son JOUR — ni heure, ni vendeur.
export function agregerNotes(lignes) {
  const rep = [0, 0, 0, 0, 0];
  const coms = [];
  let somme = 0, n = 0;
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const note = Number(l && l.note);
    if (!noteValide(note)) continue;
    n += 1; somme += note; rep[note - 1] += 1;
    const mot = motSansIdentite(l.mot);
    const t = ms(l.at);
    if (mot) coms.push({ note, mot, jour: t != null ? new Date(t).toISOString().slice(0, 10) : null, t: t || 0 });
  }
  coms.sort((a, b) => b.t - a.t);
  return {
    n,
    moyenne: n ? Math.round((somme / n) * 10) / 10 : null,
    repartition: rep,
    commentaires: coms.slice(0, COMMENTAIRES_MAX).map(({ note, mot, jour }) => ({ note, mot, jour })),
  };
}
