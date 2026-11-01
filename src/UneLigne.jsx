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

export function UneLigne({ texte, className = '', lignesTel = 1, ...rest }) {
  const ref = React.useRef(null);
  const t = texte == null ? '' : String(texte);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const tient = () => (el.getAttribute('data-lignes') !== '1' ? el.scrollHeight <= el.clientHeight + 1 : el.scrollWidth <= el.clientWidth + 1);
    const ajuster = () => {
      el.setAttribute('data-lignes', String(lignesTel > 1 && auTel() ? lignesTel : 1));
      el.textContent = t;
      el.removeAttribute('data-une-ligne-coupee');
      if (tient()) return;
      const mots = t.split(/\s+/);
      let lo = 1, hi = mots.length - 1, meilleur = couperAuMot(mots, 1);
      while (lo <= hi) {
        const mi = (lo + hi) >> 1;
        el.textContent = couperAuMot(mots, mi);
        if (tient()) { meilleur = el.textContent; lo = mi + 1; } else hi = mi - 1;
      }
      el.textContent = meilleur;
      el.setAttribute('data-une-ligne-coupee', '');
    };
    ajuster();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      let w = el.clientWidth;
      ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) < 1) return; w = el.clientWidth; ajuster(); });
      ro.observe(el);
    }
    // Les polices arrivent après le premier rendu : la largeur d'un mot change.
    let vivant = true;
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (vivant) ajuster(); }); } catch (_) {}
    return () => { vivant = false; if (ro) ro.disconnect(); };
  }, [t, lignesTel]);
  return <span ref={ref} className={'vrm-une-ligne ' + className} data-lignes="1" {...rest}>{t}</span>;
}
