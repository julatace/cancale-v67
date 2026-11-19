// ── src/natif/ecrans/Fiche.jsx — LA FICHE D'UN ARTICLE, une FICHE PRODUIT (19 nov. 2026, soir) ────────────────────────
// Julien, sur la planche d'avant : « c'est de la merde la fiche de la paire » (photo de 124 px à côté d'un gros titre,
// grandes cases blanches « — à poser » : « on dirait l'app Réglages »). Direction D « fiche produit » (validée le 15 nov.,
// docs/design/maquettes-validees/fiche/) dans le style « entre Vintex et le natif » (docs/design/NATIF.md §2 bis).
// Récit : docs/passation/2026-11-19-fiche-directe.md.
//
// De haut en bas (téléphone) ; à l'ordinateur la galerie à gauche (≈ 45 %), tout le reste à droite :
//   1. LA GALERIE — pleine largeur, carrée, toutes les photos en carrousel (points), toucher = plein écran ; la plaque N°.
//   2. L'EN-TÊTE PRODUIT — titre, taille, état en étiquettes douces (« En vente sur 2 sites », « En ligne 9 jours »).
//   3. LE PRIX en très grand, à côté les pastilles « mini 70 € » « achat 40 € » « +45 € » : chacune se touche (sur place).
//   4. UN plein contextuel + « Choisir une action ▾ » (tous les gestes, une feuille) — en haut, jamais collé en bas.
//   5. Informations en tableau à filets (libellé gris / valeur) ; une valeur qui se corrige et manque = « Ajouter ».
//   6. Sites en tableau : site · compte · prix · vues · favoris · état ; toucher = l'annonce sur le site.
//   7. Histoire en frise verticale fine (dates à gauche), repliée à 3, « Tout voir ».
// La zone des messages passagers est DANS la page (src/natif/zoneMessages.js) : un message ne couvre jamais la fiche.
//
// VUE PURE : elle ne lit aucune donnée et ne porte aucune règle — elle dessine l'objet de `articleFiche`
// (src/ficheProduit.js) et les gestes que lui passe `FichePaire.jsx`. Aucun style en ligne : src/natif/fiche.css.
import React from 'react';
import { PagePoussee, Groupe, Rangee, Plaque, Bouton, Feuille, Photos, Herite, Glyphe, useOrdinateur } from '../index.js';
import { poserZoneMessages, retirerZoneMessages } from '../zoneMessages.js';
import '../fiche.css';

const HISTOIRE_REPLIEE = 3;
const PASTILLES = ['mini', 'achat', 'benefice', 'si-vendue'];
const TABLEAU = ['taille', 'quand', 'place', 'interet'];   // la taille SUE se lit dans l'en-tête (une étiquette) : le tableau ne la redit pas

// Le champ tapé SUR PLACE (prix d'achat, prix mini) : 17 px (l'iPhone ne zoome pas), Entrée ou quitter = écrire, Échap = rien.
function Champ({ libelle, depart, onValider, onFin }) {
  const [v, setV] = React.useState(depart || '');
  const fini = React.useRef(false);
  const finir = (ecrire) => { if (fini.current) return; fini.current = true; const t = String(v).trim(); if (ecrire && t && t !== String(depart || '').trim()) onValider(t); onFin(); };
  return <input className="nf-champ" data-fd-fait-champ="" autoFocus inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label={libelle} value={v} placeholder="€"
    onChange={(e) => setV(e.target.value)} onFocus={(e) => { try { e.target.select(); } catch (_) {} }} onBlur={() => finir(true)}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finir(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finir(false); } }}/>;
}

export default function Fiche({ article: A, numero = '', sans = null, titreBarre = '', libelleRetour = '', onRetour, attrs = null, textes: T, rendre, portes = {}, edition = null, setEdition,
  contexteBarre = '', plein = null, proposition = null, ligneAction = null, gestes = [], rares = [], histoire = null, achatRelie = null, blocs = {}, sansNumero = '', suiteEtat = null }) {
  const ordi = useOrdinateur();
  const [grand, setGrand] = React.useState(null);        // l'indice de la photo montrée en plein écran
  const [menu, setMenu] = React.useState(false);         // « Choisir une action »
  const [toutHist, setToutHist] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(null);      // le geste dont le contenu est montré en feuille (note, photos…)
  const [vue, setVue] = React.useState(0);               // la photo à l'écran dans le carrousel
  const defile = React.useRef(null);
  const zone = React.useRef(null);
  React.useEffect(() => { setGrand(null); setMenu(false); setToutHist(false); setOuvert(null); setVue(0); if (defile.current) defile.current.scrollLeft = 0; }, [numero]);
  React.useEffect(() => { const el = zone.current; poserZoneMessages(el); return () => retirerZoneMessages(el); }, []);

  const photos = A ? A.photos : (sans && sans.photo ? [sans.photo] : []);
  const etat = A && A.etat ? A.etat : null;
  const faits = A ? A.faits : [];
  const fait = (k) => faits.find((f) => f.cle === k) || null;
  const valeurDe = (f) => (f.cle === 'interet' ? [f.favoris, f.vues].filter((x) => x != null).join(' · ')
    : f.cle === 'taille' || f.cle === 'place' ? (f.texte || null)
    : f.cle === 'quand' ? (f.date != null ? T.date(f.date) : f.jours != null ? T.jours(f.jours) : null)
    : f.cents == null ? null : f.signe ? T.signe(f.cents) : T.euros(f.cents));
  const suDe = (f, v) => (f.cle === 'interet' ? true : v != null && v !== '');
  const porteDe = (f) => (f.porte && portes[f.porte] ? f.porte : null);
  const toucherFait = (f) => { const porte = porteDe(f); if (!porte) return; if (porte === 'achat' || porte === 'mini') setEdition(f.cle); else if (porte === 'lien') setToutHist(true); else portes[porte](f); };
  const attrsFait = (f, su, porte) => ({ 'data-fd-fait': f.cle, 'data-fd-fait-su': su ? '1' : '0', 'data-fd-fait-porte': porte || undefined, ...(T.attrsFait(f) || {}) });
  // Ce qui s'écrit à la place d'une valeur qui manque : « Ajouter » (bleu) quand elle se corrige, sinon « — » et sa raison.
  const manque = (f, porte) => (porte ? <span className="nf-ajouter">{porte === 'relier' ? T.relier : T.ajouter}</span>
    : <span className="nf-manque">{'— '}<span className="nf-raison">{f.raison ? T.raison(f.raison) : ''}</span></span>);

  // ── 3. Le prix et ses pastilles ──
  const prixF = fait('prix');
  const prixV = prixF ? valeurDe(prixF) : null;
  const prixPorte = prixF ? porteDe(prixF) : null;
  const prix = prixF ? (() => {
    const su = suDe(prixF, prixV);
    const corps = su ? <span className="nf-prix-valeur">{prixV}</span> : <span className="nf-prix-manque">{'— '}{prixF.raison ? T.raison(prixF.raison) : ''}</span>;
    const a = attrsFait(prixF, su, prixPorte);
    return prixPorte ? <button type="button" className="nf-prix" onClick={() => toucherFait(prixF)} aria-label={T.libelle(prixF.lib) + ' ' + (prixV || '')} {...a}>{corps}</button>
      : <span className="nf-prix" {...a}>{corps}</span>;
  })() : null;
  const pastille = (f) => {
    const v = valeurDe(f); const su = suDe(f, v); const porte = porteDe(f);
    const a = attrsFait(f, su, porte);
    const court = T.court(f.cle);
    if ((porte === 'achat' || porte === 'mini') && edition === f.cle) {
      return <span key={f.cle} className="nf-pastille" data-nf-saisie="" {...a}><span className="nf-pi"><span className="nf-pastille-lib">{court}</span>
        <Champ libelle={T.libelle(f.lib)} depart={f.cents == null ? '' : String(f.cents / 100).replace('.', ',')} onValider={(t) => portes[porte](f, t)} onFin={() => setEdition(null)}/></span></span>;
    }
    const benef = f.cle === 'benefice' || f.cle === 'si-vendue';
    // La pastille se voit à 32 px ; le bouton qui la porte fait 44 (la cible au doigt).
    const contenu = <span className="nf-pi">{su
      ? <>{benef ? null : <span className="nf-pastille-lib">{court}</span>}<span className="nf-pastille-val">{v}</span>{f.partiel ? <span className="nf-pastille-lib">{T.auPlus}</span> : null}</>
      : <><span className="nf-pastille-lib">{court}</span>{manque(f, porte)}</>}</span>;
    const ton = benef && su && f.cents != null ? (f.cents < 0 ? 'negatif' : 'positif') : su ? 'neutre' : porte ? 'porte' : 'vide';
    return porte
      ? <button key={f.cle} type="button" className="nf-pastille" data-nf-ton={ton} onClick={() => toucherFait(f)} aria-label={T.libelle(f.lib) + ' ' + (su ? v : T.ajouter)} {...a}>{contenu}</button>
      : <span key={f.cle} className="nf-pastille" data-nf-ton={ton} {...a}>{contenu}</span>;
  };
  const pastilles = PASTILLES.map(fait).filter(Boolean);

  // ── 2. L'en-tête : titre, taille, étiquettes d'état ──
  const tailleF = fait('taille');
  const quandF = fait('quand');
  const quandV = quandF ? valeurDe(quandF) : null;
  const ligneSeule = !proposition && ligneAction ? ligneAction : null;

  // ── 5. Le tableau des informations ──
  // La taille et la date SUES sont des étiquettes de l'en-tête : le tableau ne les redit pas (pas sues, il dit pourquoi).
  const lignesInfos = TABLEAU.map(fait).filter((f) => f && !((f.cle === 'taille' || f.cle === 'quand') && suDe(f, valeurDe(f))));

  // ── 7. L'histoire ──
  const tous = histoire ? histoire.lignes : [];
  const etapes = toutHist ? tous : tous.slice(-HISTOIRE_REPLIEE);

  // ── 4. Les gestes, dans « Choisir une action » (le rare aussi : rien n'y est une information) ──
  const toucher = (g) => { setMenu(false); if (g.contenu) setOuvert(g); else if (g.onClick) g.onClick(); };
  const tousGestes = gestes.concat(rares);
  const rangeeGeste = (g) => <Rangee key={g.cle} icone={rendre.icone(g.icone, 22)} titre={g.libelle} fin="chevron" onClick={() => toucher(g)} attrs={{ 'data-fd-tuile': g.cle, ...(g.attrs || {}) }}/>;
  const aActions = tousGestes.length > 0 || !!blocs.vendueAilleurs;

  const surDefile = () => { const el = defile.current; if (!el || !el.clientWidth) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== vue) setVue(i); };
  const allerPhoto = (i) => { const el = defile.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };

  const galerie = (
    <div className="nf-galerie" data-nf-sans={photos.length ? undefined : '1'} data-fiche-heros={contexteBarre || 'numero'} data-fiche-photo-vedette={photos.length ? '1' : '0'}>
      <div className="nf-defile" ref={defile} onScroll={surDefile} data-fiche-heros-photo={photos.length ? '1' : '0'} data-fd-photo-agrandir={photos.length}>
        {photos.length ? photos.map((s, i) => (
          <button key={s + i} type="button" className="nf-photo" onClick={() => setGrand(i)} aria-label={photos.length > 1 ? T.photoN(i + 1, photos.length) : T.agrandir}>{rendre.photo(s)}</button>
        )) : <span className="nf-photo nf-photo-vide"><Glyphe nom="image" taille={48}/></span>}
      </div>
      {A ? <span className="nf-plaque" data-fiche-grand-num=""><Plaque numero={A.num} doublon={A.double} grand/></span>
        : sansNumero ? <span className="nf-plaque" data-fiche-grand-num="" data-fiche-sans-num="">{sansNumero}</span> : null}
      {photos.length > 1 ? <div className="nf-points" role="group" aria-label={T.voirPhotos(photos.length)} data-nf-points="">
        {photos.map((s, i) => <button key={s + i} type="button" className="nf-point" data-nf-actif={i === vue ? '1' : undefined} aria-label={T.photoN(i + 1, photos.length)} onClick={() => allerPhoto(i)}/>)}
      </div> : null}
      {photos.length > 1 && ordi ? <div className="nf-miniatures">{photos.map((s, i) => <button key={s + i} type="button" className="nf-miniature" data-nf-actif={i === vue ? '1' : undefined} aria-label={T.photoN(i + 1, photos.length)} onClick={() => allerPhoto(i)}>{rendre.photo(s)}</button>)}</div> : null}
    </div>
  );

  const titre = A ? T.titre : (sans && sans.titre) || T.sansTitre;
  return (
    <PagePoussee ouverte titre={titreBarre} libelleRetour={libelleRetour} onRetour={onRetour} className="n-fiche" attrs={attrs}>
      <div className="nf-messages" ref={zone} data-fiche-messages=""/>
      <div className="nf" data-nf-ordi={ordi ? '1' : undefined} data-nf-titre-long={typeof titre === 'string' && titre.length > 70 ? '1' : undefined}>
        {A || sans ? galerie : null}
        <div className="nf-infos">
          {A || sans ? <header className="nf-tete">
            <h2 className="nf-titre" title={typeof titre === 'string' ? titre : undefined} data-fd-titre="">{titre}</h2>
            <div className="nf-etiquettes">
              {etat ? <span className="nf-etiquette" data-nf-ton={etat.rouge ? 'doublon' : etat.ambre ? 'ambre' : 'neutre'} data-fd-etat={etat.cle} data-fd-ambre={etat.ambre ? '1' : '0'} data-fd-limite={etat.limite ? (etat.limite.jour || '') : undefined}>{T.etat(etat)}</span>
                : sans && sans.prix ? <span className="nf-etiquette" data-fd-etat="sans">{sans.prix}</span> : null}
              {quandF && suDe(quandF, quandV) ? <span className="nf-etiquette" {...attrsFait(quandF, true, null)}>{T.libelle(quandF.lib) + ' ' + quandV}{quandF.auMoins ? ' ' + T.auMoins : ''}</span> : null}
              {tailleF && suDe(tailleF, valeurDe(tailleF)) ? <span className="nf-etiquette" data-nf-taille="" {...attrsFait(tailleF, true, null)}>{T.libelle(tailleF.lib) + ' ' + valeurDe(tailleF)}</span> : null}
              {suiteEtat}
            </div>
          </header> : null}
          {prix || pastilles.length ? <div className="nf-prixbloc">
            {prix}
            {pastilles.length ? <div className="nf-pastilles" data-fd-faits={faits.map((f) => f.cle).join(',')} data-fd-vue-argent={faits.filter((f) => ['achat', 'benefice', 'si-vendue'].includes(f.cle)).map((f) => f.cle).join(',')}>{pastilles.map(pastille)}</div> : null}
          </div> : null}
          {plein || aActions ? <div className="nf-actions" data-nf-un={plein ? undefined : '1'}>
            {plein ? <Bouton variante="plein" icone={plein.icone ? rendre.icone(plein.icone, 20) : null} onClick={plein.onClick} attrs={{ 'data-fd-plein': '', ...(plein.attrs || {}) }}>{plein.libelle}</Bouton> : null}
            {aActions ? <button type="button" className="nf-choisir" onClick={() => setMenu(true)} aria-haspopup="dialog" data-fd-actions-ouvrir="">
              <span>{T.choisirAction}</span><span className="nf-choisir-fleche" aria-hidden="true"><Glyphe nom="chevron" taille={16}/></span></button> : null}
          </div> : null}
          {ligneSeule ? <p className="nf-situe" data-nf-ton={ligneSeule.ambre ? 'ambre' : 'neutre'} data-fd-ligne-action="" {...(ligneSeule.attrs || {})}>{[ligneSeule.titre, ligneSeule.valeur].filter(Boolean).join(' · ')}</p> : null}
          {proposition ? <Groupe titre={T.achatPropose} attrs={{ 'data-fd-action-contexte': '' }}>
            <Rangee vignette={rendre.vignette(proposition.photo)} titre={proposition.titre} lignes={2} sousTitre={proposition.sous} attrs={proposition.attrs}/>
            {proposition.onAutre ? <Rangee titre={T.autreAchat} fin="chevron" onClick={proposition.onAutre} attrs={{ 'data-fd-relier-autre': '' }}/> : null}
            {ligneAction ? <Rangee titre={ligneAction.titre} valeur={ligneAction.valeur || null} ton={ligneAction.ambre ? 'ambre' : 'neutre'} sousTitre={ligneAction.sous || ''} attrs={ligneAction.attrs}/> : null}
          </Groupe> : null}
          {blocs.alerte || null}
          {blocs.noteLue ? <Herite nu attrs={{ 'data-fd-note-lue': '' }}>{blocs.noteLue}</Herite> : null}
          {blocs.sansPaire || null}
          {blocs.questions ? <Herite nu attrs={{ 'data-fd-questions': '' }}>{blocs.questions}</Herite> : null}

          {lignesInfos.length ? <section className="nf-section" aria-label={T.infos}>
            <h3 className="nf-section-titre">{T.infos}</h3>
            <dl className="nf-tableau" data-nf-infos="">
              {lignesInfos.map((f) => {
                const v = valeurDe(f); const su = suDe(f, v); const porte = porteDe(f);
                const a = attrsFait(f, su, porte);
                const valeur = su ? <span className="nf-valeur">{v}</span> : manque(f, porte);
                return <div key={f.cle} className="nf-ligne">
                  <dt className="nf-lib">{T.libelle(f.lib)}</dt>
                  <dd className="nf-val">{porte ? <button type="button" className="nf-val-touche" onClick={() => toucherFait(f)} {...a}>{valeur}</button> : <span {...a}>{valeur}</span>}</dd>
                </div>;
              })}
            </dl>
          </section> : null}

          {A && !A.double ? <section className="nf-section" aria-label={T.sites} data-fd-sites={A.sites.length} data-fiche-sites={A.sites.length} data-fd-sites-pas-lus={A.sitesManques && A.sitesManques.length ? A.sitesManques.join(',') : undefined}>
            <h3 className="nf-section-titre">{T.sites}</h3>
            {A.sites.length ? <div className="nf-sites" role="table" aria-label={T.sites}>
              <div className="nf-site nf-site-tete" role="row">
                <span role="columnheader" className="nf-c-site">{T.col.site}</span><span role="columnheader" className="nf-c-compte">{T.col.compte}</span>
                <span role="columnheader" className="nf-c-num">{T.col.prix}</span><span role="columnheader" className="nf-c-num nf-c-vues">{T.col.vues}</span>
                <span role="columnheader" className="nf-c-num">{T.col.favoris}</span><span role="columnheader" className="nf-c-etat">{T.col.etat}</span>
              </div>
              {A.sites.map((s, i) => {
                const lien = s.lien && s.etat !== 'vendue' ? s.lien : '';
                const Tag = lien ? 'a' : 'div';
                const nb = (x) => (Number.isFinite(x) ? String(x) : '—');
                return <Tag key={i} className="nf-site" role="row" {...(lien ? { href: lien, target: '_blank', rel: 'noreferrer', 'data-fiche-site-lien': '' } : {})} data-fiche-site={s.site} data-fiche-site-etat={s.etat}>
                  <span role="cell" className="nf-c-site"><span className="nf-logo">{rendre.logo(s.site)}</span><span className="nf-site-nom">{T.site(s.site)}</span></span>
                  <span role="cell" className="nf-c-compte"><span className="nf-compte-site">{T.site(s.site) + (s.compte ? ' · ' : '')}</span>{s.compte || <span className="nf-compte-vide">—</span>}</span>
                  <span role="cell" className="nf-c-num nf-c-prix">{s.prix != null ? T.euros(s.prix) : '—'}</span>
                  <span role="cell" className="nf-c-num nf-c-vues" data-nf-vide={Number.isFinite(s.vues) ? undefined : '1'}>{nb(s.vues)}</span>
                  <span role="cell" className="nf-c-num nf-c-fav" data-nf-vide={Number.isFinite(s.favoris) ? undefined : '1'}><span className="nf-coeur" aria-hidden="true">♡</span>{nb(s.favoris)}</span>
                  <span role="cell" className="nf-c-etat"><span className="nf-etat-site" data-nf-ton={s.etat === 'vendue' ? 'vendue' : 'enligne'}>{T.etatSite(s)}</span></span>
                </Tag>;
              })}
            </div> : <p className="nf-vide">{T.aucunSite}</p>}
            {A.sitesManques && A.sitesManques.length ? <p className="nf-pied">{T.pasLus(A.sitesManques.join(', '))}</p> : null}
          </section> : null}

          {histoire ? <section className="nf-section" aria-label={T.histoire} data-fd-histoire={toutHist ? 'tout' : 'repliee'} data-fiche-hist={tous.length}>
            <h3 className="nf-section-titre">{T.histoire}</h3>
            <ol className="nf-frise">
              {etapes.map((l) => <li key={l.cle} className="nf-etape" data-nf-ton={l.ambre ? 'ambre' : undefined} data-fiche-hist-etape={l.cle}>
                <span className="nf-etape-date">{l.date || ''}</span>
                <span className="nf-etape-point" aria-hidden="true"/>
                <span className="nf-etape-texte"><span className="nf-etape-titre">{l.titre}{l.montant ? <b className="nf-etape-montant">{' · ' + l.montant}</b> : null}</span>{l.reste ? <span className="nf-etape-detail">{l.reste}</span> : null}</span>
              </li>)}
            </ol>
            {toutHist && achatRelie ? <div className="nf-liens">
              {achatRelie.recu ? <button type="button" className="nf-lien" onClick={achatRelie.onRecu} data-fd-recu={achatRelie.tx}>{T.recu}</button> : null}
              <button type="button" className="nf-lien" onClick={achatRelie.onDelier} data-fd-delier={achatRelie.tx} data-fd-achat-relie={achatRelie.tx}>{T.delier}</button>
            </div> : null}
            {tous.length > HISTOIRE_REPLIEE || blocs.toutVoir ? <button type="button" className="nf-lien nf-tout" onClick={() => setToutHist((x) => !x)} data-fd-tout-voir="" aria-expanded={toutHist ? 'true' : 'false'}>{toutHist ? T.replier : T.toutVoir}</button> : null}
          </section> : null}
          {histoire && toutHist && blocs.toutVoir ? <Herite attrs={{ 'data-fiche-plus': '' }}>{blocs.toutVoir}</Herite> : null}
          {blocs.contexte || null}
          {blocs.actions || null}
          {blocs.lecture || null}
        </div>
      </div>

      <Feuille ouverte={grand != null && photos.length > 0} onFermer={() => setGrand(null)} titre={A ? T.titre : ''} detente="pleine" attrs={{ 'data-fd-visionneuse': photos.length }}>
        <Photos sources={grand ? photos.slice(grand).concat(photos.slice(0, grand)) : photos} rendre={rendre.photo}/>
      </Feuille>
      <Feuille ouverte={menu} onFermer={() => setMenu(false)} titre={T.choisirAction} attrs={{ 'data-fd-plus': menu ? '1' : '0', 'data-fd-actions': menu ? '1' : '0' }}>
        {tousGestes.length ? <Groupe attrs={{ 'data-fd-tuiles': tousGestes.map((g) => g.cle).join(',') }}>{tousGestes.map(rangeeGeste)}</Groupe> : null}
        {blocs.vendueAilleurs ? <Herite nu attrs={{ 'data-fd-gestes': '' }}>{blocs.vendueAilleurs}</Herite> : null}
      </Feuille>
      <Feuille ouverte={!!ouvert} onFermer={() => setOuvert(null)} titre={ouvert ? ouvert.libelle : ''} detente="pleine" attrs={{ 'data-fd-tuile-vue': ouvert ? ouvert.cle : '' }}>
        {ouvert ? <Herite>{ouvert.contenu}</Herite> : null}
      </Feuille>
    </PagePoussee>
  );
}
