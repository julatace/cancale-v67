// ════════════════════════════════════════════════════════════════════════════
//  UN MEUBLE DESSINÉ (19 nov. 2026, lot stock-etiquetage) — Julien : « Fais une meilleure représentation du meuble […]
//  Je veux voir le meuble d'un peu plus loin : qu'il occupe toute la largeur de l'écran » ; décision du 19 nov. : garder
//  des meubles DESSINÉS.
//  Le dessin : le bâti (sa couleur, src/etageres/reglages.js du lot v4 validé), ses tablettes, une boîte par case prise
//  (sa teinte, son étiquette au N° EN GRAND), un creux par case libre. Trois façons de le dessiner, celles de la v4 :
//  Cartons (des boîtes sur des planches), Rayonnage (étiquettes d'entrepôt, N° en grand), Plan (vu de dessus).
//  `mode` : 'loin' (vue d'ensemble : jamais de photo, le N° lisible de loin, rien ne se touche case par case) ·
//           'pres' (le meuble seul ou la séance « Ranger » : chaque case se touche, 44 px au moins, photo si son
//           étiquette le demande et que la densité n'est pas « de loin »).
//  C'est une VUE : aucune donnée lue, aucune règle. `info(i)` rend ce que l'écran sait de la case i (src/ecrans/Stock.jsx :
//  `caseInfo`) — null = libre ; { num, cle, etat: 'vendue' | 'plusenligne' | '', double, notee, photo }.
//  « À sortir » (ambre), « Plus en ligne » (ambre en pointillé) et « En double » (rouge, le seul) se disent toujours.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { reglagesDe, couleurMeuble, teinteCarton, etiquetteVue } from '../etageres/reglages.js';
import './meubles.css';

// Au-delà, la vue d'ensemble dessine les boîtes sans leur N° (le meuble seul les montre).
const CASES_MAX_LOIN = 400;

export default function MeubleDessin({ m, info, mode = 'loin', vise = null, ici = null, arrivee = '', onCase = null, refCase = null, attrs = null }) {
  if (!m) return null;
  const cols = Math.max(1, Number(m.cols) || 1), rows = Math.max(1, Number(m.rows) || 1);
  const reg = reglagesDe(m);
  const vue = etiquetteVue(reg);
  const couleur = couleurMeuble(m);
  const pres = mode === 'pres';
  const sansNum = !pres && cols * rows > CASES_MAX_LOIN;
  const nom = String(m.name || '');
  const cases = [];
  for (let r = 0; r < rows; r++) {
    const ligne = [];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const o = info ? info(i) : null;
      const k = String(m.id) + ':' + i;
      const estVise = vise === i, estIci = ici === i, estArrivee = !!(o && arrivee && o.cle === arrivee);
      const etat = o ? (o.double ? 'doublon' : o.etat || '') : '';
      const libelle = o ? tr('sm.case.prise', { num: String(o.num), r: r + 1, c: c + 1 }) + (etat === 'vendue' ? ' · ' + tr('sm.case.vendue') : etat === 'plusenligne' ? ' · ' + tr('sm.case.plusEnLigne') : etat === 'doublon' ? ' · ' + tr('sm.case.double') : '')
        : tr('sm.case.libre', { r: r + 1, c: c + 1 });
      const dedans = o ? (
        <span className="sm-boite" data-teinte={teinteCarton(reg, o.num)} data-etat={etat || undefined} data-notee={o.notee ? '' : undefined}>
          {pres && vue.photo && o.photo ? <img className="sm-photo" src={o.photo} alt="" loading="lazy" decoding="async" draggable="false"/> : null}
          {sansNum ? null : <span className="sm-etiq"><span className="sm-n" style={{ '--sm-len': Math.max(2, String(o.num).length) }}>{String(o.num)}</span></span>}
        </span>
      ) : <span className="sm-trou" aria-hidden="true"/>;
      const cls = 'sm-case' + (o ? ' is-prise' : ' is-libre') + (estVise ? ' is-vise' : '') + (estIci ? ' is-ici' : '') + (estArrivee ? ' is-arrive' : '');
      const data = { 'data-sm-case': k, 'data-sr-case': k, 'data-case-num': o && o.cle ? o.cle : undefined, 'data-sm-vise': estVise ? '' : undefined, 'data-sm-etat': etat || undefined };
      ligne.push(onCase
        ? <button key={k} type="button" className={cls} {...data} ref={refCase ? (el) => refCase(i, el) : undefined} aria-label={libelle} aria-current={estIci ? 'true' : undefined} disabled={estIci} onClick={() => onCase(i)}>{dedans}{estVise ? <span className="sm-ici-mot" aria-hidden="true">{tr('sm.ici')}</span> : null}</button>
        : <span key={k} className={cls} {...data} ref={refCase ? (el) => refCase(i, el) : undefined}>{dedans}{estVise ? <span className="sm-ici-mot" aria-hidden="true">{tr('sm.ici')}</span> : null}</span>);
    }
    cases.push(<div key={r} className="sm-etage" data-sm-rangee={r + 1}>{ligne}</div>);
  }
  return (
    <div className="sm-meuble" data-sm-meuble={String(m.id)} data-sm-affichage={reg.affichage} data-sm-couleur={couleur} data-sm-mode={mode}
      data-sm-cols={cols} data-sm-rows={rows} style={{ '--sm-cols': cols }} role={onCase ? 'group' : 'img'} aria-label={nom} {...(attrs || {})}>
      <div className="sm-bati">
        <div className="sm-corps">{cases}</div>
      </div>
      <span className="sm-pieds" aria-hidden="true"/>
    </div>
  );
}
