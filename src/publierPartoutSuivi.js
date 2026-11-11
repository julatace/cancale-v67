// ── « PUBLIER PARTOUT » DANS LE SUIVI COMMUN (SuiviTravail) — 11 nov. ─────────
// Julien : « pendant la publication, VRM reste FIGÉ, avec le détail de chaque
// étape et une barre de progression ». Le composant commun est construit sur la
// branche claude/suivi-travail (src/suiviTravail.js : `suivi.demarrer(...)` rend un
// pilote). Ce module ne refait AUCUN suivi : il traduit les états de
// `executerPartout` (src/publierPartout.js) en gestes du pilote.
//   envoi      ⇒ debut + étape « envoi »
//   attente    ⇒ étape « depot » (le dépôt est ouvert sur le site, avec ce qui reste à y choisir)
//   publie     ⇒ fin « ok »
//   a-finir    ⇒ fin « main » (à finir sur le site : jamais « fait »)
//   refuse     ⇒ fin « refus » + sa raison
//   pas-envoye ⇒ fin « saute » + sa raison
// « Pause » / « Arrêter » du suivi : lus ENTRE deux envois (`continuer()` : la pause attend Reprendre).
// Module PUR : `suivi` est passé en argument (null ⇒ aucun suivi, la feuille
// garde son propre état par case) ; scripts/audit-publier-partout.cjs l'exécute.
import { NOM_PARTOUT } from './publierPartout.js';

export const ETAPES_PARTOUT = Object.freeze([['envoi', 'Envoi'], ['depot', 'Dépôt sur le site']]);
const FIN = { publie: 'ok', 'a-finir': 'main', refuse: 'refus', 'pas-envoye': 'saute' };

// plan : sortie `planPartout`. Rend { surEtat, doitSArreter, terminer, pilote } ou
// null quand le suivi n'est pas là (ou qu'un autre travail tourne déjà).
export function suiviPourPartout(suivi, plan, { titre = 'Publier partout', uid = '', surGeste } = {}) {
  if (!suivi || typeof suivi.demarrer !== 'function') return null;
  const articles = (Array.isArray(plan) ? plan : []).map((e) => ({ id: e.cle, num: e.num, titre: `${e.titre || ''} → ${NOM_PARTOUT[e.site] || e.site}`.trim() }));
  let p = null;
  try { p = suivi.demarrer({ sorte: 'publier-partout', titre, etapes: ETAPES_PARTOUT, articles, uid, surGeste }); } catch (_) { p = null; }
  if (!p) return null;
  const vus = new Set();
  const surEtat = (cle, e) => {
    const et = e && e.etat;
    try {
      if (et === 'envoi') { vus.add(cle); p.debut(cle); p.etape(cle, 'envoi'); return; }
      if (et === 'attente') { p.etape(cle, 'depot', e.raison || ''); return; }
      const fin = FIN[et];
      if (fin) { if (!vus.has(cle) && fin !== 'saute') p.debut(cle); p.fin(cle, { etat: fin, raison: (e && e.raison) || '', geste: (e && e.geste) || '' }); }
    } catch (_) {}
  };
  return {
    pilote: p,
    surEtat,
    // ENTRE deux envois : `continuer()` du suivi (sur « pause », attend Reprendre / Arrêter) ;
    // un suivi d'avant sans `continuer` : `doitSArreter()`.
    doitSArreter: async () => {
      try { if (typeof p.continuer === 'function') return !(await p.continuer()); return !!p.doitSArreter(); } catch (_) { return true; }
    },
    terminer: (raison) => { try { p.terminer(raison || ''); } catch (_) {} },
  };
}
