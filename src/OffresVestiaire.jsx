// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES · VESTIAIRE — LES OFFRES REÇUES (4 nov., extension 5.319)
// ═══════════════════════════════════════════════════════════════════════════
// Les offres à trancher (la règle : src/offresVestiaire.js), une carte par
// article. Un geste (Accepter · Refuser · Contre-offre) n'existe que s'il est
// APPRIS (recette vue sur SA réponse faite à la main) et que l'extension le
// sait ; sinon « Répondre sur Vestiaire ↗ ». Accepter et Refuser demandent une
// confirmation (accepter vend l'article). Rien ne part sans son clic.
import React from 'react';
import { GESTES_OFFRE, etatGeste, prixContre, euros, resteAvant, etiquetteOffre } from './offresVestiaire.js';

const NOM = { accepter: 'Accepter', refuser: 'Refuser', contre: 'Contre-offre' };
const CONFIRME = { accepter: 'Confirmer : vendre', refuser: 'Confirmer le refus' };

function CarteOffre({ o, recettes, cap, numDe, envoyer, Photo }) {
  const [enCours, setEnCours] = React.useState('');
  const [confirme, setConfirme] = React.useState('');
  const [contre, setContre] = React.useState(null);      // null fermé · texte
  const [res, setRes] = React.useState(null);
  const num = numDe ? numDe(o.produit) : '';
  const etats = Object.fromEntries(GESTES_OFFRE.map((g) => [g, etatGeste(recettes, g, cap)]));
  const prets = GESTES_OFFRE.filter((g) => etats[g].etat === 'pret');
  const pc = contre != null ? prixContre(contre, o) : null;
  const faire = async (geste, cents) => {
    if (enCours) return;
    setEnCours(geste); setRes(null);
    let r = null; try { r = await envoyer({ cmd: 'vcOffre', nego: o.id, geste, ...(geste === 'contre' ? { prixCents: cents } : {}) }); } catch (_) { r = null; }
    setEnCours(''); setConfirme(''); setRes(etiquetteOffre(r, geste));
    if (r && r.accepte === true && r.etape === 'fait') setContre(null);
  };
  const lien = o.lien || 'https://fr.vestiairecollective.com/';
  return (
    <li className="vrm-of-carte" data-vc-offre={o.id} data-vc-offre-produit={o.produit} data-vc-offre-prets={prets.join(',')}>
      <div className="vrm-of-tete">
        {o.photo && Photo ? <Photo src={o.photo} className="vrm-of-photo" alt=""/> : <span className="vrm-of-photo" aria-hidden="true"/>}
        <span className="vrm-of-centre">
          <span className="vrm-of-nom">{num ? <b className="vrm-of-num">N°{num}</b> : null}{o.titre || 'Article Vestiaire'}</span>
          <span className="vrm-of-sous">
            <span className="vrm-of-bloc">prix {euros(o.initial)}</span>
            {o.net != null ? <> · <span className="vrm-of-bloc">tu touches {euros(o.net)}</span></> : null}
            {o.expire != null ? <> · <span className="vrm-of-bloc" data-vc-offre-reste="">reste {resteAvant(o.expire)}</span></> : null}
          </span>
        </span>
        <span className="vrm-of-prix" data-vc-offre-cents={o.offre == null ? '' : String(o.offre)}>{euros(o.offre)}</span>
      </div>
      {prets.length > 0 && (
        <div className="vrm-of-gestes" role="group" aria-label="Répondre à l’offre">
          {prets.filter((g) => g !== 'contre').map((g) => (
            <button key={g} type="button" className={'vrm-of-btn' + (confirme === g ? ' is-confirme' : '')} data-vc-offre-geste={g} data-vc-offre-confirme={confirme === g ? '1' : undefined}
              disabled={!!enCours} onClick={() => (confirme === g ? faire(g) : setConfirme(g))}>{enCours === g ? '…' : (confirme === g ? CONFIRME[g] : NOM[g])}</button>
          ))}
          {prets.includes('contre') && contre == null && <button type="button" className="vrm-of-btn" data-vc-offre-geste="contre" disabled={!!enCours} onClick={() => { setConfirme(''); setContre(''); }}>{NOM.contre}</button>}
        </div>
      )}
      {contre != null && (
        <div className="vrm-of-contre" data-vc-offre-contre="">
          <input className="vrm-of-champ" inputMode="decimal" aria-label="Ta contre-offre en euros" placeholder="€" value={contre} onChange={(e) => setContre(e.target.value.slice(0, 12))}/>
          <button type="button" className="vrm-of-btn is-plein" data-vc-offre-envoyer="" disabled={!!enCours || !pc || pc.cents == null} onClick={() => pc && pc.cents != null && faire('contre', pc.cents)}>{enCours === 'contre' ? '…' : 'Envoyer'}</button>
          <button type="button" className="vrm-of-btn" aria-label="Annuler la contre-offre" onClick={() => setContre(null)}>✕</button>
          {pc && pc.erreur ? <span className="vrm-of-erreur" role="status">{pc.erreur}</span> : null}
        </div>
      )}
      {prets.length < GESTES_OFFRE.length && (
        <a className="vrm-of-lien" data-vc-offre-ailleurs={GESTES_OFFRE.filter((g) => !prets.includes(g)).map((g) => g + ':' + etats[g].etat).join(',')} href={lien} target="_blank" rel="noreferrer">Répondre sur Vestiaire ↗</a>
      )}
      {res ? <div className="vrm-of-resultat" role="status" data-vc-offre-resultat={res.ton}>{res.texte}</div> : null}
    </li>
  );
}

export default function OffresVestiaire({ etat, recettes, cap, numDe, envoyer, Photo }) {
  if (!etat || etat.etat !== 'lu') return null;
  const A = etat.aTrancher, W = etat.enAttente;
  if (!A.length && !W.length) return null;
  return (
    <section className="vrm-of" data-vc-offres={A.length} data-vc-offres-attente={W.length}>
      {A.length > 0 && <>
        <h3 className="vrm-of-titre">Offres<span className="vrm-of-n">{A.length}</span></h3>
        <ul className="vrm-of-liste">{A.map((o) => <CarteOffre key={o.id} o={o} recettes={recettes} cap={cap} numDe={numDe} envoyer={envoyer} Photo={Photo}/>)}</ul>
      </>}
      {W.length > 0 && (
        <ul className="vrm-of-attente" data-vc-offres-envoyees={W.length}>
          {W.slice(0, 6).map((o) => (
            <li key={o.id} className="vrm-of-ligne" data-vc-offre-envoyee={o.id}>
              <span className="vrm-of-ligne-nom">{(numDe && numDe(o.produit)) ? `N°${numDe(o.produit)} · ` : ''}{o.titre || 'Article Vestiaire'}</span>
              <span className="vrm-of-ligne-etat">ton offre {euros(o.dernierCents)}{o.expire != null ? ` · ${resteAvant(o.expire)}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
