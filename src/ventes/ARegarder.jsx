// ── « N CHOSES À REGARDER » (16 nov., lot ventes-clair — captures iPhone de Julien) ──────────────────────
// Avant la première vente, Ventes empilait jusqu'à six cartes d'information (retirer l'argent, boosts, un compte
// qui annule plus, « 2032 prix d'achat à saisir », « Après frais de vente au plus … », « 1 bordereau à générer :
// via ton ordinateur ») : la liste arrivait après un écran et demi. Elles passent dans UN repli fermé,
// « 3 choses à regarder › » : RIEN n'est retiré ni recalculé (mêmes composants, mêmes data-*, mêmes gestes),
// on les ouvre d'un toucher. Le nombre est celui des cartes RENDUES (un composant qui n'a rien à dire rend
// `null` et ne compte pas) ; zéro ⇒ le repli ne se montre pas.
// ⚠️ Ce qui grise un bouton (la raison de l'extension, `RaisonBordereauxGrises` mode « grisé ») et une lecture
// ratée restent HORS du repli : un bouton grisé dit sa raison à l'écran (16 oct.), une panne se dit (§7).
import React from 'react';
import { tr } from '../i18n/index.js';

export function ARegarder({ children, initialOuvert = false }) {
  const corps = React.useRef(null);
  const [n, setN] = React.useState(null);
  const [ouvert, setOuvert] = React.useState(initialOuvert);
  React.useLayoutEffect(() => {
    const el = corps.current; if (!el) return undefined;
    const compter = () => { const k = [...el.children].filter((x) => x.childNodes.length || x.textContent.trim()).length; setN((v) => (v === k ? v : k)); };
    compter();
    let mo = null; try { mo = new MutationObserver(compter); mo.observe(el, { childList: true }); } catch (_) {}
    return () => { if (mo) mo.disconnect(); };
  }, []);
  return (
    <details className="vrm-ventes-regarder" data-ventes-regarder={n == null ? '' : String(n)} open={ouvert} hidden={n === 0 ? true : undefined}
      onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary className="vrm-ventes-regarder-tete" data-ventes-regarder-ouvrir="">
        <span className="vrm-ventes-regarder-point" aria-hidden="true"/>
        <span>{n ? tr('ventes.regarder', { n }) : tr('ventes.regarderVide')}</span>
        <span className="vrm-ventes-regarder-chev" aria-hidden="true">›</span>
      </summary>
      <div ref={corps} className="vrm-ventes-regarder-corps">{children}</div>
    </details>
  );
}
