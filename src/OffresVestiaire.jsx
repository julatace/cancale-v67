// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES · VESTIAIRE — LES OFFRES REÇUES (4 nov., extension 5.319)
// ═══════════════════════════════════════════════════════════════════════════
// Les offres à trancher (la règle : src/offresVestiaire.js), une carte par
// article. Un geste (Accepter · Refuser · Contre-offre) n'existe que s'il est
// APPRIS (recette vue sur SA réponse faite à la main) et que l'extension le
// sait ; sinon « Répondre sur Vestiaire ↗ ». Accepter et Refuser demandent une
// confirmation (accepter vend l'article). Rien ne part sans son clic.
// (5 nov., chantier G) Une offre reçue qui expire dans moins de 6 h (`expireBientot`,
// échéance LUE) : son temps restant en AMBRE, une seule fois dans Messages — la
// pastille « offre 180 € » de la liste reste neutre. Les offres VINTED n'expirent pas :
// rien de tel pour elles. Vignette vide = `PhotoVide`, N° = `Numero`, liens au style du pied.
import { BoutonExtension } from './BoutonExtension.jsx';
import { BoutonAgir, issueTexte } from './agir/Agir.jsx';   // (24 nov., lot agir-tout)
import { usePeutAgir, envoyerGeste } from './agir/porte.js';   // (20 nov.) « Répondre à l'offre dans l'extension »
import React from 'react';
import { GESTES_OFFRE, etatGeste, prixContre, euros, resteAvant, etiquetteOffre, expireBientot } from './offresVestiaire.js';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { tr } from './i18n/index.js';
import { Numero } from './composants/Numero.jsx';
import { AccAvant, AccApres, AccEchec } from './ui/Accompagne.jsx';   // (14 nov.) les quatre moments du geste

// (11 nov., lot vestiaire-plus) Les textes passent par tr() (src/i18n/langues/*.js, le français mot pour mot).
const NOM = { accepter: () => tr('vcOffres.accepter'), refuser: () => tr('vcOffres.refuser'), contre: () => tr('vcOffres.contre') };
const CONFIRME = { accepter: () => tr('vcOffres.confirmerVendre'), refuser: () => tr('vcOffres.confirmerRefus') };

function CarteOffre({ o, recettes, cap, numDe, envoyer, Photo, maintenant }) {
  const [enCours, setEnCours] = React.useState('');
  const [confirme, setConfirme] = React.useState('');
  const [contre, setContre] = React.useState(null);      // null fermé · texte
  const [res, setRes] = React.useState(null);
  const num = numDe ? numDe(o.produit) : '';
  const etats = Object.fromEntries(GESTES_OFFRE.map((g) => [g, etatGeste(recettes, g, cap)]));
  const prets = GESTES_OFFRE.filter((g) => etats[g].etat === 'pret');
  const pc = contre != null ? prixContre(contre, o) : null;
  const lien = o.lien || 'https://fr.vestiairecollective.com/';
  const bientot = expireBientot(o, maintenant);
  const [issue, setIssue] = React.useState(null);
  const agirOk = usePeutAgir('vestiaire', o.compte || '', 'offre', 'file').ok;
  const partir = async (geste, cents = null) => { setConfirme(''); setContre(null); setIssue(await envoyerGeste({ site: 'vestiaire', compte: o.compte || '', geste: 'offre', distGeste: 'offre', args: Object.assign({ nego: String(o.id), geste }, cents ? { prix: cents / 100 } : {}), num: num || '' })); };
  return (
    <li className="vrm-of-carte" data-vc-offre={o.id} data-vc-offre-produit={o.produit} data-vc-offre-prets={prets.join(',')} data-vc-offre-bientot={bientot ? '1' : undefined}>
      <div className="vrm-of-tete">
        {o.photo && Photo ? <Photo src={o.photo} className="vrm-of-photo" alt=""/> : <PhotoVide className="vrm-of-photo" taille={52}/>}
        <span className="vrm-of-centre">
          <span className="vrm-of-nom">{num ? <Numero n={num} taille="petit" className="vrm-of-num"/> : null}<span className="vrm-of-titre-article">{o.titre || tr('journee.vcOffre.article')}</span></span>
          <span className="vrm-of-sous">
            <span className="vrm-of-bloc">{tr('vcOffres.prix', { prix: euros(o.initial) })}</span>
            {o.net != null ? <> · <span className="vrm-of-bloc">{tr('vcOffres.tuTouches', { prix: euros(o.net) })}</span></> : null}
          </span>
          {/* Le temps restant LU, sur sa ligne : en ambre (et dit « expire dans ») sous 6 h. */}
          {o.expire != null ? <span className={'vrm-of-reste' + (bientot ? ' is-bientot' : '')} data-vc-offre-reste="">{bientot ? tr('vcOffres.expireDans', { reste: resteAvant(o.expire, maintenant) }) : tr('vcOffres.resteT', { reste: resteAvant(o.expire, maintenant) })}</span> : null}
        </span>
        <span className="vrm-of-prix" data-vc-offre-cents={o.offre == null ? '' : String(o.offre)}>{euros(o.offre)}</span>
      </div>
      {/* (20 nov., décision de Julien) Accepter, refuser, contre-offre : dans le panneau de l'extension, sur CETTE négociation. */}
      {/* (24 nov., lot agir-tout) DEPUIS VRM quand l'extension a CE compte Vestiaire dans un onglet (la file ; recette APPRISE
          de SON propre geste, sinon l'extension refuse et le dit) ; sinon le panneau, gardé. */}
      {agirOk ? (
        <div className="vrm-of-gestes" data-vc-offre-app={o.id}>
          {confirme ? <p className="vrm-of-confirme" data-vc-offre-confirme={confirme}>{CONFIRME[confirme] ? CONFIRME[confirme]() : ''}</p> : null}
          {confirme ? <BoutonAgir site="vestiaire" compte={o.compte || ''} geste="offre" par="file" variante="plein" onClick={() => partir(confirme)} attrs={{ 'data-vc-offre-oui': confirme }}>{NOM[confirme]()}</BoutonAgir>
            : <>
              <BoutonAgir site="vestiaire" compte={o.compte || ''} geste="offre" par="file" variante="plein" onClick={() => setConfirme('accepter')} attrs={{ 'data-vc-offre-geste': 'accepter' }}>{NOM.accepter()}</BoutonAgir>
              <BoutonAgir site="vestiaire" compte={o.compte || ''} geste="offre" par="file" variante="texte" onClick={() => setConfirme('refuser')} attrs={{ 'data-vc-offre-geste': 'refuser' }}>{NOM.refuser()}</BoutonAgir>
              {contre == null ? <BoutonAgir site="vestiaire" compte={o.compte || ''} geste="offre" par="file" variante="texte" onClick={() => setContre('')} attrs={{ 'data-vc-offre-geste': 'contre' }}>{NOM.contre()}</BoutonAgir>
                : <span className="vrm-of-contre"><input inputMode="decimal" value={contre} onChange={(e) => setContre(e.target.value)} aria-label={NOM.contre()} data-vc-offre-contre="" style={{ fontSize: 16 }}/>
                  <BoutonAgir site="vestiaire" compte={o.compte || ''} geste="offre" par="file" onClick={() => { if (pc && pc.cents) partir('contre', pc.cents); }} attrs={{ 'data-vc-offre-contre-envoyer': '' }}>{tr('agir.repondre.envoyer')}</BoutonAgir>
                  {pc && pc.erreur ? <small>{pc.erreur}</small> : null}</span>}
            </>}
          {issue ? <p className="vrm-agir-issue" role="status" data-agir-issue={issue.ok ? 'ok' : issue.raison || 'non'}>{issueTexte(issue)}</p> : null}
        </div>
      ) : <div className="vrm-of-gestes" data-vc-offre-panneau={o.id}><BoutonExtension className="vrm-of-btn" action="offres" site="vestiaire" compte={o.compte || '*'} ids={[String(o.id)]}/></div>}
      {res ? <div className="vrm-of-resultat" data-vc-offre-resultat={res.ton}>{res.ton === 'ok' ? <AccApres geste="offre.vestiaire" texte={res.texte} ensuite={null}/> : <AccEchec geste="offre.vestiaire" erreur={res.ton === 'muet' ? { sansReponse: true, raison: res.texte } : res.texte}/>}</div> : null}
    </li>
  );
}

export default function OffresVestiaire({ etat, recettes, cap, numDe, envoyer, Photo }) {
  // Le temps restant reste vrai écran ouvert : relu chaque minute (rien n'est relu sur le réseau).
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 60000); return () => clearInterval(t); }, []);
  if (!etat || etat.etat !== 'lu') return null;
  const A = etat.aTrancher, W = etat.enAttente;
  if (!A.length && !W.length) return null;
  return (
    <section className="vrm-of" data-vc-offres={A.length} data-vc-offres-attente={W.length}>
      {A.length > 0 && <>
        <h3 className="vrm-of-titre">{tr('vcOffres.offresRecues')}<span className="vrm-of-n">{A.length}</span></h3>
        <AccAvant geste="offre.vestiaire"/>
        <ul className="vrm-of-liste">{A.map((o) => <CarteOffre key={o.id} o={o} recettes={recettes} cap={cap} numDe={numDe} envoyer={envoyer} Photo={Photo} maintenant={maintenant}/>)}</ul>
      </>}
      {W.length > 0 && (<>
        <h3 className="vrm-of-titre vrm-of-titre-second">{tr('vcOffres.offresEnvoyees')}<span className="vrm-of-n">{W.length}</span></h3>
        <ul className="vrm-of-attente" data-vc-offres-envoyees={W.length}>
          {W.slice(0, 6).map((o) => (
            <li key={o.id} className="vrm-of-ligne" data-vc-offre-envoyee={o.id}>
              <span className="vrm-of-ligne-nom">{(numDe && numDe(o.produit)) ? `N°${numDe(o.produit)} · ` : ''}{o.titre || tr('journee.vcOffre.article')}</span>
              <span className="vrm-of-ligne-etat">{euros(o.dernierCents)}{o.expire != null ? ' · ' + tr('vcOffres.resteT', { reste: resteAvant(o.expire, maintenant) }) : ''}</span>
            </li>
          ))}
        </ul>
      </>)}
    </section>
  );
}
