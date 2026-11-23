// ── src/natif/ListeOrdonnee.jsx — une liste qu'on réordonne et qu'on complète (les réglages d'un écran, 19 nov.) ──
// Julien : « OK pour la personnalisation mais ça doit être bien fait ». Comme l'écran « Modifier » des widgets d'iOS :
//   · chaque élément : un rond − (retirer) ou + (ajouter), 44 × 44 ; son icône ; son nom ; une phrase ; un APERÇU de sa
//     valeur (« 102 € ») ; dans « Affichées », une POIGNÉE ≡ qu'on glisse au doigt ou à la souris ;
//   · glisser : l'élément suit le doigt, les autres s'écartent (250 ms, `prefers-reduced-motion` respecté) ; lâché, la
//     place est prise (`onDeplacer(de, vers)`) ;
//   · au clavier et au lecteur d'écran : la poignée est un bouton, ↑ ↓ la déplacent ; « Monter » / « Descendre » existent
//     aussi en boutons lus seulement par le lecteur d'écran.
// Props :
//   elements   [{ cle, nom, phrase, apercu, icone }]
//   mode       'montrees' (rond −, poignée) | 'ajout' (rond +)
//   onBasculer(cle)  le rond ; onDeplacer(de, vers)  la poignée (rangs dans `elements`)
//   libelles   { retirer(nom), ajouter(nom), deplacer(nom), monter, descendre }
//   attrs      data-* de la liste ; attrsElement(e) ⇒ data-* d'un élément
import React from 'react';
import { cx, mouvementReduit } from './outils.js';
import { Glyphe } from './icones.jsx';
import './complements.css';

export function ListeOrdonnee({ elements = [], mode = 'montrees', onBasculer, onDeplacer, libelles = {}, className = '', attrs = null, attrsElement = null }) {
  const ref = React.useRef(null);
  const [glisse, setGlisse] = React.useState(null);   // { i, dy, vers, h }
  const debut = React.useRef(null);
  const rangees = () => (ref.current ? [...ref.current.querySelectorAll(':scope > .n-ordre-element')] : []);
  // Les centres des rangées sont relevés AU DÉPART du glisser (pendant, les rangées bougent : on ne se mesure pas soi-même).
  const versDe = (i, dy) => {
    const C = debut.current && debut.current.centres; if (!C || C[i] == null) return i;
    const centre = C[i] + dy;
    let v = i;
    C.forEach((m, k) => { if (k < i && centre < m) v = Math.min(v, k); if (k > i && centre > m) v = Math.max(v, k); });
    return v;
  };
  const bas = (i) => (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const R = rangees(); const h = R[i] ? R[i].getBoundingClientRect().height : 0;
    debut.current = { i, y: e.clientY, h, centres: R.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }) };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    setGlisse({ i, dy: 0, vers: i, h });
  };
  const bouge = (e) => { const d = debut.current; if (!d) return; const dy = e.clientY - d.y; setGlisse({ i: d.i, dy, vers: versDe(d.i, dy), h: d.h }); };
  const haut = () => { const d = debut.current; debut.current = null; const g = glisse; setGlisse(null); if (d && g && g.vers !== g.i && onDeplacer) onDeplacer(g.i, g.vers); };
  const clavier = (i) => (e) => {
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onDeplacer && onDeplacer(i, i - 1); }
    else if (e.key === 'ArrowDown' && i < elements.length - 1) { e.preventDefault(); onDeplacer && onDeplacer(i, i + 1); }
  };
  // Pendant le glisser : l'élément suit le doigt, ceux entre son départ et sa place s'écartent d'une hauteur.
  const decalage = (k) => {
    if (!glisse) return 0;
    const { i, dy, vers, h } = glisse;
    if (k === i) return dy;
    if (i < vers && k > i && k <= vers) return -h;
    if (i > vers && k < i && k >= vers) return h;
    return 0;
  };
  return (
    <div ref={ref} className={cx('n-ordre', className)} role="list" data-n-glisse={glisse ? '' : undefined} data-n-reduit={mouvementReduit() ? '' : undefined} {...(attrs || {})}>
      {elements.map((x, k) => {
        const d = decalage(k);
        return (
          <div key={x.cle} role="listitem" className="n-ordre-element" data-n-tenu={glisse && glisse.i === k ? '' : undefined}
            data-n-d={d ? String(Math.round(d)) : undefined} ref={(el) => { if (el) el.style.setProperty('--n-ordre-d', d + 'px'); }} {...(attrsElement ? attrsElement(x) : {})}>
            <button type="button" className="n-ordre-rond" data-n-mode={mode} aria-label={mode === 'ajout' ? (libelles.ajouter ? libelles.ajouter(x.nom) : x.nom) : (libelles.retirer ? libelles.retirer(x.nom) : x.nom)}
              onClick={() => onBasculer && onBasculer(x.cle)}>
              <span className="n-ordre-signe" aria-hidden="true"/>
            </button>
            <span className="n-ordre-icone" aria-hidden="true">{x.icone}</span>
            <span className="n-ordre-textes">
              <span className="n-ordre-nom">{x.nom}</span>
              {x.phrase ? <span className="n-ordre-phrase">{x.phrase}</span> : null}
            </span>
            {x.apercu ? <span className="n-ordre-apercu">{x.apercu}</span> : null}
            {mode === 'montrees' ? (
              <>
                <button type="button" className="n-ordre-poignee" aria-label={libelles.deplacer ? libelles.deplacer(x.nom) : x.nom}
                  onPointerDown={bas(k)} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut} onKeyDown={clavier(k)}>
                  <Glyphe nom="menu" taille={18}/>
                </button>
                {k > 0 ? <button type="button" className="n-lu-seul" onClick={() => onDeplacer && onDeplacer(k, k - 1)}>{(libelles.monter || '↑') + ' · ' + x.nom}</button> : null}
                {k < elements.length - 1 ? <button type="button" className="n-lu-seul" onClick={() => onDeplacer && onDeplacer(k, k + 1)}>{(libelles.descendre || '↓') + ' · ' + x.nom}</button> : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default ListeOrdonnee;

// ── <Editable> — une carte de la grille en mode « Modifier » (à l'ordinateur, 19 nov.) ──
// Elle tremble légèrement (iOS), porte une croix pour la retirer, et se GLISSE à la souris ou au doigt sur une autre
// carte pour prendre sa place (`onDeposer(cle, cleCible)`). Hors mode : elle ne fait rien (ses enfants tels quels).
//   <Editable cle="stock" actif={modifier} libelleRetirer="Retirer Stock en ligne" onRetirer={…} onDeposer={…}>…</Editable>
export function Editable({ cle, actif = false, libelleRetirer = '', onRetirer = null, onDeposer = null, className = '', children }) {
  const ref = React.useRef(null);
  const etat = React.useRef(null);
  const [tenu, setTenu] = React.useState(false);
  const cible = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) { const e = el.closest && el.closest('[data-n-editable]'); if (e && e !== ref.current) return e; }
    return null;
  };
  const marquer = (e) => { for (const x of document.querySelectorAll('[data-n-editable][data-n-cible]')) if (x !== e) x.removeAttribute('data-n-cible'); if (e) e.setAttribute('data-n-cible', ''); };
  const bas = (e) => {
    if (!actif || (e.button != null && e.button !== 0) || (e.target.closest && e.target.closest('.n-editable-croix'))) return;
    e.preventDefault();
    etat.current = { x: e.clientX, y: e.clientY };
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    setTenu(true);
  };
  const bouge = (e) => {
    const d = etat.current; if (!d || !ref.current) return;
    ref.current.style.setProperty('--n-ordre-d', '0px');
    ref.current.style.setProperty('translate', `${e.clientX - d.x}px ${e.clientY - d.y}px`);
    marquer(cible(e.clientX, e.clientY));
  };
  const haut = (e) => {
    const d = etat.current; etat.current = null; setTenu(false);
    if (ref.current) ref.current.style.removeProperty('translate');
    const c = d ? cible(e.clientX, e.clientY) : null; marquer(null);
    if (c && onDeposer) onDeposer(cle, c.getAttribute('data-n-editable'));
  };
  return (
    <div ref={ref} className={cx('n-editable', className)} data-n-editable={cle} data-n-edition={actif ? '' : undefined} data-n-tenu={tenu ? '' : undefined}
      onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}>
      {actif && onRetirer ? <button type="button" className="n-editable-croix" aria-label={libelleRetirer} onClick={onRetirer}><span><Glyphe nom="close" taille={14}/></span></button> : null}
      {children}
    </div>
  );
}
