// ════════════════════════════════════════════════════════════════════════════
//  LIGNE GLISSABLE — glisser pour agir, comme Mail sur iPhone (11 nov. 2026)
//  UN composant, réutilisé par Ventes, Achats (À retirer) et Annonces (Qui dorment).
//
//  Glisser une ligne vers la GAUCHE révèle 1 ou 2 actions à droite ; un glisser
//  LONG déclenche l'action principale (la première). La règle (seuils, sens,
//  élastique, décision au relâcher) vit dans `src/glisserRegle.js` (module pur).
//
//  ⚠️ Les actions sont celles qui EXISTENT DÉJÀ en bouton sur la ligne : l'écran
//  passe la MÊME fonction que son bouton (mêmes garde-fous, même « Annuler » 5 s,
//  même feuille de confirmation). Rien d'irréversible au glisser seul : une
//  action risquée ouvre sa confirmation (« Baisser le prix » ouvre la feuille).
//
//  Rendu à fonction, AUCUNE enveloppe : `children(gp, tiroir)` — `gp` se pose sur
//  la LIGNE elle-même (les règles `.liste > .ligne` restent vraies), `tiroir` se
//  pose DANS la ligne (il est à `left: 100%`, il glisse avec elle ; la liste,
//  `overflow: hidden`, le cache tant que la ligne est en place).
//
//   · au doigt (ou au stylet) seulement ; jamais depuis le bord gauche (retour
//     arrière d'iOS) ; le défilement vertical reste natif (`touch-action: pan-y`) ;
//   · aucun rendu React par image : la position passe par `style.translate` ;
//   · une seule ligne ouverte à la fois ; un toucher ailleurs la referme ;
//     Échap la referme ; le clic qui suit un glisser est avalé ;
//   · retour haptique léger (`navigator.vibrate`) si l'appareil sait le faire ;
//   · mouvement réduit : la ligne suit le doigt (manipulation directe) mais se
//     pose sans ressort ;
//   · découvrabilité : la PREMIÈRE fois (cet appareil), une ligne montre ses
//     actions une seule fois (un aperçu de 0,9 s), puis plus jamais ;
//   · accessibilité : le tiroir est `inert` + `aria-hidden` fermé (ses actions
//     sont déjà des boutons visibles de la ligne — audit-ligne-glissable) ; avec
//     `menu`, un bouton « … » l'ouvre au clavier et au lecteur d'écran.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { departPermis, sensGeste, positionGlisse, decision, seuilLong, largeurActions, actionsRetenues } from './glisserRegle.js';
import './styles-ligne-glissable.css';

export const CLE_INDICE = 'vrm_glisse_indice_vu';
let indicePris = false;            // un seul aperçu par chargement, même si dix lignes montent ensemble
let fermerOuverte = null;          // la ligne ouverte (une à la fois)

const reduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
const auDoigt = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (_) { return false; } };
const vibrer = (ms) => { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms); } catch (_) {} };
const indiceVu = () => { try { return window.localStorage.getItem(CLE_INDICE) === '1'; } catch (_) { return true; } };
const noterIndiceVu = () => { try { window.localStorage.setItem(CLE_INDICE, '1'); } catch (_) {} };

// Pose la ligne à `x` (px, ≤ 0). `anime` : le ressort (sobre) jusqu'à la place.
function poser(el, x, anime) {
  if (!el) return;
  el.style.transition = anime && !reduit() ? 'translate 420ms cubic-bezier(.25,1.12,.4,1)' : 'none';
  el.style.translate = x ? `${x}px 0` : '';
  el.style.setProperty('--lg-x', `${Math.max(0, -x)}px`);
  if (x) el.setAttribute('data-lg-actif', '1'); else el.removeAttribute('data-lg-actif');
}
function tiroirDe(el) { return el ? el.querySelector(':scope > [data-lg-tiroir]') : null; }
function rendreAccessible(el, oui) {
  const t = tiroirDe(el); if (!t) return;
  if (oui) { t.removeAttribute('inert'); t.removeAttribute('aria-hidden'); }
  else { t.setAttribute('inert', ''); t.setAttribute('aria-hidden', 'true'); }
}

export default function LigneGlissable({ actions, actif = true, menu = false, cle = '', libelle = '', children }) {
  const acts = actionsRetenues(actions);
  const n = acts.length;
  const elRef = React.useRef(null);
  const etat = React.useRef({ g: null, ouvert: false, avale: 0 });
  const actsRef = React.useRef(acts); actsRef.current = acts;
  const marche = !!actif && n > 0;
  const id = `lg-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const idTiroir = id + '-t';
  // La ligne elle-même (un composant fonction ne transmet pas `ref`) : retrouvée par son attribut.
  const elDe = () => { const el = elRef.current; if (el && el.isConnected) return el; try { elRef.current = document.querySelector(`[data-lg-id="${id}"]`); } catch (_) { elRef.current = null; } return elRef.current; };

  const fermer = React.useCallback((anime = true) => {
    const el = elDe(), s = etat.current;
    if (!s.ouvert && !(el && el.hasAttribute('data-lg-actif'))) return;
    s.ouvert = false;
    if (fermerOuverte === fermerIci.current) fermerOuverte = null;
    if (el) { el.removeAttribute('data-lg-ouvert'); el.removeAttribute('data-lg-pret'); poser(el, 0, anime); rendreAccessible(el, false);
      const m = el.querySelector('[data-lg-menu]'); if (m) m.setAttribute('aria-expanded', 'false'); }
  }, []);
  const fermerIci = React.useRef(fermer); fermerIci.current = fermer;
  const ouvrir = React.useCallback((focus = false) => {
    const el = elDe(), s = etat.current; if (!el) return;
    if (fermerOuverte && fermerOuverte !== fermerIci.current) fermerOuverte();
    s.ouvert = true; fermerOuverte = fermerIci.current;
    el.setAttribute('data-lg-ouvert', '1'); el.removeAttribute('data-lg-pret');
    poser(el, -largeurActions(actsRef.current.length), true); rendreAccessible(el, true);
    const m = el.querySelector('[data-lg-menu]'); if (m) m.setAttribute('aria-expanded', 'true');
    if (focus) { const b = tiroirDe(el) && tiroirDe(el).querySelector('button,a'); if (b) try { b.focus({ preventScroll: true }); } catch (_) {} }
  }, []);
  const lancer = React.useCallback((a) => {
    if (!a) return;
    fermer(true);
    vibrer(15);
    if (typeof a.faire === 'function') { try { a.faire(); } catch (_) {} }
  }, [fermer]);

  // Ouverte : un toucher hors de la ligne la referme (sans avaler ce toucher-là).
  React.useEffect(() => {
    if (!marche) return undefined;
    const dehors = (e) => { const el = elDe(); if (!etat.current.ouvert || !el) return; if (el.contains(e.target)) return; fermer(true); };
    document.addEventListener('pointerdown', dehors, true);
    return () => { document.removeEventListener('pointerdown', dehors, true); if (fermerOuverte === fermerIci.current) fermerOuverte = null; };
  }, [marche, fermer]);

  // Découvrabilité : la première fois sur CET appareil (au doigt), une ligne montre ses actions, une fois.
  React.useEffect(() => {
    if (!marche || indicePris || !auDoigt() || indiceVu()) return undefined;
    indicePris = true;
    let t1 = 0, t2 = 0;
    t1 = setTimeout(() => {
      const el = elDe(); if (!el || etat.current.g || etat.current.ouvert) { indicePris = false; return; }
      el.setAttribute('data-lg-indice', '1');
      poser(el, -Math.min(largeurActions(actsRef.current.length), 96), true);
      noterIndiceVu();
      t2 = setTimeout(() => { if (!etat.current.g && !etat.current.ouvert) poser(el, 0, true); el.removeAttribute('data-lg-indice'); }, 900);
    }, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [marche]);

  if (!marche) return children({}, null);

  const gp = {
    'data-lg': n,
    'data-lg-id': id,
    'data-lg-cle': cle || undefined,
    onPointerDown: (e) => {
      if (!e.isPrimary || !departPermis(e.clientX, e.pointerType)) return;
      if (e.target && e.target.closest && e.target.closest('input,textarea,select,[data-sans-glisse],[data-lg-tiroir]')) return;
      const el = e.currentTarget; elRef.current = el;
      const x0 = etat.current.ouvert ? -largeurActions(n) : 0;
      etat.current.g = { id: e.pointerId, x0p: e.clientX, y0: e.clientY, depart: x0, x: x0, sens: null, w: el.offsetWidth || 360, pret: false, t: e.timeStamp || Date.now(), vx: 0, px: e.clientX };
    },
    onPointerMove: (e) => {
      const el = e.currentTarget, s = etat.current.g;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0p, dy = e.clientY - s.y0;
      if (!s.sens) {
        s.sens = sensGeste(dx, dy, etat.current.ouvert);
        if (!s.sens) return;
        if (s.sens === 'h') { try { el.setPointerCapture(e.pointerId); } catch (_) {} if (fermerOuverte && fermerOuverte !== fermerIci.current) fermerOuverte(); }
      }
      if (s.sens !== 'h') return;
      const now = e.timeStamp || Date.now(); const dt = Math.max(1, now - s.t);
      s.vx = (s.px - e.clientX) / dt; s.px = e.clientX; s.t = now;
      s.x = positionGlisse(s.depart, dx, s.w, n);
      const pret = typeof actsRef.current[0].faire === 'function' && -s.x >= seuilLong(s.w, n);
      if (pret !== s.pret) { s.pret = pret; if (pret) { el.setAttribute('data-lg-pret', '1'); vibrer(8); } else el.removeAttribute('data-lg-pret'); }
      poser(el, s.x, false);
    },
    onPointerUp: (e) => {
      const s = etat.current.g;
      if (!s || e.pointerId !== s.id) return;
      etat.current.g = null;
      if (s.sens !== 'h') return;
      etat.current.avale = Date.now();
      const d = decision(s.x, s.w, n, s.vx);
      const el = e.currentTarget; el.removeAttribute('data-lg-pret');
      if (d === 'principale' && typeof actsRef.current[0].faire === 'function') lancer(actsRef.current[0]);
      else if (d === 'ouvrir') ouvrir(false);
      else { etat.current.ouvert = true; fermer(true); }
    },
    onPointerCancel: () => {
      const s = etat.current.g; etat.current.g = null;
      if (s && s.sens === 'h') { if (etat.current.ouvert) ouvrir(false); else { etat.current.ouvert = true; fermer(true); } }
    },
    onClickCapture: (e) => {
      // Le clic qui suit un glisser ne compte pas ; ouverte, un toucher sur la ligne (hors actions) la referme.
      if (Date.now() - etat.current.avale < 400) { e.preventDefault(); e.stopPropagation(); return; }
      if (etat.current.ouvert && !(e.target && e.target.closest && e.target.closest('[data-lg-tiroir],[data-lg-menu]'))) { e.preventDefault(); e.stopPropagation(); fermer(true); }
    },
    onKeyDown: (e) => { if (e.key === 'Escape' && etat.current.ouvert) { e.stopPropagation(); fermer(true); const m = elDe() && elDe().querySelector('[data-lg-menu]'); if (m) try { m.focus(); } catch (_) {} } },
  };

  // Le tiroir : la principale au BORD DROIT (c'est elle que le glisser long étire), la seconde à sa gauche.
  const tiroir = <>
    <span className="vrm-lg-tiroir" data-lg-tiroir={n} id={idTiroir} inert="" aria-hidden="true" role="group" aria-label={libelle ? `Actions : ${libelle}` : 'Actions'} style={{ '--lg-n': n }}>
      {[...acts].reverse().map((a, i) => {
        const principale = i === n - 1;
        const props = { className: 'vrm-lg-action', 'data-lg-action': a.cle || (principale ? 'principale' : 'seconde'), 'data-lg-principale': principale ? '1' : undefined, ...(a.data || {}) };
        const contenu = <>{a.icone ? <span className="vrm-lg-icone" aria-hidden="true">{a.icone}</span> : null}<span className="vrm-lg-lib">{a.libelle}</span></>;
        if (typeof a.faire !== 'function') return <a key={i} {...props} href={a.href} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); fermer(true); }}>{contenu}</a>;
        return <button key={i} type="button" {...props} onClick={(e) => { e.stopPropagation(); lancer(a); }}>{contenu}</button>;
      })}
    </span>
    {menu ? <button type="button" className="vrm-lg-menu" data-lg-menu="" aria-haspopup="true" aria-expanded="false" aria-controls={idTiroir} aria-label={libelle ? `Actions : ${libelle}` : 'Actions'}
      onClick={(e) => { e.stopPropagation(); if (etat.current.ouvert) fermer(true); else ouvrir(true); }}>…</button> : null}
  </>;
  return children(gp, tiroir);
}
