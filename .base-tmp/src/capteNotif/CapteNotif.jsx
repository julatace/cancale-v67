// ── « L'EXTENSION A CAPTÉ » : LE TOAST DE L'APP (14 nov., extension 5.377) ─────────
// Monté une fois par la coque (App.jsx, à côté de `ConfortCoque`). Il écoute `vrm:ext`
// (les événements de l'extension, relayés par bridge.js) et dit, UNE fois par lot,
// « L'extension a capté · 2 nouvelles ventes (shop_x) · Voir » :
//   · jamais par-dessus une feuille ouverte (il attend qu'elle se ferme) ;
//   · il part seul après ~6 s (le temps s'arrête au survol ou au focus), × de 44 px ;
//   · « Voir » mène à l'écran concerné (`vrm:aller`, le chemin des liens de l'app) ;
//   · réglage coupé (Paramètres, ou la carte du logo) ⇒ rien.
// Les règles sont dans ./regle.js (pures) ; les textes passent par `tr()`.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { lotValide, resteADire, noterDit, partiesCapte, ecranCapte, capteCoupe } from './regle.js';
import './capte.css';

const DUREE = 6000;
const CLE_DIT = 'vrm_capte_dit';
const lireDit = () => { try { return JSON.parse(sessionStorage.getItem(CLE_DIT) || '{}') || {}; } catch (_) { return {}; } };
const ecrireDit = (d) => { try { sessionStorage.setItem(CLE_DIT, JSON.stringify(d)); } catch (_) {} };
const rien = () => () => {};

export default function CapteNotif({ feuilleOuverte = () => false, abonnerFeuilles = rien }) {
  useLangue();
  const feuille = React.useSyncExternalStore(abonnerFeuilles, feuilleOuverte, () => false);
  const [montre, setMontre] = React.useState(null);
  const attente = React.useRef(null);
  const pause = React.useRef(false);
  const minuteur = React.useRef(null);
  const dit = React.useRef(lireDit());

  // (Un élément retiré de la page ne rend pas son « blur » : la pause tombe à la fermeture.)
  const fermer = React.useCallback((raison) => { clearTimeout(minuteur.current); pause.current = false; setMontre((m) => (m ? null : m)); if (raison) try { document.documentElement.setAttribute('data-capte-fin', raison); } catch (_) {} }, []);
  const minuter = React.useCallback(() => {
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(function fin() { if (pause.current) { minuteur.current = setTimeout(fin, 800); return; } fermer('seul'); }, DUREE);
  }, [fermer]);
  const montrer = React.useCallback(() => {
    const l = attente.current;
    if (!l || feuilleOuverte()) return;
    attente.current = null;
    dit.current = noterDit(dit.current, l); ecrireDit(dit.current);
    setMontre((m) => {
      // Un toast encore affiché pour le MÊME compte : ce qui arrive s'y ajoute.
      if (m && m.compte === l.compte && m.p === l.p) { const n = Object.assign({}, m.n); for (const [s, v] of Object.entries(l.n)) n[s] = (Number(n[s]) || 0) + v; return Object.assign({}, m, { n, relie: m.relie || l.relie, lot: l.lot }); }
      return l;
    });
    minuter();
  }, [feuilleOuverte, minuter]);

  React.useEffect(() => {
    const surEvt = (e) => {
      const ev = e && e.detail;
      if (!ev || ev.type !== 'capte' || !lotValide(ev.lot) || capteCoupe()) return;
      const reste = resteADire(ev.lot, dit.current);
      if (!reste) return;                       // déjà dit (une fois par lot)
      // Ce qui attend encore (feuille ouverte) se cumule par lot.
      const a = attente.current;
      attente.current = a && a.lot === reste.lot ? reste : a && a.compte === reste.compte && a.p === reste.p ? Object.assign({}, reste, { n: Object.fromEntries([...new Set([...Object.keys(a.n), ...Object.keys(reste.n)])].map((s) => [s, (Number(a.n[s]) || 0) + (Number(reste.n[s]) || 0)])) }) : reste;
      // Une rafale (plusieurs lectures rangées à la suite) : un seul toast, un instant après.
      setTimeout(montrer, 600);
    };
    window.addEventListener('vrm:ext', surEvt);
    return () => { window.removeEventListener('vrm:ext', surEvt); clearTimeout(minuteur.current); };
  }, [montrer]);
  // Une feuille vient de se fermer : ce qui attendait passe maintenant (s'il n'a pas plus de 2 min).
  React.useEffect(() => {
    if (feuille) { if (montre) fermer('feuille'); return; }
    if (attente.current && Date.now() - Number(attente.current.maj || attente.current.at || 0) < 120000) setTimeout(montrer, 300);
  }, [feuille]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!montre || feuille) return null;
  const parts = partiesCapte(montre, tr);
  if (!parts.length) return null;
  const voir = () => { const q = ecranCapte(montre); fermer('voir'); try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })); } catch (_) {} };
  const noeud = (
    <div className="vrm-capte" role="status" aria-live="polite" data-capte-toast={montre.lot} data-capte-relie={montre.relie ? '1' : '0'} {...Object.fromEntries(parts.map((p) => ['data-capte-' + p.s, String(p.n)]))}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') pause.current = true; }} onPointerLeave={() => { pause.current = false; }}
      onFocus={() => { pause.current = true; }} onBlur={() => { pause.current = false; }}>
      <div className="vrm-capte-corps">
        <div className="vrm-capte-t">{montre.relie ? tr('capte.relie') : tr('capte.titre')}{montre.nom ? <> · <b>{montre.nom}</b></> : null}</div>
        <div className="vrm-capte-l">{parts.map((p, i) => <React.Fragment key={p.s}>{i ? ' · ' : ''}<span className="vrm-capte-seg">{p.texte}</span></React.Fragment>)}</div>
      </div>
      <button type="button" className="vrm-capte-voir" data-capte-voir="" onClick={voir}>{tr('capte.voir')}</button>
      <button type="button" className="vrm-capte-x" data-capte-fermer="" aria-label={tr('capte.fermer')} onClick={() => fermer('fermer')}>×</button>
    </div>
  );
  return createPortal(noeud, document.body);
}
