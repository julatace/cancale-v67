// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import React from 'react';
import { montant } from '../format.js';
import { PhotoVide } from '../composants/PhotoVide.jsx';
import { Numero } from '../composants/Numero.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { PAS_SU } from '../libelles.js';
import { MENTION_SANS_NUM, phraseImprimeSansNumero } from '../bordereauVenteEmail.js';
import { texteLimiteEnvoi } from '../../api/_lib/limite-envoi.js';
import { photoArticle, photoCommande } from '../photosArticles.js';
import { retoursPourSite, remiseEnStock, retourAReceptionner, LIBELLE_ETAPE } from '../retoursStock.js';
import PastilleTransporteur, { LogoTransporteur, LogoInconnu, BadgeTransporteur } from '../PastilleTransporteur.jsx';
import { cleStatTransporteur } from '../transporteursVisuels.js';
import { rangerEnvoyes, filtresTransporteurs, filtrerEnvoyes, nomEnvoye, raisonInconnu, compterRaisons, libelleTransp } from '../colisEnvoyes.js';
import { nbSansDate, debutSansDate, quandColisAEnvoyer } from '../ordreRecent.js';
import Frise from '../design/Frise.jsx';
import { friseColisFusion } from '../design/friseFusion.js';
import { gestesDepuis } from '../tournee.js';
import { joursAttente, texteAttente as texteAttenteVente, groupesTournee } from '../colisEnvoi.js';
import { attrCible } from '../cibleNotif.js';
import { AcctTag, Bouton, BoutonBordereau, BoutonSuivreColis, C, CarteColisVc, DEMANDE_EBAY_CIBLE, DEMANDE_STOCK_CHERCHE, Icon, LigneSansDate, PhotoVinted, Pourquoi, QrColis, RaisonBordereauxGrises, SheetShell, Skeleton, askConfirm, askText, clavierNum, cleNum, colisVestiaire, garageCellLabel, garageCellOf, gesteVrm, lbcExpediee, libererOngletPdf, lienCommandeEbay, lirePdfLigne, load, marquerVc, messagePdfManquant, normTitle, numLigneEbay, numeroReprenable, octetsBordereau, orderPhoto, pdfEtiquettesParTx, pdfVusParTx, relierBoiteDe, save, toast, trackUrl, vcCarte } from '../App.jsx';

// La branche {ongletColisVu==='envoyer' && …} de Comptabilite, telle quelle, avec 5 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueColisEnvoyer({ v }) {
  const { accNameOf, accounts, accountsReady, bordKey, bordPhoto, bordsHidden, bordsPrinted, bordsSansNum, bordsShipped, colisAEnvoyerBase, colisEb, colisSansCompte, colisTous, conflitsNum, deposeScan, ebayLuA, effEntry, emailBords, filtreEnvoyer, garageGrid, garageUtilise, imgMortes, invForBord, isBordDone, isBordHidden, isBordPrinted, isBordShippedManual, isShipDone, labelsCaptes, labelsPrets, loadOrders, majLbcFait, nEnvoyesVu, noterImgMorte, noterImprimeSansNum, numForBord, numLitige, onColisLeboncoin, onLocate, onNav, onOngletColis, only, plusieursComptesColis, preuvesFriseDe, printBordAndInvoice, processBordereau, rangerColisEnvoi, rechargerLabels, sales, setBordsHidden, setBordsPrinted, setBordsShipped, setFiltreEnvoyer, setLinkPickFor, setLinkSearch, setSaleOverride, setSales, setScanOuvert, setShipDone, setShowBordDone, setTourneeDepot, shipDone, showBordDone, startBordereau, texteEnvoiColis, tourneeDepot, trNomColis, transporteurVente, uidsSansEmail, vcEtat, voitSite } = v;
  /*⟦← App.jsx #h1_1⟧*/const toggleBordPrinted = (b) => {
    const k = bordKey(b); if (!k) return;
    const avant = bordsPrinted[k];
    gesteVrm(avant ? 'Remis dans « à imprimer »' : 'Marqué imprimé', [{ k: 'vinted_bords_printed', type: 'cle', id: k, apres: avant ? undefined : new Date().toISOString(), avant }], { vinted_bords_printed: setBordsPrinted });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const hideBord = (b) => { const k=bordKey(b); if(!k) return; gesteVrm('Bordereau masqué', [{ k: 'vinted_bords_hidden', type: 'cle', id: k, apres: 1, avant: bordsHidden[k] }], { vinted_bords_hidden: setBordsHidden }); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const gesteColisFait = (o, b, oui) => {
    const k = o && o.transaction_id != null ? String(o.transaction_id) : null, kb = b ? bordKey(b) : null;
    const ops = [];
    if (k && (oui ? !shipDone[k] : !!shipDone[k])) ops.push({ k: 'vinted_ship_done', type: 'cle', id: k, apres: oui ? Date.now() : undefined, avant: shipDone[k] });
    if (kb && (oui || isBordShippedManual(b))) ops.push({ k: 'vinted_bords_shipped', type: 'cle', id: kb, apres: oui ? 1 : undefined, avant: bordsShipped[kb] });
    if (!ops.length) return;
    gesteVrm(oui ? 'Colis déposé' : 'Colis remis dans « à envoyer »', ops, { vinted_ship_done: setShipDone, vinted_bords_shipped: setBordsShipped });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const dateVenteColis = (x) => {
    if (!x) return null;
    if (x.__autre === 'vc') return x.v && x.v.date;
    if (x.__autre === 'eb') return x.x && x.x.ordre && x.x.ordre.creationDate;
    if (x.__autre === 'lbc') return x.o && (x.o.at || x.o.date);
    return x.o && x.o.date;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const attenteColis = (x) => joursAttente(dateVenteColis(x));/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<>
        {/* « N bordereaux sans vente correspondante » RETIRÉ le 30 septembre
            (Julien : « tu ne les affiches pas, tu attends d'avoir capté dans
            Vinted, les mails doivent juste servir de sécurité »). Ils n'ont
            jamais été des lignes de travail ; ils n'apparaissent plus du tout —
            dès que la vente est captée, le bordereau se rattache tout seul. */}
        {/* ── LA LISTE : UN COLIS = UNE VENTE QUI ATTEND MON ENVOI ───────────
            Une seule liste, construite sur la moisson de l'extension. Le
            bordereau (PDF reçu par email) n'est qu'un COMPLÉMENT de la ligne :
            avec lui on imprime en un clic, sans lui on le génère sur Vinted.
            Avant il y avait deux listes — les emails en haut, les vraies ventes
            en bas — et la paire à envoyer se retrouvait sous un bordereau
            fantôme d'un compte supprimé. */}
        {/* ── LES VENTES eBAY À POSTER (19 oct.) — « rien ne se passe après une
            vente eBay ». La commande n'était visible que dans eBay → Ventes.
            Une règle (`colisEbay`, §11), lue ici, dans Ma journée, la cloche,
            le widget et le rappel du matin. Le N° vient du SKU `VRM-{n°}`
            (`numLigneEbay`, jamais le titre, §5). L'étiquette se prend DANS
            eBay : l'acheteur a payé le port, VRM n'achète rien (§2.8). La phrase
            commune est dite UNE fois (§7) ; la ligne ne garde que ce qui la
            distingue. */}
        {/* (3 nov.) Les ventes Vestiaire à envoyer sont dans LA liste ci-dessous (« tout va être ensemble ») ;
            leurs « Colis fait » sont dans l'onglet « Envoyés ». Reste ici : Vestiaire illisible, dit. */}
        {only === 'bordereaux' && voitSite('vestiaire') && colisVestiaire(vcEtat) === null ? <div data-colis-vestiaire="passu" style={{ marginBottom: 10 }}><EtatPanne compact quoi="Tes colis Vestiaire" raison="Rien n’est perdu : rouvre Colis dans un moment."/></div> : null}
        {/* (10 nov.) « 1 colis de X : ses e-mails n'arrivent pas » n'est plus un bandeau (déjà dit par la ligne de
            fraîcheur du haut) : une petite marque sur la carte du colis concerné (`data-colis-sans-email`). */}
        {/* (31 oct.) Les emails reçus et ce que VRM en a fait — l'ambre quand un
            email attend un geste (bordereau au N° deviné, reçu sans n°…). */}
        {/* (2 nov., colis clair) « Tes emails, ce que VRM en a fait » n'est pas un geste
            du moment : il est descendu SOUS la liste (plus bas). */}
        {voitSite('ebay') && colisEb === null && <div data-colis-ebay="passu" style={{marginBottom:10}}><EtatPanne compact quoi="Tes ventes eBay" raison="Un colis eBay à envoyer manque peut-être à cette liste. Rien n’est perdu : rouvre Colis dans un moment."/></div>}
        {/* (3 nov., Julien : « tout va être ensemble ») Les ventes eBay à poster ne sont plus un bloc à part :
            elles sont dans LA liste ci-dessous, sous leur transporteur, avec la même carte que les autres
            (l'étiquette se prend dans eBay : l'acheteur a payé le port, §2.8). Reste ici l'âge de la lecture. */}
        {voitSite('ebay') && colisEb && colisEb.aPoster.length>0 && ebayLuA && Math.floor((Date.now() - ebayLuA) / 3600000) >= 6 ? (() => { const ageH = Math.floor((Date.now() - ebayLuA) / 3600000);
          return <p className="vrm-colis-note-ebay" data-colis-ebay-age={ageH} style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:'0 2px 10px'}}>Commandes eBay lues il y a {ageH >= 48 ? `${Math.floor(ageH/24)} j` : `${ageH} h`}, peut-être pas à jour : eBay → Compte → Rafraîchir.</p>; })() : null}
        {voitSite('vinted') && sales.loading && !sales.items && <Skeleton variant="row" count={4}/>}
        {voitSite('vinted') && sales.error && <div data-colis-ventes="passu" style={{marginBottom:10}}><EtatPanne compact quoi="Tes ventes Vinted" raison="Les colis à envoyer ne sont pas connus tant qu’elles ne sont pas lues." onReessayer={()=>loadOrders('sold',setSales,true)}/></div>}
        {(()=>{
          // ⚠️ 30 septembre (Julien : « les bordereaux doivent s'enlever quand
          // les ventes sont expédiées ») : un colis coché « colis fait » QUITTE
          // la liste. Pas en silence (« un colis caché est un colis perdu ») :
          // une ligne dit combien, et un clic les remontre.
          // (3 nov., Julien : « Vestiaire : tout va être ensemble ») UNE LISTE POUR TOUS LES SITES :
          // les colis Vinted (ci-dessous) et ceux d'eBay, Vestiaire et Leboncoin (`autresColis`, les
          // règles de LEUR site : `colisEbay`, `colisVcAPoster`, `colisLbcAPoster` — celles qui font
          // « À envoyer · N »), mélangés, rangés par transporteur, la même carte pour tous.
          // (3 nov.) La liste est construite par `colisAEnvoyerBase` (la même pour « Tout imprimer »).
          const { vintedLu, exTout, autresColis } = colisAEnvoyerBase();
          const estPosteT = (x) => !!(x.o ? isShipDone(x.o) : isBordShippedManual(x.b));
          const nbMasquesPostes = exTout.filter(estPosteT).length;
          // (2 nov., colis clair) Plus de phrase permanente « …est dans Partis » : le
          // nombre est sur « Partis » (`data-partis-coches`), et un coché que Vinted
          // n'a pas vu partir a sa ligne ambre (`data-poste-sans-depart`).
          const lignePostes = false && nbMasquesPostes > 0 ? (
            <button type="button" data-voir-postes={nbMasquesPostes} onClick={()=>{ const d=document.querySelector('[data-colis-partis]'); if(d){ d.open=true; try{ d.scrollIntoView({block:'start',behavior:'smooth'}); }catch(_){} } }}
              style={{alignSelf:'flex-start',border:'none',background:'transparent',padding:'2px 2px',color:C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              {nbMasquesPostes>1 ? `Les ${nbMasquesPostes} colis cochés « postés » sont dans « Partis », plus bas` : 'Le colis coché « posté » est dans « Partis », plus bas'}
            </button>) : null;
          // (2 nov.) Les colis cochés « postés » vivent dans « Partis » (replié, plus bas) :
          // ils ne sont plus redits ici (chaque colis une fois).
          const ex = exTout.filter(x => !estPosteT(x));
          if (!ex.length && autresColis.length) { /* d'autres sites ont des colis : la liste s'affiche */ }
          else if (!ex.length && !vintedLu) return null;   // ventes Vinted en lecture ou en panne : dit au-dessus
          // Sans compte relié, « aucun colis » n'est pas su : le geste est dit en tête (une fois).
          else if (!ex.length && colisSansCompte) return lignePostes;
          // (2 nov., audit des données ; limites n°3) Comptes ou ventes pas encore lus
          // (base lente) : « aucun colis » n'est pas su — on le dit, jamais un rien.
          // (5 nov.) Ventes en panne : la panne est dite UNE fois au-dessus (`EtatPanne`, avec « Réessayer »).
          else if (!ex.length && sales.error) return lignePostes;
          else if (!ex.length && (accountsReady !== true || (accounts.length > 0 && sales.items == null))) return (<>{lignePostes}
            <div data-colis-lecture="" role="status" style={{fontSize:13,color:C.muted,textAlign:'center',padding:'22px 16px',lineHeight:1.6}}>{PAS_SU.enCours}</div></>
          );
          // (5 nov., chantier D) L'état vide dit quoi attendre, en une phrase, et ce qui vit ailleurs.
          else if (!ex.length) return (<>{lignePostes}
            <div data-colis-aucun="" className="vrm-colis-vide-envoi">
              <span className="vrm-colis-vide-titre">Aucun colis à envoyer</span>
              <span className="vrm-colis-vide-sous">Une vente à envoyer apparaît ici dès que l’extension la lit.</span>
              {nEnvoyesVu ? <Bouton variante="secondaire" data-colis-voir-envoyes="" onClick={() => onOngletColis && onOngletColis('envoyes')}>Voir les envoyés</Bouton> : null}
            </div>
            {/* La tournée ouverte quand le dernier colis vient d'être déposé : elle le dit, puis se ferme sur SON geste. */}
            {tourneeDepot ? <SheetShell onClose={() => setTourneeDepot(false)} titre="Tournée de dépôt" maxWidth={560} data-tournee-sheet="">
              <div className="vrm-colis-vide-envoi" data-tournee-fini=""><span className="vrm-colis-vide-titre">Tout est déposé</span><span className="vrm-colis-vide-sous">Plus aucun colis à déposer pour l’instant.</span></div>
            </SheetShell> : null}</>
          );
          // (2 nov.) `nowrap` : à 1512 px « Marquer imprimé » passait sur deux lignes dans son bouton.
          const sec = { flexShrink:0, borderRadius:12, padding:'0 14px', minHeight:44, boxSizing:'border-box', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap' };
          // ⚠️ QUATORZE CARTES QUI PORTENT LA MÊME PHRASE, C'EST UNE PHRASE.
          // Chaque colis sans PDF affichait un bandeau pleine largeur expliquant
          // que l'extension s'en occupe — identique sur les quatorze (vu en
          // capture). Quand l'attente est la MÊME pour tous, elle se dit une
          // fois au-dessus de la liste ; dès que deux colis n'attendent pas la
          // même chose, chaque carte reprend la sienne (elle distingue).
          // ⚠️ Un colis DÉJÀ POSTÉ n'attend plus rien. Le compter ici faisait
          // deux choses fausses : la phrase parlait de bordereaux à récupérer
          // pour des cartons déjà partis, et deux attentes différentes la
          // faisaient disparaître alors que tous les colis en cours attendaient
          // la même chose.
          const estPoste = (x) => !!(x.o ? isShipDone(x.o) : isBordShippedManual(x.b));
          const nbPostes = ex.filter(estPoste).length;
          // ── LES GROUPES DE LA LISTE ────────────────────────────────────────
          // ⚠️ L'EN-TÊTE ANNONCE TROIS GROUPES (« 10 en retard · 3 aujourd'hui ·
          // 1 demain »), LA LISTE N'EN MONTRAIT AUCUN : quatorze cartes à la
          // suite, triées mais sans frontière. Sur téléphone il en voit cinq à
          // la fois — la limite entre « en retard » et « aujourd'hui » tombait
          // hors de l'écran, donc le compte du haut n'était pas vérifiable.
          // Le tri est déjà bon (le plus urgent en haut, les postés à la fin) :
          // on pose seulement l'intertitre à chaque charnière, comme pour
          // « Déjà postés ».
          // ⚠️ LE GROUPE SUIT LE TRI, sinon les intertitres se répètent.
          // On groupe sur CE QU'IL PEUT FAIRE — imprimer, ou attendre — parce
          // que c'est la seule frontière qui change son geste. L'urgence, elle,
          // reste écrite sur chaque carte et dans l'en-tête du haut.
          const aSonPdf = (x) => !!((x.b && x.b.hasPdf) || (x.txn && labelsCaptes[x.txn]));
          const groupeDe = (x) => estPoste(x) ? 'fait' : (aSonPdf(x) ? 'pret' : 'attente');
          // Même règle que l'en-tête : tant que tous les bordereaux ne sont pas
          // lus, un colis sans PDF trouvé n'est pas « en attente » — on ne sait pas.
          const lectureFinie = labelsPrets && emailBords!==null;
          const TITRE_GROUPE = {
            pret:    ['Prêts à imprimer', 'Le bordereau est là : imprime, colle, dépose.'],
            attente: lectureFinie ? ['En attente du bordereau', "« Générer le bordereau » le demande à l'extension, qui le fait sur Vinted et le dépose ici (l'email reste un filet). Tu peux aussi déposer un PDF déjà téléchargé."] : ['Bordereau pas encore vérifié', "Je n'ai pas encore pu lire tous tes bordereaux : celui de ces colis est peut-être déjà là. L'écran se met à jour tout seul."],
            fait:    ['Déjà postés', "Ils quittent la liste quand Vinted confirme l'envoi. « ↺ Pas encore » les remet dans les colis à envoyer."],
          };
          const nbParGroupe = {};
          ex.forEach(x => { const g = groupeDe(x); nbParGroupe[g] = (nbParGroupe[g] || 0) + 1; });
          // ⚠️ UN SEUL GROUPE : pas d'intertitre. Il redirait mot pour mot le
          // compteur du haut (« 14 colis à envoyer » puis « En retard · 14 »),
          // et le même nombre ne s'écrit pas deux fois sur un écran.
          const plusieursGroupes = Object.keys(nbParGroupe).length > 1;
          return (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {lignePostes}
              {/* La raison commune des boutons grisés, une fois (§7). */}
              <RaisonBordereauxGrises sansNombre ventes={ex.filter(e => !estPoste(e) && !aSonPdf(e) && e.o && e.o.transaction_id!=null).map(e => e.o)}/>
              {/* ⚠️ DEUX COLONNES SUR ORDINATEUR, comme Ventes et Achats (§5.63).
                  Une carte de colis tient dans 500 px et s'étalait sur 1120 :
                  trois colis visibles au lieu de six, sur l'écran où il travaille
                  quand il prépare ses cartons. `minmax(min(430px,100%), 1fr)` —
                  le `min()` évite qu'une piste de 430 px déborde un téléphone. */}
              {/* (5 nov., chantier D) La tournée de dépôt AU-DESSUS de la liste (la liste s'ouvre par son intertitre) :
                  les mêmes colis, rangés par la même règle que la liste (`rangerColisEnvoi`). */}
              {(() => {
                const trNomDe = trNomColis;
                const exT = rangerColisEnvoi([...ex, ...autresColis], trNomDe);
                // ── (5 nov., chantier D) LA TOURNÉE DE DÉPÔT ─────────────────────────────────────────
                // Les colis À ENVOYER de cette liste (les mêmes, dans le même ordre), regroupés par
                // transporteur — le réseau où on les dépose. Le point de dépôt précis d'un colis n'est relié
                // à lui par aucune identité : jamais deviné, c'est dit une fois. Chaque colis UNE fois, par
                // SA clé (n° de transaction, id Vestiaire, transaction Leboncoin — jamais le titre) ;
                // « Déposé » est le geste existant (`deposeScan` : « Colis fait », annulable 5 s) et le
                // scanner existant s'ouvre d'ici. eBay : l'étiquette vient d'eBay, le dépôt s'y suit.
                const faitsVc = vcCarte('vrm_vc_colis_done') || {};
                const faitsLbc = load('vrm_lbc_colis_done', {}) || {};
                const tourneeItems = exT.map((x) => {
                  const att = attenteColis(x);
                  if (x.__autre === 'vc') return faitsVc[x.v.id] ? null : { cle: 'vc:' + x.v.id, site: 'vestiaire', v: x.v, num: x.v.num || '', titre: x.v.titre || 'Article Vestiaire', photo: x.v.photo || null, att, pret: !!(x.v.bordereau || x.v.etiquette), x };
                  if (x.__autre === 'eb') return { cle: x.key, site: 'ebay', num: x.x.ordre ? (numLigneEbay(x.x.ordre, (x.x.ordre.lineItems || [])[0]) || '') : '', titre: x.x.titre || `Commande ${x.x.orderId}`, photo: x.x.ordre ? photoCommande(x.x.ordre) : null, lien: lienCommandeEbay(x.x.orderId, x.x.compte), att, pret: true, x };
                  if (x.__autre === 'lbc') { if (faitsLbc[x.x.txId]) return null; const f = x.x.itemId ? (load('vinted_annonce_numeros', {}) || {})[x.x.itemId] : null;
                    return { cle: 'lbc:' + x.x.txId, site: 'leboncoin', txId: x.x.txId, num: (f && f.numero != null) ? String(f.numero).trim() : '', titre: x.x.titre || (x.o && x.o.title) || '(sans titre)', photo: photoArticle(x.o || {}), att, pret: !!(x.o && x.o.label && x.o.label.voucherUrl), qr: (x.o && x.o.label && /^https?:\/\//.test(String(x.o.label.qrUrl || ''))) ? x.o.label.qrUrl : '', x }; }
                  const o = x.o, b = x.b; if (o ? isShipDone(o) : isBordShippedManual(b)) return null;
                  return { cle: 'v:' + (x.txn || x.key), site: 'vinted', o, b, num: (b ? numForBord(b) : '') || (o ? (effEntry(o)?.numero || '') : ''), titre: (o && o.title) || (b && (b.modele || b.article)) || 'Colis', photo: o ? orderPhoto(o) : bordPhoto(b), att, pret: !!x.pret, x };
                }).filter(Boolean);
                const groupesT = groupesTournee(tourneeItems, { trNom: (t) => trNomDe(t.x), cle: (t) => t.cle });
                const enAttenteT = deposeScan.attente ? String(deposeScan.attente.cle) : '';
                // (8 nov., « beauté ») LA PROGRESSION DU COMPTOIR : « 3 / 7 ». Déposés = les « Colis fait »
                // d'aujourd'hui (Vinted, Vestiaire, Leboncoin : les coches de toujours, `gestesDepuis`) ;
                // le total = déposés + ceux qu'on peut déposer (avec bordereau). Le colis en attente de ses
                // 5 s « Annuler » compte déjà déposé (il l'est à l'écran) — annulé, il revient.
                const deposesAujT = (() => { const m0 = new Date(); m0.setHours(0, 0, 0, 0); const t0 = m0.getTime(); return gestesDepuis(shipDone, t0) + gestesDepuis(faitsLbc, t0) + gestesDepuis(faitsVc, t0); })();
                const nDeposablesT = tourneeItems.filter((t) => t.pret && t.site !== 'ebay').length;
                const faitsT = deposesAujT + (enAttenteT && tourneeItems.some((t) => t.cle === enAttenteT) ? 1 : 0);
                const totalT = deposesAujT + nDeposablesT;
                const tourneeEl = (tourneeItems.length || tourneeDepot) ? (
                  <div key="__tournee" className="vrm-tournee-tete" >
                    {tourneeItems.length ? <span style={{display:'inline-flex',alignItems:'center',gap:2}}><Bouton variante="secondaire" icone="pin" data-tournee-ouvrir={tourneeItems.length} onClick={() => setTourneeDepot(true)}>Préparer la tournée de dépôt</Bouton>
                      {/* (8 nov., clarté) Ce que fait la tournée, pour qui la découvre : deux phrases derrière « ⓘ ». */}
                      <Pourquoi label="À quoi sert la tournée ?" titre="La tournée de dépôt">Les colis prêts à déposer, rangés par transporteur, pour tout faire en un passage. Au point relais, touche « Déposé » (ou scanne le bordereau) : il est noté déposé.</Pourquoi></span> : null}
                    {tourneeDepot ? (
                      <SheetShell onClose={() => setTourneeDepot(false)} titre="Tournée de dépôt" maxWidth={560} data-tournee-sheet=""
                        className="vrm-tournee-feuille"
                        sousTitre={(() => { const d = deposesAujT; // (6 nov., audit des chiffres) « à déposer » = les colis qui ONT leur bordereau (ceux qu'on peut
                          // déposer) ; une vente qui attend le sien est dite à part, jamais comptée « à déposer ».
                          const nDep = tourneeItems.filter((t) => t.pret).length, nAtt = tourneeItems.length - nDep;
                          return `${nDep} colis à déposer${nAtt ? ` · ${nAtt} ${nAtt > 1 ? 'attendent leur' : 'attend son'} bordereau` : ''}${d ? ` · ${d} déjà déposé${d > 1 ? "s" : ""} aujourd’hui` : ""}`; })()}>
                        <div className="vrm-tournee vrm-tournee-comptoir">
                          {totalT > 0 ? (
                            <div className="vrm-tournee-progres" data-tournee-progres={`${faitsT}/${totalT}`} role="progressbar" aria-valuemin={0} aria-valuemax={totalT} aria-valuenow={faitsT} aria-label={`${faitsT} colis déposés sur ${totalT}`}>
                              <span className="vrm-tournee-progres-n"><b>{faitsT}</b>{'\u202F'}/{'\u202F'}{totalT}</span>
                              <span className="vrm-tournee-progres-l">{faitsT >= totalT ? 'Tout est déposé' : 'déposés'}</span>
                              <span className="vrm-tournee-progres-barre" aria-hidden="true"><span style={{ width: `${Math.round((faitsT / totalT) * 100)}%` }}/></span>
                            </div>
                          ) : null}
                          <div className="vrm-tournee-haut">
                            <p className="vrm-tournee-note">Dépose chaque groupe chez son transporteur.</p>
                            <Bouton variante="secondaire" icone="scan" data-tournee-scanner="" onClick={() => setScanOuvert('envoi')}>Scanner</Bouton>
                          </div>
                          {!groupesT.length ? <div className="vrm-colis-vide-envoi" data-tournee-fini=""><span className="vrm-colis-vide-titre">Tout est déposé</span><span className="vrm-colis-vide-sous">Plus aucun colis à déposer pour l’instant.</span></div> : null}
                          {groupesT.map((g) => {
                            const trG = g.colis[0].x.__autre ? g.colis[0].x.tr : transporteurVente(g.colis[0].x.b);
                            return (
                              <section key={g.nom} className="vrm-tournee-groupe" data-tournee-groupe={g.nom} data-n={g.colis.length}>
                                <div className="vrm-fu-groupe-transp">
                                  <span className="vrm-fu-groupe-tuile" aria-hidden="true">{trG && trG.cle ? <LogoTransporteur cle={trG.cle} taille={22} repli={<Icon name="truck" size={15}/>}/> : <LogoInconnu taille={22}/>}</span>
                                  <h3>{libelleTransp(g.nom)}</h3>
                                  <span>{g.colis.length} colis</span>
                                </div>
                                <ul className="vrm-tournee-liste">
                                  {g.colis.map((t) => {
                                    const enAttente = enAttenteT === t.cle;
                                    const peutDeposer = t.site !== 'ebay' && t.pret;
                                    return (
                                      <li key={t.cle} className={'vrm-tournee-colis' + (enAttente ? ' is-attente' : '')} data-tournee-colis={t.cle} data-etat={enAttente ? 'attente' : 'a-deposer'}>
                                        <span className="vrm-tournee-photo">{t.photo && !imgMortes.has(t.photo) ? <PhotoVinted src={t.photo} alt="" loading="lazy" onError={() => noterImgMorte(t.photo)}/> : <PhotoVide taille={44} remplir/>}</span>
                                        <span className="vrm-tournee-quoi">
                                          <span className="vrm-tournee-titre">{t.num ? <><Numero n={t.num} taille="petit"/>{' '}</> : null}{t.titre}</span>
                                          <span className="vrm-tournee-sous">{enAttente ? 'Déposé · annulable quelques secondes' : t.site === 'ebay' ? 'Étiquette eBay : le dépôt se suit dans eBay' : !t.pret ? 'Bordereau pas encore là' : texteAttenteVente(t.att) || '—'}</span>
                                          {/* (8 nov., « beauté ») Le QR de dépôt (Leboncoin, LU sur l'étiquette) en grand, à montrer au comptoir. */}
                                          {t.qr && !enAttente ? (
                                            <details className="vrm-tournee-qr" data-tournee-qr={t.cle}>
                                              <summary>Montrer le QR</summary>
                                              <span className="vrm-tournee-qr-grand"><QrColis url={t.qr} size={220}/></span>
                                            </details>
                                          ) : null}
                                        </span>
                                        {enAttente
                                          ? <Bouton variante="discret" data-tournee-annuler={t.cle} onClick={deposeScan.annuler}>Annuler</Bouton>
                                          : t.site === 'ebay'
                                            ? <Bouton variante="discret" href={t.lien} target="_blank" rel="noreferrer" data-tournee-ebay={t.cle}>eBay</Bouton>
                                            : !peutDeposer ? null
                                            : <Bouton variante="secondaire" data-tournee-depose={t.cle} title="Marquer ce colis déposé"
                                                onClick={() => deposeScan.demander(t.cle, t.site === 'vinted' ? { site: 'vinted', cle: t.cle, o: t.o, b: t.b, num: t.num, titre: t.titre } : t.site === 'vestiaire' ? { site: 'vestiaire', cle: t.cle, v: t.v, num: t.num, titre: t.titre } : { site: 'leboncoin', cle: t.cle, txId: t.txId, num: t.num, titre: t.titre }, t.num ? `N°${t.num}` : t.titre)}>Déposé</Bouton>}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </section>
                            );
                          })}
                        </div>
                      </SheetShell>
                    ) : null}
                  </div>
                ) : null;
                return tourneeEl;
              })()}
              <div className="vrm-colis-grille" data-cible="colonne:prets colonne:attente" data-colis-lignes="1" style={{display:'flex',flexDirection:'column',gap:6}}>
              {(()=>{
                // (2 nov., 22 h, maquette FusionColis) LES COLIS RANGÉS PAR TRANSPORTEUR : un en-tête
                // (la tuile du logo, son nom, « N colis »), les colis dessous dans l'ordre d'avant
                // (le plus pressé d'abord) ; les transporteurs dans l'ordre de leur premier colis.
                const trNomDe = (x) => { if (x.__autre) return x.trNom; return nomEnvoye(transporteurVente(x.b)); };  // (9 nov.) « Transporteur inconnu » (des mots simples), plus « Autres » fourre-tout
                // (3 nov.) Tous les sites : le plus pressé d'abord (jours avant la limite ; sans limite à la fin,
                // tri stable), puis les transporteurs dans l'ordre de leur premier colis.
                // (3 nov.) La règle partagée avec « Tout imprimer » (src/lotTransporteurs.js).
                const tous = [...ex, ...autresColis];
                // (9 nov., soir, lot AJ) UNE liste, la vente la plus récente en haut (tous comptes, tous sites) ;
                // le transporteur est une PASTILLE (filtre, comme « Envoyés »), plus un groupe qui impose l'ordre.
                const trDeColis = (x) => (x.__autre ? x.tr : transporteurVente(x.b));
                const pastillesEnv = filtresTransporteurs(tous, trDeColis);
                const { liste: tousF, filtre: filtreEnvT } = filtrerEnvoyes(tous, filtreEnvoyer, trDeColis);
                const exT = rangerColisEnvoi(tousF, trNomDe);
                const iSansDateEnv = debutSansDate(exT, quandColisAEnvoyer), nSansDateEnv = nbSansDate(exT, quandColisAEnvoyer);
                const pastillesEl = pastillesEnv.length > 1 ? (
                  <div key="__filtres-env" className="vrm-rangee vrm-filtres" role="group" aria-label="Filtrer par transporteur" data-envoyer-filtres="" data-envoyer-filtre={filtreEnvT} style={{display:'flex',gap:6,marginBottom:4}}>
                    <button type="button" aria-pressed={filtreEnvT === 'tous'} data-envoyer-filtre-choix="tous" data-envoyer-filtre-n={tous.length} onClick={() => setFiltreEnvoyer('tous')} style={{whiteSpace:'nowrap',flexShrink:0,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Tous · {tous.length}</button>
                    {pastillesEnv.map((p) => (
                      <button key={p.nom} type="button" aria-pressed={filtreEnvT === p.nom} data-envoyer-filtre-choix={p.nom} data-envoyer-filtre-cle={p.cle || 'inconnu'} data-envoyer-filtre-n={p.n} onClick={() => setFiltreEnvoyer(filtreEnvT === p.nom ? 'tous' : p.nom)} style={{whiteSpace:'nowrap',flexShrink:0,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{p.nom} · {p.n}</button>
                    ))}
                  </div>
                ) : null;
                const primaireBleu = {flex:'1 1 160px',maxWidth:340,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.accent,color:'#fff',borderRadius:12,padding:'0 16px',minHeight:44,cursor:'pointer',fontSize:15,fontWeight:600,fontFamily:'inherit',textDecoration:'none',boxSizing:'border-box'};
                const carteAutre = (e) => {
                  if (e.__autre === 'vc') return <CarteColisVc v={e.v} imprime={!!(vcCarte('vrm_vc_imprimes') || {})[e.v.id]} fait={null}/>;
                  if (e.__autre === 'eb') {
                    const x = e.x, dl = x.jours;
                    const num = x.ordre ? (numLigneEbay(x.ordre, (x.ordre.lineItems || [])[0]) || '') : '';
                    const urgTxt = dl==null ? 'date limite non fournie par eBay' : dl<0 ? `${-dl} j de retard` : dl===0 ? "à poster aujourd'hui" : dl===1 ? 'à poster demain' : `${dl} j pour poster`;
                    const plusieurs = new Set(colisEb.aPoster.map(y => y.pseudo || y.compte)).size > 1;
                    return <CarteColisSite ident={e.key} site="ebay" photo={x.ordre ? photoCommande(x.ordre) : null} titre={x.titre || `Commande ${x.orderId}`} num={num}
                      sous={`eBay · ${urgTxt}${plusieurs ? ` · ${x.pseudo || x.compte}` : ''}`} sousAmbre={dl != null && dl <= 1} transporteur={e.tr} frise={friseColisFusion({}, { geste: dl != null && dl <= 1 })}
                      attrs={{ 'data-colis-ebay-cmd': x.orderId, 'data-numero': num, 'data-jours': dl == null ? '' : String(dl), 'data-compte': x.compte }}
                      detail={<><LigneDestinationEbay d={x.destination}/>{x.authentification ? <div data-colis-ebay-auth="" style={{fontSize:12,color:C.text,marginTop:4,lineHeight:1.45}}>Part vers l'authentificateur d'eBay, pas chez l'acheteur.</div> : null}</>}
                      primaire={<a data-lien-etiquette-ebay="" href={lienCommandeEbay(x.orderId, x.compte)} target="_blank" rel="noreferrer" className="vrm-colis-primaire" title="L'étiquette se prend dans eBay : elle est prépayée par le port que l'acheteur a payé" style={primaireBleu}><Icon name="printer" size={16}/><span className="vrm-lib-long">Étiquette sur eBay</span><span className="vrm-lib-court">Étiquette</span></a>}
                      gestes={<button type="button" data-gerer-ebay={x.orderId} className="vrm-colis-sec" onClick={()=>{ DEMANDE_EBAY_CIBLE.compte = x.compte; DEMANDE_EBAY_CIBLE.id = x.orderId; DEMANDE_EBAY_CIBLE.at = Date.now(); onNav && onNav('ebay_ventes'); }}
                        style={{...sec,border:`1px solid ${C.border}`,background:'transparent',color:C.text}}>Suivi et message à l'acheteur</button>}/>;
                  }
                  // (5 nov.) Leboncoin : son QR DE DÉPÔT (« sans imprimer ») sur la carte, comme le bordereau — mesuré,
                  // `label.qrUrl` (api.leboncoin.fr/api/shippingproxy…) sur 2 des 3 ventes ; l'image si elle vient,
                  // sinon « Voir le QR ↗ » (`QrColis`) ; absent ⇒ rien de plus (le bordereau suffit).
                  // Leboncoin : le N° par l'identifiant de l'annonce (`vinted_annonce_numeros[itemId]`, la règle
                  // de l'écran Colis Leboncoin) ; le bordereau s'imprime, tamponné, depuis l'écran Colis Leboncoin.
                  const x = e.x, o = e.o || {};
                  const f = x.itemId ? (load('vinted_annonce_numeros', {}) || {})[x.itemId] : null;
                  const num = (f && f.numero != null && String(f.numero).trim()) ? String(f.numero).trim() : '';
                  const fait = load('vrm_lbc_colis_done', {}) || {};
                  return <CarteColisSite ident={e.key} site="leboncoin" photo={photoArticle(o)} titre={x.titre || o.title || '(sans titre)'} num={num}
                    sous={o.label && o.label.voucherUrl ? 'Leboncoin' : 'Leboncoin · bordereau à générer'} transporteur={e.tr} frise={friseColisFusion({}, {})}
                    attrs={{ 'data-lbc-colis': x.txId }}
                    detail={o.label && o.label.qrUrl ? <div data-lbc-qr-depot="" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,marginTop:8}}><QrColis url={o.label.qrUrl} size={72}/><span style={{flex:'1 1 120px',minWidth:120,fontSize:12,color:C.muted,lineHeight:1.4}}>QR de dépôt Leboncoin : à présenter au point relais, sans imprimer.</span></div> : null}
                    primaire={o.label && o.label.voucherUrl
                      ? <button type="button" data-imprime="1" data-imprime-lbc={x.txId} className="vrm-colis-primaire" onClick={() => onColisLeboncoin && onColisLeboncoin()} title="Bordereau Leboncoin tamponné (titre + N°)" style={primaireBleu}><Icon name="printer" size={16}/><span className="vrm-lib-long">Imprimer le bordereau</span><span className="vrm-lib-court">Imprimer</span></button>
                      : <a data-generer-lbc={x.txId} href={`https://www.leboncoin.fr/compte/part/transaction/${encodeURIComponent(x.txId)}`} target="_blank" rel="noreferrer" className="vrm-colis-primaire" title="Le bordereau se génère sur Leboncoin" style={{...primaireBleu,background:C.card2||C.bg,color:C.text}}><Icon name="printer" size={16}/><span className="vrm-lib-long">Générer sur Leboncoin</span><span className="vrm-lib-court">Générer</span></a>}
                    gestes={<button type="button" data-geste="fait" data-lbc-fait={x.txId} className="vrm-colis-sec vrm-colis-ter" onClick={() => { const u = { ...fait }; if (u[x.txId]) delete u[x.txId]; else u[x.txId] = Date.now(); save('vrm_lbc_colis_done', u); majLbcFait(); }}
                      style={{...sec,border:`1px solid ${C.border}`,background:'transparent',color:C.muted}}>Déposé</button>}/>;
                };
                // (7 nov., vitesse) Les 24 plus pressées d'abord, TOUTES les autres juste après (sans clic : aucun colis caché).
                return [pastillesEl, ...(colisTous ? exT : exT.slice(0, 24)).map((e,ix)=>{
                const ouvreSansDate = ix === iSansDateEnv ? <LigneSansDate n={nSansDateEnv}/> : null;
                const quandE = quandColisAEnvoyer(e);
                if (e.__autre) return (
                  <React.Fragment key={e.key}>
                    {ouvreSansDate}
                    <div data-envoyer-rang={ix} data-ordre-t={quandE != null ? String(quandE) : ''} data-envoyer-site={e.__autre} style={{display:'contents'}}>{carteAutre(e)}</div>
                  </React.Fragment>);
                const o=e.o, b=e.b;
                // IDENTITÉ : la photo et le titre viennent de la VENTE quand on
                // l'a (le n° de transaction est une identité certaine), jamais
                // d'un rapprochement par titre (§24).
                const ph = o ? orderPhoto(o) : bordPhoto(b);
                const titre = o ? o.title : (b.modele||b.article||'Bordereau');
                const num = (b ? numForBord(b) : '') || (o ? (effEntry(o)?.numero||'') : '');
                const posted = o ? isShipDone(o) : isBordShippedManual(b);
                const cell = num ? garageCellOf(garageGrid, num) : null;
                const dl = e.dl;
                const urgCol = dl==null ? C.muted : dl<=1 ? C.warn : C.muted; // (26 oct.) un retard est ambre (§7)
                // (22 oct.) L'HEURE limite sur la ligne : « à poster avant demain
                // 10 h », « en retard — c'était avant 10 h aujourd'hui ». Heure
                // illisible ⇒ le jour seul. Rien sur ce que fait Vinted après.
                const urgTxt = texteLimiteEnvoi(e.lim);
                const inv = b ? invForBord(b) : null;
                // Deux sources de PDF, l'une comme l'autre certaines (le lien se
                // fait par le n° de transaction) : l'email reçu, ou le bordereau
                // capté par l'extension juste après l'avoir généré.
                const capte = e.txn ? labelsCaptes[e.txn] : null;
                const pdf = !!(b && b.hasPdf) || !!capte;
                // (2 nov.) Le transporteur LU de ce colis (n° de son bordereau), à côté du bouton.
                const trV = transporteurVente(b, e.txn);
                // (2 nov., Fusion) LA FRISE DU COLIS : Imprimé → Déposé → En route → Livré. Rien de
                // neuf : « imprimé » = la coche de toujours (`vinted_bords_printed`), « déposé » =
                // « Colis fait » ou un statut Vinted qui a bougé, « en route » / « livré » = les
                // preuves de la vente (`preuvesFriseDe`, la règle de la frise de Ventes). Une
                // étape plus loin prouvée coche celles d'avant ; « pas su » n'est jamais coché.
                // L'étape en cours est ambre seulement si la limite d'envoi est aujourd'hui/demain.
                const pvC = o ? preuvesFriseDe(o) : null;
                const imprimeC = !!((e.txn && bordsPrinted[e.txn]) || (b && isBordPrinted(b)));
                // (8 nov.) Imprimé SANS N° (src/bordereauVenteEmail.js) : la carte le redit, avec le N° sûr connu depuis.
                const sansNumC = phraseImprimeSansNumero(bordsSansNum, e.txn, num);
                const fuColis = friseColisFusion({ imprime: imprimeC, depose: posted || !!(pvC && pvC.bougeLu), enroute: !!(pvC && pvC.bougeLu), livre: !!(pvC && pvC.livreeLue) }, { geste: dl != null && dl <= 1 && !posted && (imprimeC || pdf) });  // (5 nov.) ambre seulement si l'étape en cours est FAISABLE (sans bordereau, rien à imprimer)
                const acc = o ? o._acc : null;
                const att = attenteColis(e);
                // Une charnière de groupe : le premier colis d'un groupe porte
                // son intertitre (voir `groupeDe` plus haut). C'est ce qui rend
                // le compte du haut vérifiable — « 10 en retard · 3 aujourd'hui
                // · 1 demain » se retrouve dans la liste, pas seulement dans une
                // phrase. Le premier groupe en a un aussi : sans lui, dix cartes
                // rouges commençaient sans qu'on sache où le retard s'arrête.
                const grp = groupeDe(e);
                // (2 nov.) Toujours l'intertitre (« Prêts à imprimer », « En attente du
                // bordereau ») : le résumé en colonnes qui les nommait est retiré.
                return (
                  <React.Fragment key={e.key}>
                  {ouvreSansDate}
                  <div data-envoyer-rang={ix} data-ordre-t={quandE != null ? String(quandE) : ''} data-bord-card data-cible={attrCible(['colis',e.txn])} data-groupe-carte={grp} data-transporteur={cleStatTransporteur(trV)} data-tx-colis={e.txn||''} data-colis-ident={'v:'+(e.txn||e.key)} data-colis-num={num||''} data-colis-vente-email={e.venteEmail?'1':undefined} data-colis-imprime-sans-num={sansNumC?'1':undefined} data-limite={e.lim&&e.lim.limite||''} data-limite-heure={e.lim&&e.lim.heure||''} data-jours={dl==null?'':String(dl)} data-attente-j={att == null ? '' : String(att)} {...propsGlisserFait({ actif: !posted && !!o && o.transaction_id != null, onFait: () => gesteColisFait(o, b, true) })} className="vrm-colis-carte" style={{padding:'14px',border:`1px solid ${e.lim && e.lim.retard ? C.warn+'66' : C.border}`,background:C.card,borderRadius:12,opacity:posted?0.55:1}}>
                    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                      <div className="vrm-colis-photo" style={{width:64,height:80,borderRadius:12,background:C.card2||C.bg,border:`1px solid ${C.border}`,boxSizing:'border-box',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {ph?<PhotoVinted src={ph} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/>}
                        {/* (7 nov.) Le logo du transporteur LU (`trV`, la règle de la puce), dans le coin de la photo. */}
                        <BadgeTransporteur t={trV}/>
                      </div>
                      <div style={{flex:'1 1 150px',minWidth:0}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                          {/* (5 nov., chantier D) Le N° en pastille (`Numero`, la forme de toute l'app ; rouge
                              seulement quand deux articles le portent) DANS le titre, une fois — il était écrit
                              deux fois (« N°31 · … » puis une pastille « N°31 » dessous). */}
                          <span className="vrm-colis-titre" title={titre} style={{flex:1,minWidth:0,fontSize:15,fontWeight:600,lineHeight:1.35,color:C.text,letterSpacing:'-.01em',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',overflowWrap:'anywhere'}}>{num ? <><Numero n={num} taille="petit" etat={conflitsNum.some(x => String(x.numero) === String(num)) ? 'doublon' : undefined} className="vrm-colis-titre-num"/>{' '}</> : null}{titre}</span>
                          {o && o.price && <span className="vrm-display vrm-colis-prix" style={{flexShrink:0,fontSize:17,fontWeight:700,color:C.text,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',letterSpacing:'-.02em'}}>{montant(o.price, { etrangere: 'ecarter' })}</span>}
                        </div>
                        {(!num || (plusieursComptesColis && (acc || (b && b.account)))) ? <div style={{fontSize:12,color:C.muted,marginTop:6,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          {!num ? <span className="vrm-colis-num" title="Le numéro arrive dès que l'article est relié à une annonce numérotée. Tu peux le poser à la main." style={{fontSize:12,fontWeight:600,color:C.warn,background:'transparent',border:`1px dashed ${C.warn}88`,borderRadius:999,padding:'2px 9px',flexShrink:0,whiteSpace:'nowrap'}}>N° en attente</span> : null}
                          {!plusieursComptesColis ? null : acc ? <AcctTag acc={acc} name={accNameOf(acc)}/> : (b && b.account ? <span style={{display:'inline-flex',alignItems:'center',gap:4,background:`${C.muted}22`,color:C.muted,fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:12,whiteSpace:'nowrap'}}>{b.account}</span> : null)}
                        </div> : null}
                        <div style={{fontSize:12,color:C.muted,marginTop:6,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                          {/* (2 nov.) La date de vente et la date limite dans UN texte : en
                              deux éléments d'une rangée qui passe à la ligne, la seconde
                              ligne commençait par « · » (390 px). Le point reste collé.
                              (5 nov., chantier D) + LE TEMPS DE PRÉPARATION : depuis combien de jours la
                              vente attend (`attenteColis`, date de vente lue). La limite LUE dit le retard ;
                              l'attente reste neutre (une date estimée n'est jamais « en retard », §5). */}
                          {/* (10 nov.) la marque discrète « sans e-mail » (le bandeau de Colis est retiré) */}
                          {acc && uidsSansEmail.has(String(acc.vinted_user_id)) ? <button type="button" className="vrm-colis-sans-email" data-colis-sans-email={String(acc.vinted_user_id)} title={`Les e-mails de ${acc.login || 'ce compte'} n’arrivent pas à VRM : bordereau, date limite et codes de retrait ne viennent pas par e-mail. Toucher pour relier sa boîte.`}
                            aria-label={`E-mails de ${acc.login || 'ce compte'} pas reliés à VRM — relier sa boîte`}
                            onClick={() => relierBoiteDe(String(acc.vinted_user_id))} style={{flexShrink:0,border:'none',background:'transparent',padding:0,cursor:'pointer',fontFamily:'inherit',fontSize:12,color:C.muted,display:'inline-flex',alignItems:'center',verticalAlign:'-2px',marginRight:6}}>
                            <Icon name="mail" size={13}/></button> : null}
                          {(o && o.date) || urgTxt ? <span data-colis-dates="" style={{flex:'0 1 auto',minWidth:0}}>
                            {urgTxt && <span data-colis-limite-texte="" style={{overflowWrap:'anywhere',color:urgCol,fontWeight:dl!=null&&dl<=1?600:500}}>{texteEnvoiColis(urgTxt)}</span>}
                            {att != null ? <span data-colis-attente={att}>{urgTxt ? ' · ' : ''}{texteAttenteVente(att)}</span> : null}
                          </span> : null}
                          {cell
                            ? <button type="button" onClick={()=>onLocate&&onLocate(num)} style={{flexShrink:0,border:'none',background:'transparent',color:C.accentTexte||C.text,fontWeight:600,cursor:'pointer',padding:0,fontSize:12,fontFamily:'inherit'}}>· {garageCellLabel(cell)}</button>
                            /* ⚠️ Même règle que sur les Ventes (§11) : « pas rangée »
                               sur CHAQUE carte ne dit rien tant que le garage est
                               vide (mesuré : 0 case posée). Dès qu'une paire y est,
                               la mention redevient un écart qui se remarque. */
                            : ((num && garageUtilise) ? <span style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:3}}>· <Icon name="home" size={12}/>pas rangée</span> : null)}
                          {inv && <span title="Compte pro : la facture reçue par e-mail sera imprimée avec le bordereau" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:3,color:C.text,fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>· Facture {inv.number||''}</span>}
                          {posted && <span style={{flexShrink:0,color:C.text,fontWeight:600}}>· déposé</span>}
                        </div>
                        {/* Le numéro de l'email vient d'un rapprochement par titre,
                            celui de la transaction est une identité : quand les deux
                            se contredisent on dit lequel on garde (§5.17). */}
                        {/* ⚠️ LE CONFLIT DE NUMÉRO SE VOIT ICI, au moment où on
                            ferme le carton — pas seulement sur l'écran Annonces.
                            Julien : « si je me trompe entre deux colis, c'est deux
                            ventes de perdues ». Un numéro porté par deux articles
                            présentes est le seul défaut qui envoie la mauvaise
                            chaussure ; il doit crier là où se fait le geste. */}
                        {num && (()=>{
                          const c = conflitsNum.find(x => String(x.numero) === String(num));
                          if (!c) return null;
                          const autres = c.porteurs.filter(x => normTitle(x.titre||'') !== normTitle(titre||''));
                          return (
                            <div style={{fontSize:12,fontWeight:600,marginTop:5,color:C.doublon,background:`${C.doublon}14`,border:`1px solid ${C.doublon}`,borderRadius:12,padding:'6px 9px',lineHeight:1.45}}>
                              <span style={{display:'flex',alignItems:'center',gap:6}}><Icon name="alert" size={14}/>Le N°{num} est porté par un autre article</span>
                              <span style={{display:'block',color:C.text,fontWeight:500,marginTop:3}}>
                                {autres.map(x=>`${x.type==='annonce'?'en ligne':x.type==='vente'?'à envoyer':'au garage'} « ${String(x.titre||'').slice(0,44)} »`).join(' · ')}
                                {' '}— vérifie la photo, puis corrige l'autre dans Annonces.
                              </span>
                            </div>
                          );
                        })()}
                        {/* (8 nov.) Vue par e-mail, sans N° sûr : le tampon part avec le titre seul (src/bordereauVenteEmail.js) ;
                            imprimé sans N° : la carte le redit, avec le N° sûr apparu depuis. */}
                        {sansNumC ? <div data-imprime-sans-num={num?'avec':'sans'} style={{fontSize:12,fontWeight:600,marginTop:5,color:C.warn,overflowWrap:'anywhere'}}>{sansNumC}</div>
                          : (e.venteEmail && !num) ? <div data-colis-sans-num="1" style={{fontSize:12,fontWeight:600,marginTop:5,color:C.warn,overflowWrap:'anywhere'}}>{MENTION_SANS_NUM}</div> : null}
                        {b && !e.venteEmail && (()=>{ const lit=numLitige(b); return lit ? (
                          <div style={{fontSize:11,fontWeight:600,marginTop:5,color:C.warn,background:`${C.warn}14`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'4px 8px',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <span className="vrm-aide" style={{flex:'1 1 150px',minWidth:0}}>⚠️ L'email disait N°{lit.mail}, la vente dit N°{lit.txn} — on garde celui de la vente.</span>
                            <button type="button" onClick={()=>{ setLinkPickFor(b); setLinkSearch(''); }} style={{flexShrink:0,border:'none',background:'transparent',color:C.warn,fontWeight:700,cursor:'pointer',fontSize:11,padding:0,fontFamily:'inherit',textDecoration:'underline'}}>Choisir la vente</button>
                          </div>
                        ) : null; })()}
                      </div>
                      {b && <button type="button" onClick={async ()=>{
                        hideBord(b);
                      }} title="Masquer" aria-label="Masquer" className="vrm-icon-control vrm-colis-masquer" style={{alignSelf:'flex-start',flexShrink:0,border:'none',background:'transparent',color:C.muted,cursor:'pointer',width:32,height:32,margin:'-6px -6px 0 0',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:12,fontFamily:'inherit'}}><Icon name="close" size={15}/></button>}
                      {/* (2 nov., 22 h) « … » : « Colis fait », « Marquer imprimé », « Suivre » (maquette : rien sous la frise). */}
                      <button type="button" className="vrm-fu-plus vrm-fu-plus-carte" data-colis-plus={e.txn||e.key} aria-label="Plus d’actions pour ce colis" title="Colis fait, marquer imprimé, suivre le colis" aria-expanded="false"
                        onClick={(ev)=>{ const c = ev.currentTarget.closest('[data-bord-card]'); const o = !c.hasAttribute('data-plus-ouvert'); c.toggleAttribute('data-plus-ouvert', o); ev.currentTarget.setAttribute('aria-expanded', o ? 'true' : 'false'); }}><Icon name="more" size={18}/></button>
                    </div>
                    {/* ACTION PRINCIPALE : imprimer si le PDF est là, sinon aller
                        le générer sur Vinted. Le glisser-fichier reste dispo pour
                        celui qui n'a pas branché sa boîte mail. */}
                    {/* (7 nov., design) La frise n'est posée que quand une étape est FAITE : quatre traits gris
                        sous chaque carte « à envoyer » ne disaient rien (« rien d'imprimé » se lit sur le bouton). */}
                    {fuColis.some((x) => x.fait) ? <Frise etapes={fuColis} cle={String(e.txn||e.key)} className="vrm-colis-frise" label="Où en est le colis"/> : null}
                    <div className="vrm-colis-actions" style={{display:'flex',gap:8,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
                      {/* (2 nov. au soir) Julien : « à côté du bouton bordereau, marqué Chronopost avec le
                          logo » — LA RANGÉE : la puce du transporteur LU (n° du bordereau, ligne du
                          transporteur, e-mail du même n° ; sinon « pas lu ») à GAUCHE du geste principal,
                          sur la même ligne, même hauteur. Les autres gestes passent dessous. */}
                      <div className="vrm-rangee-bord" data-rangee-bord="">
                      <PastilleTransporteur t={trV} C={C} data-colis-transporteur={e.txn||e.key}/>
                      {pdf ? (
                        <button type="button" data-imprime="1" onClick={async ()=>{
                          if (b && b.hasPdf && inv) { await printBordAndInvoice(b); return; }
                          // Le PDF vient de l'email s'il y en a un, sinon de la
                          // capture faite par l'extension au moment de générer.
                          // ⚠️ LE PDF CAPTÉ PAR L'EXTENSION PASSE EN PREMIER.
                          // C'est l'étiquette prise chez Vinted, rattachée à la
                          // vente par son n° de transaction. L'email n'est qu'une
                          // VÉRIFICATION (il arrive plus tard, et son numéro vient
                          // d'un rapprochement par titre, §5.17) — donc un secours,
                          // pas la source.
                          const lu = await octetsBordereau(capte && capte.row, b && b.hasPdf ? b._row : null);
                          if (!lu || !lu.octets) { libererOngletPdf(); toast(messagePdfManquant(lu)); return; }
                          if (await processBordereau(num, titre, lu.octets) && !String(num || '').trim() && e.txn) noterImprimeSansNum([e.txn]);
                        }} title={inv?'Bordereau tamponné + facture pro, puis impression':'Bordereau tamponné, puis impression'} aria-label={inv?'Imprimer le bordereau et la facture':'Imprimer le bordereau'}
                        className="vrm-colis-primaire" style={{flex:'1 1 160px',maxWidth:340,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.accent,color:C.onAccent,borderRadius:12,padding:'0 16px',minHeight:44,cursor:'pointer',fontSize:15,fontWeight:600,fontFamily:'inherit'}}><Icon name="printer" size={16}/><span className="vrm-lib-long">{inv ? 'Imprimer + facture' : 'Imprimer le bordereau'}</span><span className="vrm-lib-court">Imprimer</span></button>
                      ) : (<>
                        {/* ⚠️ PLUS DE BOUTON « Générer sur Vinted ». C'est l'EXTENSION
                            qui génère le bordereau manquant dès que tu arrives sur
                            Vinted (aucun argent engagé, aucun choix — c'est une
                            formalité obligatoire). L'app se contente de dire où on
                            en est, au lieu de te renvoyer faire le travail. */}
                        {/* ⚠️ CINQ FOIS LA MÊME PHRASE, C'EST UNE PHRASE.
                            Ce paragraphe de trois lignes se répétait sur chaque
                            carte sans bordereau — vu en capture, quatre fois de
                            suite en haut de l'écran. L'intertitre du groupe
                            « En attente de leur bordereau » le dit une fois, au
                            bon endroit. La carte ne garde que ce qui la
                            distingue : Vinted doit-il encore le générer ? */}
                        {/* L'app COMMANDE l'extension (2 octobre) : le bouton dit ce
                            qui l'empêche s'il est grisé, l'étape s'il travaille. */}
                        {o && o.transaction_id!=null && (
                          <BoutonBordereau grand uid={acc && acc.vinted_user_id} tx={String(o.transaction_id)} conv={o.conversation_id} login={accNameOf(acc)}
                            aGenerer pdf={false} onFait={(u)=>rechargerLabels(u)}/>
                        )}
</>)}
                      </div>
                      {!pdf && (<>
                        <button type="button" onClick={()=>startBordereau(num, titre, acc, o && o.transaction_id)} title="J'ai déjà téléchargé le PDF : le tamponner avec le numéro"
                          className="vrm-colis-sec" style={{...sec,flex:'0 1 auto',border:`1px solid ${C.border}`,background:'transparent',color:C.text}}>J'ai le PDF</button>
                                            </>)}
                      {/* (2 nov.) Julien : « à côté du bouton bordereau, marqué Chronopost avec le logo
                          Chronopost ou Mondial Relay avec le logo Mondial Relay ». Le transporteur LU
                          (n° du bordereau, ligne du transporteur, e-mail du même n°) ; sinon « pas lu ». */}
                      {!num && b && <button type="button" data-geste="relier" onClick={()=>{ setLinkPickFor(b); setLinkSearch(''); }} title="Relier ce bordereau à un article numéroté" className="vrm-colis-sec" style={{...sec,border:`1px solid ${C.warn}88`,background:'transparent',color:C.warn}}><Icon name="link" size={14} style={{verticalAlign:'-2px',marginRight:5}}/>Relier</button>}
                      {/* Sans bordereau, il n'y avait AUCUN moyen de poser le numéro
                          sur cette vente — or c'est lui qu'on tamponne. Le numéro
                          n'est pas deviné (le titre de revente diffère souvent de
                          celui de l'annonce, §24) : c'est toi qui le donnes, et il
                          est mémorisé sur la vente (`vinted_sale_overrides`). */}
                      {!num && !b && o && o.transaction_id!=null && <button type="button" onClick={async ()=>{
                        const v=(await askText({numeric:clavierNum()==='numeric',desc:`Quel numéro porte cet article ? « ${titre} »`,value:''})||'').trim();
                        if(v) setSaleOverride(o.transaction_id,{numero:v});
                      }} title="Poser le numéro de boîte de cet article" data-geste="poser-num" className="vrm-colis-sec" style={{...sec,border:`1px solid ${C.warn}88`,background:'transparent',color:C.warn}}>Poser le N°</button>}
                      {/* ⚠️ UNE SEULE RANGÉE D'ACTIONS. Les états (imprimé, colis
                          fait, suivre) vivaient sur une deuxième rangée : sur un
                          colis sans PDF, la première n'avait plus qu'un bouton et
                          la carte occupait deux étages pour trois mots. Le retour
                          à la ligne (`flexWrap`) fait le travail sur téléphone. */}
                      {b && <button type="button" onClick={()=>toggleBordPrinted(b)}
                        title={isBordPrinted(b)?'Remettre en « à imprimer »':'Marquer comme imprimé'} data-geste="imprime"
                        className="vrm-colis-sec vrm-colis-ter" style={{...sec,border:`1px solid ${C.border}`,background:isBordPrinted(b)?C.bg:'transparent',color:isBordPrinted(b)?C.text:C.muted}}>
                        {isBordPrinted(b)?'✓ Imprimé':'Marquer imprimé'}
                      </button>}
                      {/* « Colis fait » marque LES DEUX (la vente et le bordereau) :
                          deux marqueurs pour un même carton, c'était deux chiffres
                          qui divergeaient. */}
                      <button type="button" onClick={()=>gesteColisFait(o, b, !posted)} title={posted?'Le colis est encore chez toi : il revient dans « À envoyer »':'Marquer déposé : il passe dans « Envoyés »'} data-geste="fait"
                        className="vrm-colis-sec vrm-colis-ter" style={{...sec,border:`1px solid ${C.border}`,background:posted?C.bg:'transparent',color:posted?C.text:C.muted}}>
                        {posted?'Pas encore déposé':'Déposé'}
                      </button>
                      {b && b.suivi && <a href={trackUrl(trV.cle||'', b.suivi)} target="_blank" rel="noreferrer" title={`Suivre le colis n°${b.suivi}`} data-geste="suivre" className="vrm-colis-sec vrm-colis-ter" style={{...sec,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,textDecoration:'none',display:'inline-flex',alignItems:'center'}}><Icon name="truck" size={13} style={{marginRight:5}}/>Suivre</a>}
                      {capte && <span className="vrm-colis-source" style={{fontSize:12,color:C.muted,fontWeight:500,flexBasis:'100%'}}>Bordereau récupéré chez Vinted par l'extension{b && b.hasPdf ? ' · confirmé par l\'email' : ''}</span>}
                      {/* ⚠️ « Bordereau pas encore reçu » disait, sur la MÊME carte
                          et à trois lignes d'écart, exactement ce que le bandeau
                          d'attente dit déjà. Retiré : l'absence du bouton
                          « Imprimer » le montre de toute façon. */}
                    </div>
                  </div>
                  </React.Fragment>
                );
              })]; })()}
              </div>
              {/* (2 nov., colis clair) Sous la liste : ce n'est pas un geste du moment. */}
              {/* (17 oct.) Julien : « un bouton dans l'onglet Colis qui met en couleur
                  les numéros que tu as vendus ». Les N° des colis À FAIRE (pas
                  les postés), lus sur la ligne elle-même — jamais devinés. */}
              {(() => {
                const nums = [...new Set(ex.filter(x => !estPoste(x)).map(x => (x.b ? numForBord(x.b) : '') || (x.o ? (effEntry(x.o)?.numero || '') : '')).map(n => String(n || '').trim()).filter(Boolean))];
                if (!nums.length) return null;
                return (
                  /* (5 nov., chantier D) La forme commune (`Bouton` secondaire, texte à l'encre : le « discret » bleu tombe à 4,2:1 sur le gris de la page). */
                  <Bouton variante="secondaire" icone="home" data-colis-stock={nums.length} style={{alignSelf:'flex-start',marginTop:6}} onClick={() => { DEMANDE_STOCK_CHERCHE.nums = nums; DEMANDE_STOCK_CHERCHE.at = Date.now(); onNav && onNav('garage'); }}>
                    {/* (1er nov.) sans le nombre : c'est celui des colonnes (§7) */}{nums.length>1?'Où sont ces articles':'Où est cet article'} dans le stock
                  </Bouton>
                );
              })()}
            </div>
          );
        })()}
        {/* (5 nov., revue 2.21) « Tes emails, ce que VRM en a fait » n'est plus dans Colis : un lien
            technique, pas un geste d'envoi. Le journal reste dans E-mails. */}
        {/* ── PARTIS : CE QUE VINTED SUIT APRÈS TON ENVOI (4 octobre) ───────────
            Julien : « en transit, colis à faire, vendu… ». Colis ne montrait que
            ce qu'il reste à POSTER : un colis parti disparaissait de l'écran, et
            ceux qui attendent au relais ou reviennent n'étaient lisibles que
            noyés dans Ventes. Lecture seule, rangée sur l'ÉTAT de Vinted (la même
            étiquette que la liste des ventes, `venteStage`, §11) : aucun bouton,
            aucune décision automatique. Replié : ce n'est pas du travail. Un
            retour ou un colis non réclamé passe en tête — c'est le seul qui
            peut demander un geste (vérifier que la paire revient). */}
        {/* Historique : les bordereaux déjà partis restent consultables, mais ils
            n'encombrent plus la liste de travail. */}
        {Array.isArray(emailBords) && (()=>{
          const faits = emailBords.filter(b=>!isBordHidden(b) && isBordDone(b));
          if (!faits.length) return null;
          return (
            /* (revue du 19 oct.) Neutre : plus le vert de l'ancienne palette
               menthe (§7, rien à rattraper ici), et un autre mot que le groupe
               « Partis — Vinted suit le colis » juste au-dessus, qui compte
               autre chose (les VENTES suivies, pas les bordereaux faits). */
            <div data-bords-faits={faits.length} style={{fontSize:12,color:C.muted,marginTop:14,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px'}}>
              <span style={{color:C.text,fontWeight:600}}>{faits.length} bordereau{faits.length>1?'x':''} déjà traité{faits.length>1?'s':''}</span>
              <span style={{flex:1,minWidth:0}}>retiré{faits.length>1?'s':''} tout seul{faits.length>1?'s':''} dès que Vinted confirme.</span>
              <button type="button" data-bords-faits-voir="" onClick={()=>setShowBordDone(v=>!v)} style={{border:'none',background:'transparent',color:C.accentTexte||C.text,fontWeight:600,cursor:'pointer',fontSize:13,padding:'0 4px',fontFamily:'inherit',minWidth:44,minHeight:44}}>{showBordDone?'Masquer':'Les voir'}</button>
            </div>
          );
        })()}
        {showBordDone && Array.isArray(emailBords) && (
          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
            {emailBords.filter(b=>!isBordHidden(b) && isBordDone(b))
              .sort((a,b2)=>new Date(b2.receivedAt||0)-new Date(a.receivedAt||0))
              .map((b,i)=>(
                <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',border:`1px solid ${C.border}`,background:C.card,borderRadius:12,opacity:0.7}}>
                  <div style={{width:38,height:38,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {bordPhoto(b)?<PhotoVinted src={bordPhoto(b)} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<PhotoVide taille={38} remplir/>}
                  </div>
                  <div style={{flex:'1 1 120px',minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{numForBord(b)?`N°${numForBord(b)} · `:''}{b.modele||b.article||'Bordereau'}</div>
                    <div style={{fontSize:11,color:C.muted}}>{b.receivedAt?`reçu le ${new Date(b.receivedAt).toLocaleDateString('fr-FR')}`:''}</div>
                  </div>
                  {b.hasPdf && <button type="button" data-imprime="1" onClick={async ()=>{ const lu=await lirePdfLigne(b._row); if(!lu||!lu.octets){libererOngletPdf();toast(messagePdfManquant(lu));return;} processBordereau(numForBord(b), b.modele||b.article||'', lu.octets); }} style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,borderRadius:12,padding:'6px 10px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}><Icon name="printer" size={14} style={{verticalAlign:'-2px',marginRight:6}}/>Réimprimer</button>}
                </div>
              ))}
          </div>
        )}
        </>/*⟦←/⟧*/);
}

// La branche {curSub==='bordereaux' && ongletColisVu==='envoyes' && …} de Comptabilite, telle quelle, avec 6 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueColisEnvoyes({ v }) {
  const { LIMITE_ENVOYES_J, accNameOf, accounts, bordKey, filtreEnvoyes, imgMortes, isBordShippedManual, isShipDone, listeEnvoyes, noterImgMorte, numeros, presentesAnnonceIds, retoursSuivis, sales, setBordsShipped, setFiltreEnvoyes, setRetoursDismissed, setRetoursRecus, setRetoursRemis, siteColis, toggleShipDone, voitSite } = v;
  /*⟦← App.jsx #h2_1⟧*/const unmarkBordShipped = (b) => { const k=bordKey(b); if(!k) return; setBordsShipped(prev=>{ const u={...prev}; delete u[k]; save('vinted_bords_shipped',u); return u; }); };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_2⟧*/const basculerRetourRecu = (cle) => {
    const k = cle ? String(cle) : ''; if (!k) return;
    setRetoursRecus(prev => { const u = { ...prev }; if (u[k]) delete u[k]; else u[k] = new Date().toISOString(); save('vinted_retours_recus', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_3⟧*/const masquerRetour = (cle) => {
    const k = cle ? String(cle) : ''; if (!k) return;
    setRetoursDismissed(prev => { const u = { ...prev, [k]: Date.now() }; save('vinted_retours_dismissed', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_4⟧*/const remettreDepuisCarte = async (ligne) => {
    const k = String(ligne && ligne.cle || ''); if (!k) return;
    const r = remiseEnStock({ ...ligne, recu: true }, { numeros, presentes: presentesAnnonceIds, cleNum, estArchive: (n) => !numeroReprenable(n) });
    if (!r.ok) return;
    let num = r.num;
    if (r.conflit) {
      const ok = await askConfirm({ title: `Le N°${r.num} est déjà porté`, desc: `Un autre article présent porte aussi le N°${r.num}${r.conflit.titre ? ` (« ${r.conflit.titre} »)` : ''}.\n\nRegarde les deux articles là où ils sont rangés : VRM ne choisit pas à ta place.`, ok: 'Remettre en stock sans N°', cancel: 'Annuler' });
      if (!ok) return;
      num = null;
    }
    const at = new Date().toISOString();
    setRetoursRecus(prev => { if (prev[k]) return prev; const u = { ...prev, [k]: at }; save('vinted_retours_recus', u); return u; });
    setRetoursRemis(prev => { const u = { ...prev, [k]: { at, num, archive: r.archive, conflit: r.conflit ? r.conflit.id : null } }; save('vinted_retours_remis', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_5⟧*/const remettreEnStock = async (ligne) => {
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
  /*⟦← App.jsx #h2_6⟧*/const annulerRemise = (cle) => {
    const k = String(cle || ''); if (!k) return;
    setRetoursRemis(prev => { const u = { ...prev }; delete u[k]; save('vinted_retours_remis', u); return u; });
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v2⟧*/(()=>{
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
                        {(() => { const su = (x.b && x.b.suivi) || (x.v && x.v.suivi) || ''; const suivre = su ? <BoutonSuivreColis transporteur={(x.tr && x.tr.cle) || ''} suivi={su} enLigne court attrs={{'data-colis-envoye-suivre': x.cle}}/> : null;
                          return (annuler || suivre) ? <div className="vrm-colis-actions" style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap',marginTop:10}}>{suivre}{annuler}</div> : null; })()}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </section></>
          );
        })()/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧ // (8 nov.) style de ./LigneGlissable.jsx, gardé à sa place (son écran est chargé à la demande)
import { propsGlisserFait } from "../GlisserColis.js";
// ⟦← App.jsx #2⟧
// ── OÙ PART UN COLIS eBAY (26 octobre) — `destinationEbay` (§11) ──────────
// Une ligne sur la carte, seulement pour un envoi qui n'est PAS ordinaire :
// international par le programme d'eBay (on poste en France, eBay fait la
// douane), international en direct (hors UE : déclaration en douane à joindre),
// ou pays illisible alors que le programme d'eBay est en jeu. Un envoi en
// France ne dit rien (§7). Le nom du pays vient du navigateur (Intl).
function nomPaysEbay(c) {
  try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(c) || c; } catch (_) { return c; }
}
function LigneDestinationEbay({ d }) {
  if (!d || d.programme === 'authentification') return null;
  let txt = null, cle = '';
  if (d.programme === 'international') {
    cle = 'programme';
    txt = d.pays
      ? `International — ${nomPaysEbay(d.pays)}, par la livraison internationale d'eBay. Poste à l'adresse indiquée sur l'étiquette d'eBay (un centre en France) : eBay s'occupe du transport à l'étranger et de la douane, l'acheteur a déjà payé les droits et taxes.`
      : `Envoi par la livraison internationale d'eBay : poste à l'adresse indiquée sur l'étiquette d'eBay, eBay s'occupe de la suite et de la douane.`;
  } else if (d.international === true) {
    cle = d.douane ? 'douane' : 'ue';
    txt = d.douane
      ? `International — ${nomPaysEbay(d.pays)} (hors Union européenne) : joins une déclaration en douane (CN22, ou CN23 au-delà de 425\u00a0€) avec le contenu et la valeur. Les droits d'importation sont à la charge de l'acheteur.`
      : `International — ${nomPaysEbay(d.pays)} (Union européenne) : pas de douane, l'étiquette d'eBay suffit.`;
  }
  if (!txt) return null;
  return <div data-colis-ebay-dest={cle} data-pays={d.pays || ''} style={{fontSize:12,color:C.text,marginTop:4,lineHeight:1.45}}>{txt}</div>;
}
// ⟦← App.jsx #3⟧
// (3 nov., Julien : « Vestiaire : tout va être ensemble ») LA CARTE D'UN COLIS eBAY OU LEBONCOIN, dans la
// liste de Colis avec ceux de Vinted et de Vestiaire : la MÊME forme (photo, « N° · titre », une ligne
// d'urgence, le bouton rond du bordereau, « … », la frise). Aucune règle ici : chaque valeur est passée
// par l'écran, qui la tient de la règle de SON site (`colisEbay`, `colisLbcAPoster`, §11) ; la photo est
// celle de la commande / vente elle-même (identité, §5).
function CarteColisSite({ ident, site, photo, titre, num, sous, sousAmbre = false, transporteur, primaire, gestes = null, frise, detail = null, attrs = {} }) {
  return (
    <div data-bord-card="" data-colis-ident={ident} data-plateforme-colis={site} className="vrm-colis-carte" {...attrs}
      style={{ position: 'relative', padding: '14px', border: `1px solid ${sousAmbre ? C.warn + '66' : C.border}`, background: C.card, borderRadius: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="vrm-colis-photo" style={{ width: 64, height: 80, borderRadius: 12, background: C.card2 || C.bg, border: `1px solid ${C.border}`, boxSizing: 'border-box', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <PhotoVinted src={photo} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Icon name="image" size={20} style={{ color: C.muted, opacity: .55 }}/>}
          <BadgeTransporteur t={transporteur}/>
        </div>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span className="vrm-colis-titre" title={titre} style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: C.text, letterSpacing: '-.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{num ? <><Numero n={num} taille="petit"/>{' '}</> : null}{titre}</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span data-colis-dates="" style={{ flex: '0 1 auto', minWidth: 0 }}><span data-colis-limite-texte="" style={{ overflowWrap: 'anywhere', color: sousAmbre ? C.warn : C.muted, fontWeight: sousAmbre ? 600 : 500 }}>{sous}</span></span>
          </div>
          {detail}
        </div>
        {gestes ? <button type="button" className="vrm-fu-plus vrm-fu-plus-carte" data-colis-plus={ident} aria-label="Plus d’actions pour ce colis" aria-expanded="false"
          onClick={(ev)=>{ const c = ev.currentTarget.closest('[data-bord-card]'); const o = !c.hasAttribute('data-plus-ouvert'); c.toggleAttribute('data-plus-ouvert', o); ev.currentTarget.setAttribute('aria-expanded', o ? 'true' : 'false'); }}><Icon name="more" size={18}/></button> : null}
      </div>
      {Array.isArray(frise) && frise.some((x) => x.fait) ? <Frise etapes={frise} cle={ident} className="vrm-colis-frise" label="Où en est le colis"/> : null}
      <div className="vrm-colis-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <div className="vrm-rangee-bord" data-rangee-bord="">
          <PastilleTransporteur t={transporteur} C={C} data-colis-transporteur={ident}/>
          {primaire}
        </div>
        {gestes}
      </div>
    </div>
  );
}
// ⟦← App.jsx #4⟧
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