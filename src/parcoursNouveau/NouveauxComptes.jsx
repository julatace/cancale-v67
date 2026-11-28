// ═══════════════════════════════════════════════════════════════════════════
// RÉGLAGES → AIDE → « NOUVEAUX COMPTES » — L'ÉCRAN DU PROPRIÉTAIRE (15 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « un onglet dans le compte admin pour voir ce que ceux qui créent des
// comptes auront ». Deux blocs :
//  1. L'APERÇU, en direct : la VRAIE app dans un cadre nommé `vrm-bac-a-sable-nouveau`
//     (/apercu-nouveau, même origine, seul chemin que vercel.json laisse encadrer, par
//     nous seuls). Dans ce cadre, src/modeExemple.js installe le bac à sable AVANT l'app :
//     base VIDE en mémoire, aucune requête vers la base ni /api, ni sa session, ni son
//     stockage, ni IndexedDB, extension coupée. Chaque étape navigable (vitrine,
//     inscription, puis les huit étapes du parcours), en téléphone (390) ou ordinateur
//     (1512), et la consigne iPhone vue depuis son Mac. Le compteur dit combien
//     d'écritures l'aperçu a GARDÉES en mémoire (aucune n'est partie).
//  2. LES VRAIS INSCRITS : `/api/compte?mode=pilotage&quoi=parcours` (le serveur refuse
//     tout autre compte, 403) — anonyme, seulement ce que la base mesure, « pas su » dit.
// L'entrée n'est montée que pour le propriétaire (Réglages : `proprioInst`) ; c'est le
// SERVEUR qui garde les données (jamais un drapeau du navigateur).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateI18n } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { ETAPES_NOUVEAU } from './regle.js';
import { NOM_CADRE_BAC } from '../modeExemple.js';
import './nouveaux-comptes.css';

export const ETAPES_APERCU = ['vitrine', 'inscription', ...ETAPES_NOUVEAU];
const nomEtape = (e) => (e === 'vitrine' ? tr('nc.vitrine') : e === 'inscription' ? tr('nc.inscription') : tr('pn.court.' + e));
export const adresseApercu = (etape, appareil, n = 0) => `/apercu-nouveau?bac=${encodeURIComponent(etape)}${appareil ? '&appareil=' + appareil : ''}${etape === 'inscription' ? '&inscription' : ''}&v=${n}`;
const TAILLES = { telephone: [390, 844], ordinateur: [1512, 945] };

function Apercu() {
  const [i, setI] = React.useState(2);
  const [format, setFormat] = React.useState('telephone');
  const [iphone, setIphone] = React.useState(true);
  const [n, setN] = React.useState(0);
  const [ecritures, setEcritures] = React.useState(null);
  const boite = React.useRef(null);
  const cadre = React.useRef(null);
  const [largeur, setLargeur] = React.useState(360);
  React.useEffect(() => {
    const m = () => { try { setLargeur(Math.max(240, boite.current ? boite.current.clientWidth : 360)); } catch (_) {} };
    m();
    let ro = null;
    try { ro = new ResizeObserver(m); if (boite.current) ro.observe(boite.current); } catch (_) { window.addEventListener('resize', m); }
    return () => { try { ro && ro.disconnect(); } catch (_) {} window.removeEventListener('resize', m); };
  }, []);
  // Le bilan de la porte du cadre (même origine) : écritures gardées en mémoire, refusées.
  React.useEffect(() => {
    const t = setInterval(() => {
      try { const b = cadre.current && cadre.current.contentWindow && cadre.current.contentWindow.__vrmExemple ? cadre.current.contentWindow.__vrmExemple() : null; setEcritures(b && b.actif ? (b.ecrituresGardees || 0) + (b.refusees || 0) : null); } catch (_) { setEcritures(null); }
    }, 1200);
    return () => clearInterval(t);
  }, []);
  const etape = ETAPES_APERCU[i];
  const [W, H] = TAILLES[format];
  const echelle = Math.min(1, largeur / W, format === 'telephone' ? 680 / H : 1);
  const appareil = format === 'telephone' ? (iphone ? 'iphone' : null) : 'ordinateur';
  const src = adresseApercu(etape, appareil, n);
  const aller = (k) => { setI(Math.max(0, Math.min(ETAPES_APERCU.length - 1, k))); setN((x) => x + 1); };
  return (
    <section className="nc-bloc" data-nc-apercu={etape} data-nc-format={format}>
      <h3 className="nc-titre">{tr('nc.apercu')}</h3>
      <p className="nc-note">{tr('nc.apercu.note')}</p>
      <div className="nc-barre" role="group" aria-label={tr('nc.apercu')}>
        <div className="nc-seg" role="radiogroup">
          {['telephone', 'ordinateur'].map((f) => <button key={f} type="button" role="radio" aria-checked={format === f} data-nc-format-choix={f} onClick={() => { setFormat(f); setN((x) => x + 1); }}>{tr('nc.' + f)}</button>)}
        </div>
        {format === 'telephone' ? <label className="nc-case"><input type="checkbox" checked={iphone} onChange={(e) => { setIphone(e.target.checked); setN((x) => x + 1); }} data-nc-iphone="" />{tr('nc.iphone')}</label> : null}
      </div>
      <div className="nc-nav">
        <button type="button" className="nc-fleche" aria-label={tr('nc.precedent')} disabled={i === 0} onClick={() => aller(i - 1)} data-nc-precedent="">‹</button>
        <span className="nc-etape" data-nc-etape={`${i + 1}/${ETAPES_APERCU.length}`} aria-live="polite">{tr('nc.etape', { n: i + 1, total: ETAPES_APERCU.length, nom: nomEtape(etape) })}</span>
        <button type="button" className="nc-fleche" aria-label={tr('nc.suivant')} disabled={i === ETAPES_APERCU.length - 1} onClick={() => aller(i + 1)} data-nc-suivant="">›</button>
      </div>
      <div className="nc-pastilles" role="tablist" aria-label={tr('nc.apercu')}>
        {ETAPES_APERCU.map((e, k) => <button key={e} type="button" role="tab" aria-selected={k === i} className="nc-pastille" data-nc-aller={e} onClick={() => aller(k)} title={nomEtape(e)}>{k + 1}</button>)}
      </div>
      <div className="nc-scene" ref={boite}>
        <div className="nc-cadre" data-nc-cadre={format} style={{ width: Math.round(W * echelle), height: Math.round(H * echelle) }}>
          <iframe key={src} ref={cadre} name={NOM_CADRE_BAC} src={src} title={tr('nc.etape', { n: i + 1, total: ETAPES_APERCU.length, nom: nomEtape(etape) })}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="same-origin" loading="eager"
            style={{ width: W, height: H, transform: `scale(${echelle})`, transformOrigin: '0 0' }} />
        </div>
      </div>
      <p className="nc-note" data-nc-ecritures={ecritures == null ? '' : String(ecritures)}>{ecritures == null ? '' : tr('nc.ecritures', { n: ecritures })}</p>
    </section>
  );
}

const RAISONS_CLES = ['base', 'comptes-illisibles', 'proprietaire-inconnu', 'non-configure', 'reseau'];
const raisonTexte = (v) => tr('nc.raison.' + (RAISONS_CLES.includes(v) ? v : 'base'));
const chiffre = (v) => (v == null ? '—' : String(v));
function Tableau({ entetes, fetcher }) {
  const [x, setX] = React.useState(undefined);
  const lire = React.useCallback(async () => {
    setX(undefined);
    try {
      const r = await fetcher('/api/compte?mode=pilotage&quoi=parcours', { headers: entetes ? entetes() : {}, cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.status === 403) { setX({ refuse: true }); return; }
      if (r.ok && j && j.ok === true) { setX(j); return; }
      setX({ erreur: (j && j.raison) || 'base' });
    } catch (_) { setX({ erreur: 'reseau' }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);
  if (x === undefined) return <p className="nc-note" data-nc-tableau="lecture">{tr('nc.chargement')}</p>;
  if (x.refuse) return <p className="nc-note" data-nc-tableau="refuse">{tr('nc.refuse')}</p>;
  if (x.erreur) return <p className="nc-note" data-nc-tableau="pas-su">{tr('nc.pasSu', { raison: raisonTexte(x.erreur) })} <button type="button" className="nc-lien" onClick={lire} aria-label={tr('bd.reessayer')} title={tr('bd.reessayer')}>↻</button></p>;
  if (x.total == null) return <p className="nc-note" data-nc-tableau="pas-su">{tr('nc.pasSu', { raison: raisonTexte((x.raisons || {}).comptes) })}</p>;
  if (x.total === 0) return <p className="nc-note" data-nc-tableau="0">{tr('nc.aucun')}</p>;
  const e = x.entonnoir || {};
  const marches = [['crees', e.crees], ['ouvert', e.ouvert], ['extension', e.extension], ['lecture', e.lecture], ['parcoursFini', e.parcoursFini], ['abonnes', e.abonnes]];
  const max = Math.max(1, e.crees || 0);
  const NOM_MESURE = { ouvert: 'nc.ouvert', extension: 'nc.extension', lecture: 'nc.lecture', abonnes: 'nc.abonnes', comptes: 'nc.crees' };
  const manques = Object.entries(x.raisons || {}).map(([k, v]) => `${tr(NOM_MESURE[k] || 'nc.crees')} — ${raisonTexte(v)}`);
  return (
    <div data-nc-tableau={String(x.total)}>
      <div className="nc-entonnoir" role="table" aria-label={tr('nc.tableau')}>
        {marches.map(([k, v]) => (
          <div key={k} className="nc-marche" role="row" data-nc-marche={k} data-valeur={v == null ? '' : String(v)}>
            <span role="cell" className="nc-marche-lib">{tr('nc.' + k)}</span>
            <span role="cell" className="nc-marche-barre" aria-hidden="true"><i style={{ width: v == null ? 0 : `${Math.round((v / max) * 100)}%` }} /></span>
            <span role="cell" className="nc-marche-n">{chiffre(v)}</span>
          </div>
        ))}
      </div>
      {x.arrets ? (
        <>
          <h4 className="nc-sous">{tr('nc.arret')}</h4>
          <ul className="nc-liste" data-nc-arrets="">
            {['cree', 'ouvert', 'extension', 'lecture'].map((k) => <li key={k} data-nc-arret={k}><span>{tr('nc.arret.' + k)}</span><b>{x.arrets[k]}</b></li>)}
          </ul>
        </>
      ) : null}
      {x.etapes ? (
        <>
          <h4 className="nc-sous">{tr('nc.etapes')}</h4>
          <ul className="nc-liste" data-nc-etapes="">
            {[...ETAPES_NOUVEAU, 'fini'].map((k, j) => <li key={k} data-nc-etape-n={k}><span>{k === 'fini' ? tr('nc.parcoursFini') : `${j + 1} · ${tr('pn.court.' + k)}`}</span><b>{x.etapes[k]}</b></li>)}
          </ul>
          {x.sansMesureParcours ? <p className="nc-note" data-nc-manque="parcours">{tr('nc.manque', { quoi: tr('nc.manque.parcours') })} ({x.sansMesureParcours})</p> : null}
        </>
      ) : null}
      {Array.isArray(x.semaines) && x.semaines.length ? (
        <>
          <h4 className="nc-sous">{tr('nc.semaine')}</h4>
          <ul className="nc-liste" data-nc-semaines={x.semaines.length}>
            {x.semaines.map((s) => <li key={s.semaine}><span>{dateI18n(s.semaine + 'T12:00:00Z', { day: 'numeric', month: 'short' })}</span><b>{s.n}</b></li>)}
          </ul>
        </>
      ) : null}
      {manques.map((m) => <p key={m} className="nc-note" data-nc-manque="">{tr('nc.manque', { quoi: m })}</p>)}
    </div>
  );
}

export default function NouveauxComptes({ entetes, fetcher = (typeof fetch === 'function' ? fetch.bind(window) : null) }) {
  useLangue();
  return (
    <div className="nc" data-nouveaux-comptes="">
      <Apercu />
      <section className="nc-bloc">
        <h3 className="nc-titre">{tr('nc.tableau')}</h3>
        <p className="nc-note">{tr('nc.tableau.note')}</p>
        <Tableau entetes={entetes} fetcher={fetcher} />
      </section>
    </div>
  );
}
