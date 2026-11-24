// ── src/natif/CourbeAnnonce.jsx — LA COURBE D'UNE ANNONCE (21 nov., ext. 5.428, choix 58) ──────────────────────────
// Deux petites courbes l'une sous l'autre (UN axe chacune : vues, puis favoris — jamais deux échelles sur un graphique),
// jour après jour sur 30 jours, la même abscisse ; un jour NON LU n'a ni point ni trait (la ligne se coupe : jamais une
// interpolation présentée comme une mesure) et se dit « — pas lu » au survol ; les repères (prix baissé par VRM, prix
// changé mesuré, republiée, masquée, offre aux favoris) en petits traits sous les courbes, nommés dans la liste dessous
// (la vue texte de la figure). Données : src/courbeAnnonce.js (`serieCourbe`), lues par projection d'UNE annonce.
// Une couleur : l'encre du texte (une série par graphique : ni légende ni couleur d'accent). Styles : courbe-annonce.css.
import React from 'react';
import { tr, date as dateLoc, nombre } from '../i18n/index.js';
import { serieCourbe, selectCourbe, dateDuJour, LIGNE_COURBES } from '../courbeAnnonce.js';
import './courbe-annonce.css';

const L = 300, H = 56, HAUT = 6, BAS = 6;

// La lecture : `undefined` en cours · `null` pas su · [{ p, e }] les sources (un navigateur chacune).
export function useSourcesCourbe(id, lire) {
  const [v, setV] = React.useState(undefined);
  React.useEffect(() => {
    const sel = selectCourbe(id);
    if (!sel || !lire) { setV(null); return undefined; }
    let mort = false;
    setV(undefined);
    Promise.resolve(lire(`id=like.${LIGNE_COURBES}*&select=${sel}`)).then((rows) => {
      if (mort) return;
      setV(Array.isArray(rows) ? rows.map((r) => ({ p: Array.isArray(r && r.p) ? r.p : [], e: Array.isArray(r && r.e) ? r.e : [] })) : null);
    }, () => { if (!mort) setV(null); });
    return () => { mort = true; };
  }, [id, lire]);
  return v;
}

function Trace({ jours, cle, libelle, attrs }) {
  const vals = jours.map((d) => (d.lu ? d[cle] : null));
  const lus = vals.filter((x) => x != null);
  const n = jours.length;
  const x = (i) => (n <= 1 ? L / 2 : (i * L) / (n - 1));
  const max = lus.length ? Math.max(...lus) : 0, min = lus.length ? Math.min(...lus) : 0;
  const etendue = max - min || 1;
  const y = (v) => HAUT + (H - HAUT - BAS) * (1 - (v - min) / etendue);
  // Segments : seulement entre deux jours LUS consécutifs.
  const segs = [];
  let cur = [];
  vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]); });
  if (cur.length) segs.push(cur);
  // L'écart MESURÉ entre le premier et le dernier jour lus (le total est déjà sur la fiche : le même nombre jamais deux fois).
  const iP = vals.findIndex((v) => v != null), iD = vals.length - 1 - [...vals].reverse().findIndex((v) => v != null);
  const ecart = lus.length > 1 ? vals[iD] - vals[iP] : null;
  return (
    <figure className="n-ca-trace" data-ca-trace={cle} data-ca-segments={segs.length} data-ca-points={lus.length} data-ca-ecart={ecart == null ? '' : ecart} {...(attrs || {})}>
      <figcaption className="n-ca-lib"><span>{libelle}</span><b>{ecart == null ? '—' : tr('courbe.delta', { d: (ecart > 0 ? '+' : ecart < 0 ? '−' : '') + nombre(Math.abs(ecart)), date: dateLoc(dateDuJour(jours[iP].j), { day: 'numeric', month: 'short' }) })}</b></figcaption>
      <svg className="n-ca-svg" viewBox={`-4 0 ${L + 8} ${H}`} preserveAspectRatio="none" role="img" aria-label={libelle}>
        <line className="n-ca-base" x1="0" x2={L} y1={H - BAS + 2} y2={H - BAS + 2}/>
        {segs.map((s) => (s.length > 1 ? <polyline key={s.map((p) => p.join(',')).join(' ')} className="n-ca-ligne" points={s.map((p) => p.join(',')).join(' ')}/> : null))}
        {/* un jour lu ISOLÉ (sans voisin lu) : un point rond (trait de longueur nulle, extrémités rondes — jamais déformé par l'étirement) */}
        {segs.filter((s) => s.length === 1).map((s, i) => <line key={'p' + i} className="n-ca-ligne n-ca-point" x1={s[0][0]} x2={s[0][0]} y1={s[0][1]} y2={s[0][1]}/>)}
        {jours.map((d, i) => (
          <rect key={'h' + i} className="n-ca-cible" x={x(i) - L / Math.max(2, n - 1) / 2} y="0" width={L / Math.max(2, n - 1)} height={H} data-ca-jour={d.j} data-ca-lu={d.lu ? '1' : '0'}>
            <title>{d.lu ? tr('courbe.jour', { date: dateLoc(dateDuJour(d.j), { day: 'numeric', month: 'short' }), vues: d.vues == null ? '—' : nombre(d.vues), fav: d.fav == null ? '—' : nombre(d.fav) })
              : tr('courbe.jourPasLu', { date: dateLoc(dateDuJour(d.j), { day: 'numeric', month: 'short' }) })}</title>
          </rect>
        ))}
      </svg>
    </figure>
  );
}

// `sources` : ce que `useSourcesCourbe` a lu ; `maintenant` pour les bancs.
export function VueCourbe({ sources, maintenant = Date.now(), jours = 30, attrs = null }) {
  if (sources === undefined) return <section className="n-ca" data-ca="lecture" {...(attrs || {})}><h3 className="n-ca-titre">{tr('courbe.titre')}</h3><div className="n-ca-carte"><p className="n-ca-note">{tr('courbe.lecture')}</p></div></section>;
  if (sources === null) return <section className="n-ca" data-ca="pas-su" {...(attrs || {})}><h3 className="n-ca-titre">{tr('courbe.titre')}</h3><div className="n-ca-carte"><p className="n-ca-note">{tr('courbe.passu')}</p></div></section>;
  const s = serieCourbe(sources, { maintenant, jours });
  // (23 nov., revue UX #12) Moins de deux jours lus : pas de courbe ni de bloc vide (les vues et favoris du jour sont dans « Sur les
  // sites ») — le bloc apparaît dès le 2e jour lu. Une lecture RATÉE reste dite (« pas su », plus haut).
  if (!s.lus || s.lus < 2) return <span hidden data-ca="vide" data-ca-lus={String(s.lus || 0)} {...(attrs || {})}/>;
  const n = s.jours.length;
  const xPct = (j) => (n <= 1 ? 50 : ((j - s.debut) / (n - 1)) * 100);
  return (
    <section className="n-ca" data-ca="lu" data-ca-lus={s.lus} data-ca-jours={n} data-ca-reperes={s.reperes.map((r) => r.code).join(',')} {...(attrs || {})}>
      <h3 className="n-ca-titre">{tr('courbe.titre')}</h3>
      <div className="n-ca-carte">
      <Trace jours={s.jours} cle="vues" libelle={tr('courbe.vues')}/>
      <Trace jours={s.jours} cle="fav" libelle={tr('courbe.favoris')}/>
      {s.reperes.length ? <svg className="n-ca-reperes" viewBox={`-4 0 ${L + 8} 12`} preserveAspectRatio="none" aria-hidden="true">
        {s.reperes.map((r) => <g key={r.j + ':' + r.code} data-ca-repere={r.code}><title>{tr('courbe.r.' + r.code)}</title>
          <line className="n-ca-repere" x1={(xPct(r.j) * L) / 100} x2={(xPct(r.j) * L) / 100} y1="1" y2="11"/></g>)}
      </svg> : null}
      <div className="n-ca-axe"><span>{dateLoc(dateDuJour(s.debut), { day: 'numeric', month: 'short' })}</span><span>{dateLoc(dateDuJour(s.fin), { day: 'numeric', month: 'short' })}</span></div>
      {s.reperes.length ? <ul className="n-ca-liste" aria-label={tr('courbe.reperes')}>
        {s.reperes.slice(-6).reverse().map((r) => <li key={r.j + ':' + r.code} data-ca-repere-l={r.code}><span>{dateLoc(dateDuJour(r.j), { day: 'numeric', month: 'short' })}</span>{tr('courbe.r.' + r.code)}</li>)}
      </ul> : null}
      <p className="n-ca-note">{tr('courbe.pied', { lus: s.lus, n })}</p>
      </div>
    </section>
  );
}

export default function CourbeAnnonce({ id, lire, attrs = null }) {
  const sources = useSourcesCourbe(id, lire);
  return <VueCourbe sources={sources} attrs={{ 'data-ca-annonce': id, ...(attrs || {}) }}/>;
}
