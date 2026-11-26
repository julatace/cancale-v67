// ════════════════════════════════════════════════════════════════════════════
//  LE SUIVI D'UN ENVOI — l'affichage (24 nov., lot suivi-ventes). Julien : « retrait des articles vendus,
//  fais un vrai suivi ». La RÈGLE est api/_lib/suivi-envoi.js (`parcoursEnvoi`, `groupesEnvois`) : ce
//  fichier ne décide rien, il dessine.
//    · <ParcoursEnvoi> : la piste d'un colis vendu, du dépôt au versement — cinq étapes reliées par un trait,
//      chacune avec SA date lue, ou « — pas encore su » ; le logo du transporteur, le n° de suivi qui ouvre
//      sa page ; le point (nom, depuis, à retirer avant) ; « Colis en danger » (la règle de #1338) ; le retour.
//    · <MesEnvois> : les quatre groupes (en route · au point, pas retiré · retiré, argent en attente · argent
//      versé), leurs nombres et la couverture (combien lus chez un transporteur), en filtres de la liste.
//  Gris clair, aucun orange : l'ardoise pour une étape faite, le vert « fait » pour l'argent versé, un
//  pointillé pour ce qui n'est pas su. Tous les textes par `tr()` (src/i18n/langues/*/envois.js).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date } from './i18n/index.js';
import { LogoTransporteur, LogoInconnu } from './PastilleTransporteur.jsx';
import './styles-suivi-envoi.css';

const PARIS = 'Europe/Paris';
const fmt = (t, o) => date(t, { timeZone: PARIS, ...o });
// « 23 nov. » ; avec l'heure quand elle compte (une date limite) : « mer. 25 nov., 11:34 ».
export const jourEnvoi = (t) => (Number.isFinite(t) ? fmt(t, { day: 'numeric', month: 'short' }) : '');
export const limiteEnvoi = (t) => (Number.isFinite(t) ? fmt(t, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const Coche = () => <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6-6.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Horloge = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
const Retour = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 4L2.5 7.5 6 11M3 7.5h6.5a4 4 0 010 8H8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;

const SOURCES = { transporteur: 'envois.source.transporteur', vinted: 'envois.source.vinted', email: 'envois.source.email', versement: 'envois.source.versement', transaction: 'envois.source.vinted', extension: 'envois.source.vinted' };
const sourceDe = (e, nom) => (e.etat === 'fait' && SOURCES[e.source] ? tr(SOURCES[e.source], { nom: nom || tr('envois.leTransporteur') }) : (e.etat === 'fait' && e.source ? e.source : ''));

// Ce qui s'écrit sous une étape : la date LUE, « lu, sans date », ou « — pas encore su ».
function sousEtape(e) {
  if (e.etat !== 'fait') return tr('envois.passu');
  return Number.isFinite(e.t) ? jourEnvoi(e.t) : tr('envois.luSansDate');
}

// ── LA PISTE D'UN COLIS ─────────────────────────────────────────────────────
// parcours : la sortie de `parcoursEnvoi` ; transporteur : { cle, nom } ; lien : { url } (la page du transporteur).
export function ParcoursEnvoi({ parcours, transporteur = null, lien = null, cle = '' }) {
  if (!parcours || !Array.isArray(parcours.etapes)) return null;
  const pc = parcours;
  const nom = transporteur && transporteur.nom ? transporteur.nom : '';
  const logo = transporteur && transporteur.cle ? <LogoTransporteur cle={transporteur.cle} taille={40} repli={<LogoInconnu taille={40}/>}/> : <LogoInconnu taille={40}/>;
  return (
    <section className="vrm-env" data-envoi-parcours={cle || pc.suivi || ''} data-envoi-groupe={pc.groupe || ''} data-envoi-danger={pc.danger || undefined}
      data-envoi-retour={pc.retour ? pc.retour.libelle : undefined} data-envoi-lu-transporteur={pc.luChezTransporteur ? '1' : '0'} aria-label={tr('envois.titreColis')}>
      <header className="vrm-env-tete">
        <span className="vrm-env-logo" data-envoi-transporteur={(transporteur && transporteur.cle) || ''}>{logo}</span>
        <span className="vrm-env-ident">
          <span className="vrm-env-nom">{nom || tr('envois.transporteurInconnu')}</span>
          {pc.suivi ? (lien && lien.url
            ? <a className="vrm-env-numero" href={lien.url} target="_blank" rel="noreferrer" data-envoi-suivi={pc.suivi} aria-label={tr('envois.ouvrirSuivi', { n: pc.suivi })}>{pc.suivi}<span aria-hidden="true"> ↗</span></a>
            : <span className="vrm-env-numero" data-envoi-suivi={pc.suivi}>{pc.suivi}</span>)
            : <span className="vrm-env-numero vrm-env-numero-vide" data-envoi-suivi="">{tr('envois.sansNumero')}</span>}
        </span>
      </header>
      <ol className="vrm-env-piste">
        {pc.etapes.map((e, i) => {
          const pt = e.cle === 'aupoint' && e.etat === 'fait';
          const src = sourceDe(e, nom);
          return (
            <li key={e.cle} className="vrm-env-etape" data-envoi-etape={e.cle} data-envoi-etat={e.etat} data-envoi-t={Number.isFinite(e.t) ? String(e.t) : ''}
              data-envoi-source={e.etat === 'fait' ? (e.source || 'lu') : undefined} data-envoi-cours={e.cours ? '' : undefined} data-envoi-ici={i === pc.ici ? '' : undefined}
              data-envoi-apres-retour={e.apresRetour ? '' : undefined} aria-current={e.cours ? 'step' : undefined}>
              <span className="vrm-env-point" aria-hidden="true">{e.etat === 'fait' ? <Coche/> : null}</span>
              <span className="vrm-env-texte">
                <span className="vrm-env-ligne">
                  <span className="vrm-env-libelle">{tr('envois.etape.' + e.cle)}</span>
                  <span className="vrm-env-date" title={src || undefined}>{pt ? (Number.isFinite(e.t) ? tr('envois.depuis', { d: jourEnvoi(e.t) }) : tr('envois.luSansDate')) : sousEtape(e)}</span>
                </span>
                {pt && (e.nom || e.ville) ? <span className="vrm-env-lieu" data-envoi-lieu="">{[e.nom, e.ville].filter(Boolean).join(' · ')}</span> : null}
                {pt && pc.etapes.find((x) => x.cle === 'retire').etat !== 'fait' ? (Number.isFinite(e.limite)
                  ? <span className="vrm-env-limite" data-envoi-limite={String(e.limite)}>{tr('envois.avant', { d: limiteEnvoi(e.limite) })}</span>
                  : <span className="vrm-env-limite vrm-env-limite-passu" data-envoi-limite="">{tr('envois.limitePasDonnee', { nom: nom || tr('envois.leTransporteur') })}</span>) : null}
                {pt && pc.danger ? <span className="vrm-env-danger" data-envoi-danger-ligne={pc.danger}><Horloge/>{tr('envois.danger.' + pc.danger)}</span> : null}
                <span className="vrm-sr">{src ? ' — ' + src : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {pc.retour ? (
        <p className="vrm-env-retour" data-envoi-retour-ligne={pc.retour.libelle}>
          <Retour/><span>{pc.retour.libelle === 'repart' || pc.retour.libelle === 'revenu' ? tr('envois.retour.' + pc.retour.libelle) : [pc.retour.libelle, pc.retour.sous].filter(Boolean).join(' · ')}</span>
          {Number.isFinite(pc.retour.t) ? <span className="vrm-env-date">{jourEnvoi(pc.retour.t)}</span> : null}
        </p>
      ) : null}
    </section>
  );
}

// ── LA LIGNE « AU POINT » D'UNE CARTE DE LA LISTE ───────────────────────────
// Ce que la liste ne disait pas : le nom du point, depuis quand, avant quand ; le danger.
export function LignePointEnvoi({ parcours }) {
  const pc = parcours;
  if (!pc || pc.groupe !== 'aupoint') return null;
  const e = pc.etapes.find((x) => x.cle === 'aupoint');
  if (!e || e.etat !== 'fait') return null;
  const morceaux = [e.nom || tr('envois.etape.aupoint'), Number.isFinite(e.limite) ? tr('envois.avant', { d: limiteEnvoi(e.limite) }) : Number.isFinite(e.t) ? tr('envois.depuis', { d: jourEnvoi(e.t) }) : ''].filter(Boolean);
  return (
    <span className="vrm-env-carte-point" data-envoi-carte-point={pc.suivi || ''} data-envoi-danger={pc.danger || undefined}>
      {pc.danger ? <Horloge/> : null}{morceaux.join(' · ')}{pc.danger ? <strong>{' · ' + tr('envois.dangerCourt.' + pc.danger)}</strong> : null}
    </span>
  );
}

// ── « MES ENVOIS » : LES GROUPES ────────────────────────────────────────────
// groupes : la sortie de `groupesEnvois` ; choix : 'tous' | un groupe ; onChoix(g).
export const ORDRE_GROUPES = ['enroute', 'aupoint', 'retire', 'argent', 'retour'];
export function MesEnvois({ groupes, choix = 'tous', onChoix }) {
  if (!groupes || !groupes.couverture) return null;
  const { n, lus } = groupes.couverture;
  if (!n) return null;
  const tuiles = ORDRE_GROUPES.filter((g) => g !== 'retour' || groupes.retour.length);
  return (
    <section className="vrm-envs" data-mes-envois={n} data-mes-envois-lus={lus} aria-labelledby="vrm-envs-titre">
      <div className="vrm-envs-tete">
        <h3 id="vrm-envs-titre" className="vrm-envs-titre">{tr('envois.titre')}</h3>
        <span className="vrm-envs-couv" data-mes-envois-couverture={`${lus}/${n}`}>{tr('envois.couverture', { lus, n })}</span>
      </div>
      <div className="vrm-envs-tuiles" role="group" aria-label={tr('envois.titre')}>
        {tuiles.map((g) => {
          const k = groupes[g].length;
          const actif = choix === g;
          return (
            <button key={g} type="button" className="vrm-envs-tuile" data-mes-envois-groupe={g} data-mes-envois-n={k} aria-pressed={actif}
              onClick={() => onChoix && onChoix(actif ? 'tous' : g)}>
              <span className="vrm-envs-n">{k}</span>
              <span className="vrm-envs-lib">{tr('envois.groupe.' + g)}</span>
              <span className={'vrm-envs-piste vrm-envs-piste-' + g} aria-hidden="true"><i/><i/><i/><i/><i/></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── LA LISTE D'UN GROUPE ────────────────────────────────────────────────────
// items : [{ cle, tx, titre, photo, num, parcours, transporteur }] (un groupe de `groupesEnvois`) ;
// Photo : le composant d'image (PhotoVinted) ; numero(n) : la plaque du N° ; onOuvrir(item) : ouvre la vente.
// La phrase d'une rangée : la DERNIÈRE étape lue (sa date), le point et sa date limite, le danger.
export function phraseEnvoi(pc) {
  if (!pc) return '';
  if (pc.retour) return pc.retour.libelle === 'repart' || pc.retour.libelle === 'revenu' ? tr('envois.retour.' + pc.retour.libelle) : [pc.retour.libelle, pc.retour.sous].filter(Boolean).join(' · ');
  const e = pc.ici >= 0 ? pc.etapes[pc.ici] : null;
  if (!e) return tr('envois.passu');
  if (e.cle === 'aupoint') return [e.nom || tr('envois.etape.aupoint'), Number.isFinite(e.limite) ? tr('envois.avant', { d: limiteEnvoi(e.limite) }) : Number.isFinite(e.t) ? tr('envois.depuis', { d: jourEnvoi(e.t) }) : ''].filter(Boolean).join(' · ');
  return [tr('envois.etape.' + e.cle), Number.isFinite(e.t) ? jourEnvoi(e.t) : ''].filter(Boolean).join(' · ');
}
export function ListeEnvois({ items, Photo = null, numero = null, onOuvrir = null }) {
  if (!Array.isArray(items) || !items.length) return <p className="vrm-envs-vide" data-mes-envois-vide="">{tr('envois.vide')}</p>;
  return (
    <ul className="vrm-envs-liste" data-mes-envois-liste={items.length}>
      {items.map((it) => {
        const pc = it.parcours;
        const cleT = it.transporteur && it.transporteur.cle;
        return (
          <li key={it.cle}>
            <button type="button" className="vrm-envs-ligne" data-mes-envois-ligne={it.tx || it.cle} data-envoi-groupe={pc.groupe} data-envoi-danger={pc.danger || undefined} onClick={() => onOuvrir && onOuvrir(it)}>
              <span className="vrm-envs-photo" aria-hidden="true">{it.photo && Photo ? <Photo src={it.photo} alt="" loading="lazy" decoding="async"/> : cleT ? <LogoTransporteur cle={cleT} taille={44}/> : <LogoInconnu taille={44}/>}</span>
              <span className="vrm-envs-mid">
                <span className="vrm-envs-l1">{it.num && numero ? numero(it.num) : null}<span className="vrm-envs-titre-ligne">{it.titre}</span></span>
                <span className="vrm-envs-phrase" data-envoi-phrase="">{pc.danger ? <Horloge/> : null}{phraseEnvoi(pc)}{pc.danger ? <strong>{' · ' + tr('envois.dangerCourt.' + pc.danger)}</strong> : null}</span>
              </span>
              <span className="vrm-envs-mini" aria-hidden="true">{pc.etapes.map((e) => <i key={e.cle} data-fait={e.etat === 'fait' ? (e.cle === 'argent' ? 'argent' : '1') : '0'}/>)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
