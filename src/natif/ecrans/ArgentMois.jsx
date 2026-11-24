// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · MOIS — « comme Vintex » (21 nov., lot argent-vintex ; remplace la version du 20 nov., lot argent-natif).
//  Julien, 21 nov. (captures iPhone) : « je veux que tout soit mieux, refonds toute l'application dans le style de
//  Vintex, pratique, bien compréhensible ». Défauts relevés sur SES captures, et ce qui les remplace :
//    · « Saisir 13 prix d'achat » (gros plein) juste au-dessus de « 2 sur 15 coûts saisis » : deux chiffres pour UNE
//      chose ⇒ UNE phrase, sous le bénéfice, « 13 prix d'achat à saisir sur 15 » (la même source `Bn` : 15 − 2), et la
//      rangée entière est la porte (le chiffre faux est la porte, §5) ; plus de plein sur Mois ;
//    · tuiles en grille qui coupaient les montants ⇒ des RANGÉES fines : libellé à gauche, montant à droite, jamais
//      coupé (`white-space: nowrap`, la colonne du montant ne rétrécit pas) ;
//    · « au moins · reçus en novembre · Daté au jour du versement » sur trois lignes ⇒ UNE ligne ; la règle de datation
//      est dans le « ? » de la carte ; le manque (la note de la règle) reste dit quand il existe (couverture nommée) ;
//    · six barres J J A S O N sans valeur ⇒ six rangées « mois · barre · montant » (chaque montant écrit) ;
//    · titres de versements coupés et « acheté 100 € … » tronqué ⇒ titre sur deux lignes, « 18 nov. · Vinted · acheté
//      100 € » court, la marge sous le montant ; à l'ordinateur, un vrai tableau (N° · Article · Jour · Site · Achat ·
//      Marge · Reçu) ;
//    · « Comptes · 11 › » qui flottait à droite ⇒ la dernière rangée du groupe des chiffres.
//  AUCUN calcul ici : tout arrive calculé de src/ecrans/Compta.jsx (`ArgentMoisV2`) par les MÊMES règles qu'hier
//  (`valeurChiffre`, `questionsArgent`, `recuPublieEntre`, `recettesDe`). Les data-v2-argent-* d'hier restent (bancs) ;
//  les data-arg-* neufs portent ce que le banc argent-vintex mesure.
//  Trois états : `encours` (squelette de la forme exacte) · `passu` (« — » + la raison) · lu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Carte, Plaque, Attente, useOrdinateur, TIRET } from '../index.js';
import { AideArgent } from './AideArgent.jsx';
import './argent.css';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
// « 1 107 € » ⇒ [« 1 107 », « € »] : l'unité est posée à côté du chiffre.
const coupe = (t) => { const m = /^(.*?)[\s  ]*€$/.exec(String(t)); return m ? [m[1], '€'] : [String(t), '']; };
const majuscule = (t) => { const x = String(t || ''); return x ? x.charAt(0).toLocaleUpperCase() + x.slice(1) : x; };
const signe = (m, montant) => (m > 0 ? '+' : m < 0 ? '−' : '') + montant(Math.abs(m));

// Une rangée de chiffre : libellé (et sa ligne grise) à gauche, montant à droite. Toute la rangée se touche.
function Ligne({ libelle, valeur, sous = null, tonSous = 'neutre', onClick = null, chevron = true, attrs = null, attrsValeur = null }) {
  const corps = (
    <>
      <span className="n-arg-l-textes">
        <span className="n-arg-l-lib">{libelle}</span>
        {sous ? <span className="n-arg-l-sous" data-n-ton={tonSous}>{sous}</span> : null}
      </span>
      <span className="n-arg-l-val" data-arg-montant="" data-n-vide={valeur == null ? '1' : undefined} {...(attrsValeur || {})}>{valeur == null ? TIRET : valeur}</span>
      {onClick && chevron ? <span className="n-arg-l-chev" aria-hidden="true"/> : null}
    </>
  );
  return onClick
    ? <button type="button" className="n-arg-l n-arg-l-touche" data-arg-rangee="" onClick={onClick} {...(attrs || {})}>{corps}</button>
    : <div className="n-arg-l" data-arg-rangee="" {...(attrs || {})}>{corps}</div>;
}

export default function ArgentMois({ poster, phrase, note = '', moisLong, barres, faits, geste, versements, montant, vendu = null, comptes = null, sansBarres = false, onPasSu = null }) {
  const ordi = useOrdinateur();
  const [tout, setTout] = React.useState(false);
  const MONTRES = ordi ? 30 : 8;   // le téléphone reste court ; « Voir les 29 » déplie le reste (rien n'est caché sans le dire)
  const { valeur, partiel } = poster;
  const [n, u] = valeur == null ? [null, ''] : coupe(montant(valeur));
  const courant = barres.find((x) => x.courant) || barres[barres.length - 1] || null;
  const max = Math.max(0, ...barres.map((x) => (x.v > 0 ? x.v : 0)));
  const F = Object.fromEntries(faits.map((f) => [f.id, f]));
  const C = F.couts;
  // Le bénéfice et ses prix d'achat : UNE phrase, d'UNE source (`geste.n` = manquent = n − nCout ; `geste.sur` = n).
  const prix = geste ? <span data-arg-prix-phrase="" data-arg-prix-manque={String(geste.n)} data-arg-prix-sur={String(geste.sur)}>
    {tr('arn.prixASaisir', { n: geste.n, sur: geste.sur })}</span> : null;
  const fait = (f, libelle, extra = {}) => {
    if (!f) return null;
    return <Ligne key={f.id} libelle={libelle || f.l} valeur={f.pasSu ? null : f.v} onClick={extra.onClick || f.onClick}
      sous={extra.sous !== undefined ? extra.sous : f.pasSu ? (f.sous || tr('v2.ar.pasSu')) : f.auMoins ? tr('journee.moins') : ''} tonSous={extra.ton || 'neutre'}
      attrs={{ 'data-v2-argent-fait': f.id, 'data-v2-argent-valeur': f.cents, 'data-v2-pas-su': f.pasSu ? '' : undefined, ...(extra.attrs || {}) }}/>;
  };
  const B = F.benefice;
  const sousBenef = B && !B.pasSu && B.auMoins ? tr('journee.moins') : B && B.pasSu ? (B.sous || tr('v2.ar.pasSu')) : '';
  const lignesV = versements.etat === 'lu' ? (tout ? versements.lignes : versements.lignes.slice(0, MONTRES)) : [];
  // (23 nov., revue UX P2) À l'ordinateur, une colonne vide à 100 % (N°, Achat, Marge) n'est pas dessinée ; la couverture des prix
  // d'achat est dite au-dessus du tableau (« Prix d'achat connus : 0/27 · Saisir »), le chiffre faux étant la porte (§5).
  const toutes = versements.etat === 'lu' ? versements.lignes : [];
  const colVide = ordi && toutes.length ? { num: toutes.every((l) => !l.num), achat: toutes.every((l) => l.achat == null), marge: toutes.every((l) => l.achat == null || l.marge == null) } : {};
  const LARG = { num: '72px', article: 'minmax(0, 1fr)', jour: '72px', site: '96px', achat: '88px', marge: '88px', recu: '96px' };
  const colonnesVt = ['num', 'article', 'jour', 'site', 'achat', 'marge', 'recu'].filter((k) => !colVide[k]).map((k) => LARG[k]).join(' ');
  const meta = (l) => [l.date, l.plateforme, l.achat != null ? tr('v2.ar.achete', { p: montant(l.achat) }) : ''].filter(Boolean).join(' · ');
  return (
    <section className="n-arg n-arg-mois n-arg-vx" data-v2-argent-mois="" data-arg-vintex="" aria-label={tr('v2.ar.seg.resume')}>
      <div className="n-arg-col">
        {/* 1. Le reçu du mois, en grand, et les six mois en rangées chiffrées. */}
        <Carte className="n-arg-affiche" attrs={{ 'data-v2-argent-recu': cents(valeur), 'data-v2-argent-partiel': partiel ? '1' : undefined, 'data-v2-argent-phrase': '' }}>
          <div className="n-arg-recu">
            <div className="n-arg-recu-haut" data-arg-recu-pas-calcule={valeur == null && onPasSu ? '1' : undefined}>
              {valeur == null && onPasSu
                ? <button type="button" className="n-arg-recu-geste" data-arg-recu-geste="" data-arg-recu-note="" data-n-ton="ambre" data-arg-montant="" data-n-vide="1" onClick={onPasSu}>
                    <span className="n-arg-recu-geste-point" aria-hidden="true"/><span className="n-arg-recu-geste-texte">{tr('arn.recuEn', { mois: moisLong }) + ' : ' + phrase}</span><span className="n-arg-l-chev" aria-hidden="true"/></button>
                : <span className="n-arg-recu-lib" data-arg-recu-lib="">{tr('arn.recuEn', { mois: moisLong })}</span>}
              <AideArgent titre={tr('arn.comment')} attrs={{ 'data-arg-aide-recu': '' }}>
                <p>{tr('v2.ar.auVersement')}.</p>
                <p>{tr('arn.aideRecu')}</p>
              </AideArgent>
            </div>
            {/* (23 nov., revue UX #15) Pas encore calculé : plus de grand « — » ni de six mois vides — UNE ligne ambre, la phrase de la
                MÊME règle (`phrase`), et elle se touche (le geste : ouvrir Ventes). */}
            {valeur == null ? (onPasSu
              ? null
              : <p className="n-arg-recu-note" data-arg-recu-note="" data-arg-montant="" data-n-vide="1" data-n-ton="ambre">{majuscule(phrase)}</p>) : <>
            <div className="n-arg-recu-chiffre" data-arg-montant="" data-n-vide={n == null ? '1' : undefined}>
              {partiel && valeur != null ? <span className="n-arg-recu-moins">{tr('journee.moins')}</span> : null}
              <span className="n-arg-recu-n">{n == null ? TIRET : n}</span>{u ? <span className="n-arg-recu-u">{u}</span> : null}
            </div>
            {/* Le manque (la note de la MÊME règle), en une ligne ; sans manque, rien (la datation est dans le « ? »). */}
            {note ? <p className="n-arg-recu-note" data-arg-recu-note="">{phrase}</p> : null}
            </>}
          </div>
          {sansBarres || !barres.some((x) => x.v != null) ? null : (
            <ol className="n-arg-mois6" aria-label={tr('v2.ar.graphe')} data-arg-mois={String(barres.length)}
              data-v2-argent-barres={barres.map((x) => cents(x.v)).join(',')} data-v2-argent-barre-v={courant ? cents(courant.v) : ''}>
              {barres.map((x) => {
                const h = x.v > 0 && max > 0 ? Math.max(2, Math.round((x.v / max) * 100)) : 0;
                return (
                  <li key={x.cle} className="n-arg-m6" data-arg-m6={x.cle} data-arg-m6-v={cents(x.v)} data-courant={x.courant ? '1' : undefined}
                    data-arg-m6-partiel={x.partiel ? '1' : undefined} data-arg-m6-adater={x.aDater > 0 ? String(x.aDater) : undefined} title={x.aDater > 0 ? tr('arn.aDaterPourquoi') : undefined}>
                    <span className="n-arg-m6-nom">{x.long.replace(/\s+\d{4}$/, '')}</span>
                    <span className="n-arg-m6-piste" aria-hidden="true"><span className="n-arg-m6-plein" style={{ width: h + '%' }}/></span>
                    <span className="n-arg-m6-v" data-arg-montant="">{x.v == null ? TIRET : (x.partiel ? tr('journee.moins') + ' ' : '') + montant(x.v)}{x.aDater > 0 ? <span className="n-arg-m6-adater">{tr('arn.aDaterN', { n: x.aDater })}</span> : null}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Carte>
        {/* 2. Le mois en chiffres : des rangées fines, le montant à droite. */}
        <Carte titre={tr('arn.chiffres', { mois: moisLong })} className="n-arg-lignes" attrs={{ 'data-v2-argent-faits': String(faits.filter((f) => !f.pasSu).length + (vendu && vendu.valeur != null ? 1 : 0)) }}>
          {vendu ? <Ligne libelle={tr('arn.vendu')} valeur={vendu.valeur == null ? null : montant(vendu.valeur)} onClick={vendu.onClick}
            sous={vendu.valeur == null ? (vendu.note || tr('v2.ar.pasSu')) : vendu.partiel ? tr('journee.moins') : ''} attrs={{ 'data-arg-vendu': cents(vendu.valeur) }}/> : null}
          {B ? <Ligne libelle={B.l} valeur={B.pasSu ? null : B.v} onClick={geste ? geste.onClick : B.onClick}
            sous={prix || sousBenef} tonSous={geste ? 'ambre' : 'neutre'}
            attrs={{ 'data-v2-argent-fait': 'benefice', 'data-v2-argent-valeur': B.cents, 'data-v2-pas-su': B.pasSu ? '' : undefined, 'data-benef-notion': B.connu ? 'connu' : B.brut ? 'brut' : 'benefice', 'data-arg-net-connu': B.connu ? `${B.nCout}/${B.n}` : undefined,
              'data-v2-argent-geste': geste ? String(geste.n) : undefined, 'data-v2-principal': geste ? geste.id : undefined }}/> : null}
          {fait(F.attente, tr('arn.aVenir'))}
          {fait(F.dispo)}
          {comptes ? <Ligne libelle={tr('arn.comptes')} valeur={comptes.texte} onClick={comptes.onClick} attrs={{ 'data-v2-argent-comptes': comptes.dedans == null ? '' : String(comptes.dedans), 'data-arg-comptes-ligne': '' }}/> : null}
        </Carte>
        {/* La couverture des coûts reste lisible des bancs (k/n), sans redire un chiffre à l'écran. */}
        {C ? <span hidden data-v2-argent-fait="couts" data-v2-argent-valeur={C.cents}/> : null}
        <span hidden data-v2-argent-passu={faits.filter((f) => f.pasSu).map((f) => f.id).join(' ')}/>
      </div>
      <div className="n-arg-col">
        {/* 3. Les versements du mois : téléphone = rangées (N°, titre sur deux lignes, jour · site · acheté, montant et marge) ;
            ordinateur = un tableau à colonnes. */}
        <Carte titre={tr('v2.ar.versements', { mois: moisLong })} n={versements.etat === 'lu' && versements.n ? String(versements.n) : null} className="n-arg-vers"
          attrs={{ 'data-v2-argent-versements': versements.etat === 'encours' ? 'encours' : versements.etat === 'passu' ? 'passu' : String(versements.n) }}>
          {versements.etat === 'encours' ? <Attente forme="rangees" n={3}/>
            : versements.etat === 'passu' ? <p className="n-arg-vide">{tr('v2.ar.versementsPasSu')}</p>
            : !versements.lignes.length ? <p className="n-arg-vide">{tr('v2.ar.aucunVersement', { mois: moisLong })}</p>
            : (
              <div className="n-arg-vt" role="table" aria-label={tr('v2.ar.versements', { mois: moisLong })} data-arg-cols-vides={Object.keys(colVide).filter((k) => colVide[k]).join(',') || undefined}
                style={ordi ? { '--n-arg-vt-cols': colonnesVt } : undefined}>
                {ordi && colVide.achat ? (geste
                  ? <button type="button" className="n-arg-vt-couverture" data-arg-prix-connus={`0/${versements.lignes.length}`} onClick={geste.onClick}>{tr('ru.argent.prixConnus', { k: 0, n: versements.lignes.length })}<span className="n-arg-l-chev" aria-hidden="true"/></button>
                  : <p className="n-arg-vt-couverture" data-arg-prix-connus={`0/${versements.lignes.length}`}>{tr('ru.argent.prixConnusSans', { k: 0, n: versements.lignes.length })}</p>) : null}
                {ordi ? (
                  <div className="n-arg-vt-tr n-arg-vt-th" role="row">
                    {['num', 'article', 'jour', 'site', 'achat', 'marge', 'recu'].filter((k) => !colVide[k]).map((k) => <span key={k} role="columnheader" className={'n-arg-vt-' + k}>{tr('arn.col.' + k)}</span>)}
                  </div>
                ) : null}
                {lignesV.map((l) => {
                  const Tag = l.num ? 'button' : 'div';
                  return (
                    <Tag key={l.id} {...(l.num ? { type: 'button', onClick: l.onClick } : {})} role="row" className="n-arg-vt-tr"
                      data-v2-argent-versement={l.id} data-eur={cents(l.montant)}
                      data-v2-argent-achat={l.achat != null ? cents(l.achat) : undefined} data-v2-argent-marge={l.achat != null ? cents(l.marge) : undefined}>
                      {colVide.num ? null : <span role="cell" className="n-arg-vt-num">{l.num ? <Plaque numero={l.num}/> : <span className="n-arg-gris">{TIRET}</span>}</span>}
                      <span role="cell" className="n-arg-vt-article">
                        <span className="n-arg-vt-titre">{l.titre || tr('v2.ar.venteSans', { plateforme: l.plateforme || '' })}</span>
                        {ordi ? null : <span className="n-arg-vt-meta" data-arg-vt-meta="">{meta(l)}</span>}
                      </span>
                      {ordi ? <>
                        <span role="cell" className="n-arg-vt-jour">{l.date}</span>
                        <span role="cell" className="n-arg-vt-site">{l.plateforme}</span>
                        {colVide.achat ? null : <span role="cell" className="n-arg-vt-achat" data-arg-montant="">{l.achat != null ? montant(l.achat) : TIRET}</span>}
                        {colVide.marge ? null : <span role="cell" className="n-arg-vt-marge" data-arg-montant="">{l.achat != null && l.marge != null ? signe(l.marge, montant) : TIRET}</span>}
                      </> : null}
                      <span role="cell" className="n-arg-vt-recu">
                        <span className="n-arg-vt-montant" data-arg-montant="">{l.montant == null ? TIRET : montant(l.montant)}</span>
                        {!ordi && l.achat != null && l.marge != null ? <span className="n-arg-vt-marge-tel" data-arg-montant="">{signe(l.marge, montant)}</span> : null}
                      </span>
                    </Tag>
                  );
                })}
              </div>
            )}
          {versements.etat === 'lu' && !tout && versements.lignes.length > MONTRES
            ? <Ligne libelle={tr('arn.voirTous', { n: versements.lignes.length })} valeur="" onClick={() => setTout(true)} attrs={{ 'data-arg-voir-tous': String(versements.lignes.length) }}/> : null}
          {versements.etat === 'lu' && (tout || ordi) && versements.reste > 0 ? <p className="n-arg-vide">{tr('v2.ar.autres', { n: versements.reste })}</p> : null}
        </Carte>
      </div>
    </section>
  );
}
