// ── LA FEUILLE « CHANGER LE PRIX » (3 nov.) — règle : src/prixPartout.js ────
// Un prix, une case par site où CE N° est en ligne (par identité), l'état de
// chaque site après « Appliquer ». Rien ne part avant ce clic.
import React from 'react';
import { createPortal } from 'react-dom';
import { prixTape, minisAuDessus, NOM_SITE } from './prixPartout.js';
import { tr } from './i18n/index.js';
import './styles-annonces-outils.css';

const eur = (n) => (n == null ? '—' : `${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')}\u00a0€`);
const ETAT = { envoi: 'Envoi…', fait: 'Fait', refuse: 'Refusé', incertain: 'Pas sûr', 'a-faire': 'À faire sur le site', ignore: '' };
// (11 nov. soir) « Un prix modifié dans VRM change partout » : le prix de CHAQUE site
// (son ajustement réglé, `prixDe`), eBay RELU après, Vinted PROPOSÉ (« Baisser le prix »).
const etatTexte = (e) => (e.etat === 'propose' ? tr('prixPartout.propose') : e.etat === 'fait' && e.relu ? tr('prixPartout.relu') : ETAT[e.etat]);

export default function PrixPartout({ num, sites = [], manques = [], lecture = false, onAppliquer, onFermer, Retour, prixDe = null, onProposer = null }) {
  const [prix, setPrix] = React.useState('');
  const [coches, setCoches] = React.useState(() => new Set(sites.map((s) => s.cle)));
  const [etats, setEtats] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [fini, setFini] = React.useState(false);
  const vus = React.useRef(new Set(sites.map((s) => s.cle)));
  React.useEffect(() => {   // un site arrivé après l'ouverture (lecture finie) : coché par défaut
    const neufs = sites.filter((s) => !vus.current.has(s.cle));
    if (!neufs.length) return;
    neufs.forEach((s) => vus.current.add(s.cle));
    setCoches((c) => { const n = new Set(c); neufs.forEach((s) => n.add(s.cle)); return n; });
  }, [sites]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  const p = prixTape(prix);
  const minis = minisAuDessus(sites, p);
  const nCoches = sites.filter((s) => coches.has(s.cle)).length;
  const basculer = (cle) => setCoches((c) => { const n = new Set(c); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  const appliquer = async () => {
    if (p == null || !nCoches || enCours) return;
    setEnCours(true); setEtats({});
    try { await onAppliquer({ coches: new Set(coches), prix: p, surEtat: (cle, e) => setEtats((x) => ({ ...x, [cle]: e })) }); }
    finally { setEnCours(false); setFini(true); }
  };
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile" data-prix-partout={num} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille" role="dialog" aria-modal="true" aria-label={`Changer le prix du N°${num}`}>
        <header className="vrm-ao-tete">
          <h2>Changer le prix</h2>
          <span className="vrm-ao-num">N°{num}</span>
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-prix-fermer="" onClick={onFermer} disabled={enCours}>×</button>
        </header>
        <label className="vrm-ao-prix">
          <span>Nouveau prix</span>
          <span className="vrm-ao-prix-champ">
            <input inputMode="decimal" autoComplete="off" value={prix} onChange={(e) => { setPrix(e.target.value); setFini(false); }} disabled={enCours} data-prix-champ="" aria-invalid={prix !== '' && p == null ? 'true' : undefined}/>
            <b>€</b>
          </span>
        </label>
        <ul className="vrm-ao-sites" data-prix-sites={sites.length}>
          {sites.map((s) => {
            const e = etats[s.cle] || null;
            const coche = coches.has(s.cle);
            return (
              <li key={s.cle} className="vrm-ao-site" data-prix-site={s.site} data-prix-cle={s.cle} data-prix-mode={s.mode} data-prix-etat={e ? e.etat : ''}>
                <label className="vrm-ao-case">
                  <input type="checkbox" checked={coche} onChange={() => basculer(s.cle)} disabled={enCours} data-prix-coche={s.cle}/>
                  <span className="vrm-ao-site-nom"><b>{NOM_SITE[s.site]}</b><small>{eur(s.prix)}{(() => { const c = p == null ? null : (prixDe ? prixDe(s.site, p) : p); return c != null && s.prix != null && Math.round(c * 100) !== Math.round(s.prix * 100) ? <span data-prix-cible={c}>{' → ' + eur(c)}</span> : null; })()}{s.mode === 'site' ? ' · sur le site' : ''}</small></span>
                </label>
                <span className={'vrm-ao-etat is-' + (e ? e.etat : 'attente')} title={e && e.raison ? e.raison : undefined} data-prix-relu={e && e.relu ? '1' : ''}>
                  {e ? etatTexte(e) : ''}
                  {e && (e.etat === 'refuse' || e.etat === 'incertain' || e.etat === 'a-faire') && e.raison ? <small data-prix-raison="">{e.raison}</small> : null}
                  {e && e.etat === 'a-faire' && e.prix != null ? <small data-prix-a-mettre={e.prix}>{tr('prixPartout.aMettre', { prix: eur(e.prix) })}</small> : null}
                </span>
                {e && e.etat === 'propose' && onProposer ? <button type="button" className="vrm-ao-ouvrir" data-prix-proposer={s.cle} onClick={() => onProposer(s, e)}>{tr('prixPartout.baisser')}</button> : null}
                {(s.mode === 'site' || (e && e.etat !== 'fait' && e.etat !== 'envoi' && e.etat !== 'propose')) && s.lien
                  ? <a className="vrm-ao-ouvrir" href={s.lien} target="_blank" rel="noopener noreferrer" data-prix-lien={s.cle}>Ouvrir</a> : null}
              </li>
            );
          })}
          {manques.map((m) => <li key={'m' + m} className="vrm-ao-site is-passu" data-prix-passu={m}><span className="vrm-ao-site-nom"><b>{m}</b><small>—</small></span></li>)}
          {lecture ? <li className="vrm-ao-site is-passu" data-prix-lecture=""><span className="vrm-ao-site-nom"><small>…</small></span></li> : null}
        </ul>
        {!lecture && !sites.length && !manques.length ? <p className="vrm-ao-vide" data-prix-aucun="">Aucune annonce en ligne</p> : null}
        {minis.map((m) => <p key={m.cle} className="vrm-ao-mini" data-prix-mini={m.mini}>Prix mini des offres : {eur(m.mini)}</p>)}
        <button type="button" className="vrm-ao-principal" data-prix-appliquer="" disabled={p == null || !nCoches || enCours} onClick={appliquer}>
          {enCours ? 'Envoi…' : fini ? 'Appliquer à nouveau' : 'Appliquer'}
        </button>
      </div>
    </div>, document.body);
}
