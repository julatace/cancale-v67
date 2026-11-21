// ═══════════════════════════════════════════════════════════════════════════
// LA JAUGE « 12/50 cette heure · repart à 21 h 40 » (10 nov., lot G, ext. 5.337)
// ═══════════════════════════════════════════════════════════════════════════
// Posée là où partent des actions (baisse de prix, Republier, favoris, offres) et,
// compte par compte, en tête de Paramètres → « Ce que VRM a fait » (`JaugesComptes`). Une ligne, une barre fine ; le repère
// marque les 45 que l'app peut prendre (les 5 dernières restent à ses clics).
// La règle (somme de tous les Chrome, « pas su ») : src/jaugeActions.js.
// Lecture : les lignes `actions_compte_{uid}_*` projetées (heures seulement), relues
// toutes les minutes tant que la jauge est à l'écran. Rien n'est écrit.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { PREFIXE_ACTIONS, SELECT_ACTIONS, jaugeDuCompte, texteJauge } from './jaugeActions.js';
import { lireTout } from './App.jsx';
import './styles-jauge-journal.css';
// (12 nov., ext. 5.370) « 112/200 aujourd’hui » et l'alerte « Vinted demande une vérification ».
import { AlerteVerification } from './Discretion.jsx';

// (13 nov., intégration 5.372) Plusieurs cartes de Ma journée lisent la même jauge (Discrétion,
// « Tout va bien ? », la jauge) : une lecture EN COURS ou de moins de 3 s est partagée (budget-vitesse :
// plus de lecture en double). Une lecture ratée n'est jamais gardée ; `frais` (la veille a vu la ligne
// changer) relit toujours.
const LECTURES_ACTIONS = new Map();
const PARTAGE_ACTIONS_MS = 3000;
export function lireLignesActions(uid, { frais = false } = {}) {
  const filtre = uid ? `${PREFIXE_ACTIONS}${uid}_*` : `${PREFIXE_ACTIONS}*`;
  const deja = LECTURES_ACTIONS.get(filtre);
  if (!frais && deja && (deja.enCours || Date.now() - deja.at < PARTAGE_ACTIONS_MS)) return deja.p;
  const e = { at: Date.now(), enCours: true, p: null };
  e.p = lireTout(`id=like.${filtre}&select=${SELECT_ACTIONS}`).catch(() => null).then((r) => {
    e.enCours = false; e.at = Date.now();
    if (r == null && LECTURES_ACTIONS.get(filtre) === e) LECTURES_ACTIONS.delete(filtre);
    return r;
  });
  LECTURES_ACTIONS.set(filtre, e);
  return e.p;
}

// undefined = on lit · null = lecture ratée · tableau = lu.
export function useLignesActions(uid, actif = true) {
  const [rows, setRows] = React.useState(undefined);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    const lire = (frais = false) => lireLignesActions(uid, { frais }).then((r) => { if (!mort) { setRows(r); setMaintenant(Date.now()); } });
    lire();
    const minuteur = setInterval(lire, 60000);
    const auRetour = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', auRetour);
    // (11 nov., temps réel) La veille a vu la ligne de jauge de ce compte changer (src/tempsReel.js).
    const neuf = (e) => { const d = e && e.detail; if (d && Array.isArray(d.quoi) && d.quoi.some((q) => q.quoi === 'jauge' && (!uid || String(q.uid) === String(uid)))) lire(true); };
    window.addEventListener('vrm:neuf', neuf);
    return () => { mort = true; clearInterval(minuteur); document.removeEventListener('visibilitychange', auRetour); window.removeEventListener('vrm:neuf', neuf); };
  }, [uid, actif]);
  return [rows, maintenant];
}

export function BarreJauge({ j }) {
  const pct = j ? Math.min(100, Math.round((j.n / j.max) * 100)) : 0;
  const repere = j ? Math.round((j.pourApp / j.max) * 100) : 90;
  return (
    <span className="vrm-jauge-barre" aria-hidden="true">
      <span className="vrm-jauge-plein" style={{ width: `${pct}%` }} />
      <span className="vrm-jauge-repere" style={{ left: `${repere}%` }} />
    </span>
  );
}

export default function JaugeActions({ uid, nom = '' }) {
  const u = uid == null ? '' : String(uid);
  const [rows, maintenant] = useLignesActions(u, /^\d{1,20}$/.test(u));
  if (!/^\d{1,20}$/.test(u)) return null;
  const j = rows === undefined ? undefined : jaugeDuCompte(rows, u, maintenant);
  const t = j === undefined ? { valeur: '…', suite: '', ton: 'passu' } : texteJauge(j);
  return (
    <>
    <div className="vrm-jauge" data-jauge-actions={u} data-jauge-n={j ? j.n : (j === null ? 'pas-su' : 'lecture')} data-jauge-max={j ? j.max : ''} data-jauge-prudence={j && j.prudence ? String(j.prudence) : undefined} data-ton={t.ton || undefined}
      role="status" aria-label={`Actions de l’heure${nom ? ' sur ' + nom : ''} : ${t.valeur}${t.suite ? ', ' + t.suite : ''}`}>
      <BarreJauge j={j || null} />
      <span className="vrm-jauge-texte">
        <span className="vrm-jauge-mot">Actions{nom ? ` · ${nom}` : ''}</span>
        <b className="vrm-jauge-valeur">{t.valeur}</b>
        {t.jour ? <span className="vrm-jauge-jour" data-jauge-jour={j ? `${j.nJour}/${j.maxJour}` : ''}>{t.jour}</span> : null}
        {t.suite ? <span className="vrm-jauge-suite">{t.suite}</span> : null}
      </span>
    </div>
    {j && j.captcha ? <AlerteVerification uid={u} captcha={j.captcha} arret={j.arret || 'captcha'} nom={nom} /> : null}
    </>
  );
}

// Paramètres → « Ce que VRM a fait » : une rangée par compte Vinted, UNE lecture pour tous.
export function JaugesComptes({ uids = [], nomCompte = () => null }) {
  const liste = [...new Set((uids || []).map(String).filter((u) => /^\d{1,20}$/.test(u)))];
  const [rows, maintenant] = useLignesActions('', liste.length > 0);
  if (!liste.length) return null;
  return (
    <div className="vrm-jauges" data-jauges-comptes={liste.length}>
      <div className="vrm-jauges-titre">Cette heure</div>
      {liste.map((u) => {
        const j = rows === undefined ? undefined : jaugeDuCompte(rows, u, maintenant);
        const t = j === undefined ? { valeur: '…', suite: '', ton: 'passu' } : texteJauge(j);
        return (
          <div key={u} className="vrm-jauge vrm-jauge-rangee" data-jauge-actions={u} data-jauge-n={j ? j.n : (j === null ? 'pas-su' : 'lecture')} data-jauge-prudence={j && j.prudence ? String(j.prudence) : undefined} data-ton={t.ton || undefined}>
            <span className="vrm-jauge-nom">{nomCompte(u) || `compte ${u}`}</span>
            <BarreJauge j={j || null} />
            <span className="vrm-jauge-texte"><b className="vrm-jauge-valeur">{t.valeur}</b>{t.jour ? <span className="vrm-jauge-jour" data-jauge-jour={j ? `${j.nJour}/${j.maxJour}` : ''}>{t.jour}</span> : null}{t.suite ? <span className="vrm-jauge-suite">{t.suite}</span> : null}</span>
          </div>
        );
      })}
      <p className="vrm-jauges-pied">50 actions/heure par compte. VRM s’arrête à 45 : 5 restent à tes clics.</p>
    </div>
  );
}
