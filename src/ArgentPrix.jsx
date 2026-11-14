// ════════════════════════════════════════════════════════════════════════════
//  ARGENT ET PRIX — les cartes du lot argent-prix (14 nov., propositions 113, 114,
//  115, 116, 121, 122 validées par Julien : « fais tout »). AUCUNE règle ici :
//  chaque carte MET EN PAGE la sortie d'une règle pure (src/tauxOffres.js,
//  src/soldes.js, api/_lib/comptable-lien.js, src/revisionMois.js, src/ecartsPrix.js,
//  src/prixVoulu.js). Aucun import d'App.jsx : les données et les gestes arrivent en
//  props. Direction « Atelier » (le titre de section HORS de la carte, la couverture
//  en une ligne à côté, cartes sans bordure, explications repliées) ; aucun montant
//  en bleu ; ambre = un geste à faire ; « — » = pas su (jamais 0).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { BoutonBase as Bouton, SegmenteBase } from './composants/Bouton.jsx';
import { SheetShell } from './composants/SheetShell.jsx';
import { pctTexte } from './argentPrixTextes.js';
import { netTape, prixAAfficher } from './prixVoulu.js';
const DUREES_J = [7, 30, 90, 365];   // = api/_lib/comptable-lien.js DUREES_J (audit-argent-prix le vérifie)
import './argent-choix.css';
import './argent-prix.css';

const eur = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : monnaie(Number(v), 'EUR', Math.round(Number(v) * 100) % 100 ? undefined : { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const eurC = (c) => (c == null ? '—' : eur(c / 100));
const n0 = (v) => (v == null ? '—' : String(v));
const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective', Vinted: 'Vinted', Leboncoin: 'Leboncoin', eBay: 'eBay', Vestiaire: 'Vestiaire Collective' };
const jourCourt = (iso) => (iso ? dateLoc(String(iso).length === 10 ? iso + 'T12:00:00' : iso, { day: 'numeric', month: 'short' }) : '');

function Section({ titre, couv, children, ...rest }) {
  return (
    <section className="vrm-ac-section vrm-ap" {...rest}>
      <div className="vrm-ac-tete">
        <h2 className="vrm-ac-titre">{titre}</h2>
        {couv ? <p className="vrm-ac-couv">{couv}</p> : null}
      </div>
      {children}
    </section>
  );
}
const Repli = ({ titre, children }) => (
  <details className="vrm-ac-repli vrm-ap-repli"><summary>{titre}</summary><p className="vrm-ac-note">{children}</p></details>
);

// ── 113 · LES OFFRES, COMPTE PAR COMPTE ─────────────────────────────────────
export function TauxOffresCarte({ T, nomDe = (u) => u }) {
  useLangue();
  if (!T || T.etat === 'encours') return null;
  if (T.etat !== 'lu' || !T.comptes.some((c) => (c.recues || 0) > 0)) {
    return <Section titre={tr('ap.off.titre')} data-taux-offres={T.etat === 'lu' ? 'aucune' : 'passu'}>
      <p className="vrm-ac-note">{T.etat === 'lu' ? tr('ap.off.aucune') : tr('ap.off.pasLues')}</p></Section>;
  }
  const t = T.total;
  const am = (x) => (x ? tr('ap.auMoins') + ' ' : '');
  return (
    <Section titre={tr('ap.off.titre')} couv={tr('ap.off.couv', { n: t.recues, j: t.juges == null ? '—' : t.juges })} data-taux-offres="lu"
      data-to-recues={t.recues} data-to-acceptees={t.acceptees} data-to-payees={t.payees == null ? '' : t.payees} data-to-taux-acc={t.tauxAcceptation == null ? '' : t.tauxAcceptation} data-to-taux-pay={t.tauxPaiement == null ? '' : t.tauxPaiement}>
      <div className="vrm-ac-carte">
        <div className="vrm-ac-tuiles">
          <div className="vrm-ac-tuile"><b className="vrm-ac-chiffre">{am(t.partiel)}{n0(t.recues)}</b><span className="vrm-ac-libelle">{tr('ap.off.recues')}</span></div>
          <div className="vrm-ac-tuile"><b className="vrm-ac-chiffre">{pctTexte(t.tauxAcceptation)}</b><span className="vrm-ac-libelle">{tr('ap.off.acceptees', { n: n0(t.acceptees) })}</span></div>
          <div className="vrm-ac-tuile"><b className="vrm-ac-chiffre">{pctTexte(t.tauxPaiement)}</b><span className="vrm-ac-libelle">{tr('ap.off.payees', { n: n0(t.payees) })}</span></div>
        </div>
      </div>
      <ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste">
        {T.comptes.filter((c) => c.recues != null).map((c) => (
          <li key={c.compte || 'x'} className="vrm-ac-ligne" data-to-compte={c.compte} data-to-recues={c.recues} data-to-acceptees={c.acceptees} data-to-payees={c.payees == null ? '' : c.payees}
            data-to-non-payees={c.nonPayees == null ? '' : c.nonPayees} data-to-attente={c.attente} data-to-passu={c.passu} data-to-taux-acc={c.tauxAcceptation == null ? '' : c.tauxAcceptation} data-to-taux-pay={c.tauxPaiement == null ? '' : c.tauxPaiement}>
            <span className="vrm-ac-corps">
              <span className="vrm-ac-titre-ligne vrm-sensible">{nomDe(c.compte)}</span>
              <span className="vrm-ac-sous">{tr('ap.off.ligne', { r: am(c.partiel) + n0(c.recues), a: n0(c.acceptees), p: n0(c.payees) })}{c.attente ? ' · ' + tr('ap.off.attente', { n: c.attente }) : ''}{c.passu ? ' · ' + tr('ap.off.passu', { n: c.passu }) : ''}</span>
            </span>
            <span className="vrm-ac-droite"><b className="vrm-ac-montant">{pctTexte(c.tauxAcceptation)}</b><small className="vrm-ac-sous">{tr('ap.off.payeesCourt', { p: pctTexte(c.tauxPaiement) })}</small></span>
          </li>
        ))}
      </ul>
      <Repli titre={tr('ap.comment')}>{tr('ap.off.comment')}</Repli>
    </Section>
  );
}

// ── 122 · LE PRIX À AFFICHER POUR TOUCHER X € ───────────────────────────────
export function PrixVouluCarte({ taux }) {
  useLangue();
  const [texte, setTexte] = React.useState('');
  const net = netTape(texte);
  const T = taux ? prixAAfficher(net, taux) : null;
  return (
    <Section titre={tr('ap.pv.titre')} couv={tr('ap.pv.couv')} data-prix-voulu={taux ? (net == null ? 'vide' : 'ok') : 'encours'}>
      <div className="vrm-ac-carte">
        <label className="vrm-ap-champ">
          <span className="vrm-ac-libelle">{tr('ap.pv.jeVeux')}</span>
          <span className="vrm-ap-saisie"><input inputMode="decimal" autoComplete="off" value={texte} placeholder="80" data-pv-net="" aria-label={tr('ap.pv.jeVeux')} onChange={(e) => setTexte(e.target.value)}/><b>€</b></span>
        </label>
        {texte && net == null ? <p className="vrm-ac-note is-ambre" data-pv-illisible="">{tr('ap.pv.illisible')}</p> : null}
      </div>
      {T && T.etat === 'ok' ? (
        <ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste" data-pv-n={T.sites.length}>
          {T.sites.map((s) => (
            <li key={s.site} className="vrm-ac-ligne" data-pv-site={s.site} data-pv-prix={s.prix == null ? '' : s.prix} data-pv-arrondi={s.arrondi == null ? '' : s.arrondi} data-pv-net-arrondi={s.netArrondi == null ? '' : s.netArrondi} data-pv-etat={s.etat}>
              <span className="vrm-ac-corps">
                <span className="vrm-ac-titre-ligne">{NOM_SITE[s.site]}</span>
                <span className="vrm-ac-sous">{s.etat === 'pasLu' ? tr('ap.pv.r.' + (s.raison || 'pasLu'))
                  : s.etat === 'exact' ? tr(s.site === 'eBay' ? 'ap.pv.exactEbay' : 'ap.pv.exact')
                    : tr(s.site === 'eBay' ? 'ap.pv.environEbay' : 'ap.pv.environ', { p: pctTexte(s.taux / 100), n: s.n, net: eurC(s.netArrondi) })}</span>
              </span>
              <span className="vrm-ac-droite"><b className="vrm-ac-montant">{eurC(s.arrondi)}</b>{s.prix != null && s.prix !== s.arrondi ? <small className="vrm-ac-sous">{tr('ap.pv.auCentime', { p: eurC(s.prix) })}</small> : null}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Repli titre={tr('ap.comment')}>{tr('ap.pv.comment')}</Repli>
    </Section>
  );
}

// ── 121 · LA MÊME PAIRE À DEUX PRIX ────────────────────────────────────────
export function EcartsPrixPorte({ onOuvrir }) {
  useLangue();
  return (
    <Section titre={tr('ap.ec.titre')} couv={tr('ap.ec.porte')} data-ecarts-porte="">
      <Bouton variante="secondaire" icone="search" className="vrm-ac-lien" data-ecarts-ouvrir="" onClick={onOuvrir}>{tr('ap.ec.verifier')}</Bouton>
    </Section>
  );
}
export function EcartsPrixFeuille({ res, manques = [], onChanger, onFermer, Retour }) {
  useLangue();
  const ligne = (e, voulu) => (
    <li key={e.num} className="vrm-ac-ligne" data-ecart-num={e.num} data-ecart-cts={Math.round(e.ecart * 100)} data-ecart-voulu={voulu ? '1' : '0'}>
      <span className="vrm-ac-num">N°{e.num}</span>
      <span className="vrm-ac-corps">
        <span className="vrm-ac-titre-ligne">{e.sites.map((s) => `${NOM_SITE[s.site]} ${eur(s.prix)}`).join(' · ')}</span>
        <span className="vrm-ac-sous">{voulu ? tr('ap.ec.voulu') : tr('ap.ec.ecart', { e: eur(e.ecart) })}</span>
      </span>
      {!voulu && onChanger ? <Bouton variante="discret" data-ecart-changer={e.num} onClick={() => onChanger(e.num)}>{tr('ap.ec.changer')}</Bouton> : null}
    </li>
  );
  return (
    <SheetShell titre={tr('ap.ec.titre')} sousTitre={res ? tr('ap.ec.couv', { n: res.compares }) : tr('ap.lecture')} onClose={onFermer} FermeAuRetour={Retour} maxWidth={560} data-ecarts-feuille={res ? res.ecarts.length : ''}>
      {!res ? <p className="vrm-ac-note" role="status">{tr('ap.lecture')}</p> : (
        <div className="vrm-ac-section">
          {res.ecarts.length ? <ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste" data-ecarts-n={res.ecarts.length}>{res.ecarts.slice(0, 200).map((e) => ligne(e, false))}</ul>
            : <p className="vrm-ac-note" data-ecarts-aucun="">{tr('ap.ec.aucun')}</p>}
          {res.voulus.length ? <details className="vrm-ac-repli"><summary data-ecarts-voulus={res.voulus.length}>{tr('ap.ec.voulus', { n: res.voulus.length })}</summary><ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste">{res.voulus.slice(0, 200).map((e) => ligne(e, true))}</ul></details> : null}
          {res.nonJuges.length ? <p className="vrm-ac-note" data-ecarts-non-juges={res.nonJuges.length}>{tr('ap.ec.nonJuges', { n: res.nonJuges.length })}</p> : null}
          {manques.length ? <p className="vrm-ac-note" data-ecarts-manques={manques.join('|')}>{tr('ap.ec.manques', { x: manques.join(', ') })}</p> : null}
          <Repli titre={tr('ap.comment')}>{tr('ap.ec.comment')}</Repli>
        </div>
      )}
    </SheetShell>
  );
}

// ── 116 · LA RÉVISION DU MOIS ──────────────────────────────────────────────
export function RevisionMoisCarte({ R, mois = [], ym, setYm, portes = {} }) {
  useLangue();
  const [tout, setTout] = React.useState(false);
  if (!R || R.etat === 'encours') return null;
  const nomMois = (x) => dateLoc(x + '-15T12:00:00', { month: 'long', year: 'numeric' });
  const couv = R.etat === 'lu' ? (R.fini ? tr('ap.rev.fini', { n: R.n }) : tr('ap.rev.couv', { n: R.total, v: R.n })) : tr('ap.rev.ouvreVentes');
  const MAX = 30;
  const lignes = R.etat === 'lu' ? (tout ? R.lignes.slice(0, 200) : R.lignes.slice(0, MAX)) : [];
  return (
    <Section titre={tr('ap.rev.titre')} couv={couv} data-revision={R.etat} data-rev-n={R.etat === 'lu' ? R.total : ''} data-rev-achat={R.compte.achat || 0} data-rev-versement={R.compte.versement || 0} data-rev-relier={R.compte.relier || 0}>
      <select className="vrm-ap-mois" value={ym} onChange={(e) => setYm(e.target.value)} aria-label={tr('ap.rev.mois')} data-rev-mois="">
        {mois.map((m) => <option key={m} value={m}>{nomMois(m)}</option>)}
      </select>
      {R.etat === 'lu' && !R.fini ? (
        <>
          <div className="vrm-ac-tuiles">
            {['achat', 'versement', 'relier'].map((k) => (
              <button key={k} type="button" className={'vrm-ac-tuile vrm-ap-tuile' + (R.compte[k] ? ' is-ambre' : '')} disabled={!R.compte[k] || !portes[k]} data-rev-porte={k} onClick={() => portes[k] && portes[k]()}>
                <b className="vrm-ac-chiffre">{R.compte[k] || 0}</b><span className="vrm-ac-libelle">{tr('ap.rev.' + k)}</span>
              </button>
            ))}
          </div>
          <ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste" data-rev-lignes={lignes.length}>
            {lignes.map((l) => (
              <li key={l.cle} className="vrm-ac-ligne vrm-ap-ligne-bouton" data-rev-ligne={l.cle} data-rev-manques={l.manques.join(',')}>
                <button type="button" className="vrm-ap-ligne-geste" onClick={() => portes[l.porte] && portes[l.porte]()} data-rev-ouvrir={l.porte}>
                  <span className="vrm-ac-num">{l.num ? 'N°' + l.num : '—'}</span>
                  <span className="vrm-ac-corps">
                    <span className="vrm-ac-titre-ligne">{l.titre || NOM_SITE[l.plateforme] || l.plateforme}</span>
                    <span className="vrm-ac-sous">{jourCourt(new Date(l.ts).toISOString())} · {NOM_SITE[l.plateforme] || l.plateforme} · {l.manques.map((m) => tr('ap.rev.m.' + m)).join(' · ')}</span>
                  </span>
                  <span className="vrm-ac-prix">{eur(l.montant)}</span>
                  <span className="vrm-ap-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
          {R.lignes.length > MAX ? <Bouton variante="discret" data-rev-tout="" onClick={() => setTout((x) => !x)}>{tout ? tr('ap.moins') : tr('ap.rev.plus', { n: Math.min(200, R.lignes.length) - MAX })}</Bouton> : null}
        </>
      ) : null}
      <Repli titre={tr('ap.comment')}>{tr('ap.rev.comment')}</Repli>
    </Section>
  );
}

// ── 115 · LE LIEN POUR SON COMPTABLE ───────────────────────────────────────
// `appel(methode, corps)` → la réponse JSON de /api/compte?mode=comptable (sur SA session) ou null.
// `vue` : la sortie de `donneesExportComptable` de la période choisie (le serveur la réduit à la compta).
export function LienComptable({ vue, appel }) {
  useLangue();
  const [E, setE] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const [jours, setJours] = React.useState(90);
  const [copie, setCopie] = React.useState(false);
  React.useEffect(() => { let mort = false; appel('GET').then((r) => { if (!mort) setE(r && r.ok ? r : null); }).catch(() => { if (!mort) setE(null); }); return () => { mort = true; }; }, [appel]);
  const faire = async (action, extra = {}) => {
    if (occupe) return;
    setOccupe(action);
    let r = null; try { r = await appel('POST', { action, ...extra }); } catch (_) { r = null; }
    setOccupe('');
    if (r && r.ok) setE(r); else setE((x) => (x ? { ...x, erreur: true } : x));
  };
  const periodeVue = vue && vue.periode;
  const publiee = E && E.periodes ? E.periodes.find((p) => p.periode === periodeVue) : null;
  return (
    <div className="vrm-ap-lien" data-lien-comptable={E === undefined ? 'encours' : E === null ? 'passu' : E.actif ? 'actif' : 'aucun'}>
      <div className="vrm-ac-tete"><b className="vrm-ap-sous-titre">{tr('ap.lc.titre')}</b><span className="vrm-ac-couv">{tr('ap.lc.couv')}</span></div>
      {E === undefined ? <p className="vrm-ac-note" role="status">{tr('ap.lecture')}</p> : E === null ? <p className="vrm-ac-note" data-lc-passu="">{tr('ap.lc.passu')}</p> : !E.actif ? (
        <div className="vrm-ap-rangee">
          <SegmenteBase label={tr('ap.lc.duree')} value={String(jours)} onChange={(v) => setJours(Number(v))} options={DUREES_J.map((j) => ({ v: String(j), l: tr('ap.lc.jours', { n: j }), data: { 'data-lc-duree': j } }))}/>
          <Bouton variante="primaire" data-lc-creer="" occupe={occupe === 'creer'} disabled={!vue || !!occupe} onClick={() => faire('creer', { jours, vue })}>{tr('ap.lc.creer')}</Bouton>
        </div>
      ) : (
        <>
          <div className="vrm-ap-url"><code data-lc-url="">{E.url}</code></div>
          <p className="vrm-ac-note" data-lc-exp={E.exp || ''}>{tr('ap.lc.expire', { date: E.exp ? dateLoc(new Date(E.exp), { day: 'numeric', month: 'long', year: 'numeric' }) : '—' })} · {tr('ap.lc.periodes', { x: (E.periodes || []).map((p) => p.libelle).join(', ') || '—' })}</p>
          <div className="vrm-ap-rangee">
            <Bouton variante="secondaire" icone="copy" data-lc-copier="" onClick={async () => { try { await navigator.clipboard.writeText(E.url); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch (_) {} }}>{copie ? tr('ap.lc.copie') : tr('ap.lc.copier')}</Bouton>
            <Bouton variante="secondaire" data-lc-publier={periodeVue || ''} occupe={occupe === 'publier'} disabled={!vue || !!occupe} onClick={() => faire('publier', { vue })}>{publiee ? tr('ap.lc.mettreAJour', { p: vue.libelle }) : tr('ap.lc.ajouter', { p: vue ? vue.libelle : '' })}</Bouton>
            <Bouton variante="danger" data-lc-couper="" occupe={occupe === 'couper'} disabled={!!occupe} onClick={() => faire('couper')}>{tr('ap.lc.couper')}</Bouton>
          </div>
          <details className="vrm-ac-repli"><summary data-lc-acces={E.acces == null ? '' : E.acces.length}>{E.acces == null ? tr('ap.lc.accesPasLus') : tr('ap.lc.acces', { n: E.acces.length })}</summary>
            {E.acces && E.acces.length ? <ul className="vrm-ap-acces">{E.acces.slice(0, 20).map((a, i) => <li key={i}>{dateLoc(new Date(a.at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.nav}</li>)}</ul> : <p className="vrm-ac-note">{tr('ap.lc.aucunAcces')}</p>}
          </details>
        </>
      )}
      {E && E.erreur ? <p className="vrm-ac-note is-ambre" role="alert">{tr('ap.lc.erreur')}</p> : null}
    </div>
  );
}

// ── 114 · LES SOLDES : LA PROPOSITION DE MA JOURNÉE ET LA REMISE ───────────
export function SoldesJournee({ aRemettre = [], onOuvrir }) {
  useLangue();
  const n = aRemettre.reduce((t, s) => t + s.paires.length, 0);
  if (!n) return null;
  return (
    <div className="vrm-ac-carte vrm-ap-journee" data-soldes-journee={n}>
      <span className="vrm-ac-corps">
        <b className="vrm-ac-titre-ligne">{tr('ap.solde.fini', { n })}</b>
        <span className="vrm-ac-sous">{tr('ap.solde.depuis', { date: jourCourt(aRemettre[0].fin) })}</span>
      </span>
      <Bouton variante="primaire" data-soldes-ouvrir="" onClick={onOuvrir}>{tr('ap.solde.remettre')}</Bouton>
    </div>
  );
}
// lignes : sortie de `lignesRemise` ; onRemettre(l) → réponse de l'extension ; onFini(issues Map) ; onGarder().
export function RemiseSoldesFeuille({ lignes, extRaison = '', onRemettre, onFini, onGarder, onFermer, Retour, pause = () => 3000 + Math.floor(Math.random() * 4000) }) {
  useLangue();
  const [etats, setEtats] = React.useState({});
  const [phase, setPhase] = React.useState('choix');
  const arret = React.useRef(false);
  const aRemettre = (lignes || []).filter((l) => l.action === 'remettre');
  const lancer = async () => {
    if (phase !== 'choix' || !aRemettre.length || extRaison) return;
    setPhase('envoi');
    const issues = new Map();
    for (const l of lignes || []) if (l.action === 'absente' || l.action === 'deja' || l.action === 'change') issues.set(`${l.site}|${l.uid}|${l.id}`, l.action);
    for (let i = 0; i < aRemettre.length; i++) {
      const l = aRemettre[i];
      if (arret.current) break;
      setEtats((x) => ({ ...x, [l.id]: { etat: 'envoi' } }));
      let r = null; try { r = await onRemettre(l); } catch (_) { r = null; }
      const iss = r && r.issue ? r.issue : 'refus';
      issues.set(`${l.site}|${l.uid}|${l.id}`, iss);
      setEtats((x) => ({ ...x, [l.id]: { etat: iss, raison: (r && r.raison) || '', prixVu: r && r.prixVu != null ? r.prixVu : null } }));
      if (r && r.arret) break;
      if (i < aRemettre.length - 1) await new Promise((ok) => setTimeout(ok, pause()));
    }
    setPhase('fini');
    if (onFini) onFini(issues);
  };
  const nFait = Object.values(etats).filter((e) => e.etat === 'fait').length;
  return (
    <SheetShell titre={tr('ap.solde.titreFeuille')} sousTitre={tr('ap.solde.sousFeuille', { n: aRemettre.length })} onClose={() => { if (phase !== 'envoi') onFermer(); }} FermeAuRetour={Retour} maxWidth={560} data-remise-soldes={phase}>
      <div className="vrm-ac-section">
        {extRaison ? <p className="vrm-ac-note is-ambre" data-remise-ext="">{extRaison}</p> : null}
        <ul className="vrm-ac-lignes vrm-ac-carte vrm-ap-liste">
          {(lignes || []).map((l) => {
            const e = etats[l.id];
            return (
              <li key={`${l.site}|${l.uid}|${l.id}`} className="vrm-ac-ligne" data-remise-ligne={l.id} data-remise-action={l.action} data-remise-etat={e ? e.etat : ''} data-remise-vers={l.vers}>
                <span className="vrm-ac-num">{l.num ? 'N°' + l.num : '—'}</span>
                <span className="vrm-ac-corps">
                  <span className="vrm-ac-titre-ligne">{l.titre || NOM_SITE[l.site]}</span>
                  <span className="vrm-ac-sous">{NOM_SITE[l.site]} · {l.action === 'remettre' ? `${eur(l.de)} → ${eur(l.vers)}` : tr('ap.solde.a.' + l.action, { p: eur(l.de), o: eur(l.vers) })}{e && e.etat !== 'envoi' ? ' · ' + tr('ap.solde.e.' + e.etat, { p: eur(e.prixVu) }) : ''}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {phase === 'choix' ? (
          <div className="vrm-ap-rangee">
            <Bouton variante="primaire" data-remise-lancer={aRemettre.length} disabled={!aRemettre.length || !!extRaison} onClick={lancer}>{tr('ap.solde.remettreN', { n: aRemettre.length })}</Bouton>
            <Bouton variante="discret" data-remise-garder="" onClick={() => { if (onGarder) onGarder(); onFermer(); }}>{tr('ap.solde.garder')}</Bouton>
          </div>
        ) : phase === 'envoi' ? (
          <div className="vrm-ap-rangee"><span className="vrm-ac-note" role="status">{tr('ap.solde.enCours')}</span><Bouton variante="secondaire" data-remise-arreter="" onClick={() => { arret.current = true; }}>{tr('ap.arreter')}</Bouton></div>
        ) : (
          <div className="vrm-ap-rangee"><span className="vrm-ac-note" role="status" data-remise-faits={nFait}>{tr('ap.solde.faits', { n: nFait })}</span><Bouton variante="primaire" onClick={onFermer}>{tr('ap.fermer')}</Bouton></div>
        )}
        <Repli titre={tr('ap.comment')}>{tr('ap.solde.comment')}</Repli>
      </div>
    </SheetShell>
  );
}
