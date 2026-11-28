// ═══════════════════════════════════════════════════════════════════════════
// « TON HISTORIQUE VINTED » (11 nov., lot import-depart, extension 5.344)
// Règles et textes : src/importDepart.js. Deux places :
//   · Ma journée (`variante="journee"`) : une barre fine par compte en cours,
//     en pause, arrêté, ou fini depuis moins d'un jour. Rien sinon.
//   · Paramètres → Mes comptes (`variante="reglages"`) : chaque compte Vinted,
//     son état, et « Tout récupérer » pour le compte ouvert sur vinted.fr.
// Une lecture projetée (jamais `select=data`), relue quand l'extension le dit
// (`vrm:ext` quoi='import'), au retour sur l'écran, et chaque minute en cours.
// 5.375 (13 nov., lot 47) — « Import de ton passé » : la tête dit
// « Import de ton passé · 340 / ~1 200 ventes · compte X », chaque type sa barre
// (sur l'estimation) et « 4 pages sur ~12 », les annonces une ligne, le souci
// ou la pause « suite dans 40 min ». Fini ⇒ « Ton passé est importé (12 mois) »
// UNE fois sur Ma journée (marqué vu, synchronisé).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireImportDepart, importsAMontrer, marquerImportsVus, CLE_IMPORT_VU } from './importDepart.js';
import { lireTout, load, save, onVmrExt } from './App.jsx';
import './styles-import-depart.css';
import { tr } from './i18n/index.js';

function useImportDepart(uids) {
  const cle = (uids || []).join(',');
  const [etats, setEtats] = React.useState(undefined);
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    let mort = false;
    (async () => {
      const r = await lireImportDepart(cle ? cle.split(',') : [], lireTout);
      if (!mort) setEtats(r);
    })();
    return () => { mort = true; };
  }, [cle, tour]);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'import') setTour((t) => t + 1); };
    const vis = () => { if (document.visibilityState === 'visible') setTour((t) => t + 1); };
    // (11 nov., temps réel) La veille a vu une ligne `import_vinted_*` changer (src/tempsReel.js).
    const neuf = (e) => { const d = e && e.detail; if (d && Array.isArray(d.quoi) && d.quoi.some((q) => q.quoi === 'import')) setTour((t) => t + 1); };
    window.addEventListener('vrm:ext', f);
    window.addEventListener('vrm:neuf', neuf);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('vrm:ext', f); window.removeEventListener('vrm:neuf', neuf); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const enCours = etats && Object.values(etats).some((l) => l && (l.etat === 'encours' || l.etat === 'attente' || l.etat === 'pause'));
  React.useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTour((x) => x + 1); }, 60000);
    return () => clearInterval(t);
  }, [enCours]);
  return [etats, () => setTour((t) => t + 1)];
}

// 5.375 : `dejaDit` — le chiffre est déjà dans la tête (« 340 / ~1 200 ventes ») : la ligne ne
// le redit pas (§7, un nombre une fois), elle dit les pages à sa place.
// 5.455.8 (revue) : les barres et la tête « Import de ton passé » ne sont plus rendues nulle part : retirées (code mort).

const nomDe = (comptes, labels, uid) => {
  const a = (comptes || []).find((x) => String(x && x.vinted_user_id) === String(uid));
  return labels[uid] || (a && a.login) || `Compte ${uid}`;
};

export default function ImportDepart({ comptes = [], variante = 'journee' }) {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const uids = (comptes || []).map((a) => String((a && a.vinted_user_id) || '')).filter((u) => /^\d{1,20}$/.test(u));
  const [etats, relire] = useImportDepart(uids);
  const [occupe, setOccupe] = React.useState(false);
  const [issue, setIssue] = React.useState(null);
  const labels = load('vinted_account_labels', {}) || {};

  // 5.375 : ce qui était déjà VU à l'ouverture de l'écran (le message de fin reste
  // sous les yeux pendant cette visite, puis ne revient plus).
  const [vusOuverture] = React.useState(() => load(CLE_IMPORT_VU, {}) || {});
  const montres = variante === 'journee' ? importsAMontrer(etats, Date.now(), vusOuverture) : [];
  const cleMontres = montres.map((l) => `${l.uid}:${l.etat}:${l.fin || ''}`).join(',');
  React.useEffect(() => {
    if (variante !== 'journee' || !montres.length) return;
    const neuf = marquerImportsVus(load(CLE_IMPORT_VU, {}) || {}, montres);
    if (neuf) save(CLE_IMPORT_VU, neuf);
  }, [cleMontres]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 5.455.8 (Julien, 28 nov. : « Import de ton passé : je t'avais demandé de l'enlever ») : plus aucune carte ni bouton d'import,
  //    ni dans Ma journée ni dans Réglages. L'extension lit TOUT l'historique seule (`departImport`) ; Réglages → Mon historique
  //    en dit UNE ligne, sans bouton ni barre.
  void occupe; void setOccupe; void issue; void setIssue; void relire; void montres;
  if (variante === 'journee') return null;
  const enCoursN = etats ? uids.filter((u) => etats[u] && etats[u].etat === 'encours').length : 0;
  return (
    <div className="vrm-imp vrm-imp-reglages" data-import-reglages={uids.length}>
      <p className="vrm-imp-note" data-import-ligne-unique={enCoursN ? 'encours' : 'auto'}>{tr(enCoursN ? 'importDepart.ligneEncours' : 'importDepart.ligneAuto')}</p>
    </div>
  );
}
