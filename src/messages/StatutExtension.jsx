// ── src/messages/StatutExtension.jsx — la ligne « Extension » en tête de Messages (28 nov., messages-parfaits) ──────────────
// Trois états VRAIS et DATÉS (règle : src/messages/statutExtension.js) : connectée et à jour · connectée mais différente
// (version, compte) · pas joignable. Revérifiée à l'ouverture de Messages, toutes les 30 s tant que l'écran est montré, et
// sur « Revérifier » ; avant chaque geste, la porte revérifie elle-même (src/agir/porte.js `poserReverifAgir`).
// `useStatutExtension()` est LA source de l'intertitre « Compte de l'onglet » (une seule règle, plus deux qui se contredisent).
import React from 'react';
import { tr } from '../i18n/index.js';
import { useFaitsAgir } from '../agir/porte.js';
import { reverifierExtension, extensionVerifiee, onVmrExt } from '../App.jsx';
import { statutExtension } from './statutExtension.js';
import { Bouton } from '../natif/Bouton.jsx';

export function useStatutExtension({ verifier = false } = {}) {
  const faits = useFaitsAgir();
  const [, maj] = React.useReducer((x) => x + 1, 0);
  const [enCours, setEnCours] = React.useState(false);
  React.useEffect(() => { const off = onVmrExt(maj); const t = setInterval(maj, 5000); return () => { clearInterval(t); if (typeof off === 'function') off(); }; }, []);
  const revoir = React.useCallback(async () => { setEnCours(true); try { await reverifierExtension(2500); } finally { setEnCours(false); maj(); } }, []);
  React.useEffect(() => {
    if (!verifier) return undefined;
    revoir();
    const t = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) reverifierExtension(2500).then(maj, maj); }, 30000);
    const vu = () => { if (!document.hidden) revoir(); };
    document.addEventListener('visibilitychange', vu);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vu); };
  }, [verifier, revoir]);
  const v = extensionVerifiee();
  const comptes = (faits && faits.noms && faits.noms.vinted) || {};
  const s = statutExtension({ faits, at: v.at, essai: v.essai, maintenant: Date.now(), comptes });
  return { ...s, enCours, revoir };
}

const heure = (t) => { try { return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return ''; } };

export function StatutExtensionMessages() {
  const s = useStatutExtension({ verifier: true });
  const vars = { compte: '—', version: '', attendue: '', email: '', garder: '', ou: '', autre: '', s: 0, ...(s.vars || {}) };
  const quand = s.at ? tr('mparf.statut.verifie', { h: heure(s.at) }) : '';
  return (
    <div className="n-msg-statut" role="status" aria-live="polite" data-msg-statut={s.etat} data-msg-statut-code={s.code} data-msg-statut-compte={s.compte || undefined} data-msg-statut-at={s.at ? String(s.at) : ''}>
      <span className="n-msg-statut-point" aria-hidden="true"/>
      <span className="n-msg-statut-t">
        <b>{tr('mparf.statut.' + (s.etat === 'ok' ? 'titreOk' : s.etat === 'ecart' ? 'titreEcart' : s.etat === 'injoignable' ? 'titreInjoignable' : 'titreVerif'))}</b>
        <span className="n-msg-statut-phrase">{tr(s.cle, vars)}</span>
        {quand ? <small className="n-msg-statut-quand">{quand}</small> : null}
      </span>
      <Bouton variante="texte" chargement={s.enCours} onClick={s.revoir} attrs={{ 'data-msg-statut-revoir': '' }}>{tr('mparf.statut.revoir')}</Bouton>
    </div>
  );
}
export default StatutExtensionMessages;
