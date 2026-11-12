// ════════════════════════════════════════════════════════════════════════════
//  SE DÉCONNECTER SANS PERDRE UNE SAISIE (11 nov., revue de robustesse, point 13)
//
//  « Se déconnecter ? — Tes données restent dans VRM » : la déconnexion efface
//  les clés `vrm_` de l'appareil, FILE D'ENVOI comprise (`vrm_file_envoi`). Une
//  saisie faite hors réseau, ou dans la seconde d'avant, partait avec — sans un
//  mot. Désormais, avant de déconnecter : on COMPTE ce qui attend (la file, les
//  sauvegardes de 500 ms pas encore écrites) ; rien ⇒ la question d'avant ;
//  quelque chose ⇒ l'écran le DIT et propose « Envoyer d'abord » (on relance
//  l'envoi, on attend que la file soit vide, puis on déconnecte), « Me déconnecter
//  quand même » (perdu, dit), ou « Annuler ». Un envoi qui n'aboutit pas ne
//  déconnecte PAS : on reste connecté, la saisie reste sur l'appareil.
//
//  Module PUR (tout est passé en paramètre) : exécuté tel quel par
//  `scripts/audit-robustesse-donnees.cjs`.
// ════════════════════════════════════════════════════════════════════════════

export const TEXTES_DECONNEXION = {
  titre: (n) => `${n} changement${n > 1 ? 's' : ''} pas encore envoyé${n > 1 ? 's' : ''}`,
  desc: 'Ils ne sont que sur cet appareil. Se déconnecter les efface.',
  envoyer: 'Envoyer d’abord',
  quandMeme: 'Me déconnecter quand même',
  pasParti: 'Pas encore envoyé : vérifie le réseau. Tu restes connecté.',
};

// `compter()` → nombre de changements en attente (null = pas su : on le traite
// comme « peut-être », jamais comme 0) · `confirmerSimple()` → bool (la question
// d'avant, quand rien n'attend) · `demander(n)` → 'envoyer' | 'quand' | null ·
// `envoyer()` relance l'envoi · `attendre(ms)` · `deconnecter()` · `dire(texte)`.
// Rend 'deconnecte' | 'annule' | 'garde'.
export async function deconnecterSansPerte({ compter, confirmerSimple, demander, envoyer, attendre, deconnecter, dire, delaiMs = 15000, pasMs = 500 }) {
  const n0 = compter();
  if (n0 === 0) {
    if (confirmerSimple && !(await confirmerSimple())) return 'annule';
    deconnecter(); return 'deconnecte';
  }
  const choix = await demander(n0 == null ? 1 : n0);
  if (choix === 'quand') { deconnecter(); return 'deconnecte'; }
  if (choix !== 'envoyer') return 'annule';
  envoyer();
  for (let t = 0; t < delaiMs; t += pasMs) {
    await attendre(pasMs);
    if (compter() === 0) { deconnecter(); return 'deconnecte'; }
  }
  if (dire) dire(TEXTES_DECONNEXION.pasParti);
  return 'garde';
}
