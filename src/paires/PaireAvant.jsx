// ── LA PAIRE QUI MONTE AU PREMIER PLAN (14 nov., « Studio bleu clair », écran Paires) ─────────────
// Julien a choisi la direction t25 « Studio bleu clair » : « toucher une paire ⇒ elle monte au premier
// plan sans quitter la liste ». Au téléphone, la rangée touchée devient une carte en porcelaine, À SA
// PLACE dans la liste (les autres reculent) : photo, plaque N°, titre, quatre chiffres (prix affiché,
// acheté, jours en ligne, favoris), deux touches (Baisser le prix · Republier) et « ⋯ » — qui ouvre LA
// fiche de la paire (src/FichePaire.jsx, proposition 62) avec TOUS les autres gestes de la ligne.
// Sur ordinateur, la rangée ouvre directement la fiche, posée en plan à droite (styles : studio-paires.css).
//
// Ce module tient trois choses, et rien de métier :
//  1. un petit magasin (`ouvrirAvant`, `fermerAvant`, `avantOuvert`, `abonnerAvant`) : la clé de la
//     rangée ouverte. Ouvrir ne redessine PAS la liste (1 000 paires) : seul l'hôte se redessine ;
//  2. `clicAvant(e)` : le toucher d'une rangée (délégué sur la liste). Au téléphone il ouvre la carte et
//     empêche la fiche de s'ouvrir (`preventDefault`, lu par HoteFicheLigne) ; à l'ordinateur il ne fait
//     rien (la fiche s'ouvre en plan). Un toucher sur un contrôle de la ligne garde son geste ;
//  3. `<PaireAvantHote rendre>` : rend la partie propre à la carte ouverte (chiffres + gestes, fournis par
//     l'écran, qui seul connaît la paire PAR SON IDENTITÉ) dans la place que la rangée réserve
//     (`[data-sb-avant-place]`), pose `data-sb-avant` sur la rangée et `data-sb-recul` sur la liste,
//     et marque la rangée dont la fiche est ouverte (`data-sb-choisie`, ordinateur).
// Aucune identité n'est décidée ici : la clé est celle que la liste a posée sur la rangée
// (`data-sb-avant-cle`), et la fiche s'ouvre par la ligne elle-même (`lireLigne`, src/ficheLigne.js).
import React from 'react';
import { createPortal } from 'react-dom';
import { abonner as abonnerFiche, ligneOuverte, ouvrirLigne, lireLigne, toucheLeCorps } from '../ficheLigne.js';

let _cle = null;
const _abonnes = new Set();
const _notifier = () => { _abonnes.forEach((f) => { try { f(); } catch (_) {} }); };
export const abonnerAvant = (f) => { _abonnes.add(f); return () => _abonnes.delete(f); };
export const avantOuvert = () => _cle;
export function ouvrirAvant(cle) { const c = cle ? String(cle) : null; if (c === _cle) return; _cle = c; _notifier(); }
export function fermerAvant() { if (_cle == null) return; _cle = null; _notifier(); }

// Le téléphone : la même borne que la feuille « À faire » (src/ui/AFaire.jsx).
export const estTelephone = () => { try { return window.matchMedia('(max-width: 767px)').matches; } catch (_) { return false; } };
const echappe = (s) => { try { return CSS.escape(String(s)); } catch (_) { return String(s).replace(/["\\]/g, '\\$&'); } };
export const rangeeDe = (cle) => (cle && typeof document !== 'undefined' ? document.querySelector(`[data-sb-avant-cle="${echappe(cle)}"]`) : null);

// Le toucher d'une rangée de la liste (onClick délégué sur la liste).
export function clicAvant(e) {
  if (!e || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const t = e.target; if (!t || typeof t.closest !== 'function') return;
  const row = t.closest('[data-sb-avant-cle]'); if (!row) return;
  if (t.closest('[data-sb-avant-corps]')) return;   // la partie ouverte garde ses gestes
  if (!estTelephone()) return;                       // ordinateur : la fiche s'ouvre en plan à droite
  const cle = row.getAttribute('data-sb-avant-cle');
  const ouverte = _cle === cle;
  // Fermée, la rangée entière est le geste (aucun bouton dedans) ; ouverte, ses contrôles (N°, photo) gardent le leur.
  if (ouverte && row.hasAttribute('data-fiche-ligne') && !toucheLeCorps(t, row)) return;
  e.preventDefault();   // HoteFicheLigne ne l'ouvre pas en fiche : elle monte ici
  if (ouverte) fermerAvant(); else ouvrirAvant(cle);
}

// « ⋯ » : LA fiche de la paire, par la ligne elle-même (son identité, jamais son titre).
export function ouvrirFicheDe(cle) {
  const row = rangeeDe(cle); const l = row ? lireLigne(row) : null;
  if (l) { fermerAvant(); ouvrirLigne(l); return true; }
  return false;
}

const lireAvant = () => _cle;
export function useAvantOuvert() { return React.useSyncExternalStore(abonnerAvant, lireAvant, lireAvant); }

export function PaireAvantHote({ rendre }) {
  const cle = useAvantOuvert();
  const fiche = React.useSyncExternalStore(abonnerFiche, ligneOuverte, ligneOuverte);
  // La place de la carte, lue DANS le rendu (la rangée est déjà là) : un seul rendu, aucun état de plus. 1 000 paires :
  // ouvrir ne redessine que cet hôte — ni la liste, ni l'écran, ni l'historique du navigateur (pas de `FermeAuRetour` :
  // ce n'est pas une feuille ; Échap, « × » ou un second toucher la font redescendre).
  const row = cle ? rangeeDe(cle) : null;
  const place = row ? row.querySelector('[data-sb-avant-place]') : null;
  // La rangée ouverte : ses marques, et la liste qui recule.
  React.useLayoutEffect(() => {
    if (!row) { if (cle) fermerAvant(); return undefined; }
    const liste = row.closest('[data-sb-liste]');
    // Les marques du contrat commun (`.sb-avant`, `.sb-recul`, src/design/studio.css) et leurs attributs (bancs).
    row.setAttribute('data-sb-avant', '1'); row.classList.add('sb-avant');
    if (liste) { liste.setAttribute('data-sb-recul', '1'); liste.classList.add('sb-recul'); }
    const reduit = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    const raf = requestAnimationFrame(() => { try { row.scrollIntoView({ block: 'nearest', behavior: reduit ? 'auto' : 'smooth' }); } catch (_) {} });
    return () => { cancelAnimationFrame(raf); row.removeAttribute('data-sb-avant'); row.classList.remove('sb-avant'); if (liste) { liste.removeAttribute('data-sb-recul'); liste.classList.remove('sb-recul'); } };
  }, [cle, row]);
  // Échap referme la carte (la fiche, ouverte par-dessus, garde son propre Échap).
  React.useEffect(() => {
    if (!cle) return undefined;
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !ligneOuverte()) { e.preventDefault(); fermerAvant(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [cle]);
  // Ordinateur : la rangée dont la fiche est ouverte (en plan à droite) reste désignée dans la liste.
  React.useEffect(() => {
    const k = fiche && fiche.cle; if (!k) return undefined;
    let row = null; try { row = document.querySelector(`[data-sb-avant-cle][data-fiche-ligne="${echappe(k)}"]`); } catch (_) {}
    if (row) row.setAttribute('data-sb-choisie', '1');
    return () => { if (row) row.removeAttribute('data-sb-choisie'); };
  }, [fiche && fiche.cle]);
  // Changer d'écran ferme la carte (la clé ne survit pas à la liste).
  React.useEffect(() => () => fermerAvant(), []);
  if (!cle || !place) return null;
  // (16 nov.) Un hôte qui ne connaît pas cette rangée (Leboncoin, eBay, Vestiaire, Stock ont le leur) ne pose rien :
  // jamais une seconde carte, ni un corps vide, dans la place d'une rangée qui n'est pas la sienne.
  const contenu = rendre(cle, fermerAvant);
  if (contenu == null) return null;
  return createPortal(<div className="sb-avant-corps" data-sb-avant-corps={cle}>
    {contenu}
  </div>, place);
}
