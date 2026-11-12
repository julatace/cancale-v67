// ═══════════════════════════════════════════════════════════════════════════
// LA DISCRÉTION À L'ÉCRAN (12 nov., ext. 5.370 — validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
//   · `AlerteVerification` : Vinted a demandé une vérification (captcha) sur un compte ⇒
//     ligne AMBRE « Vinted demande une vérification : fais-la sur vinted.fr, puis touche
//     Reprendre » ; « Reprendre » écrit SA reprise (`vinted_discretion.reprises[uid]`,
//     synchronisée : chaque Chrome du compte la relit) — rien d'autre ne lève l'arrêt.
//   · `PanneauDiscretion` (Paramètres → Mes comptes → « Discrétion ») : le plafond par jour
//     (réglable, 200 par défaut), et par compte : la jauge du jour, la vérification en cours,
//     et le carnet des 7 jours (refus 403/429, pauses, vérifications, prudences).
// Lecture : les lignes `actions_compte_*` projetées (src/JaugeActions.jsx). Règles :
// src/discretion.js et src/jaugeActions.js. Aucune écriture en base hors de `save`.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { load, save } from './App.jsx';
import { useLignesActions } from './JaugeActions.jsx';
import { jaugeDuCompte, texteJauge, heureFr } from './jaugeActions.js';
import { CLE_DISCRETION, PAR_JOUR_DEFAUT, PAR_JOUR_MIN, PAR_JOUR_MAX, reglageDiscretion, parJourTape, verificationEnCours, avecReprise, carnetDuCompte } from './discretion.js';
import './styles-discretion.css';

// Le réglage, relu à chaque sauvegarde (cet appareil ou un autre).
export function useReglageDiscretion() {
  const [v, setV] = React.useState(() => reglageDiscretion(load(CLE_DISCRETION, null)));
  React.useEffect(() => {
    const f = (e) => { if (!e || !e.detail || e.detail.k === CLE_DISCRETION) setV(reglageDiscretion(load(CLE_DISCRETION, null))); };
    window.addEventListener('vrm:save', f);
    return () => window.removeEventListener('vrm:save', f);
  }, []);
  const ecrire = React.useCallback((brut) => { save(CLE_DISCRETION, brut); setV(reglageDiscretion(brut)); }, []);
  return [v, ecrire];
}

export function AlerteVerification({ uid, captcha, nom = '' }) {
  const [reg, ecrire] = useReglageDiscretion();
  const [repris, setRepris] = React.useState(false);
  const u = String(uid || '');
  if (!/^\d{1,20}$/.test(u) || repris || !verificationEnCours(captcha, reg.reprises[u])) return null;
  const reprendre = () => { ecrire(avecReprise(load(CLE_DISCRETION, null), u)); setRepris(true); };
  return (
    <div className="vrm-verif" role="alert" data-verification={u} data-verification-depuis={String(captcha)}>
      <span className="vrm-verif-point" aria-hidden="true" />
      <p className="vrm-verif-texte"><b>Vinted demande une vérification{nom ? ` (${nom})` : ''}.</b> Fais-la sur vinted.fr, puis touche Reprendre.</p>
      <button type="button" className="vrm-verif-reprendre" data-verification-reprendre={u} onClick={reprendre}>Reprendre</button>
    </div>
  );
}

const MOTS_CARNET = [['n403', 'refus 403'], ['n429', 'refus 429'], ['pauses', 'pauses'], ['captchas', 'vérifications'], ['prudences', 'prudences']];
function LigneCarnet({ c }) {
  if (c === undefined) return <span className="vrm-disc-carnet is-passu">…</span>;
  if (c === null) return <span className="vrm-disc-carnet is-passu" data-carnet="pas-su">— pas encore dit par l’extension</span>;
  if (!c.total) return <span className="vrm-disc-carnet" data-carnet="0">Aucun frein en 7 jours</span>;
  return (
    <span className="vrm-disc-carnet is-geste" data-carnet={c.total}>
      {MOTS_CARNET.filter(([k]) => c[k]).map(([k, m]) => <span key={k} data-carnet-sorte={k}>{c[k]} {m}</span>)}
      {c.dernier ? <span className="vrm-disc-dernier">dernier {new Date(c.dernier).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })} {heureFr(c.dernier)}</span> : null}
    </span>
  );
}

export function PanneauDiscretion({ uids = [], nomCompte = () => null }) {
  const liste = [...new Set((uids || []).map(String).filter((u) => /^\d{1,20}$/.test(u)))];
  const [rows, maintenant] = useLignesActions('', liste.length > 0);
  const [reg, ecrire] = useReglageDiscretion();
  const [texte, setTexte] = React.useState(String(reg.parJour));
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { setTexte(String(reg.parJour)); }, [reg.parJour]);
  const tape = parJourTape(texte);
  const enregistrer = () => {
    if (!tape.ok) return;
    const brut = load(CLE_DISCRETION, null);
    ecrire({ ...(brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {}), parJour: tape.valeur });
    setMsg('Enregistré');
  };
  return (
    <div className="vrm-disc" data-discretion="" data-discretion-parjour={reg.parJour}>
      <div className="vrm-disc-reglage">
        <label className="vrm-disc-champ">
          <span>Actions par jour et par compte</span>
          <input inputMode="numeric" value={texte} aria-invalid={tape.ok ? undefined : 'true'} data-discretion-champ=""
            onChange={(e) => { setTexte(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setMsg(''); }} onBlur={enregistrer}
            onKeyDown={(e) => { if (e.key === 'Enter') enregistrer(); }} />
        </label>
        <p className="vrm-disc-note">{tape.ok ? (msg || `Par défaut ${PAR_JOUR_DEFAUT}. Certains jours, VRM en fait un peu moins.`) : tape.erreur} </p>
      </div>
      {liste.map((u) => {
        const j = rows === undefined ? undefined : jaugeDuCompte(rows, u, maintenant);
        const t = j ? texteJauge(j) : null;
        const c = rows === undefined ? undefined : carnetDuCompte(rows, u, maintenant);
        return (
          <div key={u} className="vrm-disc-compte" data-discretion-compte={u}>
            <div className="vrm-disc-tete">
              <span className="vrm-disc-nom">{nomCompte(u) || `compte ${u}`}</span>
              <b className="vrm-disc-jour" data-discretion-jour={j && j.nJour != null ? `${j.nJour}/${j.maxJour}` : 'pas-su'}>{t && t.jour ? t.jour : '—'}</b>
            </div>
            {j && j.montee ? <p className="vrm-disc-note" data-discretion-montee={j.montee}>Compte neuf : {j.montee} actions/heure cette semaine.</p> : null}
            {j && j.captcha ? <AlerteVerification uid={u} captcha={j.captcha} /> : null}
            <LigneCarnet c={c} />
          </div>
        );
      })}
      <p className="vrm-disc-pied">Les 7 derniers jours. Refus et pauses viennent de Vinted.</p>
    </div>
  );
}
export { PAR_JOUR_MIN, PAR_JOUR_MAX };

// Ma journée : une ligne ambre par compte que Vinted a fait vérifier (tant qu'il n'a pas repris).
export default function AlertesVerificationJournee() {
  const [rows, maintenant] = useLignesActions('', true);
  if (!Array.isArray(rows)) return null;   // on lit, ou pas su : rien n'est affirmé
  const uids = [...new Set(rows.map((r) => (/^actions_compte_(\d{1,20})_[0-9a-f]{16}$/.exec(String((r && r.id) || '')) || [])[1]).filter(Boolean))];
  const avec = uids.map((u) => ({ u, j: jaugeDuCompte(rows, u, maintenant) })).filter((x) => x.j && x.j.captcha);
  if (!avec.length) return null;
  return <div data-verifications-journee={avec.length}>{avec.map((x) => <AlerteVerification key={x.u} uid={x.u} captcha={x.j.captcha} />)}</div>;
}
