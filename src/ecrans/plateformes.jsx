// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import { formaterMontantEbay } from "../montantsEbay.js";
import React, { useState, useEffect, Suspense } from "react";
import { etatCommandeEbay } from "../../api/_lib/ebay-etat-commande.js";
import { photoCommande, photoArticle } from "../photosArticles.js";
import { EbayCommande } from "../ebayGestion.jsx";
import { AUTH, Btn, C, CARRIERS, Card, EBAY_SKIN, EQUIPE_NON_INSTALLE_TXT, EXT_CAPACITES, FermeAuRetour, FraicheurDonnees, INV_STATUS, Icon, KpiVentes, LBC_ORANGE, LignePanne, LigneVenteCompacte, Operations, PICKUP_MAX_DAYS, PhotoArticleAgrandissable, PhotoVente, PhotoVinted, QrColis, SUPABASE_URL, ScreenHead, Skeleton, THEMES, TeteEquipe, _acctCache, _persistAcctCache, aExpedier, achatsMasques, askConfirm, boiteEquipe, caEbayPayees, caParPlateforme, cadreEquipe, codeRetrait, dansVueEbay, drawBordereauStamp, ecrireAchatsMasques, enTeteSession, extSait, fetchHarvestOrders, fmt, ilYaCourt, isAtRelayStatus, joursAvant, lbcAnnulee, lbcEuro, lbcExpediee, lbcFinalisee, libererOngletPdf, lireEbayTous, lirePdfLigne, load, messagePdfManquant, nomCompteEbay, onCloudReady, orderPhoto, ouvrirPdfOnglet, posePrefsImpression, qrImage, reclassifyTrack, save, sbAuth, texteEnLigne, toast, tusDe, useVueSession } from "../App.jsx";

// L'étape d'un ACHAT Leboncoin, dans les mêmes mots et les mêmes couleurs que
// celle d'un achat Vinted (`etapeAchat`) : Annulé · Reçu · En transit · Payé.
// Elle lit ce que l'extension capte (colis, liste v3), jamais un mot deviné.
function etapeAchatLbc(o) {
  if (lbcAnnulee(o)) return { label: 'Annulé', step: 0, color: C.danger };
  if (lbcFinalisee(o)) return { label: 'Reçu', step: 4, color: INV_STATUS.online.color };
  if (lbcExpediee(o)) return { label: 'En transit', step: 2, color: C.blue || C.accent };
  const s = String(o.stepLabel || '').trim();
  return { label: s ? (s.length > 26 ? s.slice(0, 26) + '…' : s) : 'Payé', step: 1, color: C.muted };
}

// ── L'ÉCRAN DU MEMBRE : les colis du vendeur, et rien d'autre ─────────────
// Chaque lecture porte l'en-tête `x-vrm-equipe` (la base ne montre les lignes
// du vendeur que dans une requête qui le DEMANDE) ET `owner=eq.<vendeur>` (ses
// lignes à lui, même s'il est vendeur de son côté). Rien d'autre n'est lu :
// ni `main`, ni les comptes Vinted, ni les transactions — la liste des ventes
// vient de la projection SANS MONTANT `vrm_equipe_colis`.
async function lireColisEquipe(vendeur) {
  const h = sbAuth({ 'x-vrm-equipe': vendeur });
  const own = `owner=eq.${encodeURIComponent(vendeur)}`;
  const lit = async (chemin, init) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { ...(init || {}), headers: { ...h, ...((init && init.headers) || {}) } });
      const t = await r.text().catch(() => '');
      if (r.status === 404 || /PGRST202/.test(t)) return { absent: true };
      if (!r.ok) return null;
      try { return { v: t === '' ? null : JSON.parse(t) }; } catch (_) { return null; }
    } catch (_) { return null; }
  };
  const champsBord = ['uid','modele','numero','article','filename','dateLimite','receivedAt','transaction'].map(c => `${c}:meta->>${c}`).join(',');
  const [p, bords, labels, relais, tracks] = await Promise.all([
    lit('rpc/vrm_equipe_colis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_vendeur: vendeur }) }),
    lit(`app_data?${own}&id=like.email_bord_*&select=id,${champsBord}`),
    lit(`app_data?${own}&id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,tx:meta->>tx,item:meta->>item`),
    lit(`app_data?${own}&id=eq.panel_colis_relais&select=data`),
    lit(`app_data?${own}&id=like.email_track_*&select=id,data`),
  ]);
  if (p && p.absent) return { nonInstalle: true };
  if (!p) return null;
  if (p.v === null) return { sansAcces: true };       // plus membre actif (ou accès du vendeur coupé)
  const v = p.v || {};
  const liste = (x) => (x && !x.absent && Array.isArray(x.v) ? x.v : null);
  return {
    ventes: Array.isArray(v.ventes) ? v.ventes : [], achats: Array.isArray(v.achats) ? v.achats : [],
    comptes: (v.comptes && typeof v.comptes === 'object') ? v.comptes : {},
    postes: new Set((Array.isArray(v.postes) ? v.postes : []).map(String)),
    retires: new Set((Array.isArray(v.retires) ? v.retires : []).map(String)),
    bords: liste(bords), labels: liste(labels),
    relais: (() => { const l = liste(relais); return l === null ? null : ((l[0] && l[0].data) || {}); })(),
    tracks: (() => { const l = liste(tracks); return l === null ? null : l.map((r) => reclassifyTrack(r && r.data)).filter(Boolean); })(),
  };
}
// Imprimer un bordereau de l'équipe : les octets lus AVEC l'en-tête, tamponnés
// du N° que porte la ligne de l'email (le vendeur, lui, l'a numérotée) — le
// membre ne lit jamais `main`, il ne recalcule donc aucun numéro.
async function imprimerBordereauEquipe(vendeur, row, numero, titre) {
  const lu = await lirePdfLigne(row, '', { 'x-vrm-equipe': vendeur });
  if (!lu || !lu.octets) { libererOngletPdf(); return { ok: false, message: messagePdfManquant(lu) }; }
  try {
    const PL = await import('pdf-lib');
    const { PDFDocument, rgb, StandardFonts } = PL;
    const pdf = await PDFDocument.load(lu.octets);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    drawBordereauStamp(pdf, rgb, bold, reg, numero || '', titre || '');
    posePrefsImpression(PL, pdf);
    const url = URL.createObjectURL(new Blob([await pdf.save()], { type: 'application/pdf' }));
    return { ok: true, url, ouvert: ouvrirPdfOnglet(url) };
  } catch (_) { libererOngletPdf(); return { ok: false, message: "Ce PDF n'a pas pu être lu." }; }
}
function PlateformeLogo({ p, title }) {
  const M = {
    vinted: { bg: '#09B1BA', t: 'Vinted' },
    lbc:    { bg: LBC_ORANGE, t: 'leboncoin' },
    ebay:   { bg: '#3665F3', t: 'eBay' },
  };
  const m = M[p]; if (!m) return null;
  return (
    <span title={title || m.t} aria-label={m.t} style={{
      display:'inline-flex', alignItems:'center', height:16, padding:'0 6px',
      background:'transparent', color:m.bg, borderRadius:0, fontSize:11, fontWeight:700,
      lineHeight:1, flexShrink:0, whiteSpace:'nowrap' }}>{m.t}</span>
  );
}
function PrixMarche({ data, baseKO }) {
  const eur2 = (n) => n.toFixed(n % 1 ? 2 : 0).replace('.', ',');
  const groups = data && data.groups;
  const valo = data && data.valo;
  const eti = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 };
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHead icon="chart" title="Le prix qui marche"
        desc="Ce que tes ventes disent du prix — par modèle et taille, pour tarifer et racheter juste." />
      {baseKO ? (
        <LignePanne>Je n'ai pas pu lire tes ventes — un prix médian faux serait pire que pas de prix. Rien n'est perdu : c'est la lecture qui a échoué.</LignePanne>
      ) : groups == null ? (
        <div style={{ fontSize: 13, color: C.muted }}>Lecture de tes ventes…</div>
      ) : (<>
        {valo && valo.reconnu > 0 && (
          <Card style={{ padding: 18 }}>
            <div style={{ ...eti, marginBottom: 4 }}>Valeur de ton stock en ligne · au prix du marché</div>
            <div className="vrm-display" style={{ fontSize: 30, fontWeight: 700, color: C.text }}>≈ {eur2(valo.marche)} €</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              Sur <b>{valo.reconnu}</b> annonce{valo.reconnu > 1 ? 's' : ''} en ligne dont on connaît le prix du marché{valo.total > valo.reconnu ? <> (sur {valo.total} — les autres n'ont pas encore 2 ventes du même modèle+taille)</> : null}.
              {valo.affiche > 0 && (() => { const ec = Math.round((valo.affiche / valo.marche - 1) * 100);
                return <> Tu les affiches à ≈ <b>{eur2(valo.affiche)} €</b>{Math.abs(ec) >= 5 ? <> — soit <b style={{ color: C.text }}>{ec > 0 ? '+' : ''}{ec}%</b> {ec > 0 ? 'au-dessus' : 'en dessous'} du marché</> : ' — en ligne avec le marché'}.</>; })()}
            </div>
          </Card>
        )}
        {groups.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
            Pas encore assez de ventes pour dégager un prix fiable — il faut <b>au moins deux ventes</b> d'un même modèle dans une même taille. Ça se remplira tout seul au fil de tes ventes.
          </div>
        </Card>
      ) : (<>
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
          Calculé sur tes <b>ventes finalisées</b>, regroupées par <b>modèle + taille</b> (au moins 2 ventes). Un modèle hors des grands connus n'apparaît pas — mieux vaut un blanc qu'un faux. Trié par ce qui se vend le plus.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((gr, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: '11px 14px', boxShadow: C.shadow || 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
                  {gr.modele} <span style={{ color: C.accent, fontWeight: 700, textTransform: 'none' }}>T{gr.taille}</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                  {gr.n} vente{gr.n > 1 ? 's' : ''} · de {eur2(gr.min)} à {eur2(gr.max)} €{gr.stock > 0 ? ` · ${gr.stock} en stock` : ''}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Prix médian</div>
                <div className="vrm-display" style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{eur2(gr.med)} €</div>
              </div>
            </div>
          ))}
        </div>
      </>)}
      </>)}
    </div>
  );
}
function FiltresVentes({ value, onChange, search, onSearch, cancelled = false, doneLabel = 'Finalisées', count }) {
  const tabs=[['all','Toutes'],['pending','À expédier'],['done',doneLabel],...(cancelled?[['cancelled','Annulées']]:[])];
  return <div className="vrm-workbar vrm-shared-workbar">
    <input aria-label="Rechercher une vente" type="search" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Rechercher une vente…" style={{width:'100%',padding:'9px 12px',fontSize:13,border:`1px solid ${C.border}`,borderRadius:8,background:C.card,color:C.text,marginBottom:10}}/>
    <div className="vrm-rangee vrm-sales-filters vrm-filtres" role="group" aria-label="Filtrer les ventes" style={{display:'flex',gap:6,marginBottom:10}}>{tabs.map(([id,label])=><button key={id} type="button" aria-pressed={value===id} onClick={()=>onChange(id)} style={{whiteSpace:'nowrap',flexShrink:0,padding:'7px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:value===id?C.accent:'transparent',color:value===id?C.onAccent:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>{label}</button>)}</div>
    {(search || value!=='all') && <div className="vrm-filter-recap"><span role="status">{count==null?'Filtres actifs':`${count} résultat${count===1?'':'s'}`}</span><button type="button" onClick={()=>{onSearch('');onChange('all');}}>Réinitialiser</button></div>}
  </div>;
}
function LigneVente({ photo, titre, meta, montant, actions, etat, etatNoeud = null, details }) {
  return <LigneVenteCompacte photo={photo} titre={titre} etat={etat} etatNoeud={etatNoeud} montant={montant} initialOuvert={!!details?.props.ouvrir} className="vrm-sale-row vrm-shared-sale" style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`}}>
    <div className="vrm-sale-overview" style={{display:'flex',gap:12,alignItems:'flex-start'}}>
      <div className="vrm-sale-photo"><PhotoArticleAgrandissable src={photo} titre={titre}><PhotoVente src={photo} size={64} portrait/></PhotoArticleAgrandissable></div>
      <div className="vrm-sale-info" style={{flex:1,minWidth:0}}>
        <div className="vrm-sale-title" style={{fontSize:14,fontWeight:600,lineHeight:1.3,color:C.text}}>{titre || '(sans titre)'}</div>
        <div className="vrm-sale-meta" style={{fontSize:11.5,color:C.muted,marginTop:4}}>{meta}</div>
      </div>
      <div className="vrm-sale-price" style={{textAlign:'right',flexShrink:0}}><span className="vrm-display" style={{fontSize:17,fontWeight:700,color:C.text}}>{montant}</span>{actions}</div>
    </div>
    {details}
  </LigneVenteCompacte>;
}
// Carte d'une transaction Leboncoin — comme Vinted : photo · titre · statut +
// transporteur · prix. Partagée par Ventes ET Achats (§11 : une seule forme).
function CarteLbc({ o }) {
  return <LigneVente photo={photoArticle(o)} titre={o.title} montant={lbcEuro(o.price)} etat={o.stepLabel || o.stepStatus || ''}
    meta={<>{o.stepLabel || o.stepStatus || ''}{o.deliveryLabel ? ` · ${o.deliveryLabel}` : ''}</>}/>;
}
// UNE LIGNE D'ACHAT, la forme de l'écran Achats Vinted (`vrm-buy-row` : photo ·
// titre + statut à pastille · prix · gestes). Partagée par les achats
// Leboncoin (et la même structure est rendue par les achats eBay) — Julien :
// « les achats Leboncoin et eBay doivent fonctionner exactement comme Vinted ».
function LigneAchat({ photo, titre, statut, meta, montant, actions, sous, attenue, data }) {
  return (
    <div className="vrm-buy-row" {...(data || {})} style={{ opacity: attenue ? 0.55 : 1 }}>
      <div className="vrm-buy-ph" style={{ background: C.card2 || C.bg }}>
        {photo ? <PhotoVinted src={photo} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }} />}
      </div>
      <div className="vrm-buy-main">
        <div className="vrm-buy-title" style={{ color: C.text }} title={titre || ''}>{titre || '(sans titre)'}</div>
        <div className="vrm-buy-meta" style={{ color: C.muted }}>
          {statut && <span className="vrm-buy-statut" style={{ color: C.text }}><i style={{ background: statut.color }} />{statut.label}</span>}
          {meta}
        </div>
        {sous}
      </div>
      <div className="vrm-buy-price" style={{ color: C.text }}>{montant}</div>
      <div className="vrm-buy-act">{actions}</div>
    </div>
  );
}
function LigneAchatLbc({ o }) {
  const [qr, setQr] = React.useState(false);
  const st = etapeAchatLbc(o);
  const lbl = o.label || {};
  const enCours = st.step >= 1 && st.step < 4;
  const qrUrl = enCours && /^https?:\/\//.test(String(lbl.qrUrl || '')) ? lbl.qrUrl : '';
  const suivi = enCours && /^https?:\/\//.test(String(lbl.trackingUrl || '')) ? lbl.trackingUrl : '';
  const date = o.dateVente ? new Date(o.dateVente) : null;
  return <LigneAchat data={{ 'data-lbc-achat': String(o.txId || '') }} attenue={st.step === 0}
    photo={photoArticle(o)} titre={o.title} statut={st} montant={lbcEuro(o.price)}
    meta={<>{date && !isNaN(date) && <span style={{ whiteSpace: 'nowrap' }}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}{o.deliveryLabel && <span>· {o.deliveryLabel}</span>}</>}
    sous={qr && qrUrl ? <div style={{ marginTop: 8 }}><QrColis url={qrUrl} size={120} /></div> : null}
    actions={<>
      {suivi && <a className="vrm-buy-quick" href={suivi} target="_blank" rel="noreferrer" title="Suivre le colis" aria-label="Suivre le colis" style={{ color: C.muted }}><Icon name="truck" size={16} /></a>}
      {qrUrl && <button className="vrm-icon-control vrm-buy-quick" type="button" data-lbc-achat-qr="" onClick={() => setQr(v => !v)} title="QR du colis" aria-label="QR du colis" aria-expanded={qr} style={{ color: C.warn }}><Icon name="key" size={16} /></button>}
    </>} />;
}
function VentesLeboncoin({ lbcVentes = {ventes:[],inconnues:0}, sansTotaux = false }) {
  const [filtre,setFiltre]=useVueSession('leboncoin-ventes-filtre','all');
  const [recherche,setRecherche]=useVueSession('leboncoin-ventes-recherche','');
  const ventes=lbcVentes.ventes || [];
  const visibles=ventes.filter(o=>(!recherche || String(o.title || '').toLowerCase().includes(recherche.toLowerCase()))
    && (filtre==='all' || (filtre==='cancelled'?lbcAnnulee(o):filtre==='done'?lbcFinalisee(o):!lbcAnnulee(o)&&!lbcFinalisee(o))));
  return <div>
    <ScreenHead icon="cash" title="Ventes"/>
    <FiltresVentes value={filtre} onChange={setFiltre} search={recherche} onSearch={setRecherche} count={visibles.length} cancelled/>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>{visibles.map(o=><CarteLbc key={o.txId} o={o}/>)}</div>
    {!visibles.length && <p style={{fontSize:12,color:C.muted,padding:'12px 0'}}>Aucune vente dans cette sélection.</p>}
    {lbcVentes.inconnues>0 && <details style={{marginTop:12,fontSize:12,color:C.muted}}><summary>Transactions à confirmer ({lbcVentes.inconnues})</summary><p>Ouvre tes transactions sur Leboncoin pour lire leur côté acheteur ou vendeur.</p></details>}
  </div>;
}
// Ses ACHATS Leboncoin — demande de Julien (29 sept.) : « ajoute les photos et
// les informations pour les achats ET les ventes ». Même donnée que les ventes
// (`lbc_ventes`, chaque transaction), côté ACHETEUR : `isSeller === false`
// (jamais déduit, §5). Même carte, même séparation « reçu / en cours » que les
// ventes — côté achat « finalisé » = colis reçu. Photo + titre + statut + prix.
function AchatsLeboncoin({ lbcVentes = { achats: [] } }) {
  const achats = (lbcVentes.achats || []);
  // (17 oct., revue) La section « Achats » est toujours dans la navigation :
  // rendre `null` laissait un écran BLANC sous le titre (vu au rendu). Une
  // liste vide a une cause, et une cause se dit — jamais lu (« — ») n'est pas
  // « aucun achat » (lu, vide).
  if (achats.length === 0) {
    const lu = !!lbcVentes.maj;
    return (
      <div data-lbc-achats-vide={lu ? 'lu' : 'jamais'} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '14px 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>Achats Leboncoin</div>
        {lu
          ? <>Aucun achat Leboncoin dans ta dernière lecture ({ilYaCourt(lbcVentes.maj)}).</>
          : <>Tes achats Leboncoin arrivent quand l’extension passe sur leboncoin.fr (« Mes transactions »). Seules les transactions où tu es l’acheteur sont rangées ici.</>}
      </div>
    );
  }
  const actives = achats.filter(o => !lbcAnnulee(o));
  const recus = actives.filter(lbcFinalisee);
  const enRoute = actives.filter(o => !lbcFinalisee(o));
  const annules = achats.filter(lbcAnnulee);
  const somme = (arr) => arr.reduce((s, o) => s + (o.price != null ? Number(o.price) / 100 : 0), 0);
  const fmt2 = (n) => n.toFixed(2).replace('.', ',') + ' €';
  const Liste = ({ arr }) => <div className="vrm-buy-list" style={{ background: C.card, border: `1px solid ${C.border}`, marginTop: 6 }}>{arr.map(o => <LigneAchatLbc key={o.txId} o={o} />)}</div>;
  return (
    <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PlateformeLogo p="lbc" />
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Achats Leboncoin{achats.length ? ` (${achats.length})` : ''}</div>
      </div>
      {/* Côté achat : « Reçus » = colis arrivé · « En route » = en cours de
          livraison. Deux chiffres, deux mots, jamais mélangés (comme les ventes). */}
      {actives.length > 0 && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '2px 0 10px' }}>
          <div>
            <div className="vrm-display" style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmt2(somme(recus))}</div>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Reçus · {recus.length}</div>
          </div>
          <div>
            <div className="vrm-display" style={{ fontSize: 20, fontWeight: 800, color: C.muted }}>{fmt2(somme(enRoute))}</div>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>En route · {enRoute.length}</div>
          </div>
        </div>
      )}
      {enRoute.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '6px 0 0' }}>En cours de livraison ({enRoute.length})</div>
        <Liste arr={enRoute}/>
        {/* (17 oct.) OÙ ARRIVE LE CODE D'UN COLIS LEBONCOIN. Mesuré sur sa base :
            une transaction Leboncoin ne porte NI point de retrait NI code (champs
            captés : statut, transporteur, prix). Le code vient de l'e-mail du
            transporteur — qui ne dit pas de quelle plateforme vient le colis :
            il rejoint donc la liste « À retirer » des achats, comme ceux de
            Vinted. On le dit une fois, plutôt qu'un « en route » muet. */}
        {enRoute.some(o => o.deliveryLabel) && <div data-lbc-code-ou="" style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>Quand un colis arrive au point relais, son code de retrait vient de l’e-mail du transporteur : il s’affiche dans Achats → À retirer, avec les colis Vinted.</div>}
      </>)}
      {recus.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '12px 0 0' }}>Reçus ({recus.length})</div>
        <Liste arr={recus}/>
      </>)}
      {annules.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '12px 0 0' }}>Annulés / remboursés ({annules.length})</div>
        <Liste arr={annules}/>
      </>)}
    </div>
  );
}
function EbayVentes({ baseKO,vue='*',comptesEbay,cible,onClearCible }) {
  const E = EBAY_SKIN;
  const [filtre,setFiltre]=useVueSession('ebay-ventes-filtre','all');
  const [recherche,setRecherche]=useVueSession('ebay-ventes-recherche','');
  const [couts,setCouts]=React.useState(()=>load('vrm_ebay_couts',{}));
  const touched=React.useRef(false);
  React.useEffect(()=>onCloudReady(()=>{if(!touched.current)setCouts(load('vrm_ebay_couts',{}));}),[]);
  const sauverCouts=(compte,id,patch)=>{touched.current=true;setCouts(prev=>{const k=JSON.stringify([compte,String(id)]),next={...prev,[k]:{...(prev[k]||{}),...patch}};save('vrm_ebay_couts',next);return next;});};
  const [annonces, setAnnonces] = React.useState([]);
  const [lu,setLu]=React.useState(undefined);
  React.useEffect(()=>{if(comptesEbay===undefined)return;let stop=false;(async()=>{
    if(comptesEbay===null){if(!stop)setLu(null);return;}
    const r=await lireEbayTous('ebay_orders','orders:data->orders','orders',comptesEbay);
    const photos=await lireEbayTous('ebay_listings','items:data->items','items',comptesEbay);
    if(!stop){setLu(r);setAnnonces(photos?.items || []);}
  })();return()=>{stop=true;};},[comptesEbay]);
  const illisibles=lu?lu.illisibles.filter(c=>dansVueEbay({_compte:c.ref},vue)):[];
  const orders=lu===undefined?undefined:lu===null?null:lu.items.filter(o=>dansVueEbay(o,vue));
  const wrap = (kids) => <div className="vrm-ebay-sales" style={{ padding: 16, paddingBottom: 48 }}>{kids}</div>;
  const head = <ScreenHead icon="cash" title="Ventes eBay"/>;
  if (baseKO) return wrap(<>{head}<div style={{ color: E.muted, fontSize: 13, marginTop: 10 }}>Je n'ai pas pu lire tes données — rien n'est perdu, c'est la lecture qui a échoué. Réessaie dans un instant.</div></>);
  if (orders === undefined) return wrap(<>{head}<Skeleton variant="row" count={3}/></>);
  if (orders === null) return wrap(<>{head}<div style={{ color: E.muted, fontSize: 13, marginTop: 10 }}>Je n'ai pas pu lire tes ventes eBay. Réessaie dans un instant.</div></>);
  // (17 oct.) Les trois cases, même sans vente (Julien : « ça motive à remplir
  // ces cases »). Lu et vide ⇒ 0 ; un compte illisible ⇒ « — » (pas su).
  const plusieursEbay = Array.isArray(comptesEbay) && comptesEbay.length >= 2;
  const kpi = (() => {
    // (17 oct., revue) Aucune ligne de commandes rangée (jamais synchronisé,
    // aucun compte relié) : rien n'a été LU — « — », pas un 0 inventé (§5).
    const jamais = !!(lu && Array.isArray(lu.lignes) && lu.lignes.length && lu.lignes.every((x) => x.ligne === null) && !orders.length);
    const passu = illisibles.length > 0 || jamais;
    const enCours = orders.filter((o) => { const e = etatCommandeEbay(o); return e.peutExpedier || e.kind === 'review' || e.kind === 'payment'; });
    const exp = orders.filter((o) => etatCommandeEbay(o).expedie);
    const ca = caEbayPayees(orders);
    const aPayee = orders.some((o) => String((o && o.orderPaymentStatus) || '').toUpperCase() === 'PAID');
    const caVal = passu ? null : (aPayee ? (ca == null ? null : fmt(ca)) : fmt(0));
    return <KpiVentes plateforme="ebay" tuiles={[
      { cle: 'encours', lib: 'En cours', val: passu ? null : enCours.length },
      { cle: 'finalisees', lib: 'Expédiées', val: passu ? null : exp.length },
      { cle: 'ca', lib: 'CA payé', val: caVal, brut: caVal == null ? null : (aPayee ? ca : 0), sub: plusieursEbay ? (vue === '*' ? `${comptesEbay.length} comptes` : nomCompteEbay(comptesEbay.find((c) => c.ref === vue) || {})) : null },
    ]} note={jamais ? "Aucune vente eBay lue pour l'instant : relie ton compte dans « Compte » et synchronise — tes commandes, leur expédition et leur suivi arriveront ici." : passu ? `Je n'ai pas pu lire les ventes ${illisibles.length > 1 ? 'des comptes eBay' : 'du compte eBay'} ${illisibles.map(nomCompteEbay).join(', ')} — rien n'est perdu, réessaie dans un moment.` : !orders.length ? "Pas encore de vente eBay. Relie ton compte dans « Compte » et synchronise : tes commandes, leur expédition et leur suivi arrivent ici." : null}/>;
  })();
  if (!orders.length && !cible) return wrap(<>{head}{kpi}</>);
  const euro = formaterMontantEbay;
  const payees = orders.filter(o => String((o && o.orderPaymentStatus) || '').toUpperCase() === 'PAID').length;
  const visibles=orders.filter(o=>{
    if(cible)return String(o.orderId)===cible.id && (o._compte || 'principal')===cible.compte;
    const termes=[o.orderId,o.buyer?.username,o._pseudo,...(o.lineItems || []).flatMap(li=>[li.title,li.sku,li.legacyItemId])].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR');
    const etat=etatCommandeEbay(o);
    return (!recherche.trim() || termes.includes(recherche.trim().toLocaleLowerCase('fr-FR'))) && (filtre==='all' || (filtre==='done'?etat.expedie:etat.peutExpedier));
  });
  return wrap(<>
    {head}
    {!cible && kpi}
    {illisibles.length>0 && cible && <p role="status" style={{fontSize:12,color:E.muted}}>Lecture indisponible : {illisibles.map(nomCompteEbay).join(', ')}. Les autres comptes restent visibles.</p>}
    {cible && <div style={{fontSize:12,marginBottom:10}}>Commande {cible.id} <button type="button" onClick={onClearCible}>Voir toutes les commandes</button></div>}
    {cible && !orders.some(o=>String(o.orderId)===cible.id && (o._compte || 'principal')===cible.compte) && <div className="vrm-ebay-order" data-ebay-vente={cible.id} data-ebay-compte={cible.compte}><p style={{fontSize:12,color:E.muted}}>Lecture directe de la commande {cible.id}.</p><EbayCommande owner={AUTH.user?.id || 'installation'} key={cible.compte+':'+cible.id} order={{orderId:cible.id}} ouvrir compte={cible.compte} headers={enTeteSession} confirm={askConfirm} theme={C} costs={couts[JSON.stringify([cible.compte,cible.id])] || {}} onCosts={patch=>sauverCouts(cible.compte,cible.id,patch)}/></div>}
    {!cible && <FiltresVentes value={filtre} onChange={setFiltre} search={recherche} onSearch={setRecherche} count={visibles.length} doneLabel="Expédiées"/>}
    {!cible && <div className="vrm-ebay-results" role="status">{visibles.length} commande{visibles.length>1?'s':''} affichée{visibles.length>1?'s':''}{(recherche || filtre!=='all') && <button type="button" onClick={()=>{setRecherche('');setFiltre('all');}}>Effacer les filtres</button>}</div>}
    {!cible && !visibles.length && <div className="vrm-ebay-empty"><b>Aucune commande dans cette sélection</b><p>Essaie un titre, un acheteur, une référence ou un numéro de commande.</p></div>}
    <div style={{ background: E.card, border: `1px solid ${E.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {visibles.map((o, i) => {
        const li = (o.lineItems && o.lineItems[0]) || {};
        const img = photoCommande(o, annonces.filter(a=>(a._compte || 'principal')===(o._compte || 'principal')));
        const etat=etatCommandeEbay(o);
        const statut=etat.label;

        return <div className="vrm-ebay-order" data-ebay-vente={o.orderId} data-ebay-compte={o._compte || 'principal'} key={(o._compte || 'principal')+':'+(o.orderId || i)}><LigneVente photo={img} titre={li.title} etat={statut}
          etatNoeud={<><span className="vrm-ebay-sale-status" data-state={etat.peutExpedier?'pending':etat.expedie?'shipped':'neutral'} style={{display:'inline-flex',alignItems:'center',gap:5,padding:0,background:'transparent',boxShadow:'none',borderRadius:0,fontSize:'inherit',color:C.text,fontWeight:600}}><span aria-hidden="true" style={{width:7,height:7,borderRadius:999,flexShrink:0,display:'inline-block',background:etat.peutExpedier?C.warn:etat.expedie?(C.blue||C.accent):C.muted}}/>{statut}</span>{comptesEbay?.length>1 && <span data-ebay-ligne-compte="" style={{color:C.muted,fontWeight:500}}>{' · '}{o._pseudo || nomCompteEbay(comptesEbay.find(c=>c.ref===o._compte) || {})}</span>}</>}
          meta={<>{statut}{o.buyer?.username ? ` · ${o.buyer.username}` : ''}{o.lineItems?.length>1?` · ${o.lineItems.length} articles`:''}{comptesEbay?.length>1?` · ${o._pseudo || nomCompteEbay(comptesEbay.find(c=>c.ref===o._compte) || {})}`:''}</>}
          montant={euro(o.pricingSummary?.total?.value, o.pricingSummary?.total?.currency)} details={<EbayCommande owner={AUTH.user?.id || 'installation'} order={o} ouvrir={!!cible && cible.id===String(o.orderId) && cible.compte===(o._compte || 'principal')} costs={couts[JSON.stringify([o._compte || 'principal',String(o.orderId)])] || {}} onCosts={patch=>sauverCouts(o._compte || 'principal',o.orderId,patch)} compte={o._compte || 'principal'} headers={enTeteSession} confirm={askConfirm} theme={C}/>}/></div>;

      })}
    </div>
  </>);
}
// (17 oct.) Les achats eBay sont lus (Trading GetMyeBayBuying) : `EbayAchats`
// vit dans ebayGestion.jsx, avec les retours, annulations et la promotion.
// ── VESTIAIRE : OÙ EN EST LA MESURE DU SITE (4 octobre, extension 5.154) ─────
// On ne chiffre AUCUNE vente Vestiaire tant que la mesure n'a pas montré où vit
// une vente, son montant net et sa date. En attendant, l'écran dit où en est la
// mesure et quel geste la fait avancer — lu sur les SCALAIRES de `vc_recon`
// (colonne meta, §4.4 : jamais la ligne entière).
// Trois états, jamais deux : `undefined` en cours · `null` pas su · objet lu
// (`{}` = jamais relevé).
function VestiaireMesure() {
  const [m, setM] = useState(undefined);
  useEffect(() => { let stop = false; (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_recon&select=vuAt:meta->>vuAt,ver:meta->>ver,nChemins:meta->>nChemins,nPages:meta->>nPages,nSchemas:meta->>nSchemas`, { headers: sbAuth() });
      if (!r.ok) { if (!stop) setM(null); return; }
      const j = await r.json();
      if (!stop) setM(Array.isArray(j) ? (j[0] || {}) : null);
    } catch (_) { if (!stop) setM(null); }
  })(); return () => { stop = true; }; }, []);
  const cap = extSait('vestiaire');
  if (m === undefined) return null;
  const vu = m && m.vuAt ? Date.parse(m.vuAt) : 0;
  const age = vu ? (() => { const h = Math.round((Date.now() - vu) / 3600000); return h < 1 ? "il y a moins d'une heure" : h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`; })() : '';
  const style = { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.muted, lineHeight: 1.55 };
  if (m === null) return <div data-vc-mesure="pas-su" style={style}>Je n'ai pas pu lire où en est la mesure de Vestiaire — rien n'est perdu, réessaie dans un moment.</div>;
  if (vu) return (
    <div data-vc-mesure="lu" style={style}>
      <b style={{ color: C.text }}>VRM apprend à lire Vestiaire.</b> Dernier relevé {age} : {Number(m.nPages) || 0} page{Number(m.nPages) > 1 ? 's' : ''}, {Number(m.nChemins) || 0} appel{Number(m.nChemins) > 1 ? 's' : ''}, {Number(m.nSchemas) || 0} forme{Number(m.nSchemas) > 1 ? 's' : ''} de réponse relevés — la forme des pages, jamais leur contenu. Passe sur <b>tes ventes</b>, <b>tes articles</b> et <b>tes paiements</b> pour compléter la carte.
    </div>
  );
  return (
    <div data-vc-mesure="jamais" style={style}>
      {cap === 'ok' ? <>Pour que VRM apprenne à le lire : ouvre <b>Vestiaire Collective</b> dans ce Chrome, connecté à ton compte vendeur, et passe sur tes ventes, tes articles et tes paiements. L'extension relève la <b>forme</b> des pages — jamais leur contenu.</>
        : cap === 'retard' ? <>Pour que VRM apprenne à lire Vestiaire, l'extension doit passer en <b>{EXT_CAPACITES.vestiaire}</b> : celle installée ne sait pas encore l'observer. Mets-la à jour depuis <b>Réglages</b>.</>
        : <>C'est l'extension, dans le Chrome de ton ordinateur, qui apprendra à lire Vestiaire quand tu y passes.</>}
    </div>
  );
}

function Plateforme({ plat, liveStats, lbcVentes = {ventes:[],inconnues:0}, ebayCa = null, comptes = [], onGo, onSub, baseKO }) {
  const p = caParPlateforme(liveStats, lbcVentes, ebayCa).find(x => x.nom === plat) || { nom:plat, ca:null };
  // Les cartes du hub ouvrent une SECTION dans l'onglet (onSub) si l'appelant le
  // permet ; sinon (compat) elles naviguent vers l'écran séparé (onGo).
  const aller = (section, tabId) => (onSub ? onSub(section) : (onGo && onGo(tabId)));
  const estVinted = plat === 'Vinted';
  const ventesVinted = liveStats && liveStats.soldTotal != null ? liveStats.soldTotal : null;
  const enAttente = liveStats && liveStats.enCours != null ? liveStats.enCours : null;
  // Argent Vinted : « disponible » et « en attente » sont DEUX montants qui ne
  // se confondent jamais (§5.14). Consommés de liveStats (même source que Ma
  // journée et Statistiques, §11) — jamais recalculés ici.
  const wDispo   = liveStats && liveStats.walletDispo   != null ? liveStats.walletDispo   : null;
  const wAttente = liveStats && liveStats.walletAttente != null ? liveStats.walletAttente : null;
  const wComptes = (liveStats && liveStats.walletComptes) || 0;
  const wAge     = liveStats && liveStats.walletAgeJours != null ? liveStats.walletAgeJours : null;
  // Âge de la capture la plus ancienne : explique un colis déjà parti qui traîne.
  const dAge     = liveStats && liveStats.dataAgeJours != null ? liveStats.dataAgeJours : null;
  // (16 oct.) Le nom entier, partout : « Vestiaire Collective », jamais « Vestiaire ».
  const court = plat;
  const carte = {textAlign:'left',border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'13px 15px',cursor:'pointer',fontFamily:'inherit'};
  const eti = {fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500};
  const gros = {fontSize:24,fontWeight:700,color:C.text};
  // ⚠️ TOUT L'ÉCRAN eBay AU LOOK eBay (Julien, 27 sept. : « je veux exactement le
  // même visuel que dans eBay », « tout, rien ne va »). L'onglet eBay entier —
  // fond noir, en-tête eBay, cartes eBay — pas seulement le sous-formulaire.
  // Exception ASSUMÉE à §7, bornée à l'espace eBay, à la demande de l'owner.
  // eBay et Leboncoin n'ont plus d'« Aperçu » (3 oct.) : résumé + sections,
  // comme Vinted. Ce composant ne sert plus qu'aux plateformes non reliées.
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:18}}>
      <ScreenHead icon="tag" title={court} desc={estVinted ? 'Tes annonces, ventes et achats sur Vinted' : plat === 'Vestiaire Collective' ? 'Bientôt disponible' : `Ce que VRM sait de ${court}`}/>
      {baseKO ? (
        <LignePanne>Je n'ai pas pu lire tes données — les totaux seraient faux, on ne les affiche pas. Rien n'est perdu : c'est la lecture qui a échoué.</LignePanne>
      ) : estVinted ? (<>
        <FraicheurDonnees jours={dAge} compte={liveStats && liveStats.dataAgeCompte} comptes={liveStats && liveStats.dataAgeComptes}/>
        <Card style={{padding:18}}>
          <div style={{...eti,marginBottom:4}}>Vinted · chiffre d'affaires</div>
          <div className="vrm-display" style={{fontSize:30,fontWeight:700,color:C.text}}>{p.ca==null?'—':fmt(p.ca)}</div>
          <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{p.ca==null?'aucune vente finalisée captée pour l’instant':'ventes finalisées, tous comptes'}</div>
        </Card>
        {wComptes>0 && (
          <Card style={{padding:16}}>
            <div style={{...eti,marginBottom:8}}>Argent Vinted</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              <div>
                <div className="vrm-display" style={{fontSize:22,fontWeight:700,color:C.text}}>{wDispo==null?'—':fmt(wDispo)}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>disponible à virer</div>
              </div>
              <div>
                <div className="vrm-display" style={{fontSize:22,fontWeight:700,color:C.muted}}>{wAttente==null?'—':fmt(wAttente)}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>en attente (retenu par Vinted)</div>
              </div>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:8,lineHeight:1.5}}>
              Lu sur {wComptes} porte-monnaie{wComptes>1?'s':''}. Ce sont les chiffres de Vinted, pas une estimation.{wAge!=null && wAge>7 ? ` Le plus ancien date de ${wAge} j — repasse sur ces comptes pour rafraîchir.` : ''}
            </div>
          </Card>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))',gap:10}}>
          <button type="button" onClick={()=>aller('annonces','cat_annonces')} style={carte}>
            <div style={eti}>Annonces en ligne</div>
            <div className="vrm-display" style={gros}>{texteEnLigne(liveStats)}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Voir toutes les annonces ›</div>
          </button>
          <button type="button" onClick={()=>aller('ventes','cat_ventes')} style={carte}>
            <div style={eti}>Ventes finalisées</div>
            <div className="vrm-display" style={gros}>{ventesVinted==null?'—':ventesVinted}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{enAttente==null?'Voir les ventes ›':`+ ${enAttente} en cours · voir les ventes ›`}</div>
          </button>
          <button type="button" onClick={()=>aller('achats','cat_achats')} style={carte}>
            <div style={eti}>Achats</div>
            <div className="vrm-display" style={{...gros,fontSize:18,color:C.muted}}>Voir ›</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Tes commandes et colis reçus</div>
          </button>
        </div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>
          Les chiffres viennent du Tableau de bord et des écrans Ventes/Annonces — c'est la même source, ils ne peuvent pas se contredire.
        </div>
      </>) : (<>
        {/* Chaque site a son espace avec SES infos (Julien : « chaque info par
            site »). Le CA vient de `caParPlateforme` (§11) : pour Leboncoin il
            porte les ventes PROUVÉES par référence VRM (jamais un titre, §5) —
            on l'affiche vraiment, au lieu d'un « — » systématique. */}
        <Card style={{padding:18}}>
          <div style={{...eti,marginBottom:4}}>{court} · chiffre d'affaires</div>
          <div className="vrm-display" style={{fontSize:30,fontWeight:700,color:p.ca!=null?C.text:C.muted}}>{p.ca!=null?fmt(p.ca):'—'}</div>
          <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{p.ca!=null?'ventes prouvées captées':'pas encore de vente captée'}</div>
        </Card>
        <Card style={{padding:16}}>
          <div style={{fontSize:13.5,color:C.text,lineHeight:1.55}}>
            {plat==='Vestiaire Collective'
              ? <>Vestiaire Collective n'est <b>pas encore reliée</b> à VRM : rien n'y est capté aujourd'hui. Le jour où une vente y remontera, elle apparaîtra ici et dans le total — jamais un chiffre inventé avant.<VestiaireMesure/></>
              : plat==='Leboncoin'
              ? <>Ce que VRM sait de Leboncoin passe par l'extension (elle tourne sur leboncoin.fr). Prépare tes annonces depuis <b>À publier</b> ; une vente n'est comptée que si la <b>référence VRM</b> de l'annonce la relie à une paire — jamais par ressemblance de titre. Rien n'est inventé tant qu'il n'y a pas de donnée.</>
              : <>Aucune vente n'a encore été captée sur {court}. Tu prépares tes paires depuis l'écran <b>Annonces</b> (coche « aussi sur {court} ») ; dès qu'une vente y sera reconnue, son chiffre s'ajoutera ici et au total. Rien n'est inventé tant qu'il n'y a pas de donnée.</>}
          </div>
          {plat!=='Vestiaire Collective' && plat!=='Leboncoin' && (
            <button type="button" onClick={()=>onGo&&onGo('cat_annonces')} style={{marginTop:12,border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'10px 14px',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,color:C.text}}>
              Ouvrir l'écran Annonces →
            </button>
          )}
        </Card>
      </>)}
    </div>
  );
}

/* ── App ─────────────────────────────────────────────── */

/* ── BackupModal ─────────────────────────────────────── */
function BackupModal({catalog,sales,garageGrid,blockedCells,onClose,onImport}) {
  const exportData=()=>{
    const data={
      catalog,sales,garageGrid,blockedCells,
      exportedAt:new Date().toISOString(),
      version:'1.0',
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`vrm-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const importData=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async (ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.catalog&&!data.sales){
          toast('❌ Fichier invalide : pas de données détectées');
          return;
        }
        if(await askConfirm(`Importer cette sauvegarde ?\n\nCatalogue: ${data.catalog?.length||0} paires\nVentes: ${data.sales?.length||0} ventes\n\n⚠️ Tes données actuelles seront remplacées.`)){
          onImport(data);
        }
      }catch(err){
        toast('❌ Erreur de lecture : '+err.message);
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20,
      animation:'fadeIn 0.2s',
    }}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
        padding:24,maxWidth:480,width:'100%',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,color:C.accent,fontSize:20,fontWeight:600}}>💾 Sauvegarde</h3>
          <button className="vrm-icon-control" type="button" aria-label="Fermer la fenêtre" onClick={onClose} style={{background:'transparent',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}><Icon name="close" size={15}/></button>
        </div>
        
        <div style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.5}}>
          Sauvegarde toutes tes données (catalogue, ventes, garage) dans un fichier JSON. Tu peux le restaurer plus tard ou sur un autre appareil.
        </div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📤 Exporter</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              <b>{catalog.length}</b> paires · <b>{sales.length}</b> ventes
            </div>
            <Btn small onClick={exportData} color={C.accent}>💾 Télécharger sauvegarde</Btn>
          </div>

          <div style={{background:`${C.warn}11`,border:`1px solid ${C.warn}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📥 Restaurer</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              ⚠️ Cela remplacera toutes tes données actuelles
            </div>
            <label style={{display:'inline-block',cursor:'pointer'}}>
              <input type="file" accept=".json" onChange={importData} style={{display:'none'}}/>
              <span style={{
                display:'inline-block',background:C.warn,color:'#000',
                border:'none',borderRadius:8,padding:'5px 12px',
                fontSize:12,fontWeight:500,fontFamily:'inherit',
              }}>📁 Choisir un fichier JSON</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MESSAGES LEBONCOIN : COMBIEN DE NON-LUS, SUR QUEL COMPTE (4 octobre) ──────
// Julien : « dans Leboncoin, il y ait les messages ». Mesuré : AUCUNE conversation
// n'est captée, mais la page Leboncoin recharge elle-même un compteur de non-lus
// par compte ; l'extension (5.153) relaie ce NOMBRE et rien d'autre (aucun texte
// de message ne quitte sa page). On dit donc combien, sur quel compte, et on
// ouvre la messagerie de Leboncoin pour répondre. Lire les fils viendra après
// avoir mesuré leur forme — pas avant (§4.10, §6.3).
// Trois états, jamais deux : `undefined` en cours · `null` pas su · objet lu.
// « 0 » ≠ « jamais relevé », et un relevé ancien le dit (il ne se met à jour
// que quand une page leboncoin.fr est ouverte).
function MessagesLeboncoin() {
  const [d, setD] = useState(undefined);
  useEffect(() => { let stop = false; (async () => {
    try {
      const [rm, ra] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_messages&select=data`, { headers: sbAuth() }),
        fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=data`, { headers: sbAuth() }),
      ]);
      if (!rm.ok) { if (!stop) setD(null); return; }
      const jm = await rm.json(); const ja = ra.ok ? await ra.json() : [];
      if (!Array.isArray(jm)) { if (!stop) setD(null); return; }
      const m = (jm[0] && jm[0].data) || {};
      const acc = (Array.isArray(ja) && ja[0] && ja[0].data && ja[0].data.accounts) || {};
      if (!stop) setD({ compteurs: m.compteurs || {}, comptes: m.comptes || {}, acc });
    } catch (_) { if (!stop) setD(null); }
  })(); return () => { stop = true; }; }, []);
  const cap = extSait('lbcmsg');
  const nomDe = (id) => { const c = (d && d.comptes[id]) || {}; const a = (d && d.acc[id]) || {}; return c.name || a.name || 'Compte Leboncoin'; };
  const age = (iso) => { const t = Date.parse(iso || ''); if (!t) return null; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  const ouvrir = <a href="https://www.leboncoin.fr/messages" target="_blank" rel="noreferrer" data-ouvrir-messages-lbc="" style={{ display: 'inline-block', marginTop: 10, border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ouvrir mes messages Leboncoin ↗</a>;
  if (d === undefined) return <div style={{ fontSize: 13, color: C.muted }}>Chargement…</div>;
  if (d === null) return <div data-messages-lbc="pas-su" style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Je n'ai pas pu lire tes messages Leboncoin — rien n'est perdu, c'est la lecture qui a échoué. Réessaie dans un moment.<br/>{ouvrir}</div>;
  // Les comptes à montrer : ceux qui ont un compteur, puis ses autres comptes liés.
  const ids = [...new Set([...Object.keys(d.compteurs), ...Object.keys(d.comptes)])];
  const lignes = ids.map((id) => ({ id, nom: nomDe(id), c: d.compteurs[id] || null }));
  const releves = lignes.filter((l) => l.c);
  if (!releves.length) {
    return (
      <div data-messages-lbc="jamais" style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Pas encore de messages relevés</div>
        <div style={{ color: C.muted }}>
          {cap === 'ok' ? <>Ouvre <b>leboncoin.fr</b> une fois, connecté à ton compte : l'extension relèvera combien de messages t'attendent, compte par compte.</>
            : cap === 'retard' ? <>L'extension installée ne relève pas encore les messages : il lui faut la <b>{EXT_CAPACITES.lbcmsg}</b>. Mets-la à jour depuis <b>Réglages</b>.</>
            : <>C'est l'extension, sur ton ordinateur, qui relève tes messages Leboncoin quand tu passes sur leboncoin.fr.</>}
        </div>
        {ouvrir}
      </div>
    );
  }
  return (
    <div data-messages-lbc={String(releves.reduce((a, l) => a + l.c.unread, 0))}>
      {lignes.map((l) => {
        const vieux = l.c && Date.now() - Date.parse(l.c.at || 0) > 24 * 3600e3;
        return (
          <div key={l.id} data-compte-lbc={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nom}{((d.comptes[l.id] || {}).pro || (d.acc[l.id] || {}).type === 'pro') ? ' · pro' : (d.acc[l.id] || {}).type === 'particulier' ? ' · particulier' : ''}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>
                {l.c ? <>mis à jour {age(l.c.at)}{vieux ? ' — ouvre leboncoin.fr sur ce compte pour le mettre à jour' : ''}</> : 'pas encore lu — connecte-toi une fois à ce compte sur leboncoin.fr'}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', opacity: vieux ? 0.55 : 1 }}>
              {l.c ? <><span style={{ fontSize: 20, fontWeight: 700, color: l.c.unread > 0 ? C.text : C.muted, fontVariantNumeric: 'tabular-nums' }}>{l.c.unread}</span>{' '}<span style={{ fontSize: 11.5, color: C.muted }}>non lu{l.c.unread > 1 ? 's' : ''}</span></> : <span style={{ fontSize: 13, color: C.muted }}>—</span>}
            </div>
          </div>
        );
      })}
      {ouvrir}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>On répond sur Leboncoin : leurs messages ne s'affichent pas encore ici.</div>
    </div>
  );
}
function ColisEquipe({ vendeur, de, onPropre }) {
  const [d, setD] = React.useState(undefined);
  const [msg, setMsg] = React.useState({});
  const [lien, setLien] = React.useState({});
  const charger = React.useCallback(() => { setD(undefined); lireColisEquipe(vendeur).then(setD); }, [vendeur]);
  React.useEffect(() => { charger(); }, [charger]);
  const titreEcran = 'Colis à préparer';
  const sous = de ? `Pour ${de}` : null;
  const carte = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 };
  const h3 = { fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', margin: '22px 0 10px' };
  let corps;
  if (d === undefined) corps = <div data-equipe-etat="chargement" style={{ fontSize: 14, color: C.muted }}>Lecture des colis…</div>;
  else if (d === null) corps = <div data-equipe-etat="pas-su"><LignePanne>Je n'ai pas pu lire les colis — la base n'a pas répondu. Rien n'est perdu. <button type="button" onClick={charger} style={{ border: 'none', background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Réessayer</button></LignePanne></div>;
  else if (d.nonInstalle) corps = <div data-equipe-etat="non-installe" style={{ ...carte, fontSize: 14, color: C.text }}>{EQUIPE_NON_INSTALLE_TXT}</div>;
  else if (d.sansAcces) corps = <div data-equipe-etat="sans-acces" style={{ ...carte, fontSize: 14, color: C.text, lineHeight: 1.55 }}>Tu n'as plus accès aux colis de cette équipe : l'invitation a été retirée, ou l'abonnement du vendeur n'est plus actif. Plus rien de sa boutique n'est lisible d'ici.</div>;
  else {
    const ventes = d.ventes.filter((o) => aExpedier(o) && !d.postes.has(String(o.transaction_id)));
    const achats = d.achats.filter((o) => !d.retires.has(String(o.transaction_id)) && (isAtRelayStatus(o.status) || tusDe(o) === 'needs_action'));
    const labelsTx = new Map(); (d.labels || []).forEach((l) => { const m = /_label_([A-Za-z0-9]+)$/.exec(l.id || ''); const tx = (m && m[1] !== 'latest' && m[1] === String(l.tx || m[1])) ? m[1] : ''; if (tx && !labelsTx.has(tx)) labelsTx.set(tx, l.id); });
    const bordsTx = new Map(); (d.bords || []).forEach((b) => { if (b && b.filename && b.filename !== 'None' && b.transaction && !bordsTx.has(String(b.transaction))) bordsTx.set(String(b.transaction), b); });
    const compte = (o) => d.comptes[String(o.uid || '')] || '';
    const plusieurs = new Set([...ventes, ...achats].map(compte)).size > 1;
    const tracks = (d.tracks || []).filter((t) => t.status === 'available' && (() => { const x = new Date(t.receivedAt); return isNaN(x) || (Date.now() - x.getTime()) / 86400000 <= PICKUP_MAX_DAYS; })());
    const imprimer = async (o, row, numero) => {
      const k = String(o.transaction_id);
      setMsg((m) => ({ ...m, [k]: 'Préparation…' }));
      const r = await imprimerBordereauEquipe(vendeur, row, numero, o.title || '');
      setMsg((m) => ({ ...m, [k]: r.ok ? '' : r.message }));
      if (r.ok && !r.ouvert) setLien((l) => ({ ...l, [k]: r.url }));
    };
    corps = (<>
      {(d.bords === null || d.labels === null || d.relais === null || d.tracks === null) && (
        <div data-equipe-partiel="" style={{ marginBottom: 12 }}><LignePanne>Une partie des colis n'a pas pu être lue (bordereaux ou codes) — ce qui manque n'est pas « vide ». <button type="button" onClick={charger} style={{ border: 'none', background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Relire</button></LignePanne></div>
      )}
      <div style={h3}>À expédier · {ventes.length}</div>
      {!ventes.length && <div data-equipe-vide="ventes" style={{ fontSize: 14, color: C.muted }}>Aucun colis à expédier pour l'instant.</div>}
      {ventes.map((o) => {
        const k = String(o.transaction_id);
        const lab = labelsTx.get(k); const b = bordsTx.get(k);
        const row = lab || (b && b.id) || null;
        const numero = b && b.numero && b.numero !== 'None' ? String(b.numero) : '';
        return (
          <div key={k} data-equipe-vente={k} style={{ ...carte, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* ⚠️ `o.photo` est un OBJET Vinted ({url, …}) : posé tel quel en
                `src`, l'image était CASSÉE (revue visuelle du 17 oct.). La même
                lecture que partout ailleurs (`orderPhoto`, §11). */}
            {orderPhoto(o) ? <PhotoVinted src={orderPhoto(o)} alt="" loading="lazy" style={{ width: 52, height: 68, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: C.bg }}/> : null}
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }}>{numero ? `N°${numero} · ` : ''}{o.title || 'Article'}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{[plusieurs && compte(o) ? `compte ${compte(o)}` : '', b && b.dateLimite ? `à poster avant le ${b.dateLimite}` : ''].filter(Boolean).join(' · ') || o.status || ''}</div>
              {msg[k] && <div data-equipe-msg={k} style={{ fontSize: 12.5, color: C.warn, marginTop: 4 }}>{msg[k]}</div>}
              {lien[k] && <a href={lien[k]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>Ouvrir le bordereau</a>}
            </div>
            {row
              ? <button type="button" data-imprime="1" data-equipe-imprimer={k} onClick={() => imprimer(o, row, numero)} style={{ border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flex: '0 1 auto', maxWidth: 260 }}>🖨 Imprimer le bordereau</button>
              : <span data-equipe-sans-bordereau={k} style={{ fontSize: 12.5, color: C.muted }}>{d.bords === null || d.labels === null ? 'Bordereau pas encore vérifié' : 'Bordereau pas encore reçu'}</span>}
          </div>
        );
      })}
      <div style={h3}>À retirer · {achats.length}</div>
      {!achats.length && <div data-equipe-vide="achats" style={{ fontSize: 14, color: C.muted }}>Aucun colis à retirer pour l'instant.</div>}
      {achats.map((o) => {
        const k = String(o.transaction_id);
        const r = (d.relais && d.relais[k]) || null;
        const code = r ? codeRetrait(r.code) : '';
        const qr = r ? qrImage(r) : null;
        return (
          <div key={k} data-equipe-achat={k} style={carte}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }}>{o.title || 'Article'}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{[plusieurs && compte(o) ? `compte ${compte(o)}` : '', r && r.lieu ? r.lieu : ''].filter(Boolean).join(' · ') || o.status || ''}</div>
            {code
              ? <div data-equipe-code={k} style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '.06em', marginTop: 8 }}>{code}</div>
              : <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>{d.relais === null ? 'Code pas encore vérifié' : 'Code pas encore lu — il est dans la conversation Vinted de cet achat.'}</div>}
            {qr && <PhotoVinted src={qr} alt="QR de retrait" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 8, background: '#fff', borderRadius: 8 }}/>}
          </div>
        );
      })}
      {tracks.length > 0 && (<>
        <div style={h3}>Codes reçus par email · {tracks.length}</div>
        {tracks.map((t, i) => {
          const code = codeRetrait(t.code); const qr = qrImage(t);
          return (
            <div key={(t.suivi || '') + i} data-equipe-track="" style={carte}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{(CARRIERS[t.carrier] && CARRIERS[t.carrier].name) || 'Transporteur'}{t.lieu ? ` · ${t.lieu}` : ''}</div>
              {/* « aaaa-mm-jj » s'écrivait tel quel (revue visuelle du 17 oct.) :
                  la date se lit comme sur l'écran Achats ; illisible ⇒ rien. */}
              {joursAvant(t.limite) != null && <div data-equipe-limite="" style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>à retirer avant le {new Date(String(t.limite) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>}
              {code ? <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '.06em', marginTop: 8 }}>{code}</div> : null}
              {qr && <PhotoVinted src={qr} alt="QR de retrait" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 8, background: '#fff', borderRadius: 8 }}/>}
            </div>
          );
        })}
      </>)}
    </>);
  }
  return (
    <div data-colis-equipe={vendeur} style={cadreEquipe()}>
      <div style={boiteEquipe()}>
        <TeteEquipe titre={titreEcran} sous={sous} onPropre={onPropre}/>
        {corps}
        <Suspense fallback={<p>Lecture des missions…</p>}><Operations sombre={C===THEMES.dark} key={vendeur} headers={enTeteSession} vendeur={vendeur}/></Suspense>
      </div>
    </div>
  );
}


// ── ONGLET « MASQUÉS » — VENTES MASQUÉES · ACHATS MASQUÉS ────────────────────
// 30 sept. : d'abord rangé dans Réglages, puis Julien : « fais un onglet dédié,
// pas en vrac dans les paramètres », et « si je réaffiche, je veux que les
// photos apparaissent ». Tout ce qui est écarté de la compta, au même endroit,
// avec ce que c'était (PHOTO, titre, date, montant, compte) et un bouton pour
// le réafficher. Lit les mêmes moissons que les écrans Ventes / Achats
// (`fetchHarvestOrders`) ; l'identité est le n° de transaction (§5).
// « Pas su » ≠ « rien » : tant que la lecture n'est pas revenue, on le dit.
function EcranMasques({ comptes, ordi }) {
  const [onglet, setOnglet] = useState('ventes');
  const [vMasq, setVMasq] = useState(() => (load('vinted_sales_hidden', []) || []).map(String));
  const [aMasq, setAMasq] = useState(() => [...achatsMasques()]);
  const [det, setDet] = useState(undefined); // undefined = en cours · null = pas su · {tx: commande}
  useEffect(() => onCloudReady(() => {
    setVMasq((cur) => cur.length ? cur : (load('vinted_sales_hidden', []) || []).map(String));
    setAMasq((cur) => cur.length ? cur : [...achatsMasques()]);
  }), []);
  useEffect(() => { let stop = false; (async () => {
    try {
      const m = {}; let lu = false;
      await Promise.all((comptes || []).map(async (a) => {
        for (const cote of ['sold', 'purchased']) {
          const p = await fetchHarvestOrders(a.vinted_user_id, cote);
          if (p) lu = true;
          for (const o of ((p && p.my_orders) || [])) m[String(o.transaction_id)] = { ...o, _login: a.login || '', _cote: cote };
        }
      }));
      if (!stop) setDet(lu || !(comptes || []).length ? m : null);
    } catch (_) { if (!stop) setDet(null); }
  })(); return () => { stop = true; }; }, [comptes]);
  const reafficher = (tx) => {
    if (onglet === 'ventes') { const n = vMasq.filter(x => x !== tx); setVMasq(n); save('vinted_sales_hidden', n); }
    else { const n = aMasq.filter(x => x !== tx); setAMasq(n); ecrireAchatsMasques(n); if (_acctCache['purchased']) { delete _acctCache['purchased']; _persistAcctCache(); } }
    toast('Réaffiché — il compte de nouveau dans la compta.');
  };
  const liste = onglet === 'ventes' ? vMasq : aMasq;
  const eur = (o) => { const v = o && (o.price && o.price.amount != null ? Number(o.price.amount) : null); return v != null && isFinite(v) ? v.toFixed(2).replace('.', ',') + ' €' : ''; };
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHead icon="eyeOff" title="Masqués" desc="Les ventes et achats que tu as retirés de la compta — réaffiche-les d'un clic."/>
      <div className="vrm-rangee" style={{ display: 'flex', gap: 6 }}>
        {[['ventes', `Ventes masquées (${vMasq.length})`], ['achats', `Achats masqués (${aMasq.length})`]].map(([k, lib]) => (
          <button key={k} type="button" onClick={() => setOnglet(k)} aria-pressed={onglet === k}
            style={{ border: `1px solid ${onglet === k ? C.text : C.border}`, borderRadius: 999, padding: '6px 13px', background: onglet === k ? C.text : 'transparent', color: onglet === k ? C.bg : C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}>{lib}</button>
        ))}
      </div>
      {!liste.length ? (
        <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '18px 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {onglet === 'ventes' ? "Aucune vente masquée. Le ✕ d'une vente, sur l'écran Ventes, la range ici." : "Aucun achat masqué. L'icône « œil barré » d'un achat, sur l'écran Achats, le range ici."}
        </div>
      ) : (
        <>
          {det === null && <div style={{ fontSize: 12, color: C.muted }}>Je n'ai pas pu relire le détail de ces {onglet} — la liste reste juste, seuls photos, titres et montants manquent.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: ordi ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 10 }}>
            {liste.map((tx) => { const o = det && det[tx]; const ph = o ? orderPhoto(o) : null;
              return (
                <div key={tx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: `1px solid ${C.border}`, background: C.card, borderRadius: 12 }}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: C.card2 || C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
                    {ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <Icon name={det === undefined ? 'sync' : 'box'} size={20}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o ? o.title : (det === undefined ? 'Lecture…' : `Transaction ${tx}`)}</div>
                    {o && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{[o.date ? new Date(o.date).toLocaleDateString('fr-FR') : '', o._login, eur(o)].filter(Boolean).join(' · ')}</div>}
                  </div>
                  <button type="button" onClick={() => reafficher(tx)} style={{ flexShrink: 0, border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Réafficher</button>
                </div>
              ); })}
          </div>
        </>
      )}
    </div>
  );
}

export { EbayVentes, Plateforme, MessagesLeboncoin, AchatsLeboncoin, VentesLeboncoin, PrixMarche, EcranMasques, BackupModal, ColisEquipe };
