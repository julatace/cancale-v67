// ══════════════════════════════════════════════════════════════════════════
// vrm.center/tarifs — LA PAGE PUBLIQUE DES TARIFS (14 nov., choix de Julien n° 144)
// « Solo et Pro côte à côte, ce que comprend l'essai, ce qui se passe à la fin, sans
// surprise. » Elle dit la VÉRITÉ du moment, rien d'autre :
//   · les montants : `PRIX_MOIS` / `PRIX_PRO_MOIS` (src/accueil-reglages.js), comparés aux
//     CGV et au serveur (`PRIX_CGV`, `PRIX_PRO_CGV` d'api/compte.js) par
//     scripts/audit-accueil-nouveaux.cjs ; les phrases des offres : `OFFRES`
//     (api/_lib/plan-regle.js) — la même que Paramètres et l'accueil ;
//   · le supplément d'un compte Vinted de plus : `prixCompteSupTexte()` (plan-regle.js) ;
//   · l'essai : `ESSAI_JOURS` (= le serveur et les CGV) ;
//   · « Gratuit pour l'instant » tant que `ACCES_OFFERT` ; Pro « bientôt » tant que
//     `PRO_OUVERT` est faux ; « Le paiement n'est pas encore ouvert » tant que l'identité
//     de l'éditeur (public/legal/editeur.js, la même source que le serveur) est incomplète.
// Aucune fonction promise qui n'existe pas. Liens CGV, confidentialité, mentions légales.
// Un morceau à part (chargé seulement sur /tarifs) ; ses textes aussi (`ajouterTextes`).
// CSP : aucun script en ligne (editeur.js est un fichier servi par VRM, `script-src 'self'`).
// ══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie, langueCourante, ajouterTextes } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import ChoixLangue from '../i18n/ChoixLangue.jsx';
import { ACCES_OFFERT, PRIX_MOIS, PRIX_PRO_MOIS, PRO_OUVERT, ESSAI_JOURS } from '../accueil-reglages.js';
import { OFFRES, prixCompteSupTexte } from '../../api/_lib/plan-regle.js';
import fr from '../i18n/langues/fr/tarifs.js';
import en from '../i18n/langues/en/tarifs.js';
import es from '../i18n/langues/es/tarifs.js';
import it from '../i18n/langues/it/tarifs.js';
import de from '../i18n/langues/de/tarifs.js';
import './tarifs.css';

ajouterTextes({ fr, en, es, it, de });

const LEGAL = [['legal.cgv', '/legal/cgv.html'], ['legal.confidentialite', '/legal/confidentialite.html'], ['legal.mentions', '/legal/mentions-legales.html'], ['legal.cgu', '/legal/cgu.html']];

// L'identité de l'éditeur, lue dans le MÊME fichier que le serveur (qui refuse d'ouvrir
// le paiement tant qu'un champ obligatoire manque). `undefined` lecture · true complète ·
// false incomplète · null pas su (fichier pas chargé) — « pas su » ne dit rien.
export function editeurComplet(E, obligatoires) {
  if (!E || typeof E !== 'object' || !Array.isArray(obligatoires)) return null;
  return obligatoires.every((k) => E[k] != null && String(E[k]).trim() !== '');
}
function useEditeur() {
  const [v, setV] = React.useState(undefined);
  React.useEffect(() => {
    const lire = () => setV(editeurComplet(window.VRM_EDITEUR, window.VRM_EDITEUR_OBLIGATOIRES));
    if (window.VRM_EDITEUR) { lire(); return undefined; }
    const s = document.createElement('script');
    s.src = '/legal/editeur.js'; s.async = true;
    s.onload = lire; s.onerror = () => setV(null);
    document.head.appendChild(s);
    return () => { s.onload = null; s.onerror = null; };
  }, []);
  return v;
}

export default function Tarifs() {
  const langue = useLangue();
  const editeur = useEditeur();
  React.useEffect(() => { try { document.title = tr('tarifs.titrePage'); } catch (_) {} }, [langue]);
  // Le montant : la valeur des CGV telle quelle en français, au format de la langue ailleurs.
  const prix = (p) => (langueCourante() === 'fr' ? `${p} €` : monnaie(Number(String(p).replace(',', '.'))));
  const phrase = (cle) => (langue === 'fr' ? OFFRES[cle].phrase : tr(`accueil.offre.${cle}.phrase`));
  const supplement = langue === 'fr' ? OFFRES.solo.supplement : tr('accueil.offre.solo.supplement').replace('{prix}', prixCompteSupTexte());
  const lignes = [
    ['vendeurs', tr('tarifs.cmp.vendeurs.solo'), tr('tarifs.cmp.vendeurs.pro')],
    ['achat', tr('tarifs.cmp.illimites'), tr('tarifs.cmp.illimites')],
    ['vintedPlus', tr('tarifs.cmp.vintedPlus.solo', { prix: prixCompteSupTexte() }), tr('tarifs.cmp.inclus')],
    ['tout', tr('tarifs.cmp.oui'), tr('tarifs.cmp.oui')],
    ['sites', tr('tarifs.cmp.sites.valeur'), tr('tarifs.cmp.sites.valeur')],
  ];
  const offre = (cle, montant, ouvert) => (
    <article className={`vt-offre vt-offre-${cle}`} data-offre={cle} data-prix-offre={montant} data-offre-ouverte={ouvert ? '1' : '0'}>
      <div className="vt-offre-tete">
        <h2>{OFFRES[cle].nom}</h2>
        {!ouvert ? <span className="vt-bientot" data-offre-bientot="">{tr('tarifs.bientot')}</span> : null}
      </div>
      <p className="vt-montant"><b data-montant={cle}>{prix(montant)}</b><span>{tr('accueil.prix.parMois')}</span></p>
      <p className="vt-phrase" data-offre-phrase={cle}>{phrase(cle)}</p>
      {cle === 'solo' ? <p className="vt-supplement" data-solo-supplement="">{supplement}</p> : <p className="vt-supplement">{tr('tarifs.pro.pourQui')}</p>}
      <ul className="vt-inclus">
        {(cle === 'solo' ? ['solo1', 'commun1', 'commun2', 'commun3'] : ['pro1', 'commun1', 'commun2', 'commun3']).map((k) => <li key={k}><Coche />{tr(`tarifs.inclus.${k}`)}</li>)}
      </ul>
    </article>
  );
  return (
    <div className="vt" data-tarifs="" data-acces-offert={ACCES_OFFERT ? '1' : '0'} data-editeur={editeur === undefined ? 'lecture' : editeur === null ? 'passu' : editeur ? 'complet' : 'incomplet'}>
      <div className="vt-lumiere" aria-hidden="true" />
      <header className="vt-nav">
        <a className="vt-marque" href="/"><img src="/vrm-logo-v5-96.png" srcSet="/vrm-logo-v5-96.png 1x, /vrm-logo-v5-192.png 2x" alt="" width="28" height="28" /><b>VRM</b></a>
        <nav className="vt-nav-droite" aria-label={tr('accueil.nav.sections')}>
          <a href="/?connexion" className="vt-lien">{tr('auth.titre.in')}</a>
          <a href="/?inscription" className="vt-btn vt-btn-petit" data-cta="inscription-nav">{tr('accueil.cta.essayer')}</a>
        </nav>
      </header>
      <main className="vt-in">
        <section className="vt-hero">
          <p className="vt-surtitre">{tr('tarifs.surtitre')}</p>
          <h1 className="vt-h1">{tr('tarifs.titre')}</h1>
          <p className="vt-chapo">{tr('tarifs.chapo')}</p>
          {ACCES_OFFERT || editeur === false ? (
            <div className="vt-etat" role="note" data-etat-paiement={ACCES_OFFERT ? 'offert' : 'ferme'}>
              {ACCES_OFFERT ? <span className="vt-pastille" data-acces-offert="">{tr('accueil.gratuit')}</span> : null}
              <span>{ACCES_OFFERT ? tr('tarifs.etat.offert') : ''}{editeur === false ? <span data-paiement-ferme="">{(ACCES_OFFERT ? ' ' : '') + tr('tarifs.etat.ferme')}</span> : null}</span>
            </div>
          ) : null}
        </section>

        <section className="vt-offres" aria-label={tr('tarifs.offres.titre')}>
          {offre('solo', PRIX_MOIS, true)}
          {offre('pro', PRIX_PRO_MOIS, PRO_OUVERT)}
        </section>

        <section className="vt-section" aria-labelledby="vt-cmp">
          <h2 id="vt-cmp" className="vt-h2">{tr('tarifs.cmp.titre')}</h2>
          <div className="vt-tableau" role="table" data-comparaison="">
            <div className="vt-rangee vt-rangee-tete" role="row"><span role="columnheader" /><span role="columnheader">{OFFRES.solo.nom}</span><span role="columnheader">{OFFRES.pro.nom}</span></div>
            {lignes.map(([k, a, b]) => (
              <div key={k} className="vt-rangee" role="row" data-cmp={k}><span role="rowheader">{tr(`tarifs.cmp.${k}`)}</span><span role="cell">{a}</span><span role="cell">{b}</span></div>
            ))}
          </div>
        </section>

        <section className="vt-section" aria-labelledby="vt-essai">
          <h2 id="vt-essai" className="vt-h2">{tr('tarifs.essai.titre', { n: ESSAI_JOURS })}</h2>
          {ACCES_OFFERT ? <p className="vt-note" data-essai-plus-tard="">{tr('tarifs.essai.offert')}</p> : null}
          <ol className="vt-frise" data-essai={ESSAI_JOURS}>
            <li><span className="vt-jour">{tr('tarifs.essai.j1')}</span><b>{tr('tarifs.essai.debut.titre')}</b><p>{tr('tarifs.essai.debut.texte')}</p></li>
            <li><span className="vt-jour">{tr('tarifs.essai.pendant', { n: ESSAI_JOURS })}</span><b>{tr('tarifs.essai.milieu.titre')}</b><p>{tr('tarifs.essai.milieu.texte')}</p></li>
            <li><span className="vt-jour">{tr('tarifs.essai.apres', { n: Number(ESSAI_JOURS) + 1 })}</span><b>{tr('tarifs.essai.fin.titre')}</b><p>{tr('tarifs.essai.fin.texte')}</p></li>
          </ol>
          <p className="vt-note">{tr('tarifs.essai.uneFois')}</p>
        </section>

        <section className="vt-section" aria-labelledby="vt-apres">
          <h2 id="vt-apres" className="vt-h2">{tr('tarifs.apres.titre')}</h2>
          <div className="vt-cartes">
            {['resilier', 'rien', 'retract'].map((k) => (
              <article key={k} className="vt-carte" data-apres={k}><b>{tr(`tarifs.apres.${k}.titre`)}</b><p>{tr(`tarifs.apres.${k}.texte`)}</p></article>
            ))}
          </div>
        </section>

        <section className="vt-fin">
          <a href="/?inscription" className="vt-btn" data-cta="inscription">{tr('accueil.cta.essayer')}</a>
          <a href="/?exemple" className="vt-btn vt-btn-neutre" data-cta="exemple">{tr('accueil.cta.exemple')}</a>
          <p className="vt-note">{tr('tarifs.stripe')}</p>
        </section>
      </main>
      <footer className="vt-pied">
        <nav aria-label={tr('accueil.pied.informations')}>
          <a href="/">{tr('tarifs.accueil')}</a>
          {LEGAL.map(([l, h]) => <a key={h} href={h} data-lien-legal={h}>{tr(l)}</a>)}
        </nav>
        <ChoixLangue className="vt-langue" />
      </footer>
    </div>
  );
}
const Coche = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
