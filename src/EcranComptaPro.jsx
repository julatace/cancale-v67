// ════════════════════════════════════════════════════════════════════════════
// Découpé d'App.jsx (29 octobre) : ComptaPro et ce qu'eux SEULS utilisent,
// chargés à l'ouverture de l'écran (React.lazy) au lieu du démarrage de l'app.
// Le code n'a pas changé ; ce qu'il partage avec le reste vient d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════
import { jaugeSeuils, optionsMicro, calendrierUrssaf, phraseRythme, seuilsDe, declarationRevenus, rappelCfe } from "./microEntreprise.js";
import React, { useState, useEffect } from "react";
import { etatFacturation, factureDepuisVente, pdfFacturX, nomFichierFacture, recapEReporting, recapCsv, recapJson, eurDe, frJour } from "./facturationElectronique.js";
import { lireSuperPdp, appelSuperPdp, enBase64, libelleEnvoi, ENV_LIBELLE } from "./superpdp.js";
import { Btn, C, COMPTA_DEFAUT, Card, ChoixDepenses, DATE_LBC_OK, DEMANDE_DEPENSE, DEMANDE_SAISIE_PRIX, EXT_CAPACITES, Icon, IconeReglage, MOIS_COMPTA, PRIX_CGV_LISIBLE, Pourquoi, REGIMES_FISCAUX, REGLAGE_PAS_LU, SB_CONFLICT, SERIE_DECLARATION, SUPABASE_URL, ScreenHead, Segmente, TAUX_URSSAF_DEFAUT, VENTES_MASQUEES_AUCUNE, _startOfDay, aPayerUrssaf, avecDatesLbc, comptaChargesAnnee, comptaChargesMois, compteEcarte, couvertureBenefice, debutPeriode, decalerPeriode, demanderDeclaration, echeancesAbonnement, enTeteSession, extSait, fetchProInvoices, fetchVersementsVinted, fmt, isCloudReady, lbcAnnulee, lbcFinalisee, libellePeriodeCa, libelleRegime, lireDatesLbc, lireDeclarations, lireMontantSaisi, lireReglage, load, moisDeclare, moisPeriodeUrssaf, montantPeriodeUrssaf, netApresUrssafDe, nextUrssafDeadline, onCloudReady, payeDe, regimeFiscal, repondreSansDepenses, save, sbAuth, tauxUrssaf, toast, tsCommande, useBeneficeCalcul, useLigneSynchro, useLigneUrssaf, useRegimeFiscal, useVentesCoque, ventesDeclarables, ventesFaites, withOwner, ymCompta, ymCourant, ymDeTs } from "./App.jsx";


const TAUX_MICRO = { cotisations: 12.3, acre: 6.2, formation: 0.1, liberatoire: 1 };
const tauxMicroVente = ({ liberatoire = false, acre = false } = {}) =>
  Math.round(((acre ? TAUX_MICRO.acre : TAUX_MICRO.cotisations) + TAUX_MICRO.formation + (liberatoire ? TAUX_MICRO.liberatoire : 0)) * 10) / 10;

const periodesUrssaf = (freq, now = new Date()) => {
  const out = [];
  const Y = now.getFullYear(), M = now.getMonth();
  if (freq === 'mensuel') {
    for (let k = 11; k >= 0; k--) {
      const ps = new Date(Y, M - k, 1), pe = new Date(ps.getFullYear(), ps.getMonth() + 1, 0);
      out.push({ periodStart: ps, periodEnd: pe, dueDate: new Date(ps.getFullYear(), ps.getMonth() + 2, 0), label: `${MOIS_NOMS_FR[ps.getMonth()]} ${ps.getFullYear()}` });
    }
  } else {
    const q0 = Math.floor(M / 3);
    for (let k = 4; k >= 0; k--) {
      const qi = q0 - k, y = Y + Math.floor(qi / 4), q = ((qi % 4) + 4) % 4;
      const ps = new Date(y, q * 3, 1), pe = new Date(y, q * 3 + 3, 0);
      out.push({ periodStart: ps, periodEnd: pe, dueDate: new Date(y, q * 3 + 4, 0), label: `T${q + 1} ${y}` });
    }
  }
  return out;
};

const caDeclareDe = (d) => (d && d.montant != null && isFinite(Number(d.montant))) ? Number(d.montant) : (Number(d && d.ca) || 0);
const suiviUrssaf = ({ freq, now = new Date(), declare, ligne, taux = tauxUrssaf() } = {}) => {
  if (!declare || typeof declare !== 'object' || Array.isArray(declare)) return null;
  const aujourdhui = _startOfDay(now);
  const r2 = (x) => Math.round(x * 100) / 100;
  const lignes = [];
  for (const p of periodesUrssaf(freq, now)) {
    const yms = moisPeriodeUrssaf(p);
    const notes = yms.filter((ym) => moisDeclare(declare, ym));
    const finie = aujourdhui > _startOfDay(p.periodEnd);
    const etat = notes.length === yms.length ? 'declaree' : !finie ? 'en_cours' : aujourdhui > _startOfDay(p.dueDate) ? 'en_retard' : 'a_declarer';
    const joursRestants = Math.round((_startOfDay(p.dueDate) - aujourdhui) / 86400000);
    const calc = montantPeriodeUrssaf(p, ligne, taux);
    let caDecl = null, caTape = false, paye = null, aPayerDecl = null, at = 0, regle = null;
    const aCompleter = [];   // mois notés sans le CA tapé ou sans les cotisations payées
    if (notes.length) {
      caDecl = r2(notes.reduce((t, ym) => t + caDeclareDe(declare[ym]), 0));
      caTape = notes.every((ym) => declare[ym].montant != null && isFinite(Number(declare[ym].montant)));
      const ps = notes.map((ym) => payeDe(declare[ym]));
      paye = ps.every((x) => x != null) ? r2(ps.reduce((t, x) => t + x, 0)) : null;
      aPayerDecl = aPayerUrssaf(caDecl, taux);
      at = Math.max(...notes.map((ym) => Number(declare[ym].at) || 0));
      regle = notes.map((ym) => declare[ym].regle).includes('vente') ? 'vente' : 'versement';
      for (const ym of notes) if (declare[ym].montant == null || payeDe(declare[ym]) == null) aCompleter.push(ym);
    }
    // L'écart ne se juge que sur une période ENTIÈREMENT notée et un chiffre de
    // VRM complet (« au moins » ne prouve aucun écart). Sous 1 € : 0 (arrondis).
    const brut = etat === 'declaree' && calc.ca != null && !calc.partiel ? r2(calc.ca - caDecl) : null;
    const ecart = brut == null ? null : (Math.abs(brut) >= 1 ? brut : 0);
    // Une période finie sans rien (aucune vente comptée, rien noté) ne s'affiche pas.
    if (!notes.length && finie && calc.ca === 0 && !calc.partiel) continue;
    lignes.push({
      label: p.label, yms, aNoter: yms.filter((ym) => !moisDeclare(declare, ym)), aCompleter,
      periodEnd: p.periodEnd, dueDate: p.dueDate, joursRestants, etat,
      urgent: etat === 'a_declarer' && joursRestants <= 7,
      caCalc: calc.ca, aPayerCalc: calc.apayer, partiel: calc.partiel,
      caDecl, caTape, paye, aPayerDecl, at, regle, ecart,
      // Une régularisation (VRM compte PLUS que la déclaration) : ses cotisations.
      aPayerEcart: ecart != null && ecart > 0 ? aPayerUrssaf(ecart, taux) : null,
    });
  }
  // L'année civile : ce qu'il a déclaré (le CA tapé, sinon celui de VRM) et ses
  // cotisations — payées si toutes notées, sinon ESTIMÉES (et dit).
  const annee = String(now.getFullYear());
  let caAnnee = 0, payeAnnee = 0, payesConnus = true, nAnnee = 0;
  for (const [ym, d] of Object.entries(declare)) {
    if (!d || !Array.isArray(d.ids) || ym.slice(0, 4) !== annee) continue;
    nAnnee++; caAnnee += caDeclareDe(d);
    const x = payeDe(d); if (x != null) payeAnnee += x; else payesConnus = false;
  }
  const rev = lignes.reverse();
  return {
    lignes: rev,
    annee: { annee, n: nAnnee, ca: r2(caAnnee), paye: nAnnee && payesConnus ? r2(payeAnnee) : null, estime: nAnnee ? aPayerUrssaf(caAnnee, taux) : null },
    enRetard: rev.filter((l) => l.etat === 'en_retard').length,
    // La prochaine échéance à faire (la plus proche, pas notée, période finie).
    prochaine: rev.filter((l) => l.etat === 'a_declarer').sort((a, b) => a.joursRestants - b.joursRestants)[0] || null,
    aRegulariser: r2(rev.reduce((t, l) => t + (l.ecart > 0 ? l.ecart : 0), 0)),
    aCompleter: rev.reduce((t, l) => t + l.aCompleter.length, 0),
  };
};
const completerDeclaration = (ym, { montant, paye } = {}) => {
  if (!isCloudReady()) return false;
  const reg = lireDeclarations();
  const d = reg[ym];
  if (!d || !Array.isArray(d.ids)) return false;
  const u = { ...reg, [ym]: { ...d, montant: montant === undefined ? d.montant : montant, paye: paye === undefined ? (d.paye ?? null) : paye, corrigeLe: Date.now() } };
  save('vrm_urssaf_declare', u);
  return true;
};

const suiviUrssafCsv = (suivi) => {
  const ETAT = { declaree: 'déclarée', a_declarer: 'à déclarer', en_retard: 'pas notée (échéance passée)', en_cours: 'en cours' };
  const n = (x) => x == null ? '' : Number(x).toFixed(2).replace('.', ',');
  const d = (x) => x ? new Date(x).toLocaleDateString('fr-FR') : '';
  const L = [['Période', 'Échéance', 'État', 'Notée le', 'Règle', 'CA déclaré', 'CA tapé depuis l\'URSSAF', 'Cotisations payées', 'Cotisations estimées', 'CA compté par VRM aujourd\'hui', 'Chiffre VRM partiel', 'Écart (VRM − déclaré)']];
  for (const l of suivi.lignes) L.push([l.label, d(l.dueDate), ETAT[l.etat], d(l.at), l.regle === 'vente' ? 'date de vente' : l.regle ? 'date de versement' : '', n(l.caDecl), l.caDecl == null ? '' : (l.caTape ? 'oui' : 'non'), n(l.paye), n(l.etat === 'declaree' ? l.aPayerDecl : l.aPayerCalc), n(l.caCalc), l.partiel ? 'oui (au moins)' : '', n(l.ecart)]);
  return L.map((r) => r.map((c) => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(';')).join('\n');
};
const demanderSerieDeclaration = (liste, onNav) => {
  const l = [...new Set((liste || []).filter((ym) => /^\d{4}-\d{2}$/.test(String(ym || ''))))].sort();
  if (!l.length) return;
  SERIE_DECLARATION.liste = l; SERIE_DECLARATION.total = l.length; SERIE_DECLARATION.at = Date.now();
  demanderDeclaration(l[0], onNav);
};
const COMPTA_CATS = ['Emballage', 'Fournitures', 'Abonnement', 'Frais plateforme', 'Transport', 'Matériel', 'Autre'];
const DEPENSE_CATS = [
  { k: 'Emballage', ex: 'cartons, papier bulle, scotch' },
  { k: 'Fournitures', ex: 'étiquettes, sachets, stylos' },
  { k: 'Matériel', ex: 'imprimante thermique, lampe photo' },
  { k: 'Transport', ex: 'essence pour aller au relais' },
  { k: 'Frais plateforme', ex: 'boost, option de mise en avant' },
  { k: 'Autre', ex: 'ce que tu as payé' },
];

const ABONNEMENTS_COURANTS = [
  { nom: 'VRM', prix: () => (String(PRIX_CGV_LISIBLE).match(/\d+(?:,\d+)?/) || [''])[0] },
  { nom: 'Canva' },
  { nom: 'Lightroom' },
  { nom: 'Photoroom' },
];
const rCompId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const comptaVide = (d) => !((d.depenses || []).length || (d.fixes || []).length || (d.packs || []).length || (d.abonnements || []).length || d.sansDepenses);

const parseMontant = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.').replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? n : null; };

const luhnOk = (ch) => { let s = 0; for (let i = 0; i < ch.length; i++) { let n = Number(ch[ch.length - 1 - i]); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
const verifierSiren = (brut) => {
  const ch = String(brut || '').replace(/[\s.-]/g, '');
  if (!ch) return { etat: 'vide' };
  if (!/^\d+$/.test(ch)) return { etat: 'invalide', raison: 'il ne doit contenir que des chiffres' };
  if (ch.length !== 9 && ch.length !== 14) return { etat: 'invalide', raison: `${ch.length} chiffre${ch.length > 1 ? 's' : ''} — un SIREN en a 9, un SIRET 14` };
  const type = ch.length === 9 ? 'SIREN' : 'SIRET';
  const siren = ch.slice(0, 9);
  if (!luhnOk(siren)) return { etat: 'invalide', type, raison: 'la clé de contrôle du SIREN ne correspond pas (faute de frappe ?)' };
  if (type === 'SIRET' && !(siren === '356000000' ? ch.split('').reduce((s, c) => s + Number(c), 0) % 5 === 0 : luhnOk(ch))) return { etat: 'invalide', type, raison: 'la clé de contrôle du SIRET ne correspond pas (faute de frappe ?)' };
  return { etat: 'ok', type, siren };
};

const caParPeriodes = (series, p, n = 6, maintenant = Date.now()) => {
  const s0 = debutPeriode(maintenant, p);
  const somme = (liste, a, b) => {
    if (!Array.isArray(liste)) return null;
    let eur = 0, nb = 0;
    for (const l of liste) if (l && l.ts >= a && l.ts < b) { eur += Number(l.eur) || 0; nb += 1; }
    return { eur: Math.round(eur * 100) / 100, n: nb };
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = decalerPeriode(s0, p, -i), f = decalerPeriode(d, p, 1);
    out.push({ cle: d.toISOString(), libelle: libellePeriodeCa(d, p), enCours: i === 0,
      vendu: somme(series.vendu, d.getTime(), f.getTime()), finalise: somme(series.finalise, d.getTime(), f.getTime()), recu: somme(series.recu, d.getTime(), f.getTime()) });
  }
  return out;
};

const PERIODES_CA = [['semaine', 'Semaine'], ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];

function DaterVentesLbc({ ventes, dates }) {
  const liste = (ventes || []).filter((v) => v && v.isSeller === true && v.txId && !v.dateVente && !lbcAnnulee(v) && lbcFinalisee(v));
  const [saisie, setSaisie] = React.useState({});
  const [msg, setMsg] = React.useState(null);
  if (!liste.length) return null;
  const auj = new Date(); const max = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}`;
  const poser = (tx, d) => {
    if (d && (!DATE_LBC_OK.test(d) || d > max || d < '2015-01-01')) { setMsg({ tx, t: 'Une date entre 2015 et aujourd\'hui.' }); return; }
    const u = { ...(dates || {}) }; if (d) u[String(tx)] = d; else delete u[String(tx)];
    save('vrm_lbc_dates', u); setMsg(null);
  };
  const eur = (v) => v.price != null && isFinite(Number(v.price)) ? `${(Number(v.price) / 100).toFixed(2).replace('.', ',')} €` : '—';
  return (
    <div data-dater-lbc={liste.length} style={{ padding: '10px 16px 14px', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
      <div style={{ fontWeight: 600 }}>Dater tes ventes Leboncoin</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>Recopie la date de vente affichée dans « Mes transactions » sur leboncoin.fr : la vente compte alors dans son mois (CA, déclaration URSSAF).</div>
      {liste.map((v) => {
        const tx = String(v.txId), cur = (dates || {})[tx] || '';
        const val = saisie[tx] != null ? saisie[tx] : cur;
        return (
          <div key={tx} data-dater-lbc-tx={tx} data-dater-lbc-date={cur} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Vente Leboncoin'} · {eur(v)}</span>
            <input type="date" aria-label={`Date de vente de ${v.title || 'cette vente'}`} max={max} min="2015-01-01" value={val} onChange={(e) => setSaisie((x) => ({ ...x, [tx]: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 16, minHeight: 44, background: C.bg, color: C.text, fontFamily: 'inherit' }}/>
            <button type="button" data-dater-lbc-ok={tx} disabled={!val || val === cur} onClick={() => poser(tx, val)} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.onAccent || '#fff', padding: '8px 14px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!val || val === cur) ? 0.5 : 1, fontFamily: 'inherit' }}>Enregistrer</button>
            {cur ? <button type="button" data-dater-lbc-retirer={tx} onClick={() => { setSaisie((x) => ({ ...x, [tx]: '' })); poser(tx, ''); }} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: 'transparent', color: C.text, padding: '8px 12px', minHeight: 44, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Retirer</button> : null}
            {msg && msg.tx === tx ? <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: C.warn }}>{msg.t}</div> : null}
          </div>);
      })}
    </div>
  );
}
function CaParPeriodeCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { ventes, ko } = useVentesCoque();
  const [datesLbc] = useLigneSynchro('vrm_lbc_dates', lireDatesLbc);
  const [periode, setPeriode] = React.useState(() => { try { const v = localStorage.getItem('vrm_compta_periode'); return PERIODES_CA.some(([k]) => k === v) ? v : 'mois'; } catch (_) { return 'mois'; } });
  const choisir = (p) => { setPeriode(p); try { localStorage.setItem('vrm_compta_periode', p); } catch (_) {} };
  const [versements, setVersements] = React.useState(undefined);
  React.useEffect(() => { let mort = false; fetchVersementsVinted().then((m) => { if (!mort) setVersements(m); }).catch(() => { if (!mort) setVersements(null); }); return () => { mort = true; }; }, []);
  // Les ventes et comptes masqués sont des réglages synchronisés (§5.49).
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => onCloudReady(() => setTick((t) => t + 1)), []);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_sales_hidden' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const calc = React.useMemo(() => {
    if (ventes === undefined) return { etat: 'encours' };
    if (!Array.isArray(ventes)) return { etat: 'passu' };
    const hTx = new Set(VENTES_MASQUEES_AUCUNE().map(String));
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const ecarte = (uid) => compteEcarte(uid, hAcc, panelOff || {});
    const uidDe = (o) => o && o._acc && o._acc.vinted_user_id;
    const lbc = lbcCoqueLu === true ? avecDatesLbc(((lbcVentes && lbcVentes.ventes) || []), datesLbc) : [];
    const ebay = Array.isArray(ebayCommandes) ? ebayCommandes : [];
    const vf = ventesFaites({ vinted: ventes, lbc, ebay, cachee: (o) => hTx.has(String(o && o.transaction_id)) || ecarte(uidDe(o)) });
    const decl = ventesDeclarables({ vinted: ventes, lbc, ebay, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), versements: versements || {} });
    let finSansDate = 0;
    const finalise = [];
    for (const l of [...decl.lignes, ...decl.aDater]) {
      const t = l.o ? tsCommande(l.o) : (l.ts || 0);
      if (t) finalise.push({ ts: t, eur: l.eur }); else finSansDate += 1;
    }
    const recu = versements ? decl.lignes.filter((l) => l.ts).map((l) => ({ ts: l.ts, eur: l.eur })) : null;
    const aDater = versements ? decl.aDater : [];
    const loginDe = (uid) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === String(uid)); return (a && a.login) || String(uid); };
    const manque = [
      ...(ko || []).filter((uid) => !ecarte(uid)).map(loginDe),
      ...(lbcCoqueLu === null ? ['Leboncoin'] : []),
      ...(ebayCommandes === null ? ['eBay'] : []),
    ];
    const attente = lbcCoqueLu === undefined || ebayCommandes === undefined;
    return { etat: 'lu', vendu: vf.lignes, finalise, recu, aDater, venduSansDate: vf.sansDate, venduEbayEcartees: vf.ecartees || 0, finSansDate, manque, attente };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick, datesLbc]);
  const lignes = calc.etat === 'lu' ? caParPeriodes({ vendu: calc.vendu, finalise: calc.finalise, recu: calc.recu }, periode, 6) : null;
  const cur = lignes ? lignes[0] : null;
  const partiel = calc.etat === 'lu' && (calc.manque.length > 0 || calc.attente);
  const montant = (x) => x == null ? '—' : fmt(x.eur);
  const nb = (x) => x == null ? '' : `${x.n} vente${x.n > 1 ? 's' : ''}`;
  const COLS = [
    ['vendu', 'Vendu', 'au jour de la vente, en cours comprises'],
    ['finalise', 'Finalisé', 'ventes finalisées, au jour de la vente'],
    ['recu', 'Reçu (versé)', versements === undefined ? 'dates de versement en lecture…' : versements === null ? 'dates de versement illisibles' : "au jour où l'argent a été versé"],
  ];
  const aDaterEur = calc.etat === 'lu' ? calc.aDater.reduce((t, l) => t + (Number(l.eur) || 0), 0) : 0;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-ca-periode={periode} data-ca-etat={calc.etat} data-ca-partiel={partiel ? '1' : '0'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chart" size={16} /></span>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Chiffre d'affaires par période</div>
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Toutes plateformes · les mêmes règles que Ma journée et le CA déclaré.</div>
          </div>
          {/* (16 oct.) Le contrôle segmenté PARTAGÉ (`.vrm-seg`, celui des
              sous-onglets de plateforme) : plus de segment rempli d'accent. */}
          <nav role="group" aria-label="Période" className="vrm-seg" data-segment="" style={{ '--seg-ink': C.text, '--seg-muted': C.muted, '--seg-point': C.accent, flex: '1 1 260px', maxWidth: 360, margin: 0 }}>
            {PERIODES_CA.map(([k, l]) => (
              <button key={k} type="button" onClick={() => choisir(k)} aria-pressed={periode === k} aria-current={periode === k ? 'page' : undefined} data-ca-choix={k} className="vrm-seg-btn">{l}</button>
            ))}
          </nav>
        </div>
        {calc.etat !== 'lu' ? (
          <div style={{ padding: '16px', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun chiffre n'est affiché plutôt qu'un zéro qui ne serait pas vrai. Rouvre cet écran dans un moment."}
          </div>
        ) : (<>
          <div className="vrm-ca-periode-tuiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: `1px solid ${C.border}` }}>
            {COLS.map(([k, l, s], i) => (
              <div key={k} data-ca-cur={k} data-ca-eur={cur[k] == null ? '' : String(cur[k].eur)} style={{ padding: '14px 16px', borderLeft: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{l} · {cur.libelle}</div>
                <div className="vrm-display" style={{ fontSize: 20, fontWeight: 750, color: cur[k] == null ? C.muted : C.text, marginTop: 4, letterSpacing: -0.5 }}>{partiel && cur[k] != null ? <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>au moins </span> : null}{montant(cur[k])}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cur[k] == null ? s : `${nb(cur[k])} · ${s}`}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table data-ca-table className="vrm-ca-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '9px 16px', fontSize: 11 }}>Période</th>
                  {COLS.map(([k, l]) => <th key={k} style={{ fontWeight: 600, padding: '9px 16px 9px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {(() => { const L = lignes.slice(1); let n = L.length; while (n > 0 && COLS.every(([k]) => L[n - 1][k] && L[n - 1][k].n === 0)) n--; return L.slice(0, n); })().map((r) => (
                  <tr key={r.cle} data-ca-ligne={r.libelle} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap' }}>{r.libelle}</td>
                    {COLS.map(([k]) => <td key={k} style={{ padding: '9px 16px 9px 8px', textAlign: 'right', color: r[k] == null ? C.muted : C.text, whiteSpace: 'nowrap' }}>{montant(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(partiel || calc.aDater.length > 0 || calc.venduSansDate > 0 || calc.venduEbayEcartees > 0 || versements === null) && (
            <div data-ca-couverture style={{ padding: '10px 16px 13px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
              {calc.manque.length > 0 && <div>Totaux partiels — sans {calc.manque.join(', ')} (pas pu lire) : chaque montant est un minimum.</div>}
              {!calc.manque.length && calc.attente && <div>Leboncoin ou eBay se lit encore : chaque montant est un minimum pour l'instant.</div>}
              {versements === null && <div>Les dates de versement Vinted sont illisibles : la colonne « reçu » attend, plutôt que d'afficher des zéros.</div>}
              {calc.aDater.length > 0 && <div>{calc.aDater.length} vente{calc.aDater.length > 1 ? 's' : ''} finalisée{calc.aDater.length > 1 ? 's' : ''} sans date de versement ({fmt(aDaterEur)}) : dans aucune période « reçu » tant que la date n'est pas captée.</div>}
              {calc.venduSansDate > 0 && <div>{calc.venduSansDate} vente{calc.venduSansDate > 1 ? 's' : ''} Leboncoin sans date de vente : dans aucune période — tu peux la dater ci-dessous.</div>}
              {calc.venduEbayEcartees > 0 && <div data-ca-ebay-ecartees={calc.venduEbayEcartees}>{calc.venduEbayEcartees} commande{calc.venduEbayEcartees > 1 ? 's' : ''} eBay écartée{calc.venduEbayEcartees > 1 ? 's' : ''} : le montant que tu reçois (frais eBay retirés, port non compté) n'est pas lisible ou n'est pas en euros.</div>}
            </div>
          )}
          {lbcCoqueLu === true ? <DaterVentesLbc ventes={(lbcVentes && lbcVentes.ventes) || []} dates={datesLbc}/> : null}
        </>)}
      </div>
    </Card>
  );
}

const _entreprisesLues = new Map();          // chiffres → réponse (une fois par session)

async function chercherEntreprise(brut) {
  const ch = String(brut || '').replace(/\D/g, '');
  if (ch.length !== 9 && ch.length !== 14) return { etat: 'invalide' };
  if (_entreprisesLues.has(ch)) return _entreprisesLues.get(ch);
  try {
    const r = await fetch(`/api/compte?mode=entreprise&siret=${ch}`, { headers: enTeteSession() });
    const j = await r.json().catch(() => null);
    if (r.ok && j && (j.etat === 'trouve' || j.etat === 'inconnu')) { _entreprisesLues.set(ch, j); return j; }
    return { etat: 'passu' };
  } catch (_) { return { etat: 'passu' }; }
}
const PROFIL_CHAMPS = [['siret', 'SIRET (14 chiffres) ou SIREN', '1 1 100%'], ['nom', "Nom de l'entreprise", '1 1 100%'], ['tva', 'N° TVA intracom. (si assujetti)', '1 1 200px'], ['adresse', 'Adresse', '1 1 100%'], ['codePostal', 'Code postal', '0 1 140px'], ['ville', 'Ville', '1 1 160px']];
function ProfilFiscalCarte({ onNav }) {
  const [cfg, setCfg] = React.useState(undefined);          // undefined = en cours · null = pas su · objet = lu
  const [statut, setStatut] = React.useState('');
  const minuteur = React.useRef(null);
  React.useEffect(() => { let mort = false; lireReglage('vrm_pro_facture').then((d) => { if (!mort) setCfg(d === null ? null : { ...d }); }).catch(() => { if (!mort) setCfg(null); }); return () => { mort = true; }; }, []);
  const ecrire = (next) => {
    if (!cfg) return;                                      // pas lu : on n'écrit rien
    setCfg(next); setStatut('enregistrement…');
    try { window.dispatchEvent(new CustomEvent('vrm:profil-fiscal', { detail: next })); } catch (_) {}
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
          method: 'POST',
          headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([withOwner({ id: 'vrm_pro_facture', data: next })]),
        });
        setStatut(r.ok ? '✓ enregistré' : "⚠ pas enregistré — la base n'a pas répondu, réessaie");
      } catch (_) { setStatut("⚠ pas enregistré — la base n'a pas répondu, réessaie"); }
    }, 600);
  };
  const [regime, setRegime] = React.useState(() => regimeFiscal());
  React.useEffect(() => onCloudReady(() => setRegime((v) => v == null ? regimeFiscal() : v)), []);
  const virgule = (n) => String(n).replace('.', ',');
  const [taux, setTaux] = React.useState(() => virgule(tauxUrssaf()));
  React.useEffect(() => onCloudReady(() => setTaux((v) => v === virgule(TAUX_URSSAF_DEFAUT) ? virgule(tauxUrssaf()) : v)), []);
  const siren = verifierSiren(cfg && cfg.siret);
  // Le registre : interrogé quand le numéro est VALIDE (clé de contrôle), une
  // fois par numéro. Trouvé ⇒ le nom (et l'adresse si elle est vide) sont posés,
  // sauf s'il a tapé lui-même un autre nom.
  const [registre, setRegistre] = React.useState(null);   // null · {etat:'encours'|'trouve'|'inconnu'|'passu', …}
  const chiffres = String((cfg && cfg.siret) || '').replace(/\D/g, '');
  const cfgRef = React.useRef(cfg); cfgRef.current = cfg;
  const pret = !!cfg;
  React.useEffect(() => {
    if (!pret || siren.etat !== 'ok') { setRegistre(null); return undefined; }
    let mort = false;
    setRegistre({ etat: 'encours' });
    chercherEntreprise(chiffres).then((j) => {
      if (mort) return;
      setRegistre(j);
      const c = cfgRef.current;
      if (j.etat !== 'trouve' || !c || String(c.siret || '').replace(/\D/g, '') !== chiffres) return;
      const libre = !String(c.nom || '').trim() || c.nom === c.nomAuto;
      const next = { ...c };
      let change = false;
      if (libre && c.nom !== j.nom) { next.nom = j.nom; next.nomAuto = j.nom; change = true; }
      if (j.etabTrouve && !String(c.adresse || '').trim() && j.adresse) { next.adresse = j.adresse; change = true; }
      if (j.etabTrouve && !String(c.codePostal || '').trim() && j.codePostal) { next.codePostal = j.codePostal; change = true; }
      if (j.etabTrouve && !String(c.ville || '').trim() && j.ville) { next.ville = j.ville; change = true; }
      if (change) ecrire(next);
    });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiffres, siren.etat, pret]);
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box' };
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-profil-fiscal={cfg === undefined ? 'encours' : cfg === null ? 'passu' : 'lu'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="doc" size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Ton entreprise</div>
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Ton SIRET suffit : VRM retrouve le nom et l'adresse. Ils figurent sur tes reçus et tes factures ; ton régime sert à calculer tes cotisations.</div>
          </div>
          {statut && <span style={{ fontSize: 11, color: /⚠/.test(statut) ? C.warn : C.muted, whiteSpace: 'nowrap' }} data-profil-statut>{statut}</span>}
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cfg === undefined && <div style={{ fontSize: 13, color: C.muted }}>Je lis ton entité…</div>}
          {cfg === null && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 9px', marginRight: 6 }}>{REGLAGE_PAS_LU}</span>La base n'a pas répondu : je ne te montre pas de champs vides à remplir (ils remplaceraient ton entité). Rouvre cet écran dans un moment.</div>}
          {cfg && (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PROFIL_CHAMPS.map(([k, ph, flex]) => (
                <input key={k} data-profil-champ={k} value={cfg[k] || ''} placeholder={ph} aria-label={ph} inputMode={k === 'siret' || k === 'codePostal' ? 'numeric' : undefined}
                  onChange={(e) => ecrire({ ...cfg, [k]: e.target.value })}
                  data-profil-auto={k === 'nom' && cfg.nom && cfg.nom === cfg.nomAuto ? '1' : undefined}
                  style={{ ...inp, flex, borderColor: k === 'siret' && siren.etat === 'invalide' ? C.warn : C.border }} />
              ))}
            </div>
            <div data-siren={siren.etat} data-registre={registre ? registre.etat : undefined} style={{ fontSize: 11, lineHeight: 1.5, color: siren.etat === 'invalide' ? C.warn : C.muted, marginTop: -4 }}>
              {siren.etat === 'vide' ? 'Tape ton SIRET (14 chiffres) : il figure sur ton avis de situation INSEE. Le nom de ton entreprise se remplit tout seul.'
                : siren.etat !== 'ok' ? `Ce numéro ne semble pas valide : ${siren.raison}. Il reste enregistré tel quel — vérifie-le sur ton avis INSEE.`
                : !registre || registre.etat === 'encours' ? `${siren.type} valide — je cherche ton entreprise au registre…`
                : registre.etat === 'trouve' ? <>✓ Trouvée au registre des entreprises : <b className="vrm-sensible" style={{ color: C.text }}>{registre.nom}</b>{registre.ferme ? ' — le registre la dit fermée, vérifie ton numéro.' : '.'}{cfg.nom && cfg.nom !== registre.nom ? ' Tu as gardé ton propre nom : VRM ne le remplace pas.' : ''}</>
                : registre.etat === 'inconnu' ? `${siren.type} valide, mais aucune entreprise à ce numéro au registre public — tape le nom toi-même.`
                : `${siren.type} valide. Le registre des entreprises ne répond pas pour l'instant — le nom se remplira à ta prochaine visite, ou tape-le.`}
            </div>
          </>)}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* (16 oct.) Contrôle segmenté PARTAGÉ (`.vrm-seg`) : plus de segment rempli d'accent. */}
            <nav role="group" aria-label="Régime fiscal" className="vrm-seg" data-segment="" style={{ '--seg-ink': C.text, '--seg-muted': C.muted, '--seg-point': C.accent, margin: 0 }}>
              {REGIMES_FISCAUX.map(([k, court, l]) => (
                <button key={k} type="button" aria-pressed={regime === k} aria-current={regime === k ? 'page' : undefined} data-regime-choix={k} title={l} onClick={() => { setRegime(k); save('vinted_regime', k); }} className="vrm-seg-btn">{court}</button>
              ))}
            </nav>
            {regime !== 'micro' ? (
              <div data-profil-regime-texte="" style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{regime ? (REGIMES_FISCAUX.find((x) => x[0] === regime) || [])[3] : 'Choisis ton statut : VRM ne te parle d\'URSSAF que si tu es micro-entrepreneur.'}{regime === 'marge' ? <> Le taux de TVA se règle dans <button type="button" onClick={() => onNav && onNav('settings')} style={{ border: 'none', background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: 13 }}>Réglages</button>.</> : null}</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Taux de cotisations</span>
                <input type="text" inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} data-profil-taux
                  onBlur={() => { const v = parseFloat(String(taux).replace(',', '.')); const ok = (isFinite(v) && v >= 0 && v <= 50) ? v : TAUX_URSSAF_DEFAUT; setTaux(virgule(ok)); save('vinted_urssaf_taux', ok); }}
                  style={{ ...inp, width: 72, padding: '6px 9px', fontWeight: 600 }} />
                <span style={{ fontSize: 13, color: C.muted }}>% du CA déclaré — celui que tu choisis, l'app ne le devine pas.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

const ymListe = (n = 12, maintenant = Date.now()) => { const out = []; const d = new Date(maintenant); d.setDate(1); for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); } return out; };
const libelleYm = (ym) => { const [a, m] = String(ym).split('-'); return `${MOIS_COMPTA[Number(m) - 1] || ''} ${a}`; };
const telechargerFichier = (contenu, nom, type) => {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
function FacturationElectroniqueCarte({ data, maj, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { ventes, ko } = useVentesCoque();
  const [datesLbc] = useLigneSynchro('vrm_lbc_dates', lireDatesLbc);
  const [versements, setVersements] = React.useState(undefined);
  React.useEffect(() => { let mort = false; fetchVersementsVinted().then((m) => { if (!mort) setVersements(m); }).catch(() => { if (!mort) setVersements(null); }); return () => { mort = true; }; }, []);
  // Le profil fiscal : relu à l'ouverture, et suivi quand la carte « Profil
  // fiscal » juste au-dessus l'écrit (même ligne, §11).
  const [cfg, setCfg] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireReglage('vrm_pro_facture').then((d) => { if (!mort) setCfg(d === null ? null : { ...d }); }).catch(() => { if (!mort) setCfg(null); });
    const f = (e) => { if (e && e.detail && typeof e.detail === 'object') setCfg({ ...e.detail }); };
    window.addEventListener('vrm:profil-fiscal', f);
    return () => { mort = true; window.removeEventListener('vrm:profil-fiscal', f); };
  }, []);
  // Le régime BRUT : jamais choisi ⇒ null (on ne retombe pas sur « micro »).
  const [regime, setRegime] = React.useState(() => load('vinted_regime', null));
  const [nuage, setNuage] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => { setNuage(true); setRegime(load('vinted_regime', null)); }), []);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_regime') setRegime(load('vinted_regime', null)); if (k === 'vinted_sales_hidden' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const etat = etatFacturation({ cfg, regime, verifier: verifierSiren });
  const mois = React.useMemo(() => ymListe(12), []);
  const [ym, setYm] = React.useState(mois[0]);
  const [msg, setMsg] = React.useState('');
  const [enCours, setEnCours] = React.useState('');
  // ── SUPER PDP : SA connexion (le navigateur ne relit jamais ses identifiants)
  // Trois états : `undefined` en cours · `null` pas su · l'objet du serveur.
  const [spdp, setSpdp] = React.useState(undefined);
  const relireSpdp = React.useCallback(() => lireSuperPdp(enTeteSession()).then((j) => setSpdp(j)), []);
  React.useEffect(() => { let mort = false; lireSuperPdp(enTeteSession()).then((j) => { if (!mort) setSpdp(j); }); return () => { mort = true; }; }, []);
  const [spEnv, setSpEnv] = React.useState('sandbox');
  const [spId, setSpId] = React.useState('');
  const [spSecret, setSpSecret] = React.useState('');
  const [spOccupe, setSpOccupe] = React.useState('');
  const [spMsg, setSpMsg] = React.useState('');
  const connecterSpdp = async () => {
    setSpMsg(''); setSpOccupe('connexion');
    const corps = { action: 'connecter', environnement: spEnv, client_id: spId, client_secret: spSecret };
    // Les identifiants quittent le champ DÈS l'envoi : ils ne restent pas dans la page.
    setSpId(''); setSpSecret('');
    const { code, j } = await appelSuperPdp(enTeteSession(), corps);
    setSpOccupe('');
    if (code === 200 && j.ok) { setSpMsg(`Compte Super PDP connecté (${ENV_LIBELLE[j.env] || j.env}). Tes identifiants sont rangés sur le serveur — VRM ne te les remontrera plus.`); relireSpdp(); }
    else setSpMsg(j.message || (code === 0 ? "Le serveur n'a pas répondu : je ne sais pas si la connexion a été rangée. Rouvre cet écran." : 'La connexion a échoué.'));
  };
  const deconnecterSpdp = async () => {
    setSpMsg(''); setSpOccupe('deconnexion');
    const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'deconnecter' });
    setSpOccupe('');
    if (code === 200 && j.ok) { setSpMsg('Compte Super PDP déconnecté : VRM a effacé tes identifiants.'); relireSpdp(); }
    else setSpMsg(j.message || "Le serveur n'a pas répondu : la connexion est peut-être toujours rangée.");
  };
  const envoiDe = (num) => (spdp && spdp.envois && num && spdp.envois[num.numero]) || null;
  const noterEnvoiLocal = (numero, envoi) => { if (!envoi) return; setSpdp((cur) => (cur && cur.envois ? { ...cur, envois: { ...cur.envois, [numero]: envoi } } : cur)); };

  const calc = React.useMemo(() => {
    if (ventes === undefined) return { etat: 'encours' };
    if (!Array.isArray(ventes)) return { etat: 'passu' };
    const hTx = new Set(VENTES_MASQUEES_AUCUNE().map(String));
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const ecarte = (uid) => compteEcarte(uid, hAcc, panelOff || {});
    const uidDe = (o) => o && o._acc && o._acc.vinted_user_id;
    const lbc = lbcCoqueLu === true ? avecDatesLbc(((lbcVentes && lbcVentes.ventes) || []), datesLbc) : [];
    const ebay = Array.isArray(ebayCommandes) ? ebayCommandes : [];
    const decl = ventesDeclarables({ vinted: versements ? ventes : [], lbc, ebay, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), versements: versements || {} });
    const loginDe = (uid) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === String(uid)); return (a && a.login) || String(uid); };
    const manque = [
      ...(ko || []).filter((uid) => !ecarte(uid)).map(loginDe),
      ...(lbcCoqueLu === null ? ['Leboncoin'] : []),
      ...(ebayCommandes === null ? ['eBay'] : []),
    ];
    return { etat: 'lu', decl, manque, attente: lbcCoqueLu === undefined || ebayCommandes === undefined || versements === undefined };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick, datesLbc]);
  const recap = calc.etat === 'lu' ? recapEReporting({ lignes: calc.decl.lignes, aDater: versements ? calc.decl.aDater : [], ym, ymDe: ymDeTs, manque: calc.manque, attente: calc.attente, versementsLus: versements !== null }) : null;

  const fx = (data && data.facturx) || {};
  const numeroDe = (id) => (fx.parVente && fx.parVente[id]) || null;
  // Le numéro et les octets d'UNE vente : le même chemin pour « Facture »
  // (téléchargement) et « Envoyer à Super PDP » — une vente garde son numéro.
  const preparerFacture = async (l) => {
    let deja = numeroDe(l.id);
    let next = data;
    if (!deja) {
      const emiseLe = Date.now(), an = String(new Date(emiseLe).getFullYear());
      const compteur = { ...(fx.compteur || {}) }; const n = (Number(compteur[an]) || 0) + 1; compteur[an] = n;
      deja = { numero: `FX-${an}-${String(n).padStart(4, '0')}`, emiseLe };
      next = { ...data, facturx: { ...fx, compteur, parVente: { ...(fx.parVente || {}), [l.id]: deja } } };
    }
    const f = factureDepuisVente(l, { numero: deja.numero, emiseLe: deja.emiseLe });
    if (!isFinite(f.centimes)) throw new Error('montant illisible');
    const octets = await pdfFacturX(f, etat.vendeur);
    if (next !== data) maj(next);
    return { f, octets };
  };
  const envoyerSpdp = async (l, relireSeulement) => {
    setMsg('');
    if (!etat.ok) { setMsg(etat.raison + ' ' + etat.geste); return; }
    if (!nuage) { setMsg("Je relis d'abord les numéros de facture déjà donnés — réessaie dans un instant."); return; }
    setEnCours(l.id);
    try {
      if (relireSeulement) {
        const numero = numeroDe(l.id) && numeroDe(l.id).numero;
        const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'relire', numero });
        if (j.envoi) noterEnvoiLocal(numero, j.envoi);
        setMsg(code === 200 ? `Statut relu chez Super PDP pour ${numero}.` : (j.message || "Super PDP n'a pas répondu : statut pas relu."));
        return;
      }
      const { f, octets } = await preparerFacture(l);
      noterEnvoiLocal(f.numero, { etat: 'en-cours' });
      const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'envoyer', numero: f.numero, pdf: enBase64(octets) });
      if (j.envoi) noterEnvoiLocal(f.numero, j.envoi);
      // La réponse n'est pas arrivée : INCERTAIN, jamais « refusé ».
      else if (code === 0) noterEnvoiLocal(f.numero, { etat: 'incertain' });
      if (code === 200) setMsg(j.deja ? `Facture ${f.numero} : déjà chez Super PDP — rien n'a été renvoyé.` : `Facture ${f.numero} envoyée à Super PDP.`);
      else setMsg(j.message || (code === 0 ? "La réponse du serveur n'est pas arrivée : je ne sais pas si la facture est partie. « Relire » la cherchera chez Super PDP." : "L'envoi a échoué."));
      relireSpdp();
    } catch (e) { setMsg('La facture n’a pas pu être préparée : ' + String((e && e.message) || e).slice(0, 120)); }
    finally { setEnCours(''); }
  };
  const genererFacture = async (l) => {
    setMsg('');
    if (!etat.ok) { setMsg(etat.raison + ' ' + etat.geste); return; }
    if (!nuage) { setMsg("Je relis d'abord les numéros de facture déjà donnés — réessaie dans un instant."); return; }
    setEnCours(l.id);
    try {
      const { f, octets } = await preparerFacture(l);
      telechargerFichier(new Blob([octets], { type: 'application/pdf' }), nomFichierFacture(f.numero), 'application/pdf');
      setMsg(`Facture ${f.numero} téléchargée — à déposer sur ta plateforme agréée.`);
    } catch (e) { setMsg('La facture n’a pas pu être préparée : ' + String((e && e.message) || e).slice(0, 120)); }
    finally { setEnCours(''); }
  };
  const exporter = (format) => {
    if (!recap) return;
    const v = etat.ok ? etat.vendeur : null;
    if (format === 'csv') telechargerFichier(recapCsv(recap, v), `e-reporting-${ym}.csv`, 'text/csv;charset=utf-8');
    else telechargerFichier(recapJson(recap, v), `e-reporting-${ym}.json`, 'application/json');
  };

  const chip = (icon) => <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} /></span>;
  const btn2 = (actif) => ({ border: `1px solid ${C.border}`, background: C.card, color: actif ? C.text : C.muted, borderRadius: 8, padding: '8px 13px', fontSize: 13, fontWeight: 600, cursor: actif ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: actif ? 1 : 0.6 });
  const peutFacturer = etat.ok && nuage;
  const raisonGrise = !etat.ok ? etat.raison : !nuage ? "Je relis d'abord les numéros de facture déjà donnés." : '';
  const parPlat = recap ? Object.entries(recap.parPlateforme) : [];
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-fe-carte data-fe-etat={etat.etat} data-fe-nuage={nuage ? '1' : '0'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          {chip('doc')}
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Facturation électronique</div>
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>VRM prépare les fichiers. Connecte ton compte Super PDP pour que tes factures partent d'ici, ou dépose-les toi-même.</div>
          </div>
          <select value={ym} onChange={(e) => { setYm(e.target.value); setMsg(''); }} aria-label="Mois" data-fe-mois
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            {mois.map((m) => <option key={m} value={m}>{libelleYm(m)}</option>)}
          </select>
        </div>

        <div className="vrm-fe-trois" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', borderBottom: `1px solid ${C.border}` }}>
          {[
            ['Ce que VRM prépare', 'Une facture Factur-X (PDF + données lisibles par machine) par vente, et le récapitulatif mensuel de tes ventes aux particuliers (e-reporting).'],
            ["Où l'envoyer", "Super PDP (plateforme agréée) : connecte TON compte ci-dessous, les factures partent d'ici. Ailleurs (Indy, Pennylane, Tiime…) : dépose les fichiers toi-même."],
            ['À partir de quand', 'Septembre 2027 pour les micro-entreprises — à vérifier sur impots.gouv.fr.'],
          ].map(([t, d], i) => (
            <div key={t} data-fe-explique={i} style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, marginTop: -1 }}>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 4 }}>{d}</div>
            </div>
          ))}
        </div>

        {/* ── SUPER PDP : SON compte ── */}
        <div data-spdp data-spdp-etat={spdp === undefined ? 'encours' : spdp === null ? 'passu' : spdp.connecte ? 'connecte' : spdp.illisible ? 'illisible' : 'deconnecte'} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Plateforme agréée · Super PDP</div>
          {spdp === undefined && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Je lis ta connexion Super PDP…</div>}
          {spdp === null && <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>Je n'ai pas pu lire ta connexion Super PDP (le serveur n'a pas répondu) — je ne dis ni « connecté » ni « pas connecté ». <button type="button" onClick={() => { setSpdp(undefined); relireSpdp(); }} style={{ ...btn2(true), padding: '4px 10px', marginLeft: 4 }}>Réessayer</button></div>}
          {spdp && spdp.connecte && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ flex: '1 1 220px', fontSize: 13, color: C.text, lineHeight: 1.5 }} data-spdp-env={spdp.env}>
              <strong>Connecté à Super PDP</strong> · {ENV_LIBELLE[spdp.env] || spdp.env}{spdp.env === 'sandbox' ? ' (rien ne part réellement aux impôts)' : ''}
              <div className="vrm-aide" style={{ fontSize: 11, color: C.muted }}>Ce choix est celui que tu as déclaré : c'est ton compte Super PDP qui décide de l'environnement. Tes identifiants restent sur le serveur, chiffrés.</div>
            </div>
            <button type="button" data-spdp-deconnecter disabled={!!spOccupe} onClick={deconnecterSpdp} style={btn2(!spOccupe)}>{spOccupe === 'deconnexion' ? '…' : 'Déconnecter'}</button>
          </div>}
          {spdp && !spdp.connecte && <div style={{ marginTop: 8 }}>
            {spdp.illisible && <div data-spdp-illisible style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Ta connexion Super PDP ne se lit plus côté serveur (sa clé a changé) : reconnecte-la.</div>}
            {spdp.coffre === false && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Le serveur n'a pas de coffre configuré : aucune clé ne peut être rangée pour l'instant.</div>}
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Colle l'identifiant client et le secret client de TON compte Super PDP (espace développeur). Ils partent une seule fois au serveur, chiffrés ; VRM ne te les remontrera jamais. Les envois sont facturés sur ton compte Super PDP, pas sur celui de VRM.</div>
            <div role="radiogroup" aria-label="Environnement" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[['sandbox', 'Bac à sable'], ['production', 'Production']].map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={spEnv === k} data-spdp-choix={k} onClick={() => setSpEnv(k)}
                  style={{ ...btn2(true), borderColor: spEnv === k ? C.accent : C.border, color: spEnv === k ? C.accent : C.text }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <input data-spdp-id value={spId} onChange={(e) => setSpId(e.target.value)} placeholder="Identifiant client (client_id)" autoComplete="off" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
              <input data-spdp-secret type="password" value={spSecret} onChange={(e) => setSpSecret(e.target.value)} placeholder="Secret client (client_secret)" autoComplete="new-password" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
              <button type="button" data-spdp-connecter disabled={!!spOccupe || !spId.trim() || !spSecret.trim() || spdp.coffre === false} onClick={connecterSpdp} style={btn2(!spOccupe && !!spId.trim() && !!spSecret.trim() && spdp.coffre !== false)}>{spOccupe === 'connexion' ? 'Vérification…' : 'Connecter'}</button>
            </div>
          </div>}
          {spMsg && <div data-spdp-msg role="status" style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{spMsg}</div>}
        </div>

        {/* ── RÉCAP E-REPORTING ── */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Récapitulatif e-reporting · {libelleYm(ym)}</div>
          {!recap ? (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.55 }} data-fe-recap-etat={calc.etat}>
              {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun total n'est affiché plutôt qu'un zéro qui ne serait pas vrai. Rouvre cet écran dans un moment."}
            </div>
          ) : (<div data-fe-recap data-recap-ym={ym} data-recap-total={eurDe(recap.centimes)} data-recap-n={recap.n} data-recap-partiel={recap.partiel ? '1' : '0'}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <div className="vrm-display" style={{ fontSize: 20, fontWeight: 750, color: C.text, letterSpacing: -0.6 }}>
                {recap.partiel && <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>au moins </span>}{fmt(recap.centimes / 100)}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{recap.n} vente{recap.n > 1 ? 's' : ''} · datées comme ton CA déclaré (au versement pour Vinted)</div>
            </div>
            {parPlat.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {parPlat.map(([p, x]) => <span key={p} data-recap-plateforme={p} style={{ fontSize: 11, color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px' }}>{p} · {fmt(x.centimes / 100)} · {x.n}</span>)}
            </div>}
            {recap.partiel && <div data-fe-manque style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginTop: 8 }}>
              Total partiel — il manque : {recap.manques.join(' ; ')}. Le fichier le dit aussi.
            </div>}
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>VRM ne sait pas si un acheteur est une entreprise : toutes tes ventes du mois y figurent. Retire celles faites à une entreprise (elles demandent une facture).</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" onClick={() => exporter('csv')} data-fe-recap-csv style={btn2(true)}><Icon name="save" size={14} />Récap CSV</button>
              <button type="button" onClick={() => exporter('json')} data-fe-recap-json style={btn2(true)}><Icon name="save" size={14} />Récap JSON</button>
            </div>
            {spdp && spdp.connecte && <div data-spdp-recap style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>Le récapitulatif ne part pas encore tout seul vers Super PDP : la forme de son envoi par l'API n'a pas pu être vérifiée dans leur documentation officielle. Dépose ces fichiers toi-même d'ici là.</div>}
          </div>)}
        </div>

        {/* ── FACTURES FACTUR-X ── */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Factures Factur-X · ventes de {libelleYm(ym)}</div>
          {raisonGrise && <div data-fe-raison style={{ marginTop: 8, fontSize: 13, color: C.text, lineHeight: 1.55, border: `1px solid ${C.border}`, background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
            {raisonGrise}{!etat.ok && etat.geste ? <span style={{ color: C.muted }}> {etat.geste}</span> : null}
          </div>}
          {etat.ok && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Vendeur : {etat.vendeur.nom} · SIREN {etat.vendeur.siren} · « {etat.vendeur.mention} ». Acheteur : le nom porté par la vente, sinon « Particulier ».</div>}
          {recap && recap.lignes.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Aucune vente datée sur ce mois{recap.partiel ? ' (avec ce qui a pu être lu)' : ''}.</div>}
          {recap && recap.lignes.length > 0 && <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 10 }}>
            {recap.lignes.map((l, i) => {
              const num = numeroDe(l.id);
              const env = envoiDe(num), lib = libelleEnvoi(env);
              const peutEnvoyer = peutFacturer && spdp && spdp.connecte && enCours !== l.id && !(env && (env.etat === 'envoye' || env.etat === 'en-cours'));
              const peutRelire = spdp && spdp.connecte && enCours !== l.id && env && (env.etat === 'incertain' || env.etat === 'envoye');
              return (
                <div key={l.id} data-fe-vente={l.id} data-spdp-ligne={env ? env.etat : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre || 'Article'}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{l.plateforme} · {l.plateforme === 'Vinted' ? 'versée' : l.plateforme === 'eBay' ? 'payée' : 'vendue'} le {frJour(l.ts)}{num ? ` · ${num.numero}` : ''}</div>
                    {lib && <div data-spdp-statut={env.etat} style={{ fontSize: 11, marginTop: 2, lineHeight: 1.45, color: lib.ton === 'attention' ? C.warn : C.muted, overflowWrap: 'anywhere' }}>{lib.texte}</div>}
                  </div>
                  <span className="vrm-display" style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{fmt(l.eur)}</span>
                  <button type="button" data-fe-facture={l.id} disabled={!peutFacturer || enCours === l.id} title={raisonGrise || 'Télécharger la facture Factur-X (PDF + XML)'}
                    onClick={() => genererFacture(l)} style={btn2(peutFacturer && enCours !== l.id)}>
                    <Icon name="receipt" size={14} />{enCours === l.id ? '…' : 'Facture'}
                  </button>
                  {spdp && spdp.connecte && (peutRelire
                    ? <button type="button" data-spdp-relire={l.id} onClick={() => envoyerSpdp(l, true)} style={btn2(true)}>Relire</button>
                    : <button type="button" data-spdp-envoyer={l.id} disabled={!peutEnvoyer} title={!peutFacturer ? raisonGrise : 'Envoyer la facture Factur-X à Super PDP'}
                        onClick={() => envoyerSpdp(l, false)} style={btn2(peutEnvoyer)}>{enCours === l.id ? '…' : 'Envoyer à Super PDP'}</button>)}
                </div>
              );
            })}
          </div>}
          {msg && <div data-fe-msg role="status" style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>{msg}</div>}
          <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Numérotation continue par année (FX-AAAA-0001) ; une vente garde toujours le même numéro. La conformité du fichier n'a pas été validée par un outil officiel : ta plateforme le vérifiera au dépôt.</div>
        </div>
      </div>
    </Card>
  );
}
const MOIS_NOMS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function StatutFiscal({ liveStats, onNav }) {
  const regime = useRegimeFiscal();
  const [changer, setChanger] = useState(false);
  const [taux, setTaux] = useState(() => tauxUrssaf());
  useEffect(() => { const f = (e) => { if (e && e.detail && e.detail.k === 'vinted_urssaf_taux') setTaux(tauxUrssaf()); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  useEffect(() => onCloudReady(() => setTaux(tauxUrssaf())), []);
  if (regime === undefined) return null;
  const choisir = (k) => { save('vinted_regime', k); setChanger(false); };
  const vl = [tauxMicroVente({ liberatoire: true }), tauxMicroVente({ liberatoire: true, acre: true })].includes(taux);
  const acre = [tauxMicroVente({ acre: true }), tauxMicroVente({ liberatoire: true, acre: true })].includes(taux);
  const officiel = [false, true].some((a) => [false, true].some((l) => tauxMicroVente({ acre: a, liberatoire: l }) === taux));
  const poserTaux = (o) => { const t = tauxMicroVente(o); save('vinted_urssaf_taux', t); setTaux(t); };
  const choix = (
    <div data-statut-choix="" className="vrm-statut-grille">
      {REGIMES_FISCAUX.map(([k, t, sous, effet]) => (
        <button key={k} type="button" data-statut={k} aria-pressed={regime === k} onClick={() => choisir(k)} className="vrm-statut-option">
          <span className="vrm-statut-t">{t}</span>
          <span className="vrm-statut-s">{sous}</span>
          <span className="vrm-statut-e">{effet}</span>
        </button>
      ))}
    </div>
  );
  if (!regime || changer) return (
    <Card style={{ padding: 18 }}>
      <div data-statut-carte={regime ? 'changer' : 'question'}>
        <h3 className="vrm-titre-compta" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.text }}>{regime ? 'Change ton statut' : 'Quel est ton statut ?'}</h3>
        <p className="vrm-aide" style={{ margin: '0 0 14px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>VRM adapte ta comptabilité à ta situation : il ne te parle d'URSSAF que si tu es micro-entrepreneur. Tu peux le changer à tout moment.</p>
        {choix}
        {regime && <button type="button" className="vrm-lien-action" onClick={() => setChanger(false)} style={{ marginTop: 10, border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', padding: 0 }}>Annuler</button>}
      </div>
    </Card>
  );
  const entete = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 16px 8px' }}>
      <span data-statut-actuel={regime} style={{ fontSize: 13, color: C.muted }}>Statut : <b style={{ color: C.text }}>{libelleRegime(regime)}</b></span>
      <button type="button" className="vrm-lien-action" data-statut-changer="" onClick={() => setChanger(true)} style={{ border: 'none', background: 'transparent', color: C.accent, fontWeight: 600, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', padding: 0 }}>Changer</button>
    </div>
  );
  if (regime !== 'micro') {
    const texte = regime === 'particulier'
      ? <>Tu vends tes propres affaires : rien à déclarer à l'URSSAF, et VRM n'estime aucune cotisation. Bon à savoir : chaque année, Vinted transmet aux impôts les vendeurs qui dépassent <b>30 ventes ou 2 000 €</b> (le détail, compte par compte, est dans Ventes → Outils → Registre annuel). Si tu achètes pour revendre, c'est une activité : choisis « Micro-entrepreneur » ou « Société ».</>
      : regime === 'marge'
        ? <>Régime de la marge : VRM calcule la TVA sur ta marge dans le rapport comptable (Ventes → Outils). Tes cotisations ne se calculent pas sur ton chiffre d'affaires : VRM ne les estime pas — ton comptable s'en charge.</>
        : <>En société, tes impôts et tes cotisations ne se calculent pas sur ton chiffre d'affaires : VRM ne les estime pas et ne t'envoie aucun rappel URSSAF. Ton chiffre d'affaires et ton bénéfice restent ci-dessus, pour ton comptable.</>;
    return (
      <>
        {entete}
        <Card style={{ padding: 18 }}><div data-statut-carte={regime} style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{texte}</div></Card>
      </>
    );
  }
  return (
    <>
      {entete}
      {/* (29 oct.) Ce qui se FAIT ce mois d'abord (la déclaration, le suivi),
          puis le profil, le calendrier, les seuils et l'impôt — qui se lisent. */}
      <CarteUrssafMois liveStats={liveStats} onNav={onNav} />
      <SuiviUrssaf onNav={onNav} />
      <MicroEntreprise taux={taux} poserTaux={(o) => poserTaux(o)} officiel={officiel} vlTaux={vl} acreTaux={acre} />
    </>
  );
}

const lireFreqUrssaf = () => load('vinted_urssaf_freq', 'trimestriel') === 'mensuel' ? 'mensuel' : 'trimestriel';
function useFreqUrssaf() {
  const [f, setF] = React.useState(lireFreqUrssaf);
  React.useEffect(() => onCloudReady(() => setF(lireFreqUrssaf())), []);
  React.useEffect(() => {
    const h = (e) => { if (e && e.detail && e.detail.k === 'vinted_urssaf_freq') setF(lireFreqUrssaf()); };
    window.addEventListener('vrm:save', h); return () => window.removeEventListener('vrm:save', h);
  }, []);
  return f;
}
const lireOptionsMicro = () => optionsMicro(load('vrm_micro_options', null));
const eurMicro = (n) => n == null ? '—' : `${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
const eurRond = (n) => `${Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
const pctFr = (n) => `${String(n).replace('.', ',')} %`;
function LigneProfil({ titre, aide, children, attr }) {
  return (
    <div className="vrm-micro-ligne" {...(attr || {})} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px 12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{titre}</span>
        {children}
      </div>
      {aide ? <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{aide}</div> : null}
    </div>
  );
}
function JaugeBarre({ pct, marques = [], etat, attr }) {
  const alerte = etat && etat !== 'ok';
  const fond = alerte ? C.warn : C.text;
  return (
    <div {...(attr || {})} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} style={{ position: 'relative', height: 10, borderRadius: 999, background: C.card2 || C.bg, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, pct))}%`, background: fond, opacity: alerte ? 0.9 : 0.55, borderRadius: 999 }} />
      {marques.map((m) => <div key={m} aria-hidden="true" style={{ position: 'absolute', top: -1, bottom: -1, left: `${m}%`, width: 2, background: C.muted, opacity: 0.7 }} />)}
    </div>
  );
}
function MicroEntreprise({ taux, poserTaux, officiel, vlTaux, acreTaux }) {
  const freq = useFreqUrssaf();
  const [opts, optsPret] = useLigneSynchro('vrm_micro_options', lireOptionsMicro);
  const ligne = useLigneUrssaf();
  const [regLu, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const now = new Date();
  const jauge = React.useMemo(() => jaugeSeuils({ ligne, now }), [ligne]); // eslint-disable-line react-hooks/exhaustive-deps
  const cal = React.useMemo(() => calendrierUrssaf(freq, now, 3), [freq]); // eslint-disable-line react-hooks/exhaustive-deps
  const vl = opts.liberatoire;                     // 'oui' · 'non' · null (pas répondu)
  const acre = opts.acre || (opts.at === 0 && acreTaux);
  const s = seuilsDe(now.getFullYear());
  const [microOuvert, setMicroOuvert] = React.useState(false);
  const besoin = (optsPret && opts.liberatoire == null) || !!(jauge && ((jauge.tva && jauge.tva.etat && jauge.tva.etat !== 'ok') || (jauge.plafond && jauge.plafond.etat && jauge.plafond.etat !== 'ok')));
  React.useEffect(() => { if (besoin) setMicroOuvert(true); }, [besoin]);
  const poserOptions = (o) => {
    const n = { ...opts, ...o, at: Date.now() };
    save('vrm_micro_options', { liberatoire: n.liberatoire, acre: !!n.acre, at: n.at });
    // Le taux suit ses réponses — sauf un taux posé À LA MAIN (Réglages), qu'on
    // ne remplace jamais en silence.
    if (officiel) poserTaux({ liberatoire: n.liberatoire === 'oui', acre: !!n.acre });
  };
  const poserFreq = (f) => save('vinted_urssaf_freq', f);
  const jour = (d) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`;
  const sTitre = { fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: -0.15 };
  const sCarte = { padding: '16px 18px', margin: 0, height: '100%', boxSizing: 'border-box' };
  const lignesTaux = [
    ['Cotisations sociales', acre ? TAUX_MICRO.acre : TAUX_MICRO.cotisations, acre ? 'ACRE, 1ʳᵉ année' : 'vente de marchandises (BIC)'],
    ['Formation professionnelle', TAUX_MICRO.formation, 'commerçant'],
    ...(vl === 'oui' || (vl == null && vlTaux) ? [['Impôt sur le revenu', TAUX_MICRO.liberatoire, 'versement libératoire']] : []),
  ];
  // ── 1. Profil ──
  const profil = (
    <Card style={sCarte}>
      <div data-micro-profil={vl || 'passu'}>
        <div style={sTitre}>Ton profil URSSAF</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, marginBottom: 6, lineHeight: 1.5 }}>VRM ne lit pas ton espace URSSAF : dis-lui tes options, il calcule le reste. Tu les retrouves sur autoentrepreneur.urssaf.fr, rubrique « Mon compte ».</div>
        <LigneProfil titre="Tu déclares" attr={{ 'data-micro-freq': freq }} aide={phraseRythme(freq, now) + " L'URSSAF ne propose que ces deux rythmes (pas d'annuel)."}>
          <Segmente label="Rythme de déclaration" value={freq} onChange={poserFreq}
            options={[{ v: 'mensuel', l: 'Par mois', data: { 'data-micro-freq-choix': 'mensuel' } }, { v: 'trimestriel', l: 'Par trimestre', data: { 'data-micro-freq-choix': 'trimestriel' } }]} />
        </LigneProfil>
        <LigneProfil titre="Versement libératoire de l'impôt" attr={{ 'data-micro-vl': vl || 'passu' }}
          aide={<>
            {vl == null && optsPret ? <div data-micro-vl-question="" style={{ color: C.warn, fontWeight: 600, marginBottom: 4 }}>À confirmer : as-tu choisi cette option auprès de l'URSSAF ?{vlTaux ? ' Ton taux actuel (13,4 %) laisse penser que oui.' : ''}</div> : null}
            {vl === 'oui' ? <>Ton impôt sur le revenu ({TAUX_MICRO.liberatoire} %) part avec tes cotisations, {freq === 'mensuel' ? 'chaque mois' : 'chaque trimestre'}.</> : vl === 'non' ? <>Ton impôt sur le revenu se calcule à part, sur ta déclaration de revenus du printemps.</> : <>Ton impôt sur le revenu payé avec tes cotisations ({TAUX_MICRO.liberatoire} %), ou à part sur ta déclaration de revenus.</>}
            <Pourquoi label="Comment savoir si je l'ai choisi">Sur autoentrepreneur.urssaf.fr, ta déclaration affiche une ligne « versement libératoire » à côté des cotisations si tu l'as choisi. Avec l'option, l'impôt sur ce chiffre d'affaires ({TAUX_MICRO.liberatoire} % pour l'achat-revente) est payé au même rythme que tes cotisations, et tu n'as plus rien à payer dessus au printemps.{s ? <> Elle est possible si ton revenu fiscal de référence d'il y a deux ans était sous {eurRond(s.rfrLiberatoire)} (personne seule), et se demande avant le 30 septembre pour l'année suivante.</> : null}</Pourquoi>
          </>}>
          <Segmente label="Versement libératoire" value={vl} onChange={(v) => poserOptions({ liberatoire: v })}
            options={[{ v: 'oui', l: 'Oui', data: { 'data-taux-option': 'liberatoire' } }, { v: 'non', l: 'Non', data: { 'data-micro-vl-choix': 'non' } }]} />
        </LigneProfil>
        <LigneProfil titre="ACRE (première année)" attr={{ 'data-micro-acre': acre ? 'oui' : 'non' }} aide="L'aide à la création réduit tes cotisations sociales la première année d'activité.">
          <Segmente label="ACRE" value={acre ? 'oui' : 'non'} onChange={(v) => poserOptions({ acre: v === 'oui' })}
            options={[{ v: 'oui', l: 'Oui', data: { 'data-taux-option': 'acre' } }, { v: 'non', l: 'Non' }]} />
        </LigneProfil>
        <div data-statut-taux={String(taux)} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Ton taux</span>
            <span className="vrm-display" style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{pctFr(taux)}</span>
          </div>
          {officiel ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', marginTop: 8, fontSize: 13, color: C.muted }}>
              {lignesTaux.map(([l, t, n]) => <React.Fragment key={l}><span>{l} <span style={{ fontSize: 11.5 }}>· {n}</span></span><span style={{ color: C.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{pctFr(t)}</span></React.Fragment>)}
            </div>
          ) : <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>Posé à la main dans Réglages : VRM ne le change pas quand tu réponds ci-dessus.</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Taux officiels 2026 de l'achat-revente, à vérifier sur ton espace URSSAF. VRM ne remplace pas un comptable.</div>
        </div>
      </div>
    </Card>
  );
  // ── 2. Calendrier ──
  const calendrier = (
    <Card style={sCarte}>
      <div data-micro-calendrier={freq}>
        <div style={sTitre}>Ton calendrier</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          {freq === 'mensuel' ? 'Le chiffre d\'affaires d\'un mois se déclare et se paie le mois suivant.' : 'Le chiffre d\'affaires d\'un trimestre se déclare et se paie le mois qui suit le trimestre.'}
          {vl === 'oui' ? ' Ton impôt (1 %) part en même temps.' : vl === 'non' ? ' Ton impôt sur le revenu se paie à part (déclaration de revenus).' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {cal.map((p, i) => {
            const notee = regPret && p.ym.every((ym) => moisDeclare(regLu, ym));
            const presse = !notee && p.ouverte && p.joursRestants <= 7;
            return (
              <div key={p.periode} data-micro-echeance={p.ym.join(',')} data-micro-echeance-etat={notee ? 'notee' : p.ouverte ? 'ouverte' : 'avenir'}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'baseline', padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{p.periode}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: notee ? C.muted : presse ? C.warn : C.muted, whiteSpace: 'nowrap' }}>
                  {notee ? '✓ notée déclarée' : !p.ouverte ? 'à venir' : p.joursRestants <= 0 ? "dernier jour aujourd'hui" : `${p.joursRestants} j restants`}
                </span>
                <span style={{ gridColumn: '1 / -1', fontSize: 12.5, color: C.muted }}>Déclarer et payer du {jour(p.ouvre)} au {jour(p.limite)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
  // ── 3. Seuils ──
  let seuils;
  if (!s) seuils = null;
  else if (!jauge) seuils = (
    <Card style={sCarte}><div data-micro-seuils="passu"><div style={sTitre}>Tes seuils {now.getFullYear()}</div><div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Ton chiffre d'affaires de l'année se calcule dans l'écran Ventes : ouvre-le une fois sur cet appareil.</div></div></Card>
  );
  else {
    const j = jauge, am = j.partiel ? 'au moins ' : '';
    const tvaTxt = {
      due_depuis_janvier: <>Ton chiffre d'affaires {j.annee - 1} a dépassé {eurRond(j.seuils.tvaBase)} : la TVA est due depuis le 1er janvier {j.annee}. Vérifie avec ton service des impôts des entreprises.</>,
      majore_depasse: <>Seuil majoré de {eurRond(j.seuils.tvaMajore)} dépassé : la TVA est due <b>depuis le jour du dépassement</b>. Contacte ton service des impôts des entreprises sans attendre.</>,
      base_depasse: <>Seuil de {eurRond(j.seuils.tvaBase)} dépassé : tu restes sans TVA jusqu'au 31 décembre, puis tu factures la TVA dès le 1er janvier {j.annee + 1}. Attention, au-delà de {eurRond(j.seuils.tvaMajore)} (encore {eurMicro(j.tva.resteMajore)}), elle serait due tout de suite.</>,
      proche: <>Plus que {eurMicro(j.tva.reste)} avant le seuil de {eurRond(j.seuils.tvaBase)}.</>,
      ok: <>Encore {am ? 'au plus ' : ''}{eurMicro(j.tva.reste)} avant {eurRond(j.seuils.tvaBase)}. Au-delà, tu factures la TVA à partir du 1er janvier suivant.</>,
    }[j.tva.etat];
    const plafTxt = {
      sortie: <>Plafond dépassé deux années de suite : sortie du régime micro au 1er janvier {j.annee + 1}. Parles-en à un comptable.</>,
      depasse: <>Plafond dépassé cette année. Un dépassement isolé ne fait pas sortir du régime ; s'il se répète l'an prochain, tu en sors au 1er janvier suivant.</>,
      proche: <>Plus que {eurMicro(j.plafond.reste)} avant le plafond.</>,
      ok: <>Encore {am ? 'au plus ' : ''}{eurMicro(j.plafond.reste)} de marge.</>,
    }[j.plafond.etat];
    seuils = (
      <Card style={sCarte}>
        <div data-micro-seuils="lu" data-micro-ca={String(j.ca)} data-micro-partiel={j.partiel ? '1' : ''} data-micro-tva={j.tva.etat} data-micro-plafond={j.plafond.etat} data-micro-projection={j.projection == null ? '' : String(j.projection)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={sTitre}>Tes seuils {j.annee}</span>
            <span style={{ fontSize: 13, color: C.muted }}>Reçu en {j.annee} : <b className="vrm-display" style={{ color: C.text, fontSize: 16 }}>{am}{eurMicro(j.ca)}</b></span>
          </div>
          {j.partiel ? <div data-micro-partiel-texte="" style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>C'est un minimum : {j.raisons.join(' · ')}.</div> : null}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: C.text }}>Franchise de TVA</span>
              <span style={{ color: j.tva.etat === 'ok' ? C.muted : C.warn, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pctFr(Math.round(j.tva.pct))} de {eurRond(j.seuils.tvaBase)}</span>
            </div>
            <JaugeBarre attr={{ 'data-micro-jauge': 'tva' }} pct={j.ca / j.seuils.tvaMajore * 100} marques={[j.seuils.tvaBase / j.seuils.tvaMajore * 100]} etat={j.tva.etat} />
            <div style={{ position: 'relative', height: 16, fontSize: 11, color: C.muted, marginTop: 3 }}>
              <span style={{ position: 'absolute', left: 0 }}>0</span>
              <span style={{ position: 'absolute', right: `${100 - j.seuils.tvaBase / j.seuils.tvaMajore * 100}%`, transform: 'translateX(50%)', whiteSpace: 'nowrap' }}>{eurRond(j.seuils.tvaBase)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>Le trait marque le seuil ; la barre va jusqu'au seuil majoré ({eurRond(j.seuils.tvaMajore)}).</div>
            <div data-micro-tva-texte="" style={{ fontSize: 12.5, color: j.tva.etat === 'ok' ? C.muted : C.text, marginTop: 6, lineHeight: 1.5 }}>{tvaTxt}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: C.text }}>Plafond de la micro-entreprise</span>
              <span style={{ color: j.plafond.etat === 'ok' ? C.muted : C.warn, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pctFr(Math.round(j.plafond.pct))} de {eurRond(j.seuils.plafondVente)}</span>
            </div>
            <JaugeBarre attr={{ 'data-micro-jauge': 'plafond' }} pct={j.plafond.pct} etat={j.plafond.etat} />
            <div data-micro-plafond-texte="" style={{ fontSize: 12.5, color: j.plafond.etat === 'ok' ? C.muted : C.text, marginTop: 6, lineHeight: 1.5 }}>{plafTxt}</div>
          </div>
          {j.projection != null ? (
            <div data-micro-projection-texte="" style={{ fontSize: 12.5, color: (j.projTva || j.projPlafond) ? C.text : C.muted, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
              À ce rythme, tu finirais l'année vers <b>{eurRond(j.projection)}</b>{j.projPlafond ? <> : au-dessus du plafond de {eurRond(j.seuils.plafondVente)}.</> : j.projTva ? <> : au-dessus du seuil de TVA — anticipe ({eurRond(j.seuils.tvaBase)}).</> : '.'} Une estimation, pas une prévision.
            </div>
          ) : null}
          <Pourquoi label="D'où viennent ces seuils">Seuils {j.annee} de la vente de marchandises, vérifiés le {j.seuils.verifie} : franchise de TVA {eurRond(j.seuils.tvaBase)} (seuil majoré {eurRond(j.seuils.tvaMajore)}), plafond du régime micro {eurRond(j.seuils.plafondVente)}. Le chiffre est ce que tes plateformes t'ont versé dans l'année (toutes plateformes), hors comptes que tu as retirés.</Pourquoi>
        </div>
      </Card>
    );
  }
  // ── 4. Ta déclaration de revenus (et la CFE) ──
  const dr = declarationRevenus({ ligne, now, liberatoire: vl });
  const cfe = rappelCfe(now);
  const impots = (
    <Card style={sCarte}>
      <div data-micro-impots={dr ? 'lu' : 'passu'} data-micro-impots-annee={dr ? String(dr.annee) : ''} data-micro-impots-ca={dr ? String(dr.ca) : ''} data-micro-impots-cases={dr ? dr.cases.join(',') : ''}>
        <div style={sTitre}>Ta déclaration de revenus</div>
        {!dr ? <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Le montant se calcule dans l'écran Ventes : ouvre-le une fois sur cet appareil.</div> : (<>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            {dr.enCours ? <>Revenus {dr.annee}, à déclarer au printemps {dr.annee + 1} — pour l'instant :</> : <>Revenus {dr.annee}, à déclarer ce printemps (déclaration 2042-C-PRO) :</>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <b className="vrm-display" style={{ fontSize: 22, color: C.text }}>{dr.partiel ? 'au moins ' : ''}{eurMicro(dr.ca)}</b>
            <span style={{ fontSize: 13, color: C.text }}>{dr.liberatoire ? <>case <b>{dr.cases[0]}</b></> : <>case <b>5KO</b> sans versement libératoire, <b>5TA</b> avec</>}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            {dr.liberatoire === 'oui' ? <>Ton impôt est déjà payé avec tes cotisations : ce chiffre est déclaré pour information (il compte dans ton revenu fiscal de référence).</>
              : <>Le chiffre d'affaires brut, sans retirer d'abattement : les impôts appliquent eux-mêmes les 71 % de la vente de marchandises.</>}
            {dr.partiel ? <> C'est un minimum : {dr.raisons.join(' · ')}.</> : null}
            {' '}VRM ne compte que ce qu'il a capté sur tes plateformes reliées : compare avec le total de tes déclarations URSSAF de l'année.
          </div>
        </>)}
        {cfe ? <div data-micro-cfe="" style={{ fontSize: 12.5, color: C.text, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>CFE : l'avis est à payer au plus tard le <b>{cfe.limite}</b>, dans ton espace professionnel sur impots.gouv.fr. Exonérée l'année de création de ton entreprise.</div> : null}
      </div>
    </Card>
  );
  // (29 oct.) Sur ordinateur, le calendrier et les seuils côte à côte (puis le
  // profil et l'impôt) : une carte pleine largeur de 1 300 px pour trois lignes
  // de dates laissait l'écran à moitié vide. Au téléphone, une colonne.
  // (29 oct., « c'est trop incompréhensible ») Ces quatre cartes se LISENT de
  // temps en temps : repliées sous une ligne qui dit ce qu'il y a dedans. Elles
  // s'ouvrent d'elles-mêmes quand quelque chose demande son attention (le
  // versement libératoire pas encore répondu, un seuil proche ou dépassé).
  const aConfirmer = optsPret && vl == null;
  const seuilAlerte = besoin && !aConfirmer;
  const prochaine = (cal || []).find((c) => !(regPret && c.ym.every((m) => moisDeclare(regLu, m))));
  return (<details className="vrm-repli vrm-micro-repli" data-micro-repli={microOuvert ? 'ouvert' : 'ferme'} data-micro-attention={besoin ? '1' : ''} open={microOuvert} onToggle={(e) => setMicroOuvert(e.currentTarget.open)} style={{ margin: '12px 0', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '4px 16px 12px' }}>
    <summary>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Ta micro-entreprise</span>
        <span style={{ fontSize: 12.5, color: besoin ? (C.warn || '#B7791F') : C.muted, fontWeight: 500, lineHeight: 1.4 }}>{aConfirmer ? '1 question à confirmer · ' : ''}{seuilAlerte ? 'un seuil approche · ' : ''}taux {String(taux).replace('.', ',')} %{prochaine ? ` · ${prochaine.periode} à déclarer avant le ${prochaine.limite.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''} · seuils et impôts</span>
      </span>
    </summary>
    <div data-micro-entreprise="" className="vrm-micro-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 12, alignItems: 'stretch', marginTop: 8 }}>{calendrier}{seuils}{profil}{impots}</div>
  </details>);
}
function SuiviUrssaf({ onNav }) {
  const v = useLigneUrssaf();
  const [regLu, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  // Son rythme : synchronisé (§5.49) et suivi s'il le change ailleurs.
  const freq = useFreqUrssaf();
  const [ouvert, setOuvert] = React.useState(false);
  const [edit, setEdit] = React.useState(null);   // { ym, montant, paye, erreur? }
  const suivi = React.useMemo(() => regPret ? suiviUrssaf({ freq, declare: regLu, ligne: v }) : undefined, [regPret, regLu, v, freq]);
  const eur = (n) => n == null ? '—' : `${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
  const jour = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const nomMois = (ym) => MOIS_NOMS_FR[Number(String(ym).slice(5)) - 1];
  const ETAT = { declaree: 'Notée déclarée', a_declarer: 'À déclarer', en_retard: 'Pas notée', en_cours: 'En cours' };
  const ambre = C.warn || C.amber || '#B7791F';
  const titre = <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Suivi de tes déclarations URSSAF</div>;
  if (suivi === undefined) return <Card style={{ padding: '14px 16px', marginTop: 12 }}><div data-suivi-urssaf="charge">{titre}<div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Lecture de tes déclarations…</div></div></Card>;
  if (suivi === null) return <Card style={{ padding: '14px 16px', marginTop: 12 }}><div data-suivi-urssaf="passu">{titre}<div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Je n'ai pas pu lire tes déclarations notées — rien n'est perdu, rouvre cet écran.</div></div></Card>;
  const lignes = ouvert ? suivi.lignes : suivi.lignes.slice(0, 4);
  const a = suivi.annee;
  const exporter = () => telechargerFichier(new Blob(['﻿' + suiviUrssafCsv(suivi)], { type: 'text/csv;charset=utf-8' }), `vrm-suivi-urssaf-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  const ouvrirEdit = (ym) => { const d = (regLu || {})[ym] || {}; setEdit({ ym, montant: d.montant != null ? String(d.montant).replace('.', ',') : '', paye: d.paye != null ? String(d.paye).replace('.', ',') : '' }); };
  const enregistrer = () => {
    const m = lireMontantSaisi(edit.montant), p = lireMontantSaisi(edit.paye);
    if (m === undefined || p === undefined) { setEdit((e) => ({ ...e, erreur: 'Un montant en euros, avec au plus deux chiffres après la virgule (ex. 1 234,50).' })); return; }
    if (!completerDeclaration(edit.ym, { montant: m, paye: p })) { setEdit((e) => ({ ...e, erreur: "Tes déclarations ne sont pas encore chargées — rien n'est écrit, réessaie dans un instant." })); return; }
    setEdit(null);
  };
  const champ = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 16, background: C.bg, color: C.text, width: '100%', maxWidth: 200, minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' };
  const btn = { fontSize: 13, fontWeight: 600, color: C.text, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <Card style={{ padding: '14px 16px', marginTop: 12 }}>
      <div data-suivi-urssaf="lu" data-suivi-retard={String(suivi.enRetard)} data-suivi-regul={String(suivi.aRegulariser)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {titre}
          {suivi.lignes.length ? <button type="button" className="vrm-lien-action" data-suivi-export="" onClick={exporter} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' }}>Exporter (CSV)</button> : null}
        </div>
        <div data-suivi-annee={a.annee} data-suivi-annee-ca={String(a.ca)} data-suivi-annee-paye={a.paye == null ? '' : String(a.paye)} style={{ fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          {a.n === 0 ? <>Aucune déclaration notée en {a.annee}. Après chaque déclaration sur l'URSSAF, touche « C'est déclaré » : VRM garde ce que tu as déclaré et payé.</>
            : <>{a.annee} : <b style={{ color: C.text }}>{eur(a.ca)}</b> déclarés sur {a.n} mois · {a.paye != null ? <>cotisations payées <b style={{ color: C.text }}>{eur(a.paye)}</b></> : <>cotisations ≈ <b style={{ color: C.text }}>{eur(a.estime)}</b> (estimées : note ce que tu as payé avec « Compléter »)</>}</>}
        </div>
        {suivi.enRetard > 0 ? <div data-suivi-retard-texte="" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.5 }}>{suivi.enRetard === 1 ? '1 période passée n\'est' : `${suivi.enRetard} périodes passées ne sont`} pas notée{suivi.enRetard > 1 ? 's' : ''} « déclarée ». Si tu l'as déjà déclarée sur l'URSSAF, touche « C'est déclaré » pour la noter ; sinon, déclare-la vite (une déclaration en retard peut coûter une pénalité).</div> : null}
        {(() => {
          const aNoter = suivi.lignes.filter((l) => l.etat === 'en_retard' || l.etat === 'a_declarer').flatMap((l) => l.aNoter);
          return aNoter.length >= 2 ? (
            <button type="button" data-suivi-serie={aNoter.length} onClick={() => demanderSerieDeclaration(aNoter, onNav)} style={{ ...btn, marginTop: 8, alignSelf: 'flex-start' }}>
              Noter mes {aNoter.length} mois à la suite
            </button>) : null;
        })()}
        {suivi.aRegulariser > 0 ? <div data-suivi-regul-texte="" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.5 }}>À ajouter à ta prochaine déclaration : <b>{eur(suivi.aRegulariser)}</b> de ventes que VRM compte et qui ne sont dans aucune déclaration (≈ {eur(aPayerUrssaf(suivi.aRegulariser, tauxUrssaf()))} de cotisations).</div> : null}
        {suivi.lignes.length === 0 ? <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>Rien à suivre sur les 12 derniers mois.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            {lignes.map((l) => {
              const ambreEtat = l.etat === 'en_retard' || l.urgent;
              const sousEtat = l.etat === 'declaree' && l.at ? ` le ${jour(l.at)}`
                : l.etat === 'en_cours' ? ` · à déclarer avant le ${jour(l.dueDate)}`
                : l.etat === 'en_retard' ? ` · échéance passée le ${jour(l.dueDate)}`
                : l.joursRestants <= 0 ? " · dernier jour aujourd'hui" : l.joursRestants === 1 ? ' · avant demain soir' : ` · avant le ${jour(l.dueDate)} (${l.joursRestants} j)`;
              const editeIci = edit && l.yms.includes(edit.ym);
              return (
                <div key={l.label} data-suivi-periode={l.label} data-suivi-etat={l.etat} data-suivi-urgent={l.urgent ? '1' : ''} data-suivi-calc={l.caCalc == null ? '' : String(l.caCalc)} data-suivi-decl={l.caDecl == null ? '' : String(l.caDecl)} data-suivi-paye={l.paye == null ? '' : String(l.paye)} data-suivi-ecart={l.ecart == null ? '' : String(l.ecart)}
                  style={{ borderTop: `1px solid ${C.border}`, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{l.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ambreEtat ? ambre : C.muted }}>{ETAT[l.etat]}{sousEtat}</span>
                  </div>
                  {l.etat === 'declaree' ? (
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                      Déclaré <b style={{ color: C.text }}>{eur(l.caDecl)}</b>{l.caTape ? '' : ' (chiffre de VRM quand tu l\'as notée)'}{l.regle === 'vente' ? ' · à la date de vente' : ''}
                      {' · '}{l.paye != null ? <>cotisations payées <b style={{ color: C.text }}>{eur(l.paye)}</b></> : <>cotisations ≈ {eur(l.aPayerDecl)} <span>(pas notées)</span></>}
                      {l.ecart ? <div data-suivi-ecart-texte="" style={{ marginTop: 2 }}>{l.ecart < 0
                        ? <>VRM compte aujourd'hui <b style={{ color: C.text }}>{eur(-l.ecart)}</b> de moins (des ventes déclarées ne sont plus dans VRM : compte retiré, vente annulée). Ta déclaration reste celle-là.</>
                        : <>VRM compte aujourd'hui <b style={{ color: C.text }}>{eur(l.ecart)}</b> de plus : des ventes de cette période ne sont dans aucune déclaration — à ajouter à la prochaine (≈ {eur(l.aPayerEcart)} de cotisations).</>}</div> : null}
                      {l.partiel && l.caCalc != null ? <div style={{ marginTop: 2 }}>VRM compte au moins {eur(l.caCalc)} aujourd'hui (des ventes sans date de versement) : pas d'écart affirmé.</div> : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                      {l.caCalc == null ? 'Le montant se calcule dans Ventes (ouvre-le une fois).' : <>Reçu {l.partiel ? 'au moins ' : ''}<b style={{ color: C.text }}>{eur(l.caCalc)}</b> · à payer ≈ {l.partiel ? 'au moins ' : ''}<b style={{ color: C.text }}>{eur(l.aPayerCalc)}</b>{l.etat === 'en_cours' ? ' (pour l\'instant)' : ''}</>}
                      {l.yms.length > 1 && l.aNoter.length < l.yms.length ? <> · noté : {l.yms.length - l.aNoter.length} mois sur {l.yms.length}</> : null}
                    </div>
                  )}
                  {editeIci ? (
                    <div data-suivi-edit={edit.ym} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      {l.yms.length > 1 ? <div style={{ fontSize: 13, color: C.text, fontWeight: 600, textTransform: 'capitalize' }}>{nomMois(edit.ym)}</div> : null}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.muted }}>CA déclaré, tel que sur ton espace URSSAF
                        <input data-suivi-edit-ca inputMode="decimal" value={edit.montant} onChange={(e) => setEdit((x) => ({ ...x, montant: e.target.value, erreur: null }))} placeholder="ex. 1 234,50" style={champ} /></label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.muted }}>Cotisations payées
                        <input data-suivi-edit-paye inputMode="decimal" value={edit.paye} onChange={(e) => setEdit((x) => ({ ...x, paye: e.target.value, erreur: null }))} placeholder="ex. 153,20" style={champ} /></label>
                      {edit.erreur ? <div role="alert" style={{ fontSize: 12.5, color: ambre }}>{edit.erreur}</div> : null}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" data-suivi-edit-ok="" onClick={enregistrer} style={{ ...btn, background: C.accent, color: C.onAccent || '#fff', border: 'none' }}>Enregistrer</button>
                        <button type="button" onClick={() => setEdit(null)} style={btn}>Annuler</button>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>Les ventes de la déclaration ne bougent pas : seuls ces deux chiffres sont gardés. Vide = pas noté.</div>
                    </div>
                  ) : null}
                  {!editeIci && ((l.etat === 'a_declarer' || l.etat === 'en_retard') && l.aNoter.length > 0 || l.aCompleter.length > 0 || (l.etat === 'declaree')) ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {(l.etat === 'a_declarer' || l.etat === 'en_retard') && l.aNoter.length > 0 ? (
                        <button type="button" data-suivi-noter={l.aNoter[0]} onClick={() => demanderDeclaration(l.aNoter[0], onNav)} style={btn}>
                          {l.yms.length > 1 ? `C'est déclaré — noter ${nomMois(l.aNoter[0])}` : "C'est déclaré"}
                        </button>) : null}
                      {l.aCompleter.length > 0 ? (
                        <button type="button" data-suivi-completer={l.aCompleter[0]} onClick={() => ouvrirEdit(l.aCompleter[0])} style={btn}>
                          {l.yms.length > 1 ? `Compléter ${nomMois(l.aCompleter[0])}` : 'Compléter'}
                        </button>) : l.etat === 'declaree' ? (
                        <button type="button" className="vrm-lien-action" data-suivi-corriger={l.yms[l.yms.length - 1]} onClick={() => ouvrirEdit(l.yms[l.yms.length - 1])} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12.5, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Corriger les montants</button>) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {suivi.lignes.length > 4 ? <button type="button" className="vrm-lien-action" data-suivi-tout="" onClick={() => setOuvert((o) => !o)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{ouvert ? 'Moins' : `Voir les ${suivi.lignes.length} périodes`}</button> : null}
          </div>
        )}
      </div>
    </Card>
  );
}
function CarteUrssafMois({ liveStats, onNav }) {
  const v = useLigneUrssaf();
  const urssafMois = v ? v.mois : null;
  // `declare` : le registre « J'ai déclaré ce mois » était-il lu quand la ligne
  // a été publiée (`lu`) ou pas encore (`pasSu`) ? (revue du 6 octobre)
  const urssafInfo = v ? { aDater: v.aDater || null, sources: v.sources || null, declare: v.declare || null } : null;
  const TAUX_URSSAF = tauxUrssaf() / 100;
  const now0 = new Date();
  const moisCourant = { nom: MOIS_NOMS_FR[now0.getMonth()] };
  const ymCour = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}`;
  const eCour = urssafMois ? urssafMois.find((m) => m.ym === ymCour) : null;
  const moisCourantCA = urssafMois ? (eCour ? eCour.ca : 0) : null;
  // Le nombre vient de la MÊME ligne que le montant : ils ne peuvent pas diverger.
  const moisCourantN = urssafMois ? (eCour ? (eCour.n || 0) : 0) : null;
  const urssafEstime = moisCourantCA == null ? null : aPayerUrssaf(moisCourantCA, TAUX_URSSAF * 100);
  const netApresUrssaf = moisCourantCA == null ? null : netApresUrssafDe(moisCourantCA, TAUX_URSSAF * 100);
  // (29 oct.) UN réglage, posé dans « Ton profil URSSAF » : la carte le suit.
  const urssafFreq = useFreqUrssaf();
  const urssafDue = React.useMemo(() => nextUrssafDeadline(urssafFreq), [urssafFreq]);
  // (22 oct.) Le registre « J'ai déclaré ce mois », en TROIS états : `null` tant
  // que le nuage n'est pas arrivé (pas su ⇒ on ne dit pas « déclarée »).
  const [regLu, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const registreDecl = regPret ? regLu : null;
  // Le « CA finalisé » de la prochaine échéance : les mois PUBLIÉS qui tombent
  // dans la période ; sans ligne publiée, `null` — un tiret, jamais un zéro.
  // (22 oct.) La MÊME règle que le rappel de Ma journée et la notification du 1er
  // (`montantPeriodeUrssaf`, §11) : des ventes sans date de versement, ou une
  // ligne publiée avant la fin de la période ⇒ le montant est un MINIMUM (§5).
  const montantEcheance = montantPeriodeUrssaf(urssafDue, v, TAUX_URSSAF * 100);
  const urssafPeriodCA = montantEcheance.ca;
  const echeancePartiel = montantEcheance.partiel ? 1 : 0;
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); };
  const Mt = ({ v: x }) => <span style={{whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmt(x)}</span>;
  const sTitre = {fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15};
  const sLib = {fontSize:13,color:C.muted,fontWeight:500};
  const sNote = {fontSize:13,color:C.muted,lineHeight:1.5};
  const sHero = {fontWeight:700,color:C.text,letterSpacing:-1,lineHeight:1.05,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'};
  const sCarte = {padding:18,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow};
  return (
    <section data-compta-urssaf="" style={{display:'flex',flexDirection:'column',gap:8}}>
      <h3 className="vrm-titre-compta" data-titre-section="" style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15,margin:'8px 2px 0'}}>Ta déclaration URSSAF</h3>
      {/* ── LE MOIS EN COURS, EN UNE SEULE CARTE ────────────────────────────
          ⚠️ Il y en avait DEUX à la suite, toutes deux titrées du même mois
          (« Mois en cours — septembre », puis « À payer pour septembre »), et
          la première répétait un « CA du mois » déjà affiché quatre lignes plus
          haut — arrondi différemment (296 € contre 296,40 €). Le même nombre,
          deux fois, deux valeurs : c'est ce qui fait douter de tous les autres
          (§11). Une carte, un mois, et chaque chiffre une seule fois. */}
      {/* (16 oct., passe « premium ») Une carte, quatre chiffres, une ligne de
          calcul et la couverture en lignes courtes : tout ce qui empêche un total
          partiel de se faire passer pour complet reste VISIBLE (§5). Ce qui
          s'explique (le détail du calcul, les gestes pour dater les ventes, la
          réserve « je ne suis pas comptable ») se replie dans « Comment c'est
          calculé » au lieu de quatre pavés colorés de même poids. L'ambre ne
          reste que là où il y a vraiment quelque chose à faire (§7). */}
      {(() => {
        const now=new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const e = (urssafMois||[]).find(m=>m.ym===ym) || {};
        const nA = Number(e.nAilleurs)||0, caA = Number(e.caAilleurs)||0;
        const ou = Object.keys(e.ailleurs||{}).sort().map(k=>{ const [y,m]=k.split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); }).join(', ');
        const decl = (urssafInfo && urssafInfo.declare) || '';
        // La couverture : de la MÊME ligne publiée que le total (§5) — les
        // « dont » somment au total, et ce qui MANQUE est dit à côté.
        const par = Object.entries(e.par||{}).filter(([,v])=>v && v.n>0);
        const src = (urssafInfo && urssafInfo.sources) || {};
        const pasSu = Object.entries(src).filter(([,v])=>v==='pasSu').map(([k])=>k);
        const ad = urssafInfo && urssafInfo.aDater;
        const adV = ad && ad.par && ad.par.Vinted;
        const adL = ad && (ad.par ? ad.par.Leboncoin : (ad.n > 0 ? ad : null));
        const morceaux = [];
        const Puce = ({ children, warn }) => (
          <div style={{display:'flex',gap:8,alignItems:'baseline',color:warn?C.warn:C.muted}}>
            <span aria-hidden="true" style={{width:4,height:4,borderRadius:999,background:'currentColor',opacity:.55,flexShrink:0,transform:'translateY(-2px)'}}/>
            <span style={{minWidth:0}}>{children}</span>
          </div>
        );
        if (moisCourantCA!=null) {
          if (par.length > 1 || (par.length === 1 && par[0][0] !== 'Vinted')) morceaux.push(<Puce key="d">dont {par.map(([k,v],i)=><React.Fragment key={k}>{i?' · ':''}{k} <Mt v={v.ca}/></React.Fragment>)}</Puce>);
          if (pasSu.length) morceaux.push(<Puce key="p" warn>{pasSu.join(' et ')} : pas pu lire — {pasSu.length>1?'leurs':'ses'} ventes ne sont pas dans ce chiffre, rouvre l'écran dans un moment</Puce>);
          if (adV && adV.n > 0) morceaux.push(<Puce key="av">{adV.n} vente{adV.n>1?'s':''} Vinted finalisée{adV.n>1?'s':''} sans date de versement (<Mt v={adV.ca}/>) : dans aucun mois pour l'instant{extSait('versement')==='retard' && <span style={{color:C.warn}}> — mets l'extension à jour ({EXT_CAPACITES.versement}) : c'est elle qui va chercher ces dates</span>}</Puce>);
          if (adL && adL.n > 0) morceaux.push(<Puce key="a">{adL.n} vente{adL.n>1?'s':''} Leboncoin sans date (<Mt v={adL.ca}/>) : dans aucun mois tant que leur date n'est pas captée — tu peux la saisir dans « Chiffre d'affaires par période »{extSait('lbcdate')==='retard' && <span style={{color:C.warn}}> — mets d'abord l'extension à jour ({EXT_CAPACITES.lbcdate})</span>}</Puce>);
          // (29 oct.) « Vestiaire Co : pas encore relié » retiré : affiché à tous, même sans compte Vestiaire, il n'apprenait rien.
        }
        const Chiffre = ({ lib, val, fort, couleur, sous, sousStyle }) => (
          <div style={{minWidth:0}}>
            <div style={sLib}>{lib}</div>
            <div className="vrm-display" style={{...sHero,fontSize:fort?28:20,letterSpacing:fort?-0.8:-0.5,marginTop:5,color:couleur||C.text}}>{val}</div>
            {sous && <div style={{...sNote,fontSize:11,marginTop:3,...(sousStyle||{})}}>{sous}</div>}
          </div>
        );
        return (
      <div data-stats-carte="mois" style={{...sCarte,padding:'20px 20px 16px'}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'4px 12px',flexWrap:'wrap'}}>
          <div style={{...sTitre,fontSize:15,textTransform:'capitalize'}}>{moisCourant.nom}</div>
          <div style={{...sNote,fontSize:13}}>Ce que tu déclares à l'URSSAF</div>
        </div>
        <div className="vrm-mois-grille" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'18px 16px',marginTop:16}}>
          <Chiffre fort lib={`À payer (${String(tauxUrssaf()).replace('.',',')} %)`} val={urssafEstime==null?'—':fmt(urssafEstime)} couleur={urssafEstime==null?C.muted:C.text}/>
          <Chiffre fort lib="Net après paiement" val={netApresUrssaf==null?'—':fmt(netApresUrssaf)} couleur={netApresUrssaf==null?C.muted:C.text}/>
          {/* LA COUVERTURE À CÔTÉ, jamais à la place : une vente de ce mois
              n'est pas encore finalisée, elle n'entre donc pas dans ce qu'il
              doit déclarer — mais elle existe, et il l'a vue sur Ventes. */}
          {/* ⚠️ (revue des chiffres, 17 octobre) « sur N vendues ce mois-ci »
              présentait les finalisées comme une PARTIE des vendues. Depuis le
              3 octobre elles sont comptées au mois du VERSEMENT : une vente
              faite le mois dernier et versée ce mois-ci est dedans, sans être
              « vendue ce mois-ci » (banc chiffres-croises : « 3 sur 4 » quand
              2 seulement des 4 en font partie). Deux notions côte à côte, chacune
              son mot — jamais « sur ». */}
          <Chiffre lib="Ventes finalisées" val={moisCourantN!=null?moisCourantN:'—'} couleur={moisCourantN!=null?C.text:C.muted}
            sous={moisCourantN!=null && liveStats && liveStats.ventesMois!=null && liveStats.ventesMois!==moisCourantN ? <span data-mois-vendues={liveStats.ventesMois}>argent versé ce mois · {liveStats.ventesMois} vente{liveStats.ventesMois>1?'s':''} faite{liveStats.ventesMois>1?'s':''} ce mois-ci</span> : null}/>
          {/* ⚠️ « n/d » est du vocabulaire d'informaticien : un tiret, et la
              raison en clair — il n'est pas développeur. */}
          <Chiffre lib="Bénéfice" val={'—'} couleur={C.muted}
            sous={liveStats&&liveStats.caMois!=null ? <button type="button" onClick={versSaisiePrix} title="Ouvrir la saisie en série des prix d'achat" style={{border:'none',background:'transparent',padding:0,margin:0,font:'inherit',color:C.accent,fontWeight:600,cursor:'pointer',minHeight:0,textAlign:'left',display:'inline-flex',alignItems:'flex-start',justifyContent:'flex-start'}}>saisis tes prix d'achat →</button> : null}/>
        </div>
        {/* ⚠️⚠️ CETTE PHRASE CITAIT `moisCourant.ca` — L'ANCIENNE ARCHIVE, VIDE
            DEPUIS JUILLET 2026, donc « (0,00 €) ». Les CHIFFRES avaient été
            rebranchés sur la ligne publiée, la phrase qui les explique était
            restée en arrière (§5). Elle cite le MÊME montant que celui qui
            produit « à payer », et reste visible (le banc urssaf.cjs la lit).
            ⚠️ (revue du 6 octobre) une vente versée ce mois-ci mais déjà
            déclarée ailleurs est EXCLUE : la phrase le dit, des MÊMES champs de
            la MÊME ligne publiée (`nAilleurs`, `caAilleurs`, `ailleurs`) — et
            dit aussi quand le registre n'était pas encore lu (`declare`). */}
        <div style={{...sNote,fontSize:13,marginTop:10,paddingTop:14,borderTop:`1px solid ${C.border}`,lineHeight:1.55}}>
          {moisCourantCA==null
            ? <>Ce chiffre se calcule sur l'écran <b>Ventes</b> : ouvre-le une fois sur cet appareil et il s'affichera ici.</>
            : <span data-urssaf-declare={decl}>Calculé sur le CA des ventes finalisées en {moisCourant.nom}, toutes plateformes (<b style={{color:C.text,fontWeight:600}}><Mt v={moisCourantCA}/></b>)
                {nA > 0 && <span data-urssaf-ailleurs={Math.round(caA*100)} data-urssaf-ailleurs-n={nA}>, hors {nA} vente{nA>1?'s':''} (<Mt v={caA}/>) déjà dans ta déclaration{ou ? <> de {ou}</> : null}</span>}
                .
                {decl === 'pasSu' && <span style={{color:C.warn}}> Tes déclarations passées (« J'ai déclaré ce mois ») n'étaient pas encore chargées quand ce chiffre a été calculé : une vente déjà déclarée peut encore y être comptée — ouvre l'écran <b>Ventes</b> pour le mettre à jour.</span>}
              </span>}
        </div>
        {morceaux.length > 0 && <div data-urssaf-couverture style={{...sNote,marginTop:8,display:'flex',flexDirection:'column',gap:4}}>{morceaux}</div>}
        {/* ⚠️ HONNÊTETÉ (§5.57) : l'URSSAF veut le CA ENCAISSÉ, et l'app dit
            comment elle date chaque vente — replié, pas retiré. */}
        <details className="vrm-stats-calcul" style={{marginTop:10}}>
          <summary style={{cursor:'pointer',fontSize:13,fontWeight:500,color:C.muted,padding:'6px 0'}}>Comment c'est calculé</summary>
          <div style={{...sNote,display:'flex',flexDirection:'column',gap:8,padding:'4px 0 6px'}}>
            {moisCourantCA!=null && <div>On additionne les ventes <b>finalisées</b> (argent versé) en {moisCourant.nom}, <b>toutes plateformes</b>, ventes masquées comprises{nA > 0 && <> — {nA>1?'les ventes versées':'la vente versée'} ce mois-ci mais déjà dans ta déclaration{ou ? <> de {ou}</> : null} {nA>1?'ne sont pas recomptées':'n\'est pas recomptée'} ici</>}. C'est la somme à verser à la fin du mois (versement libératoire).</div>}
            {moisCourantCA!=null && adV && adV.n > 0 && extSait('versement')!=='retard' && <div>Ventes Vinted sans date de versement : {extSait('versement')==='ok' ? <>l'extension va chercher leur date à tes prochaines visites sur Vinted (compte par compte)</> : <>c'est l'extension, sur ton ordinateur, qui va chercher ces dates</>}.</div>}
            {moisCourantCA!=null && adL && adL.n > 0 && <div>Ventes Leboncoin sans date : {extSait('lbcdate')==='ok' ? <>ouvre « Mes transactions » sur leboncoin.fr, l'extension la relève au passage</> : extSait('lbcdate')==='retard' ? <>une fois l'extension à jour, ouvre « Mes transactions » sur leboncoin.fr</> : <>depuis l'ordinateur où l'extension est installée, ouvre « Mes transactions » sur leboncoin.fr</>}.</div>}
            {moisCourantCA!=null && (e.par||{}).Leboncoin && <div>Leboncoin : daté au jour de la vente (sa date de versement n'est pas encore captée).</div>}
            <div>Ces ventes sont datées au jour où la plateforme t'a <b>versé l'argent</b> (la commande finalisée par l'acheteur), pas au jour de la vente. Vérifie ton taux et ton chiffre sur autoentrepreneur.urssaf.fr — je ne suis pas comptable.</div>
          </div>
        </details>
        {/* Prochaine échéance de DÉCLARATION (rappel) — un encart neutre ; la
            couleur ne vient QUE si l'échéance presse (≤ 14 j) ou est passée. */}
        <div style={{marginTop:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
            <span style={{...sTitre,fontSize:13,flex:1}}>Prochaine déclaration</span>
            <span data-urssaf-rythme={urssafFreq} style={{fontSize:12.5,color:C.muted}}>{urssafFreq==='mensuel'?'chaque mois':'chaque trimestre'}</span>
          </div>
          {urssafDue ? (()=>{
            // (22 oct.) « C'EST DÉCLARÉ » ICI, À CÔTÉ DU LIEN : le rappel envoie sur
            // cet écran, et le geste n'existait que dans Ventes → Outils → Rapport
            // comptable. Le bouton ouvre CE formulaire-là sur le mois à noter (un
            // seul formulaire, ses gardes, §11). Période pas finie : rien à noter.
            // Tout noté : la ligne le dit, et l'échéance ne se colore plus (§7 :
            // la couleur seulement s'il reste quelque chose à faire).
            const ymsDue = moisPeriodeUrssaf(urssafDue);
            const finie = _startOfDay(new Date()) > _startOfDay(urssafDue.periodEnd);
            const aNoter = registreDecl == null ? ymsDue : ymsDue.filter((ym) => !moisDeclare(registreDecl, ym));
            const faite = registreDecl != null && ymsDue.length > 0 && aNoter.length === 0;
            const noteeLe = faite ? Math.max(...ymsDue.map((ym) => Number(registreDecl[ym] && registreDecl[ym].at) || 0)) : 0;
            const nomYm = (ym) => { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long' }); };
            const late=!faite&&urssafDue.daysLeft<0, soon=!faite&&urssafDue.daysLeft>=0&&urssafDue.daysLeft<=14;
            const col=late?C.danger:soon?C.warn:C.text;
            return (
              <div style={{background:C.card2||C.bg,borderRadius:12,padding:'14px 14px 12px',border:(late||soon)?`1px solid ${col}55`:`1px solid transparent`}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'2px 10px',flexWrap:'wrap'}}>
                  <span style={{fontSize:15,fontWeight:700,color:col,letterSpacing:-0.2,whiteSpace:'nowrap'}}>{urssafDue.dueDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>
                  <span style={{fontSize:13,fontWeight:600,color:(late||soon)?col:C.muted,whiteSpace:'nowrap'}}>{late?`en retard de ${-urssafDue.daysLeft} j`:urssafDue.daysLeft===0?"aujourd'hui !":`dans ${urssafDue.daysLeft} j`}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 12px',marginTop:10,fontSize:13,color:C.muted}}>
                  <span>Période</span><span style={{color:C.text,fontWeight:500,textAlign:'right'}}>{urssafDue.label}</span>
                  {/* (revue du 19 oct.) Ce montant vient de la ligne publiée, datée au
                      VERSEMENT : c'est le « Reçu (versé) » du tableau juste au-dessus,
                      pas son « Finalisé ». Le libellé « CA finalisé » le contredisait
                      sur le même écran (septembre : 0,00 € ici, 4 224,77 € là). */}
                  <span>Reçu (versé)</span><span data-echeance-ca={urssafPeriodCA==null?'':String(urssafPeriodCA)} data-echeance-de={urssafDue.periodStart.toISOString()} data-echeance-a={urssafDue.periodEnd.toISOString()} data-echeance-partiel={echeancePartiel||undefined} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:500,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={urssafPeriodCA}/></>}</span>
                  <span>À payer ≈</span><span data-echeance-apayer={urssafPeriodCA==null?'':String(aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100))} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:700,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100)}/></>}</span>
                </div>
                {faite ? (
                  <div data-urssaf-declaree={ymsDue.join(',')} style={{fontSize:13,color:C.text,lineHeight:1.45,marginTop:12}}>
                    <b>✓ Notée « déclarée »</b>{noteeLe > 0 ? <> le {new Date(noteeLe).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</> : null}<span style={{color:C.muted}}> — {ymsDue.length > 1 ? 'leurs ventes ne seront' : 'ses ventes ne seront'} pas recomptées dans un autre mois.</span>
                  </div>
                ) : (
                <div style={{display:'flex',alignItems:'center',gap:'6px 12px',flexWrap:'wrap',marginTop:12}}>
                  <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" data-declarer-urssaf="" style={{fontSize:13,fontWeight:600,color:C.onAccent||'#fff',background:C.accent,borderRadius:10,padding:'8px 14px',textDecoration:'none',minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center'}}>Déclarer sur l'URSSAF →</a>
                  {finie && aNoter.length > 0 && (
                    <button type="button" data-urssaf-cest-declare={aNoter[0]} onClick={() => demanderDeclaration(aNoter[0], onNav)}
                      style={{fontSize:13,fontWeight:600,color:C.text,background:'transparent',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 14px',minHeight:44,cursor:'pointer',fontFamily:'inherit'}}>
                      {ymsDue.length > 1 ? `C'est déclaré — noter ${nomYm(aNoter[0])}` : "C'est déclaré"}
                    </button>
                  )}
                  <span style={{fontSize:11,color:C.muted,lineHeight:1.4,flex:'1 1 160px'}}>Estimation ({String(tauxUrssaf()).replace('.',',')} %) — le chiffre officiel se saisit là‑bas.{finie && aNoter.length > 0 ? <> Une fois déclaré, note-le ici : ses ventes ne seront plus recomptées le mois suivant.</> : null}{finie && ymsDue.length > 1 && aNoter.length > 0 && aNoter.length < ymsDue.length ? <> {ymsDue.length - aNoter.length} mois sur {ymsDue.length} déjà noté{ymsDue.length - aNoter.length > 1 ? 's' : ''}.</> : null}</span>
                </div>
                )}
              </div>
            );
          })() : <div style={{fontSize:13,color:C.muted}}>Aucune échéance à venir.</div>}
        </div>
      </div>
        );
      })()}


    </section>
  );
}

function RecapComptableMensuel() {
  const v = useLigneUrssaf();
  const urssafMois = v ? v.mois : null;
  const TAUX_URSSAF = tauxUrssaf() / 100;
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisRecap = !urssafMois ? [] : urssafMois.map((m) => {
    const [y, mo] = String(m.ym || '').split('-');
    return { ym: m.ym, label: `${moisNoms[Number(mo) - 1] || mo} ${y}`, ca: Number(m.ca) || 0, profit: null, count: m.n,
             urssaf: aPayerUrssaf(m.ca, TAUX_URSSAF * 100), net: netApresUrssafDe(m.ca, TAUX_URSSAF * 100) };
  });
  const exportCompta = () => {
    try {
      const rows = [['Mois','Ventes','CA finalise','Benefice',`Cotisations+impot ${String(tauxUrssaf()).replace('.',',')}%`,'Net estime']];
      moisRecap.forEach((m) => rows.push([m.label, m.count, m.ca.toFixed(2), m.profit == null ? '' : m.profit.toFixed(2), m.urssaf.toFixed(2), m.net.toFixed(2)]));
      const csv = rows.map((r) => r.join(';')).join('\n');
      telechargerFichier(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `vrm-comptabilite-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    } catch (err) { toast('Erreur export : ' + err.message); }
  };
  return (
    <>
      {/* Récap comptable mensuel */}
      {moisRecap.length>0&&(
        <Card><details className="vrm-repli" data-recap-repli="">
          <summary style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
            <span data-titre-section="" style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15}}>Récap comptable mensuel</span><span style={{fontSize:12.5,color:C.muted,fontWeight:500,marginLeft:'auto'}}>{moisRecap.length} mois</span>
          </summary>
          <div style={{display:'flex',justifyContent:'flex-end',margin:'8px 0 10px'}}><Btn small outline onClick={exportCompta} style={{fontSize:13}}>Exporter (CSV)</Btn></div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {['Mois','Ventes','CA finalisé','Bénéfice',`Cotis.+impôt ${String(tauxUrssaf()).replace('.',',')} %`,'Net estimé'].map(h=>(
                    <th key={h} style={{textAlign:h==='Mois'?'left':'right',padding:'8px 10px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moisRecap.map(m=>(
                  <tr key={m.label} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'8px 10px',fontWeight:600,color:C.text,whiteSpace:'nowrap'}}>{m.label}</td>
                    <td style={{padding:'8px 10px',textAlign:'right'}}>{m.count}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:500,whiteSpace:'nowrap'}}>{fmt(m.ca)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:m.profit==null?C.muted:C.text,whiteSpace:'nowrap'}}>{m.profit==null?'—':fmt(m.profit)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.muted,whiteSpace:'nowrap'}}>{fmt(m.urssaf)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.text,fontWeight:600,whiteSpace:'nowrap'}}>{fmt(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ⚠️ (revue des chiffres, 17 octobre) Cette phrase disait « ventes que
              Vinted a marquées finalisées, à leur date de vente » — sous un
              tableau qui lit la ligne publiée par Ventes (`vinted_urssaf_mois`) :
              TOUTES plateformes, datée au VERSEMENT depuis le 3 octobre, et au
              mois de déclaration quand il l'a notée. La carte du mois, au-dessus,
              disait le contraire sur le même écran. La phrase qui explique un
              chiffre vient de la même source que lui (§5) : `data-regle` dit
              laquelle a produit les lignes. */}
          <div data-recap-regle={urssafMois?'versement':'archive'} style={{fontSize:11,color:C.muted,marginTop:12,lineHeight:1.5}}>
            {urssafMois
              ? <>Ventes <b>finalisées</b>, toutes plateformes, comptées dans le mois où l'argent a été versé (Vinted), de la vente (Leboncoin), de la commande payée (eBay) — ou dans le mois où tu les as déclarées. Annulées et remboursements exclus, ventes masquées comprises ; une vente sans date de versement n'est dans aucun mois.</>
              : <>Ventes de l'ancienne archive, à leur date de réception — annulées et remboursements exclus.</>} Cotisations estimées à {String(tauxUrssaf()).replace('.',',')} % (taux réglable dans Réglages). La déclaration se fait sur autoentrepreneur.urssaf.fr.
          </div>
        </details></Card>
      )}


    </>
  );
}
function ComptaLigne({ gauche, droite, onDel, extra, attrs }) {
  return (
    <div className="vrm-set-ligne" {...(attrs || {})}>
      <span className="vrm-set-lib">{gauche}</span>
      <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{droite}</span>
      {extra}
      <button type="button" onClick={onDel} title="Supprimer" aria-label="Supprimer" style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 20, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '0 2px', minHeight: 36, minWidth: 28 }}>×</button>
    </div>
  );
}

function ComptaSection({ titre, note, total, totalSub, children, data }) {
  return (
    <section className="vrm-set-groupe vrm-compta-groupe" data-compta-section={data} style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 16px 8px' }}>
        <h3 className="vrm-titre-compta" data-titre-section="" style={{ fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15, margin: 0 }}>{titre}</h3>
        {total != null && <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}><b className="vrm-display" style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</b>{totalSub ? ` ${totalSub}` : ''}</span>}
      </div>
      <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>{children}</div>
      {note && <div className="vrm-set-pied" style={{ color: C.muted }}><Pourquoi label="À quoi ça sert ?" ecrit>{note}</Pourquoi></div>}
    </section>
  );
}

function ComptaAjout({ ouvert, onClick, libelle, data }) {
  return (
    <button type="button" className="vrm-set-ligne" onClick={onClick} aria-expanded={ouvert} {...data} style={{ color: C.accent }}>
      <span className="vrm-set-lib"><b style={{ color: C.accent, fontWeight: 600 }}>{ouvert ? 'Fermer' : `+ ${libelle}`}</b></span>
    </button>
  );
}

const PERIODES_BENEF = [['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];
function BeneficeCompta({ compta, onNav, onSansDepenses, onAjouterDepense }) {
  const [nuagePret, setNuagePret] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => setNuagePret(true)), []);
  const [periode, setPeriode] = React.useState(() => { try { const v = localStorage.getItem('vrm_compta_periode_benef'); return PERIODES_BENEF.some(([k]) => k === v) ? v : 'mois'; } catch (_) { return 'mois'; } });
  const choisir = (p) => { setPeriode(p); try { localStorage.setItem('vrm_compta_periode_benef', p); } catch (_) {} };
  const { pub, etat, B } = useBeneficeCalcul(compta, periode);
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); };
  const e2 = (x) => x == null ? '' : String(Math.round(x * 100) / 100);
  const sansAchat = B ? B.n - B.nCout : 0;
  const Ligne = ({ lib, val, sous, fort, data }) => (
    <div className="vrm-set-ligne" {...(data || {})}>
      <span className="vrm-set-lib"><b style={{ color: C.text }}>{lib}</b>{sous ? <small style={{ color: C.muted }}>{sous}</small> : null}</span>
      <span className="vrm-display" style={{ fontSize: fort ? 20 : 15, fontWeight: fort ? 700 : 600, color: val == null ? C.muted : C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{val == null ? '—' : fmt(val)}</span>
    </div>
  );
  const lienSaisie = <button type="button" onClick={versSaisiePrix} data-benef-porte="" style={{ background: 'none', border: 0, padding: 0, color: C.accent, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Compléter les prix d'achat</button>;
  return (
    <section className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0 }}
      data-benef-etat={etat} data-benef-periode={periode}
      data-benef-n={B ? String(B.n) : ''} data-benef-ncout={B ? String(B.nCout) : ''}
      data-benef-brut={B && B.nCout > 0 ? e2(B.brut) : ''} data-benef-ventes-net={B && B.nCout > 0 ? e2(B.net) : ''}
      data-benef-charges={B ? e2(B.charges) : ''} data-benef-cotis={B ? e2(B.cotis) : ''}
      data-benef-net={B ? e2(B.netFinal) : ''} data-benef-raison={B ? B.raison : ''}
      data-benef-couverture={B ? couvertureBenefice(B) : ''} data-benef-plateformes={B ? (B.toutes ? 'toutes' : 'vinted') : ''}
      data-benef-depenses={B ? (nuagePret ? B.depenses : 'passu') : ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 16px 8px' }}>
        <h3 className="vrm-titre-compta" data-titre-section="" style={{ fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15, margin: 0, flex: '1 1 auto' }}>Ton bénéfice{B ? ` · ${B.libelle}` : ''}</h3>
        <Segmente label="Période du bénéfice" plein value={periode} onChange={choisir} style={{ margin: 0, flex: '0 1 300px' }}
          options={PERIODES_BENEF.map(([k, l]) => ({ v: k, l, data: { 'data-benef-choix': k } }))} />
      </div>
      <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
        {!B ? (
          <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0, lineHeight: 1.5 }}>
            {etat === 'encours' ? 'Je lis ton bénéfice…' : <>Ton bénéfice se calcule dans l'écran Ventes, à partir de tes prix d'achat : ouvre-le une fois{onNav ? <> (<a href="?tab=cat_ventes" onClick={(ev) => { ev.preventDefault(); onNav('cat_ventes'); }} style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>Ventes</a>)</> : null}, il arrivera ici.</>}
          </small></span></div>
        ) : (<>
          <Ligne lib="Bénéfice brut" val={B.nCout > 0 ? B.brut : (B.n === 0 ? 0 : null)}
            sous={B.n === 0 ? (B.toutes ? 'aucune vente finalisée sur la période' : 'aucune vente Vinted finalisée sur la période')
              : B.nCout === B.n ? `CA − prix d'achat · prix d'achat connus pour les ${B.n} vente${B.n > 1 ? 's' : ''}`
              : <>CA − prix d'achat · prix d'achat connus pour {B.nCout} vente{B.nCout > 1 ? 's' : ''} sur {B.n} — {lienSaisie}</>}
            data={{ 'data-benef-ligne': 'brut' }} />
          {B.nCout > 0 && (B.fraisCouverts > 0 || B.fraisInconnus > 0) && <Ligne lib="− boosts et frais de vente" val={B.fraisInconnus > 0 ? null : B.fraisCouverts} sous={B.fraisInconnus > 0 ? `frais eBay pas connus pour ${B.fraisInconnus} vente${B.fraisInconnus > 1 ? 's' : ''}` : 'des mêmes ventes'} data={{ 'data-benef-ligne': 'frais' }} />}
          <Ligne lib="− charges" val={B.depenses === 'jamais' ? null : B.charges}
            sous={B.depenses === 'jamais' ? (nuagePret && onSansDepenses ? null : 'aucune dépense notée') : B.depenses === 'aucune' ? 'aucune — tu as indiqué ne pas avoir de dépenses à noter' : 'abonnements, dépenses, packs et coûts fixes de la période'}
            data={{ 'data-benef-ligne': 'charges' }} />
          {B.depenses === 'jamais' && nuagePret && onSansDepenses && (
            <div className="vrm-set-ligne"><span className="vrm-set-lib" style={{ minWidth: 0 }}>
              <ChoixDepenses onAucune={onSansDepenses} onAjouter={onAjouterDepense} />
            </span></div>
          )}
          {B.sansCotis ? <div data-benef-ligne="cotis" data-benef-sans-cotis="" style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, padding: '2px 0' }}>Aucune cotisation URSSAF déduite — {regimeFiscal() ? `statut : ${libelleRegime(regimeFiscal())}` : 'ton statut n\'est pas encore choisi (Comptabilité → Ton statut)'}.</div> :
          <Ligne lib="− cotisations URSSAF" val={B.cotis}
            sous={B.cotis == null ? 'ton CA déclaré se calcule dans l\'écran Ventes' : `${String(tauxUrssaf()).replace('.', ',')} % du CA ${B.toutes ? 'déclaré (Vinted, Leboncoin, eBay)' : 'Vinted'} versé sur la période (${fmt(B.caDecl)})`}
            data={{ 'data-benef-ligne': 'cotis' }} />}
          <Ligne lib={B.depenses === 'jamais' ? 'Net avant tes dépenses' : 'Bénéfice net'} fort val={B.netFinal}
            sous={B.raison === 'achats' ? <>il manque le prix d'achat de {sansAchat} vente{sansAchat > 1 ? 's' : ''} : sans lui, le net ne se calcule pas{(B.n > 0 && B.nCout !== B.n) ? '' : <> — {lienSaisie}</>}</>
              : B.raison === 'frais' ? 'des frais eBay ne sont pas connus : sans eux, le net ne se calcule pas'
              : B.raison === 'cotisations' ? 'en attente de ton CA déclaré (écran Ventes)'
              : B.depenses === 'jamais' ? 'brut − frais − cotisations'
              : 'brut − frais − charges − cotisations'}
            data={{ 'data-benef-ligne': 'net' }} />
          <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0, lineHeight: 1.5 }}>
            {B.toutes ? <>Ventes finalisées Vinted, Leboncoin et eBay, au jour de la vente — la même règle que l'écran Ventes.{couvertureBenefice(B) ? ` Prix d'achat connus : ${couvertureBenefice(B)}.` : ''} Une vente Leboncoin ou eBay se relie à sa paire par son SKU VRM, sa référence ou un lien posé, jamais par son titre.</> : <>Ventes Vinted finalisées, au jour de la vente — publiées par une version d'avant de l'écran Ventes : ouvre-le une fois pour y ajouter Leboncoin et eBay.</>} Les cotisations sont celles du CA versé sur la période.{pub.at ? ` Calculé avec tes ventes lues le ${new Date(pub.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : ''}
          </small></span></div>
        </>)}
      </div>
    </section>
  );
}
function ComptaPro({ liveStats, onNav, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const [data, setData] = React.useState(() => {
    try { const d = load('vrm_compta', null); return d && typeof d === 'object' ? { ...COMPTA_DEFAUT, ...d } : { ...COMPTA_DEFAUT }; }
    catch (_) { return { ...COMPTA_DEFAUT }; }
  });
  // Rattrapage nuage : on ne remplace QUE si rien n'a encore été saisi (§5.49).
  React.useEffect(() => onCloudReady(() => {
    try { const d = load('vrm_compta', null); if (d && typeof d === 'object') setData(cur => comptaVide(cur) ? { ...COMPTA_DEFAUT, ...d } : cur); } catch (_) {}
  }), []);
  const maj = (next) => { setData(next); try { save('vrm_compta', next); } catch (_) {} };
  const depenses = data.depenses || [], fixes = data.fixes || [], packs = data.packs || [], abonnements = data.abonnements || [];

  // ── Totaux, tous OWNED (aucun CA recalculé ici) ───────────────────────────
  const annee = new Date().getFullYear();
  const moisEcoules = new Date().getMonth() + 1;          // janvier = 1
  const moisCle = ymCourant();
  const cetteAnnee = (d) => String(d || '').slice(0, 4) === String(annee);
  const somme = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const fixesParMois = somme(fixes, x => x.montant);
  // Total annuel et total du mois : UNE seule règle, partagée avec le rapport annuel (§11).
  const charges = comptaChargesAnnee(data, annee);
  const chargesAnnee = charges.total;
  const chargesDuMois = comptaChargesMois(data, moisCle);
  const chargesMois = chargesDuMois.total;

  // ── RÉSULTAT = recettes déclarées − charges ───────────────────────────────
  // On CONSOMME la ligne publiée par l'écran Ventes (`vinted_urssaf_mois`, le CA
  // déclaré, toutes plateformes, §11) — on ne recalcule aucun CA. Ligne
  // absente/pas encore publiée ⇒ `null` (on n'invente pas de recettes).
  // ⚠️ Ce n'est PAS le bénéfice : le prix d'achat des paires n'est pas déduit
  // ici — le bénéfice brut et net vit dans `BeneficeCompta`, juste en dessous.
  // ⚠️ (17 octobre) TROIS ÉTATS, ET LA LIGNE SE RELIT QUAND ELLE CHANGE. Elle
  // était lue une fois au rendu : sur un appareil qui n'avait jamais ouvert
  // Ventes, la carte disait « ton CA déclaré arrive sur cet appareil » — rien ne
  // l'y amenait (la ligne n'était pas synchronisée) — pendant que la carte « CA
  // par période », juste en dessous, chiffrait déjà le reçu du mois. La ligne
  // est maintenant synchronisée (elle arrive avec le nuage) et la carte la relit
  // à l'arrivée du nuage et à chaque publication :
  //   `encours` (nuage pas encore arrivé) · `passu` (nuage arrivé, jamais
  //   publiée : « — » et où elle se calcule) · `lu`.
  const lireLigneCa = () => { try { const v = load('vinted_urssaf_mois', null); return v && Array.isArray(v.mois) ? v : null; } catch (_) { return null; } };
  const [ligneCa, setLigneCa] = React.useState(lireLigneCa);
  const [nuagePret, setNuagePret] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => { setNuagePret(true); setLigneCa(lireLigneCa()); }), []);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_urssaf_mois') setLigneCa(lireLigneCa()); };
    const g = (e) => { if (e && e.key === 'vinted_urssaf_mois') setLigneCa(lireLigneCa()); };
    window.addEventListener('vrm:save', f); window.addEventListener('storage', g);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('storage', g); };
  }, []);
  const etatCa = ligneCa ? 'lu' : (nuagePret ? 'passu' : 'encours');
  const caAt = ligneCa && Number(ligneCa.at) > 0 ? Number(ligneCa.at) : null;
  const recettesAnnee = ligneCa
    ? ligneCa.mois.filter(m => String(m.ym || '').slice(0, 4) === String(annee)).reduce((s, m) => s + (Number(m.ca) || 0), 0)
    : null;
  const resultatAnnee = recettesAnnee == null ? null : recettesAnnee - chargesAnnee;
  // ⚠️ (revue des chiffres, 17 octobre) LA COUVERTURE DE LA MÊME LIGNE. Ce CA
  // se présentait comme complet alors que la ligne publiée peut dire « eBay :
  // pas pu lire » ou porter des ventes finalisées sans date (dans aucun mois) —
  // ce que la carte URSSAF du tableau de bord dit, sur la MÊME ligne. Un total
  // partiel qui se présente comme complet est pire qu'un total absent (§5).
  const couvertureCa = (() => {
    if (!ligneCa) return null;
    const pasSu = Object.entries(ligneCa.sources || {}).filter(([, e]) => e === 'pasSu').map(([k]) => k);
    const ad = ligneCa.aDater && Number(ligneCa.aDater.n) > 0 ? { n: Number(ligneCa.aDater.n), ca: Number(ligneCa.aDater.ca) || 0 } : null;
    return { pasSu, aDater: ad };
  })();
  const caPartiel = !!(couvertureCa && couvertureCa.pasSu.length);

  // ── Formulaires d'ajout (états locaux) ────────────────────────────────────
  const auj = new Date().toISOString().slice(0, 10);
  const [dDate, setDDate] = React.useState(auj);
  const [dLib, setDLib] = React.useState('');
  const [dCat, setDCat] = React.useState(COMPTA_CATS[0]);
  const [dMnt, setDMnt] = React.useState('');
  const [dErr, setDErr] = React.useState('');
  const [pPlat, setPPlat] = React.useState('Leboncoin');
  const [pCpt, setPCpt] = React.useState('');
  const [pMnt, setPMnt] = React.useState('');
  const [pDate, setPDate] = React.useState(auj);
  const [aLib, setALib] = React.useState('');
  const [aMnt, setAMnt] = React.useState('');
  const [aPer, setAPer] = React.useState('mois');
  const [aDeb, setADeb] = React.useState(auj);
  const [aFin, setAFin] = React.useState('');
  const [aErr, setAErr] = React.useState('');
  // (22 oct.) « Ajouter une dépense » depuis Ma journée : le formulaire des
  // dépenses s'ouvre déplié (drapeau `DEMANDE_DEPENSE`, 30 s au plus).
  const depenseDemandee = () => DEMANDE_DEPENSE.on && Date.now() - DEMANDE_DEPENSE.at < 30000;
  const [ouvert, setOuvert] = React.useState(() => depenseDemandee() ? 'dep' : '');          // '' · 'abo' · 'dep' · 'pack' : un formulaire à la fois
  const [versDepense, setVersDepense] = React.useState(() => depenseDemandee() ? 1 : 0);
  React.useEffect(() => { DEMANDE_DEPENSE.on = false; }, []);
  React.useEffect(() => {
    if (!versDepense) return;
    const t = setTimeout(() => { try { const el = document.querySelector('[data-dep-form]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); } catch (_) {} }, 80);
    return () => clearTimeout(t);
  }, [versDepense]);
  const [packLbc, setPackLbc] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_pack_photo&select=actif:data->actif,at:data->>at`, { headers: sbAuth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (mort) return; const x = Array.isArray(j) ? j[0] : null; setPackLbc(x && typeof x.actif === 'boolean' ? { actif: x.actif, at: x.at || null } : null); })
      .catch(() => { if (!mort) setPackLbc(null); });
    return () => { mort = true; };
  }, []);
  const basculer = (k) => setOuvert(o => o === k ? '' : k);

  const ajouterDepense = () => {
    const m = parseMontant(dMnt);
    if (!dLib.trim()) { setDErr('Dis en deux mots ce que tu as payé (ex. « cartons »).'); return; }
    if (!m) { setDErr('Le montant doit être un nombre en euros, par exemple 12,50.'); return; }
    setDErr('');
    maj({ ...data, depenses: [{ id: rCompId(), date: dDate || auj, libelle: dLib.trim(), cat: dCat, montant: m }, ...depenses] });
    setDLib(''); setDMnt(''); setDCat(COMPTA_CATS[0]); setDDate(auj); setOuvert('');
  };
  const ajouterPack = () => {
    const m = parseMontant(pMnt); if (!m) return;
    maj({ ...data, packs: [{ id: rCompId(), plateforme: pPlat, compte: pCpt.trim(), montant: m, date: pDate || auj }, ...packs] });
    setPCpt(''); setPMnt(''); setPDate(auj); setOuvert('');
  };
  // Un abonnement mal saisi n'est pas ajouté, et on DIT pourquoi (jamais en silence).
  const ajouterAbonnement = () => {
    const m = parseMontant(aMnt);
    if (!aLib.trim()) { setAErr('Donne-lui un nom (ex. « VRM », « Canva »).'); return; }
    if (!m) { setAErr('Le montant doit être un nombre en euros, par exemple 12,99.'); return; }
    if (!ymCompta(aDeb)) { setAErr('Il faut une date de début.'); return; }
    if (aFin && aFin < aDeb) { setAErr('La date de fin est avant la date de début.'); return; }
    maj({ ...data, abonnements: [{ id: rCompId(), libelle: aLib.trim(), montant: m, periode: aPer === 'an' ? 'an' : 'mois', debut: aDeb, fin: aFin || '' }, ...abonnements] });
    setALib(''); setAMnt(''); setAPer('mois'); setADeb(auj); setAFin(''); setAErr(''); setOuvert('');
  };
  const terminerAbonnement = (id) => maj({ ...data, abonnements: abonnements.map(a => a.id === id ? { ...a, fin: auj } : a) });
  const retirer = (cle, id) => maj({ ...data, [cle]: (data[cle] || []).filter(x => x.id !== id) });
  // Export CSV des charges pour le comptable (date · type · libellé · montant).
  const exporterCharges = () => {
    const e = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const L = [[`Charges ${annee}`], [], ['Date', 'Type', 'Libelle', 'Montant']];
    depenses.filter(d => cetteAnnee(d.date)).forEach(d => L.push([d.date ? d.date.split('-').reverse().join('/') : '', 'Depense' + (d.cat ? ' (' + d.cat + ')' : ''), d.libelle || '', (Number(d.montant) || 0).toFixed(2)]));
    packs.filter(p => cetteAnnee(p.date)).forEach(p => L.push([p.date ? p.date.split('-').reverse().join('/') : '', 'Pack / option', `${p.plateforme || ''}${p.compte ? ' ' + p.compte : ''}`, (Number(p.montant) || 0).toFixed(2)]));
    charges.aboLignes.forEach(x => L.push([x.a.debut ? x.a.debut.split('-').reverse().join('/') : '', `Abonnement x${x.n} echeance${x.n > 1 ? 's' : ''}`, x.a.libelle || '', x.total.toFixed(2)]));
    fixes.forEach(f => L.push(['', `Cout fixe x${moisEcoules} mois`, f.libelle || '', ((Number(f.montant) || 0) * moisEcoules).toFixed(2)]));
    L.push(['', '', 'TOTAL', chargesAnnee.toFixed(2)]);
    const csv = L.map(r => r.map(e).join(';')).join('\n');
    try {
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `charges-${annee}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (_) {}
  };

  // Factures reçues (reçus Vinted par email) : on consomme juste le NOMBRE pour
  // renvoyer vers l'écran Factures, on ne duplique pas la liste (§7/§11).
  const [nFactures, setNFactures] = React.useState(null);
  React.useEffect(() => { let stop = false; fetchProInvoices().then(r => { if (!stop) setNFactures(Array.isArray(r) ? r.length : null); }).catch(() => {}); return () => { stop = true; }; }, []);

  // ── Palette d'écran (§7 : neutre partout, UN accent rare) ──────────────────
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box', minHeight: 40 };
  const btnAdd = { border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 40 };
  const formBox = { padding: '12px 16px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: C.muted, flex: '1 1 140px', minWidth: 0 };
  const pastille = (actif) => ({ border: `1px solid ${actif ? C.text : C.border}`, background: actif ? C.text : 'transparent', color: actif ? C.card : C.text, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 });
  // Section et Ligne vivent HORS du composant : définies ici, elles changeaient
  // d'identité à chaque rendu et React remontait leurs champs — le curseur
  // sautait à chaque lettre tapée.
  const Ligne = ComptaLigne, Section = ComptaSection;
  const vide = (txt) => <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0 }}>{txt}</small></span></div>;
  const listeBox = (items) => items;
  const dateFr = (s) => String(s || '').split('-').reverse().join('/');
  // (16 oct.) Un LIEN dans une phrase, pas un bouton : la règle des boutons
  // (hauteur plancher au doigt) étirait la ligne qui le portait — un
  // interligne de ~2 dans le paragraphe du résultat.
  const lienBtn = (txt, tab, fs = 13) => <a href={`?tab=${tab}`} onClick={(e) => { e.preventDefault(); if (onNav) onNav(tab); }} style={{ color: C.accent, fontWeight: 600, cursor: 'pointer', fontSize: fs, textDecoration: 'none' }}>{txt}</a>;

  return (
    <div className="vrm-finance-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHead icon="euro" title="Comptabilité" desc="Ton résultat, ta déclaration URSSAF, tes charges et tes factures." />
      {/* (26 octobre) Julien : « la compta, c'est horrible ». La page fait plus de
          6 000 px au téléphone : un sommaire en tête mène à chaque partie, et la
          déclaration URSSAF remonte juste sous le bénéfice. Aucune règle de
          calcul ne change ; les explications longues passent derrière « Pourquoi ? ». */}
      <nav aria-label="Parties de la comptabilité" data-compta-sommaire="" className="vrm-rangee vrm-compta-sommaire" style={{ display: 'flex', gap: 8, margin: '-4px 0 0' }}>
        {[['compta-resultat', 'Résultat'], ['compta-benefice', 'Bénéfice'], ['compta-urssaf', 'URSSAF'], ['compta-charges', 'Charges'], ['compta-ca', 'Chiffre d\'affaires'], ['compta-factures', 'Factures']].map(([id, l]) => (
          <button key={id} type="button" data-compta-aller={id} onClick={() => { const e = document.getElementById(id); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            style={{ flex: '0 0 auto', minHeight: 40, padding: '0 14px', borderRadius: 999, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{l}</button>
        ))}
      </nav>

      {/* ── HÉRO : LE RÉSULTAT ─────────────────────────────────────────────────
          Recettes déclarées (ligne publiée par Ventes, §11) − charges. Le seul
          endroit où l'accent est permis (§7 : rare) : le filet du haut. */}
      <Card id="compta-resultat" className="vrm-finance-result" style={{ padding: 0, overflow: 'hidden', scrollMarginTop: 72 }}>
        <div style={{ padding: '16px 18px' }} data-compta-resultat={resultatAnnee == null ? '' : String(Math.round(resultatAnnee * 100) / 100)} data-compta-ca={recettesAnnee == null ? '' : String(Math.round(recettesAnnee * 100) / 100)} data-compta-charges={String(Math.round(chargesAnnee * 100) / 100)} data-compta-ca-etat={etatCa} data-compta-ca-at={caAt ? new Date(caAt).toISOString() : ''}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginBottom: 6 }}>Résultat {annee} · CA déclaré − charges</div>
          {recettesAnnee == null ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <div className="vrm-display" style={{ fontSize: 28, fontWeight: 700, color: C.muted, letterSpacing: -0.8 }}>—</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Tes charges {annee} : <span className="vrm-display">{fmt(chargesAnnee)}</span></div>
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>
                {etatCa === 'encours'
                  ? 'Je lis ton CA déclaré…'
                  : <>Ton CA déclaré n'a encore été calculé sur aucun de tes appareils : il se calcule dans {lienBtn('Ventes', 'cat_ventes')}. Ouvre-le une fois, et tes charges y seront déduites ici.</>}
              </div>
            </div>
          ) : (
            <div>
              <div className="vrm-display" style={{ fontSize: 28, fontWeight: 700, color: resultatAnnee < 0 ? C.warn : C.text, letterSpacing: -0.8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{caPartiel ? <span style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>au moins </span> : null}{fmt(resultatAnnee)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
                <span className="vrm-display" style={{ color: C.text, fontWeight: 600 }}>{caPartiel ? 'au moins ' : ''}{fmt(recettesAnnee)}</span>
                <span>CA déclaré</span>
                <span style={{ color: C.border }}>—</span>
                <span className="vrm-display" style={{ color: C.text, fontWeight: 600 }}>{fmt(chargesAnnee)}</span>
                <span>de charges{charges.aboTotal > 0 ? ` (dont ${fmt(charges.aboTotal)} d'abonnements)` : ''}</span>
              </div>
              {couvertureCa && (caPartiel || couvertureCa.aDater) && (
                <div data-compta-couverture={couvertureCa.pasSu.join(',')} data-compta-adater={couvertureCa.aDater ? String(couvertureCa.aDater.n) : '0'} style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
                  {caPartiel && <div>Sans {couvertureCa.pasSu.join(' ni ')} : {couvertureCa.pasSu.length > 1 ? 'leurs' : 'ses'} ventes n'ont pas pu être lues — ce CA est un minimum.</div>}
                  {/* (17 oct., revue) La carte URSSAF, juste en dessous sur le même écran,
                      écrit déjà « N ventes sans date de versement (X €) » avec le
                      geste : ici on y renvoie, sans redire les mêmes nombres (§7). */}
                  {couvertureCa.aDater && <div>Des ventes finalisées attendent leur date de versement (détail dans « URSSAF »).</div>}
                </div>
              )}
              <div style={{ marginTop: 10 }}><Pourquoi label="Ce que ce résultat compte">Le CA déclaré de l'année (toutes plateformes) moins tes charges. Il ne déduit pas le prix d'achat de tes articles : ton bénéfice brut et net, qui le déduit, est juste en dessous.</Pourquoi></div>
            </div>
          )}
        </div>
      </Card>

      <div id="compta-benefice" style={{ scrollMarginTop: 72 }}>
      <BeneficeCompta compta={data} onNav={onNav}
        onSansDepenses={() => repondreSansDepenses(data, maj)}
        onAjouterDepense={() => { setOuvert('dep'); setVersDepense((n) => n + 1); }} />
      </div>

      <div id="compta-urssaf" style={{ scrollMarginTop: 72 }}>
      <StatutFiscal liveStats={liveStats} onNav={onNav} />
      </div>

      {/* Trois repères de charges — une liste groupée, comme Réglages : le
          libellé à gauche, le montant à droite (les data-compta-kpi restent). */}
      <section id="compta-charges" className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0, scrollMarginTop: 72 }}>
        <h3 className="vrm-titre-compta" data-titre-section="" style={{ fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15, margin: '0 2px 8px' }}>Tes charges</h3>
        <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
          {[
            { k: 'abo', l: 'Abonnements ce mois', v: chargesDuMois.abo, s: abonnements.length ? `${abonnements.length} abonnement${abonnements.length > 1 ? 's' : ''}` : 'aucun déclaré' },
            { k: 'mois', l: 'Charges ce mois', v: chargesMois, s: 'abonnements + dépenses + packs' },
            { k: 'annee', l: `Total charges ${annee}`, v: chargesAnnee, s: 'depuis janvier' },
          ].map((x) => (
            <div key={x.k} className="vrm-set-ligne" data-compta-kpi={x.k} data-eur={String(Math.round(x.v * 100) / 100)}>
              <span className="vrm-set-lib"><b style={{ color: C.text }}>{x.l}</b><small style={{ color: C.muted }}>{x.s}</small></span>
              <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(x.v)}</span>
            </div>
          ))}
          {chargesAnnee > 0 && (
            <button type="button" className="vrm-set-ligne" onClick={exporterCharges}>
              <span className="vrm-set-lib"><b style={{ color: C.accent, fontWeight: 600 }}>Exporter mes charges {annee} (CSV)</b></span>
              <span className="vrm-set-chev" aria-hidden="true" style={{ color: C.muted }}><Icon name="save" size={16} /></span>
            </button>
          )}
        </div>
      </section>


      <div id="compta-ca" style={{ scrollMarginTop: 72 }}>
      <CaParPeriodeCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
      </div>

      <RecapComptableMensuel />

      <div className="vrm-compta-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'start' }}>
        {/* ABONNEMENTS RÉCURRENTS */}
        <Section data="abonnements" titre="Abonnements" note="Logiciels et services qui reviennent tout seuls : comptés à chaque échéance (une échéance compte dès le début de son mois), jamais dans ton CA."
          total={abonnements.length ? charges.aboTotal : null} totalSub={abonnements.length ? `en ${annee}` : null}>
          {abonnements.length === 0 && ouvert !== 'abo' ? vide('Ton abonnement VRM, Canva, une appli de retouche ? Ajoute-le une fois.') : null}
          {abonnements.length > 0 && listeBox(abonnements.map((a) => {
              const ech = echeancesAbonnement(a, moisCle);
              const cumul = ech.length * (Number(a.montant) || 0);
              const pasEncore = ymCompta(a.debut) > moisCle;
              const fini = a.fin && ymCompta(a.fin) < moisCle;
              return (
                  <Ligne key={a.id} attrs={{ 'data-abo': a.libelle, 'data-abo-cumul': String(Math.round(cumul * 100) / 100), 'data-abo-echeances': ech.length }}
                    gauche={<><b style={{ color: C.text }}>{a.libelle}</b>
                      <small style={{ color: C.muted }}>
                        {pasEncore ? `commence le ${dateFr(a.debut)}` : `depuis le ${dateFr(a.debut)}`}{a.fin ? ` · ${fini ? 'terminé' : 'jusqu’au'} ${dateFr(a.fin)}` : ''}
                        {!pasEncore && ` · ${ech.length} échéance${ech.length > 1 ? 's' : ''}, ${fmt(cumul)} en tout`}
                      </small></>}
                    droite={fmt(a.montant) + (a.periode === 'an' ? ' /an' : ' /mois')}
                    extra={!a.fin && !pasEncore ? <button type="button" onClick={() => terminerAbonnement(a.id)} title="Il s'arrête ce mois-ci (le mois en cours reste compté)" style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, borderRadius: 6, fontSize: 13, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Arrêter</button> : null}
                    onDel={() => retirer('abonnements', a.id)} />
              );
            }))}
          <ComptaAjout ouvert={ouvert === 'abo'} onClick={() => basculer('abo')} libelle="Ajouter un abonnement" data={{ 'data-abo-ouvrir': '' }} />
          {ouvert === 'abo' && <div style={formBox} data-abo-form>
          <div style={{ fontSize: 13, color: C.muted }}>Les plus courants</div>
          <div role="group" aria-label="Abonnements courants" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ABONNEMENTS_COURANTS.map((x) => <button key={x.nom} type="button" data-abo-courant={x.nom} aria-pressed={aLib === x.nom}
              onClick={() => { setALib(x.nom); if (x.prix) setAMnt(x.prix()); setAPer('mois'); setAErr(''); }} style={pastille(aLib === x.nom)}>{x.nom}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ ...lab, flex: '2 1 170px' }}>Nom
              <input type="text" placeholder="ex. Canva" data-abo-libelle value={aLib} onChange={e => { setALib(e.target.value); setAErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterAbonnement(); }} style={{ ...inp, width: '100%' }} />
            </label>
            <label style={{ ...lab, flex: '0 1 110px' }}>Prix
              <input type="text" inputMode="decimal" placeholder="0,00 €" data-abo-montant value={aMnt} onChange={e => { setAMnt(e.target.value); setAErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterAbonnement(); }} style={{ ...inp, width: '100%' }} />
            </label>
            <label style={{ ...lab, flex: '1 1 140px' }}>Revient
              <select value={aPer} onChange={e => setAPer(e.target.value)} data-abo-periode style={{ ...inp, width: '100%' }}><option value="mois">tous les mois</option><option value="an">tous les ans</option></select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={lab}>Depuis le
              <input type="date" value={aDeb} onChange={e => { setADeb(e.target.value); setAErr(''); }} data-abo-debut style={{ ...inp, width: '100%' }} />
            </label>
            <label style={lab}>Jusqu'au <span style={{ fontSize: 11 }}>(vide s'il continue)</span>
              <input type="date" value={aFin} onChange={e => { setAFin(e.target.value); setAErr(''); }} data-abo-fin style={{ ...inp, width: '100%' }} />
            </label>
            <button type="button" onClick={ajouterAbonnement} data-abo-ajouter style={btnAdd}>Ajouter</button>
          </div>
          {aErr && <div data-abo-erreur style={{ fontSize: 13, color: C.warn }}>{aErr}</div>}
          </div>}
        </Section>

        {/* DÉPENSES PONCTUELLES */}
        <Section data="depenses" titre="Dépenses" note="Emballage, fournitures, frais… tout ce que tu paies pour ton activité." total={depenses.length ? somme(depenses.filter(d => cetteAnnee(d.date)), x => x.montant) : null} totalSub={depenses.length ? `en ${annee}` : null}>
          {depenses.length === 0 && ouvert !== 'dep'
            ? vide('Note ta première dépense — ça prend cinq secondes, et ça allège ton résultat.')
            : listeBox(depenses.map((d) => <Ligne key={d.id} gauche={<><b style={{ color: C.text }}>{d.libelle}</b><small style={{ color: C.muted }}>{d.cat} · {dateFr(d.date)}</small></>} droite={fmt(d.montant)} onDel={() => retirer('depenses', d.id)} />))}
          <ComptaAjout ouvert={ouvert === 'dep'} onClick={() => basculer('dep')} libelle="Ajouter une dépense" data={{ 'data-dep-ouvrir': '' }} />
          {ouvert === 'dep' && <div style={formBox} data-dep-form>
            <div style={{ fontSize: 13, color: C.muted }}>C'est pour quoi ?</div>
            <div role="radiogroup" aria-label="Catégorie" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPENSE_CATS.map((c) => <button key={c.k} type="button" role="radio" aria-checked={dCat === c.k} data-dep-cat={c.k} onClick={() => { setDCat(c.k); setDErr(''); }} style={pastille(dCat === c.k)}>{c.k}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ ...lab, flex: '2 1 180px' }}>Ce que tu as payé
                <input type="text" placeholder={`ex. ${(DEPENSE_CATS.find((c) => c.k === dCat) || DEPENSE_CATS[DEPENSE_CATS.length - 1]).ex}`} data-dep-libelle value={dLib} onChange={e => { setDLib(e.target.value); setDErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
              </label>
              <label style={{ ...lab, flex: '0 1 110px' }}>Montant
                <input type="text" inputMode="decimal" placeholder="0,00 €" data-dep-montant value={dMnt} onChange={e => { setDMnt(e.target.value); setDErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={lab}>Payé le
                <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} data-dep-date style={{ ...inp, width: '100%' }} />
              </label>
              <button type="button" onClick={ajouterDepense} data-dep-ajouter style={btnAdd}>Ajouter</button>
            </div>
            {dErr && <div data-dep-erreur style={{ fontSize: 13, color: C.warn }}>{dErr}</div>}
          </div>}
        </Section>

        {/* PACKS ET OPTIONS PAYÉS (Leboncoin, eBay…) — § « packs de photos pris
            en compte du bénéfice ». ⚠️ Mesuré le 16 octobre : AUCUNE plateforme ne
            transmet à VRM ce que tu lui paies (ni pack, ni option, ni boost
            Leboncoin : aucune ligne captée). Un montant deviné serait un faux :
            seul ce qui est saisi ici compte. Les boosts Vinted, eux, se notent
            par annonce (champ « boost ») et sortent de la marge dans Statistiques. */}
        <Section data="packs" titre="Packs & options (facultatif)" note={<>Rien d'obligatoire : si tu as payé un pack de photos ou une option, note son prix ici pour qu'il soit déduit de ton résultat. Leboncoin et eBay ne transmettent pas à VRM ce que tu leur paies. Les boosts Vinted se notent par annonce et sortent de ta marge dans {lienBtn('Statistiques', 'dashboard')}.</>} total={packs.length ? somme(packs.filter(p => cetteAnnee(p.date)), x => x.montant) : null} totalSub={packs.length ? `en ${annee}` : null}>
          {packLbc && <div className="vrm-set-ligne" data-pack-lbc={packLbc.actif ? 'actif' : 'aucun'}>
            <span className="vrm-set-lib"><b style={{ color: C.text }}>Pack photo Leboncoin : {packLbc.actif ? 'pris' : 'aucun'}</b>
              <small style={{ color: C.muted }}>Détecté par l'extension{packLbc.at && !isNaN(Date.parse(packLbc.at)) ? ` le ${new Date(packLbc.at).toLocaleDateString('fr-FR')}` : ''}{packLbc.actif ? ' — son prix n’est pas transmis : ajoute-le ci-dessous si tu veux le déduire.' : ''}</small></span>
          </div>}
          {packs.length === 0 && ouvert !== 'pack'
            ? (packLbc ? null : vide('Tu as acheté un pack de photos ou une option ? Tu peux le noter ici — ce n’est pas obligatoire.'))
            : listeBox(packs.map((p) => <Ligne key={p.id} gauche={<><b style={{ color: C.text }}>{p.plateforme}</b><small style={{ color: C.muted }}>{p.compte ? `${p.compte} · ` : ''}{dateFr(p.date)}</small></>} droite={fmt(p.montant)} onDel={() => retirer('packs', p.id)} />))}
          <ComptaAjout ouvert={ouvert === 'pack'} onClick={() => basculer('pack')} libelle="Ajouter un pack ou une option" data={{ 'data-pack-ouvrir': '' }} />
          {ouvert === 'pack' && <div style={formBox}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={pPlat} onChange={e => setPPlat(e.target.value)} aria-label="Plateforme" style={{ ...inp, flex: '1 1 130px' }}>{['Leboncoin', 'eBay', 'Vinted', 'Vestiaire', 'Autre'].map(p => <option key={p} value={p}>{p}</option>)}</select>
              <input type="text" placeholder="Compte (facultatif)" aria-label="Compte" value={pCpt} onChange={e => setPCpt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouterPack(); }} style={{ ...inp, flex: '1 1 150px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} aria-label="Date" style={{ ...inp, flex: '1 1 150px' }} />
              <input type="text" inputMode="decimal" placeholder="€" aria-label="Montant" value={pMnt} onChange={e => setPMnt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouterPack(); }} style={{ ...inp, width: 96 }} />
              <button type="button" onClick={ajouterPack} style={btnAdd}>Ajouter</button>
            </div>
          </div>}
        </Section>

        {/* Les anciens COÛTS FIXES (sans date de début) : gardés tant qu'il en
            reste, comptés comme avant ; on n'en ajoute plus — un abonnement daté
            les remplace (rien n'est perdu, §4.11). */}
        {fixes.length > 0 && (
          <Section data="fixes" titre="Coûts fixes (sans date)" note={`Comptés au tarif actuel × ${moisEcoules} mois depuis janvier. Pour un compte exact, recrée-les en abonnement avec leur date de début.`} total={fixesParMois} totalSub="par mois">
            {listeBox(fixes.map((f) => <Ligne key={f.id} gauche={<b style={{ color: C.text }}>{f.libelle}</b>} droite={fmt(f.montant) + ' /mois'} onDel={() => retirer('fixes', f.id)} />))}
          </Section>
        )}

        <ProfilFiscalCarte onNav={onNav} />
      </div>

      {/* FACTURES — reçues (reçus Vinted par email) + le reste vit dans Factures */}
      <section id="compta-factures" className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0, scrollMarginTop: 72 }}>
        <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
          <button type="button" className="vrm-set-ligne" onClick={() => onNav && onNav('invoices')}>
            <IconeReglage name="receipt" />
            <span className="vrm-set-lib"><b style={{ color: C.text }}>Factures{nFactures != null && nFactures > 0 ? ` — ${nFactures} reçue${nFactures > 1 ? 's' : ''}` : ''}</b><small style={{ color: C.muted }}>Tes reçus Vinted arrivés par email, et tes factures à émettre pour tes clients.</small></span>
            <span className="vrm-set-chev" aria-hidden="true" style={{ color: C.muted, fontSize: 20 }}>›</span>
          </button>
        </div>
      </section>

      {/* FACTURATION ÉLECTRONIQUE — Factur-X par vente + récap e-reporting du mois. */}
      <FacturationElectroniqueCarte data={data} maj={maj} lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
    </div>
  );
}

export default ComptaPro;
