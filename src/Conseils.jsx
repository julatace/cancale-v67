// ── LES CONSEILS (6 nov.) — la règle vit dans src/accompagnement.js ──────────
// UNE bulle au plus, non modale, posée à côté du VRAI bouton d'un geste utile :
// un halo autour de lui (aucun voile : l'écran reste vivant), un titre, une
// phrase, le geste (il touche ce bouton), « Plus tard » et « Ne plus montrer ».
// Échap = « Plus tard ». Toucher le bouton pointé = geste fait.
// Portail sur <body>, z 8500 : au-dessus de l'écran, sous les feuilles et les
// confirmations (une feuille ouverte fait taire les conseils, de toute façon).
//
//   · `ChiffreConseil` : posé par un écran À CÔTÉ du calcul qu'il affiche déjà
//     (§11) — publie la valeur, la retire au démontage.
//   · `Conseils` : monté une fois par la coque ; choisit (après que l'écran s'est
//     posé), écrit le « vu » dans SA ligne, PUIS montre — une écriture ratée
//     ne montre rien.
//   · `useReglageConseils` : l'interrupteur « Conseils » et « Revoir les
//     conseils » de Paramètres → Aide (la même ligne).
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './styles-conseils.css';
import {
  CLE_APPAREIL, publierChiffre, retirerChiffre, lireChiffres, ecouterChiffres,
  choisirConseil, raisonSilence, modifierMemoire, noterVu, noterReponse,
  couperConseils, revoirConseils, normaliserMemoire, placerConseil,
} from './accompagnement.js';

// ── Le chiffre publié par un écran ───────────────────────────────────────────
export function ChiffreConseil({ cle, valeur }) {
  const json = (() => { try { return JSON.stringify(valeur === undefined ? '__undef__' : valeur); } catch (_) { return String(valeur); } })();
  useEffect(() => { publierChiffre(cle, valeur); }, [cle, json]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => retirerChiffre(cle), [cle]);
  return null;
}

// ── La mémoire partagée (la bulle et Paramètres lisent la même) ──────────────
// undefined : en cours · null : pas su · objet : lue.
const ETAT = { memoire: undefined, lecture: null };
const abonnes = new Set();
const poser = (m) => { ETAT.memoire = m; for (const f of [...abonnes]) { try { f(m); } catch (_) {} } };
function relire(lire, force = false) {
  if (!lire) return Promise.resolve(null);
  if (ETAT.lecture && !force) return ETAT.lecture;
  ETAT.lecture = Promise.resolve().then(() => lire()).then((l) => {
    poser(l ? normaliserMemoire(l.data) : null);
    return ETAT.memoire;
  }).catch(() => { poser(null); return null; }).finally(() => { ETAT.lecture = null; });
  return ETAT.lecture;
}
function useMemoire(lire) {
  const [m, setM] = useState(ETAT.memoire);
  useEffect(() => {
    const f = (x) => setM(x);
    abonnes.add(f);
    if (ETAT.memoire === undefined || ETAT.memoire === null) relire(lire);
    else setM(ETAT.memoire);
    const re = () => relire(lire, true);
    window.addEventListener('vrm:accompagnement', re);
    return () => { abonnes.delete(f); window.removeEventListener('vrm:accompagnement', re); };
  }, [lire]);
  return m;
}
async function ecrireMemoire(lire, ecrire, transformer) {
  const r = await modifierMemoire(lire, ecrire, transformer);
  if (r.etat === 'ok' || r.etat === 'rien') poser(r.data);
  return r;
}

// Paramètres → Aide : [allumés (true · false · undefined en cours · null pas su), basculer, revoir].
export function useReglageConseils({ lire, ecrire }) {
  const m = useMemoire(lire);
  const on = m === undefined ? undefined : m === null ? null : !m.coupe;
  const basculer = useCallback(() => ecrireMemoire(lire, ecrire, (x) => couperConseils(x, !x.coupe)), [lire, ecrire]);
  const revoir = useCallback(() => ecrireMemoire(lire, ecrire, (x) => revoirConseils(x)), [lire, ecrire]);
  return [on, basculer, revoir];
}

// ── Ce que la page dit d'elle-même (lu au moment de choisir) ──────────────────
const appareilCoupe = () => {
  try { return localStorage.getItem(CLE_APPAREIL) === 'coupes' && localStorage.getItem('vrm_banc_conseils') !== '1'; } catch (_) { return false; }
};
const FEUILLES = '[aria-modal="true"], .vrm-visite, .vrm-bienvenue, .vrm-menu-voile, .vrm-garde-feuille';
const lirePage = () => ({
  feuille: !!document.querySelector(FEUILLES),
  garde: !!document.querySelector('[data-garde-ecran]'),
  chargement: !!document.querySelector('[data-demarrage-vrm], .vrm-main .vrm-skeleton'),
  appareilCoupe: appareilCoupe(),
});
// L'élément visible qui porte un conseil (le premier sélecteur qui en a un), ou null.
// Visible = une boîte non nulle, dans la fenêtre (entre le haut et la barre du bas),
// pas caché, pas `inert`, pas désactivé.
function basReserve() {
  const nav = document.querySelector('.vrm-mobile-nav');
  if (!nav || !nav.getClientRects().length) return 0;
  const r = nav.getBoundingClientRect();
  return r.height > 0 && r.top < window.innerHeight ? Math.max(0, window.innerHeight - r.top) : 0;
}
export function cibleVisible(cibles) {
  for (const sel of cibles || []) {
    let liste = [];
    try { liste = [...document.querySelectorAll(sel)]; } catch (_) { continue; }
    for (const el of liste) {
      if (!el.getClientRects().length || el.closest('[hidden], [inert], [aria-hidden="true"], .vrm-conseil')) continue;
      if (el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const bas = el.closest('.vrm-mobile-nav') ? 0 : basReserve();
      if (r.bottom <= 0 || r.top >= window.innerHeight - bas || r.right <= 0 || r.left >= window.innerWidth) continue;
      return el;
    }
  }
  return null;
}

const SORTIE_MS = 140;
const POSE_MS = 1400;          // l'écran se pose avant qu'on juge

export default function Conseils({ ecran = '', contexte = {}, lire, ecrire, onAction, onEchec, z = 8500 }) {
  const memoire = useMemoire(lire);
  const [chiffres, setChiffres] = useState(lireChiffres);
  useEffect(() => ecouterChiffres(() => setChiffres(lireChiffres())), []);
  const [montre, setMontre] = useState(null);     // { ...conseil, ecran }
  const [pos, setPos] = useState(null);           // { cote, x, y, flecheX, halo }
  const [sortie, setSortie] = useState(false);
  const enCours = useRef(false);                  // un choix est en train de s'écrire
  const elRef = useRef(null);                     // l'élément pointé
  const bulle = useRef(null);
  const fini = useRef(false);
  const ctxRef = useRef(contexte); ctxRef.current = contexte;
  const ecranRef = useRef(ecran); ecranRef.current = ecran;

  const ctxJson = JSON.stringify(contexte || {});
  // 1. CHOISIR — quand l'écran s'est posé (chiffres, mémoire, contexte stables POSE_MS).
  useEffect(() => {
    if (montre || enCours.current) return undefined;
    const t = setTimeout(async () => {
      const ctx = { ...ctxRef.current, ...lirePage() };
      const choix = choisirConseil({ ecran, chiffres, memoire, contexte: ctx, cibleVisible });
      if (!choix) return;
      enCours.current = true;
      // Le « vu » d'abord : un conseil ne paraît qu'une fois écrit (un rechargement ne le ramène pas).
      const r = await ecrireMemoire(lire, ecrire, (m) => noterVu(m, choix.cle, ecran, Date.now()));
      enCours.current = false;
      if (r.etat !== 'ok') { if (r.etat === 'ko') poser(null); return; }   // pas su : on se tait
      if (ecranRef.current !== ecran) return;
      // Rien ne s'est ouvert pendant l'écriture ? (Les plafonds comptent déjà CE vu.)
      const s = raisonSilence({ contexte: { ...ctxRef.current, ...lirePage() }, memoire: r.data, ecran });
      if (s && s !== 'plafond-jour' && s !== 'plafond-ecran') return;
      const el = cibleVisible(choix.cibles);
      if (!el) return;
      elRef.current = el; fini.current = false;
      setSortie(false); setPos(null); setMontre({ ...choix, ecran });
    }, POSE_MS);
    return () => clearTimeout(t);
  }, [ecran, chiffres, memoire, ctxJson, montre, lire, ecrire]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. FERMER — sortie courte, puis la réponse s'écrit (une réponse ratée laisse le « vu » : 3 jours de repos).
  const fermer = useCallback((reponse) => {
    if (!montre || fini.current) return;
    fini.current = true;
    const cle = montre.cle;
    setSortie(true);
    setTimeout(() => { setMontre(null); setPos(null); setSortie(false); elRef.current = null; }, SORTIE_MS);
    if (!reponse) return;
    ecrireMemoire(lire, ecrire, (m) => noterReponse(m, cle, reponse, Date.now())).then((r) => {
      if (r.etat === 'ko' && reponse === 'jamais' && onEchec) onEchec('« Ne plus montrer » n’a pas pu être enregistré — réessaie plus tard.');
    });
  }, [montre, lire, ecrire, onEchec]);

  // Une mémoire pas sue (lecture ou écriture ratée) se relit au prochain écran.
  useEffect(() => { if (ETAT.memoire === null) relire(lire); }, [ecran, lire]);

  // Un autre écran : la bulle part, sans réponse (son « vu » est déjà écrit).
  useEffect(() => { if (montre && montre.ecran !== ecran) fermer(null); }, [ecran]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. PLACER — à côté de la cible ; suivie au défilement et au redimensionnement.
  const placer = useCallback(() => {
    if (!montre || !bulle.current || fini.current) return;
    const ctx = { ...ctxRef.current, ...lirePage() };
    // Une feuille, un garde-fou, le mode stream… : la bulle se retire (sans réponse).
    const s = raisonSilence({ contexte: ctx, memoire: ETAT.memoire || {}, ecran });
    if (s && !['plafond-jour', 'plafond-ecran', 'memoire-en-cours', 'memoire-pas-su', 'coupe'].includes(s)) { fermer(null); return; }
    if (ETAT.memoire && ETAT.memoire.coupe) { fermer(null); return; }
    let el = elRef.current;
    if (!el || !el.isConnected) { el = cibleVisible(montre.cibles); elRef.current = el; }
    if (!el || !el.isConnected) { fermer(null); return; }
    const r = el.getBoundingClientRect();
    const dehors = r.bottom <= 0 || r.top >= window.innerHeight - (el.closest('.vrm-mobile-nav') ? 0 : basReserve());
    if (dehors) { setPos((p) => (p && p.cache ? p : { ...(p || {}), cache: true })); return; }
    const b = bulle.current.getBoundingClientRect();
    const p = placerConseil(r, window.innerWidth, window.innerHeight, b.width, b.height, { bas: el.closest('.vrm-mobile-nav') ? 0 : basReserve() });
    // Le halo déborde de 6 px autour de la cible, mais jamais hors de l'écran (« Plus »,
    // collé au bord de la barre, aurait un anneau coupé) : il rentre alors sur ce bord.
    const hx0 = Math.max(3, r.left - 6), hy0 = Math.max(3, r.top - 6);
    const hx1 = Math.min(window.innerWidth - 3, r.right + 6), hy1 = Math.min(window.innerHeight - 3, r.bottom + 6);
    const halo = { x: Math.round(hx0), y: Math.round(hy0), w: Math.round(hx1 - hx0), h: Math.round(hy1 - hy0) };
    setPos((q) => (q && !q.cache && q.x === p.x && q.y === p.y && q.flecheX === p.flecheX && q.cote === p.cote && q.halo.x === halo.x && q.halo.y === halo.y && q.halo.w === halo.w && q.halo.h === halo.h ? q : { ...p, halo, cache: false }));
  }, [montre, ecran, fermer]);
  useLayoutEffect(() => { if (montre) placer(); }, [montre, placer]);
  useEffect(() => {
    if (!montre) return undefined;
    let raf = 0;
    const re = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(placer); };
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    const tic = setInterval(placer, 500);       // une mise en page qui bouge (chargement, feuille)
    return () => { cancelAnimationFrame(raf); clearInterval(tic); window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true); };
  }, [montre, placer]);

  // 4. LE GESTE FAIT — il touche le bouton pointé lui-même ; Échap = « Plus tard ».
  useEffect(() => {
    if (!montre) return undefined;
    const clic = (e) => { const el = elRef.current; if (el && e.target && el.contains(e.target)) fermer('fait'); };
    const touche = (e) => { if (e.key === 'Escape' && !document.querySelector(FEUILLES)) { e.stopPropagation(); fermer('plusTard'); } };
    document.addEventListener('click', clic, true);
    document.addEventListener('keydown', touche, true);
    return () => { document.removeEventListener('click', clic, true); document.removeEventListener('keydown', touche, true); };
  }, [montre, fermer]);

  if (!montre) return null;
  const agir = () => {
    const el = elRef.current;
    const action = montre.action;
    fermer('fait');
    if (action && onAction) { onAction(action); return; }
    if (el && el.isConnected) { try { el.click(); } catch (_) {} }
  };
  const cache = !pos || pos.cache;
  return createPortal(
    <div className="vrm-conseil" data-conseil={montre.cle} data-conseil-cible={montre.cibles.join(' , ')} data-sortie={sortie ? '1' : undefined} style={{ zIndex: z }}>
      {pos && !pos.cache && <div className="vrm-conseil-halo" aria-hidden="true" style={{ left: pos.halo.x, top: pos.halo.y, width: pos.halo.w, height: pos.halo.h }}/>}
      <div ref={bulle} className="vrm-conseil-bulle" role="dialog" aria-modal="false" aria-labelledby="vrm-conseil-titre" aria-describedby="vrm-conseil-texte"
        data-cote={cache ? 'mesure' : pos.cote} key={montre.cle}
        style={cache ? { left: 0, top: 0, visibility: 'hidden' } : { left: pos.x, top: pos.y, '--fleche-x': pos.flecheX + 'px' }}>
        <span className="vrm-conseil-fleche" aria-hidden="true"/>
        <h2 id="vrm-conseil-titre" className="vrm-conseil-titre">{montre.titre}</h2>
        <p id="vrm-conseil-texte" className="vrm-conseil-texte" aria-live="polite">{montre.texte}</p>
        <div className="vrm-conseil-pied">
          <button type="button" className="vrm-conseil-geste" data-conseil-geste="" onClick={agir}>{montre.geste}</button>
          <button type="button" className="vrm-conseil-tard" data-conseil-plus-tard="" onClick={() => fermer('plusTard')}>Plus tard</button>
          <button type="button" className="vrm-conseil-jamais" data-conseil-jamais="" onClick={() => fermer('jamais')}>Ne plus montrer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
