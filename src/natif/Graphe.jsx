// ── src/natif/Graphe.jsx — les graphiques d'Aujourd'hui (22 nov., chantier style-clarte) ─────────────────────────────
// Julien (22 nov.) : « ici tu peux faire mieux avec des graphiques ». Trois pièces PRÉSENTATIONNELLES (aucune donnée lue,
// aucune règle : l'écran passe des nombres déjà demandés à leur propriétaire, `null` = pas su) :
//   <GrapheJours>  le vendu de chaque jour en barres (aujourd'hui à l'encre, la barre touchée en accent), le bénéfice brut
//                  du jour en ligne fine sur le MÊME axe (des euros tous les deux : un seul axe), la moyenne en pointillés.
//                  Toucher / glisser / ← → choisit un jour ; ses chiffres sont dits au-dessus par l'écran (`onChoisir`).
//                  jours [{ cle, v (nombre|null), b (nombre|null), libelle (lu par le lecteur d'écran), court (« L », « 12 ») }]
//   <Etincelle>    une petite série (7 points) sous un chiffre : la forme, sans axe ; `null` coupe la ligne.
//   <Repartition>  une barre empilée (les parts d'un total) et sa légende ; chaque part porte son logo, sa valeur, son %.
//                  parts [{ cle, nom, icone (nœud), valeur (nombre), texte (déjà formaté), ton (1–5) }]
// Couleurs : jetons --n-* seulement (complements.css, « Graphe ») ; aucun style en ligne : la géométrie est en attributs SVG.
import React from 'react';
import { cx } from './outils.js';
import './graphe.css';

const H = 132, L = 600, HAUT = 10, BAS = 4;   // repère SVG (étiré en largeur par viewBox)

//   forme="aire" (22 nov. soir, maquettes de Julien) : le vendu en COURBE pleine (aire dégradée sous une ligne), un point par
//                  jour connu (`data-n-jour`) ; un jour pas su coupe l'aire. « barres » (défaut) : la forme d'avant.
let GRAPHE_ID = 0;
export function GrapheJours({ jours = [], choisie = -1, onChoisir = null, libelle = '', moyenneLibelle = '', className = '', attrs = null, forme = 'barres' }) {
  const idDegrade = React.useMemo(() => 'n-graphe-degrade-' + (++GRAPHE_ID), []);
  const ref = React.useRef(null);
  const n = jours.length;
  const max = Math.max(0, ...jours.map((j) => Math.max(j.v > 0 ? j.v : 0, j.b > 0 ? j.b : 0)));
  const i = choisie >= 0 && choisie < n ? choisie : n - 1;
  const choisir = (k) => { if (onChoisir && k >= 0 && k < n && k !== i) onChoisir(k); };
  const sous = (e) => { const el = ref.current; if (!el || !n) return; const r = el.getBoundingClientRect(); choisir(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)))); };
  const pas = n ? L / n : L;
  const larg = Math.max(2, Math.min(28, pas * (n > 14 ? 0.62 : 0.56)));
  const y = (v) => (max > 0 ? HAUT + (H - HAUT - BAS) * (1 - v / max) : H - BAS);
  const lus = jours.filter((j) => j.v != null);
  const moy = lus.length ? lus.reduce((t, j) => t + j.v, 0) / lus.length : null;
  // La ligne du bénéfice : des segments entre deux jours CONNUS voisins (un jour pas su coupe la ligne).
  const segs = []; let cur = [];
  jours.forEach((j, k) => { if (j.b != null) cur.push(`${(k + 0.5) * pas},${y(Math.max(0, j.b))}`); else { if (cur.length > 1) segs.push(cur.join(' ')); cur = []; } });
  if (cur.length > 1) segs.push(cur.join(' '));
  const pointsB = jours.map((j, k) => (j.b != null ? { k, x: (k + 0.5) * pas, y: y(Math.max(0, j.b)) } : null)).filter(Boolean);
  const b = jours[i] || null;
  return (
    <div ref={ref} className={cx('n-graphe', className)} role="slider" tabIndex={0} aria-label={libelle || undefined}
      aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={i} aria-valuetext={b ? b.libelle : undefined}
      onPointerDown={(e) => { sous(e); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* rien */ } }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch' || e.pointerType === 'mouse') sous(e); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); choisir(i - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); choisir(i + 1); } }}
      {...(attrs || {})}>
      <svg className="n-graphe-svg" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {[0.5, 1].map((f) => <line key={f} className="n-graphe-grille" x1="0" x2={L} y1={HAUT + (H - HAUT - BAS) * (1 - f)} y2={HAUT + (H - HAUT - BAS) * (1 - f)} vectorEffect="non-scaling-stroke"/>)}
        <line className="n-graphe-base" x1="0" x2={L} y1={H - BAS} y2={H - BAS} vectorEffect="non-scaling-stroke"/>
        {forme === 'aire' ? (() => {
          // L'AIRE : des morceaux entre deux jours CONNUS voisins (un jour pas su coupe la courbe, jamais un 0 inventé).
          const morceaux = []; let m = [];
          jours.forEach((j, k) => { if (j.v != null) m.push([(k + 0.5) * pas, y(Math.max(0, j.v))]); else { if (m.length) morceaux.push(m); m = []; } });
          if (m.length) morceaux.push(m);
          return <>
            <defs><linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" className="n-graphe-aire-haut"/><stop offset="100%" className="n-graphe-aire-bas"/></linearGradient></defs>
            {morceaux.map((pts, q) => {
              const ligne = pts.map(([px, py]) => `${px},${py}`).join(' ');
              const aire = pts.length > 1 ? `M${pts[0][0]},${H - BAS} L${pts.map(([px, py]) => `${px},${py}`).join(' L')} L${pts[pts.length - 1][0]},${H - BAS} Z` : '';
              return <g key={q}>{aire ? <path className="n-graphe-aire" d={aire} fill={`url(#${idDegrade})`}/> : null}
                {pts.length > 1 ? <polyline className="n-graphe-courbe" points={ligne} vectorEffect="non-scaling-stroke"/> : null}</g>;
            })}
          </>;
        })() : null}
        {jours.map((j, k) => {
          if (forme === 'aire') {
            const cx = (k + 0.5) * pas;
            if (j.v == null) return <rect key={j.cle} className="n-graphe-passu" data-n-jour="" x={cx - 3} y={H - BAS - 2} width="6" height="2" rx="1"/>;
            return <circle key={j.cle} className="n-graphe-pt" data-n-jour="" data-n-auj={k === n - 1 ? '' : undefined} data-n-choisie={k === i ? '' : undefined} data-n-partiel={j.partiel ? '' : undefined}
              cx={cx} cy={y(Math.max(0, j.v))} r={k === i ? 4 : 0} vectorEffect="non-scaling-stroke"/>;
          }
          const x = (k + 0.5) * pas - larg / 2;
          if (j.v == null) return <rect key={j.cle} className="n-graphe-passu" data-n-jour="" x={x} y={H - BAS - 2} width={larg} height="2" rx="1"/>;
          const top = y(Math.max(0, j.v)); const h = Math.max(j.v > 0 ? 3 : 0, H - BAS - top);
          return <rect key={j.cle} className="n-graphe-barre" data-n-jour="" data-n-auj={k === n - 1 ? '' : undefined} data-n-choisie={k === i ? '' : undefined} data-n-partiel={j.partiel ? '' : undefined}
            x={x} y={H - BAS - h} width={larg} height={h} rx={Math.min(4, larg / 2)}/>;
        })}
        {moy != null && max > 0 ? <line className="n-graphe-moyenne" x1="0" x2={L} y1={y(moy)} y2={y(moy)} vectorEffect="non-scaling-stroke"/> : null}
        {segs.map((s, k) => <polyline key={k} className="n-graphe-ligne" points={s} vectorEffect="non-scaling-stroke"/>)}
        {pointsB.length === 1 ? <circle className="n-graphe-point" cx={pointsB[0].x} cy={pointsB[0].y} r="3" vectorEffect="non-scaling-stroke"/> : null}
        <line className="n-graphe-curseur" x1={(i + 0.5) * pas} x2={(i + 0.5) * pas} y1={HAUT - 6} y2={H - BAS} vectorEffect="non-scaling-stroke"/>
      </svg>
      <div className="n-graphe-axe" aria-hidden="true">
        {jours.map((j, k) => <span key={j.cle} className="n-graphe-graduation" data-n-montree={j.court ? '' : undefined} data-n-choisie={k === i ? '' : undefined}>{j.court || ''}</span>)}
      </div>
      {moyenneLibelle ? <span className="n-lu-seul">{moyenneLibelle}</span> : null}
    </div>
  );
}

export function Etincelle({ valeurs = [], className = '' }) {
  const n = valeurs.length;
  const lus = valeurs.filter((v) => v != null);
  if (n < 2 || lus.length < 2) return <span className={cx('n-etincelle', 'n-etincelle-vide', className)} aria-hidden="true"/>;
  const max = Math.max(...lus), min = Math.min(0, ...lus);
  const W = 64, Ht = 20;
  const x = (k) => (k / (n - 1)) * (W - 4) + 2;
  const y = (v) => (max === min ? Ht / 2 : 2 + (Ht - 4) * (1 - (v - min) / (max - min)));
  const segs = []; let cur = [];
  valeurs.forEach((v, k) => { if (v != null) cur.push(`${x(k)},${y(v)}`); else { if (cur.length > 1) segs.push(cur.join(' ')); cur = []; } });
  if (cur.length > 1) segs.push(cur.join(' '));
  const der = valeurs[n - 1];
  return (
    <svg className={cx('n-etincelle', className)} viewBox={`0 0 ${W} ${Ht}`} aria-hidden="true" focusable="false">
      {segs.map((s, k) => <polyline key={k} points={s}/>)}
      {der != null ? <circle cx={x(n - 1)} cy={y(der)} r="2.2"/> : null}
    </svg>
  );
}

export function Repartition({ parts = [], libelle = '', className = '', attrs = null }) {
  const total = parts.reduce((t, p) => t + (p.valeur > 0 ? p.valeur : 0), 0);
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
  // Les parts arrondies ferment à 100 : la dernière prend le reste (jamais 99 % ou 101 % affichés).
  let cumul = 0;
  const lignes = parts.map((p, k) => { const v = k === parts.length - 1 ? Math.max(0, 100 - cumul) : pct(p.valeur); cumul += v; return { ...p, pct: v }; });
  return (
    <div className={cx('n-repartition', className)} {...(attrs || {})}>
      <svg className="n-repartition-barre" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={libelle || undefined} focusable="false">
        {(() => { let x = 0; const vus = lignes.filter((q) => q.pct > 0); return vus.map((q, k) => { const w = q.pct; const r = <rect key={q.cle} className="n-repartition-part" data-n-ton={String(q.ton || 1)} x={x} y="0" width={Math.max(0, w - (k < vus.length - 1 ? 0.6 : 0))} height="10"/>; x += w; return r; }); })()}
      </svg>
      <ul className="n-repartition-legende">
        {lignes.map((p) => (
          <li key={p.cle} className="n-repartition-ligne">
            <span className="n-repartition-pastille" data-n-ton={String(p.ton || 1)} aria-hidden="true"/>
            {p.icone ? <span className="n-repartition-icone" aria-hidden="true">{p.icone}</span> : null}
            <span className="n-repartition-nom">{p.nom}</span>
            <span className="n-repartition-valeur">{p.texte}</span>
            <span className="n-repartition-pct">{p.pct} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GrapheJours;
