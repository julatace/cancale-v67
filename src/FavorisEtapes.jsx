// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES AUX FAVORIS — LA PAGE EN TROIS TEMPS (11 nov., lot `favoris-clair`)
// Julien : « les messages aux favoris, on peut faire en sorte que ce soit
// BEAUCOUP plus beau et plus COMPRÉHENSIBLE ? »
//   1. QUI   : les annonces qui ont des favoris, le NOMBRE de personnes (jamais
//              qui) ; on touche une annonce pour la choisir ;
//   2. QUOI  : le message et l'offre, l'aperçu tel que l'acheteur le verra ;
//   3. QUAND : maintenant, au rythme « comme Vintex » ou espacé ; le mode auto ;
// puis le récapitulatif (« 10 messages · 3 annonces · environ 1 min · dans la
// limite de 45 gestes par heure ») et « Envoyer » — SON clic. Le suivi en direct
// est la feuille commune « VRM travaille » (SuiviTravail). L'historique dit qui
// a acheté après un message, par identité seulement (favorisParcours.js).
// Présentation seulement : l'état vit dans FavorisVinted.jsx, l'envoi dans la
// file serveur et l'extension (aucun garde-fou n'est ici).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, date } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import './design/favoris-clair.css';

const eur = (x) => (x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €');
export function texteDuree(sec) {
  if (sec == null) return '—';
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return tr('favoris.duree.secondes', { n: Math.max(1, s) });
  if (s < 3600) return tr('favoris.duree.minutes', { n: Math.round(s / 60) });
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return m ? tr('favoris.duree.heuresMinutes', { h, m }) : tr('favoris.duree.heures', { n: h });
}
const jour = (t) => (t ? date(t, { day: 'numeric', month: 'short' }) : '—');

function Photo({ src, PhotoVinted, taille = 48 }) {
  const vide = <span className="vrm-fc-photo-vide" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg></span>;
  return <span className="vrm-fc-photo" style={{ '--t': taille + 'px' }}>{src && PhotoVinted ? <PhotoVinted src={src} alt="" loading="lazy" repli={vide} /> : vide}</span>;
}
function Tete({ n, titre, resume, droite }) {
  return <div className="vrm-fc-etape-tete">
    <span className="vrm-fc-num" aria-hidden="true">{n}</span>
    <h3>{titre}</h3>
    {resume != null && <span className="vrm-fc-resume">{resume}</span>}
    {droite}
  </div>;
}
function Segment({ label, options, value, onChange, disabled, attr }) {
  return <div className="vrm-fc-seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} disabled={disabled} {...(attr ? { [attr]: v } : {})} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

// Une ligne de QUI : jamais un pseudo, le NOMBRE de personnes.
function LigneAnnonce({ a, choisie, onBasculer, PhotoVinted, verrou }) {
  const etat = a.vendu ? tr('favoris.qui.vendu') : a.enCours ? tr('favoris.qui.enCours') : a.aEcrire.length ? tr('favoris.qui.aEcrire', { n: a.aEcrire.length }) : a.aVerifier ? tr('favoris.qui.aVerifier') : a.envoyes ? tr('favoris.qui.dejaEcrit') : tr('favoris.qui.rienAEcrire');
  const corps = <>
    {a.choisissable && <span className={'vrm-fc-coche' + (choisie ? ' is-on' : '')} aria-hidden="true">{choisie && <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.4 5.8 10 11 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>}
    <Photo src={a.photo} PhotoVinted={PhotoVinted} />
    <span className="vrm-fc-annonce-texte">
      <span className="vrm-fc-titre">{a.titre || tr('favoris.qui.sansTitre')}</span>
      <span className="vrm-fc-meta">{a.numero && <span className="vrm-fu-num">N°{a.numero}</span>}{a.prix != null && <span>{eur(a.prix)}</span>}</span>
      <span className="vrm-fc-compte"><b data-fc-personnes={a.personnes}>{tr('favoris.qui.personnes', { n: a.personnes })}</b><span className={a.aVerifier && !a.aEcrire.length ? 'is-geste' : ''}>{etat}</span></span>
    </span>
  </>;
  const attrs = { 'data-fc-annonce': a.itemId || a.cle, 'data-fc-aecrire': a.aEcrire.length, 'data-fc-choisie': choisie ? '1' : '0' };
  return a.choisissable
    ? <li><button type="button" role="checkbox" aria-checked={choisie} disabled={verrou} className={'vrm-fc-annonce' + (choisie ? ' is-choisie' : '')} onClick={() => onBasculer(a.cle)} {...attrs}>{corps}</button></li>
    : <li><div className="vrm-fc-annonce is-fixe" {...attrs}>{corps}</div></li>;
}

export default function PageFavoris(p) {
  useLangue();
  const [recapOuvert, setRecapOuvert] = React.useState(false);
  const { annonces = [], choisis, choix, recap, PhotoVinted } = p;
  const choisissables = annonces.filter((a) => a.choisissable);
  const autres = annonces.filter((a) => !a.choisissable);
  const totalPersonnes = annonces.reduce((n, a) => n + a.personnes, 0);
  const aVerifier = annonces.reduce((n, a) => n + a.aVerifier, 0);
  const aOuvrir = annonces.flatMap((a) => a.aOuvrir);
  const verrou = p.fileActive || p.occupe;
  const peutOuvrir = choix.ids.length > 0 && !p.erreurMessage && !p.erreurRythme && !verrou && p.reglagesPrets;
  const peutEnvoyer = peutOuvrir && (!(p.bloquees || []).length || p.confirmeMarge);
  React.useEffect(() => { if (p.fileActive) setRecapOuvert(false); }, [p.fileActive]);

  // ── états vides : une phrase, un geste ─────────────────────────────────────
  let vide = null;
  if (p.sansCompte) vide = { code: 'compte', texte: tr('favoris.vide.compte') };
  else if (p.lecture) vide = { code: 'lecture', texte: tr('favoris.vide.lecture') };
  else if (p.absente) vide = { code: 'absente', texte: tr('favoris.vide.absente'), geste: tr('favoris.vide.ouvrirCloche'), lien: 'https://www.vinted.fr/' };
  else if (p.aucun) vide = { code: 'aucun', texte: tr('favoris.vide.aucun'), geste: tr('favoris.vide.ouvrirVinted'), lien: 'https://www.vinted.fr/' };

  const tete = <header className="vrm-fc-entete">
    <div className="vrm-fc-entete-texte">
      <h2>{tr('favoris.titre')}</h2>
      <p>{p.nomCompte ? tr('favoris.sousTitreCompte', { compte: p.nomCompte }) : tr('favoris.sousTitre')}</p>
    </div>
    {!p.sansCompte && <div className="vrm-fc-ronds">
      <button type="button" className="vrm-fc-rond" aria-label={tr('favoris.actualiser')} title={tr('favoris.actualiser')} data-fav-actualiser onClick={p.actualiser} disabled={p.lectureEnCours || verrou}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={p.lectureEnCours ? 'is-tourne' : ''}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg></button>
      <button type="button" className="vrm-fc-rond" aria-label={tr('favoris.outils')} title={tr('favoris.outils')} data-favoris-ouvrir onClick={p.ouvrirOutils}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg></button>
    </div>}
  </header>;

  if (vide) return <div className="vrm-fc" data-fc-page data-fc-vide={vide.code}>
    {tete}{p.alertes}
    <div className="vrm-fc-vide vrm-fu-blanc">
      <span className="vrm-fc-vide-icone" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg></span>
      <p data-fc-vide-texte>{vide.texte}</p>
      {vide.geste && <a className="vrm-fc-bouton is-principal" href={vide.lien} target="_blank" rel="noreferrer" data-fc-vide-geste>{vide.geste}</a>}
    </div>
  </div>;

  // ── 1. QUI ─────────────────────────────────────────────────────────────────
  const qui = <section className="vrm-fc-etape vrm-fu-blanc" data-fc-etape="qui" aria-label={tr('favoris.qui.titre')}>
    <Tete n="1" titre={tr('favoris.qui.titre')} resume={tr('favoris.qui.resume', { a: annonces.length, n: totalPersonnes })} />
    <p className="vrm-fc-aide">{tr('favoris.qui.aide')}</p>
    {aVerifier > 0 && <div className="vrm-fc-geste" data-fc-a-verifier={aVerifier}><span>{tr('favoris.qui.verifierTexte', { n: aVerifier })}</span><button type="button" className="vrm-fc-bouton is-ambre" onClick={p.ouvrirEnvoi}>{tr('favoris.qui.verifier')}</button></div>}
    {aOuvrir.length > 0 && p.ouvrirPersonne && <div className="vrm-fc-geste" data-fc-a-ouvrir={aOuvrir.length}><span>{tr('favoris.qui.ouvrirTexte', { n: aOuvrir.length })}</span><button type="button" className="vrm-fc-bouton is-ambre" disabled={!!p.ouverture} onClick={() => p.ouvrirPersonne(aOuvrir[0])}>{p.ouverture ? '…' : tr('favoris.qui.ouvrir')}</button></div>}
    {choisissables.length > 0 ? <>
      <div className="vrm-fc-choix-barre">
        <span data-fc-choisis={choix.ids.length}>{tr('favoris.qui.choisis', { n: choix.ids.length })}</span>
        {choisis.length ? <button type="button" className="vrm-fc-lien" disabled={verrou} onClick={p.aucune}>{tr('favoris.qui.aucune')}</button>
          : <button type="button" className="vrm-fc-lien" data-fc-tout disabled={verrou} onClick={p.toutChoisir}>{tr('favoris.qui.tout')}</button>}
      </div>
      {p.depuisEnvoi != null && (p.anciens > 0 || p.anciensAussi) && <div className="vrm-fc-choix-barre is-second" data-fc-nouveaux={p.anciensAussi ? 'tous' : 'nouveaux'} data-fc-anciens={p.anciens}>
        <span className="vrm-fc-aide">{p.anciensAussi ? tr('favoris.qui.tousFavoris') : tr('favoris.qui.nouveauxDepuis', { date: jour(p.depuisEnvoi), n: p.anciens })}</span>
        <button type="button" className="vrm-fc-lien" data-fc-anciens-bascule disabled={verrou} onClick={() => p.setAnciensAussi(!p.anciensAussi)}>{p.anciensAussi ? tr('favoris.qui.nouveauxSeuls') : tr('favoris.qui.inclureAnciens')}</button>
      </div>}
      <ul className="vrm-fc-annonces" data-fc-liste>{choisissables.map((a) => <LigneAnnonce key={a.cle} a={a} choisie={choisis.includes(a.cle)} onBasculer={p.basculer} PhotoVinted={PhotoVinted} verrou={verrou} />)}</ul>
      {choix.reste > 0 && <p className="vrm-fc-note" data-fc-reste={choix.reste}>{tr('favoris.qui.reste', { n: choix.reste })}</p>}
    </> : <p className="vrm-fc-note" data-fc-rien>{tr('favoris.qui.toutFait')}</p>}
    {autres.length > 0 && <details className="vrm-fc-repli">
      <summary>{tr('favoris.qui.autres', { n: autres.length })}</summary>
      <ul className="vrm-fc-annonces">{autres.map((a) => <LigneAnnonce key={a.cle} a={a} choisie={false} PhotoVinted={PhotoVinted} />)}</ul>
    </details>}
  </section>;

  // ── 2. QUOI ────────────────────────────────────────────────────────────────
  const ex = p.exemple;   // { titre, numero, photo, prix, offre:{…} }
  const o = ex?.offre || { sans: true };
  const offreLigne = o.sans ? tr('favoris.quoi.sansOffre') : o.inconnu ? tr('favoris.quoi.prixPasLu') : o.sansOffre ? tr('favoris.quoi.offreTropHaute') : tr('favoris.quoi.offreLigne', { apres: eur(o.apres), prix: eur(o.prix), remise: eur(o.remise), pct: o.pct });
  const quoi = <section className="vrm-fc-etape vrm-fu-blanc" data-fc-etape="quoi" aria-label={tr('favoris.quoi.titre')}>
    <Tete n="2" titre={tr('favoris.quoi.titre')} />
    <label className="vrm-fc-champ"><span>{tr('favoris.quoi.message')}</span>
      <textarea ref={p.champMessage} data-favoris-message maxLength={2000} rows={3} value={p.message} disabled={verrou} onChange={(e) => p.setMessage(e.target.value)} placeholder={tr('favoris.quoi.placeholder')} />
    </label>
    <div className="vrm-fc-variables" role="group" aria-label={tr('favoris.quoi.variables')}>
      <button type="button" className="vrm-fc-pastille" data-favoris-variable="username" disabled={verrou} onClick={() => p.inserer('{username}')}>+ {tr('favoris.quoi.sonPseudo')}</button>
      <button type="button" className="vrm-fc-pastille" data-favoris-variable="variante" disabled={verrou} onClick={() => p.inserer('{Bonjour|Salut}')}>+ {tr('favoris.quoi.motHasard')}</button>
    </div>
    <p className="vrm-fc-aide" data-fc-variables-aide>{tr('favoris.quoi.variablesAide')}</p>
    <div className="vrm-fc-sous"><span className="vrm-fc-sous-titre">{tr('favoris.quoi.offre')}</span>
      <Segment label={tr('favoris.quoi.offre')} value={p.offreChoix} onChange={p.setOffreChoix} disabled={verrou} attr="data-fc-offre"
        options={[['aucune', tr('favoris.quoi.offreAucune')], ['pct', tr('favoris.quoi.offrePct')], ['euros', tr('favoris.quoi.offreEuros')], ['prix', tr('favoris.quoi.offrePrix')]]} />
      {p.offreChoix === 'pct' && <div className="vrm-fc-rangee">{[5, 10, 15, 20].map((v) => <button key={v} type="button" className="vrm-fc-pastille" aria-pressed={String(p.reduction) === String(v)} disabled={verrou} onClick={() => p.setReduction(String(v))}>−{v}&nbsp;%</button>)}
        <label className="vrm-fc-mini"><input data-favoris-offre-valeur type="text" inputMode="numeric" maxLength={2} value={p.reduction} disabled={verrou} onChange={(e) => p.setReduction(e.target.value)} aria-label={tr('favoris.quoi.valeurPct')} />%</label></div>}
      {(p.offreChoix === 'euros' || p.offreChoix === 'prix') && <div className="vrm-fc-rangee"><label className="vrm-fc-mini">{p.offreChoix === 'euros' ? '−' : ''}<input data-favoris-offre-valeur type="text" inputMode="decimal" maxLength={9} value={p.montantOffre} disabled={verrou} onChange={(e) => p.setMontantOffre(e.target.value)} aria-label={p.offreChoix === 'euros' ? tr('favoris.quoi.valeurEuros') : tr('favoris.quoi.valeurPrix')} />€</label></div>}
      {p.offreChoix !== 'aucune' && <label className="vrm-fc-case"><input type="checkbox" checked={p.arrondi} disabled={verrou} onChange={(e) => p.setArrondi(e.target.checked)} />{tr('favoris.quoi.arrondi')}</label>}
    </div>
    <div className="vrm-fc-apercu" data-fc-apercu aria-label={tr('favoris.quoi.apercu')}>
      <span className="vrm-fc-sous-titre">{tr('favoris.quoi.apercu')}</span>
      <div className="vrm-fc-telephone">
        {ex && <div className="vrm-fc-tel-article"><Photo src={ex.photo} PhotoVinted={PhotoVinted} taille={40} /><span className="vrm-fc-annonce-texte"><span className="vrm-fc-titre">{ex.titre || tr('favoris.qui.sansTitre')}</span>
          <span className="vrm-fc-meta" data-fc-apercu-offre={o.apres != null ? o.apres : ''}>{o.apres != null ? <><s>{eur(o.prix)}</s><b>{eur(o.apres)}</b></> : ex.prix != null ? <span>{eur(ex.prix)}</span> : null}</span></span></div>}
        {p.morceaux.length ? <p className="vrm-fc-bulle" data-fc-bulle>{p.morceaux.map((m, i) => (m.pseudo ? <span key={i} className="vrm-fc-jeton" data-fc-jeton>{tr('favoris.quoi.sonPseudoJeton')}</span> : <React.Fragment key={i}>{m.texte}</React.Fragment>))}</p>
          : <p className="vrm-fc-aide">{tr('favoris.quoi.messageVide')}</p>}
      </div>
      <p className="vrm-fc-offre-ligne" data-fc-offre-ligne>{offreLigne}</p>
    </div>
    {p.erreurMessage && <p role="alert" className="vrm-fc-alerte">{p.erreurMessage}</p>}
    {p.alerteExtension && <p role="alert" className="vrm-fc-alerte" data-favoris-maj>{p.alerteExtension}</p>}
  </section>;

  // ── 3. QUAND ───────────────────────────────────────────────────────────────
  const quand = <section className="vrm-fc-etape vrm-fu-blanc" data-fc-etape="quand" aria-label={tr('favoris.quand.titre')}>
    <Tete n="3" titre={tr('favoris.quand.titre')} />
    <Segment label={tr('favoris.quand.rythme')} value={p.rythme === 'vintex' ? 'vintex' : 'espace'} onChange={(v) => p.setRythme(v === 'vintex' ? 'vintex' : 'fixe')} disabled={verrou} attr="data-fc-rythme"
      options={[['vintex', tr('favoris.quand.rapide')], ['espace', tr('favoris.quand.espace')]]} />
    {p.rythme === 'vintex' ? <p className="vrm-fc-aide" data-fc-rythme-phrase>{tr('favoris.quand.rapidePhrase')}</p> : <>
      <Segment label={tr('favoris.quand.espace')} value={p.rythme} onChange={p.setRythme} disabled={verrou} options={[['fixe', tr('favoris.quand.fixe')], ['aleatoire', tr('favoris.quand.hasard')]]} />
      <div className="vrm-fc-rangee">
        {p.rythme === 'fixe' ? <label className="vrm-fc-mini">{tr('favoris.quand.toutesLes')}<input type="text" inputMode="numeric" maxLength={4} value={p.intervalle} disabled={verrou} onChange={(e) => p.setIntervalle(e.target.value)} aria-label={tr('favoris.quand.minutes')} />{tr('favoris.quand.unite')}</label>
          : <><label className="vrm-fc-mini">{tr('favoris.quand.entre')}<input type="text" inputMode="numeric" maxLength={4} value={p.intervalle} disabled={verrou} onChange={(e) => p.setIntervalle(e.target.value)} aria-label={tr('favoris.quand.minimum')} /></label><label className="vrm-fc-mini">{tr('favoris.quand.et')}<input type="text" inputMode="numeric" maxLength={4} value={p.intervalleMax} disabled={verrou} onChange={(e) => p.setIntervalleMax(e.target.value)} aria-label={tr('favoris.quand.maximum')} />{tr('favoris.quand.unite')}</label></>}
      </div>
      <p className="vrm-fc-aide">{tr('favoris.quand.espacePhrase')}</p>
    </>}
    {p.erreurRythme && <p role="alert" className="vrm-fc-alerte">{p.erreurRythme}</p>}
    {p.auto && <div className="vrm-fc-auto" data-fc-auto><span className="vrm-fc-sous-titre is-clair">{tr('favoris.quand.auto')}</span>{p.auto}</div>}
  </section>;

  // ── 4. HISTORIQUE ──────────────────────────────────────────────────────────
  const h = p.historique;
  const histo = h && (h.envoyes > 0 || h.lignes.length > 0) && <section className="vrm-fc-etape vrm-fu-blanc" data-fc-etape="historique" aria-label={tr('favoris.histo.titre')}>
    <div className="vrm-fc-etape-tete"><h3>{tr('favoris.histo.titre')}</h3></div>
    <div className="vrm-fc-chiffres">
      <span data-fc-envoyes={h.envoyes}><b>{h.envoyes}</b>{tr('favoris.histo.envoyes', { n: h.envoyes })}</span>
      <span data-fc-achats={h.achats}><b>{h.achats}</b>{tr('favoris.histo.achats', { n: h.achats })}</span>
    </div>
    {h.lignes.length > 0 && <ul className="vrm-fc-annonces">{h.lignes.slice(0, 20).map((l) => { const a = p.articleHisto(l.itemId) || {}; return <li key={l.tx + l.itemId}><div className="vrm-fc-annonce is-fixe" data-fc-achat={l.itemId}><Photo src={a.photo} PhotoVinted={PhotoVinted} /><span className="vrm-fc-annonce-texte"><span className="vrm-fc-titre">{a.titre || tr('favoris.qui.sansTitre')}</span><span className="vrm-fc-meta">{a.numero && <span className="vrm-fu-num">N°{a.numero}</span>}</span><span className="vrm-fc-compte"><span>{tr('favoris.histo.ligne', { message: jour(l.envoyeLe), achat: jour(l.achatLe) })}</span></span></span></div></li>; })}</ul>}
    {(p.marche || []).length > 0 && <div className="vrm-fc-sous" data-fc-marche>
      <span className="vrm-fc-sous-titre">{tr('favoris.marche.titre')}</span>
      <ul className="vrm-fc-annonces">{p.marche.slice(0, 8).map((m) => <li key={m.lot} className="vrm-fc-marche-ligne" data-fc-lot={m.lot} data-fc-lot-achats={m.achats} data-fc-lot-envoyes={m.envoyes}>
        <span>{jour(m.at)}{m.auto ? ' · ' + tr('favoris.marche.auto') : ''}</span>
        <span>{m.offre ? (m.offre.mode === 'pct' ? '−' + m.offre.valeur + '\u00a0%' : m.offre.mode === 'euros' ? '−' + eur(m.offre.valeur) : tr('favoris.marche.prixFixe', { prix: eur(m.offre.valeur) })) : tr('favoris.marche.sansOffre')}</span>
        <b>{tr('favoris.marche.ligne', { achats: m.achats, envoyes: m.envoyes })}</b>
      </li>)}</ul>
    </div>}
    {(p.groupes || []).length > 0 && <div className="vrm-fc-geste is-neutre" data-fc-groupes={p.groupes.length}><span>{tr('favoris.groupe.texte', { n: p.groupes.length })}{(() => { const g = p.groupes[0]; const prix = g.items.map((i) => p.articleHisto(i)?.prix); const pct = p.offreChoix === 'pct' ? Number(p.reduction) || 0 : 0; const l = p.prixLot ? p.prixLot(prix, pct) : null; return l ? ' ' + tr('favoris.groupe.prix', { n: g.items.length, total: eur(l.total), apres: eur(l.apres) }) : ''; })()} {tr('favoris.groupe.surVinted')}</span></div>}
    {h.ventesSansAcheteur > 0 && <p className="vrm-fc-note" data-fc-sans-acheteur={h.ventesSansAcheteur}>{tr('favoris.histo.sansAcheteur', { n: h.ventesSansAcheteur })}</p>}
  </section>;

  // ── LE PIED ET LE RÉCAPITULATIF ────────────────────────────────────────────
  const r = recap;
  const ligneRecap = tr('favoris.recap.ligne', { messages: tr('favoris.recap.messages', { n: r.messages }), annonces: tr('favoris.recap.annonces', { n: r.annonces }), duree: texteDuree(r.secondes) });
  const limite = r.limite === 'dedans' ? tr('favoris.recap.dedans', { n: r.gestes, max: p.pourApp }) : r.limite === 'depasse' ? tr('favoris.recap.depasse', { n: r.gestes, libres: r.libres }) : tr('favoris.recap.passu', { n: r.gestes });
  const pied = <div className="vrm-fc-pied" data-fc-pied>
    <div className="vrm-fc-pied-texte">{p.fileActive ? <span data-fc-en-cours>{tr('favoris.recap.enCours')}</span> : r.messages ? <span data-fc-pied-ligne>{ligneRecap}</span> : <span>{tr('favoris.recap.rien')}</span>}</div>
    <button type="button" className="vrm-fc-bouton is-principal" data-fc-verifier disabled={!peutOuvrir} onClick={() => setRecapOuvert(true)}>{tr('favoris.recap.verifier')}</button>
  </div>;
  const FermeAuRetour = p.FermeAuRetour;
  const fermer = () => { if (!p.occupe) setRecapOuvert(false); };
  const feuille = recapOuvert && <div className="vrm-favoris-voile vrm-fa-voile" data-noswipe="1" onClick={fermer}>
    {FermeAuRetour && <FermeAuRetour fermer={fermer} />}
    <div className="vrm-fa-feuille vrm-fc-feuille" role="dialog" aria-modal="true" aria-label={tr('favoris.recap.titre')} data-fc-recap onClick={(e) => e.stopPropagation()}>
      <div className="vrm-fa-feuille-tete"><strong>{tr('favoris.recap.titre')}</strong>
        <button type="button" className="vrm-fa-fermer" aria-label={tr('commun.fermer')} onClick={fermer}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button></div>
      <div className="vrm-fa-feuille-corps">
        <p className="vrm-fc-recap-gros" data-fc-recap-ligne data-fc-messages={r.messages} data-fc-nannonces={r.annonces} data-fc-secondes={r.secondes == null ? '' : r.secondes}>{ligneRecap}</p>
        <p className={'vrm-fc-recap-limite' + (r.limite === 'depasse' ? ' is-geste' : '')} data-fc-limite={r.limite} data-fc-gestes={r.gestes}>{limite}</p>
        <ul className="vrm-fc-annonces">{p.recapAnnonces.map((a) => <li key={a.cle}><div className="vrm-fc-annonce is-fixe" data-fc-recap-annonce={a.itemId || a.cle} data-fc-recap-n={a.n}><Photo src={a.photo} PhotoVinted={PhotoVinted} taille={40} /><span className="vrm-fc-annonce-texte"><span className="vrm-fc-titre">{a.titre || tr('favoris.qui.sansTitre')}</span><span className="vrm-fc-compte"><b>{tr('favoris.recap.messages', { n: a.n })}</b>{a.offre?.apres != null && <span>{tr('favoris.recap.offreA', { prix: eur(a.offre.apres) })}</span>}</span>
          {a.offre?.apres != null && <span className={'vrm-fc-compte' + (a.garde.bloque ? ' is-ambre' : '')} data-fc-marge={a.garde.reste == null ? '' : a.garde.reste} data-fc-marge-etat={a.garde.etat} data-fc-bloque={a.garde.bloque || ''}>
            <span className={a.garde.bloque ? 'is-geste' : ''}>{a.garde.reste == null ? tr('favoris.marge.passu', { raison: a.garde.etat === 'illisible' ? tr('favoris.marge.illisible') : tr('favoris.marge.achat') }) : a.garde.etat === 'partiel' ? tr('favoris.marge.resteAuPlus', { reste: eur(a.garde.reste / 100) }) : tr('favoris.marge.reste', { reste: eur(a.garde.reste / 100) })}{a.garde.bloque === 'mini' ? ' · ' + tr('favoris.marge.sousMini') : a.garde.bloque === 'perte' ? ' · ' + tr('favoris.marge.aPerte') : ''}</span></span>}</span></div></li>)}</ul>
        {(p.bloquees || []).length > 0 && <div className="vrm-fc-garde" data-fc-garde={p.bloquees.length}>
          <b>{tr('favoris.marge.bloquees', { n: p.bloquees.length })}</b>
          <label className="vrm-fc-case"><input type="checkbox" data-fc-confirme-marge checked={!!p.confirmeMarge} onChange={(e) => p.setConfirmeMarge(e.target.checked)} />{tr('favoris.marge.confirmer')}</label>
        </div>}
        <p className="vrm-fc-recap-quand">{p.rythme === 'vintex' ? tr('favoris.quand.rapidePhrase') : tr('favoris.recap.espace')}</p>
        <p className="vrm-fc-avertissement" data-fc-avertissement><b>{tr('favoris.recap.garantie')}</b> {tr('favoris.recap.onglet')}</p>
        {p.erreurLancer && <p role="alert" className="vrm-fc-alerte" data-fc-erreur>{p.erreurLancer}</p>}
      </div>
      <div className="vrm-fa-feuille-pied vrm-fc-recap-pied">
        <button type="button" className="vrm-fc-bouton" disabled={p.occupe} onClick={fermer}>{tr('favoris.recap.modifier')}</button>
        <button type="button" className="vrm-fc-bouton is-principal" data-fc-envoyer disabled={p.occupe || !peutEnvoyer} onClick={p.envoyer}>{p.occupe ? tr('favoris.recap.preparation') : tr('favoris.recap.envoyer', { n: r.messages })}</button>
      </div>
    </div>
  </div>;

  return <div className="vrm-fc" data-fc-page>
    {tete}
    {p.alertes}
    {qui}{quoi}{quand}{histo}
    {pied}
    {feuille && (typeof document !== 'undefined' ? createPortal(feuille, document.body) : feuille)}
  </div>;
}
