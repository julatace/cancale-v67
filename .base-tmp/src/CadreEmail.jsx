// ── LE MESSAGE D'ORIGINE, MIS EN PAGE COMME DANS MAIL (6 nov., décision de Julien) ──
// Le HTML d'origine ASSAINI (api/_lib/email-html.js) d'un e-mail « à geste »,
// affiché dans un CADRE ISOLÉ :
//   · `sandbox` SANS `allow-scripts` (aucun script ne peut s'exécuter dedans, quoi
//     qu'il reste dans le HTML) ni `allow-forms`, `allow-top-navigation`,
//     `allow-modals` ; `allow-popups` (+ `-to-escape-sandbox`) pour que ses liens
//     s'ouvrent dans un nouvel onglet, comme dans Mail ; `allow-same-origin` pour
//     que l'écran MESURE le document (hauteur, mise à l'échelle) — sans scripts dans
//     le cadre, cette origine ne sert qu'à l'écran ;
//   · `srcdoc` + la politique du cadre (src/cadreEmail.js) EN PLUS de celle de la
//     page (vercel.json, héritée par un `srcdoc`) ;
//   · à la LARGEUR de l'écran : un e-mail plus large que le cadre (600 px fixes) est
//     réduit à l'échelle, jamais coupé ni défilant de côté ; la hauteur suit le contenu ;
//     (11 nov.) sur ordinateur la colonne de lecture lui laisse sa taille NATURELLE
//     (échelle 1) ; la marge du cadre tombe avant qu'une échelle ne soit posée ;
//   · les images distantes ne partent que sur « Afficher les images » (une fois par
//     ouverture, jamais retenu) ; les pixels de suivi ont été retirés au serveur.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { documentCadre } from './cadreEmail.js';
import { tr } from './i18n/index.js';

export const SANDBOX_CADRE = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

export default function CadreEmail({ html, images = 0, sombreEmail = false, appSombre = false, titre = 'Message d’origine' }) {
  const [montrer, setMontrer] = useState(false);
  const cadre = useRef(null);
  const sombre = !!(sombreEmail && appSombre);
  const doc = useMemo(() => documentCadre(html, { images: montrer, sombre }), [html, montrer, sombre]);
  const mesurer = useCallback(() => {
    const f = cadre.current;
    let d = null;
    try { d = f && f.contentDocument; } catch (_) { d = null; }
    if (!f || !d || !d.body) return;
    try {
      // L'échelle se pose sur l'enveloppe, jamais sur `body` : le fond de l'e-mail
      // (posé sur body) remplit alors tout le cadre, même réduit.
      const b = d.querySelector('.vrm-cadre-corps') || d.body;
      b.style.transform = ''; b.style.width = ''; b.style.paddingLeft = ''; b.style.paddingRight = '';
      const large = f.clientWidth || 0;
      let contenu = Math.max(d.documentElement.scrollWidth, b.scrollWidth);
      // (11 nov.) Taille naturelle d'abord : si la marge intérieure du cadre suffit à
      // faire déborder l'e-mail (600 px fixes dans 610), on la retire avant toute échelle.
      if (large > 0 && contenu > large + 1) {
        b.style.paddingLeft = '0px'; b.style.paddingRight = '0px';
        contenu = Math.max(d.documentElement.scrollWidth, b.scrollWidth);
        if (contenu > large + 1) { b.style.paddingLeft = ''; b.style.paddingRight = ''; contenu = Math.max(d.documentElement.scrollWidth, b.scrollWidth); }
      }
      const r = large > 0 && contenu > large + 1 ? large / contenu : 1;
      if (r < 1) { b.style.transformOrigin = '0 0'; b.style.width = contenu + 'px'; b.style.transform = `scale(${r})`; }
      const h = Math.ceil(Math.max(b.scrollHeight, b.offsetHeight) * r);
      f.style.height = Math.max(60, h) + 'px';
      f.setAttribute('data-cadre-echelle', r < 1 ? r.toFixed(3) : '1');
    } catch (_) {}
  }, []);
  useEffect(() => {
    const f = cadre.current;
    if (!f || typeof ResizeObserver === 'undefined') return undefined;
    let largeur = f.clientWidth;
    const ro = new ResizeObserver(() => { if (f.clientWidth !== largeur) { largeur = f.clientWidth; mesurer(); } });
    ro.observe(f);
    return () => ro.disconnect();
  }, [mesurer]);
  return <div className="vrm-boite-cadre" data-cadre-email="" data-images={montrer ? 'montrees' : images > 0 ? 'bloquees' : 'aucune'}>
    {images > 0 && !montrer && <div className="vrm-boite-cadre-images" data-cadre-images-bloquees={images}>
      <span>{images > 1 ? tr('emails.imagesBloquees', { images: String(images) }) : tr('emails.1ImageBloquee')}</span>
      <button type="button" className="vrm-boite-second" data-cadre-afficher-images="" onClick={() => setMontrer(true)}>{tr('emails.afficherImages')}</button>
    </div>}
    <iframe ref={cadre} title={titre} className="vrm-boite-cadre-iframe" sandbox={SANDBOX_CADRE} srcDoc={doc} referrerPolicy="no-referrer"
      style={{ colorScheme: sombre ? 'light dark' : 'light' }} onLoad={mesurer}/>
  </div>;
}
