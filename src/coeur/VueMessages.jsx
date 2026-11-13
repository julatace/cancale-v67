// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { montantSeuil } from '../offresSures.js';
import { auteurDernierConfirme, reponseAttendueVinted, instantVinted } from '../suiviMessagerieVinted.js';
import { cleReponseVinted, cleActionOffreVinted } from '../reponseVinted.js';
import { trierRecents, sansDate as convsSansDate } from '../ordreConversations.js';
import { cleOffreVinted, annonceOffreEnVente, offreOuverte } from '../offresVinted.js';
import { extraitConversation, libelleOffre, etatOffreCourt } from '../messagesLisibles.js';
import { motsVendeur } from '../profilVendeur.js';
import { CONVERSATIONS_RETIREES, cleConversation, conversationRetiree, remettreConversations, phraseRetour } from '../conversationsRetirees.js';
import { conversationNonLue, conversationNonLueAncienne } from '../messagesNonLus.js';
import { STYLE_FLOU } from '../flouCompte.js';
import React from 'react';
import { ChampRecherche } from '../composants/ChampRecherche.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { VERBES } from '../libelles.js';
import { attrCible } from '../cibleNotif.js';
import { offreFacePlancher } from '../plancherOffre.js';
import Illustration from '../composants/Illustration.jsx';
import { CompteurArnaque, PastilleArnaque } from '../AlerteArnaque.jsx';
import { AUTH, Bouton, C, ComposeConv, EXT_CAPACITES, FavorisConnectes, FicheConvVolet, Icon, LigneConv, NAV, PhotoVinted, RapidesConv, SUPABASE_URL, ScreenHead, Segmente, SheetShell, Skeleton, __vmrEtat, __vmrJobs, __vmrPlusieurs, aLaDemande, askText, extSait, gesteCorbeille, libelleRelais, lireFreinsVus, listeRapides, normTitle, offreEnAttenteDe, save, sbAuth, sondageConnu, textePlusieurs, toast, useExtVivante, viaOrdinateur, vintedDeChrome, vmrExecUn, vmrExtPresent } from '../App.jsx';

// La branche {curSub==='messages' && !filTous && …} de Comptabilite, telle quelle, avec 3 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueMessages({ v }) {
  const { NoAcc, accName, accNameOf, accountUids, accounts, acctOff, acctOffOf, annSelectionnables, annonceParId, articlesVendusFavoris, basculerOffresAuto, capturesRepondues, changerRefusVariantes, compteSel, convMax, convRetirees, convs, dansPlateforme, ecrireRefusMsg, favorisCompte, favorisOnglet, favorisUid, feuilleQR, ficheDeConv, lectureOffres, lireGardeOffres, listings, loadConvs, messageFilter, messageSearch, msgCompteActif, msgNomActif, numeros, offreDuFil, offresAuto, offresConfirmees, offresConv, openConv, openConversation, paireDeConv, plancherDeItem, prix, quickReplies, refusMsg, refusVariantes, rendreConversation, sales, selEff, setConvMax, setConvRetirees, setFeuilleQR, setMessageFilter, setMessageSearch, setMiniSel, setOffresAuto, setQuickReplies, setShowQR, setZoneFav, setZoneMessages, showQR, updatePair, ventesFavorisHisto, zoneFav, zoneMessages } = v;
  /*⟦← App.jsx #h1_1⟧*/const saveQR = (arr) => { setQuickReplies(arr); save('vinted_quick_replies', arr); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const auteurDernier = (c,p) => auteurDernierConfirme(c,p?.r);/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const rendreFicheConv=()=>{
    if(!openConv) return <FicheConvVolet site="vinted" etat="aucune"/>;
    if(openConv.loading||openConv.error) return <FicheConvVolet site="vinted" etat="attente"/>;
    const pc=paireDeConv(String(openConv.acc?.vinted_user_id||''),openConv.convId,openConv.conversation);
    const fc=ficheDeConv(pc,openConv.acc);
    if(!fc) return <FicheConvVolet site="vinted" etat="non-reliee" raison={`Vinted ne rattache aucun article à cette conversation : VRM ne devine pas ${motsVendeur().le} d’après le titre.`}/>;
    const attention=[fc.favoris!=null?`${fc.favoris} favori${fc.favoris>1?'s':''}`:null, fc.vues!=null?`${fc.vues} vue${fc.vues>1?'s':''}`:null].filter(Boolean);
    return <FicheConvVolet site="vinted" etat="reliee" fc={{ item: fc.item, num: fc.num, photo: fc.photo, titre: fc.titre, taille: fc.taille,
      sous: [fc.prix!=null?prix(fc.prix,fc.devise):null,fc.compte||null],
      blocs: [{ cle:'rangement', lib:'Rangée', val: fc.rangement }, { cle:'attention', lib:'Attention', val: attention.join(' · ') }],
      lien: fc.url ? { href: fc.url, texte: 'Voir l’annonce sur Vinted ↗' } : null }}/>;
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<>
        {!dansPlateforme && <ScreenHead icon="chat" title="Messages" />}
        <NoAcc/>
        {/* (3 nov., critique #7) « Lecture par compte » passe sous la liste, avec les vérifications. */}
        {/* (9 nov., lot AL — Julien : « les favoris et offres doivent être dans Messages ») L'ancienne
            entrée « Favoris & offres » du menu est CETTE section : même écran (`FavorisConnectes` :
            favoris reçus, offre aux favoris, mode auto), son nom d'hier. */}
        <div className="vrm-messages-sections" role="group" aria-label="Choisir Conversations ou Favoris & offres">
          <button type="button" data-messages-zone="conversations" aria-pressed={zoneMessages==='conversations'} onClick={()=>setZoneMessages('conversations')}><Icon name="chat" size={17}/>Conversations</button>
          <button type="button" data-messages-zone="favoris" aria-pressed={zoneMessages==='favoris'} onClick={()=>setZoneMessages('favoris')}><Icon name="heart" size={17}/>Favoris & offres</button>
        </div>
        <div hidden={zoneMessages!=='favoris'} style={{display:zoneMessages==='favoris'?undefined:'none'}}>
        {/* (11 nov., lot DJ8) « Offres auto » : l'interrupteur, ce que le moteur ferait, les seuils par paire, l'historique. */}
        <div className="vrm-fav-zones"><Segmente label="Favoris ou offres automatiques" value={zoneFav} onChange={setZoneFav} options={[{ v: 'favoris', l: 'Favoris' }, { v: 'offres', l: 'Offres auto' }]}/></div>
        {zoneMessages==='favoris' && zoneFav==='offres' && <OffresAuto actif={offresAuto} virguleLue={extSait('offrespage')==='ok'} basculer={basculerOffresAuto} eteindreOffres={()=>{ setOffresAuto(false); save('vinted_offres_auto', false); }}
          refusMsg={refusMsg} setRefusMsg={ecrireRefusMsg}
          refusVariantes={refusVariantes} setRefusVariantes={changerRefusVariantes} variantesOk={extSait('variantes')==='ok'}
          annonces={Array.isArray(listings.items) && !listings.error ? annSelectionnables.filter(a=>a.etat==='en-ligne') : null} numeros={numeros}
          offres={offresConv} lireGarde={lireGardeOffres} comptes={(accounts||[]).filter(a=>/^\d{1,20}$/.test(String(a.vinted_user_id||''))&&!acctOffOf({_acc:a})).map(a=>({ uid:String(a.vinted_user_id), nom:accNameOf(a) }))}
          uidOnglet={(vintedDeChrome()||{}).uid||''} pause={__vmrEtat && __vmrEtat.pause ? __vmrEtat.pause : null} freinsVus={lireFreinsVus()}
          poserSeuils={(liste)=>{ const idx=new Map((listings.items||[]).map(it=>[String(it.id),it])); let n=0; for (const w of liste||[]) { const it=idx.get(String(w.id)); if (!it) continue; const patch={}; if (w.min!==undefined) patch.min=montantSeuil(w.min); if (w.refuse!==undefined) patch.refuse=montantSeuil(w.refuse); updatePair(it, patch); n++; } if ((liste||[]).length>1) toast(`${n} seuil${n>1?'s':''} posé${n>1?'s':''}`); }}
          ouvrirSerie={(ids)=>{ const set=new Set(ids.map(String)); setMiniSel(annSelectionnables.filter(a=>a.etat==='en-ligne'&&set.has(String(a.id)))); }} PhotoVinted={PhotoVinted}/>}
        <div hidden={zoneFav==='offres'} style={{display:zoneFav==='offres'?'none':undefined}}>
        <FavorisConnectes articlesVendus={articlesVendusFavoris} articleFavori={id=>{const it=annonceParId.get(String(id)),n=(numeros[String(id)]||{}).numero;const px=Number(it?.price&&typeof it.price==='object'?it.price.amount:it?.price);const fiche=numeros[String(id)]||null;return it||n||fiche?{titre:it?.title||'',numero:n||'',photo:typeof it?.photo==='string'?it.photo:it?.photo?.url||null,prix:Number.isFinite(px)&&px>0?px:null,fiche}:null;}} ventesFavoris={ventesFavorisHisto} uidOnglet={favorisOnglet} listingsFavoris={listings} autresComptes={(accounts||[]).filter(a=>/^\d{1,20}$/.test(String(a.vinted_user_id||''))&&!acctOffOf({_acc:a})).map(a=>({ uid:String(a.vinted_user_id), nom:accNameOf(a) }))} ecranActif={zoneMessages==='favoris'&&zoneFav!=='offres'} chargementAutomatique={zoneMessages==='favoris'} key={'favoris:'+String(AUTH.user?.id||'')+':'+favorisUid} uid={favorisUid} nomCompte={favorisCompte?accNameOf(favorisCompte):''} owner={AUTH.user?.id||''} ownerActuel={()=>AUTH.user?.id||''} base={SUPABASE_URL} headers={()=>sbAuth()} executerFavori={t=>sondageConnu().then(()=>vmrExecUn({uid:favorisUid,method:'POST',endpoint:'/vrm/favoris',body:{jeton:t.jeton}},130000))} PhotoVinted={PhotoVinted}/>
        </div>
        </div>
        <div className="vrm-message-workspace" hidden={zoneMessages!=='conversations'} style={{display:zoneMessages==='conversations'?undefined:'none'}}><div className="vrm-inbox-column">
        {/* (5 nov., chantier G) Le champ de recherche commun (`ChampRecherche`) : plus un champ teinté posé dans un champ bordé. */}
        <ChampRecherche className="vrm-msg-recherche" valeur={messageSearch} onChange={(v)=>setMessageSearch(String(v||'').slice(0,200))} label="Rechercher une conversation" placeholder="Pseudo, article, N°…" micro data-msg-recherche=""/>
        {!!messageSearch.trim()&&<p className="vrm-msg-recherche-portee" role="status">Sur tous tes comptes.{messageFilter!=='all'&&<> Le filtre reste appliqué. <button type="button" className="vrm-pied-lien" data-pied-lien="tout" onClick={()=>{setMessageFilter('all');setConvMax(40);}}>Afficher tous les résultats</button></>}</p>}
        {convs.loading && !convs.items && <Skeleton variant="row" count={2}/>}
        {/* (5 nov., chantier G, revue 1.10) La panne dite par `EtatPanne` : une phrase, la raison, UN geste. */}
        {convs.error && <EtatPanne quoi="Tes conversations Vinted" raison="Aucune boîte n’a pu être lue. Rien n’est perdu : c’est la lecture qui a échoué." onReessayer={()=>loadConvs(true)} data-msg-panne=""/>}
        {/* ── LA MESSAGERIE INTÉGRÉE (3 octobre) ─────────────────────────────
            Julien : « il doit y avoir la messagerie intégrée des derniers
            comptes, avec la possibilité de répondre et de faire l'offre ».
            ⚠️ Ça REMPLACE sa demande de septembre (« enlève les messages, mets
            juste qu'il y en a de nouveaux ») — c'est lui qui la redemande.
            Les non lus d'abord, puis les plus récents ; le compte est nommé sur
            chaque ligne (la liste mélange ses comptes). Un clic ouvre le fil :
            répondre et trancher une offre se font là, par l'extension. */}
        {convs.items && !convs.error && (()=>{
          // Filtre par compte (sélecteur de l'onglet) : `_acc` d'une conversation
          // est l'OBJET compte. Choisi ⇒ ses conversations seules.
          const uidC = c => String((c._acc&&c._acc.vinted_user_id)||'');
          // Compte choisi ⇒ les AUTRES restent (floutés, pas masqués — Julien).
          // ⚠️ (16 octobre) Quand l'extension peut AGIR (`msgCompteActif`), le
          //    compte de Chrome n'est plus un filtre : toutes les conversations
          //    restent, les siennes EN TÊTE et actionnables, celles des autres
          //    comptes en lecture seule. Seul un choix EXPLICITE dans la liste
          //    « Compte » filtre encore ; « pas su » garde le comportement d'avant.
          const choixExplicite = !!compteSel && compteSel!=='*' && String(compteSel)===selEff;
          const rechercheMessages=messageSearch.trim();
          const filtreMsg = rechercheMessages?'':choixExplicite ? selEff : (msgCompteActif ? '' : selEff);
          const prioMsg = !filtreMsg && msgCompteActif ? msgCompteActif : '';
          const listeBrute=(convs.items||[]).filter(c=>accountUids.has(uidC(c))&&!acctOffOf(c)&&(!filtreMsg||uidC(c)===filtreMsg)&&(!rechercheMessages||correspondRechercheMessage(c,paireDeConv(uidC(c),c.id,null),rechercheMessages)));
          // (29 oct.) « Retirer de la liste » : une conversation qu'il a retirée sort
          // de la liste ET de ses compteurs, jusqu'à ce qu'il s'y passe du nouveau
          // (`conversationRetiree`, `phraseRetour`). Elles sont dites UNE fois sous la liste, avec
          // « Les remettre » (§7 : jamais cachées sans un mot).
          const retireesIci=listeBrute.filter(c=>conversationRetiree(convRetirees,uidC(c),c));
          const liste=retireesIci.length?listeBrute.filter(c=>!conversationRetiree(convRetirees,uidC(c),c)):listeBrute;
          // ⚠️⚠️ LE NOMBRE VIENT DE LA LISTE AFFICHÉE (§5, §11 — revue du
          //    8 octobre). Depuis que les autres comptes sont estompés au lieu
          //    d'être retirés, `liste` les contient tous ; or ce compte ne
          //    gardait que le compte choisi. Résultat : « Tout est lu » écrit
          //    au-dessus de deux messages non lus d'un autre compte — floutés et
          //    inertes, et le point « nouveau » de l'onglet disait l'inverse. Un
          //    acheteur qui attend était annoncé comme « rien à faire ».
          //    ⇒ on compte TOUTE la liste ; ceux d'un compte estompé sont dits à
          //    côté, avec le geste, jamais à la place.
          // (31 oct.) « Non lue » = la règle de Ma journée (src/messagesNonLus.js,
          //    §11) : non lue ET bougée ces 7 derniers jours. Les vieux drapeaux
          //    sont comptés à part et dits (`nonLusAnciens`), jamais cachés.
          const nonLus = liste.filter(c=>conversationNonLue(c)).length;
          const nonLusAnciens = liste.filter(c=>conversationNonLueAncienne(c)).length;
          // (19 oct.) L'offre en attente d'une conversation : LA règle du fil
          // (`offreEnAttenteDe`, §11), sur le fil ouvert s'il est chargé (plus
          // frais), sinon sur la lecture ciblée des conversations captées. Pas su
          // ⇒ `null` : aucune pastille.
          // (29 oct.) Et une offre dont l'annonce est PROUVÉE partie (une lecture
          // complète du dressing, faite après l'offre, ne la montre plus) n'attend
          // plus rien : ni pastille, ni filtre « Offres », ni place en tête
          // (`offreOuverte`, la règle du fil aussi — §11). L'XT-6 de Julien.
          const offreDeConv = (c) => {
            if (openConv && openConv.conversation && openConv.convId===c.id && String(openConv.acc?.vinted_user_id||'')===uidC(c)) return offreDuFil(openConv);
            const offre=offresConv instanceof Map ? (offresConv.get(`${uidC(c)}_${c.id}`) || null) : null;
            return offre&&offresConfirmees.current.has(cleOffreVinted(uidC(c),offre))?null:offreOuverte(offre,uidC(c),lectureOffres);
          };
          const nOffres = liste.filter(c=>offreDeConv(c)).length;
          // (29 oct., revue) Une conversation dont le DERNIER message est une offre
          // que la règle ferme (annonce prouvée partie, `annonceOffreEnVente`) n'attend
          // plus de réponse : elle sort de « À répondre » comme de « Offres » (§11).
          // L'offre captée brute (avant la règle), sur le fil ouvert ou la lecture ciblée.
          const offreBrute = (c) => {
            if (openConv && openConv.conversation && openConv.convId===c.id && String(openConv.acc?.vinted_user_id||'')===uidC(c)) {
              const o=offreEnAttenteDe(openConv.conversation), tr=openConv.conversation.transaction||{};
              return o?{...o,item:tr.item_id!=null?String(tr.item_id):null,side:typeof tr.current_user_side==='string'?tr.current_user_side:null}:null;
            }
            return offresConv instanceof Map ? (offresConv.get(`${uidC(c)}_${c.id}`) || null) : null;
          };
          const derniereOffreClose = (c) => {
            const o=offreBrute(c);
            if(!o||annonceOffreEnVente(o,uidC(c),lectureOffres)!=='non') return false;
            const t=instantVinted(c.updated_at);
            return o.ts!=null && t!=null && Math.abs(t-o.ts)<=120000;
          };
          const reponsesMemo=new Map();const reponseAttendue=c=>{const k=uidC(c)+':'+c.id;if(!reponsesMemo.has(k))reponsesMemo.set(k,!derniereOffreClose(c)&&reponseAttendueVinted(c,paireDeConv(uidC(c),c.id,null)?.r,capturesRepondues[(AUTH.user?.id||'')+':'+cleReponseVinted(uidC(c),c.id)]));return reponsesMemo.get(k);};
          const aRepondre=liste.filter(reponseAttendue);
          const offresARepondre=aRepondre.filter(c=>offreDeConv(c)).length;
          // (27 oct.) Offres ≥ au prix mini posé sur l'annonce (par identité, l'item_id,
          // §5) : on les surface pour les accepter en 1 tap, sans ouvrir chaque fil.
          // Rien n'est accepté tout seul — c'est le tap dans le fil qui vend (§3).
          const auMini = (c)=>{ const o=offreDeConv(c); if(!o||o.item==null) return false; const mn=Number(String((numeros[String(o.item)]||{}).min ?? '').replace(',','.')); return isFinite(mn)&&mn>0&&o.prix>=mn; };
          const nAuDessusMini = liste.filter(auMini).length;
          // ⚠️ (16 octobre) Depuis qu'un choix EXPLICITE filtre la liste
          //    (13 octobre), `liste` ne porte plus les autres comptes : compté
          //    dessus, ce nombre valait toujours 0, et l'en-tête passait à « tout
          //    lu » au-dessus de non-lus cachés — le défaut du 8 octobre, revenu
          //    par le filtre. On compte donc sur les conversations AVANT le
          //    filtre de compte (comptes écartés exclus) : cachés, ils sont dits.
          const nonLusAilleurs = filtreMsg ? (convs.items||[]).filter(c=>!acctOffOf(c) && conversationNonLue(c) && uidC(c)!==filtreMsg && !conversationRetiree(convRetirees,uidC(c),c)).length : 0;
          // Les boîtes qui n'ont pas pu être lues (comptes qu'il n'a pas
          // écartés) : tant qu'il y en a une, « Tout est lu » serait un total
          // partiel présenté comme complet (§5).
          const boitesKO = (convs.ko||[]).filter(a=>a && !acctOff(a.vinted_user_id));
          // Compte choisi (ou connecté) d'abord, puis non lus, puis les récents.
          // Le compte de l'extension d'abord (là où VRM peut répondre), puis les
          // plus récentes — l'ordre d'avant, à l'intérieur de chaque groupe.
          // (11 nov., Julien : « tu ne fais pas du plus récent au plus vieux ») Plus rien
          // ne passe devant à l'intérieur d'un groupe : ni « à répondre », ni une offre
          // (« À répondre » et « Offres reçues » sont des FILTRES). Le plus récent en haut,
          // par horodatage ; sans date lue, en bas (dit sous la liste).
          const tri=trierRecents(liste.filter(c=>messageFilter==='all'||(messageFilter.startsWith('repondre')?reponseAttendue(c)&&(messageFilter==='repondre'||(messageFilter==='repondre-offres'?!!offreDeConv(c):!offreDeConv(c))):messageFilter==='offres'?!!offreDeConv(c):conversationNonLue(c))),c=>c.updated_at,prioMsg?(c=>uidC(c)===prioMsg?0:1):null);
          const nSansDate=convsSansDate(tri,c=>c.updated_at);
          const roListe = prioMsg ? liste.filter(c=>uidC(c)!==prioMsg) : [];
          const nonLusRo = roListe.filter(c=>conversationNonLue(c)).length;
          const nomActif = prioMsg ? msgNomActif() : '';
          const plusieurs = new Set(liste.map(c=>uidC(c))).size > 1;
          const affiches = tri.slice(0, convMax);
          // ⚠️ UNE BOÎTE FIGÉE SE DIT (6 octobre). Mesuré : deux comptes avaient
          // leur boîte bloquée sur une page ANCIENNE (dernière conversation captée
          // le 27 juillet pour une vente du 2 octobre). Chaque vente ouvre une
          // conversation : quand la dernière vente d'un compte est plus récente
          // que sa dernière conversation captée (au-delà d'une heure, le temps que
          // la conversation de la vente soit captée), sa boîte n'est plus à jour.
          // On ne juge que ce qu'on SAIT : ventes lues, au moins une conversation
          // captée sur ce compte. Dit UNE fois, au-dessus de la liste.
          const boitesPerimees = (()=>{
            if (!Array.isArray(sales.items)) return [];
            const derVente = new Map(), derConv = new Map();
            for (const o of sales.items) {
              if (!o || !o._acc || acctOffOf(o)) continue;
              const k = String(o._acc.vinted_user_id), t = Date.parse(o.date||'');
              if (t && (!derVente.has(k) || t > derVente.get(k).t)) derVente.set(k, { t, acc: o._acc });
            }
            for (const c of listeBrute) {
              const k = String((c._acc && c._acc.vinted_user_id) || ''), t = Date.parse(c.updated_at||'');
              if (k && t && (!derConv.has(k) || t > derConv.get(k))) derConv.set(k, t);
            }
            const out = [];
            for (const [k, v] of derVente) { const tc = derConv.get(k); if (tc && v.t - tc > 3600000) out.push({ acc: v.acc, conv: tc, vente: v.t }); }
            return out;
          })();
          const jourCourt = (t)=> new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
          // (11 nov., anti-arnaque) Le dernier message d'une conversation, PROUVÉ de l'autre
          // (fil capté, `de === 'eux'`) : un motif d'arnaque, ou null. Jamais l'aperçu de la boîte (auteur pas su).
          const motifConv = (c) => { const p = paireDeConv(uidC(c), c.id, null); const ex = extraitConversation(c, p&&p.r, p&&p.titre, normTitle);
            return ex.kind==='message' && ex.source==='fil' && !ex.vinted ? motifDeLApercu(ex.texte, ex.de==='eux' ? false : ex.de==='toi' ? true : null) : null; };
          const nArnaque = liste.reduce((n,c)=>n+(motifConv(c)?1:0),0);
          return (
            <div data-messagerie style={{marginBottom:12}}>
              {/* (16 oct.) UNE barre : le filtre en contrôle segmenté, le nombre
                  (déjà dans « Toutes N ») lu par les lecteurs d'écran seulement,
                  et l'actualisation en icône — plus deux rangées de commandes. */}
              <div className="vrm-msg-bar">
                {/* (5 nov., chantier G, revue 2.23) Les filtres au dessin des AUTRES filtres de l'app (`.vrm-filtres`). */}
                <div className="vrm-inbox-filters vrm-filtres" role="group" aria-label="Filtrer les conversations">
                  <button type="button" aria-pressed={messageFilter==='all'} onClick={()=>{setMessageFilter('all');setConvMax(40);}}>Toutes <span>{liste.length}</span></button>
                  <button type="button" data-a-repondre={aRepondre.length} aria-pressed={messageFilter.startsWith('repondre')} onClick={()=>{setMessageFilter('repondre');setConvMax(40);}}>À répondre{aRepondre.length>0&&<span>{aRepondre.length}</span>}</button>
                  <button type="button" aria-pressed={messageFilter==='unread'} onClick={()=>{setMessageFilter('unread');setConvMax(40);}}>Non lues{nonLus>0&&<span>{nonLus}</span>}</button>
                  {(nOffres>0 || messageFilter==='offres') && <button type="button" data-filtre-offres={nOffres} aria-pressed={messageFilter==='offres'} onClick={()=>{setMessageFilter('offres');setConvMax(40);}}>Offres reçues <span>{nOffres}</span></button>}
                </div>
                <div className="vrm-sr" data-messagerie-tete={nonLus>0 ? 'nonlus' : nonLusAilleurs>0 ? 'ailleurs' : boitesKO.length ? 'passu' : listeBrute.length ? 'toutlu' : 'vide'} data-nonlus={nonLus}>
                  {liste.length} conversation{liste.length>1?'s':''}
                </div>
                {/* (5 nov., revue 3.8) Une boîte en panne a SON « Réessayer » : l'icône de relecture se tait à côté. */}
                {!boitesKO.length && <button type="button" className="vrm-msg-refresh" onClick={()=>loadConvs(true)} aria-label="Mettre à jour les conversations" title="Mettre à jour les conversations"><Icon name="sync" size={17}/></button>}
              </div>
              <CompteurArnaque n={nArnaque}/>
              {messageFilter.startsWith('repondre')&&<ChoixReponses mode={messageFilter} total={aRepondre.length} offres={offresARepondre} onChoix={v=>{setMessageFilter(v);setConvMax(40);}}/>}
              {messageFilter.startsWith('repondre')&&<p className="vrm-inbox-feedback">{aRepondre.length?`${offresARepondre} offre${offresARepondre>1?'s':''} · ${aRepondre.length-offresARepondre} conversation${aRepondre.length-offresARepondre>1?'s':''} sans offre en attente`:'Aucune conversation confirmée comme étant à répondre.'} · Dernier auteur vérifié uniquement. Les fils non vérifiés restent dans Toutes.</p>}
              {messageFilter==='unread' && tri.length===0 && <p className="vrm-inbox-feedback">Aucune conversation non lue dans cette sélection.</p>}
              {messageFilter==='unread' && nonLusAnciens>0 && <p className="vrm-inbox-feedback" data-nonlus-anciens={nonLusAnciens}>{nonLusAnciens} autre{nonLusAnciens>1?'s':''} non lue{nonLusAnciens>1?'s':''}, sans message depuis 7 jours : dans {'«\u00a0Toutes\u00a0»'}, pas comptée{nonLusAnciens>1?'s':''} ici.</p>}
              {messageFilter==='offres' && tri.length===0 && liste.length===0 && <p className="vrm-inbox-feedback">Plus aucune offre en attente dans cette sélection.</p>}
              {nonLusAilleurs>0 && (
                <div data-nonlus-ailleurs={nonLusAilleurs} style={{fontSize:13,color:C.text,lineHeight:1.45,marginBottom:8}}>
                  <b>{nonLusAilleurs}</b> non lu{nonLusAilleurs>1?'s':''} sur {nonLusAilleurs>1?'tes autres comptes':'un autre compte'}, pas affiché{nonLusAilleurs>1?'s':''} ici — {'«\u00a0Tous les comptes\u00a0»'} pour {nonLusAilleurs>1?'les':'le'} voir.
                </div>
              )}
              {boitesKO.length>0 && (
                <div data-boites-ko={boitesKO.map(a=>String(a.vinted_user_id)).join(',')} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:13,color:C.text,lineHeight:1.45,border:`1px solid ${C.warn}55`,background:`${C.warn}0e`,borderRadius:12,padding:'8px 11px',marginBottom:10}}>
                  <span aria-hidden="true" style={{color:C.warn,flexShrink:0,marginTop:1}}><Icon name="chat" size={15}/></span>
                  <span>
                    {boitesKO.length===1 ? <>La boîte de <b>{accName(boitesKO[0])}</b> n'a pas pu être lue</>
                      : <>Les boîtes de {boitesKO.map((a,i)=><React.Fragment key={String(a.vinted_user_id)}>{i?(i===boitesKO.length-1?' et ':', '):''}<b>{accName(a)}</b></React.Fragment>)} n'ont pas pu être lues</>}
                    {' '}: messages pas comptés ici. Si ça dure, ouvre Vinted sur {boitesKO.length===1?'ce compte':'ces comptes'}.
                    {' '}<button type="button" className="vrm-pied-lien" data-pied-lien="reessayer" data-boites-ko-reessayer="" onClick={()=>loadConvs(true)}>{VERBES.reessayer}</button>
                  </span>
                </div>
              )}
              {nAuDessusMini>0 && messageFilter!=='offres' && (
                <button type="button" data-cible="offres" data-offres-au-mini={nAuDessusMini} onClick={()=>{setMessageFilter('offres');setConvMax(40);}} style={{display:'flex',gap:8,alignItems:'center',width:'100%',textAlign:'left',fontSize:13,color:C.text,lineHeight:1.4,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 12px',minHeight:44,marginBottom:10,cursor:'pointer'}}>
                  {/* (5 nov., chantier G) Neutre : l'accent reste rare (§7) ; la carte se touche, le chevron le dit. */}
                  <span aria-hidden="true" style={{flexShrink:0,color:C.muted,display:'inline-flex'}}><Icon name="tag" size={15}/></span>
                  <span style={{flex:1,minWidth:0}}><b>{nAuDessusMini} offre{nAuDessusMini>1?'s':''} au-dessus de ton prix mini</b> — accepte-les d'un geste. <span style={{color:C.muted}}>{offresAuto ? "Acceptation automatique activée." : "Rien n'est accepté tout seul."}</span></span>
                  <span aria-hidden="true" style={{flexShrink:0,color:C.muted,fontSize:17}}>›</span>
                </button>
              )}
              {boitesPerimees.length>0 && (
                <div data-boites-perimees={boitesPerimees.map(b=>String(b.acc.vinted_user_id)).join(',')} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:13,color:C.text,lineHeight:1.45,border:`1px solid ${C.warn}55`,background:`${C.warn}0e`,borderRadius:12,padding:'8px 11px',marginBottom:10}}>
                  <span aria-hidden="true" style={{color:C.warn,flexShrink:0,marginTop:1}}><Icon name="chat" size={15}/></span>
                  <span>
                    {boitesPerimees.length===1
                      ? <>La boîte de <b>{accName(boitesPerimees[0].acc)}</b> n'est plus à jour (dernière conversation captée le {jourCourt(boitesPerimees[0].conv)}, dernière vente le {jourCourt(boitesPerimees[0].vente)}) — ouvre ta messagerie Vinted sur ce compte.</>
                      : <>Les boîtes de {boitesPerimees.map((b,i)=><React.Fragment key={String(b.acc.vinted_user_id)}>{i?(i===boitesPerimees.length-1?' et ':', '):''}<b>{accName(b.acc)}</b></React.Fragment>)} ne sont plus à jour (leur dernière vente est plus récente que leur dernière conversation captée) — ouvre ta messagerie Vinted sur chacun de ces comptes.</>}
                  </span>
                </div>
              )}
              {liste.length===0 && messageSearch.trim() && retireesIci.length===0 && <p data-msg-sans-resultat="" style={{fontSize:13,color:C.muted,lineHeight:1.45,margin:'4px 0 12px'}}>Aucune conversation ne correspond. Essaie un pseudo, un mot de l’article ou « N°12 ». <button type="button" className="vrm-pied-lien" data-pied-lien="effacer" onClick={()=>setMessageSearch('')}>{VERBES.effacer} la recherche</button></p>}
              {tri.length===0 && liste.length>0 && messageFilter!=='all' && <div data-msg-filtre-vide="" className="vrm-vue-vide"><b>Aucune conversation dans ce filtre</b><p>Les conversations sont toujours disponibles dans « Toutes ».</p><Bouton variante="secondaire" onClick={()=>{setMessageFilter('all');setConvMax(40);}}>Voir toutes les conversations</Bouton></div>}
              {/* (5 nov., chantier G) L'état vide dit QUOI FAIRE, en une phrase, et nomme les comptes lus. */}
              {listeBrute.length===0 && !messageSearch.trim() && !boitesKO.length && <div data-msg-vide="" className="vrm-vide-dessin"><Illustration nom="courrier" taille={104}/><p>Aucune conversation pour l’instant</p><p>Ouvre ta messagerie sur vinted.fr {NAV.dans} : elles arrivent ici.</p></div>}
              <div className="vrm-msg-list" style={{border:liste.length?`1px solid ${C.border}`:'none',background:C.card}}>
                {affiches.map((c,i)=>{
                  const paire = paireDeConv(uidC(c), c.id, null);
                  const auteur = auteurDernier(c, paire);
                  const offre = offreDeConv(c);
                  const tsConv = Date.parse(c.updated_at||'') || null;
                  const photo = (c.item_photos&&c.item_photos[0]&&c.item_photos[0].url) || (paire&&paire.photo) || (c.opposite_user&&c.opposite_user.photo&&c.opposite_user.photo.url) || null;
                  const ro = !!prioMsg && uidC(c)!==prioMsg;
                  // Les deux groupes se nomment UNE fois, en tête de chacun : la
                  // raison de la lecture seule vit dans l'en-tête de son groupe,
                  // jamais sur chaque ligne (§7).
                  const debutActif = !!prioMsg && !ro && i===0;
                  const debutRo = ro && (i===0 || uidC(affiches[i-1])===prioMsg);
                  return (
                    <React.Fragment key={(c._acc?c._acc.vinted_user_id:'')+'_'+c.id}>
                    {debutActif && (
                      <div className="vrm-msg-section" data-msg-groupe-actif={prioMsg} style={{color:C.muted,background:C.bg}}>
                        <span aria-hidden="true" style={{width:7,height:7,borderRadius:999,background:C.accent,flexShrink:0}}/>
                        <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nomActif} · ouvert {NAV.dansNu}</span>
                      </div>
                    )}
                    {debutRo && (
                      <div className="vrm-msg-section vrm-msg-section-ro" data-msg-lecture-seule={roListe.length} data-nonlus-autres={nonLusRo} style={{color:C.muted,background:C.bg}}>
                        <div className="vrm-msg-section-t">
                          <Icon name="eye" size={13}/><span>Autres comptes · lecture seule{nonLusRo>0?` · ${nonLusRo} non lu${nonLusRo>1?'s':''}`:''}</span>
                        </div>
                        <div className="vrm-msg-section-p" style={{color:C.text}}>
                          VRM répond au nom de <b>{nomActif}</b> seulement. Autre compte : bascule {NAV.nom} dessus.
                        </div>
                      </div>
                    )}
                    {(()=>{ const nom=(c.opposite_user&&c.opposite_user.login)||'Conversation';
                      // (5 nov.) L'EXTRAIT = le dernier message RÉEL (`extraitConversation`,
                      // src/messagesLisibles.js) quand le fil capté le confirme ; sinon ce que
                      // la boîte en dit — jamais le titre de la paire présenté comme un message,
                      // jamais un montant nu : une OFFRE se dit « Offre » avec son montant.
                      const ex = extraitConversation(c, paire&&paire.r, paire&&paire.titre, normTitle);
                      const offreDer = !offre && ex.kind==='offer' ? ex.offre : null;
                      const texteEx = ex.kind==='event' ? `Vinted : ${ex.texte}` : ex.kind==='message' ? (ex.vinted?`Équipe Vinted : ${ex.texte}`:ex.texte) : '';
                      return (
                    <LigneConv actif={openConv?.convId===c.id && String(openConv.acc?.vinted_user_id)===uidC(c)}
                      attrs={{'data-conv':c.id,'data-cible':attrCible(['conv',c.id],c._acc?['conv',String(c._acc.vinted_user_id),c.id]:null),'data-conv-acces':prioMsg?(ro?'lecture':'action'):undefined,'data-nonlu':c.unread?'1':undefined,
                        'data-conv-num':paire&&paire.num?paire.num:undefined,'data-conv-prix':paire&&paire.prix!=null?String(paire.prix):undefined,'data-conv-etat':paire&&paire.etat?paire.etat.k:undefined,'data-conv-auteur':auteur||undefined,'data-conv-quand':tsConv?new Date(tsConv).toISOString():undefined,'data-conv-compte':c._acc?String(c._acc.vinted_user_id):undefined,'data-conv-offre':offre?String(offre.prix):undefined}}
                      onClick={()=>openConversation(c)}
                      style={{color:ro?C.muted:C.text,...(filtreMsg&&uidC(c)!==filtreMsg?STYLE_FLOU:null)}}
                      photo={photo} nom={nom} sensible
                      compte={(plusieurs||!!messageSearch.trim()) && c._acc && !(prioMsg && !ro && !messageSearch.trim()) ? accName(c._acc) : ''}
                      quand={tsConv||null} couleurHeure={c.unread&&!ro?C.text:C.muted}
                      titre={(paire&&paire.titre)||c.item_title||c.item?.title||''} num={paire&&paire.num?paire.num:''} etat={paire&&paire.etat?paire.etat:null}
                      extrait={offreDer ? <span className="vrm-msg-etat vrm-msg-offre-der" data-offre-derniere={String(offreDer.montant)} data-offre-sens={offreDer.sens} data-offre-etat={offreDer.etat||undefined} style={{color:C.text,borderColor:C.border}}>{libelleOffre(offreDer)} {prix(offreDer.montant,offreDer.devise)}{offreDer.ancien?<> <s className="vrm-msg-offre-ancien" style={{color:C.muted}}>{prix(offreDer.ancien,offreDer.devise)}</s></>:null}{etatOffreCourt(offreDer.etat,offreDer.etatLibelle)?<> · {etatOffreCourt(offreDer.etat,offreDer.etatLibelle)}</>:null}</span> : texteEx} couleurExtrait={c.unread?C.text:C.muted} toi={ex.kind==='message'&&ex.source==='fil'&&(ex.de==='toi'||auteur==='toi')}
                      attrsExtrait={{'data-conv-extrait':ex.kind,'data-conv-extrait-source':ex.source}}
                      apres={<>
                          {/* (19 oct.) Sur la ligne du message, pas sur celle de la paire : là
                              elle tronquait le N° et le prix (vu au rendu à 1512 px). */}
                          <PastilleArnaque motif={ex.kind==='message'&&ex.source==='fil'&&!ex.vinted?motifDeLApercu(ex.texte, ex.de==='eux'?false:ex.de==='toi'?true:null):null}/>
                          {messageFilter.startsWith('repondre')&&!offre&&<span className="vrm-msg-etat">{/\?/.test(c.description||'')?'Question reçue':'Message reçu'}</span>}{offre && <span className="vrm-msg-etat vrm-msg-offre" data-offre-liste={String(offre.prix)} style={{color:C.text,borderColor:C.border,fontWeight:600}}>Offre {prix(offre.prix)} en attente</span>}{offre && offreFacePlancher(offre.prix, plancherDeItem(offre.item, paire&&paire.devise))?.niveau==='sous' && <span data-offre-sous-plancher="" title="Sous ton prix d’achat et tes frais connus" style={{color:C.warn,fontSize:13,fontWeight:500,marginLeft:6,whiteSpace:'nowrap'}}>à perte</span>}
                          {/* (5 nov.) Le dernier message est une offre (reçue, envoyée, tranchée) :
                              marquée « Offre » avec son montant, à SA conversation — plus jamais un
                              code ni un montant nu. L'offre EN ATTENTE garde sa pastille d'accent. */}
                      </>}
                      point={c.unread ? (ro?C.muted:C.accent) : null}/>
                    ); })()}
                    </React.Fragment>
                  );
                })}
              </div>
              {nSansDate>0 && <p className="vrm-msg-sans-date" data-conv-sans-date={nSansDate} style={{color:C.muted}}>{nSansDate} sans date lue : en bas de la liste.</p>}
              {/* (5 nov., chantier G, revue 2.23) UN style de lien en pied (`vrm-pied-lien`) ; le compte « 40/200 » reste lisible à côté. */}
              {tri.length>convMax && <button type="button" className="vrm-msg-more vrm-pied-lien" data-pied-lien="suite" onClick={()=>React.startTransition(()=>setConvMax(m=>m+40))}>Afficher les {Math.min(40,tri.length-convMax)} suivantes <span className="vrm-pied-lien-n">{convMax} sur {tri.length}</span></button>}
              {retireesIci.length>0 && (
                <p className="vrm-msg-retirees" data-conv-retirees={retireesIci.length} style={{color:C.muted}}>
                  {/* (revue) Pendant une recherche, une conversation retirée qui
                      correspond n'est pas « aucun résultat » : c'est dit ici, une fois. */}
                  <span>{messageSearch.trim()
                    ? <>{retireesIci.length} conversation{retireesIci.length>1?'s':''} correspond{retireesIci.length>1?'ent':''} à ta recherche, mais tu {retireesIci.length>1?'les as retirées':'l’as retirée'} de la liste — {phraseRetour(retireesIci.length)}.</>
                    : <>{retireesIci.length} conversation{retireesIci.length>1?'s':''} retirée{retireesIci.length>1?'s':''} de la liste — {phraseRetour(retireesIci.length)}.</>}</span>
                  <button type="button" className="vrm-pied-lien" data-pied-lien="remettre" data-conv-remettre="" onClick={()=>{const suivant=remettreConversations(convRetirees,retireesIci.map(c=>cleConversation(uidC(c),c.id)));setConvRetirees(suivant);save(CONVERSATIONS_RETIREES,suivant);}}>{retireesIci.length>1?'Les remettre':'La remettre'}</button>
                </p>
              )}
            </div>
          );
        })()}
        </div><div className="vrm-chat-column" data-conv-ouverte={openConv?.convId!=null?String(openConv.convId):undefined}>{openConv?rendreConversation():<div className="vrm-chat-empty"><Icon name="chat" size={28}/><span>Choisis une conversation</span><small>La plus récente est en haut.</small></div>}</div>{rendreFicheConv()}</div>
        {/* (11 nov.) Les réponses rapides se RÈGLENT dans une feuille, ouverte par le crayon au bout de la
            rangée du fil (une seule entrée : la barre « Réponses rapides » sous la liste faisait doublon). */}
        {feuilleQR&&<SheetShell onClose={()=>{setFeuilleQR(false);setShowQR(false);}} titre="Réponses rapides" data-feuille-rapides="">
        {/* Réponses rapides : modèles éditables, proposés dans chaque conversation. */}
        {/* (5 nov., chantier G) Le titre est celui du repli (plus écrit deux fois) ; « Modifier » au style des liens de pied ;
            chaque pastille se prend au doigt (44 px) ; « + Ajouter » neutre (l'accent reste rare, §7). */}
        <div className="vrm-qr-boite" data-reponses-rapides={quickReplies.length} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 12px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontSize:13,color:C.muted,flex:1,lineHeight:1.4}}>Touche un message pour le copier ; dans une conversation, il remplit la réponse.</span>
            <button type="button" className="vrm-pied-lien" data-pied-lien="qr-modifier" onClick={()=>setShowQR(v=>!v)}>{showQR?'Terminer':VERBES.modifier}</button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {quickReplies.map((t,i)=>(
              <div key={i} className="vrm-qr-puce" style={{display:'flex',alignItems:'center',gap:2,border:`1px solid ${C.border}`,borderRadius:999,background:C.bg,padding:'0 4px 0 14px'}}>
                <button type="button" onClick={(ev)=>{ try{navigator.clipboard.writeText(t);}catch(_){ } const b=ev.currentTarget; const p=b.textContent; b.textContent=VERBES.copie; setTimeout(()=>{ try{b.textContent=p;}catch(_){ } },1000); }} title="Copier ce message" style={{border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',maxWidth:240,minHeight:36,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',padding:'0 6px 0 0'}}>{t}</button>
                {showQR ? (
                  <>
                    <button className="vrm-icon-control" aria-label={`Modifier « ${t} »`} type="button" onClick={async ()=>{ const v=await askText({ desc: 'Modifier le message :', value: t }); if(v!=null){ const a=[...quickReplies]; if(v.trim()){a[i]=v.trim();} else {a.splice(i,1);} saveQR(a); } }} title={VERBES.modifier} style={{border:'none',background:'transparent',color:C.muted,cursor:'pointer'}}><Icon name="pencil" size={15}/></button>
                    <button type="button" className="vrm-icon-control" aria-label={`Supprimer « ${t} »`} data-reponse-supprimer={i} onClick={()=>{ /* (10 nov., lot Y) à la corbeille 30 jours, pilule « Annuler » 5 s */ if (!gesteCorbeille({ type:'reponse', libelle:t, morceaux:[{ k:'vinted_quick_replies', type:'element', id:t, index:i, avant:t, defaut:quickReplies }] }, { vinted_quick_replies: setQuickReplies })) { const a=[...quickReplies]; a.splice(i,1); saveQR(a); } }} title={VERBES.supprimer} style={{border:'none',background:'transparent',color:C.muted,cursor:'pointer'}}><Icon name="trash" size={15}/></button>
                  </>
                ) : null}
              </div>
            ))}
            {showQR && <button type="button" className="vrm-qr-puce" onClick={async ()=>{ const v=await askText({ desc: 'Nouveau message rapide :', value: '' }); if(v&&v.trim()) saveQR([...quickReplies,v.trim()]); }} style={{border:`1px dashed ${C.border}`,borderRadius:999,background:'transparent',color:C.text,fontSize:13,fontWeight:600,padding:'0 14px',cursor:'pointer',fontFamily:'inherit'}}>+ {VERBES.ajouter}</button>}
          </div>
        </div>
        </SheetShell>}
      </>/*⟦←/⟧*/);
}

// La branche {!openConv.loading && !openConv.error && openConv.convId && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function VueConversation({ v }) {
  const { accName, actionOffre, actionsOffresIncertaines, annonceDuFilPartie, annonceParId, autoriserNouvelleActionOffre, autoriserNouvelleReponse, contreOffreOuverte, fmtE, listings, modifierReponse, msgLectureSeule, msgNomActif, msgPeutAgir, msgRelais, msgRelaisVinted, numeros, offreBusy, offreDuFil, offreMsg, offrePartieDuFil, openConv, paireDeConv, plancherDeItem, prixOffre, prixOffreRef, quickReplies, replyBusy, replyErr, replyNotice, replyText, reponsesIncertaines, retirerConvDeLaListe, saisirPrixAnnonce, sendReply, setContreOffreOuverte, setFeuilleQR, setPrixOffre, setShowQR } = v;
  return (/*⟦← App.jsx #v2⟧*/(()=>{ const ro = msgLectureSeule(openConv.acc); const offreBloquee=!!actionsOffresIncertaines[cleActionOffreVinted(openConv.owner,openConv.acc?.vinted_user_id,openConv.convId)]; const sansExt = !vmrExtPresent() && !msgRelais; const lienVinted = `https://www.vinted.fr/inbox/${openConv.convId}`; return (
              <div className="vrm-chat-foot" data-conv-ro={ro?String(openConv.acc.vinted_user_id):undefined} style={{borderTop:`1px solid ${C.border}`,background:C.card}}>
                {offreBusy&&<div className="vrm-chat-note" role="status">Action sur une offre en cours… Attends le résultat avant de recommencer.</div>}
                {offreBloquee&&<div className="vrm-chat-note" role="alert" data-offre-incertaine>Action pas confirmée : vérifie sur Vinted avant de recommencer. <a href={lienVinted} target="_blank" rel="noreferrer">Ouvrir sur Vinted ↗</a><button type="button" className="vrm-chat-btn" onClick={autoriserNouvelleActionOffre}>J’ai vérifié sur Vinted</button></div>}
                {/* Lecture seule : CE fil-ci, nommé par son compte (ce qui le
                    distingue) — la raison générale est dite une fois au-dessus
                    de la liste (§7). */}
                {ro && (
                  <div className="vrm-chat-note" data-conv-lecture-seule={String(openConv.acc.vinted_user_id)} style={{color:C.text}}>
                    <span aria-hidden="true" style={{color:C.muted,flexShrink:0,marginTop:1}}><Icon name="eye" size={14}/></span>
                    <span><b>Lecture seule</b> — pour répondre, ouvre vinted.fr connecté sur <b>{accName(openConv.acc)}</b> {msgRelais ? 'dans le navigateur de ton ordinateur' : NAV.dansNu} (il est sur {msgNomActif()||(msgRelais?'aucun compte':'un autre compte')}).</span>
                  </div>
                )}
                {/* ── L'OFFRE (5.135) : trancher celle de l'acheteur, ou en faire
                    une. Par l'extension, sur le compte connecté dans Chrome. */}
                {(()=>{
                  // (29 oct.) Une offre dont l'annonce est PROUVÉE partie (une lecture
                  // complète du dressing, faite après l'offre, ne la montre plus) :
                  // plus d'Accepter / Refuser — dit, avec la raison (`offreDuFil`).
                  // (revue) UNE voix : « Annonce plus en vente » est dit par la bande
                  // d'état en haut ; ce bloc porte la raison et LE geste (le bouton
                  // de l'en-tête n'a qu'une icône sur téléphone).
                  const offCapturee = offrePartieDuFil(openConv);
                  const off = offCapturee ? null : offreDuFil(openConv);
                  if (offCapturee) return (
                    <div className="vrm-chat-offre vrm-chat-offre-info" data-cible="offre" data-offre="annonce-partie" style={{background:C.bg,border:`1px solid ${C.border}`}}>
                      <div className="vrm-chat-offre-t" style={{color:C.text}}>Offre de <b data-montant="">{fmtE(offCapturee.prix)}</b></div>
                      <div className="vrm-chat-offre-p" style={{color:C.muted}}>Annonce plus dans ton dressing : offre plus acceptable.</div>
                      <button type="button" className="vrm-chat-offre-retirer" data-offre-retirer="" onClick={()=>retirerConvDeLaListe(openConv)} style={{color:C.text,borderColor:C.border}}>Retirer de la liste</button>
                    </div>
                  );
                  const tx = openConv.conversation && openConv.conversation.transaction && openConv.conversation.transaction.id;
                  if (!off && !tx) return null;
                  // (27 oct.) Prix mini posé sur CETTE annonce (par identité, l'item_id,
                  // §5). Une offre ≥ mini est pré-approuvée : l'Accepter est mis en avant.
                  // Rien n'est accepté tout seul — c'est TON tap (garde stricte, §3).
                  const itemF = openConv.conversation && openConv.conversation.transaction && openConv.conversation.transaction.item_id;
                  const minF = itemF!=null ? Number(String((numeros[String(itemF)]||{}).min ?? '').replace(',','.')) : NaN;
                  const auDessusMini = !!(off && isFinite(minF) && minF>0 && off.prix >= minF);
                  const pc=paireDeConv(String(openConv.acc?.vinted_user_id||''),openConv.convId,openConv.conversation);
                  // (3 nov.) « Proposer X € » : X depuis SON prix mini seulement (`contreOffreMini`).
                  const contreMini = off && pc && (pc.devise||'EUR')==='EUR' ? contreOffreMini(off.prix, pc.prix, isFinite(minF)&&minF>0?minF:null) : null;
                  const etat = msgRelais ? 'ok' : extSait('messagerie');
                  if (etat !== 'ok' || (!msgRelais && __vmrPlusieurs)) return (
                    <div className="vrm-chat-offre vrm-chat-offre-info" data-cible={off?'offre':undefined} data-offre="indisponible" style={{background:C.bg,border:`1px solid ${C.border}`}}>
                      {off ? <div className="vrm-chat-offre-t" style={{color:C.text}}>Offre de <b data-montant="">{fmtE(off.prix)}</b> <span style={{color:C.muted,fontWeight:500}}>en attente</span></div> : null}
                      {off ? <LignePlancher plancher={plancherDeItem(itemF,pc?.devise)} offre={off.prix} mini={isFinite(minF)&&minF>0?minF:null} ambre={C.warn} onSaisir={annonceParId.get(String(itemF))?()=>saisirPrixAnnonce(annonceParId.get(String(itemF))):null}/> : null}
                      <div className="vrm-chat-offre-p" style={{color:C.muted}}>
                        {__vmrPlusieurs ? textePlusieurs() : etat==='retard' ? `Mets l'extension à jour (${EXT_CAPACITES.messagerie}) pour trancher ou faire une offre d'ici.` : "Les offres se font depuis le navigateur où l'extension est installée."}
                        {!sansExt && <>{' '}<a href={lienVinted} target="_blank" rel="noreferrer" style={{color:C.accentTexte,fontWeight:600}}>Ouvrir sur Vinted</a></>}
                      </div>
                      {contreMini!=null && <a className="vrm-chat-btn" data-offre-proposer-vinted={String(contreMini)} href={lienVinted} target="_blank" rel="noreferrer" style={{marginTop:8,alignSelf:'flex-start',textDecoration:'none'}}>Proposer {eurCourt(contreMini)} · à faire sur Vinted ↗</a>}
                    </div>
                  );
                  return (
                    <div className="vrm-chat-offre" data-cible={off?'offre':undefined} data-offre={off?'attente':'libre'} data-offre-ro={ro?'1':undefined} style={{background:C.bg,border:`1px solid ${C.border}`,opacity:ro?0.55:1}}>
                      {/* (31 oct., maquettes Messages) LA CARTE D'OFFRE : « Offre de X € — ton
                          mini : Y € » (le mini posé à côté du N°, par identité), puis
                          Refuser · contre-offre proposée · Accepter. Les MÊMES gestes
                          qu'avant (`actionOffre`) : Accepter demande confirmation, la
                          contre-offre ne fait que REMPLIR le prix — rien ne part sans
                          « Envoyer l'offre ». Aucun geste automatique (§3). */}
                      {off && (()=>{
                        const mini = Number.isFinite(minF)&&minF>0 ? minF : null;
                        const contre = contreMini;
                        const afficheCompare=prixAnnoncePourOffre(listings.items,itemF,String(openConv.acc?.vinted_user_id||''));
                        return (
                        <div className="vrm-chat-offre-l vrm-chat-offre-traiter" data-offre-au-dessus-mini={auDessusMini?String(Math.round(minF)):undefined} data-offre-mini={mini!=null?String(mini):undefined} data-offre-contre={contre!=null?String(contre):undefined}>
                          <ResumeOffre affiche={afficheCompare} offre={off.prix} mini={mini} fmt={fmtE} titre={pc?.titre||''} photo={pc?.photo?<PhotoVinted src={pc.photo} size={44}/>:null}/>
                          {/* (9 nov., lot F) Le plancher : prix d'achat SAISI + frais connus — jamais un prix conseillé. */}
                          <LignePlancher plancher={plancherDeItem(itemF,pc?.devise)} offre={off.prix} mini={mini} ambre={C.warn} onSaisir={annonceParId.get(String(itemF))?()=>saisirPrixAnnonce(annonceParId.get(String(itemF))):null}/>
                          <div className="vrm-chat-offre-actions">
                            <button type="button" className="vrm-chat-btn" data-offre-geste="refuser" disabled={offreBusy||ro||offreBloquee} onClick={()=>actionOffre('reject', off)} style={{opacity:(offreBusy||offreBloquee)?0.6:1}}>Refuser</button>
                            {contre!=null
                              ? <button type="button" className="vrm-chat-btn" data-offre-geste="proposer" data-offre-proposer={String(contre)} disabled={!tx||ro||offreBusy||offreBloquee} aria-label={`Proposer ${eurCourt(contre)}`} onClick={()=>actionOffre('offre', off, contre)} style={{opacity:(offreBusy||offreBloquee)?0.6:1}}>Proposer {eurCourt(contre)}</button>
                              : <button type="button" className="vrm-chat-btn" data-offre-geste="contre" disabled={!tx||ro||offreBusy||offreBloquee} aria-label="Contre-proposer" onClick={()=>{setContreOffreOuverte(true);requestAnimationFrame(()=>prixOffreRef.current?.focus());}}>Contre-offre</button>}
                            <button type="button" className="vrm-chat-btn vrm-chat-btn-p" data-offre-geste="accepter" disabled={offreBusy||ro||offreBloquee} onClick={()=>actionOffre('accept', off)} style={{opacity:(offreBusy||offreBloquee)?0.6:1}}>Accepter</button>
                          </div>
                        </div>);
                      })()}
                      {tx && (
                        <details className="vrm-chat-negociation" open={!!prixOffre||contreOffreOuverte}><summary>{off?'Proposer un autre prix':'Proposer un prix'}</summary><div className="vrm-chat-offre-l">
                          <span className="vrm-chat-offre-k" style={{color:C.muted}}>Ton prix</span>
                          <input ref={prixOffreRef} className="vrm-chat-prix" inputMode="decimal" disabled={ro||offreBusy||offreBloquee} value={prixOffre} onChange={e=>setPrixOffre(e.target.value)} placeholder="Prix&nbsp;€" aria-label="Prix de l'offre"
                            style={{border:`1px solid ${C.border}`,background:C.card,color:C.text}}/>
                          <button type="button" className="vrm-chat-btn" disabled={offreBusy||ro||offreBloquee||!prixOffre.trim()} onClick={()=>actionOffre('offre')} style={{border:`1px solid ${C.border}`,background:C.card,color:ro?C.muted:C.text,opacity:(offreBusy||ro||offreBloquee||!prixOffre.trim())?0.5:1}}>Envoyer l'offre</button>
                        </div></details>
                      )}
                      {offreMsg && <div role={offreMsg.err?'alert':'status'} aria-live="polite" style={{fontSize:12,marginTop:6,color:offreMsg.err?C.danger:C.text}}>{offreMsg.err||('✓ '+offreMsg.ok)}</div>}
                    </div>
                  );
                })()}
                {openConv.conversation?.allow_reply===false && <div role="status" style={{fontSize:12,color:C.muted,marginBottom:8}}>Vinted ne permet pas de répondre dans cette conversation.</div>}
                {msgRelais && !ro && <EtatRelaisConv vinted={msgRelaisVinted}/>}
                {replyNotice&&<div className="vrm-chat-retour" role="status">{replyNotice}</div>}
                {reponsesIncertaines[cleReponseVinted(openConv.acc?.vinted_user_id,openConv.convId)]&&<div className="vrm-chat-retour" role="alert">Envoi précédent à vérifier : rien ne repart tout seul. <a href={lienVinted} target="_blank" rel="noreferrer">Vérifier sur Vinted ↗</a><button type="button" onClick={autoriserNouvelleReponse}>Autoriser un nouvel envoi après vérification</button></div>}
                {replyErr && <div role="alert" style={{fontSize:12,color:C.danger,marginBottom:8,lineHeight:1.35}}>{replyErr}</div>}
                {/* (16 oct.) Sans extension ici (téléphone), VRM ne peut pas
                    envoyer : un champ de saisie inutilisable n'y a pas sa place.
                    Le seul geste qui marche — répondre sur Vinted — prend la
                    place du champ, une fois. */}
                {sansExt ? (
                  <a className="vrm-chat-vinted" href={lienVinted} target="_blank" rel="noreferrer" style={{background:C.accent,color:C.onAccent||'#fff'}}>Répondre sur Vinted ↗</a>
                ) : (<>
                {/* Réponses rapides : remplissent la zone (tu ajustes puis envoies).
                    (29 oct., revue) Pas sur une offre dont l'annonce est prouvée
                    partie : la première dit « l'article est toujours disponible ». */}
                {!offrePartieDuFil(openConv) && <RapidesConv liste={rapidesDuFil(listeRapides(quickReplies), annonceDuFilPartie(openConv))} onChoisir={modifierReponse} desactive={ro} style={{opacity:ro?0.5:1}} onModifier={()=>{setShowQR(true);setFeuilleQR(true);}}/>}
                <ComposeConv valeur={replyText} onChange={modifierReponse} onEnvoyer={sendReply} desactive={ro} entreeEnvoie enCours={replyBusy}
                  placeholder={ro?'Lecture seule sur ce compte':'Écris ta réponse…'}
                  envoiBloque={!!reponsesIncertaines[cleReponseVinted(openConv.acc?.vinted_user_id,openConv.convId)]||ro||replyBusy||!replyText.trim()||!msgPeutAgir||openConv.conversation?.allow_reply===false}/>
                </>)}
              </div>
            ); })()/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
import {correspondRechercheMessage} from '../rechercheMessagesVinted.js';
// ⟦← App.jsx #2⟧
import {contreOffreMini} from '../messagesVolets.js';
// ⟦← App.jsx #5⟧       // (9 nov., lot AI) l'avatar du compte Vinted ouvert (en haut à droite) — après la DA6
import {ChoixReponses,ResumeOffre} from "../ActionsClaires.jsx";
import {LignePlancher} from "../LignePlancher.jsx";
// ⟦← App.jsx #6⟧
import {prixAnnoncePourOffre} from "../actionsClaires.js";
// ⟦← App.jsx #7⟧
import { motifDeLApercu } from "../antiArnaque.js";
// ⟦← App.jsx #3⟧
// ⟦→ ecrans/Ebay.jsx #1⟧
// « 105 € » (un montant entier sans « ,00 »), « 44,50 € » sinon — la contre-offre en un tap.
const eurCourt = (v) => (Number.isInteger(Number(v)) ? `${Number(v)}\u00a0€` : `${Number(v).toFixed(2).replace('.', ',')}\u00a0€`);
// ⟦← App.jsx #4⟧
// (11 nov., lot DJ8) Messages → Favoris & offres → « Offres auto » (src/OffresAuto.jsx).
const OffresAuto = aLaDemande(() => import('../OffresAuto.jsx'));
// ⟦← App.jsx #8⟧
// La ligne d'avancement d'un geste relayé (messagerie : une conversation à la
// fois, donc une seule demande en vol).
function etapeRelaisExec() {
  for (const k of Object.keys(__vmrJobs)) if (/^exec:/.test(k) && __vmrJobs[k] && /^relais-/.test(__vmrJobs[k].etape)) return __vmrJobs[k].etape;
  return null;
}
// ⟦← App.jsx #9⟧
// L'avancement d'un geste de la messagerie passé par le relais (abonné aux
// évènements : la ligne change sans attendre un autre rendu de l'écran).
function EtatRelaisConv({ vinted }) {
  useExtVivante();
  const et = etapeRelaisExec();
  return <div data-conv-relais={et || 'pret'} role="status" style={{ fontSize: 12, color: et ? C.text : C.muted, marginBottom: 6, lineHeight: 1.35 }}>{et ? libelleRelais(et) : `Répondre et les offres partent ${viaOrdinateur(vinted)}.`}</div>;
}
// ⟦← App.jsx #10⟧
// (1er nov., audit A13) Sous une annonce PROUVÉE partie (vendue, supprimée — même
// sans offre), aucune réponse rapide ne dit « toujours disponible » : un toucher
// la mettrait dans le champ, et elle serait fausse. Les autres restent.
const REPONSE_DISPONIBLE = /disponible|\bdispo\b/i;
const rapidesDuFil = (liste, partie) => (partie ? (liste || []).filter((q) => !REPONSE_DISPONIBLE.test(String(q && q.t || ''))) : liste);