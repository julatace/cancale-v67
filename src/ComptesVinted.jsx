// ════════════════════════════════════════════════════════════════════════════
//  « TES COMPTES VINTED » (13 nov., lot 36-27, point 27 de Julien)
//  Un tableau : un compte sélectionné = une ligne ; ventes, jours pour vendre
//  (médiane), prix moyen, offres acceptées ; sur 30 j, 90 j ou l'année (son choix,
//  gardé sur CET appareil). Aucune couleur (§7). Règle : src/comptesVinted.js.
//  Les offres : la lecture de Statistiques (`offresBrut`, lue quand la carte paraît),
//  comptée par `statsOffres` sur les bornes de CE tableau. Rien n'est écrit en base.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { statsOffres } from './statsOffres.js';
import { MIN_DONNEES } from './statsPlus.js';
import { tableauComptesVinted, bornesComptes, PERIODES_COMPTES, CLE_PERIODE_COMPTES } from './comptesVinted.js';
import './comptes-vinted.css';

const lirePeriode = () => { try { const v = localStorage.getItem(CLE_PERIODE_COMPTES); return PERIODES_COMPTES[v] ? v : 'j30'; } catch (_) { return 'j30'; } };
const LIB_PERIODE = { j30: 'stats.cv.j30', j90: 'stats.cv.j90', annee: 'stats.cv.annee' };

export default function ComptesVinted({ vendu, manque = [], nonComptees = [], releve, annonces = 'lu', offresBrut, comptes, ecarte = () => false, Segmente = null, fmt = (v) => String(v), refCarte = null }) {
  const [p, setPEtat] = React.useState(lirePeriode);
  const setP = (v) => { const x = PERIODES_COMPTES[v] ? v : 'j30'; setPEtat(x); try { localStorage.setItem(CLE_PERIODE_COMPTES, x); } catch (_) {} };
  const [maintenant] = React.useState(() => Date.now());
  const b = React.useMemo(() => bornesComptes(p, maintenant), [p, maintenant]);
  const offres = React.useMemo(() => {
    if (offresBrut === undefined) return undefined;
    if (!offresBrut || !Array.isArray(offresBrut.convs)) return null;
    const convs = offresBrut.convs.filter((c) => !ecarte(c.compte));
    const lectures = offresBrut.lectures ? Object.fromEntries(Object.entries(offresBrut.lectures).filter(([u]) => !ecarte(u))) : {};
    return statsOffres({ convs, lectures, ventes: null, txn: null, de: b.de, a: b.a, maintenant });
  }, [offresBrut, ecarte, b, maintenant]);
  const T = React.useMemo(() => tableauComptesVinted({ comptes, vendu, manque, nonComptees, releve, annonces, offres, de: b.de, a: b.a }),
    [comptes, vendu, manque, nonComptees, releve, annonces, offres, b]);

  const choix = Object.keys(PERIODES_COMPTES).map((v) => ({ v, l: tr(LIB_PERIODE[v]), data: { 'data-cv-choix': v } }));
  const bascule = Segmente
    ? <Segmente label={tr('stats.periode')} className="vrm-cv-periode" value={p} onChange={setP} options={choix}/>
    : <div className="vrm-cv-periode" role="group">{choix.map((o) => <button key={o.v} type="button" aria-pressed={p === o.v} data-cv-choix={o.v} onClick={() => setP(o.v)}>{o.l}</button>)}</div>;
  const jr = (j) => (j == null ? '—' : j < 1 ? '< 1 j' : `${String(Math.round(j * 10) / 10).replace('.', ',')} j`);
  const lignes = T.lignes || [];
  const notes = [];
  if (T.etat === 'lu') {
    const pasLus = lignes.filter((l) => l.pasLu).map((l) => l.nom);
    if (pasLus.length) notes.push(['paslu', tr('stats.cv.pasLu', { x: pasLus.join(', ') })]);
    const lus = lignes.filter((l) => !l.pasLu);
    if (lus.some((l) => l.prixRaison === 'peu')) notes.push(['prix', tr('stats.cv.prixDes', { n: MIN_DONNEES })]);
    if (lus.some((l) => l.delaiRaison === 'sansdate')) notes.push(['delai', tr('stats.cv.delaiSansDate')]);
    else if (lus.some((l) => l.delaiRaison === 'passu')) notes.push(['delai', tr('stats.cv.delaiPasLu')]);
    else if (lus.some((l) => l.delaiRaison === 'releve')) notes.push(['delai', tr('stats.cv.delaiReleve')]);
    const part = lus.filter((l) => l.offresRaison === 'partiel' && Number.isFinite(l.luJusqua)).map((l) => l.luJusqua);
    if (part.length) notes.push(['offres', tr('stats.cv.offresJusqua', { x: new Date(Math.min(...part)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) })]);
    else if (lus.some((l) => l.offresRaison === 'passu')) notes.push(['offres', tr('stats.cv.offresPasLu')]);
    if (lus.some((l) => l.offresRaison === 'peu')) notes.push(['offrespeu', tr('stats.cv.offresDes', { n: MIN_DONNEES })]);
    if (T.nNonComptees) notes.push(['nc', tr('stats.cv.nonComptees', { n: T.nNonComptees })]);
  }
  const cell = (lib, val, attrs) => <td data-lib={lib} {...(attrs || {})}>{val}</td>;
  const H = { ventes: tr('stats.cv.ventes'), delai: tr('stats.cv.delai'), prix: tr('stats.cv.prix'), offres: tr('stats.cv.offres') };
  const corps = T.etat === 'encours' ? <p className="vrm-sv-vide" data-cv-etat="encours">{tr('stats.cv.lecture')}</p>
    : T.etat === 'passu' ? <p className="vrm-sv-vide" data-cv-etat="passu">{tr('stats.cv.passu')}</p>
      : !lignes.length ? <p className="vrm-sv-vide" data-cv-etat="aucun">{tr('stats.cv.aucun')}</p>
        : (
          <table className="vrm-cv-table" data-cv-etat="lu">
            <thead><tr><th scope="col">{tr('stats.cv.compte')}</th><th scope="col">{H.ventes}</th><th scope="col">{H.delai}</th><th scope="col">{H.prix}</th><th scope="col">{H.offres}</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.uid} data-cv-compte={l.uid} data-cv-n={l.n == null ? '' : l.n} data-cv-eur={l.eur == null ? '' : String(Math.round(l.eur * 100))}
                  data-cv-prix={l.prix == null ? '' : String(Math.round(l.prix * 100))} data-cv-delai={l.delai == null ? '' : l.delai} data-cv-delai-raison={l.delaiRaison || undefined}
                  data-cv-offres={l.offres == null ? '' : l.offres} data-cv-offres-raison={l.offresRaison || undefined} data-cv-paslu={l.pasLu ? '1' : undefined}>
                  <th scope="row" title={l.nom}>{l.nom}</th>
                  {cell(H.ventes, l.n == null ? '—' : String(l.n))}
                  {cell(H.delai, jr(l.delai), l.delai != null ? { title: tr('stats.cv.delaiTitre', { n: l.nDelai }) } : undefined)}
                  {cell(H.prix, l.prix == null ? '—' : fmt(l.prix))}
                  {cell(H.offres, l.offres == null ? '—' : `${l.offres} %`, l.offres != null ? { title: tr('stats.cv.offresTitre', { n: l.recues }) } : undefined)}
                </tr>
              ))}
            </tbody>
          </table>
        );
  return (
    <section ref={refCarte} className="vrm-sv-carte vrm-cv-carte" data-stats-carte="sv-comptes-vinted" data-sv-carte="comptes-vinted" data-cv-periode={b.p} data-cv-de={b.de} data-cv-a={b.a}>
      <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">{tr('stats.cv.titre')}</h2>{bascule}</div>
      {corps}
      {notes.length ? <div className="vrm-cv-notes">{notes.map(([k, t]) => <p key={k} className="vrm-sv-note" data-cv-note={k}>{t}</p>)}</div> : null}
    </section>
  );
}
