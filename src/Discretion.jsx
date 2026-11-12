// ═══════════════════════════════════════════════════════════════════════════
// LA DISCRÉTION À L'ÉCRAN (12 nov., ext. 5.370 — validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
//   · `AlerteVerification` : un compte ARRÊTÉ par l'extension — Vinted a demandé une
//     vérification (captcha), Vinted a modéré le compte, ou le compte n'est plus connecté
//     sur vinted.fr ⇒ ligne AMBRE (la cause + le geste) et « Reprendre » : SA reprise
//     (`vinted_discretion.reprises[uid]`, synchronisée : chaque Chrome du compte la relit).
//   · `ToutArreter` : l'interrupteur « Tout arrêter » (tous les comptes, tous les gestes
//     automatiques) — l'app range `vinted_discretion.tout`, et le dit tout de suite à
//     l'extension de ce navigateur (`toutArreter`) ; la carte du logo pose le même.
//   · `PanneauDiscretion` (Paramètres → Mes comptes → « Discrétion ») : Tout arrêter, le
//     plafond par jour (200 par défaut), la limite par sorte (15/h favoris, 15/h offres),
//     et par compte : le jour, l'arrêt en cours, le carnet des 7 jours.
// Lecture : les lignes `actions_compte_*` projetées (src/JaugeActions.jsx). Règles :
// src/discretion.js et src/jaugeActions.js. Aucune écriture en base hors de `save`.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { load, save, vmrCmd } from './App.jsx';
import { useLignesActions } from './JaugeActions.jsx';
import { jaugeDuCompte, texteJauge, heureFr, toutArreteDe } from './jaugeActions.js';
import { CLE_DISCRETION, PAR_JOUR_DEFAUT, PAR_JOUR_MIN, PAR_JOUR_MAX, PAR_HEURE_SORTE_DEFAUT, reglageDiscretion, parJourTape, parHeureTape, verificationEnCours, avecReprise, avecToutArrete, phraseArretCompte, carnetDuCompte } from './discretion.js';
import './styles-discretion.css';

const brutDiscretion = () => { const b = load(CLE_DISCRETION, null); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };

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

export function AlerteVerification({ uid, captcha, arret = 'captcha', nom = '' }) {
  const [reg, ecrire] = useReglageDiscretion();
  const [repris, setRepris] = React.useState(false);
  const u = String(uid || '');
  if (!/^\d{1,20}$/.test(u) || repris || !verificationEnCours(captcha, reg.reprises[u])) return null;
  const reprendre = () => { ecrire(avecReprise(brutDiscretion(), u)); setRepris(true); };
  const ph = phraseArretCompte(arret);
  return (
    <div className="vrm-verif" role="alert" data-verification={u} data-verification-quoi={arret} data-verification-depuis={String(captcha)}>
      <span className="vrm-verif-point" aria-hidden="true" />
      <p className="vrm-verif-texte"><b>{ph.titre}{nom ? ` (${nom})` : ''}.</b> {ph.geste}</p>
      <button type="button" className="vrm-verif-reprendre" data-verification-reprendre={u} onClick={reprendre}>Reprendre</button>
    </div>
  );
}

// « Tout arrêter » : `rows` = les lignes lues (pour l'interrupteur posé depuis la carte du logo).
export function ToutArreter({ rows, variante = 'panneau' }) {
  const [reg, ecrire] = useReglageDiscretion();
  const [local, setLocal] = React.useState(null);   // son geste, avant que les lignes ne le relisent
  const etat = toutArreteDe(rows, local && (!reg.tout || local.at > reg.tout.at) ? local : reg.tout);
  const on = !!(etat && etat.on);
  if (variante === 'alerte' && !on) return null;
  const poser = (v) => {
    const at = Date.now();
    ecrire(avecToutArrete(brutDiscretion(), v, at));
    setLocal({ on: v, at });
    try { vmrCmd({ cmd: 'toutArreter', on: v }); } catch (_) {}
  };
  if (variante === 'alerte') {
    return (
      <div className="vrm-verif" role="alert" data-tout-arrete={String(etat.at)}>
        <span className="vrm-verif-point" aria-hidden="true" />
        <p className="vrm-verif-texte"><b>Tout est arrêté.</b> Aucun geste automatique ne part, sur aucun compte.</p>
        <button type="button" className="vrm-verif-reprendre" data-tout-reprendre="" onClick={() => poser(false)}>Reprendre</button>
      </div>
    );
  }
  return (
    <div className="vrm-disc-tout" data-tout-etat={on ? 'arrete' : 'marche'}>
      <span className="vrm-disc-tout-txt"><b>{on ? 'Tout est arrêté' : 'Gestes automatiques'}</b><small>{on ? 'Offres, favoris, republications, baisses : rien ne part.' : 'Un toucher coupe tout, sur tous les comptes.'}</small></span>
      <button type="button" className={'vrm-disc-tout-btn' + (on ? ' is-on' : '')} data-tout-bouton={on ? 'reprendre' : 'arreter'} onClick={() => poser(!on)}>{on ? 'Reprendre' : 'Tout arrêter'}</button>
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

// Un champ nombre enregistré en quittant le champ (ou sur Entrée).
function ChampNombre({ libelle, valeur, verifier, enregistrer, data }) {
  const [texte, setTexte] = React.useState(String(valeur));
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { setTexte(String(valeur)); }, [valeur]);
  const tape = verifier(texte);
  const ok = () => { if (tape.ok && tape.valeur !== valeur) { enregistrer(tape.valeur); setMsg('Enregistré'); } };
  return (
    <>
      <label className="vrm-disc-champ">
        <span>{libelle}</span>
        <input inputMode="numeric" value={texte} aria-invalid={tape.ok ? undefined : 'true'} {...data}
          onChange={(e) => { setTexte(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setMsg(''); }} onBlur={ok}
          onKeyDown={(e) => { if (e.key === 'Enter') ok(); }} />
      </label>
      {!tape.ok ? <p className="vrm-disc-note" role="alert">{tape.erreur}</p> : msg ? <p className="vrm-disc-note">{msg}</p> : null}
    </>
  );
}

export function PanneauDiscretion({ uids = [], nomCompte = () => null }) {
  const liste = [...new Set((uids || []).map(String).filter((u) => /^\d{1,20}$/.test(u)))];
  const [rows, maintenant] = useLignesActions('', liste.length > 0);
  const [reg, ecrire] = useReglageDiscretion();
  const poser = (patch) => ecrire({ ...brutDiscretion(), ...patch });
  return (
    <div className="vrm-disc" data-discretion="" data-discretion-parjour={reg.parJour}>
      <ToutArreter rows={rows} />
      <div className="vrm-disc-reglage">
        <ChampNombre libelle="Actions par jour et par compte" valeur={reg.parJour} verifier={parJourTape} data={{ 'data-discretion-champ': '' }}
          enregistrer={(n) => poser({ parJour: n })} />
        <ChampNombre libelle="Messages aux favoris par heure" valeur={reg.parHeure.favori} verifier={parHeureTape} data={{ 'data-discretion-parheure': 'favori' }}
          enregistrer={(n) => poser({ parHeure: { ...reg.parHeure, favori: n } })} />
        <ChampNombre libelle="Réponses auto aux offres par heure" valeur={reg.parHeure.offre} verifier={parHeureTape} data={{ 'data-discretion-parheure': 'offre' }}
          enregistrer={(n) => poser({ parHeure: { ...reg.parHeure, offre: n } })} />
        <p className="vrm-disc-note">Par défaut {PAR_JOUR_DEFAUT} par jour ({PAR_JOUR_MIN} à {PAR_JOUR_MAX}), {PAR_HEURE_SORTE_DEFAUT} par heure. Certains jours, VRM en fait un peu moins.</p>
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
            {j && j.captcha ? <AlerteVerification uid={u} captcha={j.captcha} arret={j.arret || 'captcha'} /> : null}
            <LigneCarnet c={c} />
          </div>
        );
      })}
      <p className="vrm-disc-pied">Les 7 derniers jours. Refus et pauses viennent de Vinted.</p>
    </div>
  );
}
export { PAR_JOUR_MIN, PAR_JOUR_MAX };

// Ma journée : « Tout est arrêté » et une ligne ambre par compte arrêté (tant qu'il n'a pas repris).
export default function AlertesVerificationJournee() {
  const [rows, maintenant] = useLignesActions('', true);
  if (!Array.isArray(rows)) return null;   // on lit, ou pas su : rien n'est affirmé
  const uids = [...new Set(rows.map((r) => (/^actions_compte_(\d{1,20})_[0-9a-f]{16}$/.exec(String((r && r.id) || '')) || [])[1]).filter(Boolean))];
  const avec = uids.map((u) => ({ u, j: jaugeDuCompte(rows, u, maintenant) })).filter((x) => x.j && x.j.captcha);
  return (
    <div data-verifications-journee={avec.length}>
      <ToutArreter rows={rows} variante="alerte" />
      {avec.map((x) => <AlerteVerification key={x.u} uid={x.u} captcha={x.j.captcha} arret={x.j.arret || 'captcha'} />)}
    </div>
  );
}
