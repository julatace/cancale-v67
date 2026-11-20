// ── « BAISSES CONSEILLÉES » (15 nov., vendre plus) — règle : src/baisseConseillee.js ──
// Une feuille (porcelaine opaque sur le verre) : chaque annonce EN LIGNE depuis 30 jours ou
// plus, avec « Baisser à 92 € ? » ou « Garder ce prix », la RAISON en mots et le plancher.
// « Appliquer » (une, ou les baisses cochées) ouvre la feuille EXISTANTE « Baisser le prix »
// (src/BaissePrixSerie.jsx) avec ces prix : aperçu, SON clic, confirmation, une à la fois,
// prix RELU sur Vinted. Un « garder » propose le geste d'abord (offre aux favoris, republier,
// saisir le prix d'achat) — l'écran existant, sur son clic. Rien n'est envoyé d'ici.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, monnaie } from './i18n/index.js';
import { texteRaisons, resumeConseils } from './baisseConseillee.js';
import './styles-annonces-outils.css';
import './styles-vendre-plus.css';
import { BoutonIcone as BoutonIconeNatif } from './natif/Bouton.jsx';
import { Glyphe as GlypheNatif } from './natif/icones.jsx';

const eur = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : monnaie(Number(v), 'EUR', Number.isInteger(Number(v)) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : undefined));

// L'entrée, posée au-dessus de la liste « Qui dorment » : une tuile entière qui se touche.
export function EntreeBaissesConseillees({ n, onOuvrir }) {
  if (!(n > 0)) return null;
  return (
    <button type="button" className="vrm-vp-entree" data-bc-entree={n} onClick={onOuvrir}>
      <span className="vrm-vp-entree-texte">
        <b>{tr('bc.entree', { n })}</b>
        <small>{tr('bc.entreeSous')}</small>
      </span>
      <span aria-hidden="true" className="vrm-vp-chevron">›</span>
    </button>
  );
}

export default function BaissesConseillees({ lignes = null, ventesLues = true, onAppliquer, onGeste, onFermer, Photo, Retour }) {
  const L = Array.isArray(lignes) ? lignes : [];
  const baisses = L.filter((l) => l.d.decision === 'baisser');
  const [coches, setCoches] = React.useState(() => new Set(baisses.map((l) => l.cle)));
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  const R = resumeConseils(L);
  const choisies = baisses.filter((l) => coches.has(l.cle));
  const basculer = (cle) => setCoches((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile" data-bc-feuille={L.length} onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille vrm-bc" role="dialog" aria-modal="true" aria-label={tr('bc.titre')}>
        <header className="vrm-ao-tete">
          <h2>{tr('bc.titre')}</h2>
          <BoutonIconeNatif libelle={tr('bc.fermer')} icone={<GlypheNatif nom="close"/>} className="vrm-ao-x" onClick={onFermer} attrs={{ 'data-bc-fermer': "" }}/>
        </header>
        <p className="vrm-bc-resume" data-bc-resume={`${R.baisser}/${R.garder}/${R.achat}`}>
          {[R.baisser ? tr('bc.resume.baisser', { n: R.baisser }) : '', R.garder ? tr('bc.resume.garder', { n: R.garder }) : '', R.achat ? tr('bc.resume.achat', { n: R.achat }) : ''].filter(Boolean).join(' · ')}
        </p>
        <p className="vrm-bp-note">{tr('bc.sous')}</p>
        {ventesLues === false ? <p className="vrm-bp-note" data-bc-ventes-pas-lues="">{tr('bc.ventesPasLues')}</p> : null}
        {lignes == null ? <p className="vrm-ao-mini" data-bc-pas-lu="">{tr('bc.pasLu')}</p>
          : !L.length ? <p className="vrm-ao-mini" data-bc-vide="">{tr('bc.vide')}</p> : null}
        <ul className="vrm-bc-liste" data-bc-n={L.length}>
          {L.map((l) => {
            const d = l.d;
            const coche = coches.has(l.cle);
            return (
              <li key={l.cle} className={'vrm-bc-ligne is-' + d.decision} data-bc-ligne={l.id} data-bc-decision={d.decision}
                data-bc-sugg={d.sugg == null ? undefined : String(d.sugg)} data-bc-prix={d.prix == null ? undefined : String(d.prix)}
                data-bc-plancher={d.plancher == null ? undefined : String(d.plancher)} data-bc-geste={d.geste || undefined}>
                {d.decision === 'baisser'
                  ? <label className="vrm-bc-zone"><input type="checkbox" className="vrm-bc-case" checked={coche} onChange={() => basculer(l.cle)} data-bc-case={l.id} aria-label={tr('bc.phrase', { p: d.sugg })}/></label>
                  : <span className="vrm-bc-case" aria-hidden="true"/>}
                {l.photo && Photo ? <Photo src={l.photo} alt="" className="vrm-bp-photo" loading="lazy"/> : <span className="vrm-bp-photo" aria-hidden="true"/>}
                <span className="vrm-bc-centre">
                  <span className="vrm-bp-nom">{l.numero ? <b className="vrm-bp-num">N°{l.numero}</b> : null}<span className="vrm-bp-titre">{l.titre || '—'}</span></span>
                  <span className="vrm-bc-decision">
                    {d.decision === 'baisser'
                      ? <><s>{eur(d.prix)}</s> → <b>{tr('bc.phrase', { p: d.sugg })}</b> <small>{tr('bc.pct', { n: d.pct })}</small></>
                      : d.decision === 'achat' ? <b>{tr('bc.achat')}</b> : <b>{tr('bc.garder')}</b>}
                  </span>
                  <small className="vrm-bc-raison" data-bc-raisons={d.raisons.map((r) => r.cle).join(' ')}>{texteRaisons(d.raisons, tr)}</small>
                </span>
                {d.decision === 'baisser'
                  ? <button type="button" className="sb-touche vrm-bc-geste" data-bc-appliquer={l.id} onClick={() => onAppliquer([l])}>{tr('bc.appliquer')}</button>
                  : d.geste && onGeste ? <button type="button" className="sb-lien vrm-bc-geste" data-bc-geste-k={d.geste} onClick={() => onGeste(l, d.geste)}>{tr('bc.geste.' + d.geste)}</button> : null}
              </li>
            );
          })}
        </ul>
        <div className="vrm-bp-bas">
          <p className="vrm-bp-note vrm-bc-note">{tr('bc.note')}</p>
          <button type="button" className="vrm-ao-principal vrm-bc-tout" data-bc-appliquer-tout={choisies.length} disabled={!choisies.length} onClick={() => onAppliquer(choisies)}>
            {tr('bc.appliquerTout', { n: choisies.length })}
          </button>
        </div>
      </div>
    </div>, document.body);
}
