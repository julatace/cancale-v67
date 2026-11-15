// ── « PERSONNALISER » UN MEUBLE (v4, 15 nov. — maquettes v4-perso, v4-perso-suite) ─────────────
// Une feuille : l'aperçu EN DIRECT (le vrai rendu du meuble avec les réglages en cours, réduit), l'affichage
// (Cartons · Rayonnage · Plan), la teinte des contenants, ce que dit l'étiquette, la densité, le meuble (nom,
// couleur, colonnes × rangées), les piles par colonne et la place dans la pièce (flèches). Rien n'est écrit avant
// « Enregistrer » (le seul plein) — sauf la place dans la pièce, écrite par ses flèches (un geste qui se voit).
import React from 'react';
import { tr } from '../i18n/index.js';
import { AFFICHAGES, TEINTES, TEINTE_MELEES, DENSITES, ETIQUETTE, COULEURS_MEUBLE, reglagesDe, couleurMeuble } from './reglages.js';
import { colonnesEnPile, COLS_MAX, RANGEES_MAX } from '../stockEtageres.js';

export default function Personnaliser({ meuble, Feuille, apercu, nArticles = 0, rang = 0, nMeubles = 1, nomAvant = '', onDeplacer, onEnregistrer, onPlus, onFermer, Icon, mots }) {
  const [nom, setNom] = React.useState(String((meuble && meuble.name) || ''));
  const [couleur, setCouleur] = React.useState(() => couleurMeuble(meuble));
  const [cols, setCols] = React.useState(Math.max(1, Number(meuble && meuble.cols) || 1));
  const [rows, setRows] = React.useState(Math.max(1, Number(meuble && meuble.rows) || 1));
  const [piles, setPiles] = React.useState(() => [...colonnesEnPile(meuble)].sort((a, b) => a - b));
  const [reg, setReg] = React.useState(() => reglagesDe(meuble));
  const poser = (k, v) => setReg((r) => ({ ...r, [k]: v }));
  const basculer = (k) => setReg((r) => ({ ...r, etiquette: { ...r.etiquette, [k]: !r.etiquette[k] } }));
  const borne = (v, max) => Math.max(1, Math.min(max, Math.floor(Number(v)) || 1));
  const brouillon = { ...meuble, name: nom.trim() || (meuble && meuble.name) || '', couleur, cols, rows, reglages: reg, piles: piles.filter((c) => c <= cols), gravite: cols > 1 ? piles.filter((c) => c <= cols).length === cols : piles.includes(1) };
  const I = Icon || (() => null);
  const seg = (valeurs, actuelle, surChoix, cle, attr) => (
    <div className="vrm-p4-seg" role="radiogroup">
      {valeurs.map((v) => <button key={v} type="button" role="radio" aria-checked={actuelle === v} {...{ [attr]: v }} onClick={() => surChoix(v)}>{tr(cle + v)}</button>)}
    </div>);
  const resume = [tr('etag4.affichage.' + reg.affichage), reg.teinte === TEINTE_MELEES ? tr('etag4.teinte.melees') : tr('etag4.teinteDe', { teinte: tr('etag.couleur.' + reg.teinte).toLowerCase() }), tr('etag4.densite.' + reg.densite)];
  return (
    <Feuille onClose={onFermer} titre={tr('etag4.personnaliser')} sousTitre={(meuble && meuble.name) || ''} className="vrm-p4" data-perso-meuble={meuble && meuble.id} maxWidth={520}>
      <div className="vrm-p4-corps">
        <div className="vrm-p4-carte vrm-p4-apercu" data-perso-apercu={reg.affichage + '|' + reg.teinte + '|' + reg.densite}>
          <div className="vrm-p4-ap-m" aria-hidden="true"><div className="vrm-p4-ap-s">{apercu ? apercu(brouillon) : null}</div></div>
          <div className="vrm-p4-ap-t"><span className="vrm-p4-lbl">{tr('etag4.apercu')}</span><b>{resume[0]}</b><span>{resume[1]}</span><span>{resume[2]}</span><span>{tr('etag4.dims', { cols, rows, n: nArticles, articles: mots && mots.noms ? mots.noms : tr('etag4.articles') })}</span></div>
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.affichage')}</span>
          {seg(AFFICHAGES, reg.affichage, (v) => poser('affichage', v), 'etag4.affichage.', 'data-perso-affichage')}
          <span className="vrm-p4-aide">{tr('etag4.isoDansPiece')}</span>
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.contenants')}</span>
          <div className="vrm-p4-sw" role="radiogroup" aria-label={tr('etag4.contenants')}>
            {[TEINTE_MELEES, ...TEINTES].map((t) => <button key={t} type="button" role="radio" aria-checked={reg.teinte === t} data-perso-teinte={t} onClick={() => poser('teinte', t)} aria-label={t === TEINTE_MELEES ? tr('etag4.teinte.melees') : tr('etag.couleur.' + t)}><i data-teinte={t} /></button>)}
          </div>
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.etiquette')}</span>
          <div className="vrm-p4-tg">
            {ETIQUETTE.map((k) => <button key={k} type="button" aria-pressed={!!reg.etiquette[k]} data-perso-etiquette={k} onClick={() => basculer(k)}><span aria-hidden="true">{reg.etiquette[k] ? '✓' : '+'}</span>{tr('etag4.champ.' + k)}</button>)}
          </div>
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.densite')}</span>
          {seg(DENSITES, reg.densite, (v) => poser('densite', v), 'etag4.densite.', 'data-perso-densite')}
          {reg.densite === 'loin' ? <span className="vrm-p4-aide">{tr('etag4.loinSansPhoto')}</span> : null}
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.meuble')}</span>
          <input className="vrm-p4-champ" value={nom} maxLength={30} onChange={(e) => setNom(e.target.value)} aria-label={tr('stock.nom')} data-perso-nom="" />
          <div className="vrm-p4-sw vrm-p4-sw-m" role="radiogroup" aria-label={tr('etag.couleurMeuble')}>
            {COULEURS_MEUBLE.map((c) => <button key={c} type="button" role="radio" aria-checked={couleur === c} data-perso-couleur={c} onClick={() => setCouleur(c)} aria-label={tr('etag.couleur.' + c)}><i data-meuble-teinte={c} /></button>)}
          </div>
          <div className="vrm-p4-pas2">
            <div className="vrm-p4-pas"><button type="button" onClick={() => setCols(borne(cols - 1, COLS_MAX))} disabled={cols <= 1} aria-label={tr('etag.moins', { quoi: tr('stock.colonnes') })}>−</button><b data-perso-cols={cols}>{cols}<small> {tr(cols > 1 ? 'etag4.colonnes' : 'etag4.colonne')}</small></b><button type="button" onClick={() => setCols(borne(cols + 1, COLS_MAX))} disabled={cols >= COLS_MAX} aria-label={tr('etag.plus', { quoi: tr('stock.colonnes') })}>+</button></div>
            <div className="vrm-p4-pas"><button type="button" onClick={() => setRows(borne(rows - 1, RANGEES_MAX))} disabled={rows <= 1} aria-label={tr('etag.moins', { quoi: tr('etag.rangees') })}>−</button><b data-perso-rows={rows}>{rows}<small> {tr(rows > 1 ? 'etag4.rangees' : 'etag4.rangee')}</small></b><button type="button" onClick={() => setRows(borne(rows + 1, RANGEES_MAX))} disabled={rows >= RANGEES_MAX} aria-label={tr('etag.plus', { quoi: tr('etag.rangees') })}>+</button></div>
          </div>
        </div>

        <div className="vrm-p4-carte">
          <span className="vrm-p4-lbl">{tr('etag4.pilesPlace')}</span>
          <div className="vrm-p4-piles">
            {Array.from({ length: cols }, (_, k) => k + 1).map((c) => <button key={c} type="button" aria-pressed={piles.includes(c)} data-perso-pile={c} onClick={() => setPiles((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c].sort((a, b) => a - b)))} aria-label={tr('etag.colonneN', { n: c })}>{piles.includes(c) ? <span aria-hidden="true">↓</span> : null}{tr('etag4.col', { n: c })}</button>)}
          </div>
          <div className="vrm-p4-ordre">
            <span data-perso-rang={rang + 1}>{nMeubles > 1 ? (rang === 0 ? tr('etag4.premier', { n: nMeubles }) : tr('etag4.place', { rang: rang + 1, n: nMeubles, avant: nomAvant })) : tr('etag4.seul')}</span>
            <button type="button" className="sb-rond" data-meuble-monter={meuble && meuble.id} disabled={rang === 0} onClick={() => onDeplacer && onDeplacer(-1)} aria-label={tr('etag.monter', { nom: (meuble && meuble.name) || '' })}><I name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
            <button type="button" className="sb-rond" data-meuble-descendre={meuble && meuble.id} disabled={rang >= nMeubles - 1} onClick={() => onDeplacer && onDeplacer(1)} aria-label={tr('etag.descendre', { nom: (meuble && meuble.name) || '' })}><I name="chevron" size={16} /></button>
          </div>
          {onPlus ? <button type="button" className="sb-lien vrm-p4-plus" data-meuble-modifier={meuble && meuble.id} aria-label={tr('stock.modifierMeuble')} onClick={onPlus}>{tr('etag4.plusReglages')}</button> : null}
        </div>
      </div>
      <div className="vrm-fs-pied vrm-p4-pied">
        <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-perso-enregistrer="" onClick={() => onEnregistrer && onEnregistrer(brouillon)}><I name="check" size={20} />{tr('etag4.enregistrer')}</button>
      </div>
    </Feuille>
  );
}
