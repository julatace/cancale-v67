// ═══════════════════════════════════════════════════════════════════════════
// LA LETTRE D'ABORD, L'ÉCRAN ENSUITE (28 nov., vitesse-fluide)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré (banc iphone-rapide, ETAPES=gestes, 390 ×4, volume de Julien) : une lettre tapée dans la recherche d'Achats
// ré-rendait TOUT `Comptabilite` avant de s'afficher (INP médian ~180 ms, pire ~730 ms). Ici le champ garde SA valeur
// (la lettre est peinte tout de suite : mise à jour urgente d'un petit composant) et la transmet à l'écran dans une
// TRANSITION (`useTransition`) : React calcule l'écran en tâche interruptible, et une lettre tapée pendant ce calcul
// l'abandonne au lieu de l'attendre — seulement quand l'écran est LOURD (un rendu > 50 ms, mesuré à la frappe) ; un écran
// léger reçoit la lettre tout de suite, comme avant. Même valeur au bout, même filtre (la règle de l'écran ne change pas).
//
// La valeur de l'écran (`valeur`) fait foi dès qu'aucune transition n'est en cours : c'est alors exactement un champ
// contrôlé (l'écran a vidé le champ, la dictée, une valeur bornée ⇒ le champ la montre). Pendant la transition, le
// champ montre ce qui a été tapé (l'écran rend encore l'ancienne valeur, ou une lettre d'avant). Règle : `texteMontre`,
// testée par scripts/tests/saisie-differee-interface.cjs.
//
//   const [texte, envoyer] = useSaisieDifferee(valeur, onChange)
//   <input value={texte} onChange={(e) => envoyer(e.target.value)} />
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { flushSync } from 'react-dom';

const chaine = (v) => (v == null ? '' : String(v));
// Ce que le champ montre : ce qui a été tapé tant que l'écran le calcule, sinon la valeur de l'écran.
export function texteMontre({ tape, valeur, enCours }) { return enCours && tape != null ? chaine(tape) : chaine(valeur); }

// Un écran LÉGER (son rendu tient sous `SEUIL_LOURD_MS`) reçoit la lettre tout de suite, comme avant (synchrone : rien ne
// change pour lui) ; dès qu'un rendu dépasse le seuil, ce champ passe en transition pour la suite de sa vie.
export const SEUIL_LOURD_MS = 50;
export function useSaisieDifferee(valeur, onChange) {
  const [tape, poserTape] = React.useState(null);
  const [enCours, demarrer] = React.useTransition();
  const dernier = React.useRef(onChange); dernier.current = onChange;
  const lourd = React.useRef(false);
  const envoyer = React.useCallback((v) => {
    const s = chaine(v);
    const f = dernier.current;
    if (!f) { poserTape(s); return; }
    if (!lourd.current) {
      const t0 = performance.now();
      try { flushSync(() => { poserTape(s); f(s); }); } catch (_) { poserTape(s); f(s); }
      if (performance.now() - t0 > SEUIL_LOURD_MS) lourd.current = true;
      return;
    }
    poserTape(s);
    demarrer(() => { f(s); });
  }, []);
  return [texteMontre({ tape, valeur, enCours }), envoyer];
}

// Le même `<input>` (mêmes attributs, même dessin) dont la valeur part à l'écran dans une transition.
//   <InputDiffere value={q} onValeur={setQ} type="search" … />
export function InputDiffere({ value, onValeur, ...props }) {
  const [texte, envoyer] = useSaisieDifferee(value, onValeur);
  return <input {...props} value={texte} onChange={(e) => envoyer(e.target.value)}/>;
}
