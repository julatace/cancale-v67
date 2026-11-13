// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import React from 'react';
import { Numero } from '../composants/Numero.jsx';
import { retoursPourSite, remiseEnStock, retourAReceptionner, LIBELLE_ETAPE } from '../retoursStock.js';
import { LogoTransporteur, LogoInconnu, BadgeTransporteur } from '../PastilleTransporteur.jsx';
import { rangerEnvoyes, filtresTransporteurs, filtrerEnvoyes, nomEnvoye, raisonInconnu, compterRaisons } from '../colisEnvoyes.js';
import Frise from '../design/Frise.jsx';
import { friseColisFusion } from '../design/friseFusion.js';
import { BoutonSuivreColis, C, Icon, PhotoVinted, askConfirm, cleNum, lbcExpediee, marquerVc, numeroReprenable, orderPhoto, pdfEtiquettesParTx, pdfVusParTx, save, toast } from '../App.jsx';

// La branche {curSub==='bordereaux' && ongletColisVu==='envoyes' && …} de Comptabilite, telle quelle, avec 5 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueColisEnvoyes({ v }) {
  const { LIMITE_ENVOYES_J, accNameOf, accounts, bordKey, filtreEnvoyes, imgMortes, isBordShippedManual, isShipDone, ligneSuiviVente, listeEnvoyes, noterImgMorte, numeros, presentesAnnonceIds, remettreDepuisCarte, retoursSuivis, sales, setBordsShipped, setFiltreEnvoyes, setRetoursDismissed, setRetoursRecus, setRetoursRemis, siteColis, suiviVente, toggleShipDone, voitSite } = v;
  /*⟦← App.jsx #h1_1⟧*/const unmarkBordShipped = (b) => { const k=bordKey(b); if(!k) return; setBordsShipped(prev=>{ const u={...prev}; delete u[k]; save('vinted_bords_shipped',u); return u; }); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const basculerRetourRecu = (cle) => {
    const k = cle ? String(cle) : ''; if (!k) return;
    setRetoursRecus(prev => { const u = { ...prev }; if (u[k]) delete u[k]; else u[k] = new Date().toISOString(); save('vinted_retours_recus', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const masquerRetour = (cle) => {
    const k = cle ? String(cle) : ''; if (!k) return;
    setRetoursDismissed(prev => { const u = { ...prev, [k]: Date.now() }; save('vinted_retours_dismissed', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const remettreEnStock = async (ligne) => {
    const r = remiseEnStock(ligne, { numeros, presentes: presentesAnnonceIds, cleNum, estArchive: (n) => !numeroReprenable(n) });
    if (!r.ok) {
      if (r.raison === 'pas-recu') toast('Note d’abord que le colis est arrivé chez toi (« Reçu chez moi »).');
      else toast('Cet article n’est relié à aucun N° (ni par la vente, ni par son annonce) : rien à remettre en stock. Pose son N° à la main d’abord.');
      return;
    }
    let num = r.num;
    if (r.conflit) {
      const ok = await askConfirm({ title: `Le N°${r.num} est déjà porté`, desc: `Un autre article présent porte aussi le N°${r.num}${r.conflit.titre ? ` (« ${r.conflit.titre} »)` : ''}.\n\nRegarde les deux articles là où ils sont rangés : VRM ne choisit pas à ta place. Tu peux remettre celle-ci en stock SANS numéro, et trancher ensuite dans le champ N°.`, ok: 'Remettre en stock sans N°', cancel: 'Annuler' });
      if (!ok) return;
      num = null;
    } else {
      const ok = await askConfirm({ title: `Remettre en stock ${r.archive ? 'cet article' : `la N°${r.num}`} ?`, desc: r.archive ? `Il portait l'ancien N°${r.num} : un ancien numéro ne se redonne pas, il prendra un numéro NEUF à sa republication — écris-le sur son étiquette.` : `Elle garde son N°${r.num} : retape-le dans le champ N° de la nouvelle annonce.\n\nRien d’autre ne change (ni la vente, ni ta compta).`, ok: 'Remettre en stock', cancel: 'Annuler' });
      if (!ok) return;
    }
    const k = String(ligne.cle);
    setRetoursRemis(prev => { const u = { ...prev, [k]: { at: new Date().toISOString(), num, archive: r.archive, conflit: r.conflit ? r.conflit.id : null } }; save('vinted_retours_remis', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const annulerRemise = (cle) => {
    const k = String(cle || ''); if (!k) return;
    setRetoursRemis(prev => { const u = { ...prev }; delete u[k]; save('vinted_retours_remis', u); return u; });
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/(()=>{
          if (voitSite('vinted') && !Array.isArray(sales.items)) return <div data-colis-lecture="" style={{fontSize:13,color:C.muted,textAlign:'center',padding:'22px 16px',lineHeight:1.6}}>{sales.error ? 'Tes ventes Vinted n’ont pas pu être lues : les colis envoyés ne sont pas connus.' : 'Je lis tes ventes…'}</div>;
          // (3 nov., choix n° 3) Les retours : la carte « Retour reçu ? » (revenus, SON tap) puis le bloc
          // « Retours » (les autres étapes, les remis en stock) ; leurs ventes ne sont pas redites en dessous.
          const retoursTx = new Set(((retoursSuivis && retoursSuivis.etat === 'lu') ? [...retoursSuivis.lignes, ...retoursSuivis.remises] : []).filter((l) => l.plateforme === 'vinted').map((l) => String(l.tx)));
          const retoursHaut = <>
            <CartesRetourRecu res={retoursSuivis} site={siteColis} onRemettre={remettreDepuisCarte}/>
            <RetoursEnCoursBloc res={retoursSuivis} site={siteColis} nomCompte={accNameOf} plusieursComptes={(accounts||[]).length>1} onRecu={basculerRetourRecu} onRemettre={remettreEnStock} onMasquer={masquerRetour} onAnnulerRemise={annulerRemise}/>
          </>;
          const L = listeEnvoyes().filter((x) => !(x.site === 'vinted' && x.o && retoursTx.has(String(x.o.transaction_id))));
          if (!L.length) return <>{retoursHaut}<div className="vrm-colis-vide-envoi" data-colis-envoyes="0" data-colis-partis="0"><span className="vrm-colis-vide-titre">Aucun colis envoyé</span><span className="vrm-colis-vide-sous">Ces {LIMITE_ENVOYES_J} derniers jours. Un colis « Déposé » arrive ici.</span></div></>;
          const plusieursComptes = (accounts || []).length > 1;
          // (9 nov., Julien : « mets le plus récent en haut, comme pour tous les onglets ») UNE liste,
          // la plus récente en haut (src/colisEnvoyes.js : prise en charge lue, sinon « Colis fait »,
          // sinon la vente), le transporteur sur chaque carte, et des pastilles pour n'en voir qu'un.
          // Avant : des groupes par transporteur, et « Autres » pour tout ce qui n'était pas lu.
          const nomT = (x) => nomEnvoye(x.tr);
          const pastillesT = filtresTransporteurs(L);
          const { liste: LF, filtre: filtreT } = filtrerEnvoyes(L, filtreEnvoyes);
          const LT = rangerEnvoyes(LF);
          const postes = L.filter((x) => x.type === 'coche');
          const nbAuRelais = L.filter((x) => x.st && x.st.label === 'Au relais').length;
          const sousDe = (x) => {
            if (x.type === 'coche') { const np = x.np; const depuis = np ? (np.heures < 48 ? `${np.heures} h` : `${Math.floor(np.heures/24)} j`) : '';
              return { t: np ? `Vinted ne l’a pas vu partir${depuis ? ` · coché il y a ${depuis}` : ''}${np.limiteDepassee ? ' · date limite dépassée' : ''}` : 'Coché « Colis fait »', ambre: !!np }; }
            // (5 nov., chantier D) Les mots de l'app (src/libelles.js) : « En route » (plus « En transit »), « Livré »
            // pour un colis ; l'étiquette brute de Vinted reste dans `data-parti` (les règles la lisent).
            if (x.type === 'parti') { const retour = /Retour/.test(x.st.label); const mot = { 'En transit': 'En route', 'Livrée': 'Livré', 'Au relais': 'Au relais de l’acheteur' }[x.st.label] || x.st.label; return { t: `${mot}${x.j != null ? ` · ${x.j === 0 ? 'vendue aujourd’hui' : `vendue il y a ${x.j} j`}` : ''}${plusieursComptes && x.o._acc ? ` · ${accNameOf(x.o._acc)}` : ''}`, ambre: retour, aide: x.st.aide }; }
            if (x.type === 'vc') return { t: x.depart ? `Vestiaire · ${x.depart.phrase}` : 'Vestiaire · coché « Colis fait »', ambre: false };
            if (x.type === 'vcenvoyee') return { t: `Vestiaire · envoyée${x.j != null ? ` · ${x.j === 0 ? 'vendue aujourd’hui' : `vendue il y a ${x.j} j`}` : ''}`, ambre: false };
            // (8 nov.) Parti d'après le transporteur (le site ne l'a pas encore dit) : la raison, de la même ligne que la preuve.
            if (x.type === 'transp') return { t: `${x.depart.phrase}${x.j != null ? ` · ${x.j === 0 ? 'vendue aujourd’hui' : `vendue il y a ${x.j} j`}` : ''}`, ambre: false };
            return { t: `Leboncoin · ${lbcExpediee(x.lo) ? (x.lo.stepLabel || 'en livraison') : 'coché « Colis fait »'}`, ambre: false };
          };
          return (
            <>{retoursHaut}<section className="vrm-colis-envoyes" data-cible="colonne:partis" data-colis-envoyes={L.length} data-colis-partis={L.length} data-partis-coches={postes.length} data-cc-colonne="partis" data-au-relais={nbAuRelais} data-envoyes-tri="recent" data-envoyes-filtre={filtreT}>
              {pastillesT.length > 1 && (
                <div className="vrm-rangee vrm-filtres" role="group" aria-label="Filtrer par transporteur" data-envoyes-filtres="" style={{display:'flex',gap:6,marginBottom:10}}>
                  <button type="button" aria-pressed={filtreT === 'tous'} data-envoyes-filtre-choix="tous" data-envoyes-filtre-n={L.length} onClick={() => setFiltreEnvoyes('tous')} style={{whiteSpace:'nowrap',flexShrink:0,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Tous · {L.length}</button>
                  {pastillesT.map((p) => (
                    <button key={p.nom} type="button" aria-pressed={filtreT === p.nom} data-envoyes-filtre-choix={p.nom} data-envoyes-filtre-cle={p.cle || 'inconnu'} data-envoyes-filtre-n={p.n} onClick={() => setFiltreEnvoyes(filtreT === p.nom ? 'tous' : p.nom)} aria-label={`${p.nom} : ${p.n}`} title={p.nom} style={{whiteSpace:'nowrap',flexShrink:0,padding:'5px 12px 5px 6px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>{p.cle ? <LogoTransporteur cle={p.cle} taille={22}/> : <LogoInconnu taille={22}/>}<span data-envoyes-filtre-nombre="">{p.n}</span></button>
                  ))}
                </div>
              )}
              <p className="vrm-colis-envoyes-tri" data-envoyes-phrase="" style={{margin:'0 0 8px',fontSize:12,color:C.muted,lineHeight:1.4}}>Le plus récent en haut : prise en charge lue, sinon « Colis fait », sinon date de vente.</p>
              {(() => {
                // (9 nov. au soir, « transporteurs parfaits ») Ce qui reste inconnu est COMPTÉ et DIT (src/colisEnvoyes.js `raisonInconnu`) :
                // une raison lue par colis Vinted (étiquette en cours de lecture, sans nom lisible, deux noms…), jamais un transporteur deviné.
                const inc = L.filter((x) => x.site === 'vinted' && !(x.tr && (x.tr.cle || x.tr.nom)));
                if (!inc.length) return null;
                const et = pdfEtiquettesParTx() || {}, vus = pdfVusParTx() || {};
                const raisons = compterRaisons(inc.map((x) => { const t = String((x.b && x.b.transaction) || (x.o && x.o.transaction_id) || ''); return raisonInconnu({ bord: x.b || null, pdf: et[t] || null, vu: vus[t] || null }); }));
                return <p className="vrm-colis-envoyes-inconnus" data-envoyes-inconnus={inc.length} style={{margin:'0 0 8px',fontSize:12,color:C.muted,lineHeight:1.4}}>
                  {inc.length} colis sans transporteur lu : {raisons.map((r, i) => <React.Fragment key={r.cle}>{i ? ' · ' : ''}<span data-inconnu-raison={r.cle} data-inconnu-n={r.n}>{r.n} {r.texte}</span></React.Fragment>)}.
                </p>;
              })()}
              <div className="vrm-colis-grille" style={{display:'flex',flexDirection:'column',gap:6}}>
                {LT.map((x, ix) => {
                  const so = sousDe(x);
                  const frise = friseColisFusion(x.lues || {}, {});
                  const tx = x.o ? String(x.o.transaction_id) : '';
                  const annuler = x.type === 'coche'
                    ? <button type="button" data-annuler-poste={tx || (x.e && x.e.key)} className="vrm-colis-sec" onClick={()=>{ if(x.o && isShipDone(x.o)) toggleShipDone(x.o); if(x.b && isBordShippedManual(x.b)) unmarkBordShipped(x.b); }}
                        title="Le colis est encore chez toi : il revient dans « À envoyer », avec son bordereau" style={{flexShrink:0,minHeight:44,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'0 14px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Pas encore déposé</button>
                    : x.type === 'vc' && !x.depart
                      ? <button type="button" data-vc-fait={x.v.id} className="vrm-colis-sec" onClick={() => marquerVc('vrm_vc_colis_done', x.v.id, false)} style={{flexShrink:0,minHeight:44,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'0 14px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} title="Le colis est encore chez toi : il revient dans « À envoyer »">Pas encore déposé</button>
                      : null;
                  return (
                    <React.Fragment key={x.cle}>
                      <div className="vrm-colis-carte vrm-colis-envoye" data-colis-envoye={x.cle} data-envoye-rang={ix} data-envoye-transp={(x.tr && x.tr.cle) || (x.tr && x.tr.nom ? 'autre' : 'inconnu')} data-envoye-transp-source={(x.tr && x.tr.source) || ''} data-envoye-quand={x.quand && x.quand.ms != null ? String(x.quand.ms) : ''} data-envoye-quand-source={(x.quand && x.quand.source) || ''} data-colis-ident={x.type === 'parti' ? 'p:' + x.o.transaction_id : x.cle} data-parti={x.type === 'coche' ? 'coche' : x.type === 'parti' ? x.st.label : x.type} data-plateforme-colis={x.site} data-depart-lu={x.depart ? (x.depart.carrier || x.depart.type) : undefined} data-depart-preuve={x.depart ? (x.depart.type || 'transporteur') : undefined}
                        {...(x.type === 'coche' && x.np ? { 'data-tx': tx, 'data-limite': x.np.limiteDepassee ? 'depassee' : 'ok' } : {})} {...(x.type === 'coche' ? { 'data-postes-pas-partis': x.np ? '1' : undefined, 'data-postes-recents': x.np ? undefined : '1' } : {})}
                        style={{padding:'14px',border:`1px solid ${so.ambre ? C.warn + '66' : C.border}`,background:C.card,borderRadius:12}}>
                        <div style={{display:'flex',gap:12,alignItems:'center'}}>
                          <div className="vrm-colis-photo" style={{width:60,height:60,borderRadius:14,background:C.card2||C.bg,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {x.photo && !imgMortes.has(x.photo) ? <PhotoVinted src={x.photo} alt="" loading="lazy" decoding="async" onError={()=>noterImgMorte(x.photo)} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/>}
                            <BadgeTransporteur t={x.tr}/>
                          </div>
                          <div style={{flex:'1 1 150px',minWidth:0}}>
                            <div><span className="vrm-colis-titre" title={x.titre} style={{display:'block',fontSize:15,fontWeight:600,lineHeight:1.3,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.num ? <><Numero n={x.num} taille="petit"/>{' '}</> : null}{x.titre}</span></div>
                            <span data-colis-envoye-etat="" title={so.aide || undefined} style={{display:'block',marginTop:4,fontSize:13,fontWeight:so.ambre ? 600 : 500,color:so.ambre ? C.warn : C.muted,lineHeight:1.35}}>{so.t}</span>
                          </div>
                        </div>
                        <Frise etapes={frise} cle={x.cle} className="vrm-colis-frise" label="Où en est le colis"/>
                        {/* (5 nov., chantier D) « Suivre » sur un colis parti dont le n° est lu (le bordereau) : le geste qu'on y vient chercher. */}
                        {/* (11 nov., lot suivi-commandes) Le n° copiable, « Suivre ↗ », le DERNIER statut lu (source,
                            heure) et l'incohérence prouvée (ambre, un geste) — sur chaque colis encore en cours. Un
                            colis livré ou finalisé n'en garde que l'incohérence (« livré, Vinted pas finalisé »). */}
                        {(() => { const sv = suiviVente(x);
                          // (11 nov., soir) La MÊME ligne compacte qu'Achats (`LigneSuivi`) : logo 18 px · n° copiable ↗ ·
                          // statut court · « il y a … » ; la phrase et sa source en dépliant.
                          const bloc = sv && (sv.enCours || sv.inc.length) ? ligneSuiviVente(x, sv) : null;
                          const su = (x.b && x.b.suivi) || (x.v && x.v.suivi) || '';
                          const suivre = su && !bloc ? <BoutonSuivreColis transporteur={(x.tr && x.tr.cle) || ''} suivi={su} enLigne court attrs={{'data-colis-envoye-suivre': x.cle}}/> : null;
                          return <>{bloc}{(annuler || suivre) ? <div className="vrm-colis-actions" style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap',marginTop:10}}>{suivre}{annuler}</div> : null}</>; })()}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </section></>
          );
        })()/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
// ── « RETOURS EN COURS » (Colis, 21 octobre) ─────────────────────────────────
// Rend la sortie de `retoursEnCours` (src/retoursStock.js) — aucune règle ici.
// Trois états : lecture en cours (une ligne) · pas su (une ligne, ce qui
// manque nommé) · lu. Une ligne n'a qu'UN geste principal selon son étape :
// « Reçu chez moi » (son clic), puis « Remise en stock » (son clic). Le geste
// commun est dit une fois en tête (§7). Aucune couleur d'alerte : un retour
// n'est pas une erreur.
// ── (3 nov., choix de Julien n° 3) LA CARTE « RETOUR REÇU ? » ────────────────────────────────
// Un retour PROUVÉ dont le colis est revenu (`retourAReceptionner`, src/retoursStock.js) : la photo,
// « N°x · titre », la question, UN geste « Remettre en stock » (son tap : reçu + remis, SON N°).
// Aucune phrase d'explication. Rien ne se fait sans le tap.
function CartesRetourRecu({ res: resBrut, site = 'toutes', onRemettre }) {
  const res = retoursPourSite(resBrut, site);
  if (!res || res.etat !== 'lu') return null;
  const L = res.lignes.filter(retourAReceptionner);
  if (!L.length) return null;
  return (
    <div className="vrm-retour-recu-liste" data-retours-recu={L.length} style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
      {L.map((l) => { const ph = l.vente ? orderPhoto(l.vente) : null;
        return (
          <div key={l.cle} className="vrm-colis-carte vrm-retour-recu" data-retour-carte={l.cle} data-retour-num={l.num} data-retour-etape={l.etape} data-retour-plateforme={l.plateforme}
            style={{padding:14,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            <div className="vrm-colis-photo" style={{width:60,height:60,borderRadius:14,background:C.card2||C.bg,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {ph ? <PhotoVinted src={ph} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/>}
            </div>
            <div style={{flex:'1 1 150px',minWidth:0}}>
              <span style={{display:'block',fontSize:17,fontWeight:700,color:C.text,lineHeight:1.25}}>Retour reçu ?</span>
              <span className="vrm-colis-titre" title={l.titre} style={{display:'block',marginTop:3,fontSize:15,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>N°{l.num}{l.titre ? ` · ${l.titre}` : ''}</span>
            </div>
            <button type="button" className="vrm-colis-primaire" data-geste="remettre-en-stock" data-remettre-retour={l.cle} onClick={() => onRemettre(l)}
              style={{flex:'0 0 auto',minHeight:44,border:'none',background:C.accent,color:'#fff',borderRadius:12,padding:'0 16px',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Remettre en stock</button>
          </div>); })}
    </div>);
}
function RetoursEnCoursBloc({ res: resBrut, site = 'toutes', nomCompte, plusieursComptes, onRecu, onRemettre, onMasquer, onAnnulerRemise }) {
  const [ouvrirAnciens, setOuvrirAnciens] = React.useState(false);
  // (2 nov.) Le filtre de site de Colis vaut aussi ici (`retoursPourSite`).
  const res = retoursPourSite(resBrut, site);
  if (!res) return null;
  if (res.etat === 'encours') return null;
  if (res.etat === 'passu') return (
    <div data-retours-encours="passu" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 13px',marginBottom:12,fontSize:13,color:C.muted}}>
      Retours en cours : ventes pas lues, je ne sais pas. Rouvre dans un moment.
    </div>);
  const { remises, manques } = res;
  // (3 nov.) Les retours REVENUS (« Retour reçu ? ») ont leur carte au-dessus : chacun une fois.
  const lignes = res.lignes.filter((l) => !retourAReceptionner(l));
  // Ce qui n'a pas pu être lu, dit PAR SITE et à part des lignes : un avertissement
  // eBay posé au-dessus d'une ligne Vinted la faisait passer pour un retour eBay.
  const manquesVinted = manques.filter(m => !/eBay/.test(m)), manqueEbay = manques.some(m => /eBay/.test(m));
  const pasSu = (manquesVinted.length || manqueEbay) ? <div data-retours-pas-su="" style={{fontSize:12,color:C.muted,lineHeight:1.45,display:'grid',gap:2}}>
    {manquesVinted.length > 0 && <div data-retours-pas-su-site="vinted">Vinted : je n'ai pas pu lire {manquesVinted.join(', ')} — un retour peut manquer.</div>}
    {manqueEbay && <div data-retours-pas-su-site="ebay">Retours eBay : pas lus</div>}
  </div> : null;
  if (!lignes.length && !remises.length) {
    return pasSu ? <div data-retours-encours="0" data-retours-manques={manques.length} style={{margin:'0 0 12px'}}>{pasSu}</div> : null;
  }
  const recents = lignes.filter(l => !l.ancien), anciens = lignes.filter(l => l.ancien);
  const lien = (l) => l.plateforme === 'ebay'
    ? `https://www.ebay.fr/rt/ReturnDetails?returnId=${encodeURIComponent(l.returnId)}`
    : (l.vente && l.vente.conversation_id ? `https://www.vinted.fr/inbox/${encodeURIComponent(l.vente.conversation_id)}` : `https://www.vinted.fr/member/transactions/${encodeURIComponent(l.tx)}`);
  const btn = { minHeight:44, border:`1px solid ${C.border}`, background:'transparent', color:C.text, borderRadius:12, padding:'0 12px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' };
  const Ligne = ({ l, remise }) => {
    const ph = l.vente ? orderPhoto(l.vente) : null;
    const compte = l.plateforme === 'ebay' ? (l.compte && l.compte !== 'principal' ? `eBay · ${l.compte.slice(0,6)}` : 'eBay') : (plusieursComptes && l.compte ? nomCompte(l.compte) : '');
    const etape = remise ? 'remis' : l.etape;
    return (
      <div data-retour={l.cle} data-retour-etape={etape} data-retour-num={l.num || ''} data-retour-recu={l.recu ? '1' : '0'} data-retour-plateforme={l.plateforme}
        style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',padding:'8px 10px',border:`1px solid ${C.border}`,borderRadius:12,background:C.card,minWidth:0}}>
        <div style={{flexShrink:0,minWidth:44,height:34,borderRadius:12,background:C.card2||C.border,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,padding:'0 6px'}}>{l.num ? `N°${l.num}` : '—'}</div>
        {ph && <div style={{width:34,height:34,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden'}}><PhotoVinted src={ph} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>}
        <div style={{flex:'1 1 170px',minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.titre || (l.plateforme === 'ebay' ? 'Retour eBay' : 'Vente')}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2,display:'flex',gap:7,flexWrap:'wrap'}}>
            <span data-retour-libelle style={{color:C.text,fontWeight:600}}>{remise ? 'Remise en stock — à republier' : LIBELLE_ETAPE[l.etape]}</span>
            {!remise && l.recu && l.etape === 'rembourse' && <span>reçue chez toi</span>}
            {!remise && l.livreeSelonVinted && !l.recu && <span>{l.plateforme === 'ebay' ? 'eBay' : 'Vinted'} dit livrée — confirme quand tu l'as</span>}
            {l.origine === 'non-reclamee' && <span>non réclamée par l'acheteur</span>}
            {!l.num && <span data-retour-sans-num>article pas relié à un N°</span>}
            {remise && l.remis && l.remis.num === null && l.num && <span>sans N° — le N°{l.num} est porté par un autre article</span>}
            {remise && l.remis && l.remis.archive && <span>ancien N° : numéro neuf à la republication</span>}
            {compte && <span>· {compte}</span>}
          </div>
        </div>
        <a href={lien(l)} target="_blank" rel="noreferrer" style={{...btn,display:'inline-flex',alignItems:'center',textDecoration:'none'}}>{l.plateforme === 'ebay' ? 'Sur eBay ↗' : 'Sur Vinted ↗'}</a>
        {remise ? <>
          <a data-geste="republier" href="https://www.vinted.fr/items/new" target="_blank" rel="noreferrer" style={{...btn,display:'inline-flex',alignItems:'center',textDecoration:'none'}}>Republier ↗</a>
          <button type="button" data-geste="annuler-remise" onClick={()=>onAnnulerRemise(l.cle)} style={{...btn,color:C.muted}}>Annuler la remise</button>
        </> : <>
          <button type="button" data-geste="recu" aria-pressed={l.recu} onClick={()=>onRecu(l.cle)} style={{...btn,color:l.recu?C.text:C.muted}}>{l.recu ? '✓ Reçu' : 'Reçu'}</button>
          {l.recu && l.num && <button type="button" data-geste="remise-en-stock" onClick={()=>onRemettre(l)} style={{...btn,background:C.text,color:C.bg,border:`1px solid ${C.text}`}}>Remise en stock</button>}
          <button type="button" className="vrm-icon-control" data-geste="masquer-retour" onClick={()=>onMasquer(l.cle)} title="Masquer cette ligne (déjà réglé)" aria-label="Masquer" style={{...btn,minWidth:44,padding:0,color:C.muted}}><Icon name="close" size={15}/></button>
        </>}
      </div>);
  };
  return (
    <div data-retours-encours={lignes.length} data-retours-remises={remises.length} data-retours-manques={manques.length} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px',marginBottom:12}}>
      <div style={{display:'flex',gap:9,alignItems:'flex-start'}}>
        <span aria-hidden="true" style={{color:C.muted,flexShrink:0,marginTop:1}}><Icon name="truck" size={18}/></span>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>Retours{lignes.length + remises.length ? ` · ${lignes.length + remises.length}` : ''}</div>
        </div>
      </div>
      <div style={{display:'grid',gap:6,marginTop:9}}>
        {recents.map(l => <Ligne key={l.cle} l={l}/>)}
        {anciens.length > 0 && <button type="button" data-retours-anciens={anciens.length} onClick={()=>setOuvrirAnciens(v=>!v)} style={{...btn,justifySelf:'start',color:C.muted}}>{ouvrirAnciens ? 'Masquer' : `${anciens.length} remboursé${anciens.length>1?'s':''} il y a plus de 45 j`}</button>}
        {ouvrirAnciens && anciens.map(l => <Ligne key={l.cle} l={l}/>)}
        {remises.map(l => <Ligne key={l.cle} l={l} remise/>)}
      </div>
      {pasSu && <div style={{marginTop:9}}>{pasSu}</div>}
    </div>);
}