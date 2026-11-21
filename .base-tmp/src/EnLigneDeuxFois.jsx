// ── « EN LIGNE DEUX FOIS » : la feuille ouverte depuis Ma journée (6 nov., vague 3) ──
// Chaque paire (un groupe de `enLigneDeuxFois`, src/enLigneDeuxFois.js) avec ses
// annonces : photo, N°, titre, compte, et le lien vers l'annonce sur vinted.fr.
// LE GESTE EST LE SIEN : il ouvre l'annonce en trop et la supprime sur Vinted.
// VRM ne supprime rien tout seul (§3 : supprimer une annonce Vinted
// automatiquement est refusé, irréversible). Une fois supprimée, la prochaine
// lecture du dressing la sort d'ici (la règle « en ligne »).
import { tr } from './i18n/index.js';
import React from 'react';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { Numero } from './composants/Numero.jsx';
import { motsVendeur } from './profilVendeur.js';
import { texteCarte, texteEuros, texteDepuis } from './enLigneDeuxFois.js';
import './en-ligne-deux-fois.css';

const PREUVE = { photo: 'même photo exacte', recree: 'recréée par VRM, l’ancienne pas supprimée', get fusion() { return tr('atelier.fusion.preuve'); } };
const lienVinted = (a) => (/^https:\/\/www\.vinted\.[a-z.]+\//.test(String(a.url || '')) ? a.url : `https://www.vinted.fr/items/${encodeURIComponent(a.id)}`);

export function EnLigneDeuxFoisDetail({ groupes, manque = [], PhotoVinted = null, maintenant = Date.now() }) {
  const pasSu = (manque || []).filter((m) => m.plateforme === 'vinted');
  return (
    <div className="vrm-deux-fois" data-deux-fois-detail="">
      <p>{motsVendeur().Meme} est en vente deux fois : {motsVendeur().elle} pourrait partir chez deux acheteurs. Garde une annonce et supprime l’autre sur Vinted. VRM ne supprime rien tout seul.</p>
      {groupes.map((g) => (
        <section key={g.annonces.map((a) => a.id).join('+')} className="vrm-deux-fois-groupe" data-deux-fois-groupe={g.annonces.map((a) => a.id).join('+')} data-preuves={g.preuves.join(' ')}>
          <h3>{g.numeros.length ? <>{g.numeros.map((n) => <Numero key={n} n={n} taille="petit"/>)}</> : 'Sans N°'}<small>{g.preuves.map((p) => PREUVE[p] || p).join(' · ')}</small></h3>
          {g.annonces.map((a) => (
            <article key={a.id} data-deux-fois-annonce={a.id}>
              <div className="vrm-deux-fois-photo">{a.photo && PhotoVinted ? <PhotoVinted src={a.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}</div>
              <div className="vrm-deux-fois-textes">
                <strong>{a.titre || 'Article'}</strong>
                <small>{a.nom || 'Compte sans nom'}{a.numero ? ` · N°${a.numero}` : ''} · annonce {a.id}</small>
                <small data-deux-fois-prix={a.prix == null ? '' : String(a.prix)} data-deux-fois-depuis={a.depuis == null ? '' : String(a.depuis)}>{texteEuros(a.prix)} · {texteDepuis(a.depuis, maintenant)}</small>
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

// ── (9 nov., lot AF) L'ALERTE DE L'ÉCRAN ANNONCES ─────────────────────────────────
// La même paire publiée deux fois (mêmes groupes que la carte de Ma journée, §11) :
// dite AVANT la double vente, en AMBRE (un geste à faire — jamais le rouge, réservé à
// deux paires sous un même N°, §7). Chaque annonce : son compte, son prix, depuis quand,
// et « Ouvrir sur Vinted » : C'EST LUI qui retire celle en trop, sur vinted.fr (§3 —
// VRM ne supprime jamais une annonce tout seul). Au-delà de deux paires, « Tout voir »
// ouvre la feuille (`Feuille` = SheetShell d'App.jsx).
export function EnLigneDeuxFoisAlerte({ groupes, manque = [], PhotoVinted = null, Feuille = null, maintenant = Date.now() }) {
  const [ouverte, setOuverte] = React.useState(false);
  const g = Array.isArray(groupes) ? groupes : [];
  if (!g.length) return null;
  const t = texteCarte(g);
  const vus = g.slice(0, 2);
  const ids = g.map((x) => x.annonces.map((a) => a.id).join('+')).join(' ');
  return (
    <section className="vrm-deux-fois-alerte" role="status" aria-label={t.complet} data-annonces-deux-fois={ids} data-n={String(g.length)}>
      <p className="vrm-deux-fois-alerte-tete"><b>{t.titre}</b><span>Elle peut partir chez deux acheteurs. Ouvre l’annonce en trop sur Vinted et retire-la.</span></p>
      {vus.map((x) => (
        <ul key={x.annonces.map((a) => a.id).join('+')} className="vrm-deux-fois-alerte-groupe" data-deux-fois-groupe={x.annonces.map((a) => a.id).join('+')} data-preuves={x.preuves.join(' ')}>
          {x.annonces.map((a) => (
            <li key={a.id} data-deux-fois-annonce={a.id}>
              <span className="vrm-deux-fois-alerte-txt">
                <b>{a.nom || 'Compte sans nom'}{a.numero ? ` · N°${a.numero}` : ''}</b>
                <small data-deux-fois-prix={a.prix == null ? '' : String(a.prix)} data-deux-fois-depuis={a.depuis == null ? '' : String(a.depuis)}>{texteEuros(a.prix)} · {texteDepuis(a.depuis, maintenant)}</small>
              </span>
              <a className="vrm-deux-fois-lien" href={lienVinted(a)} target="_blank" rel="noopener noreferrer" data-deux-fois-ouvrir={a.id}>Ouvrir sur Vinted</a>
            </li>
          ))}
        </ul>
      ))}
      {g.length > vus.length && Feuille ? (
        <button type="button" className="vrm-lien-action vrm-deux-fois-tout" data-deux-fois-tout="" onClick={() => setOuverte(true)}>Tout voir ({g.length} {motsVendeur().noms}) ›</button>
      ) : null}
      {ouverte && Feuille ? (
        <Feuille titre="En ligne deux fois" sousTitre="Sur Vinted" onClose={() => setOuverte(false)} maxWidth={560} data-feuille-deux-fois="">
          <EnLigneDeuxFoisDetail groupes={g} manque={manque} PhotoVinted={PhotoVinted} maintenant={maintenant}/>
        </Feuille>
      ) : null}
    </section>
  );
}
export default EnLigneDeuxFoisDetail;
