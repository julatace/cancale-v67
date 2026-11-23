// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · DÉPENSES DU MOIS ET « + DÉPENSE » EN DEUX TOUCHERS (21 nov., lot transp-depenses).
//  Julien : « saisie rapide des dépenses ». Toucher 1 : « + Dépense » (en-tête de la carte) ouvre la feuille, le montant
//  prêt à taper ; toucher 2 : la catégorie — le montant lu, la dépense est AJOUTÉE (date = aujourd'hui par défaut, note
//  et photo du ticket facultatives, au-dessus). Toucher une dépense de la liste ⇒ la même feuille pour la modifier ou la
//  mettre à la corbeille.
//  AUCUNE règle ici : le total du mois arrive calculé par la règle des charges de Comptabilité (`chargesMois`), la forme
//  d'une dépense et l'écriture par src/depensesRapides.js (via `onEnregistrer` / `onRetirer` de src/ecrans/Compta.jsx).
//  La photo du ticket est rangée telle quelle, sans lecture (ni IA, ni service distant, §2.9).
//  Trois états : `encours` (le nuage pas arrivé : on ne peut pas encore écrire, c'est dit) · `lu`.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Carte, Rangee, Feuille, Bouton, Champ, TIRET } from '../index.js';
import { CATS, idCat, lireMontant, jourLocal } from '../../depensesRapides.js';
import './depenses.css';

const RAISONS = { montant: 'dep.err.montant', categorie: 'dep.err.categorie', date: 'dep.err.date', 'pas-lu': 'dep.err.pasLu', lecture: 'dep.err.pasLu', ecriture: 'dep.err.ecriture' };

function FeuilleDepense({ ouverte, depense, onFermer, onEnregistrer, onRetirer, onPhoto, montant }) {
  const edition = !!depense;
  const [m, setM] = React.useState('');
  const [cat, setCat] = React.useState('');
  const [date, setDate] = React.useState(jourLocal());
  const [note, setNote] = React.useState('');
  const [photo, setPhoto] = React.useState(null);
  const [err, setErr] = React.useState('');
  const fichier = React.useRef(null);
  React.useEffect(() => {
    if (!ouverte) return;
    setM(depense ? String(depense.montant).replace('.', ',') : ''); setCat(depense ? depense.cat : ''); setDate(depense ? depense.date : jourLocal());
    setNote(depense && depense.libelle !== depense.cat ? depense.libelle : ''); setPhoto(null); setErr('');
    // Toucher 1 a ouvert la feuille : le montant est PRÊT À TAPER (la feuille pose d'abord son focus sur elle-même).
    if (depense) return undefined;
    const t = setTimeout(() => { try { const el = document.querySelector('[data-dep-montant-rapide]'); if (el) el.focus({ preventScroll: true }); } catch (_) { /* rien */ } }, 30);
    return () => clearTimeout(t);
  }, [ouverte, depense]);
  const envoyer = async (c) => {
    const r = await onEnregistrer({ id: depense ? depense.id : null, cat: c, montant: m, date, note, photo });
    if (r && r.ok) { onFermer(); return; }
    setErr(tr(RAISONS[(r && r.raison) || 'ecriture'] || 'dep.err.ecriture'));
  };
  // Toucher 2 : la catégorie. Le montant lu ⇒ la dépense part (ajout) ; sinon le choix est gardé et le montant demandé.
  const choisir = (c) => {
    setCat(c); setErr('');
    if (!edition && lireMontant(m) != null) return envoyer(c);
    if (lireMontant(m) == null) setErr(tr('dep.err.montant'));
    return undefined;
  };
  const choisirPhoto = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f || !onPhoto) return; const b = await onPhoto(f); if (b) setPhoto(b); else setErr(tr('dep.err.photo')); };
  const lu = lireMontant(m);
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr(edition ? 'dep.modifier' : 'dep.nouvelle')} attrs={{ 'data-dep-feuille': edition ? 'modifier' : 'ajouter' }}
      pied={edition || cat ? <Bouton variante="plein" onClick={() => envoyer(cat)} indisponible={!cat || lu == null} raison={!cat ? tr('dep.choisisCat') : lu == null ? tr('dep.err.montant') : ''} attrs={{ 'data-dep-enregistrer': '' }}>{tr(edition ? 'dep.enregistrer' : 'dep.ajouter')}</Bouton> : null}>
      <Champ libelle={tr('dep.montant')} valeur={m} onChange={(x) => { setM(x); setErr(''); }} inputMode="decimal" suffixe="€" placeholder="0,00"
        attrs={{ 'data-dep-montant-rapide': '', enterKeyHint: 'done', onKeyDown: (e) => { if (e.key === 'Enter' && cat) envoyer(cat); } }}/>
      <div className="n-dep-cats" role="radiogroup" aria-label={tr('dep.categorie')} data-dep-cats="">
        {CATS.map((c) => (
          <button key={c.k} type="button" role="radio" aria-checked={cat === c.k} className="n-dep-cat" data-dep-cat-rapide={c.id} onClick={() => choisir(c.k)}>{tr('dep.cat.' + c.id)}</button>
        ))}
      </div>
      <p className="n-dep-aide" data-dep-aide="">{edition ? '' : tr('dep.aide')}</p>
      <div className="n-dep-plus">
        <Champ libelle={tr('dep.date')} valeur={date} onChange={(x) => { setDate(x); setErr(''); }} attrs={{ type: 'date', max: jourLocal(), 'data-dep-date-rapide': '' }}/>
        <Champ libelle={tr('dep.note')} valeur={note} onChange={setNote} placeholder={tr('dep.noteEx')} attrs={{ maxLength: 80, 'data-dep-note-rapide': '' }}/>
        <div className="n-dep-photo">
          <Bouton variante="texte" onClick={() => fichier.current && fichier.current.click()} attrs={{ 'data-dep-photo-rapide': photo ? '1' : '' }}>{tr(photo ? 'dep.photoChoisie' : (edition && depense.ticket ? 'dep.photoRemplacer' : 'dep.photo'))}</Bouton>
          <input ref={fichier} type="file" accept="image/*" capture="environment" onChange={choisirPhoto} hidden/>
        </div>
      </div>
      {err ? <p className="n-dep-err" role="alert" data-dep-erreur-rapide="">{err}</p> : null}
      {edition ? <div className="n-dep-retirer"><Bouton variante="texte" ton="ambre" onClick={() => { onRetirer(depense.id); onFermer(); }} attrs={{ 'data-dep-retirer': '' }}>{tr('dep.retirer')}</Bouton></div> : null}
      {edition && lu != null ? <p className="n-dep-aide">{tr('dep.vaut', { m: montant(lu) })}</p> : null}
    </Feuille>
  );
}

// `etat` : 'encours' | 'lu' ; `moisLong` ; `chargesMois` : { total, sansDepenses } de la règle des charges ; `lignes` : les
// dépenses du mois (src/depensesRapides.js `depensesDuMois`) ; `montant` : le format de l'app.
export default function DepensesMois({ etat = 'encours', moisLong = '', chargesMois = null, lignes = [], montant = (x) => String(x), onEnregistrer, onRetirer, onPhoto, ouvrirDemande = 0 }) {
  const [ouverte, setOuverte] = React.useState(false);
  const [edite, setEdite] = React.useState(null);
  React.useEffect(() => { if (ouvrirDemande) { setEdite(null); setOuverte(true); } }, [ouvrirDemande]);
  const total = chargesMois && chargesMois.total != null ? chargesMois.total : null;
  const sous = etat !== 'lu' ? tr('dep.lecture') : total == null ? '' : tr('dep.chargesMois', { m: montant(total) });
  return (
    <>
      <Carte className="n-dep-carte" titre={tr('dep.titre', { mois: moisLong })} n={etat === 'lu' ? lignes.length : undefined} sousTitre={sous}
        action={<Bouton variante="texte" onClick={() => { setEdite(null); setOuverte(true); }} indisponible={etat !== 'lu'} raison={etat !== 'lu' ? tr('dep.err.pasLu') : ''} attrs={{ 'data-dep-plus': '' }}>{tr('dep.plus')}</Bouton>}
        attrs={{ 'data-dep-mois': etat, 'data-dep-n': String(lignes.length), 'data-dep-charges': total == null ? '' : String(Math.round(total * 100)) }}>
        {etat === 'lu' && !lignes.length ? <Rangee titre={tr('dep.aucune')} sousTitre={tr('dep.aucuneSous')}/> : null}
        {lignes.map((d) => (
          <Rangee key={d.id} titre={d.libelle && d.libelle !== d.cat ? d.libelle : tr('dep.cat.' + idCat(d.cat))}
            sousTitre={[d.libelle && d.libelle !== d.cat ? tr('dep.cat.' + idCat(d.cat)) : '', d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '', d.ticket ? tr('dep.avecTicket') : ''].filter(Boolean).join(' · ')}
            valeur={d.montant != null ? montant(d.montant) : TIRET} fin="chevron" onClick={etat === 'lu' ? () => { setEdite(d); setOuverte(true); } : null}
            attrs={{ 'data-dep-ligne': d.id, 'data-dep-cents': d.montant != null ? String(Math.round(d.montant * 100)) : '', 'data-dep-cat-ligne': idCat(d.cat) }}/>
        ))}
      </Carte>
      <FeuilleDepense ouverte={ouverte} depense={edite} onFermer={() => setOuverte(false)} onEnregistrer={onEnregistrer} onRetirer={onRetirer} onPhoto={onPhoto} montant={montant}/>
    </>
  );
}
