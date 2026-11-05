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

const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));
const jour = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function CarteOffres({ S, etat, fmt, nomDe }) {
  const T = S ? S.total : null;
  const eur = (v) => (v == null ? '—' : fmt(v));
  const n = (v) => (v == null ? '—' : String(v));
  const tuile = (k, lib, val, attrs, titre) => (
    <div className="vrm-of-tuile" data-of-tuile={k} title={titre || undefined} {...attrs}>
      <span className="vrm-of-lib">{lib}</span>
      <b className="vrm-display" data-vide={val === '—' ? '1' : undefined}>{val}</b>
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
      <section className="vrm-sv-carte vrm-of vrm-sv-repliee" data-stats-carte="sv-offres" data-sv-repliee="" data-of-etat={S ? 'lu' : (etat || 'encours')} data-of-couv={couv}>
        <h2 className="vrm-sv-repliee-titre">Les offres</h2>
        <span className="vrm-sv-repliee-raison" data-of-vide={S ? (pasLues ? 'pas-lues' : 'aucune') : (etat || 'encours')}>{raison}</span>
      </section>
    );
  }
  let corps;
  if (!S) corps = <div className="vrm-sv-vide" data-of-etat={etat || 'encours'}>{etat === 'passu' ? '—' : '…'}</div>;
  else {
    // Un compte sans offre ni vente sur la période ne prend pas de ligne.
    const comptes = S.comptes.filter((c) => (c.recues || 0) > 0 || (c.ventes || 0) > 0);
    corps = (
      <>
        <div className="vrm-of-tuiles">
          {tuile('cout', 'Coût des offres', eur(T.cout), { 'data-v': cents(T.cout), 'data-partiel': T.partielVentes ? '1' : undefined },
            T.partielVentes ? `Au moins : ${T.ventes - T.lues} vente${T.ventes - T.lues > 1 ? 's' : ''} sans offre lisible (${T.lots ? `${T.lots} lot${T.lots > 1 ? 's' : ''}` : ''}${T.lots && T.illisibles ? ', ' : ''}${T.illisibles ? `${T.illisibles} pas lue${T.illisibles > 1 ? 's' : ''}` : ''})` : 'Prix affiché − prix conclu, ventes conclues par offre')}
          {tuile('remise', 'Remise moyenne', eur(T.remiseMoy), { 'data-v': cents(T.remiseMoy) })}
          {tuile('paroffre', 'Ventes par offre', T.parOffre == null ? '—' : `${T.parOffre}/${T.lues}`, { 'data-v': T.parOffre == null ? '' : `${T.parOffre}/${T.lues}` })}
        </div>
        {comptes.length ? (
          <div className="vrm-of-table" role="table" aria-label="Offres par compte">
            <div className="vrm-of-ligne vrm-of-entete" role="row">
              <span role="columnheader" className="vrm-of-nom">Compte</span>
              <span role="columnheader">Reçues</span><span role="columnheader">Acceptées</span><span role="columnheader">Refusées</span><span role="columnheader">Contre</span><span role="columnheader">Coût</span>
            </div>
            {comptes.map((c) => (
              <div key={c.compte} className="vrm-of-ligne" role="row" data-of-compte={c.compte} data-recues={n(c.recues)} data-acceptees={n(c.acceptees)} data-refusees={n(c.refusees)} data-contre={n(c.contre)}
                data-cout={cents(c.cout)} data-partiel-offres={c.partielOffres ? '1' : undefined} data-lu-jusqua={c.luJusqua || ''}
                title={c.partielOffres ? `Au moins : conversations lues jusqu’au ${c.luJusqua ? jour(c.luJusqua) : '—'}` : undefined}>
                <span role="cell" className="vrm-of-nom"><b>{nomDe(c.compte)}</b>{c.partielOffres || (c.recues == null && S.offresLues) ? <small>{c.luJusqua ? `lu jusqu’au ${jour(c.luJusqua)}` : 'conversations pas lues'}</small> : null}</span>
                <span role="cell" data-lib="Reçues">{n(c.recues)}</span>
                <span role="cell" data-lib="Acceptées">{n(c.acceptees)}</span>
                <span role="cell" data-lib="Refusées">{n(c.refusees)}</span>
                <span role="cell" data-lib="Contre">{n(c.contre)}</span>
                <span role="cell" data-lib="Coût">{eur(c.cout)}</span>
              </div>
            ))}
          </div>
        ) : <div className="vrm-sv-vide" data-of-etat="lu">Aucune offre ni vente sur la période.</div>}
        <div className="vrm-sv-note vrm-of-moteur" data-of-moteur="">Acceptées par le moteur : —</div>
      </>
    );
  }
  return (
    <section className="vrm-sv-carte vrm-of" data-stats-carte="sv-offres" data-of-etat={S ? 'lu' : (etat || 'encours')} data-of-couv={couv}>
      <div className="vrm-sv-carte-tete">
        <h2 className="vrm-display vrm-sv-carte-titre">Les offres</h2>
        <span className="vrm-sv-note">Vinted{couv ? ` · ventes lues ${couv}` : ''}</span>
      </div>
      {corps}
    </section>
  );
}
