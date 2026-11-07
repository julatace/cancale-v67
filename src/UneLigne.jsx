// ════════════════════════════════════════════════════════════════════════════
//  UNE LIGNE, COUPÉE À LA FIN D'UN MOT (1er nov., Ma journée)
//  Julien : « transporteur pa… », « Tabavap 5 · Ph… » — une ligne coupée au
//  milieu d'un mot ne se lit pas. Ce texte tient sur UNE ligne : s'il est trop
//  long pour sa boîte, il s'arrête au dernier MOT entier, suivi de « … » ; le
//  texte entier reste dans l'infobulle (`title`) et pour le lecteur d'écran
//  (porté par le bouton qui le contient). Rien n'est recalculé : c'est la même
//  phrase, raccourcie à l'affichage seulement.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

const SEPARATEURS_FIN = /[\s·,:;—–-]+$/u;

export function couperAuMot(mots, n) {
  return mots.slice(0, n).join(' ').replace(SEPARATEURS_FIN, '') + '…';
}

// `lignesTel` : au téléphone (< 768 px), le texte peut prendre N lignes avant d'être
// coupé (un détail qui porte un N°, une heure limite, un nom de paire) ; ailleurs, une.
const auTel = () => { try { return window.matchMedia('(max-width: 767px)').matches; } catch (_) { return false; } };

// (7 nov., vitesse) LES MESURES SONT GROUPÉES. Avant : chaque ligne posait son
// texte puis relisait la mise en page, à son tour, et une recherche par moitiés
// pour celles qui débordaient — une mise en page forcée par ligne et par essai
// (Ma journée : ~1,4 s de gel mesuré au téléphone, CPU ×4). Maintenant les lignes
// d'un même rendu sont traitées ensemble avant l'affichage : toutes les écritures,
// puis UNE lecture ; seules celles qui débordent cherchent leur coupe. Même règle
// de coupe (le dernier mot entier qui tient), vérifiée dans la page.
const file = new Map();          // élément → ses gestes
const vivantes = new Map();      // élément → ses gestes (pour le retour des polices)
let prevu = false;
// La largeur d'un texte mesurée sur un canevas : aucune mise en page de la page.
let _ctx;
const largeurTexte = (police, espacement, txt) => {
  if (_ctx === undefined) { try { _ctx = document.createElement('canvas').getContext('2d') || null; } catch (_) { _ctx = null; } }
  if (!_ctx) return null;
  _ctx.font = police;
  return _ctx.measureText(txt).width + espacement * txt.length;
};
const vider = () => {
  prevu = false;
  const items = [...file.values()];
  file.clear();
  for (const j of items) if (j.el.isConnected) j.poser();           // 1. écritures
  const aCouper = [];
  for (const j of items) {                                           // 2. une lecture
    if (!j.el.isConnected) continue;
    j.w = j.el.clientWidth;
    if (!j.tient()) { j.mesurer(); aCouper.push(j); }
  }
  for (const j of aCouper) j.proposer();                             // 3. coupe calculée, sans mise en page
  const aReprendre = aCouper.filter((j) => !j.tient());              // 4. une vérification
  for (const j of aReprendre) j.couper();                            //    (rare) la recherche dans la page
};
const planifier = (j) => {
  file.set(j.el, j);
  if (prevu) return;
  prevu = true;
  try { queueMicrotask(vider); } catch (_) { Promise.resolve().then(vider); }
};
// Les polices arrivent après le premier rendu : la largeur d'un mot change. Une
// seule attente pour toutes les lignes ; une ligne montée après n'a rien à refaire.
let policesPretes = false;
let attentePolices = false;
const attendrePolices = () => {
  if (attentePolices || policesPretes) return;
  attentePolices = true;
  try {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { policesPretes = true; for (const j of vivantes.values()) planifier(j); });
    else policesPretes = true;
  } catch (_) { policesPretes = true; }
};

export function UneLigne({ texte, className = '', lignesTel = 1, ...rest }) {
  const ref = React.useRef(null);
  const t = texte == null ? '' : String(texte);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const tient = () => (el.getAttribute('data-lignes') !== '1' ? el.scrollHeight <= el.clientHeight + 1 : el.scrollWidth <= el.clientWidth + 1);
    const j = {};
    Object.assign(j, {
      el, w: -1, tient,
      poser: () => {
        el.setAttribute('data-lignes', String(lignesTel > 1 && auTel() ? lignesTel : 1));
        el.textContent = t;
        el.removeAttribute('data-une-ligne-coupee');
      },
      // Une ligne : la police et la place lues une fois (phase de lecture), la coupe
      // cherchée sur le canevas ; la page vérifie ensuite (repli : `couper`).
      mesurer: () => {
        j.mesure = null;
        if (el.getAttribute('data-lignes') !== '1') return;
        try {
          const cs = getComputedStyle(el);
          const police = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const ls = parseFloat(cs.letterSpacing);
          const dispo = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
          if (dispo > 0) j.mesure = { police, espacement: Number.isFinite(ls) ? ls : 0, dispo };
        } catch (_) {}
      },
      proposer: () => {
        const m = j.mesure;
        const mots = t.split(/\s+/);
        if (!m || largeurTexte(m.police, m.espacement, 'x') == null) { j.couper(); return; }
        let lo = 1, hi = mots.length - 1, meilleur = couperAuMot(mots, 1);
        while (lo <= hi) {
          const mi = (lo + hi) >> 1;
          const c = couperAuMot(mots, mi);
          if (largeurTexte(m.police, m.espacement, c) <= m.dispo + 1) { meilleur = c; lo = mi + 1; } else hi = mi - 1;
        }
        el.textContent = meilleur;
        el.setAttribute('data-une-ligne-coupee', '');
      },
      couper: () => {
        const mots = t.split(/\s+/);
        let lo = 1, hi = mots.length - 1, meilleur = couperAuMot(mots, 1);
        while (lo <= hi) {
          const mi = (lo + hi) >> 1;
          el.textContent = couperAuMot(mots, mi);
          if (tient()) { meilleur = el.textContent; lo = mi + 1; } else hi = mi - 1;
        }
        el.textContent = meilleur;
        el.setAttribute('data-une-ligne-coupee', '');
      },
    });
    vivantes.set(el, j);
    planifier(j);
    attendrePolices();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (j.w < 0 || Math.abs(el.clientWidth - j.w) < 1) return; j.w = el.clientWidth; planifier(j); });
      ro.observe(el);
    }
    return () => { vivantes.delete(el); file.delete(el); if (ro) ro.disconnect(); };
  }, [t, lignesTel]);
  return <span ref={ref} className={'vrm-une-ligne ' + className} data-lignes="1" {...rest}>{t}</span>;
}
