// ════════════════════════════════════════════════════════════════════════════
// L'ESPACE eBAY (15 nov., eBay complet 2). Julien : « Pour l'app eBay je pense que tu peux
// faire 10 fois mieux. On a la chance d'avoir l'application dans l'app ».
//   · TableauEbay : ce qui compte d'un coup d'œil — à expédier, offres, messages, versé ce
//     mois (une bande de chiffres), « À faire » (chaque chose avec son geste), puis l'argent,
//     le trafic et la santé du compte en trois cartes de verre, chacune menant à sa section ;
//   · ArgentEbay : le solde, les versements (date, état, montant), et par commande le net
//     reçu, les frais RÉELS lus chez eBay et la date du versement ;
//   · TraficEbay : affichages, vues, ventes par annonce sur 30 jours ; « ne se voient pas » ;
//   · SanteEbay : le niveau vendeur, les réclamations comparées, les annonces à corriger
//     (caractéristiques manquantes et valeurs suggérées par eBay), les litiges, les
//     évaluations reçues (aucune relance : refusé le 11 oct.).
// LECTURE SEULE (rien n'écrit chez eBay depuis ces écrans) ; les gestes mènent aux écrans qui
// les font déjà (Commandes, Offres, Annonces, Promotion) ou chez eBay (litiges : lien).
// Règles : src/ebay/tableau.js ; route : api/_lib/ebay-tableau.js. « Pas su » ≠ 0 partout ;
// une autre devise n'est jamais additionnée à l'euro ; tout texte par tr() (ebt.*).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { tr, monnaie, date as dateTr, heure as heureTr, nombre } from '../i18n/index.js';
import { appelerEbay } from '../ebayRequetes.js';
import { BandeChiffres } from '../ui/BandeChiffres.jsx';
import { LigneAFaire } from '../ui/LigneAFaire.jsx';
import { etatPartie, verseMois, derniersVersements, totauxTrafic, transformation, etatSante, nbACorriger, litigesOuverts, aFaireEbay, commandeDe, moisParis } from './tableau.js';
import './espace-ebay.css';

// ── La lecture d'une action, gardée 3 minutes par compte (changer de section ne relit pas eBay).
const CACHE = new Map();
const GARDE_MS = 3 * 60 * 1000;
function useLectureEbay(action, compte, headers) {
  const cle = action + ':' + (compte || 'principal');
  const [etat, setEtat] = useState(() => { const c = CACHE.get(cle); return c && Date.now() - c.at < GARDE_MS ? c : { data: undefined, at: 0 }; });
  const lire = useCallback(async (force = false) => {
    const c = CACHE.get(cle);
    if (!force && c && Date.now() - c.at < GARDE_MS) { setEtat(c); return; }
    setEtat((e) => ({ ...e, lecture: true }));
    let data;
    try { data = await appelerEbay(action, compte && compte !== 'principal' ? { compte } : {}, headers); }
    catch (e) { data = { ok: false, ko: { raison: e.reason || 'pas-su', erreur: e.message } }; }
    const n = { data, at: Date.now() };
    if (data && data.ok !== false) CACHE.set(cle, n);
    setEtat(n);
  }, [cle, action, compte, headers]);
  useEffect(() => { lire(false); }, [lire]);
  return [etat.data, () => lire(true), etat.at, !!etat.lecture];
}

const euros = (m) => (!m ? '—' : monnaie(m.v, m.c));
const dateCourte = (iso) => (iso ? dateTr(iso, { day: 'numeric', month: 'short' }) : '');
const Chevron = () => <svg className="ebt-chevron" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// Une rangée : la rangée ENTIÈRE est le geste (bouton ou lien), jamais un bouton dedans.
function Rangee({ nom, detail, valeur, gris, geste, photo, onClick, href, libre, attrs = {} }) {
  const corps = <>
    {photo !== undefined ? (photo ? <img className="ebt-photo" src={photo} alt="" loading="lazy" decoding="async" width={44} height={44}/> : <span className="ebt-photo" aria-hidden="true"/>) : null}
    <span className="ebt-textes"><span className="ebt-nom">{nom}</span>{detail ? <span className={'ebt-detail' + (libre ? ' is-libre' : '')}>{detail}</span> : null}</span>
    {valeur != null && valeur !== '' ? <span className={'ebt-valeur' + (gris ? ' is-gris' : '') + (geste ? ' ebt-geste' : '')}>{valeur}</span> : null}
    {(onClick || href) ? <Chevron/> : null}
  </>;
  const cls = 'ebt-rangee' + (photo !== undefined ? ' a-photo' : '');
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" {...attrs}>{corps}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} {...attrs}>{corps}</button>;
  return <div className={cls} {...attrs}>{corps}</div>;
}
function Groupe({ titre, n, lien, onLien, children, pied, large, attrs = {} }) {
  return (
    <section className={'ebt-groupe' + (large ? ' ebt-large' : '')} {...attrs}>
      <h3 className="ebt-titre"><span>{titre}</span>{n != null ? <span className="ebt-titre-n">· {nombre(n)}</span> : null}{lien && onLien ? <button type="button" className="ebt-lien ebt-lien-titre" onClick={onLien}>{lien}</button> : null}</h3>
      <div className="ebt-carte">{children}</div>
      {pied ? <div className="ebt-pied">{pied}</div> : null}
    </section>
  );
}
// Une partie que eBay n'a pas rendue : la raison, puis le geste (jamais un « 0 »).
function Panne({ ko, onReconnecter, onReessayer }) {
  const r = (ko && ko.raison) || 'pas-su';
  const cle = ['scope', 'signature', 'signature-refusee', 'injoignable', 'pas-lu', 'abonnement', 'not-connected', 'reconnecter'].includes(r) ? r : 'pas-su';
  return (
    <div className="ebt-panne" data-ebt-panne={cle}>
      <span className="ebt-panne-texte">{tr('ebt.panne.' + cle)}</span>
      <span className="ebt-panne-geste">{tr('ebt.panne.' + cle + '.geste')}</span>
      {(cle === 'scope' || cle === 'reconnecter' || cle === 'not-connected') && onReconnecter ? <button type="button" className="ebt-lien" onClick={onReconnecter} data-ebt-reconnecter="">{tr('ebt.reconnecter')}</button>
        : onReessayer && cle !== 'signature' ? <button type="button" className="ebt-lien" onClick={onReessayer}>{tr('ebt.reessayer')}</button> : null}
    </div>
  );
}
const Squelette = ({ n = 3 }) => <div aria-busy="true" style={{ padding: '8px 0' }}>{Array.from({ length: n }, (_, i) => <div key={i} className="ebt-squelette"/>)}</div>;
const nomNiveau = (n) => (n ? tr('ebt.niveau.' + n) : tr('ebt.niveau.aucun'));
const nomNote = (n) => (n ? tr('ebt.note.' + n) : tr('ebt.note.aucune'));
const Pied = ({ at, lecture, onRelire }) => (at ? <div className="ebt-pied" data-ebt-lu={at}>{tr('ebt.luA', { h: heureTr(at) })} · <button type="button" className="ebt-lien" disabled={lecture} onClick={onRelire}>{tr(lecture ? 'ebt.lecture' : 'ebt.actualiser')}</button></div> : null);

// ══ LE TABLEAU ═══════════════════════════════════════════════════════════════
// `aExpedier` : le nombre de colis eBay à poster de ce compte (la règle `colisEbay`, lue par
// l'app) ; `onSection(x)` mène à une section ; `onMessages` à Messages · eBay.
export function TableauEbay({ compte, headers, aExpedier = null, onSection, onMessages, onReconnecter, maintenant = Date.now() }) {
  const [t, relire, at, lecture] = useLectureEbay('tableau', compte, headers);
  const pret = t && t.ok !== false;
  if (t && t.ok === false) return <div className="ebt" data-ebt="tableau" data-ebt-etat="ko"><Groupe titre={tr('ebt.tableau.titre')} large><Panne ko={t.ko} onReconnecter={onReconnecter} onReessayer={relire}/></Groupe></div>;
  const vm = pret && t.argent && !t.argent.ko ? verseMois(t.argent.versements, maintenant) : null;
  const dv = pret && t.argent && !t.argent.ko ? derniersVersements(t.argent.versements) : null;
  const solde = pret && t.argent ? t.argent.solde : null;
  const tt = pret ? totauxTrafic(t.trafic) : null;
  const sante = pret ? etatSante(t.sante) : null;
  const li = pret ? litigesOuverts(t.litiges) : null;
  const ac = pret ? nbACorriger(t.sante) : null;
  const inv = pret && t.trafic && !t.trafic.ko && t.trafic.invisibles ? t.trafic.invisibles.invisibles : null;
  const ev = pret && t.evaluations && !t.evaluations.ko ? t.evaluations : null;
  const afaire = pret ? aFaireEbay({ tableau: t, aExpedier }) : (aExpedier > 0 ? [{ cle: 'expedier', n: aExpedier, section: 'ventes' }] : []);
  const mois = dateTr(moisParis(maintenant) + '-15T12:00:00Z', { month: 'long' });
  const aller = (x) => () => (x === 'compte' ? onReconnecter && onReconnecter() : x && onSection && onSection(x));
  return (
    <div className="ebt" data-ebt="tableau" data-ebt-etat={t === undefined ? 'en-cours' : 'lu'}>
      <div className="ebt-large" style={{ display: 'grid', gap: 10 }}>
        <BandeChiffres data-ebt-bande="" items={[
          { cle: 'expedier', n: aExpedier == null ? null : nombre(aExpedier), l: tr('ebt.bande.expedier'), garderVide: true, onClick: aller('ventes'), attrs: { 'data-ebt-chiffre': 'expedier', 'data-n': aExpedier == null ? 'pas-su' : aExpedier } },
          { cle: 'offres', n: pret && t.offres && !t.offres.ko ? nombre(t.offres.n) + (t.offres.auMoins ? '+' : '') : null, l: tr('ebt.bande.offres'), garderVide: true, titre: pret && t.offres && t.offres.ko ? t.offres.ko.erreur : undefined, onClick: aller('offres'), attrs: { 'data-ebt-chiffre': 'offres', 'data-n': pret && t.offres && !t.offres.ko ? t.offres.n : 'pas-su' } },
          { cle: 'messages', n: pret && t.messages && !t.messages.ko ? nombre(t.messages.n) + (t.messages.auMoins ? '+' : '') : null, l: tr('ebt.bande.messages'), garderVide: true, onClick: onMessages, attrs: { 'data-ebt-chiffre': 'messages', 'data-n': pret && t.messages && !t.messages.ko ? t.messages.n : 'pas-su' } },
          { cle: 'verse', n: vm ? monnaie(vm.eur) : null, l: tr('ebt.bande.verse', { mois }), garderVide: true, onClick: aller('argent'), attrs: { 'data-ebt-chiffre': 'verse', 'data-n': vm ? vm.eur : 'pas-su' } },
        ]}/>
        {afaire.length ? <LigneAFaire n={afaire.length} data-ebt-afaire={afaire.map((x) => x.cle).join(' ')}>
          <div className="ebt-carte">{afaire.map((x) => <Rangee key={x.cle} nom={tr('ebt.afaire.' + x.cle, { n: x.n == null ? 0 : x.n })} detail={tr('ebt.afaire.' + x.cle + '.geste')} libre onClick={x.section ? aller(x.section) : undefined} attrs={{ 'data-ebt-afaire-ligne': x.cle }}/>)}</div>
        </LigneAFaire> : null}
      </div>

      <Groupe titre={tr('ebt.argent.titre')} lien={tr('ebt.toutVoir')} onLien={aller('argent')} attrs={{ 'data-ebt-groupe': 'argent', 'data-etat': t === undefined ? 'en-cours' : etatPartie(t.argent) }}>
        {t === undefined ? <Squelette/> : t.argent && t.argent.ko && !solde ? <Panne ko={t.argent.ko} onReconnecter={onReconnecter} onReessayer={relire}/> : <>
          <Rangee nom={tr('ebt.argent.dispo')} detail={tr('ebt.argent.dispo.aide')} valeur={euros(solde && solde.dispo)} attrs={{ 'data-ebt-dispo': solde && solde.dispo ? solde.dispo.v : 'pas-su' }}/>
          {solde && solde.enCours && solde.enCours.v ? <Rangee nom={tr('ebt.argent.enCours')} valeur={euros(solde.enCours)} gris/> : null}
          {solde && solde.retenu && solde.retenu.v ? <Rangee nom={tr('ebt.argent.retenu')} detail={tr('ebt.argent.retenu.aide')} valeur={euros(solde.retenu)} geste/> : null}
          {dv && dv.enRoute ? <Rangee nom={tr('ebt.argent.enRoute')} detail={dateCourte(dv.enRoute.date)} valeur={euros(dv.enRoute.montant)} gris/> : null}
          {dv && dv.arrive ? <Rangee nom={tr('ebt.argent.dernier')} detail={[dateCourte(dv.arrive.date), dv.arrive.vers].filter(Boolean).join(' · ')} valeur={euros(dv.arrive.montant)} gris/> : null}
          {t.argent && t.argent.ko ? <Panne ko={t.argent.ko} onReconnecter={onReconnecter}/> : null}
        </>}
      </Groupe>

      <Groupe titre={tr('ebt.trafic.titre')} lien={tr('ebt.toutVoir')} onLien={aller('trafic')} attrs={{ 'data-ebt-groupe': 'trafic', 'data-etat': t === undefined ? 'en-cours' : etatPartie(t.trafic) }}>
        {t === undefined ? <Squelette/> : t.trafic && t.trafic.ko ? <Panne ko={t.trafic.ko} onReconnecter={onReconnecter} onReessayer={relire}/> : tt ? <>
          <Rangee nom={tr('ebt.trafic.affichages')} detail={tr('ebt.trafic.affichages.aide')} valeur={(tt.partiel ? tr('ebt.auMoins') + ' ' : '') + nombre(tt.affichages)} attrs={{ 'data-ebt-affichages': tt.affichages }}/>
          <Rangee nom={tr('ebt.trafic.vues')} valeur={(tt.partiel ? tr('ebt.auMoins') + ' ' : '') + nombre(tt.vues)} gris/>
          <Rangee nom={tr('ebt.trafic.ventes')} valeur={nombre(tt.ventes)} gris/>
          {inv && inv.length ? <Rangee nom={tr('ebt.trafic.invisibles', { n: inv.length })} detail={tr('ebt.trafic.invisibles.aide')} valeur={nombre(inv.length)} geste onClick={aller('trafic')} attrs={{ 'data-ebt-invisibles': inv.length }}/> : null}
        </> : <div className="ebt-vide">{tr('ebt.trafic.aucune')}</div>}
      </Groupe>

      <Groupe titre={tr('ebt.sante.titre')} lien={tr('ebt.toutVoir')} onLien={aller('sante')} attrs={{ 'data-ebt-groupe': 'sante', 'data-etat': t === undefined ? 'en-cours' : sante || 'pas-su' }}>
        {t === undefined ? <Squelette n={4}/> : <>
          {t.sante && t.sante.niveau && !t.sante.niveau.ko ? <Rangee nom={tr('ebt.sante.niveau')} detail={t.sante.niveau.prevu && t.sante.niveau.prevu !== t.sante.niveau.niveau ? tr('ebt.sante.prevu', { niveau: nomNiveau(t.sante.niveau.prevu) }) : ''} valeur={nomNiveau(t.sante.niveau.niveau)} geste={t.sante.niveau.niveau === 'BELOW_STANDARD'} gris={t.sante.niveau.niveau !== 'BELOW_STANDARD'} onClick={aller('sante')} attrs={{ 'data-ebt-niveau': t.sante.niveau.niveau || 'aucun' }}/>
            : <Panne ko={(t.sante && t.sante.niveau && t.sante.niveau.ko) || (t.sante && t.sante.ko)} onReconnecter={onReconnecter} onReessayer={relire}/>}
          {ac != null ? <Rangee nom={tr('ebt.sante.aCorriger')} detail={tr('ebt.sante.aCorriger.aide')} valeur={nombre(ac)} geste={ac > 0} gris={!ac} onClick={aller('sante')} attrs={{ 'data-ebt-a-corriger': ac }}/> : null}
          {li ? <Rangee nom={tr('ebt.sante.litiges')} detail={li.aToi ? tr('ebt.sante.litiges.aToi', { n: li.aToi }) : ''} valeur={nombre(li.n)} geste={li.aToi > 0} gris={!li.aToi} onClick={aller('sante')} attrs={{ 'data-ebt-litiges': li.n, 'data-a-toi': li.aToi }}/> : null}
          {ev ? <Rangee nom={tr('ebt.sante.evaluations')} detail={ev.an && ev.an.negatives != null ? tr('ebt.sante.negatives', { n: ev.an.negatives }) : ''} valeur={ev.pourcent != null ? nombre(ev.pourcent, { maximumFractionDigits: 1 }) + ' %' : ev.score != null ? nombre(ev.score) : '—'} gris onClick={aller('sante')} attrs={{ 'data-ebt-evaluations': ev.score ?? 'pas-su' }}/> : null}
        </>}
      </Groupe>
      <div className="ebt-large"><Pied at={at} lecture={lecture} onRelire={relire}/></div>
    </div>
  );
}

// ══ L'ARGENT ═════════════════════════════════════════════════════════════════
// `commandes` : les commandes eBay rangées de CE compte (titre et N° par n° de commande).
// `numDe(o)` : le N° d'une commande (la règle de l'app, par SKU) ; `domaine` : eBay.fr…
export function ArgentEbay({ compte, headers, commandes = null, numDe, onReconnecter, maintenant = Date.now() }) {
  const [a, relire, at, lecture] = useLectureEbay('argent', compte, headers);
  const [tout, setTout] = useState(false);
  if (a === undefined) return <div className="ebt" data-ebt="argent" data-ebt-etat="en-cours"><Groupe titre={tr('ebt.argent.titre')} large><Squelette n={4}/></Groupe></div>;
  const vm = verseMois(a.versements, maintenant);
  const dv = derniersVersements(a.versements);
  const solde = a.solde || null;
  const cmd = a.ok && a.commandes ? Object.entries(a.commandes) : null;
  const eur = cmd ? cmd.filter(([, c]) => c.devise === 'EUR' && c.sur && !c.rembourse) : [];
  const apart = cmd ? cmd.filter(([, c]) => !(c.devise === 'EUR' && c.sur && !c.rembourse)) : [];
  eur.sort((x, y) => String(y[1].versement || '9999').localeCompare(String(x[1].versement || '9999')));
  const fraisTotal = eur.reduce((s, [, c]) => s + (c.frais || 0), 0);
  const netTotal = eur.reduce((s, [, c]) => s + (c.net || 0), 0);
  const hors = a.horsVente && a.horsVente.EUR;
  const horsAutres = a.horsVente ? Object.entries(a.horsVente).filter(([c]) => c !== 'EUR') : [];
  const mois = dateTr(moisParis(maintenant) + '-15T12:00:00Z', { month: 'long' });
  const visibles = tout ? eur : eur.slice(0, 30);
  return (
    <div className="ebt" data-ebt="argent" data-ebt-etat={a.ok === false ? 'ko' : 'lu'}>
      <div className="ebt-large">
        <BandeChiffres data-ebt-bande="" items={[
          { cle: 'dispo', n: solde && solde.dispo ? euros(solde.dispo) : null, l: tr('ebt.argent.dispo'), garderVide: true, attrs: { 'data-ebt-chiffre': 'dispo' } },
          { cle: 'encours', n: solde && solde.enCours ? euros(solde.enCours) : null, l: tr('ebt.argent.enCours'), attrs: { 'data-ebt-chiffre': 'encours' } },
          { cle: 'verse', n: vm ? monnaie(vm.eur) : null, l: tr('ebt.bande.verse', { mois }), garderVide: true, attrs: { 'data-ebt-chiffre': 'verse', 'data-n': vm ? vm.eur : 'pas-su' } },
        ]}/>
      </div>
      {a.ok === false ? <Groupe titre={tr('ebt.argent.titre')} large><Panne ko={a.ko || { raison: a.reason }} onReconnecter={onReconnecter} onReessayer={relire}/></Groupe> : null}
      {Array.isArray(a.versements) ? <Groupe titre={tr('ebt.argent.versements')} n={a.versements.length} attrs={{ 'data-ebt-versements': a.versements.length }} pied={tr('ebt.argent.versements.pied')}>
        {a.versements.length ? a.versements.slice(0, 20).map((p) => <Rangee key={p.id} nom={p.date ? dateTr(p.date, { day: 'numeric', month: 'long' }) : '—'} detail={[tr('ebt.versement.' + (['SUCCEEDED', 'INITIATED', 'RETRYABLE_FAILED', 'TERMINAL_FAILED', 'REVERSED'].includes(p.statut) ? p.statut : 'AUTRE')), p.n != null ? tr('ebt.argent.nVentes', { n: p.n }) : '', p.vers].filter(Boolean).join(' · ')} valeur={euros(p.montant)} geste={/FAILED|REVERSED/.test(p.statut)} gris={p.statut === 'INITIATED'} attrs={{ 'data-ebt-versement': p.statut }}/>)
          : <div className="ebt-vide">{tr('ebt.argent.aucunVersement')}</div>}
      </Groupe> : null}
      {cmd ? <Groupe titre={tr('ebt.argent.parCommande')} n={eur.length} large attrs={{ 'data-ebt-par-commande': eur.length }}
        pied={<>{tr('ebt.argent.parCommande.pied', { net: monnaie(netTotal), frais: monnaie(fraisTotal) })}{a.complet === false ? ' ' + tr('ebt.argent.incomplet') : ''}</>}>
        {visibles.length ? visibles.map(([id, c]) => {
          const o = commandeDe(commandes, id);
          const titre = (o && Array.isArray(o.lineItems) && o.lineItems[0] && o.lineItems[0].title) || tr('ebt.argent.commande', { id });
          const num = o && numDe ? numDe(o) : '';
          return <Rangee key={id} nom={(num ? 'N°' + num + ' · ' : '') + titre} detail={[tr('ebt.argent.frais', { frais: monnaie(c.frais ?? 0) }), c.versement ? tr('ebt.argent.verseeLe', { date: dateCourte(c.versement) }) : c.statut === 'INITIATED' ? tr('ebt.argent.enRouteCourt') : tr('ebt.argent.pasVersee'), c.autresFrais ? tr('ebt.argent.pub', { m: monnaie(c.autresFrais) }) : ''].filter(Boolean).join(' · ')} valeur={monnaie(c.net)} attrs={{ 'data-ebt-commande': id, 'data-versee': c.versement ? c.versement.slice(0, 10) : '' }}/>;
        }) : <div className="ebt-vide">{tr('ebt.argent.aucuneVente')}</div>}
        {!tout && eur.length > 30 ? <div className="ebt-plus"><button type="button" className="ebt-lien" onClick={() => setTout(true)}>{tr('ebt.toutAfficher', { n: eur.length })}</button></div> : null}
      </Groupe> : null}
      {hors || horsAutres.length ? <Groupe titre={tr('ebt.argent.horsVente')} attrs={{ 'data-ebt-hors-vente': hors ? hors.total : 0 }} pied={tr('ebt.argent.horsVente.pied')}>
        {hors ? Object.entries(hors.types).map(([k, v]) => <Rangee key={k} nom={tr('ebt.frais.' + (['AD_FEE', 'FINAL_VALUE_FEE', 'INSERTION_FEE', 'BELOW_STANDARD_FEE', 'INTERNATIONAL_FEE'].includes(k) ? k : 'AUTRE'))} valeur={monnaie(v)}/>) : null}
        {horsAutres.map(([c, d]) => <Rangee key={c} nom={tr('ebt.argent.autreDevise', { devise: c })} detail={tr('ebt.argent.autreDevise.aide')} valeur={monnaie(d.total, c)} gris/>)}
      </Groupe> : null}
      {apart.length ? <Groupe titre={tr('ebt.argent.apart')} n={apart.length} attrs={{ 'data-ebt-apart': apart.length }} pied={tr('ebt.argent.apart.pied')}>
        {apart.slice(0, 30).map(([id, c]) => <Rangee key={id} nom={tr('ebt.argent.commande', { id })} detail={c.rembourse ? tr('ebt.argent.rembourse') : c.devise && c.devise !== 'EUR' ? tr('ebt.argent.autreDevise', { devise: c.devise }) : tr('ebt.argent.pasSur')} valeur={c.net != null ? monnaie(c.net, c.devise || 'EUR') : '—'} gris attrs={{ 'data-ebt-apart-ligne': id }}/>)}
      </Groupe> : null}
      <div className="ebt-large"><Pied at={at} lecture={lecture} onRelire={relire}/></div>
    </div>
  );
}

// ══ LE TRAFIC ════════════════════════════════════════════════════════════════
export function TraficEbay({ compte, headers, numDe, domaine = 'www.ebay.fr', onReconnecter, onPromotion }) {
  const [t, relire, at, lecture] = useLectureEbay('trafic', compte, headers);
  const [tout, setTout] = useState(false);
  if (t === undefined) return <div className="ebt" data-ebt="trafic" data-ebt-etat="en-cours"><Groupe titre={tr('ebt.trafic.titre')} large><Squelette n={5}/></Groupe></div>;
  if (t.ok === false) return <div className="ebt" data-ebt="trafic" data-ebt-etat="ko"><Groupe titre={tr('ebt.trafic.titre')} large><Panne ko={t.ko || { raison: t.reason }} onReconnecter={onReconnecter} onReessayer={relire}/></Groupe></div>;
  const tt = totauxTrafic(t);
  const inv = t.invisibles ? t.invisibles.invisibles : null;
  const toutes = [...(t.annonces || [])].filter((a) => a.enLigne !== false).sort((a, b) => (b.affichages ?? -1) - (a.affichages ?? -1));
  const lien = (id) => `https://${domaine}/itm/${id}`;
  const num = (a) => (numDe ? numDe(a) : '');
  const ligne = (a, k) => <Rangee key={k + a.itemId} photo={a.photo || ''} nom={(num(a) ? 'N°' + num(a) + ' · ' : '') + (a.titre || a.itemId)}
    detail={[a.affichages != null ? tr('ebt.trafic.nAffichages', { n: a.affichages }) : tr('ebt.trafic.affichagesPasSu'), a.vues != null ? tr('ebt.trafic.nVues', { n: a.vues }) : '', a.ventes ? tr('ebt.trafic.nVentes', { n: a.ventes }) : '', transformation(a) != null && a.ventes ? nombre(transformation(a), { maximumFractionDigits: 1 }) + ' %' : ''].filter(Boolean).join(' · ')}
    href={lien(a.itemId)} attrs={{ 'data-ebt-annonce': a.itemId, 'data-affichages': a.affichages ?? 'pas-su' }}/>;
  const visibles = tout ? toutes : toutes.slice(0, 40);
  return (
    <div className="ebt" data-ebt="trafic" data-ebt-etat="lu">
      <div className="ebt-large">
        <BandeChiffres data-ebt-bande="" items={tt ? [
          { cle: 'affichages', n: (tt.partiel ? '≥ ' : '') + nombre(tt.affichages), l: tr('ebt.trafic.affichages'), attrs: { 'data-ebt-chiffre': 'affichages' } },
          { cle: 'vues', n: (tt.partiel ? '≥ ' : '') + nombre(tt.vues), l: tr('ebt.trafic.vues'), attrs: { 'data-ebt-chiffre': 'vues' } },
          { cle: 'ventes', n: nombre(tt.ventes), l: tr('ebt.trafic.ventes'), attrs: { 'data-ebt-chiffre': 'ventes' } },
        ] : []}/>
      </div>
      {inv && inv.length ? <Groupe titre={tr('ebt.trafic.invisiblesTitre')} n={inv.length} attrs={{ 'data-ebt-invisibles': inv.length }} pied={<>{tr('ebt.trafic.invisibles.pied')}{onPromotion ? <> <button type="button" className="ebt-lien" onClick={onPromotion}>{tr('ebt.trafic.promouvoir')}</button></> : null}</>}>
        {inv.map((a) => ligne(a, 'i'))}
      </Groupe> : null}
      <Groupe titre={tr('ebt.trafic.toutes')} n={toutes.length} large attrs={{ 'data-ebt-toutes': toutes.length }}
        pied={[t.debut && t.fin ? tr('ebt.trafic.periode', { debut: dateCourte(t.debut), fin: dateCourte(t.fin) }) : '', t.invisibles && t.invisibles.sansChiffres.length ? tr('ebt.trafic.sansChiffres', { n: t.invisibles.sansChiffres.length }) : ''].filter(Boolean).join(' · ')}>
        {visibles.length ? visibles.map((a) => ligne(a, 't')) : <div className="ebt-vide">{tr('ebt.trafic.aucune')}</div>}
        {!tout && toutes.length > 40 ? <div className="ebt-plus"><button type="button" className="ebt-lien" onClick={() => setTout(true)}>{tr('ebt.toutAfficher', { n: toutes.length })}</button></div> : null}
      </Groupe>
      <div className="ebt-large"><Pied at={at} lecture={lecture} onRelire={relire}/></div>
    </div>
  );
}

// ══ LA SANTÉ DU COMPTE ═══════════════════════════════════════════════════════
const POURCENT = (v) => (v == null ? '—' : nombre(v, { maximumFractionDigits: 2 }) + ' %');
export function SanteEbay({ compte, headers, domaine = 'www.ebay.fr', onReconnecter }) {
  const [s, relireS, atS, lectureS] = useLectureEbay('sante', compte, headers);
  const [l, relireL] = useLectureEbay('litiges', compte, headers);
  const [e, relireE] = useLectureEbay('evaluationsrecues', compte, headers);
  const relire = () => { relireS(); relireL(); relireE(); };
  const lien = (id) => `https://${domaine}/itm/${id}`;
  const li = l && l.ok !== false ? litigesOuverts(l) : null;
  const niv = s && s.ok !== false ? s.niveau : null;
  return (
    <div className="ebt" data-ebt="sante" data-ebt-etat={s === undefined ? 'en-cours' : 'lu'}>
      <Groupe titre={tr('ebt.sante.niveauTitre')} attrs={{ 'data-ebt-groupe': 'niveau' }} pied={tr('ebt.sante.niveau.pied')}>
        {s === undefined ? <Squelette/> : s.ok === false ? <Panne ko={s.ko || { raison: s.reason }} onReconnecter={onReconnecter} onReessayer={relire}/>
          : niv && !niv.ko ? <>
            <Rangee nom={tr('ebt.sante.niveau')} detail={niv.evalueLe ? tr('ebt.sante.evalueLe', { date: dateCourte(niv.evalueLe) }) : ''} valeur={nomNiveau(niv.niveau)} geste={niv.niveau === 'BELOW_STANDARD'} attrs={{ 'data-ebt-niveau': niv.niveau || 'aucun' }}/>
            {niv.prevu ? <Rangee nom={tr('ebt.sante.prevuTitre')} valeur={nomNiveau(niv.prevu)} gris geste={niv.prevu === 'BELOW_STANDARD'}/> : null}
            {(niv.metriques || []).map((m) => <Rangee key={m.cle} nom={tr('ebt.metrique.' + (['DEFECTIVE_TRANSACTION_RATE', 'CLAIMS_SAF_RATE', 'SHIPPING_MISS_RATE', 'CASES_CLOSED_WITHOUT_SELLER_RESOLUTION', 'MIN_TXN_COUNT', 'MIN_GMV', 'TRACKING_UPLOADED_ON_TIME_AND_VALIDATED_RATE'].includes(m.cle) ? m.cle : 'AUTRE'), { nom: m.nom || m.cle })}
              detail={m.seuil != null ? tr('ebt.sante.seuil', { seuil: m.type === 'RATE' ? POURCENT(m.seuil) : nombre(m.seuil) }) : ''} valeur={m.type === 'RATE' ? POURCENT(m.valeur) : m.valeur == null ? '—' : nombre(m.valeur)} gris geste={m.niveau === 'BELOW_STANDARD'} attrs={{ 'data-ebt-metrique': m.cle }}/>)}
          </> : <Panne ko={niv && niv.ko} onReconnecter={onReconnecter} onReessayer={relire}/>}
      </Groupe>
      {s && s.ok !== false ? <Groupe titre={tr('ebt.sante.reclamationsTitre')} attrs={{ 'data-ebt-groupe': 'reclamations' }} pied={tr('ebt.sante.reclamations.pied')}>
        {[['nonConforme', s.nonConforme], ['nonRecu', s.nonRecu]].map(([k, x]) => x && x.ko ? <Panne key={k} ko={x.ko} onReconnecter={onReconnecter}/>
          : <Rangee key={k} nom={tr('ebt.sante.' + k)} detail={x && x.lignes && x.lignes.length ? x.lignes.filter((y) => y.note === 'HIGH' || y.note === 'VERY_HIGH').map((y) => y.nom).slice(0, 3).join(', ') : ''} valeur={nomNote(x && x.note)} geste={x && (x.note === 'HIGH' || x.note === 'VERY_HIGH')} gris attrs={{ 'data-ebt-note': k + ':' + ((x && x.note) || 'aucune') }}/>)}
      </Groupe> : null}
      {s && s.ok !== false ? <Groupe titre={tr('ebt.sante.aCorrigerTitre')} n={Array.isArray(s.aCorriger) ? s.aCorriger.length : null} large attrs={{ 'data-ebt-groupe': 'a-corriger', 'data-n': Array.isArray(s.aCorriger) ? s.aCorriger.length : 'pas-su' }} pied={tr('ebt.sante.aCorriger.pied')}>
        {s.conformite && s.conformite.ko ? <Panne ko={s.conformite.ko} onReconnecter={onReconnecter} onReessayer={relire}/>
          : !Array.isArray(s.aCorriger) ? (Array.isArray(s.conformite) && !s.conformite.some((x) => x.n > 0) ? <div className="ebt-vide">{tr('ebt.sante.rienACorriger')}</div> : <Panne ko={{ raison: 'pas-su' }} onReessayer={relire}/>)
          : s.aCorriger.length ? s.aCorriger.map((c) => <Rangee key={c.itemId + c.type} nom={c.sku ? c.sku + ' · ' + c.itemId : c.itemId} libre
            detail={c.problemes.map((p) => [p.manque.length ? tr('ebt.sante.manque', { liste: p.manque.join(', ') }) : p.message, p.suggestions.length ? tr('ebt.sante.suggere', { liste: p.suggestions.map((x) => x.nom + (x.valeurs.length ? ' : ' + x.valeurs.join(', ') : '')).join(' ; ') }) : ''].filter(Boolean).join(' — ')).join(' · ')}
            href={lien(c.itemId)} attrs={{ 'data-ebt-corriger': c.itemId }}/>)
          : <div className="ebt-vide">{tr('ebt.sante.rienACorriger')}</div>}
      </Groupe> : null}
      <Groupe titre={tr('ebt.sante.litigesTitre')} n={li ? li.n : null} attrs={{ 'data-ebt-groupe': 'litiges', 'data-n': li ? li.n : 'pas-su' }} pied={tr('ebt.sante.litiges.pied')}>
        {l === undefined ? <Squelette n={2}/> : !li ? <Panne ko={(l && l.ko) || { raison: (l && l.reason) || 'pas-su' }} onReconnecter={onReconnecter} onReessayer={relireL}/> : <>
          {li.lignes.length ? li.lignes.map((x) => <Rangee key={x.partie + x.id} nom={tr('ebt.litige.' + x.partie) + (x.motif ? ' · ' + tr('ebt.motif.' + (['ITEM_NOT_RECEIVED', 'SIGNIFICANTLY_NOT_AS_DESCRIBED', 'FRAUD', 'DUPLICATE'].includes(x.motif) ? x.motif : 'AUTRE')) : '')}
            detail={[x.aToi ? (x.repondreAvant ? tr('ebt.litige.repondreAvant', { date: dateCourte(x.repondreAvant) }) : tr('ebt.litige.aToi')) : tr('ebt.litige.enCours'), x.ouvertLe ? tr('ebt.litige.ouvertLe', { date: dateCourte(x.ouvertLe) }) : ''].filter(Boolean).join(' · ')}
            valeur={x.montant ? euros(x.montant) : ''} geste={x.aToi} href={x.orderId ? `https://${domaine}/sh/ord/details?orderid=${encodeURIComponent(x.orderId)}` : x.itemId ? lien(x.itemId) : undefined} attrs={{ 'data-ebt-litige': x.partie + ':' + x.id, 'data-a-toi': x.aToi ? '1' : '0' }}/>)
            : <div className="ebt-vide">{tr('ebt.sante.aucunLitige')}</div>}
          {li.ko.map((k) => <Panne key={k} ko={(l[k] && l[k].ko) || { raison: 'pas-su' }} onReconnecter={onReconnecter}/>)}
        </>}
      </Groupe>
      <Groupe titre={tr('ebt.sante.evaluationsTitre')} attrs={{ 'data-ebt-groupe': 'evaluations' }} pied={tr('ebt.sante.evaluations.pied')}>
        {e === undefined ? <Squelette n={2}/> : e.ok === false ? <Panne ko={e.ko || { raison: e.reason }} onReessayer={relireE}/> : <>
          <Rangee nom={tr('ebt.sante.score')} detail={e.an ? tr('ebt.sante.an', { p: nombre(e.an.positives ?? 0), n: nombre(e.an.neutres ?? 0), m: nombre(e.an.negatives ?? 0) }) : ''} valeur={e.pourcent != null ? nombre(e.pourcent, { maximumFractionDigits: 1 }) + ' %' : '—'} attrs={{ 'data-ebt-score': e.score ?? 'pas-su' }}/>
          {(e.dernieres || []).slice(0, 10).map((f) => <Rangee key={f.id} nom={f.texte || '—'} libre detail={[f.titre, dateCourte(f.date)].filter(Boolean).join(' · ')}
            valeur={<span className={'ebt-etoile' + (f.type === 'Negative' ? ' is-geste' : '')} aria-label={tr('ebt.eval.' + f.type)}>{f.type === 'Positive' ? '+' : f.type === 'Negative' ? '−' : '='}</span>} attrs={{ 'data-ebt-eval': f.type }}/>)}
        </>}
      </Groupe>
      <div className="ebt-large"><Pied at={atS} lecture={lectureS} onRelire={relire}/></div>
    </div>
  );
}
