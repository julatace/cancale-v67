// ── src/natif/Feuille.jsx — la feuille qui monte du bas (contrat NATIF.md §3) ────────────
// Un réglage court, une saisie, un choix : une feuille. (Une fiche ou un atelier : une <PagePoussee>.)
// Props :
//   ouverte    vrai / faux — la feuille se monte et se démonte toute seule (sortie animée)
//   onFermer   appelé par : la croix, le voile, le glissé vers le bas, Échap, le geste « retour »
//   titre      17/22 600, centré
//   detente    'auto' (la hauteur du contenu, défaut) | 'moitie' | 'pleine'
//   detentes   ['moitie', 'pleine'] ⇒ la poignée fait passer de l'une à l'autre (glisser, ou Entrée sur la poignée)
//   action     nœud en haut à gauche : UN <Bouton variante="texte">Annuler</Bouton> (rare ; la croix suffit)
//   pied       nœud collé en bas de la feuille : LE <Bouton variante="plein">…</Bouton> de la feuille
//   className, attrs
// Ce qu'elle fait seule : portail (un nœud gardé, rien n'est inséré sous <body> à l'ouverture), voile,
// piège de focus (Tab reste dedans, le focus revient d'où il venait), `FermeAuRetour` de l'app
// (src/ui/retour.jsx : le geste « retour » du téléphone ferme la feuille du dessus), zone sûre du bas,
// poignée glissable (suit le doigt 1:1, repart de la position AFFICHÉE si on la reprend en plein mouvement).
// À l'ordinateur (≥ 1024) : une carte centrée, sans poignée.
// Dans une feuille, les cartes sont en --n-carte-2 (le fond de la feuille est --n-carte) : rien à faire, c'est automatique.
// Exemple :
//   <Feuille ouverte={saisie} onFermer={() => setSaisie(false)} titre="Prix d'achat"
//            pied={<Bouton variante="plein" onClick={enregistrer}>Enregistrer</Bouton>}>
//     <Groupe><Rangee titre="Montant" valeur="45 €"/></Groupe>
//   </Feuille>
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { FermeAuRetourUi, retourDisponible } from '../ui/retour.jsx';
import { cx, focusables, mouvementReduit, portailNatif, useDernier } from './outils.js';
import { Glyphe } from './icones.jsx';

const DUREE_SORTIE = 300;
const ORDRE = ['moitie', 'pleine'];

export function Feuille({ ouverte = true, onFermer, titre = '', detente = 'auto', detentes = null, action = null, pied = null, className = '', attrs = null, children }) {
  const idTitre = React.useId();
  const ref = React.useRef(null), refVoile = React.useRef(null), geste = React.useRef(null), avant = React.useRef(null);
  const refFermer = useDernier(onFermer);
  const [monte, setMonte] = React.useState(ouverte);
  const [etat, setEtat] = React.useState(ouverte ? 'entree' : 'sortie');   // entree → ouverte → sortie
  const paliers = (detentes && detentes.length ? detentes : [detente]).filter((d) => d === 'auto' || ORDRE.includes(d));
  const [palier, setPalier] = React.useState(paliers.includes(detente) ? detente : paliers[0]);
  const fermer = React.useCallback(() => { const f = refFermer.current; if (f) f(); }, [refFermer]);

  // Monter / démonter, avec l'entrée et la sortie.
  React.useEffect(() => {
    if (ouverte) {
      setMonte(true); setEtat('entree');
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setEtat('ouverte')));
      return () => cancelAnimationFrame(r);
    }
    setEtat('sortie');
    const t = setTimeout(() => setMonte(false), mouvementReduit() ? 0 : DUREE_SORTIE);
    return () => clearTimeout(t);
  }, [ouverte]);

  // Le focus entre dans la feuille (sans faire défiler la page) et revient d'où il venait.
  React.useEffect(() => {
    if (!monte || !ouverte) return undefined;
    avant.current = document.activeElement;
    const el = ref.current;
    if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    return () => {
      const a = avant.current; avant.current = null;
      if (a && a.isConnected && typeof a.focus === 'function') { try { a.focus({ preventScroll: true }); } catch (_) {} }
    };
  }, [monte, ouverte]);

  const clavier = (e) => {
    if (e.key === 'Escape' && !retourDisponible()) { e.stopPropagation(); fermer(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(ref.current); if (!f.length) { e.preventDefault(); return; }
    const premier = f[0], dernier = f[f.length - 1], ici = document.activeElement;
    if (e.shiftKey && (ici === premier || ici === ref.current)) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && ici === dernier) { e.preventDefault(); premier.focus(); }
  };

  // La poignée : la feuille suit le doigt ; au lâcher, la vitesse décide (fermer, changer de détente, revenir).
  const poser = (y, anime) => {
    const el = ref.current; if (!el) return;
    el.style.transition = anime ? '' : 'none';
    el.style.transform = y ? `translate3d(0,${Math.round(y)}px,0)` : '';
    const v = refVoile.current;
    if (v) { v.style.transition = anime ? '' : 'none'; v.style.opacity = y > 0 ? String(Math.max(0, 1 - y / (el.offsetHeight || 1))) : ''; }
  };
  const bas = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = ref.current; if (!el) return;
    let depart = 0;
    try { depart = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0; } catch (_) {}
    geste.current = { id: e.pointerId, y0: e.clientY - depart, y: depart, pts: [{ y: e.clientY, t: e.timeStamp }], bouge: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const bouge = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    let y = e.clientY - g.y0;
    if (Math.abs(y) > 4) g.bouge = true;
    if (y < 0) y = y * 0.15;                                   // au-dessus : résistance (la détente se change au lâcher)
    g.y = y;
    g.pts.push({ y: e.clientY, t: e.timeStamp }); if (g.pts.length > 5) g.pts.shift();
    poser(y, false);
  };
  const haut = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    geste.current = null;
    const a = g.pts[0], b = g.pts[g.pts.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;      // px/ms, positif = vers le bas
    const h = ref.current ? ref.current.offsetHeight : 1;
    const k = paliers.indexOf(palier);
    if (e.type !== 'pointercancel' && g.bouge) {
      if (v < -0.4 || g.y < -24) { poser(0, true); if (k < paliers.length - 1) setPalier(paliers[k + 1]); return; }
      if (v > 0.5 || g.y > h * 0.35) {
        if (k > 0 && paliers[k - 1] !== 'auto' && g.y < h * 0.6 && v < 1.2) { poser(0, true); setPalier(paliers[k - 1]); return; }
        poser(0, true); fermer(); return;
      }
    }
    poser(0, true);
  };
  const poigneeClavier = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const k = paliers.indexOf(palier);
    if (paliers.length > 1) setPalier(paliers[(k + 1) % paliers.length]); else fermer();
  };

  if (!monte) return null;
  const cible = portailNatif(); if (!cible) return null;
  return createPortal(
    <div className="n-feuille-couche" data-n-etat={etat} data-n-feuille-couche="">
      {ouverte ? <FermeAuRetourUi fermer={fermer}/> : null}
      <div className="n-voile" ref={refVoile} onClick={fermer} aria-hidden="true"/>
      <div
        ref={ref}
        className={cx('n-feuille', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titre ? idTitre : undefined}
        aria-label={titre ? undefined : tr('natif.feuille.nom')}
        tabIndex={-1}
        data-n-detente={palier}
        data-feuille=""
        onKeyDown={clavier}
        {...(attrs || {})}
      >
        <div className="n-feuille-tete" onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}>
          <button type="button" className="n-feuille-poignee" aria-label={paliers.length > 1 ? tr('natif.feuille.agrandir') : tr('natif.fermer')} onKeyDown={poigneeClavier} onClick={(e) => { if (e.detail === 0) return; }}>
            <span className="n-feuille-poignee-trait" aria-hidden="true"/>
          </button>
          <div className="n-feuille-barre">
            <div className="n-feuille-gauche" onPointerDown={(e) => e.stopPropagation()}>{action}</div>
            {titre ? <h2 className="n-feuille-titre" id={idTitre}>{titre}</h2> : <span/>}
            <div className="n-feuille-droite">
              <button type="button" className="n-feuille-croix" aria-label={tr('natif.fermer')} onClick={fermer} onPointerDown={(e) => e.stopPropagation()}>
                <Glyphe nom="close" taille={16}/>
              </button>
            </div>
          </div>
        </div>
        <div className="n-feuille-corps">{children}</div>
        {pied ? <div className="n-feuille-pied">{pied}</div> : null}
      </div>
    </div>,
    cible,
  );
}

export default Feuille;
