// ── LE LIEN TEMPORAIRE POUR TON AIDE (14 nov., lot 120) ─────────────────────────
// Les garanties : api/_lib/lien-aide.js (signé, 24 h, révocable, lecture seule,
// journalisé, aucun montant — la projection est src/lienAideProjection.js).
//   · `ReglageLienAide` (Paramètres) : créer un lien, le copier / le partager, voir
//     les ouvertures, le couper.
//   · `useLienAideAJour` (monté par la coque) : tant qu'un lien est actif, la photo
//     de ses colis (celle de Ma journée, écrite après une lecture COMPLÈTE) est
//     renvoyée quand elle change — l'aide voit la liste d'aujourd'hui.
//   · `VueLienAide` (la page `?aide=…`, sans compte) : les colis à envoyer, à
//     retirer avec leur code, l'impression des bordereaux. Aucun autre geste.
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { projectionLienAide } from './lienAideProjection.js';
import { lirePhoto } from './journeeHorsLigne.js';
import './styles-confort.css';
// « 2026-11-15 » ⇒ « sam. 15 nov. » (la langue de l'appareil).
export const jourCourt = (j) => { try { return /^\d{4}-\d{2}-\d{2}$/.test(j) ? new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(j + 'T12:00:00')) : ''; } catch (_) { return j; } };

const ROUTE = '/api/compte?mode=lien-aide';
export const PARAM_AIDE = 'aide';
const CLE_ACTIFS = 'vrm_lien_aide_actifs';   // sur cet appareil : [{ id, exp }] — de quoi savoir s'il faut renvoyer la photo
const appel = async (methode, corps, entetes = {}, q = '') => {
  try {
    const r = await fetch(ROUTE + q, { method: methode, headers: { ...(corps ? { 'Content-Type': 'application/json' } : {}), ...entetes }, ...(corps ? { body: JSON.stringify(corps) } : {}), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, j: j || {} };
  } catch (_) { return { status: 0, j: {} }; }
};
const lireActifs = () => { try { const l = JSON.parse(localStorage.getItem(CLE_ACTIFS) || '[]'); return Array.isArray(l) ? l.filter((x) => x && x.id && Number(x.exp) > Date.now()) : []; } catch (_) { return []; } };
const ecrireActifs = (l) => { try { localStorage.setItem(CLE_ACTIFS, JSON.stringify(l)); } catch (_) {} };
const quand = (ms) => { try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)); } catch (_) { return ''; } };

export function useLienAideAJour(uid, entetes) {
  React.useEffect(() => {
    if (!uid) return undefined;
    let dernier = '';
    const envoyer = async () => {
      const actifs = lireActifs();
      if (!actifs.length) return;
      const photo = lirePhoto(uid, localStorage);
      if (!photo) return;
      const proj = projectionLienAide(photo);
      const sig = JSON.stringify(proj);
      if (sig === dernier) return;
      dernier = sig;
      for (const a of actifs) await appel('POST', { action: 'maj', id: a.id, projection: proj }, entetes());
    };
    const t = setInterval(envoyer, 5 * 60000);
    const f = () => { setTimeout(envoyer, 1500); };
    window.addEventListener('vrm:save', f);
    envoyer();
    return () => { clearInterval(t); window.removeEventListener('vrm:save', f); };
  }, [uid, entetes]);
}

export function ReglageLienAide({ uid, entetes, toast = () => {} }) {
  useLangue();
  const [liens, setLiens] = React.useState(undefined);
  const [neuf, setNeuf] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const charger = React.useCallback(async () => {
    const r = await appel('GET', null, entetes());
    setLiens(r.status === 200 && Array.isArray(r.j.liens) ? r.j.liens : null);
  }, [entetes]);
  React.useEffect(() => { charger(); }, [charger]);
  const photo = React.useMemo(() => { try { return lirePhoto(uid, localStorage); } catch (_) { return null; } }, [uid, liens]);
  const creer = async () => {
    if (!photo) return;
    setOccupe(true);
    const r = await appel('POST', { action: 'creer', projection: projectionLienAide(photo) }, entetes());
    setOccupe(false);
    if (r.status !== 200 || !r.j.jeton) { toast(tr(r.j.erreur === 'trop' ? 'confort.aide.trop' : 'confort.erreur')); return; }
    ecrireActifs([...lireActifs(), { id: r.j.id, exp: r.j.exp }]);
    setNeuf(`${location.origin}/?${PARAM_AIDE}=${r.j.jeton}`);
    charger();
  };
  const couper = async (id) => {
    setOccupe(true);
    const r = await appel('POST', { action: 'revoquer', id }, entetes());
    setOccupe(false);
    if (r.status !== 200) { toast(tr('confort.erreur')); return; }
    ecrireActifs(lireActifs().filter((x) => x.id !== id));
    if (neuf.includes(id)) setNeuf('');
    charger();
  };
  const partager = async () => {
    try { if (navigator.share) { await navigator.share({ title: tr('confort.aide.partageTitre'), url: neuf }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(neuf); toast(tr('confort.aide.copie')); } catch (_) {}
  };
  return (
    <div className="vrm-cf vrm-cf-pile" data-lien-aide="">
      <p className="vrm-cf-doux">{tr('confort.aide.explique')}</p>
      {!photo ? <p className="vrm-cf-doux vrm-cf-geste" data-lien-aide-sans-photo="">{tr('confort.aide.sansPhoto')}</p> : null}
      <button type="button" className="vrm-cf-primaire" disabled={!photo || occupe} onClick={creer} data-lien-aide-creer="">{tr('confort.aide.creer')}</button>
      {neuf ? <div className="vrm-cf-carte vrm-cf-pile" data-lien-aide-neuf="">
        <p className="vrm-cf-doux">{tr('confort.aide.pret')}</p>
        <code style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{neuf}</code>
        <button type="button" className="vrm-cf-second" onClick={partager}>{tr('confort.aide.partager')}</button>
      </div> : null}
      {liens === undefined ? <p className="vrm-cf-doux">{tr('confort.lecture')}</p>
        : liens === null ? <p className="vrm-cf-doux vrm-cf-geste">{tr('confort.erreur')}</p>
        : liens.length ? <ul className="vrm-cf-liste">{liens.map((l) => (
          <li key={l.id} data-lien-aide-ligne={l.actif ? 'actif' : (l.revoque ? 'coupe' : 'expire')}>
            <span className="vrm-cf-txt"><b>{l.actif ? tr('confort.aide.actif', { quand: quand(l.exp) }) : l.revoque ? tr('confort.aide.coupe') : tr('confort.aide.expire')}</b>
              <small>{tr('confort.aide.ouvertures', { n: l.ouvertures })}{l.journal && l.journal.length ? ` · ${tr('confort.aide.dernier', { quand: quand(l.journal[l.journal.length - 1].at) })}` : ''}</small></span>
            {l.actif ? <button type="button" className="vrm-cf-lien" disabled={occupe} onClick={() => couper(l.id)} data-lien-aide-couper={l.id}>{tr('confort.aide.couper')}</button> : null}
          </li>))}</ul> : null}
    </div>
  );
}

export function jetonAideDeLAdresse() {
  try { const v = new URL(window.location.href).searchParams.get(PARAM_AIDE); return v && /^[A-Za-z0-9_-]{22}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(v) ? v : ''; } catch (_) { return ''; }
}

export function VueLienAide({ jeton }) {
  useLangue();
  const [d, setD] = React.useState(undefined);
  const charger = React.useCallback(async () => {
    const r = await appel('GET', null, {}, `&t=${encodeURIComponent(jeton)}`);
    setD(r.status === 200 && r.j.projection ? r.j : r.status === 404 ? { fin: true } : null);
  }, [jeton]);
  React.useEffect(() => { charger(); const t = setInterval(charger, 5 * 60000); return () => clearInterval(t); }, [charger]);
  const p = d && d.projection;
  return (
    <div className="vrm-la vrm-cf" data-vue-lien-aide={d === undefined ? 'lecture' : d === null ? 'pas-su' : d.fin ? 'fin' : 'ok'}>
      <div className="vrm-la-col">
        <h1>{tr('confort.aide.pageTitre')}</h1>
        {d === undefined ? <p className="vrm-cf-doux">{tr('confort.lecture')}</p>
          : d === null ? <p className="vrm-cf-doux">{tr('confort.erreur')} <button type="button" className="vrm-cf-lien" onClick={charger}>{tr('confort.reessayer')}</button></p>
          : d.fin ? <p className="vrm-cf-doux" data-lien-aide-fin="">{tr('confort.aide.fini')}</p>
          : <>
            <p className="vrm-cf-doux">{tr('confort.aide.jusqua', { quand: quand(d.exp) })} · {tr('confort.aide.photoDe', { quand: quand(p.at) })}</p>
            <section>
              <h2>{tr('confort.aide.aEnvoyer', { n: p.nEnvoyer })}</h2>
              {p.envoyer.length ? <ul className="vrm-cf-liste">{p.envoyer.map((e, i) => (
                <li key={i} data-aide-envoyer={e.numero}>
                  <span className="vrm-cf-num">{e.numero ? `N°${e.numero}` : '—'}</span>
                  <span className="vrm-cf-txt"><b>{e.titre || tr('confort.sansTitre')}</b><small>{[e.limite ? tr('confort.atelier.avant', { jour: jourCourt(e.limite), heure: e.heure }) : '', e.transporteur].filter(Boolean).join(' · ')}</small></span>
                  {e.pdf && e.pdf[0] ? <a className="vrm-cf-lien" href={`${ROUTE}&t=${encodeURIComponent(jeton)}&bord=${encodeURIComponent(e.pdf[0])}`} target="_blank" rel="noopener noreferrer" data-aide-bordereau="">{tr('confort.aide.bordereau')}</a> : null}
                </li>))}</ul> : <p className="vrm-cf-doux">{tr('confort.atelier.rienEnvoyer')}</p>}
            </section>
            <section>
              <h2>{tr('confort.aide.aRetirer', { n: p.nRetirer })}</h2>
              {p.retirer.length ? <ul className="vrm-cf-liste">{p.retirer.map((r, i) => (
                <li key={i} data-aide-retirer="">
                  <span className="vrm-cf-txt"><b>{r.titre || r.transporteur || tr('confort.sansTitre')}</b><small>{[r.lieu, r.limite ? tr('confort.atelier.jusquau', { jour: jourCourt(r.limite) }) : ''].filter(Boolean).join(' · ')}</small></span>
                  {r.code ? <span className="vrm-at-code">{r.code}</span> : null}
                </li>))}</ul> : <p className="vrm-cf-doux">{tr('confort.atelier.rienRetirer')}</p>}
            </section>
            <p className="vrm-cf-doux">{tr('confort.aide.lectureSeule')}</p>
          </>}
      </div>
    </div>
  );
}
