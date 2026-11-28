// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import React, { useState, useEffect, Suspense } from 'react';
import { lazySur } from '../chargementSur.js';
import { fraisVc } from '../../api/_lib/vestiaire-regle.js';
import { CLE_FUSIONS, aliasDuNumero, opsDefaire, defaisable, finDefaire } from '../fusionFiches.js';
import { tr } from '../i18n/index.js';
import { AUTH, Bouton, FeuilleFusionLazy, Icon, InfosPaireFeuilleP, MAG_FUSIONS, PhotoVinted, SB_CONFLICT, STUDIO_BASE, SUPABASE_URL, Segmente, SheetShellSurFiche, aLaDemande, aLaDemandeDiscret, askConfirm, cleNum, commandeEbayEngagee, ecrireInfosPaire, gesteVrm, lecturePrixPro, load, ouvrirAtelier, paireIdentifiable, proposerFusion, rangementDuNum, sbAuth, toast, useInfosPaire, useProfilVendeur, withOwner } from '../App.jsx';

import { fraisVintedSelon, statutVinted, tauxEbay, tauxVestiaire } from '../ouVendre.js';
// ⟦← App.jsx #3⟧
import { cleCertificat } from '../certificatPaire.js';

// ⟦← App.jsx #1⟧
// ⟦→ ecrans/Comptabilite.jsx #40⟧
const InfosPaireVueP = lazySur(() => import('../InfosPaire.jsx').then((m) => ({ default: m.InfosPaireVue })));
// ⟦← App.jsx #2⟧
// (17 nov., fiabilité-vitesse) à la demande, hors du morceau App : OuVendre (était importé en statique)   // (15 nov., lot securite-ventes) « Où vendre cet article ? » sur la fiche
const OuVendre = aLaDemandeDiscret(() => import('../OuVendre.jsx'));
// ⟦← App.jsx #4⟧

// ══════════════════════════════════════════════════════════════════════════════
// (14 nov., propositions 102-107) PHOTOS ET FICHES — docs/passation/2026-11-14-photos-fiches.md
// La partie « Atelier » de la fiche (photos du studio et leur avis floue / sombre, note
// dictée, certificat d'authenticité, fusion de deux fiches), la séance photo et la
// recherche par couleur. Les règles : src/qualitePhoto.js, src/seancePhoto.js,
// src/couleurPhoto.js, src/certificatPaire.js, src/fusionFiches.js, src/noteVocale.js
// (modules purs, audités). Tout se charge À LA DEMANDE.
// ══════════════════════════════════════════════════════════════════════════════
const AtelierPaireLazy = aLaDemande(() => import('../AtelierPaire.jsx'));
// ⟦← App.jsx #5⟧
const BASE_CERTIFICAT = { fetch: (...a) => fetch(...a), url: SUPABASE_URL, auth: (x) => sbAuth(x), withOwner: (r) => withOwner(r), get conflit() { return SB_CONFLICT; }, get owner() { return (AUTH.user && AUTH.user.id) || ''; } };
// ⟦← App.jsx #6⟧
function AtelierPaireCoque({ num, itemId = '', idFiche = '' }) {
  const registre = React.useSyncExternalStore(MAG_FUSIONS.abonner, MAG_FUSIONS.lire);
  const [fusionOuverte, setFusionOuverte] = React.useState(false);
  const k = cleNum(num);
  const paire = { numero: num, itemId };
  const alias = aliasDuNumero(registre, num, cleNum);
  const studio = { cle: k, lire: () => import('../studioPhoto.js').then((m) => m.lireStudio(STUDIO_BASE, k)), ouvrir: () => ouvrirAtelier('studio', { num: k }) };
  const certificat = { cle: cleCertificat(paire, cleNum), base: BASE_CERTIFICAT, dire: (t) => toast(t), confirmer: (o) => askConfirm(o) };
  const defaire = async () => {
    if (!alias) return;
    const r = opsDefaire(alias.fusion.id, { registre: MAG_FUSIONS.lire(), fiches: load('vinted_annonce_numeros', {}) || {} });
    if (!r.ok) { toast(tr('atelier.fusion.pasDefaite.' + r.raison)); return; }
    if (!(await askConfirm({ title: tr('atelier.fusion.defaireTitre'), desc: tr('atelier.fusion.defaireDesc', { autres: [num, ...alias.autres].map((x) => 'N°' + x).join(' / ') }), ok: tr('atelier.fusion.defaire'), cancel: tr('atelier.annuler') }))) return;
    gesteVrm(tr('atelier.fusion.defaite'), r.ops, { [CLE_FUSIONS]: MAG_FUSIONS.poser });
  };
  const fusion = alias ? { alias, defaisable: defaisable(alias.fusion), fin: finDefaire(alias.fusion), onDefaire: defaire }
    : idFiche ? { ouvrir: () => setFusionOuverte(true) } : { raisonSans: 'sansFiche' };
  return <>
    <AtelierPaireLazy num={String(num)} Icon={Icon} studio={studio} certificat={certificat} fusion={fusion}/>
    {fusionOuverte ? <FeuilleFusionLazy idFiche={String(idFiche)} fiches={load('vinted_annonce_numeros', {}) || {}} registre={MAG_FUSIONS.lire()}
      vendus={(() => { try { return new Set((load('vinted_annonces_vendues', []) || []).map(String)); } catch (_) { return null; } })()}
      caseDe={(x) => rangementDuNum(x) || ''} cleNum={cleNum} proposer={proposerFusion}
      Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy"/>} Feuille={SheetShellSurFiche} Bouton={Bouton} Segmente={Segmente}
      onFusionner={(res) => { setFusionOuverte(false); gesteVrm(tr('atelier.fusion.faite'), res.ops, { [CLE_FUSIONS]: MAG_FUSIONS.poser }, null, 'fiches.fusion'); }}
      onClose={() => setFusionOuverte(false)}/> : null}
  </>;
}
// ⟦← App.jsx #7⟧
// La ligne de la fiche paire, et sa feuille.
// (15 nov., lot securite-ventes) « OÙ VENDRE CET ARTICLE ? » — la coque lit ce que la règle pure
// (src/ouVendre.js) demande : les sites reliés (le profil du vendeur, `relies`), le statut Pro du ou des
// comptes Vinted de l'article (`lecturePrixPro`, lu, jamais deviné), les frais LUS de ses commandes eBay et
// de ses ventes Vestiaire (les mêmes listes que « Frais par site »). Lecture seule, aucun geste.
function OuVendreCoque({ annonces = [], prixC = null, stats = null, comptes = null, ebay, vc }) {
  const profil = useProfilVendeur();
  const relies = (profil && profil.relies) || {};
  // Le prix de départ : celui de SON annonce en ligne, par identité (`siVendue.prix` de la fiche, en centimes) ; sinon le
  // prix rangé sur la fiche de l'annonce ; sinon rien (il le tape).
  const prix = Number.isSafeInteger(prixC) && prixC > 0 ? prixC / 100 : (() => { const enL = (annonces || []).filter((x) => x && x.etat === 'en-ligne'); const a = enL.length === 1 ? enL[0] : null;
    const st = a && stats ? stats[a.id] : null; const brut = st && st.prix != null && st.prix !== '' ? st.prix : (a ? a.price : null); const v = brut != null && typeof brut === 'object' ? brut.amount : brut; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; })();
  const uids = (() => { const d = [...new Set((annonces || []).map((a) => a && a.accountId).filter(Boolean).map(String))];
    return d.length ? d : (Array.isArray(comptes) ? comptes.map((a) => String(a.vinted_user_id || '')).filter(Boolean).slice(0, 12) : []); })();
  const cle = uids.join(',');
  const [statuts, setStatuts] = useState(undefined);
  useEffect(() => {
    let mort = false;
    if (!uids.length) { setStatuts(null); return undefined; }
    Promise.all(uids.map((u) => lecturePrixPro(u).then((x) => (x && typeof x.pro === 'boolean' ? x.pro : null), () => null)))
      .then((l) => { if (!mort) setStatuts(l); }, () => { if (!mort) setStatuts(null); });
    return () => { mort = true; };
  }, [cle]);
  const sites = React.useMemo(() => ({
    vinted: { relie: relies.vinted, frais: fraisVintedSelon(statutVinted(statuts)) },
    leboncoin: { relie: relies.leboncoin, frais: { regle: 'aucune' } },
    ebay: { relie: relies.ebay, frais: tauxEbay(Array.isArray(ebay) ? ebay : null, commandeEbayEngagee) },
    vestiaire: { relie: relies.vestiaire, frais: tauxVestiaire(Array.isArray(vc) ? vc : null, fraisVc) },
  }), [relies.vinted, relies.leboncoin, relies.ebay, relies.vestiaire, statuts, ebay, vc]);
  return <OuVendre prixDepart={prix} sites={sites}/>;
}
function InfosPaireCoque({ numero = '', itemId = '', recreeDe = '' }) {
  const paire = { numero, itemId, recreeDe };
  const infos = useInfosPaire(paire);
  const [ouvert, setOuvert] = React.useState(false);
  if (!paireIdentifiable(numero, itemId)) return null;
  return <Suspense fallback={null}>
    <div className="vrm-plus-groupe" style={{ margin: '12px 0' }}><InfosPaireVueP infos={infos} numero={String(numero || '')} onEditer={infos && infos.cachee ? null : () => setOuvert(true)}/></div>
    {ouvert ? <InfosPaireFeuilleP valeur={infos && !infos.cachee ? infos : null} numero={String(numero || '')} onEnregistrer={(x) => ecrireInfosPaire(paire, x)} onClose={() => setOuvert(false)}/> : null}
  </Suspense>;
}
export { InfosPaireCoque, OuVendreCoque, AtelierPaireCoque };
