// ══════════════════════════════════════════════════════════════════════════════
// VRM INSTALLÉE : « Mettre à jour » et l'aide d'installation (11 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// Rendus par src/main.jsx, hors de l'app (ils ne dépendent d'aucune donnée).
// Les règles : src/miseAJour.js et src/aideInstallation.js.
import React from 'react';
import './design/app-installable.css';
import { CLE_MAJ_REFUSEE } from './miseAJour.js';
import { aideInstallationVisible, compterVisite, noterAideVue, plateformeIci, guideDejaFerme, DELAI_AIDE_MS } from './aideInstallation.js';

// « Nouvelle version · Mettre à jour » : en haut, petit, une fois par version.
export function PiluleMiseAJour() {
  const [version, setVersion] = React.useState(() => (typeof window !== 'undefined' && window.__vrmMajDispo) || null);
  React.useEffect(() => {
    const f = () => setVersion(window.__vrmMajDispo || null);
    window.addEventListener('vrm:maj-dispo', f);
    return () => window.removeEventListener('vrm:maj-dispo', f);
  }, []);
  if (!version) return null;
  const plusTard = () => { try { localStorage.setItem(CLE_MAJ_REFUSEE, version); } catch (_) {} window.__vrmMajDispo = null; setVersion(null); };
  const maintenant = () => { try { window.location.reload(); } catch (_) {} };
  return (
    <div className="vrm-maj" role="status" data-maj-dispo={version}>
      <span className="vrm-maj-texte">Nouvelle version de VRM.</span>
      <button type="button" className="vrm-maj-oui" onClick={maintenant} data-maj-geste="maintenant">Mettre à jour</button>
      <button type="button" className="vrm-maj-non" onClick={plusTard} aria-label="Plus tard" data-maj-geste="plus-tard">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

const Partager = () => (
  <svg className="vrm-inst-glyphe" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12 14V3M8.5 6.5 12 3l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Ajouter = () => (
  <svg className="vrm-inst-glyphe" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

// L'aide d'installation : iPhone (deux gestes) ou Android (le bouton du navigateur).
export function AideInstallation({ actif = true }) {
  const [plateforme, setPlateforme] = React.useState(null);
  React.useEffect(() => {
    if (!actif) return undefined;
    let etat;
    try { etat = compterVisite(); } catch (_) { return undefined; }
    let t = null;
    const essayer = () => {
      const p = plateformeIci(!!window.__vrmInviteInstallation);
      if (!aideInstallationVisible({ plateforme: p, etat, guideFerme: guideDejaFerme() })) return;
      clearTimeout(t);
      t = setTimeout(() => {
        // Relue au moment de montrer : installée entre-temps, ou plus d'invite ⇒ rien.
        const p2 = plateformeIci(!!window.__vrmInviteInstallation);
        if (!p2) return;
        noterAideVue();
        setPlateforme(p2);
      }, DELAI_AIDE_MS);
    };
    essayer();
    window.addEventListener('vrm:invite-installation', essayer);
    return () => { clearTimeout(t); window.removeEventListener('vrm:invite-installation', essayer); };
  }, [actif]);
  if (!plateforme) return null;
  const fermer = () => setPlateforme(null);
  const installer = async () => {
    const inv = window.__vrmInviteInstallation;
    window.__vrmInviteInstallation = null;
    fermer();
    try { if (inv) { await inv.prompt(); } } catch (_) {}
  };
  return (
    <div className="vrm-inst" role="dialog" aria-label="Installer VRM" data-aide-installation={plateforme}>
      <button type="button" className="vrm-inst-fermer" onClick={fermer} aria-label="Fermer" data-inst-geste="fermer">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <img className="vrm-inst-icone" src="/vrm-icon-v5-192.png" alt="" width="44" height="44" />
      {plateforme === 'iphone' ? (
        <div className="vrm-inst-corps">
          <strong className="vrm-inst-titre">VRM sur ton écran d’accueil</strong>
          <ol className="vrm-inst-gestes">
            <li><span className="vrm-inst-n">1</span>Touche <Partager /> <b>Partager</b>.</li>
            <li><span className="vrm-inst-n">2</span>Puis <Ajouter /> <b>Sur l’écran d’accueil</b>.</li>
          </ol>
          <button type="button" className="vrm-b vrm-inst-ok" onClick={fermer} data-inst-geste="compris">Compris</button>
        </div>
      ) : (
        <div className="vrm-inst-corps">
          <strong className="vrm-inst-titre">Installer VRM</strong>
          <p className="vrm-inst-texte">Une icône, et VRM s’ouvre en plein écran.</p>
          <div className="vrm-inst-boutons">
            <button type="button" className="vrm-b vrm-b-primaire vrm-inst-ok" onClick={installer} data-inst-geste="installer">Installer</button>
            <button type="button" className="vrm-b vrm-inst-ok" onClick={fermer} data-inst-geste="plus-tard">Plus tard</button>
          </div>
        </div>
      )}
    </div>
  );
}
