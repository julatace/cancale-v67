// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { contactEmail, CONTACT_A_VENIR } from "../contact.js";
import { DISCORD_ERREURS } from "../communaute/discordErreurs.js";
import { noterTicketDiscord } from "../communaute/discordAttente.js";
import { VAPID_PUBLIC_KEY } from "../vapid.js";
import MIGRATION_SQL from "../../supabase/migrations/001-multi-utilisateurs.sql?raw";
import { normAdresse } from "../../api/_lib/proprietaire-email.js";
import { AUTH, BUILD_ID, BlocComptesMuets, BrandMark, C, CE_QUE_VOIT_UN_MEMBRE, CLOISONNE, CaseCgv, DEMANDE_ADRESSES, DEMANDE_SAISIE_PRIX, DOCS_LEGAUX, EQUIPE_NON_INSTALLE_TXT, EXT_ATTENDUE, FermeAuRetour, IMPR_MODES, INV_STATUS, Icon, IconeReglage, LignePanne, MM_PT, MULTI_USER, OAUTH_PROVIDERS, PRIX_CGV_LISIBLE, REGLAGE_PAS_LU, RETOUR_ABONNEMENT, RETOUR_VUE, SB_CONFLICT, SUPABASE_KEY, SUPABASE_URL, ScreenHead, Segmente, TAUX_URSSAF_DEFAUT, TYPES_BORDEREAU, ZOOM_KEY, _reglagesEcoute, _reglagesRates, actionEquipe, applyZoom, archiveNumeros, askConfirm, askText, authSetEmail, authSetPassword, authSignOut, bordereauFormatKey, chargerPdfjs, choisirVueEquipe, codePerime, compterReglesEbay, deleteVintedAccount, enTeteSession, estCorpsErreurVinted, extEnRetard, familiesDeCompte, fetchVintedAccounts, harvestTs, imprMode, imprimanteChoisie, ligneDeSaSession, lireAbonnement, lireEquipe, lireMisDeCote, lirePdfLigne, lireReglage, lireTout, load, mfaAppel, mfaInjoignable, mfaLireFacteurs, mfaVerifierCode, oauthStart, onCloudReady, onVmrExt, ouvrirStripe, phrasePersonne, poserBordereau, poserStream, prefixeNumeros, prixLisible, providerEnabled, qrEnSrc, readZoom, save, sbAuth, smartDefaultBordPos, sondeLectureSansCompte, textePerime, texteReglesQuiRestent, toast, typeBordereau, typeCompteVinted, useBeneficeJournee, useEtatEmailsComptes, useMisDeCote, useSansSouris, useStream, vmrAuthEtat, vmrExtPresent, vmrExtVersion, withOwner, writeSession, zoneEtiquette } from "../App.jsx";

// La forme acceptée pour une adresse de réception (saisie à la main OU
// suggérée) : une seule règle.
const ADRESSE_RECEPTION_OK = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const supprimerDonneesCompte = async (uid0, login, scopes) => {
  const uid = String(uid0 || '').trim();
  if (!uid) return { ok: false, n: 0 };
  let n = 0;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?or=(id.like.harvest_${uid}_*,id.like.coffre_${uid}_*)&select=id`, { headers: sbAuth() });
    if (!r.ok) return { ok: false, n: 0 };               // « pas su » : on n'efface rien à l'aveugle
    const rows = await r.json();
    if (!Array.isArray(rows)) return { ok: false, n: 0 };
    const cibles = rows.filter(x => familiesDeCompte(uid, String(x.id), scopes));
    if (cibles.length) {
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(cibles.map(x => withOwner({ id: x.id, data: { supprime: true, uid, purgedAt: new Date().toISOString() } }))),
      });
      if (!w.ok) return { ok: false, n: 0 };
      n = cibles.length;
    }
    // « Le compte et ses jetons » : la ligne vinted_accounts (DELETE marche là,
    // autre table). Récupérable en reconnectant l'extension sur ce compte.
    if (scopes.compte) {
      try { await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, { method: 'DELETE', headers: sbAuth({ Prefer: 'return=minimal' }) }); } catch (_) {}
    }
    return { ok: true, n };
  } catch (_) { return { ok: false, n: 0 }; }
};
const nomTypeBordereau = (t) => (TYPES_BORDEREAU.find(([k]) => k === t) || [, 'Autre mise en page'])[1];
// Dessine la page 1..n d'un PDF (octets) dans un canvas, avec un cadre en
// pointillés autour de `zone` (coordonnées PDF) — « ce qui part en thermique ».
const dessinerPdf = async (canvas, octets, { page = 1, largeur = 220, zone = null } = {}) => {
  const L = await chargerPdfjs();
  const d = await L.getDocument({ data: octets.slice ? octets.slice(0) : octets }).promise;
  const pg = await d.getPage(page);
  const v0 = pg.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1), sc = (largeur / v0.width) * dpr;
  const v = pg.getViewport({ scale: sc });
  canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
  canvas.style.width = `${Math.round(v.width / dpr)}px`; canvas.style.height = `${Math.round(v.height / dpr)}px`;
  const c2 = canvas.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, canvas.width, canvas.height);
  await pg.render({ canvasContext: c2, viewport: v }).promise;
  if (zone) {
    const H = v0.height;
    c2.save(); c2.strokeStyle = '#2458E6'; c2.lineWidth = 2 * dpr; c2.setLineDash([6 * dpr, 4 * dpr]);
    c2.strokeRect(zone.x * sc, (H - zone.y - zone.h) * sc, zone.w * sc, zone.h * sc); c2.restore();
  }
  return d.numPages;
};

// ── RÉGLAGES → IMPRIMANTE ET BORDEREAUX (17 octobre) ────────────────────────
// Julien : « dans les paramètres, imprimante thermique et normale ; tous les
// types de bordereau avec une visualisation pour chaque type collecté par
// l'app ». Le choix est LE réglage `vrm_imprimante` — le même que les deux
// pastilles de l'écran Colis (§11 : un réglage, deux portes).
// Les aperçus se calculent sur SES bordereaux, dans son navigateur, au clic :
// ils lisent des PDF (≈ 70 Ko chacun), donc rien ne part tant qu'il ne le
// demande pas, et jamais plus de `APERCU_MAX` (§4.4).
const APERCU_MAX = 24;

const PUSH_CATS = [
  { id:'vente',    def:true,  titre:'💸 Vendu',            desc:"Une paire vient d'être vendue." },
  { id:'argent',   def:true,  titre:'💰 Argent viré',       desc:'Vinted a versé ton argent.' },
  { id:'colis',    def:true,  titre:'📍 Colis à retirer',   desc:'Arrivé au relais, avec le code de retrait.' },
  { id:'expedier', def:true,  titre:'📮 Colis à poster',    desc:"Rappel du matin, avec l'échéance." },
  { id:'soir',     def:true,  titre:'🌙 Colis de demain',   desc:"La veille vers 20 h : combien de colis poster demain, et lesquels sont en retard." },
  { id:'offre',    def:true,  titre:'🏷️ Offre reçue',       desc:'Un acheteur propose un prix.' },
  { id:'urssaf',   def:true,  titre:'🧾 Déclaration URSSAF', desc:'Le 1er de chaque mois, pour penser à la faire.' },
  { id:'bilan',    def:true,  titre:'📊 Bilan de la semaine', desc:"Le lundi matin : vendu, reçu, colis à poster, paires qui dorment." },
  { id:'doublevente', def:true, titre:'⚠️ Double vente', desc:"Vendue sur Vinted alors que la même paire (son N°) est encore en vente sur eBay ou Leboncoin — même app fermée." },
  { id:'action',   def:true,  titre:'⏳ À trancher sur Vinted', desc:"Un acheteur demande d'annuler, ou un de tes achats est livré : tu as une date limite pour répondre ou signaler un problème." },
  { id:'suivi',   def:false, titre:'🚚 Suivi du colis',    desc:'« En transit », « livré ». Rien à faire.' },
  { id:'achat',    def:false, titre:'🛍 Achat confirmé',    desc:"Tu viens de l'acheter, tu le sais déjà." },
  { id:'message',  def:false, titre:'💬 Message',           desc:"Nouveau message d’un acheteur, avec la paire. Arrive ~15 min après le message (c’est le délai de l’email de Vinted)." },
  { id:'favori',   def:false, titre:'❤️ Nouveau favori',    desc:'Vinted en envoie beaucoup.' },
  { id:'facture',  def:false, titre:'🧾 Facture',           desc:'Facture préparée ou envoyée.' },
];

// Téléphone (< 768 px) : les panneaux longs passent dans un sous-écran.
// `matchMedia` qui lève ⇒ « pas su » ⇒ la disposition d'ordinateur, où tout
// reste déplié (rien n'est caché sur une mesure ratée).
function useEtroitReglages() {
  const q = '(max-width: 767px)';
  const lire = () => { try { return window.matchMedia(q).matches; } catch (_) { return false; } };
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    let mq; try { mq = window.matchMedia(q); } catch (_) { return undefined; }
    const maj = () => setV(mq.matches);
    try { mq.addEventListener('change', maj); } catch (_) { return undefined; }
    return () => { try { mq.removeEventListener('change', maj); } catch (_) {} };
  }, []);
  return v;
}
// Julien trouvait encore « trop serré » au minimum : on descend plus bas.
// 0,65 fait tenir une fois et demie plus de contenu qu'à 100 %.
const ZOOMS = [['0.65', 'Minus'], ['0.75', 'Petit'], ['0.85', 'Compact'], ['1', 'Normal'], ['1.1', 'Grand']];
const dateLisible = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (_) { return ''; } };

// MES FACTURES ET MA CARTE — trois états : `undefined` en cours · `null` pas su
// · `{ factures, carte }` lu. ⚠️ « Pas su » ne s'affiche JAMAIS comme « aucune
// facture » : quelqu'un qui cherche une facture pour sa compta en conclurait
// qu'elle n'existe pas.
async function lireFactures() {
  try {
    const r = await fetch('/api/compte?mode=factures', { headers: enTeteSession(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok && Array.isArray(j.factures) ? { factures: j.factures, carte: j.carte || null } : null;
  } catch (_) { return null; }
}
// Résilier (à la fin de la période payée) ou annuler la résiliation.
async function choisirResiliation(reprendre) {
  try {
    const r = await fetch(`/api/compte?mode=${reprendre ? 'reprendre' : 'resilier'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok) return { ok: true, annuleFinPeriode: !!j.annuleFinPeriode, finPeriode: j.finPeriode || null };
    return { ok: false, message: (j && j.message) || "Stripe n'a pas répondu. Réessaie dans un instant." };
  } catch (_) { return { ok: false, message: 'Pas de connexion. Réessaie dans un instant.' }; }
}
const montantLisible = (n, devise) => {
  if (!Number.isFinite(Number(n))) return '—';
  try { return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: String(devise || 'eur').toUpperCase() }); }
  catch (_) { return `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
};
const STATUT_FACTURE = { paid: 'Payée', open: 'À payer', void: 'Annulée', uncollectible: 'Impayée' };
// Seuls les liens de Stripe s'ouvrent depuis la liste (le serveur filtre déjà ;
// on ne fait pas confiance à une seule moitié).
const lienFacture = (u) => (typeof u === 'string' && /^https:\/\/(pay|invoice|files|invoicedata)\.stripe\.com\//.test(u) ? u : null);

// ── FERMER MON COMPTE (5 octobre) ────────────────────────────────────────────
// La politique de confidentialité promet l'effacement ; il fallait écrire à une
// adresse qui n'existe pas encore. Le serveur fait le travail
// (api/compte.js?mode=fermer) et rend ce qui a été fait ET ce qui ne l'a pas
// été : l'écran l'affiche tel quel — jamais « compte fermé » sur un échec.
// Trois états de réponse : `{ ok:true }` fermé · `{ ok:false, message }` dit
// par le serveur · pas de réponse = PAS SU (on ne prétend ni l'un ni l'autre).
async function fermerMonCompte(confirmation) {
  try {
    const r = await fetch('/api/compte?mode=fermer', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ confirmation }) });
    const j = await r.json().catch(() => null);
    if (j && typeof j.message === 'string') return { ok: r.ok && j.ok === true, message: j.message };
    return { ok: false, message: "Le serveur n'a pas répondu clairement : je ne sais pas si la fermeture a eu lieu. Reconnecte-toi — si ton compte existe encore, relance-la." };
  } catch (_) { return { ok: false, message: "Pas de réponse (connexion coupée) : je ne sais pas si la fermeture a eu lieu. Reconnecte-toi — si ton compte existe encore, relance-la." }; }
}

// ── LES ADRESSES OÙ ARRIVENT DÉJÀ TES EMAILS ─────────────────────────────────
// Mesuré le 6 octobre (lecture seule, sa vraie base) : parmi les lignes
// `email_*`, SEULES `email_inconnu_*` gardent l'adresse de destination — le
// champ `to` (l'en-tête « À », 1 053 lignes sur 1 053, 17 formes, dont
// « Hide My Email <…@icloud.com> »). C'est l'un des champs que lit la règle
// d'arrivée (`adressesDeLivraison`) : la déclarer suffit à ce que les emails
// suivants lui reviennent. Une IDENTITÉ — l'adresse où ses propres emails sont
// arrivés —, jamais une ressemblance.
// ⚠️ SES lignes seulement (session, RLS) : jamais les adresses du tas mis de
//    côté, qui peuvent être celles d'un autre vendeur.
// ⚠️ Des suggestions, pas un total : les 1 000 plus récentes suffisent (§4.5
//    vaut pour un total ; aucun n'est affiché ici). Scalaire `meta->>to` : la
//    ligne porte jusqu'à 200 Ko d'email brut, jamais rapatrié (§4.4).
// Rend un tableau `{ adresse, n, dernier }` (le plus fréquent d'abord), ou
// `null` si la lecture a échoué — rien n'est alors suggéré, rien n'est affirmé.
async function lireAdressesVues() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.email_inconnu_*&select=to:meta->>to,quand:meta->>receivedAt&order=meta->>receivedAt.desc&limit=1000`, { headers: sbAuth() });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const vues = {};
    for (const x of j) {
      for (const brut of String((x && x.to) || '').split(/[,;]/)) {
        const a = normAdresse(brut);
        if (!a || !ADRESSE_RECEPTION_OK.test(a)) continue;
        const v = vues[a] || (vues[a] = { adresse: a, n: 0, dernier: '' });
        v.n++;
        if (String((x && x.quand) || '') > v.dernier) v.dernier = String(x.quand || '');
      }
    }
    return Object.values(vues).sort((a, b) => b.n - a.n || (a.dernier < b.dernier ? 1 : -1));
  } catch (_) { return null; }
}

function ApercuPdf({ octets, page = 1, largeur, zone, label }) {
  const ref = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');   // charge · ok · ko
  React.useEffect(() => {
    let vivant = true;
    setEtat('charge');
    dessinerPdf(ref.current, octets, { page, largeur, zone }).then(() => { if (vivant) setEtat('ok'); }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; };
  }, [octets, page, largeur, zone]);
  const ouvrir = () => { try { const u = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' })); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (_) {} };
  return (
    <figure data-apercu={etat} style={{margin:0,display:'flex',flexDirection:'column',gap:6,alignItems:'flex-start'}}>
      <figcaption style={{fontSize:11.5,fontWeight:600,color:C.muted}}>{label}</figcaption>
      <canvas ref={ref} aria-label={label} style={{display: etat === 'ko' ? 'none' : 'block', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', maxWidth:'100%'}}/>
      {etat === 'charge' && <span style={{fontSize:11.5,color:C.muted}}>Je dessine l’aperçu…</span>}
      {etat === 'ko' && <span style={{fontSize:11.5,color:C.muted,lineHeight:1.45}}>Je n’ai pas pu dessiner l’aperçu ici. <button type="button" onClick={ouvrir} style={{border:'none',background:'none',padding:0,color:C.text,textDecoration:'underline',cursor:'pointer',font:'inherit'}}>Ouvrir le PDF</button></span>}
    </figure>
  );
}
const ImprimanteSetting = ({ nu = false }) => {
  const [mode, setMode] = React.useState(imprimanteChoisie);
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setMode(imprimanteChoisie()); }), []);
  const choisir = (v) => { touche.current = true; const m = imprMode(v); setMode(m); save('vrm_imprimante', m); };
  const [ap, setAp] = React.useState(null);   // null = pas demandé · {etat:'charge'|'pasSu'|'vide'|'lu', ...}
  const charger = async () => {
    setAp({ etat: 'charge' });
    const [emails, captes] = await Promise.all([
      lireTout('id=like.email_bord_*&meta->>_pdf=eq.true&select=id,at:meta->>receivedAt'),
      lireTout('id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,at:meta->>capturedAt'),
    ]);
    if (emails === null && captes === null) { setAp({ etat: 'pasSu' }); return; }
    // Un bordereau peut être là deux fois (capté par l'extension ET reçu par
    // email) : la transaction le dit, on n'en garde qu'un.
    const vus = new Set(), lignes = [];
    for (const r of [...(captes || []), ...(emails || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))) {
      if (/_label_latest$/.test(r.id)) continue;
      const tx = (r.id.match(/(\d{6,})$/) || [])[1] || r.id;
      if (vus.has(tx)) continue; vus.add(tx); lignes.push(r);
    }
    if (!lignes.length) { setAp({ etat: 'vide', partiel: emails === null || captes === null }); return; }
    const PL = await import('pdf-lib');
    const types = new Map(); let lus = 0, rates = 0;
    for (const r of lignes.slice(0, APERCU_MAX)) {
      const lu = await lirePdfLigne(r.id);
      if (!lu || !lu.octets) { if (lu === null) rates++; continue; }
      let doc; try { doc = await PL.PDFDocument.load(lu.octets); } catch (_) { continue; }
      lus++;
      const ty = typeBordereau(PL, doc);
      const z = zoneEtiquette(PL, doc.getPages()[0]);
      const e = types.get(ty.cle) || { ...ty, n: 0, isoles: 0, raisons: new Set(), exemple: null };
      e.n++; if (z.ok) e.isoles++; else e.raisons.add(z.raison || 'mise en page inconnue');
      if (!e.exemple) {
        // Les deux impressions, faites par LE code d'impression (`poserBordereau`),
        // avec un N° d'exemple — ce qu'on voit est ce qui sortira.
        const fabrique = async (thermique) => { const src = await PL.PDFDocument.load(lu.octets); const out = await PL.PDFDocument.create();
          // le N° tombe là où il tombera vraiment : l'emplacement appris pour ce format
          const { width: fw, height: fh } = src.getPages()[0].getSize();
          const pos = (load('vinted_bordereau_formats', {}) || {})[bordereauFormatKey(fw, fh)] || smartDefaultBordPos(fw, fh);
          const r1 = await poserBordereau(PL, out, src, { numero: '123', title: '', pos, thermique }); return { octets: await out.save(), r1, pages: out.getPageCount() }; };
        const normale = await fabrique(false), thermique = await fabrique(true);
        e.exemple = { normale, thermique, zone: z.ok ? z : null };
      }
      types.set(ty.cle, e);
    }
    const sens = new Set([...types.values()].map((e) => e.type + '|' + e.sens));
    const doubles = new Set([...types.values()].filter((e) => [...sens].filter((k) => k.startsWith(e.type + '|')).length > 1).map((e) => e.type));
    setAp({ etat: 'lu', lus, rates, total: lignes.length, types: [...types.values()].sort((a, b) => b.n - a.n), doubles, partiel: emails === null || captes === null });
  };
  const vus = ap && ap.etat === 'lu' ? new Set(ap.types.map((e) => e.type)) : new Set();
  return (
    <div data-imprimante-reglage={mode} style={nu ? {} : {padding:'13px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,marginBottom:8}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text}}>Imprimante et bordereaux</div>}
      <Segmente label="Imprimante" plein value={mode} onChange={choisir} style={{marginTop:nu?0:10}}
        options={IMPR_MODES.map((v) => ({ v, l: v === 'thermique' ? 'Thermique · 10×15' : 'Normale · A4', data: { 'data-imprimante-choix': v } }))}/>
      <div data-imprimante-phrase style={{fontSize:12.5,color:C.muted,marginTop:10,lineHeight:1.5}}>
        {mode === 'thermique'
          ? <>Chaque étiquette sort <b style={{color:C.text}}>seule, au format 10 × 15 cm</b>, tournée à l’endroit et entière (sans la fiche destinataire ni la pub), ton N° en petit sous l’étiquette. Quand l’app ne sait pas repérer l’étiquette sur un bordereau, la page part <b style={{color:C.text}}>entière</b> et l’écran le dit — jamais un code-barres coupé. Dans la fenêtre d’impression, choisis le papier <b style={{color:C.text}}>100 × 150 mm</b> et l’échelle <b style={{color:C.text}}>100 %</b> (ou « taille réelle »).</>
          : <>La page complète, <b style={{color:C.text}}>une feuille A4 par bordereau</b>, ton N° tamponné à l’emplacement appris. Si ton imprimante sort du recto-verso, décoche-le dans sa fenêtre d’impression : le PDF le demande, le pilote peut passer outre.</>}
      </div>
      <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>Tes types de bordereaux</div>
        {!ap && <>
          <div style={{fontSize:12.5,color:C.muted,marginTop:4,lineHeight:1.5}}>Pour chaque type que l’app a reçu, ce qui sortira sur une imprimante normale et sur une thermique. Calculé sur tes {APERCU_MAX} derniers bordereaux.</div>
          <button type="button" data-apercus-voir onClick={charger} style={{marginTop:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:10,padding:'0 16px',minHeight:44,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Voir les aperçus</button>
        </>}
        {ap && ap.etat === 'charge' && <div data-apercus="charge" style={{fontSize:12.5,color:C.muted,marginTop:6}}>Je lis tes bordereaux…</div>}
        {ap && ap.etat === 'pasSu' && <div data-apercus="passu" style={{fontSize:12.5,color:C.muted,marginTop:6,lineHeight:1.5}}>La base n’a pas répondu : je n’ai pas pu lire tes bordereaux. <button type="button" onClick={charger} style={{border:'none',background:'none',padding:0,color:C.text,textDecoration:'underline',cursor:'pointer',font:'inherit'}}>Réessayer</button></div>}
        {ap && ap.etat === 'vide' && <div data-apercus="vide" style={{fontSize:12.5,color:C.muted,marginTop:6,lineHeight:1.5}}>{ap.partiel ? 'Une partie de tes bordereaux n’a pas pu être lue, et aucun PDF n’est arrivé dans le reste.' : 'Aucun bordereau avec son PDF pour l’instant : les aperçus apparaîtront avec ta prochaine vente.'}</div>}
        {ap && ap.etat === 'lu' && <div data-apercus="lu" style={{marginTop:6}}>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}} data-apercus-compte={ap.lus}>
            D’après tes {ap.lus} derniers bordereaux{ap.total > ap.lus + ap.rates ? ` (sur ${ap.total})` : ''}.{ap.rates > 0 ? ` ${ap.rates} n’ont pas pu être lus (la base n’a pas répondu).` : ''}{ap.partiel ? ' Une partie de la liste n’a pas pu être lue.' : ''} Le N° montré est un exemple.
          </div>
          {ap.types.map((e) => (
            <div key={e.cle} data-apercu-type={e.type} data-apercu-isoles={e.isoles} data-apercu-n={e.n} style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text}}>{e.type === 'autre' ? `Autre mise en page (${Math.round(e.W / MM_PT)} × ${Math.round(e.H / MM_PT)} mm)` : nomTypeBordereau(e.type)}{ap.doubles.has(e.type) ? (e.sens === 'paysage' ? ' · page couchée' : ' · page debout') : ''}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.45}}>
                {e.n} bordereau{e.n > 1 ? 'x' : ''} · {e.isoles === e.n ? (e.n > 1 ? 'étiquette repérée sur tous' : 'étiquette repérée') : e.isoles === 0 ? <>étiquette <b style={{color:C.text}}>non repérée</b> : en thermique la page part entière ({[...e.raisons].join(' · ')})</> : <>étiquette repérée sur {e.isoles} — les autres partent entières en thermique ({[...e.raisons].join(' · ')})</>}
              </div>
              <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,alignItems:'flex-start'}}>
                <ApercuPdf octets={e.exemple.normale.octets} largeur={180} zone={e.exemple.zone} label={e.exemple.zone ? 'Normale · A4 (en pointillés : ce qui part en thermique)' : 'Normale · A4'}/>
                {Array.from({ length: e.exemple.thermique.pages }, (_, i) => (
                  <ApercuPdf key={i} octets={e.exemple.thermique.octets} page={i + 1} largeur={e.exemple.thermique.r1.isole ? 120 : 180}
                    label={e.exemple.thermique.r1.isole ? `Thermique · 10×15${e.exemple.thermique.pages > 1 ? ` (${i + 1}/${e.exemple.thermique.pages})` : ''}` : 'Thermique · page entière'}/>
                ))}
              </div>
            </div>
          ))}
          {(() => { const jamais = TYPES_BORDEREAU.filter(([k]) => !vus.has(k)); return jamais.length ? (
            <div data-apercus-jamais={jamais.map(([k]) => k).join(',')} style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.muted,lineHeight:1.5}}>
              <b style={{color:C.text}}>Pas encore vus</b> dans tes derniers bordereaux : {jamais.map(([, l]) => l).join(' · ')}. Pas d’aperçu inventé : il apparaîtra avec le premier reçu. En thermique, l’app les découpera si elle repère l’étiquette, sinon la page partira entière.
            </div>) : null; })()}
        </div>}
      </div>
    </div>
  );
};


/* ── Comptes Vinted liés (gestion des comptes uniquement) ───────────────
   Cet écran ne sert plus qu'à GÉRER les comptes liés (les capturés par
   l'extension) : les lister, les renommer, tester la connexion, resynchroniser.
   Les données (annonces, ventes, achats, messages, bordereaux) vivent désormais
   dans les onglets DÉDIÉS du menu (Annonces / Ventes / Achats / Bordereaux /
   Messages), tous rendus par <Comptabilite/>. On a donc retiré d'ici tout ce
   qui était en doublon (numérotation, sélecteur d'achat, vues, conversations,
   bordereaux) — un seul endroit par chose. */
function VintedAccounts({ accounts, setAccounts, baseKO }) {
  const [loading, setLoading] = useState(false);

  const [labels, setLabels] = useState(() => load('vinted_account_labels', {}));
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  // Email associé à chaque compte (l'adresse à laquelle Vinted écrit — masquée
  // iCloud ou classique). Sert au serveur pour attribuer chaque email de vente/
  // bordereau au bon compte. Synchronisé (vinted_account_emails).
  const [acctEmails, setAcctEmails] = useState(() => load('vinted_account_emails', {}));
  // Téléphone de chaque compte (Julien, 30 sept. : « pour ceux qui font du
  // multi-compte, savoir si les numéros ont servi »). Saisi à la main — Vinted
  // ne l'expose pas dans ce qu'on capte, on ne le devine pas. Synchronisé.
  const [acctPhones, setAcctPhones] = useState(() => load('vinted_account_phones', {}));
  // §5.49 : étiquettes/emails/téléphones des comptes, synchronisés, lus au
  // montage → froids sur un appareil neuf. Cartes : on ne remplit que si vide,
  // jamais par-dessus une saisie faite pendant le chargement.
  useEffect(() => onCloudReady(() => {
    const vide = (o) => !o || Object.keys(o).length === 0;
    setLabels(n => vide(n) ? load('vinted_account_labels', {}) : n);
    setAcctEmails(n => vide(n) ? load('vinted_account_emails', {}) : n);
    setAcctPhones(n => vide(n) ? load('vinted_account_phones', {}) : n);
  }), []);
  const setAcctPhone = (uid, val) => {
    const u = { ...acctPhones, [String(uid)]: val };
    if (!String(val).trim()) delete u[String(uid)];
    setAcctPhones(u); save('vinted_account_phones', u);
  };
  // Même numéro sur deux comptes : la comparaison se fait chiffres seuls
  // (« 06 12… » et « +33 6 12… » sont le même numéro).
  const telNorm = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('33') && d.length === 11 ? '0' + d.slice(2) : d; };
  const [reput, setReput] = useState({}); // { uid: { rating, count, pos, neg } } — note vendeur captée
  const [typesProfil, setTypesProfil] = useState({}); // { uid: true (pro) | false (particulier) } — lu dans le profil capté
  const setAcctEmail = (uid, val) => {
    const u = { ...acctEmails, [String(uid)]: val.trim() };
    if (!u[String(uid)]) delete u[String(uid)];
    setAcctEmails(u); save('vinted_account_emails', u);
  };
  // Auto-remplissage : l'extension capte le profil Vinted (users/current) qui
  // contient l'email du compte. On remplit les champs vides automatiquement —
  // la saisie manuelle reste possible et n'est jamais écrasée.
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_profile&select=id,data`, {
        headers: sbAuth(),
      });
      if (!res.ok) return;
      const rows = await res.json();
      // Note vendeur (feedback_reputation 0..1) + nb d'avis, si Vinted les fournit.
      const rep = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const usr = r.data && r.data.payload && r.data.payload.user;
        if (uid && usr) {
          const rating = typeof usr.feedback_reputation === 'number' ? usr.feedback_reputation : null;
          const count = Number.isFinite(usr.feedback_count) ? usr.feedback_count : null;
          if (rating != null || count != null) rep[uid] = { rating, count, pos: usr.positive_feedback_count, neg: usr.negative_feedback_count };
        }
      });
      if (Object.keys(rep).length) setReput(rep);
      const typ = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const t = typeCompteVinted(r.data && r.data.payload);
        if (uid && typeof t === 'boolean') typ[uid] = t;
      });
      if (Object.keys(typ).length) setTypesProfil(typ);
      setAcctEmails(prev => {
        const u = { ...prev }; let changed = false;
        rows.forEach(r => {
          const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
          const email = r.data && r.data.payload && r.data.payload.user && r.data.payload.user.email;
          if (uid && email && !u[uid]) { u[uid] = email; changed = true; }
        });
        if (changed) save('vinted_account_emails', u);
        return changed ? u : prev;
      });
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })(); }, []);
  // ── DIAGNOSTIC : santé de chaque compte (dernière capture par l'extension) ──
  // Requête LÉGÈRE : on ne lit que la colonne updated_at des lignes harvest_* (pas
  // les gros payloads) → pour chaque compte, la date de dernière capture. Croisé
  // avec updated_at du compte (fraîcheur du token) et la liste des bloqués.
  const [lastCap, setLastCap] = useState({}); // uid -> ms de la dernière capture
  const blockedAccts = useMemo(() => new Set((load('vinted_accounts_blocked', []) || []).map(String)), []);
  useEffect(() => { (async () => {
    try {
      // ⚠️ 1 127 lignes `harvest_*` en base : au-delà de 1 000, Supabase tronque
      // en silence et des comptes n'auraient JAMAIS de fraîcheur (§A1).
      // On écarte aussi les lignes vidées (comptes supprimés) : elles ne disent
      // plus rien sur la fraîcheur d'un compte vivant.
      const rows = await lireTout('id=like.harvest_*&select=id,updated_at,cap:meta->>capturedAt&meta->>supprime=is.null');
      if (!rows) return; const by = {};
      // ⚠️ Revue de la 5.167 : `harvest_{uid}_enligne` est la lecture PUBLIQUE de
      //    son dressing, faite avec la session d'un AUTRE compte (5.167) — ni ses
      //    ventes, ni sa messagerie, ni son porte-monnaie n'ont été lus. Comptée, elle
      //    faisait dire « À jour » à un compte figé depuis trois jours, en permanence
      //    (c'est l'écran qui dit sur quel compte repasser). `ligneDeSaSession`.
      rows.forEach(r => { const m = ligneDeSaSession(r && r.id); if (!m) return; const t = harvestTs(r) || 0; if (t && (!by[m[1]] || t > by[m[1]])) by[m[1]] = t; });
      setLastCap(by);
    } catch (_) {}
  })(); }, []);
  // ÉTAT ÉVALUÉ PAR L'EXTENSION (5.181, `noterEtatCompte`) : actif / banni, lu
  // dans le champ `is_account_banned` du profil Vinted qu'elle reçoit déjà.
  // Trois états : `undefined` en cours · `null` pas su (lecture ratée) · objet lu.
  // « Pas su » ne fait jamais « banni » : on retombe sur ce qu'on savait déjà.
  const [etatExt, setEtatExt] = useState(undefined);
  useEffect(() => {
    let mort = false, t = null;
    const lire = async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=data`, { headers: sbAuth() });
        if (!r.ok) { if (!mort) setEtatExt(null); return; }
        const rows = await r.json();
        if (!Array.isArray(rows)) { if (!mort) setEtatExt(null); return; }
        const d = (rows[0] && rows[0].data) || {};
        if (!mort) setEtatExt((d.comptes && typeof d.comptes === 'object') ? d.comptes : {});
      } catch (_) { if (!mort) setEtatExt(null); }
    };
    lire();
    const f = (e) => { const d = e && e.detail; if (!d || d.type !== 'maj' || d.quoi !== 'etatcompte') return; clearTimeout(t); t = setTimeout(lire, 800); };
    window.addEventListener('vrm:ext', f);
    return () => { mort = true; clearTimeout(t); window.removeEventListener('vrm:ext', f); };
  }, []);
  const acctHealth = (acc) => {
    const uid = String(acc.vinted_user_id);
    const ev = etatExt && etatExt[uid];
    const evLu = ev && (ev.etat === 'banni' || ev.etat === 'actif') ? ev : null;
    const evQuand = evLu && evLu.at ? (() => { try { return new Date(evLu.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } })() : '';
    // ⚠️⚠️ UN CHOIX N'EST PAS UNE PANNE. Vu en capture le 9 septembre :
    // l'en-tête annonçait « 2 en panne » en ROUGE, et l'un des deux était
    // `liliand653` — le compte que Julien a lui-même EXCLU de l'application
    // (le bandeau juste au-dessus le dit : « 1 compte est exclu »). Sa carte
    // affichait donc « Masqué (annonces + compta) » ET « Pas capté (il y a
    // 38 j) » en rouge, avec le conseil « repasse sur vinted.fr » — c'est-à-dire
    // exactement ce qu'il ne faut PAS faire pour un compte qu'on a mis de côté.
    // Même famille que le panneau de sécurité : une fausse alerte est ce qui
    // fait cesser de lire les vraies. Un compte exclu n'a plus d'état de
    // fraîcheur — il est simplement hors de l'app, en gris, sans consigne.
    // ⚠️ Cette branche vient EN PREMIER, avant même « refusé par Vinted » :
    // masquer un compte est très souvent la RÉPONSE à un blocage (le bouton le
    // dit : « idéal pour un compte bloqué ou fermé »). Une fois le geste fait,
    // l'app n'a plus à le réclamer. La raison reste écrite dans l'infobulle.
    if (hiddenAccts.has(uid)) return { etat: 'exclu', ic: 'eyeOff', label: 'Exclu de l\'app', color: C.muted,
      hint: `Tu as masqué ce compte : ses annonces, ses ventes et ses achats n'apparaissent nulle part.${blockedAccts.has(uid) ? ' (Vinted l\'avait aussi refusé.)' : ''} Sa date de capture ne veut donc plus rien dire ici — rien à rattraper.` };
    // L'extension l'a LU dans le profil Vinted : c'est la preuve la plus forte,
    // elle passe avant la liste locale (un refus 403 vu par cet appareil).
    if (evLu && evLu.etat === 'banni') return { etat: 'bad', source: 'extension', ic: 'alert', label: 'Banni par Vinted', color: C.danger, hint: `Vinted le dit lui-même dans le profil du compte (lu par l'extension${evQuand ? ` le ${evQuand}` : ''}). Rien n'est masqué tout seul : masque-le si tu ne veux plus voir ses annonces.` };
    if (!evLu && blockedAccts.has(uid)) return { etat: 'bad', source: 'appareil', ic: 'alert', label: 'Banni par Vinted', color: C.danger, hint: 'Vinted a refusé ce compte explicitement (403) : il est bloqué ou fermé. Ses annonces/ventes sont masquées. ⚠️ Une simple session expirée (401) ne met plus un compte ici : elle se règle en repassant sur vinted.fr.' };
    // (16 oct.) Julien : « juste s'il est actif ou banni, l'extension doit
    // évaluer l'état du compte ». Deux états sur la pastille ; la fraîcheur de
    // la capture n'est plus une alerte, seulement une ligne grise (`ago`).
    const cap = lastCap[uid];
    const ageH = cap ? (Date.now() - cap) / 3600000 : null;
    const ago = ageH == null ? 'pas encore capté' : ageH < 1 ? 'capté il y a moins d\'une heure' : ageH < 48 ? `capté il y a ${Math.round(ageH)} h` : `capté il y a ${Math.round(ageH / 24)} j`;
    const lu = evLu ? ` · état lu par l'extension${evQuand ? ` le ${evQuand}` : ''}` : '';
    return { etat: 'ok', source: evLu ? 'extension' : '', ic: 'check', label: 'Actif', color: C.text, hint: `Compte actif · ${ago}${lu}.`, ago };
  };
  // Comptes exclus de la comptabilité (leurs ventes ne comptent pas).
  const [hiddenAccts, setHiddenAccts] = useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  // ⚠️ MASQUER SE DEMANDE, RÉAFFICHER NON. La confirmation vivait sur les puces
  // de l'écran Annonces (Julien masquait des comptes en croyant FILTRER —
  // vérifié en base) ; ces puces sont parties ici le 2 octobre (H1), la
  // confirmation les suit. Le geste retire le compte de partout, sur tous les
  // appareils.
  const toggleAcctCompta = async (uid) => {
    const k = String(uid);
    if (!hiddenAccts.has(k)) {
      const a = (accounts || []).find(x => String(x.vinted_user_id) === k);
      const nom = a ? (labels[a.vinted_user_id] || a.login || `#${k}`) : `#${k}`;
      const ok = await askConfirm({
        title: `Masquer « ${nom} » ?`,
        desc: "Ses annonces disparaissent de l'écran Annonces et ses ventes ne comptent plus dans la comptabilité, sur tous tes appareils. À réserver à un compte fermé ou abandonné — un nouveau tap le réaffiche.",
        ok: 'Masquer', cancel: 'Annuler', danger: true,
      });
      if (!ok) return;
    }
    setHiddenAccts(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_accounts_hidden', [...n]); return n; });
  };

  const startEditLabel = (acc) => { setEditingLabel(acc.vinted_user_id); setLabelDraft(labels[acc.vinted_user_id] || acc.login || ''); };
  const commitLabel = (acc) => {
    const u = { ...labels, [acc.vinted_user_id]: labelDraft.trim() };
    if (!u[acc.vinted_user_id]) delete u[acc.vinted_user_id];
    setLabels(u); save('vinted_account_labels', u);
    setEditingLabel(null);
  };
  const accountName = (acc) => labels[acc.vinted_user_id] || acc.login || `Compte #${acc.vinted_user_id}`;

  // Déconnecter un compte : le retire de l'app (Supabase + state). Utile quand un
  // compte est bloqué/fermé définitivement. On garde son étiquette au cas où.
  const [removing, setRemoving] = useState(null);
  const disconnectAccount = async (acc) => {
    if (!await askConfirm({
      title: `Supprimer « ${accountName(acc)} » ?`,
      // On dit exactement ce qui part, et ce qui reste. « Déconnecter » laissait
      // croire à un simple débranchement — Julien veut choisir ses comptes et
      // supprimer les autres pour de bon.
      desc: "Ses jetons, ses annonces, ses ventes et ses achats captés sont effacés, et l'extension ne le recaptera plus (avant, il revenait tout seul au bout de 10 minutes). Son chiffre d'affaires passé reste dans tes statistiques — c'est de l'argent réellement gagné. Tes numéros de garage et tes factures ne bougent pas. Réversible depuis « Tout réafficher ».",
      ok: 'Supprimer', cancel: 'Garder', danger: true,
    })) return;
    // ⚠️ UNE SEULE QUESTION. Une deuxième feuille s'ouvrait juste après la
    // première (« garder son chiffre d'affaires passé ? ») : deux boîtes à la
    // suite pour un seul geste, et surtout — mesuré au banc — tant qu'on n'y
    // répondait pas, LA SUPPRESSION NE PARTAIT PAS. On garde le comportement
    // sensé par défaut : ses ventes passées restent dans le chiffre d'affaires,
    // parce que c'est de l'argent réellement gagné. Ça ne se devine pas, c'est
    // écrit dans la confirmation ci-dessus.
    const login = String(acc.login || '').trim().toLowerCase();
    if (login) {
      const cur = (load('vinted_ca_keep_removed', []) || []).map(String);
      save('vinted_ca_keep_removed', [...new Set([...cur, login])]);
    }
    // ⚠️ On MASQUE aussi le compte de façon permanente (vinted_accounts_hidden,
    // clé synchronisée). Supprimer la ligne Supabase ne suffit pas : un compte
    // encore connecté dans Chrome est RE-CAPTURÉ par l'extension au prochain
    // passage sur Vinted, et il revenait dans les annonces + les stats (plainte
    // de Julien : « je l'ai supprimé mais il est toujours là »). Le masque, lui,
    // survit à la re-capture (il est posé sur l'uid, pas sur la ligne du compte)
    // → annonces ET stats l'excluent pour de bon (skipAcc / acctOff).
    // ⚠️ ON NE MASQUE PLUS EN PLUS DE SUPPRIMER. `deleteVintedAccount` inscrit
    // désormais le compte dans `vrm_blocked_accounts` (l'extension refuse de le
    // recapter) ET vide ses lignes moissonnées. Ajouter en prime son uid à
    // `vinted_accounts_hidden` — une clé SYNCHRONISÉE — le faisait apparaître
    // « masqué » sur tous les appareils alors qu'il était supprimé : c'est la
    // moitié de la confusion « mes comptes sont tous masqués » (§5.09/§5.10).
    setRemoving(acc.vinted_user_id);
    const r = await deleteVintedAccount(acc.vinted_user_id, acc.login);
    setRemoving(null);
    // ⚠️ Le mémo « ne le recapte plus » et la suppression des jetons sont DEUX
    //    choses. Quand le mémo n'a pas pu être écrit (base injoignable), le
    //    compte est bien parti mais l'extension peut le ramener : on le dit, et
    //    on dit le geste. Se taire, c'est le défaut d'origine (« je l'ai
    //    supprimé mais il est toujours là »).
    toast(!r.ok ? 'Échec de la suppression — réessaie.'
      : r.memo ? `« ${accountName(acc)} » supprimé.`
      : `« ${accountName(acc)} » supprimé — mais la base n'a pas répondu pour le mémo. S'il réapparaît, resupprime-le.`);
    setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
  };

  // ── SUPPRESSION CIBLÉE (modale, récupérable) ────────────────────────────────
  // Julien : « on doit pouvoir sélectionner si on veut tout enlever — la compta,
  // les ventes, les achats, les annonces » + « pour récupérer, je reconnecte
  // l'extension ». La modale efface les lignes CHOISIES (récupérables à la
  // prochaine capture) ; elle n'écrit JAMAIS la liste noire. La compta se
  // calcule sur les ventes : la modale le dit, pas de fausse case qui
  // dupliquerait « ventes ». Le blocage définitif reste une option à part.
  const [delCible, setDelCible] = useState(null);     // le compte visé, ou null
  const [delScopes, setDelScopes] = useState({ annonces: true, ventes: true, achats: true, messages: true, compte: true });
  const [delBusy, setDelBusy] = useState(false);
  const ouvrirSuppression = (acc) => { setDelScopes({ annonces: true, ventes: true, achats: true, messages: true, compte: true }); setDelCible(acc); };
  const rienCoche = !delScopes.annonces && !delScopes.ventes && !delScopes.achats && !delScopes.messages && !delScopes.compte;
  const confirmerSuppression = async () => {
    const acc = delCible; if (!acc || rienCoche) return;
    setDelBusy(true);
    const r = await supprimerDonneesCompte(acc.vinted_user_id, acc.login, delScopes);
    setDelBusy(false);
    if (!r.ok) { toast('Échec de la suppression — réessaie.'); return; }
    toast(delScopes.compte
      ? `« ${accountName(acc)} » retiré. Pour le récupérer : reconnecte l'extension sur ce compte Vinted.`
      : `Données effacées pour « ${accountName(acc)} ». Elles reviendront à ta prochaine visite sur Vinted avec ce compte.`);
    // Si on a retiré le compte lui-même, il quitte la liste ; sinon il reste
    // (ses lignes effacées se re-captent).
    if (delScopes.compte) setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
    setDelCible(null);
  };
  // Blocage DÉFINITIF (option à part, dans la modale) : compte fermé par Vinted
  // — l'extension ne doit plus JAMAIS le recapter. On DÉLÈGUE à
  // `disconnectAccount`, le chemin éprouvé (sa propre confirmation, l'écriture
  // `vrm_blocked_accounts`, le `vinted_ca_keep_removed`, le toast) : pas de
  // logique dupliquée, et `disconnectAccount` reste vivant (pas de code mort).
  const bloquerDefinitif = async () => {
    const acc = delCible; if (!acc) return;
    setDelCible(null);
    await disconnectAccount(acc);
  };

  const refreshAccounts = async () => {
    setLoading(true);
    const list = await fetchVintedAccounts();
    // ⚠️ Un échec ne doit pas EFFACER la liste affichée : sinon un « ↻ Actualiser »
    //    pendant une panne fait disparaître ses neuf comptes sous ses yeux.
    if (Array.isArray(list)) setAccounts(list);
    setLoading(false);
  };
  useEffect(() => { refreshAccounts(); /* eslint-disable-next-line */ }, []);


  // ── TOUT REMETTRE : le seul écran qui décide de ce qui manque ──────────────
  // Demande de Julien : « mets TOUTES les annonces et TOUTES les ventes dans
  // l'application ». Relevé du 15 août : 9 annonces et 153 ventes visibles,
  // pour **112 annonces et 514 ventes réellement captées** — l'écart n'est pas
  // une perte de données, c'est trois comptes masqués (des puces tapées par
  // erreur, §5.10) et un compte retiré qui porte à lui seul 96 annonces et
  // 284 ventes. Un bouton remet tout, au lieu de chercher où ça coince.
  const [retires, setRetires] = useState(null);   // { uids:[], logins:[] }
  const [remise, setRemise] = useState(false);
  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts&select=data`, { headers: sbAuth() });
      if (!r.ok) return;
      const j = await r.json();
      setRetires((j[0] && j[0].data) || { uids: [], logins: [] });
    } catch (_) { /* pas bloquant */ }
  })(); }, []);
  const nbExclus = hiddenAccts.size + ((retires && retires.uids) || []).length;
  const toutAfficher = async () => {
    if (!await askConfirm({
      title: 'Tout réafficher ?',
      desc: "Les comptes masqués et les comptes retirés reviennent, avec leurs annonces, leurs ventes et leurs achats. Tu pourras en remasquer un ensuite si besoin.",
      ok: 'Tout réafficher', cancel: 'Annuler',
    })) return;
    setRemise(true);
    setHiddenAccts(new Set()); save('vinted_accounts_hidden', []);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts`, {
        method: 'PATCH',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ data: { uids: [], logins: [], note: 'tout réaffiché depuis l\'app' } }),
      });
      setRetires({ uids: [], logins: [] });
    } catch (_) { /* le démasquage local est déjà fait */ }
    // ⚠️ Ici `blockedAccts` est un useMemo (pas d'état) : on écrit la clé, et
    // l'app la relit au prochain démarrage. Appeler un `setBlockedAccts`
    // inexistant dans CE composant planterait l'écran (même famille de bug
    // qu'en §26 : un identifiant absent que le build ne voit pas).
    save('vinted_accounts_blocked', []);
    await refreshAccounts();
    setRemise(false);
    toast('Tous les comptes sont réaffichés — rouvre l\'onglet Annonces');
  };

  return (
    <div style={{padding:'16px 14px 40px'}}>
      {nbExclus > 0 && (
        <div style={{border:`1px solid ${C.warn}`,background:`${C.warn}14`,borderRadius:10,padding:'12px 13px',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>
            {nbExclus} compte{nbExclus>1?'s':''} {nbExclus>1?'sont exclus':'est exclu'} de l'application
          </div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:9}}>
            Leurs annonces, leurs ventes et leurs achats n'apparaissent nulle part — ni dans les onglets, ni dans les totaux.
            {(retires && retires.logins && retires.logins.length)
              ? ` Retiré${retires.logins.length>1?'s':''} : ${retires.logins.join(', ')}.` : ''}
          </div>
          <button type="button" onClick={toutAfficher} disabled={remise}
            style={{width:'100%',border:'none',background:C.accent,color:C.onAccent||'#fff',borderRadius:10,padding:'11px',fontSize:13,fontWeight:600,cursor:remise?'default':'pointer',fontFamily:'inherit'}}>
            {remise ? '…' : 'Tout réafficher'}
          </button>
        </div>
      )}
      <ScreenHead icon="link" title="Comptes Vinted liés"
        desc="Ceux que l'extension Chrome capte quand tu navigues sur Vinted. Annonces, ventes, achats et messages se consultent dans leurs onglets."
        right={<button type="button" onClick={refreshAccounts} title="Recharge la liste des comptes captés par l'extension" style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:500,color:C.text}}>
          {loading ? '…' : '↻ Actualiser'}
        </button>}/>

      {/* ⚠️ « Aucun compte détecté · installe l'extension » à quelqu'un qui en a
          NEUF : c'est ce que cet écran affichait quand la base ne répondait pas.
          Et ce n'était pas seulement faux, c'était une consigne à ne SURTOUT
          pas suivre — réinstaller l'extension ne répare pas une panne de
          lecture. Une liste vide parce qu'on n'a pas pu lire n'est pas une
          liste vide. */}
      {accounts.length === 0 && (baseKO
        ? <LignePanne>Je n'ai pas pu lire la liste de tes comptes — elle est vide parce que la lecture a échoué, pas parce qu'aucun compte n'est lié. Rien n'est perdu.</LignePanne>
        : (
        <div style={{padding:16,borderRadius:10,background:C.card,border:`1px solid ${C.border}`,fontSize:13,color:C.muted,lineHeight:1.5}}>
          Aucun compte détecté pour l'instant. Installe l'extension VRM,
          connecte-toi sur vinted.fr, puis clique sur « Actualiser ».
        </div>
      ))}

      {/* Diagnostic global : combien de comptes à jour / à rafraîchir / bloqués. */}
      {accounts.length > 0 && (()=>{
        const st = accounts.map(acctHealth);
        // ⚠️ ON NE COMPTE QUE LES COMPTES QUI SONT DANS L'APP. Les exclus ont
        //    leur mention à part, en gris : ils ne sont ni « à jour » ni « en
        //    panne », ils sont ailleurs. Les mêler aux autres, c'était annoncer
        //    « 2 en panne » pour une panne réelle et un choix assumé.
        const ok    = st.filter(s=>s.etat==='ok').length;
        const warn  = st.filter(s=>s.etat==='warn').length;
        const bad   = st.filter(s=>s.etat==='bad').length;
        const exclu = st.filter(s=>s.etat==='exclu').length;
        return (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:10,background:C.card,marginBottom:14,fontSize:13,fontWeight:600}}>
            <span style={{color:C.text}}>Tes comptes :</span>
            <span data-comptes-actifs={ok} style={{display:'inline-flex',alignItems:'center',gap:4,color:C.text}}><Icon name="check" size={13}/>{ok} actif{ok>1?'s':''}</span>
            {bad>0 && <span data-comptes-bannis={bad} style={{display:'inline-flex',alignItems:'center',gap:4,color:C.danger}}><Icon name="alert" size={13}/>{bad} banni{bad>1?'s':''} par Vinted</span>}
            {exclu>0 && <span style={{display:'inline-flex',alignItems:'center',gap:4,color:C.muted}}><Icon name="eyeOff" size={13}/>{exclu} masqué{exclu>1?'s':''} — ton choix</span>}
          </div>
        );
      })()}

      {accounts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {accounts.map(acc => {
            return (
              <div key={acc.vinted_user_id} style={{borderRadius:10,border:`1px solid ${C.border}`,background:C.card,boxShadow:C.shadow||'none',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                  <span style={{width:36,height:36,flexShrink:0,borderRadius:8,background:C.border,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700}}>
                    {accountName(acc).slice(0,1).toUpperCase()}
                  </span>
                  <div style={{minWidth:0}}>
                    {editingLabel === acc.vinted_user_id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input autoFocus value={labelDraft} onChange={e=>setLabelDraft(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') commitLabel(acc); if(e.key==='Escape') setEditingLabel(null); }}
                          placeholder={acc.login || `Compte #${acc.vinted_user_id}`}
                          style={{fontSize:15,fontWeight:600,color:C.text,background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,padding:'3px 8px',width:170}}/>
                        <button type="button" onClick={()=>commitLabel(acc)} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:500}}>OK</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}} onClick={()=>startEditLabel(acc)} title="Cliquer pour renommer">
                        <div className="vrm-sensible" style={{fontWeight:600,color:C.text,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{accountName(acc)}</div>
                        <span style={{color:C.muted,display:'inline-flex'}}><Icon name="pencil" size={12}/></span>
                      </div>
                    )}
                    <div style={{fontSize:11,color:C.muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {acc.login && acc.login !== accountName(acc) ? `@${acc.login} · ` : ''}
                      {/* ⚠️ « maj » est de l'abréviation d'informaticien (§7), et
                          l'heure À LA SECONDE ne sert à rien : on lit cette ligne
                          pour savoir si c'est frais, pas pour horodater. */}
                      {/* (20 oct., audit sur données réelles) « lié le » lisait
                          `updated_at` — la date du dernier RENOUVELLEMENT des
                          jetons (§4.3 : `updated_at` ment) : ses sept comptes,
                          liés en juillet et août, se disaient « liés le
                          20/10/2026 ». La date de liaison est `created_at`. */}
                      {acc.created_at ? `lié le ${new Date(acc.created_at).toLocaleDateString('fr-FR')}` : 'date de liaison inconnue'}
                    </div>
                    {(()=>{ const h=acctHealth(acc); return (<>
                      <div data-etat-compte={h.etat==='bad'?'banni':h.etat==='exclu'?'masque':'actif'} data-etat-source={h.source||''} title={h.hint} style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:4,fontSize:11,fontWeight:600,color:h.color,background:h.etat==='ok'?C.bg:`${h.color}14`,border:`1px solid ${h.etat==='ok'?C.border:h.color+'44'}`,borderRadius:8,padding:'2px 9px'}}><Icon name={h.ic} size={12}/>{h.label}</div>
                      {h.ago && <span style={{fontSize:11,color:C.muted,marginLeft:8}}>{h.ago}</span>}
                      {(() => {
                        // Pro / particulier : ce que l'extension a publié d'abord
                        // (`panel_comptes_etat`, 5.185), sinon le profil capté —
                        // la même règle. Pas su ⇒ rien (jamais « particulier » par défaut).
                        const uid = String(acc.vinted_user_id);
                        const ev = etatExt && etatExt[uid];
                        const pro = ev && typeof ev.pro === 'boolean' ? ev.pro : (typeof typesProfil[uid] === 'boolean' ? typesProfil[uid] : null);
                        if (pro == null) return null;
                        return <span data-type-compte={pro ? 'pro' : 'particulier'} title={pro ? 'Compte Vinted Pro : Vinted t\'envoie les coordonnées de l\'acheteur, une facture est possible.' : 'Compte particulier : Vinted ne transmet pas les coordonnées de l\'acheteur, aucune facture n\'est faite.'}
                          style={{display:'inline-flex',alignItems:'center',marginTop:4,marginLeft:8,fontSize:11,fontWeight:600,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'2px 8px'}}>{pro ? 'Pro' : 'Particulier'}</span>;
                      })()}
                    </>); })()}
                    {(()=>{ const r=reput[String(acc.vinted_user_id)]; if(!r||(r.rating==null&&r.count==null)) return null; const stars=r.rating!=null?(r.rating*5):null; return (
                      <div style={{fontSize:12,marginTop:3,fontWeight:600,color:C.warn}} title="Note vendeur et nombre d'avis (Vinted)">
                        {stars!=null?<>⭐ {stars.toFixed(2)}/5</>:''}
                        {stars!=null&&r.count!=null?' · ':''}
                        {r.count!=null?<span style={{color:C.muted,fontWeight:500}}>{r.count} avis</span>:''}
                        {r.neg>0?<span style={{color:C.danger,fontWeight:500}}> · {r.neg} négatif{r.neg>1?'s':''}</span>:''}
                      </div>
                    ); })()}
                  </div>
                </div>
                <details data-gerer-compte="" style={{flex:'1 1 100%'}}>
                  <summary style={{cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted,padding:'2px 0'}}>Gérer ce compte</summary>
                  <div style={{paddingTop:8}}>
                    <input
                      value={acctEmails[String(acc.vinted_user_id)] || ''}
                      onChange={e=>setAcctEmail(acc.vinted_user_id, e.target.value)}
                      placeholder="Email du compte"
                      title="L'adresse à laquelle Vinted écrit pour ce compte. Permet d'attribuer automatiquement les emails (ventes, bordereaux) au bon compte."
                      style={{marginTop:6,width:'100%',maxWidth:280,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 9px',fontSize:12,fontFamily:'inherit',background:C.surface,color:C.text,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                    <input
                      type="tel" inputMode="tel"
                      value={acctPhones[String(acc.vinted_user_id)] || ''}
                      onChange={e=>setAcctPhone(acc.vinted_user_id, e.target.value)}
                      placeholder="Téléphone du compte"
                      title="Le numéro utilisé pour ce compte Vinted. Si tu le mets aussi sur un autre compte, l'app te le signale."
                      style={{display:'block',marginTop:6,width:'100%',maxWidth:280,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 9px',fontSize:12,fontFamily:'inherit',background:C.surface,color:C.text,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                    {(()=>{ const n=telNorm(acctPhones[String(acc.vinted_user_id)]); if(n.length<9) return null;
                      const autres=(accounts||[]).filter(o=>String(o.vinted_user_id)!==String(acc.vinted_user_id) && telNorm(acctPhones[String(o.vinted_user_id)])===n).map(o=>labels[String(o.vinted_user_id)]||o.login||`#${o.vinted_user_id}`);
                      return autres.length ? <div style={{fontSize:11,color:C.warn,marginTop:3}}>Ce numéro sert aussi sur {autres.join(', ')}.</div> : null; })()}
                  <div style={{marginTop:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {(() => { const off = hiddenAccts.has(String(acc.vinted_user_id)); return (
                    <button type="button" onClick={()=>toggleAcctCompta(acc.vinted_user_id)} title={off?'Ce compte est MASQUÉ : ses annonces et ses ventes/achats n’apparaissent nulle part (annonces + compta). Idéal pour un compte bloqué ou fermé.':'Ce compte est ACTIF : ses annonces et sa compta sont visibles. Clique pour le masquer partout (compte bloqué/fermé).'}
                      style={{background:off?'transparent':`${C.accent}14`,border:`1px solid ${off?C.border:C.accent}`,borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:500,color:off?C.muted:C.accent}}>
                      {off ? <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eyeOff" size={12}/>Masqué (annonces + compta)</span>
                           : <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="check" size={12}/>Actif</span>}
                    </button>
                  ); })()}
                  <button type="button" onClick={()=>ouvrirSuppression(acc)} title="Supprimer les données de ce compte — tu choisis quoi effacer (annonces, ventes, achats, messages, le compte). Récupérable en reconnectant l'extension."
                    style={{background:'transparent',border:`1px solid ${C.danger}`,borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:500,color:C.danger}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="trash" size={12}/>Supprimer ce compte</span>
                  </button>
                </div>
                  </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODALE : SUPPRIMER LES DONNÉES D'UN COMPTE (ciblé, récupérable) ──── */}
      {delCible && (()=>{ const acc = delCible;
        const Case = ({ k, titre, sous }) => (
          <label style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',border:`1px solid ${delScopes[k]?C.accent:C.border}`,background:delScopes[k]?`${C.accent}0d`:'transparent',borderRadius:10,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={!!delScopes[k]} onChange={e=>setDelScopes(s=>({...s,[k]:e.target.checked}))} style={{marginTop:2,width:17,height:17,accentColor:C.accent,flexShrink:0}}/>
            <span style={{minWidth:0}}>
              <span style={{display:'block',fontSize:13.5,fontWeight:600,color:C.text}}>{titre}</span>
              <span style={{display:'block',fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:1}}>{sous}</span>
            </span>
          </label>
        );
        const tout = delScopes.annonces && delScopes.ventes && delScopes.achats && delScopes.messages && delScopes.compte;
        return (
        <div onClick={()=>!delBusy&&setDelCible(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1300,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}}>
          <FermeAuRetour fermer={()=>!delBusy&&setDelCible(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'92vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
              <span style={{flexShrink:0,width:34,height:34,borderRadius:8,background:`${C.danger}14`,color:C.danger,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={17}/></span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>Supprimer les données de « {accountName(acc)} »</div>
                <div style={{fontSize:11.5,color:C.muted}}>Choisis ce que tu effaces. Rien ne part tant que tu n'as pas confirmé.</div>
              </div>
              <button type="button" onClick={()=>!delBusy&&setDelCible(null)} aria-label="Fermer" style={{flexShrink:0,border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'14px 16px'}}>
              {/* Tout sélectionner / désélectionner */}
              <label style={{display:'flex',gap:10,alignItems:'center',padding:'8px 12px',borderRadius:10,cursor:'pointer',marginBottom:10,background:C.card,border:`1px solid ${C.border}`}}>
                <input type="checkbox" checked={tout} onChange={e=>{ const v=e.target.checked; setDelScopes({annonces:v,ventes:v,achats:v,messages:v,compte:v}); }} style={{width:17,height:17,accentColor:C.accent}}/>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>Tout supprimer</span>
              </label>
              <Case k="annonces" titre="Annonces" sous="Le dressing capté, les photos et descriptions, le coffre."/>
              <Case k="ventes" titre="Ventes" sous="Les ventes, transactions, bordereaux, relevés et porte-monnaie. La compta (CA, URSSAF) se recalcule dessus : la retirer la met à jour."/>
              <Case k="achats" titre="Achats" sous="Les commandes achetées sur ce compte."/>
              <Case k="messages" titre="Messages" sous="Les conversations captées de ce compte."/>
              <Case k="compte" titre="Le compte et ses jetons" sous="Retire le compte de la liste. Tu le récupères en reconnectant l'extension dessus sur Vinted."/>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.5,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',marginTop:4}}>
                ↩︎ <b style={{color:C.text}}>Rien n'est perdu pour de bon</b> : ce que tu effaces ici revient tout seul à ta prochaine visite sur Vinted avec ce compte (l'extension recapte). Pour qu'un compte ne revienne <b>jamais</b> (fermé par Vinted), utilise le blocage ci-dessous.
              </div>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:8}}>
                <button type="button" onClick={()=>!delBusy&&setDelCible(null)} style={{flex:1,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:10,padding:'12px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
                <button type="button" onClick={confirmerSuppression} disabled={delBusy||rienCoche} style={{flex:2,border:'none',background:rienCoche?C.border:C.danger,color:'#fff',borderRadius:10,padding:'12px',fontSize:14,fontWeight:700,cursor:(delBusy||rienCoche)?'default':'pointer',fontFamily:'inherit',opacity:delBusy?0.6:1}}>{delBusy?'…':rienCoche?'Coche au moins une case':'Supprimer'}</button>
              </div>
              <button type="button" onClick={bloquerDefinitif} disabled={delBusy} style={{border:'none',background:'transparent',color:C.muted,borderRadius:10,padding:'4px',fontSize:12,fontWeight:500,cursor:delBusy?'default':'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Compte fermé par Vinted ? Le bloquer définitivement</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}
// Le même choix, dans Réglages → Affichage (là où vivent les choix de l'écran).
function BeneficeJourneeSetting() {
  const [on, poser] = useBeneficeJournee();
  return (
    <div className="vrm-set-ligne" data-reglage-benef-journee={on ? 'on' : 'off'}>
      <IconeReglage name="chart"/>
      <span className="vrm-set-lib">
        <b style={{color:C.text}}>Bénéfice dans Ma journée</b>
        <small style={{color:C.muted}}>Brut et net du mois, et d'aujourd'hui — les mêmes chiffres que Comptabilité.</small>
      </span>
      <Interrupteur on={on} label="Bénéfice dans Ma journée" onClick={() => poser(!on)}/>
    </div>
  );
}
function PushPrefsSetting({ comptes, onMuets }) {
  // ⚠️ TROIS ÉTATS : `undefined` = en cours de lecture · `null` = la base n'a
  //    pas répondu · un objet = lu. Confondre les deux premiers ferait dire
  //    « Chargement… » pour toujours à un panneau qui a ÉCHOUÉ.
  const [prefs, setPrefs] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  // Comptes dont ni les ventes ni les messages ne peuvent déclencher de
  // notification : la MÊME règle que l'écran Achats (`etatEmailsComptes`, §11).
  // Rien tant qu'on ne sait pas : jamais une accusation sur une lecture ratée.
  const etatComptes = useEtatEmailsComptes(comptes);
  const muets = etatComptes.etat === 'lu' ? etatComptes.muets : null;
  // Au téléphone ce panneau vit dans un sous-écran : la ligne qui y mène dit
  // combien de comptes sont muets — le MÊME nombre, remonté d'ici (§11).
  const nMuets = muets ? muets.length : null;
  useEffect(() => { if (onMuets) onMuets(nMuets); }, [nMuets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let mort = false;
    (async () => {
      try {
        const d = await lireReglage('push_prefs');
        // `null` = pas su : on NE bascule rien tant qu'on n'a pas lu (sinon un
        // seul clic réécrit la ligne avec une seule préférence).
        if (!mort) setPrefs(d);
      } catch (_) { if (!mort) setPrefs(null); }
    })();
    return () => { mort = true; };
  }, []);
  const actif = (c) => { const v = prefs && prefs[c.id]; return typeof v === 'boolean' ? v : c.def; };
  const pasLu = prefs === null;              // la base n'a pas répondu
  const enCours = prefs === undefined;
  const bascule = async (c) => {
    if (busy || pasLu) return; setBusy(true);
    const next = { ...(prefs || {}), [c.id]: !actif(c) };
    setPrefs(next);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method: 'POST',
        headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([withOwner({ id: 'push_prefs', data: next })]),
      });
    } catch (_) { toast("Réglage non enregistré — réessaie quand tu as du réseau."); }
    setBusy(false);
  };
  const n = prefs ? PUSH_CATS.filter(actif).length : 0;
  return (
    <details style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'10px 14px'}} onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary style={{cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>Ce que tu reçois sur ton téléphone</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>
            {enCours ? 'Chargement…'
              : pasLu ? <span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span>
              : `${n} type${n>1?'s':''} de notification sur ${PUSH_CATS.length}. Par défaut, on ne sonne que pour l'argent et ce qu'il y a à faire.`}
            {/* §7 (revue du 11 oct.) : déplié, le bloc dessous dit tout — le résumé se tait. */}
            {muets && muets.length > 0 && !ouvert && (
              <div style={{color:C.warn,fontWeight:600,marginTop:3}} data-resume-muets={muets.length}>
                ⚠ {muets.length} compte{muets.length>1?'s':''} n’envoie{muets.length>1?'nt':''} aucun email à VRM&nbsp;: ni {muets.length>1?'leurs':'ses'} ventes ni {muets.length>1?'leurs':'ses'} messages ne te préviendront — déplie pour savoir lesquels.
              </div>
            )}
          </div>
        </div>
        <span style={{color:C.muted,fontSize:13,flexShrink:0}}>▾</span>
      </summary>
      {muets && muets.length > 0 && (
        <div style={{marginTop:10}}><BlocComptesMuets muets={muets}/></div>
      )}
      <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:2}}>
        {PUSH_CATS.map(c => {
          const on = actif(c);
          return (
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>{c.titre}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1,lineHeight:1.35}}>{c.desc}</div>
              </div>
              <Interrupteur on={on} onClick={()=>bascule(c)} disabled={!prefs||busy} label={`${c.titre} : ${on?'activé':'désactivé'}`}/>
            </div>
          );
        })}
      </div>
    </details>
  );
}
function SettingsScreen({ setTab, comptes, onExport, onImport, dark, toggleDark, notifEnabled, onToggleNotif }) {
  // Actions sur le compte : une vraie fenêtre plutôt qu'un prompt du navigateur.
  // Un window.prompt ne se style pas, ne masque pas le mot de passe saisi, et
  // sur iPhone il s'affiche comme une alerte système au milieu de rien — c'est
  // exactement ce qui fait « page web bricolée » au lieu d'« application ».
  const [acct, setAcct] = React.useState(null);   // { mode:'email'|'pw'|'out', val, err, busy }
  // Fenêtre d'action sur le compte (email / mot de passe / déconnexion).
  const AcctSheet = () => {
    if (!acct) return null;
    const M = acct.mode;
    const titre = M==='email' ? 'Changer mon email' : M==='pw' ? 'Changer mon mot de passe' : 'Se déconnecter';
    const close = () => setAcct(null);
    const valider = async () => {
      setAcct(a => ({ ...a, busy:true, err:'' }));
      // Un temps pour que le message à l'extension parte avant le rechargement.
      if (M === 'out') { authSignOut(); setTimeout(() => location.reload(), 300); return; }
      if (M === 'pw') {
        if (acct.val.length < 8) { setAcct(a=>({...a,busy:false,err:'8 caractères minimum.'})); return; }
        if (/^(\d+|[a-zA-Z]+)$/.test(acct.val)) { setAcct(a=>({...a,busy:false,err:'Mélange lettres et chiffres — ce mot de passe protège ta compta.'})); return; }
        const r = await authSetPassword(acct.val);
        if (!r.ok) { setAcct(a=>({...a,busy:false,err:r.error})); return; }
        close(); toast('✓ Mot de passe changé');
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(acct.val.trim())) { setAcct(a=>({...a,busy:false,err:'Adresse email invalide.'})); return; }
      const r = await authSetEmail(acct.val);
      if (!r.ok) { setAcct(a=>({...a,busy:false,err:r.error})); return; }
      close(); toast("✓ Demande envoyée — ouvre le lien reçu pour valider la nouvelle adresse");
    };
    // ⚠️ 30 sept. (Julien) : « le bouton Se déconnecter est trop bas, la barre
    // Leboncoin/Vestiaire passe dessus ». Rendue DANS l'écran, la fenêtre était
    // piégée sous la barre du bas (même défaut que l'overlay plus bas) : elle
    // part dans document.body, au-dessus de tout.
    return createPortal(
      <div onClick={close} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:10000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
        <FermeAuRetour fermer={close}/>
        <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:460,borderRadius:'20px 20px 0 0',padding:'16px 18px calc(22px + env(safe-area-inset-bottom))'}}>
          <div style={{width:36,height:4,borderRadius:8,background:C.border,margin:'0 auto 14px'}}/>
          <div style={{fontSize:17,fontWeight:700,color:M==='out'?C.danger:C.text,letterSpacing:'-0.02em'}}>{titre}</div>
          <div style={{fontSize:12.5,color:C.muted,marginTop:4,lineHeight:1.5}}>
            {M==='email' ? <>Tu recevras un lien de validation. <b style={{color:C.text}}>Tant qu'il n'est pas ouvert, ton adresse actuelle reste celle qui fonctionne</b> — tu ne peux pas te retrouver enfermé dehors.</>
             : M==='pw'  ? <>8 caractères minimum, lettres et chiffres mélangés. Tu restes connecté après le changement.</>
             : <>Tes données restent en ligne et reviendront à la prochaine connexion. On efface seulement ce qui est stocké dans <b style={{color:C.text}}>ce navigateur</b>, pour qu'une autre personne qui se connecte derrière toi n'hérite pas de tes numéros.</>}
          </div>
          {M!=='out' && (
            <input autoFocus type={M==='pw'?'password':'email'} inputMode={M==='email'?'email':undefined}
              autoComplete={M==='pw'?'new-password':'email'} autoCapitalize="none"
              placeholder={M==='email'?'nouvelle@adresse.com':'Nouveau mot de passe'}
              value={acct.val} onChange={e=>setAcct(a=>({...a,val:e.target.value,err:''}))}
              onKeyDown={e=>{ if(e.key==='Enter') valider(); }}
              style={{width:'100%',boxSizing:'border-box',marginTop:12,border:`1px solid ${acct.err?C.danger:C.border}`,borderRadius:10,padding:'13px 14px',fontSize:15,background:C.card,color:C.text,outline:'none',fontFamily:'inherit'}}/>
          )}
          {acct.err && <div style={{fontSize:12.5,color:C.danger,marginTop:8,lineHeight:1.4}}>{acct.err}</div>}
          <div style={{display:'flex',gap:9,marginTop:14}}>
            <button type="button" onClick={close} style={{flex:1,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:10,padding:'12px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
            <button type="button" onClick={valider} disabled={acct.busy || (M!=='out' && !acct.val.trim())}
              style={{flex:2,border:'none',background:M==='out'?C.danger:C.accent,color:'#fff',borderRadius:10,padding:'12px',fontSize:13.5,fontWeight:600,
                cursor:(acct.busy||(M!=='out'&&!acct.val.trim()))?'default':'pointer',opacity:(acct.busy||(M!=='out'&&!acct.val.trim()))?0.5:1,fontFamily:'inherit'}}>
              {acct.busy ? '…' : M==='out' ? 'Se déconnecter' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ── DEUX ONGLETS : « Réglages » et « Mon compte » (Julien, 4 octobre) ─────
  // « un onglet pour gérer l'abonnement et les factures dans les paramètres,
  // avec ses infos de compte regroupées ». Tout ce qui concerne LA PERSONNE
  // (identité, abonnement, carte, factures, connexion, ses données) vit dans
  // « Mon compte » ; ce qui règle l'APP reste dans « Réglages ».
  // Sans session (accès temporaire), pas d'onglets : l'écran reste d'un bloc,
  // et le bouton « Aller à l'écran de connexion » reste visible tout de suite.
  const ongletsCompte = MULTI_USER && !!AUTH.user;
  const [vue, setVueBrute] = React.useState(() => {
    // Retour de Stripe (paiement, page de gestion) : on revient sur le compte.
    // (17 oct., Julien : « prépare dans les paramètres un onglet abonnement »)
    // Le retour de Stripe (paiement, page de gestion) ouvre l'onglet Abonnement.
    if (RETOUR_ABONNEMENT || RETOUR_VUE === 'abonnement') return 'abonnement';
    if (RETOUR_VUE === 'compte') return 'compte';
    try { const v = localStorage.getItem('vrm_reglages_vue'); return v === 'compte' || v === 'abonnement' ? v : 'reglages'; } catch (_) { return 'reglages'; }
  });
  const voirCompte = !ongletsCompte || vue === 'compte';
  const voirReglages = !ongletsCompte || vue === 'reglages';
  const voirAbonnement = ongletsCompte && !!AUTH.user && vue === 'abonnement';

  // ── LA DISPOSITION (16 octobre : « trop vibe-codé, surtout sur téléphone ») ─
  // Modèle : les Réglages d'iOS. Des groupes en listes à lignes ; un panneau
  // long n'est plus déplié dans une page interminable : sur TÉLÉPHONE il
  // s'ouvre dans un SOUS-ÉCRAN (chevron, puis « ‹ Réglages »). Sur ordinateur
  // la place ne manque pas : tout reste déplié, avec un sommaire collant.
  // ⚠️ Les panneaux restent MONTÉS même fermés (`hidden`) : chacun lit sa ligne
  //    au montage (`lireReglage`), et le bloc « N réglages n'ont pas pu être
  //    lus » (ReglagesPasLus) nomme ceux qui ont échoué — un panneau jamais
  //    monté ne lirait rien et ce bloc se tairait. Aucune règle de lecture ni
  //    d'écriture ne change : c'est le même composant, rangé ailleurs.
  const etroit = useEtroitReglages();
  const [nMuetsPush, setNMuetsPush] = React.useState(null);
  const [sous, setSous] = React.useState(null);       // l'id du sous-écran ouvert (téléphone)
  const racine = React.useRef(null);
  const ouvrirSous = (id) => { setSous(id); try { racine.current && racine.current.scrollIntoView({ block: 'start' }); } catch (_) {} };
  const fermerSous = () => { const id = sous; setSous(null); setTimeout(() => { try { const l = racine.current && racine.current.querySelector(`[data-sous-ouvrir="${id}"]`); if (l) l.scrollIntoView({ block: 'center' }); } catch (_) {} }, 0); };
  const setVue = (v) => { setVueBrute(v); setSous(null); try { localStorage.setItem('vrm_reglages_vue', v); } catch (_) {} };
  React.useEffect(() => { if (!etroit) setSous(null); }, [etroit]);

  // ── Les valeurs dites à droite des lignes : lues dans LEUR réglage, jamais
  //    recalculées (§11). Relues à chaque rendu (fermer un sous-écran en est un).
  const valNumeros = (() => { const p = prefixeNumeros(); return p ? `Série ${p}` : 'Chiffres'; })();
  const valZoom = (() => { const z = readZoom(); const t = etroit && Number(z) < 1 ? '1' : z; return (ZOOMS.find(([v]) => v === t) || [, 'Normal'])[1]; })();
  const derniereSauvegarde = (() => { const t = Number(load('vinted_last_backup', 0)) || 0; const days = t ? Math.floor((Date.now() - t) / 86400000) : null; return { t, days, old: days === null || days >= 30 }; })();
  const tokWidget = load('vrm_widget_token', '');
  const urlWidget = tokWidget ? `https://vrm.center/api/widget?k=${tokWidget}` : '';

  // ── Les morceaux de rendu (des FONCTIONS appelées, pas des composants : un
  //    composant défini ici serait recréé à chaque rendu, et ce qu'il contient
  //    — un panneau en cours de saisie — remonterait à neuf).
  const chevron = <svg className="vrm-set-chev" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 6 6-6 6"/></svg>;
  const ligne = (it) => {
    if (it.type === 'el') return <React.Fragment key={it.id}>{it.el}</React.Fragment>;
    const ouvre = it.type === 'panneau';
    const corps = (<>
      {it.ic && <IconeReglage name={it.ic}/>}
      <span className="vrm-set-lib">
        <b style={{color: it.danger ? C.danger : C.text}}>{it.lib}</b>
        {it.desc && <small style={{color:C.muted}}>{it.desc}</small>}
      </span>
      {it.val != null && it.val !== '' && <span className="vrm-set-val" style={{color:C.muted}}>{it.val}</span>}
      {it.type === 'switch' && <Interrupteur on={it.on} label={it.lib} onClick={it.onClick} {...(it.data || {})}/>}
      {(ouvre || it.type === 'nav') && chevron}
    </>);
    if (it.type === 'switch') return <div key={it.id} className="vrm-set-ligne">{corps}</div>;
    return (
      <button key={it.id} type="button" className="vrm-set-ligne"
        onClick={ouvre ? () => ouvrirSous(it.id) : it.onClick}
        {...(ouvre ? { 'data-sous-ouvrir': it.id, 'aria-haspopup': 'true' } : {})} {...(it.data || {})}>
        {corps}
      </button>
    );
  };
  const contenuPanneau = (it, avecTete) => it.nu
    ? (<div className="vrm-set-carte" style={{background:C.card,border:`1px solid ${C.border}`}}>
        {avecTete && <div className="vrm-set-carte-tete"><IconeReglage name={it.ic}/><b style={{color:C.text}}>{it.lib}</b></div>}
        {it.el}
      </div>)
    : <div className="vrm-set-panneau">{it.el}</div>;
  const liste = (items) => items.length ? (
    <div className="vrm-set-liste" style={{background:C.card,border:`1px solid ${C.border}`}}>{items.map(ligne)}</div>
  ) : null;
  const groupe = (g) => {
    if (!g || !g.items.some(Boolean)) return null;
    const items = g.items.filter(Boolean);
    // Téléphone : tout en lignes. Ordinateur : les lignes, puis les panneaux dépliés.
    // Un groupe « brut » (l'onglet Abonnement) se rend tel quel, sans liste.
    let corps;
    if (g.brut) corps = items.map((it) => <React.Fragment key={it.id}>{it.el}</React.Fragment>);
    else if (etroit) corps = liste(items);
    else {
      const blocs = []; let courant = [];
      items.forEach((it) => {
        if (it.type === 'panneau') { if (courant.length) { blocs.push(liste(courant)); courant = []; } blocs.push(<React.Fragment key={it.id}>{contenuPanneau(it, true)}</React.Fragment>); }
        else courant.push(it);
      });
      if (courant.length) blocs.push(liste(courant));
      corps = blocs.map((b, i) => <React.Fragment key={i}>{b}</React.Fragment>);
    }
    return (
      <section key={g.id} id={`reglages-${g.id}`} className="vrm-set-groupe" data-groupe-reglages={g.id}>
        {g.titre && <h3 className="vrm-set-titre" style={{color:C.muted}}>{g.titre}</h3>}
        {corps}
        {g.pied && <div className="vrm-set-pied" style={{color:C.muted}}>{g.pied}</div>}
      </section>
    );
  };

  // ── MOYENS DE CONNEXION — l'état RÉEL de chacun, pas une liste décorative.
  //    Un bouton Google qui mène à une page d'erreur ne rend service à
  //    personne : tant que le fournisseur n'est pas branché dans Supabase, on
  //    le dit.
  const moyensConnexion = (
    <div>
      <div className="vrm-set-liste" style={{background:C.card,border:`1px solid ${C.border}`}}>
        <div className="vrm-set-ligne">
          <IconeReglage name="mail"/>
          <span className="vrm-set-lib"><b style={{color:C.text}}>Email et mot de passe</b></span>
          <span className="vrm-set-val" style={{color:C.muted}}>Actif</span>
        </div>
        {OAUTH_PROVIDERS.map(pr => {
          const on = providerEnabled(pr.id);
          return (
            <div key={pr.id} className="vrm-set-ligne">
              <span className="vrm-set-ic" aria-hidden="true" style={{background:`${C.text}0d`}}><BrandMark id={pr.id}/></span>
              <span className="vrm-set-lib"><b style={{color:C.text}}>{pr.label}</b></span>
              {on
                ? (AUTH.user
                    ? <span className="vrm-set-val" style={{color:C.muted}}>Disponible</span>
                    : <button type="button" onClick={()=>oauthStart(pr.id)} style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'0 14px',minHeight:36,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Utiliser</button>)
                : <span className="vrm-set-val" style={{color:C.muted}}>Pas activé</span>}
            </div>
          );
        })}
      </div>
      <div className="vrm-set-pied" style={{color:C.muted}}>
        Google et Discord apparaîtront ici dès que leurs clés seront collées dans Supabase. Tant que ce n'est pas fait, on ne les propose pas : un bouton qui mène à une page d'erreur ne sert à rien.
      </div>
    </div>
  );

  // ── TES DONNÉES ET LES CONDITIONS
  const donnees = (
    <div style={{fontSize:13,color:C.muted,lineHeight:1.55}}>
      Tu peux <b style={{color:C.text}}>exporter tes données</b> avec « Sauvegarde complète » {ongletsCompte ? '(onglet Réglages)' : 'ci-dessous'}{AUTH.user ? <>, et <b style={{color:C.text}}>fermer ton compte</b> avec « Fermer mon compte »</> : null}. Pour tes autres droits (accès, rectification), voir la <a href="/legal/confidentialite.html" target="_blank" rel="noopener" style={{color:C.accent}}>politique de confidentialité</a>.
      <LigneContact/>
      <div style={{display:'flex',flexWrap:'wrap',gap:'4px 16px',marginTop:10}}>
        {DOCS_LEGAUX.map(([h,t]) => <a key={h} href={h} target="_blank" rel="noopener" style={{color:C.accent,fontWeight:500,textDecoration:'none',minHeight:44,minWidth:44,display:'inline-flex',alignItems:'center'}}>{t}</a>)}
      </div>
    </div>
  );

  // Boutons communs au widget et à l'installation de l'application.
  const bouton = (primaire) => ({border: primaire ? 'none' : `1px solid ${C.border}`, background: primaire ? C.accent : 'transparent', color: primaire ? (C.onAccent || '#fff') : C.text,
    borderRadius:10, padding:'0 16px', minHeight:44, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit'});
  // ── WIDGET IPHONE — l'adresse contient ta clé personnelle. Avant, cette
  //    adresse était publique : n'importe qui pouvait lire ton chiffre
  //    d'affaires en la connaissant. Recopie la nouvelle dans Scriptable.
  const widget = urlWidget ? (
    <div>
      <div style={{fontSize:12.5,color:C.muted,marginBottom:10,lineHeight:1.45}}>
        Elle contient <b>ta clé</b> : ne la partage pas. Colle-la dans Scriptable à la place de l'ancienne — l'ancienne, sans clé, ne répond plus.
      </div>
      <div style={{fontSize:11.5,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',color:C.text,background:C.bg,
        border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',wordBreak:'break-all',lineHeight:1.5,marginBottom:12}}>{urlWidget}</div>
      <button type="button" onClick={()=>{ try{navigator.clipboard.writeText(urlWidget); toast('✓ Adresse copiée');}catch(_){ toast('Copie impossible','error'); } }} style={bouton(true)}>
        Copier l'adresse
      </button>
    </div>
  ) : null;

  // ── LES GROUPES ────────────────────────────────────────────────────────────
  // Réglages de l'APP.
  const GROUPES_REGLAGES = [
    { id:'comptes', titre:'Comptes Vinted', items:[
      { id:'liens', type:'nav', ic:'link', lib:'Comptes liés', onClick:()=>setTab('vintedaccounts') },
      { id:'connexions', type:'panneau', ic:'sync', lib:'État des connexions', titreInterne:true, el:<ConnexionsSetting/> },
      { id:'adresses', type:'panneau', ic:'mail', lib:'Adresses de réception', titreInterne:true, el:<EmailsSetting/> },
      { id:'securite', type:'panneau', ic:'key', lib:'Sécurité des données', el:<SecuriteSetting/> },
    ]},
    MULTI_USER && { id:'stock', titre:'Stock et photos', items:[
      { id:'numeros', type:'panneau', nu:true, ic:'tag', lib:'Numéros de rangement', val:valNumeros, el:<NumerosSetting nu/> },
      // ⛔ Réponse automatique aux messages Vinted retirée (16 oct., sa décision).
      // ⛔ Détourage des photos retiré des Paramètres (17 oct., sa décision) :
      //    il n'existe plus que pour Vestiaire Collective, qui l'exige, sans réglage.
    ]},
    { id:'notifications', titre:'Notifications', items:[
      { id:'push', type:'panneau', ic:'bell2', lib:'Notifications du téléphone', titreInterne:true,
        desc: nMuetsPush > 0 ? <span style={{color:C.warn,fontWeight:600}}>{nMuetsPush} compte{nMuetsPush>1?'s':''} sans email : pas de notification</span> : null,
        el:<><PushSetting/><div style={{height:12}}/><PushPrefsSetting comptes={comptes} onMuets={setNMuetsPush}/></> },
      // Alertes locales (l'ancien bouton 🔔 du haut) : bandeau + notification
      // quand l'app est OUVERTE (ventes comptabilisées, factures reçues).
      { id:'alertes', type:'switch', ic:'info', lib:"Alertes dans l'app", desc:'Ventes et factures, quand l’app est ouverte.', on:!!notifEnabled, onClick:onToggleNotif, data:{ 'data-reglage-alertes': notifEnabled ? 'on' : 'off' } },
    ]},
    { id:'impression', titre:'Impression', items:[
      { id:'imprimante', type:'panneau', nu:true, ic:'printer', lib:'Imprimante et bordereaux', val: imprimanteChoisie() === 'thermique' ? 'Thermique · 10×15' : 'Normale · A4', el:<ImprimanteSetting nu/> },
    ]},
    { id:'compta', titre:'Comptabilité', items:[
      { id:'regime', type:'panneau', nu:true, ic:'receipt', lib:'Régime fiscal', el:<RegimeSetting nu/> },
      { id:'import', type:'panneau', nu:true, ic:'calendar', lib:'Import des emails Vinted', el:<EmailStartSetting nu/> },
      // Julien, 1er oct. : « les ventes masquées, je veux que ce soit dans les
      // paramètres, pas sous Factures ». L'écran reste monté, joignable ici.
      { id:'masques', type:'nav', ic:'eyeOff', lib:'Ventes et achats masqués', onClick:()=>setTab('masques') },
      { id:'prixachat', type:'nav', ic:'cash', lib:"Compléter les prix d'achat", onClick:()=>{DEMANDE_SAISIE_PRIX.on=true;setTab('vinted_annonces');} },
      { id:'tampons', type:'action', ic:'doc', lib:'Position du N° tamponné', val:'Réinitialiser', onClick:async ()=>{ if(await askConfirm('Oublier les emplacements de tampon mémorisés ? L\'app te redemandera où placer le N° au prochain bordereau de chaque format.')){ save('vinted_bordereau_formats',{}); toast('✓ Emplacements réinitialisés.'); } } },
    ]},
    { id:'affichage', titre:'Affichage', items:[
      { id:'sombre', type:'switch', ic:'moon', lib:'Mode sombre', on:!!dark, onClick:toggleDark, data:{ 'data-reglage-sombre': dark ? 'on' : 'off' } },
      { id:'stream', type:'el', el:<StreamSetting key="stream"/> },
      { id:'benefjournee', type:'el', el:<BeneficeJourneeSetting key="benefjournee"/> },
      { id:'zoom', type:'panneau', nu:true, ic:'grid', lib:"Taille de l'affichage", val:valZoom, el:<ZoomSetting nu/> },
      urlWidget && { id:'widget', type:'panneau', nu:true, ic:'chart', lib:'Widget iPhone', el:widget },
    ]},
    { id:'sauvegarde', titre:'Sauvegarde', items:[
      { id:'export', type:'action', ic:'save', lib:'Sauvegarde complète', desc:'Réglages, numéros et données captées.', onClick:onExport, data:{ 'data-reglage-sauvegarde':'' } },
      { id:'restaurer', type:'action', ic:'restore', lib:'Restaurer une sauvegarde', onClick:onImport },
    ], pied: (
      <span data-derniere-sauvegarde={derniereSauvegarde.old ? 'ancienne' : 'recente'} style={{color: derniereSauvegarde.old ? C.warn : C.muted, fontWeight: derniereSauvegarde.old ? 600 : 400}}>
        {derniereSauvegarde.t ? `Dernière sauvegarde : ${derniereSauvegarde.days===0?"aujourd'hui":derniereSauvegarde.days===1?'hier':`il y a ${derniereSauvegarde.days} j`}${derniereSauvegarde.old?' — pense à en refaire une.':'.'}` : 'Jamais sauvegardé — fais-en une pour protéger tes données.'}
        {' '}<span style={{color:C.muted,fontWeight:400}}>Sans les PDF de bordereau ni tes connexions Vinted.</span>
      </span>
    )},
  ];
  // « Mon compte » : la PERSONNE.
  const GROUPES_COMPTE = MULTI_USER ? [
    { id:'profil', titre:null, items:[
      { id:'prenom', type:'el', el:<PrenomSetting key="prenom"/> },
    ], pied:'Ton prénom sert seulement à te dire bonjour sur l’accueil. Vide, l’app dit « Bonjour ».' },
    // Discord relié au COMPTE (20 oct.), sans être sur la carte de la communauté.
    AUTH.user && { id:'discord', titre:'Discord', items:[
      { id:'discord', type:'el', el:<DiscordCompte key="discord"/> },
    ], pied:'Facultatif. VRM ne lit que ton pseudo Discord (jamais ton email, tes serveurs ni tes messages). Il est proposé quand tu apparais sur la carte de la communauté.' },
    AUTH.user && { id:'equipe', titre:'Équipe', items:[
      { id:'equipe', type:'panneau', ic:'link', lib:'Équipe', el:<EquipeSetting/> },
    ]},
    // (17 oct.) L'abonnement a SON onglet (« Abonnement ») ; ici, un renvoi.
    AUTH.user && { id:'abonnement', titre:'Abonnement', items:[
      { id:'abonnement-lien', type:'nav', ic:'wallet', lib:'Abonnement et factures', desc:'Statut, prix, carte, factures, résiliation', onClick:()=>setVue('abonnement') },
    ]},
    { id:'connexion', titre:'Connexion', items:[
      { id:'moyens', type:'panneau', ic:'link', lib:'Moyens de connexion', el:moyensConnexion },
      AUTH.user && { id:'email', type:'nav', ic:'mail', lib:'Changer mon email', onClick:()=>{ setAcct({ mode:'email', val:'', err:'', busy:false }); } },
      AUTH.user && { id:'motdepasse', type:'nav', ic:'key', lib:'Changer mon mot de passe', onClick:()=>{ setAcct({ mode:'pw', val:'', err:'', busy:false }); } },
      // Double vérification (TOTP) — facultative, sur SON clic (16 octobre).
      AUTH.user && { id:'double', type:'panneau', nu:true, ic:'key', lib:'Double vérification', val: Array.isArray(AUTH.session && AUTH.session.totp) ? (AUTH.session.totp.length ? 'Activée' : 'Désactivée') : '', el:<DoubleVerification/> },
    ]},
    AUTH.user && { id:'sortir', titre:null, items:[
      { id:'deconnexion', type:'action', ic:'door', lib:'Se déconnecter', danger:true, onClick:()=>{ setAcct({ mode:'out', val:'', err:'', busy:false }); } },
    ], pied:'Efface aussi les données de ce navigateur — elles restent dans ton compte.' },
    { id:'donnees', titre:'Tes données', items:[
      { id:'conditions', type:'panneau', nu:true, ic:'doc', lib:'Données et conditions', el:donnees },
      AUTH.user && { id:'fermer', type:'panneau', ic:'trash', lib:'Fermer mon compte', el:<FermerCompte/> },
    ]},
  ] : [
    { id:'donnees', titre:'Tes données', items:[
      { id:'conditions', type:'panneau', nu:true, ic:'doc', lib:'Données et conditions', el:donnees },
    ]},
  ];
  // L'onglet Abonnement : la carte de l'abonnement, d'un bloc (statut, prix,
  // carte, factures, résilier) — le MÊME composant qu'avant (§11).
  const GROUPES_ABONNEMENT = [{ id:'abonnement', titre:null, brut:true, items:[{ id:'abonnement', type:'el', el:<div key="abonnement" data-onglet-abonnement=""><MonAbonnement/></div> }] }];
  const groupes = [...(voirCompte ? GROUPES_COMPTE : []), ...(voirReglages ? GROUPES_REGLAGES : []), ...(voirAbonnement ? GROUPES_ABONNEMENT : [])].filter(Boolean)
    .map((g) => ({ ...g, items: g.items.filter(Boolean) }));
  const panneaux = groupes.flatMap((g) => g.items.filter((it) => it.type === 'panneau'));
  const ouvert = etroit && sous ? panneaux.find((it) => it.id === sous) : null;
  const titreRetour = !ongletsCompte ? 'Paramètres' : vue === 'compte' ? 'Mon compte' : vue === 'abonnement' ? 'Abonnement' : 'Réglages';

  // ── TON COMPTE VRM ──────────────────────────────────────────────────────
  // Toujours présent en multi-vendeurs, y compris quand on est entré par la
  // porte de secours : sans ça, une fois passé par « Entrer sans compte » il
  // n'y avait AUCUN moyen de revenir à l'écran de connexion.
  const profil = MULTI_USER && voirCompte && (AUTH.user ? (
    <div className="vrm-set-profil" data-profil-compte="" style={{background:C.card,border:`1px solid ${C.border}`}}>
      <span className="vrm-set-avatar" aria-hidden="true" style={{background:`${C.text}0f`,color:C.text}}>
        {String(AUTH.user.email||'?').slice(0,1).toUpperCase()}
      </span>
      <span>
        <span style={{display:'block',fontSize:16,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-.01em'}}>{AUTH.user.email}</span>
        <span style={{display:'block',fontSize:12.5,color:C.muted,marginTop:3}}>
          {CLOISONNE ? 'Tes données ne sont visibles que par toi.' : 'Connecté — séparation des comptes pas encore activée.'}
        </span>
      </span>
    </div>
  ) : (
    <div className="vrm-set-carte" style={{border:`1px solid ${C.warn}55`,background:`${C.warn}0d`,marginBottom:32}}>
      <div style={{fontSize:16,fontWeight:600,color:C.text}}>Tu n'es pas connecté</div>
      <div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.5}}>
        Tu es entré par l'accès temporaire. Tes données sont bien là, mais elles ne sont rattachées à aucun compte.
      </div>
      <button type="button"
        className="vrm-set-connect" onClick={()=>{ try{ localStorage.removeItem('vrm_acces_direct'); }catch(_){} location.reload(); }}
        style={{...bouton(true),marginTop:12}}>
        Aller à l'écran de connexion
      </button>
    </div>
  ));

  return (
    <div ref={racine} className="vrm-set" data-reglages-disposition={etroit ? 'telephone' : 'ordinateur'} data-sous-ecran-ouvert={ouvert ? ouvert.id : ''}
      style={{'--vrm-set-filet': C.border, '--vrm-set-appui': `${C.text}0a`}}>
      <AcctSheet/>
      {ouvert ? (
        // ── SOUS-ÉCRAN (téléphone) ──
        <div className="vrm-set-nav">
          <button type="button" className="vrm-set-retour" onClick={fermerSous} data-sous-retour="" style={{color:C.accent}}>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>
            {titreRetour}
          </button>
        </div>
      ) : (<>
        <div className="vrm-set-tete"><h2 className="vrm-set-h1" style={{color:C.text}}>Paramètres</h2></div>
        <ReglagesPasLus/>
        {ongletsCompte && (
          <div role="tablist" aria-label="Paramètres" data-onglets-reglages="" className="vrm-set-seg" style={{background:`${C.text}0f`}}>
            {[['reglages','Réglages'],['compte','Mon compte'],...(AUTH.user?[['abonnement','Abonnement']]:[])].map(([k,l]) => (
              <button key={k} type="button" role="tab" aria-selected={vue===k} data-vue={k} onClick={()=>setVue(k)}
                style={{background:vue===k?C.card:'transparent',color:vue===k?C.text:C.muted,boxShadow:vue===k?'0 1px 2px rgba(0,0,0,.08), 0 1px 1px rgba(0,0,0,.04)':'none'}}>
                {l}
              </button>
            ))}
          </div>
        )}
      </>)}

      {ouvert && <h2 className="vrm-set-sous-h" style={{color:C.text}}>{ouvert.lib}</h2>}

      {etroit ? (<>
        {!ouvert && profil}
        {!ouvert && groupes.map(groupe)}
        {/* Les panneaux, tous montés ; seul celui du sous-écran se voit. */}
        {panneaux.map((it) => (
          // Le titre du sous-écran dit déjà celui de la carte : celle-ci le tait
          // (CSS seulement — le texte reste dans la page, les bancs le lisent).
          <div key={it.id} hidden={!ouvert || ouvert.id !== it.id} data-sous-ecran={it.id} className={it.titreInterne ? 'vrm-set-sans-titre' : undefined}>
            {contenuPanneau(it, false)}
          </div>
        ))}
      </>) : (
        <div className="vrm-set-cols">
          <nav className="vrm-set-sommaire" aria-label="Sommaire des paramètres">
            {groupes.filter((g) => g.titre).map((g) => (
              <a key={g.id} href={`#reglages-${g.id}`} style={{color:C.muted}}
                onClick={(e)=>{ e.preventDefault(); try { document.getElementById(`reglages-${g.id}`).scrollIntoView({ behavior:'smooth', block:'start' }); } catch (_) {} }}>
                {g.titre}
              </a>
            ))}
          </nav>
          <div className="vrm-set-corps">
            {profil}
            {groupes.map(groupe)}
          </div>
        </div>
      )}
    </div>
  );
}
function DoubleVerification() {
  const [f, setF] = React.useState(undefined);
  const [essai, setEssai] = React.useState(0);
  // { etape: 'qr', id, qr, secret } · { etape: 'off' } (confirmation de désactivation)
  const [cours, setCours] = React.useState(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);   // { t, ton: 'ok'|'err'|'passu' }
  React.useEffect(() => {
    let mort = false; setF(undefined);
    mfaLireFacteurs().then((x) => { if (!mort) setF(x); });
    return () => { mort = true; };
  }, [essai]);
  const actif = f && f.verifies.length ? f.verifies[0] : null;
  const relire = () => setEssai((n) => n + 1);
  const btn = (primaire, off) => ({ border: primaire ? 'none' : `1px solid ${C.border}`, background: primaire ? C.accent : 'transparent', color: primaire ? (C.onAccent || '#fff') : C.text,
    borderRadius:10, padding:'0 16px', minHeight:44, fontSize:14, fontWeight:600, cursor: off ? 'default' : 'pointer', opacity: off ? 0.55 : 1, fontFamily:'inherit' });
  const champ = { width:150, boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:18, letterSpacing:4, textAlign:'center', background:C.bg, color:C.text, outline:'none', fontFamily:'inherit', fontVariantNumeric:'tabular-nums' };
  const txt = { fontSize:12.5, color:C.muted, lineHeight:1.55 };
  const PASSU = "Le service de connexion ne répond pas — rien n'a changé. Réessaie dans un instant.";

  const activer = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    // Un essai d'activation laissé en plan (facteur non vérifié) bloquerait le
    // suivant : on le retire d'abord (un facteur non vérifié ne protège rien).
    for (const x of (f && f.enAttente) || []) { await mfaAppel('DELETE', `factors/${encodeURIComponent(x.id)}`); }
    const r = await mfaAppel('POST', 'factors', { factor_type: 'totp', friendly_name: 'VRM ' + new Date().toISOString().slice(0, 16), issuer: 'VRM' });
    setBusy(false);
    const t = r.json && r.json.totp;
    if (!r.ok || !r.json.id || !t) {
      if (mfaInjoignable(r)) setMsg({ t: PASSU, ton: 'passu' });
      else setMsg({ t: (r.json && (r.json.msg || r.json.message)) ? `Le service de connexion a refusé : « ${r.json.msg || r.json.message} ». Rien n'est activé.` : `Le service de connexion a refusé (erreur ${r.status}). Rien n'est activé.`, ton: 'err' });
      return;
    }
    setCode(''); setCours({ etape: 'qr', id: String(r.json.id), qr: qrEnSrc(t.qr_code), secret: String(t.secret || '') });
  };
  const annulerActivation = async () => {
    const id = cours && cours.id; setCours(null); setCode(''); setMsg(null);
    if (id) await mfaAppel('DELETE', `factors/${encodeURIComponent(id)}`);
    relire();
  };
  const confirmerActivation = async () => {
    if (busy || !cours) return;
    setBusy(true); setMsg(null);
    const r = await mfaVerifierCode(cours.id, code);
    setBusy(false);
    if (r.passu) { setMsg({ t: "Je n'ai pas pu vérifier ce code : le service de connexion ne répond pas. Rien n'est activé pour l'instant — réessaie.", ton: 'passu' }); return; }
    if (!r.ok) { setMsg({ t: (r.message || 'Code refusé.') + ' Rien n’est activé.', ton: 'err' }); setCode(''); return; }
    setCours(null); setCode('');
    setMsg({ t: 'Double vérification activée. À ta prochaine connexion, VRM te demandera le code de ton app après ton mot de passe.', ton: 'ok' });
    relire();
  };
  const desactiver = async () => {
    if (busy || !actif) return;
    setBusy(true); setMsg(null);
    const v = await mfaVerifierCode(String(actif.id), code);
    if (!v.ok) {
      setBusy(false);
      if (v.passu) setMsg({ t: "Je n'ai pas pu vérifier ce code : le service de connexion ne répond pas. La double vérification reste activée — réessaie.", ton: 'passu' });
      else { setMsg({ t: (v.message || 'Code refusé.') + ' La double vérification reste activée.', ton: 'err' }); setCode(''); }
      return;
    }
    const d = await mfaAppel('DELETE', `factors/${encodeURIComponent(actif.id)}`);
    setBusy(false); setCode('');
    if (d.ok) {
      const cur = AUTH.session;
      if (cur) writeSession({ ...cur, totp: (Array.isArray(cur.totp) ? cur.totp : []).filter((x) => x !== String(actif.id)) });
      setCours(null);
      setMsg({ t: 'Double vérification désactivée. Ton mot de passe suffit de nouveau pour te connecter.', ton: 'ok' });
    } else if (mfaInjoignable(d)) {
      setMsg({ t: "Je ne sais pas si elle a été désactivée : le service de connexion n'a pas répondu. Je relis son état.", ton: 'passu' });
    } else {
      setMsg({ t: `Le service de connexion a refusé la désactivation (erreur ${d.status}). Elle reste activée.`, ton: 'err' });
    }
    relire();
  };

  const bandeau = msg && (
    <div data-mfa-message={msg.ton} style={{fontSize:12.5,lineHeight:1.5,marginTop:10,borderRadius:8,padding:'9px 11px',
      color: msg.ton === 'err' ? C.danger : C.text,
      background: msg.ton === 'passu' ? `${C.warn}12` : msg.ton === 'err' ? `${C.danger}0f` : `${C.text}0a`,
      border: `1px solid ${msg.ton === 'passu' ? C.warn + '44' : msg.ton === 'err' ? C.danger + '33' : C.border}`}}>{msg.t}</div>
  );
  const etatDit = f === undefined ? 'lecture' : f === null ? 'passu' : (actif ? 'active' : 'inactive');
  return (
    <div data-mfa-panneau={etatDit} data-mfa-cours={cours ? cours.etape : ''}>
      {f === undefined && <div style={txt}>Lecture de l'état de la double vérification…</div>}
      {f === null && (<>
        <div style={txt}>Je n'ai pas pu lire l'état de ta double vérification : le service de connexion ne répond pas. Rien n'a changé.</div>
        <button type="button" data-mfa-relire="" onClick={relire} style={{...btn(false),marginTop:10}}>Réessayer</button>
      </>)}
      {f && !actif && !cours && (<>
        <div style={txt}>
          <b style={{color:C.text}}>Désactivée.</b> Facultatif : une fois activée, VRM te demande, après ton mot de passe, un code à 6 chiffres affiché par une app d'authentification sur ton téléphone (Google Authenticator, Microsoft Authenticator, Authy, ou les mots de passe de l'iPhone). Quelqu'un qui connaîtrait ton mot de passe ne pourrait pas entrer sans ton téléphone.
        </div>
        <button type="button" data-mfa-activer="" disabled={busy} onClick={activer} style={{...btn(true, busy),marginTop:10}}>{busy ? 'Préparation…' : 'Activer'}</button>
      </>)}
      {cours && cours.etape === 'qr' && (<>
        <div style={txt}><b style={{color:C.text}}>1.</b> Dans ton app d'authentification, ajoute un compte en scannant ce code :</div>
        {cours.qr
          ? <img data-mfa-qr="" src={cours.qr} alt="Code QR à scanner dans ton app d'authentification" width={180} height={180} style={{display:'block',margin:'10px 0',background:'#fff',borderRadius:8,padding:6}}/>
          : <div style={{...txt,margin:'8px 0'}}>(le code QR n'a pas pu s'afficher : utilise la clé ci-dessous)</div>}
        <div style={txt}>Tu es sur ce téléphone et ne peux pas scanner ? Choisis « saisir une clé » dans l'app et recopie :</div>
        <div data-mfa-cle="" style={{fontFamily:'ui-monospace,Menlo,monospace',fontSize:14,color:C.text,margin:'6px 0 12px',wordBreak:'break-all',userSelect:'all'}}>{cours.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
        <div style={txt}><b style={{color:C.text}}>2.</b> Tape le code à 6 chiffres que l'app affiche pour VRM :</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
          <input data-mfa-code-activer="" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={champ}/>
          <button type="button" data-mfa-confirmer="" disabled={busy || code.length !== 6} onClick={confirmerActivation} style={btn(true, busy || code.length !== 6)}>{busy ? 'Vérification…' : 'Confirmer'}</button>
          <button type="button" data-mfa-annuler="" disabled={busy} onClick={annulerActivation} style={btn(false, busy)}>Annuler</button>
        </div>
      </>)}
      {actif && !cours && (<>
        <div style={txt}>
          <b style={{color:C.text}}>Activée{actif.created_at ? ` depuis le ${new Date(actif.created_at).toLocaleDateString('fr-FR')}` : ''}.</b> À chaque connexion, VRM demande le code de ton app d'authentification après ton mot de passe.
          {' '}Si tu perds ton téléphone, elle ne se retire pas depuis l'app : désactive-la ici AVANT de changer de téléphone.
        </div>
        <button type="button" data-mfa-desactiver="" onClick={() => { setCours({ etape: 'off' }); setCode(''); setMsg(null); }} style={{...btn(false),marginTop:10}}>Désactiver…</button>
      </>)}
      {actif && cours && cours.etape === 'off' && (<>
        <div style={txt}>Pour désactiver la double vérification, tape le code actuel de ton app. Ton mot de passe suffira ensuite pour te connecter.</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
          <input data-mfa-code-desactiver="" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={champ}/>
          <button type="button" data-mfa-confirmer-off="" disabled={busy || code.length !== 6} onClick={desactiver} style={btn(false, busy || code.length !== 6)}>{busy ? 'Vérification…' : 'Désactiver'}</button>
          <button type="button" disabled={busy} onClick={() => { setCours(null); setCode(''); setMsg(null); }} style={btn(false, busy)}>Garder</button>
        </div>
      </>)}
      {bandeau}
    </div>
  );
}

function FermerCompte() {
  const [ouvert, setOuvert] = React.useState(false);
  // `undefined` en cours · `null` pas su · l'objet du serveur (`proprietaire`).
  const [info, setInfo] = React.useState(undefined);
  const [tape, setTape] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const [fin, setFin] = React.useState(null);
  // (9 octobre) Ses RÈGLES D'OFFRE eBay restent posées chez eBay après la
  // fermeture : eBay continuera d'accepter. Compté sur tous ses comptes eBay ;
  // `undefined` en cours · `null` pas su · { oui, peutEtre } (`compterReglesEbay`).
  const [reglesEbayN, setReglesEbayN] = React.useState(undefined);
  React.useEffect(() => {
    if (!ouvert || info !== undefined) return;
    let mort = false;
    lireAbonnement().then((x) => { if (!mort) setInfo(x); });
    compterReglesEbay().then((n) => { if (!mort) setReglesEbayN(n); }).catch(() => { if (!mort) setReglesEbayN(null); });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
  const email = String((AUTH.user && AUTH.user.email) || '');
  const pareil = !!email && tape.trim().toLowerCase() === email.trim().toLowerCase();
  const valider = async () => {
    if (!pareil || occupe) return;
    setOccupe(true);
    const r = await fermerMonCompte(tape.trim());
    setOccupe(false);
    setFin(r);
    // Fermé : on efface aussi ce navigateur, puis retour à l'accueil public.
    if (r.ok) setTimeout(() => { try { authSignOut(); } catch (_) {} location.assign('/'); }, 4000);
  };
  const txt = { fontSize: 12, color: C.muted, lineHeight: 1.55 };
  return (
    <div data-fermer-compte="" style={{ padding: '13px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, marginBottom: 8 }}>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.text }}>Fermer mon compte</span>
          <span style={{ display: 'block', fontSize: 11.5, color: C.muted, marginTop: 2 }}>Efface tes données et ton compte VRM, définitivement.</span>
        </span>
        <span style={{ color: C.muted, fontSize: 13 }}>{ouvert ? '▴' : '▾'}</span>
      </button>
      {ouvert && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          {fin ? (
            <div data-fermer-resultat={fin.ok ? 'ferme' : 'incomplet'} style={{ ...txt, color: C.text }}>
              {fin.message}
              {fin.ok && <div style={{ ...txt, marginTop: 6 }}>Pense à retirer l'extension VRM de Chrome. Retour à l'accueil dans un instant…</div>}
            </div>
          ) : info === undefined ? (
            <div style={txt}>Vérification de ton compte…</div>
          ) : info === null ? (
            <div data-fermer-etat="pas-su" style={txt}>Je n'ai pas pu vérifier ton compte : rien n'est proposé tant que je ne sais pas. Rouvre cet écran dans un instant.</div>
          ) : info.proprietaire ? (
            <div data-fermer-etat="proprietaire" style={txt}>
              <b style={{ color: C.text }}>Tu es le propriétaire de cette installation VRM.</b> Fermer ce compte effacerait toute la boutique : c'est désactivé ici exprès, pour qu'un clic de travers ne puisse pas le faire.
            </div>
          ) : (
            <div data-fermer-etat="possible">
              <div style={txt}>
                Seront effacés : <b style={{ color: C.text }}>tes données VRM</b> (ventes, annonces captées, numéros, compta, réglages), <b style={{ color: C.text }}>tes comptes Vinted liés</b> et <b style={{ color: C.text }}>ton compte de connexion</b>.
                {(info.peutGerer && info.actif) ? ' Ton abonnement est résilié en même temps : aucun nouveau prélèvement ne part.' : ''}
                {' '}C'est <b style={{ color: C.text }}>définitif</b> : pour garder une copie, fais d'abord une « Sauvegarde complète » (onglet Réglages). Ensuite, retire l'extension VRM de Chrome.
              </div>
              {reglesEbayN === null && <div data-fermer-regles-ebay="pas-su" style={{ ...txt, marginTop: 8, color: C.warn }}>{texteReglesQuiRestent(null, 'fermer')}</div>}
              {reglesEbayN && (reglesEbayN.oui > 0 || reglesEbayN.peutEtre > 0) && <div data-fermer-regles-ebay={reglesEbayN.oui + reglesEbayN.peutEtre} data-fermer-regles-ebay-peut-etre={reglesEbayN.peutEtre} style={{ ...txt, marginTop: 8, color: C.warn }}>Après la fermeture, sur eBay : {texteReglesQuiRestent(reglesEbayN, 'fermer')}</div>}
              <label style={{ display: 'block', ...txt, marginTop: 10 }}>
                Pour confirmer, recopie ton adresse : <b style={{ color: C.text }}>{email}</b>
                <input type="email" autoComplete="off" autoCapitalize="none" value={tape} onChange={(e) => setTape(e.target.value)} placeholder={email}
                  data-fermer-confirmation=""
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 12px', fontSize: 15, background: C.bg, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
              </label>
              <button type="button" onClick={valider} disabled={!pareil || occupe} data-fermer-bouton=""
                style={{ marginTop: 10, border: 'none', background: C.danger, color: '#fff', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 600, cursor: (!pareil || occupe) ? 'default' : 'pointer', opacity: (!pareil || occupe) ? 0.45 : 1, fontFamily: 'inherit' }}>
                {occupe ? 'Fermeture en cours…' : 'Fermer définitivement mon compte'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// Le contact de VRM (src/contact.js, une seule source avec la page d'accueil).
function LigneContact() {
  const e = contactEmail();
  return (
    <div data-contact="" style={{ marginTop: 9, fontSize: 12.5 }}>
      Contact : {e
        ? <a href={`mailto:${e}`} style={{ color: C.accent, fontWeight: 500, textDecoration: 'none' }}>{e}</a>
        : <span data-contact-absent="" style={{ color: C.muted }}>{CONTACT_A_VENIR}</span>}
    </div>
  );
}
function MonAbonnement() {
  const [cgv, setCgv] = React.useState(false);
  const [e, setE] = React.useState(undefined);
  const [fx, setFx] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => {
    let mort = false;
    (async () => {
      let x = await lireAbonnement();
      // De retour de Stripe : le webhook peut avoir quelques secondes de retard.
      for (let i = 0; RETOUR_ABONNEMENT === 'merci' && x && !x.actif && i < 8 && !mort; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        x = await lireAbonnement();
      }
      if (mort) return;
      setE(x);
      // Les factures n'existent que pour quelqu'un qui a (eu) un client Stripe.
      if (x && x.configure && !x.proprietaire && x.peutGerer) { const f = await lireFactures(); if (!mort) setFx(f); }
    })();
    return () => { mort = true; };
  }, []);
  const agir = async (mode) => {
    if (mode === 'checkout' && !cgv) { setMsg("Coche « J'accepte les conditions générales de vente » avant de payer."); return; }
    setOccupe(mode); setMsg('');
    const m = await ouvrirStripe(mode, mode === 'checkout' ? { cgv: true } : null);
    if (m) { setMsg(m); setOccupe(''); }
  };
  const resilierOuReprendre = async (reprendre) => {
    if (!reprendre) {
      const fin = e && e.finPeriode ? dateLisible(e.finPeriode) : 'la fin du mois payé';
      const oui = await askConfirm({ title: 'Résilier ton abonnement ?',
        desc: `Tu gardes VRM jusqu'au ${fin}, et aucun autre prélèvement ne partira. Tes données restent intactes. Tu peux changer d'avis jusqu'à cette date.`,
        ok: 'Résilier', cancel: 'Garder mon abonnement', danger: true });
      if (!oui) return;
    }
    setOccupe(reprendre ? 'reprendre' : 'resilier'); setMsg('');
    const r = await choisirResiliation(reprendre);
    setOccupe('');
    if (!r.ok) { setMsg(r.message); return; }
    setE((x) => (x ? { ...x, annuleFinPeriode: r.annuleFinPeriode, finPeriode: r.finPeriode || x.finPeriode } : x));
    toast(r.annuleFinPeriode ? `✓ Abonnement résilié — VRM reste ouvert jusqu'au ${dateLisible(r.finPeriode || e.finPeriode)}` : '✓ Abonnement repris — rien ne change pour toi');
  };
  const carte = { padding: '15px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, marginBottom: 8 };
  const bouton = (plein) => ({ marginTop: 10, border: plein ? 'none' : `1px solid ${C.border}`, background: plein ? C.accent : 'transparent', color: plein ? (C.onAccent || '#fff') : C.text,
    borderRadius: 10, padding: '11px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', maxWidth: 320 });
  const titre = <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Ton abonnement</div>;
  if (e === undefined) return <div style={carte} data-abonnement="chargement">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Je regarde…</div></div>;
  if (e === null) return <div style={carte} data-abonnement="pas-su">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Je n'ai pas pu lire ton abonnement. Rouvre cet écran dans un instant — rien n'a changé de ton côté.</div></div>;
  // ⚠️ LE PRIX CHEZ STRIPE ≠ CELUI DES CGV (11 octobre : 12,99 €, et le prix
  //    rangé chez Stripe sous `vrm_mensuel` est un réglage de SON tableau de
  //    bord). Le serveur refuse alors d'ouvrir le paiement ; c'est au
  //    propriétaire — le seul qui peut le corriger — qu'on le dit, avec le geste.
  //    « Pas su » (Stripe muet : `prixConforme` null) ne dit rien.
  //    ⚠️ Le prix de Stripe s'écrit avec le TEXTE DU SERVEUR (`prixStripe.texte`,
  //    montant + devise + rythme), jamais reformaté ici : `prixLisible` ignore la
  //    devise et le rythme, et faisait dire « 12,99 € / mois n'est pas
  //    12,99 € / mois » pour un prix en dollars ou tous les 3 mois — ou
  //    « 0,00 € » pour un prix sans montant fixe — juste quand il doit voir son
  //    erreur dans Stripe (revue du 11 octobre).
  const prixAcorriger = e.proprietaire && e.prixConforme === false && e.prixStripe;
  const texteStripe = prixAcorriger && typeof e.prixStripe.texte === 'string' && e.prixStripe.texte.trim() ? e.prixStripe.texte : 'un prix différent';
  if (e.proprietaire) return (
    <div style={carte} data-abonnement="proprietaire">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Compte propriétaire de VRM : gratuit, aucun abonnement.</div>
      {prixAcorriger && (
        <div data-prix-stripe="different" style={{ fontSize: 12.5, color: C.text, marginTop: 8, lineHeight: 1.5 }}>
          Le prix réglé chez Stripe (<b data-prix-stripe-texte="">{texteStripe}</b>) n'est pas celui des conditions de vente (<b>{PRIX_CGV_LISIBLE}</b>). Le paiement reste <b>fermé</b> : personne ne peut s'abonner tant que ce n'est pas corrigé. Dans Stripe → Produits, ajoute au produit VRM un prix de {PRIX_CGV_LISIBLE.replace(' / ', ' par ')} avec la clé de recherche « vrm_mensuel » (coche « transférer la clé »).
        </div>
      )}
    </div>
  );
  if (!e.configure) return <div style={carte} data-abonnement="non-branche">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Le paiement n'est pas encore ouvert : VRM reste gratuit pour l'instant.</div></div>;
  const test = e.modeTest ? <div data-mode-test="" style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Paiement en <b style={{ color: C.text }}>mode test</b> : aucune vraie carte n'est débitée (carte d'essai 4242 4242 4242 4242).</div> : null;
  const cb = fx && fx.carte;
  const ligneCarte = cb ? (
    <div data-carte="" style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
      Carte {cb.marque ? cb.marque.charAt(0).toUpperCase() + cb.marque.slice(1) : ''} •••• {cb.fin}{cb.mois && cb.annee ? ` · expire ${String(cb.mois).padStart(2, '0')}/${String(cb.annee).slice(-2)}` : ''}
    </div>
  ) : null;
  const listeFactures = e.peutGerer ? <FacturesAbonnement fx={fx}/> : null;
  const actifs = ['active', 'trialing'];
  if (actifs.includes(e.statut)) {
    const annule = !!e.annuleFinPeriode;
    return (<>
      <div style={carte} data-abonnement="actif" data-resilie={annule ? '' : undefined}>
        {titre}
        {/* ⚠️ Le prix de SON abonnement (`prixAbonnement`, lu sur l'article de
            l'abonnement chez Stripe), jamais celui de l'offre (`prix`) ni celui
            des CGV : un abonnement garde le prix auquel il a été souscrit
            (9,99 € avant le 11 octobre). Pas su ⇒ « Abonné » sans montant. */}
        <div data-prix-abonnement={e.prixAbonnement && e.prixAbonnement.texte ? '' : undefined} style={{ fontSize: 12.5, color: C.text, marginTop: 4, lineHeight: 1.5 }}>Abonné{e.prixAbonnement && typeof e.prixAbonnement.texte === 'string' && e.prixAbonnement.texte.trim() ? ` · ${e.prixAbonnement.texte}` : ''}</div>
        {e.finPeriode && (
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
            {annule ? `Résilié : VRM reste ouvert jusqu'au ${dateLisible(e.finPeriode)}, aucun autre prélèvement.` : `Prochain prélèvement le ${dateLisible(e.finPeriode)}.`}
          </div>
        )}
        {ligneCarte}
        {test}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {annule
            ? <button type="button" disabled={!!occupe} onClick={() => resilierOuReprendre(true)} style={bouton(true)}>{occupe === 'reprendre' ? 'Un instant…' : 'Reprendre mon abonnement'}</button>
            : <>
                <button type="button" disabled={!!occupe} onClick={() => agir('portail')} style={bouton(false)}>{occupe === 'portail' ? 'Ouverture…' : 'Changer de carte'}</button>
                <button type="button" disabled={!!occupe} onClick={() => resilierOuReprendre(false)} style={bouton(false)}>{occupe === 'resilier' ? 'Un instant…' : 'Résilier'}</button>
              </>}
        </div>
        {msg && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>{msg}</div>}
      </div>
      {listeFactures}
    </>);
  }
  if (e.statut === 'past_due' || e.statut === 'unpaid') {
    return (<>
      <div style={{ ...carte, border: `1px solid ${C.warn}55` }} data-abonnement="impaye">
        {titre}
        <div style={{ fontSize: 12.5, color: C.text, marginTop: 4, lineHeight: 1.5 }}>Le dernier prélèvement n'est pas passé. Mets à jour ta carte pour garder VRM : au bout de 14 jours sans paiement, l'app se met en pause et les notifications s'arrêtent (tes données restent intactes).</div>
        {ligneCarte}
        {test}
        <button type="button" disabled={!!occupe} onClick={() => agir('portail')} style={bouton(true)}>{occupe ? 'Ouverture…' : 'Mettre à jour ma carte'}</button>
        {msg && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>{msg}</div>}
      </div>
      {listeFactures}
    </>);
  }
  // Le prix de Stripe n'est pas celui des CGV : le serveur n'ouvrira pas le
  // paiement (api/compte.js) — aucun bouton qui mènerait à un refus.
  // ⚠️ Un ANCIEN abonné garde ses factures (sa compta) : cette branche les rend
  //    comme celle du dessous — elle les perdait (revue du 11 octobre).
  if (e.prixConforme === false) return (<>
    <div style={carte} data-abonnement="non-branche" data-raison="prix">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Le paiement n'est pas encore ouvert : VRM reste gratuit pour l'instant.</div></div>
    {listeFactures}
  </>);
  return (<>
    <div style={carte} data-abonnement="sans">
      {titre}
      <div style={{ fontSize: 12.5, color: C.text, marginTop: 4, lineHeight: 1.5 }}>
        {prixLisible(e.prix)}, sans engagement : prélevé chaque mois à la date où tu t'abonnes, résiliable à tout moment.
        {!e.obligatoire && <span style={{ color: C.muted }}> Pour l'instant VRM reste gratuit pour toi.</span>}
      </div>
      {RETOUR_ABONNEMENT === 'merci' && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Paiement reçu par Stripe — ton abonnement apparaîtra ici dans quelques secondes. Rouvre l'écran si besoin.</div>}
      {test}
      <CaseCgv coche={cgv} onChange={setCgv}/>
      <button type="button" disabled={!!occupe || !cgv} data-sabonner="" onClick={() => agir('checkout')} style={{ ...bouton(true), opacity: cgv ? 1 : 0.5 }}>{occupe ? 'Ouverture…' : "S'abonner"}</button>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Paiement sécurisé par Stripe — VRM ne voit jamais ta carte.</div>
      {msg && <div style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>{msg}</div>}
    </div>
    {/* Un ancien abonné garde l'accès à ses factures passées (sa compta). */}
    {listeFactures}
  </>);
}

// La liste des factures, sous la carte d'abonnement. Une ligne par facture :
// date · montant · statut · le PDF. Rien d'autre (§7).
function FacturesAbonnement({ fx }) {
  const carte = { padding: '13px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, marginBottom: 8 };
  const titre = <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Tes factures</div>;
  if (fx === undefined) return <div style={carte} data-factures="chargement">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Je regarde…</div></div>;
  if (fx === null) return <div style={carte} data-factures="pas-su">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Je n'ai pas pu lire tes factures chez Stripe. Rouvre cet écran dans un instant — elles sont bien gardées.</div></div>;
  if (!fx.factures.length) return <div style={carte} data-factures="vide">{titre}<div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>Aucune facture pour l'instant : la première arrive avec ton premier prélèvement.</div></div>;
  return (
    <div style={carte} data-factures={String(fx.factures.length)}>
      {titre}
      <div style={{ marginTop: 6 }}>
        {fx.factures.map((f, i) => {
          const lien = lienFacture(f.pdf) || lienFacture(f.page);
          const st = STATUT_FACTURE[f.statut] || f.statut;
          return (
            <div key={f.id || i} data-facture="" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, color: C.text, fontWeight: 500 }}>{f.date ? dateLisible(f.date) : '—'}</span>
                <span style={{ display: 'block', fontSize: 11, color: f.statut === 'open' || f.statut === 'uncollectible' ? C.warn : C.muted, marginTop: 1 }}>{st}{f.numero ? ` · n° ${f.numero}` : ''}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{montantLisible(f.montant, f.devise)}</span>
              {lien
                ? <a href={lien} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: C.accent, textDecoration: 'none', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>{lienFacture(f.pdf) ? 'PDF' : 'Voir'}</a>
                : <span style={{ minWidth: 34 }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RÉGLAGES → MON COMPTE → ÉQUIPE ─────────────────────────────────────────
// ── DISCORD RELIÉ AU COMPTE (20 oct.) ────────────────────────────────────────
// Julien : « connecter mon compte Discord à mon compte qui est déjà connecté ».
// Sans être sur la carte : le pseudo VÉRIFIÉ (OAuth, preuve signée) est rangé
// par la route dans `app_data.vrm_discord` (api/_lib/communaute.js). Le retour
// de Discord revient ICI (`?tab=settings&vue=compte`, `ou=compte`).
// Trois états : `undefined` lecture · `null` pas su · `{discord, connexion}`.
function DiscordCompte() {
  const [lu, setLu] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const appel = React.useCallback(async (corps) => {
    try {
      const r = await fetch('/api/compte?mode=communaute', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      return j && typeof j === 'object' ? j : { ok: false };
    } catch (_) { return { ok: false }; }
  }, []);
  const relire = React.useCallback(async () => {
    const j = await appel({ action: 'discord-compte' });
    setLu(j.ok ? { discord: typeof j.discord === 'string' ? j.discord : '', connexion: j.discordConnexion === true } : null);
  }, [appel]);
  React.useEffect(() => {
    (async () => {
      // Le retour de Discord, mis de côté par main.jsx (seulement s'il vient d'ICI).
      let brut = '';
      try { brut = sessionStorage.getItem('vrm_discord_retour') || ''; } catch (_) {}
      const h = new URLSearchParams(brut);
      if (brut && h.get('ou') === 'compte') {
        try { sessionStorage.removeItem('vrm_discord_retour'); } catch (_) {}
        const err = h.get('discord-erreur'), d = h.get('discord'), preuve = h.get('preuve');
        if (err) setMsg(DISCORD_ERREURS[err] || DISCORD_ERREURS.discord);
        else if (d) {
          setOccupe(true);
          const r = await appel({ action: 'discord-compte-verifie', discord: d, preuve });
          setOccupe(false);
          setMsg(r.ok ? `Ton compte Discord « ${r.discord} » est relié à ton compte VRM.` : (r.message || DISCORD_ERREURS.discord));
        }
      }
      relire();
    })();
  }, [appel, relire]);
  const connecter = async () => {
    setOccupe(true); setMsg('');
    try {
      const r = await fetch('/api/compte?mode=discord-debut', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ou: 'compte' }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok && typeof j.url === 'string' && j.url.startsWith('https://discord.com/')) { noterTicketDiscord(j.ticket, 'compte'); window.location.href = j.url; return; }
      setMsg((j && j.message) || DISCORD_ERREURS.discord);
    } catch (_) { setMsg(DISCORD_ERREURS.discord); }
    setOccupe(false);
  };
  const retirer = async () => {
    if (!(await askConfirm({ title: 'Retirer ton Discord ?', desc: 'Il n’est plus relié à ton compte VRM (ni affiché sur la carte, s’il y était).', ok: 'Retirer', cancel: 'Annuler', danger: true }))) return;
    setOccupe(true); setMsg('');
    const r = await appel({ action: 'discord-compte-retirer' });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant."); return; }
    setMsg('Ton Discord est retiré de ton compte.');
    relire();
  };
  const bouton = (plein) => ({ border: plein ? 'none' : `1px solid ${C.border}`, background: plein ? C.accent : 'transparent', color: plein ? (C.onAccent || '#fff') : C.text, borderRadius: 8, padding: '8px 12px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' });
  const note = msg && <div data-discord-compte-msg="" role="status" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.45 }}>{msg}</div>;
  if (lu === undefined) return <div data-discord-compte="chargement" style={{ fontSize: 13, color: C.muted, padding: '4px 0' }}>Lecture de ton Discord…{note}</div>;
  if (lu === null) return (
    <div data-discord-compte="pas-su" style={{ fontSize: 13, color: C.text, lineHeight: 1.5, padding: '4px 0' }}>
      Je n'ai pas pu lire ton Discord — la base n'a pas répondu. <button type="button" onClick={relire} style={{ ...bouton(false), marginLeft: 6 }}>Réessayer</button>{note}
    </div>
  );
  return (
    <div data-discord-compte={lu.discord ? 'relie' : 'aucun'} style={{ fontSize: 14, color: C.text, padding: '4px 0' }}>
      <div style={{ marginBottom: 8 }}>{lu.discord ? <>Discord relié : <b data-discord-compte-pseudo={lu.discord}>{lu.discord}</b></> : 'Aucun compte Discord relié.'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {lu.connexion && <button type="button" data-discord-compte-connecter="" disabled={occupe} onClick={connecter} style={bouton(true)}>{occupe ? 'Un instant…' : lu.discord ? 'Changer avec Discord' : 'Se connecter avec Discord'}</button>}
        {lu.discord && <button type="button" data-discord-compte-retirer="" disabled={occupe} onClick={retirer} style={bouton(false)}>Retirer</button>}
      </div>
      {!lu.connexion && !lu.discord && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{DISCORD_ERREURS['non-configure']}</div>}
      {note}
    </div>
  );
}

function EquipeSetting() {
  const uid = (AUTH.user && AUTH.user.id) || '';
  const [lu, setLu] = React.useState(undefined);
  const [email, setEmail] = React.useState('');
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const relire = React.useCallback(() => { lireEquipe().then(setLu); }, []);
  React.useEffect(() => { relire(); }, [relire]);
  const agir = async (cle, action, extra, ok) => {
    setOccupe(cle); setMsg('');
    const r = await actionEquipe(action, extra);
    setOccupe('');
    if (!r.ok) { setMsg(r.message); return; }
    if (ok) ok(r);
    relire();
    try { window.dispatchEvent(new Event('vrm-equipe')); } catch (_) {}
  };
  const bouton = (plein) => ({ border: plein ? 'none' : `1px solid ${C.border}`, background: plein ? C.accent : 'transparent', color: plein ? (C.onAccent || '#fff') : C.text, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' });
  const ligne = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${C.border}` };
  if (lu === undefined) return <div data-equipe-reglage="chargement" style={{ fontSize: 13, color: C.muted }}>Lecture de ton équipe…</div>;
  if (lu === null) return (
    <div data-equipe-reglage="pas-su" style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
      Je n'ai pas pu lire ton équipe — la base n'a pas répondu. <button type="button" onClick={relire} style={{ ...bouton(false), marginLeft: 6 }}>Réessayer</button>
    </div>
  );
  if (lu.nonInstalle) return <div data-equipe-reglage="non-installe" style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{EQUIPE_NON_INSTALLE_TXT}</div>;
  const vivants = lu.equipe.filter((x) => x.statut !== 'revoquee');
  const inviter = async () => {
    const e = email.trim();
    if (!e) { setMsg("Tape l'adresse email de la personne qui t'aide."); return; }
    await agir('inviter', 'inviter', { email: e }, (r) => { setEmail(''); setMsg(r.deja ? 'Cette personne est déjà invitée.' : ''); });
  };
  return (
    <div data-equipe-reglage="lu" style={{ fontSize: 13, color: C.text }}>
      <div style={{ color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>{CE_QUE_VOIT_UN_MEMBRE}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email de la personne" aria-label="Email à inviter" data-equipe-email=""
          style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14, background: C.bg, color: C.text, outline: 'none', fontFamily: 'inherit' }}/>
        <button type="button" data-equipe-inviter="" disabled={!!occupe} onClick={inviter} style={bouton(true)}>{occupe === 'inviter' ? 'Invitation…' : 'Inviter'}</button>
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>Aucun email n'est envoyé : préviens-la. Elle crée son compte VRM avec cette adresse, la confirme, et l'invitation l'attend à l'ouverture.</div>
      {msg && <div data-equipe-msg="" style={{ color: C.warn, marginTop: 8 }}>{msg}</div>}
      {vivants.length > 0 && <div style={{ marginTop: 12 }}>
        {vivants.map((x) => (
          <div key={x.id} data-equipe-membre={x.statut} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{x.email}</b> <span style={{ color: C.muted }}>· {x.statut === 'actif' ? 'membre' : 'invitée, pas encore acceptée'}</span></span>
            <button type="button" data-equipe-revoquer={x.id} disabled={!!occupe} onClick={async () => { if (await askConfirm({ title: 'Retirer cette personne ?', desc: `${x.email} ne verra plus tes colis, tout de suite.`, ok: 'Retirer', cancel: 'Annuler', danger: true })) agir(x.id, 'revoquer', { id: x.id }); }} style={bouton(false)}>Retirer</button>
          </div>
        ))}
      </div>}
      {(lu.invitations.length > 0 || lu.membreDe.length > 0) && <div style={{ marginTop: 14 }}>
        {lu.invitations.map((inv) => (
          <div key={inv.id} data-invitation={inv.id} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{inv.de || 'Un vendeur'}</b> t'invite à préparer ses colis</span>
            <button type="button" data-accepter={inv.id} disabled={!!occupe} onClick={() => agir(inv.id, 'accepter', { id: inv.id })} style={bouton(true)}>Accepter</button>
          </div>
        ))}
        {lu.membreDe.map((m) => (
          <div key={m.id} data-membre-de={m.vendeur} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>Tu prépares les colis de <b>{m.de || 'un vendeur'}</b>{m.acces === false ? <span style={{ color: C.muted }}> · son abonnement n'est plus actif</span> : null}</span>
            <button type="button" data-ouvrir-equipe={m.vendeur} onClick={() => { if (uid) choisirVueEquipe(uid, m.vendeur); }} style={bouton(true)}>Ouvrir ses colis</button>
            <button type="button" data-quitter={m.id} disabled={!!occupe} onClick={async () => { if (await askConfirm({ title: "Quitter l'équipe ?", desc: `Tu ne verras plus les colis de ${m.de || 'ce vendeur'}.`, ok: 'Quitter', cancel: 'Annuler', danger: true })) agir(m.id, 'quitter', { id: m.id }); }} style={bouton(false)}>Quitter</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

function PrenomSetting() {
  const [v, setV] = React.useState(() => String(load('vrm_prenom', '') || ''));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => {
    // §5.49 : le nuage arrive après le montage. On ne remplace que le vide,
    // sinon une saisie faite pendant le chargement serait écrasée.
    if (touche.current) return;
    setV((p) => p || String(load('vrm_prenom', '') || ''));
  }), []);
  const ecrire = (t) => { touche.current = true; const n = t.slice(0, 24); setV(n); save('vrm_prenom', n.trim()); };
  // Une ligne de réglage (libellé à gauche, champ à droite) ; l'explication
  // vit sous le groupe, dans les Paramètres (§7 : une phrase, une fois).
  return (
    <label className="vrm-set-ligne" data-reglage-prenom="">
      <IconeReglage name="pencil"/>
      <span className="vrm-set-lib"><b style={{color:C.text}}>Prénom</b></span>
      <input className="vrm-set-champ" value={v} onChange={(e)=>ecrire(e.target.value)} placeholder="Facultatif" autoComplete="given-name" aria-label="Ton prénom"
        style={{color:C.text}}/>
    </label>
  );
}

// ── TES NUMÉROS DE RANGEMENT : CHIFFRES OU SÉRIE À LETTRE ──────────────────
// Julien, 2 octobre : « toutes les personnes n'utilisent pas les mêmes numéros :
// des fois elles commencent par B125, C123 ; rends la chose adaptable ».
// Deux façons de numéroter, au choix de chacun : des chiffres (1, 2, 3… —
// défaut, rien ne change pour lui) ou une série à lettre (B1, B2…). Le choix ne
// porte QUE sur les numéros à venir : un numéro déjà donné est écrit sur un
// carton, il ne bouge jamais (§5). Et quelle que soit la série choisie, un N°
// tapé à la main peut toujours être « 125 » ou « C40 ».
function NumerosSetting({ nu = false }) {
  const [p, setP] = React.useState(() => prefixeNumeros());
  const [mode, setMode] = React.useState(() => (prefixeNumeros() ? 'lettre' : 'chiffres'));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => {
    if (touche.current) return;                            // §5.49 : ne remplacer que le vide
    const v = prefixeNumeros(); if (v) { setP(v); setMode('lettre'); }
  }), []);
  // La lettre des ANCIENS numéros (remise à zéro, migration 013) ne peut pas
  // être celle des nouveaux : « B12 » désignerait deux paires. La base le
  // refuse ; l'écran le dit avant, et n'enregistre rien.
  // ⚠️ (relecture du 11 octobre) Cliquer « Avec une lettre » ENREGISTRAIT déjà
  //    une lettre par défaut (« C »), puis taper « B » affichait « rien n'est
  //    enregistré » — il repartait en croyant n'avoir rien changé, et ses paires
  //    republiées partaient en C1, C2… La série ne s'enregistre plus qu'à la
  //    lettre TAPÉE et acceptée, et l'écran dit ce qui est réellement enregistré.
  const arch = archiveNumeros();
  const [refusee, setRefusee] = React.useState('');
  const poser = (v) => {
    touche.current = true;
    const n = String(v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (n && arch && n === arch) { setRefusee(n); setP(prefixeNumeros()); return; }
    setRefusee('');
    setP(n);
    // La copie locale tout de suite (`save` écrit 500 ms plus tard) : les champs
    // N° et la numérotation automatique la lisent dès le prochain rendu.
    try { localStorage.setItem('vrm_num_prefixe', JSON.stringify(n)); } catch (_) {}
    save('vrm_num_prefixe', n);
    try { window.dispatchEvent(new Event('vrm-prefixe')); } catch (_) {}
  };
  const defaut = arch === 'B' ? 'C' : 'B';
  // « Avec une lettre » n'enregistre rien tout seul : la lettre se TAPE.
  const choix = (m) => { setMode(m); setRefusee(''); if (m === 'chiffres') poser(''); };
  const pill = (on) => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : C.card, color: on ? (C.onAccent || '#fff') : C.text, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit' });
  const ex = p && p !== arch ? p : defaut;
  const enregistree = prefixeNumeros();
  // Les exemples ne citent JAMAIS la lettre des anciens numéros (l'app la refuse).
  const lettreEx = arch ? (arch === 'C' ? 'D' : 'C') : 'B';
  const lettreEx2 = ['C', 'D', 'E'].find((x) => x !== arch && x !== lettreEx);
  return (
    <div data-numeros-reglage={mode} style={nu ? {} : {padding:'13px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,marginBottom:8}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text}}>Tes numéros de rangement</div>}
      <div style={{fontSize:12.5,color:C.muted,marginTop:nu?0:3,lineHeight:1.5}}>
        Comment tu écris le numéro de tes paires (étiquette, boîte, sachet…). Ça ne change que les <b>prochains</b> numéros : ceux déjà donnés ne bougent jamais.
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
        <button type="button" onClick={() => choix('chiffres')} style={pill(mode === 'chiffres')}>Chiffres · 1, 2, 3…</button>
        <button type="button" onClick={() => choix('lettre')} style={pill(mode === 'lettre')}>Avec une lettre · {ex}1, {ex}2…</button>
      </div>
      {mode === 'lettre' && (
        <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:12.5,color:C.text}}>
          Lettre(s) de ta série
          <input value={p} onChange={(e) => poser(e.target.value)} placeholder={defaut} autoCapitalize="characters" aria-label="Lettres de la série"
            style={{width:70,padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:14,fontFamily:'inherit',textTransform:'uppercase'}}/>
        </label>
      )}
      {mode === 'lettre' && !refusee && !enregistree && (
        <div data-numeros-lettre-a-taper style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.5}}>
          Tape la lettre de ta série : tant qu'aucune n'est tapée, tes prochains numéros restent en <b>chiffres</b> (1, 2, 3…).
        </div>
      )}
      {mode === 'lettre' && arch && refusee && (
        <div data-numeros-lettre-archive style={{fontSize:12,color:C.text,marginTop:8,lineHeight:1.5}}>
          « {refusee} » est la lettre de tes <b>anciens</b> numéros ({arch}1, {arch}2…) : elle n'est pas enregistrée. Tes prochains numéros restent {enregistree ? <>en <b>{enregistree}</b> ({enregistree}1, {enregistree}2…)</> : <>en <b>chiffres</b> (1, 2, 3…)</>}. Choisis une autre lettre.
        </div>
      )}
      <div style={{fontSize:11.5,color:C.muted,marginTop:8,lineHeight:1.5}}>
        Tu peux toujours taper un numéro à la main, dans n'importe quelle forme : 125, {lettreEx}125, {lettreEx2}40. « {lettreEx.toLowerCase()}125 » et « {lettreEx}125 » sont le même numéro.
        {arch && <> Les anciens numéros (<b>{arch}…</b>) ne se redonnent pas.</>}
      </div>
    </div>
  );
}
// L'interrupteur des Paramètres — UNE forme pour tous (16 octobre : les
// « ON / OFF » en boutons pleins faisaient « page bricolée »). Un vrai
// `role="switch"` : les bancs le cherchent ainsi, et un lecteur d'écran le dit.
function Interrupteur({ on, onClick, label, disabled, ...rest }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={onClick} disabled={disabled}
      className="vrm-switch" style={{'--vrm-sw': on ? C.accent : `${C.text}26`}} {...rest}/>
  );
}
function StreamSetting() {
  const on = useStream();
  return (
    <div className="vrm-set-ligne" data-stream-reglage={on ? 'on' : 'off'}>
      <IconeReglage name="eyeOff"/>
      <span className="vrm-set-lib">
        <b style={{color:C.text}}>Mode stream</b>
        <small style={{color:C.muted}}>Floute pseudos, emails et codes pour filmer ton écran.</small>
      </span>
      <Interrupteur on={on} label="Mode stream" onClick={() => poserStream(!on)}/>
    </div>
  );
}
function ZoomSetting({ nu = false }) {
  const [z, setZ] = React.useState(readZoom);
  const [telephone, setTelephone] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const maj = () => setTelephone(mq.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  const choisir = (v) => { setZ(v); try { localStorage.setItem(ZOOM_KEY, v); } catch (_) {} applyZoom(v); };
  const choix = telephone ? ZOOMS.filter(([v]) => Number(v) >= 1) : ZOOMS;
  const selection = telephone && Number(z) < 1 ? '1' : z;
  return (
    <div style={nu ? {} : {background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'13px 14px',marginBottom:8,boxShadow:C.shadow||'none'}}>
      {!nu && <div style={{fontSize:14,fontWeight:600,color:C.text}}>Taille de l'affichage</div>}
      <div style={{fontSize:12.5,color:C.muted,marginTop:nu?0:3,lineHeight:1.45}}>
        {telephone ? 'Une taille lisible et des boutons faciles à toucher. Réglage propre à cet appareil.' : "Ajuste la taille de l'app. Réglage propre à cet appareil."}
      </div>
      <Segmente label="Taille de l'affichage" plein value={selection} onChange={choisir} style={{marginTop:11}}
        options={choix.map(([v, label]) => ({ v, l: label }))}/>
    </div>
  );
}

// Date de départ de l'import des emails Vinted. Rangée dans Supabase
// (ligne vrm_email_config) : le script Gmail la lit à chaque passage, donc
// changer la date ici prend effet à la synchro suivante, sans toucher au script.
// ⚠️ LE BLOC SE POSE UNE FOIS, EN HAUT (§7). Quatre panneaux qui disent la même
// chose sont quatre alertes pour une cause — et une alerte qu'on lit quatre fois
// est une alerte qu'on cesse de lire. Il NOMME les panneaux touchés : sans ça il
// ne saurait pas lesquels regarder sur un écran qui fait défiler.
function ReglagesPasLus() {
  const [, forcer] = useState(0);
  useEffect(() => {
    const f = () => forcer((n) => n + 1);
    _reglagesEcoute.add(f);
    return () => { _reglagesEcoute.delete(f); };
  }, []);
  const noms = [..._reglagesRates.values()];
  if (!noms.length) return null;
  const liste = noms.length === 1 ? noms[0]
    : noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'11px 13px',marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text}}>
        {noms.length > 1 ? `${noms.length} réglages n'ont pas pu être lus` : "Un réglage n'a pas pu être lu"}
      </div>
      <div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.45}}>
        La base n'a pas répondu pour {liste}. <b>Rien n'est perdu</b>, et rien ne sera
        écrit par-dessus : tant que je n'ai pas lu, je ne touche à rien. Rouvre cet
        écran dans un moment.
      </div>
    </div>
  );
}
function EmailStartSetting({ nu = false }) {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('load'); // load | ok | saving | err | pasLu
  const HEADERS = sbAuth();

  useEffect(() => { (async () => {
    try {
      // ⚠️⚠️ UNE LECTURE RATÉE AFFICHAIT LA DATE DU JOUR. Mesuré le
      //    15 septembre : le vrai réglage est le **10 juillet**. Sur un 522
      //    Cloudflare `res.json()` levait, et le `catch` posait « aujourd'hui »
      //    en annonçant `ok` — l'écran lui disait donc « les emails ne sont pris
      //    en compte qu'à partir du 15 septembre », et il pouvait croire avoir
      //    perdu deux mois. Un mensonge d'affichage sur un écran de RÉGLAGES —
      //    et s'il « corrigeait » le champ, il l'écrivait pour de bon.
      const d = await lireReglage('vrm_email_config');
      if (d === null) { setStatus('pasLu'); return; }   // « pas su » ≠ une date
      setDate(d.startDate || '');
      setStatus('ok');
    } catch (_) { setStatus('pasLu'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })(); }, []);

  const saveDate = async (v) => {
    if (!v || status === 'pasLu') return;   // on n'écrit pas par-dessus ce qu'on n'a pas lu
    setDate(v); setStatus('saving');
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([withOwner({ id: 'vrm_email_config', data: { startDate: v, updatedAt: new Date().toISOString() } })]),
      });
      setStatus('ok');
    } catch (_) { setStatus('err'); }
  };

  return (
    <div style={nu ? {} : {border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Import des emails</div>}
      <div style={{fontSize:12.5,color:C.muted,marginBottom:12,lineHeight:1.45}}>
        Les emails Vinted (ventes, bordereaux, paiements) ne sont pris en compte qu'à partir de cette date. Change-la ici, c'est appliqué à la prochaine synchro (≤ 5 min).
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:500,color:C.text}}>À partir du</span>
        <input type="date" value={date} onChange={e=>saveDate(e.target.value)} disabled={status==='load'||status==='pasLu'}
          style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none',opacity:status==='pasLu'?0.45:1}}/>
        <span style={{fontSize:11,color:status==='err'?C.danger:C.muted}}>
          {status==='load'?'chargement…':status==='saving'?'enregistrement…':status==='err'?'⚠ échec — réessaie':status==='pasLu'?'':'✓ enregistré'}
        </span>
      </div>
      {status==='pasLu' && <div style={{marginTop:9}}><span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span></div>}
    </div>
  );
}

// Notifications push : ventes / bordereaux / argent reçu en temps réel, même
// app fermée. Nécessite l'app installée sur l'écran d'accueil (iPhone) et le
// pipeline email branché (api/email-inbound.js). Un abonnement par appareil.
// La clé vit dans src/vapid.js (une seule source, §11).
function PushSetting() {
  const [state, setState] = useState('checking'); // checking | unsupported | off | on | busy
  const [msg, setMsg] = useState(null);
  const [srv, setSrv] = useState(null);   // ce que le SERVEUR dit de lui-même
  const b64ToU8 = (s) => { const p='='.repeat((4-s.length%4)%4); const b=(s+p).replace(/-/g,'+').replace(/_/g,'/'); const r=atob(b); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))); };

  // ⚠️ LE PIÈGE QUI A COUPÉ SES NOTIFICATIONS (et qui vient de MOI).
  // En sortant la clé privée VAPID du dépôt public (§5.53), la paire a été
  // RÉGÉNÉRÉE — donc la clé PUBLIQUE a changé elle aussi. Or un abonnement push
  // est scellé à la clé publique avec laquelle il a été créé : les abonnements
  // déjà posés sur ses appareils sont devenus inutilisables, le service de push
  // refuse l'envoi, et `getSubscription()` les rend quand même. L'écran
  // affichait donc « activé » pendant que plus rien n'arrivait.
  // ➡️ On COMPARE la clé de l'abonnement à la clé courante et on ré-abonne.
  const memeCle = (sub) => {
    try {
      const a = new Uint8Array(sub.options.applicationServerKey);
      const b = b64ToU8(VAPID_PUBLIC_KEY);
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    } catch (_) { return true; }  // clé illisible : on ne casse rien
  };

  useEffect(() => { (async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') { setState('unsupported'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !memeCle(sub)) {
        // Abonnement périmé : on le remplace tout seul, sans rien demander.
        try {
          await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(()=>{});
          await sub.unsubscribe();
          sub = Notification.permission === 'granted'
            ? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) })
            : null;
          if (sub) setMsg('Abonnement renouvelé sur cet appareil (la clé du serveur avait changé).');
        } catch (_) { sub = null; }
      }
      const on = sub && Notification.permission === 'granted';
      setState(on ? 'on' : 'off');
      // Auto-réparation : si l'appareil se croit abonné, on renvoie son
      // abonnement au serveur (idempotent). Évite le cas « le téléphone est
      // abonné mais le serveur ne le connaît pas ».
      if (on) {
        fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) }).catch(()=>{});
      }
    } catch (_) { setState('off'); }
  })(); }, []);

  // Le serveur peut-il seulement envoyer ? (clé privée présente ou non)
  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/push?etat=1', { headers: enTeteSession() });
      const j = await r.json().catch(() => ({}));
      if (j && typeof j.pret === 'boolean') setSrv(j);
    } catch (_) {}
  })(); }, []);

  const enable = async () => {
    setState('busy'); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('off'); setMsg('Permission refusée. Autorise les notifications dans les réglages du site.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) });
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) });
      // ⚠️ « enregistrement serveur échoué » est du vocabulaire d'informaticien,
      //    et surtout ça ne dit pas quoi faire. La route explique maintenant en
      //    clair pourquoi (la base ne répond pas) et que rien n'est perdu : on
      //    affiche SA phrase quand elle est là.
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error((j && j.message) || "Le serveur n'a pas pu enregistrer cet appareil. Réessaie dans quelques minutes.");
      }
      setState('on'); setMsg('✅ Activé sur cet appareil.');
    } catch (e) { setState('off'); setMsg((e && e.message) || String(e)); }
  };

  const disable = async () => {
    setState('busy'); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(()=>{});
        await sub.unsubscribe();
      }
      setState('off'); setMsg('Notifications coupées sur cet appareil.');
    } catch (_) { setState('off'); }
  };

  const test = async () => {
    setMsg(null);
    try {
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'test' }) });
      const j = await r.json().catch(()=>({}));
      // ⚠️ On affiche la RAISON donnée par le serveur. « Aucun appareil n'a
      // reçu le test » ne dit pas si c'est l'appareil ou la clé du serveur qui
      // manque — et c'est justement la question quand plus rien n'arrive.
      setMsg(j.sent > 0
        ? `✅ Test envoyé à ${j.sent} appareil${j.sent>1?'s':''} — la notif doit apparaître.`
        : j.coupe === 'abonnement'
        ? "Ton abonnement VRM n'est plus actif : les notifications sont en pause. Elles reviennent toutes seules dès que tu le reprends (Réglages → Ton abonnement)."
        : (j.erreur === 'VAPID_PRIVATE_KEY absente'
            ? '⚠ Le serveur ne peut RIEN envoyer : la clé VAPID_PRIVATE_KEY n\'est pas configurée sur Vercel. Tant qu\'elle manque, aucune notification ne partira.'
            : (j.total === 0 ? '⚠ Aucun appareil abonné. Active les notifications sur cet appareil d\'abord.'
            // ⚠️ Un abonnement scellé sur une ANCIENNE clé publique est mort pour
            // toujours (mesuré : 403 côté Chrome, VapidPkHashMismatch côté Apple).
            // Le serveur vient de le purger ; il faut rouvrir l'app sur chaque
            // appareil pour qu'il se réabonne sur la clé courante. Sans ce
            // message, on lisait « 2 abonnés, 0 joint » sans savoir quoi faire.
               : j.perimes ? `⚠ ${j.perimes} appareil(s) étai(en)t abonné(s) avec une ancienne clé — ils viennent d\'être retirés. Rouvre l\'app sur chaque appareil : il se réabonnera tout seul, puis refais ce test.`
                             : `⚠ ${j.total} appareil(s) abonné(s), 0 joint. Réactive les notifications sur cet appareil.`)));
    } catch (e) { setMsg('Erreur test : ' + (e?.message || e)); }
  };

  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Notifications téléphone</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.4}}>
        Vente, bordereau, argent reçu : notifié en temps réel, même app fermée.
        {state==='unsupported' && ' — Non disponible ici : installe d\'abord l\'app sur ton écran d\'accueil (Partager → Sur l\'écran d\'accueil) puis ouvre-la depuis l\'icône.'}
      </div>
      {/* ⚠️ « Je ne reçois plus rien » a DEUX causes qui font le même silence :
          aucun appareil abonné, ou le serveur sans sa clé. On les sépare ici,
          au lieu de laisser deviner. */}
      {srv && !srv.pret && (
        <div style={{display:'flex',gap:8,alignItems:'flex-start',padding:'9px 11px',borderRadius:8,border:`1px solid ${C.danger}55`,background:`${C.danger}12`,marginBottom:10}}>
          <Icon name="alert" size={16} style={{color:C.danger,flexShrink:0,marginTop:1}}/>
          <div style={{fontSize:11.5,color:C.text,lineHeight:1.45,minWidth:0}}>
            <b style={{color:C.danger}}>Le serveur ne peut envoyer aucune notification.</b> Tant que c'est le cas, activer les notifications ici ne changera rien : l'interrupteur serait un mensonge.
            {/* ⚠️ UNE ALERTE QUI NE DIT PAS QUOI FAIRE NE SERT À RIEN. Julien n'est
                pas développeur : la marche à suivre doit être exacte, dans l'ordre,
                avec le nom du réglage à taper. */}
            <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${C.danger}33`}}>
              <div style={{fontWeight:700,marginBottom:3}}>Ce qu'il faut faire, une seule fois :</div>
              <div>1. Ouvrir <a href="https://vercel.com/shopcancale35-7638s-projects/cancale-v67/settings/environment-variables" target="_blank" rel="noreferrer" style={{color:C.accent,fontWeight:600}}>Vercel → Settings → Environment Variables</a></div>
              <div>2. Ajouter la variable <code style={{fontSize:10.5}}>VAPID_PRIVATE_KEY</code> avec la clé privée que je t'ai donnée</div>
              <div>3. Redéployer (Deployments → ⋯ → Redeploy)</div>
              <div style={{marginTop:4,color:C.muted}}>La clé privée ne peut pas vivre dans le code : le dépôt est public, n'importe qui pourrait envoyer des notifications sur ton téléphone.</div>
            </div>
          </div>
        </div>
      )}
      {srv && srv.pret && (
        <div style={{fontSize:11.5,color:C.muted,marginBottom:10}}>
          Serveur prêt à envoyer · <b style={{color:C.text}}>{srv.devices}</b> appareil{srv.devices>1?'s':''} abonné{srv.devices>1?'s':''}.
        </div>
      )}
      {state!=='unsupported' && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {state!=='on' ? (
            <button type="button" onClick={enable} disabled={state==='busy'||state==='checking'} style={{flex:1,minWidth:130,padding:'9px 12px',borderRadius:8,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:state==='busy'?0.6:1}}>
              {state==='busy'?'…':'Activer sur cet appareil'}
            </button>
          ) : (<>
            <button type="button" onClick={test} style={{flex:1,minWidth:100,padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Tester</button>
            <button type="button" onClick={disable} style={{flex:1,minWidth:100,padding:'9px 12px',borderRadius:8,border:`1px solid ${C.danger}66`,background:'transparent',color:C.danger,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Désactiver</button>
          </>)}
        </div>
      )}
      {msg && <div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.4}}>{msg}</div>}
    </div>
  );
}

// ── SÉCURITÉ DES DONNÉES : L'ÉTAT RÉEL, MESURÉ ────────────────────────────────
// Trois verrous doivent être en place pour que « chacun ses données » soit vrai.
// Ils étaient décrits dans la documentation, donc invérifiables depuis l'app —
// et un verrou qu'on croit posé est pire qu'un verrou absent. Chacun est
// SONDÉ pour de bon, et chaque ligne dit quoi faire s'il manque.
function SecuriteSetting() {
  const [st, setSt] = useState(null);
  const [ext, setExt] = useState(undefined);   // undefined = pas encore demandé
  const [copie, setCopie] = useState('');
  const [srv, setSrv] = useState(null);   // état des routes serveur (clé de service, propriétaire)
  // ⚠️ UN SONDAGE RATÉ RESTE `null` — il ne devient pas un diagnostic. `{}`
  //    rendait `srv !== null`, donc « clé de service manquante » alors qu'on
  //    n'avait rien mesuré (route injoignable, 404, réponse HTML d'un 522).
  //    Seul `ok:true` est une mesure.
  useEffect(() => { fetch('/api/sante').then(r=>r.json()).then(j=>setSrv(j && j.ok === true ? j : null)).catch(()=>setSrv(null)); }, []);
  useEffect(() => { (async () => {
    const out = { colonne: null, lisibleSansCompte: null, ecritureSansCompte: null, jetonsLisibles: null, mailAuto: null };
    // 1. La colonne `owner` existe-t-elle ? SEUL un 400 « column does not
    //    exist » répond NON. ⚠️ `out.colonne = res.ok` faisait répondre non à
    //    TOUT échec : le 10 septembre, base injoignable (522), ce panneau
    //    affichait « Propriétaire des lignes · colonne absente » et le bouton
    //    « Copier la migration SQL » — un diagnostic et son remède sur une
    //    mesure qui n'avait pas eu lieu. « Pas su » ne vaut pas « non ».
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: sbAuth() });
      out.colonne = r.ok ? true : (r.status === 400 ? false : null);
    }
    catch (_) { out.colonne = null; }
    // 2. ⚠️ LE PIÈGE : la colonne peut exister sans que RLS soit actif. On teste
    //    donc ce qui compte vraiment — une lecture avec la clé PUBLIQUE seule
    //    ramène-t-elle encore des lignes ? Si oui, tout le monde lit tout.
    // §11 : la règle vit dans `sondeLectureSansCompte`, la porte d'entrée lit
    // la MÊME. Elle rend trois états, dont `null` = pas su — c'était le feu
    // vert menteur du 11 septembre (`: false` sur tout échec).
    out.lisibleSansCompte = await sondeLectureSansCompte();
    // 2 bis. ⚠️⚠️ ET LIRE N'EST PAS LE PIRE — MESURÉ LE 15 SEPTEMBRE.
    //    La clé publique peut aussi ÉCRIRE : un `POST` sur `app_data` avec elle
    //    seule répond **201**. Lire, c'est regarder ; écrire, c'est remplacer
    //    ses numéros de rangement, ses bordereaux, ses comptes — et effacer.
    //    Le panneau ne disait que la lecture : il décrivait donc le moindre des
    //    deux risques sur l'écran qui sert à décider si ses données sont
    //    protégées.
    //    ⚠️ ON NE SONDE PAS EN ÉCRIVANT (§2.3 : aucune ligne de test dans la
    //    base de production).
    //    ⚠️⚠️ L'ANCIENNE SONDE (un `PATCH` sur un identifiant inexistant) NE
    //    POUVAIT PAS DIRE « FERMÉ » : mesuré le 2 octobre, base fermée, RLS
    //    filtre EN SILENCE et répond 200 + `[]` — exactement comme une base
    //    ouverte. Le panneau aurait annoncé « tout écrire et effacer » sur une
    //    base verrouillée.
    //    ⇒ On envoie DEUX FOIS la même ligne en un seul envoi. Base ouverte : la
    //    première passe, la seconde heurte la clé → 409 et Postgres annule TOUT
    //    l'envoi (rien n'est écrit). Base fermée : la règle refuse dès la
    //    première → 401/403. Vérifié dans la base : 23505 / 42501, 0 ligne.
    try {
      const sonde = { id: '__sonde_droits_ecriture__', data: {} };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([sonde, sonde]),
      });
      out.ecritureSansCompte = r.status === 409 ? true : ((r.status === 401 || r.status === 403) ? false : null);
    } catch (_) { out.ecritureSansCompte = null; }
    // 2 ter. ⚠️⚠️ LE PIRE DE TOUS, ET AUCUNE SONDE NE LE REGARDAIT : la table
    //    `vinted_accounts` porte les JETONS de ses neuf comptes
    //    (`access_token`, `refresh_token`, `csrf_token`), et la clé publique la
    //    lit — mesuré, elle répond 200. Qui les a n'a pas besoin de son mot de
    //    passe : il EST lui sur Vinted. Les trois autres sondes parlaient de
    //    `app_data` uniquement.
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=id&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      out.jetonsLisibles = r.ok ? (await r.json()).length > 0
        : ((r.status === 401 || r.status === 403) ? false : null);
    } catch (_) { out.jetonsLisibles = null; }
    // 3. Création de compte : faut-il un email de confirmation ? (le serveur de
    //    test Supabase n'en envoie que quelques-uns par heure)
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
      if (r.ok) { const j = await r.json(); out.mailAuto = !!j.mailer_autoconfirm; }
    } catch (_) { out.mailAuto = null; }
    setSt(out);
    setExt(await vmrAuthEtat());
  })(); }, []);
  const copier = async (txt, quoi) => {
    try { await navigator.clipboard.writeText(txt); setCopie(quoi); setTimeout(()=>setCopie(''), 2200); } catch (_) {}
  };
  // Ce qu'on écrit quand la sonde n'a pas répondu : jamais un diagnostic.
  const PAS_SU = "Le sondage n'a pas abouti (réseau, ou base injoignable). Rouvre cet écran pour réessayer.";
  const Ligne = ({ t, ok, etat, d, action }) => (
    <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderTop:`1px solid ${C.border}`}}>
      <span style={{flexShrink:0,marginTop:2,display:'inline-flex',color: ok == null ? C.muted : ok ? INV_STATUS.online.color : C.warn}}>
        <Icon name={ok == null ? 'clock' : ok ? 'check' : 'alert'} size={14}/>
      </span>
      <div style={{minWidth:0,flex:'1 1 140px'}}>
        <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>{t} <span style={{fontWeight:500,color: ok == null ? C.muted : ok ? INV_STATUS.online.color : C.warn}}>· {etat}</span></div>
        <div style={{fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:2}}>{d}</div>
        {action}
      </div>
    </div>
  );
  const s = st || {};
  // ⚠️ LE VERDICT PORTE SUR LES QUATRE, pas sur la lecture seule : une base
  // qu'on peut encore ÉCRIRE, ou dont les jetons Vinted se lisent, n'est pas
  // cloisonnée — même si `app_data` finissait par se fermer en lecture.
  const proteges = s.colonne === true && s.lisibleSansCompte === false
    && s.ecritureSansCompte === false && s.jetonsLisibles === false;
  // « Je ne sais pas » n'est ni « cloisonnées » ni « partagées ».
  const sondeInconnue = s.colonne == null || s.lisibleSansCompte == null
    || s.ecritureSansCompte == null || s.jetonsLisibles == null;
  return (
    <div style={{border:`1px solid ${proteges || sondeInconnue ? C.border : C.warn + '66'}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
        {/* Le titre du sous-écran (téléphone) le dit déjà : caché là par CSS (§7) ;
            le verdict à côté reste. Sur ordinateur, c'est le seul titre du panneau. */}
        <div className="vrm-titre-panneau" style={{fontSize:13,fontWeight:600,color:C.text}}>Sécurité des données</div>
        <span style={{fontSize:11,fontWeight:600,color:sondeInconnue?C.muted:proteges?INV_STATUS.online.color:C.warn,background:(sondeInconnue?C.muted:proteges?INV_STATUS.online.color:C.warn)+'18',borderRadius:8,padding:'1px 8px'}}>
          {st === null ? 'vérification…' : sondeInconnue ? 'pas encore vérifié' : proteges ? 'cloisonnées' : 'partagées'}
        </span>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:4,lineHeight:1.45}}>
        Sondé en direct sur ta base, à chaque ouverture de cet écran.
      </div>
      <Ligne t="Propriétaire des lignes" ok={s.colonne}
        etat={s.colonne == null ? 'pas encore vérifié' : s.colonne ? 'colonne présente' : 'colonne absente'}
        d={s.colonne == null ? PAS_SU : s.colonne ? "Chaque ligne peut être attribuée à un vendeur."
          : "Sans elle, toutes les données vivent dans la même ligne : un deuxième compte ouvrirait TA boutique. C'est la migration SQL à passer dans Supabase → SQL Editor."}
        action={s.colonne === false && (
          <button type="button" onClick={()=>copier(MIGRATION_SQL, 'sql')}
            style={{marginTop:7,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'6px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {copie==='sql' ? '✓ Copié — colle-le dans Supabase → SQL Editor' : <span style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="doc" size={12}/>Copier la migration SQL</span>}
          </button>)}/>
      {/* ⚠️ UNE CAUSE, UNE LIGNE (§7). Lire, écrire et les jetons Vinted, c'est
          le MÊME verrou manquant (RLS) : trois lignes d'alerte pour un seul
          geste se liraient comme trois problèmes. Mais les trois faits sont
          DIFFÉRENTS — écrire, c'est remplacer et effacer ; les jetons, c'est
          être lui sur Vinted — donc la ligne les dit tous les trois, mesurés.
          ⚠️ Et chacun garde ses trois états : une sonde qui n'a pas répondu ne
          doit ni accuser ni rassurer. */}
      {(() => {
        const su = [s.lisibleSansCompte, s.ecritureSansCompte, s.jetonsLisibles];
        const inconnu = su.some((v) => v == null);
        const ouverts = [
          s.lisibleSansCompte === true ? 'tout lire' : null,
          s.ecritureSansCompte === true ? 'tout écrire et effacer' : null,
          s.jetonsLisibles === true ? 'lire les jetons de tes comptes Vinted' : null,
        ].filter(Boolean);
        // Ce qui n'a pas pu être mesuré est nommé, jamais compté comme fermé.
        const pasSus = [
          s.lisibleSansCompte == null ? 'la lecture' : null,
          s.ecritureSansCompte == null ? 'l’écriture' : null,
          s.jetonsLisibles == null ? 'les jetons Vinted' : null,
        ].filter(Boolean);
        return (
          <Ligne t="Accès sans compte"
            ok={inconnu ? null : ouverts.length === 0}
            etat={inconnu ? 'pas encore vérifié' : ouverts.length === 0 ? 'fermé' : ouverts.length === 3 ? 'tout est ouvert' : 'partiellement ouvert'}
            d={inconnu
              ? `${PAS_SU} (${pasSus.join(' · ')})`
              : ouverts.length === 0
                ? "La clé publique ne ramène plus rien et n'écrit plus rien : seule une session identifiée touche tes données."
                : <>La clé publique — celle qui est <b>visible dans le code de la page</b> — permet encore de <b>{ouverts.join(', ')}</b>. C'est le verrou qui compte vraiment (RLS) : la colonne seule ne protège rien.{s.jetonsLisibles === true ? <> Un jeton Vinted vaut le compte lui-même : pas besoin de ton mot de passe.</> : null}</>}/>
        );
      })()}
      <Ligne t="Création de compte" ok={s.mailAuto == null ? null : s.mailAuto === true}
        etat={s.mailAuto == null ? 'pas encore vérifié' : s.mailAuto ? 'immédiate' : 'email de confirmation exigé'}
        d={s.mailAuto == null ? PAS_SU : s.mailAuto ? "Un nouveau compte est utilisable tout de suite."
          : "Le serveur d'envoi de test de Supabase est limité à quelques emails par heure — une création peut rester bloquée. Authentication → Providers → Email → décocher « Confirm email »."}/>
      {/* ⚠️ LA MOITIÉ SERVEUR DU CLOISONNEMENT. Les emails, les rappels
          d'expédition et les notifications sont écrits par des routes qui
          tournent SANS vendeur connecté : sans clé de service elles ne
          pourront plus rien écrire dès que RLS est actif, et sans propriétaire
          leurs lignes n'appartiendront à personne (email reçu la nuit =
          silencieusement perdu). C'est le vrai blocage à lever AVANT la
          migration, et il ne se voit nulle part ailleurs. */}
      <Ligne t="Routes serveur (emails, rappels)" ok={srv === null ? null : !!(srv.serviceKey && srv.owner)}
        etat={srv == null ? 'pas encore vérifié' : srv.serviceKey && srv.owner ? 'prêtes' : srv.serviceKey ? 'propriétaire manquant' : 'clé de service manquante'}
        d={srv == null ? PAS_SU : srv.serviceKey && srv.owner
          ? "Elles écriront sous ton compte une fois la base cloisonnée."
          : "À régler dans Vercel → Settings → Environment Variables AVANT la migration : SUPABASE_SERVICE_KEY (Supabase → Settings → API → service_role) et VRM_OWNER_UID (ton identifiant de compte). Sans ça, les emails et rappels cesseront d'être enregistrés dès que la séparation sera activée."}/>
      <Ligne t="Extension identifiée" ok={ext === undefined ? null : !!(ext && ext.connecte)}
        etat={ext === undefined ? '…' : !ext ? 'extension absente ici' : ext.connecte ? (ext.email || 'connectée') : 'pas connectée'}
        d={!ext ? "Sur téléphone c'est normal. Sur l'ordinateur, ouvre l'app dans le Chrome où l'extension est installée."
          : ext.connecte ? "Elle écrira sous ce compte dès que la base saura séparer les vendeurs."
          : "Ouvre la fenêtre de l'extension (son icône dans Chrome) → Compte VRM → entre ton email et ton mot de passe."}/>
    </div>
  );
}
function EmailsSetting() {
  // ⚠️ `undefined` = en cours · `null` = la base n'a pas répondu · objet = lu.
  //    Sans ce troisième état, une lecture ratée affichait « Aucune adresse
  //    déclarée » — une AFFIRMATION sur l'attribution de ses emails, faite sur
  //    une mesure qui n'a pas eu lieu.
  const [reg, setReg] = useState(undefined);     // { adresse: {owner,label} }
  // Même trois états : `undefined` en cours · `null` pas su · objet lu (la
  // réponse de la route : `emails`, et `installation` pour le seul propriétaire).
  const misDeCote = useMisDeCote();
  const quarantaine = misDeCote ? misDeCote.emails : misDeCote;
  // Les adresses où arrivent déjà SES emails (suggestions) : `null` = pas lu.
  const [vues, setVues] = useState(null);
  const [busy, setBusy] = useState('');
  const uid = (AUTH.user && AUTH.user.id) || '';
  const racine = useRef(null);
  useEffect(() => {
    if (!DEMANDE_ADRESSES.on) return;
    DEMANDE_ADRESSES.on = false;
    const t = setTimeout(() => { try { racine.current && racine.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }, 250);
    return () => clearTimeout(t);
  }, []);
  const charger = React.useCallback(async () => {
    try {
      // ⚠️⚠️ C'EST L'ADRESSE DE RÉCEPTION QUI DÉCIDE à quel vendeur appartient
      //    un email (§5), et cette liste se réécrit ENTIÈRE à chaque ajout.
      //    Avec `r.ok ? … : []`, un hoquet de la base pendant qu'il ouvre cet
      //    écran, puis un seul ajout, effaçait TOUTES ses autres adresses : les
      //    emails Vinted suivants (bordereaux, ventes, suivis) ne lui étaient
      //    plus attribués et partaient en quarantaine. « Rien lu » ≠ « rien ».
      const d = await lireReglage('vrm_email_owners');
      setReg(d === null ? null : (d.adresses || {}));
    } catch (_) { setReg(null); }
    // ⚠️ Une lecture ratée rendait `[]` : la section se taisait comme s'il n'y
    //    avait rien à réclamer. « Rien lu » ne vaut pas « rien ».
    lireMisDeCote();
    lireAdressesVues().then(setVues);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const ecrire = async (adresses) => {
    if (reg === null || reg === undefined) return;   // pas lu : on n'écrase pas la liste
    const avant = reg;
    setReg(adresses);
    // ⚠️ Une écriture REFUSÉE (la base répond, mais non) s'affichait comme
    //    réussie : l'adresse semblait déclarée, ses emails continuaient de
    //    partir de côté. On remet la liste d'avant et on le dit.
    let ok = false;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method: 'POST',
        headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([withOwner({ id: 'vrm_email_owners', data: { adresses, updatedAt: new Date().toISOString() } })]),
      });
      ok = !!(r && r.ok);
    } catch (_) { ok = false; }
    if (!ok) { setReg(avant); toast("La liste n'a pas pu être enregistrée — réessaie."); return; }
    // Une adresse ajoutée (ou retirée) change ce qui t'est proposé en dessous :
    // on relit, sans attendre la prochaine ouverture de l'écran.
    lireMisDeCote();
  };
  // Une ou plusieurs adresses d'un coup (saisie à la main, ou suggestion).
  const ajouterAdresses = async (liste) => {
    const nouv = { ...(reg || {}) };
    let n = 0;
    for (const a of liste) {
      const adr = normAdresse(a);
      if (!adr || !ADRESSE_RECEPTION_OK.test(adr) || Object.keys(nouv).some((k) => normAdresse(k) === adr)) continue;
      nouv[adr] = { owner: uid || '', label: '', at: new Date().toISOString() };
      n++;
    }
    if (n) await ecrire(nouv);
  };
  const ajouter = async () => {
    const a = await askText({ desc: "Ton adresse de réception.\n\nC'est l'adresse vers laquelle tu fais suivre tes emails Vinted (bordereaux, ventes, colis). Tout ce qui arrive dessus sera à toi.", value: '', ok: 'Ajouter' });
    const adr = normAdresse(a);
    if (!adr) return;
    if (!ADRESSE_RECEPTION_OK.test(adr)) { toast("Cette adresse ne ressemble pas à une adresse email."); return; }
    if (reg && Object.keys(reg).some((k) => normAdresse(k) === adr)) { toast('Cette adresse est déjà à toi.'); return; }
    await ajouterAdresses([adr]);
  };
  const retirer = async (adr) => {
    const ok = await askConfirm({ title: `Retirer ${adr} ?`, desc: "Les emails qui arriveront ensuite sur cette adresse ne te seront plus attribués : ils seront mis de côté en attendant que tu les réclames. Rien de déjà reçu n'est supprimé.", ok: 'Retirer', danger: true });
    if (!ok) return;
    const u = { ...(reg || {}) }; delete u[adr]; await ecrire(u);
  };
  const rejouerUn = async (id, silencieux) => {
    const r = await fetch('/api/email-rattacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(AUTH.session && AUTH.session.access_token ? { Authorization: `Bearer ${AUTH.session.access_token}` } : {}) },
      body: JSON.stringify({ id, silencieux: !!silencieux }),
    });
    const j = await r.json().catch(() => ({}));
    return !!(j && j.ok);
  };
  const rattacher = async (id) => {
    setBusy(id);
    try {
      const ok = await rejouerUn(id, false);
      toast(ok ? 'Email rattaché — il apparaît maintenant dans tes écrans.' : "Ce mail n'a pas pu être rattaché (format non reconnu). Il reste conservé.");
    } catch (_) { toast('Réseau indisponible — réessaie.'); }
    setBusy(''); charger();
  };
  // ── TOUT REJOUER ────────────────────────────────────────────────────────────
  // Après l'incident du 16→22 août (§5.43), 593 emails s'étaient accumulés ici
  // alors qu'ils auraient dû être traités : les colis à retirer, leurs QR et
  // leurs codes n'apparaissaient nulle part. Ce bouton les repasse dans le même
  // traitement que s'ils venaient d'arriver.
  // ⚠️ UN PAR UN, en attendant la réponse : on ne lâche pas 600 requêtes d'un
  //    coup sur la fonction serveur. Et `silencieux` coupe les notifications —
  //    sinon c'est 600 alertes pour des choses déjà faites.
  const [lot, setLot] = useState(null);   // { fait, total, ok } pendant le rejeu
  const toutRejouer = async () => {
    const ids = (quarantaine || []).map(q => q.id);
    if (!ids.length) return;
    const go = await askConfirm({
      title: `Rejouer ${ids.length} email${ids.length > 1 ? 's' : ''} ?`,
      desc: "Ils repassent dans le traitement normal : colis à retirer avec leur QR et leur code, bordereaux, ventes, offres.\n\nAucune notification ne sera envoyée, et rien n'est supprimé tant que le traitement n'a pas abouti.",
      ok: 'Tout rejouer',
    });
    if (!go) return;
    let ok = 0;
    setLot({ fait: 0, total: ids.length, ok: 0 });
    for (let i = 0; i < ids.length; i++) {
      try { if (await rejouerUn(ids[i], true)) ok++; } catch (_) {}
      setLot({ fait: i + 1, total: ids.length, ok });
    }
    setLot(null);
    toast(`${ok} email${ok > 1 ? 's' : ''} traité${ok > 1 ? 's' : ''} sur ${ids.length}.`);
    charger();
  };
  const liste = Object.keys(reg || {});
  const enAttente = Array.isArray(quarantaine) ? quarantaine : [];
  // ── CE QUE LA ROUTE DIT AU SEUL PROPRIÉTAIRE DE L'INSTALLATION ─────────────
  const inst = (misDeCote && misDeCote.installation) || null;
  const pers = inst ? phrasePersonne(inst.personne) : null;
  // ⚠️⚠️ « Aucune adresse déclarée… les emails reçus sont attribués au
  //    propriétaire de cette installation » s'affichait QUOI QU'IL ARRIVE —
  //    y compris quand un autre compte avait déclaré la sienne, c'est-à-dire
  //    quand ce repli ne jouait PLUS et que ses emails partaient de côté. La
  //    phrase suit ce que la règle d'arrivée fait vraiment (la route le dit) ;
  //    sans réponse, elle n'affirme rien sur l'attribution.
  const vide = (misDeCote && misDeCote.cloisonnee === false)
      ? { t: "Aucune adresse déclarée. Cette installation n'a qu'une boutique : tous les emails reçus y sont rangés.", alerte: false }
    : inst && inst.repli === true
      ? { t: "Aucune adresse déclarée. Personne d'autre n'en a déclaré : pour l'instant, les emails reçus te reviennent (tu es le propriétaire de cette installation). Dès qu'un autre compte déclarera la sienne, un email arrivé sur une adresse que tu n'as pas déclarée sera mis de côté — déclare les tiennes dès maintenant.", alerte: false }
    : inst && inst.repli === false
      // Le geste ne se dit qu'une fois (§7) : quand le nombre est écrit juste
      // dessous, c'est lui qui le porte.
      ? { t: "Aucune adresse déclarée — et un autre compte a déclaré les siennes : un email arrivé sur une adresse que tu n'as pas déclarée ne t'est plus attribué, il est mis de côté." + (pers ? '' : ' Ajoute tes adresses de réception.'), alerte: true }
    : misDeCote
      ? { t: "Aucune adresse déclarée : tant que tu n'en déclares aucune, aucun email ne t'est attribué. Ajoute l'adresse vers laquelle tu fais suivre tes emails Vinted.", alerte: true }
      : { t: "Aucune adresse déclarée. Ajoute l'adresse vers laquelle tu fais suivre tes emails Vinted.", alerte: false };
  // Les suggestions : SES adresses déjà vues, pas encore déclarées.
  const declarees = new Set(liste.map(normAdresse));
  const sugg = Array.isArray(vues) ? vues.filter((v) => !declarees.has(v.adresse)) : [];
  const toutesSugg = async () => {
    const ok = await askConfirm({
      title: `Ajouter ${sugg.length} adresses ?`,
      desc: `Les emails qui arrivent dessus te seront attribués, et ceux déjà mis de côté te seront proposés.\n\n${sugg.map((v) => v.adresse).join('\n')}`,
      ok: 'Les ajouter',
    });
    if (ok) await ajouterAdresses(sugg.map((v) => v.adresse));
  };
  return (
    <div ref={racine} data-reglage-adresses="" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>Mes adresses de réception</div>
      {/* ⚠️ (16 octobre) Julien : « je ne comprends pas à quoi ça sert ». Le
          paragraphe d'avant disait la RÈGLE (« l'adresse d'arrivée décide »)
          sans dire l'USAGE. Trois lignes visibles — à quoi ça sert, un exemple,
          ce qui se passe si une adresse manque — et le pas-à-pas replié. */}
      <div data-adresses-explication="" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',margin:'6px 0 12px'}}>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',columnGap:9,rowGap:6,fontSize:12.5,lineHeight:1.45,color:C.text}}>
          <span aria-hidden="true" style={{color:C.accent,marginTop:2}}><Icon name="mail" size={14}/></span>
          <span>VRM range tes emails Vinted (bordereaux, ventes, colis) dans ta boutique <b>grâce à l'adresse où ils arrivent</b>.</span>
          <span aria-hidden="true" style={{color:C.muted,marginTop:2}}><Icon name="check" size={14}/></span>
          <span><span style={{color:C.muted}}>Exemple :</span> Vinted t'écrit sur <b style={{whiteSpace:'nowrap'}}>tonnom@exemple.fr</b> → ajoute cette adresse ici.</span>
          <span aria-hidden="true" style={{color:C.muted,marginTop:2}}><Icon name="clock" size={14}/></span>
          <span>Une adresse manque ? Ses emails sont mis de côté, gardés entiers — ils te sont proposés ici dès que tu l'ajoutes.</span>
        </div>
        <details style={{marginTop:8}}>
          <summary style={{cursor:'pointer',fontSize:12.5,fontWeight:600,color:C.accent,padding:'13px 0',minHeight:44,boxSizing:'border-box'}}>Comment faire suivre mes emails Vinted vers VRM&nbsp;?</summary>
          <ol style={{margin:'8px 0 0',paddingLeft:18,fontSize:12,color:C.text,lineHeight:1.5,display:'grid',gap:5}}>
            <li>Sur Vinted, dans chaque compte : <b>Paramètres → Notifications</b>, laisse les emails activés (ventes, bordereaux, messages).</li>
            <li>Dans ta boîte mail, fais suivre les emails de Vinted vers la boîte reliée à VRM (une règle de transfert, ou le script Gmail installé avec VRM).</li>
            <li>Adresse « Masquer mon adresse » d'Apple : sur l'iPhone, <b>Réglages → ton nom → Connexion et sécurité → Se connecter avec Apple → Vinted → Transférer à</b>.</li>
            <li>Ajoute ici l'adresse sur laquelle Vinted t'écrit — une par compte Vinted si elles sont différentes.</li>
          </ol>
          <div style={{fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:8}}>
            Pourquoi l'adresse et pas le contenu ? Un expéditeur ou un texte se falsifient ; l'adresse d'arrivée, non. Personne ne peut donc déposer ses emails dans ta boutique, et un email dont l'adresse n'est déclarée par personne n'est jamais donné au hasard.
          </div>
        </details>
      </div>
      {reg === undefined ? <div style={{fontSize:12,color:C.muted}}>Chargement…</div>
      : reg === null ? <span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span>
      : liste.length === 0 ? (
        <div data-adresses-vide={vide.alerte ? 'alerte' : 'info'} style={{fontSize:12,color:vide.alerte?C.warn:C.muted,background:vide.alerte?`${C.warn}12`:C.bg,border:`1px solid ${vide.alerte?`${C.warn}44`:C.border}`,borderRadius:8,padding:'9px 11px',lineHeight:1.45}}>
          {vide.t}
        </div>
      ) : liste.map(adr => (
        <div key={adr} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
          <span style={{flex:'1 1 140px',minWidth:0,fontSize:12.5,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{adr}</span>
          <button type="button" onClick={()=>retirer(adr)} aria-label={`Retirer ${adr}`}
            style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,borderRadius:8,padding:'5px 9px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Retirer</button>
        </div>
      ))}
      {/* ── CE QUE PERSONNE NE PEUT RÉCUPÉRER (le seul propriétaire le voit) ──
          Le nombre et la cause, jamais le contenu : ce tas peut contenir les
          emails d'un autre vendeur. Placé AVANT les suggestions : on lit le
          problème, puis le geste qui le règle juste dessous. */}
      {pers && (
        <div data-personne={inst.personne.n} style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:12.5,fontWeight:600,color:C.warn,marginBottom:3}}>{pers.titre}</div>
          {pers.lignes.map((l) => <div key={l} style={{fontSize:11.5,color:C.muted,lineHeight:1.45}}>{l}</div>)}
          <div style={{fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:3}}>Conservés entiers — rien n'est perdu.</div>
        </div>
      )}
      {inst && inst.personne === null && (
        <div data-personne="pas-su" style={{marginTop:10,fontSize:11.5,color:C.muted,lineHeight:1.45}}>
          Je n'ai pas pu compter les emails mis de côté que personne ne peut récupérer — rouvre cet écran dans un moment.
        </div>
      )}
      {/* ── SES ADRESSES DÉJÀ VUES, ajoutables d'un clic ──────────────────
          Lues sur SES emails déjà rangés (jamais sur le tas mis de côté) : une
          identité, pas une ressemblance. Le nombre et la date l'aident à
          reconnaître les siennes. Rien quand la lecture a échoué (on ne
          suggère pas sur du vide) ni quand le registre n'est pas lu (on ne
          pourrait pas l'écrire). */}
      {reg && sugg.length > 0 && (
        <div data-suggestions={sugg.length} style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>Adresses où arrivent déjà tes emails</div>
          <div style={{fontSize:11.5,color:C.muted,lineHeight:1.45,margin:'2px 0 4px'}}>Lues sur les emails déjà rangés chez toi, et pas encore dans ta liste. Ajoute celles qui sont à toi.</div>
          {sugg.slice(0, 8).map((v) => (
            <div key={v.adresse} data-suggestion={v.adresse} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
              <span style={{flex:'1 1 140px',minWidth:0}}>
                <span style={{display:'block',fontSize:12.5,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.adresse}</span>
                <span style={{display:'block',fontSize:11,color:C.muted,marginTop:1}}>
                  {v.n} email{v.n>1?'s':''}{v.dernier ? ` · dernier le ${new Date(v.dernier).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}` : ''}
                </span>
              </span>
              <button type="button" onClick={()=>ajouterAdresses([v.adresse])} aria-label={`Ajouter ${v.adresse}`}
                style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'5px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Ajouter</button>
            </div>
          ))}
          {sugg.length > 1 && (
            <button type="button" onClick={toutesSugg}
              style={{marginTop:6,border:'none',background:'transparent',color:C.accent,padding:'4px 0',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              Les ajouter toutes ({sugg.length})
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={ajouter} disabled={reg === null || reg === undefined}
        style={{marginTop:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'8px 12px',fontSize:12.5,fontWeight:600,cursor:reg?'pointer':'default',fontFamily:'inherit',opacity:reg?1:0.45}}>
        + Ajouter une adresse
      </button>
      {/* Pas su ≠ aucun. Une seule phrase, et seulement si le registre, lui, a
          été lu (sinon la pastille du dessus et le bloc de Réglages le disent). */}
      {quarantaine === null && reg !== null && reg !== undefined && (
        <div data-mis-de-cote="pas-su" style={{marginTop:10,fontSize:11.5,color:C.muted,lineHeight:1.45}}>
          Je n'ai pas pu vérifier s'il y a des emails mis de côté pour toi — rien n'est perdu, rouvre cet écran dans un moment.
        </div>
      )}
      {enAttente.length > 0 && (
        <div style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:12.5,fontWeight:600,color:C.warn,marginBottom:6}}>📥 {enAttente.length} email{enAttente.length>1?'s':''} en attente d'un propriétaire</div>
          <div style={{fontSize:11.5,color:C.muted,marginBottom:8,lineHeight:1.45}}>Arrivés avant que leur adresse soit déclarée. Ils sont conservés entiers — rien n'est perdu.</div>
          <button type="button" disabled={!!lot} onClick={toutRejouer}
            style={{width:'100%',marginBottom:10,border:'none',background:lot?C.border:C.accent,color:lot?C.muted:(C.onAccent||'#fff'),borderRadius:8,padding:'10px 12px',fontSize:12.5,fontWeight:700,cursor:lot?'default':'pointer',fontFamily:'inherit'}}>
            {lot ? `Traitement… ${lot.fait}/${lot.total}` : `▶ Tout rejouer (${enAttente.length})`}
          </button>
          {enAttente.slice(0,8).map(q => (
            <div key={q.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
              <span style={{flex:'1 1 130px',minWidth:0,fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {q.sujet || '(sans sujet)'} <span style={{color:C.muted}}>· {q.raison || ''}</span>
              </span>
              <button type="button" disabled={busy===q.id} onClick={()=>rattacher(q.id)}
                style={{flexShrink:0,border:'none',background:C.accent,color:C.onAccent||'#fff',borderRadius:8,padding:'6px 11px',fontSize:11.5,fontWeight:600,cursor:busy===q.id?'default':'pointer',fontFamily:'inherit',opacity:busy===q.id?0.6:1}}>
                {busy===q.id ? '…' : "C'est à moi"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnexionsSetting() {
  const sansSouris = useSansSouris();
  const [ext, setExt] = useState(() => ({ on: vmrExtPresent(), v: vmrExtVersion() }));
  const [mail, setMail] = useState(null);   // { ts, n } | 'vide' | null = en cours
  const [capt, setCapt] = useState(null);   // { ts, n }
  // ⚠️⚠️ QUELLE VERSION A VRAIMENT CAPTÉ ? Depuis son iPhone, le pont n'existe
  // pas — l'app ne pouvait donc PAS répondre « ton extension est-elle à jour ? »
  // sur l'appareil où il pose justement la question. L'extension inscrit
  // désormais sa version dans sa ligne de diagnostic à chaque capture, et c'est
  // une MESURE, pas une déduction (trois sessions ont dû la deviner, une de ces
  // déductions était fausse).
  // ⚠️ C'EST UN CONSTAT, JAMAIS UNE CAPACITÉ : cette version est celle de
  // l'extension qui a capté EN DERNIER, quelque part. `extSait()` n'y touche
  // pas — promettre sur cette valeur, ce serait annoncer à un iPhone ce qu'un
  // Chrome sait faire. Trois états, comme partout : `undefined` = en cours,
  // `null` = pas su, un objet = lu.
  const [derniereExt, setDerniereExt] = useState(undefined);
  // ⚠️ DÉRIVE DE FORMAT (sentinelle 5.139). L'extension note `forme_inconnue_*`
  // + un échantillon `rates.forme_<type>` quand Vinted/LBC/eBay renomme la clé de
  // liste d'une réponse — la capture tombe à 0 sans erreur. On le SURFACE ici
  // pour qu'il le sache (sinon la liste serait juste « vide »), mais SEULEMENT
  // si c'est RÉCENT (< 7 j) : une dérive déjà corrigée laisse son compteur, et
  // une alerte périmée fait cesser de lire les vraies.
  const [drift, setDrift] = useState(undefined);
  // Les plantages notés ces 7 derniers jours (src/plantages.js). Lecture ratée
  // ou aucun : rien n'est affiché — une alerte n'apparaît que sur un fait.
  const [plantages, setPlantages] = useState(undefined);
  useEffect(() => onVmrExt(() => setExt({ on: vmrExtPresent(), v: vmrExtVersion() })), []);
  useEffect(() => { (async () => {
    try {
      // Trié et filtré PAR LA BASE (la date est copiée dans `meta`) : sans
      // `order`, 60 lignes quelconques pouvaient laisser dehors celles de la semaine.
      const depuis7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.plantage_*&meta->>at=gte.${encodeURIComponent(depuis7)}&select=id,message:data->>message,at:data->>at,ecran:data->>ecran&order=meta->>at.desc&limit=60`, { headers: sbAuth() });
      if (!r.ok) { setPlantages(null); return; }
      const rows = await r.json();
      if (!Array.isArray(rows)) { setPlantages(null); return; }
      setPlantages(rows.filter(x => { const t = Date.parse(x.at || '') || 0; return t && (Date.now() - t) < 7 * 864e5; })
        .sort((a, b) => String(b.at).localeCompare(String(a.at))));
    } catch (_) { setPlantages(null); }
  })(); }, []);
  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_diag_capture&select=ver:data->>ver,verAt:data->>verAt,rates:data->rates`, { headers: sbAuth() });
      if (!r.ok) { setDerniereExt(null); setDrift(null); return; }
      const rows = await r.json();
      if (!Array.isArray(rows)) { setDerniereExt(null); setDrift(null); return; }
      const d = rows[0] || {};
      setDerniereExt(d.ver ? { v: String(d.ver), at: d.verAt || '' } : 'aucune');
      const rates = (d.rates && typeof d.rates === 'object') ? d.rates : {};
      const recents = Object.keys(rates)
        .filter(k => /^forme_/.test(k))
        .map(k => ({ type: k.slice('forme_'.length), ...(rates[k] || {}) }))
        .filter(x => { const t = Date.parse(x.at || '') || 0; return t && (Date.now() - t) < 7 * 864e5; })
        // 20 oct. : un échantillon dont les clés sont celles d'une RÉPONSE
        // D'ERREUR de Vinted (`code`, `message`, `message_code`…) n'est pas un
        // renommage : c'est un refus, jugé à tort comme une conversation par les
        // extensions < 5.193 (mesuré chez Julien : 250 fausses alertes). On ne
        // le montre pas comme « un site a changé son format ».
        .filter(x => !estCorpsErreurVinted(x.cles));
      setDrift(recents);
    } catch (_) { setDerniereExt(null); setDrift(null); }
  })(); }, []);
  // Le type de capture → un mot que Julien lit (jamais le nom technique brut).
  const nomFamille = (t) => /orders_sold|transaction|txn/.test(t) ? 'ventes' : /orders_purchased/.test(t) ? 'achats'
    : /listings|item/.test(t) ? 'annonces' : /inbox|conv/.test(t) ? 'messages' : t;
  useEffect(() => { (async () => {
    const lire = async (motif) => {
      try {
        // ⚠️ `email_*` = 1 211 lignes, `harvest_*` = 1 127 : sans pagination on
        // n'en lit que 1 000, et la coupure enlève justement les `email_track_*`
        // (les colis), donc « dernier email reçu » pouvait dater d'avant le
        // dernier colis arrivé (§A1). Lignes vidées écartées.
        const rows = await lireTout(`id=like.${motif}&select=id,updated_at,cap:meta->>capturedAt&meta->>supprime=is.null`);
        if (!rows) return null;
        let ts = 0; rows.forEach(x => { const t = harvestTs(x) || 0; if (t > ts) ts = t; });
        return { n: rows.length, ts };
      } catch (_) { return null; }
    };
    setMail(await lire('email_*') || 'vide');
    setCapt(await lire('harvest_*') || 'vide');
  })(); }, []);
  const depuis = (ts) => {
    if (!ts) return 'jamais';
    const h = (Date.now() - ts) / 3600000;
    return h < 1 ? "il y a moins d'une heure" : h < 48 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`;
  };
  // Frais (< 2 j) = neutre, orange < 7 j, rouge au-delà. ⚠️ Plus de vert : c'était
  // le #0F8A6A de l'ancienne palette menthe (revue du 16 oct.) — et §7 ne colore
  // un état que s'il y a quelque chose à rattraper. Tout va bien = rien à voir.
  const teinte = (ts) => !ts ? C.muted : (Date.now() - ts) < 2 * 864e5 ? C.muted
                       : (Date.now() - ts) < 7 * 864e5 ? C.warn : C.danger;
  const Ligne = ({ t, etat, coul, d }) => (
    <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderTop:`1px solid ${C.border}`}}>
      <span style={{flexShrink:0,width:9,height:9,borderRadius:8,background:coul,marginTop:5}}/>
      <div style={{minWidth:0,flex:'1 1 140px'}}>
        <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>{t} <span style={{fontWeight:500,color:coul}}>· {etat}</span></div>
        <div style={{fontSize:11.5,color:C.muted,lineHeight:1.45,marginTop:2}}>{d}</div>
      </div>
    </div>
  );
  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>État des connexions</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:4,lineHeight:1.45}}>Ce qui alimente l'app, et depuis quand.</div>
      {/* ⚠️ UN NUMÉRO DE VERSION NE VEUT RIEN DIRE TOUT SEUL. On dit s'il est
          à jour, et sinon ce que ça coûte et quoi faire — une version en retard
          ne « bugue » pas, elle ne capte simplement pas, en silence. */}
      <Ligne t="Extension Chrome" coul={!ext.on ? C.warn : extEnRetard(ext.v) ? C.warn : C.muted}
        etat={!ext.on ? 'pas détectée ici' : !ext.v ? 'détectée' : extEnRetard(ext.v) ? `version ${ext.v} — en retard` : `version ${ext.v} · à jour`}
        d={!ext.on ? <>{sansSouris ? <>Sur ton téléphone, rien à faire ici : c'est l'ordinateur où VRM est installé dans Chrome qui fait remonter tes données.</> : <>Sur téléphone c'est normal (il n'y a pas d'extension). Sur l'ordinateur : ouvre l'app dans le Chrome où elle est installée, et recharge-la dans chrome://extensions.</>}{derniereExt && derniereExt !== 'aucune' ? <><br/><b style={{color: extEnRetard(derniereExt.v) ? C.warn : INV_STATUS.online.color}}>La dernière capture est partie d'une {derniereExt.v}{derniereExt.at ? ` (${depuis(Date.parse(derniereExt.at) || 0)})` : ''}.</b> {extEnRetard(derniereExt.v) ? `C'est donc l'ancienne qui tourne encore sur ton ordinateur — c'est là qu'il faut la remplacer par la ${EXT_ATTENDUE}.` : `Ton ordinateur est donc bien à jour — rien à faire ici.`}</> : null}</>
           : extEnRetard(ext.v) ? `La ${EXT_ATTENDUE} est prête à télécharger (bouton ci-dessous). Dézippe, remplace l'ancien dossier « VRM-extension », puis ⟳ dans chrome://extensions — dans CHAQUE Chrome où elle est installée. Tant que c'est l'ancienne qui tourne, elle capte moins de choses que l'app en attend — sans jamais afficher d'erreur.`
           : codePerime() ? textePerime()
           : "Elle est branchée sur cette page : répondre à un message part de ton navigateur, jamais d'un serveur."}/>
      {/* ⚠️ LE ZIP DOIT ÊTRE À UN CLIC. Pendant des semaines l'app a dit
          « mets à jour l'extension » sans que le zip existe nulle part : le
          dépôt n'en portait qu'un, du 30 août, en 4.13, alors que le code était
          en 5.52. `scripts/audit-extension-zip.cjs` vérifie désormais que le
          zip livré porte bien la version du manifeste. */}
      {/* Revue du 16 octobre : sur un téléphone (aucune souris), ce bouton
          proposait de télécharger un zip et de cliquer ⟳ dans chrome://extensions
          — des gestes impossibles ici. La phrase du dessus dit où ça se passe. */}
      {!sansSouris && <div style={{margin:'6px 0 2px',display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
        <a href={`/VRM-extension.zip?v=${EXT_ATTENDUE}`} download
          style={{textDecoration:'none',border:'none',borderRadius:8,background:extEnRetard(ext.v)?C.warn:C.card2,color:extEnRetard(ext.v)?'#fff':C.text,fontSize:12,fontWeight:700,padding:'0 14px',minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center',fontFamily:'inherit'}}>
          Télécharger l'extension {EXT_ATTENDUE}
        </a>
        <span style={{fontSize:11,color:C.muted,flex:'1 1 180px',minWidth:0,lineHeight:1.4}}>
          Le zip se dézippe en un seul dossier « VRM-extension » : remplace l'ancien au même endroit, PUIS clique ⟳ sur VRM dans chrome://extensions — dans chaque Chrome où elle est installée (sans ⟳, Chrome garde l'ancien code).
        </span>
      </div>}
      <Ligne t="Capture Vinted" coul={teinte(capt && capt.ts)}
        etat={capt === 'vide' || !capt ? 'inconnue' : `dernière ${depuis(capt.ts)}`}
        d={capt && capt.ts && (Date.now() - capt.ts) > 2 * 864e5
            ? "Repasse sur vinted.fr avec l'extension — c'est la navigation qui capte."
            : "Annonces, ventes, achats et messages viennent de là."}/>
      {/* ⚠️ DÉRIVE DE FORMAT DÉTECTÉE — l'alerte qui transforme un « vide
          silencieux » en quelque chose d'actionnable. Ne s'affiche que si c'est
          récent (la sentinelle 5.139 pose la date). */}
      {Array.isArray(drift) && drift.length > 0 && (
        <Ligne t="Format d'un site" coul={C.warn} etat="a changé récemment"
          d={<>Un site a changé le format de sa réponse <b>{[...new Set(drift.map(x => nomFamille(x.type)))].join(', ')}</b> : la capture de ces données a pu en souffrir (une liste qui devient vide sans erreur). Ce n'est pas tes données qui sont perdues. <b>Signale-le dans une session VRM</b> pour qu'on adapte l'extension.</>}/>
      )}
      {Array.isArray(plantages) && plantages.length > 0 && (
        <div data-plantages={plantages.length}>
        <Ligne t="Écrans en erreur" coul={C.warn} etat={`${plantages.length} ces 7 derniers jours`}
          d={<>Le dernier : « {plantages[0].message} »{plantages[0].ecran ? <> (écran {plantages[0].ecran})</> : null}, {depuis(Date.parse(plantages[0].at) || 0)}. Tes données ne sont pas touchées : c'est l'affichage qui a échoué, et l'erreur est notée pour être corrigée. <b>Signale-le dans une session VRM.</b></>}/>
        </div>
      )}
      <Ligne t="Emails" coul={teinte(mail && mail.ts)}
        etat={mail === 'vide' || !mail ? 'inconnu' : mail.ts ? `dernier ${depuis(mail.ts)}` : 'aucun reçu'}
        /* ⚠️ « Vinted ne les donne pas autrement » ÉTAIT FAUX pour les codes de
           retrait, et c'est la mesure qui le dit : sur 139 emails de suivi, 20
           seulement portent un code — et le code vit dans la CONVERSATION
           Vinted, où l'extension va le lire depuis la 5.45. Cette phrase
           l'envoyait fouiller sa boîte mail pour quelque chose qui n'y est pas.
           Les bordereaux et le suivi, eux, viennent bien de l'email. */
        d="Les bordereaux et le suivi des colis arrivent par email. Le code de retrait, lui, vit dans la conversation Vinted — c'est là que l'extension va le chercher."/>
      {/* La version de l'app : ici, et plus dans l'en-tête de chaque écran. */}
      <div style={{marginTop:10,paddingTop:9,borderTop:`1px solid ${C.border}`,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',fontSize:11,color:C.muted}}>
        <span style={{flex:'1 1 220px'}}>{BUILD_ID==='inconnue'
          ? <>Version de l'application · <b style={{color:C.text}}>inconnue</b> — recharge la page</>
          : <>Cette page a été <b style={{color:C.text}}>compilée le <span style={{fontVariantNumeric:'tabular-nums'}}>{BUILD_ID}</span></b>.<br/>
              Elle se rafraîchit toute seule quand tu reviens sur l'app ; si la date ne bouge pas après une mise à jour, force-la.</>}</span>
        {/* ⚠️ Ce bouton vivait AU MILIEU DE L'ÉCRAN GARAGE (« Version : … ·
            🔄 Forcer la mise à jour »), juste au-dessus de la pièce en 3D :
            de l'outillage de développeur posé dans un écran de travail. Il ne
            disparaît pas — il rejoint la version, là où on le cherche. */}
        <button type="button" onClick={() => { if (window.__vrmForceUpdate) window.__vrmForceUpdate(); else window.location.reload(); }}
          title="Vide le cache et recharge la dernière version"
          style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.card2, color: C.text, fontSize: 11, fontWeight: 600, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Forcer la mise à jour</button>
      </div>
    </div>
  );
}

// Réglage du régime fiscal : détermine comment le rapport comptable présente les
// chiffres. Micro-entrepreneur (CA + estimation cotisations) ou société au
// régime de la marge (marge + TVA sur la marge). Synchronisé (vinted_regime/tva).
function RegimeSetting({ nu = false }) {
  const [regime, setRegime] = useState(() => load('vinted_regime', 'micro'));
  // §5.49 : la base du régime URSSAF (donc du taux affiché) est synchronisée et
  // lue au montage. Scalaire à défaut non vide : remplacer SEULEMENT s'il est
  // resté au défaut, jamais un choix fait pendant le chargement.
  useEffect(() => onCloudReady(() => setRegime(v => v === 'micro' ? load('vinted_regime', 'micro') : v)), []);
  const [tva, setTva] = useState(() => Number(load('vinted_tva', 20)) || 20);
  // ⚠️ LE TAUX DE COTISATIONS EST UN RÉGLAGE, PAS UNE CONSTANTE. Il était écrit
  // 13,5 % en dur à SIX endroits, et il tombe sur un document qu'il recopie
  // pour l'URSSAF. Le bon taux dépend de son activité et de son option pour le
  // versement libératoire — lui seul le connaît, et il change chaque année.
  // ⚠️ À LA FRANÇAISE, comme partout ailleurs dans l'app. Le champ affichait
  //    « 13.5 » (le nombre recopié tel quel) alors que les deux rapports qui
  //    l'utilisent écrivent « 13,5 % » : le même taux, deux orthographes, sur
  //    l'écran qui sert justement à le régler. Même défaut que les prix
  //    d'achat « 21.0 € » de l'écran Achats. La saisie, elle, accepte
  //    toujours les deux (`replace(',','.')` à la validation).
  const virgule = (n) => String(n).replace('.', ',');
  const [txUrs, setTxUrs] = useState(() => virgule(load('vinted_urssaf_taux', TAUX_URSSAF_DEFAUT)));
  const pick = (r) => { setRegime(r); save('vinted_regime', r); };
  const setRate = (v) => { const n = Math.max(0, Math.min(100, Number(v)||0)); setTva(n); save('vinted_tva', n); };
  return (
    <div style={nu ? {} : {border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Régime fiscal</div>}
      <div style={{fontSize:12.5,color:C.muted,marginBottom:12,lineHeight:1.45}}>Adapte le rapport comptable à ta situation.</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {[['micro','Micro-entrepreneur','Pas de TVA. Rapport : CA des ventes finalisées, bénéfice net, estimation des cotisations.'],
          ['marge','Société — régime de la marge','TVA sur la marge. Rapport : marge, TVA sur marge à reverser, registre d\'achats.']].map(([id,t,d])=>(
          <button type="button" key={id} onClick={()=>pick(id)} style={{textAlign:'left',display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:8,cursor:'pointer',
            border:`1px solid ${regime===id?C.accent:C.border}`,background:regime===id?`${C.accent}12`:'transparent'}}>
            <span style={{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:8,border:`2px solid ${regime===id?C.accent:C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {regime===id && <span style={{width:9,height:9,borderRadius:8,background:C.accent}}/>}
            </span>
            <span style={{minWidth:0}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text,display:'block'}}>{t}</span>
              <span style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{d}</span>
            </span>
          </button>
        ))}
      </div>
      {regime!=='marge' && (
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:500,color:C.text}}>Taux de cotisations</span>
            <input type="text" inputMode="decimal" value={txUrs}
              onChange={e=>setTxUrs(e.target.value)}
              onBlur={()=>{ const v=parseFloat(String(txUrs).replace(',','.')); const ok=(isFinite(v)&&v>=0&&v<=50)?v:TAUX_URSSAF_DEFAUT; setTxUrs(virgule(ok)); save('vinted_urssaf_taux', ok); }}
              style={{width:70,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:13,fontWeight:600,background:C.bg,color:C.text,outline:'none'}}/>
            <span style={{fontSize:12,color:C.muted}}>% du CA</span>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>
            Sert au rapport mensuel et annuel. Il se compose des <b>cotisations sociales</b>, de la <b>contribution à la formation</b>, et du <b>versement libératoire de l'impôt</b> si tu l'as choisi — donc il dépend de ta situation et il change d'une année à l'autre.
            {' '}Vérifie le tien et déclare sur{' '}
            <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" style={{color:C.accent,fontWeight:700,textDecoration:'none'}}>autoentrepreneur.urssaf.fr →</a>
            {' '}: l'app ne le devine pas, elle applique celui que tu poses ici.
          </div>
        </div>
      )}
      {regime==='marge' && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
          <span style={{fontSize:12,fontWeight:500,color:C.text}}>Taux de TVA</span>
          <input type="number" value={tva} onChange={e=>setRate(e.target.value)} style={{width:64,border:`1px solid ${C.border}`,borderRadius:8,padding:'4px 8px',fontSize:13,fontWeight:500,background:C.bg,color:C.text,outline:'none'}}/>
          <span style={{fontSize:12,color:C.muted}}>%</span>
        </div>
      )}
    </div>
  );
}

export { SettingsScreen, VintedAccounts };
