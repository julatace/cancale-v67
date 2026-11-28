// ── src/crm/ClientsEbay.jsx — Ventes · eBay → CLIENTS : le CRM eBay (28 nov., lot ebay-crm) ─────────────
// Julien : « copie les CRM eBay » (3Dsellers, eDesk, ChannelReply, Seller Hub). Quatre vues :
//   Acheteurs     l'annuaire (un acheteur = un compte eBay, jamais un nom) → la fiche (FicheAcheteur.jsx) ;
//   Auto          merci, expédition, après livraison, demande d'évaluation, évaluation positive auto —
//                 ÉTEINTS par défaut, allumés sur SON toucher confirmé, versions au hasard, journal ;
//                 puis les modèles de réponse ({acheteur} {article} {suivi}) des conversations eBay ;
//   Exclus        la liste d'exclusion, toutes plateformes (eBay, Vinted, Leboncoin, Vestiaire) ;
//   Avis et litiges  répondre à une évaluation reçue ; retours et litiges par échéance, gestes confirmés.
// Les règles : api/_lib/ebay-crm-regle.js (les mêmes que le serveur). Rien n'est deviné : « pas su » se dit.
import React from 'react';
import { Groupe, Rangee, Segmente, Feuille, Bouton, Attente, ChampRecherche, Champ, Vide } from '../natif/index.js';
import { tr, monnaie, date as dateLangue, dateRelative } from '../i18n/index.js';
import { appelCrm, oublierModeles, variablesDe, VARIABLES, LONGUEUR_EVALUATION, LONGUEUR_MESSAGE, TEXTES_MAX, cleExclusion, SITES_EXCLUSION } from './api.js';
import FicheAcheteur, { ZoneTexte } from './FicheAcheteur.jsx';
import './crm.css';

const jour = (iso) => (iso ? dateLangue(iso, { day: 'numeric', month: 'short' }) : '—');
const ilYa = (t) => { const ms = Date.now() - (typeof t === 'number' ? t : Date.parse(t || '')); if (!Number.isFinite(ms)) return '—'; const m = Math.round(ms / 60000); return m < 60 ? dateRelative(-m, 'minute') : m < 1440 ? dateRelative(-Math.round(m / 60), 'hour') : dateRelative(-Math.round(m / 1440), 'day'); };
const NOM_SITE = { ebay: 'eBay', vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const AUTO = [
  { cle: 'apresVente', titre: 'crm.auto.apresVente', sous: 'crm.auto.apresVenteSous', defauts: ['crm.defaut.apresVente', 'crm.defaut.apresVente2'] },
  { cle: 'expedition', titre: 'crm.auto.expedition', sous: 'crm.auto.expeditionSous', defauts: ['crm.defaut.expedition'] },
  { cle: 'livraison', titre: 'crm.auto.livraison', sous: 'crm.auto.livraisonSous', defauts: ['crm.defaut.livraison'], delai: true },
  { cle: 'demandeEval', titre: 'crm.auto.demandeEval', sous: 'crm.auto.demandeEvalSous', defauts: ['crm.defaut.demandeEval'], delai: true },
];
const EVAL = { cle: 'evalAuto', titre: 'crm.auto.evalAuto', sous: 'crm.auto.evalAutoSous', defauts: ['crm.defaut.evalAuto'] };
const NOM_AUTO = Object.fromEntries([...AUTO, EVAL].map((a) => [a.cle, a.titre]));
const SORTE = { retour: 'crm.sorte.retour', reclamation: 'crm.sorte.reclamation', cas: 'crm.sorte.cas', paiement: 'crm.sorte.paiement' };
const TYPE_AVIS = { Positive: 'crm.avis.positive', Neutral: 'crm.avis.neutre', Negative: 'crm.avis.negative' };
const MANQUE = { retours: 'crm.sorte.retour', reclamations: 'crm.sorte.reclamation', cas: 'crm.sorte.cas', paiements: 'crm.sorte.paiement' };

// Un « pas su » qui se relit : jamais une liste vide à sa place.
const PasSu = ({ onRelire, raison = '' }) => <Groupe pied={raison}><Rangee titre={tr('crm.passu')} sousTitre={tr('crm.relire')} fin="chevron" onClick={onRelire} attrs={{ 'data-crm-passu': '' }}/></Groupe>;

function Acheteurs({ headers, compte, onFiche }) {
  const [l, setL] = React.useState(undefined), [q, setQ] = React.useState(''), [err, setErr] = React.useState('');
  const charger = React.useCallback(async () => { setL(undefined); try { const j = await appelCrm('crmacheteurs', {}, headers, compte); setL(j.acheteurs); } catch (e) { setErr(e.message); setL(null); } }, [compte]);
  React.useEffect(() => { charger(); }, [compte]);
  const qq = q.trim().toLowerCase();
  const vus = Array.isArray(l) ? l.filter((a) => !qq || a.acheteur.toLowerCase().includes(qq)) : l;
  return <>
    <div className="crm-vues"><ChampRecherche valeur={q} onChange={setQ} placeholder={tr('crm.chercher')} attrs={{ 'data-crm-chercher': '' }}/></div>
    {vus === undefined ? <Attente forme="rangees" n={5}/> : vus === null ? <PasSu onRelire={charger} raison={err}/> : !l.length ? <Vide phrase={tr('crm.acheteurs.vide')}/> :
      <Groupe titre={tr('crm.acheteurs.titre')} pied={tr('crm.acheteurs.pied')} attrs={{ 'data-crm-acheteurs': vus.length }}>
        {vus.length ? vus.map((a) => <Rangee key={a.acheteur} titre={a.acheteur} sousTitre={tr('crm.acheteurs.sous', { n: a.n, quand: jour(a.dernier) })} fin="chevron" onClick={() => onFiche(a.acheteur)} attrs={{ 'data-crm-acheteur': a.acheteur }}/>) : <Rangee titre={tr('crm.acheteurs.aucun')}/>}
      </Groupe>}
  </>;
}

// La feuille d'un automatisme : ses versions (au hasard), son objet, son délai.
function FeuilleAuto({ def, reglage, ouverte, onFermer, onEnregistrer }) {
  const eval_ = def && def.cle === 'evalAuto';
  const max = eval_ ? LONGUEUR_EVALUATION : LONGUEUR_MESSAGE;
  const [textes, setTextes] = React.useState([]), [sujet, setSujet] = React.useState(''), [delai, setDelai] = React.useState('0');
  React.useEffect(() => {
    if (!ouverte || !def) return;
    setTextes(reglage && reglage.textes.length ? reglage.textes : def.defauts.map((k) => tr(k)));
    setSujet((reglage && reglage.sujet) || tr('crm.defaut.sujet.' + def.cle));
    setDelai(String(reglage ? reglage.delaiJ : 0));
  }, [ouverte, def && def.cle]);
  if (!def) return <Feuille ouverte={false} onFermer={onFermer}/>;
  const valides = textes.filter((t) => t.trim()).every((t) => variablesDe(t).every((v) => VARIABLES.includes(v) && (!eval_ || v !== 'suivi')));
  return <Feuille ouverte={ouverte} onFermer={onFermer} titre={eval_ ? tr('crm.auto.evalTitre') : tr(def.titre)} detente="pleine" attrs={{ 'data-crm-feuille-auto': def.cle }}
    pied={<Bouton variante="plein" indisponible={!valides || !textes.some((t) => t.trim())} onClick={() => onEnregistrer({ textes: textes.filter((t) => t.trim()), sujet, delaiJ: def.delai ? Math.max(0, Math.min(30, parseInt(delai, 10) || 0)) : undefined })} attrs={{ 'data-crm-auto-enregistrer': '' }}>{tr('crm.enregistrer')}</Bouton>}>
    <p className="crm-pied">{eval_ ? tr('crm.auto.evalPied') : tr('crm.auto.textes')} · {tr(eval_ ? 'crm.auto.variablesEval' : 'crm.auto.variables')}</p>
    {!eval_ ? <Champ libelle={tr('crm.auto.sujet')} valeur={sujet} onChange={(v) => setSujet(String(v).slice(0, 100))}/> : null}
    {def.delai ? <Champ libelle={tr('crm.auto.delai')} valeur={delai} inputMode="numeric" onChange={(v) => setDelai(String(v).replace(/\D/g, '').slice(0, 2))}/> : null}
    {textes.map((t, i) => <ZoneTexte key={i} libelle={tr('crm.auto.texte', { n: i + 1 })} valeur={t} max={max} lignes={eval_ ? 2 : 4} onChange={(v) => setTextes((x) => x.map((y, k) => (k === i ? v : y)))} attrs={{ 'data-crm-version': i + 1 }}/>)}
    {textes.length < TEXTES_MAX ? <div className="crm-ligne-bouton"><Bouton variante="texte" onClick={() => setTextes((x) => [...x, ''])}>{tr('crm.auto.ajouterVersion')}</Bouton></div> : null}
  </Feuille>;
}

function Automatismes({ headers, compte, confirm }) {
  const [d, setD] = React.useState(undefined), [err, setErr] = React.useState(''), [edit, setEdit] = React.useState(null);
  const charger = React.useCallback(async () => { setD(undefined); try { setD(await appelCrm('crmreglages', {}, headers, compte)); } catch (e) { setErr(e.message); setD(null); } }, [compte]);
  React.useEffect(() => { charger(); }, [compte]);
  if (d === undefined) return <Attente forme="rangees" n={5}/>;
  if (d === null) return <PasSu onRelire={charger} raison={err}/>;
  const reg = d.reglages.auto;
  const regler = async (def, { actif, textes, sujet, delaiJ }) => {
    if (actif && !await confirm({ title: tr('crm.auto.confirmer.titre', { quoi: tr(def.titre) }), desc: tr('crm.auto.confirmer.desc'), ok: tr('crm.auto.confirmer.ok'), cancel: tr('crm.annuler') })) return;
    try { const j = await appelCrm('crmregler', { quoi: def.cle, actif, textes, ...(sujet != null ? { sujet } : {}), ...(delaiJ != null ? { delaiJ } : {}), confirme: actif === true }, headers, compte, true); setD((x) => ({ ...x, reglages: j.reglages })); setErr(''); }
    catch (e) { setErr(tr('crm.erreur', { raison: e.message })); }
  };
  const basculer = (def) => (v) => {
    const r = reg[def.cle];
    const textes = r.textes.length ? r.textes : def.defauts.map((k) => tr(k));
    regler(def, { actif: v, textes, sujet: def.cle === 'evalAuto' ? undefined : (r.sujet || tr('crm.defaut.sujet.' + def.cle)) });
  };
  const rangee = (def) => { const r = reg[def.cle]; return <Rangee key={def.cle} titre={tr(def.titre)} sousTitre={r.actif ? tr('crm.auto.allume', { date: jour(r.depuis) }) : tr(def.sous, { n: r.delaiJ })}
    interrupteur={{ actif: r.actif, onChange: basculer(def), attrs: { 'data-crm-interrupteur': def.cle } }} attrs={{ 'data-crm-auto': def.cle, 'data-crm-actif': r.actif ? '1' : '0' }}/>; };
  const lignes = Array.isArray(d.journal) ? d.journal : null;
  return <>
    <Groupe titre={tr('crm.auto.titre')} pied={tr('crm.auto.pied')}>{AUTO.map(rangee)}</Groupe>
    <Groupe titre={tr('crm.auto.textes')}>{[...AUTO, EVAL].map((def) => <Rangee key={def.cle} titre={tr(def.titre)} sousTitre={(reg[def.cle].textes[0] || tr(def.defauts[0])).slice(0, 80)} fin="chevron" onClick={() => setEdit(def)} attrs={{ 'data-crm-modifier': def.cle }}/>)}</Groupe>
    <Groupe titre={tr('crm.auto.evalAuto')} pied={tr('crm.auto.evalPied')}>{rangee(EVAL)}</Groupe>
    <Groupe titre={tr('crm.journal.titre')} pied={d.dernierPassage ? tr('crm.journal.dernier', { quand: ilYa(d.dernierPassage.le), n: d.dernierPassage.envoyes }) : ''} attrs={{ 'data-crm-journal': lignes ? lignes.length : '' }}>
      {lignes === null ? <Rangee titre={tr('crm.passu')}/> : lignes.length ? lignes.slice(0, 20).map((x, i) => <Rangee key={i} titre={tr(NOM_AUTO[x.quoi] || 'crm.auto.titre')} sousTitre={tr('crm.journal.ligne', { acheteur: x.acheteur, v: x.version })} detailValeur={tr('crm.etat.' + (x.etat === 'envoye' ? 'envoye' : x.etat === 'refuse' ? 'refuse' : 'incertain'))} valeur={ilYa(x.le)} ton={x.etat === 'incertain' ? 'ambre' : 'neutre'}/>) : <Rangee titre={tr('crm.journal.vide')}/>}
    </Groupe>
    {err ? <p className="crm-pied" role="status">{err}</p> : null}
    <FeuilleAuto def={edit} reglage={edit ? reg[edit.cle] : null} ouverte={!!edit} onFermer={() => setEdit(null)} onEnregistrer={async (v) => { const def = edit; setEdit(null); await regler(def, { actif: reg[def.cle].actif, ...v }); }}/>
  </>;
}

function Reponses({ headers, compte }) {
  const [m, setM] = React.useState(undefined), [err, setErr] = React.useState(''), [edit, setEdit] = React.useState(null);
  const charger = React.useCallback(async () => { setM(undefined); try { const j = await appelCrm('crmreglages', {}, headers, compte); setM(j.reglages.modeles); } catch (e) { setErr(e.message); setM(null); } }, [compte]);
  React.useEffect(() => { charger(); }, [compte]);
  const ecrire = async (liste) => { try { const j = await appelCrm('crmregler', { modeles: liste }, headers, compte, true); setM(j.reglages.modeles); oublierModeles(compte); setEdit(null); } catch (e) { setErr(tr('crm.erreur', { raison: e.message })); } };
  if (m === undefined) return <Attente forme="rangees" n={3}/>;
  if (m === null) return <PasSu onRelire={charger} raison={err}/>;
  const ok = edit && edit.nom.trim() && edit.texte.trim() && variablesDe(edit.texte).every((v) => VARIABLES.includes(v));
  return <>
    <Groupe titre={tr('crm.reponses.titre')} pied={tr('crm.reponses.pied')} attrs={{ 'data-crm-modeles-liste': m.length }}>
      {m.map((x) => <Rangee key={x.id} titre={x.nom} sousTitre={x.texte.slice(0, 90)} fin="chevron" onClick={() => setEdit({ ...x })} attrs={{ 'data-crm-modele-ligne': x.id }}/>)}
      <Rangee titre={tr('crm.reponses.ajouter')} fin="chevron" onClick={() => setEdit({ id: 'm' + Date.now().toString(36), nom: '', texte: '', neuf: true })} attrs={{ 'data-crm-modele-ajouter': '' }}/>
    </Groupe>
    {err ? <p className="crm-pied" role="status">{err}</p> : null}
    <Feuille ouverte={!!edit} onFermer={() => setEdit(null)} titre={edit && !edit.neuf ? edit.nom : tr('crm.reponses.ajouter')} detente="auto"
      pied={<Bouton variante="plein" indisponible={!ok} onClick={() => ecrire(edit.neuf ? [...m, { id: edit.id, nom: edit.nom, texte: edit.texte }] : m.map((x) => (x.id === edit.id ? { id: x.id, nom: edit.nom, texte: edit.texte } : x)))} attrs={{ 'data-crm-modele-enregistrer': '' }}>{tr('crm.enregistrer')}</Bouton>}>
      {edit ? <>
        <Champ libelle={tr('crm.reponses.nom')} valeur={edit.nom} onChange={(v) => setEdit((x) => ({ ...x, nom: String(v).slice(0, 60) }))}/>
        <ZoneTexte libelle={tr('crm.reponses.texte')} valeur={edit.texte} onChange={(v) => setEdit((x) => ({ ...x, texte: v }))}/>
        <p className="crm-pied">{tr('crm.auto.variables')}</p>
        {!edit.neuf ? <div className="crm-ligne-bouton"><Bouton variante="destructif" confirmation={tr('crm.reponses.supprimer')} onClick={() => ecrire(m.filter((x) => x.id !== edit.id))}>{tr('crm.reponses.supprimer')}</Bouton></div> : null}
      </> : null}
    </Feuille>
  </>;
}

function Exclus({ headers, compte, confirm }) {
  const [l, setL] = React.useState(undefined), [err, setErr] = React.useState(''), [aj, setAj] = React.useState(null);
  const charger = React.useCallback(async () => { setL(undefined); try { const j = await appelCrm('crmexclus', {}, headers, compte); setL(j.exclus); } catch (e) { setErr(e.message); setL(null); } }, []);
  React.useEffect(() => { charger(); }, []);
  const reintegrer = async (e) => { try { const j = await appelCrm('crmreintegrer', { site: e.site, id: e.id }, headers, compte, true); setL(j.exclus); } catch (x) { setErr(tr('crm.erreur', { raison: x.message })); } };
  const ajouter = async () => {
    const id = cleExclusion(aj.site, aj.id);
    if (!await confirm({ title: tr('crm.exclus.confirmer.titre', { id }), desc: tr('crm.exclus.confirmer.desc', { site: NOM_SITE[aj.site] }), ok: tr('crm.exclus.confirmer.ok'), cancel: tr('crm.annuler') })) return undefined;
    try { const j = await appelCrm('crmexclure', { site: aj.site, id: aj.id, note: aj.note, confirme: true }, headers, compte, true); setL(j.exclus); setAj(null); return undefined; }
    catch (x) { throw new Error(tr('crm.erreur', { raison: x.message })); }
  };
  if (l === undefined) return <Attente forme="rangees" n={3}/>;
  if (l === null) return <PasSu onRelire={charger} raison={err}/>;
  return <>
    <Groupe titre={tr('crm.exclus.titre')} pied={tr('crm.exclus.pied')} attrs={{ 'data-crm-exclus': l.length }}>
      {l.map((e) => <Rangee key={e.site + e.id} titre={e.id} sousTitre={`${NOM_SITE[e.site]}${e.le ? ' · ' + tr('crm.exclus.depuis', { date: jour(e.le) }) : ''}${e.note ? ' · ' + e.note : ''}`}
        actions={[{ cle: 'reintegrer', libelle: tr('crm.exclus.reintegrer'), ton: 'neutre', onClick: () => reintegrer(e), franc: true }]} attrs={{ 'data-crm-exclu-ligne': e.site + ':' + e.id }}/>)}
      <Rangee titre={tr('crm.exclus.ajouter')} fin="chevron" onClick={() => setAj({ site: 'ebay', id: '', note: '' })} attrs={{ 'data-crm-exclure-ouvrir': '' }}/>
    </Groupe>
    {err ? <p className="crm-pied" role="status">{err}</p> : null}
    <Feuille ouverte={!!aj} onFermer={() => setAj(null)} titre={tr('crm.exclus.ajouter')} detente="auto"
      pied={<Bouton variante="plein" indisponible={!aj || !cleExclusion(aj.site, aj.id)} onClick={ajouter} attrs={{ 'data-crm-exclure': '' }}>{tr('crm.exclus.confirmer.ok')}</Bouton>}>
      {aj ? <>
        <div className="crm-vues"><Segmente libelle={tr('crm.exclus.site')} valeur={aj.site} onChange={(s) => setAj((x) => ({ ...x, site: s }))} options={SITES_EXCLUSION.map((s) => ({ cle: s, libelle: NOM_SITE[s] }))}/></div>
        <Champ libelle={tr('crm.exclus.id')} valeur={aj.id} onChange={(v) => setAj((x) => ({ ...x, id: String(v).slice(0, 200) }))}/>
        <Champ libelle={tr('crm.exclus.note')} valeur={aj.note} onChange={(v) => setAj((x) => ({ ...x, note: String(v).slice(0, 120) }))}/>
        {aj.site === 'vinted' ? <p className="crm-pied">{tr('crm.exclus.vintedPied')}</p> : null}
      </> : null}
    </Feuille>
  </>;
}

function Suivi({ headers, compte, confirm, domaine }) {
  const [avis, setAvis] = React.useState(undefined), [lit, setLit] = React.useState(undefined), [err, setErr] = React.useState('');
  const [rep, setRep] = React.useState(null), [geste, setGeste] = React.useState(null);
  const lireAvis = React.useCallback(async () => { setAvis(undefined); try { setAvis((await appelCrm('crmavis', {}, headers, compte)).avis); } catch (e) { setErr(e.message); setAvis(null); } }, [compte]);
  const lireLit = React.useCallback(async () => { setLit(undefined); try { setLit(await appelCrm('crmlitiges', {}, headers, compte)); } catch (e) { setErr(e.message); setLit(null); } }, [compte]);
  React.useEffect(() => { lireAvis(); lireLit(); }, [compte]);
  const publier = async () => {
    if (!await confirm({ title: tr('crm.avis.confirmer.titre'), desc: rep.texte, ok: tr('crm.avis.confirmer.ok'), cancel: tr('crm.annuler') })) return undefined;
    try { await appelCrm('crmrepondreavis', { feedbackId: rep.avis.id, texte: rep.texte, confirme: true }, headers, compte, true); setAvis((l) => l.map((a) => (a.id === rep.avis.id ? { ...a, reponse: rep.texte } : a))); setRep(null); return undefined; }
    catch (e) { throw new Error(tr('crm.erreur', { raison: e.message })); }
  };
  // Un geste sur un retour ou un litige : l'action EXISTANTE de la route pour un retour (deciderretour,
  // rembourserretour), `crmcontester` pour un litige de paiement ou une réclamation. Toujours confirmé.
  const faire = async (quoi) => {
    const x = geste.x;
    const libelle = quoi === 'accepter' ? tr('crm.geste.accepter') : quoi === 'refuser' ? tr('crm.geste.refuser') : quoi === 'rembourser' ? tr('crm.geste.rembourser', { montant: monnaie(Number(x.montant.value), x.montant.currency) }) : tr('crm.geste.contester');
    if (!await confirm({ title: tr('crm.geste.confirmer', { geste: libelle }), desc: tr('crm.geste.confirmerDesc'), ok: libelle, cancel: tr('crm.annuler') })) return undefined;
    try {
      if (quoi === 'accepter' || quoi === 'refuser') await appelCrm('deciderretour', { returnId: x.id, decision: quoi === 'accepter' ? 'ACCEPT' : 'DECLINE', commentaire: geste.note, confirme: true }, headers, compte, true);
      else if (quoi === 'rembourser') await appelCrm('rembourserretour', { returnId: x.id, montantVu: x.montant.value, devise: x.montant.currency, confirme: true }, headers, compte, true);
      else await appelCrm('crmcontester', { sorte: x.sorte, id: x.id, note: geste.note, confirme: true }, headers, compte, true);
      setGeste(null); lireLit(); return tr('crm.geste.fait');
    } catch (e) { throw new Error(tr('crm.erreur', { raison: e.message })); }
  };
  const l = lit && lit.litiges;
  return <>
    {avis === undefined ? <Attente forme="rangees" n={3}/> : avis === null ? <PasSu onRelire={lireAvis} raison={err}/> :
      <Groupe titre={tr('crm.avis.titre')} attrs={{ 'data-crm-avis': avis.length }}>
        {avis.length ? avis.map((a) => <Rangee key={a.id} titre={a.texte || '—'} lignes={2} sousTitre={`${tr(TYPE_AVIS[a.type])} · ${a.de} · ${jour(a.date)}`} ton={a.type === 'Negative' && !a.reponse ? 'ambre' : 'neutre'}
          detailValeur={a.reponse ? tr('crm.fiche.repondu') : ''} {...(a.reponse ? {} : { fin: 'chevron', onClick: () => setRep({ avis: a, texte: '' }) })} attrs={{ 'data-crm-avis-ligne': a.id, 'data-crm-repondu': a.reponse ? '1' : '0' }}/>) : <Rangee titre={tr('crm.avis.vide')}/>}
      </Groupe>}
    {lit === undefined ? <Attente forme="rangees" n={3}/> : lit === null ? <PasSu onRelire={lireLit} raison={err}/> :
      <Groupe titre={tr('crm.litiges.titre')} pied={[tr('crm.litiges.pied'), lit.manque && lit.manque.length ? tr('crm.litiges.manque', { quoi: lit.manque.map((k) => tr(MANQUE[k])).join(', ') }) : '', lit.scopePaiement ? tr('crm.litiges.scope') : ''].filter(Boolean).join(' ')} attrs={{ 'data-crm-litiges': l.length }}>
        {l.length ? l.map((x) => <Rangee key={x.sorte + x.id} titre={tr(SORTE[x.sorte] || 'crm.sorte.cas')} sousTitre={x.ouvert ? (x.limite ? tr('crm.litiges.avant', { date: jour(x.limite) }) : tr('crm.litiges.sansDate')) : tr('crm.litiges.clos')} ton={x.ouvert && x.limite && Date.parse(x.limite) - Date.now() < 3 * 86400000 ? 'ambre' : 'neutre'}
          valeur={x.montant ? monnaie(Number(x.montant.value), x.montant.currency) : null} detailValeur={x.titre || ''} fin={x.ouvert ? 'chevron' : null} onClick={x.ouvert ? () => setGeste({ x, note: '' }) : null} attrs={{ 'data-crm-litige': x.sorte + ':' + x.id }}/>) : <Rangee titre={tr('crm.litiges.vide')}/>}
      </Groupe>}
    <Feuille ouverte={!!rep} onFermer={() => setRep(null)} titre={rep ? tr('crm.avis.feuille', { acheteur: rep.avis.de }) : ''} detente="auto"
      pied={<Bouton variante="plein" indisponible={!rep || !rep.texte.trim()} onClick={publier} attrs={{ 'data-crm-avis-publier': '' }}>{tr('crm.avis.confirmer.ok')}</Bouton>}>
      {rep ? <><p className="crm-pied">« {rep.avis.texte} »</p><ZoneTexte libelle={tr('crm.avis.repondre')} valeur={rep.texte} max={LONGUEUR_EVALUATION} lignes={2} onChange={(v) => setRep((r) => ({ ...r, texte: v }))}/><p className="crm-pied">{tr('crm.avis.pied')}</p></> : null}
    </Feuille>
    <Feuille ouverte={!!geste} onFermer={() => setGeste(null)} titre={geste ? tr(SORTE[geste.x.sorte]) : ''} detente="auto" attrs={{ 'data-crm-feuille-litige': geste ? geste.x.id : '' }}>
      {geste ? <>
        <Groupe>
          {geste.x.sorte === 'retour' && geste.x.etat === 'RETURN_REQUESTED' ? <Rangee titre={tr('crm.geste.accepter')} fin="chevron" onClick={() => faire('accepter')} attrs={{ 'data-crm-geste': 'accepter' }}/> : null}
          {geste.x.sorte === 'retour' && geste.x.montant && !geste.x.rembourse ? <Rangee titre={tr('crm.geste.rembourser', { montant: monnaie(Number(geste.x.montant.value), geste.x.montant.currency) })} fin="chevron" onClick={() => faire('rembourser')} attrs={{ 'data-crm-geste': 'rembourser' }}/> : null}
          {geste.x.sorte === 'retour' && geste.x.etat === 'RETURN_REQUESTED' ? <Rangee titre={tr('crm.geste.refuser')} fin="chevron" indisponible={!geste.note.trim()} raison={tr('crm.geste.note')} onClick={() => faire('refuser')} attrs={{ 'data-crm-geste': 'refuser' }}/> : null}
          {geste.x.sorte === 'paiement' || geste.x.sorte === 'reclamation' ? <Rangee titre={tr('crm.geste.contester')} fin="chevron" indisponible={!geste.note.trim()} raison={tr('crm.geste.note')} onClick={() => faire('contester')} attrs={{ 'data-crm-geste': 'contester' }}/> : null}
          <Rangee titre={tr('crm.geste.surEbay')} fin="chevron" onClick={() => { try { window.open(geste.x.orderId ? `https://${domaine}/sh/ord/details?orderid=${encodeURIComponent(geste.x.orderId)}` : `https://${domaine}/sh/ord`, '_blank', 'noopener'); } catch (_) {} }}/>
        </Groupe>
        {geste.x.sorte !== 'cas' ? <ZoneTexte libelle={tr('crm.geste.note')} valeur={geste.note} max={1000} lignes={3} onChange={(v) => setGeste((g) => ({ ...g, note: v }))}/> : null}
      </> : null}
    </Feuille>
  </>;
}

export default function ClientsEbay({ compte = 'principal', headers, confirm, domaine = 'www.ebay.fr' }) {
  const [vue, setVue] = React.useState(() => { try { const v = sessionStorage.getItem('vrm_crm_vue'); return ['acheteurs', 'auto', 'exclus', 'suivi'].includes(v) ? v : 'acheteurs'; } catch (_) { return 'acheteurs'; } });
  const [fiche, setFiche] = React.useState(null);
  const choisir = (v) => { setVue(v); try { sessionStorage.setItem('vrm_crm_vue', v); } catch (_) {} };
  const opts = [['acheteurs', 'crm.vue.acheteurs'], ['auto', 'crm.vue.auto'], ['exclus', 'crm.vue.exclus'], ['suivi', 'crm.vue.suivi']].map(([cle, k]) => ({ cle, libelle: tr(k) }));
  return <section data-crm-ebay={vue} aria-label={tr('crm.vues')}>
    <div className="crm-vues"><Segmente libelle={tr('crm.vues')} valeur={vue} onChange={choisir} options={opts}/></div>
    {vue === 'acheteurs' ? <Acheteurs headers={headers} compte={compte} onFiche={setFiche}/> : null}
    {/* Quatre vues (cinq ne tiennent pas à 390 px) : les modèles de réponse vivent sous les automatismes. */}
    {vue === 'auto' ? <><Automatismes headers={headers} compte={compte} confirm={confirm}/><Reponses headers={headers} compte={compte}/></> : null}
    {vue === 'exclus' ? <Exclus headers={headers} compte={compte} confirm={confirm}/> : null}
    {vue === 'suivi' ? <Suivi headers={headers} compte={compte} confirm={confirm} domaine={domaine}/> : null}
    <FicheAcheteur acheteur={fiche || ''} compte={compte} headers={headers} confirm={confirm} ouverte={!!fiche} onFermer={() => setFiche(null)}/>
  </section>;
}
