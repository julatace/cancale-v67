// ════════════════════════════════════════════════════════════════════════════
//  LA VEILLE, DANS MA JOURNÉE (11 nov. 2026, lot agent2-veille)
//  Deux choses, lues dans SES lignes (src/veilleLigne.js) :
//    1. un chiffre qui a chuté d'un coup sans raison (src/veilleChiffres.js) :
//       une carte AMBRE par alerte — ce qui a bougé, « Vérifie », le geste, et
//       « C'est vérifié » (elle ne revient plus) ; le pourquoi replié ;
//    2. le contrôle de cette nuit (src/controleNuit.js) : « Tout est en ordre ✓ »
//       seulement si chaque contrôle a été LU, sinon chaque problème avec son
//       geste (ROUGE seulement pour deux paires sous un N°, §7), et ce qui n'a
//       pas pu être vérifié, dit à part — jamais compté 0.
//  Rien à dire (aucun contrôle passé, lecture ratée, aucune alerte) ⇒ rien n'est
//  rendu : cette carte ne prend pas la place des gestes du jour.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { BoutonBase } from './composants/Bouton.jsx';
import { CLE_VEILLE, alertesAMontrer, texteAlerte } from './veilleChiffres.js';
import { etatControle } from './controleNuit.js';
import { lireLigneVeille, lireControleNuit, lireControleInstallation, marquerAlerteVue } from './veilleLigne.js';
import './styles-veille.css';

const aller = (u) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: String(u || '').replace(/^\//, '') })); } catch (_) {} };

export function useVeille() {
  const [chiffres, setChiffres] = React.useState(undefined);
  const [vendeur, setVendeur] = React.useState(undefined);
  const [installation, setInstallation] = React.useState(undefined);
  const [tour, relire] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    let vivant = true;
    Promise.all([lireLigneVeille(CLE_VEILLE), lireControleNuit(), lireControleInstallation()]).then(([c, v, i]) => {
      if (!vivant) return;
      setChiffres(c); setVendeur(v); setInstallation(i);
    });
    return () => { vivant = false; };
  }, [tour]);
  React.useEffect(() => { const f = () => relire(); window.addEventListener('vrm:veille', f); return () => window.removeEventListener('vrm:veille', f); }, []);
  return { chiffres, vendeur, installation, relire };
}

function CarteAlerte({ a, onVue }) {
  const t = texteAlerte(a);
  const [occupe, setOccupe] = React.useState(false);
  if (!t) return null;
  return (
    <div className="vrm-veille-alerte" data-veille-alerte={a.type} data-veille-cle={a.k} role="status">
      <p className="vrm-veille-titre">{t.titre}</p>
      <p className="vrm-veille-phrase">{t.phrase}</p>
      <details className="vrm-veille-pourquoi"><summary>Pourquoi ?</summary><p>{t.pourquoi}</p></details>
      <div className="vrm-veille-gestes">
        <BoutonBase variante="primaire" data-veille-geste={a.type} onClick={() => aller(t.geste.aller)}>{t.geste.libelle}</BoutonBase>
        <BoutonBase variante="discret" occupe={occupe} data-veille-vu={a.k} onClick={async () => { setOccupe(true); const ok = await marquerAlerteVue(a.k); setOccupe(false); if (ok) onVue(); }}>C’est vérifié</BoutonBase>
      </div>
    </div>
  );
}

export function VeilleJournee() {
  const { chiffres, vendeur, installation, relire } = useVeille();
  const maintenant = Date.now();
  const alertes = chiffres ? alertesAMontrer(chiffres, maintenant) : [];
  const ctl = etatControle(vendeur, installation === undefined ? null : installation, maintenant);
  const montrerCtl = ctl.etat === 'ok' || ctl.etat === 'probleme' || ctl.etat === 'passu';
  if (!alertes.length && !montrerCtl) return null;
  return (
    <section className="vrm-veille" aria-label="Veille" data-veille={alertes.length} data-controle={ctl.etat}>
      {alertes.map((a) => <CarteAlerte key={a.k} a={a} onVue={relire}/>)}
      {ctl.etat === 'ok' ? (
        <p className="vrm-veille-ok" data-controle-ok="">Tout est en ordre ✓ <span>· contrôle de cette nuit</span></p>
      ) : null}
      {ctl.etat === 'probleme' || ctl.etat === 'passu' ? (
        <div className="vrm-veille-controle" data-controle-n={ctl.lignes.length}>
          <p className="vrm-veille-sous">Contrôle de cette nuit</p>
          {ctl.lignes.map((l) => (
            <div key={l.cle} className="vrm-veille-ligne" data-controle-ligne={l.cle} data-ton={l.ton}>
              <span className="vrm-veille-n">{l.n}</span>
              <span className="vrm-veille-txt">{l.phrase.replace(/^\d+\s/, '')}{l.cle === 'numeros-double' && l.ids.length ? <small> · N°{l.ids.slice(0, 4).join(', N°')}</small> : null}</span>
              <BoutonBase variante="secondaire" taille="petit" data-controle-geste={l.cle} onClick={() => aller(l.geste.aller)}>{l.geste.libelle}</BoutonBase>
            </div>
          ))}
          {ctl.passu.length ? <p className="vrm-veille-passu" data-controle-passu={ctl.passu.length}>Pas vérifié : {ctl.passu.map((p) => `${p.nom.charAt(0).toLowerCase()}${p.nom.slice(1)} (${p.raison})`).join(' · ')}.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
export default VeilleJournee;
