// ── « MODIFIER MA JOURNÉE » : l'éditeur (11 nov. 2026, lot journee-perso) ──────
// La liste des cartes de Ma journée, zone par zone (En haut · À faire · En bas) :
// un interrupteur par carte, une poignée pour la déplacer — au DOIGT (glisser la
// poignée, la ligne suit) et au CLAVIER (flèches haut/bas, Début/Fin, annoncé).
// « Revenir au réglage d'origine » efface tout ce qu'il a touché. Chaque geste
// s'enregistre tout de suite (`poser`, synchronisé par l'app). La règle (ordre,
// visibilité, urgences) est src/journeePerso.js : ce fichier ne fait que la montrer.
import React from 'react';
import { BoutonBase } from './composants/Bouton.jsx';
import { CARTES_JOURNEE, ZONES_JOURNEE, ordreJournee, visibiliteCarte, basculerCarte, deplacerCarte, revenirOrigine, estOrigine, carteJournee } from './journeePerso.js';

const Poignee = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
    <circle cx="6.5" cy="4" r="1.5"/><circle cx="11.5" cy="4" r="1.5"/>
    <circle cx="6.5" cy="9" r="1.5"/><circle cx="11.5" cy="9" r="1.5"/>
    <circle cx="6.5" cy="14" r="1.5"/><circle cx="11.5" cy="14" r="1.5"/>
  </svg>
);

export function JourneePersoEditeur({ reglage, poser, mode, accent = '#0071E3', eteint = 'rgba(0,0,0,.16)', toast }) {
  const [annonce, setAnnonce] = React.useState('');
  const [glisse, setGlisse] = React.useState(null);
  const focusApres = React.useRef(null);
  const racine = React.useRef(null);
  const r = reglage;
  // Après un déplacement au clavier, la poignée garde le focus (React a déplacé la ligne).
  React.useLayoutEffect(() => {
    const id = focusApres.current; if (!id || !racine.current) return;
    focusApres.current = null;
    const el = racine.current.querySelector(`[data-jp-poignee="${id}"]`);
    if (el && document.activeElement !== el) { try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } }
  });
  const dire = (id, zone, i) => { const c = carteJournee(id); setAnnonce(`${c ? c.nom : id} : ${i + 1}ᵉ sur ${ordreJournee(zone, r).length}`); };
  const deplacer = (id, zone, vers, clavier) => {
    const n = deplacerCarte(r, id, vers);
    if (n === r) return;
    if (clavier) focusApres.current = id;
    poser(n);
    dire(id, zone, ordreJournee(zone, n).indexOf(id));
  };
  const auClavier = (e, id, zone) => {
    const liste = ordreJournee(zone, r), i = liste.indexOf(id);
    const vers = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? liste.length - 1 : null;
    if (vers == null) return;
    e.preventDefault();
    if (vers < 0 || vers >= liste.length) { dire(id, zone, i); return; }
    deplacer(id, zone, vers, true);
  };
  // Au doigt (ou à la souris) : la poignée capte le pointeur ; la ligne prend la place
  // que le doigt désigne (le milieu de chaque autre ligne fait la frontière).
  const glisser = (e, id, zone) => {
    if (e.button != null && e.button !== 0) return;
    const ul = e.currentTarget.closest('[data-jp-zone]'); if (!ul) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    setGlisse(id);
    let courant = r;
    const bouge = (ev) => {
      const lignes = [...ul.querySelectorAll('[data-jp-ligne]')].filter((l) => l.getAttribute('data-jp-ligne') !== id);
      let vers = 0;
      for (const l of lignes) { const b = l.getBoundingClientRect(); if (ev.clientY > b.top + b.height / 2) vers += 1; }
      const n = deplacerCarte(courant, id, vers);
      if (n !== courant) { courant = n; poser(n); }
    };
    const fin = () => {
      window.removeEventListener('pointermove', bouge); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', fin);
      setGlisse(null); dire(id, zone, ordreJournee(zone, courant).indexOf(id));
    };
    window.addEventListener('pointermove', bouge); window.addEventListener('pointerup', fin); window.addEventListener('pointercancel', fin);
  };
  const origine = estOrigine(r);
  return (
    <div className="vrm-jp" ref={racine} data-jp-editeur="" data-jp-origine={origine ? '1' : '0'}>
      <p className="vrm-jp-aide">Glisse la poignée pour ranger une carte, touche l’interrupteur pour la cacher. Les alertes urgentes restent toujours affichées.</p>
      {ZONES_JOURNEE.map((z) => {
        const ids = ordreJournee(z.id, r);
        return (
          <section key={z.id} className="vrm-jp-zone" aria-labelledby={`vrm-jp-z-${z.id}`}>
            <h3 className="vrm-jp-zone-titre" id={`vrm-jp-z-${z.id}`}>{z.nom}</h3>
            <ul className="vrm-jp-liste" data-jp-zone={z.id}>
              {ids.map((id, i) => {
                const c = carteJournee(id); const v = visibiliteCarte(id, { reglage: r, mode });
                return (
                  <li key={id} className={'vrm-jp-ligne' + (v.choisie ? '' : ' is-cachee') + (glisse === id ? ' is-glisse' : '')} data-jp-ligne={id} data-jp-rang={i} data-jp-montree={v.choisie ? '1' : '0'}>
                    {/* `touch-action: none` EN LIGNE : une règle globale hors couche (« manipulation ») l'emporterait sur
                        la feuille de style, et le doigt ferait défiler la page au lieu de déplacer la carte. */}
                    <button type="button" className="vrm-jp-poignee" data-jp-poignee={id} style={{ touchAction: 'none' }}
                      aria-label={`Déplacer ${c.nom} (${i + 1}ᵉ sur ${ids.length})`} aria-describedby="vrm-jp-consigne" aria-roledescription="poignée"
                      onKeyDown={(e) => auClavier(e, id, z.id)} onPointerDown={(e) => glisser(e, id, z.id)}>
                      <Poignee/>
                    </button>
                    <span className="vrm-jp-textes">
                      <span className="vrm-jp-nom">{c.nom}</span>
                      <span className="vrm-jp-desc">{c.desc}</span>
                    </span>
                    <button type="button" role="switch" aria-checked={v.choisie} aria-label={`${c.nom} : ${v.choisie ? 'affichée' : 'cachée'}`}
                      className="vrm-switch" style={{ '--vrm-sw': v.choisie ? accent : eteint }} data-jp-interrupteur={id}
                      onClick={() => poser(basculerCarte(r, id, !v.choisie))}/>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p id="vrm-jp-consigne" className="vrm-sr">Flèches haut et bas pour déplacer la carte, Début ou Fin pour l’envoyer en haut ou en bas.</p>
      <p className="vrm-sr" role="status" aria-live="polite" data-jp-annonce="">{annonce}</p>
      <div className="vrm-jp-pied">
        <BoutonBase variante="discret" disabled={origine} data-jp-origine-bouton=""
          title={origine ? 'Ma journée est déjà au réglage d’origine' : undefined}
          onClick={() => { poser(revenirOrigine()); setAnnonce('Réglage d’origine'); if (toast) toast('Ma journée revient au réglage d’origine.'); }}>
          Revenir au réglage d’origine
        </BoutonBase>
      </div>
    </div>
  );
}

// Le nombre de cartes cachées par lui (pour la ligne « Modifier ma journée »).
export const nCachees = (reglage, mode) => CARTES_JOURNEE.filter((c) => !visibiliteCarte(c.id, { reglage, mode }).choisie).length;
