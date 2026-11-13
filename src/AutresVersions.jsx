// ═══════════════════════════════════════════════════════════════════════════
// LES AUTRES VERSIONS D'UN MESSAGE (12 nov., ext. 5.369 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « VRM ferait tourner plusieurs versions que tu écris toi-même […]. Personne ne
// reçoit exactement la même phrase que le précédent. » Sous le champ où il écrit
// déjà son message (1re version, inchangé), les versions 2 à 5 et « + Ajouter une
// variante ». Aucun texte inventé : un champ ajouté est VIDE. La règle du choix
// est src/variantesMessage.js (l'extension en porte la copie).
import React from 'react';
import { VARIANTES_MAX } from './variantesMessage.js';
import './autres-versions.css';

// `variantes` : textes des versions 2 à 5 (le 1er champ reste celui de l'écran).
// `onChange(liste)` : la nouvelle liste (rangée par l'appelant, une source).
// `extOk` : false ⇒ l'extension de ce navigateur ne sait pas encore varier (dit).
// (12 nov., ext. 5.370 — sa demande) Les variables {pseudo}, {article}, {prix} proposées ici :
// un toucher les insère dans la version où il écrit (la dernière touchée, sinon une nouvelle).
// Remplacées par l'extension au moment d'envoyer (src/favorisMessage.js).
export const VARIABLES_PROPOSEES = [['{pseudo}', 'son pseudo'], ['{article}', 'le titre'], ['{prix}', 'le prix']];
export default function AutresVersions({ nom, premier = '', variantes = [], onChange, desactive = false, extOk = true, placeholder = '', variables = true }) {
  const liste = Array.isArray(variantes) ? variantes : [];
  const [ici, setIci] = React.useState(-1);
  const champs = React.useRef([]);
  const inserer = (v) => {
    let i = ici >= 0 && ici < liste.length ? ici : -1;
    let l = liste.slice();
    if (i < 0) { if (1 + l.length >= VARIANTES_MAX) i = l.length - 1; else { l = l.concat(['']); i = l.length - 1; } }
    if (i < 0) return;
    const el = champs.current[i];
    const t = String(l[i] || '');
    const a = el && el.selectionStart != null && document.activeElement === el ? el.selectionStart : t.length;
    const b = el && el.selectionEnd != null && document.activeElement === el ? el.selectionEnd : t.length;
    l[i] = (t.slice(0, a) + v + t.slice(b)).slice(0, 2000);
    setIci(i);
    onChange && onChange(l);
  };
  const total = 1 + liste.length;
  const remplies = (premier.trim() ? 1 : 0) + liste.filter((t) => String(t || '').trim()).length;
  const changer = (i, v) => { const l = liste.slice(); l[i] = v.slice(0, 2000); onChange && onChange(l); };
  const retirer = (i) => { const l = liste.slice(); l.splice(i, 1); onChange && onChange(l); };
  const ajouter = () => { if (total < VARIANTES_MAX) onChange && onChange(liste.concat([''])); };
  return (
    <div className="vrm-versions" data-versions={nom} data-versions-n={remplies}>
      {liste.map((t, i) => (
        <div key={`version-${i + 2}`} className="vrm-versions-ligne">{/* une case par n° de version (2 à 5) : la position EST son identité */}
          <label className="vrm-versions-label" htmlFor={`vrm-version-${nom}-${i + 2}`}>Version {i + 2}</label>
          <div className="vrm-versions-champ">
            <textarea id={`vrm-version-${nom}-${i + 2}`} data-version={i + 2} rows={2} maxLength={2000} disabled={desactive}
              ref={(el) => { champs.current[i] = el; }} onFocus={() => setIci(i)}
              value={t} placeholder={placeholder} onChange={(e) => changer(i, e.target.value)}/>
            <button type="button" className="vrm-versions-retirer" data-version-retirer={i + 2} disabled={desactive}
              aria-label={`Retirer la version ${i + 2}`} onClick={() => retirer(i)}>Retirer</button>
          </div>
        </div>
      ))}
      {variables && (
        <div className="vrm-versions-variables" role="group" aria-label="Variables" data-versions-variables="">
          {VARIABLES_PROPOSEES.map(([v, sens]) => (
            <button key={v} type="button" className="vrm-versions-variable" data-version-variable={v.slice(1, -1)} disabled={desactive || !premier.trim()} title={sens} onClick={() => inserer(v)}>{v}</button>
          ))}
        </div>
      )}
      {total < VARIANTES_MAX && (
        <button type="button" className="vrm-versions-ajouter" data-version-ajouter="" disabled={desactive || !premier.trim()}
          onClick={ajouter}>+ Ajouter une variante</button>
      )}
      {remplies >= 2
        ? <small className="vrm-versions-note" data-versions-note="">{remplies} versions : une au hasard, jamais la même deux fois de suite.</small>
        : <small className="vrm-versions-note" data-versions-note="">Écris plusieurs versions : chacun reçoit une phrase différente du précédent.</small>}
      {remplies >= 2 && !extOk && (
        <small className="vrm-versions-maj" data-versions-maj="">Extension 5.369 requise pour varier. Sinon, la version 1 part.</small>
      )}
    </div>
  );
}
