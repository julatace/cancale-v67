// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { avecSuiviDuSujet, sortiParSuivi } from '../../api/_lib/suivi-colis.js';
import React, { Suspense } from 'react';
import { texteDuCartouche } from '../impression/tampons.js';
import { estAVerifier, GARDE_MAX_J } from '../../api/_lib/retrait-colis.js';
import { C, CARRIERS, EQUIPE_NON_INSTALLE_AIDE, EQUIPE_NON_INSTALLE_GESTE_AIDE, LignePanne, Operations, PhotoVinted, SUPABASE_URL, THEMES, TeteEquipe, aExpedier, boiteEquipe, cadreEquipe, cleanLieu, codeRetrait, enTeteSession, etatColisEmail, finsColis, isAtRelayStatus, joursAvant, libererOngletPdf, lirePdfLigne, messagePdfManquant, orderPhoto, ouvrirPdfOnglet, posePrefsImpression, qrImage, reclassifyTrack, sbAuth, tamponPourPage, tamponnerBordereau } from '../App.jsx';


// ⟦← App.jsx #1⟧

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
    tracks: (() => { const l = liste(tracks); return l === null ? null : l.map((r) => avecSuiviDuSujet(reclassifyTrack(r && r.data))).filter(Boolean); })(),
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
    const pdf = await PL.PDFDocument.load(lu.octets);
    // (16 nov.) Le réglage des tampons (`vrm_tampons`) vaut aussi pour l'aide : contenu, taille, places.
    const tp = tamponPourPage(PL, pdf, {}), ct = texteDuCartouche(tp.contenu, { numero: numero || '', titre: titre || '' });
    await tamponnerBordereau(PL, pdf, { numero: ct.numero, titre: ct.titre, choix: tp.choix, tampon: tp.tampon });
    posePrefsImpression(PL, pdf);
    const url = URL.createObjectURL(new Blob([await pdf.save()], { type: 'application/pdf' }));
    return { ok: true, url, ouvert: ouvrirPdfOnglet(url) };
  } catch (_) { libererOngletPdf(); return { ok: false, message: "Ce PDF n'a pas pu être lu." }; }
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
  const h3 = { fontSize: 13, fontWeight: 700, color: C.muted, textTransform:'none', letterSpacing:'normal', margin: '22px 0 10px' };
  let corps;
  if (d === undefined) corps = <div data-equipe-etat="chargement" style={{ fontSize: 15, color: C.muted }}>Lecture des colis…</div>;
  else if (d === null) corps = <div data-equipe-etat="pas-su"><LignePanne>Je n'ai pas pu lire les colis — la base n'a pas répondu. Rien n'est perdu. <button type="button" onClick={charger} style={{ border: 'none', background: 'transparent', color: C.accentTexte, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Réessayer</button></LignePanne></div>;
  else if (d.nonInstalle) corps = <div data-equipe-etat="non-installe" style={{ ...carte, fontSize: 15, color: C.text }}>{EQUIPE_NON_INSTALLE_AIDE}<div data-equipe-geste="aide" style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{EQUIPE_NON_INSTALLE_GESTE_AIDE}</div></div>;
  else if (d.sansAcces) corps = <div data-equipe-etat="sans-acces" style={{ ...carte, fontSize: 15, color: C.text, lineHeight: 1.55 }}>Plus d'accès aux colis de cette équipe. Invitation retirée, ou abonnement du vendeur fini.</div>;
  else {
    const ventes = d.ventes.filter((o) => aExpedier(o) && !d.postes.has(String(o.transaction_id)));
    // (5 nov.) `needs_action` sur un ACHAT veut dire « une action » : « Commande livrée ! »
    // (confirmer « Tout est OK », le colis est déjà retiré) ou « non réclamée - retournée »
    // le portent aussi (mesuré : 12 sur 21). Seul le statut « au point relais » compte.
    const achats = d.achats.filter((o) => !d.retires.has(String(o.transaction_id)) && isAtRelayStatus(o.status));
    const labelsTx = new Map(); (d.labels || []).forEach((l) => { const m = /_label_([A-Za-z0-9]+)$/.exec(l.id || ''); const tx = (m && m[1] !== 'latest' && m[1] === String(l.tx || m[1])) ? m[1] : ''; if (tx && !labelsTx.has(tx)) labelsTx.set(tx, l.id); });
    const bordsTx = new Map(); (d.bords || []).forEach((b) => { if (b && b.filename && b.filename !== 'None' && b.transaction && !bordsTx.has(String(b.transaction))) bordsTx.set(String(b.transaction), b); });
    const compte = (o) => d.comptes[String(o.uid || '')] || '';
    const plusieurs = new Set([...ventes, ...achats].map(compte)).size > 1;
    // (23 oct.) La règle de l'écran Achats (§11) : à retirer, pas « à vérifier ».
    // (23 oct.) …et un colis RETIRÉ ou REPARTI selon un autre e-mail au même n°
    // de suivi (autre transporteur, n° du sujet) n'y est plus — la règle de
    // l'écran Achats (api/_lib/suivi-colis.js, §11).
    const finsE = finsColis(d.tracks || [], null);
    const sortiE = (t) => !!sortiParSuivi(t, finsE);
    const tracks = (d.tracks || []).filter((t) => t.status === 'available' && etatColisEmail(t).etat === 'a_retirer' && !sortiE(t));
    // ⚠️ (revue du 23 oct.) …ET LES « À VÉRIFIER » NE DISPARAISSENT PAS. Un colis
    // dont la date limite est passée, ou gardé plus longtemps que ne le fait son
    // transporteur, était simplement filtré : l'aide ne le voyait plus du tout,
    // code compris — or il est peut-être encore au relais. Il a sa ligne, avec
    // SA raison, et ne compte dans aucun « à retirer » (§11, écran Achats).
    const tracksAVerifier = (d.tracks || []).filter((t) => t.status === 'available' && estAVerifier(etatColisEmail(t)) && !sortiE(t));
    const imprimer = async (o, row, numero) => {
      const k = String(o.transaction_id);
      setMsg((m) => ({ ...m, [k]: 'Préparation…' }));
      const r = await imprimerBordereauEquipe(vendeur, row, numero, o.title || '');
      setMsg((m) => ({ ...m, [k]: r.ok ? '' : r.message }));
      if (r.ok && !r.ouvert) setLien((l) => ({ ...l, [k]: r.url }));
    };
    corps = (<>
      {(d.bords === null || d.labels === null || d.relais === null || d.tracks === null) && (
        <div data-equipe-partiel="" style={{ marginBottom: 12 }}><LignePanne>Colis pas tous lus : ce qui manque n'est pas « vide ». <button type="button" onClick={charger} style={{ border: 'none', background: 'transparent', color: C.accentTexte, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Relire</button></LignePanne></div>
      )}
      <div style={h3}>À envoyer · {ventes.length}</div>
      {!ventes.length && <div data-equipe-vide="ventes" style={{ fontSize: 15, color: C.muted }}>Aucun colis à expédier pour l'instant.</div>}
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
            {orderPhoto(o) ? <PhotoVinted src={orderPhoto(o)} alt="" loading="lazy" style={{ width: 52, height: 68, objectFit: 'cover', borderRadius: 12, flexShrink: 0, background: C.bg }}/> : null}
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }}>{numero ? `N°${numero} · ` : ''}{o.title || 'Article'}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{[plusieurs && compte(o) ? `compte ${compte(o)}` : '', b && b.dateLimite ? `à poster avant le ${b.dateLimite}` : ''].filter(Boolean).join(' · ') || o.status || ''}</div>
              {msg[k] && <div data-equipe-msg={k} style={{ fontSize: 13, color: C.warn, marginTop: 4 }}>{msg[k]}</div>}
              {lien[k] && <a href={lien[k]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accentTexte, fontWeight: 600 }}>Ouvrir le bordereau</a>}
            </div>
            {row
              ? <button type="button" data-imprime="1" data-equipe-imprimer={k} onClick={() => imprimer(o, row, numero)} style={{ border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '10px 14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flex: '0 1 auto', maxWidth: 260 }}>🖨 Imprimer le bordereau</button>
              : <span data-equipe-sans-bordereau={k} style={{ fontSize: 13, color: C.muted }}>{d.bords === null || d.labels === null ? 'Bordereau pas encore vérifié' : 'Bordereau pas encore reçu'}</span>}
          </div>
        );
      })}
      <div style={h3}>À retirer · {achats.length}</div>
      {!achats.length && <div data-equipe-vide="achats" style={{ fontSize: 15, color: C.muted }}>Aucun colis à retirer pour l'instant.</div>}
      {achats.map((o) => {
        const k = String(o.transaction_id);
        const r = (d.relais && d.relais[k]) || null;
        const code = r ? codeRetrait(r.code) : '';
        const qr = r ? qrImage(r) : null;
        return (
          <div key={k} data-equipe-achat={k} style={carte}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }}>{o.title || 'Article'}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{[plusieurs && compte(o) ? `compte ${compte(o)}` : '', r && r.lieu ? r.lieu : ''].filter(Boolean).join(' · ') || o.status || ''}</div>
            {code
              ? <div className="vrm-sensible" data-stream-type="code" data-equipe-code={k} style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '.06em', marginTop: 8 }}>{code}</div>
              : <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{d.relais === null ? 'Code pas encore vérifié' : 'Code pas encore lu — il est dans la conversation Vinted de cet achat.'}</div>}
            {qr && <PhotoVinted src={qr} alt="QR de retrait" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 8, background: '#fff', borderRadius: 8 }}/>}
          </div>
        );
      })}
      {tracks.length > 0 && (<>
        <div style={h3}>Codes reçus par e-mail · {tracks.length}</div>
        {tracks.map((t, i) => {
          const code = codeRetrait(t.code); const qr = qrImage(t);
          return (
            <div key={(t.suivi || '') + i} data-equipe-track="" style={carte}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{(CARRIERS[t.carrier] && CARRIERS[t.carrier].name) || 'Transporteur'}{t.lieu ? ` · ${t.lieu}` : ''}</div>
              {/* « aaaa-mm-jj » s'écrivait tel quel (revue visuelle du 17 oct.) :
                  la date se lit comme sur l'écran Achats ; illisible ⇒ rien. */}
              {joursAvant(t.limite) != null && <div data-equipe-limite="" style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>à retirer avant le {new Date(String(t.limite) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>}
              {code ? <div className="vrm-sensible" data-stream-type="code" style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '.06em', marginTop: 8 }}>{code}</div> : null}
              {qr && <PhotoVinted src={qr} alt="QR de retrait" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 8, background: '#fff', borderRadius: 8 }}/>}
            </div>
          );
        })}
      </>)}
      {tracksAVerifier.length > 0 && (<>
        <div style={h3}>À vérifier · {tracksAVerifier.length}</div>
        <div data-equipe-a-verifier={tracksAVerifier.length} style={{ fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.45 }}>Sans doute {tracksAVerifier.length > 1 ? 'repartis' : 'reparti'} chez le vendeur, pas comptés. Avec un code : peut-être au relais.</div>
        {tracksAVerifier.map((t, i) => {
          const code = codeRetrait(t.code); const qr = qrImage(t); const e = etatColisEmail(t);
          const raison = e.etat === 'delai_depasse'
            ? `délai de retrait dépassé${t.limite ? ` le ${new Date(String(t.limite).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}`
            : `au point relais depuis plus de ${Number.isFinite(e.garde) ? e.garde : GARDE_MAX_J} jours`;
          return (
            <div key={'v' + (t.suivi || '') + i} data-equipe-track-a-verifier={e.etat} style={carte}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{(CARRIERS[t.carrier] && CARRIERS[t.carrier].name) || 'Transporteur'}{t.lieu ? ` · ${cleanLieu(t.lieu).nom || t.lieu}` : ''}</div>
              <div style={{ fontSize: 13, color: C.warn, marginTop: 3 }}>{raison}{t.suivi ? ` · n° ${t.suivi}` : ''}</div>
              {code ? <div className="vrm-sensible" data-stream-type="code" style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '.06em', marginTop: 8 }}>{code}</div> : null}
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
export { ColisEquipe };
