// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { CLE_PLATEFORMES, lirePlateformes } from '../plateformesAffichage.js';
import { refusPanneau } from '../actionsExtension.js';
import { champsFacultatifs } from '../profilVendeur.js';
import { motTaille } from '../vocabulaireVendeur.js';
import { poserLienVc, vcReliable, suggestionsLienVc } from '../lienVestiaire.js';
import React, { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { entrerModeExemple } from '../modeExemple.js';
import { lireImportDepart } from '../importDepart.js';
import { numVcAnnonce, etatAnnonceVcBrut } from '../../api/_lib/vestiaire-regle.js';
import { LIENS_BOUTIQUES } from '../navigateurExtension.js';
import { carteNumerosVc } from '../numerosVestiaire.js';
import { appliquerPrix, noterJournalPrix, envoisPrix, prixParSite } from '../prixPartout.js';
import { lirePrixAttente, annulerPrixAttente } from '../prixAttente.js';
import { ouvrirLiaison } from '../liaisonEtat.js';
import { CLE_NUMERO_ECRIT } from '../numeroEcrit.js';
import { enLigneSur } from '../publierAilleurs.js';
import { CLE_PRIX_PARTOUT, reglagePrix, CLE_PARAMS_PARTOUT, reglageParams, lignePartout, planPartout, executerPartout } from '../publierPartout.js';
import { trancher as trancherRegistre } from '../gestesHorsLigne.js';
import { tr } from '../i18n/index.js';
import { CLE_PARCOURS_NOUVEAU, lireParcoursNouveau, positionApres as positionParcoursNouveau, etatsEtapes as etatsParcoursNouveau, reglagePlateformes, ETAPES_NOUVEAU, installationIci, etatExtensionDirect, comptesCaptes } from '../parcoursNouveau/regle.js';
import { bacASableEtape } from '../modeExemple.js';
import { AUTH, Bouton, C, CARTOUCHES, EXT_CAPACITES, FURN_TYPES, FermeAuRetour, Icon, LBC_ETATS, NAV, PhotoVc, PhotoVinted, SUPABASE_URL, SheetShell, Z_CONFIRMATION, __prixSuivis, __relais, __vmrJobs, _gestesHL, aLaDemande, aLaDemandeFeuille, appelEbay, archiveNumeros, askConfirm, brancherExtensionApp, cartoucheLibre, categorieLbcDe, chercherPlaceTampon, choixTamponValide, cleNum, cmpVersion, corpsCompteEbay, depPrixAttente, descriptionDeFaits, descriptionLbcDe, dessinerPdf, ebayTitre, echelleMiniTampon, ecrireCartouche, ecrireCopieLocale, extSait, extractBrand, extractColors, extractModel, faitsExtensionApp, familleArticle, fetchVintedAccounts, fmt, groupesGestesHL, isCloudReady, lbcListingsSession, lbcTitre, lireBaseRelue, lireRelais, lireTout, load, mpChoisi, numsCase, onCloudReady, oublierLbcSession, ouvrirPageExtension, placeLibreTampon, poserLocalHL, prixAchatDe, rafraichirGestesHL, raisonExtGlobale, rechercheParNumero, rejouerGestesBientot, relaisVivant, rendrePremierePage, resultatReviseEbay, save, sbAuth, sitesPrixDe, stockGestes, tailleAffichee, toast, useComptesAutresSites, useEbayPaires, useExtVivante, useParcoursArrivee, useSansSouris, useVcLocal, vcCarte, vcPoser, vendActuel, vmrCmd, vmrExtPresent, zonesCodesTampon } from '../App.jsx';

// ⟦← App.jsx #1⟧
// (19 nov., décisions « 1 oui, 3 oui », ext. 5.409) La baisse par règle (éteinte par défaut) et « vendue ailleurs ⇒ masquée ».
import { REGLE_CLE, MASQUER_CLE, regleDuCompte, avecRegle, listeMasquerAilleurs } from '../reglesAuto.js';
// ⟦← App.jsx #5⟧
import { suiviPourPartout } from "../publierPartoutSuivi.js";
import { CLE_CORRESPONDANCES, lireMemoire as lireCorrespondances, retenir as retenirCorrespondance, TABLE_VINTED } from "../correspondances.js";   // (15 nov.) Vinted → Leboncoin · eBay · Vestiaire
import { CLE_DEFAUTS_EBAY as CLE_DEFAUTS_EBAY_PP, defautsDepuis as defautsEbayDepuis, resume as resumeReglagesEbayPP } from "../ebay/parametres.js";
// ⟦→ ecrans/Comptabilite.jsx #103⟧   // (15 nov., eBay complet 2) le CA eBay daté au versement
import { chargerSuivi } from "../suiviBranchement.js";
// ⟦← App.jsx #6⟧
import { etatNavigateur as etatNavigateurPN } from "../extension/peutFaire.js";

// ⟦← App.jsx #2⟧
// (17 nov., fiabilité-vitesse) à la demande, hors du morceau App : FeuilleLienVc (était importé en statique)
const FeuilleLienVc = aLaDemandeFeuille(() => import('../LienVestiaire.jsx'));
// ⟦← App.jsx #3⟧
const PrixPartout = aLaDemande(() => import('../PrixPartout.jsx'), true);
// ⟦← App.jsx #4⟧
// (11 nov.) « Publier partout » : la feuille à la demande (règle : src/publierPartout.js).
const PublierPartout = aLaDemande(() => import('../PublierPartout.jsx'), true);
// ⟦← App.jsx #7⟧

// ── RANGER UNE VRAIE PAIRE (feuille du garage 3D) ──────────────────────────
// Julien : « tu peux sélectionner lesquels tu ranges ici, la taille… vraiment
// tu peux tout faire avec l'application ». Avant, ranger une paire demandait de
// TAPER son numéro de mémoire : rien ne vérifiait qu'elle existe, ni qu'elle
// n'est pas déjà rangée ailleurs. On choisit désormais dans la liste de ses
// paires réellement présentes — photo, N°, titre, pointure.
// ⚠️ La saisie libre reste possible (une paire hors app, un carton de matériel),
// mais elle n'est plus le chemin par défaut.
// ── L'APERÇU DU MEUBLE OÙ L'ON RANGE (17 oct.) ─────────────────────────────
// Julien : « quand il met par exemple table et l'endroit où l'on peut mettre une
// paire à ranger, que ça fasse un petit carré sur le côté avec une vue du meuble
// ou de l'endroit où on range ». Un dessin vu de FACE, tiré des données du
// meuble (ses cases, ce qu'elles portent) — la case visée en couleur d'accent.
function ApercuMeuble({ it, cellKey, mode, cap, size = 132 }) {
  const nr = Math.max(1, it.rows || 1), nc = Math.max(1, it.cols || 1);
  const ft = FURN_TYPES[it.type] || {};
  const table = ft.build === 'table', portant = mode === 'cintre';
  const W = 120, H = table ? 80 : 120, pad = 8;
  const iw = W - pad * 2, ih = (table ? 30 : H - pad * 2);
  const cw = iw / nc, ch = table ? ih : ih / nr;
  const [rk, ck] = String(cellKey).split('_').map(Number);
  const cases = [];
  for (let r = 0; r < (table ? 1 : nr); r++) for (let c = 0; c < nc; c++) {
    const key = r + '_' + c; const a = numsCase((it.slots || {})[key]); const vise = r === rk && c === ck;
    const x = pad + c * cw, y = table ? pad + 6 : pad + r * ch;
    const n = Math.min(a.length, Math.max(1, cap || 1));
    cases.push(
      <g key={key}>
        <rect x={x + 1.5} y={y + 1.5} width={cw - 3} height={ch - 3} rx="2.5" fill={vise ? C.accent : 'transparent'} fillOpacity={vise ? 0.18 : 0} stroke={vise ? C.accent : C.border} strokeWidth={vise ? 2 : 1} strokeDasharray={a.length || vise ? '' : '3 2'} />
        {portant
          ? (a.length ? <text x={x + cw / 2} y={y + ch / 2 + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.text}>{a[0]}</text> : null)
          : Array.from({ length: n }, (_, i) => { const bh = Math.min(10, (ch - 6) / Math.max(1, cap || 1)); return <rect key={i} x={x + cw * 0.2} y={y + ch - 3 - (i + 1) * (bh + 1)} width={cw * 0.6} height={bh} rx="1.5" fill={C.muted} fillOpacity="0.45" />; })}
      </g>
    );
  }
  return (
    <svg data-apercu-meuble={it.id} data-apercu-case={cellKey} role="img" aria-label={`${it.name || ft.label || 'Meuble'} vu de face, la case où ranger en couleur`} viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W} style={{ flexShrink: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      {portant && Array.from({ length: nr }, (_, r) => <line key={'b' + r} x1={pad} x2={W - pad} y1={pad + r * ch + 2} y2={pad + r * ch + 2} stroke={C.muted} strokeWidth="2" />)}
      {table && <><rect x={pad} y={pad + 6 + ch} width={iw} height="5" rx="1.5" fill={C.muted} fillOpacity="0.7" /><rect x={pad + 4} y={pad + 11 + ch} width="4" height={H - pad - 11 - ch - 4} fill={C.muted} fillOpacity="0.55" /><rect x={W - pad - 8} y={pad + 11 + ch} width="4" height={H - pad - 11 - ch - 4} fill={C.muted} fillOpacity="0.55" /></>}
      {!table && !portant && <rect x={pad} y={pad} width={iw} height={ih} fill="none" stroke={C.muted} strokeOpacity="0.6" strokeWidth="1.5" rx="2" />}
      {cases}
    </svg>
  );
}

function RangerSheet({ paires, cellNom, onPick, onLibre, onClose, apercu }) {
  const [q, setQ] = React.useState('');
  const f = q.trim().toLowerCase();
  const liste = !f ? paires : paires.filter(p =>
    String(p.numero).includes(f) || (p.title || '').toLowerCase().includes(f) || String(p.taille || '').toLowerCase().includes(f));
  return (
    <SheetShell onClose={onClose}>
      <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:apercu?6:0}}>
        {apercu && <ApercuMeuble {...apercu} />}
        <div style={{flex:1,minWidth:0}}>
      <div className="vrm-display" style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:2}}>Ranger un article</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.45}}>
        {cellNom ? <>Case <b style={{color:C.text}}>{cellNom}</b> · </> : null}
        {paires.length} article{paires.length>1?'s':''} pas encore rangé{paires.length>1?'s':''}
        {/* ⚠️ On ne fait pas semblant de savoir : quand l'écran Annonces n'a
            pas encore publié la liste des paires présentes, cette liste
            contient tout l'historique. On l'écrit, et on met les plus
            récentes en tête plutôt que de trier par numéro. */}
        {paires.length > 0 && !paires[0].sur && (
          <><br/><span style={{color:C.warn}}>Ouvre Annonces une fois pour ne garder que ton stock.</span></>
        )}
      </div>
        </div>
      </div>
      {paires.length > 6 && (
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder={`N°, marque, ${motTaille(vendActuel()).toLowerCase()}…`} inputMode="search"
          style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',fontSize:15,background:C.card,color:C.text,outline:'none',fontFamily:'inherit',marginBottom:10}}/>
      )}
      {liste.length === 0 && (
        <div style={{fontSize:13,color:C.muted,padding:'14px 2px',lineHeight:1.5}}>
          {paires.length === 0
            ? "Tout ton stock est déjà rangé."
            : "Rien ne correspond à cette recherche."}
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:7,maxHeight:'46vh',overflowY:'auto'}}>
        {liste.slice(0, 200).map(p => (
          <button type="button" key={p.numero} onClick={()=>onPick(p)}
            style={{display:'flex',alignItems:'center',gap:11,textAlign:'left',border:`1px solid ${C.border}`,borderRadius:12,background:C.card,padding:'9px 11px',cursor:'pointer',fontFamily:'inherit',boxShadow:C.shadow}}>
            {p.photo
              ? <PhotoVinted src={p.photo} alt="" style={{width:44,height:44,borderRadius:12,objectFit:'cover',flexShrink:0,background:C.card2}}/>
              : <span style={{width:44,height:44,borderRadius:12,background:C.card2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
            <span style={{flex:'1 1 120px',minWidth:0}}>
              <span className="vrm-display" style={{display:'block',fontSize:15,fontWeight:700,color:C.accentTexte}}>N°{p.numero}</span>
              <span style={{display:'block',fontSize:12,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title || '—'}</span>
              {p.taille ? <span className="vrm-label" style={{color:C.muted}}>{motTaille(vendActuel())} {p.taille}</span> : null}
            </span>
            <span style={{flexShrink:0,color:C.muted}}><Icon name="home" size={17}/></span>
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <Bouton variante="discret" onClick={onClose} style={{flex:1}}>Annuler</Bouton>
        <Bouton variante="secondaire" onClick={onLibre} style={{flex:1}}>Autre numéro…</Bouton>
      </div>
    </SheetShell>
  );
}
// ⟦← App.jsx #8⟧
const trancherGesteHL = async (ids, choix) => {
  const owner = AUTH.user?.id; if (!owner) return;
  let mien = false;
  for (const id of [].concat(ids)) {
    const g = await trancherRegistre(stockGestes(), owner, id, choix);
    if (g && choix === 'mien') { poserLocalHL(g.k, g.chemin, g.apres); mien = true; }
  }
  await rafraichirGestesHL();
  if (mien) rejouerGestesBientot(0);
};
// ⟦← App.jsx #9⟧
// (28 oct.) Les gestes LONGS sur Vinted (recréer, passer en brouillon, refaire,
// mettre un brouillon en ligne, modifier) : « pas de réponse à temps » n'est PAS
// « pas fait ». L'extension a pu supprimer, créer ou publier pendant que l'app
// attendait (file Vinted occupée, photos lentes) — dire « échec » faisait
// relancer une annonce peut-être déjà traitée. Trois issues, jamais deux :
// la réponse · `{ envoye: false }` (aucune extension ici : rien n'est parti) ·
// `{ sansReponse: true }` (envoyée, pas de réponse : PAS SU).
const TEXTE_SANS_REPONSE = "l'extension n'a pas répondu à temps : elle a peut-être fini. Regarde l'annonce sur Vinted avant de relancer";
const attenteGeste = (ms) => { const f = typeof window !== 'undefined' && window.__VRM_ATTENTE_GESTE; return Number.isFinite(f) && f > 0 ? f : ms; };
async function vmrCmdSuivi(p, timeoutMs) {
  if (!vmrExtPresent()) return { accepte: false, envoye: false, raison: "l'extension ne répond pas dans ce navigateur : rien n'est parti" };
  let r = null; try { r = await vmrCmd(p, attenteGeste(timeoutMs)); } catch (_) { r = null; }
  return r || { sansReponse: true };
}
// ⟦← App.jsx #10⟧
const recouvreTampon = (zones, b) => (zones || []).some((z) => b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y);
// ⟦← App.jsx #11⟧
const CAP_PRIX_SITE = { vinted: 'baisseprix', leboncoin: 'lbcprix', vestiaire: 'vcprix' };
// Une extension qui sait relever les prix en attente est-elle CONNUE ? Celle de ce navigateur (le pont),
// ou celle de l'ordinateur (son battement `relais_ext`, lu à l'ouverture de la feuille). « Pas su » ⇒ non.
const extensionSaitAttendre = () => {
  if (extSait('prixattente') === 'ok') return true;
  const r = __relais;
  return !!(r && r.ver && /^\d+\.\d+\.\d+$/.test(r.ver) && cmpVersion(r.ver, EXT_CAPACITES.prixattente) >= 0);
};
const envoisPrixVrm = (num) => envoisPrix({ appelEbay: (c) => appelEbay(c), resultatReviseEbay: (x) => resultatReviseEbay(x), corpsCompteEbay: (c) => corpsCompteEbay(c), vmrCmdSuivi: (p, t) => vmrCmdSuivi(p, t), sansReponse: TEXTE_SANS_REPONSE,
  ici: (site) => extSait(CAP_PRIX_SITE[site]) === 'ok',
  saitAttendre: extensionSaitAttendre,
  // (20 nov., décision de Julien) Plus de baisse rangée par l'app (`cmd_prix_*`) : sur Vinted, Leboncoin et Vestiaire le prix
  // se change dans le panneau de l'extension. Seul eBay part de la feuille.
  deposer: async () => null });
// ⟦← App.jsx #12⟧
// La feuille « Changer le prix » d'un N° : ses sites (par identité), les baisses qui attendent déjà
// pour CES annonces (lues dans sa base), les recettes Leboncoin / Vestiaire (apprise ou non).
function HotePrixPartout({ num, numData, comptes, extra, onFermer, focusPrix = false }) {
  const [att, setAtt] = useState(undefined);            // undefined en cours · null pas su · [] lu
  const [recettes, setRecettes] = useState(null);       // { leboncoin, vestiaire } : true · false · null (pas su)
  const [sait, setSait] = useState(() => extensionSaitAttendre());   // une extension qui relève les prix en attente est-elle connue ?
  const [formats, setFormats] = useState(null);         // { [idVinted]: true (format appris) | false } · null (pas su)
  const { rn } = rechercheParNumero(num, numData, comptes);
  const ex = extra && extra.num === num ? extra : null;
  const lecture = !numData || !ex;
  const { sites, manques } = rn.etat === 'invalide' ? { sites: [], manques: [] } : sitesPrixDe(num, rn, ex ? { ...ex, recettes, formats } : { lbcItems: undefined, vcItems: undefined, formats });
  // Le « format appris » de chaque annonce Vinted de ce N° (`vrm_vinted_modele`, une date par annonce, jamais le corps : §4.4).
  const idsVinted = ((rn && rn.annonces) || []).map((a) => String(a.id)).filter((x) => /^\d{4,15}$/.test(x)).slice(0, 12).join(',');
  useEffect(() => {
    if (!idsVinted) return undefined;
    let vivant = true;
    (async () => {
      try {
        const ids = idsVinted.split(',');
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_vinted_modele&select=${ids.map((id, i) => `f${i}:data->"${id}"->>at`).join(',')}`, { headers: sbAuth(), cache: 'no-store' });
        if (!r.ok) return;
        const rows = await r.json();
        if (!vivant || !Array.isArray(rows)) return;
        const l = rows[0] || {};
        setFormats(Object.fromEntries(ids.map((id, i) => [id, !!l['f' + i]])));
      } catch (_) {}
    })();
    return () => { vivant = false; };
  }, [idsVinted]);
  const sitesVus = lecture ? sites.filter((x) => x.site === 'vinted' || x.site === 'ebay') : sites;
  const cles = sitesVus.filter((x) => x.site !== 'ebay').map((x) => x.cle).join(',');
  const relire = React.useCallback(async () => {
    if (!cles) { setAtt([]); return; }
    setAtt(await lirePrixAttente(depPrixAttente(), cles.split(',')));
  }, [cles]);
  useEffect(() => { relire(); }, [relire]);
  useEffect(() => {
    let vivant = true;
    if (extSait('prixattente') !== 'ok') lireRelais().then(() => { if (vivant) setSait(extensionSaitAttendre()); }).catch(() => {});
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=in.(lbc_prix_recette,vc_prix_recette)&select=id,appris:data->appris`, { headers: sbAuth() });
        if (!r.ok) return;
        const rows = await r.json();
        if (!vivant || !Array.isArray(rows)) return;
        const de = (id) => { const l = rows.find((x) => x && x.id === id); return l ? l.appris === true : false; };
        setRecettes({ leboncoin: de('lbc_prix_recette'), vestiaire: de('vc_prix_recette') });
      } catch (_) {}
    })();
    return () => { vivant = false; };
  }, []);
  // Tant qu'une baisse attend ou est prise : relue toutes les 20 s (page visible), et au signe de l'extension.
  const enCours = Array.isArray(att) && att.some((v) => v.etat === 'attente' || v.etat === 'pris');
  useEffect(() => {
    const maj = () => relire();
    window.addEventListener('vrm:prix-attente', maj);
    const t = enCours ? setInterval(() => { if (!document.hidden) relire(); }, 20000) : null;
    return () => { window.removeEventListener('vrm:prix-attente', maj); if (t) clearInterval(t); };
  }, [enCours, relire]);
  const reglageP = load(CLE_PRIX_PARTOUT, null);
  const libelles = load('vinted_account_labels', {}) || {};
  const compteDe = (uid) => { const a = (comptes || []).find((x) => String(x.vinted_user_id) === String(uid)); return a ? (libelles[a.vinted_user_id] || a.login || `#${a.vinted_user_id}`) : ''; };
  // (19 nov., décision 1) La baisse par règle, réglée par compte Vinted de CE N° (éteinte par défaut, SON toucher).
  const [regles, setRegles] = useState(() => load(REGLE_CLE, null));
  const comptesRegle = [...new Set(sitesVus.filter((x) => x.site === 'vinted' && /^\d{1,20}$/.test(String(x.compte || ''))).map((x) => String(x.compte)))]
    .map((uid) => ({ uid, nom: compteDe(uid), ...regleDuCompte(regles, uid) }))
    // (19 nov., ext. 5.409) …et par compte LEBONCOIN de ce N° (`lbc:{compte}`, la même règle ; l'extension la lit dans
    // `regleBaisseLbcTick` et passe par `baisserPrixLbc`). Vestiaire (20 nov., 5.410) : la règle se règle dans Automatisations.
    .concat([...new Set(sitesVus.filter((x) => x.site === 'leboncoin' && x.compte).map((x) => 'lbc:' + String(x.compte).replace(/^lbc-account:/i, '')))]
      .filter((k) => /^lbc:[\w:.-]{1,80}$/.test(k)).map((uid) => ({ uid, nom: 'Leboncoin', ...regleDuCompte(regles, uid) })));
  const onRegle = null;   // (20 nov.) la baisse par règle se règle dans l'extension ; la feuille en dit l'état
  return <PrixPartout key={num} num={rn.cle || num} focusPrix={focusPrix} sites={sitesVus} manques={lecture ? [] : manques} lecture={lecture} regles={comptesRegle} onRegle={onRegle}
    onFermer={onFermer} prixDe={(site, p) => prixParSite(site, p, reglageP)} attentes={att} saitAttendre={sait} compteDe={compteDe} dire={(t, sorte) => toast(t, sorte)}
    onAnnuler={async (v) => { const ok = await annulerPrixAttente(depPrixAttente(), v.id); __prixSuivis.delete(v.id); await relire(); return ok; }}
    onAppliquer={async ({ coches, prix, surEtat, gardeConfirme }) => {
      const r = await appliquerPrix({ sites: sitesVus, coches, prix, envoyer: envoisPrixVrm(String(rn.cle || num)), surEtat, reglage: reglageP, gardeConfirme });
      if (r.res) save('vrm_prix_journal', noterJournalPrix(load('vrm_prix_journal', {}) || {}, rn.cle, r.prix, sitesVus, r.res));
      relire();
      return r;
    }}/>;
}
// ⟦← App.jsx #13⟧
const texteValeurHL = (g, v) => {
  if (v === undefined || v === null || v === '' || v === false) return tr('horsligne.feuille.sansValeur');
  if (v === true) return '✓';
  if (typeof v === 'object') {
    if (g.quoi === 'achat') return [v.title, v.price != null && v.price !== '' ? `${String(v.price).replace('.', ',')} €` : null, v.numero ? `N°${v.numero}` : null].filter(Boolean).join(' · ') || tr('horsligne.feuille.sansValeur');
    return Object.entries(v).filter(([, x]) => x != null && typeof x !== 'object').map(([c, x]) => `${c} : ${x}`).join(' · ').slice(0, 120);
  }
  if (g.quoi === 'prix') return `${String(v).replace('.', ',')} €`;
  if (/^\d{4}-\d\d-\d\dT/.test(String(v))) return '✓';
  return String(v).slice(0, 140);
};
const sujetHL = (g) => {
  const quoi = tr('horsligne.quoi.' + (g.quoi || 'fiche'));
  const s0 = g.chemin && g.chemin[0];
  const id = typeof s0 === 'string' ? s0 : s0 && s0.id != null ? '' : s0 && s0.el != null ? String(s0.el) : '';
  if (g.quoi === 'prix' && id) return `${quoi} · N°${id}`;
  if (g.k === 'vinted_annonce_numeros' && g.chemin[1] === 'numero') return `N° · ${quoi}`;
  return quoi;
};
// Le geste qui parle pour son groupe : le prix ou le N° d'une fiche (pas sa date), sinon le premier.
const principalHL = (gr) => gr.find((g) => g.k === 'vinted_annonce_numeros' && ['buyPrice', 'numero'].includes(g.chemin && g.chemin[1])) || gr[0];
const sujetGroupeHL = (g) => {
  if (g.k === 'vinted_annonce_numeros' && g.chemin && g.chemin[1] === 'buyPrice') {
    let n = ''; try { n = String(((load('vinted_annonce_numeros', {}) || {})[g.chemin[0]] || {}).numero || ''); } catch (_) { n = ''; }
    return tr('horsligne.quoi.prix') + (n ? ` · N°${n}` : '');
  }
  return sujetHL(g);
};
const valeurGroupeHL = (g, v) => (g.k === 'vinted_annonce_numeros' && g.chemin && g.chemin[1] === 'buyPrice' && v != null && v !== '' ? `${String(v).replace('.', ',')} €` : texteValeurHL(g, v));
function FeuilleGestesHL({ onFermer }) {
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const f = () => maj(); window.addEventListener('vrm:gestes-hl', f); rafraichirGestesHL(); return () => window.removeEventListener('vrm:gestes-hl', f); }, []);
  const liste = (_gestesHL.owner === AUTH.user?.id ? _gestesHL.liste : []) || [];
  const atr = groupesGestesHL(liste, 'atrancher'), att = groupesGestesHL(liste, 'attente').sort((a, b) => a[0].seq - b[0].seq);
  return (
    <SheetShell onClose={onFermer} z={Z_CONFIRMATION}>
      <div data-gestes-hl-feuille="" style={{ padding: '6px 4px 18px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>{tr('horsligne.feuille.titre')}</h2>
        {!atr.length && !att.length ? <p style={{ color: C.muted, fontSize: 13 }}>{tr('horsligne.feuille.vide')}</p> : null}
        {atr.length ? <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '6px 0 8px' }}>{tr('horsligne.feuille.atrancher')}</h3> : null}
        {atr.map((gr) => { const g = principalHL(gr), ids = gr.map((x) => x.id); return (
          <div key={g.id} data-geste-atrancher={g.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, background: C.card }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>{sujetGroupeHL(g)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 15, lineHeight: 1.4 }}>
              <span style={{ color: C.muted }}>{tr('horsligne.feuille.ici')}</span><span data-geste-mien="" style={{ color: C.text, overflowWrap: 'anywhere' }}>{valeurGroupeHL(g, g.apres)}</span>
              <span style={{ color: C.muted }}>{tr('horsligne.feuille.ailleurs')}</span><span data-geste-autre="" style={{ color: C.text, overflowWrap: 'anywhere' }}>{valeurGroupeHL(g, g.nuage)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Bouton variante="secondaire" data-geste-garder="mien" onClick={() => trancherGesteHL(ids, 'mien')} style={{ minHeight: 44 }}>{tr('horsligne.feuille.garderMienne')}</Bouton>
              <Bouton variante="secondaire" data-geste-garder="autre" onClick={() => trancherGesteHL(ids, 'autre')} style={{ minHeight: 44 }}>{tr('horsligne.feuille.garderAutre')}</Bouton>
            </div>
          </div>
        ); })}
        {att.length ? <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '12px 0 8px' }}>{tr('horsligne.feuille.attente')}</h3> : null}
        {att.map((gr) => { const g = principalHL(gr); return (
          <div key={g.id} data-geste-attente={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${C.border}`, padding: '10px 2px', fontSize: 15 }}>
            <span style={{ color: C.text }}>{sujetGroupeHL(g)}</span>
            <span style={{ color: C.muted, textAlign: 'right', overflowWrap: 'anywhere' }}>{g.ligne ? '✓' : valeurGroupeHL(g, g.apres)}</span>
          </div>
        ); })}
      </div>
    </SheetShell>
  );
}
// ⟦← App.jsx #14⟧
// (20 nov., Julien : « un parcours de 5 minutes ») « BIEN DÉMARRER » (src/parcoursNouveau/Demarrage.jsx) : un sommaire
// et six pages poussées, style Paramètres. Les preuves EN DIRECT, relues toutes les 5 s pendant qu'une page attend :
//   · l'extension — la règle de la page « Extension » (`etatNavigateur`, src/extension/peutFaire.js) sur les faits
//     de CE navigateur (`faitsExtensionApp`), qui changent dès que le pont répond (`useExtVivante`) ;
//   · les comptes captés — `fetchVintedAccounts` (Vinted), `useComptesAutresSites` (Leboncoin, Vestiaire, eBay) ;
//   · la méthode d'étiquetage — les trois clés de src/etiquetage/methode.js (`EtiquetageReglage`, le même écran
//     que Paramètres → Stock, qui n'écrit QUE ces clés) ;
//   · le premier import — `import_vinted_{uid}` (`lireImportDepart`, lu, jamais deviné).
// Écritures : la position (`vrm_parcours_nouveau`), ses sites, sa méthode d'étiquetage — sur SES gestes, par `save`.
const Demarrage = aLaDemande(() => import('../parcoursNouveau/Demarrage.jsx'));
const EtiquetageReglageParcours = aLaDemande(() => import('../etiquetage/EtiquetageReglage.jsx'));
const CLES_ETIQUETAGE_PN = ['vrm_numero_ecrit', 'vrm_num_prefixe', 'vrm_etiquetage'];
const lireEtiquetagePN = () => ({ numeroEcrit: load('vrm_numero_ecrit', null), prefixe: load('vrm_num_prefixe', ''), etiquetage: load('vrm_etiquetage', null) });
const ecrireEtiquetagePN = (ecritures) => Promise.all((ecritures || []).filter((w) => CLES_ETIQUETAGE_PN.includes(w.cle)).map((w) => new Promise((res) => {
  if (w.cle === 'vrm_num_prefixe' && !ecrireCopieLocale('vrm_num_prefixe', w.valeur)) { res(false); return; }
  save(w.cle, w.valeur, (ok) => res(ok !== false));
  try { window.dispatchEvent(new Event(w.cle === 'vrm_num_prefixe' ? 'vrm-prefixe' : w.cle === 'vrm_numero_ecrit' ? 'vrm-numero-ecrit' : 'vrm-etiquetage')); } catch (_) {}
}))).then((r) => r.every(Boolean));
function ParcoursNouveauApp({ comptes, onFermer, etapeForcee = null }) {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || [CLE_PARCOURS_NOUVEAU, CLE_PLATEFORMES, ...CLES_ETIQUETAGE_PN].includes(k)) maj(); };
    window.addEventListener('vrm:save', f);
    const off = onCloudReady(maj);
    return () => { window.removeEventListener('vrm:save', f); if (typeof off === 'function') off(); };
  }, []);
  const sansSouris = useSansSouris();
  useExtVivante();
  const pret = isCloudReady();
  const pos = pret ? lireParcoursNouveau(load(CLE_PARCOURS_NOUVEAU, null)) : null;
  // Ouvert à SON étape (reprise) ; jamais commencé ⇒ le sommaire. `etapeForcee` 'sommaire' : depuis Paramètres.
  const forcee = ETAPES_NOUVEAU.includes(etapeForcee) ? etapeForcee : null;
  const [ici, setIci] = React.useState(() => (etapeForcee ? forcee : (pos && pos.vues && pos.vues.length ? pos.etape : null)));
  React.useEffect(() => { if (etapeForcee) setIci(forcee); }, [etapeForcee]); // eslint-disable-line react-hooks/exhaustive-deps
  // Relire pendant qu'une page attend une preuve (extension, comptes, import) : toutes les 5 s, page visible.
  const [tour, setTour] = React.useState(0);
  const attend = ici === 'extension' || ici === 'comptes' || ici === 'historique' || ici === null || ici === 'pret';
  React.useEffect(() => {
    if (!attend) return undefined;
    const pousse = () => { if (document.visibilityState === 'visible') setTour((t) => t + 1); };
    const t = setInterval(pousse, 5000);
    window.addEventListener('focus', pousse); document.addEventListener('visibilitychange', pousse);
    return () => { clearInterval(t); window.removeEventListener('focus', pousse); document.removeEventListener('visibilitychange', pousse); };
  }, [attend]);
  const { etat: arrivee } = useParcoursArrivee({ comptes, actif: true, tour });
  const [vinted, setVinted] = React.useState(() => (Array.isArray(comptes) ? comptes : undefined));
  React.useEffect(() => {
    if (!tour) return undefined;
    let mort = false;
    fetchVintedAccounts().then((r) => { if (!mort) setVinted(Array.isArray(r) ? r : null); }).catch(() => { if (!mort) setVinted(null); });
    return () => { mort = true; };
  }, [tour]);
  const [autres, relireAutres] = useComptesAutresSites(true);
  React.useEffect(() => { if (tour && ici === 'comptes') relireAutres(); }, [tour]); // eslint-disable-line react-hooks/exhaustive-deps
  const [imports, setImports] = React.useState(undefined);
  const listeVinted = Array.isArray(vinted) ? vinted : (Array.isArray(comptes) ? comptes : vinted);
  const uids = (Array.isArray(listeVinted) ? listeVinted : []).map((a) => String((a && a.vinted_user_id) || '')).filter(Boolean).join(',');
  React.useEffect(() => {
    let mort = false;
    lireImportDepart(uids ? uids.split(',') : [], (q) => lireTout(q)).then((r) => { if (!mort) setImports(r); }).catch(() => { if (!mort) setImports(null); });
    return () => { mort = true; };
  }, [uids, ici, tour]);
  const plateformes = pret ? lirePlateformes(load(CLE_PLATEFORMES, null)) : undefined;
  const numerotation = pret ? load(CLE_NUMERO_ECRIT, null) : undefined;
  const etats = etatsParcoursNouveau({ session: !!(AUTH.user && AUTH.user.id), plateformes, arrivee, numerotation, imports, etiquetage: pret ? lireEtiquetagePN() : undefined });
  const navExt = (() => { try { return etatNavigateurPN(faitsExtensionApp(sansSouris)); } catch (_) { return null; } })();
  const ext = etatExtensionDirect(navExt, etats.extension);
  const sites = plateformes && plateformes.sites && plateformes.sites.length ? plateformes.sites : ['vinted'];
  const captes = comptesCaptes(sites, {
    vinted: Array.isArray(listeVinted) ? listeVinted.map((a) => ({ nom: (a && (a.login || a.username)) || '' })) : listeVinted,
    leboncoin: autres ? autres.leboncoin : undefined, vestiaire: autres ? autres.vestiaire : undefined, ebay: autres ? autres.ebay : undefined,
  });
  const etatsVus = { ...etats, extension: ext, comptes: { etat: sites.every((s) => captes[s] && captes[s].etat === 'fait') ? 'fait' : sites.some((s) => captes[s] && captes[s].etat === 'encours') ? 'encours' : 'afaire' } };
  const ranger = (geste, etape) => save(CLE_PARCOURS_NOUVEAU, positionParcoursNouveau(load(CLE_PARCOURS_NOUVEAU, null), geste, { etape }));
  const aller = (e) => {
    if (e === null) { setIci(null); return; }
    if (!ETAPES_NOUVEAU.includes(e)) return;
    setIci(e); ranger('aller', e); try { window.dispatchEvent(new Event('vrm:parcours')); } catch (_) {}
  };
  const ecrire = (cle, v) => new Promise((res) => save(cle, v, (ok) => res(ok !== false)));
  const prenom = String(load('vrm_prenom', '') || '').trim().slice(0, 30);
  const fermerPlusTard = () => { ranger('plusTard'); if (onFermer) onFermer('plusTard'); };
  const allerAilleurs = (url) => { ranger('aller', ici || 'plateformes'); if (onFermer) onFermer('plusTard'); try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: url })); } catch (_) {} };
  return <><FermeAuRetour fermer={() => { if (ici) setIci(null); else fermerPlusTard(); }}/>
    <Suspense fallback={null}><Demarrage etape={ici} etats={etatsVus} ext={ext} navExt={navExt} inst={installationIci({ liens: LIENS_BOUTIQUES })} pageExt={NAV.pageExt || ''}
      captes={captes} sites={sites} telephone={!!sansSouris} prenom={prenom}
      plateformesDepart={plateformes && plateformes.sites ? plateformes.sites : []}
      etiquetage={ici === 'etiquetage' ? <Suspense fallback={null}><EtiquetageReglageParcours lire={lireEtiquetagePN} archive={archiveNumeros()} ecrire={ecrireEtiquetagePN}/></Suspense> : null}
      onAller={aller}
      onPlusTard={fermerPlusTard}
      onFin={() => { save(CLE_PARCOURS_NOUVEAU, positionParcoursNouveau(load(CLE_PARCOURS_NOUVEAU, null), 'fin')); if (onFermer) onFermer('fin'); }}
      onChoisirPlateformes={(s) => { const v = reglagePlateformes(s); return v ? ecrire(CLE_PLATEFORMES, v) : Promise.resolve(false); }}
      onBrancher={navExt && navExt.geste === 'brancher' ? () => { brancherExtensionApp(); setTimeout(() => setTour((t) => t + 1), 1500); } : null}
      onExemple={bacASableEtape() ? null : () => entrerModeExemple()}
      onEbay={() => allerAilleurs('?tab=plat_ebay&section=compte')}
      onDetailsExtension={() => { ranger('aller', ici || 'extension'); if (onFermer) onFermer('plusTard'); setTimeout(ouvrirPageExtension, 0); }}
    /></Suspense></>;
}
// ⟦← App.jsx #15⟧
// ⟦→ ecrans/Vestiaire.jsx #8⟧
// ══════════════════════════════════════════════════════════════════════════════
// UN SEUL N° POUR UN ARTICLE SUR VINTED ET VESTIAIRE (3 nov.) — src/lienVestiaire.js
// ══════════════════════════════════════════════════════════════════════════════
// « Relier » sur une annonce Vestiaire (vers un article Vinted) ou sur une fiche
// Vinted (vers une annonce Vestiaire) : l'événement `vrm:lien-vc` ouvre UNE
// feuille (`HoteLienVc`, monté dans AppCoeur). Suggestions par ressemblance
// (marque + taille, couleur ; jamais la photo), mais SON toucher seul relie (§5).
// Le N° qui reste est celui de l'annonce Vinted (déjà sur le carton) ; celui que
// VRM avait donné à l'annonce Vestiaire reste servi (jamais redonné) et passe
// dans « N° à barrer » jusqu'à « C'est écrit ». Défaire rend l'état d'avant.
const PhotoLienVc = ({ src }) => (/vestiairecollective\./i.test(String(src || ''))
  ? <PhotoVc src={src} style={{ width: '100%', height: '100%' }}/>
  : <PhotoVinted src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>);
const REFUS_LIEN_VC = { identite: 'Article illisible — rien n’est relié', 'sans-numero': 'L’article Vinted n’a pas encore de N° — rien n’est relié', 'deja-relie': 'Déjà relié', 'vinted-deja-relie': 'Cet article Vinted est déjà relié à une autre annonce Vestiaire' };
// Relier (sur SON toucher, confirmé). `productId` Vestiaire, `item` + `numVinted` Vinted.
async function relierVc({ productId, item, numVinted, titre }) {
  if (!isCloudReady()) { toast('Tes données ne sont pas encore chargées — réessaie dans un instant'); return false; }
  const liens = vcCarte('vrm_vc_liens');
  const numVc = carteNumerosVc(vcCarte('vrm_vc_numeros'))[String(productId)] || '';
  const r = poserLienVc({ liens, productId, item, numeroVinted: numVinted, numeroVc: numVc, cleNum });
  if (r.refus) { toast(REFUS_LIEN_VC[r.refus] || 'Rien n’est relié'); return false; }
  const de = r.liens[String(productId)].de;
  const ok = await askConfirm({ title: `Un seul N° : N°${numVinted}`, desc: [titre ? `« ${String(titre).slice(0, 60)} »` : '', de ? `N°${de} → N°${numVinted} là où l’article est rangé.` : ''].filter(Boolean).join('\n'), ok: 'Relier', cancel: 'Annuler' });
  if (!ok) return false;
  vcPoser('vrm_vc_liens', poserLienVc({ liens: vcCarte('vrm_vc_liens'), productId, item, numeroVinted: numVinted, numeroVc: numVc, cleNum }).liens || vcCarte('vrm_vc_liens'));
  toast(de ? `Relié · N°${numVinted} · barre le N°${de}` : `Relié · N°${numVinted}`);
  return true;
}
// ⟦← App.jsx #16⟧
// La feuille ouverte : candidats Vinted (sens 'vc') ou Vestiaire (sens 'vinted').
function LienVcOuvert({ cible, comptes, onFermer }) {
  const vcLoc = useVcLocal();
  const { paires, pret } = useEbayPaires(cible.sens === 'vc' ? comptes : null);
  const [vc, setVc] = React.useState(undefined);   // undefined en cours · null pas su · { items, liens }
  React.useEffect(() => {
    if (cible.sens !== 'vinted') return undefined;
    let vivant = true;
    (async () => {
      const r = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt`);
      if (!vivant) return;
      if (!Array.isArray(r)) { setVc(null); return; }
      const x = r[0] || {};
      setVc({ items: (x.items && typeof x.items === 'object') ? x.items : {}, liens: (x.liens && typeof x.liens === 'object') ? x.liens : {}, capturedAt: x.capturedAt || '' });
    })();
    return () => { vivant = false; };
  }, [cible.sens]);
  let candidats = [], lecture = false, panne = false;
  if (cible.sens === 'vc') {
    lecture = !pret;
    const pris = new Set(Object.values(vcLoc.liens || {}).map((e) => String((e && e.item) || '')));
    candidats = (paires || []).filter((p) => p.num && !pris.has(String(p.id))).map((p) => ({ id: p.id, num: p.num, titre: p.title, photo: p.cover || '', marque: p.marque, taille: p.taille, couleur: p.couleur, detail: [p.marque, p.taille].filter(Boolean).join(' · ') }));
  } else {
    lecture = vc === undefined; panne = vc === null;
    if (vc) candidats = Object.entries(vc.items).filter(([id, it]) => it && typeof it === 'object'
      && vcReliable({ productId: id, item: it, liensPub: vc.liens, liens: vcLoc.liens, cleNum })
      && !['retiree', 'vendue'].includes(etatAnnonceVcBrut(it, false, vc.capturedAt)))
      .map(([id, it]) => ({ id, num: numVcAnnonce(id, it, vc.liens, vcLoc.auto), titre: it.titre || '', photo: it.photo || '', detail: it.prix && isFinite(Number(it.prix.valeur)) ? fmt(it.prix.valeur) : '' }));
  }
  const suggestions = React.useMemo(() => suggestionsLienVc({ cible, candidats, marqueDe: extractBrand, couleursDe: extractColors, modeleDe: extractModel }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [cible, candidats.length, lecture]);
  const onRelier = async (c) => {
    const fait = cible.sens === 'vc'
      ? await relierVc({ productId: cible.id, item: c.id, numVinted: c.num, titre: c.titre })
      : await relierVc({ productId: c.id, item: cible.id, numVinted: cible.num, titre: c.titre });
    if (fait) onFermer();
  };
  return <FeuilleLienVc cible={cible} candidats={candidats} suggestions={suggestions} lecture={lecture} panne={panne} onRelier={onRelier} onFermer={onFermer} Photo={PhotoLienVc}/>;
}
// ⟦→ ecrans/Comptabilite.jsx #226⟧
function HoteLienVc({ comptes }) {
  const [cible, setCible] = React.useState(null);
  React.useEffect(() => {
    // (19 nov.) Le sens inverse (« Relier à Vestiaire » depuis la fiche Vinted) : LE parcours « Relier mes annonces », sur Vestiaire,
    // cet article proposé en tête de chaque annonce (son N° tapé) — les mêmes gardes, SON toucher relie. L'ancienne feuille n'est plus ouverte.
    const f = (e) => { const d = e && e.detail; if (!d || d.sens !== 'vinted' || d.id == null) return; ouvrirLiaison({ site: 'Vestiaire', article: { id: String(d.id), numero: String(d.num || '') } }); };   // (19 nov.) sens 'vc' : le parcours « Relier mes annonces » (LiaisonCoque)
    window.addEventListener('vrm:lien-vc', f);
    return () => window.removeEventListener('vrm:lien-vc', f);
  }, []);
  if (!cible) return null;
  return <>{<FermeAuRetour fermer={() => setCible(null)}/>}<LienVcOuvert key={cible.sens + cible.id} cible={cible} comptes={comptes} onFermer={() => setCible(null)}/></>;
}
// ⟦← App.jsx #17⟧
// ══════════════════════════════════════════════════════════════════════════════
// PUBLIER PARTOUT — DEPUIS L'ANNONCE VINTED (11 nov., règle : src/publierPartout.js)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « Publier partout en un geste — mais ça doit PARTIR DE L'ANNONCE VINTED ».
// `nums` : les N° des annonces (une, ou la sélection d'Annonces → Actions). La paire
// est celle de la source partagée (`useEbayPaires`), EN LIGNE sur Vinted seulement ;
// « déjà en ligne ailleurs » par `sitesDuNumero` (identité, jamais un titre). Chaque
// site part par SA voie, l'un après l'autre : Leboncoin `lbcPublier` (+ la fiche,
// `valideAnnonceLbc`), Vestiaire `vcPreparer`, eBay un brouillon
// (`preparerBrouillonPartout`, jamais publié d'ici). Gardes de l'extension
// (compte de l'onglet, 50 actions/h, une requête à la fois) inchangées.
const ATTENTE_DEPOT_MS = 6 * 60000;
function attendreFinJob(jobId, ms = ATTENTE_DEPOT_MS) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const tic = () => {
      const j = __vmrJobs[jobId];
      const e = j && String(j.etape || '');
      if (e === 'fait' || e === 'abandonne' || e === 'echec') { ok({ etape: e, raison: (j && j.raison) || '' }); return; }
      if (Date.now() - t0 > ms) { ok({ etape: 'delai' }); return; }
      setTimeout(tic, 1500);
    };
    setTimeout(tic, 1500);
  });
}
// ⟦← App.jsx #18⟧
function HotePublierPartout({ comptes, nums, numData, onFermer }) {
  const { paires, pret } = useEbayPaires(comptes);
  useExtVivante();
  const sansSouris = useSansSouris();
  const [reglage, setReglage] = React.useState(() => reglagePrix(load(CLE_PRIX_PARTOUT, null)));
  const [saisies, setSaisies] = React.useState({});
  // (11 nov. soir) Les paramètres de publication par défaut (Leboncoin, Vestiaire) : '' = auto.
  const [params, setParams] = React.useState(() => reglageParams(load(CLE_PARAMS_PARTOUT, null), { etatsLbc: LBC_ETATS }));
  // (15 nov.) SES réponses aux correspondances, par catégorie Vinted (synchronisées) ; écrites sur SON clic seulement.
  const [memoire, setMemoire] = React.useState(() => lireCorrespondances(load(CLE_CORRESPONDANCES, null)));
  // Une extension qui porte catégorie et critères (5.381) — sinon Leboncoin les devinerait : la feuille le dit.
  const lbcCriteres = (relaisVivant() ? 'ok' : extSait('lbccriteres')) === 'ok';
  // (16 nov., lot plateformes-restes) Vestiaire : l'extension reçoit la catégorie choisie (`vcPreparer`, 5.399) et ne
  // la pose que si elle existe telle quelle dans le catalogue de dépôt capté ; sinon « à finir sur Vestiaire ».
  const vcCategorie = extSait('vccategorie') === 'ok';
  // Les listes Leboncoin et Vestiaire (pour « déjà en ligne ») : trois états.
  const [autres, setAutres] = React.useState(undefined);
  const relire = React.useCallback(async () => {
    try { oublierLbcSession(); } catch (_) {}
    const [lbc, vc] = await Promise.all([lbcListingsSession().catch(() => null),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens`).catch(() => null)]);
    const vcL = Array.isArray(vc) ? (vc[0] || {}) : null;
    setAutres({ lbcItems: lbc ? lbc.items || {} : null, lbcPubliees: lbc ? lbc.publiees || {} : null, vcItems: vcL ? (vcL.items || {}) : null, vcLiens: vcL ? (vcL.liens || {}) : {} });
  }, []);
  React.useEffect(() => { relire(); }, [relire]);
  const voulus = React.useMemo(() => [...new Set((nums || []).map((n) => cleNum(n)).filter(Boolean))], [nums]);
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const choisies = pret && Array.isArray(paires) ? voulus.map((k) => paires.find((p) => !p.chezMoi && cleNum(p.num) === k) || null).filter(Boolean) : undefined;
  const lecture = !numData || autres === undefined;
  const regles = { titreLbc: (m, t, ta) => lbcTitre(m, t, ta), titreVc: (m, t, ta) => lbcTitre(m, t, ta, 80), titreEbay: (t, ta) => ebayTitre(t || '', ta || ''),
    descriptionLbc: (o) => descriptionLbcDe(o), descriptionEbay: (pp) => (pp && pp.desc) || descriptionDeFaits(pp || {}),
    etatsLbc: LBC_ETATS, categorieLbc: (t, d, ta, m) => categorieLbcDe(t, d, ta, '', m),
    // La ville que la voie Leboncoin tape (Réglages de VRM) ; vide ⇒ celle de son profil Leboncoin.
    ville: String(load('vrm_ville', '') || '').trim() };
  const ext = {
    leboncoin: (raisonExtGlobale(sansSouris, { cap: 'publication', role: 'publie tes annonces' }) || {}).texte || '',
    vestiaire: (raisonExtGlobale(sansSouris, { cap: 'vcpublier', role: 'prépare tes annonces Vestiaire' }) || {}).texte || '',
    ebay: '',
  };
  const enLigneDe = (p) => {
    if (lecture) return { leboncoin: null, vestiaire: null, ebay: null };
    const { rn } = rechercheParNumero(String(p.num), numData, comptes);
    if (!rn || rn.etat === 'invalide') return { leboncoin: null, vestiaire: null, ebay: null };
    const r = sitesPrixDe(String(p.num), rn, autres);
    return { leboncoin: enLigneSur('leboncoin', r.sites, r.manques), vestiaire: enLigneSur('vestiaire', r.sites, r.manques), ebay: enLigneSur('ebay', r.sites, r.manques) };
  };
  const lignes = choisies === undefined ? undefined : choisies.map((p) => {
    const fiche = fiches[String(p.id)] || {};
    let achat = null; try { achat = prixAchatDe(fiche, load('vinted_buyprice_by_num', {}) || {}); } catch (_) { achat = null; }
    // Ce que la règle d'avant (la même dans l'extension) poserait d'elle-même, d'après le chemin Vinted connu.
    const t = p.catalogId != null ? TABLE_VINTED[String(p.catalogId)] : null;
    let categorieVoie = ''; try { categorieVoie = categorieLbcDe(p.title, p.desc, p.taille, t ? t.chemin : '', p.marque); } catch (_) { categorieVoie = ''; }
    return lignePartout(p, { enLigne: enLigneDe(p), ext, reglage, params, saisie: saisies[String(p.id)], regles, achat, memoire, lbcCriteres, vcCategorie, categorieVoie,
      famille: familleArticle({ titre: p.title, taille: p.taille, marque: p.marque }).famille, mpLbc: mpChoisi(fiche, 'lbc'), facultatifs: champsFacultatifs(vendActuel()) });
  });
  const vus = {};
  for (const l of lignes || []) for (const x of l.sites) if (x.deja === true) vus[l.id + ':' + x.site] = true;
  const parId = new Map((choisies || []).map((p) => [String(p.id), p]));
  // (20 nov., décision de Julien) Leboncoin et Vestiaire se publient dans le panneau de l'extension (la feuille montre
  // « Publier dans l'extension » sur leur case) : rien ne part d'ici. eBay : l'API serveur, comme avant.
  const refusSite = async () => refusPanneau(tr('actionsExt.refus'));
  const envoyer = {
    leboncoin: refusSite,
    vestiaire: refusSite,
    ebay: async (e) => {
      const p = parId.get(e.id); if (!p) return { accepte: false, code: 'absente', raison: 'annonce plus en ligne sur Vinted' };
      // (15 nov.) LA catégorie eBay qu'il a choisie (parmi celles qu'eBay propose) ; sans elle, aucune n'est devinée.
      const cat = e.corr && e.corr.valeurs && e.corr.valeurs.categorie ? e.corr.valeurs.categorie : null;
      try { const m = await import('./Ebay.jsx'); return await m.preparerBrouillonPartout(p, { prix: e.apercu.prix, titre: e.apercu.titre, categorie: cat }); }
      catch (_) { return { accepte: false, code: 'charge', raison: 'l’écran eBay n’a pas pu se charger — réessaie' }; }
    },
  };
  // Le lancement : le plan, le suivi commun (VRM figé, détail, barre — SuiviTravail, via
  // src/publierPartoutSuivi.js), puis l'envoi l'un après l'autre. « Mettre en pause » attend
  // ENTRE deux envois (`continuer()`), « Reprendre » repart d'où il en était.
  const lancer = async ({ coches, surEtat, surTotal }) => {
    const plan = planPartout(lignes || [], coches);
    if (typeof surTotal === 'function') surTotal(plan.length);
    const sv = suiviPourPartout(await chargerSuivi(), plan, { uid: String(vendActuel() || '') });
    const res = await executerPartout({ plan, envoyer, attendre: (j) => attendreFinJob(j),
      surEtat: (cle, e) => { surEtat(cle, e); if (sv) sv.surEtat(cle, e); }, doitSArreter: sv ? sv.doitSArreter : undefined });
    if (sv) sv.terminer();
    return res;
  };
  // (11 nov. soir) eBay : SES réglages de publication par défaut (lot ebay-complet, src/ebay/parametres.js) —
  // le brouillon les reprend à sa mise en ligne ; la feuille les nomme (« Offres · Retours 30 j »).
  let ebayReglages = [];
  try { ebayReglages = resumeReglagesEbayPP(defautsEbayDepuis(load(CLE_DEFAUTS_EBAY_PP, null))).map((x) => tr(x.cle, x.vars || {})); } catch (_) { ebayReglages = []; }
  return <PublierPartout lignes={lignes} lecture={lecture} reglage={reglage} params={params} etatsLbc={LBC_ETATS} saisies={saisies} vus={vus} ebayReglages={ebayReglages}
    exclues={choisies === undefined ? 0 : voulus.length - choisies.length}
    onReglage={(site, r) => setReglage((x) => { const n = reglagePrix({ ...x, [site]: r }); save(CLE_PRIX_PARTOUT, n); return n; })}
    onParam={(site, champ, val) => setParams((x) => { const n = reglageParams({ ...x, [site]: { ...((x && x[site]) || {}), [champ]: val } }, { etatsLbc: LBC_ETATS }); save(CLE_PARAMS_PARTOUT, n); return n; })}
    memoire={memoire}
    /* (15 nov.) SA réponse à une correspondance : pour CETTE annonce, et retenue pour sa catégorie Vinted. */
    onRepondre={(id, site, champ, val) => {
      setSaisies((x) => { const a = x[id] || {}; const c = a.corr || {}; return { ...x, [id]: { ...a, corr: { ...c, [site]: { ...(c[site] || {}), [champ]: val } } } }; });
      const p = parId.get(String(id));
      if (p && champ !== 'marque' && p.catalogId != null && p.catalogId !== '' && isCloudReady()) {
        const n = retenirCorrespondance(load(CLE_CORRESPONDANCES, null), p.catalogId, site, champ, val);
        save(CLE_CORRESPONDANCES, n); setMemoire(n);
      }
      if (p && site === 'leboncoin' && champ === 'marque' && p.marque && isCloudReady()) {
        const n = retenirCorrespondance(load(CLE_CORRESPONDANCES, null), p.catalogId, 'leboncoin', 'marque', { vinted: p.marque, libelle: val });
        save(CLE_CORRESPONDANCES, n); setMemoire(n);
      }
    }}
    /* Les catégories qu'eBay propose (API Taxonomy, sur SON jeton, lecture seule) : `null` = pas su. */
    onChercherEbay={async (q) => {
      try { const { j } = await appelEbay({ action: 'parametres', q: String(q || '').slice(0, 80) }); return j && j.ok && Array.isArray(j.categories) ? j.categories : null; } catch (_) { return null; }
    }}
    onParamAnnonce={(id, site, champ, val) => setSaisies((x) => { const a = x[id] || {}; const pr = a.params || {}; return { ...x, [id]: { ...a, params: { ...pr, [site]: { ...(pr[site] || {}), [champ]: val } } } }; })}
    onSaisie={(id, champ, val) => setSaisies((x) => {
      const a = x[id] || {};
      if (champ === 'prixSite' && val && typeof val === 'object') return { ...x, [id]: { ...a, prixSite: { ...(a.prixSite || {}), [val.site]: val.valeur } } };
      return { ...x, [id]: { ...a, [champ]: val } };
    })}
    onLancer={lancer}
    onRelire={relire} onFermer={onFermer} Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy"/>} Retour={FermeAuRetour}/>;
}
// ⟦← App.jsx #19⟧
function PlaceurTamponFeuille({ q, fin }) {
  const page = React.useRef(null), scene = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');           // charge · pret · ko
  const [geo, setGeo] = React.useState(null);                 // { W, H, ppt }
  const [auto, setAuto] = React.useState(null);               // { x, y, w, v } ou null (fiche)
  const [imgs, setImgs] = React.useState([]);                 // par variante : { url, cw, ch }
  const [codes, setCodes] = React.useState([]);
  const [boite, setBoite] = React.useState(null);             // { x, y, w, v } en points
  const [libre, setLibre] = React.useState(false);
  const [toujours, setToujours] = React.useState(true);
  const [raison, setRaison] = React.useState('');
  const etatRef = React.useRef({}); etatRef.current = { geo, boite, imgs };
  React.useEffect(() => {
    let vivant = true;
    (async () => {
      const PL = await import('pdf-lib');
      const doc = await PL.PDFDocument.load(q.octets);
      const pg = doc.getPages()[0], { w: W, h: H } = tailleAffichee(pg);
      const bold = await doc.embedFont(PL.StandardFonts.HelveticaBold), reg = await doc.embedFont(PL.StandardFonts.Helvetica);
      // Le cartouche de chaque variante, rendu par pdf.js (fond blanc compris).
      const images = [];
      for (let v = 0; v < CARTOUCHES.length; v++) {
        const d2 = await PL.PDFDocument.create(), b2 = await d2.embedFont(PL.StandardFonts.HelveticaBold), r2 = await d2.embedFont(PL.StandardFonts.Helvetica);
        const c = cartoucheLibre(b2, r2, q.numero, q.titre, v); if (!c) { images.push(null); continue; }
        const p2 = d2.addPage([c.w, c.h]); ecrireCartouche(PL, p2, c, 0, 0, 1, true);
        const cv = document.createElement('canvas'); await dessinerPdf(cv, await d2.save(), { largeur: c.w * 3 });
        images.push({ url: cv.toDataURL('image/png'), cw: c.w, ch: c.h });
      }
      const rendu = await rendrePremierePage(doc);
      const place = await chercherPlaceTampon(doc, bold, reg, q.numero, q.titre, rendu);
      const zones = zonesCodesTampon(rendu);
      const dispoW = Math.min(window.innerWidth - 48, 640), dispoH = Math.max(220, window.innerHeight - 300);
      const largeur = Math.max(160, Math.min(dispoW, dispoH * W / H));
      await dessinerPdf(page.current, q.octets, { largeur });
      if (!vivant) return;
      const a = place ? { x: place.x, y: place.y, w: place.c.w, v: place.v } : null;
      let b = null, lib = false;
      if (choixTamponValide(q.choix)) {
        const pl = placeLibreTampon(pg, bold, reg, q.numero, q.titre, q.choix);
        if (pl) { b = { x: pl.x, y: pl.y, w: pl.c.w * pl.k, v: q.choix.v | 0 }; lib = true; }
      }
      if (!b) b = a || (images[0] ? { x: Math.max(0, (W - images[0].cw) / 2), y: Math.max(0, (H - images[0].ch) / 2), w: Math.min(W, images[0].cw), v: 0 } : null);
      setGeo({ W, H, ppt: largeur / W }); setAuto(a); setImgs(images); setCodes(zones); setBoite(b); setLibre(lib); setEtat(b ? 'pret' : 'ko');
    })().catch((e) => { if (vivant) { setEtat('ko'); setRaison(String((e && e.message) || e).slice(0, 120)); } });
    return () => { vivant = false; };
  }, [q]);
  const img = boite && imgs[boite.v];
  const hDe = (b) => { const im = imgs[b.v]; return im ? b.w * im.ch / im.cw : 0; };
  // Bornes : dans la page, jamais plus petit que lisible (N° 9 pt, titre 5 pt).
  const borner = (b, { aimant = true } = {}) => {
    const { geo: g, imgs: ims } = etatRef.current; const im = ims[b.v]; if (!g || !im) return b;
    const wMax = Math.min(g.W, g.H * im.cw / im.ch), wMin = Math.min(wMax, im.cw * echelleMiniTampon(CARTOUCHES[b.v]));
    const w = Math.max(wMin, Math.min(wMax, b.w)), h = w * im.ch / im.cw;
    let x = Math.max(0, Math.min(g.W - w, b.x)), y = Math.max(0, Math.min(g.H - h, b.y));
    if (aimant) {   // aimantation douce : à 10 px d'un bord, il s'y colle
      const a = 10 / g.ppt;
      if (x < a) x = 0; else if (g.W - (x + w) < a) x = g.W - w;
      if (y < a) y = 0; else if (g.H - (y + h) < a) y = g.H - h;
    }
    return { ...b, x, y, w };
  };
  const pointeurs = React.useRef(new Map()), geste = React.useRef(null);
  const enPoints = (e) => { const r = page.current.getBoundingClientRect(), g = etatRef.current.geo; return { x: (e.clientX - r.left) / g.ppt, y: (e.clientY - r.top) / g.ppt }; };
  const bas = (e) => {
    const { geo: g, boite: b } = etatRef.current; if (!g || !b || etat !== 'pret') return;
    e.preventDefault();
    try { scene.current.setPointerCapture(e.pointerId); } catch (_) {}
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = enPoints(e), h = hDe(b);
    if (pointeurs.current.size >= 2) {
      const [u, v] = [...pointeurs.current.values()];
      geste.current = { type: 'pince', d0: Math.hypot(u.x - v.x, u.y - v.y) || 1, w0: b.w, cx: b.x + b.w / 2, cy: b.y + h / 2 };
      return;
    }
    if (e.target && e.target.closest && e.target.closest('[data-tampon-poignee]')) geste.current = { type: 'taille', x0: p.x, w0: b.w };
    else if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + h) geste.current = { type: 'glisse', dx: p.x - b.x, dy: p.y - b.y };
    else { geste.current = { type: 'glisse', dx: b.w / 2, dy: h / 2 }; setBoite(borner({ ...b, x: p.x - b.w / 2, y: p.y - h / 2 })); }
    setLibre(true);
  };
  const bouge = (e) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = geste.current, { boite: b } = etatRef.current; if (!G || !b) return;
    e.preventDefault();
    if (G.type === 'pince' && pointeurs.current.size >= 2) {
      const [u, v] = [...pointeurs.current.values()], w = G.w0 * (Math.hypot(u.x - v.x, u.y - v.y) / G.d0);
      const h = hDe({ ...b, w }); setBoite(borner({ ...b, w, x: G.cx - w / 2, y: G.cy - h / 2 }, { aimant: false }));
    } else if (G.type === 'taille') { const p = enPoints(e); setBoite(borner({ ...b, w: G.w0 + (p.x - G.x0) }, { aimant: false })); }
    else if (G.type === 'glisse') { const p = enPoints(e); setBoite(borner({ ...b, x: p.x - G.dx, y: p.y - G.dy })); }
  };
  const haut = (e) => { pointeurs.current.delete(e.pointerId); if (!pointeurs.current.size || (geste.current && geste.current.type === 'pince')) geste.current = null; };
  const clavier = (e) => {
    const b = etatRef.current.boite; if (!b) return;
    const pas = e.shiftKey ? 10 : 2, d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
    if (d) { e.preventDefault(); setLibre(true); setBoite(borner({ ...b, x: b.x + d[0], y: b.y + d[1] }, { aimant: false })); return; }
    if (e.key === '+' || e.key === '=' || e.key === '-') { e.preventDefault(); setLibre(true); setBoite(borner({ ...b, w: b.w * (e.key === '-' ? 1 / 1.06 : 1.06) }, { aimant: false })); }
  };
  const revenir = () => { setLibre(false); if (auto) setBoite(auto); };
  const choix = () => (libre && boite && geo ? { vx: boite.x / geo.W, vy: boite.y / geo.H, vw: boite.w / geo.W, v: boite.v } : null);
  const imprimer = () => fin({ choix: choix(), toujours });
  const fiche = !libre && !auto;
  const h = boite ? hDe(boite) : 0;
  const surCode = !!boite && !fiche && recouvreTampon(codes, { x: boite.x, y: boite.y, w: boite.w, h });
  const ppt = geo ? geo.ppt : 1;
  return createPortal(<div data-placeur-tampon={etat} data-raison={raison || undefined} data-forme={q.forme && q.forme.cle} data-noswipe="1" role="dialog" aria-modal="true" aria-label="Place du tampon"
      className="vrm-tampon-voile" style={{ zIndex: Z_CONFIRMATION }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); fin(null); } }}>
    <FermeAuRetour fermer={() => fin(null)}/>
    <div className="vrm-tampon-feuille" style={{ background: C.card, color: C.text }}>
      <div className="vrm-tampon-tete">
        <b>{(q.forme && q.forme.nom) || 'Bordereau'}</b>
        <Bouton variante="discret" icone="close" aria-label="Fermer" data-tampon-fermer="1" onClick={() => fin(null)}/>
      </div>
      <div className="vrm-tampon-zone">
        <div ref={scene} className="vrm-tampon-scene" data-tampon-scene="1" data-ppt={ppt.toFixed(4)}
             onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}>
          <canvas ref={page} className="vrm-tampon-page" data-stream-image="bordereau" aria-hidden="true"/>
          {etat === 'pret' && img && <div data-tampon-boite="1" data-libre={libre ? '1' : '0'} data-variante={boite.v}
              data-x={boite.x.toFixed(2)} data-y={boite.y.toFixed(2)} data-w={boite.w.toFixed(2)} data-h={h.toFixed(2)}
              tabIndex={0} role="slider" aria-label={`Tampon N° ${q.numero || ''}`} aria-valuetext={`${Math.round(boite.x)}, ${Math.round(boite.y)}`} onKeyDown={clavier}
              className={'vrm-tampon-boite' + (fiche ? ' vrm-tampon-fantome' : '')}
              style={{ left: boite.x * ppt, top: boite.y * ppt, width: boite.w * ppt, height: h * ppt }}>
            <img src={img.url} alt="" draggable={false}/>
            {!fiche && <span className="vrm-tampon-poignee" data-tampon-poignee="1" aria-hidden="true"><i/></span>}
          </div>}
        </div>
      </div>
      <div className="vrm-tampon-puces">
        {surCode && <span className="vrm-tampon-puce" data-tampon-code="1" style={{ color: C.warn, background: C.warnSoft }}>Recouvre le code-barres</span>}
        {fiche && etat === 'pret' && <span className="vrm-tampon-puce" data-tampon-fiche="1" style={{ color: C.muted, background: C.bg }}>Fiche colis</span>}
        {etat === 'ko' && <span className="vrm-tampon-puce" data-tampon-ko="1" style={{ color: C.muted, background: C.bg }}>Aperçu indisponible</span>}
      </div>
      <div className="vrm-tampon-options">
        <label className="vrm-tampon-case"><input type="checkbox" data-tampon-toujours="1" checked={toujours} onChange={(e) => setToujours(e.target.checked)}/>Toujours ici</label>
        {libre && <Bouton variante="discret" data-tampon-auto="1" onClick={revenir}>Revenir au choix de VRM</Bouton>}
      </div>
      <div className="vrm-tampon-actions">
        <Bouton variante="secondaire" data-tampon-annuler="1" onClick={() => fin(null)}>Annuler</Bouton>
        <Bouton variante="primaire" icone="printer" data-imprime="1" data-tampon-imprimer="1" disabled={etat === 'charge'} onClick={imprimer}>Imprimer</Bouton>
      </div>
    </div>
  </div>, document.body);
}
export { HotePublierPartout, HotePrixPartout, ParcoursNouveauApp, RangerSheet, FeuilleGestesHL, PlaceurTamponFeuille, HoteLienVc };
