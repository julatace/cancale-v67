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
import { useLectureBornee } from '../attenteBornee.js';   // (22 nov., chasse P2-5) l'attente finit en « pas ouverte »
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
  const etatLu = etatForce !== undefined ? etatForce : (() => { const f = faitsExtensionApp(sansSouris); return f.ext.present ? f.ext.etat : (f.ext.appelsFinis ? null : undefined); })();
  // Sans réponse après 10 s : « — · extension pas ouverte » (null), jamais « Je demande à l'extension… » sans fin.
  const etat = useLectureBornee(etatLu);
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
  // (22 nov., style-clarte — Julien : deux messages « extension » sur le même écran, « c'est moche et pas visuel ») Quand
  // RIEN ne tourne (pas d'extension ici, une ancienne, pas de réponse) : UNE ligne courte, sans en-tête, qui ouvre LA
  // feuille d'état de l'extension (la même que la pastille du compte) — le détail et le geste y sont, une seule fois.
  // (23 nov., style-clarte-3 — « jamais une carte vide en tête ») Sur Aujourd'hui, rien en cours (ou la question pas encore
  // répondue) ⇒ RIEN d'affiché (l'état reste lisible par `data-direct`) ; seule une vraie action en cours a sa carte.
  if (lieu === 'journee' && (vm.code === 'lecture' || vm.code === 'rien')) return <span hidden data-direct={vm.code} data-direct-lieu={lieu}/>;
  if (vm.code === 'absente' || vm.code === 'ancienne' || vm.code === 'passu') {
    const ouvrir = () => { try { window.dispatchEvent(new Event('vrm:etat-actions-ouvrir')); } catch (_) {} };
    // Sur Aujourd'hui : une PUCE (pas une carte pleine largeur) qui ouvre la feuille d'état de l'extension.
    if (lieu === 'journee') return (
      <div className="n-direct-puce" data-direct={vm.code} data-direct-lieu={lieu} data-direct-court="">
        <Bouton variante="texte" taille="compact" ton={vm.code === 'ancienne' ? 'ambre' : undefined} onClick={ouvrir} attrs={{ 'data-direct-ligne': 'direct.' + vm.code, title: tr('direct.court.sous') }}>
          <span className="n-direct-puce-point" data-ton={vm.code === 'ancienne' ? 'ambre' : 'gris'} aria-hidden="true"/>{tr('direct.court.' + vm.code)}
        </Bouton>
      </div>
    );
    return (
      <Groupe attrs={{ 'data-direct': vm.code, 'data-direct-lieu': lieu, 'data-direct-court': '' }}>
        <Rangee titre={tr('direct.court.' + vm.code)} sousTitre={tr('direct.court.sous')} ton={vm.code === 'ancienne' ? 'ambre' : 'neutre'} fin="chevron" onClick={ouvrir}
          attrs={{ 'data-direct-ligne': 'direct.' + vm.code }}/>
      </Groupe>
    );
  }
  const action = vm.arreter ? <Bouton variante="texte" taille="compact" ton="ambre" chargement={envoi === 'arret'} onClick={() => poserTout(true)} attrs={{ 'data-direct-arreter': '' }}>{tr('direct.arreter')}</Bouton>
    : vm.reprendre ? <Bouton variante="texte" taille="compact" chargement={envoi === 'reprise'} onClick={() => poserTout(false)} attrs={{ 'data-direct-reprendre': '' }}>{tr('direct.reprendre')}</Bouton> : null;
  return (
    <Groupe titre={tr('direct.titre')} action={action} attrs={{ 'data-direct': vm.code, 'data-direct-lieu': lieu, 'aria-live': 'polite' }}>
      {vm.lignes.map((l, i) => <Rangee key={l.cle + i} titre={tr(l.cle, avecHeures(l.vars))} ton={l.ton === 'ambre' ? 'ambre' : 'neutre'} lignes={2}
        attrs={{ 'data-direct-ligne': l.cle }}/>)}
    </Groupe>
  );
}
