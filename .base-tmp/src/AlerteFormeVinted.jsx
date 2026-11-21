// ═══════════════════════════════════════════════════════════════════════════
// LA LIGNE AMBRE « Vinted a changé sa page des ventes : VRM ne la lit plus, on
// corrige » (11 nov., ext. 5.357). Règle : src/formeVinted.js.
//   · Paramètres → « Tout va bien ? » (`lieu="tvb"`) : tant que c'est vrai ;
//   · Ma journée (`lieu="journee"`) : UNE fois — « Compris » la range pour CE
//     changement (une autre page touchée, ou un autre champ, reparaît).
// Lecture : les petites lignes `harvest_*_forme_inconnue`, projetées. Rien n'est écrit en base.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { FILTRE_FORMES, SELECT_FORMES, alertesForme } from './formeVinted.js';
import { lireTout } from './App.jsx';
import './styles-forme-vinted.css';

const CLE_VUES = 'vrm_forme_vinted_vue';
const lireVues = () => { try { const v = JSON.parse(localStorage.getItem(CLE_VUES) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } };
const ecrireVues = (l) => { try { localStorage.setItem(CLE_VUES, JSON.stringify(l.slice(-40))); } catch (_) {} };

// undefined = on lit · null = pas su · liste (vide = rien à dire).
export function useAlertesForme(tour = 0) {
  const [rows, setRows] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireTout(`${FILTRE_FORMES}&select=${SELECT_FORMES}`).catch(() => null).then((r) => { if (!mort) setRows(r); });
    return () => { mort = true; };
  }, [tour]);
  return React.useMemo(() => (rows === undefined ? undefined : alertesForme(rows)), [rows]);
}

export function LignesForme({ alertes, lieu, onCompris }) {
  if (!alertes || !alertes.length) return null;
  return (
    <div className="vrm-forme-vinted" data-forme-vinted={lieu} data-forme-pages={alertes.map((a) => a.page).join(',')} role="status">
      {alertes.map((a) => (
        <p key={a.page} className="vrm-forme-ligne" data-forme-page={a.page}>
          <span className="vrm-forme-point" aria-hidden="true" />
          <span>{a.texte}</span>
        </p>
      ))}
      {onCompris ? <button type="button" className="vrm-lien-action vrm-forme-compris" data-forme-compris="" onClick={onCompris}>Compris</button> : null}
    </div>
  );
}

// Ma journée : dite une fois.
export default function AlerteFormeVinted() {
  const alertes = useAlertesForme();
  const [vues, setVues] = React.useState(lireVues);
  if (!alertes) return null;   // on lit, ou pas su : rien n'est affirmé
  const montrees = alertes.filter((a) => !vues.includes(a.cle));
  const compris = () => { const l = [...new Set([...vues, ...montrees.map((a) => a.cle)])]; ecrireVues(l); setVues(l); };
  return <LignesForme alertes={montrees} lieu="journee" onCompris={compris} />;
}
