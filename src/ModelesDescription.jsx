// ── MES MODÈLES DE DESCRIPTION (3 nov.) — règle : src/modelesDescription.js ─
// `MesModeles` : Paramètres → Annonces → « Mes modèles » (liste éditable).
// `InsererModele` : la rangée de chips au-dessus d'une description ; un tap
// insère le modèle (variables remplacées) au curseur.
import React from 'react';
import { lireModeles, remplirModele, insererDans, nouveauModele, VARIABLES } from './modelesDescription.js';
import './styles-annonces-outils.css';

export function MesModeles({ modeles, onChange, confirmer }) {
  const liste = lireModeles(modeles);
  const [ouvert, setOuvert] = React.useState(null);
  const champs = React.useRef({});
  const poser = (l) => onChange(lireModeles(l));
  const maj = (id, patch) => poser(liste.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const ajouter = () => {
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const m = nouveauModele('', '{taille} · {marque} · {N°}', id);
    onChange([...liste, m]); setOuvert(id);
  };
  const retirer = async (m) => { if (confirmer && !(await confirmer(m))) return; poser(liste.filter((x) => x.id !== m.id)); };
  const variable = (id, v) => {
    const el = champs.current[id]; const m = liste.find((x) => x.id === id); if (!m) return;
    const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : m.texte.length;
    const tag = `{${v}}`;
    maj(id, { texte: m.texte.slice(0, pos) + tag + m.texte.slice(pos) });
    setTimeout(() => { try { el.focus(); el.setSelectionRange(pos + tag.length, pos + tag.length); } catch (_) {} }, 0);
  };
  return (
    <div className="vrm-ao-modeles" data-mes-modeles={liste.length}>
      {liste.map((m) => (
        <div key={m.id} className="vrm-ao-modele" data-modele={m.id}>
          {ouvert === m.id ? (
            <>
              <input aria-label="Nom du modèle" value={m.nom} placeholder="Nom" maxLength={40} onChange={(e) => maj(m.id, { nom: e.target.value })} data-modele-nom=""/>
              <textarea aria-label="Texte du modèle" ref={(el) => { champs.current[m.id] = el; }} value={m.texte} maxLength={2000} onChange={(e) => maj(m.id, { texte: e.target.value })} data-modele-texte=""/>
              <div className="vrm-ao-vars">{VARIABLES.map((v) => <button key={v} type="button" onClick={() => variable(m.id, v)} data-modele-var={v}>{`{${v}}`}</button>)}</div>
              <div className="vrm-ao-modele-pied">
                <button type="button" className="vrm-ao-second" onClick={() => setOuvert(null)} data-modele-ok="">OK</button>
                <button type="button" className="vrm-ao-second" onClick={() => retirer(m)} data-modele-retirer="">Supprimer</button>
              </div>
            </>
          ) : (
            <button type="button" className="vrm-ao-chip" style={{ maxWidth: 'none', textAlign: 'left', border: 0, padding: 0, background: 'transparent' }} onClick={() => setOuvert(m.id)} data-modele-ouvrir="">
              {m.nom}
            </button>
          )}
        </div>
      ))}
      <button type="button" className="vrm-ao-second" onClick={ajouter} data-modele-ajouter="">Nouveau modèle</button>
    </div>
  );
}

// `valeur`/`surChange` : la description ; `champ` : la ref du textarea (curseur) ;
// `vars` : { taille, marque, numero, titre, prix } de l'article préparé.
export function InsererModele({ modeles, valeur, surChange, champ, vars }) {
  const liste = lireModeles(modeles);
  if (!liste.length) return null;
  const inserer = (m) => {
    const el = champ && champ.current;
    const pos = el && typeof el.selectionStart === 'number' && document.activeElement === el ? el.selectionStart : null;
    const r = insererDans(valeur, remplirModele(m.texte, vars || {}), pos);
    surChange(r.texte);
    setTimeout(() => { try { if (el) { el.focus(); el.setSelectionRange(r.curseur, r.curseur); } } catch (_) {} }, 0);
  };
  return (
    <div className="vrm-ao-chips" role="group" aria-label="Mes modèles" data-inserer-modele={liste.length}>
      {liste.map((m) => <button key={m.id} type="button" className="vrm-ao-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => inserer(m)} data-inserer={m.id}>{m.nom}</button>)}
    </div>
  );
}
