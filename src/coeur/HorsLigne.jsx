// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import React from 'react';
import { GARDE_MAX_J } from '../../api/_lib/retrait-colis.js';
import { texteLimiteEnvoi } from '../../api/_lib/limite-envoi.js';
import { lirePhoto, listeDuSoir, joursAvantJour, heurePhoto, adresseQrLocale, quandEtat, ageEtatH, etatVieux, ETAT_VIEUX_H, pointsDeRetrait, colisRetireApres, colisRetireAnnule, marqueApres, marqueAnnulee } from '../journeeHorsLigne.js';
import ModeRelais from '../ModeRelais.jsx';
import ModeDepot from '../ModeDepot.jsx';
import { lirePdfGarde } from '../bordereauxHorsLigne.js';
import { tr } from '../i18n/index.js';
import { trj } from '../i18n/react.js';
import { BlocCodesHorsLigne, BlocInventaireHorsLigne, Bouton, C, FermeAuRetour, GardeEcranAllume, Icon, ONGLETS_COLIS_HL, PhotoVinted, SheetShell, Z_CONFIRMATION, _saveTimers, enFile, load, save } from '../App.jsx';

// ⟦← App.jsx #1⟧
import { colisDepotHorsLigne } from "../modeDepot.js";
// ⟦← App.jsx #2⟧
function LigneHorsLigne({ children, date }) {
  return (
    <div role="status" data-hors-ligne-ligne="" data-hors-ligne-date={date || undefined}
      style={{display:'flex',alignItems:'center',gap:10,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px',marginBottom:14}}>
      <span aria-hidden="true" style={{display:'flex',color:C.muted,flexShrink:0}}><Icon name="cloudOff" size={18}/></span>
      <span style={{fontSize:13,fontWeight:600,color:C.text,lineHeight:1.4}}>{children}</span>
    </div>
  );
}
// (6 nov., v36) LA LIGNE DU DERNIER ÉTAT : « Hors connexion — dernier état du
// 6 nov. à 17:36 » — le JOUR toujours (une heure seule se lisait « aujourd'hui »
// et un état de la veille passait pour frais), une fois, sobre. Au-delà de
// `ETAT_VIEUX_H` (12 h) une seconde ligne, ambre, dit qu'il a pu changer : jamais
// une donnée périmée présentée comme fraîche (§5). Les gestes notés ici partent
// au retour du réseau (la file d'envoi, `EnAttenteEnvoi` dit combien).
function LigneEtatHorsLigne({ at, maintenant }) {
  const h = ageEtatH(at, maintenant);
  return (<>
    <LigneHorsLigne date={new Date(at).toISOString()}>Hors connexion — dernier état du {quandEtat(at)}. Ce que tu notes ici part au retour du réseau.</LigneHorsLigne>
    {etatVieux(at, maintenant) ? (
      <div role="note" data-hors-ligne-vieux={Math.floor(h || 0)} style={{border:`1px solid ${C.warn}66`,background:`${C.warn}12`,borderRadius:12,padding:'10px 14px',margin:'-6px 0 14px',fontSize:13,color:C.text,lineHeight:1.45}}>
        État de plus {h >= 24 ? 'd’un jour' : `de ${ETAT_VIEUX_H} h`} : vérifie au comptoir.
      </div>) : null}
  </>);
}
function QrHorsLigne({ qr, code }) {
  const [etat, setEtat] = React.useState('charge');
  if (!qr) return null;
  const src = /^data:image\//i.test(qr) ? qr : adresseQrLocale(qr);
  if (etat === 'ko') return <div data-hl-qr="ko" style={{flexShrink:0,width:92,fontSize:11,color:C.muted,lineHeight:1.35,textAlign:'center'}}>{code ? 'QR pas gardé ici — donne le code' : 'QR pas gardé sur cet appareil'}</div>;
  return <img data-hl-qr={etat} src={src} alt="QR de retrait" width={92} height={92} onLoad={() => setEtat('ok')} onError={() => setEtat('ko')}
    style={{flexShrink:0,width:92,height:92,borderRadius:12,background:'#fff',border:`1px solid ${C.border}`,objectFit:'contain'}}/>;
}
// (6 nov., v36) LES GESTES HORS RÉSEAU — des NOTES de l'appareil, jamais une
// action chez Vinted ou un transporteur : « J'ai retiré » (`vrm_colis_collected`
// par l'identité du colis, ou `vinted_pickup_done` par sa transaction) et
// « Colis fait » (`vinted_ship_done`). Ils passent par `save` comme en ligne : la
// FILE D'ENVOI (src/fileEnvoi.js) les garde et les rejoue au retour du réseau
// (fusion clé par clé, jamais un écrasement). Un colis sans identité gardée
// (photo d'avant le 6 nov.) n'a pas de geste : refusé et dit, jamais deviné.
const CLES_GESTES_HL = ['vrm_colis_collected', 'vrm_colis_collected_at', 'vinted_pickup_done', 'vinted_ship_done'];
function useGestesHorsLigne() {
  const lire = () => ({ collected: load('vrm_colis_collected', []) || [], collectedAt: load('vrm_colis_collected_at', {}) || {}, pickup: load('vinted_pickup_done', {}) || {}, ship: load('vinted_ship_done', {}) || {} });
  const [g, setG] = React.useState(lire);
  React.useEffect(() => {
    const f = (e) => { if (!e || !e.detail || CLES_GESTES_HL.includes(e.detail.k)) setG(lire()); };
    const st = (e) => { if (!e || e.key == null || CLES_GESTES_HL.includes(e.key)) setG(lire()); };
    window.addEventListener('vrm:save', f); window.addEventListener('storage', st);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('storage', st); };
  }, []);
  const attente = (k) => { try { return enFile(k) || !!_saveTimers[k]; } catch (_) { return false; } };
  const etatRetrait = (r) => {
    const fait = r.cle ? g.collected.map(String).includes(r.cle) : r.tx ? !!g.pickup[r.tx] : false;
    if (!fait) return '';
    return attente(r.cle ? 'vrm_colis_collected' : 'vinted_pickup_done') ? 'attente' : 'note';
  };
  const etatFait = (e) => (e.tx && g.ship[e.tx] ? (attente('vinted_ship_done') ? 'attente' : 'note') : '');
  const ecrire = (k, v) => { save(k, v); };
  const retirer = (r, oui) => {
    if (r.cle) {
      const n = oui ? colisRetireApres(g.collected, g.collectedAt, r.cle, new Date().toISOString()) : colisRetireAnnule(g.collected, g.collectedAt, r.cle);
      if (!n) return;
      setG((x) => ({ ...x, collected: n.liste, collectedAt: n.dates }));
      ecrire('vrm_colis_collected', n.liste); ecrire('vrm_colis_collected_at', n.dates);
    } else if (r.tx) {
      const n = oui ? marqueApres(g.pickup, r.tx, new Date().toISOString()) : marqueAnnulee(g.pickup, r.tx);
      if (!n) return;
      setG((x) => ({ ...x, pickup: n })); ecrire('vinted_pickup_done', n);
    }
  };
  const faire = (e, oui) => {
    const n = oui ? marqueApres(g.ship, e.tx, Date.now()) : marqueAnnulee(g.ship, e.tx);
    if (!n) return;
    setG((x) => ({ ...x, ship: n })); ecrire('vinted_ship_done', n);
  };
  return { etatRetrait, etatFait, retirer, faire };
}
// Le bouton d'un geste hors réseau, et ce qu'il est devenu (noté, en attente).
function GesteHorsLigne({ etat, libelle, fait, peut, onOui, onNon, attrs = {} }) {
  if (etat) return (
    <span style={{display:'inline-flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <span style={{fontSize:12,fontWeight:600,color:C.text}}>{fait}{etat === 'attente' ? ' · part au retour du réseau' : ''}</span>
      <Bouton variante="discret" className="vrm-b-petit" data-hl-annuler="" onClick={onNon}>Annuler</Bouton>
    </span>);
  if (!peut) return <Bouton variante="secondaire" className="vrm-b-petit" disabled aria-disabled="true" data-hl-geste="" title="Ce colis vient d’un état gardé sans son identité : il faut le réseau" style={{flexShrink:0}}>{libelle}</Bouton>;
  return <Bouton variante="secondaire" className="vrm-b-petit" data-hl-geste="" data-hl-file="" onClick={onOui} style={{flexShrink:0}} {...attrs}>{libelle}</Bouton>;
}
// Une ligne de colis hors ligne (à retirer, ou à vérifier). La raison d'un colis
// « à vérifier » vient de LA règle (`etatRetrait`) : « délai dépassé le … » si
// une date limite a été LUE, sinon « plus de N jours au point relais » (la garde
// de son transporteur) — jamais « hors délai » sans date limite (revue du 23 oct.).
// (6 nov.) `sansLieu` : rangée dans la carte de SON point relais, le lieu est dit
// par la carte ; « En grand » et « J'ai retiré » marchent sans réseau.
function LigneRetraitHorsLigne({ r, i, quand, maintenant, verifier = false, sansLieu = false, gestes, onEnGrand }) {
  const jj = (j) => new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  const reste = !verifier && r.limite ? joursAvantJour(r.limite, maintenant) : null;
  const delai = verifier
    ? (r.raison === 'delai_depasse' ? `délai de retrait dépassé${r.limite ? ` le ${jj(r.limite)}` : ''}`
      : r.raison === 'trop_long' ? `au point relais depuis plus de ${Number.isFinite(r.garde) ? r.garde : GARDE_MAX_J} jours` : 'à vérifier')
    : (reste == null ? '' : reste < 0 ? `délai de retrait passé (${jj(r.limite)})` : reste === 0 ? "à retirer aujourd'hui" : `à retirer avant le ${jj(r.limite)}`);
  const etat = gestes ? gestes.etatRetrait(r) : '';
  return (
    <div data-hl-retrait={verifier ? 'a-verifier' : ''} data-hl-raison={verifier ? (r.raison || 'inconnue') : undefined} data-hl-retire={etat || undefined}
      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderTop:i ? `1px solid ${C.border}` : 'none',opacity:etat ? 0.75 : 1}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.titre || (sansLieu ? '' : r.lieu) || (r.transporteur ? `Colis ${r.transporteur}` : 'Colis')}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>{[(r.titre && !sansLieu) ? r.lieu : '', (r.titre || r.lieu) ? r.transporteur : '', r.suivi && `n°${r.suivi}`, r.compte, delai].filter(Boolean).join(' · ')}</div>
        {!r.code && Array.isArray(r.desaccord) && r.desaccord.length > 1
          ? <div className="vrm-sensible" data-stream-type="code" data-hl-desaccord="" style={{marginTop:6,fontSize:13,fontWeight:700,color:C.warn}}>2 codes : {r.desaccord.map((d) => d.code).join(' / ')} — vérifie sur place</div>
          : r.code
          ? <div className="vrm-sensible" data-stream-type="code" data-hl-code={r.code} style={{display:'inline-block',marginTop:8,fontSize:20,fontWeight:800,letterSpacing:1.2,color:C.text,background:C.card2 || C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:'5px 12px'}}>{r.code}</div>
          : !r.qr && <div style={{marginTop:6,fontSize:12,color:C.muted}}>Code pas lu à {quand}.</div>}
        <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {(r.code || r.qr) && onEnGrand ? <Bouton variante="secondaire" className="vrm-b-petit" data-hl-en-grand-ouvrir="" onClick={() => onEnGrand(r)} aria-label="Afficher le code et le QR en grand">En grand</Bouton> : null}
          <GesteHorsLigne etat={etat} libelle={verifier ? "Je l'ai eu" : "J'ai retiré"} fait="Noté retiré" peut={!!(gestes && (r.cle || r.tx))}
            onOui={() => gestes.retirer(r, true)} onNon={() => gestes.retirer(r, false)} attrs={{ 'data-hl-retire-btn': '' }}/>
        </div>
      </div>
      <QrHorsLigne qr={r.qr} code={r.code}/>
    </div>
  );
}
// « En grand » SANS réseau (6 nov., v36) : la même feuille lumineuse qu'en ligne
// (classes `vrm-eg-*`, écran gardé allumé), nourrie par le dernier état — le QR
// vient de la réserve du service worker (`/hl-qr`) ou de la photo (`data:`) ;
// jamais un QR fabriqué. La date de l'état y est redite (on est au comptoir).
function EnGrandHorsLigne({ r, at, onClose }) {
  const [qrKo, setQrKo] = React.useState(false);
  const src = !r.qr ? '' : /^data:image\//i.test(r.qr) ? r.qr : adresseQrLocale(r.qr);
  const avecQr = !!src && !qrKo;
  const titre = r.titre || (r.transporteur ? `Colis ${r.transporteur}` : 'Colis');
  const j = r.limite ? joursAvantJour(r.limite) : null;
  const lim = j == null ? null : j < 0 ? 'Délai de retrait dépassé' : j === 0 ? 'Dernier jour pour le retirer' : j === 1 ? 'À retirer demain au plus tard'
    : `À retirer avant le ${new Date(r.limite + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return (
    <SheetShell lumineuse onClose={onClose} titre={titre} sousTitre={r.lieu || null} maxWidth={440} z={Z_CONFIRMATION - 3}
      className="vrm-eg" aria-label="Code et QR de retrait" data-hl-en-grand="" data-hl-en-grand-code-v={r.code || ''}>
      <GardeEcranAllume/>
      <div className="vrm-eg-corps">
        {avecQr ? <img className="vrm-eg-qr" data-hl-en-grand-qr="" src={src} alt="QR de retrait" onError={() => setQrKo(true)}/> : null}
        {src && qrKo ? <p className="vrm-eg-mode">QR pas gardé sur cet appareil{r.code ? ' — donne le code.' : '.'}</p> : null}
        {r.code ? <div className={'vrm-eg-code' + (avecQr ? ' avec-qr' : '')}><span className="vrm-eg-code-l">Code de retrait</span><span className="vrm-eg-code-v vrm-sensible" data-stream-type="code" data-hl-en-grand-code="">{r.code}</span></div> : null}
        {!r.code && !avecQr && r.suivi ? <div className="vrm-eg-code is-suivi"><span className="vrm-eg-code-l">Numéro de colis</span><span className="vrm-eg-code-v">{r.suivi}</span></div> : null}
        <ul className="vrm-eg-faits">
          {lim ? <li className={j <= 1 ? 'is-ambre' : ''}>{lim}</li> : null}
          {r.suivi && (r.code || avecQr) ? <li>{r.transporteur ? `${r.transporteur} · ` : ''}n° {r.suivi}</li> : null}
          {r.compte ? <li>{r.compte}</li> : null}
          <li data-hl-en-grand-date="">Hors connexion — dernier état du {quandEtat(at)}</li>
        </ul>
        {avecQr ? <p className="vrm-eg-note">Luminosité au maximum : le lecteur lit mal un écran sombre.</p> : null}
      </div>
    </SheetShell>
  );
}
// Ce qui ne part PAS en file : dit une fois, là où on le chercherait.
const RefusHorsLigne = () => <p data-hl-refuse="" style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:'-4px 2px 14px'}}>Bordereau, impression et réponses demandent le réseau. Un bordereau déjà ouvert se rouvre.</p>;
// (9 nov.) LES BORDEREAUX DÉJÀ OUVERTS, hors connexion (src/bordereauxHorsLigne.js) : pour
// chaque colis à déposer qui porte ses lignes de bordereau (son identité), le PDF gardé
// ici devient un vrai lien (un `<a>` : il s'ouvre aussi sur iPhone, sans fenêtre réservée).
// Pas gardé ⇒ dit, jamais un faux bouton. Rien n'est téléchargé.
function usePdfsHorsLigne(uid, lignes) {
  const [urls, setUrls] = React.useState({});
  const sig = (lignes || []).map((e) => (e && e.tx ? e.tx + ':' + (e.pdf || []).join(',') : '')).join('|');
  React.useEffect(() => {
    let vivant = true; const faites = [];
    (async () => {
      const out = {};
      for (const e of lignes || []) {
        if (!e || !e.tx || !Array.isArray(e.pdf) || !e.pdf.length) continue;
        const b = await lirePdfGarde(uid, e.pdf);
        if (b) { try { const u = URL.createObjectURL(b); faites.push(u); out[e.tx] = u; } catch (_) {} } else out[e.tx] = '';
      }
      if (vivant) setUrls(out); else faites.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} });
    })();
    return () => { vivant = false; setTimeout(() => faites.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} }), 60000); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sig]);
  return urls;
}
// ⟦← App.jsx #3⟧
function JourneeHorsLigne({ uid, tab }) {
  const [, tic] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const t = setInterval(tic, 60000); return () => clearInterval(t); }, []);
  const photo = React.useMemo(() => { try { return lirePhoto(uid, localStorage); } catch (_) { return null; } }, [uid]);
  const gestes = useGestesHorsLigne();
  const [enGrand, setEnGrand] = React.useState(null);
  // (10 nov., lots AU/AY) Le mode « dépôt » et le mode relais SANS réseau : la photo gardée sur CET appareil
  // pour CE compte (datée « vue à hh:mm »), les gestes de toujours (« Déposé » ⇒ file d'envoi).
  const [depotHL, setDepotHL] = React.useState(false);
  const [relaisHL, setRelaisHL] = React.useState(false);
  const colis = ONGLETS_COLIS_HL.includes(tab);
  const pdfs = usePdfsHorsLigne(uid, photo ? photo.envoyer : []);
  // (9 nov.) Le Stock hors connexion : l'inventaire contre la dernière liste gardée.
  if (tab === 'garage') return (
    <div data-hors-ligne="stock" style={{padding:'16px 14px 40px'}}>
      <h2 data-hl-titre="" style={{fontSize:22,fontWeight:700,color:C.text,margin:'4px 2px 12px',letterSpacing:-0.3}}>{tr('nav.garage')}</h2>
      <LigneHorsLigne>{tr('journee.horsConnexionInventaire')}</LigneHorsLigne>
      <BlocInventaireHorsLigne uid={uid}/>
    </div>
  );
  // L'en-tête dit déjà « Ma journée » quand c'est l'écran demandé ; sur un autre
  // onglet, le titre dit ce qu'on voit à la place (§7 : un titre par écran).
  const titre = tab === 'journee' ? null : <h2 data-hl-titre="" style={{fontSize:22,fontWeight:700,color:C.text,margin:'4px 2px 12px',letterSpacing:-0.3}}>{colis ? (tab === 'ventes' ? tr('historiqueSites.type.ventes') : tab === 'achats' ? tr('historiqueSites.type.achats') : 'Colis') : tr('reglages.ma-journee.lib')}</h2>;
  if (!photo) return (
    <div data-hors-ligne="sans-photo" style={{padding:'16px 14px 40px'}}>
      {titre}
      <LigneHorsLigne>{tr('journee.horsConnexionAucune')} {colis ? tr('journee.colis') : tr('journee.journee')} {tr('journee.iciFeraAvec')}</LigneHorsLigne>
      <BlocCodesHorsLigne/>
      {!colis ? <div style={{marginTop:12}}><BlocInventaireHorsLigne uid={uid}/></div> : null}
    </div>
  );
  const maintenant = Date.now();
  const quand = heurePhoto(photo.at, maintenant);
  const soir = listeDuSoir(photo, maintenant);
  const carte = { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'6px 14px', marginBottom:14 };
  const tete = (t, n) => <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.4,margin:'4px 2px 8px'}}>{t}{n != null ? ` · ${n}` : ''}</div>;
  const limiteTxt = (e) => {
    // (22 oct.) Une ligne qui porte sa limite exacte la dit comme Colis (l'heure
    // lue dans l'email, « en retard » passé l'heure) — `texteLimiteEnvoi`, §11.
    if (Number.isFinite(e.limiteAt) && e.jour) return texteLimiteEnvoi({ jour: e.jour, heure: e.heure || null, at: e.limiteAt, limite: e.estimee ? 'estimee' : 'email' }, maintenant) || '';
    const j = joursAvantJour(e.limite, maintenant);
    if (j == null) return '';
    if (j < 0) return 'date limite passée';
    if (j === 0) return "à poster aujourd'hui";
    if (j === 1) return 'à poster demain au plus tard';
    return 'à poster avant le ' + new Date(e.limite + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  };
  const colisDepotHL = colisDepotHorsLigne(photo);
  const etatDepotHL = (c) => { const ef = c && c.tx ? gestes.etatFait({ tx: c.tx }) : ''; return ef === 'attente' ? 'attente' : ef === 'note' ? 'fait' : ''; };
  const blocEnvoyer = (<>
    {tete(tr('journee.deposer'), photo.nEnvoyer)}
    {colisDepotHL.some((c) => c.peutFaire) ? <div className="vrm-pas-a-pas-rangee" data-depot-rangee="hors-ligne"><Bouton variante="secondaire" icone="scan" data-depot-ouvrir="hors-ligne" onClick={() => setDepotHL(true)} style={{ minHeight: 44 }}>{tr('journee.jeDepose')}</Bouton></div> : null}
    {depotHL ? <ModeDepot horsLigne vueA={photo.at} colis={colisDepotHL} etatDe={etatDepotHL}
      onDeposer={(c) => { if (c && c.tx && !etatDepotHL(c)) gestes.faire({ tx: c.tx }, true); }} onAnnuler={(c) => { if (c && c.tx) gestes.faire({ tx: c.tx }, false); }}
      onFermer={() => setDepotHL(false)} Retour={FermeAuRetour} Icon={Icon} zIndex={Z_CONFIRMATION - 4}/> : null}
    <div data-hl-envoyer={photo.nEnvoyer} style={carte}>
      {photo.envoyer.length === 0
        ? <div style={{fontSize:13,color:C.muted,padding:'10px 0'}}>{trj('journee.aucunColisEnvoyer3', { quand: quand })}</div>
        : photo.envoyer.map((e, i) => { const ef = gestes.etatFait(e); return (
          <div key={i} data-hl-colis="" data-hl-fait={ef || undefined} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:i ? `1px solid ${C.border}` : 'none',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.numero ? `N°${e.numero} · ` : ''}{e.titre || tr('journee.sansTitre')}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{[e.plateforme === 'ebay' ? 'eBay' : 'Vinted', e.compte, limiteTxt(e)].filter(Boolean).join(' · ')}</div>
            </div>
            {e.tx && Array.isArray(e.pdf) && e.pdf.length ? (pdfs[e.tx]
              ? <a className="vrm-b vrm-b-secondaire vrm-b-petit" data-hl-pdf={e.tx} href={pdfs[e.tx]} target="_blank" rel="noopener" download={`bordereau${e.numero ? '-N' + e.numero : ''}.pdf`} style={{flexShrink:0}}>{tr('journee.bordereau')}</a>
              : (pdfs[e.tx] === '' ? <span data-hl-pdf-absent={e.tx} style={{fontSize:12,color:C.muted,flexShrink:0}}>{tr('journee.bordereauGardeIci')}</span> : null)) : null}
            <GesteHorsLigne etat={ef} libelle="Déposé" fait="Noté déposé" peut={!!e.tx} onOui={() => gestes.faire(e, true)} onNon={() => gestes.faire(e, false)} attrs={{ 'data-hl-fait-btn': '' }}/>
            {!e.tx ? <span data-hl-sans-geste="" style={{flexBasis:'100%',fontSize:12,color:C.muted}}>{e.plateforme === 'ebay' ? tr('journee.ebayDepotSuit') : tr('journee.colisGardeSans')}</span> : null}
          </div>); })}
      {photo.nEnvoyer > photo.envoyer.length && <div style={{fontSize:12,color:C.muted,padding:'6px 0 10px'}}>{trj('annonces.autres2', { x: photo.nEnvoyer - photo.envoyer.length })}</div>}
    </div>
    <RefusHorsLigne/>
  </>);
  const ligneRet = (r, i, extra = {}) => <LigneRetraitHorsLigne key={i} r={r} i={i} quand={quand} maintenant={maintenant} gestes={gestes} onEnGrand={setEnGrand} {...extra}/>;
  const blocAVerifier = (photo.nAVerifier || 0) > 0 ? (<>
    {tete(tr('journee.verifier'), photo.nAVerifier)}
    <div data-hl-a-verifier={photo.nAVerifier} style={carte}>
      <div style={{fontSize:12,color:C.muted,padding:'8px 0 4px',lineHeight:1.45}}>{tr('journee.sansDoute')} {photo.nAVerifier > 1 ? 'repartis' : 'reparti'} {tr('journee.chezVendeurComptes')}{photo.aVerifier.length ? tr('journee.ceuxCiOnt', { n: String(photo.aVerifier.length) }) : ''}</div>
      {photo.aVerifier.map((r, i) => ligneRet(r, i + 1, { verifier: true }))}
    </div>
  </>) : null;
  const feuille = enGrand ? <EnGrandHorsLigne r={enGrand} at={photo.at} onClose={() => setEnGrand(null)}/> : null;
  // ── COLIS hors réseau : à retirer d'abord (on est au relais), une carte par
  //    point (son lieu), puis à vérifier, puis à envoyer.
  if (colis) {
    const points = pointsDeRetrait(photo.retirer);
    return (
      <div data-hors-ligne="colis" style={{padding:'16px 14px 40px'}}>
        {titre}
        <LigneEtatHorsLigne at={photo.at} maintenant={maintenant}/>
        {tete(tr('journee.retirer'), photo.nRetirer)}
        {photo.retirer.length ? <div className="vrm-pas-a-pas-rangee" data-relais-rangee="hors-ligne"><Bouton variante="secondaire" icone="qr" data-relais-ouvrir="photo" onClick={() => setRelaisHL(true)} style={{ minHeight: 44 }}>{tr('journee.modeRelais')}</Bouton></div> : null}
        {relaisHL ? <ModeRelais Photo={PhotoVinted} horsLigne vueA={photo.at} colis={photo.retirer.map((r, i) => ({ cle: 'hl:' + (r.id || r.cle || r.tx || i), ident: r.id || '', titre: r.titre || (r.transporteur ? tr('journee.colis2', { transporteur: String(r.transporteur) }) : 'Colis'), lieu: r.lieu || '', code: r.code || '',
            desaccord: r.desaccord || null, suivi: r.suivi || '', qr: /^data:image\//i.test(String(r.qr || '')) ? r.qr : '', sansQrHorsLigne: !!r.qr && !/^data:image\//i.test(String(r.qr || '')) }))}
          note={`Aucun colis à retirer à ${quand}.`} onFermer={() => setRelaisHL(false)} Retour={FermeAuRetour} Icon={Icon} zIndex={Z_CONFIRMATION - 4}/> : null}
        <div data-hl-retirer={photo.nRetirer}>
          {points.length === 0
            ? <div style={{...carte,fontSize:13,color:C.muted,padding:'12px 14px'}}>{trj('journee.aucunColisRetirer3', { quand: quand })}</div>
            : points.map((p, k) => (
              <div key={p.cle} data-hl-point={p.lieu || p.nom} style={carte}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0 4px'}}>
                  <span aria-hidden="true" style={{display:'flex',color:C.muted}}><Icon name="pin" size={15}/></span>
                  <span style={{fontSize:14,fontWeight:700,color:C.text,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nom}</span>
                  <span style={{marginLeft:'auto',fontSize:12,color:C.muted,flexShrink:0}}>{trj('journee.colis4', { x: p.colis.length })}</span>
                </div>
                {p.colis.map((r, i) => ligneRet(r, i + 1, { sansLieu: !!p.lieu }))}
              </div>))}
          {photo.nRetirer > photo.retirer.length && <div style={{fontSize:12,color:C.muted,padding:'0 2px 12px'}}>{trj('annonces.autres2', { x: photo.nRetirer - photo.retirer.length })}</div>}
        </div>
        {blocAVerifier}
        {blocEnvoyer}
        {feuille}
      </div>
    );
  }
  return (
    <div data-hors-ligne="photo" style={{padding:'16px 14px 40px'}}>
      {titre}
      <LigneEtatHorsLigne at={photo.at} maintenant={maintenant}/>
      {soir && soir.n > 0 && (
        <div data-hl-soir="" data-hl-soir-n={soir.n} data-hl-soir-retard={soir.enRetard} data-hl-soir-verif={soir.aVerifier} data-hl-soir-demain={soir.demain} style={{...carte,padding:'12px 14px'}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.4,marginBottom:4}}>{tr('journee.listeSoir')}</div>
          <div style={{fontSize:15,color:C.text,lineHeight:1.45}}>
            {tr('journee.demain')} <b>{trj('journee.colis4', { x: soir.n })}</b> {tr('journee.poster')}{soir.enRetard || soir.aVerifier || soir.demain ? ' — ' : ''}
            {[soir.enRetard ? `${soir.enRetard} déjà en retard` : '', soir.aVerifier ? `${soir.aVerifier} à vérifier sur Vinted (date estimée passée)` : '',
              soir.demain ? `${soir.demain} avec la date limite demain` : ''].filter(Boolean).join(', ')}.
          </div>
        </div>
      )}
      {photo.nePasPoster > 0 && (
        <div data-hl-ne-pas-poster={photo.nePasPoster} style={{...carte,padding:'12px 14px',borderColor:`${C.warn}88`}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>{tr('journee.poste')} {photo.nePasPoster > 1 ? tr('journee.cesColisEbay', { nePasPoster: String(photo.nePasPoster) }) : tr('journee.colisEbay')}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{tr('journee.acheteurDemandeAnnulation')}</div>
        </div>
      )}
      {blocEnvoyer}
      {tete(tr('journee.retirer'), photo.nRetirer)}
      {/* (revue du 23 oct.) Les mêmes colis que la tuile « À retirer » en ligne ;
          la date limite LUE (et elle seule) est dite. Les colis « à vérifier »
          ont leur bloc, en dessous, avec leur raison. */}
      <div data-hl-retirer={photo.nRetirer} style={carte}>
        {photo.retirer.length === 0
          ? <div style={{fontSize:13,color:C.muted,padding:'10px 0'}}>{trj('journee.aucunColisRetirer3', { quand: quand })}</div>
          : photo.retirer.map((r, i) => ligneRet(r, i))}
        {photo.nRetirer > photo.retirer.length && <div style={{fontSize:12,color:C.muted,padding:'6px 0 10px'}}>{trj('annonces.autres2', { x: photo.nRetirer - photo.retirer.length })}</div>}
      </div>
      {blocAVerifier}
      <BlocInventaireHorsLigne uid={uid}/>
      {feuille}
    </div>
  );
}
export { JourneeHorsLigne };
