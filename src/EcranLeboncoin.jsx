// ════════════════════════════════════════════════════════════════════════════
// Découpé d'App.jsx (29 octobre) : LeboncoinScreen et ce qu'eux SEULS utilisent,
// chargés à l'ouverture de l'écran (React.lazy) au lieu du démarrage de l'app.
// Le code n'a pas changé ; ce qu'il partage avec le reste vient d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════
import AnnoncesLeboncoin from "./AnnoncesLeboncoin.jsx";
import { suivreReceptionLeboncoin, lireReceptionLeboncoin } from "./rafraichissementLeboncoin.js";
import React, { useState, useEffect, useRef } from "react";
import { AUTH, C, EXT_ATTENDUE, EXT_CAPACITES, INV_STATUS, Icon, LBC_DESC_MAX, LBC_ETATS, LBC_PHOTOS_MAX, LBC_TITRE_MAX, LignePanne, LigneRelais, NUM_OK, PhotoVinted, Pourquoi, SUPABASE_URL, SheetShell, __vmrEtat, __vmrJobs, __vmrNotifier, annonceLbcEnVente, annoncesLbcVendues, askConfirm, categorieLbcDe, cleNum, clesAnnonceLbc, commandeEbayEngagee, comptesLbcProuves, comptesLbcSession, descriptionLbcDe, doublesVenteLbc, extSait, extractBrand, jumellesParPhoto, lbcDescription, lbcEuro, lbcSortieDe, lbcTitre, libelleRelais, lireEbayTous, lireLignesEnLigne, lirePreuvesVenteVinted, load, mpChoisi, numDeTitreLbc, numLigneEbay, numeroLbcIdentite, numerosLbcSortis, onVmrExt, raisonExtGlobale, refLbcPresente, relaisVivant, save, sbAuth, toast, triNum, useExtVivante, useSansSouris, useVoixExt, valideAnnonceLbc, vmrCmd, vmrExtPresent, vmrExtVersion } from "./App.jsx";


const texteCroitVendue = () => `Ton extension le croit encore vendu (elle ne sait pas qu'une vente remboursée fait revenir l'article) et refuserait de le publier : mets-la à jour (${EXT_ATTENDUE}).`;

const RAISON_ABANDON = { 'onglet-ferme': "l'onglet Leboncoin a été fermé avant que VRM voie la fin", 'onglet-quitte': "l'onglet du dépôt est parti sur une autre page avant que VRM voie la fin", arret: "le remplissage s'est arrêté avant la fin (Leboncoin a peut-être demandé autre chose)", 'bandeau-ferme': 'tu as fermé le bandeau VRM sur Leboncoin avant la fin' };
function BoutonPublier({ place, id, croitVendue, photos = null, total = null, onFiche = null }) {
  const { jobs } = useExtVivante();
  const sansSouris = useSansSouris();
  const [refus, setRefus] = React.useState(null);
  const [envoi, setEnvoi] = React.useState(false);
  const lbc = place === 'lbc';
  const jobId = (lbc ? 'lbc:' : 'ebay:') + id;
  const job = jobs[jobId] || null;
  const glob = raisonExtGlobale(sansSouris, { cap: lbc ? 'publication' : 'publication-ebay', role: 'publie tes annonces' })
    || (croitVendue && extSait('preuves') === 'retard' ? { code: 'croit-vendue', texte: texteCroitVendue() } : null);
  const fait = job && job.etape === 'fait';
  const enCours = job && job.etape === 'depot' && (Date.now() - Number(job.at || 0) < 15 * 60000);
  const abandonne = job && job.etape === 'abandonne';
  const lancer = async () => {
    if (envoi) return;                       // la demande précédente est en vol : son résultat arrive
    // 5.182 : sur Leboncoin, le bouton OUVRE LA FICHE (voir `FicheLbc`) — c'est
    // elle qui montre ce qui partira, laisse corriger, puis publie (les gardes y
    // vivent aussi). Grisé ou déjà publiée : on le dit ici, comme avant — une
    // fiche qu'on ne pourrait pas publier ne s'ouvre pas pour rien.
    if (lbc && onFiche && !glob && !fait) { setRefus(null); onFiche(); return; }
    // ⚠️ Un clic refusé dit TOUJOURS pourquoi (11 octobre) : avant, ces trois
    //    cas faisaient `return` en silence — « je ne peux pas poster ».
    if (glob) { setRefus(glob.texte); return; }
    if (fait) { setRefus(lbc ? 'Déjà publiée sur Leboncoin depuis VRM — rien à refaire.' : 'Déjà préparée sur eBay.'); return; }
    // Un dépôt abandonné a pu être FINI À LA MAIN : relancer publierait la
    // paire une seconde fois. On demande d'abord — ici si l'app le sait déjà,
    // sinon quand l'extension le découvre (onglet parti ailleurs : `confirmer`).
    const demander = () => askConfirm({ title: 'Relancer le dépôt sur Leboncoin ?',
      desc: "VRM n'a pas vu la fin du dépôt précédent. Si tu l'as publiée toi-même sur Leboncoin, annule et clique « Déjà publiée » : un nouveau dépôt la publierait une seconde fois. Sinon, relance.",
      ok: 'Relancer le dépôt', cancel: 'Annuler' });
    let confirme = false;
    if (lbc && abandonne) { if (!(await demander())) return; confirme = true; }
    setRefus(null); setEnvoi(true);
    const envoyer = (c) => vmrCmd(Object.assign({ cmd: lbc ? 'lbcPublier' : 'ebayPreparer', id: String(id) }, c ? { confirme: true } : {}), 30000);
    let r = await envoyer(confirme);
    if (r && !r.accepte && r.code === 'confirmer' && !confirme) {
      __vmrJobs[jobId] = Object.assign({}, __vmrJobs[jobId] || {}, { etape: 'abandonne', raison: 'onglet-quitte', at: Date.now() }); __vmrNotifier();
      setEnvoi(false);
      if (!(await demander())) return;
      setEnvoi(true);
      r = await envoyer(true);
    }
    setEnvoi(false);
    if (!r) { setRefus("L'extension n'a pas répondu — recharge cette page et réessaie."); return; }
    if (!r.accepte) { setRefus(r.raison || "Refusé par l'extension."); return; }
    __vmrJobs[r.jobId] = { etape: r.etape, at: Date.now() };
    __vmrNotifier();
  };
  const libelle = job && libelleRelais(job.etape) ? libelleRelais(job.etape) : envoi ? 'Envoi…' : fait ? (lbc ? 'Publiée ✓' : 'Préparée ✓')
    : enCours ? (lbc ? 'Publication en cours…' : 'Formulaire eBay ouvert')
    : abandonne ? 'Réessayer'
    : (lbc ? 'Publier sur Leboncoin' : 'Préparer sur eBay');
  const grise = !!glob || fait;
  const nPh = Number.isFinite(Number(photos)) && photos != null ? Number(photos) : null;
  const nTot = Number.isFinite(Number(total)) && total != null && Number(total) >= (nPh || 0) ? Number(total) : null;
  const textePhotos = nPh == null ? '' : nTot != null && nTot > nPh ? `${nPh} photo${nPh > 1 ? 's' : ''} sur ${nTot}` : `${nPh} photo${nPh > 1 ? 's' : ''}`;
  const etat = glob ? 'grise' : fait ? 'fait' : enCours ? 'encours' : abandonne ? 'abandonne' : 'pret';
  return (
    <span data-bouton-publier={etat} data-id={id} data-photos={nPh == null ? undefined : nPh} data-photos-total={nTot == null ? undefined : nTot}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, maxWidth: '100%' }}>
      {abandonne && <span data-depot-abandonne={job.raison || ''} style={{ fontSize: 11, color: C.warn, lineHeight: 1.35, whiteSpace: 'normal', fontWeight: 600 }}>{RAISON_ABANDON[job.raison] ? RAISON_ABANDON[job.raison].charAt(0).toUpperCase() + RAISON_ABANDON[job.raison].slice(1) : "VRM n'a pas vu la fin du dépôt"}. {lbc ? 'Si tu l’as publiée toi-même, clique « Déjà publiée » ; sinon Réessayer.' : 'Si tu l’as mise en vente toi-même, rien à refaire ; sinon Réessayer.'}</span>}
      <button type="button" onClick={lancer} aria-disabled={grise ? 'true' : undefined}
        title={glob ? glob.texte : enCours ? (lbc ? 'Le dépôt est ouvert dans un onglet Leboncoin — clique pour y retourner' : 'Le formulaire eBay est ouvert — clique pour y retourner') : lbc ? "L'extension ouvre Leboncoin, remplit tout (photos, titre, description, prix, catégorie) et publie sans option payante" : "L'extension ouvre la mise en vente eBay et remplit ce qu'elle reconnaît — tu relis et tu mets en vente"}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5,
          padding: '7px 11px', whiteSpace: 'nowrap', cursor: grise ? 'not-allowed' : 'pointer',
          border: `1px solid ${glob ? C.border : C.accent}`, background: glob ? 'transparent' : (fait ? 'transparent' : `${C.accent}14`),
          color: glob ? C.muted : C.accent, opacity: glob ? 0.55 : 1, filter: glob ? 'grayscale(1)' : 'none' }}>
        {libelle}
        {textePhotos && !fait ? <span data-photos-bouton="" style={{ fontWeight: 500, fontSize: 11.5, color: glob ? C.muted : C.text, opacity: 0.8 }}>· {textePhotos}</span> : null}
      </button>
      {refus && <span data-refus-publier="" style={{ fontSize: 11, color: C.warn, lineHeight: 1.35, whiteSpace: 'normal' }}>{refus}</span>}
    </span>
  );
}

const ETAPES_FICHE_LBC = [
  ['ouverture', 'Dépôt ouvert sur Leboncoin'],
  ['remplissage', 'Titre, description, prix'],
  ['photos', 'Photos'],
  ['publication', 'Publication, sans option payante'],
];
const RANG_PROGRES_LBC = { ouverture: 0, remplissage: 1, 'champ-manquant': 1, photos: 2, etapes: 2, publication: 3, 'publication-refusee': 3 };
function defautsFicheLbc(q) {
  const etat = String(q.etat || '').trim();
  return {
    title: q.title || '',
    price: q.prix != null && isFinite(Number(q.prix)) ? Number(q.prix).toFixed(2).replace('.', ',') : '',
    etat,
    description: descriptionLbcDe({ ref: 'VRM-' + q.numero, texte: q.texte, base: q.base || q.vinted, marque: q.marque, taille: q.taille, etat, couleur: q.couleur }),
    photos: Array.isArray(q.photosAll) ? q.photosAll.slice(0, LBC_PHOTOS_MAX) : [],
  };
}
function FicheLbc({ q, compteLbc, onClose, onMarquer }) {
  const { jobs } = useExtVivante();
  const sansSouris = useSansSouris();
  const jobId = 'lbc:' + q.id;
  const job = jobs[jobId] || null;
  const defauts = React.useMemo(() => defautsFicheLbc(q), [q]);
  const [titre, setTitre] = React.useState(defauts.title);
  const [prix, setPrix] = React.useState(defauts.price);
  const [etat, setEtat] = React.useState(defauts.etat);
  const [desc, setDesc] = React.useState(defauts.description);
  const [photos, setPhotos] = React.useState(defauts.photos);
  const [envoi, setEnvoi] = React.useState(false);
  const [refus, setRefus] = React.useState(null);
  const [aConfirmer, setAConfirmer] = React.useState(false);
  const toutes = Array.isArray(q.photosAll) ? q.photosAll : [];
  const ref = 'VRM-' + q.numero;
  const saisie = { title: titre, description: desc, price: prix, etat, photos };
  const v = valideAnnonceLbc(saisie, { ref, photos: toutes, etat: q.etat });
  const errDe = (champ) => (!v.ok && v.erreurs.find((e) => e.champ === champ)) || null;
  const corrigee = titre !== defauts.title || desc !== defauts.description || prix !== defauts.price || etat !== defauts.etat
    || photos.length !== defauts.photos.length || photos.some((u, i) => u !== defauts.photos[i]);
  // 5.183 : par le relais, c'est l'extension de l'ORDINATEUR qui reçoit la fiche (≥ 5.183 ⇒ elle la sait).
  const saitFiche = relaisVivant() ? 'ok' : extSait('lbcfiche');
  const glob = raisonExtGlobale(sansSouris, { cap: 'publication', role: 'publie tes annonces' })
    || (q.croitVendue && extSait('preuves') === 'retard' ? { code: 'croit-vendue', texte: texteCroitVendue() } : null);
  const fait = !!(job && job.etape === 'fait');
  const enCours = !!(job && job.etape === 'depot' && (Date.now() - Number(job.at || 0) < 15 * 60000));
  const abandonne = !!(job && job.etape === 'abandonne');
  const progres = (job && job.progres) || null;
  // Ce qui empêche de publier, une seule raison à la fois (la plus en amont).
  const bloque = fait ? null
    : glob ? { code: glob.code, texte: glob.texte }
    : (corrigee && saitFiche !== 'ok') ? { code: 'fiche-retard', texte: `Tes corrections ne partiraient pas : ton extension (${vmrExtVersion() || 'version ?'}) ne sait pas encore recevoir la fiche de VRM. Mets-la à jour (${EXT_CAPACITES.lbcfiche}), ou publie la version d'origine.` }
    // La fiche n'est jugée que si elle PART : une extension plus ancienne publie
    // sa propre version (l'identifiant seul), la fiche ne la contraint pas.
    : (!v.ok && saitFiche === 'ok') ? { code: 'fiche', texte: 'À corriger : ' + v.erreurs[0].raison + '.' }
    : null;
  const envoyer = (confirme) => vmrCmd(Object.assign({ cmd: 'lbcPublier', id: String(q.id) },
    saitFiche === 'ok' ? { annonce: v.annonce } : {}, confirme ? { confirme: true } : {}), 30000);
  const publier = async (confirme) => {
    if (envoi || fait) return;
    if (bloque && !enCours) { setRefus(bloque.texte); return; }
    if (abandonne && !confirme) { setAConfirmer(true); return; }
    setRefus(null); setAConfirmer(false); setEnvoi(true);
    let r = await envoyer(!!confirme);
    setEnvoi(false);
    if (r && !r.accepte && r.code === 'confirmer') {
      __vmrJobs[jobId] = Object.assign({}, __vmrJobs[jobId] || {}, { etape: 'abandonne', raison: 'onglet-quitte', at: Date.now() }); __vmrNotifier();
      setAConfirmer(true); return;
    }
    if (!r) { setRefus("L'extension n'a pas répondu — recharge cette page et réessaie."); return; }
    if (!r.accepte) { setRefus(r.raison ? (r.raison.charAt(0).toUpperCase() + r.raison.slice(1) + '.') : "Refusé par l'extension."); return; }
    __vmrJobs[r.jobId] = Object.assign({}, __vmrJobs[r.jobId] || {}, { etape: r.etape, at: Date.now() });
    __vmrNotifier();
  };
  const basculerPhoto = (u) => setPhotos((l) => (l.includes(u) ? l.filter((x) => x !== u) : (l.length >= LBC_PHOTOS_MAX ? l : [...l, u])));
  const categorie = categorieLbcDe(titre, desc, q.taille);
  const etatsProposes = [...LBC_ETATS];
  if (q.etat && !etatsProposes.includes(q.etat)) etatsProposes.push(q.etat);
  const champ = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 12px', fontSize: 16, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit' };
  const Etiquette = ({ children, droite, err }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, margin: '14px 0 6px' }}>
      <span className="vrm-label" style={{ fontSize: 12, fontWeight: 700, color: err ? C.warn : C.muted, letterSpacing: '.02em' }}>{children}</span>
      {droite != null && <span style={{ fontSize: 11.5, color: err ? C.warn : C.muted, fontVariantNumeric: 'tabular-nums' }}>{droite}</span>}
    </div>
  );
  // L'étape où en est le dépôt : -1 avant le clic, puis 0 à 3 ; 4 = publiée.
  const rang = fait ? 4 : progres ? (RANG_PROGRES_LBC[progres.etape] != null ? RANG_PROGRES_LBC[progres.etape] : 1) : (enCours ? 0 : -1);
  const ph = progres && progres.photos;
  const textePhotosProgres = ph && ph.total != null
    ? (ph.confirmees != null ? `${ph.confirmees}/${ph.total} confirmées` : `${ph.posees || 0}/${ph.total} envoyées — vérifie sur la page qu'elles y sont toutes`) + (ph.rates ? ` · ${ph.rates} illisible${ph.rates > 1 ? 's' : ''}` : '')
    : `${photos.length} à poser`;
  const etatFiche = fait ? 'publiee' : abandonne ? 'abandonne' : enCours ? 'encours' : bloque ? 'bloque' : 'pret';
  const libelle = envoi ? 'Envoi…' : fait ? 'Publiée sur Leboncoin ✓' : enCours ? 'Remettre le dépôt devant' : abandonne ? 'Relancer le dépôt' : 'Publier sur Leboncoin';
  const grise = !!bloque && !enCours;
  // Le dépôt démarre : on remonte la fiche jusqu'à l'avancement (le bouton est
  // en bas, l'avancement en haut — sinon on publie sans rien voir bouger).
  const refProgres = React.useRef(null);
  const actif = rang >= 0 || abandonne;
  React.useEffect(() => { if (actif && refProgres.current && refProgres.current.scrollIntoView) { try { refProgres.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} } }, [actif]);
  return (
    <SheetShell onClose={onClose} maxWidth={560}>
      <div data-fiche-lbc={q.id} data-fiche-etat={etatFiche} data-fiche-corrigee={corrigee ? '1' : '0'}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {photos[0]
            ? <PhotoVinted src={photos[0]} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: C.card2 || C.border }}/>
            : <span style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: C.card2 || C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={22} style={{ color: C.muted, opacity: .55 }}/></span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>Publier sur Leboncoin</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              N°{q.numero}{q.compte ? ` · depuis ${q.compte}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ flexShrink: 0, width: 34, height: 34, minHeight: 0, borderRadius: 999, border: 'none', background: C.card2 || C.card, color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* L'avancement EN HAUT : c'est ce qu'on regarde une fois le dépôt lancé. */}
        {(rang >= 0 || abandonne) && (
          <div ref={refProgres} data-fiche-progres={fait ? 'publiee' : abandonne ? 'abandonne' : (progres ? progres.etape : 'ouverture')} style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '10px 12px', scrollMarginTop: 12 }}>
            {ETAPES_FICHE_LBC.map(([k, lib], i) => {
              const fini = rang > i; const ici = rang === i && !abandonne;
              return (
                <div key={k} data-fiche-etape={k} data-fini={fini ? '1' : '0'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, color: fini || ici ? C.text : C.muted }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                    background: fini ? C.accent : 'transparent', color: fini ? '#fff' : C.muted, border: fini ? 'none' : `1.5px solid ${ici ? C.accent : C.border}` }}>{fini ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: ici ? 700 : 500 }}>{lib}</span>
                  {k === 'photos' && (ph || (rang >= 2 && !fait)) && <span data-fiche-photos-progres="" style={{ fontSize: 11.5, color: C.muted, textAlign: 'right' }}>{textePhotosProgres}</span>}
                </div>
              );
            })}
            {fait && <div data-fiche-fin="publiee" style={{ fontSize: 12.5, color: C.text, marginTop: 6, lineHeight: 1.45 }}>Publiée sans option payante — l'article est maintenant marqué <b>« sur Leboncoin »</b> dans VRM.</div>}
            {!fait && progres && progres.etape === 'champ-manquant' && (
              <div data-fiche-manque={(progres.manque || []).join('|')} style={{ fontSize: 12.5, color: C.warn, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>
                {(progres.manque && progres.manque.length) ? `${progres.manque.map((m) => `« ${m} »`).join(', ')} ${progres.manque.length > 1 ? 'restent' : 'reste'} à choisir` : 'Un champ obligatoire reste à choisir'} sur la page Leboncoin : fais-le, VRM continue tout seul.
              </div>
            )}
            {!fait && progres && progres.etape === 'publication-refusee' && (
              <div data-fiche-fin="refusee" style={{ fontSize: 12.5, color: C.warn, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>VRM n'a pas publié — {progres.raison || 'à faire sur la page'}.</div>
            )}
            {abandonne && (
              <div data-fiche-fin="abandonne" style={{ fontSize: 12.5, color: C.warn, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>
                {RAISON_ABANDON[job.raison] ? RAISON_ABANDON[job.raison].charAt(0).toUpperCase() + RAISON_ABANDON[job.raison].slice(1) : "VRM n'a pas vu la fin du dépôt"}. Si tu l'as publiée toi-même, choisis « Déjà publiée » ; sinon relance.
              </div>
            )}
          </div>
        )}

        <Etiquette droite={`${titre.replace(/\s+/g, ' ').trim().length}/${LBC_TITRE_MAX}`} err={errDe('title')}>Titre</Etiquette>
        <input data-fiche-champ="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80} disabled={enCours || fait}
          style={{ ...champ, borderColor: errDe('title') ? C.warn : C.border }}/>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <Etiquette err={errDe('price')}>Prix</Etiquette>
            <div style={{ position: 'relative' }}>
              <input data-fiche-champ="prix" value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="decimal" disabled={enCours || fait}
                style={{ ...champ, paddingRight: 30, borderColor: errDe('price') ? C.warn : C.border }}/>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 15, pointerEvents: 'none' }}>€</span>
            </div>
          </div>
          <div style={{ flex: '1.3 1 0', minWidth: 0 }}>
            <Etiquette err={errDe('etat')}>État</Etiquette>
            <select data-fiche-champ="etat" value={etat} onChange={(e) => setEtat(e.target.value)} disabled={enCours || fait}
              style={{ ...champ, appearance: 'auto', paddingRight: 8 }}>
              <option value="">Laisser Leboncoin le demander</option>
              {etatsProposes.map((x) => <option key={x} value={x}>{LBC_ETATS.includes(x) ? x : `${x} (état Vinted)`}</option>)}
            </select>
          </div>
        </div>
        {etat && !LBC_ETATS.includes(etat) && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.4 }}>« {etat} » n'est pas un libellé de Leboncoin : l'état restera à choisir sur la page.</div>}

        <Etiquette droite={`${photos.length} sur ${toutes.length}${q.nReelles != null && q.nReelles > toutes.length ? ` captées (${q.nReelles} sur Vinted)` : ''}`} err={errDe('photos')}>Photos</Etiquette>
        <div className="vrm-aide" style={{ fontSize: 11.5, color: C.muted, marginTop: -2, marginBottom: 8, lineHeight: 1.4 }}>Touche-les dans l'ordre voulu — la n°1 est la couverture.</div>
        <div data-fiche-photos={photos.length} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
          {toutes.map((u) => {
            const i = photos.indexOf(u);
            const pris = i >= 0;
            return (
              <button type="button" key={u} data-fiche-photo={pris ? i + 1 : 0} onClick={() => !(enCours || fait) && basculerPhoto(u)} aria-pressed={pris}
                style={{ position: 'relative', padding: 0, minHeight: 0, aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', cursor: enCours || fait ? 'default' : 'pointer',
                  border: pris ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: C.card2 || C.card }}>
                <PhotoVinted src={u} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: pris ? 1 : 0.38, transition: 'opacity .15s ease' }}/>
                {pris && <span style={{ position: 'absolute', top: 5, left: 5, minWidth: 20, height: 20, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: C.accent, color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>}
                {i === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 0', textAlign: 'center' }}>Couverture</span>}
              </button>
            );
          })}
        </div>
        {toutes.length === 0 && <div style={{ fontSize: 12, color: C.warn, lineHeight: 1.45 }}>Aucune photo captée pour cette annonce : ouvre-la sur Vinted, l'extension lit ses photos au passage. Leboncoin refuse une annonce sans photo.</div>}

        <Etiquette droite={`${desc.length}/${LBC_DESC_MAX}`} err={errDe('description')}>Description</Etiquette>
        <textarea data-fiche-champ="description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={7} disabled={enCours || fait}
          style={{ ...champ, resize: 'vertical', lineHeight: 1.45, fontSize: 15, borderColor: errDe('description') ? C.warn : C.border }}/>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.4 }}>
          La référence <b style={{ color: C.text }}>{ref}</b> reste dans la description : c'est elle qui relie l'annonce Leboncoin à cet article{refLbcPresente(desc, ref) ? '.' : ' — si tu l\'enlèves, elle est remise à la fin.'}
        </div>

        <div data-fiche-infos="" style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '4px 12px' }}>
          {[
            ['Catégorie', categorie || 'Leboncoin la propose (il la devine du titre)'],
            ['Compte Leboncoin', `celui ouvert dans ce Chrome${compteLbc && compteLbc.name ? ` (connecté en dernier : ${compteLbc.name}${compteLbc.type === 'pro' ? ', pro' : compteLbc.type === 'particulier' ? ', particulier' : ''})` : ''}`],
            ['Options payantes', 'aucune — VRM publie sans booster'],
          ].map(([k, val], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
              <span style={{ color: C.muted, flexShrink: 0 }}>{k}</span>
              <span data-fiche-info={k} style={{ color: C.text, textAlign: 'right', minWidth: 0 }}>{val}</span>
            </div>
          ))}
        </div>

        {aConfirmer && (
          <div data-fiche-confirmer="" style={{ marginTop: 14, border: `1px solid ${C.warn}`, borderRadius: 12, padding: '11px 12px', background: C.card }}>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}><b>Relancer le dépôt ?</b> VRM n'a pas vu la fin du précédent. Si tu l'as publiée toi-même sur Leboncoin, un nouveau dépôt la publierait une seconde fois.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" data-fiche-relancer="" onClick={() => publier(true)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Relancer le dépôt</button>
              <button type="button" onClick={() => setAConfirmer(false)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{ position: 'sticky', bottom: 'calc(-18px - env(safe-area-inset-bottom))', background: C.bg, margin: '14px -18px 0', padding: '12px 18px calc(20px + env(safe-area-inset-bottom))', borderTop: `1px solid ${C.border}` }}>
          {(bloque && !fait && !enCours) && <div data-fiche-bloque={bloque.code} style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, marginBottom: 8 }}>{bloque.texte}</div>}
          {!bloque && !fait && !enCours && saitFiche !== 'ok' && <div data-fiche-version="" style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, marginBottom: 8 }}>Ton extension ({vmrExtVersion() || 'version ?'}) publiera sa propre version de l'annonce : pour envoyer cette fiche, mets-la à jour ({EXT_CAPACITES.lbcfiche}).</div>}
          {refus && <div data-fiche-refus="" style={{ fontSize: 12, color: C.warn, lineHeight: 1.45, marginBottom: 8, fontWeight: 600 }}>{refus}</div>}
          <button type="button" data-fiche-publier={grise ? 'grise' : etatFiche} onClick={() => publier(false)} aria-disabled={grise || fait ? 'true' : undefined}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: grise || fait ? 'default' : 'pointer',
              background: grise ? (C.card2 || C.border) : fait ? 'transparent' : C.accent, color: grise ? C.muted : fait ? C.accent : '#fff',
              boxShadow: grise || fait ? 'none' : C.shadow, opacity: envoi ? 0.75 : 1 }}>
            {libelle}
          </button>
          {!fait && (
            <button type="button" data-fiche-deja="" onClick={() => { onMarquer(q.id); onClose(); }}
              style={{ display: 'block', margin: '8px auto 0', border: 'none', background: 'transparent', minHeight: 0, padding: '6px 8px', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Déjà publiée sur Leboncoin</button>
          )}
        </div>
      </div>
    </SheetShell>
  );
}
function LbcCroitVendue({ n }) {
  useExtVivante();
  if (!n || extSait('preuves') !== 'retard') return null;
  return (
    <div data-lbc-croit-vendue={n} style={{ fontSize: 12.5, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn}`, borderRadius: 10, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
      <b>{n} article{n > 1 ? 's' : ''} revenu{n > 1 ? 's' : ''}</b> (vente remboursée ou annulée) : de nouveau à publier pour VRM, mais ton extension {n > 1 ? 'les croit encore vendus' : 'le croit encore vendu'} et refuserait de {n > 1 ? 'les' : 'le'} publier — mets-la à jour ({EXT_ATTENDUE}).
    </div>
  );
}
function RaisonPublication({ n, place }) {
  const sansSouris = useSansSouris();
  useExtVivante();
  const r = raisonExtGlobale(sansSouris, { cap: place === 'lbc' ? 'publication' : 'publication-ebay', role: 'publie tes annonces' });
  useVoixExt(r && n ? r.code : null);
  if (!r && n && place === 'lbc' && relaisVivant()) return <LigneRelais quoi="Publier sur Leboncoin :"/>;
  if (!r || !n) return null;
  return (
    <div data-raison-publier={r.code} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.text, background: C.card,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn}`, borderRadius: 10, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
      <span><b>Publier sur {place === 'lbc' ? 'Leboncoin' : 'eBay'}</b> — {r.texte}</span>
    </div>
  );
}

async function commandesEbayTous() {
  const r = await lireEbayTous('ebay_orders', 'orders:data->orders', 'orders');
  return (!r || r.illisibles.length) ? null : r.items;
}

function relierAnnonceLbc(id, n) {
  const liens = { ...(load('vrm_lbc_liens', {}) || {}), [String(id)]: String(n) };
  // ⚠️ `save` écrit 500 ms plus tard : l'écran se rechargeait AVANT et ne
  //    voyait pas le lien (vu au banc). On pose la copie locale tout de
  //    suite ; `save` garde la synchro vers le nuage.
  try { localStorage.setItem('vrm_lbc_liens', JSON.stringify(liens)); } catch (_) {}
  save('vrm_lbc_liens', liens);
}

function delierAnnonceLbc(id) {
  if (id == null) return;
  const liens = { ...(load('vrm_lbc_liens', {}) || {}), [String(id)]: '' };
  try { localStorage.setItem('vrm_lbc_liens', JSON.stringify(liens)); } catch (_) {}
  save('vrm_lbc_liens', liens);
}

function rangerSansJumelleLbc(cle) {
  if (!cle) return;
  const m = { ...(load('vrm_lbc_pas_de_paire', {}) || {}), [String(cle)]: new Date().toISOString() };
  try { localStorage.setItem('vrm_lbc_pas_de_paire', JSON.stringify(m)); } catch (_) {}
  save('vrm_lbc_pas_de_paire', m);
}

const motsDeTitre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9,.]+/g, ' ').split(' ').filter((w) => w.length >= 2 && !/^(taille|pointure|neuf|neuve|tres|bon|etat|avec|pour|les|des|une|homme|femme|paire)$/.test(w));

const pointureDe = (s) => {
  const t = String(s || '');
  const m = /(?:taille|pointure|\bt|\bp)\s*(\d{2}(?:[.,]5)?)(?!\d)/i.exec(t);
  if (m) return m[1].replace(',', '.');
  const tous = [...t.matchAll(/(?:^|[^\d])(\d{2}(?:[.,]5)?)(?=[^\d]|$)/g)].map((x) => x[1].replace(',', '.')).filter((x) => { const n = parseFloat(x); return n >= 16 && n <= 50; });
  return tous.length ? tous[tous.length - 1] : null;
};

const familleMarque = (t) => { const b = extractBrand(String(t || '')); return b ? (/jordan/i.test(b) ? 'nike' : b.toLowerCase()) : null; };
const MOTS_HORS_MODELE = new Set(['nike', 'adidas', 'air', 'new', 'balance', 'asics', 'puma', 'reebok', 'vans', 'converse', 'salomon', 'hoka', 'lacoste', 'fila', 'saucony', 'mizuno', 'brooks',
  'noir', 'noire', 'noires', 'blanc', 'blanche', 'blanches', 'gris', 'grise', 'bleu', 'bleue', 'rouge', 'vert', 'verte', 'marron', 'beige', 'rose', 'jaune', 'orange', 'violet', 'kaki', 'creme', 'black', 'white', 'grey', 'gray', 'blue', 'red', 'green', 'brown',
  'chaussures', 'chaussure', 'baskets', 'basket', 'sneakers', 'sneaker', 'low', 'high', 'mid']);
const motsModele = (s) => motsDeTitre(s).filter((w) => !/^\d/.test(w) && !MOTS_HORS_MODELE.has(w));
function suggestionsPaires(cible, candidats, max = 3) {
  const mc = new Set(motsDeTitre(cible && cible.titre));
  const mm = new Set(motsModele(cible && cible.titre));
  const fc = familleMarque(cible && cible.titre);
  const tc = pointureDe(cible && cible.titre);
  const pc = Number(cible && cible.prix);
  return (candidats || []).map((c) => {
    let note = 0;
    const texte = `${c.titre || ''} ${c.marque || ''}`;
    for (const w of new Set(motsDeTitre(texte))) if (mc.has(w)) note += /^\d/.test(w) ? 1 : 2;
    // Une autre marque, ou aucun mot du modèle en commun : ce n'est pas la même paire.
    const f = familleMarque(texte);
    if (fc && f && fc !== f) return { ...c, note: -1 };
    if (!motsModele(texte).some((w) => mm.has(w))) return { ...c, note: -1 };
    const t = pointureDe(c.taille) || pointureDe(c.titre);
    // Une pointure DIFFÉRENTE écarte la paire, quoi que disent les mots : c'est
    // le cas des « 50 paires identiques » (§2.4) — même modèle, autre paire.
    if (tc && t && tc !== t) return { ...c, note: -1 };
    if (tc && t) note += 3;
    if (pc > 0 && Number(c.prix) > 0) { const r = Math.abs(pc - c.prix) / Math.max(pc, c.prix); if (r <= 0.15) note += 2; else if (r > 0.6) note -= 1; }
    return { ...c, note };
  }).filter((x) => x.note >= 4).sort((a, b) => b.note - a.note).slice(0, max);
}

function compteLbcConnecte(accounts) {
  const l = Object.values(accounts || {}).filter((a) => a && a.sessionAt);
  l.sort((a, b) => String(b.sessionAt).localeCompare(String(a.sessionAt)));
  return l[0] || null;
}
function annonceLbcALui(ad, prouves) {
  return !!(ad && (ad.ref || ad.customRef || (ad.lbcUser && prouves && prouves.has(String(ad.lbcUser))) || (ad.account && prouves && prouves.has(String(ad.account)))));
}

const LBC_REVUE_JOURS = 7;
const lbcJoursSansVoir = (ad) => { const t = Date.parse((ad && ad.seenAt) || ''); return isFinite(t) ? (Date.now() - t) / 864e5 : null; };
const lbcPasRevue = (ad) => { const j = lbcJoursSansVoir(ad); return j != null && j > LBC_REVUE_JOURS; };
function LbcRelier({ ad, numsConnus, onRelie, suggestions, detail, vendue = false, cleRangement = '' }) {
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState('');
  const photo = (Array.isArray(ad.images) && ad.images[0]) || ad.image || '';
  const id = ad.id != null ? String(ad.id) : '';
  const poser = (n) => {
    if (!id) { setMsg("Cette annonce n'a pas d'identifiant Leboncoin : impossible de la relier."); return; }
    relierAnnonceLbc(id, n);
    setMsg('');
    toast(`Annonce reliée à l'article N°${n}.`);
    onRelie && onRelie();
  };
  const aucune = () => { rangerSansJumelleLbc(cleRangement); toast('Compris — je ne te le redemande plus.'); onRelie && onRelie(); };
  const relier = () => {
    // « n125 » (l'écriture des titres Vinted) vaut 125 — sauf s'il existe une
    // vraie série « N » : alors N125 est un numéro à part entière.
    const brut = cleNum(num);
    const sansN = brut.replace(/^N[°O]?(?=\d)/, '');
    let n = numsConnus.includes(brut) ? brut : sansN;
    // (16 oct.) Le numéro écrit sur le CARTON d'une ancienne paire (« 233 ») est
    // devenu « B233 » à la remise à zéro du 11 octobre : on le reconnaît, sans
    // jamais prendre la nouvelle paire du même chiffre quand elle existe.
    if (!numsConnus.includes(n) && /^\d+$/.test(n) && numsConnus.includes('B' + n)) n = 'B' + n;
    if (!NUM_OK.test(n)) { setMsg('Tape le numéro de l’article (125, ou B125).'); return; }
    if (!numsConnus.includes(n)) { setMsg(`Aucun article ne porte le N°${n} dans VRM.`); return; }
    poser(n);
  };
  const sugg = (suggestions || []).filter((s) => s && s.numero);
  const btn = { border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, color: C.text, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div data-lbc-relier={id} style={{ padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <PhotoVinted src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }}/>}
        </div>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.subject || ad.title || '—'}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {detail || (ad.price != null && isFinite(Number(ad.price)) ? `${Number(ad.price).toFixed(2).replace('.', ',')} €` : '')}{ad.customRef ? ` · réf ${ad.customRef}` : ''}
            {ad.url ? <> · <a href={ad.url} target="_blank" rel="noreferrer" className="vrm-lien-touche" style={{ color: C.accent, fontWeight: 600 }}>voir</a></> : null}
          </div>
          {msg && <div style={{ fontSize: 11.5, color: C.warn, marginTop: 3 }}>{msg}</div>}
        </div>
        {/* Une paire VENDUE n'a plus de numéro à taper (Julien, 16 oct.) : seule
            l'annonce encore en ligne garde le champ N°. */}
        {!vendue && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
            <input value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') relier(); }}
              inputMode="numeric" placeholder="N°" aria-label="N° de l'article"
              style={{ width: 58, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 8px', background: C.bg, color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
            <button type="button" onClick={relier} style={btn}>Relier</button>
          </div>
        )}
      </div>
      {/* Les paires ENCORE EN VENTE SUR VINTED qui y ressemblent, à confirmer :
          c'est son clic qui relie, jamais la ressemblance (§5). */}
      {sugg.length > 0 && (
        <div data-lbc-suggestions={id} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{vendue ? 'Est-ce le même article ?' : "C'est peut-être :"}</span>
          {sugg.map((s) => (
            <button key={s.numero} type="button" data-suggestion={s.numero} onClick={() => poser(s.numero)} title={s.titre || ''}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.text, padding: '6px 10px 6px 6px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 0 }}>
              {s.photo ? <PhotoVinted src={s.photo} alt="" loading="lazy" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}/> : null}
              <b style={{ flexShrink: 0 }}>N°{s.numero}</b>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: C.muted }}>{s.titre || ''}</span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: C.accent }}>{vendue ? "C'est lui" : 'Relier'}</span>
            </button>
          ))}
        </div>
      )}
      {cleRangement && (
        <div style={{ marginTop: 8 }}>
          <button type="button" data-lbc-aucune={cleRangement} onClick={aucune} style={{ ...btn, color: C.muted }}>{sugg.length ? 'Aucun de ceux-là' : 'Pas d’article à relier'}</button>
        </div>
      )}
    </div>
  );
}
const MAIN_LEBONCOIN = ['vinted_annonce_numeros', 'vinted_accounts_hidden', 'vinted_accounts_blocked', 'vinted_pairs_lost', 'vrm_lbc_liens', 'vrm_lbc_pas_de_paire'];

function QuotaLbc({ limit, plan, onFait }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [v, setV] = React.useState(limit ? String(limit) : '');
  const [msg, setMsg] = React.useState(null);
  const cap = extSait('publication');
  if (cap !== 'ok') return limit ? null : <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>La limite de ton offre se règle ici depuis l'ordinateur où l'extension {cap === 'retard' ? `est installée, une fois passée en ${EXT_CAPACITES.publication}` : 'est installée'}.</div>;
  const enregistrer = async () => {
    setMsg(null);
    const r = await vmrCmd({ cmd: 'lbcQuota', limit: v, plan: plan || '' });
    if (r && r.accepte) { setOuvert(false); onFait && onFait(); } else setMsg((r && r.raison) || "L'extension n'a pas répondu — réessaie.");
  };
  if (!ouvert) return (
    <button type="button" onClick={() => setOuvert(true)} style={{ marginTop: 6, border: 'none', background: 'transparent', padding: 0, minHeight: 0, color: C.accent, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
      {limit ? 'Changer la limite de mon offre' : 'Indiquer la limite de mon offre Leboncoin'}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
      <input value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" placeholder="ex. 50"
        style={{ width: 80, padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit' }}/>
      <span style={{ fontSize: 12, color: C.muted }}>annonces au maximum</span>
      <button type="button" onClick={enregistrer} style={{ border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Enregistrer</button>
      {msg && <span style={{ fontSize: 11, color: C.warn, width: '100%' }}>{msg}</span>}
    </div>
  );
}
function LeboncoinScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreurReception,setErreurReception]=useState(false);
  const suiviReception=useRef(null);
  const reload=()=>suiviReception.current?.actualiser();
  const sbGet = q => lireReceptionLeboncoin(`${SUPABASE_URL}/rest/v1/${q}`,sbAuth());
  const lireDonnees = async (estActif) => {
    setLoading(true);
    setErreurReception(false);
    // ⚠️ 197 Ko POUR EN LIRE 133 : cet écran lit `main` lui-même (c'est ce qui
    //    lui donne son propre `echecLecture`), mais il n'en utilise que QUATRE
    //    clés. Mesuré le 15 septembre : `select=data` 197 Ko / 795 ms, la
    //    projection 133 Ko / 442 ms, **valeurs identiques**. §4.4 : on ne
    //    rapatrie pas le blob d'une ligne lourde. L'alias porte le nom de la
    //    clé, donc la lecture ci-dessous ne change pas.
    const mainRows = await sbGet(`app_data?id=eq.main&select=${MAIN_LEBONCOIN.map(k => `${k}:data->${k}`).join(',')}`);
    // ⚠️ `sbGet` rend `null` quand la base n'a PAS RÉPONDU, et `[]` quand elle
    //    a répondu « rien ». Confondre les deux faisait fêter « Tout est
    //    publié 🎉 » une file qu'on n'avait jamais pu lire.
    const echecLecture = mainRows === null;
    const main = (mainRows && mainRows[0]) || {};
    const numeros = main.vinted_annonce_numeros || {};
    const postedRows = await sbGet('app_data?id=eq.vinted_lbc_posted&select=data');
    const pd = (postedRows && postedRows[0] && postedRows[0].data) || {};
    const posted = new Set((pd.ids || []).map(String));
    // MÊMES RÈGLES DE COMPTE QUE LE RESTE DE L'APP : un compte MASQUÉ à la main
    // ne doit pas alimenter la file (choix explicite de Julien).
    // ⚠️⚠️ UN COMPTE BANNI PAR VINTED (`vinted_accounts_blocked`), LUI, RESTE
    //    DANS LA FILE (Julien, 25 sept.) : « dès qu'un compte est banni, je veux
    //    pouvoir publier ses annonces sur Leboncoin/eBay/Vestiaire ». Les paires
    //    existent encore physiquement — le compte Vinted est mort, pas le stock.
    //    Elles sortent de « en ligne » Vinted (annBase/liveStats les écartent),
    //    mais restent PUBLIABLES ailleurs. C'est un renversement ASSUMÉ de
    //    l'ancienne règle « un compte fermé n'alimente aucune file » — qui, elle,
    //    ne vaut plus que pour les comptes SUPPRIMÉS (`vrm_blocked_accounts`).
    const offAcc = new Set((main.vinted_accounts_hidden || []).map(String));
    // ⚠️⚠️ ET LES SUPPRIMÉS DÉFINITIVEMENT (`vrm_blocked_accounts`) : une TROISIÈME
    //    liste, que ni `vinted_accounts_hidden` ni `vinted_accounts_blocked` ne
    //    recouvrent. Sans ça les paires d'un compte fermé par Vinted (mesuré :
    //    `shop_cancale`, 96 paires numérotées) étaient proposées à la
    //    republication, ici comme dans le panneau. `null`/échec ⇒ on n'exclut
    //    RIEN (ne pas cacher un compte vivant sur un hoquet — sens inverse du cas
    //    d'écriture). C'est la MÊME règle que `buildLbcData`/`buildEbayData` (§11).
    const blkRows = await sbGet('app_data?id=eq.vrm_blocked_accounts&select=data');
    ((blkRows && blkRows[0] && blkRows[0].data && blkRows[0].data.uids) || []).forEach((u) => offAcc.add(String(u)));
    const lost = main.vinted_pairs_lost || {};
    const listRowsBrut = await sbGet('app_data?id=like.harvest_*_listings&select=id,data');
    // 5.167 (11 octobre) : seulement ce qui est EN LIGNE d'après la lecture la
    // plus récente de chaque compte — la même règle que l'écran Annonces et que
    // la file de l'extension (`enLigneDesLignes`, §11). Celles « à confirmer »
    // (compte pas relu depuis 24 h) ne sont ni dans la file, ni « à retirer de
    // Leboncoin » : on ne sait pas, on ne dit rien.
    const enl = await lireLignesEnLigne(listRowsBrut || []);
    const listRows = enl.lignes;
    const aConfirmerIds = new Set();
    for (const [u, l] of enl.aConfirmer) if (!offAcc.has(String(u))) for (const it of l) if (it && it.id != null) aConfirmerIds.add(String(it.id));
    // Les photos HD et la description ne viennent QUE de la page de l'annonce :
    // mesuré le 12 septembre, l'API Vinted ne renvoie aucune photo (0 sur 57
    // lignes `harvest_*_item_*`, captures jusqu'au 9 septembre). Sans cette
    // lecture, l'écran ne peut pas dire avec combien de photos une annonce
    // partirait — et 54 des 59 partiraient avec UNE SEULE.
    const detRows = await sbGet('app_data?id=eq.vinted_item_details&select=data');
    const pageDet = (detRows && detRows[0] && detRows[0].data) || {};
    // ⚠️ « VENDUE » SE PROUVE (§5). Les 400 lignes `harvest_*_txn_*` portent
    //    toutes leur `item_id` : c'est l'identité qui relie une vente à son
    //    annonce. Mesuré : sur 400 annonces fermées, 151 seulement ont une vente
    //    prouvée — « plus en ligne » ne veut donc pas dire « vendue ».
    // ⚠️⚠️ ET ON NE DEMANDE QUE `item_id`, PAS LE BLOB (§4.4). Mesuré le
    //    15 septembre sur sa vraie base : `select=data` sur ces 704 lignes rend
    //    **19,8 Mo en 5,0 s** ; la projection rend **16 Ko en 0,36 s** —
    //    **1 251× moins d'octets, 14× plus vite**, et **exactement les mêmes
    //    242 ventes prouvées** (0 manquante, 0 en trop : c'est la preuve qu'un
    //    jugement métier n'a pas bougé). Le repli `t.item.id` n'existe nulle
    //    part dans ses données (704 lignes sur 704 portent `item_id`), donc il
    //    ne perd rien — et un `item_id` absent ne prouverait aucune vente de
    //    toute façon.
    // ⚠️⚠️⚠️ ET « CITÉE DANS UNE TRANSACTION » N'EST PAS « VENDUE ». Mesuré le
    //    15 septembre en vérifiant la FORME (§6) : sur les **711 lignes** de
    //    cette famille, **468 portent un `status_title` VIDE** — ce sont des
    //    CONVERSATIONS. Une seule annonce en portait treize (« salomon XT-6
    //    blanc taille 40 », toujours en ligne) : treize acheteurs lui ont écrit,
    //    aucun n'a acheté. La file écartait ainsi **15 paires qu'il a encore**.
    //    ⇒ Une vente est prouvée quand Vinted donne un ÉTAT DE COMMANDE à la
    //      transaction, et que cet état ne la fait pas REVENIR. On ne liste pas
    //      des codes : un code inconnu demain doit compter comme une vente.
    // ⚠️⚠️ ET « JE N'AI PAS PU LIRE » N'EST PAS « AUCUNE VENTE ». Mesuré en
    //    direct le 15 septembre : cette lecture a échoué une fois (base sous
    //    charge), le `|| []` l'a transformée en « aucune vente prouvée », et la
    //    file est passée de **40 à 55 paires** — quinze paires DÉJÀ VENDUES
    //    reproposées à la publication, sans un mot. C'est la plainte du
    //    13 septembre ressuscitée par un simple timeout.
    // ⚠️⚠️ (revue du 11 octobre) LA MÊME PREUVE QUE L'EXTENSION ET L'ÉCRAN eBAY
    //    (§11) : cet écran gardait sa propre boucle sur les seules transactions.
    //    Une vente prouvée par son BORDEREAU (le cas de la N°553) sortait de la
    //    file de l'extension et restait ici « à publier » — et le clic
    //    « Publier » était alors refusé par l'extension, qui relit SA file. Et
    //    une transaction figée sur « payée » d'une vente remboursée restait
    //    « vendue ». Une règle (`lirePreuvesVenteVinted`), `null` = pas su.
    // ⚠️ (revue du 11 octobre, défaut 12) + `ancienne` : ce que les extensions
    //    PUBLIÉES (jusqu'à la 5.170) disent vendu sur la seule transaction. Une
    //    paire REVENUE (vente remboursée ensuite) est « à publier » ici et
    //    « vendue » pour elles : leur « Publier » serait refusé.
    const preuveP = await lirePreuvesVenteVinted();
    const preuveLue = preuveP ? preuveP.vendus : null;
    const ancienne = (preuveP && preuveP.ancienne) || new Set();
    const preuveKO = preuveLue === null;
    const vendus = preuveLue || new Set();
    const online = []; const onlineIds = new Set(); const seen = new Set(); const etatVinted = {};
    for (const r of listRows) {
      const uid = String(r.id).split('_')[1];
      if (offAcc.has(uid)) continue;
      const p = (r.data && r.data.payload) || {};
      for (const it of (p.items || [])) {
        const oid = String(it.id);
        etatVinted[oid] = it.is_hidden ? 'pause' : (it.is_draft ? 'brouillon'
          : (it.is_closed ? (vendus.has(oid) ? 'vendue' : 'fermee') : 'enligne'));
        if (it.is_closed || it.is_hidden || it.is_draft) continue;
        onlineIds.add(oid); if (seen.has(oid)) continue; seen.add(oid);
        online.push({ id: oid, uid, title: it.title, brand: it.brand_title || '', size: it.size_title || '', status: it.status || '', color: [it.color1, it.color2].filter(Boolean).join(' '), price: (it.price && it.price.amount) || it.price || null, photo: (it.photo && it.photo.url) || '', nPhotos: Number.isFinite(it.nPhotos) ? it.nPhotos : (it.photos_count != null ? Number(it.photos_count) : undefined) });
      }
    }
    // ── OÙ EN EST LA PRÉPARATION DE LA PUBLICATION AUTOMATIQUE ────────────────
    // L'extension collecte depuis quatre versions (le catalogue des codes, la
    // config du formulaire dynamique, la forme de ce qui part) et l'app n'en
    // montrait RIEN : impossible pour lui de savoir si ça avance, ni quel geste
    // fait avancer. C'est le motif du tiroir `Nav` (§4.11).
    // ⚠️ §4.4 : on ne lit PAS `lbc_catalogue` (des centaines de Ko) ni
    //    `lbc_recon` (67 Ko). C'est l'extension qui PUBLIE un résumé de 1 Ko,
    //    l'app le CONSOMME — le motif de `vrm_colis_prets` (§11).
    const prepRows = await sbGet('app_data?id=eq.vrm_lbc_prep&select=data');
    // Trois états, jamais deux : `null` = pas su, `[]` = jamais publié, sinon lu.
    const prep = prepRows === null ? null : ((prepRows[0] && prepRows[0].data) || {});

    // Comptes Leboncoin réellement vus dans le navigateur (captés par l'extension).
    // Le compte Vinted d'où vient chaque paire (la fiche le nomme) : login, ou
    // le nom qu'il lui a donné. Lecture ratée ⇒ aucun nom, jamais un faux.
    const vaRows = await sbGet('vinted_accounts?select=vinted_user_id,login');
    const labelsComptes = load('vinted_account_labels', {}) || {};
    const nomCompteDe = (u) => { const a = (vaRows || []).find((x) => String(x.vinted_user_id) === String(u)); return labelsComptes[String(u)] || (a && a.login) || ''; };
    const accRows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    const accsLbc = (accRows && accRows[0] && accRows[0].data && accRows[0].data.accounts) || {};
    // Le compte connecté en dernier (session vue) d'abord, puis les autres.
    const lbcAccounts = Object.values(accsLbc).filter(Boolean)
      .sort((a, b) => String(b.sessionAt || '').localeCompare(String(a.sessionAt || '')) || String(b.seenAt || '').localeCompare(String(a.seenAt || '')));
    const lbcConnecte = compteLbcConnecte(accsLbc);
    // Annonces Leboncoin réellement captées (par l'extension). On s'en sert pour
    // reconnaître TOUT SEUL ce qui est déjà en ligne là-bas, via la référence
    // pro (CustomRef) ou le « nXXXX » du titre — même logique que l'extension,
    // pour que les deux écrans racontent la même chose.
    const lbcRows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    // ⚠️ « jamais capté » n'est pas « zéro annonce » : sans cette ligne, le
    //    rapprochement par référence est impossible, donc « vendue sur Vinted →
    //    à retirer » ne peut RIEN trouver. L'écran doit le dire, pas afficher 0.
    // « jamais capté » = aucune annonce QUI SOIT À LUI (la ligne peut exister et
    // ne contenir que des annonces d'autres).
    const lbcJamaisLu = lbcRows !== null && !(lbcRows && lbcRows[0]);
    const lbcItems = (lbcRows && lbcRows[0] && lbcRows[0].data && lbcRows[0].data.items) || {};
    const lbcAds = Object.values(lbcItems).filter(Boolean);
    // Ses ventes Leboncoin PROUVÉES (il est le vendeur) : elles disent quels
    // comptes Leboncoin sont les siens, et quelles paires sont déjà parties.
    // `null` = pas su : on n'en tire RIEN (ni compte, ni double vente).
    const lbcVentesRows = await sbGet('app_data?id=eq.lbc_ventes&select=data');
    const ventesLbcKO = lbcVentesRows === null;
    const ventesLbc = (lbcVentesRows && lbcVentesRows[0] && lbcVentesRows[0].data && lbcVentesRows[0].data.ventes) || {};
    const prouves = new Set([...comptesLbcProuves(ventesLbc, lbcItems), ...comptesLbcSession(accsLbc)]);
    const numFrom = numDeTitreLbc;
    // ⚠️ LE LIEN POSÉ À LA MAIN D'ABORD (C4) : « Relier » écrit annonce LBC →
    //    N° dans `vrm_lbc_liens`. C'est une identité qu'il pose lui-même — la
    //    même règle vit dans l'extension (`adRefKeys`), sinon l'app relie et le
    //    panneau ne relie pas (§11). La copie locale prime sur le nuage : elle
    //    est plus récente que la dernière synchro (l'envoi est différé).
    const liens = { ...(main.vrm_lbc_liens || {}), ...(load('vrm_lbc_liens', {}) || {}) };
    // Toutes les clés passent par `cleNum` (« VRM-b125 » = « B125 »), des deux
    // côtés — la même règle que l'extension (`adRefKeys`, §11).
    const adKeys = (ad) => clesAnnonceLbc(ad, liens);
    // ⚠️ ET ON NE GARDE QUE CE QU'ON PEUT LUI ATTRIBUER. Mesuré le 13 septembre :
    //    81 annonces rangées par la capture n'étaient pas les siennes (chalets,
    //    gîtes — le flux « découverte » de la page qu'il regardait). Sans ce
    //    filtre elles ressortaient toutes en « annonces non reliées », et le
    //    compteur annonçait 81. Une annonce est à lui si elle porte notre
    //    référence VRM, ou si son propriétaire est connu.
    // ⚠️ Et un compte dont il a VENDU une annonce est le sien (`comptesLbcProuves`,
    //    4 octobre) : ses 7 autres annonces étaient invisibles ici.
    const aLui = (ad) => annonceLbcALui(ad, prouves);
    // Une annonce qu'il a VENDUE sur Leboncoin n'y est plus en vente : elle ne
    // compte ni « en ligne », ni « à retirer », ni « non reliée » — elle a son
    // propre bloc (vendue ici, encore sur Vinted ?).
    const vendusLbc = annoncesLbcVendues(ventesLbc);
    const liveAds = lbcAds.filter(ad => annonceLbcEnVente(ad, vendusLbc) && aLui(ad));
    // (22 oct.) Ce qui n'est plus compté en ligne : plus vue dans une liste
    // COMPLÈTE de son compte, ou mise en pause depuis VRM. Rien n'est effacé ;
    // l'écran le dit, une fois. Et les N° dont l'annonce est sortie : plus rien
    // à retirer pour eux (même règle que le tableau de bord, §11).
    const sortiesLbc = lbcAds.filter((ad) => aLui(ad) && !vendusLbc.has(String(ad.id)) && lbcSortieDe(ad));
    const lecturesLbc = (lbcRows && lbcRows[0] && lbcRows[0].data && lbcRows[0].data.lectures) || {};
    // La preuve qu'aucune autre annonce de la paire n'est en ligne : une liste
    // complète de chacun de ses comptes, postérieure à la marque « publiée ».
    // Comptes, ventes ou annonces illisibles ⇒ pas de preuve (pas su ≠ sorti).
    const preuveListes = (accRows === null || ventesLbcKO || lbcRows === null || postedRows === null) ? null
      : { lectures: lecturesLbc, comptes: prouves, depuis: pd.updatedAt || '' };
    const { prouves: numsSortis, sorties: numsSortiesDoute } = numerosLbcSortis(lbcItems, liens, vendusLbc, preuveListes);
    const pasRevues = liveAds.filter(lbcPasRevue);
    const refToAd = new Map();
    liveAds.forEach(ad => adKeys(ad).forEach(k => { if (!refToAd.has(k)) refToAd.set(k, ad); }));
    const vKeys = (id, title) => { const e = numeros[id] || {}; const ks = []; if (e.numero) ks.push(cleNum(e.numero)); const m = numFrom(title || e.title); if (m) ks.push(cleNum(m)); return ks; };

    // ⚠️ CET ÉCRAN ET LE PANNEAU DE L'EXTENSION CALCULENT LA MÊME FILE, CHACUN
    //    DE SON CÔTÉ (le panneau tourne sur leboncoin.fr, où l'app n'est pas
    //    chargée). Ils doivent donc appliquer EXACTEMENT les mêmes règles, sinon
    //    l'app annonce « 12 à publier » et le panneau en montre 8 —
    //    `audit-places.cjs` vérifie que les deux filtres existent des deux côtés.
    const queue = []; let autoMatched = 0; let retirees = 0; let vendues = 0;
    // ⚠️ Combien d'annonces en ligne portent un numéro : sans ça, une file vide
    //    ne sait pas DIRE pourquoi elle est vide (voir le bloc « Tout est
    //    publié 🎉 » plus bas — il le disait à quelqu'un qui n'a aucune annonce).
    let nNumerotees = 0;
    // (17 oct.) La même paire sous deux N° (photo exacte, `jumellesParPhoto`) :
    // une seule des deux se publie. Notée ici sur toutes les annonces numérotées
    // (publiées ou non) ; la file reste celle de l'extension (§11), seule la
    // ligne le DIT et ne propose pas de publier la seconde.
    const candidatsJ = [];
    for (const o of online) { const e = numeros[o.id]; const num = e && e.numero; if (num && String(num).trim()) candidatsJ.push({ id: String(o.id), num: String(num), photoK: (e && e.photoK) || null, cover: o.photo || null, posee: posted.has(o.id) || posted.has(String(num)) }); }
    const jumLbc = jumellesParPhoto(candidatsJ, (k) => candidatsJ.some((c) => c.posee && cleNum(c.num) === k));
    const twinDe = (id) => { const j = jumLbc.get(String(id)); if (!j) return null; const posee = candidatsJ.find((c) => c.posee && j.autres.some((n) => cleNum(n) === cleNum(c.num))); return posee ? { num: posee.num, posee: true } : (j.gardeId !== String(id) ? { num: j.gardeNum, posee: false } : null); };
    for (const o of online) {
      const e = numeros[o.id]; const num = e && e.numero;
      if (!num || String(num).trim() === '') continue;
      nNumerotees++;
      if (!mpChoisi(e, 'lbc')) { retirees++; continue; }             // retirée de la file par Julien
      // ⚠️⚠️ VENDUE = HORS DE LA FILE (mesuré : 14 des 57 « en ligne » ont une
      //    vente prouvée). La preuve prime sur l'état de l'annonce : Vinted ne
      //    la ferme pas toujours, et une capture peut dater de 85 h.
      if (vendus.has(o.id)) { vendues++; continue; }
      if (lost[String(num).trim()]) continue;                        // paire retirée du stock
      if (posted.has(o.id) || posted.has(String(num))) continue;
      if (vKeys(o.id, o.title).some(k => refToAd.has(k))) { autoMatched++; continue; } // déjà sur LBC
      // Ce que l'extension publiera VRAIMENT : le titre Leboncoin (même règle des
      // deux côtés), le prix, et le nombre de photos réellement disponibles.
      // Avant, cette liste montrait le titre VINTED brut — donc pas ce qui part.
      const d = pageDet[o.id] || {};
      const normPh = (p) => typeof p === 'string' ? p : (p && (p.url || p.full_size_url)) || '';
      // TOUTES les photos captées (Julien : « je veux à chaque fois toutes les
      // photos »), pas seulement la couverture. Le nombre RÉEL que Vinted annonce
      // (nPhotos) peut être plus grand que ce qui est capté : on le garde pour
      // dire « 6/12 captées » sans mentir.
      const photosAll = (Array.isArray(d.photos) ? d.photos.map(normPh).filter(Boolean) : (o.photo ? [o.photo] : []));
      const photos = photosAll.length;
      const nReelles = Number.isFinite(o.nPhotos) ? o.nPhotos : (Number.isFinite(d.nPhotos) ? d.nPhotos : null);
      queue.push({
        id: o.id, numero: String(num), vinted: o.title || (e && e.title) || '',
        title: lbcTitre(d.brand || o.brand, d.title || o.title, d.size || o.size),
        prix: o.price != null ? Number(o.price) : null,
        photos, photosAll, nReelles, vignette: photosAll[0] || '',
        desc: !!lbcDescription(d.description),
        url: 'https://www.vinted.fr/items/' + o.id,
        croitVendue: ancienne.has(String(o.id)),
        // 5.182 : ce que la fiche « Publier sur Leboncoin » montre et laisse
        // corriger — les mêmes entrées que `buildLbcAd` dans l'extension (§11).
        base: String(d.title || o.title || '').trim(), marque: d.brand || o.brand || '', taille: d.size || o.size || '',
        etat: o.status || '', couleur: o.color || '', texte: lbcDescription(d.description),
        compte: nomCompteDe(o.uid),
        jumelle: twinDe(o.id),
      });
    }
    queue.sort((a, b) => triNum(a.numero, b.numero));

    const removals = [];
    const etatDe = (oid) => etatVinted[String(oid)] || (vendus.has(String(oid)) ? 'vendue' : 'inconnue');
    for (const pid of posted) { if (!/^\d+$/.test(pid)) continue; if (onlineIds.has(pid) || aConfirmerIds.has(pid)) continue; const e = numeros[pid] || {}; const kN = e.numero ? cleNum(e.numero) : ''; if (kN && numsSortis.has(kN)) continue; const so = kN ? numsSortiesDoute.get(kN) : null; removals.push({ numero: String(e.numero || '?'), title: e.title || '', etat: etatDe(pid), ...(so ? { sortie: so.quoi } : {}) }); }
    // Détection auto : annonce LBC active dont la paire n'est plus en ligne sur
    // Vinted = vendue → à retirer. Uniquement si la paire est connue de VRM.
    // ⚠️ Une paire « à confirmer » n'est pas « plus en ligne » : on ne sait pas.
    const keysOnline = new Set(); online.forEach(o => vKeys(o.id, o.title).forEach(k => keysOnline.add(k)));
    for (const [u, l] of enl.aConfirmer) if (!offAcc.has(String(u))) for (const it of l) vKeys(String(it.id), it.title).forEach(k => keysOnline.add(k));
    const keysKnown = new Set();
    for (const id in numeros) { const e = numeros[id] || {}; if (e.numero) keysKnown.add(cleNum(e.numero)); const m = numFrom(e.title); if (m) keysKnown.add(cleNum(m)); }
    const unlinked = [];
    for (const ad of liveAds) {
      const ks = adKeys(ad);
      // (22 oct.) Pas revue depuis plus de 7 jours : on ne demande pas « quelle
      // paire ? » (relier une annonce peut-être morte à une paire vivante) — la
      // ligne « pas revues » dit le geste qui tranche.
      if (!ks.length || !ks.some(k => keysKnown.has(k))) { if (!lbcPasRevue(ad)) unlinked.push(ad); continue; }
      if (ks.some(k => keysOnline.has(k))) continue;
      // L'état vient de l'annonce VINTED que ces clés désignent : l'annonce
      // Leboncoin, elle, ne sait rien de la vente.
      let etat = 'inconnue';
      for (const id in numeros) { const en = numeros[id] || {}; const k2 = cleNum(en.numero); if (k2 && ks.includes(k2)) { etat = etatDe(id); break; } }
      removals.push({ numero: ks[0], title: ad.subject || '', lbc: true, url: ad.url || '', etat, id: ad.id != null ? String(ad.id) : '', prix: ad.price != null && isFinite(Number(ad.price)) ? Number(ad.price) : null });
    }
    // (20 oct., audit sur données réelles) UNE PAIRE, UNE LIGNE. La même paire
    // arrivait par les deux sources — marquée « publiée » par VRM ET vue sur
    // Leboncoin avec sa référence : « 2 vendues sur Vinted — à retirer » pour
    // UNE paire (N°18, écrite deux fois). L'annonce vue sur Leboncoin l'emporte
    // (elle porte son lien) ; le N° est l'identité, jamais le titre.
    {
      const vuesLbc = new Set(removals.filter((r) => r.lbc).map((r) => cleNum(r.numero)).filter(Boolean));
      for (let i = removals.length - 1; i >= 0; i--) {
        const r = removals[i];
        if (!r.lbc && r.numero !== '?' && vuesLbc.has(cleNum(r.numero))) removals.splice(i, 1);
      }
    }
    // ── CROISEMENT eBay → LEBONCOIN (26 oct.) : une paire VENDUE SUR eBAY et
    //    encore en ligne ici doit en sortir, sinon elle se vend deux fois.
    //    `commandesEbayTous` rend null si un compte eBay est illisible ⇒ « pas
    //    su », on ne retire RIEN (rien lu ne vaut pas rien). Identité par le SKU
    //    VRM-{n°} (§5), jamais le titre. Une paire déjà « à retirer » (vendue
    //    sur Vinted) n'est pas doublée — une paire, une ligne.
    try {
      const cmdsEbay = await commandesEbayTous();   // null si un compte eBay illisible ⇒ pas su
      if (Array.isArray(cmdsEbay)) {
        const soldEbay = new Set();
        for (const o of cmdsEbay) { if (!commandeEbayEngagee(o)) continue; for (const li of (Array.isArray(o.lineItems) ? o.lineItems : [])) { const k = cleNum(numLigneEbay(o, li)); if (k) soldEbay.add(k); } }
        if (soldEbay.size) {
          const parN = new Map(); removals.forEach((r) => { const k = cleNum(r.numero); if (k && !parN.has(k)) parN.set(k, r); });
          for (const ad of liveAds) {
            const k = adKeys(ad).filter((x) => keysKnown.has(x)).find((x) => soldEbay.has(x));
            if (!k) continue;
            const ex = parN.get(k);
            if (ex && ex.etat === 'vendue') continue;   // déjà « à retirer » (vendue ailleurs, prouvée) — une paire, une ligne
            if (ex) { const i = removals.indexOf(ex); if (i >= 0) removals.splice(i, 1); }   // un simple doute devient une vente eBay PROUVÉE
            const entry = { numero: k, title: ad.subject || '', lbc: true, ou: 'eBay', url: ad.url || '', etat: 'vendue', id: ad.id != null ? String(ad.id) : '', prix: ad.price != null && isFinite(Number(ad.price)) ? Number(ad.price) : null };
            removals.push(entry); parN.set(k, entry);
          }
        }
      }
    } catch (_) { /* une lecture eBay qui tombe ne casse jamais l'écran Leboncoin */ }
    removals.sort((a, b) => triNum(a.numero, b.numero));
    // ── L'AUTRE SENS : VENDUE SUR LEBONCOIN, ENCORE EN VENTE SUR VINTED ────────
    // Les paires que Vinted propose encore à la vente (`onlineIds`), et celles que
    // Vinted a déjà vendues (`vendus`) : vendue ici ET là, c'est une vente qu'il
    // ne pourra pas honorer.
    const dv = ventesLbcKO ? { doublons: [], aRelier: [] }
      // ⚠️ Une paire « à confirmer » PEUT être encore en vente sur Vinted : vendue
      //    sur Leboncoin, on le dit quand même (manquer une double vente coûte une
      //    paire ; regarder sur Vinted, un clic).
      : doublesVenteLbc({ ventes: ventesLbc, items: lbcItems, liens, numeros, enLigne: new Set([...onlineIds, ...aConfirmerIds]), vendusVinted: vendus });
    // Les paires qu'il a encore en ligne sur Vinted, avec leur N° : ce sont elles
    // qu'une annonce Leboncoin peut désigner. Proposées, jamais reliées seules.
    const candidats = online.filter((o) => numeros[o.id] && numeros[o.id].numero)
      .map((o) => ({ numero: String(numeros[o.id].numero), titre: o.title || '', marque: o.brand || '', taille: o.size || '', prix: o.price != null ? Number(o.price) : null, photo: o.photo || '' }));
    const suggPour = (titre, prix) => suggestionsPaires({ titre, prix }, candidats);
    // ⚠️ (16 oct., Julien : « ça sert à rien de relier une paire vendue, je n'ai
    //    plus de numéro ».) Relier une vente ne sert qu'à une chose : savoir si la
    //    MÊME paire est encore en vente sur Vinted. Sans paire ressemblante encore
    //    en ligne, il n'y a rien à vendre deux fois — on ne demande rien. Et sa
    //    réponse « aucune de celles-là » range la question pour de bon.
    const pasDePaire = { ...(main.vrm_lbc_pas_de_paire || {}), ...(load('vrm_lbc_pas_de_paire', {}) || {}) };
    const aRelierTout = dv.aRelier.map(({ vente, ad }) => ({ vente, ad, suggestions: suggPour(vente.title || ad.subject, vente.price != null ? Number(vente.price) / 100 : ad.price) }));
    const aRelierVentes = aRelierTout.filter((v) => v.suggestions.length > 0 && !pasDePaire['tx:' + (v.vente.txId || v.ad.id)]);
    const ventesSansJumelle = aRelierTout.length - aRelierVentes.length;
    const doublons = dv.doublons.map((d) => ({ ...d, vintedUrl: d.surVinted[0] ? 'https://www.vinted.fr/items/' + d.surVinted[0] : '' }));
    unlinked.forEach((u) => { u.suggestions = suggPour(u.subject || u.title, u.price); });
    // Une annonce Leboncoin ENCORE EN LIGNE garde son champ N° (la relier dit
    // laquelle retirer quand la paire se vend sur Vinted). Seule sa réponse
    // « pas de paire à relier » la range — jamais une déduction.
    const nonRelieesTout = unlinked.length;
    const unlinkedAsk = unlinked.filter((u) => !pasDePaire['ad:' + (u.id != null ? u.id : '')]);
    const nonRelieesSansJumelle = nonRelieesTout - unlinkedAsk.length;
    // Les liens qu'IL a posés (non vides) : la liste qui permet de les défaire.
    const adParId = new Map((Array.isArray(lbcAds) ? lbcAds : []).map((a) => [String(a && a.id), a]));
    const liensPoses = Object.entries(liens).filter(([, n]) => n != null && String(n).trim())
      .map(([id, n]) => { const a = adParId.get(String(id)) || {}; return { id, numero: String(n), titre: a.subject || a.title || '', image: (Array.isArray(a.images) && a.images[0]) || '' }; });
    // Répartition des annonces LBC par compte (plusieurs comptes possibles).
    const parCompte = {};
    // L'annonce porte son compte dans `account` (capture du fond) ou `lbcUser`
    // (capture de la page) : `lbcUser` seul comptait 0 annonce par compte.
    for (const ad of liveAds) { const k = String(ad.account || ad.lbcUser || '?'); (parCompte[k] = parCompte[k] || []).push(ad); }
    if (!estActif()) return;
    setData({ catalogueAds: lbcAds.filter(aLui), catalogueVentes: ventesLbc, sortiesLbc: sortiesLbc.map((a) => { const q = lbcSortieDe(a); return { id: String(a.id), plusVueAt: q === 'plusvue' ? a.plusVueAt : null, pauseAt: q === 'pause' ? a.pauseAt : null, compte: String(a.account || a.lbcUser || '') }; }), lecturesLbc, pasRevues: pasRevues.length, pasRevuesJours: pasRevues.length ? Math.floor(Math.min(...pasRevues.map(lbcJoursSansVoir))) : 0, liensPoses, liensMain: liens, preuveKO, aConfirmer: aConfirmerIds.size, echecLecture: echecLecture || listRowsBrut === null, lbcJamaisLu: lbcJamaisLu || (lbcRows !== null && liveAds.length === 0), lbcKO: lbcRows === null, vendues, nEnLigne: online.length, nNumerotees, queue, removals, unlinked: unlinkedAsk, nonRelieesSansJumelle, ventesSansJumelle, doublons, aRelierVentes, ventesLbcKO, numsConnus: [...keysKnown], liveAds, autoMatched, retirees, lbcAccounts, lbcConnecte, parCompte, postedCount: [...posted].filter((x) => /^\d+$/.test(x)).length, lbcCount: liveAds.length, limit: pd.limit, plan: pd.plan, prep });
    setLoading(false);
  };
  useEffect(() => {
    const suivi=suivreReceptionLeboncoin({fenetre:window,document,relire:lireDonnees,onErreur:()=>{setErreurReception(true);setLoading(false);}});
    suiviReception.current=suivi;
    suivi.actualiser();
    return ()=>{suivi.arreter();suiviReception.current=null;};
    /* eslint-disable-next-line */
  }, []);
  const marquer = async (id) => { const r = await vmrCmd({ cmd: 'lbcMarque', id: String(id), etat: 'posted' }); if (r && r.accepte) reload(); };
  // ── METTRE EN PAUSE SUR LEBONCOIN, SUR SON CLIC (22 octobre — proposition 6) ──
  // La N°18, vendue sur Vinted le 18 octobre, était encore en ligne sur
  // Leboncoin 4 jours après : cet écran n'offrait qu'un lien. Le bouton envoie
  // UN identifiant à l'extension ; elle relit l'annonce en base, vérifie le
  // compte Leboncoin connecté et envoie UNE pause (jamais une suppression).
  // La réponse de Leboncoin est écrite telle quelle ; un refus dit « pas fait »,
  // un silence dit « je ne sais pas ». Une à la fois.
  // Trois états de l'extension, jamais deux : absente (téléphone) · on vérifie ·
  // elle sait (`lbcPause` dans son état, capacité par présence) · en retard.
  const [, setExtTic] = useState(0);
  useEffect(() => onVmrExt(() => setExtTic((x) => x + 1)), []);
  const pauseEtat = () => {
    if (!vmrExtPresent()) return 'absente';
    if (__vmrEtat === undefined) return 'verif';
    if (__vmrEtat === null) return 'muette';
    return __vmrEtat.lbcPause === true ? 'ok' : 'retard';
  };
  const [pauseEnVol, setPauseEnVol] = useState(null);
  const [pauseRes, setPauseRes] = useState([]);
  const mettreEnPause = async (r) => {
    if (pauseEnVol || !r || !r.id) return;
    const prix = r.prix != null ? ` · ${Number(r.prix).toFixed(2).replace('.', ',').replace(/,00$/, '')} €` : '';
    const ok = await askConfirm({
      title: `Mettre en pause « ${r.title || 'cette annonce'} » sur Leboncoin ?`,
      desc: `N°${r.numero}${prix} — vendue sur Vinted.\n\nElle ne sera plus visible sur Leboncoin. Ce n'est pas une suppression : tu pourras la remettre en ligne depuis « Mes annonces » sur Leboncoin.\n\nL'extension l'envoie depuis ta session Leboncoin, sur le compte de cette annonce.`,
      ok: 'Mettre en pause', cancel: 'Annuler',
    });
    if (!ok) return;
    setPauseEnVol(r.id);
    let rep = null;
    try { rep = await vmrCmd({ cmd: 'lbcPause', id: String(r.id) }, 70000); } catch (_) { rep = null; }
    setPauseEnVol(null);
    setPauseRes((l) => [{ id: r.id, numero: r.numero, titre: r.title || '', rep, at: Date.now() }, ...l.filter((x) => x.id !== r.id)].slice(0, 6));
    if (rep && rep.accepte && rep.etape === 'fait') reload();
  };
  // Ce que Leboncoin a répondu, en clair — et seulement ce qu'on sait.
  const phrasePause = (x) => {
    const rp = x.rep;
    const cite = rp && rp.reponse ? ` « ${String(rp.reponse).slice(0, 160)} »` : '';
    if (!rp) return { etape: 'incertain', t: "je ne sais pas si c'est fait : l'extension n'a pas répondu à temps. Regarde l'annonce sur Leboncoin avant de recliquer." };
    if (rp.accepte === false) return { etape: 'refuse', t: `pas fait — ${rp.raison || 'refusé par l’extension'}.` };
    if (rp.etape === 'fait') return { etape: 'fait', t: `mise en pause : Leboncoin a répondu ${rp.statut}${cite}.${rp.note === false ? " (VRM n'a pas pu le noter : elle restera dans cette liste jusqu'à la prochaine lecture complète de tes annonces.)" : ''}` };
    if (rp.etape === 'refuse') return { etape: 'refuse', t: `pas fait — Leboncoin a répondu ${rp.statut}${cite}. L'annonce est toujours en ligne.` };
    return { etape: 'incertain', t: `je ne sais pas si c'est fait — ${rp.raison || "pas de réponse de Leboncoin"}.` };
  };
  // 5.182 : la fiche « Publier sur Leboncoin » ouverte (une paire de la file).
  const [fiche, setFiche] = useState(null);
  const n = data ? Math.max(data.postedCount, data.lbcCount) : 0;
  const lim = data ? (data.limit || null) : null;
  const pct = lim ? Math.min(100, Math.round((n / lim) * 100)) : 0;
  const barCol = lim ? (n >= lim ? C.danger : n >= lim - 3 ? C.warn : INV_STATUS.online.color) : C.muted;
  // (16 oct.) Mise en page dans l'identité de l'app : cartes blanches à ombre
  // douce, titres courts, une colonne plus large sur ordinateur (elle faisait
  // 600 px et tout s'empilait en pavés).
  const Card = ({ children, style, className }) => <div className={className} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '16px 18px', marginBottom: 14, boxShadow: C.shadow, ...style }}>{children}</div>;
  const Titre = ({ children, ...p }) => <div {...p} style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3, letterSpacing: '-.01em' }}>{children}</div>;
  const Sous = ({ children }) => <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>{children}</div>;
  // ── L'AGENT QUI CONSEILLE (26 oct., parité avec eBay — Julien : « une vraie
  //    expérience ») : « À faire sur Leboncoin » range les actions du plus
  //    urgent au moins, sur les signaux DÉJÀ calculés dans `data` (§11, aucun
  //    nouveau calcul). Chaque ligne saute au bloc concerné. Rien quand il n'y
  //    a rien à faire, muet tant que `data` n'est pas lu. Mêmes libellés que
  //    les blocs eux-mêmes — pas de nouvelle consigne à vérifier.
  const plurLbc = (n) => (n > 1 ? 's' : '');
  // ⚠️ NE COMPTER QUE LES VENTES PROUVÉES (revue du 26 oct.). `data.removals`
  //    mélange trois états — vendue (prouvée) · pause (masquée sur Vinted, PAS
  //    vendue, rien à faire) · doute (fermée sans preuve). Compter le TOTAL
  //    affichait « N vendues à retirer » en rouge sur des paires non vendues :
  //    exactement la régression que le bloc détaillé (« VENDUE SE PROUVE »)
  //    existe pour empêcher. Aligné sur eBay (`dvVue.aRetirerEbay`) et la
  //    cloche (`lbcRemoveCount`), qui ne comptent que le prouvé.
  // (28 oct.) Le N° d'une annonce de « Mes annonces » : la règle de l'écran
  // (lien posé à la main, sinon référence VRM traduite par la 013), jamais la
  // référence brute (§5, §11).
  const numeroAnnonceLbc = React.useMemo(() => {
    if (!data || !Array.isArray(data.catalogueAds)) return null;
    const parId = {}; for (const a of data.catalogueAds) if (a && a.id != null) parId[String(a.id)] = a;
    const liens = data.liensMain || null;
    return (ad) => (ad && ad.id != null) ? numeroLbcIdentite({ itemId: ad.id }, parId, liens) : '';
  }, [data]);
  const nRetirerLbc = (data && data.removals) ? data.removals.filter((r) => r.etat === 'vendue' && r.ou !== 'eBay').length : 0;
  const nRetirerLbcEbay = (data && data.removals) ? data.removals.filter((r) => r.etat === 'vendue' && r.ou === 'eBay').length : 0;
  const conseilsLbc = data ? [
    nRetirerLbc && { k: 'retirer', urg: true, sel: '[data-lbc-retirer]', txt: `${nRetirerLbc} paire${plurLbc(nRetirerLbc)} vendue${plurLbc(nRetirerLbc)} sur Vinted, encore en ligne ici — à retirer de Leboncoin` },
    nRetirerLbcEbay && { k: 'retirer-ebay', urg: true, sel: '[data-lbc-retirer-ebay]', txt: `${nRetirerLbcEbay} paire${plurLbc(nRetirerLbcEbay)} vendue${plurLbc(nRetirerLbcEbay)} sur eBay, encore en ligne ici — à retirer de Leboncoin` },
    data.doublons && data.doublons.length && { k: 'doublons', urg: true, sel: '[data-lbc-doublons]', txt: `${data.doublons.length} vendue${plurLbc(data.doublons.length)} sur Leboncoin, encore sur Vinted — à retirer là-bas` },
    data.aRelierVentes && data.aRelierVentes.length && { k: 'relier-ventes', sel: '[data-lbc-ventes-a-relier]', txt: `${data.aRelierVentes.length} vente${plurLbc(data.aRelierVentes.length)} Leboncoin à relier à un article` },
    data.queue && data.queue.length && { k: 'publier', sel: '.vrm-lbc-a-publier', txt: `${data.queue.length} paire${plurLbc(data.queue.length)} prête${plurLbc(data.queue.length)} à publier sur Leboncoin` },
  ].filter(Boolean) : [];
  const allerLbc = (c) => () => { try { const el = document.querySelector(c.sel); if (el) el.scrollIntoView({ behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth', block: 'center' }); } catch (_) {} };
  return (
    <div className="vrm-lbc-ecran" style={{ padding: '16px 14px 40px', maxWidth: 920, margin: '0 auto' }}>
      {fiche && <FicheLbc q={fiche} compteLbc={data && data.lbcConnecte} onClose={() => setFiche(null)} onMarquer={marquer}/>}
      <div className="vrm-lbc-tete" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        {/* Revue du 16 octobre : ce titre redisait l'onglet « Annonces » juste
            au-dessus. Il reste pour un lecteur d'écran, plus à l'œil. */}
        <h2 className="vrm-sr">Tes annonces Leboncoin</h2>
        <button type="button" onClick={reload} style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.text }}>{loading ? '…' : '↻ Actualiser'}</button>
      </div>
      {erreurReception && <LignePanne>La relecture de tes données Leboncoin a échoué. Les informations précédentes restent affichées. Réessaie avec Actualiser.</LignePanne>}
      {conseilsLbc.length > 0 && (
        <Card data-lbc-conseils={conseilsLbc.length} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>À faire sur Leboncoin</div>
          {conseilsLbc.slice(0, 4).map((c, i) => (
            <div key={c.k} data-lbc-conseil={c.k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: c.urg ? C.warn : C.accentSoft, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>{c.txt}</span>
              <button type="button" data-lbc-conseil-go={c.k} onClick={allerLbc(c)} style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, padding: '4px 11px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer', flexShrink: 0 }}>Voir</button>
            </div>
          ))}
        </Card>
      )}
      {/* ── ANTI DOUBLE VENTE : EN PREMIER, C'EST LE SEUL GESTE URGENT DE L'ÉCRAN ──
          Une paire vendue ici et encore en vente sur Vinted peut être achetée
          une deuxième fois. On le dit avec le N° et le lien ; VRM ne retire pas
          l'annonce Vinted tout seul (§3 : irréversible côté Vinted). */}
      {data && data.doublons && data.doublons.length > 0 && (
        <Card style={{ borderColor: C.warn }}>
          <div data-lbc-doublons={data.doublons.length} style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>
            {data.doublons.length} article{data.doublons.length > 1 ? 's' : ''} vendu{data.doublons.length > 1 ? 's' : ''} sur Leboncoin — encore sur Vinted
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>
            Retire-{data.doublons.length > 1 ? 'les' : 'la'} de Vinted maintenant, sinon quelqu'un peut l'acheter une deuxième fois. VRM ne le fait pas à ta place : sur Vinted, c'est sans retour.
          </div>
          {data.doublons.map((d) => {
            const ph = (Array.isArray(d.ad.images) && d.ad.images[0]) || '';
            return (
              <div key={String(d.vente.txId || d.ad.id)} data-doublon={d.numero} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>
                  {ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>N°{d.numero} · {d.vente.title || d.ad.subject || ''}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Leboncoin : {d.vente.stepLabel || 'vendue'}{d.vente.price != null ? ` · ${lbcEuro(d.vente.price)}` : ''}
                    {d.vendueVinted.length > 0 && <span style={{ color: C.warn, fontWeight: 700 }}> · vendue AUSSI sur Vinted : une des deux ventes ne pourra pas partir — annule-en une</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                {d.vintedUrl && <a href={d.vintedUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, textDecoration: 'none' }}>Ouvrir sur Vinted</a>}
                {data.liensMain && String(data.liensMain[String(d.ad.id)] || '').trim() && (
                  <button type="button" data-lbc-delier={String(d.ad.id)} onClick={() => { if (window.confirm(`Ce n'est pas la N°${d.numero} ? Je retire ce lien : la vente redevient « sans article » et tu pourras choisir le bon.`)) { delierAnnonceLbc(d.ad.id); reload(); } }}
                    style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>Pas le bon article</button>
                )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {data && data.aRelierVentes && data.aRelierVentes.length > 0 && (
        <Card>
          <Titre data-lbc-ventes-a-relier={data.aRelierVentes.length}>
            {data.aRelierVentes.length} vente{data.aRelierVentes.length > 1 ? 's' : ''} Leboncoin : quel article ?
          </Titre>
          <Sous>Un article qui y ressemble est encore en vente sur Vinted. Si c'est le même, touche-le : je te dirai de le retirer de Vinted.</Sous>
          {data.aRelierVentes.map(({ vente, ad, suggestions }) => (
            <LbcRelier key={String(vente.txId || ad.id)} ad={ad} numsConnus={data.numsConnus || []} onRelie={reload} suggestions={suggestions} vendue
              cleRangement={'tx:' + (vente.txId || ad.id)}
              detail={`Vendue${vente.price != null ? ' ' + lbcEuro(vente.price) : ''}${vente.stepLabel ? ' · ' + vente.stepLabel : ''}`}/>
          ))}
        </Card>
      )}
      {data && <AnnoncesLeboncoin owner={AUTH.user?.id||''} annonces={data.catalogueAds} ventes={data.catalogueVentes} lectureKO={data.lbcKO} numeroDe={numeroAnnonceLbc}/>}
      {/* ⚠️ UNE LECTURE RATÉE SE DIT UNE FOIS (§7). L'écran la disait jusqu'à quatre
          fois (ventes Leboncoin, compteur, preuve de vente, file vide) et, sur une
          lecture ratée de ses annonces Leboncoin, il affirmait « je n'ai pas encore
          vu tes annonces, ouvre leboncoin.fr » : le mauvais geste. Un seul bloc
          nomme ce qui n'a pas pu être lu, et ce que ça empêche. */}
      {data && (() => {
        const rates = [data.echecLecture && 'tes annonces Vinted', data.preuveKO && 'tes ventes Vinted', data.ventesLbcKO && 'tes ventes Leboncoin', data.lbcKO && 'tes annonces Leboncoin'].filter(Boolean);
        if (!rates.length) return null;
        const liste = rates.length === 1 ? rates[0] : rates.slice(0, -1).join(', ') + ' ni ' + rates[rates.length - 1];
        const effets = [
          data.preuveKO && 'la liste à publier peut contenir des paires déjà vendues sur Vinted',
          data.ventesLbcKO && "je n'ai pas pu vérifier qu'aucun article vendu ici n'est encore en vente sur Vinted",
          data.lbcKO && 'je ne peux pas te dire lesquelles retirer de Leboncoin',
          data.echecLecture && 'la file à publier est incomplète',
        ].filter(Boolean);
        return (
          <div data-lbc-lecture-ratee={rates.length} style={{ marginBottom: 12 }}>
            <LignePanne>Je n'ai pas pu lire {liste} — rien n'est perdu, c'est la lecture qui a échoué ; rouvre l'écran dans un moment. En attendant, {effets.join(', et ')}.</LignePanne>
          </div>
        );
      })()}
      {loading && !data ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '30px 16px' }}>Chargement…</div> : (<>
        {/* Compteur / offre */}
        {/* (23 oct., intégration) La carte ne s'affiche que s'il y a une limite ou
            une offre (main) — mais elle porte aussi « plus comptées en ligne » et
            « pas revues » (lot Leboncoin) : sans limite connue, ces deux lignes
            disparaissaient. Elle s'affiche dès que l'une des quatre a quelque chose à dire. */}
        {(lim || data.plan || (data.sortiesLbc || []).length > 0 || data.pasRevues > 0) && <Card className="vrm-lbc-compteur">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="vrm-display" style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{(data.lbcJamaisLu || data.lbcKO) && !data.postedCount ? '—' : n}</span>
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>annonce{n > 1 ? 's' : ''} sur Leboncoin{lim ? ` / ${lim}` : ''}</span>
          </div>
          {data.lbcJamaisLu && !data.postedCount && (
            <div style={{ fontSize: 11.5, color: C.warn, fontWeight: 600, marginTop: 5, lineHeight: 1.5 }}>
              Je n'ai pas encore vu tes annonces Leboncoin. Ouvre la page de <b>tes annonces</b> sur leboncoin.fr une fois, avec l'extension : je les lirai au passage.
              <br/>Tant que c'est le cas, je ne peux pas te dire <b>lesquelles retirer</b> quand un article se vend sur Vinted.
            </div>
          )}
          {/* ⚠️ « Offre : Gratuit » s'affichait quand AUCUNE offre n'était connue
              (mesuré : `plan` et `limit` jamais renseignés) — une valeur inventée. */}
          {data.plan ? <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginTop: 2 }}>Offre : {data.plan}</div> : null}
          {lim ? (<>
            <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 9 }}><div style={{ width: pct + '%', height: '100%', background: barCol, borderRadius: 999 }} /></div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 5, color: barCol }}>{n >= lim ? 'Limite atteinte' : n >= lim - 3 ? 'Tu approches de ta limite' : `Il te reste ${lim - n} annonce${lim - n > 1 ? 's' : ''}`}</div>
          </>) : null}
          {/* (22 oct.) Une liste COMPLÈTE de son compte ne montre plus certaines
              annonces : elles ne sont plus comptées en ligne. On dit combien et
              pourquoi, une fois — jamais « supprimée », jamais « vendue ». */}
          {(() => {
            const so = data.sortiesLbc || [];
            if (!so.length) return null;
            const pv = so.filter((x) => x.plusVueAt), pz = so.filter((x) => !x.plusVueAt && x.pauseAt);
            const dates = Object.values(data.lecturesLbc || {}).map((l) => Date.parse((l && l.at) || '')).filter(isFinite);
            const quand = dates.length ? new Date(Math.max(...dates)).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div data-lbc-plus-vues={so.length} style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {so.length} annonce{so.length > 1 ? 's' : ''} {so.length > 1 ? 'ne sont' : "n'est"} plus comptée{so.length > 1 ? 's' : ''} en ligne
                {pv.length ? <> : {pv.length} plus vue{pv.length > 1 ? 's' : ''} dans ta liste Leboncoin lue en entier{quand ? ` le ${quand}` : ''} (vendue, supprimée ou mise en pause : je ne sais pas laquelle)</> : null}
                {pz.length ? <>{pv.length ? ',' : ' :'} {pz.length} mise{pz.length > 1 ? 's' : ''} en pause depuis VRM</> : null}. Rien n'est effacé.
              </div>
            );
          })()}
          {/* (22 oct.) Pas revues depuis plus de 7 jours : on ne sait pas si elles
              y sont encore. Le geste qui tranche, selon l'extension d'ici. */}
          {data.pasRevues > 0 && (() => {
            const pe = pauseEtat();
            return (
              <div data-lbc-pas-revues={data.pasRevues} style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {data.pasRevues} annonce{data.pasRevues > 1 ? 's' : ''} Leboncoin pas revue{data.pasRevues > 1 ? 's' : ''} depuis plus de {data.pasRevuesJours > LBC_REVUE_JOURS ? data.pasRevuesJours : LBC_REVUE_JOURS} jours : je ne sais pas si elle{data.pasRevues > 1 ? 's y sont' : ' y est'} encore, je ne te demande donc pas à quel article {data.pasRevues > 1 ? 'les' : 'la'} relier.{' '}
                {pe === 'absente'
                  ? <>Sur l'ordinateur où l'extension est installée, ouvre ta page profil Leboncoin (celle qui liste toutes tes annonces) : elle relira ta liste en entier.</>
                  : pe === 'retard'
                    ? <>Mets l'extension à jour, puis ouvre ta page profil Leboncoin (celle qui liste toutes tes annonces) : elle relira ta liste en entier.</>
                    : <>Ouvre ta page profil Leboncoin dans ce Chrome (celle qui liste toutes tes annonces) : l'extension relira ta liste en entier et sortira celles qui n'y sont plus.</>}
              </div>
            );
          })()}
        </Card>}
        {/* À retirer (vendues sur Vinted) */}
        {/* ⚠️⚠️ « VENDUE » SE PROUVE, ELLE NE SE DÉDUIT PAS D'UNE ABSENCE.
            Ce bloc disait « Vendues sur Vinted → retire-les », en rouge, dès
            qu'une annonce n'était plus en ligne. Or elle peut sortir de la liste
            parce qu'il l'a mise en pause. Mesuré le 12 septembre : sur ses
            400 annonces fermées, **151 seulement** portent une vente prouvée par
            identité (`transaction → item_id`). Pour les 249 autres, « retire-la
            de Leboncoin » lui ferait perdre une vente sur une paire qu'il a
            encore. Trois états, et seul le prouvé est rouge — §5 « mieux vaut un
            blanc qu'un faux », et on dit « à vérifier », jamais « vendu ». */}
        {data.removals.length > 0 && (() => {
          const vendues = data.removals.filter(r => r.etat === 'vendue' && r.ou !== 'eBay');
          const venduesEbay = data.removals.filter(r => r.etat === 'vendue' && r.ou === 'eBay');
          const pause = data.removals.filter(r => r.etat === 'pause');
          const doute = data.removals.filter(r => r.etat !== 'vendue' && r.etat !== 'pause');
          const pe = pauseEtat();
          const Ligne = (r, i, coul, pausable) => (
            <div key={i} data-lbc-retirer={r.id || r.numero} data-lbc-retirer-sortie={r.sortie || undefined} style={{ fontSize: 12.5, color: C.text, padding: '3px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px' }}>
              <span><b>N°{r.numero}</b> · {r.title || '—'}
              {r.url ? <> · <a href={r.url} target="_blank" rel="noreferrer" style={{ color: coul, fontWeight: 700 }}>voir sur Leboncoin</a></> : null}
              {r.sortie ? <span style={{ color: C.muted }}> · {r.sortie === 'pause' ? "l'annonce reliée est en pause depuis VRM" : "l'annonce reliée n'est plus dans ta liste"}</span> : null}</span>
              {pausable && pe === 'ok' && r.lbc && r.id ? (
                <button type="button" data-lbc-pause={r.id} disabled={!!pauseEnVol} onClick={() => mettreEnPause(r)}
                  style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: pauseEnVol ? 'default' : 'pointer', opacity: pauseEnVol && pauseEnVol !== r.id ? 0.5 : 1 }}>
                  {pauseEnVol === r.id ? 'Mise en pause…' : '⏸ Mettre en pause sur Leboncoin'}
                </button>
              ) : null}
            </div>
          );
          const pausables = vendues.some((r) => r.lbc && r.id);
          // (22 oct., revue) Une paire dont l'annonce RELIÉE est sortie, mais sans
          // la preuve qu'aucune autre annonce de la paire n'est en ligne : la ligne
          // reste (sens sûr). Le pourquoi et le geste, une fois (§7).
          const nDoute = data.removals.filter((r) => r.sortie).length;
          // La phrase vit dans la PREMIÈRE carte qui porte une telle ligne, une fois.
          const carteDoute = vendues.some((r) => r.sortie) ? 'vendues' : doute.some((r) => r.sortie) ? 'doute' : pause.some((r) => r.sortie) ? 'pause' : null;
          const phraseDoute = nDoute > 0 ? (
            <div data-lbc-retirer-doute={nDoute} style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>
              {nDoute > 1 ? `Pour ${nDoute} de ces paires` : 'Pour une de ces paires'}, l'annonce Leboncoin reliée n'est plus en ligne, mais je ne peux pas encore te dire qu'<b>aucune autre</b> annonce de la paire ne l'est (ton autre compte, une annonce republiée). Vérifie, ou ouvre ta page profil Leboncoin sur chacun de tes comptes : une fois ta liste relue en entier, la ligne partira d'elle-même.
            </div>
          ) : null;
          return (<>
            {vendues.length > 0 && (
              <Card style={{ borderColor: C.warn }}>
                <Titre>{vendues.length} vendue{vendues.length > 1 ? 's' : ''} sur Vinted — à retirer de Leboncoin</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>La vente est <b>certaine</b> (la transaction Vinted désigne cette annonce). Retire-{vendues.length > 1 ? 'les' : 'la'} de Leboncoin pour ne pas vendre le même article deux fois — cherche la référence <b>VRM-N°</b> dans l'annonce. Le numéro de l'article ne change pas.
                  {pausables && pe === 'ok' ? <> <span data-lbc-pause-geste="ok">Ou mets-{vendues.length > 1 ? 'les' : 'la'} en pause d'ici, une à la fois : ce n'est pas une suppression, elle se remet en ligne depuis « Mes annonces ».</span></> : null}
                  {pausables && pe === 'retard' ? <> <span data-lbc-pause-geste="retard">Pour {vendues.length > 1 ? 'les' : 'la'} mettre en pause d'ici, mets l'extension à jour (Réglages).</span></> : null}
                </div>
                {vendues.slice(0, 30).map((r, i) => Ligne(r, i, C.danger, true))}
                {carteDoute === 'vendues' ? phraseDoute : null}
              </Card>
            )}
            {venduesEbay.length > 0 && (
              <Card style={{ borderColor: C.warn }}>
                <Titre>{venduesEbay.length} vendue{venduesEbay.length > 1 ? 's' : ''} sur eBay — à retirer de Leboncoin</Titre>
                <div data-lbc-retirer-ebay={venduesEbay.length} style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>La vente eBay est <b>certaine</b> (le SKU <b>VRM-N°</b> de la commande désigne cette paire). Retire-{venduesEbay.length > 1 ? 'les' : 'la'} de Leboncoin pour ne pas vendre le même article deux fois. Le numéro de l'article ne change pas.
                  {venduesEbay.some((r) => r.lbc && r.id) && pe === 'ok' ? <> <span data-lbc-pause-geste-ebay="ok">Ou mets-{venduesEbay.length > 1 ? 'les' : 'la'} en pause d'ici, une à la fois : ce n'est pas une suppression.</span></> : null}
                  {venduesEbay.some((r) => r.lbc && r.id) && pe === 'retard' ? <> <span data-lbc-pause-geste-ebay="retard">Pour {venduesEbay.length > 1 ? 'les' : 'la'} mettre en pause d'ici, mets l'extension à jour (Réglages).</span></> : null}
                </div>
                {venduesEbay.slice(0, 30).map((r, i) => Ligne(r, i, C.danger, true))}
              </Card>
            )}
            {doute.length > 0 && (
              <Card>
                <Titre>{doute.length} plus en ligne sur Vinted — à vérifier</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Ces annonces ne sont plus sur Vinted, mais <b>je n'ai pas la preuve qu'elles sont vendues</b> : tu as peut-être simplement retiré l'annonce. Ouvre-les et décide — je ne te dis pas de les supprimer.</div>
                {doute.slice(0, 30).map((r, i) => Ligne(r, i, C.warn))}
                {carteDoute === 'doute' ? phraseDoute : null}
              </Card>
            )}
            {pause.length > 0 && (
              <Card>
                <Titre>{pause.length} en pause sur Vinted</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Tu les as masquées sur Vinted, elles ne sont pas vendues. Elles restent sur Leboncoin : <b>rien à faire</b>.</div>
                {pause.slice(0, 20).map((r, i) => Ligne(r, i, C.muted))}
                {carteDoute === 'pause' ? phraseDoute : null}
              </Card>
            )}
          </>);
        })()}
        {/* (22 oct.) Ce que Leboncoin a répondu à chaque mise en pause demandée
            d'ici — la ligne « à retirer » disparaît une fois la pause acceptée,
            la réponse, elle, reste lisible. */}
        {pauseRes.length > 0 && (
          <Card className="vrm-lbc-pauses">
            <Titre>Mise en pause sur Leboncoin</Titre>
            {pauseRes.map((x) => { const p = phrasePause(x); return (
              <div key={x.id} data-lbc-pause-resultat={x.id} data-etape={p.etape} style={{ fontSize: 12.5, color: p.etape === 'fait' ? C.text : C.warn, padding: '3px 0', lineHeight: 1.45 }}>
                <b>N°{x.numero}</b> · {x.titre || '—'} — {p.t}
              </div>
            ); })}
          </Card>
        )}
        {/* ⚠️⚠️ LA PREUVE DE VENTE N'A PAS PU ÊTRE LUE : la file peut contenir des
            paires déjà vendues. Mesuré le 15 septembre — une lecture ratée a fait
            passer la file de 40 à 55. On ne cache pas la liste, on dit ce qu'on
            n'a pas pu vérifier. */}
        {/* « Je n'ai pas pu vérifier lesquelles sont déjà vendues » est dit une fois,
            dans le bloc des lectures ratées en haut de l'écran. */}
        {/* Annonces Leboncoin non reliées à une paire VRM : informatif. On ne les
            présente JAMAIS comme « à retirer » (VRM ne connaît pas la paire). */}
        {data.unlinked && data.unlinked.length > 0 && (
          <Card className="vrm-lbc-non-reliees">
            <Titre>{data.unlinked.length} annonce{data.unlinked.length > 1 ? 's' : ''} Leboncoin non reliée{data.unlinked.length > 1 ? 's' : ''}</Titre>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>VRM ne sait pas quel article c'est. Choisis le bon article s'il est proposé, ou tape son <b>N°</b> et « Relier » : elle sera suivie comme les autres (vendue sur Vinted → à retirer d'ici, et l'inverse).</div>
            {data.unlinked.slice(0, 40).map((u) => <LbcRelier key={String(u.id || u.url || u.subject)} ad={u} numsConnus={data.numsConnus || []} onRelie={reload} suggestions={u.suggestions} cleRangement={u.id != null ? 'ad:' + u.id : ''}/>)}
            {data.unlinked.length > 40 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>… et {data.unlinked.length - 40} autre{data.unlinked.length - 40 > 1 ? 's' : ''}.</div>}
          </Card>
        )}
        {/* Diagnostic fourni par Leboncoin lui-même sur tes annonces en ligne. */}
        {(() => {
          const flagged = (data.liveAds || []).filter(a => a.issue);
          if (!flagged.length) return null;
          return (
            <Card>
              <Titre>{flagged.length} annonce{flagged.length > 1 ? 's' : ''} signalée{flagged.length > 1 ? 's' : ''} par Leboncoin</Titre>
              <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>C'est Leboncoin qui le dit dans ton espace pro : ces annonces sortent mal. Baisse le prix, améliore le titre/les photos, ou passe une option de visibilité.</div>
              {flagged.slice(0, 20).map((a, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.text, padding: '3px 0' }}>
                  {a.subject || '—'}{a.price != null && isFinite(Number(a.price)) ? ` · ${Number(a.price).toFixed(2).replace('.', ',')} €` : ''} · <span style={{ color: C.warn, fontWeight: 700 }}>{a.issue === 'LowVisibility' ? 'peu visible' : a.issue}</span>
                  {a.url ? <> · <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C.blue || C.accent, fontWeight: 700 }}>voir</a></> : null}
                </div>
              ))}
            </Card>
          );
        })()}
        {/* À publier */}
        <Card className="vrm-lbc-a-publier">
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{data.echecLecture ? '—' : data.queue.length} à publier sur Leboncoin{data.autoMatched > 0 ? <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}> · {data.autoMatched} déjà reconnue{data.autoMatched > 1 ? 's' : ''} en ligne</span> : null}</div>
          {/* ⚠️ UNE ANNONCE QUE TU AS RETIRÉE NE DISPARAÎT PAS EN SILENCE.
              Sans cette ligne, désélectionner faisait fondre la file sans que
              rien ne dise pourquoi — et « 0 à publier » se serait lu « tout est
              fait ». On dit combien, et où c'est réglé. */}
          {data.vendues > 0 && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.vendues} article{data.vendues > 1 ? 's' : ''} {data.vendues > 1 ? 'sont' : 'est'} <b>déjà vendu{data.vendues > 1 ? 's' : ''} sur Vinted</b> — {data.vendues > 1 ? 'ils ne sont' : "il n'est"} pas dans cette file. (Vinted laisse parfois l'annonce ouverte après la vente ; c'est la transaction qui fait foi.)
            </div>
          )}
          {/* ⚠️ Revue de la 5.167 : les annonces « à confirmer » (compte pas relu
              depuis 24 h) sortaient de la file SANS UN MOT — et quand c'étaient
              toutes, l'écran affirmait « tu n'as pas encore d'annonce en ligne ».
              La cause est connue : on la dit, une fois, au-dessus de la file. */}
          {data.aConfirmer > 0 && !data.echecLecture && (
            <div data-lbc-a-confirmer={data.aConfirmer} style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.aConfirmer} annonce{data.aConfirmer > 1 ? 's' : ''} {data.aConfirmer > 1 ? 'ne sont' : "n'est"} pas dans cette file : {data.aConfirmer > 1 ? 'leurs comptes n’ont' : 'son compte n’a'} pas été relu{data.aConfirmer > 1 ? 's' : ''} depuis plus de 24 h — <b>à confirmer</b> (le détail est sur l'écran <b>Annonces</b>). Rien n'est supprimé.
            </div>
          )}
          {data.retirees > 0 && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.retirees} annonce{data.retirees > 1 ? 's' : ''} en ligne {data.retirees > 1 ? 'ne sont' : "n'est"} pas dans cette file : tu {data.retirees > 1 ? 'les' : "l'"}as retirée{data.retirees > 1 ? 's' : ''} de Leboncoin. Ça se règle annonce par annonce sur l'écran <b>Annonces</b> (la puce « Aussi sur »).
            </div>
          )}
          {/* ⚠️ « Tout est publié 🎉 » se disait aussi quand la file était vide
              parce que la base n'avait pas répondu — une fête sur une lecture
              ratée. Le 🎉 ne sort que si on a pu REGARDER. */}
          {data.queue.length === 0 ? (data.echecLecture
            ? <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Cette file est vide parce que la lecture a échoué (voir plus haut), pas parce qu'il ne reste rien à publier.</div>
            /* ⚠️⚠️ TROISIÈME CAUSE, VUE AU RENDU LE 16 SEPTEMBRE SUR UNE
               INSTALLATION NEUVE : « Tout est publié 🎉 (toutes tes paires
               numérotées en ligne sont sur Leboncoin) » s'affichait à quelqu'un
               qui n'a AUCUNE annonce. Rien n'est publié, et la parenthèse
               affirme une chose qui ne veut rien dire sur zéro paire. Une file
               vide a ici encore une cause connue — et une cause connue se dit.
               Troisième forme, après « lecture ratée » et « tout décoché ». */
            /* Quatrième cause (revue de la 5.167) : tout est « à confirmer » — la
               ligne au-dessus le dit ; affirmer « pas encore d'annonce » serait faux. */
            : data.nEnLigne === 0 && data.aConfirmer > 0
              ? <div data-lbc-vide="a-confirmer" style={{ fontSize: 12, color: C.muted }}>Rien à proposer tant que ces comptes ne sont pas relus — l'écran <b>Annonces</b> dit lesquels et comment.</div>
            : data.nEnLigne === 0
              ? <div style={{ fontSize: 12, color: C.muted }}>Tu n'as pas encore d'annonce en ligne sur Vinted — c'est de là que vient cette file. Dès qu'il y en aura, elles apparaîtront ici.</div>
            : data.nNumerotees === 0
              ? <div style={{ fontSize: 12, color: C.muted }}>Tes {data.nEnLigne} annonce{data.nEnLigne > 1 ? 's' : ''} en ligne n'{data.nEnLigne > 1 ? 'ont' : 'a'} pas encore de numéro de rangement — c'est lui qui sert de référence sur Leboncoin. Ça se pose sur l'écran <b>Annonces</b>.</div>
            : data.retirees > 0 && data.autoMatched === 0
              // ⚠️ « Tout est publié 🎉 » serait faux : rien n'est publié, tout
              //    a été retiré de la file. Deux causes, deux phrases.
              ? <div style={{ fontSize: 12, color: C.muted }}>Rien dans la file — tu as retiré de Leboncoin toutes tes annonces en ligne.</div>
              : <div style={{ fontSize: 12, color: C.muted }}>Tout est publié 🎉 (toutes tes paires numérotées en ligne sont sur Leboncoin).</div>) : (<>
            {/* ⚠️⚠️ « EXACTEMENT TEL QU'IL PARTIRA » EST UNE PROMESSE SUR L'EXTENSION.
                C'est ELLE qui publie, avec SA version de la règle : une extension
                antérieure à 5.55.4 enverra l'ancien titre, coupé en plein mot.
                Sans cette garde, l'app promettrait ce que l'extension installée ne
                sait pas faire — le défaut le plus coûteux du projet, déjà refait
                quatre fois (le zip, les codes de retrait, les places, eBay). */}
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {extSait('lbctitre') === 'ok'
                ? <Pourquoi ecrit label="Ce que VRM publie">Voici le titre <b>exactement tel qu'il partira</b> sur Leboncoin (50 caractères max, la taille à la fin). L'extension y joint la description et les photos, puis publie sans option payante.</Pourquoi>
                : extSait('lbctitre') === 'absente'
                  /* Revue du 16 octobre : « la publication se fait depuis ton
                     ordinateur » était dit ici ET dans la ligne juste dessous
                     (`RaisonPublication`) — une cause, une phrase (§7). */
                  ? <Pourquoi ecrit label="Ce que VRM publie">Voici le titre <b>que VRM proposera</b> sur Leboncoin (50 caractères max, la taille à la fin).</Pourquoi>
                  : <>Voici le titre <b>que VRM propose</b>. ⚠️ <b>Ton extension est plus ancienne que la {EXT_CAPACITES.lbctitre}</b> : elle publiera encore l'ancien titre (coupé en plein mot). Mets-la à jour depuis Réglages pour que ce soit ce titre-là qui parte.</>}
            </div>
            {/* ⚠️ LA LISTE SE GROUPE SUR CE QU'IL PEUT FAIRE, pas sur le numéro.
                C'est la loi de l'écran Colis : mesuré ici, 54 des 59 annonces
                partiraient avec UNE SEULE photo, parce que les photos HD ne sont
                lues que sur la page de l'annonce (l'API Vinted n'en renvoie
                aucune — 0 sur 57 lignes, vérifié). Mettre ces 54 en haut, c'est
                mettre devant ce qui fera une annonce bâclée. */}
            <RaisonPublication n={data.queue.length} place="lbc"/>
            <LbcCroitVendue n={data.queue.filter(q => q.croitVendue).length}/>
            {(() => {
              const pretes = data.queue.filter(q => q.photos >= 2);
              const maigres = data.queue.filter(q => q.photos === 1);
              // ⚠️ VU EN CAPTURE : « N°30 · 49,00 € · 0 photo », rangée sous
              //    « Une seule photo ». Une annonce sans AUCUNE photo ne peut
              //    pas être publiée sur Leboncoin — ce n'est pas une nuance,
              //    c'est un blocage, et il doit être en haut.
              const nues = data.queue.filter(q => q.photos === 0);
              // Un seul groupe ⇒ pas de titre de groupe : il répéterait le
              //    compte de l'en-tête (§7, le même nombre deux fois).
              const groupes = [pretes, maigres, nues].filter(g => g.length).length;
              // (17 oct.) UNE CARTE PAR PAIRE — Julien : « j'aime pas le visuel des
              // propositions de paires à publier ». La photo en grand, le N° et
              // le prix d'un coup d'œil, ce qui manque en pastilles (l'ambre
              // seulement pour ce qui BLOQUE), les gestes en bas. La même paire
              // sous deux N° (photo exacte) : la seconde ne propose pas de
              // publier, elle dit laquelle est la bonne.
              const Ligne = (q) => {
                const toutes = Array.isArray(q.photosAll) ? q.photosAll : [];
                // Combien MANQUENT à la capture (le vrai nombre d'après Vinted).
                const manque = (q.nReelles != null && q.nReelles > q.photos) ? (q.nReelles - q.photos) : 0;
                const jm = q.jumelle || null;
                const vign = toutes.slice(1, 7);
                return (
                <div key={q.id} className="vrm-apub-carte" data-apub={q.numero} {...(jm ? { 'data-apub-jumelle': cleNum(jm.num) } : {})}>
                  <div className="vrm-apub-haut">
                    {toutes[0]
                      ? <PhotoVinted src={toutes[0]} alt="" loading="lazy" decoding="async" className="vrm-apub-photo" style={{ width: 84, height: 84, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      : <span className="vrm-apub-photo"><Icon name="image" size={24} style={{ opacity: .5 }} /></span>}
                    <div className="vrm-apub-corps">
                      <div className="vrm-apub-ligne1">
                        <span className="vrm-apub-num">N°{q.numero}</span>
                        <span className="vrm-apub-prix">{q.prix != null ? q.prix.toFixed(2).replace('.', ',') + ' €' : '—'}</span>
                      </div>
                      <div className="vrm-apub-titre">{q.title || '—'}</div>
                      <div className="vrm-apub-pastilles">
                        <span className="vrm-apub-pastille" data-ton={q.photos === 0 ? 'bloque' : undefined}>{q.photos === 0 ? 'Aucune photo' : `${q.photos}${q.nReelles != null && q.nReelles > q.photos ? `/${q.nReelles}` : ''} photo${q.photos > 1 ? 's' : ''}`}</span>
                        {!q.desc && <span className="vrm-apub-pastille">Pas de description</span>}
                        {q.compte ? <span className="vrm-apub-pastille">{q.compte}</span> : null}
                      </div>
                    </div>
                  </div>
                  {(vign.length > 0 || manque > 0) && (
                    <div className="vrm-apub-vignettes">
                      {vign.map((src, i) => <PhotoVinted key={i} src={src} alt="" loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />)}
                      {manque > 0 && <span className="vrm-apub-plus" data-photos-manquantes={manque} title={`${manque} autre${manque > 1 ? 's' : ''} photo${manque > 1 ? 's' : ''} sur Vinted, pas encore récupérée${manque > 1 ? 's' : ''} : ouvre l'annonce sur Vinted`}>+{manque}</span>}
                    </div>
                  )}
                  {jm && <div className="vrm-apub-jumelle" data-apub-jumelle-texte="">{jm.posee
                    ? <>Même photo que la <b>N°{jm.num}</b>, déjà sur Leboncoin : c'est le même article, il ne se publie pas deux fois.</>
                    : <>Même photo que la <b>N°{jm.num}</b> : c'est sans doute le même article sous deux N°. Publie la N°{jm.num} seulement.</>}</div>}
                  <div className="vrm-apub-gestes">
                    {/* Le bouton dit les photos captées sur le total (11 octobre) —
                        une fois, là où on décide de publier (§7). */}
                    {!jm && q.photos > 0 && <BoutonPublier place="lbc" id={q.id} croitVendue={!!q.croitVendue} photos={q.photos} total={q.nReelles} onFiche={() => setFiche(q)}/>}
                    <a href={q.url} target="_blank" rel="noreferrer" className="vrm-apub-lien">Annonce Vinted ↗</a>
                    <button type="button" onClick={() => marquer(q.id)} title="Tu l'as déjà publiée toi-même : elle sort de la file" className="vrm-apub-lien">Déjà publiée</button>
                  </div>
                </div>
                );
              };
              const Groupe = ({ titre, liste, note, ton }) => (<>
                {groupes > 1 && <div className="vrm-apub-groupe"><span className="vrm-apub-groupe-titre" style={ton ? { color: C.warn } : undefined}>{titre}</span><span className="vrm-apub-groupe-n">{liste.length}</span></div>}
                {note ? <div className="vrm-apub-groupe-note">{note}</div> : null}
                <div className="vrm-apub-grille">{liste.slice(0, 40).map(Ligne)}</div>
                {liste.length > 40 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>+ {liste.length - 40} autres…</div>}
              </>);
              return (<>
                {nues.length > 0 && <Groupe titre="Aucune photo" ton liste={nues} note={<>Leboncoin <b>refuse une annonce sans photo</b>. Ouvre l'annonce sur Vinted, sur ton ordinateur : ses photos arrivent ici au passage.</>} />}
                {pretes.length > 0 && <Groupe titre="Prêtes" liste={pretes} />}
                {maigres.length > 0 && <Groupe titre="Une seule photo" liste={maigres} note={<>Une annonce Leboncoin avec une seule photo se vend mal. <b>Vinted ne donne les autres que sur la page de l'annonce</b> : ouvre-la une fois sur ton ordinateur et elles arrivent ici toutes seules.</>} />}
              </>);
            })()}
          </>)}
        </Card>
      </>)}
      {/* ── DÉTAILS ET RÉGLAGES, REPLIÉS (4 octobre) ─────────────────────────
          Julien : « que Leboncoin soit beaucoup plus intuitif ». Mesuré : la
          liste « à publier » — la seule chose qu'il fait vraiment ici — était
          le DERNIER de douze blocs, après la préparation de la publication, un
          paragraphe d'explication, les comptes et la limite de l'offre. Ce qui
          se LIT une fois descend ici ; ce qui se FAIT reste en haut. */}
      {data && Array.isArray(data.liensPoses) && data.liensPoses.length > 0 && (
        <details data-lbc-liens={data.liensPoses.length} className="vrm-repli" style={{ marginTop: 6 }}>
          <summary>Paires que tu as reliées ({data.liensPoses.length}) — corriger une erreur</summary>
          <Card>
            {data.liensPoses.map((l, i) => (
              <div key={l.id} data-lien-lbc={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>
                  {l.image ? <PhotoVinted src={l.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre || 'Annonce Leboncoin'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>reliée à la N°{l.numero}</div>
                </div>
                <button type="button" data-lbc-delier={l.id} onClick={() => { if (window.confirm(`Retirer le lien avec la N°${l.numero} ? L'annonce redevient « non reliée » et tu pourras choisir la bonne paire.`)) { delierAnnonceLbc(l.id); reload(); } }}
                  style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer' }}>Délier</button>
              </div>
            ))}
          </Card>
        </details>
      )}
      {data && (
        <details data-lbc-details="" className="vrm-repli" style={{ marginTop: 6 }}>
          <summary>Détails et réglages</summary>
          <div style={{ paddingTop: 8 }}>
      {/* ══════════════════════════════════════════════════════════════════════
          PUBLIER TOUT SEUL : OÙ ÇA EN EST, ET CE QUI FAIT AVANCER
          ══════════════════════════════════════════════════════════════════════
          L'extension collecte depuis quatre versions — le catalogue des codes de
          Leboncoin, la config de son formulaire (qui est DYNAMIQUE : mesuré,
          `api/adsubmit/dynamic-deposit/config`), la forme de ce qui part — et
          l'app n'en montrait RIEN. Julien ne pouvait donc pas savoir si ça
          avançait, ni quel geste faisait avancer : il a refait trois dépôts à la
          main sans jamais voir de retour. C'est le motif du tiroir `Nav` (§4.11),
          sur la chose qu'il attend.
          ⚠️ On écrit des FAITS — des tailles, des dates, des noms d'endpoint — et
             le GESTE. Jamais « bientôt », jamais un pourcentage inventé. */}
      {(() => {
        const p = data && data.prep;
        if (p === undefined) return null;
        // Trois états, jamais deux : pas su · jamais publié · lu.
        const morceaux = (p && p.morceaux) || {};
        const PIECES = [
          ['codes', 'Les codes de Leboncoin', 'marques, tailles, états — leurs valeurs exactes'],
          ['config', 'La composition du formulaire', 'quels champs, dans quel ordre, par catégorie'],
          ['prerempli', 'Ce que Leboncoin remplit tout seul', 'la catégorie, la description et le prix qu’il propose'],
          ['soumission', 'La forme de la publication', 'les champs attendus quand on valide'],
        ];
        const aPiece = (k) => { const m = morceaux[k]; return m && m.taille > 0 ? (m.coupe ? 'coupe' : 'ok') : 'non'; };
        const faits = PIECES.filter(([k]) => aPiece(k) === 'ok').length;
        const coupes = PIECES.filter(([k]) => aPiece(k) === 'coupe').length;
        const pastille = (e) => e === 'ok' ? { t: '✓', c: INV_STATUS.online.color } : e === 'coupe' ? { t: '⚠', c: C.warn } : { t: '·', c: C.muted };
        // Le geste : un seul, celui qui débloque le plus. Jamais une liste.
        // Tout reçu : la carte n'a plus rien à apprendre — elle disparaît (§7).
        if (p && p.majAt && ['codes', 'config', 'prerempli', 'soumission'].every((k) => { const m = morceaux[k]; return m && m.taille > 0 && !m.coupe; })) return null;
        const geste = p === null ? null
          : !p.majAt ? { q: 'Mets l’extension à jour, puis passe une fois sur leboncoin.fr.', d: 'Rien n’a encore été relevé : c’est la visite qui déclenche tout.' }
          : aPiece('codes') !== 'ok' ? { q: 'Passe une fois sur leboncoin.fr.', d: 'Leboncoin envoie ses codes au chargement — l’extension les attrape au passage.' }
          : aPiece('config') !== 'ok' || aPiece('soumission') !== 'ok'
            ? { q: 'Dépose une annonce à la main, jusqu’au bout.', d: 'C’est le seul moment où Leboncoin envoie la composition du formulaire et la forme de la publication.' }
            : null;
        return (
          <Card style={{ borderColor: C.border }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 2 }}>Publier sans rien retaper — préparation</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              {p === null
                ? 'Je n’ai pas pu lire où ça en est. Rien n’est perdu — rouvre cet écran dans un moment.'
                : <>Le formulaire de Leboncoin n’est pas le même d’une annonce à l’autre : il est <b>construit</b> à partir d’une configuration qu’il envoie. Il me faut ces quatre pièces pour remplir juste — <b>{faits} sur {PIECES.length}</b> {faits > 1 ? 'reçues' : 'reçue'}{coupes ? `, ${coupes} incomplète${coupes > 1 ? 's' : ''}` : ''}.</>}
            </div>
            {p !== null && (
              <div style={{ display: 'grid', gap: 5, marginBottom: geste ? 10 : 0 }}>
                {PIECES.map(([k, titre, quoi]) => {
                  const e = aPiece(k); const pa = pastille(e); const m = morceaux[k] || {};
                  return (
                    <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ color: pa.c, fontWeight: 800, width: 12, flexShrink: 0 }}>{pa.t}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: e === 'non' ? C.muted : C.text, fontWeight: e === 'non' ? 500 : 700 }}>{titre}</span>
                        <span style={{ color: C.muted }}> — {quoi}</span>
                        {e === 'coupe' && <span style={{ color: C.warn }}> · reçue incomplète, elle se recomplètera à ta prochaine visite</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {geste && (
              <div style={{ fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px' }}>
                <b>{geste.q}</b> <span style={{ color: C.muted }}>{geste.d}</span>
              </div>
            )}

          </Card>
        );
      })()}
      {/* ⚠️ MÊME DÉFAUT QUE LA LIGNE DES PLACES, TROUVÉ EN BALAYANT « télécharg » :
          cette phrase-ci disait aussi « photos téléchargées » et n'était gardée
          par AUCUNE version. Depuis la 5.58 elles s'attachent au formulaire.
          *Une suppression « terminée » se vérifie sur ce qui RESTE* — le premier
          correctif n'avait touché qu'un des deux endroits. */}
      {/* ⚠️⚠️ ET ELLE NE CONNAISSAIT QUE DEUX ÉTATS — vu au rendu le 15 septembre
          sur ses vraies données. `extSait` en rend TROIS, et le troisième est
          celui de son iPhone : **absente**. L'écran lui annonçait alors
          « photos téléchargées dans un dossier » — la description d'un
          comportement qui ne peut PAS avoir lieu (sans extension, rien n'est
          téléchargé ni attaché), au lieu de lui dire le vrai geste : ouvrir
          l'app sur l'ordinateur où elle est installée. C'est exactement le trou
          du premier jet d'`extSaitLireCodes` (« l'extension la plus en retard
          était la seule à ne rien déclencher »), et l'écran Annonces, lui,
          traitait déjà les trois. *« Pas su » ne vaut pas « oui ».* */}
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>La file est construite à partir de tes <b>annonces réellement en ligne sur Vinted</b> (comptes actifs uniquement, paires retirées exclues). {(() => {
        // Trois états, jamais deux (§ extSait) — et la phrase suit la version
        // INSTALLÉE : c'est l'extension qui publie, avec SA règle.
        const e = extSait('publication');
        if (e === 'ok') return <>Chaque paire a son bouton <b>« Publier sur Leboncoin »</b> : l'extension ouvre le dépôt, attache les photos, remplit tout et publie <b>sans option payante</b>.</>;
        if (e === 'retard') return <>Le bouton <b>« Publier sur Leboncoin »</b> arrive avec l'extension <b>{EXT_CAPACITES.publication}</b> : mets-la à jour depuis <b>Réglages</b>. En attendant, celle installée publie encore depuis son panneau sur leboncoin.fr.</>;
        return <>La publication part de l'ordinateur où l'extension est installée : ouvre cet écran là-bas et clique « Publier » sur la paire. Cette liste, elle, se consulte de partout.</>;
      })()}</div>

      {/* COMPTES LEBONCOIN — plusieurs comptes possibles. On liste ceux que
          l'extension a réellement vus connectés dans le navigateur, avec le
          nombre d'annonces rattachées à chacun. Sans ça, impossible de savoir
          depuis quel compte republier. */}
      {data && (data.lbcAccounts || []).length > 1 && (
        <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 16, padding: '13px 15px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Comptes Leboncoin détectés</div>
          {data.lbcAccounts.map(a => {
            const nb = ((data.parCompte || {})[String(a.id)] || []).length;
            const vu = a.seenAt ? new Date(a.seenAt) : null;
            const jours = vu ? Math.floor((Date.now() - vu.getTime()) / 86400000) : null;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: C.bg, border: `1px solid ${C.border}`, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {String(a.name || '?').slice(0, 1).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span data-compte-lbc-nom={a.id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name || 'nom pas encore lu'}{a.type === 'pro' ? ' · pro' : a.type === 'particulier' ? ' · particulier' : ''}</span>
                  <span data-compte-lbc-annonces={nb} style={{ display: 'block', fontSize: 10.5, color: C.muted, marginTop: 1 }}>
                    {data.lbcConnecte && String(data.lbcConnecte.id) === String(a.id) ? 'dernier compte relevé · ' : ''}{nb} annonce{nb > 1 ? 's' : ''}{jours != null ? ` · vu ${jours === 0 ? "aujourd'hui" : `il y a ${jours} j`}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Un compte apparaît ici dès que tu ouvres Leboncoin avec l'extension active, connecté dessus.
          </div>
        </div>
      )}
            <Card>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>Limite de ton offre Leboncoin</div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>{data.limit ? `${data.limit} annonces au maximum${data.plan ? ` · offre ${data.plan}` : ''}.` : 'Pas encore indiquée : le compteur ne peut pas te prévenir avant la limite.'}</div>
              <QuotaLbc limit={data.limit} plan={data.plan} onFait={reload}/>
            </Card>
          </div>
        </details>
      )}
    </div>
  );
}

export default LeboncoinScreen;
