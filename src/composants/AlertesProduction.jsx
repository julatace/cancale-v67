// ════════════════════════════════════════════════════════════════════════════
//  « ALERTES » — Paramètres → Tout va bien ? (11 nov., lot alertes-production)
// ════════════════════════════════════════════════════════════════════════════
// Au PROPRIÉTAIRE seulement (la route refuse les autres, 403 ⇒ rien n'est
// affiché) : les dernières alertes de production et un interrupteur par type
// (`/api/compte?mode=alertes`, règle : api/_lib/alertes-production.js).
// Trois états : en cours · pas su (« Réessayer ») · lu. Un interrupteur dont
// l'écriture n'est pas confirmée revient à son état lu.
import React from 'react';
import { GroupeIos, RangeeIos } from './Ios.jsx';

export const TYPES_ALERTES = [
  ['plantage', 'Un écran plante', 'Chez un vendeur, erreur ou écran tombé.'],
  ['emails', 'Réception des e-mails', 'Silence anormal ou refus en série.'],
  ['colis', 'Vérification des colis', 'Passage en panne, transporteur refusé.'],
  ['sante', 'Santé de VRM', 'Base, connexion, envoi, notifications.'],
];
const quand = (iso) => {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const d = new Date(t);
  const auj = new Date().toDateString() === d.toDateString();
  try { return auj ? `à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`; } catch (_) { return ''; }
};

export function AlertesProduction({ entetes, fetcher = (typeof fetch === 'function' ? fetch.bind(globalThis) : null) }) {
  const [etat, setEtat] = React.useState(undefined);   // undefined · null (pas su) · 'refuse' · objet
  const [envoi, setEnvoi] = React.useState('');
  const lire = React.useCallback(async () => {
    setEtat(undefined);
    try {
      const r = await fetcher('/api/compte?mode=alertes', { headers: entetes ? entetes() : {}, cache: 'no-store' });
      if (r.status === 403) { setEtat('refuse'); return; }
      const j = await r.json().catch(() => null);
      setEtat(r.ok && j && j.ok === true && Array.isArray(j.alertes) ? j : null);
    } catch (_) { setEtat(null); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);
  const basculer = async (type, actif) => {
    if (!etat || typeof etat !== 'object') return;
    const avant = etat;
    setEnvoi(type);
    setEtat({ ...etat, reglages: { ...etat.reglages, [type]: actif } });
    try {
      const r = await fetcher('/api/compte?mode=alertes', { method: 'POST', headers: { ...(entetes ? entetes() : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ type, actif }) });
      const j = await r.json().catch(() => null);
      setEtat(r.ok && j && j.ok === true ? j : avant);
    } catch (_) { setEtat(avant); }
    setEnvoi('');
  };
  if (etat === 'refuse') return null;
  if (etat === undefined) return <div data-alertes-prod="lecture"><GroupeIos titre="Alertes sur ton iPhone"><RangeeIos titre="Lecture…"/></GroupeIos></div>;
  if (etat === null) return (
    <div data-alertes-prod="pas-su">
      <GroupeIos titre="Alertes sur ton iPhone" pied="Pas su : le serveur n’a pas répondu.">
        <RangeeIos titre="Réessayer" onClick={lire} data-alertes-reessayer=""/>
      </GroupeIos>
    </div>
  );
  const { reglages = {}, alertes = [] } = etat;
  return (
    <div data-alertes-prod={alertes.length}>
      <GroupeIos titre="Alertes sur ton iPhone" pied="Une alerte par heure au plus, sans rien d’un vendeur.">
        {TYPES_ALERTES.map(([t, titre, detail]) => (
          <RangeeIos key={t} titre={titre} detail={detail} data-alerte-type={t}
            interrupteur={{ on: reglages[t] !== false, disabled: envoi === t, label: titre, onChange: (v) => basculer(t, v), attrs: { 'data-alerte-interrupteur': t } }}/>
        ))}
      </GroupeIos>
      <GroupeIos titre="Dernières alertes" pied={alertes.length ? 'Gardées 30 jours.' : null}>
        {!alertes.length ? <RangeeIos titre="Aucune alerte ces 30 jours" data-alertes-vide=""/> : alertes.map((a) => (
          <RangeeIos key={a.cle} titre={a.titre} data-alerte={a.cle} data-alerte-nature={a.nature} data-alerte-n={a.n}
            detail={[a.corps, [quand(a.dernier), a.coupe ? 'coupée' : a.attente ? 'pas encore envoyée' : a.notifieA ? `envoyée ${quand(a.notifieA)}` : ''].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')}
            valeur={`${a.n}×`} ton={a.nature !== 'muette' && Date.now() - (Date.parse(a.dernier || '') || 0) < 864e5 ? 'geste' : undefined}/>
        ))}
      </GroupeIos>
    </div>
  );
}
export default AlertesProduction;
