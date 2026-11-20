// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · MOIS — « VRM natif », style §2 bis (20 nov., lot argent-natif). Remplace src/designV2/ArgentMois.jsx.
//  Julien, 20 nov. (captures iPhone) : « Améliore le visuel, tu n'as pas respecté ce qu'on avait dit » ; la référence :
//  la feuille « Plus » (listes groupées sobres, libellé à gauche, valeur à droite, rien de chargé).
//  De haut en bas :
//    1. une carte : le chiffre REÇU du mois (« 1 841 € reçus en novembre », daté au versement, §5), et les six mois en
//       barres (toucher une barre dit son mois dans la ligne grise) ;
//    2. quatre tuiles comme Aujourd'hui : Vendu · Bénéfice · Argent à venir · Disponible (le Reçu est le chiffre du
//       dessus : le même nombre ne s'écrit jamais deux fois, CLAUDE.md §7) ; « 0 sur 25 coûts saisis » sous le bénéfice ;
//       le plein « Saisir N prix d'achat » seulement s'il y a un geste (le chiffre faux est la porte) ;
//    3. les versements du mois en tableau compact (titre, N°, jour · site, montant ; « acheté X € → +Y € » s'il est connu).
//  AUCUN calcul ici : tout arrive calculé de src/ecrans/Compta.jsx (`ArgentMoisV2`) par les MÊMES règles qu'hier
//  (`valeurChiffre`, `questionsArgent`, `recuPublieEntre`, `recettesDe`). Les data-v2-argent-* d'hier restent (bancs).
//  Trois états : `encours` (squelette de la forme exacte) · `passu` (« — » + la raison) · lu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Carte, Tuiles, Tuile, Rangee, Plaque, Bouton, Barres, Affiche, Attente } from '../index.js';
import './argent.css';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
// « 1 107 € » ⇒ [« 1 107 », « € »] : l'unité est posée à côté du chiffre.
const coupe = (t) => { const m = /^(.*?)[\s  ]*€$/.exec(String(t)); return m ? [m[1], '€'] : [String(t), '']; };

export default function ArgentMois({ poster, phrase, moisLong, barres, faits, geste, versements, montant, vendu = null }) {
  const [choisi, setChoisi] = React.useState(barres.length - 1);
  const [tout, setTout] = React.useState(false);
  const MONTRES = 8;   // le tableau reste court ; « Voir les 25 » déplie le reste (rien n'est caché sans le dire)
  const b = barres[choisi] || null;
  const { valeur, partiel } = poster;
  const [n, u] = valeur == null ? [null, ''] : coupe(montant(valeur));
  const texteBarre = (x) => (x.v == null ? '—' : (x.partiel ? tr('journee.moins') + ' ' : '') + montant(x.v));
  // La ligne grise : la phrase de la règle (le manque, « daté au jour du versement ») ; une autre barre choisie ⇒ son mois.
  const ligne = b && !b.courant ? `${b.long} · ${texteBarre(b)}` : phrase;
  const F = Object.fromEntries(faits.map((f) => [f.id, f]));
  const tuile = (f, libelle) => {
    if (!f) return null;
    const [v, un] = f.pasSu ? [null, ''] : coupe(f.v);
    return <Tuile key={f.id} libelle={libelle || f.l} valeur={v} unite={un} onClick={f.onClick}
      detail={f.pasSu ? (f.sous || tr('v2.ar.pasSu')) : f.auMoins ? tr('journee.moins') : (f.detail || '')} ton={f.ton || 'neutre'}
      attrs={{ 'data-v2-argent-fait': f.id, 'data-v2-argent-valeur': f.cents, 'data-v2-pas-su': f.pasSu ? '' : undefined }}/>;
  };
  const C = F.couts;
  // « 0 sur 25 coûts saisis » : sous le bénéfice (le fait garde ses data-* d'hier) ; ambre s'il y a un geste.
  const benef = F.benefice ? { ...F.benefice, ton: geste ? 'ambre' : 'neutre',
    detail: C && !C.pasSu ? <span data-v2-argent-fait="couts" data-v2-argent-valeur={C.cents}>{tr('arn.coutsSaisis', { v: C.v })}</span> : '' } : null;
  const connus = faits.filter((f) => !f.pasSu);
  return (
    <section className="n-arg n-arg-mois" data-v2-argent-mois="" aria-label={tr('v2.ar.seg.resume')}>
      <div className="n-arg-col">
        <Carte className="n-arg-affiche" attrs={{ 'data-v2-argent-recu': cents(valeur), 'data-v2-argent-partiel': partiel ? '1' : undefined, 'data-v2-argent-phrase': '' }}>
          <Affiche valeur={n} unite={u} libelle={(partiel && valeur != null ? tr('journee.moins') + ' · ' : '') + tr('v2.ar.recusEn', { mois: moisLong })} ecart={ligne}>
            <Barres libelle={tr('v2.ar.graphe')} choisie={choisi} onChoisir={setChoisi}
              attrs={{ 'data-arg-mois': String(barres.length), 'data-v2-argent-barres': barres.map((x) => cents(x.v)).join(','), 'data-v2-argent-barre-v': b ? cents(b.v) : '' }}
              barres={barres.map((x) => ({ cle: x.cle, lettre: x.l, valeur: x.v, libelle: `${x.long} : ${x.v == null ? tr('v2.ar.pasSu') : texteBarre(x)}` }))}/>
          </Affiche>
        </Carte>
        <Tuiles className="n-arg-tuiles" attrs={{ 'data-v2-argent-faits': String(connus.length) }}
          action={geste ? <Bouton variante="plein" onClick={geste.onClick} attrs={{ 'data-v2-principal': geste.id, 'data-v2-argent-geste': String(geste.n) }}>{geste.libelle}</Bouton> : null}>
          {vendu ? <Tuile libelle={tr('arn.vendu')} valeur={vendu.valeur == null ? null : coupe(montant(vendu.valeur))[0]} unite={vendu.valeur == null ? '' : '€'}
            detail={vendu.valeur == null ? (vendu.note || tr('v2.ar.pasSu')) : vendu.partiel ? tr('journee.moins') : ''} onClick={vendu.onClick}
            attrs={{ 'data-arg-vendu': cents(vendu.valeur) }}/> : null}
          {tuile(benef)}
          {tuile(F.attente, tr('arn.aVenir'))}
          {tuile(F.dispo)}
        </Tuiles>
        {/* Ce qui n'est pas lu est NOMMÉ sur la tuile (« — » + la raison) ; la liste des pas-sus reste lisible des bancs. */}
        <span hidden data-v2-argent-passu={faits.filter((f) => f.pasSu).map((f) => f.id).join(' ')}/>
      </div>
      <div className="n-arg-col">
        <Carte titre={tr('v2.ar.versements', { mois: moisLong })} n={versements.etat === 'lu' && versements.n ? String(versements.n) : null}
          attrs={{ 'data-v2-argent-versements': versements.etat === 'encours' ? 'encours' : versements.etat === 'passu' ? 'passu' : String(versements.n) }}>
          {versements.etat === 'encours' ? <Attente forme="rangees" n={3}/>
            : versements.etat === 'passu' ? <Rangee titre={tr('v2.ar.versementsPasSu')}/>
            : !versements.lignes.length ? <Rangee titre={tr('v2.ar.aucunVersement', { mois: moisLong })}/>
            : (tout ? versements.lignes : versements.lignes.slice(0, MONTRES)).map((l) => (
              <Rangee key={l.id} titre={l.titre || tr('v2.ar.venteSans', { plateforme: l.plateforme || '' })} plaque={l.num ? <Plaque numero={l.num}/> : null}
                sousTitre={[l.date, l.plateforme, l.achat != null ? tr('v2.ar.achete', { p: montant(l.achat) }) + (l.marge != null ? ' → ' + (l.marge > 0 ? '+' : l.marge < 0 ? '−' : '') + montant(Math.abs(l.marge)) : '') : ''].filter(Boolean).join(' · ')}
                valeur={l.montant == null ? '—' : montant(l.montant)} valeurForte onClick={l.num ? l.onClick : null}
                attrs={{ 'data-v2-argent-versement': l.id, 'data-eur': cents(l.montant), 'data-v2-argent-achat': l.achat != null ? cents(l.achat) : undefined, 'data-v2-argent-marge': l.achat != null ? cents(l.marge) : undefined }}/>
            ))}
          {versements.etat === 'lu' && !tout && versements.lignes.length > MONTRES ? <Rangee titre={tr('arn.voirTous', { n: versements.lignes.length })} fin="chevron" onClick={() => setTout(true)} attrs={{ 'data-arg-voir-tous': String(versements.lignes.length) }}/> : null}
          {versements.etat === 'lu' && tout && versements.reste > 0 ? <Rangee titre={tr('v2.ar.autres', { n: versements.reste })}/> : null}
        </Carte>
      </div>
    </section>
  );
}
