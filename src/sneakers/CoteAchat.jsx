// ── src/sneakers/CoteAchat.jsx — la cote VRM À L'ACHAT, dans la calculette (28 nov. 2026, lot sneakers-cote) ─────────
// Il tape la référence (et la pointure) de la paire qu'il pense acheter : VRM dit ce que SES ventes de cette référence
// ont donné (médiane, nombre, dernière vente datée, délai moyen — la couverture dite), et la « marge possible » avant
// frais. « Prendre comme revente » met la médiane dans « Je la revends » : la calculette ajoute alors les frais LUS.
// Rien n'est écrit. Zéro vente ⇒ rien n'est inventé (« pas encore de vente de cette référence »).
// StockX : pas sans clé, écarté sur décision du 28 nov.
import React from 'react';
import { tr } from '../i18n/index.js';
import { coteVRM, margePossible } from './cote.js';
import { normaliserRef, normaliserPointure } from './reference.js';
import { ventesPourCote, avecFiches, CLE_SNEAKERS } from './stockage.js';
import { Puce } from '../natif/Puce.jsx';
import './sneakers.css';

const eur = (c) => (c == null ? '—' : `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`);
const dateC = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: new Date(ms).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });

export default function CoteAchat({ achat = '', onRevente, load }) {
  const [ref, setRef] = React.useState('');
  const [pointure, setPointure] = React.useState('');
  const [ventes, setVentes] = React.useState(undefined);
  const R = normaliserRef(ref), P = normaliserPointure(pointure);
  React.useEffect(() => { if (!R || ventes !== undefined) return undefined; let vivant = true; ventesPourCote().then((v) => { if (vivant) setVentes(v); }, () => { if (vivant) setVentes(null); }); return () => { vivant = false; }; }, [R, ventes]);
  const c = R && Array.isArray(ventes) ? coteVRM(avecFiches(ventes, load ? load(CLE_SNEAKERS, null) : null), { ref: R, pointure: P }) : null;
  const a = Number(String(achat || '').replace(',', '.'));
  const marge = c ? margePossible(c, Number.isFinite(a) && a > 0 ? Math.round(a * 100) : null) : null;
  return (
    <section className="snk-cote-achat" data-snk-cote-achat={c ? c.niveau : R ? (ventes === undefined ? 'lecture' : ventes === null ? 'passu' : '') : 'vide'}
      data-snk-cote-mediane={c && c.medianeC != null ? String(c.medianeC) : ''} data-snk-cote-n={c ? String(c.n) : ''} data-snk-marge={marge == null ? '' : String(marge)}>
      <div className="vrm-calc-grille">
        <label className="vrm-calc-champ" htmlFor="calc-ref"><span>{tr('snk.ref')}</span>
          <span className="vrm-calc-saisie"><input id="calc-ref" autoComplete="off" value={ref} placeholder="DD1391-100" data-calc-champ="ref" onChange={(e) => setRef(e.target.value)}/></span></label>
        <label className="vrm-calc-champ" htmlFor="calc-pointure"><span>{tr('snk.pointure')}</span>
          <span className="vrm-calc-saisie"><input id="calc-pointure" autoComplete="off" value={pointure} placeholder="42,5" data-calc-champ="pointure" onChange={(e) => setPointure(e.target.value)}/></span></label>
      </div>
      {!ref.trim() ? <p className="snk-note">{tr('snk.achat.aide')}</p>
        : !R ? <p className="snk-note" data-snk-illisible="">{tr('snk.ref.illisible')}</p>
        : ventes === undefined ? <p className="snk-note">{tr('snk.lecture')}</p>
        : ventes === null ? <p className="snk-note" role="note">— {tr('snk.passu')}</p>
        : c.medianeC == null ? <p className="snk-note" data-snk-aucune="">{tr('snk.cote.aucuneRef', { ref: R, mois: 12 })}</p>
        : (
          <div className="snk-cote-res">
            <div className="snk-cote-tete">{tr('snk.achat.cote')} <b>{eur(c.medianeC)}</b></div>
            <p className="snk-note">{tr(c.niveau === 'pointure' ? 'snk.cote.pointure' : 'snk.cote.reference', { n: c.n, mois: 12 })}{c.derniere ? ' · ' + tr('snk.cote.derniere', { prix: eur(c.derniere.prixC), date: dateC(c.derniere.ms) }) : ''}{c.delaiJours != null ? ' · ' + tr('snk.cote.delai', { j: c.delaiJours, n: c.nDelai }) : ''}</p>
            {c.niveau === 'reference' && P ? <p className="snk-note">{tr('snk.achat.autresPointures')}</p> : null}
            {marge != null ? <p className="snk-cote-marge" data-snk-marge-signe={marge < 0 ? '-' : '+'}>{tr('snk.achat.marge')} <b>{marge < 0 ? '−' : '+'}{eur(Math.abs(marge))}</b> <small>{tr('snk.achat.avantFrais')}</small></p> : null}
            {onRevente ? <Puce className="vrm-calc-puce" attrs={{ 'data-snk-prendre': '' }} onClick={() => onRevente(String(c.medianeC / 100).replace('.', ','))}>{tr('snk.achat.prendre', { prix: eur(c.medianeC) })}</Puce> : null}
          </div>
        )}
      <p className="snk-note snk-estimation">{tr('snk.achat.estimation')}</p>
    </section>
  );
}
