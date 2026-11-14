// ═══════════════════════════════════════════════════════════════════════════
//  161 · « SIRI RÉPOND » — Paramètres → Siri et Raccourcis (14 nov., idées argent)
// ═══════════════════════════════════════════════════════════════════════════
// Créer un jeton personnel (le serveur le fabrique, n'en garde que l'empreinte, le
// rend UNE fois), copier les trois liens, les coller dans l'app Raccourcis (« Obtenir
// le contenu de l'URL » puis « Énoncer le texte »), couper le jeton à tout moment.
// Rien n'est créé sans son toucher ; couper demande confirmation (les raccourcis
// cessent de répondre). La route : api/_lib/siri-jeton.js (widget?mode=siri).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import './idees-argent.css';
import { tr, langueCourante } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { askConfirm, enTeteSession, toast } from '../App.jsx';
import { siriActif, EVT_SIRI } from './siriPublication.js';

export const QUESTIONS_SIRI = [
  { q: 'vendu', cle: 'vendu' },
  { q: 'retirer', cle: 'retirer' },
  { q: 'envoyer', cle: 'envoyer' },
];
export const lienSiri = (origine, q, jeton, langue = 'fr') => `${origine}/api/widget?mode=siri&q=${q}&l=${langue}&k=${encodeURIComponent(jeton)}`;
const dateCourte = (iso) => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (_) { return ''; } };

async function appeler(action) {
  try {
    const r = await fetch('/api/widget?mode=siri', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action, langue: langueCourante() }) });
    const j = await r.json().catch(() => null);
    return r.ok && j ? j : { erreur: (j && j.message) || tr('ia.siri.rate') };
  } catch (_) { return { erreur: tr('ia.siri.rate') }; }
}

export default function SiriJeton({ origine = (typeof window !== 'undefined' ? window.location.origin : 'https://vrm.center') }) {
  useLangue();
  const [etat, setEtat] = React.useState(undefined);   // undefined lecture · null pas su · { actif, at, debut }
  const [jeton, setJeton] = React.useState('');        // montré UNE fois, jamais rangé
  const [envoi, setEnvoi] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  React.useEffect(() => { let mort = false; siriActif().then((e) => { if (!mort) setEtat(e); }); return () => { mort = true; }; }, []);
  const creer = async () => {
    if (envoi) return;
    if (etat && etat.actif && !(await askConfirm({ title: tr('ia.siri.remplacerTitre'), desc: tr('ia.siri.remplacerDesc'), ok: tr('ia.siri.remplacer'), cancel: tr('ia.annuler') }))) return;
    setEnvoi(true); setErreur('');
    const r = await appeler('creer');
    setEnvoi(false);
    if (r.erreur || !r.jeton) { setErreur(r.erreur || tr('ia.siri.rate')); return; }
    setJeton(r.jeton); setEtat({ actif: true, at: r.at, debut: r.debut });
    try { window.dispatchEvent(new Event(EVT_SIRI)); } catch (_) {}
  };
  const couper = async () => {
    if (envoi) return;
    if (!(await askConfirm({ title: tr('ia.siri.couperTitre'), desc: tr('ia.siri.couperDesc'), ok: tr('ia.siri.couper'), cancel: tr('ia.annuler') }))) return;
    setEnvoi(true); setErreur('');
    const r = await appeler('revoquer');
    setEnvoi(false);
    if (r.erreur) { setErreur(r.erreur); return; }
    setJeton(''); setEtat({ actif: false });
    try { window.dispatchEvent(new Event(EVT_SIRI)); } catch (_) {}
    toast(tr('ia.siri.coupe'));
  };
  const copier = async (t) => { try { await navigator.clipboard.writeText(t); toast(tr('ia.siri.copie')); } catch (_) { toast(tr('ia.siri.copieRatee'), 'err'); } };
  const langue = langueCourante();
  return (
    <section className="ia" data-siri-jeton={etat === undefined ? 'lecture' : etat === null ? 'passu' : etat.actif ? 'actif' : 'aucun'} aria-label={tr('ia.siri.titre')}>
      <span className="ia-lib">{tr('ia.siri.titre')}</span>
      <p className="ia-note">{tr('ia.siri.intro')}</p>
      {etat === undefined ? <p className="ia-note">{tr('ia.siri.lecture')}</p> : null}
      {etat === null ? <p className="ia-note is-geste" role="status">{tr('ia.siri.passu')}</p> : null}
      {etat && etat.actif && !jeton ? <p className="ia-note" data-siri-actif-depuis="">{tr('ia.siri.actif', { date: dateCourte(etat.at), debut: etat.debut || '…' })}</p> : null}
      {jeton ? (<div className="ia" data-siri-liens="">
        <p className="ia-note is-geste" role="status">{tr('ia.siri.uneFois')}</p>
        <ul className="ia-liste">
          {QUESTIONS_SIRI.map((x) => {
            const l = lienSiri(origine, x.q, jeton, langue);
            return <li key={x.q} className="sb-rangee" data-siri-lien={x.q} style={{ display: 'grid', gap: 6 }}>
              <b>{tr('ia.siri.q.' + x.cle)}</b>
              <small className="ia-note" style={{ wordBreak: 'break-all' }}>{l}</small>
              <button type="button" className="sb-touche" data-siri-copier={x.q} onClick={() => copier(l)}>{tr('ia.siri.copier')}</button>
            </li>;
          })}
        </ul>
        <ol className="ia-note" data-siri-etapes="" style={{ paddingLeft: 20, display: 'grid', gap: 4 }}>
          <li>{tr('ia.siri.etape1')}</li><li>{tr('ia.siri.etape2')}</li><li>{tr('ia.siri.etape3')}</li><li>{tr('ia.siri.etape4')}</li>
        </ol>
      </div>) : null}
      {erreur ? <p className="ia-note is-geste" role="alert" data-siri-erreur="">{erreur}</p> : null}
      {etat !== undefined ? <div className="ia-gestes">
        <button type="button" className="sb-touche" data-siri-creer="" disabled={envoi || etat === null} onClick={creer}>{envoi ? '…' : etat && etat.actif ? tr('ia.siri.nouveau') : tr('ia.siri.creer')}</button>
        {etat && etat.actif ? <button type="button" className="sb-lien" data-siri-couper="" disabled={envoi} onClick={couper}>{tr('ia.siri.couper')}</button> : null}
      </div> : null}
      <details className="ia-repli" data-siri-vente-main="">
        <summary>{tr('ia.siri.venteMainTitre')}</summary>
        <p className="ia-note">{tr('ia.siri.venteMainNote')}</p>
        <button type="button" className="sb-touche" data-siri-copier="vente-main" onClick={() => copier(`${origine}/?idee=vente-main`)}>{tr('ia.siri.copier')}</button>
      </details>
    </section>
  );
}
