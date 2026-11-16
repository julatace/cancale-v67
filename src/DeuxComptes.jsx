// ── « DEUX COMPTES, UNE PAIRE » (15 nov., lot deux-comptes) ──────────────────────
// La feuille (Ma journée, Annonces → À faire) et l'alerte compacte d'Annonces.
// Règle : src/deuxComptes.js (identité ou indice, laquelle retirer, ce que la lecture dit).
//
// Chaque paire : la plaque N°, l'état (« sûr » : la même photo exacte, recréée par VRM,
// ou fusionnée par lui · « à vérifier » : photo presque identique, ou le même N°), les
// DEUX annonces côte à côte (photo, compte, prix, depuis), et UN geste :
// « Retirer celle de kicks_sud » — il ouvre l'annonce sur vinted.fr et la retire lui-même
// (§3 : VRM ne supprime jamais une annonce Vinted ; Vinted n'a pas de pause d'une seule
// annonce). La prochaine lecture COMPLÈTE de ce compte dit si elle est partie.
// « Plutôt celle de … » change laquelle ; pour un indice, « C'est la même paire » (la fusion
// existante, SON clic : devient une identité) ou « Ce n'est pas la même » (ne revient plus).
import React from 'react';
import { tr, date, heure, localeCourante } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { lienVinted, etatRetrait } from './deuxComptes.js';
import './styles-deux-comptes.css';

const et = (noms) => { try { return new Intl.ListFormat(localeCourante(), { type: 'conjunction' }).format(noms); } catch (_) { return noms.join(', '); } };
const nomDe = (a) => (a && a.nom) || tr('deuxComptes.compteSansNom');
const euros = (n) => { try { return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n); } catch (_) { return `${n} €`; } };
const jour = (ms) => {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms), m = new Date();
  if (d.toDateString() === m.toDateString()) return tr('deuxComptes.aujourdhui');
  return date(ms, { day: 'numeric', month: 'short', ...(d.getFullYear() !== m.getFullYear() ? { year: 'numeric' } : {}) });
};
export const texteEtDe = et;

function Annonce({ a, role, PhotoVinted }) {
  return (
    <figure className={'dc-annonce is-' + role} data-dc-annonce={a.id} data-dc-role={role} data-dc-compte={a.uid}
      data-dc-prix={a.prix == null ? '' : String(a.prix)} data-dc-depuis={a.depuis == null ? '' : String(a.depuis)}>
      <a className="dc-photo" href={lienVinted(a)} target="_blank" rel="noopener noreferrer" aria-label={tr('deuxComptes.voirSur', { compte: nomDe(a) })}>
        {a.photo && PhotoVinted ? <PhotoVinted src={a.photo} alt="" loading="lazy" decoding="async"/> : <PhotoVide remplir/>}
        <span className="dc-role">{role === 'retirer' ? <><i className="dc-point" aria-hidden="true"/>{tr('deuxComptes.aRetirer')}</> : tr('deuxComptes.aGarder')}</span>
      </a>
      <figcaption>
        <b>{nomDe(a)}</b>
        <span className="dc-chiffres">{a.prix == null ? tr('deuxComptes.prixPasLu') : euros(a.prix)}</span>
        <small>{a.depuis == null ? tr('deuxComptes.depuisPasLu') : tr('deuxComptes.depuis', { date: jour(a.depuis) })}{Number.isFinite(a.favoris) ? ` · ${tr('deuxComptes.favoris', { n: a.favoris })}` : ''}</small>
      </figcaption>
    </figure>
  );
}

const PREUVE = (p) => tr(`deuxComptes.preuve.${['photo', 'recree', 'fusion', 'empreinte', 'numero'].includes(p) ? p : 'photo'}`);

function Groupe({ g, PhotoVinted, marques, luDe, onOuvrir, onChoisir, onRefus, onMemePaire, onRelire, maintenant }) {
  const cible = g.retirer[0];
  const r = cible ? etatRetrait(marques && marques[cible.id], luDe(cible.uid), maintenant) : { etat: 'aRetirer' };
  const autre = g.annonces.length === 2 ? g.garder : null;
  return (
    <section className={'dc-groupe is-' + g.etat} data-dc-groupe={g.id} data-dc-etat={g.etat} data-dc-preuves={g.preuves.join(' ')} data-dc-retrait={r.etat}>
      <header className="dc-tete">
        {g.numeros.length ? <span className="sb-plaque" data-dc-plaque={g.numeros[0]}><small>N°</small>{g.numeros[0]}</span> : <span className="dc-sans">{tr('deuxComptes.sansNumero')}</span>}
        <span className={'dc-etat is-' + g.etat}>{g.etat === 'sur' ? tr('deuxComptes.sur') : tr('deuxComptes.verifier')}<small> · {g.preuves.map(PREUVE).join(' · ')}</small></span>
      </header>
      <p className="dc-ou" data-dc-ou="">{tr('deuxComptes.enVenteSur', { comptes: et([...new Set(g.annonces.map(nomDe))]) })}</p>
      <div className="dc-paire">{g.annonces.map((a) => <Annonce key={a.id} a={a} role={g.retirer.includes(a) ? 'retirer' : 'garder'} PhotoVinted={PhotoVinted}/>)}</div>
      {cible ? (
        <div className="dc-gestes">
          {r.etat === 'ouverte' ? <p className="dc-suite" data-dc-suite="ouverte">{tr('deuxComptes.ouverteLe', { heure: heure(r.at), compte: nomDe(cible) })}</p> : null}
          {r.etat === 'encore' ? <p className="dc-suite is-encore" data-dc-suite="encore"><i className="dc-point" aria-hidden="true"/>{tr('deuxComptes.encore', { heure: heure(r.lu), compte: nomDe(cible) })}</p> : null}
          <a className="sb-touche dc-retirer" href={lienVinted(cible)} target="_blank" rel="noopener noreferrer" data-dc-retirer={cible.id} data-dc-retirer-compte={cible.uid}
            onClick={() => onOuvrir && onOuvrir(cible, g)}>{r.etat === 'aRetirer' ? tr('deuxComptes.retirer', { compte: nomDe(cible) }) : tr('deuxComptes.rouvrir', { compte: nomDe(cible) })}</a>
          <div className="dc-liens">
            {r.etat !== 'aRetirer' && onRelire ? <button type="button" className="sb-lien" data-dc-relire="" onClick={onRelire}>{tr('deuxComptes.relire')}</button> : null}
            {autre && onChoisir ? <button type="button" className="sb-lien" data-dc-plutot={autre.id} onClick={() => onChoisir(g, autre.id)}>{tr('deuxComptes.plutot', { compte: nomDe(autre) })}</button> : null}
            {g.etat !== 'sur' && onMemePaire ? <button type="button" className="sb-lien" data-dc-meme="" aria-haspopup="dialog" onClick={() => onMemePaire(g)}>{tr('deuxComptes.memePaire')}</button> : null}
            {g.etat !== 'sur' && onRefus ? <button type="button" className="sb-lien" data-dc-pas-meme="" onClick={() => onRefus(g)}>{tr('deuxComptes.pasMeme')}</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// res : la sortie de `groupesDeuxComptes` ; regles : `reglees(...)` (retirées et relues).
export function DeuxComptesDetail({ res, regles = [], PhotoVinted = null, marques = {}, luDe = () => null, onOuvrir, onChoisir, onRefus, onMemePaire, onRelire, maintenant = Date.now() }) {
  useLangue();
  if (!res || !res.pret) return <p className="dc-etat" data-dc-pas-pret="">{tr('deuxComptes.lecture')}</p>;
  const pasSu = (res.manque || []).filter((m) => m.plateforme === 'vinted');
  return (
    <div className="dc" data-deux-comptes="" data-dc-n={String(res.groupes.length)} data-dc-surs={String(res.nSurs)} data-dc-verifier={String(res.nAVerifier)}>
      <p className="dc-risque">{tr('deuxComptes.risque')}</p>
      {res.groupes.map((g) => <Groupe key={g.id} g={g} PhotoVinted={PhotoVinted} marques={marques} luDe={luDe} onOuvrir={onOuvrir} onChoisir={onChoisir} onRefus={onRefus} onMemePaire={onMemePaire} onRelire={onRelire} maintenant={maintenant}/>)}
      {!res.groupes.length ? <p className="dc-etat" data-dc-rien="">{tr('deuxComptes.rien')}</p> : null}
      {regles.length ? (
        <ul className="dc-regles" data-dc-regles={regles.map((x) => x.id).join(' ')}>
          {regles.map((x) => <li key={x.id} data-dc-reglee={x.id}><span className="dc-ok" aria-hidden="true">✓</span>{tr('deuxComptes.reglee', { numero: x.numero ? `N°${x.numero}` : tr('deuxComptes.lAnnonce'), compte: x.nom || '—', heure: heure(x.lu) })}</li>)}
        </ul>
      ) : null}
      {pasSu.length ? <p className="dc-manque" data-dc-manque={pasSu.map((m) => m.uid).join(' ')}>{tr('deuxComptes.pasVerifie', { comptes: et(pasSu.map((m) => m.nom || m.uid)) })}</p> : null}
      <p className="dc-aide">{tr('deuxComptes.aide')}</p>
    </div>
  );
}

// L'alerte d'Annonces (dans « À faire ») : UNE ligne, le geste ouvre la feuille.
export function DeuxComptesAlerte({ res, onOuvrir, texte }) {
  useLangue();
  if (!res || !res.pret || !res.groupes.length || !texte) return null;
  return (
    <button type="button" className="sb-touche dc-alerte" data-annonces-deux-comptes={res.groupes.map((g) => g.id).join(' ')} data-n={String(res.groupes.length)} aria-haspopup="dialog" aria-label={`${texte.complet} — ${texte.detail}`} onClick={onOuvrir}>
      <i className="dc-point" aria-hidden="true"/><span className="dc-alerte-txt"><b>{texte.titre}</b><small>{texte.detail}</small></span>
    </button>
  );
}
export default DeuxComptesDetail;
