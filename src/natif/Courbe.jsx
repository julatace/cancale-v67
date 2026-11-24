// ── src/natif/Courbe.jsx — une série longue en barres fines (les 30 jours), et une barre de progression ────
// <Courbe> : UNE zone qu'on touche (ou qu'on glisse) : la barre sous le doigt est choisie ; ← → au clavier.
//   barres    [{ cle, valeur (nombre | null = pas su : la piste reste vide), libelle (lu par le lecteur d'écran) }]
//   choisie   le rang choisi ; onChoisir(rang) ; libelle : le nom de la série ; attrs : data-* de l'écran
//   <Courbe libelle="Vendu des 30 derniers jours" barres={jours} choisie={29} onChoisir={setJour}/>
// <Progression> : une barre de progression (0–100), son texte au-dessus à gauche, le détail à droite.
//   <Progression pct={61} texte="1 840 € / 3 000 €" detail="61 % · il reste 11 j" onClick={modifier}/>
// <Champ> : un champ de saisie court (44 de haut, 17 px : l'iPhone ne zoome pas), son libellé au-dessus.
//   <Champ libelle="Objectif du mois" valeur={v} onChange={setV} inputMode="decimal" suffixe="€"/>
import React from 'react';
import { cx } from './outils.js';
import './complements.css';

const q4 = (x) => String(Math.max(0, Math.min(100, Math.round(x / 4) * 4)));

export function Courbe({ barres = [], choisie = -1, onChoisir = null, libelle = '', className = '', attrs = null }) {
  const ref = React.useRef(null);
  const max = Math.max(0, ...barres.map((b) => (b.valeur > 0 ? b.valeur : 0)));
  const n = barres.length;
  const i = choisie >= 0 && choisie < n ? choisie : n - 1;
  const choisir = (k) => { if (onChoisir && k >= 0 && k < n && k !== i) onChoisir(k); };
  const sous = (e) => { const el = ref.current; if (!el || !n) return; const r = el.getBoundingClientRect(); choisir(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)))); };
  const b = barres[i] || null;
  return (
    <div ref={ref} className={cx('n-courbe', className)} role="slider" tabIndex={0} aria-label={libelle || undefined}
      aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={i} aria-valuetext={b ? b.libelle : undefined}
      onPointerDown={(e) => { sous(e); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* rien */ } }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') sous(e); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); choisir(i - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); choisir(i + 1); } }}
      {...(attrs || {})}>
      {barres.map((x, k) => (
        <span key={x.cle} className="n-courbe-piste" data-n-choisie={k === i ? '' : undefined} aria-hidden="true">
          <span className="n-courbe-plein" data-n-h={x.valeur > 0 && max > 0 ? q4(Math.max(6, (x.valeur / max) * 100)) : '0'}/>
        </span>
      ))}
    </div>
  );
}

export function Progression({ pct = null, texte = '', detail = '', onClick = null, className = '', attrs = null }) {
  const contenu = (
    <>
      <span className="n-progres-ligne"><span className="n-progres-texte">{texte}</span><span className="n-progres-detail">{detail}</span></span>
      <span className="n-progres-piste" aria-hidden="true"><span className="n-progres-plein" data-n-h={pct == null ? '0' : q4(pct)}/></span>
    </>
  );
  const role = { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct == null ? undefined : pct, 'aria-valuetext': [texte, detail].filter(Boolean).join(' · ') };
  return onClick
    ? <button type="button" className={cx('n-progres', 'n-progres-touche', className)} onClick={onClick} {...(attrs || {})}><span className="n-progres-corps" {...role}>{contenu}</span></button>
    : <div className={cx('n-progres', className)} {...role} {...(attrs || {})}>{contenu}</div>;
}

export function Champ({ libelle, valeur = '', onChange, inputMode = 'text', suffixe = '', placeholder = '', className = '', attrs = null }) {
  const id = React.useId();
  return (
    <label className={cx('n-champ', className)} htmlFor={id}>
      <span className="n-champ-libelle">{libelle}</span>
      <span className="n-champ-ligne">
        <input id={id} className="n-champ-saisie" value={valeur} inputMode={inputMode} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange && onChange(e.target.value)} {...(attrs || {})}/>
        {suffixe ? <span className="n-champ-suffixe">{suffixe}</span> : null}
      </span>
    </label>
  );
}

export default Courbe;
