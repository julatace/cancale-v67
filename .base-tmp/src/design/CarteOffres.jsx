// ═══════════════════════════════════════════════════════════════════════════
// « LES OFFRES » — la carte de Statistiques (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Trois chiffres de la période (ce que les offres ont coûté, la remise
// moyenne, les ventes conclues par offre), puis une ligne par compte Vinted :
// reçues · acceptées · refusées · contre-offres · coût. Rien n'est calculé ici :
// tout vient de `statsOffres` (src/statsOffres.js). « — » = pas su ; « au
// moins » dans le titre et la date de la dernière lecture sous le nom quand la
// période dépasse ce que VRM a lu (§5). Chaque nombre porte son attribut
// (centimes, '' = « — ») pour le banc.
import React from 'react';
import { Carte } from '../natif/index.js';
import '../natif/ecrans/argent.css';

const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));
const jour = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function CarteOffres({ S, etat, fmt, nomDe }) {
  const T = S ? S.total : null;
  const eur = (v) => (v == null ? '—' : fmt(v));
  const n = (v) => (v == null ? '—' : String(v));
  const tuile = (k, lib, val, attrs, titre) => (
    <div className="n-arg-fait" data-of-tuile={k} title={titre || undefined} {...attrs}>
      <span className="n-arg-fait-lib">{lib}</span>
      <b className="n-arg-fait-val" data-vide={val === '—' ? '1' : undefined}>{val}</b>
    </div>
  );
  const couv = T && T.ventes != null ? `${T.lues}/${T.ventes}` : '';
  // (5 nov., chantier F, revue 2.25) Aucun chiffre ni aucune offre lue sur la période :
  // la carte se replie en une ligne (le titre, la raison), plus une grille de « — ».
  const avecOffre = S ? S.comptes.some((c) => (c.recues || 0) > 0) : false;
  const rienALire = !S || (!avecOffre && T && T.cout == null && T.remiseMoy == null && T.parOffre == null);
  if (rienALire) {
    const pasLues = S && S.comptes.some((c) => c.recues == null);
    const raison = !S ? (etat === 'passu' ? 'Tes conversations ne sont pas encore lues.' : 'Lecture en cours…')
      : pasLues ? 'Conversations pas encore lues : elles arrivent à ta prochaine visite sur Vinted.' : 'Aucune offre sur la période.';
    return (
      <Carte titre="Les offres" className="n-arg-offres" sousTitre={<span data-of-vide={S ? (pasLues ? 'pas-lues' : 'aucune') : (etat || 'encours')}>{raison}</span>}
        attrs={{ 'data-stats-carte': 'sv-offres', 'data-sv-repliee': '', 'data-of-etat': S ? 'lu' : (etat || 'encours'), 'data-of-couv': couv }}/>
    );
  }
  // (20 nov., lot argent-natif) AU STYLE NATIF §2 bis — Julien : un tableau « rempli de — » (Reçues, Acceptées, Refusées,
  // Contre vides pour chaque compte). Maintenant : une carte à filet ; trois chiffres en ligne ; le tableau ne montre QUE les
  // colonnes qui ont au moins une valeur lue ; un compte sans rien de lu = UNE ligne grise (« pas encore lu · ouvre Vinted
  // sur ce compte ») ; le coût en dernière colonne, aligné à droite. Rien de calculé ici (la même `statsOffres`).
  let corps;
  if (!S) corps = <div className="n-arg-vide" data-of-etat={etat || 'encours'}>{etat === 'passu' ? '—' : '…'}</div>;
  else {
    // Un compte sans offre ni vente sur la période ne prend pas de ligne.
    const comptes = S.comptes.filter((c) => (c.recues || 0) > 0 || (c.ventes || 0) > 0);
    const rienLu = (c) => c.recues == null && c.acceptees == null && c.refusees == null && c.contre == null && c.cout == null;
    const COLS = [['recues', 'Reçues'], ['acceptees', 'Acceptées'], ['refusees', 'Refusées'], ['contre', 'Contre'], ['cout', 'Coût']];
    const cols = COLS.filter(([k]) => comptes.some((c) => c[k] != null));
    const vides = COLS.filter(([k]) => !cols.some(([x]) => x === k)).map(([k]) => k);
    const cellule = (c, k) => (k === 'cout' ? eur(c.cout) : n(c[k]));
    corps = (
      <>
        <div className="n-arg-trois">
          {tuile('cout', 'Coût des offres', eur(T.cout), { 'data-v': cents(T.cout), 'data-partiel': T.partielVentes ? '1' : undefined },
            T.partielVentes ? `Au moins : ${T.ventes - T.lues} vente${T.ventes - T.lues > 1 ? 's' : ''} sans offre lisible (${T.lots ? `${T.lots} lot${T.lots > 1 ? 's' : ''}` : ''}${T.lots && T.illisibles ? ', ' : ''}${T.illisibles ? `${T.illisibles} pas lue${T.illisibles > 1 ? 's' : ''}` : ''})` : 'Prix affiché − prix conclu, ventes conclues par offre')}
          {tuile('remise', 'Remise moyenne', eur(T.remiseMoy), { 'data-v': cents(T.remiseMoy) })}
          {tuile('paroffre', 'Ventes par offre', T.parOffre == null ? '—' : `${T.parOffre}/${T.lues}`, { 'data-v': T.parOffre == null ? '' : `${T.parOffre}/${T.lues}` })}
        </div>
        {comptes.length ? (
          <div className="n-arg-table" role="table" aria-label="Offres par compte" data-arg-offres="" data-arg-colonnes-cachees={vides.join(',')} data-arg-ncol={String(cols.length)}>
            {cols.length ? (
              <div className="n-arg-tr n-arg-th" role="row">
                <span role="columnheader" className="n-arg-td-nom">Compte</span>
                {cols.map(([k, l]) => <span key={k} role="columnheader">{l}</span>)}
              </div>
            ) : null}
            {comptes.map((c) => {
              const attrs = { 'data-of-compte': c.compte, 'data-recues': n(c.recues), 'data-acceptees': n(c.acceptees), 'data-refusees': n(c.refusees), 'data-contre': n(c.contre),
                'data-cout': cents(c.cout), 'data-partiel-offres': c.partielOffres ? '1' : undefined, 'data-lu-jusqua': c.luJusqua || '' };
              if (rienLu(c)) return (
                <div key={c.compte} className="n-arg-tr n-arg-tr-muet" role="row" {...attrs} data-arg-rien-lu="">
                  <span role="cell" className="n-arg-td-nom"><b>{nomDe(c.compte)}</b></span>
                  <span role="cell" className="n-arg-td-muet">pas encore lu · ouvre Vinted sur ce compte</span>
                </div>
              );
              return (
                <div key={c.compte} className="n-arg-tr" role="row" {...attrs}
                  title={c.partielOffres ? `Au moins : conversations lues jusqu’au ${c.luJusqua ? jour(c.luJusqua) : '—'}` : undefined}>
                  <span role="cell" className="n-arg-td-nom"><b>{nomDe(c.compte)}</b>{c.partielOffres ? <small>{c.luJusqua ? `lu jusqu’au ${jour(c.luJusqua)}` : 'conversations pas lues'}</small> : null}</span>
                  {cols.map(([k, l]) => <span key={k} role="cell" data-lib={l}>{cellule(c, k)}</span>)}
                </div>
              );
            })}
          </div>
        ) : <div className="n-arg-vide" data-of-etat="lu">Aucune offre ni vente sur la période.</div>}
        <div className="n-arg-pied" data-of-moteur="">Acceptées par le moteur : —</div>
      </>
    );
  }
  return (
    <Carte titre="Les offres" sousTitre={`Vinted${couv ? ` · ventes lues ${couv}` : ''}`} className="n-arg-offres"
      attrs={{ 'data-stats-carte': 'sv-offres', 'data-of-etat': S ? 'lu' : (etat || 'encours'), 'data-of-couv': couv }}>
      {corps}
    </Carte>
  );
}
