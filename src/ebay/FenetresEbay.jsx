// ════════════════════════════════════════════════════════════════════════════
// LES FENÊTRES GUIDÉES D'eBAY (11 nov., lot `ebay-complet`). Julien : « plus de
// pop-ups, de vraies améliorations pratiques ; l'app doit DEMANDER si elle ne
// trouve pas une catégorie, une couleur… ».
//
//  • `FenetreGuideeEbay` : une fenêtre à étapes numérotées (1re publication,
//    connexion, politique manquante, offre, vente ⇒ bordereau eBay, retour) —
//    textes en clés (`ebay.guide.<id>.<n>`, src/ebay/parametres.js `GUIDES`).
//  • `QuestionsEbay` : ce que VRM n'a PAS trouvé, demandé une question à la
//    fois (catégorie, caractéristique, état, descripteur, politique). Les choix
//    sont ceux d'eBay ; « Vinted dit : … » quand Vinted avait une valeur hors
//    liste — jamais une valeur proche posée à sa place (§5).
//  • `BoutonGuideEbay` : le « Comment faire ? » qui ouvre une fenêtre guidée.
// Toutes passent par la feuille unique (`Feuille` = SheetShell de l'app : portail,
// FermeAuRetour, §7) ; tout texte par `tr()`.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonBase } from '../composants/Bouton.jsx';
import { etapesGuide, GUIDES } from './parametres.js';

const champ = (C) => ({ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, background: C.card2 || C.card, color: C.text, borderRadius: 12, padding: '12px 13px', fontSize: 17, fontFamily: 'inherit', outline: 'none', minHeight: 44 });
const choixStyle = (C, actif) => ({ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, border: `1px solid ${actif ? C.accent : C.border}`, background: actif ? `${C.accent}12` : C.card, color: C.text, borderRadius: 12, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' });

export function FenetreGuideeEbay({ id, Feuille, onClose, C, vars = {}, action = null, children = null }) {
  const g = GUIDES[id] || {};
  return (
    <Feuille onClose={onClose} titre={tr(`ebay.guide.${id}.titre`)} data-ebay-guide={id} maxWidth={480}>
      <ol data-ebay-guide-etapes={etapesGuide(id).length} style={{ listStyle: 'none', margin: 0, padding: '4px 0 0', display: 'grid', gap: 12 }}>
        {etapesGuide(id).map((k, i) => (
          <li key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: `${C.accent}15`, color: C.accentTexte || C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ fontSize: 15, color: C.text, lineHeight: 1.45, paddingTop: 3 }}>{tr(k, vars)}</span>
          </li>
        ))}
      </ol>
      {children}
      <div className="vrm-fs-pied" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        {g.lien && <BoutonBase href={g.lien} target="_blank" rel="noreferrer" data-ebay-guide-lien={id}>{tr('ebay.guide.ouvrirEbay')}</BoutonBase>}
        {action || <BoutonBase variante="primaire" data-ebay-guide-ok={id} onClick={onClose}>{tr('ebay.guide.compris')}</BoutonBase>}
      </div>
    </Feuille>
  );
}

export function BoutonGuideEbay({ id, Feuille, C, vars }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (<>
    <button type="button" data-ebay-guide-bouton={id} onClick={() => setOuvert(true)}
      style={{ minHeight: 44, border: 'none', background: 'transparent', color: C.accentTexte || C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '0 4px' }}>{tr('ebay.guide.comment')}</button>
    {ouvert && <FenetreGuideeEbay id={id} Feuille={Feuille} C={C} vars={vars} onClose={() => setOuvert(false)}/>}
  </>);
}

// ── UNE QUESTION À LA FOIS ────────────────────────────────────────────────────
// `questions` : forme `questions()` de src/ebay/parametres.js. `onRepondre(q, v)`
// rend une promesse (le parent recharge, ex. les caractéristiques d'une
// catégorie choisie). `onChercherCategorie(texte)` ⇒ Promise<[{id,nom,chemin}] | null>.
export function QuestionsEbay({ questions = [], Feuille, C, onClose, onRepondre, onChercherCategorie, titre = '' }) {
  const [i, setI] = React.useState(0);
  const [val, setVal] = React.useState(null);
  const [occupe, setOccupe] = React.useState(false);
  const [cherche, setCherche] = React.useState(titre);
  const [cats, setCats] = React.useState(undefined);   // undefined : celles de la question · null : pas su · liste
  const q = questions[i];
  React.useEffect(() => { setVal(null); setCats(undefined); }, [i, q && q.type, q && q.nom]);
  if (!q) return null;
  const n = questions.length;
  const suivant = async (v) => {
    setOccupe(true);
    try { await onRepondre(q, v); } finally { setOccupe(false); }
    if (i + 1 < n) setI(i + 1); else onClose(true);
  };
  const liste = cats === undefined ? (q.choix || []) : (cats || []);
  const chercher = async () => {
    if (!cherche.trim() || !onChercherCategorie) return;
    setOccupe(true);
    try { setCats(await onChercherCategorie(cherche.trim())); } finally { setOccupe(false); }
  };
  const vide = val == null || (Array.isArray(val) ? !val.length : !String(val).trim());
  let corps = null;
  if (q.type === 'categorie') {
    corps = (<>
      <p style={{ fontSize: 15, color: C.text, margin: '0 0 10px', lineHeight: 1.45 }}>{tr(q.pasSu && cats === undefined ? 'ebay.q.categorie.passu' : liste.length ? 'ebay.q.categorie.choisis' : 'ebay.q.categorie.aucune')}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={cherche} onChange={(e) => setCherche(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') chercher(); }} aria-label={tr('ebay.q.categorie.recherche')} placeholder={tr('ebay.q.categorie.recherche')} data-ebay-q-cherche style={champ(C)}/>
        <BoutonBase onClick={chercher} occupe={occupe} data-ebay-q-chercher>{tr('ebay.q.chercher')}</BoutonBase>
      </div>
      {cats === null && <p style={{ fontSize: 13, color: C.warn, margin: '0 0 8px' }}>{tr('ebay.q.categorie.passu')}</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {liste.map((c) => (
          <button key={c.id} type="button" data-ebay-q-categorie={c.id} onClick={() => suivant(c)} disabled={occupe} style={choixStyle(C, false)}>
            <span style={{ display: 'block', fontWeight: 600 }}>{c.nom}</span>
            {c.chemin ? <span style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 2 }}>{c.chemin}</span> : null}
          </button>
        ))}
      </div>
    </>);
  } else if (q.type === 'caracteristique') {
    const ch = Array.isArray(q.choix) ? q.choix : [];
    corps = (<>
      <p style={{ fontSize: 15, color: C.text, margin: '0 0 6px', lineHeight: 1.45 }}>{tr(q.multi ? 'ebay.q.carac.plusieurs' : 'ebay.q.carac.une', { nom: q.nom })}</p>
      {q.vinted ? <p data-ebay-q-vinted style={{ fontSize: 13, color: C.muted, margin: '0 0 10px' }}>{tr('ebay.q.carac.vinted', { valeur: q.vinted })}</p> : null}
      {q.multi && ch.length ? (
        <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {ch.map((v) => { const pris = Array.isArray(val) && val.includes(v); return (
            <button key={v} type="button" aria-pressed={pris} data-ebay-q-valeur={v} onClick={() => setVal((x) => { const l = Array.isArray(x) ? x : []; return pris ? l.filter((y) => y !== v) : [...l, v]; })} style={choixStyle(C, pris)}>{pris ? '✓ ' : ''}{v}</button>
          ); })}
        </div>
      ) : ch.length && ch.length <= 12 && q.mode === 'SELECTION_ONLY' ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {ch.map((v) => <button key={v} type="button" data-ebay-q-valeur={v} onClick={() => suivant(v)} disabled={occupe} style={choixStyle(C, false)}>{v}</button>)}
        </div>
      ) : (<>
        <input list={ch.length ? 'vrm-ebay-q-dl' : undefined} value={val || ''} onChange={(e) => setVal(e.target.value)} aria-label={q.nom} data-ebay-q-texte style={champ(C)}/>
        {ch.length ? <datalist id="vrm-ebay-q-dl">{ch.map((v) => <option key={v} value={v}/>)}</datalist> : null}
        {q.mode === 'SELECTION_ONLY' && val && !ch.includes(val) ? <p style={{ fontSize: 13, color: C.warn, margin: '6px 0 0' }}>{tr('ebay.q.carac.horsListe')}</p> : null}
      </>)}
    </>);
  } else if (q.type === 'etat' || q.type === 'descripteur') {
    corps = (<>
      <p style={{ fontSize: 15, color: C.text, margin: '0 0 10px', lineHeight: 1.45 }}>{q.type === 'etat' ? tr('ebay.q.etat') : tr('ebay.q.descripteur', { nom: q.nom })}</p>
      <div style={{ display: 'grid', gap: 6 }}>
        {(q.choix || []).map((c) => <button key={c.id} type="button" data-ebay-q-etat={c.id} onClick={() => suivant(c)} disabled={occupe} style={choixStyle(C, false)}>{c.label || c.nom}</button>)}
      </div>
    </>);
  } else if (q.type === 'politique') {
    corps = (<>
      <p style={{ fontSize: 15, color: C.text, margin: '0 0 10px', lineHeight: 1.45 }}>{tr(`ebay.q.politique.${q.quoi}`)}</p>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 14, color: C.text, lineHeight: 1.5 }}>
        <li>{tr('ebay.guide.politique.1')}</li><li>{tr('ebay.guide.politique.2')}</li>
      </ol>
      <BoutonBase href={GUIDES.politique.lien} target="_blank" rel="noreferrer" data-ebay-q-politique-lien>{tr('ebay.guide.ouvrirEbay')}</BoutonBase>
    </>);
  }
  const avecValider = (q.type === 'caracteristique' && !(q.mode === 'SELECTION_ONLY' && !q.multi && (q.choix || []).length && (q.choix || []).length <= 12)) || q.type === 'politique';
  const horsListe = q.type === 'caracteristique' && q.mode === 'SELECTION_ONLY' && !q.multi && (q.choix || []).length > 12 && val && !(q.choix || []).includes(val);
  return (
    <Feuille onClose={() => onClose(false)} titre={tr(`ebay.q.titre.${q.type}`)} sousTitre={n > 1 ? tr('ebay.q.progression', { i: i + 1, n }) : undefined} data-ebay-questions={n} data-ebay-question={q.type} maxWidth={480}>
      {corps}
      <div className="vrm-fs-pied" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <BoutonBase onClick={() => onClose(false)} data-ebay-q-plus-tard>{tr('ebay.q.plusTard')}</BoutonBase>
        {avecValider && <BoutonBase variante="primaire" occupe={occupe} disabled={q.type !== 'politique' && (vide || horsListe)} data-ebay-q-valider onClick={() => suivant(q.type === 'politique' ? 'relire' : val)}>{tr(q.type === 'politique' ? 'ebay.q.politique.fait' : 'ebay.q.valider')}</BoutonBase>}
      </div>
    </Feuille>
  );
}
