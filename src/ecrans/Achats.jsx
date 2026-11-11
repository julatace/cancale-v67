// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { prixAchatSaisi } from '../prixAuNumerotage.js';
import { suggestionsAchat, tousAchatsLibres, tousAchatsLibresDetail, filtresAchats, etiquetteLot } from '../suggestionsAchat.js';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { pairesDuModele } from '../dejaEnStock.js';
import { cleFacture, verifierFichier } from '../factureAchat.js';
import { PastilleFacture } from '../FactureAchat.jsx';
import { DejaEnStock } from '../DejaEnStock.jsx';
import { prendreDemandeAchat, EVT_ACHAT_LIEN } from '../raccourcisSiri.js';
import { ReventeModele } from '../ReventeModele.jsx';
import { ImportAchatsFeuille } from '../composants/ImportAchats.jsx';
import { prendrePhotoPartagee } from '../partagePhoto.js';
import { exemplesActuels, Bouton, C, FermeAuRetour, SheetShell, Icon, NOM_RECU_ACHAT, PhotoVinted, SB_CONFLICT, SUPABASE_URL, askConfirm, b64ToBytes, centimesRecu, clavierNum, compressImage, dateLocaleISO, dateMiseEnLigneMs, ecouterFenetreCsp, estIOS, estOctetsPdf, extractBrand, extractColors, extractModel, libelleSourceAchat, lignesRecu, lireExtrasRepartition, lirePdfLigne, lireReleveVentes, orderPhoto, ouvrirPdfOnglet, prixAchatHorsNombre, prixCourt, sbAuth, texteCentimesRecu, toast, txRecuAchat, ventilationRecuAchat, withOwner } from '../App.jsx';


// ⟦← App.jsx #1⟧
// </recu-achat-regle>
// Le mode de paiement tel qu'on le lit : « Visa •••• 4242 » (l'email écrit
// « Visa, **********4242 (24,93 €) » ; sans les étoiles il devenait « Visa,
// 4242 », un nombre qui n'en est pas un). Le montant entre parenthèses n'est
// gardé que s'il en dit plus que le Montant payé (deux moyens de paiement).
const modePaiementRecu = (texte, paye) => {
  const brut = String(texte == null ? '' : texte).replace(/\r/g, '').split('\n').find((l) => /^[\s*]*mode\s+de\s+paiement\b/i.test(l));
  if (!brut) return '';
  let m = brut.replace(/\*{3,}\s*(\d{2,4})\b/g, '•••• $1').replace(/\*+/g, ' ').replace(/[\t  ]/g, ' ').replace(/ {2,}/g, ' ').trim()
    .replace(/^mode\s+de\s+paiement\s*:?\s*/i, '').replace(/,\s*(?=••••)/g, ' ');
  const montants = [...m.matchAll(/\(\s*([^()]*?)\s*(?:€|eur)\s*\)/gi)];
  if (montants.length === 1 && paye != null && centimesRecu(montants[0][1]) === paye) m = m.replace(montants[0][0], '').trim();
  else m = m.replace(/\)\s+(?=\S)/g, ') · ');
  // (23 oct., revue) Une espace INSÉCABLE entre les points et les chiffres : à
  // 320 px, « MasterCard •••• » restait sur une ligne et « 9999 » passait à la
  // suivante — un numéro de carte coupé en deux.
  m = m.replace(/•••• (?=\d)/g, '••••\u00a0');
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : '';
};
// La phrase qui accompagne le détail — venue de la même source que les lignes.
const phraseSommeRecu = (v) => {
  if (!v || v.somme === 'juste') return '';
  if (v.somme === 'ecart') return `Ces lignes font ${texteCentimesRecu(v.total)}, pas le montant payé (${texteCentimesRecu(v.paye)}) — regarde l'email de Vinted.`;
  if (v.raison === 'sans-detail') return 'Le détail (article, port, frais) n\'est pas dans cet e-mail — regarde l\'email de Vinted.';
  if (v.raison === 'montant-illisible') return 'Le montant payé n\'a pas pu être lu — regarde l\'email de Vinted.';
  return 'Le détail n\'a pas pu être lu en entier : ces lignes ne sont peut-être pas toutes là — regarde l\'email de Vinted.';
};
// Les champs d'un reçu pour la feuille de l'app ET la fenêtre imprimable.
const champsRecuAchat = (a) => {
  const L = lignesRecu(a && a.texte);
  const val = (re) => { for (const l of L) { const m = l.match(re); if (m && m[1].trim()) return m[1].trim(); } return ''; };
  const v = ventilationRecuAchat(a && a.texte);
  const article = String((a && a.article) || '').trim() || (String((a && a.subject) || '').match(/commande\s*[«"“]\s*([^»"”]+?)\s*[»"”]/i) || [])[1] || 'Article';
  const vendeur = val(/^vendeur\s*:?\s*(.+)$/i);
  const mode = modePaiementRecu(a && a.texte, v.paye);
  const recuLe = a && a.receivedAt && Number.isFinite(Date.parse(a.receivedAt)) ? new Date(a.receivedAt).toLocaleString('fr-FR') : '';
  // L'heure « 10 h 47 » ne se coupe pas (« 10 h » / « 47 » à 320 px).
  const datePaie = (val(/^date\s+du\s+paiement\s*:?\s*(.+)$/i) || recuLe).replace(/(\d) h (\d)/g, '$1\u00a0h\u00a0$2');
  const trans = txRecuAchat(a);
  const compte = String((a && a.account) || '');
  const cleaned = String((a && a.texte) || '').replace(/\*/g, ' ')
    .replace(/<https?:\/\/[^>]+>/g, '').replace(/https?:\/\/links\.vinted\.com\/\S+/gi, '')
    .split('\n').map(l => l.trim())
    .filter(l => l && !/nous sommes tenus|d[ée]sabonner|politique de confidentialit|termes et conditions|pour conna[îi]tre vos droits|l['’]équipe vinted/i.test(l))
    .join('\n');
  // (23 oct., revue) Sans bloc « Montant payé », la feuille et la fenêtre
  // montrent le TEXTE de l'email : un en-tête « Reçu » avec seulement un n° de
  // transaction, et la phrase « ces lignes ne sont peut-être pas toutes là »
  // au-dessus d'aucune ligne, cachait le montant que l'email écrit autrement
  // (« Total payé : 24,93 € »).
  return { article, vendeur, ...v, phrase: phraseSommeRecu(v), mode, datePaie, trans, compte, cleaned,
    hasStructured: v.trouve };
};
// ⟦← App.jsx #2⟧
// Ouvre le reçu pour IMPRESSION / PDF (nouvel onglet). L'affichage à l'écran
// passe par la modale in-app (openReceipt n'est utilisé que pour imprimer).
const openReceipt = (a) => {
  if (a.pdfB64) {
    const bytes = b64ToBytes(a.pdfB64);
    if (bytes) { const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); window.open(url, '_blank'); return; }
  }
  const w = window.open('', '_blank'); if (!w) return;
  try { w.document.open(); } catch (_) {}
  try { ecouterFenetreCsp(w, 'recu'); } catch (_) {}
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  // (23 oct.) Les MÊMES lignes que la feuille de l'app : `champsRecuAchat` (§11).
  const r = champsRecuAchat(a);
  const { article, vendeur, mode, datePaie, trans, compte, cleaned, hasStructured } = r;
  const paid = texteCentimesRecu(r.paye);
  const line = (label, val, strong) => val ? `<tr><td style="padding:9px 0;color:#667;font-size:15px">${esc(label)}</td><td style="padding:9px 0;text-align:right;font-size:15px;${strong ? 'font-weight:800;color:#111' : 'color:#111'}">${esc(val)}</td></tr>` : '';
  const breakdown = r.lignes.map((l) => `<tr data-recu-ligne="${esc(l.libelle)}" data-recu-centimes="${l.centimes == null ? '' : l.centimes}"><td style="padding:9px 0;color:#667;font-size:15px">${esc(l.libelle)}</td><td style="padding:9px 0;text-align:right;font-size:15px;color:#111;white-space:nowrap">${l.centimes == null ? '—' : esc(texteCentimesRecu(l.centimes))}</td></tr>`).join('');
  const meta = [line('Vendeur', vendeur), line('Mode de paiement', mode), line('Date du paiement', datePaie), line('N° de transaction', trans), line('Compte', compte)].join('');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu — ${esc(article)}</title></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin:0;background:#F2F2F7;color:#111;-webkit-print-color-adjust:exact">
    <div class="topbar" style="position:sticky;top:0;z-index:10;background:#F2F2F7;padding:12px 16px 8px;display:flex;align-items:center;gap:10px">
      <button id="vrm-recu-fermer" type="button" style="border:none;border-radius:12px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.12);padding:11px 18px;font-size:15px;font-weight:800;cursor:pointer;color:#111">‹ Fermer</button>
      <span style="font-size:12px;color:#99a">Retour à VRM</span>
    </div>
    <div style="max-width:520px;margin:0 auto;padding:4px 16px 40px">
      <div style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.07)">
        <div style="background:${COULEUR_PLATEFORME.vinted};color:#fff;padding:18px 20px">
          <div style="font-size:12px;opacity:.85;font-weight:700;letter-spacing:.4px;text-transform:uppercase">Reçu d'achat Vinted</div>
          <div style="font-size:20px;font-weight:800;margin-top:3px">${esc(article)}</div>
        </div>
        ${hasStructured ? `
        <div style="padding:18px 20px">
          ${paid ? `<div data-recu-total="${r.paye}" style="display:flex;justify-content:space-between;align-items:baseline;padding-bottom:14px;border-bottom:1px solid #F2F2F7;margin-bottom:6px">
            <span style="font-size:15px;color:#667;font-weight:700">Montant payé</span>
            <span style="font-size:28px;font-weight:800;color:#111">${esc(paid)}</span></div>` : ''}
          ${breakdown ? `<table data-recu-lignes="" style="width:100%;border-collapse:collapse">${breakdown}</table>` : ''}
          <div data-recu-somme="${r.somme}"${r.phrase ? ' style="font-size:13px;color:#556;line-height:1.5;padding:8px 0 2px"' : ' hidden'}>${esc(r.phrase)}</div>
          ${meta ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;border-top:1px solid #F2F2F7">${meta}</table>` : ''}
        </div>` : `
        <div style="padding:18px 20px;white-space:pre-wrap;line-height:1.6;font-size:15px;color:#333">${esc(cleaned)}</div>`}
      </div>
      <button id="vrm-recu-imprimer" type="button" style="display:block;width:100%;margin-top:16px;padding:13px;border:none;border-radius:12px;background:#111;color:#fff;font-size:15px;font-weight:800;cursor:pointer">🖨 Imprimer / Enregistrer en PDF</button>
      <div style="text-align:center;color:#99a;font-size:11px;margin-top:12px">Reçu reconstruit depuis l'e-mail Vinted — à conserver pour ta comptabilité.</div>
    </div>
    <script src="/recu-boutons.js"></script>
  </body></html>`);
  w.document.close();
  // ⚠️ AUCUN `onclick` EN LIGNE (21 octobre) : la fenêtre hérite de la politique
  // de sécurité du contenu de l'app (vercel.json), qui refuse tout script en
  // ligne. ⚠️⚠️ (22 oct., revue) Et les gestes ne sont plus branchés D'ICI : un
  // écouteur posé par l'onglet de VRM meurt quand cet onglet se recharge — ce
  // que l'app fait toute seule (version vérifiée chaque minute, nouveau service
  // worker après un déploiement). « Imprimer » et « Fermer » ne faisaient alors
  // plus rien. La fenêtre charge `/recu-boutons.js` (même origine, permis par
  // script-src 'self') : ses gestes ne dépendent de personne. Ceux d'ici ne sont
  // qu'un SECOURS si ce fichier n'a pas pu se charger (`__vrmRecuBoutons` absent
  // au moment du clic) — jamais les deux à la fois (une impression, pas deux).
  try {
    const fermer = w.document.getElementById('vrm-recu-fermer');
    if (fermer) fermer.addEventListener('click', () => {
      if (w.__vrmRecuBoutons) return;
      try { w.close(); } catch (_) {}
      setTimeout(() => { try { if (w.closed) return; if (w.history.length > 1) w.history.back(); else w.location.href = '/?tab=achats'; } catch (_) {} }, 120);
    });
    const imprimer = w.document.getElementById('vrm-recu-imprimer');
    if (imprimer) imprimer.addEventListener('click', () => { if (w.__vrmRecuBoutons) return; try { w.focus(); w.print(); } catch (_) {} });
  } catch (_) {}
};
// ── LA FEUILLE « REÇU D'ACHAT » (23 octobre) ───────────────────────────────
// Capture iPhone de Julien : la barre du bas passait PAR-DESSUS la feuille —
// « N° de transaction » coupé, et la fin du reçu inatteignable. Rendue dans
// <main>, la feuille restait dans son contexte d'empilement (le z-index n'y
// change rien : sur iPhone, `<main>` qui défile forme un contexte d'empilement).
// Elle est PORTÉE sur <body>, comme l'aperçu des widgets ou le récap de
// l'année. Hors de <main> elle ne profite plus des règles de taille de
// `.vrm-main` : ses cibles sont donc posées à 44 px ICI, et le bas du
// défilement garde la zone de sécurité de l'iPhone (recus-email.css). Les
// lignes, le total et la phrase viennent de `champsRecuAchat` — la même règle
// que la fenêtre PDF.
// ⚠️ (23 oct., revue) AU CLAVIER : le focus va sur la ZONE QUI DÉFILE (↓ et
// Page bas font défiler le reçu — posé sur le dialogue, qui ne défile pas, ils
// ne faisaient rien), Tab et Maj+Tab tournent DANS la feuille (au 3ᵉ Tab il
// partait sur <body>, derrière le voile), Échap est écouté sur le DOCUMENT (une
// fois le focus sorti, l'écoute du dialogue ne recevait plus rien), et le focus
// revient à la fermeture sur ce qui l'avait ouverte (« Voir › »). Même motif que
// le panneau des écrans (`MenuEcrans`).
function FeuilleRecuAchat({ recu, fermer }) {
  const r = champsRecuAchat(recu);
  const boite = useRef(null);
  // (29 oct.) LE PDF JOINT À L'EMAIL (s'il y en a un) se lit AU CLIC seulement
  // (§4.4 : la liste ne rapatrie jamais `pdfB64`). Trois états : lecture · pas
  // su (la base n'a pas répondu) · absent (la ligne n'a plus de PDF) · prêt.
  const aPdf = !!(recu && (recu._pdf || recu.pdfB64));
  const [pj, setPj] = useState(null);
  useEffect(() => () => { if (pj && pj.url) { try { URL.revokeObjectURL(pj.url); } catch (_) {} } }, [pj]);
  const ouvrirPj = async () => {
    if (pj && pj.url) { if (!ouvrirPdfOnglet(pj.url, recu.filename || 'recu-achat.pdf', NOM_RECU_ACHAT)) window.open(pj.url, '_blank'); return; }
    setPj({ etat: 'lecture' });
    const lu = recu.pdfB64 ? { octets: b64ToBytes(recu.pdfB64) } : await lirePdfLigne(recu._emailId);
    if (lu === null) { setPj({ etat: 'passu' }); return; }
    if (!lu || !lu.octets || !estOctetsPdf(lu.octets)) { setPj({ etat: 'absent' }); return; }
    const url = URL.createObjectURL(new Blob([lu.octets], { type: 'application/pdf' }));
    setPj({ etat: 'pret', url });
    ouvrirPdfOnglet(url, recu.filename || 'recu-achat.pdf', NOM_RECU_ACHAT);
  };
  const defile = useRef(null);
  const fermerRef = useRef(fermer); fermerRef.current = fermer;
  useEffect(() => {
    const ouvreur = document.activeElement;
    try { (defile.current || boite.current).focus({ preventScroll: true }); } catch (_) {}
    const clavier = (e) => {
      const d = boite.current; if (!d) return;
      // La visionneuse du PDF ouverte par-dessus garde ses touches (31 oct.) :
      // sinon Tab ramenait le focus dans le reçu, derrière elle.
      if (document.querySelector('[data-visionneuse-pdf]')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerRef.current(); return; }
      if (e.key !== 'Tab') return;
      const cibles = [...d.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.getClientRects().length > 0);
      if (!cibles.length) { e.preventDefault(); return; }
      const premier = cibles[0], dernier = cibles[cibles.length - 1], a = document.activeElement;
      const dedans = !!a && a !== d && d.contains(a);
      if (e.shiftKey && (!dedans || a === premier)) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && (!dedans || a === dernier)) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', clavier);
    return () => {
      document.removeEventListener('keydown', clavier);
      try { if (ouvreur && ouvreur !== document.body && ouvreur.isConnected && typeof ouvreur.focus === 'function') ouvreur.focus({ preventScroll: true }); } catch (_) {}
    };
  }, []);
  // (23 oct., revue) Un MONTANT ne se coupe jamais (`montant` : sans retour à la
  // ligne, comme dans la fenêtre PDF) : à 320 px, « 11,20 » / « € » — la valeur
  // en `overflowWrap:'anywhere'` pouvait se casser sur l'espace insécable. Le
  // libellé, lui, passe à la ligne. Les autres valeurs (un pseudo très long)
  // gardent `anywhere` : jamais de débordement.
  const Row = ({ label, val, attrs, montant }) => val ? (
    <div {...(attrs || {})} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:15,color:C.muted,fontWeight:500,minWidth:0}}>{label}</span>
      <span style={{fontSize:15,color:C.text,fontWeight:500,textAlign:'right',...(montant ? { whiteSpace:'nowrap', flexShrink:0 } : { overflowWrap:'anywhere' })}}>{val}</span>
    </div>) : null;
  const cible = { minWidth:44, minHeight:44, boxSizing:'border-box', display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:12, border:`1px solid ${C.border}`, background:C.card, color:C.text, cursor:'pointer', fontFamily:'inherit', flexShrink:0 };
  return createPortal(
    <div data-noswipe="1" data-recu-voile="" onClick={fermer} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1400,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <FermeAuRetour fermer={fermer}/>
      <div ref={boite} className="vrm-recu-feuille" data-recu-feuille="" role="dialog" aria-modal="true" aria-label={NOM_RECU_ACHAT} tabIndex={-1} onClick={e=>e.stopPropagation()} style={{background:C.bg,color:C.text,width:'100%',maxWidth:520,borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',outline:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <button type="button" data-recu-retour="" onClick={fermer} aria-label="Retour" style={{...cible,width:44,height:44,padding:0,fontSize:22,fontWeight:600,lineHeight:1}}>‹</button>
          <div style={{flex:1,minWidth:0,fontSize:17,fontWeight:700,color:C.text}}>{NOM_RECU_ACHAT}</div>
          <button type="button" data-recu-pdf="" onClick={()=>openReceipt(recu)} title="Imprimer / PDF" style={{...cible,gap:6,padding:'0 14px',fontSize:15,fontWeight:600}}><Icon name="printer" size={15}/>PDF</button>
        </div>
        {aPdf && (
          <div data-recu-pj={pj ? pj.etat : 'repos'} style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,padding:'8px 12px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <button type="button" data-recu-pj-ouvrir="" disabled={!!(pj && pj.etat === 'lecture')} onClick={ouvrirPj} style={{...cible,gap:6,padding:'0 14px',fontSize:15,fontWeight:600}}><Icon name="receipt" size={15}/>{pj && pj.etat === 'lecture' ? 'Lecture du PDF…' : 'PDF joint à l’e-mail'}</button>
            {pj && pj.etat === 'pret' && estIOS() && <a data-recu-pj-lien="" href={pj.url} target="_blank" rel="noopener" style={{...cible,padding:'0 14px',fontSize:15,fontWeight:600,textDecoration:'none'}}>Ouvrir le PDF</a>}
            {pj && pj.etat === 'passu' && <span style={{fontSize:13,color:C.muted}}>La base n'a pas répondu — réessaie dans un instant.</span>}
            {pj && pj.etat === 'absent' && <span style={{fontSize:13,color:C.muted}}>Ce reçu n'a plus son PDF — le texte de l'email est ci-dessous.</span>}
          </div>
        )}
        <div ref={defile} className="vrm-recu-defile" data-recu-defile="" tabIndex={0} role="region" aria-label="Détail du reçu" style={{flex:1,minHeight:0,overflowY:'auto',overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}}>
          <div style={{background:C.card,borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`}}>
            <div style={{background:COULEUR_PLATEFORME.vinted,color:'#fff',padding:'16px 18px'}}>
              <div style={{fontSize:11,opacity:0.9,fontWeight:500,letterSpacing:0.4,textTransform:'uppercase'}}>Reçu d'achat Vinted</div>
              <div style={{fontSize:20,fontWeight:600,marginTop:3,lineHeight:1.3,overflowWrap:'anywhere'}}>{r.article}</div>
            </div>
            {r.hasStructured ? (
              <div style={{padding:'14px 18px 16px'}}>
                {r.paye != null && (
                  <div data-recu-total={r.paye} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,paddingBottom:12,borderBottom:`1px solid ${C.border}`,marginBottom:2}}>
                    <span style={{fontSize:15,color:C.muted,fontWeight:500}}>Montant payé</span>
                    <span style={{fontSize:28,fontWeight:700,color:C.text,whiteSpace:'nowrap'}}>{texteCentimesRecu(r.paye)}</span>
                  </div>
                )}
                {r.lignes.map((l, i) => <Row key={i} montant label={l.libelle} val={l.centimes == null ? '—' : texteCentimesRecu(l.centimes)} attrs={{ 'data-recu-ligne': l.libelle, 'data-recu-centimes': l.centimes == null ? '' : String(l.centimes) }}/>)}
                <div data-recu-somme={r.somme} hidden={!r.phrase} style={{fontSize:13,lineHeight:1.5,color:C.muted,padding:'10px 0 2px'}}>{r.phrase}</div>
                <div style={{height:10}}/>
                <Row label="Vendeur" val={r.vendeur}/>
                <Row label="Mode de paiement" val={r.mode}/>
                <Row label="Date du paiement" val={r.datePaie}/>
                <Row label="N° de transaction" val={r.trans} attrs={{ 'data-recu-transaction': r.trans }}/>
                <Row label="Compte" val={r.compte}/>
              </div>
            ) : (
              <div style={{padding:'16px 18px',whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:15,color:C.text}}>{r.cleaned}</div>
            )}
          </div>
          <div data-recu-fin="" style={{textAlign:'center',color:C.muted,fontSize:12,marginTop:12,lineHeight:1.5}}>Reçu reconstruit depuis l'e-mail Vinted — à conserver pour ta comptabilité.</div>
        </div>
      </div>
    </div>, document.body);
}
// ⟦← App.jsx #3⟧
// ── ACHATS HORS PLATEFORME (brocante, fournisseur, main propre…) ────────────
// Julien : « des achats hors plateforme faciles ». C'est de la SAISIE au doigt,
// souvent debout à la brocante : un titre, le prix payé, la date (aujourd'hui
// par défaut), où, et une photo si on veut. RIEN n'oblige à relier une paire —
// le N° reste possible, replié (« Relier à une paire »), parce qu'un N° faux ne
// se voit pas (§5) et qu'il saisit lui-même ses prix (§2.5).
// ⚠️ UNE SEULE RÈGLE, UN SEUL PROPRIÉTAIRE (§11) : les achats vivent dans
//    `vinted_offvinted_buys` (synchronisé), la même clé que le « dépensé »
//    (`treasury`) lit déjà. On ne crée pas de seconde liste.
// ⚠️ L'ancien formulaire déclarait son `Field` DANS le rendu : un composant neuf
//    à chaque frappe, donc le champ perdait le focus après chaque lettre — sur
//    téléphone on ne pouvait taper qu'un caractère. Ici les champs sont des
//    éléments, jamais un composant redéclaré.
// ⚠️ LA PHOTO NE VA PAS DANS `main` (§4.4 : la ligne la plus lue pèse déjà
//    ~200 Ko). Elle a SA ligne (`achat_hors_photo_{id}`, ~20 Ko), lue seulement
//    quand la liste est ouverte. L'achat ne porte `photo:true` que si
//    l'écriture a RÉUSSI ; sinon on le dit et l'achat est gardé sans photo.
// (10 nov., lot BG) + « Magasin » : la source se SAISIT ici (liste courte + libre), lue par Statistiques (src/sourceAchats.js).
const SOURCES_ACHAT_HORS = ['Brocante', 'Vide-grenier', 'Magasin', 'Fournisseur', 'Leboncoin (main propre)', 'Particulier'];
// ⟦← App.jsx #4⟧
const idPhotoAchatHors = (id) => 'achat_hors_photo_' + String(id).replace(/[^\w-]/g, '');
// Écrit la photo dans sa ligne. Rend true seulement si la base l'a acceptée.
// (Un DELETE sur app_data ne supprime rien : on VIDE la ligne à la place.)
const ecrirePhotoAchatHors = async (id, b64) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
      method: 'POST',
      headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([withOwner({ id: idPhotoAchatHors(id), data: b64 ? { b64, at: new Date().toISOString() } : { b64: null, supprime: true, at: new Date().toISOString() } })]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
};
// ⟦→ ecrans/Compta.jsx #16⟧
// Trois états : `null` = la base n'a pas répondu (pas su), sinon { id → dataURL }.
const lirePhotosAchatsHors = async () => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.achat_hors_photo_*&select=id,b:data->>b64`, { headers: sbAuth() });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const m = {};
    for (const x of rows) if (x && x.id && typeof x.b === 'string' && x.b.startsWith('data:image/')) m[x.id] = x.b;
    return m;
  } catch (_) { return null; }
};
// ⟦← App.jsx #5⟧

function AchatsHorsPlateforme({ achats, ouvert, onBasculer, onAjouter, onModifier, onSupprimer, paires, prochainNumero, onPrixParNumero, stock = null, chargerStock = null, facture = null, importer = null }) {
  // (10 nov., lot J) « Importer un tableur » (src/importAchats.js) : `importer` = { existants, numeroDe, etatNumero, onImporter }.
  const [importOuvert, setImportOuvert] = useState(false);
  // (10 nov., lot AN) `facture` (src/FactureAchat.jsx) : joindre une facture d'achat (PDF ou photo) à l'achat saisi.
  const BROUILLON0 = () => ({ title: '', price: '', date: dateLocaleISO(), source: '', numero: '', ref: '', photo: null, photoAvant: false, facture: null });
  const factureRef = useRef(null);
  const [form, setForm] = useState(null);       // null = fermé ; sinon le brouillon
  const [editId, setEditId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [photos, setPhotos] = useState(undefined); // undefined en cours · null pas su · objet lu
  const fichierRef = useRef(null);
  const liste = Array.isArray(achats) ? achats : [];
  // (9 nov., lot F) « Tu as déjà N paires de ce modèle en stock » pendant la saisie : une
  // RESSEMBLANCE dite (src/dejaEnStock.js), jamais une liaison — rien n'est écrit.
  const titreForm = form ? form.title : '';
  // Les annonces ne sont pas lues sur l'écran Achats : le formulaire ouvert les demande (lecture seule).
  const formOuvert = !!form;
  const stockAbsent = stock == null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (formOuvert && stockAbsent && chargerStock) chargerStock(); }, [formOuvert, stockAbsent]);
  const dejaStock = useMemo(() => (titreForm.trim().length >= 3 && Array.isArray(stock) ? pairesDuModele({ cible: { titre: titreForm }, stock, marqueDe: extractBrand, modeleDe: extractModel, couleursDe: extractColors }) : null), [titreForm, stock]);
  const total = liste.reduce((s, b) => s + (prixAchatHorsNombre(b) || 0), 0);
  const avecPhoto = liste.some(b => b && b.photo);
  useEffect(() => {
    if (!ouvert || !avecPhoto) return;
    let vivant = true;
    lirePhotosAchatsHors().then(m => { if (vivant) setPhotos(p => (m == null ? (p || null) : { ...(p || {}), ...m })); });
    return () => { vivant = false; };
  }, [ouvert, avecPhoto]);
  const ouvrirAjout = () => { setEditId(null); setErreur(''); setForm(BROUILLON0()); };
  // (10 nov., lot AH) Le raccourci Siri « Ajouter un achat » (src/raccourcisSiri.js) : le formulaire s'ouvre,
  // pré-rempli de ce qu'il a dit — rien n'est écrit sans « Ajouter l'achat ». Consommé une fois.
  useEffect(() => {
    const servir = () => {
      const d = prendreDemandeAchat(); if (!d) return;
      setEditId(null); setErreur('');
      setForm({ ...BROUILLON0(), title: d.titre || '', price: d.prix || '', source: d.lieu || '' });
      // (10 nov., lot J) Une photo partagée depuis l'app Photos (src/partagePhoto.js) : elle rejoint le brouillon.
      if (d.photoPartagee) prendrePhotoPartagee().then(async (blob) => {
        const b64 = blob ? await compressImage(blob, 480, 0.62) : null;
        if (b64) setForm((f) => f && !f.photo ? { ...f, photo: b64 } : f);
        else setErreur("La photo partagée n'a pas pu être lue : touche « Photo ».");
      });
      // L'écran finit de se poser après (listes, défilement remis en haut) : le formulaire est ramené en vue tant qu'il n'y est pas.
      [400, 1200, 2500].forEach((ms) => setTimeout(() => { try { const f = document.querySelector('[data-achat-hors-form]'); if (!f) return; const r = f.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.6) f.scrollIntoView({ block: 'center' }); } catch (_) {} }, ms));
      setTimeout(() => { try { const f = document.querySelector('[data-achat-hors-form]'); if (f) f.scrollIntoView({ block: 'center' }); const vide = !d.titre ? 'titre' : !d.prix ? 'prix' : ''; const c = vide && document.querySelector(`[data-champ="${vide}"]`); if (c) c.focus({ preventScroll: true }); } catch (_) {} }, 80);
    };
    servir(); window.addEventListener(EVT_ACHAT_LIEN, servir);
    return () => window.removeEventListener(EVT_ACHAT_LIEN, servir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ouvrirEdition = (b) => {
    setEditId(b.id); setErreur('');
    setForm({ title: b.title || '', price: b.price || '', date: b.date || dateLocaleISO(), source: libelleSourceAchat(b.source), numero: b.numero || '', ref: b.ref || '', photo: null, photoAvant: !!b.photo, facture: null });
  };
  const fermer = () => { setForm(null); setEditId(null); setErreur(''); };
  const choisirPhoto = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const b64 = await compressImage(f, 480, 0.62);
    if (!b64) { setErreur("Cette photo n'a pas pu être lue — essaie une autre, ou enregistre sans photo."); return; }
    setForm(d => d && ({ ...d, photo: b64 }));
  };
  const enregistrer = async () => {
    if (!form || envoi) return;
    const titre = form.title.trim();
    if (!titre) { setErreur('Donne un nom à cet achat (ex : Nike P-6000 argent 38).'); return; }
    const prix = prixAchatSaisi(form.price);
    if (prix === null) { setErreur('Le prix payé doit être un montant en euros (ex : 25 ou 25,50).'); return; }
    setEnvoi(true);
    const id = editId || ('ob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    let photoOk = form.photoAvant;
    let photoRatee = false;
    if (form.photo) {
      const ok = await ecrirePhotoAchatHors(id, form.photo);
      if (ok) { photoOk = true; const b64 = form.photo; setPhotos(p => ({ ...(p || {}), [idPhotoAchatHors(id)]: b64 })); }
      else photoRatee = true;
    }
    const rec = { title: titre, price: prix || '', date: form.date || dateLocaleISO(), source: form.source.trim(), numero: String(form.numero || '').trim(), ref: String(form.ref || '').trim().slice(0, 40) || undefined, photo: photoOk || undefined };
    if (editId) onModifier(editId, rec); else onAjouter({ id, ...rec });
    // La facture jointe part dans SA ligne, par l'identité de l'achat (jamais son titre).
    if (form.facture && facture) await facture.joindre(cleFacture('hors', id), form.facture);
    if (rec.numero && rec.price && onPrixParNumero) onPrixParNumero(rec.numero, rec.price);
    setEnvoi(false);
    if (!ouvert) onBasculer(true);
    if (photoRatee) toast("Achat enregistré — mais la photo n'a pas pu être envoyée (la base n'a pas répondu). Modifie l'achat pour la remettre.");
    else toast(editId ? 'Achat modifié' : 'Achat ajouté');
    fermer();
  };
  // (10 nov., lot Y) Plus de « Ça ne se rattrape pas » : il part à la corbeille 30 jours (pilule
  // « Annuler » 5 s, puis Paramètres → Corbeille) ; sa photo n'est vidée qu'à la purge (src/corbeille.js).
  const supprimer = () => {
    const b = liste.find(x => x.id === editId); if (!b) return;
    onSupprimer(b.id);
    fermer();
  };
  const lab = { fontSize: 12, color: C.muted, fontWeight: 600 };
  const inp = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 12px', height: 46, fontSize: 17, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minWidth: 0, WebkitAppearance: 'none', appearance: 'none' };
  const champ = (label, enfant) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}><span style={lab}>{label}</span>{enfant}</label>
  );
  const sousTitre = liste.length
    ? `${liste.length} achat${liste.length > 1 ? 's' : ''} · ${total.toFixed(2).replace('.', ',')}\u00a0€ payés`
    : 'Brocante, fournisseur, main propre…';
  const photoForm = form ? (form.photo || (form.photoAvant && photos ? photos[idPhotoAchatHors(editId)] : null)) : null;
  return (
    <div data-achats-hors style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, marginBottom: 12, boxShadow: C.shadow || 'none', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', minHeight: 58 }}>
        <button type="button" data-achats-hors-entete onClick={() => (liste.length ? onBasculer(!ouvert) : ouvrirAjout())} aria-expanded={liste.length ? ouvert : undefined}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', padding: '6px 0', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
          <span aria-hidden="true" style={{ flexShrink: 0, color: C.muted, display: 'flex' }}><Icon name="tag" size={18} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>Achats hors plateforme</span>
            <span data-achats-hors-resume style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sousTitre}</span>
          </span>
          {liste.length > 0 && <span aria-hidden="true" style={{ fontSize: 17, color: C.muted, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0, padding: '0 4px' }}>›</span>}
        </button>
        <Bouton variante="secondaire" data-achat-hors-ajouter onClick={ouvrirAjout} aria-label="Ajouter un achat hors plateforme" style={{ flexShrink: 0, minHeight: 44 }}>+ Ajouter</Bouton>
      </div>
      {form && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}><div data-achat-hors-form style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 13, maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{editId ? "Modifier l'achat" : 'Nouvel achat'}</div>
            {!editId && importer ? <Bouton variante="discret" data-achat-hors-importer="" onClick={() => setImportOuvert(true)} style={{ flexShrink: 0, padding: '0 4px', minHeight: 44 }}>Importer un tableur</Bouton> : null}
          </div>
          {champ('Ce que tu as acheté', <input data-champ="titre" value={form.title} onChange={e => { setErreur(""); setForm(d => ({ ...d, title: e.target.value })); }} placeholder={exemplesActuels().achat} enterKeyHint="next" autoComplete="off" style={inp} />)}
          {!editId && <DejaEnStock r={dejaStock} C={C} Photo={PhotoVinted} />}
          {/* (10 nov., lot AV) Ce que tu as revendu ce modèle : le passé, jamais un conseil (src/reventeModele.js). */}
          {titreForm.trim().length >= 3 && <ReventeModele C={C} cible={{ titre: titreForm }} lireReleve={lireReleveVentes} lireExtras={lireExtrasRepartition} dateEnLigne={dateMiseEnLigneMs} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {champ('Prix payé', <div style={{ position: 'relative' }}><input data-champ="prix" value={form.price} onChange={e => { setErreur(""); setForm(d => ({ ...d, price: e.target.value })); }} inputMode="decimal" placeholder="0,00" autoComplete="off" style={{ ...inp, paddingRight: 30 }} /><span aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 15, pointerEvents: 'none' }}>€</span></div>)}
            {champ('Date', <input data-champ="date" type="date" value={form.date} onChange={e => setForm(d => ({ ...d, date: e.target.value }))} style={inp} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {champ('Où (facultatif)', <input data-champ="lieu" value={form.source} onChange={e => setForm(d => ({ ...d, source: e.target.value }))} placeholder="Brocante, vide-grenier, fournisseur…" autoComplete="off" style={inp} />)}
            <div className="vrm-rangee" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {SOURCES_ACHAT_HORS.map(s => {
                const actif = form.source.trim().toLowerCase() === s.toLowerCase();
                return <button key={s} type="button" data-source={s} onClick={() => setForm(d => ({ ...d, source: s }))} aria-pressed={actif}
                  style={{ flexShrink: 0, height: 36, padding: '0 13px', borderRadius: 999, border: `1px solid ${actif ? C.text : C.border}`, background: actif ? C.text : C.card, color: actif ? C.card : C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{s}</button>;
              })}
            </div>
          </div>
          {/* (10 nov., lot BH) La référence de l'achat : c'est ELLE (jamais le nom ni le prix) qui dit qu'un achat est saisi deux fois. */}
          {champ('N° de commande ou de facture (facultatif)', <input data-champ="ref" value={form.ref || ''} onChange={e => setForm(d => ({ ...d, ref: e.target.value }))} placeholder="ex : n° de transaction Vinted" autoComplete="off" spellCheck={false} maxLength={40} style={inp} />)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {photoForm ? <img data-achat-hors-apercu src={photoForm} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} /> : null}
            <Bouton variante="secondaire" icone="camera" data-achat-hors-photo onClick={() => fichierRef.current && fichierRef.current.click()} style={{ minHeight: 44 }}>
              {form.photo || form.photoAvant ? 'Changer la photo' : 'Photo (facultatif)'}
            </Bouton>
            {form.photo && <Bouton variante="discret" onClick={() => setForm(d => ({ ...d, photo: null }))}>Retirer la photo</Bouton>}
            <input data-achat-hors-fichier ref={fichierRef} type="file" accept="image/*" onChange={choisirPhoto} style={{ display: 'none' }} />
          </div>
          {facture ? (() => {
            const cf = editId ? cleFacture('hors', editId) : '';
            const deja = cf && facture.factures ? facture.factures[cf] : null;
            return (
              <div data-achat-hors-facture="" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {deja && !form.facture ? <PastilleFacture cle={cf} f={deja} onOuvrir={facture.ouvrir} enCours={facture.enCours === cf} Icon={Icon} /> : null}
                {form.facture ? <span data-achat-hors-facture-choisie="" style={{ fontSize: 13, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{form.facture.name}</span> : null}
                <Bouton variante="secondaire" icone="doc" data-achat-hors-facture-bouton onClick={() => factureRef.current && factureRef.current.click()} style={{ minHeight: 44 }}>
                  {form.facture || deja ? 'Changer la facture' : 'Facture (facultatif)'}
                </Bouton>
                {form.facture && <Bouton variante="discret" onClick={() => setForm(d => ({ ...d, facture: null }))}>Retirer</Bouton>}
                <input data-achat-hors-facture-input ref={factureRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                  onChange={(e) => { const fi = e.target.files && e.target.files[0]; e.target.value = ''; if (!fi) return; const v = verifierFichier({ type: fi.type, taille: fi.size, nom: fi.name }); if (!v.ok) { setErreur(v.message); return; } setErreur(''); setForm(d => d && ({ ...d, facture: fi })); }} />
              </div>
            );
          })() : null}
          <details data-achat-hors-relier style={{ fontSize: 13, color: C.text }} open={!!(editId && form.numero) || undefined}>
            <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', color: C.muted, fontSize: 13 }}>Relier à un article (facultatif)</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
              {Array.isArray(paires) && paires.length > 0 && champ('Une de tes annonces en ligne',
                <select value="" onChange={e => { const p = paires.find(x => String(x.id) === e.target.value); if (!p) return; setForm(d => ({ ...d, numero: p.num, title: d.title.trim() ? d.title : (p.title || '') })); }} style={inp}>
                  <option value="">— choisir —</option>
                  {paires.map(p => <option key={p.id} value={String(p.id)}>N°{p.num} · {(p.title || '').slice(0, 40)}</option>)}
                </select>)}
              {champ('N° de l\'article', <input data-champ="numero" value={form.numero} onChange={e => setForm(d => ({ ...d, numero: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9) }))} inputMode={clavierNum()} placeholder={prochainNumero != null ? String(prochainNumero) : ''} style={inp} />)}
              <div className="vrm-aide" style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>Avec un N°, ce prix devient le coût de l'article dans son bénéfice.</div>
            </div>
          </details>
          {erreur && <div role="alert" data-achat-hors-erreur style={{ fontSize: 13, color: C.warn, lineHeight: 1.4 }}>{erreur}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Bouton variante="primaire" data-achat-hors-enregistrer disabled={envoi} onClick={enregistrer}
              style={{ flex: 1, minWidth: 0, minHeight: 48, opacity: envoi ? 0.7 : 1 }}>{envoi ? 'Enregistrement…' : (editId ? 'Enregistrer' : "Ajouter l'achat")}</Bouton>
            <Bouton variante="discret" onClick={fermer} style={{ flexShrink: 0, padding: '0 12px' }}>Annuler</Bouton>
          </div>
          {editId && <Bouton variante="discret" icone="trash" data-achat-hors-supprimer onClick={supprimer} style={{ alignSelf: 'flex-start' }}>Supprimer cet achat</Bouton>}
        </div></div>
      )}
      {importOuvert && importer && <ImportAchatsFeuille Feuille={SheetShell} Bouton={Bouton} existants={importer.existants} numeroDe={importer.numeroDe} etatNumero={importer.etatNumero}
        onClose={() => setImportOuvert(false)} onImporter={(w) => { importer.onImporter(w); setImportOuvert(false); fermer(); if (!ouvert) onBasculer(true); }} />}
      {ouvert && liste.length > 0 && (
        <div data-achats-hors-liste style={{ borderTop: `1px solid ${C.border}` }}>
          {photos === null && avecPhoto && <div style={{ fontSize: 12, color: C.muted, padding: '8px 14px 0' }}>Photos pas lues (la base n'a pas répondu) — elles reviendront.</div>}
          {liste.map((b, i) => {
            const src = b.photo && photos ? photos[idPhotoAchatHors(b.id)] : null;
            const p = prixAchatHorsNombre(b);
            const d = b.date ? new Date(String(b.date).length === 10 ? b.date + 'T12:00:00' : b.date) : null;
            const meta = [libelleSourceAchat(b.source), d && !isNaN(d) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
            return (
              <button key={b.id} type="button" data-achat-hors-id={b.id} onClick={() => ouvrirEdition(b)} title="Modifier ou supprimer"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 64, border: 'none', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', borderRadius: 0, background: editId === b.id ? (C.card2 || C.bg) : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: C.card2 || C.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {src ? <img src={src} alt="" data-vrm-vignette="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tag" size={17} style={{ color: C.muted, opacity: .6 }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title || 'Achat'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, marginTop: 2, minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{meta || '—'}</span>
                    {b.numero && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.text, background: C.card2 || C.border, borderRadius: 6, padding: '1px 6px' }}>N°{b.numero}</span>}
                    {facture && facture.factures && facture.factures[cleFacture('hors', b.id)] ? <span data-achat-hors-a-facture="" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: C.text }}><Icon name="doc" size={12} />Facture</span> : null}
                  </span>
                </span>
                <span data-achat-hors-prix style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{p != null ? `${p.toFixed(2).replace('.', ',')}\u00a0€` : '—'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ⟦← App.jsx #6⟧
// Sous-navigation d'un hub de plateforme : des pastilles qui changent la SECTION
// affichée DANS l'onglet (Aperçu · Annonces · Ventes · Achats), sans quitter la
// plateforme. Une seule teinte d'accent (§7), la pastille active distingue.
// (17 oct.) Julien : « pourquoi il y a deux logos eBay quand on est dessus » —
// le logo d'eBay EST son nom écrit (« ebay »), et le titre le répétait à côté.
// Et « la mise en page est éteinte » : chaque plateforme a maintenant sa tuile,
// la marque dans SA couleur sur un fond très pâle de la même teinte — la seule
// couleur de l'en-tête, petite (§7). eBay : le logo seul (le nom reste pour les
// lecteurs d'écran).
const COULEUR_PLATEFORME = { vinted: '#007782', leboncoin: '#EC5A13', ebay: '#0071E3' };
// ⟦← App.jsx #7⟧
// ── RELIER UN ACHAT : SUGGESTIONS PUIS TOUS LES ACHATS (3 nov., Julien) ─────
// 1 à 3 suggestions (marque + taille + couleur, `src/suggestionsAchat.js`), puis
// « Voir tous les achats » : ceux pas encore reliés (un LOT reste jusqu'à son
// nombre d'articles), recherche par mot, filtres compte et mois. Rien n'est
// relié sans SON tap (`onRelier`). Aucun texte explicatif.
function RelierAchatCorps({ cible, achats, liens, curTx, compteDe, prixDe, receptionDe = null, receptionEtat = 'lu', onFiltres = null, onRelier, C }) {
  const [tous, setTous] = useState(false);
  const [q, setQ] = useState('');
  const [compte, setCompte] = useState('');
  const [mois, setMois] = useState('');
  // (5 nov.) Filtrer la liste par prix payé, date de RÉCEPTION lue, marque, taille
  // (`tousAchatsLibresDetail`) — c'est toujours SON tap « Relier » qui relie.
  const [plus, setPlus] = useState(false);
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
  const [recuDu, setRecuDu] = useState('');
  const [recuAu, setRecuAu] = useState('');
  const [marque, setMarque] = useState('');
  const [taille, setTaille] = useState('');
  const sugg = useMemo(() => (Array.isArray(achats) ? suggestionsAchat({ cible, achats, liens, marqueDe: extractBrand, couleursDe: extractColors, modeleDe: extractModel }) : []), [cible, achats, liens]);
  const voirTous = tous || (Array.isArray(achats) && !sugg.length);
  // (relecture du 5 nov.) Les dates de réception se lisent à la demande (son tap sur
  // « Filtres ») : tant qu'elles arrivent, le filtre de date attend — il n'écarte rien
  // sur une lecture pas faite (« pas su » ≠ « pas reçu »).
  const dateEnAttente = receptionEtat === 'lecture' && !!(recuDu || recuAu);
  const detail = useMemo(() => (voirTous && Array.isArray(achats) ? tousAchatsLibresDetail({ achats, liens, curTx, q, compte, mois, compteDe, marqueDe: extractBrand,
    prixMin, prixMax, prixAchat: prixDe, recuDu: dateEnAttente ? '' : recuDu, recuAu: dateEnAttente ? '' : recuAu, receptionDe, marque, taille }) : { liste: [], sansReception: 0 }), [voirTous, achats, liens, curTx, q, compte, mois, prixMin, prixMax, recuDu, recuAu, marque, taille, receptionDe, dateEnAttente]);
  const liste = detail.liste;
  const filtres = useMemo(() => (voirTous && Array.isArray(achats) ? filtresAchats(tousAchatsLibres({ achats, liens, curTx }), compteDe, extractBrand) : { mois: [], comptes: [], marques: [], tailles: [] }), [voirTous, achats, liens, curTx]);
  const nFiltres = [prixMin, prixMax, recuDu, recuAu, marque, taille].filter((x) => String(x || '').trim()).length;
  if (!Array.isArray(achats)) return <div data-relier-chargement style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>…</div>;
  const ligne = (a, attrs) => {
    const ph = orderPhoto(a), lot = etiquetteLot(a, liens), px = prixDe(a);
    const d = a.date ? new Date(a.date) : null;
    return (
      <div key={a.transaction_id} {...attrs} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}`, minHeight: 60 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }}/>}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title || '—'}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[lot, d && !isNaN(d) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '', compteDe(a)].filter(Boolean).join(' · ')}</div>
        </div>
        <div data-relier-prix style={{ fontSize: 15, fontWeight: 700, color: C.text, flexShrink: 0 }}>{px != null ? prixCourt(px) : '—'}</div>
        <Bouton variante="secondaire" data-relier-achat={String(a.transaction_id)} onClick={() => onRelier(a)} style={{ flexShrink: 0, minHeight: 44 }}>Relier</Bouton>
      </div>
    );
  };
  const sel = { minHeight: 44, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, color: C.text, fontSize: 13, fontFamily: 'inherit', padding: '0 8px', flex: '1 1 0', minWidth: 0 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sugg.length > 0 && <div data-suggestions-achat={sugg.length}>{sugg.map((x) => ligne(x.achat, { 'data-suggestion-achat': String(x.achat.transaction_id), 'data-rang': x.rang }))}</div>}
      {!voirTous && <Bouton variante="discret" data-voir-tous-achats onClick={() => setTous(true)} style={{ alignSelf: 'flex-start', minHeight: 44, marginTop: 6 }}>Voir tous les achats</Bouton>}
      {voirTous && (
        <div data-tous-achats={liste.length} style={{ marginTop: sugg.length ? 10 : 0 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, marque, n° de transaction" data-tous-achats-recherche
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 11px', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, color: C.text, fontSize: 17, fontFamily: 'inherit' }}/>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {filtres.comptes.length > 1 && <select aria-label="Compte" data-filtre-compte value={compte} onChange={(e) => setCompte(e.target.value)} style={sel}><option value="">Tous les comptes</option>{filtres.comptes.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            <Bouton variante="discret" data-filtres-plus={nFiltres} aria-expanded={plus} onClick={() => { setPlus((v) => !v); if (onFiltres) onFiltres(); }} style={{ minHeight: 44, flex: '0 0 auto' }}>{nFiltres ? `Filtres · ${nFiltres}` : 'Filtres'}</Bouton>
            {filtres.mois.length > 1 && <select aria-label="Mois" data-filtre-mois value={mois} onChange={(e) => setMois(e.target.value)} style={sel}><option value="">Tous les mois</option>{filtres.mois.map((m) => <option key={m} value={m}>{new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>)}</select>}
          </div>
          {plus && (
            <div data-filtres-achat="" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.muted, minWidth: 0 }}>Prix payé, de
                <input inputMode="decimal" value={prixMin} onChange={(e) => setPrixMin(e.target.value)} placeholder="€" data-filtre-prix-min style={{ ...sel, flex: 'none', fontSize: 17 }}/></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.muted, minWidth: 0 }}>à
                <input inputMode="decimal" value={prixMax} onChange={(e) => setPrixMax(e.target.value)} placeholder="€" data-filtre-prix-max style={{ ...sel, flex: 'none', fontSize: 17 }}/></label>
              {receptionDe ? <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.muted, minWidth: 0 }}>Reçu du
                  <input type="date" value={recuDu} onChange={(e) => setRecuDu(e.target.value)} data-filtre-recu-du style={{ ...sel, flex: 'none', fontSize: 17 }}/></label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.muted, minWidth: 0 }}>au
                  <input type="date" value={recuAu} onChange={(e) => setRecuAu(e.target.value)} data-filtre-recu-au style={{ ...sel, flex: 'none', fontSize: 17 }}/></label>
              </> : null}
              {filtres.marques.length > 1 && <select aria-label="Marque" data-filtre-marque value={marque} onChange={(e) => setMarque(e.target.value)} style={{ ...sel, flex: 'none' }}><option value="">Toutes les marques</option>{filtres.marques.map((m) => <option key={m} value={m}>{m}</option>)}</select>}
              {filtres.tailles.length > 1 && <select aria-label="Taille" data-filtre-taille value={taille} onChange={(e) => setTaille(e.target.value)} style={{ ...sel, flex: 'none' }}><option value="">Toutes les tailles</option>{filtres.tailles.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
              {nFiltres ? <Bouton variante="discret" data-filtres-effacer onClick={() => { setPrixMin(''); setPrixMax(''); setRecuDu(''); setRecuAu(''); setMarque(''); setTaille(''); }} style={{ minHeight: 44, gridColumn: '1 / -1', justifySelf: 'start' }}>Effacer les filtres</Bouton> : null}
            </div>
          )}
          {plus && receptionDe && receptionEtat !== 'lu' ? <div data-receptions-etat={receptionEtat} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{receptionEtat === 'lecture' ? 'Je lis les dates de réception de tes achats…' : 'Dates de réception pas lues : seules « Je l’ai retiré » comptent.'}</div> : null}
          {detail.sansReception > 0 && <div data-achats-sans-reception={detail.sansReception} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{detail.sansReception} achat{detail.sansReception > 1 ? 's' : ''} sans date de réception lue, pas dans cette liste.</div>}
          {liste.length ? liste.slice(0, 200).map((a) => ligne(a, { 'data-achat-libre': String(a.transaction_id) })) : <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>—</div>}
        </div>
      )}
    </div>
  );
}
export { AchatsHorsPlateforme, FeuilleRecuAchat, RelierAchatCorps };
