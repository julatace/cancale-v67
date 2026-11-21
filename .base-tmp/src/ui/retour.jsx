// ── src/ui/retour.jsx — le vrai `FermeAuRetour` de l'app, prêté aux feuilles de src/ui ──
import React from 'react';
// (14 nov., correctif « À faire ») `FermeAuRetour` (le geste « retour » d'iPhone / Android, ← de
// l'ordinateur et Échap ferment la feuille du dessus ; la pile des feuilles ouvertes que lisent les
// messages) vit dans App.jsx, avec la coque qui gère l'historique. Les feuilles de src/ui ne peuvent
// pas importer App.jsx : App le POSE ici au chargement (`poserFermeAuRetour(FermeAuRetour)`), comme
// le relais `SheetShell` le passe à `SheetShellBase`. Rien de posé (un banc qui monte la brique seule) ⇒
// la feuille garde son Échap à elle et ne touche pas à l'historique.
let _impl = null;
export function poserFermeAuRetour(C) { _impl = typeof C === 'function' ? C : null; }
export function retourDisponible() { return !!_impl; }
export function FermeAuRetourUi({ fermer }) {
  const C = _impl;
  return C ? <C fermer={fermer}/> : null;
}
