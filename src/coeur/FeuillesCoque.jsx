// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { problemesAnnonce, champsNonJuges } from '../verifAnnonce.js';
import { champsFacultatifs } from '../profilVendeur.js';
import { BlocHistoriqueRepub } from '../HistoriqueRepub.jsx';
import { raisonCommune, ACTIONS_TUILES } from '../annoncesActions.js';
import { BINAIRES as BINAIRES_TRANCHER } from '../aTrancher.js';
import { QuestionChezToi } from '../ATrancher.jsx';
import { opsVenduAilleurs } from '../venteAilleurs.js';
import { VenduAilleurs } from '../SaisieRapide.jsx';
import React from 'react';
import { createPortal } from 'react-dom';
import { Numero } from '../composants/Numero.jsx';
import { GardeEcran, Differe } from '../composants/GardeEcran.jsx';
import { CLE_PRIX_LUS } from '../historiquePrix.js';
import { redirigerOnglet } from '../navigationTache.js';
import { histoireArticle } from '../histoireArticle.js';
import { CLE_JOURNAL_NUMEROS, historiqueNumero } from '../historiqueNumero.js';
import { SITES_PUBLIER, apercuEnvoi, manquesEnvoi, etatsPaire, partoutLeMeme, lienVu, chercherPaires } from '../publierAilleurs.js';
import { tr } from '../i18n/index.js';
import { AUTH, Bouton, BoutonRappel, C, CARTOUCHES, CYCLE_DECISIONS, DEMANDE_EBAY_PAIRE, DEMANDE_EMBALLAGE, DEMANDE_LBC_FICHE, DEMANDE_STOCK_CHERCHE, DEMANDE_VC_PAIRE, FermeAuRetour, Icon, NotePaireCoque, ONGLETS_DEPLACES, PhotoVinted, SUPABASE_URL, SheetShell, Z_CONFIRMATION, aLaDemande, ajouterNumerosHorsEcran, assurerVersionNumerotation, cartoucheLibre, chercherPlaceTampon, choixTamponValide, classifyOrderStatus, cleNum, commandeEbayEngagee, demanderVue, descriptionDeFaits, descriptionLbcDe, dessinerPdf, ebayTitre, echelleMiniTampon, ecrireCartouche, emettreClesRelues, entreePool, estArchive, etapeVente, familleArticle, gesteVrm, isCloudReady, lbcAnnulee, lbcFinalisee, lbcTitre, lireBaseRelue, lireObjet, load, marqueurNumerotation, montantRecuEbay, mpChoisi, numerosReserves, numerotationPermise, placeLibreTampon, poserCible, prefixeNumeros, prixAchatDe, prochainLibre, rechercheParNumero, rendrePremierePage, save, sbAuth, sitesPrixDe, tailleAffichee, toast, triPool, txnAnnuleeAvantEnvoi, useEbayPaires, useExtVivante, vendActuel, zonesCodesTampon } from '../App.jsx';

// La branche {ficheNum && …} de AppCoeur, telle quelle, avec 3 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleFicheNum({ v }) {
  const { aTrancherEtat, ficheExtra, ficheNum, neuveRecente, numData, setFicheNum, setGarageLocate, setGsOpen, setGsQ, setNeuveRecente, setPrixNum, setPubAil, setTab, subVoulue, trancherAT, vintedAccounts } = v;
  /*⟦← App.jsx #h1_1⟧*/const venduAilleursGeste=(carte,{ montant, date })=>{
    const r=opsVenduAilleurs({ carte, montant, date, decisions:lireObjet(CYCLE_DECISIONS), vendues:load('vinted_annonces_vendues',[])||[], slots:lireObjet('vrm_slots'), cle:cleNum });
    if(!r){ toast('Pas compris — rien n’a été noté.','err'); return; }
    gesteVrm(r.texte, r.ops, {}, ()=>{ setTimeout(()=>{ try{ window.dispatchEvent(new Event('vrm:stock-slots')); }catch(_){} emettreClesRelues(['vinted_annonces_vendues','vrm_cycle_decisions']); },700); });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const blocVenduAilleurs=(p,rn,etat)=>{
    if(!p||!p.num||p.ancienNumero||!rn||!Array.isArray(rn.annonces)||!etat) return null;
    const eV=Array.isArray(p.etapes)?p.etapes.find((e)=>e.cle==='vente'):null;
    const dec=lireObjet(CYCLE_DECISIONS);
    const presentes=rn.annonces.filter((a)=>a&&(a.etat==='en-ligne'||a.etat==='a-confirmer'||a.etat==='masquee'));
    const l=presentes.length?presentes:rn.annonces;
    if(l.length!==1) return null;
    const a=l[0]; const d=dec[String(a.id)];
    if(d&&d.choix==='vendu-main') return <VenduAilleurs carte={{ id:a.id, numero:p.num }} deja={d} Bouton={Bouton}/>;
    if(!eV||eV.etat==='passu'||etat.vendue) return null;
    return <VenduAilleurs key={a.id} carte={{ id:a.id, numero:p.num }} Bouton={Bouton} onValider={(x)=>venduAilleursGeste({ id:a.id, numero:p.num, title:a.title||'' },x)}/>;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const questionChezToiFiche=(num)=>{
    const l=aTrancherEtat&&Array.isArray(aTrancherEtat.lignes)?aTrancherEtat.lignes.find((x)=>x.cle==='supprimes-vinted'):null;
    const k=cleNum(num); const x=l&&Array.isArray(l.ex)&&k?l.ex.find((e)=>e&&e.id&&cleNum(e.num)===k):null;
    if(!x) return null;
    return <div className="vrm-at vrm-at-fiche" data-fiche-chez-toi={x.id}><p className="vrm-at-question">Supprimée de Vinted. L’enlever du stock ?</p>
      <QuestionChezToi carte={{ cle:'supprimes-vinted', id:x.id, num:x.num, binaire:BINAIRES_TRANCHER['supprimes-vinted'] }} onTrancher={trancherAT}/></div>;
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<GardeEcran nom="fiche" feuille resetKey={ficheNum} onFermer={()=>setFicheNum(null)}><Differe rendre={()=>{
          // (1er nov.) LA FICHE COMPLÈTE D'UNE PAIRE : la même lecture que « Tout
          // sur le N° » (`rechercheParNumero`), racontée en parcours (`parcoursPaire`).
          const { rn, numeros } = rechercheParNumero(ficheNum, numData, vintedAccounts);
          const nomCompte = (uid) => { const a = (vintedAccounts || []).find(x => String(x.vinted_user_id) === String(uid)); if (!a) return null; const labels = load('vinted_account_labels', {}) || {}; return labels[a.vinted_user_id] || a.login || `#${a.vinted_user_id}`; };
          const shipDone = load('vinted_ship_done', {}) || {};
          // (3 nov.) L'HISTOIRE COMPLÈTE (`histoireArticle`) : le parcours + les
          // lectures en plus (`ficheExtra`), chaque étape lue et datée par sa donnée.
          const ex = ficheExtra && ficheExtra.num === ficheNum ? ficheExtra : null;
          const autresEnLigne = ex && ex.lbcItems != null && ex.vcItems != null ? sitesPrixDe(ficheNum, rn, ex).sites.filter((x) => x.site === 'leboncoin' || x.site === 'vestiaire') : null;
          const neuve = (neuveRecente && cleNum(neuveRecente.numero) === rn.cle ? neuveRecente : null) || Object.values(load('vrm_fiches_neuves', {}) || {}).find((x) => x && !x.retireeAt && cleNum(x.numero) === rn.cle) || null;
          const p = histoireArticle(rn, { fiches: numeros, saleOv: load('vinted_sale_overrides', {}) || {}, buyByNum: load('vinted_buyprice_by_num', {}) || {},
            stats: numData ? (numData.stats === undefined ? null : numData.stats) : null, versements: numData ? (numData.versements === undefined ? null : numData.versements) : null, nomCompte,
            coffres: ex ? ex.coffres : null, offres: ex ? ex.offres : null, recus: ex ? ex.recus : null, autresEnLigne, colisVente: ex ? ex.colisVente : undefined,
            journalPrix: (load('vrm_prix_journal', {}) || {})[rn.cle] || [], prixVinted: load('vinted_prix_historique', []) || [], prixLus: load(CLE_PRIX_LUS, null),
            sortieStock: (load('vrm_stock_sortis', {}) || {})[rn.cle] || null }, {
            etapeVente: (o) => etapeVente(o, { poste: (x) => !!shipDone[String(x.transaction_id)] }),
            venteAnnulee: (o) => classifyOrderStatus(o && o.status) === 'cancelled' || (o && o.transaction_id != null && txnAnnuleeAvantEnvoi(o.transaction_id)),
            montantRecuEbay, commandeEbayEngagee, lbcAnnulee, lbcFinalisee,
          });
          // (5 nov.) « Voir l'état » : ce qui se calcule (`etatArticle`), depuis
          // l'histoire ci-dessus et deux lectures en plus (dates Vinted, réception).
          const etat = p ? etatArticle(p, { fiches: numeros, ids: (rn.annonces || []).map((a) => a.id),
            crees: numData ? (numData.crees === undefined ? null : numData.crees) : undefined,
            reception: ex ? ex.reception : undefined, receptionRaison: ex ? ex.receptionRaison : '' }) : null;
          // (9 nov., lot AF) L'HISTOIRE DU N° (src/historiqueNumero.js) : lecture seule, depuis les
          // traces qui existent (fiches, ventes, marqueur 013, Stock, journal des N°) — jamais devinée.
          const histoNum = p && rn && rn.cle ? historiqueNumero({ cle: rn.cle, fiches: numeros, saleOv: load('vinted_sale_overrides', {}) || {},
            journal: load(CLE_JOURNAL_NUMEROS, []) || [], marqueur: marqueurNumerotation(), sortieStock: (load('vrm_stock_sortis', {}) || {})[rn.cle] || null,
            estArchive: (n) => estArchive(n), cleNum }) : null;
          const fermer = () => setFicheNum(null);
          return <FichePaire owner={AUTH.user?.id||''} p={p} etat={etat} histoNum={histoNum} num={ficheNum} lecture={!numData} note={p && p.num && !p.ancienNumero ? <>{questionChezToiFiche(p.num)}{blocVenduAilleurs(p, rn, etat)}<NotePaireCoque numero={p.num} variante="bloc" ajout/><BlocHistoriqueRepub ids={(rn.annonces || []).map((x) => String(x.id))} d={{ numeros, stats: Object.fromEntries((rn.annonces || []).map((x) => [String(x.id), { favoris: Number.isFinite(x.favourites) ? x.favourites : null, vues: Number.isFinite(x.views) ? x.views : null }])) }}/><BoutonRappel cible={{ sorte: 'article', num: p.num, item: (rn.annonces || []).length === 1 ? String(rn.annonces[0].id || '') : '' }} libelle={`N°${p.num}`}/></> : null} onFermer={fermer} onRetour={()=>{ fermer(); setGsQ(String((p && p.num) || ficheNum)); setGsOpen(true); }}
            onBordereau={(tx)=>{ fermer(); setGsOpen(false); poserCible({ type: 'colis', tx: String(tx) }, redirigerOnglet('cat_bord', null, ONGLETS_DEPLACES).tab); setTab('cat_bord'); }}
            onEmballer={()=>{ fermer(); setGsOpen(false); DEMANDE_EMBALLAGE.at = Date.now(); setTab('cat_bord'); try { window.dispatchEvent(new Event('vrm:emballer')); } catch (_) {} }}
            onPrix={(n)=>setPrixNum(String(n))} onPublierAilleurs={(n)=>setPubAil({ num: String(n), site: null })} neuve={neuve}
            onSource={(src)=>{ fermer(); setGsOpen(false);
              // (9 nov.) « Ouvrir dans … » : l'écran d'où vient l'étape, sur SON objet (par identité).
              if (src.stock) { setGarageLocate(String(src.stock)); DEMANDE_STOCK_CHERCHE.nums=[String(src.stock)]; DEMANDE_STOCK_CHERCHE.at=Date.now(); setTab('garage'); return; }
              if (src.tab === 'achats') demanderVue('achats'); if (src.sub) subVoulue.current = src.sub;
              if (src.cible) poserCible(src.cible, redirigerOnglet(src.tab, null, ONGLETS_DEPLACES).tab);
              setTab(src.tab); }}
            onCopier={async(f)=>{ try { await navigator.clipboard.writeText(texteAColler(f)); toast('Texte copié'); } catch (_) { toast('Copie impossible ici'); } }}
            onDupliquer={async()=>{ const r=await dupliquerNumero(rn, ex); if(!r.ok){ toast(`Pas dupliqué : ${r.raison}`); return; } toast(`N°${r.numero} créé`); setNeuveRecente(r.fiche); setFicheNum(String(r.numero)); }}
            Photo={(src)=><PhotoVinted src={src} alt="" loading="lazy"/>} Icon={Icon} Retour={FermeAuRetour}/>;
        }}/></GardeEcran>/*⟦←/⟧*/);
}

// ⟦← App.jsx #3⟧
import { champsSource, dupliquerFiche, fichesAPublier, texteAColler } from "../dupliquerFiche.js";
// ⟦← App.jsx #4⟧
import { etatArticle } from "../etatArticle.js";
// ⟦← App.jsx #1⟧
const FichePaire = aLaDemande(() => import('../FichePaire.jsx'), true);
// ⟦← App.jsx #2⟧   // (11 nov., ext. 5.350) « Vinted a masqué / fait disparaître / limite »
const PublierAilleurs = aLaDemande(() => import('../PublierAilleurs.jsx'), true);
// ⟦← App.jsx #5⟧
const recouvreTampon = (zones, b) => (zones || []).some((z) => b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y);
// ⟦← App.jsx #6⟧
// ⟦→ coeur/VueAnnonces.jsx #14⟧
// Le carré « Actions possibles » : les actions de la sélection (grisées avec leur
// raison), et AVANT de lancer, paire par paire, ce qui manque pour publier
// (`problemesAnnonce`, src/verifAnnonce.js — la règle de « vérifier avant »),
// avec le geste. Ce que VRM n'a pas lu est dit à part : l'extension le vérifie
// au lancement (`champsManquantsAvant`) et demande ce qui manque.
function ActionsSelectionFeuille({ choisies, actions, onLancer, onClose }) {
  const verifs = choisies.filter((a) => a.etat !== 'verification').map((a) => {
    const verifV = { ...(a.verif || {}), facultatifs: champsFacultatifs(vendActuel()) };
    const pbs = problemesAnnonce(verifV, 'vinted');
    if (a.etat === 'brouillon' && a.place && a.place !== 'proposable' && a.place !== 'autre-compte' && a.place !== 'compte-inconnu') pbs.unshift({ code: 'brouillon', texte: a.place === 'pas-pret' ? (a.brEtat === 'inconnu' ? 'Pas encore vu par l’extension' : 'Brouillon incomplet') : 'Brouillon à vérifier sur Vinted', geste: a.brEtat === 'inconnu' ? 'Ouvre-le sur Vinted et fais « Enregistrer le brouillon »' : 'Ouvre ton dressing Vinted sur ce compte' });
    return { a, pbs, nonLus: champsNonJuges(verifV, 'vinted') };
  });
  const nManque = verifs.filter((v) => v.pbs.length).length;
  const lien = (a) => `https://${a.domain || 'www.vinted.fr'}/items/${a.id}/edit`;
  // (5 nov., chantier C — revue 2.5) UNE feuille, QUATRE tuiles (Republier · Modifier
  // prix ou titre · Mettre en brouillon · Mettre en ligne) ; la raison commune se dit
  // UNE fois en tête (`raisonCommune`), sous une tuile ne reste que SA raison.
  // « Republier à la main » n'est pas une cinquième tuile : un lien discret dessous.
  const tuiles = ACTIONS_TUILES.map((k) => actions.find((x) => x.k === k)).filter(Boolean);
  const main = actions.find((x) => x.k === 'main');
  // (6 nov., vague 2 · point 2) « Prix mini… » : un second lien discret (rien ne part chez Vinted).
  const mini = actions.find((x) => x.k === 'mini');
  // (10 nov., lot C) « Baisser le prix… » : un troisième lien discret (la feuille de baisse en série).
  const baisser = actions.find((x) => x.k === 'baisser');
  // (11 nov.) « Publier partout… » : un lien discret de plus (la feuille de src/PublierPartout.jsx).
  const partout = actions.find((x) => x.k === 'partout');
  // (11 nov., lot visuels-reseaux) « Nouveautés de la semaine » : un visuel des annonces cochées (rien ne part chez Vinted).
  const visuels = actions.find((x) => x.k === 'visuels');
  const { tete, parTuile } = raisonCommune(actions);
  // Ce que VRM n'a pas lu : la MÊME phrase sur chaque paire ⇒ une fois, sous la liste.
  const cleNL = (l) => l.join(', ');
  const nlCommun = verifs.length > 1 && verifs.every((v) => v.nonLus.length && cleNL(v.nonLus) === cleNL(verifs[0].nonLus)) ? verifs[0].nonLus : null;
  const n = choisies.length;
  return (
    <SheetShell onClose={onClose} maxWidth={520} titre={`Actions · ${n} annonce${n > 1 ? 's' : ''}`}>
      <div className="vrm-act" data-actions-selection={n} data-actions-tuiles={tuiles.length}>
        {tete ? <p className="vrm-act-raison" data-actions-raison="" role="status">{tete}</p> : null}
        {/* (11 nov., lot DJ8 — « la repu à la main au premier plan ») « Republier à la main » AVANT
            les tuiles : conseillé, le moins risqué (c'est lui qui publie, rien ne part d'ici). */}
        {main ? (
          <div className="vrm-act-main vrm-act-main-conseil" data-action-sel="main" data-action-sel-ok={main.ok ? 'oui' : 'non'}>
            <Bouton variante={main.ok ? 'secondaire' : 'discret'} icone="shield" disabled={!main.ok} title={main.ok ? main.desc : main.raison} onClick={() => { if (main.ok) onLancer('main'); }}>{main.titre}</Bouton>
            {main.ok || main.raison !== tete ? <span>{main.ok ? 'Conseillé : tu publies toi-même, VRM prépare tout.' : main.raison}</span> : null}
          </div>
        ) : null}
        <div className="vrm-act-tuiles">
          {tuiles.map((x) => { const sous = parTuile[x.k] || ''; return (
            <button key={x.k} type="button" className="vrm-act-choix" data-action-sel={x.k} data-action-sel-ok={x.ok ? 'oui' : 'non'} aria-disabled={x.ok ? undefined : 'true'} title={x.ok ? undefined : x.raison}
              onClick={() => { if (!x.ok) { toast(x.raison); return; } onLancer(x.k); }}>
              <b>{x.titre}</b>
              {sous ? <span>{sous}</span> : null}
            </button>
          ); })}
        </div>
        {mini ? (
          <div className="vrm-act-main" data-action-sel="mini" data-action-sel-ok={mini.ok ? 'oui' : 'non'}>
            <Bouton variante="discret" disabled={!mini.ok} title={mini.ok ? mini.desc : mini.raison} onClick={() => { if (mini.ok) onLancer('mini'); }}>{mini.titre}</Bouton>
            <span>{mini.ok ? '« Accepter dès » sur toutes, depuis leur prix.' : mini.raison}</span>
          </div>
        ) : null}
        {baisser ? (
          <div className="vrm-act-main" data-action-sel="baisser" data-action-sel-ok={baisser.ok ? 'oui' : 'non'}>
            <Bouton variante="discret" disabled={!baisser.ok} title={baisser.ok ? baisser.desc : baisser.raison} onClick={() => { if (baisser.ok) onLancer('baisser'); }}>{baisser.titre}</Bouton>
            <span>{baisser.ok ? '−X € ou −X %, une par une, prix relu.' : baisser.raison}</span>
          </div>
        ) : null}
        {partout ? (
          <div className="vrm-act-main" data-action-sel="partout" data-action-sel-ok={partout.ok ? 'oui' : 'non'}>
            <Bouton variante="discret" disabled={!partout.ok} title={partout.ok ? partout.desc : partout.raison} onClick={() => { if (partout.ok) onLancer('partout'); }}>{partout.titre}</Bouton>
            <span>{partout.ok ? 'Leboncoin, Vestiaire, eBay : une case par site, depuis l’annonce Vinted.' : partout.raison}</span>
          </div>
        ) : null}
        {visuels ? (
          <div className="vrm-act-main" data-action-sel="visuels" data-action-sel-ok={visuels.ok ? 'oui' : 'non'}>
            <Bouton variante="discret" disabled={!visuels.ok} title={visuels.ok ? visuels.desc : visuels.raison} onClick={() => { if (visuels.ok) onLancer('visuels'); }}>{tr('visuels.titreLot')}</Bouton>
            <span>{visuels.ok ? tr('visuels.actionDesc') : visuels.raison}</span>
          </div>
        ) : null}
        <div className="vrm-act-verif" data-avant-lancer={nManque}>
          <div className="vrm-main-etape">Avant de lancer{nManque ? ` · ${nManque} sur ${verifs.length} à corriger` : ''}</div>
          {verifs.map(({ a, pbs, nonLus }) => (
            <div key={a.uid + ':' + a.id} className="vrm-act-paire" data-act-paire={a.id} data-act-manque={pbs.length} data-act-codes={pbs.map((p) => p.code).join(',')}>
              <div className="vrm-act-paire-nom">{a.numero ? <Numero n={a.numero} taille="petit"/> : null}<b>{a.titre || 'Sans titre'}</b>{pbs.length ? null : <span className="vrm-act-ok" aria-label="Rien ne manque dans ce que VRM a lu"><Icon name="check" size={14}/></span>}</div>
              {pbs.map((p) => (
                <div key={p.code} className="vrm-act-pb" data-act-pb={p.code}><span>{p.texte}{p.geste ? ` — ${p.geste}` : ''}</span><a href={lien(a)} target="_blank" rel="noreferrer">Corriger sur Vinted ↗</a></div>
              ))}
              {nonLus.length > 0 && !nlCommun && <div className="vrm-act-muet" data-act-non-lus={nonLus.length}>Pas lu par VRM : {nonLus.join(', ')}.</div>}
            </div>
          ))}
          {nlCommun ? <div className="vrm-act-muet" data-act-non-lus-commun={nlCommun.length}>Pas lu par VRM : {nlCommun.join(', ')}. L’extension les vérifie au lancement et demande ce qui manque.</div>
            : verifs.some((v) => v.nonLus.length) ? <div className="vrm-act-muet">L’extension vérifie au lancement ce que VRM n’a pas lu et demande ce qui manque.</div> : null}
        </div>
      </div>
    </SheetShell>
  );
}
// ⟦← App.jsx #7⟧
// DUPLIQUER : une fiche neuve (`vrm_fiches_neuves`), un N° neuf (`prochainLibre`
// sur TOUS les numéros servis, réservés compris), aucune photo, aucune identité.
// Rend { ok, numero } ou { ok:false, raison }. Rien sur « pas su ».
async function dupliquerNumero(rn, extra) {
  if (!numerotationPermise() || !isCloudReady()) return { ok: false, raison: 'numéros pas encore chargés' };
  if (!(await assurerVersionNumerotation())) return { ok: false, raison: 'recharge l’app' };
  let jr = null; try { jr = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_num_reserves&select=data`); } catch (_) { jr = null; }
  if (!Array.isArray(jr)) return { ok: false, raison: 'numéros réservés pas lus' };
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const a = ((rn && rn.annonces) || []).find((x) => x.etat === 'en-ligne') || ((rn && rn.annonces) || [])[0] || null;
  const f = a ? fiches[a.id] : null;
  const c = a && extra && extra.coffres ? extra.coffres[a.id] : null;
  const neuveSrc = Object.values(load('vrm_fiches_neuves', {}) || {}).find((x) => x && cleNum(x.numero) === (rn && rn.cle));
  if (!f && !c && !neuveSrc) return { ok: false, raison: 'aucune fiche à copier' };
  const champs = neuveSrc && !f && !c ? neuveSrc : champsSource(f, c);
  const pris = new Set(), prisK = new Set();
  const add = (v) => { const k = cleNum(v); if (!k) return; prisK.add(k); if (/^\d+$/.test(k)) pris.add(Number(k)); };
  (load('vinted_used_numeros', []) || []).forEach(add);
  Object.values(fiches).forEach((e) => add(e && e.numero));
  Object.values(load('vinted_sale_overrides', {}) || {}).forEach((e) => add(e && e.numero));
  Object.values(load('vrm_lbc_liens', {}) || {}).forEach(add);
  Object.values(load('vrm_fiches_neuves', {}) || {}).forEach((e) => add(e && e.numero));
  ajouterNumerosHorsEcran(pris, prisK);
  numerosReserves(jr[0] ? jr[0].data : null).cles.forEach(add);
  const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let r; try { r = dupliquerFiche(champs, { pris: { int: pris, cles: prisK }, pref: prefixeNumeros(), prochainLibre, cleNum, id }); } catch (e) { return { ok: false, raison: 'numéro pas sûr' }; }
  // Le pool d'abord (append-only), puis la fiche.
  const pool = (load('vinted_used_numeros', []) || []).slice();
  const ep = entreePool(r.fiche.numero);
  if (ep != null && !pool.some((x) => cleNum(x) === cleNum(ep))) pool.push(ep);
  save('vinted_used_numeros', pool.sort(triPool));
  save('vrm_fiches_neuves', { ...(load('vrm_fiches_neuves', {}) || {}), [r.id]: r.fiche });
  emettreClesRelues(['vinted_used_numeros', 'vrm_fiches_neuves']);
  return { ok: true, numero: r.fiche.numero, id: r.id, fiche: r.fiche };
}
// ⟦← App.jsx #8⟧
// ══════════════════════════════════════════════════════════════════════════════
// PUBLIER AILLEURS — LE PARCOURS GUIDÉ (5 nov., règle : src/publierAilleurs.js)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « Vinted → Leboncoin, Vestiaire et eBay : beaucoup plus accompagné,
// pro, pointilleux et fiable ». Les paires proposables sont celles de la source
// partagée (`useEbayPaires` : en ligne sur Vinted ou « toujours chez moi », §11) ;
// ce qui part est construit par les règles des moteurs (`lbcTitre`,
// `descriptionLbcDe`, `descriptionEbayPropre`) ; ce qui manque par la
// vérification de l'app ; « vue en ligne » par `sitesDuNumero` (identité).
// « Publier » ouvre le moteur EXISTANT sur CET article — la fiche Leboncoin
// (`DEMANDE_LBC_FICHE`), le formulaire eBay (`DEMANDE_EBAY_PAIRE`), la ligne
// Vestiaire (`DEMANDE_VC_PAIRE`) — avec toutes ses gardes : rien ne part d'ici.
function HotePublierAilleurs({ comptes, num, site, sitesVus, manquesLecture, lecture, onChoisir, onFermer, onNav }) {
  const { paires, pret } = useEbayPaires(comptes);
  const { jobs } = useExtVivante();
  // Les marques « déjà publiée » (Leboncoin, Vestiaire) et les brouillons eBay de
  // ses paires : trois états (undefined en cours · null pas su · Set).
  const [postes, setPostes] = React.useState({ leboncoin: undefined, vestiaire: undefined });
  const [brouillons, setBrouillons] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    const ids = async (id) => { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&select=ids:data->ids`, { headers: sbAuth() }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? new Set(((j[0] && j[0].ids) || []).map(String)) : null; } catch (_) { return null; } };
    (async () => {
      const [lbc, vc] = await Promise.all([ids('vinted_lbc_posted'), ids('vinted_vc_posted')]);
      // ⚠️ (relecture du 5 nov.) Un brouillon eBay MIS EN LIGNE (ou programmé) garde sa ligne avec
      //    `programme.itemId` (`lireBrouillonsEbay`) : il n'est plus « préparé », il est PUBLIÉ —
      //    le dire « préparée » proposait « Reprendre sur eBay » sur une annonce déjà en ligne.
      let br = null;
      try { const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.ebay_brouillons&select=items:data->items`, { headers: sbAuth() }); if (r.ok) { const j = await r.json(); const it = Array.isArray(j) && j[0] && j[0].items; const l = (Array.isArray(it) ? it : Object.values(it || {})).filter((b) => b && b.pairId != null);
        const publie = (b) => !!((b.programme && b.programme.itemId) || b.itemId);
        br = { prepares: new Set(l.filter((b) => !publie(b)).map((b) => String(b.pairId))), publies: new Set(l.filter(publie).map((b) => String(b.pairId))) }; } } catch (_) { br = null; }
      if (vivant) { setPostes({ leboncoin: lbc, vestiaire: vc }); setBrouillons(br); }
    })();
    return () => { vivant = false; };
  }, [num]);
  const liste = pret ? paires : undefined;
  const k = num ? cleNum(num) : '';
  const paire = k && Array.isArray(liste) ? (liste.find((p) => cleNum(p.num) === k) || null) : null;
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const cartes = React.useMemo(() => {
    if (!paire) return [];
    const fiche = fiches[String(paire.id)] || {};
    let achat = null; try { achat = prixAchatDe(fiche, load('vinted_buyprice_by_num', {}) || {}); } catch (_) { achat = null; }
    const famille = familleArticle({ titre: paire.title, taille: paire.taille, marque: paire.marque }).famille;
    const etats = etatsPaire(paire, { sitesVus: lecture ? null : sitesVus, manquesLecture, jobs, brouillonsEbay: brouillons ? brouillons.prepares : null, publiesEbay: brouillons ? brouillons.publies : null,
      postes: { leboncoin: postes.leboncoin === undefined ? null : postes.leboncoin, vestiaire: postes.vestiaire === undefined ? null : postes.vestiaire } });
    return SITES_PUBLIER.map((sx) => {
      const apercu = apercuEnvoi(sx, paire, { titreLbc: (m, t, ta) => lbcTitre(m, t, ta), titreVc: (m, t, ta) => lbcTitre(m, t, ta, 80), titreEbay: (t, ta) => ebayTitre(t || '', ta || ''),
        descriptionLbc: (o) => descriptionLbcDe(o), descriptionEbay: (pp) => (pp && pp.desc) || descriptionDeFaits(pp || {}) });
      return { site: sx, apercu, manques: manquesEnvoi(sx, apercu, { achat, famille, mpLbc: mpChoisi(fiche, 'lbc'), horsVinted: paire.chezMoi === true, facultatifs: champsFacultatifs(vendActuel()) }), etat: etats[sx], lien: lienVu(sx, sitesVus) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paire, sitesVus, manquesLecture, lecture, jobs, postes, brouillons]);
  const publier = (sx) => {
    if (!paire) return;
    const id = String(paire.id), at = Date.now();
    if (sx === 'leboncoin') { DEMANDE_LBC_FICHE.id = id; DEMANDE_LBC_FICHE.at = at; onNav && onNav('leboncoin'); }
    else if (sx === 'ebay') { DEMANDE_EBAY_PAIRE.id = id; DEMANDE_EBAY_PAIRE.at = at; onNav && onNav('ebay_annonces'); }
    else if (sx === 'vestiaire') { DEMANDE_VC_PAIRE.id = id; DEMANDE_VC_PAIRE.at = at; onNav && onNav('vestiaire_annonces'); }
    // L'écran du site est rendu d'abord ; la feuille se ferme ensuite (son retour
    // d'historique ne doit pas ramener l'écran d'avant — même piège que « qui dorment »).
    setTimeout(() => onFermer(), 400);
  };
  const avis = num && Array.isArray(liste) && !paire ? `N°${num} n’est pas proposable ici (vendu, plus en ligne, ou à trancher).` : '';
  return <PublierAilleurs paire={paire} paires={liste} lecture={lecture} cartes={cartes} partout={lecture ? [] : partoutLeMeme(sitesVus)} siteDemande={site}
    avis={avis} chercher={(l, q) => chercherPaires(l, q, cleNum)} onChoisir={(p) => onChoisir(String(p.num))} onChanger={() => onChoisir(null)}
    onPublier={publier} onFermer={onFermer} Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy"/>} Retour={FermeAuRetour}/>;
}
// ⟦← App.jsx #9⟧
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
export { ActionsSelectionFeuille, PlaceurTamponFeuille, HotePublierAilleurs };
