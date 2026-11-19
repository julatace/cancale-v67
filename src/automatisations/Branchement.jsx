// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  AUTOMATISATIONS — LE BRANCHEMENT (19 nov. soir, NATIF.md §2 bis)
//  La vue : src/natif/ecrans/Automatisations.jsx. Ici, pour chaque automatisme EXISTANT :
//    · son état « Activé / Désactivé » LU dans SON vrai réglage (pas su ⇒ « — », jamais « Désactivé » deviné) ;
//    · chaque geste écrit dans la clé EXISTANTE de son moteur, par le chemin existant (aucun nouveau moteur, aucune garde
//      retirée, CLAUDE.md §3) :
//        - Messages aux favoris : `vrm_favoris_reglages_{uid}` (`lireReglagesFavoris` / `sauverReglagesFavoris`, validés) ;
//          le mode automatique s'allume là où VRM dit le risque (Messages → Favoris), l'arrêt passe par `auto_stop` ;
//        - Offres reçues : `vinted_offres_auto` (allumé après `confirmerOffresAuto`, la MÊME question qu'Annonces),
//          le refus `vinted_offre_refus_msg` + `vinted_offre_refus_variantes` (la garde `erreurMessageAuto`) ;
//          la négociation par paliers : `vinted_offres_paliers` (src/negociationPaliers.js — la MÊME règle et la MÊME forme que le
//          moteur de l'extension, `palierContreOffre`, 5.409 `contreoffres`) ; éteinte par défaut, l'allumer DEMANDE ;
//        - Baisse par règle : `vinted_baisse_regle` (`avecRegle`, paliers 5/10/15 % · 7/14/30 j) ;
//        - Vendue ailleurs ⇒ masquée : décision du 19 nov., toujours active (lecture seule) ;
//        - Republication programmée : l'atelier Republier (lecture : programmations en attente).
//  ⛔ Pas de « boost de favoris » (favoris artificiels : engagement simulé, CLAUDE.md §3).
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import Automatisations, { SectionAuto, MessagesAuto, ReglageAuto, ChoixAuto, ChampNombre, PhraseAuto } from '../natif/ecrans/Automatisations.jsx';
import { Interrupteur } from '../natif/Rangee.jsx';
import { lireReglagesFavoris, sauverReglagesFavoris } from '../reglagesFavoris.js';
import { resumeOffre } from '../favorisEcran.js';
import { requeteJsonBornee } from '../requeteJsonBornee.js';
import { nomCompteLie } from '../comptesLies.js';
import { erreurMessageAuto } from '../messageSur.js';
import { REGLE_CLE, MASQUER_CLE, PALIERS_PCT, PALIERS_JOURS, regleDuCompte, avecRegle } from '../reglesAuto.js';
import { CLE_PALIERS, reglagesPaliers, plancherDe, apercuPaliers } from '../negociationPaliers.js';
import { load, save, toast, AUTH, sbAuth, SUPABASE_URL, Icon, confirmerOffresAuto, askConfirm, EXT_CAPACITES, extSait, useComptesAutresSites } from '../App.jsx';
// Ce que l'extension sait faire : une capacité absente de la table de CETTE app (le moteur pas encore livré) vaut « absente ».
const capacite = (k) => (EXT_CAPACITES && EXT_CAPACITES[k] ? extSait(k) : 'absente');

const allerA = (q) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })); } catch (_) {} };
const variantesLues = (v) => (Array.isArray(v) ? v.map((t) => String(t || '')) : []);

function useFavoris(uid) {
  const [lu, setLu] = React.useState(undefined);          // undefined · null (pas su) · { reglages, auto }
  const [tic, setTic] = React.useState(0);
  React.useEffect(() => {
    if (!uid || !AUTH.user) { setLu(uid ? null : undefined); return undefined; }
    let vivant = true; setLu(undefined);
    const owner = AUTH.user.id, opts = { uid, owner, ownerActuel: () => (AUTH.user && AUTH.user.id) || '', base: SUPABASE_URL, headers: sbAuth() };
    Promise.all([
      lireReglagesFavoris(opts).catch(() => null),
      requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`, { headers: { ...sbAuth(), 'Content-Type': 'application/json' }, cache: 'no-store' }).then((r) => (r && r.ok && r.json && r.json.ok ? r.json.vue : null)).catch(() => null),
    ]).then(([reglages, vue]) => { if (vivant) setLu(reglages ? { reglages, auto: vue && vue.auto ? vue.auto : null, autoLu: !!vue } : null); });
    return () => { vivant = false; };
  }, [uid, tic]);
  return [lu, () => setTic((t) => t + 1)];
}

export default function BranchementAutomatisations({ accounts = [] }) {
  const labels = load('vinted_account_labels', {}) || {};
  const comptes = (accounts || []).filter((a) => a && /^\d{1,20}$/.test(String(a.vinted_user_id || ''))).map((a) => ({ uid: String(a.vinted_user_id), nom: labels[a.vinted_user_id] || a.login || ('#' + a.vinted_user_id) }));
  const [choisi, setChoisi] = React.useState(() => { try { return new URLSearchParams(location.search).get('auto') || ''; } catch (_) { return ''; } });
  const [uid, setUid] = React.useState(() => (comptes[0] ? comptes[0].uid : ''));
  React.useEffect(() => { if (!uid && comptes[0]) setUid(comptes[0].uid); }, [comptes.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tic, setTic] = React.useState(0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if ([REGLE_CLE, 'vinted_offres_auto', 'vinted_offre_refus_msg', 'vinted_offre_refus_variantes', CLE_PALIERS, MASQUER_CLE].includes(k)) setTic((t) => t + 1); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const choixCompte = comptes.length > 1 ? { valeur: uid, options: comptes.map((c) => ({ cle: c.uid, libelle: c.nom })), onChange: setUid } : null;
  const nomCompte = (comptes.find((c) => c.uid === uid) || {}).nom || '';
  const sites = (ok, bientot = []) => <div className="n-au-sites" data-au-sites="">{['vinted', 'leboncoin', 'vestiaire'].map((s) => (ok.includes(s) || bientot.includes(s))
    ? <span key={s} className="n-au-site" data-au-site={s} data-au-site-ok={ok.includes(s) ? '1' : '0'}>{tr('auto.site.' + s) + (ok.includes(s) ? '' : ' · ' + tr('auto.bientot'))}</span> : null)}</div>;

  // ── 1. MESSAGES AUX FAVORIS ──────────────────────────────────────────────────────────────────────────────────────────
  const [fav, relireFav] = useFavoris(uid);
  const [brFav, setBrFav] = React.useState(null);           // le brouillon : { messages: [{ texte, actif }], intervalle, max }
  const [errFav, setErrFav] = React.useState('');
  const [envoiFav, setEnvoiFav] = React.useState(false);
  const cleCoupes = 'vrm_auto_messages_coupes_' + uid;      // les messages COUPÉS (interrupteur) : gardés sur cet appareil, jamais envoyés
  React.useEffect(() => {
    if (!fav || !fav.reglages) { setBrFav(null); return; }
    const r = fav.reglages; let coupes = []; try { coupes = JSON.parse(localStorage.getItem(cleCoupes) || '[]'); } catch (_) { coupes = []; }
    setBrFav({ messages: [r.message, ...variantesLues(r.variantes)].filter((t) => String(t || '').trim()).map((t) => ({ texte: t, actif: true })).concat((Array.isArray(coupes) ? coupes : []).map((t) => ({ texte: String(t), actif: false }))),
      intervalle: String(r.intervalleMinutes), max: r.intervalleMaxMinutes ? String(r.intervalleMaxMinutes) : '' });
    setErrFav('');
  }, [fav]);   // eslint-disable-line react-hooks/exhaustive-deps
  const favActif = fav === undefined ? null : fav === null || !fav.autoLu ? null : !!(fav.auto && fav.auto.reglages && fav.auto.reglages.actif === true);
  const modifieFav = !!(brFav && fav && fav.reglages && (() => {
    const r = fav.reglages; const actifs = brFav.messages.filter((m) => m.actif).map((m) => m.texte);
    return JSON.stringify(actifs) !== JSON.stringify([r.message, ...variantesLues(r.variantes)].filter((t) => String(t || '').trim())) || brFav.intervalle !== String(r.intervalleMinutes) || brFav.max !== (r.intervalleMaxMinutes ? String(r.intervalleMaxMinutes) : '') || brFav.messages.some((m) => !m.actif);
  })());
  const enregistrerFav = async () => {
    if (!brFav || !fav || !fav.reglages || !AUTH.user) return false;
    const actifs = brFav.messages.filter((m) => m.actif).map((m) => m.texte.trim()).filter(Boolean);
    setEnvoiFav(true); setErrFav('');
    try {
      await sauverReglagesFavoris({ uid, owner: AUTH.user.id, ownerActuel: () => (AUTH.user && AUTH.user.id) || '', base: SUPABASE_URL, headers: sbAuth() },
        { ...fav.reglages, message: actifs[0] || '', variantes: actifs.slice(1), intervalleMinutes: brFav.intervalle, intervalleMaxMinutes: brFav.max || null });
      try { localStorage.setItem(cleCoupes, JSON.stringify(brFav.messages.filter((m) => !m.actif).map((m) => m.texte))); } catch (_) {}
      relireFav(); return true;
    } catch (e) { setErrFav(String((e && e.message) || tr('auto.pasEnregistre'))); return false; }
    finally { setEnvoiFav(false); }
  };
  const itemFavoris = {
    cle: 'favoris', titre: tr('auto.favoris.titre'), sous: tr('auto.favoris.sous'), icone: 'heart', actif: favActif, compte: choixCompte, modifie: modifieFav,
    reinitialiser: () => { relireFav(); },
    plein: fav && fav.reglages ? (favActif
      ? { libelle: modifieFav ? tr('auto.enregistrer') : tr('auto.arreter'), chargement: envoiFav, onClick: async () => {
          if (modifieFav) { if (await enregistrerFav()) toast(tr('auto.enregistre')); return; }
          const r = await requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`, { method: 'POST', headers: { ...sbAuth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auto_stop' }) }).catch(() => null);
          if (r && r.ok && r.json && r.json.ok) { toast(tr('auto.arrete')); relireFav(); } else toast(tr('auto.pasConfirme')); } }
      : { libelle: tr('auto.demarrer'), chargement: envoiFav, onClick: async () => { if (modifieFav && !(await enregistrerFav())) return; toast(tr('auto.favoris.allumer')); allerA('?tab=favoris'); } })
      : null,
    detail: () => (fav === undefined ? <PhraseAuto>{tr('tableau.maj.lecture')}</PhraseAuto> : !brFav ? <PhraseAuto ton="ambre">{tr('auto.passu')}</PhraseAuto> : <>
      {sites(['vinted'], ['vestiaire'])}
      <SectionAuto titre={tr('auto.messages')} phrase={tr('auto.messages.phrase')} attrs={{ 'data-au-section': 'messages' }}>
        <MessagesAuto messages={brFav.messages} etiquette={resumeOffre(fav.reglages).replace(/\.$/, '')} erreur={errFav}
          onModifier={(i, t) => setBrFav((b) => ({ ...b, messages: b.messages.map((m, j) => (j === i ? { ...m, texte: t } : m)) }))}
          onSupprimer={(i) => setBrFav((b) => ({ ...b, messages: b.messages.filter((_, j) => j !== i) }))}
          onBasculer={(i, v) => setBrFav((b) => ({ ...b, messages: b.messages.map((m, j) => (j === i ? { ...m, actif: v } : m)) }))}
          onAjouter={(t) => setBrFav((b) => ({ ...b, messages: [...b.messages, { texte: t, actif: true }] }))}/>
      </SectionAuto>
      <SectionAuto titre={tr('auto.ciblage')} attrs={{ 'data-au-section': 'ciblage' }}>
        <ReglageAuto libelle={tr('auto.favoris.offre')} phrase={tr('auto.favoris.offrePhrase')}><span className="n-au-reglage-nom">{resumeOffre(fav.reglages)}</span></ReglageAuto>
        <ReglageAuto libelle={tr('auto.favoris.recontact')} phrase={tr('auto.favoris.recontactPhrase')}><span className="n-au-reglage-nom">{tr('auto.jours', { n: 30 })}</span></ReglageAuto>
      </SectionAuto>
      <SectionAuto titre={tr('auto.delais')} attrs={{ 'data-au-section': 'delais' }}>
        <ReglageAuto libelle={tr('auto.favoris.entre')} phrase={tr('auto.favoris.entrePhrase')}>
          <ChampNombre valeur={brFav.intervalle} libelle={tr('auto.favoris.entre')} unite="min" max={1440} onChange={(v) => setBrFav((b) => ({ ...b, intervalle: v }))} attrs={{ 'data-au-intervalle': '' }}/>
          <ChampNombre valeur={brFav.max} libelle={tr('auto.favoris.max')} unite="max" max={1440} onChange={(v) => setBrFav((b) => ({ ...b, max: v }))}/>
        </ReglageAuto>
        {fav.auto && fav.auto.reglages ? <ReglageAuto libelle={tr('auto.favoris.attente')} phrase={tr('auto.favoris.attentePhrase')}>
          <span className="n-au-reglage-nom">{tr('auto.minutesDe', { a: fav.auto.reglages.attenteMin, b: fav.auto.reglages.attenteMax })}</span></ReglageAuto> : null}
      </SectionAuto>
    </>),
  };

  // ── 2. OFFRES REÇUES (Vinted) : acceptation, refus, négociation par paliers ──────────────────────────────────────────
  const offresActif = load('vinted_offres_auto', false) === true;
  const [brRefus, setBrRefus] = React.useState(null);
  // La négociation par paliers : le réglage TEL QUE le moteur le lit (`reglagesPaliers`), ses messages avec leur interrupteur.
  const palLu = () => reglagesPaliers(load(CLE_PALIERS, null));
  const versBrouillon = (r) => ({ actif: r.actif, remiseMax: r.remiseMax == null ? '' : String(r.remiseMax), paliers: [...r.paliers], messages: r.messages.map((t) => ({ texte: t, actif: true })), arrondi: r.arrondi });
  const [nego, setNego] = React.useState(() => versBrouillon(palLu()));
  React.useEffect(() => {
    setBrRefus([String(load('vinted_offre_refus_msg', '') || ''), ...variantesLues(load('vinted_offre_refus_variantes', []))].filter((t) => t.trim()).map((t) => ({ texte: t, actif: true })));
    setNego(versBrouillon(palLu()));
  }, [tic]);   // eslint-disable-line react-hooks/exhaustive-deps
  const negoARanger = (n) => reglagesPaliers({ actif: n.actif, remiseMax: n.remiseMax === '' ? null : Number(n.remiseMax), paliers: n.paliers, messages: n.messages.filter((m) => m.actif).map((m) => m.texte), arrondi: n.arrondi });
  const refusLus = [String(load('vinted_offre_refus_msg', '') || ''), ...variantesLues(load('vinted_offre_refus_variantes', []))].filter((t) => t.trim());
  const modifieRefus = !!brRefus && JSON.stringify(brRefus.filter((m) => m.actif).map((m) => m.texte)) !== JSON.stringify(refusLus);
  const modifieNego = JSON.stringify(negoARanger(nego)) !== JSON.stringify(palLu());
  const [errRefus, setErrRefus] = React.useState('');
  const enregistrerOffres = () => {
    if (modifieRefus && brRefus) {
      const actifs = brRefus.filter((m) => m.actif).map((m) => m.texte.trim()).filter(Boolean);
      const risque = actifs.map((t) => erreurMessageAuto(t)).find(Boolean);
      if (risque) { setErrRefus(String(risque)); return false; }
      save('vinted_offre_refus_msg', actifs[0] || ''); save('vinted_offre_refus_variantes', actifs.slice(1));
    }
    if (modifieNego) {
      const risque = nego.messages.filter((m) => m.actif).map((m) => erreurMessageAuto(m.texte)).find(Boolean);
      if (risque) { setErrRefus(String(risque)); return false; }
      save(CLE_PALIERS, negoARanger(nego));
    }
    setErrRefus(''); setTic((t) => t + 1); return true;
  };
  // Allumer la négociation DEMANDE (une contre-offre part sans lui) ; l'éteindre, non.
  const basculerNego = async (v) => {
    if (v && !(await askConfirm({ title: tr('auto.nego.allumerTitre'), desc: tr('auto.nego.allumerDesc'), ok: tr('auto.nego.allumerOk'), cancel: tr('egalite.pauseLbc.annuler') }))) return;
    setNego((n) => ({ ...n, actif: v }));
  };
  const negoR = negoARanger(nego);
  const apercu = apercuPaliers(100, plancherDe(100, null, negoR.remiseMax == null ? 15 : negoR.remiseMax), negoR) || { chaine: [100], plancher: null };
  // La contre-offre par paliers : le moteur de l'extension (`contreoffres`, 5.409). Absente de cette app ⇒ « bientôt », rien n'est envoyé.
  const capContre = capacite('contreoffres');
  const itemOffres = {
    cle: 'offres', titre: tr('auto.offres.titre'), sous: tr('auto.offres.sous'), icone: 'chat', actif: offresActif, modifie: modifieRefus || modifieNego,
    onglets: [{ cle: 'config', libelle: tr('auto.onglet.config') }, { cle: 'nego', libelle: tr('auto.onglet.nego') }],
    reinitialiser: () => setTic((t) => t + 1),
    plein: offresActif
      ? { libelle: modifieRefus || modifieNego ? tr('auto.enregistrer') : tr('auto.arreter'), onClick: () => { if (modifieRefus || modifieNego) { if (enregistrerOffres()) toast(tr('auto.enregistre')); return; } save('vinted_offres_auto', false); setTic((t) => t + 1); toast(tr('auto.arrete')); } }
      : { libelle: tr('auto.demarrer'), onClick: async () => { if ((modifieRefus || modifieNego) && !enregistrerOffres()) return; if (!(await confirmerOffresAuto())) return; save('vinted_offres_auto', true); setTic((t) => t + 1); toast(tr('auto.demarre')); } },
    detail: (onglet) => (onglet === 'nego' ? <>
      <PhraseAuto ton={capContre === 'ok' ? 'neutre' : 'ambre'}>{capContre === 'ok' ? tr('auto.nego.pret') : capContre === 'absente' ? tr('auto.nego.bientot') : tr('auto.nego.ext', { v: (EXT_CAPACITES && EXT_CAPACITES.contreoffres) || '' })}</PhraseAuto>
      {sites(['vinted'], ['vestiaire'])}
      <SectionAuto titre={tr('auto.nego.prix')} attrs={{ 'data-au-section': 'nego' }}>
        <ReglageAuto libelle={tr('auto.nego.actif')} phrase={tr('auto.nego.actifPhrase')}><Interrupteur actif={nego.actif} libelle={tr('auto.nego.actif')} onChange={basculerNego} attrs={{ 'data-au-nego-actif': nego.actif ? '1' : '0' }}/></ReglageAuto>
        <ReglageAuto libelle={tr('auto.nego.marge')} phrase={tr('auto.nego.margePhrase')}><ChampNombre valeur={nego.remiseMax} libelle={tr('auto.nego.marge')} unite="%" min={0} max={89} onChange={(v) => setNego((n) => ({ ...n, remiseMax: v === '0' ? '' : v }))} attrs={{ 'data-au-marge': '' }}/></ReglageAuto>
        <PhraseAuto>{tr('auto.nego.mini')}</PhraseAuto>
        <ReglageAuto libelle={tr('auto.nego.paliers')} phrase={tr('auto.nego.paliersPhrase')}/>
        <div className="n-au-paliers" data-au-paliers={String(nego.paliers.length)}>
          {nego.paliers.map((p, i) => <div key={i} className="n-au-palier" data-au-palier={i}>
            <ChampNombre valeur={String(p)} libelle={tr('auto.nego.palier', { n: i + 1 })} unite="%" min={1} max={100} onChange={(v) => setNego((n) => ({ ...n, paliers: n.paliers.map((q, j) => (j === i ? (Number(v) || 1) : q)) }))}/>
            <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.nego.retirer', { n: i + 1 })} onClick={() => setNego((n) => ({ ...n, paliers: n.paliers.filter((_, j) => j !== i) }))}>✕</button>
          </div>)}
          {nego.paliers.length < 6 ? <span><button type="button" className="n-tt-bouton" data-au-ajouter-palier="" onClick={() => setNego((n) => ({ ...n, paliers: [...n.paliers, 100] }))}>＋ {tr('auto.nego.ajouterPalier')}</button></span> : null}
        </div>
        <p className="n-au-apercu" data-au-apercu={apercu.chaine.join('>') + '|' + (apercu.plancher == null ? '' : apercu.plancher)}>{apercu.plancher == null ? tr('auto.nego.sansPlancher') : tr('auto.nego.apercu', { suite: apercu.chaine.join(' → '), plancher: apercu.plancher })}</p>
        <ReglageAuto libelle={tr('auto.nego.arrondi')}><ChoixAuto libelle={tr('auto.nego.arrondi')} valeur={nego.arrondi ? 'unite' : 'aucun'} options={['unite', 'aucun'].map((a) => ({ cle: a, libelle: tr('auto.nego.arrondi.' + a) }))} onChange={(v) => setNego((n) => ({ ...n, arrondi: v === 'unite' }))}/></ReglageAuto>
      </SectionAuto>
      <SectionAuto titre={tr('auto.messages')} phrase={tr('auto.nego.messagesPhrase')} attrs={{ 'data-au-section': 'nego-messages' }}>
        <MessagesAuto messages={nego.messages} etiquette={tr('auto.nego.contre')} erreur={errRefus}
          onModifier={(i, t) => setNego((n) => ({ ...n, messages: n.messages.map((m, j) => (j === i ? { ...m, texte: t } : m)) }))} onSupprimer={(i) => setNego((n) => ({ ...n, messages: n.messages.filter((_, j) => j !== i) }))}
          onBasculer={(i, v) => setNego((n) => ({ ...n, messages: n.messages.map((m, j) => (j === i ? { ...m, actif: v } : m)) }))} onAjouter={(t) => setNego((n) => ({ ...n, messages: [...n.messages, { texte: t, actif: true }] }))}/>
      </SectionAuto>
      <SectionAuto titre={tr('auto.nego.plus')}><PhraseAuto ton="ambre">{tr('auto.nego.tranchesBientot')}</PhraseAuto></SectionAuto>
    </> : <>
      {sites(['vinted'])}
      <SectionAuto titre={tr('auto.messages')} phrase={tr('auto.offres.messagesPhrase')} attrs={{ 'data-au-section': 'messages' }}>
        <MessagesAuto messages={brRefus || []} etiquette={tr('auto.offres.refus')} erreur={errRefus}
          onModifier={(i, t) => setBrRefus((b) => b.map((m, j) => (j === i ? { ...m, texte: t } : m)))} onSupprimer={(i) => setBrRefus((b) => b.filter((_, j) => j !== i))}
          onBasculer={(i, v) => setBrRefus((b) => b.map((m, j) => (j === i ? { ...m, actif: v } : m)))} onAjouter={(t) => setBrRefus((b) => [...(b || []), { texte: t, actif: true }])}/>
      </SectionAuto>
      <SectionAuto titre={tr('auto.ciblage')} attrs={{ 'data-au-section': 'ciblage' }}>
        <ReglageAuto libelle={tr('auto.offres.accepte')} phrase={tr('auto.offres.acceptePhrase')}/>
        <ReglageAuto libelle={tr('auto.offres.refuse')} phrase={tr('auto.offres.refusePhrase')}/>
      </SectionAuto>
      <SectionAuto titre={tr('auto.delais')} attrs={{ 'data-au-section': 'delais' }}>
        <ReglageAuto libelle={tr('auto.offres.delai')} phrase={tr('auto.offres.delaiPhrase')}><span className="n-au-reglage-nom">{tr('auto.minutesDe', { a: 3, b: 20 })}</span></ReglageAuto>
      </SectionAuto>
    </>),
  };

  // ── 3. BAISSE PAR RÈGLE (Vinted, par compte) ─────────────────────────────────────────────────────────────────────────
  // (19 nov. soir) La MÊME règle pour un compte Leboncoin (`comptes['lbc:{compte}']`, lue par l'extension 5.409 `baisselbc` :
  // la baisse part par `baisserPrixLbc`, recette apprise, prix relu, sécurité). Vestiaire : pas de moteur ⇒ « bientôt ».
  const [autres] = useComptesAutresSites(true);
  const comptesLbc = Array.isArray(autres && autres.leboncoin) ? autres.leboncoin.map((c) => ({ uid: 'lbc:' + String(c.id), nom: tr('auto.site.leboncoin') + ' · ' + nomCompteLie(c) })) : [];
  const capLbc = capacite('baisselbc');
  const comptesBaisse = [...comptes, ...(capLbc === 'absente' ? [] : comptesLbc)];
  const [uidB, setUidB] = React.useState('');
  const uidBaisse = comptesBaisse.some((c) => c.uid === uidB) ? uidB : (comptesBaisse[0] ? comptesBaisse[0].uid : '');
  const baisseLbc = uidBaisse.startsWith('lbc:');
  const regle = uidBaisse ? regleDuCompte(load(REGLE_CLE, null), uidBaisse) : null;
  const [brRegle, setBrRegle] = React.useState(null);
  React.useEffect(() => { setBrRegle(regle ? { pct: regle.pct, jours: regle.jours } : null); }, [uidBaisse, tic]);   // eslint-disable-line react-hooks/exhaustive-deps
  const modifieRegle = !!(regle && brRegle && (brRegle.pct !== regle.pct || brRegle.jours !== regle.jours));
  const poserRegle = (maj) => { save(REGLE_CLE, avecRegle(load(REGLE_CLE, null), uidBaisse, maj)); setTic((t) => t + 1); };
  const itemBaisse = {
    cle: 'baisse', titre: tr('auto.baisse.titre'), sous: tr('auto.baisse.sous'), icone: 'tag', actif: uidBaisse ? regle.actif : null, modifie: modifieRegle,
    compte: comptesBaisse.length > 1 ? { valeur: uidBaisse, options: comptesBaisse.map((c) => ({ cle: c.uid, libelle: c.nom })), onChange: setUidB } : null,
    reinitialiser: () => setTic((t) => t + 1),
    plein: uidBaisse && brRegle ? (regle.actif
      ? { libelle: modifieRegle ? tr('auto.enregistrer') : tr('auto.arreter'), onClick: () => { if (modifieRegle) { poserRegle({ ...brRegle, actif: true }); toast(tr('auto.enregistre')); } else { poserRegle({ actif: false }); toast(tr('auto.arrete')); } } }
      : { libelle: tr('auto.demarrer'), indisponible: baisseLbc && capLbc !== 'ok', raison: baisseLbc && capLbc !== 'ok' ? tr('auto.baisse.extLbc', { v: (EXT_CAPACITES && EXT_CAPACITES.baisselbc) || '' }) : '', onClick: () => { poserRegle({ ...brRegle, actif: true }); toast(tr('auto.demarre')); } }) : null,
    detail: () => (!uidBaisse || !brRegle ? <PhraseAuto ton="ambre">{tr('auto.sansCompte')}</PhraseAuto> : <>
      {sites(capLbc === 'absente' ? ['vinted'] : ['vinted', 'leboncoin'], capLbc === 'absente' ? ['leboncoin', 'vestiaire'] : ['vestiaire'])}
      <SectionAuto titre={tr('auto.ciblage')} attrs={{ 'data-au-section': 'ciblage' }}>
        <ReglageAuto libelle={tr('auto.baisse.pct')} phrase={tr('auto.baisse.pctPhrase')}><ChoixAuto libelle={tr('auto.baisse.pct')} valeur={brRegle.pct} options={PALIERS_PCT.map((p) => ({ cle: p, libelle: '−' + p + ' %' }))} onChange={(v) => setBrRegle((b) => ({ ...b, pct: Number(v) }))} attrs={{ 'data-au-baisse-pct': '' }}/></ReglageAuto>
        <ReglageAuto libelle={tr('auto.baisse.plancher')} phrase={tr('auto.baisse.plancherPhrase')}/>
      </SectionAuto>
      <SectionAuto titre={tr('auto.delais')} attrs={{ 'data-au-section': 'delais' }}>
        <ReglageAuto libelle={tr('auto.baisse.jours')} phrase={tr('auto.baisse.joursPhrase')}><ChoixAuto libelle={tr('auto.baisse.jours')} valeur={brRegle.jours} options={PALIERS_JOURS.map((j) => ({ cle: j, libelle: tr('auto.jours', { n: j }) }))} onChange={(v) => setBrRegle((b) => ({ ...b, jours: Number(v) }))} attrs={{ 'data-au-baisse-jours': '' }}/></ReglageAuto>
      </SectionAuto>
    </>),
  };

  // ── 4. VENDUE AILLEURS ⇒ MASQUÉE (décision du 19 nov., toujours active) ─────────────────────────────────────────────
  const masq = load(MASQUER_CLE, null);
  const nMasq = masq && Array.isArray(masq.items) ? masq.items.length : null;
  const itemMasquer = {
    cle: 'masquer', titre: tr('auto.masquer.titre'), sous: tr('auto.masquer.sous'), icone: 'eyeOff', actif: true,
    detail: () => <>{sites(['vinted'])}<SectionAuto titre={tr('auto.ciblage')}><PhraseAuto>{tr('auto.masquer.phrase')}</PhraseAuto>
      <ReglageAuto libelle={tr('auto.masquer.liste')}><span className="n-au-reglage-nom" data-au-masquer={nMasq == null ? '' : String(nMasq)}>{nMasq == null ? '—' : String(nMasq)}</span></ReglageAuto></SectionAuto></>,
  };

  // ── 5. REPUBLICATION PROGRAMMÉE (l'atelier Republier) ───────────────────────────────────────────────────────────────
  const itemRepub = {
    cle: 'republier', titre: tr('auto.repub.titre'), sous: tr('auto.repub.sous'), icone: 'sync', actif: null,
    plein: { libelle: tr('auto.repub.ouvrir'), onClick: () => allerA('?tab=republier') },
    detail: () => <>{sites(['vinted'])}<SectionAuto titre={tr('auto.delais')}><PhraseAuto>{tr('auto.repub.phrase')}</PhraseAuto></SectionAuto></>,
  };

  return <Automatisations items={[itemFavoris, itemOffres, itemBaisse, itemMasquer, itemRepub]} choisi={choisi} onChoisir={setChoisi} Icon={Icon} compte={comptes.length > 1 ? nomCompte : (comptes[0] ? comptes[0].nom : '')}/>;
}
