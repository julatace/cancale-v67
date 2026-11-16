// ── « MODIFIER MA JOURNÉE » : l'éditeur (11 nov. 2026, lot journee-perso ; refait SIMPLE le 16 nov.) ──────
// (16 nov., lot personnalisation-simple — Julien : « La personnalisation doit être plus simple. ») UNE liste, en
// trois groupes (En haut · À faire · En bas), UNE phrase d'en-tête. Par carte : son nom (plus de phrase grise
// sous chaque nom), une poignée pour la glisser au DOIGT, deux flèches ↑ ↓ (une place par toucher, au doigt
// comme au lecteur d'écran), un interrupteur visible / cachée. Chaque geste s'enregistre tout de suite (aucun
// bouton « Enregistrer »), Ma journée derrière change au même instant. En bas : « Revenir au réglage de départ ».
// Au CLAVIER, la poignée garde ses flèches haut/bas, Début/Fin (annoncé). La règle (ordre, visibilité, urgences)
// est src/journeePerso.js : ce fichier ne fait que la montrer. Textes : tr('jp.*'), 5 langues.
import React from 'react';
import { BoutonBase } from './composants/Bouton.jsx';
import { tr } from './i18n/index.js';
import { CARTES_JOURNEE, ZONES_JOURNEE, ordreJournee, ordreMobile, visibiliteCarte, basculerCarte, deplacerCarte, monterCarte, descendreCarte, revenirOrigine, estOrigine, carteJournee } from './journeePerso.js';

// Le nom d'une carte dans la langue choisie (le catalogue garde le français, la source).
export const nomCarte = (id) => { const c = carteJournee(id); const k = 'jp.carte.' + id; const t = tr(k); return t && t !== k ? t : (c ? c.nom : id); };

const Poignee = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
    <circle cx="6.5" cy="4" r="1.5"/><circle cx="11.5" cy="4" r="1.5"/>
    <circle cx="6.5" cy="9" r="1.5"/><circle cx="11.5" cy="9" r="1.5"/>
    <circle cx="6.5" cy="14" r="1.5"/><circle cx="11.5" cy="14" r="1.5"/>
  </svg>
);
const Fleche = ({ haut }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {haut ? <path d="M6 15l6-6 6 6"/> : <path d="M6 9l6 6 6-6"/>}
  </svg>
);

export function JourneePersoEditeur({ reglage, poser, mode, accent = '#0071E3', eteint = 'rgba(0,0,0,.16)', toast }) {
  const [annonce, setAnnonce] = React.useState('');
  const [glisse, setGlisse] = React.useState(null);
  const focusApres = React.useRef(null);
  const racine = React.useRef(null);
  const r = reglage;
  // Après un déplacement (clavier ou flèche), le focus reste sur le même contrôle (React a déplacé la ligne) ;
  // une flèche devenue inactive (la carte est arrivée en haut ou en bas) le passe à sa voisine.
  React.useLayoutEffect(() => {
    const f = focusApres.current; if (!f || !racine.current) return;
    focusApres.current = null;
    let el = racine.current.querySelector(f.sel);
    if (el && el.disabled && f.repli) el = racine.current.querySelector(f.repli);
    if (el && document.activeElement !== el) { try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } }
  });
  const dire = (id, zone, reglageVu) => { const l = ordreMobile(zone, reglageVu); setAnnonce(tr('jp.rang', { nom: nomCarte(id), rang: l.indexOf(id) + 1, n: l.length })); };
  const appliquer = (id, zone, n, focus) => {
    if (ordreMobile(zone, n).indexOf(id) === ordreMobile(zone, r).indexOf(id)) { dire(id, zone, r); return; }
    if (focus) focusApres.current = focus;
    poser(n);
    dire(id, zone, n);
  };
  const auClavier = (e, id, zone) => {
    const liste = ordreMobile(zone, r), i = liste.indexOf(id);
    const vers = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? liste.length - 1 : null;
    if (vers == null) return;
    e.preventDefault();
    if (vers < 0 || vers >= liste.length) { dire(id, zone, r); return; }
    appliquer(id, zone, deplacerCarte(r, id, vers), { sel: `[data-jp-poignee="${id}"]` });
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
      const lignes = [...ul.querySelectorAll('[data-jp-ligne]:not([data-jp-fixe])')].filter((l) => l.getAttribute('data-jp-ligne') !== id);
      let vers = 0;
      for (const l of lignes) { const b = l.getBoundingClientRect(); if (ev.clientY > b.top + b.height / 2) vers += 1; }
      const n = deplacerCarte(courant, id, vers);
      if (ordreMobile(zone, n).indexOf(id) !== ordreMobile(zone, courant).indexOf(id)) { courant = n; poser(n); }
    };
    const fin = () => {
      window.removeEventListener('pointermove', bouge); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', fin);
      setGlisse(null); dire(id, zone, courant);
    };
    window.addEventListener('pointermove', bouge); window.addEventListener('pointerup', fin); window.addEventListener('pointercancel', fin);
  };
  const origine = estOrigine(r);
  return (
    <div className="vrm-jp" ref={racine} data-jp-editeur="" data-jp-simple="" data-jp-origine={origine ? '1' : '0'}>
      <p className="vrm-jp-aide" data-jp-aide="">{tr('jp.aide')}</p>
      {ZONES_JOURNEE.map((z) => {
        const ids = ordreJournee(z.id, r), mob = ordreMobile(z.id, r);
        return (
          <section key={z.id} className="vrm-jp-zone" aria-labelledby={`vrm-jp-z-${z.id}`} data-jp-groupe={z.id}>
            <h3 className="vrm-jp-zone-titre" id={`vrm-jp-z-${z.id}`}>{tr('jp.zone.' + z.id)}</h3>
            <ul className="vrm-jp-liste" data-jp-zone={z.id}>
              {ids.map((id, i) => {
                const c = carteJournee(id); const v = visibiliteCarte(id, { reglage: r, mode });
                const nom = nomCarte(id), k = mob.indexOf(id);
                return (
                  <li key={id} className={'vrm-jp-ligne' + (v.choisie ? '' : ' is-cachee') + (glisse === id ? ' is-glisse' : '')} data-jp-ligne={id} data-jp-rang={i} data-jp-fixe={c.fixe ? '' : undefined} data-jp-montree={v.choisie ? '1' : '0'}>
                    {/* `touch-action: none` EN LIGNE : une règle globale hors couche (« manipulation ») l'emporterait sur
                        la feuille de style, et le doigt ferait défiler la page au lieu de déplacer la carte. */}
                    {c.fixe ? <span className="vrm-jp-poignee is-fixe" aria-hidden="true"/> : (
                    <button type="button" className="vrm-jp-poignee" data-jp-poignee={id} style={{ touchAction: 'none' }}
                      aria-label={tr('jp.deplacer', { nom, rang: k + 1, n: mob.length })} aria-describedby="vrm-jp-consigne" aria-roledescription={tr('jp.poignee')}
                      onKeyDown={(e) => auClavier(e, id, z.id)} onPointerDown={(e) => glisser(e, id, z.id)}>
                      <Poignee/>
                    </button>)}
                    <span className="vrm-jp-nom">{nom}</span>
                    {c.fixe ? <span className="vrm-jp-fleches" aria-hidden="true"/> : (
                      <span className="vrm-jp-fleches">
                        <button type="button" className="vrm-jp-fleche" data-jp-monter={id} disabled={k <= 0} aria-label={tr('jp.monter', { nom })}
                          onClick={() => appliquer(id, z.id, monterCarte(r, id), { sel: `[data-jp-monter="${id}"]`, repli: `[data-jp-descendre="${id}"]` })}><Fleche haut/></button>
                        <button type="button" className="vrm-jp-fleche" data-jp-descendre={id} disabled={k >= mob.length - 1} aria-label={tr('jp.descendre', { nom })}
                          onClick={() => appliquer(id, z.id, descendreCarte(r, id), { sel: `[data-jp-descendre="${id}"]`, repli: `[data-jp-monter="${id}"]` })}><Fleche/></button>
                      </span>)}
                    <button type="button" role="switch" aria-checked={v.choisie} aria-label={tr(v.choisie ? 'jp.affichee' : 'jp.cachee', { nom })}
                      className="vrm-switch" style={{ '--vrm-sw': v.choisie ? accent : eteint }} data-jp-interrupteur={id}
                      onClick={() => poser(basculerCarte(r, id, !v.choisie))}/>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p id="vrm-jp-consigne" className="vrm-sr">{tr('jp.consigne')}</p>
      <p className="vrm-sr" role="status" aria-live="polite" data-jp-annonce="">{annonce}</p>
      <div className="vrm-jp-pied">
        <BoutonBase variante="discret" disabled={origine} data-jp-origine-bouton=""
          title={origine ? tr('jp.dejaDepart') : undefined}
          onClick={() => { poser(revenirOrigine()); setAnnonce(tr('jp.annonceDepart')); if (toast) toast(tr('jp.revenu')); }}>
          {tr('jp.depart')}
        </BoutonBase>
      </div>
    </div>
  );
}

// Le nombre de cartes cachées par lui (pour la ligne « Modifier ma journée »).
export const nCachees = (reglage, mode) => CARTES_JOURNEE.filter((c) => !visibiliteCarte(c.id, { reglage, mode }).choisie).length;
