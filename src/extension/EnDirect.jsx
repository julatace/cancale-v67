// ── src/extension/EnDirect.jsx — « EN DIRECT » dans Aujourd'hui et la page Extension (21 nov., ext. 5.428, choix 59) ──
// La VUE de la règle src/extension/enDirect.js : l'état vient de l'extension elle-même (`etatPourApp().direct`), relu
// TOUT DE SUITE quand elle dit que son action a bougé (`maj · direct`, `maj · discretion`), et au battement de 20 s.
// « Tout arrêter » (SON toucher) : le réglage synchronisé `vinted_discretion.tout` ET la commande `toutArreter` de
// l'extension — le chemin du bouton du panneau (`poserToutArrete(true)` puis l'action en cours finie). Rien d'autre ne
// part : l'arrêt n'agit sur aucune plateforme. « Reprendre » quand tout est arrêté (le même geste que la page Extension).
import React from 'react';
import { tr, heure as heureLoc } from '../i18n/index.js';
import { Groupe, Rangee, Bouton } from '../natif/index.js';
import { enDirect } from './enDirect.js';
import { avecToutArrete, CLE_DISCRETION } from '../discretion.js';
import { useExtVivante, faitsExtensionApp, relireEtatExtBientot, vmrCmd, load, save, useSansSouris } from '../App.jsx';

const avecHeures = (vars) => { const o = { ...(vars || {}) }; if (typeof o.heure === 'number') o.heure = heureLoc(o.heure); return o; };

export function useMaintenantDirect(ms = 15000) {
  const [t, setT] = React.useState(() => Date.now());
  React.useEffect(() => { const m = setInterval(() => setT(Date.now()), ms); return () => clearInterval(m); }, [ms]);
  return t;
}

export default function EnDirect({ lieu = 'journee', etatForce } = {}) {
  useExtVivante();
  const sansSouris = useSansSouris();
  const maintenant = useMaintenantDirect();
  const [envoi, setEnvoi] = React.useState('');
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && (d.quoi === 'direct' || d.quoi === 'discretion')) relireEtatExtBientot(); };
    window.addEventListener('vrm:ext', f);
    return () => window.removeEventListener('vrm:ext', f);
  }, []);
  const etat = etatForce !== undefined ? etatForce : (() => { const f = faitsExtensionApp(sansSouris); return f.ext.present ? f.ext.etat : (f.ext.appelsFinis ? null : undefined); })();
  const vm = enDirect(etat, { maintenant });
  const poserTout = async (on) => {
    setEnvoi(on ? 'arret' : 'reprise');
    try {
      const brut = load(CLE_DISCRETION, null);
      save(CLE_DISCRETION, avecToutArrete(brut && typeof brut === 'object' ? brut : {}, on, Date.now()));
      await vmrCmd({ cmd: 'toutArreter', on });
    } catch (_) {}
    setEnvoi('');
    relireEtatExtBientot();
  };
  // « Tout est arrêté » a DÉJÀ son bandeau (la coque, avec « Reprendre ») et son avertissement sur la page Extension :
  // rien en double — la ligne « En direct » se tait tant que tout est arrêté (rien ne tourne).
  if (vm.code === 'tout') return <span hidden data-direct="tout" data-direct-lieu={lieu}/>;
  const action = vm.arreter ? <Bouton variante="texte" taille="compact" ton="ambre" chargement={envoi === 'arret'} onClick={() => poserTout(true)} attrs={{ 'data-direct-arreter': '' }}>{tr('direct.arreter')}</Bouton>
    : vm.reprendre ? <Bouton variante="texte" taille="compact" chargement={envoi === 'reprise'} onClick={() => poserTout(false)} attrs={{ 'data-direct-reprendre': '' }}>{tr('direct.reprendre')}</Bouton> : null;
  return (
    <Groupe titre={tr('direct.titre')} action={action} attrs={{ 'data-direct': vm.code, 'data-direct-lieu': lieu, 'aria-live': 'polite' }}>
      {vm.lignes.map((l, i) => <Rangee key={l.cle + i} titre={tr(l.cle, avecHeures(l.vars))} ton={l.ton === 'ambre' ? 'ambre' : 'neutre'} lignes={2}
        attrs={{ 'data-direct-ligne': l.cle }}/>)}
    </Groupe>
  );
}
