// ════════════════════════════════════════════════════════════════════════════
//  LA BARRE D'ONGLETS — son style (17 nov. soir). Julien, sur la planche des cinq propositions
//  (scratchpad barres/) : « prends la C et propose un menu déroulant, je choisirai le mieux ».
//  Cinq dessins d'UNE même barre (mêmes onglets, mêmes pastilles, même onglet allumé, mêmes cibles de 44) :
//    C · Épurée (défaut) — barre arrondie à 12 px des bords ; icônes seules, l'actif « icône + nom » dans une capsule teintée ;
//    A · iOS classique  — pleine largeur, verre, icône + nom ; l'actif à l'accent ;
//    B · Pilule flottante — l'actif dans une bulle pleine ;
//    D · Trait au-dessus  — barre pleine, un trait d'accent au-dessus de l'actif ;
//    E · Kraft           — les teintes de l'étiquette N°, un point ambre sous l'actif.
//  Le choix est une préférence SYNCHRONISÉE (`vrm_barre_style`, SYNC_KEYS d'App.jsx) : posé sur la racine
//  (`data-barre` sur <html>) dès l'import, appliqué tout de suite (aucun rechargement). Le dessin vit dans
//  src/designV2/barre.css (couche `vrm-v2`, la première nommée) : il vaut pour les DEUX designs (la coque est partagée).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './barre.css';

export const CLE_BARRE = 'vrm_barre_style';
export const STYLES_BARRE = ['C', 'A', 'B', 'D', 'E'];
export const BARRE_DEFAUT = 'C';
const EVT = 'vrm:barre-style';

// `save`/`load` d'App.jsx rangent en JSON : on lit les deux formes ('"A"' et 'A').
export function lireBarre() {
  try {
    const brut = localStorage.getItem(CLE_BARRE);
    if (brut == null) return BARRE_DEFAUT;
    let v = brut; try { v = JSON.parse(brut); } catch (_) { /* déjà une chaîne nue */ }
    return STYLES_BARRE.includes(v) ? v : BARRE_DEFAUT;
  } catch (_) { return BARRE_DEFAUT; }
}

function appliquer(v) { try { document.documentElement.setAttribute('data-barre', v); } catch (_) {} }
if (typeof document !== 'undefined') appliquer(lireBarre());

// Posé par SON choix (Paramètres → Apparence) ; `enregistrer` est le `save` d'App.jsx (qui synchronise).
export function poserBarre(v, enregistrer) {
  const x = STYLES_BARRE.includes(v) ? v : BARRE_DEFAUT;
  // Écrit TOUT DE SUITE ici (le `save` d'App.jsx écrit après un court délai : la barre relirait l'ancien choix),
  // puis confié à `save` pour la synchronisation.
  try { localStorage.setItem(CLE_BARRE, JSON.stringify(x)); } catch (_) {}
  try { if (enregistrer) enregistrer(CLE_BARRE, x); } catch (_) {}
  appliquer(x);
  try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
}

// Après la lecture du nuage : la valeur rangée ailleurs ne remplace que le défaut (jamais SON choix d'ici).
export function reprendreBarre() { appliquer(lireBarre()); try { window.dispatchEvent(new Event(EVT)); } catch (_) {} }

function abonner(f) {
  const g = (e) => { if (!e || e.type === EVT || e.key === CLE_BARRE) { appliquer(lireBarre()); f(); } };
  window.addEventListener(EVT, g); window.addEventListener('storage', g);
  return () => { window.removeEventListener(EVT, g); window.removeEventListener('storage', g); };
}
export function useBarre() { return React.useSyncExternalStore(abonner, lireBarre, () => BARRE_DEFAUT); }

// L'APERÇU du réglage : une barre en miniature, dessinée par les MÊMES règles (barre.css, `.v2-barre-apercu`).
export function ApercuBarre({ style, onglets, Icon }) {
  return (
    <div className="v2-barre-apercu" data-barre-apercu={style} aria-hidden="true">
      <div className="v2-barre-apercu-nav" data-barre={style}>
        {onglets.map((o, i) => (
          <span key={o.id} className={'v2-barre-apercu-t' + (i === 0 ? ' is-on' : '')}>
            <span className="v2-barre-apercu-ic"><Icon name={o.icon} size={20}/>{o.n ? <b>{o.n}</b> : null}</span>
            <span className="v2-barre-apercu-l">{o.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
