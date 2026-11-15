// ═══════════════════════════════════════════════════════════════════════════
//  160 · LA FEUILLE « VENTE EN MAIN PROPRE » (14 nov.) — chargée à la demande
// ═══════════════════════════════════════════════════════════════════════════
//  Le N° (ou une recherche par le titre, qui ne fait que PROPOSER), puis le prix ⇒
//  « Vendue · 45 € ». Le verdict vient de la coque (`verdict(q, choisie)`, la règle de
//  « Vendu ailleurs » de la fiche, src/ideesArgent/venteMain.js) ; l'écriture est le
//  geste de « Vendu ailleurs » (`opsVenteMain` → `opsVenduAilleurs`), annulable 5 s,
//  et RIEN n'est écrit avant « Vendue ». Au clic, le verdict est RELU : une vente lue
//  entre-temps ⇒ refus, rien d'écrit.
//  Formes : les quatre boutons du Studio (sb-btn-plein, sb-touche, sb-rond, sb-lien),
//  un seul bouton plein ; la feuille par portail (`SheetShell`, `FermeAuRetour`).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import './idees-argent.css';
import { tr, langueCourante, LOCALES } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { SheetShell, load, toast, gesteVrm, cleNum, lireObjet, emettreClesRelues, PhotoVinted, telechargerFichier, onCloudReady, sortieCaseStock, texteAvecDescentes } from '../App.jsx';
import { chercherParMots, estUnNumero, opsVenteMain, opsAnnulerVenteMain, ventesMainRecentes, lignesRecu, PAIEMENTS, aujourdhui, dateValide } from './venteMain.js';

const CLE_DECISIONS = 'vrm_cycle_decisions';
const eur = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  try { return new Intl.NumberFormat(LOCALES[langueCourante()] || 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n)); } catch (_) { return `${n} €`; }
};
const jourCourt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return ''; try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(LOCALES[langueCourante()] || 'fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return `${m[3]}/${m[2]}`; } };
// Le montant tapé : « 45 », « 45,50 », « 45.5 € » ⇒ nombre ; sinon null (rien de deviné).
export const montantTape = (t) => {
  const s = String(t == null ? '' : t).replace(/[\s€  ]/g, '').replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};
const vibrer = () => { try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {} };

export default function Feuilles({ ouvert, pret = false, verdict = null, onFermer }) {
  useLangue();
  if (!ouvert || ouvert.quoi !== 'vente-main') return null;
  return <FeuilleVenteMain num0={ouvert.num || ''} pret={pret} verdict={verdict} onFermer={onFermer}/>;
}

// ── Une rangée de paire (plaque · vignette · titre · prix) ──────────────────
function RangeePaire({ c, double = false, choisie = false, onChoisir }) {
  const corps = <>
    <span className={'sb-plaque' + (double ? ' is-double' : '')} data-ia-plaque={c.numero}>{c.numero}</span>
    {c.photo ? <PhotoVinted src={c.photo} alt="" loading="lazy" className="sb-vignette"/> : <span className="sb-vignette" aria-hidden="true"/>}
    <span className="ia-rangee-txt"><b>{c.titre || tr('ia.vm.sansTitre')}</b>{c.taille ? <small>{c.taille}</small> : null}</span>
    {c.prix != null ? <span className="ia-rangee-prix">{eur(c.prix)}</span> : null}
  </>;
  if (!onChoisir) return <div className="sb-rangee" data-ia-paire={c.id} aria-current={choisie ? 'true' : undefined}>{corps}</div>;
  return <button type="button" className="sb-rangee" data-ia-paire={c.id} aria-pressed={choisie ? 'true' : 'false'} onClick={() => onChoisir(c)}>{corps}</button>;
}

// Le nom de la facture (l'entité des Factures, la même lecture que le reçu d'achat d'App.jsx), sinon ''.
const vendeurDuRecu = () => {
  try {
    const ents = load('vinted_entreprises', []); const actif = load('vinted_entreprise_active', '');
    const ent = Array.isArray(ents) && ents.length ? (ents.find((e) => e && String(e.id) === String(actif)) || ents[0]) : load('vinted_invoice_settings', null);
    return [ent && ent.companyName, ent && ent.companyType].filter(Boolean).join(' ');
  } catch (_) { return ''; }
};
export const motsRecu = () => ({ titre: tr('ia.recu.titre'), sousTitre: tr('ia.recu.sous'), numero: tr('ia.recu.numero'), date: tr('ia.recu.date'), vendeur: tr('ia.recu.vendeur'), article: tr('ia.recu.article'),
  rangement: tr('ia.recu.rangement'), paiement: tr('ia.recu.paiement'), montant: tr('ia.recu.montant'), pied: tr('ia.recu.pied'), signature: tr('ia.recu.signature'),
  modes: Object.fromEntries(PAIEMENTS.map((p) => [p, tr('ia.vm.paiement.' + p)])) });
async function telechargerRecu({ carte, montant, date, paiement }) {
  const recu = lignesRecu({ carte, montant, date, paiement, vendeur: vendeurDuRecu(), numeroRecu: `MP-${String(date).replace(/-/g, '')}-${cleNum(carte.numero) || 'x'}` });
  if (!recu) return false;
  try {
    const { recuPdf } = await import('./recuPdf.js');
    const octets = await recuPdf(recu, motsRecu());
    if (!octets) return false;
    telechargerFichier(octets, `recu-${recu.numeroRecu}.pdf`, 'application/pdf');
    return true;
  } catch (_) { return false; }
}

// La phrase d'un refus (le verdict), jamais un silence.
function phraseRefus(v) {
  const n = v.cle;
  switch (v.etat) {
    case 'aucune': return tr('ia.vm.aucune', { num: n });
    case 'passu': return tr('ia.vm.passu', { num: n });
    case 'vendue': return tr('ia.vm.vendue', { num: n, ou: v.ou || '' });
    case 'deja-main': return tr('ia.vm.dejaMain', { num: n, prix: eur(v.decision && v.decision.montant), jour: jourCourt(v.decision && v.decision.date) || '—' });
    case 'marquee': return tr('ia.vm.marquee', { num: n });
    case 'sortie': return tr('ia.vm.sortie', { num: n });
    case 'deux-annonces': return tr('ia.vm.deuxAnnonces', { num: n });
    case 'compte-ecarte': return tr('ia.vm.compteEcarte', { num: n });
    default: return '';
  }
}

function FeuilleVenteMain({ num0 = '', pret = false, verdict = null, onFermer }) {
  const [q, setQ] = React.useState(num0);
  const [choisie, setChoisie] = React.useState(null);     // l'annonce touchée quand deux paires portent ce N°
  const [parToucher, setParToucher] = React.useState(!!num0);
  const [prix, setPrix] = React.useState('');
  const [paiement, setPaiement] = React.useState('especes');
  const [date, setDate] = React.useState(() => aujourdhui());
  const [dateOuverte, setDateOuverte] = React.useState(false);
  const [faux, setFaux] = React.useState('');
  const [fait, setFait] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [recuEnCours, setRecuEnCours] = React.useState(false);
  const refPrix = React.useRef(null);
  const refVerdict = React.useRef(verdict); refVerdict.current = verdict;
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vinted_annonce_numeros' || k === CLE_DECISIONS || k === 'vinted_annonces_vendues' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); };
    window.addEventListener('vrm:save', f);
    const off = onCloudReady(() => setTick((t) => t + 1));
    return () => { window.removeEventListener('vrm:save', f); if (typeof off === 'function') off(); };
  }, []);
  // « Annuler » (la pilule, 5 s) défait la vente : la feuille le voit (la décision écrite puis retirée) et
  // revient au formulaire en le disant — jamais « vendu » affiché pour une vente qui n'existe plus.
  React.useEffect(() => {
    if (!fait) return;
    const d = lireObjet(CLE_DECISIONS)[fait.carte.id];
    const ecrite = !!(d && d.choix === 'vendu-main' && d.at === fait.at);
    if (ecrite && !fait.vu) setFait((f) => (f ? { ...f, vu: true } : f));
    else if (!ecrite && fait.vu) { setFait(null); setPrix(''); setFaux('annulee'); }
  }, [tick, fait]);   // eslint-disable-line react-hooks/exhaustive-deps
  const brut = String(q || '').trim();
  const parNum = estUnNumero(brut);
  const v = React.useMemo(() => {
    if (!parNum) return null;
    if (!pret || typeof refVerdict.current !== 'function') return { etat: 'lecture' };
    try { return refVerdict.current(brut, choisie) || { etat: 'lecture' }; } catch (_) { return { etat: 'passu', cle: brut }; }
  }, [brut, parNum, choisie, pret, tick, fait]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lus = React.useMemo(() => ({ fiches: load('vinted_annonce_numeros', {}) || {}, vendues: load('vinted_annonces_vendues', []) || [], decisions: lireObjet(CLE_DECISIONS) }), [tick, fait]);   // eslint-disable-line react-hooks/exhaustive-deps
  const propositions = React.useMemo(() => (!parNum && brut.length >= 2 ? chercherParMots(brut, lus.fiches, { vendues: lus.vendues, decisions: lus.decisions }) : []), [brut, parNum, lus]);
  const recentes = React.useMemo(() => ventesMainRecentes(lus.decisions).slice(0, 8), [lus]);
  const carte = v && v.etat === 'possible' ? v.carte : null;

  const valider = (e) => {
    if (e) e.preventDefault();
    if (!carte) return;
    const m = montantTape(prix);
    if (m == null) { setFaux('prix'); return; }
    if (!dateValide(date)) { setFaux('date'); return; }
    // Le verdict RELU au clic : une vente lue, une décision posée entre-temps ⇒ rien n'est écrit.
    const v2 = typeof refVerdict.current === 'function' ? refVerdict.current(brut, choisie) : null;
    if (!v2 || v2.etat !== 'possible' || v2.carte.id !== carte.id) { setFaux('change'); setTick((t) => t + 1); return; }
    const r = opsVenteMain({ carte: v2.carte, montant: m, date, paiement, decisions: lireObjet(CLE_DECISIONS), vendues: load('vinted_annonces_vendues', []) || [], slots: lireObjet('vrm_slots'), sortieCase: sortieCaseStock, cle: cleNum });
    if (!r) { setFaux('compris'); return; }
    setFaux(''); vibrer();
    // Le MÊME geste que « Vendu ailleurs » de la fiche (venduAilleursGeste, App.jsx) : annulable 5 s.
    gesteVrm(texteAvecDescentes(r.texte, r.ops), r.ops, {}, () => { setTimeout(() => { try { window.dispatchEvent(new Event('vrm:stock-slots')); } catch (_) {} emettreClesRelues(['vinted_annonces_vendues', CLE_DECISIONS, 'vrm_slots']); setTick((t) => t + 1); }, 700); });
    const at = (r.ops.find((o) => o.k === CLE_DECISIONS) || {}).apres;
    setFait({ carte: v2.carte, montant: m, date, paiement, at: at ? at.at : null, vu: false });
  };
  const remettre = (x) => {
    const r = opsAnnulerVenteMain({ id: x.id, decisions: lireObjet(CLE_DECISIONS), vendues: load('vinted_annonces_vendues', []) || [], slots: lireObjet('vrm_slots'), cle: cleNum });
    if (!r) return;
    gesteVrm(tr(r.caseRendue === false ? 'ia.vm.remisSansCase' : 'ia.vm.remisEnStock', { num: r.numero || '?' }), r.ops, {}, () => { setTimeout(() => { try { window.dispatchEvent(new Event('vrm:stock-slots')); } catch (_) {} emettreClesRelues(['vinted_annonces_vendues', CLE_DECISIONS, 'vrm_slots']); setTick((t) => t + 1); }, 700); });
  };
  const recu = async () => {
    if (!fait || recuEnCours) return;
    setRecuEnCours(true);
    const ok = await telechargerRecu(fait);
    setRecuEnCours(false);
    if (!ok) toast(tr('ia.vm.recuRate'), 'err');
  };
  const nouvelle = () => { setFait(null); setChoisie(null); setParToucher(false); setQ(''); setPrix(''); setPaiement('especes'); setDate(aujourdhui()); setDateOuverte(false); setFaux(''); };
  const choisirProposition = (c) => { setQ(c.numero); setChoisie(null); setParToucher(true); setFaux(''); };
  const refus = v && !['possible', 'plusieurs', 'lecture', 'archive', 'invalide'].includes(v.etat) ? phraseRefus(v) : '';
  const m = montantTape(prix);

  return (
    <SheetShell onClose={onFermer} titre={tr('ia.vm.titre')} sousTitre={tr('ia.vm.sous')} data-ia-feuille="vente-main" maxWidth={520}>
      <div className="ia" data-espace="ventes" data-ia-etape={fait ? 'fait' : carte ? 'prix' : 'numero'} data-ia-verdict={v ? v.etat : ''}>
        {fait ? (<>
          <div className="ia-fait" role="status" data-ia-vente-faite={fait.carte.id} data-ia-montant={fait.montant} data-ia-paiement={fait.paiement}>
            <b>{tr('ia.vm.fait', { num: fait.carte.numero, prix: eur(fait.montant) })}</b>
            <span className="ia-note">{tr('ia.vm.faitNote', { jour: jourCourt(fait.date), mode: tr('ia.vm.paiement.' + fait.paiement).toLowerCase() })}</span>
            {fait.carte.enLigne ? <span className="ia-note is-geste" data-ia-encore-en-ligne="">{tr('ia.vm.encoreEnLigne')}</span> : null}
          </div>
          <div className="ia-gestes">
            <button type="button" className="sb-lien" data-ia-recu="" disabled={recuEnCours} onClick={recu}>{recuEnCours ? tr('ia.vm.recuEnCours') : tr('ia.vm.recu')}</button>
            <button type="button" className="sb-lien" data-ia-nouvelle="" onClick={nouvelle}>{tr('ia.vm.nouvelle')}</button>
          </div>
          <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-ia-fermer="" onClick={onFermer}>{tr('ia.fermer')}</button>
        </>) : (<form onSubmit={valider} noValidate className="ia">
          <label>
            <span className="ia-lib">{tr('ia.vm.numeroLib')}</span>
            <input className="sb-champ" data-ia-recherche="" autoFocus={!num0} value={q} placeholder={tr('ia.vm.numeroExemple')} autoComplete="off" enterKeyHint="next"
              onChange={(e) => { setQ(e.target.value); setChoisie(null); setParToucher(false); setFaux(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (refPrix.current) refPrix.current.focus(); } }}/>
          </label>
          {v && v.etat === 'lecture' ? <p className="ia-note" data-ia-etat="lecture" role="status">{tr('ia.vm.lecture')}</p> : null}
          {refus ? <p className="ia-note is-geste" role="alert" data-ia-etat={v.etat}>{refus}{v.etat === 'vendue' && v.lignes && v.lignes.length ? <><br/><small data-ia-vente-lue="">{v.lignes.slice(0, 2).join(' · ')}</small></> : null}</p> : null}
          {v && v.etat === 'archive' ? <p className="ia-note is-geste" role="alert" data-ia-etat="archive">{tr('ia.vm.archive', { num: v.cle, ancien: v.ancien })}{' '}
            <button type="button" className="sb-lien" data-ia-archive={v.ancien} onClick={() => { setQ(v.ancien); setParToucher(true); }}>{tr('ia.vm.archiveOui', { ancien: v.ancien })}</button></p> : null}
          {v && v.etat === 'plusieurs' ? (<>
            <p className="ia-note is-geste" role="alert" data-ia-etat="plusieurs" data-ia-n={v.cartes.length}>{tr('ia.vm.plusieurs', { num: v.cle, n: v.cartes.length })}</p>
            <ul className="ia-liste">{v.cartes.map((c) => <li key={c.id}><RangeePaire c={c} double onChoisir={(x) => { setChoisie(x.id); setParToucher(true); setFaux(''); }}/></li>)}</ul>
          </>) : null}
          {!parNum && brut.length >= 2 ? (propositions.length ? (<>
            <p className="ia-note" data-ia-etat="propositions">{tr('ia.vm.propositions')}</p>
            <ul className="ia-liste">{propositions.map((c) => <li key={c.id}><RangeePaire c={c} onChoisir={choisirProposition}/></li>)}</ul>
          </>) : <p className="ia-note" data-ia-etat="rien">{tr('ia.vm.rienTrouve')}</p>) : null}
          {carte ? (<>
            <RangeePaire c={carte} double={!!v.double} choisie/>
            {choisie ? <button type="button" className="sb-lien" data-ia-changer="" onClick={() => setChoisie(null)}>{tr('ia.vm.autrePaire')}</button> : null}
            <label>
              <span className="ia-lib">{tr('ia.vm.prixLib')}</span>
              <input ref={refPrix} className="sb-champ" data-ia-prix="" autoFocus={parToucher} inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder={carte.prix != null ? String(carte.prix).replace('.', ',') : '0'}
                value={prix} aria-invalid={faux === 'prix' ? 'true' : undefined} onChange={(e) => { setPrix(e.target.value); setFaux(''); }}/>
            </label>
            <div>
              <span className="ia-lib" id="ia-paiement-lib">{tr('ia.vm.paiementLib')}</span>
              <div className="sb-segment" role="group" aria-labelledby="ia-paiement-lib">
                {PAIEMENTS.map((p) => <button key={p} type="button" className="sb-touche" data-ia-paiement-choix={p} aria-pressed={paiement === p ? 'true' : 'false'} onClick={() => setPaiement(p)}>{tr('ia.vm.paiement.' + p)}</button>)}
              </div>
            </div>
            {dateOuverte ? <label>
              <span className="ia-lib">{tr('ia.vm.dateLib')}</span>
              <input className="sb-champ" type="date" data-ia-date="" value={date} max={aujourdhui()} aria-invalid={faux === 'date' ? 'true' : undefined} onChange={(e) => { setDate(e.target.value); setFaux(''); }}/>
            </label> : <button type="button" className="sb-lien" data-ia-date-ouvrir="" onClick={() => setDateOuverte(true)}>{tr('ia.vm.dateAutre', { jour: jourCourt(date) })}</button>}
            <p className={'ia-note' + (faux ? ' is-geste' : '')} data-ia-note="" role={faux ? 'alert' : undefined}>
              {faux === 'prix' ? tr('ia.vm.fauxPrix') : faux === 'date' ? tr('ia.vm.fauxDate') : faux === 'compris' ? tr('ia.vm.fauxCompris') : faux === 'change' ? tr('ia.vm.fauxChange') : faux === 'annulee' ? tr('ia.vm.annulee') : tr('ia.vm.regle', { jour: jourCourt(date) })}
            </p>
            <button type="submit" className="sb-btn-plein sb-btn-plein--barre" data-ia-valider="">{m != null ? tr('ia.vm.valider', { prix: eur(m) }) : tr('ia.vm.validerVide')}</button>
          </>) : null}
          {recentes.length ? <details className="ia-repli" data-ia-recentes={recentes.length}>
            <summary>{tr('ia.vm.recentes', { n: recentes.length })}</summary>
            <ul className="ia-liste">{recentes.map((x) => <li key={x.id} className="sb-rangee" data-ia-recente={x.id}>
              <span className="sb-plaque">{x.numero || '—'}</span>
              <span className="ia-rangee-txt"><b>{x.montant != null ? eur(x.montant) : '—'}</b><small>{[jourCourt(x.date), x.paiement ? tr('ia.vm.paiement.' + x.paiement) : ''].filter(Boolean).join(' · ')}</small></span>
              <button type="button" className="sb-lien" data-ia-remettre={x.id} onClick={() => remettre(x)}>{tr('ia.vm.remettre')}</button>
            </li>)}</ul>
          </details> : null}
        </form>)}
      </div>
    </SheetShell>
  );
}
