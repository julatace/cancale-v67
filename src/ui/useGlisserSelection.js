// ── src/ui/useGlisserSelection.js — cocher en glissant le doigt, comme dans Photos (chantier 93) ──
// La règle (pure) : src/glisserSelection.js. Ici le GESTE, en événements de pointeur :
//   · il ne part que d'une POIGNÉE (`[data-glisse-poignee]`, la case de la ligne, posée en
//     `touch-action:none` par listes-recherche.css) : partout ailleurs, le doigt fait défiler
//     la liste comme avant ;
//   · chaque ligne porte `data-glisse-cle` (son identité : compte + id de l'annonce) ;
//   · près du bord haut/bas de la zone qui défile, la liste défile seule (rAF) ;
//   · un simple toucher (sans glisser) reste le geste natif de la case ; après un vrai
//     glisser, le clic qui suit est avalé (sinon la première case se décocherait).
//   const { surPointeur, glisse } = useGlisserSelection({ ordre, coches, exclues, poser });
//   <ul onPointerDown={surPointeur} data-glisse={glisse ? '1' : '0'}>…
import { useCallback, useEffect, useRef, useState } from 'react';
import { plageGlissee, selectionGlissee, vitesseBord } from '../glisserSelection.js';

const zoneQuiDefile = (el) => {
  for (let x = el && el.parentElement; x; x = x.parentElement) {
    const cs = getComputedStyle(x);
    if (/(auto|scroll)/.test(cs.overflowY) && x.scrollHeight > x.clientHeight + 4) return x;
  }
  return document.scrollingElement || document.documentElement;
};
const bornes = (sc) => {
  const doc = sc === document.scrollingElement || sc === document.documentElement;
  const r = doc ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
  let haut = r.top, bas = r.bottom;
  // les barres fixes du haut et du bas couvrent la zone : le bord utile est sous elles
  const h = document.querySelector('.vrm-app-header'); if (h) { const q = h.getBoundingClientRect(); if (q.bottom > haut && q.top <= haut + 4) haut = q.bottom; }
  const n = document.querySelector('.vrm-mobile-nav'); if (n) { const q = n.getBoundingClientRect(); if (q.height && q.top < bas && q.bottom >= bas - 4) bas = q.top; }
  return { haut, bas };
};

export function useGlisserSelection({ ordre, coches, exclues, poser, seuil = 6 }) {
  const derniers = useRef(null);
  derniers.current = { ordre, coches, exclues, poser };
  const etat = useRef(null);
  const [glisse, setGlisse] = useState(false);
  const fin = useCallback(() => {
    const st = etat.current; if (!st) return;
    etat.current = null;
    cancelAnimationFrame(st.raf);
    window.removeEventListener('pointermove', st.move, true);
    window.removeEventListener('pointerup', st.up, true);
    window.removeEventListener('pointercancel', st.up, true);
    document.documentElement.classList.remove('vrm-glisse-en-cours');
    if (st.bouge) {
      // le clic qui suit le geste (même cible) ne doit pas recocher/décocher la première case
      const avaler = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', avaler, true);
      setTimeout(() => window.removeEventListener('click', avaler, true), 450);
    }
    setGlisse(false);
  }, []);
  useEffect(() => fin, [fin]);
  const surPointeur = useCallback((e) => {
    if (etat.current) return;
    if (e.button != null && e.button > 0) return;
    const p = e.target && e.target.closest ? e.target.closest('[data-glisse-poignee]') : null; if (!p) return;
    const ligne = p.closest('[data-glisse-cle]'); if (!ligne) return;
    const k = ligne.getAttribute('data-glisse-cle');
    const d = derniers.current; if (!d || d.exclues.has(k) || !d.ordre.includes(k)) return;
    const st = { ancre: k, cle: k, coche: !d.coches.has(k), avant: new Set(d.coches), x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bouge: false, raf: 0, sc: zoneQuiDefile(ligne), vu: null };
    const appliquer = () => {
      const dd = derniers.current; if (!dd) return;
      const el = document.elementFromPoint(st.x, st.y);
      const l = el && el.closest ? el.closest('[data-glisse-cle]') : null;
      const c = l ? l.getAttribute('data-glisse-cle') : null;
      if (c && dd.ordre.includes(c)) st.cle = c;
      const s = selectionGlissee(st.avant, plageGlissee(dd.ordre, st.ancre, st.cle), st.coche, dd.exclues);
      const sig = [...s].sort().join('|');
      if (sig !== st.vu) { st.vu = sig; dd.poser(s); }
    };
    const boucle = () => {
      if (etat.current !== st) return;
      const { haut, bas } = bornes(st.sc);
      const v = vitesseBord(st.y, haut, bas);
      if (v) { const av = st.sc.scrollTop; st.sc.scrollTop += v; if (st.sc.scrollTop !== av) appliquer(); }
      st.raf = requestAnimationFrame(boucle);
    };
    st.move = (ev) => {
      st.x = ev.clientX; st.y = ev.clientY;
      if (!st.bouge) {
        if (Math.abs(st.y - st.y0) < seuil && Math.abs(st.x - st.x0) < seuil) return;
        st.bouge = true; setGlisse(true);
        document.documentElement.classList.add('vrm-glisse-en-cours');
        st.raf = requestAnimationFrame(boucle);
      }
      if (ev.cancelable) ev.preventDefault();
      appliquer();
    };
    st.up = () => fin();
    etat.current = st;
    window.addEventListener('pointermove', st.move, { capture: true, passive: false });
    window.addEventListener('pointerup', st.up, true);
    window.addEventListener('pointercancel', st.up, true);
  }, [fin, seuil]);
  return { surPointeur, glisse };
}
export default useGlisserSelection;
