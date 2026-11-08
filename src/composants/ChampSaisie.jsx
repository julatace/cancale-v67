import React from 'react';
// Édition inline : garder la saisie refusée, verrouiller une validation en cours.
export default function ChampSaisie({ value, onCommit, apresEntree, style, ...p }) {
  const [txt, setTxt] = React.useState(value == null ? '' : String(value));
  const [actif, setActif] = React.useState(false);
  const [occupe, setOccupe] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const avant = React.useRef(value == null ? '' : String(value));
  const annule = React.useRef(false), enCours = React.useRef(false), refuse = React.useRef(false);
  const idErreur = React.useId();
  const s = { ...(style || {}) }; if (!Number.isFinite(parseFloat(s.fontSize)) || parseFloat(s.fontSize) < 16) s.fontSize = 16;
  React.useEffect(() => { if (!actif && !enCours.current && !refuse.current) setTxt(value == null ? '' : String(value)); }, [value, actif, occupe]);
  const sortir = async v => {
    if (enCours.current) return;
    setActif(false);
    if (annule.current) { annule.current = false; refuse.current = false; setErreur(''); setTxt(value == null ? '' : String(value)); return; }
    if (String(v) === String(avant.current)) return;
    enCours.current = true; setOccupe(true); setErreur('');
    try {
      const r = await onCommit(v, avant.current);
      if (r === false) throw new Error('refus');
      refuse.current = false; avant.current = String(v);
    } catch (_) {
      refuse.current = true;
      setErreur('Modification non enregistrée. Ta saisie est conservée : corrige ce champ puis valide à nouveau.');
    } finally { enCours.current = false; setOccupe(false); }
  };
  return <><input {...p} value={txt} style={s} readOnly={p.readOnly || occupe} aria-busy={occupe || undefined}
    aria-invalid={erreur ? true : p['aria-invalid']} aria-describedby={[p['aria-describedby'], erreur ? idErreur : ''].filter(Boolean).join(' ') || undefined}
    onFocus={() => { setActif(true); if (!refuse.current) avant.current = value == null ? '' : String(value); annule.current = false; }}
    onChange={e => setTxt(e.target.value)} onBlur={e => sortir(e.target.value)}
    onKeyDown={e => {
      if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); if (apresEntree) setTimeout(apresEntree, 0); }
      else if (e.key === 'Escape') { annule.current = true; e.currentTarget.blur(); }
    }}/>{erreur ? <span id={idErreur} role="alert" className="vrm-saisie-erreur">{erreur}</span> : null}</>;
}
