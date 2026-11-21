// ══════════════════════════════════════════════════════════════════════════════
// LA LIGNE « E-MAILS » D'UNE CARTE VINTED DE COMPTES LIÉS (6 nov., vague 2, point 5)
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré sur sa base le 5 nov. : trois comptes Vinted = 45 % des ventes, sans
// AUCUN e-mail reçu. La détection existait (`etatEmailsComptes`, App.jsx — une
// règle pour Paramètres → Notifications et Achats, §11) mais ne se voyait pas là
// où il regarde ses comptes. Cette ligne la PROJETTE, sans règle neuve :
//   · `recoit`     ⇒ « reçoit ses e-mails » ;
//   · `muet`       ⇒ « aucun e-mail depuis N j » + le geste « Relier sa boîte »
//                    (N = depuis son dernier signe de vie ; jamais reçu ⇒ depuis sa
//                    première vente qui aurait dû en produire un — la PREUVE) ;
//   · `surveiller` ⇒ des ventes sans e-mail, pas assez pour conclure (dit tel quel) ;
//   · `calme`      ⇒ aucune vente depuis le début de la réception : rien à attendre ;
//   · `exclu`      ⇒ rien (un compte hors des totaux ne se juge pas) ;
//   · pas su (réception ou ventes pas lues) ⇒ « — pas su », jamais « reçoit » ni
//     « aucun » (« rien lu » ne vaut pas « rien », §5).
// Pur : aucune lecture, aucun React.
// ══════════════════════════════════════════════════════════════════════════════

export const JOUR_MS = 86400000;

// `etat` : l'état GLOBAL de la règle (`encours` · `pasSu` · `lu`) ; `l` : la ligne du compte.
// Rend { etat, texte, geste } ou `null` (rien à écrire).
export function ligneEmailsCompte(etat, l, maintenant = Date.now()) {
  if (etat === undefined || etat === 'encours') return { etat: 'encours', texte: 'Lecture en cours…', geste: false };
  if (etat === 'pasSu' || etat === null) return { etat: 'passu', texte: '— pas su pour l’instant', geste: false };
  if (!l || typeof l !== 'object') return null;
  switch (l.statut) {
    case 'recoit':
      return { etat: 'recoit', texte: 'reçoit ses e-mails', geste: false };
    case 'muet': {
      const t = Date.parse(l.depuis || l.premiereSansEmail || '');
      const j = Number.isFinite(t) ? Math.max(1, Math.floor((maintenant - t) / JOUR_MS)) : null;
      return { etat: 'muet', texte: j != null ? `aucun e-mail depuis ${j} j` : 'aucun e-mail reçu', geste: true, jours: j };
    }
    case 'surveiller':
      return { etat: 'surveiller', texte: 'des ventes sans e-mail — pas encore de quoi conclure', geste: false };
    case 'calme':
      return { etat: 'calme', texte: 'aucune vente depuis le début de la réception — rien à attendre', geste: false };
    case 'encours':
      return { etat: 'encours', texte: 'Lecture en cours…', geste: false };
    case 'pasSu':
      return { etat: 'passu', texte: '— pas su (ventes pas lues)', geste: false };
    default:
      return null;   // `exclu` : hors des totaux, rien n'est jugé
  }
}
