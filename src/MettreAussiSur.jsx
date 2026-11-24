// ── « METTRE AUSSI SUR… » — 1 paire → 4 sites (24 nov. 2026, choix de Julien) ─────────────────
// La feuille d'UNE annonce Vinted : les trois autres sites (une case chacun, grisée avec la raison quand ce
// n'est pas possible), UNE fiche partagée remplie par l'annonce Vinted, le prix de chaque site avec ses frais,
// UN bouton « Créer », puis l'état de chaque site en direct (créée ✓ avec le lien · à confirmer dans
// l'extension · brouillon eBay prêt · arrêtée + raison + geste).
// Vendue (prouvée) quelque part ⇒ rien à créer : « Vendue sur X — retirer de Y et Z ? » et le bloc existant
// « À retirer ailleurs » (son toucher confirmé, une annonce à la fois).
// La règle : src/publier/quatreSites.js. L'hôte (App.jsx, `HoteMettreAussiSur`) lit et envoie ; ici on dessine.
import React from 'react';
import { tr, monnaie, localeCourante } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { Feuille, Groupe, Rangee, Bouton, Segmente, LogoSite, Plaque, Vignette } from './natif/index.js';
import { SITES_QUATRE, NOM_QUATRE, PCT_AUSSI, TITRE_MAX_QUATRE } from './publier/quatreSites.js';
import './mettre-aussi.css';

const eur = (n) => (n != null && Number.isFinite(Number(n)) ? monnaie(Number(n)) : '—');
const liste = (l) => { try { return new Intl.ListFormat(localeCourante(), { style: 'long', type: 'conjunction' }).format(l); } catch (_) { return l.join(', '); } };

function texteFrais(px) {
  if (!px || !px.ok) return '';
  if (px.frais.etat === 'zero') return tr('q4.frais.zero');
  if (px.frais.etat === 'taux' && px.frais.montant != null) return tr('q4.frais.taux', { montant: eur(px.frais.montant), net: eur(px.net) });
  return tr('q4.frais.pasLu');
}
function textePrix(px) {
  if (!px) return '—';
  if (px.ok) return eur(px.prix);
  if (px.code === 'sous-plancher') return tr('q4.prix.sousPlancher', { plancher: eur(px.plancher && px.plancher.valeur) });
  return tr('q4.prix.pasLu');
}
// L'état d'un site après « Créer ».
function texteEtat(e) {
  if (!e) return '';
  if (e.etat === 'arrete') {
    if (e.code === 'prix-change') return tr('q4.e.prixChange', { avant: eur(e.avant), apres: eur(e.apres) });
    const cle = 'q4.e.a.' + e.code;
    const t = tr(cle);
    return t !== cle ? t : (e.raison ? tr('q4.e.arreteRaison', { raison: e.raison }) : tr('q4.e.arrete'));
  }
  return tr('q4.e.' + e.etat);
}

function LigneSite({ site, dispo, coche, onCocher, px, etat, pct, onPct, prixEbay, onPrixEbay, occupe }) {
  const possible = !!(dispo && dispo.possible);
  const st = etat && etat.etat;
  const pied = possible && !st ? (site === 'ebay'
    ? <label className="q4-prix-ebay"><span>{tr('q4.prix.ebay')}</span>
        <input type="text" inputMode="decimal" value={prixEbay} disabled={occupe} onChange={(ev) => onPrixEbay(ev.target.value)} data-q4-prix-ebay="" aria-label={tr('q4.prix.ebay')}/>
        <span aria-hidden="true">€</span></label>
    : <Segmente libelle={tr('q4.prix.pct', { site: NOM_QUATRE[site] })} valeur={String(pct)} onChange={(v) => onPct(Number(v))}
        options={PCT_AUSSI.map((k) => ({ cle: String(k), libelle: k ? '+' + k + ' %' : tr('q4.prix.meme') }))}/>) : null;
  const sous = st ? texteEtat(etat)
    : !possible ? tr(dispo ? dispo.raison : 'q4.r.lecture') + (dispo && dispo.geste ? ' · ' + tr(dispo.geste) : '')
    : [textePrix(px), texteFrais(px)].filter(Boolean).join(' · ');
  return (
    <Rangee titre={NOM_QUATRE[site]} icone={<LogoSite site={site} taille={22}/>} sousTitre={sous} sousLignes={2}
      valeur={st === 'cree' && etat.lien ? <a className="q4-voir" href={etat.lien} target="_blank" rel="noopener noreferrer" data-q4-voir={site}>{tr('q4.voir')}</a>
        : st === 'cree' ? '✓' : possible && !st && px && px.ok ? eur(px.prix) : null}
      selection={st ? null : { cochee: possible && !!coche, onChange: (v) => onCocher(site, v), libelle: tr('q4.cocher', { site: NOM_QUATRE[site] }), indisponible: !possible || occupe }}
      pied={pied}
      attrs={{ 'data-q4-site': site, 'data-q4-possible': possible ? '1' : '0', 'data-q4-code': dispo ? dispo.code : 'lecture', 'data-q4-coche': possible && coche ? '1' : '0',
        'data-q4-etat': st || '', 'data-q4-etat-code': etat && etat.code ? etat.code : undefined, 'data-q4-prix': px && px.ok ? String(px.prix) : undefined,
        'data-q4-frais': px && px.ok ? px.frais.etat : undefined }}/>
  );
}

function Champ({ champ, valeur, onChange, multiligne = false, max = 0, occupe }) {
  const id = 'q4-' + champ;
  return (
    <div className="q4-champ" data-q4-champ={champ}>
      <label htmlFor={id}>{tr('q4.c.' + champ)}{max ? <small> · {String(valeur || '').length}/{max}</small> : null}</label>
      {multiligne
        ? <textarea id={id} rows={5} value={valeur} disabled={occupe} onChange={(e) => onChange(e.target.value)}/>
        : <input id={id} type="text" value={valeur} disabled={occupe} onChange={(e) => onChange(e.target.value)}/>}
    </div>
  );
}

export default function MettreAussiSur({ ouverte = true, lecture = false, avis = '', forme = null, modifies = [], dispo = {}, prix = {}, coches = {}, etats = {}, question = null, retrait = null,
  identites = null, occupe = false, onCocher, onModifier, onCreer, onFermer, Photo = null }) {
  useLangue();
  const sites = SITES_QUATRE;
  const choisis = sites.filter((s) => coches[s] && dispo[s] && dispo[s].possible);
  const fini = sites.some((s) => etats[s]);
  const titre = tr('q4.titre');
  const pied = forme && !question ? (
    <Bouton variante="plein" onClick={onCreer} indisponible={!choisis.length || occupe || fini}
      raison={!choisis.length ? tr('q4.aucun') : ''} attrs={{ 'data-q4-creer': String(choisis.length) }}>
      {choisis.length ? tr('q4.creer', { n: choisis.length }) : tr('q4.creer0')}
    </Bouton>) : null;
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={titre} detente="pleine" pied={pied} className="q4" attrs={{ 'data-mettre-aussi': forme ? forme.source.numero : '', 'data-q4-lecture': lecture ? '1' : '0' }}>
      {lecture ? <p className="q4-note" data-q4-attente="">{tr('q4.lecture')}</p> : null}
      {!lecture && !forme && !question ? <p className="q4-note" data-q4-avis="">{avis || tr('q4.r.annonce')}</p> : null}
      {forme || question ? (
        <div className="q4-tete">
          <Vignette src={(forme && forme.photos[0]) || (question && question.photo) || ''} taille={64}/>
          <div className="q4-tete-txt">
            <span className="q4-ligne1"><Plaque numero={forme ? forme.source.numero : question.numero}/>{forme ? <span className="q4-depuis"><LogoSite site="vinted" taille={14}/> {tr('q4.depuis', { prix: eur(forme.source.prix) })}</span> : null}</span>
            <b className="q4-nom">{(forme && forme.titre) || (question && question.titre) || '—'}</b>
          </div>
        </div>) : null}
      {question ? (
        <section className="q4-retrait" data-q4-retrait={question.numero} data-q4-vendu={question.venduSur.join(' ')}>
          <p className="q4-question">{question.ailleurs.length
            ? tr('q4.retrait.q', { vendu: liste(question.venduSur), sites: liste(question.ailleurs) })
            : tr('q4.retrait.verifier', { vendu: liste(question.venduSur), sites: liste(question.aVerifier) })}</p>
          {retrait}
        </section>
      ) : null}
      {forme && !question ? (<>
          <Groupe titre={tr('q4.sites')} attrs={{ 'data-q4-sites': '' }}>
            {sites.map((s) => <LigneSite key={s} site={s} dispo={dispo[s]} coche={coches[s]} onCocher={onCocher} px={prix[s]} etat={etats[s]} occupe={occupe}
              pct={forme.prix[s] && forme.prix[s].pct != null ? forme.prix[s].pct : 0} onPct={(k) => onModifier('pct', { site: s, pct: k })}
              prixEbay={forme.prix.ebay && forme.prix.ebay.valeur != null ? String(forme.prix.ebay.valeur).replace('.', ',') : ''} onPrixEbay={(v) => onModifier('prixEbay', v)}/>)}
          </Groupe>
          {fini ? null : (
            <Groupe titre={tr('q4.fiche')} attrs={{ 'data-q4-fiche': '' }} pied={modifies.length ? tr('q4.modifies') : tr('q4.ficheVinted')}>
              <div className="q4-champs">
                <Champ champ="titre" valeur={forme.titre} max={TITRE_MAX_QUATRE.leboncoin} onChange={(v) => onModifier('titre', v)} occupe={occupe}/>
                <Champ champ="description" valeur={forme.description} multiligne onChange={(v) => onModifier('description', v)} occupe={occupe}/>
                <div className="q4-trois">
                  <Champ champ="taille" valeur={forme.taille} onChange={(v) => onModifier('taille', v)} occupe={occupe}/>
                  <Champ champ="etat" valeur={forme.etat} onChange={(v) => onModifier('etat', v)} occupe={occupe}/>
                  <Champ champ="marque" valeur={forme.marque} onChange={(v) => onModifier('marque', v)} occupe={occupe}/>
                </div>
                <div className="q4-photos" data-q4-photos={String(forme.photos.length)}>
                  <span className="q4-photos-titre">{tr('q4.c.photos', { n: forme.photos.length })}</span>
                  <div className="q4-photos-rang">
                    {forme.photos.slice(0, 24).map((u, i) => (
                      <span key={u} className="q4-photo">
                        {Photo ? <Photo src={u}/> : <img src={u} alt="" loading="lazy"/>}
                        {forme.photos.length > 1 && !occupe ? <button type="button" className="q4-photo-x" aria-label={tr('q4.photoRetirer', { n: i + 1 })}
                          onClick={() => onModifier('photos', forme.photos.filter((x) => x !== u))}>×</button> : null}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Groupe>
          )}
          {identites ? (
            <Groupe titre={tr('q4.identite')} attrs={{ 'data-q4-identites': '' }}>
              {sites.filter((s) => identites[s]).map((s) => <Rangee key={s} titre={NOM_QUATRE[s]} icone={<LogoSite site={s} taille={20}/>} sousTitre={identites[s]} sousLignes={2}
                attrs={{ 'data-q4-identite': s }}/>)}
            </Groupe>
          ) : null}
      </>) : null}
    </Feuille>
  );
}
