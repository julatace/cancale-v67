// (14 nov., extension 5.377) Le réglage « Dire ce que l'extension capte », pour Paramètres :
// le même que la carte du logo (src/capteNotif/regle.js le partage avec l'extension).
import React from 'react';
import { capteCoupe, capteCoupeConnuDeLExtension, reglerCapte, abonnerReglageCapte } from './regle.js';

export function useReglageCapte() {
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const off = abonnerReglageCapte(maj);
    const t = setInterval(maj, 20000);   // l'état de l'extension est relu toutes les 20 s
    return () => { off(); clearInterval(t); };
  }, []);
  const on = !capteCoupe();
  return { on, connu: capteCoupeConnuDeLExtension(), basculer: () => { reglerCapte(on); } };
}
