// ═══════════════════════════════════════════════════════════════════════════
//  LES TROIS FEUILLES « IDÉES ARGENT » (14 nov.) — chargées à la demande
// ═══════════════════════════════════════════════════════════════════════════
//  160 Vente en main propre · 159 Dépense en photo · 162 Partager en image.
//  Les règles : src/ideesArgent/{venteMain,depensePhoto,carteImage}.js (pures).
//  Ici : l'écran, et l'écriture APRÈS son clic (jamais avant).
//  Formes : les quatre boutons du Studio (sb-btn-plein, sb-touche, sb-rond, sb-lien),
//  un seul bouton plein par feuille ; feuilles par portail (`SheetShell`, `FermeAuRetour`).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import './idees-argent.css';
import { tr, langueCourante, LOCALES } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { SheetShell, load, save, toast, gesteVrm, cleNum, compressImage, isCloudReady, lireObjet, withOwner, SUPABASE_URL, SB_CONFLICT, sbAuth, emettreClesRelues, lireComptaSynchro, PhotoVinted, telechargerFichier, onCloudReady } from '../App.jsx';
import { trouverParNumero, chercherParMots, estUnNumero, opsVenteMain, opsAnnulerVenteMain, ventesMainRecentes, lignesRecu, PAIEMENTS, aujourdhui, dateValide } from './venteMain.js';
import { lireTexteTicket, idTicket } from '../depensesTicket.js';
import { lectureTicket, depenseAEnregistrer, comptaAvecDepense, depensesDuMois, montantTape, texteCentimes, sortDeLaPhoto, CATEGORIES } from './depensePhoto.js';
import { contenuCarte, dessinerCarte, nomFichier, FORMATS } from './carteImage.js';

const CLE_DECISIONS = 'vrm_cycle_decisions';
const eur = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  try { return new Intl.NumberFormat(LOCALES[langueCourante()] || 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n)); } catch (_) { return `${n} €`; }
};
const jourCourt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return ''; try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(LOCALES[langueCourante()] || 'fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return `${m[3]}/${m[2]}`; } };
const moisLong = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); if (!m) return ''; try { return new Date(+m[1], +m[2] - 1, 1).toLocaleDateString(LOCALES[langueCourante()] || 'fr-FR', { month: 'long' }); } catch (_) { return ym; } };
const idNeuf = () => { try { const a = new Uint8Array(9); crypto.getRandomValues(a); return 'd' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14); } catch (_) { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } };
const vibrer = () => { try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {} };

export default function Feuilles({ ouvert, onFermer }) {
  useLangue();
  if (!ouvert) return null;
  if (ouvert.quoi === 'vente-main') return <FeuilleVenteMain num0={ouvert.num || ''} onFermer={onFermer}/>;
  if (ouvert.quoi === 'depense-photo') return <FeuilleDepensePhoto onFermer={onFermer}/>;
  if (ouvert.quoi === 'partage-image') return <FeuillePartageImage paire={ouvert.paire || {}} onFermer={onFermer}/>;
  return null;
}

// ── Une rangée de paire (plaque · vignette · titre · prix) ──────────────────
function RangeePaire({ c, double = false, choisie = false, onChoisir }) {
  const corps = <>
    <span className={'sb-plaque' + (double ? ' is-double' : '')} data-ia-plaque={c.numero}>{c.numero}</span>
    {c.photo ? <PhotoVinted src={c.photo} alt="" loading="lazy" className="sb-vignette"/> : <span className="sb-vignette" aria-hidden="true"/>}
    <span className="ia-rangee-txt"><b>{c.titre || tr('ia.vm.sansTitre')}</b><small>{[c.taille, c.compte].filter(Boolean).join(' · ')}</small></span>
    {c.prix != null ? <span className="ia-rangee-prix">{eur(c.prix)}</span> : null}
  </>;
  if (!onChoisir) return <div className="sb-rangee" data-ia-paire={c.id} aria-current={choisie ? 'true' : undefined}>{corps}</div>;
  return <button type="button" className="sb-rangee" data-ia-paire={c.id} aria-pressed={choisie ? 'true' : 'false'} onClick={() => onChoisir(c)}>{corps}</button>;
}

// ══ 160 · VENTE EN MAIN PROPRE ══════════════════════════════════════════════
const vendeurDuRecu = () => {
  // L'entité des Factures (la même lecture que le reçu d'achat d'App.jsx) : son nom, sinon rien.
  try {
    const ents = load('vinted_entreprises', []); const actif = load('vinted_entreprise_active', '');
    const ent = Array.isArray(ents) && ents.length ? (ents.find((e) => e && String(e.id) === String(actif)) || ents[0]) : load('vinted_invoice_settings', null);
    return [ent && ent.companyName, ent && ent.companyType].filter(Boolean).join(' ');
  } catch (_) { return ''; }
};
async function telechargerRecu({ carte, montant, date, paiement }) {
  const recu = lignesRecu({ carte, montant, date, paiement, vendeur: vendeurDuRecu(), numeroRecu: `MP-${String(date).replace(/-/g, '')}-${carte.numero || 'x'}` });
  if (!recu) return false;
  try {
    const { recuPdf } = await import('./recuPdf.js');
    const mots = { titre: tr('ia.recu.titre'), sousTitre: tr('ia.recu.sous'), numero: tr('ia.recu.numero'), date: tr('ia.recu.date'), vendeur: tr('ia.recu.vendeur'), article: tr('ia.recu.article'),
      rangement: tr('ia.recu.rangement'), paiement: tr('ia.recu.paiement'), montant: tr('ia.recu.montant'), pied: tr('ia.recu.pied'), signature: tr('ia.recu.signature'),
      modes: Object.fromEntries(PAIEMENTS.map((p) => [p, tr('ia.vm.paiement.' + p)])) };
    const octets = await recuPdf(recu, mots);
    if (!octets) return false;
    telechargerFichier(octets, `recu-${recu.numeroRecu}.pdf`, 'application/pdf');
    return true;
  } catch (_) { return false; }
}

function FeuilleVenteMain({ num0 = '', onFermer }) {
  const [q, setQ] = React.useState(num0);
  const [choisie, setChoisie] = React.useState(null);
  const [prix, setPrix] = React.useState('');
  const [paiement, setPaiement] = React.useState('especes');
  const [date, setDate] = React.useState(() => aujourdhui());
  const [dateOuverte, setDateOuverte] = React.useState(false);
  const [faux, setFaux] = React.useState('');
  const [fait, setFait] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [recuEnCours, setRecuEnCours] = React.useState(false);
  const refPrix = React.useRef(null);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vinted_annonce_numeros' || k === CLE_DECISIONS || k === 'vinted_annonces_vendues') setTick((t) => t + 1); };
    window.addEventListener('vrm:save', f);
    const off = onCloudReady(() => setTick((t) => t + 1));
    return () => { window.removeEventListener('vrm:save', f); if (typeof off === 'function') off(); };
  }, []);
  const lus = React.useMemo(() => ({ fiches: load('vinted_annonce_numeros', {}) || {}, vendues: load('vinted_annonces_vendues', []) || [], decisions: lireObjet(CLE_DECISIONS) }), [tick, fait]);   // eslint-disable-line react-hooks/exhaustive-deps
  const pret = isCloudReady() || Object.keys(lus.fiches).length > 0;
  const brut = String(q || '').trim();
  const parNum = estUnNumero(brut);
  const res = React.useMemo(() => (parNum ? trouverParNumero(brut, lus.fiches, { vendues: lus.vendues, decisions: lus.decisions, cle: cleNum }) : null), [brut, parNum, lus]);
  const propositions = React.useMemo(() => (!parNum && brut.length >= 2 ? chercherParMots(brut, lus.fiches, { vendues: lus.vendues, decisions: lus.decisions }) : []), [brut, parNum, lus]);
  // UNE fiche porte ce N° ⇒ elle (identité) ; plusieurs ⇒ IL choisit ; une proposition ⇒ son toucher.
  const carte = choisie || (res && res.etat === 'une' ? res.cartes[0] : null);
  const recentes = React.useMemo(() => ventesMainRecentes(lus.decisions).slice(0, 8), [lus]);

  const valider = (e) => {
    if (e) e.preventDefault();
    if (!carte) return;
    const m = montantTape(prix);
    if (m == null) { setFaux('prix'); return; }
    if (!dateValide(date)) { setFaux('date'); return; }
    const r = opsVenteMain({ carte, montant: m, date, paiement, decisions: lireObjet(CLE_DECISIONS), vendues: load('vinted_annonces_vendues', []) || [], slots: lireObjet('vrm_slots'), cle: cleNum });
    if (!r) { setFaux('compris'); return; }
    setFaux(''); vibrer();
    // Le MÊME geste que « Vendu ailleurs » de la fiche (venduAilleursGeste, App.jsx) : annulable 5 s.
    gesteVrm(r.texte, r.ops, {}, () => { setTimeout(() => { try { window.dispatchEvent(new Event('vrm:stock-slots')); } catch (_) {} emettreClesRelues(['vinted_annonces_vendues', CLE_DECISIONS]); setTick((t) => t + 1); }, 700); });
    setFait({ carte, montant: m, date, paiement });
  };
  const remettre = (v) => {
    const r = opsAnnulerVenteMain({ id: v.id, decisions: lireObjet(CLE_DECISIONS), vendues: load('vinted_annonces_vendues', []) || [] });
    if (!r) return;
    gesteVrm(tr('ia.vm.remisEnStock', { num: r.numero || '?' }), r.ops, {}, () => { setTimeout(() => { emettreClesRelues(['vinted_annonces_vendues', CLE_DECISIONS]); setTick((t) => t + 1); }, 700); });
  };
  const recu = async () => {
    if (!fait || recuEnCours) return;
    setRecuEnCours(true);
    const ok = await telechargerRecu(fait);
    setRecuEnCours(false);
    if (!ok) toast(tr('ia.vm.recuRate'), 'err');
  };
  const nouvelle = () => { setFait(null); setChoisie(null); setQ(''); setPrix(''); setPaiement('especes'); setDate(aujourdhui()); setDateOuverte(false); setFaux(''); };

  return (
    <SheetShell onClose={onFermer} titre={tr('ia.vm.titre')} sousTitre={tr('ia.vm.sous')} data-ia-feuille="vente-main" maxWidth={520}>
      <div className="ia" data-espace="ventes" data-ia-etape={fait ? 'fait' : carte ? 'prix' : 'numero'}>
        {fait ? (<>
          <div className="ia-fait" role="status" data-ia-vente-faite={fait.carte.id} data-ia-montant={fait.montant} data-ia-paiement={fait.paiement}>
            <b>{tr('ia.vm.fait', { num: fait.carte.numero, prix: eur(fait.montant) })}</b>
            <span className="ia-note">{tr('ia.vm.faitNote', { jour: jourCourt(fait.date), mode: tr('ia.vm.paiement.' + fait.paiement).toLowerCase() })}</span>
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
              onChange={(e) => { setQ(e.target.value); setChoisie(null); setFaux(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (carte && refPrix.current) refPrix.current.focus(); } }}/>
          </label>
          {!pret ? <p className="ia-note" data-ia-etat="chargement">{tr('ia.vm.chargement')}</p> : null}
          {pret && res && res.etat === 'aucune' ? <p className="ia-note" data-ia-etat="aucune">{tr('ia.vm.aucune', { num: res.cle })}</p> : null}
          {pret && res && res.etat === 'deja' ? <p className="ia-note" data-ia-etat="deja">{tr('ia.vm.deja', { num: res.cle })}</p> : null}
          {pret && res && res.etat === 'plusieurs' && !choisie ? (<>
            <p className="ia-note is-geste" role="alert" data-ia-etat="plusieurs" data-ia-n={res.cartes.length}>{tr('ia.vm.plusieurs', { num: res.cle, n: res.cartes.length })}</p>
            <ul className="ia-liste">{res.cartes.map((c) => <li key={c.id}><RangeePaire c={c} double onChoisir={(x) => { setChoisie(x); setFaux(''); }}/></li>)}</ul>
          </>) : null}
          {pret && !parNum && brut.length >= 2 && !choisie ? (propositions.length ? (<>
            <p className="ia-note" data-ia-etat="propositions">{tr('ia.vm.propositions')}</p>
            <ul className="ia-liste">{propositions.map((c) => <li key={c.id}><RangeePaire c={c} onChoisir={(x) => { setChoisie(x); setFaux(''); }}/></li>)}</ul>
          </>) : <p className="ia-note" data-ia-etat="rien">{tr('ia.vm.rienTrouve')}</p>) : null}
          {carte ? (<>
            <RangeePaire c={carte} choisie/>
            {choisie ? <button type="button" className="sb-lien" data-ia-changer="" onClick={() => setChoisie(null)}>{tr('ia.vm.autrePaire')}</button> : null}
            <label>
              <span className="ia-lib">{tr('ia.vm.prixLib')}</span>
              <input ref={refPrix} className="sb-champ" data-ia-prix="" autoFocus={!!(choisie || num0)} inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder={carte.prix != null ? String(carte.prix).replace('.', ',') : '0'}
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
              {faux === 'prix' ? tr('ia.vm.fauxPrix') : faux === 'date' ? tr('ia.vm.fauxDate') : faux === 'compris' ? tr('ia.vm.fauxCompris') : tr('ia.vm.regle', { jour: jourCourt(date) })}
            </p>
            <button type="submit" className="sb-btn-plein sb-btn-plein--barre" data-ia-valider="">{montantTape(prix) != null ? tr('ia.vm.valider', { prix: eur(montantTape(prix)) }) : tr('ia.vm.validerVide')}</button>
          </>) : null}
          {recentes.length ? <details className="ia-repli" data-ia-recentes={recentes.length}>
            <summary>{tr('ia.vm.recentes', { n: recentes.length })}</summary>
            <ul className="ia-liste">{recentes.map((v) => <li key={v.id} className="sb-rangee" data-ia-recente={v.id}>
              <span className="sb-plaque">{v.numero || '—'}</span>
              <span className="ia-rangee-txt"><b>{v.montant != null ? eur(v.montant) : '—'}</b><small>{[jourCourt(v.date), v.paiement ? tr('ia.vm.paiement.' + v.paiement) : ''].filter(Boolean).join(' · ')}</small></span>
              <button type="button" className="sb-lien" data-ia-remettre={v.id} onClick={() => remettre(v)}>{tr('ia.vm.remettre')}</button>
            </li>)}</ul>
          </details> : null}
        </form>)}
      </div>
    </SheetShell>
  );
}

// ══ 159 · DÉPENSE EN PHOTO ══════════════════════════════════════════════════
// Le ticket dans SA ligne (`depense_ticket_{id}`), la même que la boîte à dépenses de Compta.
const ecrireTicket = async (id, b64) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
      method: 'POST', headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([withOwner({ id: idTicket(id), data: { b64, at: new Date().toISOString() } })]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
};
// La photo, réduite DANS le navigateur ; trop lourde même réduite ⇒ montrée, pas rangée.
async function photoReduite(f) {
  let b = await compressImage(f, 1100, 0.7);
  if (b && sortDeLaPhoto(b) === 'trop-lourde') b = (await compressImage(f, 800, 0.55)) || b;
  return b;
}

function FeuilleDepensePhoto({ onFermer }) {
  const [photo, setPhoto] = React.useState(null);
  const [lecture, setLecture] = React.useState(null);
  const [manuelle, setManuelle] = React.useState(false);
  const [montant, setMontant] = React.useState('');
  const [date, setDate] = React.useState(() => aujourdhui());
  const [cat, setCat] = React.useState(CATEGORIES[0]);
  const [libelle, setLibelle] = React.useState('');
  const [faux, setFaux] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);
  const [fait, setFait] = React.useState(null);
  const touche = React.useRef({ montant: false, date: false });
  const fichier = React.useRef(null);
  const sortPhoto = photo ? sortDeLaPhoto(photo) : 'aucune';
  const choisir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const b = await photoReduite(f);
    if (!b) { setFaux('photo'); return; }
    setPhoto(b); setFaux(''); setManuelle(true); setLecture({ etat: 'encours' });
    const r = await lireTexteTicket(b);
    const l = lectureTicket(r, new Date());
    // Pré-remplir seulement ce qu'il n'a pas déjà tapé : la lecture n'écrit rien.
    if (l.montant != null && !touche.current.montant) setMontant(texteCentimes(l.montant));
    if (l.date && !touche.current.date) setDate(l.date);
    setLecture(l);
  };
  const enregistrer = async (e) => {
    if (e) e.preventDefault();
    if (envoi) return;
    if (!isCloudReady()) { setFaux('nuage'); return; }
    const id = idNeuf();
    const v = depenseAEnregistrer({ saisie: { montant, date, cat, libelle }, id });
    if (v.erreur) { setFaux(v.erreur); return; }
    setFaux(''); setEnvoi(true);
    const ticket = photo && sortPhoto === 'garder' ? await ecrireTicket(id, photo) : false;
    const cur = load('vrm_compta', null);
    const next = comptaAvecDepense(cur && typeof cur === 'object' ? cur : lireComptaSynchro(), ticket ? { ...v.depense, ticket: true } : v.depense);
    setEnvoi(false);
    if (!next) { setFaux('lecture'); return; }
    save('vrm_compta', next);
    try { window.dispatchEvent(new CustomEvent('vrm:depense-ajoutee', { detail: { id } })); } catch (_) {}
    vibrer();
    setFait({ depense: v.depense, mois: depensesDuMois(next, v.depense.date.slice(0, 7)), ticket, sansPhoto: !!photo && !ticket });
  };
  const autre = () => { setPhoto(null); setLecture(null); setManuelle(false); setMontant(''); setDate(aujourdhui()); setLibelle(''); setFaux(''); setFait(null); touche.current = { montant: false, date: false }; };
  const noteLecture = !lecture ? '' : lecture.etat === 'encours' ? tr('ia.dep.lecture')
    : lecture.etat === 'lu' ? tr('ia.dep.lu') : lecture.etat === 'partiel' ? tr('ia.dep.partiel')
    : lecture.etat === 'rien' ? tr('ia.dep.rien') : lecture.raison === 'hors-ligne' ? tr('ia.dep.horsLigne') : tr('ia.dep.rate');
  const m = montantTape(montant);
  return (
    <SheetShell onClose={onFermer} titre={tr('ia.dep.titre')} sousTitre={tr('ia.dep.sous')} data-ia-feuille="depense-photo" maxWidth={520}>
      <div className="ia" data-espace="argent" data-ia-etape={fait ? 'fait' : manuelle ? 'saisie' : 'photo'} data-ia-lecture={lecture ? lecture.etat : ''}>
        <input ref={fichier} className="ia-cache" type="file" accept="image/*" capture="environment" data-ia-ticket-fichier="" onChange={choisir} tabIndex={-1} aria-hidden="true"/>
        {fait ? (<>
          <div className="ia-fait" role="status" data-ia-depense-faite={fait.depense.id} data-ia-montant={fait.depense.montant} data-ia-ticket={fait.ticket ? '1' : '0'}>
            <b>{tr('ia.dep.fait', { prix: eur(fait.depense.montant), cat: tr('ia.dep.cat.' + fait.depense.cat) })}</b>
            <span className="ia-note">{tr('ia.dep.faitMois', { mois: moisLong(fait.depense.date.slice(0, 7)), n: fait.mois.n, total: eur(fait.mois.total) })}</span>
            <span className="ia-note">{tr('ia.dep.faitBenefice')}</span>
            {fait.sansPhoto ? <span className="ia-note is-geste" data-ia-sans-photo="">{tr('ia.dep.sansPhoto')}</span> : null}
          </div>
          <div className="ia-gestes"><button type="button" className="sb-lien" data-ia-autre="" onClick={autre}>{tr('ia.dep.autre')}</button></div>
          <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-ia-fermer="" onClick={onFermer}>{tr('ia.fermer')}</button>
        </>) : !manuelle ? (<>
          <p className="ia-note">{tr('ia.dep.intro')}</p>
          <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-ia-photo="" onClick={() => fichier.current && fichier.current.click()}>{tr('ia.dep.prendre')}</button>
          <button type="button" className="sb-lien" data-ia-sans-ticket="" onClick={() => setManuelle(true)}>{tr('ia.dep.main')}</button>
          {faux === 'photo' ? <p className="ia-note is-geste" role="alert">{tr('ia.dep.photoRatee')}</p> : null}
        </>) : (<form className="ia" onSubmit={enregistrer} noValidate>
          {photo ? <img className="ia-photo" src={photo} alt={tr('ia.dep.photoAlt')} data-ia-apercu-ticket=""/> : null}
          {noteLecture ? <p className={'ia-note' + (lecture && (lecture.etat === 'rien' || lecture.etat === 'rate') ? ' is-geste' : '')} data-ia-note-lecture={lecture.etat} role="status">{noteLecture}</p> : null}
          {photo && sortPhoto === 'trop-lourde' ? <p className="ia-note is-geste" data-ia-trop-lourde="">{tr('ia.dep.tropLourde')}</p> : null}
          <div className="ia-ligne2">
            <label>
              <span className="ia-lib">{tr('ia.dep.montantLib')}</span>
              <input className="sb-champ" data-ia-montant="" inputMode="decimal" autoComplete="off" placeholder={lecture && lecture.etat === 'encours' ? '…' : '0,00'} value={montant}
                aria-invalid={faux === 'montant' ? 'true' : undefined} onChange={(e) => { touche.current.montant = true; setMontant(e.target.value); setFaux(''); }}/>
            </label>
            <label>
              <span className="ia-lib">{tr('ia.dep.dateLib')}</span>
              <input className="sb-champ" type="date" data-ia-date="" value={date} max={aujourdhui()} aria-invalid={faux === 'date' ? 'true' : undefined}
                onChange={(e) => { touche.current.date = true; setDate(e.target.value); setFaux(''); }}/>
            </label>
          </div>
          <div>
            <span className="ia-lib" id="ia-cat-lib">{tr('ia.dep.catLib')}</span>
            <div className="sb-segment" role="group" aria-labelledby="ia-cat-lib" style={{ gridAutoFlow: 'row', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {CATEGORIES.map((c) => <button key={c} type="button" className="sb-touche" data-ia-cat={c} aria-pressed={cat === c ? 'true' : 'false'} onClick={() => { setCat(c); setFaux(''); }}>{tr('ia.dep.cat.' + c)}</button>)}
            </div>
          </div>
          <label>
            <span className="ia-lib">{tr('ia.dep.libelleLib')}</span>
            <input className="sb-champ" data-ia-libelle="" autoComplete="off" maxLength={80} value={libelle} placeholder={tr('ia.dep.ex.' + cat)} onChange={(e) => setLibelle(e.target.value)}/>
          </label>
          {faux && faux !== 'photo' ? <p className="ia-note is-geste" role="alert" data-ia-faux={faux}>{tr('ia.dep.faux.' + (['montant', 'date', 'cat', 'nuage', 'lecture'].includes(faux) ? faux : 'lecture'))}</p>
            : <p className="ia-note">{tr('ia.dep.regle')}</p>}
          <button type="submit" className="sb-btn-plein sb-btn-plein--barre" data-ia-enregistrer="" disabled={envoi || (lecture && lecture.etat === 'encours')}>
            {envoi ? tr('ia.dep.envoi') : m != null ? tr('ia.dep.enregistrer', { prix: eur(m) }) : tr('ia.dep.enregistrerVide')}
          </button>
          {!photo ? <button type="button" className="sb-lien" data-ia-photo-ensuite="" onClick={() => fichier.current && fichier.current.click()}>{tr('ia.dep.ajouterPhoto')}</button>
            : <button type="button" className="sb-lien" data-ia-photo-changer="" onClick={() => fichier.current && fichier.current.click()}>{tr('ia.dep.changerPhoto')}</button>}
        </form>)}
      </div>
    </SheetShell>
  );
}

// ══ 162 · PARTAGER EN IMAGE ═════════════════════════════════════════════════
// L'image de la photo : lue en `blob` (une image d'une autre adresse ne se dessine
// lisible que si elle l'autorise), sinon `crossOrigin` ; refusée ⇒ null (carte sans photo, dit).
async function chargerImage(src) {
  if (!src) return null;
  const depuis = (url, cors) => new Promise((ok) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
  if (/^(data|blob):/.test(src)) return depuis(src, false);
  try {
    const r = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (r.ok) { const b = await r.blob(); if (/^image\//.test(b.type)) { const u = URL.createObjectURL(b); const i = await depuis(u, false); return i; } }
  } catch (_) {}
  return depuis(src, true);
}
const policesPretes = async () => {
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all(['600 64px Urbanist', '300 120px Urbanist', '500 40px Inter'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 1500))]); } catch (_) {}
};

function FeuillePartageImage({ paire, onFermer }) {
  const [format, setFormat] = React.useState('story');
  const [avecNum, setAvecNum] = React.useState(false);
  const [img, setImg] = React.useState(undefined);
  const [pret, setPret] = React.useState(false);
  const [envoi, setEnvoi] = React.useState(false);
  const toile = React.useRef(null);
  const contenu = React.useMemo(() => contenuCarte(paire, { avecNumero: avecNum }), [paire, avecNum]);
  React.useEffect(() => { let mort = false; chargerImage(contenuCarte(paire).photo).then((i) => { if (!mort) setImg(i || null); }); return () => { mort = true; }; }, [paire]);
  React.useEffect(() => {
    if (img === undefined) return undefined;
    let mort = false;
    (async () => {
      await policesPretes();
      const c = toile.current; if (mort || !c) return;
      const F = FORMATS[format]; c.width = F.l; c.height = F.h;
      const ctx = c.getContext('2d');
      dessinerCarte(ctx, contenu, format, img, { libelleTaille: tr('ia.img.taille') });
      setPret(true);
    })();
    return () => { mort = true; };
  }, [img, format, contenu]);
  const blob = () => new Promise((ok) => { try { toile.current.toBlob((b) => ok(b || null), 'image/png'); } catch (_) { ok(null); } });
  const partager = async () => {
    if (envoi || !pret) return;
    setEnvoi(true);
    const b = await blob();
    setEnvoi(false);
    if (!b) { toast(tr('ia.img.rate'), 'err'); return; }
    const nom = nomFichier(contenu, format);
    try {
      const f = new File([b], nom, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: contenu.modele || nom }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    telechargerFichier(b, nom, 'image/png');
  };
  const telecharger = async () => { const b = await blob(); if (b) telechargerFichier(b, nomFichier(contenu, format), 'image/png'); else toast(tr('ia.img.rate'), 'err'); };
  return (
    <SheetShell onClose={onFermer} titre={tr('ia.img.titre')} sousTitre={tr('ia.img.sous')} data-ia-feuille="partage-image" maxWidth={560}>
      <div className="ia" data-espace="paires" data-ia-format={format} data-ia-pret={pret ? '1' : '0'} data-ia-photo={img === undefined ? 'lecture' : img ? '1' : '0'}>
        <canvas ref={toile} className="ia-apercu" data-ia-toile="" role="img" aria-label={tr('ia.img.apercu', { modele: contenu.modele || '—' })}
          style={{ aspectRatio: format === 'carre' ? '1 / 1' : '9 / 16', width: format === 'carre' ? 'min(100%, 52vh)' : 'auto', height: format === 'carre' ? 'auto' : 'min(52vh, 560px)' }}/>
        <div className="sb-segment" role="group" aria-label={tr('ia.img.formatLib')}>
          <button type="button" className="sb-touche" data-ia-format-choix="story" aria-pressed={format === 'story' ? 'true' : 'false'} onClick={() => { setPret(false); setFormat('story'); }}>{tr('ia.img.story')}</button>
          <button type="button" className="sb-touche" data-ia-format-choix="carre" aria-pressed={format === 'carre' ? 'true' : 'false'} onClick={() => { setPret(false); setFormat('carre'); }}>{tr('ia.img.carre')}</button>
        </div>
        {paire && (paire.num || paire.numero) ? <label className="ia-case"><input type="checkbox" data-ia-avec-num="" checked={avecNum} onChange={(e) => { setPret(false); setAvecNum(e.target.checked); }}/>{tr('ia.img.avecNum', { num: String(paire.num || paire.numero) })}</label> : null}
        {img === null && contenu.photo ? <p className="ia-note" data-ia-photo-refusee="">{tr('ia.img.photoRefusee')}</p> : null}
        <p className="ia-note">{tr('ia.img.prive')}</p>
        <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-ia-partager="" disabled={!pret || envoi} onClick={partager}>{tr('ia.img.partager')}</button>
        <button type="button" className="sb-lien" data-ia-telecharger="" disabled={!pret} onClick={telecharger}>{tr('ia.img.telecharger')}</button>
      </div>
    </SheetShell>
  );
}
