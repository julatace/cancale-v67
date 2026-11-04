// ═══════════════════════════════════════════════════════════════════════════
// COMPTA · PORTE-MONNAIE VINTED — une ligne par compte (4 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Le solde LU (disponible · en attente) de chaque compte, avec la date de
// lecture ; « — » pour un compte jamais lu ; les comptes écartés nommés à part ;
// les virements vers la banque quand le relevé les donne. La règle :
// src/porteMonnaie.js. Rien n'est déduit des ventes.
import React from 'react';

const eur = (v) => (v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €');
const ilYa = (t, maintenant = Date.now()) => { if (!t) return ''; const m = Math.max(0, Math.round((maintenant - t) / 60000)); return m < 60 ? `il y a ${m} min` : m < 48 * 60 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const jour = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function PorteMonnaie({ pm }) {
  if (!pm || pm.etat === 'encours') return <div className="vrm-pm" data-pm="encours"><div className="vrm-pm-vide">…</div></div>;
  if (pm.etat === 'passu') return <div className="vrm-pm" data-pm="passu"><div className="vrm-pm-vide">—</div></div>;
  const T = pm.total;
  const dedans = pm.lignes.filter((l) => !l.exclu);
  const partiel = T.manque.length > 0;
  return (
    <div className="vrm-pm" data-pm="lu" data-pm-dispo={T.dispo == null ? '' : String(T.dispo)} data-pm-attente={T.attente == null ? '' : String(T.attente)} data-pm-manque={T.manque.join(',')}>
      <div className="vrm-pm-total">
        <span className="vrm-pm-case"><small>{partiel ? 'Disponible · au moins' : 'Disponible'}</small><b data-pm-total="dispo">{eur(T.dispo)}</b></span>
        <span className="vrm-pm-case"><small>{partiel ? 'En attente · au moins' : 'En attente'}</small><b data-pm-total="attente">{eur(T.attente)}</b></span>
      </div>
      <ul className="vrm-pm-liste">
        {dedans.map((l) => (
          <li key={l.uid} className="vrm-pm-ligne" data-pm-compte={l.uid} data-pm-jamais={l.jamais ? '1' : undefined} data-pm-vieux={l.vieux ? '1' : undefined}>
            <span className="vrm-pm-nom">{l.nom}<small className={'vrm-pm-quand' + (l.vieux ? ' is-vieux' : '')}>{l.jamais ? 'jamais lu' : (l.vieux ? `à confirmer · ${ilYa(l.at)}` : ilYa(l.at))}</small></span>
            <span className="vrm-pm-val" data-pm-val="dispo">{eur(l.dispo)}</span>
            <span className="vrm-pm-val is-gris" data-pm-val="attente">{eur(l.attente)}</span>
          </li>
        ))}
      </ul>
      {T.exclus.length > 0 && <div className="vrm-pm-note" data-pm-exclus={T.exclus.join(',')}>Hors total : {T.exclus.join(', ')}</div>}
      {pm.virements.length > 0 && (
        <details className="vrm-pm-virements" data-pm-virements={pm.virements.length}>
          <summary>Virements vers ta banque<span className="vrm-pm-n">{pm.virements.length}</span></summary>
          <ul className="vrm-pm-liste">
            {pm.virements.slice(0, 24).map((v, i) => (
              <li key={v.uid + i} className="vrm-pm-ligne" data-pm-virement={v.uid}>
                <span className="vrm-pm-nom">{v.nom}<small className="vrm-pm-quand">{jour(v.date)}{v.enCours ? ' · en cours' : ''}</small></span>
                <span className="vrm-pm-val">{eur(v.montant)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
