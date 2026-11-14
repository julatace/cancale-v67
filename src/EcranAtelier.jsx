// ── L'ÉCRAN D'ATELIER (14 nov., lot 118) ─────────────────────────────────────
// Un plein écran à laisser allumé sur un ordinateur ou une tablette : les colis du
// jour (à envoyer, à retirer avec leur code) et le chiffre du jour. La règle :
// src/atelierEcran.js. LECTURE SEULE : aucun bouton n'agit sur une vente, un colis ou
// un N° — on ne fait que regarder (le seul geste : « Fermer »). Mis à jour tout seul :
// relu toutes les 60 s, à chaque publication de l'app (`vrm:save`, `storage`), et au
// retour de l'onglet. L'écran reste allumé par Wake Lock quand le navigateur le permet
// (sinon une ligne le dit : « l'écran peut se mettre en veille »).
// Ouverture : Paramètres → « Écran d'atelier », ou l'adresse `?atelier`.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { vueAtelier, ATELIER_RELECTURE_MS } from './atelierEcran.js';
import './styles-confort.css';
// « 2026-11-15 » ⇒ « sam. 15 nov. » (la langue de l'appareil).
export const jourCourt = (j) => { try { return /^\d{4}-\d{2}-\d{2}$/.test(j) ? new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(j + 'T12:00:00')) : ''; } catch (_) { return j; } };

const lireJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const euros = (v) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v); } catch (_) { return `${Math.round(v)} €`; } };
const heureMaintenant = () => { try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()); } catch (_) { return ''; } };

export function useVueAtelier(uid, { maintenant = null } = {}) {
  const lire = React.useCallback(() => vueAtelier({ photo: lireJson('vrm_hl_photo_' + uid), benefice: lireJson('vrm_benefice_jours'), maintenant: maintenant != null ? maintenant : Date.now() }), [uid, maintenant]);
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    const maj = () => setV(lire());
    const t = setInterval(maj, ATELIER_RELECTURE_MS);
    const vis = () => { if (document.visibilityState === 'visible') maj(); };
    window.addEventListener('vrm:save', maj); window.addEventListener('storage', maj); document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); window.removeEventListener('vrm:save', maj); window.removeEventListener('storage', maj); document.removeEventListener('visibilitychange', vis); };
  }, [lire]);
  return v;
}

// Wake Lock : demandé à l'ouverture, redemandé au retour de l'onglet (le navigateur le
// relâche quand l'onglet est caché). Rend 'actif' · 'indisponible'.
function useEcranAllume() {
  const [etat, setEtat] = React.useState('indisponible');
  React.useEffect(() => {
    let verrou = null, fini = false;
    const demander = async () => {
      try {
        if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
        verrou = await navigator.wakeLock.request('screen');
        if (fini) { verrou.release().catch(() => {}); return; }
        setEtat('actif');
        verrou.addEventListener('release', () => { if (!fini) setEtat('indisponible'); });
      } catch (_) { setEtat('indisponible'); }
    };
    demander();
    const vis = () => { if (document.visibilityState === 'visible') demander(); };
    document.addEventListener('visibilitychange', vis);
    return () => { fini = true; document.removeEventListener('visibilitychange', vis); try { if (verrou) verrou.release(); } catch (_) {} };
  }, []);
  return etat;
}

export default function EcranAtelier({ uid, onFermer }) {
  useLangue();
  const v = useVueAtelier(uid);
  const allume = useEcranAllume();
  const [heure, setHeure] = React.useState(heureMaintenant);
  React.useEffect(() => { const t = setInterval(() => setHeure(heureMaintenant()), 15000); return () => clearInterval(t); }, []);
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onFermer(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onFermer]);
  const chiffre = (val, lib, attr) => <div className="vrm-at-chiffre" {...attr}><b>{val}</b><span>{lib}</span></div>;
  const corps = (
    <div className="vrm-at vrm-cf" role="dialog" aria-modal="true" aria-label={tr('confort.atelier.titre')} data-atelier="" data-atelier-allume={allume}>
      <div className="vrm-at-tete">
        <span className="vrm-at-heure" data-atelier-heure="">{heure}</span>
        <button type="button" className="vrm-cf-second" onClick={onFermer} data-atelier-fermer="">{tr('confort.fermer')}</button>
      </div>
      <div className="vrm-at-bande">
        {chiffre(v.envoyer ? v.envoyer.n : '—', v.envoyer && v.envoyer.retard ? tr('confort.atelier.aEnvoyerRetard', { n: v.envoyer.retard }) : tr('confort.atelier.aEnvoyer'), { 'data-atelier-envoyer': v.envoyer ? v.envoyer.n : 'pas-su' })}
        {chiffre(v.retirer ? v.retirer.n : '—', tr('confort.atelier.aRetirer'), { 'data-atelier-retirer': v.retirer ? v.retirer.n : 'pas-su' })}
        {chiffre(v.jour ? euros(v.jour.ca) : '—', v.jour ? tr('confort.atelier.venduJour', { n: v.jour.n }) : tr('confort.atelier.jourPasSu'), { 'data-atelier-jour': v.jour ? v.jour.n : 'pas-su' })}
      </div>
      {!v.envoyer ? <p className="vrm-cf-doux" data-atelier-sans-photo="">{tr('confort.atelier.sansPhoto')}</p> : (
        <div className="vrm-at-cols">
          <section>
            <h2>{tr('confort.atelier.envoyerTitre')}</h2>
            {v.envoyer.lignes.length ? <ul className="vrm-cf-liste">{v.envoyer.lignes.map((l, i) => (
              <li key={'e' + i + l.numero + l.titre} data-atelier-colis={l.numero || ''}>
                <span className="vrm-cf-num">{l.numero ? `N°${l.numero}` : '—'}</span>
                <span className="vrm-cf-txt"><b>{l.titre || tr('confort.sansTitre')}</b><small>{l.retard ? <><i className="vrm-cf-point"/>{tr('confort.atelier.enRetard')}</> : l.limite ? tr('confort.atelier.avant', { jour: jourCourt(l.limite), heure: l.heure || '' }) : ''}{l.transporteur ? ` · ${l.transporteur}` : ''}</small></span>
              </li>))}</ul> : <p className="vrm-cf-doux">{tr('confort.atelier.rienEnvoyer')}</p>}
          </section>
          <section>
            <h2>{tr('confort.atelier.retirerTitre')}</h2>
            {v.retirer.lignes.length ? <ul className="vrm-cf-liste">{v.retirer.lignes.map((l, i) => (
              <li key={'r' + i + l.code + l.titre} data-atelier-retrait="">
                <span className="vrm-cf-txt"><b>{l.titre || l.transporteur || tr('confort.sansTitre')}</b><small>{l.dernierJour ? <><i className="vrm-cf-point"/>{tr('confort.atelier.dernierJour')}</> : l.limite ? tr('confort.atelier.jusquau', { jour: jourCourt(l.limite) }) : ''}{l.lieu ? ` · ${l.lieu}` : ''}</small></span>
                {l.code ? <span className="vrm-at-code">{l.code}</span> : null}
              </li>))}</ul> : <p className="vrm-cf-doux">{tr('confort.atelier.rienRetirer')}</p>}
          </section>
        </div>)}
      <div className="vrm-at-pied">
        <p className="vrm-cf-doux" data-atelier-maj="">{v.photoAt ? tr(v.vieux ? 'confort.atelier.majVieille' : 'confort.atelier.maj', { heure: new Date(v.photoAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }) : ''}{allume === 'actif' ? '' : ' ' + tr('confort.atelier.veille')}</p>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}
