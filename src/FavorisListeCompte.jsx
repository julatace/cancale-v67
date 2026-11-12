// ═══════════════════════════════════════════════════════════════════════════
// LES FAVORIS D'UN COMPTE, EN UNE LISTE (12 nov., ext. 5.372) — présentation.
// La règle (ordre, articles vendus ou retirés, « à vérifier », compte de
// l'onglet) est dans src/favorisParCompte.js ; ici on DESSINE : une ligne par
// favori (photo, titre, qui si Vinted le dit, quand), une case de 44 px pour le
// choisir, « Tout sélectionner » par compte. Les autres comptes : leur liste à
// lire seulement (on n'écrit qu'au nom du compte ouvert dans l'onglet vinted.fr).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireFavorisVinted, ageFavori } from './favorisVinted.js';
import { pseudoFavori, itemIdFavori, etatFavori } from './favorisEcran.js';
import { listeFavorisCompte } from './favorisParCompte.js';

function Photo({ src, PhotoVinted }) {
  const vide = <span className="vrm-fc-photo-vide" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg></span>;
  return <span className="vrm-fc-photo" style={{ '--t': '48px' }}>{src && PhotoVinted ? <PhotoVinted src={src} alt="" loading="lazy" repli={vide} /> : vide}</span>;
}
const ETAT_TEXTE = { en_cours: 'favoris.qui.enCours', envoye: 'favoris.qui.dejaEcrit', a_verifier: 'favoris.qui.aVerifier', vendu: 'favoris.qui.vendu' };

// Une liste : `rows` = listeFavorisCompte(…).lignes ; `infos(id)` = { titre, photo, pseudo, age }.
export function ListeFavoris({ uid, rows, infos, choisis, basculer, selectionnable, verrou, PhotoVinted }) {
  useLangue();
  const sel = choisis instanceof Set ? choisis : new Set(choisis || []);
  return <ul className="vrm-fpc-liste" data-fav-liste={uid}>
    {rows.map((r) => {
      const i = infos(r.id) || {};
      const coche = sel.has(r.id);
      const peut = selectionnable && r.cochable;
      const etat = r.envoi !== 'a_envoyer' ? tr(ETAT_TEXTE[r.envoi] || 'favoris.qui.rienAEcrire') : r.article !== 'en-ligne' ? tr('favoris.liste.aVerifier') : '';
      const attrs = { 'data-fav-ligne': '', 'data-fav-id': r.id, 'data-fav-date': r.date == null ? '' : String(r.date), 'data-fav-compte': String(uid), 'data-fav-etat': r.envoi, 'data-fav-article': r.article, 'data-fav-coche': coche ? '1' : '0' };
      const corps = <>
        <Photo src={i.photo} PhotoVinted={PhotoVinted} />
        <span className="vrm-fc-annonce-texte">
          <span className="vrm-fc-titre">{i.titre || tr('favoris.qui.sansTitre')}</span>
          <span className="vrm-fc-meta">{i.pseudo ? <span data-fav-qui="">{i.pseudo}</span> : null}<span data-fav-quand="">{r.date == null ? tr('favoris.liste.sansDateLigne') : i.age}</span></span>
          {etat ? <span className="vrm-fc-compte"><span className={r.article !== 'en-ligne' && r.envoi === 'a_envoyer' ? 'is-geste' : ''}>{etat}</span></span> : null}
        </span>
      </>;
      return <li key={r.id} className={'vrm-fpc-ligne' + (coche ? ' is-choisie' : '')} {...attrs}>
        {peut
          ? <label className="vrm-fpc-label">
              <span className="vrm-fpc-case"><input type="checkbox" checked={coche} disabled={verrou} onChange={() => basculer(r.id)} aria-label={tr('favoris.liste.cocher', { titre: i.titre || tr('favoris.qui.sansTitre') })} data-fav-case="" /></span>
              {corps}
            </label>
          : <div className="vrm-fpc-label is-fixe">{corps}</div>}
      </li>;
    })}
  </ul>;
}

// L'en-tête d'un compte : son nom, le nombre, « Tout sélectionner ».
export function TeteCompte({ uid, nom, onglet, n, nChoisis, nCochables, tout, rien, selectionnable, verrou, raison }) {
  useLangue();
  return <div className="vrm-fpc-tete" data-fav-compte-tete={uid} data-fav-onglet={onglet ? '1' : '0'}>
    <div className="vrm-fpc-tete-texte">
      <strong>{nom || tr('favoris.liste.compte')}</strong>
      <small>{onglet ? tr('favoris.liste.compteOnglet') : raison}{n != null ? ' · ' + tr('favoris.liste.nombre', { n }) : ''}</small>
    </div>
    {selectionnable && nCochables > 0 ? (nChoisis > 0
      ? <button type="button" className="vrm-fc-lien vrm-fpc-tout" disabled={verrou} onClick={rien} data-fav-rien="">{tr('favoris.liste.rien')}</button>
      : <button type="button" className="vrm-fc-lien vrm-fpc-tout" disabled={verrou} onClick={tout} data-fav-tout="">{tr('favoris.liste.tout')}</button>) : null}
  </div>;
}

// Un AUTRE compte : lu à l'ouverture, à lire seulement.
export function FavorisAutreCompte({ compte, owner, ownerActuel, base, headers, articleDe, articleInfos, PhotoVinted, maintenant }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState(false);
  const [etat, setEtat] = React.useState({});
  React.useEffect(() => {
    if (!ouvert || etat.data || etat.charge) return;
    let vivant = true;
    setEtat({ charge: true });
    lireFavorisVinted({ uid: compte.uid, owner, ownerActuel, base, headers: headers() })
      .then((d) => { if (vivant) setEtat({ data: d }); })
      .catch((e) => { if (vivant) setEtat({ erreur: (e && e.message) || tr('favoris.liste.lectureRatee') }); });
    return () => { vivant = false; };
  }, [ouvert]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lignes = (etat.data && etat.data.lignes) || [];
  const liste = etat.data ? listeFavorisCompte(lignes, { itemIdDe: itemIdFavori, etatDe: (l) => etatFavori({}).code, articleDe: (id) => articleDe(compte.uid, id) }) : null;
  const parId = new Map(lignes.map((l) => [String(l.id), l]));
  const infos = (id) => { const l = parId.get(id); if (!l) return null; const a = articleInfos(itemIdFavori(l)) || {}; return { titre: a.titre || '', photo: a.photo || l.photo || null, pseudo: pseudoFavori(l), age: ageFavori(l.date, maintenant) }; };
  return <details className="vrm-fpc-compte is-autre" data-fav-autre={compte.uid} onToggle={(e) => setOuvert(e.currentTarget.open)}>
    <summary className="vrm-fpc-resume"><TeteCompte uid={compte.uid} nom={compte.nom} onglet={false} n={liste ? liste.lignes.length : null} raison={tr('favoris.liste.autreCompte')} /></summary>
    {etat.charge && <p className="vrm-fc-aide" role="status">{tr('favoris.vide.lecture')}</p>}
    {etat.erreur && <p className="vrm-fc-alerte" role="alert">{etat.erreur}</p>}
    {liste && (liste.lignes.length
      ? <ListeFavoris uid={compte.uid} rows={liste.lignes} infos={infos} choisis={[]} basculer={() => {}} selectionnable={false} PhotoVinted={PhotoVinted} />
      : <p className="vrm-fc-note">{tr('favoris.liste.vide')}</p>)}
    {liste && liste.retires > 0 && <p className="vrm-fc-aide" data-fav-retires={liste.retires}>{tr('favoris.liste.retires', { n: liste.retires })}</p>}
  </details>;
}
