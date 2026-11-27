// ── src/natif/ecrans/PairesDorment.jsx — « PAIRES QUI DORMENT », LE PLAN (27 nov., choix de Julien) ────────────────────
// La règle : src/pairesDorment.js (plus de 21 j en ligne, rangées par l'argent qui dort = l'achat CONNU, vues et favoris
// LUS, les gestes et LA porte). Ici seulement le rendu :
//   · une ENTRÉE dans le segment « Dorment » d'Annonces (une rangée : l'argent qui dort, le nombre de paires) ;
//   · la FEUILLE du plan : en tête l'argent qui dort (« au moins » + la couverture si des achats manquent), puis une rangée
//     par paire — vignette, N°, titre, « 34 j · 12 vues · 3 favoris », l'achat (ou « — » et « Saisir l'achat »), et trois
//     boutons : Republier · Baisser à X € · Favoris. Chacun est SON toucher : l'écran appelle le chemin existant (l'atelier,
//     la baisse par la file avec SA confirmation, la page favoris du panneau). Rien ne part d'ici.
//   · la porte dit non (extension pas connectée à ce compte, en retard…) ⇒ les boutons sont ÉTEINTS, la raison est dite UNE
//     fois (en tête si tout le plan est en lecture seule, sinon sur la rangée du compte), les données restent visibles.
// Props : plan (undefined lecture · null pas su · `planPairesDorment`) · juger(site, compte, geste, par) · euros(n) · Photo ·
//   onRepublier(l) · onBaisser(l, versC) · onFavoris(l) · onAchat(l) · texteRaison(verdict) · Icon
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Feuille } from '../Feuille.jsx';
import { Plaque } from '../Plaque.jsx';
import { Vide } from '../Vide.jsx';
import { Actions } from '../Actions.jsx';
import { Bouton } from '../Bouton.jsx';
import { Glyphe } from '../icones.jsx';
import { gestesLignePlan, lectureSeulePlan, SEUIL_PLAN_JOURS } from '../../pairesDorment.js';
import './republierPriorite.css';

const eurosC = (euros, c) => (c == null ? '—' : euros(c / 100));
// « 34 j · 12 vues · 3 favoris » — un compteur pas lu s'écrit « — », jamais 0.
export const texteLignePlan = (l) => [tr('pdo.jours', { n: l.jours }), l.vues == null ? tr('pdo.vues.passu') : tr('pdo.vues', { n: l.vues }),
  l.favoris == null ? tr('pdo.favoris.passu') : tr('pdo.favoris', { n: l.favoris })].join(' · ');

export function EntreePairesDorment({ plan, onOuvrir, euros }) {
  if (!plan || !plan.n) return null;
  const partiel = plan.achatsConnus < plan.n;
  return (
    <Groupe attrs={{ 'data-pdo-entree': String(plan.n) }}>
      <Rangee titre={tr('pdo.titre')} sousTitre={tr('pdo.entree.sous', { n: plan.n, j: plan.seuil })}
        valeur={plan.achatsConnus ? (partiel ? tr('pdo.auMoins', { m: eurosC(euros, plan.argentC) }) : eurosC(euros, plan.argentC)) : '—'} fin="chevron" onClick={onOuvrir}
        attrs={{ 'data-pdo-ouvrir': '', 'data-pdo-argent': String(plan.argentC), 'data-pdo-connus': String(plan.achatsConnus) }}/>
    </Groupe>
  );
}

function LignePlan({ l, juger, euros, Photo, onRepublier, onBaisser, onFavoris, onAchat, texteRaison, raisonEnTete }) {
  const gs = gestesLignePlan(l, juger);
  const porteNon = gs.find((g) => g.verdict);
  const idRaison = 'pdo-r-' + l.cle.replace(/[^A-Za-z0-9_-]/g, '');
  // La raison de la PORTE : une fois (en tête, ou sur cette rangée) ; les boutons éteints la désignent (lecteur d'écran).
  const raisonDe = (g) => (g.verdict ? '' : g.raison ? tr('pdo.raison.' + g.raison) : '');
  const ic = (n) => <Glyphe nom={n} taille={18}/>;
  const el = gs.map((g) => {
    const faire = g.k === 'republier' ? () => onRepublier && onRepublier(l) : g.k === 'baisser' ? () => onBaisser && onBaisser(l, g.versC) : () => onFavoris && onFavoris(l);
    const libelle = g.k === 'republier' ? tr('pdo.republier') : g.k === 'baisser' ? (g.versC != null ? tr('pdo.baisserA', { m: eurosC(euros, g.versC) }) : tr('pdo.baisser')) : tr('pdo.favorisOffre');
    return { cle: g.k, libelle, icone: ic(g.k === 'republier' ? 'sync' : g.k === 'baisser' ? 'tag' : 'heart'), onClick: g.ok ? faire : undefined, indisponible: !g.ok, raison: raisonDe(g),
      attrs: { 'data-pdo-geste': g.k, 'data-pdo-ok': g.ok ? '1' : '0', 'data-pdo-raison': g.ok ? undefined : (g.raison || (g.verdict && g.verdict.raison) || ''), 'data-pdo-vers': g.versC == null ? undefined : String(g.versC),
        ...(g.verdict ? { 'aria-describedby': raisonEnTete || idRaison } : {}) } };
  });
  return (
    <div className="n-pdo-ligne" data-pdo-ligne={l.cle} data-pdo-site={l.site} data-pdo-compte={l.compte} data-pdo-id={l.id} data-pdo-jours={String(l.jours)}
      data-pdo-achat={l.achatC == null ? '' : String(l.achatC)} data-pdo-vues={l.vues == null ? '' : String(l.vues)} data-pdo-favoris={l.favoris == null ? '' : String(l.favoris)} data-pdo-source={l.source}>
      <Rangee titre={l.titre || '—'} sousTitre={texteLignePlan(l)} sousLignes={1}
        vignette={<Vignette src={(l.annonce && l.annonce.photo) || ''} alt="" image={Photo && l.annonce && l.annonce.photo ? Photo(l.annonce.photo) : null}/>}
        plaque={l.numero ? <Plaque numero={l.numero}/> : null}
        valeur={l.achatC != null ? tr('pdo.achat', { m: eurosC(euros, l.achatC) }) : '—'} attrs={{ 'data-pdo-rangee': '' }}/>
      {l.achatC == null && onAchat ? <div className="n-pdo-porte"><Bouton variante="texte" onClick={() => onAchat(l)} attrs={{ 'data-pdo-saisir': l.cle }}>{tr('pdo.saisirAchat')}</Bouton></div> : null}
      {porteNon && !raisonEnTete ? <p className="n-pdo-raison" id={idRaison} role="status" data-pdo-lecture={porteNon.verdict.raison}><Glyphe nom="lock" taille={14}/><span>{texteRaison(porteNon.verdict)}</span></p> : null}
      <Actions elements={el} className="n-pdo-actions" attrs={{ 'data-pdo-actions': String(el.length) }}/>
    </div>
  );
}

export function PlanPairesDorment({ plan, juger, euros, Photo = null, onRepublier, onBaisser, onFavoris, onAchat, texteRaison = () => '' }) {
  if (plan === undefined) return <div className="n-pdo" data-pdo="lecture" aria-busy="true"><p className="n-rp-note">{tr('pdo.lecture')}</p></div>;
  if (plan === null) return <div className="n-pdo" data-pdo="passu"><Vide phrase={tr('pdo.passu')}/></div>;
  if (!plan.n) return <div className="n-pdo" data-pdo="vide" data-pdo-sans-date={String(plan.sansDate)}><Vide phrase={tr('pdo.vide', { j: plan.seuil || SEUIL_PLAN_JOURS })}/></div>;
  const verdictTete = lectureSeulePlan(plan.lignes, juger);
  const partiel = plan.achatsConnus < plan.n;
  return (
    <div className="n-pdo" data-pdo="lu" data-pdo-n={String(plan.n)} data-pdo-argent={String(plan.argentC)} data-pdo-connus={String(plan.achatsConnus)} data-pdo-lecture-seule={verdictTete ? verdictTete.raison : undefined}>
      <div className="n-pdo-tete" data-pdo-tete="">
        <span className="n-pdo-tete-lib">{tr('pdo.argent')}</span>
        <span className="n-pdo-tete-m" data-pdo-total="">{plan.achatsConnus ? (partiel ? tr('pdo.auMoins', { m: eurosC(euros, plan.argentC) }) : eurosC(euros, plan.argentC)) : '—'}</span>
        <span className="n-pdo-tete-sous" data-pdo-couverture="">{tr('pdo.couverture', { k: plan.achatsConnus, n: plan.n })}</span>
      </div>
      {verdictTete ? <p className="n-pdo-raison n-pdo-raison-tete" id="pdo-lecture-seule" role="status" data-pdo-lecture={verdictTete.raison}><Glyphe nom="lock" taille={16}/><span><b>{tr('agir.badge')}</b> {texteRaison(verdictTete)}</span></p> : null}
      <div className="n-rp-liste n-pdo-liste">
        {plan.lignes.map((l) => <LignePlan key={l.cle} l={l} juger={juger} euros={euros} Photo={Photo} onRepublier={onRepublier} onBaisser={onBaisser} onFavoris={onFavoris} onAchat={onAchat}
          texteRaison={texteRaison} raisonEnTete={verdictTete ? 'pdo-lecture-seule' : ''}/>)}
      </div>
      {plan.sansDate ? <p className="n-rp-note" data-pdo-sans-date={String(plan.sansDate)}>{tr('pdo.sansDate', { n: plan.sansDate })}</p> : null}
    </div>
  );
}

export function FeuillePairesDorment({ ouverte, onFermer, ...props }) {
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('pdo.titre')} detente="pleine" attrs={{ 'data-pdo-feuille': '' }}>
      <PlanPairesDorment {...props}/>
    </Feuille>
  );
}
export default PlanPairesDorment;
