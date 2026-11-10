// ── « ÉCHÉANCES DANS L'AGENDA » — Paramètres → Notifications (10 nov., lot H) ──
// Un lien d'abonnement (.ics) que Calendrier iPhone ou Google Agenda relisent
// tout seuls : déclaration URSSAF, colis à déposer, retraits qui expirent —
// seulement des dates LUES (api/_lib/agenda-ics.js). Le lien porte un jeton
// secret créé par le serveur ; « Changer le lien » tue l'ancien, « Couper » tue tout.
// Trois états : `undefined` en cours · `{erreur}` pas su · `{actif, url}` lu.
import React from 'react';
import { BoutonBase as Bouton } from './Bouton.jsx';
import { webcal, googleAgenda } from '../agendaEcheances.js';
import './agenda-echeances.css';

const CE_QUI_Y_EST = [
  ['urssaf', 'Déclaration URSSAF', 'le dernier jour pour déclarer'],
  ['envoi', 'Colis à déposer', 'l’heure limite lue sur le bordereau'],
  ['retrait', 'Colis à retirer', 'le dernier jour lu pour le retirer'],
];

export default function AgendaEcheances({ enTete = () => ({}), toast = () => {}, confirmer = async () => true, envoyer, ouvrir }) {
  const f = envoyer || ((...a) => fetch(...a));
  const aller = ouvrir || ((u) => { try { window.location.href = u; } catch (_) {} });
  const [etat, setEtat] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const appel = React.useCallback(async (init) => {
    try {
      const r = await f('/api/compte?mode=agenda', { ...(init || {}), headers: { ...enTete(), ...(init && init.body ? { 'Content-Type': 'application/json' } : {}) } });
      const j = await r.json().catch(() => null);
      return r.status === 200 && j && j.ok === true ? { actif: !!j.actif, url: String(j.url || '') } : { erreur: (j && j.message) || 'Je n’ai pas pu lire ton agenda. Réessaie.' };
    } catch (_) { return { erreur: 'Pas de réseau. Réessaie.' }; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => { appel().then(setEtat); }, [appel]);
  const agir = async (action) => {
    setOccupe(action);
    const r = await appel({ method: 'POST', body: JSON.stringify({ action }) });
    setOccupe('');
    if (r.erreur) { toast('⚠️ ' + r.erreur, 'err'); return null; }
    setEtat(r);
    return r;
  };
  const ajouter = async () => {
    const r = etat && etat.actif ? etat : await agir('creer');
    if (r && r.url) aller(webcal(r.url));
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(etat.url); toast('✓ Lien copié.', 'ok'); } catch (_) { toast('Copie impossible ici : appuie longuement sur le lien.', 'info'); }
  };
  const changer = async () => {
    if (!(await confirmer({ title: 'Changer le lien ?', desc: 'L’ancien lien cessera de marcher. Réabonne ton agenda au nouveau.', ok: 'Changer le lien', cancel: 'Annuler' }))) return;
    if (await agir('regenerer')) toast('✓ Nouveau lien. Ajoute-le à ton agenda.', 'ok');
  };
  const couper = async () => {
    if (!(await confirmer({ title: 'Couper le lien ?', desc: 'Ton agenda ne recevra plus tes échéances.', ok: 'Couper', cancel: 'Annuler', danger: true }))) return;
    if (await agir('couper')) toast('✓ Lien coupé.', 'ok');
  };
  const actif = !!(etat && !etat.erreur && etat.actif);
  return (
    <div className="vrm-agenda" data-agenda={etat === undefined ? 'lecture' : etat.erreur ? 'pas-su' : actif ? 'actif' : 'inactif'}>
      <div className="vrm-sec-liste">
        {CE_QUI_Y_EST.map(([id, titre, sous]) => (
          <div key={id} className="vrm-sec-ligne" data-agenda-type={id}>
            <span className="vrm-agenda-date" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/></svg></span>
            <div className="vrm-sec-corps"><span className="vrm-sec-titre">{titre}</span><span className="vrm-sec-sous">{sous}</span></div>
          </div>
        ))}
      </div>
      <p className="vrm-agenda-note">Rien d’autre : ni titre, ni acheteur, ni montant.</p>
      {etat === undefined ? <div className="vrm-sec-liste"><div className="vrm-sec-vide">…</div></div>
        : etat.erreur ? (
          <div className="vrm-sec-liste"><div className="vrm-sec-ligne" data-agenda-erreur=""><div className="vrm-sec-corps"><span className="vrm-sec-sous" style={{ whiteSpace: 'normal' }}>{etat.erreur}</span></div><button type="button" className="vrm-sec-bouton" onClick={() => { setEtat(undefined); appel().then(setEtat); }}>Réessayer</button></div></div>
        ) : (
          <div className="vrm-agenda-actions">
            {actif
              ? <Bouton variante="primaire" plein icone="calendar" href={webcal(etat.url)} data-agenda-ajouter="">Ajouter à mon agenda</Bouton>
              : <Bouton variante="primaire" plein icone="calendar" occupe={occupe === 'creer'} onClick={ajouter} data-agenda-ajouter="">Ajouter à mon agenda</Bouton>}
            {actif && <Bouton variante="secondaire" plein href={googleAgenda(etat.url)} target="_blank" rel="noopener noreferrer" data-agenda-google="">Google Agenda</Bouton>}
            {actif && (
              <div className="vrm-agenda-gestes">
                <button type="button" className="vrm-lien-action" onClick={copier} data-agenda-copier="">Copier le lien</button>
                <button type="button" className="vrm-lien-action" onClick={changer} disabled={!!occupe} data-agenda-changer="">Changer le lien</button>
                <button type="button" className="vrm-lien-action" onClick={couper} disabled={!!occupe} data-agenda-couper="">Couper</button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
