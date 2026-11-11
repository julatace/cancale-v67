// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { CLE_FOURNISSEURS, lireRegistre } from '../fournisseurs.js';
import { CLE_HORS_MASQUES, horsVisibles } from '../achatsDoubles.js';
import { periodeADater } from '../aDaterAnnee.js';
import { DEMANDE_COMMANDE } from '../annulerCommandes.js';
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { montant } from '../format.js';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { L, VERBES, PAS_SU } from '../libelles.js';
import { dateVenteVc } from '../../api/_lib/vestiaire-regle.js';
import { compteDeVente, exclusNormes } from '../../api/_lib/comptes-exclus.js';
import { nomCompteLie } from '../comptesLies.js';
import { avecVentesEmail } from '../venteEmailFraiche.js';
import { indexRecusParTransaction } from '../../api/_lib/recu-achat.js';
import { prendreDemande } from '../rechercheEcran.js';
import { recuPublieEntre } from '../design/carteChiffres.js';
import { NOM_BENEFICE, NOM_BENEFICE_BRUT, chiffreBenefice, chiffreBrut } from '../beneficeNoms.js';
import { livreDesRecettes, registreDesAchats, csvRegistre, pdfRegistre, nomFichierRegistre } from '../registres.js';
import LivrePoliceCarte from '../LivrePoliceCarte.jsx';   // (10 nov., lot R) le livre de police
import { lireFactures } from '../factureAchat.js';   // (10 nov., lot AN) les factures d'achat jointes, mentionnées dans l'export
import { TYPES_PERIODE, periodesExport, libellePeriode, donneesExportComptable, resumeExport, couvertureExport, csvExportComptable, pdfExportComptable, nomFichierExport } from '../exportComptable.js';
import { Badge, Bouton, Btn, C, COMPTA_DEFAUT, Card, CarteStatsApp, ChoixDepenses, DATE_LBC_OK, DEMANDE_DEPENSE, DEMANDE_SAISIE_PRIX, DEPS_FACTURE, ENTREPRISE_VIDE, EXT_CAPACITES, FermeAuRetour, Icon, IconeReglage, MOIS_COMPTA, PRIX_CGV_LISIBLE, Pourquoi, RAISON_NON_COMPTEE, REGIMES_FISCAUX, REGLAGE_PAS_LU, SB_CONFLICT, SERIE_DECLARATION, SUPABASE_URL, ScreenHead, Segmente, SheetShell, TAUX_URSSAF_DEFAUT, VENTES_MASQUEES_AUCUNE, _startOfDay, aLaDemande, aPayerUrssaf, askConfirm, avecDatesLbc, beneficeDesJours, beneficeDuMoisPub, bilanLignes, buildFacturXBytes, chargeAbonnement, chercherEntreprise, cleNum, compressImage, comptaChargesAnnee, comptaChargesMois, compteEcarte, compteEcarteChoix, couvertureBenefice, dateLocaleISO, debutPeriode, decalerPeriode, demanderDeclaration, echeancesAbonnement, ecouterFenetreCsp, enTeteSession, entForInvoice, extSait, fetchEmailAchats, fetchProInvoices, fetchVersementsVinted, fmt, fmtDate, isCloudReady, lbcAnnulee, lbcFinalisee, libellePeriodeCa, libelleRegime, libelleSourceAchat, lireAchatsLies, lireBaseRelue, lireBeneficeJours, lireComptaSynchro, lireDatesLbc, lireDeclarations, lireMontantSaisi, lireReglage, lireReleveVentes, lireTout, load, logoFacture, moisDeclare, moisPeriodeUrssaf, montantPeriodeUrssaf, netApresUrssafDe, nextUrssafDeadline, onCloudReady, payeDe, pctFr, phraseNonComptees, prixAchatHorsNombre, recuAvecADater, recusAchatDe, regimeFiscal, repondreSansDepenses, save, sbAuth, tauxUrssaf, telechargerFichier, toast, tod, tsCommande, uid, uidsLies, useBeneficeCalcul, useComptesAutresSites, useComptesExclus, useExcluAutre, useLigneSynchro, useLigneUrssaf, useRegimeFiscal, useStateCle, useVentesCoque, useVentesEmailFraiches, useVentesVestiaire, ventesDeclarables, ventesFaites, ventilationRecuAchat, withOwner, xmlEsc, ymCompta, ymCourant, ymDeTs } from '../App.jsx';

// ⟦← App.jsx #1⟧
import {jaugeSeuils,optionsMicro,calendrierUrssaf,phraseRythme,seuilsDe,declarationRevenus,rappelCfe} from '../microEntreprise.js';
import { moisAtteinte, dac7ParPlateforme } from '../seuilsAnnee.js';
import { previsionUrssaf } from '../previsionUrssaf.js';
// (9 nov.) Le profil fiscal (src/profilFiscal.js) : le statut, l'activité du micro, la TVA d'une société.
import { useProfilFiscal } from '../App.jsx';
import { gesteCorbeille } from '../App.jsx';   // (10 nov., lot Y) la corbeille 30 jours
import { LiveStatsCarte, REGLES_CARTE, useSourcesCarte } from '../App.jsx';
import { valeurChiffre, raisonCourte } from '../design/carteChiffres.js';
import { questionsArgent } from '../argent.js';
import { tauxMicro, detailTaux, AIDE_NEUTRE, SOURCES_OFFICIELLES, TAUX_ACTIVITE } from '../profilFiscal.js';
// (10 nov., lot T) La jauge et l'alerte du seuil de TVA, à côté des factures (src/seuilTvaFacture.js).
const SeuilTvaFactures = aLaDemande(() => import('../SeuilTvaFactures.jsx'));
// ⟦← App.jsx #2⟧
import PorteMonnaie from "../PorteMonnaie.jsx";
// (6 nov., vitesse 2) Dac7Comptes : à la demande.
import { dac7ParCompte, indexComptesVentes, emailsFiscaux, blocagesFiscauxVinted, csvDac7, pdfDac7, nomFichierDac7 } from "../dac7Comptes.js";
import { porteMonnaieParCompte } from "../porteMonnaie.js";
// ⟦← App.jsx #5⟧
import { etatFacturation, factureDepuisVente, pdfFacturX, nomFichierFacture, recapEReporting, recapCsv, recapJson, eurDe, frJour } from "../facturationElectronique.js";
import { lireSuperPdp, appelSuperPdp, enBase64, libelleEnvoi, ENV_LIBELLE } from "../superpdp.js";
// ⟦← App.jsx #6⟧
import { CHIFFRES as CHIFFRES_CARTE } from "../design/carteChiffres.js";
// ⟦← App.jsx #7⟧
import { donneesRecapMois, csvRecapMois, pdfRecapMois, libelleMois, nomFichierRecap } from "../recapMois.js";
import { bilanDuMois, meilleurCompte, pdfBilanMois, nomFichierBilan, texteBilan } from "../bilanMois.js";
import { delaisPaiement, texteDelai } from "../delaiPaiement.js";
// ⟦← App.jsx #8⟧
import { CATEGORIES_DEPENSE, idTicket, montantDuTicket, texteMontantSaisie, texteDuTicket } from "../depensesTicket.js";

// ⟦← App.jsx #3⟧
const Dac7Comptes = aLaDemande(() => import('../Dac7Comptes.jsx'));
import MoisBoucle, { portesMoisBoucle } from '../MoisBoucle.jsx';   // (10 nov., lot BK)
// ⟦← App.jsx #4⟧
const FicheFacturation = aLaDemande(() => import('../FacturePro.jsx').then((m) => ({ default: m.FicheFacturation })));
const ListeFacturesPro = aLaDemande(() => import('../FacturePro.jsx').then((m) => ({ default: m.ListeFacturesPro })));
const FacturesAEnvoyer = aLaDemande(() => import('../FacturePro.jsx').then((m) => ({ default: m.FacturesAEnvoyer })));
// ⟦← App.jsx #9⟧
// Le taux est un RÉGLAGE, pas une constante : il dépend de l'activité et de
// l'option pour le versement libératoire, et lui seul connaît le sien.
// (27 oct., Julien : « tu dois te baser sur de vrais taux ».) Le défaut n'est
// plus 13,5 % (aucune source) mais le taux de l'ACHAT-REVENTE en micro-entreprise
// (BIC, vente de marchandises) : 12,3 % de cotisations sociales + 0,1 % de
// contribution à la formation (commerçant) = 12,4 %. Le versement libératoire
// ajoute 1 % (13,4 %) ; l'ACRE divise les cotisations par deux la première
// année (6,2 % + 0,1 %). `tauxMicroVente` les compose (`TAUX_MICRO`).
// (2 nov., audit P5 — décret n° 2026-69 du 6 février 2026) L'ACRE dépend de la DATE
// DE DÉBUT d'activité : avant le 1er juillet 2026, 50 % des cotisations (6,2 %) ;
// à partir du 1er juillet 2026, 75 % (12,3 × 0,75 = 9,225 %). `acre` : false · true
// ou 'avant' (l'ancienne réponse « Oui ») · 'apres'.
// (9 nov.) `tauxMicroVente` est gardée (audit-plateformes-2nov l'exécute) : elle vaut
// `tauxMicro({ activite: 'vente' })` de src/profilFiscal.js, qui compose aussi les
// PRESTATIONS (audit-configuration-depart compare les deux).
const TAUX_MICRO = { cotisations: 12.3, acre: 6.2, acre2026: 9.225, formation: 0.1, liberatoire: 1 };
const tauxMicroVente = ({ liberatoire = false, acre = false } = {}) =>
  Math.round(((acre === 'apres' ? TAUX_MICRO.acre2026 : acre ? TAUX_MICRO.acre : TAUX_MICRO.cotisations) + TAUX_MICRO.formation + (liberatoire ? TAUX_MICRO.liberatoire : 0)) * 10) / 10;
// ⟦← App.jsx #10⟧
// ── LE SUIVI DE SES DÉCLARATIONS URSSAF (29 octobre) ─────────────────────
// Julien : « pour l'URSSAF fait un vrai suivi ». Une ligne par période (mois ou
// trimestre, SON rythme), des 12 derniers mois : son échéance, son état
// (déclarée · à déclarer · en retard · en cours), ce qu'il a DÉCLARÉ (le CA et
// le montant notés par « J'ai déclaré ce mois », `vrm_urssaf_declare`) à côté de
// ce que VRM compte AUJOURD'HUI (la ligne publiée, `montantPeriodeUrssaf` — la
// règle du rappel et de la carte, §11). L'écart se DIT, jamais corrigé : une
// déclaration faite est faite (un compte retiré, une vente annulée font baisser
// le chiffre de VRM ; une vente arrivée après la déclaration le fait monter).
// Registre pas lu ⇒ `null` (« pas su », aucune ligne dite « en retard »).
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
// (29 oct., suite « parfait ») Ce que porte une période notée :
//   `ca`      = le CA que VRM comptait quand il l'a notée ;
//   `montant` = le CA tel qu'il l'a TAPÉ depuis son espace URSSAF (facultatif) —
//               c'est LUI le chiffre déclaré quand il est là ;
//   `paye`    = les cotisations qu'il a PAYÉES (facultatif, ajouté le 29 oct.).
// ⚠️ `montant` n'est PAS un paiement (le formulaire du rapport le dit : « montant
// de ta déclaration ») — la première version du suivi l'affichait « payé ».
const caDeclareDe = (d) => (d && d.montant != null && isFinite(Number(d.montant))) ? Number(d.montant) : (Number(d && d.ca) || 0);
// ⟦← App.jsx #11⟧
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
  // (29 oct., revue 3) `periodes` compte les PÉRIODES déclarées (un trimestre =
  // trois mois) : une seule ⇒ l'en-tête ne redit pas le détail de sa ligne.
  let caAnnee = 0, payeAnnee = 0, payesConnus = true, nAnnee = 0;
  const periodesAnnee = new Set();
  for (const [ym, d] of Object.entries(declare)) {
    if (!d || !Array.isArray(d.ids) || ym.slice(0, 4) !== annee) continue;
    nAnnee++; caAnnee += caDeclareDe(d);
    periodesAnnee.add(freq === 'mensuel' ? ym : `${ym.slice(0, 4)}-T${Math.floor((Number(ym.slice(5, 7)) - 1) / 3)}`);
    const x = payeDe(d); if (x != null) payeAnnee += x; else payesConnus = false;
  }
  const rev = lignes.reverse();
  return {
    lignes: rev,
    annee: { annee, n: nAnnee, periodes: periodesAnnee.size, ca: r2(caAnnee), paye: nAnnee && payesConnus ? r2(payeAnnee) : null, estime: nAnnee ? aPayerUrssaf(caAnnee, taux) : null },
    enRetard: rev.filter((l) => l.etat === 'en_retard').length,
    // La prochaine échéance à faire (la plus proche, pas notée, période finie).
    prochaine: rev.filter((l) => l.etat === 'a_declarer').sort((a, b) => a.joursRestants - b.joursRestants)[0] || null,
    aRegulariser: r2(rev.reduce((t, l) => t + (l.ecart > 0 ? l.ecart : 0), 0)),
    aCompleter: rev.reduce((t, l) => t + l.aCompleter.length, 0),
  };
};
// ⟦← App.jsx #12⟧
const completerDeclaration = (ym, { montant, paye } = {}) => {
  if (!isCloudReady()) return false;
  const reg = lireDeclarations();
  const d = reg[ym];
  if (!d || !Array.isArray(d.ids)) return false;
  const u = { ...reg, [ym]: { ...d, montant: montant === undefined ? d.montant : montant, paye: paye === undefined ? (d.paye ?? null) : paye, corrigeLe: Date.now() } };
  save('vrm_urssaf_declare', u);
  return true;
};
// Le suivi en CSV (pour un comptable) — une ligne par période, des faits.
const suiviUrssafCsv = (suivi) => {
  const ETAT = { declaree: 'déclarée', a_declarer: 'à déclarer', en_retard: 'pas notée (échéance passée)', en_cours: 'en cours' };
  const n = (x) => x == null ? '' : Number(x).toFixed(2).replace('.', ',');
  const d = (x) => x ? new Date(x).toLocaleDateString('fr-FR') : '';
  const L = [['Période', 'Échéance', 'État', 'Notée le', 'Règle', 'CA déclaré', 'CA tapé depuis l\'URSSAF', 'Cotisations payées', 'Cotisations estimées', 'CA compté par VRM aujourd\'hui', 'Chiffre VRM partiel', 'Écart (VRM − déclaré)']];
  for (const l of suivi.lignes) L.push([l.label, d(l.dueDate), ETAT[l.etat], d(l.at), l.regle === 'vente' ? 'date de vente' : l.regle ? 'date de versement' : '', n(l.caDecl), l.caDecl == null ? '' : (l.caTape ? 'oui' : 'non'), n(l.paye), n(l.etat === 'declaree' ? l.aPayerDecl : l.aPayerCalc), n(l.caCalc), l.partiel ? 'oui (au moins)' : '', n(l.ecart)]);
  return L.map((r) => r.map((c) => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(';')).join('\n');
};
// ⟦← App.jsx #13⟧
const fmtN = n => isNaN(+n)?'—':Number(n).toFixed(2).replace('.',',');
// ⟦← App.jsx #14⟧

/* ── Editable cell ───────────────────────────────────── */
function Cell({value, onChange, align="left", mono=false}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const commit = () => { setEditing(false); if(String(val)!==String(value)) onChange(val); };
  if(editing) return (
    <input autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}}
      style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:12,
        color:C.text,padding:'3px 6px',fontSize:12,fontFamily:'inherit',
        width:'100%',boxSizing:'border-box',textAlign:align,outline:'none'}}
    />
  );
  return (
    <span onClick={()=>{setVal(value);setEditing(true);}} title="Cliquer pour modifier"
      style={{cursor:'text',display:'block',padding:'3px 6px',borderRadius:12,minHeight:22,
        textAlign:align,fontFamily:mono?'monospace':'inherit'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >{value||<span style={{color:C.muted,fontSize:11}}>—</span>}</span>
  );
}
// ⟦← App.jsx #15⟧
function Input({label,...p}) {
  return (
    <label className="vrm-field" style={{display:'flex',flexDirection:'column',gap:4}}>
      {label&&<span style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>{label}</span>}
      <input {...p} className={['vrm-input',p.className].filter(Boolean).join(' ')} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
        color:C.text,padding:'8px 12px',fontSize:13,fontFamily:'inherit',...(p.style||{})}}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.border}
      />
    </label>
  );
}
// ⟦← App.jsx #16⟧
// (3 nov.) Le TICKET d'une dépense : SA ligne (`depense_ticket_{id}`), jamais
// `main`. true seulement si la base l'a acceptée ; lu à la demande (un toucher).
const ecrireTicket = async (id, b64) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
      method: 'POST',
      headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([withOwner({ id: idTicket(id), data: b64 ? { b64, at: new Date().toISOString() } : { b64: null, supprime: true, at: new Date().toISOString() } })]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
};
const lireTicket = async (id) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${idTicket(id)}&select=b:data->>b64`, { headers: sbAuth() });
    if (!r.ok) return null;
    const j = await r.json();
    const b = Array.isArray(j) && j[0] ? j[0].b : null;
    return typeof b === 'string' && b.startsWith('data:image/') ? b : null;
  } catch (_) { return null; }
};
// ⟦← App.jsx #17⟧
const demanderSerieDeclaration = (liste, onNav) => {
  const l = [...new Set((liste || []).filter((ym) => /^\d{4}-\d{2}$/.test(String(ym || ''))))].sort();
  if (!l.length) return;
  SERIE_DECLARATION.liste = l; SERIE_DECLARATION.total = l.length; SERIE_DECLARATION.at = Date.now();
  demanderDeclaration(l[0], onNav);
};
// ⟦← App.jsx #18⟧
// La même phrase, depuis le compte PUBLIÉ (`vinted_urssaf_mois.nonComptees.par`
// = { 'Vestiaire|montant pas sûr': 2, … }) : la carte URSSAF la lit.
function phraseNonCompteesPar(par) {
  return Object.entries(par || {}).filter(([, n]) => n > 0).map(([k, n]) => { const [pl, r] = k.split('|'); return `${n} vente${n > 1 ? 's' : ''} ${pl} (${RAISON_NON_COMPTEE[r] || r})`; }).join(' · ');
}
// ⟦← App.jsx #19⟧

/* ── Catalogue ───────────────────────────────────────── */
function Catalog({catalog,setCatalog,onDeleteId}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [newRow,setNewRow]=useState({id:'',buyPrice:''});
  const [lastAddedId,setLastAddedId]=useState(null); // dernier n° ajouté
  const priceInputRef=React.useRef(null);
  const [page,setPage]=useState(null); // null = dernière page
  const [showAll,setShowAll]=useState(false);
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};

  const update=(id,field,val)=>{
    const u=catalog.map(p=>p.id===id?{...p,[field]:field==='buyPrice'?+val:val}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const remove=async (id)=>{
    if(!await askConfirm(`Supprimer #${id} ?`)) return;
    const u=catalog.filter(p=>p.id!==id);
    setCatalog(u); save('vinted_catalog',u);
    if(onDeleteId) onDeleteId(id);
  };
  const toggleStatus=(id)=>{
    const u=catalog.map(p=>p.id===id?{...p,status:p.status==='stock'?'vendu':'stock'}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const addRow=()=>{
    const id=newRow.id.trim();
    if(!id||!newRow.buyPrice) return;
    if(catalog.find(p=>p.id===id)){toast('Numéro déjà existant !');return;}
    const u=[...catalog,{id,buyPrice:+newRow.buyPrice,status:'stock',addedAt:tod()}];
    setCatalog(u); save('vinted_catalog',u);
    setLastAddedId(id);
    // Pré-remplit automatiquement le numéro suivant (ex: après 50 → 51 prêt pour le prix)
    let nextId='';
    if(/^\d+$/.test(id)) nextId=String(parseInt(id,10)+1);
    setNewRow({id:nextId,buyPrice:''});
    setPage(null); // reste sur la dernière page (où se trouve la ligne d'ajout)
    // Place le curseur sur le champ prix pour enchaîner directement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  // Bouton +1 : pré-remplit le champ N° avec (dernier n° ajouté + 1).
  // Si rien n'a encore été ajouté dans cette session, part du plus grand n° du catalogue.
  const fillNextId=()=>{
    let base;
    if(lastAddedId!==null && /^\d+$/.test(lastAddedId)){
      base=parseInt(lastAddedId,10);
    } else {
      const nums=catalog.map(p=>parseInt(p.id,10)).filter(n=>!isNaN(n));
      base=nums.length?Math.max(...nums):0;
    }
    setNewRow(r=>({...r,id:String(base+1)}));
    // Place le curseur sur le champ prix pour enchaîner rapidement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  const fullList=useMemo(()=>catalog
    .filter(p=>p.id.toString().includes(search.trim())&&(filter==='all'||p.status===filter))
    .sort((a,b)=>+a.id-+b.id),[catalog,search,filter]);
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const oldStockCount=useMemo(()=>{
    const now=new Date();
    return catalog.filter(p=>{
      if(p.status!=='stock') return false;
      const parts=(p.addedAt||'').split('/');
      if(parts.length!==3) return false;
      const d=new Date(+parts[2],+parts[1]-1,+parts[0]);
      return (now-d)/86400000>30;
    }).length;
  },[catalog]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <ScreenHead icon="box" title={`Catalogue (${catalog.length})`}
        desc="Les articles de l'ancienne application. Ils comptent toujours dans les statistiques."
        right={<Btn small onClick={()=>{
          if(fullList.length===0){toast('Aucun article à exporter');return;}
          const headers=['N° Article','Prix Achat (€)','Statut','Date ajout'];
          const rows=fullList.map(p=>[p.id||'',String(p.buyPrice||'').replace('.',','),p.status||'',p.addedAt||'']);
          const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download=`catalogue-${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }} color={C.blue} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="save" size={13}/>Exporter Excel</Btn>}/>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:200}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="Numéro... puis Entrée"
            style={{flex:1,minWidth:120}}/>
          <Btn small onClick={triggerSearch} color={C.accent} disabled={!searchInput.trim()&&!search} title={!searchInput.trim()&&!search?'Tape d’abord un N° ou une date':undefined}>Chercher</Btn>
          {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
        {['all','stock','vendu'].map(f=>(
          <Btn key={f} small onClick={()=>setFilter(f)} aria-pressed={filter===f} color={C.border} style={{color:filter===f?C.text:C.muted,fontWeight:filter===f?700:500,boxShadow:filter===f?`inset 0 0 0 2px ${C.accent}`:'none'}}>
            {f==='all'?'Tous':f==='stock'?'Stock':'Vendus'}
          </Btn>
        ))}
      </div>
      {oldStockCount>0&&(
        <div style={{background:`${C.warn}22`,border:`1px solid ${C.warn}66`,borderRadius:12,padding:'8px 14px',fontSize:12,color:C.warn,fontWeight:500}}>
          ⚠️ {oldStockCount} article{oldStockCount>1?'s':''} en stock depuis + de 30 jours
        </div>
      )}
      <Card style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{background:C.surface}}><tr>
            {['N°','Prix achat','Statut','Ajouté',''].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'10px 12px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:C.muted}}>Aucun article</td></tr>}
            {list.map(p=>(
              <tr key={p.id} style={{borderTop:`1px solid ${C.border}`,background:(()=>{if(p.status==='vendu') return '#ff4d6d08';const parts=(p.addedAt||'').split('/');if(parts.length===3){const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>60) return `${C.danger}18`;if(days>30) return `${C.warn}18`;}return 'transparent';})()}}>
                <td style={{padding:'2px 12px',fontWeight:600,color:C.accentTexte,fontSize:15,minWidth:60}}>
                  <Cell value={p.id} onChange={v=>update(p.id,'id',v)} mono/>
                </td>
                <td style={{padding:'2px 12px',minWidth:80}}>
                  <Cell value={String(p.buyPrice)} onChange={v=>update(p.id,'buyPrice',v)} align="right"/>
                </td>
                <td style={{padding:'2px 12px'}}>
                  <span onClick={()=>toggleStatus(p.id)} style={{cursor:'pointer'}}>
                    <Badge color={p.status==='stock'?C.accent:C.danger}>{p.status==='stock'?'Stock':'Vendu'}</Badge>
                  </span>
                </td>
                <td style={{padding:'2px 12px',color:C.muted,fontSize:11,minWidth:80}}>
                  <Cell value={p.addedAt||'—'} onChange={v=>update(p.id,'addedAt',v)}/>
                  {p.status==='stock'&&(()=>{const parts=(p.addedAt||'').split('/');if(parts.length!==3) return null;const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>30) return <span style={{fontSize:11,color:days>60?C.danger:C.warn,fontWeight:500,marginLeft:3}}>{days}j</span>;return null;})()}
                </td>
                <td style={{padding:'2px 12px'}}>
                  <Btn small danger onClick={()=>remove(p.id)}>✕</Btn>
                </td>
              </tr>
            ))}
            {/* Ligne d'ajout en bas (dernière page uniquement) */}
            {(showAll||currentPage===totalPages-1)&&<tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
              <td style={{padding:'6px 8px'}}>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input value={newRow.id} onChange={e=>setNewRow(n=>({...n,id:e.target.value}))}
                    placeholder="N°" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:60,fontFamily:'monospace',outline:'none'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  <button type="button" onClick={fillNextId} title="Numéro suivant (dernier ajouté +1)"
                    style={{background:`${C.accent}22`,border:`1px solid ${C.accent}66`,borderRadius:6,color:C.accentTexte,padding:'4px 6px',fontSize:15,fontWeight:600,cursor:'pointer',lineHeight:1}}>
                    +1
                  </button>
                </div>
              </td>
              <td style={{padding:'6px 8px'}}>
                <input ref={priceInputRef} value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                  type="number" placeholder="Prix achat&nbsp;€" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                  style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:100,outline:'none',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                />
              </td>
              <td colSpan={2} style={{padding:'6px 8px',color:C.muted,fontSize:11}}>← Entrée ou bouton pour ajouter</td>
              <td style={{padding:'6px 8px'}}>
                <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
              </td>
            </tr>}
          </tbody>
        </table>
      </Card>
      {/* Pagination Catalogue */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.border} style={{marginLeft:8}}>Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} articles</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
    </div>
  );
}

/* ── Ventes ──────────────────────────────────────────── */
function Sales({catalog,setCatalog,sales,setSales,invoices,invoiceSettings,entreprises,activeEnt}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [newRow,setNewRow]=useState({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  const [err,setErr]=useState('');
  const [page,setPage]=useState(null); // null = dernière page (init)
  const [showAll,setShowAll]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [isDragging,setIsDragging]=useState(false);
  const dragModeRef=React.useRef('add');
  const selectedIdsRef=React.useRef(new Set());
  selectedIdsRef.current=selectedIds;
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Drag global avec écoute des événements window
  useEffect(()=>{
    if(!selectMode) return;
    
    const onMove=(e)=>{
      if(!isDragging) return;
      const t=e.touches?e.touches[0]:e;
      if(!t) return;
      const el=document.elementFromPoint(t.clientX,t.clientY);
      if(!el) return;
      const tr=el.closest('tr[data-vid]');
      if(!tr) return;
      const vid=tr.getAttribute('data-vid');
      if(!vid) return;
      const ns=new Set(selectedIdsRef.current);
      if(dragModeRef.current==='add') ns.add(vid); else ns.delete(vid);
      // Si pas de changement, on ne re-render pas
      if(ns.size===selectedIdsRef.current.size&&dragModeRef.current==='add'?selectedIdsRef.current.has(vid):!selectedIdsRef.current.has(vid)) return;
      setSelectedIds(ns);
    };
    
    const onUp=()=>setIsDragging(false);
    
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:true});
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchend',onUp);
    return ()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchend',onUp);
    };
  },[selectMode,isDragging]);
  


  const updateSale=(id,field,val)=>{
    const u=sales.map(s=>{
      if(s.id!==id) return s;
      const ns={...s,[field]:val};
      const sell=+(field==='sellPrice'?val:ns.sellPrice);
      const buy=+(field==='buyPrice'?val:ns.buyPrice);
      ns.profit=+(sell-buy).toFixed(2);
      ns.multi=buy>0?+(sell/buy).toFixed(2):0;
      return ns;
    });
    setSales(u); save('vinted_sales',u);
  };

  const del=async (sid,pid)=>{
    if(!await askConfirm('Supprimer cette vente ?')) return;
    const ns=sales.filter(s=>s.id!==sid); setSales(ns); save('vinted_sales',ns);
    const pids=String(pid||'').split('+').map(v=>v.trim()).filter(Boolean);
    const nc=catalog.map(p=>pids.includes(p.id)?{...p,status:'stock'}:p); setCatalog(nc); save('vinted_catalog',nc);
  };

  const addRow=()=>{
    setErr('');
    const rawPid=newRow.productId.trim();
    if(!rawPid||!newRow.saleDate||!newRow.sellPrice){setErr('Article, date et prix vente obligatoires');return;}
    const pids=rawPid.split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
    const pid=pids.join('+');
    const foundItems=pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
    const alreadySold=pids.find(id=>{const cp=catalog.find(x=>x.id===id);return cp&&cp.status==='vendu';});
    if(alreadySold){setErr(`#${alreadySold} déjà vendue`);return;}
    const buy=foundItems.length>0?foundItems.reduce((s,cp)=>s+(+cp.buyPrice),0):(+newRow.buyPrice||0);
    const sell=+newRow.sellPrice;
    const sale={id:uid(),productId:pid,buyPrice:+buy.toFixed(2),sellPrice:sell,
      profit:+(sell-buy).toFixed(2),multi:buy>0?+(sell/buy).toFixed(2):0,
      saleDate:newRow.saleDate,receiveDate:newRow.receiveDate,createdAt:new Date().toISOString(),
      ...(pids.length>1?{isLot:true}:{})};
    const ns=[sale,...sales]; setSales(ns); save('vinted_sales',ns);
    if(foundItems.length>0){const nc=catalog.map(x=>pids.includes(x.id)?{...x,status:'vendu'}:x);setCatalog(nc);save('vinted_catalog',nc);}
    setNewRow({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  };

  const fullFiltered=useMemo(()=>sales.filter(s=>
    !search||(s.productId||'').toLowerCase().includes(search.toLowerCase())||(s.saleDate||'').includes(search)||(s.receiveDate||'').includes(search)
  ),[sales,search]);
  const totalPages=Math.max(1,Math.ceil(fullFiltered.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const filtered=showAll?fullFiltered:fullFiltered.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const totalCA=useMemo(()=>fullFiltered.reduce((s,v)=>s+ +v.sellPrice,0),[fullFiltered]);
  const totalProfit=useMemo(()=>fullFiltered.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[fullFiltered]);

  const _pids=newRow.productId.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
  const p=_pids.length===1?catalog.find(x=>x.id===_pids[0]):null;
  const _foundItems=_pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
  const previewBuy=_foundItems.length>0?_foundItems.reduce((s,x)=>s+(+x.buyPrice),0):(+newRow.buyPrice||null);
  const previewSell=newRow.sellPrice?+newRow.sellPrice:null;

  // CA + bénéfice du mois en cours (basé sur la date de réception JJ/MM/AAAA = argent encaissé)
  const moisVentes=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    sales.forEach(v=>{
      const dt=(v.receiveDate||'').trim();
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[sales]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* Bandeau mois en cours */}
      <div style={{display:'flex',flexWrap:'wrap',gap:14,background:C.card,
        border:`1px solid ${C.blue}44`,borderRadius:12,padding:'12px 16px'}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:500,width:'100%'}}>
          📅 {moisVentes.nom} — mois en cours
        </div>
        <div><span style={{fontSize:11,color:C.muted}}>CA finalisé</span><div style={{fontSize:20,fontWeight:600,color:C.text}}>{fmt(moisVentes.ca)}</div></div>
        <div><span style={{fontSize:11,color:C.muted}}>Bénéfice</span><div style={{fontSize:20,fontWeight:600,color:moisVentes.profit>=0?C.accent:C.danger}}>{fmt(moisVentes.profit)}</div></div>
        <div><span style={{fontSize:11,color:C.muted}}>Ventes</span><div style={{fontSize:20,fontWeight:600,color:C.muted}}>{moisVentes.count}</div></div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accentTexte,fontSize:20,fontWeight:600}}>Ventes ({sales.length})</h2>
        <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{color:C.muted}}>CA filtré : <b style={{color:C.text}}>{fmt(totalCA)}</b></span>
          <span style={{color:C.muted}}>Bénéf. : <b style={{color:totalProfit>=0?C.accent:C.danger}}>{fmt(totalProfit)}</b></span>
          <Btn small onClick={()=>{
            if(fullFiltered.length===0){toast('Aucune vente à exporter');return;}
            const headers=['ID','N° Article','Date vente','Date réception','Prix achat (€)','Prix vente (€)','Bénéfice (€)','Multi'];
            const rows=fullFiltered.map(s=>[
              s.id||'',s.productId||'',s.saleDate||'',s.receiveDate||'',
              String(s.buyPrice||'').replace('.',','),String(s.sellPrice||'').replace('.',','),
              String(s.profit||'').replace('.',','),String(s.multi||'').replace('.',','),
            ]);
            const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
            const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`ventes-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} color={C.blue}>📤 Exporter Excel</Btn>
        </div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="Article, date... puis Entrée"
          style={{maxWidth:280,flex:1,minWidth:160}}/>
        <Btn small onClick={triggerSearch} color={C.accent} disabled={!searchInput.trim()&&!search} title={!searchInput.trim()&&!search?'Tape d’abord un N° ou une date':undefined}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div className={selectMode?'sales-select-mode':''} style={{overflowX:'auto',position:'relative'}}>
          <style>{`
            .sales-select-mode tbody td > * { pointer-events: none !important; }
            .sales-select-mode tbody tr { pointer-events: auto !important; }
          `}</style>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,
            ...(selectMode?{userSelect:'none',WebkitUserSelect:'none'}:{})}}>
            <thead style={{background:C.surface,position:'sticky',top:0,zIndex:1}}><tr>
              {['Article','Date vente','Réception\u00a0€','Achat','Vente','Bénéfice','×','Facture',''].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 10px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune vente</td></tr>}
              {filtered.map(v=>{
                const b=+(+v.sellPrice-+v.buyPrice);
                const isSelected=selectedIds.has(v.id);
                return (
                  <tr key={v.id}
                    onMouseDown={selectMode?(e)=>{
                      e.preventDefault();
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    onTouchStart={selectMode?(e)=>{
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    data-vid={v.id}
                    style={{borderTop:`1px solid ${C.border}`,background:isSelected?`${C.accent}33`:'transparent',cursor:selectMode?'pointer':'auto',userSelect:selectMode?'none':'auto',position:'relative'}}>
                    <td style={{padding:'2px 10px',minWidth:100,fontWeight:500,color:C.accentTexte}}>
                      <Cell value={v.productId||''} onChange={val=>updateSale(v.id,'productId',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.saleDate||''} onChange={val=>updateSale(v.id,'saleDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.receiveDate||''} onChange={val=>updateSale(v.id,'receiveDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.buyPrice)} onChange={val=>updateSale(v.id,'buyPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.sellPrice)} onChange={val=>updateSale(v.id,'sellPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',color:b>=0?C.accent:C.danger,fontWeight:600,whiteSpace:'nowrap'}}>{fmt(b)}</td>
                    <td style={{padding:'2px 10px',color:C.warn,whiteSpace:'nowrap'}}>×{fmtN(v.multi)}</td>
                    <td style={{padding:'2px 10px',whiteSpace:'nowrap'}}>
                      {(() => {
                        const inv=invoices&&invoices.find(i=>String(i.productId).trim()===String(v.productId||'').trim());
                        if(!inv) return <span style={{color:C.muted,fontSize:11}}>—</span>;
                        return <button type="button" onClick={()=>generatePDF(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings||{...ENTREPRISE_VIDE}))}
                          title={`Voir la facture ${inv.number}`}
                          style={{background:`${C.blue}22`,border:`1px solid ${C.blue}66`,borderRadius:6,color:C.blue,padding:'2px 8px',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'monospace'}}>
                          📄 {inv.number}
                        </button>;
                      })()}
                    </td>
                    <td style={{padding:'2px 10px'}}>
                      <Btn small danger onClick={()=>del(v.id,v.productId)}>✕</Btn>
                    </td>
                  </tr>
                );
              })}
              {/* Ligne d'ajout en bas */}
              <tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.productId} onChange={e=>{
                    const pid=e.target.value;
                    const parts=pid.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
                    const inv=parts.length===1?(invoices?invoices.find(i=>String(i.productId).trim()===parts[0]):null):null;
                    setNewRow(n=>({
                      ...n,
                      productId:pid,
                      ...(inv?{saleDate:inv.saleDate||n.saleDate}:{}),
                    }));
                  }}
                    placeholder="N° ou N°+N° (lot)" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.accentTexte,padding:'4px 6px',fontSize:12,width:90,fontFamily:'monospace',outline:'none',fontWeight:500}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.saleDate} onChange={e=>setNewRow(n=>({...n,saleDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.receiveDate} onChange={e=>setNewRow(n=>({...n,receiveDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  {_foundItems.length>0?<span style={{color:C.muted,fontSize:12,padding:'0 6px'}}>{fmt(previewBuy)}{_foundItems.length>1?<span style={{fontSize:11,color:C.purple,marginLeft:3}}>lot</span>:null}</span>:
                  <input value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                    type="number" placeholder="Achat&nbsp;€"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.sellPrice} onChange={e=>setNewRow(n=>({...n,sellPrice:e.target.value}))}
                    type="number" placeholder="Vente&nbsp;€"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px',color:previewBuy!==null&&previewSell!==null?(previewSell-previewBuy>=0?C.accent:C.danger):C.muted,fontWeight:600,fontSize:12,whiteSpace:'nowrap'}}>
                  {previewBuy!==null&&previewSell!==null?fmt(previewSell-previewBuy):''}
                </td>
                <td style={{padding:'6px 6px',color:C.warn,fontSize:12}}>
                  {previewBuy&&previewBuy>0&&previewSell?`×${(previewSell/previewBuy).toFixed(2)}`:''}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
                </td>
              </tr>
              {err&&<tr><td colSpan={8} style={{padding:'6px 12px',color:C.danger,fontSize:12}}>⚠ {err}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Pagination */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullFiltered.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.border} style={{marginLeft:8}}>Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullFiltered.length} ventes</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Barre flottante en bas : bouton sélection + somme */}
      <div style={{position:'sticky',bottom:0,zIndex:20,padding:'8px 0',background:`linear-gradient(180deg, transparent 0%, ${C.bg} 30%)`}}>
        <Card style={{padding:'10px 14px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',background:selectMode?`${C.accent}15`:C.card,borderColor:selectMode?`${C.accent}66`:C.border}}>
          <Btn small onClick={()=>{setSelectMode(!selectMode);if(selectMode)setSelectedIds(new Set());}} aria-pressed={selectMode} color={C.border} style={{color:selectMode?C.text:C.muted,boxShadow:selectMode?`inset 0 0 0 2px ${C.accent}`:'none'}}>
            {selectMode?'✓ Mode sélection actif':'☑️ Activer la sélection'}
          </Btn>
          {selectMode&&<>
            <span style={{fontSize:11,color:C.muted}}>
              {selectedIds.size===0?'Clique ou glisse sur les lignes du tableau pour les sélectionner':`${selectedIds.size} vente${selectedIds.size>1?'s':''} sélectionnée${selectedIds.size>1?'s':''}`}
            </span>
            {selectedIds.size>0&&(()=>{
              const sel=fullFiltered.filter(v=>selectedIds.has(v.id));
              const sumCA=sel.reduce((s,v)=>s+ +v.sellPrice,0);
              const sumProfit=sel.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
              const sumRecu=sel.filter(v=>v.receiveDate&&v.receiveDate.trim()!=='').reduce((s,v)=>s+ +v.sellPrice,0);
              return (<>
                <span style={{fontSize:13,color:C.muted,marginLeft:'auto'}}>Σ : <b style={{color:C.text}}>{fmt(sumCA)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>💰 Reçu : <b style={{color:C.accentTexte}}>{fmt(sumRecu)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>Bénéf. : <b style={{color:sumProfit>=0?C.accent:C.danger}}>{fmt(sumProfit)}</b></span>
              </>);
            })()}
          </>}
        </Card>
      </div>
    </div>
  );
}
// ⟦← App.jsx #20⟧

/* ── Factures ───────────────────────────────────────── */
function Invoices({invoices,setInvoices,catalog,sales,invoiceSettings,setInvoiceSettings,entreprises,setEntreprises,activeEnt,setActiveEnt,argentNav=null}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [zone,setZone]=useState('attente'); // 'attente' | 'comptabilisees'
  const [page,setPage]=useState(null);
  // (6 nov., v36) Une facture choisie dans la loupe : l'écran s'ouvre cherché sur SON n°.
  useEffect(()=>{ const f=()=>{ const n=prendreDemande('facture'); if(n){ setSearchInput(n); setSearch(n); setPage(null); } }; f(); window.addEventListener('vrm:recherche-ouvrir',f); return ()=>window.removeEventListener('vrm:recherche-ouvrir',f); },[]);
  const [showAll,setShowAll]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  // « Facturation Pro » vit ICI depuis le 30 sept. (Julien : « ça doit être dans
  // l'onglet Facture », plus dans Réglages). Même composant, même ligne
  // `vrm_pro_facture` — seul l'endroit change (§11 : un seul propriétaire).
  const [showPro,setShowPro]=useState(false);
  const [fetching,setFetching]=useState(false);
  const [menuFac,setMenuFac]=useState(false);   // (11 nov., C4) la feuille « … » des factures au téléphone
  const relireFacturesClic=async()=>{ setFetching(true); try{ const r=await import('../FacturePro.jsx').then((m)=>m.relireFactures(DEPS_FACTURE)).catch(()=>null); if(r) toast('Factures relues'); else toast('Les factures n\'ont pas pu être relues — réessaie dans un instant.'); } finally { setFetching(false); } };
  const PER_PAGE=50;

  // ⚠️⚠️ CHEMIN GOOGLE SHEETS RETIRÉ (9 septembre) — IL ÉTAIT MORT, MESURÉ.
  // `fetchVintedInvoices` appelait un Apps Script
  // (`script.google.com/macros/s/…/exec`) au montage de l'écran ET TOUTES LES
  // 5 MINUTES, en silence (`silencieux=true`, donc aucun message). Interrogé
  // le 9 septembre : **404**, réponse HTML — donc `res.json()` levait, le
  // `catch` avalait, et l'écran retentait indéfiniment un endpoint qui
  // n'existe plus.
  // ⚠️ Et l'écran vide DISAIT à Julien « elles arrivent de tes emails Vinted,
  // par ta feuille Google », avec un bouton « Aller les chercher maintenant » :
  // il pouvait attendre des factures qui ne pouvaient PAS arriver, et cliquer
  // sur un bouton qui ne pouvait QUE échouer (avec « Erreur récupération : … »,
  // du vocabulaire d'informaticien par-dessus le marché).
  // ⚠️ Le dossier annonçait pourtant cette architecture retirée le 30 août
  // (« plus AUCUN appelant ») : c'était FAUX, ce caller-ci avait survécu.
  // Même famille que le tiroir `Nav` — sauf qu'ici le code mort TOURNAIT.
  // ⚠️ Et l'URL `/exec` d'un Apps Script est une URL-capacité : quiconque la
  // connaît peut l'invoquer. Elle vivait en clair dans un dépôt PUBLIC.
  //
  // La VRAIE source est juste à côté et elle est vivante : `fetchProInvoices`
  // lit `email_invoice_*` en base — les reçus Vinted arrivés par email
  // (`api/email-inbound`). Plus « + Nouvelle facture » pour la saisie.

  // (2 nov.) Les factures Pro se lisent dans `ListeFacturesPro` (src/FacturePro.jsx),
  // en scalaires — plus de relecture `select=data` toutes les 5 minutes (§4.4).

  // Numéro auto pour la prochaine facture — SÉQUENCE PROPRE À L'ENTITÉ ACTIVE.
  // Une facture sans `entrepriseId` appartient à la 1ʳᵉ entité (rétro-compat).
  // Chaque micro-entreprise garde ainsi sa propre numérotation continue (légal).
  const firstEntId=(Array.isArray(entreprises)&&entreprises[0]&&entreprises[0].id)||'ent_1';
  const invBelongsToActive=(i)=>{ const eid=i.entrepriseId||firstEntId; return eid===(activeEnt||firstEntId); };
  const nextInvoiceNumber=useMemo(()=>{
    const year=new Date().getFullYear();
    const yearInvoices=invoices.filter(i=>i.number&&i.number.startsWith(`${year}-`)&&invBelongsToActive(i));
    const maxNum=yearInvoices.reduce((mx,i)=>{
      const n=parseInt(i.number.split('-')[1],10);
      return isNaN(n)?mx:Math.max(mx,n);
    },0);
    return `${year}-${String(maxNum+1).padStart(6,'0')}`;
  },[invoices,activeEnt,firstEntId]);
  
  // Set des productIds qui sont déjà dans Ventes (= comptabilisés)
  const accountedSet=useMemo(()=>{
    const s=new Set();
    sales.forEach(v=>{
      if(v.productId) String(v.productId).trim().split('+').forEach(id=>{const t=id.trim();if(t) s.add(t);});
    });
    return s;
  },[sales]);
  
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Filtrage par zone + recherche
  const fullList=useMemo(()=>{
    let list=invoices;
    // Si une recherche est active, on cherche dans TOUTES les zones (pratique pour retrouver/supprimer une facture)
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list=list.filter(i=>(i.number||'').toLowerCase().includes(q)||
        String(i.productId||'').toLowerCase().includes(q)||
        (i.itemName||'').toLowerCase().includes(q)||
        (i.buyerName||'').toLowerCase().includes(q)||
        fmtDate(i.saleDate||'').toLowerCase().includes(q)||
        String(i.saleDate||'').toLowerCase().includes(q));
      return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
    }
    // Sinon, filtrage normal par zone
    if(zone==='attente') list=list.filter(i=>!accountedSet.has(String(i.productId).trim()));
    else if(zone==='comptabilisees') list=list.filter(i=>accountedSet.has(String(i.productId).trim()));
    return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
  },[invoices,zone,search,accountedSet]);
  
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?0:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);
  
  // Compteurs par zone
  const counters=useMemo(()=>{
    const attente=invoices.filter(i=>!accountedSet.has(String(i.productId).trim())).length;
    const comptabilisees=invoices.filter(i=>accountedSet.has(String(i.productId).trim())).length;
    return {attente,comptabilisees};
  },[invoices,accountedSet]);
  
  const deleteInvoice=async (id)=>{
    const inv=invoices.find(i=>i.id===id);
    const isAcc=inv&&accountedSet.has(String(inv.productId).trim());
    const msg=isAcc
      ? `⚠️ L’article #${inv.productId} a une vente saisie dans ta compta.\nSupprimer cette facture quand même ?`
      : 'Supprimer cette facture ?';
    if(!await askConfirm(msg)) return;
    const u=invoices.filter(i=>i.id!==id);
    setInvoices(u); save('vinted_invoices',u);
  };
  
  const addInvoice=(data)=>{
    const newInvoice={
      id:'inv_'+Date.now(),
      number:nextInvoiceNumber,
      entrepriseId:activeEnt||firstEntId, // à quelle micro-entreprise cette facture appartient
      ...data,
      createdAt:new Date().toISOString(),
    };
    const u=[newInvoice,...invoices];
    setInvoices(u); save('vinted_invoices',u);
    setShowForm(false);
  };
  
  // Export CSV/Excel
  const exportExcel=()=>{
    if(fullList.length===0){toast('Aucune facture à exporter');return;}
    const multiEnt=Array.isArray(entreprises)&&entreprises.length>1;
    const headers=['N° Facture',...(multiEnt?['Entreprise','SIRET']:[]),'Date vente','N° Article','Désignation','Prix vente','Acheteur','Email','Adresse','N° Vinted','Statut'];
    const rows=fullList.map(i=>{
      const e=entForInvoice(i,entreprises,activeEnt,invoiceSettings);
      return [
      i.number||'',...(multiEnt?[e&&e.companyName||'',e&&e.siret||'']:[]),i.saleDate||'',i.productId||'',i.itemName||'',
      (i.sellPrice||'').toString().replace('.',','),
      i.buyerName||'',i.buyerEmail||'',i.buyerAddress||'',i.vintedNumber||'',
      accountedSet.has(String(i.productId).trim())?'Comptabilisée':'En attente',
    ];});
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`factures-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* ⚠️ LES BOUTONS PASSENT DANS LE `right` DE `ScreenHead`. Posés à côté
          dans une rangée à part, ils sortaient de la zone protégée et
          glissaient SOUS l'île d'actions flottante : « ⚙ Réglages » était
          invisible (vu en capture). Le slot `right` existe pour ça. */}
      <div>
        <ScreenHead icon={argentNav?"euro":"receipt"} title={argentNav?L.argent:"Factures"} desc="Les justificatifs de tes ventes, importés depuis tes e-mails Vinted."
          right={<>
          {/* (11 nov., décision C4 — Julien : « tranche ») Au téléphone, les cinq boutons tassaient la
              ligne du titre : le geste principal reste visible, les quatre autres passent dans « … »
              (une feuille en portail, des lignes de 44 px). Sur ordinateur, rien ne change. */}
          <div className="vrm-fac-actions" data-fac-actions="large" style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <Btn small primaire onClick={()=>setShowForm(true)}>+ Nouvelle facture</Btn>
          {/* ⚠️ « Récupérer Vinted » appelait l'Apps Script mort : le bouton ne
              pouvait QUE échouer. Il relit maintenant les reçus arrivés par
              email — la source qui remplit vraiment cet écran. */}
          <Btn small outline color={C.muted} disabled={fetching} onClick={relireFacturesClic} style={{display:'inline-flex',alignItems:'center',gap:5}}>
            <Icon name="sync" size={13}/>{fetching?'Chargement…':'Relire les factures'}
          </Btn>
          <Btn small outline color={C.muted} onClick={exportExcel} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="save" size={13}/>Exporter Excel</Btn>
          <Btn small outline color={C.muted} onClick={()=>setShowPro(v=>!v)} aria-expanded={showPro} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="receipt" size={13}/>Ma facture</Btn>
          <Btn small outline color={C.muted} onClick={()=>setShowSettings(true)} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="gear" size={13}/>Réglages des factures</Btn>
          </div>
          <div className="vrm-fac-actions-tel" data-fac-actions="tel">
            <Btn small primaire onClick={()=>setShowForm(true)} data-fac-principal="">+ Nouvelle facture</Btn>
            <button type="button" className="vrm-icon-control vrm-fac-plus" data-fac-plus="" aria-haspopup="dialog" aria-expanded={menuFac} aria-label="Autres actions des factures" onClick={()=>setMenuFac(true)}><Icon name="more" size={20}/></button>
          </div>
        </>}/>
        {menuFac && <SheetShell onClose={()=>setMenuFac(false)} maxWidth={420} titre="Factures" data-fac-menu="">
          <div className="vrm-fiche-menu" onClickCapture={(ev)=>{ const b = ev.target && ev.target.closest && ev.target.closest('button'); if (b) setTimeout(()=>setMenuFac(false), 0); }}>
            <button type="button" data-fac-menu-geste="relire" disabled={fetching} onClick={relireFacturesClic}><Icon name="sync" size={16}/>{fetching?'Chargement…':'Relire les factures'}</button>
            <button type="button" data-fac-menu-geste="excel" onClick={exportExcel}><Icon name="save" size={16}/>Exporter Excel</button>
            <button type="button" data-fac-menu-geste="fiche" onClick={()=>setShowPro(v=>!v)}><Icon name="receipt" size={16}/>Ma facture</button>
            <button type="button" data-fac-menu-geste="reglages" onClick={()=>setShowSettings(true)}><Icon name="gear" size={16}/>Réglages des factures</button>
          </div>
        </SheetShell>}
        {/* (10 nov., Argent) Les segments SOUS la ligne du titre, pas dedans : cinq actions y
            tassaient la piste (« Statistiqu… », vu en capture à 1512 px). */}
        {argentNav}
      </div>
      <SeuilTvaFactures deps={DEPS_FACTURE}/>
      {showPro && <FicheFacturation deps={DEPS_FACTURE}/>}
      <FacturesAEnvoyer deps={DEPS_FACTURE}/>
      <ListeFacturesPro deps={DEPS_FACTURE}/>

      {/* Barre de recherche : par n° de paire ou date de vente (cherche dans toutes les zones) */}
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <input
          value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="N° d’article ou date de vente... puis Entrée"
          style={{flex:1,minWidth:200,padding:'9px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
            color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}
        />
        <Btn small onClick={triggerSearch} color={C.accent} disabled={!searchInput.trim()&&!search} title={!searchInput.trim()&&!search?'Tape d’abord un N° ou une date':undefined}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕ Effacer</Btn>}
      </div>
      {search&&<div style={{fontSize:12,color:C.warn}}>
        🔍 « {search} » : {fullList.length} résultat{fullList.length>1?'s':''} dans toutes les factures.
      </div>}
      
      {/* Sous-onglets zones */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,overflowX:'auto',opacity:search?0.4:1,pointerEvents:search?'none':'auto'}}>
        {[
          {id:'attente',icon:'clock',label:'En attente',count:counters.attente},
          {id:'comptabilisees',icon:'check',label:'Comptabilisées',count:counters.comptabilisees},
        ].map(z=>(
          <button key={z.id} type="button" aria-pressed={zone===z.id} onClick={()=>{setZone(z.id);setPage(null);}}
            style={{background:'transparent',border:'none',borderBottom:zone===z.id?`3px solid ${C.accent}`:'3px solid transparent',
              color:zone===z.id?C.accentTexte:C.muted,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name={z.icon} size={13}/>{z.label} ({z.count})</span>
          </button>
        ))}
      </div>
      {/* (Une seule barre de recherche, au-dessus des onglets — la deuxième,
          identique, faisait doublon.) */}
      {search.trim()&&<div style={{fontSize:11,color:C.warn,marginTop:6}}>🔍 Recherche active dans toutes les factures.</div>}
      
      {/* Tableau factures */}
      <Card style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
          <thead>
            <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.warn,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>N° Article</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>N° Facture</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Date vente</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Désignation</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Prix</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Acheteur</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* ⚠️ UN ÉCRAN VIDE DOIT DIRE QUOI FAIRE (§7 : il n'est pas
                développeur — « Aucune facture en attente » ne se rattrape
                nulle part). D'où l'origine des lignes, et la porte : le même
                « Récupérer Vinted » que le haut de l'écran, à l'endroit où il
                constate le vide. */}
            {list.length===0&&<tr><td colSpan={7} style={{padding:'28px 20px',textAlign:'center',color:C.muted,fontSize:13,lineHeight:1.5}}>
              {search.trim()
                ? <>Aucune facture trouvée pour « {search} ».</>
                : zone==='attente'
                  ? <>Aucune facture en attente.<br/>
                      {/* ⚠️ Cette phrase parlait d'une « feuille Google » : le
                          pipeline Apps Script est mort (404, mesuré). Il aurait
                          attendu des factures qui ne pouvaient pas arriver. Ce
                          qui remplit vraiment cet écran, ce sont les reçus
                          Vinted reçus par email, et sa propre saisie. */}
                      
                      <span style={{display:'inline-block',marginTop:10}}>
                        <Btn small color={C.accent} onClick={()=>setShowForm(true)}
                          style={{display:'inline-flex',alignItems:'center',gap:5}}>+ Nouvelle facture</Btn>
                      </span>
                    </>
                  : <>Aucune facture comptabilisée.<br/>
                      <span style={{fontSize:12}}>Une facture arrive ici quand tu la marques comptabilisée.</span>
                    </>}
            </td></tr>}
            {list.map(inv=>{
              const isAccounted=accountedSet.has(String(inv.productId).trim());
              return (
                <tr key={inv.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px',color:C.warn,fontWeight:600,fontFamily:'monospace',fontSize:15}}>#{inv.productId||'?'}</td>
                  <td style={{padding:'8px',color:C.accentTexte,fontWeight:500,fontFamily:'monospace',fontSize:11}}>{inv.number||'—'}{(entreprises&&entreprises.length>1)&&(()=>{const e=entForInvoice(inv,entreprises,activeEnt,invoiceSettings);return e&&e.companyName?<div style={{marginTop:2,fontFamily:'inherit',fontSize:11,color:C.muted,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:110}}>🏢 {e.companyName}</div>:null;})()}</td>
                  <td style={{padding:'8px',color:C.text,fontFamily:'monospace',fontSize:11}}>{fmtDate(inv.saleDate)}</td>
                  <td style={{padding:'8px',color:C.text}}>{String(inv.itemName||'—').replace(/\bimages?\s*:\s*/gi,'').replace(/\bimages?\b/gi,'').replace(/\s+/g,' ').trim()||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',color:C.accentTexte,fontWeight:500}}>{fmt(+inv.sellPrice||0)}</td>
                  <td style={{padding:'8px',color:C.muted,fontSize:11}}>{inv.buyerName||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',whiteSpace:'nowrap'}}>
                    <Btn small onClick={()=>generatePDF(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings))} color={C.blue} style={{marginRight:4}} aria-label="Imprimer la facture" title="Imprimer la facture"><Icon name="printer" size={15}/></Btn>
                    <Btn small onClick={()=>generateFacturXPdf(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings))} color={C.muted} style={{marginRight:4}} title="Facture électronique Factur-X (PDF + XML EN16931 embarqué)">🧾</Btn>
                    <Btn small onClick={()=>deleteInvoice(inv.id)} color={C.danger}>🗑</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      
      {/* Pagination */}
      {!showAll&&totalPages>1&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?0:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?0:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.border} style={{marginLeft:8}}>Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} factures</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Modale création facture */}
      {showForm&&<InvoiceForm onClose={()=>setShowForm(false)} onSave={addInvoice} nextNumber={nextInvoiceNumber} catalog={catalog}/>}
      
      {/* Modale réglages */}
      {showSettings&&<InvoiceSettings settings={invoiceSettings} setSettings={(s)=>{setInvoiceSettings(s);save('vinted_invoice_settings',s);}} entreprises={entreprises} setEntreprises={setEntreprises} activeEnt={activeEnt} setActiveEnt={setActiveEnt} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// Formulaire de création d'une facture
function InvoiceForm({onClose,onSave,nextNumber,catalog}) {
  const [data,setData]=useState({
    productId:'',itemName:'',sellPrice:'',saleDate:tod(),
    buyerName:'',buyerEmail:'',buyerAddress:'',
    vintedNumber:'',source:'manual',
  });
  const [err,setErr]=useState('');
  
  const submit=()=>{
    setErr('');
    if(!data.productId.trim()){setErr('Le numéro d’article est obligatoire');return;}
    if(!data.sellPrice||+data.sellPrice<=0){setErr('Prix de vente invalide');return;}
    if(!data.itemName.trim()){setErr('La désignation est obligatoire');return;}
    onSave(data);
  };
  
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accentTexte}}>Nouvelle facture</h3>
          <button type="button" onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Numéro auto : <b style={{color:C.accentTexte}}>{nextNumber}</b></div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="N° article (étiquetage) *">
            <Input type="number" value={data.productId} onChange={e=>{
              const id=e.target.value;
              const p=catalog.find(p=>p.id===id);
              setData(d=>({...d,productId:id, itemName:p?(d.itemName||''):d.itemName}));
            }} placeholder="ex: 1280"/>
          </Field>
          <Field label="Désignation *">
            <Input value={data.itemName} onChange={e=>setData(d=>({...d,itemName:e.target.value}))} placeholder="ex: Adidas Spezial bleu marine taille 365"/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Prix de vente&nbsp;€ *">
              <Input type="number" step="0.01" value={data.sellPrice} onChange={e=>setData(d=>({...d,sellPrice:e.target.value}))} placeholder="38.00"/>
            </Field>
            <Field label="Date vente">
              <Input type="date" value={data.saleDate} onChange={e=>setData(d=>({...d,saleDate:e.target.value}))}/>
            </Field>
          </div>

          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:4}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:500}}>Acheteur</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Field label="Nom complet"><Input value={data.buyerName} onChange={e=>setData(d=>({...d,buyerName:e.target.value}))} placeholder="Prénom Nom"/></Field>
              <Field label="Email"><Input type="email" value={data.buyerEmail} onChange={e=>setData(d=>({...d,buyerEmail:e.target.value}))} placeholder="prenom.nom@exemple.fr"/></Field>
              <Field label="Adresse complète"><Input value={data.buyerAddress} onChange={e=>setData(d=>({...d,buyerAddress:e.target.value}))} placeholder="N° et rue, code postal, ville, pays"/></Field>
            </div>
          </div>

          <Field label="N° transaction Vinted">
            <Input value={data.vintedNumber} onChange={e=>setData(d=>({...d,vintedNumber:e.target.value}))} placeholder="19921523337"/>
          </Field>

          {err&&<div style={{color:C.danger,fontSize:12}}>⚠ {err}</div>}

          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn primaire onClick={submit} style={{flex:1}}>Créer la facture</Btn>
            <Bouton variante="discret" onClick={onClose}>Annuler</Bouton>
          </div>
        </div>
      </div>
    </div>
  );
}

// Réglages personnalisables
// Réglages factures — gère PLUSIEURS micro-entreprises. Rétro-compatible : si une
// seule entité, c'est exactement comme avant. `setSettings` continue de refléter
// l'entité ACTIVE dans `vinted_invoice_settings` (pour tout code hérité qui le lit).
function InvoiceSettings({settings,setSettings,entreprises,setEntreprises,activeEnt,setActiveEnt,onClose}) {
  const list = (Array.isArray(entreprises)&&entreprises.length) ? entreprises : [{id:'ent_1',...settings}];
  const [sel,setSel]=useState(()=>{ const a=list.find(e=>e.id===activeEnt); return (a&&a.id)||list[0].id; });
  const cur = list.find(e=>e.id===sel)||list[0];
  const [data,setData]=useState(cur);
  // Quand on change d'entité sélectionnée, charge ses champs dans le formulaire.
  const pick=(id)=>{ setSel(id); const e=list.find(x=>x.id===id); if(e) setData(e); };
  const mirror=(entList,activeId)=>{ const act=entList.find(e=>e.id===activeId)||entList[0]; if(act) setSettings({companyName:act.companyName||'',companyType:act.companyType||'',companyAddress:act.companyAddress||'',siret:act.siret||'',footer:act.footer||''}); };
  const persist=(entList,activeId)=>{ setEntreprises(entList); if(activeId!==undefined){ setActiveEnt(activeId); } mirror(entList, activeId!==undefined?activeId:activeEnt); };
  const saveCur=()=>{ const next=list.map(e=>e.id===sel?{...e,...data,id:sel}:e); persist(next); onClose(); };
  const addEnt=()=>{ const id='ent_'+Date.now(); const blank={id,companyName:'',companyType:'Entrepreneur individuel',companyAddress:'',siret:'',tvaMention:'TVA non applicable, art. 293 B du CGI',footer:'Merci pour votre achat !'}; const next=[...list,blank]; setEntreprises(next); setSel(id); setData(blank); };
  const delEnt=()=>{ if(list.length<=1) return; const next=list.filter(e=>e.id!==sel); const newActive=(activeEnt===sel)?next[0].id:activeEnt; persist(next,newActive); const nsel=next[0].id; setSel(nsel); setData(next[0]); };
  const makeActive=()=>{ const next=list.map(e=>e.id===sel?{...e,...data,id:sel}:e); persist(next,sel); };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accentTexte}}>⚙ Réglages factures</h3>
          <button type="button" onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        {/* Sélecteur de micro-entreprise */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:5}}>Mes micro-entreprises</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {list.map(e=>(
              <button key={e.id} type="button" onClick={()=>pick(e.id)}
                style={{border:`1px solid ${e.id===sel?C.accent:C.border}`,background:e.id===sel?`${C.accent}18`:'transparent',color:e.id===sel?C.accent:C.text,borderRadius:12,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {e.id===activeEnt?'⭐ ':''}{e.companyName||'(sans nom)'}
              </button>
            ))}
            <button type="button" onClick={addEnt} style={{border:`1px dashed ${C.border}`,background:'transparent',color:C.muted,borderRadius:12,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Ajouter</button>
          </div>
          <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:5}}>⭐ = entité utilisée pour les nouvelles factures. Chaque entité a sa propre numérotation.</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="Nom de l'entreprise"><Input value={data.companyName||''} onChange={e=>setData(d=>({...d,companyName:e.target.value}))}/></Field>
          <Field label="Forme juridique"><Input value={data.companyType||''} onChange={e=>setData(d=>({...d,companyType:e.target.value}))}/></Field>
          <Field label="Adresse"><Input value={data.companyAddress||''} onChange={e=>setData(d=>({...d,companyAddress:e.target.value}))}/></Field>
          <Field label="SIRET"><Input value={data.siret||''} onChange={e=>setData(d=>({...d,siret:e.target.value}))}/></Field>
          <Field label="Mention TVA (bas de facture)"><Input value={data.tvaMention!=null?data.tvaMention:'TVA non applicable, art. 293 B du CGI'} onChange={e=>setData(d=>({...d,tvaMention:e.target.value}))}/></Field>
          <Field label="Message de bas de page"><Input value={data.footer||''} onChange={e=>setData(d=>({...d,footer:e.target.value}))}/></Field>
          {sel!==activeEnt&&<Btn onClick={makeActive} color={C.blue} style={{fontSize:12}}>Utiliser pour les nouvelles factures</Btn>}
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn primaire onClick={saveCur} style={{flex:1}}>Enregistrer</Btn>
            {list.length>1&&<Btn onClick={delEnt} color={C.red||'#c0392b'}>🗑 Supprimer</Btn>}
            <Bouton variante="discret" onClick={onClose}>Annuler</Bouton>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper pour les champs du formulaire
function Field({label,children}) {
  return <label className="vrm-field" style={{display:'flex',flexDirection:'column',gap:4}}>
    <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</span>
    {children}
  </label>;
}
// ⟦← App.jsx #21⟧

// Génération du PDF (HTML imprimable qui s'ouvre dans une nouvelle fenêtre)
// ⚠️⚠️ UN DOCUMENT IMPRIMABLE N'EXÉCUTE RIEN (sécurité, 5 octobre).
// `window.open('')` ouvre une fenêtre de MÊME ORIGINE que l'app : un script qui
// s'y glisse lit la session de Julien. Or une facture porte le nom, l'adresse et
// l'email de l'ACHETEUR — écrits par l'acheteur lui-même sur Vinted — et ils
// partaient tels quels dans le document (« <img src=x onerror=…> » suffisait).
// Mesuré dans Chromium : sans politique, le code injecté s'exécute ; avec cette
// politique écrite EN TÊTE du document, plus rien ne s'exécute, et l'app garde
// la main pour lancer l'impression (`w.print()` depuis cette page).
// Les valeurs sont AUSSI échappées (xmlEsc) : la politique couvre ce qui est
// déjà rangé en base (factures construites avant ce correctif).
const CSP_DOCUMENT = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data: https:">`;
function ouvrirDocumentImprimable(html) {
  const w = window.open('', '_blank'); if (!w) return null;
  const doc = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const tete = /<head(\s[^>]*)?>/i;
  // Le journal des violations écoute ce document aussi (22 oct., revue).
  try { w.document.open(); } catch (_) {}
  try { ecouterFenetreCsp(w, 'facture'); } catch (_) {}
  w.document.write(tete.test(doc) ? doc.replace(tete, (m) => m + CSP_DOCUMENT) : CSP_DOCUMENT + doc);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 400);
  return w;
}
// ⟦← App.jsx #22⟧
function generatePDF(inv,settings) {
  let _logo=logoFacture(settings);
  const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Facture ${xmlEsc(inv.number)}</title>
<style>
body{font-family:Arial,sans-serif;color:#222;max-width:800px;margin:30px auto;padding:30px;background:#fff;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}
.logo{width:140px;height:140px;background:#000000;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:800;text-align:center;padding:10px;box-sizing:border-box;}
.logo .top{font-size:15px;letter-spacing:2px;border:1.5px solid #fff;border-radius:6px;padding:2px 8px;}
.logo .shoe{font-size:50px;margin:8px 0;}
.logo .bot{font-size:11px;letter-spacing:3px;}
.title{text-align:right;}
.title h1{margin:0;font-size:34px;letter-spacing:1px;}
.title .num{color:#666;font-size:15px;margin-top:6px;}
.parties{display:flex;justify-content:space-between;margin-bottom:30px;}
.party{flex:1;}
.party-label{font-weight:700;font-size:13px;color:#666;margin-bottom:4px;}
.party-info{font-size:13px;line-height:1.5;}
.party-info b{font-size:15px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{background:#F2F2F7;text-align:left;padding:10px;font-size:13px;border-bottom:2px solid #ddd;}
th.right{text-align:right;}
td{padding:10px;font-size:13px;border-bottom:1px solid #eee;}
td.right{text-align:right;}
.totals{margin-left:auto;width:50%;}
.totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;}
.totals .row b{font-weight:700;}
.totals .total{border-top:1px solid #ccc;margin-top:6px;padding-top:8px;font-size:15px;}
.acquittee{color:#27a85d;text-align:right;margin-top:14px;font-size:15px;font-weight:700;}
.remarques{margin-top:40px;padding-top:20px;border-top:1px solid #eee;}
.remarques .label{font-weight:700;font-size:13px;color:#666;margin-bottom:6px;}
.remarques p{margin:4px 0;font-size:13px;}
.footer{margin-top:50px;text-align:center;color:#999;font-size:11px;}
@media print{body{margin:0;}}
</style></head><body>
<div class="header">
  ${_logo?`<div class="logo">
    <img src="${xmlEsc(_logo)}" alt="${xmlEsc((settings&&settings.companyName)||'Logo')}" style="width:140px;height:auto;border-radius:12px;" />
  </div>`:`<div style="font-size:17px;font-weight:800;color:#222;max-width:300px">${xmlEsc((settings&&settings.companyName)||'')}</div>`}
  <div class="title">
    <h1>FACTURE</h1>
    <div class="num"># ${xmlEsc(inv.number)}</div>
    <div class="num">Date : ${fmtDate(inv.saleDate)}</div>
  </div>
</div>
<div class="parties">
  <div class="party">
    <div class="party-label">De :</div>
    <div class="party-info"><b>${xmlEsc(settings.companyName)}</b><br>${xmlEsc(settings.companyType)}<br>${xmlEsc(settings.companyAddress)}<br>SIRET : ${xmlEsc(settings.siret)}</div>
  </div>
  <div class="party" style="text-align:right">
    <div class="party-label">À :</div>
    <div class="party-info"><b>${xmlEsc(inv.buyerName||inv.buyerEmail||'Client')}</b>${inv.buyerAddress?'<br>'+xmlEsc(inv.buyerAddress):''}${inv.buyerEmail&&inv.buyerName?'<br>'+xmlEsc(inv.buyerEmail):''}</div>
  </div>
</div>
<table>
  <thead><tr><th>Objet</th><th class="right">Quantité</th><th class="right">Prix unitaire (HT)</th><th class="right">Montant (HT)</th></tr></thead>
  <tbody><tr><td>${xmlEsc(inv.itemName||'')}</td><td class="right">1</td><td class="right">${(+inv.sellPrice).toFixed(2)}\u00a0€</td><td class="right">${(+inv.sellPrice).toFixed(2)}\u00a0€</td></tr></tbody>
</table>
<div class="totals">
  <div class="row"><b>Sous-total :</b> <b>${(+inv.sellPrice).toFixed(2)}\u00a0€</b></div>
  <div class="row total"><b>Total :</b> <b>${(+inv.sellPrice).toFixed(2)}\u00a0€</b></div>
  <div class="row"><b>Montant payé :</b> <b>${(+inv.sellPrice).toFixed(2)}\u00a0€</b></div>
</div>
<div style="text-align:right;font-size:11px;color:#555;margin-top:6px;font-style:italic">${xmlEsc(settings.tvaMention||'TVA non applicable, art. 293 B du CGI')}</div>
<div class="acquittee">Facture acquittée</div>
<div class="remarques">
  <div class="label">Remarques :</div>
  ${inv.vintedNumber?`<p>Transaction Vinted n°${xmlEsc(inv.vintedNumber)}</p>`:''}
  <p>${xmlEsc(settings.footer||'Merci pour votre achat !')}</p>
</div>
<div class="footer">N° d'étiquetage : ${xmlEsc(inv.productId)}</div>
</body></html>`;
  ouvrirDocumentImprimable(html);
}
// ⟦← App.jsx #23⟧
async function generateFacturXPdf(inv, ent){
  try{
    const out = await buildFacturXBytes(inv, ent);
    const blob=new Blob([out],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`facture-${String(inv.number||'').replace(/[^\w-]/g,'_')||'facturx'}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){ try{toast('Factur-X impossible : '+e.message);}catch(_){} }
}
// ⟦← App.jsx #24⟧
const COMPTA_CATS = ['Emballage', 'Fournitures', 'Abonnement', 'Frais plateforme', 'Transport', 'Matériel', 'Autre'];
// (3 nov.) Les catégories choisies par Julien (src/depensesTicket.js).
const DEPENSE_CATS = CATEGORIES_DEPENSE;
// Les abonnements les plus courants d'un revendeur : un clic remplit le NOM.
// Le prix n'est rempli que pour VRM (celui des CGV, §11) — les autres, on ne
// connaît pas son offre : il le tape (jamais un tarif deviné, §2.3).
const ABONNEMENTS_COURANTS = [
  { nom: 'VRM', prix: () => (String(PRIX_CGV_LISIBLE).match(/\d+(?:,\d+)?/) || [''])[0] },
  { nom: 'Canva' },
  { nom: 'Lightroom' },
  { nom: 'Photoroom' },
];
const rCompId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// (22 oct.) « Je n'ai pas de dépenses à noter » est une RÉPONSE, rangée dans la
// même ligne (`vrm_compta.sansDepenses = { at }`, synchronisée) : elle compte
// comme une saisie — le rattrapage du nuage (§5.49) ne l'écrase pas.
const comptaVide = (d) => !((d.depenses || []).length || (d.fixes || []).length || (d.packs || []).length || (d.abonnements || []).length || d.sansDepenses);
// ⟦← App.jsx #25⟧
// Montant saisi « 12,50 » ou « 12.50 » → nombre. Jamais NaN silencieux : on
// renvoie null, et l'appelant refuse d'ajouter (mieux vaut un blanc qu'un faux).
const parseMontant = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.').replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? n : null; };
// ⟦← App.jsx #26⟧
// (3 nov.) Les LIGNES des charges d'un mois — les mêmes que `comptaChargesMois`
// somme (fixes, dépenses et packs du mois, échéances d'abonnement) : le récap du
// mois les liste, son total est celui de la règle.
const lignesChargesMois = (data, ym) => {
  const d = (data && typeof data === 'object') ? data : {};
  const duMois = (x) => String(x || '').slice(0, 7) === ym;
  const L = [];
  for (const x of (d.fixes || [])) L.push({ date: '', libelle: String(x.label || x.libelle || 'Coût fixe'), montant: Number(x.montant) || 0 });
  for (const x of (d.depenses || []).filter((x) => duMois(x.date))) L.push({ date: x.date, libelle: [x.libelle, x.cat].filter(Boolean).join(' · '), montant: Number(x.montant) || 0 });
  for (const x of (d.packs || []).filter((x) => duMois(x.date))) L.push({ date: x.date, libelle: `Pack ${x.plateforme || ''}`.trim(), montant: Number(x.montant) || 0 });
  for (const a of (d.abonnements || [])) { const m = chargeAbonnement(a, (m) => m === ym, ym); if (m) L.push({ date: '', libelle: String(a.libelle || 'Abonnement'), montant: m }); }
  return { lignes: L, total: comptaChargesMois(data, ym).total };
};
// ── PROFIL FISCAL : le SIREN se vérifie, il ne se bloque pas (16 octobre) ────
// SIREN = 9 chiffres, SIRET = SIREN + 5 chiffres ; les deux portent une clé de
// Luhn. On DIT qu'il est invalide (une faute de frappe part sur chaque reçu
// envoyé au comptable, §5), on n'empêche jamais d'enregistrer : lui seul sait.
// Exception connue : La Poste (SIREN 356000000) — ses SIRET ne suivent pas Luhn
// mais une somme de chiffres multiple de 5.
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
// ⟦← App.jsx #27⟧
// `series` = { vendu, finalise, recu } — chacune une liste `{ts, eur}` ou `null`
// (« pas su » ⇒ la colonne vaut `null`, jamais 0).
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

// ── CA PAR PÉRIODE — vendu · finalisé · reçu (versé) ─────────────────────────
// Julien appelle « encaissé » l'argent versé ; le CA déclaré ne dit jamais
// « encaissé » (§5 : l'app ne connaît pas les recettes encaissées au sens de
// l'URSSAF, et Leboncoin n'est pas daté au versement). D'où « reçu (versé) ».
// AUCUNE règle de vente n'est écrite ici (§11) :
//   · VENDU    = `ventesFaites` (au jour de la vente, en cours comprises, hors
//                annulées et hors ventes/comptes cachés — la règle de Ma journée) ;
//   · FINALISÉ = `ventesDeclarables` (lignes + « à dater »), au jour de la VENTE ;
//   · REÇU     = `ventesDeclarables`, au jour du VERSEMENT (Vinted), de la vente
//                (Leboncoin), de la commande (eBay) — `recuDuMois`, la date des
//                barres de Ma journée, sans le registre des déclarations.
// Les sources sont celles que la COQUE lit déjà (ventes de tous les comptes,
// Leboncoin, eBay) : aucune lecture de plus, sauf les dates de versement.
// Trois états partout : `undefined` lecture en cours · `null` pas su · lu.
const PERIODES_CA = [['semaine', 'Semaine'], ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];
// Dater une vente Leboncoin à la main (29 oct.) : la date se recopie depuis
// « Mes transactions » sur leboncoin.fr. Une date lue par l'extension gagne
// toujours ; une date dans l'avenir ou avant 2015 est refusée.
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
  const eur = (v) => v.price != null && isFinite(Number(v.price)) ? `${(Number(v.price) / 100).toFixed(2).replace('.', ',')}\u00a0€` : '—';
  return (
    <div data-dater-lbc={liste.length} style={{ padding: '10px 16px 14px', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
      <div style={{ fontWeight: 600 }}>Dater tes ventes Leboncoin</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>Recopie la date de « Mes transactions » : la vente entre dans son mois.</div>
      {liste.map((v) => {
        const tx = String(v.txId), cur = (dates || {})[tx] || '';
        const val = saisie[tx] != null ? saisie[tx] : cur;
        return (
          <div key={tx} data-dater-lbc-tx={tx} data-dater-lbc-date={cur} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Vente Leboncoin'} · {eur(v)}</span>
            <input type="date" aria-label={`Date de vente de ${v.title || 'cette vente'}`} max={max} min="2015-01-01" value={val} onChange={(e) => setSaisie((x) => ({ ...x, [tx]: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px', fontSize: 17, minHeight: 44, background: C.bg, color: C.text, fontFamily: 'inherit' }}/>
            <button type="button" data-dater-lbc-ok={tx} disabled={!val || val === cur} onClick={() => poser(tx, val)} style={{ border: 'none', borderRadius: 12, background: C.accent, color: C.onAccent || '#fff', padding: '8px 14px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!val || val === cur) ? 0.5 : 1, fontFamily: 'inherit' }}>Enregistrer</button>
            {cur ? <button type="button" data-dater-lbc-retirer={tx} onClick={() => { setSaisie((x) => ({ ...x, [tx]: '' })); poser(tx, ''); }} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: 'transparent', color: C.text, padding: '8px 12px', minHeight: 44, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Retirer</button> : null}
            {msg && msg.tx === tx ? <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: C.warn }}>{msg.t}</div> : null}
          </div>);
      })}
    </div>
  );
}
// (29 oct.) Le nom de la carte, UNE source : son titre, le sommaire de
// Comptabilité et les phrases qui y renvoient (la carte URSSAF du mois) le lisent.
const TITRE_CARTE_CA = 'Vendu et reçu';
function CaParPeriodeCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts, dansRepli = false }) {
  const excluAutre = useExcluAutre();
  const { ventes, ko } = useVentesCoque();
  // (6 nov.) VENDU compte aussi les ventes vues par e-mail pas encore relues (src/venteEmailFraiche.js) ;
  // REÇU (daté au versement) ne les voit jamais.
  const hAccCle = [...new Set((load('vinted_accounts_hidden', []) || []).map(String))].sort().join(',');
  const ventesEmailCa = useVentesEmailFraiches(ventes, ko, accounts, (u) => compteEcarte(u, new Set(hAccCle ? hAccCle.split(',') : []), panelOff || {}), hAccCle + '|' + JSON.stringify(panelOff || {}));
  const ventesVendu = React.useMemo(() => avecVentesEmail(ventes, ventesEmailCa), [ventes, ventesEmailCa]);
  const [datesLbc] = useLigneSynchro('vrm_lbc_dates', lireDatesLbc);
  const ventesVc = useVentesVestiaire();
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
    const vestiaire = ventesVc || [];
    const vf = ventesFaites({ vinted: ventesVendu || ventes, lbc, ebay, vestiaire, cachee: (o) => hTx.has(String(o && o.transaction_id)) || ecarte(uidDe(o)), excluAutre });
    const decl = ventesDeclarables({ vinted: ventes, lbc, ebay, vestiaire, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), excluAutre, versements: versements || {} });
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
      ...(ventesVc === null ? ['Vestiaire'] : []),
    ];
    const attente = lbcCoqueLu === undefined || ebayCommandes === undefined || ventesVc === undefined;
    // (1er nov., audits A2/A10) Les ventes dont l'argent ne se lit pas : dites, jamais 0 €.
    return { etat: 'lu', vendu: vf.lignes, finalise, recu, aDater, venduSansDate: vf.sansDate, venduEbayEcartees: vf.ecartees || 0, finSansDate, manque, attente, venduNonComptees: vf.nonComptees || [], recuNonComptees: (decl.ecartees || []).filter((x) => x && x.manque) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ventesVendu, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick, datesLbc, ventesVc, excluAutre]);
  const lignes = calc.etat === 'lu' ? caParPeriodes({ vendu: calc.vendu, finalise: calc.finalise, recu: calc.recu }, periode, 6) : null;
  const cur = lignes ? lignes[0] : null;
  // Les périodes d'avant, sans les plus anciennes toutes vides (même règle qu'avant).
  const lignesPassees = (() => { if (!lignes) return []; const L = lignes.slice(1); let n = L.length; while (n > 0 && ['vendu', 'finalise', 'recu'].every((k) => L[n - 1][k] && L[n - 1][k].n === 0)) n--; return L.slice(0, n); })();
  const partiel = calc.etat === 'lu' && (calc.manque.length > 0 || calc.attente || calc.venduNonComptees.length > 0 || calc.recuNonComptees.length > 0);
  // (30 oct.) Des ventes finalisées SANS date de versement ne sont dans aucune
  // période « reçu » : chaque « reçu » est alors un minimum, comme la prochaine
  // déclaration le dit (« au moins »), jamais un « 0,00 € » présenté comme vrai
  // (§5, une règle pour le « reçu pas su »).
  const recuMin = calc.etat === 'lu' && calc.aDater.length > 0;
  const montant = (x) => x == null ? '—' : fmt(x.eur);
  // (2 nov.) « Au moins 0,00 € » ne se dit jamais (§5) : un minimum nul s'écrit « — ».
  const minNul = (x, k) => (partiel || (k === 'recu' && recuMin)) && x != null && !(Number(x.eur) > 0);
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
          {!dansRepli && <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 12, background: `${C.accent}14`, color: C.accentTexte, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chart" size={16} /></span>}
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            {/* (29 oct., revue) Deux cartes, deux périodes : la phrase dit que ce
                choix ne vaut que pour CETTE carte (le bénéfice a le sien).
                (2 nov.) Dans « Le détail », le repli porte le titre. */}
            {!dansRepli && <div data-titre-carte-ca="" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{TITRE_CARTE_CA}</div>}
            <div data-ca-sa-periode="" style={{ fontSize: dansRepli ? 13 : 11, color: C.muted, marginTop: 1, lineHeight: 1.45 }}>{dansRepli ? <>Vendu : jour de la vente. Reçu : jour du versement (il se déclare).</> : 'Toutes plateformes · la période choisie ici ne vaut que pour cette carte.'}</div>
          </div>
          {/* (16 oct.) Le contrôle segmenté PARTAGÉ (`.vrm-seg`, celui des
              sous-onglets de plateforme) : plus de segment rempli d'accent. */}
          <nav role="group" aria-label="Période du chiffre d'affaires" className="vrm-seg" data-segment="" style={{ '--seg-ink': C.text, '--seg-muted': C.muted, '--seg-point': C.accent, flex: '1 1 260px', maxWidth: 360, margin: 0 }}>
            {PERIODES_CA.map(([k, l]) => (
              <button key={k} type="button" onClick={() => choisir(k)} aria-pressed={periode === k} aria-current={periode === k ? 'page' : undefined} data-ca-choix={k} className="vrm-seg-btn">{l}</button>
            ))}
          </nav>
        </div>
        {calc.etat !== 'lu' ? (
          <div style={{ padding: '16px', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun chiffre plutôt qu'un faux zéro."}
          </div>
        ) : (<>
          <div className="vrm-ca-periode-tuiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: `1px solid ${C.border}` }}>
            {COLS.map(([k, l, s], i) => (
              <div key={k} data-ca-cur={k} data-ca-eur={cur[k] == null ? '' : String(cur[k].eur)} data-ca-min={((partiel || (k === 'recu' && recuMin)) && cur[k] != null) ? '1' : undefined} style={{ padding: '14px 16px', borderLeft: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{l} · {cur.libelle}</div>
                <div className="vrm-display" style={{ fontSize: 20, fontWeight: 700, color: cur[k] == null || minNul(cur[k], k) ? C.muted : C.text, marginTop: 4, letterSpacing: -0.5 }}>{(partiel || (k === 'recu' && recuMin)) && cur[k] != null && !minNul(cur[k], k) ? <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>au moins </span> : null}{minNul(cur[k], k) ? '—' : montant(cur[k])}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cur[k] == null ? s : `${nb(cur[k])} · ${s}`}</div>
              </div>
            ))}
          </div>
          {/* (29 oct., revue) Sans période passée à montrer (« Année » quand
              les années d'avant sont vides), pas d'en-tête de tableau tout seul. */}
          {lignesPassees.length > 0 && <div style={{ overflowX: 'auto' }}>
            <table data-ca-table className="vrm-ca-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '9px 16px', fontSize: 11 }}>Période</th>
                  {COLS.map(([k, l]) => <th key={k} style={{ fontWeight: 600, padding: '9px 16px 9px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {lignesPassees.map((r) => (
                  <tr key={r.cle} data-ca-ligne={r.libelle} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap' }}>{r.libelle}</td>
                    {COLS.map(([k]) => <td key={k} data-ca-cellule={k} data-ca-min={((partiel || (k === 'recu' && recuMin)) && r[k] != null) ? '1' : undefined} style={{ padding: '9px 16px 9px 8px', textAlign: 'right', color: r[k] == null || minNul(r[k], k) ? C.muted : C.text, whiteSpace: 'nowrap' }}>{(partiel || (k === 'recu' && recuMin)) && r[k] != null && !minNul(r[k], k) ? <span style={{ color: C.muted, fontSize: 12 }}>au moins </span> : null}{minNul(r[k], k) ? '—' : montant(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          {(partiel || calc.aDater.length > 0 || calc.venduSansDate > 0 || calc.venduEbayEcartees > 0 || versements === null || calc.venduNonComptees.length > 0 || calc.recuNonComptees.length > 0) && (
            <div data-ca-couverture style={{ padding: '10px 16px 13px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
              {calc.manque.length > 0 && <div>Totaux partiels — sans {calc.manque.join(', ')} (pas pu lire) : chaque montant est un minimum.</div>}
              {!calc.manque.length && calc.attente && <div>Leboncoin ou eBay se lit encore : chaque montant est un minimum pour l'instant.</div>}
              {versements === null && <div>Dates de versement Vinted illisibles : « reçu » attend.</div>}
              {calc.aDater.length > 0 && <div>{calc.aDater.length} vente{calc.aDater.length > 1 ? 's' : ''} finalisée{calc.aDater.length > 1 ? 's' : ''} sans date de versement ({fmt(aDaterEur)}) : hors « reçu » pour l'instant.</div>}
              {calc.venduSansDate > 0 && <div>{calc.venduSansDate} vente{calc.venduSansDate > 1 ? 's' : ''} Leboncoin sans date de vente : dans aucune période — tu peux la dater ci-dessous.</div>}
              {/* (2 nov., audit des données G1) La commande eBay au montant pas lu est dans « non comptées » ci-dessous (une phrase, §7). */}
              {/* (1er nov., audits A2/A10) Des ventes faites dont l'argent ne se lit pas : dans AUCUNE colonne, dites (jamais 0 €). */}
              {calc.venduNonComptees.length > 0 && <div data-ca-non-comptees={calc.venduNonComptees.length}>Pas dans « vendu » : {phraseNonComptees(calc.venduNonComptees)} — chaque montant est un minimum.</div>}
              {calc.recuNonComptees.length > 0 && <div data-ca-recu-non-comptees={calc.recuNonComptees.length}>Pas dans « finalisé » ni « reçu » : {phraseNonComptees(calc.recuNonComptees)}.</div>}
            </div>
          )}
          {lbcCoqueLu === true ? <DaterVentesLbc ventes={(lbcVentes && lbcVentes.ventes) || []} dates={datesLbc}/> : null}
        </>)}
      </div>
    </Card>
  );
}
// ⟦← App.jsx #28⟧
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
  const regime = useRegimeFiscal();
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
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 12, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box' };
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-profil-fiscal={cfg === undefined ? 'encours' : cfg === null ? 'passu' : 'lu'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: C.card2 || C.bg, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="doc" size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Ton entreprise</div>
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Ton SIRET suffit : nom et adresse se remplissent.</div>
          </div>
          {statut && <span style={{ fontSize: 11, color: /⚠/.test(statut) ? C.warn : C.muted, whiteSpace: 'nowrap' }} data-profil-statut>{statut}</span>}
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cfg === undefined && <div style={{ fontSize: 13, color: C.muted }}>Je lis ton entité…</div>}
          {cfg === null && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 9px', marginRight: 6 }}>{REGLAGE_PAS_LU}</span>Base muette : rien à remplir pour ne rien écraser. Rouvre plus tard.</div>}
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
              {siren.etat === 'vide' ? 'Tape ton SIRET (14 chiffres, avis INSEE) : le nom suit.'
                : siren.etat !== 'ok' ? `Ce numéro ne semble pas valide : ${siren.raison}. Gardé tel quel : vérifie ton avis INSEE.`
                : !registre || registre.etat === 'encours' ? `${siren.type} valide — je cherche ton entreprise au registre…`
                : registre.etat === 'trouve' ? <>✓ Trouvée au registre des entreprises : <b className="vrm-sensible" data-stream-type="compte" style={{ color: C.text }}>{registre.nom}</b>{registre.ferme ? ' — le registre la dit fermée, vérifie ton numéro.' : '.'}{cfg.nom && cfg.nom !== registre.nom ? ' Tu as gardé ton propre nom : VRM ne le remplace pas.' : ''}</>
                : registre.etat === 'inconnu' ? `${siren.type} valide, mais aucune entreprise à ce numéro au registre public — tape le nom toi-même.`
                : `${siren.type} valide. Registre muet : tape le nom, ou reviens plus tard.`}
            </div>
          </>)}
          {/* (5 nov., chantier F, revue 2.27) Le statut ne se choisit plus ICI : un seul endroit,
              « Statut » (la question 2 tant qu'il n'est pas choisi, puis Déclarer →
              Statut · Changer). Reste le taux de cotisations, pour un micro-entrepreneur. */}
          {regime === 'micro' ? (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Taux de cotisations</span>
                <input type="text" inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} data-profil-taux aria-label="Taux de cotisations, en %"
                  onBlur={() => { const v = parseFloat(String(taux).replace(',', '.')); const ok = (isFinite(v) && v >= 0 && v <= 50) ? v : TAUX_URSSAF_DEFAUT; setTaux(virgule(ok)); save('vinted_urssaf_taux', ok); }}
                  style={{ ...inp, width: 72, padding: '6px 9px', fontWeight: 600, minHeight: 44 }} />
                <span style={{ fontSize: 13, color: C.muted }}>% du CA déclaré — celui que tu choisis, l'app ne le devine pas.</span>
              </div>
          </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ── FACTURATION ÉLECTRONIQUE — Factur-X et récap e-reporting (16 octobre) ────
// VRM PRÉPARE, le vendeur ENVOIE depuis sa plateforme agréée gratuite : aucune
// connexion à une plateforme, aucune fonction payante (§2.9). Les règles vivent
// dans `src/facturationElectronique.js` ; les ventes viennent de
// `ventesDeclarables` (datées au versement, comme le CA déclaré) — AUCUNE règle
// de vente n'est écrite ici (§11). Le numéro de facture : une série par année
// (`FX-AAAA-0001`), rangée dans `vrm_compta.facturx` (synchronisé), donnée UNE
// fois par vente (regénérer la même vente redonne le même numéro et la même
// date). ⚠️ Tant que le nuage n'est pas arrivé, on ne numérote pas : un appareil
// neuf repartirait de 0001 et doublerait un numéro déjà donné.
const ymListe = (n = 12, maintenant = Date.now()) => { const out = []; const d = new Date(maintenant); d.setDate(1); for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); } return out; };
const libelleYm = (ym) => { const [a, m] = String(ym).split('-'); return `${MOIS_COMPTA[Number(m) - 1] || ''} ${a}`; };
// ⟦← App.jsx #29⟧
// ── (3 nov.) LES VENTES DÉCLARABLES DE COMPTABILITÉ — une lecture, deux cartes ──
// Factur-X et les registres (livre des recettes) lisent les MÊMES ventes, par la
// MÊME règle (`ventesDeclarables`, datées au versement) et les MÊMES comptes
// écartés (`compteEcarte`, `excluAutre`). Pure : `scripts/audit-registres.cjs`
// l'EXÉCUTE. Les ventes Vinted ne passent que si les dates de versement sont
// lues (sinon une vente serait datée à tort).
const declarablesCompta = ({ ventes, ko, lbc = [], ebay = [], vestiaire = [], rates = [], versements, hTx, hAcc, panelOff, excluAutre, loginDe = (u) => String(u) }) => {
  const ecarte = (uid) => compteEcarte(uid, hAcc, panelOff || {});
  const uidDe = (o) => o && o._acc && o._acc.vinted_user_id;
  const decl = ventesDeclarables({ vinted: versements ? ventes : [], lbc, ebay, vestiaire, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), excluAutre, versements: versements || {} });
  // (1er nov., audits A2/A10) Vestiaire pas lu, et les ventes dont l'argent ne
  // se lit pas : NOMMÉES dans ce qui manque (jamais un total partiel complet).
  const ncER = phraseNonComptees((decl.ecartees || []).filter((x) => x && x.manque));
  const manque = [...(ko || []).filter((uid) => !ecarte(uid)).map(loginDe), ...rates, ...(ncER ? [ncER] : [])];
  return { decl, manque };
};
function useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const excluAutre = useExcluAutre();
  const { ventes, ko } = useVentesCoque();
  const [datesLbc] = useLigneSynchro('vrm_lbc_dates', lireDatesLbc);
  const ventesVcER = useVentesVestiaire();
  const [versements, setVersements] = React.useState(undefined);
  React.useEffect(() => { let mort = false; fetchVersementsVinted().then((m) => { if (!mort) setVersements(m); }).catch(() => { if (!mort) setVersements(null); }); return () => { mort = true; }; }, []);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_sales_hidden' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const calc = React.useMemo(() => {
    if (ventes === undefined) return { etat: 'encours' };
    if (!Array.isArray(ventes)) return { etat: 'passu' };
    const hTx = new Set(VENTES_MASQUEES_AUCUNE().map(String));
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const loginDe = (uid) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === String(uid)); return (a && a.login) || String(uid); };
    const lbc = lbcCoqueLu === true ? avecDatesLbc(((lbcVentes && lbcVentes.ventes) || []), datesLbc) : [];
    const ebay = Array.isArray(ebayCommandes) ? ebayCommandes : [];
    const rates = [...(lbcCoqueLu === null ? ['Leboncoin'] : []), ...(ebayCommandes === null ? ['eBay'] : []), ...(ventesVcER === null ? ['Vestiaire'] : [])];
    const { decl, manque } = declarablesCompta({ ventes, ko, lbc, ebay, vestiaire: ventesVcER || [], rates, versements, hTx, hAcc, panelOff, excluAutre, loginDe });
    return { etat: 'lu', decl, manque, attente: lbcCoqueLu === undefined || ebayCommandes === undefined || versements === undefined || ventesVcER === undefined };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick, datesLbc, ventesVcER, excluAutre]);
  return { calc, versements };
}
// ── (3 nov.) LES REGISTRES : LIVRE DES RECETTES ET REGISTRE DES ACHATS ──────
// Les règles vivent dans src/registres.js. Les recettes = `useDeclarablesCompta`
// (la MÊME lecture que Factur-X, datée au versement) ; le N° et le compte d'une
// vente viennent du relevé de Ventes (`vrm_stats_ventes`, par identité) et de
// la vente elle-même. Les achats sont lus comme « Exporter mes données » :
// paginés (`lireTout`), PROJETÉS (jamais `select=data`), avec leur reçu relié
// par SON n° de transaction. Une lecture ratée ⇒ « — » et le manque nommé.
// (6 nov., vitesse 2) Seulement les achats des comptes LIÉS (`lireAchatsLies`), comme
// les recettes d'à côté (`useVentesCoque`, comptes liés) : la liste des comptes lue
// d'abord. Illisible ⇒ tous, comme avant ; réponse vide ⇒ relue par motif (§4.1).
const lireAchatsRegistre = async () => {
  const comptesLus = fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login`, { headers: sbAuth() }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [lignes, comptesV] = await Promise.all([
    comptesLus.then((c) => lireAchatsLies(Array.isArray(c) ? uidsLies(c) : null)),
    comptesLus,
  ]);
  if (!Array.isArray(lignes)) return null;
  const login = new Map((Array.isArray(comptesV) ? comptesV : []).map((c) => [String(c.vinted_user_id), String(c.login || '')]));
  return lignes.flatMap((r) => { const k = /^harvest_(\d+)_orders_purchased$/.exec(String((r && r.id) || '')); const uid = k ? k[1] : ''; return (Array.isArray(r && r.orders) ? r.orders : []).map((o) => ({ ...o, _uid: uid, compte: login.get(uid) || uid })); });
};
// Le registre des achats d'une période : UNE écriture pour la carte « Registres » et
// « Exporter pour mon comptable » (9 nov.) — mêmes fiches, mêmes reçus, mêmes comptes écartés.
const registreAchatsDe = ({ achats, recus, periode, panelOff }) => {
  const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
  const delies = load('vrm_recus_delies', {}) || {};
  const index = indexRecusParTransaction(Array.isArray(recus) ? recus.filter((r) => !(r && r.id && delies[r.id])) : recus, (r) => ventilationRecuAchat(r && r.texte).trouve);
  let fiches = null; try { fiches = load('vinted_annonce_numeros', {}) || {}; } catch (_) { fiches = null; }
  // (5 nov.) Les achats en gros (Achats → Fournisseurs) : UNE ligne chacun, par
  // leur total + frais, lus par LA règle du registre (`lireRegistre`).
  // (10 nov., lot BH) Un achat hors plateforme masqué comme DOUBLE d'un autre n'est pas compté deux fois.
  return registreDesAchats({ achats, hors: horsVisibles(load('vinted_offvinted_buys', []) || [], load(CLE_HORS_MASQUES, []) || []), fiches, periode,
    ventilationDe: (tx) => { const r = index.get(String(tx)); return r ? ventilationRecuAchat(r.texte) : null; },
    exclu: (o) => compteEcarteChoix(o && o._uid, hAcc, panelOff || {}), montantHors: prixAchatHorsNombre, sourceHors: libelleSourceAchat,
    gros: lireRegistre(load(CLE_FOURNISSEURS, null)), cleNum,
    manque: recus === null ? ['reçus d’achat'] : [] });
};
// Les recettes d'une période : la carte « Registres » et l'export comptable (même lecture).
const recettesDe = ({ calc, periode, versements, lbcVentes, ebayCommandes, ventesVcER }) => {
  const rel = lireReleveVentes();
  const parId = new Map();
  for (const l of ((rel && rel.l) || [])) if (Array.isArray(l)) parId.set(l[0] === 'Vinted' ? 'vinted:' + l[2] : String(l[2]), l);
  const compteAutre = new Map();
  for (const v of ((lbcVentes && lbcVentes.ventes) || [])) if (v && v.txId) compteAutre.set('lbc:' + v.txId, compteDeVente('leboncoin', v) || '');
  for (const o of (Array.isArray(ebayCommandes) ? ebayCommandes : [])) if (o && o.orderId) compteAutre.set('ebay:' + o.orderId, compteDeVente('ebay', o) || '');
  for (const v of (ventesVcER || [])) if (v && v.id) { const c = compteDeVente('vestiaire', v); compteAutre.set('vestiaire:' + v.id, c && c !== '-' ? c : ''); }
  const parLigne = new Map([...calc.decl.lignes, ...(calc.decl.aDater || [])].filter((l) => l && l.o).map((l) => [String(l.id), l.o]));
  const compteDe = (id) => { const o = parLigne.get(id); if (o && o._acc) return o._acc.login || String(o._acc.vinted_user_id || ''); const r = parId.get(id); return (r && r[1]) || compteAutre.get(id) || ''; };
  const numDe = (id) => { const r = parId.get(id); return (r && r[8]) || ''; };
  return livreDesRecettes({ decl: calc.decl, periode, numDe, compteDe, manque: [...calc.manque, ...(versements === null ? ['dates de versement Vinted'] : [])] });
};
function RegistresCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { calc, versements } = useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts });
  const ventesVcER = useVentesVestiaire();
  const an = new Date().getFullYear();
  const periodes = React.useMemo(() => [String(an), String(an - 1), ...ymListe(13)], [an]);
  const [periode, setPeriode] = React.useState(String(an));
  // Achats : undefined en cours · null pas su · tableau lu. Reçus : idem (un reçu pas lu ⇒ « article seul »).
  const [achats, setAchats] = React.useState(undefined);
  const [recus, setRecus] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireAchatsRegistre().then((a) => { if (!mort) setAchats(a); }).catch(() => { if (!mort) setAchats(null); });
    fetchEmailAchats().then((r) => { if (!mort) setRecus(recusAchatDe(r)); }).catch(() => { if (!mort) setRecus(null); });
    return () => { mort = true; };
  }, []);
  const [enCours, setEnCours] = React.useState('');
  // Un achat en gros, un rattachement, une fiche reliée changés (ici ou sur un
  // autre appareil) : le registre des achats se relit.
  const [ticAchats, setTicAchats] = React.useState(0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === CLE_FOURNISSEURS || k === 'vinted_annonce_numeros' || k === 'vinted_offvinted_buys' || k === CLE_HORS_MASQUES) setTicAchats((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const recettes = React.useMemo(() => {
    if (calc.etat !== 'lu') return calc.etat === 'passu' ? null : undefined;
    return recettesDe({ calc, periode, versements, lbcVentes, ebayCommandes, ventesVcER });
  }, [calc, periode, versements, lbcVentes, ebayCommandes, ventesVcER]);
  const registreAchats = React.useMemo(() => (achats === undefined ? undefined : registreAchatsDe({ achats, recus, periode, panelOff })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [achats, recus, periode, panelOff, ticAchats]);
  const exporter = async (R, forme) => {
    if (!R || enCours) return;
    setEnCours(R.type + forme);
    try {
      let ent = null; try { ent = await lireReglage('vrm_pro_facture'); } catch (_) { ent = null; }
      const entreprise = ent && String(ent.nom || '').trim() ? { nom: String(ent.nom).trim(), siret: String(ent.siret || '').trim() } : null;
      if (forme === 'csv') telechargerFichier(new Blob([csvRegistre(R, { entreprise })], { type: 'text/csv;charset=utf-8' }), nomFichierRegistre(R, 'csv'), 'text/csv;charset=utf-8');
      else telechargerFichier(new Blob([await pdfRegistre(R, { entreprise })], { type: 'application/pdf' }), nomFichierRegistre(R, 'pdf'), 'application/pdf');
    } catch (err) { toast('Registre pas créé : ' + ((err && err.message) || err)); }
    setEnCours('');
  };
  const ligne = (type, nom, R) => (
    <div className="vrm-registre" data-registre={type} data-registre-etat={R === undefined ? 'encours' : R === null ? 'passu' : 'lu'}
      data-registre-n={R ? R.n : ''} data-registre-total={R ? String(Math.round(R.total * 100)) : ''} data-registre-sans-montant={R ? R.sansMontant : ''}
      data-registre-partiel={R ? (R.complet ? '0' : '1') : ''} data-registre-hors={R ? R.horsPeriode.length : ''}
      data-registre-gros={R && R.type === 'achats' ? R.nGros : ''} data-registre-a-verifier={R && R.type === 'achats' ? R.aVerifier : ''}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text }}>{nom}</span>
        <span className="vrm-display" style={{ display: 'block', fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          {R === undefined ? '…' : R === null ? '—' : `${R.n} · ${R.complet ? '' : 'au moins '}${fmt(R.total)}${R.type === 'achats' && R.nGros ? ` · dont ${R.nGros} achat${R.nGros > 1 ? 's' : ''} en gros` : ''}`}
          {R && R.type === 'achats' && R.aVerifier ? <span data-registre-a-verifier-txt="" style={{ color: C.warn }}> · {R.aVerifier} à vérifier (N° aussi dans un achat en gros)</span> : null}
        </span>
      </span>
      <span style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
        <Bouton variante="secondaire" icone="doc" data-registre-pdf={type} aria-label={`Télécharger « ${nom} » en PDF`} title={`Télécharger « ${nom} » en PDF`} disabled={!R || !!enCours} onClick={() => exporter(R, 'pdf')}>{enCours === type + 'pdf' ? '…' : 'PDF'}</Bouton>
        <Bouton variante="secondaire" icone="save" data-registre-csv={type} aria-label={`Télécharger « ${nom} » en tableur`} title={`Télécharger « ${nom} » en tableur (Excel, Numbers)`} disabled={!R || !!enCours} onClick={() => exporter(R, 'csv')}>{enCours === type + 'csv' ? '…' : 'Tableur'}</Bouton>
      </span>
    </div>
  );
  return (
    <Card><div className="vrm-registres" data-registres={periode}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span data-titre-section="" style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: -0.15, flex: '1 1 auto' }}>Registres</span>
        <select aria-label="Période des registres" data-registres-periode="" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 15, padding: '0 10px', fontFamily: 'inherit' }}>
          {periodes.map((p) => <option key={p} value={p}>{p.length === 4 ? p : libelleYm(p)}</option>)}
        </select>
      </div>
      {ligne('recettes', 'Livre des recettes', recettes)}
      {ligne('achats', 'Registre des achats', registreAchats)}
    </div></Card>
  );
}
// ── (9 nov.) « EXPORTER POUR MON COMPTABLE » (src/exportComptable.js) ──────────
// Une période (mois, trimestre, année) ⇒ un tableur (CSV pour Excel) et un PDF d'une
// page. AUCUNE règle ici : les ventes = `recettesDe` (le livre des recettes, la même
// lecture que « Registres »), les achats = `registreAchatsDe`, le CA déclaré = la ligne
// publiée par Ventes et `montantPeriodeUrssaf` (la carte « Prochaine déclaration »),
// l'URSSAF = `aPayerUrssaf` pour un micro-entrepreneur seulement (`useRegimeFiscal`).
// Rien n'est lu tant qu'il n'a pas ouvert la carte (« Préparer »).
function ExportComptableCarte(props) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <Card><div className="vrm-export-comptable" data-export-comptable={ouvert ? 'ouvert' : 'ferme'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div data-titre-section="" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: -0.15 }}>Exporter pour mon comptable</div>
          <div style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>Ventes, achats, CA déclaré et URSSAF d’une période, en tableur et en PDF.</div>
        </div>
        {!ouvert && <Bouton variante="secondaire" icone="doc" data-export-preparer="" onClick={() => setOuvert(true)}>Préparer</Bouton>}
      </div>
      {ouvert && <ExportComptableCorps {...props} />}
    </div></Card>
  );
}
function ExportComptableCorps({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { calc, versements } = useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts });
  const ventesVcER = useVentesVestiaire();
  const ligne = useLigneUrssaf();
  const regime = useRegimeFiscal();
  const [type, setType] = React.useState('trimestre');
  const choix = React.useMemo(() => periodesExport(type), [type]);
  const [periode, setPeriode] = React.useState(() => periodesExport('trimestre')[0]);
  React.useEffect(() => { if (!choix.includes(periode)) setPeriode(choix[0]); }, [choix, periode]);
  const [achats, setAchats] = React.useState(undefined);
  const [recus, setRecus] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireAchatsRegistre().then((a) => { if (!mort) setAchats(a); }).catch(() => { if (!mort) setAchats(null); });
    fetchEmailAchats().then((r) => { if (!mort) setRecus(recusAchatDe(r)); }).catch(() => { if (!mort) setRecus(null); });
    return () => { mort = true; };
  }, []);
  // (10 nov., lot AN) Les factures d'achat jointes (liste sans contenu) : mentionnées sur leur ligne d'achat ; pas lues ⇒ aucune mention.
  const [facturesJointes, setFacturesJointes] = React.useState(null);
  React.useEffect(() => { let mort = false; lireFactures({ fetch: (...a) => fetch(...a), url: SUPABASE_URL, auth: sbAuth }).then((m) => { if (!mort) setFacturesJointes(m); }); return () => { mort = true; }; }, []);
  const pret = calc.etat !== 'encours' && achats !== undefined && recus !== undefined && regime !== undefined;
  const D = React.useMemo(() => {
    if (!pret) return undefined;
    const recettes = calc.etat === 'lu' ? recettesDe({ calc, periode, versements, lbcVentes, ebayCommandes, ventesVcER }) : null;
    const registre = registreAchatsDe({ achats, recus, periode, panelOff });
    return donneesExportComptable({ periode, recettes, achats: registre, ligne, regime, taux: tauxUrssaf(), montantPeriode: montantPeriodeUrssaf, aPayer: aPayerUrssaf, libelleRegime, factures: facturesJointes });
  }, [pret, calc, periode, versements, lbcVentes, ebayCommandes, ventesVcER, achats, recus, panelOff, ligne, regime, facturesJointes]);
  const [enCours, setEnCours] = React.useState('');
  const telecharger = async (forme) => {
    if (!D || enCours) return;
    setEnCours(forme);
    try {
      let ent = null; try { ent = await lireReglage('vrm_pro_facture'); } catch (_) { ent = null; }
      const d = ent && String(ent.nom || '').trim() ? { ...D, entreprise: { nom: String(ent.nom).trim(), siret: String(ent.siret || '').trim() } } : D;
      if (forme === 'csv') telechargerFichier(new Blob([csvExportComptable(d)], { type: 'text/csv;charset=utf-8' }), nomFichierExport(periode, 'csv'), 'text/csv;charset=utf-8');
      else telechargerFichier(new Blob([await pdfExportComptable(d)], { type: 'application/pdf' }), nomFichierExport(periode, 'pdf'), 'application/pdf');
    } catch (err) { toast('Export pas créé : ' + ((err && err.message) || err)); }
    setEnCours('');
  };
  const cv = D ? couvertureExport(D) : [];
  const cts = (x) => (x == null ? '' : String(Math.round(x * 100)));
  return (
    <div style={{ marginTop: 12 }} data-export-periode={periode} data-export-etat={D === undefined ? 'encours' : 'lu'}
      data-export-ca={D ? cts(D.caDeclare) : ''} data-export-urssaf={D ? cts(D.urssaf) : ''} data-export-ventes-total={D ? cts(D.totalVentes) : ''}
      data-export-ventes-n={D && D.nVentes != null ? D.nVentes : ''} data-export-achats-n={D && D.nAchats != null ? D.nAchats : ''}
      data-export-sans-cout={D && D.sansCout != null ? D.sansCout : ''} data-export-adater={D && D.nADater != null ? D.nADater : ''}>
      <Segmente label="Période de l’export" value={type} onChange={setType} options={TYPES_PERIODE.map(([v, l]) => ({ v, l, data: { 'data-export-type': v } }))} />
      <select aria-label="Période" data-export-choix="" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ marginTop: 10, width: '100%', height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 15, padding: '0 10px', fontFamily: 'inherit' }}>
        {choix.map((p) => <option key={p} value={p}>{libellePeriode(p)}</option>)}
      </select>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {D === undefined ? <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>Je lis tes ventes et tes achats…</div>
          : resumeExport(D).map(([k, v, cle]) => (
            <div key={cle} data-export-ligne={cle} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 14 }}>
              <span style={{ color: C.muted }}>{k}</span><span className="vrm-display" style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v}</span>
            </div>))}
      </div>
      {cv.length > 0 && <ul data-export-manque={cv.length} style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{cv.map((c) => <li key={c}>{c}</li>)}</ul>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Bouton variante="primaire" icone="save" data-export-csv="" disabled={!D || !!enCours} onClick={() => telecharger('csv')} style={{ flex: '1 1 140px' }} title="Un fichier pour Excel ou Numbers">{enCours === 'csv' ? '…' : 'Tableur (Excel)'}</Bouton>
        <Bouton variante="secondaire" icone="doc" data-export-pdf="" disabled={!D || !!enCours} onClick={() => telecharger('pdf')} style={{ flex: '1 1 140px' }}>{enCours === 'pdf' ? '…' : 'PDF d’une page'}</Bouton>
      </div>
    </div>
  );
}
// ── (5 nov.) DAC7 COMPTE PAR COMPTE — Comptabilité → Le détail → « DAC7 » ──
// Julien : « mettre les rapports DAC7 pour chaque compte, capter tout ce qu'on
// peut ». La règle : src/dac7Comptes.js (les cartes) et src/seuilsAnnee.js (le
// seuil, partagé avec « DAC7 par plateforme »). Les ventes : `useDeclarablesCompta`,
// la MÊME lecture que les registres et le CA déclaré (datées au versement,
// comptes exclus dehors). Le compte d'une vente : celui qu'elle PORTE
// (`indexComptesVentes`). Les comptes connus : Vinted (`accounts`) et les
// autres sites (`useComptesAutresSites`, l'écran Comptes liés). Lectures
// PROJETÉES : les sujets d'e-mails fiscaux (filtrés par la base, jamais
// `select=data`) et `taxpayer_restricted` du porte-monnaie Vinted.
const ETAT_LECTURE = (v, lu) => (v === undefined ? 'encours' : lu ? 'lu' : 'passu');
const MOTS_FISCAUX = ['dac', 'fiscal', 'impot', 'impôt', 'contribuable', 'taxpayer', 'recapitulatif', 'récapitulatif', 'releve annuel', 'relevé annuel', 'rapport annuel'];
const lireEmailsFiscaux = async () => {
  // ⚠️ `meta->>` (migration 004), jamais `data->>` : filtrer sur `data` décompresse
  //    chaque ligne `email_*`, bordereaux et leurs PDF compris (§5). Mesuré le 5 nov. :
  //    35 527 blocs lus et 115 ms par `data`, 5 807 et 30 ms par `meta`, mêmes lignes.
  const ou = MOTS_FISCAUX.map((m) => `meta->>subject.ilike.*${m}*`).join(',');
  const q = `id=like.email_*&or=(${encodeURIComponent(ou)})&select=id,s:meta->>subject,f:meta->>from,to:meta->>to,at:meta->>receivedAt`;
  const l = await lireTout(q).catch(() => null);
  return Array.isArray(l) ? l : null;
};
function Dac7ComptesCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { calc, versements } = useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts });
  const { ventes, ko } = useVentesCoque();
  const ventesVcER = useVentesVestiaire();
  const [autres] = useComptesAutresSites();
  const [exclusAutres] = useComptesExclus();
  const an = new Date().getFullYear();
  const annees = React.useMemo(() => [an, an - 1], [an]);
  const [annee, setAnnee] = React.useState(an);
  const [emailsLus, setEmailsLus] = React.useState(undefined);
  const [billing, setBilling] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireEmailsFiscaux().then((l) => { if (!mort) setEmailsLus(l); }).catch(() => { if (!mort) setEmailsLus(null); });
    lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_billing&select=id,tr:data->payload->>taxpayer_restricted,cap:data->>capturedAt`)
      .then((b) => { if (!mort) setBilling(Array.isArray(b) ? b : null); }).catch(() => { if (!mort) setBilling(null); });
    return () => { mort = true; };
  }, []);
  const [enCours, setEnCours] = React.useState('');
  const R = React.useMemo(() => {
    if (calc.etat === 'encours') return { etat: 'encours', annee };
    if (calc.etat !== 'lu') return { etat: 'passu', annee };
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const labels = load('vinted_account_labels', {}) || {};
    const nomVinted = (uid, login) => labels[uid] || login || uid;
    const ecarteV = (uid) => compteEcarte(uid, hAcc, panelOff || {});
    const ex = exclusNormes(exclusAutres);
    const P = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
    const comptes = [], exclus = [], nomsAutres = {};
    for (const a of (accounts || [])) {
      if (!a || a.vinted_user_id == null) continue;
      const uid = String(a.vinted_user_id);
      const c = { plateforme: 'Vinted', cle: uid, nom: nomVinted(uid, a.login) };
      (ecarteV(uid) ? exclus : comptes).push(c);
    }
    for (const [k, nomP] of Object.entries(P)) {
      for (const c of ((autres && autres[k]) || [])) {
        if (!c || !c.id) continue;
        nomsAutres[`${nomP}|${c.id}`] = c.nom || '';
        (ex[k] && ex[k].has(String(c.id)) ? exclus : comptes).push({ plateforme: nomP, cle: String(c.id), nom: nomCompteLie(c) });
      }
    }
    const lbc = lbcCoqueLu === true ? ((lbcVentes && lbcVentes.ventes) || []) : [];
    const index = indexComptesVentes({ vinted: Array.isArray(ventes) ? ventes : [], lbc, ebay: Array.isArray(ebayCommandes) ? ebayCommandes : [], vestiaire: ventesVcER || [],
      nomVinted, nomAutre: (p, cle) => nomsAutres[`${p}|${cle}`] || '' });
    const rel = lireReleveVentes();
    const numParId = new Map();
    for (const l of ((rel && rel.l) || [])) if (Array.isArray(l)) numParId.set(l[0] === 'Vinted' ? 'vinted:' + l[2] : String(l[2]), l[8] || '');
    const etats = {
      Vinted: versements === undefined ? 'encours' : versements === null ? 'passu' : 'lu',
      Leboncoin: ETAT_LECTURE(lbcCoqueLu, lbcCoqueLu === true),
      eBay: ETAT_LECTURE(ebayCommandes, Array.isArray(ebayCommandes)),
      Vestiaire: ETAT_LECTURE(ventesVcER, Array.isArray(ventesVcER)),
    };
    return dac7ParCompte({ decl: calc.decl, annee, compteDe: (id) => index.get(id) || null, comptes, etats,
      comptesKO: (ko || []).map((uid) => ({ plateforme: 'Vinted', cle: String(uid) })), exclus, numDe: (id) => numParId.get(id) || '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc, annee, versements, ventes, ko, ventesVcER, autres, exclusAutres, accounts, panelOff, lbcVentes, lbcCoqueLu, ebayCommandes]);
  const emails = React.useMemo(() => (emailsLus === undefined ? undefined : emailsFiscaux(emailsLus, annee)), [emailsLus, annee]);
  const blocages = React.useMemo(() => (Array.isArray(billing) ? blocagesFiscauxVinted(billing) : null), [billing]);
  const exporter = async (k, forme) => {
    const id = `${k.plateforme}|${k.cle}`;
    if (enCours || k.etat !== 'lu') return;
    setEnCours(id + forme);
    try {
      let ent = null; try { ent = await lireReglage('vrm_pro_facture'); } catch (_) { ent = null; }
      const entreprise = ent && String(ent.nom || '').trim() ? { nom: String(ent.nom).trim(), siret: String(ent.siret || '').trim() } : null;
      if (forme === 'csv') telechargerFichier(new Blob([csvDac7(k, annee, { entreprise })], { type: 'text/csv;charset=utf-8' }), nomFichierDac7(k, annee, 'csv'), 'text/csv;charset=utf-8');
      else telechargerFichier(new Blob([await pdfDac7(k, annee, { entreprise })], { type: 'application/pdf' }), nomFichierDac7(k, annee, 'pdf'), 'application/pdf');
    } catch (err) { toast('Export DAC7 pas créé : ' + ((err && err.message) || err)); }
    setEnCours('');
  };
  return <Dac7Comptes R={R} annee={annee} annees={annees} onAnnee={setAnnee} emails={emails} blocages={blocages} onExport={exporter} enCours={enCours} />;
}
function FacturationElectroniqueCarte({ data, maj, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  // (3 nov.) Les ventes déclarables : la lecture partagée avec les registres (`useDeclarablesCompta`).
  const { calc, versements } = useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts });
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
  const [regime, setRegime] = useStateCle('vinted_regime', () => load('vinted_regime', null));
  const [nuage, setNuage] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => { setNuage(true); setRegime(load('vinted_regime', null)); }), []);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_regime') setRegime(load('vinted_regime', null)); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
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

  const chip = (icon) => <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 12, background: `${C.accent}14`, color: C.accentTexte, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} /></span>;
  const btn2 = (actif) => ({ border: `1px solid ${C.border}`, background: C.card, color: actif ? C.text : C.muted, borderRadius: 12, padding: '8px 13px', fontSize: 13, fontWeight: 600, cursor: actif ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: actif ? 1 : 0.6 });
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
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Connecte Super PDP, ou dépose les fichiers toi-même.</div>
          </div>
          <select value={ym} onChange={(e) => { setYm(e.target.value); setMsg(''); }} aria-label="Mois" data-fe-mois
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 12, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            {mois.map((m) => <option key={m} value={m}>{libelleYm(m)}</option>)}
          </select>
        </div>

        <div className="vrm-fe-trois" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', borderBottom: `1px solid ${C.border}` }}>
          {[
            ['Ce que VRM prépare', 'Une facture Factur-X par vente, le récap mensuel aux particuliers (e-reporting).'],
            ["Où l'envoyer", "Super PDP : connecte TON compte ci-dessous. Ailleurs : dépose-les toi-même."],
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
          {spdp === null && <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>Connexion Super PDP pas lue : ni « connecté », ni « pas connecté ». <button type="button" onClick={() => { setSpdp(undefined); relireSpdp(); }} style={{ ...btn2(true), padding: '4px 10px', marginLeft: 4 }}>Réessayer</button></div>}
          {spdp && spdp.connecte && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ flex: '1 1 220px', fontSize: 13, color: C.text, lineHeight: 1.5 }} data-spdp-env={spdp.env}>
              <strong>Connecté à Super PDP</strong> · {ENV_LIBELLE[spdp.env] || spdp.env}{spdp.env === 'sandbox' ? ' (rien ne part réellement aux impôts)' : ''}
              <div className="vrm-aide" style={{ fontSize: 11, color: C.muted }}>Tes identifiants restent chiffrés sur le serveur. <Pourquoi label="L'environnement ?">Ce choix est celui que tu as déclaré : c'est ton compte Super PDP qui décide de l'environnement.</Pourquoi></div>
            </div>
            <button type="button" data-spdp-deconnecter disabled={!!spOccupe} onClick={deconnecterSpdp} style={btn2(!spOccupe)}>{spOccupe === 'deconnexion' ? '…' : 'Déconnecter'}</button>
          </div>}
          {spdp && !spdp.connecte && <div style={{ marginTop: 8 }}>
            {spdp.illisible && <div data-spdp-illisible style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Ta connexion Super PDP ne se lit plus côté serveur (sa clé a changé) : reconnecte-la.</div>}
            {spdp.coffre === false && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Le serveur n'a pas de coffre configuré : aucune clé ne peut être rangée pour l'instant.</div>}
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Colle l'identifiant et le secret de TON compte Super PDP. Il facture ses envois, pas VRM. <Pourquoi label="Où les trouver ?">Dans l'espace développeur de ton compte Super PDP. Ils partent une seule fois au serveur, chiffrés ; VRM ne te les remontrera jamais.</Pourquoi></div>
            <div role="radiogroup" aria-label="Environnement" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[['sandbox', 'Bac à sable'], ['production', 'Production']].map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={spEnv === k} data-spdp-choix={k} onClick={() => setSpEnv(k)}
                  style={{ ...btn2(true), borderColor: spEnv === k ? C.accent : C.border, color: spEnv === k ? C.accent : C.text }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <input data-spdp-id value={spId} onChange={(e) => setSpId(e.target.value)} placeholder="Identifiant client (client_id)" autoComplete="off" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 12, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
              <input data-spdp-secret type="password" value={spSecret} onChange={(e) => setSpSecret(e.target.value)} placeholder="Secret client (client_secret)" autoComplete="new-password" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 12, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
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
              {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun total plutôt qu'un faux zéro."}
            </div>
          ) : (<div data-fe-recap data-recap-ym={ym} data-recap-total={eurDe(recap.centimes)} data-recap-n={recap.n} data-recap-partiel={recap.partiel ? '1' : '0'}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <div className="vrm-display" style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: -0.6 }}>
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
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>Toutes tes ventes du mois y sont : retire celles faites à une entreprise. <Pourquoi>VRM ne sait pas si un acheteur est une entreprise. Une vente à une entreprise demande une facture, pas ce récapitulatif.</Pourquoi></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" onClick={() => exporter('csv')} data-fe-recap-csv style={btn2(true)} title="Le récapitulatif des factures, pour Excel ou Numbers"><Icon name="save" size={14} />Récap en tableur</button>
              <button type="button" onClick={() => exporter('json')} data-fe-recap-json style={btn2(true)} title="Le même récapitulatif, au format JSON (pour un logiciel de compta)"><Icon name="save" size={14} />Récap JSON</button>
            </div>
            {spdp && spdp.connecte && <div data-spdp-recap style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>Le récapitulatif ne part pas tout seul : dépose-le toi-même sur Super PDP. <Pourquoi>La forme de son envoi par l'API n'a pas pu être vérifiée dans la documentation officielle de Super PDP.</Pourquoi></div>}
          </div>)}
        </div>

        {/* ── FACTURES FACTUR-X ── */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Factures Factur-X · ventes de {libelleYm(ym)}</div>
          {raisonGrise && <div data-fe-raison style={{ marginTop: 8, fontSize: 13, color: C.text, lineHeight: 1.55, border: `1px solid ${C.border}`, background: C.bg, borderRadius: 12, padding: '10px 12px' }}>
            {raisonGrise}{!etat.ok && etat.geste ? <span style={{ color: C.muted }}> {etat.geste}</span> : null}
          </div>}
          {etat.ok && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Vendeur : {etat.vendeur.nom} · SIREN {etat.vendeur.siren} · « {etat.vendeur.mention} ». Acheteur : le nom porté par la vente, sinon « Particulier ».</div>}
          {recap && recap.lignes.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Aucune vente datée sur ce mois{recap.partiel ? ' (avec ce qui a pu être lu)' : ''}.</div>}
          {recap && recap.lignes.length > 0 && <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 10 }}>
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
          <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Numéros FX-AAAA-0001, continus par année ; une vente garde le sien. <Pourquoi label="Fichier conforme ?">La conformité du fichier n'a pas été validée par un outil officiel : ta plateforme le vérifiera au dépôt.</Pourquoi></div>
        </div>
      </div>
    </Card>
  );
}
// ⟦← App.jsx #30⟧
const MOIS_NOMS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// ── TON STATUT (27 octobre) — la carte qui ADAPTE Comptabilité à la personne ──
// Jamais choisi ⇒ la question, posée ICI (pas au démarrage, rien n'est forcé).
// Micro-entrepreneur ⇒ la carte URSSAF, et le taux composé à partir de SES
// options (versement libératoire, ACRE la première année) — les vrais taux de
// l'achat-revente (`TAUX_MICRO`), toujours modifiables à la main dans Réglages.
// Particulier, société, régime de la marge ⇒ AUCUNE cotisation estimée, et une
// phrase qui dit pourquoi (un particulier lit aussi les seuils de Vinted).
// (29 oct., revue) `apresMois` : ce que Comptabilité veut voir JUSTE après la
// carte URSSAF du mois (ses dépenses), avant le suivi et « Ta micro-entreprise »
// — rendu dans TOUS les états (statut en lecture, pas choisi, autre régime) :
// les dépenses ne disparaissent jamais avec le statut.
// (2 nov., « surtout comptabilité ») L'écran répond à trois questions dans
// l'ordre ; ce composant y est rendu en TROIS endroits (`partie`), chacun sa
// place : `declarer` (la question 2 : la carte URSSAF, ou la question du
// statut, ou la phrase d'un autre régime), `suivi` (dans « Le détail » : les
// déclarations passées et « Ta micro-entreprise »), `statut` (dans « Documents
// et réglages » : le statut et « Changer »). Aucune règle ne change ; les
// dépenses ne passent plus par ici (elles sont rendues par Comptabilité, à une
// place fixe : la saisie ne se démonte jamais à l'arrivée du nuage).
function StatutFiscal({ liveStats, onNav, partie = 'declarer' }) {
  const regime = useRegimeFiscal();
  const [changer, setChanger] = useState(false);
  const [taux, setTaux] = useState(() => tauxUrssaf());
  useEffect(() => { const f = (e) => { if (e && e.detail && e.detail.k === 'vinted_urssaf_taux') setTaux(tauxUrssaf()); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  useEffect(() => onCloudReady(() => setTaux(tauxUrssaf())), []);
  const pf = useProfilFiscal();
  if (regime === undefined) return partie === 'declarer' ? <div className="vrm-compta-carte"><p className="vrm-compta-phrase" style={{ margin: 0 }}>Je lis ton statut…</p></div> : null;
  const choisir = (k) => { save('vinted_regime', k); setChanger(false); };
  // (9 nov.) L'activité du micro-entrepreneur (achat-revente ou prestations) : SES taux.
  const activite = pf.activite === 'services' ? 'services' : 'vente';
  const vl = [false, 'avant', 'apres'].some((a) => tauxMicro({ activite, liberatoire: true, acre: a }) === taux);
  const acre = ['apres', 'avant'].find((a) => [false, true].some((l) => tauxMicro({ activite, acre: a, liberatoire: l }) === taux)) || false;
  const officiel = [false, 'avant', 'apres'].some((a) => [false, true].some((l) => tauxMicro({ activite, acre: a, liberatoire: l }) === taux));
  const poserTaux = (o) => { const t = tauxMicro({ ...o, activite }); save('vinted_urssaf_taux', t); setTaux(t); };
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
  const carteChoix = (
    <Card style={{ padding: 18 }}>
      <div data-statut-carte={regime ? 'changer' : 'question'}>
        <h3 className="vrm-titre-compta" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: C.text }}>{regime ? 'Change ton statut' : 'Quel est ton statut ?'}</h3>
        <p className="vrm-aide" style={{ margin: '0 0 14px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>L'URSSAF n'apparaît qu'en micro-entreprise. Modifiable à tout moment.</p>
        {choix}
        {!regime && pf.etat === 'inconnu' ? <AideStatutNeutre /> : null}
        {regime && <button type="button" className="vrm-lien-action" onClick={() => setChanger(false)} style={{ marginTop: 10, border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', padding: 0 }}>Annuler</button>}
      </div>
    </Card>
  );
  if (partie === 'statut') {
    if (!regime) return null;                      // la question est posée en haut (question 2)
    if (changer) return carteChoix;
    return (
      <div className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0 }}>
        <h3 className="vrm-titre-compta" data-titre-section="" style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: -0.15, margin: '0 16px 8px' }}>{L.statut}</h3>
        <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
          <div className="vrm-set-ligne">
            <span className="vrm-set-lib" data-statut-actuel={regime}><b style={{ color: C.text }}>{libelleRegime(regime)}</b><small style={{ color: C.muted }}>VRM adapte ta comptabilité à ce statut.</small></span>
            <button type="button" className="vrm-lien-action" data-statut-changer="" onClick={() => setChanger(true)} style={{ border: 'none', background: 'transparent', color: C.accentTexte, fontWeight: 600, fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', padding: '0 4px', minHeight: 44 }}>Changer</button>
          </div>
        </div>
      </div>
    );
  }
  if (partie === 'suivi') {
    if (regime !== 'micro') return null;
    return (<>
      <ComptaRepli id="compta-suivi" titre="Tes déclarations URSSAF" resume="Ce que tu as déclaré et payé, période par période">
        <SuiviUrssaf onNav={onNav} sansTitre />
      </ComptaRepli>
      <MicroEntreprise taux={taux} poserTaux={(o) => poserTaux(o)} officiel={officiel} vlTaux={vl} acreTaux={acre} activite={activite} />
    </>);
  }
  // partie === 'declarer'
  if (!regime) return carteChoix;
  if (regime !== 'micro') {
    const texte = regime === 'particulier'
      ? <>Tu vends tes propres affaires : rien à déclarer à l'URSSAF, et VRM n'estime aucune cotisation. Bon à savoir : chaque année, Vinted transmet aux impôts les vendeurs qui dépassent <b>30 ventes ou 2 000&nbsp;€</b> (le détail, compte par compte, est dans Ventes → Outils → Registre annuel). Si tu achètes pour revendre, c'est une activité : choisis « Micro-entrepreneur » ou « Société » (Argent → Déclarer → Ton statut).</>
      : regime === 'marge'
        ? <>Régime de la marge : VRM calcule la TVA sur ta marge dans le rapport comptable (Ventes → Outils). Tes cotisations ne se calculent pas sur ton chiffre d'affaires : VRM ne les estime pas — ton comptable s'en charge.</>
        : <>En société, tes impôts et tes cotisations ne se calculent pas sur ton chiffre d'affaires : VRM ne les estime pas et ne t'envoie aucun rappel URSSAF. Ton chiffre d'affaires et ton bénéfice restent sur cet écran, pour ton comptable.</>;
    // (9 nov.) Société : la TVA qu'il a CHOISIE (jamais déduite), et le livre des recettes et
    // l'export comptable remontés juste en dessous (`pf.exportEnAvant`).
    const tvaTexte = { franchise: 'Franchise en base de TVA : tes factures portent « TVA non applicable ».', normale: 'TVA collectée : ton comptable la déclare à partir de ton export.', marge: 'TVA sur la marge.' };
    return <div className="vrm-compta-carte"><div data-statut-carte={regime} data-profil-fiscal={pf.etat || ''} style={{ fontSize: 15, color: C.text, lineHeight: 1.6 }}>{texte}
      {pf.livre ? <div data-profil-tva={pf.tva || 'pasdit'} style={{ marginTop: 8, fontSize: 13, color: C.muted }}>{pf.tva ? tvaTexte[pf.tva] : 'Ta TVA n’est pas dite : choisis-la dans Réglages → Ma configuration.'} Livre, registre et export : juste en dessous.</div> : null}
    </div></div>;
  }
  return <CarteUrssafMois liveStats={liveStats} onNav={onNav} />;
}
// (9 nov.) « Je ne sais pas encore » (Ma configuration) : une aide COURTE et NEUTRE, et les
// pages officielles — jamais un conseil fiscal personnalisé (src/profilFiscal.js).
function AideStatutNeutre() {
  return (
    <div data-statut-aide="" style={{ marginTop: 14, fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
      {AIDE_NEUTRE.map((t) => <p key={t} style={{ margin: '0 0 6px' }}>{t}</p>)}
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {SOURCES_OFFICIELLES.map((s) => <li key={s.url} style={{ margin: '4px 0' }}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accentTexte, fontWeight: 600, textDecoration: 'none' }}>{s.nom}</a></li>)}
      </ul>
    </div>
  );
}
// ── LES REPLIS DE « LE DÉTAIL » (2 nov.) ─────────────────────────────────
// Une rangée de 44 px : le titre, une ligne qui dit ce qu'il y a dedans (sans
// chiffre : un nombre ne s'écrit qu'une fois sur l'écran), le chevron. Non
// contrôlé : `ouvrirRepliCompta(id)` l'ouvre depuis un renvoi (« dater dans
// « Vendu et reçu » »), sans qu'un état React le referme au rendu suivant.
function ComptaRepli({ id, titre, resume, children, attrs }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <details id={id} className="vrm-repli vrm-compta-repli" data-compta-repli={id} data-compta-repli-etat={ouvert ? 'ouvert' : 'ferme'} onToggle={(e) => setOuvert(e.currentTarget.open)} {...(attrs || {})}>
      <summary>
        <span className="vrm-compta-repli-tete">
          <span className="vrm-compta-repli-titre">{titre}</span>
          {resume ? <span className="vrm-compta-repli-resume">{resume}</span> : null}
        </span>
      </summary>
      {/* Rendu même replié : les cartes gardent leur état et leurs lectures. */}
      <div className="vrm-compta-repli-corps">{children}</div>
    </details>
  );
}
const ouvrirRepliCompta = (id, essai = 0) => {
  try {
    const d = document.getElementById(id);
    if (!d) return;
    // (10 nov., Argent) La carte est dans un AUTRE segment (caché) : on y va d'abord, puis on l'ouvre.
    const part = d.closest('[data-argent-vue]');
    if (part && part.hidden && essai < 10) {
      try { window.dispatchEvent(new CustomEvent('vrm:argent-vue', { detail: part.getAttribute('data-argent-vue') })); } catch (_) {}
      setTimeout(() => ouvrirRepliCompta(id, essai + 1), 60);
      return;
    }
    if (!d.open) d.open = true;
    requestAnimationFrame(() => { try { d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} });
  } catch (_) {}
};
// ── TA MICRO-ENTREPRISE (29 octobre) ─────────────────────────────────────
// Julien : « vois si la personne a choisi le versement libératoire », « si elle
// paie tous les mois, elle déclare août mais paie en septembre », « une jauge
// avec le plafond et le seuil de TVA », « une interface plus pro ». Trois cartes,
// une règle pure (`src/microEntreprise.js`, chiffres officiels vérifiés) :
//   1. Ton profil URSSAF — le rythme (UN réglage, `vinted_urssaf_freq`, partagé
//      par la carte du mois et le suivi), le versement libératoire DEMANDÉ
//      (`vrm_micro_options` : VRM ne lit pas son espace URSSAF), l'ACRE, et le
//      taux détaillé ligne par ligne.
//   2. Ton calendrier — quel mois se paie quand, avec SES dates.
//   3. Tes seuils — CA de l'année (la ligne publiée, datée au versement) face
//      au seuil de TVA et au plafond du régime ; « au moins » quand c'est un
//      minimum ; une projection à ce rythme, jamais sur un total partiel.
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
// (6 nov., v36-visuel-2) La règle unique des euros : centimes seulement s'ils existent (« 1 395 € »).
const eurMicro = (n) => n == null ? '—' : montant(Number(n));
const eurRond = (n) => `${Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}\u00a0€`;
// ⟦← App.jsx #31⟧
function LigneProfil({ titre, aide, children, attr }) {
  return (
    <div className="vrm-micro-ligne" {...(attr || {})} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px 12px', flexWrap: 'wrap' }}>
        {/* (6 nov., v36-visuel-2) Une explication en phrase (texte seul) suit le titre en « ⓘ » (une
            feuille) au lieu d'un paragraphe de 3 à 4 lignes ; une aide qui porte une QUESTION à
            trancher (élément) reste à l'écran. */}
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{titre}{typeof aide === 'string' ? <>{' '}<Pourquoi titre={titre}>{aide}</Pourquoi></> : null}</span>
        {children}
      </div>
      {aide && typeof aide !== 'string' ? <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{aide}</div> : null}
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
// ── DAC7 PAR PLATEFORME (3 nov.) ── `dac7ParPlateforme` (src/seuilsAnnee.js) sur
// la ligne publiée : les MÊMES ventes que le CA déclaré (datées au versement,
// comptes exclus retirés). Ton informatif (historique « 6 octobre ») : aucun
// ambre, un seuil atteint se dit par le mot ; une plateforme pas lue ⇒ « — » ;
// il manque des ventes ⇒ « au moins », jamais « sous ».
function Dac7Plateformes({ ligne, annee }) {
  const D = React.useMemo(() => dac7ParPlateforme({ ligne, annee }), [ligne, annee]);
  if (!D || !D.plateformes.length) return null;
  const eur = (c) => eurMicro(c / 100);
  return (
    <div data-dac7="" data-dac7-annee={annee} style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: C.text }}>DAC7</span>
        <span style={{ color: C.muted }}>30 ventes ou plus de 2 000&nbsp;€</span>
      </div>
      {D.plateformes.map((p) => {
        const pct = p.etat !== 'lu' ? 0 : Math.min(100, Math.max(p.n / 30, p.centimes / 200000) * 100);
        const droite = p.etat !== 'lu' ? '—'
          : p.verdict === 'atteint' ? <b style={{ color: C.text }}>atteint</b>
          : p.verdict === 'atteintSi' ? <>atteint si {p.nAd} à dater</>
          : p.verdict === 'sous' ? <>encore {p.reste.n} vente{p.reste.n > 1 ? 's' : ''} ou {eur(p.reste.centimes)}</>
          : <>au moins</>;
        return (
          <div key={p.plateforme} data-dac7-plateforme={p.plateforme} data-etat={p.etat} data-n={p.n == null ? '' : p.n} data-cts={p.centimes == null ? '' : p.centimes} data-verdict={p.verdict || ''} data-a-dater={p.nAd || ''} style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{p.plateforme}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.etat !== 'lu' ? '—' : <>{p.partiel ? 'au moins ' : ''}{p.n} vente{p.n > 1 ? 's' : ''} · {eur(p.centimes)}</>}</span>
            </div>
            {p.etat === 'lu' ? <div style={{ marginTop: 6 }}><JaugeBarre attr={{ 'data-dac7-jauge': p.plateforme }} pct={pct} etat="ok" /></div> : null}
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{droite}</div>
          </div>
        );
      })}
    </div>
  );
}
function MicroEntreprise({ taux, poserTaux, officiel, vlTaux, acreTaux, activite = 'vente' }) {
  const freq = useFreqUrssaf();
  const [opts, optsPret] = useLigneSynchro('vrm_micro_options', lireOptionsMicro);
  const ligne = useLigneUrssaf();
  const [regLu, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const now = new Date();
  const jauge = React.useMemo(() => jaugeSeuils({ ligne, now, activite }), [ligne, activite]); // eslint-disable-line react-hooks/exhaustive-deps
  const cal = React.useMemo(() => calendrierUrssaf(freq, now, 3), [freq]); // eslint-disable-line react-hooks/exhaustive-deps
  const vl = opts.liberatoire;                     // 'oui' · 'non' · null (pas répondu)
  const acre = opts.acre || (opts.at === 0 && acreTaux) || false;   // false · 'avant' · 'apres'
  const s = seuilsDe(now.getFullYear(), activite);
  const [microOuvert, setMicroOuvert] = React.useState(false);
  const besoin = (optsPret && opts.liberatoire == null) || !!(jauge && ((jauge.tva && jauge.tva.etat && jauge.tva.etat !== 'ok') || (jauge.plafond && jauge.plafond.etat && jauge.plafond.etat !== 'ok')));
  React.useEffect(() => { if (besoin) setMicroOuvert(true); }, [besoin]);
  const poserOptions = (o) => {
    const n = { ...opts, ...o, at: Date.now() };
    // (9 nov.) L'activité (achat-revente / prestations) choisie dans « Ma configuration » est GARDÉE.
    save('vrm_micro_options', { liberatoire: n.liberatoire, acre: n.acre === 'apres' ? 'apres' : n.acre ? 'avant' : false, ...(opts.activite ? { activite: opts.activite } : {}), at: n.at });
    // Le taux suit ses réponses — sauf un taux posé À LA MAIN (Réglages), qu'on
    // ne remplace jamais en silence.
    if (officiel) poserTaux({ liberatoire: n.liberatoire === 'oui', acre: n.acre === 'apres' ? 'apres' : !!n.acre });
  };
  const poserFreq = (f) => save('vinted_urssaf_freq', f);
  const jour = (d) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`;
  const sTitre = { fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: -0.15 };
  const sCarte = { padding: '16px 18px', margin: 0, height: '100%', boxSizing: 'border-box' };
  // (9 nov.) Le détail vient de src/profilFiscal.js (`detailTaux`), selon SON activité.
  const lignesTaux = detailTaux({ activite, liberatoire: vl === 'oui' || (vl == null && !!vlTaux), acre }).map((l) => [l.quoi, l.taux, l.note]);
  const tauxLib = TAUX_ACTIVITE[activite === 'services' ? 'services' : 'vente'].liberatoire;
  // ── 1. Profil ──
  const profil = (
    <Card style={sCarte}>
      <div data-micro-profil={vl || 'passu'}>
        <div style={{ ...sTitre, marginBottom: 6 }}>Ton profil URSSAF{' '}<Pourquoi titre="Ton profil URSSAF">VRM ne lit pas ton espace URSSAF : dis-lui tes options, il calcule le reste. Tu les retrouves sur autoentrepreneur.urssaf.fr, rubrique « Mon compte ».</Pourquoi></div>
        <LigneProfil titre="Tu déclares" attr={{ 'data-micro-freq': freq }} aide={phraseRythme(freq, now) + " L'URSSAF ne propose que ces deux rythmes (pas d'annuel)."}>
          <Segmente label="Rythme de déclaration" value={freq} onChange={poserFreq}
            options={[{ v: 'mensuel', l: 'Par mois', data: { 'data-micro-freq-choix': 'mensuel' } }, { v: 'trimestriel', l: 'Par trimestre', data: { 'data-micro-freq-choix': 'trimestriel' } }]} />
        </LigneProfil>
        <LigneProfil titre="Versement libératoire de l'impôt" attr={{ 'data-micro-vl': vl || 'passu' }}
          aide={<>
            {vl == null && optsPret ? <div data-micro-vl-question="" style={{ color: C.warn, fontWeight: 600, marginBottom: 4 }}>À confirmer : as-tu choisi cette option auprès de l'URSSAF ?{vlTaux ? ` Ton taux actuel (${pctFr(taux)}) laisse penser que oui.` : ''}</div> : null}
            {vl === 'oui' ? <>Ton impôt sur le revenu ({String(tauxLib).replace('.', ',')}&nbsp;%) part avec tes cotisations, {freq === 'mensuel' ? 'chaque mois' : 'chaque trimestre'}.</> : vl === 'non' ? <>Ton impôt sur le revenu se calcule à part, sur ta déclaration de revenus du printemps.</> : <>Ton impôt sur le revenu payé avec tes cotisations ({String(tauxLib).replace('.', ',')}&nbsp;%), ou à part sur ta déclaration de revenus.</>}
            <Pourquoi label="Comment savoir si je l'ai choisi">Sur autoentrepreneur.urssaf.fr, ta déclaration affiche une ligne « versement libératoire » à côté des cotisations si tu l'as choisi. Avec l'option, l'impôt sur ce chiffre d'affaires ({String(tauxLib).replace('.', ',')}&nbsp;% pour {activite === 'services' ? 'les prestations de services' : "l'achat-revente"}) est payé au même rythme que tes cotisations, et tu n'as plus rien à payer dessus au printemps.{s ? <> Elle est possible si ton revenu fiscal de référence d'il y a deux ans était sous {eurRond(s.rfrLiberatoire)} (personne seule), et se demande avant le 30 septembre pour l'année suivante.</> : null}</Pourquoi>
          </>}>
          <Segmente label="Versement libératoire" value={vl} onChange={(v) => poserOptions({ liberatoire: v })}
            options={[{ v: 'oui', l: 'Oui', data: { 'data-taux-option': 'liberatoire' } }, { v: 'non', l: 'Non', data: { 'data-micro-vl-choix': 'non' } }]} />
        </LigneProfil>
        <LigneProfil titre="ACRE (première année)" attr={{ 'data-micro-acre': acre === 'apres' ? 'apres' : acre ? 'oui' : 'non' }} aide="L'aide à la création réduit tes cotisations la première année. Elle dépend de ta date de début d'activité : moitié moins avant le 1er juillet 2026, un quart de moins ensuite.">
          <Segmente label="ACRE" value={acre === 'apres' ? 'apres' : acre ? 'oui' : 'non'} onChange={(v) => poserOptions({ acre: v === 'apres' ? 'apres' : v === 'oui' })}
            options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Avant juil. 2026', data: { 'data-taux-option': 'acre' } }, { v: 'apres', l: 'Depuis juil. 2026', data: { 'data-taux-option': 'acre2026' } }]} />
        </LigneProfil>
        <div data-statut-taux={String(taux)} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Ton taux</span>
            <span className="vrm-display" style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{pctFr(taux)}</span>
          </div>
          {officiel ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', marginTop: 8, fontSize: 13, color: C.muted }}>
              {lignesTaux.map(([l, t, n]) => <React.Fragment key={l}><span>{l} <span style={{ fontSize: 12 }}>· {n}</span></span><span style={{ color: C.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{pctFr(t)}</span></React.Fragment>)}
            </div>
          ) : <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Posé à la main dans « Ton entreprise » : VRM ne le change pas quand tu réponds ci-dessus.</div>}
          <div data-micro-activite={activite} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Taux officiels 2026 {activite === 'services' ? 'des prestations de services (BIC)' : "de l'achat-revente"}, à vérifier sur ton espace URSSAF. VRM ne remplace pas un comptable.</div>
        </div>
      </div>
    </Card>
  );
  // ── 2. Calendrier ──
  const calendrier = (
    <Card style={sCarte}>
      <div data-micro-calendrier={freq}>
        <div style={sTitre}>Ton calendrier{' '}<Pourquoi titre="Ton calendrier">
          {freq === 'mensuel' ? 'Le chiffre d\'affaires d\'un mois se déclare et se paie le mois suivant.' : 'Le chiffre d\'affaires d\'un trimestre se déclare et se paie le mois qui suit le trimestre.'}
          {vl === 'oui' ? ` Ton impôt (${String(tauxLib).replace('.', ',')}\u00a0%) part en même temps.` : vl === 'non' ? ' Ton impôt sur le revenu se paie à part (déclaration de revenus).' : ''}
        </Pourquoi></div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {cal.map((p, i) => {
            const notee = regPret && p.ym.every((ym) => moisDeclare(regLu, ym));
            const presse = !notee && p.ouverte && p.joursRestants <= 7;
            return (
              <div key={p.periode} data-micro-echeance={p.ym.join(',')} data-micro-echeance-etat={notee ? 'notee' : p.ouverte ? 'ouverte' : 'avenir'}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'baseline', padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{p.periode}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: notee ? C.muted : presse ? C.warn : C.muted, whiteSpace: 'nowrap' }}>
                  {/* (29 oct., revue) « notée déclarée » est déjà dit par le suivi juste
                      au-dessus : ici, une coche (son nom reste pour un lecteur d'écran). */}
                  {notee ? <span role="img" aria-label="notée déclarée">✓</span> : !p.ouverte ? 'à venir' : p.joursRestants <= 0 ? "dernier jour aujourd'hui" : `${p.joursRestants} j restants`}
                </span>
                <span style={{ gridColumn: '1 / -1', fontSize: 13, color: C.muted }}>Déclarer et payer du {jour(p.ouvre)} au {jour(p.limite)}</span>
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
    <Card style={sCarte}><div data-micro-seuils="passu"><div style={sTitre}>Tes seuils {now.getFullYear()}</div><div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>— pas encore calculé</div></div></Card>
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
            <span style={{ fontSize: 13, color: C.muted }}>Reçu en {j.annee} : <b className="vrm-display" style={{ color: C.text, fontSize: 17 }}>{am}{eurMicro(j.ca)}</b><SourceChiffre id="seuils-ca">La somme des mois de {j.annee} de ton chiffre d’affaires déclaré ({j.mois} mois portent des ventes), toutes plateformes, daté au jour du versement — la même ligne que « Déclarer »{j.aDaterSur ? <>, plus {j.aDaterSur.n} vente{j.aDaterSur.n > 1 ? 's' : ''} vendue{j.aDaterSur.n > 1 ? 's' : ''} en {j.annee} pas encore datée{j.aDaterSur.n > 1 ? 's' : ''} ({eurMicro(j.aDaterSur.ca)})</> : null}.</SourceChiffre></span>
          </div>
          {j.aDaterSur ? <div data-micro-adater-sur={String(j.aDaterSur.n)} style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Dont {j.aDaterSur.n} vente{j.aDaterSur.n > 1 ? 's' : ''} vendue{j.aDaterSur.n > 1 ? 's' : ''} en {j.annee} sans date de versement ({eurMicro(j.aDaterSur.ca)}) : reçue{j.aDaterSur.n > 1 ? 's' : ''} en {j.annee}, dans aucun mois.</div> : null}
          {j.partiel ? <div data-micro-partiel-texte="" style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>C'est un minimum : {j.raisons.join(' · ')}.</div> : null}
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
            <div style={{ fontSize: 12, color: C.muted }}>Le trait : le seuil{' '}<Pourquoi titre="Franchise de TVA">Le trait marque le seuil ; la barre va jusqu'au seuil majoré ({eurRond(j.seuils.tvaMajore)}).</Pourquoi></div>
            <div data-micro-tva-texte="" style={{ fontSize: 13, color: j.tva.etat === 'ok' ? C.muted : C.text, marginTop: 6, lineHeight: 1.5 }}>{tvaTxt}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: C.text }}>Plafond de la micro-entreprise</span>
              <span style={{ color: j.plafond.etat === 'ok' ? C.muted : C.warn, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pctFr(Math.round(j.plafond.pct))} de {eurRond(j.seuils.plafondVente)}</span>
            </div>
            <JaugeBarre attr={{ 'data-micro-jauge': 'plafond' }} pct={j.plafond.pct} etat={j.plafond.etat} />
            <div data-micro-plafond-texte="" style={{ fontSize: 13, color: j.plafond.etat === 'ok' ? C.muted : C.text, marginTop: 6, lineHeight: 1.5 }}>{plafTxt}</div>
          </div>
          {/* (3 nov.) « Vers quel mois » : projection LINÉAIRE sur les mois finis
              (`moisAtteinte`, src/seuilsAnnee.js) — seulement si le total est complet
              et porte au moins 2 mois finis ; sinon rien. Remplace « tu finirais
              l'année vers X € » (jour par jour, mois en cours compris) : deux
              estimations sur une carte se seraient contredites. */}
          {(() => {
            const at = [['tva', 'TVA', j.seuils.tvaBase, j.tva.etat === 'ok' || j.tva.etat === 'proche'], ['plafond', 'Plafond', j.seuils.plafondVente, j.plafond.etat === 'ok' || j.plafond.etat === 'proche']]
              .map(([k, lib, seuil, sous]) => ({ k, lib, r: sous ? moisAtteinte({ ligne, now, seuil }) : null }))
              .filter((x) => x.r && x.r.mois != null);
            return at.length ? (
              <div data-micro-projection-texte="" style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {at.map((x) => (
                  <div key={x.k} data-micro-atteinte={x.k} data-mois={x.r.mois} data-base={x.r.base} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <span style={{ color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.lib} vers {x.r.nom}</span>
                    <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>estimation</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          <Dac7Plateformes ligne={ligne} annee={j.annee} />
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
        {!dr ? <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>— pas encore calculé</div> : (<>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            {dr.enCours ? <>Revenus {dr.annee}, à déclarer au printemps {dr.annee + 1} — pour l'instant :</> : <>Revenus {dr.annee}, à déclarer ce printemps (déclaration 2042-C-PRO) :</>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <b className="vrm-display" style={{ fontSize: 22, color: C.text }}>{dr.partiel ? 'au moins ' : ''}{eurMicro(dr.ca)}</b>
            <span style={{ fontSize: 13, color: C.text }}>{dr.liberatoire ? <>case <b>{dr.cases[0]}</b></> : <>case <b>5KO</b> sans versement libératoire, <b>5TA</b> avec</>}</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            {dr.liberatoire === 'oui' ? <>Ton impôt est déjà payé avec tes cotisations : ce chiffre est déclaré pour information (il compte dans ton revenu fiscal de référence).</>
              : <>Le chiffre d'affaires brut, sans retirer d'abattement : les impôts appliquent eux-mêmes les 71&nbsp;% de la vente de marchandises.</>}
            {dr.partiel ? <> C'est un minimum : {dr.raisons.join(' · ')}.</> : null}
            {' '}Compare avec le total de tes déclarations URSSAF de l'année. <Pourquoi>VRM ne compte que ce qu'il a capté sur tes plateformes reliées.</Pourquoi>
          </div>
        </>)}
        {cfe ? <div data-micro-cfe="" style={{ fontSize: 13, color: C.text, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>CFE : si tu as reçu un avis, paie-le avant le <b>{cfe.limite}</b> sur impots.gouv.fr. <Pourquoi label="Pas d'avis ?">À payer dans ton espace professionnel. Pas d'avis l'année de création de ton entreprise, ni si ton chiffre d'affaires d'il y a deux ans était sous 5 000&nbsp;€.</Pourquoi></div> : null}
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
        <span style={{ fontSize: 13, color: besoin ? (C.warn || '#B25000') : C.muted, fontWeight: 500, lineHeight: 1.4 }}>{aConfirmer ? '1 question à confirmer · ' : ''}{seuilAlerte ? 'un seuil approche · ' : ''}taux {String(taux).replace('.', ',')}&nbsp;%{prochaine ? ` · ${prochaine.periode} à déclarer avant le ${prochaine.limite.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''} · seuils et impôts</span>
      </span>
    </summary>
    <div data-micro-entreprise="" className="vrm-micro-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 12, alignItems: 'stretch', marginTop: 8 }}>{calendrier}{seuils}{profil}{impots}</div>
  </details>);
}
function SuiviUrssaf({ onNav, sansTitre = false }) {
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
  const ambre = C.warn || C.amber || '#B25000';
  // (2 nov.) Dans « Le détail », le repli porte déjà le titre : pas de redite.
  const titre = sansTitre ? null : <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Suivi de tes déclarations URSSAF</div>;
  if (suivi === undefined) return <Card style={{ padding: '14px 16px', marginTop: sansTitre ? 0 : 12 }}><div data-suivi-urssaf="charge">{titre}<div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Lecture de tes déclarations…</div></div></Card>;
  if (suivi === null) return <Card style={{ padding: '14px 16px', marginTop: sansTitre ? 0 : 12 }}><div data-suivi-urssaf="passu">{titre}<div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Je n'ai pas pu lire tes déclarations notées — rien n'est perdu, rouvre cet écran.</div></div></Card>;
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
  const champ = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px', fontSize: 17, background: C.bg, color: C.text, width: '100%', maxWidth: 200, minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' };
  const btn = { fontSize: 13, fontWeight: 600, color: C.text, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 14px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <Card style={{ padding: '14px 16px', marginTop: sansTitre ? 0 : 12 }}>
      <div data-suivi-urssaf="lu" data-suivi-retard={String(suivi.enRetard)} data-suivi-regul={String(suivi.aRegulariser)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {titre}
          {suivi.lignes.length ? <button type="button" className="vrm-lien-action" data-suivi-export="" onClick={exporter} style={{ background: 'none', border: 'none', color: C.accentTexte, fontSize: 13, fontWeight: 600, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' }}>Exporter (CSV)</button> : null}
        </div>
        <div data-suivi-annee={a.annee} data-suivi-annee-ca={String(a.ca)} data-suivi-annee-paye={a.paye == null ? '' : String(a.paye)} style={{ fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          {a.n === 0 ? <>Aucune déclaration notée en {a.annee}. Après chaque déclaration sur l'URSSAF, touche « Noter ma déclaration » : VRM garde ce que tu as déclaré et payé.</>
            : a.periodes === 1 ? <>{a.annee} : {freq === 'mensuel' ? '1 mois noté « déclaré »' : '1 période notée « déclarée »'} — son détail est juste en dessous.</>
            : <>{a.annee} : <b style={{ color: C.text }}>{eur(a.ca)}</b> déclarés sur {a.n} mois · {a.paye != null ? <>cotisations payées <b style={{ color: C.text }}>{eur(a.paye)}</b></> : <>cotisations ≈ <b style={{ color: C.text }}>{eur(a.estime)}</b> (estimées : note ce que tu as payé avec « Compléter »)</>}</>}
        </div>
        {suivi.enRetard > 0 ? <div data-suivi-retard-texte="" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.5 }}>{suivi.enRetard === 1 ? '1 période passée n\'est' : `${suivi.enRetard} périodes passées ne sont`} pas notée{suivi.enRetard > 1 ? 's' : ''} « déclarée »{(() => { const n = suivi.lignes.filter((l) => l.etat === 'a_declarer').length; return n ? <span data-suivi-a-declarer={n}> (et {n === 1 ? '1 autre est' : `${n} autres sont`} à déclarer maintenant)</span> : null; })()}.{suivi.enRetard > 1 ? " Si tu les as déjà déclarées sur l'URSSAF, touche « Noter ma déclaration » ; sinon, déclare-les vite" : " Si tu l'as déjà déclarée sur l'URSSAF, touche « Noter ma déclaration » ; sinon, déclare-la vite"} (une déclaration en retard peut coûter une pénalité).</div> : null}
        {(() => {
          const aNoter = suivi.lignes.filter((l) => l.etat === 'en_retard' || l.etat === 'a_declarer').flatMap((l) => l.aNoter);
          return aNoter.length >= 2 ? (
            <button type="button" data-suivi-serie={aNoter.length} onClick={() => demanderSerieDeclaration(aNoter, onNav)} style={{ ...btn, marginTop: 8, alignSelf: 'flex-start' }}>
              Noter mes {aNoter.length} mois à la suite
            </button>) : null;
        })()}
        {suivi.aRegulariser > 0 ? <div data-suivi-regul-texte="" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.5 }}>À ajouter à ta prochaine déclaration : <b>{eur(suivi.aRegulariser)}</b> (≈ {eur(aPayerUrssaf(suivi.aRegulariser, tauxUrssaf()))} de cotisations). <Pourquoi>Des ventes que VRM compte et qui ne sont dans aucune déclaration.</Pourquoi></div> : null}
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
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{l.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ambreEtat ? ambre : C.muted }}>{ETAT[l.etat]}{sousEtat}</span>
                  </div>
                  {l.etat === 'declaree' ? (
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                      Déclaré <b style={{ color: C.text }}>{eur(l.caDecl)}</b>{l.caTape ? '' : ' (chiffre de VRM quand tu l\'as notée)'}{l.regle === 'vente' ? ' · à la date de vente' : ''}
                      {' · '}{l.paye != null ? <>cotisations payées <b style={{ color: C.text }}>{eur(l.paye)}</b></> : <>cotisations ≈ {eur(l.aPayerDecl)} <span>(pas notées)</span></>}
                      {l.ecart ? <div data-suivi-ecart-texte="" style={{ marginTop: 2 }}>{l.ecart < 0
                        ? <>VRM compte aujourd'hui <b style={{ color: C.text }}>{eur(-l.ecart)}</b> de moins (des ventes déclarées ne sont plus dans VRM : compte retiré, vente annulée). Ta déclaration reste celle-là.</>
                        : <>VRM compte aujourd'hui <b style={{ color: C.text }}>{eur(l.ecart)}</b> de plus : des ventes de cette période ne sont dans aucune déclaration — à ajouter à la prochaine (≈ {eur(l.aPayerEcart)} de cotisations).</>}</div> : null}
                      {l.partiel && l.caCalc != null ? <div style={{ marginTop: 2 }}>VRM compte au moins {eur(l.caCalc)} aujourd'hui (ventes sans date) : pas d'écart affirmé.</div> : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                      {/* (29 oct., revue) Le mois EN COURS : son « à payer » est déjà dans
                          « Ta déclaration URSSAF » juste au-dessus (§7, une phrase une fois) ;
                          ici, seulement ce qui est reçu jusqu'ici. */}
                      {l.caCalc == null ? '— pas encore calculé' : l.etat === 'en_cours' ? <>Reçu jusqu'ici {l.partiel ? 'au moins ' : ''}<b style={{ color: C.text }}>{eur(l.caCalc)}</b></> : <>Reçu {l.partiel ? 'au moins ' : ''}<b style={{ color: C.text }}>{eur(l.caCalc)}</b> · à payer ≈ {l.partiel ? 'au moins ' : ''}<b style={{ color: C.text }}>{eur(l.aPayerCalc)}</b></>}
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
                      {edit.erreur ? <div role="alert" style={{ fontSize: 13, color: ambre }}>{edit.erreur}</div> : null}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" data-suivi-edit-ok="" onClick={enregistrer} style={{ ...btn, background: C.accent, color: C.onAccent || '#fff', border: 'none' }}>Enregistrer</button>
                        <button className="vrm-b vrm-b-discret" type="button" onClick={() => setEdit(null)} style={btn}>Annuler</button>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>Seuls ces deux chiffres changent ; les ventes déclarées restent. Vide = pas noté.</div>
                    </div>
                  ) : null}
                  {!editeIci && ((l.etat === 'a_declarer' || l.etat === 'en_retard') && l.aNoter.length > 0 || l.aCompleter.length > 0 || (l.etat === 'declaree')) ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {(l.etat === 'a_declarer' || l.etat === 'en_retard') && l.aNoter.length > 0 ? (
                        <button type="button" data-suivi-noter={l.aNoter[0]} onClick={() => demanderDeclaration(l.aNoter[0], onNav)} style={btn}>
                          {l.yms.length > 1 ? `Noter ma déclaration — ${nomMois(l.aNoter[0])}` : 'Noter ma déclaration'}
                        </button>) : null}
                      {l.aCompleter.length > 0 ? (
                        <button type="button" data-suivi-completer={l.aCompleter[0]} onClick={() => ouvrirEdit(l.aCompleter[0])} style={btn}>
                          {l.yms.length > 1 ? `Compléter ${nomMois(l.aCompleter[0])}` : 'Compléter'}
                        </button>) : l.etat === 'declaree' ? (
                        <button type="button" className="vrm-lien-action" data-suivi-corriger={l.yms[l.yms.length - 1]} onClick={() => ouvrirEdit(l.yms[l.yms.length - 1])} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Corriger les montants</button>) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {suivi.lignes.length > 4 ? <button type="button" className="vrm-lien-action" data-suivi-tout="" onClick={() => setOuvert((o) => !o)} style={{ background: 'none', border: 'none', color: C.accentTexte, fontSize: 13, fontWeight: 600, padding: 0, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{ouvert ? 'Moins' : `Voir les ${suivi.lignes.length} périodes`}</button> : null}
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
  // (3 nov.) LA PRÉVISION de la prochaine échéance (`previsionUrssaf`,
  // src/previsionUrssaf.js) : les MÊMES règles d'argent (passées en argument),
  // plus — un rythme jamais choisi ⇒ « — » et le geste (jamais « trimestriel »
  // deviné) ; un mois de la période déjà noté « déclaré » n'est pas recompté ;
  // « au moins » + le nombre de ventes à dater. Registre pas encore lu ⇒ la
  // lecture d'avant (`montantEcheance`), sans rien retirer.
  const rythmeChoisi = (() => { const r = load('vinted_urssaf_freq', null); return r === 'mensuel' || r === 'trimestriel' ? r : null; })();
  const prev = previsionUrssaf({ regime: 'micro', rythme: rythmeChoisi, now: new Date(), ligne: v, declare: registreDecl, taux: TAUX_URSSAF * 100,
    regle: { nextUrssafDeadline, moisPeriodeUrssaf, montantPeriodeUrssaf, moisDeclare } });
  const prevIci = (prev.etat === 'lu' || prev.etat === 'passu') && urssafDue && prev.label === urssafDue.label ? prev : null;
  const urssafPeriodCA = prevIci ? prevIci.ca : montantEcheance.ca;
  const echeancePartiel = (prevIci ? prevIci.partiel : montantEcheance.partiel) ? 1 : 0;
  const Mt = ({ v: x }) => <span style={{whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmt(x)}</span>;
  const sTitre = {fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15};
  const sLib = {fontSize:13,color:C.muted,fontWeight:500};
  const sNote = {fontSize:13,color:C.muted,lineHeight:1.5};
  const sHero = {fontWeight:700,color:C.text,letterSpacing:-1,lineHeight:1.05,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'};
  const sCarte = {padding:18,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow};
  return (
    <section data-compta-urssaf="" data-cible="urssaf" style={{display:'flex',flexDirection:'column',gap:8}}>
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
        const ncInfo = urssafInfo && urssafInfo.nonComptees;
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
          // (1er nov., audits A2/A10) Les ventes dont l'argent ne se lit pas (prix
          // Vinted pas lu, montant Vestiaire pas sûr…) : comptées NULLE PART, dites
          // ici, des mêmes lignes que le total — le chiffre est un minimum (§5).
          if (ncInfo && ncInfo.n > 0) morceaux.push(<Puce key="nc" warn><span data-urssaf-non-comptees={ncInfo.n}>{phraseNonCompteesPar(ncInfo.par)} : dans aucun chiffre — ce total est un minimum</span>{ncInfo.par && Object.keys(ncInfo.par).some(k => k.startsWith('Vestiaire|')) ? <>. VRM ne sait pas encore si le chiffre que Vestiaire écrit est le prix ou ce qu'il te verse : vérifie ces ventes sur Vestiaire avant de déclarer</> : null}</Puce>);
          if (adV && adV.n > 0) morceaux.push(<Puce key="av">{adV.n} vente{adV.n>1?'s':''} Vinted finalisée{adV.n>1?'s':''} sans date de versement (<Mt v={adV.ca}/>) : dans aucun mois pour l'instant{extSait('versement')==='retard' && <span style={{color:C.warn}}> — mets l'extension à jour ({EXT_CAPACITES.versement}) : c'est elle qui va chercher ces dates</span>}</Puce>);
          if (adL && adL.n > 0) morceaux.push(<Puce key="a">{adL.n} vente{adL.n>1?'s':''} Leboncoin sans date (<Mt v={adL.ca}/>) : dans aucun mois — date{adL.n>1?'-les':'-la'} dans <button type="button" className="vrm-lien-action" data-renvoi-carte-ca="" onClick={() => ouvrirRepliCompta('compta-ca')} style={{background:'none',border:0,padding:0,color:C.accentTexte,fontWeight:600,cursor:'pointer',fontSize:'inherit',fontFamily:'inherit',minHeight:0}}>« {TITRE_CARTE_CA} »</button> (dans « Le détail »){extSait('lbcdate')==='retard' && <span style={{color:C.warn}}> — mets d'abord l'extension à jour ({EXT_CAPACITES.lbcdate})</span>}</Puce>);
          // (29 oct.) « Vestiaire Co : pas encore relié » retiré : affiché à tous, même sans compte Vestiaire, il n'apprenait rien.
        }
        return (
      <div data-stats-carte="mois" className="vrm-compta-carte">
        {/* Prochaine échéance de DÉCLARATION (rappel) — un encart neutre ; la
            couleur ne vient QUE si l'échéance presse (≤ 14 j) ou est passée. */}
        <div data-compta-echeance="">
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
            <span className="vrm-compta-libelle" style={{flex:1,margin:0}}>Prochaine déclaration</span>
            {rythmeChoisi ? <span data-urssaf-rythme={urssafFreq} style={{fontSize:13,color:C.muted}}>{urssafFreq==='mensuel'?'chaque mois':'chaque trimestre'}</span> : null}
          </div>
          {prev.etat === 'rythme' ? (
            <div data-prevision-urssaf="rythme" style={{background:C.card2||C.bg,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px 12px',flexWrap:'wrap'}}>
              <span className="vrm-display" style={{fontSize:22,fontWeight:700,color:C.muted}}>—</span>
              <Segmente label="Rythme de déclaration" value={null} onChange={(f) => save('vinted_urssaf_freq', f)}
                options={[{ v: 'mensuel', l: 'Par mois', data: { 'data-prevision-rythme': 'mensuel' } }, { v: 'trimestriel', l: 'Par trimestre', data: { 'data-prevision-rythme': 'trimestriel' } }]} />
            </div>
          ) : urssafDue ? (()=>{
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
            const nomYm = (ym) => { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long' }); };
            const late=!faite&&urssafDue.daysLeft<0, soon=!faite&&urssafDue.daysLeft>=0&&urssafDue.daysLeft<=14;
            const col=late?C.danger:soon?C.warn:C.text;
            // (29 oct., revue) PÉRIODE DÉJÀ NOTÉE « DÉCLARÉE » : plus de compte à
            // rebours ni de montant pour elle (« dans 4 j · à payer 37,20 € » pour
            // une période déjà faite, pendant que « Ta micro-entreprise » donnait
            // une autre échéance — deux « prochaines » sur un écran). Une ligne dit
            // qu'elle est notée, et la suivante est NOMMÉE (la même règle,
            // `nextUrssafDeadline`, lancée au lendemain de l'échéance faite). Son
            // montant se lit dans la ligne du suivi juste en dessous (§7, une fois).
            if (faite) {
              const lendemain = new Date(urssafDue.dueDate); lendemain.setDate(lendemain.getDate() + 1);
              const suivanteBrute = nextUrssafDeadline(urssafFreq, lendemain);
              // Le compte à rebours part d'AUJOURD'HUI, pas du lendemain de l'échéance faite.
              const suivante = suivanteBrute ? { ...suivanteBrute, daysLeft: Math.round((_startOfDay(suivanteBrute.dueDate) - _startOfDay(new Date())) / 86400000) } : null;
              return (
                <div data-urssaf-declaree={ymsDue.join(',')} style={{background:C.card2||C.bg,borderRadius:12,padding:'12px 14px',fontSize:13,lineHeight:1.5,color:C.muted}}>
                  {suivante ? (<>
                    <div data-echeance-suivante={suivante.label} style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'2px 10px',flexWrap:'wrap'}}>
                      <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:-0.2,whiteSpace:'nowrap'}}>{suivante.dueDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>
                      <span data-echeance-suivante-jours={suivante.daysLeft} style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>dans {suivante.daysLeft} j</span>
                    </div>
                    {prev.etat === 'lu' && prev.label === suivante.label ? (
                      <div data-prevision-urssaf="lu" data-prevision-label={prev.label} data-prevision-ca={String(prev.ca)} data-prevision-apayer={String(prev.apayer)} data-prevision-partiel={prev.partiel ? '1' : ''} data-prevision-adater={prev.aDater || ''}
                        style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'2px 10px',flexWrap:'wrap',marginTop:6}}>
                        <span>À payer ≈</span>
                        <span style={{color:C.text,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{prev.partiel ? 'au moins ' : ''}<Mt v={prev.apayer}/>{prev.aDater > 0 ? <span style={{color:C.muted,fontWeight:400}}> · {prev.aDater} à dater</span> : null}</span>
                      </div>
                    ) : null}
                    <div style={{marginTop:4}}>Pour <b style={{color:C.text,fontWeight:600}}>{suivante.label}</b>{_startOfDay(new Date()) <= _startOfDay(suivante.periodEnd) ? (urssafFreq==='mensuel' ? <>, le mois en cours : ce qu'il faut mettre de côté est juste en dessous</> : <>, la période en cours</>) : null}.</div>
                  </>) : null}
                  <div style={{marginTop:suivante?6:0}}><span style={{textTransform:'capitalize'}}>{urssafDue.label}</span> : déclaration notée ✓</div>
                </div>
              );
            }
            return (
              <div data-prevision-urssaf={prevIci ? prevIci.etat : 'avant'} data-prevision-label={urssafDue.label} data-prevision-ca={prevIci && prevIci.ca != null ? String(prevIci.ca) : ''} data-prevision-partiel={prevIci && prevIci.partiel ? '1' : ''} style={{background:C.card2||C.bg,borderRadius:12,padding:'14px 14px 12px',border:(late||soon)?`1px solid ${col}55`:`1px solid transparent`}}>
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
                  <span>À déclarer (argent reçu)</span><span data-echeance-ca={urssafPeriodCA==null?'':String(urssafPeriodCA)} data-echeance-de={urssafDue.periodStart.toISOString()} data-echeance-a={urssafDue.periodEnd.toISOString()} data-echeance-partiel={echeancePartiel||undefined} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:500,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={urssafPeriodCA}/></>}</span>
                  <span>À payer ≈</span><span data-echeance-apayer={urssafPeriodCA==null?'':String(aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100))} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:700,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100)}/></>}</span>
                  {prevIci && prevIci.aDater > 0 ? <><span>À dater</span><span data-prevision-adater={prevIci.aDater} style={{color:C.text,textAlign:'right'}}>{prevIci.aDater} vente{prevIci.aDater>1?'s':''}</span></> : null}
                  {prevIci && prevIci.declares.length > 0 ? <><span>Déjà déclaré</span><span data-prevision-declares={prevIci.declares.join(',')} style={{color:C.muted,textAlign:'right'}}>{prevIci.declares.map(ym=>new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7))-1,1).toLocaleDateString('fr-FR',{month:'long'})).join(', ')}</span></> : null}
                </div>
                {(
                <div style={{display:'flex',alignItems:'center',gap:'6px 12px',flexWrap:'wrap',marginTop:12}}>
                  <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" data-declarer-urssaf="" style={{fontSize:13,fontWeight:600,color:C.onAccent||'#fff',background:C.accent,borderRadius:12,padding:'8px 14px',textDecoration:'none',minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center'}}>Déclarer sur l'URSSAF →</a>
                  {finie && aNoter.length > 0 && (
                    <button type="button" data-urssaf-cest-declare={aNoter[0]} onClick={() => demanderDeclaration(aNoter[0], onNav)}
                      style={{fontSize:13,fontWeight:600,color:C.text,background:'transparent',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 14px',minHeight:44,cursor:'pointer',fontFamily:'inherit'}}>
                      {ymsDue.length > 1 ? `Noter ma déclaration — ${nomYm(aNoter[0])}` : 'Noter ma déclaration'}
                    </button>
                  )}
                  <span style={{fontSize:11,color:C.muted,lineHeight:1.4,flex:'1 1 160px'}}>Estimation ({String(tauxUrssaf()).replace('.',',')}&nbsp;%) — le chiffre officiel se saisit là‑bas.{finie && aNoter.length > 0 ? <> Une fois déclaré, note-le ici : ses ventes ne seront plus recomptées le mois suivant.</> : null}{finie && ymsDue.length > 1 && aNoter.length > 0 && aNoter.length < ymsDue.length ? <> {ymsDue.length - aNoter.length} mois sur {ymsDue.length} déjà noté{ymsDue.length - aNoter.length > 1 ? 's' : ''}.</> : null}</span>
                </div>
                )}
              </div>
            );
          })() : <div style={{fontSize:13,color:C.muted}}>Aucune échéance à venir.</div>}
        </div>
        <div data-compta-mois="" style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
          <div className="vrm-compta-libelle"><span style={{textTransform:'capitalize'}}>{moisCourant.nom}</span>, en cours · à payer ({String(tauxUrssaf()).replace('.',',')}&nbsp;%)</div>
          <div className="vrm-compta-hero vrm-compta-hero-2 vrm-display" data-compta-chiffre="urssaf-mois" data-eur={urssafEstime==null?'':String(urssafEstime)} style={{color:urssafEstime==null?C.muted:C.text}}>{urssafEstime==null?'—':fmt(urssafEstime)}</div>
          {/* (2 nov.) La phrase vient de la MÊME ligne publiée que le chiffre :
              le CA reçu du mois (`moisCourantCA`) et son nombre de ventes. « Net
              après paiement » et la tuile « Ventes finalisées » sont retirés :
              le premier redisait le bénéfice autrement, le second se lit ici. */}
          <p className="vrm-compta-phrase" data-compta-phrase="urssaf-mois">
            {moisCourantCA==null
              ? <>— pas encore calculé</>
              : <span data-urssaf-declare={decl} data-urssaf-mois-n={moisCourantN}>À mettre de côté : {String(tauxUrssaf()).replace('.',',')}&nbsp;% de l'argent reçu en {moisCourant.nom}, toutes plateformes{ncInfo && ncInfo.n > 0 ? ' (au moins : voir ci-dessous)' : ''} (<b style={{color:C.text,fontWeight:600}}><Mt v={moisCourantCA}/></b>{moisCourantN>0 ? <>, {moisCourantN} vente{moisCourantN>1?'s':''}</> : null})
                {nA > 0 && <span data-urssaf-ailleurs={Math.round(caA*100)} data-urssaf-ailleurs-n={nA}>, hors {nA} vente{nA>1?'s':''} (<Mt v={caA}/>) déjà dans ta déclaration{ou ? <> de {ou}</> : null}</span>}
                .
                {decl === 'pasSu' && <span style={{color:C.warn}}> Tes déclarations passées (« J'ai déclaré ce mois ») n'étaient pas encore chargées quand ce chiffre a été calculé : une vente déjà déclarée peut encore y être comptée — ouvre l'écran <b>Ventes</b> pour le mettre à jour.</span>}
              </span>}
          </p>
        {morceaux.length > 0 && <div data-urssaf-couverture style={{...sNote,marginTop:8,display:'flex',flexDirection:'column',gap:4}}>{morceaux}</div>}
        {/* ⚠️ HONNÊTETÉ (§5.57) : l'URSSAF veut le CA ENCAISSÉ, et l'app dit
            comment elle date chaque vente — replié, pas retiré. */}
        <details className="vrm-stats-calcul" style={{marginTop:10}}>
          <summary style={{cursor:'pointer',fontSize:13,fontWeight:500,color:C.muted,padding:'6px 0'}}>Comment c'est calculé</summary>
          <div style={{...sNote,display:'flex',flexDirection:'column',gap:8,padding:'4px 0 6px'}}>
            {moisCourantCA!=null && <div>On additionne les ventes <b>finalisées</b> (argent versé) en {moisCourant.nom}, <b>toutes plateformes</b>, ventes masquées comprises{nA > 0 && <> — {nA>1?'les ventes versées':'la vente versée'} ce mois-ci mais déjà dans ta déclaration{ou ? <> de {ou}</> : null} {nA>1?'ne sont pas recomptées':'n\'est pas recomptée'} ici</>}. C'est la somme à verser à la fin du mois (versement libératoire).</div>}
            {moisCourantCA!=null && adV && adV.n > 0 && extSait('versement')!=='retard' && <div>Ventes Vinted sans date de versement : {extSait('versement')==='ok' ? <>l'extension va chercher leur date à tes prochaines visites sur Vinted (compte par compte)</> : <>c'est l'extension, là où elle est installée, qui va chercher ces dates</>}.</div>}
            {moisCourantCA!=null && adL && adL.n > 0 && <div>Ventes Leboncoin sans date : {extSait('lbcdate')==='ok' ? <>ouvre « Mes transactions » sur leboncoin.fr, l'extension la relève au passage</> : extSait('lbcdate')==='retard' ? <>une fois l'extension à jour, ouvre « Mes transactions » sur leboncoin.fr</> : <>depuis l'ordinateur où l'extension est installée, ouvre « Mes transactions » sur leboncoin.fr</>}.</div>}
            {moisCourantCA!=null && (e.par||{}).Leboncoin && <div>Leboncoin : daté au jour de la vente (sa date de versement n'est pas encore captée).</div>}
            {/* (2 nov., audit P7) eBay ne transmet pas la date de son versement : le dire. */}
            {moisCourantCA!=null && (e.par||{}).eBay && <div data-ca-ebay-date="">eBay : daté au jour de la commande (eBay ne transmet pas la date de son versement).</div>}
            <div>Ces ventes sont datées au jour où la plateforme t'a <b>versé l'argent</b> (la commande finalisée par l'acheteur), pas au jour de la vente. Vérifie ton taux et ton chiffre sur autoentrepreneur.urssaf.fr — VRM ne remplace pas un comptable.</div>
          </div>
        </details>
        </div>
      </div>
        );
      })()}


    </section>
  );
}
// ⟦← App.jsx #32⟧
function RecapComptableMensuel() {
  const v = useLigneUrssaf();
  const urssafMois = v ? v.mois : null;
  const TAUX_URSSAF = tauxUrssaf() / 100;
  // (3 nov.) La colonne « Bénéfice » disait « — » pour TOUS les mois (`profit:
  // null` en dur) alors que la règle le sait : c'est la MÊME que Comptabilité,
  // Ma journée et Statistiques (`beneficePeriode` du mois, `chiffreBenefice`).
  // « — » seulement quand elle dit « pas su » (prix d'achat manquant, mois plus
  // ancien que la publication, rien publié). « Net estimé » (CA − URSSAF, sans
  // prix d'achat) n'était pas un bénéfice : il s'appelle « CA après URSSAF ».
  const [pubB] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const [comptaB] = useLigneSynchro('vrm_compta', lireComptaSynchro);
  const regimeB = useRegimeFiscal();
  const beneficeDuMois = (ym) => {
    const B = beneficeDuMoisPub({ pub: pubB, compta: comptaB, ligneUrssaf: v, regime: regimeB }, ym);
    return B ? chiffreBenefice(B).valeur : null;
  };
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisRecap = !urssafMois ? [] : urssafMois.map((m) => {
    const [y, mo] = String(m.ym || '').split('-');
    return { ym: m.ym, label: `${moisNoms[Number(mo) - 1] || mo} ${y}`, ca: Number(m.ca) || 0, profit: beneficeDuMois(m.ym), count: m.n,
             urssaf: aPayerUrssaf(m.ca, TAUX_URSSAF * 100), net: netApresUrssafDe(m.ca, TAUX_URSSAF * 100) };
  });
  const exportCompta = () => {
    try {
      const rows = [['Mois','Ventes','CA finalise','Benefice',`Cotisations+impot ${String(tauxUrssaf()).replace('.',',')}%`,'CA apres URSSAF']];
      moisRecap.forEach((m) => rows.push([m.label, m.count, m.ca.toFixed(2), m.profit == null ? '' : m.profit.toFixed(2), m.urssaf.toFixed(2), m.net.toFixed(2)]));
      const csv = rows.map((r) => r.join(';')).join('\n');
      telechargerFichier(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `vrm-comptabilite-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    } catch (err) { toast('Erreur export : ' + err.message); }
  };
  // ── (3 nov.) « RÉCAP DE [MOIS] » : un PDF et un tableur (src/recapMois.js) ──
  // Les MÊMES chiffres que le tableau ci-dessous et que Comptabilité : le bénéfice
  // par `beneficeDuMois` (la règle), le CA déclaré et l'URSSAF de la ligne publiée,
  // les charges de `comptaChargesMois` ; les ventes du relevé de Ventes.
  const ymNow = ymCourant(Date.now());
  const moisChoix = [...new Set([ymNow, ...moisRecap.map((m) => m.ym)])].sort().reverse().slice(0, 13);
  const [ymRecap, setYmRecap] = React.useState(ymNow);
  const [recapEnCours, setRecapEnCours] = React.useState('');
  const donneesRecap = async (ym) => {
    const B = beneficeDuMoisPub({ pub: pubB, compta: comptaB, ligneUrssaf: v, regime: regimeB }, ym);
    const m = moisRecap.find((x) => x.ym === ym) || null;
    const rel = lireReleveVentes();
    let ent = null; try { ent = await lireReglage('vrm_pro_facture'); } catch (_) { ent = null; }
    return donneesRecapMois({ ym, releve: rel ? rel.l : null, benefice: chiffreBenefice(B, B ? 'lu' : 'passu'), B, caDeclare: m ? { ca: m.ca, n: m.count } : (urssafMois ? { ca: 0, n: 0 } : null),
      urssaf: m ? m.urssaf : (urssafMois ? 0 : null), taux: tauxUrssaf(), charges: lignesChargesMois(comptaB, ym), entreprise: ent });
  };
  const exporterRecap = async (forme) => {
    if (recapEnCours) return;
    setRecapEnCours(forme);
    try {
      const d = await donneesRecap(ymRecap);
      if (forme === 'csv') telechargerFichier(new Blob([csvRecapMois(d)], { type: 'text/csv;charset=utf-8' }), nomFichierRecap(ymRecap, 'csv'), 'text/csv;charset=utf-8');
      else telechargerFichier(new Blob([await pdfRecapMois(d)], { type: 'application/pdf' }), nomFichierRecap(ymRecap, 'pdf'), 'application/pdf');
    } catch (err) { toast('Récap pas créé : ' + (err && err.message || err)); }
    setRecapEnCours('');
  };
  return (
    <>
      <Card><div className="vrm-recap-mois" data-recap-mois={ymRecap}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span data-titre-section="" style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15,flex:'1 1 auto'}}>Récap de {libelleMois(ymRecap)}</span>
          <select aria-label="Mois du récap" data-recap-mois-choix="" value={ymRecap} onChange={(e)=>setYmRecap(e.target.value)} style={{height:44,borderRadius:12,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:15,padding:'0 10px',fontFamily:'inherit'}}>
            {moisChoix.map((ym)=><option key={ym} value={ym}>{libelleMois(ym)}</option>)}
          </select>
        </div>
        <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          <Bouton variante="primaire" icone="doc" data-recap-pdf="" disabled={!!recapEnCours} onClick={()=>exporterRecap('pdf')} style={{flex:'1 1 140px'}}>{recapEnCours==='pdf'?'…':'Télécharger en PDF'}</Bouton>
          <Bouton variante="secondaire" icone="save" data-recap-csv="" disabled={!!recapEnCours} onClick={()=>exporterRecap('csv')} style={{flex:'1 1 140px'}} title="Un fichier pour Excel ou Numbers">{recapEnCours==='csv'?'…':'Télécharger en tableur'}</Bouton>
        </div>
      </div></Card>
      {/* Récap comptable mensuel */}
      {moisRecap.length>0&&(
        <Card><details className="vrm-repli" data-recap-repli="">
          <summary style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
            <span data-titre-section="" style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15}}>Récap comptable mensuel</span><span style={{fontSize:13,color:C.muted,fontWeight:500,marginLeft:'auto'}}>{moisRecap.length} mois</span>
          </summary>
          <div style={{display:'flex',justifyContent:'flex-end',margin:'8px 0 10px'}}><Btn small outline onClick={exportCompta} style={{fontSize:13}}>Exporter (CSV)</Btn></div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {['Mois','Ventes','CA finalisé',NOM_BENEFICE,`Cotis.+impôt ${String(tauxUrssaf()).replace('.',',')}\u00a0%`,'CA après URSSAF'].map(h=>(
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
                    <td data-benef-notion="benefice" data-benef-mois={m.ym} data-benef-valeur={m.profit==null?'':String(Math.round(m.profit*100))} style={{padding:'8px 10px',textAlign:'right',color:m.profit==null?C.muted:C.text,whiteSpace:'nowrap'}}>{m.profit==null?'—':fmt(m.profit)}</td>
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
              : <>Ventes de l'ancienne archive, à leur date de réception — annulées et remboursements exclus.</>} Le bénéfice, lui, est celui de Comptabilité (« Combien j'ai gagné ? ») : ventes au jour de la vente, moins prix d'achat, frais, dépenses et URSSAF ; « — » quand un prix d'achat manque. Cotisations estimées à {String(tauxUrssaf()).replace('.',',')}&nbsp;% (taux réglable dans Argent → Déclarer → Ton entreprise). La déclaration se fait sur autoentrepreneur.urssaf.fr.
          </div>
        </details></Card>
      )}


    </>
  );
}
// ⟦← App.jsx #33⟧

function ComptaLigne({ gauche, droite, onDel, extra, attrs }) {
  return (
    <div className="vrm-set-ligne" {...(attrs || {})}>
      <span className="vrm-set-lib">{gauche}</span>
      <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{droite}</span>
      {extra}
      <button type="button" onClick={onDel} title="Supprimer" aria-label="Supprimer" data-compta-supprimer="" style={{ border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 0, minHeight: 44, minWidth: 44, marginRight: -10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={16} /></button>
    </div>
  );
}
// (16 oct.) Une section = un GROUPE comme dans Réglages : le titre en casse
// normale au-dessus (son total à droite), une liste à lignes, la note en pied.
// Le formulaire d'ajout ne s'ouvre plus d'office : une ligne « + Ajouter… »
// le déplie dans la liste (trois formulaires toujours ouverts écrasaient
// l'écran, placeholders tronqués compris).
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
// Ligne « + Ajouter… » d'une section : déplie le formulaire dans la liste.
function ComptaAjout({ ouvert, onClick, libelle, data }) {
  return (
    <button type="button" className="vrm-set-ligne" onClick={onClick} aria-expanded={ouvert} {...data} style={{ color: C.accentTexte }}>
      <span className="vrm-set-lib"><b style={{ color: C.accentTexte, fontWeight: 600 }}>{ouvert ? 'Fermer' : `+ ${libelle}`}</b></span>
    </button>
  );
}
// ── TON BÉNÉFICE, BRUT ET NET (19 octobre, Julien : « le bénéfice brut et net ») ─
// AUCUNE règle de vente ni aucun prix d'achat n'est relu ici (§11) :
//   · BRUT et NET DES VENTES = la somme des jours publiés par l'écran Ventes
//     (`vrm_benefice_jours`, `ajouterVenteBenefice`) — le même nombre que ses
//     cartes « Bénéfice brut / net » sur la même période ;
//   · CHARGES = `comptaChargesMois` / `comptaChargesAnnee` (celles de cet écran) ;
//   · COTISATIONS = `aPayerUrssaf` sur la part VINTED du CA déclaré publié
//     (`vinted_urssaf_mois`) ; depuis la publication `v: 2` (Leboncoin et eBay
//     reliés par identité), sur le CA déclaré des trois (`caBeneficeDuMois`).
// Le NET final n'est écrit que si TOUTES les ventes de la période ont leur prix
// d'achat : sinon un « — », la raison, et la porte (saisie en série). Trois
// états : `encours` (nuage pas arrivé) · `passu` (jamais publié) · `lu`.
const PERIODES_BENEF = [['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];
// ⟦← App.jsx #34⟧
// ── (2 nov.) COMPTA « FUSION » (le style choisi par Julien sur les maquettes) ──
// Sous « Combien j'ai gagné ? » (dont la carte devient la carte SOMBRE, en CSS) :
// l'anneau (où passe l'argent vendu du mois) et les barres des six derniers mois.
// AUCUN chiffre n'est calculé ici (§5) et AUCUN montant n'est redit (§7) : le
// grand chiffre et le détail du calcul vivent dans `BeneficeCompta` ; ici, des
// PARTS (en %) et des hauteurs de barre (le montant de chaque mois en infobulle).
//   · le mois = `useBeneficeCalcul(compta, 'mois')` — la MÊME lecture que la carte ;
//   · les six mois = `beneficeDesJours` sur la même publication (`vrm_benefice_jours`),
//     brut des ventes au prix d'achat connu ; un mois sans aucun prix connu ⇒ barre
//     en pointillé (« pas su », jamais 0).
// L'anneau ne se dessine que si le NET du mois se calcule (tous les prix d'achat,
// frais et cotisations connus) : ses parts somment alors au vendu du mois.
// ── (3 nov.) LA PRÉVISION URSSAF, VISIBLE EN STYLE FUSION ─────────────────
// La carte « Prochaine déclaration » (`CarteUrssafMois`) est masquée par la
// Fusion (fusion.css §15) : la prévision de la prochaine échéance vit ICI, en
// tête de « Combien je dois déclarer ? ». Une règle : `previsionUrssaf`
// (src/previsionUrssaf.js) avec les règles d'argent de l'app. Aucune phrase :
// la période, le montant (« au moins » si partiel), la date, « N à dater ».
// ── (5 nov., chantier F) « URSSAF EN UN GESTE » ────────────────────────────
// La période finie (la déclaration est ouverte), la carte devient la feuille à
// recopier : le chiffre d'affaires EXACT de la période (`previsionUrssaf`, la
// ligne publiée datée au versement — rien de recalculé), « Copier » à côté, les
// cotisations estimées pour contrôler ce que le site affichera, ce qui MANQUE
// (« 3 ventes sans date de versement », avec le geste), puis le site et « J'ai
// déclaré » (le registre `vrm_urssaf_declare`, sur SON clic seulement). Période
// en cours : une prévision, sans « Copier » (on ne recopie pas un minimum).
// Jamais « encaissé » (§5).
const copierPresse = async (texte) => {
  try { await navigator.clipboard.writeText(String(texte)); return true; } catch (_) {}
  try {
    const t = document.createElement('textarea'); t.value = String(texte); t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return !!ok;
  } catch (_) { return false; }
};
// Le montant tel qu'il se tape dans un formulaire : chiffres et virgule, sans espace ni « € ».
const montantARecopier = (v) => (v == null || !Number.isFinite(Number(v)) ? '' : (Math.round(Number(v) * 100) / 100).toFixed(2).replace(/\.00$/, '').replace('.', ','));
// (10 nov., Argent) La prévision de la prochaine échéance, lue UNE fois de la même façon par
// la carte « Prochaine déclaration » et par le widget « À déclarer » du Résumé (§5 : une règle).
function usePrevisionUrssaf() {
  const regime = useRegimeFiscal();
  const ligne = useLigneUrssaf();
  const [regLu, regPret] = useLigneSynchro('vrm_urssaf_declare', lireDeclarations);
  const [rythme, setRythme] = React.useState(() => load('vinted_urssaf_freq', null));
  React.useEffect(() => onCloudReady(() => setRythme(load('vinted_urssaf_freq', null))), []);
  React.useEffect(() => { const h = (e) => { if (e && e.detail && e.detail.k === 'vinted_urssaf_freq') setRythme(load('vinted_urssaf_freq', null)); }; window.addEventListener('vrm:save', h); return () => window.removeEventListener('vrm:save', h); }, []);
  const P = previsionUrssaf({ regime, rythme, now: new Date(), ligne, declare: regPret ? regLu : null, taux: tauxUrssaf(),
    regle: { nextUrssafDeadline, moisPeriodeUrssaf, montantPeriodeUrssaf, moisDeclare } });
  return { P, ligne, regLu, regPret };
}
// ── (10 nov., Argent) LES QUATRE RÉPONSES EN TÊTE DU RÉSUMÉ ─────────────────
// « Combien j'ai vendu ce mois ? », « Combien j'ai reçu ? », « Mon bénéfice ? »,
// « Combien je dois déclarer, et quand ? ». Aucun calcul ici : `valeurChiffre` (les
// MÊMES valeurs que la carte de Ma journée), `previsionUrssaf` (la carte « Prochaine
// déclaration ») et `profilFiscal`, mis en mots par `questionsArgent` (src/argent.js).
// Toucher un widget = son détail : Statistiques, « Vendu et reçu », « Ton bénéfice »,
// « Déclarer ».
const dateArgentCourte = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
function ArgentQuestions({ liveStats, onNav, allerVue }) {
  const liveCoque = React.useContext(LiveStatsCarte);
  const S = useSourcesCarte(liveStats || liveCoque);
  const { P } = usePrevisionUrssaf();
  const profil = useProfilFiscal();
  const sel = { site: 'toutes', compte: null, periode: null };
  const v = (id) => valeurChiffre(id, { id, p: 'mois' }, S, sel, REGLES_CARTE);
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'short' });   // « nov. » : le libellé tient sur une ligne au téléphone
  const Q = questionsArgent({ vendu: v('vendu'), recu: v('recu'), benefice: v('benefice'), prevision: P, profil, raisonCourte, mois, dateCourte: dateArgentCourte });
  const aller = (q) => {
    if (q.aller === 'stats') { if (onNav) onNav('dashboard'); return; }
    if (q.aller === 'declarer') { if (allerVue) allerVue('declarer'); try { window.scrollTo({ top: 0 }); } catch (_) {} return; }
    ouvrirRepliCompta(q.aller);
  };
  const somme = (x) => (Math.abs(Number(x)) < 1000 ? montant(x) : montant(x, { centimes: 'jamais' }));
  return (
    <section className="vrm-argent-q" aria-label="L’argent du mois" data-argent-questions="">
      {Q.map((q) => (
        <button key={q.id} type="button" className="vrm-argent-w" data-argent-q={q.id}
          data-argent-valeur={q.valeur == null ? '' : String(Math.round(q.valeur * 100))} data-argent-partiel={q.partiel ? '1' : undefined}
          data-argent-raison={q.raison || undefined} data-argent-echeance={q.echeance ? String(q.echeance) : undefined}
          aria-label={`${q.question} ${q.valeur == null ? (q.texte || 'pas su') : (q.partiel ? 'au moins ' : '') + somme(q.valeur)}${q.note ? ', ' + q.note : ''}`}
          onClick={() => aller(q)}>
          <span className="vrm-argent-w-l">{q.libelle}</span>
          <b className="vrm-argent-w-n" data-argent-pas-su={q.valeur == null && !q.texte ? '' : undefined}>
            {q.valeur != null ? <>{q.partiel ? <small>au moins </small> : null}{somme(q.valeur)}</> : (q.texte || '—')}
          </b>
          {q.note ? <span className="vrm-argent-w-note">{q.note}</span> : null}
          <span className="vrm-argent-w-chev" aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  );
}
// (11 nov., lot DJ7) « 1 756 ventes sans date de versement » ⇒ ce qui est daté, ce qui
// manque, POURQUOI (src/versementRaisons.js, publié par Ventes avec la ligne), et LE geste.
// Rien n'est daté ici : une vente reste dans aucun mois tant que sa date n'est pas lue (§5).
const nbAd = (n) => Number(n || 0).toLocaleString('fr-FR');
const plAd = (n, s = 's') => (Number(n) > 1 ? s : '');
function ADaterRaisons({ ad, n, periodeAd, label, onDater }) {
  const d = ad.datees && Number.isFinite(Number(ad.datees.n)) ? ad.datees : null;
  const lignes = [];
  for (const r of ad.raisons) {
    if (!r || !(r.n > 0)) continue;
    if (r.cle === 'vinted-detail') {
      const comptes = Array.isArray(r.comptes) && r.comptes.length ? r.comptes : [{ uid: '', nom: '', n: r.n }];
      for (const c of comptes) lignes.push(
        <li key={'d' + c.uid} data-adater-raison="vinted-detail" data-adater-compte={c.uid || ''} data-n={c.n}>
          <span><b>{nbAd(c.n)}</b> {c.nom ? <>sur <b>{c.nom}</b></> : 'sur Vinted'} : vente{plAd(c.n)} pas encore relue{plAd(c.n)}.</span>
          <Bouton variante="discret" href="https://www.vinted.fr/" target="_blank" rel="noopener noreferrer" data-adater-geste="vinted">Ouvrir Vinted ↗</Bouton>
        </li>);
    } else if (r.cle === 'leboncoin') lignes.push(
      <li key="lbc" data-adater-raison="leboncoin" data-n={r.n}>
        <span><b>{nbAd(r.n)}</b> Leboncoin : date à recopier.</span>
        <Bouton variante="discret" data-urssaf-dater="" data-adater-geste="main" onClick={onDater}>Dater à la main</Bouton>
      </li>);
    else if (r.cle === 'vestiaire') lignes.push(
      <li key="vc" data-adater-raison="vestiaire" data-n={r.n}>
        <span><b>{nbAd(r.n)}</b> Vestiaire : versement pas encore lu.</span>
        <Bouton variante="discret" href="https://fr.vestiairecollective.com/" target="_blank" rel="noopener noreferrer" data-adater-geste="vestiaire">Ouvrir Vestiaire ↗</Bouton>
      </li>);
    else lignes.push(
      <li key={r.cle} data-adater-raison={r.cle} data-n={r.n}>
        <span><b>{nbAd(r.n)}</b> {r.cle === 'vinted-attente' ? 'Vinted : pas encore finalisée' + plAd(r.n) + ', relue' + plAd(r.n) + ' seule' + plAd(r.n) + '.' : r.cle === 'vinted-passu' ? 'Vinted : pas su (lecture ratée).' : 'eBay : commande sans date.'}</span>
      </li>);
  }
  return (
    <div className="vrm-adater" data-adater-raisons="">
      <span>
        {d ? <><b data-adater-datees={d.n}>{nbAd(d.n)} datée{plAd(d.n)} ✓</b>{d.releve > 0 ? <span data-adater-releve={d.releve}> dont {nbAd(d.releve)} par ton porte-monnaie</span> : null} · </> : null}
        <b data-adater-sans={n}>{nbAd(n)} vente{plAd(n)} sans date</b> : pas dans ce montant.
        {periodeAd ? <> Elles ont été <span data-urssaf-adater-periode="">{periodeAd}</span> ; une vente versée en {label} y manquerait.</> : null}
      </span>
      <ul className="vrm-adater-liste">{lignes}</ul>
      <Pourquoi ecrit>La date qui compte est celle où Vinted crédite ton porte-monnaie (« Commande finalisée »). Payer ensuite avec ton solde ne la change pas. VRM la lit dans le détail de chaque vente, quelques-unes à chaque visite sur Vinted. Elle n’est jamais devinée : sans elle, la vente n’est dans aucun mois.</Pourquoi>
    </div>
  );
}
function PrevisionUrssafCarte({ onNav }) {
  const { P, ligne, regLu, regPret } = usePrevisionUrssaf();
  const [copie, setCopie] = React.useState('');
  // (5 nov., chantier F, revue 2.27) Statut pas choisi : rien ici — la question « Quel est ton
  // statut ? » est posée juste dessous, et c'est le SEUL endroit où il se choisit.
  if (P.etat === 'encours' || P.etat === 'horsMicro' || P.etat === 'aucune' || P.etat === 'statut') return null;
  const date = P.dueDate ? new Date(P.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  const periode = P.label ? P.label.charAt(0).toUpperCase() + P.label.slice(1) : '';
  // La déclaration est OUVERTE quand la période est finie (le rappel de Ma journée dit la même chose).
  const ouverte = (P.etat === 'lu' || P.etat === 'passu') && !P.enCours;
  const aNoter = ouverte && regPret ? (P.mois || []).filter((ym) => !moisDeclare(regLu, ym)) : [];
  const jour = P.daysLeft == null ? '' : P.daysLeft <= 0 ? 'aujourd’hui, dernier jour' : P.daysLeft === 1 ? 'demain' : `dans ${P.daysLeft} jours`;
  const urgent = ouverte && P.daysLeft != null && P.daysLeft <= 1;
  const copier = async (k, v) => { const ok = await copierPresse(v); if (ok) { setCopie(k); setTimeout(() => setCopie((c) => (c === k ? '' : c)), 1800); } else toast('Copie impossible ici : sélectionne le montant et copie-le.'); };
  const vers = (id) => { try { ouvrirRepliCompta(id); } catch (_) {} };
  const attrs = { 'data-prevision-carte': P.etat, 'data-prevision-label': P.label || '', 'data-prevision-ca': P.ca == null ? '' : String(P.ca), 'data-prevision-apayer': P.apayer == null ? '' : String(P.apayer), 'data-prevision-partiel': P.partiel ? '1' : '', 'data-prevision-adater': P.aDater || '', 'data-prevision-encours': P.enCours ? '1' : '', 'data-urssaf-geste': ouverte ? 'recopier' : 'prevision' };
  if (P.etat === 'rythme') {
    return (
      <section className="vrm-fu-declaration is-calme vrm-fu-prevision" {...attrs} aria-label="Prochaine échéance URSSAF">
        <div><b className="vrm-fu-prevision-montant">—</b><span>URSSAF · choisis ton rythme de déclaration</span></div>
        <Segmente label="Rythme de déclaration" value={null} onChange={(f) => save('vinted_urssaf_freq', f)}
          options={[{ v: 'mensuel', l: 'Par mois', data: { 'data-prevision-rythme': 'mensuel' } }, { v: 'trimestriel', l: 'Par trimestre', data: { 'data-prevision-rythme': 'trimestriel' } }]} />
      </section>
    );
  }
  if (!ouverte) {
    return (
      <section className="vrm-fu-declaration is-calme vrm-fu-prevision" {...attrs} aria-label="Prochaine échéance URSSAF">
        <div>
          <b className="vrm-fu-prevision-montant">{P.etat === 'lu' ? <>{P.partiel ? <small>au moins </small> : null}{fmt(P.apayer)}</> : '—'}</b>
          <span>URSSAF · {periode} · à déclarer avant le {date}{P.aDater > 0 ? ` · ${P.aDater} à dater` : ''}</span>
        </div>
      </section>
    );
  }
  const caTxt = montantARecopier(P.ca);
  // (6 nov.) « DÉCLARER CE MOIS » EN TROIS ÉTAPES — Julien : « on doit être beaucoup plus
  // accompagné ». 1 · ce qui est sûr (le montant à recopier, ses cotisations) ; 2 · ce qui
  // manque et le geste qui le complète ; 3 · recopier sur le site, puis « J'ai déclaré ».
  // Chaque chiffre a son « ? » : la phrase vient de la MÊME ligne publiée que lui
  // (`ligne.mois` des mois de la période, `tauxUrssaf()`), jamais d'un second calcul.
  const moisP = Array.isArray(ligne && ligne.mois) ? ligne.mois.filter((m) => m && (P.mois || []).includes(m.ym)) : [];
  const nP = moisP.reduce((t, m) => t + (Number(m.n) || 0), 0);
  const parP = {};
  for (const m of moisP) for (const [k, v] of Object.entries(m.par || {})) parP[k] = (parP[k] || 0) + (Number(v && v.n) || 0);
  const parL = Object.entries(parP).filter(([, n]) => n > 0);
  const parTxt = parL.length > 1 ? parL.map(([k, n]) => `${n} ${k}`).join(', ') : '';   // une seule plateforme : rien à détailler
  const periodeAd = P.aDater > 0 ? periodeADater(ligne && ligne.aDater) : '';
  const tauxTxt = String(tauxUrssaf()).replace('.', ',');
  return (
    <section className={'vrm-urssaf-geste' + (urgent ? ' is-urgent' : '')} {...attrs} data-urssaf-parcours="3" aria-label={`Déclaration URSSAF ${P.label}`}>
      <div className="vrm-urssaf-geste-tete">
        <h3>Déclarer {P.label}</h3>
        <span data-urssaf-echeance={P.daysLeft == null ? '' : String(P.daysLeft)}>avant le {date}{jour ? ` · ${jour}` : ''}</span>
      </div>
      <div className="vrm-urssaf-etape" data-urssaf-etape="1"><span className="vrm-urssaf-num" aria-hidden="true">1</span><b>Ce qui est sûr</b><small>à recopier sur l’URSSAF</small></div>
      <div className="vrm-urssaf-ligne" data-urssaf-ligne="ca" data-eur={P.ca == null ? '' : String(P.ca)}>
        <span className="vrm-urssaf-lib"><b>Chiffre d’affaires <SourceChiffre id="ca">{P.ca == null ? <>Il se calcule dans l’écran Ventes, à partir de tes ventes lues : ouvre-le une fois.</> : <>La somme de {nP === 1 ? 'ta vente finalisée' : `tes ${nP} ventes finalisées`}{parTxt ? ` (${parTxt})` : ''} dont l’argent t’a été versé en {P.label} : Vinted au jour où la transaction passe « finalisée », Leboncoin au jour de la vente, eBay au jour de la commande payée. Seulement les comptes que tu as choisis ; une vente déjà déclarée reste dans le mois où tu l’as déclarée. Le même calcul que Ventes.</>}</SourceChiffre></b><small>ventes de marchandises · reçu sur la période</small></span>
        <span className="vrm-urssaf-val">{P.ca == null ? '—' : <>{P.partiel ? <small>au moins </small> : null}{fmt(P.ca)}</>}</span>
        {P.ca != null ? <button type="button" className="vrm-urssaf-copier" data-urssaf-copier="ca" data-urssaf-texte={caTxt} aria-label={`Copier ${caTxt}`} onClick={() => copier('ca', caTxt)}>{copie === 'ca' ? VERBES.copie : VERBES.copier}</button> : <span className="vrm-urssaf-copier-vide" aria-hidden="true"/>}
      </div>
      <div className="vrm-urssaf-ligne" data-urssaf-ligne="cotis" data-eur={P.apayer == null ? '' : String(P.apayer)}>
        <span className="vrm-urssaf-lib"><b>Cotisations <SourceChiffre id="cotis">{P.apayer == null ? <>Elles se calculent sur le chiffre d’affaires, pas encore calculé.</> : <>{fmt(P.ca)} × {tauxTxt}&nbsp;% (ton taux : Ta micro-entreprise → Ton taux) = {fmt(P.apayer)}. Une estimation pour vérifier : le site de l’URSSAF fait foi.</>}</SourceChiffre></b><small>estimation VRM · {tauxTxt}&nbsp;% : à comparer avec le site</small></span>
        <span className="vrm-urssaf-val">{P.apayer == null ? '—' : <>{P.partiel ? <small>au moins </small> : null}{fmt(P.apayer)}</>}</span>
        <span className="vrm-urssaf-copier-vide" aria-hidden="true"/>
      </div>
      <div className="vrm-urssaf-etape" data-urssaf-etape="2"><span className="vrm-urssaf-num" aria-hidden="true">2</span><b>Ce qui manque</b></div>
      {(P.ca == null || P.partiel || P.aDater > 0) ? (
        <div className="vrm-urssaf-manque" data-urssaf-manque={P.aDater > 0 ? String(P.aDater) : P.ca == null ? 'passu' : 'partiel'}>
          {P.ca == null ? <><span>Pas encore calculé : ouvre l’écran Ventes une fois.</span>{onNav ? <Bouton variante="discret" data-urssaf-ventes="" onClick={() => onNav('cat_ventes')}>Ouvrir Ventes</Bouton> : null}</>
            : P.aDater > 0 && ligne && ligne.aDater && Array.isArray(ligne.aDater.raisons) && ligne.aDater.raisons.length ? <ADaterRaisons ad={ligne.aDater} n={P.aDater} periodeAd={periodeAd} label={P.label} onDater={() => vers('compta-ca')}/>
            : P.aDater > 0 ? <><span>{P.aDater} vente{P.aDater > 1 ? 's' : ''} sans date de versement : pas dans ce montant.{periodeAd ? <> Elles ont été <span data-urssaf-adater-periode="">{periodeAd}</span> ; une vente versée en {P.label} y manquerait : vérifie-les avant de déclarer.</> : null}</span><Bouton variante="discret" data-urssaf-dater="" onClick={() => vers('compta-ca')}>{P.aDater > 1 ? 'Les dater' : 'La dater'}</Bouton></>
            : <>Il manque des ventes pas encore lues : ce montant est un minimum.</>}
        </div>
      ) : <div className="vrm-urssaf-manque" data-urssaf-rien-manque="">Rien : toutes tes ventes finalisées sont datées et lues. Le montant est complet.</div>}
      <div className="vrm-urssaf-etape" data-urssaf-etape="3"><span className="vrm-urssaf-num" aria-hidden="true">3</span><b>Déclarer</b><small>{aNoter.length ? 'recopie le montant sur le site, puis note-le ici' : 'déjà noté ici'}</small></div>
      <div className="vrm-urssaf-gestes">
        <Bouton variante="secondaire" href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" data-fu-declarer-urssaf="" data-urssaf-site="">Ouvrir l’URSSAF ↗</Bouton>
        {aNoter.length ? <Bouton variante="primaire" data-fu-geste="" data-urssaf-cest-declare={aNoter[0]} onClick={() => demanderDeclaration(aNoter[0], onNav)}>J’ai déclaré</Bouton> : null}
      </div>
    </section>
  );
}
// (6 nov.) « D'OÙ VIENT CE CHIFFRE ? » — un « ? » à côté d'un chiffre, qui déplie UNE
// phrase écrite par l'appelant à partir de la MÊME source que le chiffre (§5 : la
// phrase qui explique un chiffre vient de la même source que lui). 44 px au doigt
// (la zone de toucher déborde du rond dessiné).
function SourceChiffre({ id, children }) {
  const [ouvert, setOuvert] = React.useState(false);
  return <>
    <button type="button" className="vrm-source-q" data-source-chiffre={id} aria-expanded={ouvert} aria-label="D’où vient ce chiffre ?" onClick={(e) => { e.stopPropagation(); setOuvert((v) => !v); }}>?</button>
    {ouvert ? <span className="vrm-source-texte" role="note" data-source-texte={id}>{children}</span> : null}
  </>;
}
function ComptaFusion({ compta, onNav }) {
  const { pub, etat, B } = useBeneficeCalcul(compta, 'mois');
  if (etat === 'encours' || !pub) return null;
  const moisLong = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const anneau = (() => {
    if (!B || B.netFinal == null || !(B.ca > 0) || B.nCout !== B.n) return null;
    const cotis = B.cotis || 0, achat = B.cout || 0, benef = B.netFinal;
    const frais = Math.round((B.ca - achat - cotis - benef) * 100) / 100;
    if (benef < 0 || frais < -0.01) return null;
    const pc = (v) => Math.round((v / B.ca) * 100);
    return { total: B.ca, pct: pc(benef), parts: [['benef', 'Bénéfice', benef, pc(benef)], ...(B.sansCotis ? [] : [['cotis', 'URSSAF', cotis, pc(cotis)]]), ['achat', "Prix d'achat", achat, pc(achat)], ['frais', 'Frais, dépenses', Math.max(0, frais), pc(Math.max(0, frais))]] };
  })();
  const R = 52, L = 2 * Math.PI * R;
  let cumul = 0;
  const mois6 = (() => {
    const d = new Date(); const out = [];
    for (let k = 5; k >= 0; k--) {
      const de = new Date(d.getFullYear(), d.getMonth() - k, 1), a = new Date(d.getFullYear(), d.getMonth() - k + 1, 1);
      const r = beneficeDesJours(pub.jours, de, a);
      out.push({ cle: `${de.getFullYear()}-${de.getMonth() + 1}`, l: de.toLocaleDateString('fr-FR', { month: 'short' }), long: de.toLocaleDateString('fr-FR', { month: 'long' }), v: r.nCout > 0 ? r.brut : (r.n === 0 ? 0 : null), n: r.n, nCout: r.nCout, courant: k === 0 });
    }
    return out;
  })();
  const max6 = Math.max(1, ...mois6.map((m) => (m.v != null && m.v > 0 ? m.v : 0)));
  return (
    <div className="vrm-fu-compta vrm-fu-ecran vrm-fu-compta-grille" data-fu-compta="">
      {/* (5 nov., chantier F, revue 2.26) Pas d'anneau à dessiner ⇒ pas de panneau : plus de carte
          blanche vide. La raison (prix d'achat à saisir) est déjà dite, avec son geste, sur la carte du dessus. */}
      {anneau ? <section className="vrm-fu-panneau" aria-label="Où passe l'argent vendu" data-fu-anneau={String(anneau.pct)}>
        {anneau ? (
          <div className="vrm-fu-anneau">
            <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Il te reste ${anneau.pct}\u00a0% de ce que tu as vendu`}>
              <circle cx="66" cy="66" r={R} fill="none" stroke="var(--fu-piste)" strokeWidth="16"/>
              {anneau.parts.map(([cle, , v]) => { const part = anneau.total > 0 ? v / anneau.total : 0; const seg = <circle key={cle} className={'vrm-fu-arc is-' + cle} cx="66" cy="66" r={R} fill="none" strokeWidth="16" strokeDasharray={`${Math.max(0, part * L - 2)} ${L}`} strokeDashoffset={-cumul * L} transform="rotate(-90 66 66)"/>; cumul += part; return seg; })}
              <text x="66" y="68" textAnchor="middle" className="vrm-fu-anneau-centre">{anneau.pct}&nbsp;%</text>
              <text x="66" y="87" textAnchor="middle" className="vrm-fu-anneau-sous">te reste</text>
            </svg>
            <ul className="vrm-fu-legende">
              {anneau.parts.filter(([cle, , v]) => !(cle === 'frais' && !(v > 0))).map(([cle, lib, , p]) => <li key={cle} data-fu-part={cle} data-fu-pct={String(p)}><i className={'is-' + cle}/><span>{lib}</span><b>{p}&nbsp;%</b></li>)}
            </ul>
          </div>
        ) : null}
      </section> : null}
      {/* (5 nov., chantier F) Aucun mois au bénéfice brut connu : une ligne (la raison et le geste), plus six barres plates. */}
      {!mois6.some((m) => m.v != null && m.n > 0) ? (
        <section className="vrm-fu-panneau vrm-fu-mois6-vide" aria-label="Bénéfice brut sur tes ventes, six derniers mois" data-fu-mois6={mois6.map((m) => (m.v == null ? '' : Math.round(m.v))).join(',')} data-fu-mois6-vide="">
          <div className="vrm-fu-panneau-tete"><h3>6 derniers mois</h3><span data-benef-notion="brut">{NOM_BENEFICE_BRUT.toLowerCase()}</span></div>
          <p className="vrm-fu-note">{mois6.some((m) => m.n > 0) ? <>Pas encore de prix d’achat sur tes ventes de ces six mois. <Bouton variante="discret" data-fu-mois6-porte="" onClick={() => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); }}>Les saisir</Bouton></> : 'Aucune vente finalisée sur ces six mois.'}</p>
        </section>
      ) : (
      <section className="vrm-fu-panneau" aria-label="Bénéfice brut sur tes ventes, six derniers mois" data-fu-mois6={mois6.map((m) => (m.v == null ? '' : Math.round(m.v))).join(',')}>
        <div className="vrm-fu-panneau-tete"><h3>6 derniers mois</h3>{/* (3 nov.) Ces barres sont le BRUT (ventes − prix d'achat) : elles portent son nom (src/beneficeNoms.js), jamais « bénéfice » seul. */}<span data-benef-notion="brut">{NOM_BENEFICE_BRUT.toLowerCase()}</span></div>
        <div className="vrm-fu-barres">
          {mois6.map((m) => (
            <div key={m.cle} className="vrm-fu-barre" data-courant={m.courant ? '' : undefined} data-vide={m.v == null ? '' : undefined}
              title={m.v == null ? `${m.long} : aucun prix d'achat connu (${m.n} vente${m.n > 1 ? 's' : ''})` : `${m.long} : ${fmt(m.v)}${m.nCout < m.n ? ` · ${m.nCout} vente${m.nCout > 1 ? 's' : ''} sur ${m.n} au prix d'achat connu` : ''}`}>
              <div className="vrm-fu-barre-piste"><i style={{ height: m.v == null ? '24%' : `${Math.max(3, (Math.max(0, m.v) / max6) * 100)}%` }}/></div>
              <span>{m.l}</span>
            </div>
          ))}
        </div>
      </section>
      )}
      {/* (5 nov., chantier F) « Déclaration URSSAF · J'ai déclaré » vit dans la carte « À recopier sur l'URSSAF » (question 2) : un seul endroit. */}
    </div>
  );
}
// ⟦← App.jsx #35⟧
function BeneficeCompta({ compta, onNav, onSansDepenses, onAjouterDepense, sansCompte = false }) {
  const [nuagePret, setNuagePret] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => setNuagePret(true)), []);
  const [periode, setPeriode] = React.useState(() => { try { const v = localStorage.getItem('vrm_compta_periode_benef'); return PERIODES_BENEF.some(([k]) => k === v) ? v : 'mois'; } catch (_) { return 'mois'; } });
  const choisir = (p) => { setPeriode(p); try { localStorage.setItem('vrm_compta_periode_benef', p); } catch (_) {} };
  const { pub, etat, B } = useBeneficeCalcul(compta, periode);
  // (5 nov., chantier F, revue 1.7) « À déclarer » sans statut choisi (ou pour un particulier,
  // qui n'a rien à déclarer) : « — » et la raison, jamais un « 0 € » qui se lirait « rien à
  // déclarer ». La case reste la même (`declarer`) ; seule sa valeur est dite « pas su ».
  const regimeCarte = useRegimeFiscal();
  const declarerSansStatut = regimeCarte === null || regimeCarte === 'particulier';
  const locauxCarte = declarerSansStatut ? { declarer: { ...CHIFFRES_CARTE.declarer, valeur: null, raison: 'statut',
    titre: regimeCarte === null ? 'À déclarer : choisis d’abord ton statut' : 'À déclarer : rien à l’URSSAF pour un particulier',
    // (chantier E1) La raison courte écrite sous le « — » de la case (`raisonCourte`, carteChiffres.js).
    raisonCourte: regimeCarte === null ? 'statut à choisir' : 'particulier',
    attrs: { 'data-declarer-sans-statut': regimeCarte === null ? 'pas-choisi' : 'particulier' } } } : null;
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); };
  const e2 = (x) => x == null ? '' : String(Math.round(x * 100) / 100);
  const sansAchat = B ? B.n - B.nCout : 0;
  const Ligne = ({ lib, val, sous, fort, data }) => (
    <div className="vrm-set-ligne" {...(data || {})}>
      <span className="vrm-set-lib"><b style={{ color: C.text }}>{lib}</b>{sous ? <small style={{ color: C.muted }}>{sous}</small> : null}</span>
      <span className="vrm-display" style={{ fontSize: fort ? 20 : 15, fontWeight: fort ? 700 : 600, color: val == null ? C.muted : C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{val == null ? '—' : fmt(val)}</span>
    </div>
  );
  const lienSaisie = <button type="button" onClick={versSaisiePrix} data-benef-porte="" className="vrm-lien-action" style={{ background: 'none', border: 0, padding: 0, color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Compléter les prix d'achat</button>;
  // (2 nov., « surtout comptabilité ») LA PREMIÈRE QUESTION : « Combien j'ai
  // gagné ? ». Un chiffre (le net de `beneficePeriode`, inchangé), une phrase
  // venue du MÊME calcul (sa raison, sa couverture), le geste qui le complète ;
  // les lignes du calcul (brut, frais, charges, cotisations) se replient sous
  // « Le détail du calcul » — elles redisaient sur l'écran le « à payer »
  // URSSAF et les dépenses du mois (§7 : un nombre, une fois).
  const titreNet = B && B.depenses === 'jamais' ? 'Net avant tes dépenses' : 'Ton bénéfice';
  const phrase = !B ? null
    : B.raison === 'achats' ? <>Il manque le prix d'achat de {sansAchat} vente{sansAchat > 1 ? 's' : ''} sur {B.n} : sans lui, VRM ne peut pas calculer ce que tu as gagné.</>
    : B.raison === 'frais' ? <>Des frais eBay ne sont pas encore connus : sans eux, VRM ne peut pas calculer ce que tu as gagné.</>
    : B.raison === 'cotisations' ? <>En attente de ton chiffre d'affaires déclaré : ouvre l'écran Ventes une fois.</>
    : B.raison === 'rien' ? <>Aucune vente finalisée ni dépense sur la période : rien à calculer.</>
    : B.n === 0 ? <>Aucune vente finalisée sur la période{B.depenses === 'jamais' ? '' : ' : seules tes dépenses comptent'}.</>
    : <>Ce qu'il te reste{B.depenses === 'jamais' ? ' avant tes dépenses' : ''} : tes ventes finalisées, moins le prix d'achat des paires{B.fraisCouverts > 0 ? ', les frais de vente' : ''}{B.depenses === 'jamais' ? '' : ', tes dépenses'}{B.sansCotis ? '' : " et l'URSSAF"}.</>;
  // La couverture n'est redite que si la phrase ne la dit pas déjà (raison « achats »).
  const couverture = !B || B.n === 0 || B.raison === 'achats' ? null
    : B.nCout === B.n ? <>Prix d'achat {B.n === 1 ? 'connu pour 1 vente' : `connus pour les ${B.n} ventes`}.</>
    : <span data-benef-manque="" style={{ color: C.warn }}>Prix d'achat {B.nCout > 1 ? 'connus' : 'connu'} pour {B.nCout} vente{B.nCout > 1 ? 's' : ''} sur {B.n}.</span>;
  return (
    <section className="vrm-compta-q" data-compta-q="gagne" style={{ margin: 0 }}
      data-benef-etat={etat} data-benef-periode={periode}
      data-benef-n={B ? String(B.n) : ''} data-benef-ncout={B ? String(B.nCout) : ''}
      data-benef-brut={B && B.nCout > 0 ? e2(B.brut) : ''} data-benef-ventes-net={B && B.nCout > 0 ? e2(B.net) : ''}
      data-benef-charges={B ? e2(B.charges) : ''} data-benef-cotis={B ? e2(B.cotis) : ''}
      data-benef-net={B ? e2(B.netFinal) : ''} data-benef-raison={B ? B.raison : ''}
      data-benef-couverture={B ? couvertureBenefice(B) : ''} data-benef-plateformes={B ? (B.toutes ? 'toutes' : 'vinted') : ''}
      data-benef-depenses={B ? (nuagePret ? B.depenses : 'passu') : ''}>
      <div className="vrm-compta-q-tete">
        <h2 className="vrm-compta-question" data-compta-question="gagne"><span className="vrm-compta-q-n" aria-hidden="true">1</span>Combien j'ai gagné ?</h2>
        {/* (30 oct.) Sans bénéfice publié, changer de période ne changeait rien : le choix attend. */}
        {B && <Segmente label="Période du bénéfice" plein value={periode} onChange={choisir} className="vrm-compta-periode"
          options={PERIODES_BENEF.map(([k, l]) => ({ v: k, l, data: { 'data-benef-choix': k } }))} />}
      </div>
      <div className="vrm-compta-carte" data-fu-carte="">
        {!B ? (
          <p className="vrm-compta-phrase" data-compta-phrase="gagne" style={{ margin: 0 }}>
            {etat === 'encours' ? 'Je lis ton bénéfice…' : sansCompte ? <span data-benefice-sans-compte="">Ton bénéfice arrivera ici dès qu’un compte Vinted sera relié (le bandeau du haut dit comment).</span> : <>Ton bénéfice se calcule dans l'écran Ventes, à partir de tes prix d'achat : ouvre-le une fois{onNav ? <> (<a href="?tab=cat_ventes" onClick={(ev) => { ev.preventDefault(); onNav('cat_ventes'); }} style={{ color: C.accentTexte, fontWeight: 600, textDecoration: 'none' }}>Ventes</a>)</> : null}, il arrivera ici.</>}
          </p>
        ) : (<>
          {/* (2 nov., 22 h, maquette FusionCompta « à l'identique ») « Ce que tu as gagné », le
              chiffre, UNE ligne courte (le vendu, le manque nommé et son geste), trois cases. */}
          {/* (3 nov., carte réglable par page) Le grand chiffre et les trois cases de cette carte se
              choisissent (« Modifier ») ; défaut = la maquette : bénéfice (`chiffreBenefice`, CETTE
              lecture), à déclarer, URSSAF, ventes finalisées — de la période choisie au-dessus. */}
          <CarteStatsApp page="compta" nu ici="compta" onNav={onNav} sel={{ site: 'toutes', compte: null, periode }} locaux={locauxCarte} attrs={{ 'data-benef-titre': '', title: `${titreNet} · ${B.libelle}` }}
            attrsDe={(x) => x.place.id === 'benefice' ? { 'data-compta-chiffre': 'gagne', 'data-eur': e2(x.valeur) } : (x.place.id === 'declarer' || x.place.id === 'urssaf') ? { 'data-fu-case': x.place.id, 'data-eur': e2(x.valeur) } : null}/>
          {/* (3 nov., finitions) Aucune vente finalisée : plus de phrase sous la carte (la carte dit « — »/0). */}
          {(() => {
            // (5 nov., chantier F) La phrase sous la carte : seulement ce qu'elle a À DIRE (plus de
            // paragraphe vide), chaque morceau séparé par « · » sans jamais en commencer un.
            const morceaux = [];
            if (B.n > 0) morceaux.push((B.caDecl != null && Math.round(B.caDecl * 100) === Math.round(B.ca * 100)) ? <span key="v">{B.libelle}</span> : <span key="v">sur {fmt(B.ca)} vendus</span>);
            if (B.nCout < B.n) morceaux.push(<button key="p" type="button" onClick={versSaisiePrix} data-benef-porte="" data-benef-manque="" className="vrm-lien-action">{sansAchat} prix d'achat à saisir</button>);
            if (B.raison === 'frais') morceaux.push(<span key="f">frais eBay pas connus</span>);
            else if (B.raison === 'cotisations') morceaux.push(<span key="c">CA déclaré pas encore calculé</span>);
            if (regimeCarte === null) morceaux.push(<span key="s" data-declarer-raison="">à déclarer : choisis ton statut, plus bas</span>);
            if (!morceaux.length) return null;
            return <p className="vrm-compta-phrase vrm-fu-compta-sous" data-compta-phrase="gagne" title={typeof phrase === 'string' ? phrase : undefined}>
              {morceaux.map((m, i) => <React.Fragment key={i}>{i ? ' · ' : ''}{m}</React.Fragment>)}
            </p>;
          })()}
          {B.depenses === 'jamais' && nuagePret && onSansDepenses ? (
            <div className="vrm-compta-geste"><ChoixDepenses onAucune={onSansDepenses} onAjouter={onAjouterDepense} /></div>
          ) : onAjouterDepense && nuagePret ? (
            <div className="vrm-compta-geste"><button type="button" className="vrm-lien-action" data-benef-ajouter-depense="" onClick={onAjouterDepense} style={{ background: 'none', border: 0, padding: 0, color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Ajouter une dépense</button></div>
          ) : null}
          {/* Le calcul, ligne par ligne : replié (il se lit une fois). */}
          <details className="vrm-repli vrm-compta-calcul" data-benef-calcul="">
            <summary>Le détail du calcul</summary>
            <div className="vrm-set-liste vrm-compta-lignes" style={{ '--vrm-set-filet': C.border }}>
              <Ligne lib={NOM_BENEFICE_BRUT} val={chiffreBrut(B).valeur}
                sous={B.n === 0 ? (B.toutes ? 'aucune vente finalisée sur la période' : 'aucune vente Vinted finalisée sur la période')
                  : B.nCout === B.n ? (B.n === 1 ? "prix de vente − prix d'achat · prix d'achat connu pour 1 vente" : `prix de vente − prix d'achat · prix d'achat connus pour les ${B.n} ventes`)
                  : `prix de vente − prix d'achat · prix d'achat connus pour ${B.nCout} vente${B.nCout > 1 ? 's' : ''} sur ${B.n}`}
                data={{ 'data-benef-ligne': 'brut', ...chiffreBrut(B).attrs }} />
              {B.nCout > 0 && (B.fraisCouverts > 0 || B.fraisInconnus > 0) && <Ligne lib="− boosts et frais de vente" val={B.fraisInconnus > 0 ? null : B.fraisCouverts} sous={B.fraisInconnus > 0 ? `frais eBay pas connus pour ${B.fraisInconnus} vente${B.fraisInconnus > 1 ? 's' : ''}` : 'des mêmes ventes'} data={{ 'data-benef-ligne': 'frais' }} />}
              <Ligne lib="− tes dépenses" val={B.depenses === 'jamais' ? null : B.charges}
                sous={B.depenses === 'jamais' ? 'aucune dépense notée' : B.depenses === 'aucune' ? 'aucune — tu as indiqué ne pas avoir de dépenses à noter' : 'abonnements, dépenses, packs et coûts fixes de la période'}
                data={{ 'data-benef-ligne': 'charges' }} />
              {B.sansCotis ? <div className="vrm-set-ligne" data-benef-ligne="cotis" data-benef-sans-cotis=""><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0 }}>Aucune cotisation URSSAF déduite — {regimeFiscal() ? `statut : ${libelleRegime(regimeFiscal())}` : 'ton statut n\'est pas encore choisi (« Combien je dois déclarer ? »)'}.</small></span></div> :
              <Ligne lib="− URSSAF" val={B.cotis}
                sous={B.cotis == null ? 'ton chiffre d\'affaires déclaré se calcule dans l\'écran Ventes' : `${String(tauxUrssaf()).replace('.', ',')}\u00a0% des mêmes ventes (${fmt(B.ca)})`}
                data={{ 'data-benef-ligne': 'cotis' }} />}
              <div className="vrm-set-ligne" data-benef-ligne="net"><span className="vrm-set-lib"><b style={{ color: C.text }}>= {titreNet.toLowerCase()}</b></span><span className="vrm-set-lib" style={{ flex: '0 0 auto', textAlign: 'right' }}><small style={{ color: C.muted, marginTop: 0 }}>le chiffre au-dessus</small></span></div>
            </div>
            <small style={{ color: C.muted, lineHeight: 1.5, display: 'block', padding: '10px 2px 4px' }}>
              {B.toutes ? <>Ventes finalisées Vinted, Leboncoin et eBay, au jour de la vente — la même règle que l'écran Ventes.{couvertureBenefice(B) ? ` Prix d'achat connus : ${couvertureBenefice(B)}.` : ''} Une vente Leboncoin ou eBay se relie à son article par son SKU VRM, sa référence ou un lien posé, jamais par son titre.</> : <>Ventes Vinted finalisées, au jour de la vente — publiées par une version d'avant de l'écran Ventes : ouvre-le une fois pour y ajouter Leboncoin et eBay.</>} L'URSSAF déduite est celle des ventes comptées ici (le taux × leur montant) ; celle à payer, datée au versement, se lit dans « Combien je dois déclarer ? ».{pub.at ? ` Calculé avec tes ventes lues le ${new Date(pub.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : ''}
            </small>
          </details>
        </>)}
      </div>
    </section>
  );
}
// ⟦← App.jsx #36⟧
// ══════════════════════════════════════════════════════════════════════════════
// COMPTA · PORTE-MONNAIE (4 nov.) — le solde LU de chaque compte Vinted (disponible ·
// en attente), sa date de lecture, « — » si jamais lu ; les comptes écartés nommés à
// part ; les virements vers la banque quand le relevé les donne. La règle :
// src/porteMonnaie.js. Lectures PROJETÉES (jamais `select=data`).
// ══════════════════════════════════════════════════════════════════════════════
function PorteMonnaieCompta({ accounts, panelOff }) {
  const [lu, setLu] = React.useState(undefined);
  const relire = React.useCallback(async () => {
    const [b, r] = await Promise.all([
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_billing&select=id,cap:data->>capturedAt,main:data->payload->main,escrow:data->payload->escrow,balance:data->payload->balance,pending:data->payload->pending_balance,lignes:data->payload->invoice_lines`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_releve_*&select=id,lignes:data->lignes`),
    ]);
    setLu({ billing: Array.isArray(b) ? b : null, releves: Array.isArray(r) ? r : null });
  }, []);
  React.useEffect(() => { relire(); }, [relire]);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => onCloudReady(() => setTick((t) => t + 1)), []);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const pm = React.useMemo(() => {
    if (lu === undefined) return { etat: 'encours' };
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const noms = load('vinted_account_labels', {}) || {};
    const comptes = (accounts || []).filter((a) => a && a.vinted_user_id != null).map((a) => ({ uid: String(a.vinted_user_id), nom: noms[String(a.vinted_user_id)] || a.login || String(a.vinted_user_id) }));
    return porteMonnaieParCompte({ billing: lu.billing, releves: lu.releves, comptes, ecarte: (uid) => compteEcarte(uid, hAcc, panelOff || {}) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lu, accounts, panelOff, tick]);
  return <PorteMonnaie pm={pm}/>;
}
// ── (5 nov., chantier F) LE BILAN DU MOIS EN UNE PAGE ──────────────────────
// Vendu · Reçu · Dépensé · Bénéfice (et sa couverture) · Paires vendues ·
// Meilleur compte, pour ce mois ou le mois d'avant ; « Télécharger en PDF ».
// Chaque valeur vient de SA règle (src/bilanMois.js le dit) : rien n'est
// recalculé ici. « — » = pas su ; « au moins » = un minimum, le manque nommé.
function BilanMoisCarte({ liveStats, compta }) {
  const [quel, setQuel] = React.useState('courant');
  const [pub] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const ligneUrssaf = useLigneUrssaf();
  const regime = useRegimeFiscal();
  const [envoi, setEnvoi] = React.useState(false);
  const maintenant = Date.now();
  const ymA = ymCourant(maintenant);
  const ym = quel === 'courant' ? ymA : (() => { const [y, m] = ymA.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [y, m] = ym.split('-').map(Number);
  const de = new Date(y, m - 1, 1).getTime(), finMois = new Date(y, m, 1).getTime();
  const enCours = quel === 'courant';
  const a = enCours ? maintenant : finMois;
  const V = liveStats && !liveStats.venduPasSu && Array.isArray(liveStats.venduLignes) ? liveStats.venduLignes : null;
  const vendu = (() => {
    if (!V) return null;
    const r = bilanLignes(V, de, a - 1);
    const nc = (liveStats.venduNonComptees || []).filter((x) => x && x.ts != null && x.ts >= de && x.ts < a);
    const manque = [...new Set([...(liveStats.venduManque || []), ...(liveStats.venduEnAttente ? ['lecture en cours'] : []), ...nc.map((x) => x.plateforme)])];
    return { n: r.n, eur: r.eur, manque };
  })();
  const recu = recuAvecADater(recuPublieEntre(ligneUrssaf, { de, a, ym, complet: !enCours }, maintenant), ligneUrssaf);
  const charges = compta ? comptaChargesMois(compta, ym).total : null;
  const Bm = beneficeDuMoisPub({ pub, compta, ligneUrssaf, regime }, ym, null);
  const CB = Bm ? chiffreBenefice(Bm, 'lu') : { valeur: null, raison: pub ? 'mois pas couvert' : 'publication' };
  const nomGroupe = (l) => (l.plateforme === 'Vinted' ? (l.compte || 'Vinted') : (l.compte ? `${l.compte} (${l.plateforme})` : l.plateforme));
  const meilleur = V ? meilleurCompte(V.filter((l) => l.ts >= de && l.ts < a), nomGroupe) : null;
  const D = bilanDuMois({ ym, vendu, recu, depense: charges, benefice: CB, B: Bm, meilleur, maintenant, enCours });
  const telecharger = async () => {
    if (envoi) return;
    setEnvoi(true);
    try { telechargerFichier(new Blob([await pdfBilanMois(D, { fmt })], { type: 'application/pdf' }), nomFichierBilan(ym), 'application/pdf'); }
    catch (_) { toast('Le PDF n’a pas pu être préparé — réessaie dans un moment.'); }
    setEnvoi(false);
  };
  return (
    <div className="vrm-bilan-mois" data-bilan-mois={ym} data-bilan-en-cours={enCours ? '1' : '0'}>
      <div className="vrm-bilan-tete">
        <Segmente label="Mois du bilan" value={quel} onChange={setQuel}
          options={[{ v: 'courant', l: 'Ce mois-ci', data: { 'data-bilan-choix': 'courant' } }, { v: 'precedent', l: 'Mois dernier', data: { 'data-bilan-choix': 'precedent' } }]} />
      </div>
      {D.lignes.map((l) => (
        <div key={l.cle} className="vrm-bilan-ligne" data-bilan-ligne={l.cle} data-valeur={l.valeur == null ? '' : String(l.valeur)} data-au-moins={l.auMoins ? '1' : undefined}>
          <span><b>{l.nom}</b>{l.note ? <small>{l.note}</small> : null}</span>
          <span className="vrm-bilan-val" data-vide={l.valeur == null ? '1' : undefined}>{texteBilan(l, fmt)}</span>
        </div>
      ))}
      <div className="vrm-bilan-ligne" data-bilan-ligne="meilleur" data-valeur={D.meilleur ? D.meilleur.nom : ''}>
        <span><b>Meilleur compte</b><small>{D.meilleur ? `${D.meilleur.n} vente${D.meilleur.n > 1 ? 's' : ''} · ${fmt(D.meilleur.eur)} vendus` : (vendu && vendu.manque.length ? 'pas désigné : des ventes ne sont pas lues' : vendu && vendu.n ? 'égalité' : 'aucune vente sur le mois')}</small></span>
        <span className="vrm-bilan-val" data-vide={D.meilleur ? undefined : '1'}>{D.meilleur ? D.meilleur.nom : '—'}</span>
      </div>
      <div className="vrm-bilan-pied">
        <Bouton variante="secondaire" icone="save" occupe={envoi} data-bilan-pdf="" onClick={telecharger}>Télécharger en PDF</Bouton>
      </div>
    </div>
  );
}
// ── (5 nov., chantier F) LE DÉLAI DE PAIEMENT PAR SITE ──────────────────────
// Le délai MÉDIAN entre la vente et le versement, sur les versements LUS
// seulement (Vinted : transaction finalisée ; Vestiaire : date de versement),
// avec le nombre de ventes mesurées. Leboncoin et eBay ne donnent pas leur date
// de versement : « — », dit. La règle : src/delaiPaiement.js.
function DelaiPaiementCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { calc } = useDeclarablesCompta({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts });
  const ventesVcER = useVentesVestiaire();
  const R = React.useMemo(() => {
    if (calc.etat !== 'lu') return calc.etat === 'passu' ? null : undefined;
    const venteVc = new Map((ventesVcER || []).filter((v) => v && v.id).map((v) => ['vestiaire:' + v.id, dateVenteVc(v) || null]));
    const dateVenteDe = (l) => (l.plateforme === 'Vinted' ? (Date.parse((l.o && l.o.date) || l.dateVente || '') || null) : l.plateforme === 'Vestiaire' ? venteVc.get(String(l.id)) || null : null);
    return delaisPaiement({ lignes: calc.decl.lignes, dateVenteDe });
  }, [calc, ventesVcER]);
  if (R === undefined) return <p className="vrm-compta-phrase" data-delai-etat="encours" style={{ margin: 0 }}>{PAS_SU.enCours}</p>;
  if (R === null) return <EtatPanne quoi="Le délai de paiement" raison="Tes ventes n’ont pas pu être lues." compact />;
  if (!R.sites.length) return <p className="vrm-compta-phrase" data-delai-etat="vide" style={{ margin: 0 }}>Aucune vente reçue pour l’instant : le délai se mesure au premier versement.</p>;
  return (
    <div className="vrm-delai-paiement" data-delai-etat="lu">
      {R.sites.map((x) => (
        <div key={x.plateforme} className="vrm-delai-ligne" data-delai-site={x.plateforme} data-delai-mediane={x.mediane == null ? '' : String(x.mediane)} data-delai-n={String(x.n)} data-delai-lu={x.lu ? '1' : '0'}>
          <span><b>{x.plateforme}</b><small>{!x.lu ? 'date de versement pas lue sur ce site' : x.n ? `médiane sur ${x.n} vente${x.n > 1 ? 's' : ''} versée${x.n > 1 ? 's' : ''}${x.n > 1 && x.min != null && x.max > x.min ? ` · entre ${String(x.min).replace('.', ',')} et ${texteDelai(x.max)}` : ''}${x.nSans ? ` · ${x.nSans} sans date` : ''}` : `aucun versement daté${x.nSans ? ` · ${x.nSans} sans date` : ''}`}</small></span>
          <span className="vrm-delai-val" data-vide={x.mediane == null ? '1' : undefined}>{texteDelai(x.mediane)}</span>
        </div>
      ))}
    </div>
  );
}
function ComptaPro({ liveStats, onNav, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts, comptesLus = false, vue = 'resume', allerVue = null, argentNav = null }) {
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
  // (2 nov., audit des données) Le jour LOCAL : en UTC, une charge saisie le 1er à 0 h 30 tombait le mois d'avant.
  const auj = dateLocaleISO();
  const [dDate, setDDate] = React.useState(auj);
  const [dLib, setDLib] = React.useState('');
  const [dCat, setDCat] = React.useState(COMPTA_CATS[0]);
  const [dMnt, setDMnt] = React.useState('');
  const [dErr, setDErr] = React.useState('');
  const [dPhoto, setDPhoto] = React.useState(null);          // (3 nov.) la photo du ticket (dataURL) avant « Ajouter »
  const [dLu, setDLu] = React.useState('');                   // '' · 'lecture' · 'lu' : le montant lu sur le ticket
  const [ticketVu, setTicketVu] = React.useState(null);       // { titre, src } : le ticket affiché
  const ticketRef = React.useRef(null);
  const dMntRef = React.useRef(''); dMntRef.current = dMnt;
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
  // (10 nov., Argent) « Documents et réglages » (le repli « Avancé ») n'existe plus : ses
  // cartes sont rangées dans le segment « Déclarer » (comptable, statut) et dans le détail
  // du Résumé (packs). Un geste qui vise une carte d'un autre segment y mène (`allerVue`).
  React.useEffect(() => {
    const f = (e) => { const v = e && e.detail; if (allerVue && (v === 'resume' || v === 'declarer' || v === 'factures')) allerVue(v); };
    window.addEventListener('vrm:argent-vue', f);
    return () => window.removeEventListener('vrm:argent-vue', f);
  }, [allerVue]);
  // « Ajouter une dépense » (Ma journée) : les dépenses vivent dans le Résumé.
  React.useEffect(() => { if (versDepense && vue !== 'resume' && allerVue) allerVue('resume'); }, [versDepense]);   // eslint-disable-line react-hooks/exhaustive-deps
  // (9 nov.) Le profil fiscal : en société, le livre des recettes et l'export comptable
  // passent DEVANT (sous « Combien je dois déclarer ? ») au lieu d'être rangés dans
  // « Documents et réglages » — les mêmes cartes, rendues à UN seul endroit.
  const profilF = useProfilFiscal();
  const exportDevant = !!profilF.exportEnAvant;
  // (9 nov., lot B) ⌘K « Exporter pour mon comptable » : la carte est MONTRÉE (repli ouvert,
  // défilée, « Préparer » au focus) — rien n'est lu ni exporté avant son clic.
  React.useEffect(() => {
    const montrer = () => {
      if (!DEMANDE_COMMANDE.export || Date.now() - DEMANDE_COMMANDE.export > 30000) return;
      if (allerVue) allerVue('declarer');
      let essais = 0;
      const viser = () => {
        const c = document.querySelector('[data-export-comptable]');
        if (!c) { if (++essais < 100) setTimeout(viser, 100); return; }
        // Rangée dans « Documents et réglages » (replié) : le repli s'ouvre (son `onToggle` suit).
        const d = c.closest('details'); if (d && !d.open && ++essais < 100) { d.open = true; setTimeout(viser, 60); return; }
        DEMANDE_COMMANDE.export = 0;
        try { c.scrollIntoView({ block: 'center' }); } catch (_) {}
        const b = c.querySelector('[data-export-preparer]'); try { if (b) b.focus({ preventScroll: true }); } catch (_) {}
      };
      setTimeout(viser, 0);
    };
    montrer();
    window.addEventListener('vrm:export-comptable', montrer);
    return () => window.removeEventListener('vrm:export-comptable', montrer);
  }, [exportDevant]);

  // (3 nov.) La photo du ticket : réduite dans le navigateur, puis le montant lu
  // DANS la page (gratuit, local) s'il est lisible et que le champ est vide.
  const choisirTicket = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const b64 = await compressImage(f, 1100, 0.7);
    if (!b64) { setDErr("Cette photo n'a pas pu être lue — essaie une autre."); return; }
    setDPhoto(b64); setDErr('');
    if (String(dMntRef.current || '').trim()) return;
    setDLu('lecture');
    const c = montantDuTicket(await texteDuTicket(b64));
    if (c != null && !String(dMntRef.current || '').trim()) { setDMnt(texteMontantSaisie(c)); setDLu('lu'); } else setDLu('');
  };
  const [dEnvoi, setDEnvoi] = React.useState(false);
  const ajouterDepense = async () => {
    if (dEnvoi) return;
    const m = parseMontant(dMnt);
    if (!dLib.trim() && !dPhoto) { setDErr('Dis en deux mots ce que tu as payé (ex. « cartons »).'); return; }
    if (!m) { setDErr('Le montant doit être un nombre en euros, par exemple 12,50.'); return; }
    setDErr('');
    const id = rCompId();
    let ticket = false;
    if (dPhoto) { setDEnvoi(true); ticket = await ecrireTicket(id, dPhoto); setDEnvoi(false); }
    const libelle = dLib.trim() || dCat;
    majFraiche((cur) => ({ ...cur, depenses: [{ id, date: dDate || auj, libelle, cat: dCat, montant: m, ...(ticket ? { ticket: true } : {}) }, ...((cur && cur.depenses) || [])] }));
    if (dPhoto && !ticket) toast(`Dépense ajoutée : ${fmt(m)} — la photo n'a pas pu être envoyée`);
    else toast(`✓ Dépense ajoutée : ${fmt(m)}`);
    setDLib(''); setDMnt(''); setDCat(COMPTA_CATS[0]); setDDate(auj); setDPhoto(null); setDLu(''); setOuvert('');
  };
  const voirTicket = async (d) => {
    const src = await lireTicket(d.id);
    if (!src) { toast("Le ticket n'a pas pu être lu"); return; }
    setTicketVu({ titre: d.libelle, src });
  };
  const ajouterPack = () => {
    const m = parseMontant(pMnt); if (!m) return;
    maj({ ...data, packs: [{ id: rCompId(), plateforme: pPlat, compte: pCpt.trim(), montant: m, date: pDate || auj }, ...packs] });
    toast(`✓ Pack ajouté : ${fmt(m)}`);
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
    toast(`✓ Abonnement ajouté : ${aLib.trim()}`);
    setALib(''); setAMnt(''); setAPer('mois'); setADeb(auj); setAFin(''); setAErr(''); setOuvert('');
  };
  // (1er nov.) Le « × » d'une ligne supprimait la dépense d'un toucher, sans
  // demander ni rien dire ; « Arrêter » terminait un abonnement de même. Les
  // deux DEMANDENT (en nommant la ligne) puis disent ce qui est fait.
  // L'écriture part de l'état le plus frais (la confirmation est asynchrone).
  const majFraiche = (f) => setData((cur) => { const next = f(cur); try { save('vrm_compta', next); } catch (_) {} return next; });
  const nomLigneCompta = (cle, x) => !x ? '' : cle === 'packs' ? `Pack ${x.plateforme || ''}`.trim() : String(x.libelle || '');
  const terminerAbonnement = async (id) => {
    const a = abonnements.find((x) => x.id === id);
    if (!(await askConfirm({ title: `Arrêter « ${nomLigneCompta('abonnements', a)} » ?`, desc: 'Le mois en cours reste compté dans tes charges, les suivants non.', ok: 'Arrêter', cancel: 'Annuler' }))) return;
    majFraiche((cur) => ({ ...cur, abonnements: (cur.abonnements || []).map(x => x.id === id ? { ...x, fin: auj } : x) }));
    toast('✓ Abonnement arrêté ce mois-ci');
  };
  // (10 nov., lot Y) Supprimer = à la corbeille 30 jours : la pilule dit « Mis à la corbeille » et offre
  // « Annuler » 5 s ; Paramètres → Corbeille la restaure ensuite. Le ticket n'est vidé qu'à la purge.
  const retirer = (cle, id) => {
    const rangee = load('vrm_compta', null);
    const L = (rangee && Array.isArray(rangee[cle]) ? rangee[cle] : data[cle]) || [];
    const i = L.findIndex((y) => y && y.id === id); const x = i >= 0 ? L[i] : null;
    if (!x) return;
    gesteCorbeille({ type: cle === 'depenses' ? 'depense' : cle === 'packs' ? 'pack' : cle === 'abonnements' ? 'abonnement' : 'cout', libelle: nomLigneCompta(cle, x),
      lignes: cle === 'depenses' && x.ticket ? [idTicket(id)] : [],
      morceaux: [{ k: 'vrm_compta', type: 'element', sous: cle, idCle: 'id', id, index: i, avant: x }] }, { vrm_compta: setData });
  };
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

  // (10 nov., Argent) La rangée « Factures — N reçues » qui menait à l'écran Factures est
  // retirée : Factures est un segment d'Argent, la liste elle-même s'y lit.

  // ── Palette d'écran (§7 : neutre partout, UN accent rare) ──────────────────
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 12, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box', minHeight: 44 };
  const btnAdd = { border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '9px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 44 };
  const formBox = { padding: '12px 16px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: C.muted, flex: '1 1 140px', minWidth: 0 };
  const pastille = (actif) => ({ border: `1px solid ${actif ? C.text : C.border}`, background: actif ? C.text : 'transparent', color: actif ? C.card : C.text, borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 });
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
  const lienBtn = (txt, tab, fs = 13) => <a href={`?tab=${tab}`} onClick={(e) => { e.preventDefault(); if (onNav) onNav(tab); }} style={{ color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontSize: fs, textDecoration: 'none' }}>{txt}</a>;

  // (30 oct.) « Se calcule dans Ventes » était écrit ~9 fois sur cet écran : la cause
  // se dit UNE fois ici, avec le geste ; les cartes ne gardent que « — ».
  const ligneComptaPub = useLigneUrssaf();
  return (
    <div className="vrm-finance-page vrm-fu-ecran vrm-argent" data-argent-ecran={vue} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* (10 nov., Argent) Statistiques et Comptabilité en UN endroit (src/argent.js) : le titre
          « Argent » et ses quatre segments. Chaque segment montre SES cartes ; les autres restent
          montées (`hidden` : mêmes lectures, mêmes états, mêmes data-*), jamais supprimées. */}
      {vue !== 'factures' ? <ScreenHead icon="euro" title={L.argent} phrase="compta" sous={argentNav} desc="Ce que tu as vendu, reçu, gagné, et ce que tu dois déclarer." /> : null}
      {vue !== 'factures' && !ligneComptaPub && <div data-compta-pas-calcule="" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--vrm-b-teinte)', fontSize: 13, color: C.text }}>
        {/* (2 nov.) Un compte neuf, sans compte Vinted : « ouvre Ventes » ne menait
            nulle part (Ventes n'a rien à publier). La cause vraie et son geste —
            seulement quand la liste des comptes est LUE (pas su ≠ aucun). */}
        {comptesLus && Array.isArray(accounts) && accounts.length === 0 ? (<>
          <span style={{ flex: '1 1 220px' }} data-compta-sans-compte="">Ce calcul part de tes ventes Vinted : aucun compte Vinted n’est encore relié.</span>
          <Bouton className="vrm-b-petit" onClick={() => onNav && onNav('vintedaccounts')}>Relier mon compte</Bouton>
        </>) : (<>
        <span style={{ flex: '1 1 220px' }}>Pas encore calculé</span>
        <Bouton className="vrm-b-petit" onClick={() => onNav && onNav('cat_ventes')}>Ouvrir Ventes</Bouton>
        </>)}
      </div>}
      <div className="vrm-argent-partie" data-argent-vue="resume" hidden={vue !== 'resume'}>
        {/* Les quatre réponses : vendu, reçu, bénéfice, à déclarer. Toucher = le détail. */}
        <ArgentQuestions liveStats={liveStats} onNav={onNav} allerVue={allerVue} />
      {/* (2 nov., style « Fusion ») L'anneau et les six mois — des parts et des hauteurs, aucun montant redit. */}
      <ComptaFusion compta={data} onNav={onNav}/>
        <section id="compta-detail" className="vrm-compta-q" data-compta-q="detail" style={{ scrollMarginTop: 72 }}>
          <div className="vrm-compta-q-tete">
            <h2 className="vrm-compta-question" data-compta-question="detail">Le détail</h2>
          </div>
          <div className="vrm-compta-replis">
            {/* (10 nov.) Le bénéfice ligne par ligne : son chiffre est en tête (widget « Bénéfice »), son calcul ici. */}
            <ComptaRepli id="compta-benefice" titre="Ton bénéfice" resume="Le calcul, ligne par ligne">
      <BeneficeCompta compta={data} onNav={onNav} sansCompte={comptesLus && Array.isArray(accounts) && accounts.length === 0}
        onSansDepenses={() => repondreSansDepenses(data, maj)}
        onAjouterDepense={() => { ouvrirRepliCompta('compta-charges'); setOuvert('dep'); setVersDepense((n) => n + 1); }} />
            </ComptaRepli>
          <ComptaRepli id="compta-ca" titre={TITRE_CARTE_CA} resume="Par période : jour de la vente, puis jour du versement">
            <CaParPeriodeCarte dansRepli lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
          </ComptaRepli>
          {/* (5 nov., chantier F) Le bilan du mois en une page, et le délai de paiement par site. */}
          <ComptaRepli id="compta-bilan" titre="Bilan du mois" resume="Vendu, reçu, dépensé, bénéfice, meilleur compte — en PDF">
            <BilanMoisCarte liveStats={liveStats} compta={data} />
          </ComptaRepli>
          <ComptaRepli id="compta-delai" titre="Délai de paiement" resume="Combien de jours entre la vente et le versement, site par site">
            <DelaiPaiementCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
          </ComptaRepli>
          {/* (4 nov.) Le porte-monnaie de chaque compte Vinted, LU par l'extension (jamais déduit des ventes). */}
          <ComptaRepli id="compta-porte-monnaie" titre="Porte-monnaie" resume="Disponible et en attente, compte par compte">
            <PorteMonnaieCompta accounts={accounts} panelOff={panelOff}/>
          </ComptaRepli>
          <ComptaRepli id="compta-charges" titre="Tes dépenses" resume={(depenses.length || abonnements.length || packs.length || fixes.length)
              ? [depenses.length ? `${depenses.length} dépense${depenses.length > 1 ? 's' : ''}` : null, abonnements.length ? `${abonnements.length} abonnement${abonnements.length > 1 ? 's' : ''}` : null, packs.length ? `${packs.length} pack${packs.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')
              : 'Cartons, abonnements, frais : rien de noté'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Deux repères : le mois et l'année (les data-compta-kpi restent ; l'abonnement
                du mois n'est plus redit en tête : il est sur sa ligne, juste en dessous). */}
            <section className="vrm-set-groupe vrm-compta-groupe" data-compta-depenses="" style={{ margin: 0 }}>
              <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
                <span hidden data-compta-kpi="abo" data-eur={String(Math.round(chargesDuMois.abo * 100) / 100)} />
                {[
                  { k: 'mois', l: 'Ce mois-ci', v: chargesMois, s: 'dépenses, abonnements et packs du mois' },
                  { k: 'annee', l: `Depuis janvier ${annee}`, v: chargesAnnee, s: 'tout ce que tu as noté cette année' },
                ].map((x) => (
                  <div key={x.k} className="vrm-set-ligne" data-compta-kpi={x.k} data-eur={String(Math.round(x.v * 100) / 100)}>
                    <span className="vrm-set-lib"><b style={{ color: C.text }}>{x.l}</b><small style={{ color: C.muted }}>{x.s}</small></span>
                    <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(x.v)}</span>
                  </div>
                ))}
                {chargesAnnee > 0 && (
                  <button type="button" className="vrm-set-ligne" onClick={exporterCharges}>
                    <span className="vrm-set-lib"><b style={{ color: C.accentTexte, fontWeight: 600 }}>Exporter mes dépenses {annee} (CSV)</b></span>
                    <span className="vrm-set-chev" aria-hidden="true" style={{ color: C.muted }}><Icon name="save" size={16} /></span>
                  </button>
                )}
              </div>
            </section>
        <div className="vrm-compta-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'start' }}>
          {/* DÉPENSES PONCTUELLES */}
          <Section data="depenses" titre="Dépenses" note="Emballage, fournitures, frais… tout ce que tu paies pour ton activité." total={null}>
            {depenses.length === 0 && ouvert !== 'dep'
              ? vide('Note ta première dépense — ça prend cinq secondes, et ça allège ton résultat.')
              : listeBox(depenses.map((d) => <Ligne key={d.id} attrs={{ 'data-depense': d.id, 'data-depense-ticket': d.ticket ? '1' : '' }} gauche={<><b style={{ color: C.text }}>{d.libelle}</b><small style={{ color: C.muted }}>{d.cat} · {dateFr(d.date)}</small></>} droite={fmt(d.montant)}
                  extra={d.ticket ? <button type="button" data-depense-voir-ticket="" aria-label={`Voir le ticket de ${d.libelle}`} onClick={() => voirTicket(d)} style={{ border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="camera" size={18} /></button> : null}
                  onDel={() => retirer('depenses', d.id)} />))}
            {ticketVu && createPortal(<div className="vrm-photo-viewer" data-ticket-vu="" onClick={() => setTicketVu(null)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setTicketVu(null); } }}>
              <FermeAuRetour fermer={() => setTicketVu(null)} />
              <div role="dialog" aria-modal="true" aria-label={`Ticket de ${ticketVu.titre}`} className="vrm-photo-panel" onClick={(e) => e.stopPropagation()}>
                <div><span>{ticketVu.titre}</span><button className="vrm-icon-control" type="button" aria-label="Fermer le ticket" onClick={() => setTicketVu(null)}><Icon name="close" size={22} /></button></div>
                <img src={ticketVu.src} alt={`Ticket de ${ticketVu.titre}`} style={{ width: '100%', height: '100%', objectFit: 'contain', minHeight: 0 }} />
              </div>
            </div>, document.body)}
            <ComptaAjout ouvert={ouvert === 'dep'} onClick={() => basculer('dep')} libelle="Ajouter une dépense" data={{ 'data-dep-ouvrir': '' }} />
            {ouvert === 'dep' && <div style={formBox} data-dep-form>
              <div className="vrm-dep-ticket" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {dPhoto ? <img data-dep-ticket-apercu="" src={dPhoto} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} /> : null}
                <Bouton variante={dPhoto ? 'secondaire' : 'primaire'} icone="camera" data-dep-ticket="" onClick={() => ticketRef.current && ticketRef.current.click()} style={{ minHeight: 44 }}>{dPhoto ? 'Changer la photo' : 'Photo du ticket'}</Bouton>
                {dPhoto ? <Bouton variante="discret" data-dep-ticket-retirer="" onClick={() => { setDPhoto(null); setDLu(''); }}>Retirer</Bouton> : null}
                <input ref={ticketRef} data-dep-ticket-fichier="" type="file" accept="image/*" capture="environment" onChange={choisirTicket} style={{ display: 'none' }} />
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>C'est pour quoi ?</div>
              <div role="radiogroup" aria-label="Catégorie" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DEPENSE_CATS.map((c) => <button key={c.k} type="button" role="radio" aria-checked={dCat === c.k} data-dep-cat={c.k} onClick={() => { setDCat(c.k); setDErr(''); }} style={pastille(dCat === c.k)}>{c.k}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ ...lab, flex: '2 1 180px' }}>Ce que tu as payé
                  <input type="text" placeholder={`ex. ${(DEPENSE_CATS.find((c) => c.k === dCat) || DEPENSE_CATS[DEPENSE_CATS.length - 1]).ex}`} data-dep-libelle value={dLib} onChange={e => { setDLib(e.target.value); setDErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
                </label>
                <label style={{ ...lab, flex: '0 1 110px' }}>Montant
                  <input type="text" inputMode="decimal" placeholder={dLu === 'lecture' ? '…' : '0,00\u00a0€'} data-dep-montant data-dep-montant-lu={dLu} value={dMnt} onChange={e => { setDMnt(e.target.value); setDErr(''); setDLu(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={lab}>Payé le
                  <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} data-dep-date style={{ ...inp, width: '100%' }} />
                </label>
                <button type="button" onClick={ajouterDepense} data-dep-ajouter disabled={dEnvoi} style={btnAdd}>{dEnvoi ? '…' : 'Ajouter'}</button>
              </div>
              {dErr && <div data-dep-erreur style={{ fontSize: 13, color: C.warn }}>{dErr}</div>}
            </div>}
          </Section>

          {/* ABONNEMENTS RÉCURRENTS */}
          <Section data="abonnements" titre="Abonnements" note="Logiciels et services qui reviennent tout seuls : comptés à chaque échéance (une échéance compte dès le début de son mois), jamais dans ton CA."
            total={null}>
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
                      extra={!a.fin && !pasEncore ? <Bouton variante="secondaire" taille="petit" data-abo-arreter="" onClick={() => terminerAbonnement(a.id)} title="Il s'arrête ce mois-ci (le mois en cours reste compté)" style={{ flexShrink: 0 }}>Arrêter</Bouton> : null}
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
                <input type="text" inputMode="decimal" placeholder="0,00&nbsp;€" data-abo-montant value={aMnt} onChange={e => { setAMnt(e.target.value); setAErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterAbonnement(); }} style={{ ...inp, width: '100%' }} />
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

        </div>
          </div>
          </ComptaRepli>
            <ComptaRepli id="compta-packs" titre="Packs & options" resume="Facultatif : ce que tu paies aux plateformes">
          <div className="vrm-compta-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'start' }}>
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

              </div>
            </ComptaRepli>
          </div>
        </section>
      </div>

      <div className="vrm-argent-partie" data-argent-vue="declarer" hidden={vue !== 'declarer'}>
      <section id="compta-urssaf" className="vrm-compta-q" data-compta-q="declarer" data-cible="urssaf" style={{ scrollMarginTop: 72 }}>
        <div className="vrm-compta-q-tete">
          <h2 className="vrm-compta-question" data-compta-question="declarer">Combien je dois déclarer ?</h2>
        </div>
        <PrevisionUrssafCarte onNav={onNav} />
        {/* (10 nov., lot BK) « Mois bouclé » : ce qui manque avant de déclarer le mois choisi (src/moisBoucle.js). */}
        <MoisBoucle portes={portesMoisBoucle({ onNav, ouvrirRepli: ouvrirRepliCompta })} />
        <StatutFiscal partie="declarer" liveStats={liveStats} onNav={onNav} />
        {exportDevant ? <div data-compta-export-devant="" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <ExportComptableCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
          <RegistresCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
        </div> : null}
      </section>
          <StatutFiscal partie="suivi" liveStats={liveStats} onNav={onNav} />
          {/* (5 nov.) DAC7 compte par compte : ventes N/30, montant / 2 000 €, le rapport de la plateforme, l'export (src/dac7Comptes.js). */}
          <ComptaRepli id="compta-dac7" titre="DAC7" resume="Ce que chaque plateforme transmet aux impôts, compte par compte">
            <Dac7ComptesCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
          </ComptaRepli>
        {/* (10 nov.) Ce qui part chez le comptable, à un seul endroit. */}
        <section className="vrm-compta-q" data-argent-groupe="comptable" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="vrm-compta-q-tete"><h2 className="vrm-compta-question">Pour ton comptable</h2></div>
          {!exportDevant && <ExportComptableCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />}
          {!exportDevant && <RegistresCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />}
          <RecapComptableMensuel />
          {/* (10 nov., lot R) Le livre de police : un bloc isolé, statut pro seulement (src/livrePolice.js). */}
          <LivrePoliceCarte lireAchats={lireAchatsRegistre} registreDe={registreAchatsDe} panelOff={panelOff} />
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
                      : <>CA déclaré pas encore calculé : ouvre {lienBtn('Ventes', 'cat_ventes')} une fois.</>}
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
                  <div style={{ marginTop: 10 }}><Pourquoi label="Ce que ce résultat compte">Le CA déclaré de l'année (toutes plateformes) moins tes charges. Il ne déduit pas le prix d'achat de tes articles : ton bénéfice brut et net, qui le déduit, est dans « Ton bénéfice », dans le Résumé.</Pourquoi></div>
                </div>
              )}
            </div>
          </Card>
        </section>
        <section id="compta-avance" className="vrm-compta-q" data-argent-groupe="statut" style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 72 }}>
          <div className="vrm-compta-q-tete"><h2 className="vrm-compta-question">Ton statut</h2></div>
          <StatutFiscal partie="statut" liveStats={liveStats} onNav={onNav} />
          <ProfilFiscalCarte onNav={onNav} />
        </section>
      </div>

      <div className="vrm-argent-partie" data-argent-vue="factures" hidden={vue !== 'factures'}>
          {/* FACTURATION ÉLECTRONIQUE — Factur-X par vente + récap e-reporting du mois. */}
          <FacturationElectroniqueCarte data={data} maj={maj} lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
      </div>
    </div>
  );
}
export { ComptaPro, Invoices, Catalog, Sales, registreAchatsDe, lireAchatsRegistre };
