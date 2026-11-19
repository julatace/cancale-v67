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
//          la négociation par paliers : `vinted_offres_nego` (src/automatisations/negociation.js) — RANGÉE, pas exécutée
//          (« bientôt » : le moteur ne fait pas encore de contre-offre ; rien n'est envoyé) ;
//        - Baisse par règle : `vinted_baisse_regle` (`avecRegle`, paliers 5/10/15 % · 7/14/30 j) ;
//        - Vendue ailleurs ⇒ masquée : décision du 19 nov., toujours active (lecture seule) ;
//        - Republication programmée : l'atelier Republier (lecture : programmations en attente).
//  ⛔ Pas de « boost de favoris » (favoris artificiels : engagement simulé, CLAUDE.md §3).
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import Automatisations, { SectionAuto, MessagesAuto, ReglageAuto, ChoixAuto, ChampNombre, PhraseAuto } from '../natif/ecrans/Automatisations.jsx';
import { lireReglagesFavoris, sauverReglagesFavoris } from '../reglagesFavoris.js';
import { resumeOffre } from '../favorisEcran.js';
import { requeteJsonBornee } from '../requeteJsonBornee.js';
import { erreurMessageAuto } from '../messageSur.js';
import { REGLE_CLE, MASQUER_CLE, PALIERS_PCT, PALIERS_JOURS, regleDuCompte, avecRegle } from '../reglesAuto.js';
import { CLE_NEGO, ARRONDIS, negoLue, negoARanger, apercuNego } from './negociation.js';
import { load, save, toast, AUTH, sbAuth, SUPABASE_URL, Icon, confirmerOffresAuto } from '../App.jsx';

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
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if ([REGLE_CLE, 'vinted_offres_auto', 'vinted_offre_refus_msg', 'vinted_offre_refus_variantes', CLE_NEGO, MASQUER_CLE].includes(k)) setTic((t) => t + 1); };
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
  const [nego, setNego] = React.useState(() => negoLue(load(CLE_NEGO, null)));
  React.useEffect(() => {
    setBrRefus([String(load('vinted_offre_refus_msg', '') || ''), ...variantesLues(load('vinted_offre_refus_variantes', []))].filter((t) => t.trim()).map((t) => ({ texte: t, actif: true })));
    setNego(negoLue(load(CLE_NEGO, null)));
  }, [tic]);
  const refusLus = [String(load('vinted_offre_refus_msg', '') || ''), ...variantesLues(load('vinted_offre_refus_variantes', []))].filter((t) => t.trim());
  const modifieRefus = !!brRefus && JSON.stringify(brRefus.filter((m) => m.actif).map((m) => m.texte)) !== JSON.stringify(refusLus);
  const modifieNego = JSON.stringify(negoARanger(nego)) !== JSON.stringify(negoARanger(negoLue(load(CLE_NEGO, null))));
  const [errRefus, setErrRefus] = React.useState('');
  const enregistrerOffres = () => {
    if (modifieRefus && brRefus) {
      const actifs = brRefus.filter((m) => m.actif).map((m) => m.texte.trim()).filter(Boolean);
      const risque = actifs.map((t) => erreurMessageAuto(t)).find(Boolean);
      if (risque) { setErrRefus(String(risque)); return false; }
      save('vinted_offre_refus_msg', actifs[0] || ''); save('vinted_offre_refus_variantes', actifs.slice(1));
    }
    if (modifieNego) save(CLE_NEGO, negoARanger(nego));
    setErrRefus(''); setTic((t) => t + 1); return true;
  };
  const apercu = apercuNego(nego, 100);
  // La contre-offre automatique n'existe pas encore dans le moteur (extension) : l'écran le dit, rien n'est envoyé.
  const contreOffreSue = false;
  const itemOffres = {
    cle: 'offres', titre: tr('auto.offres.titre'), sous: tr('auto.offres.sous'), icone: 'chat', actif: offresActif, modifie: modifieRefus || modifieNego,
    onglets: [{ cle: 'config', libelle: tr('auto.onglet.config') }, { cle: 'nego', libelle: tr('auto.onglet.nego') }],
    reinitialiser: () => setTic((t) => t + 1),
    plein: offresActif
      ? { libelle: modifieRefus || modifieNego ? tr('auto.enregistrer') : tr('auto.arreter'), onClick: () => { if (modifieRefus || modifieNego) { if (enregistrerOffres()) toast(tr('auto.enregistre')); return; } save('vinted_offres_auto', false); setTic((t) => t + 1); toast(tr('auto.arrete')); } }
      : { libelle: tr('auto.demarrer'), onClick: async () => { if ((modifieRefus || modifieNego) && !enregistrerOffres()) return; if (!(await confirmerOffresAuto())) return; save('vinted_offres_auto', true); setTic((t) => t + 1); toast(tr('auto.demarre')); } },
    detail: (onglet) => (onglet === 'nego' ? <>
      <PhraseAuto ton={contreOffreSue ? 'neutre' : 'ambre'}>{contreOffreSue ? tr('auto.nego.pret') : tr('auto.nego.bientot')}</PhraseAuto>
      {sites(['vinted'], ['vestiaire'])}
      <SectionAuto titre={tr('auto.nego.prix')} attrs={{ 'data-au-section': 'nego' }}>
        <ReglageAuto libelle={tr('auto.nego.marge')} phrase={tr('auto.nego.margePhrase')}><ChampNombre valeur={String(nego.marge)} libelle={tr('auto.nego.marge')} unite="%" min={1} max={90} onChange={(v) => setNego((n) => ({ ...n, marge: Number(v) || 1 }))} attrs={{ 'data-au-marge': '' }}/></ReglageAuto>
        <ReglageAuto libelle={tr('auto.nego.paliers')} phrase={tr('auto.nego.paliersPhrase')}/>
        <div className="n-au-paliers" data-au-paliers={String(nego.paliers.length)}>
          {nego.paliers.map((p, i) => <div key={i} className="n-au-palier" data-au-palier={i}>
            <ChampNombre valeur={String(p.pct)} libelle={tr('auto.nego.palier', { n: i + 1 })} unite="%" min={1} max={100} onChange={(v) => setNego((n) => ({ ...n, paliers: n.paliers.map((q, j) => (j === i ? { ...q, pct: Number(v) || 1 } : q)) }))}/>
            <input className="n-au-palier-message" value={p.message} placeholder={tr('auto.nego.message')} aria-label={tr('auto.nego.message')} onChange={(e) => setNego((n) => ({ ...n, paliers: n.paliers.map((q, j) => (j === i ? { ...q, message: e.target.value.slice(0, 300) } : q)) }))}/>
            <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.nego.retirer', { n: i + 1 })} onClick={() => setNego((n) => ({ ...n, paliers: n.paliers.filter((_, j) => j !== i) }))}>✕</button>
          </div>)}
          {nego.paliers.length < 6 ? <span><button type="button" className="n-tt-bouton" data-au-ajouter-palier="" onClick={() => setNego((n) => ({ ...n, paliers: [...n.paliers, { pct: 100, message: '' }] }))}>＋ {tr('auto.nego.ajouterPalier')}</button></span> : null}
        </div>
        <p className="n-au-apercu" data-au-apercu={[apercu.prix, ...apercu.etapes].join('>') + '|' + apercu.plancher}>{tr('auto.nego.apercu', { suite: [apercu.prix, ...apercu.etapes].join(' → '), plancher: apercu.plancher })}</p>
        <PhraseAuto>{tr('auto.nego.mini')}</PhraseAuto>
        <ReglageAuto libelle={tr('auto.nego.tranches')} phrase={tr('auto.nego.tranchesPhrase')}/>
        <div className="n-au-paliers">{nego.tranches.map((t, i) => <div key={i} className="n-au-palier">
          <span className="n-au-reglage-phrase">{tr('auto.nego.jusqua')}</span><ChampNombre valeur={String(t.jusqua)} libelle={tr('auto.nego.jusqua')} unite="€" min={1} max={100000} onChange={(v) => setNego((n) => ({ ...n, tranches: n.tranches.map((q, j) => (j === i ? { ...q, jusqua: Number(v) || 1 } : q)) }))}/>
          <ChampNombre valeur={String(t.marge)} libelle={tr('auto.nego.marge')} unite="%" min={1} max={90} onChange={(v) => setNego((n) => ({ ...n, tranches: n.tranches.map((q, j) => (j === i ? { ...q, marge: Number(v) || 1 } : q)) }))}/>
          <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.nego.retirerTranche')} onClick={() => setNego((n) => ({ ...n, tranches: n.tranches.filter((_, j) => j !== i) }))}>✕</button></div>)}
          {nego.tranches.length < 6 ? <span><button type="button" className="n-tt-bouton" onClick={() => setNego((n) => ({ ...n, tranches: [...n.tranches, { jusqua: 50, marge: n.marge }] }))}>＋ {tr('auto.nego.ajouterTranche')}</button></span> : null}</div>
        <ReglageAuto libelle={tr('auto.nego.lot')} phrase={tr('auto.nego.lotPhrase')}/>
        <div className="n-au-paliers">{nego.lots.map((l, i) => <div key={i} className="n-au-palier">
          <ChampNombre valeur={String(l.articles)} libelle={tr('auto.nego.lotArticles')} unite={tr('auto.nego.articles')} min={2} max={20} onChange={(v) => setNego((n) => ({ ...n, lots: n.lots.map((q, j) => (j === i ? { ...q, articles: Number(v) || 2 } : q)) }))}/>
          <ChampNombre valeur={String(l.plus)} libelle={tr('auto.nego.lotPlus')} unite="%" min={1} max={50} onChange={(v) => setNego((n) => ({ ...n, lots: n.lots.map((q, j) => (j === i ? { ...q, plus: Number(v) || 1 } : q)) }))}/>
          <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.nego.retirerLot')} onClick={() => setNego((n) => ({ ...n, lots: n.lots.filter((_, j) => j !== i) }))}>✕</button></div>)}
          {nego.lots.length < 4 ? <span><button type="button" className="n-tt-bouton" onClick={() => setNego((n) => ({ ...n, lots: [...n.lots, { articles: 2, plus: 5 }] }))}>＋ {tr('auto.nego.ajouterLot')}</button></span> : null}</div>
        <ReglageAuto libelle={tr('auto.nego.arrondi')}><ChoixAuto libelle={tr('auto.nego.arrondi')} valeur={nego.arrondi} options={ARRONDIS.map((a) => ({ cle: a, libelle: tr('auto.nego.arrondi.' + a) }))} onChange={(v) => setNego((n) => ({ ...n, arrondi: v }))}/></ReglageAuto>
      </SectionAuto>
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
  const regle = uid ? regleDuCompte(load(REGLE_CLE, null), uid) : null;
  const [brRegle, setBrRegle] = React.useState(null);
  React.useEffect(() => { setBrRegle(regle ? { pct: regle.pct, jours: regle.jours } : null); }, [uid, tic]);   // eslint-disable-line react-hooks/exhaustive-deps
  const modifieRegle = !!(regle && brRegle && (brRegle.pct !== regle.pct || brRegle.jours !== regle.jours));
  const poserRegle = (maj) => { save(REGLE_CLE, avecRegle(load(REGLE_CLE, null), uid, maj)); setTic((t) => t + 1); };
  const itemBaisse = {
    cle: 'baisse', titre: tr('auto.baisse.titre'), sous: tr('auto.baisse.sous'), icone: 'tag', actif: uid ? regle.actif : null, compte: choixCompte, modifie: modifieRegle,
    reinitialiser: () => setTic((t) => t + 1),
    plein: uid && brRegle ? (regle.actif
      ? { libelle: modifieRegle ? tr('auto.enregistrer') : tr('auto.arreter'), onClick: () => { if (modifieRegle) { poserRegle({ ...brRegle, actif: true }); toast(tr('auto.enregistre')); } else { poserRegle({ actif: false }); toast(tr('auto.arrete')); } } }
      : { libelle: tr('auto.demarrer'), onClick: () => { poserRegle({ ...brRegle, actif: true }); toast(tr('auto.demarre')); } }) : null,
    detail: () => (!uid || !brRegle ? <PhraseAuto ton="ambre">{tr('auto.sansCompte')}</PhraseAuto> : <>
      {sites(['vinted'], ['leboncoin', 'vestiaire'])}
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
