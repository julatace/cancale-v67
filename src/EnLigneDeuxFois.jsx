// ── « EN LIGNE DEUX FOIS » : la feuille ouverte depuis Ma journée (6 nov., vague 3) ──
// Chaque paire (un groupe de `enLigneDeuxFois`, src/enLigneDeuxFois.js) avec ses
// annonces : photo, N°, titre, compte, et le lien vers l'annonce sur vinted.fr.
// LE GESTE EST LE SIEN : il ouvre l'annonce en trop et la supprime sur Vinted.
// VRM ne supprime rien tout seul (§3 : supprimer une annonce Vinted
// automatiquement est refusé, irréversible). Une fois supprimée, la prochaine
// lecture du dressing la sort d'ici (la règle « en ligne »).
import React from 'react';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { Numero } from './composants/Numero.jsx';
import './en-ligne-deux-fois.css';

const PREUVE = { photo: 'même photo exacte', recree: 'recréée par VRM, l’ancienne pas supprimée' };
const lienVinted = (a) => (/^https:\/\/www\.vinted\.[a-z.]+\//.test(String(a.url || '')) ? a.url : `https://www.vinted.fr/items/${encodeURIComponent(a.id)}`);

export function EnLigneDeuxFoisDetail({ groupes, manque = [], PhotoVinted = null }) {
  const pasSu = (manque || []).filter((m) => m.plateforme === 'vinted');
  return (
    <div className="vrm-deux-fois" data-deux-fois-detail="">
      <p>La même paire est en vente deux fois : elle pourrait partir chez deux acheteurs. Garde une annonce et supprime l’autre sur Vinted. VRM ne supprime rien tout seul.</p>
      {groupes.map((g) => (
        <section key={g.annonces.map((a) => a.id).join('+')} className="vrm-deux-fois-groupe" data-deux-fois-groupe={g.annonces.map((a) => a.id).join('+')} data-preuves={g.preuves.join(' ')}>
          <h3>{g.numeros.length ? <>{g.numeros.map((n) => <Numero key={n} n={n} taille="petit"/>)}</> : 'Sans N°'}<small>{g.preuves.map((p) => PREUVE[p] || p).join(' · ')}</small></h3>
          {g.annonces.map((a) => (
            <article key={a.id} data-deux-fois-annonce={a.id}>
              <div className="vrm-deux-fois-photo">{a.photo && PhotoVinted ? <PhotoVinted src={a.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}</div>
              <div className="vrm-deux-fois-textes">
                <strong>{a.titre || 'Article'}</strong>
                <small>{a.nom || 'Compte sans nom'}{a.numero ? ` · N°${a.numero}` : ''} · annonce {a.id}</small>
              </div>
              <a className="vrm-deux-fois-lien" href={lienVinted(a)} target="_blank" rel="noopener noreferrer" data-deux-fois-ouvrir={a.id}>Ouvrir sur Vinted</a>
            </article>
          ))}
          <p className="vrm-deux-fois-geste">{g.memeCompte ? `Connecté à ${g.annonces[0].nom || 'ce compte'}, supprime celle en trop.` : 'Supprime celle en trop, connecté à son compte.'}</p>
        </section>
      ))}
      {pasSu.length ? <p className="vrm-deux-fois-manque" data-deux-fois-manque={pasSu.map((m) => m.uid).join(' ')}>Pas vérifié : {pasSu.map((m) => `${m.nom} (${m.raison})`).join(', ')}.</p> : null}
    </div>
  );
}
export default EnLigneDeuxFoisDetail;
