// ── src/ui/CapsulesPhrase.jsx — les filtres d'une phrase, en capsules qu'on change (chantier 92) ──
// La phrase tapée (« nike 42 pas vendue depuis 2 mois ») est lue par src/recherchePhrase.js ;
// ici, chaque filtre compris devient une CAPSULE visible :
//   · toucher une capsule ouvre une petite feuille : changer sa valeur, « C'est un N° / une
//     taille » quand le nombre est ambigu, ou la retirer — chaque geste RÉÉCRIT le texte de la
//     recherche à la place exacte de ses mots (le texte reste la seule vérité) ;
//   · un filtre qui n'a pas de sens sur cet écran est dit « pas ici » (jamais ignoré en silence),
//     et, s'il vise un autre endroit (des colis depuis Annonces), un lien y cherche ;
//   · la ligne dessous dit le compte (« 12 paires sur 1 000 »), ce qui est écarté faute d'être
//     lu (« 3 écartées : taille pas lue »), ou « Rien ne correspond » — jamais un silence.
// Textes : `listes.phrase.*` (5 langues, src/i18n/langues/<l>/rechliste.js).
import React, { useState } from 'react';
import { tr, monnaie, date } from '../i18n/index.js';
import { NOM_TRANSPORTEUR, retirerFiltre, remplacerFiltre } from '../recherchePhrase.js';
import { Feuille } from './Feuille.jsx';
import './listes-recherche.css';

const duree = (f) => tr('listes.phrase.u.' + f.unite, { n: f.n });
const prixTxt = (v) => monnaie(v, 'EUR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });
const jourTxt = (f) => {
  const j = f.rel && f.rel !== 'semaine' ? tr('listes.phrase.jour.' + f.rel) : date(f.jusqua + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'short' });
  return f.avant ? tr('listes.phrase.jourAvant', { j: j.toLowerCase() }) : j;
};
export function libelleFiltre(f) {
  switch (f.k) {
    case 'marque': case 'modele': return f.v;
    case 'taille': return tr('listes.phrase.taille', { v: String(f.v).replace('.', ',') });
    case 'numero': return tr('listes.phrase.numero', { v: f.v });
    case 'prix':
      if (f.min != null && f.max != null) return f.min === f.max ? prixTxt(f.min) : tr('listes.phrase.prixEntre', { a: prixTxt(f.min), b: prixTxt(f.max) });
      return f.max != null ? tr('listes.phrase.prixMax', { v: prixTxt(f.max) }) : tr('listes.phrase.prixMin', { v: prixTxt(f.min) });
    case 'etat': return tr('listes.phrase.etat.' + f.v);
    case 'depuis': return tr(f.op === '<' ? 'listes.phrase.depuisMoins' : 'listes.phrase.depuisPlus', { d: duree(f) });
    case 'jour': return jourTxt(f);
    case 'transporteur': return NOM_TRANSPORTEUR[f.v] || f.v;
    case 'quoi': return tr('listes.phrase.quoi.' + f.v);
    case 'mots': return tr('listes.phrase.mots', { v: f.v.join(' ') });
    default: return f.src || '';
  }
}
// La valeur qu'on change à la main (un nombre), et le texte qui la réécrit.
const valeurDe = (f) => (f.k === 'taille' ? f.v : f.k === 'numero' ? f.v : f.k === 'prix' ? (f.max != null ? f.max : f.min) : f.k === 'depuis' ? f.jours : null);
const texteDe = (f, v) => {
  const s = String(v).trim(); if (!s) return null;
  if (f.k === 'taille') return /^\d{2}([.,]5)?$/.test(s) ? tr('listes.phrase.ecrire.taille', { n: s }) : null;
  if (f.k === 'numero') return /^[a-z]?\d{1,6}$/i.test(s) ? 'N°' + s.toUpperCase() : null;
  if (f.k === 'prix') { if (!/^\d{1,6}([.,]\d{1,2})?$/.test(s)) return null; return f.min != null && f.max != null && f.min === f.max ? s + ' €' : (f.max != null ? '< ' : '> ') + s + ' €'; }
  if (f.k === 'depuis') return /^\d{1,4}$/.test(s) ? tr(f.op === '<' ? 'listes.phrase.ecrire.moinsDe' : 'listes.phrase.ecrire.depuis', { n: s }) : null;
  return null;
};

export function CapsulesPhrase({ analyse, q, onQ, resultat, total, ailleursVers, onAilleurs, motTotal = 'resultat', className = '', ...attrs }) {
  const [edit, setEdit] = useState(null);
  const [val, setVal] = useState('');
  if (!analyse || !analyse.filtres || !analyse.filtres.length) return null;
  const ignores = new Set((resultat && resultat.ignores) || []);
  const pasSu = (resultat && resultat.pasSu) || {};
  const n = resultat ? resultat.n : null;
  const changer = (t) => { setEdit(null); if (onQ) onQ(t); };
  const ouvrir = (f) => { setEdit(f); const v = valeurDe(f); setVal(v == null ? '' : String(v).replace('.', ',')); };
  const lignesPasSu = Object.entries(pasSu).map(([id, k]) => { const f = analyse.filtres.find((x) => x.id === id); return f ? { id, n: k, quoi: tr('listes.phrase.champ.' + f.k) } : null; }).filter(Boolean);
  return (
    <div className={'vrm-ui-phrase' + (className ? ' ' + className : '')} data-phrase="" data-phrase-n={n == null ? '' : n} data-phrase-filtres={analyse.filtres.map((f) => f.k).join(' ')} {...attrs}>
      <div className="vrm-ui-phrase-capsules" role="group" aria-label={tr('listes.phrase.filtres')}>
        {analyse.filtres.map((f) => { const off = ignores.has(f.id); return (
          <button key={f.id} type="button" className={'vrm-ui-capsule' + (off ? ' is-pas-ici' : '')} data-phrase-filtre={f.k}
            data-phrase-valeur={f.k === 'prix' ? `${f.min ?? ''}-${f.max ?? ''}` : f.k === 'depuis' ? `${f.op}${f.jours}` : f.k === 'jour' ? `${f.avant ? '<=' : ''}${f.jusqua}` : f.k === 'mots' ? f.v.join(' ') : String(f.v)}
            data-phrase-ambigu={f.ambigu ? '1' : undefined} data-phrase-ignore={off ? '1' : undefined} aria-haspopup="dialog" onClick={() => ouvrir(f)}>
            <span>{libelleFiltre(f)}</span>{off ? <span className="vrm-ui-capsule-off">{tr('listes.phrase.pasIci')}</span> : null}
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        ); })}
      </div>
      <div className="vrm-ui-phrase-ligne" role="status" data-phrase-resultat={n == null ? '' : n}>
        {n == null ? null : n === 0 ? <span data-phrase-rien="">{tr('listes.phrase.rien')}</span> : <span>{tr('listes.phrase.' + motTotal, { n, total: total == null ? '' : total })}</span>}
        {lignesPasSu.map((l) => <span key={l.id} data-phrase-pas-su={l.n}> · {tr('listes.phrase.pasSu', { n: l.n, quoi: l.quoi })}</span>)}
        {ailleursVers && onAilleurs ? <button type="button" className="vrm-ui-phrase-ailleurs" data-phrase-ailleurs={ailleursVers} onClick={() => onAilleurs(ailleursVers)}>{tr('listes.phrase.ailleurs.' + ailleursVers)}</button> : null}
      </div>
      {edit ? (
        <Feuille titre={libelleFiltre(edit)} onClose={() => setEdit(null)} data-phrase-feuille={edit.k}>
          <div className="vrm-ui-phrase-edit">
            {valeurDe(edit) != null && (
              <form className="vrm-ui-phrase-champ" onSubmit={(e) => { e.preventDefault(); const t = texteDe(edit, val.replace(',', edit.k === 'prix' ? ',' : '.')); if (t) changer(remplacerFiltre(q, edit, t)); }}>
                <label><span>{tr('listes.phrase.valeur')}</span>
                  <input value={val} onChange={(e) => setVal(e.target.value)} inputMode={edit.k === 'numero' ? 'text' : 'decimal'} enterKeyHint="done" data-phrase-edit-valeur="" aria-label={tr('listes.phrase.valeur')}/></label>
                <button type="submit" className="vrm-ui-phrase-ok" data-phrase-appliquer="">{tr('listes.phrase.appliquer')}</button>
              </form>
            )}
            {edit.k === 'taille' && edit.ambigu ? <button type="button" className="vrm-ui-phrase-geste" data-phrase-en-numero="" onClick={() => changer(remplacerFiltre(q, edit, 'N°' + String(edit.v)))}>{tr('listes.phrase.cEstNumero')}</button> : null}
            {edit.k === 'numero' && /^\d{2}$/.test(edit.v) && Number(edit.v) >= 16 && Number(edit.v) <= 52 ? <button type="button" className="vrm-ui-phrase-geste" data-phrase-en-taille="" onClick={() => changer(remplacerFiltre(q, edit, tr('listes.phrase.ecrire.taille', { n: edit.v })))}>{tr('listes.phrase.cEstTaille')}</button> : null}
            <button type="button" className="vrm-ui-phrase-geste is-retirer" data-phrase-retirer={edit.k} onClick={() => changer(retirerFiltre(q, edit))}>{tr('listes.phrase.retirer')}</button>
          </div>
        </Feuille>
      ) : null}
    </div>
  );
}
export default CapsulesPhrase;
