// ── src/design/BarrePouce.jsx — MAQUETTE C3 « Studio × iOS » (17 nov.), réglage de BANC seulement ──
// Julien (17 nov.) : « change tout, même la disposition des boutons ». Monté par DisqueEventail quand
// `MAQUETTE_C3` (src/design/maquette.js) — qu'aucun écran ne pose : pour un vendeur, rien ne change.
//   • La BARRE AU POUCE, posée juste au-dessus de la tab bar : le geste principal du lieu EN GRAND (le même que
//     celui que le « + » nommait en C : Imprimer N · Publier · …), et un rond « Plus ».
//   • « Plus » ouvre UNE FEUILLE (glisse du bas, l'écran recule comme une carte iOS) qui regroupe les petits
//     boutons dispersés de l'écran. La feuille ne fabrique AUCUN geste : chaque ligne porte le nom (aria-label ou
//     texte) et l'icône du bouton d'origine, et le touche (`.click()`) — même règle, même garde, même confirmation.
//   • Les boutons d'origine sont cachés par src/design/maquette-c3.css (sélecteurs ci-dessous, les mêmes).
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';

// Le geste principal d'un écran qui n'est pas dans l'éventail : un bouton de l'écran, touché tel quel.
export const PRINCIPAL_ECRAN = {
  journee: '[data-sj-imprimer]',
  achats: '[data-glisser-ouvrir]',
};
// Les écrans sans geste principal (Argent se lit : « Plus » seul, en bas à droite).
export const SANS_PRINCIPAL = new Set(['compta', 'argent', 'stats']);
// Les petits boutons regroupés dans la feuille « Plus », par écran (dans l'ordre de la feuille).
export const SECONDAIRES = {
  journee: ['.vrm-main [data-aide-ouvrir]', '[data-ouvre-ma-semaine]', '.vrm-main [data-carte-modifier]'],
  ventes: ['.vrm-main [data-aide-ouvrir]', '.vrm-tache-retrouver [data-scan-retrouver-bouton]', '[data-colis-scanner]', '[data-colis-outils-bascule]'],
  annonces: ['.vrm-main [data-aide-ouvrir]', '[data-vue-selection]', '[data-vue-republier]', '[data-sb-vue-bascule]', '.vrm-ann-outils > button', '[data-ui-afaire]', '.vrm-main [data-carte-modifier]'],
  paires: ['.vrm-main [data-aide-ouvrir]', '[data-vue-selection]', '[data-vue-republier]', '[data-sb-vue-bascule]', '.vrm-ann-outils > button', '[data-ui-afaire]', '.vrm-main [data-carte-modifier]'],
  achats: ['.vrm-main [data-aide-ouvrir]', '.vrm-tache-retrouver [data-scan-retrouver-bouton]', '[data-serie-ouvrir]', '[data-achats-calculette]', '[data-achats-plus]', '.vrm-main [data-carte-modifier]'],
  compta: ['.vrm-main [data-aide-ouvrir]', '.vrm-main .vrm-screen-head .vrm-b-discret', '.vrm-main [data-carte-modifier]'],
};

const nomDe = (b) => {
  const a = (b.getAttribute('aria-label') || '').trim();
  const t = (b.innerText || b.textContent || '').trim().split('\n')[0].trim();
  return (a || t).replace(/\s+/g, ' ');
};

function lireBoutons(ecran) {
  const out = []; const vus = new Set();
  for (const sel of SECONDAIRES[ecran] || []) {
    let b = null; try { b = document.querySelector(sel); } catch (_) { b = null; }
    if (!b || vus.has(b) || b.disabled) continue;
    const nom = nomDe(b); if (!nom) continue;
    vus.add(b);
    const svg = b.querySelector('svg');
    out.push({ sel, nom, icone: svg ? svg.outerHTML : '' });
  }
  return out;
}

const ICONE_VIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>';

export function BarrePouce({ lieu, lames = [], lancer, ecran = '', Retour = null }) {
  const [feuille, setFeuille] = React.useState(false);
  const [boutons, setBoutons] = React.useState([]);
  const [principalEcran, setPrincipalEcran] = React.useState(null);
  // L'écran se monte après nous : on relit ses boutons un peu plus tard, et à chaque changement d'écran.
  React.useEffect(() => {
    setFeuille(false);
    let n = 0; let t = 0;
    const lire = () => {
      setBoutons(lireBoutons(ecran));
      const sel = PRINCIPAL_ECRAN[ecran];
      let b = null; if (sel) { try { b = document.querySelector(sel); } catch (_) { b = null; } }
      setPrincipalEcran(b ? { sel, nom: nomDe(b), icone: (b.querySelector('svg') || {}).outerHTML || '' } : null);
      if (++n < 8) t = setTimeout(lire, 500);
    };
    lire();
    return () => clearTimeout(t);
  }, [ecran]);
  React.useEffect(() => {
    const h = document.documentElement;
    if (feuille) h.setAttribute('data-m3-feuille', ''); else h.removeAttribute('data-m3-feuille');
    return () => h.removeAttribute('data-m3-feuille');
  }, [feuille]);
  const lame = !PRINCIPAL_ECRAN[ecran] && !SANS_PRINCIPAL.has(ecran) ? lames.find((l) => l.id === lieu) : null;
  const toucher = (sel) => { setFeuille(false); setTimeout(() => { try { const b = document.querySelector(sel); if (b) b.click(); } catch (_) {} }, 260); };
  if (typeof document === 'undefined') return null;
  const principal = principalEcran
    ? <button type="button" className="m3-principal" data-m3-principal="" onClick={() => toucher(principalEcran.sel)}>
        {principalEcran.icone ? <span className="m3-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: principalEcran.icone }}/> : null}
        <span>{principalEcran.nom}</span>
      </button>
    : lame
      ? <button type="button" className="m3-principal" data-m3-principal="" aria-label={lame.aria || lame.mot} aria-disabled={typeof lame.faire !== 'function' || undefined}
          onClick={() => lancer && lancer(lame)}>
          <span>{lame.mot}</span>{lame.sous ? <span className="m3-sous">{lame.sous}</span> : null}
        </button>
      : null;
  return createPortal(
    <>
      <div className="m3-pouce" data-m3-pouce={ecran}>
        {principal}
        {boutons.length ? (
          <button type="button" className="m3-plus" data-m3-plus="" aria-haspopup="dialog" aria-expanded={feuille} aria-label={tr('studio.c3.plusAria')} onClick={() => setFeuille(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>
            {!principal ? <span>{tr('studio.c3.plus')}</span> : null}
          </button>
        ) : null}
      </div>
      {feuille ? (
        <>
          <div className="m3-voile" onClick={() => setFeuille(false)} aria-hidden="true"/>
          <div className="m3-feuille" role="dialog" aria-modal="true" aria-label={tr('studio.c3.feuille')} data-m3-feuille-ouverte="">
            <div className="m3-poignee" aria-hidden="true"/>
            <div className="m3-feuille-tete">
              <span>{tr('studio.c3.feuille')}</span>
              <button type="button" className="m3-fermer" onClick={() => setFeuille(false)}>{tr('studio.c3.fermer')}</button>
            </div>
            <div className="m3-liste">
              {boutons.map((b) => (
                <button key={b.sel} type="button" className="m3-ligne" data-m3-ligne={b.sel} onClick={() => toucher(b.sel)}>
                  <span className="m3-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: b.icone || ICONE_VIDE }}/>
                  <span className="m3-mot">{b.nom}</span>
                </button>
              ))}
            </div>
            {Retour ? <Retour fermer={() => setFeuille(false)}/> : null}
          </div>
        </>
      ) : null}
    </>,
    document.body,
  );
}
