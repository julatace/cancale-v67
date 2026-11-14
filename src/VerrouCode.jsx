// ── LE CODE À 4 CHIFFRES À L'OUVERTURE (14 nov., lot 127) ─────────────────────
// La règle : src/codeLocal.js. ⚠️ Pas une sécurité du serveur — gardé sur CET appareil
// seulement ; le réglage le dit en une ligne.
//   · `VerrouCode` (posé par la coque au-dessus de l'app) : verrouille à l'ouverture
//     et au retour après N minutes en arrière-plan ; 5 erreurs ⇒ `onDeconnexion`
//     (la déconnexion propre de l'app) ; « Code oublié ? » ⇒ la même déconnexion.
//   · `ReglageCodeLocal` (Paramètres) : poser, changer le délai, retirer.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireCode, ecrireCode, essayerCode, fabriquerCode, doitVerrouiller, codeValide, codeTropSimple, CODE_APRES_MIN, CODE_APRES_DEFAUT } from './codeLocal.js';
import './styles-confort.css';

const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null);
const alea = (u8) => crypto.getRandomValues(u8);

function Pave({ titre, sous, onCode, faux = false, desactive = false, pied = null }) {
  const [c, setC] = React.useState('');
  React.useEffect(() => { if (faux) setC(''); }, [faux]);
  const taper = (x) => { if (desactive) return; setC((v) => { const n = (v + x).slice(0, 4); if (n.length === 4) setTimeout(() => { onCode(n); setC(''); }, 60); return n; }); };
  React.useEffect(() => {
    const k = (e) => { if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (/^\d$/.test(e.key)) taper(e.key); else if (e.key === 'Backspace') setC((v) => v.slice(0, -1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  return (
    <>
      <h1 className="vrm-cf-titre" style={{ fontSize: 22 }}>{titre}</h1>
      {sous ? <p className="vrm-cf-doux">{sous}</p> : null}
      <div className={'vrm-vc-points' + (faux ? ' is-faux' : '')} aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < c.length ? 'is-plein' : ''}/>)}</div>
      <div className="vrm-vc-pave" role="group" aria-label={titre}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((x, i) => x === '' ? <span key={i} className="is-vide"/>
          : <button key={i} type="button" disabled={desactive} aria-label={x === '⌫' ? tr('confort.code.effacer') : x} data-pave={x === '⌫' ? 'effacer' : x}
              onClick={() => (x === '⌫' ? setC((v) => v.slice(0, -1)) : taper(x))}>{x}</button>)}
      </div>
      {pied}
    </>
  );
}

export function VerrouCode({ onDeconnexion }) {
  useLangue();
  const [verrou, setVerrou] = React.useState(() => doitVerrouiller(lireCode(localStorage), { ouverture: true }));
  const [faux, setFaux] = React.useState(0);
  const [reste, setReste] = React.useState(null);
  const cachee = React.useRef(null);
  React.useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') cachee.current = Date.now();
      else if (doitVerrouiller(lireCode(localStorage), { cacheeDepuis: cachee.current })) setVerrou(true);
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  if (!verrou || !subtle()) return null;
  const essayer = async (c) => {
    const r = await essayerCode(c, localStorage, { subtle: subtle() });
    if (r.ok) { setVerrou(false); setReste(null); return; }
    if (r.deconnecter) { setVerrou(false); onDeconnexion(); return; }
    setReste(r.reste); setFaux((x) => x + 1);
  };
  const corps = (
    <div className="vrm-vc vrm-cf" role="dialog" aria-modal="true" aria-label={tr('confort.code.titre')} data-verrou-code="" data-verrou-reste={reste == null ? '' : reste}>
      <Pave titre={tr('confort.code.titre')} sous={reste != null ? tr('confort.code.faux', { n: reste }) : ''} onCode={essayer} faux={!!faux} key={faux}
        pied={<button type="button" className="vrm-cf-lien" onClick={() => { ecrireCode(localStorage, null); setVerrou(false); onDeconnexion(); }} data-verrou-oublie="">{tr('confort.code.oublie')}</button>}/>
    </div>
  );
  return createPortal(corps, document.body);
}

export function ReglageCodeLocal({ toast = () => {} }) {
  useLangue();
  const [r, setR] = React.useState(() => lireCode(localStorage));
  const [etape, setEtape] = React.useState('');      // '' · choisir · confirmer
  const [premier, setPremier] = React.useState('');
  const [msg, setMsg] = React.useState('');
  if (!subtle()) return <p className="vrm-cf-doux">{tr('confort.code.indisponible')}</p>;
  const choisir = (c) => {
    if (!codeValide(c) || codeTropSimple(c)) { setMsg(tr('confort.code.tropSimple')); return; }
    setPremier(c); setMsg(''); setEtape('confirmer');
  };
  const confirmer = async (c) => {
    if (c !== premier) { setMsg(tr('confort.code.pasPareil')); setEtape('choisir'); return; }
    const n = await fabriquerCode(c, { subtle: subtle(), alea, apresMin: r ? r.apresMin : CODE_APRES_DEFAUT });
    if (!n || !ecrireCode(localStorage, n)) { setMsg(tr('confort.erreur')); return; }
    setR(n); setEtape(''); setPremier(''); toast(tr('confort.code.pose'));
  };
  if (etape) return (
    <div className="vrm-cf vrm-cf-pile" style={{ alignItems: 'center', textAlign: 'center' }} data-reglage-code={etape}>
      <Pave titre={tr(etape === 'choisir' ? 'confort.code.choisir' : 'confort.code.confirmer')} sous={msg} onCode={etape === 'choisir' ? choisir : confirmer} key={etape + msg}/>
      <button type="button" className="vrm-cf-lien" onClick={() => { setEtape(''); setMsg(''); }}>{tr('confort.annuler')}</button>
    </div>
  );
  return (
    <div className="vrm-cf vrm-cf-pile" data-reglage-code={r ? 'pose' : 'aucun'}>
      <p className="vrm-cf-doux">{tr('confort.code.explique')}</p>
      <p className="vrm-cf-doux" data-code-pas-serveur="">{tr('confort.code.pasServeur')}</p>
      {r ? <>
        <label className="vrm-cf-champ">{tr('confort.code.apres')}
          <select value={r.apresMin} onChange={(e) => { const n = { ...r, apresMin: Number(e.target.value) }; ecrireCode(localStorage, n); setR(n); }} data-code-apres="">
            {CODE_APRES_MIN.map((m) => <option key={m} value={m}>{tr('confort.code.minutes', { n: m })}</option>)}
          </select>
        </label>
        <div className="vrm-cf-rangee">
          <button type="button" className="vrm-cf-second" onClick={() => setEtape('choisir')} data-code-changer="">{tr('confort.code.changer')}</button>
          <button type="button" className="vrm-cf-lien" onClick={() => { ecrireCode(localStorage, null); setR(null); toast(tr('confort.code.retire')); }} data-code-retirer="">{tr('confort.code.retirer')}</button>
        </div>
      </> : <button type="button" className="vrm-cf-primaire" onClick={() => setEtape('choisir')} data-code-poser="">{tr('confort.code.poser')}</button>}
    </div>
  );
}
